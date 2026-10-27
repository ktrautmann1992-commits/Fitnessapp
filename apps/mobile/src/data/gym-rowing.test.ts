import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, USER_ID, VERSIONS } from '../test/fixtures';
import { applyStepToAnswers, planStepWrites, type PlanContext } from './mapping';
import { planInputsFromRows } from './training-plan';
import type { OnboardingAnswers, StepSave } from './types';

/**
 * Sportarten Stufe 1 · Etappe R (Gründer-Entscheidung 27.10.2026 „Rudern kann man zuhause und im Studio“): Angabe
 * „Im Studio auch rudern“ = user_equipment-Zeile rowing_machine mit Ort gym. Standard aus, nur Änderungen schreiben.
 */
const schedule = {
  mode: 'fixed' as const,
  slots: [
    { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
    { weekday: 3, kind: 'endurance' as const, minutes: 30 },
  ],
};
const homeDumbbells = {
  equipmentId: 'dumbbells' as const,
  location: 'home' as const,
  weightsKg: [4, 8],
};

const goal = {
  goalType: 'general_fitness' as const,
  secondaryGoalType: null,
  discipline: null,
  targetDate: null,
};

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

describe('Im Studio auch rudern', () => {
  it('ohne Änderung: keine Studio-Geräte-Operation (Abläufe wie bisher)', () => {
    const save: StepSave = { step: 'time_budget', schedule };
    const ops = planStepWrites(save, ctx(applyStepToAnswers({}, save)));
    expect(ops.some((op) => op.kind === 'replace_user_equipment')).toBe(false);
  });

  it('einschalten: Studio-Gerät rowing_machine; ausschalten: Studio-Geräte leer; Zuhause bleibt', () => {
    const on: StepSave = { step: 'time_budget', schedule, gymRowing: true };
    const answers = applyStepToAnswers({ equipment: [homeDumbbells] }, on);
    expect(answers.equipment).toEqual([
      homeDumbbells,
      { equipmentId: 'rowing_machine', location: 'gym', weightsKg: [] },
    ]);
    const ops = planStepWrites(on, ctx(answers));
    expect(ops).toContainEqual({
      kind: 'replace_user_equipment',
      location: 'gym',
      rows: [
        {
          user_id: USER_ID,
          equipment_id: 'rowing_machine',
          location: 'gym',
          weights_kg: [],
          note: null,
          bar_kg: null,
        },
      ],
    });
    const off: StepSave = { step: 'time_budget', schedule, gymRowing: false };
    expect(applyStepToAnswers(answers, off).equipment).toEqual([homeDumbbells]);
    expect(planStepWrites(off, ctx(answers))).toContainEqual({
      kind: 'replace_user_equipment',
      location: 'gym',
      rows: [],
    });
    // Equipment-Schritt (nur Zuhause) lässt die Studio-Angabe stehen.
    expect(
      applyStepToAnswers(answers, { step: 'equipment', items: [] }).equipment?.map(
        (e) => e.location,
      ),
    ).toEqual(['gym']);
  });

  it('Plan-Angaben: gymRowing nur, wenn eingeschaltet (sonst fehlt der Schlüssel)', () => {
    const rows = planPersonRows();
    const without = planInputsFromRows(rows, VERSIONS);
    expect(without && 'gymRowing' in without).toBe(false);
    const withGym = {
      ...rows,
      userEquipment: [
        ...rows.userEquipment,
        {
          user_id: USER_ID,
          equipment_id: 'rowing_machine',
          location: 'gym' as const,
          weights_kg: [],
          note: null,
          bar_kg: null,
        },
      ],
    };
    expect(planInputsFromRows(withGym, VERSIONS)).toMatchObject({ gymRowing: true });
  });
});
