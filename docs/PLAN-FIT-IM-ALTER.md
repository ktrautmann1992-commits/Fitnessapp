# Plan „Fit im Alter“ – leichte Übungen für Rentnerinnen und Rentner

**Status:** **Freigegeben (Gründer-Entscheidung 21.10.2026: „1-7 machst du“, alle Fragen FA-G1 bis FA-G16 wie
empfohlen, Abschnitt 20).** Wächter-Prüfung Runde 1 „mit Auflagen“, eingearbeitet; Wächter Runde 2 freigabefähig,
N1–N5 eingearbeitet – alle Befunde (B1–B4, S1–S14, K1–K9, N1–N5) stehen in Abschnitt 0. Umsetzung je Etappe mit
Wächter-Prüfung; Stand der Umsetzung in Abschnitt 22. Die **Fachprüfung** (Physiotherapie/Sportmedizin) steht noch
aus – nichts in diesem Plan oder im Code gilt als fachlich geprüft; alle neuen Inhalte bleiben Entwurf
(`reviewed_by` leer) bzw. sind als „Testphase – noch nicht fachlich geprüft“ gekennzeichnet.

**Gründer-Entscheidung 19.10.2026 (eingearbeitet):** Bis zum Ende der Testphase gibt es **keine Abos** und keine
Rechtsberatungs-Schritte. Alles ist für alle Tester kostenlos und uneingeschränkt (Flag `premium_open`). Rechts-,
Haftungs- und Store-Prüfungen stehen in diesem Plan deshalb immer als **„vor dem öffentlichen Livegang“** – sie sind
keine Vorbedingung für Bau und Test. Die **Fachprüfung** (Physiotherapie/Sportmedizin) ist keine Rechtsprüfung: Sie
kommt, **bevor ältere Testpersonen trainieren** (S6).

**Grundlage:** `CLAUDE.md` (Sicherheit der Empfehlungen, Gesundheitsdaten, KI-Grenze, Kein Teilen), `docs/KONZEPT.md`
(Abschnitte 4, 6, 13, 14 und alle Regeln „ab 65“), `docs/PLAN-PHASE-1.md` (Gesundheits-Check, Abschnitt 7),
`docs/PLAN-PHASE-2.md` (Content-Pipeline, Schemas, Prüfregeln Ü1–Ü6 und V1–V13), `docs/PLAN-KOERPERGEWICHT.md`
(Vorlagen ohne Geräte, Regel K3 „letzte Rumpfübung bleibt“), `docs/PLAN-ZIELE.md` (Haupt-/Nebenziel, F8 Ziel-BMI ab
70 → 22), `docs/PLAN-PHASE-4B.md` (R1 nie ab 65, Server rechnet nach), `docs/PLAN-PHASE-6.md` (Einwilligung
`health_data` v2, Kreatin ab 55, Vitamin D), `docs/PLAN-PHASE-10.md` (Wettkampf-Grenzen ab 65),
`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md` (Bilder/Videos = Etappe G2), `docs/DESIGN.md` (Kontrast), Entwurf Phase 9
(Wechseljahre), Code-Stand vom 19.10.2026.

---

## 0. Wächter-Prüfung: eingearbeitet

Runde 1 (19.10.2026): „mit Auflagen“ – 4 blockierende, 14 Soll- und 9 Kann-Befunde. Runde 2 (gleicher Tag):
„freigabefähig“ mit den Nachträgen N1–N5. Alle sind im Plantext umgesetzt.

| Befund                                                                                                | Lösung im Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Abschnitt                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **B1** Reihenfolge „nach Phase 7“ veraltet (Phase 7 ruht in der Testphase)                            | Neue Reihenfolge: jetzt FA0 + Fachprüfung anfragen; FA-G1/FA-G10 **vor Phase 6 SU3** entscheiden (Datenarten in `health_data` v2); FA1 nach den gemergten 4b-Etappen, abgestimmt mit dem laufenden SU1; FA5 jederzeit, vor FA4; FA1–FA4 nach SU3/SU4 und **vor Phase 8**; Phase 9 unabhängig; FA6 mit G2. PROMPTS-Zeile angepasst.                                                                                                                                  | 1, 19 Nr. 7, 20 FA-G1, 21     |
| **B2** Einheit-Art `balance`: Folgen in Datenbank und Server nicht beschrieben                        | Vollständige Liste „Was eine neue Einheit-Art berührt“ (CHECKs, RPCs, `save_session_log` in drei Fassungen, Slots, Live-Anpassung, Auswertung, PDF, Phase 8/11b). **Empfehlung jetzt Variante B:** Gleichgewicht als `kind = 'strength'` mit Fokus `balance` (kein neues Enum). Varianten mit Aufwand und Risiko gegenübergestellt.                                                                                                                                 | 7.2, 7.3, 13.1, 17, FA-G4     |
| **B3** Sicherheitsprofil nur im Core, Server-Prüfungen fehlen                                         | Eigener Abschnitt Server-Prüfungen: `insert_plan_sessions`/`append_plan_block` (RPE ≤ 6, Merkmal-Ausschlüsse, `support`), `apply_plan_adjustments` (R1 nie bei `active_aging` **und** ab 65/vorsichtig – fehlt heute im Server), CHECK `plan_templates.goal_type`, `assert_plan_inputs`, `goal_pair_allowed`, Autoclear-Trigger, `seed_content()`, Schlüssellisten. Alle Tausch-Wege beachten Ausschlüsse und `support`. pgTAP-Gegenproben, DoD „Core **und** SQL“. | 8.3, 8.4, 17 FA1/FA3, 17.1    |
| **B4** `floor_transfer` ab 65 „sofort“ ist eine Regression                                            | Erst wenn Ersatzübungen im Stehen/Sitzen **veröffentlicht** sind. Regel „Ersatz mit gleichem Muster, sonst Übung behalten + Hinweis“ (nie still streichen), nur ab nächstem Block mit neuer Engine-Version, Regressionstest über alle Pläne ab 65. `floor_transfer` genau definiert. Neue Frage FA-G16.                                                                                                                                                             | 5, 13.1, 20 FA-G8/FA-G16      |
| **S1** RPE-Skala vermischt                                                                            | RPE 6 = App-Skala mit **Wiederholungen in Reserve** („noch etwa 4 Mal“), PRODUKTENTSCHEIDUNG in Anlehnung an ACSM. Keine neue Gesichter-Skala; einfache Sprache erklärt die bestehende Skala.                                                                                                                                                                                                                                                                       | 4, 8.1 Nr. 1, 12 Nr. 4, FA-G7 |
| **S2** Osteoporose zu eng                                                                             | Merkmale `spinal_flexion` und `trunk_rotation`. Für alle mit dem Ziel nur neutraler Rücken; bei `bone_health` Ausschluss bei jedem Ziel. Dehnung Oberschenkel-Rückseite mit aufrechtem Rücken, Prüfregel V22.                                                                                                                                                                                                                                                       | 7.1, 8.1, 8.2, 13.1, 13.2     |
| **S3** Gelenkersatz-Frage vermischt, Regel nicht prüfbar                                              | Zwei Fragen: OP in den letzten 12 Monaten (vorsichtig, Arzt-Hinweis, erneute Frage nach 12 Monaten) und künstliches Hüftgelenk (Merkmale `deep_hip_flexion`, `hip_cross_midline` ausgeschlossen). Klinik-Vorgaben gehen vor.                                                                                                                                                                                                                                        | 8.2, 13.1                     |
| **S4** Zusatzfragen: andere Ziele, Bestandsnutzer, Gehhilfe                                           | Wirkung je Flag festgelegt (nur Sturz, Unsicherheit, Gehhilfe, OP → `conservative_plan`; übrige gezielt). Neue Fragen optional, Fragebogen-Fassung, Karte für Bestandsnutzer ab 60, Regel bis zur Antwort, Frage auch beim Zielwechsel. Frage Gehhilfe neu, eigenes Flag `fall_concern`. FA-G3 erweitert, FA-G15 neu.                                                                                                                                               | 8.2, 20 FA-G3/FA-G15          |
| **S5** Selbsttests: Sicherheit                                                                        | Aufstehen „zügig, aber sicher, nicht bis zur Erschöpfung“, gesperrt bei `medical_clearance_recommended` bis Bestätigung. Stand-Stufen nur an der Küchenzeile/in einer Ecke; bei Sturz/Blutverdünner/Gehhilfe nur bis Halbtandem. **Ergebnisse steuern nie den Plan.** Name „Mein Fortschritt“, neutrale Erinnerung.                                                                                                                                                 | 10                            |
| **S6** Fachprüfung zu spät                                                                            | Fachprüfung von Übungen, Regeln, Zusatzfragen und Selbsttests **bevor ältere Testpersonen trainieren**; Gründer dürfen vorher testen.                                                                                                                                                                                                                                                                                                                               | Kopf, 13.3, 20 FA-G13, 21     |
| **S7** Startgruppe/Erholungswoche falsch beschrieben                                                  | `active_aging` übernimmt Ausdauer-Startgruppe „vorsichtig“ und Erholung nach 4 Wochen (getrennt vom Flag `cautious`, siehe N1): Ausdauer-Start 45 min / 20 min je Einheit, Anstrengung ≤ 3, höchstens 3 Ausdauer-Einheiten. Erholungs-RPE 5 bewusst festgehalten. Eigenschaftstest erweitert.                                                                                                                                                                       | 7, 8.1, 9, 17.1               |
| **S8** Kürzen schützt Gleichgewicht nicht                                                             | Bei `active_aging` bleiben Gleichgewicht (≥ 2) und Beweglichkeit (≥ 1) beim Kürzen immer; zuerst fallen Kraft-Isolationsübungen. Test und Prüfregeln V15/V19.                                                                                                                                                                                                                                                                                                       | 7, 13.2                       |
| **S9** Wann findet die Gleichgewichts-Einheit statt?                                                  | Keine stille Einfügung auf nicht gewählten Tagen. Gleichgewicht vor jeder Geh-Einheit, Vorschlag im Onboarding; 1-Tag-Fall und mehr als 5 Wunschtage festgelegt; sonst Hinweis.                                                                                                                                                                                                                                                                                     | 7.2                           |
| **S10** Datenschutz konkretisieren                                                                    | Löschen auch auf dem Gerät (`localDb`), `revoke_export_union` erweitern (pgTAP), `anticoagulant` **nur fürs Training**, Zusatzfragen überspringbar = vorsichtig.                                                                                                                                                                                                                                                                                                    | 8.2, 11, 14                   |
| **S11** Vorlesen nicht sicher offline                                                                 | Im Web nur Stimmen mit `localService = true`, sonst Knopf aus. Aussage „über die Sprachausgabe deines Geräts“; Datenschutzerklärung; nur Anleitungen vorlesen, keine Gesundheitsdaten.                                                                                                                                                                                                                                                                              | 12 Nr. 5, FA-G9               |
| **S12** Barrierefreiheit realistisch festlegen                                                        | Web: Zoom 200 % und Umbruch bei 320 CSS-px in Playwright; nativ: Checkliste am EAS-Build mit größter Systemschrift, `maxFontSizeMultiplier` bewusst. Ziel WCAG 2.2 AA (inkl. 2.5.8, 2.4.11, 3.3.8) für die genannten Bildschirme. 7 : 1 nur mit Token-Prüfung hell und dunkel. BITV nur öffentliche Stellen; BFSG/EN 301 549 vor dem Livegang.                                                                                                                      | 12, 17 FA5                    |
| **S13** Aufwand zu niedrig geschätzt                                                                  | Neu: **ca. 13–16 PRs** + G2 (2–3) + Inhalts-PRs; FA1 und FA3 je 2–3 PRs, `local-rules.ts` eingeplant.                                                                                                                                                                                                                                                                                                                                                               | 1, 17, FA-G1                  |
| **S14** Eiweiß-Zitat ungenau, Nebenziel ohne Werte                                                    | PROT-AGE richtig zitiert (≥ 1,2 g/kg bei Training). Paar `active_aging` → `fat_loss`: Energie −0,10, Eiweiß 1,2–1,5 g/kg mit Nieren-Hinweis, Tempo höchstens 0,5 %/Woche – PRODUKTENTSCHEIDUNG, Fachprüfung.                                                                                                                                                                                                                                                        | 4, 4.1, 11, FA-G6             |
| **K1** Wirkung ehrlich einordnen                                                                      | Neuer Abschnitt 4.2: Wirkung in Studien bei > 3 h/Woche, Otago mit Hausbesuchen; unser Plan ca. 30–40 min Gleichgewicht – keine Wirkungsaussage.                                                                                                                                                                                                                                                                                                                    | 4.2, 16, 19 Nr. 6             |
| **K2** Rechnung 150 min Gehen                                                                         | Etwa 14 Belastungswochen ≈ 18 Kalenderwochen; nur „Umfang wie WHO“, Anstrengung ≤ 3.                                                                                                                                                                                                                                                                                                                                                                                | 7                             |
| **K3** Halt-Stufe 4 und Halteübungen                                                                  | Stufe 4 heißt „Halt in Reichweite“, Steigerung nur nach Bestätigung. Gleichgewichts-Stand getrennt von isometrischen Kraft-Halteübungen.                                                                                                                                                                                                                                                                                                                            | 8.1, 9, 13.2                  |
| **K4** Stopp-Karte und Umgebung                                                                       | Telefon in Reichweite, nach Sturz nicht hastig aufstehen, Blutverdünner + Kopfanprall → sofort ärztlich abklären, Insulin → Unterzucker.                                                                                                                                                                                                                                                                                                                            | 8.1                           |
| **K5** Treppe bei Sturz                                                                               | Bei Sturz, Unsicherheit oder Gehhilfe Treppe nur unterste Stufe mit Geländer.                                                                                                                                                                                                                                                                                                                                                                                       | 8.2                           |
| **K6** „mit Halt“ als Vorlagen-Feld                                                                   | `support` steht in der Vorlage je Übung; Übungstexte bestehender Übungen bleiben für alle anderen unverändert.                                                                                                                                                                                                                                                                                                                                                      | 7.1, 13.1                     |
| **K7** Zweckbestimmung                                                                                | Satz für KONZEPT 14 schon mit FA0.                                                                                                                                                                                                                                                                                                                                                                                                                                  | 3.3, 17 FA0                   |
| **K8** Abschnitt 0 und PROMPTS-Status                                                                 | Abschnitt 0 gefüllt, PROMPTS-Stand aktualisiert, „nach Phase 7“ entfernt.                                                                                                                                                                                                                                                                                                                                                                                           | 0, PROMPTS                    |
| **K9** Neue Gründer-Fragen                                                                            | FA-G15 (Gehhilfe), FA-G16 (Zeitpunkt `floor_transfer` ab 65); FA-G3 und FA-G4 ergänzt.                                                                                                                                                                                                                                                                                                                                                                              | 20                            |
| **N1** (Runde 2) „Immer vorsichtig“ darf nicht `cautious = true` sein (sonst nur Einsteiger-Vorlagen) | `ACTIVE_AGING_RULES` setzt nur Ausdauer-Startgruppe `cautious` und Erholung nach 4 Wochen (`DELOAD_SCHEDULE.cautious`), getrennt vom Flag `cautious`; `beginnerTemplatesOnly` bleibt aus. Ein Gesundheits-Flag mit `conservative_plan` gilt wie heute. Test: 70-Jähriger ohne Flag, Level „aktiv“.                                                                                                                                                                  | 7, 9 Nr. 6, 17 FA1, 17.1      |
| **N2** (Runde 2) Gezielte Ausschlüsse in anderen Zielen streichen still                               | FA2 listet je neuem Merkmal die betroffenen bestehenden Übungen. Regel: Ersatz mit gleichem Muster, sonst streichen **mit Hinweis**; `SESSION_FIT.minExercises` und K3 bleiben; ab nächstem Block bzw. Neuplanung nach geänderter Antwort; Regressionstest Vorlagen × Flags.                                                                                                                                                                                        | 13.1, 13.4, 17 FA2            |
| **N3** (Runde 2) Gleichgewicht vor dem Gehen ist nur Text                                             | Feste Textvarianten je Flag (beidhändig festhalten bei Sturz, Unsicherheit, Gehhilfe, Blutverdünner); nicht protokolliert, V15/V17 greifen dort nicht. `session_focus` braucht `add value` in eigener Migrationsdatei; 7.3 präzisiert.                                                                                                                                                                                                                              | 7.2, 7.3, 17 FA3              |
| **N4** (Runde 2) R1-Lücke im Server ist eine bestehende 4b-Lücke                                      | Wird als eigener kleiner 4b-Nachtrag vorab geschlossen (ab 65, vorsichtig); FA3 ergänzt nur `active_aging`.                                                                                                                                                                                                                                                                                                                                                         | 2.1, 8.3 Nr. 2, 17 FA3        |
| **N5** (Runde 2) OP-Frage: Datum zu genau                                                             | Nur Monat und Jahr der **Antwort** speichern, kein OP-Datum; erneute Frage nach 12 Monaten über die Fragebogen-Fassung.                                                                                                                                                                                                                                                                                                                                             | 8.2                           |

