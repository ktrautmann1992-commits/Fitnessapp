import { describe, expect, it } from 'vitest';

import { EXERCISE_PREFERENCE_LIMITS, SWAP_RULES } from '../constants';
import type { EquipmentLocation } from '../enums';
import { equipmentProfile } from './equipment-profile';
import { canExclude, type ExercisePair, swapCandidates } from './preferences';
import { planSafetyRules } from './safety';
import {
  alwaysAllowedFor,
  applyPreferenceChanges,
  exclusionOverview,
  KEY_PATTERN_GROUP_CODES,
  missingKeyGroups,
  preferenceChainFrom,
  preferenceSaveChanges,
  swapChoices,
  type SwapChoicesContext,
} from './swap-choices';
import { ex, EXERCISES, NOTHING, planned, pref, TS } from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';

const healthy = planSafetyRules(person(), MONDAY);
const pregnant = planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY);
const home = equipmentProfile('home', FULL_HOME);
const gym = equipmentProfile('gym', []);
const NOW = '2026-10-07T09:00:00Z';

function pair(storedId: string, shownId = storedId): ExercisePair {
  return { stored: planned(storedId), shown: planned(shownId), storedOrderNo: 1 };
}

function ctx(overrides: Partial<SwapChoicesContext> = {}): SwapChoicesContext {
  return {
    library: EXERCISES,
    profiles: new Map<EquipmentLocation, { available: ReadonlySet<string> }>([
      ['home', home],
      ['gym', gym],
    ]),
    swapRules: healthy,
    preferences: [],
    location: 'home',
    inSession: new Set(),
    ...overrides,
  };
}

const ids = (list: readonly { id: string }[]) => list.map((e) => e.id);

/** Unabhängige Gegenprobe: genau die Übungen, die canExclude() als Ersatz an diesem Ort annimmt. */
function acceptedByCanExclude(p: ExercisePair, location: EquipmentLocation, c: SwapChoicesContext) {
  return [...EXERCISES.keys()].filter(
    (id) =>
      id !== p.shown.exercise_id &&
      canExclude(p, pref(p.shown.exercise_id, location, 'dislike', id), c).ok,
  );
}

