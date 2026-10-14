import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyGoalAdjustment,
  type CalorieLimitContext,
  calorieLimitContextSchema,
  ceilTo,
  clampCalorieAdjustment,
  clampCalorieTarget,
  dayCeilingKcal,
  dayFloorKcal,
  floorTo,
  planBand,
  roundWithin,
} from './limits';

/** Kontext mit BMR 1.101,5 (Frau 45 kg/150 cm/25 J.), sitzend, Ruhetag. */
function ctx(overrides: Partial<CalorieLimitContext> = {}): CalorieLimitContext {
  const bmr = 1101.5;
  return {
    bmrForFloor: bmr,
    baseNeeds: bmr * 1.45,
    needs: bmr * 1.45,
    limitNeeds: bmr * 1.45,
    weightKg: 45,
    ffmKg: 30,
    trainingGrossKcal: 0,
    trainingCapped: false,
    mode: 'full',
    goalIsSurplus: false,
    deficitCap: 0.25,
    surplusCap: 0.1,
    ...overrides,
  };
}

describe('Gerichtete Rundung (4.6.2, B2, W1)', () => {
  it('BMR 1.101,5, Ziel genau BMR → 1.110 (nicht 1.100)', () => {
    expect(roundWithin(1101.5, 1101.5, 2000, 10)).toBe(1110);
  });

  it('kaufmännisch, solange im Bereich; über der Obergrenze abrunden', () => {
    expect(roundWithin(1504, 1400, 1600, 10)).toBe(1500);
    expect(roundWithin(1596, 1400, 1596.5, 10)).toBe(1590);
    expect(roundWithin(1596.5, 1400, 1596.5, 10)).toBe(1590);
  });

  it('kein Vielfaches im Bereich → ceil der Untergrenze (Sicherheit geht vor)', () => {
    expect(roundWithin(1101.5, 1101.5, 1105, 10)).toBe(1110);
    expect(roundWithin(1104, 1101.5, 1105, 10)).toBe(1110);
  });

  it('nie unter der ungerundeten Untergrenze, auch bei winzigen Gleitkomma-Resten (K5)', () => {
    expect(roundWithin(1100.000000001, 1100.000000001, 2000, 10)).toBe(1110);
    expect(roundWithin(1100, 1100, 2000, 10)).toBe(1100);
  });

  it('ceil/floor robust gegen Gleitkomma-Reste', () => {
    expect(ceilTo(1910.0000000000002, 10)).toBe(1910);
    expect(floorTo(1909.9999999999998, 10)).toBe(1910);
  });
});