---

## 1. Kurzfassung

„Fit im Alter“ ist ein **neues Hauptziel** für Menschen, die mit leichten Übungen kräftig, sicher auf den Beinen und
selbstständig bleiben wollen. Der Plan besteht aus vier Bausteinen: **Gleichgewicht, Kraft, Beweglichkeit und Gehen**,
dazu Übungen für den Alltag (Aufstehen, Treppe, Tragen). Alles läuft wie heute **ohne Echtzeit-KI**: feste Regeln in
`packages/core`, die der Server nachprüft, Übungen und Vorlagen offline per Gemini-Batch, Freigabe durch Menschen,
Fachprüfung durch Physiotherapie oder Sportmedizin.

**Das Wichtigste vorweg:**

- **Ziel statt nur Sicherheitsmodus.** Die heutigen Regeln „ab 65“ schneiden nur Übungen weg. Ein eigenes Ziel bringt
  das, was fehlt: Gleichgewicht, Alltagsübungen, Beweglichkeit. Die Altersregeln ab 65 bleiben für **alle** Ziele.
- **Sicher zuerst.** Immer Halt oder Stuhl in Reichweite, keine Sprünge, keine Bodenübungen, neutraler Rücken, RPE
  höchstens 6 („noch etwa 4 Mal“), Ausatmen bei der Anstrengung, klare Stopp-Zeichen. Der Server prüft dieselben
  Grenzen.
- **Gesundheits-Check bekommt Zusatzfragen** zu Sturz, Unsicherheit, Gehhilfe, OP, künstlicher Hüfte, Osteoporose und
  Blutverdünnern. Ein „Ja“ führt zu Arzt-Hinweis oder gezielten Ausschlüssen – nie zu einer Bewertung.
- **Selbsttests** („Mein Fortschritt“) zeigen nur den **eigenen Verlauf**. Keine Normwerte, kein „Sturzrisiko“, und
  sie steuern nie den Plan.
- **Barrierefreiheit** ist eine eigene Etappe (WCAG 2.2 AA für die betroffenen Bildschirme). Davon profitieren alle.
- **Bilder sind Pflicht vor dem öffentlichen Start** (Etappe G2, eigener Plan).
- **Ehrliche Einschätzung:** etwa **13–16 Pull Requests** plus Bilder (G2, 2–3) und Inhalts-PRs, dazu eine
  Fachprüfung. **Empfehlung:** jetzt entscheiden (vor Phase 6 SU3, damit die Datenarten in die Einwilligung v2
  kommen), FA5 jederzeit, FA1–FA4 nach Phase 6 SU3/SU4 und **vor Phase 8** (FA-G1).

---

## 2. Ist-Stand (geprüft am 19.10.2026)

### 2.1 Was es schon gibt

| Bereich                 | Stand im Code                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Altersregel Training    | `AGE_PLAN_RULES.senior` in `constants.ts`: ab 65 **RPE ≤ 7**, keine Übungen mit `high_impact` und `high_skill`. Ab 65 Startgruppe „vorsichtig“ (`plan/start-group.ts`): Erholungswoche nach 4 Wochen (`DELOAD_SCHEDULE.cautious`), höchstens 5 Einheiten je Woche, Ausdauer nur **zügiges Gehen** bzw. Ergometer/Schwimmen (`enduranceWalkOnly`). Der 65. Geburtstag gilt als strengere Regel für den Folgeblock.                                   |
| Live-Anpassung          | R1 „schneller steigern“ ist ab 65 im **Core** ausgeschlossen (`adjust/rules/state-rules.ts`). **Der Server** (`apply_plan_adjustments`) prüft bei `fast_increase` nur Schrittgröße und Form, nicht die Ausschlüsse (Wächter B3) – wird als eigener kleiner 4b-Nachtrag vorab geschlossen (N4).                                                                                                                                                      |
| Wettkampf (Phase 10)    | Ab 65 nur „Ankommen“, harte Einheiten höchstens Anstrengung 6, Arzt-Hinweis; „nur Gehen“ → Ampel höchstens „knapp“ (G7).                                                                                                                                                                                                                                                                                                                            |
| Ernährung               | Ab 65 Defizit höchstens 15 % (`SPECIAL_CASE_DEFICIT_CAPS.senior`), Eiweiß **1,2–1,6 g/kg** (`PROTEIN_G_PER_KG.senior`), Nieren-Hinweis über 1,6 g/kg. Ziel-BMI-Untergrenze ab 70 Jahren **22** (F8).                                                                                                                                                                                                                                                |
| Ziele                   | `GOAL_TYPES`: `fat_loss`, `definition`, `muscle_gain`, `general_fitness`, `endurance`. Vorlagen nur für drei Ziele (`TEMPLATE_GOAL_TYPES`, in der Datenbank CHECK auf `plan_templates.goal_type`). Nebenziele über `GOAL_PAIR_RULES` (gespiegelt in `private.goal_pair_allowed`).                                                                                                                                                                   |
| Vorlagen-Matrix         | 42 Vorlagen = 3 Ziele × 2 Level × Tage (2 nur Körpergewicht, 3, 4) × Ort (Studio, Zuhause, Körpergewicht). 1–2 Tage per Rotation der 3-Tage-Vorlage.                                                                                                                                                                                                                                                                                                |
| Übungen                 | 80 Übungen. Gut geeignet: `kniebeuge-stuhl`, `step-up-stufe`, `wadenheben-koerpergewicht`, `liegestuetz-erhoeht`, `rudern-band`, `bizepscurl-band`, `seitheben-band`, `pallof-press-band`. Muster `mobility` und `carry` gibt es, aber **ohne eine Übung**. Ein Muster für **Gleichgewicht fehlt**. In den Körpergewicht-Einsteiger-Vorlagen sind **alle Rumpfübungen Bodenübungen** (`unterarmstuetz`, `dead-bug`, `bird-dog`, `seitstuetz-knie`). |
| Merkmale (Caution-Tags) | `high_impact`, `spinal_loading`, `overhead`, `long_supine`, `high_skill`. Kein Merkmal für Bodenübungen, Rumpfbeugen, Drehen oder Hüftgrenzen.                                                                                                                                                                                                                                                                                                      |
| Anpassen und Kürzen     | Ein Sicherheits-Ausschluss ohne Ersatz **entfernt die Übung still** (`plan/adapt.ts`). `SESSION_FIT` schützt nur Rumpfübungen (K3), nicht Gleichgewicht oder Beweglichkeit.                                                                                                                                                                                                                                                                         |
| Dosierung und RPE       | RPE in der App = Skala mit **Wiederholungen in Reserve** (`TEMPLATE_DOSAGE_LIMITS`: RPE 5–9). Wochensätze je Ziel (V9/V10, rot). Diese Spannen passen nicht zu sehr leichten Plänen.                                                                                                                                                                                                                                                                |
| Einheit-Arten           | `planned_session_kind` = `strength`, `endurance`; tief verankert (CHECKs, RPCs, `save_session_log`, Slots, Live-Anpassung).                                                                                                                                                                                                                                                                                                                         |
| Gesundheits-Check       | 9 Fragen nach PAR-Q (`health-screening.ts`, `z.strictObject`, Datenbank mit strikten Schlüsseln), Flags `medical_clearance_recommended`, `pregnancy`, `injury`, `medication`, `conservative_plan`. **Keine** Fragen zu Stürzen, Gehhilfe, Osteoporose, OP, Gelenkersatz, Blutverdünnern.                                                                                                                                                            |
| Content-Pipeline        | `content-generate` (Gemini Batch) → `content-collect` → `content-review` → Freigabe per Merge → `content-seed`. Prüfskript `content:validate` an vier Stellen.                                                                                                                                                                                                                                                                                      |
| Barrierefreiheit        | Tippflächen mindestens 48 px (`MIN_TOUCH`), im Trainingsmodus 56 px. Kontrast AA laut `DESIGN.md`. Schriftgrößen 14–36 px. Systemschrift-Vergrößerung nicht abgeschaltet, aber nicht getestet. Kein „Große Ansicht“-Schalter, kein Vorlesen.                                                                                                                                                                                                        |
| Bilder und Videos       | Gibt es nicht (Schema verbietet `video_url`). Geplant als Etappe G2.                                                                                                                                                                                                                                                                                                                                                                                |