describe('swapChoices (Tausch-Dialog, Etappe T2)', () => {
  it('„Nur heute“ = swapCandidates(…, today); „immer“ = was canExclude annimmt', () => {
    const p = pair('goblet-kniebeuge');
    const c = ctx();
    const choices = swapChoices(p, c);
    expect(ids(choices.today)).toEqual(
      ids(swapCandidates(p, { ...c, profile: home, mode: 'today' }).candidates),
    );
    expect(choices.today.length).toBeGreaterThan(0);
    expect(choices.locations).toEqual(['home']);
    expect([...(choices.always.get('home') ?? [])].sort()).toEqual(
      acceptedByCanExclude(p, 'home', c).sort(),
    );
    expect(choices.always.has('gym')).toBe(false);
    expect(choices.reason).toBeNull();
    expect(choices.limitReached).toBe(false);
  });

  it('mehrdeutiger Ort: beide Orte wählbar, je Ort mit DESSEN Geräten (Gegenprobe canExclude)', () => {
    const p = pair('goblet-kniebeuge');
    const c = ctx({
      ambiguousLocation: true,
      profiles: new Map<EquipmentLocation, { available: ReadonlySet<string> }>([
        ['home', NOTHING],
        ['gym', gym],
      ]),
    });
    const choices = swapChoices(p, c);
    expect(choices.locations).toEqual(['home', 'gym']);
    for (const location of ['home', 'gym'] as const) {
      expect([...(choices.always.get(location) ?? [])].sort()).toEqual(
        acceptedByCanExclude(p, location, c).sort(),
      );
    }
    // Ohne Geräte zu Hause nur Körpergewicht – im Studio mehr.
    const atHome = [...(choices.always.get('home') ?? [])];
    expect(atHome.every((id) => ex(id).equipment_ids.length === 0)).toBe(true);
    expect((choices.always.get('gym')?.size ?? 0) > atHome.length).toBe(true);
  });

  it('schwerere Variante nur „heute“ (am Ende), nie „immer“', () => {
    const p = pair('kniebeuge-koerpergewicht');
    const regular = ids(swapChoices(p, ctx()).today);
    // Schwerere Alternative, die NICHT schon regulär (gleich schwer) angeboten wird.
    const variantId =
      ex('kniebeuge-koerpergewicht').alternatives.find(
        (a) => a.reason === 'harder' && !regular.includes(a.alternative_id),
      )?.alternative_id ?? '';
    expect(variantId).not.toBe('');
    expect(ex(variantId).difficulty).toBeGreaterThan(ex('kniebeuge-koerpergewicht').difficulty);
    const choices = swapChoices(p, ctx({ harderVariantId: variantId }));
    expect(choices.today.at(-1)?.id).toBe(variantId);
    expect(choices.always.get('home')?.has(variantId)).toBe(false);
    expect(alwaysAllowedFor(choices, 'home', variantId)).toBe(false);
  });

  it('eigene Präferenz auf die angezeigte Übung blockiert „immer“ nicht; fremde Ausschlüsse fehlen', () => {
    const p = pair('goblet-kniebeuge');
    const without = swapChoices(p, ctx());
    const first = without.today[0]?.id ?? '';
    const own = swapChoices(
      p,
      ctx({ preferences: [pref('goblet-kniebeuge', 'home', 'dislike', first)] }),
    );
    expect([...(own.always.get('home') ?? [])]).toEqual([...(without.always.get('home') ?? [])]);
    const excluded = swapChoices(p, ctx({ preferences: [pref(first, 'home', 'not_feasible')] }));
    expect(ids(excluded.today)).not.toContain(first);
    expect(excluded.always.get('home')?.has(first)).toBe(false);
  });

  it('Sicherheit: Untergrenze (swapRules) gilt für „heute“ und „immer“', () => {
    const p = pair('hip-thrust-langhantel');
    const choices = swapChoices(p, ctx({ swapRules: pregnant, location: 'gym' }));
    const all = [...ids(choices.today), ...(choices.always.get('gym') ?? [])];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((id) => !ex(id).caution_tags.includes('long_supine'))).toBe(true);
  });

  it('Obergrenze erreicht → „immer“ leer, Hinweis; Änderung einer vorhandenen zählt nicht neu', () => {
    const others = [...EXERCISES.keys()]
      .filter((id) => id !== 'goblet-kniebeuge')
      .slice(0, EXERCISE_PREFERENCE_LIMITS.maxPerUser)
      .map((id, i) => pref(id, i % 2 === 0 ? 'home' : 'gym', 'dislike'));
    if (others.length < EXERCISE_PREFERENCE_LIMITS.maxPerUser) {
      // Weniger Übungen als die Obergrenze: Einträge über beide Orte doppeln.
      others.push(
        ...others
          .slice(0, EXERCISE_PREFERENCE_LIMITS.maxPerUser - others.length)
          .map((p) => ({ ...p, location: p.location === 'home' ? 'gym' : 'home' }) as const),
      );
    }
    expect(others).toHaveLength(EXERCISE_PREFERENCE_LIMITS.maxPerUser);
    const full = swapChoices(pair('goblet-kniebeuge'), ctx({ preferences: others }));
    expect(full.limitReached).toBe(true);
    expect(full.always.get('home')?.size).toBe(0);
    expect(alwaysAllowedFor(full, 'home', null)).toBe(false);
    const updating = swapChoices(
      pair('goblet-kniebeuge'),
      ctx({
        preferences: [
          ...others.slice(0, -1),
          pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-koerpergewicht'),
        ],
      }),
    );
    expect(updating.limitReached).toBe(false);
  });

  it('Kette X → Y: „immer“ nur mit Kandidaten, die nach dem Ausschluss von Y auch für X gelten', () => {
    const x = 'kniebeuge-langhantel';
    const base = ctx({ location: 'gym' });
    const forX = swapChoices(pair(x), base);
    const y = forX.today[0]?.id ?? '';
    expect(y).not.toBe('');
    const prefs = [pref(x, 'gym', 'dislike', y)];
    const chained = swapChoices(pair(x, y), { ...base, preferences: prefs, chainFromId: x });
    const plain = swapChoices(pair(x, y), { ...base, preferences: prefs });
    const ids = [...(chained.always.get('gym') ?? [])];
    // Teilmenge der normalen „immer“-Liste …
    expect(ids.every((id) => plain.always.get('gym')?.has(id))).toBe(true);
    // … und jeder Kandidat besteht canExclude für X, wenn Y ausgeschlossen ist (unabhängige Gegenprobe).
    for (const id of ids) {
      expect(
        canExclude(pair(x), pref(x, 'gym', 'dislike', id), {
          ...base,
          preferences: [pref(y, 'gym', 'dislike')],
        }).ok,
      ).toBe(true);
    }
    // Ohne Präferenz auf X am Ort: keine Einschränkung.
    const noChainPref = swapChoices(pair(x, y), { ...base, chainFromId: x });
    expect([...(noChainPref.always.get('gym') ?? [])]).toEqual([
      ...(swapChoices(pair(x, y), base).always.get('gym') ?? []),
    ]);
  });

  it('kein Kandidat: Grund no_candidate, „immer“ leer (Türrahmen-Rudern ohne Geräte, S-4)', () => {
    const choices = swapChoices(
      pair('tuerrahmen-rudern'),
      ctx({
        profiles: new Map<EquipmentLocation, { available: ReadonlySet<string> }>([
          ['home', NOTHING],
          ['gym', gym],
        ]),
      }),
    );
    expect(choices.today).toEqual([]);
    expect(choices.reason).toBe('no_candidate');
    expect(alwaysAllowedFor(choices, 'home', null)).toBe(false);
  });

  it('Bibliothek fehlt → library_missing', () => {
    const choices = swapChoices(pair('gibt-es-nicht'), ctx());
    expect(choices.reason).toBe('library_missing');
    expect(choices.today).toEqual([]);
  });
});

