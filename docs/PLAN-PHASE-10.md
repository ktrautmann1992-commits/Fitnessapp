# Plan Phase 10 – Ausdauer-Wettkampf & Strecken

**Status:** Freigegeben (16.10.2026). Gründer-Entscheidungen W-G1 bis W-G16 (Abschnitt 19): **alle wie empfohlen**
(ausgefülltes Entscheidungs-PDF vom 16.10.2026). Umsetzung je Etappe als Pull Request mit Wächter-Prüfung.
**Stand 16.10.2026:** WP1 (Core) als PR #83, WP2 (Core) als PR #84, WP3 (Datenmodell) als PR #86, WP4 (App: Wettkampf,
Plan-Ansicht, Countdown, Intervall-Timer) im Anschluss umgesetzt (Abschnitte 7 und 8). **18.10.2026:** W1
(Wettkampf-Ernährung) umgesetzt, keine Migration (Abschnitt 10, Umsetzungsstand W1). **18.10.2026:** WP5 (Rad und Triathlon
Sprint/Olympisch) umgesetzt, Migrationen `20261018120000`/`20261018120100` (Abschnitt 9, Umsetzungsstand WP5). A1a, A1b, E1, A2, E2, A3 (PLAN-AUSWERTUNG) sind gemergt; Expo-Projekt „AlphaFive“ wird verbunden
(PR #79). Damit können WP1/WP2 (Core) sofort starten, WP3/WP4 danach, S0 sobald die erste APK läuft.
**25.10.2026:** Nachtrag Live-Begleitung / Notfallkontakt (Abschnitt 21) – Regel und Plan, noch nicht umgesetzt.

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
  **Nachtrag Z6 (17.10.2026), umgesetzt sind Z1–Z5:** Ausdauer kann Haupt- **oder** Nebenziel sein (Ziel-Profil
  `goalProfile().enduranceRole`). Offen für Phase 10: (1) Wettkampfplan und `save_competition`/`cancel_competition`/
  `delete_competition` gleichen `goals.target_date` bisher nur beim **Hauptziel** Ausdauer ab – entscheiden, ob ein
  Wettkampf auch mit Ausdauer als Nebenziel möglich ist (Vorrang „Hauptziel zuerst“ in der Woche beachten). (2)
  **Wettkampfwoche ohne Defizit:** Bei „Ausdauer → Abnehmen“ (−10 %) und jeder Kombination mit Abnehmen gilt in der
  Wettkampfwoche (Tapering, Carb-Loading, Wettkampftag) Erhalt – ein konkretes Abnehmziel ruht dort, nie ein Aufholen
  danach. (3) Ein Abnehmziel ändert den Trainingsplan nie (keine Körperdaten im Plan).
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
- ~~WP3: Tabelle `competitions` mit den Grenzen aus `COMPETITION_INPUT_LIMITS` (db-sync), gespeichert werden müssen auch bestätigter eigener Startumfang, Tagebuch-Bezug beim Erstellen (mit `startGroup`) und `effectiveGoal` – sonst rechnet ein Folgeblock einen anderen Makrozyklus.~~ Umgesetzt, siehe Umsetzungsstand WP3.
- ~~WP4: App (Ampel, Phase je Woche, Countdown); bis dahin ruft niemand `generateCompetitionPlan` auf.~~ Umgesetzt, siehe
  Umsetzungsstand WP4.
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

- **G8 – Voreinstellung gilt (17.10.2026: Gründer-Auftrag „alle Etappen bauen“ ohne Gegenentscheidung; jederzeit änderbar, Fachprüfung offen) – Langer Lauf „Ankommen“:** Voreinstellung 40/50/70/120 min (5 km/10 km/Halbmarathon/Marathon) = höchstens 50 %
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

- ~~**WP3:** Spalten `workout_type`, `training_phase`, `target_distance_m`, `workout_steps` (Schema `workoutStepsSchema`),
  CHECK `effort_target` 1–8 mit „> 4 nur bei harter Art“, serverseitig unter 18 ≤ 7 und Zahl harter Einheiten je Woche
  (Einsteiger/vorsichtig 1, sonst 2) (Wächter N2), und „harte Art in Erholungswoche nur im Tapering“
  (`training_phase`), `longRunWeekday` am Wettkampf speichern; erst dann lässt sich ein Wettkampfplan mit harten Einheiten
  speichern (`toSavePlanPayload` überträgt die neuen Felder noch nicht). `db-sync.test.ts` schlägt dann absichtlich fehl
  → 4b-Regel `endurance_reduce` neu fassen (Vorschlag oben, PLAN-PHASE-4B).~~ Umgesetzt, siehe Umsetzungsstand WP3.
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

### Umsetzungsstand WP3 (16.10.2026)

**Was gilt (nur additiv; Pläne ohne Wettkampf speichern unverändert):**

- **Migrationen** (Zeitstempel ab 20261016140000, parallel zu N7 Teil 2 mit 20261016120000):
  `20261016140000_competition_enums.sql` (Enums), `20261016140100_competitions.sql` (Tabelle, Spalten, CHECKs),
  `20261016140200_competition_rpcs.sql` (Funktionen). Keine alte Migration umgeschrieben; Funktionen per
  `create or replace` mit gleicher Signatur, jeweils die neueste Fassung übernommen und nur erweitert.
- **Enums** (= `packages/core`, `db-sync.test.ts`): `competition_discipline` (5 km bis Marathon, W-G2),
  `competition_goal`, `competition_status` (`planned | done | cancelled`), `endurance_start_group`, `workout_type`,
  `training_phase`; `log_source` um `gps` und `gpx_import` erweitert (`add value`, erst ab S1/S2a benutzt).
- **Tabelle `competitions`:** Name (1–80, ohne Leerraum am Rand), Disziplin, `distance_m` (aus der Disziplin, CHECK),
  Renntag, Ziel, Zielzeit (nur bei `time`, plausibel je Distanz, nur mit Referenzzeit), Referenz (ganz oder gar nicht,
  plausibel, vor dem Renntag), Wunsch-Tag des langen Laufs (`long_run_weekday`, WP2), Stand, Ergebnis
  (`result_session_log_id`, eigener Tagebuch-Eintrag, `on delete set null` nur für die Spalte) und der **Plan-Bezug**
  für Folgeblöcke (WP1 „Offen“): bestätigter eigener Startumfang so wie eingegeben (10–1.680 min, Core deckelt),
  Tagebuch-Bezug beim Erstellen mit Startgruppe (`start_reference_volume/_session_cap/_start_group`, Grenzen wie
  `competitionStartReferenceSchema`) und `effective_goal`. Höchstens **ein** geplanter Wettkampf je Person (Teil-Index,
  W-G9). Kaskade beim Konto löschen.
- **RLS/Rechte:** nur eigene Zeilen lesen (`authenticated` nur SELECT), `anon` nichts, Schreiben nur über die Funktionen;
  kein Partner-Zugriff.
- **Gesundheitsbezug (geprüft nach Plan 7/13 und KONZEPT):** Der Wettkampf selbst ist kein Gesundheitsdatum – Anlegen
  (Countdown) geht ohne Einwilligung. Der Plan-Bezug ist aus dem Gesundheits-Check abgeleitet (vorsichtige Startgruppe,
  „nur Ankommen“ bei Flag/Alter) und gehört zu einem Wettkampfplan, der den Check voraussetzt (3.3). Deshalb wie
  `user_plans.uses_health_data`: nur mit gültiger Einwilligung **und** Check (`private.plan_health_basis`, Einwilligung
  **FOR SHARE** vor der Wettkampf-Zeile – gleiche Sperr-Reihenfolge wie der Widerruf), `uses_health_data` setzt der
  Server (CHECK: genau dann, wenn ein Plan-Bezug gespeichert ist). **Widerruf** (`private.consents_after_revoke`):
  Plan-Bezug geleert (am Anfang und in der Wiederholung am Ende), Wettkampf und Wunsch-Tag bleiben (wie Strecken, W-G15);
  die Wettkampf-Pläne selbst (`user_plans.uses_health_data`) werden wie bisher gelöscht.
- **Funktionen** (`security definer`, `search_path = ''`, nur `authenticated`, Fehler als feste Texte ohne Werte):
  - `save_competition(p_competition)` – Eingabe = `saveCompetitionPayloadSchema` (alle 15 Felder Pflicht, unbekannte
    abgelehnt); `id` null = anlegen, sonst eigenen **geplanten** Wettkampf als Ganzes ändern. Datumsregeln gegen „heute“
    (Europe/Berlin) nur beim Anlegen bzw. wenn sich Renntag/Disziplin oder Referenz ändern: Renntag nach heute bis
    heute + 52 Wochen, Mindestvorlauf der **lockersten** Spalte (Leistungssport 4/6/10/14 Wochen – die genaue Spalte
    prüft Core), Referenzzeit nicht in der Zukunft und höchstens 183 Tage alt. Mit Plan-Bezug zusätzlich: Check +
    Einwilligung, nicht in der Schwangerschaft, unter 18 kein Marathon, wirksame Zielzeit nicht mit Arzt-Hinweis, unter
    18 oder ab 65 (Tabelle 3.3). `goals.target_date` des Ausdauer-Ziels wird mitgeführt.
  - `cancel_competition(p_id)` (nur geplante; Zieldatum wird geleert, wenn es der Renntag war),
    `complete_competition(p_id, p_session_log_id)` (ab dem Renntag, optional eigener Ausdauer-Eintrag **vom Renntag**;
    erneut aufrufbar, abgesagte nicht), `delete_competition(p_id)` (Recht auf Löschung, jeder Stand).
- **`planned_sessions`:** neue Spalten `workout_type`, `training_phase`, `target_distance_m` (100–60.000 m),
  `workout_steps jsonb` (alle nullable). CHECK `effort_target` von 1–4 auf **1–8 gelockert** (alte Zeilen gültig) und
  neue Bedingung `planned_sessions_workout_fields`: ohne Art wie bisher höchstens 4; mit Art nur Ausdauer, Art + Phase +
  Schritte zusammen, über 4 nur bei harter Art, harte Art in einer Erholungswoche nur im Tapering, Schritte über
  `private.workout_steps_valid` (= `workoutStepsSchema` strikt: 1–40, genau 4 Schlüssel, 10 s–4 h, Anstrengung 0–10
  ganzzahlig, Summe = Dauer, höchstens 4.096 Bytes; nie ein Fehler, nur wahr/falsch; EXECUTE auch für `authenticated`,
  weil der CHECK beim Verschieben neu geprüft wird).
- **`private.insert_plan_sessions`** (von `save_training_plan` und `append_plan_block` aufgerufen, beide unverändert)
  nimmt die neuen Felder an und prüft je Person, was kein CHECK sieht (Wächter N2 zu WP2): Einheiten mit Art nur in
  Plänen mit Gesundheits-Check, nie in der Schwangerschaft, unter 18 kein Marathon; Anstrengung (Ziel und jeder
  Schritt) höchstens 8, **unter 18 höchstens 7, ab 65 höchstens 6**; mit Arzt-Hinweis keine harte Art und kein
  Abschnitt ab 6; **harte Einheiten je Kalenderwoche** des Plans (ohne gestrichene): Einsteiger und vorsichtige
  Startgruppe (Flag, unter 18, ab 65) 1, sonst 2.
- **Export:** `export_my_data()` enthält `competitions` (mit Plan-Bezug); die neuen `planned_sessions`-Spalten kommen
  über `to_jsonb` automatisch mit. `DATA_EXPORT_TABLES` und der App-Export (Testmodus) sind ergänzt.
- **Core:** `plan/competition-record.ts` – `CompetitionRow`, `saveCompetitionPayloadSchema`, `toSaveCompetitionPayload`
  (aus Wettkampf + Wunsch-Tag + Plan-Bezug), `storedCompetitionFromRow` (Zeile → Engine-Eingaben für Folgeblock/Ampel;
  unlesbar → null), `COMPETITION_PLAN_BASIS_COLUMNS`, `competitionDistanceM`. `savePlanSessionSchema` nimmt die neuen
  Felder optional an (gleiche Regeln wie der CHECK), `toSavePlanSession` überträgt sie **nur**, wenn die Engine sie
  gesetzt hat (Pläne ohne Wettkampf: genau die bisherigen Schlüssel – Test). `PlannedSessionRow` hat die vier Spalten;
  `storedSessionFromRows` gibt sie nur bei gesetzter Art und Phase weiter (sonst keine Schlüssel, Einheit
  byte-gleich). Konstanten `COMPETITION_RECORD_LIMITS`, `ENDURANCE_START_GROUPS`, `COMPETITION_STATUSES`,
  `LOG_SOURCES` + `gps`/`gpx_import`. `database.types.ts` von Hand nachgezogen (Tabelle, Spalten, Enums, Funktionen).
- **App (nur weil die Typprüfung es erzwingt, keine UI):** `UserRows.competitions` (immer leer bis WP4), Export im
  Testmodus, `write-ops` speichert die neuen Spalten im Testmodus mit, Zeilen-Typ-Abgleich `CompetitionRow`.
- **4b-Regel `endurance_reduce` neu gefasst** (PLAN-PHASE-4B R3): Schwelle mit Abstand zum Ziel
  (`enduranceOverloadThreshold`: locker 7 wie bisher, hart Ziel + 2 bis 9). Der bisher nur angekündigte Test in
  `db-sync.test.ts` prüft jetzt für **jedes** nach der letzten CHECK-Fassung erlaubte Ziel (1–8), dass die Schwelle
  darüber liegt – steigt der CHECK erneut, schlägt er fehl.

**Tests:**

- pgTAP neu `34_competition_sessions.test.sql` (56) und `35_competitions.test.sql` (82); nach dem Merge von N7 Teil 2
  (pgTAP 33) und den Wächter-Auflagen (`36_competition_waechter.test.sql`, 26) alle **34 Dateien grün, 1.734 Tests**
  (lokales Harness Postgres 16 mit Supabase-Shim; vor WP3 1.514, nach N7 Teil 2 + WP3 ohne Auflagen 1.708).
- **Kreuzprobe Plan = Datenbank (Harness):** 124 Wettkampfpläne der Engine (4 Distanzen × 3 Level × 2–3 Renntage × 3
  Zeitpläne, 36 und 17 Jahre, mit und ohne Flag) samt **794 Folgeblöcken** über `save_training_plan` und
  `append_plan_block` gespeichert – alle angenommen (13.620 Wettkampf-Einheiten, davon 254 harte, Anstrengung bis 8).
- Core: neu `competition-record.test.ts` (63, u. a. Eigenschaft „jeder Wettkampfplan passt durch die Eingabe-Prüfung und
  die Regeln je Person“ über 25 ganze Pläne mit harten Einheiten), `db-sync.test.ts` (+33: Enums, alle neuen Grenzen,
  `competition_keys`, Schritte, Regeln je Person, Mindestvorlauf, Widerruf-Spalten, Sperr-Reihenfolge, 4b),
  `rows.test.ts` (+3). Core gesamt 4.188 → 4.287 Tests; `pnpm turbo run lint typecheck test --force` grün (18/18),
  `pnpm format:check` grün.

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt; Vergleich mit `git status`: unverändert):**

