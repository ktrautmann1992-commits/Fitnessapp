# Auswärts essen und Vorratsschrank (Gründer-Freigabe 25.10.2026)

Branch `claude/auswaerts-vorrat`. KONZEPT 6.1 („Auswärts essen“) und 6.14 („Vorratsschrank“). Alles gratis, ohne KI.

## 1. Auswärts essen – Reiter „Unterwegs“

**So funktioniert es:** Ernährung → Eintragen → „Unterwegs“. Kategorie (Restaurant, Imbiss, Kantine, Bäckerei, Café,
Fast Food) oder Suche → Gericht antippen → Portion (klein ¾ · normal · groß 1⅓; Pizza halb/ganz; Stückware 1/2 Stück;
Getränke klein/normal/groß) → „Eintragen“. „Zuletzt unterwegs“ trägt mit einem Tipp dieselbe Portion erneut ein;
Favoriten öffnen das Gericht. Werte immer mit „ca.“ und Kennzeichen „Schätzwert“.

**Keine erfundenen Nährwerte.** Jedes Gericht ist in `packages/core/src/nutrition/eating-out-table.ts` eine
Zutatenliste (Gramm roh je normaler Portion, wie eigene Gerichte aus Zutaten). Die Werte rechnet
`eatingOutRawValues` mit `computeRecipeFacts` aus dem Lebensmittel-Katalog (BLS 4.0); gerundet auf 10 kcal und ganze
Gramm. Bratfett ist als Öl-Aufnahme eingerechnet (Pommes: 250 g rohe Kartoffeln + 22 g Öl ≈ 150 g Portion). Kein
Ersatz durch „ähnliche“ Lebensmittel: Fehlt eine wesentliche Zutat (Butter, Mozzarella, Bratwurst, Fladenbrot …), ist
das Gericht ein Entwurf ohne Werte und erscheint in der App nicht.

**Tagebuch:** als Schnelleintrag „Auswärts gegessen“ (feste Bezeichnung aus `QUICK_ENTRY_LABELS`) – keine
Datenbank-Änderung, gleiche Grenzen und Rückfrage ab 1.500 kcal. Der Gerichtname wird NICHT gespeichert (Datenschutz
wie Schnelleintrag, kein Freitext); im Tagesverlauf steht „Auswärts gegessen · ca. 830 kcal“. „Kalorienzahlen aus“:
Eintrag ohne Werte. Favoriten/„Zuletzt“ nur auf dem Gerät (`fitnessapp.eating-out-picks.v1`, je Konto, nur Gericht-ID
und Portion, keine Uhrzeit, keine Werte).

**Sichtbarkeit:** Testmodus (`allowDrafts`) – alle berechenbaren Entwürfe mit „Entwurf“. Supabase-Modus – nur
Gerichte mit `status: 'released'` UND ausschließlich veröffentlichten, katalog-geprüften Lebensmitteln (R19 wie
`filter.ts`). Hinweis: Auch das Testmodus-Bündel der App enthält nur katalog-geprüfte Lebensmittel – deshalb zeigt die
Vercel-Vorschau heute **21** Gerichte (Spalte „B“ unten). Bis zur Freigabe zeigt der Supabase-Modus „Die Gerichte für
unterwegs werden gerade geprüft“ mit Weg zum Schnelleintrag.

### 1.1 Inhaltsstand (25.10.2026)

111 Gerichte (Restaurant 25, Imbiss 21, Kantine 20, Bäckerei 17, Café 18, Fast Food 10), alle `status: 'draft'`.

- **B = 21** berechenbar mit dem geprüften Katalog – sofort in der Vorschau, nach Freigabe auch live.
- **K = 44** berechenbar, sobald die genannten Katalog-Entwürfe die Katalog-Prüfung (R19) bestehen.
- **F = 46** Entwürfe ohne Werte – Zutat fehlt im Katalog (BLS-Import nötig).

Werte unten: normale Portion, aus dem Katalog gerechnet (E = Eiweiß, KH = Kohlenhydrate, F = Fett, je g).

