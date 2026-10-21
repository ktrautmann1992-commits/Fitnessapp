/**
 * Prüft, dass Code (packages/core) und Datenbank (supabase/migrations) dieselben Listen und Grenzen nutzen.
 * Ändert jemand nur eine Seite, schlägt dieser Test fehl.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MEASUREMENT_SITES } from './body-measurements';
import { CURRENT_CONSENT_VERSIONS } from './consent';
import {
  SUPPLEMENT_CONTENT_CATEGORIES,
  SUPPLEMENT_CONTENT_IDS,
  SUPPLEMENT_EVIDENCE_LEVELS,
} from './content/supplement-schema';
import { SUPPLEMENT_IDS } from './supplement-ids';
import {
  PROTEIN_SELF_CHECK_ANSWERS,
  SUPPLEMENT_FLAGS,
  SUPPLEMENT_SCREENING_QUESTIONS,
} from './supplements/screening';
import { USER_SUPPLEMENT_STATUSES } from './supplements/user-data';
import {
  CARDIO_LOG_LIMITS,
  ENDURANCE_SESSION_LIMITS,
  EQUIPMENT_WEIGHT_DECIMALS,
  BARBELL_BAR_KG,
  BARBELL_PLATE_MAX_KG,
  BIRTH_DATE_MIN,
  PLAN_BLOCK_LIMITS,
  PLAN_SAVE_LIMITS,
  PLANNED_LOAD_LIMITS,
  SESSION_LOG_LIMITS,
  WORKOUT_LIMITS,
  FREE_SESSION,
  SESSION_RPE_LIMITS,
  SET_RPE_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
  BODY_MEASUREMENT_LIMITS,
  CONTENT_SCHEMA_LIMITS,
  SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION,
  SUPPLEMENT_SCREENING_VERSION,
  FOOD_LOG_LIMITS,
  FOOD_PRODUCT_CHECK,
  FOOD_PRODUCT_LOOKUP_LIMITS,
  OPEN_FOOD_FACTS,
  USER_FOOD_PRODUCT_LIMITS,
  AI_FOOD_PHOTO,
  AI_GLOBAL_BUDGET,
  CUSTOM_MEAL_LIMITS,
  PINCH_G,
  BODY_METRIC_LIMITS,
  WEIGHT_GOAL_LIMITS,
  WEIGHT_GOAL_START_DATE_MIN,
  ACTIVE_AGING_RULES,
  AGE_PLAN_RULES,
  COMPETITION_CYCLING,
  COMPETITION_DISTANCE_M,
  COMPETITION_EFFORT_LIMITS,
  COMPETITION_GROUP_RULES,
  COMPETITION_INPUT_LIMITS,
  COMPETITION_INTENSITY,
  COMPETITION_LEAD_WEEKS,
  COMPETITION_LONG_RUN,
  COMPETITION_WORKOUTS,
  ENDURANCE_EFFORT,
  COMPETITION_OWN_START,
  COMPETITION_PACE,
  COMPETITION_RECORD_LIMITS,
  COMPETITION_START_REFERENCE,
  ENDURANCE_OVERLOAD_RULE,
  EQUIPMENT_LIMITS,
  MEASURED_ON_MAX_DAYS_AHEAD,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  MIN_AGE_YEARS,
  NUTRITION_LIMITS,
  TRAINING_LIMITS,
  INGREDIENT_SUBSTITUTION_LIMITS,
  MEAL_PLAN_ENGINE_VERSION,
  MEAL_PLAN_PAYLOAD_MAX_BYTES,
  SHOPPING_LIST_PAYLOAD_MAX_BYTES,
  MEAL_PREP_FRIDGE_DAYS,
  PACKAGE_SIZE_LIMITS,
  PORTION_SCALE_LIMITS,
  RECIPE_RATING_RULES,
  RECIPE_SCHEMA_LIMITS,
  RECIPE_SERVINGS_PICKER,
  SHOPPING_LIST_EXTRAS,
  SHOPPING_LIST_ROUNDING,
  BODY_FAT_MAX_AGE_DAYS,
  KATCH_MCARDLE,
  MEAL_PLAN_DAY_KCAL_CHECK,
  MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE,
  MEAL_PLAN_RETENTION_WEEKS,
  AMOUNT_ROUNDING,
  MIFFLIN_ST_JEOR,
  MIN_INTAKE_RELATIVE_TO_BMR,
  CARDIO_PLAUSIBILITY_KMH,
  ROUTE_ELEVATION_PROFILE,
  ROUTE_FILTER,
  TRACKED_ROUTE_LIMITS,
  TRACKED_ROUTE_LOG_MATCH,
  LIVE_ADJUSTMENT,
  LOAD_PROGRESSION,
  SESSION_FIT,
  DELOAD_DOSAGE,
  DELOAD_SCHEDULE,
  ENDURANCE_DELOAD_VOLUME_FACTOR,
  MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION,
  SHOPPING_SCAN,
  APP_LAYOUT,
  DAILY_METRIC_LIMITS,
  HEART_RATE_LIMITS,
  WEARABLE_SYNC,
} from './constants';
import {
  WEARABLE_DATA_TYPES,
  WEARABLE_NAME_PATTERN,
  WEARABLE_ORIGINS,
  WEARABLE_SESSION_GROUPS,
  wearableSessionImportSchema,
  heartRateSummarySchema,
  dailyMetricImportSchema,
  wearableImportBatchSchema,
} from './wearables/schema';
import { DASHBOARD_TILES, FIXED_FIRST_TAB, FIXED_LAST_TAB, NAV_AREAS } from './layout';
import { serverDayKcalFloor } from './nutrition/plausibility';
import { AI_USAGE_STATUSES } from './nutrition/food-photo';
import {
  ANIMAL_KINDS,
  GELATIN_ORIGINS,
  MEAT_KINDS,
  SHOPPING_CATEGORIES,
} from './content/food-schema';
import { INGREDIENT_ROLES, MEAL_TYPES, RECIPE_CATEGORY_IDS } from './content/recipe-schema';
import { EXTRA_SLOTS } from './nutrition/meal-plan';
import {
  MEAL_PLAN_SLOT_KEYS,
  mealPlanItemPayloadSchema,
  mealPlanPayloadSchema,
} from './nutrition/meal-plan-payload';
import { RECIPE_RATING_REASONS, RECIPE_RATING_VALUES } from './nutrition/ratings';
import { NOT_VEGETARIAN_ANIMAL_KINDS } from './nutrition/recipe-nutrients';
import { nutritionSetupColumnsSchema } from './nutrition/schemas';
import {
  shoppingListItemPayloadSchema,
  shoppingListPayloadSchema,
  shoppingListRecipePayloadSchema,
} from './nutrition/shopping-list-payload';
import { RECIPE_UNITS } from './nutrition/units';
import * as enums from './enums';
import { WORKOUT_CATEGORIES, WORKOUT_FORMATS } from './workouts/schema';
import { DATA_EXPORT_TABLES } from './export/data-export';
import { BARCODE_PATTERN } from './nutrition/barcode';
import {
  FOOD_PRODUCT_BASE_UNITS,
  FOOD_PRODUCT_CHECK_LEVELS,
  FOOD_PRODUCT_CHECK_REASONS,
  userFoodProductPayloadSchema,
} from './nutrition/food-product';
import { foodProductRecordSchema } from './nutrition/food-product-lookup';
import {
  FOOD_LOG_FAVORITE_SOURCES,
  FOOD_LOG_REJECT_CODES,
  FOOD_LOG_SLOTS,
  FOOD_LOG_SOURCES,
  FOOD_LOG_UNITS,
  foodLogFavoriteSchema,
  foodLogPayloadEntrySchema,
  QUICK_ENTRY_LABELS,
  CUSTOM_MEAL_ENTRY_TITLE,
  USER_PRODUCT_ENTRY_TITLE,
} from './nutrition/food-log';
import {
  CUSTOM_MEAL_MODES,
  CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS,
  CUSTOM_MEAL_NAME_FORBIDDEN_CLASS,
  CUSTOM_MEAL_REJECT_CODES,
  customMealItemSchema,
  customMealPayloadSchema,
} from './nutrition/custom-meal';
import { EQUIPMENT } from './equipment';
import {
  ACTIVE_ADJUSTMENT_RULES,
  ADJUSTMENT_KINDS,
  ADJUSTMENT_RULES,
  ADJUSTMENT_STATUSES,
  ADJUSTMENT_TRIGGERS,
  RULE_KIND,
} from './adjust/types';
import {
  adjustmentProposalSchema,
  fewerDaysChangeSchema,
  planChangeSchema,
  stateOverrideSchema,
} from './adjust/schemas';
import { COMPETITION_DELOAD_MAX_FACTOR } from './adjust/invariants';
import { FAST_INCREASE_EXCLUSIONS } from './adjust/rules/state-rules';
import type { InvariantFixture } from './adjust/fixtures/invariant-cases';
import { weekInvariantsTestSql } from './adjust/fixtures/invariants-sql';
import { FOOD_GROUPS } from './food-groups';
import { GOAL_COMBINATIONS } from './goals/profile';
import {
  WEIGHT_GOAL_AMOUNT_MODES,
  WEIGHT_GOAL_DAYS,
  WEIGHT_GOAL_TIME_MODES,
  weightGoalSchema,
} from './goals/weight-goal-schema';
import { HEALTH_FLAGS, HEALTH_SCREENING_QUESTIONS } from './health-screening';
import { ONBOARDING_STEPS } from './onboarding';
import {
  cardioLogSchema,
  exerciseLogSchema,
  exerciseStartWeightSchema,
  sessionLogPayloadSchema,
  setLogSchema,
} from './log/schemas';
import { ENDURANCE_EFFORT_LIMITS } from './plan/generate';
import {
  COMPETITION_DISCIPLINES,
  COMPETITION_GOALS,
  COMPETITION_PHASES,
  COMPETITION_STATUSES,
  RUN_COMPETITION_DISCIPLINES,
} from './plan/competition-schema';
import {
  COMPETITION_NAME_TRIM_CLASS,
  COMPETITION_PLAN_BASIS_COLUMNS,
  saveCompetitionPayloadSchema,
} from './plan/competition-record';
import {
  enduranceOverloadThreshold,
  HARD_WORKOUT_TYPES,
  WORKOUT_STEP_LIMITS,
  WORKOUT_TYPES,
  workoutStepSchema,
} from './plan/intensity';
import { ENDURANCE_START_GROUPS } from './plan/safety';
import {
  savePlanExerciseSchema,
  savePlanFixedSlotSchema,
  savePlanFlexSlotSchema,
  savePlanHomeEquipmentSchema,
  savePlanInputsSchema,
  savePlanPayloadSchema,
  savePlanScheduleFixedSchema,
  savePlanScheduleFlexSchema,
  savePlanSessionSchema,
} from './plan/payload';
import { trainingSlotItemSchema } from './training-schedule';
import {
  POLYLINE_PATTERN,
  TRACKED_ROUTE_NAME_TRIM_CLASS,
  TRACKED_ROUTE_OPTIONAL_KEYS,
  trackedRouteSchema,
  updateTrackedRouteSchema,
} from './routes/schema';

const migrationsDir = new URL('../../../supabase/migrations/', import.meta.url);
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

function readMigration(suffix: string): string {
  const file = migrationFiles.find((name) => name.endsWith(suffix));
  if (!file) {
    throw new Error(`Migration *${suffix} nicht gefunden`);
  }
  return readFileSync(new URL(file, migrationsDir), 'utf8');
}

const allSql = migrationFiles
  .map((name) => readFileSync(new URL(name, migrationsDir), 'utf8'))
  .join('\n');

/** Alle '…'-Werte in der Klammer, mit der `marker` endet („(“ oder „[“). */
function quotedListAfter(sql: string, marker: string): string[] {
  const start = sql.indexOf(marker);
  if (start < 0) {
    throw new Error(`„${marker}“ nicht gefunden`);
  }
  const open = start + marker.length - 1;
  const close = sql.indexOf(marker.endsWith('[') ? ']' : ')', open);
  return [...sql.slice(open, close).matchAll(/'([^']+)'/g)].map((match) => match[1] as string);
}

/**
 * Wie `quotedListAfter`, aber die LETZTE Fassung (eine spätere Migration ersetzt eine CHECK-Bedingung, z. B. die
 * Onboarding-Schritte in Etappe N4).
 */
function lastQuotedListAfter(sql: string, marker: string): string[] {
  return quotedListAfter(sql.slice(sql.lastIndexOf(marker)), marker);
}

/** Werte eines Postgres-Enums: `create type … as enum (…)` plus spätere `alter type … add value '…'`. */
function enumValues(name: string): string[] {
  const added = [
    ...allSql.matchAll(
      new RegExp(`alter type public\\.${name} add value (?:if not exists )?'([^']+)'`, 'g'),
    ),
  ].map((match) => match[1] as string);
  return [...quotedListAfter(allSql, `create type public.${name} as enum (`), ...added];
}

describe('Migrationen', () => {
  it('folgen dem Namensschema JJJJMMTTHHMMSS_name.sql', () => {
    for (const name of migrationFiles) {
      expect(name).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });
});

describe('Enums', () => {
  it.each([
    ['sex', enums.SEX_OPTIONS],
    ['experience_level', enums.EXPERIENCE_LEVELS],
    ['app_locale', enums.APP_LOCALES],
    ['consent_type', enums.CONSENT_TYPES],
    ['consent_platform', enums.CONSENT_PLATFORMS],
    ['goal_type', enums.GOAL_TYPES],
    ['endurance_discipline', enums.ENDURANCE_DISCIPLINES],
    ['training_location', enums.TRAINING_LOCATIONS],
    ['training_slot_kind', enums.TRAINING_SLOT_KINDS],
    ['equipment_location', enums.EQUIPMENT_LOCATIONS],
    ['equipment_category', enums.EQUIPMENT_CATEGORIES],
    ['diet_type', enums.DIET_TYPES],
    ['cooking_mode', enums.COOKING_MODES],
    ['food_preference_kind', enums.FOOD_PREFERENCE_KINDS],
    ['content_status', enums.CONTENT_STATUSES],
    ['movement_pattern', enums.MOVEMENT_PATTERNS],
    ['muscle_group', enums.MUSCLE_GROUPS],
    ['exercise_mechanics', enums.EXERCISE_MECHANICS],
    ['load_type', enums.LOAD_TYPES],
    ['caution_tag', enums.CAUTION_TAGS],
    ['alternative_reason', enums.ALTERNATIVE_REASONS],
    ['session_focus', enums.SESSION_FOCUSES],
    ['admin_role', enums.ADMIN_ROLES],
    ['plan_status', enums.PLAN_STATUSES],
    ['planned_session_status', enums.PLANNED_SESSION_STATUSES],
    ['plan_match_quality', enums.PLAN_MATCH_QUALITIES],
    ['plan_note', enums.PLAN_NOTES],
    ['planned_session_kind', enums.PLANNED_SESSION_KINDS],
    ['endurance_modality', enums.ENDURANCE_MODALITIES],
    ['session_log_status', enums.SESSION_LOG_STATUSES],
    ['exercise_log_status', enums.EXERCISE_LOG_STATUSES],
    ['log_source', enums.LOG_SOURCES],
    // Phase 5 · N7 (20261014120100_nutrition_enums.sql)
    ['activity_level', enums.ACTIVITY_LEVELS],
    ['training_time', enums.TRAINING_TIMES],
    ['mealprep_slot_mode', enums.MEALPREP_SLOT_MODES],
    // Phase 10 · WP3 (20261016140000_competition_enums.sql)
    ['competition_discipline', COMPETITION_DISCIPLINES],
    ['competition_goal', COMPETITION_GOALS],
    ['competition_status', COMPETITION_STATUSES],
    ['endurance_start_group', ENDURANCE_START_GROUPS],
    ['workout_type', WORKOUT_TYPES],
    ['training_phase', COMPETITION_PHASES],
    // Phase 10 · S1 (20261016220000_tracked_route_enums.sql)
    ['route_difficulty', enums.ROUTE_DIFFICULTIES],
    ['tracked_route_source', enums.TRACKED_ROUTE_SOURCES],
    // Workout-Bibliothek (20261020150000_workout_enums.sql)
    ['workout_category', WORKOUT_CATEGORIES],
    ['workout_format', WORKOUT_FORMATS],
    // Phase 8 · Wearables (20261021120000_wearable_enums.sql)
    ['wearable_provider', enums.WEARABLE_PROVIDERS],
    ['wearable_connection_status', enums.WEARABLE_CONNECTION_STATUSES],
  ] as const)('public.%s entspricht packages/core', (name, values) => {
    expect(enumValues(name)).toEqual([...values]);
  });

  it('Vorlagen-Matrix (Ziele, Level) entspricht packages/core', () => {
    expect(quotedListAfter(allSql, 'check (goal_type in (')).toEqual([
      ...enums.TEMPLATE_GOAL_TYPES,
    ]);
    expect(quotedListAfter(allSql, 'check (experience_level in (')).toEqual([
      ...enums.TEMPLATE_EXPERIENCE_LEVELS,
    ]);
  });
});

describe('Listen', () => {
  it('Geräte-Katalog (Seeds Phase 1 + 2) entspricht EQUIPMENT', () => {
    // Phase 1: ('id', 'name_de', 'category', has_weights, sort_order) – home_selectable = Standard true.
    // Phase 2: zusätzlich home_selectable; spätere Zeilen überschreiben frühere (on conflict do update).
    const catalog = new Map<string, Record<string, unknown>>();
    const rowPattern =
      /\('([a-z_]+)', '([^']+)', '([a-z_]+)', (true|false), (\d+)(?:, (true|false))?\)/g;
    for (const suffix of ['_seed_equipment.sql', '_equipment_home_selectable.sql']) {
      for (const m of readMigration(suffix).matchAll(rowPattern)) {
        catalog.set(m[1] as string, {
          id: m[1],
          nameDe: m[2],
          category: m[3],
          hasWeights: m[4] === 'true',
          sortOrder: Number(m[5]),
          homeSelectable: m[6] === undefined ? true : m[6] === 'true',
        });
      }
    }
    const bySortOrder = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.sortOrder) - Number(b.sortOrder);
    // weightPresetsKg (Gewichte zum Antippen) sind reine App-Daten, nicht in der Datenbank.
    expect([...catalog.values()].sort(bySortOrder)).toEqual(
      EQUIPMENT.map(({ id, nameDe, category, hasWeights, sortOrder, homeSelectable }) => ({
        id,
        nameDe,
        category,
        hasWeights,
        sortOrder,
        homeSelectable,
      })).sort(bySortOrder),
    );
  });

  it('Spalte home_selectable hat den Standard true', () => {
    expect(readMigration('_equipment_home_selectable.sql')).toContain(
      'add column home_selectable boolean not null default true',
    );
  });

  it('Lebensmittel-Gruppen entsprechen FOOD_GROUPS', () => {
    expect(quotedListAfter(allSql, 'food_group in (')).toEqual(FOOD_GROUPS.map((g) => g.id));
  });

  it('Onboarding-Schritte entsprechen ONBOARDING_STEPS (letzte Fassung der CHECK-Liste, W16)', () => {
    expect(lastQuotedListAfter(allSql, 'onboarding_step in (')).toEqual([...ONBOARDING_STEPS]);
    // Etappe N4 (S8): nutrition_setup kommt mit der kleinen CHECK-Migration – neue Enums erst in N7.
    expect(readMigration('_onboarding_nutrition_setup.sql')).toContain(
      'drop constraint if exists profiles_onboarding_step_check',
    );
  });

  it('Gesundheits-Flags entsprechen HEALTH_FLAGS', () => {
    expect(quotedListAfter(allSql, 'flags <@ array[')).toEqual([...HEALTH_FLAGS]);
  });

  it('Flag-Berechnung im Trigger entspricht HEALTH_SCREENING_QUESTIONS', () => {
    const sql = readMigration('_health_data.sql');
    const variables = {
      medical_clearance_recommended: 'clearance_questions',
      pregnancy: 'pregnancy_questions',
      injury: 'injury_questions',
      medication: 'medication_questions',
    } as const;
    for (const [flag, variable] of Object.entries(variables)) {
      const expected = HEALTH_SCREENING_QUESTIONS.filter((q) => q.flag === flag).map((q) => q.id);
      expect(quotedListAfter(sql, `${variable} constant text[] := array[`), flag).toEqual(expected);
    }
    // Optional ist nur die Schwangerschafts-Frage (bei „männlich“ nicht gestellt).
    expect(quotedListAfter(sql, 'optional_questions constant text[] := array[')).toEqual([
      'pregnancy',
    ]);
  });

  it('Messstellen entsprechen MEASUREMENT_SITES', () => {
    const sql = readMigration('_body_measurements.sql');
    const columns = [...sql.matchAll(/^\s+([a-z_]+_cm) numeric/gm)].map((m) => m[1]);
    expect([...columns].sort()).toEqual(MEASUREMENT_SITES.map((s) => s.column).sort());
  });

  it('CURRENT_CONSENT_VERSIONS = höchste Version im Seed (auch spätere Texte, z. B. ai_food_photo in E3)', () => {
    // Alle Einfügungen in consent_documents über alle Migrationen (Phase 1 + E3).
    const seed = allSql
      .split('insert into public.consent_documents')
      .slice(1)
      .map((part) => part.slice(0, part.indexOf('on conflict')))
      .join('\n');
    const highest: Record<string, number> = {};
    for (const match of seed.matchAll(/\(\s*'([a-z_]+)',\s*(\d+),/g)) {
      const type = match[1] as string;
      highest[type] = Math.max(highest[type] ?? 0, Number(match[2]));
    }
    for (const [type, version] of Object.entries(CURRENT_CONSENT_VERSIONS)) {
      expect(highest[type] ?? null, type).toBe(version);
    }
  });
});

