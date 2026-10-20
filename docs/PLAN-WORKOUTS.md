# Plan-Nachtrag: Workout-Bibliothek mit Sternen und Timer

Stand 20.10.2026 · Branch `claude/workout-bibliothek` · Gründer-Wunsch (20.10.2026): „Verschiedene Workouts mit
Schwierigkeit in Sternen (1 Stern leicht – 5 Sterne sehr schwer), eine Liste mit Workouts und Timer-Funktion. Man kann
sie einzeln machen, und nach Abschluss werden sie für den Tag hinterlegt.“ Nachtrag am selben Tag: „Mache für die
Workouts ein eigenes Menü.“ Die Gründer haben entschieden: **Claude entscheidet und macht alles selbst** – die
Entscheidungen stehen unten (Abschnitt 2), damit sie nachvollziehbar und änderbar bleiben.

## 1. Was gebaut ist (Überblick)

| Baustein                                                                   | Wo                                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Inhaltsart „workout“ (Zod strikt, Regeln W1–W7)                            | `packages/core/src/workouts/schema.ts`, `checks.ts`, `content:validate`                                              |
| Timer-Logik (Ablaufplan, Lauf, Zusammenfassung)                            | `packages/core/src/workouts/timer.ts`                                                                                |
| Filter, Kachel-Daten, Sicherheitshinweise, Tagebuch-Sätze, Notiz           | `packages/core/src/workouts/library.ts`                                                                              |
| Grenzen mit Quellen                                                        | `WORKOUT_LIMITS` in `packages/core/src/constants.ts`                                                                 |
| Startbestand: 27 Workouts                                                  | `content/workouts/*.json` (Claude-Sitzung, Testphase)                                                                |
| Datenbank: Tabelle `workouts`, `seed_workouts`, `mark_session_log_workout` | `supabase/migrations/20261020150000…150100`, pgTAP `60_workouts`                                                     |
| Einspielen                                                                 | `content-seed` (Workflow unverändert, `packages/content/src/pipeline/seed.ts`)                                       |
| App: Reiter „Workouts“, Detail, Timer, Abschluss                           | `apps/mobile/src/app/(tabs)/workouts.tsx`, `workouts/[id].tsx`, `workout-timer/[id].tsx`                             |
| Tests                                                                      | core (Schema, Regeln, Timer, Bibliothek), content (Seed), mobile vitest, Playwright `e2e/workouts.spec.ts`, pgTAP 60 |

## 2. Entscheidungen

- **W-E1 Format:** drei Abläufe – **Zirkel** (Runden, je Übung Wiederholungen ODER Sekunden), **Intervall** (alles nach
  Zeit, z. B. 40/20) und **Sätze × Wdh.** (Übung für Übung, Satz abhaken). Pause je Übung (`rest_s`, 0 erlaubt);
  Rundenpause (`round_rest_s`) ersetzt die Pause nach der letzten Übung einer Runde. Vor der ersten Übung 5 s
  „Gleich geht's los“.
- **W-E2 Kategorien:** Ganzkörper, Bauch & Rumpf, Oberkörper, Beine & Po, HIIT & Cardio, Mobilität, Rücken-fit.
- **W-E3 Sterne (1–5) und Sicherheit:** Sterne gibt die Redaktion an (kein Rechenwert). Prüfregel W5 erzwingt für
  1–2 Sterne leichte Übungen (Schwierigkeit ≤ 2, ohne „high_skill“) und Pausen ≥ 10 s, für 1 Stern ohne Sprünge.
  In der App sind 4–5 Sterne **nicht verboten**, sondern mit Hinweis versehen: für Einsteiger bzw. vorsichtigen Plan
  („lieber mit 1–3 Sternen beginnen“), bei Auffälligkeiten im Gesundheits-Check („vorher ärztlich abklären“), bei
  Schwangerschaft, und wenn Übungen enthalten sind, die der Plan wegen der Angaben auslässt. Aufwärm-Hinweis immer.
- **W-E4 Übungen nur aus der Bibliothek:** jede Übung höchstens einmal je Workout (ein Tagebuch-Eintrag je Übung),
  höchstens 12 Übungen und 10 Runden (Grenzen des Tagebuchs). Zeitübungen (`load_type` time) nur nach Sekunden, Übungen
  mit Gewicht nur nach Wiederholungen (W4). Geräte = genau die Geräte der Übungen (W3) – so stimmt „ohne Geräte“ immer.
