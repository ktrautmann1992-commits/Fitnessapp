import { describe, expect, it } from 'vitest';

import { agingRules } from './aging-screening';
import {
  availableFunctionTests,
  functionTestProgress,
  functionTestResultSchema,
  isStandStageAllowed,
  nextFunctionTestSuggestion,
} from './function-tests';

describe('Selbsttests „Mein Fortschritt“ (Plan 10)', () => {
  it('Ergebnisse streng geprüft, plausible Grenzen', () => {
    const ok = {
      kind: 'sit_to_stand_30s',
      performedOn: '2026-10-21',
      count: 11,
      withArmSupport: true,
    };
    expect(functionTestResultSchema.safeParse(ok).success).toBe(true);
    expect(functionTestResultSchema.safeParse({ ...ok, count: 61 }).success).toBe(false);
    expect(functionTestResultSchema.safeParse({ ...ok, count: -1 }).success).toBe(false);
    expect(functionTestResultSchema.safeParse({ ...ok, risk: 'hoch' }).success).toBe(false);
    expect(
      functionTestResultSchema.safeParse({
        kind: 'single_leg_stand',
        performedOn: '2026-10-21',
        leftS: 30,
        rightS: 31,
      }).success,
    ).toBe(false);
    expect(
      functionTestResultSchema.safeParse({
        kind: 'stand_stages',
        performedOn: '2026-10-21',
        highestStage: null,
      }).success,
    ).toBe(true);
  });

  it('Arzt-Hinweis nicht bestätigt → Aufstehen gesperrt', () => {
    const tests = availableFunctionTests({
      medicalClearancePending: true,
      aging: agingRules([]),
    });
    expect(tests[0]).toEqual({
      kind: 'sit_to_stand_30s',
      available: false,
      reason: 'medical_notice_unconfirmed',
    });
    expect(tests.every((t) => t.kind !== 'single_leg_stand' || t.available)).toBe(true);
  });

  it.each(['fall_history', 'fall_concern', 'walking_aid', 'anticoagulant'] as const)(
    '%s → Stand-Stufen nur bis Halbtandem, kein Einbeinstand',
    (flag) => {
      const tests = availableFunctionTests({
        medicalClearancePending: false,
        aging: agingRules([flag]),
      });
      expect(tests[1]).toEqual({ kind: 'stand_stages', available: true, maxStage: 'semi_tandem' });
      expect(tests[2]?.available).toBe(false);
      expect(isStandStageAllowed('tandem', 'semi_tandem')).toBe(false);
      expect(isStandStageAllowed('semi_tandem', 'semi_tandem')).toBe(true);
      expect(isStandStageAllowed(null, 'semi_tandem')).toBe(true);
    },
  );

  it('Verlauf nur als eigene Zahlen, keine Bewertung', () => {
    const r = (performedOn: string, count: number) =>
      ({ kind: 'sit_to_stand_30s', performedOn, count, withArmSupport: false }) as const;
    expect(functionTestProgress([], 'sit_to_stand_30s')).toEqual({ previous: null, latest: null });
    const p = functionTestProgress(
      [r('2026-10-21', 11), r('2026-08-01', 8), r('2026-09-20', 9)],
      'sit_to_stand_30s',
    );
    expect(p).toEqual({ previous: 9, latest: 11 });
    expect(Object.keys(p).sort()).toEqual(['latest', 'previous']);
  });

  it('Vorschlag alle 4 Wochen', () => {
    expect(nextFunctionTestSuggestion(null, '2026-10-21')).toBe(true);
    expect(nextFunctionTestSuggestion('2026-09-24', '2026-10-21')).toBe(false);
    expect(nextFunctionTestSuggestion('2026-09-23', '2026-10-21')).toBe(true);
  });
});
