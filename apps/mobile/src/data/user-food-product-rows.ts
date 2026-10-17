import {
  checkUserFoodProduct,
  type FoodLogEntry,
  USER_FOOD_PRODUCT_LIMITS,
  type UserFoodProduct,
  userFoodProductSchema,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { FoodLogEntryRow, UserFoodProductRow, UserRows } from './types';

/**
 * Eigene Produkte im TESTMODUS (Etappe E4a, docs/PLAN-E4.md 2.3/3.4) – dieselben Regeln wie save_user_food_product
 * bzw. delete_user_food_product in der Datenbank, soweit sie ohne Datenbank gelten (auch Vorab-Prüfung im
 * Supabase-Modus): nur mit gültiger Einwilligung health_data, Form und Grenzen wie die CHECKs (Zod, strikt,
 * `userFoodProductSchema`), höchstens 200, unmögliche Werte (Prüfstufe „blocked“) nicht speicherbar. Löschen geht
 * immer; Tagebuch-Einträge behalten ihren Schnappschuss (Verweis leer), Produkt-Favoriten gehen mit (Kaskade).
 * Rein und getestet. Name und Marke sind Freitext – nie in Meldungen, Logs oder testIDs.
 */

export type UserFoodProductSaveCheck =
  | { ok: true; product: UserFoodProduct }
  | { ok: false; reason: 'consent_required' | 'invalid' | 'limit' };

export function checkUserFoodProductSave(
  rows: Pick<UserRows, 'consents' | 'profile' | 'userFoodProducts'>,
  product: unknown,
  ctx: { versions: ConsentVersions },
): UserFoodProductSaveCheck {
  if (healthConsentStatus(rows as UserRows, ctx.versions) !== 'valid') {
    return { ok: false, reason: 'consent_required' };
  }
  const parsed = userFoodProductSchema.safeParse(product);
  if (!parsed.success || checkUserFoodProduct(parsed.data).level === 'blocked') {
    return { ok: false, reason: 'invalid' };
  }
  const isNew = !rows.userFoodProducts.some((p) => p.id === parsed.data.id);
  if (isNew && rows.userFoodProducts.length >= USER_FOOD_PRODUCT_LIMITS.maxProducts) {
    return { ok: false, reason: 'limit' };
  }
  return { ok: true, product: parsed.data };
}

/** Übernehmen: neu mit revision 1, vorhanden ganz ersetzt (revision + 1, created_at bleibt). */
export function applyUserFoodProductSave(
  rows: UserRows,
  product: UserFoodProduct,
  ctx: { userId: string; now: string; newId: () => string },
): UserRows {
  const existing = rows.userFoodProducts.find((p) => p.id === product.id);
  const row: UserFoodProductRow = {
    ...product,
    user_id: ctx.userId,
    revision: existing ? existing.revision + 1 : 1,
    last_write_id: ctx.newId(),
    created_at: existing?.created_at ?? ctx.now,
    updated_at: ctx.now,
  };
  return {
    ...rows,
    userFoodProducts: [...rows.userFoodProducts.filter((p) => p.id !== product.id), row],
  };
}

/** Löschen (geht immer): Einträge behalten den Schnappschuss (Verweis leer), Favoriten des Produkts gehen mit. */
export function applyUserFoodProductDelete(rows: UserRows, id: string): UserRows {
  return {
    ...rows,
    userFoodProducts: rows.userFoodProducts.filter((p) => p.id !== id),
    foodLogEntries: rows.foodLogEntries.map((e) =>
      e.user_product_id === id ? { ...e, user_product_id: null } : e,
    ),
    foodLogFavorites: rows.foodLogFavorites.filter((f) => f.user_product_id !== id),
  };
}

/** Zeilen → eigene Produkte (ohne Server-Felder), zuletzt geändert zuerst. */
export function userFoodProductsFromRows(
  rows: Pick<UserRows, 'userFoodProducts'>,
): UserFoodProductRow[] {
  return [...rows.userFoodProducts].sort(
    (a, b) => b.updated_at.localeCompare(a.updated_at) || a.name_de.localeCompare(b.name_de, 'de'),
  );
}

/** Zeile → Produkt (ohne Server-Felder), z. B. zum Ändern. */
export function userFoodProductFromRow(row: UserFoodProductRow): UserFoodProduct {
  return {
    id: row.id,
    name_de: row.name_de,
    brand_de: row.brand_de,
    code: row.code,
    base_unit: row.base_unit,
    kcal: row.kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    sugar_g: row.sugar_g,
    salt_g: row.salt_g,
    serving_g: row.serving_g,
    based_on_off: row.based_on_off,
  };
}

/**
 * Zeilen aus dem Gerätespeicher bzw. der Datenbank – nicht vertrauenswürdig: nur gültige Produkte (Zod, strikt) des
 * eigenen Kontos, höchstens 200, keine doppelten ids. Verweise im Tagebuch auf verworfene Produkte werden leer.
 */
export function userFoodProductRowsFrom(
  list: unknown,
  owner: string | undefined,
): UserFoodProductRow[] {
  const out: UserFoodProductRow[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(list) ? list : []) {
    if (out.length >= USER_FOOD_PRODUCT_LIMITS.maxProducts) break;
    if (typeof item !== 'object' || item === null) continue;
    const {
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...rest
    } = item as Record<string, unknown>;
    const parsed = userFoodProductSchema.safeParse(rest);
    if (
      !parsed.success ||
      typeof userId !== 'string' ||
      (owner !== undefined && userId !== owner) ||
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      typeof lastWriteId !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string' ||
      seen.has(parsed.data.id)
    ) {
      continue;
    }
    seen.add(parsed.data.id);
    out.push({
      ...parsed.data,
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }
  return out;
}

/** Verweise auf nicht (mehr) vorhandene eigene Produkte leeren (Einträge) bzw. entfernen (Favoriten). */
export function withValidUserProductRefs<
  T extends Pick<UserRows, 'userFoodProducts' | 'foodLogEntries' | 'foodLogFavorites'>,
>(rows: T): T {
  const ids = new Set(rows.userFoodProducts.map((p) => p.id));
  return {
    ...rows,
    foodLogEntries: rows.foodLogEntries.map((e: FoodLogEntryRow) =>
      e.user_product_id !== null && !ids.has(e.user_product_id)
        ? { ...e, user_product_id: null }
        : e,
    ),
    foodLogFavorites: rows.foodLogFavorites.filter(
      (f) => f.user_product_id === null || ids.has(f.user_product_id),
    ),
  };
}

/** Eintrag eines eigenen Produkts, dessen Produkt es noch gibt? (für „Zuletzt“) */
export function userProductOf(
  rows: Pick<UserRows, 'userFoodProducts'>,
  entry: Pick<FoodLogEntry, 'user_product_id'>,
): UserFoodProductRow | null {
  return rows.userFoodProducts.find((p) => p.id === entry.user_product_id) ?? null;
}
