import { describe, expect, it } from 'vitest';

import {
  createBodyMeasurementsInputSchema,
  isMeasurementDue,
  MEASUREMENT_SITES,
  nextMeasurementDue,
} from './body-measurements';
import { BODY_MEASUREMENT_LIMITS } from './constants';

const bodyMeasurementsInputSchema = createBodyMeasurementsInputSchema('2026-10-03');

describe('MEASUREMENT_SITES', () => {
  it('hat 11 Messstellen mit eindeutigen IDs, Namen und Anleitung', () => {
    expect(MEASUREMENT_SITES).toHaveLength(11);
    expect(new Set(MEASUREMENT_SITES.map((s) => s.id)).size).toBe(11);
    expect(new Set(MEASUREMENT_SITES.map((s) => s.column)).size).toBe(11);
    for (const site of MEASUREMENT_SITES) {
      expect(site.nameDe.length).toBeGreaterThan(0);
      expect(site.instructionDe.length).toBeGreaterThan(20);
    }
  });
});

describe('bodyMeasurementsInputSchema', () => {
  it('verlangt mindestens einen Wert', () => {
    expect(bodyMeasurementsInputSchema.safeParse({}).success).toBe(false);
    expect(bodyMeasurementsInputSchema.safeParse({ waistCm: null }).success).toBe(false);
    expect(bodyMeasurementsInputSchema.safeParse({ waistCm: 82 }).success).toBe(true);
  });

  it.each(
    MEASUREMENT_SITES.map((site) => [site.id, BODY_MEASUREMENT_LIMITS[site.limitKey]] as const),
  )('%s: Grenzen genau erlaubt, knapp daneben abgelehnt', (id, { min, max }) => {
    expect(bodyMeasurementsInputSchema.safeParse({ [id]: min }).success).toBe(true);
    expect(bodyMeasurementsInputSchema.safeParse({ [id]: max }).success).toBe(true);
    expect(bodyMeasurementsInputSchema.safeParse({ [id]: min - 0.1 }).success).toBe(false);
    expect(bodyMeasurementsInputSchema.safeParse({ [id]: max + 0.1 }).success).toBe(false);
  });

  it('Messdatum: Vergangenheit, heute und morgen erlaubt, übermorgen nicht', () => {
    for (const measuredOn of ['2020-01-01', '2026-10-03', '2026-10-04']) {
      expect(bodyMeasurementsInputSchema.safeParse({ waistCm: 80, measuredOn }).success).toBe(true);
    }
    expect(
      bodyMeasurementsInputSchema.safeParse({ waistCm: 80, measuredOn: '2026-10-05' }).success,
    ).toBe(false);
    expect(
      bodyMeasurementsInputSchema.safeParse({ waistCm: 80, measuredOn: '1899-12-31' }).success,
    ).toBe(false);
  });

  it('lehnt unbekannte Felder und ungültiges Datum ab', () => {
    expect(bodyMeasurementsInputSchema.safeParse({ neckCm: 40 }).success).toBe(false);
    expect(
      bodyMeasurementsInputSchema.safeParse({ waistCm: 80, measuredOn: '03.10.2026' }).success,
    ).toBe(false);
  });
});

describe('nextMeasurementDue', () => {
  it('Standard: 28 Tage später', () => {
    expect(nextMeasurementDue('2026-10-03')).toBe('2026-10-31');
  });

  it('Grenzen 7 und 90 Tage', () => {
    expect(nextMeasurementDue('2026-10-03', 7)).toBe('2026-10-10');
    expect(nextMeasurementDue('2026-10-03', 90)).toBe('2027-01-01');
  });

  it('lehnt Intervalle außerhalb von 7–90 Tagen und Bruchteile ab', () => {
    expect(() => nextMeasurementDue('2026-10-03', 6)).toThrow();
    expect(() => nextMeasurementDue('2026-10-03', 91)).toThrow();
    expect(() => nextMeasurementDue('2026-10-03', 7.5)).toThrow();
  });

  it('über Monats-, Jahres- und Schaltjahresgrenzen', () => {
    expect(nextMeasurementDue('2028-02-22', 7)).toBe('2028-02-29');
    expect(nextMeasurementDue('2027-02-22', 7)).toBe('2027-03-01');
    expect(nextMeasurementDue('2026-12-20', 28)).toBe('2027-01-17');
  });

  it('unabhängig von Sommerzeit (Ende März)', () => {
    expect(nextMeasurementDue('2027-03-20', 14)).toBe('2027-04-03');
  });

  it('lehnt ungültige Daten ab', () => {
    expect(() => nextMeasurementDue('2026-02-30')).toThrow();
  });
});

describe('isMeasurementDue', () => {
  it('fällig am Stichtag und danach, nicht davor', () => {
    expect(isMeasurementDue('2026-10-31', '2026-10-30')).toBe(false);
    expect(isMeasurementDue('2026-10-31', '2026-10-31')).toBe(true);
    expect(isMeasurementDue('2026-10-31', '2027-01-01')).toBe(true);
  });
});
