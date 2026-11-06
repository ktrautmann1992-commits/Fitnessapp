import { z } from 'zod';

import { isoDateSchema } from '../age';
import { POST_WORKOUT_WINDOW_MIN, SESSION_START_TIME } from '../constants';
import type { NutritionDayTargets } from './targets';
import type { MealSlotId } from './timing';
import type {
  TimelineExtra,
  TimelineMeal,
  TimelineReason,
  TrainingDayTimeline,
} from './training-timeline';

/**
 * „Nach dem Training: Das solltest du jetzt essen“ (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md 6a).
 * Nach JEDER erledigten Einheit mit Uhrzeit (geplant, frei oder von der Smartwatch) zeigt die App die Mahlzeit „nach dem
 * Training“ aus dem (angepassten) Essensplan – samt Eiweiß/Kohlenhydraten dieses Platzes, nur wenn die Zeitleiste Gramm
 * zeigen darf. Diese Datei entscheidet nur, OB und WELCHE Mahlzeit: Sie rechnet keine Mengen und keine Grenzen (die
 * Tageswerte kommen unverändert aus `nutritionTargetsForWeek` → `clampCalorieTarget`).
 */

export interface PostWorkoutMealNow {
  readonly date: string;
  /** Platz der Mahlzeit danach; null = keine Mahlzeit bis 2 h danach geplant (dann nur der Snack-Vorschlag). */
  readonly slot: MealSlotId | null;
  readonly sessionId: string;
  readonly sessionKind: NonNullable<TrainingDayTimeline['entries'][number]['session']>['kind'];
  /** Ende der Einheit und „bis“ der Mahlzeit danach (Minuten nach Mitternacht). */
  readonly endMinutes: number;
  readonly untilMinutes: number;
  /** Minuten seit dem Ende (0 = gerade fertig). */
  readonly minutesSinceEnd: number;
  readonly reason: TimelineReason;
  /** Gericht aus dem Essensplan (Portion, Werte nur mit Gramm). */
  readonly meal: TimelineMeal | null;
  /** Snack bzw. Beilage aus dem Bestand (wie in der Zeitleiste). */
  readonly extra: TimelineExtra | null;
  readonly extraKind: 'snack' | 'side' | null;
  /**
   * Richtwerte dieses Platzes (gerundet, `slotMacroTargets`): Eiweiß = Richtwert nach dem Training (0,4 g/kg, ab 65
   * mind. 25 g), Kohlenhydrate = Auffüll-Richtwert bei zwei Einheiten, sonst der geplante Anteil des Platzes. null ohne
   * Gramm bzw. ohne Platz.
   */
  readonly proteinG: number | null;
  readonly carbsG: number | null;
}

/** Tagebuch-Einträge, die als „trainiert“ zählen (auch vorzeitig beendet, `session_log_status`). */
const LOGGED: ReadonlySet<string> = new Set(['completed', 'partial']);

const nowMinutesSchema = z
  .number()
  .int()
  .min(SESSION_START_TIME.minMinutes)
  .max(SESSION_START_TIME.maxMinutes);

/**
 * Ist JETZT das Fenster nach dem Training – und welche Mahlzeit? Regeln:
 * - nur heute; nur erledigte Einheiten mit eigener Uhrzeit (`approx` = ohne Uhrzeit zählt nicht);
 * - maßgeblich ist die zuletzt beendete Einheit, die vor höchstens POST_WORKOUT_WINDOW_MIN (180 min) endete (eine
 *   gerade erst eingetragene, laut Dauer noch „laufende“ Einheit gilt als eben beendet);
 * - hat danach schon eine weitere Einheit mit Uhrzeit begonnen, gibt es keine Karte (die nächste kommt nach ihr);
 * - die Mahlzeit ist die „nach dem Training“ dieser Einheit aus der Zeitleiste; schon gegessen (Eintrag in diesem
 *   Platz) → keine Karte. Ohne Mahlzeit, aber mit Snack-Vorschlag: Karte mit dem Snack.
 * null = keine Karte.
 */
