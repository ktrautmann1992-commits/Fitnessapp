import {
  type FoodLookup,
  manualItemFromProduct,
  matchScannedProduct,
  MOCK_PRODUCT_CASES,
  normalizeBarcode,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  type ShoppingListItem,
  type ShoppingScanMatch,
  userProductForCode,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  barcodeScanSupported,
  BarcodeScanner,
  CAMERA_SETTINGS_HELP,
} from '@/components/barcode-scanner';
import {
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
import { shoppingCategoryLabel, shoppingItemText } from '@/lib/nutrition-format';
import { useOnline } from '@/lib/use-online';
import { useApp } from '@/state/app-state';
import { healthConsentStatus } from '@/state/flow';
import type { ShoppingActionOutcome, ShoppingListActions } from '@/state/use-nutrition';

/** Testnummern der Attrappe, die im Testmodus ohne Packung „gescannt“ werden können. */
const TEST_CASES = MOCK_PRODUCT_CASES.filter((c) =>
  (['plausibel', 'getraenk', 'nicht_gefunden'] as string[]).includes(c.key),
);

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'typing' }
  | { kind: 'searching' }
  | { kind: 'choose'; code: string | null; name: string; candidates: readonly ShoppingListItem[] }
  | {
      kind: 'add';
      code: string | null;
      label: string;
      category: ShoppingCategory;
      /** true = „Nicht auf deiner Liste“ (Produkt erkannt); false = eigener Artikel nach „nicht erkannt“. */
      recognized: boolean;
    }
  | { kind: 'unknown'; code: string | null; reason: string };

type Feedback = {
  text: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  /** Schlüssel des eben abgehakten Eintrags → Knopf „Rückgängig“ (EA-3). */
  undo?: { itemKey: string; label: string };
};

/**
 * Im Laden scannen (Reiter „Einkaufen“, docs/PLAN-EINKAUFEN-AUSDAUER.md 3, EA-G1/EA-3): Strichcode per Kamera (bzw.
 * Nummer eintippen) → eigene Produkte und gelernte Zuordnungen zuerst (ohne Netz) → sonst Produktabfrage über unseren
 * Server (Testmodus: Attrappe) → Abgleich in packages/core (`matchScannedProduct`). Eindeutig → sofort abhaken mit
 * „Rückgängig“; mehrere → Auswahl (+ „Keiner davon“), die Wahl wird mit Einwilligung als Zuordnung gelernt; nicht auf
 * der Liste → „Zusätzlich hinzufügen?“ (Name vorbefüllt, Abteilung änderbar); nicht erkannt/offline → Auswahl aus den
 * offenen Einträgen oder eigener Artikel. Nie eine Sackgasse. Kamerabilder, Nummern und Namen werden nie gespeichert
 * (außer der bewusst gewählten Zuordnung) oder geloggt; testIDs ohne Nummer und Namen.
 */
