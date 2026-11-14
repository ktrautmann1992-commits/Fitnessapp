# Barbell Burn 60 / 30 – Langhantel-Gruppenworkouts

Gründer-Auftrag 14.11.2026. Zwei Workouts mit **eigener Choreografie** im Stil eines Gruppenkurses mit leichter
Langhantel: wenig Gewicht, viele Wiederholungen, Tempo-Angaben. Keine Kursmarke, keine Musik- oder Track-Titel – nur
eigene Bezeichnungen („Track 1 – Aufwärmen“ usw.).

## 1. Wo in der App

Reiter **Training** → Umschalter **Workouts** → Liste („Alle“): Karten „Barbell Burn 60“ (3 Sterne, 60 Min.) und
„Barbell Burn 30“ (2 Sterne, 30 Min.), Ziel „Ganzkörper“, Ablauf „Sätze × Wdh.“. Filter: Sterne 2 bzw. 3, Dauer
„mittel“ bzw. „lang“, Ziel „Ganzkörper“. Direkt: `/workouts/barbell-burn-60`, `/workouts/barbell-burn-30`.

## 2. Aufbau (Tracks)

Ein Track = ein Muskelblock nach Zeit. Technisch ist jeder Track eine Übung (oder beim Rücken drei) im Format
`sets_reps`; der Workout-Player (docs/PLAN-WORKOUTS.md Abschnitt 8) gibt jeder Wiederholungs-Übung ein Zeitfenster
(Wdh. × 3 s, einseitig doppelt, 20–90 s) – das Workout läuft komplett ohne Tippen. Die Tempo-Angaben („3 runter –
1 hoch“, Pulse, Halbe Wiederholungen) stehen im Hinweis jeder Übung.

| Track                          | 60                                                                                      | 30                               |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------- |
| 1 Aufwärmen (leere Stange)     | Aufwärm-Kombi 3 × 16                                                                    | 2 × 16                           |
| 2 Kniebeugen                   | Kniebeuge leicht 6 × 20                                                                 | 5 × 18                           |
| 3 Brust (Stepbrett oder Boden) | Bankdrücken Stepbrett 6 × 20                                                            | 5 × 18                           |
| 4 Rücken                       | Langhantelrudern 2 × 16, Kreuzheben gestreckte Beine 2 × 16, Umsetzen und Drücken 3 × 8 | Rudern 3 × 16, Kreuzheben 2 × 16 |
| 5 Trizeps                      | Stirndrücken 5 × 16                                                                     | –                                |
| 6 Bizeps                       | Bizepscurl Langhantel 5 × 16                                                            | –                                |
| 7 Ausfallschritte              | Ausfallschritt rückwärts 4 × 12 je Seite                                                | –                                |
| 8 Schultern                    | Schulterdrücken leicht 5 × 16                                                           | 4 × 16 (Track 5)                 |
| 9 Bauch (ohne Stange)          | Crunch 5 × 20                                                                           | 3 × 20 (Track 6)                 |
| 10 Dehnen                      | Beinrückseite dehnen 120 s                                                              | 90 s (Track 7)                   |

Dauer im Player: 60 ≈ 58 Min., 30 ≈ 29 Min. (Test `packages/core/src/workouts/barbell-burn.test.ts`). Pausen 15–20 s.
Schwierigkeit: 60 = 3 Sterne (Umsetzen und Drücken ist Übungs-Schwierigkeit 3), 30 = 2 Sterne (nur Übungen bis
Schwierigkeit 2, Pausen ≥ 10 s – Regel W5). Sicherheitshinweise kommen wie bei allen Workouts aus `workoutSafetyHints`
(Aufwärmen immer; Einsteiger, Gesundheits-Check, Schwangerschaft, ausgeschlossene Übungen).

## 3. Geräte

