import { isoDateSchema, mealPlanWeekEditable, startOfIsoWeek } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { ConsentBlockedNotice } from '@/components/nutrition';
import { PrintPreview } from '@/components/print-preview';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { t } from '@/i18n';
import { PRINT_TARGET, printHtml } from '@/lib/print-output';
import {
  buildNutritionPrint,
  DEFAULT_NUTRITION_PRINT_FORM,
  type NutritionPrintForm,
  type NutritionPrintKind,
  nutritionPrintErrorText,
  nutritionPrintUsesHealthData,
} from '@/lib/print-nutrition';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';

/** Wartezeit nach dem letzten Tastendruck im Namensfeld, bevor das Dokument neu gebaut wird (wie beim Training). */
const NAME_DEBOUNCE_MS = 300;

/**
 * Druckansicht für Essensplan und Einkaufsliste (docs/PLAN-PHASE-5.md 8.2 Nr. 6, 11, Etappe N6 – PDF P5, gratis):
 * Hinweis-Dialog bei Gesundheitsbezug (erwähnt die Ersatz-Hinweise, K4), beim Essensplan optional der Name
 * (Standard aus), Vorschau (Web) und „Drucken / als PDF sichern“ – im Browser über den Druckdialog, auf
 * iPhone/Android über expo-print. „Kalorienzahlen anzeigen“ und Schwangerschaft gelten wie in der App. Nichts wird
 * gespeichert oder hochgeladen. Laufende und nächste Woche (`?woche=`), sonst die laufende.
 */
