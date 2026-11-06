import { describe, expect, it } from 'vitest';

import { SUPPLEMENT_RULES } from '../constants';
import type { RatedSupplementId } from '../supplement-ids';
import { formatSupplementDose, supplementDose } from './dosage';
import {
  recommendSupplements,
  SUPPLEMENT_EVIDENCE,
  supplementResult,
  type SupplementRecommendations,
} from './eligibility';
import type { SupplementInputs } from './inputs';
import { renderSupplementNotice, supplementLimitText } from './notices';
import { supplementTiming } from './schedule';
import { checkSupplementText } from './text-rules';
import { supplementTestInputs as base, withoutConsent } from './test-helpers';

/**
 * Fünf weitere Einträge (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md): Beta-Alanin, EAA,
 * Elektrolyte, Zink, Magnesium – alle Stufe B, „passt“ nur unter Bedingung bzw. nie (Zink, Magnesium).
 */

const NEW_IDS = ['beta_alanine', 'eaa', 'electrolytes', 'zinc', 'magnesium'] as const;
const rec = (overrides: Partial<SupplementInputs> = {}) => recommendSupplements(base(overrides));
const status = (result: SupplementRecommendations, id: RatedSupplementId) =>
  supplementResult(result, id).status;

describe('Stufen und Grund-Person', () => {
  it('alle Stufe B', () => {
    for (const id of NEW_IDS) expect(SUPPLEMENT_EVIDENCE[id], id).toBe('b');
  });

  it('Grund-Person (Kraft, Mischkost, keine Intervalle, keine langen Einheiten): alles nur Info', () => {
    const result = rec();
    for (const id of NEW_IDS) expect(status(result, id), id).toBe('info_only');
    expect(supplementResult(result, 'beta_alanine').reasons).toEqual(['no_interval_sessions']);
    expect(supplementResult(result, 'electrolytes').reasons).toEqual(['no_long_sessions']);
    expect(supplementResult(result, 'zinc').reasons).toEqual(['info_by_rule']);
    expect(supplementResult(result, 'eaa').reasons).toEqual(['no_protein_data']);
  });

  it('ohne Einwilligung: alles nur Info, keine Menge', () => {
    const result = recommendSupplements(
      withoutConsent({ hasIntervalSessions: true, hasLongSessions: true }),
    );
    for (const id of NEW_IDS) {
      const item = supplementResult(result, id);
      expect(item.status, id).toBe('info_only');
      expect(supplementDose(item), id).toBeNull();
    }
  });
});

describe('Bedingungen für „passt zu dir“', () => {
  it('Beta-Alanin nur mit Intervall-/Sprint-Einheiten; unter 18 „ab 18“', () => {
    expect(status(rec({ hasIntervalSessions: true }), 'beta_alanine')).toBe('recommended');
    expect(
      status(rec({ hasIntervalSessions: true, birthDate: '2009-10-20' }), 'beta_alanine'),
    ).toBe('adult_only');
  });

  it('EAA nur bei Eiweiß-Lücke UND veganer Ernährung', () => {
    expect(status(rec({ proteinGap: true, dietType: 'vegan' }), 'eaa')).toBe('recommended');
    expect(status(rec({ proteinGap: true, dietType: 'vegetarian' }), 'eaa')).toBe('info_only');
    expect(status(rec({ proteinGap: false, dietType: 'vegan' }), 'eaa')).toBe('info_only');
    expect(
      status(rec({ proteinGap: true, dietType: 'vegan', hasNutritionTargets: false }), 'eaa'),
    ).toBe('info_only');
  });

  it('Elektrolyte nur mit Einheiten ab 90 Minuten (fehlt = nein)', () => {
    expect(status(rec({ hasLongSessions: true }), 'electrolytes')).toBe('recommended');
    expect(status(rec({ hasLongSessions: false }), 'electrolytes')).toBe('info_only');
    expect(status(rec(), 'electrolytes')).toBe('info_only');
  });

  it('Zink und Magnesium nie „passt“ – auch vegan, mit Intervallen und langen Einheiten', () => {
    const result = rec({
      dietType: 'vegan',
      proteinGap: true,
      hasIntervalSessions: true,
      hasLongSessions: true,
    });
    expect(status(result, 'zinc')).toBe('info_only');
    expect(status(result, 'magnesium')).toBe('info_only');
  });
});

describe('Sperren (strengste Regel gewinnt)', () => {
  const all = {
    hasIntervalSessions: true,
    hasLongSessions: true,
    proteinGap: true,
    dietType: 'vegan' as const,
  };

  it('Schwangerschaft → alle fünf „Nicht für dich“', () => {
    const result = rec({ ...all, healthFlags: ['pregnancy'] });
    for (const id of NEW_IDS) expect(status(result, id), id).toBe('excluded');
  });

  it('Niere → alle fünf „Nicht für dich“', () => {
    const result = rec({ ...all, supplementFlags: ['kidney'] });
    for (const id of NEW_IDS) expect(status(result, id), id).toBe('excluded');
  });

  it('Medikamente → Beta-Alanin, Elektrolyte, Zink, Magnesium aus; EAA erlaubt', () => {
    const result = rec({ ...all, healthFlags: ['medication'] });
    expect(status(result, 'beta_alanine')).toBe('excluded');
    expect(status(result, 'electrolytes')).toBe('excluded');
    expect(status(result, 'zinc')).toBe('excluded');
    expect(status(result, 'magnesium')).toBe('excluded');
    expect(status(result, 'eaa')).toBe('recommended');
  });

  it('Herzrhythmus → Elektrolyte und Magnesium aus, Beta-Alanin erlaubt', () => {
    const result = rec({ ...all, supplementFlags: ['heart_rhythm'] });
    expect(status(result, 'electrolytes')).toBe('excluded');
    expect(status(result, 'magnesium')).toBe('excluded');
    expect(status(result, 'beta_alanine')).toBe('recommended');
  });

  it('Arzt-Flag → Elektrolyte und Beta-Alanin aus', () => {
    const result = rec({ ...all, healthFlags: ['medical_clearance_recommended'] });
    expect(status(result, 'electrolytes')).toBe('excluded');
    expect(status(result, 'beta_alanine')).toBe('excluded');
  });
});

