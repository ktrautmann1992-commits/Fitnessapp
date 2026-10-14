import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  MEAL_PLAN_ENGINE_VERSION,
  MEAL_PLAN_FILL,
  MEAL_PLAN_REPEAT_LIMITS,
  MEAL_PLAN_SCORING,
  NO_TARGETS_MIN_DAY_KCAL,
  PORTION_SCALE_LIMITS,
} from '../constants';
import type { FoodLookup } from '../content/food-schema';
import type { MealType, Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import type { ContentStatus } from '../enums';
import { addDays, isoWeekday } from '../dates';
import {
  filterRecipe,
  type FilteredRecipe,
  type IngredientSwapRef,
  mealTypeForSlot,
  type RecipeExclusionReason,
  type RecipeFilterResult,
  type RecipeSubstitution,
  type SlotExclusionReason,
  slotFitReasons,
  swapFactsMap,
} from './filter';
import {
  type CookEvent,
  leftoverKeeps,
  mealPrepCookEvents,
  type MealPrepDayUse,
  mealPrepDayUse,
  mealPrepKeeping,
  mealPrepSlots,
} from './meal-prep';
import { type MealPlanNoticeCode, sortMealPlanNotices } from './notices';
import {
  addNutrients,
  computeRecipeFacts,
  type RecipeNutrients,
  zeroNutrients,
} from './recipe-nutrients';
import {
  balancePortions,
  type PortionDraft,
  type ScaledIngredient,
  type ScaledPortion,
  scalePortion,
} from './scale';
import { type MealPlanProfile, type MealPlanProfileInput, mealPlanProfileSchema } from './schemas';
import { stableHashKey, stableUnit } from './stable-hash';
import { resolveIngredientSwaps, swapKey } from './swap-resolve';
import type { NutritionDayTargets, NutritionWeekTargets } from './targets';
import type { MealRole, MealSlotId } from './timing';

/**
 * Wochen-Essensplan (docs/PLAN-PHASE-5.md 6.2–6.4, B1) – deterministisch, ohne Zufall und ohne Echtzeit-KI.
 *
 * Ablauf je Tag: Plätze aus den Tageszielen (4.8) → Kandidaten nach dem Filter (6.1, `filter.ts`) → Punkte
 * (Passung, Eiweiß, „mag ich“, Rolle vor/nach dem Training, Wiederholung, Zutaten-Wiederverwendung, feste Streuung
 * je Variante) → Portionen ins Planband (`balancePortions`, Zielpunkt Bandmitte) → bei Bedarf bis zu 2
 * Ergänzungs-Snacks → Tag `complete` (Summe im Planband) oder `below_floor` (Hinweis `day_below_floor`, nie als
 * „dein Plan“). Über der Obergrenze wird nie ausgeliefert: Lassen sich die Portionen nicht genug senken, fällt
 * eine Mahlzeit weg (`meal_removed_ceiling`). Modus `no_targets`: Faktor 1, keine Summen gegen ein Ziel (S15).
 *
 * Die Schutzgrenzen selbst rechnet diese Datei NICHT – das Planband kommt fertig aus `nutritionTargetsForWeek`
 * (einzige Stelle: `clampCalorieTarget`, Strukturtest K2).
 */

export type MealPlanSlotKey = MealSlotId | 'extra_1' | 'extra_2';
export const EXTRA_SLOTS = ['extra_1', 'extra_2'] as const;
export type PrepKind = 'cook' | 'leftover' | 'fresh';
export type MealPlanDayStatus = 'complete' | 'below_floor' | 'no_targets';

export interface PlannedMeal {
  readonly slot: MealPlanSlotKey;
  readonly role: MealRole;
  readonly recipeId: string;
  readonly recipeVersion: number;
  readonly titleDe: string;
  readonly recipeStatus: ContentStatus;
  readonly factor: number;
  readonly ingredients: readonly ScaledIngredient[];
  readonly nutrients: RecipeNutrients;
  /** kcal nicht weggelassener optionaler Zutaten (zählen nur für die Obergrenze, K3). */
  readonly optionalKcal: number;
  readonly substitutions: readonly RecipeSubstitution[];
  /**
   * Vom Nutzer getauschte Zutaten (19.7 N9) – fehlt, wenn nichts getauscht ist. Menge, Einheit und `heated` kommen
   * beim Prüfen immer aus der Austausch-Tabelle (`resolveIngredientSwaps`), nie aus dem Speicher.
   */
  readonly ingredientSwaps?: readonly IngredientSwapRef[];
  readonly omittedOptional: readonly { readonly index: number; readonly foodId: string }[];
  /** `cook` = Kochtag (Meal-Prep), `leftover` = vorgekocht, `fresh` = am Tag frisch gekocht. */
  readonly prepKind: PrepKind;
  /** Tag, an dem gekocht wird (bei Resten der Kochtag, sonst der Tag selbst). */
  readonly cookDate: string;
  /** Aufbewahrung der Reste: Kühlschrank oder eingefroren (Hinweis „einfrieren/auftauen“). */
  readonly storage: 'fridge' | 'freeze' | null;
  /** Ergänzungs-Snack (Plan 6.2): „Ergänzung, damit du deinen Bedarf erreichst“. */
  readonly isFill: boolean;
  /** Portion steht fest (schon gekocht) – wird beim Ausgleich nicht verändert. */
  readonly fixed: boolean;
  /** Meal-Prep-Wochenplan, aus dem das Gericht stammt (19.6), sonst null. */
  readonly mealPrepPlanId: string | null;
}

export type EmptySlotReason = RecipeExclusionReason | SlotExclusionReason | 'above_ceiling';

export interface EmptySlot {
  readonly slot: MealSlotId;
  /** Welche Filter es verhindern (für die Meldung „welcher Filter es verhindert“). */
  readonly reasons: readonly EmptySlotReason[];
}

export interface PlannedMealDay {
  readonly date: string;
  readonly mode: NutritionDayTargets['mode'];
  readonly status: MealPlanDayStatus;
  readonly meals: readonly PlannedMeal[];
  /** Summe der Mahlzeiten (gerundete Mengen). Im Modus `no_targets` nur intern, nie gegen ein Ziel angezeigt. */
  readonly totals: RecipeNutrients;
  /** Planband, an dem gemessen wurde (ungerundet, nur intern); null bei `no_targets`. */
  readonly band: { readonly min: number; readonly max: number } | null;
  /** Abgleich für die automatische Neuplanung (6.6): Modus, Deckel, Rezept-Ausschlüsse. */
  readonly safetyKey: string;
  readonly emptySlots: readonly EmptySlot[];
  readonly notices: readonly MealPlanNoticeCode[];
}

export interface MealPlanWeek {
  readonly weekStart: string;
  readonly variant: number;
  readonly engineVersion: number;
  readonly days: readonly PlannedMealDay[];
  readonly notices: readonly MealPlanNoticeCode[];
  /** Ziele, Flags oder Unverträglichkeiten eingeflossen → Gesundheitsdatum (7.1). */
  readonly usesHealthData: boolean;
  /** Gewählter Meal-Prep-Wochenplan (19.6), sonst null. */
  readonly mealPrepPlanId: string | null;
}

/** Fest vorgegebene Mahlzeit (Meal-Prep-Wochenplan, 19.6). */
export interface PinnedMeal {
  readonly variant: FilteredRecipe;
  readonly prepKind: PrepKind;
  readonly cookDate: string;
  readonly storage: 'fridge' | 'freeze' | null;
  readonly mealPrepPlanId: string;
}

export interface MealPlanInput {
  readonly targets: NutritionWeekTargets;
  readonly profile: MealPlanProfileInput;
  readonly recipes: readonly Recipe[];
  readonly foods: FoodLookup;
  /** Testmodus: Entwürfe erlaubt (gekennzeichnet). */
  readonly allowDrafts: boolean;
  /**
   * Rezepte mit rotem Befund. Optional, weil der Bestand normalerweise aus `selectNutritionContent` kommt, das sie
   * schon weglässt (Wächter N3 K2) – wer Rezepte an `selectNutritionContent` vorbei übergibt, MUSS sie hier nennen.
   */
  readonly redRecipeIds?: ReadonlySet<string>;
  /** „Andere Vorschläge“ = Variante + 1 (6.3 Nr. 7). */
  readonly variant?: number;
  readonly today: string;
  /** Bisheriger Plan derselben Woche: vergangene Tage bleiben unverändert, gekochte Reste fest. */
  readonly existingPlan?: MealPlanWeek | null;
  /**
   * Austausch-Tabelle (19.7 N9, aus `selectNutritionContent`). Fehlt sie, gilt jede Mahlzeit mit getauschter Zutat als
   * nicht mehr passend (sichere Richtung → Neuplanung).
   */
  readonly substitutions?: readonly IngredientSubstitution[];
}

const variantSchema = z.number().int().min(0).max(10_000);

/** Planband eines Tages für den Essensplan – unverändert aus den Tageszielen (`planBand` in `limits.ts`). */
export function mealPlanBand(
  day: Pick<NutritionDayTargets, 'band'>,
): { readonly min: number; readonly max: number } | null {
  return day.band;
}

/** Abgleich-Schlüssel für 6.6 (Modus, Deckel, Rezept-Ausschlüsse) – ohne Zahlen zu Körperdaten. */
export function daySafetyKey(day: NutritionDayTargets): string {
  return [
    day.mode,
    `dc=${day.deficitCap}`,
    `sc=${day.surplusCap}`,
    `ex=${[...day.recipeExclusions].sort().join(',')}`,
  ].join('|');
}

// ---------------------------------------------------------------------------------------------------------
// Kandidaten
// ---------------------------------------------------------------------------------------------------------

/** Filter-Ergebnisse je Rezept, getrennt nach „mit/ohne Schwangerschafts-Ausschluss“ (zwischengespeichert). */
export class CandidatePool {
  private readonly cache = new Map<string, RecipeFilterResult>();
  readonly profile: MealPlanProfile;

  constructor(
    readonly recipes: readonly Recipe[],
    readonly foods: FoodLookup,
    profile: MealPlanProfileInput,
    readonly allowDrafts: boolean,
    readonly redRecipeIds?: ReadonlySet<string>,
    /** Austausch-Tabelle (19.7 N9); ohne Tabelle besteht keine Mahlzeit mit getauschter Zutat. */
    readonly substitutions: readonly IngredientSubstitution[] = [],
  ) {
    this.profile = mealPlanProfileSchema.parse(profile);
  }

  /**
   * Filter-Ergebnis für ein Rezept – optional mit vom Nutzer getauschten Zutaten (19.7 N9): Die Einträge werden aus
   * der Austausch-Tabelle aufgelöst; ein ungültiger Eintrag lässt das Rezept durchfallen (sichere Richtung).
   */
  result(
    recipe: Recipe,
    excludePregnancyCaution: boolean,
    swaps: readonly IngredientSwapRef[] = [],
  ): RecipeFilterResult {
    const key = `${recipe.id}@${recipe.version}|${excludePregnancyCaution ? 1 : 0}|${swapKey(swaps)}`;
    let result = this.cache.get(key);
    if (result === undefined) {
      const applied =
        swaps.length === 0
          ? []
          : resolveIngredientSwaps(recipe, swaps, this.substitutions, this.foods);
      result =
        applied === null
          ? { ok: false, reasons: ['food_unavailable'] }
          : filterRecipe(
              recipe,
              this.foods,
              {
                profile: this.profile,
                excludePregnancyCaution,
                allowDrafts: this.allowDrafts,
                ...(this.redRecipeIds !== undefined ? { redRecipeIds: this.redRecipeIds } : {}),
              },
              applied,
            );
      this.cache.set(key, result);
    }
    return result;
  }

  /** Alle für die Person zugelassenen Rezepte (Reihenfolge nach ID, stabil). */
  allowed(excludePregnancyCaution: boolean): FilteredRecipe[] {
    return [...this.recipes]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .flatMap((recipe) => {
        const r = this.result(recipe, excludePregnancyCaution);
        return r.ok ? [r.value] : [];
      });
  }

  /** Gründe, warum für diesen Platz kein Rezept passt (Plan 6.3 „welcher Filter es verhindert“). */
  emptyReasons(
    excludePregnancyCaution: boolean,
    fit: Parameters<typeof slotFitReasons>[1],
  ): EmptySlotReason[] {
    const reasons = new Set<EmptySlotReason>();
    const type: MealType = mealTypeForSlot(fit.slot);
    const ofType = this.recipes.filter((r) => r.meal_types.includes(type));
    if (ofType.length === 0) reasons.add('meal_type');
    for (const recipe of ofType) {
      const r = this.result(recipe, excludePregnancyCaution);
      if (!r.ok) r.reasons.forEach((reason) => reasons.add(reason));
      else slotFitReasons(recipe, fit).forEach((reason) => reasons.add(reason));
    }
    return [...reasons].sort();
  }
}

export function isWeekday(date: string): boolean {
  return isoWeekday(date) <= 5;
}

/** Tatsächlich verwendete Lebensmittel je Zutat-Index (Ersatz S4 und Tausch N9). */
function usedFoodMap(variant: FilteredRecipe): Map<number, string> {
  return new Map([
    ...variant.substitutions.map((s): [number, string] => [s.index, s.substituteFoodId]),
    ...variant.swaps.map((s): [number, string] => [s.index, s.substituteFoodId]),
  ]);
}

/** Haupt-Eiweißquelle: Zutat mit dem meisten Eiweiß je Portion (6.3 Nr. 3). */
function mainProteinFood(variant: FilteredRecipe, foods: FoodLookup): string | null {
  const subs = usedFoodMap(variant);
  let best: { id: string; protein: number } | null = null;
  variant.recipe.ingredients.forEach((ingredient, index) => {
    if (ingredient.optional) return;
    const id = subs.get(index) ?? ingredient.food_id;
    const grams = variant.facts.gramsPerServing[index] ?? 0;
    const protein = ((foods.get(id)?.nutrients_per_100g.protein_g ?? 0) * grams) / 100;
    if (best === null || protein > best.protein) best = { id, protein };
  });
  return best === null ? null : (best as { id: string }).id;
}

function usedFoodIds(variant: FilteredRecipe): string[] {
  const omitted = new Set(variant.omitted);
  const subs = usedFoodMap(variant);
  return variant.recipe.ingredients.flatMap((ingredient, index) =>
    omitted.has(index) ? [] : [subs.get(index) ?? ingredient.food_id],
  );
}

/** Zustand der Woche für Wiederholung, Eiweißquelle und Zutaten-Wiederverwendung. */
export class WeekState {
  readonly uses = new Map<string, number[]>();
  readonly usedFoods = new Set<string>();
  readonly mainProteins = new Map<number, Set<string>>();

  record(variant: FilteredRecipe, dayIndex: number, foods: FoodLookup, countUse: boolean): void {
    if (countUse) {
      const days = this.uses.get(variant.recipe.id) ?? [];
      days.push(dayIndex);
      this.uses.set(variant.recipe.id, days);
    }
    usedFoodIds(variant).forEach((id) => this.usedFoods.add(id));
    const protein = mainProteinFood(variant, foods);
    if (protein !== null && variant.recipe.meal_types.includes('main')) {
      const set = this.mainProteins.get(dayIndex) ?? new Set<string>();
      set.add(protein);
      this.mainProteins.set(dayIndex, set);
    }
  }

  /** Hält die Wiederholungsgrenzen (Plan 6.3 Nr. 3) ein? */
  withinRepeatLimits(recipeId: string, type: MealType, dayIndex: number): boolean {
    const days = this.uses.get(recipeId) ?? [];
    if (days.includes(dayIndex)) return false;
    if (days.length >= MEAL_PLAN_REPEAT_LIMITS[type]) return false;
    if (type === 'main' && days.some((d) => Math.abs(d - dayIndex) === 1)) return false;
    return true;
  }
}

interface ScoreArgs {
  readonly weekStart: string;
  readonly variant: number;
  readonly slotKey: string;
  readonly role: MealRole;
  /** Slot-Ziel in kcal; null im Modus `no_targets`. */
  readonly targetKcal: number | null;
  readonly dayIndex: number;
  readonly likes: ReadonlySet<string>;
  readonly intolerances: ReadonlySet<string>;
}

function scoreCandidate(
  c: FilteredRecipe,
  args: ScoreArgs,
  state: WeekState,
  foods: FoodLookup,
): number {
  const W = MEAL_PLAN_SCORING;
  const kcal = c.facts.perServing.kcal;
  let score = 0;
  if (args.targetKcal !== null && kcal > 0) {
    const needed = args.targetKcal / kcal;
    const clamped = Math.min(Math.max(needed, PORTION_SCALE_LIMITS.min), PORTION_SCALE_LIMITS.max);
    score -= W.kcalFit * Math.abs(Math.log(clamped));
    score -= W.outsideScale * Math.abs(Math.log(needed / clamped));
  }
  const proteinShare = kcal > 0 ? Math.min((4 * c.facts.perServing.protein_g) / kcal, 0.5) : 0;
  score += W.protein * proteinShare;
  if (args.role === 'post') score += W.postProtein * proteinShare;
  if (c.facts.allergens.some((g) => args.likes.has(g) && !args.intolerances.has(g))) {
    score += W.like;
  }
  const tags = c.recipe.training_tags;
  const categories = c.recipe.categories ?? [];
  if (
    (args.role === 'pre' || args.role === 'pre_snack') &&
    (tags.includes('vor_training') || categories.includes('pre-workout'))
  ) {
    score += W.roleTag;
  }
  if (
    args.role === 'post' &&
    (tags.includes('nach_training') || categories.includes('post-workout'))
  ) {
    score += W.roleTag;
  }
  score -= W.repeat * (state.uses.get(c.recipe.id)?.length ?? 0);
  const protein = mainProteinFood(c, foods);
  if (protein !== null && state.mainProteins.get(args.dayIndex - 1)?.has(protein) === true) {
    score -= W.sameProteinPrevDay;
  }
  const ids = usedFoodIds(c);
  if (ids.length > 0) {
    score += (W.ingredientReuse * ids.filter((id) => state.usedFoods.has(id)).length) / ids.length;
  }
  score +=
    W.variantJitter * stableUnit(args.weekStart, args.slotKey, c.recipe.id, String(args.variant));
  return score;
}

/** Bester Kandidat nach Punkten; Gleichstand über `stableHash` (6.3 Nr. 4), dann ID. */
function pickBest(
  candidates: readonly FilteredRecipe[],
  args: ScoreArgs,
  state: WeekState,
  foods: FoodLookup,
): FilteredRecipe | null {
  let best: { c: FilteredRecipe; score: number; hash: number } | null = null;
  for (const c of candidates) {
    const score = Math.round(scoreCandidate(c, args, state, foods) * 1e9) / 1e9;
    const hash = stableHashKey(args.weekStart, args.slotKey, c.recipe.id, String(args.variant));
    if (
      best === null ||
      score > best.score ||
      (score === best.score &&
        (hash < best.hash || (hash === best.hash && c.recipe.id < best.c.recipe.id)))
    ) {
      best = { c, score, hash };
    }
  }
  return best?.c ?? null;
}

// ---------------------------------------------------------------------------------------------------------
// Tag fertigstellen: Portionen, Ergänzungs-Snacks, Status
// ---------------------------------------------------------------------------------------------------------

/** Ausgewählte Mahlzeit vor dem Ausgleich. */
export interface SelectedMeal {
  readonly slot: MealSlotId;
  readonly role: MealRole;
  readonly variant: FilteredRecipe;
  readonly prepKind: PrepKind;
  readonly cookDate: string;
  readonly storage: 'fridge' | 'freeze' | null;
  /** Fester Faktor (schon gekocht). */
  readonly fixedFactor?: number;
  /** Fest vorgegeben (Meal-Prep-Wochenplan) – darf beim Ausgleich nicht wegfallen. */
  readonly pinned: boolean;
  readonly mealPrepPlanId: string | null;
  /** Energieanteil des Platzes (für den Startfaktor). */
  readonly share: number;
}

export interface DayContext {
  readonly targets: NutritionDayTargets;
  readonly dayIndex: number;
  readonly weekStart: string;
  readonly variant: number;
  readonly pool: CandidatePool;
  readonly state: WeekState;
}

export interface FinishedDay {
  readonly day: PlannedMealDay;
  /** Nur mit festen Vorgaben: Tag liegt auch mit kleinsten Portionen über der Obergrenze (G3). */
  readonly aboveCeiling: boolean;
}

function toPlannedMeal(
  selected: Pick<
    SelectedMeal,
    'role' | 'variant' | 'prepKind' | 'cookDate' | 'storage' | 'mealPrepPlanId'
  > & { slot: MealPlanSlotKey; fixed: boolean; isFill: boolean },
  portion: ScaledPortion,
): PlannedMeal {
  const { recipe } = selected.variant;
  return {
    slot: selected.slot,
    role: selected.role,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    titleDe: recipe.title_de,
    recipeStatus: recipe.status,
    factor: portion.factor,
    ingredients: portion.ingredients,
    nutrients: portion.nutrients,
    optionalKcal: portion.optionalKcal,
    substitutions: selected.variant.substitutions,
    ...(selected.variant.swaps.length > 0
      ? {
          ingredientSwaps: selected.variant.swaps.map((s) => ({
            index: s.index,
            foodId: s.foodId,
            substituteFoodId: s.substituteFoodId,
          })),
        }
      : {}),
    omittedOptional: selected.variant.omitted.map((index) => ({
      index,
      foodId: recipe.ingredients[index]?.food_id ?? '',
    })),
    prepKind: selected.prepKind,
    cookDate: selected.cookDate,
    storage: selected.storage,
    isFill: selected.isFill,
    fixed: selected.fixed,
    mealPrepPlanId: selected.mealPrepPlanId,
  };
}

function fillCandidates(ctx: DayContext, excludeIds: ReadonlySet<string>): FilteredRecipe[] {
  const exclude = ctx.targets.recipeExclusions.includes('pregnancy_caution');
  return ctx.pool
    .allowed(exclude)
    .filter(
      (c) =>
        !excludeIds.has(c.recipe.id) &&
        slotFitReasons(c.recipe, { slot: 'snack_afternoon', fill: true }).length === 0,
    );
}

/** Ergänzungs-Snack, der die Lücke am besten schließt (bei voller Portion), Gleichstand fest über den Hash. */
function pickFill(
  candidates: readonly FilteredRecipe[],
  gapKcal: number,
  ctx: DayContext,
  slotKey: string,
): FilteredRecipe | null {
  let best: { c: FilteredRecipe; score: number; hash: number } | null = null;
  for (const c of candidates) {
    const kcal = Math.max(c.facts.perServing.kcal, 1);
    const score = -Math.abs(Math.log(Math.min((PORTION_SCALE_LIMITS.max * kcal) / gapKcal, 1)));
    const hash = stableHashKey(ctx.weekStart, slotKey, c.recipe.id, String(ctx.variant));
    if (
      best === null ||
      score > best.score ||
      (score === best.score &&
        (hash < best.hash || (hash === best.hash && c.recipe.id < best.c.recipe.id)))
    ) {
      best = { c, score, hash };
    }
  }
  return best?.c ?? null;
}

/**
 * Portionen ins Planband bringen (6.2, B1) und den Tag fertigstellen. `allowDrop`: nicht feste Mahlzeiten dürfen
 * wegfallen, wenn der Tag sonst über der Obergrenze läge (Meal-Prep-Wochenplan: nur nicht vorgegebene).
 */
export function finishDay(
  ctx: DayContext,
  selectedIn: readonly SelectedMeal[],
  emptySlotsIn: readonly EmptySlot[],
  noticesIn: Iterable<MealPlanNoticeCode>,
  options: { readonly allowDrop: boolean } = { allowDrop: true },
): FinishedDay {
  const { targets } = ctx;
  const foods = ctx.pool.foods;
  const notices = new Set<MealPlanNoticeCode>(noticesIn);
  const emptySlots = [...emptySlotsIn];
  let selected = [...selectedIn];
  const band = mealPlanBand(targets);
  const usedIds = new Set(selected.map((s) => s.variant.recipe.id));

  type Fill = { variant: FilteredRecipe; slot: (typeof EXTRA_SLOTS)[number] };
  let fills: Fill[] = [];

  const finalize = (
    portions: readonly ScaledPortion[],
    status: MealPlanDayStatus,
    aboveCeiling: boolean,
  ): FinishedDay => {
    const meals: PlannedMeal[] = [];
    selected.forEach((s, i) => {
      meals.push(
        toPlannedMeal(
          { ...s, fixed: s.fixedFactor !== undefined, isFill: false },
          portions[i] as ScaledPortion,
        ),
      );
    });
    fills.forEach((fill, j) => {
      meals.push(
        toPlannedMeal(
          {
            slot: fill.slot,
            role: null,
            variant: fill.variant,
            prepKind: 'fresh',
            cookDate: targets.date,
            storage: null,
            mealPrepPlanId: null,
            fixed: false,
            isFill: true,
          },
          portions[selected.length + j] as ScaledPortion,
        ),
      );
    });
    const totals = zeroNutrients();
    meals.forEach((m) => addNutrients(totals, m.nutrients));
    if (fills.length > 0) notices.add('fill_snacks_added');
    if (status === 'below_floor') notices.add('day_below_floor');
    if (status === 'no_targets') notices.add('no_targets_portions');
    if (emptySlots.length > 0) notices.add('no_candidates_for_slot');
    if (
      status !== 'no_targets' &&
      targets.proteinG !== null &&
      totals.protein_g < MEAL_PLAN_FILL.proteinMinShare * targets.proteinG
    ) {
      notices.add('protein_below_target');
    }
    if (meals.some((m) => m.storage === 'freeze')) notices.add('meal_prep_freeze');
    return {
      day: {
        date: targets.date,
        mode: targets.mode,
        status,
        meals,
        totals,
        band,
        safetyKey: daySafetyKey(targets),
        emptySlots: [...emptySlots].sort((a, b) => (a.slot < b.slot ? -1 : 1)),
        notices: sortMealPlanNotices(notices),
      },
      aboveCeiling,
    };
  };

  const drafts = (): PortionDraft[] => {
    const mid = band === null ? null : (band.min + band.max) / 2;
    const all = [
      ...selected.map((s) => ({ variant: s.variant, share: s.share, fixed: s.fixedFactor })),
      ...fills.map((f) => ({ variant: f.variant, share: 0, fixed: undefined })),
    ];
    return all.map((d) => {
      const kcal = Math.max(d.variant.facts.perServing.kcal, 1);
      const base = mid === null || d.share === 0 ? 1 : (d.share * mid) / kcal;
      return { variant: d.variant, baseFactor: base, fixedFactor: d.fixed };
    });
  };

  // Modus no_targets (S15): Faktor 1, höchstens 1 Ergänzungs-Snack unter dem internen Mindestwert.
  if (band === null) {
    const portionsAt = () =>
      drafts().map((d) => scalePortion(d.variant, d.fixedFactor ?? 1, foods));
    let portions = portionsAt();
    const total = () => portions.reduce((sum, p) => sum + p.nutrients.kcal, 0);
    while (
      total() < NO_TARGETS_MIN_DAY_KCAL &&
      fills.length < MEAL_PLAN_FILL.noTargetsMaxExtraSnacks
    ) {
      const slot = EXTRA_SLOTS[fills.length] as Fill['slot'];
      const fill = pickFill(
        fillCandidates(ctx, usedIds),
        NO_TARGETS_MIN_DAY_KCAL - total(),
        ctx,
        `${targets.date}:${slot}`,
      );
      if (fill === null) break;
      fills.push({ variant: fill, slot });
      usedIds.add(fill.recipe.id);
      portions = portionsAt();
    }
    return finalize(portions, 'no_targets', false);
  }

  let balanced = balancePortions(drafts(), band, foods);

  // Zu wenig: bis zu 2 Ergänzungs-Snacks (Plan 6.2 Nr. 2) – nie so, dass der Tag über das Band rutscht.
  const addFills = () => {
    while (balanced.status === 'below' && fills.length < MEAL_PLAN_FILL.maxExtraSnacks) {
      const slot = EXTRA_SLOTS[fills.length] as Fill['slot'];
      const fill = pickFill(
        fillCandidates(ctx, usedIds),
        band.min - balanced.totalKcal,
        ctx,
        `${targets.date}:${slot}`,
      );
      if (fill === null) return;
      const before = balanced;
      fills.push({ variant: fill, slot });
      usedIds.add(fill.recipe.id);
      balanced = balancePortions(drafts(), band, foods);
      if (balanced.status === 'above') {
        fills.pop();
        balanced = before;
        return;
      }
    }
  };
  addFills();

  // Optionale Zutaten zählen für die Obergrenze mit (K3). Liegt der Tag nur ihretwegen darüber, werden sie
  // weggelassen (`optional_omitted_ceiling`) – erst danach wird eine Mahlzeit gestrichen (Wächter N3 NB1).
  const overWithOptional = () =>
    balanced.totalKcal + balanced.portions.reduce((sum, p) => sum + p.optionalKcal, 0) > band.max;
  const stripOptional = (): boolean => {
    let best: { kind: 'meal' | 'fill'; index: number; kcal: number } | null = null;
    balanced.portions.forEach((p, i) => {
      if (p.optionalKcal <= 0 || (best !== null && p.optionalKcal <= best.kcal)) return;
      best =
        i < selected.length
          ? { kind: 'meal', index: i, kcal: p.optionalKcal }
          : { kind: 'fill', index: i - selected.length, kcal: p.optionalKcal };
    });
    if (best === null) return false;
    const target = best as { kind: 'meal' | 'fill'; index: number };
    if (target.kind === 'meal') {
      const meal = selected[target.index] as SelectedMeal;
      const stripped = withoutOptionals(meal.variant, foods);
      if (stripped === null) return false;
      selected = selected.map((m, i) => (i === target.index ? { ...m, variant: stripped } : m));
    } else {
      const fill = fills[target.index] as Fill;
      const stripped = withoutOptionals(fill.variant, foods);
      if (stripped === null) return false;
      fills = fills.map((f, i) => (i === target.index ? { ...f, variant: stripped } : f));
    }
    notices.add('optional_omitted_ceiling');
    balanced = balancePortions(drafts(), band, foods);
    return true;
  };

  // Zu viel: erst optionale Zutaten weglassen, dann Mahlzeiten streichen (nie über der Obergrenze ausliefern).
  while (balanced.status === 'above' || overWithOptional()) {
    if (stripOptional()) {
      if (balanced.status === 'below') addFills();
      continue;
    }
    if (balanced.status !== 'above') break;
    const dropIndex = options.allowDrop ? chooseDrop(selected, foods) : null;
    if (dropIndex === null) {
      // Nur bei festen Vorgaben (Meal-Prep-Wochenplan): der Aufrufer bietet den Plan dann nicht an (G3).
      return finalize(balanced.portions, 'below_floor', true);
    }
    const dropped = selected[dropIndex] as SelectedMeal;
    selected = selected.filter((_, i) => i !== dropIndex);
    emptySlots.push({ slot: dropped.slot, reasons: ['above_ceiling'] });
    notices.add('meal_removed_ceiling');
    fills = [];
    balanced = selected.length === 0 ? emptyDay() : balancePortions(drafts(), band, foods);
    addFills();
  }

  if (balanced.status === 'below') return finalize(balanced.portions, 'below_floor', false);
  return finalize(balanced.portions, 'complete', false);
}

function emptyDay(): ReturnType<typeof balancePortions> {
  return { portions: [], totalKcal: 0, status: 'below' };
}

/** Welche Mahlzeit fällt weg? Nicht vorgegebene zuerst Snacks, dann Hauptmahlzeiten; die mit den meisten kcal. */
function chooseDrop(selected: readonly SelectedMeal[], foods: FoodLookup): number | null {
  let best: { index: number; rank: number; kcal: number } | null = null;
  selected.forEach((s, index) => {
    if (s.pinned) return;
    const rank =
      (s.fixedFactor !== undefined ? 2 : 0) + (mealTypeForSlot(s.slot) === 'snack' ? 0 : 1);
    const kcal = scalePortion(s.variant, s.fixedFactor ?? PORTION_SCALE_LIMITS.min, foods).nutrients
      .kcal;
    if (best === null || rank < best.rank || (rank === best.rank && kcal > best.kcal)) {
      best = { index, rank, kcal };
    }
  });
  return best === null ? null : (best as { index: number }).index;
}

// ---------------------------------------------------------------------------------------------------------
// Woche
// ---------------------------------------------------------------------------------------------------------

/** Kandidaten für einen Platz an einem Tag (Person + Platz). */
function slotCandidates(
  ctx: DayContext,
  slot: MealSlotId,
  options: { mealPrep?: boolean; maxMinutes?: number | null; excludePregnancy?: boolean },
): FilteredRecipe[] {
  const exclude =
    options.excludePregnancy ?? ctx.targets.recipeExclusions.includes('pregnancy_caution');
  return ctx.pool.allowed(exclude).filter(
    (c) =>
      slotFitReasons(c.recipe, {
        slot,
        mealPrep: options.mealPrep ?? false,
        maxMinutes: options.maxMinutes ?? null,
      }).length === 0,
  );
}

function scoreArgs(ctx: DayContext, slot: MealSlotId, role: MealRole, share: number): ScoreArgs {
  const band = mealPlanBand(ctx.targets);
  return {
    weekStart: ctx.weekStart,
    variant: ctx.variant,
    slotKey: `${ctx.targets.date}:${slot}`,
    role,
    targetKcal: band === null ? null : (share * (band.min + band.max)) / 2,
    dayIndex: ctx.dayIndex,
    likes: new Set(ctx.pool.profile.likes),
    intolerances: new Set(ctx.pool.profile.intolerances),
  };
}

/** Täglich frisch: bester Kandidat innerhalb der Wiederholungsgrenzen, sonst ausnahmsweise mit Wiederholung. */
export function pickDailyMeal(
  ctx: DayContext,
  slot: MealSlotId,
  role: MealRole,
  share: number,
  excludeIds: ReadonlySet<string> = new Set(),
): { variant: FilteredRecipe | null; repeated: boolean; reasons: EmptySlotReason[] } {
  const maxMinutes = isWeekday(ctx.targets.date) ? ctx.pool.profile.maxPrepMinutesWeekday : null;
  const candidates = slotCandidates(ctx, slot, { maxMinutes }).filter(
    (c) => !excludeIds.has(c.recipe.id),
  );
  if (candidates.length === 0) {
    const exclude = ctx.targets.recipeExclusions.includes('pregnancy_caution');
    return {
      variant: null,
      repeated: false,
      reasons: ctx.pool.emptyReasons(exclude, { slot, maxMinutes }),
    };
  }
  const type = mealTypeForSlot(slot);
  const args = scoreArgs(ctx, slot, role, share);
  const within = candidates.filter((c) =>
    ctx.state.withinRepeatLimits(c.recipe.id, type, ctx.dayIndex),
  );
  if (within.length > 0) {
    return {
      variant: pickBest(within, args, ctx.state, ctx.pool.foods),
      repeated: false,
      reasons: [],
    };
  }
  // Nicht am selben Tag doppelt, wenn es irgend geht.
  const notToday = candidates.filter(
    (c) => !(ctx.state.uses.get(c.recipe.id) ?? []).includes(ctx.dayIndex),
  );
  return {
    variant: pickBest(notToday.length > 0 ? notToday : candidates, args, ctx.state, ctx.pool.foods),
    repeated: true,
    reasons: [],
  };
}

interface PrepAssignment {
  readonly variant: FilteredRecipe | null;
  readonly keeping: ReturnType<typeof mealPrepKeeping> | null;
}

/** Pins (Meal-Prep-Wochenplan) je `datum|platz`. */
export type MealPins = ReadonlyMap<string, PinnedMeal>;

export function pinKey(date: string, slot: MealSlotId): string {
  return `${date}|${slot}`;
}

/** Wochen-Essensplan (Plan 6.3) – deterministisch, jeder Tag im Planband oder `below_floor` (B1). */
export function buildMealPlanWeek(input: MealPlanInput): MealPlanWeek {
  return buildMealPlanWeekDetailed(input).plan;
}

/**
 * Wie `buildMealPlanWeek`, zusätzlich mit den Tagen, die nur wegen fester Vorgaben über der Obergrenze lägen.
 * `pins` (intern, `applyMealPrepPlan`) geben Mahlzeiten fest vor; sie ersetzen die Kochtermine aus
 * `mealprep_days` (19.6 Nr. 5). Solche Tage werden nie ausgeliefert (G3).
 */
export function buildMealPlanWeekDetailed(
  input: MealPlanInput,
  internal: { readonly pins?: MealPins; readonly mealPrepPlanId?: string } = {},
): { readonly plan: MealPlanWeek; readonly aboveCeilingDays: readonly string[] } {
  const today = isoDateSchema.parse(input.today);
  const variant = variantSchema.parse(input.variant ?? 0);
  const { targets } = input;
  const weekStart = targets.weekStart;
  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    input.substitutions,
  );
  const profile = pool.profile;
  const state = new WeekState();
  const existing =
    input.existingPlan !== undefined &&
    input.existingPlan !== null &&
    input.existingPlan.weekStart === weekStart
      ? input.existingPlan
      : null;
  const pins = internal.pins ?? new Map<string, PinnedMeal>();
  const usePrepSchedule =
    profile.cookingMode === 'meal_prep' && profile.mealprepDays !== null && pins.size === 0;
  const events: CookEvent[] = usePrepSchedule
    ? mealPrepCookEvents(weekStart, profile.mealprepDays as number)
    : [];
  const prepSlots = new Set(mealPrepSlots(profile.mealprepSlots));
  const assignments = new Map<string, PrepAssignment>();

  const days: PlannedMealDay[] = [];
  const aboveCeilingDays: string[] = [];

  targets.days.forEach((dayTargets, dayIndex) => {
    const date = dayTargets.date;
    const ctx: DayContext = { targets: dayTargets, dayIndex, weekStart, variant, pool, state };
    const existingDay = existing?.days.find((d) => d.date === date);

    // Vergangene Tage ändern sich nie (6.3 Nr. 7).
    if (existingDay !== undefined && date < today) {
      days.push(existingDay);
      existingDay.meals.forEach((meal) => {
        const recipe = input.recipes.find((r) => r.id === meal.recipeId);
        if (recipe === undefined) return;
        const r = pool.result(recipe, false, meal.ingredientSwaps);
        if (r.ok) state.record(r.value, dayIndex, input.foods, meal.prepKind !== 'leftover');
      });
      return;
    }

    const exclude = dayTargets.recipeExclusions.includes('pregnancy_caution');
    const selected: SelectedMeal[] = [];
    const emptySlots: EmptySlot[] = [];
    const notices = new Set<MealPlanNoticeCode>();
    const usedToday = new Set<string>();

    for (const slotInfo of dayTargets.slots) {
      const { slot, role, share } = slotInfo;
      const base = { slot, role, share, pinned: false, mealPrepPlanId: null } as const;

      // 1. Feste Vorgabe aus einem Meal-Prep-Wochenplan.
      const pin = pins.get(pinKey(date, slot));
      if (pin !== undefined) {
        selected.push({
          ...base,
          variant: pin.variant,
          prepKind: pin.prepKind,
          cookDate: pin.cookDate,
          storage: pin.storage,
          pinned: true,
          mealPrepPlanId: pin.mealPrepPlanId,
        });
        usedToday.add(pin.variant.recipe.id);
        state.record(pin.variant, dayIndex, input.foods, false);
        continue;
      }

      // 2. Schon gekochte Reste aus dem bisherigen Plan bleiben fest – wenn sie noch durch den Filter kommen.
      const old = existingDay?.meals.find((m) => m.slot === slot && !m.isFill);
      if (old !== undefined && old.prepKind === 'leftover' && old.cookDate < today) {
        const recipe = input.recipes.find(
          (r) => r.id === old.recipeId && r.version === old.recipeVersion,
        );
        const r = recipe === undefined ? null : pool.result(recipe, exclude, old.ingredientSwaps);
        const fixed = r !== null && r.ok ? variantForMeal(r.value, old, input.foods) : null;
        // Nur, solange der Rest noch hält (Kochtag + Haltbarkeit ≥ Tag, Wächter N5a K-a) – sonst neu belegen.
        if (fixed !== null && leftoverKeeps(old, date, mealPrepKeeping(fixed, input.foods))) {
          selected.push({
            ...base,
            variant: fixed,
            prepKind: 'leftover',
            cookDate: old.cookDate,
            storage: old.storage,
            fixedFactor: old.factor,
            mealPrepPlanId: old.mealPrepPlanId,
          });
          usedToday.add(fixed.recipe.id);
          state.record(fixed, dayIndex, input.foods, false);
          continue;
        }
      }

      // 3. Meal-Prep nach Kochterminen (6.4).
      const event = prepSlots.has(slot)
        ? events.find((e) => e.dayIndices.includes(dayIndex))
        : undefined;
      if (event !== undefined && event.cookDate >= today) {
        const key = `${event.offset}|${slot}`;
        let assignment = assignments.get(key);
        if (assignment === undefined) {
          assignment = choosePrepRecipe(ctx, event, slot, role, share, targets, assignments);
          assignments.set(key, assignment);
          if (assignment.variant !== null) {
            state.record(assignment.variant, dayIndex, input.foods, true);
          }
        }
        if (assignment.variant !== null && assignment.keeping !== null) {
          const use: MealPrepDayUse = mealPrepDayUse(assignment.keeping, dayIndex - event.offset);
          if (use !== 'fresh' && !(exclude && assignment.variant.facts.pregnancyCaution)) {
            selected.push({
              ...base,
              variant: assignment.variant,
              prepKind: use === 'cook' ? 'cook' : 'leftover',
              cookDate: event.cookDate,
              storage: use === 'fridge' || use === 'freeze' ? use : null,
            });
            usedToday.add(assignment.variant.recipe.id);
            continue;
          }
        }
        // Jenseits der Haltbarkeit ohne Einfrieren (oder kein geeignetes Gericht): frisch kochen (S12, W15).
        notices.add('meal_prep_fresh_days');
      }

      // 4. Täglich frisch.
      const pick = pickDailyMeal(ctx, slot, role, share, usedToday);
      if (pick.variant === null) {
        emptySlots.push({ slot, reasons: pick.reasons });
        continue;
      }
      if (pick.repeated) notices.add('recipe_repeated');
      selected.push({
        ...base,
        variant: pick.variant,
        prepKind: 'fresh',
        cookDate: date,
        storage: null,
      });
      usedToday.add(pick.variant.recipe.id);
      state.record(pick.variant, dayIndex, input.foods, true);
    }

    // Mit festen Vorgaben (Meal-Prep-Wochenplan) fällt nichts weg: passt der Tag nicht, wird der Plan nicht
    // angeboten (19.6 Nr. 7, G3).
    const finished = finishDay(ctx, selected, emptySlots, notices, {
      allowDrop: !selected.some((m) => m.pinned),
    });
    if (finished.aboveCeiling) aboveCeilingDays.push(date);
    finished.day.meals
      .filter((m) => m.isFill)
      .forEach((m) => {
        const recipe = input.recipes.find((r) => r.id === m.recipeId);
        const r = recipe === undefined ? null : pool.result(recipe, exclude);
        if (r !== null && r.ok) state.record(r.value, dayIndex, input.foods, true);
      });
    days.push(finished.day);
  });

  return {
    plan: assembleWeek(repairOrphanLeftovers(days, weekStart), {
      weekStart,
      variant,
      // Übernommene vergangene Tage (Faktoren, Ersatz, leere Plätze) tragen den Gesundheitsbezug des alten Plans
      // weiter (Wächter N5a S1) – sonst würde ein Widerruf den neu geplanten Plan nicht löschen.
      usesHealthData:
        targets.usesHealthData ||
        profile.intolerances.length > 0 ||
        (existing !== null && existing.usesHealthData && days.some((d) => d.date < today)),
      mealPrepPlanId: internal.mealPrepPlanId ?? null,
    }),
    aboveCeilingDays,
  };
}

