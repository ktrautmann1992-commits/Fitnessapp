import type { SourceFoodCategory } from '../content/food-schema';
import { SOURCE_FOOD_CATEGORIES } from '../content/food-schema';

/**
 * Freies Eintragen (Gründer-Rückmeldung Testphase 14.11.2026, docs/PLAN-ESSEN-FREI-EINTRAGEN.md): die EINE Stelle für
 * - Suchbegriffe je Lebensmittel-Art („Käse“ findet Gouda, Emmentaler, Mozzarella …; „Brot“ alle Brote) und
 * - Haushaltsmengen („1 Scheibe“, „1 Handvoll“, „1 Glas“) in Gramm.
 *
 * Warum hier und nicht in content/foods: Der Lebensmittel-Katalog (content/foods, content/sources) ist geschützt – nur
 * der Workflow foods-import darf ihn ändern (Job sources-integrity). Diese Tabelle ist reine App-Logik über dem
 * Katalog: Sie ändert keinen Nährwert, sie rechnet nur „2 Scheiben“ in Gramm um. Gespeichert wird im Tagebuch immer
 * die Grammzahl (Einheit `g`) – Server und Datenbank bleiben unverändert und rechnen wie bisher nach.
 *
 * Quellen der Grammwerte (gerundete Richtwerte, PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN):
 * - BZfE „Lebensmittel-Portionsgrößen“ bzw. DGE-Ernährungskreis (1 Scheibe Brot ≈ 45–50 g, 1 Scheibe Käse ≈ 25–30 g,
 *   1 Handvoll Nüsse ≈ 25 g, 1 Glas Milch/Saft = 200 ml),
 * - Portionsangaben auf Verpackungen im deutschen Handel 2026 (Frühstücksflocken 30 g je Portion/Schale, Toast 25 g je
 *   Scheibe, Joghurt-Becher 150 g, Quark-Becher 250 g),
 * - Stückgewichte wie in der Einkaufsliste (`SHOPPING_BUY_UNITS`, „1 Banane (120 g)“) – dort nicht doppelt gepflegt.
 * Flüssigkeiten: 1 ml ≈ 1 g (Abweichung bei Milch ~3 % – unter der Genauigkeit einer Haushaltsmenge).
 */

/** Haushaltseinheiten beim Eintragen (zusätzlich zu Gramm). Reihenfolge = Anzeige-Reihenfolge, wenn nichts anderes gilt. */
export const HOUSEHOLD_UNITS = [
  'slice',
  'piece',
  'handful',
  'bowl',
  'glass',
  'cup',
  'tbsp',
  'tsp',
  'portion',
] as const;
export type HouseholdUnit = (typeof HOUSEHOLD_UNITS)[number];

/** Anzeige: Einzahl / Mehrzahl. */
export const HOUSEHOLD_UNIT_LABELS_DE: Readonly<
  Record<HouseholdUnit, { readonly one: string; readonly many: string }>
> = {
  slice: { one: 'Scheibe', many: 'Scheiben' },
  piece: { one: 'Stück', many: 'Stück' },
  handful: { one: 'Handvoll', many: 'Handvoll' },
  bowl: { one: 'Schale', many: 'Schalen' },
  glass: { one: 'Glas', many: 'Gläser' },
  cup: { one: 'Becher', many: 'Becher' },
  tbsp: { one: 'EL', many: 'EL' },
  tsp: { one: 'TL', many: 'TL' },
  portion: { one: 'Portion', many: 'Portionen' },
};

/** Eine Haushaltsmenge eines Lebensmittels: Einheit und Gramm je Einheit. */
export interface HouseholdUnitGrams {
  readonly unit: HouseholdUnit;
  readonly grams: number;
}

const u = (unit: HouseholdUnit, grams: number): HouseholdUnitGrams => ({ unit, grams });

/**
 * Lebensmittel-Art für Suche und Haushaltsmengen. Mitglied ist ein Lebensmittel, wenn
 * - seine id in `ids` steht, ODER
 * - seine Quell-Kategorie (`source.category`) in `categories` steht und – falls `nameWords` gesetzt – sein Name eines
 *   der Wörter enthält (normalisiert, ä = ae, ohne Groß-/Kleinschreibung),
 * und es nicht in `excludeIds` steht.
 */
