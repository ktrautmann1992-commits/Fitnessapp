import { REST_RANGES_S } from '../constants';
import type { Exercise } from '../content/schemas';
import { clampRpe, type PlannedExerciseDraft } from './adapt';
import { type EquipmentProfile, findSubstitute } from './equipment-profile';
import { startOfIsoWeek } from '../dates';
import type { EnduranceModality, ExperienceLevel, PlannedSessionKind } from '../enums';
import {
  ENDURANCE_TEXTS_DE,
  ENDURANCE_VARIANT_MODALITY,
  enduranceStartSessionCap,
  type EnduranceVariant,
} from './endurance';
import { easyWorkout, techniqueWorkout } from './endurance-workouts';
import {
  hardEffortCapFor,
  hardWorkoutLimits,
  isHardWorkoutType,
  type WorkoutStep,
  type WorkoutType,
} from './intensity';
import {
  type EnduranceStartGroup,
  isExerciseAllowed,
  isStricterGroup,
  type PlanSafetyRules,
} from './safety';

/**
 * Strengere Sicherheitsregeln wirken sofort (docs/PLAN-PHASE-3.md Abschnitt 5.4): beim Anzeigen jeder Einheit
 * und beim Erzeugen jedes Folgeblocks. RPE-Deckel sinkt; ausgeschlossene Übungen werden ersetzt – oder, wenn kein
 * Ersatz möglich ist (z. B. offline ohne Geräte-Profil), ausgeblendet.
 */
export interface ApplySafetyResult<T extends { exercises: readonly PlannedExerciseDraft[] }> {
  readonly session: T;
  /** IDs ausgeblendeter Übungen → Hinweis „Übung ausgelassen, bitte Plan neu erstellen“. */
  readonly hidden: readonly string[];
  /** IDs ersetzter Übungen. */
  readonly replaced: readonly string[];
}

export function applyCurrentSafetyRules<T extends { exercises: readonly PlannedExerciseDraft[] }>(
  session: T,
  rules: Pick<PlanSafetyRules, 'rpeMax' | 'excludedCautionTags' | 'cautious'>,
  ctx: {
    /** Merkmale der Übungen nachschlagen (Anzeige: auch archivierte Übungen eines laufenden Plans). */
    readonly library: ReadonlyMap<string, Exercise>;
    /** Woraus ein Ersatz gewählt werden darf (nur freigegebene Inhalte); Standard: `library`. */
    readonly substituteLibrary?: ReadonlyMap<string, Exercise>;
    readonly profile?: Pick<EquipmentProfile, 'available'>;
  },
): ApplySafetyResult<T> {
  const hidden: string[] = [];
  const replaced: string[] = [];
  const used = new Set(session.exercises.map((e) => e.exercise_id));
  const exercises: PlannedExerciseDraft[] = [];
  for (const item of session.exercises) {
    const exercise = ctx.library.get(item.exercise_id);
    let next: PlannedExerciseDraft = {
      ...item,
      rpe_target: clampRpe(item.rpe_target, rules.rpeMax),
    };
    if (!exercise) {
      // Unbekannte Übung (z. B. Bibliothek nicht geladen): Merkmale nicht prüfbar → sicherheitshalber ausblenden.
      hidden.push(item.exercise_id);
      continue;
    }
    if (!isExerciseAllowed(exercise, rules)) {
      const substitute = ctx.profile
        ? findSubstitute(exercise, {
            library: ctx.substituteLibrary ?? ctx.library,
            profile: ctx.profile,
            rules,
            exclude: new Set([...used].filter((id) => id !== item.exercise_id)),
          })
        : null;
      if (!substitute) {
        hidden.push(item.exercise_id);
        continue;
      }
      used.add(substitute.exercise.id);
      replaced.push(item.exercise_id);
      const chosen = substitute.exercise;
      const range = REST_RANGES_S[chosen.mechanics];
      const changedPattern =
        chosen.movement_pattern !== exercise.movement_pattern ||
        chosen.mechanics !== exercise.mechanics;
      next = {
        ...next,
        exercise_id: chosen.id,
        exercise_name_de: chosen.name_de,
        rest_s: changedPattern
          ? Math.min(range.max, Math.max(range.min, next.rest_s))
          : next.rest_s,
      };
    }
    exercises.push(next);
  }
  return {
    session: { ...session, exercises: exercises.map((e, i) => ({ ...e, order_no: i + 1 })) },
    hidden,
    replaced,
  };
}

