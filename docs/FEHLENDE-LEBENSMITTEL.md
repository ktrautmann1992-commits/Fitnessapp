# Fehlende Alltags-Lebensmittel im Katalog

Stand 14.11.2026 (Prüfung für „Essen frei eintragen“, `docs/PLAN-ESSEN-FREI-EINTRAGEN.md`). Der Katalog
`content/foods` ist geschützt – ergänzt wird **nur über den Workflow `foods-import`** (Quell-ID aus dem BLS bzw. der
Schweizer Nährwertdatenbank, Freigabe durch die Gründer). Nach dem Import neue IDs bei Bedarf in
`packages/core/src/nutrition/food-household-table.ts` (Haushaltsmengen) eintragen.

## Vorhanden (geprüft)

Toastbrot (Weizen), Vollkorntoast, Vollkornbrot, Weizen- und Vollkornbrötchen, Laugenbrezel, Knäckebrot, Cornflakes
(ungezuckert), Haferflocken, Erdbeerkonfitüre, Honig, Gouda, Gouda in Scheiben, Feta, Parmesan, Halloumi, Harzer
Käse, Hüttenkäse, Frischkäse (40 %), Milch 1,5 %, Joghurt 1,5 %, Magerquark, Skyr, Ei, Banane, Apfel, Erdbeeren,
Kochschinken, Putenbrust-Aufschnitt, Orangensaft.

Im Katalog, aber noch **Entwurf** (in der Suche erst nach Prüfung und Freigabe sicher dabei): Butter, Mozzarella,
Schmelzkäse-Scheiben, Vollmilch 3,5 %, Salami, Apfelsaft, Croissant.

## Fehlen – bitte über `foods-import` ergänzen

| Bereich          | Lebensmittel                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Käse             | Emmentaler, Bergkäse, Butterkäse/Tilsiter, Edamer, Camembert/Brie, Frischkäse (Doppelrahmstufe)    |
| Brot & Backwaren | Mischbrot/Graubrot, Roggenbrot, Dinkelbrot, Baguette, Bagel                                        |
| Frühstück        | Müsli (Früchte- bzw. Schokomüsli), Cornflakes (gezuckert), Müsliriegel                             |
| Aufstriche       | Margarine, Nuss-Nougat-Creme, Erdnussbutter (Creme), weitere Konfitüren (Kirsche, Aprikose)        |
| Wurst            | Leberwurst, Fleischwurst/Lyoner                                                                    |
| Milchprodukte    | Joghurt 3,5 %, Fruchtjoghurt, Buttermilch, Kefir, Kakaogetränk                                     |
| Obst             | Birne, Weintrauben, Orange, Mandarine, Kiwi, Pflaume, Nektarine                                    |
| Snacks & Süßes   | Vollmilchschokolade, Gummibärchen, Kartoffelchips, Erdnüsse (geröstet), Haselnüsse, Popcorn, Donut |
| Fertiges         | Pommes frites, Pizza (TK), Pesto                                                                   |
| Getränke         | Apfelschorle, Limonade, Bier, Wein                                                                 |

Bis zum Import gibt es für viele davon einen **Ersatz mit Richtwerten** (`FOOD_STAND_INS` in
`packages/core/src/nutrition/food-household-table.ts`): Die Suche findet „Emmentaler“, eingetragen wird mit den Werten
von Gouda (Titel „Emmentaler (≈ Gouda)“). Ersatz vorhanden für: Emmentaler, Bergkäse, Butterkäse, Tilsiter, Edamer,
Camembert/Brie (→ Gouda); Mischbrot/Graubrot, Roggenbrot, Dinkelbrot (→ Vollkornbrot); Baguette (→ Weizenbrötchen); Müsli
(→ Haferflocken); Margarine (→ Butter); Marmelade (→ Erdbeerkonfitüre); Nuss-Nougat-Creme, Vollmilchschokolade (→
Zartbitterschokolade); Joghurt 3,5 % (→ Joghurt 1,5 %); Birne, Orange, Mandarine, Kiwi, Weintrauben, Pflaume (→ Apfel);
Leberwurst (→ Salami); Fleischwurst (→ Wiener Würstchen); Erdnüsse, Haselnüsse (→ Mandeln). Ohne Ersatz: Schnelleintrag
oder „Produkt (Barcode)“. Der echte Import bleibt nötig – Ersatzwerte sind nur Richtwerte.