describe('Grenzwerte', () => {
  const between = (column: string, limits: { min: number; max: number }) =>
    `${column} between ${limits.min} and ${limits.max}`;

  it.each([
    between('height_cm', BODY_METRIC_LIMITS.heightCm),
    between('weight_kg', BODY_METRIC_LIMITS.weightKg),
    between('body_fat_pct', BODY_METRIC_LIMITS.bodyFatPct),
    between('resting_heart_rate_bpm', BODY_METRIC_LIMITS.restingHeartRateBpm),
    // Trainingstage (Etappe B2): training_slots
    between('slot_no', TRAINING_LIMITS.sessionsPerWeek),
    between('weekday', { min: 1, max: 7 }),
    between('minutes', TRAINING_LIMITS.minutesPerSession),
    `jsonb_array_length(p_items) not between ${TRAINING_LIMITS.sessionsPerWeek.min} and ${TRAINING_LIMITS.sessionsPerWeek.max}`,
    // Langhantel (Etappe B2): Stange getrennt, Scheiben höchstens 25 kg
    between('bar_kg', BARBELL_BAR_KG),
    `${BARBELL_PLATE_MAX_KG} >= all (weights_kg)`,
    between('meals_per_day', NUTRITION_LIMITS.mealsPerDay),
    between('mealprep_days', NUTRITION_LIMITS.mealPrepDaysPerWeek),
    between('interval_days', MEASUREMENT_REMINDER_INTERVAL_DAYS),
    `default ${MEASUREMENT_REMINDER_INTERVAL_DAYS.default} check (interval_days`,
    `cardinality(weights_kg) <= ${EQUIPMENT_LIMITS.maxWeightSteps}`,
    `${EQUIPMENT_LIMITS.weightStepKg.min} <= all (weights_kg)`,
    `${EQUIPMENT_LIMITS.weightStepKg.max} >= all (weights_kg)`,
    `char_length(note) between 1 and ${EQUIPMENT_LIMITS.noteMaxLength}`,
    `birth_date >= date '${BIRTH_DATE_MIN}'`,
    `min_age_years constant integer := ${MIN_AGE_YEARS}`,
    `max_days_ahead constant integer := ${MEASURED_ON_MAX_DAYS_AHEAD}`,
    // Inhalte (Phase 2): Schema-Grenzen = CONTENT_SCHEMA_LIMITS
    between('version', CONTENT_SCHEMA_LIMITS.version),
    between('difficulty', CONTENT_SCHEMA_LIMITS.difficulty),
    between('priority', CONTENT_SCHEMA_LIMITS.alternativePriority),
    between('sets', CONTENT_SCHEMA_LIMITS.sets),
    between('reps_min', CONTENT_SCHEMA_LIMITS.reps),
    between('reps_max', CONTENT_SCHEMA_LIMITS.reps),
    between('duration_s', CONTENT_SCHEMA_LIMITS.durationS),
    between('rest_s', CONTENT_SCHEMA_LIMITS.restS),
    between('rpe_target', CONTENT_SCHEMA_LIMITS.rpe),
    between('order_no', CONTENT_SCHEMA_LIMITS.orderNo),
    between('minutes_min', TRAINING_LIMITS.minutesPerSession),
    between('minutes_max', TRAINING_LIMITS.minutesPerSession),
    // Nutzerpläne (Phase 3): fachliche Grenzen = TEMPLATE_DOSAGE_LIMITS, PLAN_BLOCK_LIMITS, PLANNED_LOAD_LIMITS
    between('sets', TEMPLATE_DOSAGE_LIMITS.sets),
    between('reps_min', TEMPLATE_DOSAGE_LIMITS.reps),
    between('reps_max', TEMPLATE_DOSAGE_LIMITS.reps),
    between('duration_s', TEMPLATE_DOSAGE_LIMITS.durationS),
    between('rpe_target', TEMPLATE_DOSAGE_LIMITS.rpe),
    `order_no between 1 and ${PLAN_BLOCK_LIMITS.exercisesPerSession}`,
    between('week_no', PLAN_BLOCK_LIMITS.weekNo),
    between('block_no', PLAN_BLOCK_LIMITS.blockNo),
    between('target_weight_kg', PLANNED_LOAD_LIMITS.targetWeightKg),
    `jsonb_array_length(s -> 'exercises') not between 1 and ${PLAN_BLOCK_LIMITS.exercisesPerSession}`,
    // Höchstens 7 Einheiten je Woche × Woche 0–6 (= savePlanPayloadSchema/appendPlanBlockSchema).
    `jsonb_array_length(p_sessions) not between 1 and ${
      PLAN_BLOCK_LIMITS.sessionsPerWeek * (PLAN_BLOCK_LIMITS.weekNo.max + 1)
    }`,
    // Angaben (savePlanInputsSchema, Engine-Version 2) = private.assert_plan_inputs() in *_plan_session_kinds.sql
    `jsonb_array_length(schedule -> 'slots') not between ${TRAINING_LIMITS.sessionsPerWeek.min} and ${TRAINING_LIMITS.sessionsPerWeek.max}`,
    `private.jsonb_number_between(item -> 'minutes', ${TRAINING_LIMITS.minutesPerSession.min}, ${TRAINING_LIMITS.minutesPerSession.max}, 0)`,
    `private.jsonb_number_between(item -> 'weekday', 1, 7, 0)`,
    `private.jsonb_number_between(item -> 'barKg', ${BARBELL_BAR_KG.min}, ${BARBELL_BAR_KG.max}, ${EQUIPMENT_WEIGHT_DECIMALS})`,
    // Ausdauer-Einheiten (planned_sessions)
    between('effort_target', ENDURANCE_EFFORT_LIMITS),
    `estimated_minutes between ${ENDURANCE_SESSION_LIMITS.minSessionMinutes} and ${TRAINING_LIMITS.minutesPerSession.max}`,
    `w::numeric > ${BARBELL_PLATE_MAX_KG}`,
    `jsonb_array_length(item -> 'weightsKg') > ${EQUIPMENT_LIMITS.maxWeightSteps}`,
    `private.jsonb_number_between(w, ${EQUIPMENT_LIMITS.weightStepKg.min}, ${EQUIPMENT_LIMITS.weightStepKg.max}, 2)`,
    `octet_length(inputs::text) <= ${PLAN_SAVE_LIMITS.inputsMaxBytes}`,
    // Datumsrahmen und Aufräumen beim Speichern (PLAN_SAVE_LIMITS)
    `past_tolerance_days constant integer := ${PLAN_SAVE_LIMITS.pastToleranceDays}`,
    `start_date_max_days_ahead constant integer := ${PLAN_SAVE_LIMITS.startDateMaxDaysAhead}`,
    `schedule_max_days_ahead constant integer := ${PLAN_SAVE_LIMITS.scheduleMaxDaysAhead}`,
    `kept_replaced_plans constant integer := ${PLAN_SAVE_LIMITS.keptReplacedPlans}`,
    // Trainingstagebuch (Phase 4 Etappe B): SESSION_LOG_LIMITS, SET_RPE_LIMITS, SESSION_RPE_LIMITS, CARDIO_LOG_LIMITS
    `order_no between ${SESSION_LOG_LIMITS.exercisesPerSession.min} and ${SESSION_LOG_LIMITS.exercisesPerSession.max}`,
    `set_no between ${SESSION_LOG_LIMITS.setsPerExercise.min} and ${SESSION_LOG_LIMITS.setsPerExercise.max}`,
    between('reps', SESSION_LOG_LIMITS.reps),
    between('weight_kg', SESSION_LOG_LIMITS.weightKg),
    between('duration_s', SESSION_LOG_LIMITS.durationS),
    `char_length(notes) <= ${SESSION_LOG_LIMITS.notesMaxChars}`,
    `rpe between ${SET_RPE_LIMITS.min} and ${SET_RPE_LIMITS.max} and rpe * ${1 / SET_RPE_LIMITS.step} = trunc(rpe * ${1 / SET_RPE_LIMITS.step})`,
    between('session_rpe', SESSION_RPE_LIMITS),
    between('duration_s', CARDIO_LOG_LIMITS.durationS),
    between('distance_m', CARDIO_LOG_LIMITS.distanceM),
    between('elevation_m', CARDIO_LOG_LIMITS.elevationM),
    `target_sets between ${SESSION_LOG_LIMITS.setsPerExercise.min} and ${TEMPLATE_DOSAGE_LIMITS.sets.max}`,
    between('target_reps', TEMPLATE_DOSAGE_LIMITS.reps),
    between('state_target_reps', TEMPLATE_DOSAGE_LIMITS.reps),
    between('target_duration_s', TEMPLATE_DOSAGE_LIMITS.durationS),
    between('state_duration_s', TEMPLATE_DOSAGE_LIMITS.durationS),
    between('target_rpe', TEMPLATE_DOSAGE_LIMITS.rpe),
    between('target_weight_kg', PLANNED_LOAD_LIMITS.targetWeightKg),
    between('state_weight_kg', PLANNED_LOAD_LIMITS.targetWeightKg),
    // Eigenes Startgewicht = exerciseStartWeightSchema (PLANNED_LOAD_LIMITS)
    `weight_kg numeric(5, 2) not null check (${between('weight_kg', PLANNED_LOAD_LIMITS.targetWeightKg)})`,
    `backdate_days constant integer := ${SESSION_LOG_LIMITS.backdateDays}`,
    `future_days constant integer := ${SESSION_LOG_LIMITS.futureDays}`,
    `week_tolerance_days constant integer := ${SESSION_LOG_LIMITS.weekToleranceDays}`,
    `max_logs_per_day constant integer := ${SESSION_LOG_LIMITS.maxLogsPerDay}`,
    `exercises_per_session_max constant integer := ${SESSION_LOG_LIMITS.exercisesPerSession.max}`,
    `sets_per_exercise_max constant integer := ${SESSION_LOG_LIMITS.setsPerExercise.max}`,
  ])('SQL enthält „%s“', (expected) => {
    expect(allSql).toContain(expected);
  });

  it.each(
    MEASUREMENT_SITES.map((site) => [site.column, BODY_MEASUREMENT_LIMITS[site.limitKey]] as const),
  )('body_measurements.%s hat dieselben Grenzen', (column, limits) => {
    expect(allSql).toContain(between(column, limits));
  });
});

describe('Eingabe der Plan-Funktionen (save_training_plan / append_plan_block)', () => {
  // Jeweils die NEUESTE Fassung der Funktion (create or replace in einer späteren Migration).
  const rpcSql = readMigration('_training_plan_rpcs.sql');
  const kindsSql = readMigration('_plan_session_kinds.sql');
  // Neueste Fassung von private.insert_plan_sessions (Phase 10 WP3: Felder des Wettkampfplans).
  const sessionsSql = readMigration('_competition_rpcs.sql');
  // Letzte Fassung von private.assert_plan_inputs (Ziele, Etappe Z1: optionales Nebenziel).
  const goalsSql = readMigration('_plan_inputs_secondary_goal.sql');
  const keysOf = (sql: string, name: string) =>
    quotedListAfter(sql, `${name} constant text[] := array[`).sort();

  it.each([
    ['plan_keys', rpcSql, savePlanPayloadSchema],
    ['allowed_keys', goalsSql, savePlanInputsSchema],
    ['equipment_keys', goalsSql, savePlanHomeEquipmentSchema],
    ['session_keys', sessionsSql, savePlanSessionSchema],
    ['exercise_keys', kindsSql, savePlanExerciseSchema],
    // verschachtelt: schedule → mode/slots; slots[] → weekday/kind/minutes bzw. kind/minutes
    ['schedule_keys', goalsSql, savePlanScheduleFixedSchema],
    ['schedule_keys', goalsSql, savePlanScheduleFlexSchema],
    ['fixed_slot_keys', goalsSql, savePlanFixedSlotSchema],
    ['flex_slot_keys', goalsSql, savePlanFlexSlotSchema],
  ] as const)('%s = Felder des strikten Zod-Schemas', (name, sql, schema) => {
    expect(keysOf(sql, name)).toEqual(Object.keys(schema.shape).sort());
  });

  it('required_keys = Pflichtfelder der Angaben (ohne das optionale Nebenziel, Wächter N3)', () => {
    const shape = savePlanInputsSchema.shape;
    const required = Object.keys(shape)
      .filter((key) => !shape[key as keyof typeof shape].safeParse(undefined).success)
      .sort();
    expect(required).not.toContain('secondaryGoalType');
    expect(keysOf(goalsSql, 'required_keys')).toEqual(required);
    expect(keysOf(goalsSql, 'allowed_keys')).toEqual(
      [...keysOf(goalsSql, 'required_keys'), 'secondaryGoalType'].sort(),
    );
  });

  it('private.assert_plan_inputs ist zuletzt in *_plan_inputs_secondary_goal.sql definiert', () => {
    const marker = 'create or replace function private.assert_plan_inputs(';
    const lastFile = migrationFiles.filter((name) => readMigration(name).includes(marker)).at(-1);
    expect(lastFile).toMatch(/_plan_inputs_secondary_goal\.sql$/);
  });

  it('private.goal_pair_allowed = GOAL_COMBINATIONS (Paarliste aus der NEUESTEN Fassung, seit FA1 *_active_aging_rules.sql)', () => {
    const marker = 'create or replace function private.goal_pair_allowed(';
    const lastFile = migrationFiles.filter((name) => readMigration(name).includes(marker)).at(-1);
    expect(lastFile).toMatch(/_active_aging_rules\.sql$/);
    const body = allSql.slice(allSql.lastIndexOf(marker));
    const list = body.slice(body.indexOf(' in ('), body.indexOf('$$;'));
    const pairs = [...list.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map(
      (match) => `${match[1]}>${match[2]}`,
    );
    expect(pairs.sort()).toEqual(
      GOAL_COMBINATIONS.map(([primary, secondary]) => `${primary}>${secondary}`).sort(),
    );
    expect(pairs).toHaveLength(11);
  });

  it('plan_keys der neuesten save_training_plan-Fassung unverändert', () => {
    expect(keysOf(kindsSql, 'plan_keys')).toEqual(Object.keys(savePlanPayloadSchema.shape).sort());
    // Phase-4-Nachtrag H-c (create or replace in *_training_log_rpcs.sql)
    expect(keysOf(readMigration('_training_log_rpcs.sql'), 'plan_keys')).toEqual(
      Object.keys(savePlanPayloadSchema.shape).sort(),
    );
  });
});

describe('Trainingstage (Etappe B2)', () => {
  const sql = readMigration('_training_slots.sql');

  it('replace_training_slots: Feldliste = trainingSlotItemSchema', () => {
    expect(quotedListAfter(sql, 'item_keys constant text[] := array[').sort()).toEqual(
      Object.keys(trainingSlotItemSchema.shape).sort(),
    );
  });

  it('alte Zeitbudget-Spalten in goals werden nach der Übernahme entfernt', () => {
    const insert = sql.indexOf('insert into public.training_slots');
    const drop = sql.indexOf('drop column sessions_per_week');
    expect(insert).toBeGreaterThan(0);
    expect(drop).toBeGreaterThan(insert);
    expect(sql).toContain('drop column minutes_per_session');
    expect(sql).toContain('drop column preferred_days');
  });

  it('Langhantel-Werte über 25 kg werden VOR dem neuen CHECK entfernt', () => {
    const cleanup = sql.indexOf(`where w <= ${BARBELL_PLATE_MAX_KG}`);
    const check = sql.indexOf(`${BARBELL_PLATE_MAX_KG} >= all (weights_kg)`);
    expect(cleanup).toBeGreaterThan(0);
    expect(check).toBeGreaterThan(cleanup);
  });
});

describe('Trainingstagebuch (Phase 4 Etappe B)', () => {
  // Jeweils die NEUESTE Fassung von save_session_log (A1b: *_free_session_logs.sql erweitert um is_free).
  const saveMarker = 'create or replace function public.save_session_log(';
  const saveFile = migrationFiles.filter((name) => readMigration(name).includes(saveMarker)).at(-1);
  if (!saveFile) throw new Error('save_session_log nicht gefunden');
  const fullSql = readMigration(saveFile);
  const sql = fullSql.slice(
    fullSql.lastIndexOf(saveMarker),
    fullSql.indexOf('$$;', fullSql.lastIndexOf(saveMarker)),
  );

  /** Feldliste `name constant jsonb := '{…}'` aus save_session_log: Name → erlaubte JSON-Typen. */
  function fieldsOf(name: string): Record<string, string> {
    const match = new RegExp(`${name} constant jsonb := '([^']*)'`).exec(sql);
    if (!match) {
      throw new Error(`${name} nicht gefunden`);
    }
    return JSON.parse(match[1] as string) as Record<string, string>;
  }

  it.each([
    ['log_fields', sessionLogPayloadSchema],
    ['exercise_fields', exerciseLogSchema],
    ['set_fields', setLogSchema],
    ['cardio_fields', cardioLogSchema],
  ] as const)('save_session_log: %s = Felder des strikten Zod-Schemas', (name, schema) => {
    expect(Object.keys(fieldsOf(name)).sort()).toEqual(Object.keys(schema.shape).sort());
  });

  it.each([
    ['log_fields', sessionLogPayloadSchema],
    ['exercise_fields', exerciseLogSchema],
    ['set_fields', setLogSchema],
    ['cardio_fields', cardioLogSchema],
  ] as const)('save_session_log: %s erlaubt null genau bei nullable-Feldern', (name, schema) => {
    const shape = schema.shape as Record<
      string,
      { safeParse: (value: unknown) => { success: boolean } }
    >;
    for (const [key, types] of Object.entries(fieldsOf(name))) {
      expect(types.split('|').includes('null'), key).toBe(shape[key]?.safeParse(null).success);
      // „missing“ (Feld darf fehlen) genau bei optionalen Feldern (A1b: is_free).
      expect(types.split('|').includes('missing'), key).toBe(
        shape[key]?.safeParse(undefined).success,
      );
    }
  });

  it('neueste save_session_log-Fassung steht in *_live_adjust_outbox.sql (4b B, davor S1, A1b)', () => {
    expect(saveFile).toMatch(/_live_adjust_outbox\.sql$/);
    expect(fieldsOf('log_fields').is_free).toBe('boolean|missing');
  });

  it('freie Einheit: Namen in save_session_log = FREE_SESSION.names', () => {
    const match = /free_names constant jsonb := '([^']*)'/.exec(sql);
    if (!match) throw new Error('free_names nicht gefunden');
    expect(JSON.parse(match[1] as string)).toEqual({
      strength: FREE_SESSION.names.strength,
      ...FREE_SESSION.names.endurance,
    });
    expect(Object.keys(FREE_SESSION.names.endurance).sort()).toEqual(
      [...enums.ENDURANCE_MODALITIES].sort(),
    );
  });

  it('freie Einheit: Server-Fenster = heute bis backdateDays zurück, nie in der Zukunft', () => {
    expect(sql).toContain(
      'if v_performed_on > today or v_performed_on < today - backdate_days then',
    );
  });

  it('recent_exercise_logs (neueste Fassung) überspringt freie Einträge', () => {
    const marker = 'create or replace function public.recent_exercise_logs(';
    const start = allSql.lastIndexOf(marker);
    const body = allSql.slice(start, allSql.indexOf('$$;', start));
    expect(body).toContain('and not sl.is_free');
  });

  it('Record-Variablen nie in derselben Bedingung wie ihr Zuweisungs-Kennzeichen (Wächter N1)', () => {
    // PL/pgSQL wertet `linked and planned.kind …` NICHT verkürzt aus: Ist „planned“ nicht zugewiesen, scheitert der
    // Aufruf je nach Verbindung mit 55000. Zugriffe gehören in ein eigenes `if linked then … end if;`.
    const offending = sql
      .split('\n')
      .filter((line) => /\b(linked|session_found)\b.*\b(planned|session)\.[a-z_]/.test(line));
    expect(offending).toEqual([]);
  });

  it('Server-Felder sind NICHT in der Feldliste (S1, W3)', () => {
    for (const key of ['user_id', 'from_health_plan', 'revision', 'last_write_id']) {
      expect(Object.keys(fieldsOf('log_fields'))).not.toContain(key);
    }
  });

  it('Startgewicht: Felder = exerciseStartWeightSchema', () => {
    const table = readMigration('_training_logs.sql');
    const block = table.slice(table.indexOf('create table public.exercise_start_weights'));
    for (const key of Object.keys(exerciseStartWeightSchema.shape)) {
      expect(block).toContain(`  ${key} `);
    }
  });

  it('completed kommt in einer eigenen Migration VOR der Funktions-Migration', () => {
    const enumsFile = migrationFiles.findIndex((n) => n.endsWith('_training_log_enums.sql'));
    const tablesFile = migrationFiles.findIndex((n) => n.endsWith('_training_logs.sql'));
    const rpcsFile = migrationFiles.findIndex((n) => n.endsWith('_training_log_rpcs.sql'));
    expect(readMigration('_training_log_enums.sql')).toContain(
      "alter type public.planned_session_status add value 'completed'",
    );
    expect(enumsFile).toBeGreaterThanOrEqual(0);
    expect(tablesFile).toBeGreaterThan(enumsFile);
    expect(rpcsFile).toBeGreaterThan(tablesFile);
  });

  it('export_my_data(): Schlüssel von „data“ = DATA_EXPORT_TABLES (Datenexport in der App, Etappe D; N7)', () => {
    // Jeweils die NEUESTE Fassung (Etappe N7 ergänzt die Ernährungs-Tabellen in *_meal_plan_rpcs.sql).
    const marker = 'create or replace function public.export_my_data()';
    const start = allSql.lastIndexOf(marker);
    const end = allSql.indexOf('$$;', start);
    const sql = allSql;
    const body = sql.slice(start, end);
    const keys = [...body.matchAll(/'([a-z_]+)', \(select coalesce/g)].map((m) => m[1]);
    expect(keys).toEqual([...DATA_EXPORT_TABLES]);
  });
});

