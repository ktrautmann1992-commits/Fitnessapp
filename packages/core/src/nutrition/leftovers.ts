import { z } from 'zod';

import { isoDateSchema } from '../age';
import { LEFTOVER_RAW_DAYS, LEFTOVER_SCORING } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import { packageSizeGramsSchema } from '../content/package-size-schema';
import { contentIdSchema } from '../content/schemas';
import { addDays, daysBetween } from '../dates';
import type { MealPlanWeek, PlannedMealDay } from './meal-plan';

/**
 * Reste-Logik (docs/PLAN-PHASE-5.md 19.7 N13, KONZEPT 6.11, Wächter-Befund S9) – rein regelbasiert, ohne KI:
 *
 * - **Aufrunden auf Packungen:** Mit den freigegebenen Packungsgrößen aus N11 (`packageSizeLookup`) wird je Zutat
 *   gezählt, wie viele Packungen angebrochen werden und was übrig bleibt (`shoppingListPackages`).
 * - **Haltbarkeit des Rests:** Ein angebrochener ROHER Rest von Fleisch, Fisch, Krebs-/Weichtieren oder Rohmilch zählt
 *   nur bis zum Folgetag (danach Hinweis „einfrieren“); übrige Reste nach `LEFTOVER_RAW_DAYS` je Abteilung. Ist ein
 *   Rest abgelaufen, wird für späteren Bedarf eine NEUE Packung angebrochen – nie der alte Rest eingeplant.
 *   `max_fridge_days` (R9) gilt für gekochte Speisen und wird hier nicht verändert.
 * - **Reste-Score:** Bonus für Kandidaten, die einen nutzbaren Rest verbrauchen (Menge ÷ Packung × Dringlichkeit) – er
 *   ändert im Essensplan NUR die Reihenfolge der Kandidaten (`MEAL_PLAN_SCORING`-Skala), nie Filter, Mengen, Energie
 *   oder Grenzen (Strukturtest K2).
 *
 * Verbraucht wird am Kochtag (`cookDate`) – wie die Einkaufsliste (gekauft wird zum Kochtag). Getrackt wird in Gramm
 * der tatsächlich verwendeten Lebensmittel (Ersatzprodukt bzw. getauschte Zutat statt Original). Deterministisch.
 */

export type PackageSizeLookup = ReadonlyMap<string, number>;

/** Packungsgrößen an der Grenze (Zod): Katalog-IDs, ganze Gramm 1–5.000 (wie R1/R24). */
export const packageSizeLookupSchema = z.map(contentIdSchema, packageSizeGramsSchema);

const EPS = 1e-6;

/** Roher tierischer Rest (S9): Fleisch, Fisch, Krebs-/Weichtiere oder Rohmilch (Milch mit `pregnancy_caution`). */
export function isRawAnimalLeftover(food: Pick<Food, 'animal' | 'pregnancy_caution'>): boolean {
  if (food.animal.some((kind) => kind === 'meat' || kind === 'fish' || kind === 'shellfish')) {
    return true;
  }
  return food.animal.includes('dairy') && food.pregnancy_caution;
}

/** Wie viele Tage nach dem Anbrechen ein Rest noch eingeplant werden darf (S9, `LEFTOVER_RAW_DAYS`). */
export function leftoverKeepDays(
  food: Pick<Food, 'animal' | 'pregnancy_caution' | 'shopping_category'>,
): number {
  if (isRawAnimalLeftover(food)) return LEFTOVER_RAW_DAYS.rawAnimal;
  // Empfindliche Lebensmittel (`pregnancy_caution`, z. B. rohe Sprossen, Räucherfisch): nur bis zum Folgetag.
  if (food.pregnancy_caution) return LEFTOVER_RAW_DAYS.sensitive;
  return LEFTOVER_RAW_DAYS.byCategory[food.shopping_category];
}

interface OpenPackage {
  /** Tag des ersten Verbrauchs (angebrochen). */
  openedOn: string;
  /** Letzter Tag, an dem der Rest eingeplant werden darf. */
  usableUntil: string;
  remainingG: number;
}

/** Nutzbarer Rest eines Lebensmittels an einem Tag. */
export interface AvailableLeftover {
  readonly foodId: string;
  readonly remainingG: number;
  /** Frühester letzter Nutzungstag der angebrochenen Packungen. */
  readonly usableUntil: string;
  /** Tage bis `usableUntil` (0 = heute zuletzt). */
  readonly daysLeft: number;
}

