# Plan Phase 8 – Wearables, Waagen & Readiness

> **Hinweis (21.10.2026):** Freigegeben von den Gründern („alle wie empfohlen“). Galaxy Watch/Health Connect ist bereits in `docs/PLAN-PHASE-8.md` (Etappe 1) geregelt und hat Vorrang; dieser Plan ergänzt Strava, Withings-Waagen und die Tagesform-Ampel. Bei Überschneidung gilt PLAN-PHASE-8.md.

**Status:** Entwurf zur Freigabe (19.10.2026). Wächter-Prüfung Runde 1: „nicht freigabefähig, behebbar im Plantext“ –
alle Befunde (B1–B7, S1–S15, K1–K10) sind eingearbeitet (Abschnitt 0). **Wächter Runde 2: freigabefähig mit Auflagen,
N1–N7 eingearbeitet** (Abschnitt 0). Gründer-Entscheidung 19.10.2026 eingearbeitet: **bis Ende der Testphase keine Abos, alles kostenlos und
uneingeschränkt testbar** (Flag `premium_open`). Die Gründer-Fragen stehen in Abschnitt 21 (WE-G1 bis WE-G25).
Umsetzung erst nach Freigabe, je Etappe ein Pull Request mit Wächter-Prüfung.

**Grundlage:** `CLAUDE.md` (Gesundheitsdaten, KI-Grenze, Smartphone-Regel, Tech-Stack „Wearables: HealthKit, Health
Connect, Strava-API, Garmin Connect (OAuth über Server)“, „ab Wearables Development Build“), `docs/KONZEPT.md`
(4.1, 5, 6, 9, 10.1, 11, 12, 13, 14, 15), `docs/PROMPTS.md` Phase 8, `docs/PLAN-PHASE-4.md` (3.4 S2: Herzfrequenz erst
Phase 8; `log_source`), `docs/PLAN-PHASE-4B.md` (4.6, 6.1; reservierte Werte `wearable_data`, `readiness_lighter`),
`docs/PLAN-PHASE-9.md` (Entwurf 19.10.2026: 3.3, 6.3, 6.4, 7.6 – gemeinsamer „Heute leichter“-Mechanismus),
`docs/PLAN-PHASE-10.md` (S0, S1 Teil 1, `tracked_routes`, 11.2), `docs/PLAN-AUSWERTUNG.md` (A1b freie Einheit),
`docs/PLAN-PHASE-6.md` (Aufbau, `health_data` v2), Gründer-Wunsch Withings-Waagen (19.10.2026), Code-Stand vom
19.10.2026.

---

## 0. Wächter-Prüfung: eingearbeitet

Die Wächter-Prüfung (scratchpad `waechter-plan-8.md`) fand sieben blockierende Punkte, fünfzehn Soll- und zehn
Kann-Punkte. Alle sind im Plantext umgesetzt:

| Befund                                                                   | Lösung im Plan                                                                                                                                                                                                                                                                                               | Abschnitt               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| **B1** OAuth: fremdes Anbieter-Konto an Angreifer-Konto bindbar          | Ablauf an das Gerät gebunden: App-Verifier (Hash an `start`), Callback tauscht Code und legt nur ein **ausstehendes** Ergebnis + Einmal-Code an, erst `finalize` mit JWT **und** Verifier verbindet (`state.user_id` = JWT-Nutzer). `unique (provider, provider_user_id)`, Anzeige „verbunden als …“, Tests. | 5.2, 10, 11             |
| **B2** Schlüssel und Routen in Vorschau-Umgebungen                       | Secrets **nur Production**; alle `/api/wearables/*` antworten außerhalb Production mit `404` ohne Datenbank-Aufruf (Test). Vorschau nur mit Attrappe.                                                                                                                                                        | 5.2, 10, 16, 22         |
| **B3** WE7 widerspricht 4b (heutige Einheit ausgeschlossen)              | WE7 neu geschnitten: Readiness liefert nur ein **Angebot** für heute; angewendet auf dem Gerät über `lighterSessionVariant`, gespeichert als `session_logs.day_variant = 'lighter'`. Kein `plan_adjustments`-Eintrag, `readiness_lighter`/`wearable_data` bleiben reserviert. Keine Abhängigkeit von 4b B/C. | 4.6, 13                 |
| **B4** Widersprüche zu Phase 9                                           | Abschnitt 4.6 „Gemeinsam mit Phase 9“: eine Formel (`LIGHTER_DAY` aus P9), ein Code-Ort (`plan/day-variant.ts`), `combineDayOffers`, Tapering wie P9, Angebot gratis, Readiness liest nie Zyklusdaten (Strukturtest), eine Selbsteinschätzung, `hasWearableSleep`. Satz zu Symptomen gestrichen.             | 2.5, 4.5, 4.6, 7, 9, 13 |
| **B5** Waagen-Körperfett und Median-Gewicht treffen auf bestehenden Code | Herkunft **je Feld** (`weight_source`, `body_fat_source`); `latestBodyValues` und SQL (`save_meal_plan`) nutzen Körperfett nur aus `manual`; eine Funktion `currentWeight()` mit SQL-Gegenstück und `db-sync`-Abgleich, gilt für Kalorien, BMI und Planbarkeit; Tests mit Schutzgrenzen.                     | 4.7, 7, 8.2, 8.3        |
| **B6** Selbsteinschätzung ohne Einwilligung                              | Antwort bleibt **nur auf dem Gerät** (nur für heute, am nächsten Tag verworfen), wird nie gespeichert oder gesendet; keine Tabelle `readiness_checkins`. Gründer-Frage WE-G8.                                                                                                                                | 4.5, 4.6, 8.2, 17, 21   |
| **B7** Readiness-Quellen nicht eindeutig                                 | Quellen-Schlüssel = Anbieter + App/Gerät (`source_key`); feste Rangfolge je Messwert; Basis nur je Quellen-Schlüssel; Schlaf-Intervalle zusammenführen, nur „schlafend“, nie „im Bett“; Tests für zwei Quellen, Wechsel, Überlappung.                                                                        | 4.5, 8.2                |
| **S1** Webhook-DoS auf Strava-Kontingent                                 | Geheimer Pfad-Teil, Vergleich in konstanter Zeit, Jobs eindeutig, Abruf nur für unbekannte Objekte, Deckel je Person/Stunde, globales Budget mit Reserve, nur `active`, immer `200` ohne Echo, optional Vercel-Firewall; gleich für Withings und `/jobs/run`.                                                | 5.3                     |
| **S2** Refresh-Wettlauf                                                  | Lease (`refresh_lock_until`) per RPC + `token_version` mit Compare-and-Swap; neuer Token wird gespeichert, bevor er benutzt wird; Test mit zwei parallelen Läufern.                                                                                                                                          | 5.2                     |
| **S3** Schlüsselverwaltung                                               | AAD = `connection_id\|feld\|key_id`; `WEARABLE_TOKEN_KEYS` (JSON) + `WEARABLE_TOKEN_KEY_CURRENT`; Neu-Verschlüsseln über Production-Route mit Admin-Secret (Schlüssel nie in GitHub); HKDF-Parameter fest; Sicherung im Passwort-Manager.                                                                    | 5.2, 22                 |
| **S4** Updates, Löschungen, Löschpflichten                               | Anbieter-Updates ändern nach dem Anlegen nichts; `delete` → Karte „auch hier löschen?“ bzw. Pflicht-Löschung, falls der Vertrag es verlangt (VOR BAU PRÜFEN); `source = 'strava'` gezielt löschbar; `start_date` (UTC) vs. `start_date_local`.                                                               | 4.3, 4.4, 5.3           |
| **S5** Anbieter-Widerruf nach Kaskade unmöglich                          | Widerruf synchron in der Route **vor** dem Löschen (Zeitlimit, Strava vorher Refresh); Rückfall: Outbox mit verschlüsseltem Token ohne `user_id`, nach 24 h gelöscht. Gilt für Konto löschen und Widerruf `wearable_data`.                                                                                   | 5.2, 8.4                |
| **S6** `measurement_updated` höchstens 1× am Tag                         | `private.adjust_event_after_write` erhält bei `weight_source <> 'manual'` die Sperre „schon ein Ereignis heute“; pgTAP.                                                                                                                                                                                      | 4.7, 8.3                |
| **S7** Readiness-Formel unscharf                                         | Tageswert gegen Tages-Basis (Kiviniemi 2007), SD-Untergrenze in ln-Einheiten, eindeutige Reihenfolge der Regeln, Apple-SDNN nur aus dem Schlaffenster, Belastung nur mit Anstrengung (Karte „Wie anstrengend?“), Messwert-Teil aus bei Medikamenten/Arzt-Flag (WE-G25).                                      | 4.5                     |
| **S8** Arzt-Hinweis aus Werte-Verlauf                                    | Gestrichen. Allgemeiner Satz steht dauerhaft in der Erklärung; Häufungs-Hinweis nur über **Angebote** (gemeinsam mit P9, ein Text); Zweckbestimmung schriftlich.                                                                                                                                             | 4.8                     |
| **S9** Withings `attrib`, gemeinsame Waage                               | Positivliste `attrib ∈ {0, 2}`, Rest übersprungen (Test); Löschen einer Waagen-Zeile setzt den Import auf `deleted_by_user` (Trigger).                                                                                                                                                                       | 4.7, 8.3                |
| **S10** Datenminimierung und Aufbewahrung                                | `daily_metrics` 12 Monate (WE-G23); Strava-Antwort per Zod-`pick` vor jeder Verarbeitung (Polyline nie in DB/Log); Health Connect Durchschnittspuls per Aggregat; `skipped` nur ID + Status.                                                                                                                 | 4.1, 5.4, 8.2           |
| **S11** Gleichzeitige Importe                                            | `pg_advisory_xact_lock` je Person in der Import-Funktion, Einwilligung `for share`, höchstens 100 Datensätze je Aufruf, pgTAP parallel.                                                                                                                                                                      | 8.3                     |
| **S12** Zuordnung muss `save_session_log`-Regeln einhalten               | Regeln ausdrücklich übernommen (ISO-Woche ± 1, ein Eintrag je Einheit, gestrichene Einheiten nie, Fenster nach Europe/Berlin); Reise-Grenzfälle; eigenes Import-Limit, nicht A1b.                                                                                                                            | 4.3, 4.4                |
| **S13** Native Bibliotheken in allen Builds                              | Health-Plugins nur mit Build-Variable `HEALTH_NATIVE=1` (Workflow-Eingabe), Prebuild-Prüfung beider Varianten; Frage `minSdkVersion` (WE-G24).                                                                                                                                                               | 5.4, 12, 21             |
| **S14** Einrichtungs-Schritte                                            | Flags in `beta-grant` und Seed ergänzen; Strava 1 Athlet (Abschnitt 16); „Desktop-Website anfordern“; ohne Preview; Withings-Callback-Domain vormerken.                                                                                                                                                      | 16, 22                  |
| **S15** Einwilligungstext                                                | Ergänzt: 28 Tage Tageswerte, Waage auf Wunsch 90 Tage, Vercel/Supabase als Auftragsverarbeiter, Aufbewahrung, Selbsteinschätzung nur auf dem Gerät. Titel „Puls- und Gerätedaten“, deckt auch Puls von Hand (WE-G5).                                                                                         | 17.1                    |
| **K1** Zählfehler Handy-Test                                             | 4 statt 5 Einträge.                                                                                                                                                                                                                                                                                          | 16                      |
| **K2** KONZEPT 9/11.3 nennen Schritte                                    | Doku-DoD: KONZEPT 9 und 11.3 anpassen.                                                                                                                                                                                                                                                                       | 15                      |
| **K3** Schlüsselort P8 (Vercel) vs. P9 (Vault)                           | DSFA beschreibt beide Modelle nebeneinander mit Begründung.                                                                                                                                                                                                                                                  | 17.2                    |
| **K4** Ruhepuls von Hand vs. Uhr                                         | Readiness ignoriert `body_metrics.resting_heart_rate_bpm`.                                                                                                                                                                                                                                                   | 4.5                     |
| **K5** Anbieter-Personen-ID im Export                                    | Gehört in die Auskunft (ohne Tokens).                                                                                                                                                                                                                                                                        | 8.4                     |
| **K6** OAuth-`code` in Vercel-Logs                                       | In DSFA und Datenschutzerklärung genannt.                                                                                                                                                                                                                                                                    | 17.2                    |
| **K7** Erstabgleich Tageswerte                                           | Tageswerte 28 Tage, Workouts 14 Tage; Attrappe passend; Text 17.1.                                                                                                                                                                                                                                           | 4.1, 9, 17.1            |
| **K8** Markenregeln                                                      | Strava „View on Strava“/„Powered by Strava“, Garmin „Garmin [Gerät]“ konkretisiert.                                                                                                                                                                                                                          | 10, 14                  |
| **K9** Zu viele Gründer-Fragen                                           | Markiert: **blockiert WE1** vs. **später**; neue Fragen aus B4, B6, S10, S13 ergänzt.                                                                                                                                                                                                                        | 21                      |
| **K10** Sommerzeit bei „erste Messung des Tages“                         | Testfall Messung 00:30 am Umstellungstag.                                                                                                                                                                                                                                                                    | 7                       |
| **N1** Wirkung von `day_variant` auf 4b wie P9                           | Wortgleich zu P9 6.4: `lighter` zählt für 4b **R1–R4 nicht** und für **R5 als „geschafft“**; Core und SQL gleich (`and sl.day_variant is null`).                                                                                                                                                             | 4.6                     |
| **N2** Speicherort und Schreib-Sperre `day_variant`                      | Wahl im **geschützten Speicher** (wie P9 B1, geleert bei Widerruf, Abmelden, Kontowechsel); `day_variant` wird erst geschrieben, wenn der Knopf „Heute leichter“ für alle live ist – kommt WE7 vor ZY5, baut WE7 ihn mit; CHECK `day_variant is null or not is_free`.                                        | 4.6, 13                 |
| **N3** Häufungs-Zähler                                                   | **Getrennte** Zähler: P8 zählt nur Readiness-Angebote, Hinweis in der Tagesform-Erklärung ohne Zyklus-Bezug; gleicher Wortlaut erlaubt, Zustand getrennt.                                                                                                                                                    | 4.6, 4.8, 13            |
| **N4** Zyklus-Check-Prüfung und Verschieben                              | Prüfung „heute Zyklus-Tages-Check?“ in der App-Schicht (Bildschirm „Heute“), nie in `readiness/`; „Verschieben“ mit der P9-Regel (keine zwei harten Einheiten an Folgetagen).                                                                                                                                | 4.5, 4.6                |
| **N5** `premium_open` öffnet KI                                          | `premium_open` umgeht **nicht** KI-Flags, `ai_usage`-Monatslimits und die Beta-Freischaltung der Foto-KI; Test in WE2. Das Flag selbst wird separat gebaut, Phase 8 legt es nicht an.                                                                                                                        | 5.1, 8.1, 8.4           |
| **N6** Outbox und AAD                                                    | Outbox-Eintrag führt `connection_id` und `key_id` (ohne `user_id`), Test „Entschlüsseln nach Löschen der Verbindung“.                                                                                                                                                                                        | 5.2, 8.2                |
| **N7** 22.F konkret                                                      | Schritt **Actions → beta-grant → `flag_an` → `premium_open`** ergänzt.                                                                                                                                                                                                                                       | 22                      |

