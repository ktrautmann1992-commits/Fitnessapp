import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { ENDURANCE_DISCIPLINES } from '../enums';
import {
  COMPETITION_DISCIPLINES,
  competitionInputSchema,
  competitionOwnStartSchema,
  competitionSchema,
  competitionPlanOffer,
  competitionWindowSchema,
  defaultCompetitionDiscipline,
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
      distanceKm: null,
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

  it('Laufen 5 km bis Marathon, mit WP5 Rad und Triathlon Sprint/Olympisch – Mittel-/Langdistanz und Schwimmen nie (W-G2)', () => {
    expect([...COMPETITION_DISCIPLINES]).toEqual([
      '5k',
      '10k',
      'half_marathon',
      'marathon',
      'cycling',
      'triathlon_sprint',
      'triathlon_olympic',
      // Sportarten Stufe 1 (per `add value`): Hyrox.
      'hyrox',
    ]);
    const withPlan = [
      '5k',
      '10k',
      'half_marathon',
      'marathon',
      'cycling',
      'triathlon_sprint',
      'triathlon_olympic',
      'hyrox',
    ];
    for (const d of ENDURANCE_DISCIPLINES) {
      const ok = competitionInputSchema.safeParse({
        ...base,
        discipline: d,
        ...(d === 'cycling' ? { distanceKm: 100 } : {}),
      }).success;
      expect(ok, d).toBe(withPlan.includes(d));
      expect(isCompetitionDiscipline(d)).toBe(ok);
    }
    for (const d of ['triathlon_middle', 'triathlon_long', 'swimming'] as const) {
      expect(competitionPlanOffer(d), d).toBe('coach');
    }
    expect(competitionPlanOffer('triathlon_olympic')).toBe('plan');
    expect(competitionPlanOffer(null)).toBe('none');
  });

  it('WP5: Rad nur mit Distanz 20–300 km (ganze km), sonst nie eine Distanz; Rad/Triathlon nur „Ankommen“ ohne Referenz', () => {
    const bike = { ...base, discipline: 'cycling' } as const;
    expect(competitionInputSchema.safeParse(bike).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 19 }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 20 }).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 300 }).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 301 }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 100.5 }).success).toBe(false);
    expect(competitionInputSchema.safeParse({ ...base, distanceKm: 100 }).success).toBe(false);
    const tri = { ...base, discipline: 'triathlon_sprint' } as const;
    expect(competitionInputSchema.safeParse(tri).success).toBe(true);
    expect(competitionInputSchema.safeParse({ ...tri, reference }).success).toBe(false);
    expect(
      competitionInputSchema.safeParse({ ...tri, goal: 'time', targetTimeS: 5400, reference })
        .success,
    ).toBe(false);
    expect(competitionInputSchema.safeParse({ ...bike, distanceKm: 100, reference }).success).toBe(
      false,
    );
    // Referenzzeit nur als Lauf-Distanz.
    expect(
      competitionInputSchema.safeParse({
        ...base,
        reference: { ...reference, discipline: 'triathlon_sprint' },
      }).success,
    ).toBe(false);
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

describe('defaultCompetitionDiscipline (Vorbelegung „Mein Wettkampf“, WP5)', () => {
  it('Ziel Ausdauer mit Plan-Disziplin → diese; Mittel-/Langdistanz → olympisch; sonst Halbmarathon', () => {
    const goal = (
      discipline: (typeof ENDURANCE_DISCIPLINES)[number] | null,
      goalType = 'endurance',
    ) => ({
      goalType,
      discipline,
    });
    for (const d of COMPETITION_DISCIPLINES) expect(defaultCompetitionDiscipline(goal(d))).toBe(d);
    expect(defaultCompetitionDiscipline(goal('triathlon_middle'))).toBe('triathlon_olympic');
    expect(defaultCompetitionDiscipline(goal('triathlon_long'))).toBe('triathlon_olympic');
    expect(defaultCompetitionDiscipline(goal('swimming'))).toBe('half_marathon');
    expect(defaultCompetitionDiscipline(goal(null))).toBe('half_marathon');
    expect(defaultCompetitionDiscipline(null)).toBe('half_marathon');
    // Grenzfall: Disziplin gespeichert, aber Hauptziel nicht Ausdauer → keine Vorbelegung aus der Disziplin.
    expect(defaultCompetitionDiscipline(goal('cycling', 'muscle_gain'))).toBe('half_marathon');
    expect(defaultCompetitionDiscipline(goal('triathlon_long', 'fat_loss'))).toBe('half_marathon');
  });
});
