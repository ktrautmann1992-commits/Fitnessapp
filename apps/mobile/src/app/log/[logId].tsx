import {
  cardioSpeed,
  findGlossaryExercise,
  isBackfilledLog,
  isoDateInTimeZone,
  logEditability,
  sessionCaloriesInputForLog,
} from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EBikeBadge } from '@/components/e-bike';
import { ShoeChip } from '@/components/shoes';
import { ConfirmDialog, Screen } from '@/components/screen';
import {
  kcalFor,
  SessionKcalLine,
  useSessionKcalContext,
  useWatchKcal,
} from '@/components/session-kcal';
import { SportLogInfo } from '@/components/sport-week';
import { WearableLogInfo } from '@/components/wearables';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { EMPTY_LOG_ROWS, logRowsOf, mergeLogRows } from '@/data/log-rows';
import { logDetail } from '@/data/log-summary';
import { logStrengthComparisons } from '@/data/strength-progress';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe, todayIso } from '@/lib/format';
import { cardioDurationText, effortText, kmText, setLineText } from '@/lib/history-format';
import { useThemeColors } from '@/lib/theme';
import { strengthComparisonText } from '@/lib/strength-format';
import { cardioSpeedTexts } from '@/lib/workout-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { Text } from '@/components/text';

/**
 * Ein Eintrag aus Woche/Verlauf (docs/PLAN-PHASE-4.md 6.1 Punkt 5, Etappe D): ansehen, ändern (Trainingsmodus im
 * Änderungs-Modus, nur solange save_session_log die neue Fassung annimmt – logEditability() in packages/core) und
 * löschen (delete_session_log mit Revision, nur online, 4.5). Notizen werden nur angezeigt, nie ausgewertet (S3).
 */
