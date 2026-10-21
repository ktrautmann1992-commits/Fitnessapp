# Plan Phase 9 – Zyklus-Modul

**Status:** Freigegeben von den Gründern am 21.10.2026 (alle Fragen ZY-G1–G17 wie empfohlen); ZY1–ZY4 umgesetzt
(Abschnitt 19). Vorher: Entwurf zur Freigabe (19.10.2026). Wächter-Prüfung Runde 1 „mit Auflagen“ (B1–B3, S1–S11,
K1–K8 eingearbeitet), **Runde 2 freigabefähig, N1–N3 eingearbeitet** (Abschnitt 0). Die Gründer-Fragen stehen in Abschnitt 17 (ZY-G1 bis ZY-G17).
Umsetzung erst nach Freigabe, je Etappe ein Pull Request mit Wächter-Prüfung.

**Gründer-Entscheidung vom 19.10.2026 (gilt für diesen Plan):** Bis zum Ende der Testphase gibt es **keine Abos** und
**keine Rechtsberatungs-Schritte**. Alles ist kostenlos und uneingeschränkt testbar (Flag `premium_open`). Fach- und
Rechtsprüfungen in diesem Plan sind deshalb Aufgaben **vor dem öffentlichen Livegang** – keine Vorbedingung für Bau
und Test.

**Grundlage:** `CLAUDE.md` (Gesundheitsdaten Art. 9, Sicherheit der Empfehlungen, KI-Grenze, kein Teilen),
`docs/KONZEPT.md` (2, 4.1, 5, 6, 8, 9, 11, 12, 13, 14, 15), `docs/PROMPTS.md` Phase 9, `docs/ERWEITERUNGEN.md` und
`docs/ERWEITERUNGEN-2.md` (keine Zyklus-Themen, nur die Grundregeln „privat, kein Teilen“), `docs/PLAN-PHASE-1.md`
(Abschnitt 5 Einwilligungen, Frage 4 „nur Interesse ja/nein“), `docs/PLAN-PHASE-4B.md` (Regeln R1–R5, reservierter
Typ `readiness_lighter`, Server-Route in `apps/web`), `docs/PLAN-PHASE-10.md` (Tapering, Renntag, Erholung),
`docs/PLAN-PHASE-6.md` (Aufbau und Detailtiefe, Stillzeit, Pille als „Medikament“), `docs/PLAN-PDF-EXPORT.md` (B11
„Zyklusdaten nie“), `docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md` (Day-Swaps „Nur heute“), Code-Stand vom 19.10.2026
(`origin/main`, Commit `201aff9`).

**Parallel in Arbeit:** Pläne zu Phase 7 (Abos, `hasEntitlement()`) und Phase 8 (Wearables, Readiness). Berührungspunkte
stehen in Abschnitt 2c. Was dort entschieden wird, gleichen wir vor ZY1 ab.

---

## 0. Wächter-Prüfung: eingearbeitet

Die Wächter-Prüfung Runde 1 hat drei blockierende Punkte, elf Soll- und acht Kann-Punkte
gefunden; die Nachprüfung (Runde 2) drei Nachträge N1–N3. Alle sind im Plantext umgesetzt:

| Befund                                                                          | Lösung im Plan                                                                                                                                                                                                                                                                                                                                                                                                         | Abschnitt                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **B1** `day_variant` wäre in Phase 9 faktisch ein Zyklus-Datum                  | Knopf **„Heute leichter“ für alle** (gratis, ohne Modul) kommt in ZY5 **zusammen** mit der Spalte; vorher wird `day_variant` nie geschrieben. Tageswahl im **geschützten Speicher** (nicht Day-Swap-Muster), geleert bei Widerruf, Abmelden, Kontowechsel. `apps/web` (4b-Route) darf `day_variant` lesen, DSFA-Zeile Vercel ergänzt. Einwilligungstext und DSFA nennen, was nach dem Widerruf bleibt, mit Begründung. | 3.3, 6.4, 7.1, 7.8, ZY5, G14 |
| **B2** R1/R2/R3/R4 und `isCountingEntry` widersprechen sich, SQL-Spiegel fehlen | Entscheidungstabelle je Verbraucher. **`lighter` zählt nirgends als zählender Eintrag** (wie Erholungswoche), auch nicht für R2/R3/R4; R5 zählt ihn als „geschafft“. SQL-Spiegel `recent_exercise_logs`, `latest_basis` und alle Stellen mit `not sl.is_deload and not sl.is_intro_week` werden in ZY2 angepasst; pgTAP-Gegenprobe, `db-sync.test.ts`.                                                                 | 6.4, 8, 11                   |
| **B3** „Keine Gesundheitsdaten in Logs“ nur für Fehler-Logs abgedeckt           | Pflicht-Prüfliste in ZY2 mit dokumentiertem Ergebnis in SETUP: `log_parameter_max_length`, `log_min_duration_statement`/`log_statement`, `pgaudit`/`auto_explain`, RPC nur per POST (Test), `jsonb_typeof` vor jedem Cast plus äußerer `exception`-Block, pgTAP mit kaputten Werten, kein `console.*` mit Zyklus-Objekten.                                                                                             | 6.3, 7.3, 8                  |
| **S1** MDR: Warnsignale sind mehr als ein PAR-Q                                 | Zweckbestimmung „allgemeine Gesundheitsinformation ohne Krankheitsbezug“; Rückfall-Variante statischer Ratgeber „Wann ärztlich abklären?“ hinter Flag `cycle_warnings`; gilt auch für Store-Text und Landingpage. Prüfung **vor dem öffentlichen Livegang** (Gründer-Entscheidung 19.10.2026, statt „vor ZY3“); in der Testphase nur mit eingeladenen Testerinnen und Testern.                                         | 3.4, 3.6, G17                |
| **S2** Lücken bei den Warnsignalen                                              | Einschalt-Frage „Letzte Periode“; Rückfrage nach 45 Tagen ohne Blutung; Energie-Hinweis W1c auch für Pille/Stillzeit/keine Angabe; Pausen-Bildschirm Schwangerschaft mit festen Sätzen; Zwischenblutung W8 zur Fachprüfung; Hilfetext „stark“; W3/W4 bei hormoneller Verhütung gesondert; W7 um psychische Krisen ergänzt.                                                                                             | 3.2, 3.4                     |
| **S3** Zugriffsgrenze der Verschlüsselung zu eng beschrieben                    | Vollständige Liste (Org-Mitglieder mit SQL-/Vault-Zugriff, Workflows mit DB-Passwort, KI/MCP-Werkzeuge); Regel-Vorschlag für CLAUDE.md; Rollen begrenzen; Schlüssel-Migration idempotent; Rotations-Workflow ohne Ausgabe, nur `main`; Sicherungen/PITR im Widerrufstext.                                                                                                                                              | 7.1, 7.3, 18                 |
| **S4** `service_role` hat über Default Privileges Rechte                        | Tabellen im Schema `private`; `revoke all … from public, anon, authenticated, service_role` für Tabellen, Funktionen, `private.cycle_key`; pgTAP inkl. Vault-Sicht.                                                                                                                                                                                                                                                    | 6.2, 6.3, 7.5                |
| **S5** Mehrere Geräte, Warteschlange, erneute Einwilligung                      | Warteschlangen-Eintrag trägt `consent_granted_at`, Server lehnt ältere ab (fester Code, kein Endlos-Senden); App leert bei fehlender Einwilligung Cache, Warteschlange und Tageswahl beim Start und bei jedem Abgleich; Restrisiko „Gerät offline“ in der DSFA.                                                                                                                                                        | 7.4, 7.8, ZY4                |
| **S6** Hinweis-Zustände sind selbst Zyklusdaten                                 | „Weggetippt am“, Häufungs-Hinweis, Renntag-Hinweis verschlüsselt in `cycle_settings` (geräteübergreifend) bzw. im geschützten Speicher; Widerruf leert sie. Renntag-Hinweis nur im Zyklus-Bildschirm.                                                                                                                                                                                                                  | 3.3, 3.4, 7.4                |
| **S7** Abgrenzung zu Phase 8                                                    | Rangfolge in `combineDayOffers` (Ruhetag/Verschieben vor „leichter“, nie addiert); Readiness liest keine Zyklusdaten, Zyklus schreibt nie in `daily_metrics` (Strukturtest); Zyklus-Schlaf nur im Modul.                                                                                                                                                                                                               | 2c, 3.3, 7.6                 |
| **S8** Modul nach Wechsel auf „männlich“ unerreichbar                           | „Einstellungen → Zyklus“ bleibt sichtbar, solange Einwilligung oder Daten bestehen (Pausieren, Löschen, Beenden, Export); Playwright-Fall.                                                                                                                                                                                                                                                                             | 7.2, 9                       |
| **S9** pgTAP-Liste unvollständig                                                | Zwölf Fälle ergänzt (u. a. gleichzeitiger Widerruf, Cascade, 400 Tage, Rate, Rechte, Fehlertexte, `interval '24 months'`, `day_variant`, Zählspiegel, CHECK Geschlecht, Lesen nach veralteter Einwilligung).                                                                                                                                                                                                           | 7.5                          |
| **S10** Quellen                                                                 | Bruinvels 2016 korrigiert auf PLoS One 11(2):e0149881; Kissow 2022 mit Richtung (leichter Vorteil Follikelphase, schwache Evidenz).                                                                                                                                                                                                                                                                                    | 3.1, 3.4                     |
| **S11** Zeitplan widersprüchlich                                                | Eine Fassung: ZY2 erst, wenn kein anderer Migrations-PR offen ist; Abgleich der Zeitstempel mit Phase 6, 7, 8 ist DoD von ZY2.                                                                                                                                                                                                                                                                                         | 8, 16, G16                   |
| **K1** Begründung Abweichung KONZEPT 13                                         | Tragende Gründe vorn: Sicherheitsfunktion, kein Verkaufshebel für Art-9-Daten. Durch die Testphase (alles offen) zusätzlich vereinfacht.                                                                                                                                                                                                                                                                               | 2b.3, G1                     |
| **K2** Seed `cycle_data` v1 zu vage                                             | v1 wird als gekennzeichneter Entwurf für die Testphase eingespielt; ändert die Rechtsprüfung den Text, kommt v2 per eigener Migration mit Re-Consent.                                                                                                                                                                                                                                                                  | 7.1, 8                       |
| **K3** Bildschirmfoto-Schutz                                                    | Android `FLAG_SECURE`, iPhone Overlay im App-Umschalter für Zyklus-Bildschirme.                                                                                                                                                                                                                                                                                                                                        | 7.4                          |
| **K4** Verlust offline erfasster Einträge im Browser                            | Hinweis im Offline-Zustand und vor dem Verlassen der Seite.                                                                                                                                                                                                                                                                                                                                                            | 7.4, 9.2                     |
| **K5** Verschlüsselungs-Optionen und Leistung                                   | Optionen festgeschrieben, S2K-Kosten und `get_cycle_entries` (400 Tage) in ZY2 gemessen.                                                                                                                                                                                                                                                                                                                               | 7.3, 8                       |
| **K6** „Verschieben“ darf keine härtere Woche erzeugen                          | Nur Verschieben, das laut Phase-4-Regeln keine zwei harten Einheiten zusammenschiebt; Test.                                                                                                                                                                                                                                                                                                                            | 3.3, 11                      |
| **K7** Bezeichnung „Tages-Check“ auf „Heute“                                    | „Heute“ zeigt nur den allgemeinen Knopf „Heute leichter?“; der Tages-Check ist nur im Zyklus-Bereich erreichbar (Kurzweg ohne Zyklus-Wort: „Wie geht’s dir heute?“ nur bei aktivem Modul).                                                                                                                                                                                                                             | 3.7, 9.1                     |
| **K8** Abschnitt 0 füllen                                                       | Diese Tabelle.                                                                                                                                                                                                                                                                                                                                                                                                         | 0                            |
| **N1** (Runde 2) 10-%-Bezug Ausdauer                                            | `lighter` zählt für `enduranceReferenceFromBlock` mit den **tatsächlich trainierten** Minuten (wie heute schon `min(geplant, eingetragen)`); Test: Folgeblock nie über `floor(1,1 × tatsächlich trainiert)`.                                                                                                                                                                                                           | 2c, 6.4, 11                  |
| **N2** (Runde 2) Notrufnummern in W7                                            | Gleiche Bedingung wie KONZEPT 14 / Phase 5 N4: Nummern erst nach Prüfung, vor jedem Build mit Supabase-Werten oder Store-Build; bis dahin nur Namen ohne Nummern im Testmodus; Checkliste SETUP Teil K.                                                                                                                                                                                                                | 3.4, 18                      |
| **N3** (Runde 2) Zyklusdaten im Supabase-Modus vor der Rechtsprüfung            | Flag `cycle_module` (Standard aus) + Freischaltung per `beta-grant`; `save_cycle_entry`/`save_cycle_settings` prüfen serverseitig; Testmodus bleibt offen; ohne Freischaltung bleiben Lesen, Export, Löschen; ohne Rechtsprüfung keine Öffnung für alle.                                                                                                                                                               | 3.6, 6.3, 7.2, 16, 17, 18    |
| Gründer-Entscheidung 19.10.2026                                                 | Testphase ohne Abos und Rechtsberatung, alles offen (`premium_open`); Prüfungen „vor dem öffentlichen Livegang“.                                                                                                                                                                                                                                                                                                       | Kopf, 2b.3, 3.6, 18          |

---

## 1. Kurzfassung

Wer möchte, schaltet das **Zyklus-Modul** ein. Es braucht eine **eigene Einwilligung** `cycle_data` (getrennt von
`health_data`). Danach gibt es einen **Tages-Check in wenigen Sekunden**: Blutung (keine bis stark), Energie (1–5),
Beschwerden zum Antippen, optional Schlaf. Dazu einmal einen **Status**: natürlicher Zyklus, hormonelle Verhütung,
Wechseljahre (Übergang oder danach), Stillzeit.

**Was die App daraus macht:**