| Nr. | Gebrochene Regel                                     | Rote Tests                                     |
| --- | ---------------------------------------------------- | ---------------------------------------------- |
| G1  | Anstrengung über 4 ohne harte Art                    | 2 (pgTAP 34)                                   |
| G2  | Harte Art in jeder Erholungswoche                    | 1 (34)                                         |
| G3  | Schritte ohne Summen-Prüfung                         | 1 (34)                                         |
| G4  | Wettkampfplan ohne Gesundheits-Check                 | 1 (34)                                         |
| G5  | Unter 18 bis Anstrengung 8                           | 2 (34)                                         |
| G6  | Ab 65 bis Anstrengung 8                              | 1 (34)                                         |
| G7  | Arzt-Hinweis mit harten Einheiten/Abschnitten        | 2 (34)                                         |
| G8  | Einsteiger 2 harte Einheiten je Woche                | 1 (34)                                         |
| G9  | Schwangerschaft: Wettkampfplan erlaubt               | 1 (34)                                         |
| G10 | Unter 18: Marathon-Plan erlaubt                      | 1 (34)                                         |
| G11 | Plan-Bezug ohne Gesundheits-Check                    | 3 (35)                                         |
| G12 | Mehrere geplante Wettkämpfe (Index nicht eindeutig)  | 9 (35)                                         |
| G13 | Ohne Mindestvorlauf                                  | 3 (35)                                         |
| G14 | Referenzzeit beliebig alt                            | 1 (35)                                         |
| G15 | Widerruf lässt den Plan-Bezug stehen (beide Stellen) | 1 (35)                                         |
| G16 | RLS: alle Zeilen lesbar                              | 4 (35)                                         |
| G17 | Export ohne Wettkämpfe                               | 4 (pgTAP 17 und 35)                            |
| G18 | Wirksame Zielzeit ab 65/Flag/unter 18                | 4 (35)                                         |
| G19 | Ergebnis mit beliebigem Eintrag                      | 8 (35)                                         |
| G20 | Fremden Wettkampf ändern                             | 2 (35)                                         |
| G21 | `authenticated` darf direkt schreiben                | 1 (35)                                         |
| G22 | Schritt-Prüfung ohne EXECUTE für `authenticated`     | 15 (pgTAP 12, 17, 18, 29 – Verschieben bricht) |
| C1  | SQL: unter 18 Deckel 8 (nur Migration)               | 1 (`db-sync`)                                  |
| C2  | Core-Eingabe: über 4 ohne harte Art                  | 1 (`competition-record`)                       |
| C3  | `DATA_EXPORT_TABLES` ohne `competitions`             | 1 (`db-sync`)                                  |
| C4  | Zeilen immer mit Wettkampf-Feldern                   | 2 (`rows`)                                     |
| C5  | Name bis 100 nur im Core                             | 2 (`db-sync`, `competition-record`)            |
| C6  | Widerruf leert eine Spalte weniger                   | 1 (`db-sync`)                                  |
| C7  | Server-Mindestvorlauf Marathon 10 statt 14           | 1 (`db-sync`)                                  |
| C8  | Schritte bis 50 im SQL                               | 1 (`db-sync`)                                  |

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Plan-Bezug = Gesundheitsbezug** (siehe oben) statt „kein Gesundheitsdatum“ für die ganze Zeile – der Wettkampf
   bleibt einwilligungsfrei, nur die abgeleiteten Felder brauchen Einwilligung und Check (Gründer-Frage G13).
2. **Server-Mindestvorlauf = lockerste Spalte** (Leistungssport). Die genaue Spalte (Level, vorsichtige Startgruppe)
   kennt nur Core; ein Wettkampf ohne Plan (Countdown) darf so z. B. für Einsteiger mit 6 Wochen bis zum 10-km-Lauf
   gespeichert werden – einen Plan dafür gibt die Ampel nicht (Gründer-Frage G14).
3. **Ändern ersetzt den ganzen Datensatz**, auch den Plan-Bezug (fehlt er, ist er leer). WP4 muss beim Ändern ohne neuen
   Plan den gespeicherten Bezug mitschicken (`storedCompetitionFromRow` → `toSaveCompetitionPayload`).
4. **Neue Funktionen `complete_competition` und `delete_competition`** (im Plan nur `save`/`cancel`): ohne sie gäbe es
   keinen Weg zu `done`/Ergebnis und kein Einzel-Löschen (Recht auf Löschung).
5. **Ergebnis-Eintrag** muss ein eigener Ausdauer-Eintrag **vom Renntag** sein; wird er gelöscht, bleibt der Wettkampf
   erledigt (Verweis leer).
6. **Zahl harter Einheiten je Kalenderwoche über den ganzen Plan** (auch über Blockgrenzen), Level = das strengere aus
   Profil und Angaben des Plans (Wächter M1), Alter heute (Europe/Berlin) – der Server ist eine Obergrenze; Core plant
   ohnehin strenger (Wochenbau WP2).
7. **Steigerungen** (keine harte Art, Ziel ≤ 4, höchstens 6 Abschnitte à 20 s bis 7) bleiben erlaubt; mit Arzt-Hinweis
   lehnt der Server Abschnitte ab Anstrengung 6 ab (Core stuft sie dort ohnehin auf locker).
8. **`log_source` `gps`/`gpx_import`**: `save_session_log` nimmt jeden Enum-Wert an; die App sendet bis S1 nur `manual`.
   Ob S1 die Herkunft serverseitig an eine Strecke bindet, entscheidet S1.
9. **Testmodus (`localDb.competitions`, `local-rules.ts`)**: nicht in WP3 (keine App-UI) – Core liefert dafür
   `saveCompetitionPayloadSchema`/`storedCompetitionFromRow`; die lokalen Regeln (Datumsfenster, ein geplanter
   Wettkampf, Plan-Bezug nur mit Check) kommen mit WP4. Die lokalen Plan-Regeln (Regeln je Person für Wettkampf-Einheiten)
   ebenfalls mit WP4.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet; G8–G12 aus WP2 weiter offen):**

- **G13 – Wettkampf und Einwilligung:** Voreinstellung: Wettkampf (Name, Datum, Ziel, Referenzzeit) ohne Einwilligung;
  der Plan-Bezug (wirksames Ziel, Startumfang, Tagebuch-Bezug) nur mit Einwilligung und Check, beim Widerruf geleert.
  Alternative: den ganzen Wettkampf wie Gesundheitsdaten behandeln (beim Widerruf löschen) – strenger, aber der
  Countdown wäre dann an die Einwilligung gebunden. Juristisch mit W-G15 bestätigen lassen.
- **G14 – Mindestvorlauf beim Speichern ohne Plan:** Voreinstellung: Server prüft die lockerste Spalte; ein Wettkampf
  „nur Countdown“ ist damit auch speicherbar, wenn die Ampel für die Person „zu kurz“ sagt. Alternative: Speichern nur,
  wenn die Ampel mindestens „knapp“ sagt (dann braucht es den Check auch für den Countdown).

**Nach der Wächter-Prüfung (16.10.2026, `waechter-wp3.md`, Freigabe mit Auflage H1) umgesetzt:**

- **H1 – Schritte passen zur Art:** neue Prüfung `private.workout_steps_fit_type` im CHECK: lockere Arten (easy, long,
  recovery) nur mit Abschnitten bis Anstrengung 4 (`ENDURANCE_EFFORT.easyMax`), Steigerungen nur mit
  Belastungs-Abschnitten (`work`) von höchstens 20 s, höchstens 6 Stück (`COMPETITION_WORKOUTS.strides`). Zusätzlich
  robust `private.workout_is_hard`: jede Einheit mit einem Abschnitt ab 6, der länger als 20 s dauert, zählt als hart –
  für die Wochenzahl und für „Erholungswoche nur im Tapering“. Gleiche Regeln in Core (`stepsFitWorkoutType`,
  `isHardSession` in `intensity.ts`; `savePlanSessionSchema` und `generatedCompetitionSessionSchema`), db-sync-Abgleich.
- **M1:** Level für die Wochenzahl = das strengere aus `profiles.experience_level` und den Angaben des Plans (Gleichheit zu
  verlangen wäre strenger als die Engine, die nur die Angaben kennt).
- **M2:** Einheiten mit Art nur, wenn die Person einen eigenen **geplanten** Wettkampf **mit Plan-Bezug** hat (Zeile
  `for share` nach der Einwilligungs-Sperre – Reihenfolge Einwilligung → Wettkampf wie beim Widerruf). Disziplin für
  „unter 18 kein Marathon“ aus dem Wettkampf; Disziplin des Plans muss gleich sein; keine Einheit über dem Distanz-Deckel
  des langen Laufs (`COMPETITION_LONG_RUN.maxMinutes`: 75/90/120/180 min).
- **N3:** Zahlen oben korrigiert. **N4:** Leerraum am Rand des Namens jetzt genau die Zeichen von
  `String.prototype.trim()` (`COMPETITION_NAME_TRIM_CLASS`, locale-unabhängig; db-sync prüft alle Zeichen bis U+FFFF).
- Angriffstests des Wächters (98/99) als `36_competition_waechter.test.sql` übernommen (26 Fälle, erwarten jetzt die
  Ablehnung). Core: `competition-record.test.ts` +3, `db-sync.test.ts` +3.
- **Kreuzprobe wiederholt (mit Wettkampf-Zeile und Profil-Level je Person):** 241 Wettkampfpläne (4 Distanzen × 3 Level ×
  2–3 Renntage × 4 Zeitpläne × 36/17/71 Jahre, mit und ohne Flag) samt 1.620 Folgeblöcken – alle angenommen (26.904
  Wettkampf-Einheiten, 469 harte, Anstrengung bis 8).

| Nr. | Gegenprobe zu den Auflagen                                              | Rote Tests               |
| --- | ----------------------------------------------------------------------- | ------------------------ |
| A1  | Lockere Arten ohne Schritt-Grenze (H1)                                  | 3 (pgTAP 36)             |
| A2  | Steigerungen beliebig lang (H1)                                         | 1 (36)                   |
| A3  | Steigerungen beliebig viele (H1)                                        | 1 (36)                   |
| A4  | Erholungswoche ohne Schritt-Erkennung, zusammen mit A1                  | 4 (36, u. a. W7)         |
| A5  | Wochenzahl nur nach Art, zusammen mit A1                                | 3 (36)                   |
| A6  | Level nur aus den Angaben (M1)                                          | 1 (36)                   |
| A7  | Ohne geplanten Wettkampf mit Plan-Bezug (M2)                            | 3 (36)                   |
| A8  | Disziplin nicht abgeglichen (M2)                                        | 1 (36)                   |
| A9  | Ohne Distanz-Deckel (M2)                                                | 1 (36)                   |
| A10 | Name nur mit ASCII-Leerzeichen geprüft (N4)                             | 2 (36)                   |
| A11 | Core: Steigerungen ohne Zahl-Grenze                                     | 1 (`competition-record`) |
| A12 | SQL: Steigerungen 30 s / Halbmarathon-Deckel 150 / Klasse ohne BOM (je) | je 1 (`db-sync`)         |

A4/A5 allein (ohne A1) bleiben grün: Die Art-Prüfung (H1) fängt dieselben Angriffe schon vorher ab – die robuste
Erkennung ist eine zweite Sicherung.

**Offen (Wächter N1/N2, für WP4 bzw. Fachprüfung):**

- **N1:** Die Wochenzahl harter Einheiten gilt je Plan. Wird ein Plan mitten in der Woche neu erstellt, zählen harte
  Einheiten des ersetzten Plans in dieser Woche nicht mit (gleiches Muster wie andere Regeln). WP4 („Plan neu
  erstellen“) beachten, z. B. Woche 0 ohne harte Einheit.
- **N2:** Ohne Server-Gegenstück bleiben die 80/20-Regel (`hardShareMax`), „ab 65 nur Gehen“ (G7) und „Einsteiger erst
  ab 3 Ausdauer-Einheiten“ – sie prüft nur Core (Wochenbau). Offene Server-Lücke, bewusst nicht in WP3.

**Offen für WP4:**

- **Wettkampf-Einheiten speichert der Server nur mit eigenem geplanten Wettkampf samt Plan-Bezug** (M2) – Reihenfolge
  zwingend `save_competition` (mit Plan-Bezug) → `save_training_plan`; dieselbe Disziplin in Wettkampf und Plan.
- App: Wettkampf anlegen/ändern/absagen/abschließen/löschen über die neuen Funktionen (Fehlertexte für alle Meldungen
  oben), Plan-Bezug beim Erstellen des Wettkampfplans speichern (`toSaveCompetitionPayload` mit
  `feasibility.effectiveGoal`, eigenem Startumfang und `competitionStartReference`), Folgeblöcke aus
  `storedCompetitionFromRow` + `competitionFollowUpBlock`. Reihenfolge beim Erstellen: erst `save_competition`, dann
  `save_training_plan` (zwei Aufrufe – schlägt der zweite fehl, bleibt der Wettkampf mit Plan-Bezug ohne Plan stehen;
  harmlos, beim nächsten Versuch wird er überschrieben).
- Testmodus: `localDb.competitions` mit denselben Regeln (`local-rules.ts`), Export, „Testdaten löschen“; lokale Regeln je
  Person für Wettkampf-Einheiten (wie `insert_plan_sessions`).
- `prepareSessionForDisplay` → `applyCurrentEnduranceRules`/`applyCompetitionWeekLimits` mit den gespeicherten Feldern
  (kommen jetzt über `storedSessionFromRows`); Anzeige von Art, Schritten, Pace, Distanz-Richtwert; Intervall-Timer.
- Supabase-Modus: `competitions` lesen (`UserRows.competitions` ist bis dahin leer).
- G8 (langer Lauf „Ankommen“) vor WP4 entscheiden (WP2, Wächter M4).

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

### Umsetzungsstand WP4 (16.10.2026)

**Was gilt (Gründer-Entscheidungen W-G1 bis W-G16 und G1–G7 wie empfohlen; G8–G14 weiter offen – es gelten die
sicheren Voreinstellungen der Core- und Datenbank-Konstanten, WP4 ändert daran nichts):**

- **„Mein Wettkampf“** (`apps/mobile/src/app/(tabs)/wettkampf.tsx` – seit 20.10.2026 ein wählbarer Reiter, siehe
  `docs/PLAN-DASHBOARD.md` 9; erreichbar über Einstellungen → „Mein Wettkampf“, die
  Countdown-Karte auf „Heute“/im Kalender und die Einladung auf „Heute“): Formular mit Distanz (5 km bis Halbmarathon/
  Marathon, W-G2), Renntag, Name (optional, sonst die Distanz), Ziel „Ankommen“/„Zielzeit“ (Zielzeit nur mit
  Referenzzeit), Referenzzeit (Distanz, Zeit, Datum, mit Erklärung), Wunsch-Tag des langen Laufs (automatisch oder
  Mo–So) und – nur Fortgeschritten/Leistungssport – bisheriger Umfang mit Bestätigung (W-G5). Zustände: Laden, kein
  Wettkampf (Einladung), geplant (Countdown, Übersicht, „Ändern“, „Wettkampf absagen“), Renntag/vorbei ohne Ergebnis
  („Ergebnis eintragen“), erledigt (Erholung, „Nächstes Ziel planen“), frühere Wettkämpfe (abgesagt/erledigt, einzeln
  löschbar – Recht auf Löschung), offline (Anlegen/Ändern gesperrt mit Hinweis; Plan und Timer gehen offline), Fehler
  vom Server mit festem Text je Grund.
- **Ampel sofort beim Datum** (`FeasibilityCard`): `draftFeasibility` → `competitionFeasibility` mit demselben
  Tagebuch-Bezug wie beim Erstellen. Jede Stufe mit Zeichen **und** Wort („✓ Passt“, „! Knapp“, „✕ Zu kurz“,
  „✕ Nicht möglich“), Erklärtext, alle Gründe und Hinweise als Text (u. a. `walk_only_plan`,
  `reference_distance_too_far`, `long_run_day_not_endurance`, `start_reference_capped`, `long_run_not_reachable`,
  `long_run_day_too_short`), Zahlen (Vorlauf, Spitzenumfang, längster Lauf, Ziel im Plan) und Vorschläge; „Späterer
  Renntag“, „Kürzere Distanz“, „Gesundheits-Check“ und „Ohne Wettkampfplan weiter“ lassen sich übernehmen.
  „Wettkampfplan erstellen“ gibt es nur bei „Passt“/„Knapp“ – der Plan wird nie gestaucht.
- **Wettkampfplan erstellen** (`createCompetitionPlan` in `state/app-state.tsx`, Glue `data/competition.ts`):
  `generateCompetitionPlan` mit Tagebuch-Bezug (`recentCompetitionStartReference`: nur Einheiten der letzten 28 Tage vor
  heute, je Einheit min(geplant, eingetragen), Startgruppe über `planStartGroup`), dann **zwingend** in dieser
  Reihenfolge: ggf. Ziel-Distanz anpassen (mit Hinweis), `save_competition` **mit Plan-Bezug** (wirksames Ziel aus der
  Ampel, eigener Startumfang so wie eingegeben, Tagebuch-Bezug mit Startgruppe), `save_training_plan` (Wächter WP3 M2).
  Zod an der Grenze (`generatedCompetitionPlanSchema`, `saveCompetitionPayloadSchema`). Ersetzt den aktiven Plan nur nach
  Bestätigung. „Nur Countdown speichern“ speichert den Wettkampf ohne Plan-Bezug (kein Gesundheitsdatum, geht auch ohne
  Einwilligung); wird nur Name bzw. Wunsch-Tag geändert, schickt die App den gespeicherten Plan-Bezug unverändert mit
  (`resavePayload`, WP3 Präzisierung 3).