### 2.2 Was daraus folgt

Eine 72-jährige Nutzerin bekommt heute einen **gekürzten Fitness-Einsteigerplan**. Er ist sicher, aber nicht für sie
gemacht: kein Gleichgewicht, keine Alltagsübungen, keine Beweglichkeit, Bodenübungen möglich, RPE bis 7.

---

## 3. Umfang und Abgrenzung

### 3.1 Was kommt

1. Neues Hauptziel „Fit im Alter“ mit eigenen Vorlagen und Sicherheitsprofil (Core **und** Server).
2. Neue Übungen: Gleichgewicht, Kraft im Stehen und Sitzen, Beweglichkeit, Alltag.
3. Zusatzfragen im Gesundheits-Check.
4. Selbsttests „Mein Fortschritt“.
5. Ernährung: Erhalt statt Abnehmen, Eiweiß, Trinken.
6. Barrierefreiheit „Große Ansicht“ und Vorlesen.

### 3.2 Was NICHT kommt

- **Keine Diagnose, kein Sturzrisiko-Wert, keine Normtabellen.** Das wäre schnell ein Medizinprodukt (MDR, Regel 11).
- Keine Reha nach Operation, keine Übungen „gegen“ Krankheiten, keine Heilversprechen, keine eigenen OP-Regeln.
- Keine Sturzerkennung über Uhr oder Handy, kein Hausnotruf.
- Keine Bodenübungen (auch nicht „Aufstehen vom Boden“, siehe FA-G8).
- Kein Teilen, keine Gruppen, keine Ranglisten (CLAUDE.md). Partner-Modus erst mit Phase 11 und ohne Selbsttests.
- Kein Wettkampfplan mit Hauptziel „Fit im Alter“.
- Keine Echtzeit-KI.

### 3.3 Zweckbestimmung (K7)

Satz für `docs/KONZEPT.md` Abschnitt 14, schon mit FA0: **„‚Fit im Alter‘ ist ein Trainingsplan für einen aktiven
Alltag. Die App bewertet weder Sturzrisiko noch Gesundheitszustand.“** Er erleichtert die spätere MDR-Prüfung.

---

## 4. Fachliche Grundlage (Quellen – VOR LIVEGANG FACHLICH PRÜFEN)

| Thema                  | Kernaussage                                                                                                                                                                            | Quelle                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bewegung ab 65         | 150–300 min moderate Ausdauer je Woche (oder 75–150 min intensiv). Kraft für alle großen Muskelgruppen an **≥ 2 Tagen**. **Multikomponentes Training mit Gleichgewicht an ≥ 3 Tagen**. | WHO (2020), _Guidelines on physical activity and sedentary behaviour_, Genf; Bull FC et al. (2020), Br J Sports Med 54(24):1451–1462                                                          |
| Bewegung Deutschland   | Gleiche Kernaussagen, Betonung von Gleichgewicht und Alltag.                                                                                                                           | Rütten A, Pfeifer K (Hrsg.) (2016), _Nationale Empfehlungen für Bewegung und Bewegungsförderung_, BZgA                                                                                        |
| Sturzprävention        | Training senkt die Sturzrate um etwa ein Viertel (Rate etwa −23 %). Am stärksten wirken **Gleichgewichts- und Funktionsübungen**, besser kombiniert mit Kraft.                         | Sherrington C et al. (2019), Cochrane Database Syst Rev 1:CD012424                                                                                                                            |
| Umfang Gleichgewicht   | Wirkung vor allem bei **fordernden** Gleichgewichtsübungen und mehr als 3 Stunden Training je Woche.                                                                                   | Sherrington C et al. (2017), Br J Sports Med 51(24):1750–1758                                                                                                                                 |
| Otago-Programm         | Heimprogramm: 5 Kraftübungen (Beine) + 12 Gleichgewichtsübungen mit Halt, 3×/Woche, dazu Gehen 2×/Woche, Steigerung über Stufen. Angeleitet mit Hausbesuchen.                          | Campbell AJ et al. (1997), BMJ 315:1065–1069; Robertson MC et al. (2002), J Am Geriatr Soc 50(5):905–911; Thomas S et al. (2010), Age Ageing 39(6):681–687                                    |
| Welt-Leitlinie Stürze  | Gleichgewicht + Kraft als Kern, individuell, fortschreitend, mindestens 3×/Woche; Sturz-Fragen als einfache Erstabfrage.                                                               | Montero-Odasso M et al. (2022), Age Ageing 51(9):afac205                                                                                                                                      |
| ACSM ältere Erwachsene | Kraft 8–10 Übungen, 10–15 Wiederholungen, Anstrengung 5–6 (moderat) auf einer **0–10-Anstrengungsskala** – nicht dieselbe Skala wie die App-RPE (S1). Beweglichkeit ≥ 2×/Woche.        | Chodzko-Zajko WJ et al. (2009), Med Sci Sports Exerc 41(7):1510–1530 (schon in `constants.ts`)                                                                                                |
| Krafttraining im Alter | Auch sehr alten Menschen sicher möglich bei langsamer Steigerung; Kraft und Leistung im Alltag.                                                                                        | Fragala MS et al. (2019), J Strength Cond Res 33(8):2019–2052                                                                                                                                 |
| Sarkopenie             | Aufsteh-Test als Kraftmaß. **Wir nutzen die Grenzwerte nicht** (sonst Diagnose).                                                                                                       | Cruz-Jentoft AJ et al. (2019), EWGSOP2, Age Ageing 48(1):16–31                                                                                                                                |
| Eiweiß im Alter        | Gesunde Ältere mindestens 1,0–1,2 g/kg, **bei Training ≥ 1,2 g/kg**, bei akuter oder chronischer Erkrankung 1,2–1,5 g/kg; Eiweiß über die Mahlzeiten verteilen.                        | Bauer J et al. (2013), PROT-AGE, J Am Med Dir Assoc 14(8):542–559; Deutz NE et al. (2014), Clin Nutr 33(6):929–936; Volkert D et al. (2019), ESPEN-Leitlinie Geriatrie, Clin Nutr 38(1):10–47 |
| Osteoporose            | Kraft und Gleichgewicht ja; Rumpfbeugung am Bewegungsende (mit und ohne Last) und Drehen bis zum Anschlag oder schnelles Drehen meiden.                                                | Giangregorio LM et al. (2014), _Too Fit To Fracture_, Osteoporos Int 25(3):821–835; DVO-Leitlinie Osteoporose (2023)                                                                          |
| Herz, Blutdruck        | Moderate Belastung, Pressatmung vermeiden, lange Halteübungen begrenzen.                                                                                                               | Pelliccia A et al. (2021), ESC-Leitlinie Sportkardiologie, Eur Heart J 42(1):17–96                                                                                                            |
| Selbsttests            | 30-Sekunden-Aufsteh-Test; Stand-Stufen (Füße nebeneinander → Halbtandem → Tandem → Einbeinstand), im Original mit Untersucher daneben.                                                 | Jones CJ, Rikli RE, Beam WC (1999), Res Q Exerc Sport 70(2):113–119; Rikli RE, Jones CJ (1999), J Aging Phys Act 7(2):129–161; CDC STEADI „4-Stage Balance Test“                              |
| Sturz-Fragen           | Kurze Selbstauskunft (gestürzt? unsicher? Angst? Gehhilfe?) als Erstabfrage.                                                                                                           | CDC STEADI; Rubenstein LZ et al. (2011), J Safety Res 42(6):493–499 (_Stay Independent_)                                                                                                      |
| Barrierefreiheit       | Kontrast, Textgröße bis 200 %, Umbruch bei 320 px, Tippflächen, verständliche Sprache.                                                                                                 | W3C WCAG 2.2 (2023); EN 301 549; DIN ISO 24495-1 (Einfache Sprache)                                                                                                                           |

### 4.1 Abgleich mit der bestehenden Ernährungs-Engine

- Ab 65 gelten schon 1,2–1,6 g/kg Eiweiß. Das passt zu PROT-AGE („≥ 1,2 g/kg bei Training“). Kein Umbau nötig.
- Neu: `PROTEIN_G_PER_KG.byGoal.active_aging = 1.2` – damit gilt der Wert auch für 60–64-Jährige mit diesem Ziel.
  Die ESPEN-Untergrenze 1,0 g/kg wird immer eingehalten.
- Neu: `GOAL_ENERGY_ADJUSTMENT.active_aging = 0` (Erhalt). Abnehmen nur als Nebenziel (FA-G6, Werte in 11).
- Die Ziel-BMI-Untergrenze 22 ab 70 (F8) bleibt unverändert und greift beim Nebenziel Abnehmen.

### 4.2 Was wir ehrlich nicht versprechen können (K1)

Die Studien zeigen Wirkung vor allem bei **mehr als 3 Stunden fordernden Gleichgewichtstrainings je Woche**. Otago
wurde mit Hausbesuchen angeleitet; der Nutzen war bei Menschen ab 80 und nach Stürzen am größten. Unser Plan bietet
etwa **30–40 min Gleichgewicht je Woche**, ohne Anleitung vor Ort. Deshalb gibt es **keine Wirkungsaussage** zu
Stürzen – weder in der App noch im Marketing.

---

## 5. Ziel oder Sicherheitsmodus? – Empfehlung

| Weg                                      | Was passiert                                                                                                                   | Vorteil                                                 | Nachteil                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A: nur Sicherheitsmodus „ab 65“ schärfen | Bestehende Vorlagen, strengere Filter.                                                                                         | Wenig Aufwand (≈ 2–3 PRs).                              | Pläne werden nur dünner. Kein Gleichgewicht, keine Alltagsübungen. WHO „≥ 3× Gleichgewicht“ fehlt. |
| B: **neues Hauptziel „Fit im Alter“**    | Eigenes Ziel `active_aging`, eigene Vorlagen, eigenes Sicherheitsprofil. Altersregeln ab 65 bleiben zusätzlich für alle Ziele. | Echter Mehrwert, klare Ansprache, sauber in der Engine. | Mehr Aufwand (≈ 13–16 PRs), neue Inhalte, Fachprüfung.                                             |
| C: Unterprofil je Ziel                   | Jedes Ziel hat eine „sanfte“ Variante.                                                                                         | Flexibel.                                               | Verdoppelt die Vorlagen-Matrix. Schwer zu prüfen und zu erklären.                                  |