- **Training nach Tagesform, nicht nach Phase.** Meldest du niedrige Energie oder starke Beschwerden, bietet die App
  für **heute** eine **leichtere Variante** der geplanten Einheit an (ein Satz weniger, Anstrengung etwas niedriger,
  Ausdauer locker und kürzer). Du entscheidest. Es gibt **keine** festen Regeln nach Zyklusphase, nie „heute härter“.
  Den Knopf **„Heute leichter“** bekommen mit Phase 9 **alle** – auch ohne Zyklus-Modul.
- **Ernährungs-Hinweise ohne neue Zahlen:** Eisen-Hinweis bei starker Blutung, Trinken, Hunger-Schwankungen. Die
  Kalorienziele und Schutzgrenzen bleiben unverändert.
- **Warnsignale mit Arzt-Hinweis:** Periode bleibt 3 Monate aus (auch als möglicher Energiemangel, RED-S), sehr
  starke oder lange Blutung, starke Schmerzen in mehreren Zyklen, Blutung nach den Wechseljahren. Abschaltbar per
  Flag `cycle_warnings` (Rückfall: allgemeiner Ratgeber).

**Das Wichtigste vorweg:**

- **Kein Medizinprodukt:** keine Verhütungs- oder Kinderwunsch-Funktion, keine fruchtbaren Tage, kein Eisprung,
  **keine Vorhersage** der nächsten Periode, keine Diagnose. Fester Satz: „Nicht zur Verhütung oder Familienplanung
  geeignet.“
- **Keine Echtzeit-KI.** Alles über feste Regeln in `packages/core`. Zyklusdaten gehen **nie** an Gemini, auch nicht
  an den späteren KI-Coach.
- **Zusätzlich verschlüsselt:** Die Einträge liegen in der Datenbank nur verschlüsselt im Schema `private` (Schlüssel
  im Supabase Vault, Zugriff nur über Server-Funktionen). Auf dem Handy im geschützten Speicher, im Browser nur für den
  Tab. Wer trotzdem mitlesen könnte, steht offen in 7.3.
- **Nie geteilt:** nie im Partner-Modus, nie im PDF, nie in Benachrichtigungstexten, nie in Analytics, Logs oder
  Crash-Reports. Auf dem Bildschirm „Heute“ stehen keine Zyklus-Wörter.
- **Widerruf löscht alles** (Server und Gerät). Export enthält alles.
- **Testphase:** alles offen und kostenlos (`premium_open`). Danach Empfehlung **gratis** (ZY-G1).
- **7 Etappen** (ZY0–ZY6). Präfix „ZY“, weil „Z“ (Ziele), „S/SU“ (Strecken/Supplemente), „W/WP“ (Wettkampf) und
  „A–E“ (Phase 4/4b) schon vergeben sind.

---

## 2. Ist-Stand (geprüft am 19.10.2026)

### 2.1 Was es noch nicht gibt

- **Keine Tabelle** für Zyklusdaten. KONZEPT 12 nennt nur `cycle_entries` („sensibel, verschlüsselt“).
- **Kein Einwilligungstext** `cycle_data`: Der Enum-Wert existiert (`public.consent_type`, Migration
  `20261003120000_phase1_basics.sql`; `CONSENT_TYPES` in `packages/core/src/enums.ts`), aber
  `CURRENT_CONSENT_VERSIONS.cycle_data = null` (`packages/core/src/consent.ts`) und kein Seed in
  `20261003120800_seed_consent_documents.sql`. Damit kann heute niemand `cycle_data` erteilen.
- **Widerruf:** `private.consents_after_revoke()` (zuletzt `20261017210000_revoke_export_union.sql`) enthält nur den
  Platzhalter „cycle_data: … wird dann hier ergänzt“. Export (`public.export_my_data()`, zuletzt
  `20261018200500_live_adjust_revoke_export.sql`) kennt keine Zyklusdaten.
- **Keine Spalten-Verschlüsselung** in der Datenbank: kein `pgsodium`, kein Vault-Zugriff, kein `pgcrypto`-Aufruf in
  `supabase/migrations`. Auch **kein privater Storage-Bucket** (Phase 9 braucht keinen: keine Dateien).
- **Kein Core-Modul** `packages/core/src/cycle/`, keine Konstanten.
- **Keine Tagesform-Erfassung** in der App (weder Energie noch Schlaf). `readiness_lighter` ist in 4b nur reserviert
  (`packages/core/src/adjust/types.ts`).
- **Kein allgemeiner „Heute leichter“-Knopf.** Es gibt nur Day-Swaps (Übung tauschen) und Verschieben.

### 2.2 Was es schon gibt und worauf wir aufbauen

- **Profil:** `profiles.cycle_module_interest` (nur ja/nein, nur bei `sex = 'female'`, CHECK in
  `20261003120050_profiles.sql`, Zod-Regel in `validation.ts`). Kein Gesundheitsdatum (PLAN-PHASE-1 5.5).
- **Gesundheits-Check** (`packages/core/src/health-screening.ts`): Flag `pregnancy` = „schwanger oder in den letzten
  6 Monaten ein Kind geboren“. Nur mit `health_data`. Flag `medication` (ja/nein, umfasst laut PLAN-PHASE-6 K6 auch
  die Pille). Keine Frage zu Zyklus oder Wechseljahren.
- **Schwangerschaft wirkt schon:** vorsichtiger Plan ohne lange Rückenlage, Ausdauer nur Gehen/Ergometer/Schwimmen,
  kein Wettkampfplan, Ernährung `no_targets` ohne Zahlen.
- **Einwilligungs-Mechanik:** versionierte Texte, `has_valid_consent()`, Re-Consent bei neuer Fassung, Widerruf per
  Trigger, Muster einer **eigenen** Art-9-Einwilligung: `ai_food_photo` (`20261016160000_ai_food_photo_enums.sql`).
- **Geschützter Gerätespeicher** (`apps/mobile/src/data/protected-store.ts`): auf iPhone/Android AES-256-GCM mit
  eigenem Schlüssel je Speicher im Keychain/Keystore; im Browser nur `sessionStorage`. Sieben Speicher, z. B.
  `logQueue`, `liveAdjust`. Wir ergänzen drei (Abschnitt 7.4).
- **Testmodus** (`local-backend.ts`): alle Daten auf dem Gerät, im Browser `localStorage` – dokumentierte Ausnahme
  mit Dauerhinweis. Für Zyklusdaten wählen wir im Browser strenger `sessionStorage` (Abschnitt 7.4).
- **Day-Swaps** (`packages/core/src/plan/day-swaps.ts`): „Nur heute“-Logik, aber **unverschlüsselt** gespeichert
  (`fitnessapp.day-swaps.v1`, AsyncStorage bzw. `localStorage`). Für die Tageswahl „leichter“ übernehmen wir nur die
  Prüf-Logik, **nicht** den Speicherort (B1).
- **Zähl-Regel „zählender Eintrag“:** `isCountingEntry()` in `packages/core/src/log/progression.ts`; genutzt von
  `countingEntriesFor()` (`adjust/rules/common.ts`) für R1, R2 und R4; R3 hat eine eigene `counting`-Funktion
  (`plan-rules.ts`). **SQL-Spiegel:** `recent_exercise_logs` (`20261015140000_free_session_logs.sql`, vorher
  `20261006120200_training_log_rpcs.sql`) und `latest_basis` in `20261018200300_live_adjust_rpcs.sql` (Ausdruck
  `not sl.is_free and not sl.is_intro_week and not sl.is_deload`).
- **Live-Anpassung 4b:** R1 schneller steigern, R2 Gewicht senken, R3 Volumen/Erholungswoche, R4 Stagnation, R5
  weniger Tage. Die Route in `apps/web` (Vercel `fra1`) liest `session_logs`.
- **PDF-Export:** Regel B11 „Zyklusdaten nie“ steht schon fest.
- **Lokale Benachrichtigungen** (4b Etappe E, `packages/core/src/notifications.ts`): Muster für eine optionale
  Erinnerung.
- **Kein Analytics-SDK** in den Apps (PLAN-PHASE-6 2.1). Das bleibt so.

### 2.3 Lücken, die Phase 9 schließen muss

| Lücke                                                   | Lösung                                                     | Abschnitt |
| ------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| Kein Einwilligungstext `cycle_data`                     | Text v1 (Entwurf), Seed, Core-Version 1                    | 7.1       |
| Keine Verschlüsselung in der Datenbank                  | `pgcrypto` + Schlüssel im Vault, Schema `private`, nur RPC | 7.3       |
| Widerruf und Export ohne Zyklusdaten                    | Platzhalter in Trigger und Export füllen, pgTAP            | 7.5       |
| Schwangerschaft ohne `health_data` unbekannt            | Eigener Status „schwanger“ im Modul + Direktweg zum Check  | 3.2       |
| Leichterer Tag würde Progression und 4b verfälschen     | `day_variant` zählt nirgends, Core und SQL gleich          | 6.4       |
| `day_variant` wäre allein ein Zyklus-Indiz              | „Heute leichter“ für alle, gleichzeitig mit der Spalte     | 3.3, 6.4  |
| Modul nur bei „weiblich“ angedacht (Onboarding-Frage 1) | Angebot auch bei „divers“ und „keine Angabe“ (ZY-G4)       | 7.2       |

---

## 2b. Umfang und Abgrenzung

### 2b.1 Was in Phase 9 kommt

1. Modul einschalten mit eigener Einwilligung `cycle_data` v1, Status wählen, einmalige Frage „Letzte Periode“,
   jederzeit pausieren oder beenden.
2. **Tages-Check** (Blutung, Energie, Beschwerden, optional Schlaf), auch für die letzten Tage nachtragbar.
3. **Verlauf**: Monatsansicht mit vergangenen Einträgen, erkannte Periodenbeginne, Zykluslängen der Vergangenheit.
   Keine Vorhersage.
4. **„Heute leichter“** für die geplante Einheit: als **Knopf für alle** (auch ohne Modul) und als **Angebot** aus
   Energie und Beschwerden (Abschnitt 3.3).
5. **Hinweise** zu Training, Ernährung (Eisen, Trinken) und Alltag – feste Textbausteine.
6. **Warnsignale** mit Arzt-Hinweis (Abschnitt 3.4), abschaltbar per Flag `cycle_warnings`.
7. Verschlüsselte Speicherung, Export, Widerruf mit Löschung, automatische Löschung alter Einträge (ZY-G8).
8. Optional: neutrale, lokale **Erinnerung** an den Tages-Check (Standard aus, ZY-G7).

### 2b.2 Was NICHT in Phase 9 kommt

| Thema                                                            | Begründung                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Fruchtbare Tage, Eisprung, Verhütung, Kinderwunsch               | Medizinprodukt (MDR, Abschnitt 3.6). Nie.                                              |
| Vorhersage der nächsten Periode                                  | Abgrenzung MDR, Datensparsamkeit, keine Benachrichtigung mit Inhalt (ZY-G3)            |
| Feste Trainingsregeln nach Phase („Lutealphase = weniger“)       | Studienlage trägt das nicht (Abschnitt 3.1), PROMPTS Phase 9                           |
| Kalorien oder Makros nach Phase oder Symptomen ändern            | Schutzgrenzen bleiben unberührt; Zyklusdaten sollen nicht in Essenspläne wandern (6.5) |
| Schwangerschafts-Modus mit eigenen Inhalten                      | braucht Fachperson (PLAN-PHASE-2 Frage 5); bestehende Schwangerschafts-Regeln bleiben  |
| Import/Export Menstruation aus Apple Health / Health Connect     | eigene Datenschutz-Prüfung, Development Build (ZY-G11), frühestens nach Phase 8        |
| KI-Erklärungen, KI-Coach mit Zyklusdaten                         | KONZEPT 15: KI nur Premium; Zyklusdaten nie an Gemini (Datenschutz, AVV)               |
| Partner-Modus, Teilen, Community, Vergleich mit anderen          | CLAUDE.md, KONZEPT 11 – Zyklusdaten ausgeschlossen                                     |
| Freitext-Notizen                                                 | nicht prüfbar, Datensparsamkeit (ZY-G6)                                                |
| Automatische Änderung des Wochenplans oder der Erholungswochen   | Tagesform wirkt nur „heute“; Wochenregeln bleiben bei 4b und der Plan-Engine           |
| Medikamenten-, Schmerzmittel- oder Supplement-Empfehlung (Eisen) | Health Claims, Haftung; nur „ärztlich abklären“; Phase 6 kennt kein Eisen-Präparat     |

### 2b.3 Gratis und Premium (ZY-G1)

- **Testphase (Gründer-Entscheidung 19.10.2026):** keine Abos, alles offen über `premium_open`. Phase 9 braucht
  keine Premium-Prüfung.
- **Nach der Testphase – Empfehlung:** das ganze Zyklus-Modul und der Knopf „Heute leichter“ bleiben **gratis**.
  Gründe: Warnsignale und „leichter an schlechten Tagen“ sind **Sicherheitsfunktionen**, und besonders heikle
  Art-9-Daten sollen **kein Verkaufshebel** sein. Premium bleibt die 4b-Live-Anpassung über Wochen und später
  KI-Erklärungen (ohne Zyklus-Rohdaten). KONZEPT 13 („Zyklus-Anpassung“ unter Premium) wird nach Freigabe angepasst.

---

## 2c. Berührungspunkte mit anderen Phasen

