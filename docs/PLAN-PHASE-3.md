# Plan Phase 3 – Plan-Engine (persönlicher Trainingsplan aus Vorlagen)

**Status:** Vom Wächter freigegeben (Runde 2 mit Auflagen, alle eingearbeitet), 04.10.2026. Offen vor Etappe C: Gründer-Entscheidung Frage 14 (siehe Abschnitt 15).
Überarbeitet nach den Wächter-Prüfungen Runde 1 und Runde 2 (jeweils „freigegeben mit Auflagen“) am selben Tag –
alle Befunde sind eingearbeitet (Abschnitte 16 und 17).
Grundlage: `CLAUDE.md`, `docs/KONZEPT.md` (Abschnitte 4, 4.1, 12, 13, 15, 16), `docs/PROMPTS.md` (Phase 3),
`docs/PLAN-PHASE-1.md`, `docs/PLAN-PHASE-2.md`.

---

## 1. Ziel in einfachen Worten

Nach dem Onboarding bekommt jede Person **sofort einen eigenen Trainingsplan**. Die App sucht dafür aus den
geprüften Plan-Vorlagen die passendste heraus, tauscht Übungen aus, für die Geräte fehlen, verteilt die Einheiten
auf die Wunsch-Wochentage und plant Erholungswochen fest ein. Auf der Seite **„Heute“** steht dann die heutige
Einheit (oder „Ruhetag“) und eine Wochenübersicht.

Alles läuft über **feste Regeln** in `packages/core` – ohne KI, ohne laufende Kosten, gleiches Ergebnis bei
gleichen Angaben. Wer gesundheitliche Auffälligkeiten angegeben hat, bekommt automatisch einen **vorsichtigen
Plan**. Weil ein solcher Plan Rückschlüsse auf die Gesundheit zulässt, behandeln wir ihn **wie Gesundheitsdaten**
(Abschnitt 9).

## 2. Was ihr am Ende der Phase habt

1. Die **Plan-Engine** in `packages/core/src/plan/`: Vorlagen-Matching mit Punkten, Übungs-Tausch über
   Alternativen, Kürzen auf das Zeitbudget, Wochenplanung für 1 bis 7 Tage, Einstiegswoche, Erholungswoche
   (Deload), doppelte Progression, Verschieben verpasster Einheiten – als reine Funktionen mit vielen
   Grenzfall-Tests.
2. **Beispielpläne im Pull Request:** Die CI schreibt für feste Test-Personen (z. B. „Einsteigerin, zu Hause,
   ohne Geräte, 2 Tage“) den erzeugten Plan lesbar in die Zusammenfassung – so seht ihr die Engine schon vor der
   App am Handy.
3. Die Tabellen **`user_plans`**, **`planned_sessions`**, **`planned_exercises`** mit RLS, geschützten
   Datenbank-Funktionen zum Speichern und automatischen Tests.
4. In der App: Plan wird **nach dem Onboarding erzeugt** (im Testmodus und mit Supabase), „Heute“ zeigt die
   heutige Einheit und die Woche, Knopf **„Einheit verschieben“**, Hinweis **„Plan neu erstellen“**, wenn sich
   eure Angaben geändert haben.

## 3. Abgrenzung – was ausdrücklich NICHT in Phase 3 kommt

| Thema                                                                                       | Wann                                   |
| ------------------------------------------------------------------------------------------- | -------------------------------------- |
| Übungen abhaken, Sätze/Gewichte eintragen, Pausentimer, Belastungsempfinden (Tagebuch)      | Phase 4                                |
| Progression **aus echten Einträgen** (die Funktion entsteht jetzt, gefüttert wird sie in 4) | Phase 4                                |
| Feld „eigenes Startgewicht“ (Selbsteinschätzung, optional)                                  | Phase 4 (vorgemerkt, Abschnitt 5.8)    |
| Automatisches Erkennen „Einheit verpasst“ (braucht Einträge)                                | Phase 4                                |
| **Live-Anpassung** (KONZEPT 4.1: Last senken, Variation, weniger Tage, Readiness, Kalorien) | Phase 4b (Premium, ohne KI)            |
| Tabelle `plan_adjustments`, Ansicht „Warum hat sich mein Plan geändert?“                    | Phase 4b                               |
| Ausdauer-Blöcke, Zonen, Tapering, Wettkampf-Periodisierung                                  | Phase 10                               |
| KI-Fallback, wenn keine Vorlage passt                                                       | Phase 7 (Premium, Feature-Flag, Limit) |
| „Mein Studio“ mit eigener Geräteliste                                                       | Phase 9b (bis dahin: Standard-Studio)  |
| Zyklus-Berücksichtigung                                                                     | Phase 9                                |

**Keine Echtzeit-KI:** Der Gratis-Pfad ist komplett regelbasiert (`CLAUDE.md`, KONZEPT Abschnitt 15). Phase 3
ruft keine KI-Schnittstelle auf und braucht keinen Schlüssel.

---

## 4. Worauf wir aufbauen (Ist-Stand, geprüft am 04.10.2026)

1. **Angaben aus dem Onboarding** (Phase 1): `goals` (Ziel, Disziplin, Tage/Woche 1–7, Minuten 10–240,
   `preferred_days` ISO 1 = Montag … 7 = Sonntag, Ort `gym|home|both`), `profiles.experience_level`
   (`beginner|advanced|competitive`), `profiles.birth_date`, `user_equipment` (Ort, Geräte, `weights_kg`),
   `health_screening.flags` mit `medical_clearance_recommended`, `pregnancy`, `injury`, `medication`,
   `conservative_plan` (berechnet in `evaluateHealthScreening()` bzw. per Datenbank-Trigger).
2. **Geräte-Katalog** `packages/core/src/equipment.ts`: 10 Heim-Geräte + 8 Studio-Geräte (`homeSelectable: false`,
   z. B. `power_rack`, `cable_station`, `leg_press`). Annahme bis Phase 9b: Studio = alle Katalog-Geräte.
3. **Inhalte** (Phase 2): 52 Übungen und 24 Vorlagen unter `content/`, **alle `draft`**, ohne rote Fehler.
   Schemas und Prüfungen in `packages/core/src/content/` (`exerciseSchema`, `planTemplateSchema`,
   `validateContent()`, `isDryRunContent()`, `estimateSessionMinutes()`, `weeklySetsByMuscle()`). Die
   Datenbank enthält nur `published`/`archived` (CHECK „nie draft“); RLS zeigt nur `published`.
4. **Wichtige Lücken in den Vorlagen**, die die Engine abfangen muss:
   - Es gibt **nur 3- und 4-Tage-Vorlagen** (3 = Ganzkörper, 4 = Oberkörper/Unterkörper) und nur **45–60 Minuten**.
     Für 1, 2, 5, 6, 7 Tage und für kürzere/längere Einheiten gibt es keine exakte Vorlage.
   - Ziele nur `muscle_gain`, `fat_loss`, `general_fitness`; Level nur `beginner`, `advanced`
     (Phase-2-Entscheidung: Definition → Muskelaufbau, Leistungssport → Fortgeschritten, Ausdauer erst Phase 10).
   - **Zu Hause ganz ohne Geräte** sind nur ca. 11 von 24 Übungen einer Zuhause-Vorlage machbar (Probe mit dem
     Startbestand): Es gibt **keine** Zug-Übung (Rudern, Latziehen) und kein Hüftbeugen ohne Band. Mit nur einem
     Widerstandsband sind es 22 von 24.
   - **Über-Kopf-Drücken** (`overhead`) steht in allen 24 Vorlagen (Kurzhantel-Schulterdrücken); die Alternativen
     sind ebenfalls `overhead`. Bei vorsichtigem Plan muss die Engine hier auf Übungen mit gemeinsamem Hauptmuskel
     ausweichen oder die Übung weglassen (5.5).
5. **App** (`apps/mobile`): Schnittstelle `Backend` (`src/data/backend.ts`) mit Testmodus (`local-backend.ts`,
   Regeln wie die Datenbank in `local-rules.ts`) und Supabase (`supabase-backend.ts`), Schreib-Vorgänge
   `WriteOp` (`write-ops.ts`), Offline-Warteschlange nur für Nicht-Gesundheitsdaten (`sync-queue.ts`),
   `withoutHealthData()` für den Widerruf im Testmodus (wird in Etappe C aufgeteilt, Abschnitt 9). „Heute“ (`src/app/today.tsx`) und „Fertig“
   (`src/app/done.tsx`) zeigen bisher Platzhalter („Dein Plan wird vorbereitet – kommt in Phase 3“,
   `src/i18n/de.ts`). Der Einwilligungstext `health_data` (`src/data/consent-texts.ts`) nennt bereits „die daraus
   abgeleiteten Hinweise (z. B. ‚vorsichtiger Plan‘)“ als Gesundheitsdaten.
   Achtung Namensähnlichkeit: `src/data/plan-save.ts` plant das Speichern eines **Onboarding-Schritts** und hat
   mit Trainingsplänen nichts zu tun – neue Dateien heißen deshalb `training-plan*.ts`.
6. **Datenbank-Muster**: RLS „nur eigene Zeilen“ + „Profil zuerst“ (`exists (select 1 from public.profiles …)`),
   atomare Funktionen (`20261003120900_replace_rpcs.sql`), geschützte Funktion mit `security definer`,
   `search_path = ''`, Prüfung von `auth.uid()` und `revoke … from public, anon` (`delete_my_account()`), Löschen
   per Kaskade, Widerruf `health_data` löscht Gesundheitsdaten (`private.consents_after_revoke()`), pgTAP-Tests in
   `supabase/tests/` (laufen im Workflow `db-test`), handgepflegte Typen `packages/db/src/database.types.ts`,
   Abgleich Code ↔ Migration in `packages/core/src/db-sync.test.ts`.

---

## 5. So arbeitet die Plan-Engine (Bild in Worten)

```
 Angaben  →  Inhalte  →  Vorlage   →  Vorsicht   →  Geräte-   →  Zeit-    →  Wochen-   →  Plan-Block
 prüfen      wählen      wählen       anwenden       Tausch       budget      planung       mit Deload
 (Zod)       (Status)    (Punkte)     (Flags/Alter)  (Altern.)    (kürzen)    (Tage)        (Wochen)
```

Hauptfunktion: `generateTrainingPlan(inputs, library, today)` → entweder ein fertiger Plan-Block mit Hinweisen
oder ein Fehler mit festem Code (`no_template`, `invalid_inputs`). Rein, deterministisch, ohne Datum aus der Uhr
(das Datum wird übergeben).

### 5.1 Eingaben (`planInputsSchema`, Zod)

Ziel, Disziplin, Level, Tage/Woche, Minuten, Wunsch-Tage, Ort, Heim-Geräte mit Gewichtsstufen, Geburtsdatum
(Alter wird zum jeweiligen Stichtag berechnet), Gesundheits-Flags **oder** „kein Check vorhanden“, Geschlecht (nur
für Vorlagen mit `sex`). **Körpergewicht, Größe, Körperfett und Umfänge gehen bewusst NICHT ein.** Fehlen
Pflichtangaben (z. B. Onboarding unvollständig), liefert die Engine `invalid_inputs`.

Das Ergebnis trägt zwei Markierungen (Abschnitt 9):

- **`usesHealthData`** = `true`, sobald ein Gesundheits-Check in die Regeln eingeht – **auch ohne Flag**, denn auch
  „keine Auffälligkeit“ ist eine Gesundheitsangabe. Ohne Check (keine Einwilligung) = `false`.
- **`medicalNotice`** = `requiresMedicalNotice(flags)` aus `health-screening.ts`, also `true` bei **jedem**
  Gesundheits-Flag (für den Arzt-Hinweis vor jeder Einheit, 10.2); nur zusammen mit `usesHealthData`. Der Text ist
  allgemein und nennt keine Diagnose und kein Flag.
- **`safetyRules`** = die wirksamen Sicherheitsregeln (RPE-Deckel, ausgeschlossene Merkmale, `medicalNotice`) als
  kleines Objekt. Es wird nicht in der Datenbank gespeichert, sondern bei jedem Laden aus Gesundheits-Check und Alter
  neu berechnet und nur im Zwischenspeicher nach Frage 14 abgelegt (gelöscht bei Widerruf, Abmelden, Konto
  löschen), damit die Anzeige auch offline die richtigen Deckel anwendet.

Diese Markierungen sind Vorschläge der Engine – **verbindlich bestimmt sie die Datenbank selbst** (8.1).

### 5.2 Welche Inhalte die Engine nutzt

`selectPlanContent(validationResult, { allowDrafts })` aus dem Ergebnis von `validateContent()`:

- **Live (Supabase):** nur `published` (die Datenbank liefert ohnehin nichts anderes).
- **Testmodus:** zusätzlich `draft` – aber **nur** Inhalte **ohne roten Befund**, **nie** Probelauf-Inhalte
  (`isDryRunContent`), nie `archived`. Die App zeigt dann dauerhaft „Testinhalte – KI-Entwurf, nicht fachlich
  geprüft“.
- **`allowDrafts: true` gibt es nur an einer Stelle:** in `createLocalBackend()`. Der Supabase-Weg ruft die Engine
  immer mit `allowDrafts: false` auf; ein Test stellt sicher, dass bei konfiguriertem Supabase nie `true`
  übergeben wird.
- Eine Vorlage zählt nur, wenn alle ihre Übungen ebenfalls in der Auswahl sind.

### 5.3 Vorlagen-Matching mit Punkten

**Harte Ausschlüsse** (nie verletzt): Vorlage mit `sex` ≠ Geschlecht der Person; **Einsteiger bekommen nie eine
Fortgeschrittenen-Vorlage**; bei vorsichtigem Plan (5.4) nur Einsteiger-Vorlagen.

**Punkte (100 maximal, Gewichte in `constants.ts`):**

| Kriterium | Punkte | Regel                                                                                                               |
| --------- | -----: | ------------------------------------------------------------------------------------------------------------------- |
| Ziel      |     35 | gleiches Ziel 35 · Definition → Muskelaufbau 35 (beschlossen) · Ausdauer → Allgemeine Fitness 15 · anderes Ziel 0   |
| Level     |     25 | gleich 25 · Leistungssport → Fortgeschritten 25 (beschlossen) · Fortgeschrittene mit Einsteiger-Vorlage 12          |
| Tage      |     15 | Wunsch 3/4: gleiche Zahl 15, andere 5 · Wunsch 1–2: 3-Tage-Ganzkörper 12, sonst 0 · Wunsch 5–7: 4-Tage 12, 3-Tage 5 |
| Ort       |     10 | gleich 10 · „beides“ → Studio 10, Zuhause 6 · anderer Ort 0                                                         |
| Geräte    |     10 | Anteil der Übungen, die direkt oder per Ersatz (5.5) machbar sind × 10                                              |
| Dauer     |      5 | Minuten im Bereich der Vorlage 5 · darunter anteilig (Budget ÷ `minutes_min` × 5) · darüber 5                       |

Bei Gleichstand entscheidet die Vorlagen-ID (alphabetisch) – das Ergebnis ist immer gleich.

**Ergebnis-Güte** (`match_quality`), angezeigt als Hinweis:

1. **`exact` – „Passt genau“:** Ziel und Level gleich oder beschlossene Zuordnung, Tage gleich, Ort gleich, alle
   Übungen ohne Lücke, Dauer im Bereich.
2. **`close` – „Passt mit Anpassungen“:** wie oben, aber Tage rotiert/gekappt, Einheit gekürzt oder Übungen
   ersetzt/entfernt.
