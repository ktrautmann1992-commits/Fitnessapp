## Kapitel MEAL-PREP-WOCHENPLÄNE → Datei mealprep.json
Lies BRIEFING.md (Schema, Zutaten) und BRIEFING-TRAINING.md (nur: Feld "passt_fuer" und seine Logik, Proteinpulver-Namen, Namenskonsistenz mit vorhandenen Dateien). Dieses Teil hat Vorrang.

Ziel: Berufstätige kochen sonntags in ca. 2 Stunden vor und sind Montag bis Freitag versorgt. 4 Wochenpläne, einer pro Ernährungsform: "vegan", "vegetarisch", "fleisch" (mit magerem Schweinefleisch), "ohne-schwein".

Pro Plan genau 3 Batch-Rezepte (also 12 Rezepte insgesamt):
- 1 × "mahlzeit": "Frühstück" (z. B. Overnight Oats im Glas, Frittata-Muffins, Baked Oats)
- 1 × "mahlzeit": "Mittagessen" (Bowl/Curry/Chili/Ofenblech, das sich 4–5 Tage hält)
- 1 × "mahlzeit": "Snack" (z. B. Energy-Balls, Eiweiß-Muffins, Hummus mit Gemüsesticks)
Abendessen kochen Nutzer frisch (Hinweis im Plan).

Abweichend vom Briefing:
- Neues Pflichtfeld "portionen": 5. Zutatenmengen ("menge_g", "anzeige") sind für ALLE 5 Portionen. Zielwerte gelten PRO PORTION (Gesamt ÷ 5): Frühstück 400–550 kcal, ≥ 25 g Eiweiß; Mittagessen 500–700 kcal, ≥ 30 g Eiweiß; Snack 150–300 kcal, ≥ 10 g Eiweiß.
- Neues Pflichtfeld "plan": die Gruppe ("vegan" usw.). "passt_fuer" wie im Trainings-Briefing.
- "tags": erstes Tag "Meal-Prep". "zeit_min" = aktive Zeit für die ganze Menge.
- "zubereitung" 4–7 Schritte. "tipp": Haltbarkeit, Aufbewahrung, Aufwärmen, ggf. Einfrieren. Lebensmittelsicherheit beachten: gegarter Reis/Fleisch/Fisch höchstens 3–4 Tage im Kühlschrank; für Tag 4–5 Portionen einfrieren und am Vorabend in den Kühlschrank legen – im Tipp sagen.
- Keine Gerichte, die schon in vorhandenen *.json-Dateien im Ordner stehen.

Zusätzlich ein Top-Level-Feld "plaene": Liste mit 4 Einträgen:
{
  "plan": "vegan",
  "titel": "Kurzer Titel, z. B. ‚Vegane Power-Woche‘",
  "beschreibung": "1–2 Sätze",
  "kochtag": [ {"min": 0, "schritt": "Ofen auf 200 °C vorheizen, Reis aufsetzen."}, {"min": 10, "schritt": "..."} ],   // 8–14 Schritte, sinnvoll verzahnt (Ofen, Herd, Schneiden parallel), Gesamtdauer ca. 90–130 Min., "min" = Startminute
  "aufbewahrung": ["Satz 1", "Satz 2", "Satz 3"],   // Behälter, Kühlschrank, Einfrieren
  "abendessen_hinweis": "1 Satz: Abends frisch kochen, z. B. ein Rezept aus dem Kapitel Fertig in 10 Minuten."
}
Prüfe per Python: Schema, 12 Rezepte, 3 pro Plan, Werte pro Portion im Ziel. Gib eine kurze Tabelle zurück (Plan, Name, Mahlzeit, kcal/Portion, Eiweiß/Portion).
