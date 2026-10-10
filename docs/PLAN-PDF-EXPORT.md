# Plan: Trainingsplan als PDF im Alpha5-Layout

Stand: 06.10.2026 · Status: **P1+P2 umgesetzt** (Abschnitt 12) · **P3+P4 umgesetzt** (Abschnitt 13, EAS-Prüfung auf
Geräten offen) · Plan vom Wächter mit Auflagen freigegeben, Auflagen eingearbeitet (Abschnitt 11)

## 1. Ziel in einfachen Worten

Nutzerinnen und Nutzer laden ihren **Trainingsplan als PDF** herunter – im Alpha5-Look mit Logo, druckfreundlich auf
A4, zum Ausdrucken oder fürs Studio. **Gratis für alle** (keine KI, keine Premium-Prüfung). Der **Ernährungsplan
folgt mit Phase 5**; der Aufbau wird jetzt so gebaut, dass dafür nur ein neuer „Inhalt“ dazukommt.

## 2. Ist-Stand

- Plan-Daten und Anzeige-Logik sind fertig: `generateTrainingPlan()`, `prepareSessionForDisplay()` (aktuelle
  Sicherheitsregeln), `weekOverview()`, `sessionLocation()`, `prescriptionForDisplay()` (Phase 4, Vorgaben je Ort).
- Marke: Logo `packages/ui/brand/alpha5-mark.svg` (reiner Pfad), Farben `packages/ui/theme.css` (`--brand-blau
#1f5bff`, `--brand-schwarz`, `--brand-eisblau`), Schrift Archivo (OFL; Latin-woff2 in
  `apps/mobile/public/fonts/archivo-latin-wdth-normal.woff2`).
- `expo-print` ~57.0.2 ist seit P4 eingebunden (vorher keins).

## 3. Optionen und Entscheidung

| Option                                                                                 | Datenschutz                                            | Bewertung                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| **A. Auf dem Gerät: HTML → System-Druckdialog** (nativ `expo-print`, Web Druckansicht) | Daten bleiben auf dem Gerät                            | **Entscheidung** – eine HTML/CSS-Vorlage, kleines Paket, offline |
| B. Bibliothek auf dem Gerät (`@react-pdf/renderer`, `pdf-lib`, jsPDF)                  | bleibt auf dem Gerät                                   | groß bzw. Layout von Hand, zwei Wege nativ/Web – vorerst nein    |
| C. Server (Next-API + Headless-Browser)                                                | **Gesundheitsbezogene Daten verlassen Gerät/Supabase** | Art. 9, Auftragsverarbeitung, Kosten – nein                      |

**Nativ (B2, B3):** `Print.printAsync({ html, width: 595, height: 842 })` öffnet den **System-Druckdialog**; dort
„Als PDF sichern“ bzw. Drucken. **Kein** Teilen-Menü der App, **keine** Datei im Cache, **kein** `expo-sharing` oder
`expo-file-system`. Ränder stehen im HTML (A4 = 595 × 842 pt). Im EAS-Build auf **beiden** Systemen prüfen.
`expo-print` per `expo install` auf die passende **~57.x**-Version pinnen (Lockfile, B4). Falls später doch eine
Datei nötig wird: neue File-API von Expo, Datei **nicht** direkt nach dem Teilen löschen (das Teilen läuft noch).

**Web (B5):** kein unsichtbares `iframe` (in iOS-Safari unzuverlässig), sondern eine **eigene Druckansicht-Route**
(z. B. `/plan/drucken`) mit Print-CSS und Knopf „Drucken / als PDF sichern“ (`window.print()`). `@page { size: A4;
margin: 0 }` und eigene Innenränder; **keine** Seitenzahlen über `@page`-Randboxen (Safari kann das nicht) –
Fußzeile als normales Element je Seite.

## 4. Datenschutz (CLAUDE.md, DSGVO Art. 9)