| Kategorie  | Gericht                                             | normal =                                   | Schätzwert                          | Stand                                                                                                                                 |
| ---------- | --------------------------------------------------- | ------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Restaurant | Schnitzel Wiener Art mit Pommes                     | 1 Teller                                   | ca. 870 kcal · E 46 · KH 62 · F 48  | K – Katalog-Prüfung nötig: schweineschnitzel, paniermehl                                                                              |
| Restaurant | Schnitzel mit Kartoffelsalat                        | 1 Teller                                   | ca. 800 kcal · E 47 · KH 64 · F 39  | K – Katalog-Prüfung nötig: schweineschnitzel, paniermehl                                                                              |
| Restaurant | Jägerschnitzel mit Pommes                           | 1 Teller                                   | ca. 1030 kcal · E 52 · KH 68 · F 60 | K – Katalog-Prüfung nötig: schweineschnitzel, paniermehl                                                                              |
| Restaurant | Cordon bleu mit Pommes                              | 1 Teller                                   | ca. 1030 kcal · E 59 · KH 62 · F 59 | K – Katalog-Prüfung nötig: schweineschnitzel, paniermehl                                                                              |
| Restaurant | Hüftsteak mit Ofenkartoffel und Kräuterquark        | 1 Teller (200 g Steak)                     | ca. 620 kcal · E 60 · KH 57 · F 15  | K – Katalog-Prüfung nötig: salatmix                                                                                                   |
| Restaurant | Lachsfilet mit Reis und Gemüse                      | 1 Teller (160 g Lachs)                     | ca. 720 kcal · E 43 · KH 68 · F 29  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Restaurant | Spaghetti Bolognese                                 | 1 Teller                                   | ca. 850 kcal · E 41 · KH 97 · F 30  | K – Katalog-Prüfung nötig: spaghetti-trocken, rinderhackfleisch-5-fett, hackfleisch-vom-schwein, passierte-tomaten, tomatenmark       |
| Restaurant | Spaghetti mit Tomatensoße                           | 1 Teller                                   | ca. 640 kcal · E 22 · KH 95 · F 17  | K – Katalog-Prüfung nötig: spaghetti-trocken, passierte-tomaten                                                                       |
| Restaurant | Penne all’arrabbiata                                | 1 Teller                                   | ca. 580 kcal · E 18 · KH 91 · F 14  | K – Katalog-Prüfung nötig: spaghetti-trocken, gehackte-tomaten-dose                                                                   |
| Restaurant | Gnocchi mit Tomatensoße und Parmesan                | 1 Teller                                   | ca. 650 kcal · E 19 · KH 102 · F 16 | K – Katalog-Prüfung nötig: passierte-tomaten                                                                                          |
| Restaurant | Pilzrisotto                                         | 1 Teller                                   | ca. 580 kcal · E 20 · KH 76 · F 22  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Restaurant | Caesar Salad mit Hähnchen                           | 1 Schüssel                                 | ca. 500 kcal · E 40 · KH 16 · F 29  | K – Katalog-Prüfung nötig: toastbrot-weizen                                                                                           |
| Restaurant | Griechischer Bauernsalat                            | 1 Schüssel                                 | ca. 470 kcal · E 16 · KH 13 · F 38  | K – Katalog-Prüfung nötig: feta, oliven-schwarz                                                                                       |
| Restaurant | Thai-Curry mit Hähnchen und Reis                    | 1 Teller                                   | ca. 820 kcal · E 44 · KH 70 · F 38  | K – Katalog-Prüfung nötig: kokosmilch                                                                                                 |
| Restaurant | Pad Thai mit Garnelen                               | 1 Teller                                   | ca. 770 kcal · E 37 · KH 93 · F 27  | K – Katalog-Prüfung nötig: erdnussmus, limettensaft, zucker                                                                           |
| Restaurant | Burrito mit Rind, Reis und Bohnen                   | 1 Stück                                    | ca. 740 kcal · E 39 · KH 77 · F 28  | K – Katalog-Prüfung nötig: vollkorn-tortilla, rinderhackfleisch-5-fett, schwarze-bohnen-dose-abgetropft, mais-dose-abgetropft         |
| Restaurant | Bauernfrühstück                                     | 1 Pfanne                                   | ca. 550 kcal · E 28 · KH 49 · F 26  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Restaurant | Käsespätzle mit Röstzwiebeln                        | 1 Teller                                   | ca. 840 kcal · E 33 · KH 86 · F 40  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Restaurant | Pizza Margherita                                    | 1 Pizza (ca. 30 cm)                        | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Mozzarella (vollfett)                                                                  |
| Restaurant | Pizza Salami                                        | 1 Pizza (ca. 30 cm)                        | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Mozzarella (vollfett), Salami                                                          |
| Restaurant | Pizza Funghi                                        | 1 Pizza (ca. 30 cm)                        | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Mozzarella (vollfett)                                                                  |
| Restaurant | Pizza Tonno                                         | 1 Pizza (ca. 30 cm)                        | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Mozzarella (vollfett)                                                                  |
| Restaurant | Flammkuchen Elsässer Art                            | 1 Flammkuchen                              | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Schmand / Crème fraîche, Speck (durchwachsen)                                          |
| Restaurant | Lasagne                                             | 1 Portion                                  | –                                   | F – fehlt im Katalog: Butter, Weizenmehl Type 405/550, Vollmilch 3,5 %, Mozzarella (vollfett)                                         |
| Restaurant | Spaghetti Carbonara                                 | 1 Teller                                   | –                                   | F – fehlt im Katalog: Speck (durchwachsen)                                                                                            |
| Imbiss     | Pommes frites                                       | 1 Schale (ca. 150 g)                       | ca. 410 kcal · E 5 · KH 45 · F 22   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Imbiss     | Pommes rot-weiß                                     | 1 Schale                                   | –                                   | F – fehlt im Katalog: Tomatenketchup, Mayonnaise                                                                                      |
| Imbiss     | Currywurst mit Pommes                               | 1 Portion                                  | –                                   | F – fehlt im Katalog: Bratwurst (Schwein), Tomatenketchup                                                                             |
| Imbiss     | Currywurst (ohne Beilage)                           | 1 Wurst mit Soße                           | –                                   | F – fehlt im Katalog: Bratwurst (Schwein), Tomatenketchup                                                                             |
| Imbiss     | Bratwurst im Brötchen                               | 1 Stück                                    | –                                   | F – fehlt im Katalog: Bratwurst (Schwein)                                                                                             |
| Imbiss     | Döner Kebab                                         | 1 Döner im Fladenbrot                      | –                                   | F – fehlt im Katalog: Fladenbrot (Pide), Dönerfleisch (Kalb/Rind bzw. Hähnchen, gegart)                                               |
| Imbiss     | Dürüm Döner                                         | 1 Dürüm                                    | –                                   | F – fehlt im Katalog: Dönerfleisch (Kalb/Rind bzw. Hähnchen, gegart)                                                                  |
| Imbiss     | Hähnchen-Dürüm                                      | 1 Dürüm                                    | ca. 630 kcal · E 39 · KH 53 · F 28  | K – Katalog-Prüfung nötig: vollkorn-tortilla, haehnchenschenkelfilet-ohne-haut, blattsalat, rotkohl, joghurt-1-5                      |
| Imbiss     | Falafel-Teller mit Hummus und Salat                 | 1 Teller                                   | ca. 540 kcal · E 21 · KH 36 · F 30  | K – Katalog-Prüfung nötig: falafel-kuehlregal, salatmix, joghurt-1-5                                                                  |
| Imbiss     | Falafel-Wrap                                        | 1 Wrap                                     | ca. 570 kcal · E 21 · KH 61 · F 24  | K – Katalog-Prüfung nötig: vollkorn-tortilla, falafel-kuehlregal, salatmix, joghurt-1-5                                               |
| Imbiss     | Gyros-Teller mit Pommes und Tzatziki                | 1 Teller                                   | –                                   | F – fehlt im Katalog: Gyrosfleisch (Schweinenacken)                                                                                   |
| Imbiss     | Frikadelle im Brötchen                              | 1 Stück                                    | ca. 480 kcal · E 27 · KH 40 · F 23  | K – Katalog-Prüfung nötig: rinderhackfleisch-5-fett, hackfleisch-vom-schwein, paniermehl                                              |
| Imbiss     | Leberkässemmel                                      | 1 Semmel                                   | –                                   | F – fehlt im Katalog: Leberkäse                                                                                                       |
| Imbiss     | Fischbrötchen (Matjes/Bismarck)                     | 1 Stück                                    | –                                   | F – fehlt im Katalog: Matjes/Bismarckhering                                                                                           |
| Imbiss     | Räucherlachs-Brötchen                               | 1 Stück                                    | ca. 250 kcal · E 15 · KH 34 · F 6   | K – Katalog-Prüfung nötig: blattsalat                                                                                                 |
| Imbiss     | Bratkartoffeln                                      | 1 Portion                                  | ca. 440 kcal · E 6 · KH 56 · F 20   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Imbiss     | Reibekuchen mit Apfelmus                            | 3 Reibekuchen                              | ca. 570 kcal · E 10 · KH 65 · F 28  | K – Katalog-Prüfung nötig: apfelmus-ungesuesst                                                                                        |
| Imbiss     | Gebratene Nudeln mit Gemüse                         | 1 Box                                      | ca. 570 kcal · E 21 · KH 72 · F 20  | K – Katalog-Prüfung nötig: mie-nudeln                                                                                                 |
| Imbiss     | Gebratene Nudeln mit Hähnchen                       | 1 Box                                      | ca. 630 kcal · E 40 · KH 71 · F 19  | K – Katalog-Prüfung nötig: mie-nudeln                                                                                                 |
| Imbiss     | Gebratener Reis mit Ei und Gemüse                   | 1 Box                                      | ca. 560 kcal · E 18 · KH 71 · F 21  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Imbiss     | Halbes Grillhähnchen                                | ½ Hähnchen                                 | –                                   | F – fehlt im Katalog: Brathähnchen mit Haut (gegart)                                                                                  |
| Kantine    | Kantinen-Tagesgericht mit Fleisch                   | 1 Teller (Fleisch, Beilage, Gemüse, Soße)  | ca. 580 kcal · E 43 · KH 57 · F 19  | K – Katalog-Prüfung nötig: schweineschnitzel                                                                                          |
| Kantine    | Kantinen-Tagesgericht vegetarisch                   | 1 Teller (Nudeln, Gemüse, Käsesoße)        | ca. 720 kcal · E 29 · KH 80 · F 28  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Kantine    | Kantinen-Tagesgericht mit Fisch                     | 1 Teller (Fisch, Kartoffeln, Gemüse, Soße) | ca. 720 kcal · E 44 · KH 72 · F 26  | K – Katalog-Prüfung nötig: seelachsfilet-tk, paniermehl                                                                               |
| Kantine    | Hähnchenbrust mit Reis und Gemüse                   | 1 Teller                                   | ca. 620 kcal · E 47 · KH 69 · F 16  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Kantine    | Chili con Carne mit Brot                            | 1 Teller                                   | ca. 590 kcal · E 38 · KH 56 · F 19  | K – Katalog-Prüfung nötig: rinderhackfleisch-5-fett, kidneybohnen-dose-abgetropft, mais-dose-abgetropft, gehackte-tomaten-dose        |
| Kantine    | Chili sin Carne mit Reis                            | 1 Teller                                   | ca. 620 kcal · E 24 · KH 94 · F 11  | K – Katalog-Prüfung nötig: kidneybohnen-dose-abgetropft, schwarze-bohnen-dose-abgetropft, mais-dose-abgetropft, gehackte-tomaten-dose |
| Kantine    | Gemüse-Curry mit Reis                               | 1 Teller                                   | ca. 700 kcal · E 18 · KH 83 · F 29  | K – Katalog-Prüfung nötig: kichererbsen-dose-abgetropft, blumenkohl, kokosmilch                                                       |
| Kantine    | Frikadelle mit Bratkartoffeln                       | 1 Teller                                   | ca. 740 kcal · E 32 · KH 56 · F 42  | K – Katalog-Prüfung nötig: rinderhackfleisch-5-fett, hackfleisch-vom-schwein, paniermehl                                              |
| Kantine    | Linseneintopf (ohne Würstchen)                      | 1 Teller                                   | ca. 350 kcal · E 17 · KH 47 · F 7   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Kantine    | Linseneintopf mit Würstchen                         | 1 Teller                                   | –                                   | F – fehlt im Katalog: Wiener Würstchen                                                                                                |
| Kantine    | Tomatensuppe                                        | 1 Teller (300 ml)                          | ca. 140 kcal · E 3 · KH 10 · F 7    | K – Katalog-Prüfung nötig: passierte-tomaten                                                                                          |
| Kantine    | Kartoffelsuppe                                      | 1 Teller (300 ml)                          | ca. 220 kcal · E 5 · KH 32 · F 8    | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Kantine    | Salatbar-Teller mit Dressing                        | 1 Teller                                   | ca. 230 kcal · E 6 · KH 18 · F 12   | K – Katalog-Prüfung nötig: salatmix, mais-dose-abgetropft, kichererbsen-dose-abgetropft                                               |
| Kantine    | Ofenkartoffel mit Kräuterquark                      | 1 Teller                                   | ca. 430 kcal · E 22 · KH 68 · F 6   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Kantine    | Milchreis mit Kirschen                              | 1 Schale                                   | ca. 440 kcal · E 16 · KH 82 · F 5   | K – Katalog-Prüfung nötig: milchreis-rundkornreis, zucker, sauerkirschen-glas-abgetropft                                              |
| Kantine    | Pfannkuchen mit Apfelmus                            | 2 Pfannkuchen                              | ca. 590 kcal · E 24 · KH 76 · F 19  | K – Katalog-Prüfung nötig: apfelmus-ungesuesst, zucker                                                                                |
| Kantine    | Paniertes Seelachsfilet mit Kartoffelsalat          | 1 Teller                                   | ca. 690 kcal · E 39 · KH 60 · F 31  | K – Katalog-Prüfung nötig: seelachsfilet-tk, paniermehl                                                                               |
| Kantine    | Rindergulasch mit Nudeln                            | 1 Teller                                   | –                                   | F – fehlt im Katalog: Rindfleisch Gulasch (Schulter/Wade)                                                                             |
| Kantine    | Schweinebraten mit Knödel                           | 1 Teller                                   | –                                   | F – fehlt im Katalog: Schweinebraten (Schulter/Nacken), Kartoffel- oder Semmelknödel                                                  |
| Kantine    | Maultaschen in Brühe                                | 3 Maultaschen                              | –                                   | F – fehlt im Katalog: Maultaschen                                                                                                     |
| Bäckerei   | Laugenbrezel                                        | 1 Brezel (ca. 80 g)                        | ca. 230 kcal · E 7 · KH 40 · F 3    | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Bäckerei   | Butterbrezel                                        | 1 Brezel                                   | –                                   | F – fehlt im Katalog: Butter                                                                                                          |
| Bäckerei   | Brötchen (Weizen), pur                              | 1 Brötchen (ca. 60 g)                      | ca. 170 kcal · E 6 · KH 32 · F 1    | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Bäckerei   | Vollkornbrötchen, pur                               | 1 Brötchen (ca. 70 g)                      | ca. 200 kcal · E 7 · KH 34 · F 2    | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Bäckerei   | Käsebrötchen                                        | 1 Stück                                    | –                                   | F – fehlt im Katalog: Butter                                                                                                          |
| Bäckerei   | Schinkenbrötchen                                    | 1 Stück                                    | –                                   | F – fehlt im Katalog: Butter                                                                                                          |
| Bäckerei   | Vollkornbrötchen mit Putenbrust und Frischkäse      | 1 Stück                                    | ca. 270 kcal · E 17 · KH 35 · F 5   | K – Katalog-Prüfung nötig: blattsalat                                                                                                 |
| Bäckerei   | Mettbrötchen                                        | 1 Stück                                    | –                                   | F – fehlt im Katalog: Schweinemett (Hackepeter)                                                                                       |
| Bäckerei   | Croissant                                           | 1 Stück                                    | –                                   | F – fehlt im Katalog: Plunder-/Blätterteig                                                                                            |
| Bäckerei   | Laugencroissant                                     | 1 Stück                                    | –                                   | F – fehlt im Katalog: Plunder-/Blätterteig                                                                                            |
| Bäckerei   | Franzbrötchen                                       | 1 Stück                                    | –                                   | F – fehlt im Katalog: Plunder-/Blätterteig                                                                                            |
| Bäckerei   | Berliner / Krapfen                                  | 1 Stück                                    | –                                   | F – fehlt im Katalog: Hefeteig süß / Rührteig                                                                                         |
| Bäckerei   | Streuselkuchen                                      | 1 Stück                                    | –                                   | F – fehlt im Katalog: Hefeteig süß / Rührteig, Butter                                                                                 |
| Bäckerei   | Käsekuchen                                          | 1 Stück                                    | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Butter                                                                                 |
| Bäckerei   | Apfelkuchen                                         | 1 Stück                                    | –                                   | F – fehlt im Katalog: Weizenmehl Type 405/550, Butter                                                                                 |
| Bäckerei   | Laugenstange mit Käse überbacken                    | 1 Stück                                    | ca. 320 kcal · E 13 · KH 40 · F 11  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Bäckerei   | Toast Hawaii                                        | 1 Stück                                    | ca. 220 kcal · E 14 · KH 17 · F 10  | K – Katalog-Prüfung nötig: toastbrot-weizen, ananas-dose-abgetropft                                                                   |
| Café       | Espresso                                            | 1 Tasse (30 ml)                            | ca. 0 kcal · E 0 · KH 0 · F 0       | K – Katalog-Prüfung nötig: espresso-zubereitet                                                                                        |
| Café       | Cappuccino (fettarme Milch)                         | 1 Tasse (0,2 l)                            | ca. 70 kcal · E 5 · KH 6 · F 2      | K – Katalog-Prüfung nötig: espresso-zubereitet                                                                                        |
| Café       | Cappuccino (Vollmilch)                              | 1 Tasse (0,2 l)                            | –                                   | F – fehlt im Katalog: Vollmilch 3,5 %                                                                                                 |
| Café       | Latte Macchiato (fettarme Milch)                    | 1 Glas (0,3 l)                             | ca. 110 kcal · E 9 · KH 10 · F 4    | K – Katalog-Prüfung nötig: espresso-zubereitet                                                                                        |
| Café       | Latte Macchiato (Vollmilch)                         | 1 Glas (0,3 l)                             | –                                   | F – fehlt im Katalog: Vollmilch 3,5 %                                                                                                 |
| Café       | Milchkaffee (fettarme Milch)                        | 1 Tasse (0,3 l)                            | ca. 90 kcal · E 7 · KH 8 · F 3      | K – Katalog-Prüfung nötig: espresso-zubereitet                                                                                        |
| Café       | Cappuccino mit Sojadrink                            | 1 Tasse (0,2 l)                            | ca. 50 kcal · E 5 · KH 1 · F 2      | K – Katalog-Prüfung nötig: espresso-zubereitet, sojadrink-ungesuesst                                                                  |
| Café       | Heiße Schokolade                                    | 1 Tasse (0,25 l)                           | ca. 200 kcal · E 11 · KH 26 · F 5   | K – Katalog-Prüfung nötig: zucker                                                                                                     |
| Café       | Heiße Schokolade mit Sahne                          | 1 Tasse (0,25 l)                           | –                                   | F – fehlt im Katalog: Schlagsahne 30 %                                                                                                |
| Café       | Chai Latte                                          | 1 Tasse (0,3 l)                            | –                                   | F – fehlt im Katalog: Chai-Sirup/-Pulver                                                                                              |
| Café       | Orangensaft                                         | 1 Glas (0,2 l)                             | ca. 80 kcal · E 2 · KH 17 · F 0     | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Café       | Apfelschorle                                        | 1 Glas (0,4 l)                             | –                                   | F – fehlt im Katalog: Apfelsaft                                                                                                       |
| Café       | Bananen-Beeren-Smoothie                             | 1 Becher (0,3 l)                           | ca. 190 kcal · E 3 · KH 35 · F 1    | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Café       | Bircher Müsli                                       | 1 Schale                                   | ca. 380 kcal · E 15 · KH 51 · F 11  | K – Katalog-Prüfung nötig: joghurt-1-5                                                                                                |
| Café       | Rührei mit Brot                                     | 1 Teller (3 Eier)                          | ca. 430 kcal · E 27 · KH 25 · F 24  | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Café       | Avocado-Brot                                        | 2 Scheiben                                 | ca. 330 kcal · E 9 · KH 41 · F 11   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Café       | Frühstück „Kontinental“ (Brötchen, Käse, Konfitüre) | 1 Teller                                   | –                                   | F – fehlt im Katalog: Butter                                                                                                          |
| Café       | Croque Monsieur                                     | 1 Stück                                    | –                                   | F – fehlt im Katalog: Butter, Vollmilch 3,5 %                                                                                         |
| Fast Food  | Hamburger                                           | 1 Stück                                    | –                                   | F – fehlt im Katalog: Burgerbrötchen, Rinderhackfleisch (ca. 20 % Fett), Tomatenketchup                                               |
| Fast Food  | Cheeseburger                                        | 1 Stück                                    | –                                   | F – fehlt im Katalog: Burgerbrötchen, Rinderhackfleisch (ca. 20 % Fett), Tomatenketchup, Schmelzkäse-Scheibe                          |
| Fast Food  | Großer Burger (doppelt, mit Soße)                   | 1 Stück                                    | –                                   | F – fehlt im Katalog: Burgerbrötchen, Rinderhackfleisch (ca. 20 % Fett), Schmelzkäse-Scheibe, Mayonnaise                              |
| Fast Food  | Chicken Nuggets                                     | 6 Stück                                    | –                                   | F – fehlt im Katalog: Hähnchen-Nuggets (paniert, frittiert)                                                                           |
| Fast Food  | Pommes (Fast Food)                                  | mittlere Portion (ca. 115 g)               | ca. 300 kcal · E 4 · KH 34 · F 16   | B – berechenbar (geprüfter Katalog)                                                                                                   |
| Fast Food  | Chicken-Wrap (gegrillt)                             | 1 Wrap                                     | ca. 430 kcal · E 31 · KH 36 · F 17  | K – Katalog-Prüfung nötig: vollkorn-tortilla, blattsalat, joghurt-1-5                                                                 |
| Fast Food  | Hot Dog                                             | 1 Stück                                    | –                                   | F – fehlt im Katalog: Hot-Dog-Brötchen, Wiener Würstchen, Tomatenketchup                                                              |
| Fast Food  | Milchshake Vanille                                  | 1 Becher (0,3 l)                           | –                                   | F – fehlt im Katalog: Speiseeis Vanille                                                                                               |
| Fast Food  | Cola                                                | 1 Becher (0,4 l)                           | –                                   | F – fehlt im Katalog: Cola (zuckerhaltig)                                                                                             |
| Fast Food  | Salat-Bowl mit Hähnchen                             | 1 Bowl                                     | ca. 370 kcal · E 29 · KH 32 · F 13  | K – Katalog-Prüfung nötig: salatmix, mais-dose-abgetropft                                                                             |

