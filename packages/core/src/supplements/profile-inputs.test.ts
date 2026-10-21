import { describe, expect, it } from 'vitest';

import { recommendSupplements } from './eligibility';
import {
  buildSupplementInputs,
  proteinLogDays,
  type SupplementFoodLogEntry,
  type SupplementProfileSource,
} from './profile-inputs';
import type { StoredSupplementScreening } from './user-data';

const TODAY = '2026-10-21';

const screening = (
  flags: StoredSupplementScreening['flags'] = [],
  extra: Partial<StoredSupplementScreening['answers']> = {},
  version = 1,
): StoredSupplementScreening => ({
  answers: {
    kidney: flags.includes('kidney'),
    breastfeeding: flags.includes('breastfeeding'),
    heart_rhythm: flags.includes('heart_rhythm'),
    caffeine_sensitive: flags.includes('caffeine_sensitive'),
    ...extra,
  },
  flags,
  version,
  updatedAt: '2026-10-20T10:00:00.000Z',
});

function source(overrides: Partial<SupplementProfileSource> = {}): SupplementProfileSource {
  return {
    today: TODAY,
    birthDate: '1996-05-01',
    sex: 'female',
    validHealthConsentVersion: 2,
    healthFlags: [],
    screening: screening(),
    latestWeightKg: 70,
    goalType: 'muscle_gain',
    secondaryGoalType: null,
    experienceLevel: 'beginner',
    hasIntervalSessions: false,
    dietType: 'omnivore',
    foodPreferences: [],
    trainingTime: 'morning',
    foodLog: [],
    proteinTargetG: 120,
    hasNutritionTargets: true,
    hasCompetition: false,
    ...overrides,
  };
}

/** Tagebuch: je Tag ein Eintrag mit `protein` g (Tage rückwärts ab heute). */
function log(proteinPerDay: readonly (number | null)[]): SupplementFoodLogEntry[] {
  return proteinPerDay.map((protein, index) => ({
    eatenOn: `2026-10-${String(21 - index).padStart(2, '0')}`,
    kcal: 500,
    proteinG: protein,
  }));
}

describe('buildSupplementInputs – Einwilligung (Plan 11.1)', () => {
  it('Fassung 2: Gesundheitsdaten fließen ein, persönliche Einordnung', () => {
    const inputs = buildSupplementInputs(source());
    expect(inputs).toMatchObject({
      healthConsentVersion: 2,
      healthFlags: [],
      supplementFlags: [],
      weightKg: 70,
    });
    expect(recommendSupplements(inputs).personalized).toBe(true);
  });

  it.each([
    ['keine gültige Einwilligung', null],
    ['nur Fassung 1 (Datenbank vor der Veröffentlichung)', 1],
  ])('%s: alle Gesundheitsdaten null, nur Info', (_name, version) => {
    const inputs = buildSupplementInputs(
      source({
        validHealthConsentVersion: version,
        healthFlags: ['pregnancy', 'conservative_plan'],
        screening: screening(['kidney'], { protein_self_check: 'rather_not' }),
        foodPreferences: [
          { group: 'fish', kind: 'intolerance' },
          { group: 'lactose', kind: 'intolerance' },
        ],
        foodLog: log([10, 10, 10, 10, 10, 10, 10]),
      }),
    );
    expect(inputs).toMatchObject({
      healthConsentVersion: null,
      healthFlags: null,
      supplementFlags: null,
      weightKg: null,
      proteinGap: null,
      avoidsFish: false,
      avoidsDairy: false,
    });
    const result = recommendSupplements(inputs);
    expect(result.personalized).toBe(false);
    expect(result.items.every((item) => item.status === 'info_only')).toBe(true);
  });

  it('„Fisch mag ich nicht“ ist keine Gesundheitsangabe und zählt immer', () => {
    expect(
      buildSupplementInputs(
        source({
          validHealthConsentVersion: null,
          healthFlags: null,
          foodPreferences: [{ group: 'fish', kind: 'dislike' }],
        }),
      ).avoidsFish,
    ).toBe(true);
  });

  it('Unverträglichkeiten mit Fassung 2: Fisch → meidet Fisch, Laktose/Milch → pflanzlich; „mag“ zählt nicht', () => {
    const inputs = buildSupplementInputs(
      source({
        foodPreferences: [
          { group: 'fish', kind: 'intolerance' },
          { group: 'dairy', kind: 'intolerance' },
          { group: 'lactose', kind: 'like' },
        ],
      }),
    );
    expect(inputs.avoidsFish).toBe(true);
    expect(inputs.avoidsDairy).toBe(true);
    expect(
      buildSupplementInputs(source({ foodPreferences: [{ group: 'fish', kind: 'like' }] }))
        .avoidsFish,
    ).toBe(false);
  });
});

