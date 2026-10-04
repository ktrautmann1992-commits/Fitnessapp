import { describe, expect, it } from 'vitest';

import { generateTrainingPlan } from './generate';
import { toSavePlanPayload } from './payload';
import { isStricterGroup } from './safety';
import { planStartGroup, type PlanStartGroupSource } from './start-group';
import { MONDAY, person, repoLibrary } from './test-library';

const base = (overrides: Partial<PlanStartGroupSource> = {}): PlanStartGroupSource => ({
  uses_health_data: true,
  medical_notice: false,
  created_at: '2026-10-05T08:00:00.000Z',
  inputs: { experienceLevel: 'advanced' },
  ...overrides,
});

describe('planStartGroup', () => {
  it('ohne Gesundheits-Check (uses_health_data = false) → vorsichtig, auch für Fortgeschrittene', () => {
    expect(planStartGroup(base({ uses_health_data: false }), '1990-01-01')).toBe('cautious');
  });

  it('Gesundheits-Flag (medical_notice) → vorsichtig', () => {
    expect(planStartGroup(base({ medical_notice: true }), '1990-01-01')).toBe('cautious');
  });

  it('Level ohne Flag: Einsteiger, Fortgeschritten, Leistungssport', () => {
    for (const level of ['beginner', 'advanced', 'competitive'] as const) {
      expect(planStartGroup(base({ inputs: { experienceLevel: level } }), '1990-01-01')).toBe(
        level,
      );
    }
  });

  it('17/18 Jahre am Erstellungstag (Europe/Berlin)', () => {
    // 22:30 UTC am 04.10. = 05.10. in Berlin → 18. Geburtstag am Erstellungstag.
    const atBirthday = base({ created_at: '2026-10-04T22:30:00.000Z' });
    expect(planStartGroup(atBirthday, '2008-10-05')).toBe('advanced');
    // 21:30 UTC am 04.10. = 23:30 in Berlin, noch 17.
    const dayBefore = base({ created_at: '2026-10-04T21:30:00.000Z' });
    expect(planStartGroup(dayBefore, '2008-10-05')).toBe('cautious');
  });

  it('64/65 Jahre am Erstellungstag (Europe/Berlin)', () => {
    expect(planStartGroup(base({ created_at: '2026-10-04T21:30:00.000Z' }), '1961-10-05')).toBe(
      'advanced',
    );
    expect(planStartGroup(base({ created_at: '2026-10-04T22:30:00.000Z' }), '1961-10-05')).toBe(
      'cautious',
    );
  });

  it('unlesbare Angaben oder Zeitstempel → lockerster Wert, damit eine strengere Gruppe zurücksetzt', () => {
    expect(planStartGroup(base({ inputs: null }), '1990-01-01')).toBe('competitive');
    expect(planStartGroup(base({ inputs: { experienceLevel: 'pro' } }), '1990-01-01')).toBe(
      'competitive',
    );
    expect(planStartGroup(base({ created_at: 'gestern' }), '1990-01-01')).toBe('competitive');
    // ohne Check bzw. mit Flag bleibt es vorsichtig, auch bei unlesbaren Angaben.
    expect(planStartGroup(base({ inputs: null, uses_health_data: false }), '1990-01-01')).toBe(
      'cautious',
    );
    expect(planStartGroup(base({ inputs: null, medical_notice: true }), '1990-01-01')).toBe(
      'cautious',
    );
    expect(isStricterGroup('advanced', planStartGroup(base({ inputs: null }), '1990-01-01'))).toBe(
      true,
    );
  });

  it('entspricht der Startgruppe beim Erzeugen (gespeicherte Spalten, ohne safety_rules)', () => {
    const library = repoLibrary();
    const cases = [
      person({ experienceLevel: 'beginner' }),
      person({ experienceLevel: 'advanced' }),
      person({ experienceLevel: 'competitive', goalType: 'general_fitness' }),
      person({ experienceLevel: 'advanced', healthScreening: null }),
      person({ experienceLevel: 'advanced', healthScreening: { flags: ['medication'] } }),
      // Schwangerschaft: Flag → Arzt-Hinweis → vorsichtig.
      person({
        experienceLevel: 'advanced',
        healthScreening: { flags: ['pregnancy', 'conservative_plan'] },
      }),
      person({ experienceLevel: 'advanced', birthDate: '2009-01-01' }),
      person({ experienceLevel: 'advanced', birthDate: '1960-01-01' }),
    ];
    for (const inputs of cases) {
      const result = generateTrainingPlan(inputs, library, MONDAY);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const saved = toSavePlanPayload(result.plan);
      const group = planStartGroup(
        {
          uses_health_data: saved.uses_health_data,
          medical_notice: saved.medical_notice,
          created_at: `${MONDAY}T09:00:00.000Z`,
          inputs: saved.inputs,
        },
        inputs.birthDate,
      );
      expect(group).toBe(result.plan.safety_rules.enduranceStartGroup);
    }
  });
});
