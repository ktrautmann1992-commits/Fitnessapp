/**
 * Fit im Alter · Etappe FA1 (docs/PLAN-FIT-IM-ALTER.md 7, 8.1, 9, 17.1): Sicherheitsprofil des Ziels `active_aging`.
 * Erwartungen UNABHÄNGIG aus der Plantabelle abgeschrieben (nicht aus ACTIVE_AGING_RULES), Grenzfälle nach DoD 17.1:
 * sehr alt (95, 100), Altersgrenzen 59/60/64/65/69/70 am Geburtstag, 1 vs. 3 vs. 7 Wunschtage, jedes Flag einzeln und
 * alle zusammen, Ziel mit 55, Kürzen auf 20 min, 70-Jähriger ohne Flag mit Level „aktiv“ (Wächter N1).
 */
import { describe, expect, it } from 'vitest';

import { fastIncreaseExclusion } from '../adjust/rules/state-rules';
import { liveInputs } from '../adjust/test-helpers';
import { makeExercise } from '../content/test-fixtures';
import type { Exercise } from '../content/schemas';
import { addDays } from '../dates';
import type { CautionTag, ExperienceLevel, MovementPattern } from '../enums';
import { HEALTH_FLAGS, type HealthFlag } from '../health-screening';
import { fitSessionToMinutes, type PlannedExerciseDraft } from './adapt';
import { competitionFeasibility } from './competition';
import { generateTrainingPlan } from './generate';
import { cautiousProgression, planSafetyRules } from './safety';
import { planFloorRules, planStartGroup } from './start-group';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();

// Plantabelle 8.1 Nr. 1/2, 7 (Startgruppe, Erholung), bewusst abgeschrieben.
const PLAN = {
  rpeMax: 6,
  excluded: [
    'high_impact',
    'high_skill',
    'spinal_loading',
    'overhead',
    'long_supine',
    'floor_transfer',
    'spinal_flexion',
    'trunk_rotation',
  ] as CautionTag[],
  loadWeeks: 4,
  effortMax: 3,
  maxSessionsPerWeek: 5,
  holdMaxS: 30,
};

/** Geburtsdatum, an dem die Person am Stichtag genau `years` alt wird (Geburtstag heute). */
const bornYearsAgo = (years: number, on = MONDAY) =>
  `${Number(on.slice(0, 4)) - years}${on.slice(4)}`;

const rules = (
  goal: 'active_aging' | 'general_fitness',
  level: ExperienceLevel,
  birthDate: string,
  flags: readonly HealthFlag[] | null = [],
) =>
  planSafetyRules(
    {
      experienceLevel: level,
      birthDate,
      healthScreening: flags === null ? null : { flags },
      goalType: goal,
    },
    MONDAY,
  );

