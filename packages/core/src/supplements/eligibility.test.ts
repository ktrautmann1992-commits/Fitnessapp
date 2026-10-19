import { describe, expect, it } from 'vitest';

import { TRAINING_TIMES } from '../enums';
import type { RatedSupplementId } from '../supplement-ids';
import {
  recommendSupplements,
  supplementResult,
  type SupplementRecommendations,
  type SupplementStatus,
} from './eligibility';
import { supplementInputsSchema, type SupplementInputs } from './inputs';
import { supplementTestInputs as base, withoutConsent } from './test-helpers';

function statuses(result: SupplementRecommendations): Record<RatedSupplementId, SupplementStatus> {
  return Object.fromEntries(result.items.map((item) => [item.id, item.status])) as Record<
    RatedSupplementId,
    SupplementStatus
  >;
}

const rec = (overrides: Partial<SupplementInputs> = {}) => recommendSupplements(base(overrides));

describe('recommendSupplements – Grund-Person (Plan 3.2)', () => {
  const result = rec();

  it('Kreatin passt (Muskelaufbau), Proteinpulver ohne Daten nur Info, Vitamin D Info, Omega-3 bei Fisch Info', () => {
    expect(result.personalized).toBe(true);
    expect(statuses(result)).toEqual({
      creatine: 'recommended',
      protein_powder: 'info_only',
      vitamin_d: 'info_only',
      omega3: 'info_only',
    });
    expect(supplementResult(result, 'protein_powder').reasons).toEqual(['no_protein_data']);
    expect(supplementResult(result, 'vitamin_d').reasons).toEqual(['info_by_rule']);
    expect(supplementResult(result, 'omega3').reasons).toEqual(['eats_fish']);
  });

  it('Koffein: nur Sicherheits-Info mit persönlicher Grenze, ohne 16-Uhr-Satz bei „morgens“', () => {
    expect(result.caffeine).toEqual({
      id: 'caffeine',
      status: 'safety_info',
      mode: 'personal',
      reasons: [],
      notices: ['caffeine_single_personal', 'caffeine_daily', 'caffeine_test_new'],
    });
  });

  it('Kreatin-Hinweise: täglich, Wasser 1–2 kg, trinken wie gewohnt; Angabe creatine_performance', () => {
    const creatine = supplementResult(result, 'creatine');
    expect(creatine.notices).toEqual(['creatine_every_day', 'creatine_water', 'creatine_drink']);
    expect(creatine.claimIds).toEqual(['creatine_performance']);
    expect(creatine.reasons).toEqual([]);
  });

  it('feste Reihenfolge, keine Seiten-Hinweise', () => {
    expect(result.items.map((item) => item.id)).toEqual([
      'creatine',
      'protein_powder',
      'vitamin_d',
      'omega3',
    ]);
    expect(result.notices).toEqual([]);
  });
});

