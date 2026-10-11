import { describe, expect, it } from 'vitest';

import { nutritionTargetsForWeek } from '@fitnessapp/core';

import {
  NUTRITION_EXAMPLE_PERSONS,
  NUTRITION_EXAMPLE_WEEK,
  renderNutritionExamples,
} from './nutrition-examples';

const weekOf = (key: string) => {
  const person = NUTRITION_EXAMPLE_PERSONS.find((p) => p.key === key)!;
  return nutritionTargetsForWeek(person.inputs, NUTRITION_EXAMPLE_WEEK);
};

describe('Beispiel-Ernährung (CI-Zusammenfassung, Plan 15 N1)', () => {
  it('Tabelle für jede Person A–H', () => {
    const markdown = renderNutritionExamples();
    for (const person of NUTRITION_EXAMPLE_PERSONS)
      expect(markdown).toContain(`### ${person.name}`);
    expect(NUTRITION_EXAMPLE_PERSONS.map((p) => p.key)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
  });

  it('B (45 kg) liegt nie unter ihrem Grundumsatz 1.101,5', () => {
    for (const day of weekOf('B').days) expect(day.targetKcal!).toBeGreaterThanOrEqual(1101.5);
  });

  it('D (16 J.) hat kein Defizit', () => {
    for (const day of weekOf('D').days) {
      expect(day.mode).toBe('maintenance_only');
      expect(day.targetKcal!).toBeGreaterThanOrEqual(day.tdeeKcal! - 1);
    }
  });

  it('E (Schwangerschaft) hat keine Kalorienzahl, nur Hinweise', () => {
    for (const day of weekOf('E').days) {
      expect(day.targetKcal).toBeNull();
      expect(day.notices).toContain('pregnancy_no_targets');
    }
    expect(renderNutritionExamples()).toContain('keine Zahl');
  });

  it('F: am langen Lauftag mehr Kohlenhydrate und Hinweis Energieverfügbarkeit', () => {
    const days = weekOf('F').days;
    const saturday = days[5]!;
    expect(saturday.notices).toContain('energy_availability_cap');
    expect(saturday.carbsG!).toBeGreaterThan(days[6]!.carbsG!);
    expect(saturday.notices).toContain('long_session_fueling');
  });

  it('G (kein Check, weiblich): kein Defizit, Hinweis Gesundheits-Check', () => {
    for (const day of weekOf('G').days) {
      expect(day.mode).toBe('maintenance_only');
      expect(day.notices).toContain('health_check_missing');
    }
  });

  it('H (Frau 100 kg, KF 50 %) hat am Ruhetag 1.910 kcal', () => {
    for (const day of weekOf('H').days) expect(day.targetKcal).toBe(1910);
    expect(renderNutritionExamples()).toContain('1.910 kcal');
  });
});
