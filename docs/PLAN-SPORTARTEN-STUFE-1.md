# Sportarten Stufe 1 – Hyrox, Wandern/Bergwandern, Indoor-Rudern, Yoga/Pilates/Mobility

Gründer-Freigabe des Umfangs 25.10.2026 („Einbauen“). **Plan samt Mockups freigegeben am 27.10.2026 („Sportarten
Stufe 1 passt“)** – alle Empfehlungen aus Abschnitt 10 gelten als entschieden. Umsetzung in zwei Schritten: erst
Datenbank-Grundlage (alle Enums, Spalten, Server-Fassungen, Zod), danach Core, App und Inhalte je Sportart.

Anders als Stufe 2 (`docs/PLAN-SPORTARTEN.md`: nur eintragen, Uhr, kcal, Belastung) bekommen diese vier Sportarten
**echtes, strukturiertes Training** – aber immer über die vorhandenen Bausteine: Ziele und Plan-Engine, Wettkampfplan
(Phase 10), Ausdauer-Aufzeichnung (Strecken, 10.1), Workout-Bibliothek mit Timer (5.1), Übungsbibliothek, Schon- und
Reise-Modus (4.3). Alles **gratis und ohne KI** (Abschnitt 8).

Mockups (390 px, nur zur Abstimmung, nicht im Repo): Ziel „Hyrox-Wettkampf“, Hyrox-Woche + Stations-Einheit,
Wandern-Aufzeichnung/Auswertung mit Höhenprofil und Bergwander-Hinweis, Rudern Intervall + Ergebnis, Yoga/Mobility-
Player, Karten auf „Heute“.

## 1. Ziele

| Sportart                      | Was die Person bekommt                                                                                                                                    | Kern-Wiederverwendung                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Hyrox**                     | Wettkampfplan rückwärts ab Renntag: Lauf-Einheiten + Stations-Einheiten (8 Stationen) + Kombi-Einheiten („1 km + Station“), Ampel, Countdown, Phasen-Band | Wettkampf (WP1–WP5), Kraft-Engine, Koppel-Logik (Triathlon), Intervall-Timer |
| **Wandern / Bergwandern**     | GPS-Aufzeichnung mit Höhenmetern, Höhenprofil, Gehzeit-Schätzung, Bergwander-Sicherheitshinweise, kcal, Uhr-Import                                        | Strecken aufzeichnen (S1), Höhenprofil, Wetter, Live-Begleitung, Schuhe      |
| **Indoor-Rudern**             | Rudern als planbare Ausdauer-Art (bei Rudergerät im Equipment): locker, Intervalle, Tempo; Split je 500 m, Watt, Intervall-Ergebnis; Uhr-Import           | Ausdauer-Engine (10 %, 80/20, Deload), Intervall-Timer, Workout-Bibliothek   |
| **Yoga / Pilates / Mobility** | Geführte Routinen zum Mitmachen (Pose für Pose mit Zeit, Seitenwechsel, Bild), auch als Vorschlag an Ruhetagen und in der Erholungswoche                  | Workout-Bibliothek + Timer, Übungsbibliothek, Sicherheitsfilter, Schon-Modus |

Nicht-Ziele (v1): keine Echtzeit-KI, kein Ranking/Vergleich mit anderen, keine offiziellen Hyrox-Zeiten oder
-Ergebnisse, keine Bluetooth-Kopplung an Rudergeräte, keine Kletter-/Alpintouren (SAC T4+), kein Live-Video.

## 2. Einbindung in vorhandene Strukturen

### 2.1 Hyrox

**Format** (offizielles Regelwerk, je Saison prüfen): 8 × (1 km Laufen + 1 Station) – SkiErg 1000 m, Schlitten
schieben 50 m, Schlitten ziehen 50 m, Burpee-Weitsprünge 80 m, Rudern 1000 m, Farmer's Carry 200 m, Sandsack-
Ausfallschritte 100 m, Wall Balls 100 Wdh. Gewichte je Division und Geschlecht → `HYROX_FORMAT` in `constants.ts`
(Quelle: HYROX Rulebook der laufenden Saison; **nicht** aus dem Gedächtnis übernehmen – Fachprüfung).

- **Ziel:** Hyrox ist eine **Ausdauer-Disziplin** (`ENDURANCE_DISCIPLINES` + `hyrox`) und eine **Wettkampf-
  Disziplin** (`COMPETITION_DISCIPLINES` + `hyrox`). Auswahl im Onboarding/Ziel-Wechsel unter „Ausdauer → Hyrox-
  Wettkampf“ und in „Mein Wettkampf“. Nebenziel wie bisher über `GOAL_COMBINATIONS` (z. B. Hyrox + Muskelaufbau).
