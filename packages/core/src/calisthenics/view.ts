import { SKILL_PROGRESSION } from '../constants';
import type { ExerciseLogEntry } from '../log/types';
import { type SkillGate, type SkillGateContext, skillStageGate } from './gates';
import { countedEntries, type SkillStageProgress, skillStageProgress } from './progression';
import {
  SKILL_PATHS,
  type SkillPath,
  type SkillPathId,
  type SkillTarget,
  skillStagesOf,
} from './skill-paths';

/**
 * Anzeige der Skill-Pfade (Bildschirm „Skill-Pfade“) und der Hinweis im Training „Nächste Stufe freigeschaltet“
 * (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.2/2.5). Neutral formuliert: keine Abzeichen, keine Punkte, kein Teilen.
 */

/** Rolle einer Stufe in der Anzeige. */
export type SkillStageRole = 'done' | 'current' | 'next' | 'later';

export interface SkillStageView {
  readonly index: number;
  readonly exerciseId: string;
  /** Name aus der Bibliothek; null, wenn die Übung (noch) nicht verfügbar ist. */
  readonly nameDe: string | null;
  readonly target: SkillTarget;
  readonly role: SkillStageRole;
  readonly gate: SkillGate;
  /** Nur bei der aktuellen Stufe. */
  readonly progress: SkillStageProgress | null;
}

export interface SkillPathView {
  readonly pathId: SkillPathId;
  readonly group: SkillPath['group'];
  /** Aktuelle Stufe: höchste mit einem gewerteten Eintrag in SKILL_PROGRESSION.activeWindowDays; sonst 0. */
  readonly currentIndex: number;
  /** Noch kein Eintrag in diesem Pfad. */
  readonly started: boolean;
  readonly stages: readonly SkillStageView[];
  /**
   * Vorschlag: `advance` = nächste Stufe freigeschaltet (Ziel sauber erreicht UND keine Sperre), `regress` = vorige
   * Stufe üben, `mastered` = letzte Stufe sauber erreicht, `blocked` = Ziel erreicht, nächste Stufe aber gesperrt.
   */
  readonly suggestion: 'advance' | 'regress' | 'mastered' | 'blocked' | null;
}

/** Aktuelle Stufe eines Pfads aus dem Tagebuch (höchste gewertete Stufe im Fenster). */
export function currentSkillStage(
  path: SkillPath,
  logs: readonly ExerciseLogEntry[],
  today: string,
): { readonly index: number; readonly started: boolean } {
  for (let i = path.stages.length - 1; i >= 0; i -= 1) {
    const stage = path.stages[i];
    if (stage && countedEntries(stage.exerciseId, logs, today).length > 0) {
      return { index: i, started: true };
    }
  }
  return { index: 0, started: false };
}

/** Anzeige eines Pfads mit Rollen, Sperren und Vorschlag. */
export function skillPathView(path: SkillPath, ctx: SkillGateContext): SkillPathView {
  const { index: current, started } = currentSkillStage(path, ctx.logs, ctx.today);
  const currentStage = path.stages[current];
  const progress = currentStage
    ? skillStageProgress(currentStage.exerciseId, currentStage.target, ctx.logs, ctx.today)
    : null;
  const stages: SkillStageView[] = path.stages.map((stage, index) => ({
    index,
    exerciseId: stage.exerciseId,
    nameDe: ctx.library.get(stage.exerciseId)?.name_de ?? null,
    target: stage.target,
    role:
      index < current
        ? 'done'
        : index === current
          ? 'current'
          : index === current + 1
            ? 'next'
            : 'later',
    gate: skillStageGate(path, index, ctx),
    progress: index === current ? progress : null,
  }));
  let suggestion: SkillPathView['suggestion'] = null;
  if (progress?.status === 'ready') {
    const next = stages[current + 1];
    suggestion = next ? (next.gate.allowed ? 'advance' : 'blocked') : 'mastered';
  } else if (progress?.status === 'struggling' && current > 0) {
    suggestion = 'regress';
  }
  return { pathId: path.id, group: path.group, currentIndex: current, started, stages, suggestion };
}

/** Alle Pfade (Reihenfolge SKILL_PATHS). */
export function skillPathViews(ctx: SkillGateContext): SkillPathView[] {
  return SKILL_PATHS.map((path) => skillPathView(path, ctx));
}

export type SkillStepHint =
  | {
      readonly kind: 'unlocked';
      readonly pathId: SkillPathId;
      readonly exerciseId: string;
      readonly nameDe: string;
    }
  | {
      readonly kind: 'step_back';
      readonly pathId: SkillPathId;
      readonly exerciseId: string;
      readonly nameDe: string;
    };

/**
 * Hinweis im Training zu einer Übung (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.5): „Nächste Stufe freigeschaltet: …“,
 * wenn die Übung eine Stufe ist, das Ziel nach der Regel erreicht ist (`logs` enthält die laufende Einheit, wenn die
 * App sie mitzählen will) und die nächste Stufe keine Sperre hat; „Vorige Stufe üben: …“ nach wiederholtem deutlichem
 * Verfehlen. Steht die Übung in mehreren Pfaden, gilt der erste Treffer mit Hinweis. Sonst null.
 */
export function skillStepHint(exerciseId: string, ctx: SkillGateContext): SkillStepHint | null {
  for (const { path, index } of skillStagesOf(exerciseId)) {
    const stage = path.stages[index];
    if (!stage) continue;
    const progress = skillStageProgress(exerciseId, stage.target, ctx.logs, ctx.today);
    if (progress.status === 'ready') {
      const next = path.stages[index + 1];
      const nextExercise = next ? ctx.library.get(next.exerciseId) : undefined;
      if (next && nextExercise && skillStageGate(path, index + 1, ctx).allowed) {
        // Schon auf der nächsten Stufe unterwegs → kein Hinweis mehr.
        if (countedEntries(next.exerciseId, ctx.logs, ctx.today).length > 0) continue;
        return {
          kind: 'unlocked',
          pathId: path.id,
          exerciseId: next.exerciseId,
          nameDe: nextExercise.name_de,
        };
      }
    } else if (progress.status === 'struggling' && index > 0) {
      const previous = path.stages[index - 1];
      const previousExercise = previous ? ctx.library.get(previous.exerciseId) : undefined;
      if (previous && previousExercise && skillStageGate(path, index - 1, ctx).allowed) {
        return {
          kind: 'step_back',
          pathId: path.id,
          exerciseId: previous.exerciseId,
          nameDe: previousExercise.name_de,
        };
      }
    }
  }
  return null;
}

/** Gewertete Einheiten, die bis zur nächsten Stufe noch sauber gelingen müssen (für „Noch 1 saubere Einheit“). */
export function cleanSessionsToGo(progress: SkillStageProgress | null): number {
  if (!progress) return SKILL_PROGRESSION.advanceSessions;
  return Math.max(0, SKILL_PROGRESSION.advanceSessions - progress.cleanStreak);
}
