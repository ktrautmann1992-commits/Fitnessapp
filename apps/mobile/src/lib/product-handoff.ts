import type { UserFoodProduct } from '@fitnessapp/core';

/**
 * Übergabe an die Produktansicht IM ARBEITSSPEICHER (Etappe E4a): Nummer, Menge, eigenes Produkt bzw. Vorbelegung für
 * „Eigenes Produkt anlegen“ stehen NIE in der Adresse – im Browser landen Adressen beim Neuladen in den Logs des
 * Servers (docs/PLAN-E4.md 3.2 Nr. 4: „Die Nummer steht nie in der URL“). Einmal lesen, dann leer.
 */
export interface ProductHandoff {
  /** Nummer, die die Produktansicht sofort abfragt (Favorit, „Produkt neu abrufen“). */
  readonly code?: string;
  /** Zuletzt gewählte Menge (Favorit). */
  readonly amount?: number;
  /** Eigenes Produkt direkt anzeigen. */
  readonly ownId?: string;
}

let current: ProductHandoff | null = null;

export function setProductHandoff(handoff: ProductHandoff): void {
  current = handoff;
}

export function takeProductHandoff(): ProductHandoff | null {
  const value = current;
  current = null;
  return value;
}

/** Vorbelegung des Formulars „Eigenes Produkt“ (aus OFF bzw. nur die Nummer) – ebenfalls nur im Arbeitsspeicher. */
export type UserProductPrefill = Partial<
  Pick<
    UserFoodProduct,
    | 'name_de'
    | 'brand_de'
    | 'code'
    | 'base_unit'
    | 'kcal'
    | 'protein_g'
    | 'carbs_g'
    | 'fat_g'
    | 'sugar_g'
    | 'salt_g'
    | 'serving_g'
    | 'based_on_off'
  >
>;
