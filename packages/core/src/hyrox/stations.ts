import { HYROX_PLAN, HYROX_STATION_EXERCISES, TEMPLATE_DOSAGE_LIMITS } from '../constants';
import type { Exercise } from '../content/schemas';
import type { CautionTag, ExperienceLevel, HyroxStation } from '../enums';
import type { CompetitionPhase } from '../plan/competition-schema';
import { clampRpe, fitSessionToMinutes, type PlannedExerciseDraft } from '../plan/adapt';
import { isExerciseAllowed } from '../plan/safety';
import { allowedHyroxStations } from './format';
import { HYROX_TEXTS_DE } from './texts';

/**
 * Stations-Einheit Hyrox (docs/PLAN-SPORTARTEN-STUFE-1.md 2.1, Etappe H): Kraft-Einheit mit Fokus `hyrox_stations` aus
 * festen Bausteinen (HYROX_PLAN.stationSessions, 6 Vorlagen) und der Ersatz-Kette je Station (HYROX_STATION_EXERCISES,
 * Entscheidung 5). Progression wie Kraft (doppelte Progression über den Wiederholungsbereich), 48-h-Regel über den
 * Wochenbau (Stations-Einheit zählt als Kraft mit Beinen). Reine Funktionen, keine KI.
 */

/** Was die Auswahl einer Übung braucht (Bibliothek, Geräte des Orts, Sicherheitsregeln). */
export interface HyroxStationContext {
  readonly library: ReadonlyMap<string, Exercise>;
  readonly available: ReadonlySet<string>;
  readonly excludedCautionTags: readonly CautionTag[];
}

/** Machbar (alle Geräte da), erlaubt (Merkmale) und in der Bibliothek (Supabase: nur freigegebene Inhalte)? */
function usable(exercise: Exercise | undefined, ctx: HyroxStationContext): exercise is Exercise {
  return (
    exercise !== undefined &&
    isExerciseAllowed(exercise, ctx) &&
    exercise.equipment_ids.every((id) => ctx.available.has(id))
  );
}

/** Ergebnis der Ersatz-Kette: Übung und ob sie die Station selbst ist. */
export interface StationChoice {
  readonly station: HyroxStation;
  readonly exercise: Exercise;
  /** true = nicht die Station selbst, sondern ein Ersatz („Ohne Schlitten – wir ersetzen die Station“). */
  readonly replaced: boolean;
}

/**
 * Erste machbare und erlaubte Übung der Kette einer Station (gleiches Muster → gleicher Hauptmuskel, nie schwerer);
 * `exclude` = schon verwendete Übungen der Einheit. null = keine Übung der Kette passt (Station entfällt).
 */
export function hyroxStationExercise(
  station: HyroxStation,
  ctx: HyroxStationContext,
  exclude: ReadonlySet<string> = new Set(),
): StationChoice | null {
  const chain: readonly string[] = HYROX_STATION_EXERCISES[station];
  for (const [i, id] of chain.entries()) {
    if (exclude.has(id)) continue;
    const exercise = ctx.library.get(id);
    if (usable(exercise, ctx)) return { station, exercise, replaced: i > 0 };
  }
  return null;
}

/** IDs der Stations-Übungen selbst (erste Glieder der Ketten). */
export const HYROX_STATION_EXERCISE_IDS: readonly string[] = Object.values(
  HYROX_STATION_EXERCISES,
).map((chain) => chain[0] as string);

/** Station, zu deren Kette eine Übung gehört (erste Kette in Rennreihenfolge), sonst null. */
export function stationOfExercise(exerciseId: string): HyroxStation | null {
  for (const [station, chain] of Object.entries(HYROX_STATION_EXERCISES)) {
    if ((chain as readonly string[]).includes(exerciseId)) return station as HyroxStation;
  }
  return null;
}

/** Baustein (Vorlage) der Stations-Einheit: Level × Phase (Tapering/Rennwoche/Erholung = Spitze, Erholungs-Dosierung). */
export function stationSessionSpec(
  level: ExperienceLevel,
  phase: CompetitionPhase,
  cautious: boolean,
) {
  const key = level === 'beginner' || cautious ? 'beginner' : 'advanced';
  const phaseKey = phase === 'base' || phase === 'build' ? phase : 'peak';
  return HYROX_PLAN.stationSessions[key][phaseKey];
}

/** Zeit-Übung (Tragen, Ergometer, Belastungsart Zeit) → Dauer statt Wiederholungen. */
function timed(exercise: Exercise): boolean {
  return (
    exercise.load_type === 'time' ||
    exercise.movement_pattern === 'carry' ||
    exercise.movement_pattern === 'conditioning'
  );
}

export interface HyroxStationSessionOptions extends HyroxStationContext {
  readonly level: ExperienceLevel;
  readonly phase: CompetitionPhase;
  /** Vorsichtige Startgruppe (Flag, ab 65, unter 18) → Einsteiger-Baustein. */
  readonly cautious: boolean;
  /** RPE-Deckel der Sicherheitsregeln (rules.rpeMax; unter 18 ≤ 8, HYROX_SAFETY). */
  readonly rpeMax: number;
  /** Minuten des Kraft-Tags (fitSessionToMinutes). */
  readonly minutes: number;
}

