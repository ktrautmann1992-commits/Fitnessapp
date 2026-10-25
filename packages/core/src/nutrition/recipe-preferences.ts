import { z } from 'zod';

import { isoDateSchema } from '../age';
import { RECIPE_PREFERENCE_RULES } from '../constants';
import { contentIdSchema } from '../content/schemas';

/**
 * Rezept-Favoriten (Gründer-Freigabe 25.10.2026, KONZEPT 6.10a) – gratis, regelbasiert, ohne KI.
 *
 * Je Person und Rezept höchstens EINE Vorliebe:
 * - `favorite` („Lieblingsgericht“, Herz): der Essensplan schlägt das Rezept bevorzugt vor (Bonus im Score, nur
 *   Reihenfolge; Wiederholungsgrenzen, Ernährungsform, Allergien und Kalorien-Schutzgrenzen gelten unverändert).
 * - `hidden` („Nie wieder“): das Rezept wird dauerhaft nicht mehr vorgeschlagen und in Rezeptlisten ausgeblendet –
 *   bis die Person es unter „Ausgeblendete Gerichte“ wieder zulässt.
 *
 * Abgrenzung zur Bewertung nach dem Essen (`ratings.ts`, KONZEPT 6.10): Daumen hoch/runter ist ein Eindruck nach
 * EINER Mahlzeit (Daumen runter = 8 Wochen Pause), die Vorliebe ist eine dauerhafte Entscheidung. Beide wirken über
 * denselben Index (`recipeRatingIndex`) – „Nie wieder“ sperrt wie Daumen runter (nur ohne Ablaufdatum), das Herz
 * teilt sich den gedeckelten Bonus mit Daumen hoch (`MEAL_PLAN_SCORING.ratingFavorite`, keine Addition).
 *
 * Kein Gesundheitsdatum (wie `recipe_ratings`): keine Gründe, kein Bezug zu Unverträglichkeiten. Privat – nie
 * angezeigt außer der eigenen Vorliebe, nie aggregiert, nie an Analytics oder Logs.
 */

export const RECIPE_PREFERENCE_KINDS = ['favorite', 'hidden'] as const;
export type RecipePreferenceKind = (typeof RECIPE_PREFERENCE_KINDS)[number];

/** Eine Vorliebe (Spalten wie `recipe_preferences`: user_id, recipe_id, kind, set_on). */
export const recipePreferenceSchema = z.strictObject({
  recipeId: contentIdSchema,
  kind: z.enum(RECIPE_PREFERENCE_KINDS),
  setOn: isoDateSchema,
});
export type RecipePreference = z.infer<typeof recipePreferenceSchema>;
export type RecipePreferenceInput = z.input<typeof recipePreferenceSchema>;

export const recipePreferencesSchema = z
  .array(recipePreferenceSchema)
  .max(RECIPE_PREFERENCE_RULES.maxEntries)
  .refine(
    (list) => new Set(list.map((p) => p.recipeId)).size === list.length,
    'Je Rezept nur eine Vorliebe.',
  );

function byRecipeId(a: { recipeId: string }, b: { recipeId: string }): number {
  return a.recipeId < b.recipeId ? -1 : a.recipeId > b.recipeId ? 1 : 0;
}

/**
 * Vorliebe setzen (`kind`) oder zurücknehmen (`null`). Ersetzt eine vorhandene Vorliebe desselben Rezepts (Herz →
 * „Nie wieder“ entfernt das Herz). Ergebnis geprüft und nach Rezept-ID sortiert. Wirft bei ungültigen Eingaben.
 */
export function setRecipePreference(
  preferences: readonly RecipePreferenceInput[],
  change: {
    readonly recipeId: string;
    readonly kind: RecipePreferenceKind | null;
    readonly setOn: string;
  },
): RecipePreference[] {
  const recipeId = contentIdSchema.parse(change.recipeId);
  const rest = preferences.filter((p) => p.recipeId !== recipeId);
  if (change.kind === null) return recipePreferencesSchema.parse(rest);
  const next = recipePreferenceSchema.parse({ recipeId, kind: change.kind, setOn: change.setOn });
  return recipePreferencesSchema.parse([...rest, next].sort(byRecipeId));
}

/**
 * Obergrenze erreicht? Eine NEUE Vorliebe passt nicht mehr; Ändern oder Zurücknehmen einer vorhandenen geht immer
 * (die App zeigt eine verständliche Meldung, aufgeräumt wird nichts).
 */
export function recipePreferenceLimitReached(
  preferences: readonly Pick<RecipePreferenceInput, 'recipeId'>[],
  recipeId: string,
): boolean {
  return (
    preferences.length >= RECIPE_PREFERENCE_RULES.maxEntries &&
    !preferences.some((p) => p.recipeId === recipeId)
  );
}

/** Vorliebe eines Rezepts (null = keine). */
export function recipePreferenceOf(
  preferences: readonly Pick<RecipePreferenceInput, 'recipeId' | 'kind'>[] | undefined,
  recipeId: string,
): RecipePreferenceKind | null {
  return preferences?.find((p) => p.recipeId === recipeId)?.kind ?? null;
}

/** Rezept-IDs einer Art (z. B. alle Lieblingsgerichte), sortiert. */
export function recipeIdsWithPreference(
  preferences: readonly Pick<RecipePreferenceInput, 'recipeId' | 'kind'>[] | undefined,
  kind: RecipePreferenceKind,
): string[] {
  return (preferences ?? [])
    .filter((p) => p.kind === kind)
    .map((p) => p.recipeId)
    .sort();
}

export interface HiddenRecipeEntry {
  readonly recipeId: string;
  /** Titel aus dem Bestand; null = Rezept gibt es nicht mehr (trotzdem anzeigen, damit es entfernt werden kann). */
  readonly titleDe: string | null;
  readonly setOn: string;
}

/**
 * Liste „Ausgeblendete Gerichte“ (Ernährung → Einstellungen): alle `hidden`-Vorlieben mit Titel aus dem Bestand,
 * alphabetisch nach Titel (unbekannte Rezepte am Ende, nach ID) – deterministisch.
 */
export function hiddenRecipeEntries(
  preferences: readonly RecipePreferenceInput[] | undefined,
  recipes: readonly { readonly id: string; readonly title_de: string }[],
): HiddenRecipeEntry[] {
  const titles = new Map(recipes.map((r) => [r.id, r.title_de] as const));
  return (preferences ?? [])
    .filter((p) => p.kind === 'hidden')
    .map((p) => ({ recipeId: p.recipeId, titleDe: titles.get(p.recipeId) ?? null, setOn: p.setOn }))
    .sort((a, b) => {
      if (a.titleDe !== null && b.titleDe !== null) {
        return a.titleDe.localeCompare(b.titleDe, 'de') || byRecipeId(a, b);
      }
      if (a.titleDe === null && b.titleDe === null) return byRecipeId(a, b);
      return a.titleDe === null ? 1 : -1;
    });
}
