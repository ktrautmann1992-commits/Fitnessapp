import { ADJUSTMENT_RULES, type AdjustmentHintCode, type AdjustmentProposal } from './types';

/**
 * Erklärungen „Warum hat sich mein Plan geändert?“ (docs/PLAN-PHASE-4B.md 5.5): feste Textbausteine, KEINE KI. Die
 * Parameter sind nur Zahlen, Datumsangaben und Übungs-IDs (Namen aus der Bibliothek). Keine Gesundheitsbegriffe, keine
 * Aussage über den Körper – nur über das Training. Etappe D übernimmt die Bausteine in `apps/mobile/src/i18n/de.ts`
 * (Bereich `adjust`); bis dahin nutzt sie die CI-Zusammenfassung „Beispiel-Anpassungen“.
 */

export type ExplainKey =
  | (typeof ADJUSTMENT_RULES)[number]
  | 'fast_increase_reps'
  | 'load_reduce_reps'
  | 'load_reduce_hold';

export const ADJUST_TEXTS_DE: Readonly<Record<ExplainKey, string>> = {
  fast_increase:
    '{exercise} lief mit viel Reserve – du steigerst schon jetzt: nächstes Mal {weight_after} kg statt {weight_before} kg.',
  fast_increase_reps:
    '{exercise} lief mit viel Reserve – du steigerst schon jetzt und nicht erst nach zwei Einheiten.',
  load_reduce:
    '{exercise} war zweimal deutlich zu schwer – nächstes Mal {weight_after} kg statt {weight_before} kg.',
  load_reduce_reps:
    '{exercise} war zweimal deutlich zu schwer – nächstes Mal mit dem unteren Wiederholungsziel und ohne Zusatzsatz.',
  load_reduce_hold: '{exercise} war zweimal deutlich zu schwer – nächstes Mal etwas kürzer halten.',
  volume_reduce:
    'Deine letzten drei Krafteinheiten waren sehr anstrengend – in der Woche ab {week_start} machst du je Übung {sets_reduction} Satz weniger.',
  deload_forward:
    'Du warst länger am Limit – deine Erholungswoche ist auf die Woche ab {week_start} vorgezogen. Die Woche ab {swapped_week_start} wird eine normale Trainingswoche wie die Woche davor.',
  endurance_reduce:
    'Deine letzten Ausdauer-Einheiten waren sehr anstrengend – in der Woche ab {week_start} sind sie etwas kürzer (rund {percent} % der Zeit).',
  stagnation_variation:
    'Bei {exercise} ging es seit {days} Tagen nicht weiter – ab jetzt machst du {new_exercise} als neuen Reiz.',
  fewer_days:
    'Du hast in den letzten 3 Wochen {done} von {planned} Einheiten geschafft. Möchtest du auf {days} Tage umstellen?',
  // Reserviert (in 4b nicht aktiv) – Texte stehen schon fest, damit jede Regel einen Baustein hat.
  calorie_adjust: 'Dein Tagesziel wurde um {kcal} kcal angepasst.',
  muscle_gain_volume:
    'Für deinen Muskelaufbau gibt es ab der Woche ab {week_start} etwas mehr Sätze.',
  readiness_lighter: 'Heute etwas leichter – passend zu deiner Tagesform.',
};

export const ADJUST_HINTS_DE: Readonly<Record<AdjustmentHintCode, string>> = {
  deload_soon: 'Deine Erholungswoche kommt bald – bis dahin darf es etwas ruhiger sein.',
  rest_this_week: 'Gönn dir diese Woche etwas Ruhe.',
  shorter_sessions: 'Kürzere Einheiten? Du kannst die Dauer deines Trainingstags anpassen.',
  weekly_limit_reached:
    'Diese Woche gab es schon einige Anpassungen – weitere schlagen wir frühestens nächste Woche vor.',
};

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
 * Erklärsatz auf Deutsch. `names`: Übungs-ID → Name aus der Bibliothek (nur dort kommen Namen her). Platzhalter
 * `{exercise}`/`{new_exercise}` lesen `exercise_id`/`new_exercise_id`.
 */
export function renderExplanation(
  key: ExplainKey,
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
  return ADJUST_TEXTS_DE[key].replace(/\{([a-z_]+)\}/g, (_, name: string) => value(name));
}
