import {
  daysBetween,
  isMultipleOf,
  isoDateSchema,
  WEIGHT_GOAL_LIMITS,
  type WeightGoal,
  type WeightGoalAmountMode,
  type WeightGoalAvailability,
  type WeightGoalFormInput,
  type WeightGoalLevel,
  type WeightGoalRated,
  type WeightGoalTimeMode,
  type WeightGoalZone,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { datePartsFromIso, formatDecimal, isoFromDateParts, parseDecimal } from './format';

/**
 * Anzeige und Formular des konkreten Abnehmziels (Etappe Z4, docs/PLAN-ZIELE.md 2.2, 3.1, 3.4). Nur Darstellung und
 * Umwandlung der Eingabe – alle Regeln (Stufe, sichere Dauer, Zeiger, Grenzen) kommen aus packages/core
 * (`evaluateWeightGoalInput`, `weightGoalFeasibility`). Keine Werte in Logs oder Analytics (Wächter K7).
 */

const W = t.steps.weightGoal;

/** Ab dieser Dauer zusätzlich in Monaten (Plan 3.1: „Ab 27 Wochen … etwa 8 Monate“). */
export const WEEKS_WITH_MONTHS_FROM = 27;
/** Mittlere Monatslänge in Tagen (365,25 / 12) – nur für die Anzeige „etwa N Monate“. */
const DAYS_PER_MONTH = 30.4375;

/** „22 Wochen“ bzw. ab 27 Wochen „30 Wochen (etwa 7 Monate)“ – Planungsdauer, kein Datum (F7, Wächter S20). */
export function weeksText(weeks: number): string {
  if (weeks < WEEKS_WITH_MONTHS_FROM) return W.scale.weeks(weeks);
  return W.scale.weeksWithMonths(weeks, Math.round((weeks * 7) / DAYS_PER_MONTH));
}

/** Prozent pro Woche mit einer Nachkommastelle und deutschem Komma, ohne „,0“ (0,0098 → „1“, 0,00535 → „0,5“). */
export function pacePercentText(pace: number): string {
  const rounded = Math.round(pace * 1000) / 10;
  return formatDecimal(rounded);
}

export interface FeasibilityView {
  readonly level: WeightGoalLevel;
  readonly zone: WeightGoalZone;
  readonly title: string;
  readonly text: string;
  /** Detailzeile mit „etwa … %“ (nur hier und im Screenreader, Wächter K8). */
  readonly detail: string;
  /** Ganzer Satz für den Screenreader (Plan 3.4). */
  readonly a11y: string;
  /** Wort der Zone für `aria-valuetext` am Anfang („sehr ehrgeizig“). */
  readonly zoneWord: string;
  /** Zeigerposition 0–100 (Rot links, Grün rechts), bereits in die Zone der Stufe geklemmt. */
  readonly percent: number;
  /** Knopf „Zeitraum auf N Wochen setzen“ (nur Orange/Rot und N ≤ 104). */
  readonly applyWeeks: number | null;
}

/** Stufe der Ampel → Texte (Plan 3.1, Tabelle). */
export function feasibilityView(rating: WeightGoalRated): FeasibilityView {
  const safe = rating.safeWeeks === null ? null : weeksText(rating.safeWeeks);
  const level = rating.level;
  const levels = W.scale.levels;
  let text: string;
  if (level === 'green' || level === 'yellow') {
    text = levels[level].text;
  } else if (safe === null) {
    text = level === 'red' ? W.scale.overMaxRed : W.scale.overMax;
  } else {
    text = levels[level].text(safe);
  }
  const detail = W.scale.detail(pacePercentText(rating.requiredPace));
  const zoneWord = W.scale.zoneWords[rating.zone];
  const safeSentence =
    level === 'green' || level === 'yellow'
      ? null
      : safe === null
        ? W.scale.a11yOverMax
        : W.scale.a11ySafe(safe);
  return {
    level,
    zone: rating.zone,
    title: levels[level].title,
    text,
    detail,
    a11y: W.scale.a11y(zoneWord, detail, safeSentence),
    zoneWord,
    percent: Math.round(rating.pointer.display * 100),
    applyWeeks: rating.suggestedWeeks,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Formular
// ---------------------------------------------------------------------------------------------------------

export interface WeightGoalDraft {
  readonly amountMode: WeightGoalAmountMode;
  readonly amountText: string;
  readonly timeMode: WeightGoalTimeMode;
  readonly weeksText: string;
  readonly date: { readonly day: string; readonly month: string; readonly year: string };
}

export const EMPTY_WEIGHT_GOAL_DRAFT: WeightGoalDraft = {
  amountMode: 'kg_to_lose',
  amountText: '',
  timeMode: 'weeks',
  weeksText: '',
  date: { day: '', month: '', year: '' },
};

export type DraftParse =
  /** Noch unvollständig: keine Bewertung, kein Fehler (Ampel „noch keine Bewertung“). */
  | { readonly kind: 'partial' }
  /** Eingabe nicht lesbar (z. B. Buchstaben, unvollständiges Datum) – Fehler je Feld. */
  | { readonly kind: 'unreadable'; readonly errors: Readonly<Record<string, string>> }
  | { readonly kind: 'input'; readonly input: WeightGoalFormInput };

/** Entwurf → Eingabe für `evaluateWeightGoalInput` (Plan 2.2). Leere Felder = unvollständig. */
export function parseWeightGoalDraft(draft: WeightGoalDraft): DraftParse {
  const errors: Record<string, string> = {};
  const amount = parseDecimal(draft.amountText);
  const anyDatePart = draft.date.day + draft.date.month + draft.date.year !== '';
  const weeksRaw = draft.weeksText.trim();
  const timeEmpty = draft.timeMode === 'weeks' ? weeksRaw === '' : !anyDatePart;
  if (amount !== null && Number.isNaN(amount)) errors['amount.kg'] = W.issues.invalid_number;
  let time: WeightGoalFormInput['time'] | null = null;
  if (draft.timeMode === 'weeks' && weeksRaw !== '') {
    if (/^\d{1,3}$/.test(weeksRaw)) time = { mode: 'weeks', weeks: Number(weeksRaw) };
    else errors.time = W.issues.invalid_number;
  } else if (draft.timeMode === 'date' && anyDatePart) {
    const iso = isoFromDateParts(draft.date.day, draft.date.month, draft.date.year);
    if (iso === null) {
      errors.time = W.incompleteDate;
    } else if (!isoDateSchema.safeParse(iso).success) {
      errors.time = W.invalidDate;
    } else {
      time = { mode: 'date', date: iso };
    }
  }
  if (Object.keys(errors).length > 0) return { kind: 'unreadable', errors };
  if (amount === null || timeEmpty || time === null) return { kind: 'partial' };
  return { kind: 'input', input: { amount: { mode: draft.amountMode, kg: amount }, time } };
}

/**
 * Gespeichertes Ziel → Formular zum Bearbeiten (Plan 2.2, Wächter Runde 2 K-e): Im Modus „kg abnehmen“ steht
 * „aktuelles Gewicht − Zielgewicht“ im Feld (nur hier, kein Fortschritt). Passt die Differenz nicht in 0,5-kg-Schritte,
 * zeigt das Formular das Zielgewicht. Zeitraum ab heute (jedes Speichern plant ab heute neu, Wächter S15).
 */
export function draftFromWeightGoal(
  goal: WeightGoal,
  currentWeightKg: number | null,
  today: string,
): WeightGoalDraft {
  const diff =
    currentWeightKg === null ? null : Math.round((currentWeightKg - goal.targetWeightKg) * 10) / 10;
  const asKg =
    goal.amountMode === 'kg_to_lose' &&
    diff !== null &&
    diff > 0 &&
    isMultipleOf(diff, WEIGHT_GOAL_LIMITS.kgStep);
  const daysLeft = daysBetween(today, goal.targetDate);
  const weeks = Math.min(
    Math.max(Math.round(daysLeft / 7), WEIGHT_GOAL_LIMITS.weeks.min),
    WEIGHT_GOAL_LIMITS.weeks.max,
  );
  const dateMode = goal.timeMode === 'date' && daysLeft > 0;
  return {
    amountMode: asKg ? 'kg_to_lose' : 'target_weight',
    amountText: formatDecimal(asKg ? diff : goal.targetWeightKg),
    timeMode: dateMode ? 'date' : 'weeks',
    weeksText: dateMode ? '' : String(weeks),
    date: dateMode ? datePartsFromIso(goal.targetDate) : { day: '', month: '', year: '' },
  };
}

/** Wochen-Stepper: ±1 innerhalb 4–104 (leeres Feld startet beim Minimum). */
export function stepWeeks(text: string, delta: 1 | -1): string {
  const current = /^\d{1,3}$/.test(text.trim()) ? Number(text.trim()) : null;
  const { min, max } = WEIGHT_GOAL_LIMITS.weeks;
  const next = current === null ? min : Math.min(Math.max(current + delta, min), max);
  return String(next);
}

/**
 * Was „Weiter“ speichert (Plan 2.3, Wächter Z4 M3) – reine Regel:
 * - „ohne festes Ziel“ → kein Ziel (`null`, ein gespeichertes wird gelöscht).
 * - Konkretes Ziel gerade gesperrt (z. B. Schwangerschaft, Gewicht zu alt): ein gespeichertes Ziel RUHT und bleibt;
 *   ohne Einwilligung gibt es keins (der Widerruf löscht es) → `null`.
 * - Konkretes Ziel verfügbar: das neue, geprüfte Ziel; ist die Eingabe (noch) ungültig → `invalid` (nichts speichern).
 */
export type WeightGoalSaveDecision =
  { readonly kind: 'save'; readonly weightGoal: WeightGoal | null } | { readonly kind: 'invalid' };

export function weightGoalSaveDecision(input: {
  readonly mode: 'none' | 'concrete';
  readonly saved: WeightGoal | null;
  readonly availability: WeightGoalAvailability;
  /** Geprüftes neues Ziel (`evaluateWeightGoalInput` ok) oder null. */
  readonly evaluated: WeightGoal | null;
}): WeightGoalSaveDecision {
  if (input.mode === 'none') return { kind: 'save', weightGoal: null };
  if (!input.availability.available) {
    const rests = input.saved !== null && input.availability.reason !== 'no_consent';
    return { kind: 'save', weightGoal: rests ? input.saved : null };
  }
  return input.evaluated === null
    ? { kind: 'invalid' }
    : { kind: 'save', weightGoal: input.evaluated };
}