- **„Plan neu erstellen“** (bestehender Weg auf „Heute“/in den Einstellungen): Gibt es einen geplanten Wettkampf mit
  Plan-Bezug und passender Ziel-Distanz, wird wieder ein Wettkampfplan erstellt (Ampel neu gerechnet, Wettkampf mit
  frischem Bezug gespeichert); ist die Ampel dann rot, entsteht ein Grundlagen-Plan mit Hinweis („ohne Wettkampfplan,
  weil die Ampel gerade nicht passt“).
- **Folgeblöcke** (`competitionFollowUpFromRows`): Makrozyklus aus dem gespeicherten Wettkampf
  (`storedCompetitionFromRow` → `competitionFollowUpBlock`), Schedule/Level aus dem Schnappschuss des Plans, Gesundheit und
  Alter nach heute, dann `nextPlanBlock(competitionWeeks)`. Endet der Zyklus (`cycle_finished`), gilt eine Regel aus
  Tabelle 3.3 neu (`not_available`) oder fehlt der geplante Wettkampf mit Plan-Bezug (abgesagt, erledigt, Widerruf),
  hängt die App **keinen** Grundlagen-Block von der Spitze aus an, sondern meldet „Dein Wettkampfplan ist zu Ende – Plan
  neu erstellen“ (sichere Voreinstellung zu WP1 M4, Gründer-Frage G16).
- **Supabase-Modus:** `competitions` wird mitgeladen (vor `db-migrate` leer), `save/cancel/complete/delete_competition`
  per RPC – immer sofort, nie Warteschlange; Netz → „Dafür brauchst du kurz Verbindung“, Server-Meldungen → fester Grund
  (`toCompetitionError`). Im normalen Offline-Zwischenspeicher steht der Wettkampf **ohne** Plan-Bezug (`withoutPlanBasis`
  in `cacheableRows`) – Countdown offline, Gesundheitsbezug nie unverschlüsselt.
- **Testmodus:** `localDb.competitions` mit denselben Regeln wie der Server, als reine Core-Funktionen
  (`packages/core/src/plan/competition-rules.ts`: `checkSaveCompetition` – Datumsfenster, Server-Mindestvorlauf der
  lockersten Spalte, Referenz 183 Tage, ein geplanter Wettkampf, Plan-Bezug nur mit Einwilligung und Check,
  Tabelle 3.3; `checkCancelCompetition`, `checkCompleteCompetition`; `checkCompetitionSessions` = Regeln je Person aus
  `insert_plan_sessions`: Check, Schwangerschaft, eigener geplanter Wettkampf mit Plan-Bezug, gleiche Disziplin,
  Distanz-Deckel, Anstrengung 8/unter 18 7/ab 65 6, Arzt-Hinweis, harte Einheiten je Kalenderwoche über den ganzen Plan).
  `local-rules.ts` prüft Wettkampf-Einheiten jetzt mit `generatedCompetitionSessionSchema` (vorher hätte der Testmodus
  jede Einheit über Anstrengung 4 abgelehnt). Widerruf leert den Plan-Bezug (wie `consents_after_revoke`), Löschen eines
  Tagebuch-Eintrags leert nur den Ergebnis-Verweis, „Testdaten löschen“ und Export wie bisher (WP3).
- **Anzeige der Einheiten** (`SessionCard`, `lib/competition-format.ts`): Art mit Wort (bei harten Arten „(hart)“),
  Pace-Spanne nur mit Referenzzeit und nur beim Laufen (`sessionPaceInfo`), **immer** mit `PACE_NOTICE_DE`,
  Distanz-Richtwert („etwa 12,5 km – die Dauer ist dein Ziel“), Sprechtest wie bisher, Ablauf der Schritte
  („6 × 3 min zügig (Anstrengung 8), dazwischen 2 min locker“, `intervalBlocks`). Vor jeder Anzeige
  `prepareSessionForDisplay` mit den gespeicherten Feldern und neu `competitionWeek` → `applyCompetitionWeekLimits`
  zusätzlich zu `applyCurrentEnduranceRules` (Level = das strengere aus Profil und Plan, wie der Server).
- **Phasen-Band** auf „Heute“ (`competitionPlanWeek`): „Aufbau · Woche 6 von 14“, angebrochene Startwoche als
  „Einstiegswoche“, danach „Erholung nach dem Rennen“, mit Satz zur Phase (Rennwoche: „Nichts Neues ausprobieren“).
- **Countdown** (`competitionCountdown`) auf „Heute“ und im Kalender („Noch 23 Tage bis zum Halbmarathon“, Rennwoche mit
  Hinweis, Renntag, „Wie lief es?“, Erholung). Im Kalender ist der Renntag mit „◆ Renntag: Halbmarathon“ markiert (Wort,
  nie nur Farbe); man kann bis zur Rennwoche blättern. Steht im Ziel ein Datum (Onboarding) ohne Wettkampf, lädt „Heute“
  mit vorbelegtem Datum zum Eintragen ein.
- **Intervall-Timer** im Trainingsmodus (`IntervalTimer`, Core `interval-timer.ts`): aus den Schritten der angezeigten
  Einheit (aktuelle Regeln angewendet, ohne Bibliothek – also offline), Zeitstempel statt Zähler (Pause, Neuzeichnen,
  Bildschirmsperre verfälschen nichts), Schritt X von N, große Restzeit, Sprechtest, „Teil 2 von 6“, „Teile geschafft“,
  „Danach: …“, Pause/Weiter, „Abbrechen und eintragen“ (mit Bestätigung; gelaufene Zeit gerundet, mindestens 1 min, als
  Dauer in den Entwurf – gespeichert wird wie bisher mit „Training speichern“). Schrittwechsel: Ansage über eine
  dauerhafte Live-Region (`accessibilityLiveRegion`/`aria-live`), in der App zusätzlich Vibration (`expo-haptics`) und
  `announceForAccessibility` (`lib/step-alert.native.ts`), im Browser still (`lib/step-alert.ts`). Bildschirm bleibt an
  über die bestehende Einstellung (`expo-keep-awake` war schon Abhängigkeit – kein neuer Native-Build nötig).
- **Ergebnis eintragen** (ab dem Renntag): Zeit (h/min/s), Gefühl (Anstrengung 0–10), Notiz → freie Ausdauer-Einheit
  vom Renntag (A1b, `createFreeDraft`, Distanz der Disziplin) → `complete_competition` mit Verweis. Ohne Ergebnis
  abschließen geht immer; liegt der Renntag mehr als 14 Tage zurück, nur das (Fenster A1b). Offline bzw. Eintrag noch in
  der Warteschlange: Hinweis, später „Eintrag vom Renntag als Ergebnis übernehmen“.
- **Absagen:** mit Bestätigung; war der Plan ein Wettkampfplan, fragt die App danach „Plan ohne Wettkampf neu
  erstellen?“ (bis 4b ohne Automatik). Datum/Distanz ändern bei aktivem Wettkampfplan: „Speichern und Plan neu
  erstellen“ (mit Bestätigung) oder nur Countdown speichern.
- **Onboarding:** Das Datumsfeld im Schritt „Ziel“ heißt jetzt „Wettkampf-Datum (optional)“ mit Hinweis auf „Mein
  Wettkampf“ (Präzisierung 1). Texte der Plan-Hinweise `endurance_basic_only`/`goal_endurance_not_yet` verweisen auf
  „Mein Wettkampf“ statt „kommt später“.
- **Keine Migration** (WP3 reicht), keine neue Abhängigkeit, nichts an Ernährung oder `apps/web`.

**Tests:**

- Core (Vitest): neu `competition-view.test.ts` (18: Countdown inkl. Rennen am Montag, Erholung je Distanz,
  `competitionToShow`, Phasen-Band mit/ohne Woche 0, Pace nur mit Referenz und nur beim Laufen, Tagebuch-Bezug nur
  Vergangenes/28 Tage), `interval-timer.test.ts` (13: Pause/Weiter, Uhr springt zurück, Schrittgrenzen, „Teile
  geschafft“, Ende, ein Schritt, Minuten zum Eintragen, Übersicht aus echten Bausteinen), `competition-rules.test.ts`
  (17: Server-Mindestvorlauf ±1 Tag, 52 Wochen, Referenz 183 Tage, Plan-Bezug/Einwilligung, Tabelle 3.3, ein geplanter
  Wettkampf, Ändern ohne neues Datum, Absagen/Abschließen, Regeln je Person am ganzen Plan der Engine und Angriffe),
  `view-competition.test.ts` (3: Wochenzahl harter Einheiten beim Anzeigen).
- App (Vitest): `data/competition.test.ts` (14, u. a. Reihenfolge save_competition → save_training_plan im Testmodus,
  Countdown reicht nicht für einen Wettkampfplan, zweiter Wettkampf abgelehnt, Folgeblock aus dem gespeicherten
  Wettkampf wird angenommen, nach Absage „Plan neu erstellen“), `data/competition-rows.test.ts` (4),
  `data/competition-errors.test.ts` (15, Server-Meldungen → Grund), `lib/competition-format.test.ts` (9).
- Playwright im Testmodus (`e2e/competition.spec.ts`, 3 Tests): Wettkampf anlegen → rot („✕ Zu kurz“, Grund,
  Vorschläge, kein „erstellen“) → Vorschlag übernehmen → grün → Zielzeit ohne passende Referenz → gelb („! Knapp“, Ziel
  im Plan „Ankommen“) → grün → Plan erstellen (Bestätigung) → „Heute“ mit Phasen-Band, Countdown, Art, Pace, Hinweis,
  Distanz-Richtwert, Ablauf → Trainingsmodus: Timer starten, Schrittwechsel mit Ansage, Pause (Zeit steht), Weiter,
  „Abbrechen und eintragen“ (7 Minuten im Entwurf), speichern → Kalender mit Countdown und markiertem Renntag → Renntag:
  Ergebnis (1:58:20, Anstrengung 7, Notiz) als freie Einheit mit Verweis → Erholung → neuer Wettkampf nur als
  Countdown → absagen (Angebot „Plan ohne Wettkampf neu erstellen“) → löschen. Zweiter Test: ohne Einwilligung
  Einladung aus dem Onboarding-Datum, „✕ Nicht möglich“ mit Gesundheits-Check-Vorschlag, Countdown ohne Plan-Bezug.
  Dritter Test: Gesundheits-Flag → „! Knapp“ mit Hinweisen `walk_only_plan` und ärztliche Abklärung, Wettkampfplan nur
  mit lockeren Arten, Arzt-Hinweis auf „Heute“, keine Pace/kein Distanz-Richtwert beim Gehen. Ganze mobile E2E-Suite
  lokal grün (103 + 1 Tests).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Onboarding:** Statt das Datumsfeld im Schritt „Ziel“ durch das ganze Wettkampf-Formular zu ersetzen, bleibt es
   ein optionales Datum (umbenannt) – die Ampel braucht Trainingstage und Gesundheits-Check, die erst danach abgefragt
   werden. „Heute“ lädt dann mit vorbelegtem Datum ein (Gründer-Frage G19).
2. **Ergebnis-Zeit:** Das Tagebuch kennt nur ganze Minuten; die genaue Zeit (mit Sekunden) steht als Notiz im Eintrag
   („Ergebnis: 1:58:20“). Keine Migration (Gründer-Frage G15).
3. **Ende des Wettkampfplans:** kein automatischer Grundlagen-Block, sondern „Plan neu erstellen“ (Start wieder bei der
   Startgruppe bzw. dem Tagebuch-Bezug) – vorsichtiger als ein Bezug auf die Spitze (WP1 M4, Gründer-Frage G16).
4. **Ziel-Distanz:** Wählt man im Formular eine andere Distanz als im Ziel (z. B. Vorschlag „kürzere Distanz“), wird das
   Ziel beim Erstellen des Wettkampfplans mit angepasst (Hinweis vorher sichtbar; Server verlangt gleiche Disziplin,
   Gründer-Frage G18).
5. **Timer-Zustand** lebt nur, solange der Trainingsmodus offen ist (Verlassen = neu starten); die eingetragene Dauer
   liegt sofort im geschützten Entwurf (Gründer-Frage G17).
6. **Pace** zeigt die App für die Arten aus `COMPETITION_PACE.spansSPerKm` (Fahrtspiel/Steigerungen nach Gefühl);
   Distanz-Richtwert nur gespeichert (Engine), nie in der App neu gerechnet.
7. **WP1 M4 (Ruhetage nach dem Rennen):** WP4 braucht keine neue Core-Regel – die Erholungswochen des Makrozyklus
   (50 %/60 %) bleiben, die App zeigt „Erholung nach dem Rennen“ bis zum Ende dieser Wochen (`postRaceRecoveryEnd`).
   `restDaysAfterRace` je Distanz bleibt mit der Fachprüfung offen.
8. **WP3 N1** (Plan mitten in der Woche neu erstellen): Woche 0 hat nie harte Einheiten (WP2 M1); beginnt der neue Plan
   an einem Montag direkt im Aufbau, zählen harte Einheiten des ersetzten Plans derselben Woche weiterhin nicht mit
   (Server zählt je Plan) – bekannte Grenze, mit 4b klären.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet; G8–G14 weiter offen):**

- **G15 – Ergebnis-Zeit mit Sekunden:** Voreinstellung: Dauer in ganzen Minuten im Tagebuch, genaue Zeit als Notiz.
  Alternative: eigene Spalte `result_time_s` am Wettkampf (kleine Migration, Anzeige „Ergebnis 1:58:20“).
- **G16 – Nach dem Wettkampfplan:** Voreinstellung: kein automatischer Folgeblock, Hinweis „Plan neu erstellen“
  (startet vorsichtig). Alternative: automatischer Grundlagen-Block mit Bezug auf den Startumfang (WP1 M4).
- **G17 – Timer beim Verlassen:** Voreinstellung: Timer endet beim Verlassen des Trainingsmodus. Alternative: Stand im
  Entwurf sichern und fortsetzen.
- **G18 – Andere Distanz als im Ziel:** Voreinstellung: Ziel wird mit angepasst (mit Hinweis). Alternative: nur die
  Distanz des Ziels anbieten.
- **G19 – Onboarding:** Voreinstellung: Datum im Onboarding, Wettkampf mit Ampel danach („Heute“/Einstellungen).
  Alternative: eigener Onboarding-Schritt „Wettkampf“ nach Gesundheits-Check und Trainingstagen.

**Nach der Wächter-Prüfung (16.10.2026, `waechter-wp4.md`, Freigabe mit Auflagen) umgesetzt:**

- **H1 – Wettkampf ändern bei laufendem Wettkampfplan:** Regel in `data/competition.ts` (`competitionSaveOptions`):
  Ändern sich Distanz, Renntag, Ziel, Zielzeit, Referenz, eigener Startumfang oder Wunsch-Tag, solange ein
  Wettkampfplan läuft, gibt es **kein** „Nur Countdown speichern“ mehr – nur „Speichern und Plan neu erstellen“ (Ampel
  grün/gelb) oder „Speichern und Plan ohne Wettkampf neu erstellen“, beide mit Bestätigung und Hinweis. Neu in Core
  `competitionPlanFit` (Plan-Bezug, gleiche Disziplin, gespeicherte Phasen = Makrozyklus des aktuellen Renntags, keine
  Einheit vom Vortag bis zum Ende der Rennwoche): Phasen-Band und Pace zeigt „Heute“ nur bei `fits`
  (`competitionPlanView`); sonst Hinweis „Dein Plan passt nicht mehr zu deinem Wettkampf“ (offline ohne Plan-Bezug: nichts
  Falsches, nur kein Band). „Mein Wettkampf“ zeigt den Stand ebenso. Der Countdown-Hinweis zur Rennwoche bleibt – er gilt
  dem Rennen, nicht dem Plan.
