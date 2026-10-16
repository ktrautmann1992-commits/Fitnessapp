/**
 * Strengeres wirkt sofort – auch auf Einheiten des Wettkampfplans (docs/PLAN-PHASE-10.md 6, Etappe WP2): harte Arten
 * werden bei vorsichtigen Gruppen locker, unter 18 höchstens Anstrengung 7. Einheiten ohne Art: unverändert.
 */
import { describe, expect, it } from 'vitest';

import { applyCompetitionWeekLimits, applyCurrentEnduranceRules } from './apply-safety';
import { structuredWorkout } from './endurance-workouts';
import { planSafetyRules } from './safety';

const rulesFor = (flags: ('injury' | 'pregnancy')[] | null, birthDate = '1990-01-01') =>
  planSafetyRules(
    {
      experienceLevel: 'advanced',
      birthDate,
      healthScreening: flags === null ? null : { flags },
    },
    '2026-10-16',
  );

const intervals = structuredWorkout('intervals', 60, {
  easyEffort: 4,
  limits: { allowed: true, effortCap: 8, perWeek: 2, countWorkOnly: false },
  level: 'advanced',
  discipline: '10k',
  hardBudgetS: 99_999,
});
if (!intervals) throw new Error('Testdaten');
const session = {
  kind: 'endurance' as const,
  name_de: intervals.name_de,
  endurance_modality: 'run' as const,
  effort_target: intervals.effort_target,
  estimated_minutes: 60,
  warmup_de: intervals.warmup_de,
  cooldown_de: intervals.cooldown_de,
  workout_type: intervals.type,
  workout_steps: intervals.steps,
};
const total = (steps: readonly { seconds: number }[] | null | undefined) =>
  (steps ?? []).reduce((s, st) => s + st.seconds, 0);

describe('applyCurrentEnduranceRules – Wettkampfplan', () => {
  it('ohne Flag: Intervalle bleiben (Anstrengung 8), Schritte unverändert', () => {
    const out = applyCurrentEnduranceRules(session, rulesFor([]), {
      previousStartGroup: 'advanced',
    });
    expect(out).toMatchObject({
      workout_type: 'intervals',
      effort_target: 8,
      name_de: 'Intervalle',
    });
    expect(out.workout_steps).toEqual(session.workout_steps);
  });

  it('neues Gesundheits-Flag, Schwangerschaft, ohne Check: sofort locker (Art, Name, Schritte, Anstrengung)', () => {
    for (const flags of [['injury'], ['pregnancy'], null] as const) {
      const out = applyCurrentEnduranceRules(session, rulesFor(flags ? [...flags] : null), {
        previousStartGroup: 'advanced',
      });
      expect(out.workout_type).toBe('easy');
      expect(out.effort_target).toBeLessThanOrEqual(4);
      expect(out.workout_steps?.every((st) => st.effort <= 4)).toBe(true);
      expect(total(out.workout_steps)).toBe(out.estimated_minutes * 60);
    }
  });

  it('ab 65 (nur Gehen): locker und zügiges Gehen; strengere Gruppe kürzt auf den Start-Deckel (Schritte passen)', () => {
    const out = applyCurrentEnduranceRules(session, rulesFor([], '1950-01-01'), {
      previousStartGroup: 'advanced',
    });
    expect(out).toMatchObject({
      workout_type: 'easy',
      endurance_modality: 'walk',
      estimated_minutes: 20,
    });
    expect(total(out.workout_steps)).toBe(20 * 60);
  });

  it('unter 18: harte Abschnitte höchstens Anstrengung 7', () => {
    const out = applyCurrentEnduranceRules(session, rulesFor([], '2009-12-01'), {
      previousStartGroup: 'cautious',
    });
    expect(out.workout_type).toBe('intervals');
    expect(out.effort_target).toBe(7);
    expect(Math.max(...(out.workout_steps ?? []).map((st) => st.effort))).toBe(7);
  });

  it('fehlt medicalNotice in den Regeln: vorsichtig keine harten Einheiten', () => {
    const full = rulesFor([]);
    const partial = Object.fromEntries(
      Object.entries(full).filter(([key]) => key !== 'medicalNotice'),
    ) as Omit<typeof full, 'medicalNotice'>;
    const out = applyCurrentEnduranceRules(session, partial, { previousStartGroup: 'advanced' });
    expect(out.workout_type).toBe('easy');
  });
});

describe('applyCompetitionWeekLimits – Zahl harter Einheiten je Woche (Wächter N3)', () => {
  const at = (date: string, type: 'intervals' | 'tempo' | 'easy') => ({
    ...session,
    scheduled_on: date,
    workout_type: type,
    workout_steps: type === 'easy' ? null : session.workout_steps,
  });
  const week = [
    at('2026-10-06', 'tempo'),
    at('2026-10-08', 'intervals'),
    at('2026-10-11', 'easy'),
    at('2026-10-13', 'intervals'),
  ];
  it('Fortgeschritten → Einsteiger: je Woche nur noch die früheste harte Einheit, überzählige locker', () => {
    const out = applyCompetitionWeekLimits(week, rulesFor([]), 'beginner');
    expect(out.map((s) => s.workout_type)).toEqual(['tempo', 'easy', 'easy', 'intervals']);
    const downgraded = out[1];
    expect(downgraded?.effort_target).toBeLessThanOrEqual(4);
    expect(total(downgraded?.workout_steps)).toBe(60 * 60);
    expect(downgraded?.name_de).toBe('Lockerer Dauerlauf');
  });
  it('Fortgeschritten bleibt bei 2; Flag → 0 harte Einheiten', () => {
    expect(applyCompetitionWeekLimits(week, rulesFor([]), 'advanced')).toEqual(week);
    expect(
      applyCompetitionWeekLimits(week, rulesFor(['injury']), 'advanced').some(
        (s) => s.workout_type === 'tempo' || s.workout_type === 'intervals',
      ),
    ).toBe(false);
  });
});
