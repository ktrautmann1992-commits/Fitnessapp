# Briefing: Zutatenlexikon für die Fitness-App Alpha5

Zielgruppe: DACH, Einsteiger bis Leistungssportler (Kraft und Ausdauer), Ernährungsformen vegan, vegetarisch, mit Fleisch, ohne Schweinefleisch. Du-Form, sachlich, verständlich, keine Heilversprechen, keine Panikmache, keine Marken.

## Format: EINE JSON-Datei (Pfad steht im Auftrag), exakt dieses Schema
{
  "eintraege": [
    {
      "id": "kartoffel",                       // klein, ohne Umlaute, Bindestriche
      "name": "Kartoffel",
      "kategorie": "<eine der im Auftrag genannten Kategorien>",
      "kurz": "Ein Satz, was das Lebensmittel ausmacht.",
      "bezug": "roh, geschält" ,                // worauf sich die Nährwerte beziehen (roh / trocken / gegart / abgetropft)
      "naehrwerte_100g": {"kcal": 72, "eiweiss_g": 2.0, "kohlenhydrate_g": 15.6, "fett_g": 0.1, "ballaststoffe_g": 2.1},
      "portion": "Übliche Portion, z. B. ‚250 g roh als Beilage‘",
      "naehrstoffe": ["3–5 besonders relevante Mikronährstoffe/Inhaltsstoffe, kurz, z. B. ‚Kalium‘, ‚Vitamin C‘"],
      "eiweissqualitaet": "1–2 Sätze: wie hochwertig ist das Eiweiß, welche Aminosäure ist ggf. begrenzend (z. B. Lysin bei Getreide, Methionin bei Hülsenfrüchten), welche Kombination ergänzt gut. Klassische Zahlen (z. B. biologische Wertigkeit) NUR, wenn sie in der Fachliteratur gängig und eindeutig sind, sonst qualitativ.",
      "staerken": ["3–4 kurze Punkte"],
      "gut_fuer": ["3–4 Punkte: für welche Ziele/Personen/Situationen besonders geeignet (z. B. Muskelaufbau, Ausdauer vor langen Einheiten, Fettverlust wegen Sättigung, vegan als Eiweißquelle)"],
      "weniger_geeignet": ["2–4 Punkte mit Grund: z. B. direkt vor dem Training wegen Ballaststoffen; bei Zöliakie (Gluten); bei Nussallergie; bei Reizdarm/FODMAP-Empfindlichkeit; bei ärztlich verordneter kaliumarmer Ernährung; in großen Mengen bei Gicht (Purine) – nur was fachlich zutrifft"],
      "tipps": ["2–3 Zubereitungs- oder Alltagstipps, z. B. Linsen einweichen/abspülen, Leinsamen schroten, Reis abkühlen lassen (resistente Stärke)"],
      "lagerung": "1 Satz zu Lagerung und Haltbarkeit",
      "hinweis": "Optional: Sicherheits- oder Qualitätshinweis, wenn wirklich relevant (z. B. rohe Hülsenfrüchte enthalten Lektine/Phasin und müssen gegart werden; Reis kann anorganisches Arsen enthalten – Abwechslung, gründlich waschen, Kochwasser abgießen; Leinsamen in üblichen Mengen; bittere Aprikosenkerne meiden; gekochter Reis nicht lange warm stehen lassen). Sonst leerer String.",
      "alpha5": "1 Satz: wie/wann man es im Alpha5-Plan nutzt (Pre-Workout, Post-Workout, Ausdauer, Meal-Prep, Abend)."
    }
  ]
}

## Qualitätsregeln
- Nährwerte: realistische Tabellenwerte (BLS/USDA-Niveau) für den angegebenen Bezug. Prüfe: kcal ≈ 4·Eiweiß + 4·Kohlenhydrate + 9·Fett + ca. 2·Ballaststoffe (±15 %).
- Gesundheitsaussagen nur, wenn fachlich gesichert und allgemein anerkannt (DGE, BfR, EFSA, gängige sportwissenschaftliche Positionen). Bei Unsicherheit weglassen. Nutze WebSearch/WebFetch für Punkte, bei denen du nicht sicher bist (z. B. Sicherheitshinweise, Empfehlungen von BfR/DGE).
- Keine Diagnosen, keine Heilversprechen („senkt Cholesterin“ nur als „kann im Rahmen einer ausgewogenen Ernährung beitragen“, und nur wenn gut belegt). Health-Claims-Verordnung beachten: lieber beschreibend als werbend.
- „weniger_geeignet“ immer konkret und fair formulieren („…, weil …“). Bei medizinischen Zuständen: „bei … mit Arzt/Ernährungsfachkraft abstimmen“.
- Keine Marken.

Prüfe am Ende per Python: gültiges JSON, alle Felder vorhanden, Typen korrekt, ids eindeutig, kcal-Plausibilität. Gib eine kurze Liste zurück (Name, Kategorie, kcal, Eiweiß) und nenne Punkte, bei denen du unsicher warst.
