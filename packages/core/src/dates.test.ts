import { describe, expect, it } from 'vitest';

import { addDays, createMeasuredOnSchema } from './dates';

describe('addDays', () => {
  it('über Monats-, Jahres- und Schaltjahresgrenzen', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-03', 0)).toBe('2026-10-03');
    expect(addDays('2026-10-03', -3)).toBe('2026-09-30');
  });

  it('lehnt ungültige Daten ab', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow();
  });
});

describe('createMeasuredOnSchema', () => {
  const schema = createMeasuredOnSchema('2026-12-31');

  it('erlaubt bis einen Tag nach heute (auch über den Jahreswechsel)', () => {
    expect(schema.safeParse('2026-12-31').success).toBe(true);
    expect(schema.safeParse('2027-01-01').success).toBe(true);
    expect(schema.safeParse('2027-01-02').success).toBe(false);
  });

  it('erlaubt die Vergangenheit ab 1900', () => {
    expect(schema.safeParse('1900-01-01').success).toBe(true);
    expect(schema.safeParse('1899-12-31').success).toBe(false);
  });
});
