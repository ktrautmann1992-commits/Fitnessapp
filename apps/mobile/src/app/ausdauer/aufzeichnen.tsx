import {
  averagePaceOrSpeedText,
  distanceText,
  durationText,
  gpsSignal,
  isoDateInTimeZone,
  recordingElapsedS,
  recordingLimitReached,
  recordingLiveStats,
  recordingPointCount,
  recordingSaveCheck,
  recordingSummary,
  ROUTE_DIFFICULTIES,
  type RouteDifficulty,
  toTrackedRoutePayload,
  TRACKED_ROUTE_LIMITS,
  TRACKED_ROUTE_SPORTS,
  type TrackedRouteSport,
  usesSpeed,
} from '@fitnessapp/core';
import {
  areaColors,
  brandColors,
  fontSize,
  fontWeight,
  heroColors,
  radius,
  spacing,
} from '@fitnessapp/ui';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AreaButton, Icon } from '@/components/design';
import { BikeTypeChoice, EBikeBadge, useBikeChoice } from '@/components/e-bike';
import { RouteSketch } from '@/components/endurance';
import { LoopGuideCard } from '@/components/loop-guide-card';
import { ConfirmDialog, Screen } from '@/components/screen';
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
import { newId } from '@/data/create-backend';
import { plannedCandidate, recordingDiaryDraft } from '@/data/route-diary';
import { t } from '@/i18n';
import { errorText } from '@/lib/error-text';
import { berlinTodayIso, formatDateDe } from '@/lib/format';
import { useScreenAwake } from '@/lib/keep-awake';
import { locationDriver, type LocationPermission } from '@/lib/location-driver';
import { loopGuideFor } from '@/lib/loop-guide';
import {
  beginRecording,
  endRecording,
  pauseActiveRecording,
  resumeActiveRecording,
  stopActiveRecording,
} from '@/lib/recording-controller';
import { recordingSession, useRecordingSession } from '@/lib/recording-session';
import { appFont, displayFont } from '@/lib/fonts';
import { useColorSchemeName } from '@/lib/theme';
import { useApp } from '@/state/app-state';
import { HOME_ROUTE, resolveEntryRoute } from '@/state/flow';
import { forgetTrackedRoutes } from '@/state/use-tracked-routes';
import { Text } from '@/components/text';

const E = t.endurance;

type Phase =
  | { kind: 'checking' }
  | { kind: 'explain' }
  | { kind: 'blocked'; reason: 'blocked' | 'services_off' | 'unsupported' | 'start_failed' }
  | { kind: 'live' }
  | { kind: 'save' };

/** Ab so vielen Rohpunkten (ca. 1,5 h) rechnet die Live-Anzeige Distanz/Pace nur noch alle 5 s. */
const LONG_RECORDING_POINTS = 3_000;

const isSport = (value: unknown): value is TrackedRouteSport =>
  typeof value === 'string' && (TRACKED_ROUTE_SPORTS as readonly string[]).includes(value);

/**
 * Aufzeichnen (Etappe E4, Plan S1 „App“): eigener Erklär-Bildschirm VOR der Systemabfrage, große Zahlen (Zeit,
 * Distanz, Ø-Pace bzw. km/h), Pause/Fortsetzen/Stopp, Zustände (keine Berechtigung → Einstellungen, GPS schwach,
 * zu kurz), danach Speichern (Name, Favorit, Schwierigkeit, Notiz, Tagebuch-Frage). Der Standort läuft nur während
 * der Aufzeichnung. Im Browser nur die Demo im Testmodus.
 */
