import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, SUPPLEMENT_CONTENT_LIMITS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { SUPPLEMENT_IDS, type SupplementId } from '../supplement-ids';
import { contentMetaSchema } from './schemas';

/**
 * Supplement-Inhalte `content/supplements/<id>.json` (docs/PLAN-PHASE-6.md Abschnitt 6, Etappe SU2).
 *
 * Ein Eintrag ist ein lesbarer Text zu einem Supplement: Name, Kurzbeschreibung, Anwendung (mit Platzhaltern),
 * zugelassene Angaben (nur IDs aus `APPROVED_CLAIMS`), Quellen und – nur bei Stufe C – der Grund, warum wir es nicht
 * empfehlen. NICHT im Inhalt: Dosis, Gegenanzeigen, Zeitpunkte, Pflichthinweise – die stehen im Core (eine Wahrheit,
 * getestet). Regel SK1 (Schema, rot, immer blockierend); SK2–SK7 in `supplement-checks.ts`.
 */

/** Evidenz-Stufen (Plan 3.1). Koffein hat KEINE Stufe (`null`, Plan 3.5, B2.3). */
export const SUPPLEMENT_EVIDENCE_LEVELS = ['a', 'b', 'c'] as const;
export type SupplementEvidenceLevel = (typeof SUPPLEMENT_EVIDENCE_LEVELS)[number];

/** Kategorien (Plan 3.2, 7.1 – gleiche Werte wie die spätere Datenbank-Aufzählung `supplement_category`). */
export const SUPPLEMENT_CONTENT_CATEGORIES = [
  'sport',
  'food',
  'diet_season',
  'safety_info',
] as const;
export type SupplementContentCategory = (typeof SUPPLEMENT_CONTENT_CATEGORIES)[number];

/**
 * Einträge der Liste „Nicht empfohlen“ (Plan 3.2, Stufe C) mit ihrer Kategorie. Bewusst NICHT in
 * `supplement-ids.ts`: Das ist das Blatt, das Empfehlung und Affiliate-Modul (SU5) gemeinsam nutzen; dort stehen nur
 * Supplemente, die eingeordnet werden. Diese Stoffe bekommen nie eine Einordnung, nie eine Dosis und nie einen
 * Shop-Link. Technisch erzwungen ist das erst mit dem Strukturtest in SU5 (vorgemerkt: keine ID aus dieser Liste und
 * kein Koffein in der Affiliate-Konfiguration). Natriumbicarbonat fehlt (offene Gründer-Entscheidung, Plan 17).
 */
export const NOT_RECOMMENDED_SUPPLEMENTS = {
  bcaa: 'sport',
  glutamine: 'sport',
  l_carnitine: 'sport',
  cla: 'sport',
  fat_burner: 'sport',
  testo_booster: 'sport',
  pre_workout: 'sport',
  hmb: 'sport',
  ashwagandha: 'sport',
  collagen: 'food',
  multivitamin: 'diet_season',
  iron: 'diet_season',
  melatonin: 'sport',
} as const satisfies Record<string, Exclude<SupplementContentCategory, 'safety_info'>>;

export type NotRecommendedSupplementId = keyof typeof NOT_RECOMMENDED_SUPPLEMENTS;

export const NOT_RECOMMENDED_SUPPLEMENT_IDS = Object.keys(
  NOT_RECOMMENDED_SUPPLEMENTS,
) as readonly NotRecommendedSupplementId[];

/** Alle bekannten IDs von Supplement-Inhalten (Regel SK2): die fünf aus `SUPPLEMENT_IDS` und die Liste „Nicht empfohlen“. */
export const SUPPLEMENT_CONTENT_IDS: readonly (SupplementId | NotRecommendedSupplementId)[] = [
  ...SUPPLEMENT_IDS,
  ...NOT_RECOMMENDED_SUPPLEMENT_IDS,
];

/** true = ID steht in `SUPPLEMENT_IDS` (eingeordnete Supplemente und Koffein). */
export function isSupplementId(id: string): id is SupplementId {
  return (SUPPLEMENT_IDS as readonly string[]).includes(id);
}

/** true = ID steht in der Liste „Nicht empfohlen“. */
export function isNotRecommendedSupplementId(id: string): id is NotRecommendedSupplementId {
  return (NOT_RECOMMENDED_SUPPLEMENT_IDS as readonly string[]).includes(id);
}

const { textMaxChars, sourceYear, maxSources, maxClaims } = SUPPLEMENT_CONTENT_LIMITS;