describe('Einwilligung und Checks (Plan 3.3, 11.1)', () => {
  it.each([
    [
      'keine Einwilligung',
      withoutConsent({}, null),
      ['no_consent_v2', 'no_health_screening', 'no_supplement_screening'],
    ],
    [
      'nur v1',
      withoutConsent({}, 1),
      ['no_consent_v2', 'no_health_screening', 'no_supplement_screening'],
    ],
    ['v2 ohne Gesundheits-Check', base({ healthFlags: null }), ['no_health_screening']],
    ['v2 ohne Supplement-Check', base({ supplementFlags: null }), ['no_supplement_screening']],
  ] as const)('%s → alles nur Info, Koffein allgemein', (_name, inputs, reasons) => {
    const result = recommendSupplements(inputs);
    expect(result.personalized).toBe(false);
    for (const item of result.items) {
      expect(item.status).toBe('info_only');
      expect(item.reasons).toEqual(reasons);
    }
    expect(result.caffeine.status).toBe('safety_info');
    expect(result.caffeine.mode).toBe('general');
    expect(result.caffeine.notices).toContain('caffeine_single_general');
    expect(result.caffeine.notices).not.toContain('caffeine_single_personal');
  });

  it('ohne persönliche Einordnung keine Herz-Angabe bei Omega-3 (Wächter SU1, Befund 4)', () => {
    for (const inputs of [
      withoutConsent({ dietType: 'vegan' }),
      base({ dietType: 'vegan', supplementFlags: null }),
      base({ dietType: 'vegan', healthFlags: null }),
    ]) {
      const omega3 = supplementResult(recommendSupplements(inputs), 'omega3');
      expect(omega3.status).toBe('info_only');
      expect(omega3.claimIds).toEqual([]);
    }
  });

  it('v3 (spätere Fassung) zählt wie v2', () => {
    expect(rec({ healthConsentVersion: 3 }).personalized).toBe(true);
  });

  it('ohne v2 dürfen keine Gesundheitsdaten übergeben werden (Schema)', () => {
    for (const key of ['healthFlags', 'supplementFlags'] as const) {
      expect(supplementInputsSchema.safeParse(withoutConsent({ [key]: [] }, 1)).success).toBe(
        false,
      );
    }
    expect(supplementInputsSchema.safeParse(withoutConsent({ weightKg: 70 })).success).toBe(false);
    expect(supplementInputsSchema.safeParse(withoutConsent({ proteinGap: true })).success).toBe(
      false,
    );
  });

  it('Schema ist strikt: kein Feld für Shops, Links oder Provisionen', () => {
    expect(supplementInputsSchema.safeParse({ ...base(), affiliateShopId: 'shop-a' }).success).toBe(
      false,
    );
    expect(supplementInputsSchema.safeParse({ ...base(), commission: 0.1 }).success).toBe(false);
    expect(Object.keys(supplementInputsSchema.shape).join(' ')).not.toMatch(
      /shop|link|affiliate|provision|commission/i,
    );
  });

  it('Stichtag vor Geburtsdatum, doppelte Flags, Stillzeit bei „männlich“ → Fehler', () => {
    expect(() => rec({ today: '1990-01-01' })).toThrow();
    expect(() => rec({ healthFlags: ['pregnancy', 'pregnancy'] })).toThrow();
    expect(() => rec({ sex: 'male', supplementFlags: ['breastfeeding'] })).toThrow();
  });
});

describe('Alter (Plan 3.3, SU-G3, Wächter K2)', () => {
  it('17 Jahre 364 Tage → Kreatin und Koffein „ab 18“, Rest Info; 18 Jahre 0 Tage → wie Erwachsene', () => {
    const minor = rec({ birthDate: '2008-10-20' });
    expect(statuses(minor)).toEqual({
      creatine: 'adult_only',
      protein_powder: 'info_only',
      vitamin_d: 'info_only',
      omega3: 'info_only',
    });
    expect(supplementResult(minor, 'creatine').notices).toEqual(['adult_only']);
    expect(supplementResult(minor, 'creatine').claimIds).toEqual([]);
    expect(minor.caffeine.status).toBe('safety_info_adult_only');
    expect(minor.caffeine.mode).toBeNull();
    expect(minor.caffeine.notices).toEqual(['adult_only']);

    const adult = rec({ birthDate: '2008-10-19' });
    expect(supplementResult(adult, 'creatine').status).toBe('recommended');
    expect(adult.caffeine.mode).toBe('personal');
  });

  it('unter 18: Proteinpulver trotz Lücke und Omega-3 trotz vegan nur Info', () => {
    const result = rec({ birthDate: '2009-01-01', proteinGap: true, dietType: 'vegan' });
    expect(supplementResult(result, 'protein_powder')).toMatchObject({
      status: 'info_only',
      reasons: ['under_18'],
      variant: null,
    });
    expect(supplementResult(result, 'omega3').status).toBe('info_only');
  });

  it('16 Jahre ohne Einwilligung: Alter gilt trotzdem („ab 18“)', () => {
    const result = recommendSupplements(withoutConsent({ birthDate: '2010-01-01' }));
    expect(supplementResult(result, 'creatine').status).toBe('adult_only');
    expect(result.caffeine.status).toBe('safety_info_adult_only');
  });

  it.each(['1971-10-19', '1961-10-19', '1936-10-19'])(
    'ab 55/65/90 (%s): keine eigene Sperre',
    (birthDate) => {
      expect(supplementResult(rec({ birthDate }), 'creatine').status).toBe('recommended');
      expect(rec({ birthDate }).caffeine.mode).toBe('personal');
    },
  );

  it.each([
    ['schwanger', { healthFlags: ['pregnancy', 'conservative_plan'] }],
    ['stillend', { supplementFlags: ['breastfeeding'] }],
  ] as const)(
    'unter 18 und %s: Koffein „ab 18“ plus BfR-Hinweis (Wächter SU1, Befund 1)',
    (_n, flags) => {
      const caffeine = rec({
        birthDate: '2009-01-01',
        ...(flags as unknown as Partial<SupplementInputs>),
      }).caffeine;
      expect(caffeine.status).toBe('safety_info_adult_only');
      expect(caffeine.notices).toEqual(['adult_only', 'caffeine_pregnancy']);
    },
  );

  it('Mindestalter 16 (Wächter SU1, Befund 7): 15 Jahre 364 Tage abgelehnt, 16 Jahre 0 Tage gültig', () => {
    expect(() => rec({ birthDate: '2010-10-20' })).toThrow();
    expect(supplementResult(rec({ birthDate: '2010-10-19' }), 'creatine').status).toBe(
      'adult_only',
    );
  });

  it('unter 18 und schwanger: „Nicht für dich“ ist strenger als „ab 18“', () => {
    const result = rec({
      birthDate: '2009-01-01',
      healthFlags: ['pregnancy', 'conservative_plan'],
    });
    expect(supplementResult(result, 'creatine').status).toBe('excluded');
  });
});

