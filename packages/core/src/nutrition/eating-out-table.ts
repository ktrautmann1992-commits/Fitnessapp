/**
 * Gerichte für „Auswärts essen“ (Reiter „Unterwegs“ beim Eintragen, Gründer-Freigabe 25.10.2026) – die EINE Quelle,
 * aus welchen Zutaten eine typische Portion besteht. Regeln und Rechnung: `eating-out.ts`.
 *
 * Grundsatz „keine erfundenen Nährwerte“: Hier stehen NUR Zutaten mit Gramm je normaler Portion (wie bei eigenen
 * Gerichten aus Zutaten, KONZEPT 6.2). Die Werte rechnet `eatingOutNutrients` mit derselben Rechnung wie Rezepte aus
 * dem Lebensmittel-Katalog (BLS 4.0). Fehlt eine wesentliche Zutat im Katalog (z. B. Butter, Bratwurst, Mozzarella
 * vollfett, Fladenbrot), steht sie unter `missing` – das Gericht ist dann ein ENTWURF ohne Werte und erscheint in der
 * App nicht, bis die Zutat über den Workflow `foods-import` (Modus „kandidaten“ → Quell-ID → „import“) im Katalog ist.
 * Kein Ersatz durch „ähnliche“ Lebensmittel.
 *
 * Zusammensetzung und Mengen sind Annahmen für eine übliche Portion in Gastronomie, Imbiss, Kantine und Bäckerei im
 * DACH-Raum (Orientierung: Rezeptmengen der Gemeinschaftsverpflegung nach DGE-Qualitätsstandard, BZfE
 * „Lebensmittel-Portionsgrößen“, übliche Stückgewichte im Handel). Bratfett/Frittierfett ist als Öl-Aufnahme
 * eingerechnet (Pommes: 250 g rohe Kartoffeln + 22 g Öl ≈ Portion 150 g mit ca. 14 % Fett; Schnitzel: 20 g Öl). Rohgewichte, wie in den Rezepten.
 * ALLES ENTWURF (`status: 'draft'`): Freigabe durch die Gründer bzw. Fachprüfung je Gericht – dazu `status` auf
 * 'released' setzen und `reviewed_by`/`reviewed_at` eintragen (Pull Request, Freigabe = Merge). Bis dahin zeigt die
 * App die berechenbaren Entwürfe nur im Testmodus (wie Rezept-Entwürfe) und immer mit „Schätzwert“.
 */

export const EATING_OUT_CATEGORIES = [
  'restaurant',
  'imbiss',
  'kantine',
  'baeckerei',
  'cafe',
  'fastfood',
] as const;
export type EatingOutCategory = (typeof EATING_OUT_CATEGORIES)[number];

export const EATING_OUT_CATEGORY_LABELS_DE: Readonly<Record<EatingOutCategory, string>> = {
  restaurant: 'Restaurant',
  imbiss: 'Imbiss',
  kantine: 'Kantine',
  baeckerei: 'Bäckerei',
  cafe: 'Café',
  fastfood: 'Fast Food',
};

/** Art der Portionsauswahl (Faktoren in `EATING_OUT.portions`, constants.ts). */
export type EatingOutPortionKind = 'plate' | 'pizza' | 'piece' | 'drink';

/** Zutat, die im Katalog fehlt (Suchbegriffe für den Workflow `foods-import`, Modus „kandidaten“). */
export interface EatingOutMissingFood {
  readonly name_de: string;
  readonly search_de: readonly string[];
}

export interface EatingOutDishDef {
  readonly id: string;
  readonly name_de: string;
  readonly category: EatingOutCategory;
  readonly portion: EatingOutPortionKind;
  /** Was „normal“ bedeutet („1 Teller“, „0,3 l“, „1 Stück“). */
  readonly basis_de: string;
  /** Zutaten einer normalen Portion: [Katalog-ID, Gramm]. */
  readonly items: readonly (readonly [string, number])[];
  /** Fehlende Katalog-Zutaten → Entwurf ohne Werte. */
  readonly missing?: readonly EatingOutMissingFood[];
  /** Annahme, die bei der Freigabe zu prüfen ist. */
  readonly note_de?: string;
  readonly status: 'draft' | 'released';
  readonly reviewed_by?: string;
  readonly reviewed_at?: string;
}

// Häufig fehlende Zutaten (Suchbegriffe für BLS 4.0).
const BUTTER: EatingOutMissingFood = { name_de: 'Butter', search_de: ['Butter'] };
const VOLLMILCH: EatingOutMissingFood = {
  name_de: 'Vollmilch 3,5 %',
  search_de: ['Vollmilch', 'Milch 3,5'],
};
const MOZZARELLA: EatingOutMissingFood = {
  name_de: 'Mozzarella (vollfett)',
  search_de: ['Mozzarella'],
};
const WEIZENMEHL: EatingOutMissingFood = {
  name_de: 'Weizenmehl Type 405/550',
  search_de: ['Weizen Mehl Type 405', 'Weizen Mehl Type 550'],
};
const BRATWURST: EatingOutMissingFood = {
  name_de: 'Bratwurst (Schwein)',
  search_de: ['Bratwurst', 'Rostbratwurst'],
};
const KETCHUP: EatingOutMissingFood = {
  name_de: 'Tomatenketchup',
  search_de: ['Ketchup', 'Tomatenketchup'],
};
const MAYONNAISE: EatingOutMissingFood = {
  name_de: 'Mayonnaise',
  search_de: ['Mayonnaise', 'Salatmayonnaise'],
};
const FLADENBROT: EatingOutMissingFood = {
  name_de: 'Fladenbrot (Pide)',
  search_de: ['Fladenbrot', 'Pide'],
};
const DOENERFLEISCH: EatingOutMissingFood = {
  name_de: 'Dönerfleisch (Kalb/Rind bzw. Hähnchen, gegart)',
  search_de: ['Döner', 'Gyros'],
};
const SALAMI: EatingOutMissingFood = { name_de: 'Salami', search_de: ['Salami'] };
const SPECK: EatingOutMissingFood = {
  name_de: 'Speck (durchwachsen)',
  search_de: ['Speck durchwachsen', 'Bauchspeck'],
};
const SAHNE: EatingOutMissingFood = {
  name_de: 'Schlagsahne 30 %',
  search_de: ['Schlagsahne', 'Sahne 30'],
};
const SCHMAND: EatingOutMissingFood = {
  name_de: 'Schmand / Crème fraîche',
  search_de: ['Schmand', 'Crème fraîche', 'Creme fraiche'],
};
const BURGERBROT: EatingOutMissingFood = {
  name_de: 'Burgerbrötchen',
  search_de: ['Hamburgerbrötchen', 'Burger Brötchen'],
};
const RINDERHACK_20: EatingOutMissingFood = {
  name_de: 'Rinderhackfleisch (ca. 20 % Fett)',
  search_de: ['Rind Hackfleisch'],
};
const SCHMELZKAESE: EatingOutMissingFood = {
  name_de: 'Schmelzkäse-Scheibe',
  search_de: ['Schmelzkäse', 'Scheiblettenkäse'],
};
const VANILLEEIS: EatingOutMissingFood = {
  name_de: 'Speiseeis Vanille',
  search_de: ['Speiseeis Vanille', 'Eiscreme'],
};
const COLA: EatingOutMissingFood = {
  name_de: 'Cola (zuckerhaltig)',
  search_de: ['Cola', 'Limonade'],
};
const APFELSAFT: EatingOutMissingFood = { name_de: 'Apfelsaft', search_de: ['Apfelsaft'] };
const PLUNDERTEIG: EatingOutMissingFood = {
  name_de: 'Plunder-/Blätterteig',
  search_de: ['Plunderteig', 'Blätterteig', 'Croissant'],
};
const HEFETEIG_SUESS: EatingOutMissingFood = {
  name_de: 'Hefeteig süß / Rührteig',
  search_de: ['Hefezopf', 'Rührkuchen', 'Krapfen', 'Berliner'],
};

