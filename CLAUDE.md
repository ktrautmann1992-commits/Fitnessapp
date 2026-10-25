# CLAUDE.md – Alpha5 Fitness-App

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
  werden OFFLINE per Gemini-API (Batch) erzeugt, gegen ein JSON-Schema validiert, von Menschen freigegeben
  und als Inhalte in der Datenbank gespeichert.
- Zur Laufzeit wählt eine **deterministische Regel-Engine** (`packages/core`) passende Vorlagen aus und
  personalisiert sie (Equipment-Tausch, Lasten, Kalorien, Makros, Wochenplanung).
- Echtzeit-KI nur für: (a) Premium-KI-Funktionen (KI-Coach-Chat, Kalorien per Foto, Körperfoto-Analyse,
  KI-Erklärungen in Worten), (b) Fallback, wenn keine Vorlage passt. Alles hinter Feature-Flag und
  Monatslimit, Kosten pro Nutzer geloggt (siehe „KI-Grenze“).
- **KI-Anbieter: Google Gemini (API)** für Offline-Inhalte und Premium-KI (Gründer-Entscheidung 14.10.2026).
  Nur bezahlte API ohne Training mit Nutzerdaten; Auftragsverarbeitungsvertrag mit Google vor dem Livegang.

## KI-Grenze: Gratis ohne KI, Premium mit KI
- Alle Funktionen mit Echtzeit-KI sind **ausschließlich Premium**. Gratis läuft komplett über feste Regeln und Datenbank.
- Premium-Prüfung **immer serverseitig** (nie nur in der App).
- Jede KI-Funktion hat ein eigenes, konfigurierbares **Monatslimit pro Nutzer**. Tabelle `ai_usage` protokolliert
  Funktion, Tokens, Kosten und Zeitpunkt.
- Limit erreicht → klare, verständliche Meldung in der App, keine stille Fehlfunktion.
- Details: `docs/KONZEPT.md` Abschnitt 15, Herkunft: `docs/ERWEITERUNGEN.md`.

## Tech-Stack
- Monorepo: **Turborepo + pnpm**, TypeScript strict überall
- `apps/mobile`: **Expo (React Native) + Expo Router**, zusätzlich als **Web-Export auf Vercel** (damit jede Änderung sofort im Handy-Browser testbar ist). Native Builds über **EAS Build in der Cloud** (Android-APK, iOS via EAS Submit → TestFlight). Ab Wearables/Abos: Development Build statt Expo Go.
- Die **Web-App-Version** der App ist der Expo-Web-Export von `apps/mobile` (Vercel-Projekt „fitnessapp“ baut ihn über `vercel.json` im Hauptordner).
- `apps/web`: **Next.js (App Router)** auf **Vercel** – Landingpage, Admin-/Redaktionsbereich, API-Routen/Webhooks
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

### Kein Teilen, keine Community
- Kein Teilen, keine Community, keine Ranglisten, keine öffentlichen Profile. Strecken, Fotos, Abzeichen und Challenges bleiben privat.
- Erlaubt bleibt der Partner-Modus (zwei Personen, beidseitige Zustimmung, nur freigegebene Bereiche) – das ist kein öffentliches Teilen.
- **Ausnahme (Gründer-Entscheidung 20.10.2026): Einzelne Lauf-/Ausdauer- und Trainingseinheiten dürfen als Bild geteilt
  werden** (z. B. Instagram-Story im Hochformat, Facebook, WhatsApp) – nur auf ausdrücklichen Tipp der Person, über den
  System-Teilen-Dialog bzw. als gespeichertes Bild. Pflicht dabei:
  - **Privatzone:** Anfang und Ende einer Strecke (ca. 200 m) werden abgeschnitten; Karte abschaltbar.
  - **Keine Gesundheitsdaten** auf dem Bild (kein Puls, Gewicht, Körperdaten, Zyklus, Gesundheits-Check).
  - Kein automatisches Teilen, keine Verknüpfung mit Konten sozialer Netzwerke, kein Hochladen auf eigene Server,
    keine öffentlichen Profile, Ranglisten oder Feeds in der App.
