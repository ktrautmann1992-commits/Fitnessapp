import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import { WEEK_EVALUATION } from '../constants';
import { addDays } from '../dates';
import type { SessionAchievementInput } from '../log/achievement';
import { type SummaryLog, type SummarySession, weekLogSummary } from '../log/summary';
import type { FoodLogSlot } from '../nutrition/food-log';
import { nutritionTargetsForWeek, type NutritionDayTargets } from '../nutrition/targets';
import { inputs, MONDAY, run, seededRandom, session } from '../nutrition/test-helpers';
import { dayEvaluation } from './day-evaluation';
import { INTAKE_ZONE_IDS } from './intake-zone';
import {
  type PlannedSessionTargets,
  weekEvaluation,
  type WeekEvaluationDayInput,
  type WeekEvaluationInput,
  type WeekEvaluationWithoutNumbers,
} from './week-evaluation';

/**
 * Wochenauswertung (docs/PLAN-AUSWERTUNG.md Abschnitt 8, Etappe A3): baut auf weekLogSummary() und dayEvaluation()
 * auf. Fälle aus Abschnitt 8 und Eigenschaften (Summe der Tagesansichten, Durchschnitt nur über eingetragene Tage,
 * keine Bilanz/Prognose, ohne Zahlen keine kcal, Muster-Hinweis, keine eigenen Grenzwerte).
 */

const NEXT_MONDAY = addDays(MONDAY, 7);
const WEDNESDAY = addDays(MONDAY, 2);
const DATES = Array.from({ length: 7 }, (_, i) => addDays(MONDAY, i));

type Overrides = Parameters<typeof inputs>[0];

function weekTargets(overrides: Overrides = {}): NutritionDayTargets[] {
  return [...nutritionTargetsForWeek(inputs({ today: MONDAY, ...overrides }), MONDAY).days];
}

function entry(
  kcal: number | null,
  slot: FoodLogSlot = 'other',
  source: 'plan_item' | 'quick' = 'quick',
) {
  return { kcal, protein_g: null, carbs_g: null, fat_g: null, source, slot } as const;
}

/** Sieben Tage mit Zielen; `eaten[i]` = Einträge des Tages i (Mo = 0). */
function days(
  eaten: Readonly<Record<number, readonly (number | null)[]>> = {},
  targets: readonly (NutritionDayTargets | null)[] = weekTargets(),
  extra: Partial<WeekEvaluationDayInput> = {},
): WeekEvaluationDayInput[] {
  return DATES.map((date, i) => ({
    date,
    targets: targets[i] ?? null,
    foodLog: { available: true, entries: (eaten[i] ?? []).map((k) => entry(k)) },
    mealPlan: null,
    ...extra,
  }));
}

function input(overrides: Partial<WeekEvaluationInput> = {}): WeekEvaluationInput {
  return {
    weekStart: MONDAY,
    today: NEXT_MONDAY,
    showNumbers: true,
    days: days(),
    sessions: [],
    logs: [],
    achievements: new Map(),
    plannedTargets: new Map(),
    ...overrides,
  };
}

function plannedSession(
  id: string,
  scheduledOn: string,
  overrides: Partial<SummarySession> = {},
): SummarySession {
  return {
    id,
    scheduled_on: scheduledOn,
    original_date: null,
    status: 'planned',
    kind: 'strength',
    name_de: `Einheit ${id}`,
    plan_active: true,
    ...overrides,
  };
}

function log(id: string, performedOn: string, overrides: Partial<SummaryLog> = {}): SummaryLog {
  return {
    id,
    planned_session_id: null,
    performed_on: performedOn,
    kind: 'strength',
    status: 'completed',
    name_de: `Eintrag ${id}`,
    done_sets: 0,
    cardio_duration_s: null,
    cardio_distance_m: null,
    ...overrides,
  };
}

function strengthAchievement(
  sets: readonly boolean[],
  targetSets: number | null = sets.length,
  easyWeek: 'recovery' | 'intro' | null = null,
  isFree = false,
): SessionAchievementInput {
  return {
    kind: 'strength',
    isFree,
    easyWeek,
    exercises: [
      {
        status: 'done',
        loadType: 'bodyweight',
        targetSets,
        repsMin: targetSets === null ? null : 8,
        targetReps: null,
        targetWeightKg: null,
        targetDurationS: null,
        incrementKind: 'none',
        steps: [],
        sets: sets.map((done) => ({ done, reps: 8, weightKg: null, durationS: null })),
      },
    ],
  };
}

function enduranceAchievement(
  minutes: number,
  plannedMinutes: number | null,
  distanceM: number | null = null,
  isFree = false,
): SessionAchievementInput {
  return {
    kind: 'endurance',
    isFree,
    easyWeek: null,
    plannedMinutes,
    effortTarget: null,
    durationS: minutes * 60,
    distanceM,
    sessionRpe: null,
  };
}

const targets = (
  strengthSets: number | null,
  enduranceMinutes: number | null = null,
  easyWeek: PlannedSessionTargets['easyWeek'] = null,
): PlannedSessionTargets => ({ strengthSets, enduranceMinutes, easyWeek });

/** Rekursiv alle Schlüssel eines Ergebnisses. */
function allKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      keys.push(key);
      allKeys(v, keys);
    }
  }
  return keys;
}