---

## 1. Kurzfassung

Phase 8 holt Daten aus Uhren, Fitness-Apps und Waagen in die App. Daraus entstehen drei Dinge:

1. **Workouts landen automatisch im Tagebuch** – aus Apple Health (HealthKit), Health Connect (Android), Strava und
   optional Garmin. Doppelte Einträge erkennt die App und legt sie nicht zweimal an.
2. **Tageswerte** (Ruhepuls, HRV, Schlafdauer) landen in `daily_metrics`. **Gewicht und Körperfett** aus der Waage
   (Withings direkt oder über Apple Health/Health Connect) landen in den bestehenden Körperdaten, mit Herkunft je Feld.
3. **Tagesform (Readiness):** Eine transparente Regel in `packages/core` bewertet Schlaf, Ruhepuls, HRV und die
   letzte Belastung. Ergebnis ist ein **Angebot** „Heute leichter“ oder „Lieber verschieben“ – über denselben
   Mechanismus wie im Zyklus-Modul (Phase 9). Nie automatisch, nie Diagnose.

**Das Wichtigste vorweg:**

- **Keine KI.** Feste Regeln, keine laufenden KI-Kosten.
- **Testphase: alles kostenlos** (Gründer-Entscheidung 19.10.2026, Flag `premium_open`). Die Premium-Prüfung auf dem
  Server wird trotzdem gebaut; die endgültige Aufteilung kommt mit Phase 7.
- **Eigene Einwilligung `wearable_data`** („Puls- und Gerätedaten“, Art. 9 DSGVO). Für Waagen-Werte zusätzlich
  `health_data`.
- **Datenminimierung:** nur Workouts (Art, Start, Dauer, Distanz, Höhenmeter, Durchschnittspuls), Ruhepuls, HRV,
  Schlafdauer, Gewicht, Körperfett. **Keine** Pulskurven, GPS-Spuren, Schritte, Schlafphasen, Muskelmasse.
- **Tokens nur auf dem Server**, verschlüsselt, **nur in Production**. Verbinden ist an das eigene Gerät gebunden
  (Schutz gegen untergeschobene Links). „Trennen“ widerruft beim Anbieter und löscht sofort.
- **Readiness macht nie härter**, liest nie Zyklusdaten, ändert nie den Plan selbst. Angebot und Knopf „Heute
  leichter“ für alle.
- **APK erst am Ende (Gründer-Regel):** Alles außer dem echten HealthKit/Health-Connect-Zugriff ist im Handy-Browser
  testbar – mit **Attrappen** im Vorschau-Link und mit echten Strava-/Withings-Konten in der Production-Web-App. Der
  native Teil wird in CI per `expo prebuild` geprüft; ein einziger Build am Schluss.
- **9 Etappen** (WE0–WE8). Präfix „WE“, weil „W1“, „WP1–WP5“ (Phase 10), „SU“ (Phase 6) und „ZY“ (Phase 9) vergeben
  sind.

---

## 2. Ist-Stand (geprüft am 19.10.2026)

### 2.1 App-Technik (`apps/mobile`)

- **Expo SDK 57** (`expo ~57.0.26`), React Native 0.86.3, React 19.2, neue Architektur (Standard in SDK 57).
- `app.config.ts`: `EAS_PROJECT_ID` und `EAS_OWNER` sind gesetzt (SETUP Teil D erledigt). Bundle-ID/Paket
  `de.fitnessapp.app`, Schema `fitnessapp`. Kommentar: „Kommt später eine dazu (z. B. HealthKit, Phase 8), hier
  deutschen Text ergänzen.“ Das Datenschutz-Manifest nennt schon `Health` und `Fitness` als gesammelte Datenarten.
- Eigene Config-Plugins im Code (`withoutPushEntitlement`, `withoutGoogleCodeScannerDownload`) – Muster für
  HealthKit-Entitlement und Health-Connect-Manifest.
- Native Module heute: `expo-camera`, `expo-notifications`, `expo-secure-store`, `expo-crypto`, `expo-file-system`,
  `expo-haptics`, `expo-keep-awake`, `expo-print`. **Nicht** vorhanden: `expo-location` (Spike S0 aus Phase 10 offen),
  `expo-web-browser`, `expo-auth-session`, keine Health-Bibliothek.
- `eas.json`: Profile `development` (Development Build), `preview` (APK), `production`. Workflows `eas-build`,
  `eas-ios-setup`.
- Plattform-Aufteilung `*.native.tsx` / `*.tsx` gibt es (Muster für Health-Adapter).
- Testmodus ohne Supabase (alle Daten auf dem Gerät, `local-rules.ts`) – Grundlage für die Attrappen.

### 2.2 Server (`apps/web`)

- API-Routen-Muster: `src/app/api/ernaehrung/foto/route.ts` → Logik in `src/lib/food-photo/handler.ts` mit
  eingereichtem `env`, Tests in `handler.test.ts`; `runtime = 'nodejs'`, `preferredRegion = 'fra1'`,
  `Authorization: Bearer <Supabase-JWT>`, CORS nur für die App-Adresse. Die 4b-Route `/api/live-anpassung` antwortet
  außerhalb Production mit `404` (4b Wächter B1) – Muster für Phase 8.
- `SUPABASE_SERVICE_ROLE_KEY` liegt im Vercel-Projekt „Web“. Keine Cron-Jobs in Vercel.

### 2.3 Datenbank (72 Migrationen)

- `consent_type`: `terms`, `privacy`, `health_data`, `cycle_data`, `ai_food_photo`. Muster für eine eigene
  Einwilligung: `ai_food_photo`.
- `log_source`: `manual`, `gps`, `gpx_import`. `session_logs.source`, `is_free` (A1b), `started_at`/`finished_at`
  (optional).
- `cardio_logs`: Art (`run | walk | bike | swim`), Dauer, Distanz, Höhenmeter – **ohne Herzfrequenz**.
- `body_metrics`: **eine Zeile je Tag** (`unique (user_id, measured_on)`), Größe, Gewicht (30–300 kg), Körperfett
  (3–60 %), Ruhepuls (30–120), **ohne Quelle**; `authenticated` schreibt direkt (Einwilligungs-Trigger). Trigger
  `body_metrics_adjust_event` (`20261018200400_live_adjust_outbox.sql`) feuert bei **jedem** Einfügen/Ändern.
- `save_meal_plan`-Plausibilität (`20261016120000_n7_teil2_retention_kcal_check.sql`) liest das **neueste**
  `weight_kg` und `body_fat_pct` ohne Quellenfilter.
- `adjustment_trigger` enthält `wearable_data`, `adjustment_rule` enthält `readiness_lighter` (beide reserviert).
- `private.feature_flags`, `private.has_entitlement_for(uid, …)`, Workflow `beta-grant` (Flag-Auswahl heute nur
  `ai_food_photo`, `food_product_lookup`).
- **Keine** Tabellen `wearable_connections`, `daily_metrics`. Keine Nutzung von Vault/`pgsodium`.

### 2.4 Core (`packages/core`)

- `nutrition/body-data.ts`: `latestBodyValues()` nimmt je Feld die **neueste** Zeile; `isBodyFatUsable()` speist
  Katch-McArdle. Waagen-Körperfett ginge heute also sofort in die Kalorien (B5).
- `routes/` (S1 Teil 1): in Phase 8 nicht gebraucht (keine Spuren-Importe); `CARDIO_PLAUSIBILITY_KMH` gilt auch für
  Importe.
- `log/` (Tagebuch, freie Einheit), `adjust/` (4b R1–R5), `content/text-rules.ts` (`FORBIDDEN_MEDICAL_TERMS`),
  `export/data-export.ts`.
- **Kein** Modul `wearables/`, `readiness/` oder `plan/day-variant.ts` (kommt mit ZY1 oder WE1, Abschnitt 4.6).

### 2.5 Überschneidungen mit anderen Plänen

| Plan                           | Berührung                                                               | Regel in Phase 8                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Phase 9 (Zyklus)               | „Heute leichter“, `day_variant`, Tages-Check (Energie, optional Schlaf) | **Ein** Mechanismus (4.6). Readiness liest **nie** Zyklusdaten. Schlaf-Schnittstelle `hasWearableSleep` für ZY-G5. |
| Phase 10 S0 (Spike)            | Erster Development Build mit neuem nativen Modul                        | WE6 nutzt denselben Ablauf; kein gegenseitiges Warten.                                                             |
| Phase 10 S1 (`tracked_routes`) | GPS-Einträge `gps`                                                      | Duplikat-Erkennung prüft auch `gps`/`gpx_import`. Keine Spuren aus Strava.                                         |
| Phase 10 (Tapering, Renntag)   | Angebot leichter                                                        | Wie P9: Tapering erlaubt (nur weniger), **am Renntag kein Angebot**.                                               |
| PLAN-AUSWERTUNG A1b            | Freie Einheit, Fenster 14 Tage, Tageslimit 10                           | Importe ohne passende Einheit werden freie Einheiten; eigenes Import-Limit, zählt nicht ins A1b-Limit (4.4).       |
| Phase 4b                       | `wearable_data`, `readiness_lighter` reserviert; `measurement_updated`  | Beide bleiben reserviert (4.6); Waagen-Importe lösen `measurement_updated` höchstens 1× am Tag aus (4.7).          |
| Phase 5 (Kalorien)             | `latestBodyValues`, `clampCalorieTarget`, `save_meal_plan`              | Waagen-Körperfett nie in der Engine; `currentWeight()` überall gleich; Schutzgrenzen unverändert (4.7).            |
| Phase 6                        | `health_data` v2                                                        | Waagen-Werte brauchen `health_data` (gültige Fassung) **und** `wearable_data`.                                     |
| Phase 7 (Abos)                 | `has_entitlement_for`, `premium_open`                                   | Server-Prüfung bleibt; in der Testphase durch `premium_open` für alle frei.                                        |
| Phase 11/11b                   | KI-Coach, Challenges                                                    | Strava-Daten **nie** an KI; Challenges-Fortschritt später, ohne Schritte.                                          |

---

## 3. Umfang, Reihenfolge, Abgrenzung

### 3.1 Was in Phase 8 kommt

1. **Core** `packages/core/src/wearables/` und `packages/core/src/readiness/`: Normalisierung, Duplikat-Erkennung,
   Tageswerte, Waagen-Werte, `currentWeight()`, Readiness-Signal, Zod-Schemas. Dazu `plan/day-variant.ts`, falls
   Phase 9 (ZY1) es noch nicht gebaut hat.
2. **Datenbank:** Verbindungen, Tokens (privat), Import-Gedächtnis, `daily_metrics`, Herkunft je Feld an
   `body_metrics`, Puls an `cardio_logs`, Einwilligung `wearable_data`.
3. **App:** „Verbundene Geräte & Apps“, Einwilligung, Import-Hinweise, Tagesform-Karte, Puls im Tagebuch, Attrappen.
4. **Server (`apps/web`):** OAuth-Gerüst mit Geräte-Bindung, Strava, Withings, optional Garmin; Webhooks, Refresh,
   Trennen.
5. **Nativ:** HealthKit (iOS) und Health Connect (Android) – nur lesen, per Build-Variable zuschaltbar.
6. **Angebot „Heute leichter“** aus Readiness über den gemeinsamen Mechanismus mit Phase 9.

### 3.2 Empfohlene Reihenfolge der Quellen (WE-G1)

| Quelle                   | Abdeckung                                                                   | Hürde                                                                            | Testbar ohne APK        |
| ------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| Apple Health / HealthKit | Apple Watch und alles, was dorthin schreibt (Garmin, Polar, Oura, Withings) | Apple-Regeln 2.5.1, 5.1.2, 5.1.3; Entitlement; nur iPhone, nur nativ             | nein                    |
| Health Connect           | Samsung, Pixel Watch, Fitbit, Garmin, Withings, Oura (soweit sie schreiben) | Google-Play-Erklärung „Health apps“ + Formular je Datenart (erst für Play nötig) | nein                    |
| Strava                   | Workouts aller Geräte, auch für Web-Nutzer                                  | API-Bedingungen (keine KI, Marke), Limits, **1 Athlet bis zur Strava-Prüfung**   | ja (Production-Web-App) |
| Withings (direkt)        | Waagen (Gewicht, Körperfett)                                                | Entwicklerkonto, Callback-URL, Signatur-Verfahren                                | ja (Production-Web-App) |
| Garmin Connect (direkt)  | Garmin-Workouts, Schlaf, HRV, Ruhepuls                                      | **Antrag im Garmin Connect Developer Program**, Freigabe dauert Wochen           | ja (nach Freigabe)      |

**Empfehlung:** Fachlich zuerst **HealthKit und Health Connect** – sie decken die meisten Geräte ab (auch Garmin und
Withings indirekt) und brauchen keinen Server-Token. Wegen der APK-Regel **bauen** wir sie früh (WE6, mit Prüfung in
CI) und **testen** sie mit dem Abschluss-Build. Strava und Withings sind im Browser testbar und kommen vorher. Garmin
direkt nur optional (WE8).