/**
 * Variante des Filters passend zur geplanten Mahlzeit: gleiche Ersatzprodukte, und weggelassen sind die vom Filter
 * weggelassenen Zutaten plus höchstens weitere OPTIONALE (wegen der Obergrenze, `optional_omitted_ceiling`).
 * Sonst null (dann passt die Mahlzeit nicht mehr zum Filter).
 */
export function variantForMeal(
  variant: FilteredRecipe,
  meal: Pick<PlannedMeal, 'substitutions' | 'omittedOptional' | 'ingredientSwaps'>,
  foods: FoodLookup,
): FilteredRecipe | null {
  const subsA = variant.substitutions.map((s) => `${s.index}:${s.substituteFoodId}`).join(',');
  const subsB = meal.substitutions.map((s) => `${s.index}:${s.substituteFoodId}`).join(',');
  if (subsA !== subsB) return null;
  // Getauschte Zutaten (19.7 N9) müssen genau übereinstimmen – der Aufrufer filtert mit `meal.ingredientSwaps`.
  if (swapKey(variant.swaps) !== swapKey(meal.ingredientSwaps ?? [])) return null;
  return withMealOmissions(variant, meal, foods);
}

/**
 * Variante mit den bei der Mahlzeit zusätzlich weggelassenen OPTIONALEN Zutaten (Obergrenze, NB1); null, wenn der
 * Filter eine Zutat weglässt, die bei der Mahlzeit nicht fehlt, oder die Mahlzeit eine Pflichtzutat weglässt.
 */