- **M1 – PDF:** `ExportDisplayContext.competitionLevel` → dieselbe Aufbereitung wie „Heute“ (`competitionWeek` →
  `applyCompetitionWeekLimits` + `applyCurrentEnduranceRules`) in Wochenübersicht und Ausdauer-Tabelle; neue Codes
  `endurance.workout` (Art, „hart“ mit Wort) und `endurance.steps` (Ablauf).
- **M2 – Kalender/Wochenübersicht:** Namen über `displayedSessionNames` (gleicher Anzeigeweg) statt des gespeicherten
  Namens, auch im Menü „Verschieben …“ und in den Meldungen.
- **M3:** App-Test über `sessionDisplay` (zwei harte Einheiten einer Woche, Profil Einsteiger → die zweite locker, auch
  die Timer-Schritte).
- **M4:** `planBasisChanged` in `data/competition.ts`; Wunsch-Tag zählt als plan-relevant (wie Datum), der gespeicherte
  eigene Startumfang wird unabhängig vom aktuellen Level verglichen und bleibt im Datensatz (ob er gilt, entscheidet
  Core – Hinweis `own_start_ignored` statt stillem Leeren).
- **M5:** Intervall-Timer hält den Bildschirm an, solange er läuft – unabhängig von der Einstellung (eigener Tag in
  `useScreenAwake`, damit das Freigeben die Sperre des Trainingsmodus nicht aufhebt).
- **M6:** Ergebnis idempotent (`resultLogToReuse`): gemerkter bzw. eigener Ergebnis-Eintrag vom Renntag wird
  wiederverwendet – nach einem gescheiterten Abschließen entsteht kein zweiter Tagebuch-Eintrag.
- **M7:** Folgeblock nach strengerer Gruppe bzw. strengerem Level: Ampel neu (`competitionFeasibility` mit aktuellen
  Angaben und Tagebuch-Bezug); „zu kurz“/„nicht möglich“ → kein Folgeblock, Hinweis „Dein Wettkampfziel ist so nicht
  mehr erreichbar“ mit „Plan neu erstellen“.
- **M8:** Hinweis im Phasen-Band, wenn Aufbau/Spitze wegen kurzer Tage (unter 25 min) keine harte Einheit hat
  (`shortDaysWithoutHard`, G10 bleibt Gründer-Frage).
- **N1** Android nur Live-Region (iOS `announceForAccessibility`), **N2** Ansage mit „Schritt X von N“, **N3**
  Bestätigungstext nennt „mindestens 1 Minute“, **N4** eigener Text, wenn gar keine Ampel möglich war (Renntag vorbei),
  **N5** offline kein falsches „Grundlagen-Plan“, **N6** Grenzen aus Core (`CARDIO_LOG_LIMITS`,
  `COMPETITION_OWN_START`), **N7** Test-Fixture `uuidBackend`, **N8** „Zielzeit“ nur, wenn erlaubt (`timeGoalOffered`),
  sonst Hinweis. **N9** (TalkBack und unsichtbare Live-Region) nur am Gerät prüfbar (EAS) – offen.
- **H2 / G8 – bekannte Einschränkung bis zur Gründer-Entscheidung G8:** Die Ampel rechnet den langen Lauf „Ankommen“
  weiter mit 40/50/70/120 min (5 km/10 km/Halbmarathon/Marathon) statt Plan 3.2 (Halbmarathon 90–120, Marathon
  150–180 min). Konstanten unverändert; Livegang an G8 gebunden.

| Nr.    | Gegenprobe (gebrochen → rot → zurückgesetzt)     | Rote Tests                                    |
| ------ | ------------------------------------------------ | --------------------------------------------- |
| GP-H1a | „Nur Countdown“ auch bei laufendem Wettkampfplan | 1 (`competition-waechter`)                    |
| GP-H1b | Phasen-Abgleich in `competitionPlanFit` entfernt | 1 (core `competition-plan-fit`)               |
| GP-H1c | Phasen-Band/Pace auch ohne `fits`                | 1 (`competition-waechter`)                    |
| GP-H1d | Einheit im Rennwochen-Fenster erlaubt            | 1 (core `competition-plan-fit`)               |
| GP-M1  | PDF ohne `competitionWeek`                       | 1 (core `training-plan-document-competition`) |
| GP-M2  | Namen ohne Wochenzahl-Grenze                     | 1 (`competition-waechter`)                    |
| GP-M3  | `sessionDisplay` ohne `competitionWeek`          | 1 (`competition-waechter`)                    |
| GP-M4  | Wunsch-Tag nicht plan-relevant                   | 1 (`competition-waechter`)                    |
| GP-M6  | kein Wiederverwenden des Ergebnis-Eintrags       | 1 (`competition-waechter`)                    |
| GP-M7  | keine neue Ampel bei strengerem Level            | 1 (`competition-waechter`)                    |
| GP-M8  | Hinweis „Tage zu kurz“ ohne Dauer-Prüfung        | 1 (core `competition-plan-fit`)               |
| GP-N8  | Zielzeit auch für vorsichtige Gruppe             | 1 (`competition-waechter`)                    |

Playwright: Schritt „Renntag vorverlegen bei laufendem Wettkampfplan“ (kein „Nur Countdown“, Hinweis, zwei
Neu-erstellen-Knöpfe; zurück auf das alte Datum → Hinweis weg). Timer-Ansage jetzt mit „Schritt X von N“.

**Nachtrag 19.10.2026 – Ampel in der Übersicht (Gründer-Feedback):** Der Hinweis „Erstelle den Wettkampfplan, wenn die
Ampel passt“ stand in der Übersicht, die Ampel aber nur im Formular („Ändern“). Jetzt zeigt „Mein Wettkampf“ bei einem
geplanten Wettkampf die Ampel „Machbarkeit“ direkt unter der Zusammenfassung, wenn der aktuelle Plan **kein** passender
Wettkampfplan ist (Grundlagen-Plan oder „Plan passt nicht mehr“) und der Renntag noch kommt – dieselbe Rechnung wie im
Formular (`competitionOverview` → `draftFeasibility` mit den gespeicherten Angaben, `shownFeasibility` gemeinsam für
Formular und Übersicht, `data/competition.ts`). Mit Gründen und Vorschlägen; „Übernehmen“ bei späterem Renntag bzw.
kürzerer Distanz öffnet das Formular mit dem übernommenen Vorschlag (offline ohne „Übernehmen“). Bei „✓ Passt“/„! Knapp“
gibt es direkt den Knopf **Wettkampfplan erstellen** (gleicher Ablauf mit Bestätigung „Plan neu erstellen?“, offline
gesperrt), bei „✕ Zu kurz“/„✕ Nicht möglich“ keinen Knopf. Läuft der passende Wettkampfplan, bleibt die Ampel weg.
Die Ampel erklärt sich selbst („Ampel: Wir prüfen, ob die Zeit bis zum Renntag für einen sicheren Wettkampfplan
reicht.“); die Texte „Grundlagen-Plan“, „Plan passt nicht mehr“ und „Wettkampfplan gerade nicht möglich“ verweisen nur
noch auf eine Ampel, wo sie zu sehen ist (Renntag heute/vorbei: eigener kurzer Text ohne Ampel). Tests:
`competition-overview.test.ts` (12), Playwright „Übersicht bei Grundlagen-Plan …“ und Ergänzung im Test ohne
Gesundheits-Check.

**Offen:** Fachprüfung aller Konstanten und Bausteine (Abschnitt 20 Punkt 5), G8–G14, M4 (`restDaysAfterRace`), WP3 N2
(80/20, „ab 65 nur Gehen“, „Einsteiger ab 3 Einheiten“ ohne Server-Gegenstück), Premium-Prüfung mit Phase 7 (W-G10),
Live-Test im Supabase-Modus (Teil 8 der HANDY-ANLEITUNG), Vibration/Bildschirm-an nur in der echten App prüfbar (EAS).

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

### Umsetzungsstand WP5 (18.10.2026)

**Was gilt (W-G2 wie entschieden; keine Echtzeit-KI; alle neuen Zahlen „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH
PRÜFEN“; ohne Rad/Triathlon-Wettkampf ist die Ausgabe byte-gleich):**

- **Disziplinen** (`plan/competition-schema.ts`): `COMPETITION_DISCIPLINES` = Laufen 5 km bis Marathon + **`cycling`** +
  **`triathlon_sprint`**, **`triathlon_olympic`** (Reihenfolge = Postgres-Enum). `RUN_COMPETITION_DISCIPLINES` (nur dort
  Zielzeit, Referenzzeit, Riegel, Pace). **Mittel-/Langdistanz und Schwimm-Wettkämpfe bekommen keinen Plan**
  (`COMPETITION_NO_PLAN_DISCIPLINES`, `competitionPlanOffer()` → `coach`; Zod lehnt sie ab; die App zeigt „Trainer bzw.
  Verein“). `competitionInputSchema` hat neu `distanceKm` – **genau beim Rad**, 20–300 ganze km; Rad und Triathlon
  **nur „Ankommen“, ohne Referenzzeit**.
- **Konstanten** (`constants.ts`, Block „Etappe WP5“ und die bestehenden Tabellen je Disziplin erweitert):
  `COMPETITION_CYCLING` (Distanzklassen bis 60/120/200/300 km mit Mindestvorlauf und Spitzenumfang „Ankommen“
  120/180/270/360 min/Woche, lange Ausfahrt 60/90/135/180 min; Tempo-Schätzung für die Ernährung),
  `COMPETITION_TRIATHLON` (mindestens 3 Ausdauer-Tage, Wochenmuster, Koppeltraining, Schwimmtechnik),
  `COMPETITION_BIKE_WORKOUTS` (Sweet-Spot, Renntempo auf dem Rad), Triathlon in `COMPETITION_DISTANCE_M` (25,75/51,5 km),
  `COMPETITION_LEAD_WEEKS` (Sprint 19/11/7, Olympisch 26/18/16 Wochen), `COMPETITION_REQUIRED_PEAK` (Sprint 180/75,
  Olympisch 300/120 min), `COMPETITION_PERIODIZATION` (Tapering Rad 10, Sprint 7, Olympisch 10 Tage; Spitze/Aufbau/Erholung),
  `COMPETITION_LONG_RUN.maxMinutes` (Rad 300, Sprint 120, Olympisch 180), Renntempo je Disziplin, Dauer-Schätzung
  Triathlon, `COMPETITION_GROUP_RULES` (unter 18: Triathlon nur Sprint, Rad höchstens 100 km).
- **Ampel** (`plan/competition.ts`): dieselbe Kette wie beim Laufen – die **10-%-Regel gilt über die Summe aller
  Ausdauer-Minuten** (Schwimmen + Rad + Laufen), Erholungswochen, Tapering, Plateau, „nie gestaucht“. Rad: Mindestvorlauf
  und Spitzenumfang je Distanzklasse (`cyclingClass`, `minimumLeadWeeks/requiredPeak/requiredLongRun(…, distanceKm)`).
  Neu: Grund **`triathlon_days_too_few`** (unter 3 Ausdauer-Tagen „zu kurz“, kein späteres Datum), Hinweise
  **`open_water_safety`** (jeder Triathlon) und **`beginner_long_event`** (Einsteiger: Olympisch bzw. Rad über 120 km),
  Vorschlag „kürzere Distanz“ **nur in derselben Sportart** (Olympisch → Sprint, Rad → kleinere Distanzklasse bzw.
  100 km, dann mit `distanceKm`). Tabelle 3.3 sinngemäß: Schwangerschaft/ohne Check „nicht möglich“, Flag/ab 65 höchstens
  „knapp“ mit `walk_only_plan` (Rad nur Ergometer, Laufen → zügiges Gehen, kein Koppeltraining), unter 18 „nicht möglich“
  für Olympisch bzw. Rad über 100 km (`minorPlanAllowed`).
- **Wochenbau** (`plan/multisport.ts`, `endurance-workouts.ts`, `schedule.ts` nur im Wettkampfplan): Rad = alle Tage Rad
  (lockere Ausfahrt, **lange Ausfahrt**, ab Aufbau **Sweet-Spot** bzw. Fahrtspiel, in Spitze/Tapering Renntempo; Ausweichen
  Ergometer/Rollentrainer). Triathlon (`triathlonWeekSports`): lange Einheit = **Rad**, übrige Tage im Wechsel Schwimmen,
  Laufen, Rad, Laufen, Schwimmen, Rad; **Koppeltraining (`brick`) als EINE Einheit mit zwei Teilen** (Rad → Lauf,
  `brickSplit`: Lauf 30 % der Dauer, 10–30 min) in Aufbau und Spitze, höchstens 1 je Woche, nicht in Erholungswoche/Woche
  0, am längsten Rad-Tag ohne lange Ausfahrt ab 25 min, locker (≤ 4); **Schwimmtechnik (`technique`)** am ersten
  Schwimm-Tag der Woche (Technikübungen + locker), sonst lockeres Schwimmen nach Dauer. Harte Einheiten nur Rad/Laufen
  (nie Schwimmen, nie Koppeltraining), sonst alle WP2-Regeln (Zahl je Woche, 80/20, 48 h, Phasen). **Minuten je
  Disziplin**: `sportMinutes()` – das Koppeltraining zählt mit dem Rad-Teil zu Rad und mit dem Lauf-Teil zu Laufen;
  Summe = Ausdauer-Minuten der Woche (darauf wirkt die 10-%-Regel).
- **Sicherheit Schwimmen:** `MULTISPORT_TEXTS_DE.openWater` (nie allein, Begleitung, Neoprenanzug, Badekappe/Boje, nur
  erlaubte und bewachte Stellen; im Zweifel Becken) – in der Ampel (Triathlon) und bei **jeder** Schwimm-Einheit
  (`sessionSafetyNotices`, auch ohne Wettkampf) auf „Heute“/Kalender und im Trainingsmodus.
- **apply-safety:** Koppeltraining wird bei jeder Änderung (Ergometer statt Rad, kürzer) eine lockere Einheit;
  Schwimmtechnik bleibt mit neu gerechneten Schritten gültig.
- **Datenmodell** (Migrationen **`20261018120000_wp5_enums.sql`** und **`20261018120100_wp5_rad_triathlon.sql`**, nur
  additiv bzw. `create or replace` mit gleicher Signatur, RLS unverändert): Enum-Werte `cycling`, `triathlon_sprint`,
  `triathlon_olympic`, `brick`, `technique`; CHECK `competitions_distance` neu gefasst (Rad 20–300 km in ganzen km, sonst
  aus der Disziplin), neue CHECKs `competitions_multisport` (Rad/Triathlon nur „Ankommen“ ohne Referenz, Referenz nur
  Laufen) und `planned_sessions_multisport` (Koppeltraining nur Rad-Einheit, Technik nur Schwimmen); Hilfsfunktionen
  `private.competition_server_lead_weeks` (lockerste Spalte je Disziplin/Distanzklasse) und
  `private.competition_minor_allowed`; `save_competition` mit **optionalem** Feld `distance_km` (ältere App-Stände ohne das
  Feld bleiben gültig – die App lässt es ohne Rad weg), `private.insert_plan_sessions` mit Distanz-Deckel und
  unter-18-Regel je Disziplin. `database.types.ts` nachgezogen.
- **Ernährung (W1):** erwartete Renndauer Rad = km ÷ vorsichtiges Tempo je Level (20/25/28 km/h), Triathlon feste
  Schätzung; geschätzte Renn-Energie mit dem (niedrigeren) Rad-Ersatz-MET. Laufen unverändert.
- **App:** „Mein Wettkampf“ mit 7 Distanzen (Radrennen mit Feld „Distanz in km (20–300)“, Triathlon Sprint/olympisch),
  Hinweis-Text zu Mittel-/Langdistanz und Schwimmen, eigener Hinweis bei einem Ziel ohne Wettkampfplan, „Bei Rad und
  Triathlon planen wir auf ‚Ankommen‘“ statt Zielzeit/Referenz, „Tag für die lange Ausfahrt“, „Längste Ausfahrt im Plan“,
  Countdown/Kalender „Radrennen 120 km“, Einheit „Koppeltraining (Rad → Lauf)“ mit „Zwei Teile in einer Einheit …“,
  Ablauf und Timer mit „(Rad)“/„(Laufen)“, Kasten „Sicherheit beim Schwimmen“. Ergebnis eintragen: Rad/Triathlon als
  Rad-Eintrag (Triathlon ohne Distanz).