describe('Untergrenzen (4.6 Nr. 1–4)', () => {
  it('Ziel genau BMR / 1 kcal darunter → gerundet nie unter dem ungerundeten BMR', () => {
    // Faktor 1,0 ist im Kontext nicht erlaubt – deshalb hier über den Defizitdeckel: 25 % von 1,45 × BMR.
    const c = ctx();
    for (const proposed of [1101.5, 1100.5, 900]) {
      const r = clampCalorieTarget(proposed, c);
      expect(r.targetKcal).toBeGreaterThanOrEqual(1101.5 * 1.45 * 0.75);
      expect(r.targetKcal).toBeGreaterThanOrEqual(1101.5);
    }
  });

  it('Defizit genau 25 % bleibt, 25,1 % wird auf 25 % begrenzt (deficit_cap)', () => {
    const c = ctx({
      weightKg: 200,
      ffmKg: 30,
      bmrForFloor: 2000,
      baseNeeds: 2900,
      needs: 2900,
      limitNeeds: 2900,
    });
    const exact = clampCalorieTarget(2900 * 0.75, c);
    expect(exact.unroundedKcal).toBeCloseTo(2175, 9);
    expect(exact.appliedCaps).toEqual([]);
    const over = clampCalorieTarget(2900 * 0.749, c);
    expect(over.unroundedKcal).toBeCloseTo(2175, 9);
    expect(over.targetKcal).toBeGreaterThanOrEqual(2175);
    expect(over.appliedCaps).toContain('deficit_cap');
  });

  it('−1 %/Woche bei 45 kg und 200 kg', () => {
    // 45 kg: 0,01 × 45 × 7700 / 7 = 495 kcal/Tag; 200 kg: 2.200 kcal/Tag
    const light = dayFloorKcal(ctx());
    expect(light.parts.weeklyLoss).toBeCloseTo(1101.5 * 1.45 - 495, 9);
    const heavy = dayFloorKcal(
      ctx({
        weightKg: 200,
        bmrForFloor: 2892.5,
        baseNeeds: 4194.125,
        needs: 4194.125,
        limitNeeds: 4194.125,
      }),
    );
    expect(heavy.parts.weeklyLoss).toBeCloseTo(4194.125 - 2200, 9);
    // Bei 200 kg greift die 1-%-Grenze nie vor dem 25-%-Deckel – Maximum aller Untergrenzen
    expect(heavy.kcal).toBeCloseTo(Math.max(2892.5, 4194.125 * 0.75, 4194.125 - 2200, 30 * 30), 9);
  });

  it('1-%-Grenze greift bei hohem Bedarf und geringem Gewicht (weekly_loss_cap)', () => {
    const c = ctx({
      weightKg: 45,
      bmrForFloor: 1500,
      baseNeeds: 2175,
      needs: 4000,
      limitNeeds: 4000,
      trainingGrossKcal: 0,
    });
    const r = clampCalorieTarget(1000, c);
    // 45 kg: 495 kcal/Tag < 25 % von 4.000 (1.000) → die 1-%-Grenze ist strenger
    expect(r.floorKcal).toBeCloseTo(4000 - 495, 9);
    expect(r.appliedCaps).toEqual(['weekly_loss_cap']);
    const c2 = ctx({
      weightKg: 30,
      bmrForFloor: 1000,
      baseNeeds: 1450,
      needs: 1450,
      limitNeeds: 1450,
    });
    // 30 kg: 330 kcal/Tag < 25 % von 1.450 (362,5) → die 1-%-Grenze ist strenger
    const r2 = clampCalorieTarget(500, c2);
    expect(r2.floorKcal).toBeCloseTo(1450 - 330, 9);
    expect(r2.appliedCaps).toContain('weekly_loss_cap');
  });

  it('EA-Untergrenze: min(TagesbedarfGrenze, 30 × FFM + brutto) – nie Überschuss erzwungen', () => {
    const c = ctx({
      ffmKg: 64.4,
      trainingGrossKcal: 1960,
      bmrForFloor: 1761,
      baseNeeds: 2553,
      needs: 4233,
      limitNeeds: 4233,
      weightKg: 70,
    });
    const floor = dayFloorKcal(c);
    expect(floor.parts.energyAvailability).toBeCloseTo(30 * 64.4 + 1960, 9);
    const r = clampCalorieTarget(3723, c);
    expect(r.appliedCaps).toContain('energy_availability_cap');
    expect(r.targetKcal).toBeGreaterThanOrEqual(30 * 64.4 + 1960);
    const huge = dayFloorKcal(ctx({ ffmKg: 200, trainingGrossKcal: 5000 }));
    expect(huge.parts.energyAvailability).toBeCloseTo(1101.5 * 1.45, 9);
  });

  it('maintenance_only und gedeckelte Trainingsenergie: kein Defizit', () => {
    expect(dayFloorKcal(ctx({ mode: 'maintenance_only' })).kcal).toBeCloseTo(1101.5 * 1.45, 9);
    const capped = clampCalorieTarget(100, ctx({ trainingCapped: true }));
    expect(capped.floorKcal).toBeCloseTo(1101.5 * 1.45, 9);
    expect(capped.appliedCaps).toContain('training_energy_capped');
    expect(capped.appliedCaps).not.toContain('deficit_cap');
  });
});

