import {
  FOOD_LOG_LIMITS,
  foodLogDateStatus,
  type FoodLogRejectCode,
  type FoodLogEntry,
  foodLogEntrySchema,
  type FoodLogFavorite,
  foodLogFavoriteSchema,
  type ProductForEntry,
  serverProductEntry,
  upsertFavorite,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import type { FoodLogEntryRow, FoodLogFavoriteRow, UserRows } from './types';

/**
 * Ernährungstagebuch im TESTMODUS (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5) – dieselben Regeln wie die
 * Datenbank-Funktion save_food_log_entries bzw. die Tabelle food_log_favorites, soweit sie ohne Datenbank gelten:
 * - nur mit gültiger Einwilligung health_data (A-G12),
 * - Form und Grenzen wie die CHECKs (Zod, strikt: `foodLogEntrySchema` aus packages/core),
 * - Datum heute bis 14 Tage zurück, nie in der Zukunft (das Gerät ist strenger als der Server, der 1 Tag
 *   Zeitzonen-Toleranz lässt); Einträge älter als 14 Tage sind nicht mehr änderbar (Löschen geht immer),
 * - Plan-Mahlzeit je Tag und Platz höchstens einmal, höchstens 40 Einträge je Tag und je Speichervorgang,
 * - Ergebnis JE EINTRAG (Wächter E1 S2): gültige Einträge gelten, auch wenn ein anderer abgelehnt wird,
 * - Favoriten: Schlüssel passt zum Inhalt, Katalog/Rezept ohne Werte, Schnell-Favoriten nur mit Einwilligung,
 *   höchstens 100.
 * Der Abgleich mit dem Katalog (nur vorhandene Lebensmittel/Rezepte, Titel aus dem Katalog) gilt nur auf dem Server;
 * im Testmodus bauen die Funktionen aus packages/core die Einträge immer aus dem Bestand. Rein und getestet.
 *
 * Datenschutz: Tagebuch-Einträge sind vorsorglich Gesundheitsdaten (Art. 9) – im Testmodus wie alles im Gerätespeicher
 * (dokumentierte Ausnahme des Testmodus), nie loggen, beim Widerruf gelöscht.
 */

/**
 * Ergebnis je Eintrag wie save_food_log_entries (Wächter E1 S2): ein ungültiger Eintrag hält die übrigen nicht auf.
 * Der GANZE Vorgang scheitert nur ohne Einwilligung oder bei ungültiger Liste (leer, über 40, doppelte id).
 */
export type FoodLogEntryOutcome =
  | { kind: 'saved'; entry: FoodLogEntry }
  | { kind: 'conflict'; reason: 'plan_item_exists'; id: string }
  | { kind: 'rejected'; code: FoodLogRejectCode };

export type FoodLogSaveCheck =
  | { ok: true; outcomes: FoodLogEntryOutcome[] }
  | { ok: false; reason: 'consent_required' | 'invalid' };

export function checkFoodLogSave(
  rows: Pick<UserRows, 'consents' | 'profile' | 'foodLogEntries'> &
    Partial<Pick<UserRows, 'customMeals' | 'userFoodProducts'>>,
  entries: readonly unknown[],
  ctx: {
    today: string;
    versions: ConsentVersions;
    /**
     * E4a: Zwischenspeicher der Produkte (Testmodus). Gesetzt → Produkt-Einträge werden wie save_food_log_entries
     * nachgerechnet (`serverProductEntry`, fehlend/gesperrt → `product_unavailable`). Fehlt er (Vorab-Prüfung im
     * Supabase-Modus), rechnet nur der Server.
     */
    products?: (code: string) => ProductForEntry | null;
  },
): FoodLogSaveCheck {
  if (healthConsentStatus(rows as UserRows, ctx.versions) !== 'valid') {
    return { ok: false, reason: 'consent_required' };
  }
  if (entries.length === 0 || entries.length > FOOD_LOG_LIMITS.maxEntriesPerSave) {
    return { ok: false, reason: 'invalid' };
  }
  const ids = entries.map((e) =>
    typeof e === 'object' && e !== null ? (e as { id?: unknown }).id : undefined,
  );
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'invalid' };
  // Der Reihe nach wie der Server: jeder gespeicherte Eintrag zählt für die folgenden (Tageslimit, Plan-Mahlzeit).
  let current: FoodLogEntry[] = [...rows.foodLogEntries];
  const outcomes: FoodLogEntryOutcome[] = [];
  for (const raw of entries) {
    const parsed = foodLogEntrySchema.safeParse(raw);
    if (!parsed.success) {
      outcomes.push({ kind: 'rejected', code: 'invalid' });
      continue;
    }
    // Eigenes Gericht (E2): Verweis nur auf ein vorhandenes eigenes Gericht. Fehlt es (gelöscht), wird der Verweis
    // leer und der Eintrag mit seinen Werten gespeichert – wie save_food_log_entries seit der Wächter-Nachprüfung E2 S1:
    // neuer Eintrag = Werte des Geräts (Grenzen per Zod wie die CHECKs), Ändern = Schnappschuss (rebuildEntry). Die
    // Werte selbst rechnet im Testmodus immer packages/core aus dem Bestand.
    let entry =
      parsed.data.custom_meal_id !== null &&
      !(rows.customMeals ?? []).some((m) => m.id === parsed.data.custom_meal_id)
        ? { ...parsed.data, custom_meal_id: null }
        : parsed.data;
    const existing = current.find((row) => row.id === entry.id);
    if (
      foodLogDateStatus(entry.eaten_on, ctx.today) !== 'ok' ||
      (existing !== undefined && foodLogDateStatus(existing.eaten_on, ctx.today) !== 'ok')
    ) {
      outcomes.push({ kind: 'rejected', code: 'out_of_range' });
      continue;
    }
    const otherPlanItem =
      entry.source === 'plan_item'
        ? current.find(
            (e) =>
              e.source === 'plan_item' &&
              e.eaten_on === entry.eaten_on &&
              e.slot === entry.slot &&
              e.id !== entry.id,
          )
        : undefined;
    if (otherPlanItem !== undefined) {
      outcomes.push({ kind: 'conflict', reason: 'plan_item_exists', id: otherPlanItem.id });
      continue;
    }
    // E4a: Produkt – Werte und Titel wie der Server aus dem Zwischenspeicher bzw. dem eigenen Produkt (Plan 3.5).
    if (entry.source === 'product' && ctx.products !== undefined) {
      const productCode = entry.product_code;
      const userProductId = entry.user_product_id;
      const server = serverProductEntry(entry, existing ?? null, {
        product: productCode !== null ? ctx.products(productCode) : null,
        userProduct:
          userProductId !== null
            ? ((rows.userFoodProducts ?? []).find((p) => p.id === userProductId) ?? null)
            : null,
      });
      if (server.kind !== 'ok') {
        outcomes.push({
          kind: 'rejected',
          code: server.kind === 'unavailable' ? 'product_unavailable' : 'invalid',
        });
        continue;
      }
      entry = server.entry;
    }
    const next = [...current.filter((row) => row.id !== entry.id), entry];
    if (
      next.filter((e) => e.eaten_on === entry.eaten_on).length > FOOD_LOG_LIMITS.maxEntriesPerDay
    ) {
      outcomes.push({ kind: 'rejected', code: 'day_full' });
      continue;
    }
    current = next;
    outcomes.push({ kind: 'saved', entry });
  }
  return { ok: true, outcomes };
}

