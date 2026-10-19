import { describe, expect, it } from 'vitest';

import { SUPPLEMENT_SCREENING_VERSION } from '../constants';
import {
  createSupplementScreeningAnswersSchema,
  evaluateSupplementScreening,
  SUPPLEMENT_FLAGS,
  SUPPLEMENT_SCREENING_QUESTIONS,
  supplementScreeningAnswersSchema,
  supplementScreeningQuestionsFor,
} from './screening';

const allNo = {
  kidney: false,
  breastfeeding: false,
  heart_rhythm: false,
  caffeine_sensitive: false,
};

describe('Supplement-Check (Plan 3.4)', () => {
  it('vier Fragen, je ein Flag in fester Reihenfolge, Version 1', () => {
    expect(SUPPLEMENT_SCREENING_QUESTIONS.map((question) => question.flag)).toEqual([
      ...SUPPLEMENT_FLAGS,
    ]);
    expect(SUPPLEMENT_SCREENING_VERSION).toBe(1);
  });

  it('alle „nein“ → keine Flags', () => {
    expect(evaluateSupplementScreening(allNo)).toEqual([]);
  });

  it('jede Frage einzeln → genau ihr Flag', () => {
    for (const flag of SUPPLEMENT_FLAGS) {
      expect(evaluateSupplementScreening({ ...allNo, [flag]: true })).toEqual([flag]);
    }
  });

  it('alle „ja“ → alle Flags in fester Reihenfolge; Eiweiß-Selbsteinschätzung setzt kein Flag', () => {
    expect(
      evaluateSupplementScreening({
        kidney: true,
        breastfeeding: true,
        heart_rhythm: true,
        caffeine_sensitive: true,
        protein_self_check: 'rather_not',
      }),
    ).toEqual(['kidney', 'breastfeeding', 'heart_rhythm', 'caffeine_sensitive']);
  });

  it('strikt: unbekannte Schlüssel und Nicht-Boolean werden abgelehnt', () => {
    expect(supplementScreeningAnswersSchema.safeParse({ ...allNo, liver: true }).success).toBe(
      false,
    );
    expect(supplementScreeningAnswersSchema.safeParse({ ...allNo, kidney: 'ja' }).success).toBe(
      false,
    );
    expect(
      supplementScreeningAnswersSchema.safeParse({ ...allNo, protein_self_check: 'egal' }).success,
    ).toBe(false);
  });

  it('Stillzeit nicht bei „männlich“, Pflicht bei allen anderen', () => {
    const withoutBreastfeeding = { kidney: false, heart_rhythm: false, caffeine_sensitive: false };
    expect(supplementScreeningQuestionsFor('male').map((question) => question.id)).not.toContain(
      'breastfeeding',
    );
    expect(supplementScreeningQuestionsFor('female')).toHaveLength(4);
    expect(supplementScreeningQuestionsFor(null)).toHaveLength(4);
    expect(
      createSupplementScreeningAnswersSchema('male').safeParse(withoutBreastfeeding).success,
    ).toBe(true);
    expect(createSupplementScreeningAnswersSchema('male').safeParse(allNo).success).toBe(false);
    for (const sex of ['female', 'diverse', 'unspecified', null] as const) {
      expect(createSupplementScreeningAnswersSchema(sex).safeParse(allNo).success).toBe(true);
      expect(
        createSupplementScreeningAnswersSchema(sex).safeParse(withoutBreastfeeding).success,
      ).toBe(false);
    }
  });
});