- **Keine Speicherung auf Servern**, kein Upload, keine Analytics-Ereignisse mit Inhalt, keine Logs mit Plandaten.
- **Kein Teilen-Feature, keine Community:** nur der System-Druckdialog als privater Download.
- **Hinweis vor dem Erzeugen**, wenn der Plan Gesundheitsangaben nutzt (`uses_health_data`): „Dieser Plan
  berücksichtigt deine Gesundheitsangaben. Speichere oder drucke die Datei nur bewusst.“ – Weiter / Abbrechen.
- **Nichts Verräterisches im PDF (B1):**
  - Der neutrale Arzt-Hinweis steht auf **jedem** PDF, für alle gleich: „Bitte kläre vor Trainingsbeginn ärztlich ab,
    ob das Training für dich passt. Alpha5 ersetzt keine ärztliche Beratung.“
  - Markierung „getauscht“ **nur** bei fehlendem Gerät, **nie** bei Tausch aus Sicherheitsgründen. _Ab Etappe T1/T2
    (`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md` 7.3): „getauscht (deine Wahl)“ bei „Ab jetzt immer“ und der neutrale
    Druckhinweis „1 Übung ausgelassen (deine Wahl)“; die App übergibt Präferenzen samt Plan-Untergrenze, nie
    „Nur heute“-Tausche._
  - **Kein Level** auf dem Deckblatt (sonst verrät „Einsteiger“ bei Fortgeschrittenen den vorsichtigen Plan).
  - Keine Gründe, Flags, Schwangerschaft, Alter, Geburtsdatum, Körpergewicht; **Zyklusdaten nie** (B11).
- **Name optional**, Standard aus. Dokument-**Titel und Dateiname ohne Namen** (B7).
- **Sicheres HTML (B7):** Der Renderer erzeugt Inhalte nur als escapte Textknoten; Text **und** Attribute werden
  escaped; CSP-Meta `default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:`.

## 5. Inhalt und Layout (A4, hell, druckfreundlich)

1. **Deckblatt:** Logo, „Dein Trainingsplan“, Planname **ohne Level** (z. B. „Muskelaufbau · 3 Tage“), Zeitraum des
   Blocks, Tage, Ort(e), optional Name, „Stand: <Datum>“.
2. **Wochenübersicht:** Tabelle Mo–So je Woche (Kraft A/B/C mit Ort, Ausdauer, Ruhetag; Erholungswoche markiert).
3. **Je Kraft-Einheit:** **Fassung des Orts je Wochentag** (B8: z. B. Mo Studio, Sa Zuhause mit eigenen Übungen und
   wirksamen Gewichten aus Phase 4). Aufwärmen; Tabelle Übung · Sätze · Wdh./Dauer · RPE · Pause · Gewicht (aktuelle
   Vorgabe, sonst leer) + **höchstens 4 Mitschreib-Spalten**; Abwärmen. Einheiten-Seiten im **Querformat**, wenn mehr
   als 4 Spalten gewünscht sind (B9). Mindestschrift **10 pt**.
4. **Ausdauer-Einheiten:** Art, Minuten, Anstrengung (0–10) in Worten.
5. **Hinweise:** Plan-Hinweise (`notes`, nur Gerätegründe) als feste deutsche Sätze + neutraler Arzt-Hinweis.
6. **Fußzeile jeder Seite:** „Alpha5 ersetzt keine ärztliche Beratung.“ · kleines Logo (Seitenzahl nur nativ, wo
   zuverlässig).

Gestaltung: weißer Hintergrund, Text `--brand-schwarz`, Akzent `--brand-blau`, Tabellenkopf `--brand-eisblau`,
Überschriften Archivo, Fließtext Systemschrift; keine Information nur über Farbe.

**Schrift und Logo offline (B6):** ein **generiertes Modul** (`packages/ui/src/print/assets.generated.ts`) mit der
Archivo-woff2 als Base64 und dem Logo als SVG-String; Skript mit `--check` in CI (wie `tokens.generated.ts`). Kein
Laden von fremden Servern.

**Barrierefreiheit (B10):** `<html lang="de">`, `<th scope="col|row">`, `accessibilityLabel` am Knopf, Hinweis-Dialog
und Ladezustand für Screenreader angesagt. Ehrlich: Das von iOS erzeugte PDF ist **nicht getaggt** (keine
Struktur für Screenreader) – die App-Ansicht bleibt die barrierefreie Hauptquelle.

