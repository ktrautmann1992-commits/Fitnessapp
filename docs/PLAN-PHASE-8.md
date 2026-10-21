# Plan Phase 8 – Wearables: Galaxy Watch über Health Connect (Etappe 1)

**Status:** freigegeben (W8-1…W8-13 wie empfohlen) · **H1–H4 umgesetzt** (21.10.2026, Branch `claude/wearables-h1`,
Umsetzungsstand in Abschnitt 13) · H0 nur offline geprüft (echter Bau/Test mit Galaxy Watch offen).
**Grundlage:** `CLAUDE.md`, `docs/KONZEPT.md` (4.1, 6, 9, 13), `docs/PROMPTS.md` Phase 8, `docs/PLAN-PHASE-10.md`
(Strecken, `tracked_routes`), `docs/PLAN-EINKAUFEN-AUSDAUER.md` (E3–E6, `enduranceActivities`, `enduranceTotals`,
Story-Bild). Gründer-Wunsch: „Die Daten meiner Galaxy Watch sollen automatisch in der App landen.“

## 0. Kurzfassung

- **Weg:** Galaxy Watch → Samsung Health (Handy) → **Health Connect** (Android-Datendrehscheibe) → Alpha5. Alpha5
  spricht nie direkt mit der Uhr oder mit Samsung, sondern liest nur aus Health Connect – das deckt später auch
  Pixel Watch, Fitbit, Garmin-App u. a. ab, sofern sie in Health Connect schreiben.
- **Nur Android-App (APK).** Im Browser und auf dem iPhone (dort nur Chrome-Web) gibt es keine Verbindung – die App
  zeigt einen freundlichen Hinweis. Apple Health, Strava und Garmin kommen als spätere Etappen.
- **Etappe 1 = wenige, nützliche Daten:** Trainingseinheiten (Art, Dauer, Distanz, kcal), Puls während der Einheit
  (Ø, Max, Zeit je Pulszone), Ruhepuls, Schlafdauer, Schritte. **Nur lesen**, nichts zurückschreiben.
- **Gesundheitsdaten (DSGVO Art. 9):** eigene, getrennte Einwilligung „Smartwatch-Daten“, Tageswerte statt
  Rohreihen, nichts in Logs/Analytics, Export/Löschen, „Trennen“ löscht auf Wunsch alles Importierte.
- **Abgleich** beim App-Start/Rückkehr in die App und per Knopf „Jetzt abgleichen“ – **kein Hintergrund-Abgleich**.
- **Readiness-Score („Erholung“) erst in Etappe 2** (Empfehlung, Begründung in 5.4).
- **Testen:** neue Test-APK über `eas-build` nötig (neues natives Modul). Vor Store-Einreichung: Play-Formular für
  Health-Connect-Berechtigungen und Datenschutzerklärung (Abschnitt 8).

## 1. Gründer-Entscheidungen (Übersicht)

| Nr.   | Frage                         | Empfehlung                                                                                     | Gründer entscheidet    |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| W8-1  | Weg zur Uhr                   | Health Connect (über Samsung Health), keine Samsung-eigene Schnittstelle                       | wie empfohlen (21.10.) |
| W8-2  | Datenumfang Etappe 1          | Einheiten, Puls in Einheiten (Ø/Max/Zonen), Ruhepuls, Schlafdauer, Schritte; HRV/VO2max später | wie empfohlen (21.10.) |
| W8-3  | Nur lesen oder auch schreiben | Nur lesen (Schreiben von App-Läufen nach Health Connect frühestens Etappe 2)                   | wie empfohlen (21.10.) |
| W8-4  | Strecken (GPS) der Uhr        | In Etappe 1 **nicht** importieren; Linie kommt weiter aus der App-Aufzeichnung                 | wie empfohlen (21.10.) |
| W8-5  | Einwilligung                  | Neue, getrennte Einwilligungsart `wearable_data` (Version 1)                                   | wie empfohlen (21.10.) |
| W8-6  | Speichertiefe Puls            | Nur Zusammenfassung je Einheit (Ø, Max, Sekunden je Zone), keine Rohreihen                     | wie empfohlen (21.10.) |
| W8-7  | Abgleich-Zeitpunkt            | App-Start/Vordergrund + Knopf; kein Hintergrund-Abgleich in Etappe 1                           | wie empfohlen (21.10.) |
| W8-8  | Erster Abgleich               | Letzte 30 Tage (= Standardgrenze von Health Connect, keine Zusatzberechtigung)                 | wie empfohlen (21.10.) |
| W8-9  | Doppelte Einheit (App + Uhr)  | Zusammenführen: App-Eintrag bleibt führend, Uhr ergänzt Puls/kcal; Rückfrage nur bei Zweifel   | wie empfohlen (21.10.) |
| W8-10 | Pulszonen                     | 5 Zonen nach % HFmax; HFmax geschätzt (Tanaka) oder eigener Wert                               | wie empfohlen (21.10.) |
| W8-11 | Readiness-Score               | Etappe 2 (nach Datensammlung, mit fachlicher Prüfung)                                          | wie empfohlen (21.10.) |
| W8-12 | Trennen                       | Fragt: „Importierte Daten behalten oder löschen?“ – Pulsdaten werden immer gelöscht            | wie empfohlen (21.10.) |
| W8-13 | Gratis/Premium                | Gratis (keine KI, keine laufenden Kosten)                                                      | wie empfohlen (21.10.) |

