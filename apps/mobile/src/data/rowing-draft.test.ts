import { cardioLogFromInput } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { cardioInputOf, type DraftCardio, draftCardioFromRow } from './workout-draft';

/** Sportarten Stufe 1 · Etappe R: Ruder-Werte im Entwurf (Text) → Eingabe für packages/core und zurück. */
describe('Rudern im Ausdauer-Entwurf', () => {
  const draft: DraftCardio = {
    modality: 'row',
    hours: '0',
    minutes: '20',
    distanceKm: '4,8',
    elevationM: '',
    powerW: '180',
    strokeRate: '22',
    intervals: [
      { distanceM: '500', time: '1:58' },
      { distanceM: '', time: '' },
    ],
  };

  it('Text → Zahlen; leere Intervall-Zeilen zählen nicht', () => {
    const result = cardioLogFromInput(cardioInputOf(draft));
    expect(result).toEqual({
      ok: true,
      cardio: {
        modality: 'row',
        duration_s: 1200,
        distance_m: 4800,
        elevation_m: null,
        avg_power_w: 180,
        stroke_rate: 22,
        intervals: [{ distance_m: 500, duration_s: 118 }],
      },
    });
  });

  it('unlesbare Zeit oder halbe Zeile → Fehler am Feld „intervals“', () => {
    const result = cardioLogFromInput(
      cardioInputOf({ ...draft, intervals: [{ distanceM: '500', time: '1:7x' }] }),
    );
    expect(result).toEqual({ ok: false, errors: { intervals: 'intervals_invalid' } });
  });

  it('andere Art: Ruder-Felder werden nicht gesendet', () => {
    const result = cardioLogFromInput(cardioInputOf({ ...draft, modality: 'run' }));
    expect(result.ok && 'avg_power_w' in result.cardio).toBe(false);
  });

  it('gespeicherte Zeile → Entwurf (Intervalle geprüft, Zeit als m:ss)', () => {
    const back = draftCardioFromRow({
      modality: 'row',
      duration_s: 1200,
      distance_m: 4800,
      elevation_m: null,
      avg_power_w: 180,
      stroke_rate: null,
      intervals: [{ distance_m: 500, duration_s: 118 }],
    });
    expect(back.powerW).toBe('180');
    expect(back.strokeRate).toBe('');
    expect(back.intervals).toEqual([{ distanceM: '500', time: '1:58' }]);
    expect(
      draftCardioFromRow({
        modality: 'row',
        duration_s: 1200,
        distance_m: null,
        elevation_m: null,
        intervals: 'kaputt',
      }).intervals,
    ).toEqual([]);
    expect(
      'powerW' in
        draftCardioFromRow({
          modality: 'run',
          duration_s: 60,
          distance_m: null,
          elevation_m: null,
        }),
    ).toBe(false);
  });
});