describe('Sicherheitsprofil „Fit im Alter“ (Plan 8.1)', () => {
  it('RPE ≤ 6, alle Ausschlüsse, Ausdauer vorsichtig und nur Gehen – unabhängig vom Alter', () => {
    const r = rules('active_aging', 'advanced', '1996-01-15');
    expect(r.rpeMax).toBe(PLAN.rpeMax);
    expect([...r.excludedCautionTags].sort()).toEqual([...PLAN.excluded].sort());
    expect(r.enduranceStartGroup).toBe('cautious');
    expect(r.enduranceWalkOnly).toBe(true);
    expect(r.enduranceEffortMax).toBe(PLAN.effortMax);
    expect(r.activeAging).toBe(true);
    expect(cautiousProgression(r)).toBe(true);
  });

  it('Wächter N1: NICHT das Flag `cautious` – „aktiv“-Vorlagen bleiben wählbar', () => {
    const r = rules('active_aging', 'advanced', bornYearsAgo(70));
    expect(r.cautious).toBe(false);
    expect(r.beginnerTemplatesOnly).toBe(false);
  });

  it('ein Gesundheits-Flag gilt wie heute (Einsteiger-Vorlagen, Arzt-Hinweis)', () => {
    const r = rules('active_aging', 'advanced', bornYearsAgo(70), ['injury', 'conservative_plan']);
    expect(r.cautious).toBe(true);
    expect(r.beginnerTemplatesOnly).toBe(true);
    expect(r.rpeMax).toBe(PLAN.rpeMax);
  });

  it.each([55, 59, 60, 64, 65, 69, 70, 95, 100])(
    'Alter %i (Geburtstag heute): RPE ≤ 6 und alle Ausschlüsse',
    (years) => {
      const r = rules('active_aging', 'beginner', bornYearsAgo(years));
      expect(r.rpeMax).toBe(PLAN.rpeMax);
      for (const tag of PLAN.excluded) expect(r.excludedCautionTags).toContain(tag);
    },
  );

  it.each([...HEALTH_FLAGS.map((f) => [f] as HealthFlag[]), [...HEALTH_FLAGS], [], null])(
    'Flags %j: nie lockerer als ohne Flag',
    (flags) => {
      const r = rules('active_aging', 'competitive', '1960-03-01', flags);
      expect(r.rpeMax).toBeLessThanOrEqual(PLAN.rpeMax);
      for (const tag of PLAN.excluded) expect(r.excludedCautionTags).toContain(tag);
      expect(r.enduranceStartGroup).toBe('cautious');
    },
  );

  it('andere Ziele unverändert (Gegenprobe)', () => {
    const r = rules('general_fitness', 'advanced', '1996-01-15');
    expect(r.activeAging).toBe(false);
    expect(r.rpeMax).toBe(9);
    expect(r.excludedCautionTags).toEqual([]);
    expect(r.enduranceStartGroup).toBe('advanced');
  });

  it('ohne Ziel-Angabe (alte Aufrufer) wie bisher', () => {
    const r = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1996-01-15', healthScreening: { flags: [] } },
      MONDAY,
    );
    expect(r.activeAging).toBe(false);
  });
});

describe('gespeicherter Plan: Startgruppe und Mindest-Regeln aus den Angaben', () => {
  const plan = (goalType: string) => ({
    uses_health_data: true,
    medical_notice: false,
    created_at: '2026-10-05T08:00:00Z',
    inputs: { goalType, experienceLevel: 'advanced' },
  });
  it('Fit im Alter → Startgruppe vorsichtig, Mindest-Regeln mit dem Profil', () => {
    expect(planStartGroup(plan('active_aging'), '1990-01-01')).toBe('cautious');
    const floor = planFloorRules(plan('active_aging'), '1990-01-01');
    expect(floor.activeAging).toBe(true);
    expect(floor.rpeMax).toBe(PLAN.rpeMax);
  });
  it('anderes oder unlesbares Ziel → wie bisher', () => {
    expect(planStartGroup(plan('general_fitness'), '1990-01-01')).toBe('advanced');
    expect(planStartGroup(plan('kraft'), '1990-01-01')).toBe('advanced');
    expect(planFloorRules(plan('kraft'), '1990-01-01').activeAging).toBe(false);
  });
});

