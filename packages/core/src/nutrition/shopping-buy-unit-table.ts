/**
 * Einkaufs-Einheiten je Lebensmittel – die EINE Quelle dafür, wie ein Eintrag der Einkaufsliste im Laden gekauft wird
 * (Gründer-Rückmeldung 24.10.2026: „Niemand kauft drei Karotten und dann noch mal fünf Karotten oder 60 g Ingwer“).
 * Regeln: docs/PLAN-EINKAUFEN-AUSDAUER.md 3 „Einkaufen wie im Laden“; Rechnung: `shoppingPurchase`
 * (shopping-buy-units.ts).
 *
 * Arten:
 * - `loose` – zählbares Stück ohne Verpackung, die Anzahl steht vorn: „3 Äpfel“, „2 rote Paprika“. `pieceG` = essbarer
 *   Anteil eines mittleren Stücks, wie in den Rezepten („1 Apfel (150 g)“, „½ Avocado (80 g)“).
 * - `piece` – Einheit ohne Größenangabe: „1 Stück Ingwer“, „1 Bund Petersilie“, „1 Knolle Knoblauch“, „1 Kopf Brokkoli“,
 *   „1 Topf Basilikum“. `pieceG` = übliche nutzbare Menge einer Einheit.
 * - `pack` – Verpackung mit Größe: „1 Netz Kartoffeln (2 kg)“, „2 Packungen Hähnchenbrustfilet (à 600 g)“, „1 Packung
 *   Eier (10 Stück)“. `sizes` = übliche Größen in der Einheit `measure` (g, ml oder Stück); gewählt wird die kleinste
 *   Kombination, die den Bedarf deckt (`shoppingPurchase`). `labels` (gleich lang wie `sizes`) ersetzt die Größe in
 *   der Anzeige, wenn auf der Packung etwas anderes steht als die Rezeptmenge (Dosen: Rezepte rechnen abgetropft,
 *   gekauft wird die „400-g-Dose“). `gPerUnit` = Gramm je ml (Dichte) bzw. je Stück, um den Bedarf aus Gramm
 *   umzurechnen.
 * - `stock` – Vorrat ohne Menge (Öle, Essig, Gewürze, Saucen, Süßungsmittel): „Olivenöl – Vorrat prüfen“. Kleine
 *   Rezeptmengen sind hier keine Kaufmenge; `note` ersetzt „Vorrat prüfen“ (Wasser: „aus der Leitung“).
 *
 * Quellen: übliche Packungs- und Stückgrößen im deutschen Lebensmittelhandel 2026 (Sortimente REWE, Edeka, Aldi,
 * Lidl; Stückgewichte nach BZfE „Lebensmittel-Portionsgrößen“ und den Mengenangaben der Rezepte). Gerundete Richtwerte
 * – PRODUKTENTSCHEIDUNG. Reine Anzeige: Die Mengen der Liste (Gramm, Häkchen, `item_key`) ändern sich dadurch nie.
 *
 * Jedes Lebensmittel in content/foods braucht hier einen Eintrag (Test packages/content/src/foods/buy-units.test.ts
 * – CI schlägt fehl, wenn ein neues Lebensmittel keinen hat). Ein unbekanntes Lebensmittel bekommt sicherheitshalber
 * „1 Packung …“ mit dem Bedarf dahinter.
 */

export const SHOPPING_CONTAINERS = [
  'Stück',
  'Bund',
  'Knolle',
  'Kopf',
  'Topf',
  'Netz',
  'Beutel',
  'Schale',
  'Packung',
  'Becher',
  'Flasche',
  'Dose',
  'Glas',
  'Tube',
  'Tafel',
] as const;
export type ShoppingContainer = (typeof SHOPPING_CONTAINERS)[number];

/** Mehrzahl der Verpackungen („2 Netze“, „3 Köpfe“, „2 Bund“). */
export const SHOPPING_CONTAINER_PLURAL: Readonly<Record<ShoppingContainer, string>> = {
  Stück: 'Stück',
  Bund: 'Bund',
  Knolle: 'Knollen',
  Kopf: 'Köpfe',
  Topf: 'Töpfe',
  Netz: 'Netze',
  Beutel: 'Beutel',
  Schale: 'Schalen',
  Packung: 'Packungen',
  Becher: 'Becher',
  Flasche: 'Flaschen',
  Dose: 'Dosen',
  Glas: 'Gläser',
  Tube: 'Tuben',
  Tafel: 'Tafeln',
};

