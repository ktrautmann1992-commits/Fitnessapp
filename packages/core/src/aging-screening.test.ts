import { describe, expect, it } from 'vitest';

import {
  AGING_FLAGS,
  AGING_SCREENING_QUESTIONS,
  agingRules,
  agingScreeningAnswersSchema,
  agingScreeningApplies,
  agingScreeningRecordSchema,
  agingScreeningStatus,
  evaluateAgingScreening,
  isAgingScreeningIncomplete,
  type AgingFlag,
} from './aging-screening';
import { planSafetyRules } from './plan/safety';

// Plantabelle 8.2, unabhängig abgeschrieben.
const CONSERVATIVE: AgingFlag[] = ['fall_history', 'fall_concern', 'walking_aid', 'recent_surgery'];
const HOLD_ON: AgingFlag[] = ['fall_history', 'fall_concern', 'walking_aid', 'anticoagulant'];

describe('Zusatzfragen: Fragen und Antworten (Plan 8.2)', () => {
  it('sieben Fragen, eine je Flag, nur vier machen vorsichtig', () => {
    expect(AGING_SCREENING_QUESTIONS.map((q) => q.id)).toEqual([...AGING_FLAGS]);
    expect(AGING_SCREENING_QUESTIONS.filter((q) => q.conservative).map((q) => q.id)).toEqual(
      CONSERVATIVE,
    );
  });

  it('kein Wort „Risiko“, keine Bewertung in den Fragen', () => {
    for (const q of AGING_SCREENING_QUESTIONS) expect(q.textDe).not.toMatch(/risiko|gefahr/i);
  });

  it('alle Fragen optional (überspringbar), fremde Schlüssel verboten', () => {
    expect(agingScreeningAnswersSchema.safeParse({}).success).toBe(true);
    expect(agingScreeningAnswersSchema.safeParse({ fall_history: true }).success).toBe(true);
    expect(agingScreeningAnswersSchema.safeParse({ fall_risk: true }).success).toBe(false);
    expect(agingScreeningAnswersSchema.safeParse({ fall_history: 'ja' }).success).toBe(false);
  });

  it('Flags nur aus „ja“; übersprungene Fragen erkennbar', () => {
    expect(evaluateAgingScreening({ fall_history: true, anticoagulant: false })).toEqual([
      'fall_history',
    ]);
    expect(isAgingScreeningIncomplete({ fall_history: false })).toBe(true);
    const all = Object.fromEntries(AGING_FLAGS.map((f) => [f, false]));
    expect(isAgingScreeningIncomplete(all)).toBe(false);
    expect(evaluateAgingScreening(Object.fromEntries(AGING_FLAGS.map((f) => [f, true])))).toEqual([
      ...AGING_FLAGS,
    ]);
  });

  it('gespeichert wird nur Monat und Jahr der Antwort (N5)', () => {
    const ok = { questionnaireVersion: 1, answeredMonth: '2026-10', answers: {} };
    expect(agingScreeningRecordSchema.safeParse(ok).success).toBe(true);
    expect(
      agingScreeningRecordSchema.safeParse({ ...ok, answeredMonth: '2026-10-21' }).success,
    ).toBe(false);
    expect(agingScreeningRecordSchema.safeParse({ ...ok, surgeryDate: '2026-05-01' }).success).toBe(
      false,
    );
    expect(agingScreeningRecordSchema.safeParse({ ...ok, questionnaireVersion: 2 }).success).toBe(
      false,
    );
  });
});

describe('Wann wird gefragt?', () => {
  const on = '2026-10-21';
  it.each([
    ['1966-10-21', 'muscle_gain', true],
    ['1966-10-22', 'muscle_gain', false],
    ['1971-01-01', 'active_aging', true],
    ['1926-01-01', 'endurance', true],
    [null, 'general_fitness', false],
    [null, 'active_aging', true],
  ] as const)(
    'geboren %s, Ziel %s → %s (60. Geburtstag zählt)',
    (birthDate, goalType, expected) => {
      expect(agingScreeningApplies({ birthDate, goalType, onDate: on })).toBe(expected);
    },
  );

  it('Status: fehlt → fragen; OP „ja“ älter als 12 Monate → erneut fragen', () => {
    const ctx = { applies: true, today: '2026-10-21' };
    expect(agingScreeningStatus(null, ctx)).toBe('ask');
    expect(agingScreeningStatus(null, { ...ctx, applies: false })).toBe('not_applicable');
    const record = (month: string, surgery: boolean) => ({
      questionnaireVersion: 1,
      answeredMonth: month,
      answers: { recent_surgery: surgery },
    });
    expect(agingScreeningStatus(record('2025-11', true), ctx)).toBe('answered');
    expect(agingScreeningStatus(record('2025-10', true), ctx)).toBe('ask_again');
    expect(agingScreeningStatus(record('2024-01', false), ctx)).toBe('answered');
  });
});

