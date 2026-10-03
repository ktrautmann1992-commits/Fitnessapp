import {
  bodyMetricsStepSchema,
  cookingStepSchema,
  createBodyMeasurementsInputSchema,
  createMeasuredOnSchema,
  dietTypeSchema,
  enduranceDisciplineSchema,
  equipmentStepSchema,
  experienceLevelSchema,
  foodPreferenceSchema,
  goalTypeSchema,
  isoDateSchema,
  MEASUREMENT_SITES,
  measurementReminderIntervalSchema,
  nutritionStepSchema,
  onboardingStepSchema,
  sexSchema,
  timeBudgetStepSchema,
  trainingLocationSchema,
} from '@fitnessapp/core';
import { z } from 'zod';

import type { ProfileRow } from './types';
import { kindsForScope, type WriteOp } from './write-ops';

/**
 * Testmodus: Prüft jeden Schreib-Vorgang wie die CHECK-Bedingungen und Trigger der Datenbank – mit den
 * Zod-Schemas und Grenzen aus packages/core (constants.ts). So kann auch im Testmodus kein Wert gespeichert
 * werden, den die echte Datenbank ablehnen würde (z. B. Größe 500 cm, Messdatum übermorgen).
 * Gibt true zurück, wenn der Vorgang gültig ist. Rein und getestet (local-rules.test.ts).
 */
export function isValidOp(op: WriteOp, context: { today: string; profile: ProfileRow }): boolean {
  switch (op.kind) {
    case 'update_profile': {
      const { patch } = op;
      const sex = patch.sex !== undefined ? patch.sex : context.profile.sex;
      const cycle =
        patch.cycle_module_interest !== undefined
          ? patch.cycle_module_interest
          : context.profile.cycle_module_interest;
      return (
        (patch.sex == null || sexSchema.safeParse(patch.sex).success) &&
        // Zyklus-Modul nur bei „weiblich“ (CHECK in profiles).
        (cycle == null || sex === 'female') &&
        (patch.experience_level == null ||
          experienceLevelSchema.safeParse(patch.experience_level).success) &&
        (patch.onboarding_step == null ||
          onboardingStepSchema.safeParse(patch.onboarding_step).success)
      );
    }
    case 'grant_consent':
      return true;
    case 'upsert_goals': {
      const row = op.row;
      const timeOk =
        row.sessions_per_week === null && row.minutes_per_session === null
          ? z.array(z.number().int().min(1).max(7)).safeParse(row.preferred_days).success
          : timeBudgetStepSchema.safeParse({
              sessionsPerWeek: row.sessions_per_week,
              minutesPerSession: row.minutes_per_session,
              preferredDays: row.preferred_days,
            }).success;
      return (
        goalTypeSchema.safeParse(row.goal_type).success &&
        (row.discipline === null ||
          (row.goal_type === 'endurance' &&
            enduranceDisciplineSchema.safeParse(row.discipline).success)) &&
        (row.target_date === null ||
          (isoDateSchema.safeParse(row.target_date).success && row.target_date >= '2000-01-01')) &&
        (row.training_location === null ||
          trainingLocationSchema.safeParse(row.training_location).success) &&
        timeOk
      );
    }
    case 'replace_user_equipment':
      return (
        op.rows.every((row) => row.location === op.location) &&
        equipmentStepSchema.safeParse({
          items: op.rows.map((row) => ({
            equipmentId: row.equipment_id,
            location: row.location,
            weightsKg: row.weights_kg,
            note: row.note,
          })),
        }).success
      );
    case 'upsert_nutrition_prefs': {
      const row = op.row;
      const cookingOk =
        row.cooking_mode === null
          ? row.mealprep_days === null
          : cookingStepSchema.safeParse(
              row.cooking_mode === 'meal_prep'
                ? { cookingMode: row.cooking_mode, mealprepDays: row.mealprep_days }
                : { cookingMode: row.cooking_mode },
            ).success &&
            (row.cooking_mode === 'meal_prep' || row.mealprep_days === null);
      const prefsOk =
        row.meals_per_day === null
          ? dietTypeSchema.safeParse(row.diet_type).success &&
            (row.diet_type === 'omnivore' || row.eats_pork !== true)
          : nutritionStepSchema.safeParse({
              dietType: row.diet_type,
              eatsPork: row.eats_pork,
              mealsPerDay: row.meals_per_day,
              foodPreferences: [],
            }).success;
      return prefsOk && cookingOk;
    }
    case 'replace_food_preferences': {
      const kinds = kindsForScope(op.scope);
      const prefs = op.rows.map((row) => ({ foodGroup: row.food_group, kind: row.kind }));
      return (
        op.rows.every((row) => kinds.includes(row.kind)) &&
        prefs.every((pref) => foodPreferenceSchema.safeParse(pref).success) &&
        // Doppelte Einträge und „mag“ + „mag nicht“ derselben Gruppe – gleiche Regel wie im Schritt.
        nutritionStepSchema.safeParse({
          dietType: 'omnivore',
          mealsPerDay: 1,
          foodPreferences: prefs,
        }).success
      );
    }
    case 'upsert_body_metrics': {
      const row = op.row;
      return (
        createMeasuredOnSchema(context.today).safeParse(row.measured_on).success &&
        bodyMetricsStepSchema.safeParse({
          heightCm: row.height_cm,
          weightKg: row.weight_kg,
          bodyFatPct: row.body_fat_pct,
          restingHeartRateBpm: row.resting_heart_rate_bpm,
        }).success
      );
    }
    case 'upsert_body_measurements': {
      const input: Record<string, unknown> = { measuredOn: op.row.measured_on };
      for (const site of MEASUREMENT_SITES) {
        input[site.id] = op.row[site.column];
      }
      return createBodyMeasurementsInputSchema(context.today).safeParse(input).success;
    }
    case 'insert_health_screening':
      // Antworten und Arzt-Hinweis prüft local-backend.ts (Flags wie der Datenbank-Trigger).
      return true;
    case 'upsert_measurement_reminder':
      return (
        measurementReminderIntervalSchema.safeParse(op.row.interval_days).success &&
        (op.row.next_due_on === null || isoDateSchema.safeParse(op.row.next_due_on).success)
      );
  }
}