export interface HyroxStationSession {
  readonly name_de: string;
  readonly warmup_de: string;
  readonly cooldown_de: string;
  readonly exercises: readonly PlannedExerciseDraft[];
  /** Stationen mit Ersatz-Übung (Hinweis), in Rennreihenfolge. */
  readonly replaced: readonly HyroxStation[];
  readonly shortened: boolean;
}

/**
 * Stations-Einheit eines Tages: Stationen des Bausteins (ohne ausgeschlossene, z. B. Burpee-Weitsprünge ab 65), je
 * Station die erste machbare Übung der Kette (jede Übung höchstens einmal), Dosierung des Bausteins (RPE höchstens
 * `rpeMax`), dann auf die Minuten des Tages gekürzt. Leere Liste = keine Station machbar.
 */
export function hyroxStationSession(options: HyroxStationSessionOptions): HyroxStationSession {
  const spec = stationSessionSpec(options.level, options.phase, options.cautious);
  const allowed = new Set(allowedHyroxStations(options.excludedCautionTags));
  const used = new Set<string>();
  const exercises: PlannedExerciseDraft[] = [];
  const replaced: HyroxStation[] = [];
  const chosen = new Map<HyroxStation, string>();
  const D = TEMPLATE_DOSAGE_LIMITS;
  for (const station of spec.stations) {
    if (!allowed.has(station) || exercises.length >= D.maxExercisesPerSession) continue;
    const choice = hyroxStationExercise(station, options, used);
    if (!choice) continue;
    used.add(choice.exercise.id);
    chosen.set(station, choice.exercise.id);
    if (choice.replaced) replaced.push(station);
    const isTimed = timed(choice.exercise);
    const name = HYROX_TEXTS_DE.stations[station];
    exercises.push({
      order_no: exercises.length + 1,
      exercise_id: choice.exercise.id,
      source_exercise_id: choice.exercise.id,
      exercise_name_de: choice.exercise.name_de,
      sets: spec.sets,
      reps_min: isTimed ? null : spec.reps[0],
      reps_max: isTimed ? null : spec.reps[1],
      duration_s: isTimed
        ? Math.min(D.durationS.max, Math.max(D.durationS.min, spec.durationS))
        : null,
      rest_s: spec.restS,
      rpe_target: clampRpe(spec.rpe, options.rpeMax),
      superset_group: null,
      notes_de: choice.replaced
        ? HYROX_TEXTS_DE.stationSession.replacedNote(name)
        : HYROX_TEXTS_DE.stationSession.stationNote(name),
      target_weight_kg: null,
    });
  }
  const fit = fitSessionToMinutes(exercises, options.minutes, options.library);
  const kept = new Set(fit.exercises.map((e) => e.exercise_id));
  // Erholungs-Dosierung (Erholungswoche, Tapering, Rennwoche, Erholung nach dem Rennen) setzt der Wochenbau mit
  // dosageForWeek (Sätze halbiert, RPE −2) – hier die volle Dosierung des Bausteins.
  return {
    name_de: HYROX_TEXTS_DE.stationSession.name,
    warmup_de: HYROX_TEXTS_DE.stationSession.warmup,
    cooldown_de: HYROX_TEXTS_DE.stationSession.cooldown,
    exercises: fit.exercises,
    replaced: replaced.filter((s) => kept.has(chosen.get(s) ?? '')),
    shortened: fit.shortened,
  };
}

/** Hinweis-Codes einer Stations-Einheit (Anzeige): Schlitten ersetzt / anderes Spezialgerät ersetzt. */
export type HyroxStationNotice = 'sled_replaced' | 'station_replaced';

/**
 * Hinweise zu einer gespeicherten Einheit (nur Fokus hyrox_stations): Übungen mit dem Vermerk „Ersatz für die Station …“
 * (gespeichert in notes_de) → „Ohne Schlitten – wir ersetzen die Station“ (Schlitten) bzw. allgemeiner Hinweis.
 */
export function hyroxStationNotices(session: {
  readonly focus: string | null;
  readonly exercises: readonly { readonly notes_de: string | null }[];
}): HyroxStationNotice[] {
  if (session.focus !== 'hyrox_stations') return [];
  const notes = new Set(session.exercises.map((e) => e.notes_de));
  const replaced = (Object.keys(HYROX_TEXTS_DE.stations) as HyroxStation[]).filter((s) =>
    notes.has(HYROX_TEXTS_DE.stationSession.replacedNote(HYROX_TEXTS_DE.stations[s])),
  );
  const out: HyroxStationNotice[] = [];
  if (replaced.some((s) => s === 'sled_push' || s === 'sled_pull')) out.push('sled_replaced');
  if (replaced.some((s) => s !== 'sled_push' && s !== 'sled_pull')) out.push('station_replaced');
  return out;
}

/**
 * Reise-Modus (Plan 2.1): Stations-Schritt einer Kombi als Körpergewicht-Zirkel – Name der ersten Übung der Kette, die
 * mit den Reise-Geräten machbar und erlaubt ist (z. B. Wall Balls → Kniebeuge). null = keine passende Übung (Schritt als
 * lockeres Laufen bzw. Gehen ansagen).
 */
export function hyroxStationTravelName(
  station: HyroxStation,
  ctx: HyroxStationContext,
): string | null {
  return hyroxStationExercise(station, ctx)?.exercise.name_de ?? null;
}
