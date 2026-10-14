/**
 * Katalog des Redaktionsbereichs aus den beim Bauen gebündelten Repository-Dateien
 * (scripts/bundle-content.mjs → src/generated/content-files.ts). Einmal je Server-Instanz berechnet.
 */
import { buildNutritionCatalog } from '@fitnessapp/content/catalog';

import { CONTENT_BUNDLE } from '@/generated/content-files';

import { buildCatalog, type Catalog } from './catalog';
import { buildNutritionAdmin, type NutritionAdmin } from './nutrition';

let cached: Catalog | undefined;
let cachedNutrition: NutritionAdmin | undefined;

export function getCatalog(): Catalog {
  cached ??= buildCatalog(CONTENT_BUNDLE.files, CONTENT_BUNDLE.strayFiles);
  return cached;
}

/**
 * Ernährung (Etappe N2d): Begleitdaten des Katalogs aus den Texten des Bündels – wie die App im Testmodus.
 * Fehler darin → ohne Begleitdaten prüfen (sichere Richtung: Lebensmittel rot) und die Fehler anzeigen.
 */
export function getNutritionAdmin(): NutritionAdmin {
  if (cachedNutrition === undefined) {
    const { nutritionCatalog } = CONTENT_BUNDLE;
    const { catalog, problems } = buildNutritionCatalog({
      extracts: nutritionCatalog.extracts,
      expectations: nutritionCatalog.expectations ?? undefined,
      exceptions: nutritionCatalog.exceptions ?? undefined,
    });
    cachedNutrition = buildNutritionAdmin(
      CONTENT_BUNDLE.nutritionFiles,
      problems.length === 0 ? catalog : undefined,
      problems,
    );
  }
  return cachedNutrition;
}