| Phase                        | Berührung                                                                | Regel in Phase 9                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 (Tagebuch, Progression)    | leichterer Tag darf nicht als „geschafft → schwerer“ zählen              | `lighter` ist **kein zählender Eintrag** (wie Erholungswoche), Core und SQL gleich (6.4)                                                                                                                          |
| 4b (Live-Anpassung)          | R1–R5 rechnen aus dem Tagebuch; Route in `apps/web` liest `session_logs` | `lighter` zählt für R1–R4 **nicht**, für R5 als „geschafft“. Zyklus schreibt **nie** in `plan_adjustments`. Route darf `day_variant` lesen (ohne Grund).                                                          |
| 8 (Wearables, Readiness)     | Readiness schlägt „leichter / Ruhetag“ vor; `daily_metrics` hat Schlaf   | **ein** Mechanismus `combineDayOffers`: Ruhetag/Verschieben vor „leichter“, höchstens eine Stufe. Readiness liest **keine** Zyklusdaten, Zyklus schreibt nie in `daily_metrics` (Test).                           |
| 10 (Wettkampf)               | Tapering, Renntag, Erholung nach dem Rennen                              | Am Renntag kein Angebot; Hinweis nur im Zyklus-Bildschirm. Tapering und Spitze: Angebot erlaubt (nur weniger). 10-%-Regel bleibt: `lighter` zählt für den Bezug nur mit den tatsächlich trainierten Minuten (N1). |
| 5 (Ernährung)                | Schwangerschaft `no_targets`, Ratgeber                                   | Nur Hinweise, keine Zielwerte. Eisen-Hinweis passt sich an vegan/vegetarisch an.                                                                                                                                  |
| 6 (Supplemente)              | Stillzeit-Frage, Pille unter „Medikamente“                               | Kein Datenaustausch. Zyklus-Status ersetzt **nicht** den Supplement-Check (getrennte Einwilligungen).                                                                                                             |
| 7 (Abos)                     | `hasEntitlement()`, in der Testphase `premium_open`                      | Phase 9 braucht keine Premium-Prüfung.                                                                                                                                                                            |
| 11 (Partner-Modus, KI-Coach) | Freigaben, Chat                                                          | Zyklus nie freigebbar, nie an den Coach. Strukturtest (7.6).                                                                                                                                                      |
| PDF-Export                   | B11                                                                      | Unverändert: keine Zyklusdaten, auch kein `day_variant`.                                                                                                                                                          |

---

## 3. Fachliche Regeln (Vorschläge – VOR DEM ÖFFENTLICHEN LIVEGANG FACHLICH PRÜFEN)

Alle Zahlen landen in `packages/core/src/constants.ts` (Konstante `CYCLE_RULES`) mit Quellenkommentar bzw.
„PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“. Quellen bekommen in ZY1 DOI oder PMID (vor Übernahme prüfen).

### 3.1 Studienlage: warum symptombasiert statt Phasen-Regeln

- **McNulty KL et al. (2020), Sports Med 50(10):1813–1827** – Meta-Analyse zu Zyklusphase und Leistung bei Frauen mit
  natürlichem Zyklus: Leistung in der frühen Follikelphase im Mittel höchstens **trivial** niedriger; Qualität der
  Studien überwiegend niedrig; große Unterschiede zwischen Personen. Die Autorinnen empfehlen einen **individuellen**
  Ansatz statt allgemeiner Phasen-Regeln.
- **Colenso-Semple LM et al. (2023), Front Sports Act Living 5:1054542** – Übersicht Krafttraining: Die aktuelle
  Evidenz zeigt **keinen** klaren Einfluss der Zyklusphase auf akute Kraftleistung oder auf Anpassungen an
  Krafttraining.
- **Kissow J et al. (2022), Sports Med 52(12):2813–2819** – systematische Übersicht zu phasenbasiertem Krafttraining:
  deutet einen **leichten Vorteil** für betontes Training in der Follikelphase an, aber bei **schwacher** und
  uneinheitlicher Evidenz (wenige, kleine Studien). Für eine feste Regel in der App reicht das nicht.
- **Elliott-Sale KJ et al. (2021), Sports Med 51(5):843–861** – methodische Leitlinie: Viele Studien bestimmen die
  Phasen nicht hormonell; Aussagen über Phasen sind deshalb oft unsicher.
- **Elliott-Sale KJ et al. (2020), Sports Med 50(10):1785–1812** – Meta-Analyse orale Kontrazeptiva: im Mittel
  allenfalls trivial geringere Leistung, ebenfalls niedrige Studienqualität.
- **Mountjoy M et al. (2023), Br J Sports Med 57(17):1073–1097** – IOC-Konsens REDs (relativer Energiemangel im
  Sport): Ausbleiben der Periode ist ein wichtiges Warnsignal; hormonelle Verhütung kann es verdecken.

**Folgerung für die App:**

1. Keine festen Regeln nach Phase. Keine Phasen-Namen als Trainingsanweisung.
2. Was zählt, ist die **gemeldete Tagesform**: Energie, Beschwerden, Blutung. Die gleiche Logik gilt für alle Status.
3. Die App gibt **nur weniger**, nie mehr als der Plan.
4. Warnsignale sind wichtiger als Optimierung: Hier liegt der echte Nutzen (Energiemangel, starke Blutung, Eisen).

### 3.2 Was erfasst wird

**Status (einmal, jederzeit änderbar; Werte `cycle_status`, nur verschlüsselt gespeichert):**

| Wert                     | Text in der App                                        | Wirkung                                                                              |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `natural`                | Natürlicher Zyklus (auch Kupferspirale)                | alle Warnsignale                                                                     |
| `hormonal_contraception` | Hormonelle Verhütung (Pille, Ring, Spirale, …)         | keine Warnung zu Ausbleiben/Länge; W3/W4 mit eigener Schwelle bzw. eigenem Text; W1c |
| `perimenopause`          | Wechseljahre – Übergang                                | Länge-Warnung aus (Unregelmäßigkeit ist dort häufig); Rest aktiv                     |
| `postmenopause`          | Nach den Wechseljahren (seit 12 Monaten keine Periode) | Blutung → Arzt-Hinweis (W6); sonst nur Tagesform                                     |
| `breastfeeding`          | Stillzeit                                              | keine Warnung zu Ausbleiben/Länge; W1c                                               |
| `pregnant`               | Schwanger                                              | Modul pausiert, Pausen-Bildschirm mit festen Sätzen (unten)                          |
| `unspecified`            | Möchte ich nicht sagen                                 | keine Warnung zu Ausbleiben/Länge; Blutungs-Warnungen und W1c aktiv                  |

- **Keine Art der Verhütung** (Präparat, Marke). Wir brauchen nur „hormonell ja/nein“ (ZY-G9).
- **Einmalige Frage beim Einschalten** (nur bei `natural`): „Wann war deine letzte Periode?“ – weniger als 1 Monat /
  1–3 Monate / mehr als 3 Monate / weiß nicht. „Mehr als 3 Monate“ löst W1 (und ggf. W1b) sofort aus. Die Antwort
  liegt verschlüsselt in `cycle_settings`.
- **Rückfrage bei langer Pause:** Nach **45 Tagen** ohne erfasste Blutung (Status `natural`) fragt der
  Zyklus-Bildschirm einmal: „Hattest du seit X Tagen keine Blutung?“ Ein „Ja“ zählt die Tage als vollständig erfasst
  (sonst würde W1 bei Lücken schweigen).
- **Schwangerschaft:**
  - Das Flag `pregnancy` aus dem Gesundheits-Check (falls vorhanden) **pausiert** das Modul ebenfalls.
  - Der **Pausen-Bildschirm** zeigt fest: W7 und „Blutungen oder Schmerzen in der Schwangerschaft immer ärztlich
    abklären lassen.“
  - Status `pregnant` setzt **nicht** das Flag im Gesundheits-Check (getrennte Einwilligungen). Die App bietet einen
    Direktweg in den Gesundheits-Check und zeigt im Trainingsmodus ohne Zyklus-Wort „Bitte Gesundheits-Check
    aktualisieren“. Bis dahin bleibt der Plan unverändert (Restrisiko in der DSFA, 7.8).

**Tages-Check (je Kalendertag höchstens ein Eintrag):**

| Feld        | Werte                                                                                                                                                                                             | Pflicht |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Blutung     | keine · Schmierblutung · leicht · mittel · stark (Hilfetext an „stark“: „z. B. Binde oder Tampon etwa stündlich wechseln, große Klumpen, doppelter Schutz nötig“ – Fachprüfung)                   | nein    |
| Energie     | 1 (sehr wenig) bis 5 (sehr viel)                                                                                                                                                                  | nein    |
| Beschwerden | Unterleibsschmerzen/Krämpfe, Kopfschmerzen, Rückenschmerzen, Brustspannen, Verdauung/Blähungen, Übelkeit, Müdigkeit, Stimmung gedrückt, Hitzewallungen, Schlafprobleme (je „leicht“ oder „stark“) | nein    |
| Schlaf      | 1 (schlecht) bis 5 (sehr gut), **nur** wenn eingeschaltet und kein Wearable-Schlaf da ist (ZY-G5)                                                                                                 | nein    |

- Mindestens ein Feld gefüllt, sonst kein Eintrag. Kein Freitext.
- Nachtragen bis **60 Tage** zurück, nie in die Zukunft (`CYCLE_RULES.backfillDays`, PRODUKTENTSCHEIDUNG).
- Die **Liste der Beschwerden** ist fest (Enum), damit Regeln und Texte prüfbar bleiben.

**Abgeleitet (nur gerechnet, nie gespeichert):**

- **Periodenbeginn:** erster Tag mit Blutung „leicht“ oder stärker nach mindestens **5** Tagen ohne Blutung (oder nur
  Schmierblutung). Schmierblutung allein startet keine Periode.
- **Periodendauer:** zusammenhängende Tage mit Blutung, eine Lücke von höchstens 1 Tag überbrückt.
- **Zykluslänge:** Abstand zweier Periodenbeginne. Gezählt nur, wenn dazwischen Einträge an mindestens 50 % der Tage
  liegen (oder die Rückfrage bestätigt wurde), sonst „unvollständig“, keine Warnung.
- **Tag im Zyklus:** „Tag 12 seit Periodenbeginn“ nur im Zyklus-Bildschirm. Keine Phasen-Namen, keine Prognose.

### 3.3 Anpassung des Trainings: „Heute leichter“

**Zwei Wege, ein Mechanismus (B1):**

1. **Knopf für alle** (ab ZY5, gratis, ohne Modul, ohne Einwilligung `cycle_data`): an der heutigen Trainingskarte
   „Heute leichter?“. Ein eigener Wunsch braucht keinen Grund.
2. **Angebot aus dem Tages-Check** (nur mit aktivem Modul) – derselbe Knopf, nur hervorgehoben.

`day_variant` wird erst geschrieben, wenn Weg 1 live ist. So kann aus der Spalte allein nicht auf das Modul
geschlossen werden.

**Wann die App es anbietet (`CYCLE_RULES.lighterOffer`, PRODUKTENTSCHEIDUNG):**

- Energie **≤ 2**, oder
- eine Beschwerde mit „stark“, oder
- Blutung „stark“ **und** Energie ≤ 3.

Nur, wenn heute eine **geplante** Einheit ansteht, sie noch nicht begonnen ist (kein Entwurf, kein Eintrag) und
**kein Renntag** ist.

**Was „leichter“ heißt (`packages/core/src/plan/day-variant.ts`, gemeinsam mit Phase 8):**

| Art                              | Leichter                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Kraft                            | je Übung **1 Satz weniger** (mindestens 1), `rpe_target − 1` (mindestens 5), gleiche Gewichte |
| Ausdauer hart (Intervall, Tempo) | wird **locker**, Dauer × 0,8 (mindestens `ENDURANCE_SESSION_LIMITS.minSessionMinutes`)        |
| Ausdauer locker, lang, Erholung  | Dauer × 0,8 (mindestens 10 min)                                                               |
| Erholungswoche, Einstiegswoche   | gleiche Regel (sie sind schon leicht; Mindestwerte schützen)                                  |

**Wahl der Person (drei Knöpfe):** „Heute leichter“ · „Wie geplant“ · „Verschieben“. Nichts passiert automatisch.
„Verschieben“ nutzt die Phase-4-Logik nur, wenn sie dabei **keine zwei harten Einheiten** auf aufeinanderfolgende Tage
legt; sonst bietet die App nur „leichter“ oder „wie geplant“ (K6, Test in ZY5).

**`combineDayOffers` (Rangfolge mit Phase 8, S7):** Ruhetag/Verschieben vor „leichter“ vor „wie geplant“. Höchstens
eine Stufe pro Tag, nie addiert (Zyklus + Readiness = trotzdem nur einmal leichter).

**Feste Grenzen:**

- **Nie mehr** als der Plan: keine Steigerung bei hoher Energie, kein „Rekordtag“.
- Sicherheitsregeln (vorsichtiger Plan, RPE-Deckel, Gesundheits-Check, Alter) laufen **danach** und bleiben streng.
- Am **Renntag** (Phase 10): kein Angebot. Ein Hinweis steht **nur im Zyklus-Bildschirm**: „Die Periode am Renntag ist
  häufig; im Mittel ändert sie die Leistung kaum. Plane, was dir guttut.“
- **Häufung:** An 4 oder mehr von 14 Tagen „leichter“ angeboten → einmaliger Hinweis im Zyklus-Bildschirm: „Fühlst du
  dich öfter so schlapp? Sprich mit deiner Ärztin oder deinem Arzt.“ (keine Plan-Änderung).
- **Hinweis-Zustände** (weggetippt, gezeigt am) sind selbst Zyklusdaten: verschlüsselt in `cycle_settings`, mit dem
  Widerruf gelöscht (S6).

**Wochenplan und Erholungswochen bleiben, wie sie sind.** Die Zyklusdaten verschieben keine Erholungswoche und ändern
keine Wochenumfänge. 4b rechnet weiter aus dem Tagebuch – ohne die leichteren Tage (6.4).

### 3.4 Warnsignale mit Arzt-Hinweis

Karten im Zyklus-Bildschirm, nie als Benachrichtigung. Einmal anzeigen, wegtippbar, bei Fortbestehen nach **30 Tagen**
erneut. Ton: ruhig, ohne Diagnose-Wörter. Alle Warnungen hängen am Flag **`cycle_warnings`** (Standard an). Ist es
aus, zeigt die App stattdessen den **statischen Ratgeber „Wann ärztlich abklären?“** mit denselben Schwellen als Text,
ohne persönliche Auslösung (Rückfall-Variante, S1, ZY-G17).

