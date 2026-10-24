import type { FoodGroupId } from '../food-groups';
import { foodContainsPork } from '../nutrition/recipe-nutrients';
import type { AllergenExtraRule, Food, SourceFoodCategory } from './food-schema';

/**
 * Allergen-Pflichtregeln als Code (Regel R18, docs/PLAN-PHASE-5.md 5.1.1 c und 5.1.3; Wächter R2-B3, R2-S1,
 * R2-S2, N0-Hinweise). Die Regeln sagen, welche Gruppen bzw. Merkmale ein Lebensmittel MINDESTENS haben muss.
 * Zusätzliche Gruppen sind immer erlaubt (sichere Richtung). Aufheben lässt sich eine Pflichtregel nur über die
 * eingecheckte Ausnahmeliste mit Begründung und Quelle (`allergenExceptionSchema`).
 *
 * Erkennung (Plan 5.1.3):
 * - Geprüft werden `name_de`, `name_de_plural`, `aliases_de[]` und die Bezeichnung der Quelle (`source.name`),
 *   kleingeschrieben, Umlaute normalisiert (ä → ae, ö → oe, ü → ue, ß → ss, Akzente entfernt).
 * - Ein Pflichtwort trifft nur als GANZER WORTTEIL: eigenes Wort, Anfang oder Ende eines zusammengesetzten Worts
 *   oder eines Teils mit Bindestrich – nie als freie Teilzeichenkette in der Wortmitte.
 *   Schreibweise in den Listen: `wort` = eigenes Wort, Wortanfang oder Wortende; `=wort` = nur als eigenes Wort
 *   (z. B. `=ei`, damit „Weizen“, „Reis“, „Fleisch“, „Eisbergsalat“, „Brei“ nicht treffen); `zwei worte` =
 *   Wortfolge (z. B. „creme fraiche“).
 * - Negativliste je Regel: Ein Treffer fällt weg, wenn er vollständig in einem Negativ-Wort liegt (z. B. „milch“
 *   in „kokosmilch“, „kaese“ in „leberkaese“, „eier“ in „eierschwammerl“, „fisch“ in „tintenfisch“).
 * - Zusätzlich die Lebensmittelgruppe der Quelle (`source.category`, `SOURCE_CATEGORY_RULES`).
 */

// ---------------------------------------------------------------------------------------------------------
// Normalisierung und Wortteil-Erkennung
// ---------------------------------------------------------------------------------------------------------

/**
 * Kleinschreibung, Umlaute als ae/oe/ue, ß als ss, Akzente entfernt, alles außer a–z, 0–9 und „-“ als Leerzeichen.
 * Zuerst Unicode-Normalform NFC (Wächter N2a, B2): Zerlegte Umlaute („a“ + U+0308, z. B. aus macOS-Kopien oder
 * CSV-Exporten) werden so zu „ä“ zusammengesetzt und danach zu „ae“ – sonst würde aus „Käse“ still „kase“.
 */
