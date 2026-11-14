# Essen frei eintragen – Plan und Umsetzungsstand

Gründer-Rückmeldung aus der Testphase (14.11.2026): „Man kann kaum vom Rezept abweichen oder eigenes Essen einfach
eintragen.“ Ziel: mit sehr wenigen Tipps eintragen, was man wirklich gegessen hat. Gratis, ohne KI.

## 1. Was die Person sieht

1. **An jeder Plan-Mahlzeit** (z. B. Frühstück) zwei Knöpfe: **„Wie geplant gegessen“** (wie bisher „Gegessen“, mit
   Portion ½ … 2) und **„Etwas anderes gegessen“**. Der zweite öffnet „Eintragen“ für genau diesen Platz (auch
   Zwischenmahlzeiten wie `snack_morning`), mit Hinweis oben und vorausgewählter Suche.
2. Ist für den Platz etwas anderes eingetragen, steht dort „Etwas anderes gegessen: Gouda, Vollkornbrot“ und
   „Noch etwas dazu eintragen“. Die Plan-Mahlzeit gilt als **ersetzt**: nicht offen, nicht gegessen; die Tagessumme
   enthält nur, was eingetragen ist. Tagesauswertung: „Mahlzeiten: 2 von 4 abgehakt · 1 durch etwas anderes ersetzt“.
3. **Suche:** „Käse“ zeigt alle Käse (Gouda, Feta, Parmesan, Halloumi …), „Brot“ alle Brote und Brötchen, „Milch“ auch
   Pflanzendrinks. Umlaute und ß egal („kase“), leichte Tippfehler ab 5 Buchstaben („Gauda“ → Gouda). Reihenfolge:
   Name beginnt mit dem Wort → Wort im Namen → Suchbegriff → Lebensmittel-Art → mitten im Wort → Tippfehler.
4. **Menge:** nach dem Tipp auf ein Lebensmittel Einheit wählen – passend vorausgewählt (Brot/Käse → Scheibe,
   Cornflakes → Handvoll, Milch → Glas, Banane → Stück) oder Gramm/ml – und Anzahl per Tipp (½, 1, 2, 3) oder Eingabe;
   darunter „≈ 50 g“. Dann **„Eintragen“** oder **„Zur Mahlzeit“**.
5. **Richtwerte statt Gramm (Gründer-Klarstellung 14.11.2026):** Niemand muss Gramm kennen – „1 Scheibe“, „1 Handvoll“
   mit ½/1/2/3 genügt; kcal und Makros kommen aus den Werten je 100 g des Katalogs. Unter der Menge steht dezent
   „≈ 25 g · Richtwert“.
6. **Fehlt ein Alltags-Lebensmittel im Katalog** (Emmentaler, Mischbrot, Birne, Müsli …), findet die Suche es trotzdem
   unter seinem Namen; gerechnet wird mit dem ähnlichsten Katalog-Lebensmittel (Emmentaler → Gouda, Mischbrot →
   Vollkornbrot, Birne → Apfel), Hinweis „Noch nicht in unserer Lebensmittel-Liste – wir rechnen mit den Werten von
   Gouda (Richtwert)“. Im Tagebuch: Titel „Emmentaler (≈ Gouda)“, Verweis auf Gouda (Server rechnet wie bisher nach).
   Tabelle `FOOD_STAND_INS` (27 Einträge); sobald `foods-import` die echte ID liefert, entfällt der Ersatz von selbst.
7. **Jedes Lebensmittel hat Haushaltsmengen (Gründer-Vorgabe 14.11.2026):** Reihenfolge eigene Werte → Stückgewicht der
   Einkaufsliste → Art (Käse/Brot → Scheibe, Joghurt → Becher/EL, Flocken → Handvoll/EL/Schale, Nüsse → Handvoll,
   Getränke → Glas) → Katalog-Einheiten → **Rückfall je Quell-Kategorie** (`HOUSEHOLD_UNITS_BY_CATEGORY`: Öl → EL/TL,
   Fleisch/Fisch → Portion 125 g, Gemüse → Handvoll/Portion, Obst → Stück …). Test über den ganzen Katalog: kein
   Lebensmittel ohne Einheit.
8. **„Deine Mahlzeit“ (Korb):** mehrere Lebensmittel sammeln („2 Scheiben Gouda“, „1 Scheibe Vollkornbrot“), entfernen,
   **„Alle 2 Lebensmittel eintragen“** (je Lebensmittel ein Tagebuch-Eintrag, ein Speichervorgang). **„Als Favorit
   speichern“** mit vorgeschlagenem Namen („Käsebrot“, „Butterbrot“, sonst „Cornflakes mit Milch 1,5 % und Banane“) –
   gespeichert als eigenes Gericht „Aus Zutaten“ (1 Portion). Bowls: Joghurt (1 Becher) + Haferflocken (2 EL) + Banane
   (1 Stück) + Mandeln (1 Handvoll) → Name „Joghurt-Bowl“, danach mit einem Tipp wieder eintragbar.
