import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import { planInputsSchema, planInputsSnapshot } from './inputs';
import { planSafetyRules } from './safety';
import { MONDAY, person, repoLibrary } from './test-library';
import {
  blockWeekFor,
  dropPastSessions,
  exerciseMark,
  followUpBlockState,
  nextPlannedSession,
  planUpdateOffer,
  prepareSessionForDisplay,
  sessionLocation,
  sessionOn,
  type StoredSession,
  weekOverview,
} from './view';
import { PLAN_ENGINE_VERSION } from '../constants';

const library = repoLibrary();

function stored(inputs = person(), today = MONDAY): StoredSession[] {
  const result = generateTrainingPlan(inputs, library, today);
  if (!result.ok) throw new Error(result.error);
  return result.plan.sessions.map((s, i) => ({
    ...s,
    id: `s${i + 1}`,
    status: 'planned' as const,
    original_date: null,
  }));
}

const rules = (flags: string[] | null, birthDate = '1990-01-01', level = 'advanced' as const) =>
  planSafetyRules(
    {
      experienceLevel: level,
      birthDate,
      healthScreening: flags === null ? null : { flags: flags as never[] },
    },
    MONDAY,
  );

describe('prepareSessionForDisplay', () => {
  const sessions = stored(person({ experienceLevel: 'advanced', birthDate: '1990-01-01' }));
  const strength = sessions.find((s) => s.kind === 'strength') as StoredSession;

  it('Kraft: neues Flag senkt RPE und tauscht/blendet ausgeschlossene Übungen aus', () => {
    const before = Math.max(...strength.exercises.map((e) => e.rpe_target));
    expect(before).toBeGreaterThan(7);
    const shown = prepareSessionForDisplay(strength, {
      rules: rules(['injury', 'conservative_plan']),
      previousStartGroup: 'advanced',
      library: library.exercises,
      profile: { available: new Set() },
    });
    expect(Math.max(...shown.session.exercises.map((e) => e.rpe_target))).toBeLessThanOrEqual(7);
    for (const e of shown.session.exercises) {
      const tags = library.exercises.get(e.exercise_id)?.caution_tags ?? [];
      expect(tags).not.toContain('overhead');
      expect(tags).not.toContain('spinal_loading');
    }
    expect(shown.libraryMissing).toBe(false);
  });

  it('Ausdauer: strengere Gruppe → Gehen und Start-Deckel', () => {
    const run = stored(
      person({
        experienceLevel: 'advanced',
        birthDate: '1990-01-01',
        schedule: { mode: 'fixed', slots: [{ weekday: 2, kind: 'endurance', minutes: 60 }] },
      }),
    ).find((s) => s.kind === 'endurance') as StoredSession;
    const shown = prepareSessionForDisplay(run, {
      rules: rules([], '1955-01-01'),
      previousStartGroup: 'advanced',
      library: library.exercises,
    });
    expect(shown.session.endurance_modality).toBe('walk');
    expect(shown.session.estimated_minutes).toBeLessThanOrEqual(20);
    expect(shown.session.effort_target).toBeLessThanOrEqual(3);
  });

  it('Ersatz nur aus der Ersatz-Bibliothek (archivierte Übungen nur zum Nachschlagen)', () => {
    const shownAll = prepareSessionForDisplay(strength, {
      rules: rules(['injury', 'conservative_plan']),
      previousStartGroup: 'advanced',
      library: library.exercises,
      profile: { available: new Set(['dumbbells', 'barbell', 'power_rack', 'cable_station']) },
    });
    const chosen = shownAll.session.exercises
      .map((e) => e.exercise_id)
      .filter((id) => !strength.exercises.some((s) => s.exercise_id === id));
    expect(chosen.length).toBeGreaterThan(0);
    const substituteLibrary = new Map(
      [...library.exercises].filter(([id]) => !chosen.includes(id)),
    );
    const shown = prepareSessionForDisplay(strength, {
      rules: rules(['injury', 'conservative_plan']),
      previousStartGroup: 'advanced',
      library: library.exercises,
      substituteLibrary,
      profile: { available: new Set(['dumbbells', 'barbell', 'power_rack', 'cable_station']) },
    });
    for (const id of chosen) {
      expect(shown.session.exercises.map((e) => e.exercise_id)).not.toContain(id);
    }
  });

  it('ohne Bibliothek: eigener Zustand statt leerer Einheit', () => {
    const shown = prepareSessionForDisplay(strength, {
      rules: rules([]),
      previousStartGroup: 'advanced',
      library: null,
    });
    expect(shown.libraryMissing).toBe(true);
    expect(shown.session.exercises).toEqual([]);
    expect(shown.hidden).toHaveLength(strength.exercises.length);
  });

  it('gleiche Regeln → unverändert (keine Lockerung, kein Tausch)', () => {
    const shown = prepareSessionForDisplay(strength, {
      rules: rules([]),
      previousStartGroup: 'advanced',
      library: library.exercises,
    });
    expect(shown.session.exercises.map((e) => e.exercise_id)).toEqual(
      strength.exercises.map((e) => e.exercise_id),
    );
    expect(shown.hidden).toEqual([]);
  });
});

