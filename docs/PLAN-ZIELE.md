# Plan „Ziele erweitern“: Abnehmen mit oder ohne konkretes Ziel, Erreichbarkeits-Ampel, zwei Ziele

**Status:** Plan **Wächter-geprüft (Auflagen eingearbeitet)**. **Z1 und Z2 umgesetzt und Wächter-geprüft** (Abschnitte 11 und 12). **Z3 umgesetzt am 17.10.2026** (Abschnitt 13, Wächter-Prüfung steht aus). **F8 entschieden am 17.10.2026:** Ziel-BMI hart 20, ab 70 Jahren 22 (Abschnitt 0). Die Wächter-Prüfung vom 13.10.2026 ergab „Freigabe mit Auflagen“ (Blocker B1, Soll S1–S20, Kann K1–K10). Die Nachprüfung (Runde 2, gleicher Tag) ergab erneut „Freigabe mit Auflagen“ ohne Blocker (Soll N1–N4, Kann K-a bis K-f). Alle Auflagen beider Runden sind in diesem Dokument eingearbeitet, Übersicht in Abschnitt 10. Gründer-Entscheidungen vom 13.10.2026 in Abschnitt 0.
**Gründer-Wunsch (wörtlich):** „Baue folgendes beim Ziel Abnehmen noch ein: Auswahl Abnehmen ohne konkretes Ziel, Abnehmen mit konkretem Ziel mit dem Gewicht in kg abnehmen in welcher Zeit. Und auf einer Skala von rot bis grün soll angegeben werden wie gut das erreichbar ist. Zudem sollte man 2 Ziele auswählen können. Die Übungen im Trainingsplan sollen für beide Ziele passen.“
**Etappen:** Z0–Z6 (Abschnitt 7).

---

## 0. Gründer-Entscheidungen vom 13.10.2026

| Nr.                        | Entscheidung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Wirkt in                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **F1**                     | **Haupt- und Nebenziel** (wie empfohlen). Die Vorlage folgt dem Hauptziel, das Nebenziel ergänzt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 4                       |
| **F5**                     | **„Nie schneller als heute.“** Ein konkretes Abnehmziel darf das Defizit **nur verkleinern**, nie über die Standard-Anpassung des Ziel-Profils hinaus vergrößern (z. B. Abnehmen −20 % bzw. der Kombinationswert aus 4.4). Geplantes Tempo = min(benötigtes Tempo, Tempo der Standard-Anpassung); danach immer `clampCalorieTarget`. `WEIGHT_GOAL_PACE_MAX_PLANNED` entfällt. Die Kapazität C der Ampel ist das Tempo, das die Standard-Anpassung nach den Schutzgrenzen an einem Ruhetag liefert. Präzisiert nach der Wächter-Prüfung (S6): Gerechnet wird mit dem strengsten Stand im Zeitraum, also am Zielgewicht (3.1). | 2.4, 3.1–3.3, 7 (Z2), 9 |
| **F7**                     | **Ja, Dauer als Planungsdauer** („Sicher planbar sind etwa N Wochen“). Keine Gewichtskurve, kein Countdown, keine Gewichtsprognose („Du wiegst am … X kg“), kein Kalenderdatum zur Dauer (Wächter S20). Gründer-Entscheidung 3 aus Phase 5 („keine Gewichts-Prognosen“) wird so präzisiert; Verweis in `docs/PLAN-PHASE-5.md` 4.6 Nr. 3 und 4.9.                                                                                                                                                                                                                                                                             | 3.1, 3.4, 6             |
| **F12**                    | **Logik jetzt:** Z1 und Z2 (nur Core) parallel zu Phase 5. Nachtrag nach der Wächter-Prüfung: Z1 enthält zusätzlich eine kleine DB-Funktions-Migration (`assert_plan_inputs`, B1). Das weicht von „nur Core“ ab und wird den Gründern in einem Satz mitgeteilt (Wächter Runde 2, K-c). Notfalls ginge es auch ohne, weil der Payload den Schlüssel bei `null` weglässt. **App** (Z3–Z5, Z6 Doku) **nach Phase 5 und vor Phase 10**.                                                                                                                                                                                          | 7                       |
| F2–F4, F6, F9–F11, F13–F15 | **Wie empfohlen** (Abschnitt 8). Den Gründern wurden nur die vier wichtigsten Fragen gestellt; die übrigen gelten als „wie empfohlen“, bis sie widersprechen. F6 wurde nach der Wächter-Prüfung technisch präzisiert (Orange in zwei Fällen, S4).                                                                                                                                                                                                                                                                                                                                                                            | 8                       |
| **F8**                     | **Entschieden am 17.10.2026: wie vom Wächter empfohlen** (S12): Ziel-BMI hart **20**, ab **70 Jahren** hart **22** (GLIM 2019; maßgeblich ist das Alter am Zieldatum). Die frühere vorläufige Grenze 18,5 und der Hinweis „18,5 bis unter 20“ entfallen. Umgesetzt in Z3 (Core, `WEIGHT_GOAL_LIMITS.minTargetBmi`).                                                                                                                                                                                                                                                                                                          | 2.3, 3.2, 8             |

---

## 1. Ist-Zustand (geprüft am 13.10.2026)

### 1.1 Ziele und Datenmodell

- `GOAL_TYPES` in `packages/core/src/enums.ts`: `fat_loss` (App: „Abnehmen“), `definition`, `muscle_gain`, `general_fitness` („Fitness & Gesundheit“), `endurance`. Dazu gibt es das Postgres-Enum `public.goal_type`; der Abgleich läuft über `db-sync.test.ts`.
- Tabelle `public.goals` (`supabase/migrations/20261003120400_training_preferences.sql`):
  - eine Zeile pro Nutzer: `goal_type` (Pflicht), `discipline` (nur bei `endurance`, CHECK), `target_date` (optional, Wettkampfdatum), `training_location`; die Zeitbudget-Spalten sind seit `…20261005120000_training_slots.sql` entfernt.
  - RLS: nur eigene Zeilen. **Kein Gesundheitsdatum**, keine Einwilligung nötig.
- Zod: `createGoalStepSchema(today)` in `packages/core/src/validation.ts` (Disziplin nur bei Ausdauer, Datum nicht in der Vergangenheit).
- Onboarding: Schritt `goal` in `ONBOARDING_STEPS` (`packages/core/src/onboarding.ts`) nach `health_screening` und `experience`. Körperdaten und Gesundheits-Check liegen also schon vor, wenn das Ziel gewählt wird. Die Liste ist als CHECK `profiles.onboarding_step` gespiegelt; `db-sync.test.ts` verlangt **Gleichheit** beider Listen.
- App:
  - `GoalStep` in `apps/mobile/src/steps/training-steps.tsx` (ChoiceList, bei Ausdauer zusätzlich Disziplin und Datum), Texte in `apps/mobile/src/i18n/de.ts` (`steps.goal`).
  - `apps/mobile/src/data/mapping.ts`: `toGoalsRow`, Rückweg `answers.goal`.
  - Testmodus: `local-backend.ts` und `write-ops.ts` (`upsert_goals`).
  - Zusammenfassung in `lib/summary.ts`.
  - Einstellungen → „Angaben ändern“ (`app/settings.tsx`) führt durch dieselben Schritte.

### 1.2 Trainingsplan

- `planInputsSchema` (`packages/core/src/plan/inputs.ts`) enthält `goalType` und `discipline`, aber **keine Körperdaten** (bewusst).
- Der Schnappschuss `user_plans.inputs` wird von `private.assert_plan_inputs` geprüft (zuletzt `…20261005130100_plan_session_kinds.sql`). Die Funktion arbeitet mit einer **festen Schlüsselliste**: `private.assert_json_keys` lehnt jeden unbekannten Schlüssel ab („Unbekanntes Feld in der Eingabe“), und `?&` verlangt alle Pflichtschlüssel. Ein neuer Schlüssel im Payload bricht deshalb `save_training_plan`, solange die DB-Funktion ihn nicht kennt (Wächter B1, Lösung in 5.1 und Z1).
- Die Web-App baut `core` direkt von `main`. Jede Änderung an Schnappschuss oder Payload ist mit dem Merge sofort in Produktion.
- Matching (`plan/match.ts`): `GOAL_TEMPLATE_MAPPING` (definition → muscle_gain „mapped“, endurance → general_fitness „fallback“), Punkte `PLAN_MATCH_WEIGHTS.goal = 35`.
- `generate.ts`: Hinweise `goal_endurance_not_yet` und `endurance_basic_only` nur bei `goalType === 'endurance'`.
- `endurance.ts`: Disziplin bestimmt die Modalität.
- `training-schedule.ts`: `suggestedSlotKind`, `suggestedTrainingSlots` (Ausdauer-Vorbelegung über `suggestionGroup` inkl. `cautious` und `ENDURANCE_START_RULES`), `scheduleHints` (`endurance_goal_no_endurance`, `strength_goal_no_strength` für muscle_gain und definition).
- `plan/title.ts`: „Ausdauer-Grundlage“.
- **Vorlagen-Befund** (42 Vorlagen in `content/plan-templates/`, nachgezählt nach Wächter S17):
  - **Studio und Zuhause: 24 Vorlagen** (8 Kombinationen aus Level, Tagen und Ort × 3 Vorlagen-Ziele). Die Übungslisten sind über die drei Ziele **identisch**. Unterschiede gibt es nur bei Wiederholungen, Pausen, RPE und Sätzen. Beispiel 3 Tage Studio Einsteiger: Fettverlust 10–12 Wdh./90 s/RPE 7; Muskelaufbau 8–12/120 s/RPE 7; Fitness 10–15/90 s/RPE 6,5.
  - **Körpergewicht: 18 Vorlagen** (6 Kombinationen × 3 Ziele). Hier weichen die Übungslisten ab, zwischen Fettverlust und Muskelaufbau um **bis zu 5 Übungen**. Beispiel Einsteiger 3 Tage: Step-up nur bei Fettverlust; Liegestütz, Seitstütz Knie, Split-Kniebeuge und Y-T-W nur bei Muskelaufbau. Muskelaufbau Fortgeschritten 2 Tage hat außerdem 30–60 statt 30–45 Minuten.
  - Alle Vorlagen sind Ganzkörperpläne. Ob jede Vorlage alle Haupt-Bewegungsmuster enthält, belegt in Z1 ein Test (4.3).
- Planänderung: `planOffer`/`planUpdateOffer` vergleicht den Schnappschuss. Ein geänderter `goalType` führt zum Angebot „Plan neu erstellen?“.

### 1.3 Ernährung (Phase 5, N1–N4 umgesetzt)

- `nutritionInputsSchema.goalType` → `nutritionTargetsForWeek` (`nutrition/targets.ts`):
  - `Vorschlag = Grundbedarf × (1 + applyGoalAdjustment(goal, level, mode)) + Trainingsenergie + 4b-Versatz`
  - danach `clampCalorieTarget` (`nutrition/limits.ts`, **einzige Stelle mit Schutzgrenzen**): Untergrenze = max(Grundumsatz, 25 % unter `TagesbedarfGrenze`, 1 %/Woche, Energieverfügbarkeit); Obergrenze mit Überschussdeckel; gerichtete Rundung.
  - Wichtig für die Ampel: Der **Grundbedarf** (`baseNeeds`) rechnet mit `bmrForNeeds` (Katch-McArdle, sonst Mifflin mit −78 bei divers/ohne Angabe). Die **Untergrenzen** rechnen mit `limitNeeds` (max(Mifflin für Grenzen, Katch), +5 bei divers/ohne Angabe). Die Untergrenze kann deshalb **über** dem Grundbedarf liegen (Wächter S1, Beispiel in 3.3).
- `GOAL_ENERGY_ADJUSTMENT`: fat_loss −0,20 · definition −0,10 · muscle_gain +0,10 (Einsteiger) bzw. +0,05 · general_fitness und endurance 0.
- `eligibility.ts`: `DEFICIT_GOALS = ['fat_loss','definition']`. Bei unter 18, BMI < 18,5 und ohne Check (nicht männlich) gilt `maintenance_only`. Sonderdeckel: 15 % (ab 65, Medikamente, ärztliche Abklärung, ohne Check männlich), 10 % (BMI 18,5–20).
- `macros.ts`: `PROTEIN_G_PER_KG.byGoal` (2,0 / 2,2 / 1,8 / 1,4 / 1,4), Kohlenhydrate bei `endurance` nach Trainingsminuten.
- Festgelegt (Gründer-Entscheidung 3, Phase 5 Abschnitt 4.9): **keine Gewichts-Prognosen**, Schalter „Kalorienzahlen ausblenden“, Essstörungs-Hinweis mit Hilfe-Kontakten. `KCAL_PER_KG_BODY_WEIGHT = 7700` ist laut Plan „für einen Deckel geeignet, für Prognosen nicht“.

### 1.4 Export, Widerruf, Testmodus

- `DATA_EXPORT_TABLES` (`packages/core/src/export/data-export.ts`) enthält `goals`. Der Widerruf (`consents_after_revoke`, Testmodus `applyHealthDataRevocation`) löscht Körperdaten, Umfänge, Check und Unverträglichkeiten; `goals` bleibt.
- `consents_after_revoke()` und `export_my_data()` werden in mehreren Migrationen neu definiert, zuletzt in `20261006120200_training_log_rpcs.sql`. Phase 5 N7 erweitert sie ebenfalls (Wächter S16, Absicherung in 5.2).
- Das Trainings-PDF zeigt den Plannamen aus Ziel + Tagen, ohne Körperdaten (Regel B1).
- pgTAP: 01–20 belegt (20 = Warteliste), 21–22 für 4b reserviert, 23–26 für Phase 5. Für Ziele also ab **27** (vor Z1 nochmals prüfen).

### 1.5 Reihenfolge laut PROMPTS.md

Phase 5: N5 (Woche, Einkaufsliste) und N6 (PDF) stehen noch aus, N7 (Supabase) kommt später. Danach **Phase 10** (Gründer-Entscheidung 13.10.2026), dann 4b.

---

## 2. Abnehmen ohne oder mit konkretem Ziel

### 2.1 Auswahl

Ist `fat_loss` Haupt- oder Nebenziel, folgt die Frage „Wie möchtest du abnehmen?“:

1. **„In gesundem Tempo, ohne festes Ziel“** (Standard, vorausgewählt): genau wie heute. Standard-Anpassung des Ziel-Profils, z. B. −20 % bzw. Kombinationswert aus 4.4.
2. **„Mit konkretem Ziel“**: Eingabe von Menge und Zeitraum, live gezeigte Ampel. Das konkrete Ziel macht den Plan nie schneller als „ohne festes Ziel“, höchstens ruhiger (F5).

Ein konkretes Ziel gibt es nur bei `fat_loss`, nicht bei `definition` (siehe Frage F4).

### 2.2 Eingaben (`packages/core/src/goals/weight-goal.ts`, Zod)

- Menge, umschaltbar:
  - „kg abnehmen“ (Standard, so formuliert im Gründer-Wunsch), 0,5-kg-Schritte, gerechnet ab dem **aktuellen** Gewicht
  - „Zielgewicht“, 0,1 kg wie `body_metrics.weight_kg numeric(4,1)`
- Zeitraum, umschaltbar:
  - „in … Wochen“ (Standard, Stepper)
  - „bis Datum“ (DateInput wie beim Wettkampfdatum)
- Eingabeschema `weightGoalInputSchema`: zwei diskriminierte Unions `{ amount: { mode: 'kg_to_lose', kg } | { mode: 'target_weight', kg } }` und `{ time: { mode: 'weeks', weeks } | { mode: 'date', date } }`.
- Normalisiert `weightGoalSchema`: `{ targetWeightKg, startDate, targetDate, amountMode, timeMode }`. Ein Startgewicht wird **nicht** gespeichert (Wächter K9, Datensparsamkeit): Es wäre eine Kopie von `body_metrics`, und weil jedes Speichern ab heute neu plant (S15), braucht es keinen eigenen Wert. Beim Bearbeiten im Modus „kg abnehmen“ steht im Feld „aktuelles Gewicht − Zielgewicht“ (nur im Formular, nirgends sonst; kein Fortschritt, F13). Die Beschriftung bleibt neutral wie bei der Neuanlage („kg abnehmen ab heute“), ohne „noch“ und ohne Fortschrittssinn (Wächter Runde 2, K-e).
- **Jedes Speichern** (neu, bearbeiten, verlängern) setzt `startDate = heute` (Wächter S15). Damit passt der Datums-CHECK (5.2) immer, auch beim Verlängern nach Ablauf (F10).
- `createWeightGoalSchema(ctx)` mit Kontext `{ today, latestWeight {value, measuredOn}, heightCm, ageYears, flags | null, healthDataConsent }`.

