import { describe, expect, it } from 'vitest';

import {
  bodyMetricsStepSchema,
  cookingStepSchema,
  createBirthDateSchema,
  createGoalStepSchema,
  equipmentItemSchema,
  equipmentStepSchema,
  nutritionStepSchema,
  sexStepSchema,
} from './validation';

const today = '2026-10-03';
const ok = (result: { success: boolean }) => expect(result.success).toBe(true);
const fail = (result: { success: boolean }) => expect(result.success).toBe(false);

describe('Geburtsdatum', () => {
  const schema = createBirthDateSchema(today);

  it('am 16. Geburtstag erlaubt, einen Tag davor nicht', () => {
    ok(schema.safeParse('2010-10-03'));
    fail(schema.safeParse('2010-10-04'));
  });

  it('29. Februar: 16 erst am 1. März im Nicht-Schaltjahr', () => {
    expect(createBirthDateSchema('2026-02-28').safeParse('2010-02-28').success).toBe(true);
    expect(createBirthDateSchema('2025-02-28').safeParse('2008-02-29').success).toBe(true);
    expect(createBirthDateSchema('2024-02-28').safeParse('2008-02-29').success).toBe(false);
  });

  it('sehr alt: ab 1900 erlaubt, davor nicht', () => {
    ok(schema.safeParse('1900-01-01'));
    fail(schema.safeParse('1899-12-31'));
  });

  it('Zukunft und ungültige Formate abgelehnt', () => {
    fail(schema.safeParse('2026-10-04'));
    fail(schema.safeParse('03.10.2000'));
    fail(schema.safeParse('2000-02-30'));
  });

  it('meldet den Altersgrund auf Deutsch', () => {
    const result = schema.safeParse('2015-01-01');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Die App ist ab 16 Jahren nutzbar.');
  });
});

describe('Geschlecht', () => {
  it('alle vier Optionen', () => {
    for (const sex of ['male', 'female', 'diverse', 'unspecified']) {
      ok(sexStepSchema.safeParse({ sex }));
    }
    fail(sexStepSchema.safeParse({ sex: 'other' }));
  });

  it('Zyklus-Interesse nur bei „weiblich“', () => {
    ok(sexStepSchema.safeParse({ sex: 'female', cycleModuleInterest: true }));
    ok(sexStepSchema.safeParse({ sex: 'female', cycleModuleInterest: false }));
    fail(sexStepSchema.safeParse({ sex: 'male', cycleModuleInterest: true }));
    fail(sexStepSchema.safeParse({ sex: 'diverse', cycleModuleInterest: false }));
    ok(sexStepSchema.safeParse({ sex: 'male', cycleModuleInterest: null }));
  });
});

describe('Körperdaten', () => {
  const base = { heightCm: 175, weightKg: 70 };

  it('Größe und Gewicht sind Pflicht, Rest optional', () => {
    ok(bodyMetricsStepSchema.safeParse(base));
    fail(bodyMetricsStepSchema.safeParse({ heightCm: 175 }));
    fail(bodyMetricsStepSchema.safeParse({ weightKg: 70 }));
    ok(bodyMetricsStepSchema.safeParse({ ...base, bodyFatPct: null, restingHeartRateBpm: null }));
  });

  it.each([
    ['heightCm', 100, 250],
    ['weightKg', 30, 300],
    ['bodyFatPct', 3, 60],
    ['restingHeartRateBpm', 30, 120],
  ] as const)('%s: genau auf der Grenze erlaubt, daneben nicht', (field, min, max) => {
    const step = field === 'restingHeartRateBpm' ? 1 : 0.1;
    ok(bodyMetricsStepSchema.safeParse({ ...base, [field]: min }));
    ok(bodyMetricsStepSchema.safeParse({ ...base, [field]: max }));
    fail(bodyMetricsStepSchema.safeParse({ ...base, [field]: min - step }));
    fail(bodyMetricsStepSchema.safeParse({ ...base, [field]: max + step }));
  });

  it('sehr leicht und sehr schwer an den Rändern', () => {
    ok(bodyMetricsStepSchema.safeParse({ heightCm: 100, weightKg: 30 }));
    ok(bodyMetricsStepSchema.safeParse({ heightCm: 250, weightKg: 300 }));
  });

  it('Ruhepuls nur ganzzahlig, keine Zeichenketten', () => {
    fail(bodyMetricsStepSchema.safeParse({ ...base, restingHeartRateBpm: 60.5 }));
    fail(bodyMetricsStepSchema.safeParse({ ...base, weightKg: '70' }));
  });
});

