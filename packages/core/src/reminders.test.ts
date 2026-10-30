import { describe, expect, it } from 'vitest';

import { MEAL_TIMING_RULES, REMINDERS } from './constants';
import {
  DEFAULT_REMINDER_SETTINGS,
  drinkGoalReached,
  inQuietHours,
  nudgeReminderTime,
  parseReminderSettings,
  plannedReminders,
  type PlannedReminder,
  type ReminderDay,
  reminderDates,
  type ReminderInput,
  type ReminderSettings,
} from './reminders';

const BERLIN = 'Europe/Berlin';
const at = (iso: string) => Date.parse(iso);
/** Donnerstag, 29.10.2026, 06:00 Ortszeit (MEZ, UTC+1). */
const NOW = at('2026-10-29T05:00:00Z');

function settings(change: {
  training?: Partial<ReminderSettings['training']>;
  meals?: Partial<ReminderSettings['meals']>;
  drink?: Partial<ReminderSettings['drink']>;
}): ReminderSettings {
  return {
    training: { ...DEFAULT_REMINDER_SETTINGS.training, ...change.training },
    meals: { ...DEFAULT_REMINDER_SETTINGS.meals, ...change.meals },
    drink: { ...DEFAULT_REMINDER_SETTINGS.drink, ...change.drink },
  };
}

const session = (id: string, startMinutes: number | null, minutes = 60) => ({
  id,
  nameDe: `Einheit ${id}`,
  kind: 'strength' as const,
  minutes,
  startMinutes,
});

function day(date: string, extra: Partial<ReminderDay> = {}): ReminderDay {
  return { date, sessions: [], meals: null, ...extra };
}