/** Alle Zahlen mit ihrem Schlüssel-Pfad. */
function numbersIn(value: unknown, path = ''): { path: string; value: number }[] {
  if (typeof value === 'number') return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => numbersIn(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => numbersIn(v, path ? `${path}.${k}` : k));
  }
  return [];
}

// ---------------------------------------------------------------------------------------------------------

describe('Eingaben', () => {
  it('Woche muss am Montag beginnen und genau Mo–So enthalten', () => {
    expect(() => weekEvaluation(input({ weekStart: addDays(MONDAY, 1) }))).toThrow(RangeError);
    expect(() => weekEvaluation(input({ days: days().slice(0, 6) }))).toThrow(RangeError);
    const shuffled = days();
    const [a, b] = [shuffled[0], shuffled[1]];
    if (!a || !b) throw new Error('Tage fehlen');
    expect(() => weekEvaluation(input({ days: [b, a, ...shuffled.slice(2)] }))).toThrow(RangeError);
    expect(() => weekEvaluation(input({ weekStart: '2026-02-30' }))).toThrow();
  });

  it('Zeitpunkt der Woche: vergangen, laufend, künftig', () => {
    expect(weekEvaluation(input()).timing).toBe('past');
    expect(weekEvaluation(input({ today: WEDNESDAY })).timing).toBe('current');
    expect(weekEvaluation(input({ today: MONDAY })).timing).toBe('current');
    expect(weekEvaluation(input({ today: addDays(MONDAY, 6) })).timing).toBe('current');
    expect(weekEvaluation(input({ today: addDays(MONDAY, -1) })).timing).toBe('future');
  });
});