## 2. Technischer Weg (W8-1)

- **Bibliothek:** `react-native-health-connect` **4.1.3** (npm, zuletzt geändert 06.08.2026, geprüft per `npm pack`
  am 20.10.2026). Seit v4 ist das Expo-Config-Plugin **eingebaut** (`app.plugin.js`, das alte `expo-health-connect`
  ist veraltet). TurboModule → passt zur neuen Architektur von SDK 57. Kein Eingriff in `MainActivity` nötig.
- **Konfiguration (`apps/mobile/app.config.ts`):** Plugin `react-native-health-connect` (setzt die Aktivität für
  „Warum braucht die App das?“ und den Android-14-Alias `ViewPermissionUsageActivity`) plus
  `expo-build-properties` (SDK-57-Version, z. B. 57.0.22) mit **`minSdkVersion 26`** (Android 8). Nur die
  `READ_*`-Berechtigungen der Datentypen aus Abschnitt 3 eintragen; `WRITE_*`, `READ_HEALTH_DATA_IN_BACKGROUND`,
  `READ_HEALTH_DATA_HISTORY` und `READ_EXERCISE_ROUTES` in `blockedPermissions` (wie bei
  `ACCESS_BACKGROUND_LOCATION`, Test `native-config.test.ts` erweitern).
- **Zu prüfen im Spike H0:** Bau mit `compileSdk`/`targetSdk` von SDK 57 (Plugin-Beispiel nennt 36, Bibliothek
  selbst 35); `expo install --check`; ob Health Connect eine per APK installierte App ohne Play-Eintrag normal
  zulässt (laut Doku ja; Hinweis-Dialog möglich).
- **Development-Build/EAS:** kein Expo Go. Profil `preview` (APK) reicht, wie bei E3/E4.
- **Health Connect:** ab Android 14 im System eingebaut (Einstellungen → Sicherheit & Datenschutz → Health Connect),
  bei Android 9–13 als App aus dem Play Store. Fehlt sie oder ist sie veraltet → Knopf „Health Connect installieren“
  (`getSdkStatus` → Play-Store-Link).
- **Web/iPhone:** Modul nur in `*.native.ts`; im Web „Smartwatch verbinden geht in der Android-App“. Kein Absturz,
  kein Laden des Moduls im Web-Bündel (Test wie bei der Karte).
- **Spätere Etappen:** Apple Health (braucht native iOS-App über TestFlight), Strava und Garmin (OAuth über
  `apps/web`, Server-Token, KONZEPT 9), dann Polar/Suunto.

## 3. Daten in Etappe 1 (W8-2, W8-3, W8-4)

Jeder Datentyp ist eine **eigene Systemberechtigung**; die Person kann einzelne abwählen – die App arbeitet mit dem
Rest weiter und zeigt „nicht freigegeben“.

| Health-Connect-Typ                | Wofür in Alpha5                                                   | Gespeichert als                     |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `ExerciseSession`                 | Einheit im Tagebuch (Art, Beginn/Ende, Titel)                     | `session_logs` (+ `cardio_logs`)    |
| `Distance`, `TotalCaloriesBurned` | Distanz und kcal der Einheit (über Zeitraum der Einheit summiert) | `cardio_logs.distance_m`, `kcal`    |
| `HeartRate`                       | Ø/Max und Zeit je Zone **während** Einheiten                      | `heart_rate_summaries` (nur Summen) |
| `RestingHeartRate`                | Ruhepuls je Tag (Verlauf; Basis für späteren Readiness-Score)     | `daily_metrics.resting_hr_bpm`      |
| `SleepSession`                    | Schlafdauer je Nacht (ohne Wachphasen), dem Aufwachtag zugeordnet | `daily_metrics.sleep_min`           |
| `Steps`                           | Schritte je Tag (Aggregat-Abfrage von Health Connect)             | `daily_metrics.steps`               |

