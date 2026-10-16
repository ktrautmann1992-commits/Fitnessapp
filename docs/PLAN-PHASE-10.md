# Plan Phase 10 – Ausdauer-Wettkampf & Strecken

**Status:** Freigegeben (16.10.2026). Gründer-Entscheidungen W-G1 bis W-G16 (Abschnitt 19): **alle wie empfohlen**
(ausgefülltes Entscheidungs-PDF vom 16.10.2026). Umsetzung je Etappe als Pull Request mit Wächter-Prüfung.
**Stand 16.10.2026:** WP1 (Core) als PR #83, WP2 (Core) im Anschluss umgesetzt (Abschnitt 6). A1a, A1b, E1, A2, E2, A3 (PLAN-AUSWERTUNG) sind gemergt; Expo-Projekt „AlphaFive“ wird verbunden
(PR #79). Damit können WP1/WP2 (Core) sofort starten, WP3/WP4 danach, S0 sobald die erste APK läuft.

**Grundlage:** `CLAUDE.md`, `docs/PROMPTS.md` (Phase 10, „Erweiterung Phase 10 – Strecken aufzeichnen“, Phase 8,
Phase 4b), `docs/KONZEPT.md` (4, 5, 6.6, 9, 10, 10.1, 11, 12, 13), `docs/PLAN-PHASE-3*.md`,
`docs/PLAN-PHASE-4*.md`, `docs/PLAN-PHASE-5.md` (19.7 W1, 19.8, 13, 16), `docs/PLAN-ZIELE.md`,
`docs/PLAN-AUSWERTUNG.md`, Code-Stand vom 15.10.2026.
**Reihenfolge laut Gründer-Entscheidung 13.10.2026:** Phase 10 direkt nach Phase 5, vor Phase 4b.

---

## 0. Kurzfassung

Phase 10 bringt zwei Dinge:

1. **Wettkampfplan:** Ihr gebt einen Wettkampf ein (z. B. Halbmarathon am 12.04.2027). Die App plant **rückwärts
   vom Renntag**: Basis → Aufbau → Spitze → Tapering → Renntag → Erholung. Dazu kommen neue Einheiten-Arten
   (langer Lauf, Tempo, Intervalle), Intensität ohne Pulsuhr (Anstrengung 0–10 und Sprechtest), auf Wunsch
   Pace-Richtwerte, ein **Countdown** und die **Wettkampf-Ernährung** (Carb-Loading, Renntag, Gel-/Trinkplan).
2. **Strecken:** GPS-Aufzeichnung von Läufen und Radfahrten in der App (Distanz, Höhenmeter, Pace), Speichern mit
   Name, Favorit, Schwierigkeit, Zeitvergleich auf Favoriten, automatischer Tagebuch-Eintrag, Karte,
   GPX-Import und -Export. Alles privat.

**Das Wichtigste vorweg:**

- **Keine Echtzeit-KI.** Alles läuft über feste Regeln in `packages/core` – gratis im Betrieb.
- **Sicherheit vor Zielzeit:** Die 10-%-Regel, die Erholungswochen und alle Gesundheits-Regeln gelten weiter.
  Reicht die Zeit bis zum Wettkampf nicht, **staucht die App den Plan nie**, sondern sagt es ehrlich („zu knapp“)
  und schlägt eine kürzere Distanz oder ein späteres Datum vor.
- **GPS-Aufzeichnung braucht eine echte App** (Development Build über EAS), nicht Expo Go. Im Handy-Browser
  (Vercel-Vorschau) geht nur Karte, GPX-Import/-Export und eine **Demo-Aufzeichnung** zum Testen.
  Achtung: In `apps/mobile/app.config.ts` ist die Expo-Projekt-ID noch leer – der Workflow `eas-build` überspringt
  Builds. Ohne SETUP Teil D (und für iPhone Teil D2, Apple-Konto) könnt ihr die Aufzeichnung nicht testen.
- **Karten kosten evtl. laufend Geld.** Die öffentlichen OpenStreetMap-Kacheln (`tile.openstreetmap.org`) dürfen wir
  laut Nutzungsbedingungen **nicht** für eine App nutzen. Empfehlung: in der Testphase kostenlos über OpenFreeMap,
  vor dem Livegang eigene Kartendatei (Protomaps) für wenige Euro im Monat (Abschnitt 11.1).
- **11 Etappen** (W0, WP1–WP5, W1, S0, S1, S2a, S2b), die meisten unabhängig. Empfohlener Start: Core-Teile parallel
  zu E1, App-Teile nach A1b (Abschnitt 18).

---

## 1. Ist-Stand (geprüft am 15.10.2026)

### 1.1 Plan-Engine Ausdauer (`packages/core/src/plan/endurance.ts`, Engine-Version 2)

- **Disziplinen** (`ENDURANCE_DISCIPLINES`): 5 km, 10 km, Halbmarathon, Marathon, Triathlon Sprint/Olympisch/
  Mittel/Lang, Rad, Schwimmen. Wirken heute nur auf die **Art** der Einheit (Laufen, Rad, Schwimmen, Triathlon im
  Wechsel).
- **Nur lockere Einheiten** (6 Varianten: lockerer Dauerlauf, Geh-Lauf-Wechsel, zügiges Gehen, lockeres Rad,
  Ergometer, lockeres Schwimmen). Anstrengung 3–4 von 10 (`ENDURANCE_EFFORT`), Sprechtest-Text.
- **Umfang:** Startumfang 60/120/150 min, vorsichtig 45 (`ENDURANCE_START_RULES`); +10 % je Woche gegen die letzte
  Belastungswoche (`Math.floor`, `increasedMinutes`, `capWeeklyIncrease`); Erholungswoche 60 %
  (`ENDURANCE_DELOAD_VOLUME_FACTOR`); je Einheit höchstens 50 % der Woche, erste Belastungswoche höchstens 90 min,
  Start-Deckel 30/20 min, unter 10 min fällt weg (`ENDURANCE_SESSION_LIMITS`). Geh-Lauf-Wechsel für Einsteiger in
  den ersten 4 Wochen, ohne Gesundheits-Check immer.
- **Sicherheit:** Schwangerschaft nur Gehen/Ergometer/Schwimmen (nie Rad draußen), Flag/ab 65 zügiges Gehen,
  Wochen-Deckel für Einsteiger/vorsichtig/unter 18/ab 65 (höchstens 5 Einheiten).
- **Block:** Woche 0–6 (`PLAN_BLOCK_LIMITS.weekNo`), 4 bzw. 5 Belastungswochen + 1 Erholungswoche, Folgeblock über
  `append_plan_block` mit Bezug aus der letzten Belastungswoche (`EnduranceReference`).
- Konstanten für 80/20 (`ENDURANCE_HIGH_INTENSITY_SHARE = 0.2`) gibt es schon, sie werden aber **nicht benutzt**.
- Die App sagt heute: „Dein Wettkampfplan rückwärts ab Renndatum (lange Läufe, Tempo, Tapering) kommt in einem
  späteren Update.“ (`apps/mobile/src/i18n/de.ts`).

### 1.2 Datenbank

- `goals.target_date` (Wettkampf- oder Zieldatum, optional) wird im Onboarding abgefragt, aber **nirgends genutzt**.
- `planned_sessions`: `kind`, `endurance_modality` (run/walk/bike/swim), `effort_target` mit **CHECK 1–4**,
  `estimated_minutes` bei Ausdauer 10–240. Eine Einheit je Tag. **Keine geplante Distanz.**
- `cardio_logs`: Art, Dauer 1 min–12 h, Distanz ≤ 500 km, Höhenmeter ≤ 10.000; **keine Herzfrequenz** (Phase 8).
- `session_logs.source` = Enum `log_source` mit nur `manual` (vorbereitet für weitere Quellen).
- Keine Tabellen `competitions`, `tracked_routes`, `routes`. Keine PostGIS-Erweiterung.

### 1.3 Tagebuch und Trainingsmodus

- Ausdauer-Eintrag mit Dauer, Distanz, Höhenmetern; Pace/km/h werden gerechnet (`log/cardio.ts`), Warnung bei
  unplausiblem Tempo (`CARDIO_PLAUSIBILITY_KMH`), Sprechtest-Stufen (`TALK_TEST_BANDS`).
- Der 10-%-Bezug zählt mit Tagebuch nur `min(geplant, eingetragen)` je Einheit.
- Trainingsmodus offline (verschlüsselter Entwurf, Warteschlange), Bildschirm-an (`expo-keep-awake`), Vibration
  (`expo-haptics`). Kein Intervall-Timer.
- **A1a/A1b (PLAN-AUSWERTUNG):** `moveTargets()` behandelt lockere Ausdauer „nie als Konflikt“; A1b bringt **freie
  Einheiten** (`session_logs.is_free`) – die brauchen wir für GPS-Einträge ohne geplante Einheit und für das
  Wettkampf-Ergebnis. „Trainingsziel erreicht“ rechnet Ausdauer nur über die Dauer („kein Distanz-Ziel“).

### 1.4 Ernährung

- `CARBS.enduranceGPerKg` (3/5/6 g/kg nach Trainingsminuten) und Ziel-Profil „Ausdauer → Abnehmen −10 %,
  Wettkampfwoche ohne Defizit folgt mit Phase 10“ (`constants.ts`).
- Rezepte der Kategorie `wettkampf` werden im automatischen Essensplan **ausgeschlossen** (`filter.ts`, Grund
  `competition`); nur Suche und Ratgeber „Wettkampf-Ernährung“ (aus `alpha5-rezepte.json`) zeigen sie.
- `CARB_LOADING_DAYS` und die Wettkampf-Logik aus W1 (PLAN-PHASE-5 19.7) fehlen noch.
- `clampCalorieTarget` ist die **einzige** Stelle mit Schutzgrenzen (Strukturtest K2).

### 1.5 App-Technik

- Kein Standort, keine Karte, keine Berechtigungstexte (`app.config.ts`: „Keine NS…UsageDescription-Texte“).
- `eas.json` hat ein Profil `development` (Development Build) und `preview` (APK). **`EAS_PROJECT_ID` ist leer.**
- Plattform-Aufteilung `*.native.tsx` / `*.tsx` gibt es schon (z. B. `print-preview.native.tsx`) – Muster für Karte.

### 1.6 Abhängigkeiten zu anderen Plänen

- **4b (danach):** Auslöser `competition_date_changed` ist reserviert. Die 4b-Regel `endurance_reduce` geht von
  `effort_target` ≤ 4 aus (Wächter S6, Test in `db-sync.test.ts`) – sie muss nach Phase 10 neu gefasst werden.
- **Phase 8 (später):** Herzfrequenz, Wearable-Import, Puls-Zonen.
- **PLAN-ZIELE (F12, F15):** Z3–Z6 eigentlich vor Phase 10; Nebenziel Ausdauer bekommt das Datum ab Phase 10.
- **Phase 11b (Challenges):** keine Challenge im Tapering (KONZEPT 11.3) – braucht die Phase aus WP1.

---

## 2. Umfang und Abgrenzung

**Kommt in Phase 10:**

- Wettkampf anlegen, Machbarkeits-Prüfung, Periodisierung rückwärts, neue Einheiten-Arten, Intensität ohne Puls,
  Pace-Richtwerte (optional), Countdown, Ergebnis eintragen.
- Wettkampf-Ernährung W1 (wie PLAN-PHASE-5 19.7).
- GPS-Aufzeichnung, Strecken speichern, Favoriten, Zeitvergleich, Auto-Tagebuch, Karte, GPX-Import/-Export.
- Optional (W-G2): Rad und Triathlon Sprint/Olympisch als zweite Welle (WP5).
- Optional/später (W-G12): Strecken-Vorschläge mit Standortsuche (S2b).

**Kommt NICHT in Phase 10:**

| Thema                                                          | Wann                                              |
| -------------------------------------------------------------- | ------------------------------------------------- |
| Puls-Zonen, Herzfrequenz speichern                             | Phase 8 (Gesundheitsdatum, eigene Einwilligung)   |
| Automatische Plan-Anpassung bei verpassten Wochen, neuem Datum | 4b (Premium), Auslöser `competition_date_changed` |
| Wearable-Import (Strava, Garmin, Health)                       | Phase 8                                           |
| Navigation mit Abbiegehinweisen                                | nicht geplant – GPX an die Uhr                    |
| Offline-Karten zum Herunterladen                               | später (S2b oder danach)                          |
| Teilen, Segmente, Ranglisten, öffentliche Strecken             | **nie** (CLAUDE.md)                               |
| KI-Trainingspläne, KI-Erklärungen                              | Premium-KI, eigene Phase                          |

---

## 3. Fachliche Regeln Wettkampfplan (Vorschläge – VOR LIVEGANG FACHLICH PRÜFEN)

Alle Zahlen kommen als Konstanten mit Quellenkommentar nach `packages/core/src/constants.ts`
(„PRODUKTENTSCHEIDUNG – fachlich prüfen“, wo keine harte Quelle existiert).

### 3.1 Phasen rückwärts vom Renntag

Die App rechnet vom Renntag zurück und füllt die Wochen von hinten:

1. **Erholung nach dem Rennen** (nach dem Renntag): 5 km/10 km 3–5 Tage locker, Halbmarathon 1 Woche, Marathon 2
   Wochen nur locker, keine harten Einheiten.
2. **Tapering** (vor dem Renntag): 5 km/10 km 7–10 Tage, Halbmarathon 10–14 Tage, Marathon 2–3 Wochen. Umfang
   schrittweise −40 bis −60 %, Intensität bleibt, Häufigkeit bleibt (mind. ~80 % der Einheiten). Quelle: Bosquet L
   et al. (2007), Med Sci Sports Exerc 39(8):1358–1365; Mujika I, Padilla S (2003).
3. **Spitze** (2–3 Wochen vor dem Tapering): höchster Umfang, wettkampfnahe Einheiten.
4. **Aufbau**: harte Einheiten kommen dazu (siehe 3.4), Umfang steigt weiter mit ≤ 10 %.
5. **Basis**: alle übrigen Wochen am Anfang, nur locker plus kurze Steigerungsläufe (Fortgeschrittene).

- Erholungswochen bleiben fest (heute 4 bzw. 5 Belastungswochen + 1 Erholungswoche). Im Aufbau/in der Spitze
  Empfehlung 3 : 1 für Einsteiger (W-G3). Eine Erholungswoche fällt **nie** in die letzte Woche vor dem Tapering
  (dann wird sie vorgezogen, nie gestrichen).
- Liegt der Wettkampf weit weg (> 24 Wochen), verlängert sich die Basis; der Umfang steigt nur bis zum nötigen
  Spitzenumfang und bleibt dann (kein „immer mehr“).

### 3.2 Mindestvorlauf und Machbarkeit (Ampel)

**Mindestvorlauf** (Vorschlag, Wochen bis zum Renntag, W-G3):

| Distanz      | Einsteiger | Fortgeschritten | Leistungssport |
| ------------ | ---------- | --------------- | -------------- |
| 5 km         | 8          | 6               | 4              |
| 10 km        | 10         | 8               | 6              |
| Halbmarathon | 16         | 12              | 10             |
| Marathon     | 24         | 16              | 14             |

**Machbarkeit:** Für jede Distanz gibt es einen **Mindest-Spitzenumfang** für „Ankommen“ (Wochenminuten und längste
Einheit, z. B. Halbmarathon ca. 150 min/Woche und 90–120 min langer Lauf, Marathon ca. 240 min/Woche und 150–180
min langer Lauf – PRODUKTENTSCHEIDUNG). Die App rechnet aus dem Startumfang mit der 10-%-Kette (inkl.
Erholungswochen und Tapering), ob dieser Umfang rechtzeitig erreichbar ist.

Beispiel Einsteiger Marathon: Start 60 min → 66 → 72 → 79 → … → nach 15 Belastungswochen ca. 236 min; mit 4
Erholungswochen und 3 Wochen Tapering sind das **ca. 22 Wochen**. Deshalb 24 Wochen Mindestvorlauf.

Ergebnis als Ampel (`competitionFeasibility()`):

- **Passt:** Plan wird erstellt.
- **Knapp:** Plan wird erstellt, Ziel ist „Ankommen“; Zielzeit nicht möglich; Hinweis.
- **Zu kurz:** kein Wettkampfplan. Vorschläge: kürzere Distanz, späteres Datum oder „Ohne Wettkampf weiter“
  (bisheriger Grundlagen-Plan). Der Plan wird **nie** gestaucht.

**Startumfang:** wie heute aus der Startgruppe; gibt es Tagebuch-Einträge der letzten 4 Wochen, zählt
`min(geplant, eingetragen)` (wie der 10-%-Bezug). Eigene Angabe „ich laufe schon X min/Woche“ nur für Fortgeschrittene
und Leistungssport, gedeckelt und mit Bestätigung (W-G5).

### 3.3 Wer bekommt welchen Plan (strengste Regel gewinnt)

| Personengruppe                   | Wettkampfplan                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Schwangerschaft                  | **kein** Wettkampfplan, Hinweis Ärztin/Arzt                                                                    |
| Ohne Gesundheits-Check           | erst nach dem Check; bis dahin Grundlagen-Plan                                                                 |
| Gesundheits-Flag                 | nur „Ankommen“, nur locker (keine Tempo-/Intervall-Einheiten), Hinweis ärztliche Abklärung (Sporttauglichkeit) |
| Ab 65                            | nur „Ankommen“, harte Einheiten nur als „zügig“ (Anstrengung ≤ 6), Hinweis ärztliche Abklärung                 |
| Unter 18                         | höchstens Halbmarathon (W-G4), Anstrengung ≤ 7, keine Zielzeit                                                 |
| Einsteiger                       | höchstens 1 harte Einheit/Woche ab Aufbau, Marathon nur mit 24 Wochen und Hinweis                              |
| Fortgeschritten / Leistungssport | bis 2 harte Einheiten/Woche, Zielzeit möglich                                                                  |

Wochen-Deckel aus Phase 3 bleiben (höchstens 5 Einheiten für Einsteiger/vorsichtig/unter 18/ab 65).

### 3.4 Einheiten-Arten und Intensität ohne Pulsuhr

**Arten** (neues Enum `workout_type`, Vorschlag):

- `easy` lockerer Dauerlauf (Anstrengung 3–4, ganze Sätze)
- `recovery` Erholungslauf (2–3)
- `long` langer Lauf (3–4, gleichmäßig)
- `strides` locker + 4–6 kurze Steigerungen (Basis, Fortgeschrittene)
- `fartlek` Fahrtspiel nach Gefühl (5–6)
- `tempo` zügiger Dauerlauf an der Schwelle (6–7, nur kurze Sätze)
- `intervals` Intervalle (8, nur einzelne Wörter; nie „alles geben“)
- `race_pace` Abschnitte im geplanten Renntempo (Spitze)
- später WP5: `brick` Koppeltraining Rad → Lauf, `technique` Schwimmtechnik

**Intensität:** Anstrengung 0–10 (Borg CR10) + Sprechtest (`TALK_TEST_BANDS` gibt es schon). Kein Maximaltest
(CLAUDE.md, Phase 3: „Nie Maximaltests“). **80/20:** höchstens 20 % der Wochenminuten mit Anstrengung ≥ 6
(`ENDURANCE_HIGH_INTENSITY_SHARE`); Einsteiger zählen nur den harten Teil der Einheit.

**Pace-Richtwerte (optional, W-G6):** nur wenn die Person eine **eigene Referenzzeit** angibt (letzter Wettkampf
oder Testlauf aus dem Tagebuch, nicht älter als 6 Monate). Umrechnung mit der Riegel-Formel T₂ = T₁ × (D₂/D₁)^1,06
(Riegel PS 1981, Am Sci 69:285–290), daraus Spannen je Art (z. B. locker = Renntempo 10 km + 60–90 s/km). Immer
mit dem Satz „Die Anstrengung hat Vorrang – bei Hitze, Wind und Steigungen langsamer.“

**Puls:** nicht in Phase 10 (W-G7). Herzfrequenz ist Gesundheitsdatum und wird erst ab Phase 8 gespeichert.

### 3.5 Wochenbau

- Langer Lauf am Wunsch-Tag (Standard: Wochenende), höchstens 35 % der Wochenminuten (bei ≤ 3 Einheiten
  höchstens 50 % wie heute), Laufen höchstens 180 min, Halbmarathon-Plan höchstens 120 min.
- Harte Einheiten nie an zwei Tagen hintereinander, nie am Tag vor dem langen Lauf, nie neben einem Kraft-Tag mit
  Beinen (48-h-Regel erweitert: **harte** Ausdauer zählt wie Kraft-Beine; lockere bleibt konfliktfrei).
- Erholungswoche: keine harten Einheiten, Umfang 60 % wie heute.
- **Renntag** ist keine geplante Trainingseinheit, sondern der Wettkampf selbst (Tabelle `competitions`) – so
  greifen weder die 240-min-Grenze noch die 10-%-Regel. Der Tag davor ist Ruhetag oder 15–20 min locker.
- Kraft im Wettkampfplan: bleibt möglich, in Spitze und Tapering höchstens 1 Kraft-Einheit ohne schwere Beine
  (PRODUKTENTSCHEIDUNG).

### 3.6 Distanz- und Pace-Ziele je Einheit (Änderung zu PLAN-AUSWERTUNG „kein Distanz-Ziel“)

- **Dauer bleibt das Hauptziel** jeder Einheit (sicherer, unabhängig von Gelände und Wetter).
- Neu: optionaler **Distanz-Richtwert** (`target_distance_m`), nur wenn eine Referenzzeit da ist, gerundet auf
  0,5 km; immer beim langen Lauf und beim Renntag angezeigt.
- `sessionAchievement()` (A2/A3) rechnet weiter über die Dauer; die Distanz wird nur angezeigt (W-G6). Bei
  Intervallen zählt „Teile geschafft“ (z. B. 5 von 6).

---

## 4. Etappe W0 – Plan, Ist-Stand, Grundlagen

- Dieses Dokument als `docs/PLAN-PHASE-10.md`, PROMPTS-Status, Querverweise in KONZEPT 4/10/10.1/12, PLAN-PHASE-4B
  (Auslöser, neue Fassung `endurance_reduce`), PLAN-AUSWERTUNG 2.5 (Distanz-Richtwert), PLAN-ZIELE (F15).
- Quellen für alle neuen Konstanten gegen das Original prüfen (Bosquet 2007, Mujika 2003, Riegel 1981, Seiler 2010,
  Thomas 2016, Burke 2011, Jeukendrup 2014).
- Fachprüfung anstoßen (Trainingswissenschaft: Tabellen 3.2/3.3/3.5; Ernährung: W1).
- _DoD:_ Wächter-Prüfung des Plans, Gründer-Entscheidungen eingetragen.

---

## 5. Etappe WP1 – Core: Wettkampf, Machbarkeit, Phasen rückwärts

**Dateien:** `packages/core/src/plan/competition.ts`, `periodization.ts`, Schemas in `plan/competition-schema.ts`.

- `competitionSchema` (Zod, strikt): Name (1–80 Zeichen, nur Anzeige), Disziplin, Distanz (aus der Disziplin, für
  Rad frei 20–300 km), Renntag (heute + Mindestvorlauf bis heute + 52 Wochen), Ziel `finish` | `time`,
  Zielzeit (nur bei `time`, plausibel je Distanz), Referenzzeit optional (Distanz + Zeit + Datum).
- `minimumLeadWeeks(discipline, level)`, `requiredPeak(discipline)`.
- `competitionFeasibility(inputs, today)` → `ok | tight | too_short` + Gründe + Vorschläge (kürzere Distanz,
  frühestes Datum). Nutzt **dieselbe** 10-%-Kette (`increasedMinutes`) wie `enduranceWeekVolumes`.
- `macroCycle(inputs, planStart)` → Liste der Wochen mit Phase (`base | build | peak | taper | race_week |
recovery`) und Erholungswochen. Reine Funktion, wird **nicht gespeichert**, sondern bei jedem Folgeblock neu
  gerechnet (gleiche Eingaben → gleiches Ergebnis).
- Anbindung an `generateTrainingPlan`: Hat das Ziel einen gültigen Wettkampf, bekommt jeder Block seine Phasen aus
  `macroCycle`; Folgeblöcke wie heute über `append_plan_block`.
- **Tests (Grenzfälle):** Renntag genau am Mindestvorlauf, 1 Tag darunter, 52 Wochen; Renntag Sonntag/Montag
  (Wochengrenze); Planstart mitten in der Woche (Woche 0); Einsteiger Marathon 23/24/25 Wochen; vorsichtige Gruppe;
  unter 18 und Marathon (abgelehnt); 1 vs. 7 Ausdauer-Tage; sehr leicht/schwer und sehr jung/alt (nur über die
  Startgruppe); Folgeblock mit strengerer Gruppe (`stricterGroup`). **Eigenschaftstests:** keine Woche über
  `floor(1,1 × letzte Belastungswoche)`; jede 4./5. Woche Erholung; Tapering nie kürzer als die Tabelle; „zu kurz“
  erzeugt nie einen Plan.
- Keine Migration, keine App.

### Umsetzungsstand WP1 (16.10.2026)

**Was gilt:**

- **Schemas** `packages/core/src/plan/competition-schema.ts`: `COMPETITION_DISCIPLINES` (nur `5k`, `10k`, `half_marathon`, `marathon` – W-G2; Teilmenge von `ENDURANCE_DISCIPLINES`, Rad/Triathlon kommen mit WP5 dazu), `COMPETITION_GOALS` (`finish` Standard, `time`), `COMPETITION_PHASES` (`base | build | peak | taper | race_week | recovery`). `competitionInputSchema` (strikt: Name 1–80 Zeichen getrimmt, Disziplin, Renntag, Ziel, Zielzeit nur bei `time` und plausibel je Distanz, Zielzeit nur mit Referenzzeit), `competitionWindowSchema(today)` (Renntag nach heute bis heute + 52 Wochen, Referenzzeit nicht in der Zukunft und höchstens 183 Tage alt), `competitionSchema({ today, minimumLeadWeeks })` (zusätzlich Mindestvorlauf), `competitionOwnStartSchema` (W-G5, `confirmed: true` Pflicht).
- **Periodisierung** `plan/periodization.ts`: `macroCycle(inputs, planStart)` → Kalenderwochen ab der Woche des Planstarts mit Phase, Erholungswoche, angebrochener Startwoche und Umfangs-Faktor; `taperWeekCount`, `deloadRhythm`, `competitionBlocks` (Schnitt nach jeder Erholungswoche und vor dem Tapering, je Block höchstens Woche 0 + 6 Wochen), `nextCompetitionBlock`. Rein, nicht gespeichert, bei jedem Folgeblock neu gerechnet.
- **Ampel** `plan/competition.ts`: `minimumLeadWeeks`, `requiredPeak`, `leadLevel`, `earliestRaceDate`, `ownStartMinutes`, `competitionFeasibility(planInputs, { competition, ownStart?, startReference? }, today)` (`startReference` = `{ volume, sessionCap, startGroup }`, am besten aus `competitionStartReference(previous, previousStartGroup, loggedMinutes)`) → `ok | tight | too_short | not_available` mit `reasons`, `notices`, `suggestions` (kürzere Distanz, frühester späterer Renntag, mehr Trainingszeit, Gesundheits-Check, ohne Wettkampf weiter), `effectiveGoal`, `plannedPeakMinutes`. Die Ampel rechnet Block für Block mit **derselben** Funktion wie der Plan (`enduranceWeekVolumes` → `capWeeklyIncrease`/`increasedMinutes`, Bezug zwischen Blöcken über `enduranceReferenceFromMinutes`, gleiche Tag-Auswahl `blockWeekDays`). `competitionVolumePreview` (alle Wochenumfänge, für Tests und WP4), `competitionPlanSetup`, `competitionFollowUpBlock`.
- **Plan-Engine:** `generateCompetitionPlan(inputs, library, today, request)` (in `generate.ts`) – Ampel, dann derselbe Ablauf wie `generateTrainingPlan`, aber die Wochen des ersten Blocks kommen aus dem Makrozyklus; „zu kurz“/„nicht möglich“ → `competition_not_feasible` mit Ampel, **nie** ein Plan. Folgeblöcke: `competitionFollowUpBlock(inputs, request, { planStart, today, previous, effectiveGoal })` + `nextPlanBlock(previous, { …, competitionWeeks })`. Neue optionale Felder (ohne Angabe wirkungslos): `EnduranceWeekInput.volumeFactor`/`maxBudget`, `enduranceWeekVolumes({ startMinutes })`, `buildPlanBlock({ weeks })`, `BlockContext.enduranceStartMinutes`. `GeneratedPlan.competition` (Ampel, Makrozyklus, Plateau, Phase je Woche des ersten Blocks) gibt es nur beim Wettkampfplan; `toSavePlanPayload` speichert ihn nicht.
- **Konstanten** in `constants.ts` (alle „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“, Quellen Bosquet 2007, Mujika & Padilla 2003, World Athletics): `COMPETITION_DISTANCE_M`, `COMPETITION_LEAD_WEEKS` (Tabelle 3.2, 52 Wochen), `COMPETITION_REQUIRED_PEAK`, `COMPETITION_PERIODIZATION`, `COMPETITION_GROUP_RULES`, `COMPETITION_OWN_START`, `COMPETITION_INPUT_LIMITS`.
- **Keine Migration, keine App, keine Datenbank, keine neue Engine-Version** (Pläne ohne Wettkampf sind unverändert).
- **Tests (Stand nach den Wächter-Auflagen):** `competition-schema.test.ts` (14), `periodization.test.ts` (16, Eigenschaftstest über alle Distanzen × Level × Gruppen × 7 Startwochentage × Renntage 1–364 Tage, > 20.000 Zyklen, 60 s), `competition.test.ts` (41, u. a. „Tabelle passt zur Kette“ für 49 Wochentag-Kombinationen je Distanz, Tagebuch-Bezug H1/H2, Folgeblock-Ränder), `generate-competition.test.ts` (11: Beispiele, Wächter-Fälle H1/M1/M2 am fertigen Plan, Folgeblock mit strengerer Gruppe, Schwangerschaft zwischen den Blöcken, Regressions-Prüfsumme, Eigenschaftstest 400 Läufe mit Varianten über ALLE Blöcke, 60 s), dazu `endurance.test.ts` (+11) und `schedule.test.ts` (+3). Core gesamt 4.023 → 4.119 Tests (Zahlen laut Vitest, `it.each` je Fall gezählt).
- **Regression „ohne Wettkampf byte-gleich“:** Raster aus 7.560 Plänen (alle Wochentage, Level, Disziplinen, Gesundheits-Checks, Alter, 5 Zeitpläne mit und ohne Kraft) + je Folgeblock gegen einen Auszug von `origin/main` (6e6b4ff) gerechnet: gleiche SHA-256-Prüfsumme. Die reine-Ausdauer-Teilmenge (4.536 Pläne, unabhängig vom Übungs-Bestand) steht als fester Test im Code. `pnpm plan:examples` vor/nach der Änderung zeichengleich; `db-sync.test.ts` unberührt (keine neuen Datenbank-Enums, keine Migration).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Vierter Ampel-Zustand `not_available`** für Tabelle 3.3 (Schwangerschaft, ohne Gesundheits-Check, unter 18 ab Marathon) – das ist kein „zu kurz“, ein späteres Datum hilft nicht. Vorschläge: ohne Wettkampf weiter, ggf. Gesundheits-Check bzw. kürzere Distanz (Halbmarathon).
2. **Mindest-Spitzenumfang „Ankommen“ = 5 km 80, 10 km 100, Halbmarathon 140, Marathon 240 min/Woche** (Zielzeit 150/180/240/330). Gewählt so, dass Einsteiger (Start 60, +10 %, Rhythmus W-G3) ihn genau zum Mindestvorlauf der Tabelle erreichen – sonst wäre der Mindestvorlauf nie erreichbar gewesen (mit 90/120/150 hätten Einsteiger 5 km/10 km/Halbmarathon zum Mindestvorlauf **immer** „zu kurz“ bekommen). Halbmarathon 140 statt „ca. 150“ → Gründer-Frage G1.
3. **Die Ampel prüft in WP1 nur die Wochenminuten.** `requiredPeak().longRunMinutes` (5 km 40, 10 km 60, Halbmarathon 90, Marathon 150) ist nur Richtwert für WP2: Mit dem bestehenden Start-Deckel je Einheit (Einsteiger 30 min, +10 %/Belastungswoche) und 35 % bzw. 50 % der Woche (3.5) erreicht kein Einsteiger in 24 Wochen einen 150-min-Lauf → Gründer-/Fachfrage G2.
4. **Phasenlängen:** Spitze 2/2/3/3 Wochen, Aufbau 2/2/4/6 Wochen (5 km/10 km/Halbmarathon/Marathon), Basis = Rest; bei wenig Zeit wird zuerst die Basis, dann der Aufbau, dann die Spitze kürzer. Längerer Aufbau hätte wegen 3 : 1 die Tabelle 3.2 nicht erfüllt.
5. **Tapering in ganzen Wochen:** n = kleinste Zahl ≥ 1 mit 7 n + (Wochentag des Rennens − 1) ≥ 7/7/10/14 Tage. So nie kürzer als 3.1, aber bis zu 6 Tage länger (z. B. 10 km am Sonntag: 13 statt höchstens 10 Tage). Umfang 1 Woche 70 %, 2 Wochen 75 %/60 %, Rennwoche 40 % der letzten Belastungswoche (über das ganze Tapering −40 bis −55 %, Bosquet 2007); Anstrengung bleibt in WP1 locker wie bisher.
6. **Rennwoche:** Vortag, Renntag und Rest der Rennwoche ohne Einheit (auch Kraft). Bei einem Rennen am Montag liegt der freie Vortag in der letzten Tapering-Woche. Vortag als Ruhetag statt „15–20 min locker“ → Gründer-Frage G4.
7. **Erholung nach dem Rennen** in ganzen Wochen nach der Rennwoche: 5 km/10 km/Halbmarathon 1 Woche (50 %), Marathon 2 Wochen (50 %, 60 %). Danach endet der Makrozyklus (`cycle_finished`), weiter mit dem Grundlagen-Plan.
8. **Tapering-, Renn- und Erholungswochen sind in den Einheiten `is_deload = true`** (nie Bezug der 10-%-Regel, Kraft in Erholungs-Dosierung, nie verschiebbar – bestehende Regeln). Die Phase selbst ist nicht gespeichert (keine Spalte vor WP3); die App zeigt sie ab WP4 aus `macroCycle`.
9. **Erholungsrhythmus:** Basis wie bisher (`loadWeeksBeforeDeload`: Einsteiger 5, sonst 4, vorsichtiger Plan 4), Aufbau/Spitze 3 : 1 für Einsteiger **und** die vorsichtige Startgruppe (strengste Regel, Gründer-Frage G5). Erholungswochen werden vorwärts gesetzt; fiele eine in die letzte Woche vor dem Tapering, wird sie eine Woche vorgezogen.
10. **Woche 0:** Beginnt ein Wettkampfplan nicht montags, ist die angebrochene Woche immer Woche 0 (Einstiegswoche, zählt weder für die 10-%-Kette noch für den Rhythmus) – strenger als die 50-%-Regel ohne Wettkampf. So rechnen Ampel und Plan mit denselben Wochen.
11. **Plateau („kein immer mehr“, 3.1):** Belastungswochen höchstens min(Wunsch-Minuten; max(Startumfang bzw. Tagebuch-Bezug; Spitzenumfang des wirksamen Ziels)). Wer mehr Zeit angibt, bleibt beim Spitzenumfang → Gründer-Frage G3.
12. **Ampel-Stufen:** `ok` = Spitzenumfang in mindestens 2 Belastungswochen vor dem Tapering, `tight` = in genau 1, sonst `too_short`. Mindestvorlauf der vorsichtigen Startgruppe aus der Einsteiger-Spalte. Gewünschte Zielzeit nicht erlaubt (Einsteiger, Flag, ab 65, unter 18) oder nicht erreichbar → Ziel „Ankommen“ und höchstens `tight`. Eine Zielzeit-Prüfung gegen die Referenzzeit (Riegel) kommt mit WP2 (`paceTargets`).
13. **W-G5:** Eigene Angabe ersetzt den Startumfang der Gruppe (`startMinutes`) – **nur im ersten Block** –, gedeckelt auf 2 × (Fortgeschritten 240, Leistungssport 300). Gibt es einen Tagebuch-Bezug (`startReference`, min(geplant, eingetragen) der letzten Belastungswoche, z. B. aus dem bisherigen Plan), gilt dieser und die Angabe wird nicht genutzt (Hinweis `own_start_journal_used`). Einsteiger/vorsichtig: Angabe wird ignoriert (`own_start_ignored`).
14. **Nur Hauptziel Ausdauer**, Disziplin des Ziels = Disziplin des Wettkampfs, sonst `invalid_inputs`. Nebenziel Ausdauer mit Datum (PLAN-ZIELE F15) folgt später.
15. **Eigene Funktion `generateCompetitionPlan`** statt eines vierten Parameters an `generateTrainingPlan`: Typ und Ergebnis von `generateTrainingPlan` bleiben unverändert (die App wertet `result.error` aus), der neue Fehler `competition_not_feasible` trägt die Ampel.
16. **Folgeblöcke übernehmen nur Ausdauer-Tage mit Einheit** in der letzten Belastungswoche (bestehende Regel aus Phase 3: unter 10 min gestrichene Tage fehlen danach). Die Ampel bildet das nach – sonst hätte sie in Einzelfällen mehr Umfang versprochen, als der Plan liefert (vom Eigenschaftstest gefunden).
17. Der Hinweis `endurance_basic_only` bleibt auch im Wettkampfplan: Bis WP2 sind alle Einheiten locker.

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** G1 Erholungswoche nicht vorgezogen (3 Tests rot), G2 Tapering immer 1 Woche (5), G3 Mindestvorlauf ignoriert (2), G4 Plateau hebt statt deckelt (11), G5 „zu kurz“ erzeugt einen Plan (1, Eigenschaftstest), G6 unter 18 bis Marathon (1), G7 eigener Startumfang bis 3 × (2), G8 Erholungswoche ohne Angabe 50 % statt 60 % (6, u. a. Regressions-Prüfsumme), G9 kein 3 : 1 im Aufbau (5), G10 Vortag nicht frei (4), G11 Zielzeit für die vorsichtige Gruppe (2), G12 Folgeblock-Muster in der Ampel ignoriert (1, „Plan = Vorschau“), G13 Schwangerschaft erlaubt (3), G14 Zielzeit ohne Referenzzeit (1), G15 10-%-Regel auf 15 % gelockert (3 in `generate-competition.test.ts`, dazu der bestehende Schutzgrenzen-Test).

**Gründer-Fragen – entschieden 16.10.2026: G1–G7 alle „wie empfohlen“** (G2 und G7 umgesetzt in WP2, siehe
Umsetzungsstand WP2):

- **G1 – _(entschieden 16.10.2026: wie empfohlen)_ Halbmarathon „Ankommen“:** Voreinstellung 140 min/Woche (Einsteiger schaffen es in 16 Wochen). Alternative 150 min wie im Plan – dann bräuchten Einsteiger 17 Wochen (Tabelle 3.2 anpassen).
- **G2 – _(entschieden 16.10.2026: wie empfohlen)_ Langer Lauf vs. Deckel je Einheit (für WP2, Fachprüfung):** Voreinstellung WP1 prüft nur Wochenminuten. In WP2 muss der lange Lauf eine eigene Steigerungsregel bekommen (z. B. +10 % je Belastungswoche ab dem Start-Deckel und höchstens 50 % der Woche) – oder Marathon-Einsteiger brauchen deutlich mehr als 24 Wochen. Die Ampel kann dadurch in WP2 strenger werden.
- **G3 – _(entschieden 16.10.2026: wie empfohlen)_ Plateau:** Voreinstellung Spitzenumfang des Ziels (z. B. Halbmarathon 140 min, auch wenn 5 h/Woche angegeben sind). Alternative: bis zur Wunsch-Zeit steigern (mit 10-%-Regel).
- **G4 – _(entschieden 16.10.2026: wie empfohlen)_ Vortag:** Voreinstellung Ruhetag. Alternative 15–20 min locker (3.5).
- **G5 – _(entschieden 16.10.2026: wie empfohlen)_ Vorsichtige Gruppe im Aufbau 3 : 1** (W-G3 nennt nur Einsteiger): Voreinstellung ja (strengste Regel).
- **G6 – _(entschieden 16.10.2026: wie empfohlen)_ Vierter Ampel-Zustand „nicht möglich“** (statt „zu kurz“) für Schwangerschaft, fehlenden Gesundheits-Check und unter 18 ab Marathon: Voreinstellung ja.
- **G7 – _(entschieden 16.10.2026: wie empfohlen)_ Lauf-Wettkampf, aber der Plan ist nur zügiges Gehen** (Gesundheits-Flag, ab 65: bestehende Regel `enduranceWalkOnly` aus Phase 3; Tabelle 3.3 erlaubt ab 65 eigentlich lockeres Laufen und „zügige“ statt harter Einheiten). Heute sagt die Ampel z. B. für eine 70-Jährige beim Marathon „passt“, der Plan enthält aber nur Gehen. Vorschlag (Wächter M3, vor WP4 umsetzen): höchstens „knapp“ und Hinweis `walk_only_plan` („Dein Plan besteht aus zügigem Gehen – geeignet, um den Wettkampf zu gehen/walken“); Alternative: lockeres Laufen für diese Gruppe nach ärztlicher Freigabe. Bis zur Entscheidung: unverändert (WP1 ändert keine Phase-3-Regel).

**Nach der Wächter-Prüfung (16.10.2026, `waechter-wp1.md`, Freigabe mit Auflagen) umgesetzt:**

- **H1 – Tagebuch-Bezug und strengere Gruppe:** `startReference` trägt jetzt Pflicht-Feld `startGroup` (Startgruppe des bisherigen Plans). Ist die aktuelle Gruppe strenger (`isStricterGroup`, z. B. ab 65, neues Flag, Einsteiger statt Leistungssport), beginnt die Kette wie bei `nextPlanBlock` neu (`stricterGroup`: Bezug ≤ Startumfang der Gruppe, Start-Deckel je Einheit) – identisch in Ampel-Vorschau und Plan. Neu `competitionStartReference(previous, previousStartGroup, loggedMinutes?)`: rechnet den Bezug in Core aus den gespeicherten Einheiten über `enduranceReferenceFromBlock` (bevorzugter Weg für WP3/WP4). Beispiel 70 Jahre, Bezug 200/90 aus einem Fortgeschrittenen-Plan: Woche 1 ≤ 49 min, Einheiten ≤ 20 min (vorher 200 min/80 min).
- **H2 – Grenzen des Bezugs:** `competitionStartReferenceSchema` (Zod, strikt): Wochenumfang 0 oder 10–1.680 min (7 × 240, mehr kann kein gespeicherter Plan enthalten), längste Einheit 10–240 min und nie über dem Wochenumfang, ganze Minuten. Zusätzlich in Core gedeckelt auf 2 × Startumfang der aktuellen Gruppe (wie W-G5, Hinweis `start_reference_capped`). Konstante `COMPETITION_START_REFERENCE` (VOR LIVEGANG FACHLICH PRÜFEN).
- **M1 – keine Woche ohne Plan:** Ein Folgeblock beginnt immer am Montag nach der Woche der letzten Einheit (`nextCompetitionBlock` schneidet den Zyklus dort). Der Erholungsrhythmus wird ab dort neu gezählt (`macroCycle(…, restart)`, Zähler = Belastungswochen direkt davor, `trailingLoadWeeks`). Ohne Regeländerung ergibt das dieselben Erholungswochen; nach einem Wechsel (Flag neu/weg, Level) gibt es weder Lücken noch zwei Erholungswochen in Folge. Fiele die Erholungswoche nach einem Neustart in die letzte Woche vor dem Tapering und ist die Woche davor schon geplant, bleibt sie dort (Erholung geht vor, nie gestrichen). `competitionFollowUpBlock` bekommt dafür statt `lastScheduledOn` die bisherigen Einheiten (`previous`).
- **M2 – eigener Startumfang nur im ersten Block:** Folgeblöcke starten ohne Tagebuch-Bezug beim Startumfang der Gruppe (Tagebuch hat Vorrang). `nextPlanBlock` hat dafür keine Option mehr (`enduranceStartMinutes` entfernt), die Ampel-Vorschau rechnet genauso.
- **M5/N1 – Eigenschaftstest:** wieder 400 Läufe mit Varianten (ohne Zusatz, eigener Startumfang, Tagebuch-Bezug mit zufälliger Startgruppe, „Tage egal“, Gruppenwechsel strenger/lockerer ab Block 2). Neu geprüft am fertigen Plan: Start-Deckel je Einheit in Woche 0/erster Belastungswoche (Einsteiger 30, vorsichtig 20, wenn die Kette neu beginnt), Rhythmus phasengenau (Basis 5/4, Aufbau/Spitze 3 für Einsteiger/vorsichtig) aus den Wochen-Vorgaben statt aus den Einheiten (leere Erholungswochen zählen mit), keine Lücke zwischen Blöcken, nie zwei Erholungswochen in Folge, keine Einheit über 240 min. Dazu feste Tests H1, M1 (Flag neu und Flag weg) und M2 am fertigen Plan.
- **N2:** `volumeFactor` außerhalb (0; 1] bzw. `maxBudget` < 0 oder nicht endlich → `RangeError` in `enduranceWeekVolumes` (Programmierfehler laut melden).
- **Gegenproben:** H1 strengere Gruppe ignoriert (4 Tests rot), H2 ohne Obergrenze (1), H2 ohne Deckel (3), H2 Einheit länger als die Woche (1), M2 eigener Start in Folgeblöcken (1), M1 ohne Neustart des Rhythmus (2), M1 alter Folgeblock-Beginn (5), M1 Zähler immer 0 (1), N2 ohne Prüfung (5).
- **Byte-Gleichheit ohne Wettkampf** erneut bestätigt (Raster 7.560 Pläne + Folgeblock gegen `origin/main`, gleiche SHA-256; fester Test der Ausdauer-Teilmenge grün).

**Offen vor WP4 (Wächter, nur dokumentiert):**

- **M3:** Ampel „passt“ bei Lauf-Wettkampf, Plan nur zügiges Gehen (Flag, ab 65) → Gründer-Frage G7. **Erledigt in WP2**
  (höchstens „knapp“, Hinweis `walk_only_plan`).
- **M4:** Ruhetage nach dem Rennen je Distanz (`restDaysAfterRace`, Vorschlag 5 km/10 km 2, Halbmarathon 3, Marathon 5–7 Tage) statt 50 % des Spitzenumfangs ab dem Tag danach; dazu der Grundlagen-Block nach `cycle_finished`, der heute von der Spitze aus +10 % rechnet (Vorschlag: Bezug auf den Startumfang begrenzen). Beides mit den Faktoren in die Fachprüfung.
- **N3:** **Erledigt in WP2** (die Ampel prüft den langen Lauf). Lange Läufe werden bis WP2 nicht geprüft – die Ampel kann „passt“ sagen, obwohl z. B. kein 150-min-Lauf erreichbar ist (G2); WP2 macht die Ampel strenger. Im PR-Text als bekannte Einschränkung nennen.

**Offen:**

- ~~WP2: Einheiten-Arten je Phase, 80/20, langer Lauf (G2), Pace/Riegel, Zielzeit-Plausibilität gegen die Referenzzeit, Kraft in Spitze/Tapering (3.5), harte Einheiten heben `effort_target` über 4 (4b-Regel `endurance_reduce`, Risiko 7).~~ Umgesetzt, siehe Umsetzungsstand WP2.
- WP3: Tabelle `competitions` mit den Grenzen aus `COMPETITION_INPUT_LIMITS` (db-sync), gespeichert werden müssen auch bestätigter eigener Startumfang, Tagebuch-Bezug beim Erstellen (mit `startGroup`) und `effectiveGoal` – sonst rechnet ein Folgeblock einen anderen Makrozyklus.
- WP4: App (Ampel, Phase je Woche, Countdown); bis dahin ruft niemand `generateCompetitionPlan` auf.
- Folgeblock nach dem Ende des Makrozyklus läuft als normaler Grundlagen-Block und bezieht sich auf die letzte Belastungswoche (Spitze) – nach 3–5 Wochen Tapering/Erholung evtl. zu hoch; mit 4b bzw. WP4 klären (Vorschlag: Bezug auf den Startumfang begrenzen).
- Fachprüfung aller neuen Konstanten (Abschnitt 20 Punkt 5).

---

## 6. Etappe WP2 – Core: Einheiten, Intensität, Wochenbau

**Dateien:** `plan/endurance-workouts.ts`, `plan/intensity.ts`, Erweiterung `endurance.ts`, `move.ts` (aus A1a),
`reschedule.ts`.

- Einheiten-Bausteine als **feste Textbausteine** in Core (wie `ENDURANCE_TEXTS_DE`), ca. 20 Stück je Lauf (W-G8):
  Aufwärmen, Hauptteil mit Schritten (`{ kind: 'work' | 'easy' | 'rest', minutes | seconds, effort }`),
  Abwärmen, Sprechtest-Text, Ausweich-Text (Laufband). Keine KI.
- `weekWorkouts(phase, level, rules, days, volume)` verteilt Arten nach 3.4/3.5 und 80/20.
- `paceTargets(reference, workoutType)` (Riegel, Spannen), `distanceHint(minutes, pace)`.
- Sicherheitsregeln aus 3.3 in `apply-safety.ts`: harte Arten werden bei vorsichtigen Gruppen zu `easy` bzw.
  `fartlek ≤ 6` heruntergestuft (Strengeres wirkt sofort, Lockerungen erst nach Bestätigung – wie bisher).
- **48-h-Regel erweitert:** harte Ausdauer ↔ Kraft mit Beinen; harte ↔ harte Ausdauer. `moveTargets()` (A1a) und
  `rescheduleSession()` bekommen den Grund `hard_endurance_48h`. Verpasste harte Einheit: verschieben nur, wenn die
  Regel passt, sonst **streichen statt stapeln**.
- **Tests:** 80/20 je Woche (Eigenschaftstest), nie zwei harte Tage in Folge, langer Lauf ≤ Deckel, Erholungswoche
  ohne harte Einheit, vorsichtige Gruppen ohne harte Einheit, Pace ohne Referenz = null, Riegel-Rechnung mit
  Beispielwerten, 1 vs. 7 Tage, nur 2 Ausdauer-Tage (dann kein Tempo + langer Lauf in derselben Woche für
  Einsteiger), Tausch/Verschieben einer Intervall-Einheit neben Bein-Tag gesperrt.
- Keine Migration, keine App.

### Umsetzungsstand WP2 (16.10.2026)

**Was gilt (nur im Wettkampfplan – Pläne ohne Wettkampf bleiben byte-gleich):**

- **Einheiten-Bausteine** `packages/core/src/plan/endurance-workouts.ts` (W-G8, feste deutsche Texte, keine KI): Arten
  `easy`, `recovery`, `long`, `strides`, `fartlek`, `tempo`, `intervals`, `race_pace` (`WORKOUT_TYPES`) mit Namen,
  Auf-/Abwärmen, Hauptteil-Text, Sprechtest-Texten (`talkTestText`, `TALK_TEST_BANDS`) und Ausweich-Text (Laufband).
  Jede Einheit hat **Schritte** `{ part: warmup|main|cooldown, kind: work|easy|rest, seconds, effort }` (Zod
  `workoutStepsSchema`: 1–40 Schritte, 10 s–4 h, Anstrengung 0–10) – Summe = geplante Dauer (Timer in WP4).
  `easyWorkout`, `structuredWorkout` (null = passt nicht → locker), `weekWorkouts` (Wochenbau).
- **Intensität** `plan/intensity.ts`: `isHardWorkoutType` (Fahrtspiel, Tempo, Intervalle, Renntempo),
  `hardWorkoutLimits`/`hardEffortCapFor` (Tabelle 3.3 aus den wirksamen Sicherheitsregeln), `hardSeconds` und
  `weeklyHardBudgetSeconds` (80/20), `riegelTime`, `predictedTimeS`, `paceTargets`, `distanceHint`,
  `goalTimePlausible`, `PACE_NOTICE_DE` („Die Anstrengung hat Vorrang …“), dazu die neue Fassung der 4b-Regel
  `enduranceOverloadThreshold`/`isEnduranceOverload` (Vorschlag, noch nicht benutzt).
- **Langer Lauf (G2)** in `enduranceWeekVolumes` (`EnduranceWeekInput.longRun`, `distributeWithLongRun`): längste
  Einheit einer Belastungswoche ≤ floor(1,1 × längste Einheit der letzten Belastungswoche), erste Belastungswoche ≤
  Start-Deckel (Einsteiger 30, vorsichtig 20, sonst 90), Erholungs-/Tapering-Wochen nie länger als die letzte
  Belastungswoche, ≤ 50 % der tatsächlichen Woche, ≤ 75/90/120/180 min (5 km/10 km/Halbmarathon/Marathon). Tag:
  Wunsch-Tag (`CompetitionRequest.longRunWeekday`, 1–7) oder automatisch der Tag mit dem längsten Wunsch (Gleichstand: der
  spätere, also Wochenende). Die übrigen Einheiten teilen den Rest und sind nie länger als der lange Lauf.
- **Ampel** (`competition.ts`): prüft Wochenumfang **und** langen Lauf in derselben Belastungswoche
  (`requiredLongRun`: Ankommen 40/50/70/120 min, Zielzeit 60/75/105/165 min); neue Gründe `long_run_not_reachable`,
  `long_run_day_too_short`, Vorschlag `longer_long_run_day`; neue Felder `requiredLongRunMinutes`,
  `plannedLongRunMinutes`. **G7:** „nur Gehen“ (Flag, ab 65) → höchstens „knapp“, Hinweis `walk_only_plan`.
  **Zielzeit-Plausibilität:** Zielzeit höchstens 5 % schneller als die Riegel-Vorhersage aus der Referenzzeit, sonst
  `goal_time_not_reachable` → „Ankommen“, höchstens „knapp“. Plan = Ampel-Vorschau bleibt (dieselbe Funktion
  `competitionLongRun` in Plan und Ampel; `SimulatedWeek.longestMinutes`).
- **Wochenbau** (`schedule.ts`, `competitionWeekBuild`, Vorgabe `BlockWeekSpec.workouts` aus `competitionBlocks`):
  harte Einheiten nur in Aufbau, Spitze und Tapering (Tapering höchstens 1 – „Intensität bleibt“), nie in einer
  Erholungswoche, der Rennwoche oder der Erholung nach dem Rennen; Einsteiger/vorsichtige Startgruppe höchstens 1, sonst 2
  je Woche; Einsteiger erst ab 3 Ausdauer-Einheiten; bei ≥ 3 Einheiten bleibt immer eine lockere; nie an zwei Tagen
  hintereinander, nie am Tag vor oder nach dem langen Lauf, nie neben Kraft mit Beinen (Ganzkörper/Unterkörper; über das
  Blockende hinaus zählt jeder Kraft-Tag des Musters, beim Folgeblock die bisherigen Einheiten); nur im Lauf (nicht im
  Geh-Lauf-Wechsel/Gehen). Arten: Aufbau Einsteiger Fahrtspiel, sonst Tempo + Intervalle; Spitze Einsteiger Tempo (2
  Teile), sonst Renntempo + Intervalle; Tapering Fahrtspiel bzw. Renntempo; Basis Steigerungen (Fortgeschrittene, ab 3
  Tagen); Erholung nach dem Rennen Erholungsläufe. **80/20:** harte Zeit ≤ floor(20 % der Wochenminuten); passt die
  kleinste Struktur nicht, wird die Einheit locker. **Kraft** in Spitze, Tapering und Rennwoche höchstens 1 Einheit je
  Woche (ohne Beine bevorzugt), Bein-Übungen dort in Erholungs-Dosierung. **Minuten bleiben unverändert** (die Arten
  ändern nur den Inhalt) – die 10-%-Kette und die Ampel-Vorschau gelten weiter.
- **Neue Felder je Einheit** (nur Wettkampfplan, optional; Spalten mit WP3): `workout_type`, `training_phase`,
  `workout_steps`, `target_distance_m` (nur mit Referenzzeit, nur durchgehende Läufe, abgerundet auf 0,5 km,
  0,1–60 km). `generatedCompetitionSessionSchema`/`generatedCompetitionPlanSchema`/`isCompetitionPlanWithinLimits`:
  Anstrengung 1–8 (Vorlage CHECK WP3, Wächter N2), > 4 nur bei harter Art, harte Art nie in einer Erholungswoche außer im Tapering,
  Ausdauer immer mit Art, Phase und Schritten (Summe = Dauer). `generatedSessionSchema` prüft unverändert 1–4.
- **Sicherheit sofort** (`apply-safety.ts`, `applyCurrentEnduranceRules`): Einheiten mit Art – harte Arten und
  Steigerungen werden locker (Art, Name, Schritte, Anstrengung), wenn harte Einheiten nicht mehr erlaubt sind (Flag,
  Schwangerschaft, ohne Check, nur Gehen), die Variante wechselt oder der Start-Deckel kürzt; unter 18 höchstens 7.
  Fehlt `medicalNotice`, gilt vorsichtig „keine harten Einheiten“. Einheiten ohne Art: unverändert.
- **48-h-Regel erweitert** (`move.ts`, `reschedule.ts`): neuer Grund `hard_endurance_48h` (harte Ausdauer ↔ Kraft mit
  Beinen, ↔ harte Ausdauer, ↔ langer Lauf) in `validateMove`, `validateSwap`, `moveTargets`, `rescheduleSession`
  (verpasste harte Einheit: verschieben nur auf einen erlaubten Tag, sonst streichen). `ReschedulableSession.workout_type`
  ist optional – ohne Art wie bisher. Damit die App-Typprüfung grün bleibt, stehen in `apps/mobile/src/i18n/de.ts` zwei
  Texte für den neuen Grund (sonst keine App-Änderung).
- **Konstanten** (`constants.ts`, alle „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“ mit Quellen Borg 1982, Foster
  2008, Seiler 2010, Riegel 1981, Daniels 2014): `COMPETITION_LONG_RUN`, `COMPETITION_INTENSITY`, `COMPETITION_WORKOUTS`,
  `COMPETITION_PACE`, `COMPETITION_EFFORT_LIMITS`, `ENDURANCE_OVERLOAD_RULE`, `COMPETITION_STRENGTH`.
- Der Hinweis `endurance_basic_only` („Wettkampfplan kommt später“) entfällt im Wettkampfplan.
- **Keine Migration, keine neue Engine-Version, keine App** (außer den zwei Texten oben). `generateCompetitionPlan`
  ruft weiterhin niemand auf (WP4).

**Tests:** neu `intensity.test.ts` (10), `endurance-workouts.test.ts` (19, u. a. 80/20 je Phase bei 1–7 Tagen),
`endurance-long-run.test.ts` (8, u. a. Eigenschaft der Verteilung, „ohne `longRun` wie bisher“), `competition-wp2.test.ts`
(6), `move-hard.test.ts` (6), `apply-safety-competition.test.ts` (5), `generate-competition-workouts.test.ts` (5:
Eigenschaftstest **400 Läufe** mit Varianten ohne Zusatz / eigener Startumfang / Tagebuch-Bezug / „Tage egal“ /
Gruppenwechsel ab Block 2, mit und ohne Referenzzeit und Wunsch-Tag – geprüft am ganzen Plan: 10-%-Kette, Start-Deckel,
Erholungsrhythmus, langer Lauf (Steigerung, 50 %, Deckel), 80/20 je Woche, harte Einheiten (Anzahl, Phase, Abstand,
Gruppen, Anstrengung), Kraft in Spitze/Tapering, Plan = Ampel-Vorschau (Minuten **und** längste Einheit), „Ampel
ehrlich“ (passt = 2 Wochen mit Umfang und langem Lauf), G7; dazu 4 feste Beispiele). Gemeinsame Helfer
`competition-test-helpers.ts` (aus dem WP1-Test herausgelöst; der Helfer gibt jetzt `loadWeeksBefore` wie die App weiter).
Angepasst (bewusst strengere Ampel): `competition.test.ts` – Marathon-/Zielzeit-/Tabellen-Fälle brauchen am Tag des
langen Laufs genug Wunsch-Zeit (z. B. Sonntag 150 statt 90 min), Zielzeit 48 statt 45 min (45 ist 10 % schneller als die
50-min-Referenz und damit nicht plausibel), 1 Tag mit 60 min nennt zusätzlich `long_run_day_too_short`;
`generate-competition.test.ts` prüft die Blöcke mit dem Wettkampf-Schema (Anstrengung > 4). „Tabelle passt zur Kette“
gilt weiter – jetzt für Wochenumfang **und** langen Lauf. Core gesamt 4.119 → 4.178 Tests (+59, Zahlen laut Vitest); nach den Wächter-Auflagen siehe unten.

**Regression „ohne Wettkampf byte-gleich“:** fester Prüfsummen-Test aus WP1 grün (4.536 Ausdauer-Pläne + Folgeblock);
zusätzlich ein Raster aus 5.040 Plänen **mit Kraft** (7 Starttage × Level × Ziel × Disziplin × Gesundheits-Check × Alter ×
5 Zeitpläne inkl. „Tage egal“) + Folgeblock gegen den WP1-Stand (`11e1d92`) gerechnet: gleiche SHA-256. `pnpm
plan:examples` vor/nach zeichengleich.

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Geforderter langer Lauf = min(Richtwert, 50 % des Spitzen-Wochenumfangs)** – mit G2 (≤ 50 %) und G3 (Plateau beim
   Spitzenumfang) ist mehr nie erreichbar: Ankommen 40/50/70/120 statt der Richtwerte 40/60/90/150 → Gründer-Frage G8.
   Die Tabelle 3.2 passt damit weiter (Einsteiger erreichen Umfang und langen Lauf genau zum Mindestvorlauf, wenn der Tag
   des langen Laufs genug Wunsch-Zeit hat).
2. **35 % aus 3.5 entfällt** zugunsten von G2 (≤ 50 % der Woche bei ≥ 2 Einheiten). Bezug ist die tatsächliche Woche
   (nicht das Budget) – Rundung kann sonst 1 Minute kosten (vom Eigenschaftstest gefunden).
3. **Steigerung des langen Laufs** vom tatsächlich Gelaufenen der letzten Belastungswoche (nicht vom Deckel), wie die
   10-%-Regel. Für Fortgeschrittene ohne Start-Deckel startet die Kette bei 90 min (erste Belastungswoche), praktisch
   begrenzt die 50-%-Regel. Woche 0, Rennwoche und Erholung nach dem Rennen haben keinen langen Lauf, aber keine Einheit
   über dem Distanz-Deckel (Erholungswochen: über der letzten längsten).
4. **80/20-Zählweise:** Einsteiger und vorsichtige Startgruppe nur die harten Abschnitte (Plan 3.4), alle anderen den
   ganzen Hauptteil vom ersten bis zum letzten harten Abschnitt inkl. Trabpausen (strenger) → Gründer-Frage G9.
   Steigerungen zählen mit.
5. **Harte Einheit nie am Tag vor UND nach dem langen Lauf** (Plan: „nie am Tag vor“) – vorsichtiger. Über die Woche als
   Kreis (So ↔ Mo) geprüft, damit es auch an der Wochengrenze passt.
6. **Mindestdauer harte Einheit 25 min** (10 min Aufwärmen, 5 min Abwärmen); kürzere Tage bleiben locker. Folge: Bei
   vielen kurzen Tagen (z. B. Halbmarathon „Ankommen“ mit 4 Tagen: 70 + 26/25/19 min) gibt es kaum harte Einheiten →
   Gründer-Frage G10.
7. **Kraft „ohne schwere Beine“** = höchstens 1 Kraft-Einheit in Spitze, Tapering und Rennwoche (Oberkörper bevorzugt),
   Bein-Übungen (Hauptmuskel Gesäß, Quadrizeps, Beinbeuger, Adduktoren, Waden) in Erholungs-Dosierung (halbe Sätze,
   RPE −2) statt weglassen → Gründer-Frage G11.
8. **Tapering-Einheiten sind `is_deload`** (WP1) – harte Einheiten im Tapering sind trotzdem erlaubt („Intensität
   bleibt“, 3.1). Das Schema unterscheidet über `training_phase = taper`; die Server-Prüfung in WP3 muss das genauso tun.
9. **Ab 65** („zügig ≤ 6“, Tabelle 3.3) greift nicht, weil der Plan für diese Gruppe nur Gehen ist (Phase-3-Regel,
   G7); der Deckel 6 steht als Konstante bereit. Unter 18: Anstrengung ≤ 7, höchstens 1 harte Einheit je Woche
   (vorsichtige Startgruppe, strengste Regel).
10. **Pace** für locker/lang/Erholung/Tempo/Intervalle/Renntempo, Fahrtspiel und Steigerungen nach Gefühl. Renntempo
    aus der Riegel-Vorhersage (nicht aus der Zielzeit – vorsichtiger). Distanz-Richtwert nur für durchgehende Läufe.
11. **Zielzeit-Plausibilität 5 %** gegen die Riegel-Vorhersage (Gründer-Frage G12).
12. **Wunsch-Tag des langen Laufs** neu als optionale Angabe `longRunWeekday` (1–7, Zod); WP3 muss ihn mit dem Wettkampf
    speichern (sonst rechnet ein Folgeblock mit dem automatischen Tag).
13. **4b `endurance_reduce`:** Vorschlag „zu hart“ bei lockeren Zielen ab max(7, Ziel + 3) = 7 (unverändert), bei harten Zielen ab Ziel + 2, höchstens 9 (Wächter N4) – als
    Funktion bereit, Entscheidung im 4b-Plan. Der `db-sync`-Test bleibt bis WP3 unverändert (CHECK 1–4).

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):**