describe('Fälle aus Abschnitt 8', () => {
  it('leere Woche: keine Einträge, kein Durchschnitt, kein Hinweis, Training 0 von 0', () => {
    const r = weekEvaluation(input());
    expect(r.showNumbers).toBe(true);
    if (r.food.kind !== 'numbers') throw new Error('mit Zahlen erwartet');
    expect(r.food).toMatchObject({
      entryDays: 0,
      valuedDays: 0,
      average: null,
      belowFloorDays: 0,
      patternNotice: false,
      todayOpen: false,
      meals: null,
    });
    expect(r.days.every((d) => d.food.intake.kind === 'no_entries')).toBe(true);
    expect(r.training).toMatchObject({
      items: [],
      free: [],
      sessions: { done: 0, planned: 0 },
      strengthSets: { fulfilled: 0, planned: 0, done: 0 },
      enduranceMinutes: { done: 0, planned: 0 },
      distanceM: 0,
    });
    expect(r.easyWeek).toBeNull();
  });

  it('nur Training: Summen aus den Einheiten, Essen leer', () => {
    const sessions = [
      plannedSession('s1', DATES[0] as string, { status: 'completed' }),
      plannedSession('s2', DATES[2] as string, { kind: 'endurance' }),
      plannedSession('s3', DATES[4] as string),
    ];
    const logs = [
      log('l1', DATES[0] as string, { planned_session_id: 's1', done_sets: 2 }),
      log('l2', DATES[2] as string, {
        planned_session_id: 's2',
        kind: 'endurance',
        cardio_duration_s: 25 * 60 + 59,
        cardio_distance_m: 4250,
      }),
    ];
    const r = weekEvaluation(
      input({
        sessions,
        logs,
        achievements: new Map([
          ['l1', strengthAchievement([true, true, false])],
          ['l2', enduranceAchievement(25, 30, 4250)],
        ]),
        plannedTargets: new Map([
          ['s1', targets(3)],
          ['s2', targets(null, 30)],
          ['s3', targets(4)],
        ]),
      }),
    );
    expect(r.training.sessions).toEqual({ done: 2, planned: 3 });
    // l1: 2 von 3 erfüllt; s3 verpasst: 4 Sätze geplant.
    expect(r.training.strengthSets).toEqual({ fulfilled: 2, planned: 7, done: 2 });
    expect(r.training.enduranceMinutes).toEqual({ done: 25, planned: 30 });
    expect(r.training.distanceM).toBe(4250);
    expect(r.training.items.map((i) => [i.date, i.item.status])).toEqual([
      [DATES[0], 'done'],
      [DATES[2], 'done'],
      [DATES[4], 'missed'],
    ]);
    expect(r.training.items[0]?.achievement).toMatchObject({ percent: 66, level: 'mostly' });
    expect(r.training.items[2]?.achievement).toBeNull();
    if (r.food.kind !== 'numbers') throw new Error('mit Zahlen erwartet');
    expect(r.food.entryDays).toBe(0);
  });

  it('nur Essen: Zonen je Tag, „An 5 Tagen eingetragen“, Ø nur über diese Tage', () => {
    const t = weekTargets();
    const target = (i: number) => t[i]?.targetKcal as number;
    const floor = (i: number) => t[i]?.floorKcal as number;
    const r = weekEvaluation(
      input({
        days: days(
          {
            0: [target(0)],
            1: [target(1)],
            2: [target(2)],
            3: [floor(3) - 1],
            4: [Math.round(target(4) * 3)],
          },
          t,
        ),
      }),
    );
    if (r.food.kind !== 'numbers') throw new Error('mit Zahlen erwartet');
    expect(r.food.entryDays).toBe(5);
    expect(r.food.valuedDays).toBe(5);
    expect(r.food.zoneCounts).toEqual({
      below_floor: 1,
      below_target: 0,
      in_range: 3,
      above_target: 0,
      well_above: 1,
    });
    const eaten = target(0) + target(1) + target(2) + floor(3) - 1 + Math.round(target(4) * 3);
    const goal = [0, 1, 2, 3, 4].reduce((s, i) => s + target(i), 0);
    expect(r.food.average?.eatenKcal).toBeCloseTo(eaten / 5, 9);
    expect(r.food.average?.targetKcal).toBeCloseTo(goal / 5, 9);
    expect(r.food.patternNotice).toBe(false);
    expect(r.training.items).toEqual([]);
  });

  it('laufende Woche: heute zählt als „offen“, künftige Tage nur Vorschau', () => {
    const t = weekTargets();
    const r = weekEvaluation(
      input({
        today: WEDNESDAY,
        days: days({ 0: [300], 1: [300], 2: [300] }, t),
      }),
    );
    if (r.food.kind !== 'numbers') throw new Error('mit Zahlen erwartet');
    expect(r.days.map((d) => d.timing)).toEqual([
      'past',
      'past',
      'today',
      'future',
      'future',
      'future',
      'future',
    ]);
    const todayIntake = r.days[2]?.food.intake;
    expect(todayIntake?.kind === 'bar' && todayIntake.zone).toBe('open');
    expect(r.days.slice(3).every((d) => d.food.intake.kind === 'future')).toBe(true);
    // Heute zählt nicht mit: 2 Tage, 2 × rot – kein Muster-Hinweis (erst ab 3 VERGANGENEN Tagen).
    expect(r.food).toMatchObject({
      entryDays: 2,
      valuedDays: 2,
      belowFloorDays: 2,
      patternNotice: false,
      todayOpen: true,
    });
    expect(r.food.average?.eatenKcal).toBe(300);
  });

  it('Erholungswoche: gleiche Rechnung, Kennzeichen „leichter ist hier richtig“', () => {
    const sessions = [
      plannedSession('s1', DATES[1] as string, { status: 'completed' }),
      plannedSession('s2', DATES[3] as string),
    ];
    const logs = [log('l1', DATES[1] as string, { planned_session_id: 's1', done_sets: 2 })];
    const base = {
      sessions,
      logs,
      plannedTargets: new Map([
        ['s1', targets(2, null, 'recovery')],
        ['s2', targets(2, null, 'recovery')],
      ]),
    };
    const recovery = weekEvaluation(
      input({
        ...base,
        achievements: new Map([['l1', strengthAchievement([true, false], 2, 'recovery')]]),
      }),
    );
    const normal = weekEvaluation(
      input({
        ...base,
        plannedTargets: new Map([
          ['s1', targets(2)],
          ['s2', targets(2)],
        ]),
        achievements: new Map([['l1', strengthAchievement([true, false], 2)]]),
      }),
    );
    expect(recovery.easyWeek).toBe('recovery');
    expect(normal.easyWeek).toBeNull();
    expect(recovery.training.strengthSets).toEqual(normal.training.strengthSets);
    expect(recovery.training.items[0]?.achievement?.percent).toBe(
      normal.training.items[0]?.achievement?.percent,
    );
    // Nur aus den Vorgaben (noch kein Eintrag) – auch Einstiegswoche.
    const intro = weekEvaluation(
      input({
        sessions: [plannedSession('s9', DATES[2] as string)],
        plannedTargets: new Map([['s9', targets(3, null, 'intro')]]),
      }),
    );
    expect(intro.easyWeek).toBe('intro');
  });

  it('verschobene und nachgetragene Einheiten: am tatsächlichen Tag, Kennzeichen bleiben, einmal gezählt', () => {
    const sessions = [
      // Von Montag auf Donnerstag verschoben.
      plannedSession('s1', DATES[3] as string, { original_date: DATES[0] as string }),
      // Dienstag geplant, Mittwoch nachgeholt.
      plannedSession('s2', DATES[1] as string, { status: 'completed' }),
      // Freitag geplant, am Samstag für Freitag nachgetragen.
      plannedSession('s3', DATES[4] as string, { status: 'completed' }),
    ];
    const logs = [
      log('l2', DATES[2] as string, { planned_session_id: 's2', done_sets: 3 }),
      log('l3', DATES[4] as string, {
        planned_session_id: 's3',
        done_sets: 3,
        created_at: `${DATES[5]}T10:00:00Z`,
      }),
    ];
    const r = weekEvaluation(
      input({
        sessions,
        logs,
        achievements: new Map([
          ['l2', strengthAchievement([true, true, true])],
          ['l3', strengthAchievement([true, true, true])],
        ]),
        plannedTargets: new Map([
          ['s1', targets(3)],
          ['s2', targets(3)],
          ['s3', targets(3)],
        ]),
      }),
    );
    const byLog = (id: string) => r.training.items.find((i) => i.item.logId === id);
    expect(byLog('l2')).toMatchObject({ date: DATES[2], item: { caughtUpFrom: DATES[1] } });
    expect(byLog('l3')).toMatchObject({ date: DATES[4], item: { backfilled: true } });
    const moved = r.training.items.find((i) => i.item.sessionId === 's1');
    expect(moved).toMatchObject({ date: DATES[3], item: { status: 'missed', logId: null } });
    expect(r.training.items).toHaveLength(3);
    expect(r.training.sessions).toEqual({ done: 2, planned: 3 });
    expect(r.training.strengthSets).toEqual({ fulfilled: 6, planned: 9, done: 6 });
  });

  it('freie Einheiten: extra aufgeführt, nie in den Plan-Summen', () => {
    const sessions = [plannedSession('s1', DATES[0] as string, { status: 'completed' })];
    const logs = [
      log('l1', DATES[0] as string, { planned_session_id: 's1', done_sets: 3 }),
      log('f1', DATES[1] as string, { is_free: true, done_sets: 4 }),
      log('f2', DATES[2] as string, {
        is_free: true,
        kind: 'endurance',
        cardio_duration_s: 30 * 60,
        cardio_distance_m: 5000,
      }),
    ];
    const r = weekEvaluation(
      input({
        sessions,
        logs,
        achievements: new Map([
          ['l1', strengthAchievement([true, true, true])],
          ['f1', strengthAchievement([true, true, true, true], null, null, true)],
          ['f2', enduranceAchievement(30, null, 5000, true)],
        ]),
        plannedTargets: new Map([['s1', targets(3)]]),
      }),
    );
    expect(r.training.items.map((i) => i.item.logId)).toEqual(['l1']);
    expect(r.training.free.map((i) => [i.date, i.item.logId, i.item.free])).toEqual([
      [DATES[1], 'f1', true],
      [DATES[2], 'f2', true],
    ]);
    expect(r.training.free[0]?.achievement).toMatchObject({ percent: null, level: 'done' });
    expect(r.training.sessions).toEqual({ done: 1, planned: 1 });
    expect(r.training.strengthSets).toEqual({ fulfilled: 3, planned: 3, done: 3 });
    expect(r.training.enduranceMinutes).toEqual({ done: 0, planned: 0 });
    expect(r.training.distanceM).toBe(0);
    expect(r.training.freeTotals).toEqual({
      sessions: 2,
      strengthSets: 4,
      enduranceMinutes: 30,
      distanceM: 5000,
    });
  });

  it('gestrichene und entfallene Einheiten stehen in der Liste, zählen aber nicht als geplant', () => {
    const r = weekEvaluation(
      input({
        sessions: [
          plannedSession('s1', DATES[0] as string, { status: 'skipped' }),
          plannedSession('s2', DATES[1] as string, { plan_active: false }),
          plannedSession('s3', DATES[2] as string),
        ],
        plannedTargets: new Map([
          ['s1', targets(5)],
          ['s2', targets(5)],
          ['s3', targets(3)],
        ]),
      }),
    );
    expect(r.training.items.map((i) => i.item.status)).toEqual(['skipped', 'dropped', 'missed']);
    expect(r.training.sessions).toEqual({ done: 0, planned: 1 });
    expect(r.training.strengthSets.planned).toBe(3);
  });

  it('Zahlen aus: keine kcal im Ergebnis (Typ ohne Zahlen), nur Anzahlen; Training vollständig', () => {
    const t = weekTargets();
    const value = input({
      showNumbers: false,
      today: WEDNESDAY,
      days: days({ 0: [300], 1: [2000, null] }, t, {
        mealPlan: { slots: ['breakfast', 'lunch'], belowFloor: true },
      }),
      sessions: [plannedSession('s1', DATES[0] as string, { status: 'completed' })],
      logs: [log('l1', DATES[0] as string, { planned_session_id: 's1', done_sets: 2 })],
      achievements: new Map([['l1', strengthAchievement([true, true])]]),
      plannedTargets: new Map([['s1', targets(2)]]),
    });
    const r = weekEvaluation({ ...value, showNumbers: false });
    expectTypeOf(r).toEqualTypeOf<WeekEvaluationWithoutNumbers>();
    expect(r.showNumbers).toBe(false);
    expect(r.food).toEqual({
      kind: 'hidden',
      available: true,
      entryDays: 2,
      meals: { eaten: 0, planned: 6 },
      todayOpen: true,
    });
    for (const day of r.days) {
      expect(day.food.intake).toEqual({ kind: 'hidden' });
      expect(day.notices).toEqual([]);
    }
    expect(allKeys(r.food).join(' ')).not.toMatch(/kcal|average|zone|floor|pattern/i);
    expect(JSON.stringify(r)).not.toMatch(/kcal|Kcal/);
    expect(r.training.strengthSets).toEqual({ fulfilled: 2, planned: 2, done: 2 });
  });

  it('Schwangerschaft an einem Tag: ganze Woche ohne Zahlen, auch mit eingeschaltetem Schalter', () => {
    const pregnant = weekTargets({ sex: 'female', healthFlags: { flags: ['pregnancy'] } });
    const normal = weekTargets();
    const mixed = normal.map((d, i) => (i === 4 ? (pregnant[4] ?? null) : d));
    const r = weekEvaluation(input({ days: days({ 0: [300], 1: [300], 2: [300] }, mixed) }));
    expect(r.showNumbers).toBe(false);
    expect(r.food.kind).toBe('hidden');
    expect(r.days.every((d) => d.food.intake.kind === 'hidden')).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/kcal/i);
  });

  it('genau 2 Tage unter der Untergrenze: kein Hinweis; genau 3: einmal der Hinweis', () => {
    const t = weekTargets();
    const below = (i: number) => (t[i]?.floorKcal as number) - 1;
    const two = weekEvaluation(input({ days: days({ 0: [below(0)], 3: [below(3)] }, t) }));
    const three = weekEvaluation(
      input({ days: days({ 0: [below(0)], 3: [below(3)], 6: [below(6)] }, t) }),
    );
    if (two.food.kind !== 'numbers' || three.food.kind !== 'numbers') throw new Error('Zahlen');
    expect(WEEK_EVALUATION.patternBelowFloorMinDays).toBe(3);
    expect(two.food).toMatchObject({ belowFloorDays: 2, patternNotice: false });
    expect(three.food).toMatchObject({ belowFloorDays: 3, patternNotice: true });
    // Genau auf der Untergrenze ist nicht „darunter“.
    const onFloor = weekEvaluation(
      input({
        days: days({ 0: [below(0)], 3: [below(3)], 6: [(t[6]?.floorKcal as number) + 0] }, t),
      }),
    );
    expect(onFloor.food.kind === 'numbers' && onFloor.food.patternNotice).toBe(false);
  });

  it('kein Muster-Hinweis bei Tagen über dem Ziel und nicht für heute', () => {
    const t = weekTargets();
    const high = weekEvaluation(
      input({ days: days({ 0: [9000], 1: [9000], 2: [9000], 3: [9000] }, t) }),
    );
    expect(high.food.kind === 'numbers' && high.food.patternNotice).toBe(false);
    expect(high.food.kind === 'numbers' && high.food.zoneCounts.well_above).toBe(4);
    // Zwei vergangene + heute unter U → noch kein Hinweis.
    const withToday = weekEvaluation(
      input({ today: WEDNESDAY, days: days({ 0: [100], 1: [100], 2: [100] }, t) }),
    );
    expect(withToday.food.kind === 'numbers' && withToday.food.patternNotice).toBe(false);
  });

  it('Tage ohne Eintrag und Einträge ohne kcal zählen nicht in den Durchschnitt', () => {
    const t = weekTargets();
    const target = t[0]?.targetKcal as number;
    const r = weekEvaluation(input({ days: days({ 0: [target], 2: [null] }, t) }));
    if (r.food.kind !== 'numbers') throw new Error('Zahlen');
    expect(r.food).toMatchObject({ entryDays: 2, valuedDays: 1, withoutValueDays: 1 });
    expect(r.food.average).toEqual({ eatenKcal: target, targetKcal: target });
  });

  it('ohne Tagesziel (keine Körperdaten): keine Zonen, kein Durchschnitt, Einladung einmal', () => {
    const t = weekTargets({ bodyMetricsRows: [] });
    const r = weekEvaluation(input({ days: days({ 0: [2000], 1: [2000] }, t) }));
    if (r.food.kind !== 'numbers') throw new Error('Zahlen');
    expect(r.food).toMatchObject({ entryDays: 2, valuedDays: 0, average: null });
    expect(r.food.targetNotices).toEqual(['body_data_missing']);
  });

  it('Tagebuch nicht verfügbar (ohne Einwilligung): Einträge werden ignoriert', () => {
    const r = weekEvaluation(
      input({
        days: days({ 0: [300], 1: [300], 2: [300] }, weekTargets(), {
          foodLog: { available: false, entries: [entry(300)] },
        }),
      }),
    );
    expect(r.food).toMatchObject({ available: false, entryDays: 0 });
    expect(r.food.kind === 'numbers' && r.food.patternNotice).toBe(false);
  });

  it('Mahlzeiten „x von y“ über die Tage bis heute (künftige nicht)', () => {
    const plan = { slots: ['breakfast', 'lunch', 'dinner'], belowFloor: false };
    const withPlan = days({}, weekTargets(), { mealPlan: plan }).map((d, i) =>
      i === 0
        ? {
            ...d,
            foodLog: {
              available: true,
              entries: [entry(400, 'breakfast', 'plan_item'), entry(600, 'lunch', 'plan_item')],
            },
          }
        : d,
    );
    const r = weekEvaluation(input({ today: WEDNESDAY, days: withPlan }));
    // Mo, Di, Mi (heute) je 3 Mahlzeiten, Do–So künftig ohne Abhak-Zahl.
    expect(r.food.meals).toEqual({ eaten: 2, planned: 9 });
  });

  it('künftige Woche („noch nicht begonnen“): nur Vorschau, Einheiten geplant', () => {
    const r = weekEvaluation(
      input({
        today: addDays(MONDAY, -3),
        sessions: [plannedSession('s1', DATES[1] as string)],
        plannedTargets: new Map([['s1', targets(4)]]),
      }),
    );
    expect(r.timing).toBe('future');
    expect(r.days.every((d) => d.timing === 'future')).toBe(true);
    expect(r.training.items[0]?.item.status).toBe('planned');
    expect(r.training.sessions).toEqual({ done: 0, planned: 1 });
    expect(r.training.strengthSets.planned).toBe(4);
    expect(r.food.kind === 'numbers' && r.food.valuedDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaften
// ---------------------------------------------------------------------------------------------------------

interface RandomWeek {
  readonly input: WeekEvaluationInput;
}

function randomWeeks(count: number, seed: number): RandomWeek[] {
  const rand = seededRandom(seed);
  const pick = <T>(values: readonly T[]): T => values[Math.floor(rand() * values.length)] as T;
  const result: RandomWeek[] = [];
  for (let n = 0; n < count; n += 1) {
    const nutritionSessions = Array.from({ length: Math.floor(rand() * 6) }, (_, i) =>
      rand() < 0.5
        ? session(addDays(MONDAY, i % 7), { minutes: 20 + Math.round(rand() * 80) })
        : run(addDays(MONDAY, i % 7), 20 + Math.round(rand() * 100), 1 + Math.floor(rand() * 4)),
    );
    const t = weekTargets({
      sex: pick(['male', 'female', 'diverse'] as const),
      birthDate: pick(['1950-03-01', '1990-01-01', '2009-06-01']),
      goalType: pick(['fat_loss', 'general_fitness', 'muscle_gain', 'endurance'] as const),
      bodyMetricsRows:
        rand() < 0.05
          ? []
          : [
              {
                measuredOn: '2026-10-01',
                heightCm: 150 + Math.round(rand() * 50),
                weightKg: 45 + Math.round(rand() * 155),
              },
            ],
      healthFlags: rand() < 0.05 ? { flags: ['pregnancy'] } : { flags: [] },
      sessions: nutritionSessions,
    });
    const eaten: Record<number, (number | null)[]> = {};
    for (let i = 0; i < 7; i += 1) {
      if (rand() < 0.3) continue;
      const floor = t[i]?.floorKcal ?? 1500;
      eaten[i] = Array.from({ length: 1 + Math.floor(rand() * 4) }, () =>
        rand() < 0.1 ? null : Math.round((rand() < 0.3 ? floor * rand() : 3500 * rand()) / 3),
      );
    }
    const sessions: SummarySession[] = [];
    const logs: SummaryLog[] = [];
    const achievements = new Map<string, SessionAchievementInput>();
    const plannedTargets = new Map<string, PlannedSessionTargets>();
    for (let i = 0; i < 7; i += 1) {
      const date = DATES[i] as string;
      const r = rand();
      if (r < 0.35) continue;
      const id = `s${i}`;
      const endurance = rand() < 0.4;
      const status = pick(['planned', 'planned', 'completed', 'skipped'] as const);
      sessions.push(
        plannedSession(id, date, {
          kind: endurance ? 'endurance' : 'strength',
          status,
          plan_active: rand() > 0.1,
        }),
      );
      const plannedSets = 2 + Math.floor(rand() * 10);
      const plannedMinutes = 20 + Math.floor(rand() * 60);
      plannedTargets.set(
        id,
        endurance ? targets(null, plannedMinutes) : targets(plannedSets, null, null),
      );
      if (status === 'completed' || rand() < 0.3) {
        const logId = `l${i}`;
        const minutes = Math.floor(rand() * 90);
        const sets = Array.from({ length: plannedSets }, () => rand() < 0.7);
        logs.push(
          log(logId, date, {
            planned_session_id: id,
            kind: endurance ? 'endurance' : 'strength',
            done_sets: endurance ? 0 : sets.filter(Boolean).length,
            cardio_duration_s: endurance ? minutes * 60 + Math.floor(rand() * 60) : null,
            cardio_distance_m: endurance ? Math.round(rand() * 12000) : null,
          }),
        );
        achievements.set(
          logId,
          endurance
            ? enduranceAchievement(minutes, plannedMinutes, null)
            : strengthAchievement(sets, plannedSets),
        );
      }
    }
    // Freie Einheiten.
    for (let k = 0; k < Math.floor(rand() * 3); k += 1) {
      const id = `f${k}`;
      const endurance = rand() < 0.5;
      const minutes = 10 + Math.floor(rand() * 60);
      logs.push(
        log(id, pick(DATES), {
          is_free: true,
          kind: endurance ? 'endurance' : 'strength',
          done_sets: endurance ? 0 : 1 + Math.floor(rand() * 8),
          cardio_duration_s: endurance ? minutes * 60 : null,
          cardio_distance_m: endurance ? Math.round(rand() * 8000) : null,
        }),
      );
      achievements.set(
        id,
        endurance
          ? enduranceAchievement(minutes, null, null, true)
          : strengthAchievement([true, true], null, null, true),
      );
    }
    result.push({
      input: input({
        today: pick([NEXT_MONDAY, WEDNESDAY, MONDAY, addDays(MONDAY, 6), addDays(MONDAY, -2)]),
        showNumbers: rand() > 0.2,
        days: days(eaten, t),
        sessions,
        logs,
        achievements,
        plannedTargets,
      }),
    });
  }
  return result;
}

describe('Eigenschaften (Abschnitt 8)', () => {
  const weeks = randomWeeks(250, 20261015);

  it('Tage der Woche = „Dein Tag“ für jeden Tag (gleiche Eingaben, gleiches Ergebnis)', () => {
    for (const { input: w } of weeks) {
      const r = weekEvaluation(w);
      const summary = weekLogSummary(w.sessions, w.logs, w.weekStart, w.today);
      w.days.forEach((day, i) => {
        const single = dayEvaluation({
          ...day,
          today: w.today,
          showNumbers: r.showNumbers,
          trainingItems: summary.days[i]?.items ?? [],
          achievements: w.achievements,
        });
        expect(r.days[i]).toEqual(single);
      });
    }
  }, 60_000);

  it('Wochenzahlen = Summe der Tagesansichten (Essen und Training)', () => {
    let withPattern = 0;
    for (const { input: w } of weeks) {
      const r = weekEvaluation(w);
      const past = r.days.filter((d) => d.timing === 'past');
      expect(r.food.entryDays).toBe(past.filter((d) => d.food.entryCount > 0).length);
      const meals = r.days.filter((d) => d.food.meals !== null);
      expect(r.food.meals === null).toBe(meals.length === 0);
      if (r.food.kind === 'numbers') {
        const bars = past.flatMap((d) => (d.food.intake.kind === 'bar' ? [d.food.intake] : []));
        expect(r.food.valuedDays).toBe(bars.length);
        for (const zone of INTAKE_ZONE_IDS) {
          expect(r.food.zoneCounts[zone]).toBe(bars.filter((b) => b.zone === zone).length);
        }
        const zoneSum = Object.values(r.food.zoneCounts).reduce((s, n) => s + n, 0);
        expect(zoneSum).toBe(r.food.valuedDays);
        expect(r.food.withoutValueDays).toBe(r.food.entryDays - r.food.valuedDays);
        expect(r.food.belowFloorDays).toBe(r.food.zoneCounts.below_floor);
        expect(r.food.patternNotice).toBe(r.food.belowFloorDays >= 3);
        if (r.food.patternNotice) withPattern += 1;
      }
      // Training: Liste = Einträge der Tage, Summen = Summe über die Tage.
      const dayItems = r.days.flatMap((d) => d.training.items);
      expect(r.training.items.length + r.training.free.length).toBe(dayItems.length);
      const summary = weekLogSummary(w.sessions, w.logs, w.weekStart, w.today);
      expect(r.training.sessions.done + r.training.freeTotals.sessions).toBe(summary.sessionsDone);
      expect(r.training.sessions.planned).toBe(summary.sessionsPlanned);
      expect(r.training.strengthSets.done + r.training.freeTotals.strengthSets).toBe(
        summary.strengthSets,
      );
      expect(r.training.enduranceMinutes.done + r.training.freeTotals.enduranceMinutes).toBe(
        summary.enduranceMinutes,
      );
      expect(Math.round((r.training.distanceM + r.training.freeTotals.distanceM) / 100) / 10).toBe(
        summary.enduranceKm,
      );
      let fulfilled = 0;
      let minutes = 0;
      for (const { achievement, item } of r.training.items) {
        if (item.free) throw new Error('freie Einheit in der Plan-Liste');
        for (const e of achievement?.exercises ?? []) fulfilled += e.fulfilledSets;
        minutes += achievement?.endurance?.minutes ?? 0;
      }
      expect(r.training.strengthSets.fulfilled).toBe(fulfilled);
      expect(r.training.enduranceMinutes.done).toBe(minutes);
      expect(r.training.strengthSets.fulfilled).toBeLessThanOrEqual(
        r.training.strengthSets.planned,
      );
      expect(r.training.free.every((f) => f.item.free)).toBe(true);
    }
    expect(withPattern).toBeGreaterThan(5);
  }, 60_000);

  it('Durchschnitt nur über eingetragene Tage: Tage ohne Eintrag ändern ihn nie', () => {
    for (const { input: w } of weeks) {
      const r = weekEvaluation(w);
      if (r.food.kind !== 'numbers') continue;
      const bars = r.days
        .filter((d) => d.timing === 'past')
        .flatMap((d) => (d.food.intake.kind === 'bar' ? [d.food.intake] : []));
      if (bars.length === 0) {
        expect(r.food.average).toBeNull();
        continue;
      }
      const eaten = bars.reduce((s, b) => s + b.eatenKcal, 0) / bars.length;
      const target = bars.reduce((s, b) => s + b.targetKcal, 0) / bars.length;
      expect(r.food.average?.eatenKcal).toBeCloseTo(eaten, 9);
      expect(r.food.average?.targetKcal).toBeCloseTo(target, 9);
      // Einträge an Tagen ohne Eintrag entfernen bzw. leere Tage leeren → Ø gleich.
      const emptied = weekEvaluation({
        ...w,
        days: w.days.map((d, i) =>
          r.days[i]?.food.intake.kind === 'bar'
            ? d
            : { ...d, foodLog: { ...d.foodLog, entries: [] } },
        ),
      });
      expect(emptied.food.kind === 'numbers' && emptied.food.average).toEqual(r.food.average);
    }
  }, 60_000);

  it('keine Wochen-Bilanz, keine Summe in kcal, keine Prognose', () => {
    for (const { input: w } of weeks) {
      const r = weekEvaluation(w);
      const keys = allKeys(r.food);
      expect(keys.join(' ')).not.toMatch(
        /balance|bilanz|saved|deficit|surplus|forecast|prognos|total|sum|weight|kg/i,
      );
      if (r.food.kind === 'numbers') {
        expect(Object.keys(r.food).sort()).toEqual(
          [
            'kind',
            'available',
            'entryDays',
            'valuedDays',
            'withoutValueDays',
            'zoneCounts',
            'average',
            'belowFloorDays',
            'patternNotice',
            'meals',
            'todayOpen',
            'targetNotices',
          ].sort(),
        );
        // Einzige kcal-Werte der Woche: der Durchschnitt (je Tag), nie eine Summe über mehrere Tage.
        const kcal = numbersIn(r.food).filter((n) => /kcal/i.test(n.path));
        expect(kcal.map((n) => n.path).sort()).toEqual(
          r.food.average === null ? [] : ['average.eatenKcal', 'average.targetKcal'],
        );
      }
      expect(allKeys(r).join(' ')).not.toMatch(/balance|bilanz|forecast|prognos/i);
    }
  }, 60_000);

  it('ohne Zahlen: nirgends eine kcal-Zahl, im Essensteil nur Anzahlen', () => {
    let hidden = 0;
    for (const { input: w } of weeks) {
      const r = weekEvaluation({ ...w, showNumbers: false });
      hidden += 1;
      expect(r.showNumbers).toBe(false);
      for (const n of numbersIn(r.food)) {
        expect(['entryDays', 'meals.eaten', 'meals.planned']).toContain(n.path);
        expect(n.value).toBeLessThan(100);
      }
      for (const day of r.days) {
        expect(day.food.intake).toEqual({ kind: 'hidden' });
        expect(
          JSON.stringify({ i: day.food.intake, n: day.notices, t: day.food.targetNotices }),
        ).not.toMatch(/\d/);
      }
      expect(JSON.stringify(r)).not.toMatch(/kcal/i);
    }
    expect(hidden).toBe(weeks.length);
  }, 60_000);

  it('Muster-Hinweis genau ab 3 vergangenen Tagen unter der Untergrenze (Orakel aus den Tageszielen)', () => {
    for (const { input: w } of weeks) {
      const r = weekEvaluation(w);
      if (r.food.kind !== 'numbers') continue;
      // Unabhängig: vergangene Tage mit Einträgen (mit kcal) und Summe < floorKcal.
      const oracle = w.days.filter((d) => {
        if (d.date >= w.today || d.targets?.floorKcal == null || d.targets.targetKcal === null) {
          return false;
        }
        if (!d.foodLog.available) return false;
        const values = d.foodLog.entries.map((e) => e.kcal).filter((k): k is number => k !== null);
        return values.length > 0 && values.reduce((s, k) => s + k, 0) < d.targets.floorKcal;
      }).length;
      expect(r.food.belowFloorDays).toBe(oracle);
      expect(r.food.patternNotice).toBe(oracle >= 3);
    }
  }, 60_000);
});

describe('Strukturtest (keine eigenen Grenzwerte, wie A2 Eigenschaft d)', () => {
  it('week-evaluation.ts rechnet keine Grenzen und nutzt nur WEEK_EVALUATION', () => {
    const source = readFileSync(join(import.meta.dirname, 'week-evaluation.ts'), 'utf8');
    expect(source).not.toMatch(
      /\b(clampCalorieTarget|dayFloorKcal|dayCeilingKcal|planBand|dayLimitContext|dayEnergy|nutritionMacros|mealPlanBand|intakeZone|nutritionTargetsForWeek)\s*\(/,
    );
    expect(source).not.toMatch(
      /\b(MAX_CALORIE_DEFICIT_FRACTION|MIN_INTAKE_RELATIVE_TO_BMR|MAX_WEEKLY_WEIGHT_LOSS_FRACTION|MAX_WEEKLY_WEIGHT_GAIN_FRACTION|EA_MIN_KCAL_PER_KG_FFM|SPECIAL_CASE_DEFICIT_CAPS|SURPLUS_CAP|PORTION_TOLERANCE|PLAN_BAND_MIN_WIDTH_KCAL|TRAINING_KCAL_DAY_MAX|INTAKE_ZONES|SESSION_ACHIEVEMENT|KCAL_PER_KG_BODY_WEIGHT)\b/,
    );
    // Keine Rechnung mit Untergrenze/Ziel selbst – nur die Ergebnisse von dayEvaluation.
    expect(source).not.toMatch(/\.(floorKcal|ceilingKcal|band|goalAdjustment)\b/);
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const path of imports) {
      expect([
        '../age',
        '../constants',
        '../dates',
        '../log/achievement',
        '../log/summary',
        '../nutrition/notices',
        './day-evaluation',
        './intake-zone',
      ]).toContain(path);
    }
    const constants = source.match(/import \{([^}]*)\} from '\.\.\/constants'/)?.[1];
    expect(constants?.trim()).toBe('WEEK_EVALUATION');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/'[^']*'/g, "''");
    const numbers = [...code.matchAll(/(?<![\w.])(\d+(?:\.\d+)?(?:e-?\d+)?)(?![\w])/g)].map(
      (m) => m[1],
    );
    expect(numbers.filter((n) => !['0', '1'].includes(n as string))).toEqual([]);
  });
});