describe('buildSupplementInputs – Supplement-Check', () => {
  it('ohne Check bzw. ältere Fassung der Fragen: Check fehlt (erneut fragen)', () => {
    expect(buildSupplementInputs(source({ screening: null })).supplementFlags).toBeNull();
    expect(
      buildSupplementInputs(source({ screening: screening([], {}, 0) })).supplementFlags,
    ).toBeNull();
  });

  it('Stillzeit zählt nicht bei „männlich“ (älterer Check nach Änderung des Geschlechts)', () => {
    const inputs = buildSupplementInputs(
      source({ sex: 'male', screening: screening(['breastfeeding', 'caffeine_sensitive']) }),
    );
    expect(inputs.supplementFlags).toEqual(['caffeine_sensitive']);
    expect(() => recommendSupplements(inputs)).not.toThrow();
  });

  it('Flags werden übernommen und sperren (strengste Regel)', () => {
    const result = recommendSupplements(
      buildSupplementInputs(source({ screening: screening(['kidney']) })),
    );
    expect(result.items.find((item) => item.id === 'creatine')?.status).toBe('excluded');
  });

  it('doppelte Gesundheits-Flags werden zusammengefasst', () => {
    expect(
      buildSupplementInputs(source({ healthFlags: ['medication', 'medication'] })).healthFlags,
    ).toEqual(['medication']);
  });
});

describe('Eiweiß-Lücke (Plan 3.7, S7)', () => {
  it('Tagebuch mit 4 Tagen unter 90 % → Lücke; geht vor der Selbsteinschätzung', () => {
    const inputs = buildSupplementInputs(
      source({
        foodLog: log([80, 80, 80, 80]),
        screening: screening([], { protein_self_check: 'mostly_yes' }),
      }),
    );
    expect(inputs.proteinGap).toBe(true);
  });

  it('Tagebuch mit 3 Tagen reicht nicht → Selbsteinschätzung zählt', () => {
    expect(
      buildSupplementInputs(
        source({
          foodLog: log([80, 80, 80]),
          screening: screening([], { protein_self_check: 'rather_not' }),
        }),
      ).proteinGap,
    ).toBe(true);
    expect(buildSupplementInputs(source({ foodLog: log([80, 80, 80]) })).proteinGap).toBeNull();
  });

  it('Tagebuch auf dem Ziel → keine Lücke', () => {
    expect(
      buildSupplementInputs(source({ foodLog: log([120, 120, 120, 120, 120]) })).proteinGap,
    ).toBe(false);
  });

  it('ohne Eiweißziel nur die Selbsteinschätzung', () => {
    expect(
      buildSupplementInputs(
        source({
          proteinTargetG: null,
          foodLog: log([10, 10, 10, 10]),
          screening: screening([], { protein_self_check: 'mostly_yes' }),
        }),
      ).proteinGap,
    ).toBe(false);
  });

  it('proteinLogDays: genau 7 Tage bis heute, unvollständige Tage (ohne Eiweiß oder ohne kcal) = null', () => {
    const days = proteinLogDays(
      [
        { eatenOn: '2026-10-21', kcal: 300, proteinG: 20 },
        { eatenOn: '2026-10-21', kcal: 200, proteinG: 10.04 },
        { eatenOn: '2026-10-20', kcal: 300, proteinG: null },
        { eatenOn: '2026-10-19', kcal: null, proteinG: null },
        { eatenOn: '2026-10-14', kcal: 300, proteinG: 99 },
        { eatenOn: '2026-10-15', kcal: 300, proteinG: 0 },
      ],
      TODAY,
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-10-15', proteinG: 0 });
    expect(days.at(-1)).toEqual({ date: '2026-10-21', proteinG: 30 });
    expect(days.find((d) => d.date === '2026-10-20')?.proteinG).toBeNull();
    expect(days.find((d) => d.date === '2026-10-19')?.proteinG).toBeNull();
    expect(days.some((d) => d.date === '2026-10-14')).toBe(false);
  });
});

describe('Grenzfälle Alter und Gewicht', () => {
  it.each([
    ['16 Jahre', '2010-10-21', 'adult_only'],
    ['17 Jahre 364 Tage', '2008-10-22', 'adult_only'],
    ['18 Jahre 0 Tage', '2008-10-21', 'recommended'],
    ['90 Jahre', '1936-01-01', 'recommended'],
  ])('%s → Kreatin %s', (_name, birthDate, status) => {
    const result = recommendSupplements(buildSupplementInputs(source({ birthDate })));
    expect(result.items.find((item) => item.id === 'creatine')?.status).toBe(status);
  });

  it.each([30, 300, null])('Gewicht %s kg geht durch', (weight) => {
    expect(buildSupplementInputs(source({ latestWeightKg: weight })).weightKg).toBe(weight);
  });
});
