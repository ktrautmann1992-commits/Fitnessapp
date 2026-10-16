import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { CompetitionPhase } from './competition-schema';
import {
  easyWorkout,
  structuredWorkout,
  talkTestText,
  type WeekEnduranceDay,
  type WeekWorkoutInput,
  weekWorkouts,
  WORKOUT_TEXTS_DE,
} from './endurance-workouts';
import { type HardWorkoutLimits, hardSeconds } from './intensity';

// Feste Werte (Plan 3.3/3.4) – bewusst nicht aus constants.ts.
const GENERAL: HardWorkoutLimits = {
  allowed: true,
  effortCap: 8,
  perWeek: 2,
  countWorkOnly: false,
};
const BEGINNER: HardWorkoutLimits = {
  allowed: true,
  effortCap: 8,
  perWeek: 1,
  countWorkOnly: true,
};
const MINOR: HardWorkoutLimits = { allowed: true, effortCap: 7, perWeek: 1, countWorkOnly: true };
const BLOCKED: HardWorkoutLimits = {
  allowed: false,
  effortCap: 0,
  perWeek: 0,
  countWorkOnly: true,
};
const MONDAY = '2026-10-05';
const on = (weekday: number) => addDays(MONDAY, weekday - 1);
const total = (steps: readonly { seconds: number }[]) => steps.reduce((s, st) => s + st.seconds, 0);
const HARD = ['fartlek', 'tempo', 'intervals', 'race_pace'];

const options = (
  limits = GENERAL,
  budgetMinutes = 999,
  level: 'beginner' | 'advanced' = 'advanced',
) => ({
  easyEffort: 4,
  limits,
  level,
  discipline: 'half_marathon' as const,
  hardBudgetS: budgetMinutes * 60,
});

function week(
  days: [number, number][],
  overrides: Partial<WeekWorkoutInput> = {},
): ReturnType<typeof weekWorkouts> {
  const list: WeekEnduranceDay[] = days.map(([weekday, minutes]) => ({
    date: on(weekday),
    minutes,
    variant: 'easy_run',
  }));
  return weekWorkouts({
    phase: 'build',
    recoveryWeek: false,
    level: 'advanced',
    limits: GENERAL,
    discipline: 'half_marathon',
    easyEffort: 4,
    days: list,
    longRunDate: on(7),
    blockedDates: new Set(),
    pace: null,
    ...overrides,
  });
}

describe('Bausteine (W-G8)', () => {
  it('lockere Arten: Schritte = Dauer, Auf-/Abwärmen ab 20 min, Erholungslauf Anstrengung 2', () => {
    for (const minutes of [10, 19, 20, 45, 180]) {
      for (const type of ['easy', 'recovery', 'long'] as const) {
        const w = easyWorkout(type, minutes, 4);
        expect(total(w.steps)).toBe(minutes * 60);
        expect(w.steps.length).toBe(minutes >= 20 ? 3 : 1);
      }
    }
    expect(easyWorkout('recovery', 30, 4).effort_target).toBe(2);
    expect(easyWorkout('long', 90, 3).name_de).toBe('Langer Lauf');
    expect(easyWorkout('easy', 30, 3).effort_target).toBe(3);
  });

  it('harte Arten: Schritte = Dauer, Anstrengung ≤ Deckel, Budget eingehalten, sonst null', () => {
    for (const type of ['fartlek', 'tempo', 'intervals', 'race_pace', 'strides'] as const) {
      for (const minutes of [24, 25, 30, 45, 60, 90]) {
        for (const [limits, level] of [
          [GENERAL, 'advanced'],
          [BEGINNER, 'beginner'],
          [MINOR, 'advanced'],
        ] as const) {
          for (const budget of [0, 5, 12, 30, 999]) {
            const w = structuredWorkout(type, minutes, options(limits, budget, level));
            if (minutes < 25) expect(w).toBeNull();
            if (!w) continue;
            expect(total(w.steps), `${type} ${minutes}`).toBe(minutes * 60);
            expect(hardSeconds(w.steps, limits.countWorkOnly)).toBeLessThanOrEqual(budget * 60);
            for (const st of w.steps) {
              expect(st.effort).toBeLessThanOrEqual(limits.effortCap);
              expect(st.seconds).toBeGreaterThanOrEqual(10);
            }
            if (type !== 'strides') expect(w.effort_target).toBeGreaterThanOrEqual(6);
          }
        }
      }
      expect(structuredWorkout(type, 60, options(BLOCKED))).toBeNull();
    }
  });

  it('Beispiele: Intervalle 6 × 3 min bei 60 min, unter 18 Anstrengung 7, Einsteiger-Tempo in 2 Teilen', () => {
    const intervals = structuredWorkout('intervals', 60, options());
    expect(intervals?.steps.filter((s) => s.kind === 'work')).toHaveLength(6);
    expect(intervals?.effort_target).toBe(8);
    expect(intervals?.main_de).toContain('Nie „alles geben“');
    expect(structuredWorkout('intervals', 60, options(MINOR))?.effort_target).toBe(7);
    const tempo = structuredWorkout('tempo', 40, options(BEGINNER, 999, 'beginner'));
    expect(tempo?.steps.filter((s) => s.kind === 'work').map((s) => s.seconds)).toEqual([
      8 * 60,
      8 * 60,
    ]); // Einsteiger höchstens 16 min Tempo, in zwei Teilen
    expect(
      structuredWorkout('fartlek', 25, options())?.steps.filter((s) => s.kind === 'work'),
    ).toHaveLength(4);
    // Marathon-Renntempo braucht 2 × 15 min: unter 47 min passt es nicht.
    const marathon = { ...options(), discipline: 'marathon' as const };
    expect(structuredWorkout('race_pace', 46, marathon)).toBeNull();
    expect(
      structuredWorkout('race_pace', 47, marathon)?.steps.filter((s) => s.kind === 'work'),
    ).toHaveLength(2);
  });

  it('Sprechtest-Texte nach Anstrengung (TALK_TEST_BANDS)', () => {
    expect(talkTestText(3)).toBe(
      `Anstrengung 3 von 10: ${WORKOUT_TEXTS_DE.talkTest.full_sentences}`,
    );
    expect(talkTestText(6)).toContain('kurze Sätze');
    expect(talkTestText(8)).toContain('einzelne Wörter');
    expect(talkTestText(9)).toContain('kaum möglich');
  });
});

