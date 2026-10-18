import { meetsMinimumAge } from '../age';
import { startOfIsoWeek } from '../dates';
import type { EnduranceDiscipline, GoalType } from '../enums';
import { createGoalStepSchema } from '../validation';
import { nutritionInputsSchema, type NutritionInputsInput } from '../nutrition/schemas';
import { nutritionTargetsForWeek } from '../nutrition/targets';
import {
  type GoalSelection,
  type GoalSelectionInput,
  goalSelectionSchema,
  isAllowedGoalPair,
} from './profile';
import type { WeightGoalDayStatus } from './weight-goal';
import type { WeightGoal } from './weight-goal-schema';

/**
 * Lebenszyklus des konkreten Abnehmziels in der App (docs/PLAN-ZIELE.md 6 Nr. 4, F10, Etappe Z5). Rein abgeleitet aus
 * der Ernährungs-Engine – es gibt keine eigene Spalte „erreicht“ (Wächter S8: zustandslos aus den Messungen).
 * - erreicht → Erhalt, bis die Person wählt, wie es weitergeht (Karte, keine automatische Änderung)
 * - Zeitraum vorbei → Standard-Tempo und ausdrückliches Angebot „Verlängern“ – nie automatisch verlängern oder
 *   beschleunigen (F10)
 * Gesundheitsdatum: Ergebnis nie in Logs, Analytics oder Crash-Reports (Wächter K7).
 */

/** Stand heute: `none` = kein (wirksames) Ziel gespeichert bzw. keine Einwilligung; sonst der Tages-Stand der Engine. */
export type WeightGoalLifecycleStatus = 'none' | WeightGoalDayStatus;

export interface WeightGoalOverview {
  readonly status: WeightGoalLifecycleStatus;
  /**
   * Gewicht älter als 90 Tage bei bestehendem Ziel (Vormerkung Wächter Z2 K-6): Das Ziel rechnet sicher weiter (nur
   * kleineres Defizit), die App bittet um ein neues Gewicht, damit das Ziel richtig geplant wird.
   */
  readonly weightOutdated: boolean;
  /**
   * Das Ziel ruht heute nur wegen eines Wettkampfs (Wettkampfwoche ohne Defizit, Etappe W1, Wächter N4) und läuft danach
   * von selbst weiter. Fehlt sonst.
   */
  readonly pausedForCompetition?: true;
}

const NO_GOAL: WeightGoalOverview = { status: 'none', weightOutdated: false };

/**
 * Stand des Abnehmziels am Tag `today` der Eingaben – genau der Tages-Stand aus `nutritionTargetsForWeek` (dieselbe
 * Rechnung wie Ernährung und Essensplan). Ohne Ziel, ohne Einwilligung oder unter dem Mindestalter: `none`.
 */
export function weightGoalOverview(rawInputs: NutritionInputsInput): WeightGoalOverview {
  const inputs = nutritionInputsSchema.parse(rawInputs);
  if (
    inputs.weightGoal === null ||
    !inputs.healthDataConsent ||
    !meetsMinimumAge(inputs.birthDate, inputs.today)
  ) {
    return NO_GOAL;
  }
  const week = nutritionTargetsForWeek(inputs, startOfIsoWeek(inputs.today));
  const day = week.days.find((d) => d.date === inputs.today);
  const status = day?.weightGoalStatus ?? null;
  if (day === undefined || status === null) return NO_GOAL;
  return {
    status,
    weightOutdated: day.notices.includes('weight_outdated'),
    ...(day.competition?.weightGoalPaused === true ? { pausedForCompetition: true } : {}),
  };
}

/**
 * Zeitraum vorbei (`targetDate ≤ heute`, wie die Engine, Wächter S7). Das Formular schlägt dann KEINEN neuen Zeitraum
 * vor (Wächter Z4 N10: kein stilles Verlängern) – Verlängern ist immer eine ausdrückliche Wahl.
 */
export function weightGoalPeriodEnded(
  goal: Pick<WeightGoal, 'targetDate'>,
  today: string,
): boolean {
  return goal.targetDate <= today;
}

/** Karte auf „Heute“ (Plan 6 Nr. 4): nur bei „erreicht“ und „Zeitraum vorbei“ – ohne Zahlen, ohne Konfetti. */
export type WeightGoalCard = 'reached' | 'date_passed';

export function weightGoalCard(overview: WeightGoalOverview): WeightGoalCard | null {
  return overview.status === 'reached' || overview.status === 'date_passed'
    ? overview.status
    : null;
}

