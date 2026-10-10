# Plan: Übungs-Glossar und Übungen tauschen („Nur heute“ / „Ab jetzt immer“)

Stand: 09.10.2026 · Status: **freigegeben** (Gründer 09.10.2026: Empfehlungen übernommen; Wächter-Nachprüfung: freigabefähig, N1–N6 in T1/T2) · Herkunft:
Gründer-Wunsch vom 09.10.2026 · Wächter-Prüfung: `waechter-plan-glossar.md` (Urteil „mit Auflagen“)

**Gründer-Entscheidungen (bleiben):** Umsetzung vor Phase 4b · Tausch-Dauer bei jedem Tausch wählbar · Glossar erst
nur Text · Testmodus zuerst · bei offenen Fragen gelten die Empfehlungen aus Abschnitt 14, sofern die Gründer nichts
anderes sagen. G1 (Glossar) wird bereits parallel umgesetzt; an G1 ändern nur K1 (Pfade) und K2 (Anzahl im Test).

## 0. Wächter-Prüfung: eingearbeitet

| Befund                                                                      | Lösung                                                                                                                                                                                                                                                                                                                                                      | Abschnitt      |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **B1a** `hidden` mit falschen IDs nach Sicherheits-Ersatz                   | `hidden` und `hiddenByPreference` enthalten **immer gespeicherte** IDs. Die Präferenz-Schicht arbeitet auf Paaren (gespeichert, angezeigt). `DisplaySession` führt `storedOrderNos` parallel zu den angezeigten Übungen; `alignShownExercises` nutzt sie. Pflicht-Test „A → X per Sicherheit, X `not_feasible` ohne Kandidat, Mitte der Einheit“            | 7.3.1, 7.4     |
| **B1b** Sicherheitshinweis durch Präferenz ausgelöst                        | Eigenes Feld `hiddenByPreference`. `t.plan.hiddenExercises` nur bei `hidden` (Sicherheit); eigener neutraler Text für Präferenzen. Zuordnung über die Vereinigung. Test                                                                                                                                                                                     | 7.3.1, 8.2     |
| **B2** Bezugsübung unklar                                                   | Präferenz hängt an der **angezeigten** Übung. Kandidaten: Muster der gespeicherten Übung (bei Stufe-5-Ersatz: Muster der gespeicherten **oder** angezeigten Übung plus gemeinsamer Hauptmuskel mit der gespeicherten), Schwierigkeit ≤ **min(gespeichert, angezeigt)**. Schicht bekommt die gespeicherte Übung als Eingabe                                  | 4.0, 4.1, 7.2  |
| **B3** Day-Swaps ohne Core-Logik, erst beim Start geprüft                   | Core `applyDaySwaps(display, swaps, ctx)` **im** Anzeigeweg nach den Präferenzen, bei **jeder** Anzeige neu geprüft, ungültige fallen still weg (und werden zum Aufräumen gemeldet). Markierung `day_swap`. PDF ohne Day-Swaps                                                                                                                              | 5.1, 7.2, 7.3  |
| **B4** `strictestRules(plan, aktuell)` ohne Eingang; Lockerung über „immer“ | Neue Core-Funktion `planFloorRules(plan, birthDate)` rekonstruiert die Mindest-Regeln des gespeicherten Plans aus seinen Spalten. Kandidaten-Regeln = `strictestRules(aktuell, planFloorRules)` für **beide** Modi. Lockerungen machen damit über keinen Tausch etwas zugänglich, bis der Plan neu erstellt ist (= Bestätigung nach PLAN-PHASE-3 5.4). Test | 4.1 (S-2), 4.5 |
| **S1** zwei Kandidaten-Funktionen                                           | `allowedAlternatives` wird dünner Mantel um `swapCandidates(mode: 'today')`, Gleichheitstest; bewusste Verhaltensänderung im Trainingsmodus mit eigenem Snapshot                                                                                                                                                                                            | 4.3, 7.3       |
| **S2** `findHarderVariant` ohne `exclude`                                   | `HarderVariantContext.exclude` neu, nächste erlaubte Variante; Variant-Zweig filtert Ausschlüsse. Test „schwerere Variante von Y ist die ausgeschlossene A“                                                                                                                                                                                                 | 4.3, 7.4       |
| **S3** V9 ungenau                                                           | V9 wendet **nur** die Präferenz-Schicht an (nicht die Sicherheitsstufe), je Einheit mit **eigenem** Ort. Ohne Präferenzen identisch (Regressionstest)                                                                                                                                                                                                       | 4.3            |
| **S4** mehrdeutiger Ort                                                     | `sessionLocationInfo()` liefert `ambiguous`. Dialog fragt dann den Ort ab; Anzeige wendet bei mehrdeutigen Einheiten die Präferenzen **beider** Orte an. Test                                                                                                                                                                                               | 4.4, 8.2       |
| **S5** Day-Swap-Speicher                                                    | `ownerUserId`, Zod beim Lesen, Schlüssel in `STORAGE_KEYS`, Verfall am **aktuellen** `scheduled_on`, `storedExerciseId`/`planId` geprüft, Aufräumen beim Widerruf `health_data`                                                                                                                                                                             | 5.1, 9         |
| **S6** pgTAP „Archivieren scheitert“ falsch                                 | Archivieren klappt, Präferenz wird ignoriert (S-8); nur DELETE wird blockiert; Redaktions-Doku                                                                                                                                                                                                                                                              | 5.3, 10        |
| **S7** RLS für Ersatz                                                       | `replacement_exercise_id` nur `published`; `local-rules`: Entwurf ohne roten Befund                                                                                                                                                                                                                                                                         | 5.2, 9         |
| **S8** Supersätze                                                           | Ersatz übernimmt `superset_group`; Ein-Mitglied-Gruppe verhält sich wie Einzelübung (Test Pausen-Timer/Runden); `rest_s`-Klemmung                                                                                                                                                                                                                           | 4.3, 7.4       |
| **S9** leere Einheit                                                        | Eigener Zustand `emptyByPreference`: Training starten deaktiviert, Hinweis + „Ausschlüsse ansehen“; fester Teil des Eigenschaftstests                                                                                                                                                                                                                       | 7.3.1, 8.2     |
| **S10** Ausdauer/Beweglichkeit                                              | `applyExercisePreferences` bei `kind !== 'strength'` unverändert (Test). „Tauschen“ an **jeder** Übung einer Kraft-Einheit, alle Muster (gleiche Regeln)                                                                                                                                                                                                    | 4.6, 7.2       |
| **S11** fehlende Tests                                                      | alle elf Fälle in 7.4 aufgenommen                                                                                                                                                                                                                                                                                                                           | 7.4            |
| **K1** Pfade                                                                | `apps/mobile/src/app/uebungen/…`                                                                                                                                                                                                                                                                                                                            | 8.1            |
| **K2** „79“ im Test                                                         | Test auf die geladene Anzahl                                                                                                                                                                                                                                                                                                                                | 7.1            |
| **K3** Obergrenze bei gleichzeitigen Inserts                                | `pg_advisory_xact_lock(hashtext(user_id::text))` im Trigger                                                                                                                                                                                                                                                                                                 | 5.2            |
| **K4** „Rückgängig 10 s“                                                    | Kein Zeitlimit: bleibt bis zur nächsten Aktion bzw. bis die Karte verlassen wird; Ansage verweist auf Einstellungen                                                                                                                                                                                                                                         | 8.2            |
| **K5** „Ehrlich gesagt“                                                     | Seitenwechsel einseitig/beidseitig, andere Nebenmuskeln, V10 nicht neu geprüft                                                                                                                                                                                                                                                                              | 1              |
| **K6** `exerciseMark`-Reihenfolge                                           | Präferenz/Day-Swap-Prüfung **vor** „nicht gespeichert → `adjusted`“; Zuordnung über `storedOrderNo`; Doku                                                                                                                                                                                                                                                   | 7.3            |
| **K7** PDF kommentarlos                                                     | Neutraler Druckhinweis „1 Übung ausgelassen (deine Wahl)“ für `hiddenByPreference`; Wächter-B1 (PDF) unberührt                                                                                                                                                                                                                                              | 7.3            |
| **K8** `export_my_data`                                                     | `create or replace` aus `20261006120200`, Regressionstest auf alle bisherigen Schlüssel                                                                                                                                                                                                                                                                     | 5.2            |
| **K9** DSGVO                                                                | Ergänzt: kein KI-Coach ohne neue Bewertung, nie „kann ich nicht“, Restrisiko in KONZEPT 15/DSFA-Merkposten                                                                                                                                                                                                                                                  | 6              |

## 1. Ziel in einfachen Worten

1. **Übungs-Glossar:** Zu jeder Übung zeigt die App, wie sie geht: Beschreibung, Schritt für Schritt, Tipps, häufige
   Fehler und den Sicherheitshinweis. Das Glossar hat eine eigene Seite mit Suche und Filtern. Außerdem ist es mit einem
   Tipp erreichbar aus Plan, „Heute“, Trainingsmodus und Verlauf. **Entscheidung:** In dieser Etappe nur Text aus den
   vorhandenen Feldern. Bilder und Videos kommen in einer späteren Etappe (G2).
2. **Übungen tauschen:** Wer eine Übung nicht machen kann oder nicht mag, tippt auf „Tauschen“ und bekommt passende
   Alternativen. Bei jedem Tausch wählt man:
   - **„Nur heute“** (bei einem späteren Termin: „Nur bei diesem Training“) – einmalig, wie das heutige „Alternative
     durchgeführt“.
   - **„Ab jetzt immer (zu Hause / im Studio)“** – die App merkt sich die Übung für diesen Ort als **„Mag ich nicht“**
     oder **„Hier nicht machbar“**. Sie zeigt sie dort nicht mehr: nicht im laufenden Plan, nicht in Folgeblöcken,
     nicht in neuen Plänen.
3. **Testmodus zuerst (Gründer-Entscheidung):** Alles läuft vollständig ohne Supabase. Die Supabase-Teile (Migration,
   RLS, pgTAP) sind hier fertig geplant, kommen aber in einer eigenen, späteren Etappe.

**Ehrlich gesagt:**

- Ein Tausch ist immer „gleichwertig oder leichter“, nie schwerer. Wer viele Übungen ausschließt, bekommt einen
  einseitigeren Plan. Gibt es keine sichere gleichwertige Übung, sagt die App das offen und tauscht nicht.
- Ein Tausch kann von beidseitig zu einseitig wechseln (oder umgekehrt). Dann dauert die Übung anders lang und das
  Volumen je Seite ändert sich. Die Ersatz-Übung kann andere Nebenmuskeln treffen.
- Die Untergrenze des Wochenumfangs (V10) wird beim Anzeigen **nicht** neu geprüft. Sie gilt für den gespeicherten
  Plan; viele Ausschlüsse können den angezeigten Umfang darunter drücken (Hinweise 4.2).

## 2. Ist-Stand (geprüft am 09.10.2026)

- **Inhalte:** derzeit 79 Übungen in `content/exercises/*.json` mit `name_de`, `aliases_de` (≤ 5), `description_de`
  (30–600 Zeichen), `steps_de` (2–8), `tips_de` (1–6), `common_mistakes_de`, `safety_note_de`, `caution_tags`,
  `equipment_ids`, `movement_pattern`, `alternatives` (Grund `other_equipment|easier|harder|home`, Priorität),
  `difficulty`, `load_type`. Die meisten sind **Entwürfe** (`status: draft`, `expert_reviewed: false`). Regel **Ü4**
  (rot): Alternativen haben dasselbe Bewegungsmuster.
- **Bibliothek in der App:** `PlanLibrary` (`plan/content-pool.ts`). Im Testmodus sind Entwürfe mitgebündelt. Im
  Supabase-Modus nur `published`; archivierte Übungen nur in `displayExercises`. Der Zwischenspeicher
  (`libraryToCache`) enthält **ganze** Übungen samt Texten, das Glossar geht also offline.
- **Tausch-Logik (`plan/equipment-profile.ts` `findSubstitute()`):** Stufe 1 ist die Übung selbst, Stufe 2 die
  Alternativen (bei vorsichtigem Plan `easier` zuerst), Stufe 3 die Alternativen der Alternativen, Stufe 4 gleiches
  Muster + gemeinsamer Hauptmuskel, Stufe 5 nur gemeinsamer Hauptmuskel. Immer gilt: erlaubt nach
  `isExerciseAllowed()`, machbar, `difficulty` ≤ Original, kein Tausch Wiederholung ↔ Halten, `exclude`.
- **Anzeige:** `prepareSessionForDisplay()` (`plan/view.ts`) ruft `applyCurrentEnduranceRules()` und
  `applyCurrentSafetyRules()` auf (Ersatz oder Ausblenden, `hidden`/`replaced`; `hidden` enthält **gespeicherte**
  IDs, die Übungen werden danach neu nummeriert, ohne Rückbezug). Diese Funktion ist der **einzige Weg** für Heute,
  Woche, Trainingsmodus (`data/workout-session.ts` → `planWorkout()`) und PDF (`export/training-plan-document.ts`).
  `exerciseMark()` kennt `equipment_swap | adjusted | null`; „nicht in gespeicherter Einheit“ ergibt sofort
  `adjusted`. `alignShownExercises()` (`log/workout.ts`) ordnet die angezeigten den gespeicherten Übungen über die
  `hidden`-Liste zu (k-te angezeigte = k-te nicht ausgeblendete gespeicherte).
- **`SessionCard`** (`components/plan.tsx`) zeigt bei `hidden.length > 0` den Hinweis `t.plan.hiddenExercises`
  („… nach deinen aktuellen Angaben nicht passt. Bitte erstelle den Plan neu.“).
- **Trainingsmodus:** `allowedAlternatives()` ist schon „Nur heute“: nur direkte `alternatives`, Schwierigkeit gegen
  die **angezeigte** Übung, kein Muster-Check, Variant-Zweig am Ende. Der Eintrag bekommt den Status `alternative`
  (`exerciseLogStatusFor`), die Alternative hat einen eigenen Verlauf je `exercise_id` (R2).
  `progressHintForDisplay()`/`findHarderVariant()` (Kontext ohne `exclude`) schlagen die schwerere Variante nur mit den
  aktuellen Regeln vor. `extraSetAllowed()` (V9) zählt die **gespeicherten** Übungen der Woche.
