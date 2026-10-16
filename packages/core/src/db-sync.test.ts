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
  CUSTOM_MEAL_LIMITS,
  PINCH_G,
  BODY_METRIC_LIMITS,
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
  MEAL_PLAN_RETENTION_WEEKS,
  MIFFLIN_ST_JEOR,
  MIN_INTAKE_RELATIVE_TO_BMR,
} from './constants';
import { serverDayKcalFloor } from './nutrition/plausibility';
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

  it('CURRENT_CONSENT_VERSIONS = höchste Version im Seed', () => {
    const seed = readMigration('_seed_consent_documents.sql');
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
  // Letzte Fassung von private.assert_plan_inputs (Ziele, Etappe Z1: optionales Nebenziel).
  const goalsSql = readMigration('_plan_inputs_secondary_goal.sql');
  const keysOf = (sql: string, name: string) =>
    quotedListAfter(sql, `${name} constant text[] := array[`).sort();

  it.each([
    ['plan_keys', rpcSql, savePlanPayloadSchema],
    ['allowed_keys', goalsSql, savePlanInputsSchema],
    ['equipment_keys', goalsSql, savePlanHomeEquipmentSchema],
    ['session_keys', kindsSql, savePlanSessionSchema],
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

  it('neueste save_session_log-Fassung steht in *_free_session_logs.sql (A1b)', () => {
    expect(saveFile).toMatch(/_free_session_logs\.sql$/);
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
    // Neueste Fassung seit Etappe E2 in *_custom_meal_rpcs.sql (E1: Tagebuch-Einträge, E2: eigene Gerichte).
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_custom_meal_rpcs\.sql$/,
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
  // CHECK-Bedingungen der Einträge: Herkunft und Form neu gefasst in *_custom_meals.sql (E2, nur erweitert).
  const entriesE2 = readMigration('_custom_meals.sql').slice(
    readMigration('_custom_meals.sql').indexOf('alter table public.food_log_entries'),
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

  it('export_my_data(): neueste Fassung in *_custom_meal_rpcs.sql (E2)', () => {
    const marker = 'create or replace function public.export_my_data()';
    expect(migrationFiles.filter((n) => readMigration(n).includes(marker)).at(-1)).toMatch(
      /_custom_meal_rpcs\.sql$/,
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
    expect(save).toContain("where (v ->> 'date')::date >= today");
    expect(save).toContain(
      'd.kcal + kcal_tolerance < private.meal_plan_day_kcal_floor(current_user_id, d.day, today)',
    );
    // Prüfung nach der Einwilligungs-Sperre (Körperdaten unter derselben Sperre gelesen).
    expect(save.indexOf('basis.consent_ok and exists')).toBeGreaterThan(
      save.indexOf('private.nutrition_health_basis()'),
    );
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