describe('Ernährung in der Datenbank (Phase 5, Etappe N7)', () => {
  const content = readMigration('_nutrition_content.sql');
  const plans = readMigration('_meal_plans.sql');
  const rpcs = readMigration('_meal_plan_rpcs.sql');
  const seed = readMigration('_seed_nutrition_content.sql');
  /** Rumpf einer Funktion (bis zum Ende ihres $$-Blocks). */
  const fn = (sql: string, name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  const keysOf = (sql: string, name: string) =>
    quotedListAfter(sql, `${name} constant text[] := array[`).sort();
  const options = (schema: { options: readonly string[] }) => [...schema.options];

  it.each([
    ['groups <@ array[', content, FOOD_GROUPS.map((g) => g.id)],
    ['animal <@ array[', content, [...ANIMAL_KINDS]],
    ['meat_kind <@ array[', content, [...MEAT_KINDS]],
    ['gelatin_origin in (', content, [...GELATIN_ORIGINS]],
    ['shopping_category in (', content, [...SHOPPING_CATEGORIES]],
    ['meal_types <@ array[', content, [...MEAL_TYPES]],
    ['categories <@ array[', content, [...RECIPE_CATEGORY_IDS]],
    ['unit in (', content, [...RECIPE_UNITS]],
    ['role in (', content, [...INGREDIENT_ROLES]],
    ['slot in (', plans, [...MEAL_PLAN_SLOT_KEYS]],
    ['role in (', plans, options(mealPlanItemPayloadSchema.shape.role.unwrap())],
    ['prep_kind in (', plans, options(mealPlanItemPayloadSchema.shape.prep_kind)],
    ['storage in (', plans, options(mealPlanItemPayloadSchema.shape.storage.unwrap())],
    ['day_status in (', plans, options(mealPlanItemPayloadSchema.shape.day_status)],
    ['unit in (', plans, options(shoppingListItemPayloadSchema.shape.unit.unwrap())],
    ['category in (', plans, [...SHOPPING_CATEGORIES]],
    ['value in (', plans, [...RECIPE_RATING_VALUES]],
    ['reason in (', plans, [...RECIPE_RATING_REASONS]],
    ['p_animal && array[', seed, [...NOT_VEGETARIAN_ANIMAL_KINDS]],
  ] as const)('CHECK-Liste „%s“ entspricht packages/core', (marker, sql, expected) => {
    expect(quotedListAfter(sql, marker)).toEqual([...expected]);
  });

  it('der Grund „Unverträglich“ ist nie ein gespeicherter Bewertungsgrund (Art. 9)', () => {
    expect(quotedListAfter(plans, 'reason in (')).not.toContain('intolerant');
    expect(plans).toContain("check (reason is null or value = 'down')");
  });

  it('food_dislikes ohne Zeitstempel (Wächter N10 H8)', () => {
    const table = plans.slice(plans.indexOf('create table public.food_dislikes'));
    const body = table.slice(0, table.indexOf(');'));
    expect(body).not.toMatch(/created_at|updated_at|rated_on/);
  });

  it('nutrition_prefs-Spalten des Schritts nutrition_setup = nutritionSetupColumnsSchema', () => {
    const sql = readMigration('_nutrition_prefs_setup.sql');
    for (const key of Object.keys(nutritionSetupColumnsSchema.shape)) {
      expect(sql, key).toContain(`add column ${key} `);
    }
  });

  it.each([
    ['plan_keys', mealPlanPayloadSchema.shape],
    ['input_keys', mealPlanPayloadSchema.shape.inputs.shape],
    ['item_keys', mealPlanItemPayloadSchema.shape],
    ['pair_keys', mealPlanItemPayloadSchema.shape.substitutions.element.shape],
    ['omit_keys', mealPlanItemPayloadSchema.shape.omitted_optional.element.shape],
  ] as const)('save_meal_plan: %s = Felder des strikten Zod-Schemas', (name, shape) => {
    expect(keysOf(fn(rpcs, 'public.save_meal_plan'), name)).toEqual(Object.keys(shape).sort());
  });

  it('save_meal_plan: Tausch-Einträge haben dieselben Felder wie Ersatz-Einträge', () => {
    expect(
      Object.keys(mealPlanItemPayloadSchema.shape.ingredient_swaps.element.shape).sort(),
    ).toEqual(keysOf(fn(rpcs, 'public.save_meal_plan'), 'pair_keys'));
  });

  it.each([
    ['list_keys', shoppingListPayloadSchema.shape],
    ['recipe_keys', shoppingListRecipePayloadSchema.shape],
    ['item_keys', shoppingListItemPayloadSchema.shape],
  ] as const)('replace_shopping_list: %s = Felder des strikten Zod-Schemas', (name, shape) => {
    expect(keysOf(fn(rpcs, 'public.replace_shopping_list'), name)).toEqual(
      Object.keys(shape).sort(),
    );
  });

  it('Größe der Payload früh begrenzt (Wächter N7 H1) = MEAL_PLAN/SHOPPING_LIST_PAYLOAD_MAX_BYTES', () => {
    expect(fn(rpcs, 'public.save_meal_plan')).toContain(
      `payload_max_bytes constant integer := ${MEAL_PLAN_PAYLOAD_MAX_BYTES};`,
    );
    expect(fn(rpcs, 'public.replace_shopping_list')).toContain(
      `payload_max_bytes constant integer := ${SHOPPING_LIST_PAYLOAD_MAX_BYTES};`,
    );
    expect(fn(rpcs, 'public.save_meal_plan')).toContain(
      `changes_max constant integer := ${RECIPE_SCHEMA_LIMITS.ingredients.max};`,
    );
  });

  it('Zutaten-Änderungen je Index (Wächter N7 S3): index in jedem Paar', () => {
    expect(keysOf(fn(rpcs, 'public.save_meal_plan'), 'pair_keys')).toContain('index');
    expect(keysOf(fn(rpcs, 'public.save_meal_plan'), 'omit_keys')).toEqual(['food_id', 'index']);
  });

  it('Einwilligung gesperrt, bevor geprüft wird (Wächter N7 S2)', () => {
    const basis = fn(rpcs, 'private.nutrition_health_basis');
    expect(basis.indexOf('for share')).toBeGreaterThan(0);
    expect(basis.indexOf('for share')).toBeLessThan(basis.indexOf('has_valid_consent'));
    expect(fn(rpcs, 'private.plan_health_basis')).toContain('for share');
    // Nachprüfung N7 S-N1: Folgeblock sperrt die Einwilligung vor dem eigenen Plan (Reihenfolge wie der Widerruf).
    const append = fn(rpcs, 'public.append_plan_block');
    expect(append.indexOf('for share')).toBeGreaterThan(0);
    expect(append.indexOf('for share')).toBeLessThan(append.indexOf('for update'));
  });

  it('Essensplan und Einkaufsliste derselben Woche teilen den Sperr-Schlüssel (Nachprüfung N7)', () => {
    const lock = /pg_advisory_xact_lock\(hashtext\('([a-z_]+)\|'/;
    expect(fn(rpcs, 'public.save_meal_plan').match(lock)?.[1]).toBe('nutrition_week');
    expect(fn(rpcs, 'public.replace_shopping_list').match(lock)?.[1]).toBe('nutrition_week');
  });

  it('Server-Felder sind NICHT in den Payloads (uses_health_data des Plans setzt der Server, K8)', () => {
    const planKeys = keysOf(fn(rpcs, 'public.save_meal_plan'), 'plan_keys');
    for (const key of ['uses_health_data', 'user_id', 'status', 'band', 'safety_key']) {
      expect(planKeys).not.toContain(key);
    }
    const inputKeys = keysOf(fn(rpcs, 'public.save_meal_plan'), 'input_keys');
    for (const key of ['intolerances', 'dislikes', 'eats_pork', 'weight_kg', 'flags']) {
      expect(inputKeys).not.toContain(key);
    }
    expect(keysOf(fn(rpcs, 'public.save_meal_plan'), 'item_keys')).not.toContain('shared');
  });

  const between = (column: string, limits: { min: number; max: number }) =>
    `${column} between ${limits.min} and ${limits.max}`;

  it.each([
    [content, `max_fridge_days between 0 and ${MEAL_PREP_FRIDGE_DAYS.max}`],
    [content, between('servings', RECIPE_SCHEMA_LIMITS.servings)],
    [content, between('amount', RECIPE_SCHEMA_LIMITS.amount)],
    [content, `position between 0 and ${RECIPE_SCHEMA_LIMITS.ingredients.max - 1}`],
    [content, between('factor', INGREDIENT_SUBSTITUTION_LIMITS.factor)],
    [content, between('package_size_g', PACKAGE_SIZE_LIMITS.grams)],
    [plans, between('factor', PORTION_SCALE_LIMITS)],
    [
      plans,
      `jsonb_array_length(ingredient_swaps) <= ${INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal}`,
    ],
    [plans, `jsonb_array_length(added_recipes) <= ${SHOPPING_LIST_EXTRAS.recipesMax}`],
    [plans, `char_length(label_de) <= ${SHOPPING_LIST_ROUNDING.manualLabelMaxChars}`],
    [plans, `max_ratings constant integer := ${RECIPE_RATING_RULES.maxRatings}`],
    [plans, `max_food_dislikes constant integer := ${RECIPE_RATING_RULES.maxFoodDislikes}`],
    [rpcs, `engine_version_max constant integer := ${MEAL_PLAN_ENGINE_VERSION}`],
    [
      rpcs,
      `items_max constant integer := ${7 * (NUTRITION_LIMITS.mealsPerDay.max + EXTRA_SLOTS.length)}`,
    ],
    [
      rpcs,
      `'meals_per_day', ${NUTRITION_LIMITS.mealsPerDay.min}, ${NUTRITION_LIMITS.mealsPerDay.max}, 0)`,
    ],
    [
      rpcs,
      `'mealprep_days', ${NUTRITION_LIMITS.mealPrepDaysPerWeek.min}, ${NUTRITION_LIMITS.mealPrepDaysPerWeek.max}, 0)`,
    ],
    [rpcs, `items_max constant integer := ${SHOPPING_LIST_EXTRAS.itemsMax}`],
    [rpcs, `manual_items_max constant integer := ${SHOPPING_LIST_ROUNDING.manualItemsMax}`],
    [rpcs, `recipes_max constant integer := ${SHOPPING_LIST_EXTRAS.recipesMax}`],
    [rpcs, `'servings', ${RECIPE_SERVINGS_PICKER.min}, ${RECIPE_SERVINGS_PICKER.max}, 0)`],
  ] as const)('SQL enthält „%#“ (Grenze = packages/core)', (sql, expected) => {
    expect(sql).toContain(expected);
  });

  it('Widerruf health_data löscht Essenspläne und Einkaufslisten mit Gesundheitsbezug (neueste Fassung)', () => {
    const marker = 'create or replace function private.consents_after_revoke()';
    const body = allSql.slice(allSql.lastIndexOf(marker));
    const end = body.indexOf('$$;');
    expect(body.slice(0, end)).toContain(
      'delete from public.meal_plans where user_id = new.user_id and uses_health_data;',
    );
    expect(body.slice(0, end)).toContain(
      'delete from public.shopping_lists where user_id = new.user_id and uses_health_data;',
    );
    // Neueste Fassung seit Phase 6 SU3 in *_supplement_user_data.sql (davor Phase 8 Smartwatch, Einkaufen E1, 4b
    // Etappe B, Zusammenführung E4a + Z3; E1: Tagebuch-Einträge, E2: eigene Gerichte, WP3: Plan-Bezug der Wettkämpfe
    // leeren, E4a: eigene Produkte und Produkt-Favoriten, Z3: Wunschgewicht, 4b: Plan-Anpassungen).
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_supplement_user_data\.sql$/,
    );
  });

  it('current_consent_version ist nicht mehr für anon ausführbar (Advisor, N7)', () => {
    expect(readMigration('_consent_version_no_anon.sql')).toContain(
      'revoke execute on function public.current_consent_version(public.consent_type) from anon;',
    );
  });
});

describe('Ernährungstagebuch in der Datenbank (Etappe E1)', () => {
  const tables = readMigration('_food_log.sql');
  const rpcs = readMigration('_food_log_rpcs.sql');
  const entries = tables.slice(0, tables.indexOf('create table public.food_log_favorites'));
  const favorites = tables.slice(tables.indexOf('create table public.food_log_favorites'));
  const fn = (name: string) => {
    const start = rpcs.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return rpcs.slice(start, rpcs.indexOf('$$;', rpcs.indexOf('as $$', start)));
  };
  // Jeweils die NEUESTE Fassung (Etappe E2 erweitert save_food_log_entries und consents_after_revoke).
  const newest = (name: string) => {
    const start = allSql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return allSql.slice(start, allSql.indexOf('$$;', allSql.indexOf('as $$', start)));
  };
  const save = newest('public.save_food_log_entries');
  // CHECK-Bedingungen der Einträge: Herkunft und Form neu gefasst in *_custom_meals.sql (E2) und *_food_log_photo.sql
  // (E3, je nur erweitert) – geprüft wird die NEUESTE Fassung.
  // Seit E4a (*_food_log_product.sql) steht dort die neueste Fassung beider CHECKs (und der Favoriten-Herkunft).
  const productSql = readMigration('_food_log_product.sql');
  const entriesE2 = productSql.slice(
    productSql.indexOf(
      'alter table public.food_log_entries drop constraint food_log_entries_source_check',
    ),
  );
  const favoritesE4 = productSql.slice(
    productSql.indexOf(
      'alter table public.food_log_favorites drop constraint food_log_favorites_source_check',
    ),
  );
  const L = FOOD_LOG_LIMITS;

  it.each([
    ['slot in (', entries, [...FOOD_LOG_SLOTS]],
    ["source in ('plan_item'", entriesE2, [...FOOD_LOG_SOURCES]],
    ['unit in (', entries, [...FOOD_LOG_UNITS]],
    ['title_de in (', entries, [...QUICK_ENTRY_LABELS]],
    ['title_de in (', entriesE2, [...QUICK_ENTRY_LABELS]],
    ["source in ('food'", favoritesE4, [...FOOD_LOG_FAVORITE_SOURCES]],
    ['unit in (', favorites, [...FOOD_LOG_UNITS]],
    ['title_de in (', favorites, [...QUICK_ENTRY_LABELS]],
  ] as const)('CHECK-Liste „%s“ entspricht packages/core', (marker, sql, expected) => {
    // Marker wie „source in ('plan_item'“ enden nicht auf „(“ – dann ab der Klammer davor lesen.
    const at = sql.indexOf(marker);
    const open = sql.lastIndexOf('(', at + marker.length);
    expect(quotedListAfter(sql.slice(open), '(')).toEqual(expected);
  });

  it('save_food_log_entries: Feldliste = foodLogPayloadEntrySchema, null genau bei nullable-Feldern', () => {
    const match = /entry_fields constant jsonb := '([^']*)'/.exec(save);
    if (!match) throw new Error('entry_fields nicht gefunden');
    const fields = JSON.parse(match[1] as string) as Record<string, string>;
    const shape = foodLogPayloadEntrySchema.shape as Record<
      string,
      { safeParse: (value: unknown) => { success: boolean } }
    >;
    expect(Object.keys(fields).sort()).toEqual(Object.keys(shape).sort());
    for (const [key, types] of Object.entries(fields)) {
      expect(types.split('|').includes('null'), key).toBe(shape[key]?.safeParse(null).success);
    }
    for (const key of ['user_id', 'revision', 'last_write_id', 'created_at', 'updated_at']) {
      expect(Object.keys(fields)).not.toContain(key);
    }
  });

  it('Favoriten: Spalten = foodLogFavoriteSchema (+ user_id, created_at)', () => {
    for (const key of Object.keys(foodLogFavoriteSchema.shape)) {
      // E4a: product_code/user_product_id kommen per „add column“ dazu.
      expect(
        favorites.includes(`  ${key} `) ||
          productSql.includes(`alter table public.food_log_favorites add column ${key} `),
        key,
      ).toBe(true);
    }
  });

  it.each([
    [save, `backdate_days constant integer := ${L.backdateDays};`],
    [save, `server_future_days constant integer := ${L.serverFutureDays};`],
    [save, `max_entries_per_day constant integer := ${L.maxEntriesPerDay};`],
    [save, `max_entries_per_save constant integer := ${L.maxEntriesPerSave};`],
    [tables, `max_favorites constant integer := ${L.maxFavorites};`],
    [entries, `kcal integer check (kcal between ${L.kcal.min} and ${L.kcal.max})`],
    [entries, `protein_g between ${L.macroG.min} and ${L.macroG.max}`],
    [entries, `portion between ${L.portion.min} and ${L.portion.max}`],
    [entries, `amount between ${L.amountMass.min} and ${L.amountMass.max}`],
    [entries, `amount between ${L.amountPiece.min} and ${L.amountPiece.max}`],
    [entries, `char_length(title_de) between 1 and ${L.titleMaxChars}`],
    [favorites, `kcal integer check (kcal between ${L.kcal.min} and ${L.kcal.max})`],
    [favorites, `portion between ${L.portion.min} and ${L.portion.max}`],
  ] as const)('SQL enthält „%#“ (Grenze = FOOD_LOG_LIMITS)', (sql, expected) => {
    expect(sql).toContain(expected);
  });

  it('Einwilligung zuerst gesperrt, dann geprüft, dann Person, dann Zeilen (Wächter N7 S2)', () => {
    const share = save.indexOf('for share');
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(save.indexOf("has_valid_consent('health_data')"));
    expect(save.indexOf("has_valid_consent('health_data')")).toBeLessThan(
      save.indexOf('pg_advisory_xact_lock'),
    );
    expect(save.indexOf('pg_advisory_xact_lock')).toBeLessThan(save.indexOf('for update'));
    // Löschen braucht keine Einwilligung (Recht auf Löschung).
    expect(fn('public.delete_food_log_entry')).not.toContain('has_valid_consent');
  });

  it('keine Record-Variablen in den Funktionen (Wächter N1)', () => {
    expect(save).not.toMatch(/\brecord;/);
    expect(fn('public.delete_food_log_entry')).not.toMatch(/\brecord;/);
  });

  it('Antwort je Eintrag (Wächter E1 S2): Ablehnungs-Codes = FOOD_LOG_REJECT_CODES, Konflikt-Gründe', () => {
    const codes = [...save.matchAll(/'code', '([a-z_]+)'|then '([a-z_]+)'|else '([a-z_]+)'/g)]
      .map((m) => m[1] ?? m[2] ?? m[3])
      .sort();
    expect([...new Set(codes)]).toEqual([...FOOD_LOG_REJECT_CODES].sort());
    for (const reason of ['revision', 'deleted', 'plan_item_exists']) {
      expect(save).toContain(`'reason', '${reason}'`);
    }
    expect(save).not.toContain("'result', 'ok'");
  });

  it('Favoriten-Trigger (Nachprüfung S1/H1): eigene Prüfung = CHECKs, Einwilligung FOR SHARE vor der Prüfung', () => {
    const start = tables.indexOf(
      'create or replace function private.food_log_favorites_before_write()',
    );
    const body = tables.slice(start, tables.indexOf('$$;', start));
    expect(quotedListAfter(body, 'new.title_de in (')).toEqual([...QUICK_ENTRY_LABELS]);
    expect(body).toContain(`new.kcal between ${L.kcal.min} and ${L.kcal.max}`);
    expect(body).toContain(`new.portion between ${L.portion.min} and ${L.portion.max}`);
    expect(body).toContain(`new.amount between ${L.amountMass.min} and ${L.amountMass.max}`);
    expect(body).toContain(`new.amount between ${L.amountPiece.min} and ${L.amountPiece.max}`);
    expect(body).toContain(
      "raise exception 'Ungültiger Favorit.' using errcode = 'check_violation';",
    );
    expect(body.indexOf('for share')).toBeGreaterThan(0);
    expect(body.indexOf('for share')).toBeLessThan(
      body.indexOf("has_valid_consent('health_data')"),
    );
  });

  it('Favoriten (Wächter E1 S1): Titel aus dem Katalog per Trigger, Katalog/Rezept ohne Werte', () => {
    expect(tables).toContain('create trigger food_log_favorites_before_write');
    expect(favorites).toContain(
      'and kcal is null and protein_g is null and carbs_g is null and fat_g is null)',
    );
    expect(favorites).toContain("(source <> 'quick' or public.has_valid_consent('health_data'))");
  });

  it('Widerruf: Einträge am Anfang und am Ende gelöscht, Favoriten bleiben (A-G14)', () => {
    const body = newest('private.consents_after_revoke');
    const line = 'delete from public.food_log_entries where user_id = new.user_id;';
    expect(body.split(line)).toHaveLength(3);
    // Wächter E1 G1: nur Schnell-Favoriten (Bezeichnung + kcal) gehen mit; Katalog-/Rezept-Favoriten bleiben. E4a
    // (E4-G10): dazu Produkt-Favoriten – jede Lösch-Anweisung auf den Favoriten ist auf quick/product beschränkt.
    const favDeletes = body.split('delete from public.food_log_favorites').length - 1;
    expect(favDeletes).toBe(
      body.split(
        "delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';",
      ).length -
        1 +
        body.split(
          "delete from public.food_log_favorites where user_id = new.user_id and source = 'product';",
        ).length -
        1,
    );
    expect(body.split('food_log_favorites')).toHaveLength(favDeletes + 1);
    expect(body).toContain(
      "delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';",
    );
    // Die älteren Löschungen bleiben in der neuen Fassung erhalten.
    for (const table of [
      'body_metrics',
      'body_measurements',
      'health_screening',
      'user_plans',
      'meal_plans',
    ]) {
      expect(body).toContain(`delete from public.${table} where user_id = new.user_id`);
    }
  });

  it('export_my_data(): neueste Fassung in *_supplement_user_data.sql (Phase 6 SU3, davor Phase 8, E2 Dashboard, Einkaufen E1, 4b B, E4a + Z3, S1, E3, WP3, E2)', () => {
    const marker = 'create or replace function public.export_my_data()';
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_supplement_user_data\.sql$/,
    );
  });
});

describe('Übersicht und Menüleiste anpassen E2 (docs/PLAN-EINKAUFEN-AUSDAUER.md 4)', () => {
  const sql = readMigration('_app_layout_settings.sql');
  // Neueste Fassung von save_app_layout (seit 20.10.2026 mit „Mein Wettkampf“/„Wettkampf“).
  const saveMarker = 'create or replace function public.save_app_layout(p_layout jsonb)';
  const saveBody = (text: string) => {
    const start = text.lastIndexOf(saveMarker);
    return text.slice(start, text.indexOf('$$;', start));
  };
  const save = saveBody(allSql);
  const list = (name: string) => {
    const match = new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]*)\\]`).exec(save);
    if (!match) throw new Error(name);
    return [...(match[1] as string).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  };
  const constant = (name: string) => {
    const match = new RegExp(`\\b${name} constant integer := (\\d+);`).exec(save);
    if (!match) throw new Error(name);
    return Number(match[1]);
  };

  it('neueste Fassung von save_app_layout in *_app_layout_competition.sql; nur die ID-Listen sind neu', () => {
    expect(migrationFiles.filter((n) => readMigration(n).includes(saveMarker)).at(-1)).toMatch(
      /_app_layout_competition\.sql$/,
    );
    const withoutLists = (body: string) =>
      body.replace(/(tile_ids|area_ids) constant text\[\] := array\[[^\]]*\];/g, '$1');
    expect(withoutLists(save)).toBe(withoutLists(saveBody(sql)));
    expect(DASHBOARD_TILES).toContain('competition');
    expect(NAV_AREAS).toContain('wettkampf');
  });

  it('ID-Listen und Grenzen = packages/core (DASHBOARD_TILES, NAV_AREAS, APP_LAYOUT)', () => {
    expect(list('tile_ids')).toEqual([...DASHBOARD_TILES]);
    expect(list('area_ids')).toEqual([...NAV_AREAS]);
    expect(constant('tabs_min')).toBe(APP_LAYOUT.tabsMin);
    expect(constant('tabs_max')).toBe(APP_LAYOUT.tabsMax);
    expect(constant('tiles_max')).toBe(APP_LAYOUT.storedTilesMax);
    expect(sql).toContain(
      `jsonb_array_length(tab_bar) between ${APP_LAYOUT.tabsMin} and ${APP_LAYOUT.tabsMax}`,
    );
    expect(sql).toContain(`jsonb_array_length(dashboard_tiles) <= ${APP_LAYOUT.storedTilesMax}`);
    expect(save).toContain(`tabs ->> 0 is distinct from '${FIXED_FIRST_TAB}'`);
    expect(save).toContain(`is distinct from '${FIXED_LAST_TAB}'`);
  });

  it('Schreiben nur über save_app_layout; kein Gesundheitsdatum (nicht im Widerruf), im Export', () => {
    expect(sql).toContain(
      'revoke all on table public.app_layout_settings from public, anon, authenticated;',
    );
    expect(sql).not.toContain('SENSIBEL');
    expect(sql).toContain("'app_layout_settings', (select coalesce");
    expect(sql).not.toContain('consents_after_revoke');
  });
});

describe('Einkaufen E1: gelernte Zuordnungen (docs/PLAN-EINKAUFEN-AUSDAUER.md 3)', () => {
  const sql = readMigration('_shopping_product_links.sql');
  const fnBody = (name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    return sql.slice(start, sql.indexOf('$$;', start));
  };

  it('links_max = SHOPPING_SCAN.linksMax; Nummer über private.barcode_ok; Lebensmittel per Fremdschlüssel', () => {
    expect(sql).toContain(`links_max constant integer := ${SHOPPING_SCAN.linksMax};`);
    expect(sql).toContain('code text not null check (private.barcode_ok(code))');
    expect(sql).toContain('references public.foods (id)');
  });

  it('Schreiben nur über Funktionen; Einwilligung zuerst gesperrt, dann geprüft, dann Person (Wächter N7 S2)', () => {
    expect(sql).toContain(
      'revoke all on table public.shopping_product_links from public, anon, authenticated;',
    );
    expect(sql).toContain('grant select on table public.shopping_product_links to authenticated;');
    const save = fnBody('public.save_shopping_product_link');
    expect(save.indexOf('for share')).toBeLessThan(save.indexOf('has_valid_consent'));
    expect(save.indexOf('has_valid_consent')).toBeLessThan(save.indexOf('pg_advisory_xact_lock'));
    expect(fnBody('public.delete_shopping_product_link')).not.toContain('has_valid_consent');
  });

  it('Widerruf löscht am Anfang und am Ende; Export enthält die Tabelle', () => {
    const revoke = fnBody('private.consents_after_revoke');
    expect(
      revoke.split('delete from public.shopping_product_links where user_id = new.user_id;'),
    ).toHaveLength(3);
    expect(fnBody('public.export_my_data')).toContain("'shopping_product_links', (select coalesce");
    expect(readMigration('_app_layout_settings.sql')).toContain(
      "'shopping_product_links', (select coalesce",
    );
  });
});

describe('Eigene Gerichte in der Datenbank (Etappe E2)', () => {
  const tables = readMigration('_custom_meals.sql');
  const rpcs = readMigration('_custom_meal_rpcs.sql');
  const meals = tables.slice(0, tables.indexOf('create table public.custom_meal_items'));
  const items = tables.slice(
    tables.indexOf('create table public.custom_meal_items'),
    tables.indexOf('alter table public.custom_meals enable'),
  );
  const fn = (name: string) => {
    const start = rpcs.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return rpcs.slice(start, rpcs.indexOf('$$;', rpcs.indexOf('as $$', start)));
  };
  const saveMeal = fn('public.save_custom_meal');
  const saveEntries = fn('public.save_food_log_entries');
  const L = CUSTOM_MEAL_LIMITS;
  const F = FOOD_LOG_LIMITS;
  const fields = (sql: string, name: string) => {
    const match = new RegExp(`${name} constant jsonb := '([^']*)'`).exec(sql);
    if (!match) throw new Error(`${name} nicht gefunden`);
    return JSON.parse(match[1] as string) as Record<string, string>;
  };

  it.each([
    ['mode in (', meals, [...CUSTOM_MEAL_MODES]],
    ['unit in (', items, [...FOOD_LOG_UNITS]],
  ] as const)('CHECK-Liste „%s“ entspricht packages/core', (marker, sql, expected) => {
    expect(quotedListAfter(sql, marker)).toEqual(expected);
  });

  it('save_custom_meal: Feldliste = customMealPayloadSchema, Zutaten = customMealItemSchema', () => {
    const meal = fields(saveMeal, 'meal_fields');
    const shape = customMealPayloadSchema.shape as Record<
      string,
      { safeParse: (value: unknown) => { success: boolean } }
    >;
    expect(Object.keys(meal).sort()).toEqual(Object.keys(shape).sort());
    for (const [key, types] of Object.entries(meal)) {
      expect(types.split('|').includes('null'), key).toBe(shape[key]?.safeParse(null).success);
    }
    for (const key of ['user_id', 'revision', 'last_write_id', 'created_at', 'updated_at']) {
      expect(Object.keys(meal)).not.toContain(key);
    }
    expect(Object.keys(fields(saveMeal, 'item_fields')).sort()).toEqual(
      Object.keys(customMealItemSchema.shape).sort(),
    );
  });

  it('save_food_log_entries (E2): custom_meal_id dazu, fehlt es, gilt null (ältere Geräte)', () => {
    expect(fields(saveEntries, 'entry_fields').custom_meal_id).toBe('string|null|missing');
  });

  it.each([
    [saveMeal, `max_meals constant integer := ${L.maxMeals};`],
    [saveMeal, `max_items constant integer := ${L.maxItems};`],
    [saveMeal, `payload_max_bytes constant integer := ${L.maxPayloadBytes};`],
    [meals, `char_length(name_de) between 1 and ${L.nameMaxChars}`],
    [
      meals,
      `servings integer not null check (servings between ${L.servings.min} and ${L.servings.max})`,
    ],
    [meals, `kcal integer check (kcal between ${F.kcal.min} and ${F.kcal.max})`],
    [meals, `protein_g between ${F.macroG.min} and ${F.macroG.max}`],
    [items, `order_no integer not null check (order_no between 1 and ${L.maxItems})`],
    [items, `amount between ${F.amountMass.min} and ${F.amountMass.max}`],
    [items, `amount between ${F.amountPiece.min} and ${F.amountPiece.max}`],
    [tables, `and title_de = '${CUSTOM_MEAL_ENTRY_TITLE}'`],
    [saveEntries, `v_title := '${CUSTOM_MEAL_ENTRY_TITLE}';`],
  ] as const)('SQL enthält „%#“ (Grenze = packages/core)', (sql, expected) => {
    expect(sql).toContain(expected);
  });

  it('Einwilligung zuerst gesperrt, dann geprüft, dann Person, dann Zeilen (Wächter N7 S2)', () => {
    const share = saveMeal.indexOf('for share');
    expect(share).toBeGreaterThan(0);
    expect(share).toBeLessThan(saveMeal.indexOf("has_valid_consent('health_data')"));
    expect(saveMeal.indexOf("has_valid_consent('health_data')")).toBeLessThan(
      saveMeal.indexOf('pg_advisory_xact_lock'),
    );
    expect(saveMeal.indexOf('pg_advisory_xact_lock')).toBeLessThan(saveMeal.indexOf('for update'));
    expect(saveMeal).not.toMatch(/\brecord;/);
  });

  it('Ablehnungs-Codes = CUSTOM_MEAL_REJECT_CODES, Konflikt-Gründe', () => {
    const codes = [...saveMeal.matchAll(/'code', '([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect([...new Set(codes)]).toEqual([...CUSTOM_MEAL_REJECT_CODES].sort());
    for (const reason of ['revision', 'deleted']) {
      expect(saveMeal).toContain(`'reason', '${reason}'`);
    }
  });

  it('Widerruf löscht eigene Gerichte am Anfang und am Ende (sichere Voreinstellung E2)', () => {
    const body = fn('private.consents_after_revoke');
    expect(body.split('delete from public.custom_meals where user_id = new.user_id;')).toHaveLength(
      3,
    );
  });

  it('Name: dieselben verbotenen Zeichen und derselbe Rand-Leerraum wie isValidCustomMealName (Wächter E2 H1)', () => {
    expect(meals).toContain(`name_de !~ '[${CUSTOM_MEAL_NAME_FORBIDDEN_CLASS}]'`);
    expect(meals).toContain(`name_de !~ '^[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]'`);
    expect(meals).toContain(`name_de !~ '[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]$'`);
    expect(meals).not.toContain('[[:');
  });

  it('Löschen nur über delete_custom_meal: kein DELETE-Recht, Person → Einträge → Gericht (Wächter E2 S1)', () => {
    expect(tables).toContain('grant select on table public.custom_meals to authenticated;');
    expect(tables).not.toMatch(/grant [a-z, ]*delete[a-z, ]* on table public\.custom_meal/);
    const del = fn('public.delete_custom_meal');
    expect(del).not.toContain('has_valid_consent');
    expect(del.indexOf('pg_advisory_xact_lock')).toBeGreaterThan(0);
    // Dieselbe Advisory-Sperre wie save_food_log_entries: Speichern und Löschen laufen je Person nacheinander.
    const lock = "pg_advisory_xact_lock(hashtext('food_log|' || current_user_id::text))";
    expect(del).toContain(lock);
    expect(saveEntries).toContain(lock);
    expect(del.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      del.indexOf('from public.food_log_entries'),
    );
    expect(del.indexOf('from public.food_log_entries')).toBeLessThan(
      del.indexOf('from public.custom_meals'),
    );
    expect(rpcs).toContain(
      'revoke all on function public.delete_custom_meal(uuid) from public, anon;',
    );
  });

  it('Server rechnet nach (E1-G4/E2-G2, 15.10.2026): Umrechnungen, Prise, 2.000 g, Rundung wie packages/core', () => {
    const grams = fn('private.grams_per_unit');
    for (const unit of RECIPE_UNITS) expect(grams).toContain(`when '${unit}' then`);
    for (const key of ['ml_to_g', 'piece_g', 'tbsp_g', 'tsp_g'])
      expect(grams).toContain(`'${key}'`);
    expect(grams).toContain(`when 'pinch' then ${PINCH_G}::double precision`);
    expect(fn('private.ingredients_per_serving')).toContain(
      `grams_max constant double precision := ${FOOD_LOG_LIMITS.gramsMax};`,
    );
    expect(fn('private.food_log_server_values')).toContain(
      `grams_max constant double precision := ${FOOD_LOG_LIMITS.gramsMax};`,
    );
    // Math.round (halbe aufwärts), nicht round() (Postgres rundet double precision halbe zur geraden Zahl).
    expect(fn('private.js_round')).toContain('when p_x - floor(p_x) >= 0.5 then floor(p_x) + 1');
    expect(fn('private.js_round1')).toContain('private.js_round(p_x * 10) / 10');
    // Rechnung in derselben Reihenfolge wie computeRecipeFacts bzw. entryFromFood.
    expect(fn('private.ingredients_per_serving')).toContain(
      "t_kcal := t_kcal + (grams * (food_data -> 'nutrients_per_100g' ->> 'kcal')::double precision) / 100;",
    );
    expect(fn('private.food_log_server_values')).toContain('factor := grams / 100;');
    // Die Werte vom Gerät werden für Lebensmittel, Rezept und eigenes Gericht ersetzt.
    expect(saveEntries).toContain("if v_source in ('food', 'recipe', 'custom_meal') then");
    expect(saveEntries).toContain('e := e || v_values;');
    expect(saveMeal).toContain('per := private.ingredients_per_serving(v_items,');
  });

  it('Lebensmittel in Zutaten: on delete restrict; Tagebuch-Verweis: on delete set null (nur die Spalte)', () => {
    expect(items).toContain('references public.foods (id) on update cascade on delete restrict');
    expect(tables).toContain('on delete set null (custom_meal_id)');
  });
});