export function withMealOmissions(
  variant: FilteredRecipe,
  meal: Pick<PlannedMeal, 'omittedOptional'>,
  foods: FoodLookup,
): FilteredRecipe | null {
  const mealOmitted = new Set(meal.omittedOptional.map((o) => o.index));
  if (variant.omitted.some((i) => !mealOmitted.has(i))) return null;
  const extra = [...mealOmitted].filter((i) => !variant.omitted.includes(i));
  if (extra.length === 0) return variant;
  if (extra.some((i) => variant.recipe.ingredients[i]?.optional !== true)) return null;
  return withOmittedOptionals(variant, [...variant.omitted, ...extra], foods);
}

function withOmittedOptionals(
  variant: FilteredRecipe,
  omitted: readonly number[],
  foods: FoodLookup,
): FilteredRecipe {
  const sorted = [...new Set(omitted)].sort((a, b) => a - b);
  return {
    ...variant,
    omitted: sorted,
    facts: computeRecipeFacts(variant.recipe, foods, {
      omitted: new Set(sorted),
      substitutions: new Map(variant.substitutions.map((x) => [x.index, x.substituteFoodId])),
      swaps: swapFactsMap(variant.swaps),
    }),
  };
}

/** Lässt alle noch enthaltenen optionalen Zutaten weg (Obergrenze, Wächter N3 NB1); null, wenn es keine gibt. */
function withoutOptionals(variant: FilteredRecipe, foods: FoodLookup): FilteredRecipe | null {
  const optional = variant.recipe.ingredients.flatMap((ing, i) =>
    ing.optional && !variant.omitted.includes(i) ? [i] : [],
  );
  return optional.length === 0
    ? null
    : withOmittedOptionals(variant, [...variant.omitted, ...optional], foods);
}

