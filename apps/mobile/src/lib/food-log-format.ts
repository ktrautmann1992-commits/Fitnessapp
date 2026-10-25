import {
  addDays,
  type FoodLogBuildError,
  type DayIntakeView,
  type FoodLogEntry,
  type FoodLogFavorite,
  type FoodLogGroup,
  type FoodLogManualSlot,
  type FoodLogSlot,
  type FoodLogUnit,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';
import { formatGrams, formatKcal, formatNumberDe } from './nutrition-format';
import { dayLabel } from './plan-format';

/**
 * Anzeige des Ernährungstagebuchs (Etappe E1): nur Formatierung – keine Rechnung (Summen kommen aus packages/core,
 * `dayIntakeView`). Bei „Kalorienzahlen aus“ (showNumbers = false) erscheint nirgends eine kcal-Zahl.
 */

const FRACTIONS: Readonly<Record<string, string>> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
  '1.25': '1¼',
  '1.5': '1½',
  '1.75': '1¾',
  '2.25': '2¼',
  '2.5': '2½',
  '2.75': '2¾',
};

/** Portion als Bruch, z. B. 0.75 → „¾“, 1.5 → „1½“, 2 → „2“. */
export function portionNumber(value: number): string {
  return FRACTIONS[String(value)] ?? formatNumberDe(value);
}

/** „¾ Portion“ bzw. „2 Portionen“. */
export function portionText(value: number): string {
  const n = portionNumber(value);
  return value === 1 ? t.foodLog.portion('1') : value < 1 ? `${n} Portion` : t.foodLog.portion(n);
}

export function unitText(unit: FoodLogUnit): string {
  return t.foodLog.units[unit];
}

/** Menge bzw. Portion eines Eintrags, z. B. „1 Stück“, „150 g“, „¾ Portion“; Schnelleintrag ohne Menge → null. */
export function entryAmountText(
  entry: Pick<FoodLogEntry, 'amount' | 'unit' | 'portion'>,
): string | null {
  if (entry.amount !== null && entry.unit !== null) {
    const amount =
      entry.unit === 'piece' ? portionNumber(entry.amount) : formatNumberDe(entry.amount);
    return t.foodLog.amount(amount, unitText(entry.unit));
  }
  if (entry.portion !== null) return portionText(entry.portion);
  return null;
}

/**
 * Schnelleintrag „Auswärts gegessen“ (auch aus dem Reiter „Unterwegs“): Werte sind immer Schätzungen → „ca.“
 * (Gründer-Freigabe 25.10.2026).
 */
export function isEstimateEntry(entry: {
  readonly source: string;
  readonly title_de?: string;
}): boolean {
  return entry.source === 'quick' && entry.title_de === 'Auswärts gegessen';
}

/** Detailzeile: Menge · kcal (kcal nur mit Zahlen und nur, wenn bekannt; „ca.“ bei Schätzwerten). */
export function entryDetailText(
  entry: Pick<FoodLogEntry, 'amount' | 'unit' | 'portion' | 'kcal' | 'source'> & {
    readonly title_de?: string;
  },
  showNumbers: boolean,
): string {
  const parts: string[] = [];
  const amount = entryAmountText(entry);
  if (amount !== null) parts.push(amount);
  if (showNumbers && entry.kcal !== null) {
    const kcal = t.foodLog.kcal(formatKcal(entry.kcal));
    parts.push(isEstimateEntry(entry) ? `ca. ${kcal}` : kcal);
  }
  if (entry.source === 'plan_item') parts.push(t.foodLog.fromPlan);
  return parts.join(' · ');
}

/** Vorlage (Favorit/Zuletzt) als Detailzeile. */
export function templateDetailText(
  template: FoodLogFavorite | FoodLogEntry,
  showNumbers: boolean,
): string {
  return entryDetailText({ ...template, source: template.source }, showNumbers);
}

export function groupLabel(group: FoodLogGroup): string {
  return t.foodLog.groups[group];
}

export function manualSlotLabel(slot: FoodLogManualSlot): string {
  return t.foodLog.manualSlots[slot];
}

/** Platz eines Eintrags → Platz der Auswahl beim Bearbeiten (Zwischenmahlzeiten = Snack). */
export function manualSlotOf(slot: FoodLogSlot): FoodLogManualSlot {
  return slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' ? slot : 'other';
}

/** Tagessumme: mit Zahlen „3 Einträge · 1.240 kcal“, ohne Zahlen nur „3 Einträge“. */
export function intakeSummaryText(view: DayIntakeView): string {
  const count = t.foodLog.count(view.count);
  if (view.kind === 'count') return count;
  return t.foodLog.summary(count, t.foodLog.kcal(formatKcal(view.kcal)));
}

/** Makro-Zeile (nur mit Zahlen). */
export function intakeMacrosText(view: Extract<DayIntakeView, { kind: 'numbers' }>): string {
  return t.foodLog.macros(
    `${formatGrams(view.protein_g)} g`,
    `${formatGrams(view.carbs_g)} g`,
    `${formatGrams(view.fat_g)} g`,
  );
}

/** Tag als Text: „Heute“, „Gestern“, sonst „Mi, 14.10.“ (dayLabel). */
export function foodLogDayText(date: string, today: string): string {
  if (date === today) return t.foodLog.today;
  if (date === addDays(today, -1)) return t.foodLog.yesterday;
  return dayLabel(date) || formatDateDe(date);
}

/** Text zu einem nicht baubaren Eintrag – nie mit kcal-Zahl (auch bei „Zahlen aus“ lesbar, Wächter E1 S3). */
export function buildErrorText(reason: FoodLogBuildError): string {
  switch (reason) {
    case 'amount':
      return t.foodLog.amountRange;
    case 'unit':
      return t.foodLog.pieceUnavailable;
    case 'too_much':
      return t.foodLog.tooLarge;
    case 'portion':
    case 'invalid':
      return t.foodLog.errors.rejected;
  }
}

/**
 * Rückfrage ab einer großen Menge (Wächter E1 S3/G2): neutral, ohne Bewertung. Mit Zahlen nennt sie Menge und kcal,
 * ohne Zahlen („Zahlen aus“, Schwangerschaft) nur die Menge – nie kcal.
 */
export function confirmText(
  entry: Pick<FoodLogEntry, 'amount' | 'unit' | 'portion' | 'kcal'>,
  showNumbers: boolean,
): string {
  const parts: string[] = [];
  const amount = entryAmountText(entry);
  if (amount !== null) parts.push(amount);
  if (showNumbers && entry.kcal !== null) parts.push(t.foodLog.kcal(formatKcal(entry.kcal)));
  return parts.length === 0
    ? t.foodLog.confirmCheckPlain
    : t.foodLog.confirmCheck(parts.join(', '));
}