| Nr. | Auslöser (`CYCLE_RULES.warnings`)                                                                                                  | Status                                                                                                          | Text-Kern                                                                                                                                                                                                                                                                                                                                                 | Quelle                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| W1  | **≥ 90 Tage** ohne Periode (seit erfasstem Periodenbeginn mit vollständigen Daten, **oder** Einschalt-Antwort „mehr als 3 Monate“) | `natural`                                                                                                       | „Deine Periode ist seit drei Monaten ausgeblieben. Lass das ärztlich abklären.“ Ob der Satz „Auch eine Schwangerschaft kann der Grund sein.“ dazu darf: Fachprüfung                                                                                                                                                                                       | Definition sekundäre Amenorrhö; IOC REDs                                                                 |
| W1b | wie W1 **und** (Ziel Fettverlust **oder** ≥ 5 Einheiten/Woche **oder** Energie ≤ 2 an ≥ 7 von 14 Tagen)                            | `natural`                                                                                                       | Zusatz: „Viel Training und zu wenig Energie aus dem Essen können dahinterstecken. Sprich das bei der Ärztin oder dem Arzt an.“                                                                                                                                                                                                                            | Mountjoy 2023                                                                                            |
| W1c | Energie ≤ 2 an ≥ 7 von 14 Tagen **und** (Ziel Fettverlust **oder** ≥ 5 Einheiten/Woche) – ohne Amenorrhö-Kriterium                 | `hormonal_contraception`, `breastfeeding`, `unspecified`                                                        | „Du fühlst dich oft energielos und trainierst viel. Zu wenig Energie aus dem Essen kann dahinterstecken – sprich das ärztlich an.“                                                                                                                                                                                                                        | Mountjoy 2023 (Pille verdeckt Ausbleiben)                                                                |
| W2  | Zykluslänge **< 24** oder **> 38** Tage in 2 der letzten 3 vollständigen Zyklen (unter 18: < 21 oder > 45)                         | `natural`                                                                                                       | „Deine Zyklen sind öfter deutlich kürzer oder länger als üblich. Lass das bei Gelegenheit ärztlich abklären.“                                                                                                                                                                                                                                             | Munro MG et al. (2018), FIGO; ACOG (Jugendliche)                                                         |
| W3  | Periode **> 8 Tage**                                                                                                               | alle außer `pregnant`; bei `hormonal_contraception` eigene Schwelle/Text (Fachprüfung: Implantat/Hormonspirale) | „Deine Periode dauert länger als acht Tage. Lass das ärztlich abklären.“                                                                                                                                                                                                                                                                                  | FIGO 2018                                                                                                |
| W4  | Blutung „stark“ an **≥ 3 Tagen** eines Zyklus **oder** in 2 Zyklen nacheinander                                                    | alle außer `pregnant`; `hormonal_contraception` wie W3                                                          | „Starke Blutungen können zu wenig Eisen im Blut führen. Lass deine Blutwerte ärztlich prüfen.“ + Eisen-Hinweis (3.5)                                                                                                                                                                                                                                      | Bruinvels G et al. (2016), PLoS One 11(2):e0149881                                                       |
| W5  | Beschwerde „Unterleibsschmerzen“ **stark** an ≥ 2 Tagen in **2 Zyklen** nacheinander                                               | alle außer `pregnant`                                                                                           | „Starke Regelschmerzen musst du nicht einfach aushalten. Sprich mit deiner Ärztin oder deinem Arzt.“                                                                                                                                                                                                                                                      | PRODUKTENTSCHEIDUNG                                                                                      |
| W6  | Blutung (auch Schmierblutung) bei Status `postmenopause`                                                                           | `postmenopause`                                                                                                 | „Blutungen nach den Wechseljahren solltest du zeitnah ärztlich abklären lassen.“                                                                                                                                                                                                                                                                          | Leitlinien Gynäkologie (Fachprüfung)                                                                     |
| W7  | Fester Satz unter dem Tages-Check und im Pausen-Bildschirm, kein Auslöser                                                          | alle                                                                                                            | „Sehr starke oder plötzliche Schmerzen, sehr starke Blutung mit Schwindel oder Fieber: sofort ärztliche Hilfe. Notruf 112 (Schweiz 144).“ Dazu: „Geht es dir seelisch sehr schlecht? Die Telefonseelsorge ist rund um die Uhr da: 0800 111 0 111“ (AT 142, CH 143). **Nummern nur nach Prüfung (N2):** bis dahin nur Namen ohne Nummern, nur im Testmodus | wie KONZEPT 14 / Phase 5 N4 – Prüfung vor jedem Build mit Supabase-Werten oder Store-Build, SETUP Teil K |
| W8  | **Vorschlag zur Fachprüfung:** Blutung oder Schmierblutung außerhalb der Periode an Tagen in 2 Zyklen nacheinander                 | `natural`                                                                                                       | „Blutungen zwischen den Perioden solltest du ärztlich abklären lassen.“ Weglassen nur mit Begründung der Fachprüfung                                                                                                                                                                                                                                      | FIGO-AUB (Munro 2018)                                                                                    |

- **Stimmung gedrückt – stark** an ≥ 3 von 7 Tagen: zusätzlich der seelische Teil von W7 als Karte.
- **Keine Diagnose-Wörter** in Texten: nicht „Endometriose“, „PCOS“, „Eisenmangel“, „Amenorrhö“, „Störung“,
  „krankhaft“, „Depression“. Test mit Wortliste (Abschnitt 3.7).
- Warnungen W1/W2 erst, wenn die Daten reichen (50 % oder Rückfrage bestätigt, 3.2). Sonst schweigt die App, statt
  falsch zu warnen. Nie eine Entwarnung („alles normal“).
- **W1b/W1c ändern nichts automatisch** an Kalorien oder Plan (ZY-G12). Der Hinweis verlinkt zu „Ziel ändern“ (Erhalt).

### 3.5 Ernährungs-Hinweise (keine neuen Zahlen)

- **Eisen** (bei W4 und an Tagen mit starker Blutung, höchstens einmal je Zyklus): „Eisenreiche Lebensmittel helfen:
  z. B. Hülsenfrüchte, Vollkorn, Hirse, Haferflocken, Fleisch. Vitamin-C-reiche Lebensmittel dazu verbessern die
  Aufnahme. Kaffee und Schwarztee besser nicht direkt zum Essen.“ Vegan/vegetarisch: ohne Fleisch. Link zu passenden
  Rezepten (Filter „eisenreich“, nur wenn die Rezept-Tags das hergeben – sonst ohne Link).
  **Kein Eisen-Präparat**, keine Dosis (Überdosis-Risiko, Health Claims).
- **Trinken** (Blutung mittel/stark oder Beschwerde Kopfschmerz): „Denk ans Trinken – besonders an Trainingstagen.“
- **Hunger** (frei wählbarer Hinweis in der Hilfe, nicht ausgelöst): „Mehr Hunger an manchen Tagen ist normal. Dein
  Plan bleibt; eine zusätzliche Kleinigkeit im Rahmen deines Tagesziels ist in Ordnung.“ Bei „Kalorienzahlen aus“
  ohne Zahlenbezug.
- **Keine Kalorien-Erhöhung nach Phase.** Die Datenlage zum Mehrbedarf in der zweiten Zyklushälfte ist
  uneinheitlich und klein; die Schutzgrenzen aus `clampCalorieTarget` bleiben unverändert.

### 3.6 Abgrenzung Medizinprodukt (MDR)

- **VO (EU) 2017/745 Art. 2 Nr. 1:** Software mit medizinischer Zweckbestimmung (u. a. Diagnose, Überwachung,
  Vorhersage, Prognose von Krankheiten **und Empfängnisregelung**) ist ein Medizinprodukt. Leitlinie **MDCG 2019-11**
  (Qualifizierung von Software, Regel 11).
- **Ehrliche Einordnung (S1):** Anders als der PAR-Q (Vorab-Abfrage zur Trainingssicherheit) werten W1–W8
  **persönliche Verlaufsdaten** gegen Schwellen aus. Das liegt nahe an „Überwachung“ bzw. Triage. Deshalb:
  - **Zweckbestimmung:** „Allgemeine Fitness: Training nach selbst gemeldeter Tagesform anpassen. Die Hinweise sind
    allgemeine Gesundheitsinformationen ohne Krankheitsbezug; sie stellen nichts fest und ersetzen keine ärztliche
    Untersuchung.“
  - Diese Zweckbestimmung gilt für App, Store-Text und Landingpage gleich (Phase 12).
  - **Rückfall:** Flag `cycle_warnings` aus → nur der statische Ratgeber (3.4).
- **Daraus folgt:** keine fruchtbaren Tage, kein Eisprung, keine Verhütung, keine Schwangerschafts-Wahrscheinlichkeit,
  keine Vorhersage der Periode (ZY-G3), keine Aussage „du hast X“.
- **Pflichtsatz** im Modul und im Einwilligungstext: „Das Zyklus-Modul ist kein Medizinprodukt. Es ist nicht zur
  Verhütung oder Familienplanung geeignet und ersetzt keine ärztliche Untersuchung.“
- **Wann geprüft wird (Gründer-Entscheidung 19.10.2026):** Die Rechtsprüfung der Zweckbestimmung und der Warnsignale
  ist Aufgabe **vor dem öffentlichen Livegang**, keine Vorbedingung für Bau und Test. **Im Supabase-Modus** ist das Modul bis dahin nur für Konten offen, die per
  Workflow `beta-grant` freigeschaltet sind (Flag `cycle_module`, Standard aus, N3, 7.2a); der Testmodus bleibt offen.
  **Ohne Rechtsprüfung keine Öffnung für alle.** Ergibt die Prüfung, dass persönliche Warnungen nicht gehen, wird
  `cycle_warnings` ausgeschaltet – ohne Code-Änderung (ZY-G17).

### 3.7 Formulierungsregeln

- Kurze Sätze, „du“, neutral und ohne Scham-Wörter. Keine Geschlechter-Annahme („wenn du deine Periode hast“).
- Erlaubt: „Periode“, „Blutung“, „Beschwerden“, „Energie“, „Wechseljahre“.
- Verboten (Test mit Wortliste in `cycle/texts-de.test.ts`): Eisprung, fruchtbar, Verhütung als Funktion („sicher“,
  „geschützt“), Diagnose-Wörter (3.4), „Hormone ausgleichen“, „Zyklus-Syncing“, „optimal in Phase …“, „PMS-Diät“,
  Heilversprechen. Ausnahme: der Pflichtsatz „nicht zur Verhütung“.
- **Bildschirm „Heute“ ohne Zyklus-Wörter (K7):** Dort gibt es nur den allgemeinen Knopf „Heute leichter?“ (bei einem
  Angebot hervorgehoben mit „passend zu deiner Tagesform“). Bei aktivem Modul zusätzlich eine kleine Karte „Wie geht’s
  dir heute?“ als Kurzweg. Details, Hinweise und Warnungen nur im Zyklus-Bildschirm.

---

## 4. Etappe ZY0 – Plan, Ist-Stand, Grundlagen

- Dieser Plan, Wächter-Prüfung (Runde 1 eingearbeitet), Freigabe durch die Gründer.
- Abgleich mit den Plänen zu Phase 7 und 8 (`combineDayOffers`, Schlaf aus `daily_metrics`, `premium_open`).
- Fach- und Rechtsprüfung laufen **nicht** jetzt, sondern vor dem öffentlichen Livegang (Abschnitt 18).
- **DoD:** Plan freigegeben, Gründer-Fragen beantwortet, Querverweis in `docs/PROMPTS.md`.

---

## 5. Etappe ZY1 – Core: Schemas, Ableitungen, Regeln, Texte

**Ordner** `packages/core/src/cycle/` (reine Funktionen, keine UI, kein Netzwerk):

