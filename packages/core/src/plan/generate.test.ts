import { describe, expect, it } from 'vitest';

import { PLAN_ENGINE_VERSION } from '../constants';
import { addDays, isoWeekday } from '../dates';
import { HEALTH_FLAGS } from '../health-screening';
import { LIBRARY, makeTemplate, META } from '../content/test-fixtures';
import { planLibraryFromContent } from './content-pool';
import { generatedPlanSchema, generateTrainingPlan, isPlanWithinLimits } from './generate';
import { planInputsSchema } from './inputs';
import { FULL_HOME, MONDAY, person, repoLibrary } from './test-library';

const library = repoLibrary();

function plan(overrides: Parameters<typeof person>[0] = {}, today = MONDAY) {
  const result = generateTrainingPlan(person(overrides), library, today);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

const ids = (p: ReturnType<typeof plan>) =>
  p.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));

describe('generateTrainingPlan – Grundfall', () => {
  it('Muskelaufbau, Einsteiger, 3 Tage Mo/Mi/Fr, Studio: passt genau, 6 Wochen, Einstiegs- und Erholungswoche', () => {
    const p = plan();
    expect(p.template_id).toBe('muskelaufbau-einsteiger-3t-studio');
    expect(p.template_title_de).toBe('Muskelaufbau · Einsteiger · 3 Tage · Studio');
    expect(p.match_quality).toBe('exact');
    expect(p.notes).toEqual([]);
    expect(p.engine_version).toBe(PLAN_ENGINE_VERSION);
    expect(p.sessions).toHaveLength(18);
    expect(p.load_weeks).toBe(5);
    expect(p.sessions.filter((s) => s.is_intro_week)).toHaveLength(3);
    expect(p.sessions.filter((s) => s.is_deload)).toHaveLength(3);
    expect(p.uses_health_data).toBe(true);
    expect(p.medical_notice).toBe(false);
    expect(p.uses_draft_content).toBe(true);
    expect(p.sessions.every((s) => s.exercises.every((e) => e.target_weight_kg === null))).toBe(
      true,
    );
    expect(generatedPlanSchema.safeParse(p).success).toBe(true);
  });

  it('deterministisch: gleiche Eingaben → gleicher Plan', () => {
    expect(plan()).toEqual(plan());
  });

  it('Eingaben ungültig → invalid_inputs; keine Inhalte → no_template', () => {
    expect(generateTrainingPlan(person({ sessionsPerWeek: 0 }), library, MONDAY)).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
    expect(generateTrainingPlan(person(), library, 'gestern')).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
    expect(generateTrainingPlan(person({ birthDate: '2030-01-01' }), library, MONDAY)).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
    expect(
      generateTrainingPlan(
        person(),
        { exercises: new Map(), templates: [], containsDrafts: false },
        MONDAY,
      ),
    ).toEqual({ ok: false, error: 'no_template' });
  });

  it('Mindestalter 16: mit 15 Jahren kein Plan (invalid_inputs), am 16. Geburtstag schon', () => {
    expect(generateTrainingPlan(person({ birthDate: '2011-01-01' }), library, MONDAY)).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
    expect(generateTrainingPlan(person({ birthDate: '2010-10-06' }), library, MONDAY).ok).toBe(
      false,
    );
    expect(generateTrainingPlan(person({ birthDate: '2010-10-05' }), library, MONDAY).ok).toBe(
      true,
    );
  });

  it('Körperdaten gehen nicht ein: Körpergewicht ist kein Eingabefeld (45 kg wie 180 kg)', () => {
    const keys = Object.keys(planInputsSchema.shape ?? {});
    for (const forbidden of ['weightKg', 'heightCm', 'bodyFatPct', 'restingHeartRateBpm']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(generateTrainingPlan({ ...person(), weightKg: 45 } as never, library, MONDAY).ok).toBe(
      false,
    );
    expect(generateTrainingPlan({ ...person(), weightKg: 180 } as never, library, MONDAY).ok).toBe(
      false,
    );
  });
});

describe('Tage pro Woche 1–7', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('%i Tage', (days) => {
    const p = plan({ sessionsPerWeek: days, preferredDays: [] });
    const perWeek = Math.min(days, 4);
    expect(p.training_week.map((d) => d.weekday)).toHaveLength(perWeek);
    const week2 = p.sessions.filter((s) => s.week_no === 2);
    expect(week2).toHaveLength(perWeek);
    if (days <= 2) expect(p.notes).toContain('days_rotated');
    if (days >= 5) expect(p.notes).toContain('days_capped');
    expect(isPlanWithinLimits(p)).toBe(true);
  });

  it('„Tage egal“: Standardmuster, keine Wunsch-Tage mehr (days_added entfällt)', () => {
    const p = plan({ sessionsPerWeek: 3, preferredDays: [] });
    expect(p.training_week.map((d) => d.weekday)).toEqual([1, 3, 5]);
    expect(p.notes).not.toContain('days_added');
  });

  it('2 Tage Ganzkörper Sa + So → Hinweis back_to_back_sessions', () => {
    expect(plan({ sessionsPerWeek: 2, preferredDays: [6, 7] }).notes).toContain(
      'back_to_back_sessions',
    );
  });
});

