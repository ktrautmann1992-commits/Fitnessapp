# Übungsfotos (KI-Fotos statt Strichfiguren)

Gründer-Entscheidung (November 2026): Die Übungen bekommen fotorealistische KI-Bilder der **Ausgangs- und Endposition**
(gleiche Frau, schwarzes Outfit, hellgrauer Studio-Hintergrund, 4:3). Wo ein Foto da ist, ersetzt es die eigene
Illustration; sonst bleibt die Illustration (SVG). Start und Ende kommen immer aus derselben Quelle – nie Foto und
Strichfigur gemischt.

## Ablauf

1. Bilder extern erzeugen (ca. 1536×1152 PNG je Bild).
2. Adressen in `content/exercise-photos/manifest.json` eintragen und auf einen Branch `claude/…` pushen.
3. Der Workflow **exercise-photos-import** startet automatisch (oder von Hand: GitHub-App → Actions →
   exercise-photos-import → Run workflow → Branch wählen). Er
   - lädt Start- und Endbild jeder neuen oder geänderten Übung (Vergleich mit `content/exercise-photos/imported.json`),
   - schneidet sie mittig auf 640×480 zu und speichert sie als WebP (Qualität 72, höchstens 45 KB; bei größeren
     Dateien wird die Qualität schrittweise gesenkt) nach `apps/mobile/assets/exercise-photos/<id>-start.webp` und
     `<id>-end.webp`,
   - erneuert die App-Zuordnung `apps/mobile/src/data/exercise-photo-registry.generated.ts`,
   - erzeugt Prüfbögen `content/exercise-photos/review/sheet-<n>.jpg` (6 Paare Start | Ende je Bogen, mit ID),
   - committet alles als github-actions[bot] auf denselben Branch. Das Manifest ändert er nie (kein Endlos-Lauf).
4. Prüfbögen ansehen (GitHub-App → Datei öffnen), Vercel-Vorschau testen, PR wie gewohnt.

Fehlgeschlagene Downloads: Der Lauf wird rot und nennt die IDs; alle anderen Bilder sind trotzdem committet. Adresse im
Manifest korrigieren und erneut pushen. Eine Übung aus dem Manifest löschen → der nächste Lauf löscht ihre Fotos, die
App zeigt wieder die Illustration.

## Manifest-Format

```json
{
  "liegestuetz": {
    "start": "https://…/start.png",
    "end": "https://…/end.png",
    "job_start": "0f8fad5b-d9cb-469f-a165-70867728950e",
    "job_end": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  }
}
```

- Schlüssel = Übungs-ID aus `content/exercises/<id>.json`.
- `start`/`end`: nur `https://`-Adressen; `job_start`/`job_end`: Auftrags-IDs des Generators (UUID, zur Nachverfolgung).
- Geprüft per Zod (`exercisePhotoManifestSchema`, `checkExercisePhotoManifest` in
  `packages/core/src/content/exercise-photos.ts`) im Test `packages/content/src/exercise-photos.test.ts` (läuft in `ci`).
- Bitte als JSON mit 2 Leerzeichen Einrückung speichern (Prettier-Prüfung in `ci`).

## Lokal (Claude-Sitzung, ohne Zugriff auf das Bild-CDN)

`node scripts/exercise-photos.mjs --from-dir <ordner>` rechnet lokale Dateien `<id>-start.png` / `<id>-end.png` (auch
.jpg/.webp) um, erneuert Zuordnung und Prüfbögen; `imported.json` bleibt unverändert. `--registry-only` erzeugt nur die
Zuordnung aus den vorhandenen Dateien, `--no-sheets` lässt die Prüfbögen weg. Platzhalterbilder nie committen.

## In der App

- **Übungsdetail** („Ausgangsposition“): Startfoto groß (4:3), mit sichtbarem Hinweis „KI-Bild“ und Herkunftszeile.
- **Workout-Player**: Start- und Endfoto wechseln im Sekundentakt mit Überblendung (wie bei den Illustrationen); bei
  „Bewegung reduzieren“ oder Übungen ohne Endposition nur das Startfoto. Kein KI-Hinweis im Player.
- **„Als Nächstes“-Vorschau** im Player und **Übungsliste im Plan**: kleines Startfoto (4:3).
- Fotos stehen in einem festen 4:3-Rahmen mit hellgrauem Grund (sichtbar während des Ladens), `cover`.
- Ein Endfoto wird nur genutzt, wenn die Übung eine Endposition hat (Halteübungen bleiben statisch).

Leistung: Die Zuordnung wird wie die Illustrationen erst bei Bedarf per `import()` geladen
(`apps/mobile/src/data/exercise-media.ts`), die Fotos sind eigene Dateien (Web: eigene Adressen, Handy: Asset-Dateien)
und werden erst beim Anzeigen geladen. Die Prüfbögen liegen unter `content/` und kommen nicht ins App-Bündel.

Tests: `apps/mobile/src/data/exercise-media.test.ts` (Foto vor Illustration, Zuordnung passt zu den Dateien),
`apps/mobile/src/components/exercise-photo.test.tsx` (Player und Detail mit Foto). In Vitest wird `require('….webp')`
der Zuordnung zu `{ uri }` (Plugin in `apps/mobile/vitest.config.mts`).

Hinweis: Commits des Workflows (GITHUB_TOKEN) starten den `ci`-Lauf nicht neu; Vercel baut die Vorschau trotzdem.
Für Pflicht-Checks im PR danach `ci` per „Run workflow“ starten.