/** Felder einer gespeicherten Einheit, die applyCurrentEnduranceRules liest und ändert. */
export interface EnduranceSessionLike {
  readonly kind: PlannedSessionKind;
  readonly name_de: string;
  readonly endurance_modality: EnduranceModality | null;
  readonly effort_target: number | null;
  readonly estimated_minutes: number;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  /** Nur Wettkampfplan (WP2): Art und Schritte; fehlen → Verhalten wie bisher. */
  readonly workout_type?: WorkoutType | null;
  readonly workout_steps?: readonly WorkoutStep[] | null;
}

const VARIANT_BY_MODALITY: Readonly<Record<EnduranceModality, EnduranceVariant>> = {
  run: 'easy_run',
  walk: 'brisk_walk',
  bike: 'easy_bike',
  swim: 'easy_swim',
  // Sportarten Stufe 1 · Etappe R: eigene Variante „Lockeres Rudern“.
  row: 'easy_row',
};

/** Variante einer gespeicherten Ausdauer-Einheit (aus dem festen Namen, sonst aus der Modalität). */
export function enduranceVariantOf(session: EnduranceSessionLike): EnduranceVariant {
  const byName = (Object.keys(ENDURANCE_TEXTS_DE.names) as EnduranceVariant[]).find(
    (variant) => ENDURANCE_TEXTS_DE.names[variant] === session.name_de,
  );
  return byName ?? VARIANT_BY_MODALITY[session.endurance_modality ?? 'walk'];
}

/**
 * Strengere AKTUELLE Regeln wirken sofort auch auf Ausdauer-Einheiten (Erweiterungsplan 5.6; Pflichtaufruf in
 * Etappe C beim Anzeigen jeder Einheit): Anstrengung höchstens `enduranceEffortMax`; bei „nur Gehen“
 * (Flag, ab 65) oder Schwangerschaft Laufen → zügiges Gehen und Rad → Ergometer (nie Rad im Freien); ohne
 * Gesundheits-Check Dauerlauf → Geh-Lauf-Wechsel; ist die Startgruppe strenger als beim Erstellen des Plans,
 * höchstens der Start-Deckel je Einheit der neuen Gruppe. Name, Auf- und Abwärmen nach ENDURANCE_TEXTS_DE.
 * Kraft-Einheiten bleiben unverändert (dafür applyCurrentSafetyRules).
 */
export function applyCurrentEnduranceRules<T extends EnduranceSessionLike>(
  session: T,
  rules: Pick<
    PlanSafetyRules,
    | 'enduranceEffortMax'
    | 'enduranceWalkOnly'
    | 'pregnancyNotice'
    | 'noHealthCheck'
    | 'enduranceStartGroup'
  > &
    Partial<Pick<PlanSafetyRules, 'medicalNotice'>>,
  ctx: {
    /**
     * Startgruppe beim Erstellen des Plans. Bei einem gespeicherten Plan IMMER `planStartGroup(plan, birthDate)`
     * aus start-group.ts (die safety_rules des Erzeugens werden nie gespeichert).
     */
    readonly previousStartGroup: EnduranceStartGroup;
  },
): T {
  if (session.kind !== 'endurance') return session;
  if (session.workout_type !== undefined && session.workout_type !== null) {
    return applyCompetitionRules(session, rules, ctx);
  }
  let variant = enduranceVariantOf(session);
  if (rules.enduranceWalkOnly || rules.pregnancyNotice) {
    if (variant === 'easy_run' || variant === 'walk_run') variant = 'brisk_walk';
    if (variant === 'easy_bike') variant = 'ergometer';
    // Etappe R: Rudern bei Schwangerschaft bzw. „nur Gehen“ → zügiges Gehen (wie beim Erzeugen).
    if (variant === 'easy_row') variant = 'brisk_walk';
  } else if (rules.noHealthCheck && variant === 'easy_run') {
    variant = 'walk_run';
  }
  let minutes = session.estimated_minutes;
  const startCap = enduranceStartSessionCap(rules.enduranceStartGroup);
  if (startCap !== null && isStricterGroup(rules.enduranceStartGroup, ctx.previousStartGroup)) {
    minutes = Math.min(minutes, startCap);
  }
  return {
    ...session,
    name_de: ENDURANCE_TEXTS_DE.names[variant],
    endurance_modality: ENDURANCE_VARIANT_MODALITY[variant],
    warmup_de: ENDURANCE_TEXTS_DE.warmup[variant],
    cooldown_de: ENDURANCE_TEXTS_DE.cooldown[variant],
    effort_target: Math.min(
      session.effort_target ?? rules.enduranceEffortMax,
      rules.enduranceEffortMax,
    ),
    estimated_minutes: minutes,
  };
}