describe('Geräte', () => {
  it('Zuhause ohne Geräte: Hinweise Tausch, Zug-Übung ohne Geräte (K1); alles ohne Geräte machbar', () => {
    const p = plan({
      trainingLocation: 'home',
      homeEquipment: [],
      sessionsPerWeek: 2,
      preferredDays: [],
    });
    expect(p.notes).toEqual(expect.arrayContaining(['days_rotated', 'exercises_substituted']));
    expect(p.notes).not.toContain('no_pull_exercise');
    expect(p.match_quality).toBe('close');
    for (const id of ids(p)) {
      expect(library.exercises.get(id)?.equipment_ids).toEqual([]);
    }
  });

  it('Bibliothek ohne Zug-Übungen ohne Geräte: Hinweise Entfernen und no_pull_exercise', () => {
    const pull = ['tuerrahmen-rudern', 'handtuch-rudern-isometrisch', 'tisch-rudern'];
    const reduced = {
      ...library,
      exercises: new Map([...library.exercises].filter(([id]) => !pull.includes(id))),
    };
    const result = generateTrainingPlan(
      person({
        trainingLocation: 'home',
        homeEquipment: [],
        sessionsPerWeek: 2,
        preferredDays: [],
      }),
      reduced,
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.notes).toEqual(
        expect.arrayContaining(['exercises_removed', 'no_pull_exercise']),
      );
    }
  });

  it('nur Studio-Geräte (Studio): nichts getauscht', () => {
    const p = plan({ trainingLocation: 'gym' });
    expect(
      p.sessions.flatMap((s) => s.exercises).every((e) => e.exercise_id === e.source_exercise_id),
    ).toBe(true);
  });

  it('Zuhause mit voller Ausstattung: Zuhause-Vorlage, passt genau', () => {
    const p = plan({ trainingLocation: 'home', homeEquipment: [...FULL_HOME] });
    expect(p.template_id).toBe('muskelaufbau-einsteiger-3t-zuhause');
    expect(p.match_quality).toBe('exact');
  });
});