**Tests:** Core neu `multisport-competition.test.ts` (25: Tabellen und Distanzklassen an den Grenzen, „Tabelle passt zur
Kette“ für Sprint/Olympisch und alle Rad-Klassen über 49 Wochentag-Kombinationen inkl. 1 Tag darunter = zu kurz, 1/2/7
Tage, Hinweise, Vorschläge, Mittel-/Langdistanz, Schwangerschaft/ohne Check/Flag/ab 65/unter 18, Koppeltraining-Aufteilung
und Minuten je Disziplin, Bausteine Rad/Schwimmen, Wochenbau, Freiwasser, apply-safety, Speichern, Server-Regeln,
Ernährung, ganzer Plan) und `generate-multisport.test.ts` (Eigenschaftstest **2 Seeds × 400 Läufe** über den GANZEN Plan:
10-%-Regel über die Summe, Rhythmus, Plan = Ampel-Vorschau, Summe je Disziplin, Koppeltraining/Technik nur wo erlaubt,
harte Einheiten, 80/20, Deckel, Eingabe-Prüfung und Regeln je Person). Angepasst: `competition-schema/-record/-rules`,
`competition.test.ts` (Tabellen-Tests auf Laufen), `periodization.test.ts`, `db-sync.test.ts` (+7 WP5). pgTAP neu
`47_wp5_rad_triathlon.test.sql` (47). App `data/competition-wp5.test.ts` (6) und Playwright
`e2e/competition-wp5.spec.ts` (2). Zahlen siehe PR.

**Regression „ohne Rad/Triathlon byte-gleich“:** `pnpm plan:examples` und `pnpm nutrition:examples` vor/nach zeichengleich;
die festen Prüfsummen-Tests aus WP1/WP2 grün; zusätzlich Raster aus 1.274 Lauf-Ampeln und ganzen Lauf-Wettkampfplänen
(4 Distanzen × 3 Level × 4 Zeitpläne × 4 Vorläufe × 2 Starttage × 3 Alter) gegen den Stand vor WP5: gleiche SHA-256.

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Lange Ausfahrt bis 300 min** steht als Deckel in den Konstanten, wirkt aber höchstens mit **240 min**, weil ein
   Trainingstag und eine Einheit in der Datenbank höchstens 240 min haben (TRAINING_LIMITS, CHECK) – Gründer-Frage
   WP5-G1.
2. **Rad-Distanzklassen** statt einer Formel: Mindestvorlauf und Spitzenumfang je Klasse (bis 60/120/200/300 km).
   Einsteiger-Mindestvorlauf genau aus der Kette (Start 60 min), Fortgeschritten/Leistungssport 2 Wochen über der Kette
   (wie Marathon in Tabelle 3.2). 300 km für Einsteiger: 30 Wochen.
3. **Rad und Triathlon nur „Ankommen“** – ohne Zielzeit, Referenzzeit, Pace und Distanz-Richtwert (Riegel gilt für
   Laufzeiten; Pace beim Rad/Schwimmen ohne Messgerät nicht sinnvoll). Anstrengung und Sprechtest bleiben das Maß.
4. **Triathlon ab 3 Ausdauer-Tagen**, sonst „zu kurz“ mit eigenem Grund (je Disziplin ein Tag). Koppeltraining erst ab 4
   Tagen (am Rad-Tag ohne lange Ausfahrt, ab 25 min) – bei 3 Tagen bleibt der einzige Lauf-Tag ein Lauf.
5. **Koppeltraining locker** (Anstrengung wie ein lockerer Tag) – Ziel ist der Wechsel, nicht die Härte; es zählt nicht
   als harte Einheit. Aufteilung Lauf 30 % (10–30 min) → Gründer-Frage WP5-G2.
6. **Kein hartes Schwimmen**: Schwimmen nur Technik und locker nach Dauer (Plan 9); harte Einheiten nur Rad/Laufen.
7. **Unter 18** (Tabelle 3.3 „analog“): Triathlon nur Sprint, Rad höchstens 100 km, Anstrengung ≤ 7, höchstens 1 harte
   Einheit je Woche (wie Laufen). Den Countdown ohne Plan-Bezug kann auch eine Person unter 18 für längere Distanzen
   speichern (wie beim Marathon) – Gründer-Frage WP5-G3.
8. **Flag/ab 65:** wie beim Laufen (G7) höchstens „knapp“, Plan nur locker: Rad nur **Ergometer** (nie Rad im Freien,
   Phase 3), Laufen → zügiges Gehen, Schwimmen locker im Becken, **kein Koppeltraining**.
9. **Freiwasser-Hinweis bei jeder Schwimm-Einheit**, auch im Grundlagen-Plan ohne Wettkampf (Sicherheit, rein additive
   Anzeige; Plan-Ausgabe unverändert).
10. **Sweet-Spot** = Art `tempo` mit Rad-Texten (Anstrengung 6, zwei Abschnitte mit 5 min locker) – kein neuer Enum-Wert;
    Steigerungen und Intervalle gibt es auf dem Rad nicht.
11. **`distance_km` optional** in `save_competition` (Pflicht sind weiter die 15 bisherigen Felder): So funktioniert das
    Speichern eines Lauf-Wettkampfs auch dann, wenn App und Datenbank kurz nicht denselben Stand haben.
12. **Ergebnis eintragen:** Rad und Triathlon als Rad-Eintrag im Tagebuch (Triathlon ohne Distanz, weil ein Eintrag nur
    eine Sportart kennt) – Gründer-Frage WP5-G4.
13. **Folgeblock ohne Tagebuch-Einträge** beginnt (wie bisher beim Laufen) wieder beim Startumfang der Gruppe; dann sind
    die Einheiten kürzer und Koppeltraining/harte Einheiten kommen später. Unverändert übernommen.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **WP5-G1 – Lange Ausfahrt über 240 min:** Voreinstellung 240 min (Tageslimit). Alternative: Trainingstage und Einheiten
  bis 300 min erlauben (kleine Migration: CHECK `training_slots`/`planned_sessions`, Eingaben in der App).
- **WP5-G2 – Koppeltraining:** Voreinstellung locker, Lauf-Teil 30 % (10–30 min), ab 25 min, nur Aufbau/Spitze, höchstens
  1 je Woche. Alternative: zügiger Lauf-Teil im Renntempo (dann als harte Einheit gezählt).
- **WP5-G3 – Unter 18:** Voreinstellung Triathlon nur Sprint, Rad bis 100 km. Alternative: Olympisch ab 17 Jahren.
- **WP5-G4 – Ergebnis Triathlon:** Voreinstellung ein Rad-Eintrag ohne Distanz. Alternative: drei Einträge (Schwimmen,
  Rad, Laufen) bzw. eigene Spalte für die Gesamtzeit (Migration).
- **WP5-G5 – Spitzenumfang:** Voreinstellung Sprint 180, Olympisch 300 min/Woche, Rad 120–360 min je Klasse („Ankommen“,
  Fachprüfung). Alternative: niedrigere Werte (kürzerer Mindestvorlauf, weniger Reserve).

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

### Umsetzungsstand W1 (18.10.2026)

**Was gilt (keine Migration, keine Echtzeit-KI; alle Zahlen „VOR LIVEGANG FACHLICH PRÜFEN“):**

- **Konstanten** (`constants.ts`): `CARB_LOADING_DAYS = { min: 1, max: 2 }` (Burke 2011, Thomas 2016) und
  `COMPETITION_NUTRITION` (Carb-Loading ab 90 min, zwei Tage ab 150 min, Richtwert 8–10 g/kg, Frühstück 2–4 h vorher mit
  etwa 1 g/kg je Stunde Abstand, also 2–4 g/kg, Gel-Stufen < 60 min nichts / ≤ 120 min bis 30 g/h / ≤ 150 min 30–60 g/h /
  > 150 min 60–90 g/h nur für Fortgeschrittene/Leistungssport,
  > Portionen alle 30 min, Trinken 400–800 ml/h, Erholungsmahlzeit 1–2 h danach, vorsichtige Dauer-Schätzung je Distanz
  > und Level; Quellen Jeukendrup 2014, Sawka 2007, Kerksick 2017).
- **Core** `packages/core/src/nutrition/competition.ts`: `nutritionCompetitionSchema` (Zod, nur Felder für die Ernährung,
  kein Gesundheitsdatum), `expectedRaceMinutes` (Zielzeit → Referenzzeit mit Riegel, nur Faktor ≤ 4 → Schätzung),
  `carbLoadingDayCount`, `competitionDays(competitions, weekStart, level)` / `competitionDayFor` (je Tag
  `carb_loading | race_eve | race_day | post_race | normal`, dazu `carbLoading` und `noDeficit`), `raceDaySession`,
  `competitionCarbsGPerKg`, `raceFuelingPlan(expectedMinutes, level, { generalOnly, weightKg })` (Stufe, g/h, ml/h,
  Zeitleiste, feste Hinweis-Codes), `raceBreakfastCarbs`, `competitionGuideId`.
- **Ernährungs-Engine:** neue optionale Eingabe `competitions` (Standard leer – ohne Wettkampf ist die Ausgabe
  byte-gleich, `nutrition:examples` und `plan:examples` vor/nach zeichengleich). Je Tag optional `competition`
  (Art, Disziplin, erwartete Dauer und Quelle, `carbLoading`, `carbsShifted`, `carbLoadingReached`, `noDeficit`,
  `raceEnergyIncluded`, am Renntag `fueling`). Tage ohne Defizit: Anpassung `max(Anpassung, 0)`, 4b-Versatz an
  Carb-Loading-Tagen 0 und an den übrigen Tagen ohne Defizit nie negativ; ein aktives Abnehmziel steht dort auf
  `paused`. Carb-Loading: Makros mit `carbsTargetGPerKg = 8` – Eiweiß unverändert, Fett nur bis 20 %, Rest
  Kohlenhydrate, sonst `carbLoadingReached: false`. Renntag: geschätzte Renn-Einheit (Laufen, Ersatz-MET) nur als
  Energie-Eingabe, Deckel `TRAINING_KCAL_DAY_MAX` wie immer; mit Ergebnis-Eintrag zählt nur der Eintrag.
  `clampCalorieTarget` bleibt die einzige Stelle mit Schutzgrenzen (Strukturtest K2 um `competition.ts` erweitert).
- **Essensplan:** Rezepte der Kategorie `wettkampf` an Carb-Loading-Tagen, Vorabend und Renntag erlaubt (nie als
  Ergänzungs-Snack oder vorgekocht) und mit Bonus wie passende Trainings-Tags; sonst weiter ausgeschlossen
  (`slotFitReasons({ competitionDay })`). Abgleich-Schlüssel mit Teil `wk=<Art>` nur an Wettkampftagen → neuer
  Neuplanungs-Grund `competition_changed` (neu, verschoben, abgesagt).
- **Tagesauswertung (A2):** Hinweis `carb_loading_day` („Heute mehr Kohlenhydrate – so geplant.“), nur mit Zahlen.
- **App:** Karte „Wettkampf-Ernährung“ in Ernährung → Tag (`components/competition-nutrition.tsx`, Texte
  `i18n/de-competition-nutrition.ts`, Formatierung `lib/competition-nutrition-format.ts`) mit Art („▲ Carb-Loading-Tag“,
  „◇ Vorabend“, „◆ Renntag“, „○ Nach dem Rennen“, „· Wettkampfwoche“ – Zeichen und Wort), Zeitleiste am Renntag (offline,
  aus den Tageszielen), Hinweis zur ärztlichen Abklärung (Vorerkrankungen, Schwangerschaft, Medikamente), Link zum
  Ratgeber, wenn einer lesbar ist. Markierung in Ernährung → Woche, Satz in „Dein Tag“, Knopf „Ernährung zum Renntag“
  in „Mein Wettkampf“. „Kalorienzahlen anzeigen“ aus → keine kcal und keine Gramm (Milliliter bleiben).
- **Tests:** Core `competition.test.ts` (53, u. a. Eigenschaftstest über 300 zufällige Personen: Carb-Loading-Tag in
  [Untergrenze; Obergrenze] auch gegen unabhängige Grenzen, Fett ≥ 20 %, Eiweiß = ohne Verschiebung ≥ Minimum; Fälle unter
  18, `maintenance_only`, Fettverlust, `no_targets` (ohne Einwilligung, Schwangerschaft), < 90 min, Rennen am Montag,
  abgesagt, Abnehmziel ruht ohne Aufholen, 4b-Versatz, 300 kg am Deckel, 18. Geburtstag am Renntag, Essensplan nur an
  Wettkampftagen, Neuplanung), `day-evaluation.test.ts` (+1), `limits.test.ts` (+1, K2). App
  `competition-nutrition-format.test.ts` (14). Playwright `competition-nutrition.spec.ts`. Gegenproben (Regel gebrochen →
  rot → zurückgesetzt): Erhalt in der Wettkampfwoche entfernt (4 rot), Carb-Loading erst über 90 min (1), Wettkampf-Rezepte
  an jedem Tag (1), Renn-Energie trotz Ergebnis (1), Abnehmziel ruht nicht (1), abgesagt zählt (3), 60–90 g/h auch für
  Einsteiger (1), 4b-Versatz an Carb-Loading-Tagen (1).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Carb-Loading-Tage = die Tage direkt vor dem Renntag, inkl. Vorabend:** 90–149 min → nur der Vorabend, ab 150 min
   Vorabend und Tag davor. Der Vorabend heißt auch dann „Vorabend“ (mit Verschiebung).
2. **„Wettkampfwoche ohne Defizit“ (1.6 Nr. 2)** = Kalenderwoche des Renntags, dazu Carb-Loading-Tage bzw. Vorabend davor
   (Rennen am Montag) und der Tag danach („Nach dem Rennen“). Frühere Tapering-Wochen bleiben mit dem Ziel des Profils
   (Gründer-Frage W1-G1). Ein Überschuss (Muskelaufbau) bleibt; 4b-Versatz siehe oben.
3. **Kein Aufholen:** Das Abnehmziel ruht nur (Status `paused`); danach rechnet es wie ohne Wettkampf (zustandslos, die
   Anpassung bleibt in [Standard; 0]) – Test „Woche davor und danach gleich“.
4. **Renn-Energie** mit Ersatz-MET Laufen 7,0 (vorsichtig niedrig) statt eigener Renn-Konstante (W1-G2); sie zählt nicht
   als „Einheit“ (kein Timing vor/nach dem Training, kein Hinweis „Trainingstag“).
5. **`no_targets`** (keine Einwilligung, Schwangerschaft): Art des Tages und fester Carb-Loading-Hinweis
   (`CARB_LOADING_NOTICE_DE`), Gel-Plan nur allgemein (wie unter 18), keine Gramm.
6. **Eiweiß an Carb-Loading-Tagen unverändert** (nicht abgesenkt) – so ist „Eiweiß ≥ Minimum“ immer erfüllt; das
   Ziel 8 g/kg wird dadurch seltener erreicht (Hinweis).
7. **Frühstücks-Gramm** nur mit Körpergewicht und nicht unter 18; Gramm in der App nur mit „Kalorienzahlen anzeigen“.
8. **Wettkampf-Rezepte:** Der Bestand hat noch keine Rezepte mit Kategorie `wettkampf` (Beispiel-Rezepte auch nicht) –
   die Regel greift, sobald freigegebene Rezepte sie tragen (Test mit markiertem Fixture-Rezept).
9. **Kein Wettkampf in wenigen Tagen über die App** (Mindestvorlauf): Handy-Test springt über „Ernährung zum Renntag“
   in die Zukunft; die Wochenansicht zeigt nur diese/nächste Woche (Playwright legt den Wettkampf direkt im
   Gerätespeicher an).

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **W1-G1 – Ohne Defizit auch im ganzen Tapering?** Voreinstellung: nur Rennwoche (+ Carb-Loading-Tage davor, Tag danach).
  Alternative: alle Tapering-Wochen (Marathon bis 3 Wochen ohne Defizit).
- **W1-G2 – Renn-Energie:** Voreinstellung: 7,0 MET (Laufen „zügig“, eher zu niedrig). Alternative: eigene, höhere
  Renn-MET je Distanz (Fachprüfung).
