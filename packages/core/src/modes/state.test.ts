import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { WorkoutItem } from '../log/workout';
import { ex, planned } from '../plan/swap-test-helpers';
import { painEffectOn, type PainEpisode } from './pain';
import { displayModesOn, EMPTY_TRAINING_MODES, modesBanner } from './state';
import { travelOnDay, type TravelMode } from './travel';
import { restrictWorkoutItems } from './workout';

const TODAY = '2026-10-25';
const pain = (over: Partial<PainEpisode> = {}): PainEpisode => ({
  id: '00000000-0000-4000-8000-000000000001',
  region: 'knee',
  intensity: 'moderate',
  duration_days: 7,
  started_on: TODAY,
  ended_early_on: null,
  created_at: `${TODAY}T08:00:00Z`,
  ...over,
});
const trip = (over: Partial<TravelMode> = {}): TravelMode => ({
  id: '00000000-0000-4000-8000-000000000002',
  starts_on: addDays(TODAY, 2),
  ends_on: addDays(TODAY, 5),
  equipment: 'dumbbells',
  max_minutes: null,
  created_at: `${TODAY}T08:00:00Z`,
  ...over,
});

describe('displayModesOn / modesBanner', () => {
  it('ohne Stand bzw. leer: keine Modi, kein Banner', () => {
    expect(displayModesOn(null, TODAY)).toEqual({});
    expect(displayModesOn(EMPTY_TRAINING_MODES, TODAY)).toEqual({ travel: null, pain: null });
    expect(modesBanner(null, TODAY)).toEqual({ travel: null, pain: null });
  });

  it('wirkt am Tag der Einheit (nicht heute): Reise erst ab Beginn', () => {
    const state = { pain: [pain()], travel: [trip()] };
    expect(displayModesOn(state, TODAY).travel).toBeNull();
    expect(displayModesOn(state, addDays(TODAY, 3)).travel?.equipment).toBe('dumbbells');
    expect(displayModesOn(state, addDays(TODAY, 7)).pain).toBeNull();
  });

  it('Banner: künftige Reise „vom … bis …“, laufende „bis …“; Schmerz mit Angabe der Person', () => {
    const banner = modesBanner({ pain: [pain()], travel: [trip()] }, TODAY);
    expect(banner.travel).toMatchObject({ active: false, startsOn: addDays(TODAY, 2) });
    expect(banner.pain).toEqual({
      regions: [{ region: 'knee', intensity: 'moderate' }],
      until: addDays(TODAY, 6),
      advice: [],
    });
    const running = modesBanner({ pain: [], travel: [trip({ starts_on: TODAY })] }, TODAY);
    expect(running.travel?.active).toBe(true);
    // Stark → Arzt-Hinweis im Banner, Angabe bleibt „stark“.
    const severe = modesBanner({ pain: [pain({ intensity: 'severe' })], travel: [] }, TODAY);
    expect(severe.pain?.advice).toEqual(['severe']);
  });
});

describe('restrictWorkoutItems (Trainingsmodus)', () => {
  const item = (id: string, alternatives: string[], hint: 'harder_variant' | null): WorkoutItem =>
    ({
      plannedOrderNo: 1,
      storedExerciseId: id,
      shown: planned(id, { sets: 2 }),
      reference: { templateSets: 3, rpeTarget: 8 },
      alternatives: alternatives.map(ex),
      plan: {
        hint: { hint, harderVariant: hint ? { exerciseId: 'x', nameDe: 'x' } : null },
        prescription: { sets: 3, extraSet: true },
      },
    }) as unknown as WorkoutItem;

  it('ohne Modus unverändert', () => {
    const items = [item('beinpresse', ['goblet-kniebeuge'], 'harder_variant')];
    expect(restrictWorkoutItems(items, {})).toEqual(items);
  });

  it('Schmerz: keine gesperrte Alternative, kein Steigerungs-Hinweis, kein Zusatzsatz', () => {
    const effect = painEffectOn([pain()], TODAY)!;
    const [result] = restrictWorkoutItems(
      [item('glute-bridge', ['goblet-kniebeuge', 'hip-thrust-sofa'], 'harder_variant')],
      { pain: effect },
    );
    expect(result!.alternatives.map((a) => a.id)).toEqual(['hip-thrust-sofa']);
    expect(result!.plan!.hint).toEqual({ hint: null, harderVariant: null });
    expect(result!.plan!.prescription).toMatchObject({ sets: 2, extraSet: false });
  });

  it('Reise: nur mit den Reise-Geräten machbare Alternativen', () => {
    const travel = travelOnDay([trip({ starts_on: TODAY, equipment: 'bodyweight' })], TODAY)!;
    const [result] = restrictWorkoutItems(
      [item('goblet-kniebeuge', ['kniebeuge-koerpergewicht', 'beinpresse'], null)],
      { travel },
    );
    expect(result!.alternatives.map((a) => a.id)).toEqual(['kniebeuge-koerpergewicht']);
    expect(result!.plan!.prescription).toMatchObject({ sets: 3, extraSet: true });
  });
});
