import {
  type LatLng,
  LOOP_ROUTE,
  LOOP_SURFACES,
  type LoopResponse,
  type LoopRoute,
  type LoopSurface,
  decodePolyline,
  loopDistanceFit,
} from '@fitnessapp/core';
import { spacing } from '@fitnessapp/ui';
import { Redirect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { LiveRegion } from '@/components/calendar';
import { AreaButton } from '@/components/design';
import { RouteSketch } from '@/components/endurance';
import { LoopMap } from '@/components/loop-map';
import { Screen } from '@/components/screen';
import {
  Body,
  Button,
  Card,
  ChoiceList,
  Heading,
  LoadingState,
  Notice,
  TextField,
} from '@/components/ui';
import { BackendError } from '@/data/backend';
import { newId } from '@/data/create-backend';
import { t } from '@/i18n';
import { currentPosition } from '@/lib/current-position';
import { setLoopGuide } from '@/lib/loop-guide';
import { LOOP_COLORS, type LoopMapLine } from '@/lib/loop-map-html';
import { LOOP_NAME_MAX, loopStore, type SavedLoop, toSavedLoop } from '@/lib/loop-store';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';

const L = t.loop;

/** Beispiel-Start im Testmodus: Rheinpark Köln (öffentlicher Ort, keine Nutzerdaten). */
const DEMO_START: LatLng = { lat: 50.9468, lng: 6.9772 };

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; routes: LoopRoute[]; distanceKm: number }
  | { kind: 'empty' }
  | { kind: 'error'; text: string };

function responseText(code: Exclude<LoopResponse['code'], 'ok' | 'no_routes'>): string {
  switch (code) {
    case 'not_configured':
    case 'forbidden_origin':
      return L.notConfigured;
    case 'rate_limited':
      return L.rateLimited;
    case 'unavailable':
      return L.unavailable;
    default:
      return L.failed;
  }
}

/**
 * Rundkurs-Vorschlag (Gründer-Freigabe 25.10.2026, docs/PLAN-RUNDKURS.md): Distanz (3–30 km) und Untergrund wählen,
 * Start = eigener Standort (einmalig, nur auf Tipp) oder ein Tipp auf die Karte; die App schlägt 2–3 Runden auf
 * OpenStreetMap-Wegen vor (Karte, Distanz, Höhenmeter, Untergrund). „Diese Runde laufen“ startet die Aufzeichnung mit
 * der Runde als Leitlinie; „Als Meine Strecke merken“ legt sie auf diesem Gerät ab. Regeln in packages/core
 * (routes/loop.ts), Routing über apps/web (Schlüssel nur dort).
 */
