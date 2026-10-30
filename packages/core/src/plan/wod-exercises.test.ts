import { describe, expect, it } from 'vitest';

import {
  HYROX_ONLY_EXERCISE_IDS,
  LIBRARY_SEARCH_EXCLUDED_IDS,
  PAIN_REGION_LOAD,
  WOD_ONLY_EXERCISE_IDS,
} from '../constants';
import { equipmentProfile, findSubstitute } from './equipment-profile';
import { swapCandidates, type SwapContext } from './preferences';
import { planSafetyRules } from './safety';
import { EXERCISES, NOTHING, planned } from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';

/**
 * Übungen für Workouts im WOD-Stil (docs/PLAN-WORKOUTS.md W-O6): nur über Workouts bzw. ihre eigenen Alternativen –
 * nie über die Bibliotheks-Suche (Tausch, „Andere Übung“, Ersatz bei fehlendem Gerät). Sicherheits-Merkmale greifen.
 */

const healthy = planSafetyRules(person(), MONDAY);
const home = equipmentProfile('home', FULL_HOME);
const gym = equipmentProfile('gym', []);
const WOD = new Set(WOD_ONLY_EXERCISE_IDS);

function ctx(overrides: Partial<SwapContext> = {}): SwapContext {
  return {
    library: EXERCISES,
    profile: home,
    swapRules: healthy,
    preferences: [],
    location: 'home',
    inSession: new Set(),
    mode: 'always',
    ...overrides,
  };
}

const pair = (id: string) => ({ stored: planned(id), shown: planned(id) });

describe('WOD_ONLY_EXERCISE_IDS', () => {
  it('alle in der Bibliothek, getrennt von Hyrox, Teil der Bibliotheks-Sperre', () => {
    for (const id of WOD_ONLY_EXERCISE_IDS) {
      expect(EXERCISES.has(id), id).toBe(true);
      expect(HYROX_ONLY_EXERCISE_IDS).not.toContain(id);
      expect(LIBRARY_SEARCH_EXCLUDED_IDS).toContain(id);
    }
    for (const id of HYROX_ONLY_EXERCISE_IDS) expect(LIBRARY_SEARCH_EXCLUDED_IDS).toContain(id);
  });

  it('Tausch (zu Hause, Studio): keine andere Übung bekommt eine WOD-Übung als Kandidat', () => {
    for (const [profile, location] of [
      [home, 'home'],
      [gym, 'gym'],
    ] as const) {
      for (const id of EXERCISES.keys()) {
        if (WOD.has(id)) continue;
        const result = swapCandidates(pair(id), ctx({ profile, location }));
        expect(
          result.candidates.filter((c) => WOD.has(c.id)).map((c) => c.id),
          id,
        ).toEqual([]);
      }
    }
  });

  it('Ersatz bei fehlendem Gerät (Schritte 4/5): nie eine WOD-Übung', () => {
    for (const profile of [NOTHING, home, gym]) {
      for (const original of EXERCISES.values()) {
        if (WOD.has(original.id)) continue;
        const sub = findSubstitute(original, { library: EXERCISES, profile, rules: healthy });
        expect(sub === null || !WOD.has(sub.exercise.id), original.id).toBe(true);
      }
    }
  });

  it('WOD-Übung selbst tauschen: eigene Alternativen bleiben möglich (Box-Sprung → Kniebeuge)', () => {
    const result = swapCandidates(pair('box-sprung'), ctx());
    expect(result.candidates.map((c) => c.id)).toContain('kniebeuge-koerpergewicht');
  });

  it('Sicherheits-Merkmale: Sprünge, über Kopf und Wirbelsäulen-Last gesetzt; Thruster belastet das Knie stark', () => {
    const tags = (id: string) => EXERCISES.get(id)?.caution_tags ?? [];
    expect(tags('box-sprung')).toEqual(expect.arrayContaining(['high_impact', 'high_skill']));
    expect(tags('seilspringen')).toContain('high_impact');
    expect(tags('double-unders')).toEqual(expect.arrayContaining(['high_impact', 'high_skill']));
    expect(tags('thruster-langhantel')).toEqual(
      expect.arrayContaining(['overhead', 'spinal_loading']),
    );
    expect(PAIN_REGION_LOAD.knee.strong).toContainEqual({ exercise: 'thruster-langhantel' });
    // Vorsichtiger Plan (z. B. Schwangerschaft): Sprünge und Wirbelsäulen-Last sind ausgeschlossen.
    const pregnant = planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY);
    for (const id of WOD_ONLY_EXERCISE_IDS) {
      expect(
        tags(id).some((t) => pregnant.excludedCautionTags.includes(t)),
        id,
      ).toBe(true);
    }
  });
});
