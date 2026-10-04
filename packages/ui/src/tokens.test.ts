import { describe, expect, it } from 'vitest';

import { brandColors, colors, fontSize, maxContentWidth, radius, spacing } from './tokens';

describe('colors', () => {
  it('hat in hellem und dunklem Modus dieselben Farb-Schlüssel', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('verwendet nur Farben, die React Native und Browser verstehen', () => {
    for (const scheme of Object.values(colors)) {
      for (const value of Object.values(scheme)) {
        expect(value).toMatch(/^(#[0-9A-F]{6}([0-9A-F]{2})?|(rgba?|hsla?)\([^()]+\)|transparent)$/);
      }
    }
  });
});

describe('brandColors', () => {
  it('enthält die Markenfarben von Alpha5 (docs/ALPHA5-PAKET.md)', () => {
    expect(brandColors).toMatchObject({
      schwarz: '#0A0C10',
      blau: '#1F5BFF',
      hell: '#F4F6FA',
      signal: '#FFB020',
    });
  });

  it('nutzt die Markenfarben für Hintergrund und Hauptfarbe', () => {
    expect(colors.light.background).toBe(brandColors.hell);
    expect(colors.light.primary).toBe(brandColors.blau);
    expect(colors.dark.background).toBe(brandColors.schwarz);
    expect(colors.dark.primary).toBe(brandColors.blau);
    expect(colors.dark.link).toBe(brandColors.himmel);
  });
});

describe('Größen', () => {
  it('sind nicht-negative Zahlen in Pixeln', () => {
    for (const value of [
      ...Object.values(spacing),
      ...Object.values(radius),
      ...Object.values(fontSize),
      maxContentWidth,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