export function NutritionPrintView({ kind }: { kind: NutritionPrintKind }) {
  const router = useRouter();
  const app = useApp();
  const params = useLocalSearchParams<{ woche?: string }>();
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : currentWeek;
  const weekStart = mealPlanWeekEditable(requested, today) ? requested : currentWeek;
  const view = useNutritionWeek(weekStart);
  const [form, setForm] = useState<NutritionPrintForm>(DEFAULT_NUTRITION_PRINT_FORM);
  const [debouncedName, setDebouncedName] = useState(DEFAULT_NUTRITION_PRINT_FORM.name);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(form.name), NAME_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.name]);
  const docForm = useMemo(() => ({ ...form, name: debouncedName }), [form, debouncedName]);
  const pending = form.name !== debouncedName;
  const [acknowledged, setAcknowledged] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string }>();

  const texts = t.nutrition.printView;
  const title = kind === 'nutrition_plan' ? texts.titlePlan : texts.titleList;
  const week = view.week?.kind === 'ready' ? view.week : null;
  const libraryResult = view.library.kind === 'ready' ? view.library.result : null;
  const needsHint = week !== null && nutritionPrintUsesHealthData(kind, week) && !acknowledged;

  // Das Dokument entsteht erst NACH dem Hinweis – und nur im Speicher.
  const result = useMemo(
    () =>
      week && libraryResult && !needsHint
        ? buildNutritionPrint({
            kind,
            week,
            library: libraryResult.library,
            showNumbers: view.showNumbers,
            demo: libraryResult.demo,
            today,
            form: docForm,
          })
        : null,
    [docForm, kind, libraryResult, needsHint, today, view.showNumbers, week],
  );

  const ready = result?.ok === true;
  useEffect(() => {
    if (ready) AccessibilityInfo.announceForAccessibility(title);
  }, [ready, title]);

  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(
          (kind === 'nutrition_plan'
            ? `/ernaehrung/woche?woche=${weekStart}`
            : `/einkaufsliste?woche=${weekStart}`) as Href,
        );

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
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }

  const footer = <Button label={texts.back} variant="secondary" onPress={back} />;
  const shell = (children: ReactNode, intro?: string, screenFooter: ReactNode = footer) => (
    <Screen title={title} intro={intro} testID="print-view" footer={screenFooter}>
      {children}
    </Screen>
  );

  if (view.library.kind === 'unsupported') {
    return shell(<Notice tone="info">{t.nutrition.unsupported}</Notice>);
  }
  if (view.library.kind === 'error') {
    return shell(
      <ErrorState
        message={t.nutrition.loadFailed}
        onRetry={() => void app.ensureNutritionLibrary()}
      />,
    );
  }
  if (view.week?.kind === 'blocked') {
    return shell(<ConsentBlockedNotice reason={view.week.reason} />);
  }
  if (view.week?.kind === 'incomplete') {
    return shell(<Notice tone="info">{t.nutrition.incomplete}</Notice>);
  }
  if (view.week?.kind === 'error') {
    return shell(<Notice tone="danger">{t.nutrition.computeFailed}</Notice>);
  }
  if (!week || !libraryResult) {
    return shell(<LoadingState label={t.printView.loading} />);
  }
  if (week.plan === null) {
    return shell(
      <Card>
        <Body testID="print-no-plan">{texts.noPlan}</Body>
      </Card>,
    );
  }

  if (needsHint) {
    return shell(
      <ConfirmDialog
        visible
        title={t.printView.healthTitle}
        message={kind === 'nutrition_plan' ? texts.healthText : texts.healthTextList}
        confirmLabel={t.printView.healthConfirm}
        confirmVariant="primary"
        onConfirm={() => setAcknowledged(true)}
        onCancel={back}
      />,
    );
  }

  if (!result) {
    return shell(<LoadingState label={t.printView.loading} />);
  }

  async function print() {
    if (!result?.ok) return;
    setPrinting(true);
    setMessage(undefined);
    try {
      const outcome = await printHtml(result.html);
      if (outcome === 'cancelled') setMessage({ tone: 'info', text: t.printView.cancelled });
    } catch {
      // Keine Details ins Log (Plan-Inhalte können Gesundheitsbezug haben).
      setMessage({ tone: 'danger', text: t.printView.failed });
    } finally {
      setPrinting(false);
    }
  }

  const nameError = !result.ok && result.error === 'invalid_options' ? result.nameError : null;
  const blockingError = !result.ok && nameError === null ? nutritionPrintErrorText(result) : null;
  const hint = PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative;

  const printFooter = (
    <View style={{ gap: 8 }}>
      <Button
        label={t.printView.printButton}
        onPress={() => void print()}
        loading={printing}
        disabled={!result.ok || pending}
        accessibilityHint={hint}
        testID="print-button"
      />
      {footer}
    </View>
  );

  return shell(
    <>
      {kind === 'nutrition_plan' ? (
        <Card>
          <Heading level={2}>{t.printView.optionsTitle}</Heading>
          <Checkbox
            label={t.printView.includeName}
            checked={form.includeName}
            onChange={(includeName) => setForm((f) => ({ ...f, includeName }))}
          />
          {form.includeName ? (
            <TextField
              label={t.printView.nameLabel}
              hint={t.printView.nameHint}
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              autoComplete="off"
              error={nameError ?? undefined}
              testID="print-name"
            />
          ) : null}
          <Body muted testID="print-numbers">
            {view.showNumbers ? texts.numbersOn : texts.numbersOff}
          </Body>
        </Card>
      ) : null}

      {blockingError ? (
        <Notice tone="danger" testID="print-error">
          {blockingError}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="print-message">
          {message.text}
        </Notice>
      ) : null}

      <View style={{ gap: 8 }}>
        <Body muted>{hint}</Body>
        {printing ? <LoadingState label={t.printView.printing} /> : null}
      </View>

      {result.ok && PRINT_TARGET === 'web' ? (
        <>
          <Heading level={2}>{t.printView.previewTitle}</Heading>
          <PrintPreview
            html={result.html}
            title={result.title}
            label={kind === 'nutrition_plan' ? texts.previewPlan : texts.previewList}
          />
        </>
      ) : null}
    </>,
    kind === 'nutrition_plan' ? texts.introPlan : texts.introList,
    printFooter,
  );
}