/** Rest am Ende (oder abgelaufen) – für die Anzeige in N14. */
export interface LeftoverRest {
  readonly foodId: string;
  readonly remainingG: number;
  /** Ganze Stück, wenn das Lebensmittel ein Stückgewicht hat; sonst null. */
  readonly remainingPieces: number | null;
  readonly openedOn: string;
  readonly usableUntil: string;
  readonly rawAnimal: boolean;
  /**
   * S9: roher tierischer Rest → „einfrieren“ (nur wenn einfrierbar), sonst „nur bis zum Folgetag“; empfindliche
   * pflanzliche Lebensmittel (rohe Sprossen) ebenfalls „nur bis zum Folgetag“.
   */
  readonly hint: 'freeze' | 'next_day_only' | null;
}

/**
 * Verfolgt angebrochene Packungen je Lebensmittel (19.7 N13). Lebensmittel ohne Packungsgröße werden nicht verfolgt
 * (kein Aufrunden, kein Rest).
 */
export class LeftoverTracker {
  private readonly open = new Map<string, OpenPackage[]>();
  private readonly packages = new Map<string, number>();
  private readonly needed = new Map<string, number>();

  constructor(
    readonly foods: FoodLookup,
    readonly packageSizes: PackageSizeLookup,
  ) {}

  /** Kopie mit demselben Stand (für Wiederholungen eines Tages, deterministisch). */
  clone(): LeftoverTracker {
    const copy = new LeftoverTracker(this.foods, this.packageSizes);
    for (const [foodId, list] of this.open)
      copy.open.set(
        foodId,
        list.map((p) => ({ ...p })),
      );
    for (const [foodId, n] of this.packages) copy.packages.set(foodId, n);
    for (const [foodId, g] of this.needed) copy.needed.set(foodId, g);
    return copy;
  }

  private keepDays(foodId: string): number {
    const food = this.foods.get(foodId);
    return food === undefined ? 0 : leftoverKeepDays(food);
  }

  /**
   * Verbrauch von `grams` am Tag `date`. Zuerst aus nutzbaren Resten (älteste zuerst), sonst neue Packungen
   * (aufgerundet). Ergebnis: Gramm, die aus einer schon angebrochenen Packung kamen.
   */
  consume(foodId: string, grams: number, date: string): number {
    const size = this.packageSizes.get(foodId);
    if (size === undefined || !(grams > EPS)) return 0;
    this.needed.set(foodId, (this.needed.get(foodId) ?? 0) + grams);
    const list = this.open.get(foodId) ?? [];
    let rest = grams;
    let fromLeftover = 0;
    for (const pkg of list) {
      if (rest <= EPS) break;
      if (pkg.remainingG <= EPS || date > pkg.usableUntil) continue;
      if (date < pkg.openedOn) {
        // Verbrauch vor dem bisherigen Anbruch (Meal-Prep-Kochtag): früher angebrochen → kürzer nutzbar.
        pkg.openedOn = date;
        pkg.usableUntil = addDays(date, this.keepDays(foodId));
      }
      const take = Math.min(rest, pkg.remainingG);
      pkg.remainingG -= take;
      rest -= take;
      fromLeftover += take;
    }
    if (rest > EPS) {
      const count = Math.ceil(rest / size - EPS);
      const opened = this.packages.get(foodId) ?? 0;
      this.packages.set(foodId, opened + count);
      if (list.length < LEFTOVER_SCORING.maxOpenPackagesPerFood) {
        list.push({
          openedOn: date,
          usableUntil: addDays(date, this.keepDays(foodId)),
          remainingG: count * size - rest,
        });
      }
    }
    this.open.set(
      foodId,
      list
        .filter((p) => p.remainingG > EPS)
        .sort((a, b) =>
          a.usableUntil < b.usableUntil ? -1 : a.usableUntil > b.usableUntil ? 1 : 0,
        ),
    );
    return fromLeftover;
  }

  /** Nutzbare Reste an einem Tag (angebrochen bis einschließlich `date`, noch nicht abgelaufen). */
  available(date: string): ReadonlyMap<string, AvailableLeftover> {
    const result = new Map<string, AvailableLeftover>();
    for (const [foodId, list] of this.open) {
      let remainingG = 0;
      let until: string | null = null;
      for (const pkg of list) {
        if (pkg.remainingG <= EPS || pkg.openedOn > date || date > pkg.usableUntil) continue;
        remainingG += pkg.remainingG;
        if (until === null || pkg.usableUntil < until) until = pkg.usableUntil;
      }
      if (until !== null && remainingG > EPS) {
        result.set(foodId, {
          foodId,
          remainingG,
          usableUntil: until,
          daysLeft: daysBetween(date, until),
        });
      }
    }
    return result;
  }

  /** Angebrochene Packungen je Lebensmittel (Summe über die Woche). */
  packagesOpened(foodId: string): number {
    return this.packages.get(foodId) ?? 0;
  }

