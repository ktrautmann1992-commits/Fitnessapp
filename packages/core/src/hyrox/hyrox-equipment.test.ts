import { describe, expect, it } from 'vitest';

import type { Exercise } from '../content/schemas';
import {
  EQUIPMENT,
  GYM_OPTIONAL_EQUIPMENT_IDS,
  HOME_SELECTABLE_EQUIPMENT,
  isOptionalAid,
  requiredEquipmentIds,
} from '../equipment';
import {
  equipmentProfile,
  isBodyweightOnly,
  isExerciseFeasible,
  isStrengthEquipment,
} from '../plan/equipment-profile';
import { library } from '../plan/competition-test-helpers';
import type { WorkoutStep } from '../plan/intensity';
import { filterWorkouts, EMPTY_WORKOUT_FILTER, workoutTileSummary } from '../workouts/library';
import { gymHyroxEquipmentIds, gymHyroxFromRows, hyroxTravelStationNames } from './equipment';
import { hyroxStationSession } from './stations';
import { HYROX_TEXTS_DE } from './texts';

/**
 * Sportarten Stufe 1 · Restpunkte (27.10.2026): Hyrox-Geräte als echte Geräte (Studio nur mit Angabe), Hilfsmittel
 * Matte/Block (fehlen nie), Reise-Modus der Kombi im Timer.
 */

/** Bibliothek mit den Stations-Übungen an ihren echten Geräten (wie im Inhalte-Branch). */
function libraryWithRealGear(): Map<string, Exercise> {
  const gear: Record<string, string[]> = {
    'hyrox-skierg': ['ski_erg'],
    'hyrox-schlitten-schieben': ['sled'],
    'hyrox-schlitten-ziehen': ['sled'],
    'sandsack-ausfallschritte': ['sandbag'],
    'wall-balls': ['wall_ball'],
  };
  return new Map(
    [...library.exercises].map(([id, e]) => [id, gear[id] ? { ...e, equipment_ids: gear[id] } : e]),
  );
}

describe('Geräte-Katalog: Hyrox-Geräte und Hilfsmittel', () => {
  it('neue Geräte im Katalog; Hyrox-Geräte zu Hause wählbar, Matte/Block nicht (nichts zu wählen)', () => {
    const ids = EQUIPMENT.map((e) => e.id as string);
    for (const id of [...GYM_OPTIONAL_EQUIPMENT_IDS, 'mat', 'yoga_block'])
      expect(ids).toContain(id);
    const home = HOME_SELECTABLE_EQUIPMENT.map((e) => e.id as string);
    for (const id of GYM_OPTIONAL_EQUIPMENT_IDS) expect(home).toContain(id);
    expect(home).not.toContain('mat');
    expect(home).not.toContain('yoga_block');
  });

  it('kein neues Gerät zählt als Kraft-Gerät: nur Sandsack zu Hause → weiter Körpergewicht-Plan', () => {
    for (const id of [...GYM_OPTIONAL_EQUIPMENT_IDS, 'mat', 'yoga_block']) {
      expect(isStrengthEquipment(id), id).toBe(false);
    }
    const home = equipmentProfile('home', [{ equipmentId: 'sandbag', weightsKg: [] }]);
    expect(isBodyweightOnly(home)).toBe(true);
  });

  it('Studio ohne Angabe: keine Hyrox-Geräte (Studio gilt als voll ausgestattet, aber ohne Spezialgeräte)', () => {
    const gym = equipmentProfile('gym', []);
    for (const id of GYM_OPTIONAL_EQUIPMENT_IDS) expect(gym.available.has(id), id).toBe(false);
    expect(gym.available.has('rowing_machine')).toBe(true);
    const withHyrox = equipmentProfile('gym', [], { gymHyroxEquipment: true });
    for (const id of GYM_OPTIONAL_EQUIPMENT_IDS) expect(withHyrox.available.has(id), id).toBe(true);
    // Zu Hause wirkt die Angabe nie – dort zählen nur die eigenen Geräte.
    const home = equipmentProfile('home', [], { gymHyroxEquipment: true });
    expect(home.available.size).toBe(0);
  });

  it('Matte und Block fehlen nie (Ersatz Handtuch/Kissen), andere Geräte schon', () => {
    const nothing = equipmentProfile('home', []);
    expect(isExerciseFeasible({ equipment_ids: ['mat'] }, nothing)).toBe(true);
    expect(isExerciseFeasible({ equipment_ids: ['mat', 'yoga_block'] }, nothing)).toBe(true);
    expect(isExerciseFeasible({ equipment_ids: ['mat', 'dumbbells'] }, nothing)).toBe(false);
    expect(isOptionalAid('mat')).toBe(true);
    expect(isOptionalAid('sled')).toBe(false);
    expect(requiredEquipmentIds(['mat', 'yoga_block', 'resistance_bands'])).toEqual([
      'resistance_bands',
    ]);
  });

  it('Workout-Filter „ohne Geräte“ behält Routinen mit Matte/Block', () => {
    const base = {
      status: 'published' as const,
      difficulty: 1,
      minutes: 15,
      category: 'yoga' as const,
      title_de: 'A',
    };
    const workouts = [
      { ...base, id: 'a', equipment_ids: ['mat', 'yoga_block'] },
      { ...base, id: 'b', title_de: 'B', equipment_ids: ['resistance_bands'] },
      { ...base, id: 'c', title_de: 'C', equipment_ids: [] },
    ];
    const shown = filterWorkouts(workouts as never, { ...EMPTY_WORKOUT_FILTER, noEquipment: true });
    expect(shown.map((w) => (w as { id: string }).id)).toEqual(['a', 'c']);
    expect(workoutTileSummary(workouts as never, [], '2026-10-27').withoutEquipment).toBe(2);
  });
});

