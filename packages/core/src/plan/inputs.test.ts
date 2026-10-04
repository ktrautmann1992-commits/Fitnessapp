import { describe, expect, it } from 'vitest';

import { planInputsSchema, planInputsSnapshot } from './inputs';
import { person } from './test-library';

describe('planInputsSchema', () => {
  it('gültige Person', () => {
    expect(planInputsSchema.safeParse(person()).success).toBe(true);
  });

  it.each([
    ['0 Tage', { sessionsPerWeek: 0, preferredDays: [] }],
    ['8 Tage', { sessionsPerWeek: 8, preferredDays: [] }],
    ['9 Minuten', { minutesPerSession: 9 }],
    ['241 Minuten', { minutesPerSession: 241 }],
    ['doppelter Wochentag', { sessionsPerWeek: 2, preferredDays: [1, 1] }],
    ['Wochentag 8', { sessionsPerWeek: 1, preferredDays: [8] }],
    [
      'gemischter Modus',
      {
        schedule: {
          mode: 'fixed' as const,
          slots: [{ kind: 'endurance' as const, minutes: 30 }] as never,
        },
      },
    ],
    [
      'Stange bei Kurzhanteln',
      { homeEquipment: [{ equipmentId: 'dumbbells' as const, barKg: 20 }] },
    ],
    [
      'Langhantel-Scheibe 27,5',
      { homeEquipment: [{ equipmentId: 'barbell' as const, weightsKg: [27.5] }] },
    ],
    ['Stange 4 kg', { homeEquipment: [{ equipmentId: 'barbell' as const, barKg: 4 }] }],
    ['alter Schlüssel sessionsPerWeek', { sessionsPerWeek: 3, schedule: undefined } as never],
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
    const input = person(overrides);
    expect(planInputsSchema.safeParse(input).success).toBe(false);
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
            { equipmentId: 'barbell', weightsKg: [5, 1.25], barKg: 15 },
          ],
          healthScreening: { flags: ['pregnancy'] },
        }),
      ),
    );
    expect(snapshot.schedule).toEqual({
      mode: 'fixed',
      slots: [1, 3, 5].map((weekday) => ({ weekday, kind: 'strength_home', minutes: 60 })),
    });
    expect(snapshot.trainingLocation).toBe('home');
    expect(snapshot.homeEquipment.map((e) => e.equipmentId)).toEqual([
      'barbell',
      'dumbbells',
      'resistance_bands',
    ]);
    expect(snapshot.homeEquipment[0]).toEqual({
      equipmentId: 'barbell',
      weightsKg: [1.25, 5],
      barKg: 15,
    });
    expect(snapshot.homeEquipment[1]).toEqual({
      equipmentId: 'dumbbells',
      weightsKg: [2, 6],
      barKg: null,
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/pregnancy|healthScreening|birthDate|1996/);
  });

  it('Snapshot: „Tage egal“ sortiert, nur Ausdauer → Ort null', () => {
    const snapshot = planInputsSnapshot(
      planInputsSchema.parse(
        person({
          schedule: {
            mode: 'flex',
            slots: [
              { kind: 'endurance', minutes: 30 },
              { kind: 'endurance', minutes: 45 },
            ],
          },
        }),
      ),
    );
    expect(snapshot.schedule.slots.map((s) => s.minutes)).toEqual([45, 30]);
    expect(snapshot.trainingLocation).toBeNull();
  });
});