describe('weekWorkouts – Wochenbau (Plan 3.4/3.5, 80/20)', () => {
  it('Fortgeschritten im Aufbau, 4 Tage: Tempo + Intervalle, nicht hintereinander, nicht neben dem langen Lauf, 80/20', () => {
    const w = week([
      [2, 45],
      [4, 45],
      [6, 30],
      [7, 90],
    ]);
    expect(w.map((x) => x.type)).toEqual(['tempo', 'intervals', 'easy', 'long']);
    const hard = w.reduce((s, x) => s + hardSeconds(x.steps, false), 0);
    expect(hard).toBeLessThanOrEqual(Math.floor(210 * 0.2) * 60);
  });

  it('nie zwei harte Tage hintereinander, nie am Tag vor/nach dem langen Lauf (7 Tage)', () => {
    const w = week([1, 2, 3, 4, 5, 6, 7].map((d) => [d, d === 7 ? 120 : 45]));
    const hardDays = w.filter((x) => HARD.includes(x.type)).map((x) => x.date);
    expect(hardDays.length).toBe(2);
    for (const d of hardDays) {
      expect(hardDays).not.toContain(addDays(d, 1));
      expect([on(6), on(1)]).not.toContain(d);
    }
  });

  it('gesperrte Tage (neben Kraft mit Beinen) bekommen keine harte Einheit', () => {
    const w = week(
      [
        [2, 45],
        [4, 45],
        [7, 90],
      ],
      { blockedDates: new Set([on(2), on(4)]) },
    );
    expect(w.every((x) => !HARD.includes(x.type))).toBe(true);
  });

  it('Erholungswoche, Rennwoche, Basis-Einsteiger, Flag, Geh-Lauf-Wechsel: keine harte Einheit', () => {
    const days: [number, number][] = [
      [2, 45],
      [4, 45],
      [7, 90],
    ];
    const cases: Partial<WeekWorkoutInput>[] = [
      { recoveryWeek: true },
      { phase: 'race_week' },
      { phase: 'recovery' },
      { phase: 'base', level: 'beginner', limits: BEGINNER },
      { limits: BLOCKED },
    ];
    for (const c of cases) {
      expect(
        week(days, c).some((x) => HARD.includes(x.type)),
        JSON.stringify(c),
      ).toBe(false);
    }
    const walkRun = weekWorkouts({
      phase: 'build',
      recoveryWeek: false,
      level: 'beginner',
      limits: BEGINNER,
      discipline: '10k',
      easyEffort: 4,
      days: days.map(([d, m]) => ({ date: on(d), minutes: m, variant: 'walk_run' })),
      longRunDate: on(7),
      blockedDates: new Set(),
      pace: null,
    });
    expect(walkRun.some((x) => HARD.includes(x.type) || x.type === 'strides')).toBe(false);
    // Wächter M1: keine Steigerungen in einer Erholungswoche der Basis und in Woche 0 – nichts mit Anstrengung ≥ 6.
    for (const c of [
      { phase: 'base' as const, recoveryWeek: true },
      { phase: 'base' as const, weekZero: true },
      { phase: 'build' as const, weekZero: true },
    ]) {
      const w = week(days, c);
      expect(
        w.some((x) => x.steps.some((st) => st.effort >= 6)),
        JSON.stringify(c),
      ).toBe(false);
    }
    expect(week(days, { phase: 'base' }).some((x) => x.type === 'strides')).toBe(true);
    expect(week(days, { phase: 'recovery' }).every((x) => x.type === 'recovery')).toBe(true);
  });

  it('nur 2 Ausdauer-Tage: Einsteiger kein Tempo + langer Lauf in derselben Woche; Fortgeschrittene schon', () => {
    const days: [number, number][] = [
      [3, 45],
      [7, 90],
    ];
    const beginner = week(days, { level: 'beginner', limits: BEGINNER, phase: 'peak' });
    expect(beginner.map((x) => x.type)).toEqual(['easy', 'long']);
    const advanced = week(days, { phase: 'peak' });
    expect(advanced.filter((x) => HARD.includes(x.type))).toHaveLength(1);
  });

  it('1 Tag: nur der lange Lauf; 7 Tage Einsteiger: höchstens 1 harte Einheit', () => {
    expect(week([[7, 60]]).map((x) => x.type)).toEqual(['long']);
    const beginner = week(
      [1, 2, 3, 4, 5, 6, 7].map((d) => [d, 40]),
      { level: 'beginner', limits: BEGINNER },
    );
    expect(beginner.filter((x) => HARD.includes(x.type))).toHaveLength(1);
  });

  it('Tapering: höchstens 1 harte Einheit („Intensität bleibt“); Spitze: Renntempo zuerst', () => {
    const days: [number, number][] = [
      [2, 50],
      [4, 50],
      [7, 90],
    ];
    expect(week(days, { phase: 'taper' }).filter((x) => HARD.includes(x.type))).toHaveLength(1);
    expect(week(days, { phase: 'peak' }).map((x) => x.type)).toContain('race_pace');
  });

  it('Basis: Steigerungen nur für Fortgeschrittene ab 3 Tagen; langer Lauf nur, wenn er die längste Einheit ist', () => {
    const days: [number, number][] = [
      [2, 45],
      [4, 40],
      [7, 90],
    ];
    expect(week(days, { phase: 'base' }).map((x) => x.type)).toEqual(['strides', 'easy', 'long']);
    expect(
      week(days, { phase: 'base', level: 'beginner', limits: BEGINNER }).map((x) => x.type),
    ).toEqual(['easy', 'easy', 'long']);
    // Wunsch-Tag Sonntag kürzer als Dienstag → keine „lange“ Einheit.
    expect(
      week(
        [
          [2, 90],
          [7, 40],
        ],
        { phase: 'base' },
      ).some((x) => x.type === 'long'),
    ).toBe(false);
  });

  it('Distanz-Richtwert nur mit Referenzzeit und nur bei durchgehenden Läufen', () => {
    const pace = {
      reference: { discipline: '10k', timeS: 3000, date: '2026-10-01' },
      discipline: 'half_marathon',
    } as const;
    const w = week(
      [
        [2, 45],
        [4, 45],
        [7, 60],
      ],
      { pace },
    );
    expect(w.find((x) => x.type === 'long')?.target_distance_m).toBe(9000);
    expect(w.filter((x) => HARD.includes(x.type)).every((x) => x.target_distance_m === null)).toBe(
      true,
    );
    expect(week([[7, 60]]).every((x) => x.target_distance_m === null)).toBe(true);
  });

  it.each(['base', 'build', 'peak', 'taper', 'race_week', 'recovery'] as CompetitionPhase[])(
    'Phase %s: 80/20 je Woche bei 1–7 Tagen',
    (phase) => {
      for (let n = 1; n <= 7; n += 1) {
        for (const limits of [GENERAL, BEGINNER, MINOR]) {
          const days = [2, 4, 7, 6, 3, 5, 1]
            .slice(0, n)
            .map((d): [number, number] => [d, d === 7 ? 80 : 40]);
          const w = week(days, {
            phase,
            limits,
            level: limits === BEGINNER ? 'beginner' : 'advanced',
          });
          const minutes = days.reduce((s, [, m]) => s + m, 0);
          const hard = w.reduce((s, x) => s + hardSeconds(x.steps, limits.countWorkOnly), 0);
          expect(hard).toBeLessThanOrEqual(Math.floor(minutes * 0.2) * 60);
          expect(w.filter((x) => HARD.includes(x.type)).length).toBeLessThanOrEqual(limits.perWeek);
        }
      }
    },
  );
});