- **Sicherheitsregeln:** `strictestRules(a, b)` existiert in `plan/safety.ts`, wird in der App aber nicht genutzt. Die
  Regeln beim Erzeugen werden **nie** gespeichert; rekonstruierbar sind nur `uses_health_data`, `medical_notice`,
  `created_at`, `inputs` (siehe `planStartGroup`). PLAN-PHASE-3 5.4: strengere Regeln sofort, **Lockerungen nur nach
  Bestätigung** („Plan neu erstellen“).
- **Gerätespeicher:** `clearDeviceData` löscht nur Schlüssel aus `STORAGE_KEYS` (`data/kv.ts`) plus Entwürfe.
- **Supersätze:** `superset_group` wird von `log/rest-timer.ts` ausgewertet (keine Pause innerhalb der Gruppe, Runden).
- **Datenbank:** `planned_exercises` ist für `authenticated` **nur lesbar** (Schreiben nur über
  `save_training_plan`/`append_plan_block`). Der Verschiebe-Trigger erlaubt nur `scheduled_on`/`status`.
  `exercise_start_weights` ist die bewusste Ausnahme W14 (direkt per PostgREST, eigene Zeilen, Profil Pflicht). Zum
  Vergleich: `food_preference_kind` trennt schon `dislike` von `intolerance` (Gesundheit).
- **Es gibt keine eigene Plan-Seite.** „Plan“ ist die `SessionCard` – sie wird **nur auf „Heute“** genutzt (heutige
  Einheit bzw. der in der Wochenübersicht auf „Heute“ gewählte Tag). „Woche“ (`app/week.tsx`) zeigt nur Status und
  Summen aus dem Tagebuch, „Fertig“ nur Vorlage und Güte. Dazu kommt die Druckansicht `plan/drucken`. (Korrigiert bei
  der Umsetzung von G1; vorher stand hier „Heute, Woche und Fertig“.)

## 3. Umfang und Nicht-Umfang

### 3.1 Im Umfang

- Glossar-Liste `/uebungen` mit Suche (Name, Aliasse, englischer Name; Umlaute tolerant) und Filtern (Bereich,
  Ausrüstung/Ort, Schwierigkeit). Detailseite `/uebungen/[exerciseId]`.
- Links ins Glossar: Übungsname in der `SessionCard` (nur „Heute“, siehe Ist-Stand), „Alle Übungen“ auf Heute und
  Woche, Trainingsmodus (aufklappbar „So geht's“,
  ohne den Bildschirm zu verlassen), Verlauf je Übung, Verlaufs-Eintrag, Einstellungen.
- „Tauschen“ an **jeder Übung einer Kraft-Einheit** in der `SessionCard` und im Trainingsmodus (erweitert
  „Alternative durchgeführt“), siehe 4.6.
- Präferenzen „Mag ich nicht“ / „Hier nicht machbar“ je Ort. Sie wirken auf Anzeige, Trainingsmodus, PDF, Folgeblöcke
  und neue Pläne.
- Einstellungen: Liste „Ausgeschlossene Übungen“ mit Ort, Grund und „Wieder zulassen“.
- Testmodus vollständig. Supabase vollständig geplant (Etappe T3).

### 3.2 Nicht im Umfang

- Bilder, Videos, Animationen (Etappe G2, eigener Plan: Quelle/Lizenz, Storage, Alt-Texte, Untertitel).
- **Gesundheitliche Gründe** („tut weh“, „Knie“) als Tausch-Grund – bewusst nicht (Abschnitt 6).
- Freitext-Begründung beim Tausch.
- Schwerere Übungen dauerhaft einsetzen („Ab jetzt immer“ nur gleichwertig/leichter; schwerer bleibt der
  Progressions-Weg über `harder_variant`). Auch „Nur heute“ **vor** dem Training (Heute/Woche) nur gleichwertig oder
  leichter; die schwerere Variante gibt es nur im Trainingsmodus wie heute.
- Tausch von Ausdauer-Einheiten (Modalität), Tausch ganzer Einheiten, Umsortieren.
- Neue Plan-Vorlagen, anderes Vorlagen-Matching wegen Präferenzen.
- Öffentliches Glossar ohne Anmeldung / Landingpage (später, erst nach Fachprüfung der Texte).
- KI-Erklärungen (Premium, Phase 11). Präferenzen gehen auch nicht an den späteren KI-Coach (Abschnitt 6, D-5).

## 4. Fachregeln für den Tausch (Sicherheit zuerst)

**Rangfolge (fest, im Code und in Tests):**

1. Sicherheitsregeln (Merkmale, RPE-Deckel, Schwangerschaft, Alter, vorsichtiger Plan)
2. Machbarkeit am Ort (Geräte, „Hier nicht machbar“)
3. „Mag ich nicht“
4. „Nur heute“ (Day-Swap bzw. Alternative im Trainingsmodus)
5. Vorlage

Eine Präferenz oder ein Day-Swap kann **nie** eine gesperrte Übung zurückbringen oder etwas Schwereres einsetzen.

### 4.0 Begriffe: gespeicherte und angezeigte Übung (Wächter B2)

- **Gespeichert (S):** `planned_exercises.exercise_id` des Termins, eindeutig über `order_no` (`storedOrderNo`).
- **Angezeigt (X):** die Übung nach der Sicherheitsstufe (`applyCurrentSafetyRules`). Ohne Sicherheits-Ersatz ist X = S.
- **Die Präferenz hängt an der angezeigten Übung X.** Wer „Tauschen“ an X tippt und „immer“ wählt, speichert
  `exercise_id = X`. Damit wirkt die Präferenz überall, wo X angezeigt wird – auch wenn X dort Vorlagen-Übung ist.
  Eine Präferenz auf S wirkt nicht, solange die Sicherheitsregel S durch X ersetzt (S wird ohnehin nicht gezeigt); sie
  bleibt gespeichert und wirkt wieder, sobald S wieder angezeigt wird (z. B. nach „Plan neu erstellen“).
- **Die Kandidaten werden immer gegen S und X geprüft** (4.1 S-1, S-3). Die Präferenz-Schicht bekommt deshalb das Paar
  (S, X) als Eingabe, nie nur die angezeigte Einheit.

### 4.1 Wer ist eine erlaubte Alternative? (`swapCandidates()`, gilt für „Nur heute“ und „Immer“)

Eingabe ist immer das Paar (S, X). Ein Kandidat muss **alle** Punkte erfüllen:

- **S-1 Muster:** gleiches `movement_pattern` wie S. Ü4 garantiert das schon für `alternatives`; die Engine prüft es
  trotzdem ausdrücklich.
  - **Sonderfall Stufe-5-Ersatz** (`pattern(X) ≠ pattern(S)`, die Sicherheitsstufe hat nur über den gemeinsamen
    Hauptmuskel ersetzt): Dann gibt es in der Regel keinen erlaubten Kandidaten mit dem Muster von S mehr. Zulässig ist
    deshalb das Muster von S **oder** von X, und der Kandidat muss mindestens einen Hauptmuskel mit S teilen (wie
    `findSubstitute` Stufe 5). So bleibt der Bezug zur geplanten Übung erhalten. Test.
- **S-2 Erlaubt:** `isExerciseAllowed(candidate, swapRules)` mit
  `swapRules = strictestRules(ctx.rules, planFloorRules(plan, birthDate))` (Abschnitt 4.5). Damit greifen Merkmale aus
  vorsichtigem Plan, Schwangerschaft (`PREGNANCY_EXCLUDED_CAUTION_TAGS`, z. B. `long_supine`), unter 18 und ab 65 –
  und Lockerungen öffnen nichts.
- **S-3 Nicht schwerer:** `difficulty` ≤ **min(difficulty(S), difficulty(X))**. Bezug ist nie ein früherer
  Präferenz-Ersatz – eine Kette A→B→C wird nicht schleichend schwerer, und ein vorsichtiger (leichterer)
  Sicherheits-Ersatz wird per Tausch nicht wieder schwerer.
  - Ausnahme nur bei „Nur heute“ **im Trainingsmodus**: die schon vorgeschlagene schwerere Variante aus
    `progressHintForDisplay()`, wie heute. Sie beachtet W8 (Einsteiger/vorsichtig höchstens +1 Stufe) und S-2, S-5, S-7.
- **S-4** Gleiche Belastungsart wie S: Wiederholung ↔ Halten (`load_type === 'time'` gleich).
- **S-5** Machbar mit dem Geräte-Profil **des Orts der Einheit** (4.4).
- **S-6** Nicht schon in derselben (angezeigten) Einheit.
- **S-7** Nicht selbst an diesem Ort ausgeschlossen („Mag ich nicht“ / „Hier nicht machbar“); bei mehrdeutigem Ort
  an keinem der beiden Orte (4.4).
- **S-8** Nur aus `library.exercises` (Engine: live nur `published`, Testmodus Entwürfe ohne roten Befund), nie aus
  `displayExercises` (archiviert).

**Reihenfolge:**

1. `alternatives` von S nach Priorität (bei vorsichtigem Plan `easier` zuerst, wie `findSubstitute`), danach die von X,
   falls X ≠ S
2. Alternativen der Alternativen
3. Bibliothek mit gleichem Muster und gemeinsamem Hauptmuskel, sortiert nach `findSubstitute`-Rang

Höchstens `SWAP_RULES.maxCandidates = 6` Vorschläge. Bei Gleichstand entscheidet die ID (deterministisch).

### 4.2 Mindestanforderungen je Einheit

- Weil nur innerhalb desselben Musters getauscht wird, behält jede Einheit ihre Grundbausteine. Das gilt vor allem für
  Körpergewicht-Einheiten mit **Rudern (`horizontal_pull`) und Hüftbeugen (`hinge`)** (PLAN-KOERPERGEWICHT §4/W7) und
  den Rumpf.
- **„Ab jetzt immer“ wird nur angeboten, wenn es am Ort heute mindestens einen Kandidaten gibt.** Sonst steht da:
  „Für diese Übung gibt es hier gerade keine gleichwertige Alternative.“ Angeboten werden dann nur „Heute auslassen“
  (= „Nicht gemacht“, nur im Trainingsmodus) und bei Geräte-Gründen „Geräte anpassen“ (Einstellungen → Angaben ändern).
- Fällt der Kandidat **später** weg (neue Sicherheitsregel, Inhalt archiviert, weitere Ausschlüsse):
  - **„Mag ich nicht“ ist eine weiche Regel.** Die angezeigte (sichere, machbare) Übung X bleibt stehen, mit Hinweis
    „Keine passende Alternative – diese Übung bleibt vorerst in deinem Plan.“
  - **„Hier nicht machbar“ ist eine harte Regel**, wie ein fehlendes Gerät. Die Übung wird ausgeblendet
    (`hiddenByPreference`, gespeicherte ID), mit Hinweis „Übung entfällt hier – keine machbare Alternative. Ausschluss
    aufheben oder Geräte anpassen.“ Ist sie die **letzte** Zug- oder Hüftbeuge-Übung der Einheit, zeigt der Hinweis das
    ausdrücklich („Dieser Einheit fehlt jetzt eine Rücken-Übung“). Das ist derselbe Gedanke wie `no_pull_exercise`,
    aber nur zur Anzeige.
  - Blenden „Hier nicht machbar“-Ausschlüsse **alle** Übungen einer Kraft-Einheit aus, gilt der eigene Zustand
    `emptyByPreference` (7.3.1, 8.2), nie eine stumme leere Einheit.
- **Viele Ausschlüsse:** Ab 10 Ausschlüssen an einem Ort erscheint der Hinweis „Du hast viele Übungen ausgeschlossen –
  dein Plan wird einseitiger.“ Technische Obergrenze: 100 je Person (`EXERCISE_PREFERENCE_LIMITS`).

### 4.3 Folgen für Dosierung, Progression, Startgewicht, Tagebuch, Supersätze

- **Dosierung kommt aus dem Termin:** Sätze, Wdh.-Bereich bzw. Dauer und RPE-Ziel (gedeckelt). Die Pause wird bei
  geändertem Muster bzw. Mechanik (gegenüber X) in `REST_RANGES_S` geklemmt, wie in `applyCurrentSafetyRules`.
- **Supersätze (Wächter S8):**
  - Der Ersatz übernimmt `superset_group` der ersetzten Übung.
  - Eine `not_feasible`-Ausblendung kann eine Gruppe mit nur einem Mitglied zurücklassen. Die bleibt unverändert
    stehen; `rest-timer.ts` behandelt sie wie eine Einzelübung (keine nächste Übung derselben Gruppe → normale Pause,
    keine Runden). Dafür gibt es einen eigenen Test für Pausen-Timer und Rundenreihenfolge.
  - `rest_s`-Klemmung wie oben.
- **Eigener Verlauf je Übung (R2 bleibt):**
  - Die Ersatz-Übung hat ihre eigene Progression. Ohne eigene Einträge startet sie mit „Startgewicht finden“ bzw. dem
    eigenen Startgewicht (`exercise_start_weights`).
  - **Kein Übertragen von Gewichten** von der alten Übung: andere Übung, andere Last, Sicherheitsgründe.
- **Tagebuch:**
  - Der Eintrag hat den Status `alternative` und `planned_exercise_id` der **gespeicherten** Übung (über
    `storedOrderNo`). Das ist genau wie heute beim Sicherheits-Ersatz; der Server verlangt „gleiche Übung ⇔ `done`“
    und prüft den Alternativen-Graph nicht – Kandidaten aus Stufe 3 werden angenommen.
  - Die Historie der alten Übung bleibt unverändert sichtbar (Verlauf je Übung).
  - Kommt die alte Übung nach dem Aufheben zurück, greift bei mehr als 28 Tagen Pause `RETURN_AFTER_PAUSE`.
