import { describe, expect, it } from 'vitest';

import {
  areaColors,
  brandColors,
  cardColors,
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  heroColors,
  largeViewColors,
  maxContentWidth,
  radius,
  spacing,
  type AreaId,
} from './tokens';

/** Relative Leuchtdichte nach WCAG 2.2 (nur #RRGGBB). */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Farben (1 bis 21). */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Farbton in Grad (0–360). */
function hue(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const schemes = ['light', 'dark'] as const;
const areaIds = Object.keys(areaColors.light) as AreaId[];

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

describe('areaColors (Bereichsfarben)', () => {
  it('hat alle Bereiche aus dem Entwurf, hell und dunkel mit denselben Rollen', () => {
    expect(areaIds).toEqual([
      'training',
      'workouts',
      'ernaehrung',
      'einkaufen',
      'ausdauer',
      'wettkampf',
      'fortschritt',
    ]);
    for (const area of areaIds) {
      expect(Object.keys(areaColors.dark[area])).toEqual(['surface', 'icon', 'strong', 'soft']);
      expect(Object.keys(areaColors.light[area])).toEqual(['surface', 'icon', 'strong', 'soft']);
    }
  });

  it('übernimmt die Farben aus dem Entwurf (hell)', () => {
    expect(areaColors.light.training).toMatchObject({ surface: '#E3EBFF', icon: '#1747CC' });
    expect(areaColors.light.workouts).toMatchObject({ surface: '#EDE9FE', icon: '#6D28D9' });
    expect(areaColors.light.ernaehrung).toMatchObject({ surface: '#DCFCE7', strong: '#16A34A' });
    expect(areaColors.light.einkaufen).toMatchObject({ surface: '#CFFAFE', icon: '#0E7490' });
    expect(areaColors.light.ausdauer).toMatchObject({ surface: '#FFEDD5', strong: '#EA580C' });
    expect(areaColors.light.wettkampf).toMatchObject({ surface: '#FDECD8', icon: '#C2410C' });
  });

  it.each(schemes)('Icon/Akzent-Text erreicht 4,5 : 1 auf der Karte (%s)', (scheme) => {
    for (const area of areaIds) {
      const ratio = contrast(areaColors[scheme][area].icon, colors[scheme].surface);
      expect(ratio, `${area} icon`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(schemes)('Icon erreicht 3 : 1 auf der Chip-Fläche (%s, WCAG 1.4.11)', (scheme) => {
    for (const area of areaIds) {
      const { icon, surface } = areaColors[scheme][area];
      expect(contrast(icon, surface), `${area} chip`).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(schemes)('Ring/Balken (strong) erreicht 3 : 1 auf der Karte (%s)', (scheme) => {
    for (const area of areaIds) {
      const ratio = contrast(areaColors[scheme][area].strong, colors[scheme].surface);
      expect(ratio, `${area} strong`).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(schemes)('Text bleibt auf jeder Chip-Fläche lesbar (%s)', (scheme) => {
    for (const area of areaIds) {
      const ratio = contrast(colors[scheme].text, areaColors[scheme][area].surface);
      expect(ratio, `${area} text`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(schemes)('Ausdauer-Orange ist klar von Signal/Warnung getrennt (%s)', (scheme) => {
    const warnHues = [hue(brandColors.signal), hue(colors[scheme].warning)];
    for (const area of ['ausdauer', 'wettkampf'] as const) {
      for (const role of ['icon', 'strong'] as const) {
        for (const warn of warnHues) {
          expect(
            hueDistance(hue(areaColors[scheme][area][role]), warn),
            `${area}.${role}`,
          ).toBeGreaterThanOrEqual(12);
        }
      }
    }
  });
});

describe('heroColors und cardColors', () => {
  it.each(schemes)('Hero-Texte erreichen 4,5 : 1 (%s)', (scheme) => {
    const hero = heroColors[scheme];
    for (const key of ['text', 'muted', 'accent'] as const) {
      expect(contrast(hero[key], hero.background), key).toBeGreaterThanOrEqual(4.5);
    }
    // Großer Pillen-Knopf in Primärfarbe: Fläche ≥ 3 : 1 zur Hero-Fläche, Schrift ≥ 4,5 : 1.
    expect(contrast(colors[scheme].primary, hero.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors[scheme].primaryText, colors[scheme].primary)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('hebt die Hero-Karte im Dunkelmodus vom Hintergrund ab (Rand)', () => {
    expect(heroColors.dark.border).not.toBe(colors.dark.background);
  });

  it('hat Kartenrand und Trennlinie hell und dunkel', () => {
    expect(Object.keys(cardColors.light)).toEqual(['border', 'divider']);
    expect(Object.keys(cardColors.dark)).toEqual(['border', 'divider']);
  });
});

describe('Schrift', () => {
  it('nutzt Plus Jakarta Sans mit 400/600/700/800', () => {
    expect(fontFamily.base).toBe('Plus Jakarta Sans');
    expect(fontWeight).toEqual({ regular: '400', semibold: '600', bold: '700', extrabold: '800' });
    expect(fontSize.xs).toBe(13);
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

  it('Karten-Radius 20 und Chip-Radius 12 (Entwurf)', () => {
    expect(radius.lg).toBe(20);
    expect(radius.md).toBe(12);
  });
});

describe('largeViewColors („Große Ansicht“, docs/PLAN-FIT-IM-ALTER.md 12 Nr. 3)', () => {
  it('hat hell und dunkel dieselben Rollen', () => {
    expect(Object.keys(largeViewColors.dark).sort()).toEqual(
      Object.keys(largeViewColors.light).sort(),
    );
  });

  it.each(schemes)(
    'erreicht im Modus %s mindestens 7 : 1 (AAA) auf Hintergrund und Fläche',
    (scheme) => {
      for (const [role, value] of Object.entries(largeViewColors[scheme])) {
        for (const base of [colors[scheme].background, colors[scheme].surface]) {
          expect({ role, ratio: contrast(value, base) >= 7 }).toEqual({ role, ratio: true });
        }
      }
    },
  );
});