3. **`fallback` – „Nächstbeste Vorlage“:** Ziel oder Ort weicht ab (z. B. Ausdauer, Zuhause-Person mit
   Studio-Vorlage). Hinweis: „Für deine Angaben gibt es noch keinen genau passenden Plan. Wir haben den
   nächstbesten gewählt: …“ (Frage 1).

**Keine Vorlage** (`no_template`) gibt es nur, wenn nach den harten Ausschlüssen nichts übrig ist – praktisch
nur, wenn keine Inhalte freigegeben sind. Dann zeigt die App einen klaren Fehlerzustand (Abschnitt 10.3), keine
KI (die kommt als Premium-Fallback erst in Phase 7).

### 5.4 Vorsichtsregeln (`planSafetyRules()`: Flags, Alter, ohne Check)

| Lage                                                     | Wirkung                                                                                                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flag `conservative_plan` (jedes Gesundheits-Flag)        | nur Einsteiger-Vorlagen · RPE höchstens 7 (= mind. 3 Wdh. Reserve) · keine Übungen mit `high_impact`, `spinal_loading`, `high_skill` (Tausch über Alternativen) |
| zusätzlich `injury` oder `medical_clearance_recommended` | zusätzlich keine `overhead`-Übungen (Über-Kopf-Drücken belastet Schulter und Blutdruck)                                                                         |
| zusätzlich Flag `pregnancy`                              | zusätzlich keine Übungen mit `long_supine` (lange Rückenlage) · deutlicher Hinweis: Plan ist nicht für die Schwangerschaft entwickelt, ärztlich abklären        |
| **kein Gesundheits-Check vorhanden** (ohne Einwilligung) | dieselben Regeln wie `conservative_plan` **einschließlich** `overhead` (sicherer Standard), Hinweis „Ohne Gesundheits-Check planen wir vorsichtig“              |
| unter 18 Jahren (16–17)                                  | RPE höchstens 8 · keine `high_skill`-Übungen (Technik-Übungen brauchen Anleitung, die die App nicht bietet) · nie Maximaltests                                  |
| ab 65 Jahren                                             | RPE höchstens 7 · keine `high_impact`- und `high_skill`-Übungen                                                                                                 |
| Einsteiger (immer)                                       | RPE höchstens 8 (`TEMPLATE_DOSAGE_LIMITS.beginnerRpeMax`)                                                                                                       |

Treffen mehrere Lagen zu, gilt jeweils die **strengste** Regel.

**Nie Maximaltests:** Kein RPE 10, keine 1RM-Tests, kein „bis zum Versagen“ – in keinem Fall (schon Regel V4).
Die Untergrenze RPE 5 bleibt, damit der Plan den Datenbank-Grenzen entspricht. Ein Arzt-Hinweis ersetzt keine
ärztliche Freigabe; der Text sagt das ausdrücklich.

**Strengere Regeln wirken sofort, Lockerungen nur nach Bestätigung:**

1. Kommt ein **neues Flag** hinzu (neuer Gesundheits-Check) oder wird eine **Altersgrenze** überschritten
   (65. Geburtstag), wendet `applyCurrentSafetyRules(session, rules, library)` die aktuellen Regeln **beim
   Anzeigen** jeder Einheit und beim Erzeugen jedes **Folgeblocks** an: RPE-Deckel sinkt, ausgeschlossene Übungen
   werden ersetzt (5.5) oder – wenn offline kein Ersatz möglich ist – ausgeblendet mit Hinweis „Übung ausgelassen,
   bitte Plan neu erstellen“. Zusätzlich fragt „Heute“: „Plan neu erstellen?“. Grundlage sind die wirksamen
   `safetyRules` (5.1), die nach jedem Laden aktualisiert und im Zwischenspeicher abgelegt werden – so greifen
   strengere Deckel auch offline.
2. **Sofort nach dem Speichern eines strengeren Gesundheits-Checks** (online) bietet die App direkt „Plan neu
   erstellen“ an, nicht erst beim nächsten Öffnen von „Heute“.
3. **Lockerungen** (Flag entfällt, 18. Geburtstag, Einwilligung neu erteilt) ändern einen laufenden Plan **nie
   automatisch**; die App bietet nur „Plan neu erstellen“ an.

### 5.5 Equipment-Anpassung über Alternativen

**Geräte-Profil** (`equipmentProfile()`): Studio = alle Katalog-Geräte außer „Sonstiges“; Zuhause = eigene
Heim-Geräte aus `user_equipment`; „beides“ = Studio (Frage 7). Körpergewichtsübungen gehen immer.

Für jede Übung der Vorlage (`findSubstitute()`), in dieser Reihenfolge:

1. Übung selbst machbar und erlaubt (5.4) → bleibt.
2. Ihre **Alternativen** nach `priority` (gleiches Bewegungsmuster, garantiert durch Regel Ü4). Bei vorsichtigem
   Plan zuerst Alternativen mit Grund `easier`.
3. Alternativen der Alternativen (eine Stufe tiefer).
4. Andere Übung der Bibliothek mit **gleichem Bewegungsmuster** und gemeinsamem Hauptmuskel.
5. Andere Übung mit **gemeinsamem Hauptmuskel** (KONZEPT 4.2: „gleiches Bewegungsmuster/Muskelgruppe“).
6. Nichts gefunden → Übung **entfällt**.

**Jeder Ersatz aus den Schritten 2–5 muss** `planSafetyRules()` bestehen (keine ausgeschlossenen Merkmale) **und
darf nicht schwerer sein** als die Ausgangsübung (`difficulty` gleich oder kleiner). Bei mehreren Treffern:
ähnlichste (nicht höhere) Schwierigkeit, dann gleicher Belastungstyp, dann ID. Schon in der Einheit vorhandene
Übungen werden nicht doppelt eingesetzt. Sätze, Wiederholungen und RPE der Vorlage bleiben erhalten; **wechselt
das Bewegungsmuster oder die Mechanik** (Grund-/Isolationsübung), wird die Pause in den Bereich `REST_RANGES_S`
der neuen Übung gelegt. Halteübungen behalten ihre Dauer (Wiederholungs-Übung ↔ Halteübung wird nicht getauscht).

**Hinweis-Codes nur aus Gerätegründen:** `exercises_substituted` und `exercises_removed` werden nur gesetzt, wenn
ein **fehlendes Gerät** der Grund war. Tausch aus Vorsichtsgründen erzeugt keinen gespeicherten Code (Abschnitt 9).
Fehlt danach jede Zug-Übung, kommt zusätzlich der Hinweis `no_pull_exercise` („Für Rücken-Übungen reicht schon
ein Widerstandsband“, herstellerneutral, ohne Link).

### 5.6 Zeitbudget (Minuten pro Einheit)

`fitSessionToMinutes()` mit der vorhandenen Schätzung `estimateSessionMinutes()`:

- **Budget unter der Vorlage:** schrittweise kürzen, bis die Schätzung passt: (1) Isolationsübungen vom Ende
  entfernen, (2) Sätze auf 2 (Grundübungen) bzw. 1 (Isolation) senken, (3) Grundübungen vom Ende entfernen bis
  mindestens 3 Übungen. Passt es dann noch nicht (z. B. 10 Minuten), bleibt die kürzeste Fassung mit Hinweis
  `minutes_below_minimum`. Sinkt der Wochenumfang unter die Untergrenze (V10), Hinweis `volume_reduced`.
- **Budget über der Vorlage:** nichts hinzufügen (Obergrenzen V9 bleiben eingehalten).

### 5.7 Tage pro Woche und Wochenplanung (1 bis 7 Tage)

| Wunsch   | Plan                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Tag    | 3-Tage-Ganzkörper-Vorlage, **Rotation**: Woche 1 = A, Woche 2 = B, Woche 3 = C … · Hinweis „geringer Umfang“                                   |
| 2 Tage   | 3-Tage-Ganzkörper-Vorlage, Rotation: A+B, C+A, B+C … · Hinweis „geringer Umfang“                                                               |
| 3 / 4    | Vorlage mit gleicher Tageszahl                                                                                                                 |
| 5–7 Tage | 4-Tage-Vorlage, **höchstens 4 Krafteinheiten**; übrige Tage sind Ruhetage mit Hinweis „lockere Bewegung (Spazieren, Rad) ist an Ruhetagen gut“ |

**Welche Wochentage** (`chooseTrainingDays()`):

1. Gleich viele Wunsch-Tage wie Einheiten → genau diese.
2. Mehr Wunsch-Tage → die Auswahl mit den **größten Abständen** (Woche als Kreis, Sonntag → Montag zählt als
   „hintereinander“).
3. Weniger oder keine Wunsch-Tage → Wunsch-Tage bleiben, fehlende Tage mit größtmöglichem Abstand ergänzen
   (Hinweis `days_added`). Ohne Wunsch-Tage Standardmuster: 1 = Mi · 2 = Mo, Do · 3 = Mo, Mi, Fr · 4 = Mo, Di, Do, Fr.

**Reihenfolge der Einheiten** (`assignSessionsToDays()`): Ganzkörper möglichst nicht an zwei Tagen hintereinander
(mind. 48 Stunden für dieselben Muskeln); bei Ober-/Unterkörper nie zweimal derselbe Schwerpunkt hintereinander.
Erzwingen die Wunsch-Tage das (z. B. Sa + So, 2 Tage Ganzkörper), bleibt es dabei mit Hinweis
`back_to_back_sessions` – eure Wunsch-Tage haben Vorrang.

**Plan-Block und angebrochene Startwoche** (`buildPlanBlock()`): Ein Block besteht aus Belastungswochen und einer
Erholungswoche (5.10). Einheiten vor „heute“ entfallen.

- Passt in den Rest der aktuellen Woche **mindestens die Hälfte** der Wochen-Einheiten, ist sie **Woche 1** des
  Blocks (Einstiegswoche, 5.8).
- Passt **weniger als die Hälfte**, laufen diese Einheiten als **„Woche 0“** (Schnupperwoche mit den Dosierungen
  der Einstiegswoche, zählt **nicht** zum Belastungsblock). Woche 1 beginnt dann am nächsten Montag.
- **Festlegung:** Gibt es eine Woche 0, **ist sie die Einstiegswoche**; Woche 1 danach ist eine normale
  Belastungswoche (keine zweite Einstiegswoche). Ohne Woche 0 ist Woche 1 die Einstiegswoche. `week_no` läuft damit
  von 0 bis höchstens 6 (Woche 0 + längster Block 5 + 1).
- Ist in der Restwoche gar nichts mehr frei, zeigt „Heute“: „Dein erstes Training: Montag, …“.

### 5.8 Startgewichte und Startlasten

**Empfehlung: kein ausgerechnetes Startgewicht, sondern „Startgewicht finden“ (RIR-basiert, Frage 2).**

1. Gewichte, die man mit Körpergewicht oder Geschlecht „schätzen“ würde, sind ungenau und würden zusätzliche
   Körperdaten in den Plan bringen. Maximaltests sind ausgeschlossen.
2. In der **Einstiegswoche** (und in Woche 0) liegt das RPE-Ziel **1 Punkt unter** der Vorlage (nicht unter 5). Die
   App sagt in einfachen Worten: „Wähle ein Gewicht, mit dem du alle Wiederholungen sauber schaffst und noch etwa 3
   übrig hättest. Lieber zu leicht als zu schwer.“ (RPE wird immer als „Wiederholungen in Reserve“ = 10 − RPE
   erklärt.)
3. `planned_exercises.target_weight_kg` bleibt in Phase 3 leer. Ab Phase 4 berechnet die Engine aus dem ersten
   Eintrag (Gewicht, Wiederholungen, RPE) das Arbeitsgewicht: `estimateWorkingWeight()` mit Epley-Formel plus
   Wiederholungen in Reserve, **nur bis 12 Wiederholungen + Reserve** (darüber wird nicht hochgerechnet), auf
   vorhandene Gewichtsstufen abgerundet (`snapToAvailableWeight()`) und nie mehr als 10 % über dem eingetragenen
   Gewicht.
4. **Für Phase 4 vorgemerkt:** optionales Feld **„eigenes Startgewicht“** je Übung (Selbsteinschätzung, z. B. „ich
   drücke sonst 20 kg“). Es dient nur als Startwert für die Einstiegswoche, wird auf vorhandene Stufen abgerundet und
   unterliegt denselben RPE-Deckeln. Eingetragen in KONZEPT Abschnitt 12 „Abweichungen ab Phase 3“ (Etappe B).
5. Bei vorsichtigem Plan gilt RPE höchstens 7 auch in allen Folgewochen.
6. Körpergewicht-, Band- und Halteübungen brauchen kein Gewicht: Start mit der leichteren Variante bzw. dem
   leichteren Band, Halteübungen mit der Dauer der Vorlage.

### 5.9 Doppelte Progression (Gratis-Regel aus KONZEPT 4.1)

`nextLoad(prescription, history, increments)` – rein, ab Phase 4 mit echten Einträgen gefüttert.

**Auslöser:** In **zwei aufeinanderfolgenden Einheiten** dieser Übung erreichen **alle** Sätze das Ziel
(`reps_max` bzw. die erhöhte Zielzahl unten) bei RPE ≤ Ziel (oder ohne Angabe). Sonst bleibt alles gleich, Ziel
+1 Wiederholung bis `reps_max`.

**Gewichtssprung über 10 % nie direkt, erst nach dem Puffer.** Ist der Sprung danach größer als 25 %, liegt das
RPE-Ziel der ersten Einheit mit dem neuen Gewicht 1 Punkt niedriger. Gibt es keine höhere eigene Gewichtsstufe,
kommt nach dem Puffer der Hinweis „schwerere Gewichtsstufe eintragen oder schwerere Variante wählen“.

| Belastungstyp     | Regel                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gewicht           | Nächster Schritt ≤ 10 % → Gewicht steigt, Wiederholungen zurück auf `reps_min`. Nächster Schritt > 10 % (z. B. Kurzhantel 4 → 6 kg) → **zuerst** Zielwiederholungen schrittweise bis `reps_max + 2` (höchstens 30), **dann** +1 Satz (höchstens 6 und innerhalb der Wochensatz-Obergrenze V9); erst wenn auch das zweimal hintereinander geschafft ist, folgt der Gewichtsschritt (Wdh. auf `reps_min`, Sätze wie in der Vorlage) |
| Körpergewicht     | erst Wiederholungen bis `reps_max`; dann Vorschlag „schwerere Variante“ (Alternative mit Grund `harder`, muss `planSafetyRules()` bestehen)                                                                                                                                                                                                                                                                                       |
| Band              | erst Wiederholungen; dann Vorschlag „stärkeres Band oder mehr Abstand“                                                                                                                                                                                                                                                                                                                                                            |
| Zeit (Halteübung) | Steigerung je Auslöser = `min(5 s, max(1 s, floor(10 % der aktuellen Dauer)))` – z. B. 20 s → +2 s, 30 s → +3 s, ab 50 s → +5 s; bis 120 s; dann Vorschlag „schwerere Variante“                                                                                                                                                                                                                                                   |

Steigerung: Langhantel und Maschine/Kabel +2,5 kg; Kurzhantel/Kettlebell nächste eigene Gewichtsstufe (ohne
Angabe +2 kg). **Nicht** in Phase 3/Gratis: Last senken, Variation nach Stillstand, Umfang anpassen – das ist
Live-Anpassung (Phase 4b, Premium). In Erholungswochen gibt es keine Steigerung.

### 5.10 Deload – fest eingeplant

- **Länge eines Blocks:** Einsteiger 5 Belastungswochen + 1 Erholungswoche (6 Wochen), Fortgeschrittene und
  vorsichtige Pläne 4 + 1 (5 Wochen). Beides liegt im Rahmen `DELOAD_INTERVAL_WEEKS` (4–6). Woche 0 zählt nicht mit.
