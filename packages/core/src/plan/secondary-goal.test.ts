/**
 * Zwei Ziele im Trainingsplan (docs/PLAN-ZIELE.md 4.3, 4.6, 5.1 und Etappe Z1): Nebenziel in Angaben, Schnappschuss
 * und Payload (Wächter B1), Vorlage folgt dem Hauptziel, Haupt-Bewegungsmuster in jeder gewählten Vorlage (S17).
 */
import { describe, expect, it } from 'vitest';

import { EXPERIENCE_LEVELS, GOAL_TYPES, type GoalType, type MovementPattern } from '../enums';
import { GOAL_COMBINATIONS, goalProfile } from '../goals/profile';
import { generateTrainingPlan } from './generate';
import { planInputsSchema, planInputsSnapshot } from './inputs';
import { savePlanInputsSchema, savePlanPayloadSchema, toSavePlanPayload } from './payload';
import { planSnapshot } from './rows';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';
import { planTitle } from './title';
import { planNeedsUpdate } from './update';

const library = repoLibrary();

/** Schlüssel der Angaben im Payload VOR Etappe Z1 (Reihenfolge eingeschlossen). */
const KEYS_BEFORE_Z1 = [
  'goalType',
  'discipline',
  'experienceLevel',
  'schedule',
  'trainingLocation',
  'homeEquipment',
];

function generate(overrides: Parameters<typeof person>[0] = {}) {
  const result = generateTrainingPlan(person(overrides), library, MONDAY);
  if (!result.ok) throw new Error(`Plan nicht erzeugt: ${result.error}`);
  return result.plan;
}

describe('Angaben: Nebenziel optional, Standard null (Wächter B1)', () => {
  it('ohne Angabe → null; verbotenes Paar → ungültig', () => {
    expect(planInputsSchema.parse(person()).secondaryGoalType).toBeNull();
    expect(
      planInputsSchema.safeParse(person({ goalType: 'definition', secondaryGoalType: 'fat_loss' }))
        .success,
    ).toBe(false);
    expect(
      generateTrainingPlan(
        person({ goalType: 'muscle_gain', secondaryGoalType: 'muscle_gain' }),
        library,
        MONDAY,
      ),
    ).toEqual({ ok: false, error: 'invalid_inputs' });
  });

  it('jedes erlaubte Paar ist gültig, jedes verbotene ungültig', () => {
    for (const primary of GOAL_TYPES) {
      for (const secondary of GOAL_TYPES) {
        const allowed = GOAL_COMBINATIONS.some(([p, s]) => p === primary && s === secondary);
        expect(
          planInputsSchema.safeParse(person({ goalType: primary, secondaryGoalType: secondary }))
            .success,
        ).toBe(allowed);
      }
    }
  });

  it('Disziplin auch bei Ausdauer als Nebenziel (F15), sonst weiterhin nur bei Ausdauer', () => {
    expect(
      planInputsSchema.safeParse(
        person({ goalType: 'fat_loss', secondaryGoalType: 'endurance', discipline: '10k' }),
      ).success,
    ).toBe(true);
    expect(
      planInputsSchema.safeParse(
        person({ goalType: 'fat_loss', secondaryGoalType: 'muscle_gain', discipline: '10k' }),
      ).success,
    ).toBe(false);
    expect(
      planInputsSchema.safeParse(person({ goalType: 'fat_loss', discipline: '10k' })).success,
    ).toBe(false);
  });
});

