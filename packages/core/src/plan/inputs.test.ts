import { describe, expect, it } from 'vitest';

import { planInputsSchema, planInputsSnapshot } from './inputs';
import { person } from './test-library';

describe('planInputsSchema', () => {
  it('gültige Person', () => {
    expect(planInputsSchema.safeParse(person()).success).toBe(true);
  });

  it.each([
    ['0 Tage', { sessionsPerWeek: 0 }],
    ['8 Tage', { sessionsPerWeek: 8 }],
    ['9 Minuten', { minutesPerSession: 9 }],
    ['241 Minuten', { minutesPerSession: 241 }],
    ['doppelter Wochentag', { preferredDays: [1, 1] }],
    ['Wochentag 8', { preferredDays: [8] }],
    ['Disziplin ohne Ausdauer', { discipline: '5k' as const }],
    ['unbekanntes Gerät', { homeEquipment: [{ equipmentId: 'laser' as never, weightsKg: [] }] }],
    [
      'doppeltes Gerät',
      {
        homeEquipment: [
          { equipmentId: 'dumbbells' as const, weightsKg: [] },
          { equipmentId: 'dumbbells' as const, weightsKg: [] },
        ],
      },
    ],
    ['unbekanntes Flag', { healthScreening: { flags: ['krank' as never] } }],
    ['Körpergewicht ist kein Eingabefeld', { weightKg: 80 } as never],
  ])('lehnt ab: %s', (_label, overrides) => {
    expect(planInputsSchema.safeParse(person(overrides)).success).toBe(false);
  });

  it('Snapshot ohne Gesundheitsdaten und Geburtsdatum, Listen sortiert', () => {
    const snapshot = planInputsSnapshot(
      planInputsSchema.parse(
        person({
          preferredDays: [5, 1, 3],
          trainingLocation: 'home',
          homeEquipment: [
            { equipmentId: 'resistance_bands', weightsKg: [] },
            { equipmentId: 'dumbbells', weightsKg: [6, 2] },
          ],
          healthScreening: { flags: ['pregnancy'] },
        }),
      ),
    );
    expect(snapshot.preferredDays).toEqual([1, 3, 5]);
    expect(snapshot.homeEquipment.map((e) => e.equipmentId)).toEqual([
      'dumbbells',
      'resistance_bands',
    ]);
    expect(snapshot.homeEquipment[0]?.weightsKg).toEqual([2, 6]);
    expect(JSON.stringify(snapshot)).not.toMatch(/pregnancy|healthScreening|birthDate|1996/);
  });
});