- **Begründung Auswahl:** Einheiten + Puls machen Tagebuch und Ausdauer-Auswertung sofort besser; Ruhepuls und Schlaf
  sind die Grundlage für Etappe 2 (Erholung); Schritte sind beliebt, unkritisch und kosten nichts.
- **Später:** HRV (`HeartRateVariabilityRmssd`), VO2max, SpO2, Gewicht/Körperfett (Doppelung mit Mess-Erfassung klären).
- **Nur lesen (W8-3):** kein Schreiben in Etappe 1 – weniger Berechtigungen, weniger Play-Prüfaufwand, kein Risiko,
  Samsung-Daten zu verfälschen. App-Läufe nach Health Connect schreiben = Kandidat Etappe 2.
- **Keine Uhr-Strecken (W8-4):** das Lesen einer Strecke verlangt je Einheit einen eigenen Systemdialog und bringt
  Standortdaten ins Spiel. Die App-Aufzeichnung (E4) liefert die Linie bereits; spätere Etappe, dann mit Privatzone.
- **Schritte doppelt (Handy + Uhr):** nur die Aggregat-Abfrage von Health Connect nutzen – sie entdoppelt Quellen
  selbst. Nie einzelne Schritt-Datensätze addieren.
- **Ruhepuls:** ob Samsung Health `RestingHeartRate` in Health Connect schreibt, ist **im Spike H0 zu prüfen**. Falls
  nicht: Feld bleibt leer (kein selbst errechneter Ersatz in Etappe 1).

## 4. Datenschutz (DSGVO Art. 9)

- **Einwilligung (W8-5):** neue Art `wearable_data` im Enum `consent_type`, Text Version 1 in `consent_documents`,
  `CURRENT_CONSENT_VERSIONS` hochzählen (db-sync prüft). Getrennt von `health_data`; Voraussetzung ist zusätzlich
  eine gültige `health_data`-Einwilligung. Erst Einwilligung, **dann** Systemdialog.
- **Serverseitige Pflicht:** jede Import-Funktion prüft `has_valid_consent('wearable_data')`; ohne → Ablehnung.
- **Widerruf** (Einstellungen → Datenschutz): löscht `daily_metrics`, `heart_rate_summaries`, `wearable_connections`
  sofort; importierte Einheiten werden zu normalen Tagebuch-Einträgen ohne Puls (wie W8-12 „behalten“).
- **RLS** auf allen neuen Tabellen (nur eigene Zeilen, Schreiben nur über RPCs), pgTAP-Tests inkl. Fremdzugriff.
- **Speicherminimierung (W8-6):** keine Pulsreihen, keine Schlafphasen, keine Rohdatensätze – nur Tageswerte und
  Summen je Einheit. Rohdaten bleiben in Health Connect auf dem Gerät.
- **Logs/Analytics:** keine Pulswerte, Schlafzeiten, Schritte oder Datensatz-IDs in Logs, Fehlermeldungen,
  Analytics. Fehler nur mit Code (z. B. `hc_permission_denied`). Lokaler Zwischenspeicher verschlüsselt (wie
  Tagebuch-Warteschlange).
- **Export/Löschen:** neue Tabellen in `export_my_data`; Konto löschen über `on delete cascade`.
- **Story-Bild (E6):** zeigt **nie** Puls/Zonen/kcal – `STORY_CARD_FIELDS` bleibt Positivliste; Test ergänzen, dass
  eine Einheit mit `heart_rate_summaries` kein Pulsfeld im Bild hat.
- **Keine Weitergabe** an Partner-Modus, Affiliate, KI-Funktionen (bis eigene Entscheidung).

## 5. Core-Logik (`packages/core/src/wearables/`, alles mit Vitest)

### 5.1 Zuordnung Health Connect → Tagebuch

- `mapExerciseType(hcType)` → `run | walk | bike | swim` (`endurance_modality`), Kraft (`strength_training`,
  `weightlifting`, Zirkel) → freie Kraft-Einheit (A1b), Rest (Yoga, Wandern, Tennis …) → „Sonstige“ als freie
  Einheit mit Titel; Laufband = run, Ergometer = bike. Unbekannte Typen nie verwerfen.
- `sessionFromHc(record, aggregates)` → Zod-geprüfter Import-Datensatz (Grenzen aus `CARDIO_LOG_LIMITS`: < 1 min oder
  > 12 h → überspringen mit Zähler „nicht übernommen“).