## 6. Aufbau im Code (B11)

- **`packages/core/src/export/`** (reine Fachlogik, testbar):
  - `document.ts`: allgemeines Dokumentmodell `PrintDocument { meta, sections: Block[] }` mit Blöcken `heading`,
    `paragraph`, `keyValue`, `table`, `notice`, `pageBreak` – Inhalte als **Codes und Daten**, keine Texte.
  - `training-plan-document.ts`: `buildTrainingPlanDocument(plan, sessions, display, progress, options)` mit
    Anzeige-Kontext `display = { rules, previousStartGroup, library, substituteLibrary?, profiles }` (Geräte je
    Ort); nutzt `prepareSessionForDisplay()`, `sessionLocation()` und die Phase-4-Vorgaben je Ort; Optionen per Zod
    (`includeName`, `name`, `logColumns` 0–4 hochkant bzw. bis 8 nur mit `landscape`, `onDate`).
    `previousStartGroup` kommt in der App **immer** aus `planStartGroup()` (wie in der Plan-Ansicht).
  - Später `nutrition-plan-document.ts` (Phase 5) mit demselben Modell.
- **`apps/mobile`** übersetzt Codes mit `i18n/de.ts` → Typ **„übersetztes Dokument“** (nur fertige Texte).
- **`packages/ui/src/print/render-html.ts`:** übersetztes Dokument → HTML-String (Tokens, Logo, Schrift, Print-CSS,
  CSP). Darstellung, keine Fachlogik.
- **App:** Knopf „Als PDF speichern“ auf der Plan-Ansicht, Hinweis-Dialog, Lade-/Fehlerzustand; nativ
  `Print.printAsync`, Web Druckansicht-Route.

## 7. Tests

- **Core:** Deckblatt mit/ohne Name; 1 und 7 Tage; Ausdauer; Erholungswoche; **Modell für Profile mit und ohne
  Gesundheits-Flag ist bis auf die Übungen identisch** (B1); Sicherheitstausch erzeugt **keine** Markierung, Gerätetausch
  schon; kein Level im Modell; Mo Studio / Sa Zuhause → zwei Fassungen mit eigenen Gewichten (B8); höchstens 4 Spalten
  hochkant; Zod lehnt ungültige Optionen ab.
- **UI-Renderer (B7):** `<script>`, `"><img onerror=…>`, `</style>` im Namen bzw. Übungsnamen werden harmlos; CSP-Meta
  vorhanden; Titel ohne Namen; `lang="de"`, `th scope`; jede Seite hat Fußzeile; `assets.generated.ts --check`.
- **E2E (Playwright, Web-Export):** Knopf → Hinweis-Dialog bei Gesundheitsbezug → Druckansicht mit Print-CSS,
  `print()` wird aufgerufen.

## 8. Etappen (je ein Pull Request, B12)

| Etappe | Inhalt                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| P1+P2  | Core-Dokumentmodell + Tests **und** HTML-Renderer mit Schrift/Logo-Modul; Beispiel-PDF-HTML als **CI-Artefakt** zum Ansehen |
| P3     | App: Knopf, Hinweis-Dialog, Web-Druckansicht-Route; Vercel-Vorschau                                                         |
| P4     | Nativ (klein): `expo-print` gepinnt, `printAsync` mit A4; EAS-Build Android + iOS                                           |
| (P5)   | Phase 5: Ernährungsplan + Einkaufsliste als zweites Dokument                                                                |

## 9. So testet ihr es am Handy

1. Ab P1+P2: GitHub-App → Actions → `ci`-Lauf → Artefakt „pdf-vorschau“ öffnen (Beispiel-Plan als HTML).
2. Ab P3: im Pull Request den **Vercel-Vorschau-Link** öffnen, mit Testkonto anmelden (oder „Testmodus starten“), Plan öffnen.
3. **„Als PDF speichern“** tippen → bei Plan mit Gesundheitsangaben erscheint der Hinweis → „Weiter“ → Druckansicht.
4. Android Chrome: „Drucken / als PDF sichern“ → Drucker „Als PDF speichern“ → Herunterladen. iPhone Safari:
   „Drucken / als PDF sichern“ → in den Druckoptionen oben das **Teilen-Symbol** → „In Dateien sichern“.
