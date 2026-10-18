import { ENDURANCE_SESSION_LIMITS, LIVE_ADJUSTMENT, SESSION_FIT } from '../constants';
import type { Exercise } from '../content/schemas';
import { adaptedSessionMinutes } from '../plan/adapt';
import { deloadDosage } from '../plan/deload';
import { easyWorkout } from '../plan/endurance-workouts';
import { isoWeekday } from '../dates';
import { increasedMinutes, scaledMinutes } from '../plan/volume';
import type { StoredSession } from '../plan/view';
import {
  deloadVolumeFactor,
  strengthSets,
  swappedCounterpart,
  swappedExerciseLimit,
} from './invariants';
import type { ExerciseChange, PlanChange, SessionChange } from './types';
import { enduranceMinutes, type PlanWeek, planWeeks } from './weeks';

/**
 * Plan-Änderungen der Regeln R3/R4 (docs/PLAN-PHASE-4B.md 5.2): bauen `change_before`/`change_after` für Einheiten,
 * die eine Änderung treffen darf (eligiblePlannedSessions, Wächter S1), und wenden sie auf Einheiten an. Rein; die
 * Prüfung der Wochen-Invarianten macht der Aufrufer (checkWeekInvariants).
 */

/** Vorher/Nachher einer Plan-Änderung (gleiche Schlüssel). */
export interface PlanChangePair {
  readonly before: PlanChange;
  readonly after: PlanChange;
}

const EMPTY: PlanChangePair = { before: { sessions: [] }, after: { sessions: [] } };

/** Kleinste Satzzahl einer Übung beim Kürzen (SESSION_FIT: Grundübung 2, Isolationsübung 1). */
export function minSetsFor(exerciseId: string, library: ReadonlyMap<string, Exercise>): number {
  return library.get(exerciseId)?.mechanics === 'isolation'
    ? SESSION_FIT.minSetsIsolation
    : SESSION_FIT.minSetsCompound;
}

/** Wendet `change.sessions` (Nachher-Werte) auf die Einheiten an; unbekannte IDs bleiben ohne Wirkung. */
export function applyPlanChange<S extends StoredSession>(
  sessions: readonly S[],
  change: PlanChange,
): S[] {
  const byId = new Map(change.sessions.map((c) => [c.id, c] as const));
  return sessions.map((s) => {
    const c = byId.get(s.id);
    if (!c) return s;
    const exercises = c.exercises
      ? s.exercises.map((e) => {
          const ec = c.exercises?.find((x) => x.order_no === e.order_no);
          if (!ec) return e;
          return {
            ...e,
            ...(ec.sets === undefined ? {} : { sets: ec.sets }),
            ...(ec.rpe_target === undefined ? {} : { rpe_target: ec.rpe_target }),
            ...(ec.exercise_id === undefined ? {} : { exercise_id: ec.exercise_id }),
            ...(ec.exercise_name_de === undefined ? {} : { exercise_name_de: ec.exercise_name_de }),
          };
        })
      : s.exercises;
    return {
      ...s,
      ...(c.is_deload === undefined ? {} : { is_deload: c.is_deload }),
      ...(c.estimated_minutes === undefined ? {} : { estimated_minutes: c.estimated_minutes }),
      ...(c.workout_steps === undefined ? {} : { workout_steps: c.workout_steps }),
      ...(c.target_distance_m === undefined ? {} : { target_distance_m: c.target_distance_m }),
      exercises,
    };
  });
}

/** Führt zwei Änderungen zusammen (spätere gewinnt je Feld; `before` bleibt der früheste Stand). */
export function mergeChanges(a: PlanChangePair, b: PlanChangePair): PlanChangePair {
  const merge = (x: readonly SessionChange[], y: readonly SessionChange[], keepFirst: boolean) => {
    const out = new Map<string, SessionChange>(x.map((c) => [c.id, c]));
    for (const c of y) {
      const prev = out.get(c.id);
      if (!prev) {
        out.set(c.id, c);
        continue;
      }
      const [first, second] = keepFirst ? [c, prev] : [prev, c];
      const exercises = new Map<number, ExerciseChange>();
      for (const e of first.exercises ?? []) exercises.set(e.order_no, e);
      for (const e of second.exercises ?? []) {
        exercises.set(e.order_no, { ...(exercises.get(e.order_no) ?? {}), ...e });
      }
      out.set(c.id, {
        ...first,
        ...second,
        ...(exercises.size > 0
          ? { exercises: [...exercises.values()].sort((p, q) => p.order_no - q.order_no) }
          : {}),
      });
    }
    return [...out.values()].sort((p, q) => p.id.localeCompare(q.id));
  };
  return {
    before: { sessions: merge(a.before.sessions, b.before.sessions, true) },
    after: { sessions: merge(a.after.sessions, b.after.sessions, false) },
  };
}

