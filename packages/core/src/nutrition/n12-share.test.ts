/**
 * Etappe N12 – Einkaufsliste weitergeben (docs/PLAN-PHASE-5.md 19.7 N12, 19.8 Nr. 8, KONZEPT 6.13): Textaufbau
 * (Abteilungen, Vorrat, eigene Einträge, Häkchen optional), Mengen-Rundung, Escaping (Steuerzeichen, Bidi, Emojis,
 * Umlaute, Links ohne Tracking), leere und sehr lange Listen, KEINE Gesundheitsdaten (Text unabhängig von
 * Gesundheitsbezug, Ersatz-Hinweisen und IDs), Hinweis vor dem Weitergeben (Ersatzprodukte/Austausch, N9 S5) und
 * Händler-Modul hinter Feature-Flag (aus, ohne Händler, nur Produktarten und Mengen).
 */
import { describe, expect, it } from 'vitest';

import { FEATURE_FLAGS, SHOPPING_LIST_SHARE } from '../constants';
import { SHOPPING_CATEGORIES, type ShoppingCategory } from '../content/food-schema';
import { addDays } from '../dates';
import {
  RETAIL_INTEGRATION_CONDITIONS,
  RETAIL_PROVIDERS,
  type RetailProvider,
  retailIntegrationAvailable,
  retailOrderLines,
} from '../retail';
import type { MealPlanWeek, PlannedMeal } from './meal-plan';
import { N3_FOODS } from './meal-plan-fixtures';
import { zeroNutrients } from './recipe-nutrients';
import type { ScaledIngredient } from './scale';
import {
  buildShoppingList,
  type ShoppingList,
  type ShoppingListItem,
  setShoppingItemChecked,
} from './shopping-list';
import {
  sanitizeShareLabel,
  shareAmountText,
  shoppingListShareNotice,
  shoppingListShareNoticeKey,
  shoppingListShareOptionsSchema,
  shoppingListToText,
} from './shopping-list-share';
import { seededRandom } from './test-helpers';

const WEEK = '2026-10-12';

function item(labelDe: string, extra: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    itemKey: `${labelDe}|g`,
    foodId: labelDe.toLowerCase(),
    labelDe,
    amount: 100,
    unit: 'g',
    category: 'other',
    isPantry: false,
    isManual: false,
    checked: false,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
    ...extra,
  };
}

function list(items: ShoppingListItem[], usesHealthData = false): ShoppingList {
  return { from: WEEK, to: addDays(WEEK, 6), usesHealthData, items };
}

function textOf(l: ShoppingList, options = {}): string {
  const result = shoppingListToText(l, options);
  if (!result.ok) throw new Error(`Text erwartet, bekam ${result.reason}`);
  return result.text;
}

function ingredient(
  foodId: string,
  amount: number,
  unit: ScaledIngredient['unit'],
  extra: Partial<ScaledIngredient> = {},
): ScaledIngredient {
  const food = N3_FOODS.get(foodId);
  const perUnit = unit === 'piece' ? (food?.units.piece_g ?? 1) : 1;
  return {
    index: 0,
    foodId,
    originalFoodId: null,
    amount,
    unit,
    optional: false,
    grams: amount * perUnit,
    ...extra,
  };
}

function meal(ingredients: ScaledIngredient[]): PlannedMeal {
  return {
    slot: 'lunch',
    role: null,
    recipeId: 'test',
    recipeVersion: 1,
    titleDe: 'Test',
    recipeStatus: 'draft',
    factor: 1,
    ingredients,
    nutrients: zeroNutrients(),
    optionalKcal: 0,
    substitutions: [],
    omittedOptional: [],
    prepKind: 'fresh',
    cookDate: WEEK,
    storage: null,
    isFill: false,
    fixed: false,
    mealPrepPlanId: null,
  };
}

function week(meals: PlannedMeal[], usesHealthData: boolean): MealPlanWeek {
  return {
    weekStart: WEEK,
    variant: 0,
    engineVersion: 1,
    usesHealthData,
    mealPrepPlanId: null,
    notices: [],
    days: [
      {
        date: WEEK,
        mode: 'full',
        status: 'complete',
        meals,
        totals: zeroNutrients(),
        band: null,
        safetyKey: '',
        emptySlots: [],
        notices: [],
      },
    ],
  };
}

