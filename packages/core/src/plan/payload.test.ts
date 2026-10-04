import { describe, expect, it } from 'vitest';

import { PLAN_SAVE_LIMITS } from '../constants';
import { EQUIPMENT_IDS } from '../equipment';
import { generateTrainingPlan } from './generate';
import {
  appendPlanBlockSchema,
  jsonbTextBytes,
  savePlanInputsSchema,
  savePlanPayloadSchema,
  toAppendBlockPayload,
  toSavePlanPayload,
} from './payload';
import { nextPlanBlock } from './schedule';
import { MONDAY, person, repoLibrary } from './test-library';

describe('toSavePlanPayload', () => {
  const result = generateTrainingPlan(
    person({ healthScreening: { flags: ['pregnancy', 'injury', 'conservative_plan'] } }),
    repoLibrary(),
    MONDAY,
  );
  if (!result.ok) throw new Error(result.error);
  const payload = toSavePlanPayload(result.plan);

  it('enthält nur die Spalten aus Abschnitt 8', () => {
    expect(Object.keys(payload).sort()).toEqual([
      'engine_version',
      'inputs',
      'match_quality',
      'medical_notice',
      'notes',
      'sessions',
      'start_date',
      'template_id',
      'template_title_de',
      'template_version',
      'uses_health_data',
    ]);
    expect(Object.keys(payload.sessions[0] ?? {}).sort()).toEqual([
      'block_no',
      'cooldown_de',
      'estimated_minutes',
      'exercises',
      'focus',
      'is_deload',
      'is_intro_week',
      'name_de',
      'scheduled_on',
      'template_day_index',
      'warmup_de',
      'week_no',
    ]);
  });

  it('nie Sicherheitsregeln, Schwangerschafts-Hinweis, Gesundheits-Check oder Geburtsdatum', () => {
    const json = JSON.stringify(payload);
    for (const forbidden of [
      'safety_rules',
      'safetyRules',
      'pregnancyNotice',
      'pregnancy',
      'healthScreening',
      'flags',
      'birthDate',
      '1996-01-15',
      'excludedCautionTags',
      'training_days',
      'uses_draft_content',
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('Werte stimmen mit dem Plan überein', () => {
    expect(payload.sessions).toHaveLength(result.plan.sessions.length);
    expect(payload.medical_notice).toBe(true);
    expect(payload.uses_health_data).toBe(true);
  });

  it('passt zum strikten Eingabe-Schema der Datenbank-Funktion', () => {
    expect(savePlanPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('strikt: unbekannte Felder werden abgelehnt (oben, in Angaben, Einheit, Übung)', () => {
    expect(savePlanPayloadSchema.safeParse({ ...payload, user_id: 'x' }).success).toBe(false);
    expect(savePlanPayloadSchema.safeParse({ ...payload, safety_rules: {} }).success).toBe(false);
    expect(
      savePlanPayloadSchema.safeParse({
        ...payload,
        inputs: { ...payload.inputs, healthScreening: null },
      }).success,
    ).toBe(false);
    const [first, ...rest] = payload.sessions;
    if (!first) throw new Error('keine Einheit');
    expect(
      savePlanPayloadSchema.safeParse({
        ...payload,
        sessions: [{ ...first, pregnancyNotice: true }, ...rest],
      }).success,
    ).toBe(false);
    const [ex] = first.exercises;
    expect(
      savePlanPayloadSchema.safeParse({
        ...payload,
        sessions: [{ ...first, exercises: [{ ...ex, caution_tags: [] }] }],
      }).success,
    ).toBe(false);
  });

  it('Folgeblock im Format von append_plan_block', () => {
    const next = nextPlanBlock(result.plan.sessions, {
      trainingDays: result.plan.training_days,
      loadWeeks: result.plan.load_weeks,
      rules: result.plan.safety_rules,
      library: repoLibrary().exercises,
    });
    const block = toAppendBlockPayload(next);
    expect(appendPlanBlockSchema.safeParse(block).success).toBe(true);
    expect(block.every((s) => s.block_no === 2)).toBe(true);
  });

  it('Angaben: Werte wie private.assert_plan_inputs() (Aufzählungen, Bereiche, Geräte)', () => {
    const inputs = payload.inputs;
    const check = (patch: Record<string, unknown>) =>
      savePlanInputsSchema.safeParse({ ...inputs, ...patch }).success;
    expect(check({})).toBe(true);
    expect(check({ goalType: 'Herzprobleme seit 2019' })).toBe(false);
    expect(check({ discipline: 'ultra' })).toBe(false);
    expect(check({ sessionsPerWeek: 8 })).toBe(false);
    expect(check({ sessionsPerWeek: 3.5 })).toBe(false);
    expect(check({ minutesPerSession: '45' })).toBe(false);
    expect(check({ minutesPerSession: 9 })).toBe(false);
    expect(check({ preferredDays: [1, 1] })).toBe(false);
    expect(check({ preferredDays: [0] })).toBe(false);
    expect(check({ preferredDays: [1, 2, 3, 4, 5, 6, 7] })).toBe(true);
    expect(check({ homeEquipment: [{ equipmentId: 'zauberstab', weightsKg: [] }] })).toBe(false);
    expect(check({ homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: [], note: 'x' }] })).toBe(
      false,
    );
    expect(
      check({
        homeEquipment: [
          { equipmentId: 'dumbbells', weightsKg: [] },
          { equipmentId: 'dumbbells', weightsKg: [] },
        ],
      }),
    ).toBe(false);
    const steps = (n: number) => Array.from({ length: n }, (_, i) => 1 + i * 0.25);
    expect(check({ homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: steps(40) }] })).toBe(
      true,
    );
    expect(check({ homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: steps(41) }] })).toBe(
      false,
    );
  });

  it(`Angaben: höchstens ${PLAN_SAVE_LIMITS.inputsMaxBytes} Bytes (wie der CHECK auf user_plans.inputs)`, () => {
    const huge = {
      ...payload.inputs,
      homeEquipment: EQUIPMENT_IDS.map((equipmentId) => ({
        equipmentId,
        weightsKg: Array.from({ length: 40 }, (_, i) => 150 + i * 1.25),
      })),
    };
    expect(jsonbTextBytes(huge)).toBeGreaterThan(PLAN_SAVE_LIMITS.inputsMaxBytes);
    expect(savePlanInputsSchema.safeParse(huge).success).toBe(false);
  });
});

describe('jsonbTextBytes', () => {
  it('zählt wie Postgres jsonb::text (Leerzeichen nach , und :, UTF-8)', () => {
    expect(jsonbTextBytes({ a: [1, 2] })).toBe('{"a": [1, 2]}'.length);
    expect(jsonbTextBytes({ a: null, b: true, c: false })).toBe(
      '{"a": null, "b": true, "c": false}'.length,
    );
    expect(jsonbTextBytes({ ä: 'ö' })).toBe(12);
    expect(jsonbTextBytes([])).toBe(2);
    expect(jsonbTextBytes({})).toBe(2);
    expect(jsonbTextBytes(6.25)).toBe(4);
  });
});