- **`referenceDosage()`** arbeitet weiter mit der gespeicherten ID, also gleiche Vorlagen-Satzzahl.
- **`extraSetAllowed()` (V9, Wächter S3):** Entscheidung: V9 wendet **nur die Präferenz-Schicht** auf die
  gespeicherten Übungen der Woche an (Paar (S, S), ohne Sicherheitsstufe und ohne Day-Swaps), jede Einheit mit
  **ihrem eigenen** Ort (`sessionLocationInfo` je Einheit, gemischte Heim-/Studio-Wochen). Ohne Präferenzen ist das
  Ergebnis damit identisch zu heute (Regressionstest). Bewusste Grenze: Eine Präferenz auf einen Sicherheits-Ersatz X
  wirkt in V9 nicht; V9 zählt dann wie heute die gespeicherte Übung (gleiches Muster, in der Regel gleiche Muskeln).
- **`progressHintForDisplay()` / `findHarderVariant()` (Wächter S2):** `HarderVariantContext` bekommt
  `exclude?: ReadonlySet<string>` (Ausschlüsse des Orts ∪ Übungen der Einheit); `findHarderVariant` überspringt
  ausgeschlossene und nimmt die nächste erlaubte `harder`-Variante oder keine. Typischer Fall: Y ist die
  `easier`-Alternative von A, A ist ausgeschlossen, die schwerere Variante von Y ist A → kein Vorschlag A.
- **`allowedAlternatives()` (Wächter S1):** wird ein dünner Mantel um `swapCandidates(pair, { mode: 'today', … })`.
  Heute und Trainingsmodus zeigen damit dieselbe Liste, ein Day-Swap wird beim Start nie abgelehnt. Der Variant-Zweig
  filtert Ausschlüsse ebenfalls. **Bewusste Verhaltensänderung** im Trainingsmodus (auch ohne Präferenzen): Muster wird
  geprüft, Stufe 2–3 kommen hinzu, Schwierigkeit gegen min(S, X), Regeln mit `planFloorRules` (4.5). Dafür ein eigener
  Snapshot-Test „Alternativen vorher/nachher“ über alle Vorlagen; die übrige Regression („ohne Präferenzen identisch“)
  bleibt streng.

### 4.4 Ort (Wächter S4)

- Präferenzen gelten **je Ort** (`equipment_location`: `home` | `gym`; „beides“ zählt als Studio, wie das
  Geräte-Profil).
- Neue Core-Funktion `sessionLocationInfo(session, schedule, ctx)` → `{ location, ambiguous }`. `sessionLocation()`
  bleibt unverändert (ruft sie auf). `ambiguous = true`, wenn der Ort nicht aus festen Tagen oder einem einzigen
  Kraft-Ort folgt, sondern aus der Fassung geraten wird („Tage egal“ mit beiden Orten, verschobener Tag ohne Eintrag).
- **Bei mehrdeutigem Ort:**
  - Machbarkeit (S-5) prüft mit dem Profil des geratenen Orts (wie heute).
  - Die Anzeige wendet die Präferenzen **beider** Orte an (Vereinigung; bei Konflikt gilt `not_feasible` vor
    `dislike`; gewählter Ersatz zuerst aus dem Eintrag des geratenen Orts). Begründung: Wir wissen nicht, wo die Person
    trainiert; eine Präferenz ist keine Sicherheitsregel, mehr Ausschluss ist die vorsichtige Richtung.
  - Der Tausch-Dialog fragt bei „immer“ den Ort ab: „Wo trainierst du diese Einheit?“ (zu Hause / im Studio),
    vorausgewählt nichts. Gespeichert wird für den gewählten Ort.
- Test: „Tage egal“ mit beiden Orten, alle Übungen heim-machbar, Präferenz nur im Studio → wirkt trotzdem; Dialog
  verlangt die Ortswahl.

### 4.5 Welche Sicherheitsregeln gelten beim Tausch? (Wächter B4)

- **Problem:** Die Regeln beim Erzeugen werden nie gespeichert. „plan“ in `strictestRules(plan, aktuell)` hatte
  keinen Eingang.
- **Neue Core-Funktion `planFloorRules(plan: PlanStartGroupSource, birthDate): PlanSafetyRules`** (neben
  `planStartGroup` in `plan/start-group.ts`). Sie rekonstruiert die **Mindest-Regeln**, mit denen der gespeicherte Plan
  erstellt wurde, nur aus Plan-Spalten und Geburtsdatum:
  - `uses_health_data = false` (ohne Check) → Regeln wie `conservative_plan` **einschließlich** `overhead`
    (PLAN-PHASE-3 5.4, Zeile „kein Gesundheits-Check“).
  - `medical_notice = true` → dieselben Regeln **plus `long_supine`**: Welche Flags galten, ist nicht gespeichert;
    eine Schwangerschaft ist nicht auszuschließen. Vorsichtige Annahme.
  - Alter am Erstellungstag unter 18 → `high_skill`, RPE 8; ab 65 → `high_impact`, `high_skill`, RPE 7.
  - Unlesbare Angaben bzw. Datum → **strengste** Regeln (anders als `planStartGroup`: hier dient der Wert als
    Einschränkung, nicht als Vergleich – die strenge Richtung ist die sichere).
  - Rein, deterministisch, mit Grenzfall-Tests (Geburtstag am Erstellungstag, 16/17/18/64/65 Jahre).
- **Kandidaten-Regeln:** `swapRules = strictestRules(ctx.rules, planFloorRules(plan, birthDate))`. Die App berechnet
  nichts selbst; `DisplayContext` bekommt `swapRules` aus einer Core-Hilfsfunktion `displaySwapRules(plan, birthDate,
rules)`. Gilt für **alle** Kandidaten-Prüfungen: „Nur heute“ (Heute/Woche und Trainingsmodus), „immer“, gewählter
  Ersatz bei jeder Anzeige, Day-Swaps, `findHarderVariant`.
- **`applyCurrentSafetyRules` bleibt bei `ctx.rules`** (unverändert). `planFloorRules` wirkt nur auf die Auswahl von
  Kandidaten – sonst würde sich die Anzeige ohne Präferenzen ändern.
- **Entscheidung zu Lockerungen:** Eine Lockerung (Schwangerschaft beendet, Flag entfällt, 18. Geburtstag) macht über
  **keinen** Tausch – weder „Nur heute“ noch „Ab jetzt immer“ – eine Übung zugänglich, die die Mindest-Regeln des
  laufenden Plans ausschließen. Erst „Plan neu erstellen“ (= Bestätigung nach PLAN-PHASE-3 5.4) hebt die Untergrenze
  an. Das deckt sich mit 5.4: Lockerungen ändern einen laufenden Plan nie automatisch, auch nicht dauerhaft über eine
  Präferenz.
- **Bekannte Folge:** Personen mit `medical_notice` (jedes Gesundheits-Flag) bekommen auch nach „Plan neu erstellen“
  keine `long_supine`-Übungen als Tausch-Kandidat, solange ein Flag besteht. Ihre gespeicherten Übungen bleiben
  unberührt. Das ist vorsichtig und gewollt; der Echte-Inhalte-Snapshot (7.4) zeigt, wo dadurch „immer“ nicht
  angeboten wird. Gründer-Frage 12. Ebenso (Wächter N5): Pläne mit **beliebigem** Flag (z. B. nur Schwangerschaft)
  bekommen keine Überkopf-Übungen (`overhead`) als Tausch-Kandidat, auch wenn sie im Plan stehen dürfen.
- **Tests:** Plan in der Schwangerschaft erstellt, danach Check ohne Schwangerschaft → Glute Bridge erscheint nicht als
  Kandidat (heute und immer); nach „Plan neu erstellen“ ohne Flag → erscheint. 17-Jähriger Plan, 18. Geburtstag →
  `high_skill` bleibt gesperrt bis „Plan neu erstellen“. Strengere aktuelle Regel → wirkt sofort.

### 4.6 Wo wird „Tauschen“ angeboten? (Wächter S10)

- An **jeder Übung einer Kraft-Einheit** (`kind === 'strength'`), egal welches Muster (auch `core_*`, `carry`,
  `conditioning`, `mobility`). Die Regeln S-1 bis S-8 sind musterunabhängig; ohne Kandidaten greift 4.2.
- Nicht an Ausdauer-Einheiten (Modalität) und nicht an Aufwärmen/Abwärmen-Texten. `applyExercisePreferences` und
  `applyDaySwaps` geben Einheiten mit `kind !== 'strength'` unverändert zurück (Test).
- Nur an geplanten, nicht erledigten Terminen (`status === 'planned'`).

## 5. Datenmodell

### 5.1 Präferenz (Core-Typ, später Tabelle `exercise_preferences`)

| Feld                       | Typ                                          | Regel                                                                                      |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `user_id`                  | uuid                                         | `default auth.uid()`, FK `auth.users` `on delete cascade`                                  |
| `exercise_id`              | text                                         | die **angezeigte** Übung (4.0); FK `exercises(id)` `on update cascade on delete restrict`  |
| `location`                 | `public.equipment_location`                  | `home` \| `gym`                                                                            |
| `kind`                     | neues Enum `public.exercise_preference_kind` | `dislike` \| `not_feasible`                                                                |
| `replacement_exercise_id`  | text, nullable                               | vom Nutzer gewählter Ersatz; FK wie oben; `check (replacement_exercise_id <> exercise_id)` |
| `created_at`, `updated_at` | timestamptz                                  | Trigger `private.set_updated_at()`                                                         |
| PK                         | `(user_id, exercise_id, location)`           | eine Präferenz je Übung und Ort                                                            |

- **`replacement_exercise_id`:** Die App nimmt **bevorzugt die vom Nutzer gewählte** Übung, wenn sie zur Anzeigezeit
  für das jeweilige Paar (S, X) noch alle Regeln S-1 bis S-8 erfüllt. Sonst sucht sie nach der Reihenfolge aus 4.1 neu,
  mit allen Ausschlüssen des Orts als `exclude`. Ketten (A→B, dann B ausgeschlossen) und Kreise (A→B, B→A) löst das
  sauber auf.
- **„Nur heute“** wird **nicht** in der Datenbank gespeichert:
  - Im Trainingsmodus ist es der bestehende Entwurf (`alternative` im `WorkoutDraft`).
  - Vor dem Training (Heute/Woche) kommt es in den Gerätespeicher **Day-Swaps** (Wächter B3/S5):

    | Feld               | Bedeutung                                                                 |
    | ------------------ | ------------------------------------------------------------------------- |
    | `ownerUserId`      | Konto (wie Entwürfe R5); gelesen wird nur `forOwner(userId)`              |
    | `planId`           | Plan, zu dem der Termin gehört                                            |
    | `sessionId`        | `planned_sessions.id` (bleibt beim Verschieben gleich)                    |
    | `scheduledOn`      | Datum beim Tausch (nur zur Info; Verfall am **aktuellen** `scheduled_on`) |
    | `storedOrderNo`    | `order_no` der gespeicherten Übung                                        |
    | `storedExerciseId` | gespeicherte Übung S, wird beim Anwenden verglichen                       |
    | `alternativeId`    | gewählte Übung                                                            |
    | `createdAt`        | Zeitstempel                                                               |

  - Zod-Schema `daySwapSchema` (strict) in `packages/core`; die App prüft **beim Lesen** (Gerätespeicher ist nicht
    vertrauenswürdig). Kaputte Einträge werden verworfen, nie angezeigt.
  - Angewendet wird **nur** im Core über `applyDaySwaps` (7.2) bei **jeder** Anzeige, mit erneuter Prüfung. Es gibt
    keine Übernahme in den Entwurf: Der Trainingsmodus zeigt über denselben Anzeigeweg schon die getauschte Übung, der
    Eintrag bekommt daraus den Status `alternative`. Sobald ein Entwurf läuft, gilt der Entwurf.
  - Kein Gesundheitsdatum, nicht geräteübergreifend (Frage 7).
- **Zod:** `exercisePreferenceSchema` und `daySwapSchema` (strict) in `packages/core`. Konstanten
  `EXERCISE_PREFERENCE_LIMITS` (`maxPerUser: 100`, `manyExclusionsNotice: 10`), `SWAP_RULES` (`maxCandidates: 6`) und
  `DAY_SWAP_LIMITS` (`maxEntries: 200`) in `constants.ts` mit Kommentar „PRODUKTENTSCHEIDUNG“. Abgleich mit der
  Datenbank in `db-sync.test.ts`.

### 5.2 Migration (Etappe T3) `supabase/migrations/2026101xxxxxxx_exercise_preferences.sql`

- `create type public.exercise_preference_kind as enum ('dislike', 'not_feasible');`
- Tabelle wie 5.1, Index auf `exercise_id` und `replacement_exercise_id`.
- **Rechte (wie W14, `exercise_start_weights`):**
  - `revoke all … from anon, authenticated`
  - `grant select, insert, update, delete … to authenticated`
  - `grant all … to service_role`
- **RLS:**
  - select/delete: `user_id = (select auth.uid())`
  - insert/update `with check`: eigene Zeile **und** Profil vorhanden **und**
    - `exercise_id` in `public.exercises` lesbar (`published` bzw. archiviert in eigenem Plan oder Tagebuch – dieselbe
      Lese-Regel wie bei Startgewichten; eine archivierte Übung des laufenden Plans darf ausgeschlossen werden, die
      Anzeige ignoriert die Präferenz aber nach S-8, solange sie nicht wieder `published` ist),
    - `replacement_exercise_id` (falls gesetzt) **nur `published`** (Wächter S7; S-8 verbietet archivierte
      Ersatz-Übungen).
- **Obergrenze:** `before insert`-Trigger `private.exercise_preferences_limit()`, `security definer`,
  `search_path = ''`. Er holt zuerst `pg_advisory_xact_lock(hashtext(new.user_id::text))` (Wächter K3: gleichzeitige
  Inserts überschreiten die Grenze sonst knapp), zählt dann die Zeilen des Nutzers und lehnt ab
  `EXERCISE_PREFERENCE_LIMITS.maxPerUser` mit eigenem Fehlercode ab.
- **Export (Wächter K8):** `public.export_my_data()` per `create or replace`, abgeleitet aus der **neuesten** Fassung
  (`20261006120200`), um `exercise_preferences` ergänzt. Regressionstest: alle bisherigen Schlüssel bleiben enthalten.
