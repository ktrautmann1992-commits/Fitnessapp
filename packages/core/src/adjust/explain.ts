import { ADJUSTMENT_RULES, type AdjustmentHintCode, type AdjustmentProposal } from './types';

/**
 * Erklärungen „Warum hat sich mein Plan geändert?“ (docs/PLAN-PHASE-4B.md 5.5): feste Textbausteine, KEINE KI. Die
 * Parameter sind nur Zahlen, Datumsangaben und Übungs-IDs (Namen aus der Bibliothek). Keine Gesundheitsbegriffe, keine
 * Aussage über den Körper – nur über das Training.
 *
 * Die deutschen Bausteine stehen in `texts-de.ts` (ADJUST_EXPLAIN_DE/ADJUST_HINTS_DE); die App bindet sie unter
 * `t.adjust` ein. Hier stehen die Schlüssel, die Auswahl des Schlüssels und das Einsetzen der Parameter.
 */

/** Alle Schlüssel der Erklärtexte (jede Regel aus adjustment_rule – auch reservierte – plus Varianten). */
export const EXPLAIN_KEYS = [
  ...ADJUSTMENT_RULES,
  'fast_increase_reps',
  'load_reduce_reps',
  'load_reduce_hold',
] as const;
export type ExplainKey = (typeof EXPLAIN_KEYS)[number];

/** Alle Hinweis-Codes der Engine (Texte in der App). */
export const ADJUSTMENT_HINT_CODES = [
  'deload_soon',
  'rest_this_week',
  'shorter_sessions',
  'weekly_limit_reached',
] as const satisfies readonly AdjustmentHintCode[];

/** Schlüssel und Parameter einer Anpassung (Parameter unverändert aus `explain_params`). */
export function explainAdjustment(
  adj: Pick<AdjustmentProposal, 'rule' | 'explainParams' | 'stateBefore' | 'stateAfter'>,
): { readonly key: ExplainKey; readonly params: AdjustmentProposal['explainParams'] } {
  const p = adj.explainParams;
  if (adj.rule === 'load_reduce' || adj.rule === 'fast_increase') {
    const weightChanged =
      typeof p.weight_before === 'number' &&
      typeof p.weight_after === 'number' &&
      p.weight_after > 0 &&
      p.weight_after !== p.weight_before;
    if (!weightChanged) {
      if (adj.rule === 'fast_increase') return { key: 'fast_increase_reps', params: p };
      const hold = adj.stateAfter?.durationS !== adj.stateBefore?.durationS;
      return { key: hold ? 'load_reduce_hold' : 'load_reduce_reps', params: p };
    }
  }
  return { key: adj.rule, params: p };
}

const formatNumber = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace('.', ',');
const formatDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/**
 * Erklärsatz aus einem Textbaustein (`template`, z. B. `t.adjust.explain[key]` der App). `names`: Übungs-ID → Name aus
 * der Bibliothek (nur dort kommen Namen her). Platzhalter `{exercise}`/`{new_exercise}` lesen
 * `exercise_id`/`new_exercise_id`; Zahlen deutsch (Komma), Datumsangaben als TT.MM.
 */
export function renderExplanation(
  template: string,
  params: AdjustmentProposal['explainParams'],
  names: ReadonlyMap<string, string>,
): string {
  const value = (name: string): string => {
    if (name === 'exercise' || name === 'new_exercise') {
      const id = params[`${name}_id`];
      return typeof id === 'string' ? (names.get(id) ?? id) : '';
    }
    const v = params[name];
    if (typeof v === 'number') return formatNumber(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v);
    return v === undefined ? '' : String(v);
  };
  return template.replace(/\{([a-z_]+)\}/g, (_, name: string) => value(name));
}