export default function LoopScreen() {
  const router = useRouter();
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const [distanceKm, setDistanceKm] = useState<number>(5);
  const [surface, setSurface] = useState<LoopSurface>('any');
  const [start, setStart] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [variant, setVariant] = useState(0);
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [selected, setSelected] = useState(0);
  const [naming, setNaming] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLoop[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [live, setLive] = useState({ text: '', version: 0 });

  const announce = (text: string) => setLive((c) => ({ text, version: c.version + 1 }));

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void loopStore
      .list(userId)
      .then((loops) => {
        if (alive) setSaved(loops);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [userId]);

  const routes = useMemo(() => (result.kind === 'ok' ? result.routes : []), [result]);
  const lines: LoopMapLine[] = useMemo(
    () =>
      routes.map((r, i) => ({
        points: decodePolyline(r.polyline) ?? [],
        color: LOOP_COLORS[i % LOOP_COLORS.length] as string,
      })),
    [routes],
  );

  const resetResults = () => {
    setResult({ kind: 'idle' });
    setVariant(0);
    setSelected(0);
    setNaming(null);
    setMessage(null);
  };

  const pick = useCallback((point: LatLng) => {
    setStart(point);
    setStartNotice(null);
    setResult({ kind: 'idle' });
    setVariant(0);
    setNaming(null);
  }, []);

  if (app.status.kind === 'loading') {
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
  if (entry !== HOME_ROUTE || !app.rows || !app.session || !userId) {
    return <Redirect href={entry as Href} />;
  }
  const testMode = app.backend.mode === 'local';
  const isWeb = Platform.OS === 'web';
  const canRun = !isWeb || testMode;

  async function locate() {
    setLocating(true);
    setStartNotice(null);
    const pos = await currentPosition();
    setLocating(false);
    if (pos.kind === 'ok') {
      pick(pos.point);
      announce(L.startSet);
    } else {
      setStartNotice(pos.kind === 'denied' ? L.locationDenied : L.locationUnavailable);
    }
  }

  async function suggest(nextVariant: number) {
    if (!start) {
      setStartNotice(L.startMissing);
      return;
    }
    setVariant(nextVariant);
    setSelected(0);
    setNaming(null);
    setMessage(null);
    setResult({ kind: 'loading' });
    announce(L.searching);
    try {
      const plan = app.backend.planLoopRoutes;
      const response: LoopResponse = plan
        ? await plan({
            lat: start.lat,
            lng: start.lng,
            distance_km: distanceKm,
            surface,
            variant: nextVariant,
          })
        : { code: 'not_configured' };
      if (response.code === 'ok') {
        setResult({ kind: 'ok', routes: response.routes, distanceKm });
        announce(`${L.results}: ${response.routes.length}`);
      } else if (response.code === 'no_routes') {
        setResult({ kind: 'empty' });
        announce(L.empty);
      } else {
        setResult({ kind: 'error', text: responseText(response.code) });
      }
    } catch (error) {
      setResult({
        kind: 'error',
        text: error instanceof BackendError && error.code === 'network' ? L.offline : L.failed,
      });
    }
  }

  function runLoop(name: string, polyline: string, distanceM: number) {
    const points = decodePolyline(polyline);
    if (!points) return;
    const id = newId();
    setLoopGuide({ id, name, points, distanceM });
    router.push(
      `/ausdauer/aufzeichnen?sport=run&guide=${id}${isWeb && testMode ? '&demo=1' : ''}` as Href,
    );
  }

  async function saveLoop(route: LoopRoute, name: string) {
    if (!userId) return;
    try {
      const next = await loopStore.save(
        userId,
        toSavedLoop(
          route,
          name,
          `loop-${newId().toLowerCase()}`.slice(0, 60),
          new Date().toISOString(),
        ),
      );
      setSaved(next);
      setNaming(null);
      setMessage(L.saved);
      announce(L.saved);
    } catch {
      setMessage(L.failed);
    }
  }

  async function removeSaved(id: string) {
    if (!userId) return;
    try {
      setSaved(await loopStore.remove(userId, id));
    } catch {
      setMessage(L.failed);
    }
  }

  const current = routes[selected] ?? null;

  return (
    <Screen area="ausdauer" icon="map" title={L.title} testID="loop">
      <LiveRegion text={live.text} version={live.version} />
      <Body>{L.intro}</Body>
      {testMode ? (
        <Notice tone="info" testID="loop-mock-hint">
          {L.mockHint}
        </Notice>
      ) : null}

      <Card>
        <View style={styles.section}>
          <ChoiceList<number>
            label={L.distance}
            options={LOOP_ROUTE.distanceOptionsKm.map((n) => ({
              value: n,
              label: L.distanceOption(n),
              accessibilityLabel: L.distanceA11y(n),
              testID: `loop-distance-${n}`,
            }))}
            value={distanceKm}
            onChange={(n) => {
              setDistanceKm(n);
              resetResults();
            }}
            horizontal
          />
          <ChoiceList<LoopSurface>
            label={L.surface}
            options={LOOP_SURFACES.map((s) => ({
              value: s,
              label: L.surfaces[s],
              testID: `loop-surface-${s}`,
            }))}
            value={surface}
            onChange={(s) => {
              setSurface(s);
              resetResults();
            }}
            horizontal
          />
        </View>
      </Card>

      <Card>
        <View style={styles.section}>
          <Heading level={2}>{L.start}</Heading>
          <Button
            label={locating ? L.locating : L.useLocation}
            icon="map"
            variant="secondary"
            loading={locating}
            onPress={() => void locate()}
            testID="loop-locate"
          />
          {testMode ? (
            <Button
              label={L.demoStart}
              variant="secondary"
              onPress={() => {
                pick(DEMO_START);
                announce(L.startSet);
              }}
              testID="loop-demo-start"
            />
          ) : null}
          <Body muted>{L.pickOnMap}</Body>
          {startNotice ? (
            <Notice tone="warning" testID="loop-start-notice">
              {startNotice}
            </Notice>
          ) : null}
        </View>
      </Card>

      {start || lines.length > 0 ? (
        <LoopMap lines={lines} selected={current ? selected : null} start={start} onPick={pick} />
      ) : null}

      <AreaButton
        area="ausdauer"
        icon="flag"
        label={L.suggest}
        onPress={() => void suggest(0)}
        disabled={result.kind === 'loading'}
        testID="loop-suggest"
      />
      <Body muted style={styles.small} testID="loop-privacy">
        {L.privacy}
      </Body>

      {result.kind === 'loading' ? <LoadingState label={L.searching} /> : null}
      {result.kind === 'empty' ? (
        <Notice tone="info" testID="loop-empty">
          {L.empty}
        </Notice>
      ) : null}
      {result.kind === 'error' ? (
        <Notice tone="warning" testID="loop-error">
          <Body>{result.text}</Body>
          <Button
            label={L.retry}
            variant="secondary"
            onPress={() => void suggest(variant)}
            testID="loop-retry"
          />
        </Notice>
      ) : null}

      {result.kind === 'ok' ? (
        <Card>
          <View style={styles.section} testID="loop-results">
            <Heading level={2}>{L.results}</Heading>
            <ChoiceList<number>
              groupLabel={L.results}
              options={result.routes.map((r, i) => {
                const fit = loopDistanceFit(r.distance_m, result.distanceKm);
                const details = (ascent: string) =>
                  [
                    L.distanceValue(r.distance_m),
                    ascent,
                    r.surface ? L.surfaceShare(r.surface.paved, r.surface.unpaved) : null,
                    fit === 'longer' ? L.longer : fit === 'shorter' ? L.shorter : null,
                    r.overlap >= 0.15 ? L.overlapHint : null,
                  ].filter((x): x is string => x !== null);
                return {
                  value: i,
                  label: L.loopName(i),
                  description: details(
                    r.ascent_m !== null ? L.ascent(r.ascent_m) : L.ascentUnknown,
                  ).join(' · '),
                  accessibilityLabel: `${L.loopName(i)}: ${details(
                    r.ascent_m !== null ? L.ascentA11y(r.ascent_m) : L.ascentUnknown,
                  ).join(', ')}`,
                  testID: `loop-option-${i}`,
                };
              })}
              value={selected}
              onChange={(i) => {
                setSelected(i);
                setNaming(null);
              }}
            />
            {current ? (
              <>
                {canRun ? (
                  <AreaButton
                    area="ausdauer"
                    icon="play"
                    label={L.run}
                    onPress={() =>
                      runLoop(
                        L.defaultSaveName(result.distanceKm),
                        current.polyline,
                        current.distance_m,
                      )
                    }
                    testID="loop-run"
                  />
                ) : null}
                {canRun ? <Body muted>{L.runHint}</Body> : null}
                {naming === null ? (
                  <Button
                    label={L.save}
                    variant="secondary"
                    onPress={() => setNaming(L.defaultSaveName(result.distanceKm))}
                    testID="loop-save"
                  />
                ) : (
                  <View style={styles.section}>
                    <TextField
                      label={L.saveName}
                      value={naming}
                      onChangeText={setNaming}
                      maxLength={LOOP_NAME_MAX}
                      testID="loop-save-name"
                    />
                    <View style={styles.row}>
                      <Button
                        label={L.saveCancel}
                        variant="secondary"
                        onPress={() => setNaming(null)}
                      />
                      <Button
                        label={L.saveConfirm}
                        disabled={naming.trim() === ''}
                        onPress={() => void saveLoop(current, naming)}
                        testID="loop-save-confirm"
                      />
                    </View>
                  </View>
                )}
                <Button
                  label={L.more}
                  variant="secondary"
                  disabled={variant >= LOOP_ROUTE.variantMax}
                  onPress={() => void suggest(variant + 1)}
                  testID="loop-more"
                />
              </>
            ) : null}
          </View>
        </Card>
      ) : null}
      {message ? (
        <Notice tone="success" testID="loop-message">
          {message}
        </Notice>
      ) : null}

      <Heading level={2}>{L.savedTitle}</Heading>
      <Body muted>{L.savedDeviceOnly}</Body>
      {saved.length === 0 ? (
        <Body testID="loop-saved-empty">{L.savedEmpty}</Body>
      ) : (
        <View style={styles.section} testID="loop-saved">
          {saved.map((loop) => (
            <Card key={loop.id}>
              <View style={styles.savedRow}>
                <RouteSketch points={decodePolyline(loop.polyline) ?? []} width={72} height={52} />
                <View style={styles.savedText}>
                  <Body>{loop.name}</Body>
                  <Body muted>
                    {[
                      L.distanceValue(loop.distance_m),
                      loop.ascent_m !== null ? L.ascent(loop.ascent_m) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Body>
                </View>
              </View>
              <View style={styles.row}>
                {canRun ? (
                  <Button
                    label={L.savedRun}
                    accessibilityLabel={L.savedRunA11y(loop.name)}
                    onPress={() => runLoop(loop.name, loop.polyline, loop.distance_m)}
                  />
                ) : null}
                <Button
                  label={L.savedDelete}
                  variant="secondary"
                  accessibilityLabel={L.savedDeleteA11y(loop.name)}
                  onPress={() => void removeSaved(loop.id)}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  savedRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  savedText: { flex: 1, gap: 2 },
  small: { fontSize: 12 },
});
