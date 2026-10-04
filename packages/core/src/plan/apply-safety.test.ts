import { describe, expect, it } from 'vitest';

import type { PlannedExerciseDraft } from './adapt';
import { applyCurrentEnduranceRules, applyCurrentSafetyRules } from './apply-safety';
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

describe('applyCurrentEnduranceRules (strengere Regeln auch für Ausdauer)', () => {
  const run = {
    kind: 'endurance' as const,
    name_de: 'Lockerer Dauerlauf',
    endurance_modality: 'run' as const,
    effort_target: 4,
    estimated_minutes: 45,
    warmup_de: '5 Minuten zügig gehen.',
    cooldown_de: '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
  };
  const rules = (flags: string[] | null, birthDate = '1990-01-01') =>
    planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate,
        healthScreening: flags === null ? null : { flags: flags as never },
      },
      '2026-10-05',
    );

  it('unverändert bei gleichen Regeln; Kraft-Einheiten nie geändert', () => {
    expect(applyCurrentEnduranceRules(run, rules([]), { previousStartGroup: 'advanced' })).toEqual(
      run,
    );
    const strength = { ...run, kind: 'strength' as const };
    expect(
      applyCurrentEnduranceRules(strength, rules(['injury']), { previousStartGroup: 'advanced' }),
    ).toBe(strength);
  });

  it('neues Flag: Gehen, Anstrengung ≤ 3, Start-Deckel 20 (Gruppe strenger)', () => {
    const next = applyCurrentEnduranceRules(run, rules(['injury', 'conservative_plan']), {
      previousStartGroup: 'advanced',
    });
    expect(next).toMatchObject({
      name_de: 'Zügiges Gehen',
      endurance_modality: 'walk',
      effort_target: 3,
      estimated_minutes: 20,
      warmup_de: '5 Minuten in normalem Tempo gehen.',
    });
  });

  it('Schwangerschaft: Rad → Ergometer (nie im Freien); ab 65: Gehen', () => {
    const bike = { ...run, name_de: 'Lockere Radeinheit', endurance_modality: 'bike' as const };
    expect(
      applyCurrentEnduranceRules(bike, rules(['pregnancy', 'conservative_plan']), {
        previousStartGroup: 'cautious',
      }),
    ).toMatchObject({
      name_de: 'Ergometer locker',
      endurance_modality: 'bike',
      estimated_minutes: 45,
    });
    expect(
      applyCurrentEnduranceRules(run, rules([], '1960-01-01'), { previousStartGroup: 'advanced' }),
    ).toMatchObject({ endurance_modality: 'walk', effort_target: 3, estimated_minutes: 20 });
  });

  it('ohne Check: Dauerlauf → Geh-Lauf-Wechsel; Schwimmen bleibt Schwimmen', () => {
    expect(
      applyCurrentEnduranceRules(run, rules(null), { previousStartGroup: 'cautious' }),
    ).toMatchObject({ name_de: 'Geh-Lauf-Wechsel', endurance_modality: 'run', effort_target: 3 });
    const swim = { ...run, name_de: 'Lockeres Schwimmen', endurance_modality: 'swim' as const };
    expect(
      applyCurrentEnduranceRules(swim, rules(['pregnancy']), { previousStartGroup: 'cautious' })
        .endurance_modality,
    ).toBe('swim');
  });
});
