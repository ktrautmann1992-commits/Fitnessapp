/**
 * Folgeblock eines Körpergewicht-Plans (docs/PLAN-KOERPERGEWICHT.md, Wächter N2): nextBlockFromRows setzt
 * `protectLastCore`, damit Block 2 genauso kürzt wie Block 1 – auch mit einer Bibliothek ohne Vorlagen (N3).
 */
import * as core from '@fitnessapp/core';
import { startOfIsoWeek, toSavePlanPayload } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  nextBlockFromRows,
} from './training-plan';

vi.mock('@fitnessapp/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fitnessapp/core')>();
  return { ...actual, nextPlanBlock: vi.fn(actual.nextPlanBlock) };
});

const slots = [1, 3, 5].map((weekday, i) => ({
  user_id: USER_ID,
  slot_no: i + 1,
  weekday,
  kind: 'strength_home' as const,
  minutes: 30,
}));

describe('Folgeblock Körpergewicht', () => {
  it('nextBlockFromRows setzt protectLastCore – mit voller Bibliothek und mit Bibliothek ohne Vorlagen', async () => {
    const rows = planPersonRows({ goal: 'fat_loss', slots });
    const setup = seededBackend(rows, TODAY, `${TODAY}T08:00:00.000Z`);
    const library = await setup.backend.loadPlanLibrary({ allowCached: false });
    if (!library) throw new Error('Bibliothek fehlt');
    const result = generatePlanFromRows(rows, VERSIONS, library, TODAY);
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.template_id).toMatch(/-koerpergewicht$/);
    const saved = await setup.backend.savePlan(toSavePlanPayload(result.plan), rows);
    const active = activePlan(saved);
    if (!active) throw new Error('kein Plan');
    const lastWeek = startOfIsoWeek(active.sessions.at(-1)?.scheduled_on ?? TODAY);
    const rules = effectiveSafetyRules(saved, VERSIONS, lastWeek);
    if (!rules) throw new Error('keine Regeln');
    const spy = vi.mocked(core.nextPlanBlock);
    for (const lib of [library, { ...library, templates: [] }]) {
      spy.mockClear();
      nextBlockFromRows(saved, active, rules, lib, lastWeek);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[1].protectLastCore).toBe(true);
    }
  });
});
