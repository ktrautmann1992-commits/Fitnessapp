import {
  type CustomMeal,
  customMealSchema,
  type FoodLogEntry,
  foodLogEntrySchema,
  foodLogFavoriteSchema,
  type MealPlanItemPayload,
  type MealPlanPayload,
  type MealPlanRecord,
  type MealPlanWeek,
  mealPlanPayloadMatches,
  type NutritionContentFile,
  type NutritionLibrary,
  nutritionWeekRetained,
  parseMealPlanRecord,
  parseStoredMealPlanWeek,
  selectNutritionContent,
  shoppingListFromPayload,
  type StoredShoppingList,
  validateContent,
} from '@fitnessapp/core';

import type { ProtectedStore } from './protected-store';
import type {
  CustomMealItemRow,
  CustomMealRow,
  FoodLogEntryRow,
  FoodLogFavoriteRow,
  MealPlanRow,
  ShoppingListRow,
  UserRows,
} from './types';

/**
 * Ernährung im SUPABASE-MODUS (Etappe N7 Teil 2, docs/PLAN-PHASE-5.md „Umsetzungsstand N7 Teil 2“): Abbildung der
 * Datenbank-Zeilen auf die Zeilen der App, die Payload-Angaben des Essensplans, die verschlüsselte
 * Ernährungs-Warteschlange (Tagebuch und eigene Gerichte offline) und der geschützte Zwischenspeicher. Reine
 * Funktionen bzw. kleine Klassen, getestet in nutrition-supabase.test.ts. Fachregeln stehen in packages/core.
 *
 * Datenschutz: Essenspläne/Listen mit Gesundheitsbezug, Tagebuch-Einträge, eigene Gerichte und Schnell-Favoriten sind
 * (vorsorglich) Gesundheitsdaten – auf dem Gerät nur im geschützten Speicher (App verschlüsselt, Browser
 * sessionStorage), nie im normalen Zwischenspeicher, nie in Logs; Meldungen nennen nur die Art, nie Inhalte.
 */

// ---------------------------------------------------------------------------------------------------------
// Datenbank → App
// ---------------------------------------------------------------------------------------------------------

/** Spalten von meal_plans, die die App liest. */
export interface DbMealPlan {
  id: string;
  user_id: string;
  week_start: string;
  engine_version: number;
  variant: number;
  meal_prep_plan_id: string | null;
  inputs: unknown;
  uses_health_data: boolean;
  auto_adjusted: boolean;
  recipes_changed: boolean;
  cook_day_started_at: string | null;
  created_at: string;
}

/** Spalten von meal_plan_items (= Felder der Payload + plan_id). */
export type DbMealPlanItem = MealPlanItemPayload & { plan_id: string };

/** Vollständige Pläne aus dem geschützten Speicher (Woche → Plan), zum Abgleich mit den Zeilen. */
export type CachedFullPlans = ReadonlyMap<string, MealPlanWeek>;

/**
 * Essenspläne aus der Datenbank: je Woche die Zeilen als `record` (Wächter N7 H5: später erneut mit Zod geprüft) und –
 * nur wenn der geschützte Speicher den vollständigen Plan zu GENAU diesen Zeilen hat – der vollständige Plan. Wochen
 * außerhalb der Löschfrist werden nicht übernommen (der Server löscht sie, G-N7-2).
 */
