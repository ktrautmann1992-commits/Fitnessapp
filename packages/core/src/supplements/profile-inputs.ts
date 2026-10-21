import { SUPPLEMENT_RULES } from '../constants';
import { addDays } from '../dates';
import type { DietType, ExperienceLevel, GoalType, Sex, TrainingTime } from '../enums';
import type { HealthFlag } from '../health-screening';
import { hasSupplementConsent, type SupplementInputs } from './inputs';
import {
  type ProteinLogDay,
  proteinGapFromLog,
  proteinGapFromSelfCheck,
  resolveProteinGap,
} from './protein-gap';
import { isSupplementScreeningCurrent, type StoredSupplementScreening } from './user-data';

/**
 * Eingaben der Supplement-Engine aus den gespeicherten Angaben einer Person (docs/PLAN-PHASE-6.md 5, 8.1, 11.2).
 * Die App bildet nur ihre Zeilen auf `SupplementProfileSource` ab; WAS davon in die Einordnung darf, entscheidet diese
 * Funktion – vor allem die Einwilligung:
 * - Gesundheitsdaten (Gesundheits-Check, Supplement-Check, Gewicht, Eiweiß-Lücke aus Tagebuch oder
 *   Selbsteinschätzung, Lebensmittel-Unverträglichkeiten) nur mit GÜLTIGER Einwilligung `health_data` in Fassung ≥ 2
 *   (Plan 11.1). Mit Fassung 1 (gültig oder veraltet) bleibt alles „Zur Info“ – auch Unverträglichkeiten zählen dann
 *   nicht (neuer Zweck „Supplement-Hinweise“ erst ab Fassung 2).
 * - „Fisch mag ich nicht“ (Vorliebe, kein Gesundheitsdatum) zählt immer.
 * - Ein Check in einer älteren Fassung der Fragen gilt nicht (erneut fragen).
 * - Die Stillzeit-Antwort zählt nicht bei „männlich“ (die Frage wird dann nicht gestellt – ein älterer Check nach einer
 *   Änderung des Geschlechts wäre sonst ein Widerspruch).
 */

/** Eintrag im Ernährungstagebuch (nur die Felder, die die Eiweiß-Lücke braucht). */
export interface SupplementFoodLogEntry {
  readonly eatenOn: string;
  readonly kcal: number | null;
  readonly proteinG: number | null;
}

export interface SupplementProfileSource {
  /** Lokales Datum der Anzeige. */
  readonly today: string;
  readonly birthDate: string;
  readonly sex: Sex | null;
  /**
   * GÜLTIGE Fassung der Einwilligung `health_data` (aktiv UND aktuelle Fassung), `null` = keine gültige Einwilligung.
   * Veraltete oder widerrufene Einwilligungen werden als `null` übergeben.
   */
  readonly validHealthConsentVersion: number | null;
  /** Flags des neuesten Gesundheits-Checks, `null` = kein Check. */
  readonly healthFlags: readonly HealthFlag[] | null;
  readonly screening: StoredSupplementScreening | null;
  /** Neuestes Körpergewicht in kg, `null` = unbekannt. */
  readonly latestWeightKg: number | null;
  readonly goalType: GoalType;
  readonly secondaryGoalType: GoalType | null;
  readonly experienceLevel: ExperienceLevel;
  /** Ausdauer-Plan mit Intervall- oder Sprint-Einheiten (Kreatin beim Ziel Ausdauer, Plan 3.2). */
  readonly hasIntervalSessions: boolean;
  readonly dietType: DietType;
  /** Gespeicherte Vorlieben: Lebensmittel-Gruppe und Art („like“, „dislike“, „intolerance“). */
  readonly foodPreferences: readonly { readonly group: string; readonly kind: string }[];
  readonly trainingTime: TrainingTime | null;
  /** Ernährungstagebuch (beliebig viele Tage; gezählt werden die letzten 7 bis heute). */
  readonly foodLog: readonly SupplementFoodLogEntry[];
  /** Eiweißziel von heute in g; `null` = kein Ziel (z. B. Modus `no_targets` oder Angaben unvollständig). */
  readonly proteinTargetG: number | null;
  /** Gibt es Kalorien- und Eiweißziele? `false` = Modus `no_targets` (z. B. Schwangerschaft). */
  readonly hasNutritionTargets: boolean;
  /** Eingetragener (geplanter) Wettkampf – Doping-Hinweis (Plan 3.6). */
  readonly hasCompetition: boolean;
}

