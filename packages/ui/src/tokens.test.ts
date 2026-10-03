import { describe, expect, it } from 'vitest';

import { colors, fontSize, maxContentWidth, radius, spacing } from './tokens';

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
