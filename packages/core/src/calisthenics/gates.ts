import { SKILL_GATES } from '../constants';
import type { Exercise } from '../content/schemas';
import type { ExperienceLevel } from '../enums';
import type { ExerciseLogEntry } from '../log/types';
import { isBlockedByPain, type PainEffect } from '../modes/pain';
import { type EquipmentProfile, isExerciseFeasible } from '../plan/equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from '../plan/safety';
import { bestCleanReps } from './progression';
import type { SkillPath, SkillStage } from './skill-paths';

/**
 * Sicherheits-Sperren der Skill-Pfade (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.3, SKILL_GATES). Eine Stufe ist nur
 * „freischaltbar“, wenn KEIN Grund dagegen spricht. Gründe (Reihenfolge = Anzeige):
 * - `missing_content`: Übung nicht in der Bibliothek (Supabase: noch nicht freigegeben),
 * - `safety_rules`: nach den Plan-Regeln nicht erlaubt (z. B. `high_skill` im vorsichtigen Plan, unter 18, ab 65,
 *   „Fit im Alter“, Schwangerschaft) – dieselbe Prüfung wie im Plan (isExerciseAllowed),
 * - `age`: ab SKILL_GATES.seniorFromAge keine Stufe für Fortgeschrittene bzw. mit hoher Technik,
 * - `experience`: Stufe nur für Fortgeschrittene, Profil-Angabe „Einsteiger“,
 * - `health_check`: vorsichtiger Plan (Gesundheits-Check auffällig oder fehlt) – keine Stufe für Fortgeschrittene,
 * - `pain`: Schon-Modus schont eine Stelle, die die Übung belastet (nur, solange der Modus wirkt),
 * - `requirement`: Voraussetzungen aus dem Tagebuch fehlen (z. B. Muscle-up erst ab 8 Klimmzügen + 10 Dips),
 * - `equipment`: Gerät fehlt am Ort (nur Hinweis; mit Ort unbekannt entfällt die Prüfung).
 */
export const SKILL_LOCK_REASONS = [
  'missing_content',
  'safety_rules',
  'age',
  'experience',
  'health_check',
  'pain',
  'requirement',
  'equipment',
] as const;
export type SkillLockReason = (typeof SKILL_LOCK_REASONS)[number];

export interface SkillGateContext {
  /** Übungen, die die App nutzen darf (Supabase: nur freigegebene; Testmodus auch Entwürfe). */
  readonly library: ReadonlyMap<string, Exercise>;
  readonly experienceLevel: ExperienceLevel;
  /** Alter in Jahren am Stichtag. */
  readonly age: number;
  /** Aktuelle Plan-Regeln (planSafetyRules zum Stichtag). */
  readonly rules: Pick<PlanSafetyRules, 'excludedCautionTags' | 'cautious' | 'activeAging'>;
  readonly pain: PainEffect | null;
  /** Geräte am Ort; null = unbekannt (keine Geräte-Sperre). */
  readonly profile: Pick<EquipmentProfile, 'available'> | null;
  readonly logs: readonly ExerciseLogEntry[];
  readonly today: string;
}

export interface SkillRequirementState {
  readonly exerciseId: string;
  readonly reps: number;
  /** Beste saubere Wiederholungen in einem Satz (Tagebuch). */
  readonly best: number;
  readonly met: boolean;
}

export interface SkillGate {
  readonly allowed: boolean;
  readonly reasons: readonly SkillLockReason[];
  readonly requirements: readonly SkillRequirementState[];
}

/** Stufe gilt als „nur Fortgeschrittene“: eigene Angabe oder Übung mit hoher Technik (`high_skill`). */
export function isAdvancedStage(stage: SkillStage, exercise: Exercise | undefined): boolean {
  return stage.advancedOnly === true || (exercise?.caution_tags.includes('high_skill') ?? false);
}

/** Voraussetzungen eines Pfads mit dem Stand aus dem Tagebuch. */
export function skillRequirements(
  path: SkillPath,
  ctx: Pick<SkillGateContext, 'logs' | 'today'>,
): SkillRequirementState[] {
  if (!path.requirements) return [];
  return SKILL_GATES.requirements[path.requirements].map((req) => {
    const best = bestCleanReps(req.exerciseId, ctx.logs, ctx.today);
    return { exerciseId: req.exerciseId, reps: req.reps, best, met: best >= req.reps };
  });
}

/** Sperren einer Stufe (leer = freischaltbar). */
export function skillStageGate(path: SkillPath, index: number, ctx: SkillGateContext): SkillGate {
  const stage = path.stages[index];
  if (!stage) return { allowed: false, reasons: ['missing_content'], requirements: [] };
  const exercise = ctx.library.get(stage.exerciseId);
  const reasons = new Set<SkillLockReason>();
  if (!exercise) {
    reasons.add('missing_content');
  } else if (!isExerciseAllowed(exercise, ctx.rules)) {
    reasons.add('safety_rules');
  }
  const advanced = isAdvancedStage(stage, exercise);
  if (advanced) {
    if (ctx.age >= SKILL_GATES.seniorFromAge || ctx.rules.activeAging) reasons.add('age');
    if (ctx.experienceLevel === 'beginner') reasons.add('experience');
    if (ctx.rules.cautious) reasons.add('health_check');
  }
  if (exercise && ctx.pain && isBlockedByPain(exercise, ctx.pain)) reasons.add('pain');
  const requirements = skillRequirements(path, ctx);
  if (requirements.some((r) => !r.met)) reasons.add('requirement');
  if (exercise && ctx.profile && !isExerciseFeasible(exercise, ctx.profile)) {
    reasons.add('equipment');
  }
  const ordered = SKILL_LOCK_REASONS.filter((r) => reasons.has(r));
  return { allowed: ordered.length === 0, reasons: ordered, requirements };
}
