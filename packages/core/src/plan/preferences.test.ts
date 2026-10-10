import { describe, expect, it } from 'vitest';

import { EXERCISE_PREFERENCE_LIMITS, SWAP_RULES } from '../constants';
import { equipmentProfile } from './equipment-profile';
import {
  applyExercisePreferences,
  canExclude,
  type ExercisePair,
  exercisePreferenceSchema,
  exclusionCountAt,
  pairStoredAndShown,
  preferenceNotices,
  preferencesAt,
  removePreference,
  swapCandidates,
  type SwapContext,
  upsertPreference,
} from './preferences';
import { planSafetyRules } from './safety';
import { ex, EXERCISES, NOTHING, planned, pref, variantOf } from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';

const healthy = planSafetyRules(person(), MONDAY);
const pregnant = planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY);
const noCheck = planSafetyRules(person({ healthScreening: null }), MONDAY);
const gym = equipmentProfile('gym', []);
const home = equipmentProfile('home', FULL_HOME);

function pair(storedId: string, shownId = storedId, orderNo = 1): ExercisePair {
  return {
    stored: planned(storedId, { order_no: orderNo }),
    shown: planned(shownId, { order_no: orderNo }),
    storedOrderNo: orderNo,
  };
}

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

const ids = (list: readonly { id: string }[]) => list.map((e) => e.id);

describe('exercisePreferenceSchema', () => {
  it('nimmt gültige Präferenzen an, lehnt Gesundheitsgründe, Freitext und Selbst-Ersatz ab', () => {
    expect(
      exercisePreferenceSchema.safeParse(pref('glute-bridge', 'home', 'dislike')).success,
    ).toBe(true);
    expect(
      exercisePreferenceSchema.safeParse({
        ...pref('glute-bridge', 'home', 'dislike'),
        kind: 'pain',
      }).success,
    ).toBe(false);
    expect(
      exercisePreferenceSchema.safeParse({
        ...pref('glute-bridge', 'home', 'dislike'),
        note: 'Knie',
      }).success,
    ).toBe(false);
    expect(
      exercisePreferenceSchema.safeParse(pref('glute-bridge', 'home', 'dislike', 'glute-bridge'))
        .success,
    ).toBe(false);
    expect(
      exercisePreferenceSchema.safeParse({
        ...pref('glute-bridge', 'home', 'dislike'),
        location: 'both',
      }).success,
    ).toBe(false);
    expect(
      exercisePreferenceSchema.safeParse({ ...pref('Glute Bridge', 'home', 'dislike') }).success,
    ).toBe(false);
    expect(
      exercisePreferenceSchema.safeParse({
        ...pref('liegestuetz', 'home', 'dislike'),
        created_at: 'gestern',
      }).success,
    ).toBe(false);
  });
});

describe('preferencesAt / upsert / remove', () => {
  const list = [
    pref('glute-bridge', 'home', 'dislike', 'hueftstrecken-vierfuessler'),
    pref('glute-bridge', 'gym', 'not_feasible'),
    pref('liegestuetz', 'gym', 'dislike'),
  ];

  it('je Ort getrennt; „beides“ zählt als Studio (Ort gym)', () => {
    expect([...preferencesAt(list, 'home').keys()]).toEqual(['glute-bridge']);
    expect([...preferencesAt(list, 'gym').keys()].sort()).toEqual(['glute-bridge', 'liegestuetz']);
    expect(preferencesAt([], 'home').size).toBe(0);
  });

  it('mehrdeutiger Ort: Vereinigung, not_feasible vor dislike, Ersatz zuerst vom geratenen Ort', () => {
    const both = preferencesAt(list, 'home', true);
    expect(both.get('glute-bridge')?.kind).toBe('not_feasible');
    expect(both.get('glute-bridge')?.replacement_exercise_id).toBe('hueftstrecken-vierfuessler');
    expect(both.get('liegestuetz')?.kind).toBe('dislike');
    expect(exclusionCountAt(list, 'home', true)).toBe(2);
    expect(exclusionCountAt(list, 'home')).toBe(1);
  });

  it('doppelte Einträge am selben Ort (kaputter Speicher): not_feasible gewinnt', () => {
    const dup = [
      pref('liegestuetz', 'home', 'not_feasible'),
      pref('liegestuetz', 'home', 'dislike'),
    ];
    expect(preferencesAt(dup, 'home').get('liegestuetz')?.kind).toBe('not_feasible');
    expect(preferencesAt([...dup].reverse(), 'home').get('liegestuetz')?.kind).toBe('not_feasible');
  });

  it('upsert ersetzt Übung+Ort, remove löscht nur diesen Ort', () => {
    const updated = upsertPreference(list, pref('glute-bridge', 'home', 'not_feasible'));
    expect(updated).toHaveLength(3);
    expect(preferencesAt(updated, 'home').get('glute-bridge')?.kind).toBe('not_feasible');
    const removed = removePreference(updated, 'glute-bridge', 'home');
    expect(removed).toHaveLength(2);
    expect(preferencesAt(removed, 'gym').has('glute-bridge')).toBe(true);
  });
});

