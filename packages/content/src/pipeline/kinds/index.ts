import type { ContentFileKind } from '@fitnessapp/core';

import { exerciseKind } from './exercise';
import { planTemplateKind } from './plan-template';
import type { ContentKindDefinition } from './types';

export type * from './types';

/** Alle Inhaltsarten der Pipeline. Rezepte (Phase 5) kommen hier als weiterer Eintrag dazu. */
export const CONTENT_KINDS: Readonly<Record<ContentFileKind, ContentKindDefinition>> = {
  exercise: exerciseKind,
  plan_template: planTemplateKind,
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
