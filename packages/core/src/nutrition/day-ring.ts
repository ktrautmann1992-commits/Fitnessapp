import { z } from 'zod';

import type { FoodLogEntry, FoodLogSlot } from './food-log';
import type { MealPlanSlotKey } from './meal-plan';
import type { MealSlot } from './timing';

/**
 * Tagesübersicht Ernährung mit Kalorien-Ring, Makro-Balken und Mahlzeiten-Karten (Gründer-Wunsch 20.10.2026,
 * docs/HANDY-ANLEITUNG.md „Ernährung“). Reine Darstellungs-Rechnung: Tagesziel, Makro-Ziele und die Energieanteile der
 * Mahlzeiten (`NutritionDayTargets.slots`) kommen unverändert aus `nutritionTargetsForWeek` – hier werden KEINE Ziele
 * und KEINE Schutzgrenzen gerechnet (einzige Stelle der Grenzen: `clampCalorieTarget`). Nur: übrig/zu viel, Anteile für
 * Ring und Balken, Verteilung des Tagesziels auf die vier Mahlzeiten-Karten und Summen der Einträge je Karte.
 *
 * Sprache (docs/PLAN-AUSWERTUNG.md 2.4): neutral, keine Bewertung – „zu viel“ ist nur eine Zahl, kein Fehler.
 * Ziele und Summen werden nie gespeichert und nie geloggt (Gesundheitsdaten).
 */

const kcalSchema = z.number().finite().min(0);

// ---------------------------------------------------------------------------------------------------------
// Kalorien-Ring
// ---------------------------------------------------------------------------------------------------------

export type CalorieRing =
  /** Kein (positives) Tagesziel – kein Ring, keine Division durch 0. */
  | { readonly kind: 'no_target' }
  | {
      readonly kind: 'ring';
      /** Tagesziel, auf ganze kcal gerundet. */
      readonly targetKcal: number;
      /** Gegessen, auf ganze kcal gerundet. */
      readonly eatenKcal: number;
      /** Ziel − gegessen (nie negativ); aus den gerundeten Werten, damit gegessen + übrig = Ziel. */
      readonly remainingKcal: number;
      /** Gegessen − Ziel (nie negativ). */
      readonly overKcal: number;
      /** Gefüllter Anteil des Rings 0–1 (ab dem Ziel voll). */
      readonly fraction: number;
      /** Zweite Runde über dem Ziel 0–1 (ab dem doppelten Ziel voll). */
      readonly overFraction: number;
      /** Gegessen in Prozent des Ziels, ganzzahlig (kann über 100 liegen). */
      readonly percent: number;
      /** `open` = noch etwas übrig, `reached` = genau erreicht, `over` = darüber. */
      readonly state: 'open' | 'reached' | 'over';
    };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// ---------------------------------------------------------------------------------------------------------
// Ziel-Ring (gemeinsame Regel für kcal und Makros, Gründer-Wunsch 23.10.2026)
// ---------------------------------------------------------------------------------------------------------

/**
 * Füllung eines Ziel-Rings: „Füllt sich für das Tagesziel. Ist der Wert überschritten, wird es Dunkelrot.“
 * - Werte werden auf ganze Einheiten gerundet (wie angezeigt), damit Farbe und Zahl nie widersprechen.
 * - `over` = gerundet gegessen > gerundetes Ziel – **ohne Toleranz** (genau 100 % ist nicht drüber).
 * - Ungültiges wird abgefangen statt zu werfen (Anzeige-Hilfe): gegessen NaN/negativ/unendlich → 0;
 *   Ziel fehlt, ≤ 0, NaN oder unendlich → null (kein Ring, keine Division durch 0).
 */
export interface GoalFill {
  /** Gerundet gegessen (≥ 0). */
  readonly eaten: number;
  /** Gerundetes Ziel (> 0). */
  readonly goal: number;
  /** Gefüllter Anteil 0–1; über dem Ziel immer 1 (voller Ring). */
  readonly fraction: number;
  /** Gegessen in Prozent des Ziels, ganzzahlig (kann über 100 liegen). */
  readonly percent: number;
  /** Über dem Ziel (strikt größer). */
  readonly over: boolean;
}