describe('Obergrenze in jedem Modus (H3)', () => {
  it('Überschuss: Tagesbedarf + min(Deckel × Grundbedarf, 0,5 % KG/Woche), abgerundet', () => {
    const c = ctx({
      goalIsSurplus: true,
      weightKg: 80,
      bmrForFloor: 1780,
      baseNeeds: 2581,
      needs: 2581,
      limitNeeds: 2581,
    });
    // 0,005 × 80 × 7700 / 7 = 440; 0,10 × 2581 = 258,1
    expect(dayCeilingKcal(c)).toBeCloseTo(2581 + 258.1, 9);
    const r = clampCalorieTarget(5000, c);
    expect(r.targetKcal).toBe(2830); // 2.839,1 → round 2.840 > Obergrenze → floor 2.830
    expect(r.appliedCaps).toEqual(['gain_cap']);
  });

  it('Überschuss bei leichtem Gewicht: 0,5 %/Woche ist strenger', () => {
    const c = ctx({
      goalIsSurplus: true,
      weightKg: 30,
      bmrForFloor: 1500,
      baseNeeds: 2175,
      needs: 2175,
      limitNeeds: 2175,
    });
    expect(dayCeilingKcal(c)).toBeCloseTo(2175 + 165, 9);
  });

  it('ohne Überschuss: TagesbedarfGrenze × (1 + surplusCap)', () => {
    expect(dayCeilingKcal(ctx())).toBeCloseTo(1101.5 * 1.45 * 1.1, 9);
    expect(dayCeilingKcal(ctx({ surplusCap: 0.05 }))).toBeCloseTo(1101.5 * 1.45 * 1.05, 9);
    expect(
      dayCeilingKcal(ctx({ mode: 'maintenance_only', goalIsSurplus: true, surplusCap: 0.05 })),
    ).toBeCloseTo(1101.5 * 1.45 * 1.05, 9);
  });

  it('Obergrenze nie unter der Untergrenze (die Untergrenze gewinnt)', () => {
    const c = ctx({
      goalIsSurplus: true,
      needs: 1450,
      baseNeeds: 1450,
      limitNeeds: 2539.675,
      bmrForFloor: 1751.5,
      weightKg: 100,
      deficitCap: 0,
    });
    expect(dayCeilingKcal(c)).toBeCloseTo(2539.675, 9);
    const r = clampCalorieTarget(5000, c);
    expect(r.targetKcal).toBe(2540);
    expect(r.band.min).toBeLessThanOrEqual(r.band.max);
  });
});

describe('Kontext kann keine Grenze lockern', () => {
  it('Defizitdeckel > 25 %, Überschussdeckel außerhalb [0,05; 0,10], Bedarf für Grenzen < Tagesbedarf → Fehler', () => {
    expect(() => calorieLimitContextSchema.parse(ctx({ deficitCap: 0.3 }))).toThrow();
    expect(() => calorieLimitContextSchema.parse(ctx({ surplusCap: 0 }))).toThrow();
    expect(() => calorieLimitContextSchema.parse(ctx({ surplusCap: 0.2 }))).toThrow();
    expect(() => calorieLimitContextSchema.parse(ctx({ limitNeeds: 1000 }))).toThrow();
    expect(() =>
      calorieLimitContextSchema.parse(
        ctx({ limitNeeds: 1101.5 * 1.2, needs: 1000, baseNeeds: 1000 }),
      ),
    ).toThrow();
    expect(() => clampCalorieTarget(Number.NaN, ctx())).toThrow();
    expect(() =>
      clampCalorieTarget(1500, { ...ctx(), extra: true } as CalorieLimitContext),
    ).toThrow();
  });
});

