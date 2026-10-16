import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { ENDURANCE_DISCIPLINES } from '../enums';
import {
  COMPETITION_DISCIPLINES,
  competitionInputSchema,
  competitionOwnStartSchema,
  competitionSchema,
  competitionWindowSchema,
  isCompetitionDiscipline,
  latestRaceDate,
} from './competition-schema';

// Feste Erwartungen (Plan 3.2/3.4/5) – bewusst nicht aus constants.ts.
const TODAY = '2026-10-16';
const base = { name: 'Stadtlauf', discipline: 'half_marathon', raceDate: '2027-03-14' } as const;
const reference = { discipline: '10k', timeS: 55 * 60, date: '2026-09-20' } as const;

describe('competitionInputSchema', () => {
  it('Standard: Ziel „Ankommen“, keine Zielzeit, keine Referenz', () => {
    expect(competitionInputSchema.parse(base)).toEqual({
      ...base,
      goal: 'finish',
      targetTimeS: null,
      reference: null,
    });
  });

  it('strikt: unbekannte Felder werden abgelehnt (z. B. Ort – kein Standort im Wettkampf)', () => {
    expect(competitionInputSchema.safeParse({ ...base, location: 'Berlin' }).success).toBe(false);
  });

  it('Name 1–80 Zeichen (getrimmt)', () => {
    expect(competitionInputSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...base, name: 'A' }).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...base, name: 'x'.repeat(80) }).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...base, name: 'x'.repeat(81) }).success).toBe(false);
    expect(competitionInputSchema.parse({ ...base, name: '  Lauf  ' }).name).toBe('Lauf');
  });

  it('nur Laufen 5 km bis Marathon (W-G2) – Rad und Triathlon erst mit WP5', () => {
    expect([...COMPETITION_DISCIPLINES]).toEqual(['5k', '10k', 'half_marathon', 'marathon']);
    for (const d of ENDURANCE_DISCIPLINES) {
      const ok = competitionInputSchema.safeParse({ ...base, discipline: d }).success;
      expect(ok, d).toBe(['5k', '10k', 'half_marathon', 'marathon'].includes(d));
      expect(isCompetitionDiscipline(d)).toBe(ok);
    }
  });

  it('Zielzeit nur beim Ziel „Zielzeit“ und nur mit Referenzzeit (W-G6)', () => {
    const time = { ...base, goal: 'time', targetTimeS: 2 * 3600, reference };
    expect(competitionInputSchema.safeParse(time).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...time, reference: null }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...time, targetTimeS: null }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...base, targetTimeS: 7200 }).success).toBe(false);
    // Referenz ohne Zielzeit ist erlaubt (später für Pace-Richtwerte, WP2).
    expect(competitionInputSchema.safeParse({ ...base, reference }).success).toBe(true);
  });

  it.each([
    ['5k', 12 * 60, 90 * 60],
    ['10k', 26 * 60, 3 * 3600],
    ['half_marathon', 55 * 60, 6 * 3600],
    ['marathon', 2 * 3600, 8 * 3600],
  ] as const)('Zielzeit plausibel je Distanz: %s %i–%i s (± 1 s)', (discipline, min, max) => {
    const at = (targetTimeS: number) =>
      competitionInputSchema.safeParse({
        ...base,
        discipline,
        goal: 'time',
        targetTimeS,
        reference,
      }).success;
    expect(at(min - 1)).toBe(false);
    expect(at(min)).toBe(true);
    expect(at(max)).toBe(true);
    expect(at(max + 1)).toBe(false);
    expect(at(min + 0.5)).toBe(false);
  });

  it('Referenzzeit: Distanz aus der Liste, plausible Zeit, strikt', () => {
    const at = (r: unknown) => competitionInputSchema.safeParse({ ...base, reference: r }).success;
    expect(at({ ...reference, timeS: 25 * 60 })).toBe(false);
    expect(at({ ...reference, discipline: 'cycling' })).toBe(false);
    expect(at({ ...reference, heartRate: 150 })).toBe(false);
    expect(at({ ...reference, date: '2026-02-30' })).toBe(false);
  });
});

describe('competitionWindowSchema (ohne Mindestvorlauf)', () => {
  const schema = competitionWindowSchema(TODAY);
  const at = (raceDate: string) => schema.safeParse({ ...base, raceDate }).success;

  it('Renntag nach heute bis heute + 52 Wochen', () => {
    expect(latestRaceDate(TODAY)).toBe(addDays(TODAY, 364));
    expect(at(TODAY)).toBe(false);
    expect(at(addDays(TODAY, -1))).toBe(false);
    expect(at(addDays(TODAY, 1))).toBe(true);
    expect(at(addDays(TODAY, 364))).toBe(true);
    expect(at(addDays(TODAY, 365))).toBe(false);
  });

  it('Referenzzeit nicht in der Zukunft, höchstens 6 Monate (183 Tage) alt', () => {
    const ref = (date: string) =>
      schema.safeParse({ ...base, reference: { ...reference, date } }).success;
    expect(ref(TODAY)).toBe(true);
    expect(ref(addDays(TODAY, 1))).toBe(false);
    expect(ref(addDays(TODAY, -183))).toBe(true);
    expect(ref(addDays(TODAY, -184))).toBe(false);
  });
});

describe('competitionSchema (mit Mindestvorlauf)', () => {
  const schema = competitionSchema({ today: TODAY, minimumLeadWeeks: () => 16 });
  it('genau am Mindestvorlauf gültig, 1 Tag darunter nicht', () => {
    expect(schema.safeParse({ ...base, raceDate: addDays(TODAY, 112) }).success).toBe(true);
    expect(schema.safeParse({ ...base, raceDate: addDays(TODAY, 111) }).success).toBe(false);
    expect(schema.safeParse({ ...base, raceDate: addDays(TODAY, 365) }).success).toBe(false);
  });
});

describe('competitionOwnStartSchema (W-G5)', () => {
  it('nur mit ausdrücklicher Bestätigung, ganze Minuten ab 10', () => {
    expect(
      competitionOwnStartSchema.safeParse({ weeklyMinutes: 180, confirmed: true }).success,
    ).toBe(true);
    expect(
      competitionOwnStartSchema.safeParse({ weeklyMinutes: 180, confirmed: false }).success,
    ).toBe(false);
    expect(competitionOwnStartSchema.safeParse({ weeklyMinutes: 180 }).success).toBe(false);
    expect(competitionOwnStartSchema.safeParse({ weeklyMinutes: 9, confirmed: true }).success).toBe(
      false,
    );
    expect(
      competitionOwnStartSchema.safeParse({ weeklyMinutes: 90.5, confirmed: true }).success,
    ).toBe(false);
  });
});