- **W-E5 Eintrag für den Tag = freie Einheit (A1b):** Nach dem Ende oder vorzeitig („Beenden“ → „Für heute
  speichern“) entsteht eine **freie Kraft-Einheit** am heutigen Tag über den vorhandenen Weg (Entwurf →
  `submitWorkout` → verschlüsselte Tagebuch-Warteschlange, offline möglich). Sie zählt in Tagebuch, Tag, Woche und
  Wochenauswertung, **nie** für Progression/Kalibrierung (wie jede freie Einheit). Inhalt: je Übung die erledigten
  Durchgänge (Runden bzw. Sätze) als abgehakte Sätze (Wiederholungen aus dem Workout, Zeitübungen mit Sekunden;
  Körpergewicht/Band nach Zeit ohne Wiederholungen), Beginn/Ende vom Timer, Anstrengung 0–10 freiwillig, Notiz
  „Workout „Titel“ (★★☆☆☆) · 3/3 Runden · 14 Min.“ plus eigene Notiz (höchstens 280 Zeichen).
- **W-E6 Herkunft „workout“ ohne Eingriff in `save_session_log`:** `save_session_log` nimmt neue Einträge nur mit
  Herkunft „manual“ an. Statt die 500-Zeilen-Funktion neu zu fassen (Konfliktgefahr mit parallelen Etappen), setzt die
  neue, kleine Funktion `mark_session_log_workout(p_log_id)` danach die Herkunft „workout“ – nur an einer eigenen
  freien Kraft-Einheit, idempotent, ohne neue Revision. `save_session_log` behält eine gespeicherte Herkunft beim
  Ändern. Die App ruft sie nach dem Speichern auf (in der Warteschlange: Netzfehler → später erneut, das erneute
  Speichern ist über die `write_id` idempotent; inhaltliche Ablehnung → Eintrag bleibt „manual“, nie als abgelehnter
  Entwurf). Der Export enthält die Herkunft automatisch (`to_jsonb(session_logs)`); Widerruf/Löschen unverändert.
- **W-E7 Name des Eintrags:** bleibt „Freie Kraft-Einheit“ (feste Liste im Server). Kalender und Eintrag zeigen
  „Workout“, die Notiz nennt den Titel. „Heute erledigt“ auf der Karte erkennt das Workout am Titel in der Notiz
  (`workoutsDoneOn`) – Übergang bis zu einer eigenen Spalte (W-O1).
- **W-E8 Keine Doppel-Einträge:** Jeder Lauf hat eine feste Eintrags-ID. „Für heute speichern“ geht je Lauf nur
  einmal; erneutes Senden derselben Fassung ist idempotent. Dasselbe Workout später am Tag noch einmal zu machen ist ein
  neuer Lauf und damit (gewollt) ein zweiter Eintrag.
- **W-E9 Laufender Timer nur im Arbeitsspeicher:** kein neuer Speicherort für Tagebuch-Daten (die geschützten Speicher
  bleiben unverändert). Verlassen/Neuladen beendet den Lauf (Hinweis im Timer). Erledigtes wird erst mit „Speichern“
  gesichert – dann verschlüsselt und offline-fest.
- **W-E10 Timer als Zeitrechnung:** Restzeit, Übergänge, Pause/Fortsetzen ergeben sich aus Zeitstempeln (wie der
  Pausentimer und der Intervall-Timer); nach Hintergrund oder Bildschirmsperre stimmt der Stand (abgelaufene Schritte
  werden nachgerechnet, der nächste beginnt am Ende des vorigen). Zeitübungen laufen von selbst weiter, Wiederholungen
  warten auf „Erledigt“. Bildschirm bleibt an (expo-keep-awake, eigener Tag), Ton (Web) bzw. Vibration (App)
  abschaltbar, Ansagen für Bildschirmleser.
- **W-E11 Menü:** eigener Reiter **„Workouts“** (Tab-Screen `app/(tabs)/workouts.tsx`, in `TAB_ORDER` nach „Training“)
  plus Eintrag unter **„Mehr“**. Die anpassbare Menüleiste baut die Etappe `claude/einkaufen-dashboard`; dort wird
  „workouts“ zusammengeführt (Standard: Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr). Die Kachel für
  die Übersicht liegt als Baustein bereit (`WorkoutsTile`, Daten `workoutTileSummary`) und wird bei der Zusammenführung
  eingebunden – die Übersicht-Dateien sind hier bewusst nicht geändert.
