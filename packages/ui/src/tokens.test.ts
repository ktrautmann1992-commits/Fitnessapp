import { describe, expect, it } from 'vitest';

import { colors } from './tokens';

describe('colors', () => {
  it('hat in hellem und dunklem Modus dieselben Farb-Schlüssel', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });

  it('verwendet nur gültige Hex-Farben', () => {
    for (const scheme of Object.values(colors)) {
      for (const value of Object.values(scheme)) {
        expect(value).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});
