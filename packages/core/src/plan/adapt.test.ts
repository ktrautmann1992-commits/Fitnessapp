import { describe, expect, it } from 'vitest';

import { REST_RANGES_S } from '../constants';
import { estimateSessionMinutes } from '../content/analysis';
import { libraryMap, makeExercise, makeTemplate } from '../content/test-fixtures';
import { adaptTemplate, clampRpe, fitSessionToMinutes, type PlannedExerciseDraft } from './adapt';
import { equipmentProfile } from './equipment-profile';
import { planSafetyRules } from './safety';
import { MONDAY, repoLibrary } from './test-library';

const lib = repoLibrary();
const template = (id: string) => {
  const t = lib.templates.find((x) => x.id === id);
  if (!t) throw new Error(id);
  return t;
};
const rulesFor = (flags: Parameters<typeof planSafetyRules>[0]['healthScreening']) =>
  planSafetyRules(
    { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: flags },
    MONDAY,
  );
const healthy = rulesFor({ flags: [] });

describe('clampRpe', () => {
  it('Deckel und Untergrenze 5', () => {
    expect(clampRpe(8.5, 7)).toBe(7);
    expect(clampRpe(4, 9)).toBe(5);
    expect(clampRpe(6.5, 9)).toBe(6.5);
  });
});

describe('adaptTemplate', () => {
  it('Studio, gesund: unverändert, keine Hinweise', () => {
    const result = adaptTemplate(template('muskelaufbau-einsteiger-3t-studio'), {
      library: lib.exercises,
      profile: equipmentProfile('gym', []),
      rules: healthy,
      minutesPerSession: 60,
    });
    expect(result.unchanged).toBe(true);
    expect([...result.notes]).toEqual([]);
    expect(result.sessions).toHaveLength(3);
  });

  it('vorsichtig: RPE ≤ 7, keine ausgeschlossenen Merkmale, KEIN gespeicherter Tausch-Code', () => {
    const rules = rulesFor({ flags: ['injury', 'conservative_plan'] });
    const result = adaptTemplate(template('muskelaufbau-fortgeschritten-4t-studio'), {
      library: lib.exercises,
      profile: equipmentProfile('gym', []),
      rules,
      minutesPerSession: 60,
    });
    const items = result.sessions.flatMap((s) => s.exercises);
    expect(items.every((e) => e.rpe_target <= 7)).toBe(true);
    for (const e of items) {
      const tags = lib.exercises.get(e.exercise_id)?.caution_tags ?? [];
      // Erwartung UNABHÄNGIG von der Engine: injury → ohne Sprünge, Wirbelsäulenlast, Technik, Über-Kopf.
      const forbidden = ['high_impact', 'spinal_loading', 'high_skill', 'overhead'];
      expect(tags.some((t) => forbidden.includes(t))).toBe(false);
    }
    expect(
      items.some(
        (e) =>
          e.source_exercise_id === 'kniebeuge-langhantel' && e.exercise_id === 'goblet-kniebeuge',
      ),
    ).toBe(true);
    expect(items.some((e) => e.exercise_id === 'schulterdruecken-kurzhantel')).toBe(false);
    expect(result.notes.has('exercises_substituted')).toBe(false);
    expect(result.notes.has('exercises_removed')).toBe(false);
    expect(result.unchanged).toBe(false);
  });

  it('Zuhause ohne Geräte: Tausch und Entfernen aus Gerätegründen, keine Zug-Übung', () => {
    const result = adaptTemplate(template('muskelaufbau-einsteiger-3t-zuhause'), {
      library: lib.exercises,
      profile: equipmentProfile('home', []),
      rules: healthy,
      minutesPerSession: 60,
    });
    expect(result.notes.has('exercises_substituted')).toBe(true);
    expect(result.notes.has('exercises_removed')).toBe(true);
    expect(result.notes.has('no_pull_exercise')).toBe(true);
    expect(
      result.sessions
        .flatMap((s) => s.exercises)
        .every((e) => lib.exercises.get(e.exercise_id)?.equipment_ids.length === 0),
    ).toBe(true);
  });

  it('nur ein Band: Zug-Übungen bleiben möglich', () => {
    const result = adaptTemplate(template('muskelaufbau-einsteiger-3t-zuhause'), {
      library: lib.exercises,
      profile: equipmentProfile('home', [{ equipmentId: 'resistance_bands', weightsKg: [] }]),
      rules: healthy,
      minutesPerSession: 60,
    });
    expect(result.notes.has('no_pull_exercise')).toBe(false);
  });

  it('Musterwechsel Grund- → Isolationsübung: Pause im Bereich der neuen Übung', () => {
    const compound = makeExercise({
      id: 'grund',
      equipment_ids: ['barbell'],
      difficulty: 2,
      mechanics: 'compound',
      primary_muscles: ['glutes'],
    });
    const iso = makeExercise({
      id: 'iso',
      equipment_ids: [],
      difficulty: 1,
      mechanics: 'isolation',
      movement_pattern: 'hip_extension',
      primary_muscles: ['glutes'],
    });
    const t = makeTemplate({
      sessions: [
        {
          day_index: 1,
          name_de: 'Test',
          focus: 'full_body',
          warmup_de: 'Locker aufwärmen.',
          cooldown_de: 'Locker ausklingen.',
          exercises: [
            {
              order_no: 1,
              exercise_id: 'grund',
              sets: 3,
              reps_min: 8,
              reps_max: 10,
              duration_s: null,
              rest_s: 200,
              rpe_target: 7,
              superset_group: null,
              notes_de: null,
            },
          ],
        },
      ],
      sessions_per_week: 1,
    });
    const result = adaptTemplate(t, {
      library: libraryMap([compound, iso]),
      profile: equipmentProfile('home', []),
      rules: healthy,
      minutesPerSession: 60,
    });
    const e = result.sessions[0]?.exercises[0];
    expect(e?.exercise_id).toBe('iso');
    expect(e?.rest_s).toBe(REST_RANGES_S.isolation.max);
  });
});