  /** Verbrauchte Menge je Lebensmittel (Gramm, nur Lebensmittel mit Packungsgröße). */
  neededGrams(foodId: string): number {
    return this.needed.get(foodId) ?? 0;
  }

  /** Verfolgte Lebensmittel (mit Packungsgröße und Verbrauch), nach ID. */
  trackedFoods(): string[] {
    return [...this.needed.keys()].sort();
  }

  /** Alle Reste mit Haltbarkeit und Hinweis (S9), nach Lebensmittel und Anbruch sortiert. */
  rests(): LeftoverRest[] {
    const rests: LeftoverRest[] = [];
    for (const foodId of [...this.open.keys()].sort()) {
      const food = this.foods.get(foodId);
      if (food === undefined) continue;
      const rawAnimal = isRawAnimalLeftover(food);
      const shortLived = rawAnimal || food.pregnancy_caution;
      for (const pkg of this.open.get(foodId) ?? []) {
        if (pkg.remainingG <= EPS) continue;
        const piece = food.units.piece_g;
        rests.push({
          foodId,
          remainingG: Math.round(pkg.remainingG * 10) / 10,
          remainingPieces: piece === undefined ? null : Math.floor(pkg.remainingG / piece + EPS),
          openedOn: pkg.openedOn,
          usableUntil: pkg.usableUntil,
          rawAnimal,
          hint: shortLived ? (rawAnimal && food.freezable ? 'freeze' : 'next_day_only') : null,
        });
      }
    }
    return rests;
  }
}

/** Verwendung eines Lebensmittels in einem Kandidaten (geschätzte Gramm für die geplanten Portionen). */
export interface LeftoverUse {
  readonly foodId: string;
  readonly grams: number;
}

/**
 * Reste-Score 0–1 (19.7 N13): Σ je Lebensmittel mit nutzbarem Rest min(Verwendung, Rest) ÷ Packungsgröße ×
 * 1 ÷ (1 + verbleibende Tage), höchstens 1. Vorrat (`pantry`) zählt nicht. Nur für die Reihenfolge.
 */
export function leftoverScore(
  uses: readonly LeftoverUse[],
  available: ReadonlyMap<string, AvailableLeftover>,
  foods: FoodLookup,
  packageSizes: PackageSizeLookup,
): number {
  if (available.size === 0) return 0;
  const byFood = new Map<string, number>();
  for (const use of uses) {
    if (!(use.grams > 0)) continue;
    byFood.set(use.foodId, (byFood.get(use.foodId) ?? 0) + use.grams);
  }
  let score = 0;
  for (const [foodId, grams] of byFood) {
    const rest = available.get(foodId);
    const size = packageSizes.get(foodId);
    if (rest === undefined || size === undefined || foods.get(foodId)?.pantry !== false) continue;
    score += (Math.min(grams, rest.remainingG) / size) * (1 / (1 + Math.max(rest.daysLeft, 0)));
  }
  return Math.min(1, score);
}

/** Bonus in Punkten für die Kandidaten-Reihenfolge (`LEFTOVER_SCORING.weight` × Score). */
export function leftoverScoreBonus(score: number): number {
  return LEFTOVER_SCORING.weight * Math.min(Math.max(score, 0), 1);
}

/**
 * Verbrauch eines Plan-Tages eintragen (am Kochtag, wie die Einkaufsliste). Ergebnis je Mahlzeit (Index in
 * `day.meals`): Lebensmittel, die (teilweise) aus einem Rest kamen.
 */
export function recordDayLeftovers(
  tracker: LeftoverTracker,
  day: Pick<PlannedMealDay, 'meals'>,
  purchaseDate: (cookDate: string) => string = (d) => d,
): string[][] {
  return day.meals.map((meal) => {
    const fromRest = new Set<string>();
    const date = purchaseDate(meal.cookDate);
    for (const ingredient of meal.ingredients) {
      if (tracker.consume(ingredient.foodId, ingredient.grams, date) > EPS) {
        fromRest.add(ingredient.foodId);
      }
    }
    return [...fromRest].sort();
  });
}

/** Mahlzeit, die einen Rest verbraucht („Dieses Rezept verbraucht deinen restlichen Brokkoli.“, N14). */
export interface LeftoverMealUse {
  readonly date: string;
  readonly slot: string;
  readonly recipeId: string;
  readonly foodIds: readonly string[];
}

export interface PlanLeftovers {
  readonly uses: readonly LeftoverMealUse[];
  /** Reste am Ende der Woche (inkl. abgelaufener) mit Hinweis. */
  readonly rests: readonly LeftoverRest[];
}