### 2.3 Validierung und Grenzfälle (harte Fehler = Speichern unmöglich, Hinweis = erlaubt)

| Fall                                                              | Regel                                                                                                                                                                                                                                                                                                           | Text (Entwurf, neutral)                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Keine `health_data`-Einwilligung oder kein Gewicht/keine Größe    | Option „konkretes Ziel“ deaktiviert                                                                                                                                                                                                                                                                             | „Für ein konkretes Ziel brauchen wir dein aktuelles Gewicht.“ + Knopf Einwilligung/Gewicht                                                   |
| Gewicht älter als 90 Tage (`WEIGHT_OUTDATED_AFTER_DAYS`)          | erst aktualisieren                                                                                                                                                                                                                                                                                              | „Dein Gewicht ist älter als 3 Monate – bitte kurz aktualisieren.“                                                                            |
| Zielgewicht ≥ aktuelles Gewicht bzw. kg ≤ 0                       | Fehler                                                                                                                                                                                                                                                                                                          | „Dein Zielgewicht liegt nicht unter deinem aktuellen Gewicht. Wähle ‚ohne festes Ziel‘ oder ein anderes Ziel.“                               |
| Weniger als 1 kg                                                  | Fehler (`WEIGHT_GOAL_LIMITS.minKg = 1`)                                                                                                                                                                                                                                                                         | „Bitte mindestens 1 kg.“                                                                                                                     |
| Ziel-BMI unter der Untergrenze (F8: 20, ab 70 J. am Zieldatum 22) | Fehler (Gründer-Entscheidung F8 vom 17.10.2026, GLIM 2019)                                                                                                                                                                                                                                                      | „Dieses Zielgewicht liegt unter dem Bereich, den wir planen. Wenn Essen oder Gewicht dich belasten, hol dir Unterstützung.“ + Hilfe-Kontakte |
| ~~Ziel-BMI 18,5 bis < 20~~ – entfällt mit F8                      | kein eigener Hinweis mehr (das Band ist gesperrt)                                                                                                                                                                                                                                                               | –                                                                                                                                            |
| Ziel-BMI zur Laufzeit unzulässig (Wächter S14)                    | Engine und Ampel prüfen den Ziel-BMI bei jeder Rechnung mit der **neuesten Größe** erneut. Unzulässig → Ziel wird ignoriert (Standard-Anpassung), keine Ampel                                                                                                                                                   | Hinweis `weight_goal_invalid`: „Dein Zielgewicht passt nicht mehr zu deinen Angaben. Bitte passe es an.“                                     |
| Aktueller BMI < 18,5                                              | `fat_loss` → `maintenance_only`; konkretes Ziel gesperrt                                                                                                                                                                                                                                                        | bestehender Text aus 4.9                                                                                                                     |
| Unter 18 (tagesgenau)                                             | gesperrt; Abnehmen läuft als Erhalt                                                                                                                                                                                                                                                                             | „Im Wachstum ist eine Diät nicht sinnvoll. Wir planen ausgewogen ohne Kaloriendefizit.“                                                      |
| Unter 16                                                          | erreicht die App nicht (Mindestalter)                                                                                                                                                                                                                                                                           | –                                                                                                                                            |
| Flag `pregnancy`                                                  | gesperrt; ein vorhandenes Ziel ruht (`no_targets`)                                                                                                                                                                                                                                                              | bestehender Schwangerschafts-Text                                                                                                            |
| Stillzeit (Wächter K5)                                            | Es gibt kein eigenes Flag (Lücke gehört zu Phase 5). Bis dahin fester Hinweis auf dem Bildschirm „konkretes Ziel“                                                                                                                                                                                               | „Wenn du stillst, sprich ein Abnehmziel bitte vorher mit deiner Ärztin, deinem Arzt oder deiner Hebamme ab.“                                 |
| Kein Gesundheits-Check                                            | Geschlecht ≠ männlich: gesperrt (`maintenance_only`). Männlich: erlaubt, Kapazität mit 15-%-Deckel                                                                                                                                                                                                              | „Mach bitte zuerst den kurzen Gesundheits-Check.“                                                                                            |
| `medication` / `medical_clearance_recommended` / ab 65            | erlaubt, Deckel 15 % senkt die Kapazität C (Ampel öfter Orange)                                                                                                                                                                                                                                                 | bestehender Medikamenten-Hinweis                                                                                                             |
| Kein Defizit planbar (D_C ≤ 1 kcal, 3.1, Wächter S1)              | konkretes Ziel nicht speicherbar; keine Stufe, kein N. Gerät ein **bestehendes** Ziel zur Laufzeit in diesen Zustand (z. B. Flag `medication` neu, Körperfett gemessen), plant die Engine sicher weiter (Standard-Anpassung, Untergrenze) und zeigt den Hinweis `weight_goal_no_deficit` (Wächter Runde 2, K-d) | „Derzeit planen wir für dich kein Kaloriendefizit. Wähle bitte ‚ohne festes Ziel‘.“                                                          |
| Zeitraum < 4 Wochen oder > 104 Wochen                             | Fehler (`WEIGHT_GOAL_LIMITS.weeks 4–104`)                                                                                                                                                                                                                                                                       | „Bitte einen Zeitraum zwischen 4 Wochen und 2 Jahren.“                                                                                       |
| Datum in der Vergangenheit, heute, 29. Februar, Sommerzeitwechsel | Wochen = ganze Tage / 7 (Europe/Berlin, `dates.ts`), Datum ≥ heute + 28 Tage                                                                                                                                                                                                                                    | –                                                                                                                                            |
| Zielgewicht außerhalb 30–300 kg                                   | Fehler (`BODY_METRIC_LIMITS`)                                                                                                                                                                                                                                                                                   | –                                                                                                                                            |
| Essstörungen                                                      | **keine Abfrage**, aber fester Hinweis auf dem Bildschirm „konkretes Ziel“ (wie `nutrition_setup`), Hilfe-Kontakte DE/AT/CH (Nummern vor Veröffentlichung prüfen)                                                                                                                                               | „Wenn Essen oder Gewicht dich stark belasten, hol dir Unterstützung.“                                                                        |
| „Kalorienzahlen ausblenden“ ist an (Wächter K6)                   | erlaubt; beim Einschalten von „mit konkretem Ziel“ eine ruhige Rückfrage, Standard bleibt „ohne festes Ziel“                                                                                                                                                                                                    | „Du hast Kalorienzahlen ausgeblendet. Möchtest du wirklich ein festes Ziel? Ohne festes Ziel planen wir genauso gesund.“                     |

Alle neuen Zod-Felder (`weightGoal`, `secondaryGoalType`) sind **optional mit Standard `null`** (Wächter B1). Unveränderte App-Stände und alte Testmodus-Gerätestände funktionieren dadurch weiter.

### 2.4 Wirkung auf das Kalorienziel (nur Ernährung; der Trainingsplan bleibt frei von Körperdaten)

In `nutritionTargetsForWeek` kommt eine neue Eingabe `weightGoal` hinzu (`nutritionInputsSchema`, optional, Standard `null`). Sie wird nur ausgewertet bei gültiger Einwilligung, Modus `full` und Ziel-Profil mit Energie-Richtung „Defizit“. Gerechnet wird je Tag `d` der Woche (nicht nur für `today`).

1. **Ziel gültig und aktiv an Tag d?**
   - Gültig: `fat_loss` in den Zielen, Ziel-BMI mit der neuesten Größe zulässig (S14; sonst Hinweis `weight_goal_invalid`, Standard-Anpassung).
   - **Erreicht** (Wächter S8): Seit `startDate` gibt es mindestens eine Gewichtsangabe ≤ Zielgewicht (aus `bodyMetricsRows`, bis einschließlich d). Dann gilt Erhalt (Anpassung 0) und Hinweis `weight_goal_reached`, **bis der Nutzer wählt**, wie es weitergeht (6.4). Ein späteres Gewicht über dem Ziel schaltet das nicht zurück. So flackert nichts, und die Engine bleibt zustandslos: Sie leitet „erreicht“ aus den Messungen ab, eine eigene Spalte braucht es nicht. Test: Gewichtsfolge 80,1 → 79,9 → 80,2 bei Ziel 80,0 → ab 79,9 durchgehend „erreicht“.
   - **Aktiv**: gültig, nicht erreicht und `targetDate > d` (strikt; Wächter S7).
   - **Datum vorbei** (`targetDate ≤ d`): Standard-Defizit wie „ohne festes Ziel“ und Hinweis `weight_goal_date_passed`.
2. **Benötigtes Tempo ab Tag d:** `restKg = aktuell − Ziel`, `restWochen = max(Tage vom Ankertag bis targetDate, 1) / 7` mit **Ankertag = max(Messtag des neuesten Gewichts, startDate), höchstens d** (Wächter Z2 S-1; ursprünglich „ab d“). So bleibt das Tempo ohne neue Messung konstant – am Speichertag genau das Tempo der Ampel (Δ / Wochen) –, und die Engine verschärft nicht täglich, solange niemand wiegt (kein Widerspruch „Ampel: in deinem Tempo“ ↔ „wir planen langsamer“, S4). Der `max` schützt vor einer Division durch 0. In kg/Woche `v_r = restKg / restWochen`. Tests am Zieldatum und am Tag davor. Tage vor `startDate` haben kein Ziel (Wächter Z2 K-1).
3. **Tempo der Standard-Anpassung:** `v_S = −Standard-Anpassung × Grundbedarf × 7 / 7700` kg/Woche (Standard-Anpassung des Ziel-Profils, z. B. −0,20 bei Abnehmen bzw. Kombinationswert aus 4.4; `KCAL_PER_KG_BODY_WEIGHT = 7700` nur als Planungswert, wie in Phase 5).
4. **Geplantes Tempo (F5, „nie schneller als heute“):** `v = min(v_r, v_S)`. Gleichwertig als Energie-Anpassung: `Anpassung = max(Standard-Anpassung, −v_r × 7700 / 7 / Grundbedarf)`. Bei Defiziten ist das die **kleinere absolute** Anpassung. Ein konkretes Ziel kann das Defizit also nur verkleinern, nie vergrößern. `WEIGHT_GOAL_PACE_MAX_PLANNED` gibt es nicht mehr; die Obergrenze ist die Standard-Anpassung des Profils.
5. **Vorschlag je Tag:** `Grundbedarf × (1 + Anpassung) + Trainingsenergie + 4b-Versatz`, also dieselbe Formel wie heute, nur mit der Anpassung aus Schritt 4. Das Defizit bezieht sich wie heute auf den Grundbedarf ohne Training (Energieverfügbarkeit, Phase 5 S2).
6. **Immer danach `clampCalorieTarget`** mit unverändertem Kontext: 25 % unter `TagesbedarfGrenze`, nie unter Grundumsatz, 1 %/Woche, Energieverfügbarkeit, Sonderfall-Deckel, `maintenance_only`, Tage mit gedeckelter Trainingsenergie ohne Defizit. `goalIsSurplus` kommt aus der Energie-Richtung des Profils (4.4, S11).
   - Hinweis `weight_goal_pace_capped` („Für dein Wunschziel planen wir etwas langsamer, damit es sicher bleibt.“), sobald das geplante Tempo unter dem benötigten liegt, also wenn `v_r > v_S` oder eine Schutzgrenze das Defizit weiter verkleinert.
   - Der Hinweis erscheint **nicht täglich** (Wächter K10): nur in der Ernährungs-Übersicht der Woche und höchstens einmal pro Woche, nicht als Dauerhinweis auf „Heute“.
7. **Kein Aufholen:** Rückt das Datum näher, steigt r. Das geplante Tempo bleibt aber höchstens beim Standard-Tempo und läuft danach durch die Schutzgrenzen. Ein Test belegt das (letzte Woche vor dem Datum, 5 kg Rest → Anpassung = Standard-Anpassung, nicht mehr).
8. **Ohne konkretes Ziel:** unverändert wie heute (Standard-Anpassung des Profils).
9. **4b (später, Wächter S10):** Der Versatz wird weiter nur in `clampCalorieTarget` begrenzt. Im 4b-Plan nachtragen:
   - Die „Plateau“-Regel nutzt die Energie-Richtung des Ziel-Profils und liest **kein** `weightGoal`. Ein negativer 4b-Versatz darf das durch F5 verkleinerte Defizit zwar bis zur Schutzgrenze vergrößern (er läuft durch `clampCalorieTarget`), er wird aber nie durch Zieldatum oder `v_r` ausgelöst oder begründet.
   - Test im 4b-Plan: Der 4b-Versatz ist mit und ohne Abnehmziel identisch (gleiche Person, gleiche Messwerte).

Die Engine speichert weiterhin nichts. Ändert sich Gewicht oder Ziel, wird neu gerechnet.

---

## 3. Ampel „Erreichbarkeit“ (rot → grün)

### 3.1 Formel (core, `goals/weight-goal-feasibility.ts`, reine Funktion, live aufrufbar)

Bezeichnungen: `w0` = neuestes Gewicht, `wZiel` = Zielgewicht, `Wochen` = gewünschter Zeitraum (ganze Tage / 7), `m = (w0 + wZiel)/2` = mittleres Gewicht.

- **Benötigtes Tempo** `r = (w0 − wZiel) / Wochen / m`. Das mittlere Gewicht wird verwendet, weil die 1-%-Grenze am jeweils aktuellen, sinkenden Gewicht hängt.
- **Persönliche Kapazität C (F5, präzisiert nach Wächter S6):** das Tempo, das die **Standard-Anpassung des Ziel-Profils nach `clampCalorieTarget` an einem Ruhetag** liefert, und zwar im **strengsten Stand des Zeitraums**. Mehr plant die App nie, auch nicht mit konkretem Ziel. Gerechnet wird mit denselben Funktionen wie die Engine: `dayEnergy`/`dailyEnergyForLimits`, `nutritionEligibility` (Deckel), `clampCalorieTarget`/`dayFloorKcal`. Die Ampel rechnet keine eigenen Grenzen.
  - Defizit am Ruhetag für einen Stand s: `D(s) = Grundbedarf(s) − clampCalorieTarget(Grundbedarf(s) × (1 + Standard-Anpassung)).unroundedKcal` (ungerundet; persönlich, mit allen Deckeln: 25 %, Grundumsatz, 1 %/Woche, Energieverfügbarkeit, Sonderfall-Deckel 15 %/10 %, `maintenance_only` ⇒ 0).
  - Zwei Stände: **heute** (Gewicht w0, Alter heute, BMI-Klasse von w0) und **am Ziel** (Gewicht wZiel, BMI-Klasse von wZiel, Alter am Zieldatum). `D_C = min(D(heute), D(am Ziel))`.
  - **Körperfett am Ziel** (Wächter N2): Ist die Körperfett-Messung nutzbar (≤ 90 Tage alt, `isBodyFatUsable`), rechnet auch der Stand „am Ziel“ mit **demselben Prozentwert** (fettfreie Masse und Katch-McArdle am Zielgewicht). Ohne nutzbare Messung rechnen beide Stände ohne Körperfett (Mifflin). Liegt Katch unter Mifflin, ist das die vorsichtigere Wahl. Tests: mit und ohne nutzbare Messung, Messung genau 90 und 91 Tage alt. Beim Abnehmen sinken Bedarf und 1-%-Spielraum, und unterwegs können der 10-%-Deckel (BMI 18,5–20) oder der 15-%-Deckel (Geburtstag mit 65) greifen. Der Stand am Ziel ist deshalb meist der strengste; das `min` sichert auch die seltenen Gegenfälle ab (z. B. niedrigere Energieverfügbarkeits-Untergrenze am Ziel).
  - Für N (siehe unten) gilt das Alter am Ende der sicheren Dauer: Liegt `heute + N Wochen` hinter dem Zieldatum und ist das Alter dort höher, wird C mit diesem Alter neu gerechnet, bis N stabil ist (höchstens 3 Durchläufe; N steigt dabei nur).
  - **Kein Defizit planbar** (Wächter S1): Ist `D_C ≤ WEIGHT_GOAL_MIN_CAPACITY_KCAL` (1 kcal), gibt die Funktion den Zustand `no_deficit` zurück: keine Stufe, kein N, Text „Derzeit planen wir für dich kein Kaloriendefizit. Wähle bitte ‚ohne festes Ziel‘.“ D_C kann **negativ** sein, nicht nur 0: Der Grundbedarf nutzt `bmrForNeeds` (Katch bzw. Mifflin −78), die Untergrenzen nutzen `limitNeeds` (max(Mifflin für Grenzen, Katch), +5 bei divers). Beispiel G in 3.3.
  - In kg/Woche `v_C = D_C × 7 / 7700`, als Anteil `C = v_C / m` (gleiche Bezugsgröße wie r, damit r und C vergleichbar sind).
  - **Ruhetag als bewusste Vereinfachung:** An Trainingstagen begrenzt die Energieverfügbarkeits-Untergrenze (30 kcal/kg FFM + Trainingsenergie brutto) das Defizit oft stärker, und Tage mit gedeckelter Trainingsenergie haben gar keins. Außerdem überschätzt 7.700 kcal/kg den Verlust über die Zeit (Hall 2008). Die tatsächliche Abnahme kann deshalb langsamer sein als v_C. Die Ampel sagt immer „etwa“ und wird bei jeder neuen Gewichtsangabe neu gerechnet. Die Rechnung am Zielgewicht macht C zusätzlich vorsichtiger.
  - Alltagsfaktor: der eingetragene Wert, sonst `ACTIVITY_FACTORS.default` (1,45, der niedrigste). Der Schritt `nutrition_setup` kommt erst später im Onboarding, das Ergebnis ist also eher zu vorsichtig.
