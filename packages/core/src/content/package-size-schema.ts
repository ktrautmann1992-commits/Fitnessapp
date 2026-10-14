import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, PACKAGE_SIZE_LIMITS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { stableHash } from '../nutrition/stable-hash';
import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Packungsgrößen `content/package-sizes/<id>.json` (docs/PLAN-PHASE-5.md 19.4 „Packungsgrößen (N11)“, 19.7 N11,
 * KONZEPT 6.11) – Regel R1 (Schema, Plausibilität 1–5.000 g) und R24 (`package-size-checks.ts`). Ein Eintrag sagt:
 * Das Lebensmittel `food_id` gibt es üblicherweise in Packungen zu `package_size_g` Gramm (Handelsgröße, z. B.
 * Brokkoli 500 g, Quark 500 g).
 *
 * Eigene Inhaltsart statt Feld in `content/foods/` (Präzisierung N11): `content/foods/` schreibt ausschließlich der
 * Workflow `foods-import` (S3, Herkunftsprüfung `sources-integrity`) – ein Batch-Vorschlag dort würde die Herkunfts-
 * prüfung brechen. Die Freigabe (`status`, `meta.reviewed_by/at`) entspricht dem geplanten
 * `meta.package_size_reviewed_*`; in N7 wird daraus die Spalte `foods.package_size_g` (nur freigegebene Einträge).
 *
 * Entsteht offline über die Content-Pipeline (Batch-Art `package-sizes`, nur Katalog-IDs) als `draft` und wird über
 * `content-review` (Art „ids“) freigegeben – keine Echtzeit-KI. Genutzt wird die Packungsgröße erst von der
 * Resteplanung (N13/N14); sie ändert nie Filter, Mengen im Essensplan oder Grenzen.
 */

const L = PACKAGE_SIZE_LIMITS;

/** Packungsgröße in Gramm (ganze Gramm, Plausibilität 1–5.000 g, Plan 19.7 N11). */
export const packageSizeGramsSchema = z
  .number()
  .int('Ganze Gramm erwartet.')
  .min(L.grams.min, `Packungsgröße mindestens ${L.grams.min} g.`)
  .max(L.grams.max, `Packungsgröße höchstens ${L.grams.max.toLocaleString('de-DE')} g.`);

export const packageSizeSchema = z.strictObject({
  id: contentIdSchema,
  version: z
    .number()
    .int('Ganze Zahl erwartet.')
    .min(CONTENT_SCHEMA_LIMITS.version.min)
    .max(CONTENT_SCHEMA_LIMITS.version.max),
  status: z.enum(CONTENT_STATUSES),
  /** Lebensmittel (Katalog-ID). */
  food_id: contentIdSchema,
  /** Übliche Packungsgröße in Gramm. */
  package_size_g: packageSizeGramsSchema,
  meta: contentMetaSchema,
});
export type PackageSize = z.infer<typeof packageSizeSchema>;

/**
 * Feste ID eines Eintrags: `packung-<lebensmittel>`; zu lang (> 80 Zeichen) → `packung-<16 Hex>`. So gibt es je
 * Lebensmittel genau eine Datei (doppelte Lebensmittel meldet R24 zusätzlich).
 */
export function packageSizeContentId(foodId: string): string {
  const plain = `packung-${foodId}`;
  if (plain.length <= 80) return plain;
  const hex = (value: number) => value.toString(16).padStart(8, '0');
  return `packung-${hex(stableHash(foodId))}${hex(stableHash(`${foodId.length}|${foodId}`))}`;
}