describe('Wettkampf in der Datenbank (Phase 10 WP3)', () => {
  const tables = readMigration('_competitions.sql');
  const rpcs = readMigration('_competition_rpcs.sql');
  /** Rumpf einer Funktion (bis zum Ende ihres $$-Blocks). */
  const fn = (sql: string, name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  const constant = (name: string, value: number) => `${name} constant integer := ${value};`;
  const save = fn(rpcs, 'public.save_competition');
  const insertSessions = fn(rpcs, 'private.insert_plan_sessions');
  const steps = fn(tables, 'private.workout_steps_valid');
  const R = COMPETITION_START_REFERENCE;

  it('competition_keys = Felder von saveCompetitionPayloadSchema (alle Pflicht; WP5 ergänzt distance_km)', () => {
    expect(quotedListAfter(save, 'competition_keys constant text[] := array[').sort()).toEqual(
      Object.keys(saveCompetitionPayloadSchema.shape)
        .filter((k) => k !== 'distance_km')
        .sort(),
    );
    expect(save).toContain('if not (c ?& competition_keys)');
  });

  // WP3 kannte nur die Lauf-Distanzen; Rad und Triathlon prüft der Block „WP5“ gegen die neue Migration.
  it('Distanz je Disziplin = COMPETITION_DISTANCE_M', () => {
    const body = fn(tables, 'private.competition_distance_m');
    for (const d of RUN_COMPETITION_DISCIPLINES) {
      expect(body).toContain(`when '${d}' then ${COMPETITION_DISTANCE_M[d]}`);
    }
    expect(tables).toContain('check (distance_m = private.competition_distance_m(discipline))');
  });

  it('Ziel-/Referenzzeit plausibel je Distanz = COMPETITION_INPUT_LIMITS.timeS', () => {
    const body = fn(tables, 'private.competition_time_plausible');
    for (const d of RUN_COMPETITION_DISCIPLINES) {
      const { min, max } = COMPETITION_INPUT_LIMITS.timeS[d];
      expect(body).toContain(`when '${d}' then p_time_s between ${min} and ${max}`);
    }
  });

  it.each([
    `char_length(name) between 1 and ${COMPETITION_INPUT_LIMITS.nameMaxLength}`,
    `own_start_weekly_minutes between ${COMPETITION_OWN_START.minWeeklyMinutes} and ${TRAINING_LIMITS.minutesPerSession.max * 7}`,
    `start_reference_volume = 0 or start_reference_volume between ${R.minMinutes} and ${R.maxWeeklyMinutes}`,
    `start_reference_session_cap between ${R.minMinutes} and ${R.maxSessionMinutes}`,
    'start_reference_session_cap <= start_reference_volume',
    'long_run_weekday between 1 and 7',
    "(goal_kind <> 'time' or reference_time_s is not null)",
    "(effective_goal is distinct from 'time' or goal_kind = 'time')",
    'uses_health_data = (effective_goal is not null)',
    `target_distance_m between ${COMPETITION_PACE.distanceM.min} and ${COMPETITION_PACE.distanceM.max}`,
    `effort_target between ${COMPETITION_EFFORT_LIMITS.min} and ${COMPETITION_EFFORT_LIMITS.max}`,
    `(effort_target is null or effort_target <= ${ENDURANCE_EFFORT_LIMITS.max})`,
    `(effort_target <= ${COMPETITION_EFFORT_LIMITS.easyMax} or workout_type in (`,
    "or training_phase = 'taper')",
    "create unique index competitions_one_planned_idx on public.competitions (user_id) where status = 'planned';",
    'on delete set null (result_session_log_id)',
  ])('Tabellen-SQL enthält „%s“', (expected) => {
    expect(tables).toContain(expected);
  });

  it('harte Arten im CHECK und in insert_plan_sessions = HARD_WORKOUT_TYPES', () => {
    const check = tables.slice(tables.indexOf('add constraint planned_sessions_workout_fields'));
    expect(quotedListAfter(check, 'workout_type in (')).toEqual([...HARD_WORKOUT_TYPES]);
    expect(lastQuotedListAfter(check, 'workout_type not in (')).toEqual([...HARD_WORKOUT_TYPES]);
    expect(
      quotedListAfter(insertSessions, 'hard_types constant public.workout_type[] := array['),
    ).toEqual([...HARD_WORKOUT_TYPES]);
  });

  it('CHECK effort_target: letzte Fassung 1–8 (Phase 3: 1–4 wurde gelockert, nicht umgeschrieben)', () => {
    const marker = /effort_target between (\d+) and (\d+)/g;
    const all = [...allSql.matchAll(marker)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(all.at(0)).toEqual([ENDURANCE_EFFORT_LIMITS.min, ENDURANCE_EFFORT_LIMITS.max]);
    expect(all.at(-1)).toEqual([COMPETITION_EFFORT_LIMITS.min, COMPETITION_EFFORT_LIMITS.max]);
    expect(tables).toContain('drop constraint planned_sessions_effort_target_check');
  });

  it('Schritte (private.workout_steps_valid) = workoutStepSchema / WORKOUT_STEP_LIMITS', () => {
    const shape = workoutStepSchema.shape;
    expect(steps).toContain(
      `jsonb_array_length(p_steps) not between 1 and ${WORKOUT_STEP_LIMITS.maxSteps}`,
    );
    expect(steps).toContain(
      `octet_length(p_steps::text) > ${COMPETITION_RECORD_LIMITS.workoutStepsMaxBytes}`,
    );
    expect(steps).toContain(
      `(select count(*) from jsonb_object_keys(step)) <> ${Object.keys(shape).length}`,
    );
    expect(quotedListAfter(steps, 'step ?& array[').sort()).toEqual(Object.keys(shape).sort());
    expect(quotedListAfter(steps, "(step ->> 'part') not in (")).toEqual([...shape.part.options]);
    expect(quotedListAfter(steps, "(step ->> 'kind') not in (")).toEqual([...shape.kind.options]);
    const { min, max } = WORKOUT_STEP_LIMITS.seconds;
    expect(steps).toContain(`(step -> 'seconds')::numeric not between ${min} and ${max}`);
    expect(steps).toContain(
      `(step -> 'effort')::numeric not between ${shape.effort.minValue} and ${shape.effort.maxValue}`,
    );
    expect(steps).toContain('return total = p_minutes::bigint * 60;');
  });

  it('Regeln je Person in insert_plan_sessions = COMPETITION_INTENSITY / AGE_PLAN_RULES', () => {
    const I = COMPETITION_INTENSITY;
    for (const expected of [
      constant('hard_effort_cap_general', I.hardEffortCap.general),
      constant('hard_effort_cap_minor', I.hardEffortCap.minor),
      constant('hard_effort_cap_senior', I.hardEffortCap.senior),
      constant('hard_effort_min', I.hardEffortMin),
      constant('hard_sessions_per_week_strict', I.hardSessionsPerWeek.strict),
      constant('hard_sessions_per_week_general', I.hardSessionsPerWeek.general),
      constant('minor_below_age', AGE_PLAN_RULES.minor.belowAge),
      constant('senior_from_age', AGE_PLAN_RULES.senior.fromAge),
    ]) {
      expect(insertSessions).toContain(expected);
    }
    expect(I.hardEffortCap.general).toBe(COMPETITION_EFFORT_LIMITS.max);
    expect(insertSessions).toContain("group by date_trunc('week', ps.scheduled_on)");
  });

  it('save_competition: Datumsrahmen und Mindestvorlauf (lockerste Spalte) = COMPETITION_LEAD_WEEKS', () => {
    const column = COMPETITION_RECORD_LIMITS.leadWeeksServerColumn;
    const lead = RUN_COMPETITION_DISCIPLINES.map(
      (d) => `when '${d}' then ${COMPETITION_LEAD_WEEKS.minimum[d][column]}`,
    ).join(' ');
    expect(save).toContain(`min_lead_weeks := case v_discipline ${lead} end;`);
    // Lockerste Spalte = kleinster Wert je Distanz (der Server ist nur Untergrenze).
    for (const d of RUN_COMPETITION_DISCIPLINES) {
      expect(COMPETITION_LEAD_WEEKS.minimum[d][column]).toBe(
        Math.min(...Object.values(COMPETITION_LEAD_WEEKS.minimum[d])),
      );
    }
    expect(save).toContain(constant('max_lead_days', COMPETITION_LEAD_WEEKS.maxLeadWeeks * 7));
    expect(save).toContain(
      constant('reference_max_age_days', COMPETITION_INPUT_LIMITS.referenceMaxAgeDays),
    );
    expect(save).toContain(constant('minor_below_age', AGE_PLAN_RULES.minor.belowAge));
    expect(save).toContain(constant('senior_from_age', AGE_PLAN_RULES.senior.fromAge));
  });

  it('Widerruf leert genau den Plan-Bezug (COMPETITION_PLAN_BASIS_COLUMNS), zweimal', () => {
    const body = fn(rpcs, 'private.consents_after_revoke');
    const updates = body.split('update public.competitions').slice(1);
    expect(updates).toHaveLength(2);
    for (const update of updates) {
      const set = update.slice(0, update.indexOf(';'));
      const cleared = [...set.matchAll(/([a-z_]+) = null/g)].map((m) => m[1]).sort();
      expect(cleared).toEqual([...COMPETITION_PLAN_BASIS_COLUMNS].sort());
      expect(set).toContain('uses_health_data = false');
    }
  });

  it('Wächter WP3 H1: Schritte passen zur Art, „hart“ über die Schritte = ENDURANCE_EFFORT / COMPETITION_WORKOUTS', () => {
    const fit = fn(tables, 'private.workout_steps_fit_type');
    const hard = fn(tables, 'private.workout_is_hard');
    const S = COMPETITION_WORKOUTS.strides;
    expect(quotedListAfter(fit, 'if p_type in (')).toEqual([...HARD_WORKOUT_TYPES]);
    expect(quotedListAfter(hard, 'if p_type in (')).toEqual([...HARD_WORKOUT_TYPES]);
    expect(fit).toContain(`where (st ->> 'effort')::numeric > ${ENDURANCE_EFFORT.easyMax}\n`);
    expect(fit).toContain(`(st ->> 'seconds')::numeric > ${S.workS})`);
    expect(fit).toContain(
      `(st ->> 'effort')::numeric > ${ENDURANCE_EFFORT.easyMax}) <= ${S.count};`,
    );
    expect(hard).toContain(
      `(st ->> 'effort')::numeric >= ${COMPETITION_INTENSITY.hardEffortMin} and (st ->> 'seconds')::numeric > ${S.workS}`,
    );
    expect(tables).toContain('and private.workout_steps_fit_type(workout_type, workout_steps)');
    expect(tables).toContain(
      "and (not is_deload or training_phase = 'taper' or not private.workout_is_hard(workout_type, workout_steps)))",
    );
    expect(insertSessions).toContain(
      'and private.workout_is_hard(ps.workout_type, ps.workout_steps)',
    );
  });

  it('Wächter WP3 M1/M2: Level aus Profil, Wettkampf mit Plan-Bezug, Distanz-Deckel = COMPETITION_LONG_RUN', () => {
    expect(insertSessions).toContain("when profile_level = 'beginner'");
    expect(insertSessions).toContain(
      "where c.user_id = p_user_id and c.status = 'planned'\n    for share;",
    );
    const caps = RUN_COMPETITION_DISCIPLINES.map(
      (d) => `when '${d}' then ${COMPETITION_LONG_RUN.maxMinutes[d]}`,
    ).join(' ');
    expect(insertSessions).toContain(`case competition_row.discipline\n          ${caps} end`);
    expect(insertSessions).toContain("competition_row.discipline = 'marathon'");
  });

  it('Wächter WP3 N4: Leerraum am Rand des Namens = genau die Zeichen von String.prototype.trim()', () => {
    expect(tables).toContain(`and name !~ '^[${COMPETITION_NAME_TRIM_CLASS}]'`);
    expect(tables).toContain(`and name !~ '[${COMPETITION_NAME_TRIM_CLASS}]$'`);
    const re = new RegExp(`^[${COMPETITION_NAME_TRIM_CLASS}]$`, 'u');
    for (let code = 0; code <= 0xffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const c = String.fromCharCode(code);
      expect(re.test(c), `U+${code.toString(16)}`).toBe(c.trim() === '');
    }
  });

  it('save_competition mit Plan-Bezug sperrt die Einwilligung vor der Wettkampf-Zeile (Wächter N7 S2)', () => {
    expect(save.indexOf('private.plan_health_basis()')).toBeGreaterThan(0);
    expect(save.indexOf('private.plan_health_basis()')).toBeLessThan(save.indexOf('for update'));
  });

  it('4b endurance_reduce (Risiko 7): neue Fassung hält Abstand zu JEDEM Ziel bis zur CHECK-Grenze', () => {
    // Seit WP3 erlaubt der CHECK Ziele bis 8 (vorher 1–4, feste Schwelle 7 – PLAN-PHASE-4B R3, Wächter S6). Die neue
    // Fassung (enduranceOverloadThreshold) muss für jedes erlaubte Ziel ÜBER dem Ziel liegen und für lockere Ziele
    // unverändert 7 bleiben. Steigt der CHECK erneut, schlägt dieser Test fehl → 4b-Regel neu prüfen.
    const marker = /effort_target between (\d+) and (\d+)/g;
    const last = [...allSql.matchAll(marker)].at(-1);
    const max = Number(last?.[2]);
    expect(max).toBe(8);
    for (let target = COMPETITION_EFFORT_LIMITS.min; target <= max; target += 1) {
      const threshold = enduranceOverloadThreshold(target);
      expect(threshold, `Ziel ${target}`).toBeGreaterThan(target);
      expect(threshold, `Ziel ${target}`).toBeLessThanOrEqual(10);
      if (target <= ENDURANCE_OVERLOAD_RULE.easyTargetMax) {
        expect(threshold).toBe(ENDURANCE_OVERLOAD_RULE.minEffort);
      }
    }
  });
});

describe('Rad und Triathlon in der Datenbank (Phase 10 WP5)', () => {
  const wp5 = readMigration('_wp5_rad_triathlon.sql');
  const fn = (sql: string, name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  const save = fn(wp5, 'public.save_competition');
  const insertSessions = fn(wp5, 'private.insert_plan_sessions');
  const C = COMPETITION_CYCLING;
  const column = COMPETITION_RECORD_LIMITS.leadWeeksServerColumn;

  it('neueste Fassung von save_competition und insert_plan_sessions steht in *_wp5_rad_triathlon.sql', () => {
    for (const name of ['public.save_competition', 'private.insert_plan_sessions']) {
      const marker = `create or replace function ${name}(`;
      expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
        /_wp5_rad_triathlon\.sql$/,
      );
    }
  });

  it('competition_keys = alle Felder (distance_km optional), required_keys = Pflichtfelder', () => {
    const keys = Object.keys(saveCompetitionPayloadSchema.shape).sort();
    expect(quotedListAfter(save, 'competition_keys constant text[] := array[').sort()).toEqual(
      keys,
    );
    expect(quotedListAfter(save, 'required_keys constant text[] := array[').sort()).toEqual(
      keys.filter((k) => k !== 'distance_km'),
    );
    expect(save).toContain('if not (c ?& required_keys)');
    expect(save).toContain(
      `private.jsonb_number_between(c -> 'distance_km', ${C.distanceKm.min}, ${C.distanceKm.max}, 0)`,
    );
  });

  it('Distanz: Triathlon aus der Disziplin (COMPETITION_DISTANCE_M), Rad 20–300 km in ganzen km', () => {
    const body = fn(wp5, 'private.competition_distance_m');
    for (const d of COMPETITION_DISCIPLINES) {
      if (d === 'cycling') {
        expect(body).not.toContain(`when '${d}'`);
        continue;
      }
      expect(body).toContain(`when '${d}' then ${COMPETITION_DISTANCE_M[d]}`);
    }
    expect(wp5).toContain(
      `then distance_m between ${C.distanceKm.min * 1000} and ${C.distanceKm.max * 1000} and distance_m = trunc(distance_m / 1000) * 1000`,
    );
  });

  it('Server-Mindestvorlauf (lockerste Spalte) = COMPETITION_LEAD_WEEKS bzw. COMPETITION_CYCLING.classes', () => {
    const body = fn(wp5, 'private.competition_server_lead_weeks');
    for (const d of COMPETITION_DISCIPLINES) {
      if (d === 'cycling') continue;
      expect(body).toContain(`when '${d}' then ${COMPETITION_LEAD_WEEKS.minimum[d][column]}`);
      expect(COMPETITION_LEAD_WEEKS.minimum[d][column]).toBe(
        Math.min(...Object.values(COMPETITION_LEAD_WEEKS.minimum[d])),
      );
    }
    const classes = C.classes.map((c, i) =>
      i === C.classes.length - 1
        ? `else ${c.lead[column]} end`
        : `when p_distance_m <= ${c.maxKm * 1000} then ${c.lead[column]}`,
    );
    expect(body).toContain(classes.join(' '));
    expect(C.classes.at(-1)?.maxKm).toBe(C.distanceKm.max);
    for (const c of C.classes) expect(c.lead[column]).toBe(Math.min(...Object.values(c.lead)));
    expect(save).toContain(
      'min_lead_weeks := private.competition_server_lead_weeks(v_discipline, v_distance_m);',
    );
  });

  it('unter 18 = COMPETITION_GROUP_RULES (Laufen bis Halbmarathon, Triathlon nur Sprint, Rad bis 100 km)', () => {
    const body = fn(wp5, 'private.competition_minor_allowed');
    const G = COMPETITION_GROUP_RULES;
    const runs = RUN_COMPETITION_DISCIPLINES.slice(
      0,
      RUN_COMPETITION_DISCIPLINES.indexOf(G.minorMaxDiscipline) + 1,
    );
    expect(quotedListAfter(body, 'when p_discipline in (')).toEqual([...runs]);
    expect(lastQuotedListAfter(body, 'when p_discipline in (')).toEqual([...G.minorTriathlon]);
    expect(body).toContain(`then p_distance_m <= ${G.minorMaxCyclingKm * 1000}`);
    for (const sql of [save, insertSessions]) {
      expect(sql).toContain('private.competition_minor_allowed(');
      expect(sql).not.toContain("= 'marathon' then");
    }
  });

  it('Distanz-Deckel je Disziplin = COMPETITION_LONG_RUN.maxMinutes (alle Disziplinen)', () => {
    const caps = COMPETITION_DISCIPLINES.map(
      (d) => `when '${d}' then ${COMPETITION_LONG_RUN.maxMinutes[d]}`,
    ).join(' ');
    expect(insertSessions).toContain(`case competition_row.discipline\n          ${caps} end`);
  });

  it('Rad/Triathlon nur „Ankommen“ ohne Referenz; Referenz nur Laufen; Koppeltraining Rad, Technik Schwimmen', () => {
    const multisport = wp5.slice(wp5.indexOf('add constraint competitions_multisport'));
    expect(quotedListAfter(multisport, '(discipline in (')).toEqual([
      ...RUN_COMPETITION_DISCIPLINES,
    ]);
    expect(quotedListAfter(multisport, 'reference_discipline in (')).toEqual([
      ...RUN_COMPETITION_DISCIPLINES,
    ]);
    expect(wp5).toContain("(workout_type is distinct from 'brick' or endurance_modality = 'bike')");
    expect(wp5).toContain(
      "(workout_type is distinct from 'technique' or endurance_modality = 'swim')",
    );
    // Beide Arten sind locker: nicht in den harten Arten (CHECK und Schritt-Prüfung behandeln sie wie „easy“).
    expect(HARD_WORKOUT_TYPES as readonly string[]).not.toContain('brick');
    expect(HARD_WORKOUT_TYPES as readonly string[]).not.toContain('technique');
  });
});

describe('Essensplan in der Datenbank – N7 Teil 2 (Löschfrist G-N7-2, Tageskalorien G-W3)', () => {
  const teil2 = readMigration('_n7_teil2_retention_kcal_check.sql');
  const fnBody = (name: string) => {
    const marker = `create or replace function ${name}(`;
    const start = allSql.lastIndexOf(marker);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return allSql.slice(start, allSql.indexOf('$$;', allSql.indexOf('as $$', start)));
  };
  const keysOf = (body: string, name: string) =>
    quotedListAfter(body, `${name} constant text[] := array[`).sort();
  const constant = (body: string, name: string) => {
    const match = new RegExp(`${name} constant (?:numeric|integer) := (-?[0-9.]+);`).exec(body);
    if (!match) throw new Error(`${name} nicht gefunden`);
    return Number(match[1]);
  };

  it('neueste Fassung von save_meal_plan/replace_shopping_list steht in *_n7_teil2_retention_kcal_check.sql', () => {
    for (const name of ['public.save_meal_plan', 'public.replace_shopping_list']) {
      const marker = `create or replace function ${name}(`;
      expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
        /_n7_teil2_retention_kcal_check\.sql$/,
      );
    }
    expect(teil2).toContain('create or replace function public.save_meal_plan(');
  });

  it.each([
    ['plan_keys', mealPlanPayloadSchema.shape],
    ['input_keys', mealPlanPayloadSchema.shape.inputs.shape],
    ['item_keys', mealPlanItemPayloadSchema.shape],
    ['pair_keys', mealPlanItemPayloadSchema.shape.substitutions.element.shape],
    ['omit_keys', mealPlanItemPayloadSchema.shape.omitted_optional.element.shape],
  ] as const)('neueste save_meal_plan: %s = Felder des strikten Zod-Schemas', (name, shape) => {
    expect(keysOf(fnBody('public.save_meal_plan'), name)).toEqual(Object.keys(shape).sort());
  });

  it.each([
    ['list_keys', shoppingListPayloadSchema.shape],
    ['recipe_keys', shoppingListRecipePayloadSchema.shape],
    ['item_keys', shoppingListItemPayloadSchema.shape],
  ] as const)(
    'neueste replace_shopping_list: %s = Felder des strikten Zod-Schemas',
    (name, shape) => {
      expect(keysOf(fnBody('public.replace_shopping_list'), name)).toEqual(
        Object.keys(shape).sort(),
      );
    },
  );

  it('neueste Fassungen: Größe, Sperren (Woche → Einwilligung → Plan) und Rechte wie N7 Teil 1', () => {
    const save = fnBody('public.save_meal_plan');
    const list = fnBody('public.replace_shopping_list');
    expect(save).toContain(`payload_max_bytes constant integer := ${MEAL_PLAN_PAYLOAD_MAX_BYTES};`);
    expect(list).toContain(
      `payload_max_bytes constant integer := ${SHOPPING_LIST_PAYLOAD_MAX_BYTES};`,
    );
    expect(save).toContain(`engine_version_max constant integer := ${MEAL_PLAN_ENGINE_VERSION}`);
    for (const body of [save, list]) {
      const lock = body.indexOf("pg_advisory_xact_lock(hashtext('nutrition_week|'");
      const basis = body.indexOf('private.nutrition_health_basis()');
      expect(lock).toBeGreaterThan(0);
      expect(basis).toBeGreaterThan(lock);
    }
    expect(teil2).toContain(
      'revoke all on function public.save_meal_plan(jsonb, boolean, boolean) from public, anon;',
    );
    expect(teil2).toContain(
      'grant execute on function public.save_meal_plan(jsonb, boolean, boolean) to authenticated;',
    );
    expect(teil2).toContain(
      'revoke all on function public.replace_shopping_list(jsonb) from public, anon;',
    );
    expect(teil2).toContain(
      'grant execute on function public.replace_shopping_list(jsonb) to authenticated;',
    );
  });

  it('Löschfrist: retention_weeks = MEAL_PLAN_RETENTION_WEEKS; Speichern löscht danach (für die Person)', () => {
    const purge = fnBody('private.purge_expired_nutrition_weeks');
    expect(constant(purge, 'retention_weeks')).toBe(MEAL_PLAN_RETENTION_WEEKS);
    expect(purge).toContain(
      "date_trunc('week', private.berlin_today())::date - 7 * retention_weeks",
    );
    for (const name of ['public.save_meal_plan', 'public.replace_shopping_list']) {
      const body = fnBody(name);
      const call = body.indexOf('perform private.purge_expired_nutrition_weeks(current_user_id);');
      expect(call, name).toBeGreaterThan(0);
      // Erst nach dem Speichern (danach steht nur noch das Ergebnis).
      expect(body.indexOf('insert into public.', call), name).toBe(-1);
    }
    expect(teil2).toContain("'select private.purge_expired_nutrition_weeks()'");
  });

  it('G-W3: Konstanten und Formel des Grundumsatzes = packages/core (Mifflin „Grenzen“, Katch, 90 Tage)', () => {
    const floor = fnBody('private.meal_plan_day_kcal_floor');
    expect(constant(floor, 'kg_factor')).toBe(MIFFLIN_ST_JEOR.kgFactor);
    expect(constant(floor, 'cm_factor')).toBe(MIFFLIN_ST_JEOR.cmFactor);
    expect(constant(floor, 'age_factor')).toBe(MIFFLIN_ST_JEOR.ageFactor);
    expect(constant(floor, 'offset_male')).toBe(MIFFLIN_ST_JEOR.sexOffset.male);
    expect(constant(floor, 'offset_female')).toBe(MIFFLIN_ST_JEOR.sexOffset.female);
    expect(constant(floor, 'offset_unknown')).toBe(MIFFLIN_ST_JEOR.limitsSexOffsetUnknown);
    expect(constant(floor, 'katch_intercept')).toBe(KATCH_MCARDLE.intercept);
    expect(constant(floor, 'katch_ffm_factor')).toBe(KATCH_MCARDLE.ffmFactor);
    expect(constant(floor, 'body_fat_max_age_days')).toBe(BODY_FAT_MAX_AGE_DAYS);
    expect(constant(floor, 'min_intake_relative_to_bmr')).toBe(MIN_INTAKE_RELATIVE_TO_BMR);
    expect(floor).toContain('kg_factor * v_weight + cm_factor * v_height - age_factor * v_age');
    expect(floor).toContain(
      "case v_sex when 'male' then offset_male when 'female' then offset_female else offset_unknown end",
    );
    expect(floor).toContain('katch_intercept + katch_ffm_factor * (v_weight * (1 - v_fat / 100))');
    expect(floor).toContain('p_day - v_fat_on between 0 and body_fat_max_age_days');
    expect(floor).toContain('least(b.measured_on, p_today)');
    expect(floor).toContain(
      'greatest(v_mifflin, coalesce(v_katch, v_mifflin)) * min_intake_relative_to_bmr',
    );
    expect(floor).toContain("'pregnancy' = any (h.flags)");
  });

  it('G-W3: geprüfte Tages-Status und Rundungs-Spielraum = MEAL_PLAN_DAY_KCAL_CHECK; nur ab heute, nur mit Einwilligung', () => {
    const save = fnBody('public.save_meal_plan');
    expect(keysOf(save, 'checked_day_statuses')).toEqual(
      [...MEAL_PLAN_DAY_KCAL_CHECK.checkedDayStatuses].sort(),
    );
    expect(constant(save, 'kcal_tolerance')).toBe(MEAL_PLAN_DAY_KCAL_CHECK.roundingToleranceKcal);
    expect(save).toContain('where r.date >= today');
    expect(save).toContain(
      'd.kcal + kcal_tolerance < private.meal_plan_day_kcal_floor(current_user_id, d.day, today)',
    );
    // Wächter N7 Teil 2 H1: die Tagessumme stammt vom Server, nicht vom Gerät.
    expect(save).toContain('sum(r.s_kcal) as kcal');
    // Prüfung nach der Einwilligungs-Sperre (Körperdaten unter derselben Sperre gelesen).
    expect(save.indexOf('basis.consent_ok and exists')).toBeGreaterThan(
      save.indexOf('private.nutrition_health_basis()'),
    );
  });

  it('H1: Server-Nährwerte – Rundung = AMOUNT_ROUNDING, Spielraum = MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE, gespeichert werden Server-Werte', () => {
    const fn = fnBody('private.meal_plan_item_nutrients');
    const dbl = (name: string) => {
      const match = new RegExp(`${name} constant double precision := (-?[0-9.]+);`).exec(fn);
      if (!match) throw new Error(`${name} nicht gefunden`);
      return Number(match[1]);
    };
    expect({
      massStep: dbl('mass_step'),
      smallMassStep: dbl('small_mass_step'),
      smallMassBelow: dbl('small_mass_below'),
      pieceStep: dbl('piece_step'),
      spoonStep: dbl('spoon_step'),
      pinchStep: dbl('pinch_step'),
    }).toEqual(AMOUNT_ROUNDING);
    // Nur nicht optionale Zutaten zählen (computeRecipeFacts/scalePortion), Prise = PINCH_G über grams_per_unit.
    expect(fn).toContain('if not ing.optional then');
    expect(fn).toContain('case when ing.scales then p_factor / servings else 1 / servings end');
    const save = fnBody('public.save_meal_plan');
    expect(constant(save, 'item_kcal_tolerance')).toBe(MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE.kcal);
    expect(constant(save, 'item_macro_tolerance_g')).toBe(MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE.macroG);
    expect(save).toContain("r.s_kcal, r.s_protein, r.s_carbs, r.s_fat, x.v -> 'substitutions'");
    expect(save).not.toContain("(v ->> 'kcal')::numeric,\n");
  });

  it('G-W3: die erwarteten Werte im pgTAP-Test (33) rechnet packages/core genauso (Core = SQL)', () => {
    const pgtap = readFileSync(
      new URL('../../../supabase/tests/33_n7_teil2_retention_kcal_check.test.sql', import.meta.url),
      'utf8',
    );
    const expected = (label: string): number | null => {
      const re = new RegExp(`\\s+(null|[0-9.]+(?:::numeric)?), '${label}`);
      const match = re.exec(pgtap);
      if (!match) throw new Error(`Test „${label}“ nicht gefunden`);
      return match[1] === 'null' ? null : Number(String(match[1]).replace('::numeric', ''));
    };
    const base = {
      birthDate: '1990-01-01',
      sex: 'male' as const,
      today: '2026-10-14',
      date: '2026-10-14',
      healthDataConsent: true,
      healthFlags: [],
      bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 }],
    };
    const cases: [string, Parameters<typeof serverDayKcalFloor>[0]][] = [
      ['A: Mifflin-St Jeor', base],
      [
        'E: 16. Geburtstag am Tag selbst',
        {
          ...base,
          birthDate: '2010-10-14',
          sex: 'female',
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 160, weightKg: 50 }],
        },
      ],
      [
        'E: am Tag davor noch 15 Jahre',
        {
          ...base,
          birthDate: '2010-10-14',
          sex: 'female',
          date: '2026-10-13',
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 160, weightKg: 50 }],
        },
      ],
      [
        'F: 95 Jahre, 300 kg, ohne Geschlecht',
        {
          ...base,
          birthDate: '1931-01-01',
          sex: null,
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 200, weightKg: 300 }],
        },
      ],
      [
        'G: Körperfett 90 Tage alt',
        {
          ...base,
          bodyMetricsRows: [
            { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
            { measuredOn: '2026-07-16', bodyFatPct: 10 },
          ],
        },
      ],
      [
        'G: Körperfett 91 Tage alt',
        {
          ...base,
          date: '2026-10-15',
          bodyMetricsRows: [
            { measuredOn: '2026-10-01', heightCm: 180, weightKg: 80 },
            { measuredOn: '2026-07-16', bodyFatPct: 10 },
          ],
        },
      ],
      [
        'C: Schwangerschaft',
        {
          ...base,
          sex: 'female',
          healthFlags: ['pregnancy', 'conservative_plan'],
          bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 170, weightKg: 70 }],
        },
      ],
      ['D: ohne Größe', { ...base, bodyMetricsRows: [{ measuredOn: '2026-10-01', weightKg: 80 }] }],
      [
        'D: Größe aus älterer Zeile',
        {
          ...base,
          bodyMetricsRows: [
            { measuredOn: '2026-10-01', weightKg: 80 },
            { measuredOn: '2026-10-15', weightKg: 90 },
            { measuredOn: '2026-09-01', heightCm: 170 },
          ],
        },
      ],
    ];
    for (const [label, input] of cases) {
      const core = serverDayKcalFloor(input);
      const sql = expected(label);
      if (sql === null) expect(core, label).toBeNull();
      else expect(core, label).toBeCloseTo(sql, 9);
    }
  });
});

