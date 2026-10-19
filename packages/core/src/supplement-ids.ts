/**
 * Kennungen der Supplemente (docs/PLAN-PHASE-6.md Abschnitt 5, Wächter S1).
 *
 * Diese Datei ist ein neutrales BLATT: Sie hat keine eigenen Importe und liegt bewusst außerhalb von
 * `supplements/` und `affiliate/`. Sie ist die einzige Core-Datei, die das Affiliate-Modul (Etappe SU5) importieren
 * darf – so teilen sich Empfehlung und Affiliate nur die Namen, nie Regeln oder Daten (Strukturtest
 * `supplements/structure.test.ts`). Gleiche Liste wie die Datenbank-Aufzählung `supplement_id` (SU3).
 */
export const SUPPLEMENT_IDS = [
  'creatine',
  'caffeine',
  'protein_powder',
  'vitamin_d',
  'omega3',
] as const;

export type SupplementId = (typeof SUPPLEMENT_IDS)[number];

/** Supplemente mit möglicher Einordnung (alles außer Koffein, das nur eine Sicherheits-Info bekommt). */
export type RatedSupplementId = Exclude<SupplementId, 'caffeine'>;

/** Feste Reihenfolge der eingeordneten Supplemente in Ergebnis und Anzeige. */
export const RATED_SUPPLEMENT_IDS = [
  'creatine',
  'protein_powder',
  'vitamin_d',
  'omega3',
] as const satisfies readonly RatedSupplementId[];
