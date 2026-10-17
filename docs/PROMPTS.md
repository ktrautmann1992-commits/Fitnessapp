# Umsetzungsplan für Claude Code – Prompts zum Kopieren

## So arbeitet ihr damit (nur Handy)
Die Einrichtung steht Schritt für Schritt in `docs/HANDY-ANLEITUNG.md`, die Verbindung der Dienste in `docs/SETUP.md`. Kurzfassung:
1. Pro Phase eine **neue Sitzung** im Code-Tab der Claude-App starten (Repo auswählen, Prompt einfügen).
2. Jeden Prompt beginnt Claude Code mit einem Plan. Lest ihn, antwortet „Passt, umsetzen“ oder mit Änderungswünschen.
3. Claude Code liefert einen Pull Request. Im PR steht ein Vorschau-Link → am Handy testen.
4. Passt alles: in der GitHub-App „Merge“. Danach laufen Migrationen und Deployments automatisch.
5. Fehler gefunden: in derselben Sitzung beschreiben (gern mit Screenshot-Beschreibung), Claude Code korrigiert den PR.
6. Weicht eine Entscheidung vom Konzept ab: Claude Code bitten, sie in `docs/KONZEPT.md` nachzutragen.

Jeder Prompt unten beginnt implizit mit: „Lies CLAUDE.md und docs/KONZEPT.md. Erst Plan zeigen, nach meiner Freigabe umsetzen, Ergebnis als Pull Request mit Handy-Testanleitung.“

Die Erweiterungen aus dem Brainstorming (`docs/ERWEITERUNGEN.md`) sind in `docs/KONZEPT.md` eingearbeitet und hängen
als Ergänzungen bzw. „b“-Phasen an den passenden Phasen unten (4b, 7b, 9b, 11b).

Die **Erweiterungen Teil 2** (`docs/ERWEITERUNGEN-2.md`: Rezepte, Küche, Lead-Magnet) sind ebenfalls in
`docs/KONZEPT.md` eingearbeitet (Abschnitte 6.5–6.13, 17, 18). Ihre Prompts B–G stehen direkt nach Phase 5;
der Umsetzungsplan dazu ist `docs/PLAN-PHASE-5.md` Abschnitt 19.

---

## Phase 0 – Fundament
```
Lies CLAUDE.md vollständig – besonders den Abschnitt zur reinen Handy-Arbeitsweise.
Verschiebe KONZEPT.md, PROMPTS.md und HANDY-ANLEITUNG.md in den Ordner docs/ (falls sie im
Hauptverzeichnis liegen). Richte das Monorepo ein: Turborepo + pnpm, apps/mobile (Expo mit
Expo Router, TypeScript, Web-Export aktiviert), apps/web (Next.js App Router), packages/core,
packages/db, packages/ui, packages/content. TypeScript strict, ESLint, Prettier, Vitest.
Lege alle GitHub Actions aus CLAUDE.md an (ci, db-migrate, content-generate, content-seed,
eas-build) – vorerst so, dass sie ohne gesetzte Secrets nicht fehlschlagen, sondern freundlich
überspringen. Supabase-Anbindung (Region EU) vorbereiten, .env.example pflegen.
Schreibe docs/SETUP.md: nummerierte Klick-Schritte für den Handy-Browser, wie ich Supabase,
Vercel (zwei Projekte: Web-Export der App und apps/web) und Expo verbinde und welche Secrets ich
wo eintrage. Am Ende muss ich eine Startseite der App über einen Vercel-Link am Handy sehen.
```

## Phase 1 – Auth, Einwilligungen, Onboarding
```
Setze Registrierung/Login (E-Mail + Apple + Google) mit Supabase Auth um. Baue das Onboarding
exakt nach docs/KONZEPT.md Abschnitt 2 und docs/PLAN-PHASE-1.md als mehrstufigen Ablauf mit Fortschrittsanzeige, in
mobile und web. Lege die Tabellen profiles, body_metrics, consents, health_screening, goals,
user_equipment, equipment, nutrition_prefs, food_preferences mit Migrationen und RLS an.
Altersprüfung ab 16, Einwilligungen getrennt und versioniert. Gesundheits-Check setzt Flags,
die später zu konservativen Plänen führen. Alle Texte auf Deutsch.
```

### Ergänzung zu Phase 1 – Körperumfänge
**Bereits umgesetzt in Etappe A** (Tabellen `body_measurements` und `measurement_reminders` mit RLS, an die
`health_data`-Einwilligung gebunden; Fachlogik in `packages/core`). Der Onboarding-Schritt kommt mit Etappe B.
Der Prompt bleibt zur Nachvollziehbarkeit stehen:
```
Ergänze das Onboarding um den optionalen Schritt Körperumfänge nach docs/KONZEPT.md Abschnitt 11.1,
inklusive Mess-Anleitung, Tabelle body_measurements und measurement_reminders mit RLS.
```

