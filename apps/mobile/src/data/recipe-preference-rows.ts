import {
  RECIPE_PREFERENCE_RULES,
  type RecipePreference,
  type RecipePreferenceKind,
  recipePreferenceLimitReached,
  recipePreferenceSchema,
  setRecipePreference,
} from '@fitnessapp/core';

import type { RecipePreferenceRow, UserRows } from './types';

/**
 * Rezept-Favoriten in der App (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a): Abbildung Zeilen ↔ Vorlieben. Die Regeln
 * (eine Vorliebe je Rezept, Obergrenze, Sperre/Bonus im Essensplan) stehen in packages/core (`recipe-preferences.ts`).
 * Kein Gesundheitsdatum: offline-first über die normale Warteschlange (Supabase) bzw. den Gerätespeicher (Testmodus).
 * Nie loggen, nie an Analytics.
 */

/** Zeilen → Vorlieben für die Engine (packages/core). */
export function recipePreferencesFromRows(
  rows: Pick<UserRows, 'recipePreferences'>,
): RecipePreference[] {
  return rows.recipePreferences.map((row) => ({
    recipeId: row.recipe_id,
    kind: row.kind,
    setOn: row.set_on,
  }));
}

/** Vorliebe dieses Rezepts (null = keine). */
export function preferenceForRecipe(
  rows: Pick<UserRows, 'recipePreferences'>,
  recipeId: string,
): RecipePreferenceKind | null {
  return rows.recipePreferences.find((row) => row.recipe_id === recipeId)?.kind ?? null;
}

export type RecipePreferenceCheck =
  { ok: true; row: RecipePreferenceRow | null } | { ok: false; reason: 'limit' | 'invalid' };

/**
 * Vorliebe setzen (`kind`) oder zurücknehmen (`null`) – geprüft (Zod, Obergrenze), ohne zu speichern. Liefert die
 * neue Zeile (bzw. null beim Zurücknehmen) für den Schreibvorgang `set_recipe_preference`.
 */
export function checkRecipePreference(
  rows: Pick<UserRows, 'recipePreferences'>,
  change: { recipeId: string; kind: RecipePreferenceKind | null },
  context: { userId: string; today: string },
): RecipePreferenceCheck {
  const current = recipePreferencesFromRows(rows);
  if (change.kind !== null && recipePreferenceLimitReached(current, change.recipeId)) {
    return { ok: false, reason: 'limit' };
  }
  try {
    const next = setRecipePreference(current, { ...change, setOn: context.today });
    const saved = next.find((p) => p.recipeId === change.recipeId) ?? null;
    return {
      ok: true,
      row:
        saved === null
          ? null
          : {
              user_id: context.userId,
              recipe_id: saved.recipeId,
              kind: saved.kind,
              set_on: saved.setOn,
            },
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Zeile setzen bzw. entfernen (rein; Reihenfolge nach Rezept-ID wie in der Datenbank-Abfrage egal). */
export function applyRecipePreferenceRow(
  rows: UserRows,
  recipeId: string,
  row: RecipePreferenceRow | null,
): UserRows {
  const rest = rows.recipePreferences.filter((r) => r.recipe_id !== recipeId);
  return {
    ...rows,
    recipePreferences: (row === null ? rest : [...rest, row]).sort((a, b) =>
      a.recipe_id < b.recipe_id ? -1 : a.recipe_id > b.recipe_id ? 1 : 0,
    ),
  };
}

/** Ist die Zeile gültig (wie CHECK/Schema der Tabelle)? */
export function validRecipePreferenceRow(row: RecipePreferenceRow): boolean {
  return recipePreferenceSchema.safeParse({
    recipeId: row.recipe_id,
    kind: row.kind,
    setOn: row.set_on,
  }).success;
}

/**
 * Gerätespeicher (nicht vertrauenswürdig): nur gültige Zeilen des eigenen Kontos mit genau den Spalten der Tabelle,
 * je Rezept höchstens eine, höchstens `RECIPE_PREFERENCE_RULES.maxEntries`. Ältere Stände ohne Feld → leer.
 */
export function storedRecipePreferences(
  stored: unknown,
  owner: string | undefined,
): RecipePreferenceRow[] {
  const list: unknown = (stored as { recipePreferences?: unknown } | null)?.recipePreferences;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list
    .flatMap((item: unknown): RecipePreferenceRow[] => {
      if (typeof item !== 'object' || item === null) return [];
      const row = item as Record<string, unknown>;
      if (Object.keys(row).sort().join(',') !== 'kind,recipe_id,set_on,user_id') return [];
      const parsed = recipePreferenceSchema.safeParse({
        recipeId: row.recipe_id,
        kind: row.kind,
        setOn: row.set_on,
      });
      const userId = row.user_id;
      if (
        !parsed.success ||
        typeof userId !== 'string' ||
        (owner !== undefined && userId !== owner) ||
        seen.has(parsed.data.recipeId)
      ) {
        return [];
      }
      seen.add(parsed.data.recipeId);
      return [
        {
          user_id: userId,
          recipe_id: parsed.data.recipeId,
          kind: parsed.data.kind,
          set_on: parsed.data.setOn,
        },
      ];
    })
    .slice(0, RECIPE_PREFERENCE_RULES.maxEntries);
}
