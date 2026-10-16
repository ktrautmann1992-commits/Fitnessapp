/**
 * Prüft, dass Code (packages/core) und Datenbank (supabase/migrations) dieselben Listen und Grenzen nutzen.
 * Ändert jemand nur eine Seite, schlägt dieser Test fehl.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MEASUREMENT_SITES } from './body-measurements';
import { CURRENT_CONSENT_VERSIONS } from './consent';
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
  FREE_SESSION,
  SESSION_RPE_LIMITS,
  SET_RPE_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
  BODY_MEASUREMENT_LIMITS,
  CONTENT_SCHEMA_LIMITS,
  FOOD_LOG_LIMITS,
  AI_FOOD_PHOTO,
  CUSTOM_MEAL_LIMITS,
  PINCH_G,
  BODY_METRIC_LIMITS,
  AGE_PLAN_RULES,
  COMPETITION_DISTANCE_M,
  COMPETITION_EFFORT_LIMITS,
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
  ROUTE_FILTER,
  TRACKED_ROUTE_LIMITS,
  TRACKED_ROUTE_LOG_MATCH,
} from './constants';
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
import { DATA_EXPORT_TABLES } from './export/data-export';
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
import { FOOD_GROUPS } from './food-groups';
import { GOAL_COMBINATIONS } from './goals/profile';
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

  it('private.goal_pair_allowed = GOAL_COMBINATIONS (Paarliste aus der Migration gelesen)', () => {
    const body = goalsSql.slice(
      goalsSql.indexOf('create or replace function private.goal_pair_allowed('),
    );
    const list = body.slice(body.indexOf(' in ('), body.indexOf('$$;'));
    const pairs = [...list.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map(
      (match) => `${match[1]}>${match[2]}`,
    );
    expect(pairs.sort()).toEqual(
      GOAL_COMBINATIONS.map(([primary, secondary]) => `${primary}>${secondary}`).sort(),
    );
    expect(pairs).toHaveLength(10);
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

  it('neueste save_session_log-Fassung steht in *_tracked_route_rpcs.sql (S1, davor A1b)', () => {
    expect(saveFile).toMatch(/_tracked_route_rpcs\.sql$/);
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
    // Neueste Fassung seit Phase 10 WP3 in *_competition_rpcs.sql (E1: Tagebuch-Einträge, E2: eigene Gerichte,
    // WP3: Plan-Bezug der Wettkämpfe leeren).
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_competition_rpcs\.sql$/,
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
  const entriesE2 = readMigration('_food_log_photo.sql').slice(
    readMigration('_food_log_photo.sql').indexOf('alter table public.food_log_entries'),
  );
  const L = FOOD_LOG_LIMITS;

  it.each([
    ['slot in (', entries, [...FOOD_LOG_SLOTS]],
    ["source in ('plan_item'", entriesE2, [...FOOD_LOG_SOURCES]],
    ['unit in (', entries, [...FOOD_LOG_UNITS]],
    ['title_de in (', entries, [...QUICK_ENTRY_LABELS]],
    ['title_de in (', entriesE2, [...QUICK_ENTRY_LABELS]],
    ["source in ('food'", favorites, [...FOOD_LOG_FAVORITE_SOURCES]],
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
      expect(favorites).toContain(`  ${key} `);
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
    // Wächter E1 G1: nur Schnell-Favoriten (Bezeichnung + kcal) gehen mit; Katalog-/Rezept-Favoriten bleiben.
    expect(body.split('food_log_favorites')).toHaveLength(2);
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

  it('export_my_data(): neueste Fassung in *_tracked_route_rpcs.sql (S1, davor E3, WP3 und E2)', () => {
    const marker = 'create or replace function public.export_my_data()';
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_tracked_route_rpcs\.sql$/,
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

  it('competition_keys = Felder von saveCompetitionPayloadSchema (alle Pflicht)', () => {
    expect(quotedListAfter(save, 'competition_keys constant text[] := array[').sort()).toEqual(
      Object.keys(saveCompetitionPayloadSchema.shape).sort(),
    );
    expect(save).toContain('if not (c ?& competition_keys)');
  });

  it('Distanz je Disziplin = COMPETITION_DISTANCE_M', () => {
    const body = fn(tables, 'private.competition_distance_m');
    for (const d of COMPETITION_DISCIPLINES) {
      expect(body).toContain(`when '${d}' then ${COMPETITION_DISTANCE_M[d]}`);
    }
    expect(tables).toContain('check (distance_m = private.competition_distance_m(discipline))');
  });

  it('Ziel-/Referenzzeit plausibel je Distanz = COMPETITION_INPUT_LIMITS.timeS', () => {
    const body = fn(tables, 'private.competition_time_plausible');
    for (const d of COMPETITION_DISCIPLINES) {
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
    const lead = COMPETITION_DISCIPLINES.map(
      (d) => `when '${d}' then ${COMPETITION_LEAD_WEEKS.minimum[d][column]}`,
    ).join(' ');
    expect(save).toContain(`min_lead_weeks := case v_discipline ${lead} end;`);
    // Lockerste Spalte = kleinster Wert je Distanz (der Server ist nur Untergrenze).
    for (const d of COMPETITION_DISCIPLINES) {
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
    const caps = COMPETITION_DISCIPLINES.map(
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
  const save = fn(rpcs, 'public.save_tracked_route');
  const update = fn(rpcs, 'public.update_tracked_route');
  const block = table.slice(table.indexOf('create table public.tracked_routes ('));
  const L = TRACKED_ROUTE_LIMITS;

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

  it('route_keys = Felder von trackedRouteSchema (alle Pflicht), update_keys = updateTrackedRouteSchema', () => {
    expect(quotedListAfter(save, 'route_keys constant text[] := array[').sort()).toEqual(
      Object.keys(trackedRouteSchema.shape).sort(),
    );
    expect(save).toContain('if not (r ?& route_keys)');
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
