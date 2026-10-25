import {
  attemptCompareText,
  averagePaceOrSpeedText,
  averagePaceS,
  compareAttempts,
  distanceText,
  durationText,
  elevationStats,
  gpxFileName,
  isoDateInTimeZone,
  paceColoredRuns,
  paceSegments,
  ROUTE_DIFFICULTIES,
  type RouteDifficulty,
  runHighlights,
  splitInsights,
  toGpx,
  TRACKED_ROUTE_LIMITS,
  type TrackedRouteRow,
  usesSpeed,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { BikeTypeChoice, EBikeBadge, useBikeChoice } from '@/components/e-bike';
import { SectionLabel, StatValue } from '@/components/design';
import {
  ElevationArea,
  PaceChart,
  RouteMapSection,
  RunHero,
  RunHeroExtraStats,
  RunHighlights,
  SplitInsightBars,
} from '@/components/run-insights';
import { ProgressCard } from '@/components/progress-card';
import { RouteMatchSection } from '@/components/route-match-card';
import { RouteWeatherSection } from '@/components/route-weather';
import { ConfirmDialog, Screen } from '@/components/screen';
import { SessionKcalStat } from '@/components/session-kcal';
import { HeartZonesBar, WearableLogInfo } from '@/components/wearables';
import {
  Body,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  FieldError,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { activitiesFromRows, routeInputFromPayload, routePoints } from '@/data/endurance-rows';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { berlinTodayIso, formatDateDe } from '@/lib/format';
import { thousands as thousandsDe } from '@/lib/wearable-format';
import { decodeRouteParam } from '@/lib/route-param';
import { saveTextFile } from '@/lib/save-file';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes, useTrackedRoutes } from '@/state/use-tracked-routes';
import { useWearables } from '@/state/use-wearables';

const E = t.endurance;
const D = E.detail;
const WR = t.wearables.route;
const NO_POINTS: { lat: number; lng: number }[] = [];

/**
 * Auswertung je Lauf (Etappe E4, `/ausdauer/[id]`, anschaulich seit 22.10.2026): dunkle Kopf-Karte (Distanz, Ø-Pace
 * bzw. km/h, Zeit, Höhenmeter, Skizze), Bestwerte, Karte mit Linie in Tempo-Farben (WebView/iframe mit OpenFreeMap,
 * Start/Ziel, Attribution; lädt sie nicht → farbige Skizze), Kilometer-Balken mit Abweichung zum Ø, Tempo-Verlauf,
 * Höhenprofil mit Hinweis „ungenau“, Vergleich auf Favoriten-Strecken (neutral, W-G16), Bearbeiten, GPX-Datei,
 * „Als Bild teilen“, Löschen. Lädt die Karte nicht, bleiben alle Zahlen sichtbar.
 * Läufe der Uhr (Herkunft `watch`, 23.10.2026, Mockup s5): Kopf-Karte zusätzlich mit Ø Puls und kcal laut Uhr, Karte
 * direkt darunter mit Hinweis „Route von der Uhr, nur für dich sichtbar“, Pulszonen als gestapelter Balken. Puls und
 * kcal nie auf dem Story-Bild (eigene Positivliste).
 */
export default function RouteDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = decodeRouteParam(params.id);
  const router = useRouter();
  const app = useApp();
  const { state, reload } = useTrackedRoutes();
  const wearables = useWearables();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState({ text: '', version: 0 });
  const announce = (text: string) => {
    setMessage(text);
    setLive((c) => ({ text, version: c.version + 1 }));
  };

  const result = state.kind === 'ready' ? state.result : null;
  const saved = result?.routes.find((r) => r.id === id) ?? null;
  const pending = result?.pending.find((p) => p.payload.id === id) ?? null;
  const polyline = saved?.polyline ?? pending?.payload.polyline ?? null;
  const points = polyline ? routePoints(polyline) : NO_POINTS;

  if (app.status.kind === 'loading' || state.kind === 'loading') {
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
  // Zurück im Stapel (keine zweite „Ausdauer“-Seite übereinander); direkt geöffnet → ersetzen.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href));
  const back = <Button label={D.back} variant="secondary" onPress={leave} testID="route-back" />;
  if (!saved && !pending) {
    return (
      <Screen area="ausdauer" icon="run" title={D.title} footer={back} testID="route-detail">
        <Notice tone="warning" testID="route-not-found">
          {D.notFound}
        </Notice>
      </Screen>
    );
  }
  const info = saved ?? routeInputFromPayload(pending!.payload);
  const kmSplits = saved?.km_splits ?? pending?.payload.km_splits ?? [];
  const profile = saved?.elevation_profile ?? pending?.payload.elevation_profile ?? null;
  const note = saved?.note ?? pending?.payload.note ?? null;
  const difficulty = saved?.difficulty ?? pending?.payload.difficulty ?? null;
  const day = isoDateInTimeZone(info.started_at);
  const comparison = saved ? compareFor(saved, result?.routes ?? []) : null;
  const activities = activitiesFromRows(app.rows, result?.routes ?? [], result?.pending ?? []);
  const progressActivity = activities.find((a) => a.routeId === info.id) ?? null;
  const speed = usesSpeed(info.sport);
  const segments = paceSegments(kmSplits, info.distance_m, info.moving_s);
  const splitRows = splitInsights(kmSplits, info.distance_m, info.moving_s);
  const avgPace = averagePaceS(info.distance_m, info.moving_s);
  const elevation = elevationStats(profile);
  const watch = saved?.source === 'watch';
  const wearableRows = wearables.state.kind === 'ready' ? wearables.state.result.rows : null;
  const logId = info.session_log_id;
  // E-Bike: der verknüpfte Eintrag ist führend (wie enduranceActivities), sonst die Angabe der Strecke.
  const linkedCardio = logId
    ? (app.rows.cardioLogs.find((c) => c.session_log_id === logId) ?? null)
    : null;
  const eBike =
    info.sport === 'bike' &&
    (linkedCardio ? linkedCardio.e_bike === true : (saved?.e_bike ?? info.e_bike) === true);
  const heart =
    watch && logId
      ? (wearableRows?.heartRates.find((h) => h.session_log_id === logId) ?? null)
      : null;
  const watchKcal =
    watch && logId
      ? (wearableRows?.sessions.find((w) => w.session_log_id === logId)?.kcal ?? null)
      : null;
  const mapCard = (
    <Card>
      <RouteMapSection
        points={points}
        segments={segments}
        note={watch ? WR.legendNote : undefined}
      />
    </Card>
  );
  const highlights = runHighlights({
    kmSplits,
    distanceM: info.distance_m,
    movingS: info.moving_s,
    elevationProfile: profile,
  });

  async function remove() {
    if (!id) return;
    setBusy(true);
    setError(undefined);
    try {
      if (pending) await app.backend.discardPendingRoute(id);
      else await app.backend.deleteTrackedRoute(id);
      forgetTrackedRoutes();
      await reload();
      setConfirmDelete(false);
      leave();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function exportGpx() {
    try {
      const gpx = toGpx({
        name: info.name,
        sport: info.sport,
        startedAt: info.started_at,
        note,
        points,
      });
      const outcome = await saveTextFile(gpxFileName(day), gpx, 'application/gpx+xml');
      if (outcome === 'saved') announce(D.gpxSaved);
    } catch {
      announce(D.gpxFailed);
    }
  }

  return (
    <Screen area="ausdauer" icon="run" title={info.name} footer={back} testID="route-detail">
      <LiveRegion text={live.text} version={live.version} />
      <RunHero
        meta={`${eBike ? E.eBike.sport : E.sports[info.sport]} · ${formatDateDe(day)}${watch ? ` · ${WR.heroSource}` : ''}${
          info.is_favorite ? ` · ★ ${D.favorite}` : ''
        }${difficulty ? ` · ${E.save.difficulties[difficulty]}` : ''}`}
        distance={distanceText(info.distance_m)}
        pace={averagePaceOrSpeedText(info.sport, info.moving_s, info.distance_m)}
        time={durationText(info.moving_s)}
        elevation={info.elevation_gain_m !== null ? `${info.elevation_gain_m} m` : null}
        points={points}
        runs={paceColoredRuns(points, segments)}
      >
        {watch ? (
          <RunHeroExtraStats
            stats={[
              ...(heart
                ? [{ label: WR.avgHr, value: String(heart.avg_bpm), testID: 'route-avg-hr' }]
                : []),
              ...(watchKcal !== null
                ? [{ label: WR.kcal, value: thousandsDe(watchKcal), testID: 'route-watch-kcal' }]
                : []),
            ]}
          />
        ) : null}
      </RunHero>
      {eBike ? <EBikeBadge testID="route-e-bike" /> : null}
      {pending ? (
        <Notice tone={pending.state === 'rejected' ? 'warning' : 'info'}>
          {pending.state === 'rejected' ? E.list.rejectedHint : E.save.queued}
        </Notice>
      ) : null}
      {message ? (
        <Notice tone="success" testID="route-message">
          {message}
        </Notice>
      ) : null}

      {/* Wetter zum Start (25.10.2026, Open-Meteo, nur nach Zustimmung). */}
      {saved ? <RouteWeatherSection route={saved} /> : null}
      {/* „Meine Strecken“ (25.10.2026): Vorschlag „Gleiche Strecke wie …“, Zuordnung, „Zum letzten Mal“. */}
      {saved && result ? (
        <RouteMatchSection
          route={saved}
          routes={result.routes}
          onChanged={async () => {
            forgetTrackedRoutes();
            await reload();
          }}
          onOpenRoute={(favoriteId) => router.push(`/ausdauer/strecke/${favoriteId}` as Href)}
          onAnnounce={(text) => setLive((c) => ({ text, version: c.version + 1 }))}
        />
      ) : null}

      {/* „Dein Fortschritt“ (25.10.2026): Vergleich mit eigenen Einheiten ähnlicher Länge, auch ohne gleiche Strecke. */}
      {progressActivity ? (
        <ProgressCard
          activity={progressActivity}
          activities={activities}
          today={berlinTodayIso()}
        />
      ) : null}

      {/* Uhr-Lauf: Karte und Pulszonen gleich unter der Kopf-Karte (Mockup s5). */}
      {watch ? mapCard : null}
      {heart ? (
        <Card>
          <HeartZonesBar summary={heart} />
        </Card>
      ) : null}

      <RunHighlights highlights={highlights} />

      {/* Weitere Zahlen als Raster großer Werte (zwei Spalten, ab 320 px); Distanz, Pace, Zeit stehen oben. */}
      <Card>
        <SectionLabel>{D.details}</SectionLabel>
        <View style={styles.stats} testID="route-stats">
          <View style={styles.statCell}>
            <StatValue
              size="lg"
              label={D.total}
              value={durationText(info.duration_s)}
              valueTestID="route-total"
            />
          </View>
          <View style={styles.statCell}>
            <StatValue
              size="lg"
              label={D.pauses}
              value={durationText(Math.max(0, info.duration_s - info.moving_s))}
              valueTestID="route-pauses"
            />
          </View>
          {/* kcal (Uhr bzw. Schätzung aus Bewegungszeit) – eigene Zelle, nie auf dem Story-Bild. */}
          <SessionKcalStat
            input={{
              kind: 'endurance',
              enduranceModality: info.sport,
              effortTarget: null,
              durationS: info.moving_s,
              eBike,
            }}
            logId={info.session_log_id}
          />
        </View>
      </Card>

      {/* Phase 8: Puls der Uhr, wenn die Aufzeichnung mit einer Uhr-Einheit zusammengeführt wurde. */}
      {info.session_log_id ? <WearableLogInfo logId={info.session_log_id} compact={watch} /> : null}

      {comparison && saved?.is_favorite ? (
        <Notice tone="info" title={D.compare} testID="route-compare">
          {comparison}
        </Notice>
      ) : null}

      {watch ? null : mapCard}

      <Card>
        <SectionLabel>{D.splits}</SectionLabel>
        <SplitInsightBars
          splits={splitRows}
          rest={segments.find((s) => s.partial && s.km > 1) ?? null}
          averageText={
            avgPace !== null
              ? averagePaceOrSpeedText(info.sport, info.moving_s, info.distance_m)
              : null
          }
          speed={speed}
        />
      </Card>

      <Card>
        <PaceChart
          segments={segments}
          distanceM={info.distance_m}
          averageS={avgPace}
          speed={speed}
        />
        <ElevationArea
          profile={profile}
          stats={elevation}
          gainM={info.elevation_gain_m}
          distanceM={info.distance_m}
        />
        <Body muted>{D.elevationNote}</Body>
      </Card>

      {note ? (
        <Card>
          <SectionLabel>{D.note}</SectionLabel>
          <Body>{note}</Body>
        </Card>
      ) : null}

      {saved && editing ? (
        <EditRoute
          route={saved}
          eBike={eBike}
          onDone={async (text) => {
            setEditing(false);
            forgetTrackedRoutes();
            await reload();
            if (text) announce(text);
          }}
        />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={D.share}
          onPress={() => router.push(`/teilen?route=${info.id}` as Href)}
          testID="route-share"
        />
        <Button
          label={D.gpx}
          variant="secondary"
          onPress={() => void exportGpx()}
          testID="route-gpx"
        />
        {saved && !editing ? (
          <Button
            label={D.edit}
            variant="secondary"
            onPress={() => setEditing(true)}
            testID="route-edit"
          />
        ) : null}
        {saved?.is_favorite && (Platform.OS !== 'web' || app.backend.mode === 'local') ? (
          <Button
            label={D.again}
            variant="secondary"
            onPress={() =>
              router.push(
                `/ausdauer/aufzeichnen?sport=${saved.sport}&base=${saved.id}${
                  Platform.OS === 'web' ? '&demo=1' : ''
                }` as Href,
              )
            }
            testID="route-again"
          />
        ) : null}
        {info.session_log_id ? (
          <Button
            label={D.openLog}
            variant="secondary"
            onPress={() => router.push(`/log/${info.session_log_id}` as Href)}
          />
        ) : null}
      </View>
      {/* Löschen abgesetzt am Ende (mit Rückfrage). */}
      <View style={styles.danger}>
        <Button
          label={D.delete}
          variant="danger"
          onPress={() => setConfirmDelete(true)}
          testID="route-delete"
        />
      </View>
      <FieldError message={error} />
      <ConfirmDialog
        visible={confirmDelete}
        title={D.delete}
        message={D.deleteConfirm}
        confirmLabel={D.deleteYes}
        loading={busy}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
        testID="route-delete-dialog"
      />
    </Screen>
  );
}

/** Neutraler Vergleich (nur eigene Läufe derselben Favoriten-Strecke, keine Bestzeit, W-G16). */
function compareFor(route: TrackedRouteRow, routes: readonly TrackedRouteRow[]): string | null {
  const favoriteId = route.is_favorite ? route.id : route.base_route_id;
  const favorite = routes.find((r) => r.id === favoriteId);
  if (!favorite) return null;
  const entry = compareAttempts(favorite, routes).find((c) => c.routeId === route.id);
  return entry ? attemptCompareText(entry) : null;
}

function EditRoute({
  route,
  eBike: initialEBike,
  onDone,
}: {
  route: TrackedRouteRow;
  /** Aktuelle E-Bike-Angabe (verknüpfter Eintrag bzw. Strecke). */
  eBike: boolean;
  onDone: (message: string | null) => Promise<void>;
}) {
  const app = useApp();
  const bikeChoice = useBikeChoice(app.session?.userId ?? null);
  const [eBike, setEBike] = useState(initialEBike);
  const [name, setName] = useState(route.name);
  const [favorite, setFavorite] = useState(route.is_favorite);
  const [difficulty, setDifficulty] = useState<RouteDifficulty | 'none'>(
    route.difficulty ?? 'none',
  );
  const [note, setNote] = useState(route.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await app.backend.updateTrackedRoute({
        id: route.id,
        name: name.trim(),
        difficulty: difficulty === 'none' ? null : difficulty,
        is_favorite: favorite,
        note: note.trim() === '' ? null : note.trim(),
        // Nur beim Rad senden (sonst fehlt das Feld = unverändert).
        ...(route.sport === 'bike' ? { e_bike: eBike } : {}),
      });
      if (route.sport === 'bike' && eBike !== initialEBike) {
        bikeChoice.remember(eBike);
        // Der verknüpfte Eintrag folgt (Revision + 1) → Tagebuch neu laden.
        await app.reload().catch(() => undefined);
      }
      await onDone(D.updated);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.actions} testID="route-edit-form">
        <TextField
          label={E.save.name}
          hint={E.save.nameHint}
          value={name}
          onChangeText={setName}
          maxLength={TRACKED_ROUTE_LIMITS.nameMaxLength}
          testID="route-edit-name"
        />
        {route.sport === 'bike' ? (
          <BikeTypeChoice eBike={eBike} onChange={setEBike} testID="route-edit-bike-type" />
        ) : null}
        <Checkbox label={E.save.favorite} checked={favorite} onChange={setFavorite} />
        <ChoiceList<RouteDifficulty | 'none'>
          label={E.save.difficulty}
          options={[
            { value: 'none', label: E.save.noDifficulty },
            ...ROUTE_DIFFICULTIES.map((value) => ({ value, label: E.save.difficulties[value] })),
          ]}
          value={difficulty}
          onChange={setDifficulty}
          horizontal
        />
        <TextField
          label={E.save.note}
          hint={E.save.noteHint}
          value={note}
          onChangeText={setNote}
          maxLength={TRACKED_ROUTE_LIMITS.noteMaxChars}
          multiline
        />
        <FieldError message={error} />
        <Button
          label={D.editSave}
          loading={busy}
          onPress={() => void save()}
          testID="route-edit-save"
        />
        <Button label={D.editCancel} variant="secondary" onPress={() => void onDone(null)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  statCell: { width: '50%', paddingRight: spacing.sm },
  actions: { gap: spacing.sm },
  danger: { marginTop: spacing.md },
});