- **W1-G3 – Premium (W-G10):** Testphase offen; mit Phase 7 Wettkampf-Ernährung im Essensplan Premium, Ratgeber gratis.
- **W1-G4 – Carb-Loading unter 18:** Voreinstellung: **keine** Makro-Verschiebung, nur Erhalt und der feste Hinweis „nicht
  ohne fachliche Absprache“ (`CARB_LOADING_NOTICE_DE`); kein g/kg-Satz, Gel-Plan nur allgemein (Milliliter bleiben).
  Alternative: Verschiebung im Erhaltungsband wie bei Erwachsenen.

**Nach der Wächter-Prüfung (18.10.2026, „freigabefähig“, kein Blocker) umgesetzt:**

- **M1:** unter 18 keine Carb-Loading-Verschiebung (`carbsShifted: false`, kein Hinweis `carb_loading_day`), Tests 16/17/18
  Jahre (18. Geburtstag am Carb-Loading-Tag zählt tagesgenau). Gründer-Frage W1-G4.
- **M2:** Gel-Richtwerte an Jeukendrup 2014 angeglichen: 60–120 min „bis 30 g/h“ (Stufe `light`, Portionen bis 15 g),
  120–150 min 30–60 g/h, darüber wie bisher; Quellenkommentar präzisiert.
- **M3:** Neuplanungs-Schlüssel `wk=<Art>:cl`, wenn Carb-Loading gilt (ohne Wettkampf byte-gleich); Test Zielzeit 85 → 95
  min (Vorabend wird Carb-Loading-Tag → `competition_changed`).
- **N4:** eigener Text „Dein Abnehm-Ziel ruht wegen deines Wettkampfs und läuft danach von selbst weiter“ in der
  Wettkampf-Karte und unter „Dein Abnehm-Ziel“ (`weightGoalOverview().pausedForCompetition`).
- **N5:** vergangener Renntag ohne Ergebnis-Eintrag: keine geschätzte Renn-Energie (nur heute/künftig).
- **N6:** Frühstücksmenge nach Abstand (etwa 1 g/kg je Stunde vorher, 1–4 g/kg) – für die Fachprüfung vorgemerkt.
- **N7:** unter 18 kein g/kg-Satz (folgt aus M1), Milliliter bleiben; App-Test.
- **N8:** leere Plätze nennen den Grund `competition` an Wettkampftagen nicht mehr (`emptyReasons` mit `competitionDay`).
- **N9:** Ratgeber über feste IDs (`COMPETITION_GUIDE_IDS`: `wettkampf` aus dem Import, sonst `demo-wettkampf`).
- **N10 (nur dokumentiert):** Ist ein freier Eintrag vom Renntag nicht als Ergebnis verknüpft, zählen geschätzte
  Renn-Energie und Eintrag zusammen. Das hebt das Tagesziel nur an und ist durch `TRAINING_KCAL_DAY_MAX` und die
  Obergrenze gedeckelt – nie unter eine Schutzgrenze.

**Offen:** Fachprüfung Ernährung (Abschnitt 20 Nr. 6), Rezepte mit Kategorie `wettkampf` freigeben, PDF des Essensplans
ohne Wettkampf-Markierung (später), Premium-Prüfung mit Phase 7.

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

### Umsetzungsstand S1 Teil 1 – Core und Datenbank (16.10.2026)

**Umfang:** nur Rechenlogik (`packages/core/src/routes/`) und Datenmodell – **keine App-Oberfläche, keine nativen
Module** (die App-Seite folgt nach dem Spike S0 und W-G13 mit einem Development Build). Alles nur additiv.

**Core (`packages/core/src/routes/`, Konstanten in `constants.ts` mit Quelle):**

- `track.ts`: `filterTrackPoints` (ungültige Koordinaten, Genauigkeit über 30 m, Zeit nicht nach dem letzten Punkt –
  doppelt/rückwärts –, Stillstand unter 3 m, Sprung schneller als `ROUTE_FILTER.jumpFactor` 1,5 ×
  `CARDIO_PLAUSIBILITY_KMH`; Zählung der Gründe ohne Koordinaten), `trackDistance`/`haversineM` (mittlerer Erdradius),
  `elevationGain` (gleitender Mittelwert über 5 Punkte + Hysterese 4 m, Hinweis-Code `gps_elevation_inaccurate` immer
  gesetzt), `autoPause` (`ROUTE_AUTO_PAUSE_KMH`: Laufen 3, Rad 5, Gehen 1,5 km/h), `kmSplits` (Bewegungszeit je
  vollem km, Differenz gerundeter Zeitpunkte → Summe nie über der Bewegungszeit), `movingDistance`, `hasSpeedWarning`
  (mindestens 10 s schneller als `CARDIO_PLAUSIBILITY_KMH` → „Bitte prüfen“, nie verwerfen).
- `simplify.ts`: `simplifyTrack` – Douglas-Peucker ohne Rekursion (Stapel), Toleranz 5 m in flacher Projektion;
  über 5.000 Punkte Toleranz verdoppeln (bis 640 m), danach gleichmäßig ausdünnen; deterministisch, Anfang/Ende bleiben.
- `polyline.ts`: `encodePolyline`/`decodePolyline` (Google-Format, 5 Nachkommastellen, ungültig → `null`, nie ein
  Fehler), `boundingBox`.
- `gpx.ts`: `toGpx` (GPX 1.1, Reihenfolge laut Schema, `escapeXml` für & < > " ' und Entfernen von Zeichen, die XML 1.0
  nicht erlaubt), `gpxFileName` (ohne Namen/Ort der Strecke).
- `compare.ts`: `compareAttempts` – nur die Favoriten-Strecke selbst und Wiederholungen mit `base_route_id` = Favorit,
  gleiche Person, gleiche Sportart; zeitlich sortiert (nie nach Zeit – keine Rangliste), Vergleich nur mit dem
  vorherigen vergleichbaren Lauf (Distanz ±10 %), Codes `first | faster | slower | same | not_comparable`, neutrale
  Texte („Heute 1:20 min schneller als beim letzten Mal.“), keine Bestzeit, keine Serie (W-G16).
- `schema.ts`: `trackedRouteSchema` (Eingabe von `save_tracked_route`, strikt, 16 Felder: Name 1–80 getrimmt, Notiz
  1–280 Code-Points oder null, Sportart `run | bike | walk`, Schwierigkeit `easy | medium | hard` oder null, Dauer
  1 min–12 h, Bewegung ≤ Dauer, Distanz 0–500 km und plausibel, Höhenmeter bis 10.000, Polyline 2–5.000 Punkte und
  höchstens 60.000 Zeichen, Kilometerzeiten = volle km mit Summe ≤ Bewegung, Beginn ab 2020 mit Zeitzone, keine
  Wiederholung von sich selbst), `updateTrackedRouteSchema`, `TrackedRouteRow`, `summarizeTrack` (Rohpunkte →
  Zahlen, Linie, Warnung, „zu kurz“), `toTrackedRoutePayload` (→ geprüfte Eingabe oder `null`).
- Konstanten: `ROUTE_FILTER`, `ROUTE_ELEVATION`, `ROUTE_AUTO_PAUSE_KMH`, `ROUTE_SPEED_WARNING`, `ROUTE_SIMPLIFY`,
  `TRACKED_ROUTE_LIMITS`, `ROUTE_COMPARE`; Enums `TRACKED_ROUTE_SPORTS`, `ROUTE_DIFFICULTIES`, `TRACKED_ROUTE_SOURCES`.

**Datenbank (Migrationen `20261016220000_tracked_route_enums.sql`, `20261016220100_tracked_routes.sql`,
`20261016220200_tracked_route_rpcs.sql`):**

- Enums `route_difficulty`, `tracked_route_source`; Sportart als `endurance_modality` mit CHECK `run | bike | walk`
  (passt ohne Umrechnung zum Tagebuch).
- Tabelle `tracked_routes` wie Plan (Spalten oben) mit CHECKs = Zod; zusätzlich: Distanz-Plausibilität in ganzen
  Zahlen (`distance_m × 36 ≤ km/h × 10 × duration_s`, km/h = 1,5 × Plausibilität), `private.polyline_summary` (Polyline
  lesen wie `decodePolyline`) – CHECK „Anzahl und Rahmen passen zur Polyline“, `private.km_splits_valid`, Name ohne
  Leerraum am Rand (gleiche Zeichen wie beim Wettkampf). `base_route_id` und `session_log_id` als **zusammengesetzte
  Fremdschlüssel mit `user_id`** (nur eigene Zeilen, `on delete set null` nur für die Spalte); höchstens eine Strecke
  je Tagebuch-Eintrag (Teil-Index).
- RLS: genau eine Policy „nur eigene Zeilen lesen“, `authenticated` nur SELECT, `anon` nichts, **kein Partner-Zugriff**.
- Funktionen (`security definer`, `search_path = ''`, nur `authenticated`, feste Fehlertexte ohne Werte):
  `save_tracked_route(p_route)` (Felder = `trackedRouteSchema`; Anzahl Punkte und Rahmen rechnet der Server; Beginn +
  Dauer höchstens 5 min nach jetzt; Favoriten-Wiederholung nur auf eigene Favoriten derselben Sportart; Tagebuch-Eintrag
  nur eigener Ausdauer-Eintrag derselben Art vom Tag des Beginns bis 1 Tag danach, noch ohne Strecke; Tageslimit
  **20 neue Strecken** je Tag, `private.tracked_route_daily_counts`; Gerät-id: gleiche eigene id → dieselbe Strecke
  ohne Änderung, fremde id → neue id), `update_tracked_route(p_route)` (nur Name, Schwierigkeit, Favorit, Notiz),
  `delete_tracked_route(p_id)`, `delete_all_tracked_routes()` (→ Anzahl).
- **Herkunft im Tagebuch (WP3 Präzisierung 8, entschieden – sichere Variante, ohne App-Bruch):** `log_source`
  `gps`/`gpx_import` setzt **nur** `save_tracked_route` am verknüpften Eintrag. `save_session_log` (neueste Fassung
  A1b Zeile für Zeile übernommen) lehnt `gps`/`gpx_import` für neue Einträge und jeden Wechsel der Herkunft ab; beim
  Ändern bleibt die gespeicherte Herkunft (die heutige App sendet weiter `manual`). Reihenfolge in der App:
  erst `save_session_log`, dann `save_tracked_route` mit `session_log_id`.
- **Export:** `export_my_data()` = E3-Fassung Zeile für Zeile + `tracked_routes` (36 Bereiche im App-Export:
  35 + `tracked_routes`); `DATA_EXPORT_TABLES`, Testmodus-Export (leer) und e2e angepasst.
- **Konto löschen:** Kaskade (Strecken und Zähler). **Widerruf `health_data`:** `consents_after_revoke` unverändert –
  Strecken bleiben (W-G15), verknüpfte Einträge wie bisher (neutralisiert bzw. mit „auch löschen“ gelöscht → Verweis
  leer, Strecke bleibt).
- `packages/db/database.types.ts` von Hand nachgezogen (Tabelle, Enums, vier Funktionen).

**Tests:**

- Core neu (`routes/*.test.ts`, 110 Tests): 0/1/2 Punkte, Stillstand (Distanz 0), GPS-Sprung, Funkloch 5 min (in
  Bewegung bzw. stehend), doppelte Zeitstempel, Zeit rückwärts, 12 h und 12 h + 5 s, 100.000 Rohpunkte (unter 3 s,
  höchstens 5.000 Punkte), Bergab-Rad 70 km/h (Warnung, nicht verworfen, speicherbar), Polyline-Rundreise (2.000
  Zufallsstrecken) und Google-Beispiel, GPX wohlgeformt und escaped (zusätzlich einmal mit `xmllint` geprüft),
  Kilometerzeiten bei 0,99 und 1,01 km; Eigenschaftstests (Filter idempotent, Summe der Kilometerzeiten ≤ Bewegung,
  Zufallsaufzeichnungen ergeben immer eine gültige Eingabe oder `null`, Vereinfachung innerhalb der Toleranz);
  Datenschutz-Test (kein `console`/Netz im Strecken-Code, Fehler ohne Koordinaten). `db-sync.test.ts` +23 (Enums,
  Feldlisten, alle Grenzen, Plausibilität, Polyline-Leser, Tageslimit, RLS, Widerruf, `save_session_log`-Obermenge,
  Export-Obermenge). Core gesamt 4.396 → 4.529.
- pgTAP neu `42_tracked_routes.test.sql` (115): Polyline-Leser gegen Google-Beispiel und Core-Vektor, Zugriff (anon,
  ohne Login, ohne Profil, genau eine Policy, Rechte), alle Grenzen, Warteschlange, fremde id, Favoriten- und
  Eintrag-Regeln, Herkunft, Ändern/Löschen fremder Strecken, Verweise beim Löschen, Widerruf, Export, Tageslimit,
  direktes Schreiben, CHECK auch für `service_role`, `delete_all`, Konto löschen. Alle **36 Dateien grün, 1.946 Tests**
  (vorher 35/1.831). 39–41 bleiben für E4 frei.
- `pnpm turbo run lint typecheck test --force` grün (18/18), `pnpm format:check` grün, mobile e2e `history.spec.ts`
  grün (Export 36 Bereiche).

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt; `git status` danach unverändert):**

| Nr. | Gebrochene Regel                                                     | Rote Tests                        |
| --- | -------------------------------------------------------------------- | --------------------------------- |
| G1  | RLS: alle Zeilen lesbar                                              | 7 (pgTAP 42)                      |
| G2  | Wiederholung ohne Favoriten-Prüfung                                  | 1 (42)                            |
| G3  | Wiederholung ohne Prüfung der Person                                 | 1 (42)                            |
| G4  | Eintrag ohne Prüfung der Person                                      | 1 (42)                            |
| G5  | Eintrag ohne Prüfung der Ausdauer-Art                                | 3 (42)                            |
| G6  | Eintrag ohne Tages-Fenster                                           | 1 (42)                            |
| G7  | zweite Strecke je Eintrag: Funktions-Prüfung entfernt (Index bleibt) | 1 (42)                            |
| G8  | `save_session_log` nimmt jede Herkunft an                            | 6 (42)                            |
| G9  | `save_session_log` überschreibt die gespeicherte Herkunft            | 1 (42)                            |
| G10 | Export ohne `tracked_routes`                                         | 2 (pgTAP 17) + 3 (42) + 2 db-sync |
| G11 | Tageslimit 21 nur im SQL                                             | 2 (42) + 1 db-sync                |
| G12 | CHECK Polyline ↔ Anzahl/Rahmen entfernt                              | 1 (42)                            |
| G13 | 5.001 Punkte erlaubt                                                 | 1 (42) + 2 db-sync                |
| G14 | `authenticated` darf direkt schreiben                                | 2 (42)                            |
| G15 | Distanz-Plausibilität Laufen × 10 nur im SQL                         | 1 (42) + 1 db-sync                |
| G16 | Widerruf löscht Strecken                                             | 4 (42) + 2 db-sync                |
| G17 | Beginn in der Zukunft erlaubt                                        | 1 (42)                            |
| G18 | `update_tracked_route` ohne Prüfung der Person                       | 2 (42)                            |
| G19 | `delete_tracked_route` ohne Prüfung der Person                       | 2 (42)                            |
| G20 | fremde id übernommen (keine neue id)                                 | 42 bricht ab (Plan nicht erfüllt) |
| C1  | Filter ohne Genauigkeits-Regel                                       | 1 (`track`)                       |
| C2  | Filter ohne Sprung-Regel                                             | 4 (`track`, `schema`)             |
| C3  | Filter ohne Zeit-Regel                                               | 2 (`track`)                       |
| C4  | Vergleich auch mit fremden Läufen                                    | 1 (`compare`)                     |
| C5  | Vergleich als Rangliste (nach Zeit sortiert)                         | 5 (`compare`)                     |
| C6  | Zod ohne Distanz-Plausibilität                                       | 1 (`schema`)                      |
| C7  | Tageslimit 25 nur im Core                                            | 1 (`db-sync`)                     |
| C8  | `DATA_EXPORT_TABLES` ohne `tracked_routes`                           | 2 (`db-sync`)                     |
| C9  | GPX ohne Escape von &                                                | 2 (`gpx`)                         |
| C10 | `console.log` im Strecken-Code                                       | 1 (`privacy`)                     |
| C11 | Name bis 100 nur im Core                                             | 1 (`db-sync`)                     |
| C12 | Kilometerzeiten ohne Pausen-Ausschluss                               | 3 (`track`, `schema`)             |
| M1  | App-Export (Testmodus) ohne `tracked_routes`                         | 2 (mobile `data-export`)          |