export function mealPlanRowsFromDb(
  plans: readonly DbMealPlan[],
  items: readonly DbMealPlanItem[],
  cached: CachedFullPlans,
  today: string,
): MealPlanRow[] {
  return plans.flatMap((plan): MealPlanRow[] => {
    if (!nutritionWeekRetained(plan.week_start, today)) return [];
    const payload = {
      week_start: plan.week_start,
      engine_version: plan.engine_version,
      variant: plan.variant,
      meal_prep_plan_id: plan.meal_prep_plan_id,
      inputs: plan.inputs,
      items: items
        .filter((item) => item.plan_id === plan.id)
        .map(({ plan_id: _planId, ...item }) => item),
    };
    const record = parseMealPlanRecord({ usesHealthData: plan.uses_health_data, payload });
    if (record === null) return [];
    const full = cached.get(plan.week_start) ?? null;
    const matches =
      full !== null &&
      (full.usesHealthData === false || plan.uses_health_data) &&
      mealPlanPayloadMatches(full, record.payload);
    return [
      {
        id: plan.id,
        user_id: plan.user_id,
        week_start: plan.week_start,
        uses_health_data: plan.uses_health_data,
        created_at: plan.created_at,
        auto_adjusted: plan.auto_adjusted,
        recipes_changed: plan.recipes_changed,
        cook_day_started_at: plan.cook_day_started_at,
        plan: matches ? full : null,
        record,
      },
    ];
  });
}