- **Erholungswoche:** gleiche Übungen, Sätze halbiert (aufgerundet, mindestens 1), RPE −2 (nicht unter 5),
  Gewicht ×0,9, sobald es Zielgewichte gibt. Gekennzeichnet als „Erholungswoche“ mit kurzer Erklärung.
- **Folgeblock** (`nextPlanBlock()`): Beginnt die letzte Woche eines Blocks, erzeugt die App den nächsten Block –
  **aus dem Schnappschuss des Plans** (nicht aus der Vorlage; es ist also egal, ob die Vorlage noch `published` ist)
  **plus den aktuellen Sicherheitsregeln** (5.4: Flags und Alter zum Startdatum des neuen Blocks). Deterministisch
  und nur einmal: Die Datenbank nimmt nur `block_no = bisheriges Maximum + 1` an.
- **Deload bei sinkender Leistung** (KONZEPT 4.5, zweiter Teil) braucht Einträge und ist Live-Anpassung → Phase 4b.

### 5.11 Verpasste Einheiten neu planen

`rescheduleSession(week, sessionId, today)` – „verschieben oder streichen, nie stapeln“:

1. Ziel ist der nächste **freie** Tag **ab heute** in **derselben Kalenderwoche** (ISO-Woche), der die
   Erholungsregeln aus 5.7 einhält.
2. Gibt es keinen, wird die Einheit **gestrichen** (`skipped`) – sie wandert nie in die nächste Woche, damit sich
   nichts aufstaut.
3. Nie zwei Einheiten an einem Tag – auch nicht über Plan-Grenzen hinweg (eindeutige Regel je Person und Datum in
   der Datenbank).
4. In der Erholungswoche wird nicht verschoben, sondern gestrichen.

Dieselben Regeln (gleiche ISO-Woche, nicht vor heute, nur `planned` → `skipped`) prüft die Datenbank zusätzlich
(Abschnitt 8). In Phase 3 löst das der Knopf **„Einheit verschieben“** auf „Heute“ aus. Automatisch („gestern nicht
eingetragen“) erst mit dem Tagebuch in Phase 4.

### 5.12 Ausdauer-Grenze 10 % pro Woche

Die Vorlagen enthalten derzeit **keine** Ausdauer-Einheiten; Ausdauer-Blöcke kommen in Phase 10. Phase 3 baut
trotzdem die gemeinsame Schutzfunktion `capWeeklyIncrease(previous, planned)` mit
`MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION` (vorhanden, 10 %) und wendet sie auf den Wochenumfang von Übungen
mit Muster `conditioning` an, falls eine Vorlage welche enthält. Ziel „Ausdauer“ bekommt bis Phase 10 einen
Kraft-/Fitnessplan mit Hinweis „Ausdauer-Pläne kommen später“.

### 5.13 Ergebnis und Hinweise

Die Engine liefert den Plan-Block, `usesHealthData`, `medicalNotice` und **Hinweis-Codes** (`plan_note`), die App
macht daraus deutsche Texte: `goal_endurance_not_yet`, `days_rotated`, `days_capped`, `days_added`,
`back_to_back_sessions`, `minutes_shortened`, `minutes_below_minimum`, `volume_reduced`, `exercises_substituted`
und `exercises_removed` (nur aus Gerätegründen), `no_pull_exercise`, `location_mismatch`. **Gesundheitsbezogene
Hinweise** (vorsichtiger Plan, Schwangerschaft, ohne Check) werden nicht als Code gespeichert; die App leitet sie
aus dem Gesundheits-Check bzw. aus `medical_notice` ab (Abschnitt 9).

---

## 6. Neue Grenzwerte in `constants.ts` (jeweils mit Quellenkommentar)

Die Quellenangaben werden beim Umsetzen gegen das Original geprüft und genau zitiert. Was keine Studie belegt, ist
ausdrücklich als **Produktentscheidung** gekennzeichnet.

| Konstante                         | Startwert                                                                                                                                                                                                                                                                                    | Quelle / Begründung                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAN_MATCH_WEIGHTS`              | Ziel 35, Level 25, Tage 15, Ort 10, Geräte 10, Dauer 5                                                                                                                                                                                                                                       | Produktentscheidung (Abschnitt 5.3)                                                                                                                                                                                                                                                                                                     |
| `MAX_STRENGTH_SESSIONS_PER_WEEK`  | 4                                                                                                                                                                                                                                                                                            | **Produktentscheidung** (es gibt nur 3-/4-Tage-Vorlagen); als Orientierung ACSM Position Stand (2009), Med Sci Sports Exerc 41(3):687–708 (Trainingshäufigkeit je Level)                                                                                                                                                                |
| `MIN_RECOVERY_HOURS_SAME_MUSCLES` | 48 (Spanne 48–72)                                                                                                                                                                                                                                                                            | Garber CE et al. (2011), ACSM Position Stand „Quantity and Quality of Exercise …“, Med Sci Sports Exerc 43(7):1334–1359 (mind. 48 h zwischen Krafteinheiten derselben Muskelgruppe); gegen ACSM 2009 abgleichen                                                                                                                         |
| `DEFAULT_TRAINING_DAYS`           | 1: Mi · 2: Mo, Do · 3: Mo, Mi, Fr · 4: Mo, Di, Do, Fr                                                                                                                                                                                                                                        | Produktentscheidung (größte Abstände)                                                                                                                                                                                                                                                                                                   |
| `CONSERVATIVE_PLAN_RULES`         | RPE ≤ 7; ausgeschlossen `high_impact`, `spinal_loading`, `high_skill`; bei `injury`/`medical_clearance_recommended` und ohne Check auch `overhead`; Einsteiger-Vorlage                                                                                                                       | PAR-Q+ (Warburton DER et al., 2011) begründet nur die **Flags**; RPE-Deckel und Ausschluss-Merkmale sind **Produktentscheidung** (PLAN-PHASE-2 Abschnitt 8), fachlich zu prüfen                                                                                                                                                         |
| `PREGNANCY_EXCLUDED_CAUTION_TAGS` | `long_supine` (zusätzlich)                                                                                                                                                                                                                                                                   | ACOG Committee Opinion Nr. 804 (2020), „Physical Activity and Exercise During Pregnancy and the Postpartum Period“                                                                                                                                                                                                                      |
| `AGE_PLAN_RULES`                  | unter 18: RPE ≤ 8, ohne `high_skill` · ab 65: RPE ≤ 7, ohne `high_impact`/`high_skill`                                                                                                                                                                                                       | unter 18: Faigenbaum AD et al. (2009), NSCA-Positionspapier, J Strength Cond Res 23(5 Suppl 5) (Technik unter qualifizierter Aufsicht – die App bietet keine); ab 65: **Produktentscheidung** (Chodzko-Zajko WJ et al. (2009), Med Sci Sports Exerc 41(7):1510–1530, nutzt eine 0–10-Anstrengungsskala, nicht RPE nach Wdh. in Reserve) |
| `INTRO_WEEK_RPE_REDUCTION`        | 1                                                                                                                                                                                                                                                                                            | Helms ER et al. (2016), Strength Cond J 38(4):42–49 (RPE nach Wdh. in Reserve); Produktentscheidung                                                                                                                                                                                                                                     |
| `PARTIAL_START_WEEK_MIN_SHARE`    | 0,5 (darunter „Woche 0“)                                                                                                                                                                                                                                                                     | Produktentscheidung (Abschnitt 5.7)                                                                                                                                                                                                                                                                                                     |
| `E1RM_ESTIMATE`                   | Epley, höchstens 12 Wdh. + Reserve                                                                                                                                                                                                                                                           | Epley B (1985), Poundage Chart; Zourdos MC et al. (2016), J Strength Cond Res 30(1):267–275 (RIR-basierte RPE-Skala)                                                                                                                                                                                                                    |
| `LOAD_PROGRESSION`                | Schritt bis 10 % direkt, größerer Sprung erst nach dem Puffer (> 25 %: erste Einheit RPE −1) · +2,5 kg Langhantel/Maschine, nächste Stufe bzw. +2 kg Kurzhantel · Puffer `reps_max + 2` (≤ 30), +1 Satz (≤ 6) · Auslöser 2 Einheiten in Folge · Halteübung `min(5 s, max(1 s, floor(10 %)))` | ACSM Position Stand (2009): Laststeigerung 2–10 %, wenn 1–2 Wdh. über dem Ziel gelingen; „2-für-2-Regel“ (zwei Einheiten in Folge, NSCA, Baechle/Earle „Essentials of Strength Training and Conditioning“) – beim Umsetzen genau zitieren                                                                                               |
| `DELOAD_SCHEDULE`                 | Belastungswochen: Einsteiger 5, Fortgeschrittene 4, vorsichtig 4                                                                                                                                                                                                                             | KONZEPT 4.5 („alle 4–6 Wochen“), `DELOAD_INTERVAL_WEEKS`; Bell L et al. (2023), Delphi-Konsens zum Deloading, Sports Med Open                                                                                                                                                                                                           |
| `DELOAD_DOSAGE`                   | Sätze ×0,5 (aufgerundet, mind. 1), RPE −2, Gewicht ×0,9                                                                                                                                                                                                                                      | Bell L et al. (2023); Produktentscheidung                                                                                                                                                                                                                                                                                               |
| `SESSION_FIT`                     | mind. 3 Übungen, mind. 2 Sätze Grund- / 1 Satz Isolationsübung                                                                                                                                                                                                                               | Produktentscheidung (Abschnitt 5.6)                                                                                                                                                                                                                                                                                                     |
| `PLAN_BLOCK_LIMITS`               | Woche 0–6 (Woche 0 + höchstens 5 + 1), höchstens 7 Einheiten/Woche, höchstens 8 Übungen/Einheit                                                                                                                                                                                              | Produktentscheidung bzw. Regel V8; identisch als CHECK in der Datenbank                                                                                                                                                                                                                                                                 |
| `PLANNED_LOAD_LIMITS`             | Zielgewicht 0,5–500 kg                                                                                                                                                                                                                                                                       | Plausibilitätsgrenze (Langhantel + Scheiben); identisch als CHECK                                                                                                                                                                                                                                                                       |
| `PLAN_ENGINE_VERSION`             | 1                                                                                                                                                                                                                                                                                            | Regeländerung → Hinweis „Plan neu erstellen“                                                                                                                                                                                                                                                                                            |

Bereits vorhanden und genutzt: `DELOAD_INTERVAL_WEEKS`, `MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION`,
`TEMPLATE_DOSAGE_LIMITS`, `REST_RANGES_S`, `SESSION_DURATION_ESTIMATE`, `WEEKLY_SETS_PER_MUSCLE`,
`TRAINING_LIMITS`, `AGE_CHECK_TIME_ZONE`. Die Zuordnung Ziel → Vorlagen-Ziel (Definition → Muskelaufbau,
Ausdauer → Allgemeine Fitness) und Level (Leistungssport → Fortgeschritten) steht als Konstante neben
`TEMPLATE_GOAL_TYPES` in `enums.ts`.

---

## 7. Code-Struktur in `packages/core` und Tests

Neuer Ordner `packages/core/src/plan/` (Export über `src/index.ts`), Datums-Helfer in `src/dates.ts`
(`isoWeekday()`, `startOfIsoWeek()`, `daysBetween()` – Kalenderrechnung in UTC wie `addDays()`, also ohne
Sommerzeit-Fehler).

| Datei             | Inhalt                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `inputs.ts`       | `planInputsSchema` (Zod), Typ `PlanInputs`                                                                             |
| `content-pool.ts` | `selectPlanContent()` (5.2), Nachschlagen von Übungen/Alternativen                                                     |
| `safety.ts`       | `planSafetyRules()` (5.4), `applyCurrentSafetyRules()`, `isStricter()` (sofort wirksam vs. nur nach Bestätigung)       |
| `equipment.ts`    | `equipmentProfile()`, `isExerciseFeasible()`, `findSubstitute()` (5.5)                                                 |
| `match.ts`        | `scoreTemplate()`, `matchTemplate()` mit Güte und Hinweisen (5.3)                                                      |
| `adapt.ts`        | `adaptTemplate()`, `fitSessionToMinutes()`, Dosierung begrenzen, Pausen bei Musterwechsel (5.4–5.6)                    |
| `schedule.ts`     | `chooseTrainingDays()`, `assignSessionsToDays()`, Rotation, Woche 0, `buildPlanBlock()`, `nextPlanBlock()` (5.7, 5.10) |
| `loads.ts`        | `estimateWorkingWeight()`, `snapToAvailableWeight()`, `nextLoad()` (5.8–5.9)                                           |
| `deload.ts`       | `loadWeeksBeforeDeload()`, `deloadDosage()` (5.10)                                                                     |
| `reschedule.ts`   | `rescheduleSession()` (5.11)                                                                                           |
| `volume.ts`       | `capWeeklyIncrease()` (5.12)                                                                                           |
| `update.ts`       | `planNeedsUpdate()` (10.4) inkl. Altersgrenzen und Geburtstage                                                         |
| `generate.ts`     | `generateTrainingPlan()` – setzt alles zusammen; `generatedPlanSchema` (Zod) für die Grenze zur App/DB                 |
| `notes.ts`        | Hinweis-Codes `PLAN_NOTES`                                                                                             |

**Tests (Vitest, jede Funktion, inkl. Grenzfälle):**

1. **Tage:** 1, 2, 3, 4, 5, 6, 7 Tage; 0, zu wenige, gleich viele, zu viele Wunsch-Tage; Sa + So; alle 7 als
   Wunsch-Tage; Wochenwechsel Sonntag → Montag.
2. **Startwoche:** Erzeugen am Montag (Woche 1), Mittwoch (Hälfte passt → Woche 1), Freitag bei Mo/Mi/Fr (weniger
   als die Hälfte → Woche 0, Block startet Montag), Sonntag (nichts frei); Woche 0 zählt nicht zum Block; mit Woche 0
   ist Woche 1 **keine** zweite Einstiegswoche; `week_no` nie über 6.
3. **Geräte:** gar nichts zu Hause (keine Zug-Übung → Hinweis), nur Band, nur Kurzhanteln mit Stufen 2/4/6 kg,
   nur Studio-Geräte (Studio: nichts getauscht), „beides“, Kette Alternative der Alternative, keine Doppelungen.
4. **Ersatz-Sicherheit:** kein Ersatz in Schritt 2–5 verletzt `planSafetyRules()`; nie höhere `difficulty`; bei
   vorsichtigem Plan wird `easier` bevorzugt; Musterwechsel Grund- → Isolationsübung setzt die Pause in
   `REST_RANGES_S.isolation`; Gerätetausch setzt `exercises_substituted`, Vorsichtstausch nicht.
5. **Person:** 16 Jahre, 17 Jahre (RPE ≤ 8, kein `high_skill`), Tag vor/am 18. Geburtstag, 64/65 Jahre
   (Regelwechsel am 65. Geburtstag), 95 Jahre; Einsteiger nie Fortgeschrittenen-Vorlage; Leistungssport; „sehr
   leicht/sehr schwer“: **Ergebnis für 45 kg und 180 kg identisch** (Körpergewicht geht nicht ein); Geschlecht
   `diverse`/`unspecified` mit Vorlagen ohne `sex`.
6. **Vorsicht:** jedes einzelne Flag, alle Flags; `injury` und `medical_clearance_recommended` → keine
   `overhead`-Übung (Kurzhantel-Schulterdrücken ersetzt oder entfernt); `medication` allein → `overhead` erlaubt;
   Schwangerschaft (keine `long_supine`); kein Check vorhanden (wie vorsichtig inkl. `overhead`);
   Langhantel-Kniebeuge → Goblet-Kniebeuge; RPE nie über 7; `usesHealthData` mit Check (auch ohne Flag) `true`,
   ohne Check `false`; `medicalNotice` bei jedem Flag (`requiresMedicalNotice`), ohne Flag `false`.
7. **Sofort strenger, nur bestätigt lockerer:** neues Flag → `applyCurrentSafetyRules()` senkt RPE und ersetzt
   Übungen in Anzeige und Folgeblock; Flag entfällt → Plan unverändert, nur Hinweis; Folgeblock mit archivierter
   Vorlage funktioniert (Schnappschuss).
8. **Zeit:** 10, 20, 30, 45, 60, 90, 240 Minuten; Schätzung nach dem Kürzen ≤ Budget oder Hinweis.
9. **Matching:** keine Inhalte → `no_template`; nur Entwürfe ohne `allowDrafts` → `no_template`; Probelauf-Inhalt
   und Entwurf mit rotem Befund nie gewählt; Ausdauer → Allgemeine Fitness mit `fallback`; Gleichstand
   deterministisch; jede der 24 Vorlagen wird für „ihre“ Person mit `exact` gefunden.
10. **Lasten:** nur eine Einheit über Ziel → keine Steigerung; zwei in Folge → Steigerung; Schritt ≤ 10 % direkt;
    Schritt > 10 % (4 → 6 kg) → erst `reps_max + 2`, dann +1 Satz, dann Gewicht; `reps_max + 2` nie über 30, Sätze
    nie über 6; keine Stufen bekannt; Körpergewicht/Band/Halteübung (10 s → +1 s, 20 s → +2 s, 60 s → +5 s, nie über 120 s); Epley über 12 Wdh. nicht
    hochgerechnet; nie über 500 kg.
11. **Deload und Blöcke:** Blocklängen je Level, Erholungswoche halbiert (1 Satz → 1), RPE nie unter 5, Folgeblock
    lückenlos mit `block_no + 1`.
12. **Verschieben:** freier Tag vorhanden, keiner frei → gestrichen, Sonntag, Erholungswoche, nie stapeln, nie in
    die nächste Woche, nie vor heute.
13. **Eigenschaften über alle Vorlagen × viele Personen:** Plan erfüllt immer die Datenbank-Grenzen
    (`generatedPlanSchema`), nie RPE > 9, nie > 8 Übungen, nie zwei Einheiten an einem Tag, gleiche Eingaben →
    gleicher Plan.

**Beispielpläne für euch:** Ein kleines Skript (`pnpm plan:examples` in `packages/content`) erzeugt für ca. 8 feste
Test-Personen die Pläne aus dem aktuellen Inhaltsstand und schreibt sie als lesbare Tabelle in die
Zusammenfassung des `ci`-Laufs (in der GitHub-App unter „Summary“). Nur ausgedachte Test-Personen, keine echten
Daten.

---

## 8. Datenmodell

Neue Migrationen (Phase 1/2 bleiben unverändert; `private.consents_after_revoke()` wird per `create or replace` in
einer neuen Migration erweitert), Spaltennamen englisch. `user_id` mit `on delete cascade` auf `auth.users` →
`delete_my_account()` löscht alles mit.

**Neue Aufzählungen** (in `enums.ts` und als Postgres-Enum, abgeglichen in `db-sync.test.ts`): `plan_status`
(`active`, `replaced`), `planned_session_status` (`planned`, `skipped`; Phase 4 ergänzt `completed` per
`alter type … add value`), `plan_match_quality` (`exact`, `close`, `fallback`), `plan_note` (Codes aus 5.13).

| Tabelle             | Spalten                                                                                                                                                                                                                                                                                                                                                                                                           | Regeln                                                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_plans`        | `id`, `user_id`, `status`, `template_id` (→ `plan_templates`, `on delete restrict`), Schnappschuss `template_title_de`, `template_version`, `engine_version`, `match_quality`, `notes plan_note[]`, **`uses_health_data boolean`**, **`medical_notice boolean`**, `inputs jsonb` (nur Nicht-Gesundheits-Angaben: Ziel, Level, Tage, Minuten, Wunsch-Tage, Ort, Geräte), `start_date`, `created_at`, `replaced_at` | höchstens **ein** aktiver Plan je Person (eindeutiger Teil-Index `where status = 'active'`); `unique (id, user_id)` für die Fremdschlüssel unten; CHECK `medical_notice` nur mit `uses_health_data`                                                                                                |
| `planned_sessions`  | `id`, `plan_id`, `user_id`, `block_no`, `week_no` (0–6; 0 = Woche 0), `is_intro_week`, `is_deload`, `template_day_index`, `scheduled_on` (date), `original_date` (gesetzt nach Verschieben), `status`, Schnappschuss `name_de`, `focus`, `estimated_minutes`, `warmup_de`, `cooldown_de`                                                                                                                          | Fremdschlüssel `(plan_id, user_id)` → `user_plans (id, user_id)`; **eindeutiger Index `(user_id, scheduled_on) where status <> 'skipped'`** = nie zwei Einheiten an einem Tag, auch über Pläne hinweg                                                                                              |
| `planned_exercises` | `id`, `session_id`, `user_id`, `order_no`, `exercise_id` und `source_exercise_id` (→ `exercises`, `on delete restrict`), Schnappschuss `exercise_name_de`, `sets`, `reps_min`/`reps_max` **oder** `duration_s`, `rest_s`, `rpe_target`, `superset_group`, `notes_de`, `target_weight_kg` (Phase 3 leer)                                                                                                           | Fremdschlüssel `(session_id, user_id)`; **`order_no between 1 and 8` + `unique (session_id, order_no)`** = höchstens 8 Übungen; **fachliche Grenzen als CHECK** = `TEMPLATE_DOSAGE_LIMITS` (Sätze 1–6, Wdh. 3–30, Dauer 10–120 s, RPE 5–9 in 0,5er-Schritten), Zielgewicht = `PLANNED_LOAD_LIMITS` |

