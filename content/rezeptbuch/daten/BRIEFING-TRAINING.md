# Ergänzung: Kapitel rund ums Training (Pre-Workout, Post-Workout, Cardio)

Lies zuerst BRIEFING.md (Schema, Zutatenregeln, Abteilungen). Für dieses Kapitel gilt abweichend:

## Allgemein
- Genau 10 Rezepte, 1 Portion, KLEINE Mahlzeiten bzw. Snacks (keine vollen Hauptgerichte).
- Feld "mahlzeit" enthält hier den ZEITPUNKT (genaue Schreibweise siehe Kapitel unten), nicht Frühstück/Mittag.
- Neues Pflichtfeld "passt_fuer": Liste aus "vegan", "vegetarisch", "fleisch", "ohne-schwein". Logik: vegan → alle vier; vegetarisch → vegetarisch, fleisch, ohne-schwein; mit Schwein → nur fleisch; Geflügel/Rind/Fisch ohne Schwein → fleisch, ohne-schwein.
- Mischung der Ernährungsformen: mindestens 4 vegan, mindestens 3 vegetarisch (mit Ei/Milchprodukt), 1–2 mit Fleisch/Fisch ohne Schwein, höchstens 1 mit Schweinefleisch – und nur, wo es zum Zeitpunkt passt.
- Proteinpulver erlaubt, höchstens 4 Rezepte pro Kapitel. Namen: "Whey-Proteinpulver (Vanille)", "Whey-Proteinpulver (Schoko)", "Whey-Proteinpulver (neutral)", "Casein-Proteinpulver (Vanille)", "Veganes Proteinpulver (Vanille)", "Veganes Proteinpulver (Schoko)", "Veganes Proteinpulver (Erbse/Reis, neutral)". Im Tipp eine Variante ohne Pulver nennen.
- "zeit_min" realistisch; die meisten Rezepte unter 15 Minuten, Meal-Prep-Riegel/Muffins dürfen länger dauern.
- "beschreibung": ein Satz, der auch sagt, WARUM das Rezept zum Zeitpunkt passt (z. B. „leicht verdaulich, schnelle Kohlenhydrate“).
- "zubereitung": 3–6 Schritte. "tipp": praktischer Hinweis zum Timing, zur Verträglichkeit oder zum Mitnehmen.
- "tags": genau ein Kapitel-Tag als erstes (siehe unten), optional ein zweites aus "Unter 10 Minuten", "Meal-Prep", "ohne Kochen", "zum Mitnehmen".
- Keine Gerichte, die es in den Dateien vegan*.json, vegetarisch*.json, fleisch*.json, ohne-schwein*.json, schnell.json schon gibt (Namen dort nachsehen). Für gleiche Zutaten dieselben Namen und Nährwerte wie in diesen Dateien.
- Keine medizinischen Versprechen, keine Koffein-Megadosen (Kaffee/Espresso normal erlaubt).

Prüfe per Python-Skript wie im BRIEFING.md, zusätzlich die Zielwerte unten und passt_fuer gegen die Zutaten. Gib eine kurze Tabelle zurück (Name, Zeitpunkt, Ernährungsform, kcal, Eiweiß, Kohlenhydrate, Fett).
