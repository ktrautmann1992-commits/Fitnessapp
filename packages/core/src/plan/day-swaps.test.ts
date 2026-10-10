import { describe, expect, it } from 'vitest';

import { DAY_SWAP_LIMITS } from '../constants';
import { addDays } from '../dates';
import {
  applyDaySwaps,
  type DaySwapContext,
  daySwapSchema,
  parseStoredDaySwaps,
  pruneDaySwaps,
  removeDaySwap,
  upsertDaySwap,
} from './day-swaps';
import { equipmentProfile } from './equipment-profile';
import type { ExercisePair } from './preferences';
import type { ReschedulableSession } from './reschedule';
import { planSafetyRules } from './safety';
import {
  daySwap,
  EXERCISES,
  OTHER_USER_ID,
  PLAN_ID,
  planned,
  pref,
  SESSION_ID,
  strengthSession,
  USER_ID,
} from './swap-test-helpers';
import { FULL_HOME, MONDAY, person } from './test-library';

const healthy = planSafetyRules(person(), MONDAY);
const pregnant = planSafetyRules(person({ healthScreening: { flags: ['pregnancy'] } }), MONDAY);
const home = equipmentProfile('home', FULL_HOME);

const OTHER_PLAN = '55555555-5555-4555-8555-555555555555';
const OTHER_SESSION = '66666666-6666-4666-8666-666666666666';

function pairsOf(ids: readonly string[]): ExercisePair[] {
  return ids.map((id, i) => ({
    stored: planned(id, { order_no: i + 1 }),
    shown: planned(id, { order_no: i + 1 }),
    storedOrderNo: i + 1,
  }));
}

function ctx(overrides: Partial<DaySwapContext> = {}): DaySwapContext {
  return {
    library: EXERCISES,
    profile: home,
    swapRules: healthy,
    preferences: [],
    location: 'home',
    planId: PLAN_ID,
    ownerUserId: USER_ID,
    today: MONDAY,
    ...overrides,
  };
}

const IDS = ['liegestuetz', 'hueftstrecken-vierfuessler', 'goblet-kniebeuge'];
const session = strengthSession(IDS);
const shownIds = (pairs: readonly ExercisePair[]) => pairs.map((p) => p.shown.exercise_id);

