/**
 * Aufzählungen, die 1:1 den Postgres-Enums in supabase/migrations/20261003120000_phase1_basics.sql entsprechen.
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