describe('Wirkung je Flag (Plan 8.2, S4)', () => {
  it.each(AGING_FLAGS)('%s einzeln', (flag) => {
    const r = agingRules([flag]);
    expect(r.conservative).toBe(CONSERVATIVE.includes(flag));
    expect(r.balanceSupport).toBe(HOLD_ON.includes(flag) ? 'hold_on' : 'chair_nearby');
    expect(r.standStagesMax).toBe(HOLD_ON.includes(flag) ? 'semi_tandem' : 'single_leg');
    const fallRisk = ['fall_history', 'fall_concern', 'walking_aid'].includes(flag);
    expect(r.balanceMaxStage).toBe(fallRisk ? 2 : 4);
    expect(r.stairsBottomStepOnly).toBe(fallRisk);
    expect(r.medicalNotice).toBe(['fall_history', 'fall_concern', 'recent_surgery'].includes(flag));
  });

  it('künstliche Hüfte und Osteoporose: gezielte Ausschlüsse', () => {
    expect([...agingRules(['hip_replacement']).excludedCautionTags].sort()).toEqual([
      'deep_hip_flexion',
      'hip_cross_midline',
    ]);
    expect([...agingRules(['bone_health']).excludedCautionTags].sort()).toEqual([
      'loaded_flexion',
      'spinal_flexion',
      'trunk_rotation',
    ]);
  });

  it('feste Hinweise: Klinik, Knochen, Kopfanprall', () => {
    expect(agingRules(['recent_surgery', 'bone_health', 'anticoagulant']).notices).toEqual([
      'clinic_rules',
      'bone_exercises',
      'head_injury',
    ]);
  });

  it('übersprungen = vorsichtig, Halt beidhändig, Stufe ≤ 2', () => {
    const r = agingRules(null);
    expect(r.conservative).toBe(true);
    expect(r.balanceSupport).toBe('hold_on');
    expect(r.balanceMaxStage).toBe(2);
  });
});

describe('Zusatzfragen in den Plan-Regeln (bei jedem Ziel)', () => {
  const rules = (
    flags: AgingFlag[] | null | undefined,
    goalType: 'muscle_gain' | 'active_aging' = 'muscle_gain',
  ) =>
    planSafetyRules(
      {
        experienceLevel: 'advanced',
        birthDate: '1964-01-15',
        healthScreening: { flags: [] },
        goalType,
        agingScreening: flags === undefined ? undefined : flags === null ? null : { flags },
      },
      '2026-10-21',
    );

  it('62-Jähriger, Muskelaufbau, Blutverdünner → bleibt Muskelaufbau-Plan (nicht vorsichtig), nur Halt-Pflicht', () => {
    const r = rules(['anticoagulant']);
    expect(r.cautious).toBe(false);
    expect(r.beginnerTemplatesOnly).toBe(false);
    expect(r.balance?.support).toBe('hold_on');
    expect(r.medicalNotice).toBe(false);
  });

  it('Sturz → vorsichtiger Plan mit Arzt-Hinweis, Einsteiger-Vorlagen, RPE ≤ 7, nur Gehen', () => {
    const r = rules(['fall_history']);
    expect(r.cautious).toBe(true);
    expect(r.beginnerTemplatesOnly).toBe(true);
    expect(r.rpeMax).toBeLessThanOrEqual(7);
    expect(r.medicalNotice).toBe(true);
    expect(r.enduranceWalkOnly).toBe(true);
    expect(r.balance?.maxStage).toBe(2);
  });

  it('Osteoporose: Ausschlüsse auch bei Muskelaufbau', () => {
    expect(rules(['bone_health']).excludedCautionTags).toEqual(
      expect.arrayContaining(['spinal_flexion', 'loaded_flexion', 'trunk_rotation']),
    );
  });

  it('übersprungen → vorsichtig; nicht zutreffend → wie bisher (kein Feld balance)', () => {
    expect(rules(null).cautious).toBe(true);
    const none = rules(undefined);
    expect(none.cautious).toBe(false);
    expect(none.balance).toBeUndefined();
  });

  it('alle Flags zusammen mit Fit im Alter: strengste Regel gewinnt', () => {
    const r = rules([...AGING_FLAGS], 'active_aging');
    expect(r.rpeMax).toBe(6);
    expect(r.cautious).toBe(true);
    expect(r.balance).toEqual({ maxStage: 2, support: 'hold_on' });
    expect(r.excludedCautionTags).toEqual(
      expect.arrayContaining(['floor_transfer', 'deep_hip_flexion', 'loaded_flexion']),
    );
  });
});
