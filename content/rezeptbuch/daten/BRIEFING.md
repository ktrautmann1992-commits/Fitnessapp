# Briefing: Rezepte für die Fitness-App Alpha5

Zielgruppe: DACH, Fitness (Fettverlust, Muskelaufbau, Ausdauer). Einkauf in normalen deutschen Supermärkten (Rewe, Edeka, Aldi, Lidl). Sprache: Deutsch, Du-Form in der Anleitung.

## Umfang pro Datei
Genau 20 Rezepte für EINE Ernährungsform: je 5 für "Frühstück", "Mittagessen", "Abendessen", "Snack". Alle Mengen für **1 Portion**.

## Ziele pro Portion (Richtwerte)
- Frühstück: 400–550 kcal, mindestens 25 g Eiweiß
- Mittagessen und Abendessen: 500–700 kcal, mindestens 30 g Eiweiß
- Snack: 150–300 kcal, mindestens 10 g Eiweiß
Abwechslung: verschiedene Küchen (deutsch, mediterran, asiatisch, orientalisch, mexikanisch), warm und kalt, schnell (unter 15 Min.) und Meal-Prep-geeignet gemischt. Abendessen eher leichter/gemüsereich. Mindestens 2 Rezepte pro Mahlzeit sollen unter 20 Minuten dauern. Keine exotischen Zutaten, die man im Supermarkt nicht bekommt. Kein Alkohol.

## Format: EINE JSON-Datei, exakt dieses Schema
{
  "ingredients": {
    "<Zutatenname>": {"kcal": 372, "p": 13.5, "c": 58.7, "f": 7.0, "abteilung": "<Abteilung>"}
  },
  "recipes": [
    {
      "mahlzeit": "Frühstück",            // Frühstück | Mittagessen | Abendessen | Snack
      "name": "Kurzer, appetitlicher Name",
      "beschreibung": "Ein Satz, was das Gericht ausmacht.",
      "zeit_min": 10,                      // Gesamtzeit
      "tags": ["vor dem Training"],        // 0–2 aus: "vor dem Training", "nach dem Training", "Meal-Prep", "ohne Kochen"
      "zutaten": [
        {"name": "Haferflocken", "menge_g": 60, "anzeige": "60 g"},
        {"name": "Ei", "menge_g": 60, "anzeige": "1 Ei (Größe M)"},
        {"name": "Salz", "menge_g": 0, "anzeige": "1 Prise"}
      ],
      "zubereitung": ["Schritt 1 als ganzer Satz.", "Schritt 2 ..."],   // 3–7 klare Schritte mit Temperaturen/Zeiten
      "tipp": "Optionaler kurzer Tipp (Variante, Meal-Prep, Austausch) oder leerer String"
    }
  ]
}

Regeln für Zutaten:
- Jeder Zutatenname in "zutaten" MUSS als Schlüssel in "ingredients" stehen (exakt gleiche Schreibweise).
- Nährwerte in "ingredients" pro 100 g essbarem Anteil, roh/ungekocht wie gekauft (Reis, Nudeln, Linsen trocken; Kichererbsen aus der Dose abgetropft heißen "Kichererbsen (Dose, abgetropft)"). Realistische Werte wie in Nährwerttabellen (z. B. BLS/USDA). kcal = Kilokalorien, p = Eiweiß, c = Kohlenhydrate, f = Fett.
- "menge_g" = Gewicht in Gramm, das in die Nährwertberechnung eingeht (auch bei Stückangaben, z. B. 1 Banane = 120). Flüssigkeiten in g (1 ml ≈ 1 g). Gewürze/Salz/Pfeffer/Wasser: menge_g 0 erlaubt, aber trotzdem in "ingredients" mit Werten (dürfen 0 sein).
- "anzeige" = wie es im Rezept steht (z. B. "1 EL (10 g)", "½ Zwiebel (40 g)", "150 g").
- Einheitliche, handelsübliche Namen ("Magerquark", "Skyr natur", "Hähnchenbrustfilet", "Tofu natur", "Olivenöl"). Gleiche Zutat immer gleich schreiben.
- "abteilung" exakt eine aus: "Obst & Gemüse", "Kühlregal & Molkerei", "Fleisch & Fisch", "Brot & Backwaren", "Getreide, Nudeln & Hülsenfrüchte", "Konserven & Gläser", "Nüsse, Samen & Trockenfrüchte", "Gewürze, Öle & Saucen", "Tiefkühl", "Pflanzliche Alternativen", "Sonstiges".
- Proteinpulver höchstens in 2 Rezepten der Datei.

Vorgehen: Schreibe die Datei mit dem Write-Tool. Prüfe sie danach mit einem Python-Skript: gültiges JSON, 20 Rezepte, je 5 pro Mahlzeit, alle Zutatennamen vorhanden, und berechne pro Rezept kcal und Eiweiß aus menge_g × Werte/100. Liegen Rezepte deutlich außerhalb der Zielbereiche, passe die Mengen an, bis sie passen. Gib am Ende nur eine kurze Tabelle zurück (Name, Mahlzeit, kcal, Eiweiß).