export type ShoppingBuyUnit =
  | {
      readonly kind: 'loose';
      readonly name: string;
      readonly plural: string;
      readonly pieceG: number;
      readonly note?: string;
    }
  | {
      readonly kind: 'piece';
      readonly container: ShoppingContainer;
      readonly name: string;
      readonly pieceG: number;
      readonly note?: string;
    }
  | {
      readonly kind: 'pack';
      readonly container: ShoppingContainer;
      readonly name: string;
      readonly measure: 'g' | 'ml' | 'pcs';
      readonly sizes: readonly number[];
      readonly labels?: readonly string[];
      readonly gPerUnit?: number;
      readonly note?: string;
    }
  | { readonly kind: 'stock'; readonly name: string; readonly note?: string };

const loose = (name: string, plural: string, pieceG: number, note?: string): ShoppingBuyUnit => ({
  kind: 'loose',
  name,
  plural,
  pieceG,
  ...(note !== undefined ? { note } : {}),
});
const piece = (container: ShoppingContainer, name: string, pieceG: number): ShoppingBuyUnit => ({
  kind: 'piece',
  container,
  name,
  pieceG,
});
const pack = (
  container: ShoppingContainer,
  name: string,
  sizes: readonly number[],
  extra: {
    readonly measure?: 'g' | 'ml' | 'pcs';
    readonly labels?: readonly string[];
    readonly gPerUnit?: number;
  } = {},
): ShoppingBuyUnit => ({ kind: 'pack', container, name, measure: 'g', sizes, ...extra });
const stock = (name: string, note?: string): ShoppingBuyUnit => ({
  kind: 'stock',
  name,
  ...(note !== undefined ? { note } : {}),
});

/** Abgetropfte Dose: Rezepte rechnen das Abtropfgewicht, gekauft wird die Dose mit Füllgewicht. */
const can = (name: string, drainedG: number, label: string) =>
  pack('Dose', name, [drainedG], { labels: [label] });