| Datei                | Inhalt                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas.ts`         | Zod: `cycleSettingsSchema` (Status, letzte Periode beim Einschalten, Schlaf an/aus, Erinnerung, Hinweis-Zustände), `cycleEntrySchema` (Datum, Blutung, Energie, Beschwerden, Schlaf), `.strict()` |
| `periods.ts`         | `derivePeriods(entries, confirmations)` → Periodenbeginne, Dauer, Zykluslängen, Vollständigkeit                                                                                                   |
| `warnings.ts`        | `cycleWarnings(input)` → W1–W8 mit Code, nie Text; Ausgabe leer bei Flag `cycle_warnings` aus                                                                                                     |
| `day-check.ts`       | `cycleDayAssessment(entry, context)` → `{ lighterOffer: boolean, hints: HintCode[] }`                                                                                                             |
| `nutrition-hints.ts` | `cycleNutritionHints(entry, recentEntries, dietType)` → Hinweis-Codes (Eisen, Trinken)                                                                                                            |
| `texts-de.ts`        | Textbausteine je Code (Hinweise, Warnungen, Pflichtsatz, W7, statischer Ratgeber)                                                                                                                 |
| `module-state.ts`    | `cycleModuleState({consent, settings, pregnancyFlag, sex, hasData})` → `hidden` / `off` / `paused` / `paused_pregnancy` / `active`                                                                |

**Gemeinsam mit Phase 8** in `packages/core/src/plan/day-variant.ts` (neu): `lighterSessionVariant(session, rules)`
und `combineDayOffers(offers)` (Rangfolge 3.3).

**Konstanten** in `constants.ts`: `CYCLE_RULES` (Periodenbeginn 5 Tage, Lücke 1 Tag, Vollständigkeit 50 %, Rückfrage
nach 45 Tagen, Längen 24–38 bzw. 21–45 unter 18, W1 90 Tage, W1c 7 von 14, W3 8 Tage, W4 3 Tage, Wiederanzeige 30
Tage, Nachtragen 60 Tage, Angebots-Schwellen, Häufung 4 von 14), `LIGHTER_DAY` (Sätze −1, RPE −1, Minimum 5, Dauer ×
0,8), je mit Quelle bzw. PRODUKTENTSCHEIDUNG.

**Tests (Grenzfälle laut CLAUDE.md):**

- Periodenbeginn: genau 4 vs. 5 Tage Pause, nur Schmierblutung, Lücke 1 vs. 2 Tage, Einträge über Jahreswechsel und
  Zeitumstellung, leere Liste, ein einziger Eintrag, Rückfrage bestätigt vs. nicht.
- Warnungen: jede Schwelle genau und ± 1 Tag; unvollständige Daten → keine W1/W2; Einschalt-Antwort „mehr als 3
  Monate“ ohne Einträge → W1; jeder Status; 16- und 17-Jährige (21–45), 18-Jährige (24–38), 55 Jahre mit `natural`;
  Flag aus → keine Warnung.
- Angebot: Energie 2 vs. 3, „stark“ vs. „leicht“, Blutung stark + Energie 3 vs. 4; Renntag; keine geplante Einheit;
  Einheit schon begonnen; Schwangerschaft (Modul pausiert).
- Leichter: 1 vs. 7 Trainingstage/Woche, Übung mit 1 Satz, `rpe_target` 5, Ausdauer 10 min, Halteübung,
  Körpergewicht, vorsichtiger Plan (Sicherheitsregel bleibt danach), Erholungswoche, Tapering.
- `combineDayOffers`: Zyklus + Readiness → eine Stufe; Ruhetag schlägt leichter.
- **Eigenschaftstest:** Für zufällige Pläne und Einträge gilt immer: leichter ≤ geplant (Sätze, RPE, Minuten); nie
  höher; Ergebnis besteht `applyCurrentSafetyRules`.
- Texte: Wortlisten-Test (3.7), jeder Code hat Text, kein Text enthält Zahlen zu Kalorien.
- Zod: unbekannte Felder abgelehnt, Datum in der Zukunft abgelehnt, leerer Eintrag abgelehnt.
- Lint-Regel bzw. Test: kein `console.*` in `cycle/` und in den Zyklus-Bildschirmen (B3).

**DoD:** Core-Tests grün, Abdeckung der neuen Dateien vollständig, Quellen mit DOI/PMID im Kommentar.

---

## 6. Datenmodell und Zusammenspiel mit dem Plan

### 6.1 Neue Aufzählungen

- `cycle_status`, `cycle_symptom`, Blutungsstufen: nur im Core und **innerhalb** der verschlüsselten Daten (kein
  Postgres-Enum, damit nichts im Klartext steht). Der Server prüft die erlaubten Werte trotzdem (6.3).
- `day_variant` (Postgres-Enum, Klartext): `lighter`. Bewusst **ohne Grund** (Angebot, eigener Wunsch, später
  Readiness).

### 6.2 Neue Tabellen (Etappe ZY2) – im Schema `private`

| Tabelle                  | Spalten                                                                                                                                       | Hinweise                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `private.cycle_settings` | `user_id` (PK, FK `auth.users` on delete cascade), `payload_enc bytea`, `key_version smallint`, `updated_at`                                  | Status, letzte Periode, Schlaf an/aus, Erinnerung, Hinweis-Zustände |
| `private.cycle_entries`  | `id`, `user_id`, `entry_date date`, `payload_enc bytea`, `key_version smallint`, `created_at`, `updated_at`; unique (`user_id`, `entry_date`) | Blutung, Energie, Beschwerden, Schlaf – alles verschlüsselt         |

- **Schema `private`** wird von der REST-Schnittstelle nicht ausgeliefert (S4).
- **Klartext ist nur:** wer, welches Datum, wann geändert. Das Datum verrät, **dass** jemand an dem Tag eingetragen
  hat, nicht was (Restrisiko in der DSFA).
- RLS an, keine Policies, `revoke all … from public, anon, authenticated, service_role` (Muster `delete_my_account`).

### 6.3 Server-Funktionen (`security definer`, `search_path = ''`)

| Funktion                                                                 | Recht               | Prüft                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.save_cycle_entry(p_date, p_payload jsonb, p_consent_granted_at)` | nur `authenticated` | Flag `cycle_module` an **und** Konto per `beta-grant` freigeschaltet (N3, Code `cycle_module_closed`; gilt auch für `save_cycle_settings` und das Erteilen der Einwilligung `cycle_data`); gültige Einwilligung `cycle_data` (Sperre `for share`); Eintrag nicht älter als die aktuelle Einwilligung (S5, Code `cycle_consent_outdated`); Datum nicht in der Zukunft, höchstens 60 Tage zurück (Zeitzone des Profils); Form des JSON (6.3a); mindestens ein Feld; Ratenbegrenzung (z. B. 200 Schreibvorgänge/Tag, Zähler in `private`) |
| `public.delete_cycle_entry(p_date)`                                      | nur `authenticated` | nur eigener Eintrag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `public.get_cycle_entries(p_from, p_to)`                                 | nur `authenticated` | nur `auth.uid()`, Zeitraum ≤ 400 Tage; gibt entschlüsselte Einträge zurück (über TLS an die App)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `public.save_cycle_settings(p_payload jsonb)` / `get_cycle_settings()`   | nur `authenticated` | wie oben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `private.cycle_key(p_version)`                                           | keine API-Rolle     | liest den Schlüssel aus `vault.decrypted_secrets`; nur von den Funktionen oben aufgerufen                                                                                                                                                                                                                                                                                                                                                                                                                                              |

- **Rechte (S4):** Für jede Funktion `revoke all … from public, anon, authenticated, service_role`, danach `grant
execute … to authenticated` nur für die `public.*`-Funktionen. Kein Server-Weg in `apps/web` liest Zyklusdaten.
- **Lesen nach veralteter oder fehlender Einwilligung (S9):** Lesen, Export und Löschen **ja** (Art. 15/17),
  Schreiben **nein**.

**6.3a Eingaben ohne Klartext in Fehlermeldungen (B3):**

- Jeder Wert wird **vor** einem Cast mit `jsonb_typeof` und Bereich geprüft (z. B. Energie `number`, ganzzahlig, 1–5;
  Beschwerde-Code aus fester Liste).
- Die ganze Funktion steckt in einem äußeren Block `exception when others then raise exception
'cycle_payload_invalid'` (ohne `detail`, ohne `hint`, ohne Wert). Sonst kämen Cast-Fehler wie „invalid input
  syntax for type integer: …“ mit dem Eingabewert ins Log und an die App.
- Fehler nur als feste Codes (`cycle_consent_missing`, `cycle_consent_outdated`, `cycle_payload_invalid`,
  `cycle_rate_limited`).
- Aufruf **nur per POST** (supabase-js `rpc` ohne `get: true`), damit keine Parameter in URLs und API-Logs landen.
  Test in der App-Schicht.

### 6.4 Leichterer Tag im Tagebuch: `session_logs.day_variant` (B1, B2)

- Neue Spalte `session_logs.day_variant public.day_variant null` (additiv), CHECK `day_variant is null or not
is_free`. Die App setzt sie, wenn die Einheit als „leichter“ trainiert wurde. **Ohne Grund.**
- **Erst schreiben, wenn der Knopf für alle live ist** (ZY5). Vorher bleibt die Spalte leer.
- **Die Tageswahl** liegt bis zum Eintrag im **geschützten Speicher** `dayVariant` (App verschlüsselt, Browser
  `sessionStorage`), nicht im Day-Swap-Speicher. Geleert bei Widerruf, Abmelden, Kontowechsel; am nächsten Tag
  verworfen. Bei jeder Anzeige gegen die aktuellen Regeln geprüft.
- `exercise_logs` speichert wie immer den Soll-Schnappschuss (`target_sets`, `target_rpe`) – am leichteren Tag also die
  verminderten Werte.

**Entscheidungstabelle „zählt ein `lighter`-Eintrag?“ (B2):**

| Verbraucher                                                                   | Zählt `lighter`?                                     | Begründung                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `nextLoad` / Progression (Phase 4)                                            | nein                                                 | geschaffte Wdh. am leichten Tag sind kein Steigerungs-Signal                                                     |
| Kalibrierung (`calibration.ts`)                                               | nein                                                 | verminderte Soll-Werte verfälschen den Startwert                                                                 |
| Pausen-Uhr / Wiedereinstieg (`isReturn`)                                      | **ja** (als Training)                                | die Person hat trainiert; sonst falscher „Wiedereinstieg“                                                        |
| 10-%-Bezug Ausdauer (`enduranceReferenceFromBlock`, `loggedEnduranceMinutes`) | **ja**, mit den tatsächlich trainierten Minuten (N1) | `min(geplant, eingetragen)` wie bisher; der Folgeblock darf nie über `floor(1,1 × tatsächlich trainiert)` liegen |
| 4b R1 schneller steigern                                                      | nein                                                 | kein Steigerungs-Signal                                                                                          |
| 4b R2 Gewicht senken                                                          | nein                                                 | verminderter `target_rpe` macht R2 empfindlicher; sonst Zyklus-Auslöser in `plan_adjustments`                    |
| 4b R3 Kraft (`session_rpe`) und R3 Ausdauer                                   | nein                                                 | gleicher Grund; die Schutz-Richtung trägt die Person selbst über den Knopf                                       |
| 4b R4 Stagnation                                                              | nein                                                 | wie Progression                                                                                                  |
| 4b R5 weniger Tage (Erfüllungsquote)                                          | **ja** (als „geschafft“)                             | sonst wirkt ein leichter Tag wie ein verpasster                                                                  |
| Wochenauswertung                                                              | **ja** (als „trainiert“)                             | Markierung „leichter“ ohne Grund                                                                                 |
| PDF, Partner-Modus                                                            | nie sichtbar                                         | B11, KONZEPT 11                                                                                                  |

- **Umsetzung im Core:** `isCountingEntry()` schließt `lighter` aus (wie Erholungs- und Einstiegswoche); damit folgen
  R1, R2, R4 automatisch. R3 bekommt dieselbe Bedingung in seiner `counting`-Funktion. R5, `isReturn` und
  Wochenauswertung bekommen je einen Test, dass sie `lighter` **mitzählen**.
- **SQL-Spiegel (ZY2):** `recent_exercise_logs` (aktuelle Fassung aus `20261015140000_free_session_logs.sql`),
  `latest_basis` in Rücknahme und Anwendung (`20261018200300_live_adjust_rpcs.sql`) und **jede** weitere Stelle mit
  `not sl.is_deload and not sl.is_intro_week` bekommen `and sl.day_variant is null`. `db-sync.test.ts` gleicht den
  Ausdruck zwischen Core und SQL ab.
- **`apps/web` darf `day_variant` lesen** (4b-Route auf Vercel `fra1`). Der Strukturtest 7.6 erlaubt das ausdrücklich;
  die DSFA-Zeile „Vercel“ (PLAN-PHASE-4B Abschnitt 9) wird um „Markierung leichter, ohne Grund“ ergänzt.
- **Nach dem Widerruf `cycle_data` bleibt:** die Markierung „leichter“ und die verminderten Soll-Werte im Tagebuch.
  Begründung: Sie beschreiben, was tatsächlich trainiert wurde; ein Zurücksetzen würde die Progression nachträglich
  verändern. Weil derselbe Knopf allen ohne Grund offensteht, ist die Markierung kein Zyklusdatum. Das steht im
  Einwilligungstext (7.1) und in der DSFA (7.8).
- **Restrisiko:** Ein Muster „leichter alle ~28 Tage“ könnte trotzdem auf den Zyklus schließen lassen (EuGH C-184/20).
  Milderung: kein Grund, Knopf für alle, später auch Readiness, kein Zugriff Dritter, DSFA.

### 6.5 Was bewusst **nicht** mit Zyklusdaten verknüpft wird

- `plan_adjustments` (kein Zyklus-Auslöser, keine Regel `cycle_*`; durch die Tabelle 6.4 auch nicht mittelbar).
- `meal_plans`, `shopping_lists`, Kalorienziele (sonst wanderten Zyklusbezüge über Portionen in den Paar-Modus).
- `daily_metrics` und Readiness (Phase 8).
- `ai_usage`, KI-Prompts, Gemini.
- `health_screening` (nur lesend: Flag `pregnancy` pausiert das Modul auf dem Gerät).

### 6.6 Typen

`packages/db` (generierte Typen) und `packages/core/src/enums.ts` (`DAY_VARIANTS`, `CYCLE_STATUSES`,
`CYCLE_SYMPTOMS`); Abgleich in `db-sync.test.ts` (Enum, Grenzen, Version der Einwilligung, JSON-Prüfregeln der RPC
gegen das Zod-Schema, Zähl-Ausdruck 6.4).

---

## 7. Datenschutz und Sicherheit (DSGVO Art. 9)

### 7.1 Eigene Einwilligung `cycle_data` v1

- **Getrennt** von `health_data`, nicht vorausgewählt, eigener Bildschirm beim Einschalten des Moduls.
- **Text-Entwurf (ENTWURF – vor dem öffentlichen Livegang juristisch prüfen):**
  - **Was:** Blutung, Energie, Beschwerden, optional Schlaf, Status (z. B. hormonelle Verhütung, Wechseljahre,
    Stillzeit, Schwangerschaft), Zeitpunkt der letzten Periode beim Einschalten.
  - **Wozu:** dir an Tagen mit wenig Energie oder starken Beschwerden ein leichteres Training anzubieten, dir
    Hinweise zu Ernährung zu geben und dir allgemeine Hinweise zu geben, wann eine ärztliche Abklärung sinnvoll sein
    kann.
  - **Wie:** in der EU (Frankfurt) gespeichert, zusätzlich verschlüsselt. Nie im Partner-Modus, nie im PDF, nie an
    KI-Dienste, Werbung, Analytics oder Shops.
  - **Pflichtsatz** MDR (3.6).
  - **Widerruf:** jederzeit unter Einstellungen → Zyklus. Er löscht alle Zyklusdaten sofort auf dem Server und auf
    diesem Gerät; aus Sicherungskopien des Anbieters verschwinden sie nach spätestens **N Tagen** (N = Sicherungsfrist
    des Supabase-Tarifs, in ZY2 eintragen). Andere Geräte löschen ihre Kopie beim nächsten Öffnen der App.
    **Bleibt:** Trainings, die du als „leichter“ markiert hast, bleiben im Tagebuch – mit dieser Markierung und den
    verminderten Soll-Werten, aber ohne Grund.
- **Seed (K2):** v1 wird in ZY2 per Migration eingespielt, sichtbar als Entwurf gekennzeichnet, und gilt für die
  Testphase. Ändert die Rechtsprüfung vor dem öffentlichen Livegang den Text, kommt **v2** per eigener Migration; alle
  mit v1 sehen eine Re-Consent-Karte (Muster PLAN-PHASE-6 11.1). `CURRENT_CONSENT_VERSIONS.cycle_data = 1`.
- **Unabhängig von `health_data`:** Das Modul funktioniert auch ohne Gesundheits-Check. Dann kennt nur der Status im
  Modul eine Schwangerschaft.