describe('alwaysAllowedFor', () => {
  const choices = {
    always: new Map<EquipmentLocation, ReadonlySet<string>>([
      ['home', new Set(['a'])],
      ['gym', new Set()],
    ]),
  };
  it('Ort und Kandidat', () => {
    expect(alwaysAllowedFor(choices, 'home', 'a')).toBe(true);
    expect(alwaysAllowedFor(choices, 'home', null)).toBe(true);
    expect(alwaysAllowedFor(choices, 'home', 'b')).toBe(false);
    expect(alwaysAllowedFor(choices, 'gym', null)).toBe(false);
    // Ort noch nicht gewählt: möglich, sobald an irgendeinem Ort ein Kandidat existiert.
    expect(alwaysAllowedFor(choices, null, null)).toBe(true);
    expect(alwaysAllowedFor({ always: new Map() }, null, null)).toBe(false);
  });
});

describe('preferenceSaveChanges / applyPreferenceChanges', () => {
  it('neue Präferenz; Rückgängig entfernt sie wieder', () => {
    const before = [pref('liegestuetz', 'gym', 'dislike')];
    const save = preferenceSaveChanges({
      preferences: before,
      shownExerciseId: 'goblet-kniebeuge',
      chainFromId: null,
      location: 'home',
      kind: 'not_feasible',
      replacementId: 'kniebeuge-koerpergewicht',
      now: NOW,
    });
    expect(save.changes).toEqual([
      {
        op: 'upsert',
        preference: {
          exercise_id: 'goblet-kniebeuge',
          location: 'home',
          kind: 'not_feasible',
          replacement_exercise_id: 'kniebeuge-koerpergewicht',
          created_at: NOW,
          updated_at: NOW,
        },
      },
    ]);
    const after = applyPreferenceChanges(before, save.changes);
    expect(after).toHaveLength(2);
    expect(applyPreferenceChanges(after, save.undo)).toEqual(before);
  });

  it('vorhandene Präferenz: created_at bleibt, Rückgängig stellt die alte Fassung her', () => {
    const old = pref('goblet-kniebeuge', 'home', 'dislike', 'split-kniebeuge');
    const save = preferenceSaveChanges({
      preferences: [old],
      shownExerciseId: 'goblet-kniebeuge',
      chainFromId: null,
      location: 'home',
      kind: 'dislike',
      replacementId: 'kniebeuge-koerpergewicht',
      now: NOW,
    });
    const change = save.changes[0];
    expect(change?.op === 'upsert' ? change.preference.created_at : null).toBe(TS);
    expect(save.undo).toEqual([{ op: 'upsert', preference: old }]);
    expect(applyPreferenceChanges(applyPreferenceChanges([old], save.changes), save.undo)).toEqual([
      old,
    ]);
  });

  it('Kette X → Y: Präferenz auf Y und neuer Ersatz für X; Rückgängig erst Y, dann X', () => {
    const x = pref('kniebeuge-langhantel', 'gym', 'dislike', 'goblet-kniebeuge');
    const unrelatedHome = pref('kniebeuge-langhantel', 'home', 'dislike', 'goblet-kniebeuge');
    const save = preferenceSaveChanges({
      preferences: [x, unrelatedHome],
      shownExerciseId: 'goblet-kniebeuge',
      chainFromId: 'kniebeuge-langhantel',
      location: 'gym',
      kind: 'dislike',
      replacementId: 'beinpresse',
      now: NOW,
    });
    expect(save.changes.map((c) => (c.op === 'upsert' ? c.preference.exercise_id : null))).toEqual([
      'goblet-kniebeuge',
      'kniebeuge-langhantel',
    ]);
    const chained = save.changes[1];
    expect(chained?.op === 'upsert' ? chained.preference : null).toMatchObject({
      kind: 'dislike',
      location: 'gym',
      replacement_exercise_id: 'beinpresse',
      created_at: TS,
      updated_at: NOW,
    });
    expect(save.undo).toEqual([
      { op: 'remove', exercise_id: 'goblet-kniebeuge', location: 'gym' },
      { op: 'upsert', preference: x },
    ]);
    const after = applyPreferenceChanges([x, unrelatedHome], save.changes);
    // Die Präferenz am anderen Ort bleibt unberührt.
    expect(after).toContainEqual(unrelatedHome);
    expect(
      applyPreferenceChanges(after, save.undo).sort((a, b) => (a.location < b.location ? -1 : 1)),
    ).toEqual([x, unrelatedHome]);
  });

  it('Kette ohne Präferenz am Ort bzw. Ersatz = X: keine zweite Änderung', () => {
    const base = {
      shownExerciseId: 'goblet-kniebeuge',
      chainFromId: 'kniebeuge-langhantel',
      location: 'gym' as const,
      kind: 'dislike' as const,
      now: NOW,
    };
    expect(
      preferenceSaveChanges({
        ...base,
        preferences: [pref('kniebeuge-langhantel', 'home', 'dislike')],
        replacementId: 'beinpresse',
      }).changes,
    ).toHaveLength(1);
    expect(
      preferenceSaveChanges({
        ...base,
        preferences: [pref('kniebeuge-langhantel', 'gym', 'dislike')],
        replacementId: 'kniebeuge-langhantel',
      }).changes,
    ).toHaveLength(1);
  });

  it('preferenceChainFrom: nur Präferenz-Tausch dieser Position zur angezeigten Übung', () => {
    const swapped = [{ storedOrderNo: 2, from: 'a', to: 'b' }];
    expect(preferenceChainFrom(swapped, 2, 'b')).toBe('a');
    expect(preferenceChainFrom(swapped, 1, 'b')).toBeNull();
    expect(preferenceChainFrom(swapped, 2, 'c')).toBeNull();
    expect(preferenceChainFrom(undefined, 2, 'b')).toBeNull();
  });
});

