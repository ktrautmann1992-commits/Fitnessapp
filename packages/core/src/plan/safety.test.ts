import { describe, expect, it } from 'vitest';

import { HEALTH_FLAGS } from '../health-screening';
import {
  isExerciseAllowed,
  isStricter,
  planSafetyRules,
  type SafetyInputs,
  strictestRules,
} from './safety';

const DAY = '2026-10-05';
const base: SafetyInputs = {
  experienceLevel: 'advanced',
  birthDate: '1990-01-01',
  healthScreening: { flags: [] },
};

describe('planSafetyRules', () => {
  it('Fortgeschritten, Check ohne Flag: RPE 9, nichts ausgeschlossen, Gesundheitsdaten genutzt', () => {
    const rules = planSafetyRules(base, DAY);
    expect(rules).toMatchObject({
      rpeMax: 9,
      excludedCautionTags: [],
      beginnerTemplatesOnly: false,
      cautious: false,
      usesHealthData: true,
      medicalNotice: false,
    });
  });

  it('Einsteiger: RPE höchstens 8, nur Einsteiger-Vorlagen', () => {
    const rules = planSafetyRules({ ...base, experienceLevel: 'beginner' }, DAY);
    expect(rules.rpeMax).toBe(8);
    expect(rules.beginnerTemplatesOnly).toBe(true);
  });

  it.each(HEALTH_FLAGS)(
    'jedes einzelne Flag (%s) macht den Plan vorsichtig mit Arzt-Hinweis',
    (flag) => {
      const rules = planSafetyRules({ ...base, healthScreening: { flags: [flag] } }, DAY);
      expect(rules.cautious).toBe(true);
      expect(rules.rpeMax).toBe(7);
      expect(rules.beginnerTemplatesOnly).toBe(true);
      expect(rules.medicalNotice).toBe(true);
      expect(rules.excludedCautionTags).toEqual(
        expect.arrayContaining(['high_impact', 'spinal_loading', 'high_skill']),
      );
    },
  );

  it('Über-Kopf nur bei injury/medical_clearance_recommended (und ohne Check) ausgeschlossen', () => {
    const tagsFor = (flags: (typeof HEALTH_FLAGS)[number][]) =>
      planSafetyRules({ ...base, healthScreening: { flags } }, DAY).excludedCautionTags;
    expect(tagsFor(['injury', 'conservative_plan'])).toContain('overhead');
    expect(tagsFor(['medical_clearance_recommended', 'conservative_plan'])).toContain('overhead');
    expect(tagsFor(['medication', 'conservative_plan'])).not.toContain('overhead');
    expect(planSafetyRules({ ...base, healthScreening: null }, DAY).excludedCautionTags).toContain(
      'overhead',
    );
  });

  it('Schwangerschaft: zusätzlich keine lange Rückenlage, Hinweis', () => {
    const rules = planSafetyRules(
      { ...base, healthScreening: { flags: ['pregnancy', 'conservative_plan'] } },
      DAY,
    );
    expect(rules.excludedCautionTags).toContain('long_supine');
    expect(rules.pregnancyNotice).toBe(true);
  });

  it('alle Flags: strengste Kombination', () => {
    const rules = planSafetyRules({ ...base, healthScreening: { flags: [...HEALTH_FLAGS] } }, DAY);
    expect(rules.excludedCautionTags).toEqual([
      'high_impact',
      'spinal_loading',
      'overhead',
      'long_supine',
      'high_skill',
    ]);
    expect(rules.rpeMax).toBe(7);
  });

  it('kein Check: vorsichtig wie conservative_plan, aber KEINE Gesundheitsdaten und kein Arzt-Hinweis', () => {
    const rules = planSafetyRules({ ...base, healthScreening: null }, DAY);
    expect(rules).toMatchObject({
      cautious: true,
      rpeMax: 7,
      usesHealthData: false,
      medicalNotice: false,
      noHealthCheck: true,
      beginnerTemplatesOnly: true,
    });
  });

  it.each([
    ['16 Jahre', '2010-10-05', 8, ['high_skill']],
    ['17 Jahre, Tag vor dem 18. Geburtstag', '2008-10-06', 8, ['high_skill']],
    ['am 18. Geburtstag', '2008-10-05', 9, []],
    ['64 Jahre', '1961-10-06', 9, []],
    ['am 65. Geburtstag', '1961-10-05', 7, ['high_impact', 'high_skill']],
    ['95 Jahre', '1931-01-01', 7, ['high_impact', 'high_skill']],
  ] as const)('Alter: %s', (_label, birthDate, rpeMax, tags) => {
    const rules = planSafetyRules({ ...base, birthDate }, DAY);
    expect(rules.rpeMax).toBe(rpeMax);
    expect(rules.excludedCautionTags).toEqual(tags);
  });

  it('Einsteiger unter 18 mit Flag: RPE nie unter 5, strengste Regel 7', () => {
    const rules = planSafetyRules(
      { experienceLevel: 'beginner', birthDate: '2010-01-01', healthScreening: null },
      DAY,
    );
    expect(rules.rpeMax).toBe(7);
  });
});

