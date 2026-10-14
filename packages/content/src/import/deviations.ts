/**
 * Abweichungen aus dem Import-Bericht je Rezept (docs/PLAN-PHASE-5.md 19.2/19.5, Etappe N2d): Nährwerte je Portion
 * aus der Gründer-Datei (beim Import als `declared_per_serving` übernommen) gegen die aus dem Katalog berechneten
 * Werte – dieselbe Regel wie im Bericht von `alpha5-import` (`alpha5Deviations`, Toleranz `ALPHA5_IMPORT_TOLERANCE`).
 *
 * Rein, ohne Node-Module – Paket-Export `@fitnessapp/content/import-report`, genutzt vom Redaktionsbereich
 * (`admin/rezepte`). Maßgeblich sind immer die berechneten Werte.
 */
import { ALPHA5_IMPORT_TOLERANCE, type Recipe } from '@fitnessapp/core';

import { alpha5Deviations, type CrossCheckValues, type Deviation } from '../foods/import-source';

export type { Deviation };

/** Kurzbeschreibung der Toleranz, z. B. „> 3 % (mind. 20 kcal bzw. 2 g)“. */
export const IMPORT_TOLERANCE_NOTE_DE = `> ${Math.round(ALPHA5_IMPORT_TOLERANCE.relative * 100)} % (mind. ${ALPHA5_IMPORT_TOLERANCE.minKcal} kcal bzw. ${ALPHA5_IMPORT_TOLERANCE.minGrams} g)`;

/** Abweichungen deklariert (Gründer-Datei) ↔ berechnet je Portion; leer = innerhalb der Toleranz. */
export function recipeImportDeviations(
  recipe: Pick<Recipe, 'id' | 'declared_per_serving'>,
  computedPerServing: CrossCheckValues,
): Deviation[] {
  const declared = recipe.declared_per_serving;
  return alpha5Deviations(
    recipe.id,
    {
      kcal: declared.kcal,
      eiweiss_g: declared.protein_g,
      kohlenhydrate_g: declared.carbs_g,
      fett_g: declared.fat_g,
    },
    computedPerServing,
  );
}
