/**
 * Langer Lauf (Gründer-Entscheidung G2, Plan 3.5, Etappe WP2): eigene Steigerungsregel und 50-%-Deckel in
 * enduranceWeekVolumes – nur im Wettkampfplan (`longRun`), ohne Angabe unverändert. Erwartungen unabhängig.
 */
import { describe, expect, it } from 'vitest';

import {
  halfWeekCap,
  distributeEnduranceMinutes,
  distributeWithLongRun,
  type EnduranceWeekInput,
  enduranceWeekVolumes,
} from './endurance';

const INF = Number.POSITIVE_INFINITY;
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

describe('distributeWithLongRun', () => {
  it('langer Lauf bekommt bis 50 %, die übrigen teilen den Rest (nie länger als der lange Lauf)', () => {
    const r = distributeWithLongRun(140, [60, 60, 90], INF, {
      index: 2,
      limit: 70,
      maxMinutes: 120,
    });
    expect(r.minutes).toEqual([35, 35, 70]);
    const capped = distributeWithLongRun(140, [60, 60, 90], INF, {
      index: 2,
      limit: 30,
      maxMinutes: 120,
    });
    expect(capped.minutes).toEqual([30, 30, 30]);
  });

  it('1 Einheit: ganze Woche bis zum Deckel; unter 10 min fällt der lange Lauf weg', () => {
    expect(
      distributeWithLongRun(80, [90], INF, { index: 0, limit: 60, maxMinutes: 75 }).minutes,
    ).toEqual([60]);
    expect(
      distributeWithLongRun(80, [90], INF, { index: 0, limit: 200, maxMinutes: 75 }).minutes,
    ).toEqual([75]);
    const dropped = distributeWithLongRun(30, [5, 40, 40], INF, {
      index: 0,
      limit: 50,
      maxMinutes: 90,
    });
    expect(dropped.minutes[0]).toBe(0);
    expect(dropped.dropped).toBeGreaterThanOrEqual(1);
  });

  it('Eigenschaft: Summe ≤ Budget, langer Lauf ≤ Deckel und ≤ Summe der übrigen, je Tag ≤ Wunsch', () => {
    for (let budget = 0; budget <= 400; budget += 13) {
      for (const wishes of [[30], [45, 90], [30, 45, 60, 120], [20, 20, 20, 20, 20, 20, 150]]) {
        for (const limit of [10, 30, 66, 200]) {
          for (let index = 0; index < wishes.length; index += 1) {
            const r = distributeWithLongRun(budget, wishes, 60, { index, limit, maxMinutes: 120 });
            expect(sum(r.minutes)).toBeLessThanOrEqual(budget);
            const long = r.minutes[index] as number;
            expect(long).toBeLessThanOrEqual(Math.min(limit, 120, wishes[index] as number, 60));
            const others = sum(r.minutes) - long;
            if (others > 0) expect(long).toBeLessThanOrEqual(others);
            r.minutes.forEach((m, i) => {
              expect(m).toBeLessThanOrEqual(wishes[i] as number);
              expect(m === 0 || m >= 10).toBe(true);
              if (i !== index && long > 0) expect(m).toBeLessThanOrEqual(long);
            });
          }
        }
      }
    }
  });
});

const load = (wishes: number[], longIndex = wishes.length - 1, max = 180): EnduranceWeekInput => ({
  kind: 'load',
  wishes,
  longRun: { index: longIndex, maxMinutes: max },
});

