import { isoDateSchema } from '../age';
import type { Food, FoodLookup } from '../content/food-schema';
import { servingAmountFindings } from '../content/recipe-checks';
import type { IngredientRole, Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import { daysBetween } from '../dates';
import {
  type FilteredRecipe,
  filterRecipe,
  type IngredientSwapRef,
  type RecipeFilterContext,
} from './filter';
import {
  assembleWeek,
  CandidatePool,
  type DayContext,
  finishDay,
  type MealPlanInput,
  type MealPlanWeek,
  type PlannedMeal,
  type PlannedMealDay,
  type PrepKind,
  repairOrphanLeftovers,
  type SelectedMeal,
  variantForMeal,
  WeekState,
  withMealOmissions,
  fixedMealSelection,
} from './meal-plan';
import { freshCookTooLong, mealPrepKeeping, prepStorageForDay } from './meal-prep';
import type { MealPlanNoticeCode } from './notices';
import type { RecipeNutrients } from './recipe-nutrients';
import type { ScaledIngredient } from './scale';
import { resolveIngredientSwaps, substitutionFor, swapKey } from './swap-resolve';
import type { MealSlotId } from './timing';

/**
 * Zutaten-Austausch (docs/PLAN-PHASE-5.md 19.7 N9, KONZEPT 6.9, Prompt D) – gratis, rein regelbasiert, ohne KI.
 *
 * Zutat einer geplanten Mahlzeit antippen → „Austauschen“ → Liste passender Alternativen aus der freigegebenen
 * Austausch-Tabelle (`content/substitutions/`). Eine Alternative wird NUR angeboten, wenn
 * 1. die Zutat eine Rolle hat (19.4 S6) und der Eintrag genau diese Rolle trägt,
 * 2. das GEÄNDERTE Rezept den kompletten Filter erneut besteht (`filter.ts`: Ernährungsform, Schwein inkl.
 *    `eats_pork = null` bei Mischkost, Unverträglichkeiten, „mag ich nicht“, Alkohol, `pregnancy_caution`; Ersatz
 *    ohne `heated` = ungegart, B2) – an JEDEM Tag, an dem das Gericht gegessen wird (Schwangerschaft an einem Tag
 *    genügt, sichere Richtung),
 * 3. danach R11 erfüllt ist (Salz, Öl, Zutat ≤ 600 g je Portion; `servingAmountFindings`),
 * 4. jeder betroffene Tag danach im Planband liegt oder `below_floor` ist – über der Obergrenze nie (S1). Ausgeglichen
 *    wird über die anderen Mahlzeiten und Ergänzungs-Snacks (`finishDay`, 6.2 B1); keine Mahlzeit fällt weg. Im
 *    Modus `no_targets` bleibt der Faktor 1.
 * Haltbarkeit (B2): Nach dem Tausch wird die Haltbarkeit (R9, `mealPrepKeeping` mit den TATSÄCHLICHEN Zutaten) neu
 * berechnet und auf alle Portionen desselben Kochtags angewandt – Tage jenseits der Haltbarkeit werden eingefroren
 * (nur einfrierbar) oder frisch gekocht. Ist das Gericht schon gekocht (Kochtag vorbei), gibt es keinen Tausch.
 *
 * Die Schutzgrenzen rechnet diese Datei NICHT – das Planband kommt fertig aus `nutritionTargetsForWeek`
 * (`clampCalorieTarget`, Strukturtest K2).
 */

export const INGREDIENT_SWAP_FAILURES = [
  /** Tag liegt in der Vergangenheit. */
  'past_day',
  /** Mahlzeit, Rezept(-version), Zutat oder Tagesziel nicht gefunden (auch weggelassene optionale Zutat). */
  'not_found',
  /** Vorgekochte Portion, Kochtag vorbei (B2). */
  'already_cooked',
  /** Zutat ohne Rolle (19.4 S6) – kein Tausch möglich. */
  'no_role',
  /** Diese Alternative steht nicht in der Austausch-Tabelle (bzw. nichts zum Zurücksetzen). */
  'not_offered',
  /** Das geänderte Rezept besteht den Filter der Person nicht. */
  'excluded',
  /** R11 nach dem Tausch verletzt (Salz, Öl, Zutat ≤ 600 g je Portion). */
  'amounts',
  /** Ein betroffener Tag läge über der Obergrenze (S1). */
  'above_ceiling',
  /**
   * Ein Rest müsste danach an einem Werktag frisch gekocht werden, das Rezept dauert aber länger als „werktags
   * höchstens X Minuten“ (Wächter N3 K1, N9 S1 – dieselbe Regel wie `applyMealPrepPlan`).
   */
  'prep_time',
  /** Eine andere Mahlzeit eines betroffenen Tages besteht den Filter nicht mehr – erst neu planen (6.6). */
  'replan_needed',
] as const;
export type IngredientSwapFailure = (typeof INGREDIENT_SWAP_FAILURES)[number];

/**
 * Zusatzangaben aus dem gespeicherten Plan (Wächter N9 K1): `cookStartedOn` = Tag, an dem der Kochtag gestartet wurde
 * (Kochtag-Timer). An diesem Kochtag ist das Gericht schon in Arbeit – dann gibt es keinen Tausch mehr.
 */
export interface IngredientSwapContext {
  readonly cookStartedOn?: string | null;
}

/** Zutat einer geplanten Mahlzeit: Tag, Platz und Index der Zutat im Rezept. */
export interface IngredientSwapTarget {
  readonly date: string;
  readonly slot: MealSlotId;
  readonly index: number;
}

export type IngredientSwapResult =
  | {
      readonly ok: true;
      readonly plan: MealPlanWeek;
      /** Tage, deren Mahlzeit sich geändert hat (Kochtag und Reste desselben Gerichts). */
      readonly affectedDates: readonly string[];
      /** Betroffene Tage, die vorher vollständig waren und danach `below_floor` sind (Wächter N9 S2). */
      readonly belowFloorDates: readonly string[];
    }
  | { readonly ok: false; readonly reason: IngredientSwapFailure };

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

interface BatchMember {
  readonly dayIndex: number;
  readonly meal: PlannedMeal;
}

interface Located {
  readonly meal: PlannedMeal;
  readonly recipe: Recipe;
  readonly role: IngredientRole;
  /** Alle Portionen desselben Gerichts (Kochtag + Reste) bzw. nur die Mahlzeit selbst (frisch gekocht). */
  readonly batch: readonly BatchMember[];
}

function locate(
  plan: MealPlanWeek,
  target: IngredientSwapTarget,
  input: PlanInput,
  context: IngredientSwapContext,
): Located | IngredientSwapFailure {
  const today = isoDateSchema.parse(input.today);
  if (target.date < today) return 'past_day';
  const dayIndex = plan.days.findIndex((d) => d.date === target.date);
  const day = plan.days[dayIndex];
  const meal = day?.meals.find((m) => m.slot === target.slot && !m.isFill);
  if (day === undefined || meal === undefined) return 'not_found';
  if (!input.targets.days.some((d) => d.date === target.date)) return 'not_found';
  // Schon gekocht (B2): Für vorgekochte Portionen wird nicht getauscht.
  if (meal.prepKind === 'leftover' && meal.cookDate < today) return 'already_cooked';
  const recipe = input.recipes.find(
    (r) => r.id === meal.recipeId && r.version === meal.recipeVersion,
  );
  const ingredient = recipe?.ingredients[target.index];
  if (recipe === undefined || ingredient === undefined) return 'not_found';
  if (meal.omittedOptional.some((o) => o.index === target.index)) return 'not_found';
  if (ingredient.role === undefined) return 'no_role';

  const batch: BatchMember[] =
    meal.prepKind === 'fresh'
      ? [{ dayIndex, meal }]
      : plan.days.flatMap((d, i) =>
          d.meals
            .filter(
              (m) =>
                !m.isFill &&
                m.recipeId === meal.recipeId &&
                m.slot === meal.slot &&
                m.cookDate === meal.cookDate &&
                (m.prepKind === 'cook' || m.prepKind === 'leftover'),
            )
            .map((m) => ({ dayIndex: i, meal: m })),
        );
  // Restetage, die ein früherer Tausch zu „frisch gekocht“ gemacht hat (eigenes Kochdatum), gehören weiter zu diesem
  // Gericht: gleiches Rezept, gleicher Platz und Meal-Prep-Plan, dieselben Tausche, nach dem Kochtag (Wächter N9
  // Runde 2) – sonst behielten sie beim Zurücknehmen den Ersatz.
  const key = swapKey(meal.ingredientSwaps ?? []);
  if (meal.prepKind !== 'fresh' && key !== '') {
    plan.days.forEach((d, i) => {
      if (d.date <= meal.cookDate || d.date < today) return;
      for (const m of d.meals) {
        if (
          !m.isFill &&
          m.prepKind === 'fresh' &&
          m.recipeId === meal.recipeId &&
          m.recipeVersion === meal.recipeVersion &&
          m.slot === meal.slot &&
          m.mealPrepPlanId === meal.mealPrepPlanId &&
          swapKey(m.ingredientSwaps ?? []) === key
        ) {
          batch.push({ dayIndex: i, meal: m });
        }
      }
    });
    batch.sort((a, b) => a.dayIndex - b.dayIndex);
  }
  // Sicherheitsnetz: Jede Portion des Gerichts muss noch änderbar sein (nie vergangene Tage ändern).
  if (batch.some((b) => (plan.days[b.dayIndex] as PlannedMealDay).date < today)) {
    return 'already_cooked';
  }
  // Kochtag schon gestartet (K1): Das Gericht wird gerade gekocht – kein Tausch mehr.
  if (
    meal.prepKind !== 'fresh' &&
    context.cookStartedOn !== undefined &&
    context.cookStartedOn !== null &&
    meal.cookDate === context.cookStartedOn
  ) {
    return 'already_cooked';
  }
  return { meal, recipe, role: ingredient.role, batch };
}

/** Tatsächlich verwendetes Lebensmittel je Zutat (Weglassen, Ersatz S4, Tausch N9). */
function usedFoodAt(variant: FilteredRecipe, index: number, input: PlanInput): Food | undefined {
  if (variant.omitted.includes(index)) return undefined;
  const swap = variant.swaps.find((s) => s.index === index);
  const sub = variant.substitutions.find((s) => s.index === index);
  const id =
    swap?.substituteFoodId ?? sub?.substituteFoodId ?? variant.recipe.ingredients[index]?.food_id;
  return id === undefined ? undefined : input.foods.get(id);
}

function excludesPregnancy(input: PlanInput, date: string): boolean {
  return (
    input.targets.days
      .find((d) => d.date === date)
      ?.recipeExclusions.includes('pregnancy_caution') === true
  );
}

/**
 * Aufbewahrung nach dem Tausch – dieselbe Regel wie `applyMealPrepPlan` (`prepStorageForDay`, Wächter N9 S1): die
 * bisherige Aufbewahrung gilt als Vorgabe (sie enthält schon `storage_plan` bzw. R9), die sicherere Angabe gewinnt,
 * eingefroren nur bei einfrierbar, sonst frisch.
 */
function storageAfterSwap(
  member: PlannedMeal,
  date: string,
  keeping: ReturnType<typeof mealPrepKeeping>,
): { prepKind: PrepKind; cookDate: string; storage: 'fridge' | 'freeze' | null } {
  if (member.prepKind !== 'leftover') {
    return { prepKind: member.prepKind, cookDate: member.cookDate, storage: member.storage };
  }
  const method = prepStorageForDay(keeping, daysBetween(member.cookDate, date), member.storage);
  if (method === 'fresh' || method === 'cook') {
    return { prepKind: 'fresh', cookDate: date, storage: null };
  }
  return { prepKind: 'leftover', cookDate: member.cookDate, storage: method };
}

/**
 * Tauscht eine Zutat einer geplanten Mahlzeit gegen `substituteFoodId` aus der Austausch-Tabelle (`null` bzw. das
 * Original-Lebensmittel = Tausch zurücknehmen). Ergebnis ist der neue Plan – oder der Grund, warum der Tausch nicht
 * angeboten wird (Kopf dieser Datei). Vergangene Tage ändern sich nie; andere Mahlzeiten fallen nie weg.
 */
export function applyIngredientSwap(
  plan: MealPlanWeek,
  target: IngredientSwapTarget,
  substituteFoodId: string | null,
  input: PlanInput,
  context: IngredientSwapContext = {},
): IngredientSwapResult {
  const located = locate(plan, target, input, context);
  if (typeof located === 'string') return { ok: false, reason: located };
  const { meal, recipe, role, batch } = located;
  const ingredient = recipe.ingredients[target.index] as Recipe['ingredients'][number];
  const table: readonly IngredientSubstitution[] = input.substitutions ?? [];

  const current = meal.ingredientSwaps ?? [];
  const revert = substituteFoodId === null || substituteFoodId === ingredient.food_id;
  if (revert && !current.some((r) => r.index === target.index)) {
    return { ok: false, reason: 'not_offered' };
  }
  if (
    !revert &&
    (current.some((r) => r.index === target.index && r.substituteFoodId === substituteFoodId) ||
      substitutionFor(table, ingredient.food_id, substituteFoodId, role) === null)
  ) {
    return { ok: false, reason: 'not_offered' };
  }
  const nextRefs: IngredientSwapRef[] = [
    ...current.filter((r) => r.index !== target.index),
    ...(revert
      ? []
      : [{ index: target.index, foodId: ingredient.food_id, substituteFoodId: substituteFoodId }]),
  ].sort((a, b) => a.index - b.index);

  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    table,
  );
  // Schwangerschafts-Ausschluss, sobald er an IRGENDEINEM Tag des Gerichts gilt (sichere Richtung, wie 6.4).
  const batchDates = batch.map((b) => (plan.days[b.dayIndex] as PlannedMealDay).date);
  const exclude = batchDates.some((date) => excludesPregnancy(input, date));
  const filtered = pool.result(recipe, exclude, nextRefs);
  if (!filtered.ok) return { ok: false, reason: 'excluded' };
  const variant = withMealOmissions(filtered.value, meal, input.foods);
  if (variant === null) return { ok: false, reason: 'excluded' };
  // R11 nach dem Tausch (S6). Beim Zurücknehmen gilt das freigegebene Rezept (Inhaltsprüfung).
  if (
    !revert &&
    servingAmountFindings(variant.facts, (i) => usedFoodAt(variant, i, input)).length > 0
  ) {
    return { ok: false, reason: 'amounts' };
  }

  // Haltbarkeit neu (R9 mit den tatsächlichen Zutaten, B2).
  const keeping = mealPrepKeeping(variant, input.foods);

  // Wochenzustand für Ergänzungs-Snacks (wie „Rezept tauschen“).
  const state = new WeekState();
  const refilter = (m: PlannedMeal, excludeDay: boolean): FilteredRecipe | null => {
    const r = input.recipes.find((x) => x.id === m.recipeId && x.version === m.recipeVersion);
    const res = r === undefined ? null : pool.result(r, excludeDay, m.ingredientSwaps);
    return res !== null && res.ok ? variantForMeal(res.value, m, input.foods) : null;
  };
  plan.days.forEach((d, i) =>
    d.meals.forEach((m) => {
      const v = refilter(m, false);
      if (v !== null) state.record(v, i, input.foods, m.prepKind !== 'leftover');
    }),
  );

  const days = [...plan.days];
  const belowFloorDates: string[] = [];
  for (const member of batch) {
    const day = plan.days[member.dayIndex] as PlannedMealDay;
    const dayTargets = input.targets.days.find((d) => d.date === day.date);
    if (dayTargets === undefined) return { ok: false, reason: 'not_found' };
    const excludeDay = dayTargets.recipeExclusions.includes('pregnancy_caution');
    const placement = storageAfterSwap(member.meal, day.date, keeping);
    if (
      placement.prepKind === 'fresh' &&
      member.meal.prepKind === 'leftover' &&
      freshCookTooLong(recipe, day.date, pool.profile.maxPrepMinutesWeekday)
    ) {
      return { ok: false, reason: 'prep_time' };
    }
    const selected: SelectedMeal[] = [];
    for (const m of day.meals) {
      if (m.isFill) continue;
      const info = dayTargets.slots.find((s) => s.slot === m.slot);
      const base = {
        slot: m.slot as MealSlotId,
        role: m.role,
        share: info?.share ?? 0,
        mealPrepPlanId: m.mealPrepPlanId,
        pinned: m.mealPrepPlanId !== null,
        // Geteilte Mahlzeit (N13): bleibt exakt; wird sie SELBST getauscht, ist sie für diese Person danach eine
        // eigene Mahlzeit mit eigenem Faktor (Wächter N13 S1).
        ...(m === member.meal && m.shared === true ? {} : fixedMealSelection(m)),
      };
      if (m === member.meal) {
        selected.push({ ...base, variant, ...placement });
        continue;
      }
      const v = refilter(m, excludeDay);
      if (v === null) return { ok: false, reason: 'replan_needed' };
      selected.push({
        ...base,
        variant: v,
        prepKind: m.prepKind,
        cookDate: m.cookDate,
        storage: m.storage,
      });
    }
    const notices = new Set<MealPlanNoticeCode>(
      day.notices.filter(
        (n) =>
          n === 'meal_prep_fresh_days' || n === 'recipe_repeated' || n === 'meal_removed_ceiling',
      ),
    );
    if (placement.prepKind === 'fresh' && member.meal.prepKind === 'leftover') {
      notices.add('meal_prep_fresh_days');
    }
    const ctx: DayContext = {
      targets: dayTargets,
      dayIndex: member.dayIndex,
      weekStart: plan.weekStart,
      variant: plan.variant,
      pool,
      state,
    };
    // Nichts streichen: Ein Tausch darf keine andere Mahlzeit verdrängen; über der Obergrenze → kein Tausch (S1).
    const finished = finishDay(ctx, selected, day.emptySlots, notices, { allowDrop: false });
    if (finished.aboveCeiling) return { ok: false, reason: 'above_ceiling' };
    if (day.status === 'complete' && finished.day.status === 'below_floor') {
      belowFloorDates.push(day.date);
    }
    days[member.dayIndex] = finished.day;
  }

  return {
    ok: true,
    plan: assembleWeek(repairOrphanLeftovers(days, plan.weekStart), {
      weekStart: plan.weekStart,
      variant: plan.variant,
      usesHealthData: plan.usesHealthData,
      mealPrepPlanId: plan.mealPrepPlanId,
    }),
    affectedDates: batchDates,
    belowFloorDates,
  };
}

