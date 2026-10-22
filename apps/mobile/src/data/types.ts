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
  CustomMeal,
  CustomMealItem,
  FoodLogEntry,
  FoodLogFavorite,
  GoalType,
  HealthFlag,
  HealthScreeningAnswers,
  MealPlanRecord,
  MealPlanWeek,
  StoredAppLayout,
  StoredShoppingList,
  NutritionSetupColumns,
  NutritionSetupStep,
  NutritionStep,
  OnboardingStep,
  RecipeRating,
  Sex,
  TrainingSchedule,
  UserFoodProduct,
  WeightGoal,
  WeightGoalAmountMode,
  WeightGoalTimeMode,
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
/**
 * Ernährungsangaben OHNE die Spalten des Schritts `nutrition_setup` (seit N7 an derselben Tabelle) – die stehen
 * getrennt in `NutritionSetupRow` (Testmodus wie bisher; Supabase-Modus teilt die Zeile beim Laden auf).
 */
export const NUTRITION_SETUP_DB_COLUMNS = [
  'activity_level',
  'training_time',
  'mealprep_slots',
  'show_energy_numbers',
  'max_prep_minutes_weekday',
] as const;
export type NutritionPrefsRow = WithoutTimestamps<
  Omit<Tables<'nutrition_prefs'>, (typeof NUTRITION_SETUP_DB_COLUMNS)[number]>
>;
export type FoodPreferenceRow = WithoutTimestamps<Tables<'food_preferences'>>;
export type BodyMetricsRow = WithoutTimestamps<Tables<'body_metrics'>>;
export type BodyMeasurementsRow = WithoutTimestamps<Tables<'body_measurements'>>;
export type HealthScreeningRow = Tables<'health_screening'>;
/**
 * Wunschgewicht (docs/PLAN-ZIELE.md 5.2/5.3, Etappe Z3) – Spalten wie `weight_goals`, Modi als Werte-Listen aus
 * packages/core statt `string`. SENSIBEL (Art. 9 DSGVO): nur mit Einwilligung health_data, beim Widerruf gelöscht, nie
 * im normalen Zwischenspeicher, nie in Logs oder Analytics (Wächter K7). Nur mit Abnehmziel (Wächter S13).
 */
export type WeightGoalRow = Omit<
  WithoutTimestamps<Tables<'weight_goals'>>,
  'amount_mode' | 'time_mode'
> & { amount_mode: WeightGoalAmountMode; time_mode: WeightGoalTimeMode };
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
 * Trainingszeit, Meal-Prep-Plätze, „Kalorienzahlen anzeigen“. Seit Etappe N7 Spalten von `nutrition_prefs` (der
 * Supabase-Modus teilt die Zeile beim Laden auf, `nutritionPrefsFromDb`). Kein Gesundheitsdatum.
 */
export type NutritionSetupRow = NutritionSetupColumns & { user_id: string };

/**
 * Gespeicherter Essensplan einer Woche (docs/PLAN-PHASE-5.md 6.3, 7.2, 7.5, Etappe N5; Supabase-Modus seit N7 Teil 2).
 * Höchstens ein Plan je Woche (der aktive). `plan` ist der vollständige Plan der Engine (Schnappschuss, geprüft mit
 * `parseStoredMealPlanWeek`). Im Supabase-Modus kommt dazu `record` – die Zeilen aus `meal_plans`/`meal_plan_items`
 * (ohne Planband/`safetyKey`, Wächter N5a S4); `plan` ist dort nur gesetzt, wenn der geschützte Speicher des Geräts den
 * vollständigen Plan zu genau diesen Zeilen hat, sonst baut ihn `resolveMealPlanRecord` neu (G-N7-1).
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
  /** Vollständiger Plan der Engine; null = nur die Zeilen aus der Datenbank (`record`) sind bekannt. */
  plan: MealPlanWeek | null;
  /** Nur Supabase-Modus: Zeilen aus der Datenbank (Payload von `save_meal_plan` + Gesundheitsbezug vom Server). */
  record?: MealPlanRecord;
}

/** Gewählter Meal-Prep-Plan der Woche – aus dem vollständigen Plan bzw. den Zeilen der Datenbank. */
export function mealPlanRowPrepPlanId(row: MealPlanRow): string | null {
  return row.plan?.mealPrepPlanId ?? row.record?.payload.meal_prep_plan_id ?? null;
}

