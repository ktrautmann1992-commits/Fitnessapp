import { describe, expect, it } from 'vitest';

import { TRAINING_TIMES } from '../enums';
import { HEALTH_FLAGS, type HealthFlag } from '../health-screening';
import type { RatedSupplementId } from '../supplement-ids';
import {
  caffeineRank,
  recommendSupplements,
  supplementStatusRank,
  type SupplementRecommendations,
} from './eligibility';
import type { SupplementInputs } from './inputs';
import { SUPPLEMENT_FLAGS, type SupplementFlag } from './screening';
import { supplementTestInputs as base, withoutConsent } from './test-helpers';

/**
 * Eigenschaftstests (Plan 5, Wächter K14): über alle 2^9 Flag-Kombinationen und Alter, Einwilligung, Trainingszeit und
 * Monat. Die Sperr-Liste unten ist UNABHÄNGIG vom Code aus Tabelle 3.3 abgeschrieben.
 */

type AnyFlag = HealthFlag | SupplementFlag;
const ALL_FLAGS: readonly AnyFlag[] = [...HEALTH_FLAGS, ...SUPPLEMENT_FLAGS];

/** Tabelle 3.3: Flags, bei denen das Supplement nie „passt zu dir“ sein darf. */
const BLOCKING: Readonly<Record<RatedSupplementId, readonly AnyFlag[]>> = {
  creatine: ['pregnancy', 'breastfeeding', 'medication', 'medical_clearance_recommended', 'kidney'],
  protein_powder: ['pregnancy', 'breastfeeding', 'kidney'],
  vitamin_d: ALL_FLAGS, // nie „passt“
  omega3: [
    'pregnancy',
    'breastfeeding',
    'medication',
    'medical_clearance_recommended',
    'heart_rhythm',
  ],
};
const CAFFEINE_EXCLUDING: readonly AnyFlag[] = [
  'medication',
  'medical_clearance_recommended',
  'heart_rhythm',
  'caffeine_sensitive',
];

function flagCombos(): AnyFlag[][] {
  const combos: AnyFlag[][] = [];
  for (let mask = 0; mask < 1 << ALL_FLAGS.length; mask += 1) {
    combos.push(ALL_FLAGS.filter((_flag, index) => (mask & (1 << index)) !== 0));
  }
  return combos;
}

function withFlags(flags: readonly AnyFlag[], overrides: Partial<SupplementInputs> = {}) {
  return base({
    dietType: 'vegan',
    proteinGap: true,
    healthFlags: HEALTH_FLAGS.filter((flag) => flags.includes(flag)),
    supplementFlags: SUPPLEMENT_FLAGS.filter((flag) => flags.includes(flag)),
    ...overrides,
  });
}

function ranks(result: SupplementRecommendations): number[] {
  return [
    ...result.items.map((item) => supplementStatusRank(item.status)),
    caffeineRank(result.caffeine),
  ];
}

function expectNotLooser(stricter: SupplementRecommendations, looser: SupplementRecommendations) {
  const a = ranks(stricter);
  const b = ranks(looser);
  for (let index = 0; index < a.length; index += 1) {
    expect(a[index]).toBeGreaterThanOrEqual(b[index]!);
  }
}

const COMBOS = flagCombos();

