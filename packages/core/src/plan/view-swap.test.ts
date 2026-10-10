/**
 * Übungs-Tausch im Anzeigeweg (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 7.3, 7.4; Etappe T1): Präferenzen und Day-Swaps
 * in prepareSessionForDisplay, Zuordnung gespeichert ↔ angezeigt, Kennzeichen, Ort – mit den echten Inhalten.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { exerciseLogStatusFor, planWorkout, type PlanExerciseContext } from '../log/workout';
import { applyCurrentEnduranceRules, applyCurrentSafetyRules } from './apply-safety';
import { equipmentProfile } from './equipment-profile';
import { generateTrainingPlan } from './generate';
import type { DaySwap } from './day-swaps';
import type { EquipmentLocation } from '../enums';
import type { PlanInputsInput } from './inputs';
import type { ExercisePreference } from './preferences';
import { type PlanSafetyRules, planSafetyRules } from './safety';
import {
  daySwap,
  EXERCISES,
  LIB,
  NOTHING,
  PLAN_ID,
  pref,
  strengthSession,
  USER_ID,
} from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';
import {
  type DisplayContext,
  displayPairs,
  exerciseMark,
  prepareSessionForDisplay,
  sessionLocationInfo,
  type StoredSession,
} from './view';

const healthy = planSafetyRules(person(), MONDAY);
const noCheck = planSafetyRules(person({ healthScreening: null }), MONDAY);
const pregnant = planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY);
const home = equipmentProfile('home', FULL_HOME);
const gym = equipmentProfile('gym', []);

/** Flache Testschreibweise; `ctxOf` baut daraus das Pflicht-Bündel `swap` (mit `swapRules`). */
type Flat = Omit<DisplayContext, 'swap'> & {
  preferences?: readonly ExercisePreference[];
  location?: EquipmentLocation;
  ambiguousLocation?: boolean;
  /** Test-Standard: die aktuellen Regeln (die Untergrenze wird in eigenen Tests gesetzt). */
  swapRules?: PlanSafetyRules;
  daySwaps?: readonly DaySwap[];
  today?: string;
  planId?: string;
  catchUpToday?: boolean;
};

function base(overrides: Partial<Flat> = {}): Flat {
  return {
    rules: healthy,
    previousStartGroup: 'beginner',
    library: EXERCISES,
    substituteLibrary: EXERCISES,
    profile: home,
    ...overrides,
  };
}

function ctxOf(flat: Flat): DisplayContext {
  const {
    preferences,
    location,
    ambiguousLocation,
    swapRules,
    daySwaps,
    today,
    planId,
    catchUpToday,
    ...rest
  } = flat;
  if (!location) return rest;
  return {
    ...rest,
    swap: {
      swapRules: swapRules ?? rest.rules,
      location,
      ambiguousLocation: ambiguousLocation ?? false,
      ...(preferences ? { preferences } : {}),
      ...(daySwaps
        ? {
            daySwaps: {
              swaps: daySwaps,
              planId: planId ?? PLAN_ID,
              ownerUserId: USER_ID,
              today: today ?? MONDAY,
              catchUpToday: catchUpToday ?? false,
            },
          }
        : {}),
    },
  };
}

const prepare = (session: StoredSession, flat: Flat) =>
  prepareSessionForDisplay(session, ctxOf(flat));

const shownIds = (s: { session: StoredSession }) => s.session.exercises.map((e) => e.exercise_id);

describe('Wächter T1-S2: Präferenzen und Day-Swaps nur zusammen mit swapRules', () => {
  it('ohne `swap` keine Tausch-Schichten; im Bündel ist `swapRules` Pflicht (Compile-Fehler sonst)', () => {
    const stored = strengthSession(['liegestuetz', 'hueftstrecken-vierfuessler']);
    const plain = prepareSessionForDisplay(stored, ctxOf(base()));
    expect(plain.preferenceSwapped).toEqual([]);
    const missingRules: DisplayContext = {
      ...ctxOf(base()),
      // @ts-expect-error – swapRules fehlt: Präferenzen ohne Plan-Untergrenze sind nicht übergebbar.
      swap: { location: 'home', preferences: [pref('liegestuetz', 'home', 'dislike')] },
    };
    expect(missingRules.swap?.location).toBe('home');
    // Mit Untergrenze (Plan in der Schwangerschaft erstellt, heute gesund) bleibt Rückenlage gesperrt.
    const withFloor = prepareSessionForDisplay(
      stored,
      ctxOf(
        base({
          location: 'home',
          swapRules: pregnant,
          preferences: [pref('hueftstrecken-vierfuessler', 'home', 'dislike', 'glute-bridge')],
        }),
      ),
    );
    expect(withFloor.session.exercises[1]?.exercise_id).not.toBe('glute-bridge');
    for (const e of withFloor.session.exercises) {
      expect(EXERCISES.get(e.exercise_id)?.caution_tags ?? []).not.toContain('long_supine');
    }
  });
});