/**
 * Wettkampfplan (Phase 10 WP2, Plan 6 „apply-safety“): Strengeres wirkt sofort auch auf Arten und Schritte. Harte
 * Arten und Steigerungen werden locker, wenn harte Einheiten nicht (mehr) erlaubt sind (Flag, Schwangerschaft, ohne
 * Check, „nur Gehen“ – hardEffortCapFor), die Variante wechselt (Gehen) oder der Start-Deckel die Einheit kürzt; sonst
 * Anstrengung harter Abschnitte höchstens bis zum Deckel der Gruppe (unter 18: 7), lockere höchstens
 * `enduranceEffortMax`. Fehlt `medicalNotice` in den Regeln, gilt vorsichtig „keine harten Einheiten“. Lockerungen nie.
 */
function applyCompetitionRules<T extends EnduranceSessionLike>(
  session: T,
  rules: Pick<
    PlanSafetyRules,
    | 'enduranceEffortMax'
    | 'enduranceWalkOnly'
    | 'pregnancyNotice'
    | 'noHealthCheck'
    | 'enduranceStartGroup'
  > &
    Partial<Pick<PlanSafetyRules, 'medicalNotice'>>,
  ctx: { readonly previousStartGroup: EnduranceStartGroup },
): T {
  const before = enduranceVariantOf(session);
  let variant = before;
  if (rules.enduranceWalkOnly || rules.pregnancyNotice) {
    if (variant === 'easy_run' || variant === 'walk_run') variant = 'brisk_walk';
    if (variant === 'easy_bike') variant = 'ergometer';
    // Etappe R: Rudern bei Schwangerschaft bzw. „nur Gehen“ → zügiges Gehen (wie beim Erzeugen).
    if (variant === 'easy_row') variant = 'brisk_walk';
  } else if (rules.noHealthCheck && variant === 'easy_run') {
    variant = 'walk_run';
  }
  let minutes = session.estimated_minutes;
  const startCap = enduranceStartSessionCap(rules.enduranceStartGroup);
  if (startCap !== null && isStricterGroup(rules.enduranceStartGroup, ctx.previousStartGroup)) {
    minutes = Math.min(minutes, startCap);
  }
  const cap = hardEffortCapFor({ ...rules, medicalNotice: rules.medicalNotice ?? true });
  const type = session.workout_type as WorkoutType;
  const structured = isHardWorkoutType(type) || type === 'strides';
  const changed = variant !== before || minutes !== session.estimated_minutes;
  const easyMax = rules.enduranceEffortMax;
  // WP5: Koppeltraining (Rad → Lauf) wird bei jeder Änderung (Ergometer statt Rad, kürzer) eine lockere Einheit – die
  // zwei Teile passen dann nicht mehr.
  if ((structured && (cap === 0 || changed)) || (type === 'brick' && changed)) {
    const effort = Math.min(session.effort_target ?? easyMax, easyMax);
    const easy = easyWorkout('easy', minutes, effort);
    return {
      ...session,
      name_de: ENDURANCE_TEXTS_DE.names[variant],
      endurance_modality: ENDURANCE_VARIANT_MODALITY[variant],
      warmup_de: ENDURANCE_TEXTS_DE.warmup[variant],
      cooldown_de: ENDURANCE_TEXTS_DE.cooldown[variant],
      effort_target: effort,
      estimated_minutes: minutes,
      workout_type: 'easy',
      workout_steps: easy.steps,
    };
  }
  const effortTarget = isHardWorkoutType(type)
    ? Math.min(session.effort_target ?? cap, cap)
    : Math.min(session.effort_target ?? easyMax, easyMax);
  const steps = changed
    ? type === 'technique'
      ? (
          techniqueWorkout(minutes, Math.min(effortTarget, easyMax)) ??
          easyWorkout('easy', minutes, Math.min(effortTarget, easyMax))
        ).steps
      : easyWorkout(
          type === 'long' || type === 'recovery' ? type : 'easy',
          minutes,
          Math.min(effortTarget, easyMax),
        ).steps
    : (session.workout_steps ?? null)?.map((st) => ({
        ...st,
        effort: Math.min(st.effort, st.kind === 'work' ? cap : easyMax),
      }));
  return {
    ...session,
    ...(variant !== before
      ? {
          name_de: ENDURANCE_TEXTS_DE.names[variant],
          warmup_de: ENDURANCE_TEXTS_DE.warmup[variant],
          cooldown_de: ENDURANCE_TEXTS_DE.cooldown[variant],
        }
      : {}),
    endurance_modality: ENDURANCE_VARIANT_MODALITY[variant],
    effort_target: effortTarget,
    estimated_minutes: minutes,
    workout_steps: steps ?? null,
  };
}

