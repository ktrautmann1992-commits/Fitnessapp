import { describe, expect, it } from 'vitest';

import { PLAN_SAVE_LIMITS } from '../constants';
import { EQUIPMENT_IDS, HOME_SELECTABLE_EQUIPMENT } from '../equipment';
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
      'effort_target',
      'endurance_modality',
      'estimated_minutes',
      'exercises',
      'focus',
      'is_deload',
      'is_intro_week',
      'kind',
      'name_de',
      'scheduled_on',
      'template_day_index',
      'warmup_de',
      'week_no',
    ]);
    expect(Object.keys(payload.inputs).sort()).toEqual([
      'discipline',
      'experienceLevel',
      'goalType',
      'homeEquipment',
      'schedule',
      'trainingLocation',
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
      'training_week',
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
      schedule: result.plan.inputs.schedule,
      loadWeeks: result.plan.load_weeks,
      rules: result.plan.safety_rules,
      library: repoLibrary().exercises,
      profiles: new Map(),
      endurance: { goalType: 'muscle_gain', discipline: null, experienceLevel: 'beginner' },
      previousStartGroup: result.plan.safety_rules.enduranceStartGroup,
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
    // Alte Angaben (Engine-Version 1) gibt es nicht mehr.
    expect(check({ sessionsPerWeek: 3 })).toBe(false);
    expect(check({ preferredDays: [] })).toBe(false);
    // Zeitplan: verschachtelt strikt (schedule → mode/slots, slots[] → weekday/kind/minutes).
    const fixed = (slots: unknown[]) => check({ schedule: { mode: 'fixed', slots } });
    const flex = (slots: unknown[]) => check({ schedule: { mode: 'flex', slots } });
    const day = (weekday: unknown, minutes: unknown = 30, kind: unknown = 'endurance') => ({
      weekday,
      kind,
      minutes,
    });
    expect(fixed([day(1), day(7, 240)])).toBe(true);
    expect(fixed([1, 2, 3, 4, 5, 6, 7].map((d) => day(d)))).toBe(true);
    expect(fixed([])).toBe(false);
    expect(fixed([1, 2, 3, 4, 5, 6, 7, 1].map((d) => day(d)))).toBe(false);
    expect(fixed([day(1), day(1)])).toBe(false);
    expect(fixed([day(0)])).toBe(false);
    expect(fixed([day(1, 9)])).toBe(false);
    expect(fixed([day(1, 241)])).toBe(false);
    expect(fixed([day(1, 45.5)])).toBe(false);
    expect(fixed([day(1, '45')])).toBe(false);
    expect(fixed([day(1, 30, 'yoga')])).toBe(false);
    expect(fixed([{ ...day(1), note: 'x' }])).toBe(false);
    expect(fixed([{ kind: 'endurance', minutes: 30 }])).toBe(false);
    expect(flex([{ kind: 'endurance', minutes: 30 }])).toBe(true);
    expect(flex([day(1)])).toBe(false);
    expect(check({ schedule: { mode: 'flex', slots: [], extra: 1 } })).toBe(false);
    expect(check({ schedule: { mode: 'weekly', slots: [] } })).toBe(false);
    expect(check({ trainingLocation: null })).toBe(true);
    expect(check({ trainingLocation: 'garden' })).toBe(false);
    // Geräte: equipmentId, weightsKg, barKg
    const item = (patch: Record<string, unknown>) => ({
      equipmentId: 'dumbbells',
      weightsKg: [],
      barKg: null,
      ...patch,
    });
    expect(check({ homeEquipment: [item({ equipmentId: 'zauberstab' })] })).toBe(false);
    expect(check({ homeEquipment: [item({ note: 'x' })] })).toBe(false);
    expect(check({ homeEquipment: [{ equipmentId: 'dumbbells', weightsKg: [] }] })).toBe(false);
    expect(check({ homeEquipment: [item({ equipmentId: 'barbell', barKg: 15 })] })).toBe(true);
    expect(check({ homeEquipment: [item({ equipmentId: 'barbell', barKg: 26 })] })).toBe(false);
    expect(check({ homeEquipment: [item({ equipmentId: 'barbell', weightsKg: [25] })] })).toBe(
      true,
    );
    expect(check({ homeEquipment: [item({ equipmentId: 'barbell', weightsKg: [27.5] })] })).toBe(
      false,
    );
    expect(check({ homeEquipment: [item({ barKg: 20 })] })).toBe(false);
    expect(check({ homeEquipment: [item({}), item({})] })).toBe(false);
    const steps = (n: number) => Array.from({ length: n }, (_, i) => 1 + i * 0.25);
    expect(check({ homeEquipment: [item({ weightsKg: steps(40) })] })).toBe(true);
    expect(check({ homeEquipment: [item({ weightsKg: steps(41) })] })).toBe(false);
  });

  it(`Angaben: höchstens ${PLAN_SAVE_LIMITS.inputsMaxBytes} Bytes (wie der CHECK auf user_plans.inputs)`, () => {
    const huge = {
      ...payload.inputs,
      homeEquipment: EQUIPMENT_IDS.map((equipmentId) => ({
        equipmentId,
        weightsKg: Array.from({ length: 40 }, (_, i) => 150 + i * 1.25),
        barKg: null,
      })),
    };
    expect(jsonbTextBytes(huge)).toBeGreaterThan(PLAN_SAVE_LIMITS.inputsMaxBytes);
    expect(savePlanInputsSchema.safeParse(huge).success).toBe(false);
  });

  it('größte echte Angaben passen locker: 7 feste Tage + alle Heim-Geräte, je 40 Gewichtsstufen', () => {
    const biggest = {
      goalType: 'general_fitness',
      discipline: 'triathlon_olympic',
      experienceLevel: 'competitive',
      schedule: {
        mode: 'fixed',
        slots: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          kind: 'strength_home',
          minutes: 240,
        })),
      },
      trainingLocation: 'both',
      homeEquipment: HOME_SELECTABLE_EQUIPMENT.map((e) => ({
        equipmentId: e.id,
        weightsKg: e.hasWeights ? Array.from({ length: 40 }, (_, i) => 0.25 + i * 0.6 + 0.01) : [],
        barKg: e.id === 'barbell' ? 22.75 : null,
      })),
    };
    expect(jsonbTextBytes(biggest)).toBeLessThan(PLAN_SAVE_LIMITS.inputsMaxBytes);
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
