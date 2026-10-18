import {
  COMPETITION_PERIODIZATION,
  DELOAD_DOSAGE,
  ENDURANCE_DELOAD_VOLUME_FACTOR,
  ENDURANCE_SESSION_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../constants';
import { isoWeekday } from '../dates';
import { increasedMinutes, scaledMinutes } from '../plan/volume';
import {
  type AdjustSession,
  enduranceMinutes,
  isLoadPlanWeek,
  type PlanWeek,
  planWeeks,
} from './weeks';

/**
 * Wochen-Invarianten der Tausch-Regel (docs/PLAN-PHASE-4B.md 5.2 Punkt 6, Wächter B2 und S-n1). Dieselben Regeln rechnet
 * Etappe B in SQL nach (apply_plan_adjustments, append_plan_block); die Fixtures `fixtures/invariants.json` halten fest,
 * wie Core entscheidet.
 *
 * 1. Nie mehr als `maxLoadWeeks` (= loadWeeksBeforeDeload) Belastungswochen in Folge – über Blockgrenzen hinweg. Woche 0
 *    zählt nicht (und unterbricht nicht), die Einstiegswoche zählt.
 * 2. Ausdauer-Minuten jeder Belastungswoche ≤ floor(1,1 × Bezug). Bezug = letzte Belastungswoche davor; nie Bezug sind
 *    Woche 0, Erholungswochen und die angebrochene erste Woche eines Plans ohne Woche 0 (wie enduranceWeekVolumes).
 *    Unter ENDURANCE_SESSION_LIMITS.minSessionMinutes gilt die Woche wie „ohne Bezug“ (dann neuer Startumfang, wie
 *    enduranceReferenceFromMinutes) – keine Prüfung.
 * 3. Erholungswoche: Ausdauer ≤ floor(0,6 × Bezug) – in Tapering, Rennwoche und Erholung nach dem Rennen des
 *    Wettkampfplans ≤ floor(größter Faktor aus COMPETITION_PERIODIZATION × Bezug); je Übung Sätze ≤ ceil(0,5 × größte
 *    Satzzahl dieser Übung in einer Belastungswoche davor) und RPE-Ziel ≤ max(5, größtes RPE-Ziel davor − 2).
 * 4. Getauschte Woche D (deload_forward): je Einheit höchstens die Dosierung der ENTSPRECHENDEN Einheit in D − 1
 *    (swappedCounterpart: gleiche Vorlagen-Einheit, sonst gleicher Wochentag; gleiche Übung an gleicher Stelle → deren
 *    Sätze/RPE, sonst die kleinste Dosierung der Übung in D − 1), Kraft-Sätze der Woche ≤ D − 1 (eigener Code
 *    `swapped_week_sets_total`), Ausdauer-Minuten ≤ D − 1.
 * 5. Höchstens ein deload_forward je Block.
 */

export type InvariantCode =
  | 'too_many_load_weeks'
  | 'endurance_increase'
  | 'deload_endurance'
  | 'deload_sets'
  | 'deload_rpe'
  | 'swapped_week_above_previous'
  | 'swapped_week_sets_total'
  | 'second_deload_forward_in_block';

export interface InvariantViolation {
  readonly code: InvariantCode;
  readonly blockNo: number;
  readonly weekNo: number;
  readonly monday: string;
  readonly value: number;
  readonly limit: number;
  readonly exerciseId?: string;
  /** Einheit (ID, sonst Datum) und Stelle der Übung – nur bei Verstößen je Übung. */
  readonly sessionRef?: string;
  readonly orderNo?: number;
  /** Was verglichen wurde (Minuten, Sätze, RPE, Wochen, Anzahl). */
  readonly measure: 'minutes' | 'sets' | 'rpe' | 'weeks' | 'count';
}

export interface WeekInvariantOptions {
  /** loadWeeksBeforeDeload(Level, vorsichtig) des Plans. */
  readonly maxLoadWeeks: number;
  /** Belastungswochen direkt vor der ersten übergebenen Einheit (nur, wenn `sessions` nicht der ganze Plan ist). */
  readonly carriedLoadWeeks?: number;
  /** Planstart (user_plans.start_date): angebrochene erste Woche ohne Woche 0 ist nie Ausdauer-Bezug. */
  readonly planStart?: string;
  /** Nur Verstöße in Wochen ab diesem Montag melden (Bezug und Zähler laufen ab Planbeginn). */
  readonly fromMonday?: string;
  /** Wochen D, die durch deload_forward von der Erholungs- zur Belastungswoche wurden. */
  readonly swappedWeeks?: readonly { readonly blockNo: number; readonly weekNo: number }[];
}

/** Größter Umfangs-Faktor einer Wettkampf-Erholungswoche (Tapering, Rennwoche, Erholung nach dem Rennen). */
export const COMPETITION_DELOAD_MAX_FACTOR = Math.max(
  ENDURANCE_DELOAD_VOLUME_FACTOR,
  COMPETITION_PERIODIZATION.raceWeekFactor,
  ...COMPETITION_PERIODIZATION.recoveryFactors,
  ...Object.values(COMPETITION_PERIODIZATION.taperFactors).flat(),
);

const COMPETITION_OWN_FACTOR_PHASES: readonly string[] = ['taper', 'race_week', 'recovery'];

/** Umfangs-Faktor, den eine Erholungswoche höchstens haben darf. */
export function deloadVolumeFactor(week: Pick<PlanWeek, 'phase'>): number {
  return week.phase !== null && COMPETITION_OWN_FACTOR_PHASES.includes(week.phase)
    ? COMPETITION_DELOAD_MAX_FACTOR
    : ENDURANCE_DELOAD_VOLUME_FACTOR;
}

/** Angebrochene erste Woche (Planstart nicht am Montag, keine Woche 0) – nie Ausdauer-Bezug. */
function isPartialFirstWeek(
  week: PlanWeek,
  weeks: readonly PlanWeek[],
  planStart: string | undefined,
): boolean {
  const first = weeks[0];
  if (!first || week !== first || first.isWeekZero || first.blockNo !== 1) return false;
  const start = planStart ?? first.sessions[0]?.scheduled_on;
  return start !== undefined && isoWeekday(start) !== 1 && week.monday <= start;
}

export interface Occurrence {
  readonly sets: number;
  readonly rpe: number;
}

/** Größte Sätze und RPE je Übung in den übergebenen Wochen (Kraft). */
function maxDosage(weeks: readonly PlanWeek[]): Map<string, Occurrence> {
  const map = new Map<string, Occurrence>();
  for (const w of weeks) {
    for (const s of w.sessions) {
      for (const e of s.exercises) {
        const prev = map.get(e.exercise_id);
        map.set(e.exercise_id, {
          sets: Math.max(prev?.sets ?? 0, e.sets),
          rpe: Math.max(prev?.rpe ?? 0, e.rpe_target),
        });
      }
    }
  }
  return map;
}

const weekdayOf = (s: AdjustSession) => isoWeekday(s.original_date ?? s.scheduled_on);

/**
 * Gegenstück einer Einheit der getauschten Woche D in Woche D − 1 („entsprechende Einheit“, Tausch-Regel Punkt 4):
 * dieselbe Vorlagen-Einheit (bei mehreren die am selben Wochentag), sonst die Einheit am selben Wochentag (ursprünglicher
 * Tag bei Verschiebung). Gleiche Art (Kraft/Ausdauer).
 */
export function swappedCounterpart<S extends AdjustSession>(
  session: AdjustSession,
  previous: Pick<PlanWeek<S>, 'sessions'>,
): S | undefined {
  const sameKind = previous.sessions.filter((x) => x.kind === session.kind);
  const sameTemplate = sameKind.filter(
    (x) => x.template_day_index !== null && x.template_day_index === session.template_day_index,
  );
  return (
    sameTemplate.find((x) => weekdayOf(x) === weekdayOf(session)) ??
    sameTemplate[0] ??
    sameKind.find((x) => weekdayOf(x) === weekdayOf(session))
  );
}

/**
 * Obergrenze einer Übung (an `order_no`) in der getauschten Woche D: hat das Gegenstück in D − 1 an derselben Stelle
 * dieselbe Übung → genau deren Sätze und RPE; sonst die KLEINSTEN Sätze und das kleinste RPE dieser Übung in D − 1;
 * null = Übung kommt in D − 1 nicht vor (dann gilt nur die Wochensumme).
 */
export function swappedExerciseLimit(
  session: AdjustSession,
  exercise: { readonly order_no: number; readonly exercise_id: string },
  previous: Pick<PlanWeek, 'sessions'>,
): Occurrence | null {
  const twin = swappedCounterpart(session, previous);
  const same = twin?.exercises.find(
    (e) => e.order_no === exercise.order_no && e.exercise_id === exercise.exercise_id,
  );
  if (same) return { sets: same.sets, rpe: same.rpe_target };
  let min = null as Occurrence | null;
  for (const s of previous.sessions) {
    for (const e of s.exercises) {
      if (e.exercise_id !== exercise.exercise_id) continue;
      min = {
        sets: Math.min(min?.sets ?? Infinity, e.sets),
        rpe: Math.min(min?.rpe ?? Infinity, e.rpe_target),
      };
    }
  }
  return min;
}

/** Summe der Kraft-Sätze einer Woche. */
export const strengthSets = (sessions: readonly AdjustSession[]) =>
  sessions.reduce((sum, s) => sum + s.exercises.reduce((a, e) => a + e.sets, 0), 0);

/** Prüft alle Wochen-Invarianten; leere Liste = gültig. */
export function checkWeekInvariants(
  sessions: readonly AdjustSession[],
  options: WeekInvariantOptions,
): InvariantViolation[] {
  const weeks = planWeeks(sessions);
  const violations: InvariantViolation[] = [];
  const report = (week: PlanWeek, v: Omit<InvariantViolation, 'blockNo' | 'weekNo' | 'monday'>) => {
    if (options.fromMonday !== undefined && week.monday < options.fromMonday) return;
    violations.push({ blockNo: week.blockNo, weekNo: week.weekNo, monday: week.monday, ...v });
  };
  const swapped = options.swappedWeeks ?? [];
  const isSwapped = (w: PlanWeek) =>
    swapped.some((x) => x.blockNo === w.blockNo && x.weekNo === w.weekNo);

  let run = options.carriedLoadWeeks ?? 0;
  let reference: number | null = null;
  const nonDeloadBefore: PlanWeek[] = [];

  weeks.forEach((week, index) => {
    const minutes = enduranceMinutes(week.sessions);
    if (week.isWeekZero) {
      nonDeloadBefore.push(week);
      return;
    }
    if (week.isDeload) {
      run = 0;
      if (reference !== null) {
        const limit = scaledMinutes(reference, deloadVolumeFactor(week));
        if (minutes > limit) {
          report(week, { code: 'deload_endurance', measure: 'minutes', value: minutes, limit });
        }
      }
      const ref = maxDosage(nonDeloadBefore);
      for (const s of week.sessions) {
        for (const e of s.exercises) {
          const r = ref.get(e.exercise_id);
          if (!r) continue;
          const setsLimit = Math.max(1, Math.ceil(r.sets * DELOAD_DOSAGE.setsFactor));
          if (e.sets > setsLimit) {
            report(week, {
              code: 'deload_sets',
              measure: 'sets',
              value: e.sets,
              limit: setsLimit,
              exerciseId: e.exercise_id,
              sessionRef: s.id ?? s.scheduled_on,
              orderNo: e.order_no,
            });
          }
          const rpeLimit = Math.max(
            TEMPLATE_DOSAGE_LIMITS.rpe.min,
            r.rpe - DELOAD_DOSAGE.rpeReduction,
          );
          if (e.rpe_target > rpeLimit) {
            report(week, {
              code: 'deload_rpe',
              measure: 'rpe',
              value: e.rpe_target,
              limit: rpeLimit,
              exerciseId: e.exercise_id,
              sessionRef: s.id ?? s.scheduled_on,
              orderNo: e.order_no,
            });
          }
        }
      }
      return;
    }
    // Belastungswoche
    run += 1;
    if (run > options.maxLoadWeeks) {
      report(week, {
        code: 'too_many_load_weeks',
        measure: 'weeks',
        value: run,
        limit: options.maxLoadWeeks,
      });
    }
    if (reference !== null) {
      const limit = increasedMinutes(reference);
      if (minutes > limit) {
        report(week, { code: 'endurance_increase', measure: 'minutes', value: minutes, limit });
      }
    }
    if (isSwapped(week)) {
      const previous = weeks[index - 1];
      const prevLoad = previous && isLoadPlanWeek(previous) ? previous : undefined;
      if (prevLoad) {
        const prevMinutes = enduranceMinutes(prevLoad.sessions);
        if (minutes > prevMinutes) {
          report(week, {
            code: 'swapped_week_above_previous',
            measure: 'minutes',
            value: minutes,
            limit: prevMinutes,
          });
        }
      }
      if (prevLoad) {
        // Je Einheit: Gegenstück in D − 1 (gleiche Übung an gleicher Stelle), sonst kleinste Dosierung der Übung in D − 1.
        for (const s of week.sessions) {
          for (const e of s.exercises) {
            const r = swappedExerciseLimit(s, e, prevLoad);
            if (!r) continue;
            const where = {
              exerciseId: e.exercise_id,
              sessionRef: s.id ?? s.scheduled_on,
              orderNo: e.order_no,
            };
            if (e.sets > r.sets) {
              report(week, {
                code: 'swapped_week_above_previous',
                measure: 'sets',
                value: e.sets,
                limit: r.sets,
                ...where,
              });
            }
            if (e.rpe_target > r.rpe) {
              report(week, {
                code: 'swapped_week_above_previous',
                measure: 'rpe',
                value: e.rpe_target,
                limit: r.rpe,
                ...where,
              });
            }
          }
        }
        const sets = strengthSets(week.sessions);
        const prevSets = strengthSets(prevLoad.sessions);
        if (sets > prevSets) {
          report(week, {
            code: 'swapped_week_sets_total',
            measure: 'sets',
            value: sets,
            limit: prevSets,
          });
        }
      }
    }
    nonDeloadBefore.push(week);
    if (!isPartialFirstWeek(week, weeks, options.planStart)) {
      reference = minutes >= ENDURANCE_SESSION_LIMITS.minSessionMinutes ? minutes : null;
    }
  });

  const perBlock = new Map<number, number>();
  for (const x of swapped) perBlock.set(x.blockNo, (perBlock.get(x.blockNo) ?? 0) + 1);
  for (const [blockNo, count] of perBlock) {
    if (count <= 1) continue;
    const week = weeks.find((w) => w.blockNo === blockNo);
    if (week) {
      report(week, {
        code: 'second_deload_forward_in_block',
        measure: 'count',
        value: count,
        limit: 1,
      });
    }
  }
  return violations;
}

/** Schlüssel eines Verstoßes (Regel, Woche, Messgröße, Einheit und Stelle der Übung) für den Vorher/Nachher-Vergleich. */
const violationKey = (v: InvariantViolation) =>
  [
    v.code,
    v.measure,
    v.blockNo,
    v.weekNo,
    v.sessionRef ?? '',
    v.orderNo ?? '',
    v.exerciseId ?? '',
  ].join('|');

/** Überschreitung eines Verstoßes (Wert über der Grenze). */
const excess = (v: InvariantViolation) => v.value - v.limit;

/**
 * Nur NEU entstandene bzw. VERSCHLIMMERTE Verstöße (Wächter-Auflage 5 und Nachprüfung): Ein schon vorher bestehender
 * Verstoß (z. B. Neustart der Ausdauer-Kette am Blockrand ohne Tagebuch-Bezug) blockiert keine spätere Anpassung. Neu ist
 * ein Verstoß, wenn es ihn vorher (gleicher Schlüssel) nicht gab oder seine Überschreitung `value − limit` gewachsen ist –
 * auch wenn nur die Grenze gesunken ist. Vergleich als Multimenge: je Schlüssel werden die Überschreitungen absteigend
 * paarweise verglichen, ein zusätzlicher gleicher Verstoß ist immer neu. Dieselbe Regel gilt für die SQL-Nachrechnung
 * (Etappe B, PLAN-PHASE-4B 4.6).
 */
export function newInvariantViolations(
  before: readonly AdjustSession[],
  after: readonly AdjustSession[],
  options: WeekInvariantOptions,
  optionsBefore: WeekInvariantOptions = options,
): InvariantViolation[] {
  const group = (list: readonly InvariantViolation[]) => {
    const map = new Map<string, InvariantViolation[]>();
    for (const v of list) map.set(violationKey(v), [...(map.get(violationKey(v)) ?? []), v]);
    for (const vs of map.values()) vs.sort((a, b) => excess(b) - excess(a));
    return map;
  };
  const old = group(checkWeekInvariants(before, optionsBefore));
  const out: InvariantViolation[] = [];
  for (const [key, vs] of group(checkWeekInvariants(after, options))) {
    const prev = old.get(key) ?? [];
    vs.forEach((v, i) => {
      const p = prev[i];
      if (p === undefined || excess(v) > excess(p)) out.push(v);
    });
  }
  return out;
}
