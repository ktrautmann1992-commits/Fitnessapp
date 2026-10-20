import {
  clockElapsedS,
  clockPause,
  clockResume,
  clockStart,
  type CompetitionCountdown,
  type CompetitionDiscipline,
  type CompetitionFeasibility,
  type CompetitionOutlineWeek,
  type CompetitionPlanOutline,
  type CompetitionPlanWeek,
  type FeasibilitySuggestion,
  INTERVAL_CLOCK_IDLE,
  type IntervalClock,
  intervalLoggedMinutes,
  intervalPosition,
  type Sport,
  talkTestText,
  type WorkoutStep,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import {
  clockA11y,
  clockText,
  countdownText,
  feasibilityFacts,
  feasibilityHeadline,
  outlinePhaseDates,
  outlinePhaseTitle,
  outlineStatusText,
  outlineWeekLabel,
  phaseBandText,
  stepLines,
  stepTitle,
  suggestionText,
} from '@/lib/competition-format';
import { INTERVAL_TIMER_AWAKE_TAG, useScreenAwake } from '@/lib/keep-awake';
import { alertStepChange } from '@/lib/step-alert';
import { useThemeColors } from '@/lib/theme';

import { ConfirmDialog } from './screen';
import { Body, Button, Card, Heading, MIN_TOUCH, Notice } from './ui';
import { Text } from '@/components/text';

/**
 * Bausteine zum Wettkampf (Etappe WP4, docs/PLAN-PHASE-10.md Abschnitt 8): Ampel, Countdown, Phasen-Band, Ablauf einer
 * Einheit und Intervall-Timer. Nur Anzeige – alle Regeln und Zahlen kommen aus packages/core, die Texte aus i18n.
 * Farben nie allein: jede Ampel-Stufe und jeder Schritt hat Wort und Zeichen.
 */

const C = t.competition;

// ---------------------------------------------------------------------------------------------------------
// Ampel
// ---------------------------------------------------------------------------------------------------------

export function FeasibilityCard({
  feasibility,
  onSuggestion,
  discipline = null,
}: {
  feasibility: CompetitionFeasibility;
  /** Vorschlag übernehmen (null = nur anzeigen). */
  onSuggestion: ((suggestion: FeasibilitySuggestion) => void) | null;
  /** Disziplin (WP5: Rad/Triathlon zeigen „lange Ausfahrt“ statt „langer Lauf“). */
  discipline?: CompetitionDiscipline | null;
}) {
  const theme = useThemeColors();
  const status = C.status[feasibility.status];
  const accent =
    feasibility.status === 'ok'
      ? theme.success
      : feasibility.status === 'tight'
        ? theme.warning
        : theme.danger;
  return (
    <View
      testID="competition-feasibility"
      accessibilityLabel={C.feasibilityA11y(status.label, status.text)}
      style={[
        styles.feasibility,
        { backgroundColor: theme.surface, borderColor: theme.cardBorder, borderLeftColor: accent },
      ]}
    >
      <Text style={[styles.feasibilityTitle, { color: theme.textMuted }]}>
        {C.feasibilityTitle}
      </Text>
      <Body muted testID="competition-feasibility-explain">
        {C.feasibilityExplain}
      </Body>
      <Text
        style={[styles.feasibilityStatus, { color: theme.text }]}
        testID={`competition-feasibility-${feasibility.status}`}
      >
        {feasibilityHeadline(feasibility)}
      </Text>
      <Body>{status.text}</Body>
      {feasibility.reasons.map((reason) => (
        <Body key={reason} testID={`competition-reason-${reason}`}>
          • {C.reasons[reason]}
        </Body>
      ))}
      {feasibility.notices.map((notice) => (
        <Body key={notice} muted testID={`competition-notice-${notice}`}>
          {C.notices[notice]}
        </Body>
      ))}
      {feasibilityFacts(feasibility, discipline).map((line) => (
        <Body key={line} muted>
          {line}
        </Body>
      ))}
      {feasibility.suggestions.length > 0 ? (
        <View style={styles.block} testID="competition-suggestions">
          <Text style={[styles.label, { color: theme.text }]}>{C.suggestionsTitle}</Text>
          {feasibility.suggestions.map((suggestion) => {
            const text = suggestionText(suggestion);
            const applicable =
              onSuggestion !== null &&
              (suggestion.kind === 'later_date' ||
                suggestion.kind === 'shorter_distance' ||
                suggestion.kind === 'health_check' ||
                suggestion.kind === 'without_competition');
            return (
              <View key={`${suggestion.kind}-${text}`} style={styles.suggestion}>
                <Body testID={`competition-suggestion-${suggestion.kind}`}>{text}</Body>
                {applicable ? (
                  <Button
                    label={C.applySuggestion}
                    variant="secondary"
                    accessibilityLabel={C.applySuggestionA11y(text)}
                    onPress={() => onSuggestion(suggestion)}
                    testID={`competition-apply-${suggestion.kind}`}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------------------------------------

export function CountdownCard({
  countdown,
  discipline,
  distanceKm = null,
  name,
  onOpen,
  openLabel,
  testID = 'competition-countdown',
}: {
  countdown: CompetitionCountdown;
  discipline: CompetitionDiscipline;
  /** Rad (WP5): Distanz in km für „Radrennen 120 km“. */
  distanceKm?: number | null;
  name: string;
  onOpen: (() => void) | null;
  openLabel?: string;
  testID?: string;
}) {
  return (
    <Card>
      <View style={styles.block} testID={testID}>
        <Body muted>{`${C.countdownTitle} · ${name}`}</Body>
        <Heading level={2}>{countdownText(countdown, discipline, distanceKm)}</Heading>
        {countdown.kind === 'upcoming' && countdown.raceWeek ? (
          <Body testID={`${testID}-race-week`}>{C.raceWeek}</Body>
        ) : null}
        {onOpen ? (
          <Button
            label={
              openLabel ??
              (countdown.kind === 'awaiting_result' || countdown.kind === 'race_day'
                ? C.result.title
                : countdown.kind === 'done'
                  ? C.nextGoal
                  : C.openCompetition)
            }
            variant="secondary"
            onPress={onOpen}
            testID={`${testID}-open`}
          />
        ) : null}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Phasen-Band
// ---------------------------------------------------------------------------------------------------------

export function PhaseBand({
  week,
  shortDays = false,
}: {
  week: CompetitionPlanWeek;
  /** Aufbau/Spitze ohne harte Einheit wegen kurzer Tage (Wächter WP4 M8). */
  shortDays?: boolean;
}) {
  const theme = useThemeColors();
  return (
    <View
      testID="competition-phase-band"
      style={[styles.band, { borderColor: theme.primary, backgroundColor: theme.surface }]}
    >
      <Text style={[styles.bandText, { color: theme.text }]}>{phaseBandText(week)}</Text>
      {week.phase ? <Body muted>{C.phaseTexts[week.phase]}</Body> : null}
      {shortDays ? (
        <Body muted testID="competition-short-days">
          {C.shortDaysHint}
        </Body>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// So ist dein Plan aufgebaut (Zeitleiste der Phasen, Gründer-Rückmeldung 20.10.2026)
// ---------------------------------------------------------------------------------------------------------

/**
 * Alle Phasen des Wettkampfplans untereinander (schmale Bildschirme): Name mit Wochen-Spanne, Datum, ein Satz „Was
 * passiert hier“, Umfangs-Trend und die Wochen als Kästchen (aktuelle Woche, Erholungs- und Rennwoche mit Wort). Tipp
 * auf eine Woche öffnet sie im Kalender (`onOpenWeek`), sofern der Kalender sie zeigt.
 */
export function CompetitionOutlineCard({
  outline,
  onOpenWeek,
}: {
  outline: CompetitionPlanOutline;
  onOpenWeek: (monday: string) => void;
}) {
  const theme = useThemeColors();
  const O = C.outline;
  return (
    <Card>
      <View style={styles.block} testID="competition-outline">
        <Heading level={2}>{O.title}</Heading>
        <Body testID="competition-outline-status">{outlineStatusText(outline)}</Body>
        <Body muted>{O.intro(outline.totalWeeks)}</Body>
        <View style={styles.outlineList} role="list" aria-label={O.title}>
          {outline.phases.map((phase) => {
            const title = outlinePhaseTitle(phase);
            const dates = outlinePhaseDates(phase);
            return (
              <View
                key={`${phase.phase}-${phase.from}`}
                role="listitem"
                testID={`competition-outline-phase-${phase.phase}`}
                style={[
                  styles.outlinePhase,
                  {
                    borderColor: phase.current ? theme.primary : theme.border,
                    borderLeftWidth: phase.current ? 6 : 3,
                  },
                ]}
              >
                <Text
                  accessibilityRole="header"
                  aria-level={3}
                  accessibilityLabel={title.a11y}
                  style={[styles.outlinePhaseTitle, { color: theme.text }]}
                >
                  {title.text}
                </Text>
                <Body muted accessibilityLabel={dates.a11y}>
                  {dates.text}
                </Body>
                {phase.current ? (
                  <Text
                    testID="competition-outline-current-phase"
                    style={[styles.outlineCurrent, { color: theme.link }]}
                  >
                    {`▶ ${O.currentPhase}`}
                  </Text>
                ) : null}
                <Body>{O.phaseTexts[phase.phase]}</Body>
                <Body muted>
                  {phase.recoveryWeeks > 0
                    ? `${O.trends[phase.trend]} · ${O.recoveryCount(phase.recoveryWeeks)}`
                    : O.trends[phase.trend]}
                </Body>
                <View style={styles.outlineWeeks}>
                  {phase.weeks.map((week) => (
                    <OutlineWeekChip
                      key={week.monday}
                      week={week}
                      onPress={week.inCalendar ? () => onOpenWeek(week.monday) : null}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        <Body muted>{O.legend}</Body>
      </View>
    </Card>
  );
}

function OutlineWeekChip({
  week,
  onPress,
}: {
  week: CompetitionOutlineWeek;
  onPress: (() => void) | null;
}) {
  const theme = useThemeColors();
  const label = outlineWeekLabel(week);
  const testID = `competition-outline-week-${week.monday}`;
  const style = [
    styles.outlineWeek,
    {
      borderColor: week.current ? theme.primary : theme.border,
      borderWidth: week.current ? 2 : 1,
      // Erholungswoche gestrichelt (zusätzlich zum Wort „Erholung“).
      borderStyle: week.recoveryWeek ? ('dashed' as const) : ('solid' as const),
      backgroundColor: week.current ? theme.background : theme.surface,
      opacity: week.past && !week.current ? 0.75 : 1,
    },
  ];
  const content = (
    <>
      <Text style={[styles.outlineWeekTitle, { color: theme.text }]} numberOfLines={1}>
        {label.title}
      </Text>
      <Text style={[styles.outlineWeekMarker, { color: theme.textMuted }]} numberOfLines={1}>
        {label.marker === '' ? ' ' : label.marker}
      </Text>
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label.a11y} testID={testID} style={style}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.a11y}
      accessibilityHint={C.outline.weekOpenHint}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [...style, pressed ? { opacity: 0.7 } : null]}
    >
      {content}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf einer Einheit
// ---------------------------------------------------------------------------------------------------------

export function StepList({
  steps,
  sports = null,
}: {
  steps: readonly WorkoutStep[];
  /** Sportart je Schritt (Koppeltraining Rad → Lauf, WP5); null = eine Sportart. */
  sports?: readonly Sport[] | null;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.block} testID="plan-workout-steps">
      <Text style={[styles.label, { color: theme.text }]}>{C.stepsTitle}</Text>
      {stepLines(steps, sports).map((line, index) => (
        <Body key={`${index}-${line}`}>• {line}</Body>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Intervall-Timer (Trainingsmodus)
// ---------------------------------------------------------------------------------------------------------

const TICK_MS = 250;

/**
 * Schritt-für-Schritt-Timer aus den Schritten der Einheit: Start, Pause/Weiter, „Abbrechen und eintragen“. Rechnet
 * mit Zeitstempeln (packages/core interval-timer) – läuft offline, Neuzeichnen und Bildschirmsperre verfälschen nichts.
 * Beim Schrittwechsel: Vibration in der App, Ansage über eine dauerhafte Live-Region (im Browser still).
 */
export function IntervalTimer({
  steps,
  sports = null,
  onLog,
}: {
  steps: readonly WorkoutStep[];
  /** Sportart je Schritt (Koppeltraining Rad → Lauf, WP5): Anzeige „Hauptteil (Laufen)“ beim Wechsel. */
  sports?: readonly Sport[] | null;
  /** Gelaufene Minuten als Dauer übernehmen (der Eintrag wird erst mit „Training speichern“ gespeichert). */
  onLog: (minutes: number) => void;
}) {
  const theme = useThemeColors();
  const [clock, setClock] = useState<IntervalClock>(INTERVAL_CLOCK_IDLE);
  const [now, setNow] = useState(() => Date.now());
  const [stopDialog, setStopDialog] = useState(false);
  const [logged, setLogged] = useState<number | null>(null);
  const started = clock.startedAtMs !== null;
  const paused = clock.pausedAtMs !== null;
  const elapsed = clockElapsedS(clock, now);
  const position = intervalPosition(steps, elapsed);
  const running = started && !paused && !position.finished;
  // Bildschirm bleibt an, solange der Timer läuft – unabhängig von der Einstellung (Wächter WP4 M5).
  useScreenAwake(running, INTERVAL_TIMER_AWAKE_TAG);
  const lastIndex = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  // Schrittwechsel bzw. Ende: Ansage (Live-Region) und – nur in der App – Vibration.
  useEffect(() => {
    if (!started) return;
    const key = position.finished ? -1 : position.index;
    if (lastIndex.current === key) return;
    const first = lastIndex.current === null;
    lastIndex.current = key;
    // Mit „Schritt X von N“, damit zwei gleiche Schritte hintereinander erneut angesagt werden (Wächter N2).
    const text = position.finished
      ? C.timer.announceFinished
      : C.timer.announce(
          `${C.timer.stepOf(position.index + 1, steps.length)}: ${stepTitle(position.step, sports?.[position.index] ?? null)}`,
        );
    setAnnouncement(text);
    if (!first) alertStepChange(text);
  }, [position.finished, position.index, position.step, started, steps.length, sports]);

  function start() {
    const at = Date.now();
    lastIndex.current = null;
    setLogged(null);
    setNow(at);
    setClock(clockStart(at));
  }
  function togglePause() {
    const at = Date.now();
    setNow(at);
    setClock((c) => (c.pausedAtMs === null ? clockPause(c, at) : clockResume(c, at)));
  }
  function log() {
    const at = Date.now();
    const minutes = intervalLoggedMinutes(steps, clockElapsedS(clock, at));
    setStopDialog(false);
    setClock(INTERVAL_CLOCK_IDLE);
    lastIndex.current = null;
    setAnnouncement('');
    setLogged(minutes);
    onLog(minutes);
  }

  const step = position.step;
  const workText =
    position.workTotal > 0 ? C.timer.workParts(position.workDone, position.workTotal) : null;
  return (
    <Card>
      <View style={styles.block} testID="interval-timer">
        <Heading level={2}>{C.timer.title}</Heading>
        {/* Dauerhafte Live-Region: nur ihr Text ändert sich (wie die Pausen-Ansage, Wächter C2 S1). */}
        <Text
          accessibilityLiveRegion="assertive"
          aria-live="assertive"
          aria-atomic
          testID="interval-live"
          style={styles.visuallyHidden}
        >
          {announcement}
        </Text>
        {!started ? (
          <>
            <Body muted>{C.timer.intro}</Body>
            {Platform.OS === 'web' ? <Body muted>{C.timer.webHint}</Body> : null}
            {stepLines(steps, sports).map((line, index) => (
              <Body key={`${index}-${line}`}>• {line}</Body>
            ))}
            {logged !== null ? (
              <Notice tone="success" testID="interval-logged">
                {C.timer.logged(logged)}
              </Notice>
            ) : null}
            <Button label={C.timer.start} onPress={start} testID="interval-start" />
          </>
        ) : position.finished ? (
          <>
            <Notice tone="success" testID="interval-finished">
              {`✓ ${C.timer.finished}`}
            </Notice>
            {workText ? <Body testID="interval-parts">{workText}</Body> : null}
            <Button label={C.timer.finishAndLog} onPress={log} testID="interval-log" />
          </>
        ) : (
          <>
            <Body muted testID="interval-step-no">
              {C.timer.stepOf(position.index + 1, steps.length)}
              {paused ? ` · ${C.timer.paused}` : ''}
            </Body>
            <View
              style={[
                styles.timerStep,
                {
                  borderColor: step.kind === 'work' ? theme.primary : theme.border,
                  borderWidth: step.kind === 'work' ? 3 : 1,
                },
              ]}
            >
              <Text style={[styles.timerStepTitle, { color: theme.text }]} testID="interval-step">
                {stepTitle(step, sports?.[position.index] ?? null)}
              </Text>
              <Text
                style={[styles.timerTime, { color: theme.text }]}
                accessibilityLabel={C.timer.remaining(clockA11y(position.stepRemainingS))}
                testID="interval-step-remaining"
              >
                {clockText(position.stepRemainingS)}
              </Text>
              <Body>{talkTestText(step.effort)}</Body>
              {position.workNo !== null ? (
                <Body testID="interval-work-no">
                  {C.timer.workNo(position.workNo, position.workTotal)}
                </Body>
              ) : null}
            </View>
            {workText ? <Body testID="interval-parts">{workText}</Body> : null}
            <Body muted>
              {position.next
                ? C.timer.next(stepTitle(position.next, sports?.[position.index + 1] ?? null))
                : C.timer.nextLast}
            </Body>
            <Body muted accessibilityLabel={C.timer.total(clockA11y(position.remainingS))}>
              {C.timer.total(clockText(position.remainingS))}
            </Body>
            <Button
              label={paused ? C.timer.resume : C.timer.pause}
              onPress={togglePause}
              testID={paused ? 'interval-resume' : 'interval-pause'}
            />
            <Button
              label={C.timer.stopAndLog}
              variant="secondary"
              onPress={() => setStopDialog(true)}
              testID="interval-stop"
            />
          </>
        )}
      </View>
      <ConfirmDialog
        visible={stopDialog}
        title={C.timer.stopConfirmTitle}
        message={C.timer.stopConfirmText}
        confirmLabel={C.timer.stopConfirm}
        confirmVariant="primary"
        onConfirm={log}
        onCancel={() => setStopDialog(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  feasibility: {
    borderWidth: 1,
    borderLeftWidth: 6,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  feasibilityTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  feasibilityStatus: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  suggestion: { gap: spacing.xs },
  band: {
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  bandText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  outlineList: { gap: spacing.sm },
  outlinePhase: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  outlinePhaseTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  outlineCurrent: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  outlineWeeks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  outlineWeek: {
    minWidth: 76,
    minHeight: MIN_TOUCH,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineWeekTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  outlineWeekMarker: { fontSize: fontSize.sm - 2 },
  timerStep: { borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  timerStepTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  timerTime: { fontSize: 48, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
});
