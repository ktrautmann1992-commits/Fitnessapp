import { z } from 'zod';

import { isoDateSchema } from '../age';
import { LEFTOVER_RAW_DAYS, LEFTOVER_SCORING } from '../constants';
import type { Food, FoodLookup } from '../content/food-schema';
import { packageSizeLookup } from '../content/package-size-checks';
import { type PackageSize, packageSizeGramsSchema } from '../content/package-size-schema';
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
    return this.consumeDetailed(foodId, grams, date).fromLeftover;
  }

  /**
   * Wie `consume` (gleicher Stand danach), zusätzlich: Gramm aus Packungen, die an einem FRÜHEREN Tag als `date`
   * angebrochen wurden, und der früheste dieser Anbruchstage (N14: Hinweis „Nutzt deinen Rest“ – ein Rest derselben
   * Kochrunde bzw. desselben Tages ist kein Rest „von vorher“).
   */
  consumeDetailed(
    foodId: string,
    grams: number,
    date: string,
  ): {
    readonly fromLeftover: number;
    readonly fromEarlierDay: number;
    readonly earliestOpenedOn: string | null;
  } {
    const none = { fromLeftover: 0, fromEarlierDay: 0, earliestOpenedOn: null };
    const size = this.packageSizes.get(foodId);
    if (size === undefined || !(grams > EPS)) return none;
    this.needed.set(foodId, (this.needed.get(foodId) ?? 0) + grams);
    const list = this.open.get(foodId) ?? [];
    let rest = grams;
    let fromLeftover = 0;
    let fromEarlierDay = 0;
    let earliestOpenedOn: string | null = null;
    for (const pkg of list) {
      if (rest <= EPS) break;
      if (pkg.remainingG <= EPS || date > pkg.usableUntil) continue;
      if (date < pkg.openedOn) {
        // Verbrauch vor dem bisherigen Anbruch (Meal-Prep-Kochtag): früher angebrochen → kürzer nutzbar.
        pkg.openedOn = date;
        pkg.usableUntil = addDays(date, this.keepDays(foodId));
      }
      const take = Math.min(rest, pkg.remainingG);
      if (pkg.openedOn < date && take > EPS) {
        fromEarlierDay += take;
        if (earliestOpenedOn === null || pkg.openedOn < earliestOpenedOn) {
          earliestOpenedOn = pkg.openedOn;
        }
      }
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
    return { fromLeftover, fromEarlierDay, earliestOpenedOn };
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

/** Verbuchung einer Mahlzeit in zeitlicher Reihenfolge (`recordWeekLeftoversInCookOrder`). */
export interface BookedMeal {
  /** Index des Tages in `days` und der Mahlzeit in `day.meals`. */
  readonly dayIndex: number;
  readonly mealIndex: number;
  /** Lebensmittel, die (teilweise) aus einem schon angebrochenen Rest kamen (nach ID). */
  readonly fromRest: readonly string[];
  /** Lebensmittel aus einer an einem FRÜHEREN Tag angebrochenen Packung → frühester Anbruchstag. */
  readonly fromEarlierDay: ReadonlyMap<string, string>;
}

/**
 * Verbrauch einer ganzen Woche in ZEITLICHER Reihenfolge verbuchen (Wächter N14 S1): alle Mahlzeiten stabil nach
 * (Kaufdatum = `purchaseDate(cookDate)`, Esstag, Platz-Reihenfolge des Tages) sortiert. So verbraucht eine
 * Meal-Prep-Kochrunde ihre Packungen am Kochtag – auch für die Portionen späterer Tage –, bevor frische Mahlzeiten der
 * Folgetage einen „Rest“ sehen. `meals(day)` wählt die zu verbuchenden Mahlzeiten (z. B. Zeitraum der Einkaufsliste).
 * Ergebnis in Verbuchungs-Reihenfolge.
 */
export function recordWeekLeftoversInCookOrder(
  tracker: LeftoverTracker,
  days: readonly Pick<PlannedMealDay, 'date' | 'meals'>[],
  purchaseDate: (cookDate: string) => string = (d) => d,
  include: (meal: PlannedMealDay['meals'][number]) => boolean = () => true,
): BookedMeal[] {
  const order: { dayIndex: number; mealIndex: number; date: string; dayDate: string }[] = [];
  days.forEach((day, dayIndex) =>
    day.meals.forEach((meal, mealIndex) => {
      if (include(meal)) {
        order.push({ dayIndex, mealIndex, date: purchaseDate(meal.cookDate), dayDate: day.date });
      }
    }),
  );
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  order.sort(
    (a, b) =>
      cmp(a.date, b.date) ||
      cmp(a.dayDate, b.dayDate) ||
      a.dayIndex - b.dayIndex ||
      a.mealIndex - b.mealIndex,
  );
  return order.map(({ dayIndex, mealIndex, date }) => {
    const meal = days[dayIndex]!.meals[mealIndex]!;
    const fromRest = new Set<string>();
    const earlier = new Map<string, string>();
    for (const ingredient of meal.ingredients) {
      const r = tracker.consumeDetailed(ingredient.foodId, ingredient.grams, date);
      if (r.fromLeftover > EPS) fromRest.add(ingredient.foodId);
      if (r.fromEarlierDay > EPS && r.earliestOpenedOn !== null) {
        const before = earlier.get(ingredient.foodId);
        if (before === undefined || r.earliestOpenedOn < before) {
          earlier.set(ingredient.foodId, r.earliestOpenedOn);
        }
      }
    }
    return { dayIndex, mealIndex, fromRest: [...fromRest].sort(), fromEarlierDay: earlier };
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
 * Reste eines Plans nachrechnen (zeitlich geordnet nach Kochtag, Wächter N14 S1 – `recordWeekLeftoversInCookOrder`): welche
 * Mahlzeit welchen Rest verbraucht und was am Ende übrig bleibt. Nur Lebensmittel mit Packungsgröße.
 */
export function planLeftovers(
  plan: Pick<MealPlanWeek, 'days'>,
  foods: FoodLookup,
  packageSizes: PackageSizeLookup,
): PlanLeftovers {
  const tracker = new LeftoverTracker(foods, packageSizeLookupSchema.parse(packageSizes));
  const uses: LeftoverMealUse[] = [];
  // Zeitlich geordnet (Wächter N14 S1), danach wieder in Plan-Reihenfolge (Tag, Mahlzeit).
  const booked = recordWeekLeftoversInCookOrder(tracker, plan.days)
    .filter((b) => b.fromRest.length > 0)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.mealIndex - b.mealIndex);
  for (const b of booked) {
    const day = plan.days[b.dayIndex]!;
    const meal = day.meals[b.mealIndex]!;
    uses.push({ date: day.date, slot: meal.slot, recipeId: meal.recipeId, foodIds: b.fromRest });
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
  const inRange = (m: PlannedMealDay['meals'][number]) => {
    const date = purchase(m.cookDate);
    return date >= from && date <= to;
  };
  for (const day of plan.days) {
    day.meals.filter(inRange).forEach((m) =>
      m.ingredients.forEach((i) => {
        if (!sizes.has(i.foodId)) without.add(i.foodId);
      }),
    );
  }
  // Zeitlich geordnet (Wächter N14 S1): sonst zählte Meal-Prep mit späteren Frischmahlzeiten zu wenige Packungen.
  recordWeekLeftoversInCookOrder(tracker, plan.days, purchase, inRange);
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

// ---------------------------------------------------------------------------------------------------------
// Etappe N14 – Resteplanung in der App (docs/PLAN-PHASE-5.md 19.7 N14, Umsetzungsstand N14): nur der Teil, der NICHT
// von den offenen Gründer-Fragen G-N13-4 (Rest-Tage je Untergruppe) und N11-G3 (Packung bei Stückware) abhängt –
// Reste-Score im Wochenplan (nur Reihenfolge) und der Hinweis „Nutzt deinen Rest“ an der Mahlzeit. Packungszahl,
// Restmenge und die Liste „übrig am Ende“ zeigt die App bewusst NICHT (sie wären z. B. bei Hartkäse irreführend).
// ---------------------------------------------------------------------------------------------------------

/**
 * Eingabe `MealPlanInput.leftovers` aus den ausgewählten Packungsgrößen (`NutritionLibrary.packageSizes`). Ohne
 * Packungsgrößen `undefined` – dann plant die Engine genau wie ohne Resteplanung (N13).
 */
export function leftoverPlanningInput(
  entries: readonly PackageSize[],
  options: { readonly allowDrafts: boolean },
): { readonly packageSizes: PackageSizeLookup } | undefined {
  const lookup = packageSizeLookup(usablePackageSizes(entries, options));
  return lookup.size === 0 ? undefined : { packageSizes: packageSizeLookupSchema.parse(lookup) };
}

/**
 * Packungsgrößen, die die Resteplanung verwenden darf (Wächter N14 H1): ohne `allowDrafts` (also außerhalb des
 * Testmodus) nur freigegebene – doppelt abgesichert zu `selectNutritionContent`.
 */
export function usablePackageSizes(
  entries: readonly PackageSize[],
  options: { readonly allowDrafts: boolean },
): PackageSize[] {
  return entries.filter(
    (e) => e.status === 'published' || (options.allowDrafts && e.status === 'draft'),
  );
}

/** Ein Lebensmittel, dessen Rest eine Mahlzeit nutzt. */
export interface LeftoverHintFood {
  readonly foodId: string;
  /** Tag, an dem die genutzte Packung angebrochen wurde (immer VOR dem Kochtag der Mahlzeit). */
  readonly openedOn: string;
  /** Roh tierisch (S9): wird nur bis zum Folgetag eingeplant. */
  readonly rawAnimal: boolean;
  /**
   * Nur bis zum Folgetag eingeplant (Wächter N14 S3): roh tierisch ODER empfindlich (`pregnancy_caution`, z. B. rohe
   * Sprossen, Rohmilchkäse, Kochschinken) – gleiche Regel wie `leftoverKeepDays`. Die App zeigt dazu einen neutralen
   * Lagerhinweis.
   */
  readonly shortLived: boolean;
  /** Packungsgröße freigegeben (`published`); sonst Entwurf bzw. Testwert – die App kennzeichnet das. */
  readonly packageReviewed: boolean;
}

/** Hinweis „Nutzt deinen Rest: …“ an einer Mahlzeit (19.7 N14). */
export interface LeftoverMealHint {
  readonly date: string;
  readonly slot: string;
  readonly recipeId: string;
  readonly foods: readonly LeftoverHintFood[];
}

/**
 * Welche Mahlzeit einen Rest von FRÜHER nutzt (19.7 N14, „Dieses Rezept verbraucht deinen restlichen Brokkoli.“) –
 * gleiche Rechnung wie `planLeftovers`: alle Mahlzeiten der Woche zeitlich nach Kochtag verbucht (Wächter N14 S1), so
 * dass eine Meal-Prep-Kochrunde ihre Packungen am Kochtag verbraucht; abgelaufene Reste nie (S9). Ein Hinweis
 * entsteht nur, wenn
 * - die Packung an einem früheren Tag als dem Kochtag dieser Mahlzeit angebrochen wurde (Mahlzeiten derselben
 *   Kochrunde oder desselben Tages „nutzen“ keinen Rest),
 * - die Mahlzeit an diesem Tag gekocht wird (vorgekochte Meal-Prep-Portionen tragen keinen Hinweis – ihre Zutaten
 *   wurden am Kochtag verbucht; ein Rest von früher erscheint am Kochtag selbst),
 * - das Lebensmittel kein Vorrat ist (Reis, Nudeln halten lange; wie der Reste-Score).
 * Rein und deterministisch; keine Mengen, keine Packungszahlen.
 */
export function leftoverMealHints(
  plan: Pick<MealPlanWeek, 'days'>,
  foods: FoodLookup,
  allEntries: readonly PackageSize[],
  options: { readonly allowDrafts: boolean },
): LeftoverMealHint[] {
  const entries = usablePackageSizes(allEntries, options);
  const planning = leftoverPlanningInput(entries, options);
  if (planning === undefined) return [];
  const reviewed = new Map<string, boolean>();
  for (const entry of [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!reviewed.has(entry.food_id)) reviewed.set(entry.food_id, entry.status === 'published');
  }
  const tracker = new LeftoverTracker(foods, planning.packageSizes);
  const hints: LeftoverMealHint[] = [];
  const booked = recordWeekLeftoversInCookOrder(tracker, plan.days).sort(
    (a, b) => a.dayIndex - b.dayIndex || a.mealIndex - b.mealIndex,
  );
  for (const b of booked) {
    const day = plan.days[b.dayIndex]!;
    const meal = day.meals[b.mealIndex]!;
    if (meal.prepKind === 'leftover' || b.fromEarlierDay.size === 0) continue;
    const hintFoods = [...b.fromEarlierDay.entries()]
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
      .flatMap(([foodId, openedOn]): LeftoverHintFood[] => {
        const food = foods.get(foodId);
        if (food === undefined || food.pantry) return [];
        const rawAnimal = isRawAnimalLeftover(food);
        return [
          {
            foodId,
            openedOn,
            rawAnimal,
            shortLived: rawAnimal || food.pregnancy_caution,
            packageReviewed: reviewed.get(foodId) === true,
          },
        ];
      });
    if (hintFoods.length > 0) {
      hints.push({ date: day.date, slot: meal.slot, recipeId: meal.recipeId, foods: hintFoods });
    }
  }
  return hints;
}
