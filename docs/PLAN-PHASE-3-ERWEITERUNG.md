# Plan Phase 3 – Erweiterung: Trainingstage mit Art und Dauer, Gewichte zum Antippen

**Status:** Vom Gründer beauftragt; vom Wächter **freigegeben** (Runde 1 und Runde 2 mit Auflagen, 04.10.2026) – alle
Befunde eingearbeitet (Abschnitte 12 und 13). Etappe B ist gemergt (PR #7, `main` ff3c821); **Etappe B2 umgesetzt** (Abschnitt 14), B3 offen.
Grundlage: `CLAUDE.md`, `docs/PLAN-PHASE-3.md` (freigegeben; Abschnitte 5–10, Etappen A/B), `docs/KONZEPT.md`
(Abschnitte 2, 4, 10, 12), `docs/PROMPTS.md` (Phase 10 – Ausdauer & Strecken).

**Gründer-Wunsch (wörtlich):** „Bei der Auswahl der Trainingszeit sollen verschiedene Zeiten auswählbar sein. Bei
Ausdauer wird ja auch gelaufen und im Studio/zuhause trainiert. Die Auswahl der Gewichte bei Langhantel/Kurzhantel
müssen verschiedene auswählbar sein.“

**Gründer-Entscheidungen dazu:**

- **Zeiten: „Beides“** – je Wochentag sind Trainingsart **und** Dauer wählbar (z. B. Mo Laufen 30 min, Mi Studio
  60 min, Sa Kraft zu Hause 90 min).
- **Gewichte:** typische Gewichte als **Mehrfachauswahl zum Antippen** (Kurzhantel, Langhantel-Scheiben, Stange,
  Kettlebell) **plus** Feld für eigene Werte (die bestehende Eingabe bleibt).

**Wichtig zur Reihenfolge:** Etappe B (Datenbank für Pläne) ist gemergt. Ihre Migrationen bleiben unverändert;
diese Erweiterung kommt mit **neuen Migrationen danach** (Abschnitt 9).

---

## 1. Ziel in einfachen Worten

Bisher sagt man im Onboarding nur: „3 Tage pro Woche, je 60 Minuten“, dazu Wunsch-Tage und einmal den Trainingsort.
Das passt nicht zu Menschen, die **montags kurz laufen, mittwochs lange ins Studio gehen und samstags zu Hause
trainieren**.

Neu:

1. **Je Wochentag** wählt man, **was** man macht (Kraft im Studio, Kraft zu Hause, Ausdauer/Laufen) und **wie
   lange** (20, 30, 45, 60, 90 Minuten oder eigene Zahl). Wer sich nicht festlegen will, tippt „Tage egal – verteilt
   für mich“ und gibt nur an, wie oft je Art und wie lange.
2. Der Plan richtet sich danach: Krafteinheiten werden **pro Tag** auf die Minuten gekürzt und mit den Geräten des
   jeweiligen Orts gebaut; an Lauftagen gibt es eine **einfache, sichere Laufeinheit** (locker, im
   Gesprächstempo, langsam steigernd) – ohne KI, nach festen Regeln.
3. Bei Kurzhanteln, Langhantel (Stange + Scheiben) und Kettlebells tippt man die vorhandenen Gewichte einfach an
   und kann eigene Werte ergänzen. Für die Langhantel rechnet die App daraus die **wirklich ladbaren Gewichte**.

Wettkampfpläne, Tempo-Zonen, Strecken und GPS bleiben in Phase 10 (Abschnitt 7).

## 2. Ist-Stand (geprüft am 04.10.2026)

| Bereich                | Heute                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding-Schritte    | `ONBOARDING_STEPS` in `packages/core/src/onboarding.ts`: … `goal` → `time_budget` → `training_location` → `equipment` → …; `isStepApplicable('equipment')` = Ort ≠ `gym`. Dieselbe Liste steht als CHECK in `profiles.onboarding_step` (abgeglichen in `db-sync.test.ts`).                                                                                                                                                                        |
| Zeitbudget-UI          | `TimeBudgetStep` in `apps/mobile/src/steps/training-steps.tsx`: `sessionsPerWeek` (1–7), **ein** `minutesPerSession` (Feld + Presets `MINUTE_PRESETS` 20/30/45/60/90, die in der UI stehen), `preferredDays` (optional).                                                                                                                                                                                                                          |
| Zeitbudget-Schema      | `timeBudgetStepSchema` in `packages/core/src/validation.ts`; Grenzen `TRAINING_LIMITS` (`sessionsPerWeek` 1–7, `minutesPerSession` 10–240) in `constants.ts`.                                                                                                                                                                                                                                                                                     |
| Trainingsort           | `TrainingLocationStep`, `TRAINING_LOCATIONS = gym/home/both` (`enums.ts`); „beides“ = Studio (PLAN-PHASE-3 Frage 7, `equipmentProfile()` in `plan/equipment-profile.ts`).                                                                                                                                                                                                                                                                         |
| Speicherung Zeit/Ort   | Tabelle `goals` (Migration `20261003120400_training_preferences.sql`): `sessions_per_week`, `minutes_per_session`, `preferred_days smallint[]`, `training_location`. App: `toGoalsRow()`/Rückweg in `apps/mobile/src/data/mapping.ts`, WriteOp `upsert_goals`, Prüfung im Testmodus `isValidOp()` in `data/local-rules.ts`.                                                                                                                       |
| Equipment-UI           | `EquipmentStep`: nur Heim-Geräte (`HOME_SELECTABLE_EQUIPMENT`), bei `hasWeights` (Kurzhanteln, Langhantel mit Scheiben, Kettlebells) **Freitext-Eingabe** je Gewicht + Chips zum Entfernen.                                                                                                                                                                                                                                                       |
| Equipment-Speicherung  | `user_equipment.weights_kg numeric(5,2)[]` (≤ 40 Stufen, 0,25–200 kg, eindeutig), RPC `replace_user_equipment(p_location, p_items)` (`20261003120900_replace_rpcs.sql`), Schema `equipmentItemSchema`, `EQUIPMENT_LIMITS`.                                                                                                                                                                                                                        |
| Plan-Engine            | `planInputsSchema` (`plan/inputs.ts`) mit **einem** `minutesPerSession`, `sessionsPerWeek`, `preferredDays`, `trainingLocation`; `matchTemplate()` (`match.ts`), `adaptTemplate()` → `fitSessionToMinutes()` (`adapt.ts`), `chooseTrainingDays()`, `buildPlanBlock()`, `nextPlanBlock()`, `hasBackToBackSessions()` (`schedule.ts`), `rescheduleSession()` (`reschedule.ts`), `capWeeklyIncrease()` (`volume.ts`, gebaut, noch nicht angewendet). |
| Ausdauer               | Ziel `endurance` nutzt bis Phase 10 eine Allgemeine-Fitness-Vorlage (`GOAL_TEMPLATE_MAPPING`), Hinweis `goal_endurance_not_yet`. Keine Ausdauer-Einheiten.                                                                                                                                                                                                                                                                                        |
| Pläne in der Datenbank | **Etappe B (gemergt, PR #7):** `planned_sessions` hat `focus session_focus not null`, `template_day_index not null`; `user_plans.template_id not null`; `private.assert_plan_inputs()` erlaubt nur die Schlüssel `goalType … preferredDays, trainingLocation, homeEquipment`; Zod-Gegenstück `savePlanInputsSchema` in `plan/payload.ts`.                                                                                                         |

**Auffälligkeit beim Prüfen (wird mit behoben):** `snapToAvailableWeight()` (`plan/loads.ts`) behandelt die
Stufen der Langhantel wie Gesamtgewichte. Eingetragen werden aber **Scheiben** – ein Zielgewicht von 40 kg würde
z. B. auf die Scheibe „20“ gerundet. Mit Stange + Scheiben (Abschnitt 4.3) rechnet die Engine künftig die ladbaren
Gesamtgewichte. Bis dahin bleiben Zielgewichte ohnehin leer („Startgewicht finden“, PLAN-PHASE-3 5.8).

## 3. Onboarding-UX am Handy

### 3.1 Ablauf

Bisher: Ziel → Zeitbudget → **Trainingsort** → Equipment. Neu: Ziel → **Trainingstage** → Equipment.

- Der Schritt **Trainingsort entfällt**: Der Ort ergibt sich aus den gewählten Arten
  (`deriveTrainingLocation()` in core): nur „Kraft im Studio“ → `gym`, nur „Kraft zu Hause“ → `home`, beides →
  `both`, nur Ausdauer → `null` (kein Kraft-Ort). Das ist kürzer und es gibt keine Widersprüche (z. B. Ort „Studio“,
  aber Tag „Kraft zu Hause“).
- **Equipment** erscheint, sobald mindestens ein Tag „Kraft zu Hause“ ist.
- Technisch bleibt `training_location` in `ONBOARDING_STEPS` (sonst müsste die CHECK-Bedingung von
  `profiles.onboarding_step` geändert werden), ist aber **nie anwendbar** – `resumeStep()` springt bei alten
  Ständen automatisch zum nächsten Schritt. `goals.training_location` wird weiter geschrieben (abgeleitet).

### 3.2 Bildschirm „Deine Trainingstage“ (ersetzt „Dein Zeitbudget“)

Oben ein Umschalter mit zwei großen Knöpfen:

**A) „Feste Wochentage“ (Standard)**

1. Sieben Chips **Mo Di Mi Do Fr Sa So** (wie heute, ≥ 44 px, ausgeschriebene Namen für Screenreader).
2. Für **jeden gewählten Tag** erscheint eine Karte, sortiert Mo → So, z. B. „**Montag**“:
   - **Was?** drei Knöpfe: „Kraft im Studio“ · „Kraft zu Hause“ · „**Ausdauer**“ mit Untertitel nach Disziplin
     (`enduranceSlotSubtitle()` in core): ohne Disziplin/Laufdisziplinen „Laufen“, `cycling` „Radfahren“,
     `swimming` „Schwimmen“, Triathlon „Laufen und Rad“. Der Untertitel nennt die Wunsch-Sportart; ob der Plan
     vorsichtiger startet (z. B. zügiges Gehen), sagt erst der Plan mit dem Hinweis `endurance_walk` (5.8).
   - **Wie lange?** Chips 20 · 30 · 45 · 60 · 90 min und „Eigene“ (Zahlenfeld 10–240).
   - Vorbelegung, damit wenig getippt werden muss: Art = Art des zuletzt bearbeiteten Tags, sonst Vorschlag nach
     Ziel (`suggestedSlotKind()` – Ziel Ausdauer → „Ausdauer“, sonst „Kraft im Studio“); Dauer = zuletzt gewählte,
     sonst `DEFAULT_SLOT_MINUTES` je Art (Kraft 60, Ausdauer 30).
3. Unter der ersten Karte ein Knopf **„Für alle Tage übernehmen“** (Art und Dauer auf alle gewählten Tage).
4. Abwählen eines Tages entfernt die Karte (die Eingaben bleiben bis zum Verlassen des Bildschirms gemerkt).

**B) „Tage egal – verteilt für mich“**

