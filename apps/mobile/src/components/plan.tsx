import {
  brickStepSports,
  type DisplayContext,
  type DisplaySession,
  MULTISPORT_TEXTS_DE,
  type PaceProfile,
  type PlanSafetyRules,
  type SessionRoutine,
  sessionPaceInfo,
  sessionSafetyNotices,
  type StoredSession,
} from '@fitnessapp/core';
import { fontSize, fontWeight, spacing } from '@fitnessapp/ui';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { workoutInfoLines } from '@/lib/competition-format';
import { enduranceLines, type ExerciseSummary } from '@/lib/plan-format';
import { useThemeColors } from '@/lib/theme';

import { StepList } from './competition';
import { ModeNoticesBlock, routineSummary } from './training-modes';
import { RowTechniqueNotice } from './rowing';
import type { RunStrengthForDay } from '@/data/run-strength';
import { deModes } from '@/i18n/de-training-modes';
import { HeroCard } from './design';
import { type SessionStartAction, StrengthSession } from './plan-strength';
import { Body, Button, Card, Heading, Notice } from './ui';
import { Text } from '@/components/text';

/**
 * Bausteine für „Heute“ (docs/PLAN-PHASE-3.md 10.2): Einheit und Arzt-Hinweis (Wochen-Leiste: components/training-week.tsx). Nur Anzeige –
 * welche Einheit, welche Regeln und welche Texte kommen aus packages/core bzw. lib/plan-format.ts.
 */

/** Arzt-Hinweis – über JEDER Einheit, wenn der Plan medical_notice hat (auch offline). */
export function MedicalNotice() {
  return (
    <Notice tone="warning" title={t.plan.medicalNoticeTitle} testID="plan-medical-notice">
      <Body>{t.plan.medicalNotice}</Body>
    </Notice>
  );
}