describe('daySwapSchema / parseStoredDaySwaps (Wächter S5)', () => {
  it('gültiger Eintrag; strikt (keine Zusatzfelder), keine Selbst-Alternative', () => {
    expect(
      daySwapSchema.safeParse(daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge')).success,
    ).toBe(true);
    expect(
      daySwapSchema.safeParse({
        ...daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge'),
        reason: 'x',
      }).success,
    ).toBe(false);
    expect(daySwapSchema.safeParse(daySwap(2, 'glute-bridge', 'glute-bridge')).success).toBe(false);
    expect(daySwapSchema.safeParse(daySwap(0, 'glute-bridge', 'liegestuetz')).success).toBe(false);
  });

  it('kaputter Speicher → leer bzw. nur gültige Einträge; fremdes Konto unsichtbar', () => {
    expect(parseStoredDaySwaps(null, USER_ID)).toEqual([]);
    expect(parseStoredDaySwaps('{kaputt', USER_ID)).toEqual([]);
    expect(parseStoredDaySwaps('{"a":1}', USER_ID)).toEqual([]);
    const good = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const foreign = daySwap(1, 'liegestuetz', 'liegestuetz-erhoeht', {
      ownerUserId: OTHER_USER_ID,
    });
    const raw = JSON.stringify([good, { ...good, storedOrderNo: 'zwei' }, null, 42, foreign]);
    expect(parseStoredDaySwaps(raw, USER_ID)).toEqual([good]);
    expect(parseStoredDaySwaps(raw, OTHER_USER_ID)).toEqual([foreign]);
  });
});

describe('upsertDaySwap / removeDaySwap', () => {
  it('je Konto, Einheit und Position höchstens einer; Obergrenze verwirft die ältesten', () => {
    const a = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const b = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge-einbeinig');
    expect(upsertDaySwap([a], b)).toEqual([b]);
    expect(removeDaySwap([a], a)).toEqual([]);
    const many = Array.from({ length: DAY_SWAP_LIMITS.maxEntries }, (_, i) =>
      daySwap(1 + (i % 50), 'liegestuetz', 'liegestuetz-erhoeht', {
        sessionId: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
        createdAt: `2026-10-0${1 + (i % 5)}T08:00:00Z`,
      }),
    );
    const next = upsertDaySwap(
      many,
      daySwap(9, 'liegestuetz', 'liegestuetz-erhoeht', { createdAt: '2026-10-09T08:00:00Z' }),
    );
    expect(next).toHaveLength(DAY_SWAP_LIMITS.maxEntries);
    expect(next.at(-1)?.storedOrderNo).toBe(9);
  });
});

describe('applyDaySwaps (Wächter B3)', () => {
  const pairs = pairsOf(IDS);

  it('gültiger Swap wird eingesetzt (Dosierung bleibt), Ausdauer und fremde Einheiten unverändert', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const result = applyDaySwaps(pairs, session, [swap], ctx());
    expect(shownIds(result.pairs)).toEqual(['liegestuetz', 'glute-bridge', 'goblet-kniebeuge']);
    expect(result.daySwapped).toEqual([
      { storedOrderNo: 2, from: 'hueftstrecken-vierfuessler', to: 'glute-bridge' },
    ]);
    expect(result.pairs[1]?.stored.exercise_id).toBe('hueftstrecken-vierfuessler');
    expect(result.droppedDaySwaps).toEqual([]);
    const endurance = applyDaySwaps(pairs, { ...session, kind: 'endurance' }, [swap], ctx());
    expect(endurance.pairs).toBe(pairs);
    const foreign = applyDaySwaps(pairs, session, [{ ...swap, sessionId: OTHER_SESSION }], ctx());
    expect(foreign).toEqual({ pairs, daySwapped: [], droppedDaySwaps: [] });
  });

  it('K2: Swap eines anderen Kontos gilt nie (auch bei ungefilterter Liste)', () => {
    const foreign = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge', {
      ownerUserId: OTHER_USER_ID,
    });
    const result = applyDaySwaps(pairs, session, [foreign], ctx());
    expect(shownIds(result.pairs)).toEqual(IDS);
    expect(result.droppedDaySwaps).toEqual([foreign]);
  });

  it('K9: storedOrderNo höchstens wie planned_exercises.order_no (1–8)', () => {
    expect(daySwapSchema.safeParse(daySwap(8, 'liegestuetz', 'liegestuetz-erhoeht')).success).toBe(
      true,
    );
    expect(daySwapSchema.safeParse(daySwap(9, 'liegestuetz', 'liegestuetz-erhoeht')).success).toBe(
      false,
    );
  });

  it('strengere Regel nach dem Tausch (Schwangerschaft) → Swap fällt still weg, keine Rückenlage sichtbar', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const result = applyDaySwaps(pairs, session, [swap], ctx({ swapRules: pregnant }));
    expect(shownIds(result.pairs)).toEqual(IDS);
    expect(result.droppedDaySwaps).toEqual([swap]);
    for (const id of shownIds(result.pairs)) {
      expect(EXERCISES.get(id)?.caution_tags ?? []).not.toContain('long_supine');
    }
  });

  it('Präferenz nach dem Tausch schließt die Alternative aus → verworfen', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const result = applyDaySwaps(
      pairs,
      session,
      [swap],
      ctx({ preferences: [pref('glute-bridge', 'home', 'dislike')] }),
    );
    expect(result.droppedDaySwaps).toEqual([swap]);
  });

  it('verworfen: falscher Plan, gespeicherte Übung passt nicht, Position fehlt, Einheit nicht geplant', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    expect(
      applyDaySwaps(pairs, session, [{ ...swap, planId: OTHER_PLAN }], ctx()).droppedDaySwaps,
    ).toHaveLength(1);
    expect(
      applyDaySwaps(
        pairs,
        session,
        [{ ...swap, storedExerciseId: 'glute-bridge-einbeinig' }],
        ctx(),
      ).droppedDaySwaps,
    ).toHaveLength(1);
    expect(
      applyDaySwaps(pairs, session, [{ ...swap, storedOrderNo: 9 }], ctx()).droppedDaySwaps,
    ).toHaveLength(1);
    expect(
      applyDaySwaps(pairs, { ...session, status: 'completed' }, [swap], ctx()).droppedDaySwaps,
    ).toHaveLength(1);
    expect(
      applyDaySwaps(pairs, { ...session, status: 'skipped' }, [swap], ctx()).droppedDaySwaps,
    ).toHaveLength(1);
  });

  it('verschoben: Datum aktuell ≥ heute gilt; vergangen verfällt – außer heute nachholbar (N1)', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const tomorrow = { ...session, scheduled_on: addDays(MONDAY, 1) };
    expect(applyDaySwaps(pairs, tomorrow, [swap], ctx()).daySwapped).toHaveLength(1);
    const yesterday = { ...session, scheduled_on: addDays(MONDAY, -1) };
    expect(applyDaySwaps(pairs, yesterday, [swap], ctx()).droppedDaySwaps).toEqual([swap]);
    expect(
      applyDaySwaps(pairs, yesterday, [swap], ctx({ catchUpToday: true })).daySwapped,
    ).toHaveLength(1);
  });

  it('N2: zweimal anzeigen bleibt gültig (Prüfung gegen die Einheit VOR dem Einsetzen)', () => {
    const swap = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const first = applyDaySwaps(pairs, session, [swap], ctx());
    const second = applyDaySwaps(pairs, session, [swap], ctx());
    expect(second).toEqual(first);
    expect(second.droppedDaySwaps).toEqual([]);
  });

  it('N2: zwei Swaps in einer Einheit der Reihe nach; derselbe Ersatz zweimal → der zweite fällt weg', () => {
    const a = daySwap(1, 'liegestuetz', 'liegestuetz-erhoeht');
    const b = daySwap(2, 'hueftstrecken-vierfuessler', 'glute-bridge');
    const both = applyDaySwaps(pairs, session, [b, a], ctx());
    expect(shownIds(both.pairs)).toEqual([
      'liegestuetz-erhoeht',
      'glute-bridge',
      'goblet-kniebeuge',
    ]);
    expect(both.daySwapped.map((s) => s.storedOrderNo)).toEqual([1, 2]);
    // Zwei Positionen mit derselben Übung in der Einheit: beide auf dieselbe Alternative → S-6 beim zweiten.
    const twice = pairsOf(['kniebeuge-koerpergewicht', 'goblet-kniebeuge']);
    const s1 = daySwap(1, 'kniebeuge-koerpergewicht', 'kniebeuge-stuhl');
    const s2 = daySwap(2, 'goblet-kniebeuge', 'kniebeuge-stuhl');
    const conflict = applyDaySwaps(
      twice,
      strengthSession(['kniebeuge-koerpergewicht', 'goblet-kniebeuge']),
      [s1, s2],
      ctx(),
    );
    expect(shownIds(conflict.pairs)).toEqual(['kniebeuge-stuhl', 'goblet-kniebeuge']);
    expect(conflict.droppedDaySwaps).toEqual([s2]);
    // Doppelter Eintrag für dieselbe Position → nur der erste gilt.
    const dup = applyDaySwaps(
      pairs,
      session,
      [b, { ...b, alternativeId: 'glute-bridge-einbeinig', createdAt: '2026-10-05T09:00:00Z' }],
      ctx(),
    );
    expect(dup.daySwapped).toHaveLength(1);
    expect(dup.droppedDaySwaps).toHaveLength(1);
  });

  it('Tausch einer bereits per Präferenz getauschten Übung: geprüft gegen das Paar (S, angezeigt)', () => {
    // S = Goblet, nach Präferenz angezeigt: Kniebeuge Stuhl. Day-Swap auf Körpergewicht-Kniebeuge.
    const prefPairs: ExercisePair[] = [
      { stored: planned('goblet-kniebeuge'), shown: planned('kniebeuge-stuhl'), storedOrderNo: 1 },
    ];
    const swap = daySwap(1, 'goblet-kniebeuge', 'kniebeuge-koerpergewicht');
    const result = applyDaySwaps(prefPairs, strengthSession(['goblet-kniebeuge']), [swap], ctx());
    expect(shownIds(result.pairs)).toEqual(['kniebeuge-koerpergewicht']);
    expect(result.daySwapped).toEqual([
      { storedOrderNo: 1, from: 'kniebeuge-stuhl', to: 'kniebeuge-koerpergewicht' },
    ]);
    // Nie schwerer als min(S, angezeigt): Goblet-Variante mit Schwierigkeit 2 wäre kein Kandidat.
    const harder = daySwap(1, 'goblet-kniebeuge', 'kniebeuge-pause');
    expect(
      applyDaySwaps(prefPairs, strengthSession(['goblet-kniebeuge']), [harder], ctx())
        .droppedDaySwaps,
    ).toEqual([harder]);
  });
});