describe('Gericht per Foto in der Datenbank (Etappe E3)', () => {
  const main = readMigration('_ai_food_photo.sql');
  const enumsFile = migrationFiles.findIndex((n) => n.endsWith('_ai_food_photo_enums.sql'));
  const mainFile = migrationFiles.findIndex((n) => n.endsWith('_ai_food_photo.sql'));
  const photoFile = migrationFiles.findIndex((n) => n.endsWith('_food_log_photo.sql'));
  const body = (name: string) => {
    const start = allSql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return allSql.slice(start, allSql.indexOf('$$;', allSql.indexOf('as $$', start)));
  };

  it('Enum-Wert in eigener Datei VOR seiner Verwendung', () => {
    expect(enumsFile).toBeGreaterThanOrEqual(0);
    expect(mainFile).toBeGreaterThan(enumsFile);
    expect(photoFile).toBeGreaterThan(mainFile);
  });

  it.each([
    ['default_monthly_limit constant integer := ', AI_FOOD_PHOTO.monthlyLimit],
    ['default_daily_limit constant integer := ', AI_FOOD_PHOTO.dailyLimit],
    ['default_daily_attempts_max constant integer := ', AI_FOOD_PHOTO.dailyAttemptsMax],
  ] as const)('ai_food_photo_reserve: „%s%s“ = AI_FOOD_PHOTO', (marker, value) => {
    expect(body('public.ai_food_photo_reserve')).toContain(`${marker}${value};`);
  });

  it('Reservierung zählt wie photoLimitState (ohne Abschluss weiter – fail closed, Europe/Berlin)', () => {
    const usage = body('private.ai_food_photo_usage');
    expect(usage).toContain("u.status in ('succeeded', 'reserved') as counts");
    expect(usage).not.toContain('minutes');
    // Versuchs-Deckel je Person = 2 × Tageslimit (photoLimitsFor), Mindest-Fassung für den echten Anbieter.
    expect(body('public.ai_food_photo_reserve')).toContain(
      'then default_daily_attempts_max else 2 * b.daily_limit end',
    );
    expect(body('public.ai_food_photo_reserve')).toContain(
      "p_min_consent_version > coalesce(public.current_consent_version('ai_food_photo'), 0)",
    );
    expect(body('public.ai_food_photo_reserve')).toContain(
      `default_daily_limit constant integer := ${AI_FOOD_PHOTO.dailyLimit};`,
    );
    expect(usage).toContain("at time zone 'Europe/Berlin'");
  });

  it('ai_usage: CHECK-Listen = AI_FOOD_PHOTO.feature / AI_USAGE_STATUSES, keine Inhalts-Spalten', () => {
    expect(quotedListAfter(main, 'check (feature in (')).toEqual([AI_FOOD_PHOTO.feature]);
    expect(quotedListAfter(main, 'check (status in (')).toEqual([...AI_USAGE_STATUSES]);
    const table = main.slice(
      main.indexOf('create table public.ai_usage'),
      main.indexOf('comment on table public.ai_usage'),
    );
    const columns = [...table.matchAll(/^ {2}([a-z_]+) [a-z]/gm)].map((m) => m[1]);
    expect(columns).toEqual([
      'id',
      'user_id',
      'feature',
      'status',
      'model',
      'input_tokens',
      'output_tokens',
      'cost_eur',
      'created_at',
      'finished_at',
    ]);
  });

  it('Limits je Person (N6): Bereich in beta_entitlements und beta_admin = AI_FOOD_PHOTO.customLimits', () => {
    const { monthly, daily } = AI_FOOD_PHOTO.customLimits;
    expect(main).toContain(`check (monthly_limit between ${monthly.min} and ${monthly.max})`);
    expect(main).toContain(`check (daily_limit between ${daily.min} and ${daily.max})`);
    expect(main).toContain(`p_monthly_limit not between ${monthly.min} and ${monthly.max}`);
    expect(main).toContain(`p_daily_limit not between ${daily.min} and ${daily.max}`);
  });

  it('kein Storage-Bucket für Fotos (A-G18: Foto wird nie gespeichert)', () => {
    for (const name of migrationFiles.filter((n) => n >= (migrationFiles[enumsFile] ?? ''))) {
      expect(readMigration(name)).not.toMatch(/storage\.(buckets|objects)/);
    }
  });

  it('reserve/finish/beta_admin nur service_role, Lesen der Nutzung per RLS nur eigene Zeilen', () => {
    expect(main).toContain(
      'revoke all on function public.ai_food_photo_reserve(uuid, integer) from public, anon, authenticated;',
    );
    expect(main).toContain(
      'grant execute on function public.ai_food_photo_reserve(uuid, integer) to service_role;',
    );
    expect(main).toContain('grant select on table public.ai_usage to authenticated;');
    expect(main).toContain('using (user_id = (select auth.uid()));');
    expect(main).not.toMatch(
      /grant (insert|update|delete|all) on table public\.ai_usage to authenticated/,
    );
  });

  it('export_my_data (E3): Obermenge der Vorgänger-Fassung – jede bisherige Zeile steht unverändert darin', () => {
    const marker = 'create or replace function public.export_my_data()';
    const withFn = migrationFiles.filter((n) => readMigration(n).includes(marker));
    const fnOf = (name: string) => {
      const sql = readMigration(name);
      const start = sql.lastIndexOf(marker);
      return sql.slice(start, sql.indexOf('$$;', start)).split('\n');
    };
    const latest = fnOf(withFn.at(-1) ?? '');
    const previous = fnOf(withFn.at(-2) ?? '');
    // Nur das schließende „)“ der letzten Zeile bekommt ein Komma.
    const missing = previous.filter(
      (line) => !latest.includes(line) && !latest.includes(`${line},`),
    );
    expect(missing).toEqual([]);
    expect(latest.join('\n')).toContain("'ai_usage', (select coalesce(");
    expect(latest.join('\n')).toContain("'beta_entitlements', (select coalesce(");
  });

  it('save_food_log_entries: photo wie food (Werte aus dem Katalog), sonst unverändert', () => {
    const save = body('public.save_food_log_entries');
    expect(save).toContain("if v_source in ('food', 'recipe', 'custom_meal', 'photo') then");
    expect(save).toContain("if v_source in ('food', 'photo') then");
    expect(save).toContain(`'{"source": "food"}'::jsonb`);
    // Alle Zeilen der E2-Fassung stehen weiter darin, bis auf die drei erweiterten.
    const e2 = readMigration('_custom_meal_rpcs.sql');
    const start = e2.indexOf('create or replace function public.save_food_log_entries(');
    const old = e2.slice(start, e2.indexOf('$$;', start)).split('\n');
    const missing = old.filter((line) => !save.split('\n').includes(line));
    expect(missing).toEqual([
      "      if v_source = 'food' then",
      "      if v_source in ('food', 'recipe', 'custom_meal') then",
      '        if not private.food_log_device_values_ok(e) then',
      '        v_values := private.food_log_server_values(e, ex_row, v_custom_meal_id, current_user_id);',
    ]);
  });
});