5. PDF prüfen: Logo, Planname ohne Level, Wochenübersicht, Mitschreib-Spalten, Fußzeile und Arzt-Hinweis, kein Wort
   zu Gesundheitsangaben.
6. Ab P4: Android-APK bzw. TestFlight-Build installieren → Knopf → Druckdialog → „Als PDF sichern“, auch im
   Flugmodus.

## 10. Offene Fragen mit Empfehlung

1. **Web: Druckansicht reicht oder Ein-Tipp-Download?** _Empfehlung:_ Erst Druckansicht; jsPDF nur, wenn Testerinnen
   den Weg zu umständlich finden.
2. **Mitschreib-Spalten?** _Empfehlung:_ 4 hochkant als Standard; Querformat als Option für mehr Wochen.
3. **Name aufs Deckblatt?** _Empfehlung:_ Optional, Standard aus.
4. **Englisch?** _Empfehlung:_ Über i18n, Deutsch zuerst.

## 11. Wächter-Prüfung (Runde 1) – wie die Befunde gelöst sind

Ergebnis: **mit Auflagen freigegeben**, alle Auflagen eingearbeitet.

| Befund                                                    | Gelöst in     |
| --------------------------------------------------------- | ------------- |
| B1 Arzt-Hinweis für alle, Tausch-Markierung, kein Level   | §4, §5, §7    |
| B2 nativ `printAsync` (Entscheidung)                      | §3, §6, §8 P4 |
| B3 A4 595 × 842, Ränder im HTML, beide Systeme            | §3, §8 P4     |
| B4 Versionen pinnen, Datei-Hinweis                        | §3            |
| B5 Web-Druckansicht statt iframe, `@page`                 | §3, §6, §7    |
| B6 Schrift/Logo als generiertes Modul mit `--check`       | §5, §7        |
| B7 Escaping, CSP, Titel ohne Namen, Tests                 | §4, §7        |
| B8 Fassung je Ort und Wochentag                           | §5, §6, §7    |
| B9 höchstens 4 Spalten / Querformat, 10 pt                | §5, §6        |
| B10 Barrierefreiheit, iOS-PDF ungetaggt                   | §5            |
| B11 Codes → App übersetzt → UI rendert; keine Zyklusdaten | §4, §6        |
| B12 Etappen P1+P2 mit CI-Artefakt, P4 klein, iOS-Schritte | §8, §9        |

## 12. Umsetzung P1+P2 (Stand 05.10.2026)

**Dateien**

- Core (P1): `packages/core/src/export/document.ts` (Dokumentmodell, Text-Codes mit typisierten Parametern,
  Zod-Schema `printDocumentSchema`), `packages/core/src/export/training-plan-document.ts`
  (`buildTrainingPlanDocument`, Optionen `trainingPlanExportOptionsSchema`), Grenzwerte `PRINT_EXPORT` in
  `constants.ts`. Tests: `document.test.ts`, `training-plan-document.test.ts`.
- UI (P2): `packages/ui/src/print/` – `types.ts` („übersetztes Dokument“), `render-html.ts` (`renderPrintHtml`,
  `escapeHtml`, `PRINT_CSP`), `assets.generated.ts` (erzeugt von `scripts/generate-print-assets.mjs`, in CI mit
  `print-assets:check`). Eigener Einstieg `@fitnessapp/ui/print`, damit die ca. 120 KB nur beim Drucken geladen werden.
- App (Übersetzung, B11): `apps/mobile/src/lib/print-document.ts` (`translatePrintDocument`, Texte in
  `i18n/de.ts` → `print`). Beispiele: `apps/mobile/src/test/print-examples.ts`; CI-Vorschau
  `apps/mobile/scripts/pdf-preview.ts` (`pnpm --filter @fitnessapp/mobile pdf:preview`, Artefakt „pdf-vorschau“,
  Liste der Dateien in der Zusammenfassung des Laufs). Die App-Oberfläche (Knopf, Dialog, Druckansicht) folgt in P3.

