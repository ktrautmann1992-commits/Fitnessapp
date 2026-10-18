/**
 * Regressionstest S-n1 (docs/PLAN-PHASE-4B.md 5.8): Jeder HEUTE erzeugbare Plan erfüllt die Wochen-Invarianten ohne
 * jede Live-Anpassung (Woche 0 nicht gezählt) – jedes Level, vorsichtig ja/nein, 1–7 Tage, Start an jedem Wochentag (mit
 * und ohne Woche 0), mit und ohne Ausdauer, Körpergewicht, plus drei Folgeblöcke; außerdem Wettkampfpläne (Laufen, Rad,
 * Triathlon) über den ganzen Makrozyklus. Erst danach darf append_plan_block die Regel prüfen (Etappe B).
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { loadWeeksBeforeDeload } from '../plan/deload';
import { fixed, fullPlan, type Kind, request, runner } from '../plan/competition-test-helpers';
import type { CompetitionDiscipline } from '../plan/competition-schema';
import { planSafetyRules } from '../plan/safety';
import { trailingLoadWeeks } from '../plan/periodization';
import { FULL_HOME, MONDAY, person } from '../plan/test-library';
import { checkWeekInvariants } from './invariants';
import { planWithFollowUps } from './test-helpers';

const DAYS: Record<number, number[]> = {
  1: [3],
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

type Variant = 'strength' | 'mixed' | 'endurance' | 'bodyweight';

function inputsFor(
  level: 'beginner' | 'advanced' | 'competitive',
  cautious: boolean,
  days: number,
  variant: Variant,
) {
  const weekdays = DAYS[days] as number[];
  const kindOf = (i: number): Kind =>
    variant === 'endurance'
      ? 'endurance'
      : variant === 'bodyweight'
        ? 'strength_home'
        : variant === 'mixed' && i % 2 === 1
          ? 'endurance'
          : 'strength_gym';
  return person({
    goalType: variant === 'endurance' ? 'endurance' : 'muscle_gain',
    ...(variant === 'endurance' ? { discipline: '10k' as const } : {}),
    experienceLevel: level,
    healthScreening: cautious ? null : { flags: [] },
    schedule: {
      mode: 'fixed',
      slots: weekdays.map((weekday, i) => ({ weekday, kind: kindOf(i), minutes: 30 + 10 * i })),
    },
    homeEquipment: variant === 'bodyweight' ? [] : [...FULL_HOME],
  });
}

describe('Regression S-n1: heute erzeugbare Pläne erfüllen die Wochen-Invarianten', () => {
  it('Grundlagen-Pläne: Level × vorsichtig × 1–7 Tage × Startwochentag × Art, je drei Folgeblöcke', () => {
    const failures: string[] = [];
    let checked = 0;
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      for (const cautious of [false, true]) {
        for (let days = 1; days <= 7; days += 1) {
          for (const variant of ['strength', 'mixed', 'endurance', 'bodyweight'] as Variant[]) {
            if (variant === 'bodyweight' && (days < 2 || days > 4)) continue;
            for (let weekday = 1; weekday <= 7; weekday += 1) {
              const today = addDays(MONDAY, weekday - 1);
              const inputs = inputsFor(level, cautious, days, variant);
              const result = planWithFollowUps(inputs, today, 3);
              if (!result) continue;
              checked += 1;
              const rules = planSafetyRules(
                {
                  experienceLevel: level,
                  birthDate: inputs.birthDate,
                  healthScreening: inputs.healthScreening ?? null,
                },
                today,
              );
              const violations = checkWeekInvariants(result.sessions, {
                maxLoadWeeks: loadWeeksBeforeDeload(level, rules.cautious),
                planStart: result.plan.start_date,
              });
              if (violations.length > 0) {
                failures.push(
                  `${level}/${cautious ? 'vorsichtig' : 'normal'}/${days}T/${variant}/Start ${today}: ${JSON.stringify(violations.slice(0, 3))}`,
                );
              }
              // Ohne Live-Anpassung endet jeder Block mit seiner Erholungswoche → nichts zu übertragen.
              if (trailingLoadWeeks(result.sessions) !== 0)
                failures.push(`${today}: trailingLoadWeeks ≠ 0`);
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(400);
  });

  it('Wettkampfpläne Laufen, Rad und Triathlon über den ganzen Makrozyklus', () => {
    const failures: string[] = [];
    const cases: { d: CompetitionDiscipline; weeks: number; km?: number }[] = [
      { d: '5k', weeks: 12 },
      { d: '10k', weeks: 16 },
      { d: 'half_marathon', weeks: 20 },
      { d: 'marathon', weeks: 30 },
      { d: 'cycling', weeks: 24, km: 120 },
      { d: 'triathlon_sprint', weeks: 22 },
      { d: 'triathlon_olympic', weeks: 30 },
    ];
    let checked = 0;
    for (const c of cases) {
      for (const level of ['beginner', 'advanced', 'competitive'] as const) {
        for (const start of [0, 3]) {
          for (const [strength, cautious] of [
            [false, false],
            [true, false],
            [false, true],
          ] as const) {
            const today = addDays(MONDAY, start);
            const inputs = runner(c.d, level, {
              ...(cautious ? { healthScreening: { flags: ['medication' as const] } } : {}),
              schedule: strength
                ? fixed(
                    [1, 'strength_gym', 45],
                    [2, 'endurance', 60],
                    [4, 'endurance', 60],
                    [7, 'endurance', 120],
                  )
                : fixed(
                    [2, 'endurance', 60],
                    [4, 'endurance', 60],
                    [6, 'endurance', 60],
                    [7, 'endurance', 120],
                  ),
            });
            const raceDate = addDays(MONDAY, 7 * c.weeks + 5);
            const req = request(c.d, raceDate);
            const withKm =
              c.km === undefined ? req : { competition: { ...req.competition, distanceKm: c.km } };
            let plan: ReturnType<typeof fullPlan>;
            try {
              plan = fullPlan(inputs, withKm, today);
            } catch {
              continue;
            }
            checked += 1;
            const rules = planSafetyRules(
              {
                experienceLevel: level,
                birthDate: inputs.birthDate,
                healthScreening: inputs.healthScreening ?? null,
              },
              today,
            );
            const violations = checkWeekInvariants(plan.sessions, {
              maxLoadWeeks: loadWeeksBeforeDeload(level, rules.cautious),
              planStart: plan.plan.start_date,
            });
            if (violations.length > 0) {
              failures.push(
                `${c.d}/${level}/+${start}/${strength}/${cautious}: ${JSON.stringify(violations.slice(0, 3))}`,
              );
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(80);
  });
});