### 1.2 Was die Gründer freigeben müssen

1. **Gerichte freigeben** (Zusammensetzung und Mengen sind Annahmen für eine übliche Portion – fachlich prüfen, v. a.
   Öl-Aufnahme, Portionsgrößen und die Notizen `note_de`): in `eating-out-table.ts` je Gericht `status: 'released'`,
   `reviewed_by`, `reviewed_at` setzen (Pull Request, Freigabe = Merge; Test: freigegeben nur mit Prüfer). Am besten
   zuerst die 21 Gerichte „B“.
2. **Katalog-Prüfung (R19)** dieser 35 Lebensmittel-Entwürfe (in Klammern: Anzahl Gerichte, die dadurch berechenbar
   werden): paniermehl (8), espresso-zubereitet (5), joghurt-1-5 (5), mais-dose-abgetropft (5), rinderhackfleisch-5-fett
   (5), salatmix (5), schweineschnitzel (5), blattsalat (4), passierte-tomaten (4), vollkorn-tortilla (4), zucker (4),
   gehackte-tomaten-dose (3), hackfleisch-vom-schwein (3), spaghetti-trocken (3), apfelmus-ungesuesst (2),
   falafel-kuehlregal (2), kichererbsen-dose-abgetropft (2), kidneybohnen-dose-abgetropft (2), kokosmilch (2),
   mie-nudeln (2), schwarze-bohnen-dose-abgetropft (2), seelachsfilet-tk (2), toastbrot-weizen (2),
   ananas-dose-abgetropft, blumenkohl, erdnussmus, feta, haehnchenschenkelfilet-ohne-haut, limettensaft,
   milchreis-rundkornreis, oliven-schwarz, rotkohl, sauerkirschen-glas-abgetropft, sojadrink-ungesuesst, tomatenmark (je 1).