describe('Planband (4.6.1, B1)', () => {
  it('Toleranz nach unten durch die Untergrenze begrenzt', () => {
    expect(planBand(1110, 1101.5, 2000)).toEqual({ min: 1101.5, max: 1221 });
    expect(planBand(2000, 1500, 2100)).toEqual({ min: 1800, max: 2100 });
  });

  it('nie leer, auch wenn Ziel = ceil10(Untergrenze) über der Obergrenze liegt', () => {
    const band = planBand(1110, 1101.5, 1101.5);
    expect(band.min).toBeLessThanOrEqual(band.max);
  });

  it('Mindestbreite 20 kcal (Wächter N3 S1): nur nach oben aufgeweitet, Untergrenze bleibt', () => {
    expect(planBand(1110, 1101.5, 1101.5)).toEqual({ min: 1101.5, max: 1121.5 });
    expect(planBand(2000, 1995, 2005)).toEqual({ min: 1995, max: 2015 });
    // Breites Band unverändert.
    expect(planBand(2000, 1500, 2100)).toEqual({ min: 1800, max: 2100 });
  });
});

describe('Zielanpassung (4.5)', () => {
  it('Startwerte je Ziel; maintenance_only immer 0', () => {
    expect(applyGoalAdjustment('fat_loss', 'beginner', 'full')).toBe(-0.2);
    expect(applyGoalAdjustment('definition', 'advanced', 'full')).toBe(-0.1);
    expect(applyGoalAdjustment('muscle_gain', 'beginner', 'full')).toBe(0.1);
    expect(applyGoalAdjustment('muscle_gain', 'advanced', 'full')).toBe(0.05);
    expect(applyGoalAdjustment('muscle_gain', 'competitive', 'full')).toBe(0.05);
    expect(applyGoalAdjustment('general_fitness', 'beginner', 'full')).toBe(0);
    expect(applyGoalAdjustment('endurance', 'beginner', 'full')).toBe(0);
    expect(applyGoalAdjustment('fat_loss', 'beginner', 'maintenance_only')).toBe(0);
    expect(applyGoalAdjustment('muscle_gain', 'beginner', 'maintenance_only')).toBe(0);
  });
});

