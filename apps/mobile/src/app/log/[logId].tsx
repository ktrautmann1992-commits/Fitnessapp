import { cardioSpeed, logEditability } from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, Heading, LoadingState, Notice } from '@/components/ui';
import { EMPTY_LOG_ROWS, logRowsOf, mergeLogRows } from '@/data/log-rows';
import { logDetail } from '@/data/log-summary';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe, todayIso } from '@/lib/format';
import { cardioDurationText, effortText, kmText, setLineText } from '@/lib/history-format';
import { useThemeColors } from '@/lib/theme';
import { cardioSpeedTexts } from '@/lib/workout-format';
import { useApp } from '@/state/app-state';
import { resolveEntryRoute } from '@/state/flow';

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

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const route = resolveEntryRoute({ session: app.session, rows: app.rows, versions: app.versions });
  if (route !== '/today' || !app.rows) {
    return <Redirect href={route as Href} />;
  }
  const rows = app.rows;
  const detail = logDetail(
    mergeLogRows(logRowsOf(rows), app.olderLogs?.logs ?? EMPTY_LOG_ROWS),
    logId,
  );
  const footer = <Button label={t.logEntry.back} variant="secondary" onPress={goBack} />;

  if (!detail) {
    return (
      <Screen title={t.logEntry.title} testID="log-entry" footer={footer}>
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

  const speed = detail.cardio
    ? cardioSpeed(detail.cardio.modality, detail.cardio.duration_s, detail.cardio.distance_m)
    : null;

  return (
    <Screen title={log.name_de} testID="log-entry" footer={footer}>
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
        <Body testID="log-status">
          {log.status === 'completed' ? t.logEntry.completed : t.logEntry.partial}
        </Body>
        {log.session_rpe !== null ? <Body>{effortText(log.session_rpe)}</Body> : null}
        {waiting ? <Body muted>{t.today.pendingUpload}</Body> : null}
      </Card>

      {detail.cardio ? (
        <Card>
          <View testID="log-cardio" style={styles.block}>
            <Body>{t.logEntry.modality(t.workout.cardio.modalities[detail.cardio.modality])}</Body>
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
            {editability === 'too_old' ? t.logEntry.editTooOld : t.logEntry.editUnlinked}
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
