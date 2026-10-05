import { describe, expect, it } from 'vitest';

import { makeTemplate } from '../content/test-fixtures';
import { equipmentProfile } from './equipment-profile';
import { type PlanInputsInput, planInputsSchema } from './inputs';
import {
  daysScore,
  isBodyweightMatch,
  isTemplateEligible,
  type MatchInputs,
  matchTemplate,
  plannedSessionsPerWeek,
  scoreTemplate,
} from './match';
import { planSafetyRules } from './safety';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();

/** Eingaben des Matchings wie generateTrainingPlan sie bildet (Kraft-Tage, längste Dauer, Ort). */
function matchInputs(overrides: Parameters<typeof person>[0] = {}): MatchInputs {
  const inputs = planInputsSchema.parse(person(overrides));
  return {
    goalType: inputs.goalType,
    experienceLevel: inputs.experienceLevel,
    sex: inputs.sex,
    sessionsPerWeek: overrides.sessionsPerWeek ?? 3,
    minutesPerSession: overrides.minutesPerSession ?? 60,
    trainingLocation: overrides.trainingLocation ?? 'gym',
  };
}

function run(overrides: Parameters<typeof person>[0] = {}) {
  const inputs = planInputsSchema.parse(person(overrides));
  const rules = planSafetyRules(inputs, MONDAY);
  const profile = equipmentProfile(overrides.trainingLocation ?? 'gym', inputs.homeEquipment);
  return matchTemplate(matchInputs(overrides), { library, profile, rules });
}

describe('plannedSessionsPerWeek', () => {
  it.each([
    [1, 1],
    [4, 4],
    [5, 4],
    [7, 4],
  ])('%i Wunsch-Tage → %i Krafteinheiten', (wish, planned) => {
    expect(plannedSessionsPerWeek(wish)).toBe(planned);
  });
});