/**
 * Gespeicherte Einkaufsliste einer Woche (docs/PLAN-PHASE-5.md 6.5, 7.2, Etappe N5b; Supabase-Modus seit N7 Teil 2
 * aus shopping_lists/shopping_list_items, `shoppingListFromPayload`). Höchstens eine Liste je Woche. `list` ist der
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

/**
 * Bewertung nach dem Essen (KONZEPT 6.10, docs/PLAN-PHASE-5.md 19.7 N10) – so wie die spätere Tabelle `recipe_ratings`
 * (user_id, recipe_id, value, reason, rated_on; Tabelle seit N7). Je Rezept eine
 * Zeile (die letzte Bewertung). Kein Gesundheitsdatum – der Grund „Unverträglich“ wird nie gespeichert –, aber privat:
 * nie an Analytics oder Logs, in Export und Löschung enthalten.
 */
export interface RecipeRatingRow {
  user_id: string;
  recipe_id: RecipeRating['recipeId'];
  value: RecipeRating['value'];
  reason: RecipeRating['reason'];
  rated_on: string;
}

/**
 * „Mag ich nicht“ je Lebensmittel (`food_dislikes`, 19.7 N10; Tabelle seit N7, ohne Zeitstempel). Hart wie die
 * Gruppen-Abneigungen. Kein Gesundheitsdatum (ohne Grund gespeichert), nie an Analytics oder Logs.
 */
export interface FoodDislikeRow {
  user_id: string;
  food_id: string;
}

/**
 * Ernährungstagebuch (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5) – Spalten wie `food_log_entries`; Werte-Listen
 * aus packages/core (`foodLogEntrySchema`), nicht `string` wie in den generierten Typen (Abgleich in
 * row-types.test.ts). SENSIBEL (Art. 9, vorsorglich, A-G12): nie loggen, beim Widerruf health_data gelöscht.
 */
export type FoodLogEntryRow = FoodLogEntry & {
  user_id: string;
  revision: number;
  last_write_id: string;
  created_at: string;
  updated_at: string;
};

/** Favorit (Stern) – Spalten wie `food_log_favorites`. Kein Gesundheitsdatum (A-G14), bleibt beim Widerruf. */
export type FoodLogFavoriteRow = FoodLogFavorite & { user_id: string; created_at: string };

/**
 * Eigenes Gericht (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7) – Spalten wie `custom_meals` (die Zutaten stehen
 * in `custom_meal_items`). Der Name ist Freitext: nur mit Einwilligung health_data, beim Widerruf gelöscht, nie loggen,
 * nie in testIDs.
 */