| Nr. | Gebrochene Regel                                                 | Rote Tests | Gefunden von                                                |
| --- | ---------------------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| W1  | Langer Lauf +20 % statt +10 % je Belastungswoche                 | 2          | Eigenschaftstest Wochenbau, `endurance-long-run`            |
| W2  | Langer Lauf ohne 50-%-Deckel der tatsächlichen Woche             | 3          | Eigenschaftstest, `endurance-long-run`                      |
| W3  | Langer Lauf ohne Distanz-Deckel (75/90/120/180)                  | 2          | Eigenschaftstest, `endurance-long-run`                      |
| W4  | 80/20 auf 30 % gelockert                                         | 6          | Eigenschaftstest, 80/20 je Phase (`endurance-workouts`)     |
| W5  | Harte Einheit neben dem langen Lauf erlaubt                      | 2          | Eigenschaftstest, Wochenbau 7 Tage                          |
| W6  | Harte Einheiten an zwei Tagen hintereinander                     | 2          | Eigenschaftstest, Wochenbau 7 Tage                          |
| W7  | Harte Einheit neben Kraft mit Beinen (Planung)                   | 2          | Eigenschaftstest, Beispiel am Plan                          |
| W8  | Harte Einheit in einer Erholungswoche                            | 3          | Eigenschaftstest, Wochenbau                                 |
| W9  | Gesundheits-Flag/ohne Check/nur Gehen erlauben harte Einheiten   | 2          | Grenzen je Gruppe, Beispiel Flag                            |
| W10 | Einsteiger mit 2 Tagen bekommen Tempo + langen Lauf              | 2          | Eigenschaftstest, Wochenbau 2 Tage                          |
| W11 | Unter 18 Anstrengung 8 statt 7                                   | 3          | Grenzen je Gruppe, Bausteine, apply-safety                  |
| W12 | Ampel prüft den langen Lauf nicht                                | 2          | Ampel WP2 (Marathon 90 min), Eigenschaft „Ampel ehrlich“    |
| W13 | G7: „nur Gehen“ darf „passt“ sein                                | 3          | Ampel G7, Eigenschaftstest                                  |
| W14 | Zielzeit ohne Plausibilität gegen die Referenzzeit               | 1          | Zielzeit-Plausibilität (Riegel)                             |
| W15 | Kraft in Spitze/Tapering unbegrenzt                              | 1          | Beispiel Kraft in Spitze/Tapering                           |
| W16 | Kalender ohne `hard_endurance_48h`                               | 5          | `move-hard.test.ts`                                         |
| W17 | apply-safety stuft harte Einheiten bei neuem Flag nicht herunter | 1          | `apply-safety-competition`                                  |
| W18 | Ampel ohne langen Lauf in der Kette (Plan ≠ Ampel)               | 24         | Plan = Ampel-Vorschau, Tabelle passt zur Kette, Ampel-Fälle |
| W19 | Tapering mit 2 harten Einheiten                                  | 1          | Wochenbau Tapering                                          |

