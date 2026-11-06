/**
 * Essen nach dem Training (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md 6a): nach JEDER erledigten Einheit
 * (geplant, frei, Smartwatch) wird die Ernährung des restlichen Tages angepasst und die App zeigt „Das solltest du jetzt
 * essen“. Geprüft: Entscheidung „jetzt Fenster nach dem Training?“ (Grenzen 0/180 min, ohne Uhrzeit, schon gegessen,
 * zwei Einheiten, nach 23 Uhr), Anpassung des gespeicherten Plans nur für Kommendes, Energie/Grenzen unverändert.
 */
import { describe, expect, it } from 'vitest';

import { POST_WORKOUT_WINDOW_MIN } from '../constants';
import { freeSessionNutritionSessions } from '../log/free-session';
import { buildMealPlanWeek, type MealPlanInput } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  completedNutritionSessionIds,
  hasRecentlyFinishedSession,
  postWorkoutMealNow,
} from './post-workout';
import type { NutritionSessionInput } from './schemas';
import { nutritionTargetsForWeek, type NutritionWeekTargets } from './targets';
import { inputs, MONDAY, session } from './test-helpers';
import {
  adaptMealPlanToTraining,
  mealSlotPassed,
  resolveMealPlanWeekWithTraining,
} from './training-replan';
import {
  type TimelineEntry,
  timingSnackCandidates,
  type TrainingDayTimeline,
  trainingDayTimeline,
} from './training-timeline';

const PROFILE = { diet: 'omnivore' } as const;
const OPTIONS = {
  trainingTime: 'evening' as const,
  body: { weightKg: 80, heightCm: 180 },
  showNumbers: true,
  experienceLevel: 'beginner' as const,
};

function week(sessions: NutritionSessionInput[]): NutritionWeekTargets {
  return nutritionTargetsForWeek(
    inputs({ today: MONDAY, mealsPerDay: 4, trainingTime: 'evening', sessions }),
    MONDAY,
  );
}

function engineInput(
  targets: NutritionWeekTargets,
): Omit<MealPlanInput, 'existingPlan' | 'variant'> {
  return {
    targets,
    profile: PROFILE,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: MONDAY,
  };
}

/** Freie Einheit wie aus dem Tagebuch (Timer bzw. Smartwatch), Beginn als Zeitstempel. */
function freeLog(id: string, startedAt: string | null, minutesSets = 10) {
  return freeSessionNutritionSessions(
    [
      {
        id,
        is_free: true,
        performed_on: MONDAY,
        kind: 'strength',
        session_rpe: null,
        started_at: startedAt,
      },
    ],
    { cardio: [], doneSets: new Map([[id, minutesSets]]) },
  );
}