describe('Ausschlussregeln (Tabelle 3.3, strengste Regel gewinnt)', () => {
  const vegan = { dietType: 'vegan', proteinGap: true } as const;

  it.each([
    ['Schwangerschaft', 'pregnancy'],
    ['Stillzeit', 'breastfeeding'],
  ] as const)('%s → alles „Nicht für dich“, Koffein nur BfR-Hinweis', (_name, reason) => {
    const result = rec({
      ...vegan,
      ...(reason === 'pregnancy'
        ? { healthFlags: ['pregnancy', 'conservative_plan'] }
        : { supplementFlags: ['breastfeeding'] }),
    });
    for (const item of result.items) {
      expect(item.status).toBe('excluded');
      expect(item.reasons).toContain(reason);
      expect(item.notices).toEqual(['excluded_doctor', 'excluded_reason']);
      expect(item.claimIds).toEqual([]);
    }
    expect(result.caffeine).toMatchObject({
      status: 'safety_info',
      mode: 'pregnancy',
      notices: ['caffeine_pregnancy'],
    });
    expect(result.notices).toEqual(['pregnancy_midwife']);
  });

  it('Medikamente → Kreatin, Vitamin D, Omega-3 aus; Proteinpulver erlaubt; Koffein aus', () => {
    const result = rec({ ...vegan, healthFlags: ['medication', 'conservative_plan'] });
    expect(statuses(result)).toEqual({
      creatine: 'excluded',
      protein_powder: 'recommended',
      vitamin_d: 'excluded',
      omega3: 'excluded',
    });
    expect(result.caffeine).toMatchObject({
      status: 'safety_info_excluded',
      mode: null,
      notices: ['caffeine_excluded'],
    });
  });

  it('Arzt-Flag (Herz, Blutdruck) → Kreatin aus, Omega-3 nur Info ohne Herz-Angabe, Koffein aus', () => {
    const result = rec({
      ...vegan,
      healthFlags: ['medical_clearance_recommended', 'conservative_plan'],
    });
    expect(statuses(result)).toEqual({
      creatine: 'excluded',
      protein_powder: 'recommended',
      vitamin_d: 'info_only',
      omega3: 'info_only',
    });
    expect(supplementResult(result, 'omega3').claimIds).toEqual([]);
    expect(supplementResult(result, 'omega3').reasons).toEqual(['medical_clearance']);
    expect(result.caffeine.status).toBe('safety_info_excluded');
  });

  it('Niere → Kreatin, Proteinpulver, Vitamin D aus; Omega-3 erlaubt; Koffein allgemein', () => {
    const result = rec({ ...vegan, supplementFlags: ['kidney'] });
    expect(statuses(result)).toEqual({
      creatine: 'excluded',
      protein_powder: 'excluded',
      vitamin_d: 'excluded',
      omega3: 'recommended',
    });
    expect(result.caffeine).toMatchObject({ status: 'safety_info', mode: 'general' });
    expect(result.caffeine.reasons).toEqual(['kidney']);
  });

  it('Herzrhythmus → Kreatin erlaubt, Omega-3 Info ohne Herz-Angabe, Koffein aus, allgemeiner Arzt-Hinweis (K5)', () => {
    const result = rec({ ...vegan, supplementFlags: ['heart_rhythm'] });
    expect(statuses(result)).toEqual({
      creatine: 'recommended',
      protein_powder: 'recommended',
      vitamin_d: 'info_only',
      omega3: 'info_only',
    });
    expect(supplementResult(result, 'omega3').claimIds).toEqual([]);
    expect(result.caffeine.status).toBe('safety_info_excluded');
    expect(result.notices).toEqual(['medical_check']);
  });

  it('Omega-3 ohne Herz-Flag: Herz-Angabe dabei (S6 nur bei Flag)', () => {
    const result = rec(vegan);
    expect(supplementResult(result, 'omega3')).toMatchObject({
      status: 'recommended',
      claimIds: ['epa_dha_heart'],
      notices: ['omega3_algae'],
    });
  });

  it('Koffein-empfindlich → nur Koffein aus', () => {
    const result = rec({ ...vegan, supplementFlags: ['caffeine_sensitive'] });
    expect(statuses(result)).toEqual({
      creatine: 'recommended',
      protein_powder: 'recommended',
      vitamin_d: 'info_only',
      omega3: 'recommended',
    });
    expect(result.caffeine.status).toBe('safety_info_excluded');
  });

  it('Verletzung oder vorsichtiger Plan allein sperren nichts', () => {
    const result = rec({ ...vegan, healthFlags: ['injury', 'conservative_plan'] });
    expect(supplementResult(result, 'creatine').status).toBe('recommended');
    expect(result.caffeine.mode).toBe('personal');
  });

  it('Schwangerschaft + Medikamente: Koffein „ärztlich abklären“ ist strenger als der BfR-Hinweis', () => {
    const result = rec({ healthFlags: ['pregnancy', 'medication', 'conservative_plan'] });
    expect(result.caffeine.status).toBe('safety_info_excluded');
    expect(result.caffeine.reasons).toEqual(['medication']);
  });
});