const finiteNonNegative = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export function goalFill(
  eaten: number | null | undefined,
  goal: number | null | undefined,
): GoalFill | null {
  const roundedGoal = Math.round(finiteNonNegative(goal));
  if (roundedGoal <= 0) return null;
  const roundedEaten = Math.round(finiteNonNegative(eaten));
  const over = roundedEaten > roundedGoal;
  return {
    eaten: roundedEaten,
    goal: roundedGoal,
    fraction: over ? 1 : clamp01(roundedEaten / roundedGoal),
    percent: Math.round((roundedEaten / roundedGoal) * 100),
    over,
  };
}

/** Ring der Tagesübersicht: Ziel und Gegessen → übrig bzw. zu viel, Füllung und Prozent. */
export function calorieRing(input: {
  readonly targetKcal: number | null;
  readonly eatenKcal: number;
}): CalorieRing {
  const eaten = Math.round(kcalSchema.parse(input.eatenKcal));
  if (input.targetKcal === null) return { kind: 'no_target' };
  const target = Math.round(kcalSchema.parse(input.targetKcal));
  if (target <= 0) return { kind: 'no_target' };
  const remaining = Math.max(0, target - eaten);
  const over = Math.max(0, eaten - target);
  return {
    kind: 'ring',
    targetKcal: target,
    eatenKcal: eaten,
    remainingKcal: remaining,
    overKcal: over,
    fraction: clamp01(eaten / target),
    overFraction: clamp01(over / target),
    percent: Math.round((eaten / target) * 100),
    state: over > 0 ? 'over' : remaining > 0 ? 'open' : 'reached',
  };
}

// ---------------------------------------------------------------------------------------------------------
// Makro-Balken
// ---------------------------------------------------------------------------------------------------------

export interface MacroProgress {
  /** Gegessen in ganzen Gramm. */
  readonly eatenG: number;
  /** Ziel in ganzen Gramm. */
  readonly targetG: number;
  /** Gefüllter Anteil 0–1. */
  readonly fraction: number;
  /** Über dem Ziel in ganzen Gramm (nie negativ). */
  readonly overG: number;
  readonly percent: number;
  /** Über dem Ziel (strikt, ohne Toleranz) → Ring voll in Dunkelrot (`goalFill`). */
  readonly over: boolean;
}

const gramsSchema = z.number().finite().min(0);

