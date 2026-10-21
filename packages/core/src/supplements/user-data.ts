import { z } from 'zod';

import { SUPPLEMENT_SCREENING_VERSION } from '../constants';
import { RATED_SUPPLEMENT_IDS, type RatedSupplementId } from '../supplement-ids';
import type { RatedSupplementResult, SupplementRecommendations } from './eligibility';
import { supplementScheduleAllowed } from './schedule';
import { SUPPLEMENT_FLAGS, supplementScreeningAnswersSchema } from './screening';

/**
 * Gespeicherte Nutzerdaten des Supplement-Moduls (docs/PLAN-PHASE-6.md 7.2, Etappe SU3/SU4): Supplement-Check und
 * „Meine Supplements“. Beides sind Gesundheitsdaten (Art. 9 DSGVO, Plan 11.2) – nur mit Einwilligung `health_data`
 * Fassung 2, Löschung beim Widerruf, im Export, nie in Logs. Die Datenbank (Tabellen `supplement_screening`,
 * `user_supplements`) und der Testmodus nutzen dieselben Schemas (Zod an der Grenze).
 */

/** „Meine Supplements“ (SU-G8): „Nehme ich“ bzw. „Nicht für mich“ – gleiche Werte wie `user_supplement_status`. */
export const USER_SUPPLEMENT_STATUSES = ['taking', 'not_for_me'] as const;
export type UserSupplementStatus = (typeof USER_SUPPLEMENT_STATUSES)[number];

/** Eine Auswahl unter „Meine Supplements“. Koffein ist nie wählbar (nur Sicherheits-Info, B2.3). */
export const userSupplementChoiceSchema = z.strictObject({
  supplementId: z.enum(RATED_SUPPLEMENT_IDS),
  status: z.enum(USER_SUPPLEMENT_STATUSES),
});
export type UserSupplementChoice = z.infer<typeof userSupplementChoiceSchema>;

/** Gespeicherter Supplement-Check (eine Zeile je Person; Flags berechnet der Speicherort selbst). */
export const storedSupplementScreeningSchema = z.strictObject({
  answers: supplementScreeningAnswersSchema,
  flags: z
    .array(z.enum(SUPPLEMENT_FLAGS))
    .refine((flags) => new Set(flags).size === flags.length, { message: 'Flag doppelt.' }),
  /** Fassung der Fragen (SUPPLEMENT_SCREENING_VERSION). */
  version: z.number().int().min(1),
  updatedAt: z.string().min(1),
});
export type StoredSupplementScreening = z.infer<typeof storedSupplementScreeningSchema>;

/** Alle Nutzerdaten des Moduls für die Anzeige. */
export interface SupplementUserData {
  readonly screening: StoredSupplementScreening | null;
  readonly choices: readonly UserSupplementChoice[];
}

export const EMPTY_SUPPLEMENT_USER_DATA: SupplementUserData = { screening: null, choices: [] };

/**
 * Gilt der gespeicherte Check noch? Nur in der aktuellen Fassung der Fragen – ändern sich die Fragen
 * (SUPPLEMENT_SCREENING_VERSION hochgezählt), fragt die App erneut (bis dahin Info-Modus).
 */
export function isSupplementScreeningCurrent(screening: StoredSupplementScreening | null): boolean {
  return screening !== null && screening.version === SUPPLEMENT_SCREENING_VERSION;
}

/**
 * Darf „Nehme ich“ angeboten werden? Nur bei persönlicher Einordnung und wenn das Supplement im Zeitplan stehen darf
 * (`supplementScheduleAllowed`: „passt zu dir“ bzw. Vitamin D als Info) – nie bei „ab 18“ oder „Nicht für dich“.
 */
export function canChooseSupplement(
  recommendations: SupplementRecommendations,
  item: RatedSupplementResult,
): boolean {
  return recommendations.personalized && supplementScheduleAllowed(item);
}

/** Gespeicherte Auswahl zu einem Supplement (`null` = nichts gewählt). */
export function userSupplementStatus(
  choices: readonly UserSupplementChoice[],
  id: RatedSupplementId,
): UserSupplementStatus | null {
  return choices.find((choice) => choice.supplementId === id)?.status ?? null;
}

/**
 * „Nehme ich“, das nach den AKTUELLEN Regeln noch gilt (Reihenfolge RATED_SUPPLEMENT_IDS). Kommt ein Sperr-Flag hinzu,
 * fällt das Supplement hier sofort heraus (wie im Zeitplan) – gespeichert bleibt die Wahl trotzdem, bis die Person sie
 * ändert oder die Einwilligung widerruft.
 */
export function activeSupplementChoices(
  recommendations: SupplementRecommendations,
  choices: readonly UserSupplementChoice[],
): RatedSupplementId[] {
  return recommendations.items
    .filter(
      (item) =>
        userSupplementStatus(choices, item.id) === 'taking' &&
        canChooseSupplement(recommendations, item),
    )
    .map((item) => item.id);
}

/**
 * „Nehme ich“, das NICHT mehr passt (z. B. neues Sperr-Flag, unter 18, Einwilligung fehlt): die App zeigt dazu einen
 * Hinweis („Passt laut deinen aktuellen Angaben nicht mehr“).
 */
export function outdatedSupplementChoices(
  recommendations: SupplementRecommendations,
  choices: readonly UserSupplementChoice[],
): RatedSupplementId[] {
  return recommendations.items
    .filter(
      (item) =>
        userSupplementStatus(choices, item.id) === 'taking' &&
        !canChooseSupplement(recommendations, item),
    )
    .map((item) => item.id);
}