### 3.3 Was NICHT in Phase 8 kommt

| Thema                                                         | Wann / Grund                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| Schreiben **in** Apple Health/Health Connect                  | später (WE-G15)                                            |
| GPS-Spuren aus Strava/Garmin/Health                           | nicht geplant; eigene Aufzeichnung ist Phase 10 S1         |
| Pulskurven, Puls-Zonen, TRIMP                                 | später, eigener Plan mit Fachprüfung                       |
| Schritte, Uhren-Kalorien, Schlafphasen, Stress                | nicht geplant (Datenminimierung, WE-G3)                    |
| Muskelmasse, Wasser, Knochenmasse (Waage)                     | nicht geplant (WE-G16)                                     |
| Polar, Fitbit-Web-API, Suunto, Oura-API, Whoop                | später; meist über Apple Health/Health Connect abgedeckt   |
| Hintergrund-Abruf auf dem Handy                               | später (WE-G9)                                             |
| Zyklusdaten aus Health-Apps, Zyklusdaten in Readiness         | **nie** in Readiness; Import nur Phase 9 Nachtrag (ZY-G11) |
| Automatische Plan-Änderung aus Readiness (`plan_adjustments`) | nicht geplant (4.6)                                        |
| KI-Auswertung von Wearable-Daten                              | Phase 11; Strava-Daten dort ausgeschlossen                 |
| Teilen, Ranglisten, Vergleich mit anderen                     | **nie** (CLAUDE.md)                                        |

---

## 4. Fachliche Regeln (Vorschläge – VOR LIVEGANG FACHLICH PRÜFEN)

Alle Zahlen stehen später in `packages/core/src/constants.ts` mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG
FACHLICH PRÜFEN“. Eine Sportwissenschaftlerin oder ein Sportmediziner prüft sie **vor dem öffentlichen Livegang**
(Abschnitt 22). Für Bau und Test sind diese Prüfungen keine Voraussetzung.

### 4.1 Datenumfang (minimal)

| Datenart                  | Quelle(n)                                        | Gespeichert als                                 | Erstabgleich | Zweck                |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------- | ------------ | -------------------- |
| Workout (Ausdauer)        | HealthKit, Health Connect, Strava, Garmin        | Tagebuch (`session_logs` + `cardio_logs`)       | 14 Tage      | Tagebuch             |
| Durchschnittspuls Workout | dieselben                                        | `cardio_logs.avg_hr_bpm` (neu)                  | mit Workout  | Anzeige              |
| Ruhepuls                  | HealthKit, Health Connect, Garmin                | `daily_metrics.resting_hr_bpm`                  | 28 Tage      | Readiness            |
| HRV                       | HealthKit (SDNN), Health Connect (RMSSD), Garmin | `daily_metrics.hrv_ms` + `hrv_method`           | 28 Tage      | Readiness            |
| Schlafdauer               | HealthKit, Health Connect, Garmin                | `daily_metrics.sleep_min`                       | 28 Tage      | Readiness            |
| Gewicht                   | Withings, HealthKit, Health Connect              | `body_metrics.weight_kg` + `weight_source`      | 14 Tage¹     | wie heute            |
| Körperfett                | Withings, HealthKit, Health Connect              | `body_metrics.body_fat_pct` + `body_fat_source` | 14 Tage¹     | nur Anzeige (WE-G17) |

¹ Auf Wunsch 90 Tage (WE-G19). 28 Tage Tageswerte, damit Readiness sofort eine Basis hat (K7).

- **Workout-Arten:** nur `run`, `walk` (inkl. Wandern), `bike` (inkl. Indoor-Rad), `swim`. Kraft, Yoga, HIIT usw.
  werden nicht importiert (WE-G4). Zuordnung in `WEARABLE_ACTIVITY_MAP`; unbekannt → übersprungen.
- **Übersprungene Datensätze** speichern wir nur mit ID und Status (keine Art, Zeit, Dauer).
- **Strava-Antwort:** Zod-`pick` beim Einlesen auf die Felder oben; Polyline, Titel, Beschreibung, Fotos, Ausrüstung
  werden vor jeder Verarbeitung verworfen (Test: Polyline nie in DB oder Log).
- **Health Connect Puls:** nur der Aggregatwert (`HeartRateRecord.BPM_AVG` über das Workout), nie die Rohreihe.
- **Aufbewahrung:** `daily_metrics` 12 Monate, danach automatisch gelöscht (Workflow, WE-G23). Readiness braucht nur
  35 Tage.

### 4.2 Plausibilität

- Workouts: Grenzen wie `cardio_logs` (1 min–12 h, ≤ 500 km, ≤ 10.000 Hm), Tempo-Warnung nach
  `CARDIO_PLAUSIBILITY_KMH`. Unter 1 min → übersprungen.
- Puls Workout 30–230 bpm, Ruhepuls 25–150 bpm, HRV 5–300 ms, Schlaf 0–1.080 min. Außerhalb → verworfen.
- Gewicht und Körperfett wie `body_metrics`.

### 4.3 Zeitzone und Tag

- **Tag eines Workouts** = lokales Datum des Starts. Zeitpunkt immer aus UTC: Strava `start_date` (UTC); aus
  `start_date_local` **nur das Datum** (es trägt fälschlich ein „Z“). HealthKit/Health Connect mit Zeitversatz im
  Datensatz, Garmin `startTimeOffsetInSeconds`, Withings `timezone`.
- **Fenster** wie `save_session_log`: Europe/Berlin heute − 14 … heute + 1 Tag. Ein Import mit lokalem Datum
  außerhalb wird übersprungen (Status `skipped`).
- **Schlaf** zählt für den Morgen des Aufwachens (Hauptschlaf mit Ende zwischen 03:00 und 14:00 Uhr lokal).
- **Waage:** mehrere Messungen am Tag → erste Messung des lokalen Tages (morgens am vergleichbarsten,
  PRODUKTENTSCHEIDUNG).

### 4.4 Duplikat-Erkennung (Kern von WE1)

**Stufe 1 – gleicher Datensatz:** `(user_id, provider, external_id)` eindeutig in `wearable_imports`, idempotent.
**Gelöscht bleibt gelöscht:** Löscht die Person einen importierten Eintrag (Tagebuch oder Waagen-Wert), wird der Import
`deleted_by_user` (Trigger) und nie wieder angelegt.

**Stufe 2 – dasselbe Training aus zwei Quellen:**

- Herkunfts-Filter zuerst: Datensätze in HealthKit/Health Connect, deren Ursprung eine **direkt verbundene** Quelle
  ist (Strava-, Garmin-Connect-, Withings-App; `sourceRevision`/`dataOrigin`), werden übersprungen.
- Vergleich mit allen Tagebuch-Einträgen ±1 Tag (alle Quellen, auch `manual`, `gps`, `gpx_import`):
  - gleiche Art (Wandern = Gehen, Indoor-Rad = Rad),
  - **mit Startzeit auf beiden Seiten:** Überlappung ≥ 50 % der kürzeren Dauer **oder** Start ≤ 10 min auseinander,
  - **ohne Startzeit:** gleicher Tag und Dauer ±20 %.
- Treffer → kein neuer Eintrag, Status `duplicate`. Der vorhandene Eintrag wird **nie überschrieben**, auch nicht mit
  Puls (WE-G6).
- Unsicher (gleicher Tag, gleiche Art, Dauer ±20–40 %) → `needs_review`: Karte „Schon eingetragen?“ mit „Ist
  dieselbe“ / „Zusätzlich eintragen“.

**Stufe 3 – Zuordnung zum Plan** (gleiche Regeln wie `save_session_log`, S12):

- Nur eine geplante Ausdauer-Einheit gleicher Art am selben Tag, **ohne Eintrag**, nicht gestrichen, im
  Datumsfenster der ISO-Woche ± 1 Tag. Erholungs- und Einstiegswochen sind erlaubt (wie Handeingabe).
- Dann zählt der Import automatisch dazu, Hinweis „Zu ‚Lockerer Dauerlauf‘ gezählt – Rückgängig“ (WE-G13). Sonst
  **freie Einheit** (A1b). Für die 10-%-Regel gilt `min(geplant, eingetragen)`; freie Einheiten zählen nicht.
- Eigenes Limit `WEARABLE_IMPORT_LIMITS.perDay = 30` neue Einträge je Person und Tag; **nicht** im A1b-Tageslimit
  (10). PRODUKTENTSCHEIDUNG.

**Änderungen beim Anbieter (S4):** Ein Update („Art/Dauer in Strava geändert“) ändert einen bestehenden Eintrag
**nicht** – Handbearbeitung gewinnt, die App bleibt vorhersehbar. Ein `delete` beim Anbieter zeigt die Karte „In
Strava gelöscht – hier auch löschen?“. Verlangt das Strava API Agreement die Löschung (VOR BAU PRÜFEN), löschen wir
ohne Frage. Dafür ist `source = 'strava'` gezielt löschbar (`delete_wearable_data`).

**Tests (Pflicht):** Mitternacht, Zeitumstellung, Reise („Workout in New York 23:30 Ortszeit am Tag 14“, „Tokio 07:00
am Tag 15, in Berlin noch Tag 14“), gleiche Einheit aus drei Quellen, manueller Eintrag ohne Startzeit, zwei echte
Läufe am selben Tag (dürfen nicht verschmelzen), Import nach Löschen, gestrichene Einheit, schon belegte Einheit,
Eigenschaftstest „Reihenfolge der Quellen ändert die Anzahl Einträge nicht“.

### 4.5 Readiness (Tagesform) – Signal

Readiness ist nur ein **Signal**, das ein Angebot auslösen kann (4.6). Grundsatz: Jede Person wird nur mit sich
selbst verglichen. Quellen: Plews DJ et al., Eur J Appl Physiol 2012;112:3729–3741 und Sports Med 2013;43(9):773–781
(lnRMSSD, kleinste bedeutsame Änderung); Buchheit M, Front Physiol 2014;5:73 (Ruhepuls und HRV); Kiviniemi AM et al.,
Eur J Appl Physiol 2007;101:743–751 (Tageswert gegen persönliches Band aus Tageswerten).

**Quellen-Schlüssel (B7):** `source_key` = Anbieter + App/Gerät (bei HealthKit/Health Connect: Bundle bzw. Paket der
schreibenden App und Gerätemodell). Je Messwert und Tag zählt **eine** Quelle in fester Rangfolge:

1. direkter Anbieter (Garmin) vor HealthKit/Health Connect,
2. innerhalb davon der `source_key` mit den meisten Tagen in den letzten 28 Tagen (Gleichstand: alphabetisch).

Die **Basis** stammt nur aus Werten desselben `source_key` und derselben HRV-Messart. Wechselt das Gerät, beginnt die
Basis neu („Wir lernen deine Werte mit dem neuen Gerät“).

**Schlaf:** nur Phasen „schlafend“ (HealthKit `asleepCore/Deep/REM/Unspecified`, Health Connect `SLEEPING`, `LIGHT`,
`DEEP`, `REM`), nie „im Bett“ oder „wach“. Überlappende Intervalle der gewählten Quelle werden zusammengeführt.

**HRV:** Apple liefert **SDNN** als Stichprobe zu beliebigen Zeiten; wir nehmen nur Werte **im Hauptschlaf-Fenster**
(sonst kein HRV-Wert für den Tag). Health Connect/Garmin liefern **RMSSD**. Gerechnet wird mit ln(HRV), verglichen nur
innerhalb derselben Messart.

**Basis und z-Wert (S7 a/b):** Tageswert gegen Mittelwert und SD der **Tageswerte** der letzten 28 Tage vor heute
(Kiviniemi 2007), mindestens 14 Werte. SD-Untergrenzen: Ruhepuls 2 bpm, ln(HRV) 0,03 (≈ 3 %). PRODUKTENTSCHEIDUNG.
Ein rollierendes 7-Tage-Mittel (Plews 2013) ist die Alternative für die Fachprüfung; dann aber gegen die SD der
rollierenden Mittel, nie gemischt.

**Ruhepuls von Hand** (`body_metrics.resting_heart_rate_bpm`, Onboarding) wird ignoriert (K4).

| Baustein              | Regel (z = Abstand zur Basis in SD)                                                 | Punkte |
| --------------------- | ----------------------------------------------------------------------------------- | ------ |
| HRV (heute)           | z ≤ −1,0                                                                            | −2     |
|                       | −1,0 < z ≤ −0,5                                                                     | −1     |
| Ruhepuls (heute)      | z ≥ +1,0 **und** mindestens +3 bpm                                                  | −2     |
|                       | +0,5 ≤ z < +1,0 **und** mindestens +2 bpm                                           | −1     |
| Schlaf (letzte Nacht) | unter 6 h (unter 18 Jahren: unter 7 h)                                              | −2     |
|                       | 6 bis unter 7 h (unter 18: 7 bis unter 8 h)                                         | −1     |
| Letzte Belastung      | gestern Einheit mit Anstrengung ≥ 7/10 und ≥ 60 min **oder** 2 Tage in Folge ≥ 7/10 | −1     |
| Selbsteinschätzung    | „Eher schlapp“                                                                      | −2     |

Schlaf: Watson NF et al., Sleep 2015;38(6):843–844 (Erwachsene ≥ 7 h); Paruthi S et al., J Clin Sleep Med
2016;12(6):785–786 (13–18 Jahre 8–10 h). Belastung: Session-RPE nach Foster C et al., J Strength Cond Res
2001;15(1):109–115. Importierte Einheiten haben keine Anstrengung → Karte „Wie anstrengend war es? (0–10)“ am Eintrag;
ohne Angabe zählt die Einheit hier nicht (S7 e). **Bewusst nicht:** ACWR (Impellizzeri FM et al., Int J Sports Physiol
Perform 2020;15(6):907–913). Selbsteinschätzung: Saw AE et al., Br J Sports Med 2016;50:281–291.

**Reihenfolge der Regeln (S7 c), eindeutig:**

