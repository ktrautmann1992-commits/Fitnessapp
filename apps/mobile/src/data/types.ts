import type {
  BodyMeasurementsInput,
  BodyMetricsStep,
  ConsentPlatform,
  ConsentType,
  CookingStep,
  EnduranceDiscipline,
  EquipmentItemInput,
  ExercisePreference,
  ExperienceLevel,
  GoalType,
  HealthFlag,
  HealthScreeningAnswers,
  MealPlanWeek,
  StoredShoppingList,
  NutritionSetupColumns,
  NutritionSetupStep,
  NutritionStep,
  OnboardingStep,
  Sex,
  TrainingSchedule,
} from '@fitnessapp/core';
import type { Tables } from '@fitnessapp/db';

/**
 * Gemeinsame Typen beider Betriebsarten (lokaler Testmodus und Supabase).
 * Die Zeilen-Typen sind aus packages/db/src/database.types.ts abgeleitet – so speichert der Testmodus
 * exakt dieselbe Struktur wie die Datenbank, und die Abbildung (mapping.ts) gilt für beide.
 */

type WithoutTimestamps<T> = Omit<T, 'created_at' | 'updated_at'>;

export type ProfileRow = WithoutTimestamps<Tables<'profiles'>>;
export type ConsentRow = Tables<'consents'>;
export type GoalsRow = WithoutTimestamps<Tables<'goals'>>;
export type UserEquipmentRow = WithoutTimestamps<Tables<'user_equipment'>>;
export type TrainingSlotRow = WithoutTimestamps<Tables<'training_slots'>>;
export type NutritionPrefsRow = WithoutTimestamps<Tables<'nutrition_prefs'>>;
export type FoodPreferenceRow = WithoutTimestamps<Tables<'food_preferences'>>;
export type BodyMetricsRow = WithoutTimestamps<Tables<'body_metrics'>>;
export type BodyMeasurementsRow = WithoutTimestamps<Tables<'body_measurements'>>;
export type HealthScreeningRow = Tables<'health_screening'>;
export type MeasurementReminderRow = WithoutTimestamps<Tables<'measurement_reminders'>>;
/** Trainingsplan (Phase 3). Mit uses_health_data = true SENSIBEL (Art. 9 DSGVO, PLAN-PHASE-3 Abschnitt 9). */
export type UserPlanRow = Tables<'user_plans'>;
export type PlannedSessionRow = Omit<Tables<'planned_sessions'>, 'created_at' | 'updated_at'>;
export type PlannedExerciseRow = Tables<'planned_exercises'>;
/**
 * Trainingstagebuch (Phase 4). Kein Gesundheitsdatum (PLAN-PHASE-4 3.4), auf dem Gerät aber IMMER nur im geschützten
 * Tagebuch-Zwischenspeicher (verschlüsselt bzw. Browser sessionStorage, S4) – nie im normalen rowsCache.
 */
export type SessionLogRow = Tables<'session_logs'>;
export type ExerciseLogRow = Tables<'exercise_logs'>;
export type SetLogRow = Tables<'set_logs'>;
export type CardioLogRow = Tables<'cardio_logs'>;
/** Eigenes Startgewicht (kein Tagebuch-Inhalt, darf in den normalen Zwischenspeicher). */
export type StartWeightRow = Tables<'exercise_start_weights'>;
/**
 * Übungs-Präferenz „Mag ich nicht“ / „Hier nicht machbar“ je Ort (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.1/9, Etappe
 * T2) – so wie die spätere Tabelle `exercise_preferences` (T3; bis dahin nicht in database.types.ts). Kein
 * Gesundheitsdatum (Abschnitt 6): darf in den normalen Zwischenspeicher, nie an Analytics oder Logs.
 */
export type ExercisePreferenceRow = ExercisePreference & { user_id: string };

/**
 * Antworten des Onboarding-Schritts `nutrition_setup` (docs/PLAN-PHASE-5.md 8.1, Etappe N4): Alltagsaktivität,
 * Trainingszeit, Meal-Prep-Plätze, „Kalorienzahlen anzeigen“. Spalten wie die künftigen `nutrition_prefs`-Spalten aus
 * Etappe N7 – bis dahin NUR im Testmodus (Supabase-Modus immer null, R2-S3). Kein Gesundheitsdatum.
 */
export type NutritionSetupRow = NutritionSetupColumns & { user_id: string };

