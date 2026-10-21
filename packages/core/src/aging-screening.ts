import { z } from 'zod';

import { ageInYears } from './age';
import { AGING_SCREENING_RULES } from './constants';
import type { CautionTag, GoalType } from './enums';

/**
 * Zusatzfragen im Gesundheits-Check (docs/PLAN-FIT-IM-ALTER.md 8.2, Etappe FA1 Teil 2): Sturz, Unsicherheit,
 * Gehhilfe, OP, künstliches Hüftgelenk, Osteoporose, Blutverdünner. Antworten ja/nein, überspringbar. Ein „Ja“ führt
 * zu Arzt-Hinweis, vorsichtigem Plan oder gezielten Ausschlüssen – NIE zu einer Bewertung („Sturzrisiko“), keine
 * Diagnose (MDR-Abgrenzung, Plan 3.2). Die Antworten sind Gesundheitsdaten (Art. 9 DSGVO).
 * Speichern und Flag-Berechnung in der Datenbank folgen mit Etappe FA3; bis dahin nutzt nur der Core die Regeln.
 * Wortlaut: Entwurf, Fachprüfung ausstehend.
 */

export const AGING_FLAGS = [
  'fall_history',
  'fall_concern',
  'walking_aid',
  'recent_surgery',
  'hip_replacement',
  'bone_health',
  'anticoagulant',
] as const;
export type AgingFlag = (typeof AGING_FLAGS)[number];

export interface AgingScreeningQuestion {
  readonly id: AgingFlag;
  readonly textDe: string;
  /** „Ja“ macht den Plan vorsichtig (wie `conservative_plan`) – nur Sturz, Unsicherheit, Gehhilfe, OP (S4). */
  readonly conservative: boolean;
}

/** Fragen in fester Reihenfolge (Frage-ID = Flag). Entwurf – Wortlaut durch die Fachprüfung. */
export const AGING_SCREENING_QUESTIONS = [
  {
    id: 'fall_history',
    textDe: 'Bist du in den letzten 12 Monaten gestürzt?',
    conservative: true,
  },
  {
    id: 'fall_concern',
    textDe: 'Fühlst du dich beim Stehen oder Gehen unsicher oder hast du Angst zu stürzen?',
    conservative: true,
  },
  {
    id: 'walking_aid',
    textDe: 'Nutzt du beim Gehen einen Stock, Rollator oder eine andere Gehhilfe?',
    conservative: true,
  },
  {
    id: 'recent_surgery',
    textDe: 'Hattest du in den letzten 12 Monaten eine OP an Hüfte, Knie oder Rücken?',
    conservative: true,
  },
  {
    id: 'hip_replacement',
    textDe: 'Hast du ein künstliches Hüftgelenk?',
    conservative: false,
  },
  {
    id: 'bone_health',
    textDe: 'Hat dir eine Ärztin oder ein Arzt gesagt, dass du Osteoporose (Knochenschwund) hast?',
    conservative: false,
  },
  {
    id: 'anticoagulant',
    textDe: 'Nimmst du blutverdünnende Medikamente?',
    conservative: false,
  },
] as const satisfies readonly AgingScreeningQuestion[];

const answer = z.boolean({ error: 'Bitte mit Ja oder Nein antworten.' });

/** Antworten – jede Frage OPTIONAL (überspringbar, S10); fremde Schlüssel verboten. */
export const agingScreeningAnswersSchema = z.strictObject({
  fall_history: answer.optional(),
  fall_concern: answer.optional(),
  walking_aid: answer.optional(),
  recent_surgery: answer.optional(),
  hip_replacement: answer.optional(),
  bone_health: answer.optional(),
  anticoagulant: answer.optional(),
});
export type AgingScreeningAnswers = z.infer<typeof agingScreeningAnswersSchema>;

/**
 * Gespeicherter Stand: Fragebogen-Fassung, Antworten und NUR Monat/Jahr der Antwort (N5 – kein OP-Datum).
 * `answers` leer = übersprungen.
 */