describe('Strecken in der Datenbank (Phase 10 S1)', () => {
  const table = readMigration('_tracked_routes.sql');
  const rpcs = readMigration('_tracked_route_rpcs.sql');
  const fn = (sql: string, name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  // Neueste Fassung (Etappe E4: + optionales Höhenprofil); die S1-Fassung ist darin Zeile für Zeile enthalten.
  const elevation = readMigration('_tracked_route_elevation_profile.sql');
  const saveS1 = fn(rpcs, 'public.save_tracked_route');
  const save = fn(elevation, 'public.save_tracked_route');
  const update = fn(rpcs, 'public.update_tracked_route');
  /** Zeilen der älteren Fassung, die in der neueren (in Reihenfolge, ggf. mit Komma am Ende) fehlen. */
  const missingLines = (older: string, newer: string) => {
    const next = newer.split('\n');
    let at = 0;
    const missing: string[] = [];
    for (const line of older.split('\n')) {
      const found = next.findIndex((n, i) => i >= at && (n === line || n === `${line},`));
      if (found < 0) missing.push(line);
      else at = found + 1;
    }
    return missing;
  };
  const block = table.slice(table.indexOf('create table public.tracked_routes ('));
  const L = TRACKED_ROUTE_LIMITS;

  it('Höhenprofil (E4): neueste save_tracked_route = S1-Fassung + nur das optionale Feld; Spalte additiv', () => {
    expect(missingLines(saveS1, save)).toEqual([
      "  perform private.assert_json_keys(r, route_keys, 'Strecke');",
    ]);
    const newest = migrationFiles.filter((n) =>
      readMigration(n).includes('create or replace function public.save_tracked_route('),
    );
    expect(newest.at(-1)).toMatch(/_tracked_route_elevation_profile\.sql$/);
    expect(elevation).toContain(
      'alter table public.tracked_routes add column elevation_profile jsonb;',
    );
    expect(elevation).toContain(
      'check (elevation_profile is null or private.elevation_profile_valid(elevation_profile))',
    );
    expect(elevation).not.toMatch(/drop |alter column|rename /i);
    const valid = fn(elevation, 'private.elevation_profile_valid');
    const P = ROUTE_ELEVATION_PROFILE;
    expect(valid).toContain(`max_points constant integer := ${P.maxPoints};`);
    expect(valid).toContain(`max_distance_m constant integer := ${L.distanceM.max};`);
    expect(valid).toContain(`min_height_dm constant integer := ${P.heightDm.min};`);
    expect(valid).toContain(`max_height_dm constant integer := ${P.heightDm.max};`);
    expect(valid).toContain('or h not between min_height_dm and max_height_dm or d < prev then');
    // Export: ganze Zeile (to_jsonb(t)) – die Spalte ist automatisch dabei.
    expect(readMigration('_tracked_route_rpcs.sql')).toContain(
      "'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb)",
    );
  });

  it('Enums in eigener Datei VOR der Tabelle', () => {
    const enumsFile = migrationFiles.findIndex((n) => n.endsWith('_tracked_route_enums.sql'));
    const tableFile = migrationFiles.findIndex((n) => n.endsWith('_tracked_routes.sql'));
    const rpcsFile = migrationFiles.findIndex((n) => n.endsWith('_tracked_route_rpcs.sql'));
    expect(enumsFile).toBeGreaterThanOrEqual(0);
    expect(tableFile).toBeGreaterThan(enumsFile);
    expect(rpcsFile).toBeGreaterThan(tableFile);
  });

  it('Sportart: CHECK = TRACKED_ROUTE_SPORTS (Teilmenge der Ausdauer-Arten, ohne Schwimmen)', () => {
    expect(quotedListAfter(block, 'check (sport in (')).toEqual([...enums.TRACKED_ROUTE_SPORTS]);
    for (const sport of enums.TRACKED_ROUTE_SPORTS) {
      expect(enums.ENDURANCE_MODALITIES).toContain(sport);
    }
  });

  it('route_keys = Pflichtfelder von trackedRouteSchema, optional_keys = TRACKED_ROUTE_OPTIONAL_KEYS, update_keys = updateTrackedRouteSchema', () => {
    const optional: readonly string[] = TRACKED_ROUTE_OPTIONAL_KEYS;
    expect(quotedListAfter(save, 'route_keys constant text[] := array[').sort()).toEqual(
      Object.keys(trackedRouteSchema.shape)
        .filter((key) => !optional.includes(key))
        .sort(),
    );
    expect(quotedListAfter(save, 'optional_keys constant text[] := array[').sort()).toEqual(
      [...optional].sort(),
    );
    // Optionale Felder sind in Zod wirklich optional.
    for (const key of optional) {
      const shape = trackedRouteSchema.shape as Record<
        string,
        { safeParse: (v: unknown) => { success: boolean } }
      >;
      expect(shape[key]?.safeParse(undefined).success, key).toBe(true);
    }
    expect(save).toContain('if not (r ?& route_keys)');
    expect(save).toContain(
      "perform private.assert_json_keys(r, route_keys || optional_keys, 'Strecke');",
    );
    expect(quotedListAfter(update, 'update_keys constant text[] := array[').sort()).toEqual(
      Object.keys(updateTrackedRouteSchema.shape).sort(),
    );
    expect(update).toContain('if not (r ?& update_keys)');
    // Server-Felder nie in der Eingabe.
    for (const key of ['user_id', 'point_count', 'bbox', 'created_at', 'updated_at']) {
      expect(Object.keys(trackedRouteSchema.shape)).not.toContain(key);
    }
  });

  it.each([
    `char_length(name) between 1 and ${L.nameMaxLength}`,
    `check (char_length(note) between 1 and ${L.noteMaxChars})`,
    `check (duration_s between ${L.durationS.min} and ${L.durationS.max})`,
    `check (moving_s between 0 and ${L.durationS.max})`,
    `check (distance_m between ${L.distanceM.min} and ${L.distanceM.max})`,
    `check (elevation_gain_m between ${L.elevationGainM.min} and ${L.elevationGainM.max})`,
    `check (char_length(polyline) between 1 and ${L.polylineMaxChars} and polyline ~ '${POLYLINE_PATTERN.source}')`,
    `check (point_count between ${L.minPoints} and ${L.maxPoints})`,
    `check (started_at >= timestamptz '${L.startedAtMin.replace('T', ' ').replace('Z', '+00')}')`,
  ])('CHECK der Tabelle = TRACKED_ROUTE_LIMITS: %s', (fragment) => {
    expect(block).toContain(fragment);
  });

  it('Name: Leerraum am Rand = TRACKED_ROUTE_NAME_TRIM_CLASS (String.prototype.trim())', () => {
    expect(block).toContain(`name !~ '^[${TRACKED_ROUTE_NAME_TRIM_CLASS}]'`);
    expect(block).toContain(`name !~ '[${TRACKED_ROUTE_NAME_TRIM_CLASS}]$'`);
  });

  it('Distanz-Plausibilität = jumpFactor × CARDIO_PLAUSIBILITY_KMH (× 10, ganze Zahlen)', () => {
    const cases = enums.TRACKED_ROUTE_SPORTS.map(
      (sport) =>
        `when '${sport}' then ${Math.round(CARDIO_PLAUSIBILITY_KMH[sport] * ROUTE_FILTER.jumpFactor * 10)}`,
    );
    expect(block).toContain(`distance_m * 36 <= (case sport ${cases.join(' ')} end) * duration_s`);
  });

  it('Polyline-Leser (SQL) = decodePolyline: Zeichen, Länge, 7 Gruppen, ±90/±180, 5 Nachkommastellen', () => {
    const body = fn(table, 'private.polyline_summary');
    expect(body).toContain(`char_length(p_polyline) not between 1 and ${L.polylineMaxChars}`);
    expect(body).toContain(`p_polyline !~ '${POLYLINE_PATTERN.source}'`);
    expect(body).toContain('if groups > 7 then');
    const factor = 10 ** L.polylinePrecision;
    expect(body).toContain(`abs(lat) > ${90 * factor} or abs(lng) > ${180 * factor}`);
    expect(body).toContain(`round(south / ${factor}.0, ${L.polylinePrecision})`);
    expect(save).toContain(`v_summary[1] not between ${L.minPoints} and ${L.maxPoints}`);
  });

  it('save_tracked_route: Tageslimit, Uhr-Spielraum, Eintrag-Toleranz = TRACKED_ROUTE_LIMITS', () => {
    expect(save).toContain(`max_saves_per_day constant integer := ${L.maxSavesPerDay};`);
    expect(save).toContain(`clock_skew_s constant integer := ${L.clockSkewS};`);
    expect(save).toContain(
      `private.jsonb_number_between(r -> 'duration_s', ${L.durationS.min}, ${L.durationS.max}, 0)`,
    );
    expect(save).toContain(
      `private.jsonb_number_between(r -> 'distance_m', ${L.distanceM.min}, ${L.distanceM.max}, 0)`,
    );
  });

  it('Favorit nur eigener Favorit gleicher Sportart; Eintrag nur eigener Ausdauer-Eintrag gleicher Art', () => {
    expect(save).toContain(
      'where t.id = v_base_route_id and t.user_id = current_user_id and t.is_favorite and t.sport = v_sport',
    );
    expect(save).toContain(
      "where sl.id = v_session_log_id and sl.user_id = current_user_id and sl.kind = 'endurance'",
    );
    expect(save).toContain('and cl.modality = v_sport');
    // Zusätzlich zusammengesetzte Fremdschlüssel mit user_id.
    expect(block).toContain(
      'foreign key (base_route_id, user_id) references public.tracked_routes (id, user_id)',
    );
    expect(block).toContain(
      'foreign key (session_log_id, user_id) references public.session_logs (id, user_id)',
    );
  });

  it('RLS: nur eigene Zeilen lesen, kein Schreib-Recht, genau eine Policy', () => {
    expect(table).toContain('alter table public.tracked_routes enable row level security;');
    expect(table).toContain('revoke all on table public.tracked_routes from anon, authenticated;');
    expect(table).toContain('grant select on table public.tracked_routes to authenticated;');
    expect(table.match(/create policy/g)).toHaveLength(1);
    expect(table).toContain('using (user_id = (select auth.uid()))');
    expect(allSql).not.toMatch(
      /grant (insert|update|delete|all) on table public\.tracked_routes to authenticated/,
    );
  });

  it('Widerruf health_data: Strecken bleiben (W-G15) – consents_after_revoke (neueste Fassung) ohne tracked_routes', () => {
    const marker = 'create or replace function private.consents_after_revoke()';
    const start = allSql.lastIndexOf(marker);
    const body = allSql.slice(start, allSql.indexOf('$$;', start));
    expect(body).not.toContain('tracked_routes');
    expect(rpcs).not.toContain(marker);
  });

  it('save_session_log (S1): Herkunft gps/gpx_import nur über save_tracked_route; sonst Zeile für Zeile wie A1b', () => {
    const marker = 'create or replace function public.save_session_log(';
    const bodyOf = (sql: string) => {
      const start = sql.lastIndexOf(marker);
      return sql.slice(start, sql.indexOf('$$;', start)).split('\n');
    };
    const latest = bodyOf(rpcs);
    const a1b = bodyOf(readMigration('_free_session_logs.sql'));
    expect(a1b.filter((line) => !latest.includes(line))).toEqual([
      "          source = (p_log ->> 'source')::public.log_source,",
      "        intro_week, deload, from_health, v_is_free, new_revision, write_id, (p_log ->> 'source')::public.log_source,",
    ]);
    const text = latest.join('\n');
    expect(text).toContain("if v_source <> 'manual' then");
    expect(text).toContain('          source = existing.source,');
    expect(save).toContain(
      "set source = case v_source when 'recorded' then 'gps' else 'gpx_import' end::public.log_source",
    );
  });

  it('Wächter S1 M3/M4: Eintrag passt zur Strecke = sessionLogFitsRoute (TRACKED_ROUTE_LOG_MATCH, Tagesfenster)', () => {
    const fits = rpcs.slice(
      rpcs.indexOf('create or replace function private.session_log_fits_route('),
      rpcs.indexOf(
        '$$;',
        rpcs.indexOf('create or replace function private.session_log_fits_route('),
      ),
    );
    const M = TRACKED_ROUTE_LOG_MATCH;
    const day = "(p_route_started_at at time zone 'Europe/Berlin')::date";
    expect(fits).toContain(
      `and p_log_day between ${day}\n      and ${day} + ${L.sessionLogDayTolerance}\n`,
    );
    expect(fits).toContain(
      `abs(p_log_distance_m - p_route_distance_m) <= greatest(${M.distanceMinM}, p_route_distance_m * ${M.distanceShare})`,
    );
    expect(fits).toContain(
      `p_log_duration_s between p_route_moving_s - ${M.durationToleranceS} and p_route_duration_s + ${M.durationToleranceS}`,
    );
    expect(fits).toContain("p_log_kind = 'endurance'\n    and p_log_modality = p_route_sport");
    // Beide Wege nutzen dieselbe Prüfung.
    expect(save).toContain('if not private.session_log_fits_route(');
    const marker = 'create or replace function public.save_session_log(';
    const logFn = rpcs.slice(rpcs.indexOf(marker), rpcs.indexOf('$$;', rpcs.indexOf(marker)));
    expect(logFn).toContain('where t.session_log_id = existing.id');
    expect(logFn).toContain('if not private.session_log_fits_route(');
    // N2: revision steigt beim Setzen der Herkunft.
    expect(save).toContain('revision = sl.revision + 1');
  });

  it('export_my_data (S1): Obermenge der E3-Fassung plus tracked_routes', () => {
    const marker = 'create or replace function public.export_my_data()';
    const bodyOf = (sql: string) => {
      const start = sql.lastIndexOf(marker);
      return sql.slice(start, sql.indexOf('$$;', start)).split('\n');
    };
    const latest = bodyOf(rpcs);
    const e3 = bodyOf(readMigration('_ai_food_photo_export.sql'));
    expect(e3.filter((line) => !latest.includes(line) && !latest.includes(`${line},`))).toEqual([]);
    expect(latest.join('\n')).toContain(
      "'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb) from public.tracked_routes t where t.user_id = current_user_id)",
    );
    expect(DATA_EXPORT_TABLES).toContain('tracked_routes');
  });
});

describe('Produktabfrage und eigene Produkte in der Datenbank (Etappe E4a)', () => {
  const products = readMigration('_food_products.sql');
  const own = readMigration('_user_food_products.sql');
  const logProduct = readMigration('_food_log_product.sql');
  const revokeExport = readMigration('_food_product_revoke_export.sql');
  const L = FOOD_PRODUCT_LOOKUP_LIMITS;
  const C = FOOD_PRODUCT_CHECK;
  const U = USER_FOOD_PRODUCT_LIMITS;
  const body = (sql: string, name: string) => {
    const start = sql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  /** Jede Zeile der alten Fassung steht in derselben Reihenfolge in der neuen (nur eingefügte Zeilen). */
  const missingLines = (older: string, newer: string, allowComma = false) => {
    const next = newer.split('\n');
    let at = 0;
    const missing: string[] = [];
    for (const line of older.split('\n')) {
      let found = -1;
      for (let i = at; i < next.length; i += 1) {
        if (next[i] === line || (allowComma && next[i] === `${line},`)) {
          found = i;
          break;
        }
      }
      if (found < 0) missing.push(line);
      else at = found + 1;
    }
    return missing;
  };
  const table = (sql: string, name: string) =>
    sql.slice(sql.indexOf(`create table ${name}`), sql.indexOf(`comment on table ${name}`));

  it.each([
    [products, 'per_hour constant integer := ', L.perHour],
    [products, 'per_day constant integer := ', L.perDay],
    [products, 'fresh_days constant integer := ', L.cacheFreshDays],
    [products, 'negative_days constant integer := ', L.negativeCacheDays],
    [products, 'delete_days constant integer := ', L.cacheDeleteDays],
    [products, 'purge_batch constant integer := ', L.purgeBatch],
    [products, 'counts_retention_days constant integer := ', L.countsRetentionDays],
    [products, 'per_minute constant integer := ', L.globalPerMinute],
    [products, 'backoff_minutes constant integer := ', OPEN_FOOD_FACTS.backoffMinutes],
    [own, 'max_products constant integer := ', U.maxProducts],
    [own, 'payload_max_bytes constant integer := ', U.maxPayloadBytes],
  ] as const)('Grenze im SQL: „%#“ = packages/core', (sql, marker, value) => {
    expect(sql).toContain(`${marker}${value};`);
  });

  it('food_products: CHECK-Grenzen = FOOD_PRODUCT_CHECK / FOOD_PRODUCT_LOOKUP_LIMITS', () => {
    const t = table(products, 'public.food_products');
    expect(t).toContain(`kcal integer check (kcal between 0 and ${C.kcalMax})`);
    for (const col of [
      'protein_g',
      'carbs_g',
      'fat_g',
      'sugar_g',
      'sat_fat_g',
      'fiber_g',
      'salt_g',
    ]) {
      expect(t).toContain(`${col} numeric check (${col} between 0 and ${C.macroMaxG} and`);
    }
    for (const col of ['serving_g', 'package_g']) {
      expect(t).toContain(`${col} between ${C.amountG.min} and ${C.amountG.max}`);
    }
    expect(t).toContain(`char_length(name_de) between 1 and ${C.nameMaxChars}`);
    expect(t).toContain(`char_length(brand_de) between 1 and ${C.brandMaxChars}`);
    expect(t).toContain(`char_length(quantity_label) between 1 and ${C.quantityMaxChars}`);
    expect(t).toContain(`octet_length(off_fields::text) <= ${L.offFieldsMaxBytes}`);
    expect(t).toContain(`source_db = '${OPEN_FOOD_FACTS.sourceDb}'`);
    expect(t).toContain(`source_license = '${OPEN_FOOD_FACTS.license}'`);
    expect(t).toContain(`source_url = '${OPEN_FOOD_FACTS.homeUrl}'`);
  });

  it('food_products: CHECK-Listen = Stufen, Grund-Codes, Bezug (packages/core)', () => {
    const t = table(products, 'public.food_products');
    expect(quotedListAfter(t, 'check (check_level in (')).toEqual([...FOOD_PRODUCT_CHECK_LEVELS]);
    expect(quotedListAfter(t, 'check_reasons <@ array[')).toEqual([...FOOD_PRODUCT_CHECK_REASONS]);
    expect(quotedListAfter(t, 'check (base_unit in (')).toEqual([...FOOD_PRODUCT_BASE_UNITS]);
    expect(quotedListAfter(own, 'check (base_unit in (')).toEqual([...FOOD_PRODUCT_BASE_UNITS]);
  });

  it('food_products: Spalten = FoodProductRecord (+ feste Quelle), KEINE user_id; nicht direkt lesbar', () => {
    const t = table(products, 'public.food_products');
    const columns = [...t.matchAll(/^ {2}([a-z_]+) [a-z]/gm)].map((m) => m[1]);
    expect(columns).toEqual([
      ...Object.keys(foodProductRecordSchema.shape).filter(
        (k) => k !== 'off_last_modified' && k !== 'retrieved_at',
      ),
      'source_db',
      'source_license',
      'source_url',
      'off_last_modified',
      'retrieved_at',
    ]);
    expect(columns).not.toContain('user_id');
    expect(products).toContain(
      'revoke all on table public.food_products from public, anon, authenticated;',
    );
    expect(products).not.toMatch(/create policy [^;]* on public\.food_products/);
  });

  it('OFF-Daten getrennt vom BLS-Katalog: keine Migration verknüpft food_products mit foods/recipes', () => {
    expect(allSql).not.toMatch(/references public\.food_products/);
    expect(table(products, 'public.food_products')).not.toContain('references');
    for (const name of migrationFiles.filter((n) => readMigration(n).includes('food_products'))) {
      expect(readMigration(name)).not.toMatch(/insert into public\.(foods|recipes)\b/);
    }
  });

  it('Nummer: barcode_ok = BARCODE_PATTERN + GS1-Prüfziffer', () => {
    const fn = body(products, 'private.barcode_ok');
    expect(fn).toContain("p_code ~ '^([0-9]{8}|[0-9]{13,14})$'");
    expect(BARCODE_PATTERN.source).toBe('^(\\d{8}|\\d{13,14})$');
    expect(fn).toContain('case when i % 2 = 1 then 3 else 1 end');
  });

  it('Sperr-Reihenfolge: Einwilligung FOR SHARE → prüfen → Advisory-Sperre → Zeilen (Wächter N7 S2)', () => {
    for (const [fn, check] of [
      [body(products, 'public.food_product_lookup'), 'has_valid_consent_for'],
      [body(own, 'public.save_user_food_product'), "has_valid_consent('health_data')"],
    ] as const) {
      expect(fn.indexOf('for share')).toBeGreaterThan(0);
      expect(fn.indexOf('for share')).toBeLessThan(fn.indexOf(check));
      expect(fn.indexOf(check)).toBeLessThan(fn.indexOf('pg_advisory_xact_lock'));
    }
    const del = body(own, 'public.delete_user_food_product');
    expect(del).not.toContain('has_valid_consent');
    expect(del.indexOf('pg_advisory_xact_lock')).toBeLessThan(
      del.indexOf('public.food_log_entries'),
    );
  });

  it('Rechte: Abfrage/Speichern/Sperre nur service_role; eigene Produkte nur lesen', () => {
    for (const sig of [
      'public.food_product_lookup(uuid, text)',
      'public.food_product_upsert(jsonb)',
      'public.food_product_off_backoff()',
    ]) {
      expect(products).toContain(`revoke all on function ${sig} from public, anon, authenticated;`);
      expect(products).toContain(`grant execute on function ${sig} to service_role;`);
    }
    expect(own).toContain('grant select on table public.user_food_products to authenticated;');
    expect(own).not.toMatch(
      /grant (insert|update|delete|all) on table public\.user_food_products to authenticated/,
    );
  });

  it('save_user_food_product: Feldliste = userFoodProductPayloadSchema, null genau bei nullable-Feldern', () => {
    const match = /product_fields constant jsonb := '([^']*)'/.exec(own);
    if (!match) throw new Error('product_fields nicht gefunden');
    const fields = JSON.parse(match[1] as string) as Record<string, string>;
    const shape = userFoodProductPayloadSchema.shape as Record<
      string,
      { safeParse: (value: unknown) => { success: boolean } }
    >;
    expect(Object.keys(fields).sort()).toEqual(Object.keys(shape).sort());
    for (const [key, types] of Object.entries(fields)) {
      expect(types.split('|').includes('null'), key).toBe(shape[key]?.safeParse(null).success);
    }
  });

  it('user_food_products: Grenzen und Zeichenregeln = USER_FOOD_PRODUCT_LIMITS / eigene Gerichte', () => {
    const t = table(own, 'public.user_food_products');
    expect(t).toContain(`char_length(name_de) between 1 and ${U.nameMaxChars}`);
    expect(t).toContain(`char_length(brand_de) between 1 and ${U.brandMaxChars}`);
    expect(t).toContain(
      `kcal integer not null check (kcal between ${U.kcal.min} and ${U.kcal.max})`,
    );
    expect(t).toContain(`protein_g between ${U.per100G.min} and ${U.per100G.max}`);
    expect(t).toContain(`serving_g between ${U.servingG.min} and ${U.servingG.max}`);
    expect(t).toContain(
      `<= case when base_unit = 'ml' then ${C.macroSumMaxG.ml} else ${C.macroSumMaxG.g} end`,
    );
    expect(t.split(`!~ '[${CUSTOM_MEAL_NAME_FORBIDDEN_CLASS}]'`)).toHaveLength(3);
    expect(t.split(`!~ '^[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]'`)).toHaveLength(3);
    expect(t).toContain('user_id uuid not null references auth.users (id) on delete cascade');
  });

  it('Tagebuch: fester Titel ohne Nummer, Werte vom Server, product_unavailable, Titel ≤ 100 Zeichen', () => {
    expect(logProduct).toContain(
      `(product_code is not null or title_de = '${USER_PRODUCT_ENTRY_TITLE}')`,
    );
    const values = body(logProduct, 'private.food_log_product_values');
    expect(values).toContain("jsonb_build_object('unavailable', true)");
    expect(values).toContain('factor := v_amount / 100;');
    expect(values).toContain(
      `then r_name else r_name || ' · ' || r_brand end, ${FOOD_LOG_LIMITS.titleMaxChars}))`,
    );
    expect(values).toContain('private.js_round(r_kcal * factor)');
    expect(values).not.toMatch(/\brecord;/);
    const save = body(logProduct, 'public.save_food_log_entries');
    expect(save).toContain(
      "when err_message = 'Produkt nicht verfügbar.' then 'product_unavailable'",
    );
    expect(save).toContain(
      'v_values := private.food_log_product_values(e, ex_row, v_user_product_id, current_user_id);',
    );
  });

  it('Wächter M1: neue Nutzung einer Nummer (Eintrag, Favorit) zählt auf die Abfrage-Limits', () => {
    const use = readMigration('_food_product_use_limit.sql');
    const charge = body(use, 'private.food_product_charge');
    expect(charge).toContain(`per_hour constant integer := ${FOOD_PRODUCT_LOOKUP_LIMITS.perHour};`);
    expect(charge).toContain(`per_day constant integer := ${FOOD_PRODUCT_LOOKUP_LIMITS.perDay};`);
    // Dieselbe Sperre und dieselbe Zähl-Tabelle wie die Abfrage (ohne Nummer).
    expect(charge).toContain(
      "pg_advisory_xact_lock(hashtext('food_product_lookup|' || p_user_id::text))",
    );
    expect(charge).toContain(
      'insert into private.food_product_lookup_counts (user_id, hour_start, lookups)',
    );
    expect(charge).not.toMatch(/product_code|p_code/);
    expect(use).toMatch(
      /create trigger food_log_entries_product_charge\s+before insert or update of product_code on public\.food_log_entries/,
    );
    expect(use).toMatch(
      /create trigger food_log_favorites_product_charge\s+before insert or update of product_code on public\.food_log_favorites/,
    );
    // Trigger laufen alphabetisch: zuerst before_write (sperrt die Einwilligung), dann product_charge.
    expect('food_log_favorites_before_write' < 'food_log_favorites_product_charge').toBe(true);
    expect(body(logProduct, 'public.save_food_log_entries')).toContain(
      "when err_message = 'Produkt-Limit erreicht.' then 'product_limit'",
    );
    expect(charge).toContain("raise exception 'Produkt-Limit erreicht.'");
  });

  it('save_food_log_entries (E4a): echte Obermenge der E3-Fassung', () => {
    const e3 = body(readMigration('_food_log_photo.sql'), 'public.save_food_log_entries');
    expect(missingLines(e3, body(logProduct, 'public.save_food_log_entries'))).toEqual([]);
  });

  it('Favoriten-Trigger (E4a): echte Obermenge der E1-Fassung, Produkt-Favoriten mit Einwilligung FOR SHARE', () => {
    const e1 = body(readMigration('_food_log.sql'), 'private.food_log_favorites_before_write');
    const e4 = body(logProduct, 'private.food_log_favorites_before_write');
    expect(missingLines(e1, e4)).toEqual([]);
    const product = e4.slice(
      e4.indexOf("if new.source = 'product' then"),
      e4.indexOf('return new;'),
    );
    expect(product.indexOf('for share')).toBeGreaterThan(0);
    expect(product.indexOf('for share')).toBeLessThan(
      product.indexOf("has_valid_consent('health_data')"),
    );
    expect(product).toContain(`'${USER_PRODUCT_ENTRY_TITLE}'`);
    expect(product).toContain('new.kcal is null and new.protein_g is null');
  });

  it('beta_admin (E4a): echte Obermenge der E3-Fassung', () => {
    const e3 = body(readMigration('_ai_food_photo.sql'), 'public.beta_admin');
    expect(missingLines(e3, body(products, 'public.beta_admin'))).toEqual([]);
  });

  it('Widerruf (E4-G10): Obermenge der WP3-Fassung, eigene Produkte und Produkt-Favoriten am Anfang und am Ende', () => {
    const wp3 = body(readMigration('_competition_rpcs.sql'), 'private.consents_after_revoke');
    const e4 = body(revokeExport, 'private.consents_after_revoke');
    expect(missingLines(wp3, e4)).toEqual([]);
    expect(
      e4.split('delete from public.user_food_products where user_id = new.user_id;'),
    ).toHaveLength(3);
    expect(
      e4.split(
        "delete from public.food_log_favorites where user_id = new.user_id and source = 'product';",
      ),
    ).toHaveLength(3);
  });

  it('export_my_data (E4a): Obermenge der S1-Fassung plus eigene Produkte und Zähler', () => {
    const s1 = body(readMigration('_tracked_route_rpcs.sql'), 'public.export_my_data');
    const e4 = body(revokeExport, 'public.export_my_data');
    expect(missingLines(s1, e4, true)).toEqual([]);
    expect(e4).toContain("'user_food_products', (select coalesce(");
    expect(e4).toContain('from private.my_food_product_lookup_counts() t)');
    expect(e4).not.toContain('public.food_products');
    expect(DATA_EXPORT_TABLES).toContain('user_food_products');
    expect(DATA_EXPORT_TABLES).toContain('food_product_lookup_counts');
  });

  it('Zusammenführung mit Z3 (Wächter H1): *_revoke_export_union.sql ist Obermenge von E4a UND Z3', () => {
    const union = readMigration('_revoke_export_union.sql');
    const z3 = readMigration('_weight_goals_revoke_export.sql');
    for (const name of ['private.consents_after_revoke', 'public.export_my_data']) {
      const u = body(union, name);
      expect(missingLines(body(revokeExport, name), u, true), `E4a ${name}`).toEqual([]);
      expect(missingLines(body(z3, name), u, true), `Z3 ${name}`).toEqual([]);
    }
    const revoke = body(union, 'private.consents_after_revoke');
    for (const line of [
      'delete from public.user_food_products where user_id = new.user_id;',
      "delete from public.food_log_favorites where user_id = new.user_id and source = 'product';",
      'delete from public.weight_goals where user_id = new.user_id;',
    ]) {
      expect(revoke.split(line), line).toHaveLength(3); // Anfang und Wiederholung
    }
    const exported = body(union, 'public.export_my_data');
    for (const key of ['user_food_products', 'food_product_lookup_counts', 'weight_goals']) {
      expect(exported).toContain(`'${key}', (select coalesce(`);
    }
    // Zeitstempel nach beiden Vorgängern; die Vorgänger bleiben unverändert.
    const order = migrationFiles.filter((n) =>
      /_food_product_revoke_export|_weight_goals_revoke_export|_revoke_export_union/.test(n),
    );
    expect(order.at(-1)).toMatch(/_revoke_export_union\.sql$/);
    expect(order).toHaveLength(3);
  });

  it('Feature-Flag food_product_lookup startet AUS; pg_cron wie N7', () => {
    expect(products).toContain(
      "insert into private.feature_flags (key, enabled) values ('food_product_lookup', false)",
    );
    expect(products).toContain("'food-products-retention'");
  });
});