G7 nur mit der Funktions-Prüfung rot, weil der Teil-Index dieselbe Regel als zweite Sicherung hält (die Meldung ist
dann gleich, der Fehlercode anders).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Distanz = Bewegungsdistanz:** Abschnitte in der Pause zählen weder Zeit noch Distanz (GPS-Rauschen im Stehen
   addiert sonst Meter). Ein Funkloch mit Lauftempo zählt voll (gerade Linie), ein langsames Funkloch nicht.
2. **Kilometerzeiten = Bewegungszeit** je vollem km; ein Rest unter 1 km hat keine Zeit. Vergleich ebenfalls mit der
   Bewegungszeit.
3. **Sprung-Schwelle 1,5 × Plausibilität** (Laufen 37,5, Rad 105, Gehen 15 km/h) – so bleibt 70 km/h bergab erhalten
   (nur Warnung); der Server prüft den Durchschnitt über die ganze Dauer gegen dieselbe Schwelle.
4. **Punkte und Rahmen rechnet der Server** aus der Polyline (nicht aus der Eingabe); ein CHECK hält beides auch bei
   direkten Schreibvorgängen (`service_role`) zusammen.
5. **Gerät-id für die Warteschlange** (wie im Tagebuch): erneutes Senden erzeugt keine zweite Strecke und zählt nicht.
6. **Neue Funktion `update_tracked_route`** (im Plan nur speichern/löschen): ohne sie ließe sich eine Strecke später
   nicht als Favorit markieren oder umbenennen. Linie, Zeiten, Herkunft und Verweise sind nicht änderbar.
7. **Schwierigkeit optional** (null = nicht angegeben). **Kein Mindestweg auf dem Server:** „unter 100 m → fragen“
   macht die App; der Server nimmt 0 m (z. B. 1 min Stillstand) an.
8. **Wiederholung:** nur eigene Favoriten derselben Sportart; ein Favorit, der zurückgenommen wird, behält seine
   Wiederholungen (Vergleich nur solange Favorit). Löschen des Favoriten → Wiederholungen bleiben, Verweis leer.
9. **Beginn:** Ende höchstens 5 min nach jetzt (Uhr des Geräts), sonst kein Datumsfenster – das Fenster für den
   Tagebuch-Eintrag (14 Tage) prüft weiter `save_session_log`. Löschen der Strecke lässt die Herkunft `gps` des
   Eintrags stehen (Gründer-Frage S1-G1).
10. **GPX aus gespeicherten Strecken** hat keine Zeit je Punkt (der Server speichert keine), nur die Startzeit in den
    Metadaten.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **S1-G1 – Herkunft nach Löschen der Strecke:** Voreinstellung: Der Tagebuch-Eintrag behält „gps“ (er wurde per GPS
  aufgezeichnet). Alternative: zurück auf „manual“.
- **S1-G2 – Tageslimit:** Voreinstellung 20 neue Strecken je Tag (Schutz gegen Missbrauch, wie 10 Einträge im
  Tagebuch). Kein Gesamtlimit je Person – bei Bedarf (Speicher) später additiv.
- **S1-G3 – Pausen zählen nicht zur Distanz:** siehe Präzisierung 1 (Alternative: Distanz immer, Zeit nur in Bewegung).
- **S1-G4 – Vergleichbarkeit:** ±10 % Distanz, „etwa gleich schnell“ bis 5 s Unterschied, Vergleich nur mit dem
  vorherigen Lauf (keine „beste Zeit“, W-G16).
- **S1-G5 – GPX ohne Zeiten (S2a):** Die Tabelle verlangt heute Dauer 1 min–12 h. Für „geplante Route“ aus einer GPX
  ohne Zeiten braucht S2a eine additive Lockerung (z. B. Dauer null nur bei `gpx_import`) – Entscheidung mit S2a.

**Nach der Wächter-Prüfung (16.10.2026, `waechter-s1.md`, „bedingt freigabefähig“) – alle Auflagen in diesem PR:**

- **H1 – Stillstand mit GPS-Rauschen:** Ein Punkt zählt erst als neue Position ab max(3 m, 1 × gemeldete
  Genauigkeit) (`ROUTE_FILTER.accuracyMoveFactor`). Bewegung wird nicht mehr je Abschnitt, sondern über ein
  gleitendes Zeitfenster von 20 s auf geglätteten Positionen entschieden (`ROUTE_MOTION`: Mittel über bis zu 5 Punkte
  je Seite, symmetrisch, am Rand kürzer – gerade Strecken bleiben exakt; neue Funktionen `smoothPositions`,
  `motionSegments`). Distanz, Kilometerzeiten und die Warnung rechnen mit den geglätteten Positionen, Höhenmeter
  zählen nur in Bewegung (`elevationGain(points, sport)`). Tests: 10 min Stillstand bei 1 Hz, Genauigkeit 8 m,
  Rauschen σ 2/3/4/6 m (je 3 Läufe, Laufen/Gehen/Rad) → Distanz ≤ 20 m, Bewegung ≤ 30 s, Höhenmeter ≤ 2, keine
  Warnung; echtes Gehen mit 4 km/h und Rauschen bleibt (95–110 % der Distanz); Ampel-Halt 60 s wird Pause
  (das Fenster verwischt Anfang/Ende um je bis zu 10 s – kurze Halte unter ca. 20 s zählen als Bewegung).
- **M1 – Ausreißer am Anfang:** Passen 5 als Sprung verworfene Punkte zueinander (`ROUTE_FILTER.reanchorPoints`) und
  wurden bis dahin weniger Punkte behalten, wird der Anfang verworfen und neu verankert. Ausreißer mitten im Lauf
  bleiben wie bisher ein einzelner verworfener Punkt. Tests: 2-km-Ausreißer als erster bzw. als zwei erste Punkte →
  Distanz auf 1 % genau.
- **M2 – Douglas-Peucker:** O(n)-Vorab-Ausdünnung (radial, Toleranz) und bei Gleichstand der Punkt nahe der Mitte
  (ausgewogene Teilung); Längengrade über ±180° fortlaufend (N6). Test: exakter Zickzack mit 50.000 und 100.000 Punkten
  unter 3 s (vorher ca. 58 s), deterministisch.
- **M3 – verknüpfter Eintrag passt zur Strecke (sichere Variante a, Gründer-Frage S1-G6):** neue Prüfung
  `private.session_log_fits_route` (= `sessionLogFitsRoute` in Core, `TRACKED_ROUTE_LOG_MATCH`): Ausdauer derselben
  Art, Tag des Beginns bis +1, Distanz höchstens 10 % bzw. 100 m daneben, Dauer zwischen Bewegungszeit − 5 min und
  Gesamtdauer + 5 min. Gilt beim Verknüpfen (`save_tracked_route`) und bei jeder Änderung des Eintrags
  (`save_session_log`, Meldung „Der Eintrag passt nicht mehr zur verknüpften Strecke.“ ohne Werte). Die App muss den
  Eintrag beim Speichern aus der Strecke befüllen.
- **M4 – Tagesfenster:** Grenztests −1 (abgelehnt), 0 und +1 (ok), +2 (abgelehnt) in pgTAP 42.
- **N2:** `save_tracked_route` erhöht beim Setzen der Herkunft die `revision` des Eintrags (andere Geräte sehen die
  Änderung). Folge für S1 App: nach `save_tracked_route` den Eintrag neu laden, sonst meldet das nächste Ändern einen
  Konflikt (sicher: die Fassung bleibt als Entwurf).
- **N4:** `toGpx` überspringt Punkte mit NaN/Infinity oder außerhalb ±90/±180, lässt Höhen außerhalb −1.000…10.000 m
  weg und formatiert fest (`toFixed`, nie Exponent-Schreibweise; `ROUTE_GPX`).
- **N3 (dokumentiert):** Eine Wiederholung kann selbst Favorit werden und wiederholt werden (Kette). `compareAttempts`
  vergleicht nur direkte Wiederholungen – unkritisch; die App zeigt den Vergleich je Favorit.
- **N5 (dokumentiert):** Den Namen zählt Zod in UTF-16-Einheiten, SQL in Code-Points (Zod strenger – sichere Richtung);
  eine Notiz aus Leerzeichen und ein Name mit U+200B am Rand werden angenommen (wie `String.prototype.trim()`).
- **N6:** Vereinfachung über die Datumsgrenze behoben (siehe M2). Der Begrenzungsrahmen springt dort weiter über
  −180/180 – die Karte in S2a muss das beachten. Polyline-Rundung `Math.round` (halbe Werte Richtung +∞) liegt
  innerhalb der Genauigkeit.
- **Zahlen:** Core 4.396 → 4.554 (routes 134, db-sync +24); pgTAP 42 jetzt 127 Tests, alle **36 Dateien grün, 1.958
  Tests**.

| Nr. | Gegenprobe zu den Auflagen                              | Rote Tests                      |
| --- | ------------------------------------------------------- | ------------------------------- |
| V1  | H1: Bewegung je Abschnitt ohne Zeitfenster und Glättung | 6 (`track`)                     |
| V2  | H1: Höhenmeter auch im Stehen                           | 4 (`track`)                     |
| V3  | H1: Stillstand-Schwelle ohne Genauigkeit                | 1 (`track`)                     |
| V4  | M1: kein Neuverankern                                   | 2 (`track`)                     |
| V5  | M2: Gleichstand → erster Punkt (alt)                    | 2 (`simplify`)                  |
| V6  | M3: Core-Abgleich ohne Distanz                          | 2 (`schema`)                    |
| V7  | N4: GPX ohne Punkt-Prüfung                              | 1 (`gpx`)                       |
| V8  | N6: Projektion ohne Längen-Fortlauf                     | 1 (`simplify`)                  |
| V9  | Distanz-Spielraum 20 % nur im Core                      | 1 (`db-sync`)                   |
| W1  | M3: `save_session_log` ohne Abgleich mit der Strecke    | 5 (pgTAP 42)                    |
| W2  | M3: Verknüpfen ohne Distanz/Dauer-Abgleich              | 6 (42) + 1 db-sync              |
| W3  | M4: Fenster −3 bis +30 Tage (Wächter-Gegenprobe)        | 2 (42) + 1 db-sync              |
| W4  | M4: Fenster bis +2 statt +1                             | 1 (42) + 1 db-sync              |
| W5  | N2: revision steigt nicht                               | 9 (42, Folgefehler) + 1 db-sync |

V3 war zunächst grün, weil das Zeitfenster dieselben Fälle als zweite Sicherung abfängt; ein eigener Filter-Test
macht die Schwelle jetzt direkt sichtbar.

**Gründer-Frage S1-G6 – verknüpfter Eintrag ändern:** Voreinstellung (sicher, Variante a): Änderungen, die nicht mehr
zur Strecke passen (Art, Tag außerhalb Beginn…+1, Distanz/Dauer außerhalb des Spielraums), werden abgelehnt.
Alternative b: Bei einer solchen Änderung den Verweis lösen und die Herkunft auf „manual“ setzen (Eintrag frei
änderbar, Strecke bleibt ohne Eintrag).

**Offen für S1 App (nach S0/W-G13, Development Build):** Aufzeichnung (`expo-location`, Vordergrund-Dienst),
Rohpunkte verschlüsselt im `protected-store` (alle 30 s, nach dem Speichern löschen), Erklär-Bildschirm vor der
System-Abfrage, `summarizeTrack` → `toTrackedRoutePayload`, Speichern über die Warteschlange (`save_session_log` zuerst,
dann `save_tracked_route`), Liste „Meine Strecken“ mit Linien-Skizze, GPX-Export als Datei, Löschen einzeln/alle,
Vergleich mit `compareAttempts`/`attemptCompareText`, Testmodus `localDb.trackedRoutes` mit denselben Regeln
(`local-rules.ts`) inkl. Demo-Aufzeichnung im Web (W-G14), Supabase-Modus lesen.

### Umsetzungsstand S0 + S1 App (20.10.2026, Etappen E3–E6)

Umgesetzt im Rahmen von `docs/PLAN-EINKAUFEN-AUSDAUER.md` (Abschnitt „Umsetzungsstand E3–E6“): native Module
(expo-location mit Vordergrund-Dienst, expo-task-manager, react-native-webview für die Karte, view-shot + expo-sharing),
**W-G13 entschieden: „Beim Verwenden“ + Vordergrund-Dienst, kein `ACCESS_BACKGROUND_LOCATION`**, Aufzeichnen mit
Erklär-Bildschirm, Wiederaufnahme, Speichern über Tagebuch- und Strecken-Warteschlange, „Meine Strecken“ (dort „Meine
Läufe“), Auswertung mit Karte (vorgezogener Teil von S2a: Start/Ziel, Attribution; GPX-Import bleibt S2a),
Höhenprofil (additive Spalte), GPX-Export, Vergleich, Testmodus und Demo-Aufzeichnung im Web (W-G14). Das Gerätetest-
Ergebnis von S0 (Akku 60 min, Funkloch, Sperrbildschirm) steht noch aus (Test-APK, HANDY-ANLEITUNG Teil 9b).

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
  **Ausnahme (25.10.2026):** Live-Begleitung mit Notfallkontakt – nur aktuelle Position, nur während der Einheit,
  geheimer Link mit Ablauf (Abschnitt 21, `CLAUDE.md`).
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

---

## 21. Nachtrag (25.10.2026): Live-Begleitung / Notfallkontakt – Plan, noch nicht umgesetzt

**Status:** Regel in `CLAUDE.md` („Kein Teilen, keine Community“, Ausnahme 25.10.2026) und dieser Plan. **Noch kein
Code.** Umsetzung erst nach Klärung der offenen Fragen (21.10) – je Etappe ein Pull Request mit Wächter-Prüfung.
Gründer-Entscheidung 25.10.2026: „Notfallkontakt Ausnahme ja“.

### 21.1 Worum es geht

Wer allein läuft oder Rad fährt (abends, im Wald, lange Touren), soll einer Vertrauensperson zeigen können, **wo er
gerade ist** – nur während der Einheit, nur auf eigenen Tipp, ohne Gesundheitsdaten. Die Vertrauensperson braucht
**keine App und kein Konto**: Sie bekommt einen geheimen Link und sieht im Browser eine Karte mit der letzten Position.
Das ist eine Sicherheitsfunktion, keine Community: keine Profile, kein Feed, keine Strecken-Historie.

**Abgrenzung v1:** kein automatischer Alarm an Kontakte (bräuchte bezahlten SMS-Dienst und Haftungsprüfung), keine
Sturzerkennung, kein Notruf-Ersatz, keine Live-Begleitung ohne laufende Aufzeichnung, keine echte Begleitung aus dem
Browser-Web-Export (dort gibt es keine echte Aufzeichnung, W-G14 – im Testmodus nur Demo).

### 21.2 Ablauf für die Person (App)

1. **Einstellungen → Notfallkontakte:** bis zu 3 Kontakte (Name, Telefonnummer und/oder E-Mail), einer als
   „Standard“. Übernahme aus dem Adressbuch nur als einmalige Auswahl über den System-Kontaktwähler (keine
   Dauer-Berechtigung) – oder eintippen. Text der Nachricht anpassbar. Fester Hinweis: „Im Notfall immer 112 anrufen
   (Schweiz: 144 Sanität oder 112).“
2. **Aufzeichnen – vor dem Start oder während der Aufzeichnung:** Schalter „Live-Begleitung“ → Blatt mit Kontakten
   zum Antippen, geplante Dauer (aus der Plan-Einheit vorbelegt, sonst 60 min), Knopf „Link teilen“ → System-Teilen-
   Dialog (WhatsApp, SMS, Signal, E-Mail …) mit Text „Ich bin laufen. Hier siehst du live, wo ich gerade bin (bis ca.
   19:45): https://…/begleitung#t=…“. Ohne gewählten Kontakt geht es auch (Link selbst teilen) – die Kontakte sind
   nur Abkürzung für das Teilen und den SOS-Knopf.