/**
 * Was `buildMealPlanWeek` für jeden ausgelieferten Tag garantiert (Wächter N3 NB1) – dieselbe Prüfung nutzt
 * `needsAutomaticReplan`: `complete` liegt im Band, `below_floor` liegt darunter, und mit den nicht weggelassenen
 * optionalen Zutaten liegt kein Tag über der Obergrenze. `no_targets` ohne Band.
 */
export function dayWithinPlanBand(
  day: Pick<PlannedMealDay, 'status' | 'totals' | 'meals'>,
  band: { readonly min: number; readonly max: number } | null,
): boolean {
  if (band === null || day.status === 'no_targets') return true;
  const kcal = day.totals.kcal;
  const withOptional = kcal + day.meals.reduce((sum, m) => sum + m.optionalKcal, 0);
  if (withOptional > band.max) return false;
  if (day.status === 'complete') return kcal >= band.min;
  return kcal < band.min;
}

/** Rezept für einen Kochtermin und Platz (6.4): geeignet, hält möglichst alle Tage, wechselt zwischen Terminen. */
function choosePrepRecipe(
  ctx: DayContext,
  event: CookEvent,
  slot: MealSlotId,
  role: MealRole,
  share: number,
  targets: NutritionWeekTargets,
  assignments: ReadonlyMap<string, PrepAssignment>,
): PrepAssignment {
  // Schwangerschafts-Ausschluss, wenn er an IRGENDEINEM abgedeckten Tag gilt (sichere Richtung).
  const excludePregnancy = event.dayIndices.some(
    (d) => targets.days[d]?.recipeExclusions.includes('pregnancy_caution') === true,
  );
  const maxMinutes =
    event.offset >= 0 && isWeekday(event.cookDate) ? ctx.pool.profile.maxPrepMinutesWeekday : null;
  const otherIds = new Set(
    [...assignments.values()].flatMap((a) => (a.variant === null ? [] : [a.variant.recipe.id])),
  );
  const candidates = slotCandidates(ctx, slot, { mealPrep: true, maxMinutes, excludePregnancy });
  if (candidates.length === 0) return { variant: null, keeping: null };
  const fresh = candidates.filter((c) => !otherIds.has(c.recipe.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  const lastDay = Math.max(...event.dayIndices);
  const span = lastDay - event.offset;
  const keeps = pool.filter((c) => {
    const keeping = mealPrepKeeping(c, ctx.pool.foods);
    return span <= keeping.fridgeDays || keeping.freezable;
  });
  const args = scoreArgs(ctx, slot, role, share);
  const chosen = pickBest(keeps.length > 0 ? keeps : pool, args, ctx.state, ctx.pool.foods);
  return {
    variant: chosen,
    keeping: chosen === null ? null : mealPrepKeeping(chosen, ctx.pool.foods),
  };
}

export function assembleWeek(
  days: readonly PlannedMealDay[],
  info: {
    weekStart: string;
    variant: number;
    usesHealthData: boolean;
    mealPrepPlanId: string | null;
  },
): MealPlanWeek {
  const notices = new Set<MealPlanNoticeCode>();
  if (days.some((d) => d.meals.some((m) => m.recipeStatus !== 'published'))) {
    notices.add('drafts_used');
    notices.add('drafts_allergens_unreviewed');
  }
  return {
    weekStart: info.weekStart,
    variant: info.variant,
    engineVersion: MEAL_PLAN_ENGINE_VERSION,
    days,
    notices: sortMealPlanNotices(notices),
    // Getauschte Zutaten lassen wie Ersatzprodukte auf Unverträglichkeiten oder Abneigungen schließen (Wächter N9 S5):
    // ein Plan mit Tausch ist ein Gesundheitsdatum (Einwilligung, Widerruf, Export wie bei Ersatzprodukten).
    usesHealthData:
      info.usesHealthData ||
      days.some((d) => d.meals.some((m) => (m.ingredientSwaps?.length ?? 0) > 0)),
    mealPrepPlanId: info.mealPrepPlanId,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Rezept tauschen (6.3 Nr. 7)
// ---------------------------------------------------------------------------------------------------------

export type SwapResult =
  | { readonly ok: true; readonly plan: MealPlanWeek }
  | {
      readonly ok: false;
      /**
       * `replan_needed`: eine andere Mahlzeit des Tages besteht den Filter nicht mehr (oder die Rezeptversion fehlt) –
       * erst automatisch neu planen (6.6), statt sie beim Tausch still wegzulassen (Wächter N3 S4).
       */
      readonly reason: 'past_day' | 'not_found' | 'no_alternative' | 'replan_needed';
    };

/** Kandidaten nach Punkten sortiert (beste zuerst), Gleichstand wie `pickBest`. */
function rankCandidates(
  candidates: readonly FilteredRecipe[],
  args: ScoreArgs,
  state: WeekState,
  foods: FoodLookup,
): FilteredRecipe[] {
  return candidates
    .map((c) => ({
      c,
      score: Math.round(scoreCandidate(c, args, state, foods) * 1e9) / 1e9,
      hash: stableHashKey(args.weekStart, args.slotKey, c.recipe.id, String(args.variant)),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.hash - b.hash ||
        (a.c.recipe.id < b.c.recipe.id ? -1 : a.c.recipe.id > b.c.recipe.id ? 1 : 0),
    )
    .map((x) => x.c);
}

/**
 * Meal-Prep-Reste ohne Kochtag-Mahlzeit (Wächter N3 S2): Wird am Kochtag (in dieser Woche) nicht mehr gekocht –
 * Mahlzeit getauscht oder wegen der Obergrenze gestrichen –, wird das Gericht an den Folgetagen frisch gekocht
 * (gleiches Rezept, gleiche Portion, Hinweis `meal_prep_fresh_days`). So stimmen Plan und Einkaufsliste.
 */
export function repairOrphanLeftovers(
  days: readonly PlannedMealDay[],
  weekStart: string,
): PlannedMealDay[] {
  const cooked = new Set(
    days.flatMap((d) =>
      d.meals.filter((m) => m.prepKind === 'cook').map((m) => `${d.date}|${m.slot}|${m.recipeId}`),
    ),
  );
  return days.map((day) => {
    let changed = false;
    const meals = day.meals.map((m) => {
      if (
        m.prepKind !== 'leftover' ||
        m.cookDate < weekStart ||
        cooked.has(`${m.cookDate}|${m.slot}|${m.recipeId}`)
      ) {
        return m;
      }
      changed = true;
      return { ...m, prepKind: 'fresh' as const, cookDate: day.date, storage: null };
    });
    if (!changed) return day;
    const notices = new Set<MealPlanNoticeCode>(day.notices);
    notices.add('meal_prep_fresh_days');
    if (!meals.some((m) => m.storage === 'freeze')) notices.delete('meal_prep_freeze');
    return { ...day, meals, notices: sortMealPlanNotices(notices) };
  });
}

/**
 * „Rezept tauschen“ (6.3 Nr. 7): bester Kandidat, der in dieser Woche noch nicht vorkommt und den Tag NICHT
 * verschlechtert – keine andere Mahlzeit fällt weg, nie über der Obergrenze, ein vollständiger Tag bleibt
 * vollständig (Wächter N3 S3); gibt es keinen, `no_alternative`. Danach wird der Tag erneut ausgeglichen
 * (Ergänzungs-Snacks neu). Das neue Gericht wird an dem Tag frisch gekocht; war die getauschte Mahlzeit ein
 * Meal-Prep-Kochtag, werden die Reste an den Folgetagen frisch gekocht (S2). Vergangene Tage ändern sich nie.
 */
export function swapMealRecipe(
  plan: MealPlanWeek,
  target: { readonly date: string; readonly slot: MealSlotId },
  input: Omit<MealPlanInput, 'existingPlan' | 'variant'>,
): SwapResult {
  const today = isoDateSchema.parse(input.today);
  if (target.date < today) return { ok: false, reason: 'past_day' };
  const dayIndex = plan.days.findIndex((d) => d.date === target.date);
  const day = plan.days[dayIndex];
  const dayTargets = input.targets.days.find((d) => d.date === target.date);
  const meal = day?.meals.find((m) => m.slot === target.slot && !m.isFill);
  if (day === undefined || dayTargets === undefined || meal === undefined) {
    return { ok: false, reason: 'not_found' };
  }
  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    input.substitutions,
  );
  const state = new WeekState();
  const exclude = dayTargets.recipeExclusions.includes('pregnancy_caution');
  /** Gleiche Rezeptversion, besteht den Filter, gleiche Weglassungen/Ersatzprodukte (S4). */
  const refilter = (m: PlannedMeal, excludePregnancy: boolean): FilteredRecipe | null => {
    const recipe = input.recipes.find((r) => r.id === m.recipeId && r.version === m.recipeVersion);
    const r =
      recipe === undefined ? null : pool.result(recipe, excludePregnancy, m.ingredientSwaps);
    return r !== null && r.ok ? variantForMeal(r.value, m, input.foods) : null;
  };
  plan.days.forEach((d, i) =>
    d.meals.forEach((m) => {
      const v = refilter(m, false);
      if (v !== null) state.record(v, i, input.foods, m.prepKind !== 'leftover');
    }),
  );

  const others: SelectedMeal[] = [];
  for (const m of day.meals) {
    if (m.isFill || m === meal) continue;
    const v = refilter(m, exclude);
    if (v === null) return { ok: false, reason: 'replan_needed' };
    const info = dayTargets.slots.find((s) => s.slot === m.slot);
    others.push({
      slot: m.slot as MealSlotId,
      role: m.role,
      share: info?.share ?? 0,
      mealPrepPlanId: m.mealPrepPlanId,
      pinned: m.mealPrepPlanId !== null,
      variant: v,
      prepKind: m.prepKind,
      cookDate: m.cookDate,
      storage: m.storage,
      ...(m.fixed ? { fixedFactor: m.factor } : {}),
    });
  }

  const inWeek = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
  const ctx: DayContext = {
    targets: dayTargets,
    dayIndex,
    weekStart: plan.weekStart,
    variant: plan.variant,
    pool,
    state,
  };
  const share = dayTargets.slots.find((s) => s.slot === target.slot)?.share ?? 0;
  const maxMinutes = isWeekday(target.date) ? pool.profile.maxPrepMinutesWeekday : null;
  const candidates = rankCandidates(
    slotCandidates(ctx, target.slot, { maxMinutes }).filter((c) => !inWeek.has(c.recipe.id)),
    scoreArgs(ctx, target.slot, meal.role, share),
    state,
    input.foods,
  );
  const keptNotices = day.notices.filter(
    (n) => n === 'meal_prep_fresh_days' || n === 'recipe_repeated' || n === 'meal_removed_ceiling',
  );
  const slotOrder = new Map(dayTargets.slots.map((s, i) => [s.slot, i]));
  for (const candidate of candidates) {
    const selected: SelectedMeal[] = [
      ...others,
      {
        slot: target.slot,
        role: meal.role,
        share,
        variant: candidate,
        prepKind: 'fresh' as const,
        cookDate: target.date,
        storage: null,
        mealPrepPlanId: null,
        pinned: false,
      },
    ].sort((a, b) => (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0));
    // Nichts streichen: ein Tausch darf keine andere Mahlzeit verdrängen (S3).
    const finished = finishDay(ctx, selected, day.emptySlots, keptNotices, { allowDrop: false });
    if (finished.aboveCeiling) continue;
    if (day.status === 'complete' && finished.day.status !== 'complete') continue;
    const days = repairOrphanLeftovers(
      plan.days.map((d, i) => (i === dayIndex ? finished.day : d)),
      plan.weekStart,
    );
    return {
      ok: true,
      plan: assembleWeek(days, {
        weekStart: plan.weekStart,
        variant: plan.variant,
        usesHealthData: plan.usesHealthData,
        mealPrepPlanId: plan.mealPrepPlanId,
      }),
    };
  }
  return { ok: false, reason: 'no_alternative' };
}

/** Datum eines Wochentags (0 = Montag). */
export function weekDate(weekStart: string, dayIndex: number): string {
  return addDays(weekStart, dayIndex);
}
