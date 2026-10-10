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

/** Alle Zeilen eines Nutzers – im Testmodus der komplette Gerätespeicher, im Supabase-Modus ein Abbild. */
export interface UserRows {
  profile: ProfileRow | null;
  consents: ConsentRow[];
  goals: GoalsRow | null;
  /** Trainingstage (Art + Dauer, optional Wochentag) – kein Gesundheitsdatum. */
  trainingSlots: TrainingSlotRow[];
  userEquipment: UserEquipmentRow[];
  nutritionPrefs: NutritionPrefsRow | null;
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
}

export function emptyUserRows(): UserRows {
  return {
    profile: null,
    consents: [],
    goals: null,
    trainingSlots: [],
    userEquipment: [],
    nutritionPrefs: null,
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
  | { step: 'cooking'; cooking: CookingStep };

export type StepSaveFor<S extends OnboardingStep> = Extract<StepSave, { step: S }>;

/** Einstellung „Mess-Erinnerung“. */
export interface ReminderSettings {
  enabled: boolean;
  intervalDays: number;
}

export type { ConsentPlatform };