- **Löschen:** Konto löschen über die Kaskade an `auth.users`. Der Widerruf `health_data` lässt die Tabelle
  **unberührt** (kein Gesundheitsdatum, Abschnitt 6) – das wird im pgTAP-Test ausdrücklich geprüft.
- **Keine Änderung** an `planned_exercises`, `save_training_plan`, `append_plan_block`, am Verschiebe-Trigger und an
  `plan_note` (kein neuer gespeicherter Hinweis-Code).
- `packages/db/src/database.types.ts` per Typ-Generierung (GitHub Action) neu erzeugen.

### 5.3 pgTAP (Etappe T3)

- Neu `supabase/tests/20_exercise_preferences.test.sql`:
  - eigene Zeilen lesen, anlegen, ändern, löschen
  - fremde Zeilen unsichtbar und nicht änderbar
  - `anon` darf nichts
  - ohne Profil kein Insert
  - unbekannte bzw. Entwurfs-Übung abgelehnt
  - `replacement_exercise_id` archiviert bzw. Entwurf abgelehnt, `published` angenommen
  - `replacement = exercise` abgelehnt
  - falsches Enum abgelehnt
  - Obergrenze greift bei Zeile 101
  - Widerruf `health_data` lässt die Präferenzen stehen
- Ergänzungen:
  - `01_rls_isolation`: Tabelle in die Liste
  - `04_account_deletion`: Zeilen weg
  - `06_profile_required`
  - `10_content_rls` (Wächter S6): **Archivieren** einer Übung mit Präferenz **klappt** (Status-Update, `on delete
restrict` greift nicht); die Präferenz bleibt gespeichert. **DELETE** einer referenzierten Übung wird blockiert
    (wie bei Startgewichten).
  - Export-Test: Tabelle enthalten, alle bisherigen Schlüssel enthalten

## 6. Datenschutz: „Mag ich nicht“ vs. „gesundheitlich nicht möglich“ (DSGVO Art. 9)

**Empfehlung (vom Wächter als tragfähig bestätigt, K9): Präferenzen sind KEIN Gesundheitsdatum. Es ist keine
Einwilligung nötig, solange diese Regeln gelten:**

- **D-1** Als Grund gibt es nur **„Mag ich nicht“** und **„Hier nicht machbar“** (Erklärung unter dem Knopf: „z. B.
  Gerät, Platz, Ausstattung“). Es gibt **keine** Option wie „Schmerzen“, „Verletzung“, „Beschwerden“ oder „ärztlich
  verboten“ und **keinen Freitext**. Gleiche Haltung wie S3 in PLAN-PHASE-4 („Nicht gemacht“ ohne Grund) und wie die
  Trennung `dislike`/`intolerance` bei Lebensmitteln.
  - Die UI formuliert **nie** „kann ich nicht“ oder sonst etwas, das auf Fähigkeit oder Körper zielt. „Hier nicht
    machbar“ bezieht sich immer auf Ort und Ausstattung.
- **D-2** Fester Hinweis im Tausch-Dialog: „Hast du bei einer Übung Schmerzen oder Beschwerden? Dann lass sie aus und
  kläre das ärztlich ab. Im Gesundheits-Check (Einstellungen) kannst du Angaben machen, damit die App deinen Plan
  vorsichtiger macht.“ Der Weg für Gesundheitsgründe ist damit der bestehende, einwilligungspflichtige
  Gesundheits-Check.
- **D-3** Keine Präferenzen und Day-Swaps an Analytics, Logs, Fehlermeldungen, Partner-Modus oder Affiliate.
  Präferenzen werden nur in `packages/core` für Anzeige und Tausch ausgewertet.
- **D-4** Kennzeichen am Plan und im PDF: „getauscht (deine Wahl)“. Das ist unbedenklich, weil der Grund nie ein
  Gesundheitsgrund ist. Den Sicherheits-Ersatz (`adjusted`, `hidden`) und den Präferenz-Tausch (`preference`,
  `hiddenByPreference`) hält der Code streng getrennt – in Markierung **und** Hinweistexten. Ein Sicherheits-Ersatz wird
  nie als „deine Wahl“ ausgewiesen und umgekehrt. Sonderfall (Wächter K6): „Sicherheits-Ersatz, danach Präferenz“ zeigt
  „getauscht (deine Wahl)“, weil die angezeigte Übung aus der Wahl der Person stammt. Das ist datenschutzrechtlich
  unbedenklich (kein Grund wird genannt) und wird in KONZEPT dokumentiert.
- **D-5** Keine Präferenzen an den späteren KI-Coach (Premium) ohne neue Datenschutz-Bewertung.
- **Restrisiko (Eintrag in die DSFA, Phase 12, und in KONZEPT Abschnitt 15 bzw. DSFA-Merkposten):**
  - Ein Muster von Ausschlüssen (z. B. alle Knie-lastigen Übungen) könnte mittelbar auf Beschwerden schließen lassen
    (EuGH C-184/20).
  - Milderung: kein Grund-Feld mit Gesundheitsbezug, RLS, Export, Löschung, keine Auswertung außerhalb des Tauschs,
    keine Weitergabe.
  - Alternative (als Gesundheitsdatum führen): neue Einwilligungs-Fassung, Neu-Zustimmung aller, Bindung an
    `health_data`. Hohe Kosten, wenig Nutzen – nicht empfohlen (Frage 3).
- Im Testmodus liegen die Präferenzen im lokalen Datenbestand (`fitnessapp.local.v1`). Im Supabase-Modus liegen sie im
  normalen Zwischenspeicher für Nicht-Gesundheitsdaten (`rowsCache`) und in der normalen Warteschlange. Day-Swaps
  liegen unverschlüsselt im eigenen Schlüssel `fitnessapp.day-swaps.v1` (nur IDs, kein Gesundheitsdatum).

## 7. Core-Logik (`packages/core`, alles mit Vitest)

### 7.1 Glossar – neu `packages/core/src/content/glossary.ts` (G1, läuft bereits)

- `normalizeSearchText(text)`: Kleinschreibung, ä→ae, ö→oe, ü→ue, ß→ss, Akzente weg, Bindestriche und Leerzeichen
  vereinheitlicht. „Rumänisches“ findet „rumaenisch“, „Kreuzheben“ findet „kreuz heben“.
- `GLOSSARY_GROUPS`: `movement_pattern` → Bereich (Code), die Texte stehen in i18n:
  - Beine (`squat`, `lunge`, `knee_extension`, `knee_flexion`)
  - Hüfte/Gesäß (`hinge`, `hip_extension`)
  - Drücken (`horizontal_push`, `vertical_push`, `elbow_extension`)
  - Ziehen/Rücken (`horizontal_pull`, `vertical_pull`, `elbow_flexion`)
  - Schultern (`shoulder_isolation`)
  - Rumpf (`core_*`)
  - Waden (`calf_raise`)
  - Ausdauer & Beweglichkeit (`conditioning`, `mobility`, `carry`)
  - Test: jedes Muster aus `MOVEMENT_PATTERNS` genau einem Bereich zugeordnet.
- `searchExercises(library, { query, groups, equipment, difficulty }, ctx)`:
  - Filter `equipment`: `none` (`equipment_ids: []`), `my_home` (machbar mit Heim-Profil), `gym`.
  - Rangfolge: Name beginnt mit Suchwort → Name enthält es → Alias → englischer Name → Beschreibung. Bei Gleichstand
    `name_de` nach deutscher Sortierung (`localeCompare('de')`).
  - Rein, deterministisch.
- `glossaryEntry(exercise, ctx)` → Anzeigemodell:
  - Texte
  - Geräte-Namen (aus `EQUIPMENT`)
  - Bereich, Schwierigkeit als Wort (1 leicht / 2 mittel / 3 anspruchsvoll)
  - `loadType`-Wort (Wiederholungen/Halten), einseitig
  - `notReviewed` (`!meta.expert_reviewed`)
  - `feasible: { home, gym }`
  - `inMyPlan`
  - `availableForMe`: neutral, ohne Grund = `isExerciseAllowed` mit aktuellen Regeln
  - `similar`: erlaubte, machbare Alternativen, gleiche Regeln wie 4.1 ohne S-6
  - `preference` (Ausschluss je Ort) – ab T2
- **Grenzfälle (Tests):**
  - leere Suche → alle
  - nur Leerzeichen
  - Sonderzeichen/Emoji
  - 200 Zeichen
  - Groß/klein und Umlaute
  - Alias-Treffer
  - Übung ohne Geräte, nur Studio
  - Entwurf vs. veröffentlicht
  - archivierte Übung nur per Direkt-ID (aus `displayExercises`), nie in der Liste
  - Bibliothek leer bzw. `null`
  - unbekannte ID
  - Schwangerschaft/ab 65/vorsichtig → `availableForMe` false ohne Grund-Text
  - Echte-Inhalte-Test (Wächter K2): **alle geladenen** Übungen (Anzahl aus dem Laden, nicht fest „79“) ergeben ein
    gültiges `glossaryEntry`, alle Muster sind zugeordnet; mindestens eine Übung geladen

### 7.2 Präferenzen, Tausch und Day-Swaps – neu `packages/core/src/plan/preferences.ts` und `plan/day-swaps.ts`

- Typen: `ExercisePreferenceKind`, `ExercisePreference`, `exercisePreferenceSchema`, `DaySwap`, `daySwapSchema`,
  `ExercisePair = { stored: PlannedExerciseDraft; shown: PlannedExerciseDraft; storedOrderNo: number }`.
- `preferencesAt(prefs, location | 'both')` → `ReadonlyMap<exerciseId, ExercisePreference>` (bei `'both'` die
  Vereinigung nach 4.4).
- `planFloorRules(plan, birthDate)` und `displaySwapRules(plan, birthDate, rules)` (4.5) in `plan/start-group.ts`.
- `sessionLocationInfo(session, schedule, ctx)` → `{ location, ambiguous }` in `plan/view.ts` (4.4).
- `swapCandidates(pair, ctx)`:
  - Eingaben: `{ library, profile, swapRules, location, ambiguousLocation, preferences, inSession, mode: 'today' |
'always', harderVariantId? }`
  - Rückgabe: `{ candidates: Exercise[]; alwaysAllowed: boolean; reason: null | 'no_candidate' | 'library_missing' }`
  - Regeln S-1 bis S-8 gegen das Paar (S, X). `harderVariantId` nur bei `mode: 'today'` und nur aus dem Trainingsmodus.
- `canExclude(pair, kind, location, ctx)`: prüft vor dem Speichern, dass ein Kandidat existiert, dass die
  Obergrenze nicht erreicht ist und dass die gewählte `replacement` ein Kandidat ist. Dieselbe Funktion nutzen UI und
  `local-rules.ts`.
- `applyExercisePreferences(pairs, session, prefs, ctx)`:
  - Läuft **nach** `applyCurrentSafetyRules`; Eingabe sind die Paare (S, X) mit `storedOrderNo` (7.3.1), nie nur die
    angezeigte Einheit.
  - `kind !== 'strength'` → unverändert zurück (Wächter S10).
  - Präferenz auf X → `replacement_exercise_id` (wenn für (S, X) noch Kandidat), sonst Kandidat nach 4.1 mit
    `exclude = alle Ausschlüsse des Orts ∪ Einheit`. Übernimmt `superset_group`, klemmt `rest_s` (4.3).
  - Ohne Kandidat: `dislike` bleibt stehen (`keptDisliked`), `not_feasible` wird ausgeblendet
    (`hiddenByPreference` mit der **gespeicherten** ID von S).
  - Rückgabe: `{ pairs, hiddenByPreference: string[], swapped: { storedOrderNo, from, to }[], keptDisliked,
missingKeyPattern: MovementPattern[], emptyByPreference: boolean }`.
- `applyDaySwaps(display, swaps, ctx)` (Wächter B3), in `plan/day-swaps.ts`:
  - Läuft **innerhalb** von `prepareSessionForDisplay` nach den Präferenzen, bei **jeder** Anzeige.
  - `kind !== 'strength'` → unverändert.
  - Je Swap gilt er nur, wenn: `sessionId` = Einheit, `planId` passt, Einheit `planned`, **aktuelles**
    `scheduled_on` ≥ heute, `storedOrderNo` vorhanden **und** `storedExerciseId` = gespeicherte Übung, und
    `alternativeId` ∈ `swapCandidates(pair, { mode: 'today' })` mit den **aktuellen** `swapRules`, Ort, Präferenzen und
    der Einheit (ohne `harderVariantId`).
  - Ungültige Swaps fallen **still** weg (die Anzeige zeigt dann die Übung nach Präferenzen) und werden als
    `droppedDaySwaps` zurückgegeben, damit die App den Speicher aufräumen kann.
  - Rückgabe: `{ pairs, daySwapped: { storedOrderNo, from, to }[], droppedDaySwaps }`.
  - `pruneDaySwaps(swaps, sessions, { today, activePlanId })` (rein): verwirft Einträge, deren Einheit fehlt,
    `completed`/`skipped` ist, deren **aktuelles** `scheduled_on` vor heute liegt oder deren Plan ersetzt wurde.
- `upsertPreference(list, pref)`, `removePreference(list, exerciseId, location)`, `upsertDaySwap`, `removeDaySwap`:
  rein, für den Testmodus und die Warteschlange.
- `preferenceNotices(result)` → Anzeige-Codes:
  - `preference_kept_no_alternative`
  - `preference_removed_no_alternative`
  - `preference_key_pattern_missing`
  - `preference_session_empty`
  - `many_exclusions`
  - Diese Codes werden **nie** gespeichert, also keine Migration an `plan_note`.

### 7.3 Einbindung in die bestehende Anzeige (ein Weg für alle Bildschirme)

#### 7.3.1 Zuordnung gespeichert ↔ angezeigt (Wächter B1)

- `prepareSessionForDisplay()` bildet direkt nach `applyCurrentSafetyRules` die Paare über die bestehende
  `alignShownExercises(stored, safe)` – dort enthält `hidden` nur gespeicherte IDs, die Zuordnung ist also richtig.