## Phase 2 – Übungsbibliothek & Content-Pipeline
```
Lege exercises, exercise_alternatives, plan_templates, template_sessions, template_exercises an.
Baue in packages/content ein Skript, das über die Claude Message Batches API (Modell als
Umgebungsvariable konfigurierbar) Plan-Vorlagen und Übungsbeschreibungen erzeugt, gegen
Zod-Schemas validiert und mit status=draft speichert. Baue in apps/web einen geschützten
Admin-Bereich zum Prüfen, Bearbeiten und Freigeben (draft -> published). Starte mit einer
kleinen Matrix (3 Ziele x 2 Level x 3/4 Tage x Studio/Zuhause), damit ich die Qualität prüfen kann.
```

## Phase 3 – Plan-Engine
```
Implementiere in packages/core die Plan-Engine nach docs/KONZEPT.md Abschnitt 4: Matching mit
Scoring, Equipment-Anpassung über Alternativen, Terminierung auf bevorzugte Tage, Startgewichte,
doppelte Progression, Deload-Logik, Neuplanung verpasster Einheiten. Reine Funktionen, umfassende
Unit-Tests mit Grenzfällen. Danach: Nutzer-Plan nach Onboarding erzeugen und in user_plans,
planned_sessions, planned_exercises speichern.
```

## Phase 4 – Tagesansicht & Trainingstagebuch (MVP-Abschluss)
```
Baue die Tagesansicht und das Trainingstagebuch nach docs/KONZEPT.md Abschnitt 5: Übungen
abhaken, "nicht gemacht" oder "Alternative durchgeführt" mit Auswahl, Sätze mit Gewicht und
Wiederholungen, Cardio mit Distanz/Zeit/Pace, Belastungsempfinden als Schieberegler 0-10,
Notizen, Pausentimer. Offline-first mit lokalem Speicher und Sync. Logs fließen in die
Progression der Plan-Engine zurück. Danach Wochen- und Verlaufsansicht.
```
→ **Hier ist das MVP fertig.** Jetzt einen ersten nativen Build erzeugen:
```
Richte EAS Build und EAS Submit vollständig ein. Erkläre mir in docs/SETUP.md mit Klick-Schritten
am Handy, wie ich den Apple-Developer- und Google-Play-Account verbinde. Ziel: Ich starte in der
GitHub-App den Workflow eas-build und bekomme eine Android-APK zum Installieren sowie einen
iOS-Build in TestFlight.
```

### Zwischenschritt – Übungs-Glossar und Übungstausch
**Stand 10.10.2026: G1, T1 und T2 erledigt** (Plan `docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md`, Gründer-Wunsch vom
09.10.2026, kein eigener Prompt). Glossar mit Anleitung zu allen Übungen (G1), Tausch-Logik „Nur heute“ / „Ab jetzt
immer“ in `packages/core` (T1) und Tausch in der App im Testmodus (T2). **T3** (Supabase: Migration, RLS, pgTAP)
kommt später zusammen mit den anderen Supabase-Etappen, **G2** (Bilder/Videos) später mit eigenem Plan.

## Phase 4b – Live-Anpassung (Premium, ohne KI)
```
Setze docs/KONZEPT.md Abschnitt 4.1 um: Regel-Engine in packages/core mit umfassenden Tests
(Startwerte in constants.ts), ereignisgesteuerte Neuberechnung auf dem Server, Tabelle
plan_adjustments mit RLS, Ansicht "Warum hat sich mein Plan geändert?" aus festen Textbausteinen,
Bestätigung bei großen Änderungen (weniger Trainingstage, Kalorien), Mess-Erinnerungen per Push
(die Mess-Erinnerung bleibt gratis, nicht hinter Premium).
Kalorienänderungen nur innerhalb der Schutzgrenzen aus CLAUDE.md. Premium-Prüfung auf dem Server
(bis Phase 7 hinter Feature-Flag); Gratis-Nutzer behalten die einfache Progression.
```
**Stand 10.10.2026:** Plan freigegeben (`docs/PLAN-PHASE-4B.md`), **Etappe A0 erledigt**. Reihenfolge laut
Gründer-Entscheidung 09.10.2026: Übungs-Glossar/Übungstausch (erledigt bis T2) → **Phase 5** → danach 4b weiter mit
A → D (Testmodus) → E; B und C später, wenn echte Konten mit Supabase kommen. **Gründer-Entscheidung 13.10.2026:** Nach Phase 5 kommt zuerst **Phase 10** (Ausdauer-Wettkampf & Strecken), danach 4b. Kalorien-Anpassungen aus 4b laufen nur
als Versatz durch die Schutzgrenzen der Ernährungs-Engine aus Phase 5 (`nutrition/limits.ts`).

