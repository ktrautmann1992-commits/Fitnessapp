/** Nur für Tests: simuliert die App (Vorgabe anzeigen → trainieren → Eintrag speichern). */
import {
  buildExerciseLogEntry,
  type PlannedDosage,
  type Prescription,
  prescriptionForDisplay,
  type ProgressOptions,
  progressFromLogs,
  type ProgressResult,
} from './progression';
import type { ExerciseLogEntry, LoggedSet, ProgressionContext } from './types';

export interface SimStep {
  readonly date: string;
  readonly isDeload?: boolean;
  readonly isIntroWeek?: boolean;
  /** Sätze dieser Fassung (Standard: planned.sets). */
  readonly plannedSets?: number;
  /** Stufen am Ort dieser Einheit (Standard: ctx.steps). */
  readonly steps?: readonly number[];
  readonly weightConfirmed?: boolean;
  readonly perform: (p: Prescription) => LoggedSet[];
}

export interface SimRecord {
  readonly result: ProgressResult;
  readonly prescription: Prescription;
  readonly entry: ExerciseLogEntry;
}

/** Alle Sätze der Vorgabe mit `reps` Wiederholungen (und dem angezeigten Gewicht bzw. `weightKg`). */
export const all =
  (reps: number, options: { rpe?: number | null; weightKg?: number | null } = {}) =>
  (p: Prescription): LoggedSet[] =>
    Array.from({ length: p.sets }, () => ({
      reps,
      weightKg: options.weightKg !== undefined ? options.weightKg : p.weightKg,
      durationS: null,
      rpe: options.rpe ?? null,
      done: true,
    }));

/** Halteübung: alle Sätze mit `durationS` Sekunden. */
export const hold =
  (durationS: number) =>
  (p: Prescription): LoggedSet[] =>
    Array.from({ length: p.sets }, () => ({
      reps: null,
      weightKg: null,
      durationS,
      rpe: null,
      done: true,
    }));

/** Genau das Angezeigte schaffen (Ziel-Wdh. in allen Sätzen). */
export const asShown = (p: Prescription): LoggedSet[] => all(p.targetReps ?? 0)(p);

export function simulate(
  exerciseId: string,
  ctx: ProgressionContext,
  planned: PlannedDosage,
  steps: readonly SimStep[],
  options: {
    readonly initial?: readonly ExerciseLogEntry[];
    readonly progress?: Omit<ProgressOptions, 'today'>;
    /** Stichtag für `next` (Standard: Datum der letzten Einheit). */
    readonly today?: string;
  } = {},
): { entries: ExerciseLogEntry[]; records: SimRecord[]; next: ProgressResult } {
  const entries: ExerciseLogEntry[] = [...(options.initial ?? [])];
  const records: SimRecord[] = [];
  steps.forEach((step, index) => {
    const local = { ...ctx, steps: step.steps ?? ctx.steps ?? [] };
    const result = progressFromLogs(exerciseId, entries, local, {
      ...options.progress,
      today: step.date,
    });
    const rpe = planned.rpe_target - (step.isIntroWeek ? 1 : 0) - (step.isDeload ? 2 : 0);
    const prescription = prescriptionForDisplay(
      { ...planned, sets: step.plannedSets ?? planned.sets, rpe_target: Math.max(5, rpe) },
      result,
      { isDeload: step.isDeload ?? false, steps: local.steps },
    );
    const entry = buildExerciseLogEntry({
      exerciseId,
      performedOn: step.date,
      loggedAt: `${step.date}T18:00:${String(index % 60).padStart(2, '0')}Z`,
      status: 'done',
      loadType: ctx.loadType,
      isIntroWeek: step.isIntroWeek ?? false,
      isDeload: step.isDeload ?? false,
      progress: result,
      prescription,
      weightConfirmed: step.weightConfirmed ?? false,
      sets: step.perform(prescription),
    });
    entries.push(entry);
    records.push({ result, prescription, entry });
  });
  return {
    entries,
    records,
    next: progressFromLogs(
      exerciseId,
      entries,
      { ...ctx, steps: ctx.steps ?? [] },
      {
        ...options.progress,
        today:
          options.today ??
          steps.at(-1)?.date ??
          options.initial?.at(-1)?.performedOn ??
          '2026-10-05',
      },
    ),
  };
}

/** Fortlaufende Daten ab `start` im Abstand `everyDays`. */
export function dates(start: string, count: number, everyDays = 2): string[] {
  const out: string[] = [];
  const base = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i += 1) {
    out.push(new Date(base + i * everyDays * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}