- **Stufen** (Konstanten in `constants.ts`, F6 wie empfohlen, präzisiert nach Wächter S4). Alle Vergleiche mit Toleranz `EPS` wie in `limits.ts` (`r ≤ Grenze + EPS`); r und C werden nie gerundet verglichen (Wächter S9).

| Stufe                    | Bedingung                         | Titel                                            | Erklärung (Entwurf)                                                                                                  |
| ------------------------ | --------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Grün                     | r ≤ 0,5 % und r ≤ C               | „Gut erreichbar“                                 | „Ein ruhiges Tempo, das sich gut durchhalten lässt.“                                                                 |
| Gelb                     | 0,5 % < r ≤ 0,75 % und r ≤ C      | „Ehrgeizig, aber machbar“                        | „Wir planen in deinem Tempo. Ausreichend Eiweiß und Krafttraining helfen, Muskeln zu erhalten.“                      |
| Orange „ruhiger möglich“ | 0,75 % < r ≤ 1,0 % und r ≤ C      | „Sehr ehrgeizig“                                 | „Wir planen in deinem Tempo. Ruhiger wäre etwa **N Wochen**.“ + Knopf „Zeitraum auf N Wochen setzen“                 |
| Orange „langsamer“       | r ≤ 1,0 % und r > C               | „Sehr ehrgeizig – wir planen etwas langsamer“    | „Sicher planbar sind für dich etwa **N Wochen**.“ + Knopf „Zeitraum auf N Wochen setzen“                             |
| Rot                      | r > 1,0 %                         | „So schnell nicht sicher – wir planen langsamer“ | „Mehr als etwa 1 % deines Körpergewichts pro Woche planen wir nicht. Sicher planbar sind etwa **N Wochen**.“ + Knopf |
| (keine Stufe)            | D_C ≤ 1 kcal oder Ziel unzulässig | –                                                | Zustand `no_deficit` (siehe oben) bzw. Fehler aus 2.3; keine Ampel                                                   |

- Die Bedingungen sind lückenlos und eindeutig. Ein unzulässiges Ziel (z. B. Ziel-BMI zu niedrig) ist **keine** Stufe, sondern ein Fehler aus 2.3 ohne Ampel.
- **„Langsamer“ passt zum Hinweis:** Orange „langsamer“ und Rot gibt es nur bei r > C bzw. r > 1 %. Dort plant die Engine im Verlauf langsamer als gewünscht, und `weight_goal_pace_capped` erscheint. Weil C vorsichtig am Zielgewicht gerechnet wird, kann die Engine am Anfang noch das Wunschtempo planen; der Hinweis erscheint erst, sobald sie wirklich bremst (2.4 Nr. 6). Bei Orange „ruhiger möglich“ plant die Engine genau das Wunschtempo, deshalb steht dort kein „langsamer“.
- **Sichere Dauer** (Wächter S3, S9): `N = ceil((w0 − wZiel) / min(v_C, WEIGHT_GOAL_PACE_LEVELS.yellow × m) − EPS)` Wochen. Durch das `min` mit 0,75 % landet der Knopf garantiert in Gelb oder Grün, auch wenn C über 0,75 % liegt (leichte, sehr aktive Personen, Beispiel H) oder sogar über 1 % (die 1-%-Grenze der Engine hängt am aktuellen Gewicht, r und C am mittleren).
  - Der Knopf setzt den Zeitraum auf `max(N, 4)` Wochen (Mindestzeitraum).
  - **N > 104 Wochen** (`WEIGHT_GOAL_LIMITS.weeks.max`, Wächter S2): Es wird kein N gezeigt, sondern „Über 2 Jahre – wir empfehlen ‚ohne festes Ziel‘.“ Den Knopf gibt es dann nicht.
  - Ab 27 Wochen wird zusätzlich in Monaten angezeigt („etwa 8 Monate“).
- **Nur Planungsdauer (F7, Wächter S20):** „Sicher planbar sind etwa N Wochen“. Kein Monat/Jahr, kein Kalenderdatum, keine Wörter wie „erreichbar“ oder „erreicht am“. Es gibt keinen Tagesverlauf, keine Gewichtskurve, keinen Countdown und kein „Du wiegst am … X kg“ (präzisiert Gründer-Entscheidung 3 aus Phase 5, `docs/PLAN-PHASE-5.md` 4.6 Nr. 3 und 4.9).
- **Position des Zeigers** (Wächter S5): Der Balken läuft von Rot (links, x = 0) nach Grün (rechts, x = 1). `x = 1 − min(r / 1,25 %, 1)`. Die Zonen: Rot [0; 0,2), Orange [0,2; 0,4), Gelb [0,4; 0,6), Grün [0,6; 1] (entspricht r = 1 % / 0,75 % / 0,5 %). Die Zone wird **aus der Stufe** bestimmt, und x wird **beidseitig** in deren Intervall geklemmt (Wächter Runde 2, K-a): `x_Anzeige = min(max(x, linke Grenze + 0,01), rechte Grenze − 0,01)` (bei Grün rechte Grenze 1 ohne Abzug). Das deckt die Fälle „Stufe wegen r > C strenger als die Zone“ und Gleitkomma-Reste genau an einer Grenze ab (z. B. r = 0,5 % + 1e-12: Stufe Grün dank `EPS`, x knapp unter 0,6). Zeiger-Zone und Stufe sind also immer gleich (Test, auch an den Rändern).
- Ohne Einwilligung, Gewicht oder Größe gibt es keine Ampel, nur den Hinweis aus 2.3.

### 3.2 Konstanten mit Quellen (neuer Abschnitt „Ziele“ in `packages/core/src/constants.ts`)

- `WEIGHT_GOAL_PACE_LEVELS = { green: 0.005, yellow: 0.0075, orange: 0.01 }`
  - Quellen: Helms ER, Aragon AA, Fitschen PJ (2014), J Int Soc Sports Nutr 11:20 (0,5–1 % KG/Woche zum Muskelerhalt); Garthe I et al. (2011), Int J Sport Nutr Exerc Metab 21(2):97–104 (≈ 0,7 % vs. 1,4 %/Woche: langsamer erhält Magermasse besser); Deutsche Adipositas-Gesellschaft, S3-Leitlinie Prävention und Therapie der Adipositas (2014) (Defizit ca. 500–600 kcal/Tag).
  - Markierung: „VOR LIVEGANG GEGEN ORIGINAL PRÜFEN“. Die Grenze 0,75 % ist eine PRODUKTENTSCHEIDUNG.
- **Kein** `WEIGHT_GOAL_PACE_MAX_PLANNED` (F5): Die Obergrenze des geplanten Tempos ist die Standard-Anpassung des Ziel-Profils (`GOAL_ENERGY_ADJUSTMENT` bzw. `GOAL_PAIR_RULES`, 4.4), immer nach `clampCalorieTarget`.
- `WEIGHT_GOAL_SCALE_MAX_PACE = 0.0125`
- `WEIGHT_GOAL_MIN_CAPACITY_KCAL = 1` (Wächter S1; darunter Zustand `no_deficit`). PRODUKTENTSCHEIDUNG.
- `WEIGHT_GOAL_LIMITS = { minKg: 1, weeks: { min: 4, max: 104 }, minTargetBmi: { default: 20, senior: 22, seniorFromAge: 70 } }` (seit Z3, F8; vorher `minTargetBmi: 18.5`, `lowTargetBmiNotice: 20`)
  - `minTargetBmi` nach Gründer-Entscheidung F8 (17.10.2026): 20, ab 70 Jahren (Alter am Zieldatum) 22. Quelle: Cederholm T et al. (2019), GLIM criteria for the diagnosis of malnutrition, Clin Nutr 38(1):1–9 (BMI < 20 unter 70 J. bzw. < 22 ab 70 J. als phänotypisches Kriterium). Zum Vergleich WHO: Untergewicht < 18,5.
- Ein Test in `constants.test.ts` stellt sicher: Die Stufen sind aufsteigend, `WEIGHT_GOAL_PACE_LEVELS.orange = MAX_WEEKLY_WEIGHT_LOSS_FRACTION`, `WEIGHT_GOAL_SCALE_MAX_PACE > orange`.

### 3.3 Rechenbeispiele (mit den echten Core-Funktionen nachgerechnet am 13.10.2026; in Z2 wörtlich als Tests)

Gerechnet mit `dayEnergy`, `nutritionEligibility` und `clampCalorieTarget` (ungerundet), Mifflin-St Jeor ohne Körperfett (außer G), Alltagsfaktor 1,45 (sitzend), Ruhetag, Check ohne Befund. C nach 3.1 (Minimum aus „heute“ und „am Ziel“; in A–C ist „am Ziel“ jeweils der strengere Stand). „Engine plant“ = Defizit am ersten Tag nach 2.4.

- **A** Mann, 35 J., 180 cm, 90 kg, Ziel Abnehmen (Standard −20 %), Ziel 80 kg (−10 kg), m = 85 kg:
  - Heute: Mifflin 1.855, Grundbedarf 2.689,75, Untergrenze 2.017,31 (25 %), Vorschlag 2.151,80 → D = 537,95 kcal.
  - Am Ziel (80 kg): Mifflin 1.755, Grundbedarf 2.544,75. Untergrenze am Ruhetag: max(1.755; 25 %: 1.908,56; 1 %/Woche: 1.664,75; EA ≈ 1.851,94) = 1.908,56. Standard −20 %: 2.035,80 ≥ 1.908,56, die Schutzgrenzen greifen nicht → D = 508,95 kcal.
  - D_C = 508,95 → v_C = 508,95 × 7 / 7.700 ≈ **0,4627 kg/Woche**, **C ≈ 0,544 %/Woche**. min(v_C; 0,75 % × 85 = 0,6375) = v_C. **N = ceil(10 / 0,4627) = ceil(21,61) = 22 Wochen**.
  - −10 kg in 12 Wochen: r ≈ 0,980 % (≤ 1 %, > C) → **Orange „langsamer“**, N = **22**. Zeiger x ≈ 0,216 (Orange-Zone). Engine plant das Standard-Defizit ≈ 538 kcal, nicht mehr.
  - −10 kg in 26 Wochen: r ≈ 0,452 % ≤ 0,5 % und ≤ C → **Grün**. Engine plant 0,3846 × 7.700 / 7 ≈ **423 kcal/Tag**, also sanfter als der Standard (538).
  - −10 kg in 22 Wochen (Knopf „Zeitraum übernehmen“): r ≈ 0,535 % ≤ C → **Gelb**. Engine plant **500 kcal/Tag** (< 538).
  - −10 kg in 21 Wochen: r ≈ 0,560 % > C (0,544 %) → **Orange „langsamer“**, N = 22. Der Zeiger stünde bei x ≈ 0,552 (Gelb-Zone) und wird in die Orange-Zone geklemmt (S5-Testfall). Am ersten Tag plant die Engine noch das Wunschtempo (≈ 524 kcal < 538), bremst aber im Verlauf, sobald v_S unter v_r fällt.
  - −10 kg in 6 Wochen: r ≈ 1,961 % → **Rot**, N = **22**.
- **B** Frau, 30 J., 165 cm, 70 kg, Ziel −3 kg (67 kg), m = 68,5 kg:
  - Heute: Mifflin 1.420,25, Grundbedarf 2.059,36, D = 411,87 kcal.
  - Am Ziel (67 kg): Mifflin 1.390,25, Grundbedarf 2.015,86; Untergrenze 1.511,90 (25 %); Standard −20 % = 1.612,69 → D = 403,17 kcal.
  - D_C = 403,17 → v_C ≈ **0,3665 kg/Woche**, **C ≈ 0,535 %**. min(v_C; 0,75 % × 68,5 = 0,5138) = v_C. **N = ceil(3 / 0,3665) = ceil(8,19) = 9 Wochen** (nicht mehr an der Rundungsgrenze).
  - −3 kg in 4 Wochen: r = 0,75 / 68,5 ≈ 1,095 % → **Rot**, N = **9**. Knopf → 9 Wochen: r ≈ 0,487 % → **Grün**.
- **C** wie A, aber 66 J. (Sonderfall-Deckel 15 %; Geburtstag nach dem Zieldatum, also auch am Ziel 66 J.):
  - Heute: Mifflin 1.700, Grundbedarf 2.465; Standard −20 % = 1.972 < Untergrenze 2.095,25 (15 %) → D = 369,75.
  - Am Ziel (80 kg): Mifflin 1.600, Grundbedarf 2.320; Standard −20 % = 1.856 < Untergrenze 2.320 × 0,85 = 1.972 → `clampCalorieTarget` hebt auf 1.972 → D = 348 kcal.
  - D_C = 348 → v_C ≈ **0,3164 kg/Woche**, **C ≈ 0,372 %/Woche**. Grün ist damit nur bis r ≤ 0,372 % möglich; darüber mindestens Orange. **N = ceil(10 / 0,3164) = ceil(31,61) = 32 Wochen**.
  - −10 kg in 26 Wochen: r ≈ 0,452 % > C → **Orange „langsamer“**, N = **32**. Der Zeiger stünde bei x ≈ 0,638 (Grün-Zone) und wird in die Orange-Zone geklemmt (S5-Testfall). Knopf → 32 Wochen: r ≈ 0,368 % → **Grün**.
- **D** Ziel-BMI 18,4 → Fehler, keine Stufe (seit F8 gilt 20; auch 19,9 ist ein Fehler). **E** 17 J. → gesperrt. **F** Schwangerschaft → gesperrt.
- **G** (Wächter S1, kein Defizit planbar): Mann, 35 J., 180 cm, 90 kg, Körperfett 39,3 % (Katch ≈ 1.550), Messung ≤ 90 Tage alt, Flag `medication` (15 %), Ziel 80 kg:
  - Heute (90 kg): Grundbedarf (Katch) ≈ 2.247,51, Untergrenze 15 % unter `limitNeeds` (Mifflin, 2.689,75) ≈ 2.286,29 > Grundbedarf → D(heute) ≈ **−38,78 kcal**.
  - Am Ziel (80 kg, gleiches Körperfett 39,3 % nach N2, Katch ≈ 1.418,90): Grundbedarf ≈ 2.057,40, Untergrenze 15 % unter `limitNeeds` (Mifflin 1.755 × 1,45 = 2.544,75) ≈ 2.163,04 → D(am Ziel) ≈ **−105,64 kcal**.
  - **D_C = min(−38,78; −105,64) ≈ −105,64 kcal** → Zustand `no_deficit`, keine Stufe, kein N. (Gegenprobe ohne `medication`, Deckel 25 %: D_C ≈ 148,8 kcal, N = 74.)
- **H** (Wächter S3, C über 0,75 %): Frau, 30 J., 165 cm, 62 kg, Alltagsfaktor 2,2, Ziel 59 kg (−3 kg), m = 60,5 kg: D heute 589,71, am Ziel 576,51 → v_C ≈ 0,5241 kg/Woche, C ≈ 0,866 %. N nur aus v_C wäre ceil(5,72) = 6 Wochen mit r ≈ 0,826 % (Orange). Mit `min(v_C; 0,75 % × 60,5 = 0,4538)`: **N = ceil(6,61) = 7 Wochen**, r ≈ 0,708 % → **Gelb**.
- **I** (Wächter S2): Person mit D_C knapp über 1 kcal (z. B. 15-%-Deckel wie G mit etwas niedrigerem Körperfett; G ohne Flag ergibt mit N = 74 noch keinen Fall über 104) → N > 104 → „Über 2 Jahre – wir empfehlen ‚ohne festes Ziel‘“, kein Knopf. In Z2 einen konkreten Fall mit den echten Funktionen festlegen.