### 7.2 Wer sieht das Modul (ZY-G4, S8)

- Angebot in den Einstellungen für `weiblich`, `divers` und `keine Angabe`; bei `männlich` ausgeblendet. Die
  Onboarding-Frage „Interesse“ bleibt; `cycle_module_interest` steuert nur, ob die App einmal aktiv auf das Modul
  hinweist. Der CHECK auf `sex = 'female'` wird auf „nicht männlich“ erweitert (additiv, ZY2).
- **Nach einem Wechsel auf „männlich“** bleibt „Einstellungen → Zyklus“ sichtbar, solange eine Einwilligung oder
  Daten bestehen – mindestens mit Pausieren, Alle Einträge löschen, Modul beenden und Export.
- Alter: ab 16 wie die ganze App (DSGVO Art. 8, DE 16, AT 14). Keine Sonderregel außer den Längen-Grenzen unter 18.

### 7.2a Freischaltung im Supabase-Modus bis zur Rechtsprüfung (N3)

- Neues Flag **`cycle_module`** in `private.*` (Muster `affiliate_enabled`, `live_adjustment`), **Standard aus**, plus
  Freischaltung je Konto über den Workflow `beta-grant` (neue Auswahl „Zyklus-Modul“).
- **Serverseitig geprüft** in `save_cycle_entry`, `save_cycle_settings` und beim Erteilen von `cycle_data`
  (`cycle_module_closed`). Die App blendet das Modul ohne Freischaltung aus, verlässt sich aber nicht darauf.
- **Ohne Freischaltung bleiben** Lesen, Export, Löschen und Widerruf immer möglich (Art. 15/17), z. B. nach Entzug der
  Freischaltung.
- Der **Testmodus** (ohne Supabase) bleibt offen.
- Der Knopf „Heute leichter“ für alle (ZY5) hängt **nicht** an diesem Flag.
- pgTAP: ohne Flag/Freischaltung scheitert Schreiben, Lesen/Export/Löschen klappen; mit Freischaltung klappt
  Schreiben.
- **Öffnung für alle** (Flag für alle an) erst nach Rechtsprüfung (16 Nr. 8, 18).

### 7.3 Verschlüsselung, Schlüsselverwaltung und Logs (ZY-G2)

| Variante                                                              | Schützt gegen                                                                                                                              | Schützt nicht gegen                      | Aufwand / Nachteile                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A – Server: `pgcrypto` + Schlüssel im Supabase Vault (Empfehlung)** | versehentliches Lesen in Tabellen-Editor/SQL, Datenbank-Dumps und Sicherungskopien außerhalb des Projekts, Fehl-Selects, API-Fehlfreigaben | alle in der Liste unten                  | mittel; Schlüssel nie im Repository, entsteht in der Migration; Rotation über `key_version`                                                             |
| B – App-seitig (Ende-zu-Ende, Schlüssel nur bei der Person)           | zusätzlich gegen uns selbst und Supabase                                                                                                   | Verlust des Geräts/Passworts = Daten weg | hoch: Schlüssel für mehrere Geräte und den Browser (Passphrase), keine Server-Prüfung der Eingaben, Export nur auf dem Gerät, Support kann nicht helfen |
| C – `pgsodium` Transparent Column Encryption                          | wie A                                                                                                                                      | wie A                                    | **nicht nutzen:** Supabase rät nach unserem Stand von neuer Nutzung ab (vor ZY2 in der aktuellen Supabase-Doku prüfen)                                  |

**Wer bei Variante A trotzdem mitlesen könnte (S3, gehört in DSFA und Datenschutzerklärung):**

- jedes Mitglied der Supabase-Organisation mit Zugriff auf SQL-Editor oder Vault (Rolle „Developer“ und höher);
- alles, was das Datenbank-Passwort `SUPABASE_DB_PASSWORD` nutzt – also GitHub-Workflows und damit jede Person mit
  Schreibrecht auf `.github/workflows`;
- KI- oder MCP-Werkzeuge mit Projektzugriff (z. B. Supabase-MCP `execute_sql`);
- Supabase selbst als Auftragsverarbeiter.

**Gegenmaßnahmen:** Rollen in der Supabase-Organisation auf das Nötige begrenzen (Abschnitt 18); Branch-Schutz für
`main` und Workflow-Änderungen nur per Pull Request; **Regel-Vorschlag für CLAUDE.md:** „Zyklus-Tabellen und Vault nie
per SQL oder MCP abfragen, auch nicht zur Fehlersuche.“ (Gründer-Freigabe nötig, ZY-G2).

**Empfehlung A im Detail:**

1. Erweiterungen `pgcrypto` (Schema `extensions`) und `supabase_vault` – die Migration prüft beides und bricht sonst
   mit klarer Meldung ab.
2. Schlüssel: 32 Zufallsbytes (`extensions.gen_random_bytes`), als Vault-Geheimnis `cycle_data_key_v1`. **Idempotent:**
   Die Migration legt ihn nur an, wenn es ihn noch nicht gibt – sonst wären alle Daten unlesbar. pgTAP prüft das
   (zweimaliges Ausführen ändert den Schlüssel nicht). Der Schlüssel steht nie in Git, nie in GitHub Secrets, nie im
   Chat.
3. Verschlüsseln mit `extensions.pgp_sym_encrypt(payload::text, key, 'cipher-algo=aes256, compress-algo=0')`,
   Entschlüsseln nur in den Funktionen aus 6.3. In ZY2 messen: S2K-Kosten und `get_cycle_entries` über 400 Tage (Ziel
   < 300 ms im Frankfurt-Projekt; K5).
4. **Rotation:** neuer Schlüssel `…_v2`, manuell startbarer Workflow `cycle-key-rotate` verschlüsselt alle Zeilen neu
   und löscht erst danach den alten Schlüssel. Workflow nur von `main`, kein `set -x`, keine Ausgabe von Werten, nur
   Anzahlen. Nur bei Verdacht oder jährlich.
5. Dazu kommt die Festplatten-Verschlüsselung von Supabase.

**Logs – Pflicht-Prüfliste in ZY2, Ergebnis dokumentiert in `docs/SETUP.md` (B3):**

1. `log_parameter_max_length = 0` und `log_parameter_max_length_on_error = 0` – oder ein Nachweis, dass keine
   Statement-/Dauer-Logs mit Parametern entstehen.
2. `log_min_duration_statement` und `log_statement` geprüft (keine Statement-Logs mit Parametern).
3. `pgaudit` und `auto_explain` aus – oder die Rolle `authenticated` ausgenommen.
4. RPC nur per POST (6.3a), Test.
5. Validierung ohne Eingabewert in Fehlertexten (6.3a), pgTAP mit kaputten Werten.
6. App: kein `console.*` mit Zyklus-Objekten (Lint/Test, ZY1).
7. Supabase-API-Logs: Pfad und Status, kein Inhalt – vor dem öffentlichen Livegang bestätigen.

### 7.4 Auf dem Gerät

- **Drei neue geschützte Speicher:** `cycleCache` (Einträge der letzten 120 Tage für die Anzeige offline),
  `cycleQueue` (offline erfasste Einträge bis zum Senden), `dayVariant` (Tageswahl „leichter“, auch ohne Modul). App:
  AES-256-GCM, eigener Schlüssel im Keychain/Keystore. Browser: nur `sessionStorage`.
- **Hinweis-Zustände** (weggetippt, gezeigt am) liegen verschlüsselt in `cycle_settings` (geräteübergreifend, S6).
- **Mehrere Geräte und Einwilligung (S5):**
  - Jeder Eintrag in `cycleQueue` trägt `consent_granted_at` der Einwilligung, unter der er erfasst wurde. Der Server
    lehnt ältere ab (`cycle_consent_outdated`); die App verwirft solche Einträge, statt endlos neu zu senden.
  - Beim App-Start und bei jedem Abgleich der Einwilligungen: Fehlt `cycle_data`, leert die App `cycleCache`,
    `cycleQueue` und die Tageswahl aus dem Modul und storniert die Erinnerung.
  - Restrisiko: Ein Gerät, das nie wieder online geht, behält seine verschlüsselte Kopie (DSFA).
- Geleert außerdem bei: Modul beenden, Abmelden, Konto löschen, Kontowechsel.
- **Browser (K4):** `sessionStorage` endet mit dem Tab. Im Offline-Zustand Hinweis „Noch nicht gesendet – Tab nicht
  schließen“, dazu eine Warnung vor dem Verlassen der Seite, solange `cycleQueue` nicht leer ist.
- **Testmodus:** Zyklusdaten im Browser **nur** in `sessionStorage` (strenger als der übrige Testmodus mit
  `localStorage`), Dauerhinweis „Testmodus – Daten bleiben nur auf diesem Gerät“.
- **Bildschirm-Schutz (K3):** Android `FLAG_SECURE` auf den Zyklus-Bildschirmen (keine Bildschirmfotos, kein
  Vorschaubild); iPhone Schutz-Overlay beim Wechsel in den App-Umschalter.

### 7.5 Widerruf, Modul beenden, Konto löschen, Export, Aufbewahrung

- **Pausieren:** Tages-Check und Angebote aus, Daten bleiben, Einwilligung bleibt. Jederzeit fortsetzen.
- **Modul beenden = Widerruf** `cycle_data`: Rückfrage („Alle Zyklusdaten werden gelöscht“), dann Trigger
  `private.consents_after_revoke()` löscht `private.cycle_entries` und `private.cycle_settings` (Platzhalter füllen).
  Die App leert die Gerätespeicher und storniert die Erinnerung.
- **Einzelnen Eintrag löschen** und **„Alle Einträge löschen“** (ohne Widerruf) im Verlauf.
- **Konto löschen:** `on delete cascade`.
- **Export:** `export_my_data()` bekommt den Block `cycle` (Einstellungen und alle Einträge entschlüsselt, ohne
  `key_version`). Der Export bleibt eine lokale Datei ohne Teilen-Dialog (KONZEPT 14).
- **Aufbewahrung (ZY-G8):** Einträge älter als **24 Monate** (`entry_date < current_date - interval '24 months'`)
  löscht ein täglicher `pg_cron`-Lauf (Muster Ernährung N7).
- **pgTAP (S9):**
  1. Schreiben ohne Einwilligung scheitert; Schreiben mit `consent_granted_at` vor der aktuellen Einwilligung scheitert.
  2. Nach Widerruf null Zeilen in **beiden** Tabellen; Export danach ohne `cycle`-Block.
  3. Gleichzeitiger Widerruf und Speichern (Sperre `for share`): kein Eintrag überlebt.
  4. Konto löschen per Cascade.
  5. Fremde Person liest nichts (auch nicht über RPC mit fremden Parametern).
  6. `select` auf die Tabellen und `execute` auf `private.cycle_key` für `anon`, `authenticated`, `service_role`
     verweigert; `vault.decrypted_secrets` für diese Rollen nicht lesbar.
  7. Spalte enthält keinen Klartext (Suche nach bekanntem Wert im `bytea`).
  8. Ungültige Eingaben (Text statt Zahl, riesige Zahl, falsches Datum, Zukunft, > 60 Tage zurück) scheitern; die
     Fehlermeldung enthält den Eingabewert **nicht**.
  9. Zeitraum > 400 Tage abgelehnt; Ratenbegrenzung greift.
  10. Aufbewahrung über `interval '24 months'`, Rand ± 1 Tag, Schaltjahr (29.02.) und Monatsende.
  11. `day_variant`: gültiger Wert, ungültiger Wert, CHECK `day_variant is null or not is_free`.
  12. Zählspiegel: `lighter`-Eintrag als neuester → Grundlage ist der vorherige zählende Eintrag, in SQL wie im Core.
  13. CHECK `cycle_module_interest`: `male` abgelehnt, `diverse` und `null` erlaubt.
  14. Lesen, Export und Löschen nach veralteter Einwilligung erlaubt, Schreiben nicht.
  15. Schlüssel-Migration zweimal ausgeführt → Schlüssel unverändert.

### 7.6 Nie geteilt – technisch abgesichert

- **Strukturtest (CI):** `apps/web` und `packages/content` dürfen weder `cycle_*`-Funktionen noch
  `packages/core/src/cycle` importieren oder aufrufen. Partner-Modus-Code (Phase 11), PDF-Bausteine und
  Readiness/`daily_metrics` (Phase 8) ebenso. **Erlaubt:** Lesen von `session_logs.day_variant` in `apps/web`.
- **Benachrichtigungen:** nur der neutrale Text „Alpha5: Kurzer Tages-Check?“ ohne Zyklus-Wort (7.7); Test über alle
  Benachrichtigungstexte.
- **Kein Analytics, keine Crash-Reports mit Zyklusdaten:** Falls später ein Crash-Werkzeug kommt, schließt es die
  Zyklus-Bildschirme und Speicher aus (Merkposten Phase 12).
- **KI-Coach (Phase 11):** bekommt nie Zyklusdaten; fester Satz in KONZEPT 15 nach Freigabe.

### 7.7 Erinnerung (optional, ZY-G7)

- Lokale Benachrichtigung, **Standard aus**, Uhrzeit wählbar. Text: „Alpha5: Kurzer Tages-Check?“ – kein Zyklus-Wort,
  keine Zahl. Plant nur mit gültiger Einwilligung (wie Mess-Erinnerung, 4b S5); Widerruf storniert sie.

### 7.8 DSFA-Ergänzung

Zweck, Datenarten, Rechtsgrundlage Art. 9 Abs. 2 lit. a, Verschlüsselung und die vollständige Liste, wer trotzdem
mitlesen könnte (7.3), Klartext-Datum, Restrisiko `day_variant`-Muster und was nach dem Widerruf bleibt (6.4),
Vercel-Zeile (Lesen von `day_variant`), Gerät offline nach Widerruf (7.4), Status `pregnant` ohne Flag im
Gesundheits-Check (3.2), Sicherungsfrist, Aufbewahrung 24 Monate, Löschung, Export, keine Empfänger außer Supabase und
Vercel (AV-Verträge), kein Drittland. Eintrag „Zyklusdaten“ im Verzeichnis der Verarbeitungstätigkeiten.

---

## 8. Etappe ZY2 – Datenbank (nur additiv, RLS, pgTAP)

