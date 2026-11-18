# Eigene Workouts und Übungstausch in Workouts

Gründer-Wunsch 18.11.2026: „Bei Workouts sollen einzelne Übungen getauscht werden können … und man soll eigene Workouts
erstellen können“ – Ablauf wie Barbell Burn (Tracks nach Muskelgruppen, läuft nach Zeit), Übungen rauswerfen und neu
hinzufügen.

## 1. Wo in der App

- Reiter **Training** → Umschalter **Workouts** → oben **„Eigenes Workout erstellen“**, darunter **„Meine Workouts“**.
- Assistent: `/eigene-workouts/neu` – 5 Schritte: Dauer (15/20/30/45/60 Min.), Muskelgruppen (Ganzkörper, Beine, Po,
  Rücken, Brust, Schultern, Arme, Bauch/Core), Geräte (vorausgewählt aus dem Profil), Lieblingsübungen, „Mag ich nicht“.
  Danach die **Vorschau**: Tracks mit Bild, Name, Dosierung; je Übung „Tauschen“, „Entfernen“, ▲/▼; je Track „Übung
  hinzufügen“; Gesamtdauer live; „Neu würfeln“, „Speichern“, „Jetzt starten“ (speichert vorher). Name vorgeschlagen,
  z. B. „Mein Beine & Po 30“.
- Gespeichertes Workout: `/eigene-workouts/eigen-<id>` – dieselbe Vorschau zum Bearbeiten, Starten, Löschen.
- Bibliotheks-Workout `/workouts/<id>`: je Übung „Tauschen“ (Bodenblatt mit Bild und Name). Der Tausch wird als
  persönliche Variante gespeichert, der nächste Start nutzt sie; Kennzeichen „angepasst“ (Ansicht und Karte),
  „Original wiederherstellen“. Flow-Routinen (Yoga/Pilates) haben keinen Tausch – dort gilt der eigene Sicherheitsfilter.
- Player: unverändert (`/workout-timer/<id>`) – Countdown, automatisch weiter, Bildschirm bleibt an, Bewegungsbilder. Der
  Lauf trägt die persönliche Fassung (`startActiveRun({ keepWorkout })`).

## 2. Fachlogik (packages/core/src/workouts)

- `swap.ts` – `workoutSwapCandidates(workout, index, ctx)`: eigene Alternativen zuerst, dann gleiches Muster mit
  gemeinsamem Hauptmuskel, dann gemeinsamer Hauptmuskel; nie schon im Workout, „Mag ich nicht“, fehlende Geräte,
  ausgeschlossene Merkmale, Schwierigkeit mehr als ±1 bzw. über dem Level; Dehnen nur gegen Dehnen. `mapWorkoutItem`:
  Zeit bleibt Zeit, Wdh. → Zeitfenster bei Halteübungen, Zeit → Wdh. bei Gewichtsübungen (Regel W4). Varianten:
  `workoutVariantSchema`, `withVariantSwap`, `applyWorkoutVariant` (passt eine Position nach einer neuen Fassung nicht
  mehr, entfällt nur dieser Tausch).
- `custom.ts` – `buildCustomWorkout(input, library, ctx)`: deterministisch per `seed` („Neu würfeln“ = `nextCustomSeed`),
  Aufwärmen (Puls, dann Gelenke, ohne Sprünge/Geräte) → je Gruppe ein Track (1–3 Übungen, große Muskeln zuerst,
  Bauch/Core zuletzt; bei einer Gruppe und langer Dauer „Teil 1/2“) → Dehnen passend zu den Gruppen. Format `sets_reps`
  (Zeitfenster im Player), Dosierung schrittweise auf die Zieldauer ±10 % skaliert. Lieblingsübungen zuerst, wenn sie
  passen (sonst Hinweis mit Grund), „Mag ich nicht“ nie. Schwierigkeit nach Level (Einsteiger/vorsichtig ≤ 2,
  Fortgeschrittene ≤ 3), ausgeschlossene Merkmale aus dem Gesundheits-Check nie. Ergebnis: Bauanleitung
  (`customWorkoutDefinitionSchema`) → `customWorkoutFromDefinition` = gültiges Workout (workoutSchema, Status Entwurf).
  Bearbeiten: `removeCustomItem`, `addCustomItem`, `replaceCustomItem`, `moveCustomItem`, `customAddCandidates`.
- Grenzwerte: `CUSTOM_WORKOUT_RULES` in `constants.ts` (PRODUKTENTSCHEIDUNG, vor Livegang fachlich prüfen).
- Gesperrt in Workout-Suchen: nur die Barbell-Burn-Gruppenübungen (`WORKOUT_SEARCH_EXCLUDED_IDS`). Hyrox-, WOD- und
  Tiefe-Bauch-Übungen sperrt weiter nur die Plan-Engine (Pläne bleiben byte-gleich).

## 3. Speicher

- Supabase (`20261118120000_custom_workouts.sql`, nur additiv): `custom_workouts` (id, user_id, name, definition jsonb),
  `workout_variants` (user_id, workout_id, definition jsonb), `exercise_dislikes` (user_id, exercise_id). RLS nur eigene
  Zeilen, Schreiben mit Profil, Form-Prüfung per Trigger (zweite Grenze nach Zod), Höchstzahlen 50/200/300. Export als
  Obermenge in `20261118120100_custom_workouts_export.sql`; Konto löschen per Kaskade. pgTAP
  `117_custom_workouts.test.sql`, `04_account_deletion.test.sql` erweitert.
- App (`apps/mobile/src/data/my-workouts.ts`): offline-first wie Trinken – sofort auf dem Gerät, Warteschlange, Senden per
  PostgREST; Testmodus nur Gerätespeicher. Export (Testmodus) und Löschen über `attachMyWorkouts`.
- „Mag ich nicht“: eigene Tabelle `exercise_dislikes` (Assistent Schritt 5) und vorhandene Übungs-Präferenzen
  „mag ich nicht“ (Testmodus) – beide gelten für eigene Workouts und Tausch in Workouts.

## 4. Tests

- core: `workouts/custom.test.ts`, `workouts/swap.test.ts`, `db-sync.test.ts` (Grenzen, RLS, Export).
- App: `data/my-workouts.test.ts`, `data/my-workouts-view.test.ts`.
- Playwright: `e2e/eigene-workouts.spec.ts` (Tausch im Bibliotheks-Workout bis zum Player; eigenes Workout 30 Min.
  Beine + Bauch mit Tauschen/Entfernen/Hinzufügen, Speichern, „Meine Workouts“, Start mit Countdown). Bildschirmfotos mit
  `EIGENE_SHOTS=<Ordner>`.

## 5. Offen

- Plan-Engine: `exercise_dislikes` wirkt noch nicht auf Trainingspläne (dort gelten die Übungs-Präferenzen, Supabase erst
  mit Etappe T3). Vorschlag: in T3 zusammenführen.
- Ziehen zum Umsortieren (heute ▲/▼ innerhalb eines Tracks).
- Fachliche Prüfung der Dosierung (`CUSTOM_WORKOUT_RULES`) vor dem Livegang.