export interface FoodKeywordGroup {
  readonly id: string;
  /** Suchwörter (Deutsch, normalisiert verglichen): „käse“ findet alle Mitglieder. */
  readonly terms: readonly string[];
  readonly categories?: readonly SourceFoodCategory[];
  readonly nameWords?: readonly string[];
  readonly ids?: readonly string[];
  readonly excludeIds?: readonly string[];
  /** Wortstamm für den Namensvorschlag „<Stamm>brot“ (Käsebrot, Wurstbrot). */
  readonly breadStem?: string;
  /** Namensvorschlag, wenn die Mahlzeit eine Bowl aus dieser Grundlage ist (mindestens 3 Zutaten). */
  readonly bowlName?: string;
  /** true = die Art ist selbst Brot (Grundlage für „Käsebrot“). */
  readonly isBread?: boolean;
  /** Übliche Haushaltsmengen der Art (Standard; einzelne Lebensmittel überschreiben sie unten). */
  readonly units: readonly HouseholdUnitGrams[];
}

export const FOOD_KEYWORD_GROUPS: readonly FoodKeywordGroup[] = [
  {
    id: 'cheese',
    terms: ['käse', 'kaese'],
    categories: ['dairy', 'other'],
    nameWords: [
      'kaese',
      'gouda',
      'emmentaler',
      'mozzarella',
      'feta',
      'parmesan',
      'halloumi',
      'ricotta',
      'camembert',
      'cheddar',
      'edamer',
      'mascarpone',
    ],
    breadStem: 'Käse',
    // 1 Scheibe Schnittkäse ≈ 25 g (BZfE-Portionsgröße 25–30 g, Packungsscheiben 20–25 g).
    units: [u('slice', 25)],
  },
  {
    id: 'bread',
    terms: ['brot', 'brötchen', 'semmel', 'schrippe', 'toast', 'backwaren'],
    categories: ['bread_bakery', 'cereal_products'],
    nameWords: [
      'brot',
      'broetchen',
      'toast',
      'brezel',
      'knaecke',
      'wrap',
      'tortilla',
      'zwieback',
      'baguette',
      'semmel',
    ],
    isBread: true,
    // 1 Scheibe Brot ≈ 45 g (BZfE/DGE: 1 Scheibe 45–50 g).
    units: [u('slice', 45)],
  },
  {
    id: 'sausage',
    terms: ['wurst', 'aufschnitt', 'schinken'],
    categories: ['sausage_meat_products'],
    ids: ['haehnchenbrust-aufschnitt', 'putenbrust-aufschnitt', 'putenbrustaufschnitt'],
    breadStem: 'Wurst',
    // 1 Scheibe Aufschnitt ≈ 15 g (Packungen 100 g mit 6–8 Scheiben).
    units: [u('slice', 15)],
  },
  {
    id: 'milk',
    terms: ['milch', 'drink'],
    ids: ['milch-1-5', 'vollmilch-3-5', 'sojadrink-ungesuesst', 'mandeldrink-ungesuesst'],
    // 1 Glas = 200 ml (DGE-Portion Milch), 1 Becher (Kaffeebecher) = 250 ml, 1 EL = 15 ml.
    units: [u('glass', 200), u('cup', 250), u('tbsp', 15)],
  },
  {
    id: 'yogurt',
    terms: ['joghurt', 'quark', 'skyr'],
    bowlName: 'Joghurt-Bowl',
    ids: ['joghurt-1-5', 'magerquark', 'skyr-natur', 'sojajoghurt-natur', 'sojaskyr-natur'],
    // 1 Becher Joghurt = 150 g (Handelsgröße), 1 EL ≈ 15 g.
    units: [u('cup', 150), u('tbsp', 15)],
  },
  {
    id: 'cereal',
    terms: ['müsli', 'flocken', 'cerealien', 'frühstück'],
    ids: ['cornflakes-ungezuckert', 'haferflocken', 'haferkleie'],
    // 1 Schale = 1 Portion laut Packung (30 g bei Cornflakes; Haferflocken s. u.), 1 EL Flocken ≈ 8 g.
    units: [u('handful', 20), u('bowl', 30), u('tbsp', 8)],
  },
  {
    id: 'fruit',
    terms: ['obst', 'früchte', 'frucht'],
    categories: ['fruit'],
    excludeIds: ['limettensaft', 'zitronensaft', 'zitronenschale-bio-abgerieben'],
    // 1 Handvoll Beeren/kleines Obst ≈ 100 g (DGE: „eine Hand voll“ als Portion Obst).
    units: [u('handful', 100)],
  },
  {
    id: 'vegetables',
    terms: ['gemüse', 'salat'],
    categories: ['vegetables', 'mushrooms'],
    // 1 Handvoll Gemüse/Salat ≈ 80 g (DGE: Portion „eine Hand voll“).
    units: [u('handful', 80)],
  },
  {
    id: 'nuts',
    terms: ['nüsse', 'nuss', 'kerne', 'samen'],
    categories: ['nuts_seeds'],
    excludeIds: [
      'mandeldrink-ungesuesst',
      'kokosmilch',
      'kokosmilch-fettreduziert',
      'tahin',
      'erdnussmus',
    ],
    // 1 Handvoll Nüsse ≈ 25 g (DGE-Empfehlung „eine Handvoll, etwa 25 g“), 1 EL Samen ≈ 10 g.
    units: [u('handful', 25), u('tbsp', 10)],
  },
  {
    id: 'spread',
    terms: ['aufstrich', 'marmelade', 'konfitüre'],
    ids: ['erdbeerkonfituere', 'honig', 'erdnussmus', 'butter', 'hummus', 'frischkaese-light'],
    // 1 TL Konfitüre/Honig ≈ 10 g, 1 EL ≈ 20 g (Portionspackungen 20–25 g).
    units: [u('tsp', 10), u('tbsp', 20)],
  },
  {
    id: 'sweets',
    terms: ['süßes', 'süßigkeiten', 'schokolade', 'kuchen', 'kekse', 'gebäck'],
    categories: ['pastries_sweets', 'sugar_sweets'],
    units: [],
  },
  {
    id: 'meat',
    terms: ['fleisch'],
    categories: ['meat_beef_veal', 'meat_pork', 'meat_lamb', 'meat_poultry', 'meat_game'],
    units: [],
  },
  {
    id: 'fish',
    terms: ['fisch', 'meeresfrüchte'],
    categories: ['fish', 'crustaceans_molluscs'],
    units: [],
  },
  {
    id: 'pasta',
    terms: ['nudeln', 'pasta'],
    categories: ['cereal_products'],
    nameWords: ['nudel', 'spaghetti', 'makkaroni', 'lasagne', 'spaetzle'],
    units: [],
  },
  {
    id: 'rice',
    terms: ['reis'],
    categories: ['cereal_products'],
    nameWords: ['reis'],
    excludeIds: ['reiswaffeln', 'reisnudeln-trocken', 'reisessig'],
    units: [],
  },
  {
    id: 'drinks',
    terms: ['getränke', 'saft', 'trinken'],
    categories: ['beverages'],
    excludeIds: ['eiswuerfel'],
    // 1 Glas = 200 ml, 1 Becher (Kaffee/Tee) = 250 ml.
    units: [u('glass', 200), u('cup', 250)],
  },
];

