## Kapitel WETTKAMPFTAG → Datei wettkampf.json
Lies BRIEFING.md, dann BRIEFING-TRAINING.md (Feld passt_fuer, Mischung, Proteinpulver, Konsistenz). Dieses Teil hat Vorrang.
Zielgruppe: Halbmarathon, Marathon, Triathlon, lange Radrennen. Genau 10 Rezepte, 1 Portion, Tag "Wettkampf" als erstes Tag.
Zeitpunkte ("mahlzeit", genaue Schreibweise):
- 3 × "Carb-Loading (2 Tage vorher)": kohlenhydratreiche, ballaststoff- und fettarme Mahlzeiten 500–800 kcal, ≥ 90 g Kohlenhydrate, Fett ≤ 15 g.
- 2 × "Am Vorabend": bekannt, gut verträglich, 500–750 kcal, ≥ 80 g KH, wenig Ballaststoffe, nicht scharf, wenig Fett.
- 3 × "Renntag-Frühstück (3 Std. vorher)": 350–600 kcal, ≥ 70 g KH, Fett ≤ 10 g, wenig Ballaststoffe.
- 1 × "Im Rennen": selbstgemachtes Gel oder Kau-Snack, 80–200 kcal, fast nur KH, mit Salz. Kein Rezept, das es in cardio.json schon gibt.
- 1 × "Nach dem Ziel": Regeneration, 400–600 kcal, ≥ 25 g Eiweiß, ≥ 60 g KH, salzig.
Ernährungsformen: mindestens 5 vegan, Rest vegetarisch oder ohne Schwein; kein Schweinefleisch.

Zusätzlich ein Top-Level-Feld "leitfaden": Liste mit 6–8 Einträgen {"titel": "...", "text": "2–4 Sätze"} für eine Ratgeber-Seite, z. B. Carb-Loading (Richtwert ca. 8–10 g Kohlenhydrate pro kg Körpergewicht pro Tag an den 1–2 Tagen davor, nur bei Belastungen über ca. 90 Minuten sinnvoll), ballaststoffarm essen, Trinken, Frühstück 3 Stunden vorher, Verpflegung im Rennen (30–60 g/Std., bis 90 g nur trainiert), Nichts Neues am Wettkampftag, Nach dem Ziel. Sachlich, als Richtwerte formuliert, mit Hinweis, Strategien vorher im Training zu testen. Keine medizinischen Versprechen.
Prüfe per Python wie im Briefing (inkl. Zielwerte). Gib eine kurze Tabelle zurück.
