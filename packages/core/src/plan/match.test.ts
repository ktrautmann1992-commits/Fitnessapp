import { describe, expect, it } from 'vitest';

import { makeTemplate } from '../content/test-fixtures';
import { equipmentProfile } from './equipment-profile';
import { planInputsSchema } from './inputs';
import { isTemplateEligible, matchTemplate, plannedSessionsPerWeek, scoreTemplate } from './match';
import { planSafetyRules } from './safety';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();

function run(overrides: Parameters<typeof person>[0] = {}) {
  const inputs = planInputsSchema.parse(person(overrides));
  const rules = planSafetyRules(inputs, MONDAY);
  const profile = equipmentProfile(inputs.trainingLocation, inputs.homeEquipment);
  return matchTemplate(inputs, { library, profile, rules });
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

  it('Definition → Muskelaufbau (beschlossen), Ausdauer → Allgemeine Fitness mit Hinweis', () => {
    expect(run({ goalType: 'definition' })?.template.goal_type).toBe('muscle_gain');
    const endurance = run({ goalType: 'endurance', discipline: '10k' });
    expect(endurance?.template.goal_type).toBe('general_fitness');
    expect(endurance?.quality).toBe('fallback');
    expect(endurance?.notes.has('goal_endurance_not_yet')).toBe(true);
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
      matchTemplate(inputs, {
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
    const score = scoreTemplate(template, inputs, ctx);
    expect(score.breakdown.duration).toBeCloseTo((5 * 20) / 45);
    expect(score.coverage).toBe(1);
  });
});
