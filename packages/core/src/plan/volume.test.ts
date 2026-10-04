import { describe, expect, it } from 'vitest';

import { capWeeklyIncrease, increasedMinutes, scaledMinutes } from './volume';

describe('capWeeklyIncrease (10 %/Woche, Math.floor)', () => {
  it('begrenzt auf floor(1,1 × Vorwoche), nie über dem Plan', () => {
    expect(capWeeklyIncrease(100, 130, 60)).toBe(110);
    expect(capWeeklyIncrease(100, 105, 60)).toBe(105);
    expect(capWeeklyIncrease(100, 80, 60)).toBe(80);
  });

  it('Rundung mit Math.floor: 55 → 60, 59 → 64, 30 → 33, 20 → 22', () => {
    expect(capWeeklyIncrease(55, 1000, 0)).toBe(60);
    expect(capWeeklyIncrease(59, 1000, 0)).toBe(64);
    expect(capWeeklyIncrease(30, 1000, 0)).toBe(33);
    expect(capWeeklyIncrease(20, 1000, 0)).toBe(22);
    expect(increasedMinutes(9)).toBe(9);
  });

  it('ohne Vorwoche (0) gilt der Startumfang, nicht der Wunsch', () => {
    expect(capWeeklyIncrease(0, 240, 60)).toBe(60);
    expect(capWeeklyIncrease(0, 40, 60)).toBe(40);
    expect(capWeeklyIncrease(-5, 240, 45)).toBe(45);
  });

  it('scaledMinutes: Erholungswoche floor(0,6 × Bezug)', () => {
    expect(scaledMinutes(66, 0.6)).toBe(39);
    expect(scaledMinutes(60, 0.6)).toBe(36);
    expect(scaledMinutes(9, 0.6)).toBe(5);
  });
});
