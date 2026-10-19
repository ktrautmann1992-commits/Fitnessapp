import { describe, expect, it } from 'vitest';

import {
  proteinGapFromLog,
  proteinGapFromSelfCheck,
  resolveProteinGap,
  type ProteinLogDay,
} from './protein-gap';

function week(values: readonly (number | null)[]): ProteinLogDay[] {
  return values.map((proteinG, index) => ({ date: `2026-10-${String(12 + index)}`, proteinG }));
}

describe('Eiweiß-Lücke (Plan 3.7, Wächter S7)', () => {
  it('3 Tage mit Einträgen → zu wenig Daten (null), 4 Tage → Ergebnis', () => {
    expect(proteinGapFromLog(week([50, 50, 50, null, null, null, null]), 120)).toBeNull();
    expect(proteinGapFromLog(week([50, 50, 50, 50, null, null, null]), 120)).toEqual({
      gap: true,
      source: 'log',
    });
  });

  it('Schnitt nur über Tage mit Einträgen; 0 g zählt als Eintrag', () => {
    expect(proteinGapFromLog(week([120, 120, 120, 120, null, null, null]), 120)?.gap).toBe(false);
    expect(proteinGapFromLog(week([120, 120, 120, 0, null, null, null]), 120)?.gap).toBe(true);
  });

  it('Grenze 90 %: genau 90 % ist keine Lücke, knapp darunter schon', () => {
    expect(proteinGapFromLog(week([90, 90, 90, 90]), 100)?.gap).toBe(false);
    expect(proteinGapFromLog(week([89.9, 90, 90, 90]), 100)?.gap).toBe(true);
  });

  it('mehr als 7 Tage, doppelte Tage, Ziel 0 oder negative Werte → Fehler', () => {
    expect(() => proteinGapFromLog(week([1, 1, 1, 1, 1, 1, 1, 1]), 100)).toThrow();
    expect(() =>
      proteinGapFromLog(
        [
          { date: '2026-10-12', proteinG: 50 },
          { date: '2026-10-12', proteinG: 50 },
        ],
        100,
      ),
    ).toThrow();
    expect(() => proteinGapFromLog(week([50, 50, 50, 50]), 0)).toThrow();
    expect(() => proteinGapFromLog(week([-1, 50, 50, 50]), 100)).toThrow();
  });

  it('Selbsteinschätzung: „eher nicht“ = Lücke, „meist ja“ = keine, ohne Antwort null', () => {
    expect(proteinGapFromSelfCheck('rather_not')).toEqual({ gap: true, source: 'self_check' });
    expect(proteinGapFromSelfCheck('mostly_yes')).toEqual({ gap: false, source: 'self_check' });
    expect(proteinGapFromSelfCheck(undefined)).toBeNull();
    expect(proteinGapFromSelfCheck(null)).toBeNull();
  });

  it('Tagebuch geht vor Selbsteinschätzung', () => {
    const log = { gap: false, source: 'log' } as const;
    const self = { gap: true, source: 'self_check' } as const;
    expect(resolveProteinGap(log, self)).toBe(log);
    expect(resolveProteinGap(null, self)).toBe(self);
    expect(resolveProteinGap(null, null)).toBeNull();
  });
});