describe('sessionLocationInfo (Wächter S4)', () => {
  const at = (date: string, exercises?: string[]) => ({
    kind: 'strength' as const,
    scheduled_on: date,
    original_date: null,
    ...(exercises ? { exercises: strengthSession(exercises).exercises } : {}),
  });
  const fixed = {
    mode: 'fixed' as const,
    slots: [
      { weekday: 1, kind: 'strength_gym' as const, minutes: 60 },
      { weekday: 3, kind: 'strength_home' as const, minutes: 30 },
    ],
  };
  const flexBoth = {
    mode: 'flex' as const,
    slots: [
      { kind: 'strength_gym' as const, minutes: 60 },
      { kind: 'strength_home' as const, minutes: 45 },
    ],
  };
  const flexHome = {
    mode: 'flex' as const,
    slots: [{ kind: 'strength_home' as const, minutes: 45 }],
  };

  it('eindeutig bei festem Tag bzw. einem Kraft-Ort, sonst geraten (ambiguous)', () => {
    expect(sessionLocationInfo(at('2026-10-05'), fixed)).toEqual({
      location: 'gym',
      ambiguous: false,
    });
    expect(sessionLocationInfo(at('2026-10-08'), flexHome)).toEqual({
      location: 'home',
      ambiguous: false,
    });
    expect(sessionLocationInfo(at('2026-10-08'), flexBoth)).toEqual({
      location: 'home',
      ambiguous: true,
    });
    expect(sessionLocationInfo(at('2026-10-08'), null)).toEqual({
      location: 'home',
      ambiguous: true,
    });
    // Verschoben auf einen Tag ohne Eintrag: aus der Fassung (Studio), mehrdeutig.
    expect(
      sessionLocationInfo(at('2026-10-08', ['kniebeuge-langhantel']), fixed, {
        library: EXERCISES,
        homeProfile: NOTHING,
      }),
    ).toEqual({ location: 'gym', ambiguous: true });
  });

  it('Pflicht-Test 9: „Tage egal“ mit beiden Orten, alles heim-machbar, Präferenz nur im Studio → wirkt trotzdem', () => {
    const session = strengthSession(['liegestuetz', 'kniebeuge-koerpergewicht']);
    const where = sessionLocationInfo(session, flexBoth, {
      library: EXERCISES,
      homeProfile: NOTHING,
    });
    expect(where).toEqual({ location: 'home', ambiguous: true });
    const prefs = [pref('kniebeuge-koerpergewicht', 'gym', 'dislike')];
    const shown = prepare(
      session,
      base({
        profile: NOTHING,
        preferences: prefs,
        location: where.location,
        ambiguousLocation: where.ambiguous,
      }),
    );
    expect(shownIds(shown)).not.toContain('kniebeuge-koerpergewicht');
    expect(shown.preferenceSwapped).toHaveLength(1);
    // Eindeutig zu Hause: die Studio-Präferenz wirkt nicht.
    const unambiguous = prepare(
      session,
      base({ profile: NOTHING, preferences: prefs, location: 'home', ambiguousLocation: false }),
    );
    expect(shownIds(unambiguous)).toContain('kniebeuge-koerpergewicht');
  });
});

