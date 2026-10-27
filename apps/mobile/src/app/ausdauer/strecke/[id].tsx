import {
  attemptCompareText,
  compareAttempts,
  routeHistory,
  TRACKED_ROUTE_LIMITS,
  type TrackedRouteRow,
  elevationFromProfile,
  hikingTimeEstimate,
  isHikeKind,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { StatValue } from '@/components/design';
import {
  LastTimeCard,
  RouteHistoryChart,
  RouteRunList,
  shortDayDe,
  SplitCompareBars,
  ToggleRow,
} from '@/components/my-routes';
import { RouteMapSection } from '@/components/run-insights';
import { ConfirmDialog, Screen } from '@/components/screen';
import { Body, Button, Card, FieldError, LoadingState, Notice, TextField } from '@/components/ui';
import { SectionLabel } from '@/components/design';
import { routePoints } from '@/data/endurance-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { decodeRouteParam } from '@/lib/route-param';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';

const E = t.endurance;
const R = t.endurance.routes;
const HK = t.endurance.hiking;
const NO_SEGMENTS: never[] = [];

/**
 * Strecken-Seite „Meine Strecke“ (Mockup 3, 25.10.2026): Karte bzw. Skizze, Kennzahlen, dunkle Karte „Zum letzten
 * Mal“, Verlauf aller Läufe (Zeit/Pace, zeitliche Reihenfolge), Kilometer im Vergleich (türkis/orange), Liste aller
 * Läufe (nicht vergleichbare grau) und Verwalten (automatisch zuordnen, Erneut laufen, Umbenennen, nicht mehr
 * merken). Nur eigene Läufe, keine Bestzeit, keine Rangliste, kein Puls (W-G16). Rechnungen in packages/core.
 */
export default function MyRouteScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = decodeRouteParam(params.id);
  const router = useRouter();
  const app = useApp();
  const { state, reload } = useTrackedRoutes();
  const [renaming, setRenaming] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => {
    setMessage(text);
    setLive((c) => ({ text, version: c.version + 1 }));
  };

  const result = state.kind === 'ready' ? state.result : null;
  const routes = useMemo(() => result?.routes ?? [], [result]);
  const favorite = routes.find((r) => r.id === id && r.is_favorite) ?? null;
  const attempts = useMemo(
    () => (favorite ? compareAttempts(favorite, routes) : []),
    [favorite, routes],
  );
  const history = useMemo(
    () => (favorite ? routeHistory(favorite, routes) : []),
    [favorite, routes],
  );
  const byId = useMemo(() => new Map(routes.map((r) => [r.id, r] as const)), [routes]);
  const points = useMemo(() => (favorite ? routePoints(favorite.polyline) : []), [favorite]);

  if (app.status.kind === 'loading' || state.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  const entry = resolveEntryRoute({
    session: app.session,
    rows: app.rows,
    versions: app.versions,
    nutritionSetupAvailable: app.backend.supportsNutrition,
  });
  if (entry !== HOME_ROUTE || !app.rows || !app.session) {
    return <Redirect href={entry as Href} />;
  }
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href));
  const back = <Button label={R.back} variant="secondary" onPress={leave} testID="my-route-back" />;
  if (state.kind === 'error') {
    return (
      <Screen area="ausdauer" icon="run" title={R.pageTitle} footer={back} testID="my-route">
        <Notice tone="warning" title={E.list.loadFailed}>
          <Button label={E.list.retry} variant="secondary" onPress={() => void reload()} />
        </Notice>
      </Screen>
    );
  }
  if (!favorite) {
    return (
      <Screen area="ausdauer" icon="run" title={R.pageTitle} footer={back} testID="my-route">
        <Notice tone="warning" testID="my-route-not-found">
          {R.notFound}
        </Notice>
      </Screen>
    );
  }

  const sport = favorite.e_bike
    ? E.eBike.sport
    : favorite.sport === 'walk' && isHikeKind(favorite.walk_kind)
      ? HK.kinds[favorite.walk_kind]
      : E.sports[favorite.sport];
  // Wandern (Etappe W): Gehzeit-Schätzung nach DIN 33466/DAV für gespeicherte Geh-Strecken (nur Anzeige).
  const profileElevation = elevationFromProfile(favorite.elevation_profile);
  const walkTime =
    favorite.sport === 'walk'
      ? hikingTimeEstimate({
          distanceM: favorite.distance_m,
          gainM: favorite.elevation_gain_m ?? profileElevation?.gainM ?? null,
          lossM: favorite.elevation_loss_m ?? profileElevation?.lossM ?? null,
        })
      : null;
  const last = attempts.at(-1) ?? null;
  const lastRow = last ? (byId.get(last.routeId) ?? null) : null;
  const previousRow = last?.previousRouteId ? (byId.get(last.previousRouteId) ?? null) : null;
  // Kilometer-Vergleich: neuester Lauf mit Vergleich gegen seinen vorherigen vergleichbaren Lauf.
  const compared = [...attempts].reverse().find((a) => a.previousRouteId !== null) ?? null;
  const comparedRow = compared ? (byId.get(compared.routeId) ?? null) : null;
  const comparedPrev = compared?.previousRouteId
    ? (byId.get(compared.previousRouteId) ?? null)
    : null;
  const canRecord = Platform.OS !== 'web' || app.backend.mode === 'local';

  async function act(run: () => Promise<string | null>) {
    setBusy(true);
    setError(undefined);
    try {
      const text = await run();
      forgetTrackedRoutes();
      await reload();
      if (text) announce(text);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const update = (fav: TrackedRouteRow, changes: { name?: string; is_favorite?: boolean }) =>
    app.backend.updateTrackedRoute({
      id: fav.id,
      name: changes.name ?? fav.name,
      difficulty: fav.difficulty,
      is_favorite: changes.is_favorite ?? true,
      note: fav.note,
    });

  return (
    <Screen area="ausdauer" icon="run" title={favorite.name} footer={back} testID="my-route">
      <LiveRegion text={live.text} version={live.version} />
      <Body muted testID="my-route-meta">
        {R.since(sport, shortDayDe(favorite.started_at, false))}
      </Body>
      {message ? (
        <Notice tone="success" silent testID="my-route-message">
          {message}
        </Notice>
      ) : null}
      <Card>
        <RouteMapSection points={points} segments={NO_SEGMENTS} />
      </Card>
      <View style={styles.stats}>
        <Card style={styles.statCard}>
          <StatValue
            size="lg"
            label={favorite.sport === 'bike' ? R.statRunsBike : R.statRuns}
            value={String(attempts.length)}
            valueTestID="my-route-runs"
          />
        </Card>
        <Card style={styles.statCard}>
          <StatValue
            size="lg"
            label={R.statLast}
            value={last ? shortDayDe(last.startedAt, false) : '–'}
            valueTestID="my-route-last"
          />
        </Card>
        {favorite.elevation_gain_m !== null ? (
          <Card style={styles.statCard}>
            <StatValue size="lg" label={R.statElevation} value={`${favorite.elevation_gain_m} m`} />
          </Card>
        ) : null}
        {walkTime ? (
          <Card style={styles.statCard}>
            <StatValue
              size="lg"
              label={HK.timeLabel}
              value={HK.timeValue(walkTime.minutes)}
              valueTestID="my-route-walk-time"
            />
          </Card>
        ) : null}
      </View>
      {walkTime ? (
        <Body muted testID="my-route-walk-time-note">
          {walkTime.withoutElevation ? `${HK.timeNote} ${HK.timeNoElevation}` : HK.timeNote}
        </Body>
      ) : null}

      {last && lastRow ? (
        <LastTimeCard
          title={previousRow ? R.lastTime(shortDayDe(previousRow.started_at, false)) : R.statLast}
          headline={attemptCompareText(last)}
          sport={favorite.sport}
          previous={previousRow}
          current={lastRow}
        />
      ) : null}

      <Card>
        <RouteHistoryChart history={history} sport={favorite.sport} />
      </Card>

      {compared && comparedRow && comparedPrev ? (
        <Card>
          <SplitCompareBars previous={comparedPrev} current={comparedRow} />
        </Card>
      ) : null}

      <Card>
        <RouteRunList
          attempts={attempts}
          routes={byId}
          sport={favorite.sport}
          onOpen={(routeId) => router.push(`/ausdauer/${routeId}` as Href)}
        />
      </Card>

      <Card>
        <View style={styles.gap} testID="my-route-manage">
          <SectionLabel>{R.manage}</SectionLabel>
          <ToggleRow
            label={R.autoAssignNew}
            value={favorite.auto_match}
            disabled={busy}
            onChange={(value) =>
              void act(async () => {
                await app.backend.setRouteAutoMatch(favorite.id, value);
                return null;
              })
            }
            testID="my-route-auto"
          />
          {renaming ? (
            <RenameForm
              initial={favorite.name}
              busy={busy}
              onCancel={() => setRenaming(false)}
              onSave={(name) =>
                void act(async () => {
                  await update(favorite, { name });
                  setRenaming(false);
                  return E.detail.updated;
                })
              }
            />
          ) : (
            <View style={styles.row}>
              {canRecord ? (
                <View style={styles.flex}>
                  <Button
                    label={R.again}
                    variant="secondary"
                    onPress={() =>
                      router.push(
                        `/ausdauer/aufzeichnen?sport=${favorite.sport}&base=${favorite.id}${
                          isHikeKind(favorite.walk_kind) ? `&walk=${favorite.walk_kind}` : ''
                        }${Platform.OS === 'web' ? '&demo=1' : ''}` as Href,
                      )
                    }
                    testID="my-route-again"
                  />
                </View>
              ) : null}
              <View style={styles.flex}>
                <Button
                  label={R.rename}
                  variant="secondary"
                  onPress={() => setRenaming(true)}
                  testID="my-route-rename"
                />
              </View>
            </View>
          )}
          <Button
            label={R.forget}
            variant="danger"
            onPress={() => setConfirmForget(true)}
            testID="my-route-forget"
          />
          <Body muted>{R.forgetHint}</Body>
          <FieldError message={error} />
        </View>
      </Card>
      <ConfirmDialog
        visible={confirmForget}
        title={R.forget}
        message={R.forgetConfirm}
        confirmLabel={R.forgetYes}
        loading={busy}
        error={error}
        onConfirm={() =>
          void act(async () => {
            await update(favorite, { is_favorite: false });
            setConfirmForget(false);
            leave();
            return R.forgotten;
          })
        }
        onCancel={() => setConfirmForget(false)}
        testID="my-route-forget-dialog"
      />
    </Screen>
  );
}

function RenameForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  return (
    <View style={styles.gap}>
      <TextField
        label={R.name}
        hint={E.save.nameHint}
        value={name}
        onChangeText={setName}
        maxLength={TRACKED_ROUTE_LIMITS.nameMaxLength}
        testID="my-route-name"
      />
      <Button
        label={R.renameSave}
        loading={busy}
        disabled={trimmed === ''}
        onPress={() => onSave(trimmed)}
        testID="my-route-name-save"
      />
      <Button label={R.rememberCancel} variant="link" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 130 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, padding: spacing.sm },
});