**Regeln im Code**

- Planname aus Ziel + Tagen (z. B. „Muskelaufbau · 3 Tage“) statt Vorlagenname – die Vorlagennamen enthalten das
  Level (B1). Arzt-Hinweis und Fußzeile immer; `medical_notice`/`uses_health_data` werden nicht gelesen.
- „ersetzt (Gerät fehlt)“ nur bei `exerciseMark() === 'equipment_swap'`; „angepasst“ (Sicherheit) wird nicht gedruckt.
- Fassungen: je Kraft-Einheit eine Seite pro Ort und Inhalt; Wochentage aus dem ursprünglichen Termin; Gewicht aus
  `prescriptionForDisplay()` mit Progression **und Gewichtsstufen des Orts** (B8), sonst leer.
- Block: der laufende bzw. nächste Block zum Stichtag (`blockWeekFor`), sonst der letzte.

**Abweichungen (begründet)**

1. **Plan-Hinweise:** gedruckt werden nur die Gerätegründe `exercises_substituted`, `exercises_removed`,
   `no_pull_exercise`, `location_mismatch` (wörtlich §5 Punkt 5). Hinweise wie `endurance_walk` oder
   `week_total_capped` hängen an der Startgruppe (Gesundheit/Alter) und entfallen deshalb.
2. **Mitschreib-Spalten:** Zod erlaubt 0–4 hochkant und bis 8 nur mit `landscape: true` (§5 „Querformat, wenn mehr
   als 4 Spalten“, §10 Frage 2) statt starr 0–4 wie in §6.
3. **B1-Test „bis auf die Übungen identisch“:** gilt wörtlich für Fortgeschrittene. Bei Einsteigern liegt die
   Erholungswoche mit Flag nach 4 statt 5 Wochen (`DELOAD_SCHEDULE`), damit ändern sich Zeitraum und Wochenzeilen.
   Das ist Trainingsinhalt wie die Übungen und lässt sich ohne falschen Plan nicht verbergen; Codes, Texte und
   Aufbau bleiben gleich (eigener Test). Wächter: OK (Rhythmus 4 gilt auch für Fortgeschrittene, Level steht nicht im PDF).
4. **Tabellen-Titel** als Absatz bzw. Überschrift (`captionLevel`) mit `aria-labelledby` statt `<caption>`: Chrome bricht Tabellen mit `<caption>` auf
   Querformat-Seiten unnötig auf eine neue Seite um (im Test nachgestellt).
5. **Tabellen in Archivo** (leicht schmal, eingebettet) statt Systemschrift: gleiche Spaltenbreiten auf allen Geräten;
   Fließtext bleibt Systemschrift.
6. Querformat-Seiten nutzen eine benannte Seite (`@page quer`). Ob iOS/Android-`printAsync` gemischte Ausrichtung
   druckt, wird in P4 geprüft (sonst ganzes Dokument quer bzw. Querformat-Option nur im Web).
7. **Signatur:** `buildTrainingPlanDocument(plan, sessions, display, progress, options)` bekommt den
   Anzeige-Kontext (aktuelle `rules`, `previousStartGroup`, `library`, `profiles` je Ort) statt nur `library` – sonst
   würde das PDF lockerer drucken als die App. In P3 ist `previousStartGroup` **immer** `planStartGroup()` (§6).

**Wächter-Prüfung P1+P2 – Auflagen umgesetzt**

