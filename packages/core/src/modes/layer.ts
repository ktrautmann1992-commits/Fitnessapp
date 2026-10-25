import { PAIN_MODE, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import type { Exercise } from '../content/schemas';
import type { CautionTag, PlannedSessionKind } from '../enums';
import { fitSessionToMinutes, type PlannedExerciseDraft } from '../plan/adapt';
import { type EquipmentProfile, findSubstitute } from '../plan/equipment-profile';
import { type ExercisePair, replaceShownExercise, type SwapRecord } from '../plan/preferences';
import type { PlanSafetyRules } from '../plan/safety';
import { isBlockedByPain, isLowerBodyRegion, type PainEffect } from './pain';
import type { TravelOnDay } from './travel';

/**
 * Anzeige-Schichten der Trainings-Modi (docs/PLAN-TRAINING-MODI.md 6). Sie laufen in prepareSessionForDisplay():
 * Sicherheitsregeln → Reise-Geräte → Präferenzen → „Nur heute“ → Schmerz-Modus → Reise-Minuten. Der Schmerz-Modus
 * läuft NACH den Tausch-Schichten, damit keine Wahl der Person eine belastende Übung zurückbringt. Nichts davon wird
 * gespeichert – endet ein Modus, ist die Anzeige wieder die des Plans.
 */

export interface DisplayModes {
  /** Reise-Zeitraum am Tag der Einheit (travelOnDay); null/fehlt = keiner. */
  readonly travel?: TravelOnDay | null;
  /** Schmerz-Modus am Tag der Einheit (painEffectOn); null/fehlt = keiner. */
  readonly pain?: PainEffect | null;
}

export type ModeSwapReason = 'travel' | 'pain';
export interface ModeSwapRecord extends SwapRecord {
  readonly reason: ModeSwapReason;
}

/** Anzeige-Codes der Modi – nie gespeichert. Texte in der App (nur feste Bausteine, keine Diagnosen). */
export const MODE_NOTICES = [
  'travel_active',
  'travel_swapped',
  'travel_removed',
  'travel_shortened',
  'pain_active',
  'pain_swapped',
  'pain_removed',
  'pain_session_empty',
  'pain_medical_advice',
  'pain_endurance_easier',
  'pain_endurance_check',
] as const;
export type ModeNotice = (typeof MODE_NOTICES)[number];

interface LayerLookup {
  /** Woraus ein Ersatz kommen darf (nur freigegebene Inhalte). */
  readonly library: ReadonlyMap<string, Exercise>;
  /** Zum Nachschlagen (auch archivierte); Standard `library`. */
  readonly lookup?: ReadonlyMap<string, Exercise>;
  /** Regeln für jeden Ersatz (displaySwapRules bzw. aktuelle Regeln). */
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>;
}

export interface ModeLayerResult {
  readonly pairs: readonly ExercisePair[];
  readonly swapped: readonly ModeSwapRecord[];
  /** Ausgeblendet ohne Ersatz – GESPEICHERTE IDs (lösen nie „Plan neu erstellen“ aus). */
  readonly hidden: readonly string[];
}

function replaceAll(
  pairs: readonly ExercisePair[],
  kind: PlannedSessionKind,
  ctx: LayerLookup & {
    readonly profile: Pick<EquipmentProfile, 'available'> | null;
    readonly needsSwap: (exercise: Exercise | undefined) => boolean;
    readonly blocked?: (exercise: Exercise) => boolean;
    readonly reason: ModeSwapReason;
  },
): ModeLayerResult {
  if (kind !== 'strength') return { pairs, swapped: [], hidden: [] };
  const lookup = ctx.lookup ?? ctx.library;
  const result: (ExercisePair | null)[] = [...pairs];
  const swapped: ModeSwapRecord[] = [];
  const hidden: string[] = [];
  result.forEach((pair, index) => {
    if (pair === null) return;
    const shown = lookup.get(pair.shown.exercise_id);
    if (!ctx.needsSwap(shown)) return;
    const inSession = new Set(
      result.flatMap((p, i) => (p === null || i === index ? [] : [p.shown.exercise_id])),
    );
    const substitute =
      shown && ctx.profile
        ? findSubstitute(shown, {
            library: ctx.library,
            profile: ctx.profile,
            rules: ctx.rules,
            exclude: inSession,
            ...(ctx.blocked ? { blocked: ctx.blocked } : {}),
          })
        : null;
    if (substitute && substitute.exercise.id !== pair.shown.exercise_id) {
      result[index] = {
        ...pair,
        shown: replaceShownExercise(pair.shown, shown, substitute.exercise),
      };
      swapped.push({
        storedOrderNo: pair.storedOrderNo,
        from: pair.shown.exercise_id,
        to: substitute.exercise.id,
        reason: ctx.reason,
      });
      return;
    }
    hidden.push(pair.stored.exercise_id);
    result[index] = null;
  });
  return { pairs: result.filter((p): p is ExercisePair => p !== null), swapped, hidden };
}

/**
 * Reise-Schicht: Übungen, die mit den Reise-Geräten nicht machbar sind, tauschen (findSubstitute mit dem Reise-Profil,
 * nie schwerer, immer erlaubt); ohne Ersatz entfällt die Übung heute.
 */
export function applyTravelLayer(
  pairs: readonly ExercisePair[],
  kind: PlannedSessionKind,
  ctx: LayerLookup & { readonly travel: TravelOnDay },
): ModeLayerResult {
  const profile = { available: ctx.travel.available };
  return replaceAll(pairs, kind, {
    ...ctx,
    profile,
    reason: 'travel',
    needsSwap: (e) => e === undefined || !e.equipment_ids.every((id) => profile.available.has(id)),
  });
}

export interface PainLayerResult extends ModeLayerResult {
  /** Kraft-Einheit, von der wegen des Modus keine Übung übrig ist. */
  readonly empty: boolean;
}

/** Regeln für Ersatz im Schmerz-Modus: immer „vorsichtig“ (leichtere Alternativen zuerst), konservativ strenger. */
export function painSubstituteRules(
  rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'>,
  pain: Pick<PainEffect, 'conservative'>,
): Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious'> {
  const extra: readonly CautionTag[] = pain.conservative
    ? PAIN_MODE.conservative.excludedCautionTags
    : [];
  return {
    excludedCautionTags: [...new Set([...rules.excludedCautionTags, ...extra])],
    cautious: true,
  };
}