### 3.4 Darstellung am Handy (`apps/mobile/src/components/feasibility-scale.tsx`)

- Waagerechter Balken mit Verlauf von Rot (links, „zu schnell“) nach Grün (rechts, „ruhig“) über `react-native-svg` `LinearGradient` (ist installiert). Der Zeiger wird mit `react-native-reanimated` animiert (installiert). Position und Klemmung wie in 3.1. Die Leserichtung „von rot bis grün“ wie im Wunsch.
- **Live:** neu berechnet bei jeder Eingabe. Teil-Eingaben ergeben „noch keine Bewertung“. Die Rechnung ist billig, eine Entprellung von ca. 150 ms gibt es nur für die Ansage, nicht für die Grafik.
- **Nicht nur Farbe:**
  - Stufentitel als Text
  - je Stufe ein eigenes Symbol (Haken, Ausrufezeichen, doppeltes Ausrufezeichen, Stopp-Achteck)
  - Skalenbeschriftung „ruhig · ehrgeizig · sehr ehrgeizig · zu schnell“
  - der Zeiger hat einen Rahmen mit Kontrast ≥ 3 : 1 (WCAG 1.4.11)
- **Screenreader:** `accessibilityLabel` als ganzer Satz („Erreichbarkeit: sehr ehrgeizig. Benötigt etwa 1 % deines Gewichts pro Woche. Sicher planbar sind etwa 22 Wochen.“). Angesagt wird nur bei Stufenwechsel: `accessibilityLiveRegion="polite"` unter Android, `AccessibilityInfo.announceForAccessibility` unter iOS. Im Web `role="meter"` mit `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` (= x_Anzeige × 100) und `aria-valuetext` (Wächter K8).
- **Bewegung reduzieren** (`useReducedMotion`): keine Animation. Schriftgrößen skalieren mit.
- **Farben:** `success`, `warning`, `danger` gibt es schon. Neu kommt der Token `caution` (Gelb) in `packages/ui/src/tokens.ts` und `docs/DESIGN.md`, nur als Flächenfarbe. Texte stehen immer in Standard-Textfarbe (Gelb auf Weiß hat zu wenig Kontrast).
- Prozentwerte erscheinen nur in der Screenreader- bzw. Detailzeile, immer mit „etwa“ (K8), keine kcal. Der Schalter „Kalorienzahlen anzeigen“ bleibt davon unberührt.
- **Keine Weitergabe** (Wächter K7): Stufe, r, C, N und Zielgewicht gehen nie in Analytics, Logs oder Crash-Reports (auch nicht als Ereignis-Eigenschaft „Stufe gewählt“).

---

## 4. Zwei Ziele

### 4.1 Modell: Hauptziel + optionales Nebenziel (Frage F1)

Gleichrangige Ziele bräuchten für jedes ungeordnete Paar eine eigene Mischregel und wären in der App schwer zu erklären. Mit Haupt- und Nebenziel gilt eine klare Regel: **Die Vorlage folgt dem Hauptziel, das Nebenziel ergänzt.**

### 4.2 Erlaubte Paare (`GOAL_COMBINATIONS` in core, gespiegelt in `private.goal_pair_allowed`)

| Haupt ↓ / Neben → | Abnehmen        | Definition | Muskelaufbau | Fitness | Ausdauer |
| ----------------- | --------------- | ---------- | ------------ | ------- | -------- |
| **Abnehmen**      | –               | ✗ doppelt  | ✓            | ✗ (F2)  | ✓        |
| **Definition**    | ✗ doppelt       | –          | ✗ doppelt    | ✗       | ✓        |
| **Muskelaufbau**  | ✓ Recomposition | ✗ doppelt  | –            | ✗       | ✓        |
| **Fitness**       | ✓               | ✗          | ✗            | –       | ✓        |
| **Ausdauer**      | ✓               | ✓          | ✓            | ✗       | –        |

- **Verhindert** (Ziel nicht wählbar, mit Grund für Screenreader):
  - dasselbe Ziel doppelt
  - Definition + Abnehmen bzw. + Muskelaufbau: „Definition verbindet schon Fettverlust und Muskelerhalt.“
  - Fitness als Nebenziel: steckt in jedem Plan, bringt keinen Unterschied
- **„Abnehmen + Zunehmen“**: Ein Ziel „Zunehmen“ gibt es nicht. Abnehmen + Muskelaufbau ist **kein** Widerspruch, sondern Recomposition. Käme später ein Ziel „Zunehmen“, wäre es mit Abnehmen und Definition unvereinbar und würde in dieser Tabelle gesperrt.
- **„Kraft“** gibt es nicht als Ziel und es gibt keine Vorlagen dafür (Frage F3).
- **Gleichwertige Paare** (Wächter K3): Zwei Paare entsprechen in Energie, Eiweiß und Vorlage einem Einzelziel. Sie bleiben erlaubt (F2), die App erklärt das im Kombinationssatz (6.1):
  - „Muskelaufbau → Abnehmen“ = Definition, aber mit der Möglichkeit eines Wunschgewichts: „Entspricht ‚Definition‘ – zusätzlich kannst du ein Wunschgewicht festlegen.“
  - „Fitness → Ausdauer“ = Ziel Ausdauer: „Entspricht dem Ziel ‚Ausdauer‘.“ **Auflage für Z4 (Wächter Z1 S-3):** Das gilt nur für Energie, Eiweiß und Vorlage, nicht für die Trainingswoche – die Vorbelegung läuft über „Hauptziel zuerst“ (Kraft vor Ausdauer), das Ziel Ausdauer belegt 3 Ausdauer- und 2 Kraft-Tage vor. In Z4 entweder den Satz einschränken („bei Energie und Eiweiß wie das Ziel ‚Ausdauer‘“) oder dieses Paar über den Ausdauer-Pfad vorbelegen.

### 4.3 Trainingsplan: Übungen passend für beide Ziele

- **Vorlage = Hauptziel** über `GOAL_TEMPLATE_MAPPING`, unverändert. Vorlagen werden nicht gemischt: Sie sind fachlich freigegebene Einheiten, eine Mischung wäre ungeprüft.
- Das passt fachlich, weil alle Vorlagen Ganzkörperpläne mit allen großen Bewegungsmustern sind. Bei Studio und Zuhause sind die Übungslisten über die Ziele identisch, nur die Dosierung unterscheidet sich. Bei Körpergewicht unterscheiden sich auch die Übungen (bis zu 5, 1.2), die Muster sind aber abgedeckt.
  - **Test in Z1** (Wächter S17): Für jedes erlaubte Paar und jede Kombination aus Ort, Level und Tagen enthält die gewählte Vorlage alle Haupt-Bewegungsmuster (Kniebeuge, Hüftstreckung, Drücken, Ziehen, Rumpf).
- **Recomposition** (Haupt Muskelaufbau + Neben Abnehmen) nutzt die Muskelaufbau-Vorlage (8–12 Wdh., längere Pausen). Quelle: Barakat C et al. (2020), Strength Cond J 42(5):7–21 – Krafttraining mit Hypertrophie-Reiz plus hohes Eiweiß ist der Hauptfaktor. Bei Haupt Abnehmen + Neben Muskelaufbau bleibt die Fettverlust-Vorlage (10–12 Wdh.). Bei Studio und Zuhause sind die Übungen gleich, die Dosierung unterscheidet sich wenig. Bei Körpergewicht hat die Muskelaufbau-Vorlage mehr Übungen (z. B. Liegestütz, Split-Kniebeuge) als die Fettverlust-Vorlage.
- **Nebenziel Ausdauer:**
  - `suggestedTrainingSlots` belegt zusätzlich Ausdauer-Tage vor (Empfehlung: Einsteiger 1, sonst 2; als `ENDURANCE_SECONDARY_SUGGESTION` in den Konstanten). Die Vorbelegung läuft über **dieselbe** `suggestionGroup` (inkl. `cautious`) und dieselben `ENDURANCE_START_RULES` wie heute bei Hauptziel Ausdauer (Wächter S18). Disziplin und Wettkampfdatum sind auch beim Nebenziel erlaubt; das Datum wirkt erst mit Phase 10.
  - **Vorrang „Hauptziel zuerst“** (Wächter S18) bei kleinem Zeitbudget: Bei einem Kraft-Hauptziel bekommen zuerst die Kraft-Tage ihren Platz (mindestens 2, bei 1 Tag pro Woche dieser eine). Ausdauer-Tage des Nebenziels kommen nur dazu, wenn danach noch Tage frei sind: 1 Tag → 1 Kraft; 2 Tage → 2 Kraft, Hinweis `secondary_endurance_no_room` („Für dein Ausdauer-Ziel ist bei so wenigen Tagen kein Platz. Mit einem dritten Tag planen wir Ausdauer ein.“ – gilt auch für 1 Tag, Wächter Z1 K-5); ab 3 Tagen → 2 Kraft + Ausdauer nach `ENDURANCE_SECONDARY_SUGGESTION`, gedeckelt durch `ENDURANCE_START_RULES.maxSessionsPerWeek[group]`; übrige Tage bleiben frei (11 Nr. 4). Bei Hauptziel Ausdauer gilt umgekehrt: Ausdauer zuerst nach den heutigen Regeln, das Kraft-Nebenziel bekommt die übrigen Tage (mindestens 1, wenn Platz ist).
  - Bestehende Deckel gelten unverändert: max. 4 Kraft-Tage, Wochensumme `weeklySessionCap`, ≤ 10 % Steigerung, Erholungswochen.
  - Bei Muskelaufbau + Ausdauer kommt der Hinweis `concurrent_training`: „Ausdauer und Muskelaufbau gehen gut zusammen. Plane Ausdauer möglichst nicht direkt vor dem Krafttraining; Rad ist schonender für die Beine als Laufen.“ Quelle: Wilson JM et al. (2012), J Strength Cond Res 26(8):2293–2307.
- **Hauptziel Ausdauer mit Nebenziel Kraft-Ziel:** Die Vorlage folgt `GOAL_TEMPLATE_MAPPING.endurance` (heute general_fitness, Fallback). Empfehlung: Bei Nebenziel Muskelaufbau oder Definition wird stattdessen die Muskelaufbau-Vorlage genommen (`templateGoal` aus dem Profil, Art `mapped`).
- **Matching:** `scoreTemplate` und `matchTemplate` lesen `profile.templateGoal` statt `inputs.goalType`. Die Punkte bleiben unverändert (35 für das Ziel).
- **Hinweise:**
  - `scheduleHints`: Hauptziel Kraft → „mindestens 2 Kraft-Tage“; Kraft-Ziel nur als Nebenziel → „mindestens 1 Kraft-Tag“. Hauptziel Ausdauer → „mindestens 2 Ausdauer-Tage“; Ausdauer als Nebenziel → „mindestens 1“ (ab 3 Tagen, sonst `secondary_endurance_no_room`).
  - `goal_endurance_not_yet` und `endurance_basic_only` sobald Ausdauer eines der Ziele ist.
  - Titel: `planTitle` liefert `endurance_base` nur bei Hauptziel Ausdauer; sonst stellt die App „Abnehmen + Ausdauer · 3 Tage“ zusammen.

### 4.4 Kalorien und Makros je Kombination (`GOAL_PAIR_RULES` in `constants.ts`, PRODUKTENTSCHEIDUNG – fachlich prüfen)

| Kombination                             | Energie-Anpassung (Standard ohne konkretes Ziel) | Eiweiß g/kg | KH nach Training | Begründung                                                 |
| --------------------------------------- | ------------------------------------------------ | ----------- | ---------------- | ---------------------------------------------------------- |
| Einzelziele                             | wie heute                                        | wie heute   | nur endurance    | unverändert                                                |
| Abnehmen → Muskelaufbau                 | −15 %                                            | 2,2         | –                | Helms 2014; Muskelerhalt im Defizit                        |
| Muskelaufbau → Abnehmen (Recomposition) | −10 % (= Definition)                             | 2,2         | –                | Barakat 2020; kleines Defizit, hohes Eiweiß                |
| Abnehmen → Ausdauer                     | −15 %                                            | 2,0         | ja               | Energieverfügbarkeit; die EA-Untergrenze greift zusätzlich |
| Definition → Ausdauer                   | −10 %                                            | 2,2         | ja               | –                                                          |
| Muskelaufbau → Ausdauer                 | +5 % (alle Level)                                | 1,8         | ja               | Überschuss klein wegen Ausdauer-Energie (Thomas 2016)      |
| Fitness → Abnehmen                      | −15 %                                            | 2,0         | –                | –                                                          |
| Fitness → Ausdauer                      | 0 %                                              | 1,4         | ja               | entspricht dem heutigen Ziel Ausdauer                      |
| Ausdauer → Abnehmen                     | −10 %                                            | 2,0         | ja               | Leistung zuerst; Wettkampfwoche ohne Defizit (Phase 10)    |
| Ausdauer → Definition                   | −10 %                                            | 2,2         | ja               | –                                                          |
| Ausdauer → Muskelaufbau                 | 0 %                                              | 1,8         | ja               | –                                                          |

- **Energie-Richtung** des Profils (`deficit`/`maintenance`/`surplus`) ersetzt `DEFICIT_GOALS` in `eligibility.ts` und `goalIsSurplus` in `targets.ts`. Sonderfälle (unter 18, BMI < 18,5, ohne Check, Schwangerschaft) greifen so auch bei Kombinationen.
  - Die Richtung wird **nicht separat gepflegt**, sondern aus dem Vorzeichen der Anpassung abgeleitet: `direction = sign(adjustment)` (< 0 Defizit, 0 Erhalt, > 0 Überschuss) (Wächter S11).
  - `goalIsSurplus = direction === 'surplus'`, **nie** „Muskelaufbau ist eines der Ziele“. Sonst bekäme „Abnehmen → Muskelaufbau“ die höhere Überschuss-Obergrenze.
  - Eigenschaftstest über alle 10 erlaubten Paare und alle Level: Richtung = Vorzeichen, `goalIsSurplus` nur bei positiver Anpassung, Defizit-Paare haben nie die Überschuss-Obergrenze.
- Das Eiweiß bleibt durch `eligibility` begrenzt (≤ 1,6 bei unter 18, Medikamenten, ohne Check; 1,2–1,6 ab 65; Obergrenze 2,2; Nierenhinweis > 1,6).
- Ein konkretes Abnehmziel (Abschnitt 2.4) ersetzt nur die Energie-Anpassung, nicht das Eiweiß.

### 4.5 Kernfunktion

`packages/core/src/goals/profile.ts`:

- `goalSelectionSchema = z.strictObject({ primary: goalTypeSchema, secondary: goalTypeSchema.nullable().default(null) }).refine(isAllowedGoalPair)`
- `goalProfile(selection, level): GoalProfile` mit `{ primary, secondary, templateGoal, templateKind, energy: { direction, adjustment }, proteinGPerKg, enduranceCarbs, strengthGoal, enduranceRole: 'primary'|'secondary'|null, notices }`

**Invariante (Test):** Für jedes Einzelziel liefert `goalProfile({primary: g, secondary: null})` exakt die heutigen Werte (`GOAL_TEMPLATE_MAPPING`, `GOAL_ENERGY_ADJUSTMENT`, `PROTEIN_G_PER_KG`, `DEFICIT_GOALS`), und die bestehenden Snapshot-Tests von `generate`/`targets` bleiben unverändert.

### 4.6 Auswirkungen auf bestehende Teile

- **Bestehende Pläne:** Das Nebenziel ist `null`, also keine Änderung und kein Angebot „Plan neu erstellen?“.
  - `planInputsSchema`/Schnappschuss bekommen `secondaryGoalType` (optional, Zod-Standard `null`). Alte `user_plans.inputs` ohne den Schlüssel werden mit `null` gelesen.
  - **Payload** (`save_training_plan`): Der Schlüssel wird **nur geschrieben, wenn er nicht `null` ist** (Wächter B1). Vor Z4 kann niemand ein Nebenziel wählen, der Payload bleibt also bis dahin byte-gleich zu heute.
  - Tests: alter Schnappschuss gegen aktuelle Angaben ohne Nebenziel → kein Angebot; Payload ohne Nebenziel hat **genau die Schlüsselmenge von heute**.
