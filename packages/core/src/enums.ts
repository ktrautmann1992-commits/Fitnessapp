/**
 * Aufzählungen, die 1:1 den Postgres-Enums in supabase/migrations entsprechen
 * (Phase 1: 20261003120000_phase1_basics.sql, Phase 2: 20261003130000/20261003130200).
 * `db-sync.test.ts` prüft, dass beide Seiten übereinstimmen.
 */

/** Geschlecht. „diverse“/„unspecified“: Kalorienformeln nehmen später den Mittelwert (Frage 9). */
export const SEX_OPTIONS = ['male', 'female', 'diverse', 'unspecified'] as const;
export type Sex = (typeof SEX_OPTIONS)[number];

/** Trainingserfahrung: Einsteiger / Fortgeschritten / Leistungssport. */
export const EXPERIENCE_LEVELS = ['beginner', 'advanced', 'competitive'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Unterstützte Sprachvarianten (Deutsch als Standard, Englisch vorbereitet). */
export const APP_LOCALES = ['de-DE', 'de-AT', 'de-CH'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'de-DE';

/** Einwilligungsarten (getrennt, versioniert). */
export const CONSENT_TYPES = ['terms', 'privacy', 'health_data', 'cycle_data'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Gerät, auf dem eine Einwilligung erteilt wurde. */
export const CONSENT_PLATFORMS = ['ios', 'android', 'web'] as const;
export type ConsentPlatform = (typeof CONSENT_PLATFORMS)[number];

/** Trainingsziel. */
export const GOAL_TYPES = [
  'fat_loss',
  'definition',
  'muscle_gain',
  'general_fitness',
  'endurance',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

/** Ausdauer-Disziplin (nur beim Ziel „endurance“). */
export const ENDURANCE_DISCIPLINES = [
  '5k',
  '10k',
  'half_marathon',
  'marathon',
  'triathlon_sprint',
  'triathlon_olympic',
  'triathlon_middle',
  'triathlon_long',
  'cycling',
  'swimming',
] as const;
export type EnduranceDiscipline = (typeof ENDURANCE_DISCIPLINES)[number];

/** Trainingsort: Studio / Zuhause / beides. */
export const TRAINING_LOCATIONS = ['gym', 'home', 'both'] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

/** Ort eines Geräts. */
export const EQUIPMENT_LOCATIONS = ['home', 'gym'] as const;
export type EquipmentLocation = (typeof EQUIPMENT_LOCATIONS)[number];

/** Geräte-Kategorie im Katalog. */
export const EQUIPMENT_CATEGORIES = [
  'free_weights',
  'bench',
  'bodyweight',
  'bands',
  'cardio',
  'other',
  // Phase 2: Maschinen und Kabelzug (nur Studio), per `alter type … add value` ergänzt.
  'machines',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/** Ernährungsform. */
export const DIET_TYPES = ['omnivore', 'vegetarian', 'vegan'] as const;
export type DietType = (typeof DIET_TYPES)[number];

/** Kochmodus: täglich frisch / Meal-Prep. */
export const COOKING_MODES = ['daily', 'meal_prep'] as const;
export type CookingMode = (typeof COOKING_MODES)[number];

/** Art einer Lebensmittel-Vorliebe. „intolerance“ ist ein Gesundheitsdatum (Art. 9 DSGVO). */
export const FOOD_PREFERENCE_KINDS = ['like', 'dislike', 'intolerance'] as const;
export type FoodPreferenceKind = (typeof FOOD_PREFERENCE_KINDS)[number];

// ---------------------------------------------------------------------------------------------------------
// Phase 2 · Inhalte (Übungsbibliothek und Plan-Vorlagen), docs/PLAN-PHASE-2.md Abschnitt 5
// ---------------------------------------------------------------------------------------------------------

/** Status eines Inhalts: Entwurf / freigegeben / zurückgezogen. In der Datenbank liegt nie ein Entwurf. */
export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Bewegungsmuster. Alternativen einer Übung müssen dasselbe Muster haben (Regel Ü4). */
export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_isolation',
  'knee_flexion',
  'knee_extension',
  'hip_extension',
  'calf_raise',
  'core_anti_extension',
  'core_anti_rotation',
  'core_flexion',
  'carry',
  'conditioning',
  'mobility',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Muskelgruppen (für Wochensätze pro Muskelgruppe, Regeln V9–V11). */
export const MUSCLE_GROUPS = [
  'chest',
  'lats',
  'upper_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower_back',
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'calves',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Grundübung (mehrgelenkig) oder Isolationsübung (eingelenkig) – bestimmt die Pausen-Regel V5. */
export const EXERCISE_MECHANICS = ['compound', 'isolation'] as const;
export type ExerciseMechanics = (typeof EXERCISE_MECHANICS)[number];

/** Art der Belastung: Zusatzgewicht, Körpergewicht, Band oder Zeit (Halteübung). */
export const LOAD_TYPES = ['weight', 'bodyweight', 'band', 'time'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

/**
 * Merkmale einer Übung für vorsichtigere Pläne (Flag `conservative_plan`, Phase 3) – Eigenschaften der Übung,
 * KEINE Diagnosen: Sprünge, schwere Last auf der Wirbelsäule, über Kopf, lange Rückenlage, hohe Technik.
 */
export const CAUTION_TAGS = [
  'high_impact',
  'spinal_loading',
  'overhead',
  'long_supine',
  'high_skill',
] as const;
export type CautionTag = (typeof CAUTION_TAGS)[number];

/** Grund einer Alternative: anderes Gerät / leichter / schwerer / für Zuhause. */
export const ALTERNATIVE_REASONS = ['other_equipment', 'easier', 'harder', 'home'] as const;
export type AlternativeReason = (typeof ALTERNATIVE_REASONS)[number];

/** Schwerpunkt einer Einheit in einer Plan-Vorlage. */
export const SESSION_FOCUSES = ['full_body', 'upper', 'lower'] as const;
export type SessionFocus = (typeof SESSION_FOCUSES)[number];

/** Rolle im Redaktionsbereich (Tabelle admin_users). */
export const ADMIN_ROLES = ['content_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Herkunft eines Inhalts (Feld `meta.origin`, kein Postgres-Enum – steht in `meta` jsonb):
 * Startbestand aus der Umsetzungs-Sitzung, Claude Message Batches API oder von Hand.
 */
export const CONTENT_ORIGINS = ['claude_session', 'batch', 'manual'] as const;
export type ContentOrigin = (typeof CONTENT_ORIGINS)[number];

/** Ziele mit Plan-Vorlagen (Matrix Phase 2, Abschnitt 14 Frage 1). „definition“ nutzt Muskelaufbau. */
export const TEMPLATE_GOAL_TYPES = ['muscle_gain', 'fat_loss', 'general_fitness'] as const;
export type TemplateGoalType = (typeof TEMPLATE_GOAL_TYPES)[number];

/** Level mit Plan-Vorlagen (Abschnitt 14 Frage 2). „competitive“ nutzt vorerst „advanced“. */
export const TEMPLATE_EXPERIENCE_LEVELS = ['beginner', 'advanced'] as const;
export type TemplateExperienceLevel = (typeof TEMPLATE_EXPERIENCE_LEVELS)[number];