describe('shoppingListToText – Aufbau', () => {
  it('Titel mit Zeitraum, Abteilungen in fester Reihenfolge, Vorrat am Ende, Mengen in g/ml/Stück', () => {
    const text = textOf(
      list([
        item('Reis', { amount: 200, category: 'pasta_rice_grains', isPantry: true }),
        item('Bananen', { amount: 3, unit: 'piece', category: 'fruit_vegetables' }),
        item('Salz', { amount: null, unit: null, category: 'spices_baking', isPantry: true }),
        item('Hafermilch', { amount: 1250, unit: 'ml', category: 'chilled_plant_based' }),
        item('Brokkoli', { amount: 500, category: 'fruit_vegetables' }),
        item('Spülmittel', { amount: null, unit: null, isManual: true, category: 'other' }),
      ]),
    );
    expect(text).toBe(
      [
        'Einkaufsliste 12.10.2026 – 18.10.2026',
        '',
        'Obst & Gemüse',
        '- 3 Stück Bananen',
        '- 500 g Brokkoli',
        '',
        'Kühlregal: vegetarisch/vegan',
        '- 1.250 ml Hafermilch',
        '',
        'Sonstiges',
        '- Spülmittel',
        '',
        'Vorrat (hast du wahrscheinlich da)',
        '- 200 g Reis',
        '- Salz – nach Geschmack',
      ].join('\n'),
    );
  });

  it('jede Abteilung erscheint höchstens einmal und in der Reihenfolge aus 5.5', () => {
    const items = [...SHOPPING_CATEGORIES]
      .reverse()
      .map((category, i) => item(`Ding ${i}`, { category }));
    const text = textOf(list(items));
    const headings = text.split('\n\n').map((block) => block.split('\n')[0]);
    expect(headings.slice(1)).toHaveLength(SHOPPING_CATEGORIES.length);
    const positions = SHOPPING_CATEGORIES.map((c) => headings.indexOf(labelOf(c)));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('leere Liste → empty; nichts übrig nach der Auswahl → nothing_selected', () => {
    expect(shoppingListToText(list([]))).toEqual({ ok: false, reason: 'empty' });
    const allChecked = list([item('Reis', { checked: true }), item('Nudeln', { checked: true })]);
    expect(shoppingListToText(allChecked)).toEqual({ ok: false, reason: 'nothing_selected' });
    expect(shoppingListToText(allChecked, { includeChecked: true }).ok).toBe(true);
    const onlyPantry = list([item('Salz', { isPantry: true })]);
    expect(shoppingListToText(onlyPantry, { includePantry: false })).toEqual({
      ok: false,
      reason: 'nothing_selected',
    });
    const onlyManual = list([item('Kaffee', { isManual: true, amount: null, unit: null })]);
    expect(shoppingListToText(onlyManual, { includeManual: false })).toEqual({
      ok: false,
      reason: 'nothing_selected',
    });
    // Nur Einträge, die nach der Bereinigung leer sind.
    const blank = list([item('\u202e\u200b\n', { isManual: true, amount: null, unit: null })]);
    expect(shoppingListToText(blank)).toEqual({ ok: false, reason: 'nothing_selected' });
  });

  it('Häkchen optional: Standard nur Offenes; mit Erledigten „(erledigt)“; „nicht mehr im Plan“ nie', () => {
    const l = list([
      item('Reis', { checked: true }),
      item('Nudeln'),
      item('Linsen', { checked: true, notInPlan: true }),
    ]);
    expect(textOf(l)).not.toContain('Reis');
    expect(textOf(l)).toContain('- 100 g Nudeln');
    const withChecked = textOf(l, { includeChecked: true });
    expect(withChecked).toContain('- 100 g Reis (erledigt)');
    expect(withChecked).toMatch(/^- 100 g Nudeln$/m);
    expect(withChecked).not.toContain('Linsen');
  });

  it('Vorrat und eigene Einträge lassen sich abwählen', () => {
    const l = list([
      item('Reis', { isPantry: true }),
      item('Kaffee', { isManual: true, amount: null, unit: null }),
      item('Tofu', { category: 'chilled_plant_based' }),
    ]);
    const text = textOf(l, { includePantry: false, includeManual: false });
    expect(text).toContain('Tofu');
    expect(text).not.toContain('Vorrat');
    expect(text).not.toContain('Reis');
    expect(text).not.toContain('Kaffee');
  });

  it('Optionen sind strikt (Zod an der Grenze); ungültig → {ok:false} statt Wurf (Wächter N12 H5)', () => {
    expect(shoppingListToText(list([item('Reis')]), { kcal: true } as never)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(shoppingListShareOptionsSchema.parse({})).toEqual({
      includeChecked: false,
      includePantry: true,
      includeManual: true,
    });
    expect(shoppingListToText({ from: '12.10.2026', to: WEEK, items: [] } as never)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    // Zeitraum endet vor dem Beginn.
    expect(shoppingListToText({ ...list([item('Reis')]), from: '2026-10-20' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(shoppingListToText({ ...list([item('Reis')]), to: WEEK }).ok).toBe(true);
    // Kaputter Eintrag (z. B. manipulierter Gerätespeicher) → invalid, kein Wurf.
    expect(shoppingListToText(list([item('Reis', { category: 'gibtsnicht' as never })]))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('deterministisch: gleiche Eingabe → gleicher Text', () => {
    const l = list([item('Reis'), item('Möhren', { category: 'fruit_vegetables' })]);
    expect(textOf(l)).toBe(textOf(structuredClone(l)));
  });
});

function labelOf(category: ShoppingCategory): string {
  return textOf(list([item('x', { category })])).split('\n')[2] as string;
}

describe('Mengen-Rundung', () => {
  it('rundet wie die Liste auf Kaufschritte (idempotent), Tausenderpunkt, ganze Stück', () => {
    expect(shareAmountText(123.4, 'g')).toBe('150 g');
    expect(shareAmountText(150, 'g')).toBe('150 g');
    expect(shareAmountText(1, 'ml')).toBe('10 ml');
    expect(shareAmountText(99.01, 'g')).toBe('100 g');
    expect(shareAmountText(0.2, 'piece')).toBe('1 Stück');
    expect(shareAmountText(2 + 1e-12, 'piece')).toBe('2 Stück');
    expect(shareAmountText(2.4, 'piece')).toBe('3 Stück');
    expect(shareAmountText(12_345, 'g')).toBe('12.350 g');
    expect(shareAmountText(1_000_000, 'ml')).toBe('1.000.000 ml');
  });

  it('sehr große Mengen: bis 1.000.000 mit Tausenderpunkt, darüber ohne Menge – nie Exponentialschreibweise', () => {
    expect(shareAmountText(SHOPPING_LIST_SHARE.maxAmount, 'g')).toBe('1.000.000 g');
    for (const amount of [1_000_001, 1e21, Number.MAX_VALUE]) {
      expect(shareAmountText(amount, 'g')).toBeNull();
    }
    const text = textOf(list([item('Reis', { amount: 1e21 })]));
    expect(text).toContain('- Reis – nach Geschmack');
    expect(text).not.toMatch(/e\+|Infinity/);
  });

  it('ungültige Mengen (0, negativ, NaN, ∞, ohne Einheit) → ohne Menge, nie „0 g“', () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(shareAmountText(amount, 'g')).toBeNull();
    }
    expect(shareAmountText(100, null)).toBeNull();
    const text = textOf(
      list([item('Zimt', { amount: 0 }), item('Notiz', { amount: -1, isManual: true })]),
    );
    expect(text).toContain('- Zimt – nach Geschmack');
    expect(text).toMatch(/^- Notiz$/m);
    expect(text).not.toMatch(/\b0 g|-1/);
  });
});

describe('Escaping, Sonderzeichen, Emojis, Umlaute', () => {
  it('Umlaute einheitlich (NFC) und unverändert lesbar', () => {
    const decomposed = 'Mo\u0308hren und Gru\u0308nkohl, Weißkohl, Äpfel';
    expect(sanitizeShareLabel(decomposed)).toBe('Möhren und Grünkohl, Weißkohl, Äpfel');
    expect(sanitizeShareLabel(decomposed)).toBe(sanitizeShareLabel(decomposed).normalize('NFC'));
    expect(textOf(list([item(decomposed, { category: 'fruit_vegetables' })]))).toContain(
      'Obst & Gemüse\n- 100 g Möhren und Grünkohl, Weißkohl, Äpfel',
    );
  });

  it('Emojis bleiben (auch Familien-Emoji mit ZWJ und Hautfarbe), einzelne Surrogate fliegen raus', () => {
    expect(sanitizeShareLabel('🍌 Bananen')).toBe('🍌 Bananen');
    expect(sanitizeShareLabel('👨\u200d👩\u200d👧 Familienpackung 👍🏽')).toBe(
      '👨\u200d👩\u200d👧 Familienpackung 👍🏽',
    );
    expect(sanitizeShareLabel('❤\ufe0f Kaffee')).toBe('❤\ufe0f Kaffee');
    expect(sanitizeShareLabel('Brot \ud83c und \udf4c')).toBe('Brot und');
  });

  it('Zeilenumbrüche/Steuerzeichen können keine Überschriften oder Einträge einschleusen', () => {
    const evil = 'Brot\r\n\nFleisch & Wurst\n- 1.000 g Speck\u2028\u0000\u0007\t';
    const text = textOf(list([item(evil, { isManual: true, amount: null, unit: null })]));
    expect(text.split('\n')).toEqual([
      'Einkaufsliste 12.10.2026 – 18.10.2026',
      '',
      'Sonstiges',
      '- Brot Fleisch & Wurst - 1.000 g Speck',
    ]);
  });

  it('Bidi-Steuerzeichen und unsichtbare Zeichen werden entfernt, Satzzeichen/Markdown bleiben Text', () => {
    expect(sanitizeShareLabel('Milch\u202e1 kg\u202c')).toBe('Milch1 kg');
    expect(sanitizeShareLabel('\ufeffZu\u200bcker\u2066\u2069')).toBe('Zucker');
    expect(sanitizeShareLabel('*Bio* _Eier_ <b>&amp;</b> "Käse" \\n')).toBe(
      '*Bio* _Eier_ <b>&amp;</b> "Käse" \\n',
    );
  });

  it('S1: JEDES Formatzeichen (Unicode-Kategorie Cf) wird entfernt – vollständig über alle Codepunkte', () => {
    const cf = /\p{Cf}/u;
    let checked = 0;
    for (let code = 0; code <= 0x10ffff; code += 1) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      const char = String.fromCodePoint(code);
      if (!cf.test(char)) continue;
      checked += 1;
      expect(sanitizeShareLabel(`Mi${char}lch`), code.toString(16)).toBe('Milch');
    }
    expect(checked).toBeGreaterThan(150);
  }, 30_000);

  it('S1: jede Klasse unsichtbarer Zeichen einzeln (Tag-Zeichen, Trennzeichen, Füller, Rechenzeichen, Anmerkungen)', () => {
    const classes: Record<string, string> = {
      'Tag-Zeichen U+E0000–E007F („ASCII-Smuggling“)':
        '\u{e0001}\u{e0041}\u{e0042}\u{e0063}\u{e007f}',
      'weiches Trennzeichen U+00AD': '\u00ad',
      'Combining Grapheme Joiner U+034F': '\u034f',
      'Hangul-Füller U+115F/U+1160': '\u115f\u1160',
      'Hangul-Füller U+3164 und U+FFA0': '\u3164\uffa0',
      'Mongolisch U+180E (und Variantenwähler U+180B–180F)': '\u180e\u180b\u180f',
      'unsichtbare Rechenzeichen U+2061–2064': '\u2061\u2062\u2063\u2064',
      'veraltete Formatzeichen U+206A–206F': '\u206a\u206b\u206c\u206d\u206e\u206f',
      'Interlinear-Anmerkung U+FFF9–FFFB': '\ufff9\ufffa\ufffb',
      'Variantenwähler ohne Emoji U+FE00–FE0F': '\ufe00\ufe0e\ufe0f',
      'Variantenwähler-Ergänzung U+E0100–E01EF': '\u{e0100}\u{e01ef}',
      'Zero-Width und Bidi': '\u200b\u200c\u200d\u200e\u200f\u202e\u2066\ufeff',
      'Khmer U+17B4/17B5': '\u17b4\u17b5',
    };
    for (const [name, chars] of Object.entries(classes)) {
      expect(sanitizeShareLabel(`Mi${chars}lch`), name).toBe('Milch');
      expect(sanitizeShareLabel(`Milch${chars}`), name).toBe('Milch');
    }
    // Ein einzelner Hangul-Füller wirkt wie ein Leerzeichen – der Eintrag ist danach leer.
    expect(sanitizeShareLabel('\u3164')).toBe('');
  });

  it('S1: ZWJ und Variantenwähler nur innerhalb von Emoji-Sequenzen', () => {
    // Behalten: Familie, Regenbogenflagge, Herz mit VS16, Tastenkappe, Hautfarbe + ZWJ.
    for (const keep of [
      '👨\u200d👩\u200d👧',
      '🏳\ufe0f\u200d🌈',
      '❤\ufe0f',
      '1\ufe0f\u20e3',
      '👩🏽\u200d🍳',
    ]) {
      expect(sanitizeShareLabel(`x ${keep}`)).toBe(`x ${keep}`);
    }
    // Entfernt: ZWJ zwischen Buchstaben, ZWJ am Ende eines Emojis ohne Folge-Emoji, VS nach Buchstaben.
    expect(sanitizeShareLabel('Mi\u200dlch')).toBe('Milch');
    expect(sanitizeShareLabel('🍌\u200d Banane')).toBe('🍌 Banane');
    expect(sanitizeShareLabel('a\u200d🍌')).toBe('a🍌');
    expect(sanitizeShareLabel('Mi\ufe0flch')).toBe('Milch');
    expect(sanitizeShareLabel('\ufe0f\u200d🍌')).toBe('🍌');
  });

  it('Links in eigenen Einträgen ohne Anhang (keine Tracking-/Partner-Parameter)', () => {
    expect(
      sanitizeShareLabel('Kaffee https://shop.example/kaffee?utm_source=app&tag=partner-21 bitte'),
    ).toBe('Kaffee https://shop.example/kaffee bitte');
    expect(sanitizeShareLabel('www.example.org/x#ref=abc')).toBe('www.example.org/x');
    expect(sanitizeShareLabel('HTTP://A.EXAMPLE/?fbclid=1')).toBe('HTTP://A.EXAMPLE/');
    expect(sanitizeShareLabel('Frage? Ja# kein Link')).toBe('Frage? Ja# kein Link');
    // Auch ohne Wortgrenze davor (Wächter N12 H2).
    expect(sanitizeShareLabel('Milchhttps://x.example/?utm=1')).toBe('Milchhttps://x.example/');
    expect(sanitizeShareLabel('Milchwww.x.example/a#b')).toBe('Milchwww.x.example/a');
  });

  it('javascript:/vbscript:-Links werden ersetzt, auch versteckt hinter unsichtbaren Zeichen', () => {
    expect(sanitizeShareLabel('Klick javascript:alert(1) hier')).toBe('Klick [Link entfernt] hier');
    expect(sanitizeShareLabel('JavaScript:void(0)')).toBe('[Link entfernt]');
    expect(sanitizeShareLabel('x vbscript:msgbox')).toBe('x [Link entfernt]');
    expect(sanitizeShareLabel('java\u200bscript:alert(1)')).toBe('[Link entfernt]');
    expect(sanitizeShareLabel('Milchjavascript:alert(1)')).toBe('Milch[Link entfernt]');
    // Keine weitergehende Link-Erkennung (bewusst): Kurzlinks ohne Anhang bleiben.
    expect(sanitizeShareLabel('https://amzn.example/3xYz')).toBe('https://amzn.example/3xYz');
  });

  it('überlange Einträge: Kürzung nach Graphem-Clustern – keine halben Familien-Emojis oder Flaggen (H1)', () => {
    const family = '👨\u200d👩\u200d👧';
    const cut = sanitizeShareLabel(`${'a'.repeat(98)}${family}${family}${family}`);
    expect(cut).toBe(`${'a'.repeat(98)}${family}…`);
    const flags = sanitizeShareLabel(`${'a'.repeat(98)}🇩🇪🇦🇹🇨🇭`);
    expect(flags).toBe(`${'a'.repeat(98)}🇩🇪…`);
    expect(sanitizeShareLabel(`${'a'.repeat(99)}🇩🇪`)).toBe(`${'a'.repeat(99)}🇩🇪`);
  });

  it('überlange Einträge werden mit „…“ gekürzt', () => {
    const long = '🥕'.repeat(150);
    const cleaned = sanitizeShareLabel(long);
    expect([...cleaned]).toHaveLength(SHOPPING_LIST_SHARE.labelMaxChars);
    expect(cleaned.endsWith('…')).toBe(true);
    expect(cleaned).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(sanitizeShareLabel('a'.repeat(100))).toBe('a'.repeat(100));
  });
});

describe('sehr lange Liste', () => {
  it('300 realistische Einträge: vollständig, keine Kürzung', () => {
    const items = Array.from({ length: 300 }, (_, i) =>
      item(`Lebensmittel Nummer ${i}`, {
        category: SHOPPING_CATEGORIES[i % SHOPPING_CATEGORIES.length] as ShoppingCategory,
        isPantry: i % 7 === 0,
      }),
    );
    const result = shoppingListToText(list(items));
    expect(result).toMatchObject({ ok: true, itemCount: 300, omittedForLength: 0 });
  });

  it('über der Höchstlänge: ganze Zeilen, sichtbar „… und N weitere Einträge“, nie länger als maxChars', () => {
    const items = Array.from({ length: 1100 }, (_, i) =>
      item(`${String(i).padStart(4, '0')} ${'x'.repeat(95)}`, {
        isManual: true,
        amount: null,
        unit: null,
      }),
    );
    const result = shoppingListToText(list(items));
    if (!result.ok) throw new Error('Text erwartet');
    expect(result.text.length).toBeLessThanOrEqual(SHOPPING_LIST_SHARE.maxChars);
    expect(result.omittedForLength).toBeGreaterThan(0);
    expect(result.itemCount + result.omittedForLength).toBe(1100);
    const lines = result.text.split('\n');
    expect(lines.at(-1)).toBe(
      `… und ${result.omittedForLength} weitere Einträge (Liste zu lang – nutze das PDF)`,
    );
    expect(lines.filter((l) => l.startsWith('- '))).toHaveLength(result.itemCount);
    // Keine halbe Zeile: jede Eintragszeile ist vollständig.
    for (const line of lines.filter((l) => l.startsWith('- '))) {
      expect(line).toMatch(/^- \d{4} x{95}$/);
    }
  });
});

describe('keine Gesundheitsdaten im Text (19.8 Nr. 8, KONZEPT 6.13)', () => {
  const base = list([
    item('Laktosefreie Milch', {
      unit: 'ml',
      amount: 500,
      category: 'chilled_dairy_eggs',
      substituteFor: ['vollmilch'],
    }),
    item('Reis', { isPantry: true }),
    item('Brokkoli', { category: 'fruit_vegetables', amountChanged: true }),
  ]);

  it('Text ist unabhängig von Gesundheitsbezug, Ersatz-Hinweisen, IDs und Markierungen', () => {
    const variant: ShoppingList = {
      ...base,
      usesHealthData: true,
      items: base.items.map((i) => ({
        ...i,
        foodId: `geheim-${i.foodId ?? ''}`,
        itemKey: `geheim|${i.itemKey}`,
        substituteFor: ['erdnuesse', 'schwangerschaft'],
        amountChanged: !i.amountChanged,
      })),
    };
    expect(textOf(variant)).toBe(textOf(base));
    for (const options of [{ includeChecked: true }, { includePantry: false }]) {
      expect(textOf(variant, options)).toBe(textOf(base, options));
    }
  });

  it('kein „statt“, kein Original, keine kcal/Gründe/Gewicht, keine Links', () => {
    const text = textOf(base);
    expect(text).toContain('500 ml Laktosefreie Milch');
    for (const word of [
      /statt/i,
      /vollmilch/i,
      /kcal|kalorie/i,
      /unverträglich|allergie|intoleran/i,
      /schwanger|stillzeit/i,
      /körpergewicht|\bkg\b/i,
      /ziel|abnehmen/i,
      /https?:|www\./i,
      /geheim/,
    ]) {
      expect(text).not.toMatch(word);
    }
  });

  it('echte Liste aus dem Plan: Ersatzprodukt bzw. Austausch nur mit eigenem Namen', () => {
    const shopping = buildShoppingList(
      week(
        [
          meal([
            ingredient('haferdrink', 250, 'ml', { originalFoodId: 'vollmilch' }),
            ingredient('huehnerei', 2, 'piece', { originalFoodId: 'tofu', swapped: true }),
            ingredient('reis', 75, 'g'),
            ingredient('salz', 1, 'pinch'),
          ]),
        ],
        true,
      ),
      N3_FOODS,
    );
    const text = textOf(shopping);
    const names = (id: string) => N3_FOODS.get(id)?.name_de ?? id;
    expect(text).toContain(names('haferdrink'));
    expect(text).not.toContain(names('vollmilch'));
    expect(text).not.toContain(names('tofu'));
    expect(text).toContain('nach Geschmack');
    expect(text).not.toMatch(/statt|kcal/i);
  });
});

describe('Hinweis vor dem Weitergeben (wie K4, Vormerkung N9 S5)', () => {
  it('Gesundheitsbezug → Hinweis; Ersatzprodukte und ausgetauschte Zutaten werden genannt', () => {
    const shopping = buildShoppingList(
      week(
        [
          meal([
            ingredient('haferdrink', 250, 'ml', { originalFoodId: 'vollmilch' }),
            ingredient('huehnerei', 2, 'piece', { originalFoodId: 'tofu', swapped: true }),
            ingredient('reis', 75, 'g'),
          ]),
        ],
        true,
      ),
      N3_FOODS,
    );
    const notice = shoppingListShareNotice(shopping);
    expect(notice.required).toBe(true);
    expect(notice.usesHealthData).toBe(true);
    const expected = shopping.items.filter((i) => i.substituteFor.length > 0).map((i) => i.labelDe);
    expect(expected).toHaveLength(2);
    expect(notice.substituteLabels).toEqual(expected);
    expect(notice.substituteLabels).not.toContain(N3_FOODS.get('reis')?.name_de);
  });

  it('ohne Gesundheitsbezug und ohne Ersatz → kein Hinweis; Ersatz allein reicht für den Hinweis', () => {
    expect(shoppingListShareNotice(list([item('Reis')]))).toEqual({
      required: false,
      usesHealthData: false,
      substituteLabels: [],
    });
    const withSubstitute = list([item('Haferdrink', { substituteFor: ['vollmilch'] })]);
    expect(shoppingListShareNotice(withSubstitute)).toMatchObject({
      required: true,
      usesHealthData: false,
      substituteLabels: ['Haferdrink'],
    });
  });

  it('nennt nur Ersatz-Einträge, die mit dieser Auswahl wirklich im Text stehen', () => {
    const l = list([
      item('Haferdrink', { substituteFor: ['vollmilch'], checked: true }),
      item('Glutenfreie Nudeln', { substituteFor: ['spaghetti'], isPantry: true }),
    ]);
    expect(shoppingListShareNotice(l).substituteLabels).toEqual(['Glutenfreie Nudeln']);
    expect(shoppingListShareNotice(l, { includePantry: false })).toMatchObject({
      required: false,
      substituteLabels: [],
    });
    expect(shoppingListShareNotice(l, { includeChecked: true }).substituteLabels).toEqual([
      'Haferdrink',
      'Glutenfreie Nudeln',
    ]);
    // Gesundheitsbezug der Liste gilt unabhängig von der Auswahl.
    expect(
      shoppingListShareNotice({ ...l, usesHealthData: true }, { includePantry: false }),
    ).toMatchObject({
      required: true,
    });
  });

  it('Abhaken ändert den Hinweis entsprechend (Liste aus dem Plan)', () => {
    const shopping = buildShoppingList(
      week([meal([ingredient('haferdrink', 250, 'ml', { originalFoodId: 'vollmilch' })])], false),
      N3_FOODS,
    );
    expect(shoppingListShareNotice(shopping).required).toBe(true);
    const ticked = setShoppingItemChecked(shopping, 'haferdrink|ml', true);
    expect(shoppingListShareNotice(ticked).required).toBe(false);
  });
});

describe('Hinweis: sichere Richtung und Bestätigungs-Schlüssel (Wächter N12 H4, S3)', () => {
  it('H4: auch Ersatz-Einträge, die wegen der Länge gekürzt würden, werden genannt', () => {
    const filler = Array.from({ length: 1100 }, (_, i) =>
      item(`${String(i).padStart(4, '0')} ${'x'.repeat(95)}`, { category: 'fruit_vegetables' }),
    );
    const last = item('Zz Haferdrink', { substituteFor: ['vollmilch'], isPantry: true });
    const l = list([...filler, last]);
    const result = shoppingListToText(l);
    if (!result.ok) throw new Error('Text erwartet');
    expect(result.omittedForLength).toBeGreaterThan(0);
    expect(result.text).not.toContain('Haferdrink');
    expect(shoppingListShareNotice(l).substituteLabels).toEqual(['Zz Haferdrink']);
  });

  it('ungültige Auswahl oder kaputte Einträge → kein Wurf, eher ein Hinweis zu viel', () => {
    const l = list([item('Haferdrink', { substituteFor: ['vollmilch'], checked: true })]);
    expect(shoppingListShareNotice(l).required).toBe(false);
    expect(shoppingListShareNotice(l, { kcal: true } as never)).toMatchObject({
      required: true,
      substituteLabels: ['Haferdrink'],
    });
    const broken = list([
      item('Hafer', { substituteFor: ['x'], checked: true, category: 'kaputt' as never }),
    ]);
    expect(shoppingListShareNotice(broken).substituteLabels).toEqual(['Hafer']);
  });

  it('S3: Schlüssel ändert sich mit Woche/Zeitraum und Listenstand, sonst nicht', () => {
    const base = list([item('Reis'), item('Haferdrink', { substituteFor: ['vollmilch'] })], true);
    const key = shoppingListShareNoticeKey(base);
    expect(shoppingListShareNoticeKey(structuredClone(base))).toBe(key);
    // Gleicher Gesundheitsbezug, gleiche Ersatz-Namen – aber andere Woche (Mitternacht Sonntag → Montag).
    const nextWeek = { ...base, from: addDays(WEEK, 7), to: addDays(WEEK, 13) };
    expect(shoppingListShareNoticeKey(nextWeek)).not.toBe(key);
    // Anderer Zeitraum in derselben Woche.
    expect(shoppingListShareNoticeKey({ ...base, to: addDays(WEEK, 3) })).not.toBe(key);
    // Andere Menge.
    const more = { ...base, items: base.items.map((i) => ({ ...i, amount: 500 })) };
    expect(shoppingListShareNoticeKey(more)).not.toBe(key);
    // Andere Auswahl, die den Text ändert.
    expect(shoppingListShareNoticeKey(base, { includeChecked: true })).toBe(key);
    expect(
      shoppingListShareNoticeKey(
        { ...base, items: [...base.items, item('Tee', { checked: true })] },
        {
          includeChecked: true,
        },
      ),
    ).not.toBe(key);
  });
});

describe('Eigenschaftstest: Aufbau über zufällige Listen', () => {
  it('jede ausgewählte Zeile genau einmal, eine Zeile je Eintrag, ≤ maxChars, nie kcal/„statt“, deterministisch', () => {
    const random = seededRandom(1212);
    const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)] as T;
    const nasty = ['', '\n', '\u202e', '🍅', 'ü', 'u\u0308', '*', '?utm_source=x', ' ', 'ß'];
    for (let run = 0; run < 200; run += 1) {
      const count = Math.floor(random() * 60);
      const items = Array.from({ length: count }, (_, i) => {
        const isManual = random() < 0.2;
        const unit = isManual ? null : pick(['g', 'ml', 'piece', null] as const);
        return item(`E${i}${pick(nasty)}x${pick(nasty)}`, {
          itemKey: `k${i}`,
          amount: unit === null ? null : random() * 2500,
          unit,
          category: pick(SHOPPING_CATEGORIES),
          isPantry: random() < 0.2,
          isManual,
          checked: random() < 0.3,
          notInPlan: random() < 0.05,
          substituteFor: random() < 0.2 ? ['vollmilch'] : [],
        });
      });
      const options = {
        includeChecked: random() < 0.5,
        includePantry: random() < 0.5,
        includeManual: random() < 0.5,
      };
      const l = list(items, random() < 0.5);
      const result = shoppingListToText(l, options);
      const expected = items.filter(
        (i) =>
          !i.notInPlan &&
          (options.includeChecked || !i.checked) &&
          (options.includePantry || !i.isPantry) &&
          (options.includeManual || !i.isManual),
      );
      if (count === 0) {
        expect(result).toEqual({ ok: false, reason: 'empty' });
        continue;
      }
      if (expected.length === 0) {
        expect(result).toEqual({ ok: false, reason: 'nothing_selected' });
        continue;
      }
      if (!result.ok) throw new Error('Text erwartet');
      expect(result.itemCount).toBe(expected.length);
      expect(result.omittedForLength).toBe(0);
      expect(result.text.length).toBeLessThanOrEqual(SHOPPING_LIST_SHARE.maxChars);
      const lines = result.text.split('\n').filter((line) => line.startsWith('- '));
      expect(lines).toHaveLength(expected.length);
      for (const i of expected) {
        const prefix = `E${i.itemKey.slice(1)}`;
        expect(lines.filter((line) => line.includes(` ${prefix}`)).length).toBeGreaterThanOrEqual(
          1,
        );
      }
      expect(result.text).not.toMatch(/kcal|statt|\u202e/);
      expect(result.text).toBe(result.text.normalize('NFC'));
      expect(shoppingListToText(structuredClone(l), options)).toEqual(result);
    }
  }, 30_000);
});

describe('Händler-Modul (K5): Schnittstelle hinter Feature-Flag, ohne Händler', () => {
  const provider: RetailProvider = {
    id: 'beispiel',
    nameDe: 'Beispiel',
    access: 'partner_program',
    adLabelDe: 'Anzeige',
    handoff: () => ({ kind: 'open_url', url: 'https://example.org', adLabelDe: 'Anzeige' }),
  };

  it('Flag ist aus und es gibt keinen Händler (Einschalten nur bewusst mit allen K5-Bedingungen)', () => {
    expect(FEATURE_FLAGS.retail_integration).toBe(false);
    expect(RETAIL_PROVIDERS).toEqual([]);
    expect(RETAIL_INTEGRATION_CONDITIONS).toEqual([
      'transfer_consent',
      'dpia_updated',
      'data_minimization',
      'official_interface',
      'ad_label',
    ]);
  });

  it('Flag aus = kein Knopf; erst Flag + Händler + alle K5-Bedingungen als ausdrückliche Eingaben', () => {
    const all = {
      flags: { retail_integration: true },
      providers: [provider],
      transferConsent: true,
      dpiaUpdated: true,
      officialInterface: true,
    };
    expect(retailIntegrationAvailable(all)).toBe(true);
    // Standard-Flag (aus) und Standard-Händler (keine) → nie.
    expect(
      retailIntegrationAvailable({
        transferConsent: true,
        dpiaUpdated: true,
        officialInterface: true,
      }),
    ).toBe(false);
    for (const missing of [
      { flags: { retail_integration: false } },
      { providers: [] },
      { transferConsent: false },
      { dpiaUpdated: false },
      { officialInterface: false },
    ]) {
      expect(retailIntegrationAvailable({ ...all, ...missing }), JSON.stringify(missing)).toBe(
        false,
      );
    }
  });

  it('Datenminimierung: nur offene Plan-Einträge mit Produktart und Menge, ohne Ersatz-Einträge – nichts sonst', () => {
    const items = [
      item('Haferdrink', { unit: 'ml', amount: 250, substituteFor: ['vollmilch'] }),
      item('Reis', { isPantry: true }),
      item('Kaffee', { isManual: true, amount: null, unit: null }),
      item('Nudeln', { checked: true }),
      item('Linsen', { notInPlan: true, checked: true }),
      item('Brokkoli', { amount: 432 }),
      item('Salz', { amount: null, unit: null }),
    ];
    const lines = retailOrderLines(list(items, false));
    expect(lines).toEqual([
      { product: 'Brokkoli', amount: 450, unit: 'g', amountText: '450 g' },
      { product: 'Salz', amount: null, unit: null, amountText: null },
    ]);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(['amount', 'amountText', 'product', 'unit']);
    }
  });

  it('Liste aus einem Plan mit Gesundheitsbezug → keine Zeilen (sichere Voreinstellung bis G7)', () => {
    expect(retailOrderLines(list([item('Brokkoli'), item('Reis')], true))).toEqual([]);
  });
});