1. **Renntag** (Phase 10) → kein Angebot, nur Hinweis.
2. **„Ich fühle mich krank“** → Stufe `rest_suggested` mit festem Satz „Bei Fieber oder Krankheitsgefühl nicht
   trainieren.“ (gilt auch ohne Messwerte).
3. **Messwerte gültig?** Nur wenn mindestens **zwei** der drei Messwerte (HRV, Ruhepuls, Schlaf) mit Basis vorliegen
   **und** kein Flag `medication` oder `medical_clearance_recommended` gesetzt ist (Betablocker u. a. verändern Puls
   und HRV; WE-G25). Sonst zählen Messwerte und Belastung **nicht** (ein einzelner Messwert allein nie).
4. Summe der gültigen Punkte (Messwerte, Belastung, Selbsteinschätzung):
   0 bis −1 → `as_planned`; −2 bis −3 → `lighter`; −4 oder tiefer → `rest_suggested`.
5. Ohne gültige Messwerte und ohne Selbsteinschätzung → `unknown` („Noch keine Einschätzung“).
6. Ohne gültige Messwerte höchstens `lighter`.

**Anzeige:** keine Zahl 0–100 (WE-G7). Ampel-Wort plus Gründe („Schlaf kürzer als üblich“). Die Erklärung „So entsteht
deine Tagesform“ zeigt die Tabelle.

**Selbsteinschätzung (B6):** Die Frage „Wie fühlst du dich heute?“ (gut / okay / eher schlapp / krank) ist gratis und
geht auch ohne Uhr. Die Antwort bleibt **nur auf dem Gerät** (`fitnessapp.day-feeling.v1`, nur für heute, am nächsten
Tag verworfen), wird nie gespeichert oder gesendet. Gibt es heute schon einen **Zyklus-Tages-Check** (Phase 9), wird
die Frage nicht gezeigt; das Zyklus-Modul liefert dann sein eigenes Angebot (4.6). Keine Doppelzählung. Diese Prüfung
liegt in der **App-Schicht** (Bildschirm „Heute“), nie in `packages/core/src/readiness/` – sonst bräche der
Strukturtest „kein Import aus `cycle/`“ (N4).

### 4.6 Gemeinsam mit Phase 9: ein „Heute leichter“-Mechanismus (B3, B4)

| Punkt                | Gemeinsame Linie                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code-Ort             | **Nur** `packages/core/src/plan/day-variant.ts`: `lighterSessionVariant(session, rules)` und `combineDayOffers(offers)`. Es gibt **kein** `readinessAdjustment`. Wer zuerst baut (ZY1 oder WE1), legt es an.                                                                                                                                                                                                                       |
| Formel               | **Eine** Konstante `LIGHTER_DAY` (P9 3.3): Kraft je Übung 1 Satz weniger (mindestens 1), RPE-Ziel −1 (mindestens 5), gleiche Gewichte; Ausdauer hart (Intervall, Tempo) → locker; Dauer × 0,8 (Mindestwerte aus `ENDURANCE_SESSION_LIMITS`, sonst 10 min). WE-G21.                                                                                                                                                                 |
| Angebote             | `combineDayOffers([readiness, cycle, ownWish])` ergibt **höchstens eine Stufe** leichter. Readiness `rest_suggested` = gleiches Angebot plus Empfehlung „Verschieben“.                                                                                                                                                                                                                                                             |
| Wahl                 | Drei Knöpfe wie P9: „Heute leichter“ · „Wie geplant“ · „Verschieben“ (bestehende Verschiebe-Logik mit der P9-Regel: keine zwei harten Einheiten an aufeinanderfolgenden Tagen, N4). **Nichts automatisch.**                                                                                                                                                                                                                        |
| Speicherung          | Wahl bis zum Eintrag nur im **geschützten Speicher** des Geräts (wie P9 B1; geleert bei Widerruf, Abmelden, Kontowechsel). Beim Eintrag `session_logs.day_variant = 'lighter'`, **ohne Grund** – geschrieben wird erst, wenn der Knopf „Heute leichter“ **für alle** live ist (N2). Spalte legt ZY2 oder WE2 an (wer zuerst), mit CHECK `day_variant is null or not is_free`: freie Einheiten (auch Importe) tragen nie `lighter`. |
| Wirkung im Tagebuch  | Wortgleich zu P9 6.4: zählt nicht für Steigerungen (Phase 4); für 4b **R1–R4 nicht**, für **R5 als „geschafft“**; Core und SQL gleich (`and sl.day_variant is null`); Wochenauswertung „trainiert“ mit Symbol „leichter“; nie in PDF/Partner-Modus.                                                                                                                                                                                |
| Tapering / Renntag   | Tapering und Spitze: Angebot erlaubt (nur weniger). Renntag: kein Angebot.                                                                                                                                                                                                                                                                                                                                                         |
| Gratis               | Angebot und Knopf **für alle**. Nur das Readiness-Signal braucht Tageswerte (in der Testphase ebenfalls frei).                                                                                                                                                                                                                                                                                                                     |
| Zyklusdaten          | Readiness liest **nie** Zyklusdaten. Strukturtest aus P9 7.6 übernommen: `readiness/` und `wearables/` dürfen `cycle/` nicht importieren; keine Server-Route liest `cycle_*`.                                                                                                                                                                                                                                                      |
| Schlaf-Schnittstelle | `hasWearableSleep(dailyValues, date)` in Core + Hook `useWearableSleep(date)` (liest den Geräte-Zwischenspeicher der `daily_metrics`). P9 blendet damit sein Schlaf-Feld aus (ZY-G5).                                                                                                                                                                                                                                              |
| Häufung              | **Getrennte Zähler** (N3): P8 zählt nur **Readiness-Angebote** (4 von 14 Tagen) und zeigt den Hinweis in der Tagesform-Erklärung ohne Zyklus-Bezug („Fühlst du dich öfter so schlapp? Sprich mit deiner Ärztin oder deinem Arzt.“). Gleicher Wortlaut wie P9 erlaubt, Zustand getrennt; P9 zählt Zyklus-Angebote in `cycle_settings`. Nie aus Messwerten (4.8).                                                                    |
| 4b                   | `readiness_lighter` und Auslöser `wearable_data` bleiben **reserviert**, kein Schreibweg. Kein Eintrag in `plan_adjustments`.                                                                                                                                                                                                                                                                                                      |

Sicherheitsregeln (vorsichtiger Plan, Gesundheits-Check, Alter, 10 %) laufen danach und bleiben streng. Readiness macht
nie härter.

### 4.7 Waagen-Werte (Withings und andere)

- **Herkunft je Feld (B5):** neue Spalten `body_metrics.weight_source` und `body_fat_source` (`manual`, `withings`,
  `apple_health`, `health_connect`). Größe und Ruhepuls bleiben immer `manual`. Ändert die Person ein Feld von Hand,
  wird nur **dieses** Feld `manual`; die Herkunft anderer Felder bleibt (Trigger). Direktes Schreiben durch
  `authenticated` darf nur `manual` setzen.
- **Körperfett aus der Waage nie in der Engine:** `latestBodyValues()` (und damit `isBodyFatUsable`/Katch-McArdle)
  und die SQL-Plausibilität in `save_meal_plan` lesen Körperfett **nur** mit `body_fat_source = 'manual'`. Grund:
  Bioimpedanz-Fehler ±3–5 Prozentpunkte, abhängig vom Wasserhaushalt (Kyle UG et al., Clin Nutr 2004;23:1430–1453).
- **Anzeige Körperfett (WE-G17):** nur im Verlauf unter „Körperdaten“, Hinweis „Schätzwert deiner Waage, schwankt
  stark“; nicht in Übersicht, PDF, Partner-Modus; keine Bewertung, keine Zielwerte (sinngemäß KONZEPT 11.2). Die
  Regel „keine Körperfett-Prozentzahl aus Fotos“ betrifft nur die Foto-KI und bleibt unberührt.
- **Gewicht:** eine Funktion `currentWeight(rows, asOf)` in Core, Gegenstück `private.current_weight(uid, as_of)` in
  SQL, Abgleich in `db-sync.test.ts`. Regel (WE-G18): Gewichte **aller Quellen** der letzten 7 Tage bis `asOf`; bei ≥ 4
  Werten der **Median**, sonst der neueste Wert. Gilt überall, wo heute das neueste Gewicht genutzt wird: Kalorien
  (`targets.ts`), Abnehmziel/BMI/Planbarkeit (`weight-goal-feasibility.ts`), Testmodus (`local-rules.ts`),
  `save_meal_plan`. Z5 („neu planen nur, wenn ein Tag aus dem Planband fällt“) bleibt.
- **Schutzgrenzen unverändert:** `clampCalorieTarget` bleibt die einzige Stelle (Strukturtest K2). Tests: Grenzen
  (Grundumsatz, 25 %, 1 %/Woche) mit Median gegenüber Tageswert; Waagen-Körperfett ändert den Grundumsatz nie.
- **Handeingabe gewinnt:** Steht am Tag schon ein Gewicht von Hand, wird der Waagen-Wert verworfen (`duplicate`).
  Eine spätere Handeingabe überschreibt den Waagen-Wert.
- **Gemeinsame Waage (S9):** nur Withings-Messungen mit `attrib ∈ {0, 2}` (Gerät eindeutig zugeordnet bzw. von Hand in
  der Withings-App); alles andere (z. B. `1` = „Person unklar“) wird übersprungen (Test).
- **4b-Auslöser (S6):** `measurement_updated` aus Waagen-Importen höchstens einmal je Tag: `private.adjust_event_after_write`
  prüft bei `weight_source <> 'manual'`, ob heute schon ein Ereignis dieser Art existiert (pgTAP).
- **Einheit:** Withings liefert `value × 10^unit` (kg bzw. %); Umrechnung in Core mit Tests.

### 4.8 Keine Diagnose, kein Medizinprodukt (S8)

- Software für allgemeines Wohlbefinden und Training ist kein Medizinprodukt, solange sie keine medizinische
  Zweckbestimmung hat (VO (EU) 2017/745 Art. 2 Nr. 1, MDCG 2019-11 Rev. 1).
- **Zweckbestimmung (schriftlich, wie P9 3.6):** „Allgemeine Fitness: Training nach Tagesform aus Schlaf,
  Ruhepuls, HRV, Belastung und Selbsteinschätzung leichter anbieten. Keine Erkennung, Überwachung oder Vorhersage von
  Krankheiten.“
- **Keine** Begriffe wie „Übertraining“, „Erkrankung“, „Herzrhythmusstörung“, „Infekt erkannt“, „Stress-Level“,
  „Schlafstörung“. Neue Wörter in `FORBIDDEN_MEDICAL_TERMS`, Test über alle Texte.
- **Kein Arzt-Hinweis aus Werte-Verläufen.** Der allgemeine Satz „Die Tagesform ist eine Trainingshilfe, keine
  medizinische Bewertung. Fühlst du dich länger nicht wohl, sprich mit einer Ärztin oder einem Arzt.“ steht dauerhaft
  in der Erklärung, ohne Auslöser. Einziger Auslöser: die **Häufung von Readiness-Angeboten** (eigener Zähler, Wortlaut wie P9, N3).
- Rechtliche Einordnung **vor dem öffentlichen Livegang** (Abschnitt 22).

---

## 5. Architektur

### 5.1 Zwei Wege in die Datenbank

```
Gerät (HealthKit / Health Connect / Attrappe)
  └─ App liest (nur Vordergrund) → core: normalize + Vorprüfung
       └─ RPC import_wearable_batch(p jsonb)  ── Server prüft Einwilligung, Premium, Grenzen, Duplikate

Strava / Withings / Garmin  (nur Production)
  └─ OAuth über apps/web: /start → Anbieter → /callback → App → /finalize
  └─ Webhook → Job-Tabelle → Abruf mit Token → core: normalize
       └─ dieselbe Server-Funktion private.import_wearable_batch_for(uid, …) (service_role)
```

- **Eine** Import-Funktion für alle Quellen; die RPC `import_wearable_batch` ruft sie mit `auth.uid()` auf. Regeln in
  Core **und** SQL, Abgleich in `db-sync.test.ts`.
- **Premium-Prüfung auf dem Server** in genau dieser Funktion und in `/start` (`private.has_entitlement_for(uid,
'premium')` + Flag `wearables`). In der Testphase liefert `has_entitlement_for` dank `premium_open` für alle `true`
  (Gründer-Entscheidung 19.10.2026). Das Flag wird **separat gebaut**; Phase 8 legt es nicht an, sondern nutzt es nur.
- **`premium_open` öffnet keine KI (N5):** KI-Funktionen behalten ihre eigenen Flags (z. B. `ai_food_photo`), die
  Monatslimits in `ai_usage` und die Beta-Freischaltung der Foto-KI. Phase 8 ruft selbst keine KI auf. Test in WE2:
  `premium_open` an → Wearable-Import erlaubt, Foto-KI ohne eigenes Flag/Beta weiter gesperrt, Limits unverändert.

### 5.2 OAuth und Tokens (Strava, Withings, Garmin)

**Nur Production (B2):** Alle Routen unter `/api/wearables/*` antworten bei `VERCEL_ENV !== 'production'` sofort mit
`404`, ohne Datenbank-Aufruf (Test). Alle Wearable-Secrets liegen **nur** in der Production-Umgebung von Vercel. In
Vorschau-Links wird ausschließlich mit Attrappen getestet.

**Verbinden, an das Gerät gebunden (B1):**

1. Die App erzeugt einen Zufalls-`verifier` (32 Byte), hält ihn lokal (nativ `expo-secure-store`, Web
   `sessionStorage`) und schickt nur `sha256(verifier)` mit JWT an `POST /start`.
2. Der Server prüft Login, Einwilligung, Premium, Flag. Er speichert in `private.oauth_states`: Hash des `state`,
   `user_id`, Verifier-Hash, PKCE-Verifier (verschlüsselt), Rücksprung-Ziel aus fester Liste, gültig 10 min, einmal
   verwendbar. Antwort: Anbieter-Adresse.
