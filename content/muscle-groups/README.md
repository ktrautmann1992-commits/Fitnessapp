# Muskelgruppen-Bilder

Bilder für die Muskelgruppen-Kacheln im Übungs-Glossar (`/uebungen/muskelgruppen`).

- **Herkunft:** Die Bilder hat Google Gemini erzeugt (KI-generiert). Die Gründer haben sie am 22.10.2026 erstellt und freigegeben. Es gibt keine Fremdlizenz.
- **Aufbereitung:**
  - Hintergrund automatisch entfernt (rembg, Modell `isnet-general-use`), sodass die Bilder transparent sind.
  - Auf den rot hervorgehobenen Muskel zugeschnitten.
  - Gespeichert als 720 × 540 px WebP mit Qualität 80.
- **Dateien:** `apps/mobile/assets/muscle-groups/<kachel-id>.webp`, Zuordnung in `apps/mobile/src/data/muscle-tiles.ts`.
- **Welche Muskeln eine Kachel umfasst:** `packages/core/src/content/muscle-tiles.ts` (`MUSCLE_TILES`).

Ein Bild austauschen:

1. Neues Bild mit dem Prompt-Stil der übrigen Bilder erzeugen (hellgrauer Hintergrund, Muskel rot-orange, quadratisch).
2. Genauso aufbereiten wie oben beschrieben.
3. Die WebP-Datei mit demselben Namen ersetzen.

Noch offen: Eine Ganzkörper-Kachel gibt es noch nicht, weil der erste Entwurf unbrauchbar war.