- **Plan-Engine:** Hyrox nutzt den Makrozyklus des Wettkampfplans (`macroCycle`: Basis → Aufbau → Spitze → Tapering →
  Rennwoche → Erholung) und `competitionFeasibility` (Ampel Passt/Knapp/Zu kurz/Nicht möglich, Vorschläge „späteres
  Datum“, „ohne Wettkampf weiter“). Neue Einheit-Arten in der Woche:
  1. **Lauf-Einheiten** – unverändert aus der Lauf-Logik (locker, langer Lauf ≤ 90 min, Fahrtspiel, Tempo, Intervalle
     1 km), Distanz-Richtwert nur mit Referenzzeit.
  2. **Stations-Einheit** = Kraft-Einheit mit neuem Fokus `hyrox_stations` (`SESSION_FOCUSES` + Wert): Übungen aus der
     Übungsbibliothek (Stations-Übungen und Kraftübungen für die Stationen: Kniebeuge, Ausfallschritt, Kreuzheben,
     Rudern, Schieben/Ziehen, Rumpf). Progression wie Kraft (doppelte Progression), 48-h-Regel Kraft gegen Kraft.
  3. **Kombi-Einheit** („Hyrox-Kombi“, `workout_type` + `hyrox_combo`): EINE Einheit mit Teilen im Wechsel – z. B.
     4 × (1 km locker-zügig + Station halbe Menge) – nach dem Muster des Koppeltrainings Rad → Lauf (`brick`,
     `COMPETITION_TRIATHLON.brick`). Schritte in `planned_sessions.workout_steps` mit neuem Schritt-Typ `station`.
     Gilt als **harte** Einheit (80/20, `hard_endurance_48h`, nie neben langem Lauf oder Bein-Krafttag).
- **Wochenbau (Vorschlag, Werte in `HYROX_PLAN`):** 3 Tage = 1 Lauf + 1 Station + 1 Kombi (ab Aufbau); 4 Tage = 2 Lauf +
  1 Station + 1 Kombi; 5 Tage = 3 Lauf + 1 Station + 1 Kombi; Einsteiger/vorsichtig in der Basis ohne Kombi. Simulation
  (alle 8 Stationen, reduzierte Mengen) höchstens 1× in der Spitze, nie in den letzten 10 Tagen.
- **10-%-Regel:** gilt für die Lauf-Minuten (inkl. Lauf-Teil der Kombi, wie beim Koppeltraining: Minuten zählen in
  beide Bereiche). Stations-Volumen wächst über die Kraft-Progression (Sätze/Wdh.), Stations-Mengen in der Kombi
  höchstens +10 % je Belastungswoche (`HYROX_PLAN.stationVolumeStep`).
- **Deload:** feste Erholungswochen wie im Wettkampfplan (3 : 1 im Aufbau für Einsteiger); Kraft-Sätze halbiert,
  RPE −2, Lauf 60 %; Kombi entfällt in der Erholungswoche.
- **Gesundheits-Check:** wie Wettkampfplan – nur mit Check, nicht in der Schwangerschaft, mit Arzt-Hinweis keine
  harten Einheiten (Kombi wird lockere „Technik-Kombi“), unter 18 nur Division Open, RPE ≤ 8; ab 65 nur mit
  Bestätigung und ohne Burpee-Weitsprünge (`high_impact`).
- **Equipment:** Viele haben keinen Schlitten/SkiErg. Ersatz-Kette wie bei der Plan-Engine (gleiches Muster → gleicher
  Hauptmuskel, nie schwerer): Schlitten schieben → Ausfallschritt-Gehen mit Gewicht / Laufband-Schieben (aus);
  Schlitten ziehen → Rudern am Band rückwärts gehen; SkiErg → Band-Zug über Kopf + Rudergerät; Wall Balls → Goblet-
  Kniebeuge + Schulterdrücken. Hinweis „Ohne Schlitten – wir ersetzen die Station“ (wie Hinweis „Training ohne
  Geräte“, `planInfoNotices`).