describe('exclusionOverview (Einstellungen „Ausgeschlossene Übungen“)', () => {
  it('je Ort gruppiert (zu Hause zuerst), nach Name sortiert, Ersatz mit Namen', () => {
    const groups = exclusionOverview(
      [
        pref('liegestuetz', 'gym', 'dislike'),
        pref('kniebeuge-koerpergewicht', 'home', 'not_feasible'),
        pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-koerpergewicht'),
      ],
      { library: EXERCISES },
    );
    expect(groups.map((g) => g.location)).toEqual(['home', 'gym']);
    const homeNames = groups[0]?.entries.map((e) => e.name) ?? [];
    expect(homeNames).toEqual(
      [...homeNames].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'de')),
    );
    const goblet = groups[0]?.entries.find((e) => e.exerciseId === 'goblet-kniebeuge');
    expect(goblet).toMatchObject({
      kind: 'dislike',
      name: ex('goblet-kniebeuge').name_de,
      replacementName: ex('kniebeuge-koerpergewicht').name_de,
      available: true,
      replacementAvailable: true,
    });
    expect(groups.every((g) => !g.manyExclusions)).toBe(true);
  });

  it('archivierte Übung bzw. archivierter Ersatz: „nicht mehr verfügbar“ (K8), Name aus dem Nachschlagen', () => {
    const offered = new Map([...EXERCISES].filter(([id]) => id !== 'goblet-kniebeuge'));
    const [entry] =
      exclusionOverview([pref('goblet-kniebeuge', 'home', 'not_feasible', null)], {
        library: offered,
        lookup: EXERCISES,
      })[0]?.entries ?? [];
    expect(entry).toMatchObject({
      name: ex('goblet-kniebeuge').name_de,
      available: false,
      replacementAvailable: null,
    });
    const [withReplacement] =
      exclusionOverview([pref('kniebeuge-langhantel', 'gym', 'dislike', 'goblet-kniebeuge')], {
        library: offered,
        lookup: EXERCISES,
      })[0]?.entries ?? [];
    expect(withReplacement?.replacementAvailable).toBe(false);
    // Ganz unbekannt (nicht einmal nachschlagbar): ohne Namen, nicht verfügbar.
    const [unknown] =
      exclusionOverview([pref('gibt-es-nicht', 'home', 'dislike')], { library: offered })[0]
        ?.entries ?? [];
    expect(unknown).toMatchObject({ name: null, available: false });
  });

  it('Bibliothek fehlt: Verfügbarkeit unbekannt (null); leer → keine Gruppen', () => {
    const [entry] =
      exclusionOverview([pref('liegestuetz', 'home', 'dislike')], { library: null })[0]?.entries ??
      [];
    expect(entry).toMatchObject({ name: null, available: null });
    expect(exclusionOverview([], { library: EXERCISES })).toEqual([]);
  });

  it('Hinweis ab 10 Ausschlüssen an einem Ort; doppelte Einträge nur einmal (not_feasible gewinnt)', () => {
    const many = [...EXERCISES.keys()]
      .slice(0, EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice)
      .map((id) => pref(id, 'home', 'dislike'));
    const groups = exclusionOverview(
      [...many, pref(many[0]?.exercise_id ?? '', 'home', 'not_feasible')],
      { library: EXERCISES },
    );
    expect(groups[0]?.entries).toHaveLength(EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice);
    expect(groups[0]?.manyExclusions).toBe(true);
    expect(groups[0]?.entries.find((e) => e.exerciseId === many[0]?.exercise_id)?.kind).toBe(
      'not_feasible',
    );
    const fewer = exclusionOverview(many.slice(1), { library: EXERCISES });
    expect(fewer[0]?.manyExclusions).toBe(false);
  });
});

describe('missingKeyGroups (Grundbausteine, 4.2)', () => {
  it('je Gruppe aus SWAP_RULES.keyPatternGroups ein Code, feste Reihenfolge', () => {
    expect(KEY_PATTERN_GROUP_CODES).toHaveLength(SWAP_RULES.keyPatternGroups.length);
    expect(missingKeyGroups(undefined)).toEqual([]);
    expect(missingKeyGroups(['vertical_pull', 'horizontal_pull'])).toEqual(['pull']);
    expect(missingKeyGroups(['hinge', 'horizontal_pull'])).toEqual(['pull', 'hinge']);
    expect(missingKeyGroups(['squat'])).toEqual([]);
  });
});