3. **Während der Einheit:** Banner „Live-Begleitung aktiv · Anna sieht deinen Standort“ (immer sichtbar, zusätzlich in
   der Benachrichtigung des Vordergrund-Dienstes „Aufzeichnung läuft · Live-Begleitung an“). Knöpfe **SOS** und
   **Beenden**.
4. **Positions-Updates:** alle 30 s (wählbar 15/30/60 s), nur wenn sich die Position um ≥ 20 m geändert hat oder 60 s
   vergangen sind (Herzschlag „lebt noch“). Bei Funkloch wird nur die **neueste** Position nachgereicht (keine
   Historie).
5. **Ende:** „Angekommen“ (im Banner oder beim Beenden der Aufzeichnung) setzt den Status `arrived`; der Kontakt sieht
   „Karsten ist angekommen (19:32)“ ohne Karte. Pause der Aufzeichnung → Status „pausiert“. Aufzeichnung beenden oder
   verwerfen → Sitzung endet automatisch.
6. **SOS:** Auswahl-Blatt „SMS an Anna“, „WhatsApp an Anna“, „Anna anrufen“, „112 anrufen“. SMS/WhatsApp öffnen die
   System-App mit vorausgefülltem Text „SOS – ich brauche Hilfe. Mein letzter Standort: https://www.openstreetmap.org/?mlat=…&mlon=…
   (Stand 19:21)“. **Senden tippt die Person selbst.** Geht auch ohne Live-Begleitung und ohne Verbindung zu unserem
   Server (SMS braucht nur Mobilfunk).
7. **„Kein Lebenszeichen“-Erinnerung (optional, nur an die Person):** lokale Benachrichtigung, wenn die Aufzeichnung
   die geplante Dauer um X min (Standard 30) überschreitet: „Alles in Ordnung? ‚Mir geht’s gut‘ oder SOS öffnen.“
   **Kein** automatischer Versand an Kontakte in v1.

### 21.3 Ablauf für den Kontakt (Browser)

- Seite **`/begleitung`** in `apps/web` (Next.js, Vercel), Token im Link-Fragment `#t=…` (F5) bzw. als Pfad
  `/begleitung/[token]`. Keine Anmeldung.
- Zeigt: Anzeigename, Sportart-Symbol, „läuft seit 25 Min“, „zuletzt aktualisiert vor 20 s“, Karte (MapLibre GL bzw.
  Leaflet, Kacheln laut W-G11, Attribution „© OpenStreetMap-Mitwirkende“) mit **einem** Punkt und Genauigkeitskreis,
  Knopf „In Karten-App öffnen“, Hinweis „Bei Sorge anrufen. Im Notfall 112.“
- **Nicht** angezeigt: Puls, kcal, Gewicht, Pace, Distanz, Strecken-Linie, frühere Positionen, gespeicherte Strecken.
- Aktualisierung alle 20 s per Abfrage (kein Websocket, kein Supabase-Realtime für `anon`), pausiert, wenn der Tab im
  Hintergrund ist. Warnung, wenn die letzte Position älter als 3 min ist: „Seit 4 Min keine neue Position – evtl.
  Funkloch oder Akku leer.“
- Zustände: aktiv, pausiert, angekommen, beendet/abgelaufen („Diese Live-Begleitung ist beendet.“ – ohne Ort), Link
  ungültig (gleiche Meldung wie abgelaufen, damit sich Tokens nicht ausprobieren lassen).
- `noindex, nofollow` (Meta + `X-Robots-Tag`), `robots.ts` sperrt `/begleitung`, `Referrer-Policy: no-referrer`,
  `Cache-Control: no-store`, keine Analytics, keine Cookies, kein Vercel Web Analytics auf dieser Route, Schrift lokal.

### 21.4 Datenmodell (Migration, nur additiv, RLS, pgTAP)

```
emergency_contacts            -- nur falls F1 = „im Konto“; sonst nur verschlüsselt auf dem Gerät
  id uuid pk, user_id uuid → auth.users on delete cascade,
  name text 1–60, phone text (E.164, optional), email text (optional), is_default bool,
  created_at, updated_at;  check: phone oder email; höchstens 3 je Person (Trigger)
  RLS: select/insert/update/delete nur user_id = auth.uid()

live_sessions
  id uuid pk, user_id uuid → auth.users on delete cascade,
  token_hash bytea unique (SHA-256 des 32-Byte-Tokens; Klartext nie gespeichert),
  display_name text 1–30, sport text (run|bike|walk),
  status text (active|paused|arrived|ended), started_at, planned_end_at, ended_at,
  expires_at timestamptz (Ende + 2 h bzw. Start + 12 h, das Frühere), update_interval_s smallint 15–60
  RLS: nur Besitzer select; Schreiben nur über RPCs; anon: nichts. Höchstens 1 aktive Sitzung je Person.

live_positions                -- genau EINE Zeile je Sitzung (überschreiben, keine Historie)
  session_id uuid pk → live_sessions on delete cascade,
  lat numeric(8,5), lon numeric(8,5) (≈ 1 m), accuracy_m smallint, recorded_at timestamptz
  RLS: Besitzer select; Schreiben nur über RPC; anon: nichts.
```

- **Nur die letzte Position** wird gespeichert (Upsert) – serverseitig gibt es keine Spur, die durchsickern könnte.
- **RPCs** (security definer, fester `search_path`):
  - `start_live_session(display_name, sport, planned_minutes)` → Token mit `gen_random_bytes(32)`, speichert nur den
    Hash, gibt den Klartext **einmal** zurück. Nur `authenticated`, nur wenn keine andere Sitzung aktiv ist.
  - `push_live_position(session_id, lat, lon, accuracy)` → nur Besitzer, nur Status active/paused, nicht abgelaufen;
    höchstens 1 Update je 10 s (sonst ignoriert), Plausibilität der Koordinaten.
  - `set_live_status(session_id, status)` → paused/active/arrived/ended; `arrived`/`ended` löschen die Position sofort
    und setzen `expires_at`.
  - `rotate_live_token(session_id)` → „Link neu erzeugen“, altes Token sofort ungültig.
  - `get_live_view(token_hash, ip_hash)` → nur `service_role`; prüft Hash und Ablauf; gibt nur `display_name, sport,
status, started_at, lat, lon, accuracy_m, recorded_at` zurück (bei arrived/ended **ohne** Koordinaten).
    **Rate-Limit** wie Warteliste (HMAC-Hashes, nach 1 h gelöscht): je IP max. 10 Abfragen/min, je Sitzung max.
    30/min. Aufruf nur über die Next.js-Route `/api/begleitung` (Service-Rolle), damit `anon` die Tabellen und RPC
    gar nicht braucht.
- **Automatisch löschen:** `private.purge_live_sessions()` löscht Positionen abgelaufener Sitzungen und Sitzungen 24 h
  nach Ablauf (nur Metadaten ohne Ort, für „Link abgelaufen“). Lauf per **pg_cron alle 5 min** (Muster wie
  `20261018200300_live_adjust_rpcs.sql`, überspringen ohne pg_cron) **plus** Sicherheitsnetz: jede RPC filtert
  Abgelaufenes ohnehin aus; zusätzlich GitHub Action `live-cleanup.yml` stündlich (wie `waitlist-cleanup.yml`).
- **Kein Logging von Koordinaten:** `log_parameter_max_length_on_error = 0` bleibt; Fehlermeldungen ohne Werte;
  Next.js-Route loggt weder Body noch Token; Test, der Logs/Fehler auf Koordinaten prüft (wie Abschnitt 13).
- **Export/Löschung:** Datenexport enthält Kontakte (falls im Konto) und laufende `live_sessions` (ohne Token-Hash);
  Konto löschen → Kaskade. Positionen sind nach dem Ende ohnehin weg.
- **pgTAP:** fremde Sitzung unsichtbar, `anon` liest nichts, falsches/abgelaufenes Token → gleiche leere Antwort,
  arrived/ended ohne Koordinaten, 4. Kontakt abgelehnt, zweite aktive Sitzung abgelehnt, Ratenbremse, Purge löscht.

### 21.5 Core (`packages/core/src/live/`)

Reine Logik mit Vitest: `liveSessionExpiry`, `shouldPushPosition` (Abstand/Herzschlag), `roundLivePosition`
(5 Nachkommastellen), `positionStaleness` (frisch/alt/sehr alt), `buildLiveShareText`, `buildSosText` (OSM-Link,
kein Gesundheitswert), `noSignOfLifeDue`, Zod-Schemas für Kontakt (E.164, E-Mail) und RPC-Antworten. Grenzwerte in
`constants.ts` mit Kommentar: `LIVE_LINK_GRACE_H = 2`, `LIVE_SESSION_MAX_H = 12`, `LIVE_MAX_CONTACTS = 3`,
`LIVE_PUSH_INTERVAL_S = 30`, `LIVE_STALE_WARN_S = 180`, `LIVE_NO_SIGN_OF_LIFE_GRACE_MIN = 30`.

### 21.6 App (`apps/mobile`)

- **Positionen aus dem bestehenden Aufzeichnungs-Task senden** (`expo-task-manager`, Vordergrund-Dienst aus S1): Der
  Task hat die Punkte ohnehin; ein Zusatz prüft `shouldPushPosition` und ruft die RPC. **Keine neue Berechtigung**,
  kein `ACCESS_BACKGROUND_LOCATION` (W-G13 bleibt). Fehler beim Senden bremsen die Aufzeichnung nie.
- Neu: `einstellungen/notfallkontakte.tsx`, Blatt „Live-Begleitung“ in `ausdauer/aufzeichnen.tsx`, Banner +
  SOS-Blatt im Lauf-Zustand, „Angekommen“ im Speichern-Schritt, lokale Erinnerung (`expo-notifications`).
- SOS über `Linking.openURL` mit `sms:`, `whatsapp://send` (Ersatz `https://wa.me/`), `tel:`. Kein eigener Versand.
- Testmodus/Web: Die Demo-Aufzeichnung startet eine Demo-Begleitung, damit die Begleit-Seite in der Vercel-Vorschau
  testbar ist.
- Texte in `i18n/de-endurance.ts` (Abschnitt `live`), Banner als `accessibilityLiveRegion`.

### 21.7 Etappen

| Etappe  | Inhalt                                                                                          | PR      |
| ------- | ----------------------------------------------------------------------------------------------- | ------- |
| **LB0** | Regel (CLAUDE.md), Plan, Mockups (dieser Nachtrag)                                              | 1       |
| **LB1** | Core `live/` + Zod + Konstanten + Tests                                                         | 1       |
| **LB2** | Migration (Kontakte je nach F1, `live_sessions`, `live_positions`, RPCs, Purge, pg_cron), pgTAP | 1       |
| **LB3** | Web: `/api/begleitung` + Seite `/begleitung` (Karte, Zustände, noindex) + Playwright            | 1       |
| **LB4** | App: Notfallkontakte, Live-Begleitung im Aufzeichnen, Banner, SOS, Angekommen, Erinnerung       | 1–2     |
| **LB5** | Store/Recht: Datenschutzerklärung, Store-Angaben, DSFA-Ergänzung, Gerätetest draußen            | Gründer |

### 21.8 Risiken

1. **Akku:** zusätzlicher Netzverkehr. _Gegenmittel:_ nur bei ≥ 20 m Bewegung bzw. 60-s-Herzschlag, kleine Pakete,
   Intervall wählbar, Hinweis „braucht etwas mehr Akku“; im Gerätetest messen (60 min, Vergleich mit/ohne).
2. **Android 14+ / Hintergrund:** Ohne `ACCESS_BACKGROUND_LOCATION` läuft das Senden nur, solange der
   Vordergrund-Dienst (Typ `location`) aktiv ist – genau unser Fall. Hersteller-Energiesparmodi (Samsung, Xiaomi …)
   können trotzdem drosseln → Hinweis „Akku-Optimierung für Alpha5 ausschalten“. iOS: „Beim Verwenden“ + blauer
   Standort-Hinweis reicht, solange die Aufzeichnung läuft.
3. **Store-Richtlinien:** Play Console → Datensicherheit „Standort (genau) – mit anderen geteilt: ja, auf Wunsch der
   Person“; Erklärung Vordergrund-Dienst Typ `location` (ggf. Video). Apple: Begründungstext der Standortberechtigung
   um „Live-Begleitung“ ergänzen, App Privacy „Precise Location“ entsprechend.
4. **Missbrauch (heimliches Orten):** _Gegenmittel:_ nur während sichtbarer Aufzeichnung, Banner + Benachrichtigung,
   Ablauf, höchstens 12 h, kein Dauer-Tracking, keine Begleitung ohne Tipp.
5. **Weitergeleiteter Link:** _Gegenmittel:_ kurzer Ablauf, „Link neu erzeugen“, Hinweis „nicht weiterleiten“.
6. **Falsche Sicherheit / Haftung:** Funkloch, Akku leer. _Gegenmittel:_ „zuletzt aktualisiert“ groß, Warnung bei alter
   Position, „kein Notruf-Ersatz“, juristische Prüfung.
7. **Kosten:** Kachel-Abrufe durch Kontakte und Vercel-Funktionen. _Gegenmittel:_ eine Karte, Abfrage 20 s, Pause im
   Hintergrund, Ratenbremse.
8. **Daten Dritter (Kontakte):** _Gegenmittel:_ bevorzugt nur auf dem Gerät (F1), sonst minimal + RLS, Löschung,
   Erwähnung in der Datenschutzerklärung.

### 21.9 Datenschutz-Kurzbewertung

- Standort ist kein Art.-9-Datum (W-G15); die Weitergabe geschieht **auf ausdrücklichen Wunsch der Person** an von ihr
  gewählte Empfänger (Vertrag, Art. 6 Abs. 1 b). Kontakte bekommen den Link nur von der Person selbst; unser Server
  schickt nichts an Dritte.
- Gesundheitsdaten fließen nicht hinein (eigene Tabellen, die Lese-Funktion liest nur Sitzung und Position).
- DSFA-Ergänzung „Live-Begleitung“ und Datenschutzerklärung (KONZEPT 14) vor dem Livegang.

### 21.10 Offene Fragen an die Gründer

- **F1 Kontakte speichern:** nur auf dem Gerät (verschlüsselt, gehen beim Handywechsel verloren) oder im Konto (RLS,
  Sync)? – _Empfehlung:_ nur auf dem Gerät (Datensparsamkeit, Daten Dritter nicht auf dem Server).
- **F2 Gratis oder Premium?** – _Empfehlung:_ **Gratis** (Sicherheitsfunktion, keine KI, geringe Kosten).
- **F3 Kurze Spur (letzte 5 min) für den Kontakt?** – _Empfehlung:_ nein, nur aktueller Punkt + Genauigkeitskreis.
- **F4 Nach „Angekommen“:** Link zeigt noch bis 2 h „angekommen“ (ohne Ort)? – _Empfehlung:_ ja, Ort sofort gelöscht.
- **F5 Token im Link-Fragment (`#t=…`) statt im Pfad?** Hält das Token aus Server-/Vercel-Logs. – _Empfehlung:_ ja.
- **F6 Automatische Warnung an Kontakte** (keine Bewegung, Sturz, Zeit überschritten) mit bezahltem EU-SMS-Anbieter –
  ja/nein/später? – _Empfehlung:_ später, erst nach Rechts- und Haftungsprüfung.
- **F7 Sportarten und Dauer:** alle Aufzeichnungs-Arten (Laufen, Rad, E-Bike, Gehen), Höchstdauer 12 h? –
  _Empfehlung:_ ja.
- **F8 Anzeigename:** Vorname aus dem Profil vorbelegen? – _Empfehlung:_ ja, änderbar, max. 30 Zeichen.
- **F9 Domain für den Link:** kurze, vertrauenswürdige Adresse (eigene Domain statt `*.vercel.app`), damit Kontakte
  den Link nicht für Betrug halten.

**Mockups (LB0):** Aufzeichnen mit Blatt „Live-Begleitung“, Lauf mit Banner/SOS/Beenden, Begleit-Seite im Browser,
Einstellungen → Notfallkontakte (PNG-Tafeln, nicht im Repository).