describe('swapCandidates (4.1)', () => {
  it('Reihenfolge: Alternativen, Alternativen der Alternativen, Bibliothek; Regeln S-1, S-3, S-4, S-5', () => {
    const result = swapCandidates(pair('goblet-kniebeuge'), ctx());
    expect(result.reason).toBeNull();
    expect(result.alwaysAllowed).toBe(true);
    expect(ids(result.candidates)[0]).toBe('kniebeuge-koerpergewicht');
    for (const c of result.candidates) {
      expect(c.movement_pattern).toBe('squat');
      expect(c.difficulty).toBeLessThanOrEqual(1);
      expect(c.load_type === 'time').toBe(false);
      expect(c.equipment_ids.every((id) => home.available.has(id))).toBe(true);
    }
    expect(result.candidates.length).toBeLessThanOrEqual(SWAP_RULES.maxCandidates);
  });

  it('S-3: Schwierigkeit ≤ min(gespeichert, angezeigt) – vorsichtiger Sicherheits-Ersatz wird nicht schwerer', () => {
    // S = Kniebeuge Langhantel (2), X = Goblet (1, Sicherheits-Ersatz)
    const result = swapCandidates(
      pair('kniebeuge-langhantel', 'goblet-kniebeuge'),
      ctx({ profile: gym }),
    );
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) expect(c.difficulty).toBeLessThanOrEqual(1);
    expect(ids(result.candidates)).not.toContain('kniebeuge-langhantel');
    expect(ids(result.candidates)).not.toContain('goblet-kniebeuge');
  });

  it('S-1 Stufe-5-Ersatz: Muster S oder X, immer mit gemeinsamem Hauptmuskel von S', () => {
    const stage5 = swapCandidates(
      pair('langhantelrudern', 'latziehen-band'),
      ctx({ profile: gym }),
    );
    expect(stage5.candidates.length).toBeGreaterThan(0);
    const patterns = new Set(stage5.candidates.map((c) => c.movement_pattern));
    for (const c of stage5.candidates) {
      expect(['horizontal_pull', 'vertical_pull']).toContain(c.movement_pattern);
      expect(
        c.primary_muscles.some((m) => ex('langhantelrudern').primary_muscles.includes(m)),
      ).toBe(true);
    }
    expect(patterns.has('vertical_pull')).toBe(true);
    // Ohne Stufe 5 (X mit Muster von S): nur das Muster von S.
    const normal = swapCandidates(pair('langhantelrudern', 'kabelrudern'), ctx({ profile: gym }));
    for (const c of normal.candidates) expect(c.movement_pattern).toBe('horizontal_pull');
  });

  it('S-4: nie Wiederholung ↔ Halten (Türrahmen-Rudern ohne Geräte hat keinen Kandidaten)', () => {
    const result = swapCandidates(pair('tuerrahmen-rudern'), ctx({ profile: NOTHING }));
    expect(ids(result.candidates)).not.toContain('handtuch-rudern-isometrisch');
    expect(result).toEqual({ candidates: [], alwaysAllowed: false, reason: 'no_candidate' });
    const plank = swapCandidates(pair('seitstuetz'), ctx({ profile: gym }));
    for (const c of plank.candidates) expect(c.load_type).toBe('time');
  });

  it('S-2: Sicherheitsregeln – Schwangerschaft keine Rückenlage, ohne Check kein overhead', () => {
    const preg = swapCandidates(pair('hueftstrecken-vierfuessler'), ctx({ swapRules: pregnant }));
    expect(ids(preg.candidates)).not.toContain('glute-bridge');
    const free = swapCandidates(pair('hueftstrecken-vierfuessler'), ctx());
    expect(ids(free.candidates)).toContain('glute-bridge');
    const press = swapCandidates(pair('schulterdruecken-kurzhantel'), ctx({ swapRules: noCheck }));
    for (const c of press.candidates) expect(c.caution_tags).not.toContain('overhead');
  });

  it('alle Kandidaten durch Gesundheitsregeln gesperrt → kein Kandidat, „immer“ nicht erlaubt', () => {
    const s = variantOf('kniebeuge-tempo', {
      alternatives: [
        { alternative_id: 'a-sprung', reason: 'easier', priority: 1 },
        { alternative_id: 'b-rueckenlage', reason: 'easier', priority: 2 },
      ],
    });
    const a = variantOf('kniebeuge-stuhl', { id: 'a-sprung', caution_tags: ['high_impact'] });
    const b = variantOf('kniebeuge-stuhl', { id: 'b-rueckenlage', caution_tags: ['long_supine'] });
    const library = new Map([
      [s.id, s],
      [a.id, a],
      [b.id, b],
    ]);
    const rules = { excludedCautionTags: ['high_impact', 'long_supine'] as const, cautious: true };
    const blocked = swapCandidates(pair(s.id), ctx({ library, swapRules: rules }));
    expect(blocked.reason).toBe('no_candidate');
    expect(blocked.alwaysAllowed).toBe(false);
    const open = swapCandidates(pair(s.id), ctx({ library, swapRules: healthy }));
    expect(ids(open.candidates)).toEqual(['a-sprung', 'b-rueckenlage']);
  });

  it('S-6 nicht schon in der Einheit, S-7 nicht ausgeschlossen am Ort, S-8 nur aus der Engine-Bibliothek', () => {
    const base = ids(swapCandidates(pair('goblet-kniebeuge'), ctx()).candidates);
    const first = base[0] as string;
    expect(
      ids(
        swapCandidates(pair('goblet-kniebeuge'), ctx({ inSession: new Set([first]) })).candidates,
      ),
    ).not.toContain(first);
    expect(
      ids(
        swapCandidates(
          pair('goblet-kniebeuge'),
          ctx({ preferences: [pref(first, 'home', 'dislike')] }),
        ).candidates,
      ),
    ).not.toContain(first);
    // Ausschluss nur im Studio → zu Hause weiter Kandidat; bei mehrdeutigem Ort nicht.
    const gymOnly = [pref(first, 'gym', 'dislike')];
    expect(
      ids(swapCandidates(pair('goblet-kniebeuge'), ctx({ preferences: gymOnly })).candidates),
    ).toContain(first);
    expect(
      ids(
        swapCandidates(
          pair('goblet-kniebeuge'),
          ctx({ preferences: gymOnly, ambiguousLocation: true }),
        ).candidates,
      ),
    ).not.toContain(first);
    // Archiviert (nur im Nachschlage-Verzeichnis) → nie Kandidat, S/X werden aber gefunden.
    const engine = new Map([...EXERCISES].filter(([id]) => id !== first));
    const archived = swapCandidates(
      pair('goblet-kniebeuge'),
      ctx({ library: engine, lookup: EXERCISES }),
    );
    expect(ids(archived.candidates)).not.toContain(first);
    expect(archived.reason).toBeNull();
  });

  it('unbekannte Übung (Bibliothek fehlt) bzw. ohne Geräte-Profil', () => {
    expect(swapCandidates(pair('gibt-es-nicht'), ctx()).reason).toBe('library_missing');
    expect(swapCandidates(pair('goblet-kniebeuge'), ctx({ library: new Map() })).reason).toBe(
      'library_missing',
    );
    expect(swapCandidates(pair('goblet-kniebeuge'), ctx({ profile: null })).reason).toBe(
      'no_candidate',
    );
  });

  it('schwerere Variante nur „heute“ (Trainingsmodus), am Ende, nie wenn ausgeschlossen', () => {
    const today = swapCandidates(
      pair('liegestuetz'),
      ctx({ mode: 'today', harderVariantId: 'liegestuetz-fuesse-erhoeht' }),
    );
    expect(ids(today.candidates).at(-1)).toBe('liegestuetz-fuesse-erhoeht');
    expect(today.candidates.length).toBeLessThanOrEqual(SWAP_RULES.maxCandidates);
    const always = swapCandidates(
      pair('liegestuetz'),
      ctx({ mode: 'always', harderVariantId: 'liegestuetz-fuesse-erhoeht' }),
    );
    expect(ids(always.candidates)).not.toContain('liegestuetz-fuesse-erhoeht');
    const excluded = swapCandidates(
      pair('liegestuetz'),
      ctx({
        mode: 'today',
        harderVariantId: 'liegestuetz-fuesse-erhoeht',
        preferences: [pref('liegestuetz-fuesse-erhoeht', 'home', 'dislike')],
      }),
    );
    expect(ids(excluded.candidates)).not.toContain('liegestuetz-fuesse-erhoeht');
    // „immer“ hängt nur an gleichwertigen Kandidaten, nicht an der Variante.
    const onlyVariant = swapCandidates(
      pair('tuerrahmen-rudern'),
      ctx({ profile: NOTHING, mode: 'today', harderVariantId: 'tisch-rudern' }),
    );
    expect(ids(onlyVariant.candidates)).toEqual(['tisch-rudern']);
    expect(onlyVariant.alwaysAllowed).toBe(false);
  });

  it('deterministisch: gleiche Eingabe → gleiche Liste', () => {
    const a = ids(
      swapCandidates(pair('bankdruecken-kurzhantel'), ctx({ profile: gym })).candidates,
    );
    const b = ids(
      swapCandidates(pair('bankdruecken-kurzhantel'), ctx({ profile: gym })).candidates,
    );
    expect(a).toEqual(b);
  });
});

