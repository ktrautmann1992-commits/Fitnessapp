import { describe, expect, it } from 'vitest';

import { recommendSupplements, supplementResult } from './eligibility';
import {
  caffeineDailyLimitMg,
  caffeinePersonalDailyLimitMg,
  caffeinePersonalLimitMg,
  caffeineSingleLimit,
  formatSupplementDose,
  proteinServingG,
  supplementDose,
  vitaminDIuToUg,
  vitaminDUgToIu,
} from './dosage';
import { renderSupplementNotice } from './notices';
import { supplementTestInputs as base } from './test-helpers';

describe('Koffein-Grenze je Einnahme (Plan 3.5): min(3 mg/kg, 200 mg), auf 10 mg abgerundet', () => {
  it.each([
    [30, 90],
    [40, 120],
    [45, 130],
    [66.6, 190],
    [66.7, 200],
    [200 / 3, 200],
    [70, 200],
    [150, 200],
    [300, 200],
  ])('%s kg → %s mg', (weightKg, mg) => {
    expect(caffeineSingleLimit(weightKg)).toEqual({ kind: 'mg', mg });
  });

  it('ohne Gewicht: Tassen-Satz statt Zahl', () => {
    expect(caffeineSingleLimit(null)).toEqual({ kind: 'cups', cups: { min: 1, max: 2 } });
    expect(renderSupplementNotice('caffeine_single_general')).toBe(
      'Höchstens 1–2 Tassen Kaffee auf einmal.',
    );
  });

  it('Gewicht außerhalb 30–300 kg → Fehler', () => {
    expect(() => caffeineSingleLimit(29.9)).toThrow();
    expect(() => caffeineSingleLimit(Number.NaN)).toThrow();
  });

  it('persönliche Grenze nur im Modus „personal“ (nicht bei ab 18, aus, Schwangerschaft, allgemein)', () => {
    const personal = recommendSupplements(base({ weightKg: 40 })).caffeine;
    expect(caffeinePersonalLimitMg(personal, 40)).toBe(120);
    expect(renderSupplementNotice('caffeine_single_personal', { dose: '120 mg' })).toBe(
      'Höchstens 120 mg Koffein auf einmal.',
    );
    for (const overrides of [
      { birthDate: '2009-05-01' },
      { supplementFlags: ['caffeine_sensitive' as const] },
      { healthFlags: ['pregnancy' as const, 'conservative_plan' as const] },
      { supplementFlags: ['kidney' as const] },
    ]) {
      const caffeine = recommendSupplements(base(overrides)).caffeine;
      expect(caffeinePersonalLimitMg(caffeine, 70)).toBeNull();
    }
  });
});

describe('Koffein-Tagesgrenze persönlich (Wächter SU1, Befund 3): min(5,7 mg/kg, 400 mg), abgerundet', () => {
  it.each([
    [30, 170],
    [40, 220],
    [70, 390],
    [100, 400],
    [300, 400],
  ])('%s kg → %s mg am Tag', (weightKg, mg) => {
    expect(caffeineDailyLimitMg(weightKg)).toBe(mg);
  });

  it('nur im Modus „personal“; Text nennt die niedrigere Grenze, sonst 400 mg', () => {
    const personal = recommendSupplements(base({ weightKg: 40 })).caffeine;
    expect(caffeinePersonalDailyLimitMg(personal, 40)).toBe(220);
    expect(renderSupplementNotice('caffeine_daily', { dailyMg: 220 })).toContain(
      'Insgesamt höchstens 220 mg am Tag',
    );
    expect(renderSupplementNotice('caffeine_daily', { dailyMg: 400 })).toContain('400 mg');
    expect(renderSupplementNotice('caffeine_daily')).toContain('400 mg');
    const general = recommendSupplements(base({ weightKg: null })).caffeine;
    expect(caffeinePersonalDailyLimitMg(general, null)).toBeNull();
    const excluded = recommendSupplements(
      base({ supplementFlags: ['caffeine_sensitive'] }),
    ).caffeine;
    expect(caffeinePersonalDailyLimitMg(excluded, 70)).toBeNull();
    expect(() => caffeineDailyLimitMg(29)).toThrow();
  });
});

describe('Dosis je Supplement (Plan 3.5)', () => {
  const result = recommendSupplements(
    base({ dietType: 'vegan', proteinGap: true, goalType: 'muscle_gain' }),
  );

  it('Kreatin 3 g täglich, Proteinpulver 20–30 g Eiweiß je Portion, Omega-3 250–500 mg, Vitamin D 20 µg (800 IE)', () => {
    expect(formatSupplementDose(supplementDose(supplementResult(result, 'creatine'))!)).toBe('3 g');
    expect(supplementDose(supplementResult(result, 'protein_powder'))).toMatchObject({
      min: 20,
      max: 30,
      per: 'serving',
    });
    expect(formatSupplementDose(supplementDose(supplementResult(result, 'omega3'))!)).toBe(
      '250–500 mg',
    );
    const vitaminD = supplementDose(supplementResult(result, 'vitamin_d'))!;
    expect(vitaminD.general).toBe(true);
    expect(formatSupplementDose(vitaminD)).toBe('20 µg (800 IE)');
  });

  it('keine Dosis bei Info (außer Vitamin-D-Richtwert), „ab 18“ und „Nicht für dich“', () => {
    const minor = recommendSupplements(base({ birthDate: '2009-05-01' }));
    expect(supplementDose(supplementResult(minor, 'creatine'))).toBeNull();
    expect(supplementDose(supplementResult(minor, 'omega3'))).toBeNull();
    const pregnant = recommendSupplements(
      base({ healthFlags: ['pregnancy', 'conservative_plan'] }),
    );
    for (const item of pregnant.items) expect(supplementDose(item)).toBeNull();
    const info = recommendSupplements(base({ goalType: 'fat_loss' }));
    expect(supplementDose(supplementResult(info, 'creatine'))).toBeNull();
  });

  it('Proteinportion nie über das Tagesziel hinaus (auf 5 g abgerundet)', () => {
    expect(proteinServingG(null)).toEqual({ min: 20, max: 30 });
    expect(proteinServingG(80)).toEqual({ min: 20, max: 30 });
    expect(proteinServingG(30)).toEqual({ min: 20, max: 30 });
    expect(proteinServingG(27)).toEqual({ min: 20, max: 25 });
    expect(proteinServingG(12)).toEqual({ min: 10, max: 10 });
    expect(proteinServingG(4.9)).toBeNull();
    expect(proteinServingG(-10)).toBeNull();
  });

  it('Einheiten: 1 µg = 40 IE und zurück', () => {
    expect(vitaminDUgToIu(20)).toBe(800);
    expect(vitaminDIuToUg(800)).toBe(20);
    expect(vitaminDIuToUg(1000)).toBe(25);
    expect(() => vitaminDUgToIu(-1)).toThrow();
  });
});