/**
 * Schmerz-Schicht: Übungen, die eine wirksame Region belasten, gegen schonendere tauschen (leichtere Alternativen
 * zuerst, nie schwerer, nie wieder belastend); ohne Ersatz entfällt die Übung heute. Danach Belastung senken
 * (PAIN_MODE.dosage, konservativ zusätzlich RPE ≤ PAIN_MODE.conservative.rpeMax).
 */
export function applyPainLayer(
  pairs: readonly ExercisePair[],
  kind: PlannedSessionKind,
  ctx: LayerLookup & {
    readonly pain: PainEffect;
    readonly profile: Pick<EquipmentProfile, 'available'> | null;
  },
): PainLayerResult {
  if (kind !== 'strength') return { pairs, swapped: [], hidden: [], empty: false };
  const blocked = (e: Exercise) => isBlockedByPain(e, ctx.pain);
  const swappedLayer = replaceAll(pairs, kind, {
    ...ctx,
    rules: painSubstituteRules(ctx.rules, ctx.pain),
    reason: 'pain',
    blocked,
    needsSwap: (e) => isBlockedByPain(e, ctx.pain),
  });
  const dosage = PAIN_MODE.dosage[ctx.pain.level];
  const rpeMax = ctx.pain.conservative
    ? PAIN_MODE.conservative.rpeMax
    : TEMPLATE_DOSAGE_LIMITS.rpe.max;
  const reduced = swappedLayer.pairs.map((pair) => ({
    ...pair,
    shown: reduceDosage(pair.shown, dosage.rpeDrop, dosage.setsDrop, rpeMax),
  }));
  return {
    pairs: reduced,
    swapped: swappedLayer.swapped,
    hidden: swappedLayer.hidden,
    empty: pairs.length > 0 && reduced.length === 0,
  };
}

/** Sätze und RPE senken – nie unter PAIN_MODE.minSets bzw. RPE TEMPLATE_DOSAGE_LIMITS.rpe.min, nie höher. */
export function reduceDosage(
  exercise: PlannedExerciseDraft,
  rpeDrop: number,
  setsDrop: number,
  rpeMax: number,
): PlannedExerciseDraft {
  const sets = Math.max(Math.min(exercise.sets, PAIN_MODE.minSets), exercise.sets - setsDrop);
  const rpe = Math.max(
    Math.min(exercise.rpe_target, TEMPLATE_DOSAGE_LIMITS.rpe.min),
    Math.min(exercise.rpe_target - rpeDrop, rpeMax),
  );
  return { ...exercise, sets, rpe_target: rpe };
}

/**
 * Reise-Minuten: die Einheit mit fitSessionToMinutes auf die gewählte Dauer kürzen (Isolationsübungen, dann Sätze,
 * dann Übungen vom Ende; mindestens 3 Übungen). Zuordnung zur gespeicherten Übung über die Übungs-ID (je Einheit
 * eindeutig).
 */
