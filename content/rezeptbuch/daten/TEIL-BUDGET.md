## Kapitel SPAR-KÜCHE → Datei budget.json
Lies BRIEFING.md, dann BRIEFING-TRAINING.md (Feld passt_fuer, Proteinpulver-Namen, Konsistenz). Dieses Teil hat Vorrang.
Genau 10 Rezepte, 1 Portion, Tag "Spar-Küche" als erstes Tag. Fitnessgerecht und günstig: Haferflocken, Linsen, Bohnen, Kichererbsen, Eier, Magerquark, Hüttenkäse, TK-Gemüse, Kartoffeln, Reis, Nudeln, Hähnchenschenkel, Thunfisch aus der Dose, Saisongemüse wie Kohl, Möhren, Zwiebeln. Eigenmarken-Niveau (Aldi/Lidl/Kaufland).
Zeitpunkte ("mahlzeit"): 3 × "Frühstück", 5 × "Hauptgericht", 2 × "Snack". Zielwerte: Frühstück 400–550 kcal/≥ 25 g Eiweiß; Hauptgericht 500–700 kcal/≥ 30 g Eiweiß; Snack 150–300 kcal/≥ 10 g Eiweiß.
Ernährungsformen: 4 vegan, 3 vegetarisch, 1 mit Schweinefleisch (z. B. Schweinegeschnetzeltes oder Hackfleisch), 2 ohne Schwein (Geflügel/Fisch). Proteinpulver höchstens 1 Rezept.
Preise: Ergänze in "ingredients" jedes Eintrags ein Feld "preis_eur_kg": realistischer typischer Discounter-Preis in Euro pro kg (bzw. pro Liter, Eier ca. 0,06 kg pro Stück) in Deutschland, Stand 2025/2026 – vorsichtig eher etwas höher schätzen. Gewürze/Salz/Pfeffer: 0. Berechne im Prüfskript die Kosten pro Portion = Summe menge_g/1000 × preis_eur_kg. Ziel: jedes Rezept ≤ 2,00 € pro Portion. Schreibe den gerundeten Wert zusätzlich als Rezeptfeld "kosten_eur" (z. B. 1.45).
Keine Gerichte, die es in vorhandenen *.json-Dateien schon gibt.
Prüfe per Python wie im Briefing. Gib eine kurze Tabelle zurück (Name, Mahlzeit, Ernährungsform, kcal, Eiweiß, Kosten).
