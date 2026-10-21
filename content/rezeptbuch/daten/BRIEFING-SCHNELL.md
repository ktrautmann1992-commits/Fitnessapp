# Ergänzung: Kapitel „Fertig in 10 Minuten“

Lies zuerst BRIEFING.md (Schema, Zutatenregeln, Abteilungen). Abweichend gilt:

## Umfang
Genau 10 Rezepte, 1 Portion, Datei: schnell.json (gleiches Schema). Echte Gesamtzeit inkl. Vorbereitung höchstens 10 Minuten ("zeit_min" 3–10). Ehrlich rechnen: kein Ofen, kein Kochen von rohem Reis/Nudeln/Kartoffeln, keine Wartezeiten (kein Einweichen über Nacht). Erlaubt: Pfanne, Wasserkocher, Mikrowelle, Sandwichtoaster, Mixer. Convenience aus dem Supermarkt ist ausdrücklich erwünscht: Express-Reis im Beutel ("Express-Reis (Beutel, gegart)"), vorgegarte Linsen/Kichererbsen/Bohnen aus der Dose, Wraps, Vollkornbrot, TK-Gemüse, fertiger Salat, Räucherlachs, Thunfisch aus der Dose, Hähnchenbrust-Aufschnitt, Putenbrust-Aufschnitt, gekochter Kochschinken, Hüttenkäse, Skyr, Hummus, Räuchertofu, Instant-Couscous (5 Min. quellen zählt mit).
Proteinpulver ist erlaubt (höchstens 3 Rezepte), Namen: "Whey-Proteinpulver (Vanille)", "Whey-Proteinpulver (Schoko)", "Veganes Proteinpulver (Vanille)", "Veganes Proteinpulver (Schoko)".

## Mischung
- Mahlzeiten: 3 × "Frühstück", 2 × "Mittagessen", 2 × "Abendessen", 3 × "Snack". Kalorien-/Eiweißziele wie im BRIEFING.md.
- Ernährungsformen: 3 vegan, 3 vegetarisch, 2 mit Schweinefleisch (mager, z. B. Kochschinken, Lachsschinken, Schweinefilet-Streifen), 2 ohne Schweinefleisch mit Fleisch oder Fisch.
- Neues Pflichtfeld je Rezept: "passt_fuer": Liste der Gruppen, für die das Rezept geeignet ist, aus "vegan", "vegetarisch", "fleisch", "ohne-schwein". Logik: vegan → alle vier; vegetarisch → vegetarisch, fleisch, ohne-schwein; mit Schwein → nur fleisch; Geflügel/Rind/Fisch ohne Schwein → fleisch, ohne-schwein.
- Keine Gerichte, die schon in einer der Dateien vegan.json, vegan-2.json, vegetarisch.json, vegetarisch-2.json, fleisch.json, fleisch-2.json, ohne-schwein.json, ohne-schwein-2.json vorkommen (Namen dort im "recipes"-Block nachsehen). Klar andere Grundideen.
- Zubereitung: 3–5 kurze Schritte, sichtbar auf Tempo ausgelegt (z. B. "Während die Pfanne heiß wird, …"). "tipp": ein Zeitspar- oder Austausch-Tipp.
- "tags": "Unter 10 Minuten" immer als erstes Tag, optional ein zweites aus der Liste im Briefing.
- Für gleiche Zutaten dieselben Namen und Nährwerte wie in den vorhandenen Dateien verwenden.

Prüfe am Ende per Python-Skript wie im BRIEFING.md beschrieben, zusätzlich: zeit_min ≤ 10, passt_fuer korrekt und konsistent mit den Zutaten. Gib eine kurze Tabelle zurück (Name, Mahlzeit, Ernährungsform, Minuten, kcal, Eiweiß).