/**
 * Auswahl „Wie geht es weiter?“ nach erreichtem Ziel (F10). `new_weight_goal` ändert die Ziele nicht (neues
 * Wunschgewicht über das Formular, das ab heute neu plant, Wächter S15).
 */
export const WEIGHT_GOAL_REACHED_CHOICES = ['maintain', 'muscle_gain', 'new_weight_goal'] as const;
export type WeightGoalReachedChoice = (typeof WEIGHT_GOAL_REACHED_CHOICES)[number];

/**
 * Neue Ziele nach erreichtem Wunschgewicht (Plan 6 Nr. 4: „Gewicht halten (Ziel Fitness) / Muskelaufbau“). Abnehmen
 * entfällt immer (und mit ihm über den Datenbank-Trigger das Wunschgewicht). Ausdauer bleibt erhalten:
 * - `maintain`: Energie-Anpassung 0 – Fitness, mit Ausdauer als Nebenziel „Fitness → Ausdauer“; war Ausdauer das
 *   Hauptziel, bleibt Ausdauer allein.
 * - `muscle_gain`: Muskelaufbau, mit Ausdauer als Nebenziel; war Ausdauer das Hauptziel, „Ausdauer → Muskelaufbau“.
 * Jedes Ergebnis ist ein erlaubtes Paar (Tabelle 4.2) ohne Abnehmen. `null` für `new_weight_goal` (Ziele bleiben).
 */
export function goalsAfterWeightGoalReached(
  rawSelection: GoalSelectionInput,
  choice: WeightGoalReachedChoice,
): GoalSelection | null {
  const selection = goalSelectionSchema.parse(rawSelection);
  if (choice === 'new_weight_goal') return null;
  const enduranceRole =
    selection.primary === 'endurance'
      ? 'primary'
      : selection.secondary === 'endurance'
        ? 'secondary'
        : null;
  const main: GoalType = choice === 'maintain' ? 'general_fitness' : 'muscle_gain';
  const next: GoalSelection =
    enduranceRole === 'primary'
      ? { primary: 'endurance', secondary: choice === 'maintain' ? null : 'muscle_gain' }
      : { primary: main, secondary: enduranceRole === 'secondary' ? 'endurance' : null };
  // Sicherheitsnetz: nie ein verbotenes Paar (Tabelle 4.2) – sonst das Hauptziel allein.
  return isAllowedGoalPair(next.primary, next.secondary) ? next : { ...next, secondary: null };
}

/** Gespeicherte Ziel-Angaben (Schritt „Dein Ziel“, Tabelle `goals`). */
export interface GoalStepValues {
  readonly goalType: GoalType;
  readonly secondaryGoalType: GoalType | null;
  readonly discipline: EnduranceDiscipline | null;
  readonly targetDate: string | null;
}

/**
 * Neue Angaben für den Schritt „Dein Ziel“ nach der Wahl „Gewicht halten“ bzw. „Muskelaufbau“ (Wächter Z5 N3): Ziele aus
 * `goalsAfterWeightGoalReached`; Disziplin und Wettkampfdatum bleiben nur, solange Ausdauer ein Ziel ist; ein
 * Wettkampfdatum in der Vergangenheit entfällt. Das Ergebnis ist mit `createGoalStepSchema(today)` geprüft (Zod an der
 * Grenze) – `null`, wenn das nicht gelingt (dann speichert die App nichts).
 */
export function goalStepAfterWeightGoalReached(
  current: GoalStepValues,
  choice: Exclude<WeightGoalReachedChoice, 'new_weight_goal'>,
  today: string,
): GoalStepValues | null {
  const next = goalsAfterWeightGoalReached(
    { primary: current.goalType, secondary: current.secondaryGoalType },
    choice,
  );
  if (next === null) return null;
  const endurance = next.primary === 'endurance' || next.secondary === 'endurance';
  const targetDate =
    endurance && current.targetDate !== null && current.targetDate >= today
      ? current.targetDate
      : null;
  const parsed = createGoalStepSchema(today).safeParse({
    goalType: next.primary,
    secondaryGoalType: next.secondary,
    discipline: endurance ? current.discipline : null,
    targetDate,
  });
  if (!parsed.success) return null;
  return {
    goalType: parsed.data.goalType,
    secondaryGoalType: parsed.data.secondaryGoalType,
    discipline: parsed.data.discipline ?? null,
    targetDate: parsed.data.targetDate ?? null,
  };
}