- Tageszuordnung immer Europe/Berlin (wie `enduranceTotals`), Schlaf → Aufwachtag.

### 5.2 Duplikat-Erkennung (W8-9)

- **Gleiche Uhr-Einheit zweimal:** eindeutiger Schlüssel `(user_id, source, external_id)` mit Health-Connect-
  `metadata.id` → erneuter Abgleich ändert, legt nie neu an.
- **App-GPS + Uhr gleichzeitig:** `matchExisting(imported, existingLogs)`: gleiche Sportart-Gruppe und Zeitfenster
  überlappen ≥ 50 % der kürzeren Einheit → **zusammenführen**: App-Eintrag/Strecke bleibt führend (Distanz, Linie),
  Uhr ergänzt Puls-Zusammenfassung und kcal, Eintrag bekommt `external_id`. Überlappung 20–50 % oder Art passt nicht
  → als „Möglicher Doppel-Eintrag“ markieren, Person entscheidet (zusammenführen / beide behalten).
- Manuell nachgetragene Einheit ohne Uhrzeit: gleiche Art + gleicher Tag + Dauer ±20 % → Rückfrage, nie automatisch.
- `enduranceActivities`/`enduranceTotals` zählen zusammengeführte Einheiten nur einmal (Test).

### 5.3 Pulszonen (W8-10)

- `maxHeartRate(age, override?)`: Tanaka H. et al. (2001), J Am Coll Cardiol 37(1):153–156: **208 − 0,7 × Alter**;
  eigener Wert (z. B. aus Leistungstest) hat Vorrang, Grenzen 120–230.
- `hrZones(hfMax)`: 5 Zonen 50–60/60–70/70–80/80–90/90–100 % HFmax (verbreitete Einteilung, u. a. ACSM Guidelines
  for Exercise Testing and Prescription, 11. Aufl. 2021, Intensitätsstufen nach % HFmax).
- `summarizeHeartRate(samples, zones)` → Ø, Max, Sekunden je Zone; Lücken > 30 s nicht mitzählen; unplausible Werte
  (< 30 oder > 230) verwerfen. Alles in `constants.ts` (`HEART_RATE_LIMITS`, `HR_ZONE_PERCENTS`) mit Quellen.
- Grenzfälle: 16 und 90 Jahre, keine Samples, ein Sample, 12-h-Einheit, Werte nur außerhalb der Zonen.
- Hinweis in der App: „Pulszonen sind Schätzwerte; Betablocker u. a. verändern den Puls.“ Gesundheits-Check
  auffällig → Hinweis „Belastung ärztlich abklären“ bleibt wie bisher.

### 5.4 Readiness – Empfehlung Etappe 2 (W8-11)

- **Warum später:** braucht 14–28 Tage Basiswerte (Ruhepuls, Schlaf), HRV kommt erst später, ob Samsung Ruhepuls
  liefert, ist offen. Ein Score auf dünner Datenlage würde falsche „Ruhetag“-Vorschläge machen.
- **Skizze Etappe 2:** Ampel statt Zahl („wie geplant / leichter / Ruhetag“, KONZEPT 9), erklärbar aus drei
  Signalen: Ruhepuls vs. eigener 28-Tage-Mittelwert (z. B. > +7 /min), Schlaf < 6 h zwei Nächte, Belastung der
  letzten 7 vs. 28 Tage (Acute:Chronic, Gabbett 2016, Br J Sports Med 50:273–280). Nie Pflicht, nur Vorschlag an
  die Live-Anpassung (KONZEPT 4.1). Grenzwerte vor Livegang fachlich prüfen.

## 6. Datenmodell (nur additive Migrationen, RLS, pgTAP)

- `consent_type` + `'wearable_data'`; `consent_documents` Version 1.
- `log_source` + `'health_connect'` (wie `'gps'`, `'workout'`).
- **`wearable_connections`** (user_id, provider `wearable_provider` = `'health_connect'`, status
  `connected|revoked|error`, granted_types text[], connected_at, last_sync_at, last_sync_count) – PK (user_id,
  provider).
- **`daily_metrics`** (user_id, day date, source, resting_hr_bpm, sleep_min, steps, updated_at) – PK (user_id, day,
  source); CHECKs: Ruhepuls 30–120 (wie Onboarding), Schlaf 0–1.440, Schritte 0–100.000.
- **`session_logs`**: `external_id text null` + eindeutiger Index (user_id, source, external_id) where not null.
- **`cardio_logs`**: `kcal integer null` (0–10.000). Kein Puls hier (Puls ist eigene, löschbare Tabelle).
- **`heart_rate_summaries`** (session_log_id PK/FK cascade, user_id, avg_bpm, max_bpm, zone_s integer[5],
  hf_max_used) – fällt beim Widerruf komplett weg.