| Befund                                      | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 Ort bei „Tage egal“ mit Studio + Zuhause | `sessionLocation(session, schedule, { library, homeProfile })`: mehrdeutig → Ort aus der Fassung (Übung zu Hause nicht machbar → Studio, sonst Zuhause). Gilt auch in der App („Heute“). Tests in `view.test.ts` und `training-plan-document.test.ts`. Rest: Haben beide Fassungen denselben Inhalt, heißt sie „Zuhause“ (vorsichtigere Heim-Gewichtsstufen). Sauber wäre der gespeicherte Ort je Einheit (Migration) – offene Verbesserung. |
| S2 Gewicht nach Belastungsart               | Zelle `load.bodyweight` / `load.band` / `load.none`; Hinweis, Anleitung und Legende ohne „Startgewicht“/„Gewicht“, wenn keine Gewichtsübung (`hasWeight`).                                                                                                                                                                                                                                                                                   |
| S3 doppelte Überschrift                     | Tabellentitel mit `captionLevel: 2` wird selbst zur `h2` (mit `aria-labelledby`), keine eigene Überschrift mehr.                                                                                                                                                                                                                                                                                                                             |
| S4 Doku                                     | §6 und Abweichung 7.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| K1, K3–K8                                   | Zeilen-Codes im Einsteiger-Test; Tabelle im Scroll-Rahmen statt `display:block`; `\p{Cf}` ausgeschlossen (Name und Inhalte); Dokument-Schema prüft „>4 Spalten nur quer“; Legende mit `hasRestDay`; neutraler Hinweis `session.noExercises` statt leerer Tabelle; tote Testzeilen entfernt.                                                                                                                                                  |
| K10                                         | `pnpm install` ausgeführt; `node-linker=hoisted` → `tsx` liegt unter `node_modules/.bin` im Hauptordner.                                                                                                                                                                                                                                                                                                                                     |

**Pflichtpunkte für P3** (aus der Wächter-Prüfung):

- **K2:** Playwright-Test für die Druckansicht: Höhe jeder `section.page` ≤ 297 mm (hochkant) bzw. ≤ 210 mm (quer)
  für alle Beispiele plus einen Extremfall (8 Übungen, lange Namen, Supersatz + „ersetzt“, 600 Zeichen Aufwärmen).
- **K9:** `previousStartGroup` in der App immer aus `planStartGroup()` (nicht aus den aktuellen Regeln wie in den
  CI-Beispielen).

**Erledigt in P3/P4** (Abschnitt 13): App-Knopf, Hinweis-Dialog, Web-Druckansicht, `expo-print`, Seitenumbruch
langer Einheiten (vorher konnten Seiten mit sehr vielen bzw. langen Übungen über A4 laufen).

## 13. Umsetzung P3 + P4 (Stand 06.10.2026)

**Dateien**

- Core: `training-plan-document.ts` bricht Einheiten-Seiten nach **geschätzter Höhe** um (neuer Code
  `session.continued` = „… (Fortsetzung)“, Tabelle mit Kopfzeile wird fortgesetzt, Hinweis + Cool-down notfalls auf
  eigener Folgeseite). Schätzwerte zentral in `PRINT_EXPORT.layout` (`constants.ts`). Tests im Abschnitt
  „Seitenumbruch der Einheiten (Wächter K2)“.
- App: `src/lib/print-plan.ts` (Zusammenstecken Plan → Dokument → Übersetzung → HTML, Auswahl der Spalten, Meldungen),
  `src/lib/print-output.ts` (Web: `window.print()`) bzw. `print-output.native.ts` (`Print.printAsync`),
  `src/components/print-preview.tsx` (Web-Vorschau + Druck-Kopie) bzw. `.native.tsx` (keine Vorschau),
  Route `src/app/plan/drucken.tsx`, Knopf „Als PDF speichern“ auf „Heute“, Texte `i18n/de.ts` → `printView`.
- Tests: `print-plan.test.ts`, `print-output.native.test.ts`, Belastungstest in `print-document.test.ts`;
  Playwright `e2e/print-pages.spec.ts` (alle Beispiele + Belastungstest hochkant/quer) und zwei Abläufe in
  `e2e/training-plan.spec.ts`. Die CI-Vorschau enthält zusätzlich `…-belastungstest.html`.

**Ablauf in der App**

1. „Heute“ → **„Als PDF speichern“** → Route `/plan/drucken`.
2. Plan mit `uses_health_data`: zuerst der Hinweis aus §4 („Weiter“ / „Abbrechen“ = zurück). Das Dokument entsteht
   **erst nach „Weiter“** – auch beim direkten Aufruf der Adresse.
