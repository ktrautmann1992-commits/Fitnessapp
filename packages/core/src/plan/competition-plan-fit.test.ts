import { describe, expect, it } from 'vitest';

import { fullPlan, runner } from './competition-test-helpers';
import { competitionPlanFit, shortDaysWithoutHard } from './competition-view';

/**
 * Wächter WP4 H1: Passt der laufende Wettkampfplan noch zum (geänderten) Wettkampf? Und M8: Hinweis „Tage zu kurz“.
 * Feste Erwartungen; Plan: Fortgeschritten, 5 km am 06.12.2026, Planstart 16.10.2026.
 */

const TODAY = '2026-10-16';
const inputs = runner('5k', 'advanced');
const { plan, sessions } = fullPlan(
  inputs,
  { competition: { name: 'Lauf', discipline: '5k', raceDate: '2026-12-06' } },
  TODAY,
);
const fit = (competition: {
  discipline: '5k' | '10k';
  raceDate: string;
  effectiveGoal: string | null;
}) =>
  competitionPlanFit({ sessions, planStart: plan.start_date, planDiscipline: '5k', competition });

describe('competitionPlanFit', () => {
  it('frisch erstellter Plan passt', () => {
    expect(fit({ discipline: '5k', raceDate: '2026-12-06', effectiveGoal: 'finish' })).toBe('fits');
  });
  it('Renntag vorverlegt (Probe des Wächters: 06.12. → 22.11.) → passt nicht mehr', () => {
    expect(fit({ discipline: '5k', raceDate: '2026-11-22', effectiveGoal: 'finish' })).toBe(
      'schedule',
    );
  });
  it('Renntag eine Woche später → Phasen verschoben → passt nicht', () => {
    expect(fit({ discipline: '5k', raceDate: '2026-12-13', effectiveGoal: 'finish' })).toBe(
      'schedule',
    );
  });
  it('nur die Phasen verschoben (keine Einheit im neuen Rennwochen-Fenster) → passt nicht', () => {
    const early = sessions.filter((s) => s.scheduled_on < '2026-12-07');
    expect(
      competitionPlanFit({
        sessions: early,
        planStart: plan.start_date,
        planDiscipline: '5k',
        competition: { discipline: '5k', raceDate: '2026-12-13', effectiveGoal: 'finish' },
      }),
    ).toBe('schedule');
  });
  it('ohne Plan-Bezug bzw. andere Disziplin', () => {
    expect(fit({ discipline: '5k', raceDate: '2026-12-06', effectiveGoal: null })).toBe('no_basis');
    expect(fit({ discipline: '10k', raceDate: '2026-12-06', effectiveGoal: 'finish' })).toBe(
      'discipline',
    );
  });
  it('Einheit auf dem Vortag des Renntags → passt nicht (G4)', () => {
    const eve = sessions.map((s, i) =>
      i === 0 ? { ...s, scheduled_on: '2026-12-05', training_phase: 'race_week' as const } : s,
    );
    expect(
      competitionPlanFit({
        sessions: eve,
        planStart: plan.start_date,
        planDiscipline: '5k',
        competition: { discipline: '5k', raceDate: '2026-12-06', effectiveGoal: 'finish' },
      }),
    ).toBe('schedule');
  });
  it('gestrichene Einheiten zählen nicht', () => {
    const skipped = sessions.map((s) => ({ ...s, status: 'skipped' }));
    expect(
      competitionPlanFit({
        sessions: skipped,
        planStart: plan.start_date,
        planDiscipline: '5k',
        competition: { discipline: '5k', raceDate: '2026-11-22', effectiveGoal: 'finish' },
      }),
    ).toBe('fits');
  });
});

describe('shortDaysWithoutHard (G10-Hinweis)', () => {
  const s = (
    minutes: number,
    type: 'easy' | 'long' | 'tempo' = 'easy',
    phase = 'build' as const,
  ) => ({
    kind: 'endurance',
    estimated_minutes: minutes,
    workout_type: type,
    training_phase: phase,
  });
  it('Aufbau, nur kurze Tage außer dem langen Lauf → Hinweis', () => {
    expect(shortDaysWithoutHard([s(70, 'long'), s(24), s(20)], true)).toBe(true);
  });
  it('ein Tag ab 25 min oder schon eine harte Einheit → kein Hinweis', () => {
    expect(shortDaysWithoutHard([s(70, 'long'), s(25), s(20)], true)).toBe(false);
    expect(shortDaysWithoutHard([s(70, 'long'), s(30, 'tempo'), s(20)], true)).toBe(false);
  });
  it('harte Einheiten nicht erlaubt, Basis-Phase oder nur ein Tag → kein Hinweis', () => {
    expect(shortDaysWithoutHard([s(70, 'long'), s(20)], false)).toBe(false);
    expect(
      shortDaysWithoutHard([s(70, 'long', 'base' as never), s(20, 'easy', 'base' as never)], true),
    ).toBe(false);
    expect(shortDaysWithoutHard([s(70, 'long')], true)).toBe(false);
  });
});