/**
 * Haushaltsmengen einzelner Lebensmittel (ersetzen bzw. ergänzen die Standardwerte ihrer Art; zuerst genannte Einheit
 * = Vorauswahl). Stückgewichte ohne Eintrag hier kommen aus der Einkaufsliste (`SHOPPING_BUY_UNITS`) bzw. aus den
 * Einheiten des Katalogs (`units.piece_g`, `tbsp_g`, `tsp_g` – sie haben immer Vorrang).
 */
export const HOUSEHOLD_UNITS_BY_FOOD: Readonly<Record<string, readonly HouseholdUnitGrams[]>> = {
  // Brot & Backwaren – Toast 25 g je Scheibe (Packungsangabe 500 g / 20 Scheiben).
  'toastbrot-weizen': [u('slice', 25)],
  vollkorntoast: [u('slice', 28)],
  vollkornbrot: [u('slice', 45)],
  knaeckebrot: [u('slice', 10)],
  'vollkorn-knaeckebrot': [u('slice', 12)],
  zwieback: [u('piece', 10)],
  reiswaffeln: [u('piece', 8)],
  'vollkorn-wrap': [u('piece', 62)],
  'vollkorn-tortilla': [u('piece', 40)],
  'hot-dog-broetchen': [u('piece', 60)],
  burgerbroetchen: [u('piece', 75)],
  fladenbrot: [u('slice', 80), u('piece', 400)],
  // Käse – Mozzarella-Kugel 125 g, geriebener Käse: 1 EL ≈ 7 g / 1 Handvoll ≈ 30 g, Feta-Würfel ≈ 1 EL = 15 g.
  mozzarella: [u('piece', 125), u('slice', 25)],
  'mozzarella-light': [u('piece', 125), u('slice', 25)],
  'gouda-light-gerieben': [u('handful', 30), u('tbsp', 7)],
  'veganer-reibekaese': [u('handful', 30), u('tbsp', 7)],
  parmesan: [u('tbsp', 5), u('slice', 10)],
  feta: [u('slice', 30), u('tbsp', 15)],
  'schmelzkaese-scheiben': [u('slice', 20)],
  huettenkaese: [u('cup', 200), u('tbsp', 30)],
  'frischkaese-light': [u('tbsp', 20), u('tsp', 10)],
  'harzer-kaese': [u('piece', 25), u('slice', 25)],
  // Aufstriche – Butter für eine Scheibe Brot ≈ 5 g (1 TL), 1 EL ≈ 10 g.
  butter: [u('tsp', 5), u('tbsp', 10)],
  honig: [u('tsp', 10), u('tbsp', 20)],
  erdnussmus: [u('tsp', 8), u('tbsp', 15)],
  // Frühstücksflocken – Cornflakes sind leicht: 1 Handvoll ≈ 15 g, 1 Schale = 30 g (Packungsportion).
  'cornflakes-ungezuckert': [u('handful', 15), u('bowl', 30)],
  haferflocken: [u('tbsp', 8), u('handful', 25), u('bowl', 50)],
  // Joghurt/Quark – Quark-Becher 250 g, Skyr-Becher 150 g.
  magerquark: [u('cup', 250), u('tbsp', 20)],
  'skyr-natur': [u('cup', 150), u('tbsp', 20)],
  // Eier – 1 Ei (M) ≈ 60 g (wie Einkaufsliste).
  huehnerei: [u('piece', 60)],
  // Obst – Beeren als Handvoll (≈ 100 g), Trockenobst 1 Handvoll ≈ 30 g.
  rosinen: [u('handful', 30), u('tbsp', 10)],
  'datteln-getrocknet-entsteint': [u('piece', 8), u('handful', 30)],
  // Getränke – 1 Tasse Espresso ≈ 30 ml, Tee/Kaffee als Becher 250 ml.
  'espresso-zubereitet': [u('cup', 30)],
  // Nüsse/Samen – Kerne, die man löffelt.
  chiasamen: [u('tbsp', 10), u('tsp', 4)],
  'leinsamen-geschrotet': [u('tbsp', 10), u('tsp', 4)],
  // Öl – 1 EL ≈ 10 g, 1 TL ≈ 4 g (Dichte ≈ 0,92).
  olivenoel: [u('tbsp', 10), u('tsp', 4)],
  rapsoel: [u('tbsp', 10), u('tsp', 4)],
  // Süßes – 1 Stück Schokolade (Rippe) ≈ 5 g, 1 Keks ≈ 5 g.
  'zartbitterschokolade-70': [u('piece', 5)],
  butterkekse: [u('piece', 5)],
  zucker: [u('tsp', 4), u('tbsp', 12)],
  // Rückfall der Kategorie passt hier nicht (Mehl/Stärke/Paniermehl löffelt man, Eiswürfel zählt man).
  speisestaerke: [u('tbsp', 10), u('tsp', 3)],
  paniermehl: [u('tbsp', 10)],
  panko: [u('tbsp', 5)],
  backpulver: [u('tsp', 4)],
  eiswuerfel: [u('piece', 25)],
  salz: [u('tsp', 5)],
  // Obst: Stückgewichte essbar (BZfE), wo die Einkaufsliste keines hat.
  erdbeeren: [u('handful', 100), u('piece', 15)],
  heidelbeeren: [u('handful', 80)],
  wassermelone: [u('slice', 300)],
  honigmelone: [u('slice', 200)],
  // Bowl-Zutaten: Haferflocken 1 EL ≈ 8 g (s. o.), Kokosraspeln 1 EL ≈ 5 g.
  kokosraspeln: [u('tbsp', 5)],
  // Fleisch/Fisch: 1 Stück Filet ≈ 125–150 g.
  haehnchenbrustfilet: [u('piece', 150), u('portion', 125)],
  lachsfilet: [u('piece', 125)],
  kartoffeln: [u('piece', 80), u('portion', 200)],
};