describe('matchTemplate mit dem Startbestand', () => {
  const GOALS = {
    muscle_gain: 'muskelaufbau',
    fat_loss: 'fettverlust',
    general_fitness: 'fitness',
  } as const;
  const LEVELS = { beginner: 'einsteiger', advanced: 'fortgeschritten' } as const;
  for (const [goal, goalSlug] of Object.entries(GOALS)) {
    for (const [level, levelSlug] of Object.entries(LEVELS)) {
      for (const days of [3, 4]) {
        for (const location of ['gym', 'home'] as const) {
          const id = `${goalSlug}-${levelSlug}-${days}t-${location === 'gym' ? 'studio' : 'zuhause'}`;
          it(`findet ${id} für „ihre“ Person`, () => {
            const result = run({
              goalType: goal as keyof typeof GOALS,
              experienceLevel: level as keyof typeof LEVELS,
              sessionsPerWeek: days,
              preferredDays: days === 3 ? [1, 3, 5] : [1, 2, 4, 5],
              trainingLocation: location,
              homeEquipment: location === 'home' ? [...FULL_HOME] : [],
            });
            expect(result?.template.id).toBe(id);
            expect(result?.quality).toBe('exact');
          });
        }
      }
    }
  }

  it('Einsteiger bekommen nie eine Fortgeschrittenen-Vorlage', () => {
    for (const goalType of [
      'muscle_gain',
      'fat_loss',
      'general_fitness',
      'definition',
      'endurance',
    ] as const) {
      expect(run({ goalType, experienceLevel: 'beginner' })?.template.experience_level).toBe(
        'beginner',
      );
    }
  });

  it('vorsichtiger Plan (Flag) → Einsteiger-Vorlage auch für Fortgeschrittene', () => {
    const result = run({
      experienceLevel: 'advanced',
      healthScreening: { flags: ['injury', 'conservative_plan'] },
    });
    expect(result?.template.experience_level).toBe('beginner');
    expect(result?.quality).toBe('close');
  });

  it('Leistungssport → Fortgeschrittenen-Vorlage, passt genau', () => {
    const result = run({ experienceLevel: 'competitive' });
    expect(result?.template.id).toBe('muskelaufbau-fortgeschritten-3t-studio');
    expect(result?.quality).toBe('exact');
  });

  it('Definition → Muskelaufbau (beschlossen), Ausdauer → Allgemeine Fitness (nächstbeste)', () => {
    expect(run({ goalType: 'definition' })?.template.goal_type).toBe('muscle_gain');
    const endurance = run({ goalType: 'endurance', discipline: '10k' });
    expect(endurance?.template.goal_type).toBe('general_fitness');
    expect(endurance?.quality).toBe('fallback');
    // Ausdauer-Hinweise setzt seit Engine-Version 2 generateTrainingPlan (je nach Ausdauer-Tagen).
    expect(endurance?.notes.has('goal_endurance_not_yet')).toBe(false);
  });

  it('1–2 Tage → 3-Tage-Ganzkörper (Rotation), 5–7 Tage → 4-Tage (gekappt)', () => {
    for (const days of [1, 2]) {
      const result = run({ sessionsPerWeek: days, preferredDays: [] });
      expect(result?.template.sessions_per_week).toBe(3);
      expect(result?.notes.has('days_rotated')).toBe(true);
    }
    for (const days of [5, 6, 7]) {
      const result = run({ sessionsPerWeek: days, preferredDays: [] });
      expect(result?.template.sessions_per_week).toBe(4);
      expect(result?.notes.has('days_capped')).toBe(true);
    }
  });

  it('Zuhause ohne Geräte: Zuhause-Vorlage bleibt die beste', () => {
    const result = run({ trainingLocation: 'home', homeEquipment: [] });
    expect(result?.template.location).toBe('home');
  });

  it('„beides“ → Studio-Vorlage', () => {
    expect(run({ trainingLocation: 'both' })?.template.location).toBe('gym');
  });

  it('keine Inhalte → null (no_template)', () => {
    const inputs = planInputsSchema.parse(person());
    const empty = { exercises: new Map(), templates: [], containsDrafts: false };
    expect(
      matchTemplate(matchInputs(), {
        library: empty,
        profile: equipmentProfile('gym', []),
        rules: planSafetyRules(inputs, MONDAY),
      }),
    ).toBeNull();
  });

  it('Gleichstand → alphabetisch erste ID (deterministisch)', () => {
    const a = run();
    const b = run();
    expect(a?.template.id).toBe(b?.template.id);
  });

  it('Geschlecht der Vorlage: nur passende oder ohne Angabe', () => {
    const rules = planSafetyRules(planInputsSchema.parse(person()), MONDAY);
    expect(isTemplateEligible(makeTemplate({ sex: 'male' }), { sex: 'female' }, rules)).toBe(false);
    expect(isTemplateEligible(makeTemplate({ sex: null }), { sex: 'diverse' }, rules)).toBe(true);
    expect(isTemplateEligible(makeTemplate({ sex: null }), { sex: 'unspecified' }, rules)).toBe(
      true,
    );
  });

  it('Punkte: Dauer anteilig bei kürzerem Budget', () => {
    const inputs = planInputsSchema.parse(person({ minutesPerSession: 20 }));
    const ctx = {
      library,
      profile: equipmentProfile('gym', []),
      rules: planSafetyRules(inputs, MONDAY),
    };
    const template = library.templates.find((t) => t.id === 'muskelaufbau-einsteiger-3t-studio');
    if (!template) throw new Error('Vorlage fehlt');
    const score = scoreTemplate(template, matchInputs({ minutesPerSession: 20 }), ctx);
    expect(score.breakdown.duration).toBeCloseTo((5 * 20) / 45);
    expect(score.coverage).toBe(1);
  });
});

