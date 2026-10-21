import {
  type EndurancePeriod,
  enduranceTotals,
  shiftPeriod,
  TRACKED_ROUTE_SPORTS,
  type TrackedRouteSport,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AreaButton } from '@/components/design';
import { LiveRegion } from '@/components/calendar';
import { ActivityRow, TotalsView } from '@/components/endurance';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, ChoiceList, Heading, LoadingState, Notice } from '@/components/ui';
import { activitiesFromRows, routePoints } from '@/data/endurance-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { berlinTodayIso } from '@/lib/format';
import { endRecording, restoreRecording } from '@/lib/recording-controller';
import {
  parsePersistedRecording,
  type PersistedRecording,
  useRecordingSession,
} from '@/lib/recording-session';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';
import { wearableBadgeText } from '@/components/wearables';
import { useWearables } from '@/state/use-wearables';

const E = t.endurance;

/**
 * Bereich „Ausdauer“ (Etappen E4/E5, docs/PLAN-EINKAUFEN-AUSDAUER.md 6–7): Aufzeichnen (Laufen/Rad/Gehen), Summen der
 * Woche bzw. des Monats, „Meine Läufe“ (Strecken mit Linien-Skizze + Einträge ohne GPS, ohne Doppelzählung) und
 * „Eintragen ohne GPS“. Im Browser: Hinweis „Aufzeichnen geht in der App“, im Testmodus eine Demo-Aufzeichnung.
 */
