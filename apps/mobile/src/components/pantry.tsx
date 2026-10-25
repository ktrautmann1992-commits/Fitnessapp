import {
  type Food,
  type FoodLookup,
  matchScannedPantryFood,
  MOCK_PRODUCT_CASES,
  normalizeBarcode,
  PANTRY,
  pantryAmountText,
  type PantryItem,
  pantryUnitInfo,
  userProductForCode,
} from '@fitnessapp/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  barcodeScanSupported,
  BarcodeScanner,
  CAMERA_SETTINGS_HELP,
} from '@/components/barcode-scanner';
import {
  Badge,
  Body,
  Button,
  Card,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { t } from '@/i18n';
import type { BarcodeScanResult } from '@/lib/barcode-scan';
import { useOnline } from '@/lib/use-online';
import { useApp } from '@/state/app-state';

/**
 * Bausteine des Vorratsschranks (25.10.2026): eine Zeile mit Menge in Kaufeinheiten, „fast leer“, Entfernen – und das
 * Scannen eines Strichcodes (Regeln `matchScannedPantryFood` in packages/core, Abfrage wie im Laden). Nur Anzeige;
 * Lebensmittel und Mengen nie in testIDs oder Logs (testIDs mit Katalog-ID sind keine Nutzerdaten).
 */
export function PantryItemRow({
  item,
  food,
  busy,
  onChange,
  onRemove,
}: {
  item: PantryItem;
  food: Food | undefined;
  busy: boolean;
  onChange: (item: PantryItem) => void;
  onRemove: () => void;
}) {
  const texts = t.pantry;
  const [editing, setEditing] = useState(false);
  const name = food?.name_de ?? item.food_id;
  const info = food ? pantryUnitInfo(food) : null;
  const amount = food ? pantryAmountText(item, food) : null;
  const step = PANTRY.countStep;
  const setCount = (count: number | null) =>
    onChange({
      ...item,
      count,
      pack_size: count === null ? null : item.pack_size,
    });
  return (
    <View style={styles.row} testID={`pantry-item-${item.food_id}`}>
      <View style={styles.head}>
        <Body>{name}</Body>
        <View style={styles.badges}>
          <Body muted testID={`pantry-amount-${item.food_id}`}>
            {amount ?? texts.have}
          </Body>
          {item.low ? (
            <Badge label={texts.low} testID={`pantry-low-badge-${item.food_id}`} />
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={texts.lowToggle}
          variant={item.low ? 'primary' : 'secondary'}
          accessibilityLabel={texts.lowA11y(name)}
          disabled={busy}
          onPress={() => onChange({ ...item, low: !item.low })}
          testID={`pantry-low-${item.food_id}`}
        />
        {info !== null && info.kind !== 'stock' ? (
          <Button
            label={editing ? texts.done : texts.amountEdit}
            variant="secondary"
            accessibilityLabel={texts.amountA11y(name)}
            disabled={busy}
            onPress={() => setEditing((v) => !v)}
            testID={`pantry-edit-${item.food_id}`}
          />
        ) : null}
        <Button
          label={texts.remove}
          variant="secondary"
          accessibilityLabel={texts.removeA11y(name)}
          disabled={busy}
          onPress={onRemove}
          testID={`pantry-remove-${item.food_id}`}
        />
      </View>
      {editing && info !== null && info.kind !== 'stock' ? (
        <Card>
          <View style={styles.column} testID={`pantry-amount-form-${item.food_id}`}>
            <Body>{`${texts.amountLabel}: ${amount ?? texts.amountNone}`}</Body>
            <View style={styles.actions}>
              <Button
                label={`− ${texts.less}`}
                variant="secondary"
                disabled={busy || item.count === null}
                onPress={() =>
                  setCount(
                    item.count === null || item.count <= step
                      ? null
                      : Math.max(step, item.count - 1),
                  )
                }
                testID={`pantry-less-${item.food_id}`}
              />
              <Button
                label={`+ ${texts.more}`}
                variant="secondary"
                disabled={busy || (item.count ?? 0) >= PANTRY.countMax}
                onPress={() => setCount(Math.min(PANTRY.countMax, (item.count ?? 0) + 1))}
                testID={`pantry-more-${item.food_id}`}
              />
              <Button
                label={texts.amountNone}
                variant="secondary"
                disabled={busy || item.count === null}
                onPress={() => setCount(null)}
                testID={`pantry-none-${item.food_id}`}
              />
            </View>
            {info.kind === 'pack' && info.sizes.length > 1 && item.count !== null ? (
              <ChoiceList
                label={texts.packSize}
                horizontal
                options={info.sizes.map((size, i) => ({
                  value: size,
                  label: info.sizeLabels[i] ?? String(size),
                  testID: `pantry-size-${size}`,
                }))}
                value={item.pack_size ?? info.sizes[0] ?? null}
                onChange={(size) => onChange({ ...item, pack_size: size })}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const TEST_CASES = MOCK_PRODUCT_CASES.filter((c) =>
  (['plausibel', 'nicht_gefunden'] as string[]).includes(c.key),
);

type ScanPhase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'typing'; problem: 'denied' | 'problem' | null }
  | { kind: 'searching' }
  | { kind: 'found'; foodIds: readonly string[]; name: string | null }
  | { kind: 'none'; reason: string };

/**
 * Strichcode → Vorrat: Kamera (bzw. Nummer eintippen) → eigene Produkte und gelernte Zuordnungen zuerst (ohne Netz) →
 * sonst Produktabfrage über unseren Server (Testmodus: Attrappe) → `matchScannedPantryFood`. Eindeutig → Vorschlag
 * „… zum Vorrat hinzufügen“, mehrere → Auswahl, sonst Hinweis auf die Suche. Nichts wird ohne Tipp hinzugefügt.
 */
export function PantryScanPanel({
  foods,
  busy,
  onAdd,
}: {
  foods: FoodLookup;
  busy: boolean;
  onAdd: (foodId: string) => void;
}) {
  const app = useApp();
  const online = useOnline();
  const texts = t.pantry;
  const scanTexts = t.nutrition.shopping.scan;
  const [canScan] = useState(barcodeScanSupported);
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const links = (app.rows?.shoppingProductLinks ?? []).map((l) => ({
    code: l.code,
    food_id: l.food_id,
  }));

  async function handle(raw: string) {
    const checked = normalizeBarcode(raw);
    if (!checked.ok) {
      setPhase({
        kind: 'none',
        reason: checked.reason === 'invalid' ? scanTexts.invalidCode : scanTexts.notFoodCode,
      });
      return;
    }
    const digits = checked.code;
    const own = userProductForCode(app.rows?.userFoodProducts ?? [], digits);
    const show = (name: string | null, brand: string | null) => {
      const match = matchScannedPantryFood(
        { code: digits, productName: name, brand },
        foods,
        links,
      );
      if (match.kind === 'none') setPhase({ kind: 'none', reason: texts.scanNone });
      else
        setPhase({
          kind: 'found',
          foodIds: match.kind === 'match' ? [match.foodId] : match.foodIds,
          name,
        });
    };
    if (own !== null || links.some((l) => l.code === digits)) {
      show(own?.name_de ?? null, own?.brand_de ?? null);
      return;
    }
    if (!online) {
      setPhase({ kind: 'none', reason: texts.offline });
      return;
    }
    setPhase({ kind: 'searching' });
    try {
      const response = await app.backend.lookupFoodProduct(digits);
      if (response.code === 'found') show(response.product.name_de, response.product.brand_de);
      else
        setPhase({
          kind: 'none',
          reason: response.code === 'not_found' ? scanTexts.notFound : scanTexts.unavailable,
        });
    } catch {
      setPhase({ kind: 'none', reason: scanTexts.unavailable });
    }
  }

  const onScan = (result: BarcodeScanResult) => {
    if (result.kind === 'code') void handle(result.digits);
    else setPhase({ kind: 'typing', problem: result.kind === 'denied' ? 'denied' : 'problem' });
  };
  const cancel = (
    <Button
      label={scanTexts.cancel}
      variant="secondary"
      onPress={() => setPhase({ kind: 'idle' })}
      testID="pantry-scan-cancel"
    />
  );

  let body: ReactNode;
  switch (phase.kind) {
    case 'idle':
      body = (
        <>
          {canScan ? (
            <Button
              label={scanTexts.camera}
              icon="scan"
              disabled={busy}
              onPress={() => setPhase({ kind: 'scanning' })}
              testID="pantry-scan"
            />
          ) : null}
          <Button
            label={scanTexts.typeCode}
            variant={canScan ? 'secondary' : 'primary'}
            disabled={busy}
            onPress={() => setPhase({ kind: 'typing', problem: null })}
            testID="pantry-scan-type"
          />
        </>
      );
      break;
    case 'scanning':
      body = (
        <>
          <BarcodeScanner onResult={onScan} />
          {cancel}
        </>
      );
      break;
    case 'typing':
      body = (
        <>
          {phase.problem !== null ? (
            <Notice tone="info">
              <Body>{phase.problem === 'denied' ? scanTexts.denied : scanTexts.cameraProblem}</Body>
              {phase.problem === 'denied' ? <Body muted>{CAMERA_SETTINGS_HELP}</Body> : null}
            </Notice>
          ) : null}
          <TextField
            label={scanTexts.codeLabel}
            hint={scanTexts.codeHint}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={20}
            onSubmitEditing={() => void handle(code)}
            testID="pantry-scan-code"
          />
          <Button
            label={scanTexts.search}
            disabled={code.trim() === ''}
            onPress={() => void handle(code)}
            testID="pantry-scan-search"
          />
          {app.backend.mode === 'local' ? (
            <View style={styles.column}>
              <Body muted>{scanTexts.testCodes}</Body>
              {TEST_CASES.map((c) => (
                <Button
                  key={c.key}
                  label={`${c.label}: ${c.code}`}
                  variant="link"
                  onPress={() => {
                    setCode(c.code);
                    void handle(c.code);
                  }}
                  testID={`pantry-scan-testcode-${c.key}`}
                />
              ))}
            </View>
          ) : null}
          {cancel}
        </>
      );
      break;
    case 'searching':
      body = <LoadingState label={scanTexts.searching} />;
      break;
    case 'found':
      body = (
        <View style={styles.column} testID="pantry-scan-found">
          {phase.foodIds.length > 1 ? <Heading level={2}>{texts.scanChoose}</Heading> : null}
          {phase.foodIds.map((id) => {
            const name = foods.get(id)?.name_de ?? id;
            return (
              <Button
                key={id}
                label={texts.scanAdd(name)}
                disabled={busy}
                onPress={() => {
                  onAdd(id);
                  setPhase({ kind: 'idle' });
                }}
                testID={`pantry-scan-add-${id}`}
              />
            );
          })}
          {cancel}
        </View>
      );
      break;
    case 'none':
      body = (
        <View style={styles.column} testID="pantry-scan-none">
          <Notice tone="info">
            <Body>{phase.reason}</Body>
          </Notice>
          {cancel}
        </View>
      );
      break;
  }

  return (
    <Card>
      <View style={styles.column} testID="pantry-scan-panel">
        <Heading level={2}>{texts.scanTitle}</Heading>
        <Body muted>{texts.scanHint}</Body>
        {body}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 8 },
  head: { gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  column: { gap: 8 },
});
