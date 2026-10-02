# CLAUDE.md – [APP-NAME] Fitness-App

Diese Datei liest Claude Code bei jeder Sitzung. Sie beschreibt Ziel, Architektur und verbindliche Regeln.
Ausführliche Fachlogik: `docs/KONZEPT.md`. Umsetzungsreihenfolge: `docs/PROMPTS.md`.

## Produkt in einem Satz
Personalisierte Fitness-App für den DACH-Raum (Einsteiger bis Leistungssportler), die aus Profil, Ziel,
Zeitbudget, Equipment und Ernährungsvorlieben einen Trainingsplan, Ernährungsplan mit Einkaufsliste,
Supplementplan und ein Trainingstagebuch erzeugt – inkl. Zyklus-Berücksichtigung, Wearables und Laufstrecken.

## WICHTIG: Die Gründer arbeiten ausschließlich am Smartphone
- Claude Code läuft als Cloud-Sitzung (Code-Tab der Claude-App). Es gibt KEINEN lokalen Rechner und KEIN Terminal beim Nutzer.
- Verlange nie, dass der Nutzer Befehle lokal ausführt, Dateien lokal bearbeitet oder einen Dev-Server startet.
- Alles, was regelmäßig laufen muss (Tests, Datenbank-Migrationen, Typ-Generierung, Content-Generierung, Seeds, App-Builds), wird als **GitHub Action** umgesetzt – automatisch bei Push/Merge oder manuell per „Run workflow“ (in der GitHub-App bedienbar).
- Jede Änderung kommt als Pull Request. Im PR-Text: kurze Zusammenfassung auf Deutsch + „So testest du es am Handy“ (Link zur Vercel-Vorschau bzw. Build-Link).
- Testen erfolgt über: Vercel-Vorschau-Links (Web-Version der App im Handy-Browser), EAS-Builds (Android-APK zum direkten Installieren, iOS über TestFlight).
- Anleitungen für Einstellungen in Supabase, Vercel, Expo, GitHub immer als Klick-Schritte für den **mobilen Browser** schreiben, kurz und nummeriert.
- Secrets/Schlüssel nie im Chat erfragen – immer erklären, wo der Nutzer sie selbst einträgt (GitHub Secrets, Vercel Environment Variables, Expo Secrets).

## Architektur-Grundprinzip: „Vorab generiert, regelbasiert zusammengesetzt“
- **Keine Echtzeit-KI im Normalbetrieb.** Trainingspläne, Rezepte, Übungsbeschreibungen und Supplement-Texte
  werden OFFLINE per Claude-API (Batch) erzeugt, gegen ein JSON-Schema validiert, von Menschen freigegeben
  und als Inhalte in der Datenbank gespeichert.
- Zur Laufzeit wählt eine **deterministische Regel-Engine** (`packages/core`) passende Vorlagen aus und
  personalisiert sie (Equipment-Tausch, Lasten, Kalorien, Makros, Wochenplanung).
- Echtzeit-KI nur für: (a) optionalen Premium-KI-Coach-Chat, (b) Fallback, wenn keine Vorlage passt.
  Beides hinter Feature-Flag, rate-limitiert, Kosten pro Nutzer geloggt.

## Tech-Stack
- Monorepo: **Turborepo + pnpm**, TypeScript strict überall
- `apps/mobile`: **Expo (React Native) + Expo Router**, zusätzlich als **Web-Export auf Vercel** (damit jede Änderung sofort im Handy-Browser testbar ist). Native Builds über **EAS Build in der Cloud** (Android-APK, iOS via EAS Submit → TestFlight). Ab Wearables/Abos: Development Build statt Expo Go.
- `apps/web`: **Next.js (App Router)** auf **Vercel** – Landingpage, Web-App-Version, Admin-/Redaktionsbereich, API-Routen/Webhooks
- `packages/core`: reine TypeScript-Logik ohne UI (Berechnungen, Plan-Engine, Ernährungs-Engine) – 100 % testbar
- `packages/db`: Datenbanktypen (generiert aus Supabase), Zod-Schemas
- `packages/ui`: geteilte Design-Tokens
- `packages/content`: Skripte für Offline-Content-Generierung + Seeds
- Backend: **Supabase, Region EU (Frankfurt)** – Postgres, Auth, Storage, Row Level Security
- Abos: **RevenueCat** (In-App-Käufe iOS/Android, Pflicht laut App-Store-Regeln) + **Stripe** für Web
- Karten: OpenStreetMap + MapLibre/Leaflet; GPX-Import
- Wearables: HealthKit, Health Connect, Strava-API, Garmin Connect (OAuth über Server)
- Tests: Vitest (core), Playwright (web), Maestro oder Detox (mobile, später)
- i18n: Deutsch als Standard (de-DE, de-AT, de-CH), Struktur vorbereitet für Englisch