3. `GET /callback` (ohne JWT): prüft `state`, tauscht den Code **sofort** (Withings-Codes gelten nur Sekunden) und legt
   das Ergebnis als **ausstehend** (Tokens verschlüsselt, Anbieter-Personen-ID) mit einem Einmal-Code `handoff` ab.
   Dann Rücksprung in die App (`fitnessapp://geraete?handoff=…` bzw. App-Web-Adresse). Noch keine Verbindung.
4. `POST /finalize` mit JWT, `handoff` und `verifier`: Der Server prüft `sha256(verifier)` = gespeicherter Hash,
   `state.user_id` = JWT-Nutzer, `handoff` unbenutzt und ≤ 10 min. Erst dann entsteht die Verbindung.
5. `unique (provider, provider_user_id)` in `private.wearable_accounts`: Ist das Anbieter-Konto schon mit einem anderen
   Alpha5-Konto verbunden → fester Code „Dieses Strava-Konto ist schon mit einem anderen Alpha5-Konto verbunden“.
6. Die App zeigt „Verbunden als <Vorname/Kürzel>“ (aus der Antwort, nicht gespeichert).
7. Nicht abgeschlossene Ergebnisse werden nach 10 min gelöscht (Anbieter-Widerruf als bestes Bemühen).

Schickt ein Angreifer seinen Link an ein Opfer, scheitert `finalize`: Das Opfer hat den Verifier nicht, der Angreifer
nicht den `handoff`. Tests: fremder `state`, fremdes JWT, falscher Verifier, doppelter `handoff`, abgelaufen.

**Speicherung (S3):** `private.wearable_tokens` (nur `service_role`): `access_token_enc`, `refresh_token_enc`,
`key_id`, `token_version`, `refresh_lock_until`, `expires_at`, `scopes`.

- AES-256-GCM, zufälliger 12-Byte-Nonce je Wert, **AAD = `connection_id|feld|key_id`** (Chiffrate nicht zwischen
  Zeilen oder Feldern tauschbar).
- Schlüssel: `WEARABLE_TOKEN_KEYS` = JSON `{ "<key_id>": "<mind. 64 Zeichen>" }` und `WEARABLE_TOKEN_KEY_CURRENT` =
  aktuelle `key_id`. Je Eintrag Ableitung per HKDF-SHA256 (Salt `alpha5-wearable-tokens`, Info `v1|<key_id>`, 32 Byte).
- **Neu verschlüsseln:** Workflow `wearables-admin` → Aktion `neu_verschluesseln` ruft die Production-Route
  `/api/wearables/admin/rekey` mit `WEARABLES_ADMIN_SECRET` auf. Der Schlüssel liegt **nie** in GitHub.
- Sicherung: Schlüssel zusätzlich im Passwort-Manager der Gründer, nur dort. Verlust = alle verbinden neu.
- Warum nicht Vault: viele Nutzer-Tokens, und Schlüssel und Daten lägen beim selben Dienst. Phase 9 nutzt Vault für
  Zyklusdaten – die DSFA beschreibt beide Modelle nebeneinander (K3).

**Refresh ohne Wettlauf (S2):** RPC `private.wearable_token_lease(connection_id)` setzt `refresh_lock_until = now() +
30 s`, nur wenn frei, und gibt Chiffrate + `token_version` zurück. Nach dem Anbieter-Aufruf speichert
`private.wearable_token_store(connection_id, expected_version, …)` per Compare-and-Swap (`token_version + 1`, Lease
frei). Der neue Token wird **gespeichert, bevor** er benutzt wird. Der Verlierer wartet kurz und liest neu. Refresh
„ungültig“ → `needs_reconnect`, Tokens gelöscht. Test: zwei parallele Läufer gegen eine Anbieter-Attrappe.

**Trennen, Widerruf, Konto löschen (S5):** Route `/disconnect` bzw. `/revoke-all` (JWT) widerruft **synchron vor** dem
Löschen beim Anbieter (Strava `POST /oauth/deauthorize`, bei abgelaufenem Access-Token vorher Refresh; Withings
Notify abbestellen + Widerrufsweg laut Doku; Garmin Registrierung löschen), Zeitlimit 5 s je Anbieter. Die App ruft
`/revoke-all` vor „Konto löschen“ und vor dem Widerruf von `wearable_data` auf. **Rückfall:** Ein Trigger beim Löschen
einer Verbindung legt das verschlüsselte Token **ohne `user_id`**, aber mit `connection_id` und `key_id` (nötig für die AAD, N6) in
`private.wearable_revocation_outbox`; der
Job-Läufer widerruft, Einträge verschwinden spätestens nach 24 h. Importierte Einträge bleiben (WE-G11).

**Logs:** keine Tokens, Codes, Werte, Anbieter-IDs in `console.*` (Test). Fehler nur als feste Codes.

### 5.3 Webhooks (S1, S4)

- **Strava** sendet ohne Signatur. Schutz:
  1. Callback-URL mit **geheimem Pfad-Teil** (`/api/wearables/strava/webhook/<STRAVA_WEBHOOK_PATH_SECRET>`), Vergleich
     in konstanter Zeit; dazu `hub.verify_token` bei der Abo-Bestätigung und Abgleich der `subscription_id`.
  2. Inhalt wird **nie** übernommen; er ist nur ein Anstoß. Daten holen wir selbst mit dem Token der Person.
  3. Jobs eindeutig je `(provider, object_id, aspect_type)`; Abruf bei `create` nur, wenn `object_id` noch nicht in
     `wearable_imports` steht.
  4. Deckel 20 Anstöße je Anbieter-Person und Stunde; globales Budget mit 20 % Reserve für Refresh und Trennen.
  5. Nur Verbindungen mit Status `active`. Antwort immer schnell `200`, ohne Echo (Strava-Vorgabe 2 s); Abruf danach
     (`after()` in Next.js).
  6. `athlete`-Ereignis „authorized: false“ → Verbindung löschen. `update` → nichts (4.4). `delete` → Karte bzw.
     Pflicht-Löschung (4.4).
  7. Optional: Ratenregel in der Vercel-Firewall für den Webhook-Pfad.
- **Withings** (Notify) sendet einen Formular-POST ohne Signatur. Gleiches Prinzip: `callbackurl` mit geheimem Token,
  `userid` nur als Anstoß, eigener Abruf, Deckel je Person.
- **Garmin** (Ping/Pull): nur Abruf-Adressen auf der festen Liste (`apis.garmin.com`), sonst verworfen (SSRF-Schutz).
- **Wiederholung:** Workflow `wearables-sync` (stündlich + per Hand) ruft `/api/wearables/jobs/run` mit
  `WEARABLES_CRON_SECRET` (Vergleich in konstanter Zeit, nur Production). Höchstens 5 Versuche, dann `failed` + Hinweis
  „Synchronisierung hakt – erneut verbinden“.
- **Strava-Limits:** Standard 200 Anfragen/15 min und 2.000/Tag je App, Lese-Limit 100/1.000 (VOR BAU PRÜFEN). Der
  Läufer zählt mit (`X-RateLimit-Usage`) und pausiert vor der Grenze.

### 5.4 Native Health-Anbindung (nur lesen, S13)

- **iOS:** `@kingstinct/react-native-healthkit` (Expo-Plugin) – Auswahl im Bau bestätigen. Entitlement
  `com.apple.developer.healthkit`, nur `NSHealthShareUsageDescription`, kein Schreiben, kein Hintergrund. Typen:
  Workouts, `restingHeartRate`, `heartRateVariabilitySDNN`, `sleepAnalysis`, `bodyMass`, `bodyFatPercentage`. iOS
  verrät nicht, ob Lesen erlaubt wurde – „keine Daten“ ist ein normaler Zustand.
- **Android:** `react-native-health-connect` + `expo-health-connect` – im Bau bestätigen. Nur `READ_EXERCISE`,
  `READ_HEART_RATE` (nur Aggregat), `READ_RESTING_HEART_RATE`, `READ_HEART_RATE_VARIABILITY`, `READ_SLEEP`,
  `READ_WEIGHT`, `READ_BODY_FAT`. Nicht: Hintergrund, `READ_HEALTH_DATA_HISTORY` (28 Tage liegen im Standard-Fenster
  von 30 Tagen). Pflicht: Datenschutz-Begründungsseite (`ACTION_SHOW_PERMISSIONS_RATIONALE`/`VIEW_PERMISSION_USAGE`).
  `minSdkVersion` ggf. 26 (WE-G24).
- **Zuschaltbar:** Die Plugins hängen in `app.config.ts` an der Build-Variable `HEALTH_NATIVE=1`. Der Workflow
  `eas-build` bekommt die Eingabe „Mit Apple Health/Health Connect (ja/nein)“, Standard **nein**. So tragen andere
  Builds (Store-Einreichungen, Tests anderer Phasen) keine Health-Rechte, bis die Store-Unterlagen fertig sind.
- **Adapter** `HealthSource` in `apps/mobile/src/lib/health/`: `health.ios.ts`, `health.android.ts`, `health.fake.ts`
  (Attrappe für Web und Testmodus). Die App-Logik kennt nur die Schnittstelle.
- **Abruf:** beim Öffnen der App und per „Jetzt abgleichen“, höchstens alle 30 min.
- **CI ohne Gerät:** Schritt `native-config-check` in `ci.yml`: `expo prebuild --no-install` für beide Plattformen **in
  beiden Varianten** (mit/ohne `HEALTH_NATIVE`) und Prüfung von `Info.plist`, Entitlements und `AndroidManifest.xml`
  (erwartete und **verbotene** Berechtigungen; ohne Variable keinerlei Health-Einträge).

---

## 6. Etappe WE0 – Plan, Ist-Stand, Grundlagen

- Dieser Plan, Gründer-Entscheidungen, Wächter-Nachprüfung.
- Konten **parallel** anlegen (Vorlaufzeit): Strava-App, Withings-Entwicklerkonto, ggf. Garmin-Antrag (Abschnitt 22).
- Mit Phase 9 abstimmen, wer `plan/day-variant.ts` und `session_logs.day_variant` zuerst baut (4.6).
- _DoD:_ Plan freigegeben, blockierende Fragen beantwortet, `docs/PROMPTS.md` verweist auf den Plan.

## 7. Etappe WE1 – Core: Normalisierung, Duplikate, Tageswerte, Readiness-Signal

**Module:** `packages/core/src/wearables/` (`normalize.ts`, `activity-map.ts`, `dedupe.ts`, `daily.ts`, `sources.ts`,
`scale.ts`, `schema.ts`), `packages/core/src/readiness/` (`baseline.ts`, `signal.ts`, `texts.ts`),
`nutrition/current-weight.ts`; `plan/day-variant.ts`, falls ZY1 noch nicht gemergt ist (dann nach P9 6.3 gebaut).

- Anbieter-Rohdaten → `WearableWorkout`, `WearableDailyValues`, `WearableBodyValues`. Zod-Schemas mit allen Grenzen
  aus 4.2; Strava-`pick`.
- `dedupeWorkouts(...)` → `create | link_planned | duplicate | needs_review | skip` (4.4, inkl. `save_session_log`-Regeln).
- `pickSource` (Rangfolge, B7), `sleepForMorning` (Intervalle zusammenführen, nur „schlafend“), `hrvForDay`
  (Schlaffenster, Messart), `restingHrForDay`, `firstWeighInPerDay`, `withingsMeasure` (`attrib`, Einheit),
  `currentWeight` (4.7), `hasWearableSleep`.
- `readinessBaseline`, `readinessSignal` (Reihenfolge 4.5), Texte mit Textregeln-Test. `latestBodyValues` filtert
  Körperfett auf `manual`.
- Konstanten: `WEARABLE_LIMITS`, `WEARABLE_IMPORT_LIMITS`, `WEARABLE_ACTIVITY_MAP`, `WEARABLE_SOURCE_RANK`,
  `READINESS_BASELINE`, `READINESS_POINTS`, `READINESS_SLEEP_H`, `SCALE_RULES`, `CURRENT_WEIGHT` – mit Quelle.
- **Tests:** alle Fälle aus 4.4; Readiness mit 0/13/14 Basiswerten, SD = 0 (Untergrenze), nur ein Messwert (→ zählt
  nicht), SDNN außerhalb des Schlaffensters, Wechsel SDNN → RMSSD und Gerätewechsel (Basis neu), zwei Quellen gleichzeitig,
  überlappender Schlaf, „im Bett“ ohne „schlafend“, Flag `medication`, krank ohne Messwerte, Renntag, 16 und 80 Jahre,
  Schlaf 0 und 18 h; Monotonie („bessere Werte → nie schlechtere Stufe“); `lighterSessionVariant` nie härter als Plan
  (Eigenschaftstest aus P9); 1 vs. 7 Trainingstage; Withings-Einheiten, `attrib` 0/1/2, **erste Messung um 00:30 am
  Tag der Sommerzeit-Umstellung** (K10); `currentWeight` mit 3/4/7 Werten, Ausreißer; Schutzgrenzen mit Median vs.
  Tageswert; Waagen-Körperfett ändert Grundumsatz nie; Strukturtest „kein Import aus `cycle/`“.
- _DoD:_ CI grün, keine App- oder DB-Änderung.

## 8. Etappe WE2 – Datenbank (nur additiv, RLS, pgTAP)

### 8.1 Aufzählungen

- `consent_type` + `wearable_data`; Text v1 (Abschnitt 17.1) in `consent_documents`.
- `log_source` + `apple_health`, `health_connect`, `strava`, `garmin`.
- Neu: `wearable_provider` (`apple_health`, `health_connect`, `strava`, `withings`, `garmin`),
  `wearable_connection_status` (`active`, `needs_reconnect`, `paused_no_premium`), `wearable_import_status`
  (`created`, `linked_planned`, `duplicate`, `needs_review`, `skipped`, `deleted_by_user`), `hrv_method` (`sdnn`,
  `rmssd`), `body_metric_source` (`manual`, `withings`, `apple_health`, `health_connect`).
- `day_variant` (`lighter`) und `session_logs.day_variant`, falls ZY2 noch nicht gemergt ist (identischer Inhalt wie
  P9 6.4).
