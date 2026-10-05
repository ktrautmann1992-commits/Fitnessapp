import { fitSessionToMinutes, type PlannedExerciseDraft } from '../plan/adapt';
import type { MovementPattern } from '../enums';
import type { ExerciseLookup } from './analysis';
import { isBodyweightTemplate } from './checks';
import { type ContentIssue, makeIssue } from './rules';
import type { PlanTemplate } from './schemas';

/**
 * V13 (gelb, Wächter N6): Passt jede Einheit einer Vorlage in deren eigenes `minutes_min`? Gekürzt wird genau wie in
 * der Plan-Engine (fitSessionToMinutes, bei Körpergewicht-Vorlagen mit `protectLastCore`). Hinweis, wenn selbst die
 * kürzeste Fassung länger ist – und bei Körpergewicht-Vorlagen, wenn die gekürzte Einheit Rumpf, Ziehen
 * (`horizontal_pull`, außer Unterkörper) oder Hüftbeugen/Hüftstrecken (außer Oberkörper) verliert
 * (docs/PLAN-KOERPERGEWICHT.md §4). Eigene Datei, weil sie die Engine nutzt (checks.ts bleibt ohne plan/-Import).
 */
export function checkTemplateFitsMinimum(
  template: PlanTemplate,
  exercises: ExerciseLookup,
): ContentIssue[] {
  const target = { kind: 'plan_template' as const, id: template.id, status: template.status };
  const bodyweight = isBodyweightTemplate(template);
  const issues: ContentIssue[] = [];
  const pattern = (id: string): MovementPattern | undefined => exercises.get(id)?.movement_pattern;
  template.sessions.forEach((session, s) => {
    if (session.exercises.some((item) => !exercises.has(item.exercise_id))) return; // V1 meldet das
    const drafts: PlannedExerciseDraft[] = session.exercises.map((item) => ({
      ...item,
      source_exercise_id: item.exercise_id,
      exercise_name_de: exercises.get(item.exercise_id)?.name_de ?? item.exercise_id,
      target_weight_kg: null,
    }));
    const fit = fitSessionToMinutes(drafts, template.minutes_min, exercises, {
      protectLastCore: bodyweight,
    });
    const path = `sessions.${s}`;
    if (fit.belowMinimum) {
      issues.push(
        makeIssue(
          'V13',
          target,
          `„${session.name_de}“: passt auch gekürzt nicht in ${template.minutes_min} min (minutes_min).`,
          path,
        ),
      );
    }
    if (!bodyweight) return;
    const ids = fit.exercises.map((e) => e.exercise_id);
    const missing: string[] = [];
    if (!ids.some((id) => (pattern(id) ?? '').startsWith('core_'))) missing.push('Rumpf');
    if (session.focus !== 'lower' && !ids.some((id) => pattern(id) === 'horizontal_pull')) {
      missing.push('Ziehen');
    }
    if (
      session.focus !== 'upper' &&
      !ids.some((id) => pattern(id) === 'hinge' || pattern(id) === 'hip_extension')
    ) {
      missing.push('Hüftbeugen/Hüftstrecken');
    }
    if (missing.length > 0) {
      issues.push(
        makeIssue(
          'V13',
          target,
          `„${session.name_de}“: auf ${template.minutes_min} min gekürzt fehlt ${missing.join(', ')}.`,
          path,
        ),
      );
    }
  });
  return issues;
}
