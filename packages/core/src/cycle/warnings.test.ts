import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import { CYCLE_STATUSES, defaultCycleSettings, type CycleEntry, type CycleStatus } from './schemas';
import { dailyEntries, entry, regularCycles } from './test-helpers';
import {
  activeCycleWarnings,
  cycleWarnings,
  isDismissed,
  lowEnergyDays,
  type CycleWarningInput,
} from './warnings';

const TODAY = '2026-10-21';

function input(overrides: Partial<CycleWarningInput> = {}): CycleWarningInput {
  return {
    today: TODAY,
    status: 'natural',
    ageYears: 30,
    entries: [],
    settings: { ...defaultCycleSettings(), enabledOn: '2026-01-01' },
    fatLossGoal: false,
    sessionsPerWeek: 3,
    warningsEnabled: true,
    ...overrides,
  };
}

/** Periode vor `daysAgo` Tagen, danach tägliche Einträge ohne Blutung bis heute. */
function lastPeriodDaysAgo(daysAgo: number): CycleEntry[] {
  const start = addDays(TODAY, -daysAgo);
  return dailyEntries(start, daysAgo + 1, { bleeding: (i) => (i < 4 ? 'medium' : 'none') });
}

describe('W1 Periode bleibt aus (≥ 90 Tage)', () => {
  it('genau 90 Tage → W1, 89 Tage → keine Warnung', () => {
    expect(activeCycleWarnings(input({ entries: lastPeriodDaysAgo(90) }))).toContain('W1');
    expect(activeCycleWarnings(input({ entries: lastPeriodDaysAgo(89) }))).not.toContain('W1');
  });

  it('unvollständige Daten → keine W1 (die App schweigt statt falsch zu warnen)', () => {
    const sparse = [
      ...dailyEntries(addDays(TODAY, -100), 4, { bleeding: () => 'medium' }),
      entry(addDays(TODAY, -50), { energy: 3 }),
    ];
    expect(activeCycleWarnings(input({ entries: sparse }))).not.toContain('W1');
    // Rückfrage bestätigt → vollständig
    expect(
      activeCycleWarnings(
        input({
          entries: sparse,
          settings: { ...input().settings, noBleedingConfirmedUntil: TODAY },
        }),
      ),
    ).toContain('W1');
  });

  it('Einschalt-Antwort „mehr als 3 Monate“ ohne Einträge → W1 sofort', () => {
    const settings = {
      ...defaultCycleSettings(),
      enabledOn: TODAY,
      lastPeriodAtStart: 'over_3_months' as const,
    };
    expect(activeCycleWarnings(input({ settings }))).toEqual(['W1']);
    // Periode seit dem Einschalten erfasst → Antwort gilt nicht mehr
    expect(
      activeCycleWarnings(
        input({
          settings: { ...settings, enabledOn: addDays(TODAY, -10) },
          entries: [entry(addDays(TODAY, -2), { bleeding: 'medium' })],
        }),
      ),
    ).not.toContain('W1');
  });

  it('„weniger als 1 Monat“ ohne Periode: Bezug ist der Tag des Einschaltens', () => {
    const settings = {
      ...defaultCycleSettings(),
      enabledOn: addDays(TODAY, -90),
      lastPeriodAtStart: 'under_1_month' as const,
    };
    const entries = dailyEntries(addDays(TODAY, -90), 91);
    expect(activeCycleWarnings(input({ settings, entries }))).toContain('W1');
    expect(
      activeCycleWarnings(
        input({ settings: { ...settings, lastPeriodAtStart: 'unknown' }, entries }),
      ),
    ).not.toContain('W1');
  });

  it('W1b zusätzlich bei Ziel Fettverlust, ≥ 5 Einheiten oder oft wenig Energie', () => {
    const entries = lastPeriodDaysAgo(95);
    expect(activeCycleWarnings(input({ entries }))).not.toContain('W1b');
    expect(activeCycleWarnings(input({ entries, fatLossGoal: true }))).toContain('W1b');
    expect(activeCycleWarnings(input({ entries, sessionsPerWeek: 5 }))).toContain('W1b');
    expect(activeCycleWarnings(input({ entries, sessionsPerWeek: 4 }))).not.toContain('W1b');
    const tired = entries.map((e, i) =>
      i >= entries.length - 7 ? { ...e, payload: { ...e.payload, energy: 2 } } : e,
    );
    expect(activeCycleWarnings(input({ entries: tired }))).toContain('W1b');
  });

  it('nur bei natürlichem Zyklus', () => {
    for (const status of CYCLE_STATUSES.filter((s) => s !== 'natural')) {
      expect(activeCycleWarnings(input({ status, entries: lastPeriodDaysAgo(120) }))).not.toContain(
        'W1',
      );
    }
  });
});