export type CustomMealRow = Omit<CustomMeal, 'items'> & {
  user_id: string;
  revision: number;
  last_write_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Eigenes Produkt (Etappe E4a, docs/PLAN-E4.md 3.4) – Spalten wie `user_food_products`. Name und Marke sind Freitext:
 * nur mit Einwilligung health_data, beim Widerruf gelöscht, nie loggen, nie in testIDs.
 */
export type UserFoodProductRow = UserFoodProduct & {
  user_id: string;
  revision: number;
  last_write_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Gelernte Zuordnung Strichcode → Lebensmittel (Einkaufen E1, docs/PLAN-EINKAUFEN-AUSDAUER.md 3) – Spalten wie
 * `shopping_product_links`. SENSIBEL (Konsum): nur mit Einwilligung health_data, beim Widerruf gelöscht, nie loggen.
 */
export interface ShoppingProductLinkRow {
  user_id: string;
  code: string;
  food_id: string;
  updated_at: string;
}

/**
 * Anordnung der Übersicht und der Menüleiste (Etappe E2, docs/PLAN-EINKAUFEN-AUSDAUER.md 4) – Spalten wie
 * `app_layout_settings`. Kein Gesundheitsdatum. Angezeigt wird immer `normalizeLayout` (packages/core).
 */
export interface AppLayoutRow {
  user_id: string;
  dashboard_tiles: StoredAppLayout['dashboard_tiles'];
  tab_bar: StoredAppLayout['tab_bar'];
  /** Eigenes Schrittziel (22.10.2026); fehlt/null = Standard 8.000. Einstellung, kein Gesundheitsdatum. */
  step_goal?: StoredAppLayout['step_goal'];
}

/** Zutat eines eigenen Gerichts – Spalten wie `custom_meal_items`. */
export type CustomMealItemRow = CustomMealItem & {
  meal_id: string;
  user_id: string;
  order_no: number;
};

/**
 * Wettkampf (Phase 10 WP3, Tabelle `competitions`) – Spalten wie die Datenbank (Abgleich mit core.CompetitionRow in
 * row-types.test.ts). Kein Gesundheitsdatum; der Plan-Bezug (uses_health_data) wird beim Widerruf geleert. Lesen,
 * Anlegen und der Testmodus folgen mit WP4 – bis dahin immer leer.
 */
export type CompetitionRow = Tables<'competitions'>;

/** Alle Zeilen eines Nutzers – im Testmodus der komplette Gerätespeicher, im Supabase-Modus ein Abbild. */
export interface UserRows {
  profile: ProfileRow | null;
  consents: ConsentRow[];
  goals: GoalsRow | null;
  /** Trainingstage (Art + Dauer, optional Wochentag) – kein Gesundheitsdatum. */
  trainingSlots: TrainingSlotRow[];
  userEquipment: UserEquipmentRow[];
  nutritionPrefs: NutritionPrefsRow | null;
  /** Schritt `nutrition_setup` (Testmodus ab Etappe N4; Supabase-Modus seit N7 aus den Spalten von nutrition_prefs). */
  nutritionSetup: NutritionSetupRow | null;
  foodPreferences: FoodPreferenceRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  bodyMetrics: BodyMetricsRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  bodyMeasurements: BodyMeasurementsRow[];
  /** SENSIBEL (Art. 9 DSGVO) */
  healthScreenings: HealthScreeningRow[];
  /**
   * Wunschgewicht (Etappe Z3; höchstens eins, nur mit Abnehmziel). SENSIBEL (Art. 9 DSGVO) – im Supabase-Modus nur im
   * Arbeitsspeicher. Der Bildschirm dazu kommt mit Etappe Z4.
   */
  weightGoal: WeightGoalRow | null;
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
  /**
   * Essenspläne je Woche (Testmodus ab Etappe N5; Supabase-Modus seit N7 Teil 2 aus meal_plans/meal_plan_items). Nur
   * Wochen innerhalb der Löschfrist (`nutritionWeekRetained`, G-N7-2).
   */
  mealPlans: MealPlanRow[];
  /** Einkaufslisten je Woche (Testmodus ab Etappe N5b; Supabase-Modus seit N7 Teil 2). */
  shoppingLists: ShoppingListRow[];
  /** Bewertungen nach dem Essen (Testmodus ab Etappe N10; Supabase-Modus seit N7 aus recipe_ratings). */
  recipeRatings: RecipeRatingRow[];
  /** „Mag ich nicht“ je Lebensmittel (Testmodus ab Etappe N10; Supabase-Modus seit N7 aus food_dislikes). */
  foodDislikes: FoodDislikeRow[];
  /**
   * Ernährungstagebuch (Testmodus ab Etappe E1; Supabase-Modus seit N7 Teil 2: die letzten LOG_CACHE_WEEKS Wochen,
   * dazu noch nicht übertragene Einträge der verschlüsselten Warteschlange). SENSIBEL.
   */
  foodLogEntries: FoodLogEntryRow[];
  /** Favoriten des Tagebuchs (Testmodus ab E1; Supabase-Modus seit N7 Teil 2). */
  foodLogFavorites: FoodLogFavoriteRow[];
  /**
   * Eigene Gerichte und ihre Zutaten (Testmodus ab E2; Supabase-Modus seit N7 Teil 2). Name = Freitext, SENSIBEL.
   */
  customMeals: CustomMealRow[];
  customMealItems: CustomMealItemRow[];
  /** Eigene Produkte (Etappe E4a; Testmodus und Supabase-Modus). Name/Marke = Freitext, SENSIBEL. */
  userFoodProducts: UserFoodProductRow[];
  /** Gelernte Zuordnungen Strichcode → Lebensmittel (Einkaufen E1; Testmodus und Supabase-Modus). SENSIBEL. */
  shoppingProductLinks: ShoppingProductLinkRow[];
  /** Anordnung der Übersicht und der Menüleiste (Etappe E2; null = Standard). */
  appLayout: AppLayoutRow | null;
  /** Wettkämpfe (Phase 10 WP3; App und Testmodus ab WP4 – bis dahin immer leer). */
  competitions: CompetitionRow[];
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
    weightGoal: null,
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
    recipeRatings: [],
    foodDislikes: [],
    foodLogEntries: [],
    foodLogFavorites: [],
    customMeals: [],
    customMealItems: [],
    userFoodProducts: [],
    shoppingProductLinks: [],
    appLayout: null,
    competitions: [],
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
  /** Nebenziel (docs/PLAN-ZIELE.md 4, Etappe Z3); null = keins. Auswahl in der App ab Etappe Z4. */
  secondaryGoalType: GoalType | null;
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
  /**
   * Konkretes Abnehmziel (Schritt `weight_goal`, Etappe Z3/Z4): normalisiert wie `weightGoalSchema`; null = „ohne
   * festes Ziel“. Gesundheitsdatum – im Supabase-Modus nur im Arbeitsspeicher.
   */
  weightGoal?: WeightGoal | null;
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
  /** null = „ohne festes Ziel“ (ein gespeichertes Wunschgewicht wird gelöscht). */
  | { step: 'weight_goal'; weightGoal: WeightGoal | null }
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
