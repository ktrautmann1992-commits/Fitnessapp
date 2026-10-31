import { z } from 'zod';

import { isoDateSchema } from './age';
import { MEAL_SLOT_TIMES, REMINDERS } from './constants';
import { addDays } from './dates';
import { TRAINING_TIMES, type TrainingTime } from './enums';
import { zonedTimeToUtcMs } from './notifications';
import {
  isSnackSlot,
  type MealRole,
  type MealSlotId,
  mealRolesForWindows,
  trainingWindows,
} from './nutrition/timing';
import { windowIndexForSlot } from './nutrition/training-meal-targets';

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md, Gründer-Wunsch 29.10.2026): nur die
 * Zeitrechnung – WANN welche lokale Benachrichtigung kommt. Planen, Texte und Android-Kanäle übernimmt die App.
 * Alles deterministisch aus Einstellungen, geplanten Einheiten (mit Uhrzeit) und Mahlzeiten des Essensplans; keine
 * Gesundheitswerte. Nachtruhe (REMINDERS.quiet*) gilt immer.
 */

/** Minute des Tages (0–1439). */
const minuteOfDaySchema = z
  .number()
  .int()
  .min(0)
  .max(24 * 60 - 1);
/** Essenszeit: im Raster, innerhalb der Wachzeit. */
const mealTimeSchema = minuteOfDaySchema
  .min(REMINDERS.mealMinMinutes)
  .max(REMINDERS.mealMaxMinutes)
  .refine((m) => m % REMINDERS.timeStepMinutes === 0, 'Essenszeit im 30-Minuten-Raster.');
const drinkTimeSchema = minuteOfDaySchema
  .min(REMINDERS.quietToMinutes)
  .max(REMINDERS.quietFromMinutes)
  .refine((m) => m % REMINDERS.timeStepMinutes === 0, 'Uhrzeit im 30-Minuten-Raster.');

const leadSchema = z
  .number()
  .int()
  .refine((m) => (REMINDERS.trainingLeadOptions as readonly number[]).includes(m));
const everySchema = z
  .number()
  .int()
  .refine((m) => (REMINDERS.drinkEveryOptions as readonly number[]).includes(m));

export const trainingReminderSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  leadMinutes: leadSchema,
});
export const mealReminderSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  breakfast: mealTimeSchema,
  lunch: mealTimeSchema,
  dinner: mealTimeSchema,
});
export const drinkReminderSettingsSchema = z
  .strictObject({
    enabled: z.boolean(),
    fromMinutes: drinkTimeSchema,
    toMinutes: drinkTimeSchema,
    everyMinutes: everySchema,
  })
  .refine((d) => d.fromMinutes < d.toMinutes, 'Das Zeitfenster muss vor dem Ende beginnen.');

export const reminderSettingsSchema = z.strictObject({
  training: trainingReminderSettingsSchema,
  meals: mealReminderSettingsSchema,
  drink: drinkReminderSettingsSchema,
});

export type TrainingReminderSettings = z.infer<typeof trainingReminderSettingsSchema>;
export type MealReminderSettings = z.infer<typeof mealReminderSettingsSchema>;
export type DrinkReminderSettings = z.infer<typeof drinkReminderSettingsSchema>;
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
export type ReminderKind = keyof ReminderSettings;

/** Standard: alles AUS (Opt-in), Zeiten wie REMINDERS. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  training: { enabled: false, leadMinutes: REMINDERS.trainingLeadDefault },
  meals: { enabled: false, ...REMINDERS.mealDefaults },
  drink: { enabled: false, ...REMINDERS.drinkDefaults },
};

/**
 * Gespeicherte Einstellung lesen: je Bereich gültig übernehmen, sonst der Standard dieses Bereichs (ein kaputter Wert
 * schaltet nie etwas ein und sperrt die anderen Bereiche nicht).
 */