describe('Vorsicht, Alter, Gesundheitsdaten', () => {
  it('Herz-Frage mit Ja: RPE ≤ 7, keine Langhantel-Kniebeuge, kein Über-Kopf, Arzt-Hinweis, 4 + 1 Wochen', () => {
    const p = plan({
      experienceLevel: 'advanced',
      healthScreening: { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    });
    expect(p.template_id).toMatch(/einsteiger/);
    expect(ids(p)).not.toContain('kniebeuge-langhantel');
    expect(ids(p).some((id) => library.exercises.get(id)?.caution_tags.includes('overhead'))).toBe(
      false,
    );
    expect(p.sessions.flatMap((s) => s.exercises).every((e) => e.rpe_target <= 7)).toBe(true);
    expect(p.medical_notice).toBe(true);
    expect(p.uses_health_data).toBe(true);
    expect(p.load_weeks).toBe(4);
    // Kein Vorsichts-Code gespeichert.
    expect(p.notes).not.toContain('exercises_substituted');
  });

  it.each(HEALTH_FLAGS)('jedes Flag (%s): vorsichtig mit Arzt-Hinweis', (flag) => {
    const p = plan({ healthScreening: { flags: [flag] } });
    expect(p.medical_notice).toBe(true);
    expect(p.sessions.flatMap((s) => s.exercises).every((e) => e.rpe_target <= 7)).toBe(true);
  });

  it('nur Medikamente: Über-Kopf erlaubt', () => {
    const p = plan({ healthScreening: { flags: ['medication', 'conservative_plan'] } });
    expect(ids(p)).toContain('schulterdruecken-kurzhantel');
  });

  it('Schwangerschaft: keine Übungen in langer Rückenlage', () => {
    const p = plan({ healthScreening: { flags: ['pregnancy', 'conservative_plan'] } });
    expect(
      ids(p).some((id) => library.exercises.get(id)?.caution_tags.includes('long_supine')),
    ).toBe(false);
  });

  it('kein Check: vorsichtig inkl. Über-Kopf, aber KEINE Gesundheitsdaten im Plan', () => {
    const p = plan({ healthScreening: null, experienceLevel: 'advanced' });
    expect(p.uses_health_data).toBe(false);
    expect(p.medical_notice).toBe(false);
    expect(p.safety_rules.noHealthCheck).toBe(true);
    expect(ids(p).some((id) => library.exercises.get(id)?.caution_tags.includes('overhead'))).toBe(
      false,
    );
    expect(JSON.stringify({ notes: p.notes, inputs: p.inputs })).not.toMatch(
      /flag|conservative|pregnan/,
    );
  });

  it.each([
    ['16 Jahre', '2010-10-01', 8],
    ['17 Jahre', '2009-06-01', 8],
    ['64 Jahre', '1962-01-01', 9],
    ['65 Jahre', '1961-10-05', 7],
    ['95 Jahre', '1931-01-01', 7],
  ] as const)('%s (Fortgeschritten): RPE ≤ %i', (_l, birthDate, max) => {
    const p = plan({ birthDate, experienceLevel: 'advanced' });
    expect(
      Math.max(...p.sessions.flatMap((s) => s.exercises.map((e) => e.rpe_target))),
    ).toBeLessThanOrEqual(max);
    if (max <= 8) {
      expect(
        ids(p).some((id) => library.exercises.get(id)?.caution_tags.includes('high_skill')),
      ).toBe(false);
    }
  });

  it('Leistungssport → Fortgeschrittenen-Vorlage', () => {
    expect(plan({ experienceLevel: 'competitive' }).template_id).toBe(
      'muskelaufbau-fortgeschritten-3t-studio',
    );
  });
});

describe('Zeit und Startwoche', () => {
  it.each([10, 20, 30, 45, 60, 90, 240])('%i Minuten', (minutes) => {
    const p = plan({ minutesPerSession: minutes });
    expect(isPlanWithinLimits(p)).toBe(true);
    if (minutes < 45) expect(p.notes).toContain('minutes_shortened');
    if (minutes >= 60) expect(p.notes).not.toContain('minutes_shortened');
    if (minutes === 10) expect(p.notes).toContain('minutes_below_minimum');
  });

  it('Freitag erzeugt bei Mo/Mi/Fr → Woche 0, Block ab Montag, max. Woche 5 + 1', () => {
    const p = plan({}, '2026-10-09');
    expect(p.sessions[0]).toMatchObject({
      week_no: 0,
      is_intro_week: true,
      scheduled_on: '2026-10-09',
    });
    expect(p.sessions.filter((s) => s.week_no === 1).every((s) => !s.is_intro_week)).toBe(true);
    expect(Math.max(...p.sessions.map((s) => s.week_no))).toBe(6);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'Start an Wochentag +%i: nie vor heute, Wochentage passen',
    (offset) => {
      const today = addDays(MONDAY, offset);
      const p = plan({}, today);
      expect(p.sessions.every((s) => s.scheduled_on >= today)).toBe(true);
      expect(
        p.sessions.every((s) =>
          p.training_week.map((d) => d.weekday).includes(isoWeekday(s.scheduled_on)),
        ),
      ).toBe(true);
    },
  );
});

/**
 * Erwartete Grenzen UNABHÄNGIG von der Engine aus den Eingaben hergeleitet (feste Tabelle aus
 * docs/PLAN-PHASE-3.md Abschnitt 5.4) – der Test prüft also nicht gegen engine-eigene safety_rules.
 */
type Flag = (typeof HEALTH_FLAGS)[number];
function expectedLimits(
  input: { experienceLevel: string; birthDate: string; healthScreening: { flags: Flag[] } | null },
  today: string,
) {
  const [by, bm, bd] = input.birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  let rpeMax = input.experienceLevel === 'beginner' ? 8 : 9;
  const excluded = new Set<string>();
  const flags = input.healthScreening?.flags ?? [];
  if (input.healthScreening === null) {
    rpeMax = Math.min(rpeMax, 7);
    ['high_impact', 'spinal_loading', 'high_skill', 'overhead'].forEach((t) => excluded.add(t));
  }
  if (flags.length > 0) {
    rpeMax = Math.min(rpeMax, 7);
    ['high_impact', 'spinal_loading', 'high_skill'].forEach((t) => excluded.add(t));
  }
  if (flags.includes('injury') || flags.includes('medical_clearance_recommended'))
    excluded.add('overhead');
  if (flags.includes('pregnancy')) excluded.add('long_supine');
  if (age < 18) {
    rpeMax = Math.min(rpeMax, 8);
    excluded.add('high_skill');
  }
  if (age >= 65) {
    rpeMax = Math.min(rpeMax, 7);
    excluded.add('high_impact');
    excluded.add('high_skill');
  }
  const cautious = input.healthScreening === null || flags.length > 0;
  return {
    rpeMax,
    excluded,
    cautious,
    medicalNotice: flags.length > 0,
    usesHealthData: input.healthScreening !== null,
  };
}

describe('Eigenschaften über viele Personen (unabhängige Erwartung)', () => {
  it('Datenbank-Grenzen, RPE-Deckel, Ausschlüsse, Einsteiger-Vorlagen, keine Ausdauer-Übungen', () => {
    const BIRTH_DATES = [
      '2010-06-01',
      '2009-06-01',
      '2008-06-01',
      '1962-06-01',
      '1961-06-01',
      '1931-06-01',
    ];
    const DAYS: [number, number[]][] = [
      [1, [1]],
      [2, [6, 7]],
      [3, []],
      [4, []],
      [5, []],
      [7, [1, 2, 3, 4, 5, 6, 7]],
    ];
    const PLACES = [
      { trainingLocation: 'gym' as const, homeEquipment: [] },
      { trainingLocation: 'both' as const, homeEquipment: [] },
      { trainingLocation: 'home' as const, homeEquipment: [] },
      { trainingLocation: 'home' as const, homeEquipment: [...FULL_HOME] },
    ];
    const SCREENINGS: ({ flags: Flag[] } | null)[] = [
      { flags: [] },
      null,
      { flags: ['injury', 'conservative_plan'] },
      { flags: ['pregnancy', 'conservative_plan'] },
      { flags: ['medical_clearance_recommended', 'conservative_plan'] },
    ];
    let count = 0;
    const violations: string[] = [];
    for (const goalType of [
      'muscle_gain',
      'fat_loss',
      'general_fitness',
      'definition',
      'endurance',
    ] as const) {
      for (const experienceLevel of ['beginner', 'advanced', 'competitive'] as const) {
        for (const [sessionsPerWeek, preferredDays] of DAYS) {
          for (const place of PLACES) {
            for (const healthScreening of SCREENINGS) {
              for (const birthDate of BIRTH_DATES) {
                const today = addDays(MONDAY, (count * 3) % 7);
                const input = {
                  goalType,
                  discipline: goalType === 'endurance' ? ('10k' as const) : null,
                  experienceLevel,
                  sessionsPerWeek,
                  preferredDays,
                  ...place,
                  healthScreening,
                  birthDate,
                  minutesPerSession: 20 + (count % 4) * 20,
                };
                const result = generateTrainingPlan(person(input), library, today);
                count += 1;
                const label = `${goalType}/${experienceLevel}/${sessionsPerWeek}/${place.trainingLocation}/${JSON.stringify(healthScreening)}/${birthDate}`;
                if (!result.ok) {
                  violations.push(`${label}: ${result.error}`);
                  continue;
                }
                const p = result.plan;
                const expected = expectedLimits(input, today);
                if (!generatedPlanSchema.safeParse(p).success) violations.push(`${label}: Grenzen`);
                if (p.uses_health_data !== expected.usesHealthData)
                  violations.push(`${label}: uses_health_data`);
                if (p.medical_notice !== expected.medicalNotice)
                  violations.push(`${label}: medical_notice`);
                if (
                  (experienceLevel === 'beginner' || expected.cautious) &&
                  !(p.template_id ?? '').includes('einsteiger')
                ) {
                  violations.push(`${label}: Vorlage ${p.template_id}`);
                }
                for (const session of p.sessions) {
                  if (session.scheduled_on < today) violations.push(`${label}: vor heute`);
                  for (const e of session.exercises) {
                    if (e.rpe_target > expected.rpeMax)
                      violations.push(`${label}: RPE ${e.rpe_target}`);
                    const exercise = library.exercises.get(e.exercise_id);
                    if (exercise?.caution_tags.some((t) => expected.excluded.has(t))) {
                      violations.push(`${label}: ${e.exercise_id}`);
                    }
                    // Erinnerung: Ausdauer-Übungen bräuchten capWeeklyIncrease im Block-Bau (Phase 10).
                    if (exercise?.movement_pattern === 'conditioning')
                      violations.push(`${label}: conditioning`);
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 10)).toEqual([]);
    expect(count).toBe(5 * 3 * 6 * 4 * 5 * 6);
  }, 120_000);
});

describe('generateTrainingPlan mit kleinen festen Testdaten', () => {
  it('freigegebene Fixture-Bibliothek: Vorlage, Tage, Rotation und Sicherheitsregeln', () => {
    const published = { ...META, reviewed_by: 'kt', reviewed_at: '2026-10-04' };
    const tags: Record<string, ('spinal_loading' | 'overhead')[]> = {
      kreuzheben: ['spinal_loading'],
      schulterdruecken: ['overhead'],
    };
    const exercises = LIBRARY.map((e) => ({
      ...e,
      caution_tags: tags[e.id] ?? [],
      status: 'published' as const,
      meta: published,
    }));
    const fixtureLibrary = planLibraryFromContent(exercises, [
      makeTemplate({ status: 'published', meta: published }),
    ]);
    const result = generateTrainingPlan(
      person({
        goalType: 'general_fitness',
        sessionsPerWeek: 2,
        preferredDays: [],
        minutesPerSession: 45,
        healthScreening: { flags: ['injury', 'conservative_plan'] },
      }),
      fixtureLibrary,
      MONDAY,
    );
    if (!result.ok) throw new Error(result.error);
    const p = result.plan;
    expect(p.template_id).toBe('fitness-einsteiger-3t-test');
    expect(p.training_week.map((d) => d.weekday)).toEqual([1, 4]);
    expect(p.sessions.slice(0, 6).map((s) => s.template_day_index)).toEqual([1, 2, 3, 1, 2, 3]);
    const all = p.sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id));
    expect(all).not.toContain('kreuzheben');
    expect(all).not.toContain('schulterdruecken');
    expect(p.sessions.flatMap((s) => s.exercises).every((e) => e.rpe_target <= 7)).toBe(true);
    expect(p.notes).toContain('days_rotated');
    expect(p.uses_draft_content).toBe(false);
  });
});
