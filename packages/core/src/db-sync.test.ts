/**
 * Prüft, dass Code (packages/core) und Datenbank (supabase/migrations) dieselben Listen und Grenzen nutzen.
 * Ändert jemand nur eine Seite, schlägt dieser Test fehl.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { MEASUREMENT_SITES } from './body-measurements';
import { CURRENT_CONSENT_VERSIONS } from './consent';
import {
  BIRTH_DATE_MIN,
  BODY_MEASUREMENT_LIMITS,
  CONTENT_SCHEMA_LIMITS,
  BODY_METRIC_LIMITS,
  EQUIPMENT_LIMITS,
  MEASURED_ON_MAX_DAYS_AHEAD,
  MEASUREMENT_REMINDER_INTERVAL_DAYS,
  MIN_AGE_YEARS,
  NUTRITION_LIMITS,
  TRAINING_LIMITS,
} from './constants';
import * as enums from './enums';
import { EQUIPMENT } from './equipment';
import { FOOD_GROUPS } from './food-groups';
import { HEALTH_FLAGS, HEALTH_SCREENING_QUESTIONS } from './health-screening';
import { ONBOARDING_STEPS } from './onboarding';

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
    expect([...catalog.values()].sort(bySortOrder)).toEqual(
      EQUIPMENT.map((item) => ({ ...item })).sort(bySortOrder),
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

  it('Onboarding-Schritte entsprechen ONBOARDING_STEPS', () => {
    expect(quotedListAfter(allSql, 'onboarding_step in (')).toEqual([...ONBOARDING_STEPS]);
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
    between('sessions_per_week', TRAINING_LIMITS.sessionsPerWeek),
    between('minutes_per_session', TRAINING_LIMITS.minutesPerSession),
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
  ])('SQL enthält „%s“', (expected) => {
    expect(allSql).toContain(expected);
  });

  it.each(
    MEASUREMENT_SITES.map((site) => [site.column, BODY_MEASUREMENT_LIMITS[site.limitKey]] as const),
  )('body_measurements.%s hat dieselben Grenzen', (column, limits) => {
    expect(allSql).toContain(between(column, limits));
  });
});