describe('Koffein und Trainingszeit (Plan 3.5, Wächter K9)', () => {
  it.each(TRAINING_TIMES)('%s', (trainingTime) => {
    const caffeine = rec({ trainingTime }).caffeine;
    expect(caffeine.status).toBe('safety_info');
    expect(caffeine.mode).toBe('personal');
    const expected =
      trainingTime === 'evening'
        ? 'caffeine_not_evening'
        : trainingTime === 'afternoon' || trainingTime === 'varies'
          ? 'caffeine_before_cutoff'
          : null;
    const timing = caffeine.notices.filter(
      (notice) => notice === 'caffeine_not_evening' || notice === 'caffeine_before_cutoff',
    );
    expect(timing).toEqual(expected === null ? [] : [expected]);
  });

  it('ohne Trainingszeit → 16-Uhr-Satz (sichere Richtung)', () => {
    expect(rec({ trainingTime: null }).caffeine.notices).toContain('caffeine_before_cutoff');
  });

  it('ohne Gewicht → allgemeine Grenzen (Tassen-Satz)', () => {
    const caffeine = rec({ weightKg: null }).caffeine;
    expect(caffeine.mode).toBe('general');
    expect(caffeine.reasons).toEqual(['no_weight']);
    expect(caffeine.notices[0]).toBe('caffeine_single_general');
  });
});

describe('Proteinpulver (Plan 3.7, Wächter S7)', () => {
  it('vegan ohne Lücke → Info; vegan mit Lücke → passt, pflanzlich', () => {
    expect(
      supplementResult(rec({ dietType: 'vegan', proteinGap: false }), 'protein_powder'),
    ).toMatchObject({
      status: 'info_only',
      reasons: ['no_protein_gap'],
      variant: null,
    });
    expect(
      supplementResult(rec({ dietType: 'vegan', proteinGap: true }), 'protein_powder'),
    ).toMatchObject({
      status: 'recommended',
      variant: 'plant',
      notices: ['protein_plant_variant', 'protein_counts_as_meal'],
      claimIds: ['protein_muscle_mass'],
    });
  });

  it('Milch-Unverträglichkeit → pflanzlich; Mischkost → keine Variante', () => {
    expect(
      supplementResult(rec({ avoidsDairy: true, proteinGap: true }), 'protein_powder').variant,
    ).toBe('plant');
    expect(supplementResult(rec({ proteinGap: true }), 'protein_powder').variant).toBeNull();
  });

  it('ohne Kalorienziel (no_targets) → nie „passt“', () => {
    expect(
      supplementResult(rec({ proteinGap: true, hasNutritionTargets: false }), 'protein_powder'),
    ).toMatchObject({ status: 'info_only', reasons: ['no_nutrition_targets'] });
  });
});

