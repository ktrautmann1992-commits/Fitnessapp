import {
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

import { LiveRegion } from '@/components/calendar';
import { StatValue } from '@/components/design';
import { EBikeBadge } from '@/components/e-bike';
import { RouteInsights } from '@/components/route-insights';
import { RowLogInfo } from '@/components/rowing';
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
import { routeForLog } from '@/data/route-view';
import { logStrengthComparisons } from '@/data/strength-progress';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { formatDateDe, todayIso } from '@/lib/format';
import { effortText, setLineText } from '@/lib/history-format';
import { useThemeColors } from '@/lib/theme';
import { strengthComparisonText } from '@/lib/strength-format';
import { cardioStatTiles } from '@/lib/workout-format';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';
import { Text } from '@/components/text';

/**
 * Ein Eintrag aus Woche/Verlauf (docs/PLAN-PHASE-4.md 6.1 Punkt 5, Etappe D): ansehen, ändern (Trainingsmodus im
 * Änderungs-Modus, nur solange save_session_log die neue Fassung annimmt – logEditability() in packages/core) und
 * löschen (delete_session_log mit Revision, nur online, 4.5). Notizen werden nur angezeigt, nie ausgewertet (S3).
 *
 * Mit aufgezeichneter Strecke (tracked_routes.session_log_id, z. B. Lauf aus „Aufzeichnen“, gezählt zur geplanten
 * Einheit, oder Uhr-Lauf mit Route; 28.10.2026): oben die volle Lauf-Auswertung wie unter `/ausdauer/[id]`
 * (components/route-insights.tsx – Kopf-Karte, Tempo-Farben, Kilometer-Balken, Diagramme, Bestwerte, Pulszonen,
 * Wetter), darunter nur, was der Eintrag zusätzlich weiß (erledigt, kcal, Belastung, Notiz) und seine Aktionen. Ohne
 * Strecke (manuell eingetragen, Uhr ohne GPS): Ausdauer-Werte als Kacheln.
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
  const { state: routesState, reload: reloadRoutes } = useTrackedRoutes();
  const [live, setLive] = useState({ text: '', version: 0 });
  const routes = routesState.kind === 'ready' ? routesState.result : null;
  const linked = routeForLog(routes, logId);

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

  // Strecken laden noch (erster Aufruf): bei Laufen/Rad/Gehen kurz warten statt erst die schlichte Seite zu zeigen.
  const gpsModality =
    detail.cardio !== null && ['run', 'bike', 'walk'].includes(detail.cardio.modality);
  if (routesState.kind === 'loading' && gpsModality) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const tiles = detail.cardio && !linked ? cardioStatTiles(detail.cardio) : [];

  return (
    <Screen
      area={linked ? 'ausdauer' : 'training'}
      icon={linked ? 'run' : 'dumbbell'}
      title={log.name_de}
      testID="log-entry"
      footer={footer}
    >
      <LiveRegion text={live.text} version={live.version} />
      {message ? (
        <Notice tone={message.tone} testID="log-message">
          {message.text}
        </Notice>
      ) : null}
      {/* Aufgezeichnete Strecke: volle Auswertung (gleich wie /ausdauer/[id]), kcal steht im Eintrag darunter. */}
      {linked && routes ? (
        <View style={styles.insights} testID="log-route-insights">
          <RouteInsights
            route={linked}
            result={routes}
            showKcal={false}
            onRoutesChanged={async () => {
              forgetTrackedRoutes();
              await reloadRoutes();
            }}
            onAnnounce={(text) => setLive((c) => ({ text, version: c.version + 1 }))}
          />
        </View>
      ) : null}
      <Card>
        {/* Mit Strecke steht der Tag schon in der Kopf-Karte. */}
        {linked ? null : <Body>{t.logEntry.performedOn(formatDateDe(log.performed_on))}</Body>}
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
      {/* Mit Strecke zeigt die Auswertung oben Uhr-Herkunft und Puls schon. */}
      {linked ? null : <WearableLogInfo logId={log.id} />}
      {/* Sportarten Stufe 2: Sportart, Dauer, Distanz und Belastung. */}
      <SportLogInfo log={log} />

      {detail.cardio && !linked ? (
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
            {/* Werte als Kacheln (zwei Spalten) statt Textzeilen (28.10.2026). */}
            <View style={styles.tiles} testID="log-cardio-tiles">
              {tiles.map((tile) => (
                <View key={tile.key} style={styles.tile}>
                  <StatValue
                    size="lg"
                    label={tile.label}
                    value={tile.value}
                    accessibilityLabel={tile.a11y}
                    valueTestID={`log-cardio-${tile.key}`}
                  />
                </View>
              ))}
            </View>
            {/* Etappe R: Watt (berechnet bzw. eingetragen), Schlagzahl, Intervall-Ergebnis. */}
            {detail.cardio.modality === 'row' ? <RowLogInfo cardio={detail.cardio} /> : null}
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
        {/* Strecke selbst (Name, Meine Strecke, GPX, Strecke löschen) bleibt unter /ausdauer/[id]. */}
        {linked ? (
          <Button
            label={t.logEntry.routeTools}
            variant="secondary"
            onPress={() =>
              router.push(`/ausdauer/${linked.saved?.id ?? linked.pending?.payload.id}` as Href)
            }
            testID="log-open-route"
          />
        ) : null}
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
  insights: { gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, marginTop: spacing.sm },
  tile: { width: '50%', paddingRight: spacing.sm },
  exerciseName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 24 },
  actions: { gap: spacing.sm },
});