export function ShoppingScanPanel({
  actions,
  foods,
  disabled,
}: {
  actions: ShoppingListActions;
  foods: FoodLookup | null;
  disabled: boolean;
}) {
  const app = useApp();
  const online = useOnline();
  const [canScan] = useState(barcodeScanSupported);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [scanProblem, setScanProblem] = useState<'denied' | 'problem' | null>(null);
  const [labelError, setLabelError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const texts = t.nutrition.shopping.scan;
  const list = actions.list;
  // Aktuelle Aktionen auch in asynchronen Abläufen (die Liste ändert sich nach jedem Speichern).
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  }, [actions]);
  const rows = app.rows;
  const links = (rows?.shoppingProductLinks ?? []).map((l) => ({
    code: l.code,
    food_id: l.food_id,
  }));
  const consentValid = rows !== null && healthConsentStatus(rows, app.versions) === 'valid';

  const failedText = (outcome: ShoppingActionOutcome | null) =>
    outcome?.kind === 'invalid' && outcome.message
      ? outcome.message
      : t.nutrition.shopping.saveFailed;

  const check = useCallback(
    async (item: ShoppingListItem, learnCode: string | null) => {
      setBusy(true);
      try {
        const outcome = await actionsRef.current.toggle(item.itemKey, true);
        if (outcome.kind !== 'ok') {
          setFeedback({ text: failedText(outcome), tone: 'danger' });
          return;
        }
        setFeedback({
          text: texts.checked(item.labelDe),
          tone: 'success',
          undo: { itemKey: item.itemKey, label: item.labelDe },
        });
        setPhase({ kind: 'idle' });
        // Bewusste Wahl lernen (nur Lebensmittel des Katalogs, nur mit Einwilligung). Scheitert das (offline),
        // bleibt das Abhaken gültig – kein Hinweis nötig.
        if (learnCode !== null && item.foodId !== null && consentValid) {
          await app
            .saveShoppingProductLink({ code: learnCode, food_id: item.foodId })
            .catch(() => undefined);
        }
      } finally {
        setBusy(false);
      }
    },
    // failedText/texts sind feste Texte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app, consentValid],
  );

  const show = useCallback(
    async (result: ShoppingScanMatch, ctx: { code: string | null; name: string | null }) => {
      switch (result.kind) {
        case 'match':
          await check(result.item, null);
          return;
        case 'already_checked':
          setFeedback({ text: texts.alreadyChecked(result.item.labelDe), tone: 'info' });
          setPhase({ kind: 'idle' });
          return;
        case 'choose':
          setPhase({
            kind: 'choose',
            code: ctx.code,
            name: ctx.name ?? '',
            candidates: result.candidates,
          });
          return;
        case 'none': {
          const label = ctx.name === null ? null : manualItemFromProduct(ctx.name);
          setPhase(
            label === null
              ? { kind: 'unknown', code: ctx.code, reason: texts.notFound }
              : {
                  kind: 'add',
                  code: ctx.code,
                  label,
                  category: result.suggestedCategory,
                  recognized: true,
                },
          );
        }
      }
    },
    [check, texts],
  );

  const handleCode = useCallback(
    async (raw: string) => {
      setFeedback(null);
      setScanProblem(null);
      setLabelError(undefined);
      const checked = normalizeBarcode(raw);
      if (!checked.ok) {
        if (checked.reason === 'invalid') {
          setFeedback({ text: texts.invalidCode, tone: 'warning' });
          setPhase({ kind: 'typing' });
        } else {
          setPhase({ kind: 'unknown', code: null, reason: texts.notFoodCode });
        }
        return;
      }
      const digits = checked.code;
      // 1. Gelernte Zuordnung bzw. eigenes Produkt – ohne Netz.
      const own = userProductForCode(rows?.userFoodProducts ?? [], digits);
      if (links.some((l) => l.code === digits) || own !== null) {
        await show(
          matchScannedProduct(
            { code: digits, productName: own?.name_de ?? null, brand: own?.brand_de ?? null },
            actionsRef.current.list,
            foods ?? undefined,
            links,
          ),
          { code: digits, name: own?.name_de ?? null },
        );
        return;
      }
      // 2. Produktabfrage über unseren Server (Testmodus: Attrappe).
      if (!online) {
        setPhase({ kind: 'unknown', code: digits, reason: texts.offline });
        return;
      }
      setPhase({ kind: 'searching' });
      try {
        const response = await app.backend.lookupFoodProduct(digits);
        if (response.code === 'found') {
          const name = response.product.name_de;
          await show(
            matchScannedProduct(
              { code: digits, productName: name, brand: response.product.brand_de },
              actionsRef.current.list,
              foods ?? undefined,
              links,
            ),
            { code: digits, name },
          );
          return;
        }
        const reason =
          response.code === 'not_found'
            ? texts.notFound
            : response.code === 'no_consent'
              ? texts.noConsent
              : response.code === 'rate_limited'
                ? texts.rateLimited
                : response.code === 'invalid_code'
                  ? texts.invalidCode
                  : response.code === 'not_food_code'
                    ? texts.notFoodCode
                    : texts.unavailable;
        setPhase({ kind: 'unknown', code: digits, reason });
      } catch {
        setPhase({ kind: 'unknown', code: digits, reason: texts.unavailable });
      }
    },
    [app.backend, foods, links, online, rows?.userFoodProducts, show, texts],
  );

  const onScanResult = useCallback(
    (result: BarcodeScanResult) => {
      if (result.kind === 'code') {
        void handleCode(result.digits);
        return;
      }
      setScanProblem(result.kind === 'denied' ? 'denied' : 'problem');
      setPhase({ kind: 'typing' });
    },
    [handleCode],
  );

  async function addItem(entry: Extract<Phase, { kind: 'add' }>) {
    if (entry.label.trim() === '') {
      setLabelError(texts.nameEmpty);
      return;
    }
    setBusy(true);
    try {
      const outcome = await actions.addManual(entry.label, entry.category, null, true);
      if (outcome.kind !== 'ok') {
        setLabelError(failedText(outcome));
        return;
      }
      setFeedback({ text: texts.added(entry.label.trim()), tone: 'success' });
      setPhase({ kind: 'idle' });
    } finally {
      setBusy(false);
    }
  }

  async function undo(itemKey: string, label: string) {
    setBusy(true);
    try {
      const outcome = await actions.toggle(itemKey, false);
      setFeedback(
        outcome.kind === 'ok'
          ? { text: texts.undone(label), tone: 'info' }
          : { text: failedText(outcome), tone: 'danger' },
      );
    } finally {
      setBusy(false);
    }
  }

  const openItems = list.items.filter((i) => !i.checked);
  const cancel = (
    <Button
      label={texts.cancel}
      variant="secondary"
      onPress={() => setPhase({ kind: 'idle' })}
      testID="shopping-scan-cancel"
    />
  );
  const pickButton = (item: ShoppingListItem, learnCode: string | null) => (
    <Button
      key={item.itemKey}
      label={shoppingItemText(item)}
      accessibilityLabel={texts.chooseA11y(item.labelDe)}
      variant="secondary"
      disabled={busy || disabled}
      onPress={() => void check(item, learnCode)}
      testID={`shopping-scan-pick-${item.itemKey}`}
    />
  );

  let body: ReactNode = null;
  switch (phase.kind) {
    case 'idle':
      body = (
        <>
          {canScan ? (
            <Button
              label={texts.camera}
              disabled={disabled || busy}
              onPress={() => {
                setFeedback(null);
                setScanProblem(null);
                setPhase({ kind: 'scanning' });
              }}
              testID="shopping-scan"
            />
          ) : null}
          <Button
            label={texts.typeCode}
            variant={canScan ? 'secondary' : 'primary'}
            disabled={disabled || busy}
            onPress={() => {
              setFeedback(null);
              setPhase({ kind: 'typing' });
            }}
            testID="shopping-scan-type"
          />
        </>
      );
      break;
    case 'scanning':
      body = (
        <>
          <BarcodeScanner onResult={onScanResult} />
          {cancel}
        </>
      );
      break;
    case 'typing':
      body = (
        <>
          {scanProblem !== null ? (
            <Notice tone="info" testID={`shopping-scan-${scanProblem}`}>
              <Body>{scanProblem === 'denied' ? texts.denied : texts.cameraProblem}</Body>
              {scanProblem === 'denied' ? <Body muted>{CAMERA_SETTINGS_HELP}</Body> : null}
            </Notice>
          ) : null}
          <TextField
            label={texts.codeLabel}
            hint={texts.codeHint}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={20}
            onSubmitEditing={() => void handleCode(code)}
            testID="shopping-scan-code"
          />
          <Button
            label={texts.search}
            disabled={disabled || code.trim() === ''}
            onPress={() => void handleCode(code)}
            testID="shopping-scan-search"
          />
          {app.backend.mode === 'local' ? (
            <View style={{ gap: 4 }} testID="shopping-scan-testcodes">
              <Body muted>{texts.testCodes}</Body>
              {TEST_CASES.map((c) => (
                <Button
                  key={c.key}
                  label={`${c.label}: ${c.code}`}
                  accessibilityLabel={texts.testCodeA11y(c.label)}
                  variant="link"
                  onPress={() => {
                    setCode(c.code);
                    void handleCode(c.code);
                  }}
                  testID={`shopping-scan-testcode-${c.key}`}
                />
              ))}
            </View>
          ) : null}
          {cancel}
        </>
      );
      break;
    case 'searching':
      body = <LoadingState label={texts.searching} />;
      break;
    case 'choose':
      body = (
        <View style={{ gap: spacing.sm }} testID="shopping-scan-choose">
          <Heading level={2}>{texts.chooseTitle}</Heading>
          <Body>{texts.chooseText(phase.name)}</Body>
          {phase.candidates.map((item) => pickButton(item, phase.code))}
          {consentValid && phase.code !== null ? <Body muted>{texts.learnHint}</Body> : null}
          <Button
            label={texts.chooseNone}
            variant="secondary"
            onPress={() => {
              const label = manualItemFromProduct(phase.name);
              setPhase(
                label === null
                  ? { kind: 'unknown', code: phase.code, reason: texts.notFound }
                  : {
                      kind: 'add',
                      code: phase.code,
                      label,
                      category: phase.candidates[0]?.category ?? 'other',
                      recognized: true,
                    },
              );
            }}
            testID="shopping-scan-choose-none"
          />
        </View>
      );
      break;
    case 'unknown':
      body = (
        <View style={{ gap: spacing.sm }} testID="shopping-scan-unknown">
          <Notice tone="info" title={texts.notRecognizedTitle}>
            <Body>{phase.reason}</Body>
          </Notice>
          {openItems.length > 0 ? (
            <>
              <Body>{texts.pickFromList}</Body>
              {openItems.map((item) => pickButton(item, phase.code))}
            </>
          ) : (
            <Body muted>{texts.noOpenItems}</Body>
          )}
          <Button
            label={texts.ownItem}
            variant="secondary"
            onPress={() =>
              setPhase({
                kind: 'add',
                code: phase.code,
                label: '',
                category: 'other',
                recognized: false,
              })
            }
            testID="shopping-scan-own"
          />
          {cancel}
        </View>
      );
      break;
    case 'add':
      body = (
        <View style={{ gap: spacing.sm }} testID="shopping-scan-add">
          {phase.recognized ? (
            <Notice tone="info" title={texts.notOnListTitle} testID="shopping-scan-not-on-list">
              <Body>{texts.notOnListText(phase.label)}</Body>
            </Notice>
          ) : null}
          <TextField
            label={texts.nameLabel}
            value={phase.label}
            onChangeText={(label) => setPhase({ ...phase, label })}
            error={labelError}
            maxLength={80}
            testID="shopping-scan-name"
          />
          <ChoiceList
            label={texts.addCategory}
            options={SHOPPING_CATEGORIES.map((c) => ({
              value: c,
              label: shoppingCategoryLabel(c),
            }))}
            value={phase.category}
            onChange={(category) => setPhase({ ...phase, category })}
            horizontal
          />
          <Button
            label={texts.notOnListYes}
            loading={busy}
            disabled={disabled}
            onPress={() => void addItem(phase)}
            testID="shopping-scan-add-yes"
          />
          <Button
            label={texts.notOnListNo}
            variant="secondary"
            onPress={() => setPhase({ kind: 'idle' })}
            testID="shopping-scan-add-no"
          />
        </View>
      );
      break;
  }

  return (
    <Card>
      <Heading level={2}>{texts.title}</Heading>
      <Body muted>{texts.intro}</Body>
      {feedback ? (
        <Notice tone={feedback.tone} testID="shopping-scan-feedback">
          <Body>{feedback.text}</Body>
          {feedback.undo ? (
            <Button
              label={texts.undo}
              accessibilityLabel={texts.undoA11y(feedback.undo.label)}
              variant="secondary"
              disabled={busy}
              onPress={() => {
                const u = feedback.undo;
                if (u) void undo(u.itemKey, u.label);
              }}
              testID="shopping-scan-undo"
            />
          ) : null}
        </Notice>
      ) : null}
      {body}
    </Card>
  );
}