describe('fitSessionToMinutes', () => {
  const base = template('muskelaufbau-fortgeschritten-3t-studio').sessions[0];
  if (!base) throw new Error('Einheit fehlt');
  const drafts: PlannedExerciseDraft[] = base.exercises.map((e) => ({
    ...e,
    source_exercise_id: e.exercise_id,
    exercise_name_de: 'x',
    target_weight_kg: null,
  }));
  const full = estimateSessionMinutes({ exercises: drafts });

  it.each([10, 20, 30, 45, 60, 90, 240])(
    '%i Minuten: passt oder Hinweis, nie unter 3 Übungen',
    (minutes) => {
      const result = fitSessionToMinutes(drafts, minutes, lib.exercises);
      const estimate = estimateSessionMinutes({ exercises: [...result.exercises] });
      if (minutes >= full) {
        expect(result.shortened).toBe(false);
        expect(result.exercises).toHaveLength(drafts.length);
      } else {
        expect(result.shortened).toBe(true);
        expect(estimate <= minutes || result.belowMinimum).toBe(true);
        expect(result.exercises.length).toBeGreaterThanOrEqual(3);
      }
      result.exercises.forEach((e, i) => expect(e.order_no).toBe(i + 1));
      for (const e of result.exercises) {
        const minSets = lib.exercises.get(e.exercise_id)?.mechanics === 'isolation' ? 1 : 2;
        expect(e.sets).toBeGreaterThanOrEqual(
          Math.min(minSets, drafts.find((d) => d.exercise_id === e.exercise_id)?.sets ?? 1),
        );
      }
    },
  );

  it('10 Minuten sind nicht erreichbar → Hinweis minutes_below_minimum', () => {
    expect(fitSessionToMinutes(drafts, 10, lib.exercises).belowMinimum).toBe(true);
  });
});

describe('adaptTemplate mit kleinen festen Testdaten', () => {
  it('ausgeschlossene Übung ohne erlaubten Ersatz entfällt; Übrige bleiben, RPE gedeckelt', () => {
    const overhead = makeExercise({
      id: 'ueberkopf',
      movement_pattern: 'vertical_push',
      primary_muscles: ['front_delts'],
      equipment_ids: [],
      difficulty: 1,
      caution_tags: ['overhead'],
    });
    const squat = makeExercise({ id: 'hocke', equipment_ids: [], difficulty: 1 });
    const t = makeTemplate({
      sessions_per_week: 1,
      sessions: [
        {
          day_index: 1,
          name_de: 'Test',
          focus: 'full_body',
          warmup_de: 'Locker aufwärmen.',
          cooldown_de: 'Locker ausklingen.',
          exercises: [
            {
              order_no: 1,
              exercise_id: 'hocke',
              sets: 3,
              reps_min: 8,
              reps_max: 10,
              duration_s: null,
              rest_s: 120,
              rpe_target: 8.5,
              superset_group: null,
              notes_de: null,
            },
            {
              order_no: 2,
              exercise_id: 'ueberkopf',
              sets: 3,
              reps_min: 8,
              reps_max: 10,
              duration_s: null,
              rest_s: 120,
              rpe_target: 8,
              superset_group: null,
              notes_de: null,
            },
          ],
        },
      ],
    });
    const result = adaptTemplate(t, {
      library: libraryMap([overhead, squat]),
      profile: equipmentProfile('gym', []),
      rules: { rpeMax: 7, excludedCautionTags: ['overhead'], cautious: true },
      minutesPerSession: 60,
    });
    expect(
      result.sessions[0]?.exercises.map((e) => [e.exercise_id, e.order_no, e.rpe_target]),
    ).toEqual([['hocke', 1, 7]]);
    expect([...result.notes]).toEqual([]);
  });
});