describe('Regression: ohne Präferenzen und Day-Swaps identisch (7.3.2)', () => {
  const profiles: {
    label: string;
    inputs: PlanInputsInput;
    profile: ReturnType<typeof equipmentProfile>;
  }[] = [
    { label: 'Studio 3 Tage', inputs: person({ experienceLevel: 'advanced' }), profile: gym },
    {
      label: 'Studio 1 Tag',
      inputs: person({ sessionsPerWeek: 1, preferredDays: [3] }),
      profile: gym,
    },
    {
      label: 'Zuhause ohne Geräte 2 Tage',
      inputs: person({ trainingLocation: 'home', sessionsPerWeek: 2, preferredDays: [1, 4] }),
      profile: equipmentProfile('home', []),
    },
    {
      label: 'Zuhause mit Geräten 4 Tage',
      inputs: person({
        trainingLocation: 'home',
        homeEquipment: [...FULL_HOME],
        sessionsPerWeek: 4,
        preferredDays: [1, 2, 4, 5],
      }),
      profile: home,
    },
    {
      label: 'Zuhause ohne Geräte 7 Tage',
      inputs: person({
        trainingLocation: 'home',
        sessionsPerWeek: 7,
        preferredDays: [1, 2, 3, 4, 5, 6, 7],
      }),
      profile: equipmentProfile('home', []),
    },
  ];
  const ruleSets = [
    ['gesund', healthy],
    ['ohne Check', noCheck],
    ['Schwangerschaft', pregnant],
    ['ab 65', planSafetyRules(person({ birthDate: '1950-01-01' }), MONDAY)],
  ] as const;

  for (const { label, inputs, profile } of profiles) {
    it(`${label}: session/hidden/replaced/libraryMissing unverändert, storedOrderNos stimmig`, () => {
      const result = generateTrainingPlan(inputs, LIB, MONDAY);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const [, rules] of ruleSets) {
        for (const [i, s] of result.plan.sessions.entries()) {
          const stored: StoredSession = {
            ...s,
            id: `s${i}`,
            status: 'planned',
            original_date: null,
          };
          const ctx = base({ rules, profile });
          const before = prepare(stored, ctx);
          // Unabhängige Erwartung: genau die bisherigen zwei Schritte.
          const expected = applyCurrentSafetyRules(
            applyCurrentEnduranceRules(stored, rules, { previousStartGroup: 'beginner' }),
            rules,
            { library: EXERCISES, substituteLibrary: EXERCISES, profile },
          );
          expect(before.session).toEqual(expected.session);
          expect(before.hidden).toEqual(expected.hidden);
          const withEmpty = prepare(stored, {
            ...ctx,
            preferences: [],
            location: 'home',
            daySwaps: [],
            today: MONDAY,
            planId: PLAN_ID,
            swapRules: pregnant,
          });
          expect(withEmpty.session).toEqual(before.session);
          expect(withEmpty.hidden).toEqual(before.hidden);
          expect(withEmpty.replaced).toEqual(before.replaced);
          expect(withEmpty.libraryMissing).toBe(before.libraryMissing);
          expect(withEmpty.hiddenByPreference).toEqual([]);
          expect(withEmpty.preferenceSwapped).toEqual([]);
          expect(withEmpty.daySwapped).toEqual([]);
          expect(withEmpty.emptyByPreference).toBe(false);
          expect(before.storedOrderNos).toHaveLength(before.session.exercises.length);
          // Zuordnung über storedOrderNos = Zuordnung wie bisher über `hidden`.
          const pairs = displayPairs(stored, before);
          expect(pairs.map((p) => p.storedOrderNo)).toEqual(before.storedOrderNos);
        }
      }
    }, 30_000);
  }
});