/**
 * Gespeicherter Essensplan einer Woche (docs/PLAN-PHASE-5.md 6.3, 7.2, 7.5, Etappe N5) – NUR im Testmodus (Supabase-
 * Modus bis N7 immer leer; dort Tabellen meal_plans/meal_plan_items). Höchstens ein Plan je Woche (der aktive).
 * `plan` ist der vollständige Plan der Engine (Schnappschuss, geprüft mit `parseStoredMealPlanWeek`).
 * SENSIBEL, wenn `uses_health_data` (Ziele, Flags oder Unverträglichkeiten eingeflossen, 7.1) – nie loggen; beim
 * Widerruf health_data gelöscht.
 */
export interface MealPlanRow {
  id: string;
  user_id: string;
  week_start: string;
  uses_health_data: boolean;
  created_at: string;
  /** Automatisch neu geplant (6.6) – Hinweis „Dein Plan wurde an deine neuen Angaben angepasst.“ bis „Verstanden“. */
  auto_adjusted: boolean;
  /**
   * Neu erstellt, weil der gespeicherte Plan nicht mehr zu den Rezepten passte (neue Rezept-Version, auch vergangene
   * Tage, Wächter N5a Nachprüfung K-b) – Hinweis bis „Verstanden“ (Etappe N5b).
   */
  recipes_changed: boolean;
  /**
   * Start des Meal-Prep-Kochtags (ISO-Zeitstempel) für die Timer (Etappe N5b) – nur, solange der gewählte
   * Meal-Prep-Plan der Woche derselbe bleibt; null = nicht gestartet.
   */
  cook_day_started_at: string | null;
  plan: MealPlanWeek;
}

/**
 * Gespeicherte Einkaufsliste einer Woche (docs/PLAN-PHASE-5.md 6.5, 7.2, Etappe N5b) – NUR im Testmodus (Supabase-
 * Modus bis N7 immer leer; dort shopping_lists/shopping_list_items). Höchstens eine Liste je Woche. `list` ist der
 * Stand aus packages/core (`parseStoredShoppingList`); die Plan-Einträge werden beim Öffnen immer aus dem aktuellen
 * Plan neu erzeugt. SENSIBEL, wenn `uses_health_data` (Ersatzprodukte und fehlende Zutaten lassen auf
 * Unverträglichkeiten schließen) – nie loggen; beim Widerruf samt eigener Einträge gelöscht (K10).
 */
export interface ShoppingListRow {
  id: string;
  user_id: string;
  week_start: string;
  uses_health_data: boolean;
  created_at: string;
  updated_at: string;
  list: StoredShoppingList;
}

/** Alle Zeilen eines Nutzers – im Testmodus der komplette Gerätespeicher, im Supabase-Modus ein Abbild. */
export interface UserRows {
  profile: ProfileRow | null;
  consents: ConsentRow[];
  goals: GoalsRow | null;
  /** Trainingstage (Art + Dauer, optional Wochentag) – kein Gesundheitsdatum. */
  trainingSlots: TrainingSlotRow[];
  userEquipment: UserEquipmentRow[];
  nutritionPrefs: NutritionPrefsRow | null;
  /** Schritt `nutrition_setup` (Testmodus ab Etappe N4; Supabase-Modus bis N7 immer null). */
  nutritionSetup: NutritionSetupRow | null;
  foodPreferences: FoodPreferenceRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  bodyMetrics: BodyMetricsRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  bodyMeasurements: BodyMeasurementsRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  healthScreenings: HealthScreeningRow[];
  reminder: MeasurementReminderRow | null;
  /**
   * Trainingspläne (aktiv und ersetzt), Einheiten und Übungen – wie die Tabellen user_plans, planned_sessions,
   * planned_exercises. Supabase-Modus: nur der aktive Plan. Pläne mit uses_health_data sind Gesundheitsdaten
   * (nur im geschützten Zwischenspeicher, Gründer-Entscheidung Frage 14).
   */
  plans: UserPlanRow[];
  plannedSessions: PlannedSessionRow[];
  plannedExercises: PlannedExerciseRow[];
  /**
   * Tagebuch (Phase 4): Supabase-Modus die letzten LOG_CACHE_WEEKS Wochen plus recent_exercise_logs() (Grundlage der
   * Progression); Testmodus alles. Nur im geschützten Tagebuch-Zwischenspeicher auf dem Gerät (cacheableRows).
   */
  sessionLogs: SessionLogRow[];
  exerciseLogs: ExerciseLogRow[];
  setLogs: SetLogRow[];
  cardioLogs: CardioLogRow[];
  startWeights: StartWeightRow[];
  /** Übungs-Präferenzen (Testmodus ab Etappe T2; Supabase-Modus bis T3 immer leer). */
  exercisePreferences: ExercisePreferenceRow[];
  /** Essenspläne je Woche (Testmodus ab Etappe N5; Supabase-Modus bis N7 immer leer). */
  mealPlans: MealPlanRow[];
  /** Einkaufslisten je Woche (Testmodus ab Etappe N5b; Supabase-Modus bis N7 immer leer). */
  shoppingLists: ShoppingListRow[];
}