export default function LogEntryScreen() {
  const params = useLocalSearchParams<{ logId: string }>();
  const logId = String(params.logId ?? '');
  const router = useRouter();
  const app = useApp();
  const theme = useThemeColors();
  const today = todayIso();
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/history' as Href));
  const { ensureLibrary, library } = app;
  useEffect(() => {
    void ensureLibrary();
  }, [ensureLibrary]);
  const lib = library.kind === 'ready' ? library.library : null;
  const kcalContext = useSessionKcalContext();
  const watchKcal = useWatchKcal();

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
  const rows = app.rows;
  const allLogs = mergeLogRows(logRowsOf(rows), app.olderLogs?.logs ?? EMPTY_LOG_ROWS);
  const detail = logDetail(allLogs, logId);
  // Kraft-Entwicklung (25.10.2026): je Übung „+5 kg gegenüber vor 4 Wochen“ – nur eigene Werte, neutral.
  const comparisons = logStrengthComparisons(allLogs, logId);
  const footer = <Button label={t.logEntry.back} variant="secondary" onPress={goBack} />;

  if (!detail) {
    return (
      <Screen
        area="training"
        icon="dumbbell"
        title={t.logEntry.title}
        testID="log-entry"
        footer={footer}
      >
        {message ? (
          <Notice tone={message.tone} testID="log-message">
            {message.text}
          </Notice>
        ) : (
          <Notice tone="info">{t.logEntry.notFound}</Notice>
        )}
      </Screen>
    );
  }

  const { log } = detail;
  const session = log.planned_session_id
    ? (rows.plannedSessions.find((s) => s.id === log.planned_session_id) ?? null)
    : null;
  const editability = logEditability(log, session, today);
  const waiting =
    log.planned_session_id !== null && app.pendingLogSessionIds.includes(log.planned_session_id);
  const hasDraft = app.drafts.some(
    (d) =>
      d.logId === log.id || (log.planned_session_id !== null && d.key === log.planned_session_id),
  );
  const reference = session ? (session.original_date ?? session.scheduled_on) : null;

  async function remove() {
    setBusy(true);
    setDialogError(undefined);
    try {
      const result = await app.deleteLog(log.id, log.revision);
      setDialog(false);
      setMessage(
        result === 'ok'
          ? { tone: 'success', text: t.logEntry.deleted }
          : { tone: 'warning', text: t.logEntry.deleteConflict },
      );
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const kcal = kcalFor(kcalContext, {
    ...sessionCaloriesInputForLog({ log, cardio: detail.cardio, planned: session }),
    measuredKcal: watchKcal(log.id),
  });

  const speed = detail.cardio
    ? cardioSpeed(detail.cardio.modality, detail.cardio.duration_s, detail.cardio.distance_m)
    : null;

  return (
    <Screen area="training" icon="dumbbell" title={log.name_de} testID="log-entry" footer={footer}>
      {message ? (
        <Notice tone={message.tone} testID="log-message">
          {message.text}
        </Notice>
      ) : null}
      <Card>
        <Body>{t.logEntry.performedOn(formatDateDe(log.performed_on))}</Body>
        {reference !== null && reference !== log.performed_on ? (
          <Body muted>{t.logEntry.caughtUpFrom(formatDateDe(reference))}</Body>
        ) : null}
        {log.is_free === true ? (
          <Body muted testID="log-free">
            {log.source === 'workout' ? t.workouts.logEntry : t.logEntry.free}
          </Body>
        ) : null}
        {isBackfilledLog(log) ? (
          <Body muted testID="log-backfilled">
            {t.logEntry.backfilled(formatDateDe(isoDateInTimeZone(log.created_at)))}
          </Body>
        ) : null}
        <Body testID="log-status">
          {log.status === 'completed' ? t.logEntry.completed : t.logEntry.partial}
        </Body>
        {log.session_rpe !== null ? <Body>{effortText(log.session_rpe)}</Body> : null}
        <SessionKcalLine context={kcalContext} result={kcal} />
        {waiting ? <Body muted>{t.today.pendingUpload}</Body> : null}
      </Card>

      {/* Phase 8: Herkunft Smartwatch, kcal, möglicher Doppel-Eintrag und Puls (nie auf dem Story-Bild). */}
      <WearableLogInfo logId={log.id} />
      {/* Sportarten Stufe 2: Sportart, Dauer, Distanz und Belastung. */}
      <SportLogInfo log={log} />

      {detail.cardio ? (
        <Card>
          <View testID="log-cardio" style={styles.block}>
            <Body>
              {t.logEntry.modality(
                detail.cardio.modality === 'bike' && detail.cardio.e_bike === true
                  ? t.endurance.eBike.sport
                  : t.workout.cardio.modalities[detail.cardio.modality],
              )}
            </Body>
            {detail.cardio.modality === 'bike' && detail.cardio.e_bike === true ? (
              <EBikeBadge testID="log-e-bike" />
            ) : null}
            {/* Schuh-Kilometerzähler (docs/PLAN-PHASE-10.md 22). */}
            <ShoeChip logId={log.id} />
            <Body accessibilityLabel={cardioDurationText(detail.cardio.duration_s).a11y}>
              {cardioDurationText(detail.cardio.duration_s).text}
            </Body>
            {detail.cardio.distance_m !== null && detail.cardio.distance_m > 0 ? (
              <Body accessibilityLabel={t.logEntry.distanceA11y(kmText(detail.cardio.distance_m))}>
                {t.logEntry.distance(kmText(detail.cardio.distance_m))}
              </Body>
            ) : null}
            {detail.cardio.elevation_m !== null && detail.cardio.elevation_m > 0 ? (
              <Body>{t.logEntry.elevation(detail.cardio.elevation_m)}</Body>
            ) : null}
            {speed
              ? cardioSpeedTexts(speed).map((line) => (
                  <Body key={line.text} accessibilityLabel={line.a11y}>
                    {line.text}
                  </Body>
                ))
              : null}
          </View>
        </Card>
      ) : null}

      {detail.exercises.map(({ row, sets }) => (
        <Card key={row.id}>
          <View testID="log-exercise" style={styles.block}>
            <Text style={[styles.exerciseName, { color: theme.text }]}>
              {row.order_no}. {row.exercise_name_de}
            </Text>
            {row.status === 'skipped' ? <Body muted>{t.logEntry.skipped}</Body> : null}
            {row.status === 'alternative' ? <Body muted>{t.logEntry.alternative}</Body> : null}
            {sets.map((set) => {
              const line = setLineText(set, row.load_type);
              return (
                <Body key={set.set_no} accessibilityLabel={line.a11y}>
                  {line.text}
                </Body>
              );
            })}
            {(() => {
              const comparison = comparisons.get(row.id);
              const text = comparison ? strengthComparisonText(comparison) : null;
              return text ? (
                <Body
                  accessibilityLabel={t.strength.logLine(row.exercise_name_de, text.a11y)}
                  testID="log-exercise-compare"
                >
                  {t.strength.logLine(row.exercise_name_de, text.text)}
                </Body>
              ) : null;
            })()}
            {findGlossaryExercise(lib, row.exercise_id) ? (
              <Button
                label={t.glossary.guide}
                variant="link"
                accessibilityLabel={t.glossary.guideA11y(row.exercise_name_de)}
                onPress={() =>
                  router.push(`/uebungen/${encodeURIComponent(row.exercise_id)}` as Href)
                }
                testID="log-exercise-guide"
              />
            ) : null}
            {row.status !== 'skipped' ? (
              <Button
                label={t.logEntry.exerciseHistory}
                variant="link"
                accessibilityLabel={t.logEntry.exerciseHistoryA11y(row.exercise_name_de)}
                onPress={() =>
                  router.push(`/history/${encodeURIComponent(row.exercise_id)}` as Href)
                }
              />
            ) : null}
          </View>
        </Card>
      ))}

      {log.notes ? (
        <Card>
          <Heading level={2}>{t.logEntry.notes}</Heading>
          <Body testID="log-notes">{log.notes}</Body>
        </Card>
      ) : null}

      <View style={styles.actions}>
        {/* Etappe E6: Story-Bild dieser einzelnen Einheit (nur auf Tipp, auf dem Gerät erzeugt). */}
        <Button
          label={t.endurance.story.title}
          variant="secondary"
          onPress={() => router.push(`/teilen?log=${log.id}` as Href)}
          testID="log-share"
        />
        {hasDraft ? (
          <Notice tone="info">{t.logEntry.draftOpen}</Notice>
        ) : editability === 'editable' && session ? (
          <Button
            label={t.logEntry.edit}
            onPress={() => router.push(`/workout/${session.id}?edit=1` as Href)}
            testID="log-edit"
          />
        ) : (
          <Body muted testID="log-edit-hint">
            {log.is_free === true
              ? t.logEntry.editFree
              : editability === 'too_old'
                ? t.logEntry.editTooOld
                : t.logEntry.editUnlinked}
          </Body>
        )}
        {waiting ? (
          <Body muted testID="log-delete-hint">
            {t.logEntry.pendingNoDelete}
          </Body>
        ) : !hasDraft ? (
          <>
            {app.offline ? <Body muted>{t.logEntry.onlineOnly}</Body> : null}
            <Button
              label={t.logEntry.delete}
              variant="danger"
              onPress={() => {
                setDialogError(undefined);
                setDialog(true);
              }}
              testID="log-delete"
            />
          </>
        ) : null}
      </View>

      <ConfirmDialog
        visible={dialog}
        title={t.logEntry.deleteTitle}
        message={t.logEntry.deleteText}
        confirmLabel={t.logEntry.deleteConfirm}
        onConfirm={() => void remove()}
        onCancel={() => setDialog(false)}
        loading={busy}
        error={dialogError}
        testID="dialog-delete-log"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  exerciseName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  actions: { gap: spacing.sm },
});
