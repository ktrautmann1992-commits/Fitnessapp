import {
  defaultFoodLogSlot,
  entryFromProduct,
  entryFromUserProduct,
  FOOD_LOG_MANUAL_SLOTS,
  foodLogDateStatus,
  type FoodLogBuild,
  type FoodLogEntry,
  type FoodLogManualSlot,
  isFavoriteEntry,
  isoDateSchema,
  MOCK_PRODUCT_CASES,
  needsFoodLogConfirmation,
  normalizeBarcode,
  productAmountChoices,
  type ProductLookupResponse,
  type UserFoodProduct,
  userProductForCode,
} from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  barcodeScanSupported,
  BarcodeScanner,
  CAMERA_SETTINGS_HELP,
  openCameraSettings,
} from '@/components/barcode-scanner';
import { ProductCard, UserFoodProductForm } from '@/components/food-product';
import { TestBarcode } from '@/components/test-barcode';
import { NutritionGate, nutritionReady } from '@/components/nutrition';
import { ConfirmDialog, Screen } from '@/components/screen';
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
import { BackendError } from '@/data/backend';
import { newId } from '@/data/create-backend';
import { userFoodProductFromRow } from '@/data/user-food-product-rows';
import { t } from '@/i18n';
import type { BarcodeScanResult } from '@/lib/barcode-scan';
import { errorText } from '@/lib/error-text';
import {
  buildErrorText,
  confirmText,
  foodLogDayText,
  manualSlotLabel,
} from '@/lib/food-log-format';
import { per100Text, PER100_ROWS, productAmountText } from '@/lib/food-product-format';
import { parseDecimal, formatDecimal } from '@/lib/format';
import { takeProductHandoff, type UserProductPrefill } from '@/lib/product-handoff';
import { useOnline } from '@/lib/use-online';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useFoodLogActions, useFoodLogDay } from '@/state/use-food-log';
import { useNutritionWeek } from '@/state/use-nutrition';

type Message = { text: string; tone: 'success' | 'danger' | 'warning' | 'info' };

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'searching' }
  | { kind: 'result'; response: ProductLookupResponse }
  | { kind: 'own'; id: string }
  | { kind: 'create'; id: string; prefill: UserProductPrefill; back: Phase };

/**
 * Ernährung → Eintragen → „Produkt (Barcode)“ (Etappe E4a, docs/PLAN-E4.md 2.1–2.3): Nummer unter dem Strichcode
 * eintippen (Prüfziffer prüft schon das Gerät) → zuerst eigene Produkte, sonst Abfrage über unseren Server (nie direkt
 * bei Open Food Facts) → Produktansicht → Menge → „Eintragen“ (Herkunft `product`; Werte rechnet der Server nach).
 * Unbekannt/unbrauchbar → eigenes Produkt anlegen (nur für die Person). Zustände: Laden, nicht gefunden, unbrauchbar,
 * „Werte prüfen“ (Haken Pflicht), Laden-/Waagencode, offline, Limit, nicht erreichbar, nicht eingerichtet, keine
 * Einwilligung. Kamera (Etappe E4b, Plan 5): Knopf „Mit der Kamera scannen“ nur, wenn das Gerät es kann; der erkannte
 * Code landet im Nummernfeld und läuft durch dieselbe Prüfung und denselben Ablauf; Kamera verweigert → Hinweis und
 * Nummer eintippen. Kamerabilder werden nie gespeichert oder gesendet. Die Nummer steht nie in der Adresse (Übergabe im Arbeitsspeicher, `product-handoff.ts`). Bei
 * „Kalorienzahlen aus“ keine Zahlen. testIDs ohne Nummer, Name oder Marke.
 */
