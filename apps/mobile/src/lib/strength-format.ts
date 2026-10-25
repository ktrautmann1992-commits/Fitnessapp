import type { StrengthComparison, StrengthMetric } from '@fitnessapp/core';

import { t } from '@/i18n';

import type { A11yText } from './history-format';

/**
 * Anzeige-Texte der Kraft-Entwicklung (Gründer-Freigabe 25.10.2026; rein, getestet in strength-format.test.ts). Keine
 * Fachlogik: Werte und Vergleiche kommen aus packages/core (`strength-progress.ts`), hier wird nur formuliert – mit
 * Komma, Tausenderpunkt beim Volumen und ausgeschriebenen Einheiten für den Bildschirmleser. Neutral: ein Minus ist so
 * sachlich wie ein Plus.
 */

/** Zahl einer Kennzahl ohne Einheit: Gewicht mit bis zu 2 Nachkommastellen, Volumen ganz mit Tausenderpunkt. */
export function strengthNumber(metric: StrengthMetric, value: number): string {
  const abs = Math.abs(value);
  if (metric === 'volume') {
    return Math.round(abs)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  if (metric === 'weight') {
    return String(Math.round(abs * 100) / 100).replace('.', ',');
  }
  return String(Math.round(abs));
}

/** Wert mit Einheit, z. B. „62,5 kg“, „1.480 kg“, „26 Wdh.“, „45 s“. */
export function strengthValueText(metric: StrengthMetric, value: number): A11yText {
  const n = strengthNumber(metric, value);
  return { text: t.strength.value[metric](n), a11y: t.strength.valueA11y[metric](n) };
}

/**
 * Vergleich in Worten, z. B. „+5 kg gegenüber vor 4 Wochen“, „−2,5 kg gegenüber vor 4 Wochen“, „gleich wie vor
 * 4 Wochen“, „Erholungswoche – bewusst leichter.“; null ohne Vergleich.
 */
export function strengthComparisonText(comparison: StrengthComparison): A11yText | null {
  if (comparison.kind === 'none') return null;
  if (comparison.kind === 'deload') return { text: t.strength.deload, a11y: t.strength.deload };
  const { metric, delta, weeksAgo } = comparison;
  if (delta === 0) {
    const same = t.strength.same(weeksAgo);
    return { text: same, a11y: same };
  }
  const value = strengthValueText(metric, delta);
  const sign = delta > 0 ? '+' : '−';
  return {
    text: t.strength.change(`${sign}${value.text}`, weeksAgo),
    a11y: t.strength.changeA11y(value.a11y, delta > 0, weeksAgo),
  };
}