## Phase 5 – Ernährungs-Engine, Essensplan, Einkaufsliste
```
Implementiere docs/KONZEPT.md Abschnitt 6. Zuerst packages/core/nutrition mit Grundumsatz,
Gesamtumsatz tagesgenau inkl. geplanter Trainingsenergie, Zielanpassung mit den Schutzgrenzen
aus CLAUDE.md, Makros, Mahlzeiten-Timing vor/nach dem Training – alles getestet. Dann Rezepte
über die Content-Pipeline erzeugen (mit Makro-Plausibilitätsprüfung) und freigeben. Dann
Wochen-Essensplan (Vorlieben, Ernährungsform, Schwein ja/nein, Kochmodus täglich/Meal-Prep)
und aggregierte, nach Abteilung sortierte Einkaufsliste.
```
**Stand 10.10.2026: Plan freigegeben** (`docs/PLAN-PHASE-5.md`, zwei Wächter-Runden eingearbeitet, offene Fragen:
„Alles wie empfohlen“), **Etappe N0 (Plan) erledigt**. Kommt **vor** der weiteren Umsetzung von Phase 4b (Reihenfolge:
Übungs-Glossar/Übungstausch bis T2 → Phase 5 → 4b). Zuerst nur im **Testmodus** (N1–N6), Supabase später (N7),
Batch-Pipeline für Rezepte optional (N8). **Etappe N1 (Core: Bedarf, Grenzen, Makros, Timing) umgesetzt**
(`packages/core/src/nutrition`, CI-Tabelle „Beispiel-Ernährung“). **Etappe N2a (Inhalte: Schemas, Prüfregeln
R1–R19, Allergen-Pflichtregeln für alle 23 Gruppen, Einheiten, `selectNutritionContent`, Test-Fixtures) umgesetzt.**
**Etappe N2b Teil 1 umgesetzt (11.10.2026):** Lizenz geklärt (BLS 4.0, CC BY 4.0, Namensnennung Max
Rubner-Institut), Workflow `foods-import`, CI-Job `sources-integrity`, Zuordnungs-Vorschlag für alle 236 Zutaten
(`content/food-mapping/alpha5-zuordnung.json`, Quell-IDs aus dem Kandidatenlauf), CODEOWNERS, `docs/SETUP.md` Teil J.
Nächster Schritt: Gründer-Aufgaben Teil J, dann Import per Workflow; danach N2b Teil 2 („Katalog geprüft“).
**Etappe N2c umgesetzt (12.10.2026):** Import-Skript `pnpm content:import-alpha5` + Workflow `alpha5-import`
(Entwürfe als Pull Request, nie `content/foods`), Zod-Schemas für Meal-Prep-Pläne und Ratgeber, Rezeptfelder aus 19.4,
Prüfregeln R20–R22, Inhalts-Bündel und Auswahl in der App (`selectNutritionContent`). Die Rezeptdateien entstehen erst
per Workflow, sobald der Lebensmittel-Katalog importiert ist (`docs/SETUP.md` Teil J, „Rezepte importieren“).
**Etappe N3 umgesetzt (12.10.2026):** Core für Essensplan (`buildMealPlanWeek`, Planband je Tag oder
`below_floor`), Rezept-Filter mit allen harten Ausschlüssen, Meal-Prep (Kochtermine, R9, `applyMealPrepPlan`,
Gratis-Plan), Einkaufsliste, automatische Neuplanung, Rezeptsuche und Portionswähler – mit Test-Fixtures, ohne App.
**Etappe N4 umgesetzt (12.10.2026, Testmodus):** Onboarding-Schritt „Alltag und Training“ (`nutrition_setup`, nur
Testmodus bis N7) + CHECK-Migration, Karte „Essen heute“, Ernährung-Tag, Rezeptansicht mit Portionswähler und
Allergen-Warnung, Einstellungen Ernährung („Kalorienzahlen anzeigen“), Widerruf mit Angebot „mag ich nicht“, Export.
Bis der echte Katalog da ist: Beispiel-Rezepte mit Testwerten (gekennzeichnet). Details `docs/PLAN-PHASE-5.md`.
**Etappe N7 Teil 1 umgesetzt (14.10.2026):** Supabase-Datenbank für die Ernährung (Inhalts- und Nutzertabellen mit
RLS, `seed_nutrition_content` nur mit Fachprüfung, `save_meal_plan` mit erneuter Filter- und Einwilligungs-Prüfung,
`replace_shopping_list`, Bewertungen/„mag ich nicht“, Widerruf, Export, Löschung, pgTAP), Einwilligungstexte vor dem
Login ohne `current_consent_version`. Teil 2 (App im Supabase-Modus, `content-seed` Ernährung) wartet auf Freigabe.
**Etappe N8 umgesetzt (15.10.2026):** Content-Pipeline auf **Google Gemini** umgestellt (Gründer-Entscheidung
14.10.2026 „KI läuft über Gemini – überall“): Gemini Batch API mit strukturierter JSON-Ausgabe, Secret
`GEMINI_API_KEY` (`ANTHROPIC_API_KEY` entfällt), günstige Standardmodelle je Art (`gemini-3.5-flash-lite` für
Austausch/Packungen, `gemini-3.8-flash` für Rezepte/Übungen/Vorlagen), Deckel 3 $ pro Lauf (höchstens 20 $), Standard
3 Anfragen, Workflow-Eingabe „modell“. Neue
Batch-Art `recipes` (nur Katalog-Zutaten, Health-Claims-Regeln, Allergene/Ernährungsform/Schwangerschaft als
Gegenprüfung, Entwürfe per Pull Request, menschliche Freigabe). An Gemini gehen nur Inhalts-Prompts, nie Nutzerdaten.
Prompt-Vorgaben für Rezepte: `packages/content/src/pipeline/kinds/recipe.ts` (System-Text) nach `docs/PLAN-PHASE-5.md`
5.2, 5.3 und 10. Details `docs/PLAN-PHASE-5.md` Umsetzungsstand N8. Hinweis: Der Phase-2-Prompt oben nennt noch die
„Claude Message Batches API“ – er bleibt zur Nachvollziehbarkeit stehen; gültig ist Gemini.
**Nachtrag 11.10.2026 (Erweiterungen Teil 2):** Rezeptbestand ist `packages/content/seed/alpha5-rezepte.json` statt
KI-erzeugter Rezepte – N2b umfasst alle 236 Zutaten, N2c ist der Import (Prompt B Schritte 3–5), N3–N6 enthalten den
Umfang von Prompt C; neue Etappen N9–N14 (Prompts D, F, E). Details `docs/PLAN-PHASE-5.md` Abschnitt 19.

