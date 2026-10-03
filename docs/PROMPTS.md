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

## Phase 5 – Ernährungs-Engine, Essensplan, Einkaufsliste
```
Implementiere docs/KONZEPT.md Abschnitt 6. Zuerst packages/core/nutrition mit Grundumsatz,
Gesamtumsatz tagesgenau inkl. geplanter Trainingsenergie, Zielanpassung mit den Schutzgrenzen
aus CLAUDE.md, Makros, Mahlzeiten-Timing vor/nach dem Training – alles getestet. Dann Rezepte
über die Content-Pipeline erzeugen (mit Makro-Plausibilitätsprüfung) und freigeben. Dann
Wochen-Essensplan (Vorlieben, Ernährungsform, Schwein ja/nein, Kochmodus täglich/Meal-Prep)
und aggregierte, nach Abteilung sortierte Einkaufsliste.
```

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
```
Erweitere die Plan-Engine um Periodisierung rückwärts vom Wettkampfdatum (Basis, Aufbau,
Spitze, Tapering) und die Ernährung um Carb-Loading und Wettkampf-Verpflegung. Baue Strecken
nach docs/KONZEPT.md Abschnitt 10 mit MapLibre/OpenStreetMap, Standortsuche, Filter, GPX-Import/-Export.
```

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