/** Wortstamm einzelner Beläge für den Namensvorschlag („Butterbrot“, „Marmeladenbrot“, „Honigbrot“). */
export const BREAD_STEM_BY_FOOD: Readonly<Record<string, string>> = {
  butter: 'Butter',
  erdbeerkonfituere: 'Marmeladen',
  honig: 'Honig',
  erdnussmus: 'Erdnussbutter',
  hummus: 'Hummus',
  margarine: 'Margarine',
  marmelade: 'Marmeladen',
  leberwurst: 'Leberwurst',
  'nuss-nougat-creme': 'Nougat',
};

/**
 * Ersatz für Alltags-Lebensmittel, die im Katalog noch fehlen (Gründer-Klarstellung 14.11.2026: Richtwerte sind
 * ausdrücklich in Ordnung). Die Suche findet sie unter ihrem eigenen Namen („Emmentaler“); eingetragen wird das
 * ähnlichste vorhandene Katalog-Lebensmittel (`base`, Nährwerte je 100 g von dort) mit dem Titel „Emmentaler (≈ Gouda)“.
 * Sobald der Katalog die echte ID hat, entfällt der Ersatz automatisch. Die echte Ergänzung läuft über `foods-import`
 * (docs/FEHLENDE-LEBENSMITTEL.md). Wahl des Ersatzes: gleiche Art, Energie je 100 g möglichst nah (Größenordnung laut
 * BLS) – PRODUKTENTSCHEIDUNG, vor Livegang fachlich prüfen.
 */