describe('Körpergewicht-Regel (docs/PLAN-KOERPERGEWICHT.md §5, Etappe K2+K3)', () => {
  const GOAL_TYPES = [
    'muscle_gain',
    'fat_loss',
    'general_fitness',
    'definition',
    'endurance',
  ] as const;
  const LEVELS = ['beginner', 'advanced', 'competitive'] as const;
  const home = (homeEquipment: PlanInputsInput['homeEquipment'] = []) => ({
    trainingLocation: 'home' as const,
    homeEquipment,
  });

  it('ohne Kraft-Geräte zu Hause: immer eine *-koerpergewicht-Vorlage (alle Ziele × Level × 1–7 Tage)', () => {
    for (const goalType of GOAL_TYPES) {
      for (const experienceLevel of LEVELS) {
        for (let days = 1; days <= 7; days += 1) {
          const result = run({
            goalType,
            experienceLevel,
            sessionsPerWeek: days,
            preferredDays: [],
            minutesPerSession: 40,
            ...home(),
          });
          const label = `${goalType}/${experienceLevel}/${days}`;
          expect(result?.template.id, label).toMatch(/-koerpergewicht$/);
          expect(result?.notes.has('location_mismatch'), label).toBe(false);
          const expectedDays = days <= 2 ? 2 : Math.min(days, 4);
          expect(result?.template.sessions_per_week, label).toBe(expectedDays);
          if (experienceLevel === 'beginner') {
            expect(result?.template.experience_level, label).toBe('beginner');
          }
        }
      }
    }
  });

  it('1 Kraft-Tag → 2-Tage-Ganzkörper-Vorlage im Wechsel (A12), 2 Tage → 2-Tage-Vorlage genau', () => {
    const one = run({ sessionsPerWeek: 1, preferredDays: [3], minutesPerSession: 40, ...home() });
    expect(one?.template.id).toBe('muskelaufbau-einsteiger-2t-koerpergewicht');
    expect(one?.notes.has('days_rotated')).toBe(true);
    expect(one?.quality).toBe('close');
    const two = run({
      sessionsPerWeek: 2,
      preferredDays: [1, 4],
      minutesPerSession: 40,
      ...home(),
    });
    expect(two?.template.id).toBe('muskelaufbau-einsteiger-2t-koerpergewicht');
    expect(two?.notes.has('days_rotated')).toBe(false);
    expect(two?.quality).toBe('exact');
  });

  it('Ausdauer-Geräte (Laufband, Ergometer, Rudergerät) und „Sonstiges“ zählen nicht als Kraft-Geräte (A6)', () => {
    for (const equipmentId of ['treadmill', 'bike_ergometer', 'rowing_machine', 'other'] as const) {
      const result = run({ ...home([{ equipmentId, weightsKg: [] }]), minutesPerSession: 40 });
      expect(result?.template.id, equipmentId).toBe('muskelaufbau-einsteiger-3t-koerpergewicht');
    }
  });

  it('nur Bank, Bank + Klimmzugstange, Laufband + Bank → Körpergewicht-Vorlage (W2)', () => {
    const cases = [
      ['flat_bench'],
      ['incline_bench'],
      ['flat_bench', 'pull_up_bar'],
      ['treadmill', 'flat_bench', 'incline_bench'],
    ] as const;
    for (const ids of cases) {
      const result = run({
        ...home(ids.map((equipmentId) => ({ equipmentId, weightsKg: [] }))),
        minutesPerSession: 40,
      });
      expect(result?.template.id, ids.join('+')).toBe('muskelaufbau-einsteiger-3t-koerpergewicht');
    }
  });

  it('nur Klimmzugstange → Körpergewicht-Vorlage, der Klimmzug ist als Variante machbar (A6)', () => {
    const bar = [{ equipmentId: 'pull_up_bar' as const, weightsKg: [] }];
    const result = run({ ...home(bar), minutesPerSession: 40 });
    expect(result?.template.id).toBe('muskelaufbau-einsteiger-3t-koerpergewicht');
    const ids = result?.template.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(ids).toContain('handtuch-latziehen');
    const latziehen = library.exercises.get('handtuch-latziehen');
    expect(latziehen?.alternatives.map((a) => a.alternative_id)).toContain('klimmzug');
  });

  it('mit Kraft-Geräten, im Studio oder „beides“: nie eine Körpergewicht-Vorlage', () => {
    const cases: Parameters<typeof person>[0][] = [
      { trainingLocation: 'gym' },
      { trainingLocation: 'both' },
      { trainingLocation: 'both', homeEquipment: [] },
      home([{ equipmentId: 'dumbbells', weightsKg: [4, 8] }]),
      home([{ equipmentId: 'resistance_bands', weightsKg: [] }]),
      home([{ equipmentId: 'kettlebells', weightsKg: [8] }]),
      home([
        { equipmentId: 'pull_up_bar', weightsKg: [] },
        { equipmentId: 'resistance_bands', weightsKg: [] },
      ]),
      home([...FULL_HOME]),
    ];
    for (const overrides of cases) {
      for (const days of [1, 2, 3, 4, 7]) {
        const result = run({ ...overrides, sessionsPerWeek: days, preferredDays: [] });
        expect(result?.template.id, JSON.stringify(overrides)).not.toMatch(/-koerpergewicht$/);
      }
    }
  });

  it('keine passende Körpergewicht-Vorlage → bisherige Suche mit sichtbarem Hinweis (A5)', () => {
    const inputs = planInputsSchema.parse(person(home()));
    const withoutBodyweight = {
      ...library,
      templates: library.templates.filter((t) => !t.id.endsWith('-koerpergewicht')),
    };
    const result = matchTemplate(matchInputs({ trainingLocation: 'home' }), {
      library: withoutBodyweight,
      profile: equipmentProfile('home', []),
      rules: planSafetyRules(inputs, MONDAY),
    });
    expect(result?.template.id).toBe('muskelaufbau-einsteiger-3t-zuhause');
    expect(result?.notes.has('location_mismatch')).toBe(true);
    expect(result?.quality).toBe('fallback');
  });

  it('isTemplateEligible: Körpergewicht-Vorlage nur für Körpergewicht-Profile – und umgekehrt', () => {
    const rules = planSafetyRules(planInputsSchema.parse(person()), MONDAY);
    const bodyweight = makeTemplate({ location: 'home' });
    const dumbbell = makeTemplate({ location: 'home', required_equipment_ids: ['dumbbells'] });
    const gym = makeTemplate();
    const sexOnly = makeTemplate({ location: 'home', sex: 'male' });
    expect(isTemplateEligible(bodyweight, { sex: 'female' }, rules, true)).toBe(true);
    expect(isTemplateEligible(bodyweight, { sex: 'female' }, rules, false)).toBe(false);
    expect(isTemplateEligible(bodyweight, { sex: 'female' }, rules)).toBe(false);
    expect(isTemplateEligible(dumbbell, { sex: 'female' }, rules, true)).toBe(false);
    expect(isTemplateEligible(gym, { sex: 'female' }, rules, true)).toBe(false);
    expect(isTemplateEligible(gym, { sex: 'female' }, rules, false)).toBe(true);
    expect(isTemplateEligible(sexOnly, { sex: 'female' }, rules, true)).toBe(false);
  });

  it('isBodyweightMatch: nur wenn ALLE Kraft-Tage zu Hause sind', () => {
    const profile = equipmentProfile('home', []);
    expect(isBodyweightMatch({ trainingLocation: 'home' }, profile)).toBe(true);
    expect(isBodyweightMatch({ trainingLocation: 'both' }, profile)).toBe(false);
    expect(isBodyweightMatch({ trainingLocation: 'gym' }, equipmentProfile('gym', []))).toBe(false);
  });

  it('daysScore: 1 Tag → 2-Tage-Ganzkörper vor 3-Tage-Ganzkörper; Ober-/Unterkörper bekommt keine Punkte', () => {
    const fullBody = (n: number) =>
      makeTemplate({
        sessions_per_week: n,
        sessions: makeTemplate().sessions.slice(0, n),
      });
    expect(daysScore(fullBody(2), 1)).toBe(14);
    expect(daysScore(fullBody(3), 1)).toBe(12);
    expect(daysScore(fullBody(2), 2)).toBe(15);
    expect(daysScore(fullBody(3), 2)).toBe(12);
    const split = makeTemplate({
      sessions: makeTemplate().sessions.map((s) => ({ ...s, focus: 'upper' as const })),
    });
    expect(daysScore(split, 1)).toBe(0);
    expect(daysScore(fullBody(3), 3)).toBe(15);
  });
});