/** Eine angebotene Alternative (nur sichere – nicht angebotene werden ohne Grund weggelassen). */
export interface IngredientSwapOption {
  /** Ersatz; null = Original wiederherstellen. */
  readonly substituteFoodId: string | null;
  /** Lebensmittel, das danach verwendet wird. */
  readonly foodId: string;
  /** Hinweis aus der Austausch-Tabelle (null beim Zurücknehmen). */
  readonly noteDe: string | null;
  /** Plan nach dem Tausch (zum Speichern). */
  readonly plan: MealPlanWeek;
  /** Die getauschte Zutat am gewählten Tag (Menge in der Portion). */
  readonly ingredient: ScaledIngredient;
  /** Nährwerte der Mahlzeit am gewählten Tag nach dem Tausch (Anzeige nur bei „Kalorienzahlen anzeigen“). */
  readonly mealNutrients: RecipeNutrients;
  /**
   * Betroffene Tage (Kochtag und Reste), die vorher vollständig waren und danach unter der Untergrenze liegen
   * (`below_floor`) – Hinweis für ALLE diese Tage (Wächter N9 S2).
   */
  readonly belowFloorDates: readonly string[];
  /** Tage, an denen sich das Gericht ändert (Kochtag und Reste). */
  readonly affectedDates: readonly string[];
}

