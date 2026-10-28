import {
  attemptCompareText,
  averagePaceOrSpeedText,
  averagePaceS,
  cadenceHint,
  compareAttempts,
  distanceText,
  durationText,
  elevationStats,
  gradeAdjustedPace,
  hikingTimeEstimate,
  isHikeKind,
  paceColoredRuns,
  paceSegments,
  paceText,
  runHighlights,
  splitInsights,
  type TrackedRouteRow,
  usesSpeed,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SectionLabel, StatValue } from '@/components/design';
import { EBikeBadge } from '@/components/e-bike';
import { HikingSafetyCard } from '@/components/hiking';
import { ProgressCard } from '@/components/progress-card';
import { RouteMatchSection } from '@/components/route-match-card';
import { RouteWeatherSection } from '@/components/route-weather';
import { PulseZonesDetail, useRunCadence } from '@/components/runner';
import {
  ElevationArea,
  PaceChart,
  RouteMapSection,
  RunHero,
  RunHeroExtraStats,
  RunHighlights,
  SplitInsightBars,
} from '@/components/run-insights';
import { SessionKcalStat } from '@/components/session-kcal';
import { ShoeChip } from '@/components/shoes';
import { Body, Card, Notice } from '@/components/ui';
import { WearableLogInfo } from '@/components/wearables';
import type { TrackedRoutesResult } from '@/data/backend';
import { activitiesFromRows, routePoints } from '@/data/endurance-rows';
import { routeFacts, type RouteRef } from '@/data/route-view';
import { t } from '@/i18n';
import { berlinTodayIso, formatDateDe } from '@/lib/format';
import { thousands as thousandsDe } from '@/lib/wearable-format';
import { useApp } from '@/state/app-state';
import { useWearables } from '@/state/use-wearables';

const E = t.endurance;
const D = E.detail;
const WR = t.wearables.route;
const RN = t.runner;
const HK = t.endurance.hiking;
const NO_POINTS: { lat: number; lng: number }[] = [];

/**
 * Volle Lauf-Auswertung einer aufgezeichneten Strecke (Etappe E4, anschaulich seit 22.10.2026, PR #153): dunkle
 * Kopf-Karte (Distanz, Ø-Pace bzw. km/h, Zeit, Höhenmeter, Skizze), Bestwerte, Karte mit Linie in Tempo-Farben,
 * Kilometer-Balken, Tempo-Verlauf, Höhenprofil, Pulszonen, Wetter, „Meine Strecken“, Fortschritt. Läufe der Uhr: Ø
 * Puls und kcal laut Uhr in der Kopf-Karte, Karte und Pulszonen direkt darunter (Mockup s5).
 *
 * Ausgelagert aus `/ausdauer/[id]` (28.10.2026), damit der Tagebuch-Eintrag `/log/[id]` einer Einheit mit
 * aufgezeichneter Strecke (auch geplante Einheit, „Lockerer Dauerlauf“) dieselbe Auswertung zeigt. Gilt für Laufen,
 * Rad, Gehen und Wandern. Aktionen (Bearbeiten, GPX, Löschen …) liefert die jeweilige Seite.
 */
