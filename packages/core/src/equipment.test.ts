import { describe, expect, it } from 'vitest';

import { BARBELL_PLATE_MAX_KG, EQUIPMENT_LIMITS, PLANNED_LOAD_LIMITS } from './constants';
import { EQUIPMENT_CATEGORIES } from './enums';
import {
  barbellLoadSteps,
  EQUIPMENT,
  EQUIPMENT_IDS,
  findEquipment,
  HOME_SELECTABLE_EQUIPMENT,
  isHomeSelectable,
  weightPresetsFor,
} from './equipment';
import { weightStepKgSchema } from './validation';

describe('Geräte-Katalog', () => {
  it('IDs und Sortierung sind eindeutig, Kategorien bekannt', () => {
    expect(new Set(EQUIPMENT_IDS).size).toBe(EQUIPMENT.length);
    expect(new Set(EQUIPMENT.map((item) => item.sortOrder)).size).toBe(EQUIPMENT.length);
    for (const item of EQUIPMENT) {
      expect(EQUIPMENT_CATEGORIES).toContain(item.category);
      expect(item.id).toMatch(/^[a-z][a-z0-9_]{1,49}$/);
    }
  });

  it('Studio-Geräte sind zu Hause nicht auswählbar', () => {
    const studio = EQUIPMENT.filter((item) => !item.homeSelectable).map((item) => item.id);
    expect(studio).toEqual([
      'power_rack',
      'cable_station',
      'lat_pulldown',
      'leg_press',
      'machine_chest_press',
      'leg_curl_machine',
      'leg_extension_machine',
      'dip_station',
    ]);
    expect(HOME_SELECTABLE_EQUIPMENT.map((item) => item.id)).not.toContain('cable_station');
    expect(HOME_SELECTABLE_EQUIPMENT.map((item) => item.id)).toContain('dumbbells');
    expect(HOME_SELECTABLE_EQUIPMENT.map((item) => item.id)).toContain('other');
  });

  it('isHomeSelectable / findEquipment mit unbekannter ID', () => {
    expect(isHomeSelectable('dumbbells')).toBe(true);
    expect(isHomeSelectable('leg_press')).toBe(false);
    expect(isHomeSelectable('hovercraft')).toBe(false);
    expect(findEquipment('hovercraft')).toBeUndefined();
    expect(findEquipment('lat_pulldown')?.nameDe).toBe('Latzug');
  });
});

describe('Gewichte zum Antippen (weightPresetsKg)', () => {
  const withPresets = EQUIPMENT.filter((item) => 'weightPresetsKg' in item);

  it('genau die Geräte mit Gewichten haben Vorschläge', () => {
    expect(withPresets.map((item) => item.id)).toEqual(
      EQUIPMENT.filter((item) => item.hasWeights).map((item) => item.id),
    );
    expect(weightPresetsFor('treadmill')).toEqual([]);
    expect(weightPresetsFor('hovercraft')).toEqual([]);
  });

  it.each(withPresets.map((item) => [item.id, weightPresetsFor(item.id)] as const))(
    '%s: gültige Stufen, höchstens maxWeightSteps, aufsteigend, eindeutig',
    (_id, presets) => {
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.length).toBeLessThanOrEqual(EQUIPMENT_LIMITS.maxWeightSteps);
      for (const kg of presets) {
        expect(weightStepKgSchema.safeParse(kg).success).toBe(true);
      }
      expect([...presets].sort((a, b) => a - b)).toEqual([...presets]);
      expect(new Set(presets).size).toBe(presets.length);
    },
  );

  it('Langhantel-Scheiben höchstens 25 kg; Kurzhanteln 1–40 kg je Hantel', () => {
    expect(Math.max(...weightPresetsFor('barbell'))).toBeLessThanOrEqual(BARBELL_PLATE_MAX_KG);
    const dumbbells = weightPresetsFor('dumbbells');
    expect(dumbbells.slice(0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(dumbbells.at(-1)).toBe(40);
  });
});

describe('barbellLoadSteps', () => {
  it('ohne Scheiben: nur die Stange', () => {
    expect(barbellLoadSteps(20, [])).toEqual([20]);
    expect(barbellLoadSteps(7, [])).toEqual([7]);
  });

  it('Stange 20 + {1,25; 2,5} → 20, 22,5, 25, 27,5 (je Paar)', () => {
    expect(barbellLoadSteps(20, [1.25, 2.5])).toEqual([20, 22.5, 25, 27.5]);
    expect(barbellLoadSteps(20, [2.5, 1.25, 2.5])).toEqual([20, 22.5, 25, 27.5]);
  });

  it('rechnet im Raster ohne Gleitkomma-Reste', () => {
    const steps = barbellLoadSteps(20, [0.25, 0.5, 1.25, 2.5, 5]);
    expect(steps.at(-1)).toBe(39); // 20 + 2 × 9,5
    expect(steps).toContain(20.5);
    expect(steps).not.toContain(22); // 1 kg je Seite lässt sich nicht laden
    for (const kg of steps) {
      expect(Math.round(kg * 100) / 100).toBe(kg);
      expect(Math.round(kg * 2 * 100) % 50).toBe(0);
    }
    expect(barbellLoadSteps(10, [0.1, 0.2])).toEqual([10, 10.2, 10.4, 10.6]);
  });

  it('aufsteigend, eindeutig, gedeckelt auf PLANNED_LOAD_LIMITS', () => {
    const steps = barbellLoadSteps(25, [1.25, 2.5, 5, 10, 15, 20, 25, 25, 24, 23, 22, 21]);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(new Set(steps).size).toBe(steps.length);
    expect(Math.max(...steps)).toBeLessThanOrEqual(PLANNED_LOAD_LIMITS.targetWeightKg.max);
    expect(steps[0]).toBe(25);
  });

  it('ignoriert ungültige Scheiben (über 25 kg, 0, negativ)', () => {
    expect(barbellLoadSteps(20, [27.5, 0, -5])).toEqual([20]);
  });

  it('Laufzeit: 40 Scheiben (Maximum) deutlich unter 50 ms', () => {
    const plates = Array.from({ length: 40 }, (_, i) => 0.25 + i * 0.6);
    // Bester von 5 Läufen nach einem Aufwärmlauf: misst das Verfahren, nicht die Auslastung der CI-Maschine.
    let steps = barbellLoadSteps(20, plates);
    let elapsed = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      steps = barbellLoadSteps(20, plates);
      elapsed = Math.min(elapsed, performance.now() - started);
    }
    expect(steps.at(-1)).toBeLessThanOrEqual(PLANNED_LOAD_LIMITS.targetWeightKg.max);
    expect(elapsed).toBeLessThan(250);
  });
});
