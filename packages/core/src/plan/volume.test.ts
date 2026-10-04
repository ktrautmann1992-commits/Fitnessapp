import { describe, expect, it } from 'vitest';

import { capWeeklyIncrease } from './volume';

describe('capWeeklyIncrease (10 %/Woche)', () => {
  it('begrenzt auf +10 %', () => {
    expect(capWeeklyIncrease(100, 130)).toBeCloseTo(110);
    expect(capWeeklyIncrease(100, 105)).toBe(105);
    expect(capWeeklyIncrease(100, 80)).toBe(80);
  });

  it('ohne Vorwoche gilt der Plan', () => {
    expect(capWeeklyIncrease(0, 50)).toBe(50);
  });
});
