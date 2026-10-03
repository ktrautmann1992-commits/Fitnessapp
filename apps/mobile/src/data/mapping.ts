import {
  type ConsentPlatform,
  type ConsentRecord,
  type ConsentType,
  equipmentIdSchema,
  foodGroupSchema,
  healthScreeningAnswersSchema,
  HEALTH_FLAGS,
  type HealthFlag,
  isOnboardingStep,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  MEASUREMENT_SITES,
  type NutritionStep,
  nextMeasurementDue,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '@fitnessapp/core';
import type { Json } from '@fitnessapp/db';

import type {
  BodyMeasurementsInsert,
  BodyMetricsInsert,
  FoodPreferenceScope,
  ProfilePatch,
  WriteOp,
} from './write-ops';
import type {
  ConsentRow,
  FoodPreferenceRow,
  GoalsRow,
  NutritionPrefsRow,
  OnboardingAnswers,
  StepSave,
  UserEquipmentRow,
  UserRows,
} from './types';

/**
 * Abbildung Onboarding-Antworten ⇄ Tabellenzeilen (packages/db/src/database.types.ts).
 * Reine Funktionen ohne React Native – getestet in mapping.test.ts.
 */

export type ConsentVersions = Readonly<Record<ConsentType, number | null>>;

export interface PlanContext {
  userId: string;
  /** Antworten INKLUSIVE des gerade gespeicherten Schritts (siehe applyStepToAnswers). */
  answers: OnboardingAnswers;
  /** Nächster Schritt laut packages/core (nextStep); null = Onboarding fertig. */
  nextStep: OnboardingStep | null;
  /** Zeitpunkt (ISO) – wird bei „fertig“ als onboarding_completed_at gespeichert. */
  now: string;
  platform: ConsentPlatform;
  versions: ConsentVersions;
  /** Gültige Einwilligung health_data (aktuelle Version) vorhanden? */
  hasHealthConsent: boolean;
  /** Bisherige Mess-Erinnerung (Abstand bleibt beim Nachmessen erhalten). */
  reminderIntervalDays?: number | undefined;
}

/** Übernimmt einen gespeicherten Schritt in die Antworten (für Anzeige und für planStepWrites). */
export function applyStepToAnswers(answers: OnboardingAnswers, save: StepSave): OnboardingAnswers {
  switch (save.step) {
    case 'sex':
      return {
        ...answers,
        sex: save.sex,
        cycleModuleInterest: save.sex === 'female' ? save.cycleModuleInterest : null,
      };
    case 'health_consent':
      return answers;
    case 'body_metrics':
      return { ...answers, bodyMetrics: { ...save.value, measuredOn: save.measuredOn } };
    case 'body_measurements':
      return {
        ...answers,
        bodyMeasurements: save.value ? { ...save.value, measuredOn: save.measuredOn } : null,
      };
    case 'health_screening':
      return {
        ...answers,
        healthScreening: {
          answers: save.answers,
          flags: [],
          acknowledgedAt: save.acknowledgedAt,
        },
      };
    case 'experience':
      return { ...answers, experienceLevel: save.experienceLevel };
    case 'goal':
      return { ...answers, goal: save.goal };
    case 'time_budget':
      return { ...answers, timeBudget: save.timeBudget };
    case 'training_location':
      return { ...answers, trainingLocation: save.trainingLocation };
    case 'equipment':
      return { ...answers, equipment: save.items };
    case 'nutrition':
      return { ...answers, nutrition: save.nutrition };
    case 'cooking':
      return { ...answers, cooking: save.cooking };
  }
}

/** Fortschritt im Profil: nächster Schritt bzw. „fertig“ (Schritt bleibt, Zeitpunkt wird gesetzt). */
export function progressPatch(
  current: OnboardingStep,
  nextStep: OnboardingStep | null,
  now: string,
): ProfilePatch {
  return nextStep === null
    ? { onboarding_step: current, onboarding_completed_at: now }
    : { onboarding_step: nextStep };
}

export function toGoalsRow(userId: string, answers: OnboardingAnswers): GoalsRow {
  if (!answers.goal) {
    throw new Error('Ziel fehlt – Ziel wird vor Zeitbudget und Trainingsort gespeichert.');
  }
  return {
    user_id: userId,
    goal_type: answers.goal.goalType,
    discipline: answers.goal.goalType === 'endurance' ? answers.goal.discipline : null,
    target_date: answers.goal.targetDate,
    sessions_per_week: answers.timeBudget?.sessionsPerWeek ?? null,
    minutes_per_session: answers.timeBudget?.minutesPerSession ?? null,
    preferred_days: [...(answers.timeBudget?.preferredDays ?? [])].sort((a, b) => a - b),
    training_location: answers.trainingLocation ?? null,
  };
}

export function toNutritionPrefsRow(userId: string, answers: OnboardingAnswers): NutritionPrefsRow {
  if (!answers.nutrition) {
    throw new Error('Ernährungsform fehlt – Ernährung wird vor dem Kochmodus gespeichert.');
  }
  const { dietType, eatsPork, mealsPerDay } = answers.nutrition;
  return {
    user_id: userId,
    diet_type: dietType,
    eats_pork: dietType === 'omnivore' ? (eatsPork ?? null) : null,
    meals_per_day: mealsPerDay,
    cooking_mode: answers.cooking?.cookingMode ?? null,
    mealprep_days:
      answers.cooking?.cookingMode === 'meal_prep' ? answers.cooking.mealprepDays : null,
  };
}

export function toFoodPreferenceRows(
  userId: string,
  nutrition: NutritionStep,
  scope: FoodPreferenceScope,
): FoodPreferenceRow[] {
  return nutrition.foodPreferences
    .filter((p) => (scope === 'intolerance' ? p.kind === 'intolerance' : p.kind !== 'intolerance'))
    .map((p) => ({ user_id: userId, food_group: p.foodGroup, kind: p.kind }));
}

export function toUserEquipmentRows(
  userId: string,
  items: NonNullable<OnboardingAnswers['equipment']>,
): UserEquipmentRow[] {
  return items.map((item) => ({
    user_id: userId,
    equipment_id: item.equipmentId,
    location: item.location,
    weights_kg: [...item.weightsKg].sort((a, b) => a - b),
    note: item.note ?? null,
  }));
}

export function toBodyMetricsRow(
  userId: string,
  save: Extract<StepSave, { step: 'body_metrics' }>,
): BodyMetricsInsert {
  return {
    user_id: userId,
    measured_on: save.measuredOn,
    height_cm: save.value.heightCm,
    weight_kg: save.value.weightKg,
    body_fat_pct: save.value.bodyFatPct ?? null,
    resting_heart_rate_bpm: save.value.restingHeartRateBpm ?? null,
  };
}

export function toBodyMeasurementsRow(
  userId: string,
  measuredOn: string,
  value: NonNullable<Extract<StepSave, { step: 'body_measurements' }>['value']>,
): BodyMeasurementsInsert {
  const row: Record<string, number | string | null> = {
    user_id: userId,
    measured_on: measuredOn,
  };
  for (const site of MEASUREMENT_SITES) {
    row[site.column] = value[site.id] ?? null;
  }
  return row as unknown as BodyMeasurementsInsert;
}

/**
 * Zerlegt einen gespeicherten Onboarding-Schritt in Schreib-Vorgänge.
 * Reihenfolge: zuerst die Daten, zuletzt der Fortschritt im Profil – so springt das Profil nie weiter,
 * wenn das Speichern der Daten scheitert.
 */
export function planStepWrites(save: StepSave, ctx: PlanContext): WriteOp[] {
  const { userId, answers } = ctx;
  const progressOp: WriteOp = {
    kind: 'update_profile',
    patch: progressPatch(save.step, ctx.nextStep, ctx.now),
  };
  switch (save.step) {
    case 'sex':
      return [
        {
          kind: 'update_profile',
          patch: {
            sex: save.sex,
            cycle_module_interest: save.sex === 'female' ? save.cycleModuleInterest : null,
            ...progressPatch(save.step, ctx.nextStep, ctx.now),
          },
        },
      ];
    case 'health_consent': {
      const version = ctx.versions.health_data;
      const ops: WriteOp[] = [];
      if (save.granted && !ctx.hasHealthConsent && version !== null) {
        ops.push({
          kind: 'grant_consent',
          consentType: 'health_data',
          version,
          platform: ctx.platform,
        });
      }
      return [...ops, progressOp];
    }
    case 'body_metrics':
      return [{ kind: 'upsert_body_metrics', row: toBodyMetricsRow(userId, save) }, progressOp];
    case 'body_measurements': {
      if (save.value === null) {
        return [progressOp];
      }
      const intervalDays = ctx.reminderIntervalDays ?? MEASUREMENT_REMINDER_INTERVAL_DAYS.default;
      return [
        {
          kind: 'upsert_body_measurements',
          row: toBodyMeasurementsRow(userId, save.measuredOn, save.value),
        },
        {
          kind: 'upsert_measurement_reminder',
          row: {
            user_id: userId,
            enabled: save.reminderEnabled,
            interval_days: intervalDays,
            next_due_on: nextMeasurementDue(save.measuredOn, intervalDays),
          },
        },
        progressOp,
      ];
    }
    case 'health_screening':
      return [
        {
          kind: 'insert_health_screening',
          row: {
            user_id: userId,
            answers: save.answers as Json,
            medical_notice_acknowledged_at: save.acknowledgedAt,
          },
        },
        progressOp,
      ];
    case 'experience':
      return [
        {
          kind: 'update_profile',
          patch: {
            experience_level: save.experienceLevel,
            ...progressPatch(save.step, ctx.nextStep, ctx.now),
          },
        },
      ];
    case 'goal':
    case 'time_budget':
    case 'training_location':
      return [{ kind: 'upsert_goals', row: toGoalsRow(userId, answers) }, progressOp];
    case 'equipment':
      return [
        {
          kind: 'replace_user_equipment',
          location: 'home',
          rows: toUserEquipmentRows(
            userId,
            save.items.filter((item) => item.location === 'home'),
          ),
        },
        progressOp,
      ];
    case 'nutrition': {
      const ops: WriteOp[] = [
        { kind: 'upsert_nutrition_prefs', row: toNutritionPrefsRow(userId, answers) },
        {
          kind: 'replace_food_preferences',
          scope: 'taste',
          rows: toFoodPreferenceRows(userId, save.nutrition, 'taste'),
        },
      ];
      // Unverträglichkeiten sind Gesundheitsdaten: nur mit gültiger Einwilligung (wie die RLS-Policy).
      if (ctx.hasHealthConsent) {
        ops.push({
          kind: 'replace_food_preferences',
          scope: 'intolerance',
          rows: toFoodPreferenceRows(userId, save.nutrition, 'intolerance'),
        });
      }
      return [...ops, progressOp];
    }
    case 'cooking':
      return [
        { kind: 'upsert_nutrition_prefs', row: toNutritionPrefsRow(userId, answers) },
        progressOp,
      ];
  }
}

// ---------------------------------------------------------------------------------------------------------
// Zeilen → Antworten (Fortsetzen nach Neustart oder auf einem anderen Gerät)
// ---------------------------------------------------------------------------------------------------------

function latestBy<T>(items: readonly T[], key: (item: T) => string): T | undefined {
  return [...items].sort((a, b) => key(b).localeCompare(key(a)))[0];
}

function isHealthFlag(value: string): value is HealthFlag {
  return (HEALTH_FLAGS as readonly string[]).includes(value);
}

export function answersFromRows(rows: UserRows): OnboardingAnswers {
  const answers: OnboardingAnswers = {};
  const { profile } = rows;
  if (profile) {
    answers.birthDate = profile.birth_date;
    if (profile.sex) {
      answers.sex = profile.sex;
      answers.cycleModuleInterest = profile.cycle_module_interest;
    }
    if (profile.experience_level) {
      answers.experienceLevel = profile.experience_level;
    }
  }

  const metrics = latestBy(rows.bodyMetrics, (r) => r.measured_on);
  if (metrics && metrics.height_cm !== null && metrics.weight_kg !== null) {
    answers.bodyMetrics = {
      heightCm: metrics.height_cm,
      weightKg: metrics.weight_kg,
      bodyFatPct: metrics.body_fat_pct,
      restingHeartRateBpm: metrics.resting_heart_rate_bpm,
      measuredOn: metrics.measured_on,
    };
  }

  const measurements = latestBy(rows.bodyMeasurements, (r) => r.measured_on);
  if (measurements) {
    const value: Record<string, number | null | string> = { measuredOn: measurements.measured_on };
    for (const site of MEASUREMENT_SITES) {
      value[site.id] = measurements[site.column] ?? null;
    }
    answers.bodyMeasurements = value as NonNullable<OnboardingAnswers['bodyMeasurements']>;
  }

  const screening = latestBy(rows.healthScreenings, (r) => r.created_at);
  if (screening) {
    const parsed = healthScreeningAnswersSchema.safeParse(screening.answers);
    if (parsed.success) {
      answers.healthScreening = {
        answers: parsed.data,
        flags: screening.flags.filter(isHealthFlag),
        acknowledgedAt: screening.medical_notice_acknowledged_at,
      };
    }
  }

  const { goals } = rows;
  if (goals) {
    answers.goal = {
      goalType: goals.goal_type,
      discipline: goals.discipline,
      targetDate: goals.target_date,
    };
    if (goals.sessions_per_week !== null && goals.minutes_per_session !== null) {
      answers.timeBudget = {
        sessionsPerWeek: goals.sessions_per_week,
        minutesPerSession: goals.minutes_per_session,
        preferredDays: [...goals.preferred_days],
      };
    }
    if (goals.training_location) {
      answers.trainingLocation = goals.training_location;
    }
  }

  const equipment = rows.userEquipment.flatMap((row) => {
    const id = equipmentIdSchema.safeParse(row.equipment_id);
    return id.success
      ? [
          {
            equipmentId: id.data,
            location: row.location,
            weightsKg: [...row.weights_kg],
            note: row.note,
          },
        ]
      : [];
  });
  if (equipment.length > 0 || profileIsPast(profile?.onboarding_step, 'equipment')) {
    answers.equipment = equipment;
  }

  const prefs = rows.nutritionPrefs;
  if (prefs && prefs.meals_per_day !== null) {
    answers.nutrition = {
      dietType: prefs.diet_type,
      eatsPork: prefs.eats_pork,
      mealsPerDay: prefs.meals_per_day,
      foodPreferences: rows.foodPreferences.flatMap((row) => {
        const group = foodGroupSchema.safeParse(row.food_group);
        return group.success ? [{ foodGroup: group.data, kind: row.kind }] : [];
      }),
    };
    if (prefs.cooking_mode === 'daily') {
      answers.cooking = { cookingMode: 'daily' };
    } else if (prefs.cooking_mode === 'meal_prep' && prefs.mealprep_days !== null) {
      answers.cooking = { cookingMode: 'meal_prep', mealprepDays: prefs.mealprep_days };
    }
  }
  return answers;
}

function profileIsPast(saved: string | null | undefined, step: OnboardingStep): boolean {
  return (
    isOnboardingStep(saved) && ONBOARDING_STEPS.indexOf(saved) > ONBOARDING_STEPS.indexOf(step)
  );
}

/** consents-Zeilen → Format der Einwilligungs-Funktionen in packages/core. */
export function consentRecordsFromRows(rows: readonly ConsentRow[]): ConsentRecord[] {
  return rows.map((row) => ({
    consentType: row.consent_type,
    version: row.version,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at,
  }));
}

/** Aktuelle Versionen aus den geladenen Texten (fehlende Art = kein Text, z. B. cycle_data). */
export function versionsFromDocuments(
  documents: readonly { type: ConsentType; version: number }[],
): ConsentVersions {
  const versions: Record<ConsentType, number | null> = {
    terms: null,
    privacy: null,
    health_data: null,
    cycle_data: null,
  };
  for (const doc of documents) {
    const current = versions[doc.type];
    versions[doc.type] = current === null ? doc.version : Math.max(current, doc.version);
  }
  return versions;
}