### 8.1 Rechte: Schreiben nur über geprüfte Funktionen (gegen Umgehen per PostgREST)

Ohne diese Regel könnte jemand mit dem eigenen Login direkt über die Datenbank-Schnittstelle (PostgREST) Zeilen
anlegen und dabei Prüfungen der App umgehen. Darum:

1. **`authenticated` darf auf `user_plans` und `planned_exercises` nur lesen** (`select`, RLS „nur eigene
   Zeilen“). Kein `insert`, `update`, `delete`. `anon` darf nichts.
2. **`planned_sessions`:** lesen (eigene Zeilen) und **`update` nur für Datum und Status**, kein `insert`/`delete`
   für Nutzer. Ein Trigger
   (`private.planned_sessions_before_update`) lehnt jede andere Änderung ab und erlaubt nur:
   - der **alte** Termin darf in der Vergangenheit liegen (verpasste Einheit derselben ISO-Woche),
   - der **neue** Termin `scheduled_on` liegt **nicht vor heute** (Europe/Berlin, `AGE_CHECK_TIME_ZONE`) und in
     **derselben ISO-Woche** wie `coalesce(original_date, scheduled_on)` (also immer die Woche des ursprünglich
     geplanten Tages, auch nach mehrfachem Verschieben); `original_date` setzt der Trigger **nur beim ersten
     Verschieben** (`original_date = coalesce(old.original_date, old.scheduled_on)`), danach bleibt es unverändert,
   - Status nur **`planned` → `skipped`** (nicht zurück),
   - Einheiten der Erholungswoche (`is_deload`) werden **nur gestrichen, nie verschoben**; die 48-h-Erholungsregel
     zwischen Nachbartagen bleibt eine Regel der App (`rescheduleSession()`),
   - nur Einheiten des **aktiven** Plans; der Status einer Einheit, deren ISO-Woche vorbei ist, ändert sich nicht
     mehr.
3. **`public.save_training_plan(p_plan jsonb) returns uuid`** – `security definer`, `set search_path = ''`,
   `revoke … from public, anon`, `grant execute … to authenticated` (Muster `delete_my_account()`). Prüft selbst,
   weil RLS hier nicht greift: angemeldet (`auth.uid()`), Profil vorhanden, Vorlage und alle Übungen
   existieren und sind `published`, `template_version` stimmt, alle Grenzen aus `PLAN_BLOCK_LIMITS`. Dann in
   **einer** Transaktion: bisherigen aktiven Plan auf `replaced` setzen, dessen Einheiten mit
   Status `planned` ab **gestern** löschen (frühestes zulässiges Datum eines neuen Plans, Europe/Berlin; ältere
   bleiben als Verlauf), neuen Plan mit Einheiten und Übungen anlegen – `user_id`
   immer aus `auth.uid()`, nie aus der Eingabe.
   **`uses_health_data` und `medical_notice` bestimmt die Funktion selbst** aus dem neuesten
   `health_screening`-Eintrag des Aufrufers: Check vorhanden **und** `public.has_valid_consent('health_data')` →
   `uses_health_data = true`, sonst `false`; `medical_notice = true`, wenn dieser Check irgendein Flag hat (wie
   `requiresMedicalNotice()`), sonst `false`. Weicht die Eingabe davon ab (z. B. `false` trotz gültigem Check, oder
   `true` ohne gültige Einwilligung), wird der Aufruf **abgelehnt** – die App hat dann mit falschen Regeln gerechnet
   und muss neu erzeugen.
4. **`public.append_plan_block(p_plan_id uuid, p_sessions jsonb)`** – gleiche Absicherung; nur für den **eigenen
   aktiven** Plan; nimmt nur `block_no = max(block_no) + 1`; bestimmt `uses_health_data`/`medical_notice` genauso
   selbst und lehnt ab, wenn sie nicht zum Plan passen (z. B. Plan mit Gesundheitsdaten, Einwilligung inzwischen
   veraltet) – dann ist ein neuer Plan nötig (10.4).
5. Fehlermeldungen ohne Nutzerdaten (wie bisher).

**Für Phase 4 vorgemerkt:** „Gestern verpasst → `skipped`“ setzt eine eigene Server-Funktion (`security definer`),
nicht der Trigger aus Punkt 2 (der verbietet Änderungen in der Vergangenheit). Progressions-Änderungen an
`planned_exercises` (z. B. `target_weight_kg`) laufen ebenfalls über eine eigene `security definer`-Funktion mit
denselben Grenzen – Nutzer bekommen auf `planned_exercises` weiterhin nur `select`.

### 8.2 Widerruf der Gesundheits-Einwilligung

`private.consents_after_revoke()` bekommt bei `health_data` zusätzlich:

1. **Alle** Pläne der Person mit `uses_health_data = true` werden **vollständig gelöscht** – der aktive und alle
   früheren (`replaced`), mit **allen** Einheiten (auch vergangenen) und Übungen (per Kaskade).
2. Pläne ohne Gesundheitsdaten bleiben unverändert.
3. Die App bietet danach sofort einen neuen Plan nach den Regeln „ohne Gesundheits-Check“ an (10.4).

In Phase 3 gibt es noch kein Tagebuch – das vollständige Löschen verliert also keine Trainings-Einträge.
**Für Phase 4 festgehalten:** Ab dem Tagebuch verweisen Einträge auf geplante Übungen
(`set_logs.planned_exercise_id`). Das Löschen beim Widerruf darf **nie** ungewollt Tagebuch-Einträge per Kaskade
mitlöschen – dort `on delete set null` und eine eigene Kopie der nötigen Angaben im Eintrag. Wird in PLAN-PHASE-4
ausdrücklich geprüft.

**Veraltete Einwilligungsversion** (neue Textfassung, noch nicht neu zugestimmt): `has_valid_consent` ist dann
`false`. „Heute“ zeigt **zuerst** die Neu-Einwilligung (vorhandener Hinweis `t.today.healthReconsent`). Stimmt die
Person zu, läuft alles weiter. **Lehnt sie ab**, erzeugt die App einen neuen Plan nach den Regeln „ohne
Gesundheits-Check“ und speichert ihn über `save_training_plan` (`uses_health_data = false`); der bisherige Plan mit
Gesundheitsdaten wird dabei ersetzt. Folgeblöcke für einen Plan mit Gesundheitsdaten lehnt `append_plan_block`
ohne gültige Einwilligung ab.

### 8.3 Bezug zur Vorlagen-Version und archivierte Inhalte

Der Plan ist ein **Schnappschuss** (PLAN-PHASE-2 Abschnitt 5, Punkt 6) – spätere Änderungen an einer Vorlage
ändern keinen laufenden Plan; Titel, Einheiten-Namen, Texte und Übungsnamen sind mitkopiert. `template_version` +
`engine_version` zeigen, womit er erzeugt wurde; ist eine neuere Version freigegeben, zeigt die App „Neue Version
deines Plans verfügbar“ (Frage 5). `content-seed` löscht nie, sondern archiviert; die Fremdschlüssel auf
`plan_templates` und `exercises` sind `on delete restrict`, damit auch ein versehentliches Löschen keinen Plan
beschädigt. Damit archivierte Übungen in bestehenden Plänen lesbar bleiben, bekommt `exercises` eine **zusätzliche
Lese-Regel**: „archivierte Übung lesbar, wenn sie in einem eigenen `planned_exercises`-Eintrag steht“.

### 8.4 Tests, Typen, Abgleich

**pgTAP** (`supabase/tests/12_training_plans.test.sql`, `13_training_plan_rpcs.test.sql`, Ergänzungen in
`04_account_deletion`, `06_profile_required` und dem Widerrufs-Test):

1. A sieht keine Pläne von B; `anon` sieht nichts; ohne Profil kein Plan.
2. **Direktes `insert`/`update`/`delete` auf `user_plans` und `planned_exercises` als Nutzer scheitert** (auch die
   eigenen Zeilen); `insert`/`delete` auf `planned_sessions` scheitert.
3. `planned_sessions`-Update: anderes Feld als Datum/Status → Fehler; Datum in anderer ISO-Woche oder vor heute →
   Fehler; `skipped` → `planned` → Fehler; Einheit eines ersetzten Plans → Fehler.
4. Zwei nicht gestrichene Einheiten am selben Tag (auch aus verschiedenen Plänen) → Fehler.
5. RPE 10, 7 Sätze, 2 Wdh., `order_no` 9, doppelte `order_no` → Fehler.
6. `save_training_plan`: ersetzt atomar (Fehler mitten drin → alter Plan bleibt); lehnt unveröffentlichte
   Vorlage/Übung ab; lehnt `uses_health_data = true` ohne gültige Einwilligung ab; **lehnt `uses_health_data =
false` trotz vorhandenem Check und gültiger Einwilligung ab**; `medical_notice` passend zum neuesten Check (Flag
   vorhanden ↔ `true`), sonst Fehler; **lehnt eine fremde `user_id` in der Eingabe ab** (unbekanntes Feld, wie
   `.strict()`; `user_id` kommt immer aus dem Login); `anon` darf nicht ausführen.
7. `append_plan_block`: nur eigener aktiver Plan, nur `max + 1`, gleiche Prüfung von `uses_health_data`.
8. **Widerruf `health_data`:** **alle** Pläne mit `uses_health_data` (aktiv und `replaced`) samt **allen**
   Einheiten und Übungen gelöscht; Plan ohne Gesundheitsdaten bleibt unverändert aktiv.
9. **Veraltete Einwilligungsversion:** `save_training_plan` mit `uses_health_data = false` (Regeln ohne Check)
   wird angenommen und ersetzt den Plan mit Gesundheitsdaten; `true` wird abgelehnt; `append_plan_block` auf den
   Plan mit Gesundheitsdaten wird abgelehnt.
