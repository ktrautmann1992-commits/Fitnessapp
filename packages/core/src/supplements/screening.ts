import { z } from 'zod';

import type { Sex } from '../enums';

/**
 * Supplement-Check (docs/PLAN-PHASE-6.md Abschnitt 3.4, SU-G2): vier kurze Zusatzfragen zum Gesundheits-Check, ja/nein,
 * nur mit Einwilligung `health_data` v2 (SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION). Gestellt beim ersten Öffnen des
 * Moduls, nicht im Onboarding. Das Ergebnis ist KEINE Diagnose – es blendet nur Empfehlungen, Dosis und Shop-Links aus.
 * Optional dazu die Eiweiß-Selbsteinschätzung (Plan 3.7, Wächter S7).
 */

/**
 * Flags in fester Reihenfolge – gleiche Liste wie die Datenbank-Aufzählung `supplement_flag` (SU3). Die Datenbank wird
 * sie beim Speichern selbst nach denselben Regeln berechnen (Trigger, Abgleich in db-sync.test.ts ab SU3).
 */
export const SUPPLEMENT_FLAGS = [
  'kidney',
  'breastfeeding',
  'heart_rhythm',
  'caffeine_sensitive',
] as const;
export type SupplementFlag = (typeof SUPPLEMENT_FLAGS)[number];

export interface SupplementScreeningQuestion {
  readonly id: SupplementFlag;
  readonly textDe: string;
  readonly flag: SupplementFlag;
}

export const SUPPLEMENT_SCREENING_QUESTIONS = [
  {
    id: 'kidney',
    textDe: 'Hat dir eine Ärztin oder ein Arzt gesagt, dass deine Nieren nicht richtig arbeiten?',
    flag: 'kidney',
  },
  {
    id: 'breastfeeding',
    textDe: 'Stillst du gerade?',
    flag: 'breastfeeding',
  },
  {
    id: 'heart_rhythm',
    textDe: 'Hast du Herzrhythmusstörungen oder oft Herzrasen ohne Anstrengung?',
    flag: 'heart_rhythm',
  },
  {
    id: 'caffeine_sensitive',
    textDe:
      'Reagierst du empfindlich auf Kaffee (Unruhe, Herzklopfen) oder schläfst du oft schlecht?',
    flag: 'caffeine_sensitive',
  },
] as const satisfies readonly SupplementScreeningQuestion[];

/** Eiweiß-Selbsteinschätzung „Schaffst du dein Eiweißziel meist über das Essen?“ (Plan 3.7). */
export const PROTEIN_SELF_CHECK_ANSWERS = ['mostly_yes', 'rather_not'] as const;
export type ProteinSelfCheckAnswer = (typeof PROTEIN_SELF_CHECK_ANSWERS)[number];

export const PROTEIN_SELF_CHECK_QUESTION_DE = 'Schaffst du dein Eiweißziel meist über das Essen?';

const answer = z.boolean({ error: 'Bitte mit Ja oder Nein antworten.' });

/**
 * Antworten als { frage_id: true/false } – so werden sie in `supplement_screening.answers` gespeichert (SU3).
 * Strikt (keine weiteren Schlüssel). Die Stillzeit-Frage wird bei „männlich“ nicht gestellt und ist daher optional;
 * die passende Prüfung je Geschlecht macht `createSupplementScreeningAnswersSchema`.
 */
export const supplementScreeningAnswersSchema = z.strictObject({
  kidney: answer,
  breastfeeding: answer.optional(),
  heart_rhythm: answer,
  caffeine_sensitive: answer,
  protein_self_check: z
    .enum(PROTEIN_SELF_CHECK_ANSWERS, { error: 'Bitte eine Antwort wählen.' })
    .optional(),
});

export type SupplementScreeningAnswers = z.infer<typeof supplementScreeningAnswersSchema>;

/** Fragen, die bei diesem Geschlecht gestellt werden (Stillzeit nicht bei „männlich“). */
export function supplementScreeningQuestionsFor(
  sex: Sex | null | undefined,
): readonly SupplementScreeningQuestion[] {
  if (sex === 'male') {
    return SUPPLEMENT_SCREENING_QUESTIONS.filter((question) => question.id !== 'breastfeeding');
  }
  return SUPPLEMENT_SCREENING_QUESTIONS;
}

/**
 * Prüft die Antworten passend zum Geschlecht (wie beim Gesundheits-Check die Schwangerschafts-Frage): Bei „weiblich“,
 * „divers“ und „keine Angabe“ ist die Stillzeit-Frage Pflicht, bei „männlich“ darf sie nicht beantwortet sein.
 */
export function createSupplementScreeningAnswersSchema(sex: Sex | null | undefined) {
  return supplementScreeningAnswersSchema.superRefine((answers, ctx) => {
    if (sex === 'male' && answers.breastfeeding !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['breastfeeding'],
        message: 'Diese Frage wird nicht gestellt.',
      });
    }
    if (sex !== 'male' && answers.breastfeeding === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['breastfeeding'],
        message: 'Bitte mit Ja oder Nein antworten.',
      });
    }
  });
}

/**
 * Flags aus den Antworten: je Frage mit „ja“ das gleichnamige Flag. Ergebnis in der Reihenfolge von SUPPLEMENT_FLAGS,
 * ohne Doppelungen. Die Eiweiß-Selbsteinschätzung setzt kein Flag (sie ist keine Gegenanzeige).
 */
export function evaluateSupplementScreening(answers: SupplementScreeningAnswers): SupplementFlag[] {
  const parsed = supplementScreeningAnswersSchema.parse(answers);
  return SUPPLEMENT_FLAGS.filter((flag) => parsed[flag] === true);
}