export function applyTravelTimeFit(
  pairs: readonly ExercisePair[],
  kind: PlannedSessionKind,
  minutes: number,
  lookup: ReadonlyMap<string, Exercise>,
): { readonly pairs: readonly ExercisePair[]; readonly shortened: boolean } {
  if (kind !== 'strength' || pairs.length === 0) return { pairs, shortened: false };
  const fit = fitSessionToMinutes(
    pairs.map((p) => p.shown),
    minutes,
    lookup,
  );
  if (!fit.shortened) return { pairs, shortened: false };
  const byId = new Map(pairs.map((p) => [p.shown.exercise_id, p]));
  return {
    pairs: fit.exercises.flatMap((e) => {
      const pair = byId.get(e.exercise_id);
      return pair ? [{ ...pair, shown: e }] : [];
    }),
    shortened: true,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Ausdauer
// ---------------------------------------------------------------------------------------------------------

export interface EnduranceModeFields {
  readonly kind: PlannedSessionKind;
  readonly estimated_minutes: number;
  readonly effort_target: number | null;
  readonly workout_steps?: readonly unknown[] | null;
}

/**
 * Ausdauer an Modus-Tagen: Reise-Minuten kürzen (nur senken); Schmerz in Knie/Hüfte/Sprunggelenk/unterem Rücken ab
 * „mittel“: Dauer × PAIN_MODE.endurance.minutesFactor, Anstrengung ≤ PAIN_MODE.endurance.effortMax. Einheiten mit
 * festem Ablauf (Wettkampfplan, `workout_steps`) bleiben unverändert und bekommen nur den Hinweis.
 */
export function applyModesToEndurance<T extends EnduranceModeFields>(
  session: T,
  modes: DisplayModes,
): { readonly session: T; readonly notices: readonly ModeNotice[] } {
  if (session.kind !== 'endurance') return { session, notices: [] };
  const notices: ModeNotice[] = [];
  const fixed = Array.isArray(session.workout_steps) && session.workout_steps.length > 0;
  let minutes = session.estimated_minutes;
  let effort = session.effort_target;
  if (modes.travel?.maxMinutes && !fixed && minutes > modes.travel.maxMinutes) {
    minutes = modes.travel.maxMinutes;
    notices.push('travel_shortened');
  }
  const pain = modes.pain;
  if (pain) {
    const order = ['mild', 'moderate', 'severe'];
    const relevant = pain.regions.some(
      (r) =>
        isLowerBodyRegion(r.region) &&
        order.indexOf(r.intensity) >= order.indexOf(PAIN_MODE.endurance.fromIntensity),
    );
    if (relevant) {
      if (fixed) {
        notices.push('pain_endurance_check');
      } else {
        minutes = Math.max(
          Math.min(minutes, PAIN_MODE.endurance.minMinutes),
          Math.floor(minutes * PAIN_MODE.endurance.minutesFactor),
        );
        effort = effort === null ? null : Math.min(effort, PAIN_MODE.endurance.effortMax);
        notices.push('pain_endurance_easier');
      }
    }
  }
  if (minutes === session.estimated_minutes && effort === session.effort_target) {
    return { session, notices };
  }
  return { session: { ...session, estimated_minutes: minutes, effort_target: effort }, notices };
}

/** Feste Hinweise einer Einheit (Reihenfolge wie MODE_NOTICES). */
export function modeNotices(input: {
  readonly kind: PlannedSessionKind;
  readonly modes: DisplayModes;
  readonly travel: Pick<ModeLayerResult, 'swapped' | 'hidden'> | null;
  readonly shortened: boolean;
  readonly pain: Pick<PainLayerResult, 'swapped' | 'hidden' | 'empty'> | null;
  readonly endurance: readonly ModeNotice[];
}): ModeNotice[] {
  const set = new Set<ModeNotice>(input.endurance);
  if (input.modes.travel) set.add('travel_active');
  if (input.travel && input.travel.swapped.length > 0) set.add('travel_swapped');
  if (input.travel && input.travel.hidden.length > 0) set.add('travel_removed');
  if (input.shortened) set.add('travel_shortened');
  if (input.modes.pain) {
    set.add('pain_active');
    if (input.modes.pain.advice.length > 0) set.add('pain_medical_advice');
  }
  if (input.pain && input.pain.swapped.length > 0) set.add('pain_swapped');
  if (input.pain && input.pain.hidden.length > 0) set.add('pain_removed');
  if (input.pain?.empty) set.add('pain_session_empty');
  return MODE_NOTICES.filter((n) => set.has(n));
}