10. **Verschieben mehrfach:** erstes Verschieben setzt `original_date`, zweites lässt es unverändert; ISO-Woche
    wird gegen das ursprüngliche Datum geprüft (Verschieben Mi → Fr → So erlaubt, → Mo der Folgewoche Fehler).
11. `delete_my_account` löscht alle Pläne nur des Aufrufers; archivierte Übung nur über eigenen Plan lesbar;
    Löschen einer Übung/Vorlage mit Plan-Bezug scheitert (`restrict`).

**Typen und Abgleich:** `packages/db/src/database.types.ts` von Hand im gen-types-Format ergänzen (3 Tabellen,
4 Enums, 2 Funktionen; Test `database.types.test.ts` mitziehen). `db-sync.test.ts` prüft neue Enums,
`TEMPLATE_DOSAGE_LIMITS`, `PLAN_BLOCK_LIMITS` (inkl. `order_no` 1–8, `week_no` 0–6) und `PLANNED_LOAD_LIMITS`
gegen die CHECKs.

---

## 9. Trainingspläne und Gesundheitsdaten

**Prüfung (nach Wächter-Befund 1):** Ein Plan, in den der Gesundheits-Check eingeht, **offenbart mittelbar
Gesundheitsangaben** – z. B. fehlen bei Schwangerschaft alle Übungen in Rückenlage, `source_exercise_id` zeigt den
Tausch, und wer Einwilligungen und Geburtsdatum kennt, kann vom vorsichtigen Plan auf ein Flag schließen. Nach dem
EuGH (Urteil vom 01.08.2022, C-184/20) sind auch Daten, aus denen sich Gesundheitsangaben **mittelbar** ableiten
lassen, besondere Kategorien nach Art. 9 DSGVO. Unser eigener Einwilligungstext `health_data`
(`apps/mobile/src/data/consent-texts.ts`) nennt ausdrücklich „die daraus abgeleiteten Hinweise (z. B.
‚vorsichtiger Plan‘)“.

**Entscheidung: Wir behandeln solche Pläne vorsorglich als Gesundheitsdaten (sichere Variante).**

1. **Markierung:** `user_plans.uses_health_data = true`, sobald der Gesundheits-Check in die Regeln eingeht (auch
   ohne Flag). Pläne ohne Check (`false`) beruhen nur auf Ziel, Zeit, Ort, Geräten, Erfahrung und Alter und sind
   normale Nutzerdaten.
2. **Die Datenbank entscheidet:** `save_training_plan` und `append_plan_block` bestimmen `uses_health_data` und
   `medical_notice` selbst aus dem neuesten Gesundheits-Check und der Einwilligung und lehnen abweichende Eingaben ab
   (8.1). `local-rules.ts` prüft im Testmodus genau dieselbe Regel.
3. **Widerruf:** **alle** Pläne mit Gesundheitsdaten werden vollständig gelöscht (auch vergangene Einheiten und
   frühere Pläne), die App bietet einen Plan nach „ohne Check“-Regeln an (8.2).
4. **Testmodus und Gerätespeicher:** `withoutHealthData()` wird in zwei getestete Funktionen aufgeteilt:
   - `applyHealthDataRevocation(rows)` – spiegelt den Datenbank-Trigger: löscht Körperdaten, Umfänge, Checks,
     Unverträglichkeiten **und alle Pläne mit `uses_health_data`** (Testmodus und Supabase-Abbild nach Widerruf),
   - `cacheableRows(rows, { allowHealthPlanCache })` – was im Supabase-Modus auf das Gerät darf: nie Körperdaten,
     Checks, Unverträglichkeiten; Pläne mit Gesundheitsdaten und `safetyRules` nur, wenn `allowHealthPlanCache`
     (Frage 14) gesetzt ist, und dann nur in den geschützten Zwischenspeicher.
5. **Datenminimierung bleibt:** keine Körperdaten in der Berechnung (5.8), keine gesundheitsbezogenen Hinweis-Codes,
   Tausch-Codes nur aus Gerätegründen. `medical_notice` ist der einzige ausdrückliche Gesundheitswert am Plan – er
   wird gebraucht, damit der Arzt-Hinweis vor jeder Einheit auch offline erscheint (10.2).
6. **Nie** an Analytics, Werbung oder Partner, nie in Logs oder Fehlermeldungen (gilt für alle Pläne).

**Gerätespeicher – ausdrückliche Gründer-Entscheidung VOR Etappe C (Frage 14), Empfehlung:** Ein Plan mit
`uses_health_data = true` (samt `safetyRules` und Arzt-Hinweis) liegt im Supabase-Modus **nur als
Zwischenspeicher** auf dem Gerät, damit Training ohne Netz möglich bleibt:

1. **Wo:** in der App (iPhone/Android) **verschlüsselt** über `expo-secure-store` bzw. einen damit verschlüsselten
   Speicher (Schlüssel im sicheren Schlüsselspeicher des Geräts); im **Browser nur `sessionStorage`** (endet mit
   dem Tab, kein `localStorage`).
2. **Gelöscht** bei Widerruf, Abmelden, Konto löschen und sobald der Server meldet, dass der Plan ersetzt
   (`replaced`) wurde oder fehlt.
3. **Nie in die Offline-Warteschlange:** Verschieben wird sofort gesendet (wie andere Gesundheitsdaten,
   `isSensitiveOp`), ohne Netz erscheint „Erneut versuchen“.

Das ist eine **bewusste, dokumentierte Ausnahme** von der Phase-1-Regel „Gesundheitsdaten im Supabase-Modus nur im
Arbeitsspeicher“ (PLAN-PHASE-1 Abschnitt 9, Punkt 4) – begründet mit dem Offline-Training im Studio. Lehnen die
Gründer ab, gibt es für diese Pläne keinen Offline-Plan (`allowHealthPlanCache = false`). Pläne ohne
Gesundheitsdaten werden wie bisher zwischengespeichert und dürfen in die Warteschlange.

Eine juristische Bestätigung in der Datenschutz-Folgenabschätzung bleibt sinnvoll, ist mit der sicheren Variante
aber **kein Blocker** mehr.

---

## 10. App

### 10.1 Plan erzeugen

1. **Nach dem Onboarding** zeigt „Geschafft!“ (`done.tsx`) statt „kommt in Phase 3“: „Dein Plan wird erstellt …“
   (Laden) → „Dein Plan ist fertig“ mit Vorlagen-Titel, Güte-Hinweis und Knopf **„Zum Plan“**.
2. Gemeinsamer Ablauf für beide Betriebsarten (`src/data/training-plan.ts`): Angaben aus `UserRows` →
   `planInputsFromRows()` → Inhalte laden → `generateTrainingPlan()` → `generatedPlanSchema` prüfen → speichern.
3. **Testmodus (ohne Supabase):** Inhalte kommen gebündelt aus dem Repository (Skript wie
   `apps/web/scripts/bundle-content.mjs`, am besten gemeinsam genutzt; Ausgabe `src/generated/content-files.ts`,
   nicht eingecheckt, erst bei Bedarf nachgeladen). Nur `createLocalBackend()` übergibt `allowDrafts: true` (5.2).
   Speichern als neue `WriteOp` `save_training_plan` im Gerätespeicher; `local-rules.ts` prüft dieselben Regeln
   wie Datenbank und Funktionen (ein aktiver Plan, nie stapeln, Dosierung, `order_no` 1–8, `uses_health_data` und
   `medical_notice` aus Check + Einwilligung bestimmt, abweichende Eingabe abgelehnt, Verschiebe-Regeln mit
   `original_date`). Beim Widerruf löscht `applyHealthDataRevocation()` alle Pläne mit Gesundheitsdaten wie 8.2.
4. **Supabase-Modus:** Inhalte per Abfrage der freigegebenen Tabellen (`plan_templates`, `template_sessions`,
   `template_exercises`, `exercises`, `exercise_alternatives`), immer `allowDrafts: false`, Speichern über
   `save_training_plan`. Erzeugen braucht einmal Verbindung. Danach Zwischenspeicher über
   `cacheableRows()` nach Abschnitt 9.
5. **Verschieben offline (Pläne ohne Gesundheitsdaten):** Warteschlangen-Schlüssel
   `update_planned_session:<session_id>` – eine neuere Änderung derselben Einheit ersetzt die ältere. **Ein neuer
   Plan (`save_training_plan`) entfernt ausdrücklich alle wartenden `update_planned_session`-Einträge** des alten
   Plans aus der Warteschlange. Lehnt der Server eine wartende Änderung ab (z. B. Einheit inzwischen ersetzt oder
   Tag belegt) und die Warteschlange verwirft sie (`onDropped`), lädt die App den Plan neu und meldet: „Eine
   Verschiebung konnte nicht übernommen werden – dein Plan wurde neu geladen.“ Pläne mit Gesundheitsdaten: sofort
   senden (Abschnitt 9).
6. **Bestehende Test-Konten** (Onboarding schon fertig, noch kein Plan): „Heute“ zeigt „Plan erstellen“.

### 10.2 „Heute“

1. Kopf: „Woche 2 von 6“ (bzw. „Woche 0 – zum Reinschnuppern“), Kennzeichen **Einstiegswoche** bzw.
   **Erholungswoche** mit einem Satz Erklärung.
2. **Arzt-Hinweis vor jeder Einheit:** Ist `medical_notice` gesetzt, steht über **jeder** Einheit (heute und beim
   Antippen eines Tages): „Bitte kläre vor dem Training ärztlich ab, ob es für dich passt. Bei Brustschmerz,
   Schwindel oder Atemnot sofort aufhören.“ – allgemein, ohne Diagnose oder Flag; gesetzt bei jedem Gesundheits-Flag.
   Auch offline sichtbar, weil das Feld am Plan liegt und im Zwischenspeicher nach Frage 14 mitkommt.
3. **Heutige Einheit:** Name („Ganzkörper A“), geschätzte Dauer, Aufwärmen, Übungsliste (Name, „3 × 8–12
   Wiederholungen“ bzw. „3 × 30 Sekunden“, Pause, „ca. 3 Wiederholungen in Reserve“, „Startgewicht finden“ bzw.
   Zielgewicht), Kennzeichen „ersetzt (Gerät fehlt)“ bei Gerätetausch, Cool-down. Vor der Anzeige wendet die App
   `applyCurrentSafetyRules()` an (5.4).
4. **Ruhetag:** „Heute ist Ruhetag“ + nächste Einheit mit Datum.
5. **Wochenübersicht** Mo–So: Einheit oder Ruhetag, heute hervorgehoben, verschoben/gestrichen sichtbar; Antippen
   zeigt die Einheit dieses Tages.
6. Knopf **„Einheit verschieben“** (5.11) mit Ergebnis-Meldung („Auf Donnerstag verschoben“ bzw. „Diese Woche ist
   kein Tag mehr frei – die Einheit entfällt“).
7. **Hinweise** (`Notice`): Güte und Hinweis-Codes in einfachen Worten; vorsichtiger Plan („Dein Plan ist bewusst
   vorsichtig aufgebaut.“) aus dem Gesundheits-Check bzw. „Ohne Gesundheits-Check planen wir vorsichtig“;
   Testinhalte; „Inhalte noch nicht fachlich geprüft“, solange `expert_reviewed` fehlt.
8. Bisherige Hinweise (Mess-Erinnerung, offline) bleiben. **Veraltete Einwilligungsversion:** Die
   Neu-Einwilligung steht ganz oben und kommt vor allem anderen; bei Ablehnung „Neuen Plan ohne Gesundheits-Check
   erstellen“ (8.2).

### 10.3 Zustände

| Zustand         | Anzeige                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Laden           | `LoadingState` beim Erzeugen und Laden                                                                                                                                                                                                     |
| Leer            | kein Plan → „Noch kein Plan“ + Knopf „Plan erstellen“ (auch nach Widerruf: „Neuen Plan erstellen“)                                                                                                                                         |
| Keine Inhalte   | `no_template` → „Für deine Angaben gibt es gerade keinen freigegebenen Plan. Wir arbeiten daran.“ + „Erneut versuchen“                                                                                                                     |
| Fehler          | Netz/Speichern → bekannte Texte aus `t.errors` + „Erneut versuchen“; Angaben bleiben erhalten                                                                                                                                              |
| Offline         | zwischengespeicherter Plan + Hinweis; Verschieben je nach Plan nachgereicht oder „Erneut versuchen“ (Abschnitt 9)                                                                                                                          |
| Ohne Bibliothek | Übungs-Bibliothek offline nicht geladen → `applyCurrentSafetyRules()` blendet alle Übungen aus (Merkmale nicht prüfbar): eigener Zustand „Übungen können gerade nicht geprüft werden – bitte kurz online gehen“ statt einer leeren Einheit |

### 10.4 Neu erzeugen bei geänderten Angaben

1. `planNeedsUpdate(plan, inputs, latestScreening, today)` vergleicht `user_plans.inputs` mit den aktuellen
   Angaben, dazu `engine_version`, neuere Vorlagen-Version, „Gesundheits-Check neuer als der Plan“, Widerruf der
   Einwilligung sowie **Altersgrenzen**: Liegt seit Planerstellung der **18. oder 65. Geburtstag**, gilt der Plan
   als veraltet (Altersgrenze aus `birth_date`, kein Speichern des Alters nötig).
2. Dann zeigt „Heute“: „Deine Angaben haben sich geändert – Plan neu erstellen?“ – **nie stilles Ersetzen**.
   Strengere Regeln wirken trotzdem sofort in der Anzeige (5.4). Bereits vergangene Einheiten bleiben erhalten.
3. **Einstellungen:** neuer Bereich „Training“ mit „Angaben ändern“ (öffnet die vorhandenen Onboarding-Schritte
   Erfahrung, Ziel, Zeitbudget, Trainingsort, Equipment und kehrt danach zurück), „Gesundheits-Check wiederholen“
   (nur mit Einwilligung, Frage 8) und „Plan neu erstellen“. „Testdaten löschen“ und „Konto löschen“ entfernen den
   Plan mit.

### 10.5 Texte

Alle Texte deutsch in `src/i18n/de.ts` (neuer Bereich `plan`, angepasste Bereiche `done`, `today`, `settings`),
Hinweis-Codes → feste Textbausteine, RPE immer als „Wiederholungen in Reserve“ erklärt, Wochentage ausgeschrieben.

---

## 11. So testet ihr es am Handy

**Etappe A (nur Engine):** Im Pull Request auf „Checks → ci → Summary“ tippen → Tabelle „Beispielpläne“ lesen
(je Test-Person: gewählte Vorlage, Güte, Hinweise, Wochenplan, getauschte Übungen).

**Etappe B (Datenbank):** Nichts zum Ansehen; der Workflow `db-test` muss grün sein. Keine Supabase nötig.

**Etappe C (App) – lokaler Testmodus, keine Supabase nötig:**

