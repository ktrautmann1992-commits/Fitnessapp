import { describe, expect, it } from 'vitest';

import { GOAL_TYPES } from '../enums';
import {
  enduranceCarbsGPerKg,
  type MacroInputs,
  nutritionMacros,
  proteinReferenceWeight,
} from './macros';

function macros(overrides: Partial<MacroInputs> = {}) {
  return nutritionMacros({
    targetKcal: 2500,
    goalType: 'general_fitness',
    weightKg: 80,
    heightCm: 180,
    proteinMin: 0,
    proteinCap: 2.2,
    trainingMinutes: 0,
    ...overrides,
  });
}

const energy = (m: { proteinG: number; carbsG: number; fatG: number }) =>
  4 * m.proteinG + 4 * m.carbsG + 9 * m.fatG;

describe('Makros (4.7)', () => {
  it('Eiweiß je Ziel (g/kg), Fett 25 %, Kohlenhydrate = Rest', () => {
    const m = macros({ goalType: 'fat_loss' });
    expect(m.proteinG).toBe(160); // 2,0 × 80
    expect(m.fatG).toBe(70); // 25 % von 2.500 = 69,4 g → 70
    expect(m.carbsG).toBe(Math.round((2500 - 640 - 630) / 4 / 5) * 5);
    expect(Math.abs(energy(m) - 2500)).toBeLessThanOrEqual(10);
    expect(m.notices).toEqual(['protein_kidney_notice']);
  });

  it('Referenzgewicht bei BMI ≥ 30: 200 kg/190 cm → Eiweiß ≈ 180 g statt 400 g', () => {
    expect(proteinReferenceWeight(200, 190)).toBeCloseTo(90.25, 9);
    expect(proteinReferenceWeight(80, 180)).toBe(80);
    const m = macros({ goalType: 'fat_loss', weightKg: 200, heightCm: 190, targetKcal: 3600 });
    expect(m.proteinG).toBe(180); // 2,0 × 90,25 = 180,5 → 180
  });

  it('Deckel: unter 18/Medikamente/kein Check ≤ 1,6 g/kg (floor), ab 65 1,2–1,6 g/kg', () => {
    const capped = macros({ goalType: 'definition', proteinCap: 1.6, weightKg: 77 });
    expect(capped.proteinG).toBeLessThanOrEqual(1.6 * 77);
    expect(capped.proteinG % 5).toBe(0);
    expect(capped.notices).not.toContain('protein_kidney_notice');
    const senior = macros({
      goalType: 'general_fitness',
      proteinMin: 1.2,
      proteinCap: 1.6,
      weightKg: 71,
    });
    expect(senior.proteinG).toBe(100); // 1,4 × 71 = 99,4 → 100 (im Bereich 85,2–113,6)
    const seniorHigh = macros({
      goalType: 'definition',
      proteinMin: 1.2,
      proteinCap: 1.6,
      weightKg: 71,
    });
    expect(seniorHigh.proteinG).toBe(110); // 1,6 × 71 = 113,6 → floor 110 (nicht 115)
  });

  it('Nierenhinweis erst über 1,6 g/kg', () => {
    expect(macros({ goalType: 'muscle_gain' }).notices).toContain('protein_kidney_notice'); // 1,8
    expect(macros({ goalType: 'general_fitness' }).notices).not.toContain('protein_kidney_notice'); // 1,4
  });

  it('W13: 1.100 und 5.000 kcal – Abweichung ≤ 10 kcal, Untergrenzen Eiweiß/Fett eingehalten', () => {
    for (const targetKcal of [1100, 1110, 1730, 5000]) {
      for (const goalType of GOAL_TYPES) {
        for (const [weightKg, heightCm] of [
          [45, 150],
          [30, 150],
          [80, 180],
          [200, 190],
          [300, 250],
        ] as const) {
          for (const [proteinMin, proteinCap] of [
            [0, 2.2],
            [0, 1.6],
            [1.2, 1.6],
          ] as const) {
            const m = macros({
              targetKcal,
              goalType,
              weightKg,
              heightCm,
              proteinMin,
              proteinCap,
              trainingMinutes: 180,
            });
            expect(Math.abs(energy(m) - targetKcal)).toBeLessThanOrEqual(10);
            expect(9 * m.fatG).toBeGreaterThanOrEqual(0.2 * targetKcal - 1e-9);
            // Eiweiß-Untergrenze gilt, solange sie neben dem Mindestfett ins Tagesziel passt (Energie verbindlich)
            const energyMax = (targetKcal - 9 * Math.ceil((0.2 * targetKcal) / 9 / 5) * 5) / 4;
            expect(m.proteinG).toBeGreaterThanOrEqual(
              Math.min(proteinMin * m.referenceWeightKg, energyMax) - 5,
            );
            if (proteinMin * m.referenceWeightKg <= energyMax) {
              expect(m.proteinG).toBeGreaterThanOrEqual(proteinMin * m.referenceWeightKg - 1e-9);
            }
            expect(m.proteinG).toBeLessThanOrEqual(proteinCap * m.referenceWeightKg + 1e-9);
            expect(m.carbsG).toBeGreaterThanOrEqual(0);
            for (const g of [m.proteinG, m.fatG, m.carbsG]) expect(g % 5).toBe(0);
          }
        }
      }
    }
  });

  it('R2-K1: Kohlenhydrat-Rest < 130 g → Fett auf 20 %, dann Eiweiß bis 1,6 g/kg, danach nur Hinweis (kein ceil)', () => {
    const m = macros({ targetKcal: 1100, goalType: 'definition', weightKg: 60, heightCm: 165 });
    // 1,6 × 60 = 96 g; Fett 20 % = 24,4 g → 25 g; Rest (1.100 − 384 − 225) / 4 = 122,75 → 125
    expect(m.proteinGPerKg).toBeCloseTo(1.6, 9);
    expect(m.fatG).toBe(25);
    expect(m.carbsG).toBe(125);
    expect(m.notices).toEqual(['carbs_below_reference']);
    expect(Math.abs(energy(m) - 1100)).toBeLessThanOrEqual(10);
  });

  it('Eiweiß wird nur so weit gesenkt, wie für 130 g nötig', () => {
    const m = macros({ targetKcal: 1600, goalType: 'definition', weightKg: 80, heightCm: 180 });
    // Fett 20 % = 320 kcal; 2,2 × 80 = 176 g = 704 kcal → Rest 144 g ≥ 130 → Eiweiß bleibt
    expect(m.proteinGPerKg).toBeCloseTo(2.2, 9);
    expect(m.notices).not.toContain('carbs_below_reference');
  });

  it('Ausdauer: Richtwert nach Minuten (< 60: 3, 60–120: 5, > 120: 6 g/kg), Fett bis 20 %, sonst Hinweis', () => {
    expect(enduranceCarbsGPerKg(0)).toBe(3);
    expect(enduranceCarbsGPerKg(59)).toBe(3);
    expect(enduranceCarbsGPerKg(60)).toBe(5);
    expect(enduranceCarbsGPerKg(120)).toBe(5);
    expect(enduranceCarbsGPerKg(121)).toBe(6);
    expect(enduranceCarbsGPerKg(240)).toBe(6);
    const longDay = macros({
      goalType: 'endurance',
      targetKcal: 3500,
      weightKg: 70,
      heightCm: 178,
      trainingMinutes: 240,
    });
    // 6 × 70 = 420 g gewünscht; Eiweiß 98 g; Fett so weit gesenkt, wie nötig (nicht unter 20 %)
    expect(longDay.carbsG).toBeGreaterThanOrEqual(415);
    expect(9 * longDay.fatG).toBeGreaterThanOrEqual(0.2 * 3500);
    const tooLow = macros({
      goalType: 'endurance',
      targetKcal: 2400,
      weightKg: 70,
      heightCm: 178,
      trainingMinutes: 240,
    });
    expect(tooLow.notices).toContain('endurance_carbs_below_target');
    expect(9 * tooLow.fatG).toBeGreaterThanOrEqual(0.2 * 2400);
    expect(Math.abs(energy(tooLow) - 2400)).toBeLessThanOrEqual(10);
  });

  it('ungültige Eingaben werden abgelehnt', () => {
    expect(() => macros({ targetKcal: 0 })).toThrow();
    expect(() => macros({ proteinCap: 3 })).toThrow();
    expect(() => macros({ proteinMin: 1.8, proteinCap: 1.6 })).toThrow();
  });
});
