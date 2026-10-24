import { GENERATED_RECIPE_MEDIA, type GeneratedRecipeMedia } from './recipe-media.generated';

/**
 * Rezeptfotos in der App (docs/PLAN-PHASE-5.md Nachtrag „Rezeptbilder“, gleiches Muster wie die Übungsbilder):
 * Bilder liegen im App-Bündel (apps/mobile/assets/recipe-media, Metro-Asset – Web-Export und APK, keine externen
 * Aufrufe). Das Modul `recipe-media.generated.ts` erzeugt `pnpm recipe-media` aus content/recipe-media.
 * Kein Eintrag → null → die App zeigt das bisherige grüne Rezept-Symbol.
 */
export type RecipeImage = GeneratedRecipeMedia;

export function recipeImageFor(
  recipeId: string,
  registry: Readonly<Record<string, GeneratedRecipeMedia>> = GENERATED_RECIPE_MEDIA,
): RecipeImage | null {
  return Object.hasOwn(registry, recipeId) ? (registry[recipeId] ?? null) : null;
}