export const agingScreeningRecordSchema = z.strictObject({
  questionnaireVersion: z.number().int().min(1).max(AGING_SCREENING_RULES.questionnaireVersion),
  answeredMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Monat im Format JJJJ-MM.'),
  answers: agingScreeningAnswersSchema,
});
export type AgingScreeningRecord = z.infer<typeof agingScreeningRecordSchema>;

/** Flags aus den Antworten (Reihenfolge wie AGING_FLAGS). Nicht beantwortete Fragen setzen kein Flag. */
export function evaluateAgingScreening(answers: AgingScreeningAnswers): AgingFlag[] {
  const parsed = agingScreeningAnswersSchema.parse(answers);
  return AGING_FLAGS.filter((flag) => parsed[flag] === true);
}

/** Wurde mindestens eine Frage übersprungen (nicht beantwortet)? */
export function isAgingScreeningIncomplete(answers: AgingScreeningAnswers): boolean {
  const parsed = agingScreeningAnswersSchema.parse(answers);
  return AGING_FLAGS.some((flag) => parsed[flag] === undefined);
}

/**
 * Werden die Zusatzfragen gestellt? Ab 60 bei JEDEM Ziel, mit dem Ziel „Fit im Alter“ immer (auch mit 55, auch beim
 * Zielwechsel). Unbekanntes Alter → nur beim Ziel.
 */
export function agingScreeningApplies(input: {
  readonly birthDate: string | null;
  readonly goalType: GoalType | null | undefined;
  readonly onDate: string;
}): boolean {
  if (input.goalType === 'active_aging') return true;
  if (input.birthDate === null || input.birthDate > input.onDate) return false;
  return ageInYears(input.birthDate, input.onDate) >= AGING_SCREENING_RULES.askFromAge;
}

/** Ganze Monate zwischen zwei Monaten im Format JJJJ-MM (b − a). */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number) as [number, number];
  const [by, bm] = b.split('-').map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
}

export type AgingScreeningStatus =
  /** Fragen gelten nicht für diese Person. */
  | 'not_applicable'
  /** Noch nie beantwortet bzw. ältere Fassung → Karte „Ein paar neue Fragen zu deiner Sicherheit“ (S4). */
  | 'ask'
  /** OP-Antwort „ja“ ist älter als 12 Monate → erneut fragen (N5). */
  | 'ask_again'
  | 'answered';

/** Muss die App die Zusatzfragen (erneut) stellen? `today` im Format JJJJ-MM-TT. */
export function agingScreeningStatus(
  record: AgingScreeningRecord | null,
  context: { readonly applies: boolean; readonly today: string },
): AgingScreeningStatus {
  if (!context.applies) return 'not_applicable';
  if (!record || record.questionnaireVersion < AGING_SCREENING_RULES.questionnaireVersion)
    return 'ask';
  if (
    record.answers.recent_surgery === true &&
    monthsBetween(record.answeredMonth, context.today.slice(0, 7)) >=
      AGING_SCREENING_RULES.recentSurgeryRecheckMonths
  ) {
    return 'ask_again';
  }
  return 'answered';
}

/** Halt bei Gleichgewichtsübungen: beidhändig festhalten bzw. Stuhl/Küchenzeile in Reichweite (Plan 8.1 Nr. 3). */
export type BalanceSupport = 'hold_on' | 'chair_nearby';

/** Höchste Stand-Stufe in den Selbsttests (Plan 10). */
export type StandStage = 'side_by_side' | 'semi_tandem' | 'tandem' | 'single_leg';