/** R3 Kraft `volume_reduce`: in den Kraft-Einheiten der Woche je Übung 1 Satz weniger (nie unter SESSION_FIT). */
export function volumeReduceChange(
  week: PlanWeek<StoredSession>,
  eligible: ReadonlySet<string>,
  library: ReadonlyMap<string, Exercise>,
): PlanChangePair {
  const before: SessionChange[] = [];
  const after: SessionChange[] = [];
  for (const s of week.sessions) {
    if (s.kind !== 'strength' || !eligible.has(s.id)) continue;
    const changed = s.exercises.filter(
      (e) =>
        e.sets - LIVE_ADJUSTMENT.highSessionLoad.setsReduction >=
        minSetsFor(e.exercise_id, library),
    );
    if (changed.length === 0) continue;
    const newExercises = s.exercises.map((e) =>
      changed.includes(e)
        ? { ...e, sets: e.sets - LIVE_ADJUSTMENT.highSessionLoad.setsReduction }
        : e,
    );
    before.push({
      id: s.id,
      estimated_minutes: s.estimated_minutes,
      exercises: changed.map((e) => ({ order_no: e.order_no, sets: e.sets })),
    });
    after.push({
      id: s.id,
      estimated_minutes: adaptedSessionMinutes({ exercises: newExercises }),
      exercises: changed.map((e) => ({
        order_no: e.order_no,
        sets: e.sets - LIVE_ADJUSTMENT.highSessionLoad.setsReduction,
      })),
    });
  }
  return { before: { sessions: before }, after: { sessions: after } };
}

/** Lockere Wettkampf-Art, deren Schritte sich aus der Dauer neu ergeben (easyWorkout). */
const RESCALABLE_TYPES = ['easy', 'recovery', 'long'] as const;

/**
 * Darf die Dauer einer Ausdauer-Einheit gesenkt werden? Ohne Wettkampf immer; im Wettkampfplan nur lockere Arten
 * (locker, Erholung, lang) – harte Einheiten, Steigerungen, Koppeltraining und Technik behalten ihre Schritte
 * (vorsichtige Lösung: deren Aufbau hängt an der Dauer, Plan 3.4/3.5 von PLAN-PHASE-10).
 */
export function isReducibleEndurance(s: StoredSession): boolean {
  if (s.kind !== 'endurance') return false;
  if (s.workout_type === undefined || s.workout_type === null) return s.workout_steps == null;
  return (RESCALABLE_TYPES as readonly string[]).includes(s.workout_type);
}

/** Neue Dauer einer Ausdauer-Einheit samt passender Schritte (Wettkampf: lockere Art neu aus easyWorkout). */
function minutesChange(
  s: StoredSession,
  minutes: number,
): { before: SessionChange; after: SessionChange } {
  const base = { id: s.id };
  if (s.workout_steps == null || s.workout_type == null) {
    return {
      before: { ...base, estimated_minutes: s.estimated_minutes },
      after: { ...base, estimated_minutes: minutes },
    };
  }
  const type = s.workout_type as (typeof RESCALABLE_TYPES)[number];
  const effort = s.workout_steps.find((st) => st.part === 'main')?.effort ?? s.effort_target ?? 3;
  const steps = easyWorkout(type, minutes, effort).steps;
  return {
    before: {
      ...base,
      estimated_minutes: s.estimated_minutes,
      workout_steps: s.workout_steps,
      target_distance_m: s.target_distance_m ?? null,
    },
    after: {
      ...base,
      estimated_minutes: minutes,
      workout_steps: steps,
      // Distanz-Richtwert passt nicht mehr zur kürzeren Dauer → entfällt (vorsichtig, kein neuer Pace-Bezug).
      target_distance_m: null,
    },
  };
}

