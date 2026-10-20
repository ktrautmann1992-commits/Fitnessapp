import { z } from 'zod';

import type { ContentStatus } from '../enums';
import { type ContentMeta, needsExpertReviewLabel } from './schemas';

/**
 * Einspiel-Regel für Ernährungs-Inhalte (Gründer-Entscheidung 19.10.2026, docs/PLAN-PHASE-5.md „Nachtrag Testphase“).
 *
 * Eine Datei im Repository – `content/einspiel-regeln.json` – sagt `content-seed`, ob nur fachlich geprüfte Ernährungs-
 * Inhalte (`meta.expert_reviewed = true`, Gründer-Entscheidung 6) in die Datenbank kommen:
 * - `"nur_fachlich_geprueft": true` = Livegang-Regel (auch, wenn die Datei fehlt – sichere Richtung).
 * - `"nur_fachlich_geprueft": false` = Testphase: freigegebene (`published`) Lebensmittel, Rezepte, Austausch-Einträge,
 *   Meal-Prep-Pläne und Ratgeber kommen auch ohne Fachprüfung in die Datenbank; die App kennzeichnet sie
 *   „Testphase – noch nicht fachlich geprüft“.
 * Unverändert in BEIDEN Fällen: nur `published`, Katalog-Prüfung der Lebensmittel (R19), Prüfvermerk der
 * Packungsgrößen, alle Prüfregeln (`content:validate`), Schutz vor Massen-Archivierung, Nährwerte nur aus der Quelle.
 * Warum eine Datei und keine GitHub-Variable: Änderung nur per Pull Request (sichtbar, mit Prüfung und Merge), gilt für
 * jeden automatischen und manuellen Lauf gleich und startet `content-seed` nach dem Merge von selbst.
 */
export const CONTENT_SEED_SETTINGS_FILE = 'einspiel-regeln.json';

export const contentSeedSettingsSchema = z.strictObject({
  nur_fachlich_geprueft: z.boolean(),
  /** Freitext für Menschen (warum gerade diese Regel gilt). */
  grund: z.string().min(1, 'Mindestens 1 Zeichen.').max(1000, 'Höchstens 1000 Zeichen.').optional(),
});
export type ContentSeedSettings = z.infer<typeof contentSeedSettingsSchema>;

/** Livegang-Regel – gilt, wenn die Datei fehlt. */
export const STRICT_CONTENT_SEED_SETTINGS: ContentSeedSettings = { nur_fachlich_geprueft: true };

/**
 * Liest den Inhalt der Datei (`undefined` = Datei fehlt → Livegang-Regel). Ungültiges JSON bzw. Schema → Fehlertexte
 * (blockierend in `content:validate`) und ebenfalls die Livegang-Regel.
 */
export function parseContentSeedSettings(text: string | undefined): {
  settings: ContentSeedSettings;
  problems: string[];
} {
  if (text === undefined) {
    return { settings: STRICT_CONTENT_SEED_SETTINGS, problems: [] };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      settings: STRICT_CONTENT_SEED_SETTINGS,
      problems: [`${CONTENT_SEED_SETTINGS_FILE}: kein gültiges JSON (${(error as Error).message})`],
    };
  }
  const parsed = contentSeedSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      settings: STRICT_CONTENT_SEED_SETTINGS,
      problems: parsed.error.issues.map(
        (issue) =>
          `${CONTENT_SEED_SETTINGS_FILE}: ${issue.path.join('.') || '(Datei)'} – ${issue.message} ` +
          '(erlaubt: "nur_fachlich_geprueft": true oder false, optional "grund")',
      ),
    };
  }
  return { settings: parsed.data, problems: [] };
}

/** true = freigegeben, aber (noch) nicht fachlich geprüft – nur in der Testphase in der Datenbank. */
export function isPublishedWithoutExpertReview(content: {
  readonly status: ContentStatus;
  readonly meta: Pick<ContentMeta, 'expert_reviewed'>;
}): boolean {
  return content.status === 'published' && !content.meta.expert_reviewed;
}

/**
 * Kennzeichen eines Ernährungs-Inhalts in der App (Rezeptansicht, Ratgeber, Suche):
 * - `testphase`: freigegeben, nicht fachlich geprüft → „Testphase – noch nicht fachlich geprüft“,
 * - `ai_draft`: KI-Entwurf (nicht freigegeben) ohne Fachprüfung → „KI-Entwurf – fachlich prüfen“,
 * - `draft`: anderer Entwurf (nur Testmodus),
 * - null: fachlich geprüft und freigegeben (bzw. zurückgezogen) – kein Kennzeichen.
 * Allergen-Warnungen für Entwürfe sind davon unabhängig und bleiben unverändert.
 */
export type ContentReviewMark = 'testphase' | 'ai_draft' | 'draft' | null;

export function contentReviewMark(content: {
  readonly status: ContentStatus;
  readonly meta: ContentMeta;
}): ContentReviewMark {
  if (isPublishedWithoutExpertReview(content)) return 'testphase';
  if (needsExpertReviewLabel(content.meta)) return content.status === 'draft' ? 'ai_draft' : null;
  return content.status === 'draft' ? 'draft' : null;
}
