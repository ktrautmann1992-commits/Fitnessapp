/**
 * Deutsche Anzeigenamen für den Redaktionsbereich (reine Darstellung, keine Fachlogik).
 * Muskelgruppen und Geräte kommen aus packages/core (muscleNameDe, EQUIPMENT).
 */
import {
  type AlternativeReason,
  type CautionTag,
  type ContentIssue,
  type ContentOrigin,
  type ContentStatus,
  type EquipmentLocation,
  type ExerciseMechanics,
  findEquipment,
  type LoadType,
  type MovementPattern,
  type SessionFocus,
  type TemplateExperienceLevel,
  type TemplateGoalType,
} from '@fitnessapp/core';

export const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Entwurf',
  published: 'freigegeben',
  archived: 'zurückgezogen',
};

export const STATUS_PLURAL_LABELS: Record<ContentStatus, string> = {
  draft: 'Entwürfe',
  published: 'freigegeben',
  archived: 'zurückgezogen',
};

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: 'Kniebeuge',
  hinge: 'Hüftbeuge (Hinge)',
  lunge: 'Ausfallschritt',
  horizontal_push: 'Drücken horizontal',
  vertical_push: 'Drücken vertikal',
  horizontal_pull: 'Ziehen horizontal',
  vertical_pull: 'Ziehen vertikal',
  elbow_flexion: 'Armbeugen',
  elbow_extension: 'Armstrecken',
  shoulder_isolation: 'Schulter isoliert',
  knee_flexion: 'Beinbeugen (Beinbeuger)',
  knee_extension: 'Beinstrecken',
  hip_extension: 'Hüftstreckung',
  calf_raise: 'Wadenheben',
  core_anti_extension: 'Rumpf: Anti-Streckung',
  core_anti_rotation: 'Rumpf: Anti-Rotation',
  core_flexion: 'Rumpf: Beugen',
  carry: 'Tragen',
  conditioning: 'Kondition',
  mobility: 'Beweglichkeit',
};

export const GOAL_LABELS: Record<TemplateGoalType, string> = {
  muscle_gain: 'Muskelaufbau',
  fat_loss: 'Fettverlust',
  general_fitness: 'Allgemeine Fitness',
};

export const LEVEL_LABELS: Record<TemplateExperienceLevel, string> = {
  beginner: 'Einsteiger',
  advanced: 'Fortgeschritten',
};

export const LOCATION_LABELS: Record<EquipmentLocation, string> = {
  gym: 'Studio',
  home: 'Zuhause',
};

export const MECHANICS_LABELS: Record<ExerciseMechanics, string> = {
  compound: 'Grundübung (mehrgelenkig)',
  isolation: 'Isolationsübung (eingelenkig)',
};

export const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  weight: 'Zusatzgewicht',
  bodyweight: 'Körpergewicht',
  band: 'Widerstandsband',
  time: 'Zeit (Halteübung)',
};

export const CAUTION_TAG_LABELS: Record<CautionTag, string> = {
  high_impact: 'Sprünge/Stöße',
  spinal_loading: 'Last auf der Wirbelsäule',
  overhead: 'Über Kopf',
  long_supine: 'Lange Rückenlage',
  high_skill: 'Hohe Technik',
};

export const ALTERNATIVE_REASON_LABELS: Record<AlternativeReason, string> = {
  other_equipment: 'anderes Gerät',
  easier: 'leichter',
  harder: 'schwerer',
  home: 'für Zuhause',
};

export const FOCUS_LABELS: Record<SessionFocus, string> = {
  full_body: 'Ganzkörper',
  upper: 'Oberkörper',
  lower: 'Unterkörper',
};

export const ORIGIN_LABELS: Record<ContentOrigin, string> = {
  claude_session: 'KI-Entwurf (Claude, Umsetzungs-Sitzung)',
  batch: 'KI-Entwurf (Claude, Batch-API)',
  manual: 'von Hand erstellt',
};

export const ISSUE_KIND_LABELS: Record<ContentIssue['kind'], string> = {
  exercise: 'Übung',
  plan_template: 'Vorlage',
  library: 'Bibliothek',
};

/** Gerätename aus dem Katalog; unbekannte IDs bleiben sichtbar (Regel Ü2/V2 meldet sie). */
export function equipmentLabel(id: string): string {
  return findEquipment(id)?.nameDe ?? `${id} (unbekannt)`;
}

/** 03.10.2026 statt 2026-10-03. */
export function formatDateDe(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : isoDate;
}

/** Zahl mit Komma, höchstens eine Nachkommastelle. */
export function formatNumberDe(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}