9. **„Mit einem Tipp“** oben im Eintragen-Bildschirm: „Deine Favoriten“ (eigene Gerichte – zuletzt zu dieser Mahlzeit
   gegessene zuerst – und Stern-Favoriten) und „Zuletzt gegessen“ (6). Ein Tipp trägt sofort ein (Standardportion).

## 2. Entscheidungen

- **Keine Änderung an Datenbank oder Tagebuch-Format.** Haushaltsmengen werden beim Eintragen in Gramm umgerechnet
  (`resolveFoodAmount`); gespeichert wird `unit = g` (Stück mit Gewicht im Katalog bleibt `piece` wie bisher). Damit
  bleiben der CHECK `unit in (g, ml, piece)`, `save_food_log_entries` und die Nachrechnung des Servers unverändert.
  Folge: Im Tagesverlauf steht „50 g“ statt „2 Scheiben“ (offener Punkt 4.1).
- **Haushaltsmengen und Suchbegriffe in `packages/core/src/nutrition/food-household-table.ts`**, nicht in
  `content/foods` (geschützt, nur `foods-import`, Job sources-integrity) und nicht als neuer Inhalte-Ordner (der
  Supabase-Modus lädt Inhalte aus der Datenbank – ein neuer Ordner bräuchte Tabelle, Migration und Seed). Je Art
  Standardwerte, je Lebensmittel Ausnahmen; Stückgewichte aus der Einkaufsliste (`SHOPPING_BUY_UNITS`); Einheiten des
  Katalogs (`piece_g`, `tbsp_g`, `tsp_g`) haben Vorrang. Quellen im Dateikopf (BZfE-Portionsgrößen, DGE, übliche
  Packungsangaben). **Alle Grammwerte PRODUKTENTSCHEIDUNG – vor Livegang fachlich prüfen.**
- Grenzen in `constants.ts` (`FOOD_HOUSEHOLD_LIMITS`): Anzahl ½–20 in ½-Schritten, umgerechnet 1–2.000 g; Korb
  höchstens 15 Lebensmittel; 6 Schnellknöpfe; Art-Suche ab 3, Tippfehler ab 5 Zeichen (nur bei weniger als 3 echten
  Treffern).
- Datenschutz unverändert: Einträge nur mit Einwilligung `health_data`; der Favoriten-Name ist Freitext eines eigenen
  Gerichts (Regeln aus E2: nie in Logs, testIDs oder Analytics). Keine kcal in Knöpfen oder testIDs.

## 3. Umsetzung

| Teil                               | Datei                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Tabelle Arten/Haushaltsmengen      | `packages/core/src/nutrition/food-household-table.ts`                                                                                 |
| Suche                              | `packages/core/src/nutrition/food-search.ts` (`searchFoods`, genutzt von `searchFoodLogCatalog`)                                      |
| Mengen, Korb, Favorit, Plan-Status | `packages/core/src/nutrition/food-household.ts`                                                                                       |
| Tagesauswertung „ersetzt“          | `packages/core/src/evaluation/day-evaluation.ts` (`meals.replaced`)                                                                   |
| Tests                              | `food-household.test.ts`, `day-evaluation.test.ts`, `packages/content/src/foods/household-units.test.ts` (echter Katalog)             |
| App                                | `components/food-log.tsx` (zwei Knöpfe), `components/food-log-free.tsx` (Schnellauswahl, Menge, Korb), `app/ernaehrung/eintragen.tsx` |
| E2E                                | `apps/mobile/e2e/essen-frei-eintragen.spec.ts`                                                                                        |

## 4. Offene Punkte

1. Anzeige „2 Scheiben Gouda“ statt „50 g“ im Tagesverlauf bräuchte eine Spalte für die Haushaltsmenge
   (Migration + `save_food_log_entries`) – eigener Schritt, wenn gewünscht.
2. Grammwerte fachlich prüfen lassen (Ernährungsfachkraft), v. a. Handvoll-Werte.
3. Fehlende Alltags-Lebensmittel (Emmentaler, Mischbrot, Müsli, Margarine …): `docs/FEHLENDE-LEBENSMITTEL.md` – über
   den Workflow `foods-import` ergänzen; neue IDs danach in die Tabelle aufnehmen.
4. Mozzarella, Butter, Schmelzkäse u. a. sind im Katalog noch Entwurf und erscheinen im Supabase-Modus erst nach
   Freigabe.

## 5. So testest du es am Handy

1. Vercel-Vorschau öffnen → Testmodus → Onboarding mit Ernährung.
2. Ernährung → beim Frühstück „Etwas anderes gegessen“.
3. „Käse“ tippen → Gouda → „2“ → „Zur Mahlzeit“; „Brot“ → Vollkornbrot → „Zur Mahlzeit“.
4. „Alle 2 Lebensmittel eintragen“ → „Als Favorit speichern“ (Name „Käsebrot“).
5. Zurück: Beim Frühstück steht „Etwas anderes gegessen: …“.
6. Am nächsten Tag „Eintragen“ öffnen → oben unter „Deine Favoriten“ „Käsebrot“ antippen – fertig.