describe('Eigenschaft: Sperr-Flags und Monotonie (K14)', () => {
  it('2^9 Kombinationen', () => {
    expect(COMBOS).toHaveLength(512);
  });

  it('ein gesetztes Sperr-Flag führt nie zu „passt zu dir“; Koffein-Sperren nie zu einer Grenze', () => {
    for (const flags of COMBOS) {
      const result = recommendSupplements(withFlags(flags));
      for (const item of result.items) {
        if (BLOCKING[item.id].some((flag) => flags.includes(flag))) {
          expect(item.status).not.toBe('recommended');
        }
        if (item.status !== 'recommended') {
          // Ohne „passt“ keine persönliche Variante.
          expect(item.variant).toBeNull();
        }
      }
      if (CAFFEINE_EXCLUDING.some((flag) => flags.includes(flag))) {
        expect(result.caffeine.status).toBe('safety_info_excluded');
      }
      if (result.caffeine.mode === 'personal') {
        expect(flags.filter((flag) => !['injury', 'conservative_plan'].includes(flag))).toEqual([]);
      }
    }
  });

  it('ein Flag mehr macht das Ergebnis nie lockerer (alle Kombinationen × jedes zusätzliche Flag)', () => {
    const results = new Map(
      COMBOS.map((flags) => [flags.join(','), recommendSupplements(withFlags(flags))]),
    );
    for (const flags of COMBOS) {
      for (const extra of ALL_FLAGS) {
        if (flags.includes(extra)) continue;
        const more = ALL_FLAGS.filter((flag) => flags.includes(flag) || flag === extra);
        expectNotLooser(results.get(more.join(','))!, results.get(flags.join(','))!);
      }
    }
  });

  it.each([
    ['16', '2010-05-01'],
    ['17 Jahre 364 Tage', '2008-10-20'],
  ])(
    'jünger als 18 (%s) ist nie lockerer als 18 bzw. 30 Jahre – über alle Flag-Kombinationen',
    (_name, birthDate) => {
      for (const flags of COMBOS) {
        const minor = recommendSupplements(withFlags(flags, { birthDate }));
        expectNotLooser(minor, recommendSupplements(withFlags(flags, { birthDate: '2008-10-19' })));
        expectNotLooser(minor, recommendSupplements(withFlags(flags)));
        for (const item of minor.items) expect(item.status).not.toBe('recommended');
        expect(minor.caffeine.mode).not.toBe('personal');
      }
    },
  );

  it('fehlende Einwilligung (keine/v1) oder fehlender Check: nie „passt“, nie persönliche Koffein-Grenze, nie lockerer als ohne Flags', () => {
    const consentFree = recommendSupplements(withFlags([]));
    for (const version of [null, 1]) {
      for (const birthDate of ['2010-05-01', '1996-05-01', '1936-10-19']) {
        const result = recommendSupplements(
          withoutConsent({ dietType: 'vegan', birthDate }, version),
        );
        for (const item of result.items) expect(item.status).not.toBe('recommended');
        expect(result.caffeine.mode).not.toBe('personal');
        expectNotLooser(result, recommendSupplements(withFlags([], { birthDate })));
      }
    }
    for (const missing of [{ healthFlags: null }, { supplementFlags: null }]) {
      const result = recommendSupplements(withFlags([], missing));
      expectNotLooser(result, consentFree);
      for (const item of result.items) expect(item.status).not.toBe('recommended');
    }
  });

  it('Trainingszeit und Monat ändern nie einen Status (nur Hinweise) – über alle Flag-Kombinationen', () => {
    const months = ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-19'];
    for (const flags of COMBOS) {
      const reference = ranks(recommendSupplements(withFlags(flags)));
      for (const trainingTime of [...TRAINING_TIMES, null]) {
        expect(ranks(recommendSupplements(withFlags(flags, { trainingTime })))).toEqual(reference);
      }
      for (const today of months) {
        expect(ranks(recommendSupplements(withFlags(flags, { today })))).toEqual(reference);
      }
    }
  });

  it('Abend-Training: Koffein nie ohne „kein Koffein vor dem Training“; nachmittags/unterschiedlich nie ohne 16-Uhr-Satz', () => {
    for (const flags of COMBOS) {
      for (const trainingTime of ['evening', 'afternoon', 'varies'] as const) {
        const caffeine = recommendSupplements(withFlags(flags, { trainingTime })).caffeine;
        if (caffeine.mode === 'personal' || caffeine.mode === 'general') {
          expect(caffeine.notices).toContain(
            trainingTime === 'evening' ? 'caffeine_not_evening' : 'caffeine_before_cutoff',
          );
        }
      }
    }
  });
});
