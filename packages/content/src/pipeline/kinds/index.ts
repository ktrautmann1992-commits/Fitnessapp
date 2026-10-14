import { exerciseKind } from './exercise';
import { ingredientSubstitutionKind } from './ingredient-substitution';
import { planTemplateKind } from './plan-template';
import type { ContentKindDefinition, PipelineContentKind } from './types';

export type * from './types';

/** Alle Inhaltsarten der Pipeline: Training (Phase 2) und die Austausch-Tabelle (Phase 5, N9). */
export const CONTENT_KINDS: Readonly<Record<PipelineContentKind, ContentKindDefinition>> = {
  exercise: exerciseKind,
  plan_template: planTemplateKind,
  ingredient_substitution: ingredientSubstitutionKind,
};

/** Art aus Workflow-Eingabe (`exercises`, `plan-templates`) oder interner Bezeichnung (`exercise`, …). */
export function findKind(name: string): ContentKindDefinition {
  const normalized = name.trim().toLowerCase();
  const kind = Object.values(CONTENT_KINDS).find(
    (definition) => definition.inputName === normalized || definition.kind === normalized,
  );
  if (!kind) {
    const allowed = Object.values(CONTENT_KINDS)
      .map((definition) => definition.inputName)
      .join(', ');
    throw new Error(`Unbekannte Inhaltsart „${name}“ (erlaubt: ${allowed}).`);
  }
  return kind;
}
