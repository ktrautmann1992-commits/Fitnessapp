import { monthOf, monthSchema } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PrintPreview } from '@/components/print-preview';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Checkbox, Heading, LoadingState, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { PRINT_TARGET, printHtml } from '@/lib/print-output';
import { buildMonthReviewPrint } from '@/lib/print-month-review';
import { decodeRouteParam } from '@/lib/route-param';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useMonthReview } from '@/state/use-month-review';

/**
 * Monatsrückblick als PDF (docs/PLAN-TREND-RUECKBLICK-KALENDER.md 3.4, docs/PLAN-PDF-EXPORT.md §3/§4): gleicher Weg wie
 * der Trainingsplan – Browser: Druckansicht + „Drucken / als PDF sichern“, iPhone/Android: System-Druckdialog
 * (expo-print). Kein Teilen-Menü, kein Upload, nichts gespeichert. Essen und Gewicht nur nach eigenem Schalter
 * (Standard aus) und Bestätigung.
 */
export default function MonthReviewPrintScreen() {
  const params = useLocalSearchParams<{ monat?: string }>();
  const router = useRouter();
  const app = useApp();
  const today = useToday();
  const raw = params.monat === undefined ? null : decodeRouteParam(params.monat);
  const parsed = raw === null ? null : monthSchema.safeParse(raw);
  const month = parsed?.success ? parsed.data : monthOf(today);
  const state = useMonthReview(month);
  const [includeHealth, setIncludeHealth] = useState(false);
  const [confirmHealth, setConfirmHealth] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string }>();
  const texts = t.monthReview;

  const result = useMemo(
    () =>
      state.kind === 'ready'
        ? buildMonthReviewPrint({
            review: state.review,
            today,
            includeHealthData: includeHealth,
          })
        : null,
    [state, today, includeHealth],
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
  if (route !== HOME_ROUTE || !app.rows) return <Redirect href={route as Href} />;

  const back = () =>
    router.canGoBack() ? router.back() : router.replace(`/monatsrueckblick?monat=${month}` as Href);
  const footer = <Button label={t.printView.back} variant="secondary" onPress={back} />;
  const hasHealth =
    state.kind === 'ready' && (state.review.food.kind === 'counts' || state.weight === 'visible');

  async function print() {
    if (!result?.ok) return;
    setPrinting(true);
    setMessage(undefined);
    try {
      const outcome = await printHtml(result.html);
      if (outcome === 'cancelled') setMessage({ tone: 'info', text: t.printView.cancelled });
    } catch {
      // Keine Details ins Log (Gesundheitsbezug möglich).
      setMessage({ tone: 'danger', text: t.printView.failed });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Screen
      area="fortschritt"
      icon="download"
      title={texts.print.title}
      intro={texts.print.intro}
      testID="month-review-print"
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label={t.printView.printButton}
            onPress={() => void print()}
            loading={printing}
            disabled={!result?.ok}
            accessibilityHint={
              PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative
            }
            testID="print-button"
          />
          {footer}
        </View>
      }
    >
      {state.kind === 'loading' ? <LoadingState label={texts.loading} /> : null}
      {state.kind === 'error' ? <Notice tone="danger">{texts.computeFailed}</Notice> : null}
      {hasHealth ? (
        <Card>
          <Checkbox
            label={texts.print.includeHealth}
            checked={includeHealth}
            onChange={(next) => (next ? setConfirmHealth(true) : setIncludeHealth(false))}
            testID="month-review-print-health"
          />
          <Body muted>{texts.print.includeHealthHint}</Body>
        </Card>
      ) : null}
      {result && !result.ok ? (
        <Notice tone="danger" testID="print-error">
          {result.error === 'future' ? texts.print.future : t.printView.failed}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone={message.tone} testID="print-message">
          {message.text}
        </Notice>
      ) : null}
      <Body muted>
        {PRINT_TARGET === 'web' ? t.printView.printHintWeb : t.printView.printHintNative}
      </Body>
      {result?.ok && PRINT_TARGET === 'web' ? (
        <>
          <Heading level={2}>{t.printView.previewTitle}</Heading>
          <PrintPreview html={result.html} title={result.title} largePrint={false} />
        </>
      ) : null}
      <ConfirmDialog
        visible={confirmHealth}
        title={texts.print.healthTitle}
        message={texts.print.healthText}
        confirmLabel={texts.print.healthConfirm}
        confirmVariant="primary"
        onConfirm={() => {
          setConfirmHealth(false);
          setIncludeHealth(true);
        }}
        onCancel={() => setConfirmHealth(false)}
      />
    </Screen>
  );
}