### Erweiterung Phase 5 – Lebensmittel-Tracker, Standardgerichte, Gerichte rund ums Training
```
Setze docs/KONZEPT.md Abschnitte 6.1, 6.2 und 6.3 um: Barcode-Scan mit Open Food Facts und
sichtbarer ODbL-Quellenangabe, eigene Produkte, Ernährungstagebuch (food_log_entries) mit
Tagesziel, Favoriten und "zuletzt gegessen", Standardgerichte. Für jede geplante Einheit
Zielmengen und Zeitfenster vor, während und nach dem Training mit 2-3 konkreten Vorschlägen aus
der Rezeptdatenbank (Mengen + Nährwerte, Portion auf Ziel ±10 % skaliert), immer einer schnellen
Alternative ohne Kochen, Sonderfall Frühtraining, Push-Erinnerung zum richtigen Zeitpunkt und
"Gegessen" per Tipp ins Tagebuch (Premium, ohne KI; Premium-Prüfung serverseitig, bis Phase 7
hinter Feature-Flag). Ergänze die Content-Pipeline um passende
Rezepte mit den Tags vor_training, waehrend und nach_training. Lege mir vorher die offene
Entscheidung "konkrete Marken oder nur Produktarten" zur Freigabe vor.
```

### Zwischenschritt – Ziele erweitern (Z0–Z6)
**Stand 13.10.2026: Z0 – Plan Wächter-geprüft (Auflagen eingearbeitet)** (Plan `docs/PLAN-ZIELE.md`, Gründer-Wunsch
vom 13.10.2026, kein eigener Prompt): Abnehmen ohne oder mit konkretem Ziel (kg in welcher Zeit), Erreichbarkeits-Ampel
von Rot bis Grün, Haupt- und Nebenziel. Gründer-Entscheidungen F1, F5 („nie schneller als heute“), F7 (nur
Planungsdauer) und F12 stehen in Abschnitt 0, die übrigen Fragen „wie empfohlen“. Wächter-Urteil „Freigabe mit
Auflagen“ (B1, S1–S20, K1–K10), Runde 2 erneut „Freigabe mit Auflagen“ ohne Blocker (N1–N4, K-a bis K-f),
alle eingearbeitet (Abschnitt 10). **F8 entschieden (17.10.2026):** Ziel-BMI hart 20, ab 70 J. 22 (Wächter-Empfehlung
S12, GLIM 2019) – damit ist Z0 vollständig erledigt.
**Stand 13.10.2026: Z1 umgesetzt, Wächter-geprüft (Auflagen eingearbeitet)** – Ziel-Profil `packages/core/src/goals/profile.ts`,
`GOAL_PAIR_RULES`, Nebenziel in Plan und Ernährung (optional, Standard `null`, Payload ohne Schlüssel bei `null`),
Migration `20261013120000_plan_inputs_secondary_goal.sql` (`goal_pair_allowed`, `assert_plan_inputs`) mit pgTAP 27.
Abweichungen und Wächter-Auflagen (S-1 bis S-3, K-1 bis K-7; S-3 ist Auflage für Z4) in `docs/PLAN-ZIELE.md` Abschnitt 11.
**Stand 13.10.2026: Z2 umgesetzt, Wächter-geprüft (Auflagen eingearbeitet)** – Abnehmziel und Ampel nur im Core
(`goals/weight-goal*.ts`, `weightGoal` in `nutritionTargetsForWeek`, optional, Standard `null`), keine Migration, keine App.
Abweichungen und Wächter-Auflagen (S-1, K-1 bis K-7; K-2/K-5/K-6 als Vormerkungen für 4b, Z3, Z5) in `docs/PLAN-ZIELE.md`
Abschnitt 12.
**Stand 17.10.2026: Z3 umgesetzt, Wächter-geprüft (M1, N1, N4, N5 eingearbeitet; N2/N3 Vormerkung Z4)** – Migrationen `20261017200000_goals_secondary.sql`
(Nebenziel, Paar- und Disziplin-CHECK, Onboarding-Schritt `weight_goal`), `20261017200100_weight_goals.sql` (Wunschgewicht,
Art. 9, RLS, Trigger „nur mit Abnehmziel“ und Datensparsamkeit), `20261017200200_weight_goals_revoke_export.sql`
(Widerruf, Export) mit pgTAP 43, SENSIBEL-Test in `db-sync.test.ts`, Testmodus und Supabase-Schreibwege, F8 im Core.
Abweichungen in `docs/PLAN-ZIELE.md` Abschnitt 13.
**Stand 17.10.2026: Z4 umgesetzt, Wächter-geprüft (M1–M5, N1–N13 eingearbeitet; Trigger-Migration `20261017220000_goals_secondary_autoclear.sql` mit pgTAP 46; EAS-Build offen)** – App: Schritt „Dein Ziel“ mit Haupt- und Nebenziel
(verbotene Paare ausgegraut mit Grund, Kombinationssatz, Disziplin/Datum auch beim Nebenziel Ausdauer), neuer Schritt
„Wie möchtest du abnehmen?“ (`weight_goal`, `WEIGHT_GOAL_STEP_ENABLED = true`) mit Erreichbarkeits-Ampel
(`FeasibilityScale`, `role="meter"`), Token `caution`, Vormerkungen Z3 N2/N3 erledigt, Playwright `goals.spec.ts`.
Umsetzungsnotizen in `docs/PLAN-ZIELE.md` Abschnitt 14, Handy-Test in `docs/HANDY-ANLEITUNG.md` Teil 7z2.
**Stand 17.10.2026: Z5 und Z6 umgesetzt (Wächter-Prüfung steht aus; keine Migration)** – Einstellungen → „Dein
Abnehm-Ziel“ (`/abnehmziel`: ansehen, bearbeiten, entfernen, verlängern), Karten „Wunschgewicht erreicht“ (Gewicht
halten / Muskelaufbau / neues Wunschgewicht) und „Zeitraum vorbei“ (Verlängern / ohne festes Ziel) auf „Heute“, Hinweise
einmal je Woche in der Ernährungs-Übersicht (K10), Planname mit zwei Zielen auf „Heute“, in der Woche und im
Trainings-PDF, automatische Neuplanung des Essensplans bei neuem Abnehmziel (`weight_goal_changed`), Wächter Z4 N10
(„Weiter“ ohne Änderung behält das Ziel), Playwright `weight-goal-settings.spec.ts`. Z6: KONZEPT (§1, §2, §4, §6, §11,
§12, §14 DSFA), PLAN-PHASE-5, PLAN-PHASE-4B, PLAN-PHASE-10. Notizen in `docs/PLAN-ZIELE.md` Abschnitt 15, Handy-Test
in `docs/HANDY-ANLEITUNG.md` Teil 7z3.
Reihenfolge (F12): **Z1**
(Core: Ziel-Profil, zwei Ziele, dazu kleine Migration `assert_plan_inputs` mit optionalem Nebenziel-Schlüssel) und
**Z2** (Core: Abnehmziel und Ampel) jetzt parallel zu Phase 5 → nach Phase 5: **Z3** (Datenmodell, Migration mit RLS,
Testmodus, Export) → **Z4** (Onboarding mit Ampel, nach F8) → **Z5/Z6** (Einstellungen, Anzeigen, PDF, Doku) → dann
Phase 10.