describe('Kreatin und Ziel (Plan 3.2)', () => {
  it.each([
    ['muscle_gain', null, false, 'recommended'],
    ['definition', null, false, 'recommended'],
    ['fat_loss', null, false, 'info_only'],
    ['fat_loss', 'muscle_gain', false, 'recommended'],
    ['general_fitness', null, false, 'info_only'],
    ['endurance', null, false, 'info_only'],
    ['endurance', null, true, 'recommended'],
    ['general_fitness', 'endurance', true, 'recommended'],
  ] as const)(
    '%s + %s, Intervalle %s → %s',
    (goalType, secondaryGoalType, hasIntervalSessions, status) => {
      const creatine = supplementResult(
        rec({ goalType, secondaryGoalType, hasIntervalSessions }),
        'creatine',
      );
      expect(creatine.status).toBe(status);
      if (status === 'info_only') expect(creatine.reasons).toEqual(['goal_not_matching']);
    },
  );

  it('Kreatin-Hinweise auch auf der Info-Seite (Wasser), aber ohne „täglich“', () => {
    expect(supplementResult(rec({ goalType: 'fat_loss' }), 'creatine').notices).toEqual([
      'creatine_water',
      'creatine_drink',
    ]);
  });
});

describe('Omega-3, Vitamin D, Doping', () => {
  it.each([
    ['vegetarisch', { dietType: 'vegetarian' }, 'recommended'],
    ['Fisch mag ich nicht', { avoidsFish: true }, 'recommended'],
    ['Mischkost', {}, 'info_only'],
  ] as const)('Omega-3 %s → %s', (_name, overrides, status) => {
    expect(supplementResult(rec(overrides), 'omega3').status).toBe(status);
  });

  it('Vitamin D nie „passt“; Blutwerte-Satz immer, Sonnen-Satz nur Oktober bis März', () => {
    for (const overrides of [{}, { dietType: 'vegan' as const }, { proteinGap: true }]) {
      expect(supplementResult(rec(overrides), 'vitamin_d').status).toBe('info_only');
    }
    expect(supplementResult(rec({ today: '2026-10-19' }), 'vitamin_d').notices).toEqual([
      'vitamin_d_blood_test',
      'vitamin_d_low_sun',
    ]);
    expect(supplementResult(rec({ today: '2026-03-31' }), 'vitamin_d').notices).toContain(
      'vitamin_d_low_sun',
    );
    expect(supplementResult(rec({ today: '2026-06-15' }), 'vitamin_d').notices).toEqual([
      'vitamin_d_blood_test',
    ]);
  });

  it('Doping-Hinweis bei Leistungssport oder eingetragenem Wettkampf (Kreatin, Proteinpulver)', () => {
    for (const overrides of [
      { experienceLevel: 'competitive' as const },
      { hasCompetition: true },
    ]) {
      const result = rec(overrides);
      expect(supplementResult(result, 'creatine').notices).toContain('doping');
      expect(supplementResult(result, 'protein_powder').notices).toContain('doping');
      expect(supplementResult(result, 'omega3').notices).not.toContain('doping');
    }
    expect(supplementResult(rec(), 'creatine').notices).not.toContain('doping');
  });
});

describe('sehr leicht / sehr schwer (Eingabe-Grenzen)', () => {
  it('30 kg und 300 kg gültig, 29 und 301 kg abgelehnt', () => {
    expect(rec({ weightKg: 30 }).caffeine.mode).toBe('personal');
    expect(rec({ weightKg: 300 }).caffeine.mode).toBe('personal');
    expect(() => rec({ weightKg: 29 })).toThrow();
    expect(() => rec({ weightKg: 301 })).toThrow();
  });
});