Je Art eine Zeile mit Zähler (− 0 +) und Standarddauer (gleiche Chips + „Eigene“):

- „Kraft im Studio: 2× à 60 min“
- „Kraft zu Hause: 0×“
- „Ausdauer – Laufen: 2× à 30 min“

Summe 1–7. Die Engine verteilt die Tage (Abschnitt 5.5).

**Unten immer** eine Live-Zusammenfassung, z. B. „4 Tage: 2× Kraft im Studio, 2× Laufen · 180 min pro Woche“, und
– falls zutreffend – **freundliche, nicht blockierende Hinweise** aus `scheduleHints()` (core):

| Code                          | Text (Entwurf)                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `endurance_goal_no_endurance` | „Dein Ziel ist Ausdauer – wir empfehlen mindestens 2 Ausdauer-Tage.“                                                                            |
| `strength_goal_no_strength`   | „Für Muskelaufbau/Definition empfehlen wir mindestens 2 Kraft-Tage.“                                                                            |
| `strength_days_over_max`      | „Mehr als 4 Kraft-Tage planen wir nicht – die übrigen werden Ruhetage mit lockerer Bewegung.“                                                   |
| `strength_back_to_back`       | „Kraft an zwei Tagen hintereinander: Wir achten darauf, dass nicht dieselben Muskeln dran sind.“                                                |
| `no_rest_day`                 | „Kein Ruhetag – mindestens einer pro Woche ist für die Erholung wichtig.“                                                                       |
| `week_total_capped`           | „Mehr als 5 Einheiten planen wir für dich noch nicht – mindestens 2 Ruhetage helfen beim Erholen.“ (nur bei den Gruppen mit Gesamt-Deckel, 5.2) |

Fehler (blockierend, Zod): kein Tag gewählt; Minuten außerhalb 10–240 oder keine ganze Zahl; Flex-Summe 0 oder > 7.

### 3.3 Equipment: Gewichte zum Antippen

Je Gerät mit Gewichten erscheint nach dem Anhaken eine Karte:

| Gerät                               | Chips (Mehrfachauswahl)                                                                                                        | Zusatz                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Kurzhanteln (Gewicht **je Hantel**) | 1–10 in 1-kg-Schritten, 12, 12,5, 14, 15, 16, 17,5, 18, 20, 22, 22,5, 24, 25, 26, 27,5, 28, 30, 32, 32,5, 34, 35, 36, 37,5, 40 | eigene Werte                                  |
| Langhantel – **Stange**             | 10 · 15 · 20 (Einfachauswahl, vorbelegt 20)                                                                                    | eigene Stange (5–25 kg, z. B. SZ-Stange 7 kg) |
| Langhantel – **Scheiben**           | 1,25 · 2,5 · 5 · 10 · 15 · 20 · 25 (je Paar)                                                                                   | eigene Werte (z. B. 0,5)                      |
| Kettlebells                         | 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 32                                                               | eigene Werte                                  |

- **Preset-Listen liegen in core**, nicht in der UI: neues Feld `weightPresetsKg` je Katalog-Eintrag in
  `packages/core/src/equipment.ts` (Quelle: übliche Handelsgrößen, PRODUKTENTSCHEIDUNG), dazu
  `BARBELL_BAR_PRESETS_KG` und `BARBELL_BAR_KG` (5–25) in `constants.ts`. Auch die Minuten-Presets wandern nach core
  (`MINUTE_PRESETS` → `constants.ts`), die UI liest sie nur.
- Ausgewählte Chips sind gefüllt (Häkchen + Farbe, nicht nur Farbe); Tippen schaltet um. Eigene Werte erscheinen als
  zusätzliche, ausgewählte Chips (wie heute mit „✕“). Die vorhandene Eingabe „Gewicht in kg + Hinzufügen“ bleibt.
- Knopf „Alle abwählen“ je Gerät. Hinweis „Gewicht **je Hantel**“ bei Kurzhanteln, „je **Paar**“ bei Scheiben.
- Grenze bleibt `EQUIPMENT_LIMITS.maxWeightSteps` = 40 je Gerät. Ein Test prüft für **jede** Preset-Liste
  „Länge ≤ `maxWeightSteps`“ (keine feste Zahl im Test; die Kurzhantel-Liste hat derzeit 33 Werte). Bei Erreichen: klare Meldung „Höchstens 40 Gewichtsstufen.“
- Studio-Geräte bleiben unsichtbar (bis Phase 9b „Mein Studio“, Annahme Standard-Studio).
- Weitere Geräte mit Gewichten (Gewichtsweste, SZ-Stange als eigenes Gerät …): nicht jetzt (Frage 10).

### 3.4 „Geschafft!“-Zusammenfassung und Einstellungen

`apps/mobile/src/lib/summary.ts` + `de.ts` (`done.timeBudgetValue` wird ersetzt):

- Feste Tage: „Mo Laufen 30 min · Mi Kraft im Studio 60 min · Sa Kraft zu Hause 90 min“ (eine Zeile je Tag).
- Flex: „2× Kraft im Studio à 60 min, 2× Laufen à 30 min – die Tage verteilen wir“.
- Zeile „Trainingsort“ entfällt; „Equipment“ zeigt Gewichte kompakt: „Kurzhanteln (2–20 kg, 8 Stufen),
  Langhantel (Stange 20 kg, Scheiben 1,25–20 kg)“.
- „Einstellungen → Training → Angaben ändern“ (PLAN-PHASE-3 10.4, Etappe C) öffnet den neuen Schritt statt
  „Zeitbudget“ + „Trainingsort“.

## 4. Datenmodell

### 4.1 Neue Tabelle `training_slots` (statt jsonb)

| Spalte                     | Typ                         | Regel                                                                         |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| `user_id`                  | uuid, `on delete cascade`   | Default `auth.uid()`                                                          |
| `slot_no`                  | smallint                    | 1–7; Primärschlüssel `(user_id, slot_no)` → höchstens 7 Einträge              |
| `weekday`                  | smallint **null**           | 1–7 (ISO); `null` = „Tag egal“; eindeutig `(user_id, weekday) where not null` |
| `kind`                     | `public.training_slot_kind` | `strength_gym`, `strength_home`, `endurance`                                  |
| `minutes`                  | smallint                    | `between 10 and 240` (= `TRAINING_LIMITS.minutesPerSession`)                  |
| `created_at`, `updated_at` | timestamptz                 | Trigger `private.set_updated_at()`                                            |

**Warum Tabelle statt jsonb in `goals`:** jede Grenze ist eine einfache CHECK-Bedingung bzw. ein Enum, die
`db-sync.test.ts` wie bei `goals`/`user_equipment` abgleichen kann; `database.types.ts` wird typisiert; das bewährte
Muster `replace_*` gibt es schon. Bei jsonb bräuchten wir eine eigene Prüffunktion wie `private.assert_plan_inputs()`
und hätten keine Typen.

**Regeln über mehrere Zeilen** (CHECK kann das nicht):

- Entweder **alle** Einträge haben einen Wochentag (fest) oder **keiner** (flex) – kein gemischter Modus (Frage 1).
- `slot_no` lückenlos 1…n.

Durchgesetzt so: `authenticated` bekommt auf `training_slots` **nur `select`**; geschrieben wird ausschließlich über
`public.replace_training_slots(p_items jsonb)` – `security definer`, `search_path = ''`,
`revoke … from public, anon`, prüft Login, **Profil zuerst** (wie alle Policies), Modus-Regel, Lückenlosigkeit,
mindestens 1 Eintrag, nur bekannte Felder (`private.assert_json_keys`, vorhanden seit Etappe B); löscht und
fügt in **einer** Transaktion ein. Fehlermeldungen deutsch, ohne Nutzerdaten. Zod-Gegenstück:
`trainingSlotsSchema` in core.

**RLS:** aktiviert; Policy „Nutzer sehen eigene Trainingstage“ (`user_id = (select auth.uid())`). Keine Insert-/
Update-/Delete-Policies für `authenticated`. Kontolöschung über Kaskade (`delete_my_account()`); „Testdaten
löschen“ im Testmodus betrifft den Gerätespeicher. Eine spätere Export-Funktion (Recht auf Auskunft) nimmt die
Tabelle auf.

**Kein Gesundheitsdatum:** Wochentage, Trainingsart und Minuten sind Vorlieben wie das bisherige Zeitbudget in
`goals` (dort ebenfalls ohne Einwilligung `health_data`). Sie werden deshalb nicht von
`private.consents_after_revoke()` gelöscht und dürfen offline in die Warteschlange (`isSensitiveOp()` = false).
Geprüft: Aus „Ausdauer – Laufen“ lässt sich kein Gesundheitszustand ablesen; vorsichtige Varianten (Gehen statt
Laufen) entstehen erst im **Plan**, und der ist bei Gesundheitsbezug bereits als Gesundheitsdatum eingestuft
(PLAN-PHASE-3 Abschnitt 9, Abschnitt 5.6 unten).

### 4.2 Alte Zeitbudget-Spalten in `goals`: übernehmen, dann entfernen (Weg a)