describe('Fenster nach dem Training (postWorkoutMealNow) mit echtem Essensplan', () => {
  // Freie Kraft-Einheit 10:30 (Europe/Berlin, Sommerzeit bis 25.10.), 10 Sätze → 30 min → Ende 11:00; Mittag 12:30.
  const free = freeLog('w1', '2026-10-12T08:30:00Z');
  const targets = week(free);
  const plan = buildMealPlanWeek({ ...engineInput(targets), variant: 0 });
  const day = targets.days[0];
  if (day === undefined) throw new Error('Testwoche fehlt');
  const snacks = timingSnackCandidates(engineInput(targets), day);
  const timeline = trainingDayTimeline(day, plan.days[0] ?? null, OPTIONS, snacks);
  const completed = new Set(['free:w1']);
  const base = {
    day,
    timeline,
    today: MONDAY,
    eaten: new Set<string>(),
    completedSessionIds: completed,
  };

  it('freie Einheit bekommt die echte Uhrzeit → Mittag wird „nach dem Training“', () => {
    expect(free[0]?.startMinutes).toBe(10 * 60 + 30);
    expect(day.trainingTiming?.windows[0]).toMatchObject({ start: 630, end: 660, approx: false });
    expect(day.slots.find((s) => s.slot === 'lunch')?.role).toBe('post');
  });

  it('gleich nach dem Ende: Mittagessen aus dem Plan mit Eiweiß/KH dieses Platzes', () => {
    const now = postWorkoutMealNow({ ...base, nowMinutes: 11 * 60 + 5 });
    expect(now).not.toBeNull();
    expect(now?.slot).toBe('lunch');
    expect(now?.sessionId).toBe('free:w1');
    expect(now?.endMinutes).toBe(660);
    expect(now?.untilMinutes).toBe(660 + 120);
    expect(now?.minutesSinceEnd).toBe(5);
    expect(now?.meal?.recipeId).toBe(plan.days[0]?.meals.find((m) => m.slot === 'lunch')?.recipeId);
    const target = day.trainingTiming?.mealTargets?.find((t) => t.slot === 'lunch');
    expect(now?.proteinG).toBe(Math.round(target?.proteinGuideG ?? -1));
    // Eine Einheit am Tag: kein Auffüll-Richtwert → geplanter KH-Anteil des Platzes.
    expect(target?.carbsGuideG).toBeNull();
    expect(now?.carbsG).toBe(Math.round(target?.carbsG ?? -1));
    // 0,4 g/kg bei 80 kg.
    expect(now?.proteinG).toBe(32);
    expect(now?.proteinG).toBeGreaterThan(0);
  });

  it('Grenzen: genau 180 min danach noch, 181 min nicht mehr; vor dem Beginn nicht', () => {
    expect(
      postWorkoutMealNow({ ...base, nowMinutes: 660 + POST_WORKOUT_WINDOW_MIN }),
    ).not.toBeNull();
    expect(
      postWorkoutMealNow({ ...base, nowMinutes: 660 + POST_WORKOUT_WINDOW_MIN + 1 }),
    ).toBeNull();
    expect(postWorkoutMealNow({ ...base, nowMinutes: 629 })).toBeNull();
    // Gerade eingetragen, laut Dauer „noch nicht vorbei“: gilt als eben beendet.
    expect(postWorkoutMealNow({ ...base, nowMinutes: 640 })?.minutesSinceEnd).toBe(0);
  });

  it('schon gegessen, nicht erledigt, anderer Tag → keine Karte', () => {
    expect(
      postWorkoutMealNow({ ...base, nowMinutes: 700, eaten: new Set([`${MONDAY}|lunch`]) }),
    ).toBeNull();
    expect(
      postWorkoutMealNow({ ...base, nowMinutes: 700, completedSessionIds: new Set() }),
    ).toBeNull();
    expect(postWorkoutMealNow({ ...base, nowMinutes: 700, today: '2026-10-13' })).toBeNull();
    expect(postWorkoutMealNow({ ...base, nowMinutes: 700, timeline: null })).toBeNull();
  });

  it('ohne Gramm (Kalorienzahlen aus): Gericht ja, Eiweiß/KH null', () => {
    const plain = trainingDayTimeline(day, plan.days[0] ?? null, {
      ...OPTIONS,
      showNumbers: false,
    });
    const now = postWorkoutMealNow({ ...base, timeline: plain, nowMinutes: 700 });
    expect(now?.slot).toBe('lunch');
    expect(now?.meal?.values).toBeNull();
    expect(now?.proteinG).toBeNull();
    expect(now?.carbsG).toBeNull();
  });

  it('Zod: ungültige Uhrzeit bzw. ungültiges Datum → Fehler', () => {
    expect(() => postWorkoutMealNow({ ...base, nowMinutes: 1440 })).toThrow();
    expect(() => postWorkoutMealNow({ ...base, nowMinutes: 1.5 })).toThrow();
    expect(() => postWorkoutMealNow({ ...base, nowMinutes: 0, today: 'heute' })).toThrow();
  });

  it('ohne Beginn (manuell, ohne Uhrzeit): kein Fenster mit Uhrzeit → keine Karte', () => {
    const t = week(freeLog('w2', null));
    const d = t.days[0];
    if (d === undefined) throw new Error('Testwoche fehlt');
    const tl = trainingDayTimeline(d, null, OPTIONS);
    expect(
      postWorkoutMealNow({
        day: d,
        timeline: tl,
        today: MONDAY,
        nowMinutes: 700,
        eaten: new Set(),
        completedSessionIds: new Set(['free:w2']),
      }),
    ).toBeNull();
  });

  it('Energie und Schutzgrenzen: mit und ohne Uhrzeit identisch (nur Rollen ändern sich)', () => {
    const untimed = week(freeLog('w1', null));
    const pick = (t: NutritionWeekTargets) =>
      t.days.map((d) => [
        d.targetKcal,
        d.band,
        d.floorKcal,
        d.ceilingKcal,
        d.proteinG,
        d.carbsG,
        d.fatG,
      ]);
    expect(pick(targets)).toEqual(pick(untimed));
  });
});

