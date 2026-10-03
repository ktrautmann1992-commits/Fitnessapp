import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES } from './enums';
import {
  EQUIPMENT,
  EQUIPMENT_IDS,
  findEquipment,
  HOME_SELECTABLE_EQUIPMENT,
  isHomeSelectable,
} from './equipment';

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
