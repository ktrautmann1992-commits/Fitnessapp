import { describe, expect, it } from 'vitest';

import { DELOAD_INTERVAL_WEEKS } from '../constants';
import { deloadDosage, loadWeeksBeforeDeload } from './deload';

describe('loadWeeksBeforeDeload', () => {
  it.each([
    ['beginner', false, 5],
    ['advanced', false, 4],
    ['competitive', false, 4],
    ['beginner', true, 4],
    ['advanced', true, 4],
  ] as const)('%s, vorsichtig=%s → %i', (level, cautious, weeks) => {
    const result = loadWeeksBeforeDeload(level, cautious);
    expect(result).toBe(weeks);
    expect(result).toBeGreaterThanOrEqual(DELOAD_INTERVAL_WEEKS.min);
    expect(result).toBeLessThanOrEqual(DELOAD_INTERVAL_WEEKS.max);
  });
});

describe('deloadDosage', () => {
  it('Sätze halbiert (aufgerundet, mind. 1), RPE −2 (nie unter 5), Gewicht ×0,9', () => {
    expect(deloadDosage({ sets: 5, rpe_target: 8, target_weight_kg: 100 })).toEqual({
      sets: 3,
      rpe_target: 6,
      target_weight_kg: 90,
    });
    expect(deloadDosage({ sets: 1, rpe_target: 6, target_weight_kg: null })).toEqual({
      sets: 1,
      rpe_target: 5,
      target_weight_kg: null,
    });
    expect(deloadDosage({ sets: 2, rpe_target: 5, target_weight_kg: 7.5 }).target_weight_kg).toBe(
      6.75,
    );
  });
});
