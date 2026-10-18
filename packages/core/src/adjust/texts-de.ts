import type { ExplainKey } from './explain';
import type { AdjustmentHintCode } from './types';

/**
 * Deutsche Erklärsätze der Live-Anpassung (docs/PLAN-PHASE-4B.md 5.5): feste Textbausteine, KEINE KI. Fachliche Texte
 * zur Logik stehen in packages/core (wie Gesundheits-Fragen und Mess-Anleitungen, siehe Kopf von
 * apps/mobile/src/i18n/de.ts); die App bindet sie unter `t.adjust.explain`/`t.adjust.hints` ein, die
 * CI-Zusammenfassung „Beispiel-Anpassungen“ nutzt dieselben – jeder Text genau einmal. Keine Gesundheitsbegriffe, keine
 * Aussage über den Körper, nur über das Training (Test in texts-de.test.ts).
 */
export const ADJUST_EXPLAIN_DE: Readonly<Record<ExplainKey, string>> = {
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
