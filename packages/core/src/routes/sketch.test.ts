import { describe, expect, it } from 'vitest';

import { sketchPath, sketchPoints } from './sketch';
import { offset, START } from './test-helpers';

const box = { width: 200, height: 100, padding: 10 };

describe('Linien-Skizze', () => {
  it('weniger als 2 Punkte → leer', () => {
    expect(sketchPoints([], box)).toEqual([]);
    expect(sketchPoints([START], box)).toEqual([]);
    expect(sketchPath([])).toBe('');
  });

  it('liegt im Rahmen (mit Rand) und ist mittig', () => {
    const pts = [START, offset(START, 1_000, 0), offset(START, 1_000, 2_000)];
    const s = sketchPoints(pts, box);
    for (const p of s) {
      expect(p.x).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(190 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(90 + 1e-9);
    }
    // Seitentreu: 2.000 m breit, 1.000 m hoch → passt genau in 180 × 80? Höhe begrenzt (80), Breite 160.
    const xs = s.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(160, 0);
    // Norden oben: der zweite Punkt liegt höher (kleineres y) als der Start.
    expect((s[1] as { y: number }).y).toBeLessThan((s[0] as { y: number }).y);
  });

  it('gleiche Punkte → alle in der Mitte; Datumsgrenze ohne Sprung', () => {
    const same = sketchPoints([START, START, START], box);
    for (const p of same) expect(p).toEqual({ x: 100, y: 50 });
    const across = sketchPoints(
      [
        { lat: 0, lng: 179.99 },
        { lat: 0, lng: -179.99 },
      ],
      box,
    );
    expect(Math.abs((across[1] as { x: number }).x - (across[0] as { x: number }).x)).toBeCloseTo(
      180,
      0,
    );
  });

  it('dünnt auf höchstens maxPoints aus, Anfang und Ende bleiben', () => {
    const pts = Array.from({ length: 5_000 }, (_, i) => offset(START, i, (i % 7) * 3));
    const s = sketchPoints(pts, { ...box, maxPoints: 100 });
    expect(s).toHaveLength(100);
    expect(sketchPath(s).startsWith('M')).toBe(true);
    expect(sketchPath(s).split('L')).toHaveLength(100);
  });
});