describe('Pflicht-Test 1: Sicherheits-Ersatz + Präferenz (Wächter B1/B2)', () => {
  // A = Kniebeuge Langhantel (spinal_loading) in der Mitte; ohne Check gesperrt → X = Kniebeuge Körpergewicht.
  const stored = strengthSession(['liegestuetz', 'kniebeuge-langhantel', 'glute-bridge']);
  const ctx = base({ rules: noCheck, profile: NOTHING, location: 'home' });

  it('Ausgangslage: Sicherheits-Ersatz in der Mitte', () => {
    const shown = prepare(stored, ctx);
    expect(shownIds(shown)).toEqual(['liegestuetz', 'kniebeuge-koerpergewicht', 'glute-bridge']);
    expect(shown.replaced).toEqual(['kniebeuge-langhantel']);
  });

  it('X „hier nicht machbar“ ohne Kandidat → hiddenByPreference = [A], hidden = [], Zuordnung stimmt', () => {
    const prefs = [
      pref('kniebeuge-koerpergewicht', 'home', 'not_feasible'),
      pref('kniebeuge-stuhl', 'home', 'dislike'),
    ];
    const shown = prepare(stored, { ...ctx, preferences: prefs });
    expect(shownIds(shown)).toEqual(['liegestuetz', 'glute-bridge']);
    expect(shown.hiddenByPreference).toEqual(['kniebeuge-langhantel']);
    expect(shown.hidden).toEqual([]);
    expect(shown.storedOrderNos).toEqual([1, 3]);
    expect(shown.session.exercises.map((e) => e.order_no)).toEqual([1, 2]);
    expect(shown.preferenceNotices).toEqual(['preference_removed_no_alternative']);
    const pctx: PlanExerciseContext = {
      library: EXERCISES,
      engineLibrary: EXERCISES,
      profile: equipmentProfile('home', []),
      rules: noCheck,
      experienceLevel: 'beginner',
      entries: [],
      startWeights: new Map(),
      today: MONDAY,
      isDeload: false,
      weekSessions: [stored],
      weeklySetMax: 20,
      swap: { swapRules: noCheck },
    };
    const items = planWorkout(stored, shown, [stored], pctx);
    expect(items.map((i) => [i.plannedOrderNo, i.storedExerciseId, i.shown.exercise_id])).toEqual([
      [1, 'liegestuetz', 'liegestuetz'],
      [3, 'glute-bridge', 'glute-bridge'],
    ]);
    // Status der Folgeübung bleibt richtig (gleiche Übung ⇔ done).
    expect(
      exerciseLogStatusFor(false, items[1]!.shown.exercise_id, items[1]!.storedExerciseId),
    ).toBe('done');
    expect(
      exerciseLogStatusFor(true, items[1]!.shown.exercise_id, items[1]!.storedExerciseId),
    ).toBe('skipped');
  });

  it('X „mag ich nicht“ mit Kandidat → Schwierigkeit ≤ min(A, X), Markierung „deine Wahl“, Status alternative', () => {
    const prefs = [pref('kniebeuge-koerpergewicht', 'home', 'dislike')];
    const shown = prepare(stored, { ...ctx, preferences: prefs });
    const chosen = shown.session.exercises[1];
    expect(chosen?.exercise_id).toBe('kniebeuge-stuhl');
    expect(EXERCISES.get(chosen?.exercise_id ?? '')?.difficulty).toBeLessThanOrEqual(
      Math.min(
        EXERCISES.get('kniebeuge-langhantel')!.difficulty,
        EXERCISES.get('kniebeuge-koerpergewicht')!.difficulty,
      ),
    );
    expect(shown.storedOrderNos).toEqual([1, 2, 3]);
    expect(exerciseMark(chosen!, stored, ctx, { storedOrderNo: 2, display: shown })).toBe(
      'preference',
    );
    expect(exerciseLogStatusFor(false, chosen!.exercise_id, 'kniebeuge-langhantel')).toBe(
      'alternative',
    );
    // Reiner Sicherheits-Ersatz → adjusted; Übung wie geplant → null.
    const safetyOnly = prepare(stored, ctx);
    expect(
      exerciseMark(safetyOnly.session.exercises[1]!, stored, ctx, {
        storedOrderNo: 2,
        display: safetyOnly,
      }),
    ).toBe('adjusted');
    expect(
      exerciseMark(safetyOnly.session.exercises[0]!, stored, ctx, {
        storedOrderNo: 1,
        display: safetyOnly,
      }),
    ).toBeNull();
  });

  it('Stufe-5-Ersatz mit Präferenz: Muster S oder X, gemeinsamer Hauptmuskel mit S', () => {
    // Stufe 5 erzwingen: außer S keine Ruder-Übung in der Ersatz-Bibliothek.
    const s = strengthSession(['langhantelrudern']);
    const substituteLibrary = new Map(
      [...EXERCISES].filter(
        ([id, e]) => id === 'langhantelrudern' || e.movement_pattern !== 'horizontal_pull',
      ),
    );
    const sctx = base({ rules: noCheck, profile: gym, substituteLibrary, location: 'gym' });
    const shown = prepare(s, sctx);
    const x = EXERCISES.get(shown.session.exercises[0]?.exercise_id ?? '');
    expect(x?.movement_pattern).toBe('vertical_pull');
    const withPref = prepare(s, {
      ...sctx,
      preferences: [pref(x!.id, 'gym', 'dislike')],
    });
    const chosen = EXERCISES.get(withPref.session.exercises[0]?.exercise_id ?? '');
    expect(chosen).toBeDefined();
    expect(chosen?.id).not.toBe(x?.id);
    expect(['horizontal_pull', 'vertical_pull']).toContain(chosen?.movement_pattern);
    expect(
      chosen?.primary_muscles.some((m) =>
        EXERCISES.get('langhantelrudern')!.primary_muscles.includes(m),
      ),
    ).toBe(true);
    expect(chosen!.difficulty).toBeLessThanOrEqual(Math.min(2, x!.difficulty));
    expect(withPref.preferenceSwapped).toEqual([{ storedOrderNo: 1, from: x!.id, to: chosen!.id }]);
  });
});