describe('Ziel', () => {
  const schema = createGoalStepSchema(today);

  it('Ziel ohne Disziplin', () => {
    ok(schema.safeParse({ goalType: 'muscle_gain' }));
  });

  it('Disziplin nur bei Ausdauer', () => {
    ok(schema.safeParse({ goalType: 'endurance', discipline: 'marathon' }));
    fail(schema.safeParse({ goalType: 'fat_loss', discipline: 'marathon' }));
  });

  it('Wettkampfdatum heute oder später', () => {
    ok(schema.safeParse({ goalType: 'endurance', targetDate: today }));
    fail(schema.safeParse({ goalType: 'endurance', targetDate: '2026-10-02' }));
  });
});

describe('Equipment', () => {
  it('Gewichtsstufen nur bei Geräten mit Gewichten, Grenzen 0,25–200 kg', () => {
    ok(
      equipmentItemSchema.safeParse({
        equipmentId: 'dumbbells',
        location: 'home',
        weightsKg: [0.25, 200],
      }),
    );
    fail(
      equipmentItemSchema.safeParse({
        equipmentId: 'dumbbells',
        location: 'home',
        weightsKg: [0.2],
      }),
    );
    fail(
      equipmentItemSchema.safeParse({
        equipmentId: 'dumbbells',
        location: 'home',
        weightsKg: [200.5],
      }),
    );
    fail(
      equipmentItemSchema.safeParse({
        equipmentId: 'dumbbells',
        location: 'home',
        weightsKg: [5, 5],
      }),
    );
    fail(
      equipmentItemSchema.safeParse({ equipmentId: 'treadmill', location: 'home', weightsKg: [5] }),
    );
  });

  it('Gewichtsstufen mit höchstens 2 Nachkommastellen (wie numeric(5,2))', () => {
    const parse = (weightsKg: number[]) =>
      equipmentItemSchema.safeParse({ equipmentId: 'barbell', location: 'home', weightsKg });
    expect(parse([1.25, 2.5, 0.1 + 0.2]).success).toBe(true);
    expect(parse([0.1 + 0.2]).data?.weightsKg).toEqual([0.3]);
    expect(parse([1.255]).success).toBe(false);
    expect(parse([2.5, 2.5000000001]).success).toBe(false);
  });

  it('höchstens 40 Gewichtsstufen', () => {
    const weights = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
    ok(
      equipmentItemSchema.safeParse({
        equipmentId: 'kettlebells',
        location: 'home',
        weightsKg: weights(40),
      }),
    );
    fail(
      equipmentItemSchema.safeParse({
        equipmentId: 'kettlebells',
        location: 'home',
        weightsKg: weights(41),
      }),
    );
  });

  it('Langhantel: Stange 5–25 kg nur bei der Langhantel, Scheiben höchstens 25 kg', () => {
    const barbell = (extra: Record<string, unknown>) =>
      equipmentItemSchema.safeParse({ equipmentId: 'barbell', location: 'home', ...extra });
    ok(barbell({ barKg: 5, weightsKg: [25] }));
    ok(barbell({ barKg: 25 }));
    ok(barbell({ barKg: 7.25 }));
    ok(barbell({ barKg: null }));
    expect(barbell({ barKg: 0.1 + 6.9 }).data?.barKg).toBe(7);
    fail(barbell({ barKg: 4.99 }));
    fail(barbell({ barKg: 25.01 }));
    fail(barbell({ barKg: 7.255 }));
    fail(barbell({ weightsKg: [25.25] }));
    fail(barbell({ weightsKg: [27.5] }));
    // Andere Geräte: keine Stange; Kurzhanteln über 25 kg je Hantel bleiben erlaubt.
    fail(equipmentItemSchema.safeParse({ equipmentId: 'dumbbells', location: 'home', barKg: 20 }));
    ok(
      equipmentItemSchema.safeParse({
        equipmentId: 'dumbbells',
        location: 'home',
        weightsKg: [40],
      }),
    );
  });

  it('„Sonstiges“ braucht Freitext, andere Geräte haben keinen', () => {
    ok(
      equipmentItemSchema.safeParse({
        equipmentId: 'other',
        location: 'home',
        note: 'Sprossenwand',
      }),
    );
    fail(equipmentItemSchema.safeParse({ equipmentId: 'other', location: 'home' }));
    fail(equipmentItemSchema.safeParse({ equipmentId: 'other', location: 'home', note: '   ' }));
    fail(
      equipmentItemSchema.safeParse({
        equipmentId: 'other',
        location: 'home',
        note: 'x'.repeat(201),
      }),
    );
    fail(equipmentItemSchema.safeParse({ equipmentId: 'barbell', location: 'home', note: 'x' }));
  });

  it('unbekannte Geräte und Doppelungen je Ort abgelehnt', () => {
    fail(equipmentItemSchema.safeParse({ equipmentId: 'hovercraft', location: 'home' }));
    ok(
      equipmentStepSchema.safeParse({
        items: [
          { equipmentId: 'barbell', location: 'home' },
          { equipmentId: 'barbell', location: 'gym' },
        ],
      }),
    );
    fail(
      equipmentStepSchema.safeParse({
        items: [
          { equipmentId: 'barbell', location: 'home' },
          { equipmentId: 'barbell', location: 'home' },
        ],
      }),
    );
    ok(equipmentStepSchema.safeParse({ items: [] }));
  });

  it('Studio-Geräte nur beim Ort „gym“, nicht „zu Hause“', () => {
    for (const equipmentId of ['cable_station', 'lat_pulldown', 'leg_press', 'power_rack']) {
      const home = equipmentItemSchema.safeParse({ equipmentId, location: 'home' });
      expect(home.success).toBe(false);
      expect(home.error?.issues[0]?.message).toBe('Dieses Gerät gibt es nur im Studio.');
      ok(equipmentItemSchema.safeParse({ equipmentId, location: 'gym' }));
    }
    // Heim-Geräte bleiben an beiden Orten erlaubt.
    ok(equipmentItemSchema.safeParse({ equipmentId: 'resistance_bands', location: 'home' }));
    ok(equipmentItemSchema.safeParse({ equipmentId: 'resistance_bands', location: 'gym' }));
    fail(
      equipmentStepSchema.safeParse({
        items: [{ equipmentId: 'leg_curl_machine', location: 'home' }],
      }),
    );
  });
});