Alle Änderungen danach zurückgesetzt (Vergleich mit einer Sicherungskopie des Quellcodes: identisch).

**Nach der Wächter-Prüfung (16.10.2026, `waechter-wp2.md`, Freigabe mit Auflagen) umgesetzt:**

- **M1:** In Erholungswochen und in Woche 0 keine Steigerungen (und keine harten Einheiten) mehr –
  `WeekWorkoutInput.weekZero`; der Eigenschaftstest prüft „kein Abschnitt mit Anstrengung ≥ 6 bei `is_deload` außer
  Tapering und in Woche 0“.
- **M2:** Die 50-%-Regel der tatsächlichen Woche gilt in **allen** Wettkampf-Wochen mit ≥ 2 Einheiten (auch Woche 0,
  Rennwoche, Erholung nach dem Rennen) – `halfWeekCap` in `enduranceWeekVolumes`, gleich in Plan und Ampel. Der
  Eigenschaftstest läuft mit 3 festen Seeds (je 400 Läufe, zusammen ca. 30 s) und ist bei allen grün.
- **M3:** Riegel nur bis Distanzfaktor 4 (`COMPETITION_PACE.maxRiegelDistanceFactor`, `riegelReliable`): sonst keine
  Zielzeit-Plausibilität (Ziel „Ankommen“, höchstens „knapp“, Grund `goal_time_not_reachable`, Hinweis
  `reference_distance_too_far`) und keine Pace auf dieser Basis. Test 5 km (20:00) → Marathon 3:05 und 3:20.