**Empfehlung: Weg B.** Für **alle ab 65** kommt später ein kleiner Teil von A: Bodenübungen (`floor_transfer`)
bekommen eine Alternative im Stehen oder Sitzen – **aber erst, wenn diese Ersatzübungen veröffentlicht sind** (B4,
FA-G16). Bis dahin ändert sich an heutigen Plänen nichts. Regel dann: Ersatz mit gleichem Bewegungsmuster im Stehen
oder Sitzen, **sonst Übung behalten und Hinweis zeigen** – nie still streichen. Wirkt nur ab dem nächsten Block, mit
neuer Engine-Version, abgesichert durch einen Regressionstest über alle heute erzeugbaren Pläne ab 65 (Rumpfübung
bleibt nach K3, mindestens `SESSION_FIT.minExercises`).

**Name im Code:** `active_aging` (Anzeige „Fit im Alter“). Untertitel: „Kraft, Gleichgewicht und Beweglichkeit für
einen selbstständigen Alltag“.

### 5.1 Was ein neues Ziel im Code berührt

- `GOAL_TYPES` + Postgres-Enum `goal_type` (`alter type … add value`, eigene Migrationsdatei), `db-sync.test.ts`.
- `TEMPLATE_GOAL_TYPES`, `GOAL_TEMPLATE_MAPPING` (`active_aging` → `same`), CHECK `plan_templates.goal_type`
  (drop/add constraint), `assert_plan_inputs`.
- `GOAL_ENERGY_ADJUSTMENT`, `PROTEIN_G_PER_KG.byGoal`.
- `GOAL_PAIR_RULES` + `private.goal_pair_allowed` + Trigger `goals_secondary_autoclear` (nur das Paar aus FA-G6).
- `suggestedTrainingSlots`, `planTitle`, Planname im PDF, `local-rules.ts` (Testmodus).
- Phase 10: Wettkampfplan lehnt das Ziel ab (Server und Core).
- Nicht berührt: Rezeptfilter, Supplement-Regeln (Phase 6), Zyklus (Phase 9).

---

## 6. Wer bekommt das Ziel? (Altersgrenze)

- **Empfehlung (FA-G2):** Das Ziel ist **für alle wählbar**, wird aber **ab 60 aktiv vorgeschlagen** („Passt ‚Fit im
  Alter‘ zu dir?“ im Ziel-Schritt). Keine Sperre nach Alter – das Ziel ist ohnehin das vorsichtigste.
- Die **Altersregeln ab 65** (`AGE_PLAN_RULES.senior`) bleiben unverändert und unabhängig vom Ziel.
- Mindestalter bleibt 16 (CLAUDE.md).

---

## 7. Bausteine des Trainings

Jede Kraft-Einheit hat dieselbe feste Reihenfolge. Das gibt Orientierung.

| Teil             | Inhalt                                                                                                                                       | Dauer (bei 30 min) |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1. Aufwärmen     | Gehen auf der Stelle mit Halt, Arme kreisen, Schultern heben.                                                                                | 5 min              |
| 2. Gleichgewicht | 2–3 Übungen mit Halt an Stuhl oder Küchenzeile, in Stufen (Abschnitt 9).                                                                     | 8 min              |
| 3. Kraft         | 4–6 Übungen: Beine (Aufstehen vom Stuhl, Wadenheben, Bein seitlich), Oberkörper (Wand-Liegestütz, Rudern mit Band), Alltag (Tragen, Treppe). | 12 min             |
| 4. Beweglichkeit | 2–3 ruhige Dehnungen im Stehen oder Sitzen, je 20–30 s, ohne Wippen, Rücken aufrecht.                                                        | 5 min              |

**Kürzen (S8):** Wird eine Einheit auf das Zeitbudget gekürzt, bleiben bei `active_aging` **mindestens 2
Gleichgewichts- und 1 Beweglichkeitsübung** immer erhalten (wie K3 für Rumpfübungen). Zuerst fallen
Kraft-Isolationsübungen weg, dann Sätze. Eigener Test.

**Startgruppe (S7, N1):** `active_aging` übernimmt – unabhängig vom Alter – zwei Teile der vorsichtigen Regeln, aber
**nicht** das Flag `cautious`: (1) die **Ausdauer-Startgruppe** `cautious` und (2) den **Erholungs-Rhythmus**
`DELOAD_SCHEDULE.cautious` (Erholungswoche nach 4 Belastungswochen), dazu höchstens 5 Einheiten je Woche. Das Flag
`cautious` würde in `plan/safety.ts` zusätzlich `beginnerTemplatesOnly` auslösen und die „aktiv“-Vorlagen sperren;
darum bleibt `beginnerTemplatesOnly` aus. `loadWeeksBeforeDeload()` liest dafür den Erholungs-Rhythmus aus
`ACTIVE_AGING_RULES`, nicht nur `rules.cautious`. Ausnahme: Ein Gesundheits-Flag mit `conservative_plan` gilt wie
heute (dann Einsteiger-Vorlagen). Test: Ein 70-Jähriger ohne Flag mit Level „aktiv“ bekommt die aktiv-Vorlage,
Erholung nach 4 Wochen und Ausdauer vorsichtig.

**Gehen** läuft über die bestehende Ausdauer-Logik als zügiges Gehen (Modalität `walk`, kein neues Disziplin-Feld).
Vorsichtige Startgruppe: Start 45 min je Woche, höchstens 20 min je Einheit, Anstrengung ≤ 3 (Gesprächstest),
höchstens 3 Geh-Einheiten. +10 % je Woche gegen die letzte Belastungswoche (abgerundet), Erholungswochen fest. So
erreicht der Plan nach **etwa 14 Belastungswochen (≈ 18 Kalenderwochen)** einen **Umfang wie die WHO-Empfehlung**
(150 min) – nie schneller (K2). Die WHO-Angabe „moderat“ nutzt eine andere Skala; wir sprechen nur vom Umfang.

### 7.1 Vorschlag für neue Übungen (Startbestand, ca. 30)

| Baustein         | Übungen (Arbeitsnamen)                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gleichgewicht    | Stand mit geschlossenen Füßen am Stuhl, Halbtandem-Stand, Tandem-Stand, Einbeinstand mit Halt, Gewicht verlagern vor/zurück und seitlich, Seitwärtsgehen an der Küchenzeile, Tandem-Gang an der Küchenzeile, Fersen- und Zehengang mit Halt, Rückwärtsgehen mit Halt, Gehen mit Wenden (Otago)                                          |
| Kraft Beine      | Aufstehen vom Stuhl mit Armhilfe (leichter als `kniebeuge-stuhl`, Sitzhöhe mindestens Kniehöhe), Knie strecken im Sitzen (Band oder Gewichtsmanschette), Knie beugen im Stehen mit Halt, Bein seitlich abspreizen im Stehen (nicht über die Mitte zurück), Bein nach hinten im Stehen, Zehenheben mit Halt, Treppensteigen mit Geländer |
| Kraft Oberkörper | Wand-Liegestütz, Rudern mit Band im Sitzen, Bizepscurl im Sitzen (leichte Hanteln/Wasserflaschen), Brustdrücken mit Band im Sitzen, Seitheben bis Schulterhöhe im Sitzen                                                                                                                                                                |
| Rumpf            | Rumpf aufrichten im Sitzen („groß machen“), Pallof-Press im Stehen (`pallof-press-band` vorhanden), Marschieren im Sitzen                                                                                                                                                                                                               |
| Alltag           | Einkaufstasche tragen (Muster `carry`), Gegenstand von Tischhöhe aufnehmen mit geradem Rücken (Hüftbeuge, nicht bis zum Boden), Hinsetzen und Aufstehen langsam                                                                                                                                                                         |
| Beweglichkeit    | Schulterkreisen, Brustöffner am Türrahmen, Wadendehnung an der Wand, Oberschenkel-Rückseite im Sitzen **mit aufrechtem Rücken** (Ferse vorn, aus der Hüfte neigen), Nacken sanft neigen                                                                                                                                                 |

Gestrichen gegenüber dem ersten Entwurf (S2, S3): „Rumpf drehen im Sitzen“ und „Bücken und vom Boden aufheben“.
`good-morning-koerpergewicht` und `y-t-w-vorgebeugt` sind für dieses Ziel ausgeschlossen (`spinal_flexion`).

Vorhanden und wiederverwendbar: `kniebeuge-stuhl`, `step-up-stufe` (niedrige Stufe), `wadenheben-koerpergewicht`,
`liegestuetz-erhoeht`, `rudern-band`, `bizepscurl-band`, `seitheben-band`, `pallof-press-band`. Der Hinweis „mit
Halt“ steht **in der Vorlage** (Feld `support` je Übungseintrag, K6) – die Übungstexte für alle anderen Nutzer
bleiben unverändert.

### 7.2 Gleichgewicht an 3 Tagen – wann? (S9, B2)

Trainingstage sind feste Wochentage (`training_slots`). Die Engine legt **nie still** eine Einheit auf einen Tag, den
der Nutzer nicht gewählt hat.

- **2 Kraft-Tage + Geh-Tage:** Jede Geh-Einheit beginnt mit 10 min Gleichgewicht („Gleichgewicht + Gehen“). Damit
  sind es mindestens 3 Tage, sobald ein Geh-Tag gewählt ist.
- **Nur Text (N3):** Ausdauer-Einheiten dürfen laut CHECK `planned_sessions_kind_fields` keine Übungen enthalten.
  Der Vorspann ist deshalb ein fester Textbaustein: Er wird nicht protokolliert, und V15/V17 greifen dort nicht. Er
  trägt die Flag-Regeln selbst, in festen Varianten: **„beidhändig festhalten“** bei `fall_history`, `fall_concern`,
  `walking_aid` oder `anticoagulant`; sonst die Standard-Variante „mit Halt in Reichweite“. Die Variante wählt der
  Core; die Texte gehen durch die Textregeln und die Fachprüfung.
- **Nur Kraft-Tage gewählt:** Das Onboarding schlägt vor, einen dritten kurzen Tag zu wählen („3 kurze Tage sind
  besser als 2 lange“). Lehnt die Person ab, erscheint ein Hinweis, kein Eingriff.
- **1 Tag:** Rotation wie heute; Hinweis „Für Gleichgewicht helfen 3 Tage je Woche“.
- **Mehr als 5 Wunschtage:** Wochen-Deckel 5 (vorsichtig) wie heute; überzählige Tage → Hinweis.

### 7.3 Neue Einheit-Art oder nicht? (B2, FA-G4)

| Variante                                                    | Was nötig ist                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Aufwand / Risiko                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A: neue Art `balance` in `planned_session_kind`             | CHECK `planned_sessions_kind_fields`; `insert_plan_sessions`/`append_plan_block` (Prüfung je `kind`, strikte Schlüssel); **drei** Fassungen von `save_session_log` (`training_log_rpcs`, `free_session_logs`, `tracked_route_rpcs`); `private.neutral_session_name`; `training_logs.kind`; `training_slot_kind`; Live-Anpassung (`check_plan_invariants`, `apply_plan_adjustments`, R3 `volume_reduce`, R5 `fewer_days`, Wochen-Deckel, 48-h-Regel); `local-rules.ts`; Auswertung/Dashboard; PDF; später Phase 8 (Import) und 11b (Challenges). pgTAP je RPC. | hoch (+3–4 PRs), viele Stellen mit Regressionsrisiko                    |
| **B: `kind = 'strength'` mit Fokus `balance`** (Empfehlung) | Neuer Wert in `SESSION_FOCUSES` (`full_body`, `upper`, `lower` + `balance`); 48-h-Regel nimmt Fokus `balance` aus; Kürzen und Live-Anpassung behandeln ihn wie eine leichte Kraft-Einheit; `session_focus` ist ein Postgres-Enum (`20261003130200_content_enums.sql`) und braucht `add value` in einer **eigenen Migrationsdatei**, dazu `db-sync.test.ts`; Geh-Tage bekommen den Gleichgewichts-Vorspann nur als Text der Ausdauer-Einheit (feste Varianten je Flag, nicht protokolliert, N3).                                                               | mittel; eine Enum-Erweiterung, keine RPC-Neufassung für die Einheit-Art |
| C: nur 3-Tage-Vorlagen                                      | Keine Engine-Änderung; 2-Tage-Pläne bekommen nur den Hinweis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | gering, aber WHO-Empfehlung bei 2 Tagen nicht erfüllt                   |