export function RouteInsights({
  route,
  result,
  onRoutesChanged,
  onAnnounce,
  showKcal = true,
}: {
  route: RouteRef;
  result: TrackedRoutesResult;
  /** Nach Änderungen an Strecken (Zuordnung „Meine Strecken“): neu laden. */
  onRoutesChanged: () => Promise<void>;
  /** Kurze Ansage für Bildschirmleser. */
  onAnnounce: (text: string) => void;
  /** kcal-Zelle in „Details“ (aus, wenn die Seite kcal schon zeigt, z. B. Tagebuch-Eintrag). */
  showKcal?: boolean;
}) {
  const router = useRouter();
  const app = useApp();
  const wearables = useWearables();
  const cadenceById = useRunCadence();
  if (!app.rows) return null;
  const { saved, pending } = route;
  const facts = routeFacts(app.rows, route);
  const { info, kmSplits, profile, note, difficulty, day, watch, eBike, walkKind, sacGrade } =
    facts;
  const { lossM, maxAltM, gainM } = facts;
  const points = facts.polyline ? routePoints(facts.polyline) : NO_POINTS;
  const comparison = saved ? compareFor(saved, result.routes) : null;
  const activities = activitiesFromRows(app.rows, result.routes, result.pending);
  const progressActivity = activities.find((a) => a.routeId === info.id) ?? null;
  const speed = usesSpeed(info.sport);
  const segments = paceSegments(kmSplits, info.distance_m, info.moving_s);
  const splitRows = splitInsights(kmSplits, info.distance_m, info.moving_s);
  const avgPace = averagePaceS(info.distance_m, info.moving_s);
  const elevation = elevationStats(profile);
  const wearableRows = wearables.state.kind === 'ready' ? wearables.state.result.rows : null;
  const logId = info.session_log_id;
  const walkTime =
    info.sport === 'walk' && saved
      ? hikingTimeEstimate({
          distanceM: info.distance_m,
          gainM,
          lossM,
        })
      : null;
  // Puls der Uhr (Lauf der Uhr oder mit einer Uhr-Einheit zusammengeführte Aufzeichnung) – nur mit Einwilligung
  // vorhanden, nie auf dem Story-Bild.
  const heart = logId
    ? (wearableRows?.heartRates.find((h) => h.session_log_id === logId) ?? null)
    : null;
  // Lauf-Paket 2: Kadenz (Schritte der Uhr, nur auf diesem Gerät gemerkt) und bergbereinigtes Tempo (GAP).
  const wearableSession = logId
    ? (wearableRows?.sessions.find((w) => w.session_log_id === logId) ?? null)
    : null;
  const cadenceSport = info.sport === 'run' || info.sport === 'walk' ? info.sport : null;
  const cadence =
    cadenceSport && wearableSession ? (cadenceById[wearableSession.external_id] ?? null) : null;
  const cadenceHintKey =
    cadence !== null && cadenceSport ? cadenceHint(cadence, cadenceSport) : null;
  const gap =
    info.sport === 'run'
      ? gradeAdjustedPace({
          distanceM: info.distance_m,
          movingS: info.moving_s,
          profile,
          segments,
        })
      : null;
  const watchKcal = watch && wearableSession ? (wearableSession.kcal ?? null) : null;
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

  return (
    <>
      <RunHero
        meta={`${eBike ? E.eBike.sport : walkKind ? HK.kinds[walkKind] : E.sports[info.sport]}${
          sacGrade !== null && isHikeKind(walkKind) ? ` · ${HK.sacValue(sacGrade)}` : ''
        } · ${formatDateDe(day)}${watch ? ` · ${WR.heroSource}` : ''}${
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
      {/* Wandern/Bergwandern (Etappe W): Hinweise zur Tour (Höhe, Abstieg, Schon-Modus) – nie blockierend. */}
      {walkKind ? (
        <HikingSafetyCard
          phase="after"
          walkKind={walkKind}
          maxAltitudeM={maxAltM}
          elevationLossM={lossM}
          sacGrade={sacGrade}
          testID="route-hiking-safety"
        />
      ) : null}
      {/* Schuh-Kilometerzähler (docs/PLAN-PHASE-10.md 22): „Schuh: … (… km)“, Tippen ändert. */}
      <ShoeChip routeId={info.id} />
      {pending ? (
        <Notice tone={pending.state === 'rejected' ? 'warning' : 'info'}>
          {pending.state === 'rejected' ? E.list.rejectedHint : E.save.queued}
        </Notice>
      ) : null}

      {/* Wetter zum Start (25.10.2026, Open-Meteo, nur nach Zustimmung). */}
      {saved ? <RouteWeatherSection route={saved} /> : null}
      {/* „Meine Strecken“ (25.10.2026): Vorschlag „Gleiche Strecke wie …“, Zuordnung, „Zum letzten Mal“. */}
      {saved ? (
        <RouteMatchSection
          route={saved}
          routes={result.routes}
          onChanged={onRoutesChanged}
          onOpenRoute={(favoriteId) => router.push(`/ausdauer/strecke/${favoriteId}` as Href)}
          onAnnounce={onAnnounce}
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
          <PulseZonesDetail summary={heart} externalId={wearableSession?.external_id ?? null} />
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
          {showKcal ? (
            <SessionKcalStat
              input={{
                kind: 'endurance',
                enduranceModality: info.sport,
                effortTarget: null,
                durationS: info.moving_s,
                eBike,
                walkKind,
              }}
              logId={info.session_log_id}
            />
          ) : null}
          {walkKind && lossM !== null ? (
            <View style={styles.statCell}>
              <StatValue
                size="lg"
                label={HK.descent}
                value={HK.approx(lossM)}
                valueTestID="route-descent"
              />
            </View>
          ) : null}
          {walkKind && maxAltM !== null ? (
            <View style={styles.statCell}>
              <StatValue
                size="lg"
                label={HK.highest}
                value={HK.approx(maxAltM)}
                valueTestID="route-highest"
              />
            </View>
          ) : null}
          {walkTime ? (
            <View style={styles.statCell}>
              <StatValue
                size="lg"
                label={HK.timeLabel}
                value={HK.timeValue(walkTime.minutes)}
                valueTestID="route-walk-time"
              />
            </View>
          ) : null}
          {gap ? (
            <View style={styles.statCell}>
              <StatValue
                size="lg"
                label={RN.gap.label}
                value={paceText(gap.gapS)}
                valueTestID="route-gap"
              />
            </View>
          ) : null}
          {cadence !== null && cadenceSport ? (
            <View style={styles.statCell}>
              <StatValue
                size="lg"
                label={RN.cadence.label}
                value={RN.cadence.value(cadence)}
                valueTestID="route-cadence"
              />
            </View>
          ) : null}
        </View>
        {gap ? <Body muted>{RN.gap.explain}</Body> : null}
        {walkTime ? (
          <Body muted testID="route-walk-time-note">
            {walkTime.withoutElevation ? `${HK.timeNote} ${HK.timeNoElevation}` : HK.timeNote}
          </Body>
        ) : null}
        {cadence !== null && cadenceSport ? (
          <Body muted testID="route-cadence-hint">
            {cadenceHintKey
              ? `${RN.cadence.hints[cadenceHintKey]} ${RN.cadence.source}`
              : RN.cadence.source}
          </Body>
        ) : null}
      </Card>

      {/* Phase 8: Puls der Uhr, wenn die Aufzeichnung mit einer Uhr-Einheit zusammengeführt wurde. */}
      {info.session_log_id ? (
        <WearableLogInfo logId={info.session_log_id} compact={watch || heart !== null} />
      ) : null}

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
    </>
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

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  statCell: { width: '50%', paddingRight: spacing.sm },
});
