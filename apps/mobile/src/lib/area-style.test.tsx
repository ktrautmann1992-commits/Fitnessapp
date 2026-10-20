import { NAV_AREAS } from '@fitnessapp/core';
import { areaColors } from '@fitnessapp/ui';
import { describe, expect, it } from 'vitest';

import { ICON_NAMES } from '@/components/design';

import { NAV_AREA_STYLE } from './area-style';

describe('NAV_AREA_STYLE', () => {
  it('hat für jeden Bereich der Menüleiste eine Bereichsfarbe und ein vorhandenes Icon', () => {
    for (const area of NAV_AREAS) {
      const style = NAV_AREA_STYLE[area];
      expect(Object.keys(areaColors.light)).toContain(style.area);
      expect(ICON_NAMES).toContain(style.icon);
    }
  });

  it('ordnet wie vereinbart zu (Training blau, Einkaufen türkis, Übersicht/Mehr in Markenblau)', () => {
    expect(NAV_AREA_STYLE.today.area).toBe('training');
    expect(NAV_AREA_STYLE.einkaufsliste.area).toBe('einkaufen');
    expect(NAV_AREA_STYLE.wettkampf.area).toBe('wettkampf');
    expect(NAV_AREA_STYLE.uebersicht.area).toBe('training');
    expect(NAV_AREA_STYLE.mehr.area).toBe('training');
  });
});
