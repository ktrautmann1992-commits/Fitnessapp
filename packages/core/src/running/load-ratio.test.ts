import { describe, expect, it } from 'vitest';

import { LOAD_RATIO, MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION } from '../constants';
import { addDays } from '../dates';
import { loadRatio, type LoadRatioLog, runVolumeChange } from './load-ratio';

const today = '2026-10-25';

/** Einheit mit 30 min × Anstrengung 5 = 150 Punkte (bzw. eigene Werte). */
function log(daysAgo: number, minutes = 30, effort: number | null = 5): LoadRatioLog {
  return {
    performed_on: addDays(today, -daysAgo),
    durationS: minutes * 60,
    effort,
    sport: null,
  };
}

/** Gleichmäßig: jeden `every`. Tag eine Einheit über `days` Tage. */
function steady(days: number, every: number, minutes = 30): LoadRatioLog[] {
  const out: LoadRatioLog[] = [];
  for (let d = 0; d < days; d += every) out.push(log(d, minutes));
  return out;
}

describe('loadRatio', () => {
  it('zu kurzes Tagebuch (unter 21 Tagen) → keine Ampel', () => {
    expect(LOAD_RATIO.minHistoryDays).toBe(21);
    expect(loadRatio({ logs: steady(20, 1), runs: [], today })).toEqual({
      kind: 'insufficient',
      reason: 'too_little_history',
    });
    expect(loadRatio({ logs: [], runs: [], today }).kind).toBe('insufficient');
  });

  it('zu wenig Belastung → keine Ampel', () => {
    // Eine Einheit 10 min × 3 vor 25 Tagen = 30 Punkte in 4 Wochen.
    expect(loadRatio({ logs: [log(25, 10, 3)], runs: [], today })).toEqual({
      kind: 'insufficient',
      reason: 'too_little_load',
    });
  });

  it('gleichmäßig trainiert → grün, Verhältnis 1', () => {
    const r = loadRatio({ logs: steady(28, 1), runs: [], today });
    expect(r).toEqual({
      kind: 'ok',
      level: 'green',
      ratio: 1,
      acuteLoad: 7 * 150,
      chronicWeeklyLoad: 7 * 150,
      low: false,
      volume: null,
      volumeRaised: false,
    });
  });

  it('letzte Woche deutlich mehr → gelb bzw. rot (Grenzen 1,3 und 1,5)', () => {
    // 3 Wochen je 3 × 150 = 450, letzte Woche x → chronisch (1350 + x) / 4.
    const base = [8, 10, 12, 15, 17, 19, 22, 24, 26].map((d) => log(d));
    const week = (n: number) => Array.from({ length: n }, (_, i) => log(i % 7));
    // 5 Einheiten: 750 / ((1350 + 750) / 4) = 1,43 → gelb.
    expect(loadRatio({ logs: [...base, ...week(5)], runs: [], today })).toMatchObject({
      level: 'yellow',
    });
    // 7 Einheiten: 1050 / 600 = 1,75 → rot.
    expect(loadRatio({ logs: [...base, ...week(7)], runs: [], today })).toMatchObject({
      level: 'red',
    });
    // 4 Einheiten: 600 / 487,5 = 1,23 → grün.
    expect(loadRatio({ logs: [...base, ...week(4)], runs: [], today })).toMatchObject({
      level: 'green',
    });
  });

  it('Erholungswoche → grün mit „weniger als gewohnt“', () => {
    const logs = [...steady(28, 1).filter((l) => l.performed_on < addDays(today, -6)), log(0)];
    expect(loadRatio({ logs, runs: [], today })).toMatchObject({ level: 'green', low: true });
  });

  it('1 vs. 7 Trainingstage je Woche: beide gleichmäßig → grün', () => {
    const once = [0, 7, 14, 21].map((d) => log(d, 60, 6));
    expect(loadRatio({ logs: once, runs: [], today })).toMatchObject({ level: 'green' });
    expect(loadRatio({ logs: steady(28, 1), runs: [], today })).toMatchObject({ level: 'green' });
  });

  it('Einheiten in der Zukunft zählen nicht', () => {
    const r = loadRatio({ logs: [...steady(28, 2), log(-1, 600, 10)], runs: [], today });
    expect(r).toMatchObject({ level: 'green' });
  });

  it('10-%-Regel: Lauf-km +20 % macht Grün zu Gelb', () => {
    expect(MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION).toBe(0.1);
    const runs = [
      { day: addDays(today, -1), distanceM: 12_000 },
      { day: addDays(today, -9), distanceM: 10_000 },
    ];
    const r = loadRatio({ logs: steady(28, 2), runs, today });
    expect(r).toMatchObject({ kind: 'ok', level: 'yellow', volumeRaised: true });
    if (r.kind === 'ok') {
      expect(r.volume).toEqual({ currentKm: 12, previousKm: 10, increase: 0.2, aboveRule: true });
    }
  });
});

describe('runVolumeChange', () => {
  it('genau +10 % ist erlaubt, darüber nicht', () => {
    const at = (d: number, m: number) => ({ day: addDays(today, -d), distanceM: m });
    expect(runVolumeChange([at(0, 11_000), at(7, 10_000)], today)?.aboveRule).toBe(false);
    expect(runVolumeChange([at(0, 11_100), at(7, 10_000)], today)?.aboveRule).toBe(true);
  });

  it('Vorwoche unter 5 km → kein Vergleich; Distanz null zählt 0', () => {
    expect(runVolumeChange([{ day: today, distanceM: 20_000 }], today)).toBeNull();
    expect(
      runVolumeChange(
        [
          { day: today, distanceM: null },
          { day: addDays(today, -8), distanceM: 6_000 },
        ],
        today,
      ),
    ).toEqual({ currentKm: 0, previousKm: 6, increase: -1, aboveRule: false });
  });
});