export function SessionCard({
  original,
  shown,
  rules,
  context,
  heading,
  targets,
  onOpenExercise,
  swap,
  paceProfile = null,
  hero = false,
  swapPaused = false,
  routine = null,
  runStrength = null,
  onOpenRunStrength,
  today = false,
  start = null,
}: {
  /** Gespeicherte Einheit (vor den aktuellen Sicherheitsregeln). */
  original: StoredSession;
  /** Dieselbe Einheit nach prepareSessionForDisplay (aktuelle Regeln angewendet). */
  shown: DisplaySession<StoredSession>;
  rules: PlanSafetyRules | null;
  /** Bibliothek und Geräte am Ort – für das Kennzeichen „ersetzt (Gerät fehlt)“. */
  context: Pick<DisplayContext, 'library' | 'profile'>;
  heading: string;
  /**
   * Phase 4: berechnete Vorgabe je angezeigter Übung (gleiche Reihenfolge wie `shown.session.exercises`) – ersetzt die
   * Dosierung aus dem Plan („3 × 10 · 22,5 kg je Hantel“) und zeigt Hinweise der Progression.
   */
  targets?: readonly (ExerciseSummary | null)[];
  /** Übungs-Glossar (Etappe G1): Übungsname als Link zur Anleitung. */
  onOpenExercise?: (exerciseId: string) => void;
  /**
   * Übungstausch (Etappe T2): „Tauschen“ an jeder Übung (nur wenn `enabled`), „Tausch zurücknehmen“ bei „heute
   * getauscht“, Link „Ausschlüsse ansehen“ zu den Einstellungen (null = keine Präferenzen, z. B. Supabase vor T3).
   */
  /** Wettkampfplan (WP4): Basis der Pace-Richtwerte (Referenzzeit des Wettkampfs); null = keine Pace. */
  paceProfile?: PaceProfile | null;
  /** Design 20.10.2026: Kopf der Einheit als dunkle Hero-Karte (Training heute), Inhalt darunter als Karte. */
  hero?: boolean;
  /** Trainings-Modi: Tauschen ausgesetzt, weil ein Modus an diesem Tag wirkt (Hinweis in den Modus-Hinweisen). */
  swapPaused?: boolean;
  /** Aufwärmen & Dehnen (docs/PLAN-TRAINING-MODI.md 5): Kurzfassung statt der Vorlagen-Texte; null = Vorlage. */
  routine?: SessionRoutine | null;
  /** Lauf-Kraft & Lauf-ABC an lockeren Lauftagen (docs/PLAN-CALISTHENICS-SCHLINGE.md 4); null = keine. */
  runStrength?: RunStrengthForDay | null;
  onOpenRunStrength?: (workoutId: string) => void;
  /** Gewählter Tag ist heute („Trainiert heute – Hauptmuskeln“). */
  today?: boolean;
  /** Krafteinheit: „Training starten“ im Kopf der Einheit (null = nicht startbar). */
  start?: SessionStartAction | null;
  swap?: {
    enabled: boolean;
    /** Termin nach heute („für dieses Training getauscht“). */
    later: boolean;
    onSwap: (index: number) => void;
    onUndoDaySwap: (index: number) => void;
    onViewExclusions: (() => void) | null;
  };
}) {
  const theme = useThemeColors();
  const session = shown.session;
  if (session.kind !== 'endurance') {
    return (
      <StrengthSession
        original={original}
        shown={shown}
        context={context}
        heading={heading}
        today={today}
        targets={targets}
        onOpenExercise={onOpenExercise}
        swap={swap}
        swapPaused={swapPaused}
        routine={routine}
        start={start}
      />
    );
  }
  const head = hero ? null : (
    <>
      <Body muted>{heading}</Body>
      <Heading level={2}>{session.name_de}</Heading>
      <Body muted>{t.plan.duration(session.estimated_minutes)}</Body>
    </>
  );
  const card = (
    <Card>
      {head}
      {session.status === 'skipped' ? <Notice tone="info">{t.plan.skipped}</Notice> : null}
      <ModeNoticesBlock shown={shown} swapPaused={swapPaused} />
      <View style={styles.block} testID="plan-warmup">
        <Text style={[styles.label, { color: theme.text }]}>
          {routine
            ? `${t.plan.warmup} (${deModes.warmup.minutes(routine.warmupMinutes)})`
            : t.plan.warmup}
        </Text>
        <Body>
          {routine ? routineSummary(routine, 'warmup', session.warmup_de) : session.warmup_de}
        </Body>
      </View>
      {session.kind === 'endurance' ? (
        <View style={styles.block} testID="plan-endurance">
          {/* Wettkampfplan (WP4): Art, Pace-Spanne (immer mit Hinweis), Distanz-Richtwert, Ablauf der Schritte. */}
          {workoutInfoLines(session, sessionPaceInfo(session, paceProfile)).map((line) => (
            <Body key={line} testID="plan-workout-info">
              {line}
            </Body>
          ))}
          {enduranceLines(session, rules).map((line) => (
            <Body key={line}>{line}</Body>
          ))}
          {session.workout_steps && session.workout_steps.length > 1 ? (
            <StepList
              steps={session.workout_steps}
              sports={
                session.workout_type === 'brick'
                  ? brickStepSports(session.workout_steps, session.estimated_minutes)
                  : null
              }
            />
          ) : null}
          {runStrength ? (
            <RunStrengthBlock
              runStrength={runStrength}
              nameOf={(id) => context.library?.get(id)?.name_de ?? id}
              onOpen={onOpenRunStrength}
            />
          ) : null}
          {/* WP5: bei jeder Schwimm-Einheit der Sicherheitshinweis zum Freiwasser (nie allein, Neopren, Begleitung). */}
          {sessionSafetyNotices(session).includes('open_water') ? (
            <Notice tone="info" title={t.competition.openWaterTitle} testID="plan-open-water">
              <Body>{MULTISPORT_TEXTS_DE.openWater}</Body>
            </Notice>
          ) : null}
          {/* Etappe R: Technik-Hinweis bei jeder Ruder-Einheit. */}
          {session.endurance_modality === 'row' ? (
            <RowTechniqueNotice testID="plan-row-technique" />
          ) : null}
        </View>
      ) : null}
      <View style={styles.block} testID="plan-cooldown">
        <Text style={[styles.label, { color: theme.text }]}>
          {routine
            ? `${t.plan.cooldown} (${deModes.warmup.minutes(routine.cooldownMinutes)})`
            : t.plan.cooldown}
        </Text>
        <Body>
          {routine ? routineSummary(routine, 'cooldown', session.cooldown_de) : session.cooldown_de}
        </Body>
      </View>
    </Card>
  );
  if (!hero) return card;
  return (
    <>
      <HeroCard
        eyebrow={heading}
        eyebrowIcon={session.kind === 'endurance' ? 'run' : 'dumbbell'}
        title={session.name_de}
        subtitle={t.plan.duration(session.estimated_minutes)}
        titleIsHeading
        testID="plan-session-hero"
      />
      {card}
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

/** Lauf-Kraft & Lauf-ABC als Zusatz an einem lockeren Lauftag (docs/PLAN-CALISTHENICS-SCHLINGE.md 4). */
function RunStrengthBlock({
  runStrength,
  nameOf,
  onOpen,
}: {
  runStrength: RunStrengthForDay;
  nameOf: (exerciseId: string) => string;
  onOpen: ((workoutId: string) => void) | undefined;
}) {
  const theme = useThemeColors();
  const R = t.calisthenics.runStrength;
  const { unit, assignment } = runStrength;
  return (
    <View style={styles.block} testID="plan-run-strength">
      <Text style={[styles.label, { color: theme.text }]}>{R.title(unit.workout.minutes)}</Text>
      <Body muted>
        {unit.workout.title_de} · {R.rounds(unit.workout.rounds)}
      </Body>
      <Body muted>{R.intro}</Body>
      {assignment.gentle ? <Body muted>{R.gentle}</Body> : null}
      {unit.items.map((item) => (
        <Body key={item.exercise_id}>
          {`• ${R.item(
            nameOf(item.exercise_id),
            item.reps !== null ? R.reps(item.reps) : R.seconds(item.duration_s ?? 0),
          )}`}
        </Body>
      ))}
      {unit.dropped > 0 ? <Body muted>{R.dropped}</Body> : null}
      {onOpen ? (
        <Button
          label={R.open}
          variant="secondary"
          onPress={() => onOpen(unit.workout.id)}
          testID="plan-run-strength-open"
        />
      ) : null}
    </View>
  );
}
