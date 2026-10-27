import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, USER_ID, VERSIONS } from '../test/fixtures';
import { applyStepToAnswers, planStepWrites, type PlanContext } from './mapping';
import { planInputsFromRows } from './training-plan';
import type { OnboardingAnswers, StepSave } from './types';

/**
 * Sportarten Stufe 1 · Restpunkte (27.10.2026): „Hyrox-Geräte im Studio“ = user_equipment-Zeilen mit Ort gym für
 * Ski-Ergometer, Schlitten, Sandsack, Wall Ball. Standard aus; zusammen mit „Im Studio auch rudern“ (Studio-Zeilen
 * werden immer als Ganzes ersetzt – die jeweils andere Angabe bleibt erhalten).
 */
const schedule = {
  mode: 'fixed' as const,
  slots: [
    { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
    { weekday: 3, kind: 'endurance' as const, minutes: 45 },
  ],
};
const goal = {
  goalType: 'endurance' as const,
  secondaryGoalType: null,
  discipline: 'hyrox' as const,
  targetDate: null,
};
const HYROX_GYM = ['ski_erg', 'sled', 'sandbag', 'wall_ball'];

function ctx(answers: OnboardingAnswers): PlanContext {
  return {
    userId: USER_ID,
    answers: { goal, ...answers },
    nextStep: null,
    now: NOW,
    platform: 'web',
    versions: VERSIONS,
    hasHealthConsent: true,
  };
}

const gymIds = (answers: OnboardingAnswers) =>
  (answers.equipment ?? []).filter((e) => e.location === 'gym').map((e) => e.equipmentId);

describe('Hyrox-Geräte im Studio', () => {
  it('einschalten: vier Studio-Geräte; Rudern bleibt erhalten; ausschalten: nur noch Rudern', () => {
    const rowingOn = applyStepToAnswers({}, { step: 'time_budget', schedule, gymRowing: true });
    const on: StepSave = { step: 'time_budget', schedule, gymHyrox: true };
    const answers = applyStepToAnswers(rowingOn, on);
    expect(gymIds(answers)).toEqual(['rowing_machine', ...HYROX_GYM]);
    const ops = planStepWrites(on, ctx(rowingOn));
    const replace = ops.find((op) => op.kind === 'replace_user_equipment');
    expect(replace && 'rows' in replace ? replace.rows.map((r) => r.equipment_id) : null).toEqual([
      'rowing_machine',
      ...HYROX_GYM,
    ]);
    const off: StepSave = { step: 'time_budget', schedule, gymHyrox: false };
    expect(gymIds(applyStepToAnswers(answers, off))).toEqual(['rowing_machine']);
  });

  it('ohne Änderung keine Geräte-Operation; Plan-Angabe gymHyrox nur, wenn eingeschaltet', () => {
    const save: StepSave = { step: 'time_budget', schedule };
    expect(
      planStepWrites(save, ctx(applyStepToAnswers({}, save))).some(
        (op) => op.kind === 'replace_user_equipment',
      ),
    ).toBe(false);
    const rows = planPersonRows();
    const without = planInputsFromRows(rows, VERSIONS);
    expect(without && 'gymHyrox' in without).toBe(false);
    const withGym = {
      ...rows,
      userEquipment: [
        ...rows.userEquipment,
        {
          user_id: USER_ID,
          equipment_id: 'sled',
          location: 'gym' as const,
          weights_kg: [],
          note: null,
          bar_kg: null,
        },
      ],
    };
    expect(planInputsFromRows(withGym, VERSIONS)).toMatchObject({ gymHyrox: true });
  });
});
