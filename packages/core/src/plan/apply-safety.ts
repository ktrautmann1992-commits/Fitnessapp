import { REST_RANGES_S } from '../constants';
import type { Exercise } from '../content/schemas';
import { clampRpe, type PlannedExerciseDraft } from './adapt';
import { type EquipmentProfile, findSubstitute } from './equipment-profile';
import type { EnduranceModality, PlannedSessionKind } from '../enums';
import {
  ENDURANCE_TEXTS_DE,
  ENDURANCE_VARIANT_MODALITY,
  enduranceStartSessionCap,
  type EnduranceVariant,
} from './endurance';
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
    readonly library: ReadonlyMap<string, Exercise>;
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
            library: ctx.library,
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
}

const VARIANT_BY_MODALITY: Readonly<Record<EnduranceModality, EnduranceVariant>> = {
  run: 'easy_run',
  walk: 'brisk_walk',
  bike: 'easy_bike',
  swim: 'easy_swim',
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
  >,
  ctx: { readonly previousStartGroup: EnduranceStartGroup },
): T {
  if (session.kind !== 'endurance') return session;
  let variant = enduranceVariantOf(session);
  if (rules.enduranceWalkOnly || rules.pregnancyNotice) {
    if (variant === 'easy_run' || variant === 'walk_run') variant = 'brisk_walk';
    if (variant === 'easy_bike') variant = 'ergometer';
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