export type IngredientSwapOptions =
  | {
      readonly ok: true;
      /** Rolle der Zutat. */
      readonly role: IngredientRole;
      /** Lebensmittel der Rezept-Zutat. */
      readonly originalFoodId: string;
      /** Aktuell verwendetes Lebensmittel (Ersatz S4 oder Tausch). */
      readonly currentFoodId: string;
      /** true = die Zutat ist schon getauscht. */
      readonly swapped: boolean;
      /** Sichere Alternativen, nach Namen sortiert; das Zurücknehmen steht zuerst. */
      readonly options: readonly IngredientSwapOption[];
    }
  | { readonly ok: false; readonly reason: IngredientSwapFailure };

/**
 * Alternativen für eine Zutat einer geplanten Mahlzeit (Dialog „Austauschen“). Jede Alternative wird mit
 * `applyIngredientSwap` vollständig durchgerechnet; angeboten wird nur, was alle Regeln besteht. Gründe für nicht
 * angebotene Alternativen werden bewusst nicht genannt (kein Rückschluss auf Unverträglichkeit oder Schwangerschaft).
 */
export function ingredientSwapOptions(
  plan: MealPlanWeek,
  target: IngredientSwapTarget,
  input: PlanInput,
  context: IngredientSwapContext = {},
): IngredientSwapOptions {
  const located = locate(plan, target, input, context);
  if (typeof located === 'string') return { ok: false, reason: located };
  const { meal, recipe, role } = located;
  const ingredient = recipe.ingredients[target.index] as Recipe['ingredients'][number];
  const table = input.substitutions ?? [];
  const swap = (meal.ingredientSwaps ?? []).find((r) => r.index === target.index);
  const current = meal.ingredients.find((i) => i.index === target.index);
  const currentFoodId = current?.foodId ?? ingredient.food_id;

  const candidates: (string | null)[] = [
    ...(swap !== undefined ? [null] : []),
    ...[
      ...new Set(
        table
          .filter(
            (s) =>
              s.status !== 'archived' &&
              s.food_id === ingredient.food_id &&
              s.role === role &&
              s.substitute_food_id !== currentFoodId,
          )
          .map((s) => s.substitute_food_id),
      ),
    ].sort((a, b) => {
      const na = input.foods.get(a)?.name_de ?? a;
      const nb = input.foods.get(b)?.name_de ?? b;
      return na.localeCompare(nb, 'de') || (a < b ? -1 : a > b ? 1 : 0);
    }),
  ];

  const options: IngredientSwapOption[] = [];
  for (const candidate of candidates) {
    const result = applyIngredientSwap(plan, target, candidate, input, context);
    if (!result.ok) continue;
    const newMeal = result.plan.days
      .find((d) => d.date === target.date)
      ?.meals.find((m) => m.slot === target.slot && !m.isFill);
    const newIngredient = newMeal?.ingredients.find((i) => i.index === target.index);
    if (newMeal === undefined || newIngredient === undefined) continue;
    options.push({
      substituteFoodId: candidate,
      foodId: newIngredient.foodId,
      noteDe:
        candidate === null
          ? null
          : (substitutionFor(table, ingredient.food_id, candidate, role)?.note_de ?? null),
      plan: result.plan,
      ingredient: newIngredient,
      mealNutrients: newMeal.nutrients,
      affectedDates: result.affectedDates,
      belowFloorDates: result.belowFloorDates,
    });
  }
  // Sichere Voreinstellung bis zur Gründer-Entscheidung (Wächter N9 S2/S3): Alternativen, die einen vollständigen Tag
  // unter die Untergrenze drücken, werden ausgeblendet, solange es andere Alternativen gibt. Gibt es nur solche, werden
  // sie mit Hinweis für alle betroffenen Tage angezeigt. Das Zurücknehmen (Original) bleibt immer sichtbar.
  const keepsFloor = options.filter(
    (o) => o.substituteFoodId !== null && o.belowFloorDates.length === 0,
  );
  const shown =
    keepsFloor.length > 0
      ? options.filter((o) => o.substituteFoodId === null || o.belowFloorDates.length === 0)
      : options;
  return {
    ok: true,
    role,
    originalFoodId: ingredient.food_id,
    currentFoodId,
    swapped: swap !== undefined,
    options: shown,
  };
}

