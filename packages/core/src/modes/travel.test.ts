import { describe, expect, it } from 'vitest';

import { TRAVEL_MODE } from '../constants';
import { addDays } from '../dates';
import { findEquipment } from '../equipment';
import { TRAVEL_EQUIPMENT_OPTIONS } from '../enums';
import { isStrengthEquipment } from '../plan/equipment-profile';
import {
  currentOrNextTravelMode,
  endTravelMode,
  newTravelMode,
  parseTravelModes,
  travelEquipmentIds,
  type TravelMode,
  travelModeInputSchema,
  travelModeOn,
  travelModeSchema,
  travelOnDay,
  travelOverlaps,
} from './travel';

const TODAY = '2026-10-25';
let n = 0;
function mode(
  starts: string,
  ends: string,
  equipment: TravelMode['equipment'] = 'bodyweight',
  createdAt = `${TODAY}T08:00:00Z`,
): TravelMode {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    starts_on: starts,
    ends_on: ends,
    equipment,
    max_minutes: null,
    created_at: createdAt,
  };
}

describe('Eingabe', () => {
  const schema = travelModeInputSchema(TODAY);
  const ok = { starts_on: TODAY, ends_on: TODAY, equipment: 'bodyweight', max_minutes: null };

  it('ein Tag (heute bis heute) und genau 42 Tage sind erlaubt', () => {
    expect(schema.safeParse(ok).success).toBe(true);
    expect(
      schema.safeParse({ ...ok, ends_on: addDays(TODAY, TRAVEL_MODE.maxDays - 1) }).success,
    ).toBe(true);
  });

  it('43 Tage, Ende vor Beginn, Beginn gestern, mehr als 365 Tage voraus → abgelehnt', () => {
    expect(schema.safeParse({ ...ok, ends_on: addDays(TODAY, TRAVEL_MODE.maxDays) }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...ok, ends_on: addDays(TODAY, -1) }).success).toBe(false);
    expect(schema.safeParse({ ...ok, starts_on: addDays(TODAY, -1), ends_on: TODAY }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...ok, starts_on: addDays(TODAY, 366), ends_on: addDays(TODAY, 366) })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...ok, starts_on: addDays(TODAY, 365), ends_on: addDays(TODAY, 365) })
        .success,
    ).toBe(true);
  });

  it('Minuten nur 20/30/45/60 oder ohne; Geräte nur aus der Liste (kein Markenname)', () => {
    for (const m of TRAVEL_MODE.minutesOptions) {
      expect(schema.safeParse({ ...ok, max_minutes: m }).success).toBe(true);
    }
    expect(schema.safeParse({ ...ok, max_minutes: 25 }).success).toBe(false);
    for (const equipment of TRAVEL_EQUIPMENT_OPTIONS) {
      expect(schema.safeParse({ ...ok, equipment }).success).toBe(true);
    }
    expect(schema.safeParse({ ...ok, equipment: 'trx' }).success).toBe(false);
  });

  it('newTravelMode baut einen gültigen Eintrag; kaputte Einträge fallen beim Lesen weg', () => {
    const m = newTravelMode(
      { starts_on: TODAY, ends_on: addDays(TODAY, 3), equipment: 'band', max_minutes: 30 },
      { id: '00000000-0000-4000-8000-0000000000ff', createdAt: `${TODAY}T10:00:00Z` },
    );
    expect(travelModeSchema.safeParse(m).success).toBe(true);
    expect(parseTravelModes([m, { kaputt: 1 }])).toEqual([m]);
  });
});