**Empfehlung: Variante B.** Variante A erst, wenn Auswertung oder Wearables (Phase 8) Gleichgewicht getrennt zählen
müssen.

---

## 8. Sicherheitsregeln (strengste Regel gewinnt)

### 8.1 Immer bei Ziel „Fit im Alter“ (unabhängig vom Alter)

1. **RPE höchstens 6** auf der App-Skala mit **Wiederholungen in Reserve**: „Du könntest noch etwa 4 Mal.“ Neuer
   Wert `ACTIVE_AGING_RULES.rpeMax = 6` in `constants.ts`, gekennzeichnet als **PRODUKTENTSCHEIDUNG in Anlehnung an
   ACSM 2009** (ACSM nutzt eine andere Skala, S1). Erholungswoche: RPE max(5, 6 − 2) = **5** – nur einen Punkt
   darunter; bewusst so festgehalten, weil die Vorlagen-Untergrenze 5 ist.
2. **Keine Übungen** mit `high_impact`, `high_skill`, `spinal_loading`, `overhead` (Über-Kopf nur später nach
   Fachprüfung), `long_supine`, `floor_transfer`, `spinal_flexion` und `trunk_rotation`. Nur **neutraler Rücken**.
3. **Halt in Reichweite:** Jede Gleichgewichts- und Stehübung hat in der Vorlage das Pflichtfeld `support`
   (`hold_on` = festhalten, `chair_nearby` = Stuhl/Küchenzeile in Reichweite). Die App zeigt es groß über der Übung.
4. **Ausatmen bei der Anstrengung, nie Luft anhalten.** Fester Satz in jeder Kraftübung.
5. **Zwei Arten von Halten getrennt (K3):** Gleichgewichts-Stand 10–30 s (kein Pressen, Grenze aus der Stufe);
   isometrische **Kraft**-Halteübungen höchstens 30 s, bei Schwindel- oder Blutdruck-Antwort höchstens 20 s.
6. **Langsame Wechsel:** Nach dem Sitzen erst kurz stehen bleiben, dann gehen (Schwindel beim Aufstehen).
7. **Keine Maximaltests, nichts bis zur Erschöpfung** (gilt schon heute, auch für Selbsttests – Abschnitt 10).
8. **Live-Anpassung R1** (schneller steigern) **nie** – im Core und im Server (8.3). R2/R3 (leichter machen) bleiben.
9. **Stopp-Karte** vor jeder Einheit (einmal „Verstanden“, danach eingeklappt, K4):
   - „Hör sofort auf und setz dich, wenn du Schmerzen oder Druck in der Brust, starke Atemnot, Herzstolpern,
     Schwindel, Übelkeit oder plötzliche Schmerzen spürst.“
   - „Halten Brustschmerzen länger als ein paar Minuten an, ruf den Notruf **112**.“ (gilt in DE, AT, CH)
   - „Nach einem Sturz nicht hastig aufstehen. Erst durchatmen, dann langsam mit Hilfe eines Stuhls.“
   - „Nimmst du Blutverdünner und hast dir den Kopf gestoßen: sofort ärztlich abklären lassen.“
   - „Spritzt du Insulin, denk an Unterzucker: etwas Traubenzucker bereithalten.“ (Wortlaut in der Fachprüfung)
10. **Umgebung:** „Feste Schuhe, freie Fläche, kein Teppich-Rand, Stuhl ohne Rollen, **Telefon in Reichweite**.“

### 8.2 Zusatzfragen im Gesundheits-Check

**Wann:** wenn das Ziel „Fit im Alter“ gewählt ist (auch beim späteren Zielwechsel in den Einstellungen und bei
55-Jährigen nach dem Ziel-Schritt) **oder** die Person 60 oder älter ist. Antworten ja/nein, einfache Sprache.
**Überspringbar:** Wer überspringt, wird behandelt wie „ohne Check“ (vorsichtig, S10).

| Frage (Entwurf, Fachprüfung)                                                           | Flag              | Wirkung                                                                                                                                                                                                                    | `conservative_plan`? |
| -------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| „Bist du in den letzten 12 Monaten gestürzt?“                                          | `fall_history`    | Arzt-Hinweis; Gleichgewicht höchstens Stufe 2; Steigerung nur nach Bestätigung; Treppe nur unterste Stufe mit Geländer (K5).                                                                                               | ja                   |
| „Fühlst du dich beim Stehen oder Gehen unsicher oder hast du Angst zu stürzen?“        | `fall_concern`    | wie `fall_history`                                                                                                                                                                                                         | ja                   |
| „Nutzt du beim Gehen einen Stock, Rollator oder eine andere Gehhilfe?“ (neu, FA-G15)   | `walking_aid`     | Gleichgewicht höchstens Stufe 2; Übungen im Sitzen bevorzugt; Stand-Stufen nur bis Halbtandem; Treppe nur unterste Stufe.                                                                                                  | ja                   |
| „Hattest du in den letzten 12 Monaten eine OP an Hüfte, Knie oder Rücken?“             | `recent_surgery`  | Arzt-Hinweis; „Halte dich an die Vorgaben deiner Klinik oder Physiotherapie.“ Gespeichert werden nur Monat und Jahr der **Antwort**, kein OP-Datum (N5); nach 12 Monaten fragt die App über die Fragebogen-Fassung erneut. | ja                   |
| „Hast du ein künstliches Hüftgelenk?“                                                  | `hip_replacement` | Merkmale `deep_hip_flexion` (Hüftbeugung über 90°, z. B. niedriger Stuhl) und `hip_cross_midline` (Bein über die Mitte, Einwärtsdrehen) ausgeschlossen. Klinik geht vor.                                                   | nein                 |
| „Hat dir eine Ärztin oder ein Arzt gesagt, dass du Osteoporose (Knochenschwund) hast?“ | `bone_health`     | `spinal_flexion`, `loaded_flexion`, `trunk_rotation` ausgeschlossen (bei jedem Ziel). Hinweis „Frag nach Übungen, die für dich passen.“                                                                                    | nein                 |
| „Nimmst du blutverdünnende Medikamente?“                                               | `anticoagulant`   | Gleichgewicht immer `hold_on`; Stand-Stufen nur bis Halbtandem; Kopfanprall-Satz hervorgehoben. **Nur fürs Training**, nicht für Supplement-Hinweise (S10).                                                                | nein                 |

**Wirkung auf andere Ziele (S4, FA-G3):** Die Fragen kommen ab 60 bei **jedem** Ziel. Nur die vier Flags mit „ja“
in der letzten Spalte setzen `conservative_plan` (Einsteiger-Vorlagen, RPE ≤ 7 usw. – auch bei Muskelaufbau). Die
anderen drei wirken **gezielt** (Ausschluss oder Halt-Pflicht). Beispiel: Ein fitter 62-Jähriger mit Blutverdünner
behält seinen Muskelaufbau-Plan; nur Gleichgewichtsübungen bekommen Halt-Pflicht.

**Technik und Bestandsnutzer (S4):**

- `healthScreeningAnswersSchema` bekommt die neuen Fragen **optional** – alte Antworten bleiben gültig. Neue
  **Fragebogen-Fassung** (`questionnaire_version`) im Datensatz.
- Bestandsnutzer ab 60 (oder mit dem Ziel) sehen eine **Karte** „Ein paar neue Fragen zu deiner Sicherheit“. Bis zur
  Antwort gilt der bisherige Plan unverändert; beim nächsten Block gilt „nicht beantwortet“ wie übersprungen
  (vorsichtig). Für `active_aging` ist der Plan ohnehin vorsichtig.
- Die Datenbank berechnet die Flags selbst (Trigger wie heute), `db-sync.test.ts` gleicht ab.
- **Keine Bewertung** wie „hohes Sturzrisiko“. Nur Hinweise und Regeln (MDR-Abgrenzung).

### 8.3 Server-Prüfungen (B3)

Der Server rechnet dieselben Grenzen nach (PLAN-PHASE-4B). Neu bzw. erweitert:

1. **`insert_plan_sessions` / `append_plan_block`:** bei `inputs.goalType = 'active_aging'` `rpe_target ≤ 6`;
   keine Übung mit ausgeschlossenen Merkmalen (Join auf `exercises.caution_tags`, inkl. der Flag-Merkmale aus 8.2);
   `support` ≠ `none` bei Gleichgewichtsübungen; Mindestzahl Gleichgewicht/Beweglichkeit je Einheit. Neue Felder
   (`section`, `support`) in die strikte Schlüsselliste.
2. **`apply_plan_adjustments`:** R1 (`fast_increase`) wird abgelehnt bei `active_aging` **und** – gleich mit
   nachgezogen – ab 65 und bei vorsichtigem Plan. Diese bestehende Lücke aus 4b **wird als eigener kleiner 4b-Nachtrag vorab
   geschlossen** (N4), unabhängig von „Fit im Alter“; FA3 ergänzt dann nur `active_aging`. Nach jeder Anpassung bleibt
   RPE ≤ 6 als Invariante (`check_plan_invariants`).
3. **Datenbank-Ziel:** CHECK `plan_templates.goal_type` erweitern (drop/add constraint), `assert_plan_inputs`,
   `private.goal_pair_allowed`, Trigger `goals_secondary_autoclear`, `seed_content()` für `support`, `position`,
   `progression_level` und den Abschnitt-Typ.
4. **pgTAP-Gegenproben:** „Plan mit RPE 7 bei `active_aging` → abgelehnt“, „Bodenübung bei `active_aging` →
   abgelehnt“, „R1 bei `active_aging` / ab 65 → abgelehnt“, „Gleichgewicht ohne `support` → abgelehnt“.

### 8.4 Alle Tausch-Wege (B3)

Übungs-Glossar-Tausch (T1/T2), R4 `stagnation_variation` und Geräte-Tausch (`findSubstitute`) beachten die
Merkmal-Ausschlüsse **und** `support`: **Nie ersetzt eine Übung ohne Halt eine Halt-Übung.** Ein Tausch übernimmt
`support` aus der Vorlage. Tests je Weg im Core und, wo der Server prüft, in pgTAP.

---

## 9. Progression (langsam)

1. **Wiederholungen zuerst:** Kraft 8–15 Wiederholungen, 1–2 Sätze (Einsteiger), 2–3 Sätze (aktiv). Steigerung um
   1–2 Wiederholungen, wenn alle Sätze mit RPE ≤ 5 geschafft sind (doppelte Progression wie heute).
2. **Gewicht:** nur in kleinen Schritten (0,5–1 kg, höchstens 10 %) und erst am oberen Ende der Wiederholungen.
3. **Schwerere Variante** (z. B. Stuhl mit Armhilfe → `kniebeuge-stuhl`): nur nach **zwei Einheiten in Folge** am
   oberen Ende und **nach Bestätigung** („Möchtest du die nächste Stufe probieren?“). Nie automatisch.
4. **Gleichgewicht in Stufen (K3):** (1) beidhändig festhalten → (2) einhändig → (3) Fingerspitzen → (4) **Halt in
   Reichweite** (Hände frei, Küchenzeile direkt daneben). Haltezeit 10 → 30 s. Jede neue Stufe **nur nach
   Bestätigung**. Augen schließen gibt es nicht. Mit `fall_history`, `fall_concern` oder `walking_aid` höchstens
   Stufe 2.
5. **Gehen:** +10 % je Woche (bestehende Kette), Erholungswoche fest.
6. **Erholungswoche:** nach 4 Belastungswochen (Erholungs-Rhythmus aus `ACTIVE_AGING_RULES`, N1), Sätze halbiert,
   RPE 5 (S7).
7. **Nach Pause** (z. B. 2 Wochen Krankheit) schlägt die App vor, eine Stufe zurückzugehen (bestehende Regel R3).

---

## 10. Selbsttests „Mein Fortschritt“ (nur Fortschrittsmaß)