describe('Hinweise, Mengen, Zeitpunkte', () => {
  it('Beta-Alanin: Teildosen und Kribbeln; Menge 3,2–6,4 g am Tag; über den Tag zu Mahlzeiten', () => {
    const item = supplementResult(rec({ hasIntervalSessions: true }), 'beta_alanine');
    expect(item.notices).toEqual(['beta_alanine_split', 'beta_alanine_tingling']);
    expect(item.claimIds).toEqual([]);
    expect(formatSupplementDose(supplementDose(item)!)).toBe('3,2–6,4 g');
    expect(renderSupplementNotice('beta_alanine_split')).toContain('höchstens 1,6 g auf einmal');
    expect(supplementTiming('beta_alanine')).toBe('spread_with_meals');
  });

  it('EAA: Essen zuerst; 10–15 g je Portion; rund ums Training', () => {
    const item = supplementResult(rec({ proteinGap: true, dietType: 'vegan' }), 'eaa');
    expect(item.notices).toEqual(['eaa_food_first']);
    expect(supplementDose(item)).toMatchObject({ min: 10, max: 15, unit: 'g', per: 'serving' });
    expect(supplementTiming('eaa')).toBe('around_training');
  });

  it('Elektrolyte: 300–600 mg Natrium je Stunde, Hinweise lange Einheit, Durst, Arzt; Doping bei Wettkampf', () => {
    const item = supplementResult(
      rec({ hasLongSessions: true, hasCompetition: true }),
      'electrolytes',
    );
    expect(item.notices).toEqual([
      'electrolytes_long_sessions',
      'electrolytes_drink',
      'electrolytes_doctor',
      'doping',
    ]);
    expect(supplementDose(item)).toMatchObject({ min: 300, max: 600, unit: 'mg', per: 'hour' });
    expect(renderSupplementNotice('electrolytes_long_sessions')).toContain('ab 90 Minuten');
    expect(supplementTiming('electrolytes')).toBe('during_long_training');
  });

  it('Zink: Blutwerte, Höchstmenge 25 mg, Medikamente; pflanzlich zusätzlicher Satz; nie eine Menge', () => {
    const omni = supplementResult(rec(), 'zinc');
    expect(omni.notices).toEqual(['blood_test', 'zinc_upper_limit', 'mineral_medication']);
    expect(supplementDose(omni)).toBeNull();
    expect(supplementResult(rec({ dietType: 'vegan' }), 'zinc').notices).toContain('zinc_plant');
    expect(renderSupplementNotice('zinc_upper_limit')).toContain('höchstens 25 mg am Tag');
    expect(supplementLimitText('zinc')).toBe(`${SUPPLEMENT_RULES.zinc.supplementMaxMg} mg`);
  });

  it('Magnesium: Höchstmenge 250 mg aus Ergänzungen, nie eine Menge', () => {
    const item = supplementResult(rec(), 'magnesium');
    expect(item.notices).toEqual(['blood_test', 'magnesium_upper_limit', 'mineral_medication']);
    expect(supplementDose(item)).toBeNull();
    expect(renderSupplementNotice('magnesium_upper_limit')).toContain('höchstens 250 mg am Tag');
  });

  it('alle neuen Hinweise halten die Textregeln ein', () => {
    for (const key of [
      'beta_alanine_split',
      'beta_alanine_tingling',
      'eaa_food_first',
      'electrolytes_long_sessions',
      'electrolytes_drink',
      'electrolytes_doctor',
      'blood_test',
      'zinc_upper_limit',
      'zinc_plant',
      'magnesium_upper_limit',
      'mineral_medication',
    ] as const) {
      expect(renderSupplementNotice(key).length, key).toBeGreaterThan(10);
    }
  });

  it('sehr leicht und sehr schwer, sehr alt: Einordnung unverändert (keine gewichtsabhängige Menge)', () => {
    for (const weightKg of [30, 300]) {
      const result = rec({ weightKg, hasIntervalSessions: true, birthDate: '1926-01-01' });
      expect(status(result, 'beta_alanine')).toBe('recommended');
      expect(formatSupplementDose(supplementDose(supplementResult(result, 'beta_alanine'))!)).toBe(
        '3,2–6,4 g',
      );
    }
    expect(checkSupplementText('Lass deine Blutwerte ärztlich prüfen.')).toEqual([]);
  });
});
