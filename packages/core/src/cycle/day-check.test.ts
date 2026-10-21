import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { cycleDayAssessment, entrySuggestsLighter, lighterSuggestionDays } from './day-check';
import { dailyEntries, entry } from './test-helpers';

const TODAY = '2026-10-21';
const ACTIVE = { planned: 'planned', raceDay: false, moduleActive: true } as const;

describe('Angebot „Heute leichter?“ (Plan 3.3)', () => {
  it('Energie 2 → Angebot, Energie 3 → keins', () => {
    expect(entrySuggestsLighter({ energy: 2 })).toBe(true);
    expect(entrySuggestsLighter({ energy: 3 })).toBe(false);
    expect(entrySuggestsLighter({ energy: 1 })).toBe(true);
  });

  it('Beschwerde „stark“ → Angebot, „leicht“ → keins', () => {
    expect(entrySuggestsLighter({ symptoms: { headache: 'strong' } })).toBe(true);
    expect(entrySuggestsLighter({ symptoms: { headache: 'mild', cramps: 'mild' } })).toBe(false);
  });

  it('Blutung stark + Energie 3 → Angebot, + Energie 4 oder ohne Energie → keins', () => {
    expect(entrySuggestsLighter({ bleeding: 'heavy', energy: 3 })).toBe(true);
    expect(entrySuggestsLighter({ bleeding: 'heavy', energy: 4 })).toBe(false);
    expect(entrySuggestsLighter({ bleeding: 'heavy' })).toBe(false);
    expect(entrySuggestsLighter({ bleeding: 'medium', energy: 3 })).toBe(false);
    expect(entrySuggestsLighter(null)).toBe(false);
  });

  it('nur mit geplanter, nicht begonnener Einheit und nicht am Renntag', () => {
    const today = entry(TODAY, { energy: 1 });
    expect(cycleDayAssessment(today, [today], ACTIVE).lighterOffer).toBe(true);
    expect(cycleDayAssessment(today, [today], { ...ACTIVE, planned: 'none' }).lighterOffer).toBe(
      false,
    );
    expect(cycleDayAssessment(today, [today], { ...ACTIVE, planned: 'started' }).lighterOffer).toBe(
      false,
    );
    const race = cycleDayAssessment(today, [today], { ...ACTIVE, raceDay: true });
    expect(race).toEqual({ lighterOffer: false, hints: ['race_day'] });
    expect(cycleDayAssessment(null, [], ACTIVE)).toEqual({ lighterOffer: false, hints: [] });
  });

  it('Modul pausiert (z. B. Schwangerschaft) → nichts', () => {
    const today = entry(TODAY, { energy: 1 });
    expect(cycleDayAssessment(today, [today], { ...ACTIVE, moduleActive: false })).toEqual({
      lighterOffer: false,
      hints: [],
    });
  });

  it('Häufung: 4 von 14 Tagen → einmaliger Hinweis, 3 Tage nicht', () => {
    const entries = (n: number) =>
      dailyEntries(addDays(TODAY, -13), 14, { extra: (i) => ({ energy: i >= 14 - n ? 2 : 4 }) });
    const four = entries(4);
    expect(lighterSuggestionDays(four, TODAY)).toBe(4);
    expect(cycleDayAssessment(four.at(-1) ?? null, four, ACTIVE).hints).toEqual(['lighter_often']);
    const three = entries(3);
    expect(cycleDayAssessment(three.at(-1) ?? null, three, ACTIVE).hints).toEqual([]);
  });
});