- `DisplaySession` bekommt:
  - `storedOrderNos: readonly number[]` – parallel zu `session.exercises`: zu jeder angezeigten Übung die `order_no`
    der gespeicherten.
  - `hidden` – **unverändert**: nur Sicherheits-Ausblendungen, gespeicherte IDs.
  - `hiddenByPreference: readonly string[]` – Präferenz-Ausblendungen, **gespeicherte** IDs.
  - `preferenceSwapped`, `daySwapped` (je `{ storedOrderNo, from, to }`), `preferenceNotices`, `droppedDaySwaps`.
  - `emptyByPreference: boolean` (Wächter S9) – Kraft-Einheit mit gespeicherten Übungen, von der nach allen Schichten
    keine angezeigt wird und mindestens eine wegen Präferenz fehlt. Getrennt von `libraryMissing`.
- `alignShownExercises()` nutzt `storedOrderNos`, wenn vorhanden; sonst wie heute die **Vereinigung** aus `hidden` und
  `hiddenByPreference`. So bekommt jeder Tagebuch-Eintrag die richtige `planned_exercise_id`, auch wenn eine
  Präferenz einen Sicherheits-Ersatz in der Mitte der Einheit ausblendet.
- `SessionCard`: `t.plan.hiddenExercises` (Sicherheit, „Plan neu erstellen“) **nur** bei `hidden.length > 0`.
  `hiddenByPreference` zeigt einen eigenen, neutralen Text `t.swap.hiddenByPreference` („1 Übung entfällt hier – du hast
  sie als hier nicht machbar markiert. Ausschlüsse ansehen“), ohne Aufforderung zum Neu-Erstellen. Test.

#### 7.3.2 Reihenfolge und Kontext

- `DisplayContext` bekommt optional `preferences`, `location`, `ambiguousLocation`, `swapRules`, `daySwaps`,
  `today`, `planId`. Fehlen `preferences`/`location` bzw. `daySwaps`, ist das Ergebnis für `session`, `hidden`,
  `replaced`, `libraryMissing` **byte-gleich** wie heute (Regressionstest); die neuen Felder sind leer.
- `prepareSessionForDisplay()`: Ausdauer-Regeln → Sicherheitsregeln → Paare bilden → Präferenzen → Day-Swaps →
  Neu-Nummerierung.
- `exerciseMark(exercise, storedOrderNo, stored, ctx, display)` (Wächter K6): Prüfreihenfolge
  1. `storedOrderNo` in `daySwapped` → `'day_swap'` („heute getauscht“)
  2. `storedOrderNo` in `preferenceSwapped` → `'preference'` („getauscht (deine Wahl)“)
  3. nicht in gespeicherter Einheit → `'adjusted'`
  4. `equipment_swap` beim Erzeugen bzw. `null` wie heute
     Die Präferenz-/Day-Swap-Prüfung steht damit **vor** „nicht gespeichert → `adjusted`“. Zuordnung über
     `storedOrderNo`, nicht über die Übungs-ID (doppelte IDs sind so ausgeschlossen). Ohne neue Felder unverändert.
- `planWorkout()`: Alternativen über `swapCandidates('today')` (S1), `progressHintForDisplay()` mit `exclude` (S2),
  `extraSetAllowed()` nach 4.3 (S3). `WorkoutItem.plannedOrderNo` kommt aus `storedOrderNos`.
- **Folgeblock** (`nextPlanBlock`) und **neuer Plan** (`generateTrainingPlan`): **unverändert gespeichert.** Die
  Präferenzen wirken als Schicht beim Anzeigen (Empfehlung Frage 4). Gründe:
  - wirkt sofort und ist sofort rückgängig zu machen, auch im laufenden Block
  - keine Änderung an `planned_exercises`/RPCs
  - kein Neu-Erstellen nötig
  - PDF, Heute, Training und Woche sind automatisch gleich
- **`PLAN_ENGINE_VERSION` bleibt 3.** Eine Erhöhung würde allen Nutzern „Plan neu erstellen?“ anbieten
  (`planNeedsUpdate`), obwohl sich ohne Präferenzen nichts ändert. Absicherung: Regressionstest „leere Präferenzen ⇒
  identische Anzeige und identische Pläne“ über alle Vorlagen × typische Profile (wie der V2-Vergleich in K2+K3).
  Präferenzen kommen auch **nicht** in `inputs` (sonst würde jeder Tausch „Angaben geändert“ auslösen). Ausnahme mit
  eigenem Snapshot: die Alternativen-Liste im Trainingsmodus (4.3, S1/B4).
- **PDF** (`training-plan-document.ts`): bekommt Präferenzen und Ort über denselben `DisplayContext`, **ohne**
  `daySwaps` („Nur heute“ ist kein Plan). Die getauschte Übung erscheint mit Namen. Neue Druck-Markierung „getauscht
  (deine Wahl)“ nur für `preference`. Für `hiddenByPreference` ein neutraler Druckhinweis „1 Übung ausgelassen (deine
  Wahl)“ (Wächter K7). Die Sicherheits-Markierung bleibt unsichtbar (PDF-Wächter B1 unverändert); weitere
  Präferenz-Hinweise erscheinen nicht im PDF.

### 7.4 Tests (Grenzfälle laut CLAUDE.md)

- **Sicherheit (Eigenschaftstest):** zufällige Profile (Schwangerschaft, unter 18, ab 65, vorsichtig, ohne Check,
  Einsteiger/Leistungssport), 1/2/3/4/7 Tage, 20/45/240 min, Geräte (keine, nur Band, nur Klimmzugstange, Kurzhanteln,
  Studio) × zufällige Präferenzen (0, 1, 10, 100, Kreise, Ketten) × zufällige Day-Swaps × **zufällige Regeländerungen
  nach Plan-Erstellung (strenger und lockerer)**. Für jede angezeigte Übung (gespeichert S, nach Sicherheit X) muss
  gelten:
  - erlaubt nach `strictestRules(aktuell, planFloorRules)` – bzw. nach aktuellen Regeln, wenn unverändert
  - machbar am Ort
  - `difficulty` ≤ min(S, X)
  - Muster nach S-1 (inkl. Stufe-5-Sonderfall)
  - Halten ↔ Wiederholung nie getauscht
  - keine Doppelung in der Einheit
  - nie eine Übung mit `not_feasible` am Ort
  - `dislike` nur, wenn kein Kandidat (`keptDisliked`)
  - `alignShownExercises` liefert für jede angezeigte Übung die richtige gespeicherte (`storedOrderNo`)
  - leere Einheit nur als `emptyByPreference` bzw. `libraryMissing`, nie stumm
- **Pflicht-Tests aus der Wächter-Prüfung (S11):**
  1. **Sicherheits-Ersatz + Präferenz (B1/B2):** A per Sicherheit → X, X `not_feasible` ohne Kandidat, in der Mitte der
     Einheit → `hiddenByPreference = [A]`, `hidden = []`, Folgeübungen mit richtiger `planned_exercise_id` und
     richtigem Status (`done`/`alternative`/`skipped`). Dazu: X `dislike` mit Kandidat → Kandidat-Schwierigkeit ≤ min(A,
     X); Stufe-5-Ersatz mit Präferenz.
  2. **Day-Swap nach strengerer Regel (B3):** Tausch auf Glute Bridge, danach Gesundheits-Check mit Schwangerschaft →
     Heute zeigt den Swap nicht mehr (`droppedDaySwaps`), keine `long_supine`-Übung sichtbar.
  3. **Konto-Wechsel und kaputter Speicher bei Day-Swaps:** fremder `ownerUserId` unsichtbar; ungültiges JSON bzw.
     Zod-Fehler → verworfen, Anzeige wie ohne Swap.
  4. **Verschobene Einheit mit Day-Swap:** auf morgen verschoben → Swap gilt weiter (gleiche `sessionId`, aktuelles
     Datum); auf gestern zurück bzw. vergangenes Datum → verfallen; `storedExerciseId` passt nicht → verworfen.
  5. **Supersatz:** Ersatz übernimmt `superset_group`; Ein-Mitglied-Gruppe nach Ausblendung → normale Pause, keine
     Runden (`rest-timer`).
  6. **Leere Einheit:** alle Übungen `not_feasible` → `emptyByPreference`, „Training starten“ deaktiviert.
  7. **Ausdauer unverändert:** `applyExercisePreferences`/`applyDaySwaps` bei `kind !== 'strength'` = Eingabe.
  8. **`allowedAlternatives` ≡ `swapCandidates('today').candidates`** (Gleichheitstest über alle Vorlagen).
  9. **Ort-Mehrdeutigkeit:** „Tage egal“ mit beiden Orten → Präferenzen beider Orte, Dialog verlangt Ortswahl.
  10. **V9 je Einheit mit eigenem Ort:** gemischte Woche, Präferenz nur zu Hause → nur Heim-Einheiten gezählt mit
      Ersatz; ohne Präferenzen identisch zu heute.
  11. **`hiddenExercises`-Hinweis nicht bei Präferenz-Ausblendung:** `SessionCard` zeigt dann nur den neutralen Text.
- **Rangfolge/Lockerung (B4):** Präferenz-Ersatz wird gesperrt (z. B. neue Schwangerschaft → `long_supine`) → nächster
  Kandidat bzw. Rückfall. Lockerung nach Plan-Erstellung (Schwangerschaft beendet, 18. Geburtstag) → Kandidat bleibt
  gesperrt bis „Plan neu erstellen“. `planFloorRules`-Grenzfälle (4.5).
- **`findHarderVariant` mit `exclude` (S2):** Y = `easier`-Alternative von A, A ausgeschlossen, schwerere Variante von
  Y = A → kein bzw. nächster Vorschlag; Variant-Zweig der Alternativen ebenfalls gefiltert.
- **Mindestanforderungen:** Körpergewicht-Plan, Türrahmen-Rudern `not_feasible` → Handtuch-Rudern. Beides
  ausgeschlossen → `preference_key_pattern_missing`. `canExclude` liefert false, wenn kein Kandidat.
- **Progression:** Ersatz ohne Einträge → Kalibrierung. Rückkehr der alten Übung nach 30 Tagen →
  `RETURN_AFTER_PAUSE`.
- **Ort:** gleiche Übung zu Hause ausgeschlossen, im Studio nicht. „beides“ = Studio.
- **Markierung:** „Sicherheits-Ersatz, danach Präferenz“ → `preference`; Day-Swap → `day_swap`; reiner
  Sicherheits-Ersatz → `adjusted`.
- **Regression:** ohne Präferenzen/Day-Swaps identisch (Anzeige, PDF-Dokument, `planWorkout` außer Alternativen-Liste,
  Folgeblock, V9). Alternativen-Liste: eigener Snapshot vorher/nachher.
- **Echte Inhalte:** Für jede Übung in jeder Vorlage gilt: ist `swapCandidates(..., 'always')` leer (mit und ohne
  `medical_notice`-Untergrenze), steht das in einem Snapshot. So sehen die Gründer, wo „Ab jetzt immer“ nicht angeboten
  wird. Der Snapshot ist auch eine Liste für fehlende Alternativen in der Content-Pflege.

## 8. App-Oberfläche (`apps/mobile`, nativ und Web gleich)

### 8.1 Glossar

- **`apps/mobile/src/app/uebungen/index.tsx`** („Übungen“):
  - Suchfeld mit sichtbarer Beschriftung, Löschen-Knopf.
  - Filter-Chips: Bereich, Ausrüstung („Ohne Geräte“, „Mit meinen Geräten zu Hause“, „Studio“), Schwierigkeit.
  - Trefferzahl mit `accessibilityLiveRegion="polite"` („23 Übungen“).
  - Liste mit Name, Bereich, Geräte-Kurztext.
  - Im Testmodus Kennzeichen „Testinhalt – noch nicht fachlich geprüft“ an Entwürfen.
- **`apps/mobile/src/app/uebungen/[exerciseId].tsx`:**
  - Name, „auch genannt: …“, Merkmal-Zeile (Bereich · Geräte · Schwierigkeit · Wiederholungen/Halten · einseitig).
  - Beschreibung, **„So geht's“** als nummerierte Schritte, „Tipps“, „Häufige Fehler“.
  - Sicherheitshinweis als `Notice`.
  - „Ähnliche Übungen“ (Links).
  - „Dein Verlauf“ (Link `history/[exerciseId]`, wenn Einträge da sind).
  - Ausschluss-Status mit „Wieder zulassen“ (ab T2).
  - Bei `!availableForMe` der neutrale Satz: „Diese Übung nimmt die App gerade nicht in deinen Plan auf.“ Ohne Grund.
- **Zustände:**
  - Laden: `LoadingState`
  - Bibliothek fehlt (offline ohne Zwischenspeicher): „Übungen können gerade nicht geladen werden – kurz online
    gehen.“
  - Keine Treffer: „Keine Übung gefunden – anderes Suchwort oder Filter zurücksetzen.“
  - Unbekannte ID: „Diese Übung gibt es nicht (mehr).“ + Zurück
- **Einstiege:**
  - `SessionCard`: Übungsname wird zum Link (`accessibilityRole="link"`, Hinweis „Anleitung öffnen“).
  - Heute und Woche: Link „Alle Übungen“.
  - Trainingsmodus: je Übungskarte aufklappbar **„So geht's“** (Schritte + Sicherheitshinweis, ohne Navigation – der
    Pausentimer läuft weiter) und „Ganze Anleitung“. Die Navigation geht sicher, weil der Entwurf jeden Tipp speichert.
  - Verlauf je Übung und Verlaufs-Eintrag `log/[logId]`: Link „Anleitung“. Archivierte Übungen werden über
    `displayExercises` aufgelöst.
  - Einstellungen: „Übungen (Glossar)“.

### 8.2 Tauschen

- **Einstieg:** Knopf **„Tauschen“** an jeder Übung einer Kraft-Einheit (4.6) in der `SessionCard` auf „Heute“ (auch
  für andere Tage dieser Woche über die Wochenübersicht auf „Heute“; nur geplante und nicht erledigte Termine).
  **Festlegung (G1):** Die Seite „Woche“ (`app/week.tsx`) bekommt **keinen** eigenen Tausch-Einstieg – sie zeigt nur
  Tagebuch-Status und Summen, keine Übungen. Getauscht wird auf „Heute“ und im Trainingsmodus. Im Trainingsmodus ersetzt das Menü „Tauschen“ den Punkt „Alternative
  durchgeführt“; die Kandidaten kommen aus derselben Core-Funktion (`swapCandidates('today')`, S1).
