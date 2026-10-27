import {
  BARBELL_ID,
  type ConsentPlatform,
  type ConsentRecord,
  type ConsentType,
  deriveTrainingLocation,
  equipmentIdSchema,
  foodGroupSchema,
  gymHyroxEquipmentIds,
  gymHyroxFromRows,
  gymRowingFromRows,
  hasGoal,
  healthScreeningAnswersSchema,
  HEALTH_FLAGS,
  type HealthFlag,
  isAllowedGoalPair,
  isOnboardingStep,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  MEASUREMENT_SITES,
  type NutritionStep,
  nextMeasurementDue,
  nutritionSetupColumns,
  ONBOARDING_STEPS,
  type OnboardingStep,
  scheduleFromSlots,
  scheduleToSlots,
  type TrainingSchedule,
  type WeightGoal,
  weightGoalSchema,
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
  GoalAnswer,
  GoalsRow,
  NutritionPrefsRow,
  OnboardingAnswers,
  StepSave,
  TrainingSlotRow,
  UserEquipmentRow,
  UserRows,
  WeightGoalRow,
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
  /** Onboarding schon abgeschlossen (Bearbeiten aus den Einstellungen). */
  onboardingCompleted?: boolean | undefined;
  /**
   * Ist ein Wunschgewicht gespeichert (Zeile `weight_goals`)? `false` → „ohne festes Ziel“ braucht kein Löschen (spart
   * den Online-Vorgang, Etappe Z4). Ohne Angabe wird vorsichtshalber gelöscht.
   */
  hasStoredWeightGoal?: boolean | undefined;
}