describe('Plan erzeugen mit „Fit im Alter“', () => {
  const generate = (overrides: Parameters<typeof person>[0]) => {
    const result = generateTrainingPlan(
      person({ goalType: 'active_aging', homeEquipment: [...FULL_HOME], ...overrides }),
      library,
      MONDAY,
    );
    if (!result.ok) throw new Error(result.error);
    return result.plan;
  };

  const checkPlan = (plan: ReturnType<typeof generate>, label: string) => {
    expect(plan.load_weeks, label).toBe(PLAN.loadWeeks);
    for (const s of plan.sessions) {
      for (const e of s.exercises) {
        expect(e.rpe_target, label).toBeLessThanOrEqual(PLAN.rpeMax);
        expect(e.rpe_target, label).toBeGreaterThanOrEqual(5);
        if (e.duration_s !== null) expect(e.duration_s, label).toBeLessThanOrEqual(PLAN.holdMaxS);
        const tags = library.exercises.get(e.exercise_id)?.caution_tags ?? [];
        expect(
          tags.filter((t) => PLAN.excluded.includes(t)),
          `${label} ${e.exercise_id}`,
        ).toEqual([]);
      }
      if (s.kind === 'endurance') {
        expect(s.endurance_modality, label).not.toBe('run');
        expect(s.effort_target ?? 0, label).toBeLessThanOrEqual(PLAN.effortMax);
      }
    }
    // Höchstens 5 Einheiten je Kalenderwoche.
    const perWeek = new Map<string, number>();
    for (const s of plan.sessions) {
      const key = `${s.block_no}:${s.week_no}`;
      perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
    }
    for (const n of perWeek.values()) expect(n, label).toBeLessThanOrEqual(PLAN.maxSessionsPerWeek);
  };

  it('Wächter N1: 70-Jähriger ohne Flag, Level „aktiv“ → aktiv-Vorlage, Erholung nach 4 Wochen, Ausdauer vorsichtig', () => {
    const plan = generate({
      experienceLevel: 'advanced',
      birthDate: bornYearsAgo(70),
      sessionsPerWeek: 3,
      trainingLocation: 'gym',
    });
    const template = library.templates.find((t) => t.id === plan.template_id);
    expect(template?.experience_level).toBe('advanced');
    expect(plan.load_weeks).toBe(4);
    expect(plan.safety_rules.enduranceStartGroup).toBe('cautious');
    expect(plan.match_quality).toBe('fallback');
    checkPlan(plan, '70 aktiv');
  });

  it.each([
    [1, [3]],
    [3, [1, 3, 5]],
    [7, [1, 2, 3, 4, 5, 6, 7]],
  ] as const)('%i Wunschtag(e) zu Hause: Grenzen eingehalten', (n, days) => {
    const plan = generate({
      sessionsPerWeek: n,
      preferredDays: [...days],
      trainingLocation: 'home',
      birthDate: bornYearsAgo(72),
    });
    checkPlan(plan, `${n} Tage`);
  });

  it('Kraft + Gehen: Ausdauer-Tage werden Gehen mit Anstrengung ≤ 3, Start 45 min je Woche', () => {
    const plan = generateTrainingPlan(
      person({
        goalType: 'active_aging',
        experienceLevel: 'advanced',
        birthDate: bornYearsAgo(68),
        schedule: {
          mode: 'fixed',
          slots: [
            { weekday: 1, kind: 'strength_home', minutes: 30 },
            { weekday: 3, kind: 'endurance', minutes: 30 },
            { weekday: 4, kind: 'strength_home', minutes: 30 },
            { weekday: 6, kind: 'endurance', minutes: 30 },
          ],
        },
      }),
      library,
      MONDAY,
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    checkPlan(plan.plan, 'Kraft + Gehen');
    const endurance = plan.plan.sessions.filter((s) => s.kind === 'endurance');
    expect(endurance.length).toBeGreaterThan(0);
    expect(endurance.every((s) => s.endurance_modality === 'walk')).toBe(true);
    const firstFullWeek = endurance.filter((s) => s.week_no === 1);
    const minutes = firstFullWeek.reduce((sum, s) => sum + s.estimated_minutes, 0);
    expect(minutes).toBeLessThanOrEqual(45);
    expect(firstFullWeek.every((s) => s.estimated_minutes <= 20)).toBe(true);
  });

  it('Ziel mit 55 Jahren: dasselbe Sicherheitsprofil', () => {
    checkPlan(generate({ birthDate: bornYearsAgo(55) }), '55');
  });

  it('jedes Flag einzeln und alle zusammen: gültiger Plan, Grenzen eingehalten', () => {
    for (const flags of [...HEALTH_FLAGS.map((f) => [f]), [...HEALTH_FLAGS]]) {
      if (flags.includes('pregnancy')) continue; // Schwangerschaft mit 70 nicht sinnvoll – eigener Regelweg
      checkPlan(
        generate({ birthDate: bornYearsAgo(75), healthScreening: { flags } }),
        flags.join('+'),
      );
    }
  });
});

describe('Kürzen schützt Gleichgewicht und Beweglichkeit (Wächter S8)', () => {
  const lib = new Map<string, Exercise>(
    (
      [
        ['gg-1', 'balance', 'compound'],
        ['gg-2', 'balance', 'isolation'],
        ['gg-3', 'balance', 'isolation'],
        ['kraft-1', 'squat', 'compound'],
        ['kraft-2', 'horizontal_pull', 'compound'],
        ['iso-1', 'elbow_flexion', 'isolation'],
        ['iso-2', 'calf_raise', 'isolation'],
        ['mob-1', 'mobility', 'isolation'],
      ] as [string, MovementPattern, 'compound' | 'isolation'][]
    ).map(([id, pattern, mechanics]) => [
      id,
      makeExercise({ id, movement_pattern: pattern, mechanics, equipment_ids: [] }),
    ]),
  );
  const draft = (id: string, order: number): PlannedExerciseDraft => ({
    order_no: order,
    exercise_id: id,
    source_exercise_id: id,
    exercise_name_de: id,
    sets: 3,
    reps_min: 10,
    reps_max: 15,
    duration_s: null,
    rest_s: 90,
    rpe_target: 6,
    superset_group: null,
    notes_de: null,
    target_weight_kg: null,
  });
  const session = ['gg-1', 'gg-2', 'gg-3', 'kraft-1', 'kraft-2', 'iso-1', 'iso-2', 'mob-1'].map(
    (id, i) => draft(id, i + 1),
  );
  const keep = { balance: 2, mobility: 1 };
  const patternOf = (id: string) => lib.get(id)?.movement_pattern;

  it.each([10, 20, 30, 45])(
    '%i Minuten: ≥ 2 Gleichgewicht, ≥ 1 Beweglichkeit bleiben',
    (minutes) => {
      const fit = fitSessionToMinutes(session, minutes, lib, { keepPatterns: keep });
      const ids = fit.exercises.map((e) => e.exercise_id);
      expect(ids.filter((id) => patternOf(id) === 'balance').length).toBeGreaterThanOrEqual(2);
      expect(ids.filter((id) => patternOf(id) === 'mobility').length).toBeGreaterThanOrEqual(1);
      expect(fit.exercises.length).toBeGreaterThanOrEqual(3);
    },
  );

  it('20 min: zuerst fallen Kraft-Isolationsübungen, nicht Gleichgewicht', () => {
    const fit = fitSessionToMinutes(session, 20, lib, { keepPatterns: keep });
    const ids = fit.exercises.map((e) => e.exercise_id);
    expect(ids).not.toContain('iso-1');
    expect(ids).not.toContain('iso-2');
    expect(ids).toContain('mob-1');
  });

  it('ohne Option: Verhalten wie bisher (Gleichgewicht kann fallen)', () => {
    const fit = fitSessionToMinutes(session, 10, lib);
    expect(fit.exercises.map((e) => e.exercise_id)).not.toContain('mob-1');
  });
});

describe('R1 „schneller steigern“ nie (Plan 8.1 Nr. 8)', () => {
  it('Ziel Fit im Alter → Grund active_aging, auch für 40-jährige Fortgeschrittene', () => {
    const r = rules('active_aging', 'advanced', '1986-01-15');
    expect(fastIncreaseExclusion(liveInputs([], { rules: r }))).toBe('active_aging');
  });
  it('vorsichtiger Plan bleibt cautious_plan (Reihenfolge)', () => {
    const r = rules('active_aging', 'advanced', '1986-01-15', null);
    expect(fastIncreaseExclusion(liveInputs([], { rules: r }))).toBe('cautious_plan');
  });
});

describe('kein Wettkampfplan mit Hauptziel „Fit im Alter“ (Plan 3.2)', () => {
  const request = {
    competition: {
      name: 'Stadtlauf',
      discipline: '5k' as const,
      raceDate: addDays(MONDAY, 120),
      goal: 'finish' as const,
    },
  };
  const runner = (goalType: 'active_aging' | 'endurance') =>
    person({
      goalType,
      discipline: goalType === 'endurance' ? '5k' : null,
      experienceLevel: 'advanced',
      schedule: {
        mode: 'fixed',
        slots: [2, 4, 6].map((weekday) => ({ weekday, kind: 'endurance' as const, minutes: 45 })),
      },
    });

  it('Gegenprobe: dieselbe Anfrage mit Ziel Ausdauer ist gültig', () => {
    expect(competitionFeasibility(runner('endurance'), request, MONDAY).ok).toBe(true);
  });

  it('Ziel Fit im Alter → abgelehnt', () => {
    const result = competitionFeasibility(runner('active_aging'), request, MONDAY);
    expect(result).toEqual({ ok: false, error: 'invalid_inputs' });
  });
});
