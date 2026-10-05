import { describe, expect, it } from 'vitest';

import { makeExercise } from '../content/test-fixtures';
import { CAUTION_TAGS } from '../enums';
import {
  equipmentProfile,
  findHarderVariant,
  findSubstitute,
  isBodyweightOnly,
  isExerciseFeasible,
  isStrengthEquipment,
} from './equipment-profile';
import { isExerciseAllowed, planSafetyRules } from './safety';
import { barbellLoadSteps } from '../equipment';
import { snapToAvailableWeight } from './loads';
import { repoLibrary } from './test-library';

const lib = repoLibrary().exercises;
const get = (id: string) => {
  const exercise = lib.get(id);
  if (!exercise) throw new Error(id);
  return exercise;
};
const DAY = '2026-10-05';
const healthy = planSafetyRules(
  { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
  DAY,
);
const cautious = planSafetyRules(
  { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: null },
  DAY,
);
const gym = equipmentProfile('gym', []);
const nothing = equipmentProfile('home', []);
const bandOnly = equipmentProfile('home', [{ equipmentId: 'resistance_bands', weightsKg: [] }]);
const dumbbellsOnly = equipmentProfile('home', [
  { equipmentId: 'dumbbells', weightsKg: [2, 4, 6] },
]);

describe('equipmentProfile', () => {
  it('Studio = alle Katalog-Geräte außer „Sonstiges“', () => {
    expect(gym.location).toBe('gym');
    expect(gym.available.has('power_rack')).toBe(true);
    expect(gym.available.has('cable_station')).toBe(true);
    expect(gym.available.has('other')).toBe(false);
  });

  it('Zuhause = nur eigene Geräte, Gewichtsstufen sortiert', () => {
    const home = equipmentProfile('home', [
      { equipmentId: 'dumbbells', weightsKg: [6, 2, 4] },
      { equipmentId: 'other', weightsKg: [] },
    ]);
    expect(home.location).toBe('home');
    expect([...home.available]).toEqual(['dumbbells']);
    expect(home.weights.get('dumbbells')).toEqual([2, 4, 6]);
  });

  it('„beides“ = Studio, Heim-Gewichte bleiben bekannt', () => {
    const both = equipmentProfile('both', [{ equipmentId: 'dumbbells', weightsKg: [4] }]);
    expect(both.location).toBe('gym');
    expect(both.available.has('leg_press')).toBe(true);
    expect(both.weights.get('dumbbells')).toEqual([4]);
  });

  it('Körpergewichtsübungen gehen immer', () => {
    expect(isExerciseFeasible(get('liegestuetz'), nothing)).toBe(true);
    expect(isExerciseFeasible(get('goblet-kniebeuge'), nothing)).toBe(false);
  });
});

describe('findSubstitute', () => {
  it('Schritt 1: machbar und erlaubt → bleibt', () => {
    expect(
      findSubstitute(get('kniebeuge-langhantel'), { library: lib, profile: gym, rules: healthy }),
    ).toMatchObject({
      step: 1,
      reason: null,
    });
  });

  it('Gerät fehlt: Goblet-Kniebeuge → Kniebeuge mit Körpergewicht (Grund: Gerät)', () => {
    const result = findSubstitute(get('goblet-kniebeuge'), {
      library: lib,
      profile: nothing,
      rules: healthy,
    });
    expect(result?.exercise.id).toBe('kniebeuge-koerpergewicht');
    expect(result?.reason).toBe('equipment');
    expect(result?.step).toBe(2);
  });

  it('vorsichtig im Studio: Langhantel-Kniebeuge → Goblet-Kniebeuge (Grund: Sicherheit)', () => {
    const result = findSubstitute(get('kniebeuge-langhantel'), {
      library: lib,
      profile: gym,
      rules: cautious,
    });
    expect(result?.exercise.id).toBe('goblet-kniebeuge');
    expect(result?.reason).toBe('safety');
  });

  it('Über-Kopf-Drücken bei vorsichtigem Plan: keine erlaubte Schulter-Alternative → entfällt', () => {
    expect(
      findSubstitute(get('schulterdruecken-kurzhantel'), {
        library: lib,
        profile: gym,
        rules: cautious,
      }),
    ).toBeNull();
  });

  it('ohne Geräte: Rudern und Latziehen → Türrahmen-Rudern (Etappe K1)', () => {
    expect(
      findSubstitute(get('rudern-band'), { library: lib, profile: nothing, rules: healthy })
        ?.exercise.id,
    ).toBe('tuerrahmen-rudern');
    // Latziehen: kein senkrechtes Ziehen ohne Geräte → Schritt 5 (gemeinsamer Hauptmuskel Latissimus).
    const lat = findSubstitute(get('latziehen'), {
      library: lib,
      profile: nothing,
      rules: healthy,
    });
    expect(lat?.exercise.id).toBe('tuerrahmen-rudern');
    expect(lat?.step).toBe(5);
    expect(
      findSubstitute(get('latziehen'), { library: lib, profile: bandOnly, rules: healthy })
        ?.exercise.id,
    ).toBe('latziehen-band');
  });

  it('nur Kurzhanteln: Kabelrudern → Rudern mit Kurzhantel (Alternative der Alternative oder Muster)', () => {
    const result = findSubstitute(get('kabelrudern'), {
      library: lib,
      profile: dumbbellsOnly,
      rules: healthy,
    });
    expect(result?.exercise.equipment_ids.every((id) => id === 'dumbbells')).toBe(true);
    expect(result?.exercise.movement_pattern).toBe('horizontal_pull');
  });

  it('bereits vorhandene Übungen werden nicht doppelt eingesetzt', () => {
    const result = findSubstitute(get('goblet-kniebeuge'), {
      library: lib,
      profile: nothing,
      rules: healthy,
      exclude: new Set(['kniebeuge-koerpergewicht']),
    });
    expect(result?.exercise.id).not.toBe('kniebeuge-koerpergewicht');
  });

  it('Eigenschaft: jeder Ersatz ist machbar, erlaubt, nicht schwerer und gleicher Typ (Wdh./Zeit)', () => {
    const profiles = [gym, nothing, bandOnly, dumbbellsOnly];
    const ruleSets = [
      healthy,
      cautious,
      planSafetyRules(
        {
          experienceLevel: 'advanced',
          birthDate: '1990-01-01',
          healthScreening: { flags: ['pregnancy', 'injury', 'conservative_plan'] },
        },
        DAY,
      ),
    ];
    let checked = 0;
    for (const original of lib.values()) {
      for (const profile of profiles) {
        for (const rules of ruleSets) {
          const result = findSubstitute(original, { library: lib, profile, rules });
          if (!result) continue;
          checked += 1;
          expect(isExerciseFeasible(result.exercise, profile)).toBe(true);
          expect(isExerciseAllowed(result.exercise, rules)).toBe(true);
          expect(result.exercise.difficulty).toBeLessThanOrEqual(original.difficulty);
          expect(result.exercise.load_type === 'time').toBe(original.load_type === 'time');
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('vorsichtig: Alternativen mit Grund „easier“ zuerst', () => {
    const a = makeExercise({ id: 'a-andere', equipment_ids: [], difficulty: 1 });
    const b = makeExercise({ id: 'b-leichter', equipment_ids: [], difficulty: 1 });
    const original = makeExercise({
      id: 'original',
      equipment_ids: ['barbell'],
      difficulty: 2,
      alternatives: [
        { alternative_id: 'a-andere', reason: 'other_equipment', priority: 1 },
        { alternative_id: 'b-leichter', reason: 'easier', priority: 2 },
      ],
    });
    const library = new Map([original, a, b].map((e) => [e.id, e]));
    const ctx = { library, profile: nothing };
    expect(findSubstitute(original, { ...ctx, rules: healthy })?.exercise.id).toBe('a-andere');
    expect(findSubstitute(original, { ...ctx, rules: cautious })?.exercise.id).toBe('b-leichter');
  });

  it('Schritte 3–5: Alternative der Alternative, gleiches Muster, gemeinsamer Hauptmuskel', () => {
    const blocked = makeExercise({
      id: 'zwischen',
      equipment_ids: ['barbell'],
      difficulty: 1,
      alternatives: [{ alternative_id: 'kette', reason: 'home', priority: 1 }],
    });
    const chain = makeExercise({ id: 'kette', equipment_ids: [], difficulty: 1 });
    const original = makeExercise({
      id: 'start',
      equipment_ids: ['barbell'],
      difficulty: 2,
      alternatives: [{ alternative_id: 'zwischen', reason: 'home', priority: 1 }],
    });
    let library = new Map([original, blocked, chain].map((e) => [e.id, e]));
    expect(findSubstitute(original, { library, profile: nothing, rules: healthy })).toMatchObject({
      step: 3,
    });

    const samePattern = makeExercise({ id: 'muster', equipment_ids: [], difficulty: 1 });
    const solo = makeExercise({ id: 'solo', equipment_ids: ['barbell'], difficulty: 2 });
    library = new Map([solo, samePattern].map((e) => [e.id, e]));
    expect(findSubstitute(solo, { library, profile: nothing, rules: healthy })).toMatchObject({
      step: 4,
    });

    const otherPattern = makeExercise({
      id: 'anders',
      movement_pattern: 'lunge',
      equipment_ids: [],
      difficulty: 1,
    });
    library = new Map([solo, otherPattern].map((e) => [e.id, e]));
    expect(findSubstitute(solo, { library, profile: nothing, rules: healthy })).toMatchObject({
      step: 5,
    });

    const harder = makeExercise({ id: 'schwerer', equipment_ids: [], difficulty: 3 });
    library = new Map([solo, harder].map((e) => [e.id, e]));
    expect(findSubstitute(solo, { library, profile: nothing, rules: healthy })).toBeNull();
  });

  it('gefährliche Merkmale werden auch im Ersatz nie gewählt', () => {
    for (const tag of CAUTION_TAGS) {
      const rules = { ...healthy, excludedCautionTags: [tag] };
      for (const original of lib.values()) {
        const result = findSubstitute(original, { library: lib, profile: gym, rules });
        expect(result?.exercise.caution_tags.includes(tag) ?? false).toBe(false);
      }
    }
  });
});

describe('findHarderVariant', () => {
  it('Kniebeuge mit Körpergewicht → Goblet-Kniebeuge, wenn Kurzhanteln da sind', () => {
    expect(
      findHarderVariant(get('kniebeuge-koerpergewicht'), {
        library: lib,
        profile: dumbbellsOnly,
        rules: healthy,
      })?.id,
    ).toBe('goblet-kniebeuge');
    expect(
      findHarderVariant(get('kniebeuge-koerpergewicht'), {
        library: lib,
        profile: nothing,
        rules: healthy,
      })?.id,
    ).toBe('kniebeuge-pause'); // Etappe K1: Kette innerhalb Körpergewicht
  });
});

describe('Langhantel: ladbare Gesamtgewichte (B3-Pflichtpunkt, Erweiterungsplan 4.3)', () => {
  it('Ziel 40 kg mit Stange 20 + {2,5; 5; 10} → 40 (nicht „Scheibe 20“)', () => {
    const profile = equipmentProfile('home', [
      { equipmentId: 'barbell', weightsKg: [10, 2.5, 5], barKg: 20 },
    ]);
    const steps = profile.weights.get('barbell') ?? [];
    expect(steps).toEqual(barbellLoadSteps(20, [2.5, 5, 10]));
    expect(snapToAvailableWeight(40, steps)).toBe(40);
    expect(snapToAvailableWeight(39, steps)).toBe(35);
    expect(snapToAvailableWeight(19, steps)).toBeNull();
  });

  it('ohne Stangen-Angabe gilt 20 kg; SZ-Stange 7 kg', () => {
    const steps = (barKg: number | null) =>
      equipmentProfile('gym', [{ equipmentId: 'barbell', weightsKg: [1.25], barKg }]).weights.get(
        'barbell',
      );
    expect(steps(null)).toEqual([20, 22.5]);
    expect(steps(7)).toEqual([7, 9.5]);
  });

  it('ohne Scheiben: unbekannt (leer); Kurzhanteln je Hantel unverändert', () => {
    const profile = equipmentProfile('home', [
      { equipmentId: 'barbell', weightsKg: [], barKg: 15 },
      { equipmentId: 'dumbbells', weightsKg: [10, 2] },
    ]);
    expect(profile.weights.get('barbell')).toEqual([]);
    expect(profile.weights.get('dumbbells')).toEqual([2, 10]);
  });
});

describe('Körpergewicht-Profil (docs/PLAN-KOERPERGEWICHT.md §5.1, A6)', () => {
  it('Kraft-Geräte: alles außer Ausdauer-Geräten und Klimmzugstange; Unbekanntes zählt vorsichtig mit', () => {
    for (const id of [
      'treadmill',
      'bike_ergometer',
      'rowing_machine',
      'pull_up_bar',
      'flat_bench',
      'incline_bench',
      'dip_station',
      'other',
    ]) {
      expect(isStrengthEquipment(id), id).toBe(false);
    }
    for (const id of [
      'dumbbells',
      'barbell',
      'kettlebells',
      'resistance_bands',
      'power_rack',
      'cable_station',
      'leg_press',
    ]) {
      expect(isStrengthEquipment(id), id).toBe(true);
    }
    expect(isStrengthEquipment('gibt-es-nicht')).toBe(true);
  });

  it('isBodyweightOnly: Zuhause ohne Kraft-Geräte; Studio nie', () => {
    const home = (ids: string[]) =>
      equipmentProfile(
        'home',
        ids.map((equipmentId) => ({ equipmentId, weightsKg: [] })),
      );
    expect(isBodyweightOnly(nothing)).toBe(true);
    expect(isBodyweightOnly(home(['treadmill', 'bike_ergometer', 'rowing_machine']))).toBe(true);
    expect(isBodyweightOnly(home(['pull_up_bar']))).toBe(true);
    expect(isBodyweightOnly(home(['other']))).toBe(true);
    // W2: Bänke sind keine lastgebenden Kraft-Geräte.
    expect(isBodyweightOnly(home(['flat_bench']))).toBe(true);
    expect(isBodyweightOnly(home(['incline_bench', 'pull_up_bar']))).toBe(true);
    expect(isBodyweightOnly(home(['flat_bench', 'dumbbells']))).toBe(false);
    expect(isBodyweightOnly(home(['pull_up_bar', 'resistance_bands']))).toBe(false);
    expect(isBodyweightOnly(bandOnly)).toBe(false);
    expect(isBodyweightOnly(dumbbellsOnly)).toBe(false);
    expect(isBodyweightOnly(gym)).toBe(false);
    expect(isBodyweightOnly(equipmentProfile('both', []))).toBe(false);
  });
});