## Erweiterungen Teil 2 – Rezepte, Küche, Lead-Magnet (Prompts B–G)
Quelle: `docs/ERWEITERUNGEN-2.md` (Gründer, 11.10.2026). Jeder Prompt beginnt implizit mit: „Lies CLAUDE.md,
docs/KONZEPT.md und docs/ERWEITERUNGEN-2.md. Erst Plan in einfachen Worten zeigen und auf Freigabe warten.“
Die Prompts sind in `docs/PLAN-PHASE-5.md` Abschnitt 19 in Etappen übersetzt – **dort steht, was gilt**; die Prompts
bleiben zur Nachvollziehbarkeit stehen.

**Stand 11.10.2026 – Gesamtplan von den Gründern freigegeben.** Reihenfolge:
1. Prompt B Schritte 1–2: Dateien einsortieren (**erledigt**, #32) und Doku einarbeiten (**erledigt**).
2. Prompt G: Lead-Magnet (**in Arbeit**, läuft parallel).
3. Prompt B Schritte 3–5 (Rezept-Import) zusammen mit Phase-5-Etappen **N2b/N2c** (+ N2d Admin).
4. Prompt C zusammen mit Phase-5-Etappen **N3–N6**.
5. Prompt D → Etappen **N9–N11**.
6. Prompt F (nur „Sofort“) → Etappe **N12**.
7. Prompt E: Logik (Portionsfaktor, Reste-Score) sofort → Etappe **N13**; Resteplanung in der App → **N14**;
   Oberfläche Paar-Modus erst mit dem Partner-Modus (Phase 11).

Festgelegt: Nährwerte aus der amtlichen Datenbank (jede der 236 Zutaten mit Quell-Eintrag, Datei-Werte nur
Gegencheck > 3 %), Allergene über die Regeln aus N2a, alle Rezepte `draft` + Fachprüfung; Premium in der Testphase
für alle offen, Server-Prüfung mit Phase 7; Lead-Magnet ohne Newsletter-Pflicht.

### Prompt B – Dokumente einarbeiten und Rezepte importieren
**Schritte 1 und 2 erledigt** (B1: Dateien einsortiert, B2: Doku eingearbeitet). **Schritte 3–5** laufen als
Phase-5-Etappen N2b/N2c/N2d (Abweichung: Import erzeugt Inhaltsdateien per Pull Request statt direkt in die
Datenbank; Tabellen kommen mit N7 – siehe PLAN-PHASE-5 Abschnitt 19). **Schritt 5 umgesetzt (N2d, 13.10.2026):** Admin-Seiten
Rezepte/Lebensmittel/Meal-Prep/Ratgeber (nur ansehen) und Sammelfreigabe pro Kategorie im Workflow `content-review`
(Art `recipe`); 14.10.2026 nach Gründer-Entscheidungen: Freigabe per ID für Rezepte ohne Kategorie, Meal-Prep-Pläne
und Ratgeber (Art `ids`) und Fingerabdruck bestätigter Import-Annahmen – Umsetzungsstand N2d.
```
Lies CLAUDE.md und ERWEITERUNGEN-2.md im Hauptverzeichnis.
1. Verschiebe ERWEITERUNGEN-2.md nach docs/, alpha5-rezepte.json nach packages/content/seed/ und
   Alpha5-Gratis-Rezepte.pdf nach apps/web/public/downloads/.
2. Arbeite ERWEITERUNGEN-2.md in docs/KONZEPT.md (Abschnitte und Gratis/Premium-Tabelle) und
   docs/PROMPTS.md (neue Phasen an passender Stelle) ein.
3. Erweitere das Datenbankschema für Rezepte, falls nötig: Kategorien, Ernährungsformen (n:m), Tags,
   Abschnitt, Portionen, Kosten, Meal-Prep-Pläne mit Kochtag-Schritten, Ratgeber-Seiten. Migrationen mit
   RLS (Inhalte für alle lesbar, Schreiben nur Admin).
4. Schreibe ein Import-Skript in packages/content (idempotent über die ids), validiere die Datei mit Zod,
   rechne Nährwerte aus den Zutaten nach und melde Abweichungen über 3 %. Lege den GitHub-Workflow
   content-seed so an, dass er die Datei importiert (manuell startbar).
5. Alle importierten Rezepte bleiben status=draft und erscheinen im Admin-Bereich zur Freigabe; baue dort
   eine Sammel-Freigabe pro Kategorie.
Zeig mir am Ende, wie viele Rezepte, Zutaten und Pläne importiert wurden.
```

### Prompt C – Rezepte in der App
**Offen** – zusammen mit den Phase-5-Etappen N3–N6 (Rezeptsuche, Portionswähler, Einkaufsliste abhakbar,
Trainingsbezug, Meal-Prep-Kochtag mit Timern, Ratgeber offline). Wettkampftage kommen mit Phase 10, die
automatische Rezept-Belegung je Einheit ist Premium (Etappe X4).
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 2 um: Rezeptsuche mit Filtern (Ernährungsform aus dem Profil
vorbelegt), Rezeptansicht mit Portionswähler und abhakbarer Einkaufsliste, Trainingsbezug in der
Ernährungs-Engine (Pre-/Post-Workout, Cardio ab 75 Min., Wettkampftage), Meal-Prep-Modus mit
Kochtag-Ansicht und Timern, Ratgeber-Seiten offline. Gratis/Premium nach Abschnitt 9, Prüfung auf dem Server.
```

### Prompt D – Austausch, Bewertung, Kühlschrank-Suche
**Im Testmodus umgesetzt (N9–N11)** – Etappe **N9 (Zutaten-Austausch inkl. Haltbarkeit und `heated` nach dem Tausch) umgesetzt im
Testmodus** (14.10.2026, docs/PLAN-PHASE-5.md Umsetzungsstand N9); Etappe **N10 (Bewertung nach dem Essen, KONZEPT
6.10) umgesetzt im Testmodus** (14.10.2026, Umsetzungsstand N10); Etappe **N11 (Kühlschrank-Suche „Was habe ich
da?“, Packungsgrößen als eigene Inhaltsart mit Batch-Art `package-sizes`, KONZEPT 6.11) umgesetzt im Testmodus**
(14.10.2026, Umsetzungsstand N11) – damit ist Prompt D im Testmodus vollständig.
Tabellen erst mit der Supabase-Etappe N7.
```
Setze docs/ERWEITERUNGEN-2.md Abschnitte 3, 4 und 5 (nur Kühlschrank-Suche und Packungsgrößen) um. Die
Austausch-Tabelle und die Packungsgrößen erzeugst du über die Content-Pipeline (Batch-API, Zod-Schema,
status=draft, Freigabe im Admin). Regel-Logik in packages/core mit Tests. Keine Echtzeit-KI.
```

### Prompt E – Resteplanung und Paar-Modus (Premium)
**Logik umgesetzt (Etappe N13, 14.10.2026, docs/PLAN-PHASE-5.md Umsetzungsstand N13)** – Portionsfaktor je Person
(0,6–1,8, Beilagen getrennt, Ausgleich nur über die übrigen Mahlzeiten, über der Obergrenze eigener Vorschlag) und
Reste-Score/Aufrunden auf Packungen in `packages/core`. **Offen:** Resteplanung in der App (N14), Oberfläche Paar-Modus
erst mit dem Partner-Modus in Phase 11 – als eigener Bereich mit eigener Art.-9-Einwilligung beider Personen.
```
Setze docs/ERWEITERUNGEN-2.md Abschnitte 5 (automatische Resteplanung) und 6 (Paar-Modus beim Kochen) um.
Beides Premium, Prüfung auf dem Server. Portionsfaktor und Reste-Score als reine Funktionen in
packages/core mit Tests (Grenzfälle: sehr unterschiedliche Kalorienziele, Rezept ohne Beilage,
5-Portionen-Rezepte).
```

### Prompt F – Einkaufsliste teilen
**Teil „Sofort“ im Testmodus umgesetzt (Etappe N12, 14.10.2026, docs/PLAN-PHASE-5.md Umsetzungsstand N12)** – als
Text weitergeben (System-Teilen-Dialog bzw. Kopieren, Hinweis vorher wie K4), PDF aus N6, Händler-Modul nur als
Schnittstelle hinter Feature-Flag `retail_integration` (aus, ohne Händler). Die gemeinsame Liste im Paar-Modus kommt mit
Phase 11 (P1).
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 7 (nur den Teil „Sofort“) um: Einkaufsliste als Text teilen, als
PDF exportieren, gemeinsame Liste im Paar-Modus. Bereite ein Modul für spätere Händler-Anbindungen mit
Feature-Flag vor, ohne einen Händler anzubinden.
```

### Prompt G – Lead-Magnet auf der Landingpage
**In Arbeit (11.10.2026)** – Download ohne Newsletter-Pflicht (separates, freiwilliges Häkchen); Klick-Schritte in
`docs/SETUP.md` Abschnitt I7. **Bedingung für den Livegang:** Die Nährwerte im PDF stammen aus der Gründer-Datei –
nach N2b gegen die Katalogwerte prüfen (> 3 % → PDF korrigieren) und fachlich prüfen; bis dahin Kennzeichnung
„Richtwerte, nicht fachlich geprüft“ oder erst danach live (`docs/KONZEPT.md` 17).
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 8 um: Abschnitt „20 Rezepte gratis als PDF“ auf der Landingpage im
bestehenden Design (Vorschaubild aus Seite 1 von apps/web/public/downloads/Alpha5-Gratis-Rezepte.pdf
erzeugen), Formular mit Einwilligung, waitlist.source = 'lead-magnet', Double-Opt-in, nach Bestätigung Mail
mit Download-Link. Spamschutz wie bei der Warteliste. Erkläre mir in docs/SETUP.md mit Klick-Schritten am
Handy, wie ich den Text der Bestätigungsmail ändere.
```

## Phase 6 – Supplement-Modul & Affiliate
```
Setze docs/KONZEPT.md Abschnitt 7 um: supplements mit Evidenzstufe und Gegenanzeigen,
Zeitplan vor/nach Training/vor dem Schlafen, Ausschluss bei Gegenanzeigen mit Hinweis auf
ärztliche Rücksprache, affiliate_links mit Kennzeichnung "Anzeige". Empfehlungslogik darf
Affiliate-Daten nicht lesen. Klick-Tracking ohne Gesundheitsdaten.
```

## Phase 7 – Abos & Gratisversion
```
Integriere RevenueCat (iOS/Android) und Stripe (Web) mit gemeinsamer Entitlement-Tabelle über
Webhooks in apps/web. Setze Gratis- und Premium-Umfang nach docs/KONZEPT.md Abschnitt 13 um,
mit einer zentralen Funktion hasEntitlement(). Paywall-Screen, Testphase, Abo-Verwaltung.
```

### Erweiterung Phase 7 – KI-Grenze und Limits
```
Setze docs/KONZEPT.md Abschnitt 15 um: zentrale Server-Prüfung für Premium bei allen
KI-Funktionen, Tabelle ai_usage (Funktion, Tokens, Kosten, Zeitpunkt – keine Inhalte) mit RLS,
konfigurierbare Monatslimits pro Funktion, verständliche Meldung bei erreichtem Limit,
Kostenübersicht im Admin-Bereich. Bestehende Premium-Funktionen (z. B. Live-Anpassung aus
Phase 4b) auf hasEntitlement() umstellen.
```

## Phase 7b – KI-Funktionen für Premium
```
Setze docs/KONZEPT.md Abschnitte 6.4 und 11.2 um: Kalorien per Foto mit Bestätigung bzw.
Korrektur durch den Nutzer, Hinweis "Schätzung", eigene Einwilligung für Mahlzeiten-Fotos, Foto
standardmäßig nach der Auswertung löschen;
Körperfoto-Analyse mit Posen-Hilfe, eigener Einwilligung und verschlüsselter Speicherung im
privaten Storage-Bucket. Beide nur für Premium, mit Limits aus ai_usage. Halte dich strikt an
die Formulierungsregeln aus Abschnitt 11.2 (keine Körperfett-Prozentzahl, keine Bewertung des
Aussehens). Tabellen meal_photo_estimates, progress_photos, photo_analyses mit RLS.
```

## Phase 8 – Wearables & Readiness
```
Binde HealthKit und Health Connect (Development Build) sowie Strava und Garmin per OAuth über
apps/web an. Importiere Workouts automatisch ins Tagebuch (Duplikate vermeiden) und tägliche
Werte in daily_metrics. Implementiere den Readiness-Score in packages/core mit Tests.
```

## Phase 9 – Zyklus-Modul
```
Setze docs/KONZEPT.md Abschnitt 8 um, opt-in, verschlüsselte Speicherung, eigene Einwilligung.
Schnelle tägliche Erfassung. Adaptive Anpassung über Symptome/Energie, keine starren Phasenregeln.
```

## Phase 9b – Studio und Mitgliedschaft
```
Setze docs/KONZEPT.md Abschnitt 16 um: Studiosuche über OpenStreetMap mit Quellenangabe,
"Mein Studio" im Profil, Geräteliste als Equipment-Profil für die Plan-Engine, Feld
Partnerstudio als Vorbereitung für B2B, Mitgliedschaft mit Laufzeit, Kündigungsfrist und
Beitrag, Erinnerungen vor der Kündigungsfrist, Kosten pro Trainingsbesuch. Tabellen gyms,
user_gyms, gym_memberships mit RLS.
```

## Phase 10 – Ausdauer-Wettkampf & Strecken
**Reihenfolge (Gründer-Entscheidung 13.10.2026):** direkt nach Phase 5, vor Phase 4b. Vor der Umsetzung: Plan vorlegen und freigeben lassen.
```
Erweitere die Plan-Engine um Periodisierung rückwärts vom Wettkampfdatum (Basis, Aufbau,
Spitze, Tapering) und die Ernährung um Carb-Loading und Wettkampf-Verpflegung. Baue Strecken
nach docs/KONZEPT.md Abschnitt 10 mit MapLibre/OpenStreetMap, Standortsuche, Filter, GPX-Import/-Export.
```
**Ergänzung aus den Erweiterungen Teil 2:** Wettkampftage im Essensplan mit den *Wettkampftag*-Rezepten aus
`alpha5-rezepte.json` (Carb-Loading nur ab ca. 90 Min. Wettkampfdauer, immer innerhalb der Schutzgrenzen über
`clampCalorieTarget`), Ratgeber „Wettkampf-Ernährung“ verlinken – Etappe W1 in `docs/PLAN-PHASE-5.md` Abschnitt 19.

### Erweiterung Phase 10 – Strecken aufzeichnen
```
Setze docs/KONZEPT.md Abschnitt 10.1 um: GPS-Aufzeichnung mit Hintergrundbetrieb und
verständlicher Begründung der Standortberechtigung, Distanz, Höhenmeter, Dauer, Pace bzw.
Geschwindigkeit, Speichern mit Name, Favorit und Schwierigkeit leicht/mittel/schwer, Zeiten auf
Favoriten vergleichen, automatischer Eintrag ins Trainingstagebuch, GPX-Export. Tabelle
tracked_routes mit RLS. Kein Teilen, keine Community, keine Ranglisten.
```

## Phase 11 – Fortschritt, Partner-Modus, KI-Coach
```
Fortschrittsansicht (Gewicht, Umfänge, private Fotos, Rekorde). Partner-Modus mit beidseitiger
Zustimmung und gemeinsamer Einkaufsliste. Optionaler KI-Coach-Chat (Premium, Feature-Flag,
Monatslimit und Kosten-Logging über ai_usage), der nur den Plan des Nutzers erklärt und keine medizinischen
Aussagen trifft.
```
**Ergänzung aus den Erweiterungen Teil 2:** Mit dem Partner-Modus kommt die Oberfläche des **Paar-Modus beim Kochen**
(Premium, `docs/KONZEPT.md` 6.12) auf Basis der Logik aus Etappe N13 sowie die gemeinsame Einkaufsliste aus Prompt F –
Etappe P1 in `docs/PLAN-PHASE-5.md` Abschnitt 19.
**Feste Regel aus PLAN-ZIELE (Wächter K7, F13):** Das Wunschgewicht (`weight_goals`), die Planbarkeits-Ampel und
Ziel-Ereignisse sind vom Partner-Modus **immer ausgeschlossen** – auch wenn „Ernährung“ freigegeben ist. Die
Fortschrittsansicht zeigt **keinen** Fortschrittsbalken zum Zielgewicht und keine Kurve mit Ziellinie (F13, F7).

## Phase 11b – Monats-Challenges
```
Setze docs/KONZEPT.md Abschnitt 11.3 um: Challenges im Admin-Bereich anlegen, Teilnahme per
Tipp, automatischer Fortschritt aus Tagebuch, Strecken und Wearables, Filter nach Ziel und
Planphase (keine Konflikte mit Erholungswoche, Tapering, Gesundheits-Check), Joker pro Monat,
private Abzeichen, optionaler als "Werbung" gekennzeichneter Sponsor. Tabellen challenges,
challenge_participations, challenge_progress mit RLS. Keine Essens-, Fasten- oder
Abnehm-Challenges, keine Ranglisten.
```

## Phase 12 – Launch-Vorbereitung
```
Prüfe das ganze Projekt gegen CLAUDE.md: RLS auf allen Tabellen, keine Gesundheitsdaten in
Logs/Analytics, Datenexport und Kontolöschung, Barrierefreiheit, Ladezeiten. Erstelle
Store-Texte, Datenschutz-Angaben für App Store/Play Store und eine Checkliste für die
rechtliche Prüfung nach docs/KONZEPT.md Abschnitt 14.
```

## Später – Fitnessstudios (B2B)
```
Füge organizations und org_memberships hinzu: Studio-Branding, Geräteliste als Equipment-Profil,
Trainer-Dashboard mit freigegebenen Mitgliederdaten, Lizenzabrechnung.
```