3. Einstellungen: Name aufs Deckblatt (Standard aus, wird nicht gespeichert), Mitschreib-Spalten 0/2/4 (Standard 4),
   im Web zusätzlich „8 Spalten im Querformat“.
4. **„Drucken / als PDF sichern“** (unten fest): Web → Druckdialog des Browsers; iPhone/Android → System-Druckdialog.
5. Zustände: Laden (Bibliothek), Fehler „Übungen konnten nicht geladen werden“ mit „Erneut versuchen“, kein Plan,
   keine Einheiten, Fehler/abgebrochen beim nativen Drucken – alles mit deutschem Text.

**Regeln im Code**

- **K9:** `previousStartGroup` kommt in der App **immer** aus `startGroupOf()` = `planStartGroup()`; Bibliothek,
  Ersatz-Bibliothek und Geräte je Ort wie auf „Heute“ (Test prüft den Aufruf).
- **K11:** Der Name wird mit dem Zod-Schema aus core geprüft; die App zeigt je Fall einen eigenen Satz (fehlt, zu lang,
  unzulässige Zeichen inkl. Emoji mit Zero-Width-Joiner). „Drucken“ ist dann gesperrt, die Vorschau wird ausgeblendet.
- **K2:** Playwright misst im Druck-Layout jede `section.page` (≤ 297 mm hochkant, ≤ 210 mm quer, Fußzeile vorhanden)
  und vergleicht die Seitenzahl des von Chromium erzeugten PDFs mit der Zahl der Abschnitte – für alle Beispiele, den
  Belastungstest (8 Übungen, lange Namen, Supersatz + „ersetzt“, 600 Zeichen Aufwärmen **und** Cool-down) und die
  Druckansicht in der App (hochkant und quer). Ohne den neuen Seitenumbruch lief der Belastungstest über
  (hochkant ≈ 455 mm, quer ≈ 342 mm).
- **Web (B5):** Kein iframe. Die Druckansicht hängt das Dokument zweimal ein: als Vorschau in der App (Handy-Layout)
  und als Druck-Kopie direkt unter `<body>`, die nur `@media print` sichtbar ist; beim Drucken wird alles andere
  ausgeblendet. Die Kopie ist für Screenreader verborgen und hat eigene IDs. Beim Verlassen werden Stil, Kopie und
  Seitentitel zurückgesetzt. Seitentitel (= Dateiname-Vorschlag) „Trainingsplan“, ohne Namen (B7).
- **Nativ (B2–B4):** nur `Print.printAsync({ html, width: 595, height: 842 })`. **Kein** `printToFileAsync`, keine
  Datei im Cache, kein `expo-sharing`/`expo-file-system`, kein eigenes Teilen-Menü (CLAUDE.md „Kein Teilen“). Im
  System-Druckdialog bietet das Betriebssystem selbst „Als PDF sichern“ bzw. auf dem iPhone das Teilen-Symbol der
  Druckvorschau an – das ist der private Download aus §9 und keine Teilen-Funktion der App. Abbrechen auf iOS
  (`ERR_PRINT_INCOMPLETE`) ist kein Fehler. Fehlermeldungen enthalten nie HTML oder Plan-Inhalte.
- **Barrierefreiheit (B10):** Knopf mit `accessibilityHint`, Hinweis als modaler Dialog (`alert`), Ladezustand als
  `progressbar`, Ansage „Plan als PDF“, sobald die Ansicht bereit ist; Vorschau als benannter Bereich.
- `expo-print` per `EXPO_OFFLINE=1 expo install expo-print` auf **~57.0.2** (SDK 57) gesetzt; Lockfile-Änderung nur
  der neue Eintrag (14 Zeilen), `pnpm install --frozen-lockfile` läuft durch.

**Abweichungen (begründet)**

1. **Querformat nur im Web.** Prüfung von P4 im Quelltext von `expo-print` 57: iOS rendert das HTML in einer
   `WKWebView` auf **eine** feste Seitengröße (595 × 842) und Android setzt eine feste `MediaSize` – gemischtes Hoch-/
   Querformat (`@page quer`) wird nativ nicht unterstützt. Nativ gibt es daher nur 0/2/4 Spalten hochkant (auch ein
   veralteter Formularstand wird auf 4 begrenzt, Test). Im Web bleibt die gemischte Ausrichtung (Playwright-Test).
