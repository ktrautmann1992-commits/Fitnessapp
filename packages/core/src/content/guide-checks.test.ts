import { describe, expect, it } from 'vitest';

import { checkGuide, findGuideAmountHints, mentionsCarbLoading } from './guide-checks';
import { CARB_LOADING_NOTICE_DE, type Guide, guideSchema } from './guide-schema';
import { RECIPE_META } from './nutrition-fixtures';

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'wettkampf',
    version: 1,
    status: 'draft',
    title_de: 'Wettkampf-Ernährung',
    sections: [
      {
        heading_de: 'Nichts Neues am Wettkampftag',
        body_de: ['Teste jede Mahlzeit vorher im Training.'],
      },
    ],
    meta: { ...RECIPE_META, origin: 'manual', model: null },
    ...overrides,
  };
}

describe('Ratgeber-Schema (R1)', () => {
  it('gültig, mit Orten; Freigabe nur mit Prüfer', () => {
    const guide = makeGuide({
      places: [
        {
          name_de: 'Beim Bäcker',
          good_de: ['Vollkornbrötchen mit Käse'],
          less_often_de: ['Croissants'],
          tip_de: 'Doppelter Belag statt zwei Brötchen.',
        },
      ],
    });
    expect(guideSchema.safeParse(guide).success).toBe(true);
    expect(guideSchema.safeParse(makeGuide({ sections: [] })).success).toBe(false);
    expect(guideSchema.safeParse(makeGuide({ status: 'published' })).success).toBe(false);
  });
});

describe('R21 (rot)', () => {
  it('sauberer Ratgeber → keine Befunde', () => {
    expect(checkGuide(makeGuide())).toEqual([]);
  });

  it('Heil- oder Gesundheitsversprechen → rot', () => {
    const issues = checkGuide(
      makeGuide({
        sections: [{ heading_de: 'Richtwerte', body_de: ['Für gesunde Freizeitsportler.'] }],
      }),
    );
    expect(issues.map((i) => [i.rule, i.severity, i.path])).toEqual([
      ['R21', 'error', 'sections.0.body_de.0'],
    ]);
  });

  it('Carb-Loading ohne festen Hinweis → rot, mit Hinweis → nur gelbe Mengenangabe', () => {
    const section = {
      heading_de: 'Carb-Loading: wann und wie viel',
      body_de: ['Etwa 8–10 g Kohlenhydrate pro kg Körpergewicht pro Tag.'],
    };
    const without = checkGuide(makeGuide({ sections: [section] }));
    expect(without.map((i) => i.rule).sort()).toEqual(['R21', 'R21H']);
    const withNotice = checkGuide(
      makeGuide({ sections: [{ ...section, notice_de: CARB_LOADING_NOTICE_DE }] }),
    );
    expect(withNotice.map((i) => i.rule)).toEqual(['R21H']);
    const wrongWording = checkGuide(
      makeGuide({ sections: [{ ...section, notice_de: 'Bitte vorsichtig sein, danke.' }] }),
    );
    expect(wrongWording.map((i) => i.rule).sort()).toEqual(['R21', 'R21H']);
  });

  it('Carb-Loading in allen Schreibweisen erkannt', () => {
    expect(mentionsCarbLoading('Carb-Loading')).toBe(true);
    expect(mentionsCarbLoading('carbloading')).toBe(true);
    expect(mentionsCarbLoading('Carb Loading')).toBe(true);
    expect(mentionsCarbLoading('Kohlenhydrate laden')).toBe(false);
  });
});

describe('R21H (gelb): Mengen zur Fachprüfung (S14)', () => {
  it('g je kg Körpergewicht oder je Stunde', () => {
    expect(findGuideAmountHints('Etwa 1–3 g Kohlenhydrate pro kg Körpergewicht.')).toHaveLength(1);
    expect(findGuideAmountHints('Rund 30–60 g Kohlenhydrate pro Stunde.')).toHaveLength(1);
  });

  it('mg-Angaben und Supplement-Dosierungen', () => {
    expect(findGuideAmountHints('Nicht mehr als 200 mg am Tag.')).toEqual([
      'mg-Angabe: „Nicht mehr als 200 mg am Tag.“',
    ]);
    expect(findGuideAmountHints('Koffein: 3 Tassen Kaffee vor dem Start.')).toHaveLength(1);
  });

  it('absolute Mengen ohne Bezug, Trinkmengen und Text ohne Zahl → kein Hinweis', () => {
    expect(findGuideAmountHints('Etwa 20–40 g Eiweiß nach dem Rennen.')).toEqual([]);
    expect(findGuideAmountHints('300–500 ml in den Stunden vor dem Start.')).toEqual([]);
    expect(findGuideAmountHints('Koffein kann helfen.')).toEqual([]);
  });
});