3. **Fehlende Lebensmittel importieren** (Workflow `foods-import`, Modus „kandidaten“ → Quell-ID in die Zuordnung →
   Modus „import“; Suchbegriffe stehen in der Tabelle unter `missing`): Butter (9 Gerichte), Weizenmehl 405/550 (8),
   Tomatenketchup (6), Mozzarella vollfett (5), Vollmilch 3,5 % (4), Bratwurst (3), Burgerbrötchen (3),
   Plunder-/Blätterteig bzw. Croissant (3), Rinderhack ~20 % Fett (3), Dönerfleisch (2), süßer Hefeteig/Rührkuchen (2),
   Mayonnaise (2), Schmelzkäse (2), Speck (2), Wiener Würstchen (2), je 1: Apfelsaft, Brathähnchen mit Haut, Chai,
   Cola, Fladenbrot, Gyrosfleisch, Nuggets, Hot-Dog-Brötchen, Knödel, Leberkäse, Matjes/Bismarck, Maultaschen,
   Rindergulasch, Salami, Schlagsahne, Schmand/Crème fraîche, Schweinebraten, Mett, Vanilleeis. Danach erst die
   Gerichte freigeben (sonst bleiben sie ohne Werte). Die Zuordnungsdatei `alpha5-zuordnung.json` ist bisher nur für
   Alpha5-Zutaten; für die neuen Lebensmittel braucht es eine kurze Entscheidung, wo die Zuordnung liegt (G-AV2).