/**
 * Unsichtbare Steuer- und Formatzeichen (z. B. weiches Trennzeichen, Nullbreiten-Leerzeichen) würden die Textregeln
 * umgehen („ver\u00ADbessert“) – abgelehnt, nur der Zeilenumbruch ist erlaubt (Wächter SU2 M2).
 */
const INVISIBLE_CHARACTER = /(?!\n)[\p{Cf}\p{Cc}]/u;
/** Nur lateinische Schrift plus gemeinsame Zeichen (Ziffern, Satzzeichen, µ) – kein kyrillisches „о“ in „bооst“. */
const FOREIGN_SCRIPT = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.')
    .refine(
      (value) => !INVISIBLE_CHARACTER.test(value),
      'Unsichtbares Steuer- oder Formatzeichen (z. B. weiches Trennzeichen) – bitte entfernen.',
    )
    .refine(
      (value) => !FOREIGN_SCRIPT.test(value),
      'Zeichen aus einer anderen Schrift (z. B. kyrillisch) – nur lateinische Buchstaben.',
    );
}

/**
 * ID eines Supplement-Inhalts = Dateiname ohne `.json`. Format wie `SUPPLEMENT_IDS` (Kleinbuchstaben, Ziffern,
 * Unterstrich); Bindestrich erlaubt für Probelauf-Entwürfe (`probelauf-…`). Ob die ID bekannt ist, prüft SK2.
 */
export const supplementContentIdSchema = z
  .string()
  .min(3, 'ID: mindestens 3 Zeichen.')
  .max(60, 'ID: höchstens 60 Zeichen.')
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    'ID: nur Kleinbuchstaben, Ziffern, Unterstrich oder Bindestrich (z. B. „protein_powder“).',
  );

/** DOI ohne Präfix „https://doi.org/“, z. B. `10.1186/s12970-017-0173-z`. */
export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
/** PubMed-ID: nur Ziffern, ohne führende Null. */
export const PMID_PATTERN = /^[1-9]\d{0,8}$/;

/** Quelle (Plan 6: Autor, Jahr, Titel, Zeitschrift, DOI oder PMID – Pflicht „DOI oder PMID“ prüft SK6). */
export const supplementSourceSchema = z.strictObject({
  /** Autorinnen und Autoren bzw. Herausgeber, z. B. „Kreider RB, Kalman DS, Antonio J et al.“ oder „EFSA NDA Panel“. */
  authors: text(2, 300),
  year: z.number().int('Ganze Zahl erwartet.').min(sourceYear.min).max(sourceYear.max),
  title: text(5, 400),
  /** Zeitschrift mit Band/Seiten, z. B. „J Int Soc Sports Nutr 14:18“. */
  journal: text(2, 200),
  doi: z
    .string()
    .regex(DOI_PATTERN, 'DOI im Format „10.xxxx/…“ (ohne https://doi.org/).')
    .nullable(),
  pmid: z.string().regex(PMID_PATTERN, 'PMID: nur Ziffern.').nullable(),
});
export type SupplementSource = z.infer<typeof supplementSourceSchema>;

/** ID einer Angabe (ob sie in `APPROVED_CLAIMS` steht und passt, prüft SK4). */
const claimIdSchema = z.string().regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, 'Angaben-ID im Format „a_b“.');

export const supplementContentSchema = z
  .strictObject({
    id: supplementContentIdSchema,
    version: z
      .number()
      .int('Ganze Zahl erwartet.')
      .min(CONTENT_SCHEMA_LIMITS.version.min)
      .max(CONTENT_SCHEMA_LIMITS.version.max),
    status: z.enum(CONTENT_STATUSES),
    name_de: text(2, 80),
    /** `null` nur bei Koffein (SK7). */
    evidence_level: z.enum(SUPPLEMENT_EVIDENCE_LEVELS).nullable(),
    category: z.enum(SUPPLEMENT_CONTENT_CATEGORIES),
    /** 2–3 Sätze: was es ist (keine Wirkung, keine Dosis-Zahlen). */
    summary_de: text(20, textMaxChars),
    /** Anwendung mit Platzhaltern (`{dose}` …); `null` bei Stufe C (SK7). */
    how_to_de: text(10, textMaxChars).nullable(),
    claim_ids: z
      .array(claimIdSchema)
      .max(maxClaims)
      .refine((ids) => new Set(ids).size === ids.length, 'Doppelte Angaben.'),
    sources: z.array(supplementSourceSchema).max(maxSources),
    /** Nur bei Stufe C (SK7). */
    not_recommended_reason_de: text(10, textMaxChars).nullable(),
    meta: contentMetaSchema,
  })
  .superRefine((entry, ctx) => {
    if (entry.status === 'published' && entry.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type SupplementContent = z.infer<typeof supplementContentSchema>;