- **M4:** G8 als offen und **vor WP4 zu entscheiden** markiert (im PR-Text als bekannte Einschränkung nennen).
- **N1:** Direkter Test über `nextPlanBlock` (`schedule-competition-boundary.test.ts`): harte Einheit am letzten Sonntag →
  Montag des Folgeblocks nicht hart; letzter Tag des Blocks vor einem Kraft-Tag des Musters bleibt locker.
- **N2:** Wettkampf-Schema auf Anstrengung ≤ 8 gesenkt; WP3-Vorgaben ergänzt (CHECK ≤ 8, unter 18 ≤ 7, Zahl je Woche).
- **N3:** `applyCompetitionWeekLimits(sessions, rules, level)` (`apply-safety.ts`): wird Level/Gruppe strenger, bleiben
  je Woche nur die frühesten erlaubten harten Einheiten, überzählige werden locker. Zusätzlich zu
  `applyCurrentEnduranceRules` aufrufen (WP4).
- **N4:** Vorschlag `endurance_reduce` für harte Ziele vorsichtiger: ab Ziel + 2, höchstens 9.
- **N5:** `long_run_day_too_short` steht als Ursache vor den Umfangs-Gründen.
- **N6:** Wunsch-Tag ohne Ausdauer → automatisch, mit Hinweis `long_run_day_not_endurance`.
- Core danach 4.188 Tests (+10; der Eigenschaftstest zählt je Seed). Zeitgrenze der beiden Eigenschaftstests auf 240 s
  erhöht (unter `turbo` parallel lief der WP1-Test sonst in die 60-s-Grenze).