/** Spalten von shopping_lists bzw. shopping_list_items, die die App liest. */
export interface DbShoppingList {
  id: string;
  user_id: string;
  week_start: string;
  from_date: string;
  to_date: string;
  plan_key: string;
  added_recipes: unknown;
  uses_health_data: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbShoppingListItem {
  list_id: string;
  item_key: string;
  food_id: string | null;
  label_de: string;
  amount: number | null;
  unit: string | null;
  category: string;
  is_pantry: boolean;
  is_manual: boolean;
  checked: boolean;
  substitute_for: string[];
  amount_changed: boolean;
  not_in_plan: boolean;
}

/** Einkaufslisten aus der Datenbank (Zod an der Grenze, `shoppingListFromPayload`); ungültige gelten als nicht vorhanden. */
export function shoppingListRowsFromDb(
  lists: readonly DbShoppingList[],
  items: readonly DbShoppingListItem[],
  today: string,
): ShoppingListRow[] {
  return lists.flatMap((list): ShoppingListRow[] => {
    if (!nutritionWeekRetained(list.week_start, today)) return [];
    const parsed = shoppingListFromPayload({
      week_start: list.week_start,
      from_date: list.from_date,
      to_date: list.to_date,
      uses_health_data: list.uses_health_data,
      plan_key: list.plan_key,
      recipes: list.added_recipes,
      items: items
        .filter((item) => item.list_id === list.id)
        .map(({ list_id: _listId, ...item }) => item),
    });
    if (parsed === null) return [];
    return [
      {
        id: list.id,
        user_id: list.user_id,
        week_start: list.week_start,
        uses_health_data: list.uses_health_data,
        created_at: list.created_at,
        updated_at: list.updated_at,
        list: parsed,
      },
    ];
  });
}

/** Tagebuch-Einträge aus der Datenbank – je Eintrag erneut geprüft (Zod, strikt); ungültige bleiben weg. */
export function foodLogRowsFromDb(rows: readonly Record<string, unknown>[]): FoodLogEntryRow[] {
  return rows.flatMap((row): FoodLogEntryRow[] => {
    const {
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...fields
    } = row;
    const parsed = foodLogEntrySchema.safeParse(fields);
    if (
      !parsed.success ||
      typeof userId !== 'string' ||
      typeof revision !== 'number' ||
      typeof lastWriteId !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      return [];
    }
    return [
      {
        ...parsed.data,
        user_id: userId,
        revision,
        last_write_id: lastWriteId,
        created_at: createdAt,
        updated_at: updatedAt,
      },
    ];
  });
}

/** Favoriten aus der Datenbank – erneut geprüft (Zod). */
export function foodLogFavoriteRowsFromDb(
  rows: readonly Record<string, unknown>[],
): FoodLogFavoriteRow[] {
  return rows.flatMap((row): FoodLogFavoriteRow[] => {
    const { user_id: userId, created_at: createdAt, ...fields } = row;
    const parsed = foodLogFavoriteSchema.safeParse(fields);
    if (!parsed.success || typeof userId !== 'string' || typeof createdAt !== 'string') return [];
    return [{ ...parsed.data, user_id: userId, created_at: createdAt }];
  });
}

/** Eigene Gerichte samt Zutaten aus der Datenbank – je Gericht erneut geprüft (`customMealSchema`). */
export function customMealRowsFromDb(
  meals: readonly Record<string, unknown>[],
  items: readonly Record<string, unknown>[],
): Pick<UserRows, 'customMeals' | 'customMealItems'> {
  const customMeals: CustomMealRow[] = [];
  const customMealItems: CustomMealItemRow[] = [];
  for (const meal of meals) {
    const {
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...fields
    } = meal;
    const own = items
      .filter((item) => item.meal_id === fields.id)
      .sort((a, b) => Number(a.order_no) - Number(b.order_no));
    const parsed = customMealSchema.safeParse({
      ...fields,
      items: own.map((item) => ({ food_id: item.food_id, amount: item.amount, unit: item.unit })),
    });
    if (
      !parsed.success ||
      typeof userId !== 'string' ||
      typeof revision !== 'number' ||
      typeof lastWriteId !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      continue;
    }
    const { items: mealItems, ...rest } = parsed.data;
    customMeals.push({
      ...rest,
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    mealItems.forEach((item, index) =>
      customMealItems.push({ ...item, meal_id: rest.id, user_id: userId, order_no: index + 1 }),
    );
  }
  return { customMeals, customMealItems };
}

// ---------------------------------------------------------------------------------------------------------
// Bestand aus der Datenbank (Vorschlag N7 Teil 2 Nr. 3)
// ---------------------------------------------------------------------------------------------------------

/** Inhaltszeile einer Ernährungs-Tabelle: `data` = Inhaltsdatei unverändert (bis auf die Prüfer-Namen, H8). */
export interface DbContentRow {
  id: string;
  data: unknown;
}

/** Ernährungs-Tabellen der Datenbank → Inhaltsart der Dateien. */
export const NUTRITION_CONTENT_TABLES = {
  foods: 'food',
  recipes: 'recipe',
  ingredient_substitutions: 'ingredient_substitution',
  food_package_sizes: 'package_size',
  meal_prep_plans: 'meal_prep_plan',
  guides: 'guide',
} as const satisfies Record<string, NutritionContentFile['kind']>;

export type DbNutritionContent = Record<
  keyof typeof NUTRITION_CONTENT_TABLES,
  readonly DbContentRow[]
>;

/**
 * Bestand aus der Datenbank: `data` → `validateContent` → `selectNutritionContent({ allowDrafts: false })` – dieselben
 * Zod-Schemas und Prüfregeln wie im Repository (der Server liefert nur `published`, RLS). Quellauszug (R17) und
 * Erwartungsliste (R18) hat `content-seed` vor dem Einspielen geprüft (`checkedAtSeed`). Archivierte Inhalte sind für
 * Nutzer nicht lesbar (Wächter N7 H9) – sie fehlen hier einfach.
 */
export function nutritionLibraryFromDb(content: DbNutritionContent): NutritionLibrary {
  const files: NutritionContentFile[] = (
    Object.keys(NUTRITION_CONTENT_TABLES) as (keyof typeof NUTRITION_CONTENT_TABLES)[]
  ).flatMap((table) =>
    content[table].map((row) => ({
      kind: NUTRITION_CONTENT_TABLES[table],
      fileName: `${row.id}.json`,
      data: row.data,
    })),
  );
  return selectNutritionContent(
    validateContent(files, { nutritionCatalog: { checkedAtSeed: true } }),
    { allowDrafts: false },
  );
}

// ---------------------------------------------------------------------------------------------------------
// Essensplan → Payload
// ---------------------------------------------------------------------------------------------------------

/**
 * Angaben des Essensplans für `save_meal_plan` (`inputs`, OHNE Gesundheitsdaten, K8) aus den Ernährungsangaben; null =
 * Ernährungsform fehlt (dann gibt es auch keinen Plan).
 */
export function mealPlanPayloadInputs(rows: UserRows): MealPlanPayload['inputs'] | null {
  const prefs = rows.nutritionPrefs;
  if (prefs === null) return null;
  const mealPrep = prefs.cooking_mode === 'meal_prep' && prefs.mealprep_days !== null;
  return {
    diet: prefs.diet_type,
    meals_per_day: prefs.meals_per_day ?? 3,
    cooking_mode: mealPrep ? 'meal_prep' : 'daily',
    mealprep_days: mealPrep ? prefs.mealprep_days : null,
    mealprep_slots: rows.nutritionSetup?.mealprep_slots ?? 'lunch',
  };
}

/**
 * Wächter N7 H9: Mahlzeiten VERGANGENER Tage, deren Rezept archiviert ist, kann die App nicht lesen und deshalb nicht im
 * Plan halten. Beim Speichern werden sie aus den bisherigen Zeilen unverändert wieder angehängt (der Server lässt
 * vergangene Tage, wie sie waren – Rezept existiert, Version höchstens die aktuelle), damit „vergangene Tage bleiben“
 * auch für sie gilt. Nur Plätze, die der neue Plan an diesem Tag nicht belegt.
 */
export function withPreservedPastItems(
  payload: MealPlanPayload,
  record: MealPlanRecord | undefined,
  today: string,
): MealPlanPayload {
  if (record === undefined || record.payload.week_start !== payload.week_start) return payload;
  const taken = new Set(payload.items.map((item) => `${item.date}|${item.slot}`));
  const daysInPayload = new Set(payload.items.map((item) => item.date));
  const preserved = record.payload.items.filter(
    (item) =>
      item.date < today &&
      !taken.has(`${item.date}|${item.slot}`) &&
      // Gehört der Tag im neuen Plan schon jemandem mit anderem Status, nichts mischen (Tages-Status je Tag einheitlich).
      (!daysInPayload.has(item.date) ||
        payload.items.some((p) => p.date === item.date && p.day_status === item.day_status)),
  );
  return preserved.length === 0 ? payload : { ...payload, items: [...payload.items, ...preserved] };
}

/** Sind zwischen zwei Fassungen derselben Liste NUR Häkchen anders? Dann reicht das Abhaken (auch offline). */
export function checkedOnlyChanges(
  before: StoredShoppingList,
  next: StoredShoppingList,
): { itemKey: string; checked: boolean }[] | null {
  const { items: beforeItems, ...beforeRest } = before;
  const { items: nextItems, ...nextRest } = next;
  if (JSON.stringify(sortKeys(beforeRest)) !== JSON.stringify(sortKeys(nextRest))) return null;
  if (beforeItems.length !== nextItems.length) return null;
  const changes: { itemKey: string; checked: boolean }[] = [];
  for (const item of nextItems) {
    const old = beforeItems.find((x) => x.itemKey === item.itemKey);
    if (old === undefined) return null;
    const { checked, ...rest } = item;
    const { checked: oldChecked, ...oldRest } = old;
    if (JSON.stringify(sortKeys(rest)) !== JSON.stringify(sortKeys(oldRest))) return null;
    if (checked !== oldChecked) changes.push({ itemKey: item.itemKey, checked });
  }
  return changes;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => [k, sortKeys(v)]),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Geschützter Zwischenspeicher der Ernährungs-Zeilen
// ---------------------------------------------------------------------------------------------------------

export const NUTRITION_ROW_KEYS = [
  'mealPlans',
  'shoppingLists',
  'foodLogEntries',
  'foodLogFavorites',
  'customMeals',
  'customMealItems',
] as const satisfies readonly (keyof UserRows)[];

export type NutritionRows = Pick<UserRows, (typeof NUTRITION_ROW_KEYS)[number]>;

export function nutritionRowsOf(rows: UserRows): NutritionRows {
  return {
    mealPlans: rows.mealPlans,
    shoppingLists: rows.shoppingLists,
    foodLogEntries: rows.foodLogEntries,
    foodLogFavorites: rows.foodLogFavorites,
    customMeals: rows.customMeals,
    customMealItems: rows.customMealItems,
  };
}

export const EMPTY_NUTRITION_ROWS: NutritionRows = {
  mealPlans: [],
  shoppingLists: [],
  foodLogEntries: [],
  foodLogFavorites: [],
  customMeals: [],
  customMealItems: [],
};

interface NutritionCache {
  userId: string;
  savedAt: string;
  rows: NutritionRows;
}

/** Vollständige Pläne je Woche aus Zeilen (nur gültige, Zod). */
export function fullPlansOf(rows: Pick<UserRows, 'mealPlans'>): Map<string, MealPlanWeek> {
  const out = new Map<string, MealPlanWeek>();
  for (const row of rows.mealPlans) {
    const plan = row.plan === null ? null : parseStoredMealPlanWeek(row.plan);
    if (plan !== null) out.set(row.week_start, plan);
  }
  return out;
}

/** Schreibt die Ernährungs-Zeilen in den geschützten Speicher (nie in den normalen Zwischenspeicher). */
export async function writeNutritionCache(
  store: ProtectedStore,
  userId: string,
  rows: NutritionRows,
  now: string,
): Promise<void> {
  await store.write(JSON.stringify({ userId, savedAt: now, rows } satisfies NutritionCache));
}

/** Liest die Ernährungs-Zeilen; älter als `maxAgeDays` oder anderes Konto → leer (und gelöscht bei Alter). */
export async function readNutritionCache(
  store: ProtectedStore,
  userId: string,
  now: string,
  maxAgeDays: number,
): Promise<NutritionRows | null> {
  const raw = await store.read();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NutritionCache;
    const age = Date.parse(now) - Date.parse(parsed.savedAt);
    if (!(age <= maxAgeDays * 24 * 60 * 60 * 1000)) {
      await store.clear();
      return null;
    }
    if (parsed.userId !== userId || typeof parsed.rows !== 'object' || parsed.rows === null) {
      return null;
    }
    return { ...EMPTY_NUTRITION_ROWS, ...parsed.rows };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Ernährungs-Warteschlange (Tagebuch und eigene Gerichte offline, E1/E2 „mit N7 Teil 2“)
// ---------------------------------------------------------------------------------------------------------

/** Ein wartender Vorgang. `baseRevision` = zuletzt vom Server bestätigte Fassung (null = neu). */
export type NutritionQueueOp =
  | { kind: 'food_log_save'; entry: FoodLogEntry; writeId: string; baseRevision: number | null }
  | { kind: 'food_log_delete'; id: string; baseRevision: number }
  | { kind: 'custom_meal_save'; meal: CustomMeal; writeId: string; baseRevision: number | null }
  | { kind: 'custom_meal_delete'; id: string };

export interface NutritionQueueEntry {
  key: string;
  op: NutritionQueueOp;
  /** Fehlversuche mit vorübergehendem Fehler (nach `NUTRITION_QUEUE_MAX_ATTEMPTS` → abgelehnt, nie verworfen). */
  attempts?: number;
}

/** Warum ein Vorgang nicht gespeichert wurde (ohne Werte). */
export type NutritionRejectReason =
  | 'consent_required'
  | 'conflict'
  | 'out_of_range'
  | 'day_full'
  | 'limit'
  | 'invalid'
  | 'not_transferred';

/** Abgelehnte Fassung – bleibt lokal (Gründer-Frage G3 aus E1: „lokal behalten mit Hinweis“, nie still verwerfen). */
export interface RejectedNutritionWrite {
  key: string;
  op: NutritionQueueOp;
  reason: NutritionRejectReason;
}

export const NUTRITION_QUEUE_MAX_ATTEMPTS = 5;

export function nutritionQueueKey(op: NutritionQueueOp): string {
  return op.kind === 'food_log_save' || op.kind === 'food_log_delete'
    ? `food_log:${op.kind === 'food_log_save' ? op.entry.id : op.id}`
    : `custom_meal:${op.kind === 'custom_meal_save' ? op.meal.id : op.id}`;
}

/**
 * Vorgang einreihen (rein): Eine neuere Fassung desselben Eintrags ersetzt die ältere und übernimmt deren
 * `baseRevision` (der Server kennt nur die bestätigte Fassung). Löschen eines nie gesendeten neuen Eintrags entfernt
 * beide (es gibt nichts zu löschen).
 */
export function enqueueNutritionOp(
  entries: readonly NutritionQueueEntry[],
  op: NutritionQueueOp,
): NutritionQueueEntry[] {
  const key = nutritionQueueKey(op);
  const previous = entries.filter((e) => e.key === key);
  const others = entries.filter((e) => e.key !== key);
  const lastSave = [...previous]
    .reverse()
    .find((e) => e.op.kind === 'food_log_save' || e.op.kind === 'custom_meal_save');
  const hadDelete = previous.some(
    (e) => e.op.kind === 'food_log_delete' || e.op.kind === 'custom_meal_delete',
  );
  const inheritedBase = (fallback: number | null): number | null =>
    lastSave && (lastSave.op.kind === 'food_log_save' || lastSave.op.kind === 'custom_meal_save')
      ? lastSave.op.baseRevision
      : fallback;
  switch (op.kind) {
    case 'food_log_save':
    case 'custom_meal_save': {
      const keepDelete = hadDelete ? previous.filter((e) => e.op.kind.endsWith('_delete')) : [];
      const base = hadDelete ? null : inheritedBase(op.baseRevision);
      return [...others, ...keepDelete, { key, op: { ...op, baseRevision: base } }];
    }
    case 'food_log_delete': {
      if (
        lastSave?.op.kind === 'food_log_save' &&
        lastSave.op.baseRevision === null &&
        !hadDelete
      ) {
        return others;
      }
      const base =
        lastSave?.op.kind === 'food_log_save' && lastSave.op.baseRevision !== null
          ? lastSave.op.baseRevision
          : op.baseRevision;
      return [...others, { key, op: { ...op, baseRevision: base } }];
    }
    case 'custom_meal_delete': {
      if (
        lastSave?.op.kind === 'custom_meal_save' &&
        lastSave.op.baseRevision === null &&
        !hadDelete
      ) {
        return others;
      }
      return [...others, { key, op }];
    }
  }
}

/**
 * Wartende Vorgänge über den Server-Stand legen (nur Anzeige): gespeicherte Fassungen ersetzen bzw. ergänzen, gelöschte
 * entfernen. Revision = die bestätigte Basis (0 = neu), damit eine weitere Änderung dieselbe Basis sendet.
 */
export function applyNutritionQueue(
  rows: UserRows,
  entries: readonly NutritionQueueEntry[],
  ctx: { userId: string; now: string },
): UserRows {
  let next = rows;
  for (const { op } of entries) {
    switch (op.kind) {
      case 'food_log_save': {
        const existing = next.foodLogEntries.find((e) => e.id === op.entry.id);
        const row: FoodLogEntryRow = {
          ...op.entry,
          user_id: ctx.userId,
          revision: op.baseRevision ?? 0,
          last_write_id: op.writeId,
          created_at: existing?.created_at ?? ctx.now,
          updated_at: ctx.now,
        };
        next = {
          ...next,
          foodLogEntries: [...next.foodLogEntries.filter((e) => e.id !== op.entry.id), row],
        };
        break;
      }
      case 'food_log_delete':
        next = { ...next, foodLogEntries: next.foodLogEntries.filter((e) => e.id !== op.id) };
        break;
      case 'custom_meal_save': {
        const existing = next.customMeals.find((m) => m.id === op.meal.id);
        const { items, ...fields } = op.meal;
        next = {
          ...next,
          customMeals: [
            ...next.customMeals.filter((m) => m.id !== op.meal.id),
            {
              ...fields,
              user_id: ctx.userId,
              revision: op.baseRevision ?? 0,
              last_write_id: op.writeId,
              created_at: existing?.created_at ?? ctx.now,
              updated_at: ctx.now,
            },
          ],
          customMealItems: [
            ...next.customMealItems.filter((i) => i.meal_id !== op.meal.id),
            ...items.map((item, index) => ({
              ...item,
              meal_id: op.meal.id,
              user_id: ctx.userId,
              order_no: index + 1,
            })),
          ],
        };
        break;
      }
      case 'custom_meal_delete':
        next = {
          ...next,
          customMeals: next.customMeals.filter((m) => m.id !== op.id),
          customMealItems: next.customMealItems.filter((i) => i.meal_id !== op.id),
          foodLogEntries: next.foodLogEntries.map((e) =>
            e.custom_meal_id === op.id ? { ...e, custom_meal_id: null } : e,
          ),
        };
        break;
    }
  }
  return next;
}

/** Ergebnis eines gesendeten Vorgangs. */
export type NutritionSendResult =
  | { kind: 'done' }
  /** Netz, Sitzung, Server vorübergehend – später erneut (alle Vorgänge). */
  | { kind: 'retry' }
  /** Vorübergehend, evtl. nur dieser Vorgang – Fehlversuch zählen. */
  | { kind: 'transient' }
  | { kind: 'rejected'; reason: NutritionRejectReason };

interface StoredNutritionQueue {
  format: 1;
  ownerUserId: string | null;
  entries: NutritionQueueEntry[];
  rejected: RejectedNutritionWrite[];
}

/** Verschlüsselte Ernährungs-Warteschlange (Konto-gebunden wie die Tagebuch-Warteschlange, R5). */
export class NutritionQueue {
  private state: StoredNutritionQueue = {
    format: 1,
    ownerUserId: null,
    entries: [],
    rejected: [],
  };
  private loaded = false;
  private flushing: Promise<'done' | 'later'> | null = null;
  /** Ergebnisse der letzten Sendevorgänge je Schlüssel (für die sofortige Rückmeldung an den Bildschirm). */
  readonly lastResults = new Map<string, NutritionSendResult>();

  constructor(
    private readonly options: {
      store: ProtectedStore;
      send: (op: NutritionQueueOp) => Promise<NutritionSendResult>;
      currentUserId: () => string | null;
    },
  ) {}

  get storeKind(): ProtectedStore['kind'] {
    return this.options.store.kind;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const raw = await this.options.store.read();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as StoredNutritionQueue;
      if (parsed.format === 1 && Array.isArray(parsed.entries) && Array.isArray(parsed.rejected)) {
        this.state = parsed;
      }
    } catch {
      // Unlesbar = leer (der geschützte Speicher löscht beschädigte Daten selbst).
    }
  }

  snapshot(): readonly NutritionQueueEntry[] {
    return this.state.entries;
  }

  rejected(): readonly RejectedNutritionWrite[] {
    return this.state.rejected;
  }

  ownerUserId(): string | null {
    return this.state.ownerUserId;
  }

  size(): number {
    return this.state.entries.length;
  }

  private async persist(): Promise<void> {
    await this.options.store.write(JSON.stringify(this.state));
  }

  /** Einreihen; wirft, wenn der geschützte Speicher nicht beschreibbar ist bzw. ein anderes Konto wartet. */
  async add(op: NutritionQueueOp, userId: string): Promise<void> {
    await this.load();
    if (
      this.state.ownerUserId !== null &&
      this.state.ownerUserId !== userId &&
      (this.state.entries.length > 0 || this.state.rejected.length > 0)
    ) {
      throw new ForeignNutritionQueueError();
    }
    const before = this.state;
    this.state = {
      ...this.state,
      ownerUserId: userId,
      entries: enqueueNutritionOp(this.state.entries, op),
    };
    try {
      await this.persist();
    } catch (error) {
      this.state = before;
      throw error;
    }
  }

  /** Senden der Reihe nach; stoppt bei Netz-/Sitzungsfehlern. 'later' = es wartet noch etwas. */
  flush(): Promise<'done' | 'later'> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushNow().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async flushNow(): Promise<'done' | 'later'> {
    await this.load();
    const owner = this.options.currentUserId();
    if (owner === null || (this.state.ownerUserId !== null && this.state.ownerUserId !== owner)) {
      return this.state.entries.length === 0 ? 'done' : 'later';
    }
    for (const entry of [...this.state.entries]) {
      // Inzwischen ersetzt (neuere Fassung desselben Eintrags)? Dann die neue senden.
      const current = this.state.entries.find((e) => e.key === entry.key && e.op === entry.op);
      if (current === undefined) continue;
      let result: NutritionSendResult;
      try {
        result = await this.options.send(current.op);
      } catch {
        result = { kind: 'transient' };
      }
      this.lastResults.set(current.key, result);
      if (result.kind === 'retry') return 'later';
      if (result.kind === 'transient') {
        const attempts = (current.attempts ?? 0) + 1;
        if (attempts < NUTRITION_QUEUE_MAX_ATTEMPTS) {
          this.state = {
            ...this.state,
            entries: this.state.entries.map((e) => (e === current ? { ...e, attempts } : e)),
          };
          await this.persist().catch(() => undefined);
          continue;
        }
        result = { kind: 'rejected', reason: 'not_transferred' };
        this.lastResults.set(current.key, result);
      }
      this.state = {
        ...this.state,
        entries: this.state.entries.filter((e) => e !== current),
        rejected:
          result.kind === 'rejected'
            ? [
                ...this.state.rejected.filter((r) => r.key !== current.key),
                { key: current.key, op: current.op, reason: result.reason },
              ]
            : this.state.rejected,
      };
      await this.persist().catch(() => undefined);
    }
    return this.state.entries.length === 0 ? 'done' : 'later';
  }

  /** Abgelehnte Fassung(en) verwerfen – nur auf ausdrücklichen Wunsch der Person. */
  async discardRejected(key?: string): Promise<void> {
    await this.load();
    this.state = {
      ...this.state,
      rejected: key === undefined ? [] : this.state.rejected.filter((r) => r.key !== key),
    };
    await this.persist();
  }

  /** Eine abgelehnte Fassung, die gerade beim Speichern abgelehnt wurde (sofortige Meldung statt Hinweis). */
  async takeRejected(key: string): Promise<RejectedNutritionWrite | null> {
    await this.load();
    const found = this.state.rejected.find((r) => r.key === key) ?? null;
    if (found !== null) {
      this.state = { ...this.state, rejected: this.state.rejected.filter((r) => r !== found) };
      await this.persist().catch(() => undefined);
    }
    return found;
  }

  async clear(): Promise<void> {
    this.state = { format: 1, ownerUserId: null, entries: [], rejected: [] };
    this.loaded = true;
    await this.options.store.clear();
  }

  async hasForeign(userId: string): Promise<boolean> {
    await this.load();
    return (
      this.state.ownerUserId !== null &&
      this.state.ownerUserId !== userId &&
      (this.state.entries.length > 0 || this.state.rejected.length > 0)
    );
  }
}

/** Auf dem Gerät warten Ernährungs-Einträge eines anderen Kontos (R5). */
export class ForeignNutritionQueueError extends Error {
  constructor() {
    super('ForeignNutritionQueue');
    this.name = 'ForeignNutritionQueueError';
  }
}