- Flags `wearables`, `wearable_strava`, `wearable_withings`, `wearable_garmin` (Seed, aus); Auswahl im Workflow
  `beta-grant` ergänzen. `premium_open` wird separat gebaut (nicht in WE2); falls es in der Auswahl von `beta-grant`
  noch fehlt, ergänzt WE2 nur die Auswahl.

### 8.2 Tabellen

| Tabelle                              | Inhalt                                                                                                            | Zugriff                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `wearable_connections`               | `user_id`, Anbieter, Status, `connected_at`, `last_sync_at`, `last_error_code`, Scopes; **keine** Tokens          | eigene Zeilen lesen; Schreiben nur Server |
| `private.wearable_accounts`          | Verbindung ↔ Anbieter-Personen-ID; `unique (provider, provider_user_id)`                                          | nur `service_role`                        |
| `private.wearable_tokens`            | verschlüsselte Tokens, `token_version`, `refresh_lock_until` (5.2)                                                | nur `service_role`                        |
| `private.oauth_states`               | State-Hash, Verifier-Hash, PKCE, ausstehendes Ergebnis, `handoff`, Ablauf                                         | nur `service_role`                        |
| `private.wearable_sync_jobs`         | Anstöße, eindeutig `(provider, object_id, aspect_type)`, Versuche                                                 | nur `service_role`                        |
| `private.wearable_revocation_outbox` | verschlüsseltes Token **ohne** `user_id`, mit `connection_id` + `key_id` (AAD), Anbieter, Ablauf 24 h             | nur `service_role`                        |
| `wearable_imports`                   | `(user_id, provider, external_id)` eindeutig; Art, Start, Dauer, Status, Verweise (bei `skipped` nur ID + Status) | eigene Zeilen lesen                       |
| `daily_metrics`                      | `(user_id, metric_date, provider, source_key)` eindeutig; `resting_hr_bpm`, `hrv_ms`, `hrv_method`, `sleep_min`   | eigene Zeilen lesen; Schreiben nur RPC    |

Keine Tabelle für die Selbsteinschätzung (bleibt auf dem Gerät, B6).

Änderungen an bestehenden Tabellen (additiv):

- `cardio_logs.avg_hr_bpm smallint` (30–230, nullable). Schreiben nur mit gültiger `wearable_data`-Einwilligung
  (Trigger, auch für Eingabe von Hand, WE-G5).
- `body_metrics.weight_source`, `body_metrics.body_fat_source` (`not null default 'manual'`), `external_ref text`.
  Trigger: `authenticated` darf nur `manual` setzen; ein von Hand geändertes Feld wird `manual`, andere behalten
  ihre Herkunft.

### 8.3 Funktionen

- `import_wearable_batch(p jsonb)` und `private.import_wearable_batch_for(uid, provider, p)`:
  `pg_advisory_xact_lock(hashtext('wearable_import' || uid))` (S11), Einwilligung `wearable_data` (für Körperwerte
  zusätzlich `health_data`) mit `for share`, Flag + Premium, höchstens **100 Datensätze** je Aufruf, Zod-gleiche
  Grenzen, Fenster (4.3), eigenes Limit, Duplikate und Zuordnung (4.4), schreibt `session_logs`/`cardio_logs`,
  `daily_metrics`, `body_metrics`, `wearable_imports`. Antwort je Datensatz mit Code.
- `resolve_wearable_import(p_id, p_action)` (`same`/`add`), `undo_wearable_link(p_id)` (→ freie Einheit),
  `save_cardio_effort(p_log_id, p_rpe)` (Karte „Wie anstrengend?“).
- `delete_wearable_data(p_provider, p_include_logs boolean)` (Tageswerte, Import-Gedächtnis, Waagen-Felder, auf Wunsch
  importierte Einträge einer Quelle).
- `private.current_weight(uid, as_of)` (4.7); `save_meal_plan`-Plausibilität nutzt sie und filtert Körperfett auf
  `manual`.
- `save_session_log` (neueste Fassung Zeile für Zeile) lehnt die neuen Quellen für Handeingaben ab, nimmt
  `day_variant` an; Löschen eines importierten Eintrags → `deleted_by_user`.
- Trigger an `body_metrics`: Waagen-Feld gelöscht/auf `null` → Import `deleted_by_user` (S9); `adjust_event_after_write`
  höchstens 1 Ereignis `measurement_updated` je Tag bei Quelle ≠ `manual` (S6).
- Aufräum-Funktion `private.purge_daily_metrics()` (älter als 12 Monate) für den Workflow `wearables-sync`.

### 8.4 Widerruf, Konto löschen, Export

- **Widerruf `wearable_data`:** App ruft zuerst `/revoke-all` (5.2). Danach löscht die Datenbank `daily_metrics`,
  `wearable_imports`, Puls in `cardio_logs`, Waagen-Felder in `body_metrics` (Quelle ≠ `manual`; leere Zeilen weg),
  Verbindungen und Tokens (Outbox-Rückfall). Importierte Tagebuch-Einträge bleiben, außer „auch importierte Einheiten
  löschen“ (WE-G11).
- **Widerruf `health_data`:** wie heute (alle `body_metrics`, also auch Waagen-Werte).
- **Konto löschen:** App ruft `/revoke-all`, dann Kaskade; Outbox-Rückfall.
- **Export:** `export_my_data()` + `wearable_connections`, **Anbieter-Personen-ID** aus `private.wearable_accounts`
  (K5, ohne Tokens), `wearable_imports`, `daily_metrics`, neue Spalten. `DATA_EXPORT_TABLES` und Testmodus-Export
  anpassen.
- **Partner-Modus:** nichts davon sichtbar.
- **pgTAP:** fremde Zeilen unsichtbar, `anon` nichts, `authenticated` nie an `private.*`, Import ohne Einwilligung/Premium
  scheitert, `premium_open` an/aus (und öffnet keine KI, N5), Outbox-Token nach Löschen der Verbindung
  entschlüsselbar (N6), parallele Importe, Duplikate, „gelöscht bleibt gelöscht“, Herkunft je Feld,
  Körperfett-Filter in `save_meal_plan`, `current_weight` = Core, 1 Ereignis je Tag, Widerruf, Export, Aufräumen,
  Gegenproben.
- `packages/db/database.types.ts` per Workflow `db-types`.
- _DoD:_ wie Abschnitt 15; Migrationen über `db-migrate` nach dem Merge.

## 9. Etappe WE3 – App im Testmodus (mit Attrappen)

- **Mehr → „Verbundene Geräte & Apps“:** Quellen mit Status, „Verbinden“, „Jetzt abgleichen“, „Trennen“ (Rückfrage),
  „Daten dieser Quelle löschen“. Im Web: Apple Health und Health Connect als „nur in der App“ ausgegraut.
- **Einwilligung `wearable_data`** vor der ersten Verbindung; Widerruf unter „Einwilligungen“ (ruft `/revoke-all`).
- **Erklär-Bildschirm vor der System-Abfrage** (welche Daten, wofür, nur lesen).
- **Tagebuch:** Etikett der Herkunft, Durchschnittspuls, „Zu … gezählt – Rückgängig“, „Schon eingetragen?“, „Wie
  anstrengend war es?“, Symbol „leichter“ (ohne Grund).
- **Tagesform-Karte** auf „Training heute“: Ampel-Wort, 1–2 Gründe, „So entsteht deine Tagesform“; bei Angebot die drei
  Knöpfe aus 4.6 über `day-variant.ts`.
- **Frage „Wie fühlst du dich heute?“** (nur Gerät, nicht bei Zyklus-Tages-Check).
- **Attrappe** `health.fake.ts`: „Beispiel-Uhr verbinden“ erzeugt **30 Tage** Ruhepuls/HRV/Schlaf und 6 Workouts
  (eines doppelt zu einer Handeingabe, ein Lauf morgens und abends, eine unbekannte Art). Regler „Heute: schlechte
  Nacht / hoher Ruhepuls“. Attrappen für Strava („Beispiel-Strava“) und Withings („Beispiel-Waage“, 14 Tage Gewicht,
  einmal `attrib = 1`) ohne Server.
- **Zustände:** keine Einwilligung, kein Premium (nach Testphase), keine Daten, `unknown`, Fehler, `needs_reconnect`,
  offline, „Strava-Konto schon mit anderem Konto verbunden“.
- **Playwright** im Testmodus: Verbinden (Attrappe), Duplikat, Rückgängig, Angebot leichter, Widerruf.
- _DoD:_ im Vercel-Vorschau-Link komplett durchklickbar.

## 10. Etappe WE4 – Server-Gerüst und Strava

- `apps/web/src/lib/wearables/` (`crypto.ts`, `oauth.ts`, `lease.ts`, `jobs.ts`, `guard.ts` (Production-Sperre),
  `providers/strava.ts`); Routen `/api/wearables/strava/{start,callback,webhook/[secret],disconnect}`,
  `/api/wearables/{finalize,revoke-all,jobs/run,admin/rekey}`. Muster wie `food-photo`.
- Ablauf 5.2 (Geräte-Bindung), Scope `activity:read_all` (WE-G10). Callback auf der festen Production-Web-Adresse
  (Strava erlaubt eine Callback-Domain). Nativ öffnet die App die Adresse mit `expo-web-browser` (neu, kleines Modul,
  im Abschluss-Build enthalten); im Web dieselbe Seite.
- Webhook 5.3; Abo per Workflow `wearables-admin` (`strava_abo_anlegen`, `strava_abo_status`, `strava_abo_loeschen`).
- **Marke (K8):** offizieller Knopf „Connect with Strava“ unverändert; Logo „Powered by Strava“ dort, wo Strava-Daten
  stehen; am importierten Eintrag Link mit genau dem Text „View on Strava“ (Strava-Vorgabe, englisch) zur Aktivität;
  App-Name ohne „Strava“. **Keine** Strava-Daten an KI oder Dritte (Strava API Agreement – VOR BAU PRÜFEN, auch
  Lösch- und Aufbewahrungspflichten).
- **Tests:** Production-Sperre (Vorschau → 404 ohne DB), Geräte-Bindung (alle Fälle 5.2), Krypto (Rundreise, falscher
  Schlüssel, getauschtes Chiffrat → AAD-Fehler, Rotation), Lease/CAS mit zwei Läufern, Webhook (falscher Pfad, falsche
  `subscription_id`, unbekannte Person, Doppel-Anstoß, Deckel, `authorized: false`, `update`, `delete`), Limit-Pause,
  Log-Test, Polyline nie gespeichert.
- _DoD:_ Handler-Tests grün; echter Test nach Merge (Abschnitt 16).

## 11. Etappe WE5 – Withings (Waagen)

**Direkt oder über Apple Health/Health Connect (WE-G14):**

| Weg                                | Vorteile                                                                                    | Nachteile                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Über Apple Health / Health Connect | kein Withings-Konto nötig, deckt **alle** Waagen ab (Eufy, Garmin Index, Renpho …)          | nur in der App, erst mit Abschluss-Build testbar, nur beim Öffnen |
| Withings Public API direkt         | auch im Web, sofort beim Wiegen (Notify), im Browser testbar, ausdrücklicher Gründer-Wunsch | Entwicklerkonto, Callback, Tokens auf dem Server, nur Withings    |

**Empfehlung:** beides. Withings direkt in WE5, andere Waagen über WE6. Ist beides verbunden, werden Withings-Werte aus
Apple Health/Health Connect übersprungen (Herkunfts-Filter 4.4).

- Routen `/api/wearables/withings/{start,callback,webhook/[secret],disconnect}`, Modul `providers/withings.ts`.
  Geräte-Bindung und Production-Sperre wie WE4.
- OAuth 2.0 (Autorisierung `account.withings.com`, Token über `wbsapi.withings.net/v2/oauth2`), Scope nur
  `user.metrics`. Signatur-Verfahren (Nonce + HMAC-SHA256) laut aktueller Doku (VOR BAU PRÜFEN). Refresh-Token wechselt
  bei jedem Refresh → Lease/CAS (5.2) ist Pflicht.
- **Measure-API** `getmeas`: nur Messarten **1 (Gewicht)** und **6 (Körperfett %)**, `category = 1`, `attrib ∈ {0, 2}`.
  Muskelmasse, Wasser, Knochen werden nicht abgerufen (WE-G16).
- **Notify:** Abo für Gewicht (`appli = 1`) beim Verbinden, Abbestellen beim Trennen; Anstoß → Abruf `startdate…enddate`
  → `firstWeighInPerDay` → Import-Funktion (Quelle `withings`, `external_ref` = Messgruppen-ID).
- Erstabgleich 14 Tage, auf Wunsch 90 Tage (WE-G19).
- Einwilligungen `wearable_data` **und** `health_data`; fehlt `health_data` oder ist eine neue Fassung offen (Phase 6
  v2) → Karte „Für Waagen-Werte brauchen wir deine Einwilligung zu Körperdaten“.
- Anzeige nach 4.7; Etikett „von deiner Withings-Waage“.
- **Tests:** Einheiten, mehrere Messungen/Tag, Zeitzone, Sommerzeit, Handeingabe gewinnt, `attrib`, Notify ohne Token,
  Abruf nach Trennen, Signatur, Refresh-Wechsel, `currentWeight` mit Waagen-Reihe.
- _DoD:_ wie WE4.

## 12. Etappe WE6 – HealthKit und Health Connect (nativ, nur lesen)

- Bibliotheken, Plugins hinter `HEALTH_NATIVE` (5.4), deutsche Begründungstexte in `app.config.ts`,
  Datenschutz-Begründungsseite für Health Connect, Adapter `health.ios.ts`/`health.android.ts`, Eingabe im Workflow
  `eas-build`.
- CI-Schritt `native-config-check` mit beiden Varianten. Web-Export baut weiter.
- Store-Unterlagen als Entwurf im PR: Apple-Prüfnotiz, App-Datenschutz-Angaben, Google-Play „Health apps declaration“,
  Health-Connect-Formular je Datenart, Datenschutzerklärung. Für die APK zum direkten Installieren und für interne
  TestFlight-Tests sind sie noch nicht nötig.