- **W-E12 Testphase:** Startbestand `published` mit Prüfvermerk „Claude (Gründer-Auftrag 20.10.2026)“ und
  `expert_reviewed: false`; in der App „Testphase – noch nicht fachlich geprüft“. Eingespielt wird nach derselben
  Einspiel-Regel wie die Ernährung (`content/einspiel-regeln.json`): Testphase = auch ohne Fachprüfung
  (`seed_workouts(…, p_require_expert_review => false)`), Livegang = nur fachlich geprüfte. Schutz vor
  Massen-Archivierung wie bei allen Inhalten. Testmodus: aus dem Bündel.
- **W-E13 Gratis, ohne KI:** Workouts sind feste Inhalte (vorab erstellt, geprüft) – keine Echtzeit-KI.

## 3. Prüfregeln (rot blockiert Freigabe/Einspielen, gelb ist Hinweis)

| Regel | Stufe      | Inhalt                                                                                              |
| ----- | ---------- | --------------------------------------------------------------------------------------------------- |
| W1    | rot, immer | Schema (Pflichtfelder, Grenzen, Format-Regeln, jede Übung höchstens einmal, Prüfer bei „published“) |
| W2    | rot        | Übung existiert; freigegebenes Workout nur mit freigegebenen Übungen                                |
| W3    | rot        | Geräte im Katalog und genau die Geräte der Übungen                                                  |
| W4    | rot        | Zeitübungen nach Sekunden, Übungen mit Gewicht nach Wiederholungen                                  |
| W5    | rot        | 1–2 Sterne: Übungen Schwierigkeit ≤ 2, ohne „high_skill“, Pausen ≥ 10 s; 1 Stern ohne Sprünge       |
| W6    | gelb       | angegebene Dauer ±20 % (mind. ±2 Min.) zur Schätzung (3 s je Wiederholung, einseitig doppelt)       |
| W7    | rot        | Textregeln wie Rezepte (keine Heil-/Gesundheitsversprechen, keine Marken)                           |

## 4. Startbestand (27 Workouts, alle aus vorhandenen Übungen)

| Sterne    | Workouts (Dauer)                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ★ (7)     | Sanfter Einstieg (17), Rumpf-Basis (12), Rücken-fit nach dem Sitzen (16), Beweglich in den Tag (14), Cardio ohne Springen (16), Beine & Po – Start (17), Haltung mit Band (16)                     |
| ★★ (8)    | Bauch-Blitz (12), Express Ganzkörper (10), Oberkörper zuhause (14), Ganzkörper mit Band (18), Kurzhantel-Basis (20), Rücken-fit mit Band (18), Hüfte & Rücken mobil (10), HIIT für Einsteiger (16) |
| ★★★ (6)   | Beine & Po – Kraft (22), Rumpf-Zirkel 40/20 (22), Ganzkörper-Zirkel (19), Oberkörper mit Kurzhanteln (24), Rücken-fit im Studio (24), Studio-Ganzkörper an Maschinen (26)                          |
| ★★★★ (4)  | HIIT 40/20 (27), Kettlebell & Kurzhantel Power (28), Klimmzug & Oberkörper (30), Beine intensiv mit Kurzhanteln (37)                                                                               |
| ★★★★★ (2) | Körpergewicht extrem (34), HIIT 45/15 – sehr schwer (40)                                                                                                                                           |

17 davon ohne Geräte, 3 mit Band, 7 mit Kurzhanteln/Kettlebell/Klimmzugstange/Studio. „Mobilität“: Es gibt noch keine
Dehnübungen in der Bibliothek – die zwei Mobilitäts-Workouts nutzen ruhige Bewegungen mit großem Bewegungsweg (W-O3).

## 5. Offene Punkte (nicht in dieser Etappe)

- **W-O1** Eigene Spalte `session_logs.workout_id` (und Name „Workout: Titel“), sobald `save_session_log` und
  `export_my_data` ohnehin neu gefasst werden – dann ersetzt sie die Erkennung über die Notiz.
- **W-O2** Pipeline-Art „workouts“ für `content-generate` (Gemini-Batch) – bisher entstehen Workouts in der
  Claude-Sitzung bzw. von Hand.
- **W-O3** Dehn-/Mobilitätsübungen in die Übungsbibliothek aufnehmen, danach Mobilitäts-Workouts erweitern.
- **W-O4** Laufenden Timer geschützt zwischenspeichern (Neustart mitten im Workout), falls Rückmeldungen das wünschen.
- **W-O5** Fachprüfung des Startbestands vor dem Livegang (Sterne, Dosierung, Texte).