/** Ein Makro-Balken („47 / 222 g“). null = kein (positives) Ziel. */
export function macroProgress(eatenG: number, targetG: number | null): MacroProgress | null {
  const eaten = Math.round(gramsSchema.parse(eatenG));
  if (targetG === null) return null;
  const target = Math.round(gramsSchema.parse(targetG));
  if (target <= 0) return null;
  const fill = goalFill(eaten, target);
  return {
    eatenG: eaten,
    targetG: target,
    fraction: clamp01(eaten / target),
    overG: Math.max(0, eaten - target),
    percent: Math.round((eaten / target) * 100),
    over: fill?.over ?? false,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Mahlzeiten-Karten
// ---------------------------------------------------------------------------------------------------------

/** Die vier Karten der Tagesübersicht in Tagesreihenfolge. */
export const MEAL_CARD_GROUPS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export type MealCardGroup = (typeof MEAL_CARD_GROUPS)[number];

/**
 * Karte eines Platzes (Essensplan und Tagebuch): Frühstück; Mittag und Hauptmahlzeit (1 Mahlzeit am Tag, 12:30 Uhr)
 * → „Mittagessen“; Abend; alle Zwischenmahlzeiten, Ergänzungs-Snacks und freie Einträge (`other`) → „Snacks“.
 */
export function mealCardGroup(slot: MealPlanSlotKey | FoodLogSlot): MealCardGroup {
  switch (slot) {
    case 'breakfast':
      return 'breakfast';
    case 'main':
    case 'lunch':
      return 'lunch';
    case 'dinner':
      return 'dinner';
    default:
      return 'snacks';
  }
}

/** Platz beim direkten Eintragen über „+“ einer Karte (Auswahl im Eintrage-Dialog: Frühstück/Mittag/Abend/Snack). */
export function mealCardEntrySlot(
  group: MealCardGroup,
): 'breakfast' | 'lunch' | 'dinner' | 'other' {
  return group === 'snacks' ? 'other' : group;
}

const slotShareSchema = z.array(
  z.object({ slot: z.string().min(1), share: z.number().finite().min(0) }),
);

/**
 * Tagesziel auf die vier Karten verteilt – nach den Energieanteilen der Plätze DIESES Tages (`day.slots`, schon mit
 * Bonus vor/nach dem Training). Ganze kcal; die Summe der Karten ist genau das gerundete Tagesziel (größter Rest).
 * Karten ohne Platz im Tag (z. B. kein Frühstück bei 2 Mahlzeiten) bekommen null. Ohne Tagesziel bzw. ohne Plätze:
 * alle null. Nur Darstellung – ändert kein Ziel und keine Grenze.
 */
export function mealCardTargets(
  targetKcal: number | null,
  slots: readonly Pick<MealSlot, 'slot' | 'share'>[],
): Readonly<Record<MealCardGroup, number | null>> {
  const parsed = slotShareSchema.parse(slots);
  const empty = { breakfast: null, lunch: null, dinner: null, snacks: null };
  if (targetKcal === null) return empty;
  const target = Math.round(kcalSchema.parse(targetKcal));
  const shares = new Map<MealCardGroup, number>();
  for (const { slot, share } of parsed) {
    const group = mealCardGroup(slot as MealPlanSlotKey);
    shares.set(group, (shares.get(group) ?? 0) + share);
  }
  const total = [...shares.values()].reduce((sum, s) => sum + s, 0);
  if (total <= 0) return empty;
  // Anteile normieren (Summe 1 laut Engine – Abweichungen durch Fließkomma nie weiterreichen).
  const groups = MEAL_CARD_GROUPS.filter((g) => shares.has(g));
  const raw = groups.map((g) => ((shares.get(g) ?? 0) / total) * target);
  const floors = raw.map((v) => Math.floor(v));
  let rest = target - floors.reduce((sum, v) => sum + v, 0);
  // Größter Rest zuerst; bei Gleichstand die frühere Karte.
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest -= 1;
  }
  const result: Record<MealCardGroup, number | null> = { ...empty };
  groups.forEach((g, i) => {
    result[g] = floors[i] ?? 0;
  });
  return result;
}

export interface MealCardIntake {
  /** Alle Einträge der Karte (auch ohne kcal). */
  readonly count: number;
  /** Summe kcal (Einträge ohne Wert zählen nicht), ganze kcal. */
  readonly kcal: number;
  /** Einträge ohne kcal (Schnelleintrag ohne Wert). */
  readonly withoutValue: number;
}

/** Einträge des Tages je Karte. Erwartet die Einträge EINES Tages (`foodLogDay`). */
export function mealCardIntake(
  entries: readonly Pick<FoodLogEntry, 'slot' | 'kcal'>[],
): Readonly<Record<MealCardGroup, MealCardIntake>> {
  const sums: Record<MealCardGroup, { count: number; kcal: number; withoutValue: number }> = {
    breakfast: { count: 0, kcal: 0, withoutValue: 0 },
    lunch: { count: 0, kcal: 0, withoutValue: 0 },
    dinner: { count: 0, kcal: 0, withoutValue: 0 },
    snacks: { count: 0, kcal: 0, withoutValue: 0 },
  };
  for (const entry of entries) {
    const sum = sums[mealCardGroup(entry.slot)];
    sum.count += 1;
    if (entry.kcal === null || !Number.isFinite(entry.kcal)) sum.withoutValue += 1;
    else sum.kcal += Math.max(0, entry.kcal);
  }
  for (const group of MEAL_CARD_GROUPS) sums[group].kcal = Math.round(sums[group].kcal);
  return sums;
}