export function postWorkoutMealNow(input: {
  readonly day: Pick<NutritionDayTargets, 'date' | 'trainingTiming'>;
  readonly timeline: TrainingDayTimeline | null;
  readonly today: string;
  /** Jetzt in Minuten nach Mitternacht (Europe/Berlin). */
  readonly nowMinutes: number;
  /** Plätze mit Eintrag im Ernährungstagebuch als `datum|platz` (wie TrainingMealProtection.eaten). */
  readonly eaten: ReadonlySet<string>;
  /** Erledigte Einheiten (`completedNutritionSessionIds`). */
  readonly completedSessionIds: ReadonlySet<string>;
}): PostWorkoutMealNow | null {
  const today = isoDateSchema.parse(input.today);
  const now = nowMinutesSchema.parse(input.nowMinutes);
  const { timeline, day } = input;
  if (timeline === null || day.date !== today || timeline.date !== today) return null;
  const completed = input.completedSessionIds;
  const entries = timeline.entries;
  let best = -1;
  entries.forEach((e, i) => {
    const id = e.session?.sessionId ?? null;
    if (e.kind !== 'session' || e.approx || id === null || !completed.has(id)) return;
    if (e.fromMinutes > now || now - e.toMinutes > POST_WORKOUT_WINDOW_MIN) return;
    const current = entries[best];
    if (current === undefined || e.toMinutes >= current.toMinutes) best = i;
  });
  const session = entries[best];
  if (session === undefined || session.session === null || session.session.sessionId === null) {
    return null;
  }
  const laterStarted = entries.some(
    (e, i) =>
      i !== best &&
      e.kind === 'session' &&
      !e.approx &&
      e.fromMinutes > session.fromMinutes &&
      e.fromMinutes <= now,
  );
  if (laterStarted) return null;
  const post = entries[best + 1];
  if (post === undefined || post.kind !== 'post_meal') return null;
  if (post.meal === null && post.extra === null) return null;
  if (post.meal !== null && input.eaten.has(`${today}|${post.meal.slot}`)) return null;
  const target =
    post.meal !== null && timeline.grams
      ? (day.trainingTiming?.mealTargets?.find((t) => t.slot === post.meal?.slot) ?? null)
      : null;
  return {
    date: today,
    slot: post.meal?.slot ?? null,
    sessionId: session.session.sessionId,
    sessionKind: session.session.kind,
    endMinutes: session.toMinutes,
    untilMinutes: post.toMinutes,
    minutesSinceEnd: Math.max(0, now - session.toMinutes),
    reason: post.reason,
    meal: post.meal,
    extra: post.extra,
    extraKind: post.extraKind,
    proteinG: target === null ? null : Math.round(target.proteinGuideG ?? target.proteinG),
    carbsG: target === null ? null : Math.round(target.carbsGuideG ?? target.carbsG),
  };
}

/**
 * Kennungen der erledigten Einheiten, wie sie die Ernährungs-Engine führt: geplante Einheiten mit Status „erledigt“
 * (`planned_sessions.id`) und freie Einträge – auch vorzeitig beendete – (`free:<id>`, `freeSessionNutritionSessions`).
 */
export function completedNutritionSessionIds(
  planned: readonly { readonly id: string; readonly status: string }[],
  logs: readonly { readonly id: string; readonly is_free?: boolean; readonly status: string }[],
): Set<string> {
  return new Set([
    ...planned.filter((s) => s.status === 'completed').map((s) => s.id),
    ...logs.filter((l) => l.is_free === true && LOGGED.has(l.status)).map((l) => `free:${l.id}`),
  ]);
}

/**
 * Schnelle Vorprüfung (ohne Essensplan): Gibt es einen Tagebuch-Eintrag (erledigt oder vorzeitig beendet), der vor höchstens
 * POST_WORKOUT_WINDOW_MIN endete (Ende `finished_at`, sonst Beginn `started_at`)? Nur dann lohnt es, die Karte „Nach dem
 * Training“ zu berechnen (z. B. auf „Heute“). Zeitstempel bis 5 min in der Zukunft (Uhr leicht verstellt) zählen als
 * „jetzt“.
 */
export function hasRecentlyFinishedSession(
  logs: readonly {
    readonly status: string;
    readonly started_at: string | null;
    readonly finished_at: string | null;
  }[],
  nowMs: number,
): boolean {
  const windowMs = POST_WORKOUT_WINDOW_MIN * 60_000;
  return logs.some((log) => {
    if (!LOGGED.has(log.status)) return false;
    const at = Date.parse(log.finished_at ?? log.started_at ?? '');
    if (!Number.isFinite(at)) return false;
    return at <= nowMs + 5 * 60_000 && nowMs - at <= windowMs;
  });
}
