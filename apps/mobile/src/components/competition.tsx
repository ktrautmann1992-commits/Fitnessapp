import {
  clockElapsedS,
  clockPause,
  clockResume,
  clockStart,
  type CompetitionCountdown,
  type CompetitionDiscipline,
  type CompetitionFeasibility,
  type CompetitionPlanWeek,
  type FeasibilitySuggestion,
  INTERVAL_CLOCK_IDLE,
  type IntervalClock,
  intervalLoggedMinutes,
  intervalPosition,
  talkTestText,
  type WorkoutStep,
} from '@fitnessapp/core';
import { fontSize, fontWeight, radius, spacing } from '@fitnessapp/ui';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import {
  clockA11y,
  clockText,
  countdownText,
  feasibilityFacts,
  feasibilityHeadline,
  phaseBandText,
  stepLines,
  stepTitle,
  suggestionText,
} from '@/lib/competition-format';
import { alertStepChange } from '@/lib/step-alert';
import { useThemeColors } from '@/lib/theme';

import { ConfirmDialog } from './screen';
import { Body, Button, Card, Heading, Notice } from './ui';

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
}: {
  feasibility: CompetitionFeasibility;
  /** Vorschlag übernehmen (null = nur anzeigen). */
  onSuggestion: ((suggestion: FeasibilitySuggestion) => void) | null;
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
        { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: accent },
      ]}
    >
      <Text style={[styles.feasibilityTitle, { color: theme.textMuted }]}>
        {C.feasibilityTitle}
      </Text>
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
      {feasibilityFacts(feasibility).map((line) => (
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
  name,
  onOpen,
  openLabel,
  testID = 'competition-countdown',
}: {
  countdown: CompetitionCountdown;
  discipline: CompetitionDiscipline;
  name: string;
  onOpen: (() => void) | null;
  openLabel?: string;
  testID?: string;
}) {
  return (
    <Card>
      <View style={styles.block} testID={testID}>
        <Body muted>{`${C.countdownTitle} · ${name}`}</Body>
        <Heading level={2}>{countdownText(countdown, discipline)}</Heading>
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

export function PhaseBand({ week }: { week: CompetitionPlanWeek }) {
  const theme = useThemeColors();
  return (
    <View
      testID="competition-phase-band"
      style={[styles.band, { borderColor: theme.primary, backgroundColor: theme.surface }]}
    >
      <Text style={[styles.bandText, { color: theme.text }]}>{phaseBandText(week)}</Text>
      {week.phase ? <Body muted>{C.phaseTexts[week.phase]}</Body> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf einer Einheit
// ---------------------------------------------------------------------------------------------------------

export function StepList({ steps }: { steps: readonly WorkoutStep[] }) {
  const theme = useThemeColors();
  return (
    <View style={styles.block} testID="plan-workout-steps">
      <Text style={[styles.label, { color: theme.text }]}>{C.stepsTitle}</Text>
      {stepLines(steps).map((line, index) => (
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
  onLog,
}: {
  steps: readonly WorkoutStep[];
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
    const text = position.finished
      ? C.timer.announceFinished
      : C.timer.announce(stepTitle(position.step));
    setAnnouncement(text);
    if (!first) alertStepChange(text);
  }, [position.finished, position.index, position.step, started]);

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
            {stepLines(steps).map((line, index) => (
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
                {stepTitle(step)}
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
              {position.next ? C.timer.next(stepTitle(position.next)) : C.timer.nextLast}
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
    borderRadius: radius.md,
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