describe('exerciseMark', () => {
  const item = (id: string, source = id) => ({ exercise_id: id, source_exercise_id: source });
  const stored = {
    exercises: [item('goblet-kniebeuge', 'kniebeuge-langhantel')].map((e) => ({
      ...e,
      order_no: 1,
      exercise_name_de: e.exercise_id,
      sets: 3,
      reps_min: 8,
      reps_max: 12,
      duration_s: null,
      rest_s: 90,
      rpe_target: 7,
      superset_group: null,
      notes_de: null,
      target_weight_kg: null,
    })),
  };
  it('Gerät fehlt vs. anderer Grund vs. beim Anzeigen getauscht', () => {
    const lib = { library: library.exercises };
    expect(
      exerciseMark(item('goblet-kniebeuge', 'kniebeuge-langhantel'), stored, {
        ...lib,
        profile: { available: new Set(['dumbbells']) },
      }),
    ).toBe('equipment_swap');
    // Langhantel wäre da → Tausch hatte einen anderen Grund (z. B. Vorsicht) – ohne Grund zu nennen.
    expect(
      exerciseMark(item('goblet-kniebeuge', 'kniebeuge-langhantel'), stored, {
        ...lib,
        profile: { available: new Set(['barbell', 'power_rack', 'dumbbells']) },
      }),
    ).toBe('adjusted');
    expect(exerciseMark(item('beinpresse'), stored, lib)).toBe('adjusted');
    expect(
      exerciseMark(
        item('goblet-kniebeuge'),
        { exercises: [{ ...stored.exercises[0]!, source_exercise_id: 'goblet-kniebeuge' }] },
        lib,
      ),
    ).toBeNull();
  });
});

