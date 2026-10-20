import {
  isoDateSchema,
  mealPlanWeekEditable,
  retailIntegrationAvailable,
  type ShoppingListShareOptions,
  shoppingListShareNotice,
  shoppingListShareNoticeKey,
  shoppingListToText,
  startOfIsoWeek,
} from '@fitnessapp/core';
import { fontSize, radius, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConsentBlockedNotice, DemoBanner } from '@/components/nutrition';
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
} from '@/components/ui';
import { t } from '@/i18n';
import { COPY_AVAILABLE, copyText, type ShareOutcome, shareText } from '@/lib/share-text';
import { useThemeColors } from '@/lib/theme';
import { useToday } from '@/lib/use-today';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { useNutritionWeek } from '@/state/use-nutrition';
import { Text } from '@/components/text';

type Action = 'share' | 'copy';

const DEFAULT_OPTIONS: ShoppingListShareOptions = {
  includeChecked: false,
  includePantry: true,
  includeManual: true,
};

/**
 * Einkaufsliste weitergeben (docs/PLAN-PHASE-5.md 19.7 N12, KONZEPT 6.13, gratis): privates Weitergeben durch die
 * Person selbst über den System-Teilen-Dialog (nativ `Share`, Web `navigator.share`) bzw. „Text kopieren“ (Web) –
 * kein öffentliches Teilen, nichts geht an einen Server. Text, Auswahl und Hinweis kommen fertig aus packages/core
 * (`shoppingListToText`, `shoppingListShareNotice`); hier wird nur angezeigt. Vor JEDEM Weitergeben mit
 * Gesundheitsbezug oder Ersatzprodukten/Austausch erscheint der Hinweis (wie K4), bis er für genau diesen Stand
 * bestätigt ist. Händler-Knopf nur mit Feature-Flag (aus = kein Knopf). Laufende und nächste Woche (`?woche=`).
 */