- **Kein eigener Test-Build** (APK-Regel). Getestet wird mit dem Abschluss-Build (Abschnitt 16).
- _DoD:_ CI grün inkl. Prebuild-Prüfung; Attrappe und echter Adapter teilen die Umwandlungs-Tests (Beispiel-Objekte aus
  der Bibliotheks-Doku als Testdaten).

## 13. Etappe WE7 – Angebot „Heute leichter“ aus Readiness (gratis, Gerät)

- Voraussetzung: `plan/day-variant.ts` und `session_logs.day_variant` (aus ZY1/ZY2 oder WE1/WE2). **Keine**
  Abhängigkeit von 4b B/C.
- **Schreib-Sperre (N2):** `day_variant` wird nur geschrieben, wenn der allgemeine Knopf „Heute leichter“ für alle live
  ist (P9 ZY5). Kommt WE7 vor ZY5, baut WE7 diesen Knopf mit (gratis, ohne Tages-Check, über `combineDayOffers` mit
  `ownWish`). Freie Einheiten nie `lighter` (CHECK).
- `combineDayOffers` nimmt das Readiness-Signal auf; Anwendung im Trainingsmodus über `lighterSessionVariant`;
  Entwurf und Warteschlange tragen `day_variant`.
- Kein Eintrag in `plan_adjustments`, kein Server-Weg. `readiness_lighter`/`wearable_data` bleiben reserviert.
- Eigener Häufungs-Zähler nur für Readiness-Angebote (4 von 14 Tagen), Wortlaut wie P9, Zustand getrennt (N3).
- Tests: Core (Kombination Zyklus + Readiness + eigener Wunsch → eine Stufe; Renntag; Tapering), App (Playwright),
  Progression ignoriert `lighter`, 4b R1–R4 ignorieren und R5 zählt `lighter` als geschafft (Core = SQL, N1).
- Nachtrag in `docs/PLAN-PHASE-4B.md`: `readiness_lighter` bleibt reserviert, Begründung.

## 14. Etappe WE8 – Garmin Connect direkt (optional, nach Freigabe durch Garmin)

- Nur bei WE-G1 „ja“ und bewilligtem Antrag. OAuth 2.0 mit PKCE und Geräte-Bindung, Activity- und Health-API
  (Workouts, Ruhepuls, Schlaf, HRV), Ping/Pull mit SSRF-Schutz, Abmelde- und Berechtigungs-Ereignisse.
- **Marke (K8):** angezeigte Garmin-Daten mit Zuordnung „Garmin [Gerätename]“ laut Garmin-Markenregeln.
- Herkunfts-Filter: Garmin-Daten aus Apple Health/Health Connect dann überspringen; Rangfolge 4.5.
- _DoD:_ wie WE4.

---

## 15. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (Anbieter-Formate mit `pick`, Import, Readiness, `day_variant`).
2. Migration nur additiv, mit RLS und pgTAP; Enums gleich in `enums.ts`; `private.*` nie für `authenticated`.
3. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen (sehr leicht/schwer, 16/80 Jahre, 1 vs. 7 Trainingstage,
   Zeitzonen, Sommerzeit, Duplikate aus drei Quellen); Werte mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG
   FACHLICH PRÜFEN“.
4. UI mobil + Web-Export; Playwright im Testmodus mit Attrappen.
5. Lade-, Leer-, Fehler-, Offline-, Einwilligungs-, Premium- und „neu verbinden“-Zustände.
6. Texte auf Deutsch (Ausnahme: Strava-Pflichttext), Textregeln-Test grün (keine Diagnose-Wörter).
7. Kein Token, kein Wert, keine Anbieter-ID in Logs (Test); `/api/wearables/*` außerhalb Production `404` (Test).
8. Doku: dieser Plan (Umsetzungsstand), KONZEPT 4.1/5/9/12/13/14 **und KONZEPT 9 sowie 11.3 ohne „Schritte“** (K2),
   PLAN-PHASE-9 (gemeinsamer Mechanismus), HANDY-ANLEITUNG („Geräte verbinden testen“), SETUP (Strava/Withings/
   Garmin, Secrets-Tabelle, nur Production), `.env.example`.
9. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 16. So testet ihr es am Handy

**WE3 (Vorschau-Link aus dem Pull Request, Testmodus, Inkognito-Tab):**

1. Link öffnen → „Ohne Konto testen“ → Onboarding mit Ziel Ausdauer.
2. Mehr → **Verbundene Geräte & Apps** → „Beispiel-Uhr verbinden“ → Einwilligung lesen → zustimmen.
3. Tagebuch: **4 neue Einträge** mit Etikett „Beispiel-Uhr“ (6 minus 1 Duplikat minus 1 unbekannte Art, K1); der doppelte
   Lauf erscheint nicht zweimal; ein Eintrag zeigt „Zu ‚Lockerer Dauerlauf‘ gezählt – Rückgängig“ → Rückgängig → wird
   freie Einheit.
4. Training heute: Karte **Tagesform** „wie geplant“. Mehr → Beispiel-Uhr → Regler „schlechte Nacht“ und „hoher
   Ruhepuls“ → Karte zeigt „Heute leichter?“ mit Gründen und drei Knöpfen → „Heute leichter“ → Einheit hat weniger Sätze.
5. „Wie fühlst du dich?“ → „krank“ → „Lieber verschieben“ mit Hinweis.
6. „Beispiel-Waage“ verbinden → Gewicht erscheint, ein Wert (fremde Person) fehlt; Körperfett nur im Verlauf mit
   „Schätzwert“.
7. Einwilligungen → `wearable_data` widerrufen → Tageswerte weg, Tagesform „keine Einschätzung“.

**WE4/WE5 (echt, nach dem Merge, in der Production-Web-App):** Strava erlaubt bis zur Prüfung **nur 1 Athleten** –
testet mit genau einem Gründer-Konto (S14 b). Vorschau-Links zeigen hier nur die Attrappe (B2).

1. Web-App öffnen (eure Production-Adresse) → anmelden → Mehr → Verbundene Geräte & Apps → **Strava verbinden** →
   „Autorisieren“ → zurück in der App: „Verbunden als <Vorname>“.
2. In Strava einen kurzen Lauf von Hand anlegen → nach 1–2 min steht er im Tagebuch, mit „View on Strava“.
3. **Withings verbinden** → anmelden → auf die Waage steigen → neues Gewicht unter Körperdaten, Etikett „Withings“.
4. „Trennen“ → Strava → Einstellungen → „Meine Apps“: Alpha5 ist weg.

**Abschluss-Build (einmal am Ende, WE6):**

1. GitHub-App → **Actions → eas-build → Run workflow** → Plattform `android`, Profil `preview`, **Mit Apple
   Health/Health Connect: ja** → Link aus dem Build öffnen → APK installieren. iPhone: Profil `production` → TestFlight
   (SETUP Teil D2).
2. App → Verbundene Geräte & Apps → **Health Connect** bzw. **Apple Health** → Erklär-Bildschirm → System-Abfrage →
   nur die genannten Datenarten erlauben.
3. Prüfen: Workouts der letzten 14 Tage da, keine Doppelten mit Strava, Tagesform zeigt Gründe.

---

## 17. Datenschutz (DSGVO Art. 9) und Sicherheit

### 17.1 Einwilligung `wearable_data` v1 – „Puls- und Gerätedaten“ (Entwurf)

> **Puls- und Gerätedaten.** Wenn du Apple Health, Health Connect, Strava, Withings oder Garmin verbindest, holen wir:
> Trainings (Art, Beginn, Dauer, Strecke, Höhenmeter, durchschnittlicher Puls), Ruhepuls, Herzfrequenzvariabilität
> (HRV), Schlafdauer, Gewicht und Körperfett. Auch einen Puls, den du selbst einträgst, speichern wir nur mit dieser
> Einwilligung. Das sind Gesundheitsdaten. Wir nutzen sie nur, um dein Trainingstagebuch zu füllen, deine Körperdaten
> zu ergänzen und dir an schwächeren Tagen eine leichtere Einheit anzubieten. Beim Verbinden holen wir Trainings und
> Gewicht der letzten 14 Tage (die Waage auf Wunsch 90 Tage) und Tageswerte der letzten 28 Tage, danach nur Neues.
> Tageswerte löschen wir nach 12 Monaten. Deine Antwort auf „Wie fühlst du dich heute?“ bleibt auf deinem Gerät. Wir
> geben nichts an diese Anbieter zurück und nichts an Werbung oder Analyse. Die Zugangsdaten zu den Anbietern speichern
> wir verschlüsselt bei unseren Auftragsverarbeitern Vercel und Supabase (Rechenzentren in der EU). Die Anbieter sind
> eigene Verantwortliche; es gelten zusätzlich ihre Datenschutzbestimmungen. Ohne Premium pausieren Verbindungen;
> Zugangsdaten löschen wir dann nach 30 Tagen. Du kannst jede Verbindung trennen. Widerrufst du diese Einwilligung,
> löschen wir Tageswerte, Puls und Waagen-Werte; deine Tagebuch-Einträge bleiben, wenn du nichts anderes wählst. Die
> Tagesform ist keine medizinische Bewertung.

- Waagen-Werte brauchen zusätzlich `health_data` (gültige Fassung).
- Text in `consent_documents` (Seed) und `consent-texts.ts` gleich (Test).

### 17.2 Weitere Regeln

- RLS auf jeder neuen Tabelle; `private.*` nur `service_role`. Kein Partner-Zugriff.
- Nie in Analytics, Logs, Crash-Reports, PDFs, Partner-Modus, KI (Strava zusätzlich vertraglich ausgeschlossen).
- Tokens verschlüsselt, nur Production, Region `fra1`, keine Log Drains.
- **Vercel-Zugriffsprotokolle** enthalten kurzzeitig den OAuth-`code` der Callback-Adresse (einmalig, kurzlebig) –
  in DSFA und Datenschutzerklärung nennen (K6).
- **DSFA-Ergänzung** „Wearables und Waagen“: Datenarten, Tokens, Readiness, Geräte-Bindung; **beide
  Schlüsselmodelle** (P8 Vercel-Schlüssel für Tokens, P9 Vault für Zyklusdaten) nebeneinander mit Begründung (K3).
- Empfang von den Anbietern: eigene Verantwortliche, kein AVV mit ihnen (juristisch bestätigen lassen).
- **Apple:** HealthKit-Daten nicht für Werbung, nicht an Dritte, nicht in iCloud; Datenschutzerklärung Pflicht;
  sichtbare HealthKit-Funktion (Regeln 2.5.1, 5.1.2, 5.1.3, Stand vor Einreichung prüfen).
- **Google:** Health-Connect-Richtlinie, Play-Erklärung, Begründung je Datenart, Datensicherheits-Abschnitt.

---

## 18. Gratis / Premium und Kosten

### 18.1 Gratis / Premium

**Testphase (Gründer-Entscheidung 19.10.2026):** keine Abos, **alles kostenlos und uneingeschränkt testbar**. Das Flag
`premium_open` lässt `has_entitlement_for` für alle `true` liefern. Die Prüfung auf dem Server (Import-Funktion,
`/start`) wird trotzdem gebaut, damit Phase 7 nur das Flag ausschaltet.

**Nach der Testphase** (Entscheidung mit Phase 7, Vorschlag nach KONZEPT 13):

| Funktion                                              | Gratis | Premium |
| ----------------------------------------------------- | ------ | ------- |
| Geräte/Apps verbinden, Workouts und Waagen-Werte      | Nein   | Ja      |
| Tageswerte und Readiness-Signal                       | Nein   | Ja      |
| Frage „Wie fühlst du dich?“, Angebot „Heute leichter“ | Ja     | Ja      |
| Export und Löschen aller Daten                        | Ja     | Ja      |

Endet Premium später: Verbindungen pausieren (`paused_no_premium`), Bisheriges bleibt sichtbar und löschbar, Tokens
nach 30 Tagen gelöscht.

### 18.2 Kosten

- **Keine KI-Kosten.**
- Strava API kostenlos; Withings Public API für Entwickler kostenlos; Garmin Developer Program für bewilligte
  Unternehmen bisher ohne Lizenzgebühr (Bedingungen vor dem öffentlichen Livegang prüfen).
- Apple Developer (99 USD/Jahr) und Google Play (25 USD einmalig) sind ohnehin nötig (SETUP D2/G).
- Vercel: wenige Funktionsaufrufe je Training/Messung. Supabase: etwa 1 Zeile je Person, Tag und Quelle.
- EAS: **ein** zusätzlicher Build am Ende (Android + iOS), im Gratis-Kontingent (Stand prüfen).
- GitHub Actions: stündlicher `wearables-sync` ≈ 1 min je Lauf (bei privatem Repository Freikontingent prüfen,
  notfalls alle 3 h).

---

## 19. Risiken

1. **Untergeschobener Verbinden-Link** (Daten landen im fremden Konto). _Gegenmittel:_ Geräte-Bindung, `finalize` mit
   JWT und Verifier, Eindeutigkeit je Anbieter-Konto, Anzeige „verbunden als“.
2. **Store-Ablehnung.** _Gegenmittel:_ nur lesen, wenige Datenarten, `HEALTH_NATIVE` erst mit fertigen Unterlagen,
   Prüfnotiz.
3. **Strava: 1 Athlet** bis zur Prüfung; Bedingungen ändern sich. _Gegenmittel:_ Antrag früh, keine KI-Nutzung, Marke.
4. **Garmin-Antrag langsam.** _Gegenmittel:_ Garmin über Apple Health/Health Connect; WE8 optional.
5. **Token-Leck.** _Gegenmittel:_ AES-GCM mit AAD, Schlüssel nur in Vercel Production, `private`-Schema, Log-Test,
   Rotation, Widerruf vor Löschung.
6. **Gefälschte Webhooks / Kontingent leer.** _Gegenmittel:_ geheimer Pfad, nur Anstoß, Deckel, Budget, Eindeutigkeit.
7. **Refresh-Wettlauf** → ständiges „neu verbinden“. _Gegenmittel:_ Lease + Compare-and-Swap, Test.
8. **Doppelte oder fehlende Einträge.** _Gegenmittel:_ Regeln 4.4, „Schon eingetragen?“, Rückgängig, viele Tests.
9. **Falsche Ampel** (Quellen gemischt, „im Bett“ als Schlaf, SDNN tagsüber). _Gegenmittel:_ `source_key`, Rangfolge,
   Schlaffenster, Basis je Gerät.