export default function EnduranceScreen() {
  const router = useRouter();
  const app = useApp();
  const active = useRecordingSession();
  const { state, reload } = useTrackedRoutes();
  // Phase 8: Uhr-Einheiten mit „⌚ aus …“ kennzeichnen.
  const { state: wearableState } = useWearables();
  const wearableRows = wearableState.kind === 'ready' ? wearableState.result.rows : null;
  const [sport, setSport] = useState<TrackedRouteSport>('run');
  const [period, setPeriod] = useState<EndurancePeriod>('week');
  const [anchor, setAnchor] = useState(() => berlinTodayIso());
  const [recovered, setRecovered] = useState<PersistedRecording | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [live, setLive] = useState({ text: '', version: 0 });
  const userId = app.session?.userId ?? null;

  // Nach Absturz/Neustart: gesicherte Aufzeichnung anbieten (nur eigenes Konto, nur wenn keine im Speicher läuft).
  useEffect(() => {
    if (!userId || active) return;
    let alive = true;
    app.backend
      .readRecording()
      .then((text) => {
        if (alive) setRecovered(parsePersistedRecording(text, userId));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active, app.backend, userId]);

  const result = state.kind === 'ready' ? state.result : null;
  const activities = useMemo(
    () => activitiesFromRows(app.rows, result?.routes ?? [], result?.pending ?? []),
    [app.rows, result],
  );
  const points = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number }[]>();
    for (const r of result?.routes ?? []) map.set(r.id, routePoints(r.polyline));
    for (const p of result?.pending ?? []) map.set(p.payload.id, routePoints(p.payload.polyline));
    return map;
  }, [result]);
  const summary = useMemo(
    () => enduranceTotals(activities, { period, anchor }),
    [activities, period, anchor],
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
  if (route !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={route as Href} />;
  }
  const testMode = app.backend.mode === 'local';
  const isWeb = Platform.OS === 'web';
  const today = berlinTodayIso();
  const pendingById = new Map((result?.pending ?? []).map((p) => [p.payload.id, p] as const));

  async function recover(action: 'resume' | 'save' | 'discard') {
    if (!recovered) return;
    if (action === 'discard') {
      await endRecording();
      await app.backend.clearRecording().catch(() => undefined);
      setRecovered(null);
      return;
    }
    await restoreRecording(app.backend, recovered);
    setRecovered(null);
    router.push(`/ausdauer/aufzeichnen?step=${action === 'save' ? 'save' : 'live'}` as Href);
  }

  async function deleteAll() {
    setBusy(true);
    try {
      const n = await app.backend.deleteAllTrackedRoutes();
      forgetTrackedRoutes();
      await reload();
      setConfirmDeleteAll(false);
      setMessage({ tone: 'success', text: E.list.deletedAll(n) });
      setLive((c) => ({ text: E.list.deletedAll(n), version: c.version + 1 }));
    } catch (error) {
      setMessage({ tone: 'warning', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  async function pendingAction(id: string, action: 'retry' | 'discard') {
    try {
      if (action === 'retry') await app.backend.retryPendingRoute(id);
      else await app.backend.discardPendingRoute(id);
      await reload();
    } catch (error) {
      setMessage({ tone: 'warning', text: errorText(error) });
    }
  }

  const periodLabel = period === 'week' ? E.totals.week : E.totals.month;

  return (
    <Screen area="ausdauer" icon="run" title={E.title} testID="endurance">
      <LiveRegion text={live.text} version={live.version} />
      {message ? (
        <Notice tone={message.tone} testID="endurance-message">
          {message.text}
        </Notice>
      ) : null}

      {active ? (
        <Notice tone="info" title={E.record.resumeHint} testID="endurance-active">
          <Button
            label={E.record.resumeOpen}
            onPress={() => router.push('/ausdauer/aufzeichnen' as Href)}
            testID="endurance-active-open"
          />
        </Notice>
      ) : recovered ? (
        <Notice tone="warning" title={E.recover.title} testID="endurance-recover">
          <Body>{E.recover.text}</Body>
          {recovered.mode === 'gps' && !isWeb ? (
            <Button label={E.recover.resume} onPress={() => void recover('resume')} />
          ) : null}
          <Button
            label={E.recover.save}
            variant="secondary"
            onPress={() => void recover('save')}
            testID="endurance-recover-save"
          />
          <Button
            label={E.recover.discard}
            variant="danger"
            onPress={() => void recover('discard')}
            testID="endurance-recover-discard"
          />
        </Notice>
      ) : (
        <Card>
          <View style={styles.section}>
            <Heading level={2}>{E.record.title}</Heading>
            {isWeb ? (
              <Notice tone="info" testID="endurance-web-hint">
                {E.record.webHint}
              </Notice>
            ) : null}
            {!isWeb || testMode ? (
              <ChoiceList<TrackedRouteSport>
                label={E.record.chooseSport}
                options={TRACKED_ROUTE_SPORTS.map((value) => ({ value, label: E.sports[value] }))}
                value={sport}
                onChange={setSport}
                horizontal
              />
            ) : null}
            {!isWeb ? (
              <AreaButton
                area="ausdauer"
                icon="play"
                label={E.record.start}
                accessibilityLabel={E.record.startA11y(E.sports[sport])}
                onPress={() => router.push(`/ausdauer/aufzeichnen?sport=${sport}` as Href)}
                testID="endurance-start"
              />
            ) : testMode ? (
              <>
                <AreaButton
                  area="ausdauer"
                  icon="play"
                  label={E.record.demoStart}
                  onPress={() => router.push(`/ausdauer/aufzeichnen?sport=${sport}&demo=1` as Href)}
                  testID="endurance-demo"
                />
                <Body muted>{E.record.demoHint}</Body>
              </>
            ) : null}
            <Button
              label={E.record.manual}
              variant="secondary"
              onPress={() => router.push(`/nachtragen?date=${today}` as Href)}
              testID="endurance-manual"
            />
            <Body muted>{E.record.manualHint}</Body>
          </View>
        </Card>
      )}

      <Card>
        <View style={styles.section}>
          <ChoiceList<EndurancePeriod>
            groupLabel={E.totals.switchA11y}
            options={[
              { value: 'week', label: E.totals.week },
              { value: 'month', label: E.totals.month },
            ]}
            value={period}
            onChange={(value) => {
              setPeriod(value);
              setAnchor(today);
            }}
            horizontal
          />
          <TotalsView summary={summary} />
          <View style={styles.paging}>
            <Button
              label={E.totals.previous}
              variant="secondary"
              accessibilityLabel={E.totals.previousA11y(periodLabel)}
              onPress={() => setAnchor((a) => shiftPeriod(period, a, -1))}
              testID="endurance-totals-previous"
            />
            <Button
              label={E.totals.next}
              variant="secondary"
              accessibilityLabel={E.totals.nextA11y(periodLabel)}
              disabled={summary.to >= today}
              onPress={() => setAnchor((a) => shiftPeriod(period, a, 1))}
              testID="endurance-totals-next"
            />
          </View>
        </View>
      </Card>

      <Heading level={2}>{E.list.title}</Heading>
      {result?.offline ? <Notice tone="warning">{E.list.offline}</Notice> : null}
      {state.kind === 'loading' ? <LoadingState /> : null}
      {state.kind === 'error' ? (
        <Notice tone="warning" title={E.list.loadFailed}>
          <Button label={E.list.retry} variant="secondary" onPress={() => void reload()} />
        </Notice>
      ) : null}
      {state.kind === 'ready' && activities.length === 0 ? (
        <Body testID="endurance-empty">{E.list.empty}</Body>
      ) : null}
      <View style={styles.list}>
        {activities.map((activity) => {
          const pending = activity.routeId ? pendingById.get(activity.routeId) : undefined;
          return (
            <View key={activity.key} style={styles.section}>
              <ActivityRow
                activity={activity}
                points={activity.routeId ? (points.get(activity.routeId) ?? null) : null}
                badge={
                  pending ? (pending.state === 'rejected' ? E.list.rejected : E.list.pending) : null
                }
                note={activity.logId ? wearableBadgeText(wearableRows, activity.logId) : null}
                onPress={() =>
                  router.push(
                    (activity.routeId
                      ? `/ausdauer/${activity.routeId}`
                      : `/log/${activity.logId ?? ''}`) as Href,
                  )
                }
              />
              {pending?.state === 'rejected' ? (
                <Notice tone="warning">
                  <Body>{E.list.rejectedHint}</Body>
                  <Button
                    label={E.list.retryPending}
                    variant="secondary"
                    onPress={() => void pendingAction(pending.payload.id, 'retry')}
                  />
                  <Button
                    label={E.list.discardPending}
                    variant="danger"
                    onPress={() => void pendingAction(pending.payload.id, 'discard')}
                  />
                </Notice>
              ) : null}
            </View>
          );
        })}
      </View>
      {(result?.routes.length ?? 0) > 0 ? (
        <Button
          label={E.list.deleteAll}
          variant="danger"
          onPress={() => setConfirmDeleteAll(true)}
          testID="endurance-delete-all"
        />
      ) : null}
      <ConfirmDialog
        visible={confirmDeleteAll}
        title={E.list.deleteAll}
        message={E.list.deleteAllConfirm}
        confirmLabel={E.list.deleteAllYes}
        loading={busy}
        onConfirm={() => void deleteAll()}
        onCancel={() => setConfirmDeleteAll(false)}
        testID="endurance-delete-all-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  list: { gap: spacing.sm },
  paging: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
});
