import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { isCountingEntry, type PlannedDosage, progressFromLogs } from './progression';
import { all, asShown, dates, simulate } from './test-helpers';
import type { ExerciseLogEntry, LoggedSet, ProgressionContext } from './types';

/**
 * Etappe A1b: Freie Einheiten zählen nie für Progression und Kalibrierung (isCountingEntry, entriesForExercise) –
 * konservativ wie verwaiste Einträge. Eine nachgetragene GEPLANTE Einheit zählt normal (Reihenfolge nach
 * performed_on).
 */

const ctx: ProgressionContext = {
  loadType: 'weight',
  repsMin: 8,
  repsMax: 12,
  durationS: null,
  templateSets: 3,
  rpeTarget: 8,
  incrementKind: 'free_weight',
  steps: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22.5, 25, 27.5, 30, 32.5, 35, 40, 45, 50],
};
const planned: PlannedDosage = {
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_s: null,
  rpe_target: 8,
};

const freeEntry = (
  performedOn: string,
  sets: LoggedSet[],
  extra: Partial<ExerciseLogEntry> = {},
): ExerciseLogEntry => ({
  exerciseId: 'x',
  performedOn,
  loggedAt: `${performedOn}T19:00:00Z`,
  status: 'done',
  loadType: 'weight',
  isIntroWeek: false,
  isDeload: false,
  isFree: true,
  targetSets: null,
  targetWeightKg: null,
  targetReps: null,
  targetExtraSet: null,
  targetRpe: null,
  state: null,
  weightConfirmed: true,
  sets,
  ...extra,
});
const heavy = (kg: number, reps = 12, count = 3): LoggedSet[] =>
  Array.from({ length: count }, () => ({
    reps,
    weightKg: kg,
    durationS: null,
    rpe: 6,
    done: true,
  }));

describe('isCountingEntry', () => {
  it('freie Einträge zählen nie', () => {
    expect(isCountingEntry({ isIntroWeek: false, isDeload: false, isFree: true })).toBe(false);
    expect(isCountingEntry({ isIntroWeek: false, isDeload: false, isFree: false })).toBe(true);
    expect(isCountingEntry({ isIntroWeek: false, isDeload: false })).toBe(true);
  });
});

describe('progressFromLogs ignoriert freie Einträge', () => {
  it('ohne Verlauf: eine freie Einheit kalibriert nicht', () => {
    const today = '2026-10-15';
    const without = progressFromLogs('x', [], ctx, { today });
    const withFree = progressFromLogs('x', [freeEntry('2026-10-14', heavy(30))], ctx, { today });
    expect(withFree).toEqual(without);
    expect(withFree.source).toBe('none');
  });

  it('mit Startgewicht: bleibt beim Startgewicht', () => {
    const today = '2026-10-15';
    const result = progressFromLogs('x', [freeEntry('2026-10-14', heavy(40))], ctx, {
      today,
      startWeightKg: 10,
    });
    expect(result.source).toBe('start_weight');
    expect(result.progress.weightKg).toBe(10);
  });

  it('nach geplanten Einheiten: freie (schwerer, mehr Wdh.) ändern nichts – auch nicht die Pause', () => {
    const days = dates('2026-08-01', 6, 3);
    const sim = simulate(
      'x',
      ctx,
      planned,
      days.map((date) => ({ date, perform: asShown })),
      { progress: { startWeightKg: 12 } },
    );
    // 40 Tage später: Pause (RETURN_AFTER_PAUSE). Eine freie Einheit gestern setzt die Pausen-Uhr NICHT zurück.
    const today = addDays(days.at(-1) as string, 40);
    const base = progressFromLogs('x', sim.entries, ctx, { today });
    const withFree = progressFromLogs(
      'x',
      [...sim.entries, freeEntry(addDays(today, -1), heavy(50, 15, 5))],
      ctx,
      { today },
    );
    expect(base.returnAfterPause).toBe(true);
    expect(withFree).toEqual(base);
  });

  it('nachgetragene GEPLANTE Einheit zählt normal (Reihenfolge nach performed_on)', () => {
    const days = dates('2026-10-01', 3, 2);
    const sim = simulate(
      'x',
      ctx,
      planned,
      days.map((date) => ({ date, perform: all(12) })),
      { progress: { startWeightKg: 12 } },
    );
    // Den letzten Eintrag „später eingetragen“ (loggedAt viel später) – Ergebnis bleibt gleich.
    const late = sim.entries.map((e, i) =>
      i === sim.entries.length - 1 ? { ...e, loggedAt: '2026-10-14T20:00:00Z' } : e,
    );
    const today = '2026-10-15';
    expect(progressFromLogs('x', late, ctx, { today }).progress).toEqual(
      progressFromLogs('x', sim.entries, ctx, { today }).progress,
    );
  });

  it('Eigenschaft: beliebig viele freie Einträge an beliebigen Tagen ändern das Ergebnis nie (400 Folgen)', () => {
    let seed = 11;
    const r = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 400; run += 1) {
      const count = 1 + Math.floor(r() * 8);
      const days = dates('2026-08-01', count, 1 + Math.floor(r() * 4));
      const sim = simulate(
        'x',
        ctx,
        planned,
        days.map((date, i) => ({
          date,
          isIntroWeek: i === 0 && r() < 0.3,
          isDeload: r() < 0.1,
          perform: r() < 0.7 ? asShown : all(8 + Math.floor(r() * 6)),
        })),
        r() < 0.7 ? { progress: { startWeightKg: 4 + Math.floor(r() * 20) } } : {},
      );
      const today = addDays(days.at(-1) as string, Math.floor(r() * 45));
      const frees = Array.from({ length: 1 + Math.floor(r() * 4) }, () =>
        freeEntry(
          addDays(today, -Math.floor(r() * 60)),
          heavy(Math.round(r() * 100 * 2) / 2, Math.floor(r() * 20), 1 + Math.floor(r() * 5)),
          {
            weightConfirmed: r() < 0.5,
            // Selbst wenn ein freier Eintrag (fehlerhaft) Vorgabe/Zustand trüge, zählt er nicht.
            ...(r() < 0.3
              ? { state: { weightKg: 99, targetReps: 12, extraSet: true, durationS: null } }
              : {}),
          },
        ),
      );
      const mixed = [...sim.entries, ...frees].sort(() => r() - 0.5);
      const options = { today, startWeightKg: 10 };
      expect(progressFromLogs('x', mixed, ctx, options)).toEqual(
        progressFromLogs('x', sim.entries, ctx, options),
      );
    }
  });
});
