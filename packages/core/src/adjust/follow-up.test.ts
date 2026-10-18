import { describe, expect, it } from 'vitest';

import { MONDAY, person } from '../plan/test-library';
import { followUpBlock, planWithFollowUps } from './test-helpers';
import { planWeeks } from './weeks';

describe('nextPlanBlock({ carriedLoadWeeks }) – Folgeblock nach deload_forward (Plan 5.2 Punkt 5)', () => {
  const inputs = person({ experienceLevel: 'advanced' });
  const plan = planWithFollowUps(inputs, MONDAY, 0);
  if (!plan) throw new Error('kein Plan');

  it('ohne bzw. mit 0 identisch zu heute (Gratis-Folgeblock unverändert)', () => {
    const today = followUpBlock(plan.plan, inputs, plan.sessions);
    expect(followUpBlock(plan.plan, inputs, plan.sessions, { carriedLoadWeeks: 0 })).toEqual(today);
    expect(planWeeks(today).filter((w) => !w.isDeload)).toHaveLength(4);
  });

  it('carriedLoadWeeks = 2 → nur L − 2 Belastungswochen, dann die Erholungswoche', () => {
    const weeks = planWeeks(
      followUpBlock(plan.plan, inputs, plan.sessions, { carriedLoadWeeks: 2 }),
    );
    expect(weeks.map((w) => w.isDeload)).toEqual([false, false, true]);
  });

  it('carriedLoadWeeks ≥ L (nie durch die Tausch-Regel, aber sicher) → sofort Erholungswoche', () => {
    const weeks = planWeeks(
      followUpBlock(plan.plan, inputs, plan.sessions, { carriedLoadWeeks: 9 }),
    );
    expect(weeks.map((w) => w.isDeload)).toEqual([true]);
  });
});