export default function FoodProductScreen() {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ tag?: string; platz?: string }>();
  const today = useToday();
  const online = useOnline();
  const [handoff] = useState(() => takeProductHandoff());
  const tag = isoDateSchema.safeParse(params.tag);
  const date = tag.success && foodLogDateStatus(tag.data, today) === 'ok' ? tag.data : today;
  const [slot, setSlot] = useState<FoodLogManualSlot>(() => {
    const wanted = (FOOD_LOG_MANUAL_SLOTS as readonly string[]).find((s) => s === params.platz);
    const now = new Date();
    return (
      (wanted as FoodLogManualSlot | undefined) ??
      defaultFoodLogSlot(now.getHours() * 60 + now.getMinutes())
    );
  });
  const view = useNutritionWeek(date);
  const foodLog = useFoodLogDay(date, view.showNumbers);
  const actions = useFoodLogActions();
  const [code, setCode] = useState(handoff?.code ?? '');
  const [phase, setPhase] = useState<Phase>(
    handoff?.ownId !== undefined ? { kind: 'own', id: handoff.ownId } : { kind: 'idle' },
  );
  const [amount, setAmount] = useState(
    handoff?.amount !== undefined ? formatDecimal(handoff.amount) : '',
  );
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<FoodLogEntry | null>(null);
  const [lastSaved, setLastSaved] = useState<FoodLogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [canScan] = useState(barcodeScanSupported);
  const [showTestBarcodes, setShowTestBarcodes] = useState(false);
  const [scanProblem, setScanProblem] = useState<'denied' | 'unavailable' | 'interrupted' | null>(
    null,
  );
  const { backend } = app;
  const userProducts = app.rows?.userFoodProducts ?? [];

  const lookup = useCallback(
    async (raw: string, options: { skipOwn: boolean }) => {
      setMessage(null);
      setScanProblem(null);
      setLastSaved(null);
      setReviewConfirmed(false);
      const checked = normalizeBarcode(raw);
      if (!checked.ok) {
        setPhase({
          kind: 'result',
          response: { code: checked.reason === 'invalid' ? 'invalid_code' : 'not_food_code' },
        });
        return;
      }
      // Zuerst eigene Produkte – ohne Abfrage beim Server (Plan 2.1 Nr. 3).
      const own = options.skipOwn
        ? null
        : userProductForCode(app.rows?.userFoodProducts ?? [], checked.code);
      if (own !== null) {
        setPhase({ kind: 'own', id: own.id });
        return;
      }
      if (!online) {
        setMessage({ text: t.foodProduct.offline, tone: 'info' });
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'searching' });
      try {
        const response = await backend.lookupFoodProduct(checked.code);
        if (response.code === 'found') {
          setAmount((current) =>
            current !== '' ? current : formatDecimal(response.product.serving_g ?? 100),
          );
        }
        setPhase({ kind: 'result', response });
      } catch (error) {
        setPhase({ kind: 'idle' });
        setMessage({
          text:
            error instanceof BackendError && error.code === 'network'
              ? t.foodProduct.offline
              : errorText(error),
          tone: 'warning',
        });
      }
    },
    [app.rows?.userFoodProducts, backend, online],
  );

  // Kamera fertig: Code ins Nummernfeld und derselbe Ablauf wie beim Eintippen (Prüfung, eigene Produkte zuerst …).
  const onScanResult = useCallback(
    (result: BarcodeScanResult) => {
      if (result.kind === 'code') {
        setScanProblem(null);
        setCode(result.digits);
        void lookup(result.digits, { skipOwn: false });
        return;
      }
      setScanProblem(result.kind);
      setPhase({ kind: 'idle' });
    },
    [lookup],
  );

  // Favorit/„Produkt neu abrufen“: sofort abfragen (Nummer aus dem Arbeitsspeicher, nie aus der Adresse).
  const started = useRef(false);
  useEffect(() => {
    if (started.current || handoff?.code === undefined) return;
    started.current = true;
    // Abfrage einmal beim Öffnen (asynchron).
    void lookup(handoff.code, { skipOwn: false });
  }, [handoff, lookup]);

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (route !== HOME_ROUTE || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(`/ernaehrung/eintragen?tag=${date}` as Href);
  const shell = (children: ReactNode) => (
    <Screen
      area="ernaehrung"
      icon="box"
      title={t.foodProduct.title}
      testID="food-product"
      footer={
        <Button
          label={t.foodLog.done}
          variant="secondary"
          onPress={back}
          testID="food-product-done"
        />
      }
    >
      {children}
    </Screen>
  );
  if (!app.backend.supportsNutrition) {
    return shell(<Notice tone="info">{t.foodLog.unsupported}</Notice>);
  }
  if (!nutritionReady(view)) return shell(<NutritionGate view={view} />);
  if (!foodLog.consentValid) {
    return shell(
      <Notice tone="info" testID="food-product-consent">
        <Body>{t.foodProduct.consentNeeded}</Body>
        <Button
          label={t.foodProduct.consentButton}
          variant="secondary"
          onPress={() => router.push('/health-consent')}
          testID="food-product-consent-button"
        />
      </Notice>,
    );
  }
  const rows = app.rows;
  const showNumbers = view.showNumbers;
  const target = () => ({ id: newId(), date, slot });

  async function store(entry: FoodLogEntry, confirmed = false) {
    if (!confirmed && needsFoodLogConfirmation(entry)) {
      setPending(entry);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await actions.save([entry]);
      setLastSaved(entry);
      setMessage({ text: t.foodProduct.saved, tone: 'success' });
    } catch (error) {
      setMessage({ text: errorText(error), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  }
  function submit(build: FoodLogBuild) {
    if (!build.ok) {
      setMessage({ text: buildErrorText(build.reason), tone: 'warning' });
      return;
    }
    void store(build.entry);
  }
  const parsedAmount = () => {
    const value = parseDecimal(amount);
    if (value === null || Number.isNaN(value)) {
      setMessage({ text: t.foodProduct.amountInvalid, tone: 'warning' });
      return null;
    }
    return value;
  };

  const feedback = (
    <>
      {message ? (
        <Notice tone={message.tone} testID="food-product-message">
          {message.text}
        </Notice>
      ) : null}
      {lastSaved ? (
        <Button
          label={
            isFavoriteEntry(rows.foodLogFavorites, lastSaved)
              ? t.foodLog.favoriteRemove
              : t.foodLog.favoriteAdd
          }
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setBusy(true);
            actions
              .toggleFavorite(lastSaved)
              .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
              .finally(() => setBusy(false));
          }}
          testID="food-product-favorite"
        />
      ) : null}
      <ConfirmDialog
        visible={pending !== null}
        title={t.foodLog.confirmTitle}
        message={pending ? confirmText(pending, showNumbers) : ''}
        confirmLabel={t.foodLog.confirmYes}
        confirmVariant="primary"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const entry = pending;
          setPending(null);
          if (entry) void store(entry, true);
        }}
        testID="food-product-confirm"
      />
    </>
  );

  const slotChoice = (
    <View style={{ gap: 4 }}>
      <Body testID="food-product-date">{foodLogDayText(date, today)}</Body>
      <ChoiceList
        label={t.foodLog.slotQuestion}
        horizontal
        options={FOOD_LOG_MANUAL_SLOTS.map((value) => ({ value, label: manualSlotLabel(value) }))}
        value={slot}
        onChange={setSlot}
      />
    </View>
  );

  const amountForm = (
    unit: 'g' | 'ml',
    product: { serving_g: number | null; package_g: number | null },
  ) => (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {productAmountChoices(product).map((choice) => (
          <Button
            key={choice.kind}
            label={t.foodProduct.choice[choice.kind](
              productAmountText(choice.amount, unit).replace(` ${unit}`, ''),
              unit,
            )}
            variant="secondary"
            onPress={() => setAmount(formatDecimal(choice.amount))}
            testID={`food-product-amount-${choice.kind}`}
          />
        ))}
      </View>
      <TextField
        label={t.foodProduct.amountLabel(unit)}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        maxLength={7}
        testID="food-product-amount"
      />
      {slotChoice}
    </View>
  );

  const createOwn = (prefill: UserProductPrefill) =>
    setPhase({ kind: 'create', id: newId(), prefill, back: phase });

  const codeForm = (
    <Card>
      <Body muted>{t.foodProduct.openHint}</Body>
      <TextField
        label={t.foodProduct.codeLabel}
        hint={t.foodProduct.codeHint}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={20}
        onSubmitEditing={() => void lookup(code, { skipOwn: false })}
        testID="food-product-code"
      />
      {canScan ? (
        <Button
          label={t.foodProduct.scan.button}
          variant="secondary"
          disabled={busy || phase.kind === 'searching'}
          onPress={() => {
            setMessage(null);
            setScanProblem(null);
            setPhase({ kind: 'scanning' });
          }}
          testID="food-product-scan"
        />
      ) : null}
      {scanProblem !== null ? (
        <Notice tone="info" testID={`food-product-scan-${scanProblem}`}>
          {scanProblem === 'denied' ? (
            <>
              <Body>{t.foodProduct.scan.denied}</Body>
              <Body muted>{CAMERA_SETTINGS_HELP}</Body>
              {openCameraSettings !== null ? (
                <Button
                  label={t.foodProduct.scan.openSettings}
                  variant="link"
                  onPress={openCameraSettings}
                  testID="food-product-scan-settings"
                />
              ) : null}
            </>
          ) : (
            <Body>{t.foodProduct.scan[scanProblem]}</Body>
          )}
        </Notice>
      ) : null}
      <Button
        label={t.foodProduct.search}
        loading={phase.kind === 'searching'}
        disabled={busy || code.trim() === ''}
        onPress={() => void lookup(code, { skipOwn: false })}
        testID="food-product-search"
      />
      {app.backend.mode === 'local' ? (
        <View style={{ gap: 4 }} testID="food-product-testcodes">
          <Body muted>{t.foodProduct.testCodesTitle}</Body>
          {MOCK_PRODUCT_CASES.map((c) => (
            <Button
              key={c.key}
              label={`${c.label}: ${c.code}`}
              variant="link"
              onPress={() => setCode(c.code)}
              testID={`food-product-testcode-${c.key}`}
            />
          ))}
          <Button
            label={
              showTestBarcodes ? t.foodProduct.testBarcodesHide : t.foodProduct.testBarcodesShow
            }
            variant="secondary"
            expanded={showTestBarcodes}
            onPress={() => setShowTestBarcodes((v) => !v)}
            testID="food-product-testbarcodes-toggle"
          />
          {showTestBarcodes ? (
            <View style={{ gap: 12 }} testID="food-product-testbarcodes">
              <Body muted>{t.foodProduct.testBarcodesHint}</Body>
              {MOCK_PRODUCT_CASES.map((c) => (
                <View key={c.key} style={{ gap: 2 }}>
                  <Body>{`${c.label}: ${c.code}`}</Body>
                  <TestBarcode
                    code={c.code}
                    label={`${t.foodProduct.testBarcodeLabel} ${c.label}`}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );

  // --- Kamera ------------------------------------------------------------------------------------------------
  if (phase.kind === 'scanning') {
    return shell(
      <>
        <BarcodeScanner onResult={onScanResult} />
        <Button
          label={t.foodProduct.scan.cancel}
          variant="secondary"
          onPress={() => setPhase({ kind: 'idle' })}
          testID="food-product-scan-cancel"
        />
      </>,
    );
  }

  // --- Eigenes Produkt anlegen/ändern -------------------------------------------------------------------
  if (phase.kind === 'create') {
    return shell(
      <>
        <Heading level={2}>
          {userProducts.some((p) => p.id === phase.id)
            ? t.foodProduct.ownEditTitle
            : t.foodProduct.ownCreateTitle}
        </Heading>
        {!showNumbers ? (
          <Notice tone="info" testID="user-product-numbers-off">
            {t.foodProduct.ownNumbersOff}
          </Notice>
        ) : (
          <UserFoodProductForm
            id={phase.id}
            initial={phase.prefill}
            busy={busy}
            onCancel={() => setPhase(phase.back)}
            onSave={(product: UserFoodProduct) => {
              setBusy(true);
              setMessage(null);
              app
                .saveUserFoodProduct(product)
                .then(() => {
                  setMessage({ text: t.foodProduct.ownSaved, tone: 'success' });
                  setAmount(formatDecimal(product.serving_g ?? 100));
                  setPhase({ kind: 'own', id: product.id });
                })
                .catch((error: unknown) => setMessage({ text: errorText(error), tone: 'danger' }))
                .finally(() => setBusy(false));
            }}
          />
        )}
        {message ? (
          <Notice tone={message.tone} testID="food-product-message">
            {message.text}
          </Notice>
        ) : null}
        {!showNumbers ? (
          <Button
            label={t.foodProduct.cancel}
            variant="secondary"
            onPress={() => setPhase(phase.back)}
          />
        ) : null}
      </>,
    );
  }

  // --- Eigenes Produkt (zuerst, ohne Abfrage) -----------------------------------------------------------
  if (phase.kind === 'own') {
    const own = userProducts.find((p) => p.id === phase.id) ?? null;
    if (own === null) {
      return shell(
        <>
          {codeForm}
          <Notice tone="info">{t.foodLog.notFound}</Notice>
        </>,
      );
    }
    return shell(
      <>
        {codeForm}
        <Body muted>{t.foodProduct.ownFound}</Body>
        <Card>
          <Heading level={2}>{own.name_de}</Heading>
          {own.brand_de !== null ? <Body>{own.brand_de}</Body> : null}
          <Body muted>{t.foodProduct.ownPrivacy}</Body>
          {showNumbers ? (
            <View style={{ gap: 2 }} testID="user-product-nutrients">
              <Body>{t.foodProduct.per100(own.base_unit)}</Body>
              {PER100_ROWS.filter((k) => k !== 'sat_fat_g' && k !== 'fiber_g').map((key) => (
                <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body muted>{t.foodProduct.nutrients[key]}</Body>
                  <Body>
                    {per100Text(
                      key,
                      key === 'kcal'
                        ? own.kcal
                        : (own[key as 'protein_g' | 'carbs_g' | 'fat_g' | 'sugar_g' | 'salt_g'] ??
                            null),
                    )}
                  </Body>
                </View>
              ))}
            </View>
          ) : (
            <Body muted>{t.foodProduct.numbersHidden}</Body>
          )}
        </Card>
        {amountForm(own.base_unit, { serving_g: own.serving_g, package_g: null })}
        <Button
          label={t.foodProduct.add}
          loading={busy}
          onPress={() => {
            const value = parsedAmount();
            if (value !== null) submit(entryFromUserProduct(own, value, target()));
          }}
          testID="food-product-add"
        />
        {feedback}
        {showNumbers ? (
          <Button
            label={t.foodProduct.ownEdit}
            variant="secondary"
            onPress={() =>
              setPhase({
                kind: 'create',
                id: own.id,
                prefill: userFoodProductFromRow(own),
                back: phase,
              })
            }
            testID="user-product-edit"
          />
        ) : null}
        {own.code !== null ? (
          <Button
            label={t.foodProduct.lookUpAnyway}
            variant="secondary"
            onPress={() => void lookup(own.code ?? '', { skipOwn: true })}
            testID="food-product-lookup-anyway"
          />
        ) : null}
      </>,
    );
  }

  // --- Abfrage läuft / Eingabe ---------------------------------------------------------------------------
  if (phase.kind === 'idle' || phase.kind === 'searching') {
    return shell(
      <>
        {codeForm}
        {phase.kind === 'searching' ? <LoadingState label={t.foodProduct.searching} /> : null}
        {message ? (
          <Notice tone={message.tone} testID="food-product-message">
            {message.text}
          </Notice>
        ) : null}
        {!online ? (
          <Notice tone="info" testID="food-product-offline">
            {t.foodProduct.offline}
          </Notice>
        ) : null}
      </>,
    );
  }

  // --- Ergebnis --------------------------------------------------------------------------------------------
  const response = phase.response;
  const checkedCode = normalizeBarcode(code);
  const plainCode = checkedCode.ok ? checkedCode.code : null;
  const ownActions = (prefill: UserProductPrefill) => (
    <>
      <Button
        label={t.foodProduct.createOwn}
        onPress={() => createOwn(prefill)}
        testID="food-product-create-own"
      />
      <Button
        label={t.foodProduct.quickInstead}
        variant="secondary"
        onPress={back}
        testID="food-product-quick"
      />
    </>
  );
  const state = (text: string, tone: Message['tone'], extra?: ReactNode) =>
    shell(
      <>
        {codeForm}
        <Notice tone={tone} testID="food-product-state">
          {text}
        </Notice>
        {extra}
      </>,
    );
  switch (response.code) {
    case 'invalid_code':
      return state(t.foodProduct.invalidCode, 'warning');
    case 'not_food_code':
      return state(t.foodProduct.notFoodCode, 'info');
    case 'not_found':
      return state(t.foodProduct.notFound, 'info', ownActions({ code: plainCode }));
    case 'rate_limited':
      return state(
        response.scope === 'day' ? t.foodProduct.rateLimitedDay : t.foodProduct.rateLimitedHour,
        'info',
        ownActions({ code: plainCode }),
      );
    case 'unavailable':
      return state(t.foodProduct.unavailable, 'info', ownActions({ code: plainCode }));
    case 'not_configured':
      return state(t.foodProduct.notConfigured, 'info', ownActions({ code: plainCode }));
    case 'no_consent':
      return state(t.foodProduct.noConsent, 'info');
    case 'found':
      break;
    default:
      return state(t.foodProduct.failed, 'warning');
  }

  const { product, check } = response;
  const prefill: UserProductPrefill = {
    name_de: [...product.name_de].slice(0, 60).join('').trim(),
    brand_de: product.brand_de,
    code: product.code,
    base_unit: product.base_unit,
    serving_g: product.serving_g,
    based_on_off: true,
    ...(check.level === 'blocked'
      ? {}
      : {
          kcal: product.per100.kcal ?? undefined,
          protein_g: product.per100.protein_g ?? undefined,
          carbs_g: product.per100.carbs_g ?? undefined,
          fat_g: product.per100.fat_g ?? undefined,
          sugar_g: product.per100.sugar_g,
          salt_g: product.per100.salt_g,
        }),
  };
  return shell(
    <>
      {codeForm}
      <ProductCard
        found={response}
        showNumbers={showNumbers}
        now={new Date().toISOString()}
        reviewConfirmed={reviewConfirmed}
        onReviewConfirmed={setReviewConfirmed}
      />
      {check.level === 'blocked' ? (
        ownActions(prefill)
      ) : (
        <>
          {amountForm(product.base_unit, product)}
          <Button
            label={t.foodProduct.add}
            loading={busy}
            disabled={check.level === 'review' && !reviewConfirmed}
            onPress={() => {
              if (check.level === 'review' && !reviewConfirmed) {
                setMessage({ text: t.foodProduct.reviewNeeded, tone: 'warning' });
                return;
              }
              const value = parsedAmount();
              if (value === null) return;
              submit(
                entryFromProduct(
                  {
                    code: product.code,
                    name_de: product.name_de,
                    brand_de: product.brand_de,
                    base_unit: product.base_unit,
                    check_level: check.level,
                    kcal: product.per100.kcal,
                    protein_g: product.per100.protein_g,
                    carbs_g: product.per100.carbs_g,
                    fat_g: product.per100.fat_g,
                  },
                  value,
                  target(),
                ),
              );
            }}
            testID="food-product-add"
          />
          {feedback}
          {showNumbers ? (
            <Button
              label={t.foodProduct.editValues}
              variant="secondary"
              onPress={() => createOwn(prefill)}
              testID="food-product-edit-values"
            />
          ) : null}
        </>
      )}
    </>,
  );
}