- `tracked_routes` bleibt unverändert (Etappe 1 importiert keine Strecken); Verknüpfung über `session_log_id` reicht.
- **RPCs:** `import_wearable_batch(p_items jsonb)` – idempotent je `external_id`, Einwilligung prüfen, Grenzen wie
  Core, Zusammenführen nur an eigenen Einträgen, höchstens 500 Einträge je Aufruf; `upsert_daily_metrics(p_days
jsonb)`; `disconnect_wearable(p_delete_imported boolean)`. `save_session_log` bleibt unangetastet (wie W-E6).
- Export (`export_my_data`), `db-sync`-Test, pgTAP neu `63_wearables.test.sql` (RLS, Widerruf, Idempotenz,
  Fremdzugriff, Grenzen).

## 7. Sync-Ablauf und UI

### 7.1 Abgleich (W8-7, W8-8)

- Auslöser: App-Start, Rückkehr in den Vordergrund (höchstens alle 15 min) und Knopf **„Jetzt abgleichen“**.
- Zeitraum: erster Abgleich **letzte 30 Tage**, danach ab `last_sync_at` minus 48 h (Samsung überträgt teils
  verzögert; Duplikate verhindert `external_id`).
- **Offline-first:** gelesene Daten → verschlüsselte Warteschlange (`wearableQueue`, wie `routeQueue`) → senden bei
  Verbindung; Teilerfolge bleiben stehen.
- **Kein Hintergrund-Abgleich** (Akku, Play-Regeln, Zusatzberechtigung) – Etappe 2 prüfen.
- **Zustände:** Health Connect fehlt/veraltet → Installieren-Knopf; Berechtigung entzogen (in Health Connect
  abgeschaltet) → Status „Zugriff fehlt“, Knopf „Berechtigungen öffnen“, keine Fehlerschleife; keine Daten →
  „Noch keine Daten von der Uhr. Prüfe in Samsung Health, ob Health Connect eingeschaltet ist.“; Fehler →
  „Abgleich fehlgeschlagen, später erneut“ (Daten gehen nicht verloren).

### 7.2 Oberflächen

- **Einstellungen → „Smartwatch verbinden“:** Erklärung (welche Daten, wozu, was nicht passiert), Einwilligung
  `wearable_data`, dann Systemdialog. Danach Status: verbunden seit, letzter Abgleich, Anzahl übernommen,
  freigegebene Datentypen, „Jetzt abgleichen“, „Trennen“ (W8-12: Rückfrage behalten/löschen).
- **Tagebuch:** importierte Einträge mit Uhr-Symbol und „aus Samsung Health“ (Name aus `dataOrigin`), bearbeitbar
  wie freie Einheiten; „Möglicher Doppel-Eintrag“-Hinweis mit Knöpfen.
- **Ausdauer-Auswertung** (`/ausdauer/[id]`): Ø/Max-Puls und Zonen-Balken, wenn vorhanden; Liste „Meine Läufe“ zeigt
  Uhr-Einheiten mit (ohne Linie). Story-Bild unverändert ohne Puls.
- **Übersicht:** in Etappe 1 nur Schritte/Schlaf in einer kleinen Kachel „Tageswerte“ (ausblendbar, E2-Kachel-
  System); Kachel „Erholung“ erst mit Readiness (Etappe 2).
- **Web/iPhone:** Einstellungen zeigen „Nur in der Android-App“; vorhandene Daten (von Android importiert) sind im
  Web sichtbar.
- Leer-/Fehler-/Ladezustände wie 7.1; alle Texte Deutsch.

## 8. Google Play (vor Store-Einreichung Pflicht, für APK-Test nicht nötig)

1. Play Console → App-Inhalte → **Gesundheits-Apps-Erklärung** und **Health-Connect-Berechtigungsformular**: je
   Datentyp Zweck begründen (nur gelesene Typen aus Abschnitt 3).
2. **Datenschutzerklärung** (Website + in der App) um Health-Connect-Abschnitt ergänzen; Rationale-Bildschirm der
   App (Plugin-Aktivität) verlinkt darauf.
3. Abschnitt **Datensicherheit** im Play-Eintrag: Gesundheitsdaten, verschlüsselt, löschbar, nicht geteilt.
4. Health-Connect-Richtlinie: keine Werbung/Verkauf, Nutzung nur für die genannte Funktion (deckt sich mit
   CLAUDE.md). Prüfung durch Google kann Wochen dauern → früh einreichen.