/**
 * Reste eines Plans nachrechnen (gleiche Reihenfolge wie beim Planen: Tag für Tag, Mahlzeit für Mahlzeit): welche
 * Mahlzeit welchen Rest verbraucht und was am Ende übrig bleibt. Nur Lebensmittel mit Packungsgröße.
 */
export function planLeftovers(
  plan: Pick<MealPlanWeek, 'days'>,
  foods: FoodLookup,
  packageSizes: PackageSizeLookup,
): PlanLeftovers {
  const tracker = new LeftoverTracker(foods, packageSizeLookupSchema.parse(packageSizes));
  const uses: LeftoverMealUse[] = [];
  for (const day of plan.days) {
    const fromRest = recordDayLeftovers(tracker, day);
    day.meals.forEach((meal, i) => {
      const foodIds = fromRest[i] ?? [];
      if (foodIds.length > 0) {
        uses.push({ date: day.date, slot: meal.slot, recipeId: meal.recipeId, foodIds });
      }
    });
  }
  return { uses, rests: tracker.rests() };
}

/** Packungsangabe je Lebensmittel für die Einkaufsliste (N14 zeigt sie an). */
export interface ShoppingPackageLine {
  readonly foodId: string;
  readonly packageSizeG: number;
  /** Angebrochene Packungen (aufgerundet; ein abgelaufener Rest zählt nicht als Vorrat). */
  readonly packages: number;
  /** Benötigte Menge in Gramm (tatsächlich verwendete Lebensmittel, ungerundet auf 0,1 g). */
  readonly neededG: number;
  /** Gekauft − benötigt (Rest in Gramm, auf 0,1 g). */
  readonly leftoverG: number;
  /** Rest in ganzen Stück, wenn ein Stückgewicht bekannt ist. */
  readonly leftoverPieces: number | null;
  readonly isPantry: boolean;
}

export interface ShoppingPackages {
  readonly lines: readonly ShoppingPackageLine[];
  /** Verwendete Lebensmittel ohne Packungsgröße – nicht aufgerundet (nach ID). */
  readonly withoutPackageSize: readonly string[];
}

const rangeSchema = z
  .strictObject({ from: isoDateSchema, to: isoDateSchema })
  .refine((r) => r.from <= r.to, 'Der Zeitraum beginnt nach seinem Ende.');

/**
 * Einkaufsliste auf Packungen aufrunden (19.7 N13 „mit den Packungsgrößen aus N11“): gleiche Mahlzeiten und
 * Kaufdaten wie `buildShoppingList` (gekauft zum Kochtag, der Sonntag vor der Woche zählt zur Woche), je Lebensmittel
 * angebrochene Packungen und Rest. Ein Rest, der vor dem nächsten Verbrauch abläuft (S9), wird nicht eingeplant – dann
 * zählt eine weitere Packung. Lebensmittel ohne Packungsgröße bleiben ohne Aufrundung (`withoutPackageSize`).
 */
export function shoppingListPackages(
  plan: MealPlanWeek,
  foods: FoodLookup,
  packageSizes: PackageSizeLookup,
  range?: { readonly from: string; readonly to: string },
): ShoppingPackages {
  const sizes = packageSizeLookupSchema.parse(packageSizes);
  const { from, to } = rangeSchema.parse(
    range ?? { from: plan.weekStart, to: addDays(plan.weekStart, 6) },
  );
  const tracker = new LeftoverTracker(foods, sizes);
  const without = new Set<string>();
  const purchase = (cookDate: string) => (cookDate < plan.weekStart ? plan.weekStart : cookDate);
  for (const day of plan.days) {
    const meals = day.meals.filter((m) => {
      const date = purchase(m.cookDate);
      return date >= from && date <= to;
    });
    meals.forEach((m) =>
      m.ingredients.forEach((i) => {
        if (!sizes.has(i.foodId)) without.add(i.foodId);
      }),
    );
    recordDayLeftovers(tracker, { meals }, purchase);
  }
  const lines = tracker.trackedFoods().flatMap((foodId): ShoppingPackageLine[] => {
    const food = foods.get(foodId);
    const size = sizes.get(foodId);
    if (food === undefined || size === undefined) return [];
    const packages = tracker.packagesOpened(foodId);
    const neededG = tracker.neededGrams(foodId);
    const leftover = Math.max(0, packages * size - neededG);
    const piece = food.units.piece_g;
    return [
      {
        foodId,
        packageSizeG: size,
        packages,
        neededG: Math.round(neededG * 10) / 10,
        leftoverG: Math.round(leftover * 10) / 10,
        leftoverPieces: piece === undefined ? null : Math.floor(leftover / piece + EPS),
        isPantry: food.pantry,
      },
    ];
  });
  return { lines, withoutPackageSize: [...without].sort() };
}