describe('W1c oft wenig Energie (Pille, Stillzeit, keine Angabe)', () => {
  const tired = (days: number) =>
    dailyEntries(addDays(TODAY, -13), 14, { extra: (i) => ({ energy: i < days ? 2 : 4 }) });

  it.each(['hormonal_contraception', 'breastfeeding', 'unspecified'] as CycleStatus[])(
    '%s: 7 von 14 Tagen + viel Training → W1c, 6 Tage nicht',
    (status) => {
      expect(
        activeCycleWarnings(input({ status, entries: tired(7), fatLossGoal: true })),
      ).toContain('W1c');
      expect(
        activeCycleWarnings(input({ status, entries: tired(6), fatLossGoal: true })),
      ).not.toContain('W1c');
      expect(activeCycleWarnings(input({ status, entries: tired(7) }))).not.toContain('W1c');
    },
  );

  it('nicht bei natürlichem Zyklus (dort W1b)', () => {
    expect(activeCycleWarnings(input({ entries: tired(14), sessionsPerWeek: 6 }))).not.toContain(
      'W1c',
    );
  });

  it('zählt nur die letzten 14 Tage', () => {
    const entries = dailyEntries(addDays(TODAY, -20), 21, { extra: () => ({ energy: 1 }) });
    expect(lowEnergyDays(entries, TODAY)).toBe(14);
  });
});

describe('W2 Zykluslänge', () => {
  it('18 Jahre: 2 von 3 Zyklen mit 40 Tagen → W2; 38 Tage → keine', () => {
    const long = regularCycles(addDays(TODAY, -125), 40, 4, 126);
    expect(activeCycleWarnings(input({ ageYears: 18, entries: long }))).toContain('W2');
    const edge = regularCycles(addDays(TODAY, -120), 38, 4, 121);
    expect(activeCycleWarnings(input({ ageYears: 18, entries: edge }))).not.toContain('W2');
  });

  it('16 und 17 Jahre: 21–45 Tage sind unauffällig, 46 auffällig', () => {
    for (const age of [16, 17]) {
      const fourty = regularCycles(addDays(TODAY, -130), 42, 4, 131);
      expect(activeCycleWarnings(input({ ageYears: age, entries: fourty }))).not.toContain('W2');
      const long = regularCycles(addDays(TODAY, -140), 46, 4, 141);
      expect(activeCycleWarnings(input({ ageYears: age, entries: long }))).toContain('W2');
    }
  });

  it('kurze Zyklen (23 Tage) bei Erwachsenen und 55 Jahre mit natürlichem Zyklus', () => {
    const short = regularCycles(addDays(TODAY, -80), 23, 4, 81);
    expect(activeCycleWarnings(input({ entries: short }))).toContain('W2');
    expect(activeCycleWarnings(input({ ageYears: 55, entries: short }))).toContain('W2');
    const ok = regularCycles(addDays(TODAY, -80), 24, 4, 81);
    expect(activeCycleWarnings(input({ entries: ok }))).not.toContain('W2');
  });

  it('nur ein auffälliger Zyklus → keine W2; Wechseljahre → keine Längen-Warnung', () => {
    const entries = [
      ...regularCycles(addDays(TODAY, -100), 40, 4, 41),
      ...regularCycles(addDays(TODAY, -59), 28, 4, 60),
    ];
    expect(activeCycleWarnings(input({ entries }))).not.toContain('W2');
    const long = regularCycles(addDays(TODAY, -125), 40, 4, 126);
    expect(activeCycleWarnings(input({ status: 'perimenopause', entries: long }))).not.toContain(
      'W2',
    );
  });
});

