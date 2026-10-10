import { describe, expect, it } from 'vitest';

import { generateTrainingPlan } from './generate';
import { toSavePlanPayload } from './payload';
import { isExerciseAllowed, isStricterGroup, planSafetyRules } from './safety';
import {
  displaySwapRules,
  planFloorRules,
  planStartGroup,
  type PlanStartGroupSource,
} from './start-group';
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

describe('planFloorRules / displaySwapRules (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 4.5, Wächter B4)', () => {
  const tags = (plan: PlanStartGroupSource, birthDate = '1990-01-01') =>
    planFloorRules(plan, birthDate).excludedCautionTags;
  const current = (flags: ('pregnancy' | 'injury')[] | null, birthDate = '1990-01-01') =>
    planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate,
        healthScreening: flags === null ? null : { flags },
      },
      '2026-10-05',
    );

  it('gesunder Plan (Check ohne Flag, Erwachsener) → keine ausgeschlossenen Merkmale', () => {
    expect(tags(base())).toEqual([]);
    expect(planFloorRules(base(), '1990-01-01').cautious).toBe(false);
    expect(planFloorRules(base(), '1990-01-01').pregnancyNotice).toBe(false);
  });

  it('ohne Check → vorsichtig inklusive overhead; Arzt-Hinweis → zusätzlich long_supine', () => {
    const noCheck = tags(base({ uses_health_data: false }));
    expect(noCheck).toEqual(
      expect.arrayContaining(['high_impact', 'spinal_loading', 'high_skill', 'overhead']),
    );
    expect(noCheck).not.toContain('long_supine');
    const medical = planFloorRules(base({ medical_notice: true }), '1990-01-01');
    expect(medical.excludedCautionTags).toEqual(
      expect.arrayContaining([
        'high_impact',
        'spinal_loading',
        'high_skill',
        'overhead',
        'long_supine',
      ]),
    );
    expect(medical.cautious).toBe(true);
    expect(medical.pregnancyNotice).toBe(false);
    expect(medical.rpeMax).toBeLessThanOrEqual(7);
  });

  it('Alter am Erstellungstag: 16/17 → high_skill, 18 → frei, 64 → frei, 65 → high_impact + high_skill', () => {
    const at = (birthDate: string) => tags(base(), birthDate);
    expect(at('2010-10-05')).toEqual(['high_skill']); // 16
    expect(at('2009-10-06')).toEqual(['high_skill']); // 17, Geburtstag erst morgen
    expect(at('2008-10-05')).toEqual([]); // 18. Geburtstag am Erstellungstag
    expect(at('1962-10-06')).toEqual([]); // 63/64
    expect(at('1961-10-06')).toEqual([]); // 64
    expect(at('1961-10-05')).toEqual(expect.arrayContaining(['high_impact', 'high_skill'])); // 65 am Erstellungstag
  });

  it('unlesbare Angaben bzw. Datum → strengste Regeln (N3), aber nicht alle Merkmale', () => {
    for (const plan of [base({ created_at: 'kaputt' }), base({ created_at: '' })]) {
      const rules = planFloorRules(plan, '1990-01-01');
      expect(rules.excludedCautionTags).toEqual(
        expect.arrayContaining([
          'high_impact',
          'spinal_loading',
          'high_skill',
          'overhead',
          'long_supine',
        ]),
      );
      expect(rules.cautious).toBe(true);
      expect(rules.enduranceStartGroup).toBe('cautious');
    }
    expect(planFloorRules(base(), 'kein-datum').cautious).toBe(true);
    expect(planFloorRules(base(), '2030-01-01').cautious).toBe(true); // Geburt nach Erstellung
    // Unlesbares Level → Einsteiger (strenger), ändert keine Merkmale.
    expect(planFloorRules(base({ inputs: null }), '1990-01-01').beginnerTemplatesOnly).toBe(true);
  });

  it('Lockerung öffnet nichts: Schwangerschafts-Plan, danach Check ohne Flag → long_supine bleibt gesperrt', () => {
    const plan = base({ medical_notice: true });
    const swapRules = displaySwapRules(plan, '1990-01-01', current([]));
    expect(swapRules.excludedCautionTags).toContain('long_supine');
    expect(isExerciseAllowed({ caution_tags: ['long_supine'] }, swapRules)).toBe(false);
    // Nach „Plan neu erstellen“ ohne Flag: Untergrenze weg.
    const fresh = displaySwapRules(base(), '1990-01-01', current([]));
    expect(isExerciseAllowed({ caution_tags: ['long_supine'] }, fresh)).toBe(true);
  });

  it('17-jährig erstellt, 18. Geburtstag → high_skill bleibt gesperrt bis „Plan neu erstellen“', () => {
    const plan = base({ created_at: '2026-10-04T08:00:00.000Z' });
    const now18 = current([], '2008-10-05');
    expect(now18.excludedCautionTags).not.toContain('high_skill');
    expect(displaySwapRules(plan, '2008-10-05', now18).excludedCautionTags).toContain('high_skill');
  });

  it('strengere aktuelle Regel wirkt sofort', () => {
    const swapRules = displaySwapRules(base(), '1990-01-01', current(['pregnancy']));
    expect(swapRules.excludedCautionTags).toContain('long_supine');
  });
});