/**
 * Anzahl harter Einheiten je ISO-Woche nach den AKTUELLEN Regeln (Wächter N3): Wird Level oder Startgruppe strenger
 * (z. B. Fortgeschritten → Einsteiger: 1 statt 2 je Woche), bleiben die frühesten erlaubten harten Einheiten der Woche,
 * überzählige werden locker (Art, Name, Schritte, Anstrengung). Danach für jede Einheit applyCurrentEnduranceRules.
 * Nur senken, nie lockern; Einheiten ohne Art bleiben unverändert.
 */
export function applyCompetitionWeekLimits<
  T extends EnduranceSessionLike & { readonly scheduled_on: string },
>(
  sessions: readonly T[],
  rules: Pick<
    PlanSafetyRules,
    | 'enduranceEffortMax'
    | 'enduranceWalkOnly'
    | 'pregnancyNotice'
    | 'noHealthCheck'
    | 'enduranceStartGroup'
    | 'medicalNotice'
  >,
  level: ExperienceLevel,
): T[] {
  const perWeek = hardWorkoutLimits(rules, level).perWeek;
  const kept = new Map<string, number>();
  const order = sessions
    .map((s, i) => ({ s, i }))
    .sort((a, b) =>
      a.s.scheduled_on < b.s.scheduled_on
        ? -1
        : a.s.scheduled_on > b.s.scheduled_on
          ? 1
          : a.i - b.i,
    );
  const downgrade = new Set<number>();
  for (const { s, i } of order) {
    if (s.kind !== 'endurance' || !isHardWorkoutType(s.workout_type)) continue;
    const week = startOfIsoWeek(s.scheduled_on);
    const count = kept.get(week) ?? 0;
    if (count >= perWeek) downgrade.add(i);
    else kept.set(week, count + 1);
  }
  return sessions.map((s, i) => {
    if (!downgrade.has(i)) return s;
    const variant = enduranceVariantOf(s);
    const effort = Math.min(s.effort_target ?? rules.enduranceEffortMax, rules.enduranceEffortMax);
    return {
      ...s,
      name_de: ENDURANCE_TEXTS_DE.names[variant],
      warmup_de: ENDURANCE_TEXTS_DE.warmup[variant],
      cooldown_de: ENDURANCE_TEXTS_DE.cooldown[variant],
      effort_target: effort,
      workout_type: 'easy',
      workout_steps: easyWorkout('easy', s.estimated_minutes, effort).steps,
    };
  });
}