export default function ShoppingListShareScreen() {
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const params = useLocalSearchParams<{ woche?: string }>();
  const today = useToday();
  const currentWeek = startOfIsoWeek(today);
  const requested = isoDateSchema.safeParse(params.woche).success
    ? startOfIsoWeek(params.woche as string)
    : currentWeek;
  const weekStart = mealPlanWeekEditable(requested, today) ? requested : currentWeek;
  const view = useNutritionWeek(weekStart);
  const [options, setOptions] = useState<ShoppingListShareOptions>(DEFAULT_OPTIONS);
  const [pending, setPending] = useState<{ action: Action; key: string | null } | null>(null);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'success' | 'danger'; text: string }>();

  const texts = t.nutrition.share;
  const week = view.week?.kind === 'ready' ? view.week : null;
  const list = week?.shopping?.list ?? null;
  const shareResult = useMemo(
    () => (list === null ? null : shoppingListToText(list, options)),
    [list, options],
  );
  const notice = useMemo(
    () => (list === null ? null : shoppingListShareNotice(list, options)),
    [list, options],
  );
  // Bestätigt gilt nur für genau diesen Stand: Woche, Zeitraum, Gesundheitsbezug, Ersatz-Einträge, Text (S3).
  const noticeKey = useMemo(
    () => (list === null ? null : `${weekStart}|${shoppingListShareNoticeKey(list, options)}`),
    [list, options, weekStart],
  );
  // Wird der Hinweis während des offenen Dialogs unnötig oder ändert sich der Stand (z. B. Wochenwechsel), wird die
  // offene Anfrage verworfen – sie öffnet sich später nie ohne neuen Tipp (S3). Zustand während des Renderns
  // anpassen (React-Muster „Zustand aus Props ableiten“), kein Effekt.
  const noticeRequired = notice?.required === true;
  if (pending !== null && (!noticeRequired || pending.key !== noticeKey)) setPending(null);
  // Händler-Knopf nur mit Flag UND allen K5-Bedingungen – heute ist keine erfüllt (Flag aus = kein Knopf).
  const retailVisible = retailIntegrationAvailable({
    transferConsent: false,
    dpiaUpdated: false,
    officialInterface: false,
  });

  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace(`/einkaufsliste?woche=${weekStart}` as Href);

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

  const footer = <Button label={t.nutrition.back} variant="secondary" onPress={back} />;
  const shell = (children: ReactNode) => (
    <Screen
      area="einkaufen"
      icon="cart"
      title={texts.title}
      intro={texts.intro}
      testID="share-screen"
      footer={footer}
    >
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
  if (view.library.kind !== 'ready' || week === null) {
    return shell(<LoadingState label={t.nutrition.loading} />);
  }
  if (week.plan === null || shareResult === null || notice === null) {
    return shell(
      <Card>
        <Body testID="share-no-plan">{t.nutrition.shopping.noPlan}</Body>
      </Card>,
    );
  }

  async function run(action: Action) {
    if (!shareResult?.ok) return;
    setBusy(action);
    setMessage(undefined);
    try {
      const outcome: ShareOutcome =
        action === 'share'
          ? await shareText(shareResult.text, t.nutrition.shopping.title)
          : await copyText(shareResult.text);
      const tone = outcome === 'shared' || outcome === 'copied' ? 'success' : 'info';
      setMessage({ tone, text: texts[outcome] });
    } catch {
      // Keine Details ins Log (der Text ist die Einkaufsliste der Person).
      setMessage({ tone: 'danger', text: texts.failed });
    } finally {
      setBusy(null);
    }
  }

  function request(action: Action) {
    if (notice?.required === true && acknowledged !== noticeKey) {
      setPending({ action, key: noticeKey });
      return;
    }
    void run(action);
  }

  if (pending !== null && notice.required && pending.key === noticeKey) {
    const notes = [
      ...(notice.substituteLabels.length > 0
        ? [texts.noticeSubstitutes, texts.noticeItems(notice.substituteLabels.join(', '))]
        : []),
    ];
    return shell(
      <ConfirmDialog
        visible
        title={texts.noticeTitle}
        message={notice.usesHealthData ? texts.noticeHealth : texts.noticeSubstitutes}
        notes={notice.usesHealthData ? notes : notes.slice(1)}
        confirmLabel={texts.noticeConfirm}
        confirmVariant="primary"
        testID="share-notice"
        onConfirm={() => {
          const { action } = pending;
          setAcknowledged(noticeKey);
          setPending(null);
          void run(action);
        }}
        onCancel={() => {
          setPending(null);
          setMessage({ tone: 'info', text: texts.cancelled });
        }}
      />,
    );
  }

  const option = (key: keyof ShoppingListShareOptions, label: string) => (
    <Checkbox
      label={label}
      checked={options[key]}
      onChange={(value) => {
        setMessage(undefined);
        setOptions((o) => ({ ...o, [key]: value }));
      }}
      testID={`share-option-${key}`}
    />
  );

  return shell(
    <>
      {view.library.result.demo ? <DemoBanner /> : null}
      <Body muted testID="share-content-note">
        {texts.contentNote}
      </Body>
      <Card>
        <Heading level={2}>{texts.optionsTitle}</Heading>
        {option('includeChecked', texts.includeChecked)}
        {option('includePantry', texts.includePantry)}
        {option('includeManual', texts.includeManual)}
      </Card>

      {message ? (
        <Notice tone={message.tone} testID="share-message">
          {message.text}
        </Notice>
      ) : null}

      {!shareResult.ok ? (
        <Notice tone={shareResult.reason === 'invalid' ? 'danger' : 'info'} testID="share-empty">
          {shareResult.reason === 'empty'
            ? texts.empty
            : shareResult.reason === 'invalid'
              ? texts.invalid
              : texts.nothingSelected}
        </Notice>
      ) : (
        <>
          {shareResult.omittedForLength > 0 ? (
            <Notice tone="warning" testID="share-truncated">
              {texts.truncated(shareResult.omittedForLength)}
            </Notice>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={texts.shareButton}
              accessibilityHint={texts.shareHint}
              loading={busy === 'share'}
              disabled={busy !== null}
              onPress={() => request('share')}
              testID="share-button"
            />
            {COPY_AVAILABLE ? (
              <Button
                label={texts.copyButton}
                variant="secondary"
                loading={busy === 'copy'}
                disabled={busy !== null}
                onPress={() => request('copy')}
                testID="share-copy"
              />
            ) : null}
            {retailVisible ? (
              <Button
                label={texts.retailButton}
                variant="secondary"
                disabled
                onPress={() => undefined}
                testID="share-retail"
              />
            ) : null}
          </View>
          <Heading level={2}>{texts.previewTitle}</Heading>
          <View
            style={[
              styles.preview,
              { borderColor: theme.cardBorder, backgroundColor: theme.surface },
            ]}
          >
            <Text
              selectable
              accessibilityLabel={texts.previewA11y}
              style={[styles.previewText, { color: theme.text }]}
              testID="share-preview"
            >
              {shareResult.text}
            </Text>
          </View>
        </>
      )}

      <Button
        label={texts.pdfButton}
        variant="secondary"
        onPress={() => router.push(`/einkaufsliste/drucken?woche=${weekStart}` as Href)}
        testID="share-pdf"
      />
    </>,
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  preview: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  previewText: { fontSize: fontSize.md, lineHeight: fontSize.md * 1.4 },
});