**Entscheidung (Wächter, Befund 5):** Die App ist unveröffentlicht; alte installierte Builds (APK/TestFlight) werden
**nicht** unterstützt. PR-Text und `docs/HANDY-ANLEITUNG.md` sagen: „Nach dem Merge die App **neu installieren**
(neuen EAS-Build laden) bzw. im Browser neu laden.“

Die B2-Migration macht in **einer** Datei, in dieser Reihenfolge:

1. Tabelle `training_slots` anlegen (4.1).
2. **Daten übernehmen** (`insert … select` aus `goals`, nur wo `sessions_per_week` gesetzt ist): Art aus
   `training_location` (`gym`/`both`/`null` → `strength_gym`, `home` → `strength_home`), Minuten =
   `minutes_per_session`. Anzahl Wunsch-Tage = `sessions_per_week` → feste Tage mit diesen Wochentagen; sonst flex mit
   `sessions_per_week` Einträgen (die Wunsch-Tage entfallen dann – im PR-Text erwähnt).
3. **Spalten entfernen:** `alter table public.goals drop column sessions_per_week, drop column minutes_per_session,
drop column preferred_days`. `goals.training_location` bleibt (abgeleitet geschrieben, 3.1).

Abhängigkeiten, die B2 mit anpasst (geprüft per Suche; `plan_templates.sessions_per_week` ist eine **andere** Spalte
und bleibt):