### 1.3 Gründer-Fragen

- **G-AV1:** Gerichtname im Tagebuch? Heute „Auswärts gegessen · ca. … kcal“ (keine DB-Änderung, kein Freitext). Mit
  einer neuen Herkunft `eating_out` (Spalte `eating_out_id`, neue Fassung von `save_food_log_entries`) könnte der Name
  wie bei eigenen Gerichten angezeigt werden.
- **G-AV2:** Ablage der Zuordnung für die fehlenden BLS-Lebensmittel (siehe 1.2 Nr. 3).
- **G-AV3:** „Zuletzt unterwegs“ liegt unverschlüsselt im Gerätespeicher (nur IDs, keine Zeit/Werte, je Konto) – ok,
  oder in den verschlüsselten Ernährungs-Speicher verschieben und beim Widerruf leeren?

## 2. Vorratsschrank

Ernährung → „Vorratsschrank“ (`/ernaehrung/vorrat`), Link auch auf der Einkaufsliste. Regeln in
`packages/core/src/nutrition/pantry.ts`, Grenzen `PANTRY` in `constants.ts`.

- **Einträge:** Lebensmittel aus dem Katalog (Suche wie im Tagebuch oder Strichcode – gleiche Abfrage wie im Laden,
  `matchScannedPantryFood` gegen den ganzen Katalog; nichts wird ohne Tipp hinzugefügt). Menge optional in
  Kaufeinheiten aus `SHOPPING_BUY_UNITS` (0,5–99 in halben Schritten, Packungsgröße wählbar), „fast leer“. Öl, Essig,
  Gewürze nur „da“/„fast leer“. Höchstens 300.