- **Dialog (Bottom-Sheet bzw. Modal), Schritte auf einer Fläche:**
  1. „Statt _Kniebeuge mit Langhantel_:“ – Liste der Kandidaten als Radio-Gruppe. Jeder Eintrag mit Link „So geht's“
     ins Glossar.
  2. **„Wie lange?“** – Radio: „Nur heute“ (bei späterem Termin „Nur bei diesem Training“) /
     „Ab jetzt immer – zu Hause“ (bzw. „– im Studio“). „Immer“ ist deaktiviert mit Erklärung, wenn
     `alwaysAllowed = false`.
  3. Nur bei „immer“ **und mehrdeutigem Ort** (4.4): **„Wo trainierst du diese Einheit?“** – „Zu Hause“ / „Im Studio“,
     ohne Vorauswahl.
  4. Nur bei „immer“: **„Warum?“** – „Mag ich nicht“ / „Hier nicht machbar (z. B. Gerät, Platz)“. Darunter der
     Hinweis D-2.
  - Knöpfe: „Tauschen“ (primär) / „Abbrechen“.
- **Nach dem Tausch:**
  - Kennzeichen an der Übung: „getauscht (deine Wahl)“ bzw. „heute getauscht“.
  - Ansage über `AccessibilityInfo.announceForAccessibility`: „Kniebeuge mit Langhantel durch Goblet-Kniebeuge
    ersetzt.“ Bei „immer“ zusätzlich: „Rückgängig machen kannst du das auch unter Einstellungen, Ausgeschlossene
    Übungen.“
  - Bei „immer“ zusätzlich ein Knopf „Rückgängig“ **ohne Zeitlimit** (Wächter K4, WCAG 2.2.1): Er bleibt sichtbar, bis
    die Person eine andere Aktion ausführt oder den Bildschirm verlässt.
- **Keine Kandidaten:** „Für diese Übung gibt es hier gerade keine gleichwertige Alternative.“ + „Heute auslassen“
  (nur im Trainingsmodus) + bei `not_feasible`-Wunsch „Geräte anpassen“.
- **Ausgeblendet wegen Präferenz** (`hiddenByPreference`): neutraler Hinweis `t.swap.hiddenByPreference` mit Link
  „Ausschlüsse ansehen“ – **nie** der Sicherheitstext `t.plan.hiddenExercises` (Wächter B1b).
- **Leere Einheit** (`emptyByPreference`, Wächter S9): „Alle Übungen dieser Einheit hast du hier ausgeschlossen.“ +
  „Ausschlüsse ansehen“; „Training starten“ deaktiviert (`accessibilityState.disabled` + sichtbarer Text).
- **Day-Swap still verworfen:** keine Fehlermeldung; die Übung erscheint wieder ohne „heute getauscht“. Die App räumt
  `droppedDaySwaps` aus dem Speicher.
- **Einstellungen → „Ausgeschlossene Übungen“:**
  - Gruppiert nach Ort, je Zeile Übung, Grund, Ersatz.
  - „Wieder zulassen“ mit Bestätigung: „Die Übung erscheint wieder in deinem Plan – ab sofort.“
  - Nicht mehr verfügbare Übungen (archiviert): „nicht mehr verfügbar“ + „Entfernen“.
  - Leerzustand: „Du hast keine Übungen ausgeschlossen.“
  - Hinweis ab 10 Ausschlüssen.
- **Supabase-Modus vor T3:** `Backend.supportsExercisePreferences = false` → nur „Nur heute“, kein „immer“, kein
  Einstellungs-Punkt. Kein halbfertiger Zustand.

### 8.3 Barrierefreiheit

- Touch-Ziele mindestens 48 × 48 dp.
- Radio-Gruppen mit `accessibilityRole="radiogroup"`/`"radio"` und `accessibilityState.checked`; Chips mit
  `accessibilityState.selected`.
- Deaktivierte Option mit `accessibilityState.disabled` **und** sichtbarem Erklärtext.
- Überschriften mit `accessibilityRole="header"`. Schritte werden angesagt als „Schritt 2 von 5: …“.
- Dialog: Fokus beim Öffnen auf den Titel, beim Schließen zurück auf „Tauschen“. Im Browser Escape zum Schließen und
  Tastatur-Navigation.
- Kein Zeitlimit für „Rückgängig“ (8.2).
- Status nie nur über Farbe (Kennzeichen als Text).
- Schriftvergrößerung ohne abgeschnittene Texte.
- Suchfeld mit `accessibilityLabel` „Übungen suchen“; Trefferzahl als Live-Region.

### 8.4 Texte

- Alle Texte deutsch in `src/i18n/de.ts`, neue Bereiche `glossary` und `swap`; Ergänzungen in `today`, `workout`,
  `settings`, `print`.
- Kein „verboten“, kein Gesundheitsbezug, kein „kann ich nicht“ in Tausch-Texten (D-1).

## 9. Testmodus, Offline, Export, Löschen

- **Testmodus (T2):**
  - `UserRows.exercisePreferences: ExercisePreferenceRow[]`; `legacy-rows.ts` ergänzt `[]` für alte Bestände.
  - Neue `WriteOp`s `upsert_exercise_preference` / `delete_exercise_preference`. `local-rules.ts` prüft wie die
    Datenbank: Profil, Übung in der gebündelten Bibliothek, Ersatz nur Entwurf **ohne roten Befund** bzw. `published`
    (Wächter S7), Enum, `replacement ≠ exercise`, Obergrenze, `canExclude`.
  - `local-backend.ts`: `setExercisePreference(pref, rows)`, `removeExercisePreference(exerciseId, location, rows)`.
  - `clearDeviceData` löscht alles.
- **Day-Swaps (Wächter S5):** `apps/mobile/src/data/day-swaps.ts` – nur Speicher, **keine Fachlogik**:
  - Schlüssel `STORAGE_KEYS.daySwaps = 'fitnessapp.day-swaps.v1'` in `data/kv.ts` (sonst löscht `clearDeviceData` ihn
    nicht).
  - Lesen: JSON parsen, `daySwapSchema` (Zod) je Eintrag, kaputte Einträge verwerfen, dann `forOwner(userId)`.
  - Schreiben: `upsertDaySwap`/`removeDaySwap` aus Core, höchstens `DAY_SWAP_LIMITS.maxEntries`.
  - Aufräumen über Core `pruneDaySwaps` beim Laden und nach jeder Anzeige mit `droppedDaySwaps`; beim Abmelden die
    Einträge des Kontos; `clearDeviceData` alles.
  - **Widerruf `health_data`:** Day-Swaps zu Plänen mit `uses_health_data = true` werden mit entfernt, analog
    `cleanHealthPlanDrafts` – diese Pläne werden dabei ohnehin gelöscht bzw. neutralisiert, die Einträge wären verwaist.
  - Kein Supabase-Teil, gilt in beiden Modi gleich.
- **Offline:**
  - Glossar aus gebündelten Inhalten (Testmodus) bzw. Bibliotheks-Zwischenspeicher (Supabase).
  - Präferenzen im Supabase-Modus über die **normale** Warteschlange: kein Gesundheitsdatum,
    `isSensitiveOp = false`, Schlüssel `exercise_preference:<exercise_id>:<location>`, letzte Änderung gewinnt.
  - Die Anzeige wendet die lokale Fassung sofort an.
- **Export:**
  - Testmodus `data/data-export.ts` + Core `export/data-export.ts` Tabellenliste um `exercise_preferences` ergänzen.
  - Supabase über `export_my_data()` (K8).
  - Day-Swaps sind Gerätedaten wie Entwürfe – im Export-Hinweis wie bei Entwürfen erwähnen.
- **Löschen:** Konto löschen per Kaskade. Testmodus „Alles auf dem Gerät löschen“. Der Widerruf `health_data` lässt
  die Präferenzen stehen (Abschnitt 6, Test); Day-Swaps zu Gesundheitsplänen werden entfernt (oben).

## 10. Supabase-Backend (Etappe T3)

- `supabase-backend.ts`:
  - `loadRows` liest `exercise_preferences` (eigene Zeilen).
  - Schreiben per PostgREST `upsert`/`delete` über die Sync-Warteschlange.
  - Fehler-Codes (Obergrenze, Übung nicht lesbar) auf `BackendErrorCode` abbilden.
  - `supportsExercisePreferences = true`.
- Archivierte Übung mit Präferenz (Wächter S6): Archivieren klappt; die Anzeige ignoriert die Präferenz, wenn die Übung
  bzw. der Ersatz nicht in `library.exercises` steht (S-8). Einstellungen zeigen sie mit „nicht mehr verfügbar“ und
  „Entfernen“. **Redaktions-Doku** (Content-Pflege): Übungen mit Präferenzen oder Startgewichten können nicht
  gelöscht, nur archiviert werden.
- `db-sync.test.ts`: Enum-Werte und Grenzen gleich wie `constants.ts`/`enums.ts`.

## 11. Etappen (je ein Pull Request, jede mit Wächter-Prüfung; Testmodus zuerst)