export interface FoodStandIn {
  readonly id: string;
  readonly name_de: string;
  readonly aliases_de: readonly string[];
  /** Vorhandenes Katalog-Lebensmittel, dessen Werte gelten. */
  readonly base: string;
}

const standIn = (
  id: string,
  name_de: string,
  base: string,
  aliases_de: readonly string[] = [],
): FoodStandIn => ({ id, name_de, base, aliases_de });

export const FOOD_STAND_INS: readonly FoodStandIn[] = [
  // Schnittkäse ≈ Gouda (alle etwa 330–380 kcal/100 g).
  standIn('emmentaler', 'Emmentaler', 'gouda'),
  standIn('bergkaese', 'Bergkäse', 'gouda'),
  standIn('butterkaese', 'Butterkäse', 'gouda'),
  standIn('tilsiter', 'Tilsiter', 'gouda'),
  standIn('edamer', 'Edamer', 'gouda'),
  standIn('camembert', 'Camembert', 'gouda', ['Brie']),
  // Brote ≈ Vollkornbrot (Misch-/Roggen-/Dinkelbrot etwa 200–240 kcal/100 g), Baguette ≈ Brötchen.
  standIn('mischbrot', 'Mischbrot', 'vollkornbrot', ['Graubrot', 'Bauernbrot']),
  standIn('roggenbrot', 'Roggenbrot', 'vollkornbrot'),
  standIn('dinkelbrot', 'Dinkelbrot', 'vollkornbrot'),
  standIn('baguette', 'Baguette', 'weizenbroetchen'),
  // Frühstück und Aufstriche.
  standIn('muesli', 'Müsli', 'haferflocken', ['Früchtemüsli']),
  standIn('margarine', 'Margarine', 'butter'),
  standIn('marmelade', 'Marmelade', 'erdbeerkonfituere', ['Kirschkonfitüre', 'Aprikosenkonfitüre']),
  standIn('nuss-nougat-creme', 'Nuss-Nougat-Creme', 'zartbitterschokolade-70', ['Schokocreme']),
  // Milchprodukte.
  standIn('joghurt-3-5', 'Joghurt 3,5 %', 'joghurt-1-5', ['Vollmilchjoghurt']),
  // Obst ≈ Apfel (etwa 45–70 kcal/100 g).
  standIn('birne', 'Birne', 'apfel'),
  standIn('orange', 'Orange', 'apfel', ['Apfelsine']),
  standIn('mandarine', 'Mandarine', 'apfel', ['Clementine']),
  standIn('kiwi', 'Kiwi', 'apfel'),
  standIn('weintrauben', 'Weintrauben', 'apfel', ['Trauben']),
  standIn('pflaume', 'Pflaume', 'apfel', ['Zwetschge']),
  // Wurst, Nüsse, Süßes.
  standIn('leberwurst', 'Leberwurst', 'salami'),
  standIn('fleischwurst', 'Fleischwurst', 'wiener-wuerstchen', ['Lyoner']),
  standIn('erdnuesse', 'Erdnüsse', 'mandeln'),
  standIn('haselnuesse', 'Haselnüsse', 'mandeln'),
  standIn('vollmilchschokolade', 'Vollmilchschokolade', 'zartbitterschokolade-70', [
    'Milchschokolade',
  ]),
];