const d = (
  id: string,
  name_de: string,
  category: EatingOutCategory,
  portion: EatingOutPortionKind,
  basis_de: string,
  items: readonly (readonly [string, number])[],
  extra: { missing?: readonly EatingOutMissingFood[]; note_de?: string } = {},
): EatingOutDishDef => ({
  id,
  name_de,
  category,
  portion,
  basis_de,
  items,
  ...(extra.missing !== undefined ? { missing: extra.missing } : {}),
  ...(extra.note_de !== undefined ? { note_de: extra.note_de } : {}),
  status: 'draft',
});

// Wiederkehrende Bausteine (Gramm roh).
const POMMES: readonly (readonly [string, number])[] = [
  ['kartoffeln', 250],
  ['rapsoel', 22],
  ['salz', 1],
];
const PANADE_SCHNITZEL: readonly (readonly [string, number])[] = [
  ['schweineschnitzel', 160],
  ['huehnerei', 20],
  ['paniermehl', 25],
  ['rapsoel', 20],
];
const JOGHURTSOSSE: readonly (readonly [string, number])[] = [
  ['joghurt-1-5', 40],
  ['knoblauch', 2],
];

export const EATING_OUT_DISHES: readonly EatingOutDishDef[] = [
  // ------------------------------------------------------------------ Restaurant
  d(
    'auswaerts-schnitzel-pommes',
    'Schnitzel Wiener Art mit Pommes',
    'restaurant',
    'plate',
    '1 Teller',
    [...PANADE_SCHNITZEL, ...POMMES, ['zitronensaft', 5]],
    {
      note_de:
        'Schweineschnitzel paniert (Ei, Paniermehl), in Öl gebraten; Mehl zum Panieren vernachlässigt.',
    },
  ),
  d(
    'auswaerts-schnitzel-kartoffelsalat',
    'Schnitzel mit Kartoffelsalat',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ...PANADE_SCHNITZEL,
      ['kartoffeln', 250],
      ['zwiebel', 25],
      ['gemuesebruehe-zubereitet', 60],
      ['apfelessig', 10],
      ['senf', 5],
      ['rapsoel', 12],
    ],
    { note_de: 'Süddeutscher Kartoffelsalat mit Brühe, Essig und Öl (ohne Mayonnaise).' },
  ),
  d(
    'auswaerts-jaegerschnitzel-pommes',
    'Jägerschnitzel mit Pommes',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ...PANADE_SCHNITZEL,
      ['champignons', 100],
      ['zwiebel', 20],
      ['kochsahne-15', 60],
      ['rapsoel', 5],
      ...POMMES,
    ],
    { note_de: 'Paniert mit Pilz-Rahmsoße (Kochsahne 15 %).' },
  ),
  d('auswaerts-cordon-bleu-pommes', 'Cordon bleu mit Pommes', 'restaurant', 'plate', '1 Teller', [
    ...PANADE_SCHNITZEL,
    ['kochschinken', 30],
    ['gouda', 30],
    ...POMMES,
  ]),
  d(
    'auswaerts-hueftsteak-ofenkartoffel',
    'Hüftsteak mit Ofenkartoffel und Kräuterquark',
    'restaurant',
    'plate',
    '1 Teller (200 g Steak)',
    [
      ['rinderhueftsteak', 200],
      ['rapsoel', 10],
      ['kartoffeln', 300],
      ['magerquark', 80],
      ['schnittlauch-frisch', 5],
      ['salatmix', 50],
    ],
  ),
  d(
    'auswaerts-lachs-reis-gemuese',
    'Lachsfilet mit Reis und Gemüse',
    'restaurant',
    'plate',
    '1 Teller (160 g Lachs)',
    [
      ['lachsfilet', 160],
      ['basmatireis-trocken', 80],
      ['brokkoli', 120],
      ['karotte', 60],
      ['olivenoel', 10],
    ],
  ),
  d(
    'auswaerts-spaghetti-bolognese',
    'Spaghetti Bolognese',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['spaghetti-trocken', 125],
      ['rinderhackfleisch-5-fett', 50],
      ['hackfleisch-vom-schwein', 50],
      ['passierte-tomaten', 150],
      ['zwiebel', 30],
      ['karotte', 30],
      ['tomatenmark', 10],
      ['olivenoel', 10],
      ['parmesan', 10],
    ],
    { note_de: 'Gemischtes Hackfleisch (halb Rind 5 %, halb Schwein).' },
  ),
  d('auswaerts-spaghetti-napoli', 'Spaghetti mit Tomatensoße', 'restaurant', 'plate', '1 Teller', [
    ['spaghetti-trocken', 125],
    ['passierte-tomaten', 180],
    ['zwiebel', 25],
    ['knoblauch', 3],
    ['olivenoel', 12],
    ['parmesan', 10],
    ['basilikum', 2],
  ]),
  d(
    'auswaerts-penne-arrabbiata',
    'Penne all’arrabbiata',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['spaghetti-trocken', 125],
      ['gehackte-tomaten-dose', 180],
      ['knoblauch', 4],
      ['sambal-oelek', 5],
      ['olivenoel', 12],
      ['petersilie-frisch', 3],
    ],
    { note_de: 'Nudeln aus Hartweizen (Katalog „Teigwaren eifrei“), Chili als Sambal Oelek.' },
  ),
  d(
    'auswaerts-gnocchi-tomate',
    'Gnocchi mit Tomatensoße und Parmesan',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['gnocchi-kuehlregal', 300],
      ['passierte-tomaten', 150],
      ['olivenoel', 10],
      ['parmesan', 15],
      ['basilikum', 2],
    ],
  ),
  d(
    'auswaerts-pilzrisotto',
    'Pilzrisotto',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['risottoreis', 90],
      ['champignons', 120],
      ['zwiebel', 25],
      ['gemuesebruehe-zubereitet', 300],
      ['parmesan', 20],
      ['olivenoel', 15],
    ],
    { note_de: 'Mit Olivenöl statt Butter angesetzt.' },
  ),
  d(
    'auswaerts-caesar-salad',
    'Caesar Salad mit Hähnchen',
    'restaurant',
    'plate',
    '1 Schüssel',
    [
      ['romanasalat', 150],
      ['haehnchenbrustfilet', 120],
      ['parmesan', 20],
      ['toastbrot-weizen', 30],
      ['olivenoel', 20],
      ['zitronensaft', 10],
      ['senf', 5],
    ],
    {
      note_de: 'Dressing vereinfacht aus Öl, Zitrone, Senf, Parmesan (ohne Mayonnaise/Sardellen).',
    },
  ),
  d(
    'auswaerts-griechischer-salat',
    'Griechischer Bauernsalat',
    'restaurant',
    'plate',
    '1 Schüssel',
    [
      ['tomate', 150],
      ['gurke', 120],
      ['paprika-rot', 60],
      ['rote-zwiebel', 30],
      ['feta', 80],
      ['oliven-schwarz', 20],
      ['olivenoel', 15],
    ],
  ),
  d(
    'auswaerts-thai-curry-haehnchen',
    'Thai-Curry mit Hähnchen und Reis',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['haehnchenbrustfilet', 140],
      ['kokosmilch', 120],
      ['paprika-rot', 60],
      ['zucchini', 60],
      ['basmatireis-trocken', 80],
      ['rapsoel', 8],
      ['sojasauce', 10],
    ],
    { note_de: 'Currypaste vernachlässigt (kleine Menge).' },
  ),
  d(
    'auswaerts-pad-thai',
    'Pad Thai mit Garnelen',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['reisnudeln-trocken', 100],
      ['garnelen-tk-roh-geschaelt', 100],
      ['huehnerei', 50],
      ['fruehlingszwiebel', 20],
      ['erdnussmus', 10],
      ['sojasauce', 15],
      ['limettensaft', 10],
      ['zucker', 8],
      ['rapsoel', 15],
    ],
    { note_de: 'Erdnüsse als Erdnussmus, Fischsoße durch Sojasoße angenähert.' },
  ),
  d(
    'auswaerts-burrito',
    'Burrito mit Rind, Reis und Bohnen',
    'restaurant',
    'plate',
    '1 Stück',
    [
      ['vollkorn-tortilla', 90],
      ['rinderhackfleisch-5-fett', 80],
      ['express-reis-beutel-gegart', 80],
      ['schwarze-bohnen-dose-abgetropft', 60],
      ['mais-dose-abgetropft', 30],
      ['gouda', 25],
      ['tomate', 40],
      ['rapsoel', 5],
    ],
    { note_de: 'Katalog „Weizentortilla“; Salsa als frische Tomate.' },
  ),
  d('auswaerts-bauernfruehstueck', 'Bauernfrühstück', 'restaurant', 'plate', '1 Pfanne', [
    ['kartoffeln', 250],
    ['huehnerei', 100],
    ['kochschinken', 40],
    ['zwiebel', 40],
    ['rapsoel', 15],
    ['gurke', 50],
  ]),
  d(
    'auswaerts-kaesespaetzle',
    'Käsespätzle mit Röstzwiebeln',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['eierspaetzle-getrocknet', 125],
      ['gouda', 70],
      ['zwiebel', 50],
      ['rapsoel', 15],
    ],
    {
      note_de:
        'Käse als Gouda 48 %; regional oft Bergkäse/Emmentaler (ähnliche Werte, vor Freigabe prüfen).',
    },
  ),
  d(
    'auswaerts-pizza-margherita',
    'Pizza Margherita',
    'restaurant',
    'pizza',
    '1 Pizza (ca. 30 cm)',
    [
      ['passierte-tomaten', 100],
      ['olivenoel', 10],
      ['basilikum', 3],
    ],
    { missing: [WEIZENMEHL, MOZZARELLA] },
  ),
  d(
    'auswaerts-pizza-salami',
    'Pizza Salami',
    'restaurant',
    'pizza',
    '1 Pizza (ca. 30 cm)',
    [
      ['passierte-tomaten', 100],
      ['olivenoel', 10],
    ],
    { missing: [WEIZENMEHL, MOZZARELLA, SALAMI] },
  ),
  d(
    'auswaerts-pizza-funghi',
    'Pizza Funghi',
    'restaurant',
    'pizza',
    '1 Pizza (ca. 30 cm)',
    [
      ['passierte-tomaten', 100],
      ['champignons', 80],
      ['olivenoel', 10],
    ],
    { missing: [WEIZENMEHL, MOZZARELLA] },
  ),
  d(
    'auswaerts-pizza-tonno',
    'Pizza Tonno',
    'restaurant',
    'pizza',
    '1 Pizza (ca. 30 cm)',
    [
      ['passierte-tomaten', 100],
      ['thunfisch-dose-im-eigenen-saft-abgetropft', 80],
      ['zwiebel', 30],
      ['olivenoel', 10],
    ],
    { missing: [WEIZENMEHL, MOZZARELLA] },
  ),
  d(
    'auswaerts-flammkuchen',
    'Flammkuchen Elsässer Art',
    'restaurant',
    'pizza',
    '1 Flammkuchen',
    [['zwiebel', 60]],
    { missing: [WEIZENMEHL, SCHMAND, SPECK] },
  ),
  d(
    'auswaerts-lasagne',
    'Lasagne',
    'restaurant',
    'plate',
    '1 Portion',
    [
      ['lasagneplatten', 80],
      ['rinderhackfleisch-5-fett', 100],
      ['passierte-tomaten', 150],
      ['parmesan', 15],
    ],
    { missing: [BUTTER, WEIZENMEHL, VOLLMILCH, MOZZARELLA] },
  ),
  d(
    'auswaerts-spaghetti-carbonara',
    'Spaghetti Carbonara',
    'restaurant',
    'plate',
    '1 Teller',
    [
      ['spaghetti-trocken', 125],
      ['huehnerei', 60],
      ['parmesan', 25],
    ],
    { missing: [SPECK] },
  ),

  // ------------------------------------------------------------------ Imbiss
  d('auswaerts-pommes', 'Pommes frites', 'imbiss', 'plate', '1 Schale (ca. 150 g)', POMMES, {
    note_de: 'Aus 250 g rohen Kartoffeln mit 22 g Öl-Aufnahme beim Frittieren; ohne Soße.',
  }),
  d('auswaerts-pommes-rot-weiss', 'Pommes rot-weiß', 'imbiss', 'plate', '1 Schale', POMMES, {
    missing: [KETCHUP, MAYONNAISE],
  }),
  d(
    'auswaerts-currywurst-pommes',
    'Currywurst mit Pommes',
    'imbiss',
    'plate',
    '1 Portion',
    POMMES,
    {
      missing: [BRATWURST, KETCHUP],
    },
  ),
  d(
    'auswaerts-currywurst',
    'Currywurst (ohne Beilage)',
    'imbiss',
    'piece',
    '1 Wurst mit Soße',
    [],
    {
      missing: [BRATWURST, KETCHUP],
    },
  ),
  d(
    'auswaerts-bratwurst-broetchen',
    'Bratwurst im Brötchen',
    'imbiss',
    'piece',
    '1 Stück',
    [
      ['weizenbroetchen', 60],
      ['senf', 10],
    ],
    { missing: [BRATWURST] },
  ),
  d(
    'auswaerts-doener',
    'Döner Kebab',
    'imbiss',
    'piece',
    '1 Döner im Fladenbrot',
    [['blattsalat', 30], ['tomate', 40], ['zwiebel', 20], ['rotkohl', 30], ...JOGHURTSOSSE],
    { missing: [FLADENBROT, DOENERFLEISCH] },
  ),
  d(
    'auswaerts-duerum',
    'Dürüm Döner',
    'imbiss',
    'piece',
    '1 Dürüm',
    [
      ['vollkorn-tortilla', 100],
      ['blattsalat', 30],
      ['tomate', 40],
      ['zwiebel', 20],
      ...JOGHURTSOSSE,
    ],
    { missing: [DOENERFLEISCH] },
  ),
  d(
    'auswaerts-haehnchen-duerum',
    'Hähnchen-Dürüm',
    'imbiss',
    'piece',
    '1 Dürüm',
    [
      ['vollkorn-tortilla', 100],
      ['haehnchenschenkelfilet-ohne-haut', 130],
      ['rapsoel', 12],
      ['blattsalat', 30],
      ['tomate', 40],
      ['zwiebel', 20],
      ['rotkohl', 30],
      ...JOGHURTSOSSE,
    ],
    {
      note_de:
        'Hähnchenfleisch als Schenkelfilet mit Bratfett; Fladen als Weizentortilla (Yufka ähnlich).',
    },
  ),
  d(
    'auswaerts-falafel-teller',
    'Falafel-Teller mit Hummus und Salat',
    'imbiss',
    'plate',
    '1 Teller',
    [
      ['falafel-kuehlregal', 150],
      ['hummus', 60],
      ['tomate', 60],
      ['gurke', 60],
      ['salatmix', 40],
      ...JOGHURTSOSSE,
    ],
  ),
  d('auswaerts-falafel-wrap', 'Falafel-Wrap', 'imbiss', 'piece', '1 Wrap', [
    ['vollkorn-tortilla', 80],
    ['falafel-kuehlregal', 100],
    ['hummus', 30],
    ['tomate', 40],
    ['salatmix', 25],
    ...JOGHURTSOSSE,
  ]),
  d(
    'auswaerts-gyros-teller',
    'Gyros-Teller mit Pommes und Tzatziki',
    'imbiss',
    'plate',
    '1 Teller',
    POMMES,
    {
      missing: [
        { name_de: 'Gyrosfleisch (Schweinenacken)', search_de: ['Schwein Nacken', 'Gyros'] },
      ],
    },
  ),
  d('auswaerts-frikadelle-broetchen', 'Frikadelle im Brötchen', 'imbiss', 'piece', '1 Stück', [
    ['weizenbroetchen', 60],
    ['rinderhackfleisch-5-fett', 45],
    ['hackfleisch-vom-schwein', 45],
    ['huehnerei', 10],
    ['paniermehl', 10],
    ['zwiebel', 15],
    ['rapsoel', 6],
    ['senf', 10],
  ]),
  d(
    'auswaerts-leberkaessemmel',
    'Leberkässemmel',
    'imbiss',
    'piece',
    '1 Semmel',
    [
      ['weizenbroetchen', 60],
      ['senf', 10],
    ],
    { missing: [{ name_de: 'Leberkäse', search_de: ['Leberkäse', 'Fleischkäse'] }] },
  ),
  d(
    'auswaerts-fischbroetchen',
    'Fischbrötchen (Matjes/Bismarck)',
    'imbiss',
    'piece',
    '1 Stück',
    [
      ['weizenbroetchen', 60],
      ['zwiebel', 15],
    ],
    { missing: [{ name_de: 'Matjes/Bismarckhering', search_de: ['Hering', 'Matjes'] }] },
  ),
  d('auswaerts-lachsbroetchen', 'Räucherlachs-Brötchen', 'imbiss', 'piece', '1 Stück', [
    ['weizenbroetchen', 60],
    ['raeucherlachs', 40],
    ['meerrettich-glas', 10],
    ['blattsalat', 10],
  ]),
  d(
    'auswaerts-bratkartoffeln',
    'Bratkartoffeln',
    'imbiss',
    'plate',
    '1 Portion',
    [
      ['kartoffeln', 300],
      ['zwiebel', 40],
      ['rapsoel', 20],
    ],
    { note_de: 'Ohne Speck.' },
  ),
  d(
    'auswaerts-reibekuchen-apfelmus',
    'Reibekuchen mit Apfelmus',
    'imbiss',
    'plate',
    '3 Reibekuchen',
    [
      ['kartoffeln', 250],
      ['huehnerei', 30],
      ['zwiebel', 30],
      ['speisestaerke', 10],
      ['rapsoel', 25],
      ['apfelmus-ungesuesst', 100],
    ],
  ),
  d('auswaerts-gebratene-nudeln', 'Gebratene Nudeln mit Gemüse', 'imbiss', 'plate', '1 Box', [
    ['mie-nudeln', 100],
    ['asia-gemuesemischung-tk', 150],
    ['huehnerei', 30],
    ['sojasauce', 15],
    ['rapsoel', 15],
  ]),
  d(
    'auswaerts-gebratene-nudeln-haehnchen',
    'Gebratene Nudeln mit Hähnchen',
    'imbiss',
    'plate',
    '1 Box',
    [
      ['mie-nudeln', 100],
      ['haehnchenbrustfilet', 100],
      ['asia-gemuesemischung-tk', 120],
      ['sojasauce', 15],
      ['rapsoel', 15],
    ],
  ),
  d('auswaerts-gebratener-reis', 'Gebratener Reis mit Ei und Gemüse', 'imbiss', 'plate', '1 Box', [
    ['express-reis-beutel-gegart', 250],
    ['huehnerei', 50],
    ['erbsen-tk', 40],
    ['karotte', 40],
    ['sojasauce', 15],
    ['rapsoel', 15],
  ]),
  d('auswaerts-halbes-haehnchen', 'Halbes Grillhähnchen', 'imbiss', 'piece', '½ Hähnchen', [], {
    missing: [
      {
        name_de: 'Brathähnchen mit Haut (gegart)',
        search_de: ['Brathähnchen', 'Hähnchen mit Haut'],
      },
    ],
  }),

  // ------------------------------------------------------------------ Kantine
  d(
    'auswaerts-kantine-fleisch',
    'Kantinen-Tagesgericht mit Fleisch',
    'kantine',
    'plate',
    '1 Teller (Fleisch, Beilage, Gemüse, Soße)',
    [
      ['schweineschnitzel', 150],
      ['rapsoel', 10],
      ['kartoffeln', 250],
      ['gruene-bohnen-tk', 150],
      ['kochsahne-15', 50],
      ['speisestaerke', 5],
    ],
    {
      note_de:
        'Typischer Teller: 150 g Fleisch (mager), Salzkartoffeln, Gemüse, Rahmsoße. Grobe Schätzung.',
    },
  ),
  d(
    'auswaerts-kantine-vegetarisch',
    'Kantinen-Tagesgericht vegetarisch',
    'kantine',
    'plate',
    '1 Teller (Nudeln, Gemüse, Käsesoße)',
    [
      ['vollkornnudeln', 110],
      ['zucchini', 80],
      ['paprika-rot', 70],
      ['brokkoli', 80],
      ['kochsahne-15', 60],
      ['gouda', 30],
      ['rapsoel', 8],
    ],
    { note_de: 'Typischer vegetarischer Teller; grobe Schätzung.' },
  ),
  d(
    'auswaerts-kantine-fisch',
    'Kantinen-Tagesgericht mit Fisch',
    'kantine',
    'plate',
    '1 Teller (Fisch, Kartoffeln, Gemüse, Soße)',
    [
      ['seelachsfilet-tk', 150],
      ['huehnerei', 15],
      ['paniermehl', 20],
      ['rapsoel', 15],
      ['kartoffeln', 250],
      ['erbsen-tk', 60],
      ['karotte', 80],
      ['kochsahne-15', 40],
    ],
    { note_de: 'Seelachs paniert gebraten; grobe Schätzung.' },
  ),
  d(
    'auswaerts-haehnchen-reis-gemuese',
    'Hähnchenbrust mit Reis und Gemüse',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['haehnchenbrustfilet', 150],
      ['basmatireis-trocken', 80],
      ['brokkoli', 100],
      ['karotte', 60],
      ['kochsahne-15', 40],
      ['rapsoel', 8],
    ],
  ),
  d('auswaerts-chili-con-carne', 'Chili con Carne mit Brot', 'kantine', 'plate', '1 Teller', [
    ['rinderhackfleisch-5-fett', 100],
    ['kidneybohnen-dose-abgetropft', 100],
    ['mais-dose-abgetropft', 50],
    ['gehackte-tomaten-dose', 150],
    ['paprika-rot', 50],
    ['zwiebel', 30],
    ['rapsoel', 8],
    ['weizenbroetchen', 50],
  ]),
  d('auswaerts-chili-sin-carne', 'Chili sin Carne mit Reis', 'kantine', 'plate', '1 Teller', [
    ['kidneybohnen-dose-abgetropft', 100],
    ['schwarze-bohnen-dose-abgetropft', 60],
    ['mais-dose-abgetropft', 50],
    ['gehackte-tomaten-dose', 150],
    ['paprika-rot', 60],
    ['zwiebel', 30],
    ['rapsoel', 8],
    ['basmatireis-trocken', 70],
  ]),
  d('auswaerts-gemuesecurry-reis', 'Gemüse-Curry mit Reis', 'kantine', 'plate', '1 Teller', [
    ['kichererbsen-dose-abgetropft', 80],
    ['blumenkohl', 100],
    ['karotte', 60],
    ['zucchini', 60],
    ['kokosmilch', 80],
    ['rapsoel', 8],
    ['basmatireis-trocken', 75],
  ]),
  d(
    'auswaerts-frikadelle-bratkartoffeln',
    'Frikadelle mit Bratkartoffeln',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['rinderhackfleisch-5-fett', 60],
      ['hackfleisch-vom-schwein', 60],
      ['huehnerei', 15],
      ['paniermehl', 12],
      ['zwiebel', 50],
      ['kartoffeln', 250],
      ['rapsoel', 22],
    ],
  ),
  d('auswaerts-linseneintopf', 'Linseneintopf (ohne Würstchen)', 'kantine', 'plate', '1 Teller', [
    ['linsen-dose-abgetropft', 150],
    ['kartoffeln', 100],
    ['karotte', 50],
    ['zwiebel', 30],
    ['gemuesebruehe-zubereitet', 200],
    ['rapsoel', 5],
    ['apfelessig', 5],
  ]),
  d(
    'auswaerts-linseneintopf-wurst',
    'Linseneintopf mit Würstchen',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['linsen-dose-abgetropft', 150],
      ['kartoffeln', 100],
      ['karotte', 50],
      ['zwiebel', 30],
      ['gemuesebruehe-zubereitet', 200],
    ],
    { missing: [{ name_de: 'Wiener Würstchen', search_de: ['Wiener', 'Würstchen'] }] },
  ),
  d('auswaerts-tomatensuppe', 'Tomatensuppe', 'kantine', 'plate', '1 Teller (300 ml)', [
    ['passierte-tomaten', 200],
    ['gemuesebruehe-zubereitet', 80],
    ['zwiebel', 20],
    ['kochsahne-15', 20],
    ['olivenoel', 5],
  ]),
  d('auswaerts-kartoffelsuppe', 'Kartoffelsuppe', 'kantine', 'plate', '1 Teller (300 ml)', [
    ['kartoffeln', 150],
    ['karotte', 40],
    ['zwiebel', 20],
    ['gemuesebruehe-zubereitet', 150],
    ['kochsahne-15', 20],
    ['rapsoel', 5],
  ]),
  d('auswaerts-salatbar', 'Salatbar-Teller mit Dressing', 'kantine', 'plate', '1 Teller', [
    ['salatmix', 80],
    ['tomate', 60],
    ['gurke', 60],
    ['karotte', 40],
    ['mais-dose-abgetropft', 30],
    ['kichererbsen-dose-abgetropft', 40],
    ['olivenoel', 10],
    ['balsamico-essig', 10],
  ]),
  d(
    'auswaerts-ofenkartoffel-quark',
    'Ofenkartoffel mit Kräuterquark',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['kartoffeln', 350],
      ['magerquark', 125],
      ['milch-1-5', 20],
      ['schnittlauch-frisch', 5],
      ['rapsoel', 5],
    ],
  ),
  d(
    'auswaerts-milchreis-kirschen',
    'Milchreis mit Kirschen',
    'kantine',
    'plate',
    '1 Schale',
    [
      ['milchreis-rundkornreis', 60],
      ['milch-1-5', 300],
      ['zucker', 15],
      ['sauerkirschen-glas-abgetropft', 80],
    ],
    { note_de: 'Mit fettarmer Milch; in Kantinen oft Vollmilch (dann etwas mehr).' },
  ),
  d(
    'auswaerts-pfannkuchen',
    'Pfannkuchen mit Apfelmus',
    'kantine',
    'plate',
    '2 Pfannkuchen',
    [
      ['dinkelmehl-type-630', 80],
      ['milch-1-5', 150],
      ['huehnerei', 60],
      ['rapsoel', 10],
      ['apfelmus-ungesuesst', 100],
      ['zucker', 5],
    ],
    { note_de: 'Mehl als Dinkelmehl 630 (Katalog; Weizenmehl fehlt noch).' },
  ),
  d(
    'auswaerts-seelachs-kartoffelsalat',
    'Paniertes Seelachsfilet mit Kartoffelsalat',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['seelachsfilet-tk', 150],
      ['huehnerei', 15],
      ['paniermehl', 20],
      ['rapsoel', 25],
      ['kartoffeln', 250],
      ['zwiebel', 20],
      ['gemuesebruehe-zubereitet', 60],
      ['apfelessig', 10],
    ],
  ),
  d(
    'auswaerts-gulasch-nudeln',
    'Rindergulasch mit Nudeln',
    'kantine',
    'plate',
    '1 Teller',
    [
      ['eierspaetzle-getrocknet', 100],
      ['zwiebel', 60],
      ['paprika-rot', 40],
      ['tomatenmark', 15],
      ['rapsoel', 10],
    ],
    {
      missing: [
        {
          name_de: 'Rindfleisch Gulasch (Schulter/Wade)',
          search_de: ['Rind Schulter', 'Rind Gulasch', 'Rind Wade'],
        },
      ],
    },
  ),
  d(
    'auswaerts-schweinebraten-knoedel',
    'Schweinebraten mit Knödel',
    'kantine',
    'plate',
    '1 Teller',
    [],
    {
      missing: [
        {
          name_de: 'Schweinebraten (Schulter/Nacken)',
          search_de: ['Schwein Schulter', 'Schwein Nacken'],
        },
        { name_de: 'Kartoffel- oder Semmelknödel', search_de: ['Knödel', 'Kloß'] },
      ],
    },
  ),
  d(
    'auswaerts-maultaschen',
    'Maultaschen in Brühe',
    'kantine',
    'plate',
    '3 Maultaschen',
    [['gemuesebruehe-zubereitet', 250]],
    { missing: [{ name_de: 'Maultaschen', search_de: ['Maultasche'] }] },
  ),

  // ------------------------------------------------------------------ Bäckerei
  d('auswaerts-laugenbrezel', 'Laugenbrezel', 'baeckerei', 'piece', '1 Brezel (ca. 80 g)', [
    ['laugenbrezel', 80],
  ]),
  d(
    'auswaerts-butterbrezel',
    'Butterbrezel',
    'baeckerei',
    'piece',
    '1 Brezel',
    [['laugenbrezel', 80]],
    { missing: [BUTTER] },
  ),
  d(
    'auswaerts-broetchen',
    'Brötchen (Weizen), pur',
    'baeckerei',
    'piece',
    '1 Brötchen (ca. 60 g)',
    [['weizenbroetchen', 60]],
  ),
  d(
    'auswaerts-vollkornbroetchen',
    'Vollkornbrötchen, pur',
    'baeckerei',
    'piece',
    '1 Brötchen (ca. 70 g)',
    [['vollkornbroetchen', 70]],
  ),
  d(
    'auswaerts-kaesebroetchen',
    'Käsebrötchen',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['weizenbroetchen', 60],
      ['gouda', 30],
      ['blattsalat', 10],
    ],
    { missing: [BUTTER] },
  ),
  d(
    'auswaerts-schinkenbroetchen',
    'Schinkenbrötchen',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['weizenbroetchen', 60],
      ['kochschinken', 30],
      ['blattsalat', 10],
    ],
    { missing: [BUTTER] },
  ),
  d(
    'auswaerts-putenbrust-vollkorn',
    'Vollkornbrötchen mit Putenbrust und Frischkäse',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['vollkornbroetchen', 70],
      ['frischkaese-light', 20],
      ['putenbrust-aufschnitt', 30],
      ['gurke', 20],
      ['blattsalat', 10],
    ],
  ),
  d(
    'auswaerts-mettbroetchen',
    'Mettbrötchen',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['weizenbroetchen', 60],
      ['zwiebel', 10],
    ],
    { missing: [{ name_de: 'Schweinemett (Hackepeter)', search_de: ['Mett', 'Hackepeter'] }] },
  ),
  d('auswaerts-croissant', 'Croissant', 'baeckerei', 'piece', '1 Stück', [], {
    missing: [PLUNDERTEIG],
  }),
  d('auswaerts-laugencroissant', 'Laugencroissant', 'baeckerei', 'piece', '1 Stück', [], {
    missing: [PLUNDERTEIG],
  }),
  d('auswaerts-franzbroetchen', 'Franzbrötchen', 'baeckerei', 'piece', '1 Stück', [], {
    missing: [PLUNDERTEIG],
  }),
  d('auswaerts-berliner', 'Berliner / Krapfen', 'baeckerei', 'piece', '1 Stück', [], {
    missing: [HEFETEIG_SUESS],
  }),
  d('auswaerts-streuselkuchen', 'Streuselkuchen', 'baeckerei', 'piece', '1 Stück', [], {
    missing: [HEFETEIG_SUESS, BUTTER],
  }),
  d(
    'auswaerts-kaesekuchen',
    'Käsekuchen',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['magerquark', 100],
      ['huehnerei', 25],
      ['zucker', 25],
      ['speisestaerke', 8],
    ],
    { missing: [WEIZENMEHL, BUTTER] },
  ),
  d(
    'auswaerts-apfelkuchen',
    'Apfelkuchen',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['apfel', 80],
      ['zucker', 20],
      ['huehnerei', 15],
    ],
    { missing: [WEIZENMEHL, BUTTER] },
  ),
  d(
    'auswaerts-laugenstange-kaese',
    'Laugenstange mit Käse überbacken',
    'baeckerei',
    'piece',
    '1 Stück',
    [
      ['laugenbrezel', 80],
      ['gouda', 25],
    ],
  ),
  d('auswaerts-toast-hawaii', 'Toast Hawaii', 'baeckerei', 'piece', '1 Stück', [
    ['toastbrot-weizen', 30],
    ['kochschinken', 25],
    ['ananas-dose-abgetropft', 35],
    ['gouda', 25],
  ]),

  // ------------------------------------------------------------------ Café
  d('auswaerts-espresso', 'Espresso', 'cafe', 'drink', '1 Tasse (30 ml)', [
    ['espresso-zubereitet', 30],
  ]),
  d('auswaerts-cappuccino', 'Cappuccino (fettarme Milch)', 'cafe', 'drink', '1 Tasse (0,2 l)', [
    ['espresso-zubereitet', 30],
    ['milch-1-5', 150],
  ]),
  d(
    'auswaerts-cappuccino-vollmilch',
    'Cappuccino (Vollmilch)',
    'cafe',
    'drink',
    '1 Tasse (0,2 l)',
    [['espresso-zubereitet', 30]],
    { missing: [VOLLMILCH] },
  ),
  d(
    'auswaerts-latte-macchiato',
    'Latte Macchiato (fettarme Milch)',
    'cafe',
    'drink',
    '1 Glas (0,3 l)',
    [
      ['espresso-zubereitet', 30],
      ['milch-1-5', 250],
    ],
  ),
  d(
    'auswaerts-latte-macchiato-vollmilch',
    'Latte Macchiato (Vollmilch)',
    'cafe',
    'drink',
    '1 Glas (0,3 l)',
    [['espresso-zubereitet', 30]],
    { missing: [VOLLMILCH] },
  ),
  d(
    'auswaerts-milchkaffee',
    'Milchkaffee (fettarme Milch)',
    'cafe',
    'drink',
    '1 Tasse (0,3 l)',
    [
      ['espresso-zubereitet', 60],
      ['milch-1-5', 200],
    ],
    { note_de: 'Kaffee als Espresso (Katalog), Filterkaffee hat praktisch dieselben Werte.' },
  ),
  d(
    'auswaerts-cappuccino-soja',
    'Cappuccino mit Sojadrink',
    'cafe',
    'drink',
    '1 Tasse (0,2 l)',
    [
      ['espresso-zubereitet', 30],
      ['sojadrink-ungesuesst', 150],
    ],
    { note_de: 'Café-Sojadrinks sind oft gesüßt (dann mehr Zucker).' },
  ),
  d(
    'auswaerts-kakao',
    'Heiße Schokolade',
    'cafe',
    'drink',
    '1 Tasse (0,25 l)',
    [
      ['milch-1-5', 250],
      ['kakaopulver-stark-entoelt', 10],
      ['zucker', 15],
    ],
    { note_de: 'Mit fettarmer Milch, ohne Sahnehaube.' },
  ),
  d(
    'auswaerts-kakao-sahne',
    'Heiße Schokolade mit Sahne',
    'cafe',
    'drink',
    '1 Tasse (0,25 l)',
    [
      ['milch-1-5', 250],
      ['kakaopulver-stark-entoelt', 10],
      ['zucker', 15],
    ],
    { missing: [SAHNE] },
  ),
  d(
    'auswaerts-chai-latte',
    'Chai Latte',
    'cafe',
    'drink',
    '1 Tasse (0,3 l)',
    [['milch-1-5', 250]],
    {
      missing: [{ name_de: 'Chai-Sirup/-Pulver', search_de: ['Chai'] }],
    },
  ),
  d('auswaerts-orangensaft', 'Orangensaft', 'cafe', 'drink', '1 Glas (0,2 l)', [
    ['orangensaft', 200],
  ]),
  d(
    'auswaerts-apfelschorle',
    'Apfelschorle',
    'cafe',
    'drink',
    '1 Glas (0,4 l)',
    [['wasser', 200]],
    {
      missing: [APFELSAFT],
    },
  ),
  d('auswaerts-smoothie', 'Bananen-Beeren-Smoothie', 'cafe', 'drink', '1 Becher (0,3 l)', [
    ['banane', 120],
    ['beeren-mischung-tk', 100],
    ['orangensaft', 100],
  ]),
  d('auswaerts-bircher-muesli', 'Bircher Müsli', 'cafe', 'plate', '1 Schale', [
    ['haferflocken', 50],
    ['milch-1-5', 100],
    ['joghurt-1-5', 50],
    ['apfel', 80],
    ['honig', 10],
    ['mandeln', 10],
  ]),
  d(
    'auswaerts-ruehrei-brot',
    'Rührei mit Brot',
    'cafe',
    'plate',
    '1 Teller (3 Eier)',
    [
      ['huehnerei', 165],
      ['rapsoel', 8],
      ['vollkornbrot', 60],
      ['schnittlauch-frisch', 3],
      ['tomate', 50],
    ],
    { note_de: 'In Öl gebraten (mit Butter etwas mehr).' },
  ),
  d('auswaerts-avocado-brot', 'Avocado-Brot', 'cafe', 'plate', '2 Scheiben', [
    ['vollkornbrot', 100],
    ['avocado', 80],
    ['tomate', 50],
    ['zitronensaft', 5],
  ]),
  d(
    'auswaerts-fruehstueck-kontinental',
    'Frühstück „Kontinental“ (Brötchen, Käse, Konfitüre)',
    'cafe',
    'plate',
    '1 Teller',
    [
      ['weizenbroetchen', 120],
      ['gouda', 30],
      ['erdbeerkonfituere', 25],
    ],
    { missing: [BUTTER] },
  ),
  d(
    'auswaerts-croque',
    'Croque Monsieur',
    'cafe',
    'piece',
    '1 Stück',
    [
      ['toastbrot-weizen', 60],
      ['kochschinken', 30],
      ['gouda', 30],
    ],
    { missing: [BUTTER, VOLLMILCH] },
  ),

  // ------------------------------------------------------------------ Fast Food
  d(
    'auswaerts-hamburger',
    'Hamburger',
    'fastfood',
    'piece',
    '1 Stück',
    [
      ['zwiebel', 10],
      ['gurke', 10],
      ['senf', 5],
    ],
    { missing: [BURGERBROT, RINDERHACK_20, KETCHUP] },
  ),
  d(
    'auswaerts-cheeseburger',
    'Cheeseburger',
    'fastfood',
    'piece',
    '1 Stück',
    [
      ['zwiebel', 10],
      ['gurke', 10],
      ['senf', 5],
    ],
    { missing: [BURGERBROT, RINDERHACK_20, KETCHUP, SCHMELZKAESE] },
  ),
  d(
    'auswaerts-big-burger',
    'Großer Burger (doppelt, mit Soße)',
    'fastfood',
    'piece',
    '1 Stück',
    [
      ['blattsalat', 20],
      ['zwiebel', 10],
      ['gurke', 15],
    ],
    { missing: [BURGERBROT, RINDERHACK_20, SCHMELZKAESE, MAYONNAISE] },
  ),
  d('auswaerts-chicken-nuggets', 'Chicken Nuggets', 'fastfood', 'piece', '6 Stück', [], {
    missing: [
      {
        name_de: 'Hähnchen-Nuggets (paniert, frittiert)',
        search_de: ['Nuggets', 'Hähnchen paniert'],
      },
    ],
  }),
  d(
    'auswaerts-fastfood-pommes',
    'Pommes (Fast Food)',
    'fastfood',
    'plate',
    'mittlere Portion (ca. 115 g)',
    [
      ['kartoffeln', 190],
      ['rapsoel', 16],
      ['salz', 1],
    ],
    { note_de: 'Gleiche Annahme wie Imbiss-Pommes; klein/mittel/groß über die Größe.' },
  ),
  d(
    'auswaerts-chicken-wrap',
    'Chicken-Wrap (gegrillt)',
    'fastfood',
    'piece',
    '1 Wrap',
    [
      ['vollkorn-tortilla', 70],
      ['haehnchenbrustfilet', 80],
      ['rapsoel', 5],
      ['blattsalat', 20],
      ['tomate', 30],
      ['gouda', 15],
      ...JOGHURTSOSSE,
    ],
    { note_de: 'Soße als Joghurtsoße; mit Mayonnaise-Soße deutlich mehr.' },
  ),
  d(
    'auswaerts-hot-dog',
    'Hot Dog',
    'fastfood',
    'piece',
    '1 Stück',
    [
      ['zwiebel', 15],
      ['senf', 10],
    ],
    {
      missing: [
        { name_de: 'Hot-Dog-Brötchen', search_de: ['Hot Dog'] },
        { name_de: 'Wiener Würstchen', search_de: ['Wiener', 'Würstchen'] },
        KETCHUP,
      ],
    },
  ),
  d(
    'auswaerts-milchshake',
    'Milchshake Vanille',
    'fastfood',
    'drink',
    '1 Becher (0,3 l)',
    [['milch-1-5', 200]],
    { missing: [VANILLEEIS] },
  ),
  d('auswaerts-cola', 'Cola', 'fastfood', 'drink', '1 Becher (0,4 l)', [], { missing: [COLA] }),
  d('auswaerts-salat-bowl-haehnchen', 'Salat-Bowl mit Hähnchen', 'fastfood', 'plate', '1 Bowl', [
    ['salatmix', 80],
    ['haehnchenbrustfilet', 100],
    ['express-reis-beutel-gegart', 100],
    ['mais-dose-abgetropft', 30],
    ['tomate', 50],
    ['gurke', 50],
    ['olivenoel', 10],
    ['zitronensaft', 10],
  ]),
];