describe('Day-Swaps im Anzeigeweg', () => {
  const stored = strengthSession(['liegestuetz', 'hueftstrecken-vierfuessler']);
  const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
  const ctx = base({ location: 'home', today: MONDAY, planId: PLAN_ID, daySwaps: [swap] });

  it('Day-Swap wird angezeigt und als „heute getauscht“ markiert', () => {
    const shown = prepare(stored, ctx);
    expect(shownIds(shown)).toEqual(['liegestuetz', 'glute-bridge']);
    expect(
      exerciseMark(shown.session.exercises[1]!, stored, ctx, { storedOrderNo: 2, display: shown }),
    ).toBe('day_swap');
    expect(shown.droppedDaySwaps).toEqual([]);
  });

  it('Pflicht-Test 2: danach Schwangerschaft → Swap fällt weg (droppedDaySwaps), keine Rückenlage sichtbar', () => {
    const shown = prepare(stored, { ...ctx, rules: pregnant });
    expect(shown.droppedDaySwaps).toEqual([swap]);
    for (const e of shown.session.exercises) {
      expect(EXERCISES.get(e.exercise_id)?.caution_tags ?? []).not.toContain('long_supine');
    }
  });

  it('Lockerung nach Plan-Erstellung: Untergrenze (swapRules) sperrt den Swap trotz gelockerter Regeln', () => {
    const shown = prepare(stored, { ...ctx, rules: healthy, swapRules: pregnant });
    expect(shown.droppedDaySwaps).toEqual([swap]);
    expect(shownIds(shown)).toEqual(['liegestuetz', 'hueftstrecken-vierfuessler']);
  });

  it('Pflicht-Test 4: verschoben auf morgen gilt weiter, auf gestern verfallen', () => {
    const tomorrow = { ...stored, scheduled_on: addDays(MONDAY, 1), original_date: MONDAY };
    expect(prepare(tomorrow, ctx).daySwapped).toHaveLength(1);
    const yesterday = { ...stored, scheduled_on: addDays(MONDAY, -1) };
    expect(prepare(yesterday, ctx).droppedDaySwaps).toEqual([swap]);
    expect(prepare(yesterday, { ...ctx, catchUpToday: true }).daySwapped).toHaveLength(1);
    const mismatch = daySwap(2, 'glute-bridge', 'hueftstrecken-vierfuessler');
    expect(prepare(stored, { ...ctx, daySwaps: [mismatch] }).droppedDaySwaps).toEqual([mismatch]);
  });

  it('Präferenz und Day-Swap zusammen: Day-Swap gegen die Einheit nach Präferenzen', () => {
    const prefs = [pref('liegestuetz', 'home', 'dislike', 'liegestuetz-erhoeht')];
    const shown = prepare(stored, { ...ctx, preferences: prefs });
    expect(shownIds(shown)).toEqual(['liegestuetz-erhoeht', 'glute-bridge']);
    expect(shown.preferenceSwapped).toEqual([
      { storedOrderNo: 1, from: 'liegestuetz', to: 'liegestuetz-erhoeht' },
    ]);
    expect(shown.daySwapped).toEqual([
      { storedOrderNo: 2, from: 'hueftstrecken-vierfuessler', to: 'glute-bridge' },
    ]);
  });
});