/** Übernimmt einen gespeicherten Schritt in die Antworten (für Anzeige und für planStepWrites). */
export function applyStepToAnswers(answers: OnboardingAnswers, save: StepSave): OnboardingAnswers {
  switch (save.step) {
    case 'sex':
      return {
        ...answers,
        sex: save.sex,
        cycleModuleInterest: save.sex !== 'male' ? save.cycleModuleInterest : null,
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
      return {
        ...answers,
        goal: save.goal,
        // Wie der Datenbank-Trigger (Wächter S13): ohne Abnehmen als Haupt- oder Nebenziel kein Wunschgewicht.
        ...(losesWeight(save.goal) ? {} : { weightGoal: null }),
      };
    case 'weight_goal':
      return { ...answers, weightGoal: save.weightGoal };
    case 'time_budget':
      return {
        ...answers,
        trainingSchedule: save.schedule,
        ...(save.gymRowing === undefined && save.gymHyrox === undefined
          ? {}
          : {
              equipment: [
                ...(answers.equipment ?? []).filter((item) => item.location !== 'gym'),
                ...gymEquipmentItemsFor(save, answers),
              ],
            }),
      };
    case 'equipment':
      // Nur Geräte zu Hause – Studio-Angaben (Etappe R: „Im Studio auch rudern“) bleiben erhalten.
      return {
        ...answers,
        equipment: [
          ...save.items,
          ...(answers.equipment ?? []).filter((item) => item.location === 'gym'),
        ],
      };
    case 'nutrition':
      return { ...answers, nutrition: save.nutrition };
    case 'cooking':
      return { ...answers, cooking: save.cooking };
    case 'nutrition_setup':
      return { ...answers, nutritionSetup: save.setup };
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

/** Ist Abnehmen Haupt- oder Nebenziel (docs/PLAN-ZIELE.md 2.1)? */
export function losesWeight(goal: Pick<GoalAnswer, 'goalType' | 'secondaryGoalType'>): boolean {
  // Regel aus packages/core (`hasGoal`); ein ungültiges Paar (alter Stand) zählt nur mit dem Hauptziel.
  const secondary = isAllowedGoalPair(goal.goalType, goal.secondaryGoalType)
    ? (goal.secondaryGoalType ?? null)
    : null;
  return hasGoal({ primary: goal.goalType, secondary }, 'fat_loss');
}

/** Ist Ausdauer Haupt- oder Nebenziel (Disziplin nur dann, CHECK goals_discipline_check)? */
function hasEndurance(goal: Pick<GoalAnswer, 'goalType' | 'secondaryGoalType'>): boolean {
  return goal.goalType === 'endurance' || goal.secondaryGoalType === 'endurance';
}

export function toGoalsRow(userId: string, answers: OnboardingAnswers): GoalsRow {
  if (!answers.goal) {
    throw new Error('Ziel fehlt – Ziel wird vor den Trainingstagen gespeichert.');
  }
  return {
    user_id: userId,
    goal_type: answers.goal.goalType,
    // Nebenziel seit Etappe Z3 (Spalte goals.secondary_goal_type); null = keins.
    secondary_goal_type: answers.goal.secondaryGoalType,
    discipline: hasEndurance(answers.goal) ? answers.goal.discipline : null,
    target_date: answers.goal.targetDate,
    // Abgeleitet aus den Trainingstagen (Erweiterungsplan 3.1); null = nur Ausdauer bzw. noch offen.
    training_location: answers.trainingSchedule
      ? deriveTrainingLocation(answers.trainingSchedule)
      : null,
  };
}

/** Normalisiertes Abnehmziel (packages/core, `weightGoalSchema`) → Zeile von weight_goals (Etappe Z3). */
export function toWeightGoalRow(userId: string, goal: WeightGoal): WeightGoalRow {
  return {
    user_id: userId,
    target_weight_kg: goal.targetWeightKg,
    start_date: goal.startDate,
    target_date: goal.targetDate,
    amount_mode: goal.amountMode,
    time_mode: goal.timeMode,
  };
}

/**
 * Zeile von weight_goals → Abnehmziel für die Ernährungs-Engine. Geprüft mit `weightGoalSchema` (Zod an der Grenze):
 * Passt die Zeile nicht (z. B. alter oder manipulierter Gerätestand), gibt es KEIN Ziel (null) – die Engine plant dann
 * „ohne festes Ziel“, statt dass die ganze Ernährungswoche scheitert (Wächter Z2 K-5).
 */
export function weightGoalFromRow(row: WeightGoalRow | null): WeightGoal | null {
  if (row === null) return null;
  const parsed = weightGoalSchema.safeParse({
    targetWeightKg: Number(row.target_weight_kg),
    startDate: row.start_date,
    targetDate: row.target_date,
    amountMode: row.amount_mode,
    timeMode: row.time_mode,
  });
  return parsed.success ? parsed.data : null;
}

/** Trainingstage → Zeilen von training_slots (slot_no 1…n, wie replace_training_slots). */
export function toTrainingSlotRows(userId: string, schedule: TrainingSchedule): TrainingSlotRow[] {
  return scheduleToSlots(schedule).map((slot) => ({ user_id: userId, ...slot }));
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

/** Studio-Geräte zur Angabe „Im Studio auch rudern“ (Etappe R): nur das Rudergerät oder nichts. */
export function gymRowingItems(enabled: boolean): NonNullable<OnboardingAnswers['equipment']> {
  return enabled ? [{ equipmentId: 'rowing_machine', location: 'gym', weightsKg: [] }] : [];
}

/**
 * Studio-Geräte zur Angabe „Hyrox-Geräte im Studio“ (Sportarten Stufe 1 · Restpunkte): Ski-Ergometer, Schlitten,
 * Sandsack, Wall Ball (GYM_OPTIONAL_EQUIPMENT_IDS) oder nichts.
 */
export function gymHyroxItems(enabled: boolean): NonNullable<OnboardingAnswers['equipment']> {
  return gymHyroxEquipmentIds(enabled).flatMap((id) => {
    const parsed = equipmentIdSchema.safeParse(id);
    return parsed.success
      ? [{ equipmentId: parsed.data, location: 'gym' as const, weightsKg: [] }]
      : [];
  });
}

/**
 * Alle Studio-Geräte nach einer Änderung im Schritt „Trainingstage“: geänderte Angabe aus `save`, die andere bleibt
 * wie gespeichert (Studio-Zeilen werden immer als Ganzes ersetzt).
 */
function gymEquipmentItemsFor(
  save: { readonly gymRowing?: boolean; readonly gymHyrox?: boolean },
  answers: OnboardingAnswers,
): NonNullable<OnboardingAnswers['equipment']> {
  const gymRows = (answers.equipment ?? [])
    .filter((item) => item.location === 'gym')
    .map((item) => ({ equipment_id: item.equipmentId, location: item.location }));
  const rowing = save.gymRowing ?? gymRowingFromRows(gymRows);
  const hyrox = save.gymHyrox ?? gymHyroxFromRows(gymRows);
  return [...gymRowingItems(rowing), ...gymHyroxItems(hyrox)];
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
    bar_kg: item.equipmentId === BARBELL_ID ? (item.barKg ?? null) : null,
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
            cycle_module_interest: save.sex !== 'male' ? save.cycleModuleInterest : null,
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
      return [{ kind: 'upsert_goals', row: toGoalsRow(userId, answers) }, progressOp];
    // Konkretes Abnehmziel (Etappe Z3; Bildschirm ab Z4). null = „ohne festes Ziel“ → ein gespeichertes Ziel wird
    // gelöscht. Nach abgeschlossenem Onboarding (Einstellungen) bleibt der Fortschritt unverändert.
    case 'weight_goal': {
      const ops: WriteOp[] =
        save.weightGoal !== null
          ? [{ kind: 'upsert_weight_goal', row: toWeightGoalRow(userId, save.weightGoal) }]
          : ctx.hasStoredWeightGoal === false
            ? []
            : [{ kind: 'delete_weight_goal' }];
      return ctx.onboardingCompleted ? ops : [...ops, progressOp];
    }
    case 'time_budget':
      // Trainingstage + abgeleiteter Ort in goals (der Schritt „Trainingsort“ entfällt). Etappe R: geänderte Angabe
      // „Im Studio auch rudern“ ersetzt die Studio-Geräte (nur rowing_machine oder leer).
      return [
        { kind: 'replace_training_slots', rows: toTrainingSlotRows(userId, save.schedule) },
        { kind: 'upsert_goals', row: toGoalsRow(userId, answers) },
        ...(save.gymRowing === undefined && save.gymHyrox === undefined
          ? []
          : [
              {
                kind: 'replace_user_equipment' as const,
                location: 'gym' as const,
                rows: toUserEquipmentRows(userId, gymEquipmentItemsFor(save, answers)),
              },
            ]),
        progressOp,
      ];
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
    // Etappe N4: bis N7 nur im Testmodus (der Supabase-Modus zeigt den Schritt nicht, R2-S3).
    // Nach abgeschlossenem Onboarding (z. B. Schalter „Kalorienzahlen anzeigen“) bleibt der Fortschritt unverändert –
    // onboarding_completed_at wird nicht neu gesetzt (Wächter N4 K5).
    case 'nutrition_setup': {
      const setupOp: WriteOp = {
        kind: 'upsert_nutrition_setup',
        row: { user_id: userId, ...nutritionSetupColumns(save.setup) },
      };
      return ctx.onboardingCompleted ? [setupOp] : [setupOp, progressOp];
    }
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
      // Ältere Stände ohne Spalte (vor Etappe Z3): kein Nebenziel.
      secondaryGoalType: goals.secondary_goal_type ?? null,
      discipline: goals.discipline,
      targetDate: goals.target_date,
    };
  }
  const weightGoal = weightGoalFromRow(rows.weightGoal);
  if (weightGoal !== null) {
    answers.weightGoal = weightGoal;
  }
  const schedule = scheduleFromSlots(rows.trainingSlots);
  if (schedule) {
    answers.trainingSchedule = schedule;
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
            barKg: row.bar_kg,
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
  const setup = rows.nutritionSetup;
  if (setup) {
    answers.nutritionSetup = {
      activityLevel: setup.activity_level,
      trainingTime: setup.training_time,
      // Meal-Prep-Plätze nur bei Meal-Prep (sonst gilt der Standard „Mittag“ ohne Frage).
      mealprepSlots: prefs?.cooking_mode === 'meal_prep' ? setup.mealprep_slots : null,
      showEnergyNumbers: setup.show_energy_numbers,
    };
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
    ai_food_photo: null,
    wearable_data: null,
  };
  for (const doc of documents) {
    const current = versions[doc.type];
    versions[doc.type] = current === null ? doc.version : Math.max(current, doc.version);
  }
  return versions;
}
