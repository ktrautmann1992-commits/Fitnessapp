import type {
  BodyMeasurementsInput,
  BodyMetricsStep,
  ConsentPlatform,
  ConsentType,
  CookingStep,
  EnduranceDiscipline,
  EquipmentItemInput,
  ExperienceLevel,
  GoalType,
  HealthFlag,
  HealthScreeningAnswers,
  NutritionStep,
  OnboardingStep,
  Sex,
  TrainingLocation,
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
export type NutritionPrefsRow = WithoutTimestamps<Tables<'nutrition_prefs'>>;
export type FoodPreferenceRow = WithoutTimestamps<Tables<'food_preferences'>>;
export type BodyMetricsRow = WithoutTimestamps<Tables<'body_metrics'>>;
export type BodyMeasurementsRow = WithoutTimestamps<Tables<'body_measurements'>>;
export type HealthScreeningRow = Tables<'health_screening'>;
export type MeasurementReminderRow = WithoutTimestamps<Tables<'measurement_reminders'>>;

/** Alle Zeilen eines Nutzers – im Testmodus der komplette Gerätespeicher, im Supabase-Modus ein Abbild. */
export interface UserRows {
  profile: ProfileRow | null;
  consents: ConsentRow[];
  goals: GoalsRow | null;
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
}

export function emptyUserRows(): UserRows {
  return {
    profile: null,
    consents: [],
    goals: null,
    userEquipment: [],
    nutritionPrefs: null,
    foodPreferences: [],
    bodyMetrics: [],
    bodyMeasurements: [],
    healthScreenings: [],
    reminder: null,
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

export interface TimeBudgetAnswer {
  sessionsPerWeek: number;
  minutesPerSession: number;
  preferredDays: number[];
}

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
  timeBudget?: TimeBudgetAnswer;
  trainingLocation?: TrainingLocation;
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
  | { step: 'time_budget'; timeBudget: TimeBudgetAnswer }
  | { step: 'training_location'; trainingLocation: TrainingLocation }
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