2. **Hinweis-Dialog in der Druckansicht** statt auf „Heute“: so gilt er auch beim direkten Aufruf von
   `/plan/drucken`; für die Nutzerin ist der Ablauf gleich (Knopf → Hinweis → Weiter → Druckansicht).
3. **Seitenumbruch als Schätzung in core** (wie schon `weekRowsPerPage`): ohne Skript im Druck-HTML (CSP) kann nichts
   gemessen werden. Die Werte sind vorsichtig; der Playwright-Test sichert sie ab. Normale Beispiele bleiben
   unverändert (5/8/5/5 Seiten, keine Fortsetzung).
4. **Gewichts-Spalte in der App leer:** Phase-4-Gewichte (Trainingstagebuch) gibt es in der App noch nicht; sobald es
   sie gibt, `progress` in `buildPlanPrint` übergeben.

**Wächter-Prüfung P3+P4 – Auflagen umgesetzt**

| Befund                             | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1 CSP gilt in der App-Seite nicht | `lib/print-sanitize.ts`: Erlaubnisliste für Elemente (main, section, …, svg, path) und Attribute (class, id, lang, scope, role, focusable, aria-*, `style` nur `width:…%` an `col`, SVG viewBox/d/fill/xmlns); alles andere – Skripte, Bilder, Links, `on*`, href/src, Kommentare – wird entfernt. Unit-Test mit `<img onerror>`, `javascript:`-Link, `<script>`, iframe, `url()`; echte Dokumente bleiben unverändert (happy-dom als Test-Umgebung, nur devDependency). |
| S2 Druck-CSS galt app-weit         | `scopedPrintStyles()` in packages/ui: nur Schrift und `@page` global, alle übrigen Regeln nur in Vorschau (`.a5-print-preview`) und Druck-Kopie (`#alpha5-print-root`); `html`/`body` werden zum Bereich. Unit-Test (jeder Selektor im Bereich) und E2E (Stil der App-Überschriften und von `body` auf `/plan/drucken` gleich wie auf „Heute“).                                                                                                                          |
| K1 Direktaufruf                    | E2E: `/plan/drucken` direkt → Hinweis, keine Vorschau und keine Druck-Kopie vor „Weiter“.                                                                                                                                                                                                                                                                                                                                                                                |
| K2 Regeln fehlen                   | Eigener Fehlerzustand „Deine Angaben sind gerade nicht vollständig …“ statt endlosem Laden.                                                                                                                                                                                                                                                                                                                                                                              |
| K3 Neubau je Tastendruck           | Name entprellt (300 ms; „Drucken“ bis dahin gesperrt); Druck-CSS wird nur einmal eingehängt.                                                                                                                                                                                                                                                                                                                                                                             |
| K4 zwei h1                         | Vorschau-Überschriften als `role="heading"` eine Ebene tiefer (gleiches Aussehen über `.h1`–`.h3`); App-Überschriften tragen jetzt `aria-level` (Ebene 2 war im Browser bisher Ebene 1). E2E: genau eine Überschrift der Ebene 1.                                                                                                                                                                                                                                        |

**Offen**

- **P4 ist erst nach dem EAS-Gerätetest fertig (Wächter K5).** `expo-print` ist ein natives Modul: Ein bestehender
  Development- bzw. EAS-Build kennt es nicht – für den Handy-Test ist ein **neuer Build** nötig (K6, im PR-Text unter
  „So testest du es am Handy“ nennen).
- EAS-Build Android + iOS auf echten Geräten: Druckdialog, A4, Schrift/Logo, Ränder, Flugmodus (§9 Schritt 6).
  Erst danach P4 als abgeschlossen melden.
- Prüfen, ob iOS die Seiten mit `viewPrintFormatter` exakt auf A4 umbricht (sonst `useMarkupFormatter` testen).