- Migrationen: Vault-Schlüssel (idempotent), Tabellen 6.2 in `private`, Funktionen 6.3 mit Rechten für alle Rollen,
  Spalte `session_logs.day_variant` + Enum + CHECK, Seed `cycle_data` v1 (Entwurf), Widerruf, Export, Aufbewahrung,
  CHECK `cycle_module_interest` erweitert.
- **Zähl-Spiegel angepasst** (B2): `recent_exercise_logs`, `latest_basis` in Rücknahme und Anwendung, jede Stelle mit
  `not sl.is_deload and not sl.is_intro_week`; `save_session_log` nimmt `day_variant` an (prüft nur den Wert).
- **Log-Prüfliste** aus 7.3 abarbeiten, Ergebnis in `docs/SETUP.md`.
- Messung Verschlüsselung/Leistung (7.3 Punkt 3).
- pgTAP aus 7.5, dazu `28_anon_and_definer` erweitern.
- Typen generieren (Workflow), `db-sync.test.ts` erweitern.
- **DoD:** Workflow `db-test` grün; Migration läuft auf leerer und auf bestehender Datenbank; keine Klartext-Spalte mit
  Zyklusinhalt; **Zeitstempel der Migrationen mit offenen Pull Requests aus Phase 6, 7 und 8 abgeglichen** (S11).

---

## 9. Etappe ZY3 – App im Testmodus

### 9.1 Bildschirme

1. **Einstellungen → Zyklus** (sichtbar nach 7.2): Einführung (3 Sätze, Pflichtsatz MDR) → Einwilligung
   `cycle_data` → Status wählen → bei `natural` Frage „Letzte Periode“ → optional Schlaf an/aus, Erinnerung an/aus →
   fertig.
2. **Tages-Check** im Zyklus-Bildschirm: vier Zeilen mit großen Knöpfen, Speichern sofort beim Tippen, Hilfetext an
   „stark“. Ziel: **unter 10 Sekunden**. Darunter fester Satz W7. Kurzweg von „Heute“ über die Karte „Wie geht’s dir
   heute?“ (nur bei aktivem Modul, ohne Zyklus-Wort).
3. **Verlauf:** Monatsansicht (Punkte für Blutung, kleine Zeichen für Energie/Beschwerden), Liste der vergangenen
   Zykluslängen, Rückfrage nach 45 Tagen. Keine Vorhersage, keine Phasen-Farben.
4. **Hinweise und Warnungen** als Karten im Zyklus-Bildschirm, mit „Mehr dazu“ (Quellen eingeklappt). Bei Flag
   `cycle_warnings` aus: statischer Ratgeber.
5. **„Heute leichter?“** – in ZY3 nur als Angebot im Zyklus-Bildschirm und im Testmodus an der Trainingskarte
   (Darstellung prüfen); der allgemeine Knopf und das Schreiben von `day_variant` kommen in ZY5.
6. **Pausen-Bildschirm Schwangerschaft** (3.2) mit Direktweg in den Gesundheits-Check.
7. **Einstellungen:** Pausieren, Status ändern, Alle Einträge löschen, Modul beenden (Widerruf), Export-Hinweis,
   Erinnerung.

### 9.2 Zustände

Laden, leer („Noch keine Einträge – fang heute an“), offline (Eintrag in `cycleQueue`, Hinweis „noch nicht gesendet“,
im Browser „Tab nicht schließen“), Fehler mit festen Codes, ohne Einwilligung (nur Einführung), pausiert,
Schwangerschaft, Status fehlt, Modul für `männlich` ohne Daten nicht sichtbar, `männlich` mit Daten nur
Verwaltungs-Ansicht.

### 9.3 Testmodus

- Gleiche Logik über `local-backend.ts`, Speicher wie 7.4. Schalter im Testmodus „Zyklus-Beispieldaten laden“ (90
  Tage mit Lücken) und „Warnungen aus“ (simuliert `cycle_warnings`), damit ihr Warnungen, Ratgeber und Verlauf ohne
  monatelanges Eintragen seht.
- Playwright: Einschalten, Einwilligung, Check unter 3 Tipps, Angebot, Warnung W1 mit Beispieldaten, Einschalt-Antwort
  „mehr als 3 Monate“ → W1 sofort, Flag aus → Ratgeber, Widerruf leert alles, männlich ohne Daten sieht nichts,
  Wechsel auf männlich mit Daten → Verwaltung sichtbar, „Heute“ ohne Zyklus-Wörter (Textsuche).

### 9.4 Texte und Barrierefreiheit

Deutsch, kurze Sätze, Knöpfe ≥ 44 pt, Beschriftungen für Bildschirmleser (nicht nur Farbe/Zeichen), Energie-Skala mit
Worten. Textregeln-Test (3.7).

**DoD ZY3:** UI mobil + Web-Export, Zustände, Playwright grün, Handy-Test (Abschnitt 14).

---

## 10. Etappe ZY4 – Supabase-Anbindung und Offline

- `supabase-backend.ts`: RPCs aus 6.3 (nur POST), Warteschlange `cycleQueue` mit `consent_granted_at` (Senden bei
  Verbindung, „neuester gewinnt“ je Datum, veraltete verwerfen), `cycleCache`.
- Abgleich der Einwilligung beim Start leert die Speicher (S5). Widerruf/Abmelden/Kontowechsel ebenso (Tests).
- Export-Datei enthält den Zyklus-Block (Test).
- **DoD:** Live-Test mit zwei Testkonten (fremde Daten unsichtbar), zwei Geräte (Widerruf auf A → B leert beim Öffnen,
  offline erfasster Eintrag auf B kommt nach erneuter Einwilligung nicht zurück), Export und Widerruf geprüft.

---

## 11. Etappe ZY5 – „Heute leichter“ für alle, Progression und 4b

- **Knopf „Heute leichter?“ für alle** an der heutigen Trainingskarte und vor dem Start im Trainingsmodus (gratis,
  ohne Modul). Ab hier schreibt die App `day_variant`.
- `day-variant.ts` (aus ZY1) im Trainingsmodus anwenden, Tageswahl im Speicher `dayVariant`, Entwurf und `LogQueue`
  tragen `day_variant`.
- Core: `isCountingEntry()` und R3-`counting` schließen `lighter` aus; Tests für **jede** Zeile der Tabelle 6.4
  (inkl. R5, `isReturn`, Wochenauswertung zählen mit).
- „Verschieben“ ohne zwei harte Einheiten hintereinander (K6, Test).
- Phase 10: kein Angebot am Renntag; Tapering erlaubt (Tests mit Wettkampfplänen).
- 10-%-Bezug (N1): Test „Ausdauer-Woche mit `lighter`-Einheiten → Folgeblock nie über `floor(1,1 × tatsächlich
trainierte Minuten)`“, in `schedule.test.ts` und als Eigenschaftstest.
- `combineDayOffers` nimmt Readiness auf, sobald Phase 8 da ist.
- **DoD:** Core-, SQL- und App-Tests, Eigenschaftstest „nie mehr als geplant“, Gegenproben (Regel absichtlich gebrochen
  → rot → zurückgesetzt), Abgleich Core/SQL in `db-sync.test.ts`.

---

## 12. Etappe ZY6 – Erinnerung, Doku, DSFA

- Optionale Erinnerung (7.7) über `notifications.ts`.
- Doku: KONZEPT 8 (umgesetzt), 12 (Abweichungen: Tabellen in `private`, Verschlüsselung, `day_variant`), 13 (gratis,
  falls ZY-G1 so entschieden), 14 (MDR, DSFA, Prüfungen vor Livegang), 15 (KI-Coach ohne Zyklusdaten); HANDY-ANLEITUNG
  (Teil „Zyklus-Modul testen“); SETUP (Vault prüfen, Log-Prüfliste, Rotation); `.env.example` (keine neuen Variablen
  erwartet).
- **DoD:** Doku aktualisiert, DSFA-Ergänzung als Entwurf an die Gründer.

---

## 13. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (Einstellungen, Eintrag, `day_variant`).
2. Migration nur additiv, mit RLS (Tabellen in `private`, Rechte auch gegen `service_role`), Verschlüsselung und
   pgTAP.
3. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen (sehr jung/alt, 1 vs. 7 Tage, jeder Status, jede
   Schwelle ± 1 Tag); neue Werte mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.
4. UI mobil + Web-Export, Playwright im Testmodus.
5. Lade-, Leer-, Fehler-, Offline-, Einwilligungs- und Pausen-Zustände.
6. Texte auf Deutsch, Wortlisten-Test grün, Pflichtsatz MDR vorhanden.
7. Einwilligungstext `cycle_data` v1 und DSFA-Ergänzung (Entwürfe; juristische Prüfung vor dem öffentlichen Livegang).
8. Doku: dieser Plan (Umsetzungsstand), KONZEPT, HANDY-ANLEITUNG, SETUP.
9. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 14. So testet ihr es am Handy

Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am besten im **Inkognito-Tab**: Chrome →
unten rechts **⋯** → **Neuer Inkognito-Tab**. Für jeden Durchgang einen neuen Inkognito-Tab öffnen.

**ZY3 (Testmodus):**

1. Link öffnen → „Ohne Konto testen“ → Geschlecht **weiblich**, Geburtsdatum 30 Jahre, Ziel Muskelaufbau, 3
   Trainingstage, einer davon heute.
2. **Einstellungen → Zyklus** → Einführung lesen (Satz „nicht zur Verhütung“) → Einwilligung zustimmen → Status
   „Natürlicher Zyklus“ → „Letzte Periode: weniger als 1 Monat“.
3. **Tages-Check:** Blutung „mittel“, Energie **2**, „Unterleibsschmerzen stark“ → speichert sofort.
4. **Heute** öffnen → Trainingskarte zeigt „Heute leichter? – passend zu deiner Tagesform“. Prüfen: **kein** Wort wie
   Periode oder Zyklus auf „Heute“.
5. „Heute leichter“ → Einheit zeigt je Übung einen Satz weniger, Markierung „leichter“. „Wie geplant“ in einem neuen
   Durchgang → Einheit unverändert.
6. Neuer Inkognito-Tab, Schritte 1–2, aber „Letzte Periode: **mehr als 3 Monate**“ → sofort Karte „Deine Periode ist
   seit drei Monaten ausgeblieben …“.
7. Testmodus-Schalter **„Zyklus-Beispieldaten laden“** → zusätzlich Eisen-Hinweis. Schalter **„Warnungen aus“** →
   statt der Karten erscheint der Ratgeber „Wann ärztlich abklären?“.
8. Status auf **„Hormonelle Verhütung“** ändern → die Karte zum Ausbleiben verschwindet.
9. **Einstellungen → Zyklus → Modul beenden** → Rückfrage bestätigen → Zyklus-Bildschirm leer, Einwilligung
   widerrufen, kein hervorgehobenes Angebot mehr auf „Heute“.
10. Neuer Tab, Geschlecht **männlich** → unter Einstellungen gibt es **kein** Zyklus-Modul. Neuer Tab: erst weiblich
    mit Einträgen, dann im Profil auf männlich → „Einstellungen → Zyklus“ bleibt mit Löschen/Beenden sichtbar.
11. Neuer Tab, Gesundheits-Check „schwanger“ = Ja → Zyklus-Bildschirm zeigt nur den Pausen-Bildschirm mit Arzt- und
    Notruf-Sätzen.

**ZY4 (mit Supabase, zwei Testkonten):** Konto A trägt ein → Konto B sieht nichts. Konto A → Einstellungen → „Meine
Daten exportieren“ → Datei enthält den Zyklus-Block. Konto A widerruft am Handy → im Browser beim nächsten Öffnen keine
Zyklusdaten mehr.

**ZY5:** Ohne Zyklus-Modul an der Trainingskarte „Heute leichter?“ antippen → Einheit leichter. Alle Wiederholungen
schaffen → nächste Einheit: Gewicht **nicht** gestiegen (Hinweis „leichterer Tag zählt nicht für die Steigerung“).

---

## 15. Risiken

1. **Einstufung als Medizinprodukt** (vor allem Warnsignale). _Gegenmittel:_ keine Vorhersage, keine Fruchtbarkeit,
   keine Diagnose, Zweckbestimmung schriftlich (auch Store/Landingpage), Wortlisten-Test, Flag `cycle_warnings` mit
   statischem Rückfall, Rechtsprüfung vor dem öffentlichen Livegang, Testphase nur mit eingeladenen Personen.
2. **Datenleck besonders sensibler Daten.** _Gegenmittel:_ Verschlüsselung A, Schema `private`, Rechte auch gegen
   `service_role`, Log-Prüfliste, Aufbewahrung 24 Monate, keine Weitergabe, DSFA. Mitlese-Möglichkeiten offen benannt
   (7.3).
3. **Schlüssel geht verloren** → Daten unlesbar. _Gegenmittel:_ idempotente Migration, Löschen alter Schlüssel nur im
   Rotations-Workflow nach erfolgreicher Neu-Verschlüsselung, pgTAP.
4. **Falscher Alarm oder falsche Beruhigung.** _Gegenmittel:_ nur bei ausreichenden Daten, Einschalt-Frage und
   45-Tage-Rückfrage gegen Schweigen, ruhiger Ton, nie Entwarnung, Fachprüfung.
5. **Rückschluss über `day_variant`.** _Gegenmittel:_ Knopf für alle ab demselben Pull Request, kein Grund, später
   Readiness, kein Zugriff Dritter, Restrisiko in der DSFA.
6. **Leichter Tag verfälscht 4b oder Progression.** _Gegenmittel:_ Tabelle 6.4, Core und SQL gleich, Gegenproben.
7. **Blicke auf den Bildschirm / Benachrichtigungen.** _Gegenmittel:_ „Heute“ ohne Zyklus-Wörter, neutrale
   Erinnerung, `FLAG_SECURE` und Overlay.
8. **Zu viel Aufwand, keiner trägt ein.** _Gegenmittel:_ < 10 Sekunden, alle Felder optional, Erinnerung optional.
9. **Leistungsdruck oder Essstörungs-Risiko** (RED-S). _Gegenmittel:_ W1b/W1c, keine Kalorien nach Phase,
   Hilfe-Stellen aus Phase 5 verlinkbar, keine Gewichts-Kopplung.
