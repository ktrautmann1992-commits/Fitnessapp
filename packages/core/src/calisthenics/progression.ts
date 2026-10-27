import { SKILL_PROGRESSION } from '../constants';
import { addDays } from '../dates';
import type { ExerciseLogEntry, LoggedSet } from '../log/types';
import type { SkillTarget } from './skill-paths';

/**
 * Fortschritts-Regel der Skill-Pfade (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.2, SKILL_PROGRESSION): rein und
 * deterministisch aus dem Trainingstagebuch. Nie ein automatischer Tausch – das Ergebnis ist ein Vorschlag.
 */

/** Bewertung einer Einheit an einer Stufe. */
export type SkillSessionVerdict = 'clean' | 'partial' | 'miss';

/** Ein Eintrag zählt: gemacht (nicht ausgelassen), keine Einstiegs-/Erholungswoche, kein Wiedereinstieg, nicht frei. */
export function countsForSkill(
  entry: Pick<ExerciseLogEntry, 'status' | 'isIntroWeek' | 'isDeload' | 'isReturn' | 'isFree'>,
): boolean {
  return (
    entry.status !== 'skipped' &&
    !entry.isIntroWeek &&
    !entry.isDeload &&
    !(entry.isReturn ?? false) &&
    !(entry.isFree ?? false)
  );
}

/** Wert eines Satzes für das Ziel: Wiederholungen bzw. Sekunden (0, wenn nicht eingetragen). */
function setValue(set: LoggedSet, target: SkillTarget): number {
  return (target.seconds !== null ? set.durationS : set.reps) ?? 0;
}

function targetValue(target: SkillTarget): number {
  return target.seconds ?? target.reps ?? 0;
}

/** „Sauber“: RPE eingetragen und höchstens SKILL_PROGRESSION.cleanRpeMax – oder ohne Angabe (RPE ist freiwillig). */
export function isCleanSet(set: Pick<LoggedSet, 'rpe'>): boolean {
  return set.rpe === null || set.rpe <= SKILL_PROGRESSION.cleanRpeMax;
}

/**
 * Bewertung einer Einheit:
 * - `clean`: mindestens `target.sets` gemachte Sätze, die besten `target.sets` davon jeweils ≥ Ziel und sauber,
 * - `miss`: bester Satz unter `missShare` × Ziel (aufgerundet) oder kein gemachter Satz,
 * - sonst `partial`.
 */
export function skillSessionVerdict(
  entry: Pick<ExerciseLogEntry, 'sets'>,
  target: SkillTarget,
): SkillSessionVerdict {
  const goal = targetValue(target);
  const done = entry.sets.filter((set) => set.done);
  const values = done
    .map((set) => ({ value: setValue(set, target), clean: isCleanSet(set) }))
    .sort((a, b) => b.value - a.value);
  const best = values[0]?.value ?? 0;
  if (best < Math.ceil(goal * SKILL_PROGRESSION.missShare)) return 'miss';
  const top = values.slice(0, target.sets);
  if (top.length >= target.sets && top.every((v) => v.value >= goal && v.clean)) return 'clean';
  return 'partial';
}

const byNewest = (a: ExerciseLogEntry, b: ExerciseLogEntry) =>
  a.performedOn !== b.performedOn
    ? a.performedOn < b.performedOn
      ? 1
      : -1
    : a.loggedAt < b.loggedAt
      ? 1
      : a.loggedAt > b.loggedAt
        ? -1
        : 0;

/** Gewertete Einträge einer Übung bis `today` in einem Fenster von `windowDays` Tagen, neueste zuerst. */
export function countedEntries(
  exerciseId: string,
  logs: readonly ExerciseLogEntry[],
  today: string,
  windowDays: number = SKILL_PROGRESSION.activeWindowDays,
): ExerciseLogEntry[] {
  const from = addDays(today, -windowDays);
  return logs
    .filter(
      (e) =>
        e.exerciseId === exerciseId &&
        e.performedOn <= today &&
        e.performedOn > from &&
        countsForSkill(e),
    )
    .sort(byNewest);
}

/** Stand an einer Stufe. */
export type SkillStageStatus =
  /** noch kein gewerteter Eintrag */
  | 'not_started'
  /** üben (Ziel noch nicht zweimal hintereinander sauber) */
  | 'practicing'
  /** Ziel `advanceSessions`-mal hintereinander sauber → nächste Stufe vorschlagen */
  | 'ready'
  /** `regressMisses`-mal hintereinander deutlich verfehlt → vorige Stufe vorschlagen */
  | 'struggling';

export interface SkillStageProgress {
  readonly status: SkillStageStatus;
  /** Bewertungen der letzten Einheiten, neueste zuerst (höchstens so viele, wie die Regeln brauchen). */
  readonly recent: readonly SkillSessionVerdict[];
  /** Saubere Einheiten in Folge (neueste zuerst gezählt). */
  readonly cleanStreak: number;
}

export function skillStageProgress(
  exerciseId: string,
  target: SkillTarget,
  logs: readonly ExerciseLogEntry[],
  today: string,
): SkillStageProgress {
  const entries = countedEntries(exerciseId, logs, today);
  if (entries.length === 0) return { status: 'not_started', recent: [], cleanStreak: 0 };
  const verdicts = entries
    .slice(0, Math.max(SKILL_PROGRESSION.advanceSessions, SKILL_PROGRESSION.regressMisses))
    .map((e) => skillSessionVerdict(e, target));
  let cleanStreak = 0;
  for (const v of verdicts) {
    if (v !== 'clean') break;
    cleanStreak += 1;
  }
  const lastMisses = verdicts.slice(0, SKILL_PROGRESSION.regressMisses);
  const status: SkillStageStatus =
    cleanStreak >= SKILL_PROGRESSION.advanceSessions
      ? 'ready'
      : lastMisses.length === SKILL_PROGRESSION.regressMisses &&
          lastMisses.every((v) => v === 'miss')
        ? 'struggling'
        : 'practicing';
  return { status, recent: verdicts, cleanStreak };
}

/**
 * Beste saubere Wiederholungszahl in EINEM Satz (Voraussetzungen wie „8 saubere Klimmzüge“) aus den gewerteten
 * Einträgen der letzten SKILL_PROGRESSION.achievementWindowDays Tage. 0 = keine.
 */
export function bestCleanReps(
  exerciseId: string,
  logs: readonly ExerciseLogEntry[],
  today: string,
): number {
  let best = 0;
  for (const entry of countedEntries(
    exerciseId,
    logs,
    today,
    SKILL_PROGRESSION.achievementWindowDays,
  )) {
    for (const set of entry.sets) {
      if (set.done && isCleanSet(set) && (set.reps ?? 0) > best) best = set.reps ?? 0;
    }
  }
  return best;
}