/** Kürzt Einheiten (längste zuerst, nie unter das Minimum), bis die Summe ≤ `limit` ist. */
function reduceToLimit(
  sessions: readonly StoredSession[],
  limit: number,
  canChange: (s: StoredSession) => boolean,
): Map<string, number> {
  const minutes = new Map(
    sessions.filter((s) => s.kind === 'endurance').map((s) => [s.id, s.estimated_minutes] as const),
  );
  let excess = [...minutes.values()].reduce((a, b) => a + b, 0) - limit;
  const min = ENDURANCE_SESSION_LIMITS.minSessionMinutes;
  while (excess > 0) {
    const candidates = sessions
      .filter((s) => s.kind === 'endurance' && canChange(s) && (minutes.get(s.id) ?? 0) > min)
      .sort(
        (a, b) => (minutes.get(b.id) ?? 0) - (minutes.get(a.id) ?? 0) || a.id.localeCompare(b.id),
      );
    const top = candidates[0];
    if (!top) break;
    const current = minutes.get(top.id) as number;
    const cut = Math.min(excess, current - min);
    minutes.set(top.id, current - cut);
    excess -= cut;
  }
  return minutes;
}

/**
 * Deckelt die Ausdauer der Wochen NACH `fromIndex` im selben Block neu (nur senken, nie erhöhen): Belastungswoche ≤ floor(1,1 ×
 * Bezug), Erholungswoche ≤ floor(0,6 × Bezug) – gleiche Bezugs-Regeln wie checkWeekInvariants. Nur Einheiten aus
 * `eligible` und nur senkbare Arten; reicht das nicht, bleibt der Rest (die Invarianten-Prüfung verwirft dann).
 */
export function recapEndurance(
  sessions: readonly StoredSession[],
  fromIndex: number,
  eligible: ReadonlySet<string>,
  planStart?: string,
): PlanChangePair {
  const weeks = planWeeks(sessions);
  const blockNo = weeks[fromIndex]?.blockNo;
  let reference: number | null = null;
  let pair = EMPTY;
  const first = weeks[0];
  const partialFirst =
    first !== undefined &&
    !first.isWeekZero &&
    first.blockNo === 1 &&
    (() => {
      const start = planStart ?? first.sessions[0]?.scheduled_on;
      return start !== undefined && isoWeekday(start) !== 1 && first.monday <= start;
    })();
  weeks.forEach((week, index) => {
    if (week.isWeekZero) return;
    let minutes = enduranceMinutes(week.sessions);
    // Nur Folgewochen DESSELBEN Blocks (Plan 5.2 R3); spätere Blöcke rechnen ihren Bezug beim Erzeugen selbst.
    if (index > fromIndex && week.blockNo === blockNo && reference !== null) {
      const limit = week.isDeload
        ? scaledMinutes(reference, deloadVolumeFactor(week))
        : increasedMinutes(reference);
      if (minutes > limit) {
        const target = reduceToLimit(
          week.sessions,
          limit,
          (s) => eligible.has(s.id) && isReducibleEndurance(s),
        );
        const before: SessionChange[] = [];
        const after: SessionChange[] = [];
        for (const s of week.sessions) {
          const m = target.get(s.id);
          if (m === undefined || m === s.estimated_minutes) continue;
          const c = minutesChange(s, m);
          before.push(c.before);
          after.push(c.after);
        }
        pair = mergeChanges(pair, { before: { sessions: before }, after: { sessions: after } });
        minutes = [...target.values()].reduce((a, b) => a + b, 0);
      }
    }
    if (!week.isDeload && !(index === 0 && partialFirst)) {
      reference = minutes >= ENDURANCE_SESSION_LIMITS.minSessionMinutes ? minutes : null;
    }
  });
  return pair;
}

/**
 * R3 Ausdauer `endurance_reduce`: Minuten der Ausdauer-Einheiten der Woche × 0,85 (abgerundet; nie unter dem Minimum,
 * nie über dem bisherigen Wert), danach die Folgewochen neu gedeckelt (recapEndurance).
 */
export function enduranceReduceChange(
  sessions: readonly StoredSession[],
  week: PlanWeek<StoredSession>,
  eligible: ReadonlySet<string>,
  planStart?: string,
): PlanChangePair {
  const before: SessionChange[] = [];
  const after: SessionChange[] = [];
  const min = ENDURANCE_SESSION_LIMITS.minSessionMinutes;
  for (const s of week.sessions) {
    if (!eligible.has(s.id) || !isReducibleEndurance(s)) continue;
    const reduced = Math.min(
      s.estimated_minutes,
      Math.max(min, Math.floor(s.estimated_minutes * LIVE_ADJUSTMENT.enduranceReduce.factor)),
    );
    if (reduced >= s.estimated_minutes) continue;
    const c = minutesChange(s, reduced);
    before.push(c.before);
    after.push(c.after);
  }
  if (after.length === 0) return EMPTY;
  const first: PlanChangePair = { before: { sessions: before }, after: { sessions: after } };
  const changed = applyPlanChange(sessions, first.after);
  const index = planWeeks(changed).findIndex(
    (w) => w.blockNo === week.blockNo && w.weekNo === week.weekNo,
  );
  return mergeChanges(first, recapEndurance(changed, index, eligible, planStart));
}