10. **Ausgrenzung** (trans, nicht-binär, Wechseljahre). _Gegenmittel:_ Angebot für alle außer „männlich“, neutrale
    Sprache, Status für Wechseljahre (ZY-G4).
11. **Store-Prüfung:** Apple 5.1.3, Google Play „Gesundheits-Apps“ und Datensicherheit. _Gegenmittel:_ Angaben in
    Phase 12, Abschnitt 18.
12. **Mehrere Geräte nach Widerruf.** _Gegenmittel:_ Abgleich beim Start, `consent_granted_at`, DSFA.
13. **Supabase ändert Vault/`pgcrypto`.** _Gegenmittel:_ Prüfung in der Migration, Rotation als Workflow, SETUP.

---

## 16. Zeitplan

Laufend: Phase 4b (Etappe E), Phase 6 (Entwurf), Pläne zu Phase 7 und 8. Testphase: alles offen (`premium_open`).

**Empfohlene Reihenfolge (je Schritt ein Pull Request):**

1. **ZY0** freigeben.
2. **ZY1** (Core) – sofort möglich, keine Konflikte.
3. **ZY2** (Datenbank) – sobald kein anderer Migrations-Pull-Request offen ist; Zeitstempel-Abgleich mit Phase 6, 7
   und 8 ist Teil der DoD.
4. **ZY3** (App, Testmodus).
5. **ZY5** (Knopf für alle, Progression, 4b) – kann vor ZY4 kommen, braucht nur ZY1 und ZY2.
6. **ZY4** (Supabase, Offline) – nach dem Live-Test mit echtem Supabase.
7. **ZY6** (Erinnerung, Doku, DSFA).
8. **Vor dem öffentlichen Livegang:** Fach- und Rechtsprüfung (Abschnitt 18), danach ggf. Einwilligung v2 und
   Entscheidung zu `cycle_warnings`. **Pflicht:** Ohne Rechtsprüfung wird `cycle_module` nicht für alle geöffnet;
   bis dahin nur per `beta-grant` freigeschaltete Konten (N3).

Grobe Größe: ZY0 + 6 Etappen ≈ 6–7 Pull Requests.

---

## 17. Was wir von euch brauchen (Gründer-Entscheidungen)

Format: _Worum es geht – Warum wir fragen – Empfehlung._

- **ZY-G1 Gratis nach der Testphase.** In der Testphase ist ohnehin alles offen (`premium_open`). KONZEPT 13 führt
  „Zyklus-Anpassung“ später unter Premium. – Warnsignale und „leichter an schlechten Tagen“ sind
  Sicherheitsfunktionen; Art-9-Daten sollen kein Verkaufshebel sein. – **Empfehlung:** auch danach **gratis**,
  KONZEPT 13 anpassen.
- **ZY-G2 Verschlüsselung.** Server (`pgcrypto` + Vault) oder Ende-zu-Ende in der App? – E2E schützt am stärksten,
  aber Daten sind bei Geräteverlust weg, der Browser bräuchte eine Passphrase, und der Server kann nichts prüfen. –
  **Empfehlung:** **A (Server, Vault)**, Mitlese-Liste offen in DSFA, Rollen begrenzen, Regel „nie per SQL/MCP
  abfragen“ in CLAUDE.md aufnehmen, Schlüsselwechsel bei Verdacht und jährlich.
- **ZY-G3 Vorhersage der nächsten Periode.** – Rückt Richtung Medizinprodukt, verleitet zu Benachrichtigungen mit
  Inhalt. – **Empfehlung:** **nein**; nur „Tag X seit Periodenbeginn“, keine Phasen-Namen.
- **ZY-G4 Wer sieht das Modul.** – Auch nicht-binäre und trans Personen können menstruieren. – **Empfehlung:**
  „weiblich“, „divers“, „keine Angabe“; nicht „männlich“ (außer zum Verwalten bestehender Daten).
- **ZY-G5 Schlaf erfassen.** – KONZEPT 8 nennt Schlaf; Phase 8 bringt Schlaf aus Wearables. – **Empfehlung:**
  optional, **Standard aus**; nicht abfragen, wenn Wearable-Schlaf da ist; fließt nicht ins Angebot und nie in
  Readiness.
- **ZY-G6 Freitext-Notiz.** – Praktisch, aber nicht prüfbar und oft sehr persönlich. – **Empfehlung:** **nein**.
- **ZY-G7 Erinnerung an den Tages-Check.** – Hilft beim Dranbleiben, aber Benachrichtigungen sind sichtbar. –
  **Empfehlung:** optional, **Standard aus**, neutraler Text, lokal.
- **ZY-G8 Aufbewahrung.** – Datensparsamkeit gegen Verlauf. – **Empfehlung:** automatisch löschen nach **24 Monaten**.
- **ZY-G9 Art der Verhütung.** – Präparat-Angaben sind sehr sensibel und für die Regeln unnötig. – **Empfehlung:** nur
  „hormonelle Verhütung ja/nein“.
- **ZY-G10 Eisen.** – Ein Präparat ohne Blutwert kann schaden und ist ein Health-Claims-Thema. – **Empfehlung:**
  Lebensmittel-Hinweis + „Blutwerte ärztlich prüfen lassen“, **kein** Präparat.
- **ZY-G11 Apple Health / Health Connect (Menstruation).** – Neue Datenflüsse, Development Build. – **Empfehlung:**
  **nicht** in Phase 9.
- **ZY-G12 Energiemangel-Warnung und Kalorien.** – Automatisch hieße: Zyklusdaten steuern den Essensplan. –
  **Empfehlung:** **nur Hinweis** mit Link „Ziel auf Erhalt ändern“.
- **ZY-G13 Fachprüfung.** – Schwellen und Texte berühren Gynäkologie und Sportmedizin. – **Empfehlung:** Prüfung durch
  Gynäkologie **und** Sportmedizin **vor dem öffentlichen Livegang** (Pflicht), inkl. W3/W4 bei hormoneller
  Verhütung, W8, Schwangerschafts-Satz bei W1 und Hilfetext „stark“.
- **ZY-G14 `day_variant` im Tagebuch.** – Ohne die Spalte verfälscht ein leichter Tag Progression und 4b; mit ihr
  entsteht ein schwaches Muster, und sie bleibt nach dem Widerruf. – **Empfehlung:** Spalte **ohne Grund**, zählt
  nirgends als zählender Eintrag (Tabelle 6.4), bleibt nach Widerruf (Begründung 6.4).
- **ZY-G15 Knopf „Heute leichter“ für alle.** – Nötig, damit `day_variant` kein Zyklus-Indiz ist (Wächter B1); für alle
  nützlich. – **Empfehlung:** **ja, in ZY5**, gratis, ohne Modul.
- **ZY-G16 Reihenfolge.** – Phase 9 hängt an keiner anderen Phase hart. – **Empfehlung:** ZY1 sofort nach Freigabe;
  ZY2 sobald kein anderer Migrations-Pull-Request offen ist (Zeitstempel-Abgleich als DoD).
- **ZY-G17 Persönliche Warnsignale und MDR.** – Persönliche Warnungen aus Verlaufsdaten kommen einer „Überwachung“
  nahe; die Rechtsprüfung kommt laut Entscheidung vom 19.10.2026 erst vor dem öffentlichen Livegang. –
  **Empfehlung:** im Supabase-Modus nur für per `beta-grant` freigeschaltete Konten (Flag `cycle_module`, Standard
  aus, serverseitig geprüft); dort persönliche Warnungen **an**, hinter Flag `cycle_warnings`. Ohne Rechtsprüfung
  keine Öffnung für alle. Ergibt die Prüfung Bedenken, `cycle_warnings` aus → statischer Ratgeber.

---

## 18. Was ihr selbst tun müsst

**Jetzt (für Bau und Test):**

1. **Supabase prüfen, ob Vault und pgcrypto aktiv sind** (vor ZY2):
   1. Im Handy-Browser **supabase.com** öffnen und anmelden.
   2. Projekt antippen → Menü (☰) → **Database** → **Extensions**.
   3. In der Suche **vault** eingeben → „supabase_vault“ muss **an** sein.
   4. Suche **pgcrypto** → muss **an** sein. Wenn nicht: Schalter antippen → **Enable**.
2. **Rollen in Supabase begrenzen** (S3):
   1. supabase.com → oben links die **Organisation** antippen → **Team**.
   2. Für jede Person die Rolle prüfen: nur wer wirklich an der Datenbank arbeitet, bekommt „Developer“ oder höher.
3. **Nichts in den Chat:** Es gibt keinen Schlüssel, den ihr eintragen müsst. Der Schlüssel entsteht in der
   Datenbank. Bitte nie Zugangsdaten oder Auszüge aus dem Vault in den Chat kopieren.

**Vor dem öffentlichen Livegang (nicht in der Testphase, Gründer-Entscheidung 19.10.2026):**

4. **Fachprüfung** (ZY-G13): Gynäkologie und Sportmedizin prüfen Abschnitte 3.2–3.5 (Schwellen, Status, Texte, W7,
   W8).
5. **Rechtsprüfung:** MDR-Zweckbestimmung und persönliche Warnsignale (3.6, ZY-G17), Einwilligungstext `cycle_data`
   (7.1, ggf. v2), Datenschutzerklärung (Verschlüsselung, Mitlese-Liste, Sicherungsfrist, Aufbewahrung),
   DSFA-Ergänzung (7.8). Schweiz (revDSG) und Österreich mit.
6. **Notrufnummern und Telefonseelsorge in W7** prüfen (N2) – Ausnahme von der Regel „erst vor dem Livegang“: wie
   die Hilfe-Stellen aus Phase 5 (KONZEPT 14, N4) **vor jedem Build mit Supabase-Werten oder Store-Build**; bis dahin
   nur Namen ohne Nummern im Testmodus. Checkliste `docs/SETUP.md` Teil K.
7. **Öffnung für alle:** `cycle_module` erst nach Rechtsprüfung (Nr. 5) für alle einschalten. Bis dahin Konten einzeln
   freischalten: GitHub-App → **Actions → beta-grant → Run workflow** → Aktion `freischalten`, Funktion
   „Zyklus-Modul“, E-Mail eintragen → **Run workflow**.
8. **Store-Angaben** (mit Phase 12): App-Store-Datenschutz-Labels „Gesundheit“; Google Play → **App-Inhalte** →
   **Gesundheits-Apps** (Menstruation/Zyklus ankreuzen) und **Datensicherheit**. Store-Text mit derselben
   Zweckbestimmung wie in 3.6.

---

## 19. Umsetzungsstand (21.10.2026)

| Etappe                        | Stand                                                     | Wo                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ZY1 Core                      | umgesetzt                                                 | `packages/core/src/cycle/*` (Schemas, Perioden, W1–W8, Angebot, Ernährungs-Hinweise, Modul-Zustand, Export, Texte mit Wortliste, Strukturtest), `plan/day-variant.ts` (`lighterSessionVariant`, `combineDayOffers`), `CYCLE_RULES`/`LIGHTER_DAY` |
| ZY2 Datenbank                 | umgesetzt                                                 | `20261021140000_cycle_module.sql`, `20261021140100_cycle_rpcs.sql`, pgTAP 72–74, Workflow `beta-grant` (Funktionen `cycle_module`, `cycle_warnings`)                                                                                             |
| ZY3 App (Testmodus)           | umgesetzt                                                 | `/zyklus`, `/zyklus/verlauf`, `/zyklus/einstellungen`, „Mehr → Zyklus“, Karte „Wie geht’s dir heute?“, Playwright `e2e/cycle.spec.ts`                                                                                                            |
| ZY4 Supabase/Offline          | umgesetzt (Live-Test mit zwei Konten offen, SETUP Teil Z) | `apps/mobile/src/data/cycle-remote.ts`, Speicher `cycleCache`/`cycleQueue`                                                                                                                                                                       |
| ZY5 „Heute leichter“ für alle | **vorbereitet** (Core), Rest mit Phase 8b                 | Knopf an der Trainingskarte, Speicher `dayVariant`, Spalte `session_logs.day_variant`, Zählspiegel (6.4) – noch nicht gebaut, daher wird `day_variant` nie geschrieben (B1)                                                                      |
| ZY6 Erinnerung, DSFA          | offen                                                     | Erinnerung (Standard aus) und DSFA-Ergänzung folgen                                                                                                                                                                                              |

**Abweichungen vom Plantext (bewusst, zur Konfliktvermeidung mit parallelen Migrationen):**

- Export: eigene Funktion `public.export_my_cycle_data()` statt eines Blocks in `export_my_data()`; die App hängt die
  Tabellen `cycle_settings`/`cycle_entries` an die Export-Datei (spätere Fassungen von `export_my_data` können den
  Block so nicht verlieren).
- Widerruf: eigener Trigger `consents_after_revoke_cycle` statt Ergänzung von `private.consents_after_revoke()`.
- Flags: eigene Tabelle `private.cycle_module_config` (Flags `cycle_module` aus, `cycle_warnings` an, Öffnung für alle
  aus) und `private.cycle_module_grants` statt der CHECK-Liste von `private.feature_flags`; Workflow-Aufruf über
  `public.cycle_module_admin`.
- Datum und Einwilligungszeitpunkt gehen als Text an die Server-Funktionen (kein Cast-Fehler mit Wert im
  PostgREST-Log, B3).
- Verschlüsselung `pgp_sym_encrypt(…, 'cipher-algo=aes256, compress-algo=0, s2k-mode=1')`: Der Schlüssel ist schon
  256 Bit zufällig, Iterationen bringen keinen Schutz. Messung lokal: 400 Einträge entschlüsseln ≈ 9 ms (mit
  Standard-S2K ≈ 650 ms für Ver- und Entschlüsseln).
- Rotations-Workflow `cycle-key-rotate`, Bildschirm-Schutz (`FLAG_SECURE`/Overlay) und Erinnerung: noch offen (ZY6
  bzw. Development Build).
- Regel-Vorschlag für CLAUDE.md („Zyklus-Tabellen und Vault nie per SQL oder MCP abfragen“) ist freigegeben, muss aber
  von euch selbst in CLAUDE.md übernommen werden.