describe('Ernährung', () => {
  it('1 und 8 Mahlzeiten erlaubt, 0 und 9 nicht', () => {
    ok(nutritionStepSchema.safeParse({ dietType: 'omnivore', mealsPerDay: 1 }));
    ok(nutritionStepSchema.safeParse({ dietType: 'omnivore', mealsPerDay: 8 }));
    fail(nutritionStepSchema.safeParse({ dietType: 'omnivore', mealsPerDay: 0 }));
    fail(nutritionStepSchema.safeParse({ dietType: 'omnivore', mealsPerDay: 9 }));
  });

  it('Schwein nur bei omnivor', () => {
    ok(nutritionStepSchema.safeParse({ dietType: 'omnivore', eatsPork: true, mealsPerDay: 3 }));
    ok(nutritionStepSchema.safeParse({ dietType: 'vegan', eatsPork: false, mealsPerDay: 3 }));
    fail(nutritionStepSchema.safeParse({ dietType: 'vegetarian', eatsPork: true, mealsPerDay: 3 }));
  });

  it('Vorlieben: keine Doppelungen, „mag“ und „mag nicht“ schließen sich aus', () => {
    const base = { dietType: 'omnivore', mealsPerDay: 3 } as const;
    ok(
      nutritionStepSchema.safeParse({
        ...base,
        foodPreferences: [
          { foodGroup: 'dairy', kind: 'like' },
          { foodGroup: 'dairy', kind: 'intolerance' },
        ],
      }),
    );
    fail(
      nutritionStepSchema.safeParse({
        ...base,
        foodPreferences: [
          { foodGroup: 'fish', kind: 'like' },
          { foodGroup: 'fish', kind: 'dislike' },
        ],
      }),
    );
    fail(
      nutritionStepSchema.safeParse({
        ...base,
        foodPreferences: [{ foodGroup: 'nuts', kind: 'dislike' }],
      }),
    );
    fail(
      nutritionStepSchema.safeParse({
        ...base,
        foodPreferences: [
          { foodGroup: 'soy', kind: 'intolerance' },
          { foodGroup: 'soy', kind: 'intolerance' },
        ],
      }),
    );
  });
});

describe('Kochmodus', () => {
  it('täglich frisch ohne Tage', () => {
    ok(cookingStepSchema.safeParse({ cookingMode: 'daily' }));
    fail(cookingStepSchema.safeParse({ cookingMode: 'daily', mealprepDays: 2 }));
  });

  it('Meal-Prep 1–7 Tage', () => {
    ok(cookingStepSchema.safeParse({ cookingMode: 'meal_prep', mealprepDays: 1 }));
    ok(cookingStepSchema.safeParse({ cookingMode: 'meal_prep', mealprepDays: 7 }));
    fail(cookingStepSchema.safeParse({ cookingMode: 'meal_prep', mealprepDays: 0 }));
    fail(cookingStepSchema.safeParse({ cookingMode: 'meal_prep', mealprepDays: 8 }));
    fail(cookingStepSchema.safeParse({ cookingMode: 'meal_prep' }));
  });
});