- **Einkaufsliste** (`shoppingPantryView`, reine Anzeige): reicht → „Schon im Vorrat“ (eingeklappt); teilweise →
  Restmenge mit Hinweis; „fast leer“ bleibt mit „Vorrat fast leer“; ohne Menge → „Menge prüfen“ unter „Schon im Vorrat“.
  Fortschritt zählt nur, was zu kaufen ist.
- **Vorrat nach Einkauf aktualisieren** (`pantryAfterShopping`): abgehakte haltbare Lebensmittel (Katalog `pantry`,
  Tiefkühl, „Vorrat prüfen“) mit der gekauften Menge in den Vorrat (addiert, „fast leer“ aufgehoben); Frisches bleibt
  draußen.
- **Kühlschrank-Suche/Vorschläge** (`fridge-search.ts`): Vorrat zählt als vorhanden („fast leer“ halb), ohne Auswahl
  „Passt zu deinem Vorrat“, bei Gleichstand zuerst mehr Vorrats-Zutaten; abschaltbar. Der Essensplan wird NICHT
  gewichtet (bewusst – parallele Arbeit an Favoriten im Planer).
- **Daten:** Tabelle `pantry_items` (Migration `20261025120300_pantry_items.sql`): RLS (nur eigene lesen), Schreiben nur
  über `save_pantry_item` (Einwilligung `health_data`, letzter Stand gewinnt über den Geräte-Zeitpunkt, `stale`/`limit`)
  und `delete_pantry_item` (immer). Widerruf `health_data` löscht über eigenen Trigger, Export `export_my_data()` enthält
  `pantry_items` (damit 50 Schlüssel = 100 Argumente von `jsonb_build_object` – der nächste Schlüssel braucht ein
  zweites Objekt), Konto löschen per Kaskade. pgTAP `81_pantry_items.test.sql` (40 Prüfungen).