- **Schon-Modus:** Stations-Übungen bekommen `PAIN_REGION_LOAD` (Wall Balls: Knie, Schulter; Burpees: Handgelenk,
  Knie, Sprunggelenk; Farmer's Carry: Handgelenk, unterer Rücken). Kombi-Einheit im Schon-Modus → nur Lauf-Teil oder
  „heute locker“.
- **Reise-Modus:** Stations-Einheit wird mit den Reise-Geräten neu zusammengesetzt (Körpergewicht-Ersatz), Kombi →
  „Lauf + Körpergewicht-Zirkel“.
- **Live-Anpassung (Premium, 4.1):** wie Wettkampfplan – kein Tausch der Erholungswoche, nur lockere Teile senken.
- **Ergebnis:** Renntag → freie Einheit „Hyrox-Rennen“ mit Gesamtzeit und optional 16 Teilzeiten (8 Lauf, 8 Stationen)
  - Roxzone; privat, nur eigener Verlauf.

### 2.2 Wandern / Bergwandern

- **Aufzeichnung:** Gehen ist schon Aufzeichnungs-Sportart (`TRACKED_ROUTE_SPORTS` = run, bike, walk). Wie beim E-Bike
  (Spalte `e_bike`) wählt die Person beim Start **„Gehen | Wandern | Bergwandern“** (`walk_kind`). Sportart bleibt
  `walk` – Summen, Schuhe (Gehen/Wandern), Live-Begleitung, Privatzone beim Teilen, Wetter funktionieren unverändert.
- **Höhe:** Höhenmeter (`elevation_gain_m`) und Höhenprofil (`elevation_profile`) gibt es schon; neu: Abstieg
  (`elevation_loss_m`) und höchster Punkt (`max_altitude_m`) für die Hinweise. Glättung wie `elevation-profile.ts`
  (GPS-Höhe ist ungenau → „ca.“).
- **Gehzeit-Schätzung** (nur Anzeige, für gespeicherte Strecken/GPX vor dem Start): DIN 33466 / DAV-Formel –
  4 km/h horizontal, 300 Hm/h Aufstieg, 500 Hm/h Abstieg; größerer Wert + halber kleinerer; ohne Pausen
  (`HIKING_TIME` in `constants.ts`).
- **kcal:** MET je Anstrengung wie Stufe 2 (`TRAINING_MET.walk` für Gehen; neu `hike` und `mountainHike`), Uhr-Wert
  geht vor. Optional Höhenmeter-Zuschlag (offene Entscheidung 8).
- **Plan:** Wandern erzeugt **keine** geplanten Einheiten (v1). Eine Wanderung ist eine freie Ausdauer-Einheit
  (`cardio_logs.modality = walk`) – sie zählt **nicht** gegen die 10-%-Kette des Plans (wie bisher freie Einheiten).
  Ab 2 h oder 600 Hm Abstieg zählt sie für den **Bein-Hinweis** am Folgetag (`LEG_LOAD_HINT`, Stufe 2).
- **Bergwander-Hinweise** (Karte vor dem Start und in der Auswertung, nie blockierend, Textbausteine
  `HIKING_SAFETY_DE`): Wetter/Gewitter (Wetter-Abfrage gibt es), Umkehrzeit festlegen, Live-Begleitung anbieten,
  Notrufnummern je Land (DE 112, AT Alpinnotruf 140, CH Rega 1414 / 144, IT 118 / 112), Akku, Trinken; ab
  **2.500 m** Höhe: Höhenkrankheits-Hinweis (langsam aufsteigen, Warnzeichen, absteigen); Abstieg/Knie: Stöcke,
  Tempo – im Schon-Modus Knie/Sprunggelenk zusätzlicher Hinweis. Schwierigkeit nach **SAC-Wanderskala** T1–T3 wählbar;
  T4+ → „Alpines Gelände – außerhalb dessen, was die App begleitet“.
- **Gesundheits-Check:** Mit Arzt-Hinweis (`medical_clearance_recommended`) oder Schwangerschaft zusätzlich
  „Bergtouren über 2.500 m vorher ärztlich besprechen“. Kein Verbot, keine Diagnose.
- **Uhr:** Health Connect 37 „Wandern“ → Gehen mit `walk_kind = hike` (heute: „Sonstige“ mit Titel), 63
  „Schneeschuhwandern“ → Gehen/Bergwandern; Route über `save_wearable_route` wie bei Laufen.

### 2.3 Indoor-Rudern

- **Neue Ausdauer-Art `row`** (`ENDURANCE_MODALITIES` + `row`, Postgres-Enum per `add value`): planbar als
  Ausdauer-Tag („Ausdauer: Rudern“), **nur** wenn `rowing_machine` im Equipment (zu Hause oder Studio). Keine GPS-
  Aufzeichnung (CHECK in `tracked_routes` bleibt run/bike/walk).
- **Plan-Engine:** Varianten wie Rad/Schwimmen (`MULTISPORT_TEXTS_DE` + `row`): locker (Schlagzahl 18–22),
  Erholung, lang, Fahrtspiel, Tempo, Intervalle (z. B. 4–8 × 500 m, 30/30, 3–5 × 1000 m), Technik. 10-%-Regel über
  die Ausdauer-Minuten der Woche, 80/20, Deload 60 %, harte Einheiten erst ab Aufbau, Start-Deckel je Einheit
  (`ENDURANCE_START_RULES`) – alles unverändert, nur eine Art mehr. Intervall-Timer (WP4) zeigt die Schritte.
- **Werte:** Eingabe/Anzeige Distanz + Zeit → **Split je 500 m** (`/500 m`), optional Watt (Concept2-Formel
  `P = 2,80 / (s/m)³`), Schlagzahl. Intervall-Ergebnis: je Wiederholung Distanz, Zeit, Split (höchstens 30).
- **kcal:** `TRAINING_MET.endurance.row` (Compendium) nach Anstrengung; mit Watt optional Concept2-Kalorienformel
  (offene Entscheidung 8).
- **Uhr:** Health Connect 54 „Rudergerät“ → Ausdauer `row` mit Dauer/Distanz (falls vorhanden); 53 „Rudern“ (Boot)
  bleibt Sportart „Kajak/Kanu“-nah als „Sonstige Sportart“ wie bisher. Concept2-Logbuch und Bluetooth-Monitor später.
- **Schon-Modus:** Rudern belastet unterer Rücken, Knie, Handgelenk (`PAIN_REGION_LOAD`) → bei „mittel/stark“ statt
  Rudern Rad-Ergometer oder Gehen vorschlagen. **Reise-Modus:** Hotel-Gym = Rudergerät möglich, sonst Ersatz durch
  Gehen/Laufen.
- **Technik:** Kurztext + Bild „Beine – Rumpf – Arme, zurück Arme – Rumpf – Beine“, Dämpfer-Hinweis 3–5.

### 2.4 Yoga / Pilates / Mobility

- **Routinen = Workouts** in der vorhandenen Workout-Bibliothek (`content/workouts`, Tabelle `workouts`): neue
  Kategorien `yoga`, `pilates` (`mobility` gibt es), neues Format **`flow`** – Pose für Pose nach Zeit, ohne Pausen-
  Bildschirm, mit Seitenwechsel („rechts / links“) und kurzem Übergangstext. Sterne 1–5, Dauer 5–45 min, Equipment
  (Matte, Block, Band, Stuhl).
- **Posen/Übungen** kommen in die Übungsbibliothek (Muster `mobility`, `balance`, `core_*`, Belastungsart Zeit) mit
  Merkmalen (`CAUTION_TAGS`): lange Rückenlage, Rumpfbeugung, Drehung, Boden, Über-Kopf, tiefe Hüftbeugung und neu
  **`inversion`** (Kopf unter Herzhöhe). Damit greifen alle Sicherheitsfilter automatisch (vorsichtiger Plan,
  Schwangerschaft, Fit im Alter, Osteoporose, Schon-Modus) – eine Pose, die gesperrt ist, wird gegen eine erlaubte
  Variante getauscht (Stuhl-/Wand-Variante) oder entfällt; fehlen zu viele, zeigt die App die Routine nicht an.
- **Player:** Timer-Bildschirm der Workout-Bibliothek in „Flow“-Ansicht: großes Bild, Name, Restzeit-Ring, nächste
  Pose, Seite, Atem-Hinweis als Text; Pause/Weiter, „Pose überspringen“, Bildschirm bleibt an, Ansage für
  Bildschirmleser, Vibration beim Wechsel. Offline (Inhalte im Cache).
- **Erholungstage:** Auf „Heute“ an trainingsfreien Tagen und in der Erholungswoche eine Karte „Erholungstag:
  Mobility 15 min?“ (Vorschlag aus festen Regeln: Hauptmuskeln der letzten 2 Tage, Schon-Modus beachtet). **Keine
  geplante Einheit**, zählt nicht für Planerfüllung und nicht für die 10-%-Regel; erledigt = freie Einheit
  (`source = workout`). Abschaltbar in den Einstellungen.
- **Aufwärmen & Dehnen (4.3)** bleibt unverändert; dieselben Dehn-Übungen werden mitgenutzt.
- **Sportart-Einträge:** `yoga` und `pilates` kommen zusätzlich in `SPORT_IDS` (Kategorie neu `mind_body`), damit ein
  Studio-Kurs eingetragen und die Uhr-Arten 83 „Yoga“, 48 „Pilates“, 71 „Dehnen“ zugeordnet werden können.

## 3. Datenmodell (nur additiv)

| Änderung                                                                                                                         | Zweck              | Gesundheitsdatum?                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------- |
| Enum `endurance_discipline`/TS `ENDURANCE_DISCIPLINES` + `hyrox`; `competition_discipline` + `hyrox`                             | Ziel und Wettkampf | nein (Plan-Bezug wie WP3 nur mit Einwilligung) |
| `competitions.hyrox_division` (Enum `hyrox_division`: `open`, `pro`, `doubles`, `relay`), CHECK nur bei Hyrox                    | Gewichte/Anzeige   | nein                                           |
| `session_focus` + `hyrox_stations`; `workout_type` + `hyrox_combo`; Schritt-Typ `station` in `workout_steps` (Zod + SQL-Prüfung) | Hyrox-Einheiten    | wie `planned_sessions` bisher                  |
| Ergebnis Hyrox-Rennen: `session_logs` freie Einheit + `hyrox_splits jsonb` (≤ 17 Einträge)                                       | Teilzeiten         | nein                                           |
| Enum `endurance_modality` + `row`; `cardio_logs.avg_power_w` (1–1000), `stroke_rate` (10–60), `intervals jsonb` (≤ 30)           | Rudern             | nein (kein Puls)                               |
| Enum `walk_kind` (`walk`, `hike`, `mountain_hike`); `cardio_logs.walk_kind`, `tracked_routes.walk_kind` (null = Gehen)           | Wandern            | nein                                           |
| `tracked_routes.elevation_loss_m`, `max_altitude_m`, `sac_grade` (1–3)                                                           | Bergwandern        | nein                                           |
| `workout_category` + `yoga`, `pilates`, `rowing`; `workout_format` + `flow`; Item-Feld `side` (`both`/null)                      | Routinen           | nein (Inhalte)                                 |
| `caution_tag` + `inversion`; neue Übungen/Posen über Seeds                                                                       | Sicherheitsfilter  | nein                                           |
| `sport_type` + `yoga`, `pilates`                                                                                                 | Eintragen, Uhr     | nein                                           |
| Einstellung „Erholungs-Routine vorschlagen“ (Gerät, je Konto)                                                                    | Heute-Karte        | nein                                           |

- **RLS** unverändert (alle Spalten an bestehenden Tabellen mit RLS); **Export** über `to_jsonb` automatisch;
  **Löschen** mit Konto. `save_session_log`, `save_tracked_route`, `save_competition`, `import_wearable_batch`
  bekommen je eine neue Fassung (auf die neueste aufsetzen, siehe Stufe 2 Punkt 6).
- Enum-Werte jeweils in **eigener Migrationsdatei** vor der Nutzung (Regel aus WP5). `db-sync.test.ts` gleicht ab.
- Keine Koordinaten/Höhen in Logs; Höhe zählt wie Strecke (privat).

## 4. Inhalte (Entwürfe, Fachprüfung nötig)

Alles als `draft` über die Content-Pipeline (Gemini-Batch oder Sitzung), Zod-Schema, Regeln, **Sammelfreigabe pro
Kategorie** über `content-review`; vor Livegang Fachprüfung (siehe Entscheidung 12). Entwürfe nur im Testmodus.

| Bereich       | Umfang (Startbestand)                                                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hyrox         | 8 Stations-Übungen + je 2–3 Ersatz ohne Spezialgerät (~20 Übungen), 6 Stations-Einheiten (Einsteiger/Fortgeschritten × Basis/Aufbau/Spitze), 8 Kombi-Bausteine, Texte `HYROX_TEXTS_DE`, Ratgeber „Hyrox – so läuft der Tag“, „Roxzone & Pacing“ |
| Wandern       | Textbausteine `HIKING_SAFETY_DE` (Wetter, Umkehrzeit, Höhe, Abstieg, Notruf je Land), Ratgeber „Sicher Bergwandern“, „Höhe und Höhenkrankheit“, SAC-Skala kurz                                                                                  |
| Indoor-Rudern | Texte `MULTISPORT_TEXTS_DE.row`, Technik-Übung „Rudergerät“ mit Bildern, 10 Rudern-Workouts (Kategorie `rowing`), Ratgeber „Split und Schlagzahl verstehen“                                                                                     |
| Yoga          | ~40 Posen (mit Stuhl-/Wand-Varianten), 12 Routinen (Morgen, Abend, Hüfte, Rücken, Läufer, Stuhl-Yoga für „Fit im Alter“ …)                                                                                                                      |
| Pilates       | ~25 Matten-Übungen, 8 Routinen (Rumpf Einstieg, Haltung …), Osteoporose-tauglich markiert                                                                                                                                                       |
| Mobility      | ~15 neue Übungen (+ vorhandene Dehnungen), 8 Routinen inkl. „Erholungstag 10/15/20 min“, „Nach dem Laufen“, „Nach dem Wandern“                                                                                                                  |
| Bilder        | Übungsbilder wie `exercise-media` (Lizenz/Herkunft je Bild), Stations-Piktogramme                                                                                                                                                               |

Texte ohne Heilversprechen (keine „heilt Rückenschmerzen“, „entgiftet“); Yoga ohne spirituelle Versprechen.

## 5. Sicherheitsregeln (in `constants.ts`, mit Quellen)

Alle Werte **PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN**; strengste Regel gewinnt (wie Plan-Engine).

| Konstante                                                      | Inhalt                                                                                                                                                         | Quelle                                                                                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HYROX_FORMAT`                                                 | Stationen, Mengen, Gewichte je Division/Geschlecht, Laufdistanz                                                                                                | HYROX Rulebook (Saison 25/26) – aus dem Original übernehmen                                                                                                     |
| `HYROX_PLAN`                                                   | Mindestvorlauf 8 Wochen (Einsteiger 12), Wochenbau, Kombi ab Aufbau, Simulation ≤ 1× in der Spitze, nicht in den letzten 10 Tagen, Stations-Mengen +10 %/Woche | Concurrent Training: Wilson JM et al. (2012), J Strength Cond Res 26(8):2293–2307; 10 %-/Deload-Regeln wie bisher; Rest Produktentscheidung                     |
| `HYROX_SAFETY`                                                 | unter 18 nur Open, RPE ≤ 8; Arzt-Hinweis → keine Kombi hart; Schwangerschaft → kein Hyrox-Plan; ab 65 ohne `high_impact`                                       | bestehende Regeln (Phase 3, WP3), Hyrox-Altersklassen laut Rulebook                                                                                             |
| `ENDURANCE_MODALITY_ROW`                                       | Plausibilität: Split 1:10–4:00 /500 m, ≤ 25 km/h; Schlagzahl 10–60; Watt-Formel `2,80/(s/m)³`; Dämpfer-Hinweis 3–5                                             | Concept2 „Pace/Watt calculator“ und Technik-Leitfaden                                                                                                           |
| `TRAINING_MET.endurance.row`                                   | niedrig/hoch nach Anstrengung (Startwerte ~4,8 / 8,5)                                                                                                          | Ainsworth 2011 Compendium, Codes 02071/02073 (gegen Original bzw. Compendium 2024 prüfen)                                                                       |
| `TRAINING_MET.hike` / `mountainHike`                           | Startwerte ~5,3 / 7,8                                                                                                                                          | Compendium 17080 „hiking, cross country“, 17012 „hiking with daypack“ (prüfen)                                                                                  |
| `HIKING_TIME`                                                  | 4 km/h, 300 Hm/h auf, 500 Hm/h ab, größerer + halber kleinerer Wert                                                                                            | DIN 33466 „Wanderwege“; DAV/SAC-Gehzeitberechnung                                                                                                               |
| `HIKING_SAFETY`                                                | Höhenhinweis ab 2.500 m; Schlafhöhe-Faustregel +300–500 m/Tag; SAC T1–T3 begleitet, T4+ Hinweis; Bein-Hinweis ab 120 min oder 600 Hm Abstieg                   | Luks AM et al. (2019), WMS Clinical Practice Guidelines Acute Altitude Illness, Wilderness Environ Med 30(4S):S3–S18; SAC-Wanderskala; DAV „Sicher Bergwandern“ |
| `EMERGENCY_NUMBERS`                                            | DE 112, AT 140 (Alpin) / 112, CH 1414 (Rega) / 144 / 112, IT 118 / 112                                                                                         | offizielle Angaben der Länder/Rettungsdienste (prüfen)                                                                                                          |
| `FLOW_RULES`                                                   | Pose 15–180 s, Halteposen ab 65 ≤ 30 s (wie `ACTIVE_AGING_RULES`), Routine 5–45 min, Mindestanteil erlaubter Posen 80 %                                        | Produktentscheidung, bestehende Fit-im-Alter-Regeln                                                                                                             |
| `PREGNANCY_EXCLUDED_CAUTION_TAGS` + `inversion`, tiefe Drehung | Schwangerschaft: keine Umkehrhaltungen, keine lange Rückenlage, keine tiefen Drehungen, kein „Hot Yoga“                                                        | ACOG Committee Opinion No. 804 (2020), Obstet Gynecol 135(4):e178–e188                                                                                          |
| `RECOVERY_ROUTINE`                                             | Vorschlag nur an trainingsfreien Tagen/Erholungswoche, 10–20 min, Anstrengung ≤ 3                                                                              | Produktentscheidung                                                                                                                                             |

## 6. Kein Teilen, Privatsphäre

Alles privat. Story-Bild (Ausnahme 20.10.2026) für Wanderung, Rudern und Hyrox-Ergebnis erlaubt – **ohne
Gesundheitsdaten**, mit Privatzone bei Strecken (wie Laufen). Keine Hyrox-Ranglisten, kein Altersklassen-Vergleich.
Live-Begleitung für Wandern/Bergwandern unverändert verfügbar (alle Aufzeichnungs-Sportarten).

## 7. Tests (Definition of Done)

- Core: je neue Funktion Unit-Tests mit Grenzfällen (sehr leicht/schwer, 16/80 Jahre, 1 vs. 7 Tage, ohne Equipment,
  Schwangerschaft, Arzt-Hinweis, Schon-Modus jede Region). Regressionstest: Pläne ohne neue Disziplin/Art
  **byte-gleich** (Snapshots), `checkWeekInvariants()` für jeden Hyrox-/Rudern-Plan.
- Datenbank: pgTAP für neue CHECKs, RLS, Export, `save_*`-Fassungen; `db-sync.test.ts` für alle Enums/Grenzen.
- App: Testmodus-Szenarien je Sportart, Leer-/Fehler-/Ladezustände, Playwright-Screenshots am Handy-Format.

## 8. Gratis oder Premium

**Empfehlung: alles gratis** – keine Echtzeit-KI, alles feste Regeln und geprüfte Inhalte (KI-Grenze, CLAUDE.md).
Premium bleibt nur, was schon Premium ist: Live-Anpassung (4.1) gilt auch für Hyrox- und Rudern-Pläne. Testphase:
ohnehin alles offen (`premium_open`).

## 9. Umsetzungsreihenfolge (Etappen, je ein PR)

1. **Y – Yoga/Pilates/Mobility** (geringstes Risiko, nutzt Workouts):
   Y1 Core + Schema (`flow`, Kategorien, `inversion`, `side`, Sportarten `yoga`/`pilates`, Uhr-Zuordnung) + Migration;
   Y2 Inhalte als Entwürfe; Y3 Player „Flow“, Heute-Karte Erholungstag, Einstellung.
2. **W – Wandern/Bergwandern:** W1 Core (`walk_kind`, Gehzeit, Hinweise, kcal, Bein-Hinweis) + Migration;
   W2 App (Auswahl beim Start, Auswertung mit Höhenprofil, Hinweis-Karten, Uhr-Zuordnung 37/63).
3. **R – Indoor-Rudern:** R1 Core (`row` in Ausdauer-Engine, Split/Watt, Varianten, Plausibilität) – alle `switch`
   über `EnduranceModality` prüfen; R2 Migration + `save_session_log`/Import; R3 App (Tag-Art „Rudern“, Eintragen mit
   Intervall-Ergebnis, Timer, Workouts `rowing`).
4. **H – Hyrox** (größter Brocken): H1 Core (Format, Ampel, Wochenbau, Stations-/Kombi-Einheiten, Ersatz-Kette, Regeln);
   H2 Migration (`hyrox`, Division, Fokus, Schritt-Typ, Server-Prüfungen); H3 Inhalte (Entwürfe); H4 App (Ziel,
   „Mein Wettkampf“, Woche, Stations-/Kombi-Timer, Ergebnis mit Teilzeiten).
5. **Abschluss:** `docs/KONZEPT.md` (1, 4, 5.1, 10.1, 12), Ratgeber, Story-Bilder, Fachprüfung der Konstanten.

## 10. Entscheidungen (Empfehlungen freigegeben 27.10.2026)

1. **Hyrox als Ziel:** eigene Ausdauer-Disziplin „Hyrox“ (Empfehlung) statt neuem Hauptziel – nutzt Wettkampfplan,
   Nebenziel bleibt möglich.
2. **Divisionen:** Open und Pro mit eigenen Gewichten; Doubles/Staffel nur als Angabe (gleicher Plan) – Empfehlung.
3. **Name/Marke:** „Hyrox“ nur beschreibend, ohne Logo und ohne Anschein einer Kooperation; Markenrecht vor Livegang
   prüfen lassen – Empfehlung.
4. **Mindestvorlauf Hyrox:** 8 Wochen, Einsteiger 12; darunter Ampel „Zu kurz“ mit Vorschlag – Empfehlung.
5. **Ohne Schlitten/SkiErg:** Stationen ersetzen mit klarem Hinweis statt Plan verweigern – Empfehlung.
6. **Rudern:** neue Ausdauer-Art `row` (planbar, 10-%-Regel) statt nur Sportart-Eintrag – Empfehlung.
7. **Concept2-Logbuch / Bluetooth (FTMS):** nicht in v1, später eigene Etappe – Empfehlung.
8. **kcal-Feinheiten:** v1 nur MET nach Anstrengung (Uhr-Wert vorrangig); Höhenmeter-Zuschlag Wandern und Watt-Formel
   Rudern erst nach Fachprüfung – Empfehlung.
9. **Wandern im Plan:** v1 nur aufzeichnen (freie Einheit, Bein-Hinweis), kein „Wandertag“ als geplante Einheit –
   Empfehlung.
10. **Bergwandern-Grenze:** Hinweise ab 2.500 m und SAC T1–T3; T4+ nur Hinweis „außerhalb der App“, nie Sperre –
    Empfehlung.
11. **Yoga-Format:** neues Format `flow` (eigener Player) statt `interval` mit 0 s Pause; neues Merkmal `inversion` –
    Empfehlung.
12. **Fachprüfung vor Livegang:** Hyrox-Trainer:in, Physiotherapeut:in und zertifizierte Yoga-/Pilates-Lehrkraft für
    Inhalte und Konstanten – Empfehlung (Budget nötig).
13. **Erholungstag-Routine:** nur Vorschlag (abschaltbar), keine geplante Einheit, zählt nicht für Plan/10 % –
    Empfehlung.
14. **Gratis/Premium:** alles gratis, Live-Anpassung bleibt Premium – Empfehlung.

## 11. Umsetzungsstand

**S – Datenbank-Grundlage: erledigt (27.10.2026, Branch `claude/sportarten-s1-db`).** Alle Enums, Spalten, CHECKs und
Server-Fassungen aus Abschnitt 3 für alle vier Sportarten; die Etappen Y, W, R und H brauchen keine SQL-Funktionen oder
Enums mehr anzufassen.

| Migration                                    | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261027100000_sportarten_stufe1_enums.sql` | `endurance_discipline`/`competition_discipline` + `hyrox`, `session_focus` + `hyrox_stations`, `workout_type` + `hyrox_combo`, `endurance_modality` + `row`, `workout_category` + `yoga`/`pilates`/`rowing`, `workout_format` + `flow`, `caution_tag` + `inversion`, `sport_type` + `yoga`/`pilates`; neue Typen `hyrox_division`, `walk_kind`                                                                        |
| `20261027100100_sportarten_stufe1.sql`       | `competitions.hyrox_division` (genau bei Hyrox), Hyrox 8 km/8 Wochen/unter 18 erlaubt, Lauf-Referenz bei Hyrox; Schritt-Typ `station` (mit Feld `station`), `hyrox_combo` harte Art, Kombi nur Lauf; `session_logs.hyrox_splits`; `cardio_logs.avg_power_w`/`stroke_rate`/`intervals`/`walk_kind`; `tracked_routes.walk_kind`/`elevation_loss_m`/`max_altitude_m`/`sac_grade`; `app_layout_settings.recovery_routine` |
| `20261027100200_sportarten_stufe1_rpcs.sql`  | neue Fassungen von `insert_plan_sessions`, `save_competition`, `save_session_log`, `save_tracked_route`, `update_tracked_route`, `save_wearable_route`, `import_wearable_batch`, `save_app_layout` (je neueste Fassung + optionale Felder)                                                                                                                                                                            |

- **Ergebnis Hyrox-Rennen:** freie Ausdauer-Einheit `run` mit Name „Hyrox-Rennen“ (`FREE_SESSION.names.hyroxRace`),
  Gesamtzeit = Dauer; `hyrox_splits` gesetzt (Liste mit 0–17 Teilzeiten `{segment, duration_s}`,
  `HYROX_SPLIT_SEGMENTS`) genau bei diesem Eintrag, Summe ≤ Gesamtzeit.
- **Freie Namen:** Rudern „Rudern“; Geh-Einheit je Art „Spaziergang“/„Wanderung“/„Bergwanderung“
  (`FREE_SESSION.names.walkKinds`) – der verknüpfte Eintrag folgt der Strecke (und umgekehrt) wie beim E-Bike.
- **Einstellung „Erholungs-Routine vorschlagen“:** je Konto in `app_layout_settings.recovery_routine` (Standard an),
  Schreiben über `save_app_layout` mit optionalem Feld `recovery_routine` (fehlt = unverändert).
- **Core/Zod/Inhalte:** Listen und Schemas in `packages/core` (u. a. `WALK_KINDS`, `HYROX_DIVISIONS`, `HYROX_STATIONS`,
  `HYROX_SPLIT_SEGMENTS`, `FLOW_RULES`, `HYROX_RESULT_LIMITS`), Workout-Schema mit Format `flow` und Item-Feld `side`;
  Hyrox-Werte in den Wettkampf-Tabellen sind VORLÄUFIG (Etappe H). In der App sind die neuen Werte bis zu ihrer Etappe
  nicht wählbar (`apps/mobile/src/lib/sportarten-stufe1.ts`).
- **Tests:** `db-sync.test.ts` (Block „Sportarten Stufe 1“), `sportarten-stufe1.test.ts`, pgTAP 93–95.