## 9. So testet ihr es am Handy (Galaxy Watch + Android)

Voraussetzung: neue Test-APK (neues natives Modul). Android-Version prüfen: Einstellungen → Telefoninfo →
Softwareinformationen.

1. Uhr ist mit der App **Galaxy Wearable** gekoppelt und Daten erscheinen in **Samsung Health**.
2. Samsung Health öffnen → ☰/⋮ → **Einstellungen** → **Health Connect** → alle Datentypen für Samsung Health
   erlauben (Schreiben nach Health Connect einschalten).
3. Android 13 oder älter: im Play Store „Health Connect“ installieren/aktualisieren.
4. GitHub-App → Actions → `eas-build` → **Run workflow** (Plattform android, Profil preview) → nach dem Bau Link im
   Lauf öffnen → APK installieren (alte Alpha5-APK wird ersetzt).
5. Alpha5 → Einstellungen → **Smartwatch verbinden** → Erklärung lesen → zustimmen → im Systemdialog alles erlauben.
6. Mit der Uhr einen kurzen Lauf/Spaziergang aufzeichnen → warten, bis er in Samsung Health steht (kann Minuten
   dauern) → Alpha5 öffnen → **Jetzt abgleichen** → Eintrag mit Uhr-Symbol im Tagebuch, Puls in der Auswertung.
7. Gleichzeitig mit der App aufzeichnen → es darf **nur ein** Eintrag entstehen (mit Linie und Puls).
8. Zugriff entziehen: Einstellungen → Sicherheit & Datenschutz → Health Connect → App-Berechtigungen → Alpha5 →
   aus → Alpha5 zeigt „Zugriff fehlt“. Danach „Trennen“ mit „löschen“ testen.

Browser/iPhone: Vercel-Vorschau zeigt nur den Hinweis und importierte Daten (Testmodus mit Beispieldaten).

## 10. Etappen, Aufwand, Risiken

| Etappe | Inhalt                                                                          | Aufwand (grob) | Testbar         |
| ------ | ------------------------------------------------------------------------------- | -------------- | --------------- |
| H0     | Spike: Bibliothek, Plugin, Berechtigungen, welche Samsung-Typen kommen wirklich | klein (1 PR)   | Test-APK        |
| H1     | Core: Zuordnung, Duplikate, Pulszonen, Tageswerte (+ constants mit Quellen)     | mittel         | CI              |
| H2     | Datenmodell: Einwilligung, Tabellen, RPCs, Export, pgTAP                        | mittel         | CI / db-migrate |
| H3     | App: Verbinden, Abgleich, Warteschlange, Tagebuch-Symbol, Trennen               | groß           | Test-APK + Web  |
| H4     | Ausdauer-Auswertung mit Puls, Kachel „Tageswerte“, Doku                         | klein          | Test-APK + Web  |
| E2     | Etappe 2: Readiness „Erholung“, HRV, ggf. Schreiben, Hintergrund-Abgleich       | später         |                 |

**Risiken:**

- **Samsung-Verzögerung:** Samsung Health schreibt nicht sofort nach Health Connect → Abgleich 48 h rückwirkend,
  Hinweis „kann einige Minuten dauern“.
- **Datentypen fehlen:** Samsung liefert evtl. keinen Ruhepuls/keine Distanz für manche Sportarten → H0 klärt das,
  Felder bleiben leer statt geschätzt.
- **Android-Versionen:** 8–13 brauchen die Health-Connect-App, 14+ eingebaut; Herstelleroberflächen unterscheiden
  sich (Klickwege in der Anleitung allgemein halten).
- **Doppelzählung:** App-GPS + Uhr + manuell → 5.2 plus Tests; Schritte nur über Aggregat.
- **Bau-Risiko:** neues natives Modul, `minSdk` 26 – im Spike vor allen anderen Etappen prüfen.
- **Play-Prüfung:** Health-Connect-Formular kann Einreichung verzögern.

## 11. Offene Gründer-Entscheidungen

Keine – W8-1 bis W8-13 sind „wie empfohlen“ freigegeben (Tabelle Abschnitt 1). Neue Fragen aus der Umsetzung stehen
in Abschnitt 13.4.

## 12. Definition of Done (je Etappe)

Typen + Zod, Migration mit RLS + pgTAP, Core mit Tests (Grenzfälle), UI mobil + Web-Hinweis, Leer-/Fehler-/
Ladezustände, Texte Deutsch, `docs/` (dieser Plan, KONZEPT 9, HANDY-ANLEITUNG) aktualisiert; PR mit „So testest du
es am Handy“.

