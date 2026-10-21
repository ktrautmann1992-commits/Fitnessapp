/**
 * Deutsche Anzeigenamen für den Redaktionsbereich (reine Darstellung, keine Fachlogik).
 * Muskelgruppen und Geräte kommen aus packages/core (muscleNameDe, EQUIPMENT).
 */
import {
  type AlternativeReason,
  type AnimalKind,
  type CautionTag,
  type ContentIssue,
  type ContentOrigin,
  type ContentStatus,
  type DietType,
  type EquipmentLocation,
  type ExerciseMechanics,
  findEquipment,
  FOOD_GROUPS,
  type LoadType,
  type MealType,
  type MeatKind,
  type MovementPattern,
  type PregnancyReason,
  type SessionFocus,
  type StorageMethod,
  type TemplateExperienceLevel,
  type TemplateGoalType,
  type TrainingTag,
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
  balance: 'Gleichgewicht',
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
  floor_transfer: 'Am Boden (Hinlegen/Aufstehen)',
  spinal_flexion: 'Rumpfbeugen bis zum Ende',
  loaded_flexion: 'Rumpfbeugen mit Last',
  trunk_rotation: 'Drehen bis zum Anschlag',
  deep_hip_flexion: 'Tiefe Hüftbeugung (über 90°)',
  hip_cross_midline: 'Bein über die Körpermitte',
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
  balance: 'Gleichgewicht',
};

export const ORIGIN_LABELS: Record<ContentOrigin, string> = {
  claude_session: 'KI-Entwurf (Claude, Umsetzungs-Sitzung)',
  batch: 'KI-Entwurf (Batch-API, Modell siehe unten)',
  manual: 'von Hand erstellt',
};

export const ISSUE_KIND_LABELS: Record<ContentIssue['kind'], string> = {
  exercise: 'Übung',
  plan_template: 'Vorlage',
  library: 'Bibliothek',
  food: 'Lebensmittel',
  recipe: 'Rezept',
  recipe_library: 'Rezeptbestand',
  meal_prep_plan: 'Meal-Prep-Plan',
  guide: 'Ratgeber',
  ingredient_substitution: 'Austausch',
  package_size: 'Packungsgröße',
  supplement: 'Supplement',
  workout: 'Workout',
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

// ---------------------------------------------------------------------------------------------------------
// Ernährung (Etappe N2d)
// ---------------------------------------------------------------------------------------------------------

export const DIET_LABELS: Record<DietType, string> = {
  omnivore: 'mit Fleisch/Fisch',
  vegetarian: 'vegetarisch',
  vegan: 'vegan',
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  main: 'Hauptgericht',
  snack: 'Snack',
};

export const TRAINING_TAG_LABELS: Record<TrainingTag, string> = {
  vor_training: 'vor dem Training',
  waehrend: 'während des Trainings',
  nach_training: 'nach dem Training',
};

export const ANIMAL_LABELS: Record<AnimalKind, string> = {
  dairy: 'Milch',
  egg: 'Ei',
  honey: 'Honig',
  meat: 'Fleisch',
  fish: 'Fisch',
  shellfish: 'Krebs-/Weichtiere',
  gelatin: 'Gelatine',
  animal_rennet: 'tierisches Lab',
  insect: 'Insekten',
};

export const MEAT_KIND_LABELS: Record<MeatKind, string> = {
  pork: 'Schwein',
  beef: 'Rind',
  poultry: 'Geflügel',
  lamb: 'Lamm',
  game: 'Wild',
  unknown: 'unbekannt',
};

export const STORAGE_METHOD_LABELS: Record<StorageMethod, string> = {
  fridge: 'Kühlschrank',
  freeze: 'einfrieren',
  fresh: 'frisch zubereiten',
};

/** Name einer Lebensmittel-Gruppe (Allergene und Unverträglichkeiten); unbekannte IDs bleiben sichtbar. */
export function foodGroupLabel(id: string): string {
  return FOOD_GROUPS.find((group) => group.id === id)?.nameDe ?? `${id} (unbekannt)`;
}

const PREGNANCY_REASON_TEXT: Record<PregnancyReason['kind'], string> = {
  food_flag: 'Lebensmittel mit Schwangerschafts-Hinweis',
  not_heated: 'nicht durchgegart',
  no_cook: 'Rezept ohne Kochen',
  unconfirmed_heated: 'Annahme „durchgegart“ noch nicht bestätigt',
};

/** z. B. „huehnerei: Annahme „durchgegart“ noch nicht bestätigt“. */
export function pregnancyReasonLabel(reason: PregnancyReason): string {
  return `${reason.foodId}: ${PREGNANCY_REASON_TEXT[reason.kind]}`;
}

export const NUTRIENT_FIELD_LABELS = {
  kcal: 'Energie (kcal)',
  protein_g: 'Eiweiß (g)',
  carbs_g: 'Kohlenhydrate (g)',
  fat_g: 'Fett (g)',
} as const;
