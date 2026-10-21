import { describe, expect, it } from 'vitest';

import {
  activeAgingScheduleHints,
  BALANCE_PRELUDE_DE,
  confirmBalanceStage,
  nextBalanceStep,
  shouldOfferHarderVariant,
  suggestedActiveAgingSlots,
} from './active-aging';
import { generateTrainingPlan } from './generate';
import { MONDAY, person, repoLibrary } from './test-library';

describe('Gleichgewicht in Stufen (Plan 9 Nr. 4): nie automatisch', () => {
  it('Haltezeit 10 → 30 s in 5-s-Schritten ohne Rückfrage', () => {
    expect(nextBalanceStep({ stage: 1, holdS: 10 }, 4)).toEqual({
      kind: 'longer_hold',
      next: { stage: 1, holdS: 15 },
    });
    expect(nextBalanceStep({ stage: 1, holdS: 28 }, 4).next.holdS).toBe(30);
  });

  it('bei 30 s: nächste Stufe nur als Frage; ohne „Ja“ bleibt alles', () => {
    const step = nextBalanceStep({ stage: 2, holdS: 30 }, 4);
    expect(step).toEqual({ kind: 'ask_next_stage', next: { stage: 3, holdS: 10 } });
    expect(confirmBalanceStage({ stage: 2, holdS: 30 }, step, false)).toEqual({
      stage: 2,
      holdS: 30,
    });
    expect(confirmBalanceStage({ stage: 2, holdS: 30 }, step, true)).toEqual({
      stage: 3,
      holdS: 10,
    });
  });

  it('Sturz/Unsicherheit/Gehhilfe: höchstens Stufe 2', () => {
    expect(nextBalanceStep({ stage: 2, holdS: 30 }, 2)).toEqual({
      kind: 'stay',
      next: { stage: 2, holdS: 30 },
    });
    // zu hohe gespeicherte Stufe wird auf die Grenze gezogen (strengere Richtung)
    expect(nextBalanceStep({ stage: 4, holdS: 10 }, 2).next.stage).toBe(2);
  });

  it('Grenzfälle: ungültige Werte werden begrenzt', () => {
    expect(nextBalanceStep({ stage: 0, holdS: 0 }, 4).next).toEqual({ stage: 1, holdS: 15 });
    expect(nextBalanceStep({ stage: 9, holdS: 99 }, 4)).toEqual({
      kind: 'stay',
      next: { stage: 4, holdS: 30 },
    });
  });

  it('schwerere Kraft-Variante erst nach 2 Einheiten am oberen Ende', () => {
    expect(shouldOfferHarderVariant(1)).toBe(false);
    expect(shouldOfferHarderVariant(2)).toBe(true);
    expect(shouldOfferHarderVariant(Number.NaN)).toBe(false);
  });
});

describe('Trainingstage (Plan 7.2, S9): nur Hinweise', () => {
  it.each([
    [[{ kind: 'strength_home' }], ['balance_needs_three_days']],
    [[{ kind: 'strength_home' }, { kind: 'strength_home' }], ['add_third_short_day']],
    [[{ kind: 'strength_home' }, { kind: 'endurance' }], []],
    [[{ kind: 'strength_home' }, { kind: 'endurance' }, { kind: 'strength_home' }], []],
    [Array.from({ length: 7 }, () => ({ kind: 'endurance' as const })), ['too_many_days']],
  ] as const)('%j → %j', (slots, expected) => {
    expect(activeAgingScheduleHints(slots)).toEqual(expected);
  });

  it('Vorschlag: 2 Kraft-Tage zu Hause + 2 Geh-Tage', () => {
    const slots = suggestedActiveAgingSlots();
    expect(slots.filter((s) => s.kind === 'strength_home')).toHaveLength(2);
    expect(slots.filter((s) => s.kind === 'endurance')).toHaveLength(2);
  });
});

describe('Gleichgewichts-Vorspann vor Geh-Einheiten (N3)', () => {
  const library = repoLibrary();
  const plan = (agingFlags?: ('fall_history' | 'anticoagulant' | 'bone_health')[]) => {
    const result = generateTrainingPlan(
      person({
        goalType: 'active_aging',
        birthDate: '1954-03-01',
        schedule: {
          mode: 'flex',
          slots: suggestedActiveAgingSlots().map(({ kind, minutes }) => ({ kind, minutes })),
        },
        ...(agingFlags ? { agingScreening: { flags: agingFlags } } : {}),
      }),
      library,
      MONDAY,
    );
    if (!result.ok) throw new Error(result.error);
    return result.plan;
  };

  it('Blutverdünner oder Sturz → Variante „beidhändig festhalten“', () => {
    for (const flags of [['anticoagulant'], ['fall_history']] as const) {
      const walks = plan([...flags]).sessions.filter((s) => s.kind === 'endurance');
      expect(walks.length).toBeGreaterThan(0);
      for (const s of walks) expect(s.warmup_de.startsWith(BALANCE_PRELUDE_DE.hold_on)).toBe(true);
    }
  });

  it('Zusatzfragen sind Gesundheitsdaten: nie im gespeicherten Schnappschuss', () => {
    expect(JSON.stringify(plan(['bone_health']).inputs)).not.toContain('bone_health');
  });

  it('jede Geh-Einheit beginnt mit dem Vorspann „Halt in Reichweite“ (ohne Angaben)', () => {
    const walks = plan().sessions.filter((s) => s.kind === 'endurance');
    expect(walks.length).toBeGreaterThan(0);
    for (const s of walks) {
      expect(s.warmup_de.startsWith(BALANCE_PRELUDE_DE.chair_nearby)).toBe(true);
      expect(s.warmup_de.length).toBeLessThanOrEqual(400);
    }
  });

  it('feste Texte: Varianten, Länge in der Datenbank-Grenze, keine Wirkungsaussage', () => {
    for (const text of Object.values(BALANCE_PRELUDE_DE)) {
      expect(text.length).toBeLessThan(200);
      expect(text).not.toMatch(/sturz|verhindert|garantiert/i);
    }
    expect(BALANCE_PRELUDE_DE.hold_on).toMatch(/beiden Händen/);
  });

  it('andere Ziele: kein Vorspann', () => {
    const result = generateTrainingPlan(
      person({
        goalType: 'general_fitness',
        schedule: { mode: 'flex', slots: [{ kind: 'endurance', minutes: 30 }] },
      }),
      library,
      MONDAY,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const s of result.plan.sessions) {
      expect(s.warmup_de).not.toContain('Gleichgewicht');
    }
  });
});