- **Ausnahme (Gründer-Entscheidung 25.10.2026): Live-Begleitung / Notfallkontakt** – während einer Lauf-/Rad-Einheit
  darf die Person ihren aktuellen Standort mit selbst gewählten Notfallkontakten teilen (Sicherheit, nicht Community).
  Gratis, alle Aufzeichnungs-Sportarten (Laufen, Rad, E-Bike, Gehen). Plan: `docs/PLAN-PHASE-10.md` Abschnitt 21.
  Pflicht dabei:
  - **Nur auf ausdrücklichen Tipp** vor bzw. während einer Ausdauer-Aufzeichnung, nie automatisch, nie außerhalb
    einer laufenden Aufzeichnung; jederzeit mit einem Tipp beendbar; sichtbarer Hinweis „Live-Begleitung aktiv“.
  - **Höchstens 3 selbst eingetragene Kontakte** (Name + Telefonnummer und/oder E-Mail), **nur auf dem Gerät**
    gespeichert (verschlüsselt, nie auf dem Server, keine Kontakte-Tabelle); Kontakte bekommen kein Konto und keine
    Nachricht von unserem Server.
  - **Freigabe nur über einen geheimen, nicht erratbaren Link** (zufälliges Token, mind. 128 Bit, auf dem Server nur
    als Hash gespeichert), den die Person selbst über den System-Teilen-Dialog verschickt. Das Token steht **im
    Link-Fragment** (`/begleitung#t=…`), damit es nicht in Server-Logs landet. Höchstdauer je Sitzung 12 h.
  - **Der Kontakt sieht nur:** Anzeigename (Vorname vorausgefüllt, änderbar, max. 30 Zeichen), aktuelle (letzte)
    Position, Startzeit, „zuletzt aktualisiert vor …“, Sportart. **Keine Gesundheitsdaten** (kein Puls, keine kcal,
    kein Gewicht, kein Zyklus), keine Pace-/Leistungswerte, keine Spur (auch nicht der letzten Minuten), keine
    gespeicherten Strecken. Nach „Angekommen“ bzw. Ende wird die Position sofort gelöscht; die Seite zeigt danach
    höchstens 2 h lang nur noch „angekommen“/„beendet“ **ohne Karte**, dann ist der Link ungültig.
  - **Server:** nur die jeweils letzte Position, nur für die Dauer der Sitzung (Supabase EU, RLS: nur die Person
    schreibt; Lesen nur über eine Token-geprüfte, ratenbegrenzte Funktion), automatische Löschung, **keine
    Koordinaten in Logs**, Analytics oder Crash-Reports; Begleit-Seite ohne Indexierung, ohne Analytics, ohne Cookies.
    Link-Domain: eigene Kurz-Domain (bis dahin die Vercel-Domain).
  - **SOS-Knopf** öffnet nur SMS/WhatsApp/Telefon des Systems mit vorbereitetem Text und letzter Position – Versand bzw.
    Anruf immer erst nach Tipp der Person. Kein automatischer Alarm an Kontakte (erst später, nach Rechts- und
    Haftungsprüfung, eigene Gründer-Entscheidung); „Kein Lebenszeichen“-Erinnerung
    höchstens als lokale Benachrichtigung an die Person selbst. Kein Notruf-Ersatz (Hinweis „Im Notfall 112“, CH 144/112).
  - Keine öffentlichen Profile, Feeds, Ranglisten oder Verknüpfung mit sozialen Netzwerken; Standort-Berechtigung
    weiterhin nur „Beim Verwenden“ mit Vordergrund-Dienst (W-G13), keine zusätzliche Hintergrund-Ortung.

### Affiliate & Werbung
- Affiliate-Links immer sichtbar als „Anzeige“/„Werbung“ kennzeichnen.
- Empfehlungslogik ist herstellerneutral; Affiliate beeinflusst nur, WELCHER Shop verlinkt wird, nie OB oder WELCHES Supplement empfohlen wird.

## Definition of Done (pro Feature)
1. Typen + Zod-Schemas, 2. Migration mit RLS, 3. Core-Logik mit Tests, 4. UI mobil + web,
5. Leer-/Fehler-/Ladezustände, 6. Texte auf Deutsch, 7. `docs/` aktualisiert.

## Automatisierung (GitHub Actions statt lokaler Befehle)
- `ci.yml` – Lint + Tests bei jedem Push/PR
- `db-migrate.yml` – Supabase-Migrationen bei Merge in `main` (Secrets: SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_REF)
- `content-generate.yml` – manuell startbar: Inhalte per Gemini-API (Batch) erzeugen (Secret: GEMINI_API_KEY)
- `content-seed.yml` – manuell startbar: freigegebene Inhalte einspielen
- `eas-build.yml` – manuell startbar: Android-/iOS-Build über EAS (Secret: EXPO_TOKEN)
- Vercel baut Web-App und Admin automatisch bei jedem Push (Vorschau-Link im PR)