- Byte-Gleichheit ohne Wettkampf erneut bestätigt (Prüfsummen-Test, Raster 5.040 Pläne mit Kraft gegen `origin/main`,
  `pnpm plan:examples` zeichengleich).

| Nr. | Gegenprobe zu den Auflagen                                    | Rote Tests |
| --- | ------------------------------------------------------------- | ---------- |
| X1  | Steigerungen in Erholungswoche/Woche 0 wieder erlaubt (M1)    | 4          |
| X2  | 50-%-Regel nur in Wochen mit langem Lauf (M2)                 | 3          |
| X3  | Riegel ohne Faktor-4-Grenze (M3)                              | 2          |
| X4  | Blockgrenze ohne bisherige Einheiten (N1)                     | 2          |
| X5  | Blockende ohne Kraft-Muster (N1)                              | 3          |
| X6  | Zahl harter Einheiten bei strengerem Level nicht gesenkt (N3) | 2          |
| X7  | Wunsch-Tag ohne Ausdauer still (N6)                           | 1          |
| X8  | Wettkampf-Schema wieder bis 9 (N2)                            | 1          |

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **G8 – OFFEN, VOR WP4 ZU ENTSCHEIDEN (bevor die App die Ampel zeigt; Wächter M4) – Langer Lauf „Ankommen“:** Voreinstellung 40/50/70/120 min (5 km/10 km/Halbmarathon/Marathon) = höchstens 50 %
  des Spitzenumfangs (G2 + G3). Plan 3.2 nennt Halbmarathon 90–120 und Marathon 150–180 min. Alternative A: Plateau
  beim Doppelten des langen Laufs (Halbmarathon 180, Marathon 300 min/Woche – Einsteiger bräuchten dann deutlich mehr
  als 16 bzw. 24 Wochen, Tabelle 3.2 anpassen). Alternative B: langer Lauf bis 60 % der Woche. Fachprüfung.
