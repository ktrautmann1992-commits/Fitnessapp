/**
 * Gerichte für „Auswärts essen“ (Reiter „Unterwegs“ beim Eintragen, Gründer-Freigabe 25.10.2026): Kategorien und
 * Typen. Die Gerichte selbst stehen seit G-AV2 (Gründer-Freigabe 26.10.2026) in der Zuordnungsdatei
 * `content/food-mapping/auswaerts-zuordnung.json` – geladen und geprüft von `eating-out-mapping.ts`, gerechnet von
 * `eating-out.ts`.
 *
 * Grundsatz „keine erfundenen Nährwerte“: Ein Gericht ist NUR eine Zutatenliste (Katalog-ID + Gramm je normaler
 * Portion, wie eigene Gerichte aus Zutaten, KONZEPT 6.2) mit Begründung. Die Werte rechnet `eatingOutRawValues` mit
 * derselben Rechnung wie Rezepte aus dem Lebensmittel-Katalog (BLS 4.0). Ist eine Zutat noch nicht im Katalog
 * („wartet auf Import“ über den Workflow `foods-import`), bleibt das Gericht ohne Werte und erscheint nicht.
 */

export const EATING_OUT_CATEGORIES = [
  'restaurant',
  'imbiss',
  'kantine',
  'baeckerei',
  'cafe',
  'fastfood',
] as const;
export type EatingOutCategory = (typeof EATING_OUT_CATEGORIES)[number];

export const EATING_OUT_CATEGORY_LABELS_DE: Readonly<Record<EatingOutCategory, string>> = {
  restaurant: 'Restaurant',
  imbiss: 'Imbiss',
  kantine: 'Kantine',
  baeckerei: 'Bäckerei',
  cafe: 'Café',
  fastfood: 'Fast Food',
};

/** Art der Portionsauswahl (Faktoren in `EATING_OUT.portions`, constants.ts). */
export const EATING_OUT_PORTION_KINDS = ['plate', 'pizza', 'piece', 'drink'] as const;
export type EatingOutPortionKind = (typeof EATING_OUT_PORTION_KINDS)[number];

/**
 * Zutat, die im Katalog fehlt und über `foods-import` kommen soll (aus dem Abschnitt `foods` der Zuordnungsdatei;
 * Suchbegriffe für den Modus „kandidaten“, Quell-ID null = noch nicht festgelegt).
 */
export interface EatingOutMissingFood {
  readonly food_id: string;
  readonly name_de: string;
  readonly search_de: readonly string[];
  readonly source_ref: string | null;
}

export interface EatingOutDishDef {
  readonly id: string;
  readonly name_de: string;
  readonly category: EatingOutCategory;
  readonly portion: EatingOutPortionKind;
  /** Was „normal“ bedeutet („1 Teller“, „0,3 l“, „1 Stück“). */
  readonly basis_de: string;
  /** Zutaten einer normalen Portion: [Katalog-ID, Gramm]. */
  readonly items: readonly (readonly [string, number])[];
  /** Begründung der Portion und Zusammensetzung (Pflicht in der Zuordnungsdatei). */
  readonly source_de?: string;
  /** Annahme, die bei der Freigabe zu prüfen ist. */
  readonly note_de?: string;
  readonly status: 'draft' | 'released';
  readonly reviewed_by?: string;
  readonly reviewed_at?: string;
}