export default function RecordScreen() {
  const params = useLocalSearchParams<{
    sport?: string;
    demo?: string;
    base?: string;
    step?: string;
    /** E-Bike-Wahl vom Start („1“/„0“); fehlt (z. B. nach Absturz) → zuletzt genutzte Wahl dieses Geräts. */
    ebike?: string;
    /** Rundkurs-Vorschlag: id der Leitlinie (lib/loop-guide.ts) – Karte mit der Runde beim Laufen. */
    guide?: string;
  }>();
  const router = useRouter();
  const app = useApp();
  const scheme = useColorSchemeName();
  const hero = heroColors[scheme];
  // Ausdauer-Orange auf der dunklen Fläche: Dunkel-Fassung von `icon` (≥ 8 : 1), nie Signal-Orange.
  const orangeOnDark = areaColors.dark.ausdauer.icon;
  const current = useRecordingSession();
  const userId = app.session?.userId ?? null;
  const [rawPhase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [now, setNow] = useState(() => recordingSession.now());
  const [confirmStop, setConfirmStop] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const started = useRef(false);

  const sport: TrackedRouteSport =
    current?.state.sport ?? (isSport(params.sport) ? params.sport : 'run');
  const demo = params.demo === '1';
  const eBikeParam = params.ebike === '1' ? true : params.ebike === '0' ? false : null;
  // Laufende (bzw. wiederhergestellte) Aufzeichnung dieses Kontos: direkt Live-Ansicht bzw. Speichern zeigen.
  const owned = current && userId && current.state.ownerUserId === userId ? current : null;
  const phase: Phase =
    rawPhase.kind === 'checking' && owned
      ? owned.state.status === 'stopped' || params.step === 'save'
        ? { kind: 'save' }
        : { kind: 'live' }
      : rawPhase;

  // Einstieg: laufende Aufzeichnung übernehmen, sonst Berechtigung prüfen bzw. Demo starten.
  useEffect(() => {
    if (started.current || !userId) return;
    started.current = true;
    const existing = recordingSession.get();
    if (existing && existing.state.ownerUserId === userId) return;
    if (existing) void endRecording();
    if (!isSport(params.sport)) {
      router.replace('/ausdauer' as Href);
      return;
    }
    const startWith = async (mode: 'gps' | 'demo') => {
      try {
        await beginRecording({
          backend: app.backend,
          sport: params.sport as TrackedRouteSport,
          ownerUserId: userId,
          baseRouteId: typeof params.base === 'string' && params.base !== '' ? params.base : null,
          mode,
        });
        setPhase({ kind: 'live' });
      } catch {
        setPhase({ kind: 'blocked', reason: 'start_failed' });
      }
    };
    if (demo && app.backend.mode === 'local') {
      void startWith('demo');
      return;
    }
    void locationDriver.check().then((permission: LocationPermission) => {
      if (permission === 'granted') void startWith('gps');
      else if (permission === 'undetermined' || permission === 'denied')
        setPhase({ kind: 'explain' });
      else setPhase({ kind: 'blocked', reason: permission });
    });
  }, [app.backend, demo, params.base, params.sport, params.step, router, userId]);

  // Uhr für die großen Zahlen (1 s) und Grenze 12 h.
  useEffect(() => {
    if (phase.kind !== 'live') return;
    const timer = setInterval(() => {
      const value = recordingSession.now();
      setNow(value);
      const state = recordingSession.get()?.state;
      if (state && state.status === 'recording' && recordingLimitReached(state, value)) {
        void stopActiveRecording().then(() => {
          setLimitNotice(true);
          setPhase({ kind: 'save' });
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase.kind]);

  useScreenAwake(
    phase.kind === 'live' && current?.state.status === 'recording',
    'alpha5-recording',
  );

  // Distanz/Pace über alle Punkte: bei langen Aufzeichnungen nur alle 5 s neu rechnen (Akku); die Zeit läuft je Sekunde.
  const pointCount = current ? recordingPointCount(current.state) : 0;
  const statsKey = pointCount > LONG_RECORDING_POINTS ? Math.floor(now / 5000) : now;
  const stats = useMemo(
    () => (current ? recordingLiveStats(current.state, now) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bewusst gedrosselt über statsKey
    [current?.state.id, current?.state.status, statsKey],
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

  const back = () => (router.canGoBack() ? router.back() : router.replace('/ausdauer' as Href));

  async function askPermission() {
    setBusy(true);
    const result = await locationDriver.request().catch(() => 'denied' as const);
    setBusy(false);
    if (result !== 'granted') {
      setPhase({ kind: 'blocked', reason: result === 'services_off' ? 'services_off' : 'blocked' });
      return;
    }
    try {
      await beginRecording({
        backend: app.backend,
        sport,
        ownerUserId: app.session?.userId ?? '',
        baseRouteId: typeof params.base === 'string' && params.base !== '' ? params.base : null,
        mode: 'gps',
      });
      setPhase({ kind: 'live' });
    } catch {
      setPhase({ kind: 'blocked', reason: 'start_failed' });
    }
  }

  async function recheck() {
    const permission = await locationDriver.check();
    if (permission === 'granted') {
      started.current = false;
      setPhase({ kind: 'checking' });
      try {
        await beginRecording({
          backend: app.backend,
          sport,
          ownerUserId: app.session?.userId ?? '',
          baseRouteId: null,
          mode: 'gps',
        });
        started.current = true;
        setPhase({ kind: 'live' });
      } catch {
        setPhase({ kind: 'blocked', reason: 'start_failed' });
      }
    } else if (permission === 'undetermined' || permission === 'denied') {
      setPhase({ kind: 'explain' });
    } else {
      setPhase({ kind: 'blocked', reason: permission });
    }
  }

  // --- Erklär-Bildschirm vor der Systemabfrage ---------------------------------------------------------------
  if (phase.kind === 'checking') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (phase.kind === 'explain') {
    return (
      <Screen area="ausdauer" icon="run" title={E.explain.title} testID="record-explain">
        <Body>{E.explain.text}</Body>
        <Body>{E.explain.background}</Body>
        <Notice tone="info">{E.explain.battery}</Notice>
        <Button
          label={E.explain.continue}
          loading={busy}
          onPress={() => void askPermission()}
          testID="record-explain-continue"
        />
        <Button label={E.explain.cancel} variant="secondary" onPress={back} />
      </Screen>
    );
  }
  if (phase.kind === 'blocked') {
    const text =
      phase.reason === 'services_off'
        ? E.permission.servicesOff
        : phase.reason === 'unsupported'
          ? E.record.webHint
          : phase.reason === 'start_failed'
            ? E.permission.startFailed
            : E.permission.denied;
    return (
      <Screen area="ausdauer" icon="run" title={E.permission.deniedTitle} testID="record-blocked">
        <Notice tone="warning">{text}</Notice>
        {phase.reason === 'blocked' || phase.reason === 'services_off' ? (
          <Button
            label={E.permission.openSettings}
            onPress={() => void locationDriver.openSettings()}
            testID="record-open-settings"
          />
        ) : null}
        {phase.reason !== 'unsupported' ? (
          <Button label={E.permission.retry} variant="secondary" onPress={() => void recheck()} />
        ) : null}
        <Button label={E.explain.cancel} variant="secondary" onPress={back} />
      </Screen>
    );
  }

  if (!current) {
    return <Redirect href={'/ausdauer' as Href} />;
  }

  // --- Speichern ---------------------------------------------------------------------------------------------
  if (phase.kind === 'save') {
    return (
      <SaveView
        onSaved={(id) => router.replace(`/ausdauer/${id}` as Href)}
        onDiscarded={() => router.replace('/ausdauer' as Href)}
        initialEBike={eBikeParam}
        loopName={loopGuideFor(params.guide)?.name ?? null}
        onResume={async () => {
          try {
            await resumeActiveRecording();
            setPhase({ kind: 'live' });
          } catch {
            setError(E.permission.startFailed);
          }
        }}
        limitNotice={limitNotice}
      />
    );
  }

  // --- Live ---------------------------------------------------------------------------------------------------
  const status = current.state.status;
  const signal = gpsSignal(current.state, now);
  const speedMode = usesSpeed(sport);
  const paceText = stats ? averagePaceOrSpeedText(sport, stats.movingS, stats.distanceM) : '–';
  const time = durationText(recordingElapsedS(current.state, now));
  const distance = stats ? distanceText(stats.distanceM) : '0,00 km';
  return (
    <Screen
      area="ausdauer"
      icon="run"
      title={E.live.title(
        sport === 'bike' && eBikeParam === true ? E.eBike.sport : E.sports[sport],
      )}
      testID="record-live"
    >
      {current.mode === 'demo' ? <Notice tone="info">{E.live.demo}</Notice> : null}
      {status === 'recording' && signal !== 'ok' ? (
        <Notice tone="warning" testID={`record-gps-${signal}`}>
          {signal === 'searching' ? E.live.searching : E.live.weak}
        </Notice>
      ) : null}
      {/* Große Zahlen im Hero-Stil: dunkle Fläche, Zeit am größten, darunter Distanz und Pace. */}
      <View style={[styles.panel, { backgroundColor: hero.background, borderColor: hero.border }]}>
        <View style={styles.statusRow}>
          <Icon
            name={status === 'paused' ? 'pause' : 'run'}
            size={16}
            color={status === 'paused' ? brandColors.signal : orangeOnDark}
          />
          <Text
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            style={[
              styles.status,
              appFont('bold'),
              { color: status === 'paused' ? brandColors.signal : orangeOnDark },
            ]}
            testID="record-status"
          >
            {status === 'paused' ? E.live.paused : E.live.running}
          </Text>
        </View>
        <View
          style={styles.big}
          accessible
          accessibilityLabel={E.live.a11yStats(time, distance, paceText)}
        >
          <BigValue label={E.live.time} value={time} testID="record-time" size="xl" />
          <View style={styles.bigRow}>
            <BigValue label={E.live.distance} value={distance} testID="record-distance" />
            <BigValue
              label={speedMode ? E.live.speed : E.live.pace}
              value={paceText}
              testID="record-pace"
            />
          </View>
        </View>
      </View>
      <FieldError message={error} />
      {status === 'recording' ? (
        <AreaButton
          area="ausdauer"
          icon="pause"
          label={E.live.pause}
          onPress={() => void pauseActiveRecording()}
          testID="record-pause"
        />
      ) : (
        <AreaButton
          area="ausdauer"
          icon="play"
          label={E.live.resume}
          onPress={() =>
            void resumeActiveRecording().catch(() => setError(E.permission.startFailed))
          }
          testID="record-resume"
        />
      )}
      <AreaButton
        area="ausdauer"
        icon="stop"
        variant="outline"
        label={E.live.stop}
        onPress={() => setConfirmStop(true)}
        testID="record-stop"
      />
      <LoopGuideCard guideId={params.guide} distanceM={stats?.distanceM ?? 0} />
      <ConfirmDialog
        visible={confirmStop}
        title={E.live.stopConfirm}
        message={`${time} · ${distance}`}
        confirmLabel={E.live.stopYes}
        confirmVariant="primary"
        onConfirm={() => {
          setConfirmStop(false);
          void stopActiveRecording().then(() => setPhase({ kind: 'save' }));
        }}
        onCancel={() => setConfirmStop(false)}
        testID="record-stop-dialog"
      />
    </Screen>
  );
}

function BigValue({
  label,
  value,
  testID,
  size = 'lg',
}: {
  label: string;
  value: string;
  testID: string;
  /** xl = Zeit (größte Zahl), lg = Distanz und Pace. */
  size?: 'xl' | 'lg';
}) {
  const hero = heroColors[useColorSchemeName()];
  return (
    <View style={[styles.bigItem, size === 'lg' && styles.bigHalf]}>
      <Text style={[styles.bigLabel, appFont('semibold'), { color: hero.muted }]}>{label}</Text>
      <Text
        style={[
          size === 'xl' ? styles.bigValueXl : styles.bigValue,
          displayFont(),
          { color: hero.text },
        ]}
        testID={testID}
      >
        {value}
      </Text>
    </View>
  );
}

/** Speichern: Name, Favorit, Schwierigkeit, Notiz, Tagebuch-Frage; „zu kurz“ und „unter 100 m“ fragen nach. */
function SaveView({
  onSaved,
  onDiscarded,
  onResume,
  limitNotice,
  initialEBike,
  loopName = null,
}: {
  onSaved: (id: string) => void;
  onDiscarded: () => void;
  onResume: () => Promise<void>;
  limitNotice: boolean;
  /** Wahl beim Start; null = zuletzt genutzte Wahl dieses Geräts (sonst Fahrrad). */
  initialEBike: boolean | null;
  /** Gelaufene Runde aus dem Rundkurs-Vorschlag: Name vorbelegt, als „Meine Strecke“ (Favorit) vorgeschlagen. */
  loopName?: string | null;
}) {
  const app = useApp();
  const current = useRecordingSession();
  const today = berlinTodayIso();
  const summary = useMemo(() => (current ? recordingSummary(current.state) : null), [current]);
  const check = summary ? recordingSaveCheck(summary) : 'too_short';
  const startDay = summary?.startedAt ? isoDateInTimeZone(summary.startedAt) : today;
  const sport = current?.state.sport ?? 'run';
  const [name, setName] = useState(
    () => loopName ?? E.save.defaultName(E.sportNouns[sport], formatDateDe(startDay)),
  );
  const [favorite, setFavorite] = useState(loopName !== null);
  const [difficulty, setDifficulty] = useState<RouteDifficulty | 'none'>('none');
  const [note, setNote] = useState('');
  // E-Bike (nur beim Rad): Wahl beim Start, sonst die zuletzt genutzte; hier noch änderbar.
  const bikeChoice = useBikeChoice(app.session?.userId ?? null);
  const [eBikePicked, setEBikePicked] = useState<boolean | null>(initialEBike);
  const eBike = sport === 'bike' && (eBikePicked ?? bikeChoice.eBike ?? false);
  const planned = useMemo(
    () => (app.rows && summary ? plannedCandidate(app.rows, summary, today) : null),
    [app.rows, summary, today],
  );
  const [countPlanned, setCountPlanned] = useState(true);
  const [confirmShort, setConfirmShort] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [diaryFailed, setDiaryFailed] = useState(false);

  if (!current || !summary || !app.rows || !app.session) return null;
  const rows = app.rows;
  const ownerUserId = app.session.userId;
  const points = summary.points;

  async function save(force = false) {
    if (!current || !summary) return;
    if (check === 'short_distance' && !force) {
      setConfirmShort(true);
      return;
    }
    setConfirmShort(false);
    setBusy(true);
    setError(undefined);
    try {
      // 1. Tagebuch-Eintrag (einmal; schon angelegt → id aus der Sicherung, nie doppelt).
      let logId = current.diaryLogId;
      if (logId === null && check === 'ok') {
        const draft = recordingDiaryDraft(rows, summary, {
          plannedSessionId: planned && countPlanned ? planned.id : null,
          ownerUserId,
          today,
          now: new Date().toISOString(),
          newId,
          eBike,
        });
        if (draft) {
          const outcome = await app.submitWorkout(draft);
          if (outcome.kind === 'saved' || outcome.kind === 'queued') {
            logId = draft.logId;
            await recordingSession.setDiaryLogId(draft.logId);
          } else {
            // Abgelehnt/Konflikt: liegt als Entwurf vor – Strecke trotzdem speichern (ohne Verweis).
            setDiaryFailed(true);
          }
        }
      }
      // 2. Strecke (Zod an der Grenze).
      const payload = toTrackedRoutePayload(summary, {
        id: current.state.id,
        name: name.trim(),
        difficulty: difficulty === 'none' ? null : difficulty,
        isFavorite: favorite,
        note: note.trim() === '' ? null : note.trim(),
        baseRouteId: current.state.baseRouteId,
        sessionLogId: logId,
        source: 'recorded',
        eBike,
      });
      if (!payload) {
        setError(name.trim() === '' ? E.save.nameHint : E.save.invalid);
        return;
      }
      await app.backend.saveTrackedRoute(payload);
      if (sport === 'bike') bikeChoice.remember(eBike);
      await endRecording();
      forgetTrackedRoutes();
      // Wächter S1 N2: save_tracked_route erhöht die Revision des Eintrags → neu laden.
      await app.reload().catch(() => undefined);
      onSaved(payload.id);
    } catch (caught) {
      setError(errorText(caught) || E.save.failed);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setConfirmDiscard(false);
    await endRecording();
    onDiscarded();
  }

  return (
    <Screen area="ausdauer" icon="run" title={E.save.title} testID="record-save">
      {limitNotice ? <Notice tone="info">{E.live.limit}</Notice> : null}
      <Card>
        <View style={styles.summaryRow}>
          <RouteSketch points={points} width={120} height={80} testID="record-save-sketch" />
          <View style={styles.summaryText}>
            <Body testID="record-save-distance">{distanceText(summary.distanceM)}</Body>
            <Body>{durationText(summary.durationS)}</Body>
            <Body muted>{averagePaceOrSpeedText(sport, summary.movingS, summary.distanceM)}</Body>
            {eBike ? <EBikeBadge testID="record-save-e-bike" /> : null}
          </View>
        </View>
      </Card>
      {summary.speedWarning ? <Notice tone="warning">{E.save.speedWarning}</Notice> : null}
      {check === 'too_short' ? (
        <>
          <Notice tone="warning" testID="record-too-short">
            {E.save.tooShort}
          </Notice>
          {current.mode === 'gps' ? (
            <Button label={E.live.resume} onPress={() => void onResume()} />
          ) : null}
          <Button
            label={E.save.discard}
            variant="danger"
            onPress={() => void discard()}
            testID="record-discard"
          />
        </>
      ) : (
        <>
          <TextField
            label={E.save.name}
            hint={E.save.nameHint}
            value={name}
            onChangeText={setName}
            maxLength={TRACKED_ROUTE_LIMITS.nameMaxLength}
            testID="record-name"
          />
          {sport === 'bike' ? (
            <BikeTypeChoice eBike={eBike} onChange={setEBikePicked} testID="record-bike-type" />
          ) : null}
          <Checkbox
            label={E.save.favorite}
            checked={favorite}
            onChange={setFavorite}
            testID="record-favorite"
          />
          <Body muted>{E.save.favoriteHint}</Body>
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
            testID="record-note"
          />
          {check === 'ok' && current.diaryLogId === null ? (
            planned ? (
              <ChoiceList<'yes' | 'no'>
                label={E.save.diaryPlanned(planned.name_de)}
                options={[
                  { value: 'yes', label: E.save.diaryYes },
                  { value: 'no', label: E.save.diaryNo },
                ]}
                value={countPlanned ? 'yes' : 'no'}
                onChange={(value) => setCountPlanned(value === 'yes')}
              />
            ) : (
              <Body muted testID="record-diary-free">
                {E.save.diaryFree}
              </Body>
            )
          ) : check === 'short_distance' ? (
            <Body muted>{E.save.diaryNone}</Body>
          ) : null}
          {diaryFailed ? <Notice tone="warning">{E.save.diaryFailed}</Notice> : null}
          <FieldError message={error} testID="record-save-error" />
          <Button
            label={E.save.submit}
            loading={busy}
            onPress={() => void save()}
            testID="record-submit"
          />
          <Button
            label={E.save.discard}
            variant="secondary"
            onPress={() => setConfirmDiscard(true)}
            testID="record-discard"
          />
        </>
      )}
      <ConfirmDialog
        visible={confirmShort}
        title={E.save.title}
        message={E.save.shortDistance}
        confirmLabel={E.save.shortDistanceYes}
        confirmVariant="primary"
        loading={busy}
        onConfirm={() => void save(true)}
        onCancel={() => setConfirmShort(false)}
        testID="record-short-dialog"
      />
      <ConfirmDialog
        visible={confirmDiscard}
        title={E.save.discard}
        message={E.recover.discardConfirm}
        confirmLabel={E.save.discard}
        onConfirm={() => void discard()}
        onCancel={() => setConfirmDiscard(false)}
        testID="record-discard-dialog"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: 1, padding: 20, gap: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  big: { gap: spacing.md },
  bigRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  bigItem: { gap: 2, minWidth: 0 },
  bigHalf: { flexGrow: 1, flexBasis: 120 },
  bigLabel: { fontSize: fontSize.sm },
  bigValueXl: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  bigValue: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  summaryText: { flex: 1, gap: 2 },
});