function run(input: Partial<ReminderInput> & Pick<ReminderInput, 'settings'>): PlannedReminder[] {
  return plannedReminders({
    days: [day('2026-10-29')],
    trainingTime: null,
    nowMs: NOW,
    timeZone: BERLIN,
    ...input,
  });
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const summary = (list: readonly PlannedReminder[]) =>
  list.map(
    (r) => `${r.date} ${hhmm(r.minutes)} ${r.kind}${'role' in r && r.role ? `:${r.role}` : ''}`,
  );

describe('Einstellungen', () => {
  it('Standard: alles aus → keine Erinnerung', () => {
    expect(
      run({
        settings: DEFAULT_REMINDER_SETTINGS,
        days: [day('2026-10-29', { sessions: [session('a', 18 * 60)] })],
      }),
    ).toEqual([]);
  });

  it('parseReminderSettings: Unsinn → Standard, je Bereich getrennt', () => {
    expect(parseReminderSettings(null)).toEqual(DEFAULT_REMINDER_SETTINGS);
    expect(parseReminderSettings('x')).toEqual(DEFAULT_REMINDER_SETTINGS);
    const parsed = parseReminderSettings({
      training: { enabled: true, leadMinutes: 30 },
      meals: { enabled: true, breakfast: 6 * 60, lunch: 750, dinner: 1110 }, // 06:00 = Nachtruhe → Standard
      drink: { enabled: true, fromMinutes: 20 * 60, toMinutes: 8 * 60, everyMinutes: 120 }, // falsch herum
    });
    expect(parsed.training).toEqual({ enabled: true, leadMinutes: 30 });
    expect(parsed.meals).toEqual(DEFAULT_REMINDER_SETTINGS.meals);
    expect(parsed.drink).toEqual(DEFAULT_REMINDER_SETTINGS.drink);
    // Unbekannter Vorlauf → Standard (aus).
    expect(
      parseReminderSettings({ training: { enabled: true, leadMinutes: 45 } }).training,
    ).toEqual(DEFAULT_REMINDER_SETTINGS.training);
  });

  it('nudgeReminderTime: 30-Minuten-Schritte, begrenzt', () => {
    expect(nudgeReminderTime(450, 1, 420, 1290)).toBe(480);
    expect(nudgeReminderTime(420, -1, 420, 1290)).toBe(420);
    expect(nudgeReminderTime(1290, 1, 420, 1290)).toBe(1290);
  });

  it('Nachtruhe 22:00–07:00', () => {
    expect(inQuietHours(21 * 60 + 59)).toBe(false);
    expect(inQuietHours(22 * 60)).toBe(true);
    expect(inQuietHours(0)).toBe(true);
    expect(inQuietHours(6 * 60 + 59)).toBe(true);
    expect(inQuietHours(7 * 60)).toBe(false);
  });

  it('Snack-Hinweis = spätester Snack-Zeitpunkt der Timing-Regeln', () => {
    expect(REMINDERS.preSnackLeadMinutes).toBe(MEAL_TIMING_RULES.preSnackMinutes.max);
  });

  it('Eingaben werden geprüft (Zod)', () => {
    const base = { settings: settings({ drink: { enabled: true } }) };
    expect(() => run({ ...base, timeZone: 'Mars/Olympus' })).toThrow();
    expect(() =>
      run({
        ...base,
        days: reminderDates('2026-10-29')
          .concat('2026-11-05')
          .map((d) => day(d)),
      }),
    ).toThrow();
    expect(() =>
      run({ ...base, days: [day('2026-10-29', { sessions: [session('a', 24 * 60)] })] }),
    ).toThrow();
  });
});

describe('Training', () => {
  const on = (leadMinutes = 60) => settings({ training: { enabled: true, leadMinutes } });

  it('eigene Uhrzeit: Vorlauf vor dem Start, Zeitpunkt in Ortszeit', () => {
    const list = run({
      settings: on(60),
      days: [day('2026-10-29', { sessions: [session('a', 18 * 60)] })],
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      kind: 'training',
      id: 't-2026-10-29-a',
      minutes: 17 * 60,
      startMinutes: 18 * 60,
      approx: false,
      sessionNameDe: 'Einheit a',
      atMs: at('2026-10-29T16:00:00Z'),
    });
  });

  it('Einheit verschoben → Erinnerung wandert mit; zu früh → fällt in die Nachtruhe', () => {
    const moved = run({
      settings: on(30),
      days: [day('2026-10-29', { sessions: [session('a', 10 * 60)] })],
    });
    expect(summary(moved)).toEqual(['2026-10-29 09:30 training']);
    const early = run({
      settings: on(60),
      days: [day('2026-10-30', { sessions: [session('a', 7 * 60 + 30)] })],
    });
    expect(early).toEqual([]);
    const earlyShort = run({
      settings: on(15),
      days: [day('2026-10-30', { sessions: [session('a', 7 * 60 + 30)] })],
    });
    expect(summary(earlyShort)).toEqual(['2026-10-30 07:15 training']);
  });

  it('Mitternacht: Einheit um 00:30 bzw. 23:00 → keine Erinnerung (nie über den Tag hinaus, Nachtruhe)', () => {
    expect(
      run({
        settings: on(60),
        days: [day('2026-10-30', { sessions: [session('a', 30)] })],
      }),
    ).toEqual([]);
    expect(
      run({
        settings: on(60),
        days: [day('2026-10-30', { sessions: [session('a', 23 * 60)] })],
      }),
    ).toEqual([]);
  });

  it('ohne eigene Uhrzeit: „Trainingszeit“ abends (ca. 17:30) bzw. ohne Angabe einmal am Morgen', () => {
    const evening = run({
      settings: on(60),
      trainingTime: 'evening',
      days: [day('2026-10-30', { sessions: [session('a', null)] })],
    });
    expect(evening[0]).toMatchObject({
      minutes: 16 * 60 + 30,
      approx: true,
      startMinutes: 17 * 60 + 30,
    });
    for (const trainingTime of [null, 'varies'] as const) {
      const morning = run({
        settings: on(60),
        trainingTime,
        days: [day('2026-10-30', { sessions: [session('a', null), session('b', null)] })],
      });
      expect(morning).toHaveLength(1);
      expect(morning[0]).toMatchObject({
        id: 't-2026-10-30-tag',
        minutes: REMINDERS.untimedTrainingMinutes,
        startMinutes: null,
        count: 2,
        sessionNameDe: 'Einheit a',
      });
    }
  });

  it('keine Einheit → keine Trainings-Erinnerung; vergangene Zeitpunkte entfallen', () => {
    expect(run({ settings: on(), days: [day('2026-10-29')] })).toEqual([]);
    // Heute 06:00 → Einheit um 06:30 mit 15 min Vorlauf (06:15) ist Nachtruhe; jetzt 12:00 → 11:00 vorbei.
    expect(
      run({
        settings: on(60),
        nowMs: at('2026-10-29T11:00:00Z'),
        days: [day('2026-10-29', { sessions: [session('a', 12 * 60)] })],
      }),
    ).toEqual([]);
  });

  it('1 vs. 7 Trainingstage', () => {
    const dates = reminderDates('2026-10-29');
    const one = run({
      settings: on(60),
      days: dates.map((d, i) => day(d, { sessions: i === 3 ? [session(`s${i}`, 18 * 60)] : [] })),
    });
    expect(summary(one)).toEqual(['2026-11-01 17:00 training']);
    const seven = run({
      settings: on(60),
      days: dates.map((d, i) => day(d, { sessions: [session(`s${i}`, 18 * 60)] })),
    });
    expect(seven).toHaveLength(7);
    expect(new Set(seven.map((r) => r.id)).size).toBe(7);
  });

  it('Sommerzeit Europe/Berlin: gleiche Uhrzeit vor und nach der Umstellung', () => {
    const now = at('2026-03-27T12:00:00Z');
    const list = plannedReminders({
      days: ['2026-03-28', '2026-03-29'].map((d) => day(d, { sessions: [session('a', 9 * 60)] })),
      settings: on(60),
      trainingTime: null,
      nowMs: now,
      timeZone: BERLIN,
    });
    expect(list.map((r) => r.atMs)).toEqual([
      at('2026-03-28T07:00:00Z'),
      at('2026-03-29T06:00:00Z'),
    ]);
    const autumn = plannedReminders({
      days: ['2026-10-24', '2026-10-25'].map((d) => day(d, { sessions: [session('a', 9 * 60)] })),
      settings: on(60),
      trainingTime: null,
      nowMs: at('2026-10-23T12:00:00Z'),
      timeZone: BERLIN,
    });
    expect(autumn.map((r) => r.atMs)).toEqual([
      at('2026-10-24T06:00:00Z'),
      at('2026-10-25T07:00:00Z'),
    ]);
  });
});

describe('Essen', () => {
  const on = (meals: Partial<ReminderSettings['meals']> = {}) =>
    settings({ meals: { enabled: true, ...meals } });

  it('ohne Plan: Frühstück, Mittag, Abend zu den eigenen Zeiten', () => {
    const list = run({ settings: on({ breakfast: 8 * 60 }), days: [day('2026-10-30')] });
    expect(summary(list)).toEqual([
      '2026-10-30 08:00 meal',
      '2026-10-30 12:30 meal',
      '2026-10-30 18:30 meal',
    ]);
    expect(list.every((r) => r.kind === 'meal' && r.titleDe === null)).toBe(true);
  });

  it('mit Plan: Gericht im Text, Snacks ohne Trainingsbezug entfallen, „main“ = Mittag', () => {
    const list = run({
      settings: on(),
      days: [
        day('2026-10-30', {
          meals: [
            { slot: 'breakfast', titleDe: 'Haferbrei' },
            { slot: 'snack_morning', titleDe: 'Apfel' },
            { slot: 'main', titleDe: 'Hähnchen-Reis-Bowl' },
            { slot: 'dinner', titleDe: null },
          ],
        }),
      ],
    });
    expect(list.map((r) => (r.kind === 'meal' ? `${hhmm(r.minutes)} ${r.titleDe}` : ''))).toEqual([
      '07:30 Haferbrei',
      '12:30 Hähnchen-Reis-Bowl',
      '18:30 null',
    ]);
  });

  it('Training 15:00: Mittagessen = vor dem Training, danach fehlt eine Mahlzeit → Hinweis 16:15', () => {
    const list = run({
      settings: on(),
      days: [day('2026-10-30', { sessions: [session('a', 15 * 60)] })],
    });
    expect(summary(list)).toEqual([
      '2026-10-30 07:30 meal',
      '2026-10-30 12:30 meal:pre',
      '2026-10-30 16:15 meal:post',
      '2026-10-30 18:30 meal',
    ]);
    expect(list[1]).toMatchObject({ slot: 'lunch', sessionStartMinutes: 15 * 60 });
    expect(list[2]).toMatchObject({ slot: null, id: 'm-2026-10-30-nach-a' });
  });

  it('Einheit verschoben auf 19:00: Snack-Hinweis 18:00 und Essen danach 20:15 wandern mit', () => {
    const list = run({
      settings: on(),
      days: [day('2026-10-30', { sessions: [session('a', 19 * 60)] })],
    });
    expect(summary(list)).toEqual([
      '2026-10-30 07:30 meal',
      '2026-10-30 12:30 meal',
      '2026-10-30 18:00 meal:pre_snack',
      '2026-10-30 18:30 meal',
      '2026-10-30 20:15 meal:post',
    ]);
  });

  it('Snack-Hinweis entfällt neben der Trainings-Erinnerung zur selben Zeit', () => {
    const list = run({
      settings: settings({
        training: { enabled: true, leadMinutes: 60 },
        meals: { enabled: true },
      }),
      days: [day('2026-10-30', { sessions: [session('a', 19 * 60)] })],
    });
    expect(summary(list)).toEqual([
      '2026-10-30 07:30 meal',
      '2026-10-30 12:30 meal',
      '2026-10-30 18:00 training',
      '2026-10-30 18:30 meal',
      '2026-10-30 20:15 meal:post',
    ]);
  });

  it('Abendtraining 18:00–19:30 mit Snack im Plan: Snack vorher, Abendessen nicht doppelt', () => {
    const list = run({
      settings: on({ dinner: 20 * 60 }),
      days: [
        day('2026-10-30', {
          sessions: [session('a', 18 * 60, 90)],
          meals: [
            { slot: 'breakfast', titleDe: 'Müsli' },
            { slot: 'lunch', titleDe: 'Linsen' },
            { slot: 'snack_pre_dinner', titleDe: 'Banane' },
            { slot: 'dinner', titleDe: 'Lachs' },
          ],
        }),
      ],
    });
    expect(summary(list)).toEqual([
      '2026-10-30 07:30 meal',
      '2026-10-30 12:30 meal',
      '2026-10-30 17:00 meal:pre_snack',
      '2026-10-30 20:00 meal:post',
    ]);
  });

  it('spätes Training 21:00: Abendessen = vorher, Hinweis danach nach 22:00 entfällt (Nachtruhe)', () => {
    const list = run({
      settings: on(),
      days: [day('2026-10-30', { sessions: [session('a', 21 * 60)] })],
    });
    expect(summary(list)).toContain('2026-10-30 18:30 meal:pre');
    expect(list.some((r) => r.kind === 'meal' && r.role === 'post')).toBe(false);
  });
});

describe('Trinken', () => {
  it('8–20 Uhr alle 2 h, ab jetzt', () => {
    const list = run({
      settings: settings({ drink: { enabled: true } }),
      nowMs: at('2026-10-29T09:30:00Z'), // 10:30 Ortszeit
    });
    expect(summary(list)).toEqual([
      '2026-10-29 12:00 drink',
      '2026-10-29 14:00 drink',
      '2026-10-29 16:00 drink',
      '2026-10-29 18:00 drink',
      '2026-10-29 20:00 drink',
    ]);
  });

  it('nicht dicht neben einer anderen Erinnerung', () => {
    const list = run({
      settings: settings({
        meals: { enabled: true, breakfast: 8 * 60 },
        drink: { enabled: true, fromMinutes: 8 * 60, toMinutes: 13 * 60, everyMinutes: 60 },
      }),
      days: [day('2026-10-30')],
    });
    expect(summary(list)).toEqual([
      '2026-10-30 08:00 meal',
      '2026-10-30 09:00 drink',
      '2026-10-30 10:00 drink',
      '2026-10-30 11:00 drink',
      '2026-10-30 12:00 drink',
      '2026-10-30 12:30 meal',
      '2026-10-30 13:00 drink',
      '2026-10-30 18:30 meal',
    ]);
  });

  it('höchstens REMINDERS.maxScheduled, die frühesten zuerst', () => {
    const list = run({
      settings: settings({
        training: { enabled: true },
        meals: { enabled: true },
        drink: { enabled: true, fromMinutes: 7 * 60, toMinutes: 22 * 60, everyMinutes: 60 },
      }),
      days: reminderDates('2026-10-29').map((d) => day(d, { sessions: [session('a', 17 * 60)] })),
    });
    expect(list).toHaveLength(REMINDERS.maxScheduled);
    const times = list.map((r) => r.atMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(list.every((r) => !inQuietHours(r.minutes))).toBe(true);
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
  });
});

describe('Trinken: Tagesziel des Trink-Trackers erreicht', () => {
  const drink = settings({ meals: { enabled: true }, drink: { enabled: true } });
  /** 29.10. 10:30 Ortszeit, zwei Tage geplant. */
  const base = {
    settings: drink,
    nowMs: at('2026-10-29T09:30:00Z'),
    days: [day('2026-10-29'), day('2026-10-30')],
  };
  const drinksOn = (list: readonly PlannedReminder[], date: string) =>
    list.filter((r) => r.kind === 'drink' && r.date === date).length;

  it('drinkGoalReached: genau erreicht, darüber, darunter, ohne Ziel, ohne Tracker', () => {
    expect(drinkGoalReached({ date: '2026-10-29', totalMl: 2000, goalMl: 2000 })).toBe(true);
    expect(drinkGoalReached({ date: '2026-10-29', totalMl: 2500, goalMl: 2000 })).toBe(true);
    expect(drinkGoalReached({ date: '2026-10-29', totalMl: 1999, goalMl: 2000 })).toBe(false);
    expect(drinkGoalReached({ date: '2026-10-29', totalMl: 5000, goalMl: null })).toBe(false);
    expect(drinkGoalReached(null)).toBe(false);
    expect(drinkGoalReached(undefined)).toBe(false);
  });

  it('kein Tracker (null/fehlend) → wie bisher', () => {
    const without = run(base);
    expect(run({ ...base, drinkProgress: null })).toEqual(without);
    expect(drinksOn(without, '2026-10-29')).toBe(5);
    expect(drinksOn(without, '2026-10-30')).toBe(7);
  });

  it('Ziel genau erreicht → restliche Trink-Erinnerungen heute entfallen, morgen bleiben, Essen bleibt', () => {
    const without = run(base);
    const list = run({
      ...base,
      drinkProgress: { date: '2026-10-29', totalMl: 2000, goalMl: 2000 },
    });
    expect(drinksOn(list, '2026-10-29')).toBe(0);
    expect(drinksOn(list, '2026-10-30')).toBe(7);
    expect(list.filter((r) => r.kind !== 'drink')).toEqual(
      without.filter((r) => r.kind !== 'drink'),
    );
  });

  it('knapp darunter bzw. ohne Ziel (Herz/Niere, kein Gewicht) → wie bisher', () => {
    const without = run(base);
    expect(
      run({ ...base, drinkProgress: { date: '2026-10-29', totalMl: 1950, goalMl: 2000 } }),
    ).toEqual(without);
    expect(
      run({ ...base, drinkProgress: { date: '2026-10-29', totalMl: 4000, goalMl: null } }),
    ).toEqual(without);
  });

  it('Ziel geändert (z. B. Training kam dazu) → Menge reicht nicht mehr → Erinnerungen kommen wieder', () => {
    const reached = run({
      ...base,
      drinkProgress: { date: '2026-10-29', totalMl: 2100, goalMl: 2000 },
    });
    const raised = run({
      ...base,
      drinkProgress: { date: '2026-10-29', totalMl: 2100, goalMl: 2600 },
    });
    expect(drinksOn(reached, '2026-10-29')).toBe(0);
    expect(drinksOn(raised, '2026-10-29')).toBe(5);
  });

  it('über Mitternacht: Stand von gestern wirkt nicht auf heute; Stand von heute nicht auf morgen', () => {
    // 30.10. 07:30 Ortszeit – der Tracker-Stand ist noch vom 29.10. (Ziel erreicht).
    const nextMorning = {
      settings: drink,
      nowMs: at('2026-10-30T06:30:00Z'),
      days: [day('2026-10-30'), day('2026-10-31')],
    };
    expect(
      run({
        ...nextMorning,
        drinkProgress: { date: '2026-10-29', totalMl: 3000, goalMl: 2000 },
      }),
    ).toEqual(run(nextMorning));
    const list = run({
      ...nextMorning,
      drinkProgress: { date: '2026-10-30', totalMl: 2000, goalMl: 2000 },
    });
    expect(drinksOn(list, '2026-10-30')).toBe(0);
    expect(drinksOn(list, '2026-10-31')).toBe(7);
  });

  it('Trinken aus → nichts zu tun; ungültiger Stand wird abgelehnt (Zod)', () => {
    expect(
      run({
        settings: settings({ drink: { enabled: false } }),
        drinkProgress: { date: '2026-10-29', totalMl: 0, goalMl: 2000 },
      }),
    ).toEqual([]);
    expect(() =>
      run({ ...base, drinkProgress: { date: '2026-10-29', totalMl: -1, goalMl: 2000 } }),
    ).toThrow();
    expect(() =>
      run({ ...base, drinkProgress: { date: '29.10.2026', totalMl: 0, goalMl: 2000 } }),
    ).toThrow();
  });
});
