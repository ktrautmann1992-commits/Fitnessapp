import { z } from 'zod';

import { isoDateSchema } from '../age';
import { KCAL_PER_KG_BODY_WEIGHT, WEIGHT_GOAL_LIMITS } from '../constants';
import { addDays, daysBetween } from '../dates';
import type { BodyMetricsRow, NutritionInputsInput } from '../nutrition/schemas';
import { nutritionInputsSchema } from '../nutrition/schemas';
import {
  isTargetBmiAllowed,
  WEIGHT_GOAL_EPS,
  type WeightGoalBlockReason,
  weightGoalFeasibility,
  type WeightGoalInputNotice,
  type WeightGoalInvalidReason,
  type WeightGoalRated,
  weightGoalAvailability,
} from './weight-goal-feasibility';
import { isMultipleOf, type WeightGoal, weightGoalSchema } from './weight-goal-schema';

/**
 * Konkretes Abnehmziel (docs/PLAN-ZIELE.md 2.2–2.4, Etappe Z2): Eingabe, Normalisierung, Validierung und die Wirkung
 * auf die Energie-Anpassung je Tag. Das Ziel kann das Defizit NUR verkleinern (Gründer-Entscheidung F5): Geplantes
 * Tempo = min(benötigtes Tempo, Tempo der Standard-Anpassung); danach gilt immer `clampCalorieTarget` – die einzige
 * Stelle mit Schutzgrenzen. Gesundheitsdatum: nie in Logs oder Analytics (Wächter K7).
 */

// ---------------------------------------------------------------------------------------------------------
// Eingabe (Plan 2.2): Menge „kg abnehmen“ (0,5-kg-Schritte) oder „Zielgewicht“ (0,1 kg); Zeitraum „Wochen“ oder
// „bis Datum“. Standard laut F9: „kg abnehmen“ + „Wochen“.
// ---------------------------------------------------------------------------------------------------------

export const weightGoalInputSchema = z.strictObject({
  amount: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('kg_to_lose'), kg: z.number().finite() }),
    z.strictObject({ mode: z.literal('target_weight'), kg: z.number().finite() }),
  ]),
  time: z.discriminatedUnion('mode', [
    z.strictObject({ mode: z.literal('weeks'), weeks: z.number().int() }),
    z.strictObject({ mode: z.literal('date'), date: isoDateSchema }),
  ]),
});
export type WeightGoalFormInput = z.input<typeof weightGoalInputSchema>;

/** Fehler-Codes der Eingabe: gesperrte Option, unzulässiges Ziel, Schrittweite, kein Defizit planbar. */
export type WeightGoalIssueCode =
  WeightGoalBlockReason | WeightGoalInvalidReason | 'kg_step' | 'target_step' | 'no_deficit';

/** Texte (Entwurf, neutral, Plan 2.3). Die App übernimmt sie in Etappe Z4 nach `i18n/de.ts`. */
export const WEIGHT_GOAL_ISSUE_MESSAGES: Record<WeightGoalIssueCode, string> = {
  not_fat_loss: 'Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.',
  no_consent: 'Für ein konkretes Ziel brauchen wir dein aktuelles Gewicht.',
  body_data_missing: 'Für ein konkretes Ziel brauchen wir dein aktuelles Gewicht.',
  pregnancy: 'In der Schwangerschaft planen wir kein Abnehmziel.',
  minor: 'Im Wachstum ist eine Diät nicht sinnvoll. Wir planen ausgewogen ohne Kaloriendefizit.',
  weight_outdated: 'Dein Gewicht ist älter als 3 Monate – bitte kurz aktualisieren.',
  underweight: 'Bei deinem aktuellen Gewicht planen wir kein Kaloriendefizit.',
  health_check_missing: 'Mach bitte zuerst den kurzen Gesundheits-Check.',
  not_below_current:
    'Dein Zielgewicht liegt nicht unter deinem aktuellen Gewicht. Wähle ‚ohne festes Ziel‘ oder ein anderes Ziel.',
  below_min_kg: 'Bitte mindestens 1 kg.',
  target_out_of_range: 'Bitte ein Zielgewicht zwischen 30 und 300 kg.',
  target_bmi_too_low:
    'Dieses Zielgewicht liegt unter dem Bereich, den wir planen. Wenn Essen oder Gewicht dich belasten, hol dir Unterstützung.',
  period_out_of_range: 'Bitte einen Zeitraum zwischen 4 Wochen und 2 Jahren.',
  kg_step: 'Bitte in Schritten von 0,5 kg.',
  target_step: 'Bitte das Zielgewicht mit höchstens einer Nachkommastelle.',
  no_deficit: 'Derzeit planen wir für dich kein Kaloriendefizit. Wähle bitte ‚ohne festes Ziel‘.',
};

