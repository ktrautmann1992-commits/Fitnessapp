import { z } from 'zod';

import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Herkunftsangaben importierter Inhalte (docs/PLAN-PHASE-5.md 19.2, Etappe N2c): Rezepte, Meal-Prep-Pläne und
 * Ratgeber aus der Gründer-Datei `alpha5-rezepte.json` tragen zusätzlich
 * - `source_file` – Datei und Fassung, z. B. `alpha5-rezepte.json@1.0`,
 * - `import_hash` – SHA-256 der Import-Ausgabe (ohne `import_hash`). Ein erneuter Import überschreibt einen Entwurf
 *   nur, wenn sein Inhalt noch genau dieser Ausgabe entspricht (menschliche Korrekturen bleiben, S5),
 * - bei Rezepten `import_assumptions` (z. B. „Zutat wird erhitzt“) und `import_assumptions_confirmed_by` – bestätigt
 *   werden die Annahmen bei der Freigabe (Plan 19.5, S4).
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
  })
  .superRefine(refineBaseMeta);
export type RecipeMeta = z.infer<typeof recipeMetaSchema>;

/** true = Rezept hat Import-Annahmen, die noch niemand bestätigt hat (Sammelfreigabe überspringt es, 19.5). */
export function hasUnconfirmedImportAssumptions(meta: RecipeMeta): boolean {
  return (
    (meta.import_assumptions?.length ?? 0) > 0 &&
    (meta.import_assumptions_confirmed_by === undefined ||
      meta.import_assumptions_confirmed_by === null)
  );
}
