import type { Exercise, PlanTemplate } from '../content/schemas';
import type { ContentValidationResult } from '../content/validate';
import { isDryRunContent } from '../content/validate';

/**
 * Welche Inhalte die Plan-Engine nutzen darf (docs/PLAN-PHASE-3.md Abschnitt 5.2).
 * - Live: nur `published`.
 * - Testmodus (`allowDrafts: true`, NUR in createLocalBackend der App): zusätzlich `draft`, aber nur ohne roten
 *   Befund und nie Probelauf-Inhalte. `archived` nie.
 * - Eine Vorlage zählt nur, wenn alle ihre Übungen ebenfalls ausgewählt sind.
 */
export interface PlanLibrary {
  readonly exercises: ReadonlyMap<string, Exercise>;
  /** Nach ID sortiert. */
  readonly templates: readonly PlanTemplate[];
  /** true = enthält Entwürfe (Kennzeichnung „Testinhalte“ in der App). */
  readonly containsDrafts: boolean;
  /**
   * Nur zur ANZEIGE laufender Pläne: zusätzlich archivierte Übungen (Merkmale prüfbar). Nie für Erzeugen, Ersatz
   * oder Folgeblock – dafür gilt ausschließlich `exercises`.
   */
  readonly displayExercises?: ReadonlyMap<string, Exercise>;
}

export interface SelectPlanContentOptions {
  readonly allowDrafts: boolean;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function selectPlanContent(
  result: Pick<ContentValidationResult, 'exercises' | 'templates' | 'issues'>,
  options: SelectPlanContentOptions,
): PlanLibrary {
  const redIds = new Set(
    result.issues
      .filter((issue) => issue.severity === 'error')
      .map((issue) => `${issue.kind}:${issue.id}`),
  );
  const usable = (
    kind: 'exercise' | 'plan_template',
    content: Pick<Exercise, 'id' | 'status' | 'meta'>,
  ): boolean => {
    if (content.status === 'published') {
      return !isDryRunContent(content) && !redIds.has(`${kind}:${content.id}`);
    }
    return (
      options.allowDrafts &&
      content.status === 'draft' &&
      !isDryRunContent(content) &&
      !redIds.has(`${kind}:${content.id}`)
    );
  };
  const exercises = new Map(
    result.exercises.filter((e) => usable('exercise', e)).map((e) => [e.id, e] as const),
  );
  const templates = result.templates
    .filter((t) => usable('plan_template', t))
    .filter((t) =>
      t.sessions.every((s) => s.exercises.every((item) => exercises.has(item.exercise_id))),
    )
    .sort(byId);
  const containsDrafts =
    [...exercises.values()].some((e) => e.status === 'draft') ||
    templates.some((t) => t.status === 'draft');
  return { exercises, templates, containsDrafts };
}

/** Bibliothek direkt aus Listen (z. B. aus der Datenbank, die nur `published` liefert). */
export function planLibraryFromContent(
  exercises: readonly Exercise[],
  templates: readonly PlanTemplate[],
): PlanLibrary {
  return selectPlanContent({ exercises, templates, issues: [] }, { allowDrafts: false });
}
