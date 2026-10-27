import {
  preTrainingReminderMinutes,
  type TimelineEntry,
  type TimelineExtra,
  type TrainingDayTimeline,
  type TrainingMealSuggestion,
} from '@fitnessapp/core';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Checkbox, Heading, Notice } from '@/components/ui';
import { t } from '@/i18n';
import { appNotifications } from '@/lib/app-notifications';
import { setTrainingMealReminder, useTrainingMealPrefs } from '@/lib/training-meal-prefs';
import type { TrainingAdjustmentEntry } from '@/lib/training-meal-adjustment';
import {
  adjustmentLines,
  entryA11y,
  entryWindow,
  extraLine,
  fuelingLines,
  mealLine,
  sessionLine,
  valuesLine,
} from '@/lib/training-timeline-format';

/**
 * Zeitplan „Essen rund ums Training“ (Nährstoff-Timing 2, docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitt 7): je Zeitfenster
 * ein echtes Gericht mit Portion (Werte klein darunter, nur mit Gramm), optionaler Snack bzw. Beilage aus dem Bestand
 * („Auf die Einkaufsliste“), Richtwert unterwegs ab 90 min und „Warum?“ zum Aufklappen. Rechnet nichts – alles kommt aus
 * packages/core (`trainingDayTimeline`). Erinnerung (lokal, Standard aus) nur am heutigen Tag.
 */
const T = t.trainingMeals;

export function TrainingTimelineCard({
  timeline,
  isToday,
  onAddExtra,
}: {
  timeline: TrainingDayTimeline;
  isToday: boolean;
  /** „Auf die Einkaufsliste“ (null = keine Einkaufsliste, z. B. Woche nicht änderbar). */
  onAddExtra: ((extra: TimelineExtra) => Promise<boolean>) | null;
}) {
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const reminderAt = isToday ? preTrainingReminderMinutes(timeline) : null;
  return (
    <Card>
      <View style={styles.gap} testID="training-timeline" accessibilityLabel={T.titleA11y}>
        <Heading level={2}>{T.title}</Heading>
        {timeline.approx ? (
          <Body muted testID="training-timeline-approx">
            {T.approxNote}
          </Body>
        ) : null}
        {timeline.entries.map((entry) => (
          <TimelineRow
            key={entry.key}
            entry={entry}
            onAddExtra={
              onAddExtra === null
                ? null
                : async (extra) => {
                    const ok = await onAddExtra(extra);
                    setMessage(
                      ok
                        ? { text: T.addedToShopping(extra.titleDe), tone: 'success' }
                        : { text: T.addFailed, tone: 'danger' },
                    );
                  }
            }
          />
        ))}
        {message ? (
          <Notice tone={message.tone} testID="training-timeline-message">
            {message.text}
          </Notice>
        ) : null}
        {reminderAt !== null ? <ReminderToggle atMinutes={reminderAt} /> : null}
      </View>
    </Card>
  );
}

function TimelineRow({
  entry,
  onAddExtra,
}: {
  entry: TimelineEntry;
  onAddExtra: ((extra: TimelineExtra) => Promise<void>) | null;
}) {
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = entry.meal !== null ? T.status(entry.meal.status) : '';
  const values = valuesLine(entry.meal);
  const extra = extraLine(entry);
  const extraValues = valuesLine(entry.extra);
  const session = sessionLine(entry);
  const fueling = fuelingLines(entry);
  const title = T.kindTitle(entry.kind);
  return (
    <View style={styles.row} testID={`training-timeline-${entry.kind}`}>
      <View accessible accessibilityLabel={entryA11y(entry)} style={styles.gapSmall}>
        <Body muted testID={`training-timeline-${entry.kind}-time`}>
          {entryWindow(entry)}
        </Body>
        <Body>{session === null ? title : `${title} (${session})`}</Body>
        {entry.meal !== null ? (
          <Body testID={`training-timeline-${entry.kind}-meal`}>{mealLine(entry.meal)}</Body>
        ) : entry.kind === 'post_meal' ? (
          <Body muted>{T.noMeal}</Body>
        ) : null}
        {values !== null ? <Body muted>{values}</Body> : null}
        {status !== '' ? (
          <Body muted testID={`training-timeline-${entry.kind}-status`}>
            {status}
          </Body>
        ) : null}
        {extra !== null ? (
          <Body testID={`training-timeline-${entry.kind}-extra`}>
            {extraValues !== null ? `${extra} · ${extraValues}` : extra}
          </Body>
        ) : null}
        {fueling.map((line) => (
          <Body key={line} muted>
            {line}
          </Body>
        ))}
      </View>
      {entry.extra !== null && onAddExtra !== null ? (
        <Button
          label={T.addToShopping}
          accessibilityLabel={T.addToShoppingA11y(entry.extra.titleDe)}
          variant="link"
          loading={busy}
          onPress={() => {
            if (entry.extra === null) return;
            setBusy(true);
            void onAddExtra(entry.extra).finally(() => setBusy(false));
          }}
          testID={`training-timeline-${entry.kind}-shopping`}
        />
      ) : null}
      <Button
        label={T.whyLabel}
        accessibilityLabel={T.whyA11y(title)}
        variant="link"
        expanded={why}
        onPress={() => setWhy((v) => !v)}
        testID={`training-timeline-${entry.kind}-why`}
      />
      {why ? (
        <Body muted testID={`training-timeline-${entry.kind}-reason`}>
          {T.reason(entry.reason)}
        </Body>
      ) : null}
    </View>
  );
}