/** Einträge übernehmen: neu mit revision 1, vorhandene ganz ersetzt (revision + 1, created_at bleibt). */
export function applyFoodLogSave(
  rows: UserRows,
  entries: readonly FoodLogEntry[],
  ctx: { userId: string; now: string; newId: () => string },
): UserRows {
  const byId = new Map(rows.foodLogEntries.map((row) => [row.id, row]));
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    const row: FoodLogEntryRow = {
      ...entry,
      user_id: ctx.userId,
      revision: existing ? existing.revision + 1 : 1,
      last_write_id: ctx.newId(),
      created_at: existing?.created_at ?? ctx.now,
      updated_at: ctx.now,
    };
    byId.set(entry.id, row);
  }
  return { ...rows, foodLogEntries: [...byId.values()] };
}

/** Eintrag löschen (geht immer, auch ohne Einwilligung und für alte Einträge – Recht auf Löschung). */
export function applyFoodLogDelete(rows: UserRows, id: string): UserRows {
  return { ...rows, foodLogEntries: rows.foodLogEntries.filter((row) => row.id !== id) };
}

export type FavoriteChange =
  { op: 'set'; favorite: FoodLogFavorite } | { op: 'remove'; favKey: string };

/** Stern setzen bzw. entfernen (wie die RLS-Policies und CHECKs von food_log_favorites). null = abgelehnt. */
export function applyFavoriteChange(
  rows: UserRows,
  change: FavoriteChange,
  ctx: { userId: string; now: string; versions: ConsentVersions },
): UserRows | null {
  if (change.op === 'remove') {
    return {
      ...rows,
      foodLogFavorites: rows.foodLogFavorites.filter((f) => f.fav_key !== change.favKey),
    };
  }
  const parsed = foodLogFavoriteSchema.safeParse(change.favorite);
  if (!parsed.success) return null;
  // Schnell-Favoriten (Bezeichnung + kcal) nur mit gültiger Einwilligung (Wächter E1 G1, wie die RLS-Policy); E4a:
  // ebenso Produkt-Favoriten (E4-G10) – ein eigenes Produkt muss es geben.
  if (
    (parsed.data.source === 'quick' || parsed.data.source === 'product') &&
    healthConsentStatus(rows, ctx.versions) !== 'valid'
  ) {
    return null;
  }
  if (
    parsed.data.user_product_id !== null &&
    !rows.userFoodProducts.some((p) => p.id === parsed.data.user_product_id)
  ) {
    return null;
  }
  const before = rows.foodLogFavorites.find((f) => f.fav_key === parsed.data.fav_key);
  const row: FoodLogFavoriteRow = {
    ...parsed.data,
    user_id: ctx.userId,
    created_at: before?.created_at ?? ctx.now,
  };
  const next = upsertFavorite(rows.foodLogFavorites, row);
  return next === null ? null : { ...rows, foodLogFavorites: next };
}

/** Zeile → Eintrag (ohne Server-Felder), z. B. zum Bearbeiten. */
export function entryFromRow(row: FoodLogEntryRow): FoodLogEntry {
  return {
    id: row.id,
    eaten_on: row.eaten_on,
    slot: row.slot,
    source: row.source,
    food_id: row.food_id,
    recipe_id: row.recipe_id,
    custom_meal_id: row.custom_meal_id,
    product_code: row.product_code,
    user_product_id: row.user_product_id,
    title_de: row.title_de,
    amount: row.amount,
    unit: row.unit,
    portion: row.portion,
    kcal: row.kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
  };
}