describe('isExerciseAllowed, isStricter, strictestRules', () => {
  it('ausgeschlossenes Merkmal → nicht erlaubt', () => {
    expect(
      isExerciseAllowed({ caution_tags: ['overhead'] }, { excludedCautionTags: ['overhead'] }),
    ).toBe(false);
    expect(isExerciseAllowed({ caution_tags: [] }, { excludedCautionTags: ['overhead'] })).toBe(
      true,
    );
  });

  it('neues Flag ist strenger, wegfallendes Flag nicht', () => {
    const healthy = planSafetyRules(base, DAY);
    const flagged = planSafetyRules(
      { ...base, healthScreening: { flags: ['injury', 'conservative_plan'] } },
      DAY,
    );
    expect(isStricter(flagged, healthy)).toBe(true);
    expect(isStricter(healthy, flagged)).toBe(false);
    expect(isStricter(healthy, healthy)).toBe(false);
  });

  it('65. Geburtstag ist strenger', () => {
    const before = planSafetyRules({ ...base, birthDate: '1961-10-06' }, DAY);
    const after = planSafetyRules({ ...base, birthDate: '1961-10-06' }, '2026-10-06');
    expect(isStricter(after, before)).toBe(true);
  });

  it('strictestRules kombiniert und lockert nie', () => {
    const healthy = planSafetyRules(base, DAY);
    const flagged = planSafetyRules(
      { ...base, healthScreening: { flags: ['pregnancy', 'conservative_plan'] } },
      DAY,
    );
    const combined = strictestRules(healthy, flagged);
    expect(combined.rpeMax).toBe(7);
    expect(combined.excludedCautionTags).toContain('long_supine');
    expect(isStricter(healthy, combined)).toBe(false);
  });
});

describe('Ausdauer-Regeln (Erweiterungsplan 5.6)', () => {
  it('Fortgeschritten, ohne Flag: Anstrengung bis 4, Laufen, Startgruppe = Level', () => {
    const rules = planSafetyRules(base, DAY);
    expect(rules.enduranceEffortMax).toBe(4);
    expect(rules.enduranceWalkOnly).toBe(false);
    expect(rules.enduranceStartGroup).toBe('advanced');
  });

  it.each(HEALTH_FLAGS)('Flag %s: Gehen, Anstrengung ≤ 3, vorsichtig', (flag) => {
    const rules = planSafetyRules({ ...base, healthScreening: { flags: [flag] } }, DAY);
    expect(rules.enduranceWalkOnly).toBe(true);
    expect(rules.enduranceEffortMax).toBe(3);
    expect(rules.enduranceStartGroup).toBe('cautious');
  });

  it('strenger: niedrigere Anstrengung oder neu nur Gehen; strengste Kombination', () => {
    const healthy = planSafetyRules(base, DAY);
    const senior = planSafetyRules({ ...base, birthDate: '1950-01-01' }, DAY);
    expect(isStricter(senior, healthy)).toBe(true);
    expect(isStricter(healthy, senior)).toBe(false);
    const both = strictestRules(healthy, senior);
    expect(both.enduranceEffortMax).toBe(3);
    expect(both.enduranceWalkOnly).toBe(true);
    expect(both.enduranceStartGroup).toBe('cautious');
  });
});
