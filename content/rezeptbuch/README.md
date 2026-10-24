# Rezeptbuch-Baukasten (Alpha5)

Alles, was nötig ist, um die drei PDFs mit Fotos neu zu bauen:

- `Alpha5-Rezeptbuch.pdf` mit 306 Rezepten und Zutatenlexikon
- `Alpha5-Gratis-Rezepte.pdf` mit 20 Rezepten für den Lead-Magnet
- `Alpha5-Zutatenlexikon.pdf`

## Ordner

| Ordner/Datei | Inhalt |
|---|---|
| `daten/` | Rezept-JSONs pro Kapitel, `unterwegs.json`, `lexikon/` |
| `build/` | Python-Skripte (ReportLab), Schriften, Logo |
| `fotos/` | Rezeptfotos als `<datei>.jpg`. Fehlt ein Foto, zeigt das PDF einen Platzhalter. |
| `foto-auftraege.json` | 306 Einträge: `nr`, `kapitel`, `rezept`, `datei`, `prompt` |
| `ausgabe/` | Fertige PDFs, Seed-JSON und Gemini-Prompt-Datei |

## PDFs bauen

```
pip install reportlab pillow --break-system-packages
cd content/rezeptbuch/build
python3 build_book2.py && python3 build_lead2.py && python3 build_lex2.py
```

## Anleitung für Claude (Fotos erzeugen und einbauen)

Diese Sitzung muss in der Cloud-Umgebung laufen, in der `d8j0ntlcm91z4.cloudfront.net` freigegeben ist. Dort liegen die Higgsfield-Bilder.

1. **Bilder erzeugen:** Higgsfield-MCP `generate_image_batch` mit diesen Einstellungen:
   - Modell `gpt_image_2_5`
   - quality `medium`, resolution `2k`, aspect_ratio `21:9`
   - Prompt aus `foto-auftraege.json`
   - Kosten: ungefähr 1 Credit pro Bild.

   Arbeite kapitelweise, höchstens etwa 10 Bilder pro Batch. Bei Fehler 429 kurz warten und das einzelne Bild erneut senden. Rezepte, die in `fotos/` schon ein Bild haben, überspringst du.
2. **Ergebnis holen:** `jobs_wait` liefert die Bild-URL.
3. **Ablegen:** `python3 build/foto_holen.py <datei> <url>` (aus `content/rezeptbuch/`).
4. **Kurz prüfen:** Bild ansehen. Bei veganen Rezepten darf kein Fleisch, Käse oder Ei zu sehen sein, und auf dem Bild dürfen keine Markenlogos sein.
5. **PDFs neu bauen** (siehe oben) und den Nutzern die PDFs schicken.

Erste Testbilder sind bereits erzeugt. Für diese Job-IDs nur `jobs_wait` bzw. `show_generation_by_ids` aufrufen und danach herunterladen:

| Datei | Higgsfield-Job |
|---|---|
| protein-pizza-margherita-mit-quark-oel-teig | 34369f14-42ae-4c7f-9f1b-76ab6a6f9936 |
| iced-coffee-proteinshake-mit-hafer | 539aab85-f495-4d88-b105-3fe5519d444b |
| vegetarisch-teriyaki-tofu-bowl-mit-edamame | 598fc5f3-c4bb-4c4a-a2fd-bc3f005e77f3 |
| pistazien-protein-eis-mit-pistazienkernen | 5114a9b0-d6d1-4d68-8df2-96cd4efbd87d |
| suesskartoffel-erdnuss-curry-mit-tofu-linsen-und-reis | cf120cc5-1801-486f-82b4-cc6499b48cf2 |

**Regeln:**
- In Rezepten keine Markennamen.
- Die Fotos sind KI-Beispielbilder.
- Alle 306 Rezepte haben ein Foto (Stand 23.10.2026). Neue Rezepte bekommen ihr Foto nach demselben Ablauf; `foto-auftraege.json` vorher mit `python3 build/make_prompts.py` neu erzeugen.

## Kapitelstruktur (Stand 23.10.2026)

- **Mit Fleisch & Fisch** (`daten/fleisch.json`, `fleisch-2.json`, `fleisch-3.json`): enthält auch die früheren Rezepte aus „Ohne Schweinefleisch“ (`fleisch-3.json`). Rezepte ohne Schweinefleisch werden beim Bauen automatisch mit „Ohne Schwein“ markiert. In der App bleibt „ohne-schwein“ als Ernährungsform-Filter erhalten.
- **Low Carb** (`daten/lowcarb.json`): 20 Rezepte, Hauptmahlzeiten höchstens 20 g, Snacks höchstens 10 g Kohlenhydrate pro Portion.
- Die App-Daten (`ausgabe/alpha5-rezepte.json`) neu erzeugen mit `python3 build/make_seed.py`.

## Deckblatt

Das Titelbild liegt unter `build/titelbild.jpg` (Higgsfield, Modell gpt_image_2_5, ohne Schrift und Logos; Frau ohne Gesicht mit Hanteln, Shaker und fertigen Gerichten). `design.py` schneidet es auf A4 zu und lässt es oben und unten zu Schwarz verlaufen, damit Titel und Fußzeile lesbar bleiben. Ein neues Bild einfach unter demselben Namen ablegen und das Buch neu bauen.
