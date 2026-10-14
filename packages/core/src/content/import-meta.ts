import { z } from 'zod';

import { stableHash } from '../nutrition/stable-hash';
import { canonicalJson } from './canonical-json';
import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Herkunftsangaben importierter Inhalte (docs/PLAN-PHASE-5.md 19.2, Etappe N2c): Rezepte, Meal-Prep-Pläne und
 * Ratgeber aus der Gründer-Datei `alpha5-rezepte.json` tragen zusätzlich
 * - `source_file` – Datei und Fassung, z. B. `alpha5-rezepte.json@1.0`,
 * - `import_hash` – SHA-256 der Import-Ausgabe (ohne `import_hash`). Ein erneuter Import überschreibt einen Entwurf
 *   nur, wenn sein Inhalt noch genau dieser Ausgabe entspricht (menschliche Korrekturen bleiben, S5),
 * - bei Rezepten `import_assumptions` (z. B. „Zutat wird erhitzt“) und `import_assumptions_confirmed_by` – bestätigt
 *   werden die Annahmen bei der Freigabe (Plan 19.5, S4) – plus `import_assumptions_fingerprint`: Fingerabdruck der
 *   Zubereitung (Zutaten, Schritte, Tipp, Zeiten, …; `IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS`) zum Zeitpunkt der
 *   Bestätigung (Gründer-Entscheidung 14.10.2026, Wächter N2d S2/S5). Ändert jemand danach etwas davon, gilt die
 *   Bestätigung nicht mehr (sichere Richtung).
 */

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

export const importHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'SHA-256 als 64 Hex-Zeichen erwartet.');

/** Eine Annahme des Imports, die ein Mensch bei der Freigabe bestätigt (Plan 19.2 `heated`, S4). */
export const importAssumptionSchema = z.strictObject({
  ingredient_index: z.number().int().min(0).max(50),
  food_id: contentIdSchema,
  field: z.literal('heated'),
  value: z.literal(true),
  reason_de: text(5, 300),
});
export type ImportAssumption = z.infer<typeof importAssumptionSchema>;

/** Fingerabdruck bestätigter Import-Annahmen: 16 Hex-Zeichen (`importAssumptionsFingerprint`). */
export const importAssumptionsFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{16}$/, 'Fingerabdruck als 16 Hex-Zeichen erwartet.');

const importFields = {
  source_file: text(3, 120).optional(),
  import_hash: importHashSchema.optional(),
};