export function parseReminderSettings(value: unknown): ReminderSettings {
  const raw = (value !== null && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const pick = <K extends ReminderKind>(key: K, schema: z.ZodType<ReminderSettings[K]>) => {
    const parsed = schema.safeParse(raw[key]);
    return parsed.success ? parsed.data : DEFAULT_REMINDER_SETTINGS[key];
  };
  return {
    training: pick('training', trainingReminderSettingsSchema),
    meals: pick('meals', mealReminderSettingsSchema),
    drink: pick('drink', drinkReminderSettingsSchema),
  };
}

/** Uhrzeit in `timeStepMinutes`-Schritten verschieben, begrenzt auf [min, max]. */
export function nudgeReminderTime(minutes: number, direction: -1 | 1, min: number, max: number) {
  const next = minutes + direction * REMINDERS.timeStepMinutes;
  return Math.min(Math.max(next, min), max);
}

/** Liegt die Minute des Tages in der Nachtruhe (22:00–07:00)? */
export function inQuietHours(minutes: number): boolean {
  return minutes >= REMINDERS.quietFromMinutes || minutes < REMINDERS.quietToMinutes;
}

export const reminderSessionSchema = z.strictObject({
  id: z.string().min(1),
  nameDe: z.string(),
  kind: z.enum(['strength', 'endurance']),
  minutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  /** Eigene Uhrzeit der Einheit (planned_sessions.start_time) bzw. null. */
  startMinutes: minuteOfDaySchema.nullable(),
});

const mealSlotIds = Object.keys(MEAL_SLOT_TIMES) as [MealSlotId, ...MealSlotId[]];

export const reminderDaySchema = z.strictObject({
  date: isoDateSchema,
  /** Noch offene geplante Einheiten des Tages (nicht erledigt/ausgelassen). */
  sessions: z.array(reminderSessionSchema),
  /** Mahlzeiten aus dem Essensplan (Platz + Gericht); null = kein Plan → Frühstück, Mittag, Abend. */
  meals: z
    .array(z.strictObject({ slot: z.enum(mealSlotIds), titleDe: z.string().min(1).nullable() }))
    .nullable(),
});

/**
 * Stand des Trink-Trackers für EINEN Kalendertag (Tagesziel = Richtwert aus hydrationGoal, Menge = Summe der Einträge).
 * `goalMl` null = kein Ziel (Herz/Niere, kein Gewicht) → Trink-Erinnerungen wie bisher.
 */
export const drinkProgressSchema = z.strictObject({
  date: isoDateSchema,
  totalMl: z.number().int().min(0),
  goalMl: z.number().int().positive().nullable(),
});
export type DrinkProgress = z.infer<typeof drinkProgressSchema>;

/** Tagesziel erreicht (Menge ≥ Ziel)? Ohne Ziel bzw. ohne Tracker-Stand nie. */
export function drinkGoalReached(progress: DrinkProgress | null | undefined): boolean {
  return progress?.goalMl != null && progress.totalMl >= progress.goalMl;
}

export const reminderInputSchema = z.strictObject({
  days: z.array(reminderDaySchema).max(REMINDERS.horizonDays),
  /**
   * Trink-Tracker (optional): Ist an diesem Tag das Tagesziel erreicht, entfallen dort alle (restlichen)
   * Trink-Erinnerungen. Gilt nur für genau diesen Tag – ein Stand von gestern (über Mitternacht) wirkt nicht.
   */
  drinkProgress: drinkProgressSchema.nullable().optional(),
  settings: reminderSettingsSchema,
  /** Angabe „Trainingszeit“ – Start für Einheiten ohne eigene Uhrzeit („ca.“). */
  trainingTime: z.enum(TRAINING_TIMES).nullable(),
  nowMs: z.number().finite(),
  timeZone: z.string().min(1),
});

export type ReminderSession = z.infer<typeof reminderSessionSchema>;
export type ReminderDay = z.infer<typeof reminderDaySchema>;
export type ReminderInput = z.input<typeof reminderInputSchema>;

interface Base {
  /** Feste Kennung je Tag und Anlass – erneutes Planen ersetzt, legt nie doppelt an. */
  readonly id: string;
  readonly date: string;
  /** Uhrzeit (Minuten nach Mitternacht, Ortszeit). */
  readonly minutes: number;
  readonly atMs: number;
}

export type PlannedReminder =
  | (Base & {
      readonly kind: 'training';
      /** Name der (ersten) Einheit. */
      readonly sessionNameDe: string;
      /** Start; null = ohne Uhrzeit (Erinnerung am Morgen). */
      readonly startMinutes: number | null;
      /** Start nur aus „Trainingszeit“ („ca.“). */
      readonly approx: boolean;
      /** Anzahl Einheiten ohne Uhrzeit an diesem Tag (sonst 1). */
      readonly count: number;
    })
  | (Base & {
      readonly kind: 'meal';
      /** Platz im Essensplan; null = Hinweis ohne eigene Mahlzeit (Snack vorher bzw. Essen danach). */
      readonly slot: MealSlotId | null;
      readonly role: Exclude<MealRole, null> | null;
      readonly titleDe: string | null;
      /** Start der Einheit, zu der die Mahlzeit gehört (nur mit Rolle). */
      readonly sessionStartMinutes: number | null;
    })
  | (Base & { readonly kind: 'drink' });

const FIXED_MEALS: readonly MealSlotId[] = ['breakfast', 'lunch', 'dinner'];

/** Eigene Essenszeit für Frühstück/Mittag/Abend (die Hauptmahlzeit „main“ = Mittag), sonst Standard des Platzes. */
function mealTime(slot: MealSlotId, meals: MealReminderSettings): number {
  if (slot === 'breakfast') return meals.breakfast;
  if (slot === 'lunch' || slot === 'main') return meals.lunch;
  if (slot === 'dinner') return meals.dinner;
  return MEAL_SLOT_TIMES[slot];
}

type Draft =
  | Omit<Extract<PlannedReminder, { kind: 'training' }>, 'atMs'>
  | Omit<Extract<PlannedReminder, { kind: 'meal' }>, 'atMs'>
  | Omit<Extract<PlannedReminder, { kind: 'drink' }>, 'atMs'>;

function dayDrafts(
  day: ReminderDay,
  settings: ReminderSettings,
  trainingTime: TrainingTime | null,
  drinkProgress: DrinkProgress | null,
): Draft[] {
  const out: Draft[] = [];
  const concreteTime = trainingTime !== null && trainingTime !== 'varies';
  const windows = trainingWindows(
    day.sessions.map((s) => ({
      sessionId: s.id,
      kind: s.kind,
      minutes: s.minutes,
      ...(s.startMinutes !== null ? { startMinutes: s.startMinutes } : {}),
    })),
    trainingTime,
  );
  // Zeitfenster mit bekannter Uhrzeit (eigene bzw. „Trainingszeit“) – nur danach richten sich Essen und Training.
  const timed = windows.filter((w) => !w.approx || concreteTime);
  const nameOf = (id: string | null) => day.sessions.find((s) => s.id === id)?.nameDe ?? '';

  if (settings.training.enabled) {
    for (const w of timed) {
      out.push({
        kind: 'training',
        id: `t-${day.date}-${w.sessionId ?? w.start}`,
        date: day.date,
        minutes: w.start - settings.training.leadMinutes,
        sessionNameDe: nameOf(w.sessionId),
        startMinutes: w.start,
        approx: w.approx,
        count: 1,
      });
    }
    const untimed = windows.filter((w) => !timed.includes(w));
    if (untimed.length > 0) {
      out.push({
        kind: 'training',
        id: `t-${day.date}-tag`,
        date: day.date,
        minutes: REMINDERS.untimedTrainingMinutes,
        sessionNameDe: nameOf(untimed[0]?.sessionId ?? null),
        startMinutes: null,
        approx: true,
        count: untimed.length,
      });
    }
  }

  if (settings.meals.enabled) {
    const source =
      day.meals ?? FIXED_MEALS.map((slot) => ({ slot, titleDe: null as string | null }));
    const seen = new Set<MealSlotId>();
    const slots = source
      .filter((m) => {
        if (seen.has(m.slot)) return false;
        seen.add(m.slot);
        return true;
      })
      .map((m) => ({ ...m, timeMinutes: mealTime(m.slot, settings.meals) }))
      .sort((a, b) => a.timeMinutes - b.timeMinutes);
    const roles = mealRolesForWindows(slots, timed);
    const withRoles = slots.map((s, i) => ({ ...s, role: roles[i] ?? null }));
    for (const s of withRoles) {
      // Snacks nur, wenn sie zum Training gehören – sonst wären es zu viele Meldungen.
      if (isSnackSlot(s.slot) && s.role === null) continue;
      const index = windowIndexForSlot(s, timed);
      const w = index >= 0 ? timed[index] : undefined;
      out.push({
        kind: 'meal',
        id: `m-${day.date}-${s.slot}`,
        date: day.date,
        minutes: s.timeMinutes,
        slot: s.slot,
        role: s.role,
        titleDe: s.titleDe,
        sessionStartMinutes: s.role !== null && w ? w.start : null,
      });
    }
    // Verschiebt sich mit der Einheit: fehlt davor eine Mahlzeit/ein Snack bzw. danach eine Mahlzeit → kurzer Hinweis.
    timed.forEach((w, index) => {
      const own = (role: MealRole) =>
        withRoles.some((s) => s.role === role && windowIndexForSlot(s, timed) === index);
      const snackAt = w.start - REMINDERS.preSnackLeadMinutes;
      const nearTraining = out.some(
        (d) => d.kind === 'training' && Math.abs(d.minutes - snackAt) < REMINDERS.minGapMinutes,
      );
      if (!own('pre') && !own('pre_snack') && !nearTraining) {
        out.push({
          kind: 'meal',
          id: `m-${day.date}-vor-${w.sessionId ?? index}`,
          date: day.date,
          minutes: snackAt,
          slot: null,
          role: 'pre_snack',
          titleDe: null,
          sessionStartMinutes: w.start,
        });
      }
      if (!own('post')) {
        out.push({
          kind: 'meal',
          id: `m-${day.date}-nach-${w.sessionId ?? index}`,
          date: day.date,
          minutes: w.end + REMINDERS.postMealDelayMinutes,
          slot: null,
          role: 'post',
          titleDe: null,
          sessionStartMinutes: w.start,
        });
      }
    });
  }

  const drinkDone = drinkProgress?.date === day.date && drinkGoalReached(drinkProgress);
  if (settings.drink.enabled && !drinkDone) {
    const others = out.map((d) => d.minutes);
    const { fromMinutes, toMinutes, everyMinutes } = settings.drink;
    for (let m = fromMinutes; m <= toMinutes; m += everyMinutes) {
      if (others.some((o) => Math.abs(o - m) < REMINDERS.minGapMinutes)) continue;
      out.push({ kind: 'drink', id: `d-${day.date}-${m}`, date: day.date, minutes: m });
    }
  }
  return out;
}

/**
 * Alle Erinnerungen der nächsten Tage (höchstens REMINDERS.maxScheduled, die frühesten zuerst):
 * - nur ab jetzt (`nowMs`), nie in der Nachtruhe 22:00–07:00 und nie über Mitternacht hinaus (eine Erinnerung vor
 *   einem Training kurz nach Mitternacht fällt in die Nachtruhe und entfällt);
 * - Uhrzeiten in der Zeitzone des Geräts, auch an Tagen mit Zeitumstellung (`zonedTimeToUtcMs`);
 * - Training: `leadMinutes` vor dem Start (eigene Uhrzeit bzw. „Trainingszeit“), ohne Uhrzeit einmal am Morgen;
 * - Essen: Mahlzeiten des Plans (ohne Plan Frühstück/Mittag/Abend) zur Essenszeit; vor/nach dem Training mit Rolle,
 *   fehlende Mahlzeit vor/nach dem Training als Hinweis relativ zur Einheit (wandert mit, wenn sie verschoben wird);
 * - Trinken: im Zeitfenster, nicht dicht neben einer anderen Erinnerung; entfällt für den Tag, an dem das Tagesziel
 *   des Trink-Trackers erreicht ist (`drinkProgress`) – sinkt die Menge wieder unter das Ziel (Eintrag zurückgenommen,
 *   Ziel gestiegen), plant die App neu und die restlichen Erinnerungen kommen wieder.
 */
export function plannedReminders(rawInput: ReminderInput): PlannedReminder[] {
  const input = reminderInputSchema.parse(rawInput);
  const drafts = input.days.flatMap((day) =>
    dayDrafts(day, input.settings, input.trainingTime, input.drinkProgress ?? null),
  );
  const result: PlannedReminder[] = [];
  for (const d of drafts) {
    if (d.minutes < 0 || d.minutes >= 24 * 60 || inQuietHours(d.minutes)) continue;
    const atMs = zonedTimeToUtcMs(
      d.date,
      Math.floor(d.minutes / 60),
      d.minutes % 60,
      input.timeZone,
    );
    if (atMs <= input.nowMs) continue;
    result.push({ ...d, atMs } as PlannedReminder);
  }
  const order = { training: 0, meal: 1, drink: 2 } as const;
  return result
    .sort((a, b) => a.atMs - b.atMs || order[a.kind] - order[b.kind] || a.id.localeCompare(b.id))
    .slice(0, REMINDERS.maxScheduled);
}

/** Die Kalendertage ab `today` für die Planung (REMINDERS.horizonDays). */
export function reminderDates(today: string): string[] {
  const start = isoDateSchema.parse(today);
  return Array.from({ length: REMINDERS.horizonDays }, (_, i) => addDays(start, i));
}