describe('„Hyrox-Geräte im Studio“', () => {
  it('aus den Geräte-Zeilen: nur Ort Studio zählt', () => {
    expect(gymHyroxFromRows([])).toBe(false);
    expect(gymHyroxFromRows([{ equipment_id: 'sled', location: 'home' }])).toBe(false);
    expect(gymHyroxFromRows([{ equipment_id: 'rowing_machine', location: 'gym' }])).toBe(false);
    expect(gymHyroxFromRows([{ equipment_id: 'wall_ball', location: 'gym' }])).toBe(true);
    expect(gymHyroxEquipmentIds(true)).toEqual(GYM_OPTIONAL_EQUIPMENT_IDS);
    expect(gymHyroxEquipmentIds(false)).toEqual([]);
  });

  it('mit Angabe bekommt das Studio die echten Stationen; ohne Angabe Ersatz mit Hinweis', () => {
    const lib = libraryWithRealGear();
    const base = {
      library: lib,
      excludedCautionTags: [] as const,
      level: 'advanced' as const,
      phase: 'peak' as const,
      cautious: false,
      rpeMax: 9,
      minutes: 120,
    };
    const without = hyroxStationSession({
      ...base,
      available: equipmentProfile('gym', []).available,
    });
    expect(without.exercises.map((e) => e.exercise_id)).not.toContain('hyrox-schlitten-schieben');
    expect(without.replaced).toContain('sled_push');
    const withGear = hyroxStationSession({
      ...base,
      available: equipmentProfile('gym', [], { gymHyroxEquipment: true }).available,
    });
    const ids = withGear.exercises.map((e) => e.exercise_id);
    expect(ids).toContain('hyrox-schlitten-schieben');
    expect(withGear.replaced).not.toContain('sled_push');
    expect(withGear.replaced).not.toContain('wall_balls');
  });

  it('zu Hause mit eigenem Schlitten: echte Station auch ohne Studio-Angabe', () => {
    const session = hyroxStationSession({
      library: libraryWithRealGear(),
      excludedCautionTags: [],
      level: 'advanced',
      phase: 'peak',
      cautious: false,
      rpeMax: 9,
      minutes: 120,
      available: equipmentProfile('home', [{ equipmentId: 'sled', weightsKg: [] }]).available,
    });
    expect(session.exercises.map((e) => e.exercise_id)).toContain('hyrox-schlitten-schieben');
  });
});

describe('Reise-Modus: Kombi als „Lauf + Körpergewicht-Zirkel“', () => {
  const steps: WorkoutStep[] = [
    { part: 'warmup', kind: 'easy', seconds: 480, effort: 2 },
    { part: 'main', kind: 'work', seconds: 300, effort: 7 },
    { part: 'main', kind: 'station', seconds: 120, effort: 7, station: 'wall_balls' },
    { part: 'main', kind: 'work', seconds: 300, effort: 7 },
    { part: 'main', kind: 'station', seconds: 120, effort: 7, station: 'sled_push' },
    { part: 'main', kind: 'station', seconds: 120, effort: 7, station: 'wall_balls' },
    { part: 'cooldown', kind: 'easy', seconds: 240, effort: 2 },
  ];

  it('je Stations-Schritt eine Übung mit den Reise-Geräten; andere Schritte null; gleiche Länge', () => {
    const names = hyroxTravelStationNames(steps, {
      library: libraryWithRealGear(),
      available: new Set(),
      excludedCautionTags: [],
    });
    expect(names).toHaveLength(steps.length);
    expect(names[0]).toBeNull();
    expect(names[1]).toBeNull();
    expect(names[2]).toBe('Kniebeuge mit Körpergewicht');
    expect(names[4]).not.toBeNull();
    expect(names[5]).toBe(names[2]);
  });

  it('ohne passende Übung (leere Bibliothek) → null; Text „locker weiterlaufen“', () => {
    const names = hyroxTravelStationNames(steps, {
      library: new Map(),
      available: new Set(),
      excludedCautionTags: [],
    });
    expect(names.every((n) => n === null)).toBe(true);
    expect(HYROX_TEXTS_DE.travel.step(null)).toBe('Zirkel: locker weiterlaufen');
    expect(HYROX_TEXTS_DE.travel.step('Kniebeuge')).toBe('Zirkel: Kniebeuge');
    expect(HYROX_TEXTS_DE.travel.name).toBe('Lauf + Körpergewicht-Zirkel');
  });

  it('Sicherheitsregeln gelten auch im Zirkel: ohne Sprünge kein Burpee-Ersatz mit Sprung', () => {
    const names = hyroxTravelStationNames(
      [{ part: 'main', kind: 'station', seconds: 120, effort: 7, station: 'burpee_broad_jumps' }],
      { library: library.exercises, available: new Set(), excludedCautionTags: ['high_impact'] },
    );
    expect(names[0]).not.toBe('Burpee-Weitsprung');
  });
});