export function normalizeFoodText(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Segment {
  readonly text: string;
  readonly offset: number;
}

interface Word {
  /** Zusammengesetztes Wort ohne Bindestriche, z. B. „kokos-milch“ → „kokosmilch“. */
  readonly compound: string;
  /** Das ganze Wort und – bei Bindestrichen – jeder Teil mit seiner Position im zusammengesetzten Wort. */
  readonly segments: readonly Segment[];
}

function splitWords(normalized: string): Word[] {
  return normalized
    .split(' ')
    .filter((raw) => raw.replace(/-/g, '').length > 0)
    .map((raw) => {
      const parts = raw.split('-').filter((part) => part.length > 0);
      const compound = parts.join('');
      const segments: Segment[] = [{ text: compound, offset: 0 }];
      if (parts.length > 1) {
        let offset = 0;
        for (const part of parts) {
          segments.push({ text: part, offset });
          offset += part.length;
        }
      }
      return { compound, segments };
    });
}

/**
 * Tierart + Hackfleisch als getrennte Wörter (BLS-Schreibweise „Schwein Hackfleisch, roh“, „Rind Hackfleisch,
 * roh“) wird zum zusammengesetzten Wort wie im Alltag („schweinehackfleisch“, „rinderhackfleisch“), damit die
 * Tierart-Ausnahmen der Hackfleisch-Regeln greifen (N2b-Zuordnung; analog zum Fix „Schweinehackfleisch“).
 * Nur direkt aufeinanderfolgende Wörter; „Hackfleisch gemischt“ ohne Tierart bleibt Rind + Schwein, und
 * „Schwein Hackfleisch gemischt“ wird zu „schweinehackfleisch gemischt“ (ebenfalls Rind + Schwein).
 */
const SPECIES_MINCE_PREFIX: Readonly<Record<string, string>> = {
  schwein: 'schweine',
  rind: 'rinder',
  kalb: 'kalbs',
  pute: 'puten',
  truthahn: 'truthahn',
  lamm: 'lamm',
  gefluegel: 'gefluegel',
  haehnchen: 'haehnchen',
  wild: 'wild',
  hirsch: 'hirsch',
};
const SPECIES_MINCE_PATTERN = new RegExp(
  `(^| )(${Object.keys(SPECIES_MINCE_PREFIX).join('|')}) (hackfleisch|hack)(?= |$)`,
  'g',
);

/** Siehe SPECIES_MINCE_PREFIX; erwartet bereits normalisierten Text (normalizeFoodText). */
export function joinSpeciesMince(normalized: string): string {
  return normalized.replace(
    SPECIES_MINCE_PATTERN,
    (_match, start: string, species: string, mince: string) =>
      `${start}${SPECIES_MINCE_PREFIX[species] ?? species}${mince}`,
  );
}

/** Ein Treffer: Muster, getroffenes Wort und der normalisierte Text, in dem es steht. */
export interface WordHit {
  readonly pattern: string;
  readonly word: string;
  readonly text: string;
}

/** Wortregel: Pflicht-Wortteile und Negativliste (Plan 5.1.3). */
export interface WordRule {
  readonly words: readonly string[];
  readonly negatives: readonly string[];
}

function spansOf(word: Word, pattern: string): [number, number][] {
  const exact = pattern.startsWith('=');
  const p = exact ? pattern.slice(1) : pattern;
  const spans: [number, number][] = [];
  for (const segment of word.segments) {
    const s = segment.text;
    if (s === p) {
      spans.push([segment.offset, segment.offset + p.length]);
      continue;
    }
    if (exact) {
      continue;
    }
    if (s.startsWith(p)) {
      spans.push([segment.offset, segment.offset + p.length]);
    }
    if (s.endsWith(p)) {
      spans.push([segment.offset + s.length - p.length, segment.offset + s.length]);
    }
  }
  return spans;
}

/**
 * Spannen der Negativ-Wörter im zusammengesetzten Wort: `wort` = überall als Teilzeichenkette, `=wort` = nur, wenn
 * das ganze Wort genau so lautet (z. B. `=huehnerei`, damit „Hühnereintopf“ Geflügel bleibt).
 */
function negativeSpans(word: Word, negatives: readonly string[]): [number, number][] {
  const spans: [number, number][] = [];
  for (const negative of negatives) {
    if (negative.startsWith('=')) {
      if (word.compound === negative.slice(1)) {
        spans.push([0, word.compound.length]);
      }
      continue;
    }
    let from = word.compound.indexOf(negative);
    while (from >= 0) {
      spans.push([from, from + negative.length]);
      from = word.compound.indexOf(negative, from + 1);
    }
  }
  return spans;
}

/**
 * Alle Treffer einer Wortregel in den (schon normalisierten oder rohen) Texten. Negativ-Wörter wirken nur auf die
 * Trefferspanne in ihrem Wort; Wortfolgen sind als Negativ NICHT erlaubt (Wächter N2a, S6: sie würden sonst den
 * ganzen Text stummschalten) – das Laden einer solchen Regel wirft einen Fehler.
 */
export function matchWordRule(texts: readonly string[], rule: WordRule): WordHit[] {
  const phraseNegative = rule.negatives.find((n) => n.includes(' '));
  if (phraseNegative !== undefined) {
    throw new Error(
      `Negativ-Wortfolge „${phraseNegative}“ ist nicht erlaubt (nur einzelne Wörter).`,
    );
  }
  const hits: WordHit[] = [];
  for (const raw of texts) {
    const text = joinSpeciesMince(normalizeFoodText(raw));
    if (text.length === 0) {
      continue;
    }
    // Wortfolgen: Bindestrich als Leerzeichen („Crème-fraîche“) und zusammengezogen.
    const spaced = ` ${text.replace(/-/g, ' ')} `;
    const joined = ` ${text.replace(/-/g, '')} `;
    const words = splitWords(text);
    for (const pattern of rule.words) {
      if (pattern.includes(' ')) {
        if (spaced.includes(` ${pattern} `) || joined.includes(` ${pattern} `)) {
          hits.push({ pattern, word: pattern, text });
        }
        continue;
      }
      for (const word of words) {
        const negatives = negativeSpans(word, rule.negatives);
        const valid = spansOf(word, pattern).some(
          ([start, end]) => !negatives.some(([ns, ne]) => ns <= start && end <= ne),
        );
        if (valid) {
          hits.push({ pattern, word: word.compound, text });
        }
      }
    }
  }
  return hits;
}

/**
 * Kernwörter MITTEN in einem zusammengesetzten Wort (z. B. „lachs“ in „Wildlachsfilet“, „milch“ in
 * „Vollmilchschokolade“). Die Wortteil-Regel trifft sie bewusst nicht (sonst „Ei“ in „Weizen“); sie werden als
 * gelber Hinweis zur menschlichen Prüfung gemeldet (Wächter N2a, S1). Negativ-Wörter der Gruppe gelten auch hier.
 */
export function findMidWordHits(texts: readonly string[], rule: WordRule): WordHit[] {
  const hits: WordHit[] = [];
  for (const raw of texts) {
    const text = normalizeFoodText(raw);
    for (const word of splitWords(text)) {
      const negatives = negativeSpans(word, rule.negatives);
      for (const pattern of rule.words) {
        if (pattern.startsWith('=') || pattern.includes(' ')) {
          continue;
        }
        let from = word.compound.indexOf(pattern, 1);
        while (from > 0 && from + pattern.length < word.compound.length) {
          const span: [number, number] = [from, from + pattern.length];
          if (!negatives.some(([ns, ne]) => ns <= span[0] && span[1] <= ne)) {
            hits.push({ pattern, word: word.compound, text });
            break;
          }
          from = word.compound.indexOf(pattern, from + 1);
        }
      }
    }
  }
  return hits;
}

/** Kombiniert Vorsilben mit Wortenden, z. B. ['kokos'] × ['milch'] → ['kokosmilch']. */
function combine(prefixes: readonly string[], endings: readonly string[]): string[] {
  return prefixes.flatMap((prefix) => endings.map((ending) => `${prefix}${ending}`));
}

// ---------------------------------------------------------------------------------------------------------
// Regeln je Gruppe (alle 23 Gruppen aus FOOD_GROUPS, der Compiler erzwingt Vollständigkeit)
// ---------------------------------------------------------------------------------------------------------

export type GroupRule =
  | {
      readonly kind: 'rule';
      readonly words: readonly string[];
      readonly negatives: readonly string[];
      /** Quell-Lebensmittelgruppen, bei denen die Gruppe Pflicht ist. */
      readonly sourceCategories: readonly SourceFoodCategory[];
      /** Wortteile, die die Pflicht aus der Quellgruppe aufheben (begründete Ausnahmen, z. B. Reis bei Getreide). */
      readonly sourceCategoryExempt?: readonly string[];
      /** Wortteile, die die Regel NUR in der Bezeichnung der Quelle aufheben (z. B. „laktosefrei“). */
      readonly sourceNameExempt?: readonly string[];
      /**
       * Wortfolgen, die NUR in der Bezeichnung der Quelle vor der Prüfung ersetzt werden ([von, nach], normalisiert),
       * z. B. „senf mittelscharf“ → „senf“. Entfernt nur diesen Treffer – Name, Aliase und übrige Wörter der Quelle
       * werden weiter geprüft (Wächter-Prüfung Zuordnung S1).
       */
      readonly sourceNameRewrites?: readonly (readonly [string, string])[];
      /** Zusätzlich immer menschliche Prüfung (R19-Checkliste), mit Begründung. */
      readonly humanReview?: string;
    }
  | {
      /** Ohne Wortregel, nur Prüfung durch Menschen (R19) – mit Begründung. */
      readonly kind: 'human_only';
      readonly reason: string;
    };

/** Pflanzliche Drinks und Alternativen: Vorsilben, die „Milch/Sahne/Drink/Joghurt …“ aufheben (R2-S1). */
const PLANT_PREFIXES = [
  'kokos',
  'kokosnuss',
  'soja',
  'hafer',
  'mandel',
  'reis',
  'cashew',
  'dinkel',
  'erbsen',
  'hanf',
  'haselnuss',
  'lupinen',
] as const;
const DAIRY_ENDINGS_PLANT = [
  'skyr',
  'milch',
  'sahne',
  'rahm',
  'drink',
  'joghurt',
  'jogurt',
  'quark',
  'kaese',
  'frischkaese',
] as const;
/** „Butter“ ohne Milch (Erdnuss-, Kakao-, Mandel-, Shea-Butter …, Butternusskürbis). */
const NON_DAIRY_BUTTER = [
  'erdnussbutter',
  'kakaobutter',
  'mandelbutter',
  'sheabutter',
  'nussbutter',
  'cashewbutter',
  'kokosbutter',
  'sesambutter',
  'butternuss',
  'butterbohne',
  'butterbohnen',
] as const;

const DAIRY_WORDS = [
  'milch',
  'kaese',
  'quark',
  'topfen',
  'joghurt',
  'jogurt',
  'butter',
  'sahne',
  'rahm',
  'molke',
  'kefir',
  'ghee',
  'buttermilch',
  'mozzarella',
  'parmesan',
  'feta',
  'ricotta',
  'skyr',
  'mascarpone',
  'schmand',
  'creme fraiche',
  'frischkaese',
  'huettenkaese',
  'gouda',
  'emmentaler',
  'bergkaese',
  'hartkaese',
  'camembert',
  'cheddar',
  'edamer',
  'halloumi',
  'pecorino',
  'burrata',
  'labneh',
  'kondensmilch',
  'milchpulver',
  'molkenprotein',
  // Wächter N2a, S1 (DACH-Begriffe, Fitness):
  'obers',
  'schlagobers',
  'kaffeeobers',
  'yoghurt',
  'yogurt',
  'tzatziki',
  'zaziki',
  'cottage cheese',
  'whey',
  'paneer',
  'raclette',
  'grana padano',
  '=grana',
  'parmigiano',
  'gorgonzola',
  'creme double',
  'creme fraiche',
  'cremefraiche',
  'pesto',
] as const;
const DAIRY_NEGATIVES = [
  ...combine(PLANT_PREFIXES, DAIRY_ENDINGS_PLANT),
  ...NON_DAIRY_BUTTER,
  // Fleischerzeugnisse, kein Käse (Wächter N0).
  'leberkaese',
  'fleischkaese',
  // „Milchner“ = männlicher Fisch, „Milchsäure“ (fermentiert, nicht aus Milch).
  'milchsaeure',
  // Fleischteile, nicht „Obers“ (österr. Sahne): BLS „Schwein Schnitzel (Oberschale) roh“, „Hähnchen Oberschenkel“
  // (Kandidatenlauf 38367139392). Wirkt nur auf die Trefferspanne im selben Wort – „Schlagobers“ bleibt Milch.
  'oberschale',
  'oberschenkel',
  // Pflanzliche Käse-Alternativen: BLS „Käsealternative, Basis Pflanzenfett/Cashewkerne, vegan“ (Kandidatenlauf
  // 40093377661). Nur das ganze Wort – „Käse“ allein und „Käseersatz“ bleiben Milch (sichere Richtung).
  'kaesealternative',
] as const;

/** Glutenfreie Getreide/Stärken: Vorsilben vor „Mehl/Nudeln/Grieß …“ (R2-S1). */
const GLUTEN_FREE_PREFIXES = [
  'reis',
  'mais',
  'buchweizen',
  'hirse',
  'kichererbsen',
  'mandel',
  'kokos',
  'kartoffel',
  'linsen',
  'quinoa',
  'amaranth',
  'soja',
  'erbsen',
  'bohnen',
  'tapioka',
  'lupinen',
  'johannisbrotkern',
  'kastanien',
  'maron',
  'teff',
] as const;
const GLUTEN_FREE_ENDINGS = [
  'mehl',
  'nudeln',
  'nudel',
  'griess',
  'pasta',
  'spaghetti',
  'staerke',
] as const;

const GLUTEN_RULE: GroupRule = {
  kind: 'rule',
  words: [
    'weizen',
    'dinkel',
    'roggen',
    'gerste',
    'hafer',
    'gruenkern',
    'kamut',
    'emmer',
    'einkorn',
    'triticale',
    'bulgur',
    'couscous',
    'seitan',
    'griess',
    'graupen',
    'nudeln',
    'nudel',
    'pasta',
    'spaghetti',
    'penne',
    'fusilli',
    'farfalle',
    'tagliatelle',
    'lasagne',
    'spaetzle',
    'gnocchi',
    'mehl',
    'brot',
    'broetchen',
    'semmel',
    'weckerl',
    'paniermehl',
    'semmelbroesel',
    'panko',
    'tortilla',
    'wrap',
    'wraps',
    'knaeckebrot',
    'zwieback',
    'toast',
    'baguette',
    'bagel',
    'pita',
    'croissant',
    'teig',
    'malz',
    'sojasauce',
    // Wächter N2a, S1:
    'brezel',
    'brezeln',
    '=breze',
    '=brezn',
    'knoedel',
    'broesel',
    'muesli',
    'porridge',
    'kuskus',
    'udon',
    'ramen',
    'orzo',
    'kritharaki',
    'maultasche',
    'maultaschen',
    'ravioli',
    'tortellini',
    'loeffelbiskuit',
    'loeffelbiskuits',
    'pfannkuchen',
    'palatschinken',
    'crepe',
    'crepes',
    'croutons',
    'pumpernickel',
    'teriyaki',
    'hoisin',
    'yufka',
    'ciabatta',
    'focaccia',
    'naan',
    'kipferl',
    'gipfeli',
    'weggli',
    '=zopf',
    'zopfbrot',
  ],
  negatives: [
    ...combine(GLUTEN_FREE_PREFIXES, GLUTEN_FREE_ENDINGS),
    'buchweizen',
    'maistortilla',
    'glasnudeln',
    'glasnudel',
    'zucchininudeln',
    'gemuesenudeln',
    'konjaknudeln',
    'johannisbrot',
    // „malz“ in Schmalz/Butterschmalz ist kein Malz (Wächter N2a, S5).
    'schmalz',
  ],
  sourceCategories: ['cereal_products', 'bread_bakery'],
  sourceCategoryExempt: [
    'reis',
    'mais',
    'hirse',
    'buchweizen',
    'quinoa',
    'amaranth',
    'teff',
    'sorghum',
    'polenta',
  ],
};

/**
 * Hackfleisch und Hackfleisch-Gerichte ohne Angabe der Tierart (Wächter N0 und N2a, S1): vorsichtig Rind UND
 * Schwein (`beef` + `meat_kind: ['beef', 'pork']`). Mit ausdrücklicher Tierart davor (Rinder-, Puten-, Lamm-,
 * Soja- …) greift die Hackfleisch-Regel nicht; die Tierart selbst prüfen die anderen Regeln.
 */
const MINCE_WORDS = [
  'hackfleisch',
  '=hack',
  'hackbaellchen',
  'gehacktes',
  'faschiertes',
  'faschierte',
  'faschierter',
  'cevapcici',
  'frikadelle',
  'frikadellen',
  'bulette',
  'buletten',
  'fleischpflanzerl',
  'fleischlaibchen',
  'hackepeter',
] as const;
const MINCE_ENDINGS = [
  'hackfleisch',
  'hack',
  'hackbaellchen',
  'frikadelle',
  'frikadellen',
  'faschiertes',
  'faschierte',
] as const;
/**
 * Ausdrücklich gemischtes Hackfleisch – auch mit Tierart vorn („Schweinehackfleisch gemischt“, „Rinderhack halb und
 * halb“, BLS „Rind Hackfleisch gemischt“ über `joinSpeciesMince`): Rind + Schwein (Wächter N2b, K1; Wächter-Prüfung
 * Zuordnung B1 – alle Tierart-Vorsilben, damit „gemischt“ nie durch die Tierart-Ausnahmen entschärft wird).
 * Wortfolgen, damit „gemischt“ allein (z. B. „gemischter Salat“) nichts auslöst.
 */
const MIXED_MINCE_SPECIES_PREFIXES = [
  '',
  'schweine',
  'schweins',
  'rinder',
  'rinds',
  'rind',
  'kalbs',
  'puten',
  'truthahn',
  'lamm',
  'gefluegel',
  'haehnchen',
  'wild',
  'hirsch',
] as const;
const MIXED_MINCE_PHRASES: readonly string[] = [
  'gemischtes hack',
  'gemischtes hackfleisch',
  ...MIXED_MINCE_SPECIES_PREFIXES.flatMap((prefix) =>
    ['hackfleisch', 'hack'].flatMap((mince) => [
      `${prefix}${mince} gemischt`,
      `${prefix}${mince} halb und halb`,
    ]),
  ),
];
/** Ausdrückliche Tierart bzw. pflanzlich, aber nicht Rind (für die Rind-Regel). */
const MINCE_NOT_BEEF_NEGATIVES = combine(
  [
    // Schweinehack ist kein Rind (Schwein prüft die Schwein-Regel; N2b-Zuordnung „Schweinehackfleisch“).
    'schweine',
    'schweins',
    'puten',
    'truthahn',
    'lamm',
    'gefluegel',
    'haehnchen',
    'huehnchen',
    'huehner',
    'soja',
    'tofu',
    'veggie',
    'vegan',
    'gemuese',
    'linsen',
    'erbsen',
    'seitan',
    'wild',
    'hirsch',
  ],
  MINCE_ENDINGS,
);
/** Ausdrückliche Tierart (auch Rind/Kalb) bzw. pflanzlich: keine Hackfleisch-Regel „Rind + Schwein“. */
const MINCE_NEGATIVES = [
  ...MINCE_NOT_BEEF_NEGATIVES,
  ...combine(['rinder', 'rinds', 'rind', 'kalbs'], MINCE_ENDINGS),
];
/**
 * Für die Schwein-Regel: wie `MINCE_NEGATIVES`, aber Wild-/Hirschhack zählt vorsichtig als Schwein (oft mit
 * Schweinespeck gemischt; Wächter-Gegenprüfung N2a, G-K1), und Schweinehack bleibt selbstverständlich Schwein
 * (die Negative „schweine…hack“ gelten nur für Rind/„gemischtes Hack“, N2b).
 */
const MINCE_PORK_NEGATIVES = MINCE_NEGATIVES.filter(
  (negative) =>
    !negative.startsWith('wild') &&
    !negative.startsWith('hirsch') &&
    !negative.startsWith('schwein'),
);

const DAIRY_RULE: GroupRule = {
  kind: 'rule',
  words: DAIRY_WORDS,
  negatives: DAIRY_NEGATIVES,
  sourceCategories: ['dairy'],
};

/**
 * Pflichtregeln je Gruppe (Plan 5.1.3). `Record<FoodGroupId, …>`: fehlt eine der 23 Gruppen, meldet der Compiler
 * einen Fehler; ein Laufzeit-Test prüft zusätzlich jeden Schlüssel gegen `FOOD_GROUP_IDS` (W19).
 */
export const ALLERGEN_RULES: Readonly<Record<FoodGroupId, GroupRule>> = {
  gluten: GLUTEN_RULE,
  dairy: DAIRY_RULE,
  lactose: {
    kind: 'rule',
    // Alle Treffer von `dairy`; zusätzlich gilt: Gruppe `dairy` am Lebensmittel ⇒ `lactose` (checkFoodAllergens).
    words: DAIRY_WORDS,
    negatives: DAIRY_NEGATIVES,
    sourceCategories: ['dairy'],
    // „laktosefrei“ hebt die Regel nur in der Bezeichnung der Quelle auf; kein automatischer Wegfall bei
    // Hartkäse (dafür die Ausnahmeliste mit Quelle).
    sourceNameExempt: ['laktosefrei', 'lactosefrei'],
  },
  eggs: {
    kind: 'rule',
    words: [
      '=ei',
      'eier',
      'eigelb',
      'eidotter',
      'eiklar',
      '=eiweiss',
      'eischnee',
      'vollei',
      '=huehnerei',
      'huehnereier',
      'huehnereiweiss',
      'huehnereigelb',
      '=wachtelei',
      'wachteleier',
      'ruehrei',
      'spiegelei',
      'eiernudeln',
      'mayonnaise',
      '=mayo',
      'baiser',
      'meringue',
      // Wächter N2a, S1:
      'aioli',
      'remoulade',
      'hollandaise',
      'loeffelbiskuit',
      'loeffelbiskuits',
      'spaetzle',
      'omelett',
      'omelette',
      'eiernockerl',
    ],
    // „Eierschwammerl“ = Pfifferling (AT), kein Ei (Wächter N0) → `mushrooms`.
    negatives: ['eierschwammerl'],
    sourceCategories: ['eggs'],
  },
  fish: {
    kind: 'rule',
    words: [
      'fisch',
      'lachs',
      'kabeljau',
      'dorsch',
      'seelachs',
      'thunfisch',
      'forelle',
      'hering',
      'matjes',
      'makrele',
      'sardine',
      'sardinen',
      'sardelle',
      'sardellen',
      'anchovis',
      'rotbarsch',
      'barsch',
      'zander',
      'pangasius',
      'scholle',
      'heilbutt',
      'karpfen',
      'saibling',
      'tilapia',
      'sprotte',
      'sprotten',
      'bueckling',
      'surimi',
      'fischsauce',
      'worcestersauce',
      'worcestershiresauce',
      'worcestershire',
      // Wächter N2a, S1:
      'worcester',
      'worcester sauce',
      'wildlachs',
      'seehecht',
      'dorade',
      'steinbutt',
      'seezunge',
      'pollack',
      'kaviar',
      'rogen',
      'bonito',
      'dashi',
      'rollmops',
      'bismarckhering',
    ],
    // Tintenfisch ist ein Weichtier → `shellfish`; Lachsschinken ist Schweinefleisch.
    negatives: ['tintenfisch', 'lachsschinken'],
    sourceCategories: ['fish'],
  },
  shellfish: {
    kind: 'rule',
    words: [
      'garnele',
      'garnelen',
      'shrimp',
      'shrimps',
      'gambas',
      'krabbe',
      'krabben',
      'krebs',
      'flusskrebs',
      'hummer',
      'languste',
      'scampi',
      'muschel',
      'muscheln',
      'miesmuschel',
      'jakobsmuschel',
      'auster',
      'austern',
      'tintenfisch',
      'kalmar',
      'calamari',
      'oktopus',
      'krake',
      'sepia',
      'meeresfruechte',
      // Wächter N2a, S1:
      'crevette',
      'crevetten',
      'prawn',
      'prawns',
      'langustine',
      'langustinen',
      'pulpo',
      'vongole',
      'schnecke',
      'schnecken',
    ],
    // Austernpilz ist ein Pilz, Muschelnudeln sind Nudeln. Weitere Fremdwort-Treffer von „Krebs“ → Ausnahmeliste.
    negatives: ['austernpilz', 'austernpilze', 'muschelnudeln', 'muschelnudel'],
    sourceCategories: ['crustaceans_molluscs'],
  },
  poultry: {
    kind: 'rule',
    words: [
      'haehnchen',
      'hendl',
      'huhn',
      'huehner',
      'poulet',
      'pute',
      'puten',
      'truthahn',
      'ente',
      'enten',
      'gans',
      'gaense',
      'gefluegel',
      'huehnerbruehe',
      // Wächter N2a, S1:
      'huehnchen',
      'chicken',
      'wachtel',
    ],
    // „Hühnerei“ ist Ei, kein Geflügelfleisch – aber „Hühnereintopf“ ist Geflügel (Wächter N2a, S1).
    negatives: [
      '=huehnerei',
      'huehnereier',
      'huehnereiweiss',
      'huehnereigelb',
      '=wachtelei',
      'wachteleier',
      'gaensebluemchen',
    ],
    sourceCategories: ['meat_poultry'],
  },
  beef: {
    kind: 'rule',
    words: [
      'rind',
      'rinder',
      'rinds',
      'kalb',
      'kalbs',
      'beef',
      'bresaola',
      'roastbeef',
      'tafelspitz',
      'buendnerfleisch',
      'ochse',
      'ochsen',
      // Hackfleisch ohne Angabe der Tierart: vorsichtig Rind + Schwein (siehe MIXED_MINCE_RULE).
      ...MINCE_WORDS,
      ...MIXED_MINCE_PHRASES,
    ],
    negatives: MINCE_NOT_BEEF_NEGATIVES,
    sourceCategories: ['meat_beef_veal'],
  },
  lamb: {
    kind: 'rule',
    words: ['lamm', 'schaf', 'schafs', 'hammel'],
    // Schafskäse, Schafsmilch, Schafsjoghurt sind Milchprodukte (`dairy`), kein Lammfleisch.
    negatives: combine(
      ['schaf', 'schafs'],
      ['kaese', 'milch', 'joghurt', 'jogurt', 'frischkaese', 'quark'],
    ),
    sourceCategories: ['meat_lamb'],
  },
  legumes: {
    kind: 'rule',
    words: [
      'linse',
      'linsen',
      'bohne',
      'bohnen',
      'kichererbse',
      'kichererbsen',
      'erbse',
      'erbsen',
      'hummus',
      'falafel',
      'kidneybohne',
      'kidneybohnen',
      'mungbohne',
      'mungbohnen',
      // Wächter N2a, K5:
      'fisole',
      'fisolen',
      'zuckerschote',
      'zuckerschoten',
      '=dal',
      'dhal',
    ],
    // Kaffee-/Kakaobohne sind keine Hülsenfrüchte; Erdnuss hat die eigene Gruppe `peanuts`.
    negatives: ['kaffeebohne', 'kaffeebohnen', 'kakaobohne', 'kakaobohnen', 'vanillebohne'],
    sourceCategories: ['legumes', 'soy_products'],
  },
  soy: {
    kind: 'rule',
    words: [
      'soja',
      'tofu',
      'tempeh',
      '=miso',
      'misopaste',
      'misosuppe',
      'edamame',
      'sojasauce',
      'tamari',
    ],
    negatives: [],
    sourceCategories: ['soy_products'],
  },
  peanuts: {
    kind: 'rule',
    words: ['erdnuss', 'erdnuesse', 'erdnussbutter', 'erdnussmus'],
    negatives: [],
    sourceCategories: [],
  },
  tree_nuts: {
    kind: 'rule',
    // Kein freies „Nuss“: Erdnuss, Kokosnuss, Muskatnuss, Butternuss sind keine Schalenfrüchte (Kokos: K11).
    words: [
      'mandel',
      'mandeln',
      'haselnuss',
      'haselnuesse',
      'walnuss',
      'walnuesse',
      'cashew',
      'cashews',
      'cashewkerne',
      'pekan',
      'pekannuss',
      'paranuss',
      'paranuesse',
      'pistazie',
      'pistazien',
      'macadamia',
      // Wächter N2a, S1 (Pesto: Pinienkerne/Cashew/Mandel – vorsichtig; vegane/nussfreie Sorten über Ausnahmeliste):
      'pesto',
      'marzipan',
      'nougat',
      '=nuss',
      '=nuesse',
      'nussmischung',
      'nusskerne',
      'studentenfutter',
      'baumnuss',
      'baumnuesse',
    ],
    negatives: [],
    // Quellgruppe „Nüsse/Samen“ ist NICHT automatisch Pflicht (Erdnuss, Kokos, Samen): Einzelprüfung (R19).
    sourceCategories: [],
    humanReview:
      'Quellgruppe Nüsse/Samen: jede Zuordnung einzeln prüfen (Kokos und Erdnuss sind keine Schalenfrüchte).',
  },
  sesame: {
    kind: 'rule',
    words: ['sesam', 'tahin', 'tahini', 'gomasio', 'halva', 'halwa', 'hummus'],
    negatives: [],
    sourceCategories: [],
  },
  celery: {
    kind: 'rule',
    // Brühe ist zusammengesetzt und enthält meist Sellerie (vorsichtig); Ausnahme nur mit Quelle.
    words: [
      'sellerie',
      'selleriesalz',
      'bruehe',
      'bruehwuerfel',
      'bruehpulver',
      'bouillon',
      'suppenwuerze',
      // Wächter N2a, S1:
      'suppengruen',
      'suppengemuese',
      'fond',
    ],
    negatives: ['fondue', 'fondant'],
    sourceCategories: [],
  },
  mustard: {
    kind: 'rule',
    words: ['senf', 'senfsaat', 'mayonnaise', '=mayo'],
    negatives: [],
    sourceCategories: [],
  },
  lupin: {
    kind: 'rule',
    words: ['lupine', 'lupinen', 'lupinenmehl'],
    negatives: [],
    sourceCategories: [],
  },
  sulphites: {
    kind: 'rule',
    words: [
      'weinessig',
      'balsamico',
      'geschwefelt',
      'trockenaprikose',
      'trockenaprikosen',
      'getrocknete aprikose',
      'getrocknete aprikosen',
      'aprikose getrocknet',
      'aprikosen getrocknet',
      // Wächter N2a, S1 (AT/CH):
      'trockenmarille',
      'trockenmarillen',
      'getrocknete marillen',
      'marillen getrocknet',
      'balsamessig',
      'rosine',
      'rosinen',
      'sultanine',
      'sultaninen',
    ],
    // „ungeschwefelt“ nur mit Quelle über die Ausnahmeliste.
    negatives: [],
    sourceCategories: [],
    humanReview:
      'Trockenobst allgemein ist oft geschwefelt – bei der Katalog-Prüfung einzeln prüfen (Wein selbst schließt R12 aus).',
  },
  fructose: {
    kind: 'human_only',
    reason:
      'Zuordnung nach Fruktose-Gehalt bzw. Fruktose-Glukose-Verhältnis der Quelldatenbank (Plan 5.1.2), nicht nach dem Namen.',
  },
  histamine: {
    kind: 'human_only',
    reason:
      'Zuordnung nach der SIGHI-Lebensmittelliste (Stufe ≥ 2, Plan 5.1.2), nicht nach dem Namen.',
  },
  mushrooms: {
    kind: 'rule',
    words: [
      'pilz',
      'pilze',
      'champignon',
      'champignons',
      'pfifferling',
      'pfifferlinge',
      'eierschwammerl',
      'schwammerl',
      'steinpilz',
      'steinpilze',
      'shiitake',
      'austernpilz',
      'austernpilze',
      'kraeuterseitling',
      'kraeuterseitlinge',
      'morchel',
      'morcheln',
      'trueffel',
      // Wächter N2a, K4:
      'egerling',
      'egerlinge',
      'portobello',
      'enoki',
      'shimeji',
    ],
    // Hefe/Hefeflocken sind in der App keine Speisepilze; Schokotrüffel sind Pralinen.
    negatives: ['schokotrueffel', 'schokoladentrueffel', 'pralinentrueffel'],
    sourceCategories: ['mushrooms'],
  },
  onion_garlic: {
    kind: 'rule',
    words: [
      'zwiebel',
      'zwiebeln',
      'knoblauch',
      'lauch',
      'porree',
      'schalotte',
      'schalotten',
      'baerlauch',
      'fruehlingszwiebel',
      'fruehlingszwiebeln',
      'schnittlauch',
      'zwiebelpulver',
      'knoblauchpulver',
    ],
    negatives: [],
    sourceCategories: [],
  },
  spicy: {
    kind: 'rule',
    words: [
      'chili',
      'chilis',
      'cayenne',
      'jalapeno',
      'jalapenos',
      'peperoncino',
      'peperoncini',
      'pfefferoni',
      'sambal',
      'harissa',
      'sriracha',
      'wasabi',
      'currypaste',
      'scharf',
      // Wächter N2a, K3 („Peperoni“ ist regional mehrdeutig → menschliche Prüfung):
      'habanero',
      'gochujang',
      'piripiri',
      'piri piri',
      'rosenpaprika',
    ],
    // „Paprika edelsüß“ und schwarzer Pfeffer sind nicht scharf im Sinne der Gruppe (kein Pflichtwort).
    negatives: [],
    sourceCategories: [],
    // Senf „mittelscharf“ (BLS „Senf mittelscharf“) ist Senföl-Schärfe, keine Chili-Schärfe (N2b; bei R19 von
    // einem Menschen zu bestätigen). Nur diese Wortfolge und nur in der Bezeichnung der QUELLE wird neutralisiert;
    // Name, Aliase und weitere Wörter der Quelle („… mit Chili“) prüft die Regel weiter.
    sourceNameRewrites: [
      ['senf mittelscharf', 'senf'],
      ['mittelscharfer senf', 'senf'],
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------
// Weitere Pflichtregeln (kein FOOD_GROUPS-Eintrag): Schwein, Fleisch, Gelatine, Hackfleisch, Schwangerschaft, Alkohol
// ---------------------------------------------------------------------------------------------------------

/** Wurst und Fleischerzeugnisse ohne Tierart: im Zweifel Schwein (Wächter N2a, S2). */
const SAUSAGE_WORDS = [
  'wurst',
  'wuerstchen',
  'wienerli',
  'lyoner',
  'mortadella',
  'krainer',
  'cervelat',
  'zervelat',
  'guanciale',
  'lardo',
  'selchfleisch',
  'geselchtes',
  'leberkaese',
  'fleischkaese',
] as const;
/** Pflanzliche Wurst-/Fleisch-Alternativen (ohne tierische Bestandteile). */
const PLANT_MEAT_NEGATIVES = [
  'sojawurst',
  'tofuwurst',
  'veggiewurst',
  'veganwurst',
  'sojafleisch',
  'kokosfleisch',
] as const;

/**
 * Schwein (`meat_kind: pork`, R8/S5). Hackfleisch, Wurst, Salami, Leber-/Fleischkäse ohne Tierart zählen
 * vorsichtig mit (Wächter N2a, S2: auch Wild-/Hirsch-/Rindersalami enthalten oft Schweinespeck – Ausnahme nur
 * über die Ausnahmeliste mit Quelle). Nur Puten-/Hähnchen-/Geflügelschinken und -speck sind ausgenommen.
 */
export const PORK_RULE: WordRule = {
  words: [
    'schwein',
    'schweine',
    'schweins',
    'speck',
    'schinken',
    'salami',
    'schmalz',
    'chorizo',
    'mett',
    '=wiener',
    'wienerle',
    'frankfurter',
    'kassler',
    'kasseler',
    'pancetta',
    'prosciutto',
    'bacon',
    // Wildhack (oft mit Schweinespeck, G-K1) und Rohschinken (G-K3, Wächter-Gegenprüfung N2a).
    'wildhack',
    'hirschhack',
    'serrano',
    'coppa',
    ...SAUSAGE_WORDS,
    ...MINCE_WORDS,
    // Ausdrücklich gemischt = Rind + Schwein, auch mit Tierart vorn (Wächter-Prüfung Zuordnung B1).
    ...MIXED_MINCE_PHRASES,
  ],
  negatives: [
    ...combine(['puten', 'truthahn', 'haehnchen', 'huehnchen', 'gefluegel'], ['schinken', 'speck']),
    ...MINCE_PORK_NEGATIVES,
    ...PLANT_MEAT_NEGATIVES,
    'serranochili',
    'serranochilis',
    'gaenseschmalz',
    'butterschmalz',
    'pflanzenschmalz',
    'kokosschmalz',
    // Palatschinken = Pfannkuchen (AT), kein Schinken (Wächter N2a, S5).
    'palatschinken',
  ],
};

/** Fleisch allgemein (`animal: meat` mit Tierart): Wurst, Fleisch, Schinken … */
export const MEAT_RULE: WordRule = {
  words: [
    ...SAUSAGE_WORDS,
    ...MINCE_WORDS,
    '=fleisch',
    'rindfleisch',
    'schweinefleisch',
    'lammfleisch',
    'schinken',
    'salami',
    'speck',
  ],
  negatives: [
    ...PLANT_MEAT_NEGATIVES,
    ...combine(
      ['soja', 'tofu', 'veggie', 'vegan', 'gemuese', 'linsen', 'erbsen', 'seitan'],
      MINCE_ENDINGS,
    ),
    'fleischtomate',
    'fleischtomaten',
    'fruchtfleisch',
    'butterschmalz',
    'palatschinken',
  ],
};

/** Gelatine → `animal: gelatin` (ohne Herkunft = Schwein, S5). */
export const GELATIN_RULE: WordRule = {
  // Fruchtgummi enthält meist Gelatine (vorsichtig; vegane Sorten über die Ausnahmeliste).
  words: ['gelatine', 'gummibaerchen', 'fruchtgummi'],
  negatives: [],
};

/** Hackfleisch ohne Tierart → `beef` + `meat_kind: ['beef', 'pork']` (Wächter N0, N2a S1). */
export const MIXED_MINCE_RULE: WordRule = {
  words: [...MINCE_WORDS, ...MIXED_MINCE_PHRASES],
  negatives: MINCE_NEGATIVES,
};

/**
 * Eindeutig pflanzliche Erzeugnisse („vegane Salami“, „pflanzliche Wurst“, „vegetarischer Aufschnitt“,
 * „Seitanwurst“): Die Wortregeln für Schwein und Fleisch greifen dann nicht (Gegenprüfung N2a, G-K2).
 */
export const PLANT_BASED_RULE: WordRule = {
  words: ['vegan', 'pflanzlich', 'vegetarisch', 'veggie', 'seitanwurst', 'seitansalami'],
  negatives: [],
};

/**
 * Leber mitten im Wort (Kalbsleberwurst, Gänseleberpastete, Hühnerleberpastete). Leberkäse steht mit „leber“ am
 * Wortanfang ohnehin in der Regel – vorsichtig auch ohne Leber im Rezept (regional mit Leber, Gegenprüfung N2a).
 */
export const LIVER_MID_WORD_RULE: WordRule = { words: ['leber'], negatives: ['kleber'] };

/** Honig → `animal: honey` (nicht vegan, Wächter N2a, B1). */
export const HONEY_RULE: WordRule = {
  words: ['honig'],
  negatives: ['honigmelone', 'honigmelonen'],
};

/**
 * Hartkäse mit tierischem Lab → `animal: animal_rennet` (nicht vegetarisch, Wächter N2a, B1). Vegetarische Sorten
 * mit mikrobiellem Lab nur über die Ausnahmeliste mit Quelle.
 */
export const ANIMAL_RENNET_RULE: WordRule = {
  words: ['parmesan', 'parmigiano', 'grana padano', '=grana', 'pecorino', 'gorgonzola', 'pesto'],
  negatives: [],
};

/** Insekten und Karmin → `animal: insect` (Wächter N2a, K8). */
export const INSECT_RULE: WordRule = {
  words: [
    'insekt',
    'insekten',
    'mehlwurm',
    'mehlwuermer',
    'grillenmehl',
    '=grille',
    '=grillen',
    'heuschrecke',
    'heuschrecken',
    'karmin',
    'cochenille',
    '=e120',
  ],
  negatives: [],
};

/**
 * Verarbeitung, die Fisch in der Schwangerschaft heikel macht (Wächter N2a, B3): geräuchert (kalt und heiß),
 * gebeizt, mariniert – in der Schreibweise der Quell-Datenbanken („Lachs, geräuchert“). Greift nur bei Fisch bzw.
 * Krebs-/Weichtieren (Gruppe am Lebensmittel oder Pflicht aus Wort/Quellgruppe).
 */
export const FISH_PROCESSING_RULE: WordRule = {
  words: [
    'geraeuchert',
    'geraeucherte',
    'geraeucherter',
    'geraeuchertes',
    'raeucher',
    'gebeizt',
    'gebeizte',
    'gebeizter',
    'mariniert',
    'marinierte',
    'marinierter',
  ],
  negatives: [],
};

/**
 * `pregnancy_caution` (R2-S2): Rohmilch, Rohmilchkäse, kalt geräucherter oder gebeizter Fisch, Räucherfisch,
 * Sushi/Sashimi/roher Fisch, Rohwurst (Salami, Mett, Teewurst, Cervelat), Rohschinken (Parma, Serrano,
 * Schwarzwälder), Leber und Leberprodukte. Ob ein REZEPT heikel ist, entscheidet zusätzlich die Zubereitung
 * (`heated`, Plan 5.2).
 */
export const PREGNANCY_CAUTION_RULE: WordRule = {
  words: [
    'rohmilch',
    'raeucherlachs',
    'raeucherforelle',
    'raeuchermakrele',
    'raeucheraal',
    'raeucherfisch',
    'bueckling',
    'kaltgeraeuchert',
    'heissgeraeuchert',
    'kalt geraeuchert',
    'graved',
    'gravlax',
    'gebeizt',
    'gebeizter',
    'gebeizte',
    'sushi',
    'sashimi',
    'tatar',
    'carpaccio',
    'ceviche',
    'salami',
    'mett',
    'teewurst',
    'cervelat',
    'zervelat',
    'rohwurst',
    'landjaeger',
    'chorizo',
    'rohschinken',
    'parmaschinken',
    '=parma',
    'serrano',
    'serranoschinken',
    'schwarzwaelder schinken',
    'katenschinken',
    'lachsschinken',
    'prosciutto',
    'coppa',
    'bresaola',
    'buendnerfleisch',
    'leber',
    // Wächter N2a, B3: roh marinierter Fisch und Fischrogen.
    'matjes',
    'rollmops',
    'bismarckhering',
    'kaviar',
    'rogen',
    'graved lachs',
    'heiss geraeuchert',
  ],
  // Serrano-Chili ist eine Paprikasorte; Tatarensauce ist eine Mayonnaise-Sauce (kein rohes Fleisch).
  negatives: ['serranochili', 'serranochilis', 'tatarensauce', 'tatarensosse'],
};

/** Alkohol (`alcohol: true`, Regel R12 schließt solche Rezepte aus). Ergänzung in N2a, sichere Richtung. */
export const ALCOHOL_RULE: WordRule = {
  words: [
    '=wein',
    'rotwein',
    'weisswein',
    'rosewein',
    'portwein',
    'kochwein',
    'bier',
    '=rum',
    'likoer',
    'sekt',
    'prosecco',
    'schnaps',
    'cognac',
    'brandy',
    'wodka',
    'weinbrand',
    'marsala',
    '=sake',
    'mirin',
    '=sherry',
    // Wächter N2a, K2:
    'gluehwein',
    'reiswein',
    'shaoxing',
    'rumrosinen',
    'grappa',
    'kirschwasser',
    'amaretto',
    'whisky',
    'whiskey',
    '=gin',
    'wermut',
    'cidre',
  ],
  negatives: [
    'insekt',
    'insekten',
    'bierhefe',
    'bierrettich',
    'bierschinken',
    'bierwurst',
    'rotweinessig',
    'weissweinessig',
  ],
};

/**
 * Quell-Lebensmittelgruppe → Pflichtmerkmale (Plan 5.1.3, Spalte „Quell-Lebensmittelgruppe“). Die Gruppen selbst
 * stehen in `ALLERGEN_RULES[…].sourceCategories`; hier die Zusatzregeln für Fleisch nach Tierart.
 */
export const SOURCE_CATEGORY_EXTRA_RULES: Readonly<
  Partial<Record<SourceFoodCategory, readonly AllergenExtraRule[]>>
> = {
  meat_pork: ['pork', 'meat'],
  meat_beef_veal: ['meat'],
  meat_lamb: ['meat'],
  meat_poultry: ['meat'],
  meat_game: ['meat'],
  offal: ['meat'],
  sausage_meat_products: ['meat'],
  alcoholic_beverages: ['alcohol'],
};

// ---------------------------------------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------------------------------------

/** Warum eine Regel greift (für den Prüfbericht). */
export interface RuleReason {
  readonly via: 'word' | 'source_category' | 'animal' | 'meat_kind' | 'group';
  readonly detail: string;
}

export type AllergenRuleKey = FoodGroupId | AllergenExtraRule;

/** Pflichtmerkmale eines Lebensmittels mit Begründung. */
export type RequiredFoodRules = ReadonlyMap<AllergenRuleKey, readonly RuleReason[]>;

type FoodForRules = Pick<
  Food,
  'name_de' | 'name_de_plural' | 'aliases_de' | 'source' | 'animal' | 'meat_kind' | 'groups'
>;

/** Alle Texte eines Lebensmittels, die R18 prüft. */
export function foodRuleTexts(food: FoodForRules): string[] {
  return [
    food.name_de,
    ...(food.name_de_plural === undefined ? [] : [food.name_de_plural]),
    ...food.aliases_de,
    food.source.name,
  ];
}

/** Texte für eine Gruppenregel: wie `foodRuleTexts`, die Quell-Bezeichnung ggf. mit `sourceNameRewrites`. */
function groupRuleTexts(food: FoodForRules, rule: Extract<GroupRule, { kind: 'rule' }>): string[] {
  const rewrites = rule.sourceNameRewrites ?? [];
  if (rewrites.length === 0) {
    return foodRuleTexts(food);
  }
  let source = ` ${normalizeFoodText(food.source.name).replace(/-/g, ' ')} `;
  for (const [from, to] of rewrites) {
    source = source.split(` ${from} `).join(` ${to} `);
  }
  return [
    food.name_de,
    ...(food.name_de_plural === undefined ? [] : [food.name_de_plural]),
    ...food.aliases_de,
    source.trim(),
  ];
}

function wordReasons(hits: readonly WordHit[]): RuleReason[] {
  return hits.map((hit) => ({
    via: 'word',
    detail: `„${hit.pattern.replace(/^=/, '')}“ in „${hit.word}“`,
  }));
}

/**
 * Leitet die Pflichtmerkmale eines Lebensmittels ab: Wortregeln, Quell-Lebensmittelgruppe und Folgeregeln
 * (tierische Bestandteile ⇒ Gruppen, Tierart ⇒ Gruppe, `dairy` ⇒ `lactose`).
 */
export function requiredFoodRules(food: FoodForRules): RequiredFoodRules {
  const texts = foodRuleTexts(food);
  const required = new Map<AllergenRuleKey, RuleReason[]>();
  const add = (key: AllergenRuleKey, reasons: readonly RuleReason[]) => {
    if (reasons.length > 0) {
      required.set(key, [...(required.get(key) ?? []), ...reasons]);
    }
  };
  const category = food.source.category;
  const sourceName = [food.source.name];

  for (const [group, rule] of Object.entries(ALLERGEN_RULES) as [FoodGroupId, GroupRule][]) {
    if (rule.kind === 'human_only') {
      continue;
    }
    if (
      rule.sourceNameExempt !== undefined &&
      matchWordRule(sourceName, { words: rule.sourceNameExempt, negatives: [] }).length > 0
    ) {
      continue;
    }
    add(group, wordReasons(matchWordRule(groupRuleTexts(food, rule), rule)));
    if (rule.sourceCategories.includes(category)) {
      // Ausnahme nur aus der Bezeichnung der QUELLE, nie aus Aliasen (Wächter N2a, S3: „Kritharaki“ mit Alias
      // „griechische Reisnudeln“ darf die Gluten-Pflicht nicht aufheben).
      const exempt =
        rule.sourceCategoryExempt !== undefined &&
        matchWordRule(sourceName, { words: rule.sourceCategoryExempt, negatives: [] }).length > 0;
      if (!exempt) {
        add(group, [{ via: 'source_category', detail: `Quellgruppe „${category}“` }]);
      }
    }
  }

  // Ausdrücklich pflanzliche Wurst/Salami (Wächter-Gegenprüfung N2a, G-K2): kein Schwein/Fleisch aus Wörtern.
  // Die Quellgruppe (z. B. Fleischerzeugnis) gilt trotzdem.
  const plantBased = matchWordRule(texts, PLANT_BASED_RULE).length > 0;
  if (!plantBased) {
    add('pork', wordReasons(matchWordRule(texts, PORK_RULE)));
    add('meat', wordReasons(matchWordRule(texts, MEAT_RULE)));
  }
  add('gelatin', wordReasons(matchWordRule(texts, GELATIN_RULE)));
  add('mixed_mince', wordReasons(matchWordRule(texts, MIXED_MINCE_RULE)));
  add('pregnancy_caution', wordReasons(matchWordRule(texts, PREGNANCY_CAUTION_RULE)));
  // „leber“ auch mitten im Wort (Kalbsleberwurst, Gänseleberpastete; Gegenprüfung N2a, G-S1).
  add('pregnancy_caution', wordReasons(findMidWordHits(texts, LIVER_MID_WORD_RULE)));
  add('alcohol', wordReasons(matchWordRule(texts, ALCOHOL_RULE)));
  add('animal_honey', wordReasons(matchWordRule(texts, HONEY_RULE)));
  add('animal_rennet', wordReasons(matchWordRule(texts, ANIMAL_RENNET_RULE)));
  add('animal_insect', wordReasons(matchWordRule(texts, INSECT_RULE)));
  for (const extra of SOURCE_CATEGORY_EXTRA_RULES[category] ?? []) {
    add(extra, [{ via: 'source_category', detail: `Quellgruppe „${category}“` }]);
  }

  // Tierische Bestandteile ⇒ Allergen-Gruppe (`animal` nutzt 'egg', FOOD_GROUPS 'eggs').
  const animalToGroup = [
    ['egg', 'eggs'],
    ['fish', 'fish'],
    ['shellfish', 'shellfish'],
    ['dairy', 'dairy'],
  ] as const;
  for (const [animal, group] of animalToGroup) {
    if (food.animal.includes(animal)) {
      add(group, [{ via: 'animal', detail: `tierischer Bestandteil „${animal}“` }]);
    }
  }
  // Tierart ⇒ Gruppe.
  const meatToGroup = [
    ['beef', 'beef'],
    ['poultry', 'poultry'],
    ['lamb', 'lamb'],
  ] as const;
  for (const [kind, group] of meatToGroup) {
    if (food.meat_kind.includes(kind)) {
      add(group, [{ via: 'meat_kind', detail: `Tierart „${kind}“` }]);
    }
  }
  // Gruppe ⇒ tierischer Bestandteil (Wächter N2a, B1), auch aus Wort- oder Quellgruppen-Pflicht.
  const groupToAnimal = [
    ['eggs', 'animal_egg'],
    ['fish', 'animal_fish'],
    ['shellfish', 'animal_shellfish'],
    ['dairy', 'animal_dairy'],
  ] as const;
  for (const [group, key] of groupToAnimal) {
    if (food.groups.includes(group) || required.has(group)) {
      add(key, [{ via: 'group', detail: `Gruppe „${group}“` }]);
    }
  }
  // Geräucherter/gebeizter/marinierter Fisch ⇒ Schwangerschafts-Vorsicht (Wächter N2a, B3).
  const isSeafood = (['fish', 'shellfish'] as const).some(
    (group) => food.groups.includes(group) || required.has(group),
  );
  if (isSeafood) {
    add('pregnancy_caution', wordReasons(matchWordRule(texts, FISH_PROCESSING_RULE)));
  }
  // Gruppe Geflügel/Rind/Lamm ⇒ Fleisch.
  for (const group of ['poultry', 'beef', 'lamb'] as const) {
    if (food.groups.includes(group) || required.has(group)) {
      add('meat', [{ via: 'group', detail: `Gruppe „${group}“` }]);
    }
  }
  // Milchprodukt ⇒ Laktose (Plan 5.1.3: „alle Treffer von dairy“), außer „laktosefrei“ in der Quelle.
  const lactoseRule = ALLERGEN_RULES.lactose;
  const lactoseFree =
    lactoseRule.kind === 'rule' &&
    lactoseRule.sourceNameExempt !== undefined &&
    matchWordRule(sourceName, { words: lactoseRule.sourceNameExempt, negatives: [] }).length > 0;
  if (!lactoseFree && (food.groups.includes('dairy') || required.has('dairy'))) {
    add('lactose', [{ via: 'group', detail: 'Gruppe „dairy“' }]);
  }
  return required;
}

/** Erfüllt das Lebensmittel die Pflichtregel? */
export function satisfiesRule(
  food: Pick<
    Food,
    'groups' | 'animal' | 'meat_kind' | 'gelatin_origin' | 'pregnancy_caution' | 'alcohol'
  >,
  key: AllergenRuleKey,
): boolean {
  switch (key) {
    case 'pork':
      return foodContainsPork(food);
    case 'meat':
      return food.animal.includes('meat') && food.meat_kind.length > 0;
    case 'gelatin':
      return food.animal.includes('gelatin');
    case 'mixed_mince':
      return (
        food.groups.includes('beef') &&
        food.meat_kind.includes('beef') &&
        food.meat_kind.includes('pork')
      );
    case 'pregnancy_caution':
      return food.pregnancy_caution;
    case 'alcohol':
      return food.alcohol;
    case 'animal_egg':
      return food.animal.includes('egg');
    case 'animal_fish':
      return food.animal.includes('fish');
    case 'animal_shellfish':
      return food.animal.includes('shellfish');
    case 'animal_dairy':
      return food.animal.includes('dairy');
    case 'animal_honey':
      return food.animal.includes('honey');
    case 'animal_rennet':
      return food.animal.includes('animal_rennet');
    case 'animal_insect':
      return food.animal.includes('insect');
    default:
      return food.groups.includes(key);
  }
}

/**
 * Kernwörter je Gruppe für den gelben Hinweis „Kernwort mitten im Wort“ (Wächter N2a, S1), z. B. „lachs“ in
 * „Wildlachsfilet“, „milch“ in „Vollmilchschokolade“, „hafer“ in „Vollkornhaferflocken“.
 */
export const MID_WORD_CORE_WORDS: Readonly<Partial<Record<FoodGroupId, readonly string[]>>> = {
  gluten: ['weizen', 'dinkel', 'roggen', 'gerste', 'hafer', 'mehl', 'nudel', 'brot', 'tortilla'],
  dairy: ['milch', 'joghurt', 'kaese', 'quark', 'sahne', 'butter'],
  eggs: ['eier'],
  fish: ['lachs', 'fisch', 'hering', 'forelle', 'thunfisch'],
  shellfish: ['garnele', 'krabbe', 'muschel'],
  peanuts: ['erdnuss'],
  tree_nuts: ['mandel', 'haselnuss', 'walnuss', 'cashew', 'pistazie'],
  sesame: ['sesam'],
  soy: ['soja'],
};

/** Gruppen, deren Kernwort mitten in einem Wort steht, die das Lebensmittel aber NICHT hat. */
export function midWordGroupHints(food: FoodForRules): { group: FoodGroupId; hits: WordHit[] }[] {
  const texts = foodRuleTexts(food);
  const result: { group: FoodGroupId; hits: WordHit[] }[] = [];
  for (const [group, words] of Object.entries(MID_WORD_CORE_WORDS) as [FoodGroupId, string[]][]) {
    if (food.groups.includes(group)) {
      continue;
    }
    const rule = ALLERGEN_RULES[group];
    const negatives = rule.kind === 'rule' ? rule.negatives : [];
    const hits = findMidWordHits(texts, { words, negatives });
    if (hits.length > 0) {
      result.push({ group, hits });
    }
  }
  return result;
}