/** Lebensmittel-Gruppen für Fisch (Omega-3, Plan 3.2) und Milch (pflanzliches Proteinpulver, Plan 3.7). */
const FISH_GROUPS: readonly string[] = ['fish'];
const DAIRY_GROUPS: readonly string[] = ['dairy', 'lactose'];

/**
 * Eiweiß je Tag der letzten 7 Tage (heute eingeschlossen) für `proteinGapFromLog`. Ein Tag zählt nur, wenn ALLE
 * Einträge mit kcal auch Eiweiß haben – sonst wäre die Summe zu niedrig und die App sähe eine Lücke, die es nicht gibt
 * (sichere Richtung: lieber `null`). Einträge ohne kcal (Schnelleintrag ohne Wert) machen den Tag ebenfalls unklar.
 */
export function proteinLogDays(
  entries: readonly SupplementFoodLogEntry[],
  today: string,
): ProteinLogDay[] {
  const days: ProteinLogDay[] = [];
  const windowDays = SUPPLEMENT_RULES.proteinPowder.gap.windowDays;
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const dayEntries = entries.filter((entry) => entry.eatenOn === date);
    const complete =
      dayEntries.length > 0 &&
      dayEntries.every((entry) => entry.kcal !== null && entry.proteinG !== null);
    const protein = dayEntries.reduce((sum, entry) => sum + (entry.proteinG ?? 0), 0);
    days.push({ date, proteinG: complete ? Math.round(protein * 10) / 10 : null });
  }
  return days;
}

export function buildSupplementInputs(source: SupplementProfileSource): SupplementInputs {
  const consent = hasSupplementConsent(source.validHealthConsentVersion);
  const screening =
    consent && isSupplementScreeningCurrent(source.screening) ? source.screening : null;
  const supplementFlags =
    screening === null
      ? null
      : screening.flags.filter((flag) => !(flag === 'breastfeeding' && source.sex === 'male'));
  const groupsOf = (kinds: readonly string[], groups: readonly string[]) =>
    source.foodPreferences.some(
      (preference) => kinds.includes(preference.kind) && groups.includes(preference.group),
    );
  // Unverträglichkeiten sind Gesundheitsdaten – nur mit Einwilligung Fassung 2.
  const avoidsFish =
    groupsOf(['dislike'], FISH_GROUPS) || (consent && groupsOf(['intolerance'], FISH_GROUPS));
  const avoidsDairy = consent && groupsOf(['intolerance'], DAIRY_GROUPS);
  const fromLog =
    consent && source.proteinTargetG !== null && source.proteinTargetG > 0
      ? proteinGapFromLog(proteinLogDays(source.foodLog, source.today), source.proteinTargetG)
      : null;
  const fromSelfCheck = proteinGapFromSelfCheck(screening?.answers.protein_self_check);
  const gap = consent ? resolveProteinGap(fromLog, fromSelfCheck) : null;
  return {
    birthDate: source.birthDate,
    today: source.today,
    sex: source.sex,
    healthConsentVersion: consent ? source.validHealthConsentVersion : null,
    healthFlags: consent && source.healthFlags !== null ? [...new Set(source.healthFlags)] : null,
    supplementFlags,
    weightKg: consent ? source.latestWeightKg : null,
    goalType: source.goalType,
    secondaryGoalType: source.secondaryGoalType,
    experienceLevel: source.experienceLevel,
    hasIntervalSessions: source.hasIntervalSessions,
    dietType: source.dietType,
    avoidsFish,
    avoidsDairy,
    trainingTime: source.trainingTime,
    proteinGap: gap === null ? null : gap.gap,
    hasNutritionTargets: source.hasNutritionTargets,
    hasCompetition: source.hasCompetition,
  };
}