- **Nebenziel geändert:** Das bestehende `planUpdateOffer` bietet einen neuen Plan an (Snapshot unterscheidet sich). Ein geändertes Abnehmziel betrifft nur die Ernährung, nicht den Trainingsplan.
- **Wochenübersicht/Heute:** Zielname „Abnehmen + Muskelaufbau“. **Kein** Fortschrittsbalken zum Zielgewicht, keine Gewichtskurve mit Ziellinie (Empfehlung, Frage F13).
- **Live-Anpassung (4b, später):** Auslöser „Ziel geändert“ gilt auch für das Nebenziel und das Abnehmziel. Die Kalorienregeln nutzen die Energie-Richtung des Profils; alles bleibt in `clampCalorieTarget`. Die Plateau-Regel liest kein Abnehmziel (2.4 Nr. 9, S10). Wird im 4b-Plan nachgetragen.
- **Ernährung N1–N4:** `nutritionInputsSchema` bekommt `secondaryGoalType` und `weightGoal` (beide optional, Standard `null`). Betroffen sind `applyGoalAdjustment` (Profil), `eligibility` (Richtung), `macros` (Eiweiß, KH-Regel) und neue Hinweis-Codes in `notices.ts` (`weight_goal_pace_capped`, `weight_goal_reached`, `weight_goal_date_passed`, `weight_goal_invalid`, `weight_goal_no_deficit`, `concurrent_training`, `secondary_endurance_no_room`).
  - N5 (automatische Neuplanung): Ein neues Abnehmziel verschiebt das Band, der Essensplan wird über `needsAutomaticReplan` erneuert. Ist N5 schon fertig, braucht es nur einen Test, sonst ist es dort zu berücksichtigen.
  - N6 (PDF Ernährung): kein Zielgewicht, kein Ziel „wegen …“.
- **Trainings-PDF:** Planname mit beiden Zielen. Nie Zielgewicht oder Tempo (Regel B1).
- **Export:** `goals` mit neuer Spalte automatisch; `weight_goals` neu in `DATA_EXPORT_TABLES` (bis zur Migration in `PENDING_DB_EXPORT_TABLES`, wie bei `exercise_preferences`).
- **Migration bestehender Nutzer:** nur neue, leere bzw. `null`-Spalten, kein Datenumbau. Wer heute „Definition“ hat, behält sie.

---

## 5. Datenmodell

### 5.1 `assert_plan_inputs` und `goals` (kein Gesundheitsdatum)

**In Z1** (Wächter B1), Migration `2026xxxx_plan_inputs_secondary_goal.sql`, nur DB-Funktionen, keine Tabelle:

- `private.goal_pair_allowed(goal_type, goal_type) returns boolean immutable` mit fester Liste = `GOAL_COMBINATIONS`. Der Abgleich in `db-sync.test.ts` liest die Liste aus der Migration.
- `private.assert_plan_inputs` wird erneuert (auf Basis der letzten Fassung aus `20261005130100_plan_session_kinds.sql`):
  - Heute dient **eine** Liste `input_keys` für `assert_json_keys` und `?&`. Künftig gibt es **zwei** Arrays (Wächter N3): `required_keys` (die sechs heutigen Schlüssel, für `?&`) und `allowed_keys` = `required_keys` + `secondaryGoalType` (für `assert_json_keys`).
  - Fehlender Schlüssel und JSON-`null` bedeuten beide „kein Nebenziel“ (`->>` liefert in beiden Fällen SQL-NULL).
  - Sonst wird der Text **zuerst** mit `= any (enum_range(null::public.goal_type)::text[])` geprüft (wie `goalType`) und **erst danach** nach `public.goal_type` umgewandelt und an `private.goal_pair_allowed(goalType, secondaryGoalType)` gegeben. So führt ein ungültiger Text zu „Ungültige Angaben im Plan.“ und nicht zum unkontrollierten Fehler 22P02.
  - Nur `assert_plan_inputs` wird neu gefasst. Die aktuelle `save_training_plan` (`20261006120200_training_log_rpcs.sql`) ruft sie auf; andere Aufrufer gibt es nicht.
- pgTAP (Nummer ab 27, vorher prüfen), getrennte Fälle: Payload **ohne** Schlüssel → ok; Schlüssel mit **JSON-`null`** → ok; erlaubtes Paar → ok; unbekannter Text (kein Enum-Wert) → „Ungültige Angaben im Plan.“ (nicht 22P02); verbotenes Paar → Fehler; doppeltes Ziel → Fehler; Zahl statt Text → Fehler.

**Warum das in beide Richtungen trägt** (korrigiert nach Wächter B1):

- Alte App + neue Datenbank: Der Schlüssel ist optional, alte Payloads ohne ihn bleiben gültig.
- Neue App + alte Datenbank (Zeitfenster zwischen Vercel-Deploy und `db-migrate`): Das trägt **nur**, weil der Payload den Schlüssel bei `null` nicht sendet (4.6). Vor Z4 ist er immer `null`. Ab Z4 läuft die Z1-Migration längst.
- Die frühere Aussage „neuer Schlüssel optional, funktioniert in beide Richtungen“ (mit Migration erst in Z3) war falsch: Eine neue App hätte an der alten Datenbank jedes Speichern gebrochen.

**In Z3**, Migration `2026xxxx_goals_secondary.sql`:

- Neue Spalte `secondary_goal_type public.goal_type`.
- `check (secondary_goal_type is null or private.goal_pair_allowed(goal_type, secondary_goal_type))` (Funktion aus Z1).
- Den bestehenden Disziplin-CHECK (heute unbenannt, inline; Name vorher aus dem Katalog bzw. der Migration ermitteln) ersetzen durch `discipline is null or 'endurance' in (goal_type, secondary_goal_type)`.
- RLS unverändert (Policies gelten für die ganze Zeile).

### 5.2 `weight_goals` (Art. 9, nur mit `health_data`)

```
create table public.weight_goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  target_weight_kg numeric(4,1) not null check (target_weight_kg between 30 and 300),
  start_date  date not null,
  target_date date not null,
  amount_mode text not null check (amount_mode in ('kg_to_lose','target_weight')),
  time_mode   text not null check (time_mode in ('weeks','date')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (target_date between start_date + 28 and start_date + 728)
);
comment … 'SENSIBEL (Art. 9 DSGVO). Nur mit Einwilligung health_data; wird beim Widerruf gelöscht.'
```