describe('Geräte', () => {
  it('jede Auswahl hat Geräte aus dem Katalog; Körpergewicht = keine Geräte', () => {
    for (const option of TRAVEL_EQUIPMENT_OPTIONS) {
      for (const id of travelEquipmentIds(option)) expect(findEquipment(id), id).toBeDefined();
    }
    expect(travelEquipmentIds('bodyweight')).toEqual([]);
    expect(travelEquipmentIds('hotel_gym')).toEqual(
      expect.arrayContaining(['dumbbells', 'flat_bench']),
    );
  });

  it('Schlingentrainer: markenneutral, zu Hause wählbar, (noch) kein Kraft-Gerät → Körpergewicht-Plan', () => {
    const item = findEquipment('suspension_trainer');
    expect(item?.nameDe).toBe('Schlingentrainer');
    expect(item?.homeSelectable).toBe(true);
    expect(isStrengthEquipment('suspension_trainer')).toBe(false);
    expect(travelEquipmentIds('suspension_trainer')).toEqual(['suspension_trainer']);
  });
});

describe('Zeitraum', () => {
  it('wirksam vom ersten bis zum letzten Tag, danach automatisch nicht mehr', () => {
    const m = mode(TODAY, addDays(TODAY, 4));
    expect(travelModeOn([m], addDays(TODAY, -1))).toBeNull();
    expect(travelModeOn([m], TODAY)).toBe(m);
    expect(travelModeOn([m], addDays(TODAY, 4))).toBe(m);
    expect(travelModeOn([m], addDays(TODAY, 5))).toBeNull();
    expect(travelOnDay([m], addDays(TODAY, 5))).toBeNull();
    expect(travelOnDay([m], TODAY)?.until).toBe(addDays(TODAY, 4));
  });

  it('Überschneidung (kaputter Speicher): der zuletzt angelegte gilt', () => {
    const older = mode(TODAY, addDays(TODAY, 4), 'dumbbells', `${TODAY}T08:00:00Z`);
    const newer = mode(TODAY, addDays(TODAY, 2), 'band', `${TODAY}T09:00:00Z`);
    expect(travelModeOn([older, newer], TODAY)).toBe(newer);
    expect(travelModeOn([older, newer], addDays(TODAY, 3))).toBe(older);
  });

  it('travelOverlaps: Randtage zählen, eigener Eintrag wird ignoriert', () => {
    const m = mode(TODAY, addDays(TODAY, 4));
    expect(travelOverlaps([m], { starts_on: addDays(TODAY, 4), ends_on: addDays(TODAY, 8) })).toBe(
      true,
    );
    expect(travelOverlaps([m], { starts_on: addDays(TODAY, 5), ends_on: addDays(TODAY, 8) })).toBe(
      false,
    );
    expect(travelOverlaps([m], m, m.id)).toBe(false);
  });

  it('Banner: laufender Zeitraum vor künftigem; sonst nächster künftiger; abgelaufene nie', () => {
    const past = mode(addDays(TODAY, -10), addDays(TODAY, -5));
    const next = mode(addDays(TODAY, 3), addDays(TODAY, 6));
    const later = mode(addDays(TODAY, 30), addDays(TODAY, 31));
    expect(currentOrNextTravelMode([past, later, next], TODAY)).toBe(next);
    const running = mode(addDays(TODAY, -1), addDays(TODAY, 1));
    expect(currentOrNextTravelMode([next, running], TODAY)).toBe(running);
    expect(currentOrNextTravelMode([past], TODAY)).toBeNull();
  });

  it('vorzeitig beenden: laufend → Ende gestern; künftig → entfernen; vorbei → unverändert', () => {
    const running = mode(addDays(TODAY, -3), addDays(TODAY, 3));
    expect(endTravelMode(running, TODAY)?.ends_on).toBe(addDays(TODAY, -1));
    expect(endTravelMode(mode(TODAY, addDays(TODAY, 3)), TODAY)).toBeNull();
    expect(endTravelMode(mode(addDays(TODAY, 2), addDays(TODAY, 3)), TODAY)).toBeNull();
    const past = mode(addDays(TODAY, -9), addDays(TODAY, -2));
    expect(endTravelMode(past, TODAY)).toBe(past);
  });
});