export interface WeightGoalIssue {
  readonly code: WeightGoalIssueCode;
  readonly path: readonly (string | number)[];
  readonly message: string;
}

export type WeightGoalEvaluation =
  | { readonly ok: false; readonly issues: readonly WeightGoalIssue[] }
  | {
      readonly ok: true;
      /** Normalisiertes Ziel zum Speichern (`startDate` = heute, Wächter S15). */
      readonly goal: WeightGoal;
      readonly rating: WeightGoalRated;
      readonly notices: readonly WeightGoalInputNotice[];
    };

const BLOCK_PATH: readonly string[] = [];
const INVALID_PATH: Record<WeightGoalInvalidReason, readonly string[]> = {
  not_below_current: ['amount', 'kg'],
  below_min_kg: ['amount', 'kg'],
  target_out_of_range: ['amount', 'kg'],
  target_bmi_too_low: ['amount', 'kg'],
  period_out_of_range: ['time'],
};

function issue(code: WeightGoalIssueCode, path: readonly string[]): WeightGoalIssue {
  return { code, path, message: WEIGHT_GOAL_ISSUE_MESSAGES[code] };
}

/** Auf 0,1 kg runden (Gleitkomma-Reste aus „aktuelles Gewicht − kg“). */
function roundToTenth(kg: number): number {
  return Math.round(kg * 10) / 10;
}

/**
 * Prüft eine Eingabe gegen die Person (`person` = Eingaben der Ernährungs-Engine mit `today`, Körperdaten, Check,
 * Zielen, Alltagsfaktor) und liefert das normalisierte Ziel mit Ampel – oder die Fehler (Plan 2.3). „Kein Defizit
 * planbar“ (Wächter S1) ist ein Fehler: Ein solches Ziel ist nicht speicherbar.
 */
export function evaluateWeightGoalInput(
  rawInput: WeightGoalFormInput,
  rawPerson: NutritionInputsInput,
): WeightGoalEvaluation {
  const input = weightGoalInputSchema.parse(rawInput);
  const person = nutritionInputsSchema.parse(rawPerson);
  const availability = weightGoalAvailability(person);
  if (!availability.available) {
    return { ok: false, issues: [issue(availability.reason, BLOCK_PATH)] };
  }
  const issues: WeightGoalIssue[] = [];
  const w0 = availability.body.weightKg;
  if (
    input.amount.mode === 'kg_to_lose' &&
    !isMultipleOf(input.amount.kg, WEIGHT_GOAL_LIMITS.kgStep)
  ) {
    issues.push(issue('kg_step', ['amount', 'kg']));
  }
  if (
    input.amount.mode === 'target_weight' &&
    !isMultipleOf(input.amount.kg, WEIGHT_GOAL_LIMITS.targetStep)
  ) {
    issues.push(issue('target_step', ['amount', 'kg']));
  }
  const targetWeightKg =
    input.amount.mode === 'kg_to_lose' ? roundToTenth(w0 - input.amount.kg) : input.amount.kg;
  const days =
    input.time.mode === 'weeks' ? input.time.weeks * 7 : daysBetween(person.today, input.time.date);
  const targetDate = addDays(person.today, days);
  if (issues.length > 0) return { ok: false, issues };

  const rating = weightGoalFeasibility(person, { targetWeightKg, targetDate });
  if (rating.state === 'unavailable')
    return { ok: false, issues: [issue(rating.reason, BLOCK_PATH)] };
  if (rating.state === 'invalid') {
    return { ok: false, issues: rating.reasons.map((r) => issue(r, INVALID_PATH[r])) };
  }
  if (rating.state === 'no_deficit')
    return { ok: false, issues: [issue('no_deficit', BLOCK_PATH)] };
  return {
    ok: true,
    goal: weightGoalSchema.parse({
      targetWeightKg,
      startDate: person.today,
      targetDate,
      amountMode: input.amount.mode,
      timeMode: input.time.mode,
    }),
    rating,
    notices: rating.notices,
  };
}