/** Wirkung der Zusatzfragen auf Plan, Übungen und Selbsttests (Plan 8.2). */
export interface AgingRules {
  /** Vorsichtiger Plan wie `conservative_plan` (Einsteiger-Vorlagen, RPE ≤ 7 …) – auch bei „übersprungen“. */
  readonly conservative: boolean;
  /** Zusätzlich ausgeschlossene Merkmale (bei JEDEM Ziel). */
  readonly excludedCautionTags: readonly CautionTag[];
  /** Höchste Gleichgewichts-Stufe (1–4). */
  readonly balanceMaxStage: number;
  /** Halt bei Gleichgewichtsübungen und im Gleichgewichts-Vorspann der Geh-Einheiten (N3). */
  readonly balanceSupport: BalanceSupport;
  /** Höchste Stand-Stufe in den Selbsttests; Einbeinstand-Test nur ohne diese Flags. */
  readonly standStagesMax: StandStage;
  /** Treppe nur unterste Stufe mit Geländer (K5). */
  readonly stairsBottomStepOnly: boolean;
  /** Übungen im Sitzen bevorzugen (Gehhilfe). */
  readonly preferSeated: boolean;
  /** Arzt-Hinweis vor dem Start (Sturz, Unsicherheit, OP). */
  readonly medicalNotice: boolean;
  /** Feste Hinweise (Texte in der App): Klinik-Vorgaben, Knochen, Kopfanprall bei Blutverdünnern. */
  readonly notices: readonly AgingNotice[];
}

export const AGING_NOTICES = ['clinic_rules', 'bone_exercises', 'head_injury'] as const;
export type AgingNotice = (typeof AGING_NOTICES)[number];

const FALL_RISK: readonly AgingFlag[] = ['fall_history', 'fall_concern', 'walking_aid'];
const HOLD_ON: readonly AgingFlag[] = [...FALL_RISK, 'anticoagulant'];

/** Ausschlüsse aus den Zusatzfragen (Plan 8.2, Tabelle). */
export const AGING_FLAG_EXCLUSIONS: Readonly<Partial<Record<AgingFlag, readonly CautionTag[]>>> = {
  hip_replacement: ['deep_hip_flexion', 'hip_cross_midline'],
  bone_health: ['spinal_flexion', 'loaded_flexion', 'trunk_rotation'],
};

/**
 * Regeln aus den Zusatzfragen. `flags = null` heißt „Fragen gelten, aber übersprungen/nicht beantwortet“ → vorsichtig
 * (S10), ohne gezielte Ausschlüsse; Halt immer „beidhändig“ und Stufen begrenzt (strengste Lesart).
 */
export function agingRules(flags: readonly AgingFlag[] | null): AgingRules {
  if (flags === null) {
    return {
      conservative: true,
      excludedCautionTags: [],
      balanceMaxStage: AGING_SCREENING_RULES.balanceMaxStageWithFallRisk,
      balanceSupport: 'hold_on',
      standStagesMax: 'semi_tandem',
      stairsBottomStepOnly: true,
      preferSeated: false,
      medicalNotice: false,
      notices: [],
    };
  }
  const has = (flag: AgingFlag) => flags.includes(flag);
  const fallRisk = FALL_RISK.some(has);
  const conservativeFlags: readonly AgingFlag[] = AGING_SCREENING_QUESTIONS.filter(
    (q) => q.conservative,
  ).map((q) => q.id);
  const excluded = new Set<CautionTag>();
  for (const flag of flags) (AGING_FLAG_EXCLUSIONS[flag] ?? []).forEach((t) => excluded.add(t));
  const notices: AgingNotice[] = [];
  if (has('recent_surgery')) notices.push('clinic_rules');
  if (has('bone_health')) notices.push('bone_exercises');
  if (has('anticoagulant')) notices.push('head_injury');
  return {
    conservative: conservativeFlags.some(has),
    excludedCautionTags: [...excluded],
    balanceMaxStage: fallRisk ? AGING_SCREENING_RULES.balanceMaxStageWithFallRisk : 4,
    balanceSupport: HOLD_ON.some(has) ? 'hold_on' : 'chair_nearby',
    standStagesMax: HOLD_ON.some(has) ? 'semi_tandem' : 'single_leg',
    stairsBottomStepOnly: fallRisk,
    preferSeated: has('walking_aid'),
    medicalNotice: has('fall_history') || has('fall_concern') || has('recent_surgery'),
    notices,
  };
}

/** Halt-Stufe für das Ziel ohne Flag: Stuhl/Küchenzeile in Reichweite. */
export const DEFAULT_BALANCE_SUPPORT: BalanceSupport = 'chair_nearby';