/** Prüft die Felder aus `contentMetaSchema` (dessen Regeln gelten unverändert). */
function refineBaseMeta(meta: z.infer<typeof contentMetaSchema>, ctx: z.RefinementCtx): void {
  const base = contentMetaSchema.safeParse({
    origin: meta.origin,
    model: meta.model,
    batch_id: meta.batch_id,
    created_on: meta.created_on,
    expert_reviewed: meta.expert_reviewed,
    reviewed_by: meta.reviewed_by,
    reviewed_at: meta.reviewed_at,
    review_note: meta.review_note,
  });
  if (!base.success) {
    for (const issue of base.error.issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  }
}

/** Meta von Meal-Prep-Plänen und Ratgebern: wie alle Inhalte plus Import-Herkunft. */
export const importedContentMetaSchema = z
  .strictObject({ ...contentMetaSchema.shape, ...importFields })
  .superRefine(refineBaseMeta);
export type ImportedContentMeta = z.infer<typeof importedContentMetaSchema>;

/** Meta von Rezepten: zusätzlich die Import-Annahmen und wer sie bestätigt hat. */
export const recipeMetaSchema = z
  .strictObject({
    ...contentMetaSchema.shape,
    ...importFields,
    import_assumptions: z.array(importAssumptionSchema).max(50).optional(),
    import_assumptions_confirmed_by: text(1, 100).nullable().optional(),
    import_assumptions_fingerprint: importAssumptionsFingerprintSchema.nullable().optional(),
  })
  .superRefine(refineBaseMeta);
export type RecipeMeta = z.infer<typeof recipeMetaSchema>;

/**
 * Felder eines Rezepts im Fingerabdruck bestätigter Import-Annahmen (Wächter N2d S2/S5): alles, was beschreibt, WIE
 * zubereitet und gegessen wird – Zutaten vollständig (inkl. `food_id`, Menge, Einheit, `heated`, `optional`,
 * `note_de`/`display_de`), Schritte, Tipp (z. B. „Eigelb flüssig lassen“), Zeiten, `no_cook`, Geräte sowie Titel und
 * Beschreibung (z. B. „Tatar“, „roh“). Bewusst NICHT: Status, Version, `meta`, Kategorien, Schlagworte, Abschnitt,
 * Portionen, Meal-Prep-Angaben (Aufbewahrung prüft R9 selbst), deklarierte Werte und Kosten.
 */
export const IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS = [
  'title_de',
  'description_de',
  'ingredients',
  'steps_de',
  'tip_de',
  'prep_minutes',
  'cook_minutes',
  'total_minutes',
  'no_cook',
  'equipment_de',
] as const;

/**
 * Teile eines Rezepts, über die der Fingerabdruck gebildet wird. Pflicht sind nur die Felder, die
 * `computeRecipeFacts` ohnehin braucht; fehlt ein anderes Feld (Teil-Objekt), weicht der Fingerabdruck ab →
 * „geändert“, also die sichere Richtung.
 */
export interface ImportAssumptionsSubject {
  readonly ingredients: readonly unknown[];
  readonly steps_de: readonly string[];
  readonly no_cook: boolean;
  readonly title_de?: string | undefined;
  readonly description_de?: string | undefined;
  readonly tip_de?: string | undefined;
  readonly prep_minutes?: number | undefined;
  readonly cook_minutes?: number | undefined;
  readonly total_minutes?: number | undefined;
  readonly equipment_de?: readonly string[] | undefined;
}

/**
 * Fingerabdruck über `IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS` – kanonisches JSON (sortierte Schlüssel, ohne
 * `undefined`), zweimal FNV-1a (32 Bit, `stableHash`) → 16 Hex-Zeichen. Rein und ohne Node-Module, damit App, Admin
 * und CI dasselbe rechnen. Erkennt jede Änderung an diesen Feldern nach der Bestätigung; gegen bewusstes Fälschen
 * schützt er nicht (dafür gibt es den Pull Request mit menschlichem Merge).
 */
export function importAssumptionsFingerprint(recipe: ImportAssumptionsSubject): string {
  const text = canonicalJson(
    Object.fromEntries(IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS.map((key) => [key, recipe[key]])),
  );
  const hex = (value: number) => value.toString(16).padStart(8, '0');
  return `${hex(stableHash(text))}${hex(stableHash(`${text.length}|${text}`))}`;
}

/** Felder von `meta`, die über den Stand der Import-Annahmen entscheiden. */
export type ImportAssumptionsMeta = Pick<
  RecipeMeta,
  'import_assumptions' | 'import_assumptions_confirmed_by' | 'import_assumptions_fingerprint'
>;

/**
 * Stand der Import-Annahmen eines Rezepts:
 * - `none` – keine Annahmen,
 * - `open` – noch niemand hat bestätigt,
 * - `changed` – bestätigt, aber die Zubereitung (`IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS`) passt nicht mehr zum
 *   Fingerabdruck (oder er fehlt),
 * - `confirmed` – bestätigt, Fingerabdruck passt.
 */
export type ImportAssumptionsState = 'none' | 'open' | 'changed' | 'confirmed';

export function importAssumptionsState(
  recipe: ImportAssumptionsSubject & { readonly meta?: ImportAssumptionsMeta | undefined },
): ImportAssumptionsState {
  const meta = recipe.meta;
  if ((meta?.import_assumptions?.length ?? 0) === 0) {
    return 'none';
  }
  if (
    meta?.import_assumptions_confirmed_by === undefined ||
    meta.import_assumptions_confirmed_by === null
  ) {
    return 'open';
  }
  return meta.import_assumptions_fingerprint === importAssumptionsFingerprint(recipe)
    ? 'confirmed'
    : 'changed';
}

/**
 * true = Rezept hat Import-Annahmen, die nicht (mehr) gültig bestätigt sind: nie bestätigt, oder Fingerabdruck
 * fehlt bzw. passt nicht mehr (nach der Bestätigung geändert). Dann zählen die Annahmen für die Schwangerschaft wie
 * `heated: false` (R13) und ein freigegebenes Rezept ist rot (R1); die Sammelfreigabe überspringt es (19.5).
 */
export function hasUnconfirmedImportAssumptions(
  recipe: ImportAssumptionsSubject & { readonly meta?: ImportAssumptionsMeta | undefined },
): boolean {
  const state = importAssumptionsState(recipe);
  return state === 'open' || state === 'changed';
}