| Stelle                                                                                         | Änderung                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/db/src/database.types.ts`                                                            | `goals` ohne die drei Spalten; neue Tabelle/Funktion                                                                                                                               |
| `packages/core/src/db-sync.test.ts`                                                            | Abgleich `sessions_per_week`/`minutes_per_session` für `goals` entfällt; neue Abgleiche (4.5)                                                                                      |
| `packages/core/src/validation.ts`                                                              | `timeBudgetStepSchema` entfällt → `trainingScheduleSchema`                                                                                                                         |
| `apps/mobile/src/data/types.ts`, `mapping.ts`, `local-rules.ts`, `write-ops.ts`                | `TimeBudgetAnswer` → `TrainingScheduleAnswer`; `toGoalsRow()` ohne die Spalten; `upsert_goals` ohne Zeitprüfung                                                                    |
| `apps/mobile/src/data/local-backend.ts`                                                        | **Gerätespeicher des Testmodus:** beim Laden alte `goals`-Felder einmalig mit derselben Regel in `training_slots` umwandeln (`scheduleFromLegacyGoals()` in core – nur noch dafür) |
| `apps/mobile/src/lib/summary.ts`, `i18n/de.ts`, `steps/training-steps.tsx`                     | neue Zusammenfassung/Texte/Schritt                                                                                                                                                 |
| Tests: `mapping.test.ts`, `local-rules.test.ts`, `local-backend.test.ts`, `sync-queue.test.ts` | auf das neue Format; `sync-queue`: alte `upsert_goals` mit Zeitbudget-Spalten werden verworfen (4.5)                                                                               |
| pgTAP: `01_rls_isolation`, `03_profiles_and_limits`, `04_account_deletion`                     | `goals`-Zeilen ohne die Spalten; Grenz-Tests wandern zu `training_slots`                                                                                                           |

Plan-Angaben (`user_plans.inputs` mit `sessionsPerWeek` usw.) sind **keine** `goals`-Spalten; sie ändern sich erst mit
B3 (4.4). Damit ist auch der bisherige Hinweis „Wunsch-Tage“ (`preferred_days`) erledigt: Wunsch-Tage gibt es nur
noch als feste Tage im Modus „Feste Wochentage“.

### 4.3 Langhantel: Stange und Scheiben; Kurzhanteln je Hantel

- Neue Spalte `user_equipment.bar_kg numeric(4,2) null`, CHECK `bar_kg between 5 and 25`
  (`BARBELL_BAR_KG`) und `bar_kg is null or equipment_id = 'barbell'`.
- `weights_kg` der Langhantel = **Scheiben je Paar**, höchstens 25 kg je Scheibe (neue CHECK-Regel nur für
  `barbell`, `BARBELL_PLATE_MAX_KG = 25`), klar benannt in Kommentar und UI.
- **Reihenfolge in der B2-Migration (verbindlich):** **erst** die bestehenden Langhantel-Werte > 25 kg entfernen
  (nächster Punkt), **dann** den CHECK „Scheibe ≤ 25 kg“ anlegen – sonst scheitert die Migration an alten Zeilen.
  pgTAP prüft beides (Altwert entfernt, neuer Wert 27,5 abgelehnt).
- **Bestehende Langhantel-Werte > 25 kg** wurden früher wohl als Gesamtgewicht eingetragen. Sichere Wahl: Die
  B2-Migration **entfernt** sie (`update … set weights_kg = array(select … where w <= 25)`), statt sie zu deuten –
  ein falsch gedeutetes Gewicht wäre gefährlicher als ein fehlendes. Die App wurde bisher nur intern genutzt; der
  PR-Text erwähnt es.
- `replace_user_equipment` per `create or replace` in der neuen Migration um `bar_kg` im `jsonb_to_recordset`
  erweitert (Signatur gleich). `equipmentItemSchema` bekommt `barKg` (nur bei `barbell`) und die 25-kg-Regel.
- Core: `barbellLoadSteps(barKg, plates)` = alle ladbaren Gesamtgewichte = Stange + 2 × Teilsumme der Scheiben,
  **Annahme: von jedem angetippten Gewicht ein Paar** (Frage 8). Umsetzung als **Teilsummen-Verfahren
  (dynamische Programmierung) in ganzen 0,25-kg-Einheiten** (keine Gleitkomma-Fehler, keine Aufzählung aller
  2^n Teilmengen); Ergebnis gedeckelt auf `PLANNED_LOAD_LIMITS.targetWeightKg.max`, aufsteigend, eindeutig.
  Laufzeittest: 40 Scheiben (Maximum) in deutlich unter 50 ms. `equipmentProfile()` liefert für `barbell` diese
  Gesamtstufen, damit `snapToAvailableWeight()` richtig rundet. Ohne `bar_kg` gilt 20 kg mit Hinweis (Frage 9).
- **Kurzhanteln und Kettlebells:** `target_weight_kg` bedeutet **je Hantel bzw. je Kugel** (Kommentar an
  `PLANNED_LOAD_LIMITS` und in `loads.ts`, Anzeige „je Hantel“ in Etappe C/Phase 4).

### 4.4 Pläne: Art der Einheit (neue Migration NACH Etappe B)

Etappe B wird **nicht** geändert. Eine eigene Migration nach `20261004120100_training_plan_rpcs.sql`:

1. Enum `planned_session_kind` (`strength`, `endurance`) und `endurance_modality` (`run`, `walk`, `bike`, `swim`;
   `swim` nur mit Dauer und Anstrengung, ohne Technik – Frage 3).
2. `planned_sessions`:
   - `kind planned_session_kind not null default 'strength'` (bestehende Zeilen = Kraft),
   - `focus` und `template_day_index` **nullable**, CHECK: bei `kind = 'strength'` beide gesetzt,
     bei `endurance` beide leer,
   - `endurance_modality` null, `effort_target smallint` null (Anstrengung 1–10, Abschnitt 5.6), CHECK: beide gesetzt
     genau bei `kind = 'endurance'`,
   - `estimated_minutes` = geplante Dauer (Grenzen bleiben 1–600).
3. Ausdauer-Einheiten haben **keine** `planned_exercises` – geprüft in `private.insert_plan_sessions()` (per
   `create or replace` neu, Feldliste um `kind`, `endurance_modality`, `effort_target` erweitert).
4. `user_plans.template_id`, `template_title_de`, `template_version` **nullable** (nur reine Ausdauer-Pläne haben
   keine Vorlage), CHECK „alle drei gesetzt oder alle drei leer“; `save_training_plan` prüft: ohne Vorlage keine
   Kraft-Einheit.
5. `private.assert_plan_inputs()` per `create or replace` auf das neue Angaben-Format (Abschnitt 5.1): Schlüssel
   `schedule` statt `sessionsPerWeek`/`minutesPerSession`/`preferredDays`, `trainingLocation` nullable,
   `homeEquipment[].barKg`. Die Prüfung wird **verschachtelt** erweitert: `schedule` muss ein Objekt mit genau
   `mode` und `slots` sein, `mode` ∈ `fixed`/`flex`, `slots` 1–7 Objekte mit genau den erlaubten Schlüsseln
   (`weekday` nur bei `fixed`, eindeutig 1–7; `kind` aus `training_slot_kind`; `minutes` 10–240 ganzzahlig).
   Größe bleibt ≤ 4096 Byte (7 Einträge passen locker).
6. `plan_note`: neue Werte per `alter type … add value` (Abschnitt 5.8). Achtung: neue Enum-Werte dürfen in derselben
   Transaktion nicht benutzt werden → eigene Migrationsdatei vor der Funktions-Migration.
7. Der Verschiebe-Trigger `private.planned_sessions_before_update` bleibt unverändert (ISO-Woche, nie vor heute, nie
   zwei Einheiten am Tag gelten für beide Arten).

### 4.5 Abgleich, Typen, Testmodus

- `db-sync.test.ts`: neue Enums (`training_slot_kind`, `planned_session_kind`, `endurance_modality`, neue
  `plan_note`-Werte), Grenzen `minutes between 10 and 240`, `slot_no between 1 and 7`, `bar_kg between 5 and 25`,
  Feldlisten von `replace_training_slots`/`insert_plan_sessions`/`assert_plan_inputs` = Zod-Schemas – **auch die
  verschachtelten Schlüssel** (`schedule` → `mode`, `slots`; `slots[]` → `weekday`, `kind`, `minutes`;
  `homeEquipment[]` → `equipmentId`, `weightsKg`, `barKg`), nicht nur die oberste Ebene (B3).
- `packages/db/src/database.types.ts`: neue Tabelle, Spalten, Enums, Funktion (gen-types-Format).
- App (`apps/mobile/src/data`):
  - `types.ts`: `TimeBudgetAnswer` → `TrainingScheduleAnswer`; `UserRows` um `trainingSlots`.
  - `write-ops.ts`: neuer Vorgang `replace_training_slots` (nicht sensibel); `UserEquipmentRow` mit `bar_kg`.
  - `mapping.ts`: Schritt `time_budget` → `replace_training_slots` + `upsert_goals` (abgeleiteter Ort); Rückweg aus
    `training_slots` (alte Spalten gibt es nicht mehr, 4.2).
  - `local-rules.ts`: `isValidOp()` prüft `replace_training_slots` mit `trainingSlotsSchema` (gleiche Regeln wie
    die Datenbank-Funktion) und `bar_kg`/Scheiben ≤ 25 kg; `upsert_goals` ohne Zeitbudget-Prüfung.
  - `local-backend.ts` (Gerätespeicher), `supabase-backend.ts` (`rpc('replace_training_slots')`), `sync-queue.ts`
    (Schlüssel `replace_training_slots` – neuester Stand gewinnt).
  - **Alte Einträge in der Offline-Warteschlange:** Wartende `upsert_goals`-Vorgänge mit `sessions_per_week`,
    `minutes_per_session` oder `preferred_days` würden nach dem Entfernen der Spalten am Server scheitern. Beim
    Laden der Warteschlange werden sie **still verworfen** (nicht umgewandelt): Die Trainingstage werden mit dem
    neuen Schritt ohnehin neu erfasst, und eine Umwandlung könnte einen neueren Stand überschreiben. Ziel und Ort
    gehen dabei nicht verloren, weil der Schritt „Ziel“ bzw. der neue Schritt `upsert_goals` erneut schreibt. Test in
    `sync-queue.test.ts`: alter Eintrag wird verworfen, neuer `upsert_goals` ohne die Spalten bleibt.
  - `state/flow.ts`/`plan-save.ts`: `OnboardingState` bekommt `hasHomeStrength` statt des Orts aus dem Schritt.

## 5. Plan-Engine

### 5.1 Neue Eingaben

- `planInputsSchema`: `schedule` = `{ mode: 'fixed', slots: { weekday, kind, minutes }[] }` oder
  `{ mode: 'flex', slots: { kind, minutes }[] }` (1–7 Einträge) ersetzt `sessionsPerWeek`, `minutesPerSession`,
  `preferredDays`; `trainingLocation` wird abgeleitet (nicht mehr eingegeben); `homeEquipment[]` mit `barKg`.
- `planInputsSnapshot()` speichert den Zeitplan sortiert (Vergleich für `planNeedsUpdate()`).
- `PLAN_ENGINE_VERSION` → 2: Alte Pläne zeigen „Deine Angaben haben sich geändert – Plan neu erstellen?“ (nie stilles
  Ersetzen, PLAN-PHASE-3 10.4).

### 5.2 Tage auflösen (`resolveTrainingWeek()`, neu in `schedule.ts`)

Ergebnis: je Wochentag höchstens **eine** Einheit `{ weekday, kind, minutes }` – die Datenbank erlaubt nie zwei
Einheiten am selben Tag (Frage 2).

1. **Kraft-Deckel:** höchstens 4 Krafteinheiten (PLAN-PHASE-3 5.7). Bei mehr festen Kraft-Tagen bleiben die 4 mit dem
   größten Abstand (`chooseTrainingDays()`-Logik); die übrigen werden Ruhetage mit „lockere Bewegung“ (`days_capped`).
2. **Ausdauer-Deckel** je Level (`ENDURANCE_START_RULES.maxSessionsPerWeek`, PRODUKTENTSCHEIDUNG): Einsteiger 4,
   Fortgeschritten 5, Leistungssport 6; vorsichtig, unter 18 oder ab 65: 3. Überzählige → Ruhetag
   (`endurance_days_capped`).
3. **Gesamt-Deckel** (`WEEKLY_SESSION_LIMITS` in `constants.ts`, als **PRODUKTENTSCHEIDUNG** kommentiert): Für
   Einsteiger, vorsichtige Pläne (Flag oder ohne Check), unter 18 und ab 65 höchstens **5 Einheiten pro Woche**, also
   mindestens **2 Ruhetage**. Überzählige Tage werden Ruhetage – zuerst Ausdauer-Tage mit der kürzesten Dauer, dann
   Kraft-Tage nach der Abstandsregel; Hinweis-Code `week_total_capped`. Für alle anderen: kein Deckel, bei 7 Tagen
   Hinweis `no_rest_day` (Frage 6).
4. **Flex:** zuerst die Kraft-Tage mit `chooseTrainingDays(n, [])` (Standardmuster, größte Abstände), dann die
   Ausdauer-Tage auf die freien Tage mit größtmöglichem Abstand untereinander; bei Gleichstand bevorzugt **nicht** der
   Tag direkt nach einer Ganzkörper-/Unterkörper-Einheit, dann lexikografisch kleinste Auswahl (deterministisch).

### 5.3 Kraft-Tage mit eigener Dauer

- **Vorlage wählen:** `matchTemplate()` bekommt die Zahl der Kraft-Tage (statt `sessionsPerWeek`) und als
  Dauer die **längste** Kraft-Dauer der Woche. Begründung: Lange Tage sollen die volle Vorlage bekommen; kürzere
  werden pro Tag gekürzt. Umgekehrt (kürzeste Dauer) würde an langen Tagen Umfang fehlen, weil „über der Vorlage“
  nichts ergänzt wird (5.6 bleibt so).
- **Pro Tag kürzen:** `adaptTemplate()` passt Übungen an Ort/Sicherheit an (ohne Minuten); erst beim Platzieren
  (`placeWeeks()`) wird jede Einheit mit `fitSessionToMinutes(exercises, minutesDesTages, library)` gekürzt. Weil die
  Rotation (1–2 Tage, A/B/C) dieselbe Vorlagen-Einheit an verschiedene Tage legt, muss das je Termin passieren.
  Hinweise `minutes_shortened`/`minutes_below_minimum`/`volume_reduced` wenn **irgendein** Tag betroffen ist.
- **Pro Tag Ort:** Kraft im Studio → Studio-Profil, Kraft zu Hause → Heim-Profil. `adaptTemplate()` läuft je
  vorkommendem Ort einmal; jede Einheit wird in der Fassung ihres Orts platziert.
  Vorlagen-Ort = **Mehrheit** der Kraft-Tage, bei Gleichstand Studio (wie bisher „beides“ = Studio, Frage 5); die
  andere Fassung entsteht über den vorhandenen Übungs-Tausch (`findSubstitute()`), Hinweis `location_mismatch` wie
  bisher.
- **Folgeblock** (`nextPlanBlock()`): `baseSessionsFromBlock()` nimmt nur Kraft-Einheiten.
  **Wochentag und Art je Tag** kommen aus den `planned_sessions` der **letzten Belastungswoche** des Plans (nicht
  aus einer neuen Verteilung) – das gilt besonders für „Tage egal“, wo `inputs.schedule` keine Wochentage enthält.
  Die **Wunsch-Minuten je Art** (Kürzen, Ausdauer-Obergrenze) kommen aus `inputs.schedule`; die Ort-Fassung aus der
  Art des Tages. Verschobene Einheiten zählen mit ihrem ursprünglichen Tag (`original_date`).

### 5.4 Erholung: 48-Stunden-Regel und Lauftage

- Bleibt für **Kraft gegen Kraft**: Ganzkörper bzw. gleicher Schwerpunkt nicht an zwei Tagen hintereinander
  (`hasBackToBackSessions()`, `back_to_back_sessions`).
- **Lockere Ausdauer** zählt **nicht** als Konflikt – weder davor noch danach (geringe Belastung, Gesprächstempo).
  PRODUKTENTSCHEIDUNG, fachlich zu prüfen; Intervalle/harte Läufe gibt es erst in Phase 10, dann wird die Regel
  erweitert.
- `rescheduleSession()` bekommt `kind`: Kraft prüft wie bisher nur gegen Kraft-Nachbarn; Ausdauer darf auf jeden
  freien Tag derselben ISO-Woche ab heute; Erholungswoche → streichen; nie zwei Einheiten am Tag.

### 5.5 Ausdauer-Tage ohne KI: „lockerer Dauerlauf“ bis Phase 10

Neue Datei `packages/core/src/plan/endurance.ts`, reine Funktionen.

**`enduranceModality(goal, discipline, rules, weekIndex)`** – strengste Zeile gewinnt (von oben nach unten):

| Lage                                | Modalität                                                                                                                                                                           | Anstrengung |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Schwangerschaft                     | **nur** zügiges Gehen (`walk`) oder stationäres Rad/Ergometer (`bike`, Text „Ergometer“); bei Disziplin `swimming` lockeres Schwimmen (`swim`); **nie Rad im Freien** (Sturzrisiko) | ≤ 3         |
| Gesundheits-Flag (jedes) oder ab 65 | zügiges Gehen (`walk`); bei `cycling` Ergometer, bei `swimming` lockeres Schwimmen                                                                                                  | ≤ 3         |
| **ohne Gesundheits-Check**          | Laufen im **Geh-Lauf-Wechsel** (`run`, Text „1 Minute laufen, 2 Minuten gehen“), Startumfang „vorsichtig“                                                                           | ≤ 3         |
| Einsteiger (erste 4 Wochen)         | Laufen im Geh-Lauf-Wechsel                                                                                                                                                          | 3–4         |
| sonst                               | ohne Disziplin / 5 km–Marathon `run`; `cycling` `bike`; `swimming` `swim` (nur Dauer + Anstrengung); Triathlon abwechselnd `run`/`bike`                                             | 3–4         |

Ausweichen auf Laufband, Ergometer oder Rudergerät steht als fester Satz im Text (bei Schwangerschaft nur Laufband
im Gehtempo und Ergometer).

**`enduranceWeekVolumes(…)`** – Wochenumfang in ganzen Minuten:

1. **Startumfang** `S = min(Wunsch, startWeeklyMinutes[Gruppe])` (`ENDURANCE_START_RULES`, PRODUKTENTSCHEIDUNG):
   Einsteiger 60, Fortgeschritten 120, Leistungssport 150; „vorsichtig“ (Flag, ohne Check, ab 65, unter 18,
   Schwangerschaft) 45. Wunsch = Summe der gewünschten Ausdauer-Minuten der Woche.
2. **Prüfbare 10-%-Regel:** Umfang einer Belastungswoche ≤ `Math.floor(1,1 × U_ref)`, wobei `U_ref` = Umfang der
   **letzten Belastungswoche**. **Woche 0 und Erholungswochen zählen nie als Bezug.** Gibt es keine Bezugswoche
   (erste Belastungswoche eines neuen Plans), gilt der Startumfang `S` – **nicht** der Wunsch.
   `capWeeklyIncrease(previous, planned, start)` wird dafür geändert: bei `previous ≤ 0` → `min(planned, start)`
   statt `planned` (bisher „ohne Vorwoche gilt der Plan“); Ergebnis immer mit `Math.floor` auf ganze Minuten. Nie
   über dem Wunsch. Kommentar an `MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION` wird entsprechend ergänzt.
3. **Woche 0 / Einstiegswoche:** Woche 0 bekommt höchstens den Anteil von `S` für ihre Resttage; die erste
   Belastungswoche danach startet mit `S` (Woche 0 ist kein Bezug).
4. **Erholungswoche:** `Math.floor(U_ref × 0,6)` (`ENDURANCE_DELOAD_VOLUME_FACTOR`), Anstrengung locker.
5. **Folgeblock:** `U_ref` = **Summe der geplanten Ausdauer-Minuten der letzten Belastungswoche** aus
   `planned_sessions` (nicht die Erholungswoche) → erste Woche des neuen Blocks ≤ `floor(1,1 × U_ref)`.
   **Gestrichene Einheiten (`status = 'skipped'`) zählen nicht** – wer weniger geschafft hat, steigert nicht von
   einem Umfang, den es nie gab (vorsichtige Wahl; verschobene Einheiten zählen normal). Der Start-Deckel je Einheit
   wird im Folgeblock aus der längsten nicht gestrichenen Ausdauer-Einheit dieser Woche fortgeschrieben.
6. **Verteilung auf die Tage** proportional zu den Wunsch-Minuten (`Math.floor`, Rest-Minuten der Reihe nach an die
   längsten Wunsch-Tage), dann je Einheit:
   - **Deckel je Einheit** (PRODUKTENTSCHEIDUNG, `ENDURANCE_SESSION_LIMITS`): bei ≥ 2 Ausdauer-Einheiten höchstens
     **50 % des Wochenumfangs**; in der ersten Belastungswoche höchstens **90 Minuten**; nie über der Wunsch-Dauer
     des Tages.
   - **Start-Deckel je Einheit** `ENDURANCE_SESSION_LIMITS.startSessionMinutes` (PRODUKTENTSCHEIDUNG): Einsteiger
     **30**, vorsichtig (Flag, ohne Check, ab 65, unter 18, Schwangerschaft) **20** Minuten, sonst kein eigener
     Start-Deckel. Gilt in der **ersten Belastungswoche** zusätzlich zu 50 %/90 min (der strengste Deckel gewinnt);
     danach wächst er je Belastungswoche mit derselben 10-%-Regel (`floor(1,1 × Deckel der Vorwoche)`, Woche 0 und
     Erholungswoche zählen nicht), nie über die Wunsch-Dauer.
   - Was durch einen Deckel „übrig“ bleibt, **verfällt** (nie auf andere Tage über deren Wunsch oder Deckel).
   - **Mindestgröße 10 Minuten innerhalb der Wochengrenze:** Ist eine Einheit kürzer als 10 Minuten, wird sie
     **gestrichen** (Tag = Ruhetag) und ihre Minuten gehen an die übrigen Einheiten (bis zu deren Deckel); reicht
     der Wochenumfang nicht für eine einzige 10-Minuten-Einheit, entfällt Ausdauer in dieser Woche mit Hinweis. Die
     Wochensumme bleibt dabei immer ≤ Wochengrenze.

**`buildEnduranceSession(…)`**: `name_de` z. B. „Lockerer Dauerlauf“ / „Geh-Lauf-Wechsel“ / „Zügiges Gehen“ /
„Lockere Radeinheit“ / „Ergometer locker“ / „Lockeres Schwimmen“, `estimated_minutes`, `effort_target`,
`warmup_de` („5 Minuten zügig gehen“), `cooldown_de` („5 Minuten locker auslaufen bzw. gehen, leicht dehnen“). Die
festen deutschen Textbausteine stehen in core (`ENDURANCE_TEXTS_DE`) und werden fachlich mitgeprüft – keine KI.

**Anstrengung** als Zahl 1–10 + Gesprächstest: „Du kannst dich noch in ganzen Sätzen unterhalten“ (nicht das
Kraft-RPE mit „Wiederholungen in Reserve“).

### 5.6 Sicherheitsregeln auch für Ausdauer (in `constants.ts`, mit Quellen)

`planSafetyRules()` erhält zusätzlich `enduranceEffortMax` und `enduranceWalkOnly` (strengste Regel gilt, wie
bisher):

| Regel                                                                                                             | Wert                                                                                                                                      | Quelle / Einordnung                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Locker = Anstrengung 3–4 von 10, Gesprächstest                                                                    | `effort_target` 3–4                                                                                                                       | Borg GA (1982), Med Sci Sports Exerc 14(5):377–381 (CR10-Skala); Foster C et al. (2008), J Cardiopulm Rehabil Prev 28(1):24–30 (Talk-Test); Seiler S (2010) – vorhandene `ENDURANCE_HIGH_INTENSITY_SHARE`                                                                                                        |
| Gesundheits-Flag / ab 65                                                                                          | Anstrengung ≤ 3, zügiges Gehen statt Laufen                                                                                               | PRODUKTENTSCHEIDUNG (Aufprall analog `high_impact` der Kraftregeln); PAR-Q+ (Warburton 2011) begründet nur die Flags                                                                                                                                                                                             |
| Ohne Gesundheits-Check                                                                                            | Anstrengung ≤ 3, Laufen nur im Geh-Lauf-Wechsel, Startumfang „vorsichtig“                                                                 | PRODUKTENTSCHEIDUNG (offene Gründer-/Fachfrage 14)                                                                                                                                                                                                                                                               |
| Schwangerschaft                                                                                                   | nur zügiges Gehen oder Ergometer, lockeres Schwimmen erlaubt, **nie Rad im Freien**; Anstrengung ≤ 3; Hinweis „mit Ärztin/Arzt abstimmen“ | ACOG Committee Opinion No. 804 (2020), Obstet Gynecol 135(4):e178–e188 (moderate Aktivität, Talk-Test; Aktivitäten mit Sturzrisiko meiden); Auswahl der Modalitäten = PRODUKTENTSCHEIDUNG                                                                                                                        |
| Unter 18                                                                                                          | Start wie vorsichtig, Anstrengung ≤ 4                                                                                                     | PRODUKTENTSCHEIDUNG                                                                                                                                                                                                                                                                                              |
| Steigerung Wochenumfang                                                                                           | ≤ `floor(1,1 × letzte Belastungswoche)`                                                                                                   | **Pflicht laut CLAUDE.md**; ehrlich: die 10-%-Regel ist wissenschaftlich **schwach belegt** – Buist I et al. (2008), Am J Sports Med 36(1):33–39 fand bei Laufanfängern keinen Unterschied in der Verletzungsrate gegenüber schnellerer Steigerung. Wir behalten sie als vorsichtige Obergrenze                  |
| Startumfang, Einheiten-Deckel (50 %/90 min, Start je Einheit 30/20 min), Gesamt-Deckel 5/Woche, Deload-Faktor 0,6 | siehe 5.5                                                                                                                                 | PRODUKTENTSCHEIDUNG; Orientierung WHO-Leitlinie 2020 (Bull FC et al., Br J Sports Med 54:1451–1462: 150–300 min moderat/Woche); Deload-Faktor nur in **Anlehnung** an Bosquet L et al. (2007), Med Sci Sports Exerc 39(8):1358–1365 (Tapering vor Wettkämpfen: Umfang −41–60 %; keine Studie zu Erholungswochen) |
| Arzt-Hinweis                                                                                                      | auch über Ausdauer-Einheiten                                                                                                              | wie Kraft (`medical_notice`)                                                                                                                                                                                                                                                                                     |

Unsichere Werte sind im Code als **PRODUKTENTSCHEIDUNG** markiert und gehen in die fachliche Prüfung.
**Gesundheitsbezug:** „Zügiges Gehen“ entsteht nur bei Flag, Schwangerschaft oder ab 65. Flags und Schwangerschaft
setzen einen Gesundheits-Check voraus → der Plan ist ohnehin Gesundheitsdatum (`uses_health_data`). „Ab 65“ folgt
aus dem Geburtsdatum (kein Gesundheitsdatum). Der gespeicherte Hinweis `endurance_walk` nennt keinen Grund.

### 5.7 Erzeugen und Speichern

- `generateTrainingPlan()`: Angaben → Sicherheitsregeln → Woche auflösen (5.2) → bei Kraft-Tagen Vorlage + Anpassung
  (5.3) → `buildPlanBlock()` mit gemischten Tagen (Kraft-Rotation nur über Kraft-Tage, Ausdauer nach 5.5) →
  Hinweise. **Nur Ausdauer** → Plan ohne Vorlage (`template_id` usw. leer, `match_quality = 'exact'`).
  **Nur Kraft** → Ergebnis wie heute (Regressionstest: gleiche Einheiten wie Engine-Version 1 bei gleichen Tagen und
  einheitlicher Dauer).
- `GeneratedSession` + `generatedSessionSchema`: `kind`, `endurance_modality`, `effort_target`; Kraft ⇒ 1–8 Übungen
  und `focus`; Ausdauer ⇒ 0 Übungen. `toSavePlanPayload()`/`toAppendBlockPayload()` und die strikten Schemas in
  `plan/payload.ts` (seit Etappe B auf `main`) werden in B3 entsprechend erweitert.
- `GeneratedPlan.training_days` → `training_week` (`{ weekday, kind, minutes }[]`) als Anzeige; der Folgeblock
  liest Tage und Arten aus den gespeicherten Einheiten (5.3).
- **Vormerkung Phase 4:** Weil dieselbe Vorlagen-Einheit an verschiedenen Tagen unterschiedlich gekürzt sein kann
  (z. B. Mo 20 min mit 3 Übungen, Sa 90 min mit 6), muss die doppelte Progression **je Übung** über alle Fassungen
  hinweg rechnen (Bezug = letzte Ausführung derselben `exercise_id`, nicht dieselbe Einheit).

### 5.8 Hinweis-Codes (`PLAN_NOTES`, neue Werte)

`endurance_days_capped`, `endurance_volume_ramped` („Wir starten mit X Minuten und steigern jede Woche höchstens um
10 %“), `endurance_walk` („Wir starten mit zügigem Gehen“ – ohne Begründung, damit kein Gesundheitsbezug entsteht),
`rest_day_added`, `week_total_capped`. `goal_endurance_not_yet` bleibt nur, wenn Ziel Ausdauer **ohne** Ausdauer-Tag gewählt ist; sonst
neu `endurance_basic_only` („Wettkampfpläne und Tempo-Training kommen später“).

## 6. Tests (Grenzfälle nach CLAUDE.md)

**`packages/core` (Vitest):**

- `trainingSlotsSchema`/`trainingScheduleSchema`: 0 und 8 Einträge abgelehnt; Wochentag doppelt; gemischter Modus;
  Minuten 9/10/240/241, 45,5; Flex-Summe 7 ok, 8 abgelehnt.
- `deriveTrainingLocation()`, `scheduleHints()`, `enduranceSlotSubtitle()`, `scheduleFromLegacyGoals()` (Wunsch-Tage
  = Anzahl → fest, sonst flex; nur noch für den Gerätespeicher des Testmodus).
- `weightPresetsKg`: jede Liste erfüllt `weightStepKgSchema`, Länge ≤ `EQUIPMENT_LIMITS.maxWeightSteps`, aufsteigend,
  eindeutig; Scheiben ≤ 25 kg. `barbellLoadSteps()`: ohne Scheiben = nur Stange; Stange 20 + {1,25; 2,5} → 20, 22,5,
  25, 27,5; 0,25-kg-Raster ohne Gleitkomma-Reste; Deckel `PLANNED_LOAD_LIMITS`; aufsteigend/eindeutig;
  **Laufzeit 40 Scheiben**.
- `resolveTrainingWeek()`: **1 vs. 7 Tage**; 7 × Kraft (Fortgeschritten) → 4 Kraft + 3 Ruhetage; 7 Tage bei
  Einsteiger/vorsichtig/unter 18/ab 65 → höchstens 5 Einheiten, `week_total_capped`; 7 × Laufen Einsteiger →
  Ausdauer-Deckel 4; flex deterministisch.
- `enduranceModality()`: Tabelle 5.5 vollständig – Schwangerschaft (Gehen/Ergometer, Schwimmen bei `swimming`,
  **nie** `bike` im Freien, auch nicht bei `cycling`/Triathlon), Flag, ab 65, ohne Check (Geh-Lauf-Wechsel, ≤ 3),
  Einsteiger, Disziplinen.
- `capWeeklyIncrease()`/`enduranceWeekVolumes()`: **Vorwoche 0 → Startumfang** (nicht Wunsch); **Rundung**
  `Math.floor` (z. B. 55 → 60, 59 → 64); **nach Erholungswoche** Bezug = letzte Belastungswoche (nie die
  Erholungswoche, nie Woche 0); Erholungswoche = floor(0,6 × Bezug); Einheiten-Deckel 50 % (bei ≥ 2 Einheiten) und
  90 min am Start; **Start-Deckel je Einheit** (Einsteiger mit Wunsch 60 min → Woche 1 höchstens 30, Woche 2
  höchstens 33; vorsichtig 20 → 22; Überschuss verfällt, Wochensumme sinkt entsprechend); Einheit < 10 min →
  gestrichen, Wochensumme bleibt ≤ Grenze; Folgeblock-Bezug = Summe der Ausdauer-Minuten der letzten Belastungswoche
  **ohne gestrichene (`skipped`) Einheiten** (Test: eine von drei Einheiten gestrichen → Bezug nur aus zwei).
- `generateTrainingPlan()`: **nur Laufen** (kein Template, keine Übungen, 10-%-Regel jede Woche, Deload 0,6),
  **nur Kraft** (Regression wie Version 1), **gemischt** (Mo Laufen 30, Mi Studio 60, Sa Zuhause 90 → Mi Studio-Fassung,
  Sa Heim-Fassung, Sa nicht gekürzt, Mi gekürzt falls Vorlage > 60), **10 vs. 240 min** (10 = `minutes_below_minimum`
  bzw. Ausdauer 10 min; 240 = nichts ergänzt, Ausdauer-Start trotzdem gedeckelt), **sehr alt/jung** (16, 17, 18, 64,
  65, 95 Jahre: Gehen ab 65, Anstrengung-Deckel), Schwangerschaft, ohne Check, Arzt-Hinweis.
- Eigenschaftstest über alle Kombinationen (Arten × Tage × Minuten × Level × Flags): Ausdauer-Umfang steigt nie > 10 %,
  nie zwei Einheiten am Tag, ≤ 4 Kraft-Einheiten, Grenzen von `generatedPlanSchema`.
- `rescheduleSession()` mit gemischten Arten; `nextPlanBlock()` bei „Tage egal“: Tage und Arten aus der letzten
  Belastungswoche, auch nach einer Verschiebung.

**Datenbank (pgTAP, Workflow `db-test`):** `replace_training_slots` (anon/fremde Person/ohne Profil abgelehnt, Modus,
Lücken, Grenzen, atomar), RLS nur eigene Zeilen, kein direktes Insert; Übernahme alter `goals` und **Entfernen der
Spalten**; Langhantel-Werte > 25 entfernt; `bar_kg`-CHECKs; verschachtelte Prüfung von `schedule` in
`assert_plan_inputs` (falscher Schlüssel in `slots[]`, `weekday` bei `flex`);
`planned_sessions` mit `kind` (Ausdauer ohne Übungen, Kraft ohne `focus` abgelehnt), Plan ohne Vorlage nur ohne
Kraft-Einheit, neues `assert_plan_inputs`, Fehlermeldungen ohne Detail.

**App:** `local-rules.test.ts`, `mapping.test.ts`, `supabase-backend.test.ts`, `sync-queue.test.ts`; Playwright im
Testmodus: feste Tage gemischt, flex, Gewichte antippen + eigener Wert, Zusammenfassung.

## 7. Abgrenzung zu Phase 10

| Kommt mit dieser Erweiterung                                    | Bleibt in Phase 10                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Ausdauer-Tage im Plan als lockere Einheit (Dauer + Anstrengung) | Periodisierung rückwärts vom Wettkampfdatum (Basis, Aufbau, Spitze, Tapering)                  |
| 10-%-Regel, Erholungswoche, Sicherheitsregeln für Ausdauer      | Intervalle, Tempoläufe, 80/20-Verteilung mit harten Einheiten, Zonen aus Testlauf/Herzfrequenz |
| Art „Ausdauer“ je Tag, Modalität aus der Disziplin              | Disziplin-Pläne (Schwimmtechnik, Koppeltraining Triathlon, Rad-Pläne)                          |
| –                                                               | Strecken, Karten, GPS-Aufzeichnung, GPX, Carb-Loading, Wettkampf-Verpflegung                   |
| –                                                               | Tagebuch-Einträge für Läufe (Phase 4: Distanz/Zeit/Pace manuell)                               |

## 8. Offene Fragen mit Empfehlung

1. **Gemischter Modus** (einige Tage fest, Rest egal)? _Empfehlung:_ nein – entweder fest oder flex; hält UI und
   Regeln einfach.
2. **Zwei Einheiten an einem Tag** (z. B. Kraft + Lauf)? _Empfehlung:_ nein; die Datenbank erlaubt bewusst nur eine
   Einheit je Tag. Später (Phase 10) ggf. als „Doppeltag“.
3. **Welche Ausdauer-Arten?** _Empfehlung:_ eine Art „Ausdauer“ mit Untertitel nach Disziplin; Modalität aus der Disziplin (Rad,
   Schwimmen nur Dauer/Anstrengung), Ausweichgeräte im Text. Keine eigene Art pro Sportart jetzt.
4. **Trainingsort-Schritt entfernen und ableiten?** _Empfehlung:_ ja (3.1).
5. **Vorlagen-Ort bei Studio und Zuhause gemischt:** _Empfehlung:_ Mehrheit der Kraft-Tage, Gleichstand = Studio.
6. **Gesamt-Deckel / Ruhetage?** _Empfehlung (Wächter):_ Einsteiger, vorsichtige Pläne, unter 18 und ab 65 höchstens
   5 Einheiten pro Woche (mindestens 2 Ruhetage, `week_total_capped`); alle anderen ohne Deckel, nur Hinweis
   `no_rest_day` – PRODUKTENTSCHEIDUNG, fachlich bestätigen.
7. **Startumfang Ausdauer** (60/120/150 min, vorsichtig 45), Deload 0,6, Einheiten-Deckel 50 %/90 min und
   Start-Deckel je Einheit (Einsteiger 30, vorsichtig 20 min, danach +10 %/Belastungswoche):
   _Empfehlung:_ so übernehmen, in der fachlichen Prüfung bestätigen lassen.
8. **Wie viele Scheiben je Gewicht?** _Empfehlung:_ Annahme „ein Paar je angetipptem Gewicht“ (vorsichtig, eher zu
   leicht); Anzahl erst, wenn Phase 4 echte Lasten plant.
9. **Stange nicht angegeben:** _Empfehlung:_ 20 kg vorbelegt, änderbar.
10. **Weitere Geräte mit Gewichten** (Gewichtsweste, SZ-Stange als eigenes Gerät, Hantelscheiben ohne Stange)?
    _Empfehlung:_ erst, wenn es Übungen dafür gibt (Inhalte Phase 2-Pipeline).
11. **Alte `goals`-Spalten?** _Entschieden (Wächter, Weg a):_ in B2 nach der Übernahme entfernen; alte Builds werden
    nicht unterstützt („App neu installieren“).
12. **Schwangerschaft:** _Entschieden (Wächter):_ nur zügiges Gehen oder Ergometer, lockeres Schwimmen erlaubt, nie
    Rad im Freien; Arzt-Hinweis. Fachliche Prüfung bleibt (ACOG erlaubt Laufen bei vorher Aktiven – das wissen wir
    ohne Rückfrage nicht).
13. **Ziel passt nicht zu den Tagen** (Ausdauer ohne Lauftag, Muskelaufbau nur Laufen)? _Empfehlung:_ nur Hinweis,
    nie blockieren.
14. **Ohne Gesundheits-Check laufen?** (offene Gründer-/Fachfrage) _Empfehlung (Wächter):_ ja, aber nur im
    Geh-Lauf-Wechsel mit Anstrengung ≤ 3 und Startumfang „vorsichtig“ (45 min/Woche); reines Gehen nur bei Flags,
    Schwangerschaft und ab 65. Begründung: Wer den Check ablehnt, ist nicht automatisch eingeschränkt; ein sehr
    vorsichtiger Lauf-Einstieg ist verantwortbar und bleibt durch die 10-%-Regel gebremst.

## 9. Etappen-Schnitt, Definition of Done

**Reihenfolge:** Etappe B ✔ (gemergt, PR #7) → **B2** → **B3** → Etappe C (App: Plan erzeugen, „Heute“). So baut C
direkt auf dem neuen Zeitplan auf und muss nicht zweimal gebaut werden. Jede Etappe ein eigener PR mit Wächter-Prüfung.

**Etappe B2 – Onboarding-Daten: Trainingstage + Gewichte** (unabhängig von der Plan-Engine)

1. Core: `trainingScheduleSchema`/`trainingSlotsSchema`, `TRAINING_SLOT_KINDS` (`enums.ts`), `deriveTrainingLocation()`,
   `scheduleHints()`, `suggestedSlotKind()`, `enduranceSlotSubtitle()`, `scheduleFromLegacyGoals()`,
   `weightPresetsKg`, `BARBELL_BAR_*`, `BARBELL_PLATE_MAX_KG`,
   `MINUTE_PRESETS`, `barbellLoadSteps()`, `equipmentItemSchema.barKg`, `onboarding.ts` (Ort-Schritt nie
   anwendbar, Equipment bei Heim-Kraft) – mit Tests.
2. Migration `2026100512xxxx_training_slots.sql` (Zeitstempel nach `20261004120100`): Enum, Tabelle, RLS,
   `replace_training_slots`, Übernahme aus `goals` **und Entfernen der drei Spalten** (4.2), **erst** Langhantel-Werte
   über 25 kg entfernen, **dann** CHECK „Scheibe ≤ 25 kg“ (4.3), `user_equipment.bar_kg`, `replace_user_equipment`
   neu; pgTAP; `db-sync`; `database.types.ts`; alle Abhängigkeiten aus der Tabelle in 4.2.
3. App: neuer Schritt „Deine Trainingstage“, Equipment-Chips, Zusammenfassung, `de.ts`, Datenebene (4.5),
   Umwandlung im Gerätespeicher des Testmodus.
4. **Kein** Übergangs-Adapter in der App: In B2 erzeugt die App noch keinen Plan (das kommt in C, nach B3). Die
   CI-Beispielpläne (`packages/content/src/plan-examples.ts`) behalten bis B3 ihre festen Test-Personen im alten
   Engine-Format – nur dort, falls nötig, ein kleiner Test-Helfer; `legacyPlanInputsFromSchedule()` entfällt.
5. PR-Text + `docs/HANDY-ANLEITUNG.md`: „Alte App-Builds werden nicht mehr unterstützt – bitte neu installieren“;
   Hinweis auf entfernte Langhantel-Werte > 25 kg und entfallene Wunsch-Tage bei Anzahl ≠ Tage.

_DoD:_ (1) Typen + Zod ✔ · (2) Migration mit RLS ✔ · (3) Core mit Tests ✔ · (4) UI mobil + Web ✔ · (5) Leer-/
Fehler-/Ladezustände ✔ · (6) Texte deutsch ✔ · (7) Doku: KONZEPT §2 (Schritte 7–9), §12 (Abweichungen),
PLAN-PHASE-3 Umsetzungsstand, HANDY-ANLEITUNG ✔.

**Etappe B3 – Plan-Engine mit Arten + Plan-Migration**

1. Core: Abschnitt 5 komplett (`inputs.ts`, `schedule.ts`, `endurance.ts`, `safety.ts`, `match.ts`, `adapt.ts`,
   `reschedule.ts`, `generate.ts`, `payload.ts`, `PLAN_ENGINE_VERSION = 2`), Konstanten mit Quellen, Beispielpläne in
   `packages/content/src/plan-examples.ts` um „nur Laufen“, „gemischt“, „Mo 20 / Sa 90“ (dieselbe Vorlagen-Einheit
   unterschiedlich gekürzt), „Schwangerschaft“ und „ohne Check“ ergänzt.
2. Migrationen nach Etappe B: `…_plan_session_kinds_enums.sql` (Enums, `add value`) und `…_plan_session_kinds.sql`
   (Spalten, CHECKs, `insert_plan_sessions`, `save_training_plan`, `append_plan_block`, `assert_plan_inputs` mit
   verschachtelter `schedule`-Prüfung); pgTAP; `db-sync` inkl. verschachtelter Schlüssel; Typen.
3. **Pflicht (aus B2 übernommen):** `equipmentProfile()` liefert für `barbell` die Gesamtstufen
   `barbellLoadSteps(barKg ?? BARBELL_DEFAULT_BAR_KG, Scheiben)`, damit `snapToAvailableWeight()` auf ladbare
   Gesamtgewichte rundet (Auffälligkeit Abschnitt 2) – mit Test (z. B. Ziel 40 kg, Stange 20 + {2,5; 5; 10} → 40, nicht
   „Scheibe 20“; ohne `barKg` 20-kg-Stange).

_DoD:_ (1) ✔ · (2) ✔ · (3) ✔ · (4)/(5) entfällt (C) · (6) Textbausteine deutsch ✔ · (7) KONZEPT §4 („Umsetzung“
Ausdauer-Basis), PLAN-PHASE-3 5.7/5.12 Verweis hierher ✔.

## 10. So testet ihr es am Handy

**Etappe B2 – Testmodus, keine Supabase nötig:**

1. Vorschau-Link aus dem PR öffnen (nach dem Merge: **https://fitnessapp-alpha-five.vercel.app**). Wer eine
   installierte Test-App (APK/TestFlight) nutzt: nach dem Merge **neu installieren** – alte Builds funktionieren
   nicht mehr.
2. **Einstellungen → Testdaten löschen**, Onboarding neu starten.
3. Bei „Deine Trainingstage“: Mo, Mi, Sa antippen → Mo „Ausdauer – Laufen“ 30 min, Mi „Kraft im Studio“ 60 min,
   Sa „Kraft zu Hause“ → „Eigene“ 90. Zusammenfassung unten prüfen. Es folgt **kein** Trainingsort-Schritt, aber der
   Equipment-Schritt (wegen „zu Hause“).
4. Equipment: Kurzhanteln anhaken → 2, 4, 6, 8, 10 antippen, eigenes Gewicht 11 hinzufügen; Langhantel → Stange 15,
   Scheiben 1,25, 2,5, 5, 10. Weiter.
5. „Geschafft!“ zeigt je Tag Art und Dauer und die Gewichte kurz.
6. Zurück und „Tage egal – verteilt für mich“: 2× Kraft im Studio à 45, 2× Laufen à 30 → Zusammenfassung „4 Tage“.
7. Fehlerfälle: kein Tag → Meldung; „Eigene“ 5 Minuten → „mindestens 10“.
8. Hell und dunkel ansehen; mit großer Schrift (Handy-Einstellung) prüfen, dass Chips umbrechen.

**Etappe B3:** im PR „Checks → ci → Summary“ → Beispielpläne „nur Laufen“ (Wochenminuten steigen höchstens 10 %,
Erholungswoche kürzer), „gemischt“ (Studio- und Heim-Fassung, Lauftage), „Mo 20 / Sa 90“ (Mo gekürzt, Sa
vollständig) und „Schwangerschaft“ (nur Gehen/Ergometer). Datenbank: Workflow `db-test` grün.
**Etappe C** zeigt das dann auf „Heute“.

## 11. Risiken

| Risiko                                                                    | Gegenmaßnahme                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Bildschirm wird zu lang/zu viele Taps                                     | Vorbelegung, „Für alle Tage übernehmen“, Flex-Modus, Karten nur für gewählte Tage                |
| Alte installierte Builds scheitern nach dem Entfernen der `goals`-Spalten | bewusst nicht unterstützt (Weg a); PR-Text und HANDY-ANLEITUNG „neu installieren“                |
| Übernahme verliert Wunsch-Tage (Anzahl ≠ Tage) bzw. Langhantel-Werte > 25 | App unveröffentlicht, nur intern genutzt; im PR-Text erwähnt                                     |
| Laufen für Einsteiger/Ältere zu viel                                      | konservativer Start, 10-%-Regel, Gehen bei Vorsicht/ab 65, Deckel, fachliche Prüfung             |
| Gemischter Ort: Heim-Fassung einer Studio-Vorlage dünn                    | vorhandener Tausch + `location_mismatch`, Mehrheitsregel, Beispielplan im CI                     |
| Unterschiedliche Dauern machen die Rotation uneinheitlich                 | Kürzen je Termin, deterministisch, Eigenschaftstest                                              |
| Etappe-B-Migrationen versehentlich geändert                               | B ist gemergt; nur neue Migrationen mit späterem Zeitstempel, `create or replace` für Funktionen |
| Gleiche Einheit verschieden gekürzt verwirrt die Progression (Phase 4)    | Progression je Übung über alle Fassungen (5.7), Beispielplan „Mo 20 / Sa 90“ im CI               |
| Neue Enum-Werte in derselben Transaktion benutzt → Migration scheitert    | Enum-Werte in eigener Migrationsdatei vorab                                                      |
| Langhantel-Gewichte falsch interpretiert (heute Scheiben = Gesamt)        | `barbellLoadSteps()` + Tests; Zielgewichte bis Phase 4 ohnehin leer                              |
| Preset-Listen + eigene Werte über 40 Stufen                               | Test der Listenlänge, klare Meldung in der UI                                                    |
| Ausdauer-Texte ohne fachliche Prüfung                                     | als PRODUKTENTSCHEIDUNG markiert, feste Textbausteine in core, Prüfung vor Veröffentlichung      |

## 12. Wächter-Prüfung (Runde 1) – wie die Befunde gelöst sind

Ergebnis: **freigegeben mit Auflagen** (04.10.2026). Zuordnung:

| Nr. | Befund / Entscheidung                                                                                                          | Gelöst in                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | Schwangerschaft: nur Gehen oder Ergometer, Schwimmen locker erlaubt, nie Rad im Freien                                         | 5.5 (Tabelle `enduranceModality()`), 5.6, 6 (Tests), Frage 12 |
| 2   | Ohne Check: Geh-Lauf-Wechsel, ≤ 3, Startumfang „vorsichtig“; Gehen nur bei Flags, Schwangerschaft, ab 65                       | 5.5, 5.6, 6, Frage 14 (offen mit Empfehlung)                  |
| 3   | 10-%-Regel prüfbar (Bezug letzte Belastungswoche, `Math.floor`, Vorwoche 0 → Start, 10-min-Mindestgröße in der Wochengrenze)   | 5.5 Punkte 1–6, 6 (Tests Vorwoche 0, Rundung, nach Deload)    |
| 4   | Folgeblock „Tage egal“: Tage/Arten aus letzter Belastungswoche, Minuten aus `inputs.schedule`, Umfang = Summe Ausdauer-Minuten | 5.3, 5.5 Punkt 5, 6                                           |
| 5   | Alte Builds nicht unterstützt, `goals`-Spalten in B2 nach Übernahme entfernen                                                  | 4.2 (mit Abhängigkeiten), 9 (B2 Punkte 2/5), 10, 11, Frage 11 |
| 6   | Gesamt-Deckel ≤ 5 Einheiten / ≥ 2 Ruhetage für Einsteiger, vorsichtig, < 18, ≥ 65                                              | 3.2 (`week_total_capped`), 5.2 Punkt 3, 5.8, 6, Frage 6       |
| 7   | `barbellLoadSteps()` als Teilsummen-DP in 0,25 kg, Deckel, Laufzeittest; Kurzhantel je Hantel; Werte > 25 kg                   | 4.3, 6, 9 (B2 Punkt 2/5), 11                                  |
| 8   | Test „Preset-Länge ≤ 40“, Zahl korrigiert (33)                                                                                 | 3.3, 6                                                        |
| 9   | Quellen ehrlich: Bosquet nur Anlehnung, 10-%-Regel schwach belegt (Buist 2008)                                                 | 5.6                                                           |
| 10  | Deckel je Ausdauer-Einheit 50 % / 90 min am Start                                                                              | 5.5 Punkt 6, 5.6, 6, Frage 7                                  |
| 11  | Beispielplan „Mo 20 / Sa 90“ im CI; Progression je Übung für Phase 4 vorgemerkt                                                | 5.7, 9 (B3), 10, 11                                           |
| 13  | Bezeichnung „Ausdauer“ mit Untertitel nach Disziplin, Hinweis `endurance_walk`                                                 | 3.2, 5.8                                                      |
| 14  | Status/Etappen (B gemergt); `legacyPlanInputsFromSchedule()` gestrichen                                                        | Kopf, 2, 9                                                    |
| 15  | `db-sync` und `assert_plan_inputs` mit verschachtelten `schedule`-Schlüsseln (B3)                                              | 4.4 Punkt 5, 4.5, 6, 9 (B3)                                   |

## 13. Wächter-Prüfung (Runde 2) – wie die Befunde gelöst sind

Ergebnis: **freigegeben mit einer Auflage und Hinweisen** (04.10.2026). Zuordnung:

| Nr. | Befund                                                                                                                                    | Gelöst in                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | **Auflage:** Start-Deckel je Einheit (Einsteiger 30, vorsichtig 20) zusätzlich zu 50 %/90 min; wächst mit 10-%-Regel; Überschuss verfällt | 5.5 Punkt 6, 5.6, 6 (Tests), Frage 7         |
| 2   | Folgeblock-Bezug: gestrichene Einheiten zählen nicht                                                                                      | 5.5 Punkt 5, 6 (Test)                        |
| 3   | Alte `upsert_goals` mit Zeitbudget-Spalten in der Warteschlange still verwerfen                                                           | 4.2 (Tabelle), 4.5, 6 (`sync-queue.test.ts`) |
| 4   | Migrations-Reihenfolge: erst Langhantel-Werte > 25 kg entfernen, dann CHECK anlegen                                                       | 4.3, 9 (B2 Punkt 2), 6 (pgTAP)               |

## 14. Umsetzungsstand (05.10.2026)

**Etappe B2 – Onboarding-Daten: Trainingstage + Gewichte: erledigt** (wartet auf Wächter-Prüfung). Etappe B3
(Plan-Engine, `planned_session_kind`, `assert_plan_inputs`) ist noch offen; die Plan-Engine nutzt bis dahin ihr
bisheriges Angaben-Format (keine App-Plan-Erzeugung vor Etappe C).

1. **Core:** `training-schedule.ts` (`trainingScheduleSchema`, `trainingSlotItemSchema`/`trainingSlotsSchema`,
   `scheduleToSlots()`/`scheduleFromSlots()`, `deriveTrainingLocation()`, `hasHomeStrength()`, `suggestedSlotKind()`,
   `enduranceSlotSubtitle()`, `scheduleTotals()`, `groupSlots()`, `weeklySessionCap()`, `scheduleHints()`,
   `scheduleFromLegacyGoals()`); `TRAINING_SLOT_KINDS` (`enums.ts`); `constants.ts`: `MINUTE_PRESETS`,
   `DEFAULT_SLOT_MINUTES`, `SCHEDULE_HINT_LIMITS`, `WEEKLY_SESSION_LIMITS`, `BARBELL_BAR_KG`, `BARBELL_BAR_PRESETS_KG`,
   `BARBELL_DEFAULT_BAR_KG`, `BARBELL_PLATE_MAX_KG` (Quellen/PRODUKTENTSCHEIDUNG), Kommentar „je Hantel/Kugel“ an
   `PLANNED_LOAD_LIMITS`; `equipment.ts`: `weightPresetsKg` je Gerät, `weightPresetsFor()`, `barbellLoadSteps()`;
   `equipmentItemSchema.barKg` + 25-kg-Regel; `onboarding.ts`: `training_location` nie anwendbar, Equipment nach
   `hasHomeStrength`; `timeBudgetStepSchema`/`trainingLocationStepSchema` entfernt. Tests inkl. Grenzfälle
   (`training-schedule.test.ts`, `equipment.test.ts` mit Laufzeittest 40 Scheiben, `validation`, `onboarding`, `db-sync`).
2. **Migration** `20261005120000_training_slots.sql`: Enum, Tabelle `training_slots` (RLS, nur `select`),
   `replace_training_slots` (`security definer`), Übernahme aus `goals` über `private.legacy_time_budget_slots()`,
   danach Entfernen der drei Spalten; Langhantel: erst `private.barbell_plates_only()` (Werte > 25 kg entfernen), dann
   CHECK; `bar_kg`; `replace_user_equipment` mit `bar_kg`. pgTAP: neu `15_training_slots` (49 Tests), angepasst
   `01`, `03`, `04`. Lokal: 15 Dateien, alle Tests bestanden; Übernahme zusätzlich gegen eine Datenbank mit alten
   `goals`-Zeilen geprüft.
3. **App:** Schritt „Deine Trainingstage“ (feste Tage mit Karten je Tag oder „Tage egal“ mit Zählern, Minuten-Chips +
   „Eigene“, „Für alle Tage übernehmen“, Live-Zusammenfassung, Hinweise), kein Trainingsort-Schritt mehr,
   Equipment mit Gewichts-Chips (gefüllt + Häkchen), Stange, „Alle abwählen“, eigene Werte; „Geschafft!“ mit Tagen und
   Gewichten kompakt. Datenebene: `replace_training_slots` (Testmodus + Supabase), `bar_kg`, Umwandlung alter
   Gerätespeicher/Offline-Zwischenspeicher (`legacy-rows.ts`), Warteschlange verwirft alte `upsert_goals` still.
   Playwright: feste Tage gemischt, „Tage egal“, Gewichte antippen + eigener Wert, Zusammenfassung.

**Abweichungen beim Umsetzen:**

- `barbellLoadSteps()` rechnet die Teilsummen in **0,01-kg-Einheiten** (Speichergenauigkeit) statt 0,25 kg – damit
  sind auch eigene Scheiben wie 0,1 kg exakt; das 0,25-kg-Raster ist darin enthalten. Laufzeit 40 Scheiben < 50 ms.
- `equipmentProfile()`/`snapToAvailableWeight()` nutzen die Gesamtstufen der Langhantel erst mit Etappe B3
  (`homeEquipment[].barKg` gehört zum neuen Angaben-Format, 4.4/5.1); Zielgewichte bleiben bis Phase 4 ohnehin leer.
  **B3-Pflichtpunkt mit Test** (Abschnitt 9, B3 Punkt 3).
- `replace_training_slots` sperrt zuerst die eigene Profil-Zeile (`for update`), damit gleichzeitige Aufrufe
  nacheinander laufen; zusätzlich fängt sie `unique_violation` mit eigener Meldung ab (Wächter-Hinweis).
- `WEEKLY_SESSION_LIMITS` steht schon jetzt in `constants.ts` (für den Hinweis `week_total_capped`); angewendet wird
  der Deckel ab B3.
- „Tage egal“ erlaubt je Art **eine** Dauer (UI wie 3.2); das Datenmodell erlaubt verschiedene.
