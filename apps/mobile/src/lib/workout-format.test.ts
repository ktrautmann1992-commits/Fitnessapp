import { describe, expect, it } from 'vitest';

import type { DraftTarget } from '@/data/workout-draft';

import { cardioSpeed } from '@fitnessapp/core';

import {
  cardioSpeedTexts,
  hintText,
  restTexts,
  targetNotes,
  targetSummary,
  targetText,
} from './workout-format';

function target(overrides: Partial<DraftTarget> = {}): DraftTarget {
  return {
    exerciseId: 'goblet-kniebeuge',
    nameDe: 'Goblet-Kniebeuge',
    loadType: 'weight',
    incrementKind: 'free_weight',
    perPiece: 'dumbbell',
    steps: [],
    targets: {
      target_sets: 3,
      reps_min: 8,
      reps_max: 12,
      target_reps: 10,
      target_extra_set: false,
      target_weight_kg: 22.5,
      target_duration_s: null,
      target_rpe: 7,
      is_return: false,
    },
    state: {
      state_weight_kg: 22.5,
      state_target_reps: 10,
      state_extra_set: false,
      state_duration_s: null,
    },
    heavierReferenceKg: 22.5,
    lighterReferenceKg: 22.5,
    chooseLightest: false,
    source: 'logs',
    hint: null,
    harderVariantName: null,
    ...overrides,
  };
}

describe('workout-format', () => {
  it('Vorgabe „3 × 10 mit 22,5 kg je Hantel“; Halteübung; ohne Gewicht', () => {
    expect(targetText(target())).toBe('3 × 10 Wiederholungen mit 22,5 kg je Hantel');
    expect(
      targetText(
        target({ loadType: 'time', targets: { ...target().targets, target_duration_s: 30 } }),
      ),
    ).toBe('3 × 30 Sekunden halten');
    expect(
      targetText(
        target({ targets: { ...target().targets, target_weight_kg: null, target_reps: null } }),
      ),
    ).toBe('3 × 8–12 Wiederholungen');
    expect(
      targetNotes(target({ targets: { ...target().targets, target_weight_kg: null } }))[0],
    ).toMatch(/^Startgewicht finden/);
  });

  it('Pflichtpunkt: „schwerere Variante“ NUR mit Variantennamen (progressHintForDisplay), sonst kein Hinweis', () => {
    expect(hintText({ hint: 'harder_variant', harderVariantName: null })).toBeNull();
    expect(hintText({ hint: 'harder_variant', harderVariantName: 'Tisch-Rudern' })).toContain(
      '„Tisch-Rudern“',
    );
    expect(hintText({ hint: 'no_heavier_weight', harderVariantName: null })).toMatch(/schwerere/);
    expect(hintText({ hint: null, harderVariantName: null })).toBeNull();
  });
});

describe('Ausdauer und Pausentimer (Etappe C2)', () => {
  it('Laufen: Pace je km und km/h mit Komma; Bildschirmleser mit ausgeschriebenen Einheiten', () => {
    const speed = cardioSpeed('run', 1980, 6000);
    if (!speed) throw new Error('keine Anzeige');
    expect(cardioSpeedTexts(speed)).toEqual([
      { text: 'Pace: 5:30 min/km', a11y: 'Pace: 5 Minuten 30 Sekunden pro Kilometer' },
      { text: 'Geschwindigkeit: 10,9 km/h', a11y: 'Geschwindigkeit: 10,9 Kilometer pro Stunde' },
    ]);
  });

  it('Rad nur km/h, Schwimmen Pace je 100 m', () => {
    const bike = cardioSpeed('bike', 3600, 25_300);
    const swim = cardioSpeed('swim', 1500, 1000);
    if (!bike || !swim) throw new Error('keine Anzeige');
    expect(cardioSpeedTexts(bike).map((l) => l.text)).toEqual(['Geschwindigkeit: 25,3 km/h']);
    expect(cardioSpeedTexts(swim)).toEqual([
      { text: 'Pace: 2:30 min/100 m', a11y: 'Pace: 2 Minuten 30 Sekunden pro 100 Meter' },
    ]);
  });

  it('Restzeit der Pause', () => {
    expect(restTexts(90)).toEqual({ text: '1:30', a11y: 'Pause, noch 1 Minute 30 Sekunden' });
    expect(restTexts(45)).toEqual({ text: '0:45', a11y: 'Pause, noch 45 Sekunden' });
    expect(restTexts(125).a11y).toBe('Pause, noch 2 Minuten 5 Sekunden');
  });

  it('Übungsliste (Entwurf B): Zahlen getrennt, Gewicht bzw. „Gewicht selbst finden“, Ansage in Worten', () => {
    expect(targetSummary(target(), 90)).toEqual({
      sets: 3,
      dose: '3 × 10',
      rest: '1:30 Pause',
      reserve: '3 in Reserve',
      weight: '22,5 kg je Hantel',
      findWeight: null,
      notes: [],
      a11y: '3 Sätze à 10 Wiederholungen, Pause 90 Sekunden, 3 Wiederholungen in Reserve, Gewicht 22,5 kg je Hantel',
    });
    const find = targetSummary(
      target({ targets: { ...target().targets, target_weight_kg: null, target_rpe: 7.5 } }),
      60,
    );
    expect(find.weight).toBeNull();
    expect(find.findWeight).toBe('find');
    expect(find.rest).toBe('1:00 Pause');
    expect(find.reserve).toBe('2–3 in Reserve');
    expect(find.a11y).toContain('Pause 1 Minute');
    expect(find.a11y).toContain('Gewicht selbst finden');
    expect(
      targetSummary(
        target({ chooseLightest: true, targets: { ...target().targets, target_weight_kg: null } }),
        60,
      ).findWeight,
    ).toBe('lightest');
  });

  it('Übungsliste: Halteübung, Körpergewicht, ein Satz, Hinweise', () => {
    const hold = targetSummary(
      target({
        loadType: 'time',
        targets: { ...target().targets, target_sets: 1, target_duration_s: 30, target_rpe: null },
      }),
      45,
    );
    expect(hold.dose).toBe('1 × 30 s');
    expect(hold.rest).toBe('45 s Pause');
    expect(hold.reserve).toBeNull();
    expect(hold.findWeight).toBeNull();
    expect(hold.a11y).toBe('1 Satz à 30 Sekunden halten, Pause 45 Sekunden');
    const bodyweight = targetSummary(
      target({
        loadType: 'bodyweight',
        source: 'start_weight',
        hint: 'no_heavier_weight',
        targets: { ...target().targets, target_weight_kg: null, is_return: true },
      }),
      120,
    );
    expect(bodyweight.weight).toBeNull();
    expect(bodyweight.findWeight).toBeNull();
    expect(bodyweight.rest).toBe('2:00 Pause');
    expect(bodyweight.notes).toEqual([
      'Vorschlag aus deinem Startgewicht',
      'Wiedereinstieg nach Pause: heute etwas leichter.',
      expect.stringMatching(/schwerere/),
    ]);
  });
});