- **Langhantel mit Scheiben** (`barbell`, vorhanden) – leicht beladen, ohne Rack.
- **Stepbrett** (`step_bench`, neu): Migration `20261114120000_step_bench_equipment.sql` (nur additiv), Kategorie
  `other`, nicht zu Hause wählbar. Ersetzbares Hilfsmittel wie Matte/Block (`OPTIONAL_AID_EQUIPMENT`: „auf dem Boden
  liegen“) – fehlt also nie; Brust und Trizeps gehen genauso am Boden. Abgleich in `db-sync.test.ts`, pgTAP
  `116_step_bench_equipment.test.sql`.

## 4. Neue Übungen (alle mit Start- und Endbild aus dem Illustrations-Generator)

`aufwaerm-kombi-langhantel`, `kniebeuge-langhantel-leicht`, `bankdruecken-step-langhantel`,
`umsetzen-druecken-langhantel-leicht`, `stirndruecken-langhantel`, `bizepscurl-langhantel`,
`ausfallschritt-rueckwaerts-langhantel`, `schulterdruecken-langhantel-leicht`, `crunch`. Wiederverwendet:
`langhantelrudern` (bekommt eine Endposition), `rumaenisches-kreuzheben-langhantel`, `beinrueckseite-dehnen-sitzend`.

Ausgangspositionen in `packages/content/src/illustrations/poses-langhantel-leicht.ts`, Endpositionen in
`poses-end.ts`; neu erzeugen mit „Erzeuge die Übungsbilder neu.“ (`pnpm illustrations`).

Die neuen Übungen stehen in `GROUP_BARBELL_ONLY_EXERCISE_IDS` (Teil von `LIBRARY_SEARCH_EXCLUDED_IDS`): Sie kommen nur
über diese Workouts in die App, nie über Tausch, „Andere Übung“ oder Ersatz – alle Trainingspläne bleiben unverändert.
Nach der Fachprüfung je Übung lockern.

## 5. Workout-Bilder (neu, für alle Workouts nutzbar)

Gleiches Muster wie die Rezeptfotos:

- Zuordnung `content/workout-media/<workout-id>.json` (Schema `workoutMediaSchema` in
  `packages/core/src/content/workout-media.ts`: Alt-Text, Herkunft, Lizenz, Quelle, KI-Hinweis Pflicht bei KI-Bildern,
  Größen Kachel 320 × 320 und Banner 1080 × 463). Geprüft in `content:validate` (blockierend).
- Bilddateien `apps/mobile/assets/workout-media/<workout-id>-thumb.webp` / `-banner.webp` (KI-Bilder der Gründer,
  Higgsfield, 14.11.2026).
- App: `apps/mobile/src/data/workout-media-registry.ts` (require()-Liste) und `workout-media.ts` (`workoutImageFor`).
  Kachel links in der Workout-Karte (`WorkoutThumb`), Banner 21:9 mit „KI-Bild, Higgsfield“ oben in der Ansicht
  (`WorkoutBanner`). Workouts ohne Bild zeigen weiter das Stoppuhr-Symbol.
- Neues Bild: Dateien ablegen, Zuordnung anlegen, Eintrag in der require()-Liste – `workout-media.test.ts` meldet jede
  Abweichung.

## 6. Tests

- core: `workouts/barbell-burn.test.ts` (Prüfregeln, Dauer, Zeitfenster, Tracks, Geräte, Bibliotheks-Sperre),
  `content/workout-media.test.ts`, `equipment.test.ts`, `db-sync.test.ts`.
- App: `data/workout-media.test.ts`, `components/workout-image.test.tsx`.
- Playwright: `e2e/barbell-burn.spec.ts` (Liste → Karte mit Bild → Ansicht mit Banner → Start mit Countdown).

## 7. Offen

- Fachliche Prüfung der Choreografie und der neuen Übungen vor dem Livegang (`expert_reviewed: false`).
- Gewichtsempfehlung je Track (z. B. „Kniebeugen schwerer als Bizeps“) – heute nur als Text in den Hinweisen.