describe('clampCalorieAdjustment – nur Schrittweite und Summe (R2-S5, W23)', () => {
  it('Schritt genau 150 bleibt, 151 wird auf 150 begrenzt (in beide Richtungen)', () => {
    expect(clampCalorieAdjustment(0, 150)).toBe(150);
    expect(clampCalorieAdjustment(0, 151)).toBe(150);
    expect(clampCalorieAdjustment(0, -150)).toBe(-150);
    expect(clampCalorieAdjustment(0, -151)).toBe(-150);
    expect(clampCalorieAdjustment(-200, -500)).toBe(-350);
  });

  it('Summe genau ±1.000 bleibt, darüber wird begrenzt', () => {
    expect(clampCalorieAdjustment(900, 1000)).toBe(1000);
    expect(clampCalorieAdjustment(950, 1100)).toBe(1000);
    expect(clampCalorieAdjustment(-900, -1000)).toBe(-1000);
    expect(clampCalorieAdjustment(-1000, -1150)).toBe(-1000);
    expect(clampCalorieAdjustment(5000, 5000)).toBe(1000);
  });

  it('hat keinen Grenzen-Kontext (genau zwei Zahlen) und lehnt ungültige Zahlen ab', () => {
    expect(clampCalorieAdjustment.length).toBe(2);
    expect(() => clampCalorieAdjustment(Number.NaN, 0)).toThrow();
    expect(() => clampCalorieAdjustment(0, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('Struktur (Wächter N1, K2): Schutzgrenzen nur über nutritionTargetsForWeek', () => {
  it('clampCalorieTarget/dayFloorKcal/dayCeilingKcal werden außerhalb limits.ts/targets.ts (und der Ampel) nirgends aufgerufen', () => {
    const root = join(import.meta.dirname, '../../../..');
    const allowed = new Set([
      join(root, 'packages/core/src/nutrition/limits.ts'),
      join(root, 'packages/core/src/nutrition/targets.ts'),
      // Erreichbarkeits-Ampel (docs/PLAN-ZIELE.md 3.1): ruft clampCalorieTarget nur AUF, um die Kapazität mit
      // denselben Grenzen wie die Engine zu rechnen – keine eigenen Grenzen (Wächter S1, S6).
      join(root, 'packages/core/src/goals/weight-goal-feasibility.ts'),
    ]);
    const skip = new Set(['node_modules', 'dist', 'build', '.expo', '.next', '.turbo', 'coverage']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name) || entry.name.startsWith('.')) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          if (allowed.has(path)) continue;
          if (
            /\b(clampCalorieTarget|dayFloorKcal|dayCeilingKcal)\s*\(/.test(
              readFileSync(path, 'utf8'),
            )
          ) {
            offenders.push(path);
          }
        }
      }
    };
    for (const top of ['packages', 'apps', 'scripts']) walk(join(root, top));
    expect(offenders).toEqual([]);
  });
});

describe('Struktur (Wächter N1 K2, erweitert in N3, N9, N11 und N13): Essensplan, Tausch, Portionsfaktor und Reste rechnen keine eigenen Grenzen', () => {
  it('Schutzgrenzen-Konstanten und planBand nur in limits/eligibility/schemas (nicht in Plan, Meal-Prep, Liste, Suche)', () => {
    const root = join(import.meta.dirname, '../../../..');
    const allowed = new Set(
      [
        'constants.ts',
        'nutrition/limits.ts',
        'nutrition/eligibility.ts',
        'nutrition/schemas.ts',
      ].map((file) => join(root, 'packages/core/src', file)),
    );
    const pattern =
      /\b(MAX_CALORIE_DEFICIT_FRACTION|MIN_INTAKE_RELATIVE_TO_BMR|MAX_WEEKLY_WEIGHT_LOSS_FRACTION|MAX_WEEKLY_WEIGHT_GAIN_FRACTION|EA_MIN_KCAL_PER_KG_FFM|SPECIAL_CASE_DEFICIT_CAPS|SURPLUS_CAP|PORTION_TOLERANCE|PLAN_BAND_MIN_WIDTH_KCAL)\b|\bplanBand\s*\(/;
    const skip = new Set(['node_modules', 'dist', 'build', '.expo', '.next', '.turbo', 'coverage']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(entry.name) || entry.name.startsWith('.')) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          if (!allowed.has(path) && pattern.test(readFileSync(path, 'utf8'))) offenders.push(path);
        }
      }
    };
    for (const top of ['packages', 'apps', 'scripts']) walk(join(root, top));
    expect(offenders).toEqual([]);
    // Die N3-Dateien (und der Zutaten-Austausch aus N9, 19.8 Nr. 1, sowie die Bewertung aus N10, K6) gibt es wirklich
    // (sonst prüft der Test nichts); dazu die Kühlschrank-Suche aus N11 (nur Reihenfolge und Auswahl, keine Grenzen).
    for (const file of [
      'meal-plan.ts',
      'meal-prep.ts',
      'meal-prep-plan.ts',
      'scale.ts',
      'filter.ts',
      'substitute.ts',
      'swap-resolve.ts',
      'ratings.ts',
      'fridge-search.ts',
      'shopping-list-share.ts',
      // N13 (19.8 Nr. 1): Portionsfaktor und Reste – nur Planband über den Tagesausgleich, keine eigenen Grenzen.
      'portion-factor.ts',
      'leftovers.ts',
    ]) {
      expect(
        readFileSync(join(root, 'packages/core/src/nutrition', file), 'utf8').length,
      ).toBeGreaterThan(0);
    }
  });

  it('N13: Portionsfaktor und Reste lesen weder Planband noch Unter-/Obergrenze noch Ziel-kcal direkt (nur über mealTargetKcal und den Ausgleich in meal-plan.ts)', () => {
    const root = join(import.meta.dirname, '../../../..');
    for (const file of ['portion-factor.ts', 'leftovers.ts']) {
      const source = readFileSync(join(root, 'packages/core/src/nutrition', file), 'utf8');
      expect(source).not.toMatch(/\b(floorKcal|ceilingKcal|tdeeKcal|bmrKcal|targetKcal)\b/);
      // Wächter N13 S6: auch `band.min`, `(band.min + band.max)`, `day.band`, `mealPlanBand(…)`.
      expect(source).not.toMatch(/\b(band|mealPlanBand|planBand)\b/);
    }
  });
});