| Test                  | Ablauf in der App                                                                                                                                                                                                                                     | Was wir zeigen                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 30-Sekunden-Aufstehen | Stuhl an die Wand, Arme vor der Brust oder mit Armhilfe (wird mitgespeichert), 30 s Timer mit Ansage. **„Zügig, aber sicher – nicht bis zur Erschöpfung.“** Anzahl eintippen.                                                                         | Eigene Zahl und Verlauf.           |
| Stand-Stufen          | Füße nebeneinander → Halbtandem → Tandem → Einbeinstand, je bis 10 s, **in einer Ecke oder direkt an der Küchenzeile**. Mit `fall_history`, `fall_concern`, `anticoagulant` oder `walking_aid`: nur bis Halbtandem, Fingerspitzen an der Küchenzeile. | Höchste geschaffte Stufe, Verlauf. |
| Einbeinstand mit Halt | Bis 30 s, Fingerspitzen an der Küchenzeile, je Bein. Nicht bei den eben genannten Flags.                                                                                                                                                              | Sekunden je Bein, Verlauf.         |

Regeln (S5):

- **Ergebnisse steuern nie den Plan.** Keine automatische Stufe, keine Planänderung aus einem Test (wichtig für die
  MDR-Abgrenzung).
- **Keine Normwerte, keine Altersvergleiche, keine Ampel, kein „Risiko“.** Nur: „Letztes Mal 9, heute 11.“ Die Wörter
  „Test“ und „STEADI“ erscheinen in der App nicht.
- Bei `medical_clearance_recommended` ist das Aufstehen gesperrt, bis die Person den Arzt-Hinweis bestätigt hat.
- Bei Verschlechterung kein Alarm. Fester neutraler Satz: „Schwankungen sind normal. Wenn du dich im Alltag unsicherer
  fühlst, sprich mit deiner Ärztin oder deinem Arzt.“
- Vorschlag alle 4 Wochen (Erinnerung abschaltbar). Erinnerungstext ohne Gesundheitsbezug („Lust auf eine kurze
  Fortschritts-Runde?“).
- Ergebnisse sind **Gesundheitsdaten** (Abschnitt 14).

---

## 11. Ernährung

- **Energie:** Erhalt (`GOAL_ENERGY_ADJUSTMENT.active_aging = 0`). Schutzgrenzen unverändert (`clampCalorieTarget`).
- **Eiweiß:** 1,2 g/kg als Zielwert (PROT-AGE „≥ 1,2 g/kg bei Training“), ab 65 bleibt die Spanne 1,2–1,6 g/kg.
  Hinweis „Eiweiß über die Mahlzeiten verteilen, z. B. Milchprodukte, Hülsenfrüchte, Eier, Fisch“. Optional später:
  Essensplan bevorzugt Rezepte mit ≥ 25 g Eiweiß je Hauptmahlzeit (eigener Nachtrag).
- **Abnehmen nur als Nebenziel** (FA-G6, S14), neuer Eintrag in `GOAL_PAIR_RULES`: `active_aging` → `fat_loss` mit
  `energyAdjustment` **−0,10** (die 15-%-Grenze ab 65 greift zusätzlich), Eiweiß **1,2–1,5 g/kg** mit Nieren-Hinweis,
  Abnehm-Tempo höchstens „grün“ (**0,5 % Körpergewicht je Woche**), Ziel-BMI ≥ 22 ab 70 (F8). Alles
  PRODUKTENTSCHEIDUNG – Fachprüfung. Fester Satz: „Im Alter ist Muskelerhalt wichtiger als die Zahl auf der Waage.“
- **Trinken:** fester Hinweis „Das Durstgefühl lässt im Alter nach. Trink über den Tag verteilt.“ Keine Mengenangabe
  (Herz-/Nierenpatienten haben oft Vorgaben).
- **Ungewollter Gewichtsverlust:** fester Satz: „Wenn du ungewollt abnimmst, sprich mit deiner Ärztin oder deinem
  Arzt.“ Keine automatische Erkennung.
- **Supplements:** über Phase 6 (Vitamin D nur Info, SU-G15; Kreatin-Angabe ab 55 nach Prüfung, SU-G18). Das Flag
  `anticoagulant` wird dort **nicht** genutzt (S10).
- **Phase 9 (Wechseljahre):** keine Kopplung. Zyklus-Daten bleiben getrennt.

---

## 12. Barrierefreiheit (eigene Etappe FA5, nützt allen)

**Ziel:** WCAG 2.2 **AA** für Onboarding, „Heute“, Trainingsmodus, Fit-im-Alter-Bildschirme und Selbsttests,
ausdrücklich inkl. der neuen Kriterien **2.5.8** (Tippflächen), **2.4.11** (Fokus nicht verdeckt) und **3.3.8**
(Anmeldung ohne Gedächtnistest). Die vollständige Prüfung der ganzen App bleibt in Phase 12 (S12).

1. **Große Schrift:** Web-Export: Playwright mit **Browser-Zoom 200 %** und **Umbruch bei 320 CSS-px** (WCAG 1.4.4,
   1.4.10). Nativ: Checkliste am EAS-Build mit größter Systemschrift (iOS Dynamic Type, Android Schriftgröße);
   `maxFontSizeMultiplier` bewusst je Komponente setzen (Playwright kann die Systemschrift nicht nachstellen).
2. **„Große Ansicht“** in den Einstellungen (Vorschlag ab 60 und bei „Fit im Alter“): Grundschrift 20 statt 16 px,
   Tippflächen mindestens 56 px, weniger Elemente auf „Heute“ (eine Karte „Heute dran“), keine Wisch-Gesten nötig.
3. **Kontrast:** Text in der großen Ansicht 7 : 1 (AAA) – nur mit Token-Prüfung in `packages/ui` für hell **und**
   dunkel. Nie nur Farbe als Information.
4. **Einfache Sprache:** kurze Sätze, keine Fachwörter („Wiederholungen“ → „Mal“). Die RPE bleibt dieselbe Skala und
   wird erklärt: „Wie viele Mal könntest du noch? Etwa 4 → genau richtig.“ (S1). Textregel-Test: Satzlänge höchstens
   15 Wörter in Fit-im-Alter-Texten (gelb).
5. **Vorlesen (S11):** Knopf „Anleitung vorlesen“ und Timer-Ansagen über die **Sprachausgabe deines Geräts**
   (`expo-speech`). Im Web nur Stimmen mit `localService = true`, sonst Knopf ausblenden. Vorgelesen werden nur
   Übungsanleitungen und Timer, **keine Gesundheitsdaten**. In der Datenschutzerklärung nennen.
   Bildschirmleser-Beschriftungen für alle Knöpfe.
6. **Bilder:** Jede Fit-im-Alter-Übung braucht vor dem öffentlichen Start Bilder (Start- und Endposition) mit
   Alt-Text. Abhängig von G2. Videos später.
7. **Großdruck-PDF** des Plans über den bestehenden PDF-Export.
8. **Rechtlicher Rahmen:** BITV 2.0 gilt nur für öffentliche Stellen. Maßgeblich sind BFSG (seit 28.06.2025) und
   EN 301 549; ob und wie sie für die App gelten, wird **vor dem öffentlichen Livegang** geprüft.

---

## 13. Inhalte über die bestehende Pipeline

### 13.1 Schema-Erweiterung (FA2, nur additiv)

- Bewegungsmuster **`balance`** (neu); `mobility` und `carry` werden erstmals genutzt.
- Feld **`position`** je Übung (`standing` | `seated` | `floor`).
- Neue Merkmale (Caution-Tags), genau definiert:
  - `floor_transfer`: Übung beginnt oder endet am Boden (Liegen, Knien, Vierfüßler, Stütz am Boden) – z. B.
    `glute-bridge`, `dead-bug`, `bird-dog`, `unterarmstuetz`, `seitstuetz-knie`, `liegestuetz`. Nicht: Liegestütz an
    Wand oder Tisch.
  - `spinal_flexion`: Rumpfbeugung bis zum Bewegungsende, mit oder ohne Last (z. B. `good-morning-koerpergewicht`,
    `y-t-w-vorgebeugt`, Vorbeugen mit rundem Rücken).
  - `loaded_flexion`: Rumpfbeugen unter Last (Teilmenge, für klare Texte).
  - `trunk_rotation`: Drehen bis zum Anschlag oder schnelles Drehen.
  - `deep_hip_flexion`: Hüftbeugung über 90° (tiefer Stuhl, tiefe Kniebeuge).
  - `hip_cross_midline`: Bein über die Körpermitte oder Einwärtsdrehen der Hüfte.
- Bestehende Übungen bekommen die neuen Merkmale (neue Version, gleiche Texte). Für Nutzer ohne passendes Flag oder
  Ziel ändert sich nichts. Welche Übung welches Merkmal bekommt und was dann gilt, steht in 13.4 (N2).
- **Vorlage je Übungseintrag:** Feld **`support`** (`none` | `chair_nearby` | `hold_on`, K6), Feld `section`
  (`warmup`, `balance`, `strength`, `mobility`), `progression_level` (1–4) für Gleichgewicht.
- `SESSION_FOCUSES` + `balance` (Variante B aus 7.3).

### 13.2 Neue Prüfregeln (nur für Ziel `active_aging`)

| Nr. | Regel                                                                                                                                          | Stufe |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| V14 | RPE höchstens 6                                                                                                                                | rot   |
| V15 | Jede Kraft-Einheit hat mindestens 2 Übungen mit Muster `balance`, die auch nach dem Kürzen auf `minutes_min` bleiben (S8)                      | rot   |
| V16 | Keine Übung mit `high_impact`, `high_skill`, `spinal_loading`, `overhead`, `long_supine`, `floor_transfer`, `spinal_flexion`, `trunk_rotation` | rot   |
| V17 | Jede `balance`-Übung hat in der Vorlage `support` ≠ `none`                                                                                     | rot   |
| V18 | Eigene Wochensatz-Spanne (Startwert große Muskelgruppen 4–10, kleine ohne Untergrenze) statt V9/V10                                            | rot   |
| V19 | Jede Einheit endet mit mindestens 1 Übung `mobility`, die beim Kürzen bleibt                                                                   | gelb  |
| V20 | Jede Kraftübung hat eine leichtere Alternative (`easier`) im Sitzen oder mit Halt                                                              | gelb  |
| V21 | Isometrische Kraft-Halteübungen höchstens 30 s; Gleichgewichts-Stand 10–30 s                                                                   | rot   |
| V22 | Dehnungen der Oberschenkel-Rückseite und Aufnehm-Übungen haben kein `spinal_flexion` und den Satz „Rücken gerade“ (S2)                         | rot   |
| Ü7  | Textregel: kein „Sturzprävention garantiert“, „verhindert Stürze“, „gegen Arthrose/Osteoporose“ (Ü6 erweitert)                                 | rot   |

Grenzwerte zentral in `constants.ts` mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.

### 13.3 Ablauf

1. `content-generate` → Art `exercises`, Auswahl „active_aging“ (Matrix-Eintrag neu), dann Art `plan-templates`,
   Auswahl „fit-im-alter“. Erst Probelauf, dann 3 echte Anfragen.
2. `content-collect` → Entwürfe als Pull Request. `content:validate` prüft V14–V22 und Ü7.
3. Gründer prüfen im Testmodus der App (Entwürfe sichtbar, gekennzeichnet). **Die Gründer dürfen ohne Fachprüfung
   testen.**
4. **Fachprüfung** durch Physiotherapie oder Sportmedizin (Geriatrie-Erfahrung): Übungsliste, Sicherheitsregeln,
   Zusatzfragen, Selbsttests – **bevor ältere Testpersonen trainieren** (S6). Ergebnis in `meta.expert_reviewed`.
5. Freigabe per Merge, `content-seed`.

Gemini-Kosten für ca. 30 Übungen + 12 Vorlagen: deutlich unter dem Standard-Deckel `CONTENT_MAX_USD` (3 $).

### 13.4 Bestehende Übungen mit neuen Merkmalen (N2)