/**
 * Zod-Schema für den Schritt „konkretes Ziel“ (Plan 2.2): prüft die Eingabe gegen die Person und gibt das
 * normalisierte Ziel aus. Die Person sind die Eingaben der Ernährungs-Engine (statt nur Gewicht/Größe/Alter/Flags),
 * weil „kein Defizit planbar“ nur mit allen Angaben (Geschlecht, Körperfett, Alltagsfaktor, Ziele) prüfbar ist.
 */
export function createWeightGoalSchema(person: NutritionInputsInput) {
  return weightGoalInputSchema.transform((value, ctx) => {
    const result = evaluateWeightGoalInput(value, person);
    if (!result.ok) {
      for (const problem of result.issues) {
        ctx.addIssue({
          code: 'custom',
          path: [...problem.path],
          message: problem.message,
          params: { weightGoalIssue: problem.code },
        });
      }
      return z.NEVER;
    }
    return result.goal;
  });
}

// ---------------------------------------------------------------------------------------------------------
// Wirkung auf die Energie-Anpassung je Tag (Plan 2.4)
// ---------------------------------------------------------------------------------------------------------

/**
 * Stand des Ziels an einem Tag:
 * - `paused`: Ziel ruht (Modus nicht `full`, z. B. Schwangerschaft, unter 18, Untergewicht) – keine Wirkung.
 * - `invalid`: Abnehmen ist kein Ziel mehr, oder der Ziel-BMI ist mit der neuesten Größe unzulässig (Wächter S14) –
 *   Standard-Anpassung, Hinweis `weight_goal_invalid`.
 * - `reached`: Seit `startDate` gab es eine Gewichtsangabe ≤ Zielgewicht (bis einschließlich Tag d) – Erhalt bis zur
 *   Wahl, kein Zurückspringen (Wächter S8), Hinweis `weight_goal_reached`.
 * - `date_passed`: `targetDate ≤ d` – Standard-Anpassung, Hinweis `weight_goal_date_passed`.
 * - `no_deficit`: Kapazität D_C ≤ 1 kcal (Wächter K-d) – Standard-Anpassung, Hinweis `weight_goal_no_deficit`.
 * - `active`: geplantes Tempo = min(benötigt, Standard).
 */
export const WEIGHT_GOAL_DAY_STATUSES = [
  'paused',
  'invalid',
  'reached',
  'date_passed',
  'no_deficit',
  'active',
] as const;
export type WeightGoalDayStatus = (typeof WEIGHT_GOAL_DAY_STATUSES)[number];

export interface WeightGoalDayInput {
  readonly goal: WeightGoal;
  /** Gerechneter Tag d. */
  readonly date: string;
  readonly today: string;
  /** Modus des Tages (`nutritionEligibility`). */
  readonly mode: 'full' | 'maintenance_only';
  /** Abnehmen ist Haupt- oder Nebenziel. */
  readonly losesWeight: boolean;
  /** Standard-Anpassung des Ziel-Profils (≤ 0 bei Abnehmen), bereits für den Modus bestimmt. */
  readonly standardAdjustment: number;
  /** Grundbedarf ohne Training (bmrForNeeds × Alltagsfaktor) am Tag d. */
  readonly baseNeeds: number;
  /** Neuestes Gewicht (bis heute). */
  readonly latestWeightKg: number;
  /** Messtag des neuesten Gewichts – Ankertag der Restwochen (Wächter Z2 S-1). */
  readonly latestWeightMeasuredOn: string;
  /** Neueste Größe (bis heute). */
  readonly heightCm: number;
  readonly bodyMetricsRows: readonly BodyMetricsRow[];
  /** Kapazität D_C ≤ 1 kcal (Ziel ab heute nicht mehr planbar). */
  readonly noDeficit: boolean;
}

/**
 * Stand des Ziels vor jeder Energie-Rechnung (gilt auch an Tagen ohne Ziele, z. B. Schwangerschaft):
 * - `null`: Tag vor `startDate` – das Ziel gilt noch nicht (Wächter Z2 K-1).
 * - `invalid`: Abnehmen kein Ziel mehr oder Ziel-BMI mit der neuesten Größe unzulässig (S14).
 * - `paused`: das Ziel ruht (Modus nicht `full`).
 * - `'ok'`: weiter mit `weightGoalDayAdjustment`.
 * Einheitliche Reihenfolge (Wächter Z2 K-3): vor Start → ungültig → ruht.
 */
