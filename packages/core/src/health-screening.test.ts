import { describe, expect, it } from 'vitest';

import {
  createHealthScreeningAnswersSchema,
  evaluateHealthScreening,
  HEALTH_FLAGS,
  HEALTH_SCREENING_QUESTIONS,
  type HealthScreeningAnswers,
  requiresMedicalNotice,
  screeningQuestionsFor,
} from './health-screening';

/** Kopie ohne den angegebenen Schlüssel (simuliert eine nicht gestellte/fehlende Frage). */
function without<K extends keyof HealthScreeningAnswers>(answers: HealthScreeningAnswers, key: K) {
  const copy: Partial<HealthScreeningAnswers> = { ...answers };
  delete copy[key];
  return copy;
}

const allNo: HealthScreeningAnswers = {
  heart_condition: false,
  chest_pain_exercise: false,
  chest_pain_rest: false,
  dizziness: false,
  blood_pressure: false,
  bone_joint: false,
  pregnancy: false,
  medication: false,
  other_reason: false,
};

describe('Fragenkatalog', () => {
  it('hat eindeutige IDs und deutsche Texte mit Fragezeichen', () => {
    const ids = HEALTH_SCREENING_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const question of HEALTH_SCREENING_QUESTIONS) {
      expect(question.textDe.endsWith('?')).toBe(true);
    }
  });

  it('stellt die Schwangerschafts-Frage nicht bei „männlich“', () => {
    expect(screeningQuestionsFor('male').map((q) => q.id)).not.toContain('pregnancy');
    expect(screeningQuestionsFor('male')).toHaveLength(HEALTH_SCREENING_QUESTIONS.length - 1);
  });

  it('stellt die Schwangerschafts-Frage bei weiblich, divers, keine Angabe und unbekannt', () => {
    for (const sex of ['female', 'diverse', 'unspecified', null, undefined] as const) {
      expect(screeningQuestionsFor(sex).map((q) => q.id)).toContain('pregnancy');
    }
  });
});

describe('evaluateHealthScreening', () => {
  it('alles nein → keine Flags, kein Arzt-Hinweis', () => {
    const flags = evaluateHealthScreening(allNo);
    expect(flags).toEqual([]);
    expect(requiresMedicalNotice(flags)).toBe(false);
  });

  it('alles ja → alle Flags in fester Reihenfolge', () => {
    const allYes = Object.fromEntries(
      Object.keys(allNo).map((key) => [key, true]),
    ) as HealthScreeningAnswers;
    const flags = evaluateHealthScreening(allYes);
    expect(flags).toEqual([...HEALTH_FLAGS]);
    expect(requiresMedicalNotice(flags)).toBe(true);
  });

  it('nur Schwangerschaft → pregnancy + conservative_plan, keine ärztliche Abklärung wegen Herz', () => {
    expect(evaluateHealthScreening({ ...allNo, pregnancy: true })).toEqual([
      'pregnancy',
      'conservative_plan',
    ]);
  });

  it.each([
    'heart_condition',
    'chest_pain_exercise',
    'chest_pain_rest',
    'dizziness',
    'blood_pressure',
    'other_reason',
  ] as const)('%s = ja → ärztliche Abklärung empfohlen', (id) => {
    expect(evaluateHealthScreening({ ...allNo, [id]: true })).toEqual([
      'medical_clearance_recommended',
      'conservative_plan',
    ]);
  });

  it('nur Knochen/Gelenke → injury', () => {
    expect(evaluateHealthScreening({ ...allNo, bone_joint: true })).toEqual([
      'injury',
      'conservative_plan',
    ]);
  });

  it('nur Medikamente → medication', () => {
    expect(evaluateHealthScreening({ ...allNo, medication: true })).toEqual([
      'medication',
      'conservative_plan',
    ]);
  });

  it('mehrere Herz-Fragen ergeben das Flag nur einmal', () => {
    const flags = evaluateHealthScreening({ ...allNo, heart_condition: true, dizziness: true });
    expect(flags).toEqual(['medical_clearance_recommended', 'conservative_plan']);
  });

  it('Männer ohne Schwangerschafts-Antwort werden ausgewertet', () => {
    expect(evaluateHealthScreening(without(allNo, 'pregnancy') as HealthScreeningAnswers)).toEqual(
      [],
    );
  });

  it('lehnt unvollständige oder fremde Antworten ab', () => {
    const incomplete = without(allNo, 'heart_condition') as HealthScreeningAnswers;
    expect(() => evaluateHealthScreening(incomplete)).toThrow();
    expect(() =>
      evaluateHealthScreening({ ...allNo, smoking: true } as unknown as HealthScreeningAnswers),
    ).toThrow();
    expect(() =>
      evaluateHealthScreening({ ...allNo, medication: 'ja' } as unknown as HealthScreeningAnswers),
    ).toThrow();
  });
});

describe('createHealthScreeningAnswersSchema', () => {
  it('verlangt die Schwangerschafts-Antwort bei weiblich/divers/keine Angabe', () => {
    const withoutPregnancy = without(allNo, 'pregnancy');
    for (const sex of ['female', 'diverse', 'unspecified'] as const) {
      expect(createHealthScreeningAnswersSchema(sex).safeParse(withoutPregnancy).success).toBe(
        false,
      );
      expect(createHealthScreeningAnswersSchema(sex).safeParse(allNo).success).toBe(true);
    }
  });

  it('verbietet die Schwangerschafts-Antwort bei „männlich“', () => {
    const withoutPregnancy = without(allNo, 'pregnancy');
    expect(createHealthScreeningAnswersSchema('male').safeParse(withoutPregnancy).success).toBe(
      true,
    );
    expect(createHealthScreeningAnswersSchema('male').safeParse(allNo).success).toBe(false);
  });
});