describe('W3, W4, W5, W6, W8', () => {
  it('W3: 9 Tage → Warnung, 8 Tage → keine; bei hormoneller Verhütung eigener Code', () => {
    const nine = dailyEntries(addDays(TODAY, -20), 21, {
      bleeding: (i) => (i < 9 ? 'light' : 'none'),
    });
    const eight = dailyEntries(addDays(TODAY, -20), 21, {
      bleeding: (i) => (i < 8 ? 'light' : 'none'),
    });
    expect(activeCycleWarnings(input({ entries: nine }))).toContain('W3');
    expect(activeCycleWarnings(input({ entries: eight }))).not.toContain('W3');
    expect(activeCycleWarnings(input({ status: 'hormonal_contraception', entries: nine }))).toEqual(
      ['W3_hormonal'],
    );
  });

  it('W4: 3 starke Tage in einem Zyklus → Warnung, 2 Tage → keine; 2 Zyklen nacheinander → Warnung', () => {
    const heavy = (n: number) =>
      dailyEntries(addDays(TODAY, -20), 21, {
        bleeding: (i) => (i < n ? 'heavy' : i < 5 ? 'medium' : 'none'),
      });
    expect(activeCycleWarnings(input({ entries: heavy(3) }))).toContain('W4');
    expect(activeCycleWarnings(input({ entries: heavy(2) }))).not.toContain('W4');
    const twoCycles = regularCycles(addDays(TODAY, -40), 28, 4, 41).map((e, i) =>
      i % 28 === 0 ? { ...e, payload: { bleeding: 'heavy' as const } } : e,
    );
    expect(activeCycleWarnings(input({ entries: twoCycles }))).toContain('W4');
    expect(
      activeCycleWarnings(input({ status: 'hormonal_contraception', entries: heavy(3) })),
    ).toContain('W4_hormonal');
  });

  it('W5: starke Krämpfe an 2 Tagen in 2 Zyklen nacheinander', () => {
    const cramps = (days: number) =>
      regularCycles(addDays(TODAY, -40), 28, 4, 41).map((e, i) =>
        i % 28 < days
          ? { ...e, payload: { ...e.payload, symptoms: { cramps: 'strong' as const } } }
          : e,
      );
    expect(activeCycleWarnings(input({ entries: cramps(2) }))).toContain('W5');
    expect(activeCycleWarnings(input({ entries: cramps(1) }))).not.toContain('W5');
  });

  it('W6: jede Blutung nach den Wechseljahren, auch Schmierblutung', () => {
    const spot = [entry(addDays(TODAY, -3), { bleeding: 'spotting' })];
    expect(activeCycleWarnings(input({ status: 'postmenopause', entries: spot }))).toEqual(['W6']);
    expect(activeCycleWarnings(input({ status: 'natural', entries: spot }))).toEqual([]);
    const old = [entry(addDays(TODAY, -91), { bleeding: 'medium' })];
    expect(activeCycleWarnings(input({ status: 'postmenopause', entries: old }))).toEqual([]);
  });

  it('W8: Blutung außerhalb der Periode in 2 Zyklen nacheinander (nur natürlich)', () => {
    const entries = regularCycles(addDays(TODAY, -60), 28, 4, 61).map((e, i) =>
      i % 28 === 14 ? { ...e, payload: { bleeding: 'spotting' as const } } : e,
    );
    expect(activeCycleWarnings(input({ entries }))).toContain('W8');
    expect(activeCycleWarnings(input({ status: 'unspecified', entries }))).not.toContain('W8');
  });

  it('Stimmung gedrückt – stark an 3 von 7 Tagen → seelischer Hinweis, 2 Tage nicht', () => {
    const mood = (n: number) =>
      dailyEntries(addDays(TODAY, -6), 7, {
        extra: (i) => (i < n ? { symptoms: { low_mood: 'strong' as const } } : {}),
      });
    expect(activeCycleWarnings(input({ entries: mood(3) }))).toContain('mood_support');
    expect(activeCycleWarnings(input({ entries: mood(2) }))).not.toContain('mood_support');
    expect(
      activeCycleWarnings(input({ status: 'hormonal_contraception', entries: mood(3) })),
    ).toContain('mood_support');
  });
});

describe('Schalter, Status und Wegtippen', () => {
  it('Flag cycle_warnings aus → keine Warnung', () => {
    expect(
      activeCycleWarnings(input({ warningsEnabled: false, entries: lastPeriodDaysAgo(120) })),
    ).toEqual([]);
  });

  it('schwanger oder ohne Status → keine Warnung', () => {
    expect(
      activeCycleWarnings(input({ status: 'pregnant', entries: lastPeriodDaysAgo(120) })),
    ).toEqual([]);
    expect(activeCycleWarnings(input({ status: null, entries: lastPeriodDaysAgo(120) }))).toEqual(
      [],
    );
  });

  it('weggetippt: 29 Tage aus, nach 30 Tagen wieder da', () => {
    const entries = lastPeriodDaysAgo(120);
    const dismissed = (days: number) => ({
      ...input().settings,
      dismissed: { W1: addDays(TODAY, -days) },
    });
    expect(cycleWarnings(input({ entries, settings: dismissed(29) }))).not.toContain('W1');
    expect(cycleWarnings(input({ entries, settings: dismissed(30) }))).toContain('W1');
    expect(isDismissed(undefined, TODAY)).toBe(false);
  });

  it('nie eine Entwarnung: unauffällige Daten → leere Liste', () => {
    expect(
      activeCycleWarnings(input({ entries: regularCycles(addDays(TODAY, -90), 28, 5, 91) })),
    ).toEqual([]);
  });
});