export function emptyUserRows(): UserRows {
  return {
    profile: null,
    consents: [],
    goals: null,
    trainingSlots: [],
    userEquipment: [],
    nutritionPrefs: null,
    nutritionSetup: null,
    foodPreferences: [],
    bodyMetrics: [],
    bodyMeasurements: [],
    healthScreenings: [],
    reminder: null,
    plans: [],
    plannedSessions: [],
    plannedExercises: [],
    sessionLogs: [],
    exerciseLogs: [],
    setLogs: [],
    cardioLogs: [],
    startWeights: [],
    exercisePreferences: [],
    mealPlans: [],
    shoppingLists: [],
  };
}

/** Angemeldeter Nutzer. Im Testmodus eine lokal erzeugte ID ohne E-Mail. */
export interface AuthSession {
  userId: string;
  email: string | null;
}

/** Einwilligungstext in der aktuellen Version. */
export interface ConsentDocument {
  type: ConsentType;
  version: number;
  title: string;
  body: string;
}

export interface GoalAnswer {
  goalType: GoalType;
  discipline: EnduranceDiscipline | null;
  targetDate: string | null;
}

/** Schritt „Deine Trainingstage“: feste Wochentage oder „Tage egal“, je Eintrag Art + Dauer. */
export type TrainingScheduleAnswer = TrainingSchedule;

export interface HealthScreeningAnswer {
  answers: HealthScreeningAnswers;
  flags: HealthFlag[];
  acknowledgedAt: string | null;
}

/**
 * Antworten aus dem Onboarding, wie die Bildschirme sie anzeigen. `undefined` = noch nicht beantwortet.
 * Gesundheitsdaten (bodyMetrics, bodyMeasurements, healthScreening, Unverträglichkeiten) werden im
 * Supabase-Modus NICHT auf dem Gerät zwischengespeichert, nur im Arbeitsspeicher gehalten.
 */
export interface OnboardingAnswers {
  birthDate?: string;
  sex?: Sex;
  cycleModuleInterest?: boolean | null;
  bodyMetrics?: BodyMetricsStep & { measuredOn: string };
  bodyMeasurements?: (BodyMeasurementsInput & { measuredOn: string }) | null;
  healthScreening?: HealthScreeningAnswer;
  experienceLevel?: ExperienceLevel;
  goal?: GoalAnswer;
  /** Der Trainingsort wird daraus abgeleitet (deriveTrainingLocation). */
  trainingSchedule?: TrainingScheduleAnswer;
  equipment?: EquipmentItemInput[];
  nutrition?: NutritionStep;
  cooking?: CookingStep;
  nutritionSetup?: NutritionSetupStep;
}

/** Was ein Onboarding-Schritt speichert (je Schritt eigene Daten). */
export type StepSave =
  | { step: 'sex'; sex: Sex; cycleModuleInterest: boolean | null }
  | { step: 'health_consent'; granted: boolean }
  | { step: 'body_metrics'; value: BodyMetricsStep; measuredOn: string }
  | {
      step: 'body_measurements';
      /** null = übersprungen */
      value: BodyMeasurementsInput | null;
      measuredOn: string;
      reminderEnabled: boolean;
    }
  | { step: 'health_screening'; answers: HealthScreeningAnswers; acknowledgedAt: string | null }
  | { step: 'experience'; experienceLevel: ExperienceLevel }
  | { step: 'goal'; goal: GoalAnswer }
  | { step: 'time_budget'; schedule: TrainingScheduleAnswer }
  | { step: 'equipment'; items: EquipmentItemInput[] }
  | { step: 'nutrition'; nutrition: NutritionStep }
  | { step: 'cooking'; cooking: CookingStep }
  | { step: 'nutrition_setup'; setup: NutritionSetupStep };

export type StepSaveFor<S extends OnboardingStep> = Extract<StepSave, { step: S }>;

/** Einstellung „Mess-Erinnerung“. */
export interface ReminderSettings {
  enabled: boolean;
  intervalDays: number;
}

export type { ConsentPlatform };
