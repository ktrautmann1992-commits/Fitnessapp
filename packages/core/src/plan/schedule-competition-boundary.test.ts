/**
 * Schutz an der Blockgrenze (Wächter N1, Plan 3.5): harte Ausdauer des Folgeblocks nie neben einer harten Einheit am
 * Ende des bisherigen Plans (`competitionNeighbours`) und am letzten Tag des Blocks nie vor einem Kraft-Tag des Musters
 * (Prüfung „über das Blockende hinaus“). Direkt über nextPlanBlock mit vorgegebener Wettkampf-Woche.
 */
import { describe, expect, it } from 'vitest';

import { addDays, startOfIsoWeek } from '../dates';
import { fixed, type Kind, library } from './competition-test-helpers';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { hardWorkoutLimits } from './intensity';
import { planSafetyRules } from './safety';
import { type BlockWeekSpec, nextPlanBlock, type PreviousSession } from './schedule';
import { FULL_HOME, MONDAY, person } from './test-library';

const HARD = ['fartlek', 'tempo', 'intervals', 'race_pace'];

function setup(slots: [number, Kind, number][]) {
  const inputs = person({
    goalType: 'endurance',
    discipline: 'half_marathon',
    experienceLevel: 'advanced',
    schedule: fixed(...slots),
    homeEquipment: [...FULL_HOME],
    healthScreening: { flags: [] },
  });
  const generated = generateTrainingPlan(inputs, library, MONDAY);
  if (!generated.ok) throw new Error(generated.error);
  const plan = generated.plan;
  const rules = planSafetyRules(
    { experienceLevel: 'advanced', birthDate: inputs.birthDate, healthScreening: { flags: [] } },
    MONDAY,
  );
  const last = plan.sessions
    .map((s) => s.scheduled_on)
    .sort()
    .at(-1) as string;
  const monday = addDays(startOfIsoWeek(last), 7);
  const spec: BlockWeekSpec = {
    weekNo: 1,
    monday,
    kind: 'load',
    workouts: {
      phase: 'build',
      recoveryWeek: false,
      discipline: 'half_marathon',
      level: 'advanced',
      limits: hardWorkoutLimits(rules, 'advanced'),
      longRunWeekday: 4,
      pace: null,
    },
  };
  const next = (previous: readonly PreviousSession[]) =>
    nextPlanBlock(previous, {
      schedule: plan.inputs.schedule,
      loadWeeks: plan.load_weeks,
      rules,
      library: library.exercises,
      profiles: new Map([
        ['home', equipmentProfile('home', [...FULL_HOME])],
        ['gym', equipmentProfile('gym', [])],
      ]),
      endurance: {
        goalType: 'endurance',
        discipline: 'half_marathon',
        experienceLevel: 'advanced',
      },
      previousStartGroup: rules.enduranceStartGroup,
      competitionWeeks: [spec],
    });
  return { plan, last, monday, next };
}

describe('Blockgrenze (Wächter N1)', () => {
  it('harte Einheit am letzten Sonntag des bisherigen Plans → Montag des Folgeblocks nicht hart', () => {
    const { plan, last, monday, next } = setup([
      [1, 'endurance', 90],
      [4, 'endurance', 150],
      [6, 'endurance', 45],
      [7, 'endurance', 45],
    ]);
    const mondayHard = (previous: readonly PreviousSession[]) =>
      HARD.includes(next(previous).find((s) => s.scheduled_on === monday)?.workout_type ?? '');
    // Gegenkontrolle: ohne harte Einheit davor ist der Montag (längster freier Tag) hart.
    expect(mondayHard(plan.sessions)).toBe(true);
    const withHardSunday = plan.sessions.map((s) =>
      s.scheduled_on === last ? { ...s, workout_type: 'intervals' as const } : s,
    );
    expect(mondayHard(withHardSunday)).toBe(false);
  });

  it('letzter Tag des Blocks (Sonntag) vor einem Kraft-Tag des Musters (Montag) bleibt locker', () => {
    const { plan, monday, next } = setup([
      [1, 'strength_gym', 60],
      [3, 'endurance', 60],
      [4, 'endurance', 150],
      [7, 'endurance', 60],
    ]);
    const block = next(plan.sessions);
    const sunday = block.find((s) => s.scheduled_on === addDays(monday, 6));
    expect(sunday?.kind).toBe('endurance');
    expect(HARD.includes(sunday?.workout_type ?? '')).toBe(false);
    // Mittwoch liegt vor dem langen Lauf (Do) – also gibt es in dieser Woche gar keine harte Einheit.
    expect(block.some((s) => HARD.includes(s.workout_type ?? ''))).toBe(false);
  });
});