export function weightGoalPreStatus(input: {
  readonly goal: Pick<WeightGoal, 'targetWeightKg' | 'startDate'>;
  readonly date: string;
  readonly losesWeight: boolean;
  readonly heightCm: number | null;
  readonly mode: 'full' | 'maintenance_only' | 'no_targets';
}): 'invalid' | 'paused' | 'ok' | null {
  if (input.date < input.goal.startDate) return null;
  if (
    !input.losesWeight ||
    (input.heightCm !== null && !isTargetBmiAllowed(input.goal.targetWeightKg, input.heightCm))
  ) {
    return 'invalid';
  }
  return input.mode === 'full' ? 'ok' : 'paused';
}

export interface WeightGoalDayResult {
  readonly status: WeightGoalDayStatus;
  /** Energie-Anpassung des Tages (Anteil des Grundbedarfs) – immer in [Standard-Anpassung; 0]. */
  readonly adjustment: number;
  /** Benötigtes Tempo > Tempo der Standard-Anpassung (die Schutzgrenzen prüft `nutritionTargetsForWeek` danach). */
  readonly slowerThanRequired: boolean;
}

/**
 * „Erreicht“ (Wächter S8): seit `startDate` mindestens eine Gewichtsangabe ≤ Zielgewicht, gemessen bis
 * einschließlich `date` und nicht nach `today`. Zustandslos aus den Messungen abgeleitet.
 */
export function weightGoalReached(
  goal: Pick<WeightGoal, 'targetWeightKg' | 'startDate'>,
  rows: readonly Pick<BodyMetricsRow, 'measuredOn' | 'weightKg'>[],
  date: string,
  today: string,
): boolean {
  const until = date < today ? date : today;
  return rows.some(
    (row) =>
      row.weightKg !== null &&
      row.measuredOn >= goal.startDate &&
      row.measuredOn <= until &&
      row.weightKg <= goal.targetWeightKg + WEIGHT_GOAL_EPS,
  );
}

/**
 * Energie-Anpassung eines Tages mit konkretem Ziel (Plan 2.4 Nr. 1–4, 7). Gleichwertig zu „geplantes Tempo =
 * min(v_r, v_S)“: Anpassung = max(Standard, −v_r × 7700 / 7 / Grundbedarf), zusätzlich nie über 0 (ein Ziel macht
 * nie einen Überschuss). Kein Aufholen: Rückt das Datum näher, bleibt die Anpassung bei höchstens der Standard-
 * Anpassung.
 */
export function weightGoalDayAdjustment(input: WeightGoalDayInput): WeightGoalDayResult | null {
  const standard = Math.min(input.standardAdjustment, 0);
  const result = (status: WeightGoalDayStatus, adjustment = standard, slower = false) => ({
    status,
    adjustment,
    slowerThanRequired: slower,
  });
  const pre = weightGoalPreStatus(input);
  if (pre === null) return null;
  if (pre === 'invalid') return result('invalid');
  if (pre === 'paused') return result('paused', input.standardAdjustment);
  if (weightGoalReached(input.goal, input.bodyMetricsRows, input.date, input.today)) {
    return result('reached', 0);
  }
  // Neuestes Gewicht ≤ Ziel, aber vor `startDate` gemessen (z. B. direkter API-Eintrag): unzulässig, nie ein
  // Überschuss.
  const restKg = input.latestWeightKg - input.goal.targetWeightKg;
  if (restKg <= WEIGHT_GOAL_EPS) return result('invalid');
  if (input.goal.targetDate <= input.date) return result('date_passed');
  if (input.noDeficit) return result('no_deficit');
  // Restwochen ab dem Ankertag (Wächter Z2 S-1): max(Messtag des neuesten Gewichts, startDate), höchstens Tag d. Ohne
  // neue Messung bleibt das Tempo so konstant – am Speichertag genau das Tempo der Ampel (Δ / Wochen), kein
  // schleichendes Verschärfen. `max(…, 1)` schützt vor einer Division durch 0.
  const measured =
    input.latestWeightMeasuredOn > input.goal.startDate
      ? input.latestWeightMeasuredOn
      : input.goal.startDate;
  const anchor = measured < input.date ? measured : input.date;
  const restWeeks = Math.max(daysBetween(anchor, input.goal.targetDate), 1) / 7;
  const requiredKgPerWeek = restKg / restWeeks;
  const goalAdjustment = -(requiredKgPerWeek * KCAL_PER_KG_BODY_WEIGHT) / 7 / input.baseNeeds;
  const adjustment = Math.min(0, Math.max(standard, goalAdjustment));
  return result('active', adjustment, goalAdjustment < standard - WEIGHT_GOAL_EPS);
}