describe('Leere Einheit, Ausdauer, Supersatz, Hinweise', () => {
  it('Pflicht-Test 6: alle Übungen not_feasible ohne Kandidat → emptyByPreference (nicht libraryMissing)', () => {
    const stored = strengthSession(['tuerrahmen-rudern', 'good-morning-koerpergewicht']);
    const prefs = [
      pref('tuerrahmen-rudern', 'home', 'not_feasible'),
      pref('good-morning-koerpergewicht', 'home', 'not_feasible'),
      pref('rdl-einbeinig-koerpergewicht', 'home', 'not_feasible'),
    ];
    const shown = prepare(stored, base({ profile: NOTHING, location: 'home', preferences: prefs }));
    expect(shown.session.exercises).toEqual([]);
    expect(shown.emptyByPreference).toBe(true);
    expect(shown.libraryMissing).toBe(false);
    expect(shown.hidden).toEqual([]);
    expect(shown.hiddenByPreference).toEqual(['tuerrahmen-rudern', 'good-morning-koerpergewicht']);
    expect(shown.preferenceNotices).toEqual(
      expect.arrayContaining(['preference_session_empty', 'preference_key_pattern_missing']),
    );
    // Etappe T2: welche Grundbausteine fehlen (für den ausdrücklichen Hinweis in der App).
    expect([...(shown.missingKeyPattern ?? [])].sort()).toEqual(['hinge', 'horizontal_pull']);
  });

  it('Pflicht-Test 11: nur Präferenz-Ausblendung → `hidden` leer (kein Hinweis „Plan neu erstellen“)', () => {
    const stored = strengthSession(['liegestuetz', 'tuerrahmen-rudern']);
    const shown = prepare(
      stored,
      base({
        profile: NOTHING,
        location: 'home',
        preferences: [pref('tuerrahmen-rudern', 'home', 'not_feasible')],
      }),
    );
    expect(shown.hidden).toEqual([]);
    expect(shown.hiddenByPreference).toEqual(['tuerrahmen-rudern']);
    expect(shown.preferenceNotices).toEqual(
      expect.arrayContaining([
        'preference_removed_no_alternative',
        'preference_key_pattern_missing',
      ]),
    );
    expect(shown.missingKeyPattern).toEqual(['horizontal_pull']);
  });

  it('Pflicht-Test 7: Ausdauer-Einheit bleibt unverändert', () => {
    const run: StoredSession = {
      ...strengthSession([]),
      kind: 'endurance',
      name_de: 'Lockerer Lauf',
      endurance_modality: 'run',
      effort_target: 4,
      focus: null,
    };
    const withPrefs = prepare(
      run,
      base({
        location: 'home',
        preferences: [pref('liegestuetz', 'home', 'not_feasible')],
        daySwaps: [daySwap(1, 'liegestuetz', 'liegestuetz-erhoeht')],
        today: MONDAY,
        planId: PLAN_ID,
      }),
    );
    const without = prepare(run, base());
    expect(withPrefs.session).toEqual(without.session);
    expect(withPrefs.preferenceNotices).toEqual([]);
    expect(withPrefs.emptyByPreference).toBe(false);
  });

  it('Pflicht-Test 5: Ersatz übernimmt superset_group', () => {
    const stored = strengthSession(['liegestuetz', 'goblet-kniebeuge']);
    const grouped: StoredSession = {
      ...stored,
      exercises: stored.exercises.map((e) => ({ ...e, superset_group: 'A' })),
    };
    const shown = prepare(
      grouped,
      base({ location: 'home', preferences: [pref('goblet-kniebeuge', 'home', 'dislike')] }),
    );
    expect(shown.session.exercises.map((e) => e.superset_group)).toEqual(['A', 'A']);
    expect(shown.session.exercises[1]?.exercise_id).not.toBe('goblet-kniebeuge');
  });

  it('viele Ausschlüsse (≥ 10) → Hinweis many_exclusions', () => {
    const stored = strengthSession(['liegestuetz']);
    const many = [...EXERCISES.keys()]
      .slice(0, 10)
      .filter((id) => id !== 'liegestuetz')
      .map((id) => pref(id, 'home', 'dislike'));
    const ten = [
      ...many,
      pref('archer-liegestuetz', 'home', 'dislike'),
      pref('dips-stuhl', 'home', 'dislike'),
    ];
    const shown = prepare(stored, base({ location: 'home', preferences: ten }));
    expect(shown.preferenceNotices).toContain('many_exclusions');
  });
});
