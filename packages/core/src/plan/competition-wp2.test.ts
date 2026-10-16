/**
 * Ampel WP2 (docs/PLAN-PHASE-10.md 3.2/3.4/3.5, Gründer-Entscheidungen G2/G7): langer Lauf wird mitgeprüft,
 * „nur Gehen“ höchstens „knapp“, Zielzeit-Plausibilität gegen die Referenzzeit (Riegel), Wunsch-Tag des langen Laufs.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import {
  type CompetitionFeasibility,
  competitionFeasibility,
  type CompetitionRequest,
  requiredLongRun,
} from './competition';
import type { CompetitionDiscipline } from './competition-schema';
import { library } from './competition-test-helpers';
import { generateCompetitionPlan } from './generate';
import type { PlanInputsInput } from './inputs';
import { MONDAY, person } from './test-library';

const days = (spec: [number, number][]) => ({
  mode: 'fixed' as const,
  slots: spec.map(([weekday, minutes]) => ({ weekday, kind: 'endurance' as const, minutes })),
});
const STANDARD = days([
  [2, 90],
  [4, 90],
  [6, 90],
  [7, 150],
]);

function runner(
  discipline: CompetitionDiscipline,
  overrides: Partial<PlanInputsInput> = {},
): PlanInputsInput {
  return person({
    goalType: 'endurance',
    discipline,
    experienceLevel: 'advanced',
    schedule: STANDARD,
    healthScreening: { flags: [] },
    ...overrides,
  });
}

function check(
  inputs: PlanInputsInput,
  competition: Partial<CompetitionRequest['competition']> & { raceDate: string },
  extra: Omit<CompetitionRequest, 'competition'> = {},
): CompetitionFeasibility {
  const result = competitionFeasibility(
    inputs,
    {
      competition: {
        name: 'Lauf',
        discipline: inputs.discipline as CompetitionDiscipline,
        ...competition,
      },
      ...extra,
    },
    MONDAY,
  );
  if (!result.ok) throw new Error(result.error);
  return result.feasibility;
}
const weeks = (n: number) => addDays(MONDAY, n * 7 + 6);
const ref10k = { discipline: '10k' as const, timeS: 50 * 60, date: addDays(MONDAY, -30) };

describe('requiredLongRun (G2 + G3)', () => {
  it('Ankommen 40/50/70/120 min, Zielzeit 60/75/105/165 min (höchstens 50 % des Spitzenumfangs)', () => {
    expect(
      (['5k', '10k', 'half_marathon', 'marathon'] as const).map((d) => requiredLongRun(d)),
    ).toEqual([40, 50, 70, 120]);
    expect(
      (['5k', '10k', 'half_marathon', 'marathon'] as const).map((d) => requiredLongRun(d, 'time')),
    ).toEqual([60, 75, 105, 165]);
  });
});

describe('Ampel prüft den langen Lauf (G2)', () => {
  it('Marathon mit nur 90 min am längsten Tag: zu kurz, Grund langer Lauf, Vorschlag „längerer Tag“, kein späteres Datum', () => {
    const f = check(
      runner('marathon', {
        schedule: days([
          [2, 90],
          [4, 90],
          [6, 90],
          [7, 90],
        ]),
      }),
      { raceDate: weeks(30) },
    );
    expect(f.status).toBe('too_short');
    expect(f.reasons).toEqual(['long_run_not_reachable', 'long_run_day_too_short']);
    expect(f.suggestions).toContainEqual({ kind: 'longer_long_run_day', minutes: 120 });
    expect(f.suggestions.some((s) => s.kind === 'later_date')).toBe(false);
    expect(f.plannedLongRunMinutes).toBeLessThan(120);
  });

  it('mit 150 min am Sonntag: passt, langer Lauf erreicht', () => {
    const f = check(runner('marathon'), { raceDate: weeks(30) });
    expect(f.status).toBe('ok');
    expect(f.requiredLongRunMinutes).toBe(120);
    expect(f.plannedLongRunMinutes).toBeGreaterThanOrEqual(120);
  });

  it('Wunsch-Tag des langen Laufs: Dienstag statt Sonntag; ungültiger Tag → ungültige Eingabe', () => {
    const inputs = runner('half_marathon');
    const req: CompetitionRequest = {
      competition: { name: 'Lauf', discipline: 'half_marathon', raceDate: weeks(20) },
      longRunWeekday: 2,
    };
    const plan = generateCompetitionPlan(inputs, library, MONDAY, req);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const long = plan.plan.sessions.filter((s) => s.workout_type === 'long');
    expect(long.length).toBeGreaterThan(0);
    expect(long.every((s) => new Date(`${s.scheduled_on}T12:00:00Z`).getUTCDay() === 2)).toBe(true);
    for (const bad of [0, 8, 2.5]) {
      expect(competitionFeasibility(inputs, { ...req, longRunWeekday: bad }, MONDAY)).toEqual({
        ok: false,
        error: 'invalid_inputs',
      });
    }
  });
});

describe('G7: Plan nur zügiges Gehen → höchstens „knapp“ mit Hinweis', () => {
  it('70 Jahre bzw. Gesundheits-Flag: knapp + walk_only_plan; gesund: passt ohne Hinweis', () => {
    const senior = check(runner('half_marathon', { birthDate: '1956-01-01' }), {
      raceDate: weeks(30),
    });
    expect(senior.status).toBe('tight');
    expect(senior.notices).toContain('walk_only_plan');
    expect(senior.suggestions.some((s) => s.kind === 'later_date')).toBe(false);
    const flagged = check(runner('10k', { healthScreening: { flags: ['injury'] } }), {
      raceDate: weeks(30),
    });
    expect(flagged.status).toBe('tight');
    expect(flagged.notices).toEqual(
      expect.arrayContaining(['medical_clearance', 'walk_only_plan']),
    );
    const healthy = check(runner('10k'), { raceDate: weeks(30) });
    expect(healthy.status).toBe('ok');
    expect(healthy.notices).not.toContain('walk_only_plan');
  });
});

describe('Zielzeit-Plausibilität gegen die Referenzzeit (Riegel)', () => {
  it('10 km Referenz 50:00: Zielzeit 48:00 (4 % schneller) möglich, 47:00 (6 %) nicht → Ankommen, knapp', () => {
    const ok = check(runner('10k'), {
      raceDate: weeks(20),
      goal: 'time',
      targetTimeS: 48 * 60,
      reference: ref10k,
    });
    expect(ok).toMatchObject({ status: 'ok', effectiveGoal: 'time' });
    const fast = check(runner('10k'), {
      raceDate: weeks(20),
      goal: 'time',
      targetTimeS: 47 * 60,
      reference: ref10k,
    });
    expect(fast).toMatchObject({ status: 'tight', effectiveGoal: 'finish' });
    expect(fast.reasons).toContain('goal_time_not_reachable');
    // Halbmarathon aus 10 km: Vorhersage 1:50:19 → 1:45:00 (−4,8 %) möglich, 1:44:00 (−5,7 %) nicht.
    const hm = (t: number) =>
      check(runner('half_marathon'), {
        raceDate: weeks(20),
        goal: 'time',
        targetTimeS: t,
        reference: ref10k,
      }).effectiveGoal;
    expect(hm(105 * 60)).toBe('time');
    expect(hm(104 * 60)).toBe('finish');
  });
});
