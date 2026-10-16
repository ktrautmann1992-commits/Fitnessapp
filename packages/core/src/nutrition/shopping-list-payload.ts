import { z } from 'zod';

import { isoDateSchema } from '../age';
import { RECIPE_SERVINGS_PICKER, SHOPPING_LIST_EXTRAS, SHOPPING_LIST_ROUNDING } from '../constants';
import { SHOPPING_CATEGORIES } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import { DIET_TYPES } from '../enums';
import { weekStartSchema } from './schemas';
import { sortShoppingItems } from './shopping-list';
import {
  parseStoredShoppingList,
  shoppingListRangeValid,
  type StoredShoppingList,
} from './shopping-list-store';

/**
 * Payload einer Einkaufsliste für `replace_shopping_list` (docs/PLAN-PHASE-5.md 6.5, 7.2, 7.3; Datenbank seit Etappe
 * N7). Spaltennamen wie `shopping_lists`/`shopping_list_items`; nur bekannte Felder (strikt) – die Feldlisten gleicht
 * db-sync.test.ts mit der Funktion ab.
 *
 * `uses_health_data` ist nur die Angabe der App: Der Server nimmt sie in der SICHEREN Richtung (ODER) und ergänzt den
 * Gesundheitsbezug selbst (Plan der Woche, zusätzliche Rezepte mit Unverträglichkeiten bzw. Gesundheitsangaben,
 * Ersatzprodukte mit Einwilligung, 7.1/K10). Ohne gültige Einwilligung lehnt er eine Liste mit Gesundheitsbezug ab.
 * Die Häkchen übernimmt die App vor dem Senden über `item_key` (`mergeShoppingList`); der Server ersetzt die Liste.
 */

const R = SHOPPING_LIST_ROUNDING;

export const shoppingListItemPayloadSchema = z
  .strictObject({
    item_key: z.string().min(1).max(200),
    food_id: contentIdSchema.nullable(),
    label_de: z.string().min(1).max(200),
    amount: z.number().finite().min(0).max(1_000_000).nullable(),
    unit: z.enum(['g', 'ml', 'piece']).nullable(),
    category: z.enum(SHOPPING_CATEGORIES),
    is_pantry: z.boolean(),
    is_manual: z.boolean(),
    checked: z.boolean(),
    substitute_for: z.array(contentIdSchema).max(50),
    amount_changed: z.boolean(),
    not_in_plan: z.boolean(),
  })
  .refine((item) => item.is_manual === item.item_key.startsWith('manual|'), {
    path: ['item_key'],
    message: 'Falscher Schlüssel.',
  })
  .refine((item) => !item.is_manual || item.label_de.length <= R.manualLabelMaxChars, {
    path: ['label_de'],
    message: 'Eintrag zu lang.',
  });
export type ShoppingListItemPayload = z.infer<typeof shoppingListItemPayloadSchema>;

export const shoppingListRecipePayloadSchema = z.strictObject({
  recipe_id: contentIdSchema,
  servings: z.number().int().min(RECIPE_SERVINGS_PICKER.min).max(RECIPE_SERVINGS_PICKER.max),
  /** Erweiterte Ernährungsform aus der Rezeptsuche (19.6 K3) – sonst null. */
  diet: z.enum(DIET_TYPES).nullable(),
});
export type ShoppingListRecipePayload = z.infer<typeof shoppingListRecipePayloadSchema>;

export const shoppingListPayloadSchema = z
  .strictObject({
    week_start: weekStartSchema,
    from_date: isoDateSchema,
    to_date: isoDateSchema,
    uses_health_data: z.boolean(),
    plan_key: z.string().min(1).max(100),
    recipes: z.array(shoppingListRecipePayloadSchema).max(SHOPPING_LIST_EXTRAS.recipesMax),
    items: z.array(shoppingListItemPayloadSchema).max(SHOPPING_LIST_EXTRAS.itemsMax),
  })
  .superRefine((list, ctx) => {
    if (!shoppingListRangeValid(list.week_start, { from: list.from_date, to: list.to_date })) {
      ctx.addIssue({
        code: 'custom',
        path: ['from_date'],
        message: 'Zeitraum außerhalb der Woche.',
      });
    }
    const keys = new Set(list.items.map((item) => item.item_key));
    if (keys.size !== list.items.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Doppelter Eintrag.' });
    }
    if (list.items.filter((item) => item.is_manual).length > R.manualItemsMax) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Zu viele eigene Einträge.' });
    }
    if (new Set(list.recipes.map((r) => r.recipe_id)).size !== list.recipes.length) {
      ctx.addIssue({ code: 'custom', path: ['recipes'], message: 'Doppeltes Rezept.' });
    }
  });
export type ShoppingListPayload = z.infer<typeof shoppingListPayloadSchema>;

/** Gespeicherte Liste (packages/core, camelCase) → Payload für `replace_shopping_list` (geprüft). */
export function toShoppingListPayload(list: StoredShoppingList): ShoppingListPayload {
  return shoppingListPayloadSchema.parse({
    week_start: list.weekStart,
    from_date: list.from,
    to_date: list.to,
    uses_health_data: list.usesHealthData,
    plan_key: list.planKey,
    recipes: list.recipes.map((r) => ({
      recipe_id: r.recipeId,
      servings: r.servings,
      diet: r.diet ?? null,
    })),
    items: list.items.map((item) => ({
      item_key: item.itemKey,
      food_id: item.foodId,
      label_de: item.labelDe,
      amount: item.amount,
      unit: item.unit,
      category: item.category,
      is_pantry: item.isPantry,
      is_manual: item.isManual,
      checked: item.checked,
      substitute_for: [...item.substituteFor],
      amount_changed: item.amountChanged,
      not_in_plan: item.notInPlan,
    })),
  });
}

/**
 * Liste aus der Datenbank (`shopping_lists`/`shopping_list_items`, Etappe N7 Teil 2) → gespeicherte Liste der App. Die
 * Zeilen werden erneut geprüft (Payload-Schema und `parseStoredShoppingList`, Wächter N7 H5); `uses_health_data` ist der
 * Wert des Servers. Reihenfolge der Einträge wie beim Erzeugen (`sortShoppingItems`). null = ungültig → gilt als nicht
 * vorhanden (die Plan-Einträge werden ohnehin aus dem aktuellen Plan neu erzeugt).
 */
export function shoppingListFromPayload(value: unknown): StoredShoppingList | null {
  const parsed = shoppingListPayloadSchema.safeParse(value);
  if (!parsed.success) return null;
  const list = parsed.data;
  return parseStoredShoppingList({
    weekStart: list.week_start,
    from: list.from_date,
    to: list.to_date,
    usesHealthData: list.uses_health_data,
    planKey: list.plan_key,
    recipes: list.recipes.map((r) => ({
      recipeId: r.recipe_id,
      servings: r.servings,
      ...(r.diet === null ? {} : { diet: r.diet }),
    })),
    items: sortShoppingItems(
      list.items.map((item) => ({
        itemKey: item.item_key,
        foodId: item.food_id,
        labelDe: item.label_de,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        isPantry: item.is_pantry,
        isManual: item.is_manual,
        checked: item.checked,
        substituteFor: [...item.substitute_for],
        amountChanged: item.amount_changed,
        notInPlan: item.not_in_plan,
      })),
    ),
  });
}
