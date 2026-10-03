import { z } from 'zod';

import type { Sex } from './enums';

/**
 * Gesundheits-Check im Onboarding (docs/PLAN-PHASE-1.md Abschnitt 7).
 * Fragen angelehnt an den PAR-Q („Physical Activity Readiness Questionnaire“, Canadian Society for Exercise
 * Physiology) und PAR-Q+ (Warburton DER et al., 2011), in einfacher Sprache, Antworten ja/nein.
 * Das Ergebnis ist KEINE Diagnose – es steuert nur Hinweise und vorsichtigere Pläne.
 */

/**
 * Flags in fester Reihenfolge. Identisch mit der CHECK-Liste von health_screening.flags in der Datenbank.
 * Die Datenbank berechnet die Flags beim Speichern selbst nach denselben Regeln (Trigger
 * private.health_screening_before_insert, abgeglichen in db-sync.test.ts) – die App nutzt
 * evaluateHealthScreening() für die sofortige Anzeige des Arzt-Hinweises.
 */
export const HEALTH_FLAGS = [
  'medical_clearance_recommended',
  'pregnancy',
  'injury',
  'medication',
  'conservative_plan',
] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];

/** Flag, das eine Frage bei „ja“ auslöst (conservative_plan folgt automatisch aus jedem Flag). */
type TriggeredFlag = Exclude<HealthFlag, 'conservative_plan'>;

export interface HealthScreeningQuestion {
  readonly id: string;
  readonly textDe: string;
  readonly flag: TriggeredFlag;
}

export const HEALTH_SCREENING_QUESTIONS = [
  {
    id: 'heart_condition',
    textDe:
      'Hat dir eine Ärztin oder ein Arzt jemals gesagt, dass du eine Herzerkrankung hast oder nur unter ärztlicher Aufsicht Sport treiben solltest?',
    flag: 'medical_clearance_recommended',
  },
  {
    id: 'chest_pain_exercise',
    textDe:
      'Hast du Schmerzen oder ein Druckgefühl in der Brust, wenn du dich körperlich anstrengst?',
    flag: 'medical_clearance_recommended',
  },
  {
    id: 'chest_pain_rest',
    textDe:
      'Hattest du im letzten Monat Schmerzen in der Brust, ohne dass du dich angestrengt hast?',
    flag: 'medical_clearance_recommended',
  },
  {
    id: 'dizziness',
    textDe:
      'Verlierst du wegen Schwindel das Gleichgewicht oder bist du schon einmal ohne erkennbaren Grund ohnmächtig geworden?',
    flag: 'medical_clearance_recommended',
  },
  {
    id: 'blood_pressure',
    textDe: 'Hast du Bluthochdruck oder nimmst du Medikamente für Blutdruck oder Herz?',
    flag: 'medical_clearance_recommended',
  },
  {
    id: 'bone_joint',
    textDe:
      'Hast du Probleme mit Knochen, Gelenken oder Rücken oder eine Verletzung, die sich durch mehr Bewegung verschlimmern könnte?',
    flag: 'injury',
  },
  {
    id: 'pregnancy',
    textDe: 'Bist du schwanger oder hast du in den letzten 6 Monaten ein Kind geboren?',
    flag: 'pregnancy',
  },
  {
    id: 'medication',
    textDe:
      'Nimmst du regelmäßig Medikamente (z. B. gegen Bluthochdruck, Herzbeschwerden, Diabetes oder Asthma)?',
    flag: 'medication',
  },
  {
    id: 'other_reason',
    textDe: 'Gibt es einen anderen Grund, warum du nur eingeschränkt Sport treiben solltest?',
    flag: 'medical_clearance_recommended',
  },
] as const satisfies readonly HealthScreeningQuestion[];

export type HealthScreeningQuestionId = (typeof HEALTH_SCREENING_QUESTIONS)[number]['id'];

const answer = z.boolean({ error: 'Bitte mit Ja oder Nein antworten.' });

/**
 * Antworten als { frage_id: true/false } – so werden sie auch in health_screening.answers gespeichert.
 * Die Schwangerschafts-Frage wird bei „männlich“ nicht gestellt und ist daher optional.
 */
export const healthScreeningAnswersSchema = z.strictObject({
  heart_condition: answer,
  chest_pain_exercise: answer,
  chest_pain_rest: answer,
  dizziness: answer,
  blood_pressure: answer,
  bone_joint: answer,
  pregnancy: answer.optional(),
  medication: answer,
  other_reason: answer,
});

export type HealthScreeningAnswers = z.infer<typeof healthScreeningAnswersSchema>;

/** Fragen, die bei diesem Geschlecht gestellt werden (Schwangerschaft nicht bei „männlich“). */
export function screeningQuestionsFor(
  sex: Sex | null | undefined,
): readonly HealthScreeningQuestion[] {
  if (sex === 'male') {
    return HEALTH_SCREENING_QUESTIONS.filter((question) => question.id !== 'pregnancy');
  }
  return HEALTH_SCREENING_QUESTIONS;
}

/**
 * Prüft die Antworten passend zum Geschlecht: Bei „weiblich“, „divers“ und „keine Angabe“ ist die
 * Schwangerschafts-Frage Pflicht, bei „männlich“ wird sie nicht gestellt und darf nicht beantwortet sein.
 */
export function createHealthScreeningAnswersSchema(sex: Sex | null | undefined) {
  return healthScreeningAnswersSchema.superRefine((answers, ctx) => {
    if (sex === 'male' && answers.pregnancy !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['pregnancy'],
        message: 'Diese Frage wird nicht gestellt.',
      });
    }
    if (sex !== 'male' && answers.pregnancy === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['pregnancy'],
        message: 'Bitte mit Ja oder Nein antworten.',
      });
    }
  });
}

/**
 * Berechnet die Flags aus den Antworten (Plan Abschnitt 7):
 * - medical_clearance_recommended: mindestens eine Herz-Kreislauf-Frage oder „anderer Grund“ mit „ja“
 * - pregnancy, injury, medication: jeweilige Frage mit „ja“
 * - conservative_plan: sobald irgendein Flag oben gesetzt ist
 * Ergebnis in der Reihenfolge von HEALTH_FLAGS, ohne Doppelungen.
 */
export function evaluateHealthScreening(answers: HealthScreeningAnswers): HealthFlag[] {
  const parsed = healthScreeningAnswersSchema.parse(answers);
  const triggered = new Set<HealthFlag>();
  for (const question of HEALTH_SCREENING_QUESTIONS) {
    if (parsed[question.id] === true) {
      triggered.add(question.flag);
    }
  }
  if (triggered.size > 0) {
    triggered.add('conservative_plan');
  }
  return HEALTH_FLAGS.filter((flag) => triggered.has(flag));
}

/**
 * Muss der Hinweis „Bitte vor dem Start ärztlich abklären“ angezeigt und bestätigt werden?
 * Ja, sobald irgendein Flag gesetzt ist (Plan Abschnitt 7.3). Nach Bestätigung geht es weiter (Frage 5).
 */
export function requiresMedicalNotice(flags: readonly HealthFlag[]): boolean {
  return flags.length > 0;
}