describe('Schnappschuss und Payload (Wächter B1)', () => {
  it('Payload ohne Nebenziel hat GENAU die Schlüssel von vorher (auch die Reihenfolge)', () => {
    for (const goalType of GOAL_TYPES) {
      const plan = generate({ goalType });
      expect(Object.keys(plan.inputs)).toEqual(KEYS_BEFORE_Z1);
      const payload = toSavePlanPayload(plan);
      expect(Object.keys(payload.inputs)).toEqual(KEYS_BEFORE_Z1);
      expect(JSON.stringify(payload.inputs)).not.toContain('secondaryGoalType');
      expect(savePlanPayloadSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('auch mit ausdrücklichem null bleibt der Schlüssel weg', () => {
    const plan = generate({ secondaryGoalType: null });
    expect(Object.keys(toSavePlanPayload(plan).inputs)).toEqual(KEYS_BEFORE_Z1);
  });

  it('mit Nebenziel steht der Schlüssel direkt nach goalType', () => {
    const plan = generate({ goalType: 'fat_loss', secondaryGoalType: 'muscle_gain' });
    const payload = toSavePlanPayload(plan);
    expect(Object.keys(payload.inputs)).toEqual([
      'goalType',
      'secondaryGoalType',
      ...KEYS_BEFORE_Z1.slice(1),
    ]);
    expect(payload.inputs.secondaryGoalType).toBe('muscle_gain');
    expect(savePlanPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('savePlanInputsSchema: fehlend und JSON-null ok, verbotenes Paar / unbekannter Text / Zahl abgelehnt', () => {
    const inputs = toSavePlanPayload(generate()).inputs;
    expect(savePlanInputsSchema.safeParse(inputs).success).toBe(true);
    expect(savePlanInputsSchema.safeParse({ ...inputs, secondaryGoalType: null }).success).toBe(
      true,
    );
    expect(
      savePlanInputsSchema.safeParse({ ...inputs, secondaryGoalType: 'endurance' }).success,
    ).toBe(true);
    for (const bad of ['muscle_gain', 'definition', 'general_fitness', 'kraft', 3, '']) {
      expect(savePlanInputsSchema.safeParse({ ...inputs, secondaryGoalType: bad }).success).toBe(
        false,
      );
    }
  });

  it('alter gespeicherter Schnappschuss ohne Schlüssel (oder mit null) → kein Angebot „Plan neu erstellen?“', () => {
    const plan = generate();
    const stored = JSON.parse(JSON.stringify(toSavePlanPayload(plan).inputs)) as Record<
      string,
      unknown
    >;
    expect('secondaryGoalType' in stored).toBe(false);
    const current = planInputsSnapshot(planInputsSchema.parse(person()));
    const check = (inputs: unknown) => {
      const snapshot = planSnapshot({ inputs });
      expect(snapshot).not.toBeNull();
      return planNeedsUpdate(
        {
          inputs: snapshot!,
          engine_version: plan.engine_version,
          template_id: plan.template_id,
          template_version: plan.template_version,
          created_at: `${MONDAY}T08:00:00Z`,
          created_on: MONDAY,
          uses_health_data: plan.uses_health_data,
        },
        {
          inputs: current,
          birthDate: '1996-01-15',
          latestScreeningAt: null,
          healthConsentValid: true,
        },
        MONDAY,
      ).reasons;
    };
    expect(check(stored)).not.toContain('inputs_changed');
    expect(check({ ...stored, secondaryGoalType: null })).not.toContain('inputs_changed');
    // Nebenziel geändert → Angebot (Snapshot unterscheidet sich, 4.6)
    expect(check({ ...stored, secondaryGoalType: 'fat_loss' })).toContain('inputs_changed');
    expect(planSnapshot({ inputs: { ...stored, secondaryGoalType: null } })).toEqual(
      planSnapshot({ inputs: stored }),
    );
  });
});

describe('Vorlage folgt dem Hauptziel, Muster für beide Ziele (4.3, Wächter S17)', () => {
  /** Haupt-Bewegungsmuster: Kniebeuge, Hüftstreckung, Drücken, Ziehen, Rumpf. */
  const MAIN_PATTERNS: Record<string, readonly MovementPattern[]> = {
    knee: ['squat', 'lunge'],
    hip: ['hinge', 'hip_extension'],
    push: ['horizontal_push', 'vertical_push'],
    pull: ['horizontal_pull', 'vertical_pull'],
    core: ['core_anti_extension', 'core_anti_rotation', 'core_flexion'],
  };
  const SELECTIONS: readonly (readonly [GoalType, GoalType | null])[] = [
    ...GOAL_TYPES.map((goal) => [goal, null] as const),
    ...GOAL_COMBINATIONS,
  ];
  const PROFILES = [
    { trainingLocation: 'gym', homeEquipment: [] },
    { trainingLocation: 'home', homeEquipment: [...FULL_HOME] },
    // nur Körpergewicht (Zuhause ohne Geräte)
    { trainingLocation: 'home', homeEquipment: [] },
  ] as const;

  it('jede Auswahl × Ort × Level × 1–4 und 7 Kraft-Tage: Vorlagen-Ziel = Profil, alle Haupt-Muster enthalten', () => {
    let checked = 0;
    for (const [goalType, secondaryGoalType] of SELECTIONS) {
      for (const level of EXPERIENCE_LEVELS) {
        const profile = goalProfile({ primary: goalType, secondary: secondaryGoalType }, level);
        for (const location of PROFILES) {
          // 1–4 Kraft-Tage und 7 Wunsch-Tage (CLAUDE.md-Eckfall; gedeckelt auf 4, Wächter Z1 K-7)
          for (const days of [1, 2, 3, 4, 7]) {
            const plan = generate({
              goalType,
              secondaryGoalType,
              experienceLevel: level,
              sessionsPerWeek: days,
              preferredDays: days === 7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 3, 5, 6].slice(0, days),
              trainingLocation: location.trainingLocation,
              homeEquipment: [...location.homeEquipment],
            });
            const template = library.templates.find((t) => t.id === plan.template_id);
            expect(template, `${goalType}>${secondaryGoalType} ${level} ${days}`).toBeDefined();
            expect(template!.goal_type).toBe(profile.templateGoal);
            const patterns = new Set(
              template!.sessions.flatMap((s) =>
                s.exercises.map((e) => library.exercises.get(e.exercise_id)?.movement_pattern),
              ),
            );
            for (const [name, group] of Object.entries(MAIN_PATTERNS)) {
              expect(
                group.some((pattern) => patterns.has(pattern)),
                `${template!.id} ohne Muster ${name}`,
              ).toBe(true);
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBe(15 * 3 * 3 * 5);
  }, 120_000);

  it('Hauptziel Ausdauer + Kraft-Nebenziel → Muskelaufbau-Vorlage (mapped, nicht „fallback“)', () => {
    for (const secondaryGoalType of ['muscle_gain', 'definition'] as const) {
      const plan = generate({ goalType: 'endurance', secondaryGoalType });
      expect(library.templates.find((t) => t.id === plan.template_id)?.goal_type).toBe(
        'muscle_gain',
      );
      expect(plan.match_quality).not.toBe('fallback');
    }
    const fallback = generate({ goalType: 'endurance' });
    expect(library.templates.find((t) => t.id === fallback.template_id)?.goal_type).toBe(
      'general_fitness',
    );
    expect(fallback.match_quality).toBe('fallback');
  });

  it('ohne Nebenziel ist der Plan identisch mit dem Plan mit secondaryGoalType: null (Invariante)', () => {
    for (const goalType of GOAL_TYPES) {
      expect(generate({ goalType, secondaryGoalType: null })).toEqual(generate({ goalType }));
    }
  });

  it('Nebenziel ohne Einfluss auf die Vorlage (z. B. Abnehmen → Muskelaufbau) ändert die Einheiten nicht', () => {
    const single = generate({ goalType: 'fat_loss' });
    const pair = generate({ goalType: 'fat_loss', secondaryGoalType: 'muscle_gain' });
    expect(pair.sessions).toEqual(single.sessions);
    expect(pair.template_id).toBe(single.template_id);
  });
});

describe('Ausdauer als Nebenziel: Hinweise, Titel', () => {
  const withEndurance = {
    mode: 'fixed' as const,
    slots: [
      { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
      { weekday: 3, kind: 'endurance' as const, minutes: 30 },
      { weekday: 5, kind: 'strength_gym' as const, minutes: 60 },
    ],
  };

  it('endurance_basic_only bei Ausdauer-Tagen, goal_endurance_not_yet ohne – wie beim Hauptziel Ausdauer', () => {
    const withDays = generate({
      goalType: 'fat_loss',
      secondaryGoalType: 'endurance',
      discipline: '10k',
      schedule: withEndurance,
    });
    expect(withDays.notes).toContain('endurance_basic_only');
    const without = generate({ goalType: 'muscle_gain', secondaryGoalType: 'endurance' });
    expect(without.notes).toContain('goal_endurance_not_yet');
    // Einzelziel ohne Ausdauer: keine Ausdauer-Hinweise (unverändert)
    const single = generate({ goalType: 'fat_loss', schedule: withEndurance });
    expect(single.notes).not.toContain('endurance_basic_only');
    expect(single.notes).not.toContain('goal_endurance_not_yet');
  });

  it('Disziplin des Nebenziels bestimmt die Modalität (Rad)', () => {
    const plan = generate({
      goalType: 'fat_loss',
      secondaryGoalType: 'endurance',
      discipline: 'cycling',
      experienceLevel: 'advanced',
      schedule: withEndurance,
    });
    const endurance = plan.sessions.filter((s) => s.kind === 'endurance');
    expect(endurance.length).toBeGreaterThan(0);
    expect(endurance.every((s) => s.endurance_modality === 'bike')).toBe(true);
  });

  it('Titel: Ausdauer-Grundlage nur bei Hauptziel Ausdauer, sonst Vorlagenname', () => {
    const plan = generate({
      goalType: 'fat_loss',
      secondaryGoalType: 'endurance',
      schedule: withEndurance,
    });
    expect(planTitle({ template_title_de: plan.template_title_de, inputs: plan.inputs })).toEqual({
      kind: 'template',
      title: plan.template_title_de,
    });
    const primary = generate({
      goalType: 'endurance',
      secondaryGoalType: 'muscle_gain',
      schedule: withEndurance,
    });
    expect(
      planTitle({ template_title_de: primary.template_title_de, inputs: primary.inputs }).kind,
    ).toBe('endurance_base');
  });
});
