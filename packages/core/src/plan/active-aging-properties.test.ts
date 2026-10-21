/**
 * Eigenschaftstest Fit im Alter (docs/PLAN-FIT-IM-ALTER.md 17.1 Nr. 5, Wächter S7): Mit dem Ziel „Fit im Alter“ ist
 * kein Plan je WENIGER vorsichtig als derselbe Plan mit „Allgemeine Fitness“ – RPE, Ausschlüsse, Einheiten je Woche,
 * Erholungs-Rhythmus, Ausdauer-Startgruppe, Anstrengung und Ausdauer-Umfang. Raster über Alter (Geburtstag am
 * Stichtag), Level, Flags, Wunschtage und Ort.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { ExperienceLevel } from '../enums';
import type { HealthFlag } from '../health-screening';
import { generateTrainingPlan } from './generate';
import { ENDURANCE_START_GROUPS, planSafetyRules } from './safety';
import type { GeneratedSession } from './schedule';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();
const LEVELS: ExperienceLevel[] = ['beginner', 'advanced', 'competitive'];
const AGES = [16, 30, 55, 59, 60, 64, 65, 69, 70, 95, 100];
const FLAGS: (HealthFlag[] | null)[] = [null, [], ['injury', 'conservative_plan'], ['medication']];
type Slot = {
  weekday: number;
  kind: 'strength_gym' | 'strength_home' | 'endurance';
  minutes: number;
};
const SCHEDULES: Slot[][] = [
  [{ weekday: 3, kind: 'strength_home', minutes: 20 }],
  [
    { weekday: 1, kind: 'strength_gym', minutes: 45 },
    { weekday: 3, kind: 'endurance', minutes: 40 },
    { weekday: 5, kind: 'strength_gym', minutes: 45 },
  ],
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    kind: weekday % 2 === 0 ? ('endurance' as const) : ('strength_home' as const),
    minutes: 60,
  })),
];

const born = (years: number) => `${Number(MONDAY.slice(0, 4)) - years}${MONDAY.slice(4)}`;
const rank = (group: string) => (ENDURANCE_START_GROUPS as readonly string[]).indexOf(group);

function weekStats(sessions: readonly GeneratedSession[]) {
  const count = new Map<string, number>();
  const endurance = new Map<string, number>();
  for (const s of sessions) {
    const key = `${s.block_no}:${s.week_no}`;
    count.set(key, (count.get(key) ?? 0) + 1);
    if (s.kind === 'endurance') endurance.set(key, (endurance.get(key) ?? 0) + s.estimated_minutes);
  }
  return {
    maxSessions: Math.max(0, ...count.values()),
    maxEndurance: Math.max(0, ...endurance.values()),
    maxRpe: Math.max(0, ...sessions.flatMap((s) => s.exercises.map((e) => e.rpe_target))),
    maxEffort: Math.max(0, ...sessions.map((s) => s.effort_target ?? 0)),
    run: sessions.some((s) => s.endurance_modality === 'run'),
  };
}

describe('Eigenschaft: „Fit im Alter“ nie lockerer als „Allgemeine Fitness“', () => {
  it('Regeln: RPE, Ausschlüsse, Startgruppe, Anstrengung, Gehen, Einsteiger-Vorlagen', () => {
    let checked = 0;
    for (const years of AGES) {
      for (const level of LEVELS) {
        for (const flags of FLAGS) {
          const base = {
            experienceLevel: level,
            birthDate: born(years),
            healthScreening: flags === null ? null : { flags },
          };
          const a = planSafetyRules({ ...base, goalType: 'active_aging' }, MONDAY);
          const g = planSafetyRules({ ...base, goalType: 'general_fitness' }, MONDAY);
          const label = `${years} ${level} ${JSON.stringify(flags)}`;
          expect(a.rpeMax, label).toBeLessThanOrEqual(g.rpeMax);
          for (const tag of g.excludedCautionTags)
            expect(a.excludedCautionTags, label).toContain(tag);
          expect(rank(a.enduranceStartGroup), label).toBeLessThanOrEqual(
            rank(g.enduranceStartGroup),
          );
          expect(a.enduranceEffortMax, label).toBeLessThanOrEqual(g.enduranceEffortMax);
          expect(a.enduranceWalkOnly || !g.enduranceWalkOnly, label).toBe(true);
          expect(a.beginnerTemplatesOnly, label).toBe(g.beginnerTemplatesOnly);
          expect(a.medicalNotice, label).toBe(g.medicalNotice);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(AGES.length * LEVELS.length * FLAGS.length);
  });

  it('erzeugte Pläne: RPE, Erholungs-Rhythmus, Einheiten und Ausdauer je Woche, kein Laufen', () => {
    let checked = 0;
    for (const years of [16, 59, 64, 65, 70, 100]) {
      for (const level of LEVELS) {
        for (const flags of [[], ['injury', 'conservative_plan']] as HealthFlag[][]) {
          for (const slots of SCHEDULES) {
            for (const offset of [0, 3]) {
              const today = addDays(MONDAY, offset);
              const make = (goalType: 'active_aging' | 'general_fitness') =>
                generateTrainingPlan(
                  person({
                    goalType,
                    experienceLevel: level,
                    birthDate: born(years),
                    healthScreening: { flags },
                    homeEquipment: [...FULL_HOME],
                    schedule: { mode: 'fixed', slots },
                  }),
                  library,
                  today,
                );
              const a = make('active_aging');
              const g = make('general_fitness');
              const label = `${years} ${level} ${flags.join('+')} ${slots.length} Tage +${offset}`;
              expect(a.ok, label).toBe(g.ok);
              if (!a.ok || !g.ok) continue;
              const sa = weekStats(a.plan.sessions);
              const sg = weekStats(g.plan.sessions);
              expect(sa.maxRpe, label).toBeLessThanOrEqual(Math.min(sg.maxRpe, 6));
              expect(a.plan.load_weeks, label).toBeLessThanOrEqual(g.plan.load_weeks);
              expect(sa.maxSessions, label).toBeLessThanOrEqual(sg.maxSessions);
              expect(sa.maxEndurance, label).toBeLessThanOrEqual(sg.maxEndurance);
              expect(sa.maxEffort, label).toBeLessThanOrEqual(3);
              expect(sa.run, label).toBe(false);
              checked += 1;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  }, 120_000);
});
