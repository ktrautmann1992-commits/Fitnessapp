import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { importedContentMetaSchema } from './import-meta';
import { contentIdSchema } from './schemas';

/**
 * Ratgeber `content/guides/<id>.json` (docs/PLAN-PHASE-5.md 19.4, KONZEPT 6.8, Etappe N2c): lesbare Seiten, gratis
 * und offline („Wettkampf-Ernährung“, „Unterwegs essen“). Regel R1 (Schema) und R21 (Textregeln, Hinweis beim
 * Carb-Loading, Mengenangaben zur Fachprüfung).
 */

/**
 * Fester Hinweis beim Carb-Loading (Plan 19.4 R21, KONZEPT 6.8). Wortlaut verbindlich – jeder Abschnitt, der
 * Carb-Loading behandelt, trägt ihn in `notice_de`.
 */
export const CARB_LOADING_NOTICE_DE =
  'Im Kaloriendefizit, unter 18 Jahren oder in der Schwangerschaft nicht ohne fachliche Absprache.';

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

export const guideSectionSchema = z.strictObject({
  heading_de: text(2, 100),
  /** Absätze bzw. Aufzählungspunkte. */
  body_de: z.array(text(2, 800)).min(1).max(20),
  /** Fester Hinweis zum Abschnitt (z. B. beim Carb-Loading, R21). */
  notice_de: text(10, 300).optional(),
});
export type GuideSection = z.infer<typeof guideSectionSchema>;

/** Ort im Ratgeber „Unterwegs essen“ (z. B. „Beim Bäcker“). */
export const guidePlaceSchema = z.strictObject({
  name_de: text(2, 80),
  good_de: z.array(text(2, 200)).max(12),
  less_often_de: z.array(text(2, 200)).max(12),
  tip_de: text(5, 400).optional(),
});
export type GuidePlace = z.infer<typeof guidePlaceSchema>;

export const guideSchema = z
  .strictObject({
    id: contentIdSchema,
    version: z
      .number()
      .int('Ganze Zahl erwartet.')
      .min(CONTENT_SCHEMA_LIMITS.version.min)
      .max(CONTENT_SCHEMA_LIMITS.version.max),
    status: z.enum(CONTENT_STATUSES),
    title_de: text(3, 100),
    intro_de: text(10, 800).optional(),
    sections: z.array(guideSectionSchema).min(1).max(20),
    places: z.array(guidePlaceSchema).max(20).optional(),
    meta: importedContentMetaSchema,
  })
  .superRefine((guide, ctx) => {
    if (guide.status === 'published' && guide.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type Guide = z.infer<typeof guideSchema>;