## Verbindliche Regeln
### Gesundheitsdaten (DSGVO Art. 9)
- Gesundheits-, Körper- und Zyklusdaten nur nach ausdrücklicher, getrennter Einwilligung speichern (Consent-Tabelle mit Zeitstempel und Version).
- RLS auf JEDER Tabelle mit Nutzerdaten. Kein Nutzer sieht Daten anderer (Ausnahme: Partner-Modus nach beidseitiger Zustimmung, nur freigegebene Bereiche).
- Zyklusdaten und Fortschrittsfotos zusätzlich verschlüsselt bzw. in privatem Storage-Bucket.
- Keine Gesundheitsdaten an Analytics, Werbung oder Affiliate-Partner. Keine Gesundheitsdaten in Logs.
- Export- und Löschfunktion für alle Nutzerdaten (Recht auf Auskunft/Löschung).

### Sicherheit der Empfehlungen
- Mindestalter 16 Jahre (Altersabfrage im Onboarding).
- Gesundheits-Check (PAR-Q-ähnlich) im Onboarding; bei Auffälligkeiten Hinweis auf ärztliche Abklärung und konservative Pläne.
- Kalorien-Schutzgrenzen: Defizit max. 25 % unter Gesamtumsatz, nie unter Grundumsatz, Gewichtsverlust max. ~1 % Körpergewicht/Woche. Diese Grenzen sind NICHT durch Nutzer abschaltbar.
- Ausdauer: Wochenumfang max. ~10 % Steigerung, Deload-/Erholungswochen fest eingeplant.
- Supplements: nur Präparate mit guter Evidenz; keine Heilversprechen (Health-Claims-Verordnung); Hinweis auf Vorerkrankungen, Schwangerschaft, Medikamente.
- Alle Rechenformeln und Grenzwerte zentral in `packages/core/src/constants.ts`, mit Quellenkommentar.

### Code
- Fachlogik NUR in `packages/core`, nie in UI-Komponenten.
- Jede Funktion in `packages/core` hat Unit-Tests, inkl. Grenzfälle (sehr leicht/schwer, sehr alt/jung, 1 vs. 7 Trainingstage).
- Eingaben an allen Grenzen mit Zod validieren.
- Offline-first im Trainingsmodus (lokaler Speicher, Sync bei Verbindung).
- Keine Secrets im Code; `.env.example` pflegen.
- Kleine, nachvollziehbare Commits; vor jedem größeren Feature erst einen Plan vorlegen und auf Freigabe warten.

### Affiliate & Werbung
- Affiliate-Links immer sichtbar als „Anzeige“/„Werbung“ kennzeichnen.
- Empfehlungslogik ist herstellerneutral; Affiliate beeinflusst nur, WELCHER Shop verlinkt wird, nie OB oder WELCHES Supplement empfohlen wird.

## Definition of Done (pro Feature)
1. Typen + Zod-Schemas, 2. Migration mit RLS, 3. Core-Logik mit Tests, 4. UI mobil + web,
5. Leer-/Fehler-/Ladezustände, 6. Texte auf Deutsch, 7. `docs/` aktualisiert.

## Automatisierung (GitHub Actions statt lokaler Befehle)
- `ci.yml` – Lint + Tests bei jedem Push/PR
- `db-migrate.yml` – Supabase-Migrationen bei Merge in `main` (Secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF)
- `content-generate.yml` – manuell startbar: Inhalte per Claude Batch-API erzeugen (Secret: ANTHROPIC_API_KEY)
- `content-seed.yml` – manuell startbar: freigegebene Inhalte einspielen
- `eas-build.yml` – manuell startbar: Android-/iOS-Build über EAS (Secret: EXPO_TOKEN)
- Vercel baut Web-App und Admin automatisch bei jedem Push (Vorschau-Link im PR)