- **Kein `start_weight_kg`** (Wächter K9): Es wäre eine Kopie aus `body_metrics`. „Zielgewicht < aktuelles Gewicht“ prüft Zod beim Speichern; zur Laufzeit gilt das Ziel bei einem Gewicht ≤ Ziel als erreicht (2.4).
- **`start_date` = Tag des Speicherns**, bei jedem Speichern neu (Wächter S15). Dann hält der Datums-CHECK auch beim Verlängern nach Ablauf. pgTAP: Verlängern eines abgelaufenen Ziels mit neuem `start_date` gelingt.
- RLS genau wie `body_metrics`: select und delete nur eigene Zeilen; insert und update nur eigene Zeilen **und** `public.has_valid_consent('health_data')`. Rechte: `revoke all … from anon, authenticated` und dann gezielte `grant`s.
- **Nur mit Abnehmziel speicherbar** (Wächter S13, Datensparsamkeit Art. 5 Abs. 1 c): BEFORE-insert/update-Trigger auf `weight_goals` prüft, dass in `goals` des Nutzers `'fat_loss' in (goal_type, secondary_goal_type)` gilt, sonst Fehler „Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.“ Ein direkter API-Insert ohne Abnehmziel ist damit unmöglich.
- **Ziel-BMI** prüfen Zod beim Speichern sowie Engine und Ampel bei jeder Rechnung mit der neuesten Größe (Wächter S14, 2.3). Ein DB-Trigger dafür ist nicht nötig: Ein unzulässiges Ziel wird ignoriert, es lockert keine Grenze (F5).
- Trigger `set_updated_at`.
- **Widerruf:** `consents_after_revoke()` ergänzt um `delete from public.weight_goals where user_id = new.user_id;`. Testmodus: `applyHealthDataRevocation` setzt `weightGoal: null`.
- **Datensparsamkeit:** Trigger auf `goals` nach **update und delete** löscht `weight_goals`, wenn `fat_loss` weder Haupt- noch Nebenziel ist bzw. die Zeile weg ist (Wächter S13). Testmodus: in `write-ops.ts` beim `upsert_goals` genauso.
- **Export:** `export_my_data()` und `DATA_EXPORT_TABLES` ergänzen.
- **Absicherung gegen verlorene Änderungen** (Wächter S16): `consents_after_revoke()` und `export_my_data()` werden in mehreren Migrationen neu definiert, und Phase 5 N7 erweitert sie auch (Reihenfolge Z3 ↔ N7 offen). Jede Neufassung baut auf der **jeweils letzten** Fassung auf. Ein neuer Test in `db-sync.test.ts` prüft: Jede Tabelle, deren Kommentar mit „SENSIBEL (Art. 9“ beginnt, wird in der letzten Fassung von `consents_after_revoke` gelöscht und steht in der letzten Fassung von `export_my_data`. Geprüft wird der Kommentar-**Anfang** „SENSIBEL (Art. 9“ (Wächter N4); das erfasst heute `body_metrics`, `health_screening`, `body_measurements` und künftig `weight_goals`. Tabellen, die nur teilweise sensibel sind, stehen in einer festen Ausnahmeliste im Test, mit eigener Prüfung der Teil-Löschung: `food_preferences` (Kommentar „kind = intolerance ist SENSIBEL …“, Migration `20261003120500_nutrition_preferences.sql`) und `user_plans` (nur Zeilen mit `uses_health_data = true`). Den Test gibt es ab Z3; er schützt auch N7.
- **Kein Partner-Modus** (Wächter K7): `weight_goals` ist ausdrücklich vom späteren Partner-Modus ausgeschlossen, auch wenn „Ernährung“ freigegeben ist. Das wird im Partner-Modus-Plan als feste Regel übernommen.
- pgTAP ab der nächsten freien Nummer nach Z1: RLS fremder Nutzer, ohne Einwilligung kein insert/update, Widerruf löscht, CHECKs, Paar-CHECK, Trigger „nur mit Abnehmziel“, Trigger bei `goals`-Update und -Delete.
- Typen: `packages/db` (`database.types.ts`) neu erzeugen über die bestehende Action.

### 5.3 Testmodus (`apps/mobile/src/data`)

- `types.ts`: `GoalAnswer` + `secondaryGoalType`; neuer `WeightGoalAnswer`; `UserRows.weightGoal`.
- `mapping.ts`: `toGoalsRow`, `toWeightGoalRow`, Rückweg.
- `write-ops.ts`: `upsert_weight_goal` (setzt `start_date = heute`, prüft Abnehmziel wie der DB-Trigger), `delete_weight_goal`.
- `local-backend.ts`; `legacy-rows` (alte Gerätestände ohne Feld → `null`); Export; „Testdaten löschen“.

---

## 6. Onboarding und App (mobil + Web-Export)

1. **Schritt `goal`** (neu gestaltet):
   - „Was ist dir am wichtigsten?“ (Hauptziel, ChoiceList mit Kurzbeschreibung)
   - „Zweites Ziel (optional)“: nur erlaubte Nebenziele als Chips, nicht erlaubte ausgegraut mit Grund
   - ein Satz zur Kombination aus festen Textbausteinen (z. B. Recomposition: „Kleines Kaloriendefizit, viel Eiweiß, Krafttraining für Muskelaufbau.“; gleichwertige Paare wie in 4.2, K3)
   - Ausdauer-Block (Disziplin, Datum), sobald Ausdauer Haupt- oder Nebenziel ist
2. **Neuer Schritt `weight_goal`** direkt nach `goal`:
   - In `ONBOARDING_STEPS` und `HEALTH_DATA_STEPS`.
   - `isStepApplicable`: `fat_loss` in den Zielen und `healthDataConsent !== false`. Dafür bekommt `OnboardingState` das Feld `losesWeight?: boolean`; `undefined` zählt mit, wie bei den anderen Feldern.
   - **Wo die Listen-Änderung landet** (Wächter K4): In **Z3** kommen der Schritt in `ONBOARDING_STEPS` und die CHECK-Migration `profiles.onboarding_step` **gemeinsam**, damit `db-sync.test.ts` (verlangt Gleichheit) grün bleibt. Bis Z4 gibt es den Bildschirm noch nicht. `isStepApplicable` liefert deshalb bis Z4 für `weight_goal` immer `false` (Konstante `WEIGHT_GOAL_STEP_ENABLED = false` in core, Z4 setzt sie auf `true`). So gibt es kein Zeitfenster, in dem die App einen Schritt speichert, den die Datenbank nicht kennt.
   - Inhalt: Auswahl „ohne festes Ziel“ / „mit konkretem Ziel“ → Eingaben (2.2) → Ampel (3.4) → Essstörungs-Hinweis, Stillzeit-Hinweis (K5), Rückfrage bei ausgeblendeten Kalorienzahlen (K6).
   - Gesperrte Zustände aus 2.3 mit Knopf zur Abhilfe; Zustand „kein Defizit planbar“ (S1) und „über 2 Jahre“ (S2) mit Empfehlung „ohne festes Ziel“.
3. **Einstellungen:** „Angaben ändern“ deckt beide Schritte ab. Zusätzlich ein Eintrag „Dein Abnehm-Ziel“ (bearbeiten oder entfernen = „ohne festes Ziel“). Jedes Speichern plant ab heute neu (S15).
4. **Ziel-Lebenszyklus:**
   - Erreicht (seit `start_date` ein Gewicht ≤ Ziel, 2.4 Nr. 1): Karte auf „Heute“ ohne Konfetti und ohne Abzeichen: „Du hast dein Wunschgewicht erreicht. Wie geht es weiter?“ → Gewicht halten (Ziel Fitness) / neues Ziel / Muskelaufbau. Bis zur Wahl gilt Erhalt, auch wenn das Gewicht danach wieder leicht steigt (kein Hin- und Herspringen, S8).
   - Datum abgelaufen: Karte „Dein Zeitraum ist vorbei. Verlängern oder ohne festes Ziel weitermachen?“. Bis dahin gilt das Standard-Tempo.
   - Schwangerschaft gesetzt: Das Ziel ruht, und es gibt einen Hinweis.
   - Ziel unzulässig geworden (z. B. Größe geändert, S14): Hinweis `weight_goal_invalid` mit Knopf „Ziel anpassen“.
   - Kein Defizit mehr planbar (z. B. neues Flag `medication`, Körperfett gemessen): Hinweis `weight_goal_no_deficit` in den Einstellungen und in der Ernährungs-Übersicht: „Derzeit planen wir für dich kein Kaloriendefizit. Wir empfehlen ‚ohne festes Ziel‘.“ mit Knopf „Ziel ändern“ (K-d).
5. **Zustände:** Laden, Teil-Eingabe (Ampel „noch keine Bewertung“), Fehler je Feld, offline (Ampel rechnet lokal), keine Einwilligung, altes Gewicht, kein Defizit planbar. Screenshots hell und dunkel.
6. **Texte** in `apps/mobile/src/i18n/de.ts`: keine Heilversprechen, keine wertenden Wörter, kein „Du wirst X kg verlieren“, kein „garantiert“, kein „erreichbar am“ und kein Kalenderdatum zur Dauer (S20). Immer „wir planen …“ und „etwa“.
7. **Datenschutz:** keine Ampel-Werte, Zielgewichte oder Ziel-Ereignisse in Analytics, Logs oder Crash-Reports (K7).

---

## 7. Etappen (je ein PR mit Wächter-Prüfung; DoD laut CLAUDE.md: Typen/Zod, Migration mit RLS, Core mit Tests, UI mobil + Web, Leer-/Fehler-/Ladezustände, Deutsch, Doku)

**Z0 – Plan.** **Wächter-geprüft (Auflagen eingearbeitet), 13.10.2026.** F8 entschieden am 17.10.2026 – Z0 vollständig erledigt.

- Inhalt: Dieses Dokument als `docs/PLAN-ZIELE.md`, Status in `PROMPTS.md`, Fragen F1–F15.
- DoD: Antworten der Gründer bzw. „wie empfohlen“ (liegen vor, Abschnitt 0, außer F8); Wächter-Prüfung des Plans (erfolgt: „Freigabe mit Auflagen“, alle Auflagen eingearbeitet, Abschnitt 10). Z0 ist vollständig erledigt, sobald F8 entschieden ist. Z1 hängt nicht an F8 und kann vorher beginnen.

**Z1 – Core: zwei Ziele / Ziel-Profil, dazu die Migration für `assert_plan_inputs`.**

- Inhalt:
  - `goals/profile.ts`, `GOAL_COMBINATIONS`, `GOAL_PAIR_RULES` (Konstanten mit Quellen), `goalSelectionSchema`
  - `createGoalStepSchema` mit `secondaryGoalType`; `planInputsSchema`/Snapshot/Payload. **Alle neuen Zod-Felder optional mit Standard `null`**. Der Payload sendet `secondaryGoalType` nur, wenn er nicht `null` ist (B1).
  - Migration `…_plan_inputs_secondary_goal.sql` (5.1): `private.goal_pair_allowed`, `assert_plan_inputs` mit optionalem Schlüssel; pgTAP; Abgleich der Paarliste in `db-sync.test.ts`. Sie läuft beim Merge über `db-migrate.yml`, nur DB-Funktionen, harmlos.
  - Umstellung `match.ts`, `generate.ts`, `title.ts`, `training-schedule.ts` (Vorschläge mit Vorrang „Hauptziel zuerst“, Hinweise), `nutrition/limits.ts`, `eligibility.ts`, `macros.ts`, `targets.ts` auf das Profil (Energie-Richtung aus dem Vorzeichen, S11)
- Keine App, keine Tabelle. `toGoalsRow` und `upsert_goals` (App und Testmodus) bleiben bis Z3 **unverändert**, weil es die Spalte `secondary_goal_type` vorher nicht gibt (Wächter Runde 2, K-f).
- Tests:
  - Invariante Einzelziele (alle Snapshots unverändert)
  - Payload ohne Nebenziel = **Schlüsselmenge wie heute** (B1); alter Plan-Schnappschuss ohne Schlüssel → kein Update-Angebot
  - jedes erlaubte Paar und jedes verbotene Paar (Zod und pgTAP)
  - Disziplin bei Ausdauer als Nebenziel
  - Richtung = Vorzeichen der Anpassung, `goalIsSurplus` nur bei Überschuss, über alle 10 Paare (S11)
  - für jedes Paar und jede Kombination aus Ort, Level und Tagen enthält die gewählte Vorlage alle Haupt-Bewegungsmuster (S17)
  - Vorbelegung mit Ausdauer-Nebenziel bei 1, 2, 3 und 7 Tagen sowie mit `cautious` (S18)
  - Eigenschaftsraster (S19): Paare × Flags (inkl. kein Check) × Geschlecht (männlich/weiblich/divers/ohne Angabe) × mit und ohne Körperfett (Katch) × alle 5 Alltagsfaktoren × Alter 16/17/18/64/65/100 × BMI 16,9/18,4/18,5/19,9/20/30 × 0–7 Einheiten (inkl. Tage mit gedeckelter Trainingsenergie) × 4b-Versatz 0/±1.000, dazu der Grenzfall 45 kg mit BMI ≈ 18,5 bei kleiner Größe (≈ 156 cm) → Ziel immer in [Untergrenze, Obergrenze], strengste Regel gewinnt. Das Raster läuft als Stichprobe mit festem Seed, damit die Laufzeit in CI klein bleibt. Die **Eckfälle aus CLAUDE.md** laufen zusätzlich immer **vollständig** mit, nicht nur zufällig (Wächter Runde 2, K-b): Alter 16/17/18/65/100, 30/300 kg, 1 vs. 7 Trainingstage, alle Sonderfall-Deckel, alle Geschlechter.
- Kann **parallel zu N5/N6** laufen (nur Core plus eine DB-Funktions-Migration, keine App-Konflikte).

**Z2 – Core: Abnehmziel und Ampel.**

- Inhalt: `goals/weight-goal.ts` (Schemas, Normalisierung, Validierung 2.3), `goals/weight-goal-feasibility.ts` (r, C an zwei Ständen, Stufe, N, Zeigerposition mit Klemmung, Zustände `no_deficit` und „über 2 Jahre“), Integration in `nutritionTargetsForWeek` (2.4, `weightGoal` optional mit Standard `null`), Hinweis-Codes, Konstanten 3.2 (Ziel-BMI vorläufig bis F8).
- Tests:
  - Rechenbeispiele A–I (3.3) wörtlich als Tests (Werte mit den echten Funktionen bereits nachgerechnet)
  - Grenzwerte mit `EPS` (S9): r = 0,5 / 0,5001 / 0,75 / 1,0 / 1,0001 % sowie r = C und knapp darüber; N bei ganzzahligem Quotienten (z. B. genau 9,0) und knapp darüber; Ziel-BMI 18,49/18,5/19,99/20; 3/4/104/105 Wochen; 0,9/1 kg; Ziel = aktuelles Gewicht
  - D_C negativ, 0, 1 kcal, knapp über 1 kcal (S1), mit Körperfett (Katch < Mifflin), divers/ohne Angabe und allen Deckeln (15 %/10 %/kein Check männlich)
  - Körperfett am Ziel: gleicher Prozentwert bei Messung ≤ 90 Tage, sonst Mifflin (N2); Beispiel G mit D(heute) und D(am Ziel)
  - bestehendes Ziel gerät zur Laufzeit in `no_deficit` → Engine plant sicher, Hinweis `weight_goal_no_deficit` (K-d)
  - CLAUDE.md-Eckfälle vollständig (K-b)
  - N > 104 → kein N, kein Knopf (S2); Knopf setzt `max(N, 4)`
  - Nach „Zeitraum übernehmen“ ist die Stufe immer Gelb oder Grün, auch bei C > 0,75 % (S3, Beispiel H)
  - Orange „ruhiger möglich“ vs. „langsamer“: Titel passt zu `weight_goal_pace_capped` (S4)
  - Zeiger-Zone = Stufe für alle Stufen, inkl. der Klemm-Fälle aus A (21 Wo.) und C (26 Wo.) und r an jeder Grenze ± 1e-12 (S5, K-a)
  - C ≤ C heute und ≤ C am Ziel; Geburtstag mit 65 im Zeitraum senkt C (S6)
  - am Zieldatum und am Tag davor; restWochen gezählt ab d (S7)
  - Gewichtsfolge 80,1 → 79,9 → 80,2 bleibt „erreicht“ (S8)
  - Größe nachträglich geändert → Ziel-BMI unzulässig → Ziel ignoriert, Hinweis, keine Ampel (S14)
  - 30/45/200/300 kg; 16/17 J. 364 Tage/18/65/100 J.
  - Datum: heute + 27/28 Tage, 29. Februar, Zeitumstellung
  - kein Aufholen in der letzten Woche
  - erreicht → Erhalt; abgelaufen → Standard
  - Eigenschaftstest: kein Abnehmziel lockert eine Grenze (Ziel ≥ `dayFloorKcal`, Tempo ≤ 1 %, Defizit ≤ Deckel; auch mit 4b-Versatz ±1.000), mit dem erweiterten Raster aus Z1 (S19)
  - Eigenschaftstest F5: Mit konkretem Ziel ist das Defizit an jedem Tag ≤ dem Defizit ohne festes Ziel (gleiche Person, gleicher Tag, alle Paare aus 4.4); C ist nie größer als das Tempo der Standard-Anpassung; N ≥ Wunschwochen bei Orange und Rot
  - `pace_capped` erscheint höchstens einmal pro Woche (K10)
  - CI-Tabelle „Beispiel-Ernährung“ um Personen mit konkretem Ziel und zwei Zielen ergänzen
- Kann parallel zu N5/N6 laufen.

**Z3 – Datenmodell, Migration, Testmodus.** **Umgesetzt am 17.10.2026** (Abschnitt 13).

- Inhalt: Migrationen 5.1 (Teil Z3) und 5.2: `goals.secondary_goal_type`, Paar-CHECK, Disziplin-CHECK, `weight_goals` mit RLS, Trigger „nur mit Abnehmziel“, Widerruf, Trigger Datensparsamkeit (update und delete), `export_my_data`, CHECK `onboarding_step` + `weight_goal` zusammen mit `ONBOARDING_STEPS` (Schritt bis Z4 abgeschaltet, K4). Dazu pgTAP, `db-sync.test.ts` (inkl. SENSIBEL-Test S16), `database.types.ts`, Testmodus-Backend (5.3), `DATA_EXPORT_TABLES`.
- DoD: `db-test` grün, Widerruf löscht `weight_goals` (Testmodus und DB), Export enthält beides, Legacy-Gerätestände laden, Verlängern nach Ablauf gelingt (S15), Insert ohne Abnehmziel scheitert (S13).
- Die Migration ist harmlos (nur neue Spalte bzw. Tabelle) und läuft beim Merge über `db-migrate.yml`.

**Z4 – App: Onboarding mit Ampel.**

- Voraussetzung: F8 entschieden (Ziel-BMI-Grenze ist ab hier für Nutzer sichtbar) – **erfüllt am 17.10.2026** (20, ab 70 J. 22; im Core seit Z3).
- Inhalt: `GoalStep` neu, `WeightGoalStep`, `FeasibilityScale`, Token `caution` (`packages/ui`, `DESIGN.md`), `WEIGHT_GOAL_STEP_ENABLED = true`, Zustände, Texte.
- DoD (Playwright im Testmodus):
  - Haupt- und Nebenziel wählen, verbotenes Paar nicht wählbar
  - Eingabe „10 kg in 12 Wochen“ → Orange mit „etwa 22 Wochen“ (Beispiel A) → Knopf übernehmen → Gelb
  - Ziel-BMI unter der Grenze → Fehler
  - ohne Einwilligung → gesperrt
  - Screenreader-Labels prüfen (axe im Web, `role="meter"` mit `aria-valuemin/max/now`)
  - Screenshots hell und dunkel; EAS-Build Android (Zeiger-Animation, „Bewegung reduzieren“)

**Z5 – App: Einstellungen, Anzeigen, PDF, Lebenszyklus.**

- Inhalt: Einstellungen „Dein Abnehm-Ziel“, Planname mit zwei Zielen (Heute, Woche, Trainings-PDF), Hinweise in „Ernährung“ (pace_capped höchstens wöchentlich, K10), Karten „erreicht“ und „abgelaufen“, Angebot „Plan neu erstellen?“ bei Nebenziel-Änderung, automatische Neuplanung des Essensplans bei neuem Abnehmziel.
- DoD: Playwright Bearbeiten, Entfernen, Verlängern, Widerruf; PDF-Test ohne Zielgewicht und ohne Tempo; „So testest du es am Handy“.

**Z6 – Doku.**

- Inhalt:
  - `KONZEPT.md` §1, §2, §4, §6 und §12 (Abweichungen)
  - `PLAN-PHASE-5.md` 4.5/4.7/4.9 (Verweis auf das Profil)
  - `PLAN-PHASE-4B.md` (Plateau-Regel mit Profil und Tempo-Obergrenze, liest kein Abnehmziel, Test „Versatz mit und ohne Abnehmziel identisch“, S10)
  - Phase-10-Plan (Nebenziel Ausdauer, Wettkampfwoche ohne Defizit)
  - Partner-Modus-Plan: `weight_goals` ausgeschlossen (K7)
  - DSFA-Ergänzung `weight_goals`
  - `PROMPTS.md`-Status
- Z6 kann in Z5 aufgehen.

**Reihenfolge (F12, entschieden 13.10.2026):** Z0 (Plan, Wächter-geprüft) → Z1 und Z2 parallel zu Phase 5 (N5/N6; Core plus die kleine DB-Funktions-Migration in Z1, keine App-Konflikte) → nach Abschluss von Phase 5 (N6): Z3 → Z4 (nach F8) → Z5/Z6 → dann Phase 10. Phase 10 baut auf dem Ziel-Profil auf (Ausdauer als Nebenziel, Wettkampfdatum).

---

## 8. Offene Fragen an die Gründer (je mit Empfehlung)

Stand 13.10.2026: F1, F5, F7 und F12 haben die Gründer entschieden (Abschnitt 0). **F8 haben die Gründer am 17.10.2026 entschieden** (Wächter-Empfehlung: 20, ab 70 J. 22). Alle übrigen gelten als **„wie empfohlen“**, bis die Gründer widersprechen.

| Nr. | Frage                                                                                                        | Empfehlung                                                                                                                                                                                                                                                                                                                                                                                                      | Stand                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Zwei gleichrangige Ziele oder Haupt- und Nebenziel?                                                          | **Haupt- und Nebenziel.** Eindeutige Regel („Vorlage folgt Hauptziel“), leicht zu erklären.                                                                                                                                                                                                                                                                                                                     | **Entschieden: wie empfohlen** (Abschnitt 0).                                                                                                              |
| F2  | Welche Paare sind erlaubt?                                                                                   | **Tabelle 4.2.** Doppelte (Definition + Abnehmen/Muskelaufbau) und Fitness als Nebenziel sind gesperrt. Gleichwertige Paare bleiben erlaubt und werden erklärt (K3).                                                                                                                                                                                                                                            | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F3  | Ein neues Ziel „Kraft“ (Maximalkraft, 3–6 Wdh.)?                                                             | **Nicht jetzt.** Es gibt keine Vorlagen dafür; neue Vorlagen über die Batch-Pipeline erst mit Fachprüfung, eigene spätere Etappe. Das Beispiel „Muskelaufbau + Kraft“ deckt Muskelaufbau heute weitgehend ab.                                                                                                                                                                                                   | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F4  | „Definition“ behalten, obwohl Muskelaufbau + Abnehmen fast dasselbe ist? Konkretes Ziel auch bei Definition? | **Behalten** (keine Datenumstellung), in der App erklären. Konkretes Ziel **nur bei Abnehmen** (Wunsch der Gründer).                                                                                                                                                                                                                                                                                            | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F5  | Darf ein konkretes Ziel das Defizit über das Standard-Tempo hinaus vergrößern?                               | Ursprüngliche Empfehlung: ja, bis höchstens 0,75 %/Woche. Alternativen: (a) nur verkleinern, nie über den Standard −20 %; (b) bis 1 %/Woche.                                                                                                                                                                                                                                                                    | **Entschieden: (a) „Nie schneller als heute“** – nur verkleinern, nie über die Standard-Anpassung des Profils (Abschnitt 0, 2.4, 3.1).                     |
| F6  | Ampel-Stufen und Grenzwerte?                                                                                 | **4 Farben** Grün ≤ 0,5 %, Gelb ≤ 0,75 %, Orange ≤ 1 % oder über der persönlichen Kapazität, Rot > 1 %. Nach der Wächter-Prüfung technisch präzisiert: Orange mit zwei Texten („ruhiger möglich“ bzw. „langsamer“, S4); ein unzulässiges Ziel ist keine Stufe, sondern ein Fehler. Mit Fachkraft vor Livegang prüfen.                                                                                           | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F7  | „Keine Gewichts-Prognosen“ (Entscheidung 3) gegen „realistische Dauer anzeigen“?                             | **Ja, Dauer anzeigen**, aber als Planungsdauer („Sicher planbar sind etwa N Wochen“), nicht als Vorhersage. Keine Gewichtskurve, kein Countdown, kein „Du wiegst am … X kg“, kein Kalenderdatum zur Dauer. Entscheidung 3 wird so präzisiert und dokumentiert.                                                                                                                                                  | **Entschieden: ja**, nur Planungsdauer, keine Kurve, kein Countdown, keine Gewichtsprognose (Abschnitt 0; Verweis in `PLAN-PHASE-5.md` 4.6 Nr. 3 und 4.9). |
| F8  | Untergrenze Zielgewicht?                                                                                     | Ursprünglich: **BMI 18,5 hart** (WHO), 18,5 bis < 20 erlaubt mit Hinweis. **Wächter-Empfehlung (S12): hart 20, ab 70 J. hart 22.** Begründung: Die GLIM-Kriterien (Cederholm T et al. 2019, Clin Nutr 38(1):1–9) werten BMI < 20 (unter 70 J.) bzw. < 22 (ab 70 J.) als Merkmal für Mangelernährung; ein bewusst angesteuertes Ziel dort steht dazu in Spannung. Mindestens für ab 65/70 J. eine höhere Grenze. | **Entschieden am 17.10.2026: Wächter-Empfehlung** – hart 20, ab 70 J. (Alter am Zieldatum) hart 22. Umgesetzt in Z3.                                       |
| F9  | Eingabe-Standard?                                                                                            | **„kg abnehmen“ + „Wochen“** (Wortlaut des Wunsches), umschaltbar auf „Zielgewicht“ bzw. „Datum“.                                                                                                                                                                                                                                                                                                               | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F10 | Was passiert bei Ziel erreicht oder Datum vorbei?                                                            | **Erreicht → Erhalt + Auswahl, wie es weitergeht (bleibt „erreicht“, auch wenn das Gewicht wieder leicht steigt). Vorbei → Standard-Tempo + Angebot verlängern (Verlängern plant ab heute neu).** Nie automatisch beschleunigen.                                                                                                                                                                                | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F11 | Gratis oder Premium?                                                                                         | **Gratis.** Rein regelbasiert, keine KI (CLAUDE.md KI-Grenze).                                                                                                                                                                                                                                                                                                                                                  | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F12 | Reihenfolge zu Phase 5 und Phase 10?                                                                         | **Z1 und Z2 parallel zu N5/N6, Z3–Z6 nach Phase 5 und vor Phase 10.**                                                                                                                                                                                                                                                                                                                                           | **Entschieden: wie empfohlen** – Logik (Z1, Z2) jetzt parallel zu Phase 5, App (Z3–Z5) nach Phase 5 und vor Phase 10.                                      |
| F13 | Fortschritt zum Zielgewicht (Balken, Kurve mit Ziellinie) auf „Heute“ oder „Fortschritt“?                    | **Nein** (Schutz vor ungesundem Umgang, passt zu „keine Prognosen“). Das Ziel ist nur unter Einstellungen sichtbar.                                                                                                                                                                                                                                                                                             | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F14 | Ampel auch zeigen, wenn „Kalorienzahlen anzeigen“ aus ist?                                                   | **Ja.** Die Ampel zeigt keine kcal, nur Stufe und Wochen. Beim Einschalten eines konkreten Ziels mit ausgeblendeten Zahlen eine ruhige Rückfrage (K6).                                                                                                                                                                                                                                                          | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |
| F15 | Disziplin und Wettkampfdatum auch beim Nebenziel Ausdauer?                                                   | **Ja**, Disziplin wirkt sofort (Modalität), das Datum ab Phase 10.                                                                                                                                                                                                                                                                                                                                              | Wie empfohlen (nicht gefragt, gilt bis Widerspruch).                                                                                                       |

---

## 9. Risiken

1. **Druck durch Zahlen und Ziele** (Essstörungen). Gegenmittel: keine Abfrage, aber fester Hinweis, Hilfe-Kontakte, harte BMI-Untergrenze (F8: 20, ab 70 J. 22), Tempo-Deckel, keine Prognosen, Kurven, Kalenderdaten oder Abzeichen, Rückfrage bei ausgeblendeten Kalorienzahlen, Ziel ruht bei Schwangerschaft, keine Ampel-Daten in Analytics.
2. **Formelfehler ±10 %** bei Grundumsatz und Alltagsfaktor, dazu 7.700 kcal/kg (Hall 2008). Gegenmittel: konkretes Ziel nie schneller als die Standard-Anpassung (F5), Kapazität am Zielgewicht (strengster Stand) und mit niedrigstem Alltagsfaktor, Neuberechnung bei jeder Gewichtsangabe, Formulierung „etwa“.
3. **Regression bei bestehenden Einzelzielen.** Gegenmittel: Invarianten- und Snapshot-Tests in Z1.
4. **Zeitfenster Migration/Deploy** (Wächter B1). Gegenmittel: Die `assert_plan_inputs`-Migration kommt schon in Z1 und macht den neuen Schlüssel optional (alte App + neue DB). Der Payload sendet den Schlüssel nur, wenn er nicht `null` ist, also vor Z4 nie (neue App + alte DB). Test: Schlüsselmenge ohne Nebenziel wie heute. Beim Onboarding-Schritt ebenso: Liste und CHECK kommen gemeinsam in Z3, der Schritt bleibt bis Z4 abgeschaltet (K4).
5. **Kombinationsvielfalt.** Gegenmittel: geschlossene Liste, Eigenschaftsraster über alle Paare, Geschlechter, Körperfett, Alltagsfaktoren und 4b-Versatz.
6. **Verlorene Änderungen an Widerruf/Export** zwischen Z3 und Phase 5 N7. Gegenmittel: SENSIBEL-Test in `db-sync.test.ts` (S16).

---

## 10. Wächter-Prüfung vom 13.10.2026: Auflagen und Umsetzung

Urteil: **Freigabe mit Auflagen.** Die Schutzgrenzen bleiben dicht; `clampCalorieTarget` bleibt die einzige Stelle mit Schutzgrenzen.

| Nr. | Auflage (kurz)                                        | Umsetzung im Plan                                                                                                                     |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Z1 bricht `save_training_plan` (feste Schlüsselliste) | Migration `assert_plan_inputs` in Z1; Payload ohne `null`-Schlüssel; alle neuen Zod-Felder optional `null` (1.2, 2.3, 4.6, 5.1, 7, 9) |
| S1  | D_C kann negativ sein                                 | Zustand `no_deficit` bei D_C ≤ 1 kcal; Beispiel G; Tests (2.3, 3.1, 3.3, Z2)                                                          |
| S2  | riesiges N                                            | N > 104 → kein N, kein Knopf (3.1, Z2)                                                                                                |
| S3  | Knopf führt nicht sicher aus Orange                   | N mit `min(v_C, 0,75 % × m)`; Beispiel H; Test „nach Übernehmen ≤ Gelb“ (3.1, 3.3, Z2)                                                |
| S4  | Orange-Text widerspricht dem Verhalten                | Orange „ruhiger möglich“ (r ≤ C) und „langsamer“ (r > C) (3.1, F6)                                                                    |
| S5  | Zeiger und Stufe widersprechen sich                   | `x = 1 − min(r/1,25 %, 1)`, Klemmung in die Stufen-Zone, Test (3.1, 3.3)                                                              |
| S6  | Kapazität zu optimistisch                             | C = Minimum aus heute und am Ziel (Gewicht, BMI-Klasse, Alter); Ruhetag dokumentiert; Beispiele neu (3.1, 3.3)                        |
| S7  | Division durch 0 am Zieldatum                         | aktiv nur bei `targetDate > d`, `restWochen = max(Tage ab d, 1)/7` (2.4)                                                              |
| S8  | „erreicht“ flackert                                   | „erreicht“ aus den Messungen seit `start_date` abgeleitet, bleibt bis zur Wahl; Test 80,1 → 79,9 → 80,2 (2.4, 6)                      |
| S9  | Gleitkomma an Grenzen                                 | Vergleiche und `ceil` mit `EPS`, nie gerundet vergleichen (3.1, Z2)                                                                   |
| S10 | 4b darf das Datum nicht aufholen                      | Plateau-Regel liest kein `weightGoal`, Test im 4b-Plan (2.4 Nr. 9, Z6)                                                                |
| S11 | Energie-Richtung / `goalIsSurplus`                    | Richtung aus dem Vorzeichen, `goalIsSurplus = direction === 'surplus'`, Eigenschaftstest (4.4, Z1)                                    |
| S12 | Ziel-BMI-Untergrenze (GLIM)                           | **entschieden (F8, 17.10.2026):** 20, ab 70 J. 22, umgesetzt in Z3 (0, 2.3, 3.2, 8, 13)                                               |
| S13 | `weight_goals` ohne Abnehmziel                        | BEFORE-Trigger „nur mit Abnehmziel“, Lösch-Trigger auch bei `delete`, pgTAP (5.2)                                                     |
| S14 | Ziel-BMI zur Laufzeit                                 | Engine und Ampel prüfen mit neuester Größe, `weight_goal_invalid` (2.3, 2.4, 5.2)                                                     |
| S15 | Verlängern bricht den CHECK                           | jedes Speichern setzt `start_date = heute` (2.2, 5.2)                                                                                 |
| S16 | Widerruf/Export auf neuester Fassung                  | SENSIBEL-Test in `db-sync.test.ts` (5.2, Z3)                                                                                          |
| S17 | Vorlagen-Befund ungenau                               | korrigiert (24 + 18 Vorlagen, bis zu 5 Übungen Unterschied); Muster-Test (1.2, 4.3, Z1)                                               |
| S18 | kleines Zeitbudget mit Ausdauer-Nebenziel             | Vorrang „Hauptziel zuerst“, gleiche `suggestionGroup`/`ENDURANCE_START_RULES`, Tests 1/2/3/7 Tage + `cautious` (4.3, Z1)              |
| S19 | Lücken im Raster                                      | Geschlecht, Körperfett, 5 Alltagsfaktoren, gedeckelte Trainingsenergie, 4b ±1.000, 45 kg/BMI 18,5 (Z1, Z2)                            |
| S20 | Rot-Text ist eine Prognose                            | ohne Monat/Jahr; Gelb „Wir planen in deinem Tempo“ (3.1, 6)                                                                           |
| K1  | Status erst nach Prüfung                              | Status „Wächter-geprüft (Auflagen eingearbeitet)“, Z0 erst mit F8 vollständig (Kopf, 7, PROMPTS.md)                                   |
| K2  | Phase 5 4.6 Nr. 3 ohne F7-Verweis                     | Verweis in `PLAN-PHASE-5.md` 4.6 Nr. 3 ergänzt                                                                                        |
| K3  | gleichwertige Paare                                   | erlaubt, in der App erklärt (4.2, 6)                                                                                                  |
| K4  | `ONBOARDING_STEPS` vs. CHECK                          | beides in Z3, Schritt bis Z4 abgeschaltet (6, Z3, Z4)                                                                                 |
| K5  | Stillzeit                                             | Hinweistext auf dem Ziel-Bildschirm (2.3)                                                                                             |
| K6  | „Kalorienzahlen ausblenden“                           | ruhige Rückfrage beim Einschalten des Ziels (2.3, F14)                                                                                |
| K7  | Analytics, Partner-Modus                              | keine Ampel-Daten in Analytics/Logs; `weight_goals` vom Partner-Modus ausgeschlossen (3.4, 5.2, 6)                                    |
| K8  | `role="meter"`, „etwa“                                | `aria-valuemin/max/now`, Prozentwerte mit „etwa“ (3.4)                                                                                |
| K9  | `start_weight_kg` nötig?                              | entfällt (2.2, 5.2)                                                                                                                   |
| K10 | `pace_capped` täglich                                 | höchstens wöchentlich, nur in der Ernährungs-Übersicht (2.4, Z5)                                                                      |

### Runde 2 (Nachprüfung, 13.10.2026): „Freigabe mit Auflagen“, keine Blocker

Ergebnis: B1, S1–S11, S13–S20 und K1–K10 gelöst; S12 bewusst offen (F8). Die Beispiele A, B, C und H hat der Wächter mit den echten Funktionen bestätigt.

| Nr. | Auflage (kurz)                                        | Umsetzung im Plan                                                                                                                               |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Beispiel G: D_C ist das Minimum aus heute und am Ziel | G nennt D(heute) ≈ −38,78 und D(am Ziel) ≈ −105,64 → D_C ≈ −105,64; mit echten Funktionen nachgerechnet (3.3)                                   |
| N2  | Körperfett im Stand „am Ziel“ offen                   | gleicher Prozentwert bei Messung ≤ 90 Tage (`isBodyFatUsable`), sonst Mifflin; Tests (3.1, Z2)                                                  |
| N3  | Migrationsentwurf präzisieren                         | zwei Arrays Pflicht/erlaubt; Enum-Prüfung vor dem Cast (kein 22P02); pgTAP fehlend vs. JSON-`null` getrennt; nur `assert_plan_inputs` neu (5.1) |
| N4  | falscher Tabellenname im SENSIBEL-Test                | `food_preferences` statt `nutrition_preferences`; `user_plans` in der Ausnahmeliste; Prüfung auf Kommentar-Anfang „SENSIBEL (Art. 9“ (5.2)      |
| K-a | Zeiger nur Richtung Rot geklemmt                      | Zone aus der Stufe, beidseitige Klemmung, Randtests (3.1, Z2)                                                                                   |
| K-b | Stichprobe statt Eckfälle                             | CLAUDE.md-Eckfälle immer vollständig (Z1, Z2)                                                                                                   |
| K-c | F12 „nur Core“ verändert                              | im Abschnitt 0 vermerkt, Mitteilung an die Gründer                                                                                              |
| K-d | Laufzeit-Wechsel in „kein Defizit planbar“            | Hinweis `weight_goal_no_deficit` (2.3, 4.6, 6, Z2)                                                                                              |
| K-e | Bearbeiten-Feld wirkt wie Restmenge                   | neutrale Beschriftung „kg abnehmen ab heute“, ohne „noch“ (2.2)                                                                                 |
| K-f | `toGoalsRow` in Z1                                    | bleibt bis Z3 unverändert (Z1)                                                                                                                  |

---

## 11. Umsetzung Z1 (13.10.2026): Abweichungen vom Plan

Z1 ist umgesetzt wie in Abschnitt 7 beschrieben (Ziel-Profil, `GOAL_PAIR_RULES`, Nebenziel in Plan und Ernährung,
Migration `20261013120000_plan_inputs_secondary_goal.sql`, pgTAP `27_plan_inputs_secondary_goal.test.sql`). Abweichungen:

1. **Schnappschuss ohne Schlüssel statt `null`:** Ohne Nebenziel fehlt `secondaryGoalType` im Schnappschuss
   (`planInputsSnapshot`) und im Payload ganz. Schnappschuss und Payload bleiben so byte-gleich zu vorher, und alte
   Pläne lösen kein Angebot „Plan neu erstellen?“ aus. `planSnapshot` behandelt ein gespeichertes `null` wie einen
   fehlenden Schlüssel. In den Zod-Eingaben (`planInputsSchema`, `createGoalStepSchema`, `nutritionInputsSchema`) gilt
   wie geplant „optional, Standard `null`“.
2. **Vier neue Hinweis-Codes statt zwei** in `SCHEDULE_HINTS`: neben `secondary_endurance_no_room` und
   `concurrent_training` auch `secondary_endurance_no_endurance` (Ausdauer als Nebenziel, ab 3 Tagen kein
   Ausdauer-Tag: „mindestens 1“) und `secondary_strength_no_strength` (Kraft-Ziel nur als Nebenziel: „mindestens 1“).
   Die bestehenden Codes nennen „mindestens 2“ und passen deshalb nicht. Texte stehen in `apps/mobile/src/i18n/de.ts`;
   ein Test prüft, dass jeder Code aus `SCHEDULE_HINTS` und `PLAN_NOTES` einen Text hat.
3. **`concurrent_training`** steht in den Trainings-Hinweisen (`scheduleHints`) und in `goalProfile().notices`, nicht in
   den Ernährungs-Hinweisen (`NUTRITION_NOTICE_CODES`).
4. **Vorbelegung bei Ausdauer als Nebenziel** (`suggestedTrainingSlots`):
   - Die Startgruppe „vorsichtig“ bekommt wie Einsteiger **1** Ausdauer-Tag (der Plan sagte nur „Einsteiger 1, sonst 2“).
   - Neuer optionaler Parameter `totalDays` (verfügbare Tage). Ohne ihn: 2 Kraft-Tage plus die Ausdauer-Tage.
   - Nach der Wächter-Prüfung Z1 (S-1): **2 Kraft-Tage** (bei 1 Tag dieser eine, nie zwei hintereinander) plus Ausdauer
     nach Startgruppe; **übrige Tage bleiben frei** (kein Auffüllen mit Kraft). Beispiel: 7 Tage, Fortgeschritten → 2 Kraft
     - 2 Ausdauer. „Vorsichtig“ bekommt höchstens so viele Einheiten wie beim Hauptziel Ausdauer (3), danach gilt der
       Wochen-Deckel. Ein Test belegt für 1–7 Tage × Level × vorsichtig × Hauptziele, dass der eigene Vorschlag keine
       eigenen Warn-Hinweise auslöst (erlaubt: `secondary_endurance_no_room`, `concurrent_training` und bei 1 Tag
       `strength_goal_no_strength`).

### Wächter-Prüfung Z1 (13.10.2026): „Freigabe mit Auflagen“, keine Blocker

| Nr. | Auflage (kurz)                                                                                                  | Umsetzung                                                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | Vorbelegung füllte bis 4 Kraft-Tage auf (eigener Hinweis `strength_back_to_back`, „vorsichtig“ mit 5 Einheiten) | 2 Kraft + Ausdauer, Rest frei; „vorsichtig“ ≤ Hauptziel Ausdauer; Test ohne eigene Hinweise (Nr. 4 oben)                                                                                              |
| S-2 | Ausführungsrecht für den CHECK ab Z3                                                                            | in Z1 erledigt: `grant execute on private.goal_pair_allowed … to authenticated, service_role` (Muster `has_distinct_elements`), anon nicht; pgTAP prüft die Rechte und den Aufruf als `authenticated` |
| S-3 | „Fitness → Ausdauer = Ausdauer“ gilt nur für Energie, Eiweiß und Vorlage, nicht für die Trainingswoche          | **Auflage für Z4**, siehe 4.2: Satz einschränken oder das Paar über den Ausdauer-Pfad vorbelegen                                                                                                      |
| K-1 | Ceiling-Test halb tautologisch                                                                                  | umbenannt; zusätzlicher Test über `nutritionTargetsForWeek` für alle Auswahlen                                                                                                                        |
| K-2 | Rechte-Test in pgTAP                                                                                            | `has_function_privilege` für authenticated, service_role, anon (beide Funktionen)                                                                                                                     |
| K-3 | Eckfälle ohne Einwilligung                                                                                      | in die vollständige Eckfall-Schleife aufgenommen                                                                                                                                                      |
| K-4 | Vorzeichen über alle Level                                                                                      | Hinweis bei `GOAL_ENERGY_ADJUSTMENT`                                                                                                                                                                  |
| K-5 | Text „bei so wenigen Tagen“                                                                                     | in 4.3 nachgezogen                                                                                                                                                                                    |
| K-6 | Status in PROMPTS.md                                                                                            | „Wächter-geprüft, Auflagen eingearbeitet“                                                                                                                                                             |
| K-7 | 7 Wunsch-Tage im Muster-Raster                                                                                  | ergänzt (1–4 und 7 Tage)                                                                                                                                                                              |

---

## 12. Umsetzung Z2 (13.10.2026): Abweichungen vom Plan

Z2 ist umgesetzt wie in Abschnitt 7 beschrieben: `goals/weight-goal-schema.ts` (gespeichertes Ziel), `goals/weight-goal.ts`
(Eingabe, Normalisierung, Validierung 2.3, Wirkung je Tag 2.4), `goals/weight-goal-feasibility.ts` (Ampel 3.1),
Integration in `nutritionTargetsForWeek`, Konstanten 3.2 (Ziel-BMI 18,5 als „VORLÄUFIG – F8“). Keine Migration, keine App.
Die Beispiele A, B, C, D–I laufen wörtlich als Tests (`weight-goal-feasibility.test.ts`, `weight-goal-targets.test.ts`).
Abweichungen:

1. **Hinweise je Woche statt je Tag:** Die Codes stehen in einer eigenen Liste `WEIGHT_GOAL_NOTICE_CODES` (`notices.ts`) und
   kommen einmal je Woche in `NutritionWeekTargets.weightGoalNotices` (Wächter K10 ist damit eingebaut). Je Tag gibt es
   `weightGoalStatus`, `weightGoalPaceCapped` und `goalAdjustment`. Die Tages-Hinweise (`NUTRITION_NOTICE_CODES`) und ihre
   App-Texte bleiben unverändert; die App-Texte der neuen Codes kommen mit Z5.
2. **`createWeightGoalSchema(person)`** bekommt die Eingaben der Ernährungs-Engine statt nur Gewicht, Größe, Alter und
   Flags: „kein Defizit planbar“ (S1) braucht Geschlecht, Körperfett, Alltagsfaktor und Ziele.
3. **Eigene Datei `weight-goal-schema.ts`** für das gespeicherte Ziel, sonst entstünde ein Import-Kreis
   (`nutritionInputsSchema` → Ampel → Energie → Schemas).
4. **Reihenfolge der Stände je Tag:** vor `startDate` kein Ziel → ungültig (Abnehmen kein Ziel mehr oder Ziel-BMI mit
   neuester Größe) → ruht (Modus nicht `full`, auch `no_targets`) → erreicht → abgelaufen → kein Defizit → aktiv. Die Anpassung liegt immer in [Standard; 0]. Liegt das
   neueste Gewicht schon vor `startDate` unter dem Ziel (nur per direktem API-Eintrag möglich), gilt das Ziel als ungültig.
5. **`no_deficit` zur Laufzeit (K-d):** Die Engine rechnet die Kapazität mit dem Alter des Tages (18. bzw. 65. Geburtstag
   in der Woche), einmal je Alter.
6. **`weight_goal_pace_capped`** auch dann, wenn eine Schutzgrenze das Ziel anhebt (Sonderfall-Deckel, Energieverfügbarkeit,
   Tage mit gedeckelter Trainingsenergie) – wie 2.4 Nr. 6.
7. **Struktur-Test** in `limits.test.ts`: Die Ampel-Datei darf `clampCalorieTarget` aufrufen (nur aufrufen, keine eigenen
   Grenzen). Der Kontext der Grenzen kommt für Engine und Ampel aus derselben Funktion `dayLimitContext`.
8. **Sichere Dauer:** Fällt mit dem Alter am Ende von N die Kapazität auf ≤ 1 kcal, gibt es kein N („über 2 Jahre“).
   `max(N, 4)` greift bei Orange und Rot nie (dort ist N ≥ Wunschwochen ≥ 4); ein Test hält das fest.
9. **Beispiel I konkret:** wie G, aber Körperfett 35 % → D_C ≈ 2,1 kcal (knapp über 1) → kein N; Körperfett 31 % → N = 108.
10. **Monatsangabe ab 27 Wochen** und alle Texte der Ampel sind App (Z4). Core liefert Entwurfstexte nur als
    Zod-Fehlermeldungen (`WEIGHT_GOAL_ISSUE_MESSAGES`).
11. **CI-Tabelle „Beispiel-Ernährung“:** Personen I (konkretes Ziel, Beispiel A, 26 Wochen) und J (Abnehmen → Muskelaufbau mit
    zu schnellem Ziel, Hinweis „etwas langsamer“).
12. **Restwochen ab Ankertag** statt ab Tag d (Wächter Z2 S-1, Plan 2.4 Nr. 2 angepasst).

### Wächter-Prüfung Z2 (13.10.2026): „Freigabe mit Auflagen“, keine Blocker

| Nr. | Auflage (kurz)                                                                                    | Umsetzung                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1 | Ampel „in deinem Tempo“, Engine meldet in Woche 1 „langsamer“ und verschärft täglich ohne Messung | Restwochen ab Ankertag = max(Messtag neuestes Gewicht, `startDate`), höchstens d (2.4 Nr. 2). Test: Grün/Gelb/Orange „ruhiger“ (A 26/22, H 6/7) → in der Woche ab dem Speichern kein `pace_capped`, gleichbleibende Anpassung; Orange „langsamer“/Rot bremst sofort bzw. sobald v_S < v_r (A 21 nach 15 Wochen). CI-Person I jetzt an allen Ruhetagen 2.270 kcal |
| K-1 | Tage vor `startDate` rechnen als aktiv                                                            | vor `startDate` kein Ziel (Status `null`), Test                                                                                                                                                                                                                                                                                                                  |
| K-2 | negativer 4b-Versatz löst `pace_capped` aus                                                       | **Vormerkung 4b** (siehe unten)                                                                                                                                                                                                                                                                                                                                  |
| K-3 | `no_targets` immer „ruht“, `maintenance_only` „ungültig“ zuerst                                   | einheitlich über `weightGoalPreStatus`: vor Start → ungültig → ruht, auch an Tagen ohne Zahlen; Test                                                                                                                                                                                                                                                             |
| K-4 | Tests schärfen                                                                                    | (a) D ≤ Defizit der Standard-Anpassung für 4 Personen × 6 Paare mit unabhängigem Grundbedarf; (b) Zustand je Gewicht 30/45/200/300 kg festgeschrieben; (c) D_C = 0 an einer echten Person (Stand am Ziel mit BMI < 18,5)                                                                                                                                         |
| K-5 | gespeichertes Ziel außerhalb `weightGoalSchema` bricht die Ernährungswoche                        | **Vormerkung Z3** (siehe unten)                                                                                                                                                                                                                                                                                                                                  |
| K-6 | Gewicht älter als 90 Tage bei bestehendem Ziel                                                    | **Vormerkung Z5** (siehe unten)                                                                                                                                                                                                                                                                                                                                  |
| K-7 | Doku/Status                                                                                       | Status-Kopf, `PROMPTS.md`, diese Tabelle                                                                                                                                                                                                                                                                                                                         |

**Vormerkungen aus der Wächter-Prüfung Z2:**

- **4b (K-2):** `weight_goal_pace_capped` vergleicht heute das begrenzte Ziel mit dem Vorschlag **inklusive** 4b-Versatz. Ein negativer Versatz, den eine Untergrenze abfängt, meldet so „langsamer“, obwohl schneller als benötigt geplant wird. Im 4b-Plan: Vergleich ohne Versatz führen oder nur „Grenze hebt über den Ziel-Vorschlag“ werten (zusammen mit S10).
- **Z3 (K-5):** Die DB-CHECKs von `weight_goals` müssen exakt zu `weightGoalSchema` passen (28–728 Tage ab `start_date`, `numeric(4,1)`, 30–300 kg). Sonst lässt das Mapping ein unpassendes Ziel weg und zeigt `weight_goal_invalid`, statt dass `nutritionInputsSchema.parse` die ganze Ernährungswoche scheitern lässt. Test im Mapping.
- **Z5 (K-6):** Ein bestehendes Ziel rechnet mit einem Gewicht, das älter als 90 Tage ist, weiter (sicher: nur kleineres Defizit; Tageshinweis `weight_outdated`). Entscheiden, ob dazu ein eigener Ziel-Hinweis („Gewicht aktualisieren, damit wir dein Ziel richtig planen“) gehört.
- **Z4/Z5 (Wächter Z2 Runde 2, K-8):** An sehr wenigen Ruhetagen (8 bzw. 21 von ~14.300 im Raster) zeigt die Ampel Grün, die Engine meldet aber `pace_capped` – nur bei Geburtstag in der Woche und Tempo fast genau an der Kapazität (Engine rechnet ab dem Geburtstag mit einem Jahr mehr, ~1 kcal/Tag strenger). Sicher (Defizit nur kleiner). Abhilfe bei Gelegenheit: Stand „heute“ zusätzlich mit dem Alter am Zieldatum rechnen und ins Minimum nehmen.

---

## 13. Umsetzung Z3 (17.10.2026): Abweichungen vom Plan

Z3 ist umgesetzt wie in Abschnitt 7 beschrieben. Migrationen (nur additiv):

- `20261017200000_goals_secondary.sql`: `goals.secondary_goal_type`, Paar-CHECK `goals_secondary_goal_pair_check`
  (`private.goal_pair_allowed` aus Z1), Disziplin-CHECK `goals_discipline_check`, CHECK `profiles.onboarding_step` mit
  `weight_goal` direkt nach `goal`.
- `20261017200100_weight_goals.sql`: Tabelle `weight_goals` (5.2), RLS wie `body_metrics`, Trigger
  `weight_goals_require_fat_loss` (S13) und `goals_drop_weight_goal` (Datensparsamkeit bei Update und Delete).
- `20261017200200_weight_goals_revoke_export.sql`: `consents_after_revoke` (Basis `*_competition_rpcs.sql`) und
  `export_my_data` (Basis `*_tracked_route_rpcs.sql`), jeweils Zeile für Zeile übernommen und nur ergänzt.

pgTAP `43_goals_secondary_weight_goals.test.sql` (56 Tests), SENSIBEL-Test und Abgleich der CHECKs in `db-sync.test.ts`,
Testmodus und Supabase-Schreibwege in `apps/mobile/src/data` (Test `goals-z3.test.ts`). Abweichungen und Präzisierungen:

1. **F8 gleich mit umgesetzt** (Gründer-Entscheidung vom 17.10.2026): `WEIGHT_GOAL_LIMITS.minTargetBmi` mit
   `default: 20`, `senior: 22`, `seniorFromAge: 70` und `minTargetBmiFor(Alter)`. Maßgeblich ist das **Alter am Zieldatum**
   (das höhere, strengere Alter im Zeitraum) – beim Speichern (Ampel, `weightGoalInvalidReasons`) und zur Laufzeit
   (`weightGoalPreStatus`/`weightGoalDayAdjustment` bekommen dafür `birthDate`). Der Hinweis `low_target_bmi`
   („18,5 bis unter 20“) und `lowTargetBmiNotice` entfallen, weil das Band jetzt gesperrt ist; damit auch
   `WEIGHT_GOAL_INPUT_NOTICES` und das Feld `notices` der Ampel. Tests: 19,99/20 unter 70, 21,99/22 ab 70, 69 vs. 70 am
   Zieldatum (Geburtstag im Zeitraum), 156 cm mit 48,6/48,7 kg.
2. **Drei Migrationen statt zwei.** Der alte Disziplin-CHECK war unbenannt (`goals_check`); die Migration sucht ihn über
   seine Bedingung statt über den Namen. Der neue CHECK vermeidet bewusst `'endurance' in (goal_type, secondary_goal_type)`:
   Bei Nebenziel `null` ergäbe das NULL, und ein CHECK mit NULL gilt als erfüllt (pgTAP-Fall „kein NULL-Schlupfloch“).
3. **Trigger „nur mit Abnehmziel“** läuft mit den Rechten des Aufrufers (fremde `goals` sind per RLS unsichtbar) und sperrt
   die eigene `goals`-Zeile `FOR SHARE`, damit ein gleichzeitiges Ändern des Ziels nicht dazwischenkommt. Der
   Lösch-Trigger auf `goals` ist `security definer` (gilt auch für Änderungen über `service_role`).
4. **Widerruf:** `weight_goals` wird am Anfang und in der Wiederholung am Ende gelöscht (Muster Wächter N7 S2).
5. **SENSIBEL-Test (S16) etwas strenger:** Neben „Kommentar beginnt mit ‚SENSIBEL (Art. 9‘ → ganz gelöscht und exportiert“
   muss jede Tabelle, deren Kommentar „SENSIBEL“ irgendwo enthält, in einer festen Ausnahmeliste mit ihrer Teil-Löschung
   stehen (`food_preferences`, `user_plans`, `meal_plans`, `shopping_lists`, `food_log_entries`).
6. **Schreibweg in der App als Onboarding-Schritt:** Das Wunschgewicht wird über `saveStep({ step: 'weight_goal', weightGoal })`
   gespeichert (`null` = „ohne festes Ziel“ → `delete_weight_goal`), keine neue Backend-Methode. Nach abgeschlossenem
   Onboarding bleibt der Fortschritt unverändert (wie `nutrition_setup`); die Einstellungen in Z5 nutzen denselben Weg.
   `[step].tsx` zeigt den Schritt bis Z4 nicht (wie `training_location`).
7. **Engine-Eingaben schon in Z3:** `planInputsFromRows` und `nutritionInputsFromRows` reichen Nebenziel und Disziplin
   (Ausdauer Haupt- oder Nebenziel) weiter, die Ernährung zusätzlich das Wunschgewicht – nur mit gültiger Einwilligung und
   nur, wenn die Zeile `weightGoalSchema` erfüllt (`weightGoalFromRow`, Vormerkung Z2 K-5 erledigt; sonst „ohne festes
   Ziel“ statt einer gescheiterten Woche). Sichtbar wird das erst, wenn Z4 die Auswahl bringt.
8. **`GoalStep` (unverändert sichtbar):** Ein gespeichertes Nebenziel bleibt beim erneuten Speichern erhalten, solange es
   zum gewählten Hauptziel passt; sonst entfällt es (und mit ihm über den Trigger das Wunschgewicht).
9. **Zeitfenster App-Deploy ↔ `db-migrate`:** Fehlt die Spalte `secondary_goal_type` noch (PGRST204), sendet die App den
   `goals`-Upsert ohne Nebenziel ein zweites Mal ohne die Spalte (mit Nebenziel bleibt es ein Fehler – vor Z4 nicht
   möglich). Fehlt `weight_goals`, gilt „kein Wunschgewicht“. Der Datenexport im Supabase-Modus braucht wie bei früheren
   Etappen die neue Fassung von `export_my_data` (bis `db-migrate` gelaufen ist, scheitert er mit fester Meldung).
10. **Testmodus:** `upsert_goals` ohne Abnehmen löscht das Wunschgewicht (wie der Trigger), der Widerruf ebenso; das
    Wunschgewicht liegt im Supabase-Modus nie im normalen Zwischenspeicher (`cacheableRows`). Alte Gerätestände: fehlendes
    Nebenziel → `null`, ungültiges Paar bzw. Disziplin ohne Ausdauer verworfen, Wunschgewicht nur gültig, eigenes Konto und
    mit Abnehmziel.
11. **Core-Fehler behoben:** `weightGoalSchema.safeParse` warf bei einem ungültigen Datum (die Zeitraum-Prüfung rechnete
    trotzdem); jetzt ein normaler Fehler (Test).
12. **`database.types.ts`** von Hand ergänzt (wie bisher, Abgleich in `database.types.test.ts`); nach dem Merge kann die
    Action zur Typ-Erzeugung sie bestätigen.

**Offen / Vormerkungen:**

- Wächter-Prüfung Z3 steht aus.
- `save_competition`/`cancel_competition`/`delete_competition` (Phase 10 WP3) gleichen `goals.target_date` nur beim
  **Hauptziel** Ausdauer ab. Mit Ausdauer als Nebenziel (ab Z4) in Phase 10 bzw. Z4 entscheiden, ob das auch dann gilt.
- `start_date` prüft die Datenbank nicht gegen „heute“ (der Plan verlangt es nicht; Zod setzt es). Bei Bedarf in Z4/Z5
  ergänzen.