describe('canExclude', () => {
  const base = {
    library: EXERCISES,
    profiles: new Map([
      ['home' as const, home],
      ['gym' as const, gym],
    ]),
    swapRules: healthy,
    preferences: [],
    inSession: new Set<string>(),
  };

  it('ok mit Kandidat und gültigem Ersatz; Ersatz muss Kandidat sein', () => {
    expect(
      canExclude(pair('goblet-kniebeuge'), pref('goblet-kniebeuge', 'home', 'dislike'), base),
    ).toEqual({
      ok: true,
    });
    expect(
      canExclude(
        pair('goblet-kniebeuge'),
        pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-koerpergewicht'),
        base,
      ),
    ).toEqual({ ok: true });
    expect(
      canExclude(
        pair('goblet-kniebeuge'),
        pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-langhantel'),
        base,
      ),
    ).toEqual({ ok: false, reason: 'replacement_not_candidate' });
  });

  it('kein Kandidat → nein; ungültige Eingabe bzw. falsche Übung → nein', () => {
    expect(
      canExclude(pair('tuerrahmen-rudern'), pref('tuerrahmen-rudern', 'home', 'not_feasible'), {
        ...base,
        profiles: new Map([['home' as const, NOTHING]]),
      }),
    ).toEqual({ ok: false, reason: 'no_candidate' });
    expect(canExclude(pair('goblet-kniebeuge'), { exercise_id: 'goblet-kniebeuge' }, base)).toEqual(
      {
        ok: false,
        reason: 'invalid',
      },
    );
    expect(
      canExclude(pair('goblet-kniebeuge'), pref('liegestuetz', 'home', 'dislike'), base),
    ).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('K3: Profil des GEWÄHLTEN Orts (geraten zu Hause ohne Geräte, gewählt Studio)', () => {
    const profiles = new Map<'home' | 'gym', { available: ReadonlySet<string> }>([
      ['home', NOTHING],
      ['gym', gym],
    ]);
    expect(
      canExclude(pair('tuerrahmen-rudern'), pref('tuerrahmen-rudern', 'home', 'not_feasible'), {
        ...base,
        profiles,
        ambiguousLocation: true,
      }),
    ).toEqual({ ok: false, reason: 'no_candidate' });
    expect(
      canExclude(
        pair('tuerrahmen-rudern'),
        pref('tuerrahmen-rudern', 'gym', 'not_feasible', 'rudern-band'),
        { ...base, profiles, ambiguousLocation: true },
      ),
    ).toEqual({ ok: true });
    // Ort ohne Profil → kein Kandidat.
    expect(
      canExclude(pair('goblet-kniebeuge'), pref('goblet-kniebeuge', 'gym', 'dislike'), {
        ...base,
        profiles: new Map(),
      }),
    ).toEqual({ ok: false, reason: 'no_candidate' });
  });

  it('Obergrenze 100 – Ändern einer bestehenden Präferenz zählt nicht neu', () => {
    const many = Array.from({ length: EXERCISE_PREFERENCE_LIMITS.maxPerUser }, (_, i) =>
      pref(`fake-uebung-${i}`, 'gym', 'dislike'),
    );
    expect(
      canExclude(pair('goblet-kniebeuge'), pref('goblet-kniebeuge', 'home', 'dislike'), {
        ...base,
        preferences: many,
      }),
    ).toEqual({ ok: false, reason: 'limit_reached' });
    const withOwn = [...many.slice(1), pref('goblet-kniebeuge', 'home', 'dislike')];
    expect(
      canExclude(pair('goblet-kniebeuge'), pref('goblet-kniebeuge', 'home', 'not_feasible'), {
        ...base,
        preferences: withOwn,
      }),
    ).toEqual({ ok: true });
  });
});

describe('applyExercisePreferences (7.2)', () => {
  const pctx = {
    library: EXERCISES,
    profile: home,
    swapRules: healthy,
    location: 'home' as const,
  };
  const strength = (pairs: ExercisePair[]) => ({
    kind: 'strength' as const,
    exerciseCount: pairs.length,
  });
  const three = [
    pair('liegestuetz', 'liegestuetz', 1),
    pair('goblet-kniebeuge', 'goblet-kniebeuge', 2),
    pair('glute-bridge', 'glute-bridge', 3),
  ];

  it('ohne Präferenzen bzw. Ausdauer-Einheit → unverändert (Wächter S10)', () => {
    const none = applyExercisePreferences(three, strength(three), { ...pctx, preferences: [] });
    expect(none.pairs).toBe(three);
    const endurance = applyExercisePreferences(
      three,
      { kind: 'endurance', exerciseCount: 3 },
      { ...pctx, preferences: [pref('liegestuetz', 'home', 'not_feasible')] },
    );
    expect(endurance.pairs).toBe(three);
    expect(endurance.hiddenByPreference).toEqual([]);
  });

  it('gewählter Ersatz zuerst; Dosierung, Supersatz bleiben; Pause bei anderem Muster/Mechanik geklemmt', () => {
    const withGroup = [
      {
        ...pair('goblet-kniebeuge', 'goblet-kniebeuge', 1),
        shown: planned('goblet-kniebeuge', { superset_group: 'A', rest_s: 300, sets: 4 }),
      },
    ];
    const result = applyExercisePreferences(withGroup, strength(withGroup), {
      ...pctx,
      preferences: [pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-stuhl')],
    });
    const shown = result.pairs[0]?.shown;
    expect(shown?.exercise_id).toBe('kniebeuge-stuhl');
    expect(shown?.superset_group).toBe('A');
    expect(shown?.sets).toBe(4);
    expect(shown?.rest_s).toBe(300); // gleiches Muster und gleiche Mechanik → Pause bleibt
    expect(result.swapped).toEqual([
      { storedOrderNo: 1, from: 'goblet-kniebeuge', to: 'kniebeuge-stuhl' },
    ]);
    // Stufe-5-Fall mit anderer Mechanik → geklemmt
    const iso = [
      {
        ...pair('langhantelrudern', 'latziehen-band', 1),
        shown: planned('latziehen-band', { rest_s: 600 }),
      },
    ];
    const clamped = applyExercisePreferences(iso, strength(iso), {
      ...pctx,
      profile: gym,
      preferences: [pref('latziehen-band', 'home', 'dislike')],
    });
    const chosen = EXERCISES.get(clamped.pairs[0]?.shown.exercise_id ?? '');
    expect(chosen).toBeDefined();
    if (chosen && chosen.movement_pattern !== 'vertical_pull') {
      expect(clamped.pairs[0]?.shown.rest_s).toBeLessThan(600);
    }
  });

  it('Ersatz nicht mehr zulässig (neue Schwangerschaft → Rückenlage) → nächster Kandidat', () => {
    const one = [pair('hueftstrecken-vierfuessler')];
    const before = applyExercisePreferences(one, strength(one), {
      ...pctx,
      preferences: [pref('hueftstrecken-vierfuessler', 'home', 'dislike', 'glute-bridge')],
    });
    expect(before.pairs[0]?.shown.exercise_id).toBe('glute-bridge');
    const after = applyExercisePreferences(one, strength(one), {
      ...pctx,
      swapRules: pregnant,
      preferences: [pref('hueftstrecken-vierfuessler', 'home', 'dislike', 'glute-bridge')],
    });
    const shown = after.pairs[0]?.shown.exercise_id;
    expect(shown).not.toBe('glute-bridge');
    expect(EXERCISES.get(shown ?? '')?.caution_tags ?? []).not.toContain('long_supine');
  });

  it('ohne Kandidat: dislike bleibt (keptDisliked), not_feasible fällt weg (gespeicherte ID)', () => {
    const one = [pair('tuerrahmen-rudern', 'tuerrahmen-rudern', 2)];
    const disliked = applyExercisePreferences(one, strength(one), {
      ...pctx,
      profile: NOTHING,
      preferences: [pref('tuerrahmen-rudern', 'home', 'dislike')],
    });
    expect(disliked.pairs).toHaveLength(1);
    expect(disliked.keptDisliked).toEqual([{ storedOrderNo: 2, exerciseId: 'tuerrahmen-rudern' }]);
    const notFeasible = applyExercisePreferences(one, strength(one), {
      ...pctx,
      profile: NOTHING,
      preferences: [pref('tuerrahmen-rudern', 'home', 'not_feasible')],
    });
    expect(notFeasible.pairs).toEqual([]);
    expect(notFeasible.hiddenByPreference).toEqual(['tuerrahmen-rudern']);
    expect(notFeasible.missingKeyPattern).toEqual(['horizontal_pull']);
    expect(notFeasible.emptyByPreference).toBe(true);
  });

  it('Ausblendung eines Sicherheits-Ersatzes meldet die GESPEICHERTE ID (Wächter B1a)', () => {
    const one = [pair('tisch-rudern', 'tuerrahmen-rudern', 1)];
    const result = applyExercisePreferences(one, strength(one), {
      ...pctx,
      profile: NOTHING,
      preferences: [pref('tuerrahmen-rudern', 'home', 'not_feasible')],
    });
    expect(result.hiddenByPreference).toEqual(['tisch-rudern']);
  });

  it('Präferenz auf der gespeicherten Übung wirkt nicht, solange ein Sicherheits-Ersatz angezeigt wird', () => {
    const one = [pair('kniebeuge-langhantel', 'goblet-kniebeuge', 1)];
    const result = applyExercisePreferences(one, strength(one), {
      ...pctx,
      preferences: [pref('kniebeuge-langhantel', 'home', 'not_feasible')],
    });
    expect(result.pairs[0]?.shown.exercise_id).toBe('goblet-kniebeuge');
    expect(result.swapped).toEqual([]);
  });

  it('Ketten und Kreise: A→B, B→A bzw. A→B, B ausgeschlossen → nie ausgeschlossene Übung, keine Doppelung', () => {
    const two = [
      pair('goblet-kniebeuge', 'goblet-kniebeuge', 1),
      pair('kniebeuge-koerpergewicht', 'kniebeuge-koerpergewicht', 2),
    ];
    const prefs = [
      pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-koerpergewicht'),
      pref('kniebeuge-koerpergewicht', 'home', 'dislike', 'goblet-kniebeuge'),
    ];
    const result = applyExercisePreferences(two, strength(two), { ...pctx, preferences: prefs });
    const shown = result.pairs.map((p) => p.shown.exercise_id);
    expect(new Set(shown).size).toBe(shown.length);
    // A wird ersetzt (B ist selbst ausgeschlossen); B findet keinen weiteren Kandidaten → bleibt (weich).
    expect(shown[0]).toBe('kniebeuge-stuhl');
    expect(result.keptDisliked).toEqual([
      { storedOrderNo: 2, exerciseId: 'kniebeuge-koerpergewicht' },
    ]);
    for (const p of result.pairs) {
      const kept = result.keptDisliked.some((k) => k.storedOrderNo === p.storedOrderNo);
      if (!kept) expect(prefs.map((x) => x.exercise_id)).not.toContain(p.shown.exercise_id);
    }
    // Kette A→B, B „hier nicht machbar“: A bekommt nie B.
    const chain = applyExercisePreferences(
      [pair('goblet-kniebeuge')],
      strength([pair('goblet-kniebeuge')]),
      {
        ...pctx,
        preferences: [
          pref('goblet-kniebeuge', 'home', 'dislike', 'kniebeuge-koerpergewicht'),
          pref('kniebeuge-koerpergewicht', 'home', 'not_feasible'),
        ],
      },
    );
    expect(chain.pairs[0]?.shown.exercise_id).toBe('kniebeuge-stuhl');
  });

  it('alle Übungen not_feasible → emptyByPreference; letzte Hüftbeuge/Zug-Übung → missingKeyPattern', () => {
    const prefs = three.map((p) => pref(p.shown.exercise_id, 'home', 'not_feasible'));
    // Alles andere zu Hause auch ausschließen, damit kein Kandidat bleibt.
    const all = [...EXERCISES.keys()].map((id) => pref(id, 'home', 'not_feasible'));
    const result = applyExercisePreferences(three, strength(three), {
      ...pctx,
      preferences: [...prefs, ...all],
    });
    expect(result.pairs).toEqual([]);
    expect(result.emptyByPreference).toBe(true);
    expect(result.hiddenByPreference).toEqual(['liegestuetz', 'goblet-kniebeuge', 'glute-bridge']);
    const notices = preferenceNotices(result, EXERCISES.size);
    expect(notices).toContain('preference_session_empty');
    expect(notices).toContain('preference_removed_no_alternative');
    expect(notices).toContain('many_exclusions');
  });

  it('archivierte Übung mit Präferenz (nicht in der Engine-Bibliothek) → Präferenz ignoriert (S-8)', () => {
    const one = [pair('goblet-kniebeuge')];
    const engine = new Map([...EXERCISES].filter(([id]) => id !== 'goblet-kniebeuge'));
    const result = applyExercisePreferences(one, strength(one), {
      ...pctx,
      library: engine,
      lookup: EXERCISES,
      preferences: [pref('goblet-kniebeuge', 'home', 'not_feasible')],
    });
    expect(result.pairs[0]?.shown.exercise_id).toBe('goblet-kniebeuge');
    expect(result.hiddenByPreference).toEqual([]);
  });
});

describe('preferenceNotices', () => {
  it('Codes nach Lage, „viele Ausschlüsse“ ab 10', () => {
    const empty = {
      keptDisliked: [],
      hiddenByPreference: [],
      missingKeyPattern: [],
      emptyByPreference: false,
    };
    expect(preferenceNotices(empty, 0)).toEqual([]);
    expect(preferenceNotices(empty, EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice - 1)).toEqual(
      [],
    );
    expect(preferenceNotices(empty, EXERCISE_PREFERENCE_LIMITS.manyExclusionsNotice)).toEqual([
      'many_exclusions',
    ]);
    expect(
      preferenceNotices(
        {
          ...empty,
          keptDisliked: [{ storedOrderNo: 1, exerciseId: 'x' }],
          missingKeyPattern: ['hinge'],
        },
        0,
      ),
    ).toEqual(['preference_kept_no_alternative', 'preference_key_pattern_missing']);
  });
});

describe('pairStoredAndShown', () => {
  it('ordnet über die nicht ausgeblendeten gespeicherten Übungen zu (doppelte IDs)', () => {
    const stored = [
      planned('a-1', { order_no: 1 }),
      planned('b-1', { order_no: 2 }),
      planned('a-1', { order_no: 3 }),
    ];
    const shown = [planned('a-1', { order_no: 1 }), planned('x-1', { order_no: 2 })];
    expect(
      pairStoredAndShown(stored, shown, ['b-1']).map((p) => [p.storedOrderNo, p.shown.exercise_id]),
    ).toEqual([
      [1, 'a-1'],
      [3, 'x-1'],
    ]);
    expect(pairStoredAndShown([], [], [])).toEqual([]);
  });
});
