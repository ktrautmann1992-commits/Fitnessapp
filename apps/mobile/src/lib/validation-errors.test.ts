import { bodyMetricsStepSchema, createBodyMeasurementsInputSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { FORM_ERROR, fieldErrorsFromIssues } from './validation-errors';

describe('fieldErrorsFromIssues', () => {
  it('nimmt die deutschen Meldungen aus packages/core je Feld', () => {
    const result = bodyMetricsStepSchema.safeParse({ heightCm: 50, weightKg: 400 });
    expect(result.success).toBe(false);
    expect(fieldErrorsFromIssues(result.error?.issues ?? [])).toEqual({
      heightCm: 'Größe: mindestens 100 cm.',
      weightKg: 'Gewicht: höchstens 300 kg.',
    });
  });

  it('fehlende Werte → Ersatztext des Feldes', () => {
    const result = bodyMetricsStepSchema.safeParse({ heightCm: 170 });
    expect(
      fieldErrorsFromIssues(result.error?.issues ?? [], { weightKg: 'Bitte Gewicht angeben.' }),
    ).toEqual({
      weightKg: 'Bitte Gewicht angeben.',
    });
  });

  it('Fehler ohne Feld landen unter _form', () => {
    const result = createBodyMeasurementsInputSchema('2026-10-03').safeParse({});
    expect(fieldErrorsFromIssues(result.error?.issues ?? [])[FORM_ERROR]).toBe(
      'Bitte mindestens einen Umfang eintragen – oder den Schritt überspringen.',
    );
  });
});
