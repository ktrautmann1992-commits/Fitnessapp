import { describe, expect, it } from 'vitest';

import type { DraftTarget } from '@/data/workout-draft';

import { hintText, targetNotes, targetText } from './workout-format';

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