describe('Ziele in der Datenbank (Etappe Z3, docs/PLAN-ZIELE.md 5.1/5.2)', () => {
  const goalsSql = readMigration('_goals_secondary.sql');
  const table = readMigration('_weight_goals.sql');
  const revokeExport = readMigration('_weight_goals_revoke_export.sql');
  const newest = (marker: string) => {
    const start = allSql.lastIndexOf(marker);
    return allSql.slice(start, allSql.indexOf('$$;', start));
  };
  const revokeMarker = 'create or replace function private.consents_after_revoke()';
  const exportMarker = 'create or replace function public.export_my_data()';

  it('goals.secondary_goal_type: Paar-CHECK über private.goal_pair_allowed (= GOAL_COMBINATIONS), Disziplin bei Ausdauer als Haupt- oder Nebenziel', () => {
    expect(goalsSql).toContain(
      'alter table public.goals add column secondary_goal_type public.goal_type;',
    );
    expect(goalsSql).toContain(
      'secondary_goal_type is null or private.goal_pair_allowed(goal_type, secondary_goal_type)',
    );
    // Ohne `'endurance' in (…)`: NULL im CHECK gilt als erfüllt.
    expect(goalsSql).toContain(
      "discipline is null or goal_type = 'endurance' or secondary_goal_type is not distinct from 'endurance'",
    );
    expect(goalsSql).toContain("like '%discipline IS NULL%'");
    // N4: genau ein alter CHECK, sonst Abbruch
    expect(goalsSql).toContain('if dropped <> 1 then');
  });

  it('weight_goals: CHECKs = weightGoalSchema (Wächter Z2 K-5)', () => {
    const { min, max } = BODY_METRIC_LIMITS.weightKg;
    expect(table).toContain(
      `target_weight_kg numeric(4, 1) not null check (target_weight_kg between ${min} and ${max})`,
    );
    expect(WEIGHT_GOAL_LIMITS.targetStep).toBe(0.1); // numeric(4, 1)
    expect(table).toContain(
      `start_date date not null check (start_date >= date '${WEIGHT_GOAL_START_DATE_MIN}')`,
    );
    expect(table).toContain(
      `check (target_date between start_date + ${WEIGHT_GOAL_DAYS.min} and start_date + ${WEIGHT_GOAL_DAYS.max})`,
    );
    expect(quotedListAfter(table, 'amount_mode in (')).toEqual([...WEIGHT_GOAL_AMOUNT_MODES]);
    expect(quotedListAfter(table, 'time_mode in (')).toEqual([...WEIGHT_GOAL_TIME_MODES]);
    // Spalten = Felder des gespeicherten Ziels (camelCase → snake_case), kein Startgewicht (Wächter K9).
    const columns = [...table.matchAll(/^ {2}([a-z_]+) (?:uuid|numeric|date|text|timestamptz)/gm)]
      .map((m) => m[1] as string)
      .filter((c) => !['user_id', 'created_at', 'updated_at'].includes(c))
      .sort();
    const fields = Object.keys(weightGoalSchema.shape)
      .map((k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
      .sort();
    expect(columns).toEqual(fields);
    expect(table).not.toContain('start_weight');
  });

  it('weight_goals: RLS wie body_metrics (Schreiben nur mit Einwilligung), Trigger „nur mit Abnehmziel“ und Löschen bei goals-Update/-Delete (S13)', () => {
    expect(table).toContain('alter table public.weight_goals enable row level security;');
    expect(table).toContain('revoke all on table public.weight_goals from anon, authenticated;');
    // Zwei Policies (insert, update) und der Trigger (Wächter Z3 M1).
    expect(table.split("public.has_valid_consent('health_data')")).toHaveLength(4);
    // M1: im Trigger zuerst die eigene gültige Einwilligung FOR SHARE sperren, dann erneut prüfen, dann das Abnehmziel.
    const trigger = table.slice(
      table.indexOf('create or replace function private.weight_goals_require_fat_loss()'),
    );
    const lock = trigger.indexOf("c.consent_type = 'health_data' and c.revoked_at is null");
    expect(lock).toBeGreaterThan(0);
    expect(trigger.indexOf('for share', lock)).toBeLessThan(trigger.indexOf('has_valid_consent'));
    expect(trigger.indexOf('has_valid_consent')).toBeLessThan(
      trigger.indexOf('from public.goals g'),
    );
    expect(trigger).toContain('security definer');
    expect(table).toContain('before insert or update on public.weight_goals');
    expect(table).toContain('after update or delete on public.goals');
    expect(table).toContain('Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.');
  });

  it('Widerruf und Export: neueste Fassungen sind Obermengen der Vorgänger (Zeile für Zeile, S16)', () => {
    for (const [marker, newestFile] of [
      [revokeMarker, /_supplement_user_data\.sql$/],
      [exportMarker, /_supplement_user_data\.sql$/],
    ] as const) {
      const withFn = migrationFiles.filter((n) => readMigration(n).includes(marker));
      // Widerruf und Export seit Phase 6 SU3 in *_supplement_user_data.sql (davor Phase 8, Einkaufen E1, E2, 4b Etappe B,
      // Vereinigung E4a + Z3, Wächter E4a H1).
      expect(withFn.at(-1)).toMatch(newestFile);
      const bodyOf = (name: string) => {
        const sql = readMigration(name);
        const start = sql.lastIndexOf(marker);
        return sql.slice(start, sql.indexOf('$$;', start)).split('\n');
      };
      const latest = bodyOf(withFn.at(-1) ?? '');
      const previous = bodyOf(withFn.at(-2) ?? '');
      expect(
        previous.filter((line) => !latest.includes(line) && !latest.includes(`${line},`)),
      ).toEqual([]);
    }
    expect(revokeExport).toContain(
      "'weight_goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.weight_goals t where t.user_id = current_user_id)",
    );
  });

  it('SENSIBEL-Test (Wächter S16, N4): jede Tabelle mit Kommentar-Anfang „SENSIBEL (Art. 9“ wird beim Widerruf ganz gelöscht und exportiert; teilweise sensible nur in fester Ausnahmeliste', () => {
    // Letzter Kommentar je Tabelle (eine spätere Migration kann ihn ändern).
    const comments = new Map<string, string>();
    for (const m of allSql.matchAll(/comment on table public\.([a-z_]+) is\s+'([^']*)'/g)) {
      comments.set(m[1] as string, m[2] as string);
    }
    const revoke = newest(revokeMarker);
    const exported = [...newest(exportMarker).matchAll(/'([a-z_]+)', \(select coalesce/g)].map(
      (m) => m[1],
    );
    const sensitive = [...comments]
      .filter(([, c]) => c.startsWith('SENSIBEL (Art. 9'))
      .map(([t]) => t);
    expect(sensitive.sort()).toEqual(
      [
        'body_measurements',
        'body_metrics',
        'health_screening',
        'weight_goals',
        'user_food_products',
        'shopping_product_links',
        // Phase 8: Puls-Zusammenfassungen und Tageswerte der Smartwatch.
        'heart_rate_summaries',
        'daily_metrics',
        // Phase 6 SU3: Supplement-Check und „Meine Supplements“.
        'supplement_screening',
        'user_supplements',
      ].sort(),
    );
    for (const name of sensitive) {
      expect(revoke, name).toContain(`delete from public.${name} where user_id = new.user_id;`);
      expect(exported, name).toContain(name);
      expect(DATA_EXPORT_TABLES as readonly string[], name).toContain(name);
    }
    // Teilweise sensible Tabellen (Ausnahmeliste) mit ihrer Teil-Löschung. Kommt eine neue Tabelle mit „SENSIBEL“ im
    // Kommentar dazu, muss sie hier (oder oben) eingetragen werden.
    const partial: Record<string, string> = {
      food_preferences:
        "delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';",
      user_plans: 'delete from public.user_plans where user_id = new.user_id and uses_health_data;',
      meal_plans: 'delete from public.meal_plans where user_id = new.user_id and uses_health_data;',
      shopping_lists:
        'delete from public.shopping_lists where user_id = new.user_id and uses_health_data;',
      food_log_entries: 'delete from public.food_log_entries where user_id = new.user_id;',
      // 4b Etappe B: Anpassungen aus Gesundheits-Plänen bzw. mit Körperdaten (PLAN-PHASE-4B 4.7).
      plan_adjustments:
        'delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);',
    };
    const mentioned = [...comments]
      .filter(([, c]) => c.includes('SENSIBEL') && !c.startsWith('SENSIBEL (Art. 9'))
      .map(([t]) => t);
    for (const name of mentioned) {
      expect(Object.keys(partial), name).toContain(name);
    }
    for (const [name, line] of Object.entries(partial)) {
      expect(revoke, name).toContain(line);
      expect(exported, name).toContain(name);
    }
  });

  it('Gesundheitsdaten bleiben aus dem Partner-Modus und aus anon heraus (K7): kein Recht für anon', () => {
    expect(table).not.toMatch(/grant [a-z, ]+ on table public\.weight_goals to anon/);
  });
});

describe('Live-Anpassung in der Datenbank (Phase 4b Etappe B, docs/PLAN-PHASE-4B.md 4.3–4.7)', () => {
  const enumsSql = readMigration('_live_adjust_enums.sql');
  const tables = readMigration('_live_adjust_tables.sql');
  const invariants = readMigration('_live_adjust_invariants.sql');
  const rpcs = readMigration('_live_adjust_rpcs.sql');
  const outbox = readMigration('_live_adjust_outbox.sql');
  const revokeExport = readMigration('_live_adjust_revoke_export.sql');
  const body = (sql: string, name: string) => {
    const start = sql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  /** Jede Zeile der alten Fassung steht in derselben Reihenfolge in der neuen (nur eingefügte Zeilen). */
  const missingLines = (older: string, newer: string) => {
    const next = newer.split('\n');
    let at = 0;
    const missing: string[] = [];
    for (const line of older.split('\n')) {
      const found = next.indexOf(line, at);
      if (found < 0) missing.push(line);
      else at = found + 1;
    }
    return missing;
  };
  const constant = (sql: string, name: string) => {
    const match = new RegExp(`\\b${name} constant [a-z]+ := ([0-9.]+);`).exec(sql);
    if (!match) throw new Error(`${name} nicht gefunden`);
    return Number(match[1]);
  };
  const apply = body(rpcs, 'public.apply_plan_adjustments');
  const assertChange = body(rpcs, 'private.assert_plan_change');

  it.each([
    ['adjustment_trigger', ADJUSTMENT_TRIGGERS],
    ['adjustment_rule', ADJUSTMENT_RULES],
    ['adjustment_kind', ADJUSTMENT_KINDS],
    ['adjustment_status', ADJUSTMENT_STATUSES],
  ] as const)('Enum public.%s = packages/core/src/adjust/types.ts', (name, values) => {
    expect(enumValues(name)).toEqual([...values]);
    expect(enumsSql).toContain(`create type public.${name} as enum (`);
  });

  it('Reihenfolge: Enums → Tabellen → Invarianten → Funktionen → Outbox → Widerruf/Export (nach allen bisherigen)', () => {
    const order = [
      '_live_adjust_enums.sql',
      '_live_adjust_tables.sql',
      '_live_adjust_invariants.sql',
      '_live_adjust_rpcs.sql',
      '_live_adjust_outbox.sql',
      '_live_adjust_revoke_export.sql',
      '_live_adjust_r1_exclusions.sql',
    ].map((suffix) => migrationFiles.findIndex((n) => n.endsWith(suffix)));
    // Unabhängig von der Gesamtzahl: alle vorhanden, in dieser Reihenfolge; die sechs B-Dateien lückenlos hintereinander,
    // der R1-Nachtrag danach (spätere Migrationen anderer Etappen dürfen dazwischen und danach liegen).
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order.every((i, k) => i > (order[k - 1] ?? -1))).toBe(true);
    expect(order[5]! - order[0]!).toBe(5);
  });

  it('apply_plan_adjustments: Feldliste = adjustmentProposalSchema, Arten = RULE_KIND, nur aktive Regeln', () => {
    const keys = /adjustment_keys constant text\[\] := array\[([^\]]*)\]/.exec(apply)?.[1] ?? '';
    const sqlKeys = [...keys.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort();
    const options = (
      adjustmentProposalSchema as unknown as { options: { shape: Record<string, unknown> }[] }
    ).options;
    for (const option of options) {
      expect(Object.keys(option.shape).sort()).toEqual(sqlKeys);
    }
    const kinds = JSON.parse(/rule_kinds constant jsonb := '([^']*)'/.exec(apply)?.[1] ?? '{}');
    expect(kinds).toEqual(RULE_KIND);
    expect(Object.keys(kinds).sort()).toEqual([...ACTIVE_ADJUSTMENT_RULES].sort());
    const fewer = /fewer_days_keys constant text\[\] := array\[([^\]]*)\]/.exec(apply)?.[1] ?? '';
    expect([...fewer.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual(
      Object.keys(fewerDaysChangeSchema.shape),
    );
  });

  it('Vorher/Nachher-Felder je Regel ⊆ Zod-Schema (planChangeSchema), Zustands-Vorgabe = stateOverrideSchema', () => {
    const sessionShape = planChangeSchema.shape.sessions.element.shape;
    const exerciseShape = sessionShape.exercises.unwrap().element.shape;
    const sessionKeys = JSON.parse(
      /rule_session_keys constant jsonb := '([^']*)'/.exec(assertChange)?.[1] ?? '{}',
    );
    const exerciseKeys = JSON.parse(
      /rule_exercise_keys constant jsonb := '([^']*)'/.exec(assertChange)?.[1] ?? '{}',
    );
    for (const list of Object.values(sessionKeys) as string[][]) {
      for (const key of list) expect(Object.keys(sessionShape)).toContain(key);
    }
    for (const list of Object.values(exerciseKeys) as string[][]) {
      for (const key of list) expect(Object.keys(exerciseShape)).toContain(key);
    }
    expect(Object.keys(sessionKeys).sort()).toEqual(
      Object.entries(RULE_KIND)
        .filter(([, kind]) => kind === 'plan_change')
        .map(([rule]) => rule)
        .sort(),
    );
    expect(tables).toContain(
      `= array['${Object.keys(stateOverrideSchema.shape).sort().join("', '")}']`,
    );
    expect(tables).toContain(
      `cardinality(planned_session_ids) <= ${LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment}`,
    );
  });

  it('SQL-Konstanten = LIVE_ADJUSTMENT und Grenzwerte in constants.ts', () => {
    expect(constant(apply, 'max_per_batch')).toBe(LIVE_ADJUSTMENT.maxPerBatch);
    expect(constant(apply, 'max_sessions')).toBe(LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment);
    expect(constant(assertChange, 'max_sessions')).toBe(
      LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment,
    );
    expect(constant(apply, 'max_automatic_per_week')).toBe(LIVE_ADJUSTMENT.maxAutomaticPerWeek);
    expect(constant(apply, 'proposal_expires_days')).toBe(LIVE_ADJUSTMENT.proposalExpiresDays);
    expect(constant(apply, 'load_reduce_factor')).toBe(LIVE_ADJUSTMENT.loadReduce.factor);
    expect(constant(apply, 'hold_min_s')).toBe(LIVE_ADJUSTMENT.loadReduce.holdMinS);
    expect(constant(apply, 'max_increase_fraction')).toBe(LOAD_PROGRESSION.maxIncreaseFraction);
    expect(constant(apply, 'max_increase_fraction')).toBe(
      LIVE_ADJUSTMENT.fastIncrease.maxStepFraction,
    );
    expect(constant(apply, 'extra_reps_buffer')).toBe(LOAD_PROGRESSION.extraRepsBuffer);
    expect(constant(assertChange, 'sets_reduction')).toBe(
      LIVE_ADJUSTMENT.highSessionLoad.setsReduction,
    );
    expect(constant(assertChange, 'min_sets_compound')).toBe(SESSION_FIT.minSetsCompound);
    expect(constant(assertChange, 'min_sets_isolation')).toBe(SESSION_FIT.minSetsIsolation);
    expect(constant(assertChange, 'min_session_minutes')).toBe(
      ENDURANCE_SESSION_LIMITS.minSessionMinutes,
    );
    // Ratenbegrenzung (Wächter S3).
    expect(constant(body(rpcs, 'public.claim_adjustment_events'), 'max_per_user_per_hour')).toBe(
      LIVE_ADJUSTMENT.recompute.maxPerUserPerHour,
    );
  });

  it('Wochen-Invarianten: SQL-Konstanten = checkWeekInvariants (DELOAD_DOSAGE, 10-%-Regel, Erholungs-Faktoren)', () => {
    const fn = body(invariants, 'private.week_invariant_violations');
    expect(constant(fn, 'deload_sets_factor')).toBe(DELOAD_DOSAGE.setsFactor);
    expect(constant(fn, 'deload_rpe_reduction')).toBe(DELOAD_DOSAGE.rpeReduction);
    expect(constant(fn, 'rpe_min')).toBe(TEMPLATE_DOSAGE_LIMITS.rpe.min);
    expect(constant(fn, 'min_session_minutes')).toBe(ENDURANCE_SESSION_LIMITS.minSessionMinutes);
    expect(constant(fn, 'increase_percent')).toBe(
      Math.round((1 + MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION) * 100),
    );
    expect(constant(fn, 'deload_volume_percent')).toBe(
      Math.round(ENDURANCE_DELOAD_VOLUME_FACTOR * 100),
    );
    expect(constant(fn, 'competition_deload_percent')).toBe(
      Math.round(COMPETITION_DELOAD_MAX_FACTOR * 100),
    );
    // Neueste Fassung seit Fit im Alter FA1 (Ziel `active_aging` → vorsichtiger Erholungs-Rhythmus, Wächter N1).
    const loadWeeks = body(readMigration('_active_aging_rules.sql'), 'private.plan_load_weeks');
    expect(missingLines(body(invariants, 'private.plan_load_weeks'), loadWeeks)).toEqual([]);
    expect(loadWeeks).toContain(
      `when p.inputs ->> 'goalType' = 'active_aging' then ${ACTIVE_AGING_RULES.deloadLoadWeeks}`,
    );
    expect(loadWeeks).toContain(
      `when not p.uses_health_data or p.medical_notice then ${DELOAD_SCHEDULE.cautious}`,
    );
    expect(loadWeeks).toContain(
      `when p.inputs ->> 'experienceLevel' = 'beginner' then ${DELOAD_SCHEDULE.beginner}`,
    );
    expect(loadWeeks).toContain(`else ${DELOAD_SCHEDULE.advanced}`);
  });

  it('R1-Ausschlüsse (Nachtrag): Server-Liste = FAST_INCREASE_EXCLUSIONS, Grenzen = AGE_PLAN_RULES, Aufruf abgelehnt', () => {
    const r1 = readMigration('_live_adjust_r1_exclusions.sql');
    // Neueste Fassung des Helfers seit Fit im Alter FA1 (Grund 'active_aging'): Obermenge der Fassung aus dem Nachtrag.
    const helper = body(
      readMigration('_active_aging_rules.sql'),
      'private.fast_increase_exclusion',
    );
    expect(missingLines(body(r1, 'private.fast_increase_exclusion'), helper)).toEqual(
      // nur die Auswahl-Zeile bekommt ein Komma und die neue Spalte goalType
      ["  select p.uses_health_data, p.medical_notice, p.inputs ->> 'experienceLevel' as level"],
    );
    // Gründe in derselben Reihenfolge wie Core (erster zutreffender gewinnt), keine weiteren.
    const reasons = [...helper.matchAll(/return '([a-z_]+)';/g)].map((m) => m[1]);
    expect([...new Set(reasons)]).toEqual([...FAST_INCREASE_EXCLUSIONS]);
    expect(helper).toContain('return null;');
    expect(constant(helper, 'minor_below_age')).toBe(AGE_PLAN_RULES.minor.belowAge);
    expect(constant(helper, 'senior_from_age')).toBe(AGE_PLAN_RULES.senior.fromAge);
    const levels =
      /non_beginner_levels constant text\[\] := array\[([^\]]*)\]/.exec(helper)?.[1] ?? '';
    expect([...levels.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual(
      enums.EXPERIENCE_LEVELS.filter((level) => level !== 'beginner'),
    );
    // Vorsichtig wie plan_load_weeks (Plan) UND wie planSafetyRules (aktueller Check, Einwilligung).
    expect(helper).toContain('if not v_plan.uses_health_data or v_plan.medical_notice then');
    expect(helper).toContain('if not found or cardinality(latest_flags) > 0');
    expect(helper).toContain("or not private.has_valid_consent_for(p_user, 'health_data') then");
    expect(helper).toContain('extract(year from age(p_today, pr.birth_date))');
    expect(r1).toContain(
      'revoke all on function private.fast_increase_exclusion(uuid, uuid, date) from public, anon, authenticated;',
    );
    // apply_plan_adjustments: neueste Fassung hier, Obermenge der Etappe-B-Fassung (nur eingefügte Zeilen).
    const newest = body(r1, 'public.apply_plan_adjustments');
    expect(missingLines(apply, newest)).toEqual([]);
    expect(
      migrationFiles
        .filter((n) =>
          readMigration(n).includes('create or replace function public.apply_plan_adjustments('),
        )
        .at(-1),
    ).toMatch(/_live_adjust_r1_exclusions\.sql$/);
    expect(newest).toContain(
      'r1_exclusion := private.fast_increase_exclusion(p_user, v_plan_id, today);',
    );
    expect(newest).toContain("perform private.adjust_assert(r1_exclusion is null, 'not_allowed');");
    expect(newest).toContain("if err = 'not_allowed' then");
    // Prüfung vor der Idempotenz: auch ein Duplikat lehnt den Aufruf ab.
    expect(newest.indexOf("'not_allowed');")).toBeLessThan(newest.indexOf('-- Idempotenz'));
    expect(r1).toContain(
      'revoke all on function public.apply_plan_adjustments(uuid, jsonb) from public, anon, authenticated;',
    );
    expect(r1).toContain(
      'grant execute on function public.apply_plan_adjustments(uuid, jsonb) to service_role;',
    );
  });

  it('pgTAP 50_week_invariants.test.sql ist aus invariants.json aktuell erzeugt (Core = SQL)', () => {
    const fixtures = JSON.parse(
      readFileSync(new URL('./adjust/fixtures/invariants.json', import.meta.url), 'utf8'),
    ) as InvariantFixture[];
    const file = readFileSync(
      new URL('../../../supabase/tests/50_week_invariants.test.sql', import.meta.url),
      'utf8',
    );
    expect(file).toBe(weekInvariantsTestSql(fixtures));
  });

  it('Outbox: neueste Fassungen sind Obermengen der Vorgänger und schreiben nur über enqueue (nur Premium, S2)', () => {
    const enqueue = body(rpcs, 'private.enqueue_adjustment_event');
    expect(enqueue).toContain("not private.feature_enabled('live_adjustment')");
    expect(enqueue).toContain("not private.has_entitlement_for(p_user_id, 'premium')");
    expect(enqueue).toContain('when others then');
    for (const [name, previous] of [
      ['public.save_session_log', '_tracked_route_rpcs.sql'],
      ['public.replace_training_slots', '_training_slots.sql'],
      ['public.save_training_plan', '_training_log_rpcs.sql'],
      ['public.append_plan_block', '_meal_plan_rpcs.sql'],
    ] as const) {
      expect(missingLines(body(readMigration(previous), name), body(outbox, name)), name).toEqual(
        [],
      );
      const newest = migrationFiles.filter((n) =>
        readMigration(n).includes(`create or replace function ${name}(`),
      );
      expect(newest.at(-1), name).toMatch(/_live_adjust_outbox\.sql$/);
    }
    for (const [name, trigger] of [
      ['public.save_session_log', 'session_logged'],
      ['public.close_missed_sessions', 'session_missed'],
      ['public.replace_training_slots', 'slots_changed'],
    ] as const) {
      expect(body(outbox, name)).toContain(
        `private.enqueue_adjustment_event(current_user_id, '${trigger}'`,
      );
    }
    for (const table of ['body_measurements', 'body_metrics', 'goals', 'weight_goals']) {
      expect(outbox).toContain(`after insert or update on public.${table}`);
    }
    expect(body(outbox, 'public.append_plan_block')).toContain(
      "v ->> 'code' = 'too_many_load_weeks'",
    );
  });

  it('beta_admin (4b): Obermenge der E4a-Fassung bis auf die Flag-Liste; Flag live_adjustment startet AUS', () => {
    const e4a = body(readMigration('_food_products.sql'), 'public.beta_admin');
    expect(missingLines(e4a, body(rpcs, 'public.beta_admin'))).toEqual([
      "     or p_flag is null or p_flag not in ('ai_food_photo') then",
    ]);
    expect(tables).toContain(
      "insert into private.feature_flags (key, enabled) values ('live_adjustment', false)",
    );
  });

  it('Widerruf und Export (4.7, K4): Anpassungen zuerst und am Ende gelöscht; Export mit Anpassungen, Ereignissen, Zählern', () => {
    const revoke = body(revokeExport, 'private.consents_after_revoke');
    const line =
      'delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);';
    expect(revoke.split(line)).toHaveLength(3);
    expect(revoke.indexOf(line)).toBeLessThan(
      revoke.indexOf(
        'delete from public.user_plans where user_id = new.user_id and uses_health_data;',
      ),
    );
    const exported = body(revokeExport, 'public.export_my_data');
    for (const key of [
      'plan_adjustments',
      'adjustment_events',
      'live_adjust_hourly_counts',
      'beta_entitlements',
    ]) {
      expect(exported).toContain(`'${key}', (select coalesce(`);
    }
    // Ereignisse im Export ohne Verweise (ref_id) und ohne Fehlercode.
    const events = body(revokeExport, 'private.my_adjustment_events');
    expect(events).not.toContain('ref_id');
    expect(events).not.toContain('last_error_code');
  });
});