describe('Anpassung des gespeicherten Plans nach einer Einheit (nur Kommendes)', () => {
  // Plan ohne Training gespeichert; dann Lauf von der Uhr 6:30–7:00 und Kraft frei 10:30.
  const restTargets = week([]);
  const stored = buildMealPlanWeek({ ...engineInput(restTargets), variant: 0 });
  const afterTargets = week(freeLog('w1', '2026-10-12T08:30:00Z'));
  const input = engineInput(afterTargets);

  it('Einheit erscheint → heute angepasst (training_changed), Mittag „nach dem Training“', () => {
    const resolved = resolveMealPlanWeekWithTraining(stored, input, {
      eaten: new Set(),
      now: { date: MONDAY, minutes: 11 * 60 + 5 },
    });
    expect(resolved.action).toBe('replanned');
    if (resolved.action === 'replanned') expect(resolved.reasons).toEqual(['training_changed']);
    expect(resolved.training?.dates).toContain(MONDAY);
    expect(resolved.plan.days[0]?.meals.find((m) => m.slot === 'lunch')?.role).toBe('post');
    // Andere Tage unverändert.
    expect(resolved.plan.days.slice(1)).toEqual(stored.days.slice(1));
  });

  it('heute schon vergangene Plätze (Frühstück 7:30) bleiben unverändert – Rezept und Portion', () => {
    const breakfast = stored.days[0]?.meals.find((m) => m.slot === 'breakfast');
    const result = adaptMealPlanToTraining(stored, input, {
      eaten: new Set(),
      now: { date: MONDAY, minutes: 11 * 60 },
    });
    const after = result?.plan.days[0]?.meals.find((m) => m.slot === 'breakfast');
    expect(after?.recipeId).toBe(breakfast?.recipeId);
    expect(after?.factor).toBe(breakfast?.factor);
    expect(result?.changes.some((c) => c.slot === 'breakfast')).toBe(false);
  });

  it('mealSlotPassed: nur heute, nur vor „jetzt“, ohne now nie', () => {
    const now = { now: { date: MONDAY, minutes: 12 * 60 } };
    expect(mealSlotPassed(MONDAY, 'breakfast', now)).toBe(true);
    expect(mealSlotPassed(MONDAY, 'lunch', now)).toBe(false);
    expect(mealSlotPassed('2026-10-13', 'breakfast', now)).toBe(false);
    expect(mealSlotPassed(MONDAY, 'breakfast', {})).toBe(false);
    expect(mealSlotPassed(MONDAY, 'extra_1', now)).toBe(false);
  });
});