export const SHOPPING_BUY_UNITS: Readonly<Record<string, ShoppingBuyUnit>> = {
  // --- Obst und Gemüse ---
  apfel: loose('Apfel', 'Äpfel', 150),
  avocado: loose('Avocado', 'Avocados', 160),
  babyspinat: pack('Beutel', 'Babyspinat', [125, 250]),
  banane: loose('Banane', 'Bananen', 120),
  basilikum: piece('Topf', 'Basilikum', 25),
  blattsalat: piece('Kopf', 'Blattsalat', 300),
  blumenkohl: piece('Kopf', 'Blumenkohl', 700),
  brokkoli: piece('Kopf', 'Brokkoli', 400),
  champignons: pack('Schale', 'Champignons', [250, 500]),
  cherrytomaten: pack('Schale', 'Cherrytomaten', [250, 500]),
  kirschtomaten: pack('Schale', 'Cherrytomaten', [250, 500]),
  chinakohl: piece('Kopf', 'Chinakohl', 800),
  erdbeeren: pack('Schale', 'Erdbeeren', [250, 500]),
  fruehlingszwiebeln: piece('Bund', 'Frühlingszwiebeln', 150),
  fruehlingszwiebel: piece('Bund', 'Frühlingszwiebeln', 150),
  lauchzwiebeln: piece('Bund', 'Frühlingszwiebeln', 150),
  gurke: loose('Gurke', 'Gurken', 400),
  heidelbeeren: pack('Schale', 'Heidelbeeren', [125, 250]),
  honigmelone: loose('Honigmelone', 'Honigmelonen', 1000),
  ingwer: piece('Stück', 'Ingwer', 100),
  // Karotten: immer im Beutel (bei Aldi/Lidl gibt es sie nur so) – eine Regel für alle drei Katalog-Einträge.
  karotten: pack('Beutel', 'Karotten', [500, 1000]),
  karotte: pack('Beutel', 'Karotten', [500, 1000]),
  moehre: pack('Beutel', 'Karotten', [500, 1000]),
  // Kartoffeln: Netz bzw. Beutel 1 / 1,5 / 2 / 2,5 kg (Gründer: 1,5–2,5 kg; 1 kg für kleine Mengen ergänzt).
  kartoffeln: pack('Netz', 'Kartoffeln', [1000, 1500, 2000, 2500]),
  knoblauch: piece('Knolle', 'Knoblauch', 60),
  limettensaft: loose('Limette', 'Limetten', 30, 'für den Saft'),
  'paprika-gelb': loose('gelbe Paprika', 'gelbe Paprika', 150),
  'paprika-rot': loose('rote Paprika', 'rote Paprika', 150),
  'petersilie-frisch': piece('Bund', 'Petersilie', 40),
  radieschen: piece('Bund', 'Radieschen', 150),
  romanasalat: piece('Kopf', 'Romanasalat', 350),
  romanasalatherzen: pack('Packung', 'Romanasalatherzen', [300]),
  'rote-zwiebel': loose('rote Zwiebel', 'rote Zwiebeln', 80),
  rotkohl: piece('Kopf', 'Rotkohl', 1000),
  rucola: pack('Schale', 'Rucola', [125]),
  salatmix: pack('Beutel', 'Salatmischung', [200]),
  'schnittlauch-frisch': piece('Bund', 'Schnittlauch', 30),
  spinat: pack('Beutel', 'Spinat', [250, 500]),
  spitzkohl: piece('Kopf', 'Spitzkohl', 800),
  suesskartoffel: loose('Süßkartoffel', 'Süßkartoffeln', 300),
  tomate: loose('Tomate', 'Tomaten', 100),
  tomaten: loose('Tomate', 'Tomaten', 100),
  weisskohl: piece('Kopf', 'Weißkohl', 1000),
  zitronensaft: loose('Zitrone', 'Zitronen', 40, 'für den Saft'),
  zucchini: loose('Zucchini', 'Zucchini', 250),
  zwiebel: loose('Zwiebel', 'Zwiebeln', 80),
  aprikosen: loose('Aprikose', 'Aprikosen', 40),
  aubergine: loose('Aubergine', 'Auberginen', 300),
  maracuja: loose('Maracuja', 'Maracujas', 20),
  pastinake: loose('Pastinake', 'Pastinaken', 150),
  pfirsich: loose('Pfirsich', 'Pfirsiche', 130),
  rosenkohl: pack('Beutel', 'Rosenkohl', [500]),
  wassermelone: pack('Stück', 'Wassermelone', [1000, 2000]),
  'zitronenschale-bio-abgerieben': loose('Bio-Zitrone', 'Bio-Zitronen', 4, 'für die Schale'),
  zuckerschoten: pack('Schale', 'Zuckerschoten', [150]),

  // --- Tiefkühl ---
  'asia-gemuesemischung-tk': pack('Beutel', 'TK-Asia-Gemüse', [450, 750]),
  'beeren-mischung-tk': pack('Beutel', 'TK-Beerenmischung', [300, 750]),
  'beerenmischung-tk': pack('Beutel', 'TK-Beerenmischung', [300, 750]),
  'blattspinat-tk': pack('Beutel', 'TK-Blattspinat', [450, 750]),
  'edamame-tk-geschaelt': pack('Beutel', 'TK-Edamame', [400]),
  'erbsen-tk': pack('Beutel', 'TK-Erbsen', [450, 750]),
  'garnelen-tk-roh-geschaelt': pack('Packung', 'TK-Garnelen', [225, 400]),
  'gruene-bohnen-tk': pack('Beutel', 'grüne TK-Bohnen', [450, 750]),
  'himbeeren-tk': pack('Beutel', 'TK-Himbeeren', [300, 750]),
  'mango-tk': pack('Beutel', 'TK-Mango', [500]),
  'seelachsfilet-tk': pack('Packung', 'TK-Seelachsfilet', [400]),
  'haehnchen-nuggets': pack('Packung', 'TK-Hähnchen-Nuggets', [450]),
  'speiseeis-vanille': pack('Packung', 'Vanilleeis', [900], { measure: 'ml', gPerUnit: 0.55 }),
  'suesskirschen-tk-entsteint': pack('Beutel', 'TK-Süßkirschen', [300, 750]),

  // --- Kühlregal: Milchprodukte und Eier ---
  eiklar: pack('Packung', 'Eiklar', [500, 1000]),
  feta: pack('Packung', 'Feta', [200]),
  'frischkaese-light': pack('Becher', 'Frischkäse leicht', [200]),
  'gouda-light-gerieben': pack('Beutel', 'Gouda leicht, gerieben', [200]),
  gouda: pack('Packung', 'Gouda', [150, 400]),
  halloumi: pack('Packung', 'Halloumi', [225]),
  'harzer-kaese': pack('Packung', 'Harzer Käse', [200]),
  huehnerei: pack('Packung', 'Eier', [6, 10], { measure: 'pcs', gPerUnit: 60 }),
  huettenkaese: pack('Becher', 'Hüttenkäse', [200]),
  'joghurt-1-5': pack('Becher', 'Joghurt 1,5 %', [150, 500]),
  'kochsahne-15': pack('Becher', 'Kochsahne 15 %', [200]),
  magerquark: pack('Becher', 'Magerquark', [250, 500]),
  'milch-1-5': pack('Packung', 'Milch 1,5 %', [1000], { measure: 'ml', gPerUnit: 1.03 }),
  'mozzarella-light': pack('Packung', 'Mozzarella light', [125]),
  parmesan: pack('Stück', 'Parmesan', [150]),
  ricotta: pack('Becher', 'Ricotta', [250]),
  'skyr-natur': pack('Becher', 'Skyr natur', [150, 500]),
  butter: pack('Packung', 'Butter', [250]),
  'gouda-light-scheiben': pack('Packung', 'Gouda leicht in Scheiben', [150]),
  maultaschen: pack('Packung', 'Maultaschen', [360]),
  mozzarella: pack('Packung', 'Mozzarella', [125]),
  'schlagsahne-30': pack('Becher', 'Schlagsahne 30 %', [200]),
  schmand: pack('Becher', 'Schmand', [200]),
  'schmelzkaese-scheiben': pack('Packung', 'Schmelzkäse-Scheiben', [200]),
  'vollmilch-3-5': pack('Packung', 'Vollmilch 3,5 %', [1000], { measure: 'ml', gPerUnit: 1.03 }),

  // --- Fleisch und Wurst ---
  'hackfleisch-vom-schwein': pack('Packung', 'Schweinehackfleisch', [400, 500]),
  'haehnchenbrust-aufschnitt': pack('Packung', 'Hähnchenbrust-Aufschnitt', [100]),
  haehnchenbrustfilet: pack('Packung', 'Hähnchenbrustfilet', [400, 600, 1000]),
  'haehnchenschenkelfilet-ohne-haut': pack('Packung', 'Hähnchenschenkelfilet', [400, 600]),
  'kassler-mager': pack('Packung', 'Kassler', [400]),
  kochschinken: pack('Packung', 'Kochschinken', [100, 200]),
  lachsschinken: pack('Packung', 'Lachsschinken', [80]),
  lammfilet: pack('Packung', 'Lammfilet', [250]),
  'putenbrust-aufschnitt': pack('Packung', 'Putenbrust-Aufschnitt', [100]),
  putenbrustaufschnitt: pack('Packung', 'Putenbrust-Aufschnitt', [100]),
  putenbrustfilet: pack('Packung', 'Putenbrustfilet', [400, 600, 1000]),
  putenhackfleisch: pack('Packung', 'Putenhackfleisch', [400]),
  'rinderhackfleisch-5-fett': pack('Packung', 'Rinderhackfleisch 5 % Fett', [400]),
  rinderhueftsteak: pack('Packung', 'Rinderhüftsteak', [180, 360]),
  'roastbeef-aufschnitt': pack('Packung', 'Roastbeef-Aufschnitt', [100]),
  schweinefilet: pack('Packung', 'Schweinefilet', [500]),
  'schweinehackfleisch-mager': pack('Packung', 'Schweinehackfleisch mager', [400]),
  schweineschnitzel: pack('Packung', 'Schweineschnitzel', [400]),
  'brathaehnchen-mit-haut': pack('Packung', 'Brathähnchen', [1200]),
  'bratwurst-schwein': pack('Packung', 'Bratwurst', [400]),
  doenerfleisch: pack('Packung', 'Dönerfleisch', [300]),
  'gefluegelwuerstchen-fettreduziert': pack('Packung', 'Geflügelwürstchen', [200, 400]),
  'gyrosfleisch-schwein': pack('Packung', 'Gyros', [400, 600]),
  leberkaese: pack('Packung', 'Leberkäse', [200]),
  'rinderhackfleisch-20-fett': pack('Packung', 'Rinderhackfleisch', [400, 500]),
  'rindfleisch-gulasch': pack('Packung', 'Rindergulasch', [500]),
  salami: pack('Packung', 'Salami', [100]),
  schweinemett: pack('Packung', 'Schweinemett', [250]),
  schweineschulter: pack('Packung', 'Schweineschulter', [1000]),
  'speck-durchwachsen': pack('Packung', 'Speck durchwachsen', [100, 200]),
  'wiener-wuerstchen': pack('Packung', 'Wiener Würstchen', [250, 400]),

  // --- Fisch ---
  kabeljaufilet: pack('Packung', 'Kabeljaufilet', [250, 400]),
  lachsfilet: pack('Packung', 'Lachsfilet', [250, 500]),
  'nordseekrabben-gekocht-geschaelt': pack('Packung', 'Nordseekrabben', [100]),
  raeucherforellenfilet: pack('Packung', 'Räucherforellenfilet', [125]),
  raeucherlachs: pack('Packung', 'Räucherlachs', [100, 200]),
  // Schweizer Nährwertdatenbank 7.1 (Zweitquelle): frische Kräuter im Bund.
  'dill-frisch': piece('Bund', 'Dill', 30),
  'koriander-frisch': piece('Bund', 'Koriander', 30),
  'minze-frisch': piece('Bund', 'Minze', 30),
  'salbei-frisch': piece('Bund', 'Salbei', 20),
  matjeshering: pack('Packung', 'Matjesfilets', [200]),

  // --- Kühlregal pflanzlich ---
  'falafel-kuehlregal': pack('Packung', 'Falafel', [200]),
  hummus: pack('Becher', 'Hummus', [200]),
  raeuchertofu: pack('Packung', 'Räuchertofu', [200]),
  seidentofu: pack('Packung', 'Seidentofu', [400]),
  seitan: pack('Packung', 'Seitan', [200]),
  'soja-cuisine': pack('Packung', 'Soja-Cuisine', [200], { labels: ['200 ml'] }),
  'sojadrink-ungesuesst': pack('Packung', 'Sojadrink ungesüßt', [1000], {
    measure: 'ml',
    gPerUnit: 1,
  }),
  'sojajoghurt-natur': pack('Becher', 'Sojajoghurt natur', [500]),
  'sojaschnetzel-trocken': pack('Packung', 'Sojaschnetzel', [150]),
  'tofu-natur': pack('Packung', 'Tofu natur', [200, 400]),
  'mandeldrink-ungesuesst': pack('Packung', 'Mandeldrink ungesüßt', [1000], {
    measure: 'ml',
    gPerUnit: 1,
  }),
  'veganer-reibekaese': pack('Beutel', 'Vegane Käsealternative, gerieben', [150]),
  'sojaskyr-natur': pack('Becher', 'Sojaskyr natur', [400]),
  tempeh: pack('Packung', 'Tempeh', [200]),

  // --- Nudeln, Reis, Getreide ---
  'basmatireis-trocken': pack('Packung', 'Basmatireis', [500, 1000]),
  'bulgur-trocken': pack('Packung', 'Bulgur', [500]),
  'couscous-trocken': pack('Packung', 'Couscous', [500]),
  'eierspaetzle-getrocknet': pack('Packung', 'Eierspätzle', [500]),
  'express-reis-beutel-gegart': pack('Beutel', 'Express-Reis', [250]),
  'gnocchi-kuehlregal': pack('Packung', 'Gnocchi', [400]),
  hartweizengriess: pack('Packung', 'Hartweizengrieß', [500]),
  'langkornreis-trocken': pack('Packung', 'Langkornreis', [500, 1000]),
  lasagneplatten: pack('Packung', 'Lasagneplatten', [250, 500]),
  'mie-nudeln': pack('Packung', 'Mie-Nudeln', [250]),
  'milchreis-rundkornreis': pack('Packung', 'Milchreis', [500]),
  'reisnudeln-trocken': pack('Packung', 'Reisnudeln', [250]),
  risottoreis: pack('Packung', 'Risottoreis', [500]),
  'rote-linsen-trocken': pack('Packung', 'Rote Linsen', [500]),
  'spaghetti-trocken': pack('Packung', 'Spaghetti', [500]),
  'suppennudeln-hartweizen': pack('Packung', 'Suppennudeln', [250]),
  vollkornnudeln: pack('Packung', 'Vollkornnudeln', [500]),
  'vollkornspaghetti-trocken': pack('Packung', 'Vollkornspaghetti', [500]),
  weichweizengriess: pack('Packung', 'Weichweizengrieß', [500]),
  kartoffelknoedel: pack('Packung', 'Kartoffelknödel', [400]),
  'makkaroni-trocken': pack('Packung', 'Makkaroni', [500]),

  // --- Konserven und Gläser (Abtropfgewicht → Dose) ---
  'ananas-dose-abgetropft': can('Ananas', 340, '580 ml'),
  'apfelmus-ungesuesst': pack('Glas', 'Apfelmus ungesüßt', [710]),
  'gehackte-tomaten-dose': pack('Dose', 'Gehackte Tomaten', [400]),
  'gewuerzgurken-glas': pack('Glas', 'Gewürzgurken', [360], { labels: ['720 ml'] }),
  'kichererbsen-dose-abgetropft': can('Kichererbsen', 240, '400 g'),
  'kidneybohnen-dose-abgetropft': can('Kidneybohnen', 250, '400 g'),
  kokosmilch: pack('Dose', 'Kokosmilch', [400], { labels: ['400 ml'] }),
  'linsen-dose-abgetropft': can('Linsen', 250, '400 g'),
  'mais-dose-abgetropft': can('Mais', 285, '340 g'),
  'oliven-schwarz': pack('Glas', 'Schwarze Oliven', [160]),
  'schwarze-oliven-glas': pack('Glas', 'Schwarze Oliven', [160]),
  'passierte-tomaten': pack('Packung', 'Passierte Tomaten', [500]),
  'sauerkirschen-glas-abgetropft': pack('Glas', 'Sauerkirschen', [350], { labels: ['720 ml'] }),
  sauerkraut: pack('Beutel', 'Sauerkraut', [500]),
  'schwarze-bohnen-dose-abgetropft': can('Schwarze Bohnen', 240, '400 g'),
  tahin: pack('Glas', 'Tahin', [250]),
  'thunfisch-dose-im-eigenen-saft-abgetropft': can('Thunfisch im eigenen Saft', 140, '185 g'),
  'thunfisch-im-eigenen-saft-abgetropft': can('Thunfisch im eigenen Saft', 140, '185 g'),
  tomatenmark: pack('Tube', 'Tomatenmark', [200]),
  'weisse-bohnen-dose-abgetropft': can('Weiße Bohnen', 250, '400 g'),
  'wildpreiselbeeren-glas': pack('Glas', 'Wildpreiselbeeren', [400]),

  // --- Nüsse, Samen, Trockenobst ---
  cashewkerne: pack('Packung', 'Cashewkerne', [200]),
  chiasamen: pack('Packung', 'Chiasamen', [250]),
  'datteln-getrocknet-entsteint': pack('Packung', 'Datteln, entsteint', [200]),
  erdnussmus: pack('Glas', 'Erdnussmus', [350]),
  kuerbiskerne: pack('Packung', 'Kürbiskerne', [200]),
  'leinsamen-geschrotet': pack('Packung', 'Leinsamen geschrotet', [250]),
  mandeln: pack('Packung', 'Mandeln', [200]),
  'pistazienkerne-ungesalzen': pack('Packung', 'Pistazienkerne', [100, 200]),
  rosinen: pack('Packung', 'Rosinen', [250]),
  sesam: pack('Packung', 'Sesam', [100]),
  walnuesse: pack('Packung', 'Walnüsse', [200]),

  // --- Brot und Backwaren ---
  knaeckebrot: pack('Packung', 'Knäckebrot', [250]),
  laugenbrezel: loose('Laugenbrezel', 'Laugenbrezeln', 70),
  loeffelbiskuits: pack('Packung', 'Löffelbiskuits', [200]),
  paniermehl: pack('Packung', 'Paniermehl', [200]),
  reiswaffeln: pack('Packung', 'Reiswaffeln', [100]),
  'toastbrot-weizen': pack('Packung', 'Toastbrot', [500]),
  'vollkorn-knaeckebrot': pack('Packung', 'Vollkorn-Knäckebrot', [250]),
  'vollkorn-tortilla': pack('Packung', 'Vollkorn-Wraps', [6], { measure: 'pcs', gPerUnit: 60 }),
  'vollkorn-wrap': pack('Packung', 'Vollkorn-Wraps', [6], { measure: 'pcs', gPerUnit: 60 }),
  vollkornbroetchen: loose('Vollkornbrötchen', 'Vollkornbrötchen', 70),
  vollkornbrot: pack('Packung', 'Vollkornbrot', [500]),
  vollkorntoast: pack('Packung', 'Vollkorntoast', [500]),
  weizenbroetchen: loose('Brötchen', 'Brötchen', 60),
  zwieback: pack('Packung', 'Zwieback', [225]),
  'berliner-krapfen': loose('Berliner', 'Berliner', 70),
  burgerbroetchen: pack('Packung', 'Burgerbrötchen', [4], { measure: 'pcs', gPerUnit: 75 }),
  butterkekse: pack('Packung', 'Butterkekse', [200]),
  croissant: loose('Croissant', 'Croissants', 60),
  fladenbrot: loose('Fladenbrot', 'Fladenbrote', 400),
  'hot-dog-broetchen': pack('Packung', 'Hot-Dog-Brötchen', [4], { measure: 'pcs', gPerUnit: 60 }),
  panko: pack('Packung', 'Panko', [200]),
  streuselkuchen: loose('Stück Streuselkuchen', 'Stück Streuselkuchen', 100),

  // --- Frühstück ---
  haferflocken: pack('Packung', 'Haferflocken', [500, 1000]),
  haferkleie: pack('Packung', 'Haferkleie', [500]),
  'cornflakes-ungezuckert': pack('Packung', 'Cornflakes ungezuckert', [375]),
  ahornsirup: stock('Ahornsirup'),
  erdbeerkonfituere: stock('Erdbeerkonfitüre'),
  honig: stock('Honig'),

  // --- Öl, Essig, Saucen (Vorrat) ---
  apfelessig: stock('Apfelessig'),
  'balsamico-essig': stock('Balsamico-Essig'),
  leinoel: stock('Leinöl'),
  olivenoel: stock('Olivenöl'),
  rapsoel: stock('Rapsöl'),
  sesamoel: stock('Sesamöl'),
  sojasauce: stock('Sojasauce'),
  senf: stock('Senf'),
  'sambal-oelek': stock('Sambal Oelek'),
  'meerrettich-glas': stock('Meerrettich'),
  mayonnaise: stock('Mayonnaise'),
  tomatenketchup: stock('Tomatenketchup'),

  // --- Gewürze und Backzutaten ---
  backkakao: stock('Backkakao'),
  backpulver: stock('Backpulver'),
  'dinkelmehl-type-630': pack('Packung', 'Dinkelmehl Type 630', [1000]),
  'gemuesebruehe-instantpulver': stock('Gemüsebrühe-Pulver'),
  'gemuesebruehe-zubereitet': stock('Gemüsebrühe-Pulver'),
  hefeflocken: stock('Hefeflocken'),
  'kakaopulver-stark-entoelt': stock('Backkakao'),
  kichererbsenmehl: pack('Packung', 'Kichererbsenmehl', [500]),
  pfeffer: stock('Pfeffer'),
  salz: stock('Salz'),
  speisestaerke: stock('Speisestärke'),
  zucker: stock('Zucker'),
  'instant-puddingpulver-zuckerfrei': pack('Packung', 'Instant-Puddingpulver', [40]),
  roestzwiebeln: pack('Packung', 'Röstzwiebeln', [150]),
  'weizenmehl-type-405': pack('Packung', 'Weizenmehl Type 405', [1000]),
  // Schweizer Nährwertdatenbank 7.1 (Zweitquelle): Gewürze, Süßungs- und Bindemittel als Vorrat.
  chiliflocken: stock('Chiliflocken'),
  chilipulver: stock('Chilipulver'),
  currypulver: stock('Currypulver'),
  erythrit: stock('Erythrit'),
  'gyros-gewuerz': stock('Gyros-Gewürz'),
  gyrosgewuerz: stock('Gyros-Gewürz'),
  johannisbrotkernmehl: stock('Johannisbrotkernmehl'),
  kreuzkuemmel: stock('Kreuzkümmel'),
  kurkuma: stock('Kurkuma'),
  kuemmel: stock('Kümmel'),
  'majoran-getrocknet': stock('Majoran'),
  'muskatnuss-gerieben': stock('Muskatnuss'),
  'oregano-getrocknet': stock('Oregano'),
  'paprikapulver-edelsuess': stock('Paprikapulver edelsüß'),
  'paprikapulver-geraeuchert': stock('Paprikapulver geräuchert'),
  'rosmarin-getrocknet': stock('Rosmarin'),
  zimt: stock('Zimt'),

  // --- Getränke und Sonstiges ---
  'espresso-zubereitet': stock('Espresso'),
  instantkaffee: stock('Instantkaffee'),
  orangensaft: pack('Packung', 'Orangensaft', [1000], { measure: 'ml', gPerUnit: 1.04 }),
  wasser: stock('Wasser', 'aus der Leitung'),
  apfelsaft: pack('Packung', 'Apfelsaft', [1000], { measure: 'ml', gPerUnit: 1.05 }),
  cola: pack('Flasche', 'Cola', [1000, 1500], { measure: 'ml', gPerUnit: 1.04 }),
  'schwarzer-tee-aufgebrueht': stock('Schwarzer Tee'),
  eiswuerfel: stock('Eiswürfel', 'aus dem Gefrierfach'),
  'zartbitterschokolade-70': pack('Tafel', 'Zartbitterschokolade 70 %', [100]),

  // --- Schweizer Nährwertdatenbank 7.1 (Zweitquelle): Vorräte, Konserven, Proteinpulver ---
  'kokosmilch-fettreduziert': pack('Dose', 'Kokosmilch fettreduziert', [400], {
    labels: ['400 ml'],
  }),
  kokosraspeln: pack('Packung', 'Kokosraspeln', [200]),
  reisessig: stock('Reisessig'),
  'salsa-glas': pack('Glas', 'Salsa', [300]),
  'tomatensalsa-glas': pack('Glas', 'Tomatensalsa', [300]),
  'geschmackspulver-zuckerfrei': stock('Geschmackspulver'),
  'casein-proteinpulver-vanille': stock('Casein-Proteinpulver Vanille'),
  'clear-whey-isolat-fruchtgeschmack': stock('Clear-Whey-Isolat'),
  'veganes-proteinpulver': stock('Veganes Proteinpulver'),
  'veganes-proteinpulver-erbse-reis-neutral': stock('Veganes Proteinpulver neutral'),
  'veganes-proteinpulver-schoko': stock('Veganes Proteinpulver Schoko'),
  'veganes-proteinpulver-vanille': stock('Veganes Proteinpulver Vanille'),
  'whey-proteinpulver-neutral': stock('Whey-Proteinpulver neutral'),
  'whey-proteinpulver-schoko': stock('Whey-Proteinpulver Schoko'),
  'whey-proteinpulver-vanille': stock('Whey-Proteinpulver Vanille'),
};