Die Ausschlüsse aus `bone_health` und `hip_replacement` gelten **bei jedem Ziel** (8.2). Heute streicht
`plan/adapt.ts` ausgeschlossene Übungen ohne Ersatz still. Deshalb listet FA2 je Merkmal die betroffenen bestehenden
Übungen auf (Startliste, die Fachprüfung ergänzt):

| Merkmal             | Bestehende Übungen (Vorschlag)                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `floor_transfer`    | `glute-bridge`, `glute-bridge-einbeinig`, `dead-bug`, `bird-dog`, `unterarmstuetz`, `seitstuetz`, `seitstuetz-knie`, `liegestuetz`, `hueftstrecken-vierfuessler`, `bodendruecken-kurzhantel`   |
| `spinal_flexion`    | `good-morning-koerpergewicht`, `good-morning-band`, `y-t-w-vorgebeugt`                                                                                                                         |
| `loaded_flexion`    | `good-morning-band`, `kniebeuge-langhantel` (nur bei rundem Rücken – Fachprüfung), Rudern vorgebeugt (`langhantelrudern`, `vorgebeugtes-rudern-kurzhantel`)                                    |
| `trunk_rotation`    | derzeit keine bestehende Übung (Prüfung in FA2)                                                                                                                                                |
| `deep_hip_flexion`  | `kniebeuge-langhantel`, `kniebeuge-pause`, `kniebeuge-tempo`, `goblet-kniebeuge`, `kniebeuge-koerpergewicht`, `bulgarische-split-kniebeuge`, `bulgarische-split-kniebeuge-stuhl`, `beinpresse` |
| `hip_cross_midline` | derzeit keine bestehende Übung (Prüfung in FA2)                                                                                                                                                |

Regeln:

1. **Sicherheit geht vor Behalten.** Anders als bei `floor_transfer` ab 65 (B4, dort „behalten + Hinweis“) gilt bei
   diesen Gesundheits-Ausschlüssen: **Ersatz mit gleichem Bewegungsmuster**, sonst **streichen mit Hinweis**
   („Übung wegen deiner Angaben ersetzt/entfernt“). Nie still.
2. `SESSION_FIT.minExercises` (3) und K3 („letzte Rumpfübung bleibt“) bleiben gewahrt; fehlt ein erlaubter Ersatz,
   rückt eine erlaubte Übung aus der Bibliothek nach (gleicher Hauptmuskel).
3. **Wirkung:** ab dem nächsten Block bzw. bei der Neuplanung nach einer geänderten Antwort im Gesundheits-Check –
   nie mitten im laufenden Block ohne Neuplanung.
4. **Regressionstest:** alle Vorlagen × jedes dieser Flags (einzeln und zusammen) erzeugen einen gültigen Plan ohne
   ausgeschlossene Übung, mit Hinweis bei jeder Änderung.

---

## 14. Datenschutz (DSGVO Art. 9)

- **Gesundheitsdaten:** Antworten der Zusatzfragen (in `health_screening`) und Selbsttests (neue Tabelle
  `function_tests`). Nur mit Einwilligung `health_data`, RLS, nie in Logs/Analytics, nie im Partner-Modus, nie im
  Trainings-PDF.
- **Export, Widerruf, Löschen:** in den Export; `revoke_export_union` erweitern; beim Widerruf und mit dem Konto
  löschen – **auch auf dem Gerät** (`localDb`, Offline-Speicher). pgTAP und Core-Test (S10).
- **Kein Gesundheitsdatum:** das Ziel selbst. Pläne mit Bezug zum Gesundheits-Check gelten wie heute vorsorglich als
  Gesundheitsdaten.
- **Zweck:** Das Flag `anticoagulant` dient **nur dem Training** (Halt-Pflicht, Hinweise), nicht den
  Supplement-Hinweisen aus Phase 6. So steht es im Einwilligungstext.
- **Einwilligungstext (B1, FA-G10):** Die neuen Datenarten (Sturz, Unsicherheit, Gehhilfe, OP, künstliche Hüfte,
  Osteoporose, Blutverdünner, Selbsttests) kommen in die Fassung **`health_data` v2** aus Phase 6 – dafür muss
  FA-G10 **vor Phase 6 SU3** entschieden sein. Dann gibt es nur eine Karte zum erneuten Zustimmen. Sonst v3.
- DSFA ergänzen. Juristische Prüfung des Texts **vor dem öffentlichen Livegang**.

---

## 15. Gratis / Premium

Bis zum Ende der Testphase ist alles kostenlos und uneingeschränkt (`premium_open`, Gründer-Entscheidung 19.10.2026).

**Vorschlag für später (FA-G11):** „Fit im Alter“ bleibt dauerhaft **gratis** – Plan, Selbsttests, Große Ansicht,
Vorlesen. Es braucht keine KI und keine Server-Kosten. Premium-Funktionen gelten wie für alle Ziele (z. B.
Live-Anpassung). Barrierefreiheit darf nie hinter einer Bezahlschranke liegen.

---

## 16. Zielgruppe und Marketing (kurz)

- Etwa jede fünfte Person in Deutschland ist 65 oder älter (Destatis). Wenige Fitness-Apps sprechen sie an.
- Botschaft: **Selbstständigkeit im Alltag** („sicher Treppen steigen, Einkäufe tragen, mit den Enkeln spielen“),
  nicht Angst vor Stürzen.
- **Keine Wirkungsaussage zu Stürzen** (4.2). Erlaubt: „trainiert Kraft und Gleichgewicht“.
- Käufer sind oft **erwachsene Kinder** („Richte die App für deine Eltern ein“): einfache Einrichtungs-Anleitung auf
  der Landingpage. Kein Teilen von Daten zwischen Kind und Eltern.
- Marke Alpha5 wirkt sportlich: eigene Unterseite, eigene Bilder mit älteren Menschen.
- Später denkbar: Präventionskurs mit Krankenkassen-Zuschuss (§ 20 SGB V, ZPP-Zertifizierung) – eigenes Projekt.

---

## 17. Etappen

| Etappe  | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Größe                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **FA0** | Dieser Plan, Gründer-Entscheidungen, Wächter-Prüfung, Zweckbestimmung in KONZEPT 14 (K7). Parallel: Fachprüfung anfragen; FA-G10 an Phase 6 SU3 melden.                                                                                                                                                                                                                                                                                                                                                     | 1 PR                                 |
| **FA1** | Core: Ziel `active_aging` (Enums, Mapping, Energie, Eiweiß, Paar, Planname, Tage-Vorschlag, `local-rules.ts`), `ACTIVE_AGING_RULES` (RPE 6, Merkmale, Halten, Ausdauer-Startgruppe und Erholungs-Rhythmus getrennt vom Flag `cautious`, N1), neue Flags mit Wirkung je Flag, Fokus `balance`, Kürzen-Schutz (S8), Gleichgewicht vor Geh-Einheiten (Textvarianten je Flag, N3), Progressions-Stufen mit Bestätigung, alle Tausch-Wege (8.4), R1-Sperre, Selbsttest-Schemas. Tests.                           | 2–3 PRs                              |
| **FA2** | Inhalte: Schema-Erweiterung (13.1), Prüfregeln V14–V22 + Ü7, Matrix-Eintrag, neue Merkmale an bestehenden Übungen mit Liste und Ersatz-Regel (13.4, N2), Regressionstest Vorlagen × Flags; dann Startbestand (ca. 30 Übungen, 8–12 Vorlagen) als Entwurf.                                                                                                                                                                                                                                                   | 2 PRs + 1–2 Inhalts-PRs              |
| **FA3** | Datenbank (eigene Migrationsdatei für Enum-Werte): `goal_type`, Muster, Merkmale, `session_focus` (N3); CHECK `plan_templates.goal_type`; Fragebogen-Fassung + neue Fragen in `health_screening` + Trigger; Tabelle `function_tests` mit RLS; Server-Prüfungen aus 8.3 (mehrere RPC-Neufassungen; die R1-Sperre ab 65/vorsichtig kommt vorab als 4b-Nachtrag, N4); `goal_pair_allowed`, Autoclear-Trigger, `seed_content()`; Export/Widerruf (`revoke_export_union`); pgTAP-Gegenproben; `db-sync.test.ts`. | 2–3 PRs                              |
| **FA4** | App: Ziel-Auswahl mit Vorschlag ab 60, Zusatzfragen (auch Karte für Bestandsnutzer, Zielwechsel), Stopp-Karte, Halt-Hinweis groß, Gleichgewichts-Stufen, Frage „nächste Stufe?“, „Mein Fortschritt“ mit Timer und Verlauf, Löschen auf dem Gerät, Testmodus. Zustände.                                                                                                                                                                                                                                      | 2 PRs                                |
| **FA5** | Barrierefreiheit (Abschnitt 12): Große Ansicht, Zoom/Systemschrift, Kontrast-Tokens, Vorlesen, Großdruck-PDF. App-weit, **vor FA4** fertig.                                                                                                                                                                                                                                                                                                                                                                 | 1–2 PRs                              |
| **FA6** | Bilder für alle Fit-im-Alter-Übungen (setzt G2 voraus), Fachprüfung eingearbeitet, Freigabe `published`, Doku. Danach (FA-G16): `floor_transfer`-Ersatz ab 65 für alle Ziele mit neuer Engine-Version und Regressionstest.                                                                                                                                                                                                                                                                                  | 1–2 PRs (+ G2 eigener Plan, 2–3 PRs) |

**Summe:** etwa **13–16 Pull Requests** für FA0–FA6, dazu G2 (2–3) und 1–2 Inhalts-PRs (S13).

### 17.1 Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (Ziel, Zusatzfragen optional mit Fassung, Selbsttests, Schema-Felder).
2. Migration nur additiv, mit RLS und pgTAP; Enums gleich in `enums.ts`.
3. **Jede Sicherheitsgrenze im Core und im SQL** geprüft, mit pgTAP-Gegenprobe (B3).
4. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen: **sehr alt (95, 100 Jahre)**, 59/60/64/65/69/70
   (Altersgrenzen am Geburtstag), sehr leicht/schwer (40 kg, 150 kg), 1 vs. 3 vs. 7 Wunschtage, jedes neue Flag
   einzeln und alle zusammen, Ziel mit 55 Jahren, Kürzen auf 20 min, **70-Jähriger ohne Flag mit Level „aktiv“** →
   aktiv-Vorlage, Erholung nach 4 Wochen, Ausdauer vorsichtig (N1).
5. **Eigenschaftstest:** Mit „Fit im Alter“ ist kein Plan je **weniger vorsichtig** als derselbe Plan mit
   „Allgemeine Fitness“ – RPE, Ausschlüsse, Einheiten, **Erholungs-Rhythmus und Ausdauer-Startgruppe** (S7).
6. UI mobil + Web-Export, Playwright im Testmodus (inkl. Zoom 200 % und 320 px), Checkliste am EAS-Build.
7. Lade-, Leer-, Fehler-, Offline- und Einwilligungs-Zustände.
8. Texte auf Deutsch, einfache Sprache, Textregeln grün (Ü6, Ü7).
9. Doku: dieser Plan (Umsetzungsstand), KONZEPT 4/5/13/14, HANDY-ANLEITUNG („Fit im Alter testen“), PROMPTS.
10. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 18. So testet ihr es am Handy (nach FA4)

Chrome am Handy, Vorschau-Link aus dem Pull Request, **Inkognito-Tab** (Chrome → ⋯ → Neuer Inkognito-Tab).

1. „Ohne Konto testen“ → Geburtsdatum **72 Jahre** → Einwilligung Gesundheitsdaten zustimmen.
2. Gesundheits-Check: alles „nein“ → die Zusatzfragen (Sturz, Unsicherheit, Gehhilfe, OP, Hüfte, Knochen,
   Blutverdünner) erscheinen.
3. Ziel-Schritt: oben steht „Passt ‚Fit im Alter‘ zu dir?“ → antippen → 2 Kraft-Tage + 2 Geh-Tage, zu Hause ohne
   Geräte.