describe('sessionLocation', () => {
  const at = (date: string) => ({
    kind: 'strength' as const,
    scheduled_on: date,
    original_date: null,
  });
  it('feste Tage: Art des Wochentags; Tage egal mit einem Ort: dieser Ort; sonst zu Hause', () => {
    const fixed = {
      mode: 'fixed' as const,
      slots: [
        { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
        { weekday: 3, kind: 'strength_home' as const, minutes: 30 },
      ],
    };
    expect(sessionLocation(at('2026-10-05'), fixed)).toBe('gym');
    expect(sessionLocation(at('2026-10-07'), fixed)).toBe('home');
    // verschoben: ursprünglicher Tag zählt
    expect(
      sessionLocation(
        { kind: 'strength', scheduled_on: '2026-10-08', original_date: '2026-10-05' },
        fixed,
      ),
    ).toBe('gym');
    expect(sessionLocation(at('2026-10-08'), fixed)).toBe('home');
    const flexGym = {
      mode: 'flex' as const,
      slots: [{ kind: 'strength_gym' as const, minutes: 45 }],
    };
    expect(sessionLocation(at('2026-10-08'), flexGym)).toBe('gym');
    expect(sessionLocation(at('2026-10-08'), null)).toBe('home');
  });

  it('mehrdeutig (Tage egal mit Studio und Zuhause): Ort aus der Fassung (PDF-Wächter S1)', () => {
    const exercises = library.exercises;
    const homeProfile = equipmentProfile('home', [{ equipmentId: 'dumbbells', weightsKg: [4, 8] }]);
    const flexBoth = {
      mode: 'flex' as const,
      slots: [
        { kind: 'strength_gym' as const, minutes: 60 },
        { kind: 'strength_home' as const, minutes: 45 },
      ],
    };
    const withExercises = (ids: string[]) => ({
      ...at('2026-10-08'),
      exercises: ids.map((id) => ({ exercise_id: id }) as StoredSession['exercises'][number]),
    });
    const gym = withExercises(['kniebeuge-langhantel', 'kniebeuge-koerpergewicht']);
    const home = withExercises(['kniebeuge-koerpergewicht']);
    expect(sessionLocation(gym, flexBoth, { library: exercises, homeProfile })).toBe('gym');
    expect(sessionLocation(home, flexBoth, { library: exercises, homeProfile })).toBe('home');
    // Ohne Kontext wie bisher „zu Hause“; feste Tage bleiben beim Wochentag.
    expect(sessionLocation(gym, flexBoth)).toBe('home');
    expect(sessionLocation(gym, flexBoth, { library: null, homeProfile })).toBe('home');
    const fixedBoth = {
      mode: 'fixed' as const,
      slots: [
        { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
        { weekday: 3, kind: 'strength_home' as const, minutes: 30 },
      ],
    };
    expect(
      sessionLocation({ ...home, scheduled_on: '2026-10-05' }, fixedBoth, {
        library: exercises,
        homeProfile,
      }),
    ).toBe('gym');
    // Verschoben auf einen Tag ohne Eintrag: aus der Fassung.
    expect(sessionLocation(gym, fixedBoth, { library: exercises, homeProfile })).toBe('gym');
  });
});

describe('Heute und Woche', () => {
  const sessions = stored();

  it('heutige Einheit, Ruhetag und nächste Einheit', () => {
    const first = sessions[0] as StoredSession;
    expect(sessionOn(sessions, first.scheduled_on)?.id).toBe(first.id);
    expect(sessionOn(sessions, '2026-10-06')).toBeNull();
    expect(nextPlannedSession(sessions, '2026-10-06')?.scheduled_on).toBe('2026-10-07');
    const skipped = sessions.map((s) =>
      s.scheduled_on === '2026-10-07' ? { ...s, status: 'skipped' as const } : s,
    );
    expect(sessionOn(skipped, '2026-10-07')).toBeNull();
    expect(nextPlannedSession(skipped, '2026-10-06')?.scheduled_on).toBe('2026-10-09');
  });

  it('Wochenübersicht Mo–So mit heute, verschoben und gestrichen', () => {
    const moved = sessions.map((s) =>
      s.scheduled_on === '2026-10-07'
        ? { ...s, scheduled_on: '2026-10-08', original_date: '2026-10-07' }
        : s,
    );
    const week = weekOverview(moved, '2026-10-06');
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(week[1]?.isToday).toBe(true);
    expect(week[0]?.isPast).toBe(true);
    expect(week[2]?.session).toBeNull();
    expect(week[2]?.movedAway).toHaveLength(1);
    expect(week[3]?.session?.original_date).toBe('2026-10-07');
  });

  it('Kopf „Woche x von y“ und Erholungswoche', () => {
    expect(blockWeekFor(sessions, MONDAY)).toEqual({
      blockNo: 1,
      weekNo: 1,
      weeksInBlock: 6,
      isIntroWeek: true,
      isDeload: false,
    });
    const deloadWeek = blockWeekFor(sessions, addDays(MONDAY, 35));
    expect(deloadWeek?.isDeload).toBe(true);
    expect(deloadWeek?.weekNo).toBe(6);
    expect(blockWeekFor(sessions, addDays(MONDAY, 70))).toBeNull();
  });
});

describe('followUpBlockState', () => {
  const sessions = stored();
  it('fällig ab Montag der letzten Woche; abgelaufen nach der ersten Woche des Folgeblocks', () => {
    expect(followUpBlockState([], MONDAY)).toBe('not_due');
    expect(followUpBlockState(sessions, MONDAY)).toBe('not_due');
    expect(followUpBlockState(sessions, addDays(MONDAY, 34))).toBe('not_due');
    expect(followUpBlockState(sessions, addDays(MONDAY, 35))).toBe('due');
    expect(followUpBlockState(sessions, addDays(MONDAY, 48))).toBe('due');
    expect(followUpBlockState(sessions, addDays(MONDAY, 49))).toBe('ended');
  });

  it('dropPastSessions behält nur Einheiten ab heute', () => {
    expect(
      dropPastSessions(sessions, '2026-10-07').every((s) => s.scheduled_on >= '2026-10-07'),
    ).toBe(true);
    expect(dropPastSessions(sessions, '2026-10-07')).toHaveLength(sessions.length - 1);
  });
});

describe('planUpdateOffer', () => {
  const inputs = planInputsSnapshot(
    planInputsSchema.parse(person({ experienceLevel: 'advanced' })),
  );
  const plan = {
    inputs,
    engine_version: PLAN_ENGINE_VERSION,
    template_id: 't',
    template_version: 1,
    created_at: '2026-10-05T08:00:00.000Z',
    created_on: '2026-10-05',
    uses_health_data: true,
    medical_notice: false,
  };
  const current = {
    inputs,
    birthDate: '1961-10-10',
    latestScreeningAt: '2026-10-01T08:00:00.000Z',
    healthConsentValid: true,
  };

  it('nichts geändert → kein Angebot', () => {
    expect(
      planUpdateOffer(
        plan,
        current,
        { enduranceStartGroup: 'advanced', medicalNotice: false },
        '2026-10-06',
      ),
    ).toEqual({ offer: false, reasons: [], stricter: false });
  });

  it('65. Geburtstag → strenger (deutlich anbieten)', () => {
    const offer = planUpdateOffer(
      plan,
      current,
      { enduranceStartGroup: 'cautious', medicalNotice: false },
      '2026-10-10',
    );
    expect(offer.reasons).toEqual(['age_threshold', 'stricter_rules']);
    expect(offer.stricter).toBe(true);
  });

  it('neuer Check mit Flag → strenger; geänderte Angaben → nur Angebot', () => {
    const flagged = planUpdateOffer(
      plan,
      { ...current, birthDate: '1990-01-01', latestScreeningAt: '2026-10-06T08:00:00.000Z' },
      { enduranceStartGroup: 'cautious', medicalNotice: true },
      '2026-10-06',
    );
    expect(flagged.stricter).toBe(true);
    expect(flagged.reasons).toContain('health_check_newer');
    const changed = planUpdateOffer(
      plan,
      { ...current, birthDate: '1990-01-01', inputs: { ...inputs, goalType: 'fat_loss' } },
      { enduranceStartGroup: 'advanced', medicalNotice: false },
      '2026-10-06',
    );
    expect(changed).toEqual({ offer: true, reasons: ['inputs_changed'], stricter: false });
  });

  it('18. Geburtstag ist eine Lockerung: Angebot, aber nicht „strenger“', () => {
    const offer = planUpdateOffer(
      { ...plan, created_at: '2026-10-05T08:00:00.000Z' },
      { ...current, birthDate: '2008-10-08' },
      { enduranceStartGroup: 'advanced', medicalNotice: false },
      '2026-10-08',
    );
    expect(offer.reasons).toEqual(['age_threshold']);
    expect(offer.stricter).toBe(false);
  });
});
