import { describe, expect, it } from 'vitest';

import { adjustRest, isRestOver, remainingSeconds, restAfterSet, startRest } from './rest-timer';

describe('Pausentimer (Abschnitt 5.5)', () => {
  it('Restzeit aus Zeitstempeln – auch nach Zeitsprung (Hintergrund)', () => {
    const t = startRest(90, 1_000_000);
    expect(remainingSeconds(t, 1_000_000)).toBe(90);
    expect(remainingSeconds(t, 1_000_500)).toBe(90);
    expect(remainingSeconds(t, 1_001_000)).toBe(89);
    expect(isRestOver(t, 1_089_999)).toBe(false);
    // App war 10 Minuten im Hintergrund
    expect(remainingSeconds(t, 1_600_000)).toBe(0);
    expect(isRestOver(t, 1_600_000)).toBe(true);
  });

  it('Anpassen: ±15 s, nie unter 0 oder über 600 s', () => {
    const t = startRest(30, 0);
    expect(adjustRest(t, 15).durationS).toBe(45);
    expect(adjustRest(adjustRest(adjustRest(t, -15), -15), -15).durationS).toBe(0);
    expect(adjustRest(startRest(590, 0), 15).durationS).toBe(600);
    expect(startRest(-5, 0).durationS).toBe(0);
    expect(startRest(900, 0).durationS).toBe(600);
  });

  it('Supersatz: keine Pause bis zur letzten Übung der Gruppe', () => {
    const a = { order_no: 1, rest_s: 90, superset_group: 'A' };
    const b = { order_no: 2, rest_s: 60, superset_group: 'A' };
    const c = { order_no: 3, rest_s: 120, superset_group: null };
    expect(restAfterSet(a, b)).toBe(0);
    expect(restAfterSet(b, a)).toBe(60); // Runde zu Ende
    expect(restAfterSet(b, c)).toBe(60);
    expect(restAfterSet(c, c)).toBe(120);
    expect(restAfterSet(c, null)).toBe(0);
  });
});