10. **Readiness als Medizin verstanden.** _Gegenmittel:_ keine Zahl, keine Diagnose-Wörter, kein Arzt-Hinweis aus
    Werten, schriftliche Zweckbestimmung, nur Angebote.
11. **Waagen-Werte verändern Kalorien unerwartet.** _Gegenmittel:_ Körperfett nie in der Engine, Median, Schutzgrenzen
    unverändert, gemeinsame Funktion Core/SQL.
12. **Gewicht anderer Haushaltsmitglieder.** _Gegenmittel:_ `attrib`-Positivliste.
13. **Tägliches Wiegen erhöht Druck** (Essstörungs-Risiko). _Gegenmittel:_ keine Bewertung, keine Serien, Median,
    bestehende Ziel-Regeln.
14. **Rückschluss auf den Zyklus über `day_variant`.** _Gegenmittel:_ Spalte ohne Grund, gemeinsam für Readiness,
    Zyklus und eigenen Wunsch (P9 6.4).
15. **APK erst am Ende** → native Fehler spät. _Gegenmittel:_ Attrappe, Prebuild-Prüfung, Beispiel-Objekte, Puffer
    für eine Korrektur-Runde.

---

## 20. Zeitplan

Laufend: Phase 4b, Pläne zu Phase 6/7/9. Phase 8 hat kaum Code-Konflikte; Abstimmung mit Phase 9 bei `day-variant.ts`
und `day_variant`.

1. **WE0** freigeben. **Parallel ihr:** Strava-App, Withings-Konto, ggf. Garmin-Antrag.
2. **WE1** (Core) – sofort nach Freigabe der blockierenden Fragen.
3. **WE2** (Datenbank) – nach WE1; nicht gleichzeitig mit ZY2 mergen (gleiche Spalte).
4. **WE3** (App, Attrappen) – nach WE2.
5. **WE4** (Strava) und **WE5** (Withings) – nach WE3, sobald die Konten da sind.
6. **WE6** (HealthKit/Health Connect, ohne Build) – nach WE3.
7. **WE7** (Angebot aus Readiness) – nach WE3 und `day-variant.ts`.
8. **Abschluss-Build** (Android + iPhone). **WE8** (Garmin) nur nach Freigabe.

Grobe Größe: 8–9 Pull Requests.

---

## 21. Was wir von euch brauchen (Gründer-Entscheidungen)

Format: _Worum es geht – Warum wir fragen – Empfehlung._ **[WE1]** = muss vor WE1 entschieden sein; **[später]** =
reicht bis zur genannten Etappe.

- **WE-G1 Reihenfolge und Garmin [später, WE8].** – Garmin braucht einen Antrag mit Wochen Vorlauf; Apple Health/Health
  Connect decken Garmin ab. – **Empfehlung:** Reihenfolge WE1–WE7; Garmin direkt später, Antrag jetzt nur, wenn
  Garmin-Nutzer wichtig sind.
- **WE-G2 Gratis/Premium nach der Testphase [später, Phase 7].** – In der Testphase ist alles frei (Entscheidung
  19.10.2026). – **Empfehlung:** danach wie KONZEPT 13 (Verbinden und Tageswerte Premium; Angebot „Heute leichter“
  gratis). Endgültig mit Phase 7.
- **WE-G3 Datenumfang [WE1].** – Mehr Daten = mehr Risiko, kaum Nutzen. – **Empfehlung:** nur die Liste in 4.1.
- **WE-G4 Krafttraining aus der Uhr [WE1].** – Ohne Übungen und Sätze passt es nicht. – **Empfehlung:** nicht
  importieren.
- **WE-G5 Puls auch von Hand [später, WE3].** – Phase 4 hat das verschoben. – **Empfehlung:** ja, optionales Feld, unter
  der Einwilligung „Puls- und Gerätedaten“.
- **WE-G6 Duplikate [WE1].** – Handeingaben sollen nie verschwinden. – **Empfehlung:** Regeln 4.4.
- **WE-G7 Readiness als Zahl [WE1].** – Schein-Genauigkeit. – **Empfehlung:** keine Zahl, Ampel plus Gründe.
- **WE-G8 Selbsteinschätzung [WE1].** – Gesundheitsdatum; Phase 9 hat einen eigenen Tages-Check. – **Empfehlung:**
  ja, gratis, Antwort **nur auf dem Gerät** und nur für heute; nicht zeigen, wenn heute ein Zyklus-Tages-Check
  existiert.
- **WE-G9 Abruf im Hintergrund [später, WE6].** – **Empfehlung:** nein.
- **WE-G10 Strava-Scope [später, WE4].** – **Empfehlung:** `activity:read_all`, klar erklärt.
- **WE-G11 Trennen/Widerruf und importierte Einheiten [später, WE2].** – **Empfehlung:** Trennen: alles bleibt.
  Widerruf: Tageswerte, Puls, Waagen-Werte weg; Einheiten bleiben, außer „auch löschen“. Ausnahme, falls Strava die
  Löschung verlangt (4.4).
- **WE-G12 entfällt** (ersetzt durch WE-G21: kein automatischer Plan-Eingriff, nur Angebot).
- **WE-G13 Zuordnung zur geplanten Einheit [WE1].** – **Empfehlung:** automatisch nach den Regeln 4.4, mit
  „Rückgängig“.
- **WE-G14 Withings direkt und/oder über Health-Apps [später, WE5].** – **Empfehlung:** beides.
- **WE-G15 In Health-Apps schreiben [später].** – **Empfehlung:** nicht in Phase 8.
- **WE-G16 Muskelmasse, Wasser, Knochen [WE1].** – **Empfehlung:** nein.
- **WE-G17 Waagen-Körperfett [WE1].** – Bioimpedanz ist ungenau, Thema heikel. – **Empfehlung:** nur im Verlauf mit
  „Schätzwert“, nie in der Kalorien-Berechnung, keine Bewertung.
- **WE-G18 Gewicht für Kalorien und Ziele [WE1].** – Tageswerte schwanken 1–2 kg. – **Empfehlung:** `currentWeight` mit
  7-Tage-Median bei ≥ 4 Werten (alle Quellen), sonst neuester Wert; überall gleich; Schutzgrenzen unverändert.
- **WE-G19 Verlauf beim Verbinden [später, WE5].** – **Empfehlung:** Workouts/Gewicht 14 Tage, Tageswerte 28 Tage,
  Waage auf Wunsch 90 Tage.
- **WE-G20 Einwilligung [später, WE2].** – **Empfehlung:** eigene `wearable_data` („Puls- und Gerätedaten“, Text 17.1);
  für Waagen zusätzlich `health_data`. Juristische Prüfung vor dem öffentlichen Livegang.
- **WE-G21 Gemeinsame Formel „Heute leichter“ mit Phase 9 [WE1].** – Zwei Formeln würden verwirren. –
  **Empfehlung:** die P9-Werte (`LIGHTER_DAY`: Sätze −1, RPE −1 mindestens 5, gleiche Gewichte, Dauer × 0,8, harte
  Ausdauer → locker), ein Code-Ort, nur Angebot, Tapering erlaubt, Renntag nicht.
- **WE-G22 Gemeinsame Oberfläche Tages-Frage [später, WE3].** – Wer Zyklus-Modul und Uhr nutzt, soll nicht zweimal
  gefragt werden. – **Empfehlung:** P8-Frage ausblenden, wenn heute ein Zyklus-Tages-Check existiert; eine gemeinsame
  Karte erst, wenn beide Module live sind.
- **WE-G23 Aufbewahrung `daily_metrics` [später, WE2].** – Readiness braucht 35 Tage. – **Empfehlung:** 12 Monate
  (Alternative wie P9: 24 Monate).
- **WE-G24 Health-Rechte nur per Build-Variable, `minSdkVersion` [später, WE6].** – Sonst trägt jeder Build Health-Rechte;
  Health Connect braucht ggf. Android 8 (API 26), ältere Handys fielen weg. – **Empfehlung:** `HEALTH_NATIVE` wie 5.4;
  `minSdkVersion` 26 akzeptieren, falls nötig (betrifft sehr wenige Geräte).
- **WE-G25 Readiness bei Medikamenten oder Arzt-Flag [WE1].** – Z. B. Betablocker verändern Puls und HRV. –
  **Empfehlung:** Messwert-Teil dann aus, nur Selbsteinschätzung; die Fachprüfung bestätigt.

---

## 22. Was ihr selbst tun müsst

Alles am Handy im Browser (Chrome oder Safari). Geheime Werte nie in den Chat – nur in Vercel bzw. GitHub eintragen.

**A. Strava-App anlegen (für WE4)**

1. Browser → `strava.com/settings/api`. Lädt die Seite am Handy nicht richtig: Chrome → **⋯** → **Desktop-Website**
   anhaken (Safari: **aA** → **Desktop-Website anfordern**).
2. Mit eurem Strava-Konto anmelden → „Create an App“ → Name „Alpha5“, Kategorie „Training“, Website eure Web-Adresse,
   **Authorization Callback Domain:** eure **Production**-Web-Domain ohne `https://`.
3. Logo hochladen → Speichern → **Client ID** und **Client Secret** in den Passwort-Manager.
4. Bis zur Strava-Prüfung kann sich nur **ein** Konto verbinden. Vor Tests mit mehreren Personen auf derselben Seite
   die Erhöhung beantragen.

**B. Withings-Entwicklerkonto (für WE5)**

1. Browser → `developer.withings.com` → Konto anlegen.
2. Dashboard → „Create an application“ → „Public API integration“ → Name „Alpha5“.
3. **Callback URL:** `https://<eure-production-web-domain>/api/wearables/withings/callback`. Ob die Notify-Adresse auf
   derselben Domain liegen muss und ob mehrere Adressen erlaubt sind, prüfen wir im Bau – der PR sagt euch dann, ob ihr
   eine zweite Adresse eintragen müsst.
4. Speichern → **Client ID** und **Client Secret** in den Passwort-Manager.

**C. Garmin (nur wenn WE-G1 „ja“)**

1. Browser → `developer.garmin.com/gc-developer-program` → „Apply“ → Firmenangaben und Zweck.
2. Auf die Freigabe warten (Wochen).

**D. Geheime Werte in Vercel (Projekt „Web“, nur Production)**

1. `vercel.com` im Browser → Projekt **Web** → **Settings** → **Environment Variables**.
2. Je Wert: „Add New“ → Name → Wert → Umgebung **nur Production** (Preview und Development **nicht** anhaken) → Save:
   - `WEARABLE_TOKEN_KEYS` = `{"k1":"<64 zufällige Zeichen aus dem Passwort-Manager>"}` und `WEARABLE_TOKEN_KEY_CURRENT`
     = `k1` (Schlüssel im Passwort-Manager sichern; geht er verloren, müssen alle neu verbinden),
   - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN` und `STRAVA_WEBHOOK_PATH_SECRET` (je 32
     zufällige Zeichen),
   - `WITHINGS_CLIENT_ID`, `WITHINGS_CLIENT_SECRET`, `WITHINGS_WEBHOOK_PATH_SECRET` (32 zufällige Zeichen),
   - `WEARABLES_CRON_SECRET`, `WEARABLES_ADMIN_SECRET` (je 32 zufällige Zeichen),
   - später `GARMIN_CLIENT_ID`, `GARMIN_CLIENT_SECRET`.
3. **Deployments** → letzter Production-Eintrag → **⋯** → **Redeploy**.

**E. Geheime Werte in GitHub (für die Workflows)**

1. Browser → `github.com/<euer-repo>` → **Settings** → **Secrets and variables** → **Actions** → „New repository
   secret“.
2. Anlegen (gleiche Werte wie in Vercel): `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`,
   `STRAVA_WEBHOOK_PATH_SECRET`, `WEARABLES_CRON_SECRET`, `WEARABLES_ADMIN_SECRET`. **Nicht** den Token-Schlüssel.

**F. Webhook und Flags einschalten (nach dem Merge von WE4 bzw. WE5)**

1. GitHub-App → **Actions → wearables-admin → Run workflow** → Aktion `strava_abo_anlegen`.
2. **Actions → beta-grant → Run workflow** → Aktion `flag_an` → Funktion `premium_open` → **Run workflow** (Testphase:
   alles offen; die Auswahl ergänzt WE2, falls sie fehlt).
3. Genauso je einmal: `flag_an` → `wearables`, dann `flag_an` → `wearable_strava`, dann `flag_an` →
   `wearable_withings`.
4. Prüfen: **Actions → beta-grant → Run workflow** → Aktion `status` → im Lauf stehen die vier Flags auf „an“.

**G. Store-Unterlagen (erst vor Store-Einreichung, nicht für APK/interne Tests)**

1. **Google Play Console** → App → **Richtlinien → App-Inhalte** → „Gesundheits-Apps“ und Health-Connect-Berechtigungen
   (Text kommt mit WE6).
2. **App Store Connect** → App → **App-Datenschutz** → Gesundheit/Fitness prüfen.
3. Datenschutzerklärung um „Puls- und Gerätedaten“ ergänzen (Entwurf kommt mit WE2).

**H. Vor dem öffentlichen Livegang (keine Voraussetzung für Bau und Test)**

1. **Fachprüfung** (Sportwissenschaft/Sportmedizin): Readiness 4.5, gemeinsame Formel 4.6, Schlaf-Grenzen,
   Medikamenten-Regel, Waagen-Regeln 4.7, Texte.
2. **Rechtsprüfung:** Einwilligung `wearable_data`, DSFA-Ergänzung, Datenschutzerklärung, Zweckbestimmung/MDR,
   Strava-/Withings-/Garmin-Bedingungen (inkl. Löschpflichten).
3. **Store-Prüfung:** Apple 2.5.1/5.1.2/5.1.3, Google Health-Connect-Richtlinie.