## 13. Umsetzungsstand (21.10.2026, Branch `claude/wearables-h1`)

### 13.1 Was gebaut ist

| Etappe        | Stand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Wo                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| H0 Spike      | **offline geprüft:** `react-native-health-connect` 4.1.3 + eingebautes Config-Plugin, `expo-build-properties` ~57.0.22 (`minSdkVersion 26`), `expo install --check` (offline) ok, Autolinking (TurboModule + Expo-Modul `react-native-health-connect-expo`) ok, `expo prebuild --platform android` ok (Manifest siehe 13.2). **Offen:** echter EAS-Build, Test mit Galaxy Watch (welche Typen Samsung wirklich schreibt)                                                                                                                                                           | `apps/mobile/app.config.ts`, `native-config.test.ts`                                                            |
| H1 Core       | Zuordnung Trainingsart → Tagebuch (`mapExerciseType`), Import-Schemas (Zod), `sessionFromHc`, Doppel-Erkennung (`matchExisting`, `assignDuplicates`, `candidatesFromLogRows`), Pulszonen (`maxHeartRate` Tanaka, eigener Wert Vorrang, `hrZones`, `summarizeHeartRate`), Tageswerte (`aggregateDailyMetrics`), Abgleich-Zeitraum (`syncWindow`, `shouldAutoSync`), Aufteilen in Aufrufe (`chunkImportBatches`); Konstanten mit Quellen in `constants.ts` (`HR_MAX_FORMULA`, `HEART_RATE_LIMITS`, `HR_ZONE_PERCENTS`, `DAILY_METRIC_LIMITS`, `WEARABLE_SYNC`, `WEARABLE_DUPLICATE`) | `packages/core/src/wearables/`                                                                                  |
| H2 Datenbank  | Enums (`wearable_data`, `health_connect`, `wearable_provider`, `wearable_connection_status`), Einwilligungstext v1, Tabellen `wearable_connections`, `wearable_sessions`, `heart_rate_summaries`, `daily_metrics` (RLS nur eigene Zeilen lesen, Schreiben nur über Funktionen), `connect_wearable`, `import_wearable_batch`, `resolve_wearable_duplicate`, `disconnect_wearable`; Widerruf (wearable_data **oder** health_data) löscht Puls, Tageswerte, Verbindung; Export; Konto löschen per Kaskade                                                                             | `supabase/migrations/20261021120000…120200`, pgTAP `64_wearables.test.sql`, `db-sync.test.ts`                   |
| H3 App        | Einstellungen → **Smartwatch verbinden** (Erklärung, eigene Einwilligung, dann Systemdialog nur mit Leserechten), Stand/letzter Abgleich/freigegebene Daten/Tageswerte, **Jetzt abgleichen**, **Trennen** (behalten/löschen, Puls immer weg), Widerruf in den Einwilligungen; Abgleich beim App-Start und bei Rückkehr in den Vordergrund (nur Android, höchstens alle 15 min); offline-first (verschlüsselte Warteschlange `wearableQueue`, Teilerfolge bleiben); Web/iPhone: „Nur in der Android-App“; Testmodus: Beispiel-Uhr                                                   | `apps/mobile/src/app/smartwatch.tsx`, `data/wearable-*.ts`, `lib/health-connect-*.ts`, `state/use-wearables.ts` |
| H4 Auswertung | Tagebuch-Eintrag mit „⌚ aus Samsung Health“ und kcal, **Puls (Ø/Max) und Zeit je Zone**, „Möglicher Doppel-Eintrag“ (Zusammenführen/Beide behalten); Verlauf und „Meine Läufe“ mit Uhr-Kennzeichen; zusammengeführte App-Aufzeichnung zeigt den Uhr-Puls; Story-Bild nie mit Puls (Tests core/statisch/E2E)                                                                                                                                                                                                                                                                       | `components/wearables.tsx`, `app/log/[logId].tsx`, `app/ausdauer/*`                                             |

### 13.2 Android-Manifest nach `expo prebuild` (geprüft 21.10.2026)

- **Neu, nur lesen:** `android.permission.health.READ_EXERCISE`, `READ_DISTANCE`, `READ_TOTAL_CALORIES_BURNED`,
  `READ_HEART_RATE`, `READ_RESTING_HEART_RATE`, `READ_SLEEP`, `READ_STEPS` (je Datentyp genau eine).
- **Entfernt (`tools:node="remove"`):** `READ_HEALTH_DATA_IN_BACKGROUND`, `READ_HEALTH_DATA_HISTORY`,
  `READ_EXERCISE_ROUTES` und alle `WRITE_*` dieser Typen inkl. `WRITE_EXERCISE_ROUTE`.