/**
 * Tausch-Regel `deload_forward` (Plan 5.2, Wächter B2): Woche n wird Erholungswoche (deloadDosage, Ausdauer
 * floor(0,6 × Woche k)), Wochen n+1 … D−1 Ausdauer neu gedeckelt, Woche D wird Belastungswoche mit höchstens der
 * Dosierung der Woche D − 1 (Kraft je Übung: Sätze und RPE der letzten Belastungs-Fassung dieser Übung in derselben
 * Vorlagen-Einheit bis D − 1; Ausdauer je Wochentag die Minuten aus D − 1, ohne Gegenstück bleibt der kleinere Wert).
 * `rpeMax` = aktueller RPE-Deckel. Voraussetzungen (Abstand, Zulässigkeit, eine je Block) prüft der Aufrufer.
 */
export function deloadForwardChange(
  sessions: readonly StoredSession[],
  weeks: readonly PlanWeek<StoredSession>[],
  indices: { readonly k: number; readonly n: number; readonly d: number },
  eligible: ReadonlySet<string>,
  rpeMax: number,
  planStart?: string,
): PlanChangePair {
  const weekK = weeks[indices.k] as PlanWeek<StoredSession>;
  const weekN = weeks[indices.n] as PlanWeek<StoredSession>;
  const weekD = weeks[indices.d] as PlanWeek<StoredSession>;
  const before: SessionChange[] = [];
  const after: SessionChange[] = [];

  // Woche n → Erholungswoche.
  const nEndurance = weekN.sessions.filter((s) => s.kind === 'endurance');
  const budget = scaledMinutes(enduranceMinutes(weekK.sessions), deloadVolumeFactor(weekN));
  const nTarget = reduceToLimit(nEndurance, budget, () => true);
  for (const s of weekN.sessions) {
    if (s.kind === 'strength') {
      const exercises = s.exercises.map((e) => {
        const d = deloadDosage(e);
        return { ...d, rpe_target: Math.min(d.rpe_target, rpeMax) };
      });
      before.push({
        id: s.id,
        is_deload: s.is_deload,
        estimated_minutes: s.estimated_minutes,
        exercises: s.exercises.map((e) => ({
          order_no: e.order_no,
          sets: e.sets,
          rpe_target: e.rpe_target,
        })),
      });
      after.push({
        id: s.id,
        is_deload: true,
        estimated_minutes: adaptedSessionMinutes({ exercises }),
        exercises: exercises.map((e) => ({
          order_no: e.order_no,
          sets: e.sets,
          rpe_target: e.rpe_target,
        })),
      });
    } else {
      const m = nTarget.get(s.id) ?? s.estimated_minutes;
      before.push({ id: s.id, is_deload: s.is_deload, estimated_minutes: s.estimated_minutes });
      after.push({ id: s.id, is_deload: true, estimated_minutes: m });
    }
  }

  let pair: PlanChangePair = { before: { sessions: before }, after: { sessions: after } };
  // Ausdauer der Wochen n+1 … neu deckeln – Bezug ist Woche k, Woche n ist nie Bezug.
  let changed = applyPlanChange(sessions, pair.after);
  const nIndex = planWeeks(changed).findIndex(
    (w) => w.blockNo === weekN.blockNo && w.weekNo === weekN.weekNo,
  );
  pair = mergeChanges(pair, recapEndurance(changed, nIndex, eligible, planStart));
  changed = applyPlanChange(sessions, pair.after);

  // Woche D → Belastungswoche mit höchstens der Dosierung von D − 1 (nach dem Neu-Deckeln), je Einheit wie die
  // ENTSPRECHENDE Einheit in D − 1 (swappedCounterpart: gleiche Vorlagen-Einheit, sonst gleicher Wochentag) – dieselbe
  // Regel wie checkWeekInvariants. Ohne Gegenstück die kleinste Dosierung der Übung in D − 1; kommt die Übung dort nicht
  // vor, bleibt die (niedrigere) Erholungs-Dosierung. Danach höchstens so viele Sätze wie Woche D − 1 insgesamt.
  const after2 = planWeeks(changed);
  const dWeek = after2[indices.d] as PlanWeek<StoredSession>;
  const prevWeek = after2[indices.d - 1] as PlanWeek<StoredSession>;
  const dBefore: SessionChange[] = [];
  const dAfter: SessionChange[] = [];
  // Erst die Ziel-Dosierung je Einheit, dann der Wochen-Deckel der Sätze.
  const plannedD = dWeek.sessions.map((s) => ({
    s,
    exercises: s.exercises.map((e) => {
      const lim = swappedExerciseLimit(s, e, prevWeek);
      return lim
        ? {
            order_no: e.order_no,
            sets: lim.sets,
            floor: Math.min(e.sets, lim.sets),
            rpe_target: Math.min(lim.rpe, rpeMax),
          }
        : { order_no: e.order_no, sets: e.sets, floor: e.sets, rpe_target: e.rpe_target };
    }),
  }));
  const cap = strengthSets(prevWeek.sessions);
  let total = plannedD.reduce((sum, x) => sum + x.exercises.reduce((a, e) => a + e.sets, 0), 0);
  while (total > cap) {
    const candidates = plannedD
      .flatMap((x) => x.exercises.filter((e) => e.sets > e.floor))
      .sort((a, b) => b.sets - b.floor - (a.sets - a.floor) || b.sets - a.sets);
    const top = candidates[0];
    if (!top) break;
    top.sets -= 1;
    total -= 1;
  }
  for (const { s, exercises: planned } of plannedD) {
    const original = weekD.sessions.find((x) => x.id === s.id) ?? s;
    if (s.kind === 'strength') {
      const exercises = planned.map((e) => ({
        order_no: e.order_no,
        sets: e.sets,
        rpe_target: e.rpe_target,
      }));
      const full = s.exercises.map((e) => {
        const c = exercises.find((x) => x.order_no === e.order_no);
        return c ? { ...e, sets: c.sets, rpe_target: c.rpe_target } : e;
      });
      dBefore.push({
        id: s.id,
        is_deload: original.is_deload,
        estimated_minutes: original.estimated_minutes,
        exercises: original.exercises.map((e) => ({
          order_no: e.order_no,
          sets: e.sets,
          rpe_target: e.rpe_target,
        })),
      });
      dAfter.push({
        id: s.id,
        is_deload: false,
        estimated_minutes: adaptedSessionMinutes({ exercises: full }),
        exercises,
      });
    } else {
      const twin = swappedCounterpart(s, prevWeek);
      dBefore.push({
        id: s.id,
        is_deload: original.is_deload,
        estimated_minutes: original.estimated_minutes,
      });
      dAfter.push({
        id: s.id,
        is_deload: false,
        // Ohne Gegenstück in D − 1 bleibt die (niedrigere) Erholungs-Dauer.
        estimated_minutes: twin ? twin.estimated_minutes : s.estimated_minutes,
      });
    }
  }
  // D-Vorher immer der Ursprungs-Stand (mergeChanges behält das früheste `before`).
  pair = mergeChanges(pair, { before: { sessions: dBefore }, after: { sessions: dAfter } });
  changed = applyPlanChange(sessions, pair.after);
  return mergeChanges(pair, recapEndurance(changed, indices.d, eligible, planStart));
}

/** R4 `stagnation_variation`: Übung in den Einheiten ersetzen (Dosierung des Platzes bleibt). */
export function swapChange(
  sessions: readonly StoredSession[],
  exerciseId: string,
  replacement: Pick<Exercise, 'id' | 'name_de'>,
): PlanChangePair {
  const before: SessionChange[] = [];
  const after: SessionChange[] = [];
  for (const s of sessions) {
    const hits = s.exercises.filter((e) => e.exercise_id === exerciseId);
    if (hits.length === 0) continue;
    before.push({
      id: s.id,
      exercises: hits.map((e) => ({
        order_no: e.order_no,
        exercise_id: e.exercise_id,
        exercise_name_de: e.exercise_name_de,
      })),
    });
    after.push({
      id: s.id,
      exercises: hits.map((e) => ({
        order_no: e.order_no,
        exercise_id: replacement.id,
        exercise_name_de: replacement.name_de,
      })),
    });
  }
  return { before: { sessions: before }, after: { sessions: after } };
}

/** IDs der Einheiten einer Änderung (sortiert). */
export const changedSessionIds = (pair: PlanChangePair) =>
  [...new Set(pair.after.sessions.map((s) => s.id))].sort();