describe('Testphase „alles offen“ (Gründer 19.10.2026, KONZEPT 13)', () => {
  const open = readMigration('_premium_open.sql');
  const body = (sql: string, name: string) => {
    const start = sql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  /** Jede Zeile der alten Fassung steht in derselben Reihenfolge in der neuen (nur eingefügte Zeilen). */
  const missingLines = (older: string, newer: string) => {
    const next = newer.split('\n');
    let at = 0;
    const missing: string[] = [];
    for (const line of older.split('\n')) {
      const found = next.indexOf(line, at);
      if (found < 0) missing.push(line);
      else at = found + 1;
    }
    return missing;
  };
  const newestFile = (name: string) =>
    migrationFiles
      .filter((n) => readMigration(n).includes(`create or replace function ${name}(`))
      .at(-1);

  it('Flag premium_open startet AN (per Migration gesetzt)', () => {
    expect(open).toContain(
      "insert into private.feature_flags (key, enabled) values ('premium_open', true)",
    );
  });

  it.each([
    [
      'private.has_entitlement_for',
      '_ai_food_photo.sql',
      "private.feature_enabled('premium_open')",
    ],
    ['public.ai_food_photo_reserve', '_ai_food_photo.sql', "hashtext('ai_food_photo|global')"],
    ['public.beta_admin', '_live_adjust_rpcs.sql', "if p_flag = 'premium_open' then"],
  ] as const)(
    '%s: Obermenge der Vorgänger-Fassung; spätere Fassungen behalten die Testphase',
    (name, previous, key) => {
      expect(missingLines(body(readMigration(previous), name), body(open, name))).toEqual([]);
      // Wächter N4: unabhängig von parallelen Branches – nur eigene Reihenfolge prüfen.
      const files = migrationFiles.filter((n) =>
        readMigration(n).includes(`create or replace function ${name}(`),
      );
      const own = files.findIndex((n) => n.endsWith('_premium_open.sql'));
      expect(own).toBeGreaterThan(files.findIndex((n) => n.endsWith(previous)));
      for (const later of files.slice(own)) expect(body(readMigration(later), name)).toContain(key);
      expect(newestFile(name)).toBeDefined();
    },
  );

  it('globale KI-Kostenbremse (M1) = AI_GLOBAL_BUDGET, nur solange premium_open an ist', () => {
    const { monthlyCallsCap, monthlyCostEurCap } = AI_GLOBAL_BUDGET.food_photo;
    expect(open).toContain(
      `insert into private.ai_budget (feature, monthly_calls_cap, monthly_cost_eur_cap) values ('food_photo', ${monthlyCallsCap}, ${monthlyCostEurCap})`,
    );
    const reserve = body(open, 'public.ai_food_photo_reserve');
    expect(reserve.indexOf("if private.feature_enabled('premium_open') then")).toBeLessThan(
      reserve.indexOf("hashtext('ai_food_photo|global')"),
    );
    expect(reserve).toContain("return jsonb_build_object('result', 'flag_off');");
  });

  it('Premium offen nur für premium, nur mit Flag und nur für bestehende Konten; Limits ohne Beta-Zeile = Standard', () => {
    const entitlement = body(open, 'private.has_entitlement_for');
    expect(entitlement).toContain("p_entitlement = 'premium'");
    expect(entitlement).toContain("private.feature_enabled('premium_open')");
    expect(entitlement).toContain('select 1 from auth.users u');
    const reserve = body(open, 'public.ai_food_photo_reserve');
    expect(reserve).toContain('monthly_limit := coalesce(monthly_limit, default_monthly_limit);');
    expect(reserve).toContain('daily_limit := coalesce(daily_limit, default_daily_limit);');
    expect(body(open, 'public.beta_admin')).toContain(
      'return private.premium_open_flag_admin(p_action, p_actor);',
    );
  });
});

describe('Workout-Bibliothek (20261020150100_workouts.sql)', () => {
  const sql = readMigration('_workouts.sql');
  it('Grenzen der Tabelle = WORKOUT_LIMITS', () => {
    const L = WORKOUT_LIMITS;
    expect(sql).toContain(`check (difficulty between ${L.stars.min} and ${L.stars.max})`);
    expect(sql).toContain(`check (minutes between ${L.minutes.min} and ${L.minutes.max})`);
    expect(sql).toContain(
      `cardinality(exercise_ids) between ${L.exercises.min} and ${L.exercises.max}`,
    );
    expect(L.exercises.max).toBe(SESSION_LOG_LIMITS.exercisesPerSession.max);
    expect(L.rounds.max).toBe(SESSION_LOG_LIMITS.setsPerExercise.max);
  });
  it('Herkunft „workout“ setzt nur mark_session_log_workout an freien Kraft-Einheiten', () => {
    expect(sql).toContain("existing.kind <> 'strength'");
    expect(sql).toContain('not existing.is_free');
    expect(enums.LOG_SOURCES).toContain('workout');
  });
});

describe('Smartwatch über Health Connect (Phase 8 Etappe H2, docs/PLAN-PHASE-8.md 4–6)', () => {
  const enumsSql = readMigration('_wearable_enums.sql');
  const sql = readMigration('_wearables.sql');
  const revokeExport = readMigration('_wearable_revoke_export.sql');
  const fnBody = (name: string) => {
    const start = sql.indexOf(`create or replace function ${name}(`);
    expect(start, name).toBeGreaterThanOrEqual(0);
    return sql.slice(start, sql.indexOf('$$;', start));
  };
  const importFn = fnBody('public.import_wearable_batch');
  const quoted = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const keysOf = (name: string) => {
    const match = new RegExp(`${name} constant text\\[\\] := array\\[([^\\]]*)\\]`).exec(importFn);
    if (!match) throw new Error(name);
    return quoted(match[1] as string);
  };

  it('Enum-Werte in eigener Datei VOR ihrer Verwendung', () => {
    expect(enumsSql).toContain("alter type public.consent_type add value 'wearable_data';");
    expect(enumsSql).toContain("alter type public.log_source add value 'health_connect';");
    const names = migrationFiles;
    const enumsIdx = names.findIndex((n) => n.endsWith('_wearable_enums.sql'));
    expect(enumsIdx).toBeGreaterThan(-1);
    expect(names.findIndex((n) => n.endsWith('_wearables.sql'))).toBe(enumsIdx + 1);
    expect(names.findIndex((n) => n.endsWith('_wearable_revoke_export.sql'))).toBe(enumsIdx + 2);
    // Vor der Enum-Datei nutzt keine Migration die neuen Werte (adjustment_trigger 'wearable_data' ist ein anderes Enum).
    const before = names
      .slice(0, enumsIdx)
      .map((n) => readMigration(n))
      .join('\n');
    expect(before).not.toContain("'health_connect'");
    expect(before).not.toMatch(/consent_type[^;]*'wearable_data'/);
  });

  it('Feldlisten = Zod-Schemas (Batch, Einheit, Puls, Tag)', () => {
    expect(keysOf('batch_keys')).toEqual(Object.keys(wearableImportBatchSchema.shape));
    expect(keysOf('session_keys')).toEqual(Object.keys(wearableSessionImportSchema.shape));
    expect(keysOf('heart_rate_keys')).toEqual(Object.keys(heartRateSummarySchema.shape));
    expect(keysOf('day_keys')).toEqual(Object.keys(dailyMetricImportSchema.shape));
  });

  it('Listen = packages/core (Datentypen, Herkunft, Gruppen, Titel-Regel, feste Namen)', () => {
    const typesList = `array[${WEARABLE_DATA_TYPES.map((t) => `'${t}'`).join(', ')}]::text[]`;
    expect(sql).toContain(typesList);
    expect(sql).toContain(`not in (${WEARABLE_DATA_TYPES.map((t) => `'${t}'`).join(', ')})`);
    expect(sql).toContain(`cardinality(granted_types) <= ${WEARABLE_DATA_TYPES.length}`);
    expect(sql).toContain(`jsonb_array_length(p_types) <= ${WEARABLE_DATA_TYPES.length}`);
    const origins = WEARABLE_ORIGINS.map((o) => `'${o}'`).join(', ');
    expect(sql).toContain(`check (origin in (${origins}))`);
    expect(importFn).toContain(`origins constant text[] := array[${origins}];`);
    expect(importFn).toContain(
      `not in (${WEARABLE_SESSION_GROUPS.map((g) => `'${g}'`).join(', ')})`,
    );
    expect(importFn).toContain(`name_pattern constant text := '${WEARABLE_NAME_PATTERN}';`);
    const names = JSON.parse(
      /group_names constant jsonb := '([^']*)'/.exec(importFn)?.[1] ?? '{}',
    ) as Record<string, string>;
    expect(names).toEqual({
      ...FREE_SESSION.names.endurance,
      strength: FREE_SESSION.names.strength,
    });
  });

  it('Grenzen = WEARABLE_SYNC, HEART_RATE_LIMITS, DAILY_METRIC_LIMITS', () => {
    const S = WEARABLE_SYNC;
    for (const expected of [
      `max_sessions constant integer := ${S.maxSessionsPerBatch};`,
      `max_days constant integer := ${S.maxDaysPerBatch};`,
      `import_max_age_days constant integer := ${S.importMaxAgeDays};`,
      `clock_skew_s constant integer := ${S.clockSkewS};`,
      `payload_max_bytes constant integer := ${S.payloadMaxBytes};`,
      `char_length(s ->> 'external_id') not between 1 and ${S.externalIdMaxLength}`,
      `jsonb_number_between(s -> 'duration_s', ${S.durationS.min}, ${S.durationS.max}, 0)`,
      `jsonb_number_between(s -> 'distance_m', ${S.distanceM.min}, ${S.distanceM.max}, 0)`,
      `jsonb_number_between(s -> 'kcal', ${S.kcal.min}, ${S.kcal.max}, 0)`,
      `jsonb_number_between(hr -> 'avg_bpm', ${HEART_RATE_LIMITS.sampleBpm.min}, ${HEART_RATE_LIMITS.sampleBpm.max}, 0)`,
      `jsonb_number_between(hr -> 'max_bpm', ${HEART_RATE_LIMITS.sampleBpm.min}, ${HEART_RATE_LIMITS.sampleBpm.max}, 0)`,
      `jsonb_number_between(hr -> 'hf_max_used', ${HEART_RATE_LIMITS.maxOverrideBpm.min}, ${HEART_RATE_LIMITS.maxOverrideBpm.max}, 0)`,
      `jsonb_number_between(z, 0, ${S.durationS.max}, 0)`,
      `jsonb_number_between(d -> 'resting_hr_bpm', ${DAILY_METRIC_LIMITS.restingHrBpm.min}, ${DAILY_METRIC_LIMITS.restingHrBpm.max}, 0)`,
      `jsonb_number_between(d -> 'sleep_min', ${DAILY_METRIC_LIMITS.sleepMin.min}, ${DAILY_METRIC_LIMITS.sleepMin.max}, 0)`,
      `jsonb_number_between(d -> 'steps', ${DAILY_METRIC_LIMITS.steps.min}, ${DAILY_METRIC_LIMITS.steps.max}, 0)`,
    ]) {
      expect(importFn, expected).toContain(expected);
    }
    for (const expected of [
      `check (resting_hr_bpm between ${DAILY_METRIC_LIMITS.restingHrBpm.min} and ${DAILY_METRIC_LIMITS.restingHrBpm.max})`,
      `check (sleep_min between ${DAILY_METRIC_LIMITS.sleepMin.min} and ${DAILY_METRIC_LIMITS.sleepMin.max})`,
      `check (steps between ${DAILY_METRIC_LIMITS.steps.min} and ${DAILY_METRIC_LIMITS.steps.max})`,
      `check (avg_bpm between ${HEART_RATE_LIMITS.sampleBpm.min} and ${HEART_RATE_LIMITS.sampleBpm.max})`,
      `check (hf_max_used between ${HEART_RATE_LIMITS.maxOverrideBpm.min} and ${HEART_RATE_LIMITS.maxOverrideBpm.max})`,
      `check (kcal between ${S.kcal.min} and ${S.kcal.max})`,
      `check (char_length(external_id) between 1 and ${S.externalIdMaxLength})`,
      `last_sync_count integer check (last_sync_count between 0 and ${S.maxSessionsPerBatch})`,
    ]) {
      expect(sql, expected).toContain(expected);
    }
    // Ruhepuls wie die Körperdaten (Onboarding).
    expect(DAILY_METRIC_LIMITS.restingHrBpm).toEqual(BODY_METRIC_LIMITS.restingHeartRateBpm);
  });

  it('RLS: nur eigene Zeilen lesen, kein Schreib-Recht, je Tabelle genau eine Policy', () => {
    for (const table of [
      'wearable_connections',
      'wearable_sessions',
      'heart_rate_summaries',
      'daily_metrics',
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
      expect(sql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated;`,
      );
      expect(sql).toContain(`grant select on table public.${table} to authenticated;`);
      expect(sql.split(`on public.${table} for select to authenticated`)).toHaveLength(2);
      expect(allSql).not.toMatch(
        new RegExp(`grant (insert|update|delete|all) on table public\\.${table} to authenticated`),
      );
    }
    expect(sql.match(/using \(user_id = \(select auth\.uid\(\)\)\)/g)).toHaveLength(4);
  });

  it('Einwilligung zuerst gesperrt, dann geprüft, dann Person (Wächter N7 S2); beide Einwilligungen nötig', () => {
    const locked = fnBody('private.wearable_consents_locked');
    expect(locked.indexOf('for share')).toBeLessThan(locked.indexOf('has_valid_consent'));
    expect(locked).toContain(
      "public.has_valid_consent('wearable_data') and public.has_valid_consent('health_data')",
    );
    for (const name of ['public.import_wearable_batch', 'public.connect_wearable']) {
      const body = fnBody(name);
      expect(body.indexOf('wearable_consents_locked'), name).toBeGreaterThan(0);
      expect(body.indexOf('wearable_consents_locked'), name).toBeLessThan(
        body.indexOf('pg_advisory_xact_lock'),
      );
    }
    // Trennen geht immer (Recht auf Löschung) – ohne Einwilligung.
    expect(fnBody('public.disconnect_wearable')).not.toContain('wearable_consents_locked');
  });

  it('Widerruf (wearable_data oder health_data) löscht Puls, Tageswerte, Verbindung; Einheiten bleiben', () => {
    const start = revokeExport.indexOf(
      'create or replace function private.consents_after_revoke()',
    );
    const body = revokeExport.slice(start, revokeExport.indexOf('$$;', start));
    const block = body.slice(
      body.indexOf("if new.consent_type in ('health_data', 'wearable_data') then"),
    );
    for (const table of ['heart_rate_summaries', 'daily_metrics', 'wearable_connections']) {
      expect(block).toContain(`delete from public.${table} where user_id = new.user_id;`);
    }
    expect(body).not.toContain('delete from public.wearable_sessions');
  });

  it('Trennen löscht Puls IMMER (W8-12), Einträge nur auf Wunsch und nie zusammengeführte App-Einträge', () => {
    const body = fnBody('public.disconnect_wearable');
    const always = body.slice(0, body.indexOf('if p_delete_imported then'));
    expect(always).toContain('delete from public.heart_rate_summaries');
    expect(always).toContain('delete from public.daily_metrics');
    expect(body).toContain('and not ws.merged');
  });

  it('save_session_log bleibt unangetastet (neue Herkunft nur über import_wearable_batch)', () => {
    expect(sql).not.toContain('function public.save_session_log(');
    expect(revokeExport).not.toContain('function public.save_session_log(');
    expect(importFn).toContain("'health_connect', now()");
  });
});

describe('Supplement-Modul in der Datenbank (Phase 6, Etappe SU3, docs/PLAN-PHASE-6.md 7)', () => {
  const enumsSql = readMigration('_supplement_enums.sql');
  const contentSql = readMigration('_supplements.sql');
  const userSql = readMigration('_supplement_user_data.sql');
  const enumValues = (name: string) =>
    quotedListAfter(enumsSql, `create type public.${name} as enum (`);

  it('Aufzählungen = Listen im Core', () => {
    expect(enumValues('supplement_id')).toEqual([...SUPPLEMENT_IDS]);
    expect(enumValues('supplement_evidence')).toEqual([...SUPPLEMENT_EVIDENCE_LEVELS]);
    expect(enumValues('supplement_category')).toEqual([...SUPPLEMENT_CONTENT_CATEGORIES]);
    expect(enumValues('supplement_flag')).toEqual([...SUPPLEMENT_FLAGS]);
    expect(enumValues('user_supplement_status')).toEqual([...USER_SUPPLEMENT_STATUSES]);
  });

  it('seed_supplements kennt genau SUPPLEMENT_CONTENT_IDS; Grenzen wie das Schema', () => {
    expect(quotedListAfter(contentSql, 'known_ids constant text[] := array[')).toEqual([
      ...SUPPLEMENT_CONTENT_IDS,
    ]);
    const { min, max } = CONTENT_SCHEMA_LIMITS.version;
    expect(contentSql).toContain(
      `version integer not null check (version between ${min} and ${max})`,
    );
    expect(contentSql).toContain("check (status <> 'draft')");
    expect(contentSql).toContain('private.content_without_reviewer_names(x)');
  });

  it('Trigger des Supplement-Checks = evaluateSupplementScreening (Fragen, Reihenfolge, Eiweiß-Antworten)', () => {
    expect(quotedListAfter(userSql, 'flag_questions constant text[] := array[')).toEqual([
      ...SUPPLEMENT_SCREENING_QUESTIONS.map((q) => q.id),
    ]);
    expect(SUPPLEMENT_SCREENING_QUESTIONS.map((q) => q.flag)).toEqual([...SUPPLEMENT_FLAGS]);
    expect(quotedListAfter(userSql, 'protein_answers constant text[] := array[')).toEqual([
      ...PROTEIN_SELF_CHECK_ANSWERS,
    ]);
    expect(userSql).toContain(
      `screening_version constant smallint := ${SUPPLEMENT_SCREENING_VERSION};`,
    );
    expect(userSql).toContain(
      `min_version constant integer := ${SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION};`,
    );
    // Stillzeit-Frage nicht bei „männlich“ (createSupplementScreeningAnswersSchema).
    expect(userSql).toContain("person_sex = 'male' and new.answers ? 'breastfeeding'");
  });

  it('Einwilligung health_data Fassung 2 als Entwurf (published_at NULL); Schreiben nur über RPCs mit Sperre', () => {
    const seed = userSql.slice(
      userSql.indexOf('insert into public.consent_documents'),
      userSql.indexOf('on conflict (consent_type, version) do nothing;'),
    );
    expect(seed).toContain("'health_data',\n  2,");
    expect(seed.trimEnd().endsWith('null\n)')).toBe(true);
    const lock = userSql.indexOf('for share');
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(userSql.indexOf("not public.has_valid_consent('health_data')"));
    for (const table of ['supplement_screening', 'user_supplements']) {
      expect(userSql).toContain(`alter table public.${table} enable row level security;`);
      expect(userSql).toContain(
        `revoke all on table public.${table} from public, anon, authenticated;`,
      );
      expect(userSql).toContain(`grant select on table public.${table} to authenticated;`);
    }
    expect(userSql).toContain("check (supplement_id <> 'caffeine')");
  });
});

describe('Fit im Alter FA1 in der Datenbank (docs/PLAN-FIT-IM-ALTER.md 8.3)', () => {
  const sql = readMigration('_active_aging_rules.sql');
  const fn = (name: string) => {
    const start = sql.lastIndexOf(`create or replace function ${name}(`);
    if (start < 0) throw new Error(`${name} nicht gefunden`);
    return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
  };
  const constant = (body: string, name: string) => {
    const match = new RegExp(`\\b${name} constant [a-z]+ := ([0-9.]+);`).exec(body);
    if (!match) throw new Error(`${name} nicht gefunden`);
    return Number(match[1]);
  };

  it('Enum-Werte stehen in einer EIGENEN Migration vor den Regeln', () => {
    const enumsFile = migrationFiles.find((name) => name.endsWith('_active_aging_enums.sql'));
    const rulesFile = migrationFiles.find((name) => name.endsWith('_active_aging_rules.sql'));
    expect(enumsFile).toBeDefined();
    expect(rulesFile).toBeDefined();
    expect((enumsFile as string) < (rulesFile as string)).toBe(true);
    const enumsSql = readMigration('_active_aging_enums.sql');
    expect(enumsSql).not.toMatch(/create (or replace )?(function|trigger|table)/);
  });

  it('Übungs-Schutz = ACTIVE_AGING_RULES (RPE, Haltezeit, ausgeschlossene Merkmale)', () => {
    const guard = fn('private.planned_exercise_active_aging_guard');
    expect(constant(guard, 'active_aging_rpe_max')).toBe(ACTIVE_AGING_RULES.rpeMax);
    expect(constant(guard, 'active_aging_hold_max_s')).toBe(ACTIVE_AGING_RULES.strengthHoldMaxS);
    const tags =
      /active_aging_excluded_tags constant public\.caution_tag\[\] := array\[([^\]]*)\]/.exec(
        guard,
      )?.[1];
    expect([...(tags ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
      ...ACTIVE_AGING_RULES.excludedCautionTags,
    ]);
    expect(sql).toContain(
      'before insert or update of exercise_id, rpe_target, duration_s, session_id on public.planned_exercises',
    );
  });

  it('Einheiten-Schutz = ACTIVE_AGING_RULES.enduranceEffortMax, kein Laufen, kein Wettkampf', () => {
    const guard = fn('private.planned_session_active_aging_guard');
    expect(constant(guard, 'active_aging_effort_max')).toBe(ACTIVE_AGING_RULES.enduranceEffortMax);
    expect(guard).toContain("new.endurance_modality = 'run'");
    expect(guard).toContain('new.workout_type is not null');
  });

  it('Schutz-Funktionen: security definer, search_path leer, kein Recht für anon/authenticated', () => {
    for (const name of [
      'private.is_active_aging_plan',
      'private.planned_exercise_active_aging_guard',
      'private.planned_session_active_aging_guard',
    ]) {
      const body = fn(name);
      expect(body, name).toContain('security definer');
      expect(body, name).toContain("set search_path = ''");
      expect(sql, name).toMatch(
        new RegExp(
          `revoke all on function ${name.replace('.', '\\.')}\\([^)]*\\) from public, anon, authenticated;`,
        ),
      );
    }
  });

  it('R1-Ausschluss prüft Ziel des Plans UND aktuelles Hauptziel', () => {
    const helper = fn('private.fast_increase_exclusion');
    expect(helper).toContain("p.inputs ->> 'goalType' as goal");
    expect(helper).toContain("if v_plan.goal = 'active_aging'");
    expect(helper).toContain("g.goal_type = 'active_aging'");
  });
});