/**
 * „Erinnerung vor dem Training“ (Entscheidung 8): Standard aus, nur dieses Gerät. Fester Text ohne Werte; im Browser
 * gibt es keine Benachrichtigungen (Hinweis statt Schalter-Wirkung).
 */
function ReminderToggle({ atMinutes }: { atMinutes: number }) {
  const prefs = useTrainingMealPrefs();
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!appNotifications.supported || !prefs.loaded) return;
    const now = new Date();
    const at = new Date(now);
    at.setHours(Math.floor(atMinutes / 60), atMinutes % 60, 0, 0);
    const atMs = prefs.reminder && at.getTime() > now.getTime() ? at.getTime() : null;
    void appNotifications.syncTrainingMeal(atMs).catch(() => undefined);
  }, [atMinutes, prefs.loaded, prefs.reminder]);
  return (
    <View style={styles.gapSmall} testID="training-timeline-reminder">
      <Checkbox
        label={T.reminder.label}
        checked={prefs.reminder}
        onChange={(checked) => {
          setTrainingMealReminder(checked);
          if (checked && appNotifications.supported) {
            void appNotifications
              .allowTrainingMeal()
              .then((p) => setDenied(p === 'denied'))
              .catch(() => setDenied(true));
          }
        }}
        testID="training-timeline-reminder-toggle"
      />
      <Body muted>
        {!appNotifications.supported
          ? T.reminder.unsupported
          : denied
            ? T.reminder.denied
            : T.reminder.hint}
      </Body>
    </View>
  );
}

/** Rückmeldung nach dem Verschieben: „Mahlzeiten an dein Training angepasst · Rückgängig“ (+ Vorschläge). */
export function TrainingAdjustmentNotice({
  entry,
  onUndo,
  onDismiss,
  onSwapSuggestion,
}: {
  entry: TrainingAdjustmentEntry;
  onUndo: () => Promise<void>;
  onDismiss: () => void;
  onSwapSuggestion: (suggestion: TrainingMealSuggestion) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const lines = adjustmentLines(entry.adaptation, entry.shopping);
  const run = (key: string, action: () => Promise<void>) => {
    setBusy(key);
    void action().finally(() => setBusy(null));
  };
  return (
    <Notice tone="success" testID="training-adjusted">
      <View style={styles.gapSmall}>
        {lines.map((line) => (
          <Body key={line}>{line}</Body>
        ))}
        {entry.adaptation.suggestions.map((s) => (
          <View key={`${s.date}-${s.slot}`} style={styles.gapSmall}>
            <Body testID="training-adjusted-suggestion">
              {T.adjusted.suggestion(s.role, s.betterTitleDe)}
            </Body>
            <Button
              label={T.adjusted.suggestionSwap}
              accessibilityLabel={T.adjusted.suggestionSwapA11y(s.betterTitleDe)}
              variant="secondary"
              loading={busy === `${s.date}-${s.slot}`}
              disabled={busy !== null}
              onPress={() => run(`${s.date}-${s.slot}`, () => onSwapSuggestion(s))}
              testID="training-adjusted-suggestion-swap"
            />
          </View>
        ))}
        <View style={styles.actions}>
          <Button
            label={T.adjusted.undo}
            accessibilityLabel={T.adjusted.undoA11y}
            variant="secondary"
            loading={busy === 'undo'}
            disabled={busy !== null}
            onPress={() => run('undo', onUndo)}
            testID="training-adjusted-undo"
          />
          <Button
            label={T.adjusted.dismiss}
            variant="link"
            disabled={busy !== null}
            onPress={onDismiss}
            testID="training-adjusted-dismiss"
          />
        </View>
      </View>
    </Notice>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  gapSmall: { gap: 4 },
  row: { gap: 4, paddingTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