describe('pruneDaySwaps', () => {
  const s = (
    id: string,
    date: string,
    extra: Partial<ReschedulableSession> = {},
  ): ReschedulableSession => ({
    id,
    scheduled_on: date,
    original_date: null,
    status: 'planned',
    kind: 'strength',
    focus: 'full_body',
    is_deload: false,
    ...extra,
  });
  const WEDNESDAY = addDays(MONDAY, 2);
  const swap = daySwap(1, 'liegestuetz', 'liegestuetz-erhoeht');

  it('behält künftige und heute nachholbare Einheiten, verwirft alles andere', () => {
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, WEDNESDAY)], { today: MONDAY, activePlanId: PLAN_ID }),
    ).toEqual([swap]);
    // auf morgen verschoben (gleiche ID) → bleibt
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, addDays(MONDAY, 1), { original_date: MONDAY })], {
        today: MONDAY,
        activePlanId: PLAN_ID,
      }),
    ).toEqual([swap]);
    // verpasst (Montag), heute Mittwoch nachholbar → bleibt (N1)
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, MONDAY)], { today: WEDNESDAY, activePlanId: PLAN_ID }),
    ).toEqual([swap]);
    // verpasst und nicht nachholbar (Mittwoch belegt) → weg
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, MONDAY), s(OTHER_SESSION, WEDNESDAY)], {
        today: WEDNESDAY,
        activePlanId: PLAN_ID,
      }),
    ).toEqual([]);
    expect(pruneDaySwaps([swap], [], { today: MONDAY, activePlanId: PLAN_ID })).toEqual([]);
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, WEDNESDAY, { status: 'completed' })], {
        today: MONDAY,
        activePlanId: PLAN_ID,
      }),
    ).toEqual([]);
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, WEDNESDAY, { status: 'skipped' })], {
        today: MONDAY,
        activePlanId: PLAN_ID,
      }),
    ).toEqual([]);
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, WEDNESDAY)], {
        today: MONDAY,
        activePlanId: OTHER_PLAN,
      }),
    ).toEqual([]);
    expect(
      pruneDaySwaps([swap], [s(SESSION_ID, WEDNESDAY)], { today: MONDAY, activePlanId: null }),
    ).toEqual([]);
  });
});