- **G9 – 80/20-Zählweise:** Voreinstellung Einsteiger/vorsichtig nur harte Abschnitte, alle anderen der ganze Hauptteil
  inkl. Trabpausen (strenger). Alternative: für alle nur die harten Abschnitte (mehr Intervalle möglich).
- **G10 – Mindestdauer harte Einheit 25 min:** Voreinstellung 25 min; kurze Tage bleiben locker (bei vielen kurzen Tagen
  kaum Tempo/Intervalle). Alternative: kürzeres Aufwärmen (dann mehr harte Einheiten, aber weniger Vorbereitung).
- **G11 – Kraft in Spitze/Tapering:** Voreinstellung 1 Einheit je Woche, Beine in Erholungs-Dosierung. Alternative:
  Bein-Übungen ganz weglassen.
- **G12 – Zielzeit-Plausibilität:** Voreinstellung höchstens 5 % schneller als die Riegel-Vorhersage, und Riegel nur, wenn
  Referenz- und Zieldistanz höchstens um den Faktor 4 auseinanderliegen (Wächter M3; Marathon also erst mit
  Halbmarathon-Referenz – 10 km sind Faktor 4,22; Halbmarathon ab 10-km-Referenz). Darüber: keine Zielzeit, kein
  Renntempo, Hinweis `reference_distance_too_far`. Alternative: größerer Exponent (1,08–1,10) statt Grenze. Alternative 3 %
  (vorsichtiger) oder 8 %.

**Offen:**

- **WP3:** Spalten `workout_type`, `training_phase`, `target_distance_m`, `workout_steps` (Schema `workoutStepsSchema`),
  CHECK `effort_target` 1–8 mit „> 4 nur bei harter Art“, serverseitig unter 18 ≤ 7 und Zahl harter Einheiten je Woche
  (Einsteiger/vorsichtig 1, sonst 2) (Wächter N2), und „harte Art in Erholungswoche nur im Tapering“
  (`training_phase`), `longRunWeekday` am Wettkampf speichern; erst dann lässt sich ein Wettkampfplan mit harten Einheiten
  speichern (`toSavePlanPayload` überträgt die neuen Felder noch nicht). `db-sync.test.ts` schlägt dann absichtlich fehl
  → 4b-Regel `endurance_reduce` neu fassen (Vorschlag oben, PLAN-PHASE-4B).
- **WP4:** Anzeige von Art, Schritten, Pace (immer mit `PACE_NOTICE_DE`), Distanz-Richtwert, Sprechtest; Intervall-Timer
  aus `workout_steps`; Texte zu `long_run_not_reachable`, `long_run_day_too_short`, `longer_long_run_day`,
  `walk_only_plan`; die gespeicherte Einheit (`StoredSession`) muss `workout_type`/`workout_steps` mitbringen, damit
  `prepareSessionForDisplay` → `applyCurrentEnduranceRules` die Wettkampf-Regeln anwendet.
- Bisher offen aus WP1: M4 (Ruhetage nach dem Rennen), Grundlagen-Block nach `cycle_finished`, Fachprüfung aller neuen
  Konstanten (Abschnitt 20 Punkt 5) – inkl. der Bausteine aus WP2.

---

## 7. Etappe WP3 – Datenmodell (nur additiv, RLS, pgTAP)

**Neue Tabelle `competitions`** (Nutzerdaten, kein Gesundheitsdatum):

- `id`, `user_id` (Kaskade bei Konto löschen), `name` (1–80), `discipline`, `distance_m`, `race_date`,
  `goal_kind` (`finish | time`), `target_time_s` (nullable), `reference_*` (Distanz, Zeit, Datum, nullable),
  `status` (`planned | done | cancelled`), `result_session_log_id` (nullable, `on delete set null`),
  `created_at`, `updated_at`.
- Höchstens **ein** geplanter Hauptwettkampf je Person (Teil-Index), W-G9.
- RLS: nur eigene Zeilen lesen; Schreiben über `save_competition` / `cancel_competition` (`security definer`,
  `search_path = ''`, Prüfungen wie Zod). `goals.target_date` wird beim Speichern mitgeführt (Abwärtskompatibilität).

**Erweiterung `planned_sessions`** (alle Spalten nullable, alte Zeilen bleiben gültig):

- `workout_type` (Enum), `training_phase` (Enum), `target_distance_m` (100–60.000), `workout_steps jsonb`
  (Schema aus WP2, Größe begrenzt, CHECK auf Struktur über Funktion).
- `effort_target`: CHECK von 1–4 auf **1–8** erweitern (WP2: die Engine plant höchstens 8; unter 18 serverseitig ≤ 7) (nur Lockerung, alte Zeilen gültig) plus neue Bedingung
  „> 4 nur bei harter Art“. **Folge:** der 4b-Test in `db-sync.test.ts` schlägt absichtlich fehl → die 4b-Regel
  `endurance_reduce` wird im 4b-Plan mit Abstand zum Ziel neu gefasst (Eintrag in PLAN-PHASE-4B).
- `save_training_plan` / `append_plan_block` nehmen die neuen Felder an und prüfen sie serverseitig
  (Art ↔ Anstrengung, Erholungswoche ohne harte Art).

**Weitere Änderungen:**

- `log_source` um `gps` und `gpx_import` erweitern (`ALTER TYPE … ADD VALUE`, additiv).
- `export_my_data()` enthält `competitions` (und ab S1 `tracked_routes`).
- **pgTAP:** fremde Zeilen unsichtbar, `anon` nichts, Grenzen, ein Hauptwettkampf, Export, Konto löschen.
- `db-sync.test.ts`: neue Grenzen identisch in `constants.ts` und Migration.
- **Testmodus:** `localDb.competitions` mit denselben Regeln (`local-rules.ts`), Export, „Testdaten löschen“.

---

## 8. Etappe WP4 – App: Wettkampf, Plan-Ansicht, Countdown

- **Wettkampf anlegen:** im Onboarding-Schritt „Ziel“ (das bestehende Datumsfeld wird zu „Wettkampf eintragen“)
  und unter Einstellungen → „Mein Wettkampf“. Felder: Disziplin, Datum, Name (optional), Ziel „Ankommen“ oder
  „Zielzeit“ (nur wenn erlaubt), Referenzzeit (optional, mit Erklärung).
- **Machbarkeits-Ampel** sofort beim Datum (grün/gelb/rot mit Text und Vorschlägen; rot: „Plan ohne Wettkampf
  weiter“ oder „Datum/Distanz ändern“). Farben nie allein – immer mit Wort.
- **Plan-Ansicht:** Phasen-Band oben („Aufbau · Woche 6 von 14“), Einheiten mit Art, Dauer, Anstrengung,
  Distanz-Richtwert, Pace-Spanne (wenn vorhanden).
- **Trainingsmodus Intervalle:** Schritt-für-Schritt-Timer (Aufwärmen → 6 × 3 min zügig / 2 min locker →
  Abwärmen), Vibration beim Wechsel, Bildschirm bleibt an, offline, Pause/Weiter, „Abbrechen und eintragen“.
- **Countdown:** Karte auf „Heute“ und im Kalender („Noch 23 Tage bis zum Halbmarathon“), Renntag im Kalender
  markiert, Rennwoche mit Hinweis „Nichts Neues ausprobieren“.
- **Ergebnis eintragen** am Renntag oder danach: Zeit, Gefühl (Anstrengung), Notiz → freie Einheit (A1b) mit
  Verweis auf den Wettkampf; danach „Erholung nach dem Rennen“ und Frage nach dem nächsten Ziel.
- **Datum ändern / Wettkampf absagen:** „Plan neu erstellen“ (bis 4b ohne Automatik), mit Bestätigung.
- **Zustände:** Laden, kein Wettkampf (Einladung), zu kurz (rot mit Vorschlägen), Wettkampf vorbei ohne Ergebnis,
  abgesagt, offline (Anlegen erst online; Plan und Timer offline), Fehler vom Server mit Text.
- Texte in `i18n/de.ts`, Barrierefreiheit (Timer mit Ansage über `accessibilityLiveRegion`), hell/dunkel.
- Playwright im Testmodus: Wettkampf anlegen → Ampel → Plan mit Phasen → Intervall-Timer.

---

## 9. Etappe WP5 – Rad und Triathlon (zweite Welle, W-G2)

- **Rad:** Distanz 20–300 km (Radmarathon/Jedermann-Rennen), lockere Ausfahrten, lange Ausfahrt (bis 300 min,
  dafür eigener Deckel), Sweet-Spot/Tempo, Ergometer als Ausweich. Wochenumfang in Minuten, 10-%-Regel gleich.
- **Triathlon Sprint/Olympisch:** Disziplinen im Wechsel; **Koppeltraining** als **eine** Einheit mit zwei Teilen
  (Rad → Lauf), weil die Datenbank nur eine Einheit je Tag erlaubt (kein Doppeltag). Schwimmen: Technik und
  locker nach Dauer; Freiwasser nur mit Sicherheitshinweis (nie allein, Neopren, Begleitung).
- **Mittel- und Langdistanz:** Empfehlung **nicht** als Plan anbieten (Hinweis: Trainer bzw. Verein), W-G2.
- Gleiche Core-Struktur wie WP1/WP2, eigene Tests (Umfang je Disziplin, Koppeleinheit zählt in beide
  Disziplinen-Minuten, 10-%-Regel über die Summe).

---

## 10. Etappe W1 – Wettkampf-Ernährung (wie PLAN-PHASE-5 19.7)

Übernommen aus PLAN-PHASE-5 19.7 W1 und 19.8, ergänzt um Renntag und Gel-/Trinkplan.

**Core (`packages/core/src/nutrition/competition.ts`):**

- `competitionDays(competition, week)` → je Tag `carb_loading | race_eve | race_day | post_race | normal`.
- **Carb-Loading nur bei erwarteter Wettkampfdauer ≥ 90 min** (aus Distanz und Referenz-/Zielzeit, sonst
  vorsichtige Schätzung je Distanz und Level). `CARB_LOADING_DAYS = { min: 1, max: 2 }` (Burke 2011, Thomas 2016,
  **VOR LIVEGANG FACHLICH PRÜFEN**).
- An Carb-Loading-Tagen: Zielanpassung = Erhalt (kein Defizit), **4b-Versatz = 0**, Makros zu mehr Kohlenhydraten,
  **Fett ≥ 20 % der Energie, Eiweiß ≥ Minimum aus 4.7**; die Werte „8–10 g/kg“ nur, soweit die Energie es zulässt,
  sonst Hinweis. Alles als **Eingabe** in `nutritionTargetsForWeek` → `clampCalorieTarget` bleibt die einzige
  Stelle mit Schutzgrenzen (Strukturtest K2 erweitert).
- `no_targets` (Schwangerschaft, keine Einwilligung): nur allgemeine Hinweise. `maintenance_only`/unter 18: nur
  Makro-Verschiebung im Erhaltungsband.
- **Renntag:** Frühstück 2–4 h vorher (Richtwert 1–4 g KH/kg, Thomas 2016) als Text und Rezeptvorschlag aus
  Kategorie `wettkampf`; „nichts Neues am Renntag“.
- **Gel-/Trinkplan** `raceFuelingPlan(expectedMinutes, level)`: unter 60 min nichts nötig; 60–150 min ca.
  30–60 g KH/Stunde; über 150 min bis 60–90 g/Stunde nur für Fortgeschrittene/Leistungssport mit Hinweis
  „vorher im langen Lauf testen“ (Jeukendrup 2014, Sports Med 44 Suppl 1). Trinken nach Durst, Richtwert
  400–800 ml/Stunde, Hinweis auf Hitze und Salz; **keine Marken**, keine Koffein-Empfehlung im Plan
  (Supplement-Modul), keine Health Claims („unterstützt“, nicht „verbessert“).
- Unter 18: Gel-Plan nur allgemein („Kohlenhydrate in kleinen Mengen, z. B. Banane“).
- Filter: Rezepte `wettkampf` sind an den Wettkampftagen **erlaubt**, sonst weiter ausgeschlossen (`filter.ts`).

**App:** Wettkampftage im Essensplan markiert, Ratgeber „Wettkampf-Ernährung“ verlinkt, Gel-/Trinkplan als
Zeitleiste am Renntag (offline), Schalter „Kalorienzahlen anzeigen“ gilt überall. Tagesauswertung (A2): Carb-Loading-
Tag zeigt das angepasste Tagesziel mit Satz „Heute mehr Kohlenhydrate – so geplant“.

**_DoD:_** Eigenschaftstest „Carb-Loading-Tag ≥ Untergrenze und ≤ Obergrenze, Fett ≥ 20 %, Eiweiß ≥ Minimum“,
Fälle unter 18, `maintenance_only`, Fettverlust, `no_targets`, Wettkampf < 90 min (kein Carb-Loading),
Wettkampf am Montag (Carb-Loading in der Vorwoche), Wettkampf abgesagt (Tage normal); Strukturtest K2 grün.
**Premium/Gratis:** siehe W-G10.

---

## 11. Strecken: Technik-Entscheidungen

### 11.1 Karten-Kacheln: Anbieter, Kosten, Lizenz (Stand bitte vor Vertragsabschluss prüfen)

Jede Kachel-Anfrage verrät dem Anbieter die **IP-Adresse und den Kartenausschnitt** (also ungefähr, wo man ist).
Deshalb: EU-Anbieter oder eigene Datei, Auftragsverarbeitung (AVV), Datenschutzerklärung.