| Etappe                                               | Inhalt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Prüfung                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **G1** Glossar (läuft)                               | `content/glossary.ts` + Tests (echte Inhalte mit geladener Anzahl, K2); `apps/mobile/src/app/uebungen/index.tsx`, `…/[exerciseId].tsx` (K1); Links aus SessionCard, Heute/Woche, Trainingsmodus („So geht's“ aufklappbar), Verlauf, Einstellungen; i18n; E2E `glossary.spec.ts`                                                                                                                                                                                                                                                  | CI grün, Vercel-Vorschau                                                |
| **T1** Tausch-Core                                   | `plan/preferences.ts`, `plan/day-swaps.ts` (Core), `planFloorRules`/`displaySwapRules`, `sessionLocationInfo`; Einbindung in `prepareSessionForDisplay` mit `storedOrderNos`/`hiddenByPreference`/`emptyByPreference`; `exerciseMark('preference' \| 'day_swap')`; `alignShownExercises`; `allowedAlternatives` als Mantel; `findHarderVariant` mit `exclude`; `extraSetAllowed`; PDF-Markierung und -Hinweis; alle Auflagen B1–B4, S1–S3, S8–S10; Eigenschafts-, Regressions-, Echte-Inhalte- und Pflicht-Tests (7.4); keine UI | CI grün, Regression „ohne Präferenzen identisch“, Snapshot Alternativen |
| **T2** Tausch-App Testmodus (erst nach T1 mit B3/S5) | `UserRows`, WriteOps, `local-rules`, `local-backend`, Day-Swap-Speicher (S5), Tausch-Dialog (Heute inkl. Wochenübersicht dort, Training; nicht `app/week.tsx`) inkl. Ortsfrage, `SessionCard`-Hinweise (B1b, S9), Einstellungen „Ausgeschlossene Übungen“, Export lokal, `supportsExercisePreferences` (Supabase: false); E2E `exercise-swap.spec.ts`; Doku (KONZEPT 4/5/15, PLAN-PHASE-4 Verweis, DSFA-Merkposten)                                                                                                              | Vercel-Vorschau im Testmodus                                            |
| **T3** Supabase                                      | Migration + RLS (S7) + Limit-Trigger mit Sperre (K3) + `export_my_data` (K8), pgTAP (neu + 01/04/06/10 nach S6), Typen, `supabase-backend` + Warteschlange, `db-sync.test`, Redaktions-Doku                                                                                                                                                                                                                                                                                                                                      | `db-migrate.yml` nach Merge, pgTAP grün                                 |
| **G2** (später, eigener Plan)                        | Bilder/Videos: Quelle/Lizenz, privater bzw. öffentlicher Storage-Bucket, Alt-Texte/Untertitel, Datenvolumen offline                                                                                                                                                                                                                                                                                                                                                                                                              | –                                                                       |

Gründe für den Schnitt:

- G1 ist unabhängig und risikoarm, also kommt es zuerst (läuft bereits).
- T1 trennt die sicherheitskritische Logik von der UI, damit der Wächter sie gezielt prüfen kann. Alle blockierenden
  Auflagen liegen in T1.
- T2 macht den Testmodus vollständig; es beginnt erst, wenn B3/S5 im Core stehen.
- T3 kann später kommen, ohne dass der Testmodus etwas vermisst.

## 12. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas (`exercisePreferenceSchema`, `daySwapSchema`, Such-Optionen)
2. Migration mit RLS (T3; bis dahin gleiche Regeln in `local-rules.ts`)
3. Core-Logik mit Tests inkl. Grenzfällen (7.4)
4. UI mobil + Web
5. Lade-, Leer- und Fehlerzustände (8.1/8.2, inkl. `emptyByPreference`)
6. Texte auf Deutsch
7. `docs/` aktualisiert:
   - dieser Plan mit „Umsetzungsstand“
   - KONZEPT Abschnitt 4/5 (Glossar, Tausch, Markierung „deine Wahl“ nach Sicherheits-Ersatz) und Abschnitt 15
     (Restrisiko, kein KI-Coach ohne Bewertung)
   - PLAN-PHASE-4 6.1 (Menü „Tauschen“)
   - PLAN-PDF-EXPORT (Markierung, Druckhinweis „ausgelassen (deine Wahl)“)
   - DSFA-Merkposten (Restrisiko)
   - Redaktions-Doku (Archivieren statt Löschen)

## 13. So testest du es am Handy

1. Im Pull Request auf den **Vercel-Vorschau-Link** tippen (Testmodus startet ohne Supabase von selbst).
2. Neues Testkonto, Onboarding: Ort **Zuhause**, Geräte **„Keine Geräte“**, 3 Tage.
3. **Glossar (G1):**
   - Auf „Heute“ einen Übungsnamen antippen → Anleitung mit Schritten, Tipps, Fehlern, Sicherheitshinweis.
   - „Alle Übungen“ → „rumaenisch“ suchen → „Rumänisches Kreuzheben“ erscheint.
   - Filter „Ohne Geräte“ → nur Übungen ohne Geräte.
   - Training starten → bei einer Übung „So geht's“ aufklappen, der Pausentimer läuft weiter.
4. **Tauschen „Nur heute“ (T2):**
   - Auf „Heute“ bei Türrahmen-Rudern „Tauschen“ → Handtuch-Rudern → „Nur heute“ → Kennzeichen „heute getauscht“ →
     Training starten → Handtuch-Rudern steht schon da.
   - Morgen bzw. nächste Einheit: wieder Türrahmen-Rudern.
5. **Tauschen „Ab jetzt immer“:**
   - Eine Übung tauschen → „Ab jetzt immer – zu Hause“ → „Mag ich nicht“ → Kennzeichen „getauscht (deine Wahl)“ in
     allen Einheiten. „Rückgängig“ bleibt stehen, bis du etwas anderes tippst.
   - Woche ansehen, Druckansicht/PDF öffnen → die neue Übung steht drin.
6. Einstellungen → „Ausgeschlossene Übungen“ → „Wieder zulassen“ → die Übung ist sofort zurück.
7. **Sicherheit prüfen:**
   - Gesundheits-Check mit Schwangerschaft eintragen → beim Tauschen erscheinen keine Übungen in Rückenlage (z. B. keine
     Glute Bridge). Ein vorher gemachter „Nur heute“-Tausch auf eine solche Übung ist verschwunden.
   - Schwangerschaft wieder austragen → Glute Bridge erscheint beim Tauschen erst nach „Plan neu erstellen“.
   - Alter ab 65 → kein Tisch-Rudern.
   - Bei einer Übung ohne Alternative ist „Ab jetzt immer“ ausgegraut, mit Erklärung.
8. **Hinweise prüfen:** Eine Übung „Hier nicht machbar“ ausschließen, für die es keine Alternative mehr gibt → neutraler
   Hinweis „entfällt hier … Ausschlüsse ansehen“, **kein** Hinweis „Plan neu erstellen“.
9. Einstellungen → „Meine Daten exportieren“ → die Datei enthält `exercise_preferences`.
10. Optional am Handy mit Bildschirmleser (TalkBack/VoiceOver): Tausch-Dialog durchgehen, Ansage „… ersetzt“ hören.
11. GitHub-App → Actions → letzter `ci`-Lauf grün. Ab T3 zusätzlich `db-migrate` grün.

## 14. Offene Fragen an die Gründer (mit Empfehlung; ohne Antwort gilt die Empfehlung)

1. **Gilt „Mag ich nicht“ an beiden Orten?** _Empfehlung:_ Wie entschieden: nur am gewählten Ort. Später ein
   Kästchen „auch im Studio“. (Ausnahme mehrdeutiger Ort: 4.4.)
2. **Grund bei „immer“ Pflicht?** _Empfehlung:_ Ja, zwei Knöpfe, kein Freitext. Der Grund steuert „weich“ (mag nicht)
   vs. „hart“ (nicht machbar).
3. **Gesundheitliche Gründe als Tausch-Grund?** _Empfehlung:_ Nein (Art. 9, neue Einwilligung). Verweis auf den
   Gesundheits-Check. Ein eigenes Feature „Beschwerden berücksichtigen“ höchstens später mit Einwilligung.
4. **Ausschlüsse in den gespeicherten Plan schreiben oder nur beim Anzeigen anwenden?** _Empfehlung:_ Nur beim
   Anzeigen (eine Schicht über dem Plan). Wirkt sofort, ist sofort rückgängig, keine Server-Änderung, keine neue
   Engine-Version.
5. **Gesperrte Übungen im Glossar zeigen?** _Empfehlung:_ Ja, lesbar, mit neutralem Satz ohne Grund.
6. **Entwürfe im Testmodus-Glossar?** _Empfehlung:_ Ja, mit „noch nicht fachlich geprüft“. Live nur `published` – die
   Fachprüfung der Texte ist Voraussetzung (Haftung).
7. **„Nur heute“ über mehrere Geräte?** _Empfehlung:_ Nein, nur auf dem Gerät (wie Entwürfe).
8. **Obergrenze der Ausschlüsse?** _Empfehlung:_ technisch 100, Hinweis ab 10.
9. **Dauerhaft schwerere Übung wählen?** _Empfehlung:_ Nein, das läuft über den Progressions-Hinweis.
10. **Glossar öffentlich (Landingpage)?** _Empfehlung:_ Später, nach Fachprüfung und G2.
11. **Bilder/Videos (G2): eigene Produktion oder Lizenz?** _Empfehlung:_ Eigener Plan. Bis dahin reicht Text.
12. **Neu (B4): Dürfen Lockerungen beim Tauschen sofort wirken?** _Empfehlung:_ Nein. Erst nach „Plan neu erstellen“
    (PLAN-PHASE-3 5.4). Folge: Bei Plänen mit Arzt-Hinweis sind Übungen in langer Rückenlage und Überkopf-Übungen nie
    Tausch-Kandidat, solange ein Gesundheits-Flag besteht (4.5, N5).
13. **Neu (S1): Darf sich die Alternativen-Liste im Trainingsmodus ändern** (mehr Kandidaten, strengere Prüfung), damit
    Heute und Training dieselbe Liste zeigen? _Empfehlung:_ Ja, mit Snapshot-Test.

## 15. Risiken

| Risiko                                                            | Gegenmaßnahme                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Präferenz oder Day-Swap umgeht Sicherheitsregeln                  | Feste Rangfolge, beide Schichten laufen **nach** den Sicherheitsregeln und prüfen bei **jeder** Anzeige mit `strictestRules(aktuell, planFloorRules)`; Eigenschaftstest mit Regeländerungen |
| Lockerung öffnet über „immer“ gesperrte Übungen                   | `planFloorRules`, erst „Plan neu erstellen“ hebt die Untergrenze (4.5)                                                                                                                      |
| Falsche Zuordnung angezeigt ↔ gespeichert (`planned_exercise_id`) | `storedOrderNos`, gespeicherte IDs in `hidden`/`hiddenByPreference`, Pflicht-Test „Sicherheits-Ersatz + Präferenz in der Mitte“                                                             |
| Sicherheitshinweis „Plan neu erstellen“ durch Präferenz           | getrennte Listen und Texte, Test                                                                                                                                                            |
| Tausch wird schleichend schwerer                                  | Schwierigkeit ≤ min(gespeichert, angezeigt)                                                                                                                                                 |
| Präferenz am falschen Ort                                         | `sessionLocationInfo.ambiguous`, Ortsfrage, beide Orte bei mehrdeutigen Einheiten                                                                                                           |
| Day-Swap-Speicher manipuliert oder fremd                          | Zod beim Lesen, `ownerUserId`, Core-Prüfung bei jeder Anzeige, `STORAGE_KEYS`                                                                                                               |
| Leere Einheit nach Ausschlüssen                                   | `emptyByPreference`, Start deaktiviert, Hinweis                                                                                                                                             |
| Mittelbare Gesundheitsdaten aus Ausschluss-Mustern                | Kein Gesundheits-Grund, kein Freitext, keine Auswertung/Weitergabe, kein KI-Coach, DSFA-Eintrag                                                                                             |
| Unfertige Texte (Entwürfe) als Anleitung                          | Kennzeichen im Testmodus, live nur `published` nach Fachprüfung                                                                                                                             |
| Plan wird zu einseitig                                            | nur gleiches Muster, „immer“ nur mit Kandidat, Hinweis ab 10, Hinweis bei fehlender Schlüsselübung                                                                                          |
| Verwirrung „Nur heute“ vs. „immer“                                | klare Texte, Kennzeichen, Rückgängig ohne Zeitlimit, Einstellungs-Liste                                                                                                                     |
| Testmodus- und Datenbank-Regeln laufen auseinander                | gemeinsame Core-Funktion `canExclude`, `db-sync.test`, pgTAP                                                                                                                                |
| Unbemerkte Planänderung für alle                                  | `PLAN_ENGINE_VERSION` bleibt, Regressionstest „ohne Präferenzen identisch“; bewusste Ausnahme Alternativen-Liste mit Snapshot                                                               |
| Obergrenze bei gleichzeitigen Inserts überschritten               | Advisory-Lock im Trigger                                                                                                                                                                    |
| Archivierte Inhalte mit Präferenz                                 | S-8, RLS Ersatz nur `published`, Anzeige in den Einstellungen „nicht mehr verfügbar“, DELETE blockiert                                                                                      |
| Supabase-Modus vor T3                                             | `supportsExercisePreferences = false`, nur „Nur heute“                                                                                                                                      |

## Nachträge aus der Wächter-Nachprüfung (in T1/T2 umzusetzen)

- **N7 (in T1 zu entscheiden, Wächter G1 K5):** Das Glossar (`similarExercises`, `availableForMe`) nutzt bewusst nur
  die **aktuellen** Regeln. Der Tausch nutzt zusätzlich `planFloorRules` (4.5). Nach einer Lockerung (z. B.
  Schwangerschaft beendet, Plan noch nicht neu erstellt) kann das Glossar daher eine Übung als „ähnlich“ zeigen, die
  der Tausch nicht anbietet – sicher, aber uneinheitlich. Entscheiden: `similar` ebenfalls mit `displaySwapRules`
  berechnen (braucht Plan + Geburtsdatum im Glossar-Kontext) oder die Abweichung hier festhalten.

- **N1 (soll):** „Nur heute“ gilt auch für Einheiten, die heute nachgeholt werden dürfen (Termin in der Vergangenheit) – mit Test.
- **N2 (soll):** Die Neuprüfung eines Tauschs läuft gegen die Einheit **vor** dem Einsetzen; mehrere Tausche einer Einheit der Reihe nach. Tests „zweimal anzeigen bleibt gültig“ und „zwei Tausche in einer Einheit“.
- **N3 (kann):** Unlesbare Plan-Angaben → konservativ plus `overhead`, `long_supine` und Alters-Merkmale (nicht alle Merkmale).
- **N4 (kann):** Test: laufender Trainings-Entwurf mit Alternative aus der alten Liste bleibt nach dem Update fortsetzbar.
- **N5 (kann):** In 4.5/Frage 12 festhalten: Pläne mit beliebigem Flag bekommen keine Überkopf-Übungen als Tausch-Kandidat.
- **N6 (kann):** V9 zählt nur die Präferenz-Schicht – bewusst so.

## 16. Umsetzungsstand

### G1 – Übungs-Glossar (umgesetzt, 09.10.2026)

- **Core** `packages/core/src/content/glossary.ts` (+ Tests, Echte-Inhalte-Test über die geladene Anzahl):
  `normalizeSearchText`, `GLOSSARY_GROUPS` (jedes Muster genau einem Bereich), `searchExercises` (Filter, Rangfolge,
  Zod-Schema `glossarySearchOptionsSchema`), `glossaryEntry` (inkl. `availableForMe` nach aktuellen Regeln ohne Grund,
  `similar` nach S-1 bis S-5 und S-8, höchstens `GLOSSARY_LIMITS.similarMax`), `findGlossaryExercise` (archivierte nur
  per Direkt-ID). Grenzen `GLOSSARY_LIMITS` in `constants.ts`.
- **App:** `src/app/uebungen/index.tsx` (Suche, Filter, Trefferzahl als Live-Region, Kennzeichen an Entwürfen),
  `src/app/uebungen/[exerciseId].tsx` (Merkmale, Beschreibung, nummerierte Schritte, Tipps, Fehler,
  Sicherheitshinweis, ähnliche Übungen, Verlauf, neutraler Satz bei `availableForMe === false`); Abbildung
  `data/glossary.ts`, Texte `lib/glossary-format.ts` und `i18n/de.ts` (`glossary`).
- **Einstiege:** Übungsname in der `SessionCard` auf „Heute“; „Alle Übungen“ auf Heute (mit und ohne Plan), Woche und
  in den Einstellungen („Übungen (Glossar)“); im Trainingsmodus aufklappbares „So geht's“ (Schritte +
  Sicherheitshinweis, ohne Navigation, Pausentimer läuft weiter) und „Ganze Anleitung“; Link „Anleitung“ im Verlauf je
  Übung und im Verlaufs-Eintrag (auch archivierte Übungen).
- **E2E** `apps/mobile/e2e/glossary.spec.ts`.

**Abweichungen und Festlegungen:**

1. `SessionCard` gibt es nur auf „Heute“ (Ist-Stand korrigiert). „Woche“ und „Fertig“ haben keine Namens-Links; Woche
   hat „Alle Übungen“, Fertig keinen Glossar-Einstieg.
2. Ausrüstungs-Filter „Studio (mit Geräten)“ = Übungen mit Geräten, die im Studio machbar sind (wörtlich „im Studio
   machbar“ wären fast alle). „Mit meinen Geräten zu Hause“ schließt Übungen ohne Geräte ein.
3. Suchwort nur aus Emoji/Sonderzeichen zählt wie eine leere Suche (alle); über 100 Zeichen wird gekürzt. Wortgrenzen
   zählen nicht – „kniebeuge“ findet daher auch Beschreibungen mit „Knie beugen“ (Rang „Beschreibung“, ganz unten).
4. Bereich- und Schwierigkeits-Filter sind Checkboxen (`aria-checked`, sichtbares ✓) statt `accessibilityState.selected`
   – für Mehrfachauswahl die passende Rolle; Ausrüstung ist eine Radio-Gruppe mit „Alle“.
5. **Sicherheitshinweis als Info-Notice, nicht als Warnung:** `Notice` mit `tone="warning"` setzt
   `accessibilityRole="alert"`; das würde bei jedem Öffnen der Detailseite und jedem Aufklappen im Training den
   Bildschirmleser unterbrechen, obwohl es ein statischer Text ist. Erkennbar bleibt er über den Titel
   „Sicherheitshinweis“ (Text, als Überschrift ausgezeichnet), nicht über Farbe.
6. „Ähnliche Übungen“ müssen an mindestens einem Trainingsort der Person machbar sein (Orte aus den aktuellen
   Trainingstagen; ohne Kraft-Tage beide). Ohne Regeln (`null`) gibt es keine ähnlichen Übungen.