describe('Entscheidung mit gebauter Zeitleiste (Grenzfälle)', () => {
  const entry = (e: Partial<TimelineEntry> & Pick<TimelineEntry, 'kind'>): TimelineEntry => ({
    key: `${e.kind}-${e.fromMinutes ?? 0}`,
    fromMinutes: 0,
    toMinutes: 0,
    approx: false,
    reason: 'post_meal',
    meal: null,
    extra: null,
    extraKind: null,
    session: null,
    ...e,
  });
  const sessionEntry = (id: string, from: number, to: number, approx = false) =>
    entry({
      kind: 'session',
      fromMinutes: from,
      toMinutes: to,
      approx,
      reason: 'session_short',
      session: { sessionId: id, kind: 'strength', minutes: to - from, fueling: null },
    });
  const meal = (slot: 'lunch' | 'dinner' | 'snack_late') => ({
    slot,
    recipeId: `r-${slot}`,
    titleDe: `Gericht ${slot}`,
    factor: 1,
    values: null,
    status: 'fits' as const,
    chosen: false,
  });
  const post = (from: number, m: ReturnType<typeof meal> | null, extra = false) =>
    entry({
      kind: 'post_meal',
      fromMinutes: from,
      toMinutes: from + 120,
      meal: m,
      extra: extra ? { recipeId: 'snack', titleDe: 'Quark', values: null } : null,
      extraKind: extra ? 'snack' : null,
    });
  const tl = (entries: TimelineEntry[]): TrainingDayTimeline => ({
    date: MONDAY,
    approx: false,
    grams: false,
    entries,
  });
  const decide = (entries: TimelineEntry[], nowMinutes: number, completed: string[]) =>
    postWorkoutMealNow({
      day: { date: MONDAY },
      timeline: tl(entries),
      today: MONDAY,
      nowMinutes,
      eaten: new Set(),
      completedSessionIds: new Set(completed),
    });

  it('zwei Einheiten: die zuletzt beendete zählt (Auffüll-Mahlzeit dazwischen vorher)', () => {
    const entries = [
      sessionEntry('a', 8 * 60, 9 * 60),
      post(9 * 60, meal('lunch')),
      sessionEntry('b', 16 * 60, 17 * 60),
      post(17 * 60, meal('dinner')),
    ];
    expect(decide(entries, 9 * 60 + 30, ['a'])?.slot).toBe('lunch');
    expect(decide(entries, 17 * 60 + 30, ['a', 'b'])?.slot).toBe('dinner');
    // Zweite Einheit läuft schon (Uhrzeit erreicht), ist aber nicht erledigt → keine Karte.
    expect(decide(entries, 16 * 60 + 10, ['a'])).toBeNull();
    // Einheit ohne Uhrzeit („ca.“) zählt nie.
    expect(
      decide([sessionEntry('c', 600, 660, true), post(660, meal('lunch'))], 700, ['c']),
    ).toBeNull();
  });

  it('nach 23 Uhr: Ende über Mitternacht hinaus, Spät-Snack bzw. Snack-Vorschlag', () => {
    const late = [sessionEntry('n', 23 * 60, 24 * 60), post(24 * 60, null, true)];
    const now = decide(late, 23 * 60 + 30, ['n']);
    expect(now?.slot).toBeNull();
    expect(now?.extra?.titleDe).toBe('Quark');
    expect(now?.minutesSinceEnd).toBe(0);
    // Weder Mahlzeit noch Snack: keine Karte.
    expect(decide([sessionEntry('n', 1380, 1440), post(1440, null)], 1400, ['n'])).toBeNull();
  });

  it('kein „nach dem Training“-Eintrag direkt danach → keine Karte', () => {
    expect(decide([sessionEntry('a', 600, 660)], 700, ['a'])).toBeNull();
  });
});

describe('Hilfen für die App', () => {
  it('completedNutritionSessionIds: erledigt geplant + frei (auch vorzeitig beendet) als free:<id>', () => {
    expect(
      [
        ...completedNutritionSessionIds(
          [
            { id: 'p1', status: 'completed' },
            { id: 'p2', status: 'planned' },
          ],
          [
            { id: 'l1', is_free: true, status: 'completed' },
            { id: 'l2', is_free: false, status: 'completed' },
            { id: 'l3', is_free: true, status: 'partial' },
            { id: 'l4', is_free: true, status: 'unbekannt' },
          ],
        ),
      ].sort(),
    ).toEqual(['free:l1', 'free:l3', 'p1']);
  });

  it('hasRecentlyFinishedSession: Ende bzw. Beginn bis 180 min vorher, erledigt oder vorzeitig beendet', () => {
    const now = Date.parse('2026-10-12T12:00:00+02:00');
    const log = (finished: string | null, started: string | null = null, status = 'completed') => ({
      status,
      started_at: started,
      finished_at: finished,
    });
    expect(hasRecentlyFinishedSession([log('2026-10-12T09:00:00+02:00')], now)).toBe(true);
    expect(hasRecentlyFinishedSession([log('2026-10-12T08:59:00+02:00')], now)).toBe(false);
    expect(hasRecentlyFinishedSession([log(null, '2026-10-12T11:00:00+02:00')], now)).toBe(true);
    expect(
      hasRecentlyFinishedSession([log('2026-10-12T11:30:00+02:00', null, 'partial')], now),
    ).toBe(true);
    expect(
      hasRecentlyFinishedSession([log('2026-10-12T11:30:00+02:00', null, 'unbekannt')], now),
    ).toBe(false);
    expect(hasRecentlyFinishedSession([log('2026-10-12T12:04:00+02:00')], now)).toBe(true);
    expect(hasRecentlyFinishedSession([log('2026-10-12T12:30:00+02:00')], now)).toBe(false);
    expect(hasRecentlyFinishedSession([log(null), log('kaputt')], now)).toBe(false);
    expect(hasRecentlyFinishedSession([], now)).toBe(false);
  });

  it('geplante Einheit erledigt: echter Beginn statt Planung (zusammen mit timing)', () => {
    const planned = session(MONDAY, { status: 'completed', startMinutes: 7 * 60 });
    const t = week([planned]);
    expect(t.days[0]?.trainingTiming?.windows[0]?.start).toBe(420);
  });
});