| Option                                                        | Kosten (ca.)                                                                                  | Grenzen / Bedingungen                                                                      | Eignung                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `tile.openstreetmap.org`                                      | 0 €                                                                                           | Nutzungsbedingungen verbieten App-Massennutzung, Vorladen, Offline; kein SLA, kann sperren | **nicht nutzen**                         |
| OpenFreeMap (Vektor, ohne Schlüssel)                          | 0 €                                                                                           | spendenfinanziert, kein SLA, keine Garantie                                                | **Testphase**                            |
| MapTiler Cloud                                                | Free nur nicht-kommerziell (ca. 100.000 Anfragen/Monat, Logo); bezahlt ab ca. 25–30 USD/Monat | Konto + Schlüssel, Geocoding dabei                                                         | Livegang, wenn wenig Aufwand wichtig ist |
| Stadia Maps                                                   | Free nur nicht-kommerziell; bezahlt ab ca. 20 USD/Monat                                       | Konto + Schlüssel                                                                          | Alternative                              |
| **Protomaps (eine PMTiles-Datei DACH) auf Cloudflare R2, EU** | wenige €/Monat (Speicher einige GB, keine Ausgangsgebühren)                                   | einmal einrichten, Aktualisierung per GitHub Action, keine Anfrage-Limits                  | **Livegang (Empfehlung)**                |
| Mapbox                                                        | Freikontingent, dann teuer                                                                    | eigene Lizenz, mit MapLibre nicht vorgesehen                                               | nicht nutzen                             |

- **Attribution** immer sichtbar: „© OpenStreetMap-Mitwirkende“ (ODbL) plus Stil-Anbieter.
- **Bibliothek:** MapLibre – nativ `@maplibre/maplibre-react-native` (Kompatibilität mit Expo SDK 57 und der neuen
  Architektur im Spike S0 prüfen), Web `maplibre-gl` (nur auf der Kartenseite nachladen). Aufteilung
  `map.native.tsx` / `map.tsx`.
- **Kosten-Bremse:** Karte nur auf Strecken-Seiten, keine Kartenvorschau in Listen (statt dessen kleine
  Linien-Skizze aus der Strecke selbst, ohne Kacheln).

### 11.2 GPS-Aufzeichnung

- `expo-location` + `expo-task-manager`, Aufzeichnung im **Development Build** (Expo Go kann keinen
  Hintergrundbetrieb). Neue Berechtigungstexte in `app.config.ts`.
- **Ziel: nur „Beim Verwenden der App“** plus sichtbare Aufzeichnung (iOS: blauer Standort-Hinweis,
  Android: Vordergrund-Dienst mit Benachrichtigung „Aufzeichnung läuft“). So vermeiden wir die strenge
  Play-Prüfung für „Standort im Hintergrund“. Ob `expo-location` das ohne Hintergrund-Berechtigung zulässt, prüft
  der Spike S0; sonst braucht es „Immer erlauben“ mit Begründung und die Play-Erklärung (W-G13).
- Standort **nur während einer Aufzeichnung**, nie sonst.
- **Web:** `navigator.geolocation` läuft nur bei offenem Bildschirm, gesperrtes Handy stoppt die Aufzeichnung.
  Empfehlung: im Web keine echte Aufzeichnung, sondern Hinweis „Aufzeichnen geht in der App“ und im Testmodus eine
  **Demo-Aufzeichnung** aus einer Beispiel-GPX (W-G14).
- **Speicherung:** keine PostGIS-Erweiterung nötig (keine räumlichen Abfragen über Personen hinweg). Die Strecke
  wird vereinfacht (Douglas-Peucker) und als komprimierte Linie (Polyline) gespeichert; Rohpunkte mit Genauigkeit
  und Zeitstempeln bleiben nur während der Aufzeichnung verschlüsselt auf dem Gerät und werden nach dem Speichern
  gelöscht. Kilometerzeiten werden beim Speichern gerechnet und mitgespeichert (für den Zeitvergleich).

---

## 12. Etappen S0, S1, S2a, S2b – Strecken

### S0 – Spike: Development Build, GPS, Karte (klein, technischer Test)

- Voraussetzung: SETUP Teil D (Expo-Projekt-ID) erledigt; für iPhone Teil D2 (Apple-Konto).
- `expo-location`, `expo-task-manager`, MapLibre einbauen, Berechtigungstexte, Testbildschirm nur im Testmodus.
- Prüfen: Hintergrund mit „Beim Verwenden“, Akku über 60 min, Genauigkeit, Tunnel/Funkloch, Absturz während der
  Aufzeichnung (Wiederaufnahme), Web-Export baut weiter.
- _Ergebnis:_ kurzer Bericht im PR + Entscheidung W-G13. **Kein** Nutzer-Feature.

### S1 – Strecken aufzeichnen (Gratis, privat, KONZEPT 10.1)

**Core (`packages/core/src/routes/`):**

- `filterTrackPoints` (Genauigkeit > 30 m raus, Sprünge über `CARDIO_PLAUSIBILITY_KMH` raus, Zeit rückwärts raus),
  `trackDistance` (Haversine), `elevationGain` (Glättung + Schwelle 3–5 m gegen GPS-Rauschen, Hinweis „Höhenmeter
  per GPS sind ungenau“), `autoPause` (unter Gehtempo = Pause), `kmSplits`, `simplifyTrack`, `encodePolyline` /
  `decodePolyline`, `compareAttempts` (nur eigene Läufe derselben Favoriten-Strecke), `toGpx` (GPX 1.1).
- Zod: `trackedRouteSchema` (Name 1–80, Notiz ≤ 280, Art `run | bike | walk`, Schwierigkeit `easy | medium |
hard`, höchstens 5.000 Punkte nach Vereinfachung, Dauer 1 min–12 h wie `cardio_logs`).
- **Tests:** 0/1/2 Punkte, Stillstand (Distanz 0), GPS-Sprung, Funkloch 5 min, doppelte Zeitstempel, Zeit
  rückwärts, 12 h, 100.000 Rohpunkte (Laufzeit), Bergab-Rad mit 70 km/h (Warnung, nicht verwerfen),
  Polyline-Rundreise, GPX-Export gültig (Schema), Kilometerzeiten bei 0,99 und 1,01 km.

**Datenmodell (additiv, RLS):** Tabelle `tracked_routes` (KONZEPT 12):

- `id`, `user_id` (Kaskade), `name`, `sport`, `started_at`, `duration_s`, `moving_s`, `distance_m`,
  `elevation_gain_m`, `polyline` (Text, Längen-CHECK), `point_count`, `bbox`, `km_splits jsonb`, `difficulty`,
  `is_favorite`, `base_route_id` (Wiederholung einer Favoriten-Strecke, nullable, `on delete set null`), `note`,
  `session_log_id` (nullable, `on delete set null`), `source` (`recorded | gpx_import`), `created_at`.
- RLS: nur eigene Zeilen; Schreiben über `save_tracked_route` / `delete_tracked_route` /
  `delete_all_tracked_routes` (Prüfung wie Zod, Tageslimit gegen Missbrauch). Export: JSON in `export_my_data`
  - GPX je Strecke in der App. Konto löschen: Kaskade. Widerruf `health_data`: Strecken bleiben (kein
    Gesundheitsdatum, W-G15), verknüpfte Einträge werden wie bisher neutralisiert.
- pgTAP: fremde Strecken unsichtbar, `anon` nichts, Grenzen, Löschen, Export, Partner-Modus sieht nichts.

**App:**

- „Strecke aufzeichnen“ (Start/Pause/Stopp, große Zahlen: Zeit, Distanz, Pace bzw. km/h), Bildschirm an,
  Aufzeichnung läuft weiter bei gesperrtem Handy (nativ).
- Erste Nutzung: eigener Erklär-Bildschirm **vor** der System-Abfrage („Wir nutzen deinen Standort nur während du
  aufzeichnest. Deine Strecken sehen nur du.“). Abgelehnt → klarer Zustand mit Weg zu den Einstellungen.
- Speichern: Name, Favorit, Schwierigkeit, Notiz. **Automatischer Tagebuch-Eintrag:** passt eine heute geplante
  Ausdauer-Einheit gleicher Art ohne Eintrag → Frage „Zu ‚Lockerer Dauerlauf‘ zählen?“ (Standard Ja); sonst freie
  Einheit (A1b). Quelle `gps`. Für die 10-%-Regel gilt weiter `min(geplant, eingetragen)`.
- Favoriten: „Erneut laufen“ → neue Aufzeichnung mit `base_route_id`; Vergleich der eigenen Zeiten (Liste und
  Kilometerzeiten), **ohne** Ranglisten oder Vergleich mit anderen; Text neutral („Heute 1:20 min schneller“, kein
  Druck, keine Serien).
- Liste „Meine Strecken“ mit Linien-Skizze, Löschen einzeln/alle, GPX-Export (Datei speichern wie Datenexport –
  kein Teilen-Dialog nach außen; die Datei gehört der Person).
- **Offline:** Aufzeichnung braucht kein Internet; Punkte werden alle 30 s verschlüsselt zwischengespeichert
  (`protected-store`), nach Absturz „Aufzeichnung fortsetzen oder speichern?“; Speichern über die Warteschlange.
- **Zustände:** keine Berechtigung, GPS schwach („Suche GPS …“), Akku-Sparmodus-Hinweis, zu kurz (< 1 min oder
  < 100 m → nicht speichern, fragen), Speicherfehler (bleibt lokal), Web (Hinweis + Demo).

### S2a – Karte, GPX-Import, eigene Strecken auf der Karte (Gratis)

- Karte (MapLibre) für jede gespeicherte Strecke, Start/Ziel-Markierung, Kilometer-Punkte, Attribution.
- **GPX-Import** eigener Dateien (Datei wählen): sicherer XML-Parser **ohne** externe Entitäten (Schutz vor
  „XML-Bomben“), höchstens 5 MB und 50.000 Punkte, mehrere Spuren/Segmente zusammengeführt, GPX ohne Zeiten
  erlaubt (dann nur Strecke, keine Zeit). Original-Datei wird nicht gespeichert, nur die vereinfachte Strecke.
- Importierte Strecke = „geplante Route“ zum Nachlaufen (Favorit möglich) oder vergangene Aktivität (mit Zeiten →
  Tagebuch-Eintrag als freie Einheit, Quelle `gpx_import`, nur bis 14 Tage zurück wie A1b).
- Tests: kaputtes XML, Billion-Laughs, riesige Datei, Wegpunkte ohne Spur, Route (`rte`) statt Spur (`trk`),
  Höhe fehlt, Zeitzonen.
- Web voll nutzbar (Karte, Import, Export) – gut zum Testen in der Vercel-Vorschau.

### S2b – Strecken-Vorschläge und Standortsuche (Premium laut KONZEPT 13, später – W-G12)

- Vorschläge im Umkreis nach Disziplin, Distanz, Höhenmetern, Untergrund (KONZEPT 10).
- Empfohlene Quelle: **vorab berechnete Strecken** aus OpenStreetMap (z. B. ausgeschilderte Lauf- und Radrouten),
  per GitHub Action erzeugt, redaktionell freigegeben, als Inhaltstabelle `routes` (`published`, mit Lizenz ODbL
  und Quelle). **Keine** Live-Abfragen an öffentliche Overpass-/Nominatim-Server im Betrieb (Nutzungsbedingungen:
  max. 1 Anfrage/s, keine Massennutzung). ODbL-Share-Alike für die abgeleitete Datenbank juristisch prüfen.
- Standortsuche (Ortsname → Karte) über den gewählten Kartenanbieter oder eigene Ortsliste; Standort wird nicht
  gespeichert.
- Erst nach 4b bzw. mit Phase 7 (Premium-Prüfung serverseitig).

---

## 13. Datenschutz und Sicherheit (gilt für alle Etappen)

- **Standortdaten sind streng privat:** RLS, nur eigene Zeilen, keine Aggregation, kein Teilen, keine Ranglisten,
  keine öffentlichen Profile; Partner-Modus (Phase 11) **ohne** Strecken, solange nicht ausdrücklich beschlossen.
- **Nie an Analytics, Werbung, Affiliate oder Logs:** Test, der Payloads, Fehlermeldungen und Log-Aufrufe auf
  Koordinaten prüft; keine Fremd-SDKs mit Standortzugriff. Postgres-Einstellung
  `log_parameter_max_length_on_error = 0` bleibt.
- **Datenminimierung:** nur vereinfachte Linie, keine Rohpunkte auf dem Server, keine Hintergrund-Ortung außerhalb
  der Aufzeichnung, kein Standort in Wettkämpfen (nur Name/Datum).
- **Einwilligung:** Standort ist kein Art.-9-Gesundheitsdatum; Rechtsgrundlage Vertrag (die Person startet die
  Aufzeichnung selbst) + System-Berechtigung + Erklär-Bildschirm. Herzfrequenz kommt nicht hinzu (Phase 8).
  DSFA-Ergänzung „Standortverläufe“ und Datenschutzerklärung (Kartenanbieter als Empfänger) – W-G15.
- **Export und Löschung:** JSON-Export enthält `competitions` und `tracked_routes`, GPX je Strecke; Löschen
  einzeln, alle Strecken, Konto (Kaskade).
- **Gesundheit:** Wettkampfplan nur nach Gesundheits-Check, Hinweise zur ärztlichen Abklärung (3.3), keine
  Maximaltests, Kalorien-Schutzgrenzen unverändert, 10-%-Regel und Erholungswochen nicht abschaltbar.

---

## 14. Gratis / Premium und Kosten

- **KONZEPT 13** sagt: „Wettkampfvorbereitung“ und „Strecken-Vorschläge“ = Premium; „Strecken aufzeichnen,
  Favoriten, Schwierigkeit“ = gratis. Premium-Inhalte sind ohne KI.
- In der **Testphase alles offen** (wie Phase 5). Server-Prüfung mit Phase 7 (`has_entitlement` in
  `save_competition` bzw. beim Speichern eines Wettkampfplans). Feature-Flag/`beta-grant` gibt es erst mit 4b –
  deshalb kein eigener Mechanismus in Phase 10.
- **Laufende Kosten:** keine KI-Kosten. Karten: Testphase 0 € (OpenFreeMap), Livegang wenige €/Monat (Protomaps
  auf R2) oder ca. 20–30 USD/Monat (MapTiler/Stadia). EAS: begrenzte Gratis-Builds pro Monat (Stand prüfen),
  Apple Developer 99 USD/Jahr, Google Play 25 USD einmalig (SETUP D2).

---

## 15. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (Wettkampf, Einheiten-Schritte, Strecke, GPX-Import).
2. Migration nur additiv, mit RLS und pgTAP (Workflow `db-test`); Grenzen gleich in `constants.ts`
   (`db-sync.test.ts`).
3. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen (sehr leicht/schwer, sehr jung/alt, 1 vs. 7 Tage,
   Mindestvorlauf ±1 Tag, GPS-Sonderfälle); neue Werte mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG
   FACHLICH PRÜFEN“.