- **Health-Connect-Erklärung:** Intent-Filter `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` an der
  `MainActivity` (Android ≤ 13) und `activity-alias` `ViewPermissionUsageActivity` (Aktion `VIEW_PERMISSION_USAGE`,
  Kategorie `HEALTH_PERMISSIONS`, geschützt durch `START_VIEW_PERMISSION_USAGE`, Android 14+) – vom Plugin der
  Bibliothek. Die Bibliothek selbst ergänzt nur `<queries>` für `com.google.android.apps.healthdata`.
- `android.minSdkVersion=26`; `compileSdk`/`targetSdk` bleiben bei den Werten von Expo SDK 57 (36).

### 13.3 Abweichungen vom Plan (begründet)

- **kcal und `external_id` in eigener Tabelle `wearable_sessions`** statt `cardio_logs.kcal` und
  `session_logs.external_id`: `save_session_log` (unangetastet, wie W-E6) löscht und schreibt `cardio_logs` beim Ändern
  neu – kcal ginge verloren; so bleibt jede Änderung in der App verlustfrei. Die Tabelle trägt auch Herkunft,
  „zusammengeführt“ und den Doppel-Hinweis. Eindeutig ist `(user_id, provider, external_id)` statt `(user_id, source,
external_id)`, weil ein zusammengeführter Eintrag seine Herkunft (z. B. `gps`) behält.
- **Kein eigenes `upsert_daily_metrics`:** Tageswerte gehen im selben Aufruf `import_wearable_batch` mit (eine
  Einwilligungs-Sperre, eine Warteschlange). Dazu `connect_wearable` (Stand nach dem Systemdialog, „Zugriff fehlt“).
- **Ungültige Einheiten/Tage** lehnen nicht den ganzen Abgleich ab, sondern werden übersprungen und gezählt – sonst
  bliebe die Warteschlange hängen. Ein falscher Aufbau (Felder, > 500 Einheiten, > 62 Tage, > 1 MB) wird abgelehnt.
- **„Sonstige“ (Yoga, Tennis …)** und Kraft werden freie Einheiten der Art Kraft ohne Übungen (Titel aus der
  Trainingsart, nie Freitext der Uhr). Ausdauer-Namen = feste Namen der freien Einheit („Lauf“ …).
- **Widerruf `health_data`** löscht ebenfalls Puls und Tageswerte (wearable_data setzt health_data voraus).
- **pgTAP-Nummer 64** (63 war belegt).

### 13.4 Offen / Risiken

1. **H0 am echten Gerät:** EAS-Build mit dem neuen Modul und Test mit Galaxy Watch (HANDY-ANLEITUNG Teil 9c B) –
   insbesondere ob Samsung **Ruhepuls**, **Distanz** und **kcal** nach Health Connect schreibt (sonst bleiben Felder
   leer) und ob der Systemdialog bei einer APK ohne Play-Eintrag normal erscheint.
2. **Rationale-Bildschirm:** Tippt jemand im Health-Connect-Dialog auf „Datenschutzerklärung“, öffnet sich Alpha5 auf
   der Startseite. Vor der Play-Einreichung (Abschnitt 8) sollte dieser Aufruf direkt den Einwilligungstext bzw. die
   Datenschutzerklärung zeigen (kleiner Folge-PR, im Gerätetest prüfen).
3. **Eigener Maximalpuls:** Core unterstützt ihn (Vorrang, 120–230), die App hat noch kein Eingabefeld/keine
   Speicherung – bis dahin immer Schätzung nach Tanaka (Hinweis in der Auswertung).
4. **Kachel „Tageswerte“ auf der Übersicht** (7.2) noch nicht gebaut (neue Kachel-ID braucht eine Migration von
   `save_app_layout`); Tageswerte stehen vorerst auf der Smartwatch-Seite.
5. **Ändern übernommener Einheiten:** Löschen geht immer; Ändern folgt den Regeln freier Einheiten (nur 14 Tage zurück,
   feste Namen) – „Sonstige“ wie „Yoga“ lassen sich deshalb nicht umbenennen.
6. **Schritte je Tag** werden in der Zeitzone des Handys abgefragt (DACH = Europe/Berlin); Einheiten/Schlaf nutzen
   Europe/Berlin wie das übrige Tagebuch.
7. **Play-Formular** Health-Connect-Berechtigungen und Datenschutzerklärung (Abschnitt 8) – vor der Store-Einreichung.