/** Haushaltsmengen der Ersatz-Lebensmittel (sonst gelten die Standards ihrer Art). */
export const HOUSEHOLD_UNITS_BY_STAND_IN: Readonly<Record<string, readonly HouseholdUnitGrams[]>> =
  {
    camembert: [u('slice', 30), u('piece', 125)],
    baguette: [u('slice', 30), u('piece', 250)],
    muesli: [u('bowl', 50), u('handful', 25), u('tbsp', 10)],
    margarine: [u('tsp', 5), u('tbsp', 10)],
    marmelade: [u('tsp', 10), u('tbsp', 20)],
    'nuss-nougat-creme': [u('tsp', 10), u('tbsp', 20)],
    'joghurt-3-5': [u('cup', 150), u('tbsp', 15)],
    // Stückgewichte essbar (BZfE): Birne/Orange 150 g, Mandarine 60 g, Kiwi 75 g, Pflaume 30 g.
    birne: [u('piece', 150)],
    orange: [u('piece', 150)],
    mandarine: [u('piece', 60)],
    kiwi: [u('piece', 75)],
    pflaume: [u('piece', 30), u('handful', 100)],
    weintrauben: [u('handful', 80)],
    leberwurst: [u('tsp', 10), u('tbsp', 20)],
    fleischwurst: [u('slice', 15)],
    vollmilchschokolade: [u('piece', 5)],
  };

/**
 * Rückfall je Quell-Kategorie (Gründer-Vorgabe 14.11.2026: JEDES Lebensmittel hat mindestens eine Haushaltsmenge).
 * Gilt nur, wenn weder das Lebensmittel selbst, noch die Einkaufsliste, noch eine Art, noch der Katalog eine Einheit
 * liefert. Richtwerte nach BZfE-Portionsgrößen/DGE (Portion Fleisch/Fisch 125 g, Gemüse 150 g, Nudeln/Reis roh 75 g,
 * Hülsenfrüchte gegart 150 g), Löffelmaße nach üblichen Küchen-Umrechnungstabellen – PRODUKTENTSCHEIDUNG.
 * Typ `Record<SourceFoodCategory, …>`: Eine neue Kategorie ohne Rückfall lässt den Typcheck scheitern.
 */
export const HOUSEHOLD_UNITS_BY_CATEGORY: Readonly<
  Record<SourceFoodCategory, readonly HouseholdUnitGrams[]>
> = {
  bread_bakery: [u('slice', 45)],
  cereal_products: [u('tbsp', 10), u('portion', 75)],
  pastries_sweets: [u('piece', 50)],
  fruit: [u('piece', 120), u('handful', 100)],
  vegetables: [u('handful', 80), u('portion', 150)],
  potatoes_starch: [u('piece', 80), u('portion', 200)],
  mushrooms: [u('handful', 50), u('portion', 150)],
  legumes: [u('tbsp', 20), u('portion', 150)],
  soy_products: [u('portion', 100), u('tbsp', 15)],
  nuts_seeds: [u('handful', 25), u('tbsp', 10)],
  dairy: [u('tbsp', 15), u('cup', 150)],
  eggs: [u('piece', 60)],
  fats_oils: [u('tbsp', 10), u('tsp', 4)],
  fish: [u('portion', 125)],
  crustaceans_molluscs: [u('portion', 100), u('handful', 50)],
  meat_beef_veal: [u('portion', 125)],
  meat_pork: [u('portion', 125)],
  meat_lamb: [u('portion', 125)],
  meat_poultry: [u('portion', 125)],
  meat_game: [u('portion', 125)],
  offal: [u('portion', 125)],
  sausage_meat_products: [u('slice', 15), u('piece', 50)],
  spices_sauces: [u('tsp', 5), u('tbsp', 15)],
  sugar_sweets: [u('tsp', 5), u('tbsp', 15)],
  beverages: [u('glass', 200), u('cup', 250)],
  alcoholic_beverages: [u('glass', 200)],
  composite_dishes: [u('portion', 250)],
  // Proteinpulver u. a.: 1 Messlöffel/Portion ≈ 30 g.
  other: [u('portion', 30), u('tbsp', 10)],
};

/** Alle Quell-Kategorien mit Rückfall (für Tests). */
export const HOUSEHOLD_FALLBACK_CATEGORIES = SOURCE_FOOD_CATEGORIES;