- **Offline-first:** Testmodus Gerätespeicher; Supabase-Modus sofort lokal, Senden über die verschlüsselte
  Ernährungs-Warteschlange (`pantry_save`/`pantry_delete`).

## 3. So testest du es am Handy (Vercel-Vorschau, Testmodus)

1. Vorschau-Link öffnen → Testmodus starten → Onboarding mit Ernährung.
2. Ernährung → Eintragen → „Unterwegs“ → „Kantine“ → „Hähnchenbrust mit Reis und Gemüse“ → „groß“ → Eintragen. Im
   Tagesverlauf: „Auswärts gegessen · ca. … kcal“. Erneut „Unterwegs“: oben „Zuletzt unterwegs“.
3. Ernährung → „Vorratsschrank“ → „Haferflocken“ suchen und hinzufügen → „Menge“ → „+ Mehr“, Packungsgröße 1 kg;
   „Olivenöl“ hinzufügen → „Fast leer“.
4. Einkaufen: Abschnitt „Schon im Vorrat“; Haken setzen → „Vorrat nach Einkauf aktualisieren“.
5. Rezepte → „Was habe ich da?“ → „Meinen Vorrat mitzählen“ → „Passt zu deinem Vorrat“.

## 4. Offene Punkte

- Weitergeben/PDF der Einkaufsliste berücksichtigen den Vorrat noch nicht (zeigen die volle Liste).
- Verbrauch wird nicht automatisch vom Vorrat abgezogen (Kochen/Essen) – die Person pflegt Mengen selbst.
- Supabase-Modus erst nach `db-migrate` (Merge) und Freigaben aus 1.2.