4. UI mobil + Web-Export (Karte/Import im Web, Aufzeichnung nativ + Demo im Web); Playwright im Testmodus.
5. Lade-, Leer-, Fehler-, Offline- und Berechtigungs-Zustände.
6. Texte auf Deutsch (`i18n/de.ts`), keine Health Claims, Barrierefreiheit, hell/dunkel.
7. Doku: dieser Plan (Umsetzungsstand), KONZEPT 4/6.6/10/10.1/12, PLAN-PHASE-4B, PLAN-AUSWERTUNG 2.5,
   HANDY-ANLEITUNG („Wettkampf testen“, „Strecken testen“), SETUP (Kartenanbieter, Standorttexte), `.env.example`.
8. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 16. So testet ihr es am Handy

**WP4 (Vercel-Vorschau, Testmodus):**

1. Link aus dem Pull Request → „Ohne Konto testen“ → Ziel Ausdauer, Halbmarathon, Datum in 16 Wochen.
2. Ampel grün → Plan zeigt Phasen („Basis · Woche 1 von 16“), lange Läufe am Wochenende.
3. Datum auf 6 Wochen ändern → rot, Vorschläge erscheinen; „Ohne Wettkampf weiter“ testen.
4. Eine Intervall-Einheit öffnen → Timer starten → Schritte wechseln mit Vibration (am Handy).
5. Einstellungen → Gesundheits-Check mit Flag → Plan hat keine harten Einheiten mehr.

**W1:** Wettkampf in 5 Tagen anlegen → Essensplan zeigt Carb-Loading-Tage und Renntag; „Kalorienzahlen aus“ →
nirgends kcal; Wettkampf 5 km → kein Carb-Loading.

**S1 (nur echte App):**

1. GitHub-App → **Actions → eas-build → Run workflow** → Plattform `android`, Profil `preview` (APK) bzw.
   `development` → Link aus dem Build öffnen → APK installieren. iPhone: Profil `production` → TestFlight.
2. App öffnen → „Strecke aufzeichnen“ → Erklär-Bildschirm → „Beim Verwenden erlauben“.
3. 10 Minuten gehen, Handy sperren, zurück → Strecke läuft weiter; Stopp → Speichern als Favorit.
4. Tagebuch zeigt den Eintrag; „Erneut laufen“ → Zeiten werden verglichen.
5. Flugmodus während der Aufzeichnung → geht weiter; nach dem Speichern online → wird hochgeladen.
6. Einstellungen → Meine Daten → Export enthält die Strecke; Strecke löschen → weg.

**S2a (Vercel-Vorschau):** Strecken → „GPX importieren“ → Beispieldatei aus dem PR → Karte erscheint mit
„© OpenStreetMap-Mitwirkende“; GPX-Export herunterladen.

---

## 17. Risiken

1. **Zu ehrgeizige Ziele** (Marathon in 8 Wochen). _Gegenmittel:_ Ampel, nie stauchen, Vorschläge.
2. **Fachliche Fehler in den Zahlen.** _Gegenmittel:_ Konstanten mit Quellen, Fachprüfung vor Livegang.
3. **GPS-Hintergrund und Store-Prüfung** (Play-Erklärung, Apple-Begründung). _Gegenmittel:_ Spike S0, nur „Beim
   Verwenden“, klare Texte.
4. **Akku und Genauigkeit.** _Gegenmittel:_ Filter, Glättung, Hinweis zu Höhenmetern, Test über 60 min.
5. **Kartenkosten steigen mit Nutzern.** _Gegenmittel:_ eigene PMTiles-Datei, keine Kacheln in Listen.
6. **EAS noch nicht eingerichtet** → Aufzeichnung nicht testbar. _Gegenmittel:_ früh SETUP Teil D erledigen.
7. **Konflikt mit 4b** (`effort_target` > 4). _Gegenmittel:_ Test schlägt bewusst fehl, Regel im 4b-Plan neu.
8. **Parallele Arbeit** (A1a/A1b ändern `move.ts`, E1/A2 ändern Tagesziele). _Gegenmittel:_ Reihenfolge Abschnitt 18.
9. **Lizenz OSM/ODbL bei S2b.** _Gegenmittel:_ juristische Prüfung vor S2b.
10. **Druck durch Zeitvergleich.** _Gegenmittel:_ neutrale Texte, keine Serien, keine Abzeichen für Bestzeiten.

---

## 18. Zeitplan (relativ zu den laufenden Etappen)

Laufend bzw. als Nächstes: **N8** (Gemini, umgesetzt, ohne Commit), **A1a** Kalender (in Arbeit) → **A1b** →
**E1** → **A2** → **E2** → **A3** (PLAN-AUSWERTUNG). Offen außerdem: N7 Teil 2, Z3–Z6 (PLAN-ZIELE, F12).

**Empfohlene Reihenfolge (je Schritt ein Pull Request):**

1. **Jetzt:** W0 (dieser Plan) freigeben. **Parallel ihr:** SETUP Teil D/D2 (EAS, Apple), Fachprüfung anfragen.
2. A1a fertig → **A1b** (freie Einheiten sind Voraussetzung für S1 und das Wettkampf-Ergebnis).
3. **Parallel zu E1:** **WP1** und **WP2** (nur Core, keine Konflikte mit der Ernährungs-App).
4. Nach A1b, parallel zu A2: **WP3** (Migration) → **WP4** (App Wettkampf, Countdown, Intervall-Timer).
5. Sobald EAS läuft: **S0** (Spike) → **S1** (Aufzeichnung) → **S2a** (Karte, GPX).
6. Nach A2: **W1** (Wettkampf-Ernährung; der Kalorienbalken kennt dann die Carb-Loading-Tage).
7. Dann E2 → A3, danach **WP5** (Rad/Triathlon, falls gewünscht) und **Phase 4b**.
8. **S2b** (Vorschläge, Premium) nach 4b bzw. mit Phase 7.

**Wann startet Phase 10?** Die Entscheidung vom 13.10. („direkt nach Phase 5“) bleibt sinngemäß: Phase 5 ist bis auf
N7 Teil 2 und W1 fertig; W1 gehört zu Phase 10. Empfehlung: **Core-Etappen WP1/WP2 sofort nach A1b bzw. parallel zu
E1 starten**, App-Etappen nach A1b. Z3–Z6 (PLAN-ZIELE) und N7 Teil 2 laufen dazwischen, wenn ihr sie vorzieht
(W-G1).

Grobe Größe: W0 + 10 Etappen ≈ 10–12 Pull Requests; WP5 und S2b sind abtrennbar.

---

## 19. Was wir von euch brauchen (Gründer-Entscheidungen)

**Entschieden 16.10.2026: W-G1 bis W-G16 alle „Ja, wie empfohlen“.** Die Empfehlungen unten gelten damit verbindlich.

Format: _Worum es geht – Warum wir fragen – Empfehlung._

- **W-G1 Start und Reihenfolge.** Wann Phase 10 im Verhältnis zu A1a–A3, Z3–Z6 und N7 Teil 2 kommt. – Die
  Entscheidung vom 13.10. kannte die Auswertungs-Etappen noch nicht. – **Empfehlung:** Reihenfolge aus 18
  (Core parallel zu E1, App nach A1b, W1 nach A2).
- **W-G2 Disziplinen.** Welche Wettkämpfe Phase 10 plant. – Jede Disziplin braucht eigene Regeln und Fachprüfung.
  – **Empfehlung:** zuerst Laufen 5 km bis Marathon; Rad und Triathlon Sprint/Olympisch als zweite Welle (WP5);
  Mittel-/Langdistanz und Schwimm-Wettkämpfe **nicht** als Plan (Hinweis Trainer/Verein).
- **W-G3 Mindestvorlauf und Erholungsrhythmus.** Tabelle 3.2 und 3 : 1 für Einsteiger im Aufbau. – Das schützt
  vor Überlastung, schließt aber kurzfristige Anmeldungen aus. – **Empfehlung:** wie Tabelle, fachlich prüfen.
- **W-G4 Vorsichtige Gruppen.** Tabelle 3.3 (kein Plan in der Schwangerschaft, nur „Ankommen“ bei Flag/ab 65,
  unter 18 höchstens Halbmarathon). – Gesundheitsschutz vs. Wunsch nach Wettkampf. – **Empfehlung:** wie Tabelle.
- **W-G5 Eigener Startumfang.** Darf man „ich laufe schon 3 h pro Woche“ angeben? – Sonst starten Erfahrene zu
  niedrig; Selbstangaben sind aber oft zu hoch. – **Empfehlung:** nur Fortgeschritten/Leistungssport, gedeckelt
  (höchstens das Doppelte des Startumfangs) und mit Bestätigung; sonst Tagebuch-Werte.
- **W-G6 Ziel „Ankommen“ oder Zielzeit, Distanz-Richtwert.** – Zielzeit braucht eine Referenzzeit; Distanz-Ziele
  ändern die Auswertung (PLAN-AUSWERTUNG 2.5). – **Empfehlung:** Standard „Ankommen“; Zielzeit und Pace nur mit
  eigener Referenzzeit (kein Maximaltest); Dauer bleibt das Ziel, Distanz nur Richtwert.
- **W-G7 Puls-Zonen.** Jetzt optional (manuell) oder erst mit Phase 8? – Puls ist Gesundheitsdatum, Formeln
  (220 − Alter) sind ungenau. – **Empfehlung:** erst Phase 8; Phase 10 nur Anstrengung, Sprechtest, Pace.
- **W-G8 Einheiten-Texte.** Feste Textbausteine im Code oder Batch-Inhalte über die Content-Pipeline? – Batch
  braucht Freigabe-Aufwand, Bausteine sind schneller prüfbar. – **Empfehlung:** ca. 20 feste Bausteine je
  Disziplin im Core, fachlich geprüft; Batch erst, wenn es viele Varianten braucht.
- **W-G9 Mehrere Wettkämpfe.** Einer oder mehrere gleichzeitig? – Mehrere Rennen brauchen Prioritäten (A/B/C) und
  machen die Planung komplizierter. – **Empfehlung:** ein Hauptwettkampf; Vorbereitungsrennen später.
- **W-G10 Gratis oder Premium.** KONZEPT 13 sagt: Wettkampfvorbereitung Premium, Aufzeichnung gratis. – Das
  bestimmt die spätere Server-Prüfung. – **Empfehlung:** gratis: Wettkampf anlegen, Countdown, Ampel, Ratgeber,
  Aufzeichnung, Favoriten, Karte, GPX; Premium: periodisierter Plan, Wettkampf-Ernährung im Essensplan,
  Strecken-Vorschläge. In der Testphase alles offen.
- **W-G11 Kartenanbieter.** Testphase und Livegang. – Laufende Kosten, Datenschutz (IP an Anbieter),
  Nutzungsbedingungen. – **Empfehlung:** Testphase OpenFreeMap (0 €, kein Konto); vor Livegang Protomaps-Datei
  auf Cloudflare R2 (EU) oder – wenn ihr keinen Einrichtungsaufwand wollt – MapTiler bezahlt.
- **W-G12 Strecken-Vorschläge (S2b).** Jetzt oder später? – Aufwendig (Datenaufbereitung, ODbL-Prüfung),
  Premium. – **Empfehlung:** später (nach 4b/mit Phase 7); Phase 10 liefert Aufzeichnung, Karte, GPX.
- **W-G13 Standort-Berechtigung.** „Beim Verwenden“ oder „Immer“? – „Immer“ löst strengere Store-Prüfungen aus
  (Google-Erklärung mit Video). – **Empfehlung:** „Beim Verwenden“ mit sichtbarer Aufzeichnung; „Immer“ nur, wenn
  der Spike S0 zeigt, dass es nicht anders geht.
- **W-G14 Aufzeichnen im Browser.** – Im Browser bricht die Aufzeichnung beim Sperren des Handys ab. –
  **Empfehlung:** im Web nicht anbieten (Hinweis „in der App“), dafür Demo-Aufzeichnung im Testmodus.
- **W-G15 Standort als Datenkategorie.** Eigene Einwilligung oder nicht? – Standortverläufe sind sehr persönlich,
  aber kein Art.-9-Gesundheitsdatum. – **Empfehlung:** keine Art.-9-Einwilligung; Erklär-Bildschirm,
  System-Berechtigung, DSFA-Ergänzung, Strecken bleiben beim Widerruf der Gesundheits-Einwilligung; juristisch
  bestätigen lassen.
- **W-G16 Zeitvergleich und Bestzeiten.** Wie sichtbar? – Motivation vs. Druck (keine Community, keine Serien). –
  **Empfehlung:** nur eigene Zeiten auf derselben Favoriten-Strecke, neutrale Texte, keine Abzeichen für Bestzeiten.

---

## 20. Was ihr selbst tun müsst

1. **Expo einrichten** (SETUP Teil D): Projekt auf expo.dev, Projekt-ID eintragen lassen, Secret `EXPO_TOKEN`.
   Ohne das gibt es keine APK und keine Aufzeichnung zum Testen.
2. **Apple Developer Program** (99 USD/Jahr) und App Store Connect für TestFlight (SETUP Teil D2); Google Play
   (25 USD einmalig), sobald ihr über den Play Store testen wollt.
3. **Kartenanbieter wählen (W-G11):** Testphase ohne Konto. Für den Livegang: Konto bei Cloudflare (R2, Region EU)
   bzw. MapTiler/Stadia anlegen und den Schlüssel selbst als **Vercel Environment Variable** und **Expo Secret**
   eintragen (Name kommt im PR, z. B. `EXPO_PUBLIC_MAP_STYLE_URL`) – nie im Chat schicken. AVV mit dem Anbieter
   abschließen.
4. **Store-Texte zur Standortberechtigung** freigeben (Entwurf kommt mit S0/S1): iOS-Begründungstext, Play
   Console → App-Inhalte → Standort bzw. Vordergrund-Dienst „Standort“ erklären; Datenschutz-Angaben in beiden
   Stores um „Standort (genau), nur für App-Funktion, nicht verknüpft mit Werbung“ ergänzen.
5. **Fachprüfung Training:** Sportwissenschaftlerin/Lauftrainer prüft Tabellen 3.2, 3.3, 3.5 und die
   Einheiten-Bausteine (vor Livegang).
6. **Fachprüfung Ernährung:** Ernährungsfachkraft prüft W1 (Carb-Loading 1–2 Tage, g/kg, Gel-/Trinkplan, Texte
   ohne Health Claims).
7. **Juristische Prüfung:** Datenschutzerklärung (Standort, Kartenanbieter), DSFA-Ergänzung, ODbL-Attribution;
   vor S2b ODbL-Share-Alike.
8. **Test-Läufe draußen:** mit der APK 2–3 echte Läufe/Radfahrten (Handy gesperrt, Funkloch, 60+ Minuten) und
   Rückmeldung im PR.