describe('enduranceWeekVolumes mit langem Lauf (G2)', () => {
  it('Einsteiger: längste Einheit 30 → +10 % je Belastungswoche (vom tatsächlich Gelaufenen), Erholungswoche nie höher', () => {
    const weeks: EnduranceWeekInput[] = [
      { ...load([60, 60, 150]), kind: 'intro' },
      load([60, 60, 150]),
      load([60, 60, 150]),
      { ...load([60, 60, 150]), kind: 'deload' },
      load([60, 60, 150]),
    ];
    const r = enduranceWeekVolumes(weeks, { group: 'beginner', wishWeekly: 270 });
    const longest = r.weeks.map((w) => Math.max(...w.minutes));
    expect(longest[0]).toBeLessThanOrEqual(30);
    expect(longest[1]).toBeLessThanOrEqual(Math.floor(((longest[0] ?? 0) * 110) / 100));
    expect(longest[2]).toBeLessThanOrEqual(Math.floor(((longest[1] ?? 0) * 110) / 100));
    expect(longest[3]).toBeLessThanOrEqual(longest[2] ?? 0);
    expect(longest[4]).toBeLessThanOrEqual(Math.floor(((longest[2] ?? 0) * 110) / 100));
  });

  it('Fortgeschritten ohne Start-Deckel: erste Belastungswoche ≤ 90, dann +10 %; 50 % der Woche', () => {
    const r = enduranceWeekVolumes(
      [{ ...load([60, 200]), kind: 'intro' }, load([60, 200]), load([60, 200])],
      { group: 'advanced', wishWeekly: 260 },
    );
    for (const w of r.weeks) {
      expect(w.minutes[1]).toBeLessThanOrEqual(Math.floor(sum(w.minutes) * 0.5));
    }
    expect(Math.max(...(r.weeks[0]?.minutes ?? []))).toBeLessThanOrEqual(90);
  });

  it('Bezug aus dem Folgeblock: Kette ab der längsten Einheit des Bezugs; strengere Gruppe beginnt neu (20)', () => {
    const weeks = [load([90, 90, 150])];
    const cont = enduranceWeekVolumes(weeks, {
      group: 'advanced',
      wishWeekly: 330,
      reference: { volume: 240, sessionCap: 100 },
    });
    expect(Math.max(...(cont.weeks[0]?.minutes ?? []))).toBeLessThanOrEqual(110);
    const restart = enduranceWeekVolumes(weeks, {
      group: 'cautious',
      wishWeekly: 330,
      reference: { volume: 240, sessionCap: 100 },
      stricterGroup: true,
    });
    expect(Math.max(...(restart.weeks[0]?.minutes ?? []))).toBeLessThanOrEqual(20);
  });

  it('Woche 0 und Wochen ohne langen Lauf (index −1): kein langer Lauf, aber nie über dem Deckel der Distanz', () => {
    const r = enduranceWeekVolumes(
      [
        { kind: 'week0', wishes: [90, 90], longRun: { index: 1, maxMinutes: 75 } },
        { kind: 'load', wishes: [90, 90], longRun: { index: -1, maxMinutes: 75 } },
      ],
      { group: 'competitive', wishWeekly: 180 },
    );
    for (const w of r.weeks) {
      expect(Math.max(...w.minutes)).toBeLessThanOrEqual(75);
      // Wächter M2: auch hier höchstens 50 % der tatsächlichen Woche.
      expect(Math.max(...w.minutes)).toBeLessThanOrEqual(Math.floor(sum(w.minutes) / 2));
    }
  });

  it('halfWeekCap: längste Einheit ≤ Summe der übrigen (ab 2 Einheiten), 1 Einheit unverändert', () => {
    expect(halfWeekCap({ minutes: [30, 31], dropped: 0 }).minutes).toEqual([30, 30]);
    expect(halfWeekCap({ minutes: [10, 0, 60], dropped: 1 })).toEqual({
      minutes: [10, 0, 10],
      dropped: 1,
    });
    expect(halfWeekCap({ minutes: [45, 45, 48], dropped: 0 }).minutes).toEqual([45, 45, 48]);
    expect(halfWeekCap({ minutes: [0, 90], dropped: 1 }).minutes).toEqual([0, 90]);
  });

  it('ohne `longRun` genau wie bisher (Pläne ohne Wettkampf byte-gleich)', () => {
    for (const group of ['cautious', 'beginner', 'advanced', 'competitive'] as const) {
      for (const wishes of [[45], [30, 60], [45, 45, 90], [40, 40, 40, 40, 120]]) {
        const weeks: EnduranceWeekInput[] = [
          { kind: 'week0', wishes },
          { kind: 'intro', wishes },
          { kind: 'load', wishes },
          { kind: 'deload', wishes },
        ];
        const r = enduranceWeekVolumes(weeks, { group, wishWeekly: sum(wishes) });
        // Unabhängig nachgerechnet über distributeEnduranceMinutes mit denselben Budgets/Deckeln.
        r.weeks.forEach((w) => {
          expect(w.minutes).toEqual(
            distributeEnduranceMinutes(w.budget, wishes, w.sessionCap).minutes,
          );
        });
      }
    }
  });
});