4. „Heute“: Plan „Fit im Alter · 2 Tage“; die Geh-Einheiten beginnen mit „Gleichgewicht + Gehen“.
5. Einheit starten → Stopp-Karte → „Verstanden“ → jede Gleichgewichtsübung zeigt groß „Mit Halt“.
6. RPE auswählen → höchstens 6 („noch etwa 4 Mal“).
7. Neuer Tab → gleiche Angaben, aber Sturz-Frage „ja“ → Arzt-Hinweis bestätigen → Gleichgewicht nur Stufe 1–2.
8. Neuer Tab → 62 Jahre, Ziel Muskelaufbau, Blutverdünner „ja“ → Plan bleibt Muskelaufbau, nicht Einsteiger.
9. „Mein Fortschritt“ → „30 Sekunden Aufstehen“ → Timer mit Ansage → Zahl eintippen → Verlauf zeigt nur die eigene
   Zahl, der Plan ändert sich nicht.
10. Einstellungen → „Große Ansicht“ an → Schrift größer, „Heute“ zeigt eine Karte.

---

## 19. Risiken

1. **Sturz während einer Übung (Haftung).** _Gegenmittel:_ Halt-Pflicht, keine Bodenübungen, Stufen mit Bestätigung,
   Stopp-Karte, Umgebung, Fachprüfung vor Tests mit Älteren; Haftung **vor dem öffentlichen Livegang** prüfen lassen.
2. **Abgrenzung Medizinprodukt (MDR, Regel 11).** _Gegenmittel:_ keine Werte, keine Normen, Tests steuern nie den
   Plan, Zweckbestimmung (3.3); Prüfung vor dem öffentlichen Livegang.
3. **Werbeaussagen** („beugt Stürzen vor“). _Gegenmittel:_ Ü7, 4.2, Abschnitt 16.
4. **Bedienung zu schwer.** _Gegenmittel:_ FA5, feste Reihenfolge, Vorlesen, Test mit Rentnern (FA-G13).
5. **Übungen nur als Text schwer verständlich.** _Gegenmittel:_ Bilder Pflicht vor öffentlichem Start (G2).
6. **Wirkung geringer als in Studien** (weniger Umfang, keine Anleitung vor Ort, K1). _Gegenmittel:_ keine
   Wirkungsaussage, Gleichgewicht an 3 Tagen, Hinweis auf Kurse vor Ort als Ergänzung.
7. **Konflikte mit laufenden Etappen** (B1). FA1 berührt `adjust/` und Plan-RPCs (4b ist gemergt), die Einwilligung
   v2 (Phase 6 SU3) und später den Wearable-Import (Phase 8). _Gegenmittel:_ Reihenfolge in FA-G1, Variante B ohne
   neue Einheit-Art.
8. **Regression bei Bestandsplänen ab 65** (B4). _Gegenmittel:_ `floor_transfer`-Ersatz erst nach veröffentlichten
   Ersatzübungen, nie still streichen, Regressionstest.
9. **Mehr Gesundheitsdaten, Änderung für alle ab 60** (S4). _Gegenmittel:_ Ja/Nein-Fragen, überspringbar, Wirkung je
   Flag gezielt, Löschen auch auf dem Gerät.

---

## 20. Was wir von euch brauchen (Gründer-Entscheidungen)

Format: _Worum es geht – Warum wir fragen – Empfehlung._ Alle Fragen sind am 21.10.2026 entschieden („1-7 machst du“,
jeweils wie empfohlen).

- **FA-G1 Lohnt sich das jetzt – und in welcher Reihenfolge?** – _Aufwand:_ etwa 13–16 Pull Requests, dazu Bilder
  (G2, 2–3 PRs), Inhalts-PRs und eine Fachprüfung. _Nutzen:_ eine große Gruppe, die von Fitness-Apps kaum angesprochen
  wird; echter Mehrwert im Alltag; die Barrierefreiheit verbessert die App für alle; die Testphase (alles gratis) ist
  günstig, um echte Rentner einzubinden. _Dagegen:_ Phase 6 läuft (SU1), Phase 8/9 sind in Freigabe; ohne Bilder ist
  die Kategorie nur halb brauchbar; die Marke spricht eher Sportler an. – **Empfehlung: ja, in dieser Reihenfolge:**
  1. **Jetzt:** FA0 freigeben, Fachprüfung anfragen. **FA-G1 und FA-G10 vor Phase 6 SU3 entscheiden**, damit die
     neuen Datenarten in `health_data` v2 kommen (nur eine Zustimmungs-Karte).
  2. Die 4b-Etappen B, D und E sind gemergt – FA1 kann ohne Konflikt in `adjust/` starten; mit dem laufenden SU1 nur
     `constants.ts` abstimmen.
  3. Phase 6 SU1–SU4 normal weiter, mit der v2-Fassung inkl. FA-Datenarten. **FA5** jederzeit parallel, aber
     **vor FA4** fertig.
  4. **FA1 → FA2 → FA3 → FA4** nach Phase 6 SU3/SU4 und **vor Phase 8** (Phase 8 bindet viel Kraft und muss den
     Fokus `balance` gleich mit importieren). Phase 9 (Zyklus) überschneidet sich kaum und kann davor, parallel oder
     danach kommen.
  5. **FA6** mit G2, unabhängig.

  Wenn euch Phase 8/9 wichtiger sind: Plan liegen lassen, nichts geht verloren – dann FA-G10 trotzdem vor SU3
  entscheiden oder später eine v3 in Kauf nehmen.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen „ja, umsetzen“.**

- **FA-G2 Altersgrenze.** – Eine Sperre kostet Aufwand ohne Sicherheitsgewinn. – **Empfehlung:** für alle wählbar,
  **aktiver Vorschlag ab 60**; Altersregeln ab 65 bleiben für alle Ziele.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G3 Zusatzfragen im Gesundheits-Check.** Sieben Fragen (8.2), gestellt bei diesem Ziel oder **ab 60 bei jedem
  Ziel**. – Ohne sie können wir Stürze und Knochen nicht berücksichtigen; mit ihnen ändern sich auch Pläne anderer
  Ziele ab 60. – **Empfehlung:** ja; nur Sturz, Unsicherheit, Gehhilfe und OP < 12 Monate machen den Plan vorsichtig,
  die anderen wirken gezielt; überspringbar; Karte für Bestandsnutzer; Wortlaut durch die Fachprüfung.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G4 Gleichgewicht an 3 Tagen.** Neue Einheit-Art oder nicht? – Eine neue Art berührt viele Datenbank-Stellen
  (7.3). – **Empfehlung:** **Variante B** (Kraft-Einheit mit Fokus `balance` + Gleichgewicht vor jeder Geh-Einheit),
  keine neue Einheit-Art; Variante C (nur 3-Tage-Vorlagen) als Sparvariante.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G5 Orte.** – Studio-Vorlagen kosten ein Drittel der Inhalte. – **Empfehlung:** ohne Geräte und Zuhause zuerst
  (8 Vorlagen), Studio später.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G6 Nebenziele.** – Abnehmen kann bei Älteren Muskeln kosten. – **Empfehlung:** nur **Abnehmen als
  Nebenziel** mit −10 % Energie, Eiweiß 1,2–1,5 g/kg, Tempo höchstens 0,5 %/Woche, Ziel-BMI ≥ 22 ab 70.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G7 Anstrengung.** – Die App-RPE misst Wiederholungen in Reserve, ACSM eine andere Skala. – **Empfehlung:**
  RPE 6 („noch etwa 4 Mal“) als Produktentscheidung; die Regel ab 65 (7) für andere Ziele unverändert; keine neue
  Skala.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G8 Bodenübungen.** – Hinlegen und Aufstehen ist für viele schwer. – **Empfehlung:** keine Bodenübungen in „Fit
  im Alter“; „Aufstehen nach einem Sturz“ erst später als Ratgeber-Text nach Fachprüfung. Für andere Ziele ab 65
  siehe FA-G16.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G9 Vorlesen.** – Hilft beim Training ohne Blick aufs Handy. – **Empfehlung:** ja, in FA5, nur Gerätestimmen
  (im Web `localService`), nur Anleitungen.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G10 Einwilligung.** – Zwei Zustimmungs-Karten hintereinander nerven. – **Empfehlung:** Datenarten in
  `health_data` v2 aufnehmen; dafür **vor Phase 6 SU3** entscheiden. Juristische Prüfung vor dem öffentlichen
  Livegang.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G11 Gratis oder Premium (nach der Testphase).** – Bis dahin ohnehin alles offen. – **Empfehlung:** dauerhaft
  gratis; Barrierefreiheit nie hinter der Bezahlschranke.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G12 Selbsttests.** – Fortschritt motiviert; Normwerte oder Planänderungen wären eine Bewertung (MDR). –
  **Empfehlung:** Aufstehen (nicht bis zur Erschöpfung), Stand-Stufen, Einbeinstand mit Halt; alle 4 Wochen
  vorgeschlagen; keine Normwerte; steuern nie den Plan.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G13 Test mit echten Nutzern.** – Gründer sind nicht die Zielgruppe. – **Empfehlung:** 2–3 Rentnerinnen und
  Rentner aus dem Umfeld, **nach der Fachprüfung** von Übungen und Regeln; Beobachtungen als Liste im Pull Request.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G14 Bilder als Bedingung.** – Text allein reicht für viele Ältere nicht. – **Empfehlung:** öffentlicher Start
  nur mit Bildern; für Tester geht es ohne.
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G15 Frage nach Gehhilfe.** – Wer mit Stock oder Rollator geht, braucht strengere Gleichgewichts-Grenzen. –
  **Empfehlung:** ja, als siebte Zusatzfrage (Flag `walking_aid`).
  **Gründer-Entscheidung 21.10.2026: wie empfohlen.**
- **FA-G16 Bodenübungen ab 65 in allen Zielen ersetzen – wann?** – Heute sind alle Rumpfübungen der
  Körpergewicht-Einsteiger-Vorlagen Bodenübungen; ohne Ersatz würden sie still verschwinden. – **Empfehlung:** erst
  nach Veröffentlichung der Ersatzübungen (nach FA2/FA6), mit neuer Engine-Version, ab dem nächsten Block, „sonst
  behalten + Hinweis“, Regressionstest. Bis dahin bleiben heutige Pläne ab 65 unverändert.

---

**Gründer-Entscheidung 21.10.2026: wie empfohlen.**

## 21. Was ihr selbst tun müsst

1. ~~FA-G1 bis FA-G16 entscheiden~~ – **erledigt 21.10.2026** (alle wie empfohlen). FA-G10 an Phase 6 SU3 melden
   (neue Datenarten in `health_data` v2).
2. **Fachprüfung anfragen:** Physiotherapie oder Sportmedizin mit Erfahrung bei Älteren. Prüft Übungsliste (7.1),
   Sicherheitsregeln (8), Zusatzfragen (8.2), Progression (9), Selbsttests (10), Ernährungswerte (11). **Nötig, bevor
   ältere Testpersonen trainieren** – nicht für eure eigenen Tests.
3. **Vor dem öffentlichen Livegang** (nicht vorher): Haftung und Nutzungsbedingungen, MDR-Abgrenzung, Werbeaussagen,
   Einwilligungstext, BFSG/EN 301 549 prüfen lassen.
4. **Testpersonen finden** (FA-G13).

---

## 22. Umsetzungsstand

| Etappe  | Stand (21.10.2026)                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FA0** | Erledigt: Gründer-Entscheidungen eingetragen (Abschnitt 20), Zweckbestimmung in `docs/KONZEPT.md` 14 (K7), PROMPTS-Stand. Offen (Gründer): Fachprüfung anfragen, FA-G10 an Phase 6 SU3 melden. |
| FA5     | offen                                                                                                                                                                                          |
| FA1     | offen                                                                                                                                                                                          |
| FA2     | offen                                                                                                                                                                                          |
| FA3     | offen                                                                                                                                                                                          |
| FA4     | offen                                                                                                                                                                                          |
| FA6     | offen                                                                                                                                                                                          |