1. Vorschau-Link aus dem Pull Request öffnen (nach dem Merge: **https://fitnessapp-alpha-five.vercel.app**).
2. Schon einmal durchgeklickt? **Einstellungen → Testdaten löschen** – oder auf „Heute“ **„Plan erstellen“**.
3. Onboarding: Muskelaufbau, Einsteiger, 3 Tage (Mo, Mi, Fr), 60 Minuten, Studio → „Geschafft!“ zeigt „Dein Plan
   ist fertig – Muskelaufbau · Einsteiger · 3 Tage · Studio“. „Heute“ zeigt die Einheit oder „Ruhetag“ und die Woche.
4. Testdaten löschen, erneut: **Zuhause ohne Geräte, 2 Tage** → Hinweise „geringer Umfang“ und „Für Rücken-Übungen
   reicht ein Widerstandsband“.
5. Erneut: **7 Tage** → 4 Krafteinheiten, Rest Ruhetage mit Hinweis. **1 Tag, 20 Minuten** → gekürzte Einheit.
6. Erneut: im Gesundheits-Check die **Herz-Frage** mit „Ja“ → Arzt-Hinweis über jeder Einheit, „bewusst
   vorsichtig“, keine Langhantel-Kniebeuge, kein Über-Kopf-Drücken, „ca. 3 Wiederholungen in Reserve“ oder mehr.
7. **Einstellungen → Einwilligungen → Gesundheitsdaten widerrufen** → der Plan ist **komplett** weg (auch die
   vergangenen Tage in der Wochenübersicht), „Heute“ bietet „Neuen Plan erstellen“ (vorsichtige Regeln ohne Check).
8. **Einstellungen → Training → Angaben ändern** (z. B. 4 statt 3 Tage) → „Heute“ fragt „Plan neu erstellen?“.
9. **„Einheit verschieben“** an einem Trainingstag antippen → neuer Tag in der Wochenübersicht.
10. Oben steht „Testinhalte – KI-Entwurf, nicht fachlich geprüft“. Alles einmal hell und einmal dunkel ansehen.

**Später mit Supabase:** Erst Inhalte freigeben (`content-review` → Merge → `content-seed`), sonst zeigt die App
richtigerweise „kein freigegebener Plan“. Dann im Supabase **Table Editor** `user_plans`, `planned_sessions`,
`planned_exercises` ansehen – mit einem zweiten Konto sind die Pläne des ersten nicht sichtbar.

---

## 12. Umsetzung in Etappen

Jede Etappe ist ein eigener Pull Request mit Vorschau-Link und bekommt eine **Wächter-Prüfung**, bevor die nächste
beginnt. Kleine, nachvollziehbare Commits.

**Etappe A – Plan-Engine in `packages/core` (mit Tests)**

1. `src/plan/*` (Abschnitt 7), Datums-Helfer in `dates.ts`, neue Konstanten in `constants.ts` mit Quellen, neue
   Aufzählungen in `enums.ts` (noch ohne Migration – `db-sync.test.ts` folgt in B), Zod-Schemas
   `planInputsSchema`, `generatedPlanSchema`.
2. Grenzfall-Tests aus Abschnitt 7 + Eigenschafts-Tests über alle 24 Vorlagen.
3. Beispielpläne-Skript und Schritt in `ci` (Zusammenfassung).
4. Doku: KONZEPT Abschnitt 4 („Umsetzung ab Phase 3“, Entscheidung Fallback = Frage 1), Umsetzungsstand hier.

_Definition of Done:_ (1) Typen + Zod ✔ · (2) Migration: entfällt (Etappe B) · (3) Core-Logik mit Tests ✔ ·
(4)/(5) UI und Zustände: entfällt (Etappe C) · (6) Texte: Hinweis-Codes, deutsche Texte in C · (7) Doku ✔.

**Etappe B – Datenbank: Tabellen, Rechte, Funktionen, Tests, Typen**

1. Migrationen: Enums, `user_plans`, `planned_sessions`, `planned_exercises`, Rechte nach 8.1 (nur `select` bzw.
   Datum/Status-Update), Trigger, `save_training_plan`, `append_plan_block` (`security definer`), erweiterter
   `private.consents_after_revoke()`, zusätzliche Lese-Regel für archivierte Übungen.
2. pgTAP-Tests (8.4), `db-sync.test.ts`, `database.types.ts` + Test.
3. **Eingabe der Funktionen:** Die App schickt `toSavePlanPayload()` aus `packages/core` (nur die Spalten aus
   Abschnitt 8). Das Zod-Schema der Funktions-Eingabe ist `.strict()` – unbekannte Felder (z. B. Sicherheitsregeln,
   Gesundheits-Check) werden abgelehnt; die Funktion in der Datenbank ignoriert sie ohnehin.
4. Doku: KONZEPT Abschnitt 12 „Abweichungen ab Phase 3“: Tabellen, Einordnung als Gesundheitsdaten bei
   `uses_health_data` (Abschnitt 9), Ausnahme Gerätespeicher, Vormerkung „eigenes Startgewicht“ für Phase 4 (5.8),
   Hinweis Tagebuch-Kaskade für Phase 4 (8.2).

_Definition of Done:_ (1) Typen (`database.types.ts`) + Zod für die Funktions-Eingabe ✔ · (2) Migration mit RLS
✔ · (3) Core: nur Abgleich `db-sync` ✔ · (4)/(5) entfällt · (6) Fehlermeldungen der Funktionen deutsch, ohne
Nutzerdaten ✔ · (7) Doku ✔.

**Etappe C – App: Erzeugen, „Heute“, Testmodus + Supabase, E2E** (Voraussetzung: Gründer-Entscheidung zu
Frage 14)

1. Inhalts-Bündel für die App, `training-plan.ts` (Erzeugen, `planNeedsUpdate`), neue `WriteOp`s in
   `write-ops.ts` (`isSensitiveOp` für Pläne mit Gesundheitsdaten), Prüfungen in `local-rules.ts`, Speichern in
   `local-backend.ts` und `supabase-backend.ts` (+ Laden des aktiven Plans, Zwischenspeicher und Löschen nach
   Abschnitt 9, Warteschlange mit Schlüssel `update_planned_session:<session_id>` und `onDropped` → neu laden),
   `UserRows` um den Plan erweitert, `withoutHealthData()` aufgeteilt in `applyHealthDataRevocation()` und
   `cacheableRows()`; verschlüsselter Zwischenspeicher (`expo-secure-store`, Web `sessionStorage`) – **erst nach der
   Gründer-Entscheidung zu Frage 14**.
2. Bildschirme: „Geschafft!“, „Heute“ (Einheit, Arzt-Hinweis, Woche, Verschieben, Hinweise), Einstellungen
   „Training“; alle Zustände aus 10.3; Texte in `de.ts`.
3. Tests: Vitest für Abbildung, Testmodus-Regeln, Supabase-Aufrufe (gemockt), Warteschlange, **`allowDrafts` nie
   `true` bei konfiguriertem Supabase**, `applyHealthDataRevocation()` und `cacheableRows()` (mit/ohne
   `allowHealthPlanCache`), Zwischenspeicher gelöscht bei Widerruf, Abmelden, Konto löschen und „Plan ersetzt/fehlt“
   vom Server, `local-rules.ts` lehnt `uses_health_data = false` trotz gültigem Check ab, Warteschlange (neuer Plan
   entfernt alte Verschiebungen, `onDropped` lädt neu), wirksame `safetyRules` offline, „Plan neu erstellen“ direkt
   nach strengerem Check; Playwright
   `e2e/training-plan.spec.ts` im Testmodus mit festem Datum (Studio 3 Tage, Zuhause ohne Geräte, 7 Tage,
   vorsichtig mit Arzt-Hinweis, Widerruf → Plan vollständig weg, veraltete Einwilligung → zuerst Neu-Einwilligung,
   Ablehnen → Plan ohne Check, Angaben ändern → neu erstellen, Verschieben, Testdaten löschen); Screenshots
   aktualisieren.
4. Doku: Umsetzungsstand, KONZEPT Abschnitt 5 (Stand „Heute“), `docs/SETUP.md` Hinweis „vor Supabase-Test Inhalte
   freigeben“.

_Definition of Done:_ (1) Typen/Zod an der App-Grenze ✔ · (2) keine neue Migration ✔ · (3) Logik bleibt in
`packages/core`, App nur Abbildung ✔ · (4) UI in der App und im Browser (Web-Export) ✔ · (5) Leer-/Fehler-/
Ladezustände ✔ · (6) Texte deutsch ✔ · (7) Doku ✔.

**Etappe D – nur bei Bedarf:** „Plan-Vorschau“ im Redaktionsbereich `/admin` (Test-Person eingeben → Plan aus
den Inhalten des Branches), hilfreich für die fachliche Prüfung.

---

## 13. Offene Fragen mit Empfehlung

1. **Was, wenn keine Vorlage passt? (offene Gründer-Entscheidung, KONZEPT 4 Punkt 8)** _Empfehlung:_ Gratis =
   nächstbeste Vorlage mit klarem Hinweis, was nicht passt (Abschnitt 5.3). KI-Fallback nur Premium ab Phase 7.
   Fehlen freigegebene Inhalte ganz: Fehlerzustand, kein Ersatz.
2. **Wie entsteht das Startgewicht?** _Empfehlung:_ Keine Zahl vorab, keine Formel aus Körpergewicht, keine
   Maximaltests. Einstiegswoche mit mehr Reserve und „Startgewicht finden“; ab Phase 4 Arbeitsgewicht aus dem
   ersten Eintrag (Epley + Wiederholungen in Reserve) und optional „eigenes Startgewicht“ (Abschnitt 5.8).
3. **Dürfen Entwürfe genutzt werden?** _Empfehlung:_ Im Testmodus ja (nur ohne roten Befund, nie Probelauf, mit
   Kennzeichnung, nur über `createLocalBackend()`); live nur `published`. Vor dem ersten Supabase-Test die 24
   Vorlagen und 52 Übungen nach eurer Durchsicht freigeben.
4. **Wochentage?** _Empfehlung:_ Wunsch-Tage haben Vorrang; zu viele → größte Abstände; zu wenige/keine → ergänzen
   bzw. Standardmuster; Ganzkörper an Folgetagen nur, wenn eure Wunsch-Tage es erzwingen (mit Hinweis). Angebrochene
   Startwoche mit weniger als der Hälfte der Einheiten = „Woche 0“.
5. **Wie weit im Voraus wird geplant?** _Empfehlung:_ Ein Block = Belastungswochen + Erholungswoche (Einsteiger
   5 + 1, sonst 4 + 1), Folgeblock automatisch aus dem Schnappschuss mit aktuellen Sicherheitsregeln. Neue
   Vorlagen-Version: Hinweis statt automatischem Wechsel.
6. **1–2 und 5–7 Tage?** _Empfehlung:_ 1–2 Tage mit Rotation der 3-Tage-Ganzkörper-Vorlage; höchstens 4
   Krafteinheiten, weitere Tage als Ruhetage mit Bewegungs-Tipp. Eigene 2- und 5-Tage-Vorlagen später per
   Content-Pipeline.
7. **Trainingsort „beides“?** _Empfehlung:_ Studio-Vorlage. Ein Schalter „heute zu Hause“ je Einheit (Tausch über
   Alternativen) kommt mit dem Tagebuch in Phase 4.
8. **Ohne Gesundheits-Check (keine Einwilligung)?** _Empfehlung:_ Vorsichtige Standardregeln wie bei
   `conservative_plan` inkl. `overhead`, mit Hinweis. Dazu in Etappe C ein Link „Gesundheits-Check wiederholen“ in
   den Einstellungen (nutzt den vorhandenen Schritt, nur mit Einwilligung).
9. **Schwangerschaft?** _Empfehlung:_ Vorsichtiger Plan ohne lange Rückenlage und deutlicher Hinweis, dass der Plan
   nicht für die Schwangerschaft entwickelt ist. Eigene Inhalte nur mit Fachperson (PLAN-PHASE-2 Frage 5).
10. **Sind Pläne Gesundheitsdaten?** _Entschieden (Wächter-Befund 1):_ Pläne, in die der Gesundheits-Check
    eingeht, behandeln wir vorsorglich als Gesundheitsdaten (`uses_health_data`, Einwilligung nötig, Löschen beim
    Widerruf, Abschnitt 9). Juristische Bestätigung in der DSFA bleibt sinnvoll, ist aber kein Blocker.
11. **Altersregeln?** _Empfehlung:_ unter 18 RPE ≤ 8 ohne Technik-Übungen; ab 65 RPE ≤ 7 ohne Sprünge und
    Technik-Übungen (Produktentscheidung, Abschnitt 5.4); strengere Regel ab dem Geburtstag sofort, Lockerung nur
    nach Bestätigung. Fachlich mit prüfen lassen.
12. **Lücke „ohne Geräte“ und „ohne Über-Kopf“ in der Übungsbibliothek?** _Empfehlung:_ Nach Etappe A einen
    `content-generate`-Lauf für Körpergewicht-Varianten von Zug und Hüftbeugen (z. B. Rudern am stabilen Tisch,
    Rückenstrecken am Boden) und eine Schulter-Übung ohne Über-Kopf-Position (z. B. Frontheben mit Band); bis dahin
    Ersatz über gemeinsamen Hauptmuskel bzw. Hinweis.
13. **„Einheit verschieben“ schon in Phase 3?** _Empfehlung:_ Ja, als einfacher Knopf; automatisches Erkennen
    verpasster Einheiten mit dem Tagebuch in Phase 4.
14. **AUSDRÜCKLICHE GRÜNDER-ENTSCHEIDUNG – vor Beginn von Etappe C nötig: Pläne mit Gesundheitsdaten auf dem
    Gerät?** _Empfehlung:_ Ja, aber nur als Zwischenspeicher für das Offline-Training – in der App verschlüsselt
    (`expo-secure-store` bzw. damit verschlüsselter Speicher), im Browser nur `sessionStorage`; gelöscht bei
    Widerruf, Abmelden, Konto löschen und sobald der Server „Plan ersetzt/fehlt“ meldet; Verschieben solcher Pläne
    wird sofort gesendet, nie in die Warteschlange gelegt. Dokumentierte Ausnahme zur Phase-1-Regel
    „Gesundheitsdaten nur im Arbeitsspeicher“ (Abschnitt 9). Alternative ohne Ausnahme: kein Offline-Plan für diese
    Personen – nicht empfohlen, weil im Studio oft kein Netz ist. **Diese Frage gilt nicht als durch die
    Vorab-Freigabe entschieden;** Claude fragt vor Etappe C ausdrücklich nach.

---

## 14. Risiken

1. **Inhalte sind KI-Entwürfe** und fachlich ungeprüft → Kennzeichnung in der App; vor dem öffentlichen Start
   fachliche Prüfung (`expert_reviewed`).
2. **Startgewicht falsch gewählt** (zu schwer) → Einstiegswoche mit mehr Reserve, klare Anleitung, vorsichtige
   Regeln, keine Maximaltests, Gewichtssprünge über 10 % nie direkt, erst nach dem Puffer.
3. **Lücken ohne Geräte / ohne Über-Kopf-Übung** → Ersatz über Hauptmuskel, Hinweis, Inhalte nachliefern
   (Frage 12).
4. **Geringer Umfang bei 1–2 Tagen oder sehr kurzen Einheiten** → ehrlicher Hinweis statt verdeckter Mängel.
5. **Gesundheitsdaten im Plan** → vorsorglich als Gesundheitsdaten behandelt (Einwilligung, Löschen beim Widerruf,
   Gerätespeicher nur als Zwischenspeicher); Restrisiko nur noch bei der juristischen Feinabstimmung (DSFA).
6. **Plan wird in der App erzeugt** und könnte manipuliert gespeichert werden → Schreiben nur über geprüfte
   `security definer`-Funktionen, Dosierung per CHECK, nur freigegebene Vorlagen/Übungen, `user_id` immer aus dem
   Login; betrifft ohnehin nur die eigene Person.
7. **Supabase-Modus ist noch nicht live erprobt** (offen seit Phase 1) → pgTAP und gemockte Tests; erster
   Live-Test nach Freigabe der Inhalte.
8. **Datums-Fehler** (Wochenwechsel, Sommerzeit, Zeitzone, Geburtstage) → reine Datumsrechnung in UTC, Tests mit
   festen Daten, Datenbank-Stichtag Europe/Berlin.
9. **Größe des Web-Exports** durch gebündelte Inhalte (ca. 0,5 MB Rohdaten) → erst bei Bedarf nachladen,
   Live-Betrieb lädt aus der Datenbank.
10. **Abgrenzung zu Phase 4/4b verschwimmt** → Progression und Deload-Regeln entstehen jetzt als Funktionen, werden
    aber erst mit Einträgen genutzt; Lastsenkung, Variation und Readiness bleiben 4b.
11. **Vorlagen-Updates** machen laufende Pläne „veraltet“ → Schnappschuss + Hinweis „neue Version verfügbar“.
12. **Widerruf löscht in Phase 4 Tagebuch mit** → ausdrücklich festgehalten (8.2), in PLAN-PHASE-4 zu lösen.

---

## 15. Entscheidung

**Status: Freigegeben mit Empfehlungen, vorbehaltlich Wächter-Prüfung, 04.10.2026.** Wächter-Prüfung Runde 1 und
Runde 2: jeweils freigegeben mit Auflagen – alle Auflagen eingearbeitet (Abschnitte 16 und 17).

Die Gründer haben vorab erlaubt, dass Claude mit den Empfehlungen aus Abschnitt 13 fortfährt – **ausgenommen
Frage 14**, die vor Etappe C ausdrücklich entschieden werden muss. Damit gilt:

1. Fallback ohne passende Vorlage: nächstbeste Vorlage mit Hinweis (Gratis), KI-Fallback nur Premium ab Phase 7
   – KONZEPT Abschnitt 4 Punkt 8 wird in Etappe A entsprechend aktualisiert.
2. Kein vorab gerechnetes Startgewicht; Einstiegswoche + „Startgewicht finden“, keine Körperdaten, keine
   Maximaltests; „eigenes Startgewicht“ für Phase 4 vorgemerkt.
3. Entwürfe nur im Testmodus (ohne roten Befund, nie Probelauf, gekennzeichnet, nur `createLocalBackend()`), live
   nur `published`.
4. Ein Plan-Block (5 + 1 bzw. 4 + 1 Wochen, ggf. davor Woche 0) mit fester Erholungswoche, Folgeblock automatisch
   aus dem Schnappschuss mit aktuellen Sicherheitsregeln.
5. Höchstens 4 Krafteinheiten pro Woche; 1–2 Tage per Rotation.
6. Vorsichtige Regeln bei `conservative_plan` (bei `injury`/`medical_clearance_recommended` auch ohne Über-Kopf),
   ohne Gesundheits-Check, unter 18 und ab 65 Jahren; strengere Regeln sofort, Lockerungen nur nach Bestätigung.
7. Pläne, in die der Gesundheits-Check eingeht, werden **vorsorglich als Gesundheitsdaten** behandelt
   (`uses_health_data` und `medical_notice` von der Datenbank selbst bestimmt, Einwilligung nötig, vollständiges
   Löschen aller solchen Pläne beim Widerruf). Gerätespeicher: offen bis zur Gründer-Entscheidung zu Frage 14.
8. Schreiben nur über geprüfte `security definer`-Funktionen; Nutzer dürfen direkt nur Datum/Status einer Einheit
   ändern.
9. Doppelte Progression: Gewichtssprung über 10 % nie direkt, erst nach dem Puffer; Auslöser „zwei Einheiten in Folge“.

Claude setzt die Etappen A bis C aus Abschnitt 12 nacheinander um, jede mit Wächter-Prüfung. Weicht eine
Wächter-Prüfung ab, wird dieser Abschnitt angepasst, bevor die betroffene Etappe beginnt.

---

## 16. Wächter-Prüfung (Runde 1) – wie die Befunde gelöst sind

| Nr. | Befund                                                       | Lösung im Plan                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Einordnung „keine Gesundheitsdaten“ hält nicht (blockierend) | Sichere Variante: `uses_health_data` (auch ohne Flag), Tausch-Codes nur aus Gerätegründen, Einwilligung beim Speichern Pflicht, Widerruf ersetzt Plan + löscht künftige Einheiten, Testmodus gleich, Tagebuch-Kaskade für Phase 4 festgehalten, Gerätespeicher als Gründer-Entscheidung mit Empfehlung und dokumentierter Ausnahme (5.1, 5.5, 8.1, 8.2, 9, Frage 10/14, Entscheidung 7) |
| 2   | Umgehbar per PostgREST (blockierend)                         | Nutzer nur `select` auf `user_plans`/`planned_exercises`; Funktionen `security definer` mit `auth.uid()`-, Besitz- und Einwilligungsprüfung, `revoke … from public, anon`; `planned_sessions` nur Datum/Status per Trigger (gleiche ISO-Woche, nicht vor heute, nur `planned` → `skipped`); `order_no` 1–8 + eindeutig (8, 8.1, 8.4)                                                    |
| 3   | `overhead` bei vorsichtigem Plan                             | Ausgeschlossen bei `injury`/`medical_clearance_recommended` und ohne Check; dokumentiert, Inhaltslücke benannt, Tests (4, 5.4, 6, 7, Frage 12)                                                                                                                                                                                                                                          |
| 4   | Strengere Flags/Altersgrenzen sofort                         | `applyCurrentSafetyRules()` beim Anzeigen und im Folgeblock; Lockerungen nur nach Bestätigung; Folgeblock aus Schnappschuss unabhängig von `published`; `block_no = max + 1` in der Datenbank (5.4, 5.10, 8.1)                                                                                                                                                                          |
| 5   | Progression: harter 10-%-Deckel                              | Sprung > 10 % nie direkt: erst `reps_max + 2` (≤ 30), dann +1 Satz (≤ 6, V9), dann Gewicht; Auslöser zwei Einheiten in Folge; Tests (5.9, 6, 7)                                                                                                                                                                                                                                         |
| 6   | Ersatz muss sicher und nicht schwerer sein                   | Jeder Ersatz in Schritt 2–5 besteht `planSafetyRules()`, `difficulty` nicht höher, `easier` bevorzugt bei Vorsicht, Pause bei Muster-/Mechanikwechsel nach `REST_RANGES_S`; Tests (5.5, 7)                                                                                                                                                                                              |
| 7   | Quellen                                                      | `MAX_STRENGTH_SESSIONS_PER_WEEK` und Altersregel ab 65 als Produktentscheidung; Erholung 48–72 h nach Garber 2011 (gegen ACSM 2009 abgleichen); PAR-Q+ nur für Flags; `high_skill` auch unter 18 ausgeschlossen (5.4, 6)                                                                                                                                                                |
| 8   | Angebrochene Startwoche                                      | Unter der Hälfte der Einheiten = „Woche 0“, zählt nicht zum Block; Test (5.7, 7)                                                                                                                                                                                                                                                                                                        |
| 9   | Datenmodell                                                  | Eindeutig je `(user_id, scheduled_on)` für nicht gestrichene Einheiten; Fremdschlüssel `on delete restrict`; `template_title_de` als Schnappschuss; `planNeedsUpdate` mit 18./65. Geburtstag (8, 10.4)                                                                                                                                                                                  |
| 10  | Selbsteinschätzung Startgewicht                              | Optionales Feld „eigenes Startgewicht“ für Phase 4 vorgemerkt, Eintrag in KONZEPT „Abweichungen ab Phase 3“ in Etappe B (3, 5.8, 12)                                                                                                                                                                                                                                                    |
| 11  | `allowDrafts` nur lokal                                      | Nur `createLocalBackend()` übergibt `true`; Test, dass es bei konfiguriertem Supabase nie `true` ist (5.2, 10.1, 12)                                                                                                                                                                                                                                                                    |
| 12  | Arzt-Hinweis vor jeder Einheit                               | Feld `medical_notice` am Plan (nur mit `uses_health_data`), offline verfügbar über den Zwischenspeicher nach Frage 14; Anzeige über jeder Einheit (5.1, 8, 10.2)                                                                                                                                                                                                                        |

Hinweis: Die Lösung zu Befund 1 („Widerruf ersetzt Plan, vergangene Einheiten bleiben“) ist durch Runde 2,
Befund 1 verschärft (vollständiges Löschen).

---

## 17. Wächter-Prüfung (Runde 2) – wie die Befunde gelöst sind

| Nr. | Befund                                                             | Lösung im Plan                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Widerruf: alle Gesundheits-Pläne vollständig löschen (blockierend) | `consents_after_revoke()` löscht alle Pläne mit `uses_health_data` (aktiv und `replaced`) samt aller Einheiten; Phase 3 ohne Tagebuch, ab Phase 4 `on delete set null` bzw. Kopie; pgTAP Test 8, Handy-Test Schritt 7, Testmodus (8.2, 8.4, 9, 11)                  |
| 2   | Datenbank bestimmt `uses_health_data`/`medical_notice` selbst      | Beide Funktionen leiten die Werte aus dem neuesten `health_screening` + gültiger Einwilligung ab, abweichende Eingabe → Ablehnung; pgTAP „`false` trotz Check → Fehler“; gleiche Regel in `local-rules.ts` (8.1, 8.4 Test 6, 9, 10.1)                               |
| 3   | `withoutHealthData()` aufteilen                                    | `applyHealthDataRevocation(rows)` und `cacheableRows(rows, { allowHealthPlanCache })`, beide mit Tests (9, 12 Etappe C)                                                                                                                                             |
| 4   | `medical_notice` bei jedem Flag                                    | `medical_notice = requiresMedicalNotice(flags)`; allgemeiner Text ohne Diagnose (5.1, 10.2, 7 Test 6)                                                                                                                                                               |
| 5   | Wirksame Sicherheitsregeln offline                                 | `safetyRules` (RPE-Deckel, Ausschluss-Merkmale, `medical_notice`) im Zwischenspeicher nach Frage 14, gelöscht bei Widerruf/Abmelden; direkt nach strengerem Check „Plan neu erstellen“; Tests (5.1, 5.4, 12 Etappe C)                                               |
| 6   | Warteschlange                                                      | Schlüssel `update_planned_session:<session_id>`; neuer Plan entfernt alte Verschiebungen ausdrücklich; `onDropped` → Plan neu laden + Meldung; Tests (10.1, 12 Etappe C)                                                                                            |
| 7   | Veraltete Einwilligungsversion                                     | „Heute“ zeigt zuerst die Neu-Einwilligung; bei Ablehnung Plan ohne Check über `save_training_plan`; pgTAP Test 9 + App-Test (8.2, 8.4, 10.2, 12 Etappe C)                                                                                                           |
| 8   | Frage 14 als Gründer-Entscheidung vor Etappe C                     | Ausdrücklich gekennzeichnet, nicht von der Vorab-Freigabe gedeckt; Empfehlung präzisiert: `expo-secure-store`/verschlüsselt, Web nur `sessionStorage`, Löschen auch bei Konto löschen und „Plan ersetzt/fehlt“ (9, 12, 13, 15)                                      |
| 9   | Verschiebe-Trigger                                                 | `original_date` nur beim ersten Verschieben (`coalesce`), ISO-Woche gegen `coalesce(original_date, scheduled_on)`; Phase 4 vorgemerkt: „gestern verpasst → `skipped`“ und Progressions-Änderungen per eigener `security definer`-Funktion; pgTAP Test 10 (8.1, 8.4) |
| 10  | `week_no` und Einstiegswoche                                       | `week_no` 0–6; Woche 0 ist die Einstiegswoche, wenn vorhanden, Woche 1 danach nicht noch einmal; Tests (5.7, 6, 7 Test 2, 8)                                                                                                                                        |
| 11  | Halteübung                                                         | Steigerung `min(5 s, max(1 s, floor(10 %)))`; Test (5.9, 6, 7 Test 10)                                                                                                                                                                                              |
| 12  | pgTAP-Liste                                                        | Ergänzt um: vollständiges Löschen beim Widerruf (Test 8), `false` trotz Check → Fehler (Test 6), veraltete Einwilligung (Test 9), `original_date`/ISO-Woche bei mehrfachem Verschieben (Test 10) (8.4)                                                              |

---

## Umsetzungsstand (04.10.2026)

**Etappe A – Plan-Engine in `packages/core`: erledigt** (wartet auf Wächter-Prüfung). Keine Migration, keine
App-Änderung (Etappen B/C).

1. **`packages/core/src/plan/`** (Export über `src/index.ts`):
   - `inputs.ts` – `planInputsSchema` (Zod, ohne Körperdaten), `planInputsSnapshot()` (Angaben ohne
     Gesundheitsdaten/Geburtsdatum, sortiert).
   - `safety.ts` – `planSafetyRules()` (Flags, ohne Check, unter 18, ab 65, Einsteiger; strengste Regel gilt),
     `isExerciseAllowed()`, `isStricter()`, `strictestRules()`; `apply-safety.ts` – `applyCurrentSafetyRules()`.
   - `content-pool.ts` – `selectPlanContent()` (live nur `published`; `allowDrafts` nur ohne roten Befund, nie
     Probelauf), `planLibraryFromContent()`.
   - `equipment-profile.ts` – `equipmentProfile()`, `isExerciseFeasible()`, `findSubstitute()` (Schritte 1–6,
     jeder Ersatz sicher und nicht schwerer, `easier` zuerst bei Vorsicht), `findHarderVariant()`.
   - `match.ts` – `scoreTemplate()`, `matchTemplate()`, `isTemplateEligible()`, `plannedSessionsPerWeek()`.
   - `adapt.ts` – `adaptTemplate()` (Tausch, RPE-Deckel, Pause bei Muster-/Mechanikwechsel, Hinweis-Codes nur aus
     Gerätegründen, `volume_reduced`, `no_pull_exercise`), `fitSessionToMinutes()`.
   - `schedule.ts` – `chooseTrainingDays()`, `buildPlanBlock()` (Woche 0/Einstiegswoche, Rotation, Erholungswoche),
     `nextPlanBlock()` (Schnappschuss + aktuelle Regeln), `baseSessionsFromBlock()`, `hasBackToBackSessions()`,
     `dosageForWeek()`.
   - `loads.ts` – `snapToAvailableWeight()`, `estimateWorkingWeight()`, `nextWeightStep()`,
     `holdIncrementSeconds()`, `nextLoad()` (doppelte Progression; Gewichtssprung über 10 % nie direkt, erst nach
     dem Puffer; Sprung > 25 % → erste Einheit RPE −1; ohne höhere Stufe Hinweis `no_heavier_weight`).
   - `deload.ts`, `reschedule.ts` (`rescheduleSession()`), `volume.ts` (`capWeeklyIncrease()`), `update.ts`
     (`planNeedsUpdate()`, `crossedAgeThreshold()`), `generate.ts` (`generateTrainingPlan()`,
     `generatedPlanSchema` = Datenbank-Grenzen aus Abschnitt 8).
2. **Konstanten** in `constants.ts` mit Quellen bzw. Kennzeichnung PRODUKTENTSCHEIDUNG (Abschnitt 6), neue
   Aufzählungen und Ziel-/Level-Zuordnung in `enums.ts`, Datums-Helfer `isoWeekday()`, `startOfIsoWeek()`,
   `daysBetween()` in `dates.ts`.
3. **Tests:** 243 Tests in `src/plan/*.test.ts` gegen den echten Startbestand und kleine feste Testdaten (alle 24
   Vorlagen werden für „ihre“ Person mit `exact` gefunden; Eigenschaftstest über 10.800 Personen mit **unabhängig
   aus den Eingaben hergeleiteten** Erwartungen: Datenbank-Grenzen, RPE-Deckel, ausgeschlossene Merkmale,
   Einsteiger-Vorlagen, `uses_health_data`/`medical_notice`, keine `conditioning`-Übungen) sowie Ergänzungen in
   `dates.test.ts` und `constants.test.ts`.
4. **Beispielpläne:** `packages/content/src/plan-examples.ts` (+ CLI, Tests), Aufruf `pnpm plan:examples`, neuer
   Schritt „Beispielpläne (Plan-Engine)“ in `ci` nach `content:validate` → 8 ausgedachte Test-Personen in der
   Summary.

**Entscheidungen beim Umsetzen (zur Wächter-Prüfung):**

1. Dateinamen: `equipment-profile.ts` statt `equipment.ts` (Verwechslung mit `src/equipment.ts`);
   `applyCurrentSafetyRules()` in eigener Datei `apply-safety.ts` (sonst zirkulärer Import); `update.ts` zusätzlich;
   die Hinweis-Codes `PLAN_NOTES` stehen in `enums.ts` (wie die übrigen späteren Postgres-Enums), `notes.ts` entfällt.
2. `chooseTrainingDays()`: bei gleichem Mindestabstand zuerst weniger Tage direkt hintereinander, dann die
   lexikografisch kleinste Auswahl (z. B. 4 Einheiten bei Wunsch Mo/Mi/Fr → Mo, Mi, Fr, Sa).
3. `fitSessionToMinutes()`: auch Schritt 1 (Isolationsübungen entfernen) hält mindestens 3 Übungen.
4. Doppelte Progression: Innerhalb des Wiederholungsbereichs genügt **eine** geschaffte Einheit für +1 Wdh.; jede
   Stufe ab `reps_max` (Puffer-Wdh., Zusatzsatz, Gewicht) braucht **zwei** in Folge. Ohne höhere eigene
   Gewichtsstufe folgt nach dem Puffer der Hinweis `no_heavier_weight`.
5. `generateTrainingPlan()` liefert zusätzlich `training_days`, `load_weeks` (für den Folgeblock), `safety_rules`
   (nur Zwischenspeicher, Abschnitt 9) und `uses_draft_content` – diese Felder werden nicht in `user_plans`
   gespeichert.
6. `applyCurrentSafetyRules()` blendet Übungen aus, deren Merkmale nicht prüfbar sind (Bibliothek fehlt).
7. `capWeeklyIncrease()` ist gebaut und getestet; da keine Vorlage `conditioning`-Übungen enthält und der Umfang
   innerhalb eines Blocks konstant bleibt, wird sie in Phase 3 noch nicht im Block-Bau angewendet (Phase 10).
8. `planNeedsUpdate()` vergleicht Zeitstempel (`user_plans.created_at` gegen `health_screening.created_at`), die
   Altersgrenzen über das Erstellungsdatum (Europe/Berlin); keine Flags nötig.

**Nachträge aus der Wächter-Prüfung von Etappe A (umgesetzt):**

1. Eigenschaftstest prüft gegen eine **feste, unabhängige Erwartungstabelle** (nicht gegen die `safety_rules` der
   Engine) und deckt zusätzlich Geburtstage (16, 17, 18, 64, 65, 95 Jahre), Schwangerschaft und Wunsch-Tage
   (`[1]`, `[6, 7]`, alle 7) ab; `adapt.test.ts` nutzt ebenfalls feste Ausschlüsse.
2. KONZEPT Abschnitt 4: Gratis-Fallback beschlossen, „Umsetzung ab Phase 3“ ergänzt.
3. Abschnitt 8.1 Punkt 2 präzisiert (alter Termin darf in der Vergangenheit liegen, neuer ≥ heute in derselben
   ISO-Woche wie `coalesce(original_date, scheduled_on)`); Tests mit Kollision am Montag der Folgewoche und mit
   fest erwartetem Ergebnis.
4. `toSavePlanPayload()` (`plan/payload.ts`) mit nur den Spalten aus Abschnitt 8; Test: nie Sicherheitsregeln,
   Schwangerschafts-Hinweis, Gesundheits-Check, Geburtsdatum. Etappe B: Eingabe-Schema `.strict()`.
5. Formulierung „harter Deckel“ ersetzt durch „Gewichtssprung über 10 % nie direkt, erst nach dem Puffer“; bei
   einem Sprung über 25 % erste Einheit RPE −1 (`firstSessionRpeTarget`); ohne höhere Stufe `no_heavier_weight`
   statt dauerhaft „gleich“ – mit Tests.
6. `generateTrainingPlan()`: unter `MIN_AGE_YEARS` → `invalid_inputs` (Test mit 15 Jahren und am 16. Geburtstag).
7. Eigenschaftstest: kein Plan enthält `conditioning`-Übungen (Erinnerung an `capWeeklyIncrease()`).
8. `planNeedsUpdate()` mit Zeitstempeln; Test „neuer Check am selben Tag“.
9. Folgeblock zählt die Rotation ab der Vorlagen-Einheit nach der letzten geplanten weiter (Test); Zustand „ohne
   Bibliothek alles ausgeblendet“ als eigener Zustand für Etappe C in 10.3 vermerkt.
10. Zusätzliche Tests mit kleinen festen Testdaten (Fixture-Bibliothek aus `content/test-fixtures.ts`) für
    Sicherheitsregeln, Ersatz und Rotation.

**Etappe B – Datenbank: erledigt** (wartet auf Wächter-Prüfung). Keine App-Änderung (Etappe C).

1. **Migrationen** `20261004120000_training_plans.sql` und `20261004120100_training_plan_rpcs.sql` (frühere bleiben
   unverändert):
   - Enums `plan_status`, `planned_session_status`, `plan_match_quality`, `plan_note`; Tabellen `user_plans`,
     `planned_sessions`, `planned_exercises` mit allen Grenzen aus Abschnitt 8 (Dosierung V4 als CHECK, `order_no` 1–8
     eindeutig je Einheit, `week_no` 0–6, Zielgewicht 0,5–500 kg, `medical_notice` nur mit `uses_health_data`, keine
     Gesundheitsschlüssel in `inputs`), eindeutiger aktiver Plan, eindeutig `(user_id, scheduled_on)` für nicht
     gestrichene Einheiten, gemeinsame Fremdschlüssel `(plan_id, user_id)` / `(session_id, user_id)`, Fremdschlüssel auf
     Vorlagen und Übungen `on delete restrict`.
   - Rechte nach 8.1: `authenticated` nur `select` auf `user_plans`/`planned_exercises`; auf `planned_sessions` `select`
     und `update (scheduled_on, status)`; Trigger `private.planned_sessions_before_update` mit allen Regeln (andere
     Spalten, gestrichen, ersetzter Plan, vergangene Woche, nicht vor heute, gleiche ISO-Woche wie
     `coalesce(original_date, scheduled_on)`, `original_date` nur beim ersten Verschieben).
   - `save_training_plan` / `append_plan_block`: `security definer`, `search_path = ''`, `revoke … from public, anon`;
     Login, Profil, Besitz, nur bekannte Felder (`private.assert_json_keys`, entspricht `.strict()`), Vorlage/Übungen
     freigegeben und Version passend, Einheiten ab gestern (1 Tag Zeitzonen-Toleranz), neuer Plan mit `block_no` 1,
     Folgeblock nur `max + 1`; `uses_health_data`/`medical_notice` bestimmt `private.plan_health_basis()` aus dem neuesten
     Check und `has_valid_consent('health_data')` – abweichende Eingabe wird abgelehnt.
   - `private.consents_after_revoke()` löscht zusätzlich alle Pläne mit `uses_health_data` vollständig.
   - Zusätzliche Lese-Regel auf `exercises`: archivierte Übungen über eigene `planned_exercises` lesbar.
2. **pgTAP:** `12_training_plans.test.sql` (52 Tests) und `13_training_plan_rpcs.test.sql` (69 Tests) mit allen Fällen
   aus 8.4, Ergänzungen in `04_account_deletion` (Pläne werden mitgelöscht, B unberührt) und `06_profile_required`
   (kein Plan ohne Profil). **Lokal geprüft** mit Postgres 16 + pgTAP und einem kleinen Supabase-Ersatz (Rollen, `auth`,
   `auth.uid()`; Skript `/var/tmp/fitness-pg/run.sh`): alle 13 Dateien, 502 Tests bestanden (Stand nach den
   Nachträgen unten).
3. **`packages/core`:** strikte Zod-Schemas `savePlanPayloadSchema`, `savePlanSessionSchema`, `savePlanInputsSchema`,
   `savePlanExerciseSchema`, `appendPlanBlockSchema` und `toAppendBlockPayload()` in `plan/payload.ts` (mit Tests);
   `db-sync.test.ts` prüft die neuen Enums, die Grenzen und dass die Feldlisten der SQL-Funktionen genau den
   Zod-Schemas entsprechen.
4. **`packages/db/src/database.types.ts`:** 3 Tabellen, 4 Enums, 2 Funktionen im gen-types-Format.
5. **Doku:** KONZEPT Abschnitt 12 „Abweichungen ab Phase 3“.

**Entscheidungen beim Umsetzen (zur Wächter-Prüfung):**

1. Statt „ignoriert eine fremde `user_id`“ lehnt `save_training_plan` jedes unbekannte Feld ab (auch `user_id`) –
   strenger und gleichbedeutend mit `.strict()`; `user_id` kommt immer aus dem Login.
2. Der Verschiebe-Trigger greift nur für die Rolle `authenticated`; geprüfte Server-Funktionen (Eigentümer) sind
   ausgenommen (Phase 4: „gestern verpasst“).
3. Einheiten dürfen beim Speichern ab gestern liegen (1 Tag Toleranz für Zeitzonen, wie `MEASURED_ON_MAX_DAYS_AHEAD`).
4. `append_plan_block` lehnt auch ab, wenn sich nur der Arzt-Hinweis geändert hat (neuer Check mit/ohne Flag) – dann
   ist ein neuer Plan nötig (strengere Regeln wirken über die Anzeige ohnehin sofort).
5. Der Test „alter Termin in der Vergangenheit“ hängt vom Wochentag ab und wird montags per `skip()` übersprungen.

**Nächster Schritt:** Gründer-Entscheidung zu Frage 14, dann Etappe C (App).

**Nachträge aus der Wächter-Prüfung von Etappe B (umgesetzt, direkt in den noch nicht gemergten Migrationen):**

1. **Kein Gesundheitsbezug in Fehlerdetails:** Die Einfüge-Schritte in `save_training_plan` und
   `private.insert_plan_sessions` (auch für `append_plan_block`) fangen CHECK-, Eindeutigkeits-, NOT-NULL-, Format- und
   Zahlenbereichs-Fehler ab und melden nur „Ungültige Werte im Plan.“ mit demselben Fehlercode, **ohne Detail**
   („Failing row contains (…)“ mit `user_id`, `uses_health_data` usw. erreicht weder App noch Log). pgTAP prüft
   Meldung und fehlendes Detail für CHECK und Index.
2. **Angaben nach Werten geprüft:** `private.assert_plan_inputs()` = `savePlanInputsSchema` (alle Felder Pflicht,
   Aufzählungen `goal_type`/`endurance_discipline`/`experience_level`/`training_location`, Tage 1–7 und Minuten 10–240
   ganzzahlig, Wunsch-Tage 1–7 höchstens 7 und eindeutig, Geräte aus dem Katalog mit höchstens 40 Gewichtsstufen
   0,25–200 kg, jedes Gerät einmal). Zusätzlich CHECK `octet_length(inputs::text) <= 4096`; Zod prüft dieselbe Grenze
   mit `jsonbTextBytes()` (Postgres-Schreibweise). Neue Konstante `PLAN_SAVE_LIMITS` in `constants.ts`.
3. **Obergrenzen:** Einheiten eines neuen Plans zwischen gestern und heute + 7 × 7 + 7 Tagen, Plan-Start zwischen
   gestern und heute + 7 und nie nach der ersten Einheit; Folgeblock nur nach der letzten Einheit des Plans (frühestens
   gestern) und höchstens 56 Tage nach der letzten Einheit bzw. nach heute. **Ersetzte Pläne:** Beim Speichern werden
   ersetzte Pläne **ohne verbleibende Einheiten** jenseits der neuesten 20 gelöscht (älteste zuerst). Pläne mit
   vergangenen Einheiten bleiben als Verlauf; weil beim Ersetzen alle Einheiten ab gestern entfallen, entsteht so
   höchstens etwa alle zwei Tage ein bleibender Eintrag – häufiges Neu-Erzeugen lässt die Tabelle nicht wachsen. Bewusst
   keine harte Sperre (sie würde Nutzer dauerhaft aussperren). Für Phase 4 vermerkt: Tagebuch-Einträge verweisen mit
   `on delete set null`, damit das Aufräumen nie Einträge mitlöscht.
4. **Deterministische Datumstests:** `private.berlin_today()` (stable, `search_path = ''`) ist die einzige Quelle für
   „heute“ in Trigger, `insert_plan_sessions`, `save_training_plan` und `append_plan_block`. Ausführbar nur für
   `authenticated` (der Verschiebe-Trigger läuft mit den Rechten des Nutzers) und `service_role`, nicht für `anon`.
   Die Tests 12/13 setzen sie innerhalb der Transaktion auf Mittwoch, 07.10.2026 (Rollback stellt das Original her);
   das `skip()` am Montag entfällt. Neue Tests: Mi → Di abgelehnt, Montags-Einheit auf heute, Sonntag als Grenze,
   „nie vor heute“ isoliert (Do → Di, Tag frei), vorgestern beim Speichern abgelehnt, gestern angenommen.
5. **Indizes** `user_plans (user_id)` und `planned_sessions (user_id, scheduled_on)`.
6. **Trigger:** Erholungseinheiten nur streichen (Test); Kommentar richtiggestellt (48 h bleibt App-Regel) und
   Ausnahmen Eigentümer/`service_role` beschrieben.
7. **RPE vor der Spaltenrundung:** `rpe_target × 2` muss ganzzahlig sein, Zielgewicht höchstens 2 Nachkommastellen –
   geprüft, bevor `numeric(3, 1)`/`numeric(5, 2)` rundet (Test: 7,49 abgelehnt).
8. **Folgeblock:** `week_no >= 1` und keine Einstiegswoche (Tests).
9. **Ersetzen:** geplante Einheiten des alten Plans ab gestern gelöscht (statt ab heute) – der neue Plan darf gestern
   belegen, ohne Kollision; ältere bleiben (Test).
10. **Lese-Regel** für Übungen über eigene Pläne gilt nur für `status = 'archived'`.
11. `private.plan_health_basis()` und `private.insert_plan_sessions()` sind **kein** `security definer` mehr (laufen
    mit den Rechten der aufrufenden Definer-Funktion); `plan_health_basis()` hat keinen Nutzer-Parameter und nutzt
    `auth.uid()` für Check **und** Einwilligung.
12. **Weitere Tests:** `medical_notice = true` ohne Flag abgelehnt; Folgeblock nach neuem Check mit bzw. ohne Flag
    abgelehnt; `anon` darf `append_plan_block` nicht ausführen; vergangene Einheiten des alten Plans bleiben beim
    Ersetzen; Löschen einer Vorlage mit Plan-Bezug scheitert; `seed_content` archiviert eine Übung aus einem
    Nutzerplan (gelingt, Übung bleibt über den Plan lesbar, andere archivierte Übungen nicht); Aufräumen ersetzter
    Pläne.
13. `db-sync.test.ts` gleicht zusätzlich `between 1 and 49` (= 7 × 7 aus `PLAN_BLOCK_LIMITS`), die Werte-Grenzen der
    Angaben, `equipment_keys` und `PLAN_SAVE_LIMITS` ab; Abschnitt 8.4 Punkt 6 an „fremde `user_id` wird abgelehnt“
    angepasst. Öffentliche Funktions-Signaturen und Spalten unverändert – `database.types.ts` bleibt gleich.