/**
 * Darf an dieser Zutat „Austauschen“ erscheinen? (Rolle, Tag ab heute, nicht vorgekocht, nicht weggelassen, kein
 * Ergänzungs-Snack.) Ob es tatsächlich sichere Alternativen gibt, sagt erst `ingredientSwapOptions`.
 */
export function ingredientSwapPossible(
  plan: MealPlanWeek,
  target: IngredientSwapTarget,
  input: PlanInput,
  context: IngredientSwapContext = {},
): boolean {
  return typeof locate(plan, target, input, context) !== 'string';
}

/**
 * Rezeptansicht einer geplanten Mahlzeit (8.2 Nr. 4): dasselbe Rezept durch den Filter der Person – MIT den
 * getauschten Zutaten der Mahlzeit (aus der Austausch-Tabelle aufgelöst). So stimmen „Enthält: …“ (Allergene),
 * Ernährungsform und Haltbarkeit mit dem überein, was tatsächlich gekocht wird. null = passt nicht (mehr).
 */
export function recipeVariantForMeal(
  recipe: Recipe,
  meal: Pick<PlannedMeal, 'ingredientSwaps'> & Partial<Pick<PlannedMeal, 'omittedOptional'>>,
  ctx: RecipeFilterContext,
  foods: FoodLookup,
  table: readonly IngredientSubstitution[],
): FilteredRecipe | null {
  const swaps = resolveIngredientSwaps(recipe, meal.ingredientSwaps ?? [], table, foods);
  if (swaps === null) return null;
  const result = filterRecipe(recipe, foods, ctx, swaps);
  // Wie bei der Mahlzeit zusätzlich weggelassene optionale Zutaten (Obergrenze, NB1; Wächter N9 K2).
  return result.ok
    ? withMealOmissions(result.value, { omittedOptional: meal.omittedOptional ?? [] }, foods)
    : null;
}