7. Kein `preference`-Feld im Anzeigemodell (kommt mit T1/T2).
8. Kennzeichen „noch nicht fachlich geprüft“: Entwürfe zeigen „Testinhalt – noch nicht fachlich geprüft“; freigegebene
   KI-Entwürfe ohne Fachprüfung (`needsExpertReviewLabel`) zeigen auf der Detailseite „Noch nicht fachlich geprüft“.
9. Ungültige Übungs-ID im Link (z. B. kaputtes `%`) zeigt „Diese Übung gibt es nicht (mehr).“ statt abzustürzen.

### T1 – Tausch-Core (umgesetzt, 10.10.2026)

- **Konstanten/Enums:** `EXERCISE_PREFERENCE_LIMITS` (100 / Hinweis ab 10), `SWAP_RULES` (`maxCandidates: 6`,
  `keyPatternGroups` Zug/Hüftbeuge), `DAY_SWAP_LIMITS` (200) in `constants.ts` (PRODUKTENTSCHEIDUNG);
  `EXERCISE_PREFERENCE_KINDS` in `enums.ts` (Datenbank-Enum folgt in T3, daher noch nicht in `db-sync.test.ts`).
- **`plan/start-group.ts`:** `planFloorRules(plan, birthDate)` (ohne Check → vorsichtig + `overhead`; Arzt-Hinweis →
  zusätzlich `long_supine`; Alter am Erstellungstag; unlesbar → strengste Regeln nach N3) und
  `displaySwapRules(plan, birthDate, rules)` (B4).
- **`plan/preferences.ts`:** `exercisePreferenceSchema` (strikt, Zod), `ExercisePair`, `preferencesAt` (Ort; bei
  mehrdeutigem Ort Vereinigung, `not_feasible` vor `dislike`), `swapCandidates`/`swapCandidatesFor` (S-1 bis S-8,
  Reihenfolge 4.1, höchstens 6, schwerere Variante nur „heute“ am Ende), `canExclude`, `applyExercisePreferences`
  (B1/B2, S8, S9, S10), `preferenceNotices`, `upsertPreference`/`removePreference`, `pairStoredAndShown`.
- **`plan/day-swaps.ts`:** `daySwapSchema` (strikt), `parseStoredDaySwaps` (kaputter Speicher, fremdes Konto),
  `applyDaySwaps` (B3, N1, N2), `pruneDaySwaps` (N1 über `canCatchUp`), `upsertDaySwap`/`removeDaySwap`.
- **`plan/view.ts`:** `prepareSessionForDisplay` mit Paaren → Präferenzen → Day-Swaps → Neu-Nummerierung;
  `DisplaySession` mit `storedOrderNos`, `hiddenByPreference`, `preferenceSwapped`, `daySwapped`, `keptDisliked`,
  `preferenceNotices`, `droppedDaySwaps`, `emptyByPreference`; `displayPairs`; `exerciseMark` mit `'preference'` und
  `'day_swap'` (K6); `sessionLocationInfo` (S4).
- **Trainingsmodus (`log/workout.ts`, `log/harder-variant.ts`, `plan/equipment-profile.ts`):** `allowedAlternatives`
  als Mantel um `swapCandidatesFor(…, 'today')` (S1), `findHarderVariant`/`progressHintForDisplay` mit `exclude` (S2),
  `alignShownExercises` über `storedOrderNos`, `planWorkout` mit Präferenzen/`swapRules`, V9 mit
  `WeekPreferenceLayer` (S3, N6).
- **PDF:** `ExportDisplayContext.preferences`/`swapRules` (nie Day-Swaps), Markierung `mark.preferenceSwap`
  („getauscht (deine Wahl)“), neutraler Druckhinweis `session.preferenceOmitted` (K7); bei nur wegen Präferenzen
  leerer Einheit kein „Plan neu erstellen“.
- **Tests:** `preferences.test.ts`, `day-swaps.test.ts`, `view-swap.test.ts` (Regression über Profile × Regeln,
  Pflicht-Tests 1, 2, 4–7, 9, 11, Markierungen), `swap-properties.test.ts` (Eigenschaftstest mit Regeländerungen nach
  der Erstellung, 160 Zufallsfälle; Echte-Inhalte-Snapshot „kein ‚Ab jetzt immer‘“), Ergänzungen in
  `start-group.test.ts`, `workout.test.ts` (Pflicht-Tests 8 und 10, Snapshot „Alternativen vorher/nachher“,
  Progression nach Tausch), `harder-variant.test.ts`, `equipment-profile.test.ts`, `rest-timer.test.ts` (Pflicht-Test 5,
  Ein-Mitglied-Supersatz), `training-plan-document.test.ts`.

**Abweichungen und Festlegungen:**

1. **N7 entschieden: Abweichung festgehalten.** Das Glossar (`similar`, `availableForMe`) bleibt bei den **aktuellen**
   Regeln. Begründung: Das Glossar setzt nichts in den Plan ein und braucht keinen Plan (auch ohne Plan nutzbar); nur
   der Tausch verändert die Anzeige, und er prüft immer mit `displaySwapRules`. Nach einer Lockerung kann das Glossar
   daher eine Übung als „ähnlich“ zeigen, die der Tausch (noch) nicht anbietet – sicher, nur uneinheitlich. Erst nach
   „Plan neu erstellen“ stimmen beide überein.
2. **Signaturen** leicht anders als in 7.2, ohne fachlichen Unterschied: `preferencesAt(prefs, location, ambiguous)`
   statt `'both'` (der geratene Ort liefert den Ersatz zuerst); `canExclude(pair, pref, ctx)` prüft die ganze
   Präferenz mit Zod (statt `kind, location` einzeln) und liefert einen Grund (`invalid`, `library_missing`,
   `no_candidate`, `limit_reached`, `replacement_not_candidate`); `applyExercisePreferences(pairs, { kind,
exerciseCount }, ctx)` und `applyDaySwaps(pairs, session, swaps, ctx)` arbeiten auf den Paaren;
   `exerciseMark(exercise, stored, ctx, { storedOrderNo, display })` – der neue vierte Parameter ist optional, damit
   die App bis T2 unverändert bleibt. Die neuen `DisplaySession`-Felder sind im Typ optional, werden von
   `prepareSessionForDisplay` aber immer gesetzt.
3. **Bezugspaar je Schicht:** Die Präferenz-Schicht prüft gegen (S, X nach Sicherheit), die Day-Swap-Schicht gegen
   (S, angezeigt nach Präferenzen) – die Schwierigkeit bleibt damit ≤ min(S, X). Für den Tausch-Dialog (T2) liefert
   `displayPairs()` das Paar (S, angezeigt); die Präferenz hängt an der angezeigten Übung (4.0).
4. **Türrahmen-Rudern → Handtuch-Rudern ist kein Kandidat:** Handtuch-Rudern ist eine Halteübung (S-4, nie Wdh. ↔
   Halten). Im Körpergewicht-Plan ohne Geräte hat Türrahmen-Rudern daher keinen Kandidaten („immer“ nicht
   angeboten; bei `not_feasible` → `preference_key_pattern_missing`). Die Beispiele in 7.4 und Abschnitt 13
   (Handy-Test Schritt 4) müssen in T2 eine andere Übung nehmen; die Lücke steht im Echte-Inhalte-Snapshot
   (`packages/core/src/plan/__snapshots__/swap-properties.test.ts.snap`) als Hinweis für die Content-Pflege.
5. **Grundbausteine (4.2):** `missingKeyPattern` meldet eine weggefallene Übung, wenn danach keine Übung derselben
   Gruppe mehr in der Einheit steht – Gruppen: Zug (`horizontal_pull` + `vertical_pull`) und Hüftbeuge (`hinge`).
6. **Doppelte Präferenzen** (kaputter Speicher, gleiche Übung und Ort) werden wie bei mehrdeutigem Ort
   zusammengeführt (`not_feasible` gewinnt).
7. **Day-Swaps:** IDs (`ownerUserId`, `planId`, `sessionId`) sind UUIDs; je Konto, Einheit und Position höchstens ein
   Eintrag; über 200 fallen die ältesten weg. Doppelte Einträge für dieselbe Position: nur der erste (nach
   `createdAt`) gilt, der Rest kommt in `droppedDaySwaps`. Nachholen heute (N1): `DisplayContext.catchUpToday`
   (die App berechnet es mit `canCatchUp`), `pruneDaySwaps` prüft es selbst.
8. **Schwerere Variante:** Mit Tausch-Kontext (`preferences` bzw. `swapRules` im `PlanExerciseContext`) nutzt
   `progressHintForDisplay` die `swapRules` und schließt Ausschlüsse des Orts und die Übungen der Einheit aus. Ohne
   diesen Kontext ist der Hinweis unverändert (Regression).
9. **App-Änderungen in T1 (nur zwei Stellen):** Die zwei neuen Druck-Codes stehen in
   `apps/mobile/src/lib/print-document.ts` und `i18n/de.ts` („getauscht (deine Wahl)“, „1 Übung ausgelassen (deine
   Wahl)“), damit `apps/mobile` typsicher bleibt. Außerdem übergibt `apps/mobile/src/data/workout-session.ts` dem
   Trainingsmodus die Plan-Untergrenze (Wächter T1-S1, siehe unten). Präferenzen und Day-Swaps übergibt die App erst
   in T2.
10. **N4** (laufender Entwurf mit Alternative aus der alten Liste): geprüft – der Entwurf prüft die Alternative beim
    Fortsetzen nicht gegen die Liste (`alternativeTarget` schlägt nur in der Bibliothek nach). Ein App-Test dafür kommt
    mit T2.
11. **`PLAN_ENGINE_VERSION` bleibt 3**, `inputs` unverändert. Bewusste Änderung nur in der Alternativen-Liste des
    Trainingsmodus (Snapshot `packages/core/src/log/__snapshots__/workout.test.ts.snap`: nur Zugänge, keine Abgänge;
    jeder neue Kandidat erlaubt, machbar, nicht schwerer, gleiches Muster).

**Nachträge aus der Wächter-Prüfung T1 (`waechter-t1.md`, Urteil „mit Auflagen“) – umgesetzt:**

- **S1:** `workout-session.ts` übergibt `swap: { swapRules: displaySwapRules(active.plan, birthDate, rules) }`.
  App-Test: Plan in der Schwangerschaft erstellt, Schwangerschaft beendet (Plan nicht neu erstellt) → im
  Trainingsmodus keine Alternative mit `long_supine`/`overhead`; Gegenprobe mit nur den aktuellen Regeln zeigt solche
  Übungen (der Test schlägt ohne die Zeile an).
- **S2 – entschieden: per Typ (Variante a).** Kein Rückfall `?? rules` mehr:
  - `DisplayContext.swap?: { swapRules; location; ambiguousLocation?; preferences?; daySwaps?: { swaps; planId;
ownerUserId; today; catchUpToday? } }` – Präferenzen und Day-Swaps gibt es nur im Bündel mit **Pflichtfeld**
    `swapRules`; ohne `swap` laufen keine Tausch-Schichten (sichere Richtung). Typ-Test mit `@ts-expect-error`.
  - `PlanExerciseContext.swap: { swapRules; preferences?; location?; ambiguousLocation? }` ist **Pflicht**:
    Alternativen und schwerere Variante prüfen immer mit der Plan-Untergrenze; die schwerere Variante schließt
    immer die Ausschlüsse des Orts und die Übungen der Einheit aus (Folge: eine Variante, die schon in der Einheit
    steht, wird nicht mehr vorgeschlagen).
  - `ExportDisplayContext.swap?: { swapRules; preferences }` (PDF).
  - Die flachen Felder (`preferences`, `location`, `swapRules`, `daySwaps`, `today`, `planId`, `catchUpToday`) aus
    Umsetzungsstand-Punkt 2 sind damit ersetzt.
- **K2:** `applyDaySwaps` prüft das Konto selbst (`ownerUserId` im Kontext); fremde Swaps fallen weg (Test).
- **K3:** `canExclude` bekommt `profiles` je Ort und prüft mit dem Profil des **gewählten** Orts (Test „geraten zu
  Hause, gewählt Studio“).
- **K4:** Gleichheitstest zusätzlich mit S ≠ X, Präferenzen, Einheit, schwererer Variante und mehrdeutigem Ort, mit
  unabhängigen Erwartungen.
- **K5:** Snapshot „Alternativen vorher/nachher“ vergleicht jetzt die **Reihenfolge** und rechnet mit der schwereren
  Variante (erste `harder`-Alternative) – weiterhin keine Abgänge.
- **K6:** Eigenschaftstest mit wirksamen Day-Swaps (Zähler > 20), „archivierter“ Übung (nur Nachschlagen, nie Ersatz)
  und gelegentlichem Altersübergang (+2 Jahre).
- **K7:** PDF-Fassungen trennen sich auch nach Präferenz-Markierung je Zeile und Zahl der ausgelassenen Übungen
  (Test „einmal getauscht, einmal geplant“).
- **K9:** `daySwapSchema.storedOrderNo` 1–8 (`DAY_SWAP_LIMITS.maxStoredOrderNo` = `PLAN_BLOCK_LIMITS.exercisesPerSession`,
  wie `planned_exercises.order_no`).

**Offene Punkte aus der Wächter-Prüfung T1:**

- **K1 – Fachprüfung der neuen Trainingsmodus-Alternativen** (Content-Pflege): regelkonform, aber für Einsteiger teils
  überraschend, z. B. `rdl-einbeinig-koerpergewicht → rumaenisches-kreuzheben-langhantel, kettlebell-swing`
  (ballistisch), `kniebeuge-koerpergewicht → beinpresse`, `fliegende-kabel → bankdruecken-kurzhantel/liegestuetz`
  (Isolation ↔ Grundübung). Grundlage: Snapshot `packages/core/src/log/__snapshots__/workout.test.ts.snap`. Mögliche
  Folge: Stufe 3 auf gleiche `mechanics` begrenzen oder ballistische Übungen kennzeichnen.
- **K8 – in T2 sichtbar machen:** Eine Präferenz auf eine archivierte angezeigte Übung wird ignoriert (S-8), auch bei
  „Hier nicht machbar“. Die Einstellungen müssen sie als „nicht mehr verfügbar“ mit „Entfernen“ zeigen (8.2).
