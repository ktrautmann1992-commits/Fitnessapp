import { describe, expect, it } from 'vitest';

import type { PlannedExerciseDraft } from './adapt';
import { applyCurrentSafetyRules } from './apply-safety';
import { planSafetyRules } from './safety';
import { repoLibrary } from './test-library';

const library = repoLibrary().exercises;
const draft = (id: string, order_no: number, rpe = 8): PlannedExerciseDraft => ({
  order_no,
  exercise_id: id,
  source_exercise_id: id,
  exercise_name_de: id,
  sets: 3,
  reps_min: 8,
  reps_max: 12,
  duration_s: null,
  rest_s: 150,
  rpe_target: rpe,
  superset_group: null,
  notes_de: null,
  target_weight_kg: null,
});
const session = {
  exercises: [
    draft('kniebeuge-langhantel', 1),
    draft('schulterdruecken-kurzhantel', 2),
    draft('latziehen', 3),
  ],
};
const flagged = planSafetyRules(
  {
    experienceLevel: 'advanced',
    birthDate: '1990-01-01',
    healthScreening: { flags: ['injury', 'conservative_plan'] },
  },
  '2026-10-05',
);

describe('applyCurrentSafetyRules', () => {
  it('mit Geräte-Profil: ersetzt, blendet nicht Ersetzbares aus, RPE ≤ 7, lückenlose Reihenfolge', () => {
    const result = applyCurrentSafetyRules(session, flagged, {
      library,
      profile: { available: new Set(['dumbbells', 'lat_pulldown']) },
    });
    expect(result.session.exercises.map((e) => e.exercise_id)).toEqual([
      'goblet-kniebeuge',
      'latziehen',
    ]);
    expect(result.replaced).toEqual(['kniebeuge-langhantel']);
    expect(result.hidden).toEqual(['schulterdruecken-kurzhantel']);
    expect(result.session.exercises.every((e) => e.rpe_target <= 7)).toBe(true);
    expect(result.session.exercises.map((e) => e.order_no)).toEqual([1, 2]);
  });

  it('offline ohne Profil: ausgeschlossene Übungen werden ausgeblendet', () => {
    const result = applyCurrentSafetyRules(session, flagged, { library });
    expect(result.session.exercises.map((e) => e.exercise_id)).toEqual(['latziehen']);
    expect(result.hidden).toHaveLength(2);
  });

  it('unbekannte Übung (Bibliothek fehlt) → sicherheitshalber ausgeblendet', () => {
    const result = applyCurrentSafetyRules({ exercises: [draft('gibt-es-nicht', 1)] }, flagged, {
      library,
    });
    expect(result.hidden).toEqual(['gibt-es-nicht']);
  });

  it('gleiche Regeln → nur RPE-Deckel', () => {
    const healthy = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
      '2026-10-05',
    );
    const result = applyCurrentSafetyRules(session, healthy, { library });
    expect(result.session.exercises).toHaveLength(3);
    expect(result.hidden).toEqual([]);
  });
});
