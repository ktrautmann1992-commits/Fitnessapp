import { describe, expect, it } from 'vitest';

import {
  createCycleEntryDateSchema,
  cycleEntryPayloadSchema,
  cycleEntrySchema,
  cycleSettingsSchema,
  defaultCycleSettings,
  hasAnyValue,
} from './schemas';

describe('Zod: Tages-Check und Einstellungen (Plan 5)', () => {
  it('nimmt einen vollständigen und einen minimalen Eintrag an', () => {
    expect(
      cycleEntryPayloadSchema.safeParse({
        bleeding: 'heavy',
        energy: 1,
        symptoms: { cramps: 'strong', headache: 'mild' },
        sleep: 5,
      }).success,
    ).toBe(true);
    expect(cycleEntryPayloadSchema.safeParse({ energy: 3 }).success).toBe(true);
    expect(cycleEntryPayloadSchema.safeParse({ bleeding: 'none' }).success).toBe(true);
  });

  it('lehnt leeren Eintrag, unbekannte Felder und falsche Werte ab', () => {
    expect(cycleEntryPayloadSchema.safeParse({}).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: null, symptoms: {} }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: 3, note: 'x' }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: 6 }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: 0 }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: 2.5 }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ energy: '3' }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ symptoms: { acne: 'mild' } }).success).toBe(false);
    expect(cycleEntryPayloadSchema.safeParse({ symptoms: { cramps: 'medium' } }).success).toBe(
      false,
    );
    expect(cycleEntryPayloadSchema.safeParse({ bleeding: 'very_heavy' }).success).toBe(false);
    expect(cycleEntrySchema.safeParse({ date: '2026-02-30', payload: { energy: 3 } }).success).toBe(
      false,
    );
  });

  it('Datum: nie in der Zukunft, höchstens 60 Tage zurück', () => {
    const schema = createCycleEntryDateSchema('2026-10-21');
    expect(schema.safeParse('2026-10-21').success).toBe(true);
    expect(schema.safeParse('2026-10-22').success).toBe(false);
    expect(schema.safeParse('2026-08-22').success).toBe(true);
    expect(schema.safeParse('2026-08-21').success).toBe(false);
  });

  it('hasAnyValue', () => {
    expect(hasAnyValue({})).toBe(false);
    expect(hasAnyValue({ sleep: 2 })).toBe(true);
    expect(hasAnyValue({ symptoms: { nausea: 'mild' } })).toBe(true);
  });

  it('Einstellungen: Standard ist gültig, alles Optionale aus, unbekannte Felder abgelehnt', () => {
    const defaults = defaultCycleSettings();
    expect(cycleSettingsSchema.parse(defaults)).toEqual(defaults);
    expect(defaults).toMatchObject({ sleepTracking: false, reminder: { enabled: false } });
    expect(cycleSettingsSchema.safeParse({ ...defaults, contraceptive: 'x' }).success).toBe(false);
    expect(
      cycleSettingsSchema.safeParse({ ...defaults, reminder: { enabled: true, time: '25:00' } })
        .success,
    ).toBe(false);
    expect(
      cycleSettingsSchema.safeParse({ ...defaults, dismissed: { W1: '2026-10-01' } }).success,
    ).toBe(true);
    expect(
      cycleSettingsSchema.safeParse({ ...defaults, dismissed: { W9: '2026-10-01' } }).success,
    ).toBe(false);
  });
});
