# Plan „Kalender, Tages- und Wochenauswertung“ (Gründer-Wünsche 15.10.2026)

**Status:** Freigegeben am 15.10.2026 – alle Entscheidungen A-G1 bis A-G20 „wie empfohlen“ (Abschnitt 14). Umsetzung etappenweise, jede Etappe mit Wächter-Prüfung. **A1a (Trainingskalender mit Drag-and-drop und Tauschen) umgesetzt** – Stand 15.10.2026 (Umsetzungsstand A1a am Ende von Abschnitt 3). **A1b (Nachtragen und freie Einheit) umgesetzt** – Stand 15.10.2026 (Umsetzungsstand A1b am Ende von Abschnitt 4). **A2 (Tagesauswertung „Dein Tag“) umgesetzt** – Stand 15.10.2026 (Umsetzungsstand A2 am Ende von Abschnitt 6). **A3 (Wochenauswertung) umgesetzt** – Stand 15.10.2026 (Umsetzungsstand A3 am Ende von Abschnitt 8). **E3 (Gericht per Foto) als Testversion mit Attrappe umgesetzt** – Stand 16.10.2026 (Umsetzungsstand E3 am Ende von Abschnitt 9).

**Grundlage:** `CLAUDE.md`, `docs/KONZEPT.md` (4, 6.1–6.3, 11.3, 12), `docs/PLAN-PHASE-3.md` 5.11, `docs/PLAN-PHASE-4.md` (3.1–3.6, 5.6, Frage 6), `docs/PLAN-PHASE-4B.md`, `docs/PLAN-PHASE-5.md` (4.6, 4.6.1, 4.9, 6.2, 7.1, 13 X0–X2), `docs/PLAN-ZIELE.md` (3, K6, F7, F14), `docs/DESIGN.md`, Code-Stand vom 15.10.2026.

---

## 0. Kurzfassung

Ihr wünscht euch drei Dinge:

1. **Trainingskalender:** Einheiten per Drag-and-drop verschieben, neue hinzufügen, vergangene nachtragen.
2. **Tagesauswertung:** Kalorienbalken mit Ist und Tagesziel, Farben rot – gelb – grün – gelb – rot, dazu die Trainingseinheiten des Tages. Für jeden Tag aufrufbar.
3. **Wochenauswertung:** Kalorien der Woche gegen das Ziel und wie die Trainingsziele der einzelnen Einheiten erreicht wurden.

**Das Wichtigste vorweg:**

- **Es gibt noch kein Ernährungstagebuch.** Die App weiß heute nicht, was ihr gegessen habt. Ohne diese Daten gibt es keinen Kalorienbalken. Deshalb kommt das **Ernährungstagebuch als eigene Etappen** in diesen Plan (Ergänzung der Gründer, 15.10.2026), aufbauend auf den Skizzen X0–X3 aus PLAN-PHASE-5 Abschnitt 13 und KONZEPT 6.1, 6.2, 6.4:
  - **E1 Ernährungstagebuch** (gratis): Mahlzeiten über den Tag eintragen, „Gegessen“ per Tipp aus dem Essensplan, Lebensmittel aus dem Katalog, Schnelleintrag, Zuletzt gegessen/Favoriten, offline.
  - **E2 Eigene Gerichte** (gratis): „Mein Porridge“ anlegen und mit einem Tipp eintragen.
  - **E3 Gericht per Foto mit KI** (Premium, Google Gemini): Foto + kurze Info („mit Sahnesoße, halbe Portion“) → Vorschlag zum Bestätigen.
  - **E4 Barcode/Open Food Facts** (optional, gratis).
- **Der Gratis-Weg ist vollständig:** E1 + E2 reichen für Tagesbalken und Wochenauswertung. KI ist nur eine bequeme Abkürzung.
- **Training ist schon weit:** Verschieben (automatisch auf den nächsten freien Tag), Tagebuch mit Sätzen, Wdh., Gewicht und Ausdauer-Dauer gibt es. Neu sind: Ziel-Tag frei wählen (Drag-and-drop), freie Einheiten und Nachtragen mit Datum.
- **Sicherheit bleibt fest:** Die Farben hängen an euren Schutzgrenzen (nie unter Grundumsatz, max. 25 % Defizit). Unter der Untergrenze ist es nie „gelb“ oder „grün“. Bei „Kalorienzahlen aus“ und in Schwangerschaft/Stillzeit gibt es **keinen** Kalorienbalken.

**Vorgeschlagene Reihenfolge:**

1. **A1a** Kalender mit Drag-and-drop → **A1b** Nachtragen/freie Einheit (Training, sofort nutzbar, auch im Supabase-Modus).
2. **E1** Ernährungstagebuch → **A2** Tagesauswertung (Kalorienbalken baut auf E1 auf).
3. **E2** Eigene Gerichte → **A3** Wochenauswertung.
4. **E3** Foto-KI (Premium, hinter Feature-Flag).
5. Optional: **E4** Barcode, **A1c** zusätzliche Einheit in der Zukunft.

Die Trainings-Etappen (A1) und die Ernährungs-Etappen (E1) hängen nicht voneinander ab und können auch in anderer Reihenfolge kommen.

---

## 1. Ist-Stand (geprüft am 15.10.2026)

### 1.1 Verschieben

- `packages/core/src/plan/reschedule.ts` → `rescheduleSession()`: sucht **automatisch** den nächsten freien Tag ab heute in derselben ISO-Woche mit 48 h Erholung (Kraft gegen Kraft mit gleichen Muskeln). Erholungswoche: nur streichen. Sonst: streichen (mit Rückfrage).
- „Heute“ (`apps/mobile/src/app/today.tsx`) hat den Knopf „Verschieben“ – aber **ohne** Wahl des Ziel-Tags.
- Datenbank-Trigger `private.planned_sessions_before_update`: nur Datum/Status änderbar, nur aktiver Plan, nur ab heute, nur dieselbe ISO-Woche, Erholungswoche nicht verschiebbar. Index `planned_sessions_one_per_day_idx`: nie zwei Einheiten an einem Tag.
- Die 48-h-Regel prüft nur der Core (nicht die Datenbank).

### 1.2 Nachtragen und Hinzufügen

- Server (`save_session_log`) erlaubt Einträge bis **14 Tage zurück** (`SESSION_LOG_LIMITS.backdateDays`), aber nur in der ISO-Woche der geplanten Einheit (± 1 Tag).
- Die App setzt `performed_on` heute **immer auf heute** (`data/workout-session.ts`). Einen Datumswähler zum Nachtragen gibt es nicht. „Heute nachholen“ gibt es (`canCatchUp`).
- **Freie Einheiten ohne Plan** sind bewusst verschoben (PLAN-PHASE-4 Frage 6). Das Datenmodell lässt `planned_session_id = null` zu – aber genau das bedeutet heute „verwaist“ (Plan ersetzt). Freie und verwaiste Einträge sind also noch nicht unterscheidbar.

### 1.3 Trainingsziele je Einheit und Ist-Werte

- **Kraft – Soll:** `planned_exercises` (Sätze, Wdh.-Bereich) und als Schnappschuss je Eintrag in `exercise_logs` (`target_sets`, `reps_min/max`, `target_reps`, `target_weight_kg`, `target_duration_s`, `target_rpe`).
- **Kraft – Ist:** `set_logs` (Wdh., Gewicht, Haltedauer, RPE, `done`), Status je Übung (`done | skipped | alternative`).
- **Ausdauer – Soll:** `planned_sessions.estimated_minutes` und `effort_target` (1–4, locker). **Eine geplante Distanz gibt es nicht.**
- **Ausdauer – Ist:** `cardio_logs` (Dauer, Distanz, Höhenmeter), `session_rpe`.
- Wochenübersicht `weekLogSummary()` (`log/summary.ts`) zählt schon Einheiten, Sätze, Minuten, km – aber **keine Zielerreichung**.

### 1.4 Gegessene Kalorien

- **Gibt es nicht.** Keine Tabelle, kein Abhaken. `food_log_entries` ist in KONZEPT 6.1 und PLAN-PHASE-5 Abschnitt 13 nur skizziert (X0 Entscheidung, X1 Barcode, X2 Tagebuch).
- „Gegessen per Tipp“ steht in KONZEPT 6.3 – dort als Teil der **Premium**-Vorschläge rund ums Training (X4). Der Tracker selbst (6.1) ist **gratis**.
- Die Bewertung „Wie war’s?“ (N10) speichert nur Daumen hoch/runter, keine Menge.
- **Brauchbar für das Tagebuch:** Der Lebensmittel-Katalog (`foods`, Nährwerte je 100 g, Einheiten wie „Stück“) und die Rezepte mit Nährwerten je Portion gibt es schon (N2/N7). Essensplan-Mahlzeiten haben kcal/Makros als Schnappschuss (`meal_plan_items`).
- **Entschieden (X0, PLAN-PHASE-5 16 A Nr. 18):** nur Produktarten, keine Marken in Vorschlägen. Offen aus X0: Einwilligung fürs Tagebuch (hier A-G12).
- **KI-Infrastruktur:** `ai_usage`, Premium-Prüfung `hasEntitlement()` und Abos kommen erst mit Phase 7. Bis dahin: Feature-Flag + Beta-Freischaltung per Workflow `beta-grant` (PLAN-PHASE-4B 6.3). Die Content-Pipeline wird gerade für Gemini als Anbieter umgebaut (parallele Arbeit N8) – E3 nutzt das **nicht** (Batch ≠ Echtzeit), aber dieselbe Anbieter-Entscheidung.

### 1.5 Tagesziel, Planband, Sonderfälle

- `nutritionTargetsForWeek()` rechnet je Tag: `targetKcal`, `floorKcal` (Untergrenze), `ceilingKcal` (Obergrenze), `band` (Planband, bisher „nur intern“). Nichts davon wird gespeichert (Gesundheitsdaten, PLAN-PHASE-5 7.1).
- Planband = `[max(Untergrenze, Ziel × 0,9); min(Ziel × 1,1, Obergrenze)]`.
- `clampCalorieTarget` ist die **einzige** Stelle mit Schutzgrenzen – die Auswertung darf keine eigenen Grenzen rechnen.
- Tage mit Status `below_floor`: Der Plan selbst erreicht die Untergrenze nicht.
- Modus `no_targets` (Schwangerschaft/Stillzeit, keine Einwilligung, keine Körperdaten): kein Ziel. `showNumbers` (Schalter „Kalorienzahlen anzeigen“ + Schwangerschaft) blendet alle kcal aus.
- Das Tagesziel hängt an den **geplanten** Einheiten (`sessionsForDay`): vergangene Tage nur `completed`. Verschieben ändert also die Tagesziele.
- **Ernährung läuft im Testmodus und seit N7 Teil 2 (16.10.2026) auch mit Konto** – inkl. Tagebuch (E1) und eigener Gerichte (E2); Essenspläne/Einkaufslisten werden nach 4 Wochen gelöscht (G-N7-2), das Tagebuch nicht.

### 1.6 Technik für Drag-and-drop

- `react-native-gesture-handler` 2.32 und `react-native-reanimated` 4.5 sind schon installiert. Beide laufen nativ und im Web-Export.
- `expo-haptics` ist da (kurzes Vibrieren beim Aufnehmen).
- Barrierefreiheit: `accessibilityActions` werden schon genutzt (`components/workout.tsx`).

---

## 2. Fachliche Festlegungen (Vorschläge)

### 2.1 Farbbänder des Kalorienbalkens – VOR LIVEGANG FACHLICH PRÜFEN

Bezeichnungen je Tag: **Z** = Tagesziel, **U** = Untergrenze (`floorKcal`), **O** = Obergrenze (`ceilingKcal`), **B** = Planband `[B_min; B_max]`. Alle Werte kommen aus `nutritionTargetsForWeek()` – keine eigene Rechnung.

| Zone                | Bedingung (gegessen = G) | Farbe | Text (Entwurf)                 |
| ------------------- | ------------------------ | ----- | ------------------------------ |
| unter Mindestbedarf | G < U                    | rot   | „Unter deinem Mindestbedarf“   |
| ausreichend         | U ≤ G < G0               | gelb  | „Etwas unter deinem Tagesziel“ |
| im Zielbereich      | G0 ≤ G ≤ B_max           | grün  | „Im Zielbereich“               |
| etwas darüber       | B_max < G ≤ R            | gelb  | „Etwas über deinem Ziel“       |
| deutlich darüber    | G > R                    | rot   | „Deutlich über deinem Ziel“    |

mit **R = max(O; Z × 1,20)** und **G0 = Beginn von Grün**: B_min; **beim Abnehmen** (Tag mit Defizit, `goalAdjustment < 0`) **G0 = max(U; Z × 0,95; B_min)** – Gründer-Entscheidung G1 vom 15.10.2026: „Grün in einem gesunden Bereich, also erst etwa ab dem Tagesziel“ (0,95 = Rundungs- und Alltagstoleranz, Konstante `INTAKE_ZONES.lossGreenFromTargetFactor`, VOR LIVEGANG FACHLICH PRÜFEN). Halten und Aufbau unverändert.

**Begründung:**

- **Grün = Planband (Ziel ± 10 %, aber nie unter U).** Das Band ist schon die fachlich geprüfte Toleranz des Essensplans. Ein Tag nach Plan ist also grün. **Ausnahme Abnehmen (G1, 15.10.2026):** Grün erst ab max(U; Z × 0,95) – ein Tag knapp über der Untergrenze ist dort gelb „Etwas unter deinem Tagesziel“ (kein Lob für weniger, keine Aufforderung, mehr zu essen als nötig).
- **Unter U ist immer rot.** Die Untergrenze ist die Schutzgrenze (Grundumsatz, 25 %-Deckel, 1 %/Woche, Energieverfügbarkeit). Ein Tag darunter darf nie „ausreichend“ heißen. Liegt U schon bei 90 % von Z, gibt es keine untere gelbe Zone.
- **Gelb unten = sicher, aber unter Ziel.** Das ist „ausreichend“ im Sinne eurer Vorgabe.
- **Rot oben erst ab der Obergrenze O** (bei Abnehmen etwa Tagesbedarf + 10 %). Ein Tag auf Erhaltungsniveau ist beim Abnehmen damit **gelb, nicht rot**. Das schützt vor Schuldgefühlen und passt zur Planlogik: Rot heißt „mehr, als wir je planen würden“.
- **Z × 1,20** sorgt bei Muskelaufbau (O liegt dort nah am Ziel) für eine sichtbare gelbe Zone.

**Beispiel Abnehmen (Ruhetag, neu gerechnet 15.10.2026):** Z = 1.800, U = 1.725, B = [1.725; 1.980], O = 2.530 → G0 = max(1.725; 1.710; 1.725) = 1.725 → rot < 1.725, grün 1.725–1.980 (keine gelbe Zone unten, weil U schon über 95 % von Z liegt), gelb 1.981–2.530, rot > 2.530. (Der frühere Entwurf „gelb 1.725–1.799, B_min = Z“ war falsch gerechnet: B_min = max(U; 0,9 × Z) = 1.725.)

**Beispiel Abnehmen mit größerem Abstand:** Z = 2.000, U = 1.700, B = [1.800; 2.200], O = 2.640 → G0 = max(1.700; 1.900; 1.800) = 1.900 → rot < 1.700, gelb 1.700–1.899, grün 1.900–2.200, gelb bis 2.640, rot darüber.

**Beispiel Erhalt:** Z = 2.400, U = 1.800 → rot < 1.800, gelb 1.800–2.159, grün 2.160–2.640, gelb bis 2.880, rot darüber.

Die Grenzen landen als Konstante `INTAKE_ZONES` (Faktor 1,20, beim Abnehmen 0,95 für den Beginn von Grün, Quelle/Markierung „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“) in `packages/core/src/constants.ts`.

### 2.2 Heute anders als vergangene Tage

Am Morgen ist jeder Balken „unter dem Ziel“. Ein roter Balken um 8 Uhr wäre falsch und erzeugt Druck.

- **Heute:** Unter B_min füllt sich der Balken in **neutraler Farbe** (Markenfarbe) mit dem Text „Noch offen“. Ab B_min grün, darüber gelb/rot wie oben.
- **Vergangene Tage:** volle Farbskala.
- **Tage ohne Eintrag:** grau, „Nichts eingetragen“ – **nie** als 0 kcal und nie rot.
- **Künftige Tage:** nur Tagesziel und Plan, kein Balken.
- Rot unten an einem vergangenen Tag immer mit dem Satz: „Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.“

### 2.3 „Kalorienzahlen aus“, Schwangerschaft/Stillzeit, keine Ziele

| Fall                                                            | Was die Tagesauswertung zeigt                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| „Kalorienzahlen anzeigen“ aus                                   | **Kein Kalorienbalken, keine Farben fürs Essen.** Nur eine neutrale Liste „Mahlzeiten heute: 3 von 4 abgehakt“ und der Trainingsteil. |
| Schwangerschaft/Stillzeit (`no_targets`, `showNumbers = false`) | wie „Zahlen aus“ + bestehender Hinweis (Ärztin/Arzt/Hebamme). Keine Zahl, keine Farbe.                                                |
| Keine Körperdaten oder keine Einwilligung                       | Kein Ziel → kein Balken. Ohne Einwilligung auch kein Tagebuch (2.7). Einladung „Mit Größe und Gewicht …“ wie bisher.                  |
| Plan-Tag `below_floor`                                          | Balken normal. Der bestehende Hinweis „Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze …“ steht dabei.                       |

Begründung: Wer Zahlen ausblendet, will weniger Fokus auf Kalorien. Ein Balken ohne Zahlen bewertet trotzdem das Essen. Deshalb gibt es dann gar keine Bewertung, nur die Liste.

### 2.4 Sprache und Essstörungs-Sensibilität

- Keine Schuld- oder Leistungssprache: nie „geschafft“, „versagt“, „gesündigt“, „Cheat“, „zu viel gegessen“, „verdient“.
- Rot oben = „Deutlich über deinem Ziel. Ein einzelner Tag ändert wenig.“ Kein Ausrufezeichen, kein Warnsymbol.
- Rot unten = Fürsorge, nicht Lob: „Unter deinem Mindestbedarf. Dein Körper braucht an solchen Tagen mehr – z. B. eine Portion Obst, Nüsse oder Joghurt.“
- **Keine „verbrannten Kalorien“** anzeigen und nie „Training = mehr essen dürfen“. Ein Trainingstag heißt neutral: „Trainingstag – dein Ziel ist heute höher.“
- Keine Serien, keine Abzeichen, keine „perfekte Woche“, keine Bilanz „X kcal eingespart“, keine Gewichtsprognose (PLAN-ZIELE F7).
- **Muster-Hinweis:** Liegen in einer Woche **3 oder mehr** vergangene Tage unter der Untergrenze, zeigt die Wochenauswertung einmal den festen Essstörungs-Hinweis mit Hilfe-Kontakten (gleicher Text wie Phase 5 4.9). Kein Hinweis bei Tagen über dem Ziel.
- Farbe nie allein: immer Text und Symbol dazu (DESIGN.md, Rot-Grün-Schwäche).
- Keine Auswertungsdaten an Analytics oder in Logs.

### 2.5 „Trainingsziel erreicht“ – Definition (PRODUKTENTSCHEIDUNG, VOR LIVEGANG FACHLICH PRÜFEN)

Neue Core-Funktion `sessionAchievement()` rechnet je Einheit einen Erfüllungsgrad 0–100 % (nach oben gekappt – mehr bringt keine Extra-Punkte).

**Kraft** (je Übung, dann Mittel über alle geplanten Übungen):

- **Satz zählt als erfüllt**, wenn abgehakt **und** Wdh. ≥ `reps_min` (bzw. `target_reps`; Halteübung: Dauer ≥ 90 % von `target_duration_s`) **und** Gewicht ≥ Vorgabe − eine Gewichtsstufe (`weightStepsFor`).
- Übung = erfüllte Sätze / `target_sets`. Ausgelassene Übung = 0. Alternative Übung = gegen **ihre eigene** gespeicherte Vorgabe.
- Ohne Vorgabe (z. B. Kalibrierung, freie Einheit): nur „gemacht“, kein Prozentwert.

**Ausdauer:**

- Dauer = eingetragene Minuten / `estimated_minutes`.
- Distanz: nur angezeigt (es gibt kein Distanz-Ziel).
- Anstrengung: Liegt `session_rpe` mehr als 2 über `effort_target`, kommt ein Hinweis „Etwas lockerer als geplant hilft der Erholung“ – das ist kein „nicht erreicht“.
- Mehr als 110 % der Dauer: neutraler Hinweis „Länger als geplant – dein Plan steigert trotzdem nur in kleinen Schritten.“ (Die 10 %-Regel nutzt ohnehin höchstens die geplanten Minuten, `enduranceReferenceFromBlock`.)

**Stufen:**

| Stufe                         | Bedingung    | Text                     |
| ----------------------------- | ------------ | ------------------------ |
| erreicht                      | ≥ 90 %       | „Ziel erreicht“          |
| größtenteils                  | 60–89 %      | „Größtenteils geschafft“ |
| teilweise                     | 1–59 %       | „Teilweise gemacht“      |
| offen / verpasst / gestrichen | kein Eintrag | wie heute in der Woche   |

Erholungs- und Einstiegswoche: gleiche Rechnung, aber Text „Erholungswoche – leichter ist hier richtig“.

### 2.6 Trainingssicherheit beim Verschieben, Hinzufügen und Nachtragen

**Verschieben (A1a)** – neue Core-Funktion `moveTargets(sessions, sessionId, today)` liefert für **jeden** Tag der Woche „erlaubt“ oder einen Grund. Sie nutzt dieselbe Logik wie `rescheduleSession()`:

- nur ab heute und nur in derselben ISO-Woche (Datenbank-Regel bleibt),
- Erholungswoche: nur streichen,
- nie zwei Einheiten an einem Tag,
- 48 h zwischen Kraft-Einheiten mit gleichen Muskeln; lockere Ausdauer ist nie ein Konflikt,
- erledigte Einheiten sind nicht verschiebbar.

Alle Gründe sind **harte Sperren**, keine Warnungen – wie bisher. Beim Ziehen leuchten erlaubte Tage auf; gesperrte Tage zeigen den Grund („Zu nah an deiner Bein-Einheit am Mittwoch“).

Optional (Frage A-G4): **Tauschen** – eine Einheit auf einen belegten Tag ziehen tauscht beide, wenn beide Einheiten danach alle Regeln erfüllen. Das braucht eine neue Server-Funktion, weil der Ein-Einheit-pro-Tag-Index sonst dazwischen greift.

**Nachtragen (A1b):**

- Geplante Einheit nachtragen: Datum wählbar, Regeln wie Server (gleiche ISO-Woche ± 1 Tag, höchstens 14 Tage zurück, nie in der Zukunft, nie zwei geplante am Tag).
- Gleiche Plausibilitätsprüfung wie live (`setEntryWarnings`, `needsWeightConfirmation`, `cardioPlausibility`).
- **Wirkung auf die Progression:** Eine nachgetragene **geplante** Einheit zählt normal (sie ist echt trainiert). Die Progression ordnet nach `performed_on`, deshalb bleibt die Reihenfolge richtig.
- In Tagebuch und Verlauf steht „nachgetragen“ (aus `created_at` und `performed_on` ableitbar, keine neue Spalte).

**Freie Einheit (A1b)** – heute oder bis 14 Tage zurück, Kraft (Übungen aus der Bibliothek) oder Ausdauer (Art, Dauer, Distanz, Anstrengung):

- zählt **nicht** für die Progression und nicht für den 10 %-Bezug der Ausdauer (strenger als verwaiste Einträge: Die zählen seit Phase 4 für die Kraft-Progression und sind nur vom 10 %-Bezug ausgeschlossen – Gründer-Frage G1 im Umsetzungsstand A1b),
- zählt in Tages- und Wochenauswertung,
- Trainingsenergie zählt fürs Tagesziel (Frage A-G7). Das erhöht das Ziel nur – sicherere Richtung, Deckel `TRAINING_KCAL_DAY_MAX` bleibt.

**Zusätzliche Einheit in der Zukunft (A1c, optional):**

- nur lockere Ausdauer (Anstrengung ≤ 4) oder Wiederholung einer Kraft-Einheit des Plans,
- Wochen-Ausdauerminuten ≤ `floor(1,1 × Vorwoche)` (gleiche Funktion `increasedMinutes`),
- 48 h-Regel, nie zwei am Tag, **nie in der Erholungswoche**, höchstens die maximale Zahl Trainingstage je Woche,
- sie ändert den Plan-Block und die Live-Anpassung (4b). Deshalb empfehlen wir A1c erst nach 4b A (Frage A-G3).

### 2.7 Datenschutz (DSGVO Art. 9)

- **Ernährungstagebuch = Gesundheitsdaten (vorsorglich).** Es zeigt zusammen mit dem Tagesziel Rückschlüsse auf Körper und Essverhalten. Empfehlung wie X0: nur mit gültiger `health_data`-Einwilligung. Die bestehende Einwilligung deckt „Ernährungspläne/Kalorienbedarf“ ab. In die nächste Textfassung kommt „Ernährungstagebuch (was du als gegessen einträgst)“ – das löst eine Neu-Einwilligung aus (bestehender Ablauf).
- **Widerruf:** `consents_after_revoke()` löscht alle `food_log_entries`. Der Dialog sagt das vorher.
- RLS: Jeder liest nur eigene Zeilen. Schreiben nur über Server-Funktionen, kein Freitext mit Gesundheitsbezug.
- Export (`export_my_data`) und Konto löschen (Kaskade) inklusive.
- Ziele und Zonen werden **nie gespeichert**, nur gerechnet (wie Phase 5 7.1).
- Trainings-Auswertung: kein neues Gesundheitsdatum (Trainingsheft wie Phase 4 3.4).
- **Eigene Gerichte** (E2) sind für sich kein Gesundheitsdatum (wie Rezepte), werden aber zusammen mit dem Tagebuch exportiert und gelöscht. Beim Widerruf bleiben sie (Empfehlung), Tagebuch-Einträge gehen. **Entschieden 15.10.2026 (E2-G1, Abweichung von A-G14 ausdrücklich freigegeben): löschen** – der Name ist Freitext, deshalb nur mit Einwilligung und beim Widerruf gelöscht (Umsetzungsstand E2).
- **Foto-KI (E3):** eigene, getrennte Einwilligung `ai_food_photo` (Art. 9 + Übermittlung an Google als Auftragsverarbeiter, AVV, Serverstandort EU wählen). Foto nur so lange gespeichert, wie die Auswertung dauert (privater Bucket, Löschung nach Antwort, spätestens nach 24 h per Aufräum-Job). An Gemini gehen **nur** Foto (ohne EXIF/Standort), die kurze Info und die feste Anweisung – kein Name, keine Körperdaten, keine Ziele, keine Flags, keine Nutzer-ID. Gemini-Einstellung „keine Nutzung zum Training“ (bezahlte API) Pflicht. `ai_usage` speichert nur Funktion, Tokens, Kosten, Zeitpunkt.

---

## 3. Etappe A1a – Trainingskalender mit Drag-and-drop

**Ziel:** Neue Ansicht „Kalender“ (Wochenansicht Mo–So, untereinander, handygerecht). Einheiten per langem Druck aufnehmen und auf einen anderen Tag ziehen. Ersatz für alle: Knopf „Verschieben …“ mit Tagesauswahl.

**Core (`packages/core/src/plan/move.ts`) + Tests:**

- `moveTargets(sessions, sessionId, today)` → je Tag `{ date, allowed, reason? }`. Gründe: `past`, `other_week`, `occupied`, `recovery_48h`, `deload_skip_only`, `not_planned`.
- `validateMove(...)` für einen Ziel-Tag (gleiche Regeln, für Ablegen und Server-Vorprüfung).
- Optional `validateSwap(...)` (A-G4).
- Grenzfälle: 1 und 7 Trainingstage, Sonntag/Montag-Grenze, heute = Sonntag, Erholungswoche, Ganzkörper an Nachbartagen, Ausdauer neben Kraft, Einheit ersetzter Pläne, Wochenwechsel um Mitternacht. Eigenschaftstest: Jeder als „erlaubt“ gemeldete Tag wäre auch für den Datenbank-Trigger gültig, und `rescheduleSession()` wählt immer den ersten erlaubten Tag.

**Zod:** `moveRequestSchema { sessionId: uuid, targetDate: isoDate }`.

**DB:** Für reines Verschieben keine Migration nötig (bestehender Trigger). Nur bei Tauschen (A-G4): neue Funktion `swap_planned_sessions(p_a, p_b)` (`security definer`, gleiche Prüfungen wie der Trigger, atomar) + pgTAP.

**App:**

- Route `apps/mobile/src/app/kalender.tsx`; Einstieg von „Heute“ und „Woche“.
- Drag-and-drop **ohne neue Bibliothek**: Gesture Handler (`LongPress` + `Pan`) und Reanimated. Läuft nativ und im Web-Export. Beim Aufnehmen kurz vibrieren. Erlaubte Tage leuchten, gesperrte zeigen den Grund. Danach „Verschoben auf Donnerstag – Rückgängig“.
- **Barrierefreiheit:** Jede Karte hat den Knopf „Verschieben …“ → Liste der Tage mit „erlaubt“ oder Grund. Dazu `accessibilityActions` „Einen Tag früher/später“. Screenreader und Tastatur brauchen nie Drag-and-drop.
- Tippen auf einen Tag öffnet später die Tagesauswertung (A2).
- Nach dem Verschieben ändern sich die Tagesziele. Prüfen, ob die automatische Neuplanung des Essensplans (PLAN-PHASE-5 6.6) greift. Sonst Hinweis „Dein Essensplan passt evtl. nicht mehr – aktualisieren?“.

**Zustände:** Laden, kein Plan (Einladung), Woche ohne Einheiten, Erholungswoche (nur „Streichen“), Fehler vom Server („Verschieben nur ab heute und innerhalb derselben Woche“) → Einheit springt zurück, mit Text.

**Offline:** Verschieben läuft über die bestehende Warteschlange (`updatePlannedSession`). Der Core prüft vorher. Lehnt der Server später ab, springt die Einheit zurück und die App sagt es.

**Doku:** KONZEPT 4 (Verschieben mit Ziel-Tag), HANDY-ANLEITUNG.

**So testet ihr es am Handy (Vercel-Vorschau, Testmodus):**

1. Link aus dem Pull Request öffnen → „Ohne Konto testen“ → Plan mit 3 Kraft-Tagen.
2. „Kalender“ öffnen → Einheit lange drücken → auf einen freien Tag ziehen → „Rückgängig“ testen.
3. Eine Kraft-Einheit direkt neben eine andere ziehen → Tag ist gesperrt, Grund steht da.
4. Ohne Ziehen: „Verschieben …“ → Tag aus der Liste wählen.
5. Flugmodus an → verschieben → neu laden → bleibt verschoben.
6. Android-APK (Workflow `eas-build`): Ziehen mit dem Finger, Vibration.

### Umsetzungsstand A1a (15.10.2026)

**Was gilt:**

- **Core** `packages/core/src/plan/move.ts`: `moveTargets(sessions, sessionId, today)` liefert für jeden Tag Mo–So der Woche des ursprünglichen Termins `{ date, allowed, kind: 'move' | 'swap', reason?, otherSessionId?, partner?, conflict? }`; `validateMove()` für einen Ziel-Tag (freier Tag = verschieben, belegter Tag = tauschen, A-G4), `validateSwap()` für zwei Einheiten, `moveBlockReason()` als gemeinsame Regel. `rescheduleSession()` nutzt seitdem dieselbe Prüfung. Zod: `moveRequestSchema`, `swapRequestSchema` (strikt, UUID, ISO-Datum, zwei verschiedene Einheiten).
- **Datenbank** `supabase/migrations/20261015120000_swap_planned_sessions.sql` (rein additiv): `public.swap_planned_sessions(p_a, p_b, p_a_on, p_b_on)` – `security definer`, `search_path = ''`, `revoke` von `public`/`anon`, nur `authenticated`. pgTAP `supabase/tests/29_swap_planned_sessions.test.sql` (52 Prüfungen). Reines Verschieben nutzt weiter den bestehenden Trigger.
- **App** `apps/mobile/src/app/kalender.tsx` (Einstieg: „Heute“ → **Kalender**, „Woche“ → **Im Kalender verschieben**), Bausteine `components/calendar.tsx`, Texte `i18n/de.ts` (`calendar`), Formulierung `lib/calendar-format.ts`. Testmodus (`local-rules.ts` wie die Server-Funktion) und Supabase-Modus (`swapPlannedSessions` → RPC).
- **Tests:** Core 27 Tests in `move.test.ts` inkl. Eigenschaftstest (800 zufällige Wochen); App-Vitest (`plan-data.test.ts`, `supabase-backend.test.ts`, `calendar-format.test.ts`); Playwright `apps/mobile/e2e/calendar.spec.ts` (Drag-and-drop **und** „Verschieben …“-Menü, Rückgängig, Tauschen, Server-Ablehnung, kein Plan).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Weitere Gründe:** neben `past`, `other_week`, `occupied`, `recovery_48h`, `deload_skip_only`, `not_planned` gibt es `current` (die Einheit liegt schon dort) und `not_found`. `not_planned` gilt für erledigte, gestrichene **und** Einheiten ersetzter Pläne (der Trigger ändert nur Einheiten des aktiven Plans). Scheitert ein Tausch an der **anderen** Einheit, ist `partner: true` gesetzt („Tauschen mit „Beine“ geht nicht: Sie käme in die Vergangenheit.“).
2. **Tauschen:** Ein belegter Tag ist nur tauschbar, wenn dort genau **eine geplante** Einheit des aktiven Plans liegt und **beide** danach alle Regeln erfüllen (Woche des jeweils eigenen Ursprungstags, ab heute, keine Erholungswoche, 48 h für beide neuen Nachbarn). Eine erledigte Einheit, eine Einheit eines alten Plans oder zwei Einheiten am Tag → „belegt“.
3. **48 h an Nachbartagen mit mehreren Einheiten:** Jede Einheit zählt (z. B. erledigte des alten Plans neben einer geplanten). `rescheduleSession()` sah bisher nur eine je Tag (zufällig welche) – jetzt konservativer; alle bisherigen Tests bleiben grün.
4. **Server und 48 h:** `swap_planned_sessions` prüft – wie der Verschiebe-Trigger – die 48-h-Regel **nicht** (Core-Regel, vorher in `validateSwap`). pgTAP dokumentiert das ausdrücklich (Tausch Fr ↔ So geht am Server durch).
5. **Trigger und Index beim Tausch:** `planned_sessions_one_per_day_idx` ist ein eindeutiger **Index**, kein Constraint – nicht `deferrable`. Ein direktes Verschieben auf einen belegten Tag scheitert mit 23505 (pgTAP zeigt es). Die Funktion nutzt einen Zwischenschritt in einer Transaktion (A kurz `skipped`, B auf A's Tag, A auf B's Tag und zurück auf `planned`). Der Trigger greift in der Funktion nicht (`current_user` ist der Eigentümer), deshalb stehen alle seine Prüfungen in der Funktion selbst; beide Zeilen werden vorher `FOR UPDATE` in fester Reihenfolge gesperrt. `original_date` wie beim Verschieben nur beim ersten Mal.
6. **Offline:** Verschieben auf einen freien Tag läuft wie bisher über die Warteschlange (Pläne ohne Gesundheitsbezug; mit Gesundheitsbezug sofort). **Tauschen geht nie in die Warteschlange:** Es braucht den Server-Stand beider Einheiten. Wartende Verschiebungen werden vorher gesendet; ohne Verbindung: „Tauschen braucht kurz Verbindung. Auf einen freien Tag verschieben geht auch offline.“ Lehnt der Server eine wartende Verschiebung später ab, lädt die App neu und meldet es (bestehend, auch im Kalender).
7. **Ziehen im Browser:** Im Handy-Browser liegt das Ziehen auf dem Griff ⠿ (eigene Zeiger-Logik, Punkt 14; nur dort `touch-action: none`), damit die Seite über den Karten weiter scrollt (Risiko 4). Nativ ist die ganze Karte ziehbar (Pan erst nach 400 ms langem Druck, Vibration). Während des Ziehens scrollt die Seite nicht; es gibt **kein Auto-Scroll am Rand** – vorher so scrollen, dass Start- und Zieltag sichtbar sind, oder „Verschieben …“ nutzen. Hinweise am Tag erscheinen als Überlagerung, damit sich beim Ziehen nichts verschiebt.
8. **Essensplan:** Die automatische Neuplanung (PLAN-PHASE-5 6.6) greift beim Öffnen von „Ernährung“ nur, wenn eine Tagessumme ab heute aus dem Planband fällt (oder Modus/Deckel sich ändern); sonst bietet „Ernährung“ nur „Plan aktualisieren“ an (Ziele ≥ 5 % geändert). Deshalb zeigt der Kalender nach jedem Verschieben/Tauschen, das heute oder später betrifft, „Deine Trainingstage haben sich geändert. Dein Essensplan passt eventuell nicht mehr – aktualisieren?“ mit **Zum Essensplan** – nur, wenn die Ernährung eingerichtet ist (Supabase-Modus seit N7 Teil 2).
9. **Rückgängig** verschiebt bzw. tauscht zurück, nur solange der alte Tag noch erlaubt ist (nicht z. B., wenn er inzwischen in der Vergangenheit liegt); es verschwindet beim Verlassen des Bildschirms. `original_date` bleibt danach gesetzt (wie der Trigger).
10. **Bedienhilfen:** „Einen Tag früher/später“ (`accessibilityActions` am Namen der Einheit) = genau ein Tag – belegt → Tausch, gesperrt → Grund wird angesagt. Im Browser unterstützt React Native Web diese Aktionen nicht; dort ist „Verschieben …“ (Tastatur, Screenreader) der Weg.
11. **Erholungswoche:** Hinweis oben, die Einheiten sind im Kalender fest (kein Griff, kein „Verschieben …“); Streichen bleibt auf „Heute“.
12. **Nach der Wächter-Prüfung (15.10.2026) umgesetzt:**
    - **S1 – an den geprüften Stand gebunden:** Die App sendet die Tage mit, an denen sie beide Einheiten geprüft hat (`p_a_on`, `p_b_on`). Liegen sie nach dem Sperren nicht mehr dort (anderes Gerät, oder dieselbe Anfrage nach verlorener Antwort noch einmal), lehnt der Server mit „Der Plan hat sich inzwischen geändert.“ ab – so wird nie ein Tag getauscht, den der Core (48 h) nicht geprüft hat, und eine Wiederholung tauscht nie zurück. Der Testmodus prüft dasselbe. Nach **jedem** Fehler beim Verschieben/Tauschen lädt die App den Plan neu.
    - **S2 – Fehler unterschieden:** Der Server liefert einen `hint` (`move_rules`, `plan_changed`, `not_found`); Trigger-Meldungen ohne hint werden nach Text zugeordnet. Texte: Regel („Das geht nicht: Verschieben nur ab heute, innerhalb derselben Woche und nicht in der Erholungswoche …“), geänderter Stand („Dein Plan hat sich inzwischen geändert – wir haben ihn neu geladen …“), vorübergehend (Zeitlimit 57xxx, Sperrkonflikt 40P01/40001, Server 5xx, Drosselung: „Bitte versuche es gleich noch einmal.“), sonst „Das hat nicht geklappt – dein Plan wurde neu geladen …“. Der Regel-Text erscheint nie für andere Ursachen.
    - **S3 – Ansagen im Browser:** Der Kalender hat eine ständige Live-Region (`role="status"`, `aria-live="polite"`); Erfolgs- und Fehlermeldungen sowie „aufgenommen“ werden dort vorgelesen (nativ über `AccessibilityInfo`). Die sichtbare Meldung hat keine eigene Alarm-Rolle (kein Doppel).
    - **H2:** Zeilensperre `FOR NO KEY UPDATE` (blockiert keine Fremdschlüssel-Prüfungen; zwei Tausche derselben Einheiten laufen weiter nacheinander).
    - **H3:** Die Zieh-Rückrufe lesen den Stand über eine Ref – ein Hintergrund-Sync bricht das Ziehen nicht mehr ab.
    - **H4 – kein Auto-Scroll:** bewusst weggelassen. Beim Ziehen müssten Bildschirm, gemessene Tage und die Verschiebung der Karte gleichzeitig nachgeführt werden; nativ ist das hier nicht prüfbar und wäre fehleranfällig. „Verschieben …“ bleibt der gleichwertige Weg für weite Wege.
    - **H7:** pgTAP ergänzt um gestrichene Partner-Einheit, zweiten Tausch einer schon verschobenen Einheit, Tausch heute ↔ Sonntag, veralteten Stand, Wiederholung und die `hint`-Werte.
    - **H10:** Essensplan-Hinweis über `nutritionHintNeeded()` – nur mit eingerichteter Ernährung und wenn ein betroffener Tag heute oder später liegt (der Ziel-Tag liegt nach den Regeln immer ab heute).
13. **Wochen:** Der Kalender zeigt die aktuelle bis zur letzten Woche des Plans; vergangene Wochen stehen in „Woche“/„Verlauf“. Tippen auf einen Tag öffnet die Tagesauswertung erst mit A2.
14. **Nachtrag 15./16.10.2026 – Ziehen nach abgelehntem Ablegen (CI, Chrome 153):** Im Browser startete nach einem abgelehnten Ablegen das nächste Ziehen am Griff nicht mehr („Griff reagiert nicht“); nach erfolgreichem Ablegen nie. Ein erster Fix (Geste nach jedem Ende neu aufbauen) half nur einmal – der hängende Zustand lag also global in der Web-Umsetzung von react-native-gesture-handler (Orchestrator/Zeiger-Verfolgung), nicht im einzelnen Handler. **Lösung (16.10.2026):** Im **Browser** zieht die App nicht mehr über react-native-gesture-handler, sondern mit eigener, kleiner Zeiger-Logik am Griff ⠿: reiner Zustandsautomat `lib/web-drag.ts` (ohne DOM, Vitest `web-drag.test.ts`: langer Druck startet, kurzes Tippen nicht, Bewegung > 10 px vor Ablauf bricht ab, Ablehnung → nächster Druck startet sofort, `pointercancel`, `lostpointercapture` vor/nach `pointerup` und verspätet, zwei Zeiger, verlorenes `pointerup`, rechte Maustaste) und DOM-Schicht `lib/use-web-drag.ts` (`pointerdown` am Griff, nur primäre Taste/erster Finger; Timer `DRAG_LONG_PRESS_MS`; danach `setPointerCapture`; Bewegen/Loslassen über `window`, damit nichts verloren geht; `pointercancel`, Fang verloren, Fenster ohne Fokus/verborgen, Griff gesperrt oder entfernt → sauber abbrechen; jeder neue primäre Druck beginnt frisch). Jeder Weg setzt Timer, Fang und Zieh-Zustand zurück. `touch-action: none` nur auf dem Griff; die Karte folgt weiter per Reanimated, gleiche Rückrufe und `absoluteY`-Semantik (clientY = `measureInWindow`). **Nativ unverändert:** Pan mit langem Druck auf der ganzen Karte; `lib/drag-lifecycle.ts` gilt nur noch nativ (Geste nach jedem echten Ziehen neu, Ende melden, wenn die Karte mitten im Ziehen verschwindet). Bedienhilfen und „Verschieben …“ unverändert. **Test-Ursache gefunden:** Der Playwright-Helfer maß die Lage des Griffs mit zwei direkt aufeinanderfolgenden Messungen; nach einem abgelehnten Ablegen gleitet die Karte aber noch 120 ms zurück, beide Messungen fielen ins selbe Bild – der Druck traf dann gelegentlich die Zeile darunter (lokal mit Touch nachgestellt, Ereignis-Protokoll: `pointerdown` auf `calendar-open-day-…`). Jetzt misst er mit 200 ms Abstand und prüft per `elementFromPoint`, dass der Druckpunkt wirklich auf dem Griff liegt; das Ziehen muss weiter beim **ersten** Druck starten. Neuer Playwright-Fall mit echten Touch-Ereignissen (CDP, „Pixel 7“): zweimal abgelehnt, sofort erneut, dann tauschen; kurzes Antippen startet nichts. Lokal je 10× grün mit Chromium 1194 und dessen headless_shell. **Offen:** nativ (APK) bei Gelegenheit gegenprüfen (ablehnen, sofort erneut ziehen).

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** Core: „nur ab heute“ entfernt (12 Tests rot), 48-h-Regel aus (13), erledigte belegen keinen Tag (4), Erholungswoche verschiebbar (3), Tausch prüft das Datum der anderen Einheit nicht (3), ersetzter Plan verschiebbar (3). App: Testmodus-Tausch ohne Erholungswochen- bzw. Vergangenheits-Prüfung, Tausch ohne vorheriges Senden der Warteschlange, Tausch in die Warteschlange – je rot. SQL (lokales Postgres 16 + pgTAP mit Supabase-Ersatz): Woche/Vergangenheit, Erholungswoche, aktiver Plan, fremde Einheiten, ohne Zwischenschritt (23505), `anon` nicht entzogen, ohne Zeilensperre, `original_date` überschrieben – je rot. Playwright: gesperrte Tage im Menü wählbar, Ziehen nimmt nie auf – je rot. Nach der Wächter-Prüfung zusätzlich (S1/S2): Server ohne Prüfung der erwarteten Tage, Testmodus ohne diese Prüfung, kein Neuladen nach Fehler, Fehler-Zuordnung ohne `hint` bzw. alles als Regel-Fehler – je rot.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **48-h-Regel nur in der App** (wie beim Verschieben). Voreinstellung: so lassen – durch S1 kann der Server nur noch Tage tauschen, die die App mit der 48-h-Regel geprüft hat. Alternative: Datenbank prüft die 48 h zusätzlich (neue Migration).
- **Tauschen nur mit Verbindung**, Verschieben auf freie Tage auch offline. Voreinstellung: so lassen.
- **Kein Auto-Scroll beim Ziehen** (H4). Voreinstellung: weite Wege über „Verschieben …“; Nachrüsten später möglich.

**Offen:**

- Drag-and-drop **nativ** (Android-APK/TestFlight) ist hier nicht testbar – bitte mit dem Workflow `eas-build` am Gerät prüfen (Ziehen mit dem Finger, Vibration, Scrollen vor dem langen Druck, TalkBack/VoiceOver „Einen Tag früher/später“).
- `swap_planned_sessions` ist lokal gegen Postgres 16 mit Supabase-Ersatz geprüft; im Pull Request läuft `db-test` mit dem echten Supabase-Stack.
- Supabase-Modus nicht live getestet (wie bisher, Teil 8 der Handy-Anleitung).
- Auto-Scroll beim Ziehen an den Bildschirmrand (siehe 7 und 12) – Gründer-Frage.
- Natives Ziehen: ob `measureInWindow` und `absoluteY` unter Android edge-to-edge zusammenpassen und ob die Seite zwischen Aufnehmen und Sperren des Scrollens noch scrollt (Wächter H5) – mit der APK prüfen.

---

## 4. Etappe A1b – Nachtragen und freie Einheit

**Ziel:** Im Kalender „+ Einheit“ an einem Tag (heute oder bis 14 Tage zurück): geplante Einheit nachtragen **oder** freie Einheit eintragen.

**Core + Tests:**

- `backfillOptions(sessions, logs, date, today)` → welche geplanten Einheiten an diesem Datum nachgetragen werden dürfen (`isWithinLogDateWindow`, ein Eintrag pro Tag, Status).
- `freeSessionLogFromInput(...)` + Plausibilität (bestehende Prüfungen wiederverwenden).
- `isCountingEntry` erweitert: freie Einträge zählen nie für Progression/Kalibrierung. `loggedEnduranceMinutes` lässt sie weiter aus.
- Grenzfälle: genau 14 und 15 Tage zurück, morgen, Wochengrenze ± 1 Tag, schon eingetragen, 10 Einträge am Tag (`maxLogsPerDay`), 0 Sätze, 12 Übungen, Ausdauer 1 min / 12 h.

**Zod:** `sessionLogPayloadSchema` um `is_free: boolean` erweitern (bestehende `.strict()`-Regeln).

**DB (additiv):**

- `session_logs.is_free boolean not null default false`.
- `save_session_log` nimmt `is_free = true` an: `planned_session_id` muss null sein, alle `target_*` leer, Datum heute bis 14 Tage zurück, `name_de` aus fester Liste („Freie Kraft-Einheit“, „Lauf“, …), kein Freitext außer der bestehenden Notiz.
- `recent_exercise_logs` überspringt freie Einträge. Export enthält das Feld. pgTAP: freie Einträge, Fenster, fremde Nutzer.

**App:** Datumswahl im Trainingsmodus (nur beim Nachtragen; „heute“ bleibt Standard). Der Trainingsmodus selbst bleibt offline-first (bestehende Warteschlange und verschlüsselter Zwischenspeicher). Markierung „nachgetragen“ in Woche und Verlauf.

**Zustände:** Datum außerhalb des Fensters (Text mit Grund), Tag schon belegt, offline (geht, wird gesendet), Server lehnt ab („Ungültige Werte im Tagebuch.“ wie bisher).

**So testet ihr es am Handy:**

1. Kalender → Tag von vorgestern → „+ Einheit“ → geplante Einheit nachtragen → Woche zeigt „nachgetragen“.
2. „+ Einheit“ → „Freie Einheit“ → Lauf 30 min → erscheint im Kalender, aber nächste Kraft-Vorgabe bleibt gleich.
3. Tag vor 15 Tagen → „+ Einheit“ ist nicht möglich, Grund steht da.

### Umsetzungsstand A1b (15.10.2026)

**Was gilt:**

- **Core** `packages/core/src/log/backfill.ts`: `backfillOptions(sessions, logs, date, today, { createdToday })` liefert für einen Tag den Tagesblock (`future`, `too_old`, `daily_limit`), ob eine freie Einheit geht, ob der Tag schon mit einer geplanten Einheit belegt ist, und je Einheit des aktiven Plans aus den Wochen um das Datum `allowed` oder einen Grund (`logged`, `day_taken`, `upcoming`, `window`). `backfillDates(session, logs, today)` = Tage für die Datumswahl im Trainingsmodus (gleiche Regeln). `packages/core/src/log/free-session.ts`: `entryDateBlock()`, `freeSessionDates()`, `freeSessionLogFromInput()` (Plausibilität mit `setEntryWarnings`/`needsWeightConfirmation` und `cardioLogFromInput`/`cardioPlausibility`), `freeSessionPayloadIssue()` (= Regeln von `save_session_log`), `isBackfilledLog()` („nachgetragen“ = an einem späteren Kalendertag Europe/Berlin angelegt, keine neue Spalte), `logsCreatedOn()`/`dailyLogLimitReached()`, `freeSessionNutritionSessions()` (A-G7). `isCountingEntry` und `entriesForExercise` lassen freie Einträge aus (nie Progression, Kalibrierung, Pausen-Uhr), `loggedEnduranceMinutes` auch (10-%-Bezug). Konstanten in `constants.ts`: `FREE_SESSION` (Namen, Kraft-Minuten je Satz). Zod: `sessionLogPayloadSchema.is_free` (optional, `.strict()` bleibt; frei ⇒ ohne geplante Einheit).
- **Datenbank** `supabase/migrations/20261015140000_free_session_logs.sql` (rein additiv): `session_logs.is_free boolean not null default false` mit CHECK (frei ⇒ ohne geplante Einheit, keine Einstiegs-/Erholungswoche). `save_session_log` neu definiert – Grundlage ist die Fassung aus `20261006120200_training_log_rpcs.sql`, nur erweitert (`security definer`, `search_path = ''`, `revoke` von `public`/`anon`, nur `authenticated`): Feld `is_free` (darf fehlen = false), freie Einheit nur ohne geplante Einheit, `planned_date = performed_on`, heute bis 14 Tage zurück, nie in der Zukunft, Name aus fester Liste je Art, Einheit „completed“, je Übung freigegebene Übung (Name übernimmt der Server aus der Bibliothek), Status „done“, nur abgehakte Sätze, alle `target_*`/`state_*` leer, kein Wiedereinstieg; ein Eintrag wechselt nie zwischen frei und nicht frei. `recent_exercise_logs` überspringt freie Einträge. `export_my_data` und `consents_after_revoke` sind **nicht** neu definiert – der Export nutzt `to_jsonb` und enthält `is_free` automatisch (pgTAP prüft es). pgTAP `supabase/tests/31_free_session_logs.test.sql` (59 Prüfungen).
- **App** – Kalender (`kalender.tsx`): blättert zurück bis zur Woche von „heute − 14 Tage“; je Tag „+ Einheit“ (heute bis 14 Tage zurück), ältere Tage zeigen „Nachtragen nur bis 14 Tage zurück“, künftige nichts; Einträge des Tages stehen mit „frei“/„nachgetragen“ da (antippen → Eintrag). Neue Seite `nachtragen.tsx` (`/nachtragen?date=…`): geplante Einheit nachtragen (gesperrte mit Grund) oder freie Einheit – Kraft mit Übungssuche aus der Bibliothek (höchstens 12, Ansage über die Live-Region) bzw. Ausdauer mit Art aus fester Liste. Trainingsmodus (`workout/[sessionId].tsx`): Datumswahl **nur beim Nachtragen** (`?date=` bzw. freier Entwurf), freie Kraft-Übungen ohne Vorgabe, verständliche Gründe statt stiller Fehler (`t.backfill.freeErrors`). Offline-first über den bestehenden geschützten Entwurf und die Tagebuch-Warteschlange (Schlüssel `save_session_log:<id>`). Woche, Verlauf und Eintrag zeigen „freie Einheit“/„nachgetragen“. Testmodus (`local-rules.ts` = Server-Regeln) und Supabase-Modus. Tagesziel: freie Einheiten gehen als erledigte Einheiten in die Ernährungs-Engine (`nutrition-plan.ts`, A-G7).
- **Tests:** Core `free-session.test.ts` (68, inkl. Eigenschaftstest 600 Eingaben: jedes „ok“ ist Zod-gültig und erfüllt die Server-Regeln), `backfill.test.ts` (18, inkl. Eigenschaftstest 800 Wochen: „erlaubt“ erfüllt immer Datumsfenster, nie Zukunft, nie stapeln, noch nicht eingetragen; Datumswahl und Optionen stimmen überein), `free-progression.test.ts` (6, inkl. Eigenschaftstest 400 Folgen: freie Einträge ändern die Progression nie), Ergänzungen in `rows.test.ts`, `summary.test.ts`, `db-sync.test.ts` (Feldliste mit `boolean|missing`, Namensliste, Fenster, `recent_exercise_logs`). App `backfill.test.ts` (12: Testmodus speichern, Ablehnungen, Nachtragen Mo am Mi, Tagesziel, Suche), `supabase-backend.test.ts` (freie Einheit offline in der Warteschlange, Ablehnung → Entwurf), `history-format.test.ts`, `route-param.test.ts`. Playwright `apps/mobile/e2e/backfill.spec.ts` (Nachtragen mit Datumswahl, Lauf und Kraft frei, Tag vor 15 Tagen).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Datum der freien Einheit:** heute bis 14 Tage zurück, **ohne** die Zeitzonen-Toleranz von +1 Tag der geplanten Einträge – „nie in der Zukunft“. `planned_date` muss gleich `performed_on` sein (kein zweiter Bezug).
2. **Name aus fester Liste:** „Freie Kraft-Einheit“, Ausdauer je Art „Lauf“, „Spaziergang“, „Radfahrt“, „Schwimmen“. Kraft-Übungen nur **freigegebene** Übungen der Bibliothek; gespeichert wird immer der Bibliotheksname (Server und Testmodus übernehmen ihn per `exercise_id`, kein Freitext außer der Notiz). Archivierte Übungen gehen für freie Einheiten nicht.
3. **Kraft frei:** nur abgehakte Sätze werden gespeichert; „Nicht gemacht“ lässt eine Übung beim Speichern weg; jede Übung braucht mindestens einen abgehakten Satz („0 Sätze“ → Grund). Ohne Vorgabe gibt es nur die Warnung über der absoluten Schwelle (`confirm_absolute`, Bestätigung nötig) – „zu viele Wiederholungen“ lässt sich ohne Vorgabe nicht prüfen. Kein Pausentimer beim Nachtragen vergangener Tage; heute gilt der normale Trainingsmodus (siehe 12).
4. **Frei ↔ nicht frei:** Ein Eintrag wechselt nie die Art (Server, Testmodus). Ältere Fassungen ohne `is_free` (noch wartend auf alten Geräten) bleiben gültig und gelten als nicht frei.
5. **Freie Einheiten ändern:** nicht im Trainingsmodus (wie verwaiste Einträge); Löschen geht, danach neu eintragen. Der Eintrag sagt das.
6. **Nachtragen einer geplanten Einheit:** angeboten werden nur Einheiten des **aktiven** Plans, die nicht schon eingetragen sind und deren Termin nicht in der Zukunft liegt (`upcoming`: „trainiere sie am geplanten Tag“); gestrichene Einheiten dürfen nachgetragen werden (wie der Server, W8). Datumswahl im Trainingsmodus nur mit Tagen, die der Server annimmt (Woche des Termins ± 1 Tag, höchstens 14 Tage zurück, nie zwei geplante am Tag). Die Vorgabe beim Nachtragen ist die heutige (Progression nach `performed_on`).
7. **„nachgetragen“:** erst an einem späteren Kalendertag (Europe/Berlin) angelegt als trainiert. Ein Eintrag kurz nach Mitternacht für den Vortag gilt damit als nachgetragen.
8. **Tageslimit:** gilt auch für freie Einheiten (10 neue Einträge je Tag). Die App rechnet mit den heute angelegten Einträgen auf dem Gerät (Untergrenze, der Server zählt zusätzlich gelöschte) und zeigt den Grund vorab.
9. **Tagesziel (A-G7):** freie Einheiten zählen als erledigte Einheiten am Tag: Ausdauer mit tatsächlicher Dauer und Art, Anstrengung 0–10 → `effortTarget` 1–4 (geklemmt), ohne Angabe Standardwert der Art; Kraft: abgehakte Sätze × 3 min, höchstens 180 min (`FREE_SESSION`, PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN). Das erhöht nur das Ziel; der Deckel `TRAINING_KCAL_DAY_MAX` bleibt. Ernährung läuft im Testmodus und seit N7 Teil 2 auch im Supabase-Modus.
10. **Kalender:** vergangene Wochen nur ansehen und nachtragen – nichts verschieben (kein Griff, kein „Verschieben …“). Die Einheit eines Tages trägt „nachgetragen“, wenn ihr Eintrag am selben Tag später angelegt wurde; Einträge an einem anderen Tag stehen als eigene Zeile.
11. **Bedienhilfen:** „+ Einheit“ mit Namen des Tages („Einheit für Dienstag, 06.10. eintragen“), Übungen als Kontrollkästchen mit Zustand, Auswahl und Fehler über eine ständige Live-Region (`role="status"`, wie im Kalender), Datumswahl als Auswahlgruppe.
12. **Nach der Wächter-Prüfung (15.10.2026) umgesetzt:**
    - **S1 – Bibliothek ändert sich:** Den Übungsnamen einer freien Einheit übernimmt der Server (und der Testmodus) aus der Bibliothek per `exercise_id`; ein abweichender gesendeter Name wird nicht mehr abgelehnt. Die App frischt die Namen beim Laden des Entwurfs und vor dem Senden auf (`refreshFreeDraft`). Ist eine Übung nicht mehr freigegeben, steht an ihr „„X“ ist nicht mehr in der Bibliothek – bitte entfernen“ mit **Übung entfernen** (`removeDraftExercise`); alle anderen Werte bleiben, Speichern sagt den Grund.
    - **S2 – richtiggestellt:** Verwaiste Einträge (ohne geplante Einheit, nicht frei) zählen seit Phase 4 für die **Kraft**-Progression; sie sind nur vom 10-%-Bezug ausgeschlossen. „Frei“ ist für Kraft daher nur im Client/Core unumgehbar – ein Eintrag ohne Planbezug und ohne `is_free` (ältere App, Eingriff) zählt auch am Server (`recent_exercise_logs`). Verhalten unverändert, durch Tests dokumentiert (Core `free-progression.test.ts`, pgTAP 31); Entscheidung → Gründer-Frage G1.
    - **H1:** Der Server lehnt freie Einheiten mit nicht abgehakten Sätzen oder Status „partial“ ab (wie `freeSessionLogFromInput`, auch in `freeSessionPayloadIssue`).
    - **G2/H2:** „+ Einheit“ für **heute** öffnet bei einer geplanten Einheit das normale Training („… jetzt trainieren“, Pausentimer, `startKind`-Prüfung; geht es heute live nicht, steht der Grund da). Eine freie Einheit für heute läuft ebenfalls wie live (Pausentimer, keine Datumswahl). Nachtrage-Modus (Datumswahl, kein Pausentimer) nur für vergangene Tage; `?date=<heute>` wird ignoriert.
    - **H3:** `backfillDates()` bietet für Einheiten ersetzter Pläne keine Tage an.
    - **H4:** Das Nachtrage-/Frei-Fenster rechnet „heute“ wie der Server in Europe/Berlin (`berlinTodayIso`): Kalender, „+ Einheit“, Datumswahl, Prüfung vor dem Senden, Tageslimit. Lehnt der Server an der Grenze trotzdem ab, nennt der Entwurf den Grund (Fenster, deutsche Zeit, anderes Datum wählen).
    - **Doku:** KONZEPT 5 (Absatz „Nachtragen und freie Einheit“) und HANDY-ANLEITUNG Teil 7a2.

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** Core: `isCountingEntry` ohne frei (1 Test rot), `entriesForExercise` ohne Filter (3), Fenster 15 Tage (4), Zukunft erlaubt (5), „nie stapeln“ ignoriert (2), keine Gewichts-Bestätigung (1), 10-%-Bezug zählt frei (1), Vorgaben bei frei erlaubt (2), kommende Einheit nachtragbar (4). App: Testmodus ohne Regeln der freien Einheit, ohne Übungsnamen-Prüfung, frei ↔ nicht frei umschaltbar, ungültiger freier Entwurf als gültiger Eintrag, Nachtragen ohne Datum, Tagesziel ohne freie Einheiten – je rot. SQL (lokales Postgres 16 + pgTAP mit Supabase-Ersatz): `recent_exercise_logs` ohne Filter (2 rot), Fenster der freien Einheit aus (2), `target_*` erlaubt (4), frei mit `planned_session_id` (3), Art umschaltbar (6), Name frei wählbar (3), Übungsname beliebig (2), `anon` nicht entzogen bzw. `search_path` entfernt (pgTAP 28 rot). Playwright: „+ Einheit“ auch vor 15 Tagen, Datumswahl ohne Server-Regeln – je rot. Nach der Wächter-Prüfung: Namen nicht aufgefrischt, fehlende Übung nicht benannt, Testmodus bzw. Server speichert den gesendeten Namen (pgTAP 1 rot), Server ohne Prüfung „nur abgehakte Sätze“ (2) bzw. Status (2), Core ohne Satzprüfung, freie Einheit heute im Nachtrage-Modus, „jetzt trainieren“ ohne `startKind`-Prüfung (Playwright), `backfillDates` ohne `plan_active` – je rot.

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **Freie Einheiten nicht änderbar** (nur löschen und neu eintragen). Voreinstellung: so lassen. Alternative: Ändern wie geplante Einträge (eigener Schritt).
- **Kraft-Minuten fürs Tagesziel** = 3 min je abgehaktem Satz, höchstens 180 min. Voreinstellung: so, fachlich vor dem Livegang prüfen. Alternative: Dauer bei freier Kraft abfragen.
- **Freie Einheit nie in der Zukunft**, auch nicht +1 Tag Zeitzonen-Toleranz. Voreinstellung: so lassen (DACH-Zeitzone).
- **G1 – verwaiste Einträge und Kraft-Progression:** Sollen verwaiste Einträge (Einheit gelöscht bzw. Plan ersetzt) künftig wie freie Einheiten nicht mehr für die Kraft-Progression zählen? Empfehlung: **ja**, als eigener kleiner Schritt (`isCountingEntry` + `recent_exercise_logs`) – dann ist „frei“ auch serverseitig nicht umgehbar. Voreinstellung bis dahin: unverändert (zählen).
- **G2 – „+ Einheit“ heute = normales Training:** umgesetzt wie empfohlen (sichere Richtung, siehe 12).
- **Namen der freien Einheiten** („Freie Kraft-Einheit“, „Lauf“, „Spaziergang“, „Radfahrt“, „Schwimmen“). Voreinstellung: so; Änderungen brauchen eine neue Migration (Liste steht im Server).

**Offen:**

- `save_session_log`-Erweiterung ist lokal gegen Postgres 16 mit Supabase-Ersatz geprüft (alle 29 pgTAP-Dateien grün, gemergter Stand mit E1); im Pull Request läuft `db-test` mit dem echten Supabase-Stack.
- Etappe E1 (Migrationen 20261015130000/130100) ist zusammengeführt; diese Migration (140000) definiert `export_my_data`/`consents_after_revoke` nicht neu, pgTAP 31 bestätigt auf dem gemergten Stand, dass der Export `is_free` enthält.
- Supabase-Modus nicht live getestet (wie bisher, Teil 8 der Handy-Anleitung).
- Datumswahl und Übungssuche nativ (APK/TestFlight) nicht geprüft – mit dem Workflow `eas-build` am Gerät testen.

---

## 5. Etappe E1 – Ernährungstagebuch (gratis, Voraussetzung für A2/A3)

Entspricht X2 aus PLAN-PHASE-5 Abschnitt 13 und KONZEPT 6.1 (ohne Barcode).

**Ziel:** Über den Tag eintragen, was man gegessen hat – schnell, ohne KI, auch offline.

**Wege zum Eintragen (Tagesverlauf „Ernährung → Tag“, gruppiert nach Frühstück, Mittag, Abend, Snack, vor/nach Training):**

1. **„Gegessen“ per Tipp** bei jeder Mahlzeit aus dem Essensplan. Portion anpassbar (½, ¾, 1, 1¼, 1½, 2). Das ist der schnellste Weg und gratis – nicht zu verwechseln mit den Premium-Vorschlägen rund ums Training (X4).
2. **Lebensmittel aus dem Katalog** suchen (`foods`, gleiche Suche wie Zutaten) + Menge in g oder Stück.
3. **Rezept aus der Rezeptsuche** + Portionen.
4. **Schnelleintrag:** Bezeichnung (Auswahlliste, z. B. „Snack“, „Auswärts gegessen“, „Getränk“) und kcal, optional Eiweiß/Kohlenhydrate/Fett.
5. **Zuletzt gegessen** (die letzten 20 verschiedenen Einträge) und **Favoriten** (Stern) für einen Tipp.

Bearbeiten und Löschen jedes Eintrags. Nachtragen bis 14 Tage zurück (`FOOD_LOG_LIMITS.backdateDays`, wie Training), nie in die Zukunft.

**„Kalorienzahlen aus“:** Eintragen geht weiter, aber ohne kcal-Anzeige und ohne kcal-Feld im Schnelleintrag (dann zählt der Eintrag nur als „gegessen“). Katalog, Rezept und Plan liefern die Werte im Hintergrund – sichtbar werden sie erst, wenn die Person die Zahlen wieder einschaltet.

**Core (`nutrition/food-log.ts`) + Tests:**

- `foodLogEntrySchema` (Zod, strikt), `entryFromPlanItem(item, portion)`, `entryFromFood(food, amount, unit)` (über die bestehenden Einheiten-Umrechnungen), `entryFromRecipe(recipe, servings)`, `quickEntry(...)`.
- `dayIntake(entries)` → Summen kcal/Makros und Anzahl; Einträge ohne kcal werden gezählt, aber als „ohne Wert“ markiert (der Balken sagt dann „Ein Eintrag ohne Kalorienangabe“).
- `recentEntries(entries, n)`, Favoriten-Reihenfolge.
- `FOOD_LOG_LIMITS` in `constants.ts`: kcal je Eintrag 0–3.000, Menge 1–2.000 g, Portion 0,25–3, höchstens 40 Einträge je Tag, Nachtragen 14 Tage. Plausibilitäts-Rückfrage ab 1.500 kcal je Eintrag („Stimmt die Menge?“), keine Sperre.
- Grenzfälle: leerer Tag, Plan ersetzt nach dem Abhaken (Schnappschuss bleibt), doppelt abgehakt (idempotent), Lebensmittel archiviert, Stück ohne Gewichtsangabe, 0 kcal (Wasser), genau 14/15 Tage zurück, `no_targets`.

**DB (additiv):**

- `food_log_entries`: id, user_id, eaten_on, slot (Werte wie `meal_plan_items.slot` + `other`), source (`plan_item | food | recipe | quick`; später `custom_meal | photo | product`), Verweise nur als Schnappschuss (food_id/recipe_id/custom_meal_id, title_de, Menge, Einheit, Portion), kcal/protein_g/carbs_g/fat_g (Schnelleintrag: nullable), revision, write_id, created_at, updated_at.
- `food_log_favorites`: (user_id, Schlüssel der Quelle) – nur eigene Zeilen.
- RLS auf beiden: nur eigene Zeilen lesen. Schreiben über `save_food_log_entries(p jsonb)` (Liste, idempotent per `write_id`, optimistische Sperre wie `save_session_log`) und `delete_food_log_entry(p_id, p_base_revision)`. Prüft: Einwilligung `health_data`, Datumsfenster, Grenzen, nur freigegebene bzw. eigene Inhalte. Favoriten direkt per PostgREST (wie `exercise_start_weights`).
- Widerruf löscht Einträge (Favoriten bleiben, sie sind kein Gesundheitsdatum – Frage A-G14), Export, Konto löschen per Kaskade. pgTAP: Isolation, Widerruf, Fenster, ohne Einwilligung abgelehnt, Fehler ohne Zeileninhalt.
- **Testmodus zuerst** (`localDb`); Supabase-Teil mit N7 Teil 2 umgesetzt (16.10.2026: Ernährungs-Warteschlange, abgelehnte Fassungen bleiben lokal bis „Verwerfen“). Offen: Server-Prüfung „Gegessen aus dem Plan“ gegen den gespeicherten Plan (H4, G-N7-5).

**App:** Tagesverlauf in `apps/mobile/src/app/ernaehrung/index.tsx` erweitern; neuer Bildschirm „Eintragen“ (`ernaehrung/eintragen.tsx`) mit Reitern Zuletzt · Favoriten · Suche · Schnell. Karte „Essen heute“ auf „Heute“ zeigt die Anzahl der Einträge (und kcal nur mit Zahlen an).

**Zustände:** Laden; noch nichts eingetragen; keine Einwilligung (Erklärung + Knopf); kein Essensplan (Eintragen geht trotzdem); Suche ohne Treffer („Schnelleintrag“ anbieten); Server lehnt ab; offline.

**Offline:** Eintragen, Bearbeiten und Löschen gehen offline (eigene Warteschlange, verschlüsselt im geschützten Speicher wie die Tagebuch-Warteschlange, weil Gesundheitsdaten; im Browser nur sessionStorage mit Hinweis). Katalog und Rezepte liegen schon auf dem Gerät.

**So testet ihr es am Handy:**

1. Vorschau-Link → Testmodus → Ernährung → Tag → Frühstück „Gegessen“, Mittag mit ¾ Portion.
2. „Eintragen“ → Suche „Banane“ → 1 Stück → erscheint unter Snack.
3. Schnelleintrag „Auswärts gegessen, 700 kcal“ → Stern setzen → morgen unter „Favoriten“.
4. Flugmodus an → eintragen → neu laden → alles da.
5. Gestern nachtragen geht; vor 15 Tagen nicht (Grund steht da).
6. Einwilligung Gesundheitsdaten widerrufen → Einträge weg, Hinweis vorher.

---

## 6. Etappe A2 – Tagesauswertung

**Ziel:** Route `apps/mobile/src/app/tag/[date].tsx` („Dein Tag“), erreichbar über Kalender, Woche und „Heute“. Mit ← / → durch die Tage blättern.

**Inhalt:**

1. **Essen:** über dem Balken „1.640 von 1.800 kcal“ (Ist und Tagesziel). Balken mit Zielmarke und hell hinterlegtem Zielbereich. Farbe und Text nach 2.1/2.2. Darunter die abgehakten Mahlzeiten und „Gegessen“-Knöpfe.
2. **Training:** Einheiten des Tages mit Status und Erfüllungsgrad (2.5), je Übung kurz „3/3 Sätze“. Tippen öffnet den Tagebuch-Eintrag.
3. Hinweise: `below_floor`, Trainingstag, Sonderfälle – vorhandene Texte.

**Core + Tests:**

- `intakeZone({ eatenKcal, hasEntries, day: NutritionDayTargets, isToday, isFuture, showNumbers })` → `{ zone, scale, markers } | { kind: 'hidden' | 'no_target' | 'no_entries' | 'future' }`. Wenn `showNumbers = false`, enthält die Ausgabe **keine** kcal-Werte (Typ ohne Zahlen).
- `dayEvaluation(...)` setzt Essen + Training zusammen.
- `sessionAchievement(...)` (2.5) in `log/achievement.ts`.
- Tests: jede Zonengrenze genau und ± 1 kcal, U ≥ 0,9 × Z (keine gelbe Zone unten), Muskelaufbau (O nah an Z), `maintenance_only`, unter 18, `no_targets`, Schwangerschaft, `below_floor`-Tag, heute vs. gestern, keine Einträge, 45 kg und 200 kg, 1 und 7 Trainingstage.
- **Eigenschaftstests:** (a) G < U ergibt nie gelb oder grün; (b) Zonen sind von links nach rechts geordnet; (c) bei `showNumbers = false` steht nirgends eine kcal-Zahl; (d) die Funktion ruft nur Werte aus `nutritionTargetsForWeek` ab – Strukturtest wie K2 (keine eigenen Grenzen).

**Zod:** Eingaben über bestehende Schemas; `dateParamSchema` für die Route (ungültiges Datum → Fehlerzustand).

**DB:** keine neue Migration (liest Trainingstagebuch, Plan, Essensplan und Ernährungstagebuch aus E1).

**App:** Balken mit `react-native-svg` oder `View`-Breiten. Farben aus `success`/`warning`/`danger`, neutral = Markenfarbe. Text immer dabei. `accessibilityLabel` „1.640 von 1.800 Kilokalorien, im Zielbereich“ bzw. ohne Zahlen.

**Zustände:** Laden; keine Daten für diesen Tag (älter als der Gerätespeicher → „Nur die letzten 12 Wochen“); künftiger Tag (Vorschau); kein Essensplan; kein Trainingsplan; Zahlen aus; Schwangerschaft; ohne Einwilligung; offline (alles aus dem Speicher).

**So testet ihr es am Handy:**

1. Gestern zwei Mahlzeiten abhaken → „Dein Tag“ für gestern → gelber oder roter Balken mit Text.
2. Heute: erst neutral „Noch offen“, nach allen Mahlzeiten grün.
3. „Etwas anderes gegessen: 1.500 kcal“ → gelb/rot oben mit ruhigem Text.
4. Einstellungen → „Kalorienzahlen anzeigen“ aus → kein Balken, nur „3 von 4 Mahlzeiten“.
5. Gesundheits-Check „schwanger“ → kein Balken, Hinweis.
6. Trainingstag: Einheit mit 2 von 3 Sätzen → „Größtenteils geschafft“.

### Umsetzungsstand A2 (15.10.2026)

**Was gilt:**

- **Core** `packages/core/src/evaluation/intake-zone.ts`: `intakeZone({ eatenKcal, hasEntries, day, isToday, isFuture, showNumbers })` → `hidden` | `no_target` | `future` | `no_entries` | `bar` (`zone`, `tone` = Design-Token-Rolle, `scale.zones` von links nach rechts, `markers`). Überladung: Mit `showNumbers: false` ist der Rückgabetyp `{ kind: 'hidden' }` – ohne jede Zahl und ohne Farbe. Zonen genau nach 2.1 (U, Planband, R = max(O; Z × 1,2)), heute unter B_min `open` (neutral, 2.2). `packages/core/src/evaluation/day-evaluation.ts`: `dayEvaluation(...)` setzt Essen (Balken, Einträge, „x von y Mahlzeiten“, Hinweis-Codes der Engine) und Training (Einheiten des Tages aus `weekLogSummary`, Erfüllungsgrad je Eintrag) zusammen; Hinweise `check_entries` (vergangen + rot unten), `plan_below_floor`, `training_day` (beide nur mit Zahlen). `dateParamSchema` (Zod, gültiger Kalendertag) für die Route. `packages/core/src/log/achievement.ts`: `sessionAchievement(...)`, `achievementLevel()`, `achievementWeightFloorKg()` (2.5). Konstanten in `constants.ts`: `INTAKE_ZONES` (Faktor 1,2; Skalen-Reserve nur Darstellung) und `SESSION_ACHIEVEMENT` (90/60 %, Halteübung 90 %, Anstrengung +2, „länger“ ab 110 %) – beide „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.
- **Keine Migration.** Gelesen werden Trainingstagebuch, Plan, Essensplan und Ernährungstagebuch (E1) aus dem Gerätespeicher; Ziele und Zonen werden nie gespeichert (2.7).
- **App** Route `apps/mobile/src/app/tag/[date].tsx` („Dein Tag“, ← Vortag / Folgetag →), Bausteine `components/day-evaluation.tsx` (Balken aus `View`-Breiten: hell hinterlegte Zonen, Füllstand in Zonenfarbe, Zielmarke; darunter Zeichen + Text), Abbildung `data/day-evaluation.ts` (`dayTrainingItems`, `dayAchievementInputs`, `dayExerciseNames`), Formulierung `lib/day-evaluation-format.ts`, Texte `i18n/de-day.ts` (`t.day`). Einstiege: „Heute“ → **Dein Tag – Essen und Training**, Kalender → Tippen auf den Tagesnamen („· Dein Tag ›“), Woche → **Dein Tag** unter jedem Tag. Nutzt die vorhandenen Hooks `useNutritionWeek`, `useFoodLogDay`, `useFoodLogActions` und `PlanMealEaten` (E1) – „Gegessen“ geht direkt auf der Seite.
- **Zustände:** Laden (App, Ernährung, Übungs-Bibliothek für den Trainingsteil), ungültiges Datum (Fehlerzustand + „Zum Kalender“), älter als der Gerätespeicher (Supabase: 12 Wochen → „Nur die letzten 12 Wochen“ + „Zum Verlauf“), künftiger Tag (Vorschau: Tagesziel und geplante Einheit, kein Balken), kein Essensplan („Eintragen geht trotzdem“), kein Trainingsplan, Ruhetag, Zahlen aus, Schwangerschaft, ohne Einwilligung (Erklärung + Knopf, Training bleibt), Angaben unvollständig / gesperrt / Rechenfehler (bestehende Texte), offline (Hinweis; alles aus dem Speicher), Supabase-Modus (Essen „kommt bald“, Training geht).
- **Tests:** Core `intake-zone.test.ts` (40: jede Grenze genau und ± 1 kcal, U ≥ 0,9 × Z, Muskelaufbau, U = O, `maintenance_only`, unter 18, `no_targets`, Schwangerschaft, ohne Einwilligung/Körperdaten, 45/200 kg, 1/7 Trainingstage, heute/gestern/künftig/ohne Einträge, Eigenschaften (a)–(d) mit 400 echten Engine-Tagen, 60-s-Zeitlimit), `day-evaluation.test.ts` (27, inkl. Eigenschaft (c) für das Gesamtergebnis), `achievement.test.ts` (35, inkl. Eigenschaftstest 2.000 Einheiten). App `data/day-evaluation.test.ts` (5), `lib/day-evaluation-format.test.ts` (9, inkl. Sprachprüfung 2.4). Playwright `apps/mobile/e2e/day-evaluation.spec.ts` (4 Tests: heute neutral → grün, gestern rot unten mit „fehlt etwas?“, gelb/rot oben ruhig, künftig, ← / →, Einstiege Heute/Kalender/Woche, neu laden; „Zahlen aus“ ohne „kcal“/„Kilokalorien“ im ganzen DOM inkl. testIDs/aria an drei Tagen; Schwangerschaft; Training „Teilweise gemacht · … %“ mit „1/3 Sätze“, ungültiges Datum, ohne Einwilligung).

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Beispiel „Abnehmen“ in 2.1 richtiggestellt:** B_min = max(U; 0,9 × Z) = max(1.725; 1.620) = **1.725** (nicht Z). Grün reicht dort also von 1.725 bis 1.980, eine gelbe Zone unten gibt es nicht. Der Test nutzt die richtiggestellten Werte.
2. **U = O und Z knapp über O** (gerichtete Rundung bei greifendem Überschussdeckel, vom Eigenschaftstest gefunden): kein Datenfehler; Z liegt im Planband und ist grün. R = max(O; Z × 1,2; B_max) – B_max nur, weil das Planband laut Engine bis 20 kcal über O reichen darf (Mindestbreite). Sonst gilt: U ≤ B_min ≤ B_max und U ≤ Z, alles andere bricht mit Fehler ab (nie still raten).
3. **Einträge ohne kcal** zählen bei „Eingetragen: n Einträge“, der Balken rechnet nur mit Werten. Hat ein Tag **nur** Einträge ohne Wert, gibt es keinen Balken („Deine Einträge haben keine Kalorienangabe – dafür gibt es keinen Balken.“) – nie 0 kcal und nie rot.
4. **Heute** ist unter dem Beginn von Grün (B_min bzw. beim Abnehmen G0) immer neutral „Noch offen“ – auch unter der Untergrenze (der Tag läuft noch). Ab dort wie vergangene Tage.
5. **Schwangerschaft/Stillzeit doppelt abgesichert:** `dayEvaluation` setzt die Zahlen selbst aus, sobald der Tag `pregnancy_no_targets` trägt – auch wenn die App „Zahlen an“ übergäbe (Gegenprobe unten).
6. **„Größtenteils gemacht“ statt „Größtenteils geschafft“:** 2.4 verbietet „geschafft“; die Stufen heißen deshalb „Ziel erreicht“, „Größtenteils gemacht“, „Teilweise gemacht“. Eingetragen mit 0 % (z. B. alles ausgelassen) = „Eingetragen“ (neutral), ohne Vorgabe (freie Einheit, Übung ohne Satzvorgabe) = „Gemacht“ ohne Prozent. Zeichen: ✓ ◕ ◐ ○.
7. **Rechnung 2.5:** Prozent abgerundet (89,9 % ist nicht „erreicht“), gekappt auf 100. Mittel nur über Übungen **mit** Vorgabe; ausgelassene Übung mit Vorgabe = 0, auch wenn Sätze eingetragen sind. Wdh.-Schwelle `reps_min`, ohne `reps_min` `target_reps`. Gewicht nur bei Gewichtsübungen mit Vorgabe: Langhantel/Maschine Vorgabe − 2,5 kg, freie Gewichte nächstkleinere eigene Stufe (gibt es keine, zählt die Vorgabe), ohne eigene Stufen − 2 kg (`LOAD_PROGRESSION`). Ist die Übung unbekannt bzw. die Bibliothek nicht geladen, zählt nur die Vorgabe selbst (strengere Richtung). Eigene Stufen kommen aus den Geräten des Plans am Ort der Einheit (`profilesFor`, `sessionLocationInfo`, `weightStepsFor`).
8. **Erholungs- und Einstiegswoche** getrennt benannt: „Erholungswoche – leichter ist hier richtig.“ bzw. „Einstiegswoche – leichter ist hier richtig.“ (gleiche Rechnung).
9. **Ausdauer-Hinweise:** „Etwas lockerer als geplant hilft der Erholung.“ bei Anstrengung > Vorgabe + 2 (Skala 0–10, nur mit Vorgabe), „Länger als geplant – …“ über 110 % der geplanten Minuten. Distanz nur angezeigt.
10. **Hinweise mit Kalorienbezug** („Trainingstag – dein Ziel ist an diesem Tag höher.“, „Dieser Tag erreicht deinen Mindestbedarf nicht …“ aus dem Essensplan) nur mit Zahlen; ohne Zahlen keine Bewertung (A-G8). „Laut deinen Einträgen. Fehlt etwas? …“ nur an vergangenen Tagen mit rot unten.
11. **Blättern** ohne feste Grenze: künftige Tage als Vorschau; ältere als der Gerätespeicher (nur Supabase, `logHistoryStart`) zeigen den Hinweis. Mehr als ein Jahr entfernt lehnt die Engine ab → bestehender Text „Deine Ernährung lässt sich gerade nicht berechnen …“ im Essen-Teil, der Trainingsteil bleibt.
12. **Kalender:** Getippt wird der **Tagesname** (Link „· Dein Tag ›“, Mindest-Tippfläche), nicht die ganze Tageszeile – sonst kollidiert es mit Drag-and-drop und „+ Einheit“. Während des Ziehens gesperrt.
13. **Bedienhilfen:** Der Balken ist ein Bild mit Beschreibung „1.640 von 1.800 Kilokalorien, im Zielbereich“; bei „Zahlen aus“ wird er gar nicht gerendert (keine Beschreibung mit Zahlen). Erfüllungsgrad mit eigener Beschreibung („Ganzkörper A: Größtenteils gemacht, 66 %“). testIDs ohne Werte und ohne Zone (`day-bar`, `day-zone`, `day-achievement`) – keine Gesundheitsdaten in Attributen.
14. **Supabase-Modus:** seit N7 Teil 2 wie im Testmodus (vorher Hinweis „kommt bald“). Für Tage vor der Löschfrist (4 Wochen, G-N7-2) gibt es keinen gespeicherten Plan mehr → Hinweis aus S1, Tagebuch-Werte bleiben.

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** Core: heute nicht neutral (3 Tests rot), unter U gelb (11), `hidden` mit Zahl (4), Schutzgrenzen-Konstante importiert (Strukturtest d, 1), eigener Faktor 1,15 statt `INTAKE_ZONES` (6), ohne Einträge als 0 kcal gewertet (4), Schwangerschaft zeigt Zahlen (1), „erreicht“ ab 85 % (3), ohne Gewichtsstufen-Toleranz (2), ausgelassene Übung zählt (2), nicht abgerundet/gekappt (12). App: Bedienhilfe ohne Zone (1), „Größtenteils geschafft!“ (Sprachprüfung, 1), Bibliothek ignoriert (2), Ausdauer ohne geplante Minuten (2). Playwright: Bildschirm übergibt immer „Zahlen an“ → Test „Kalorienzahlen aus“ rot; der Schwangerschafts-Test bleibt dabei grün, weil `dayEvaluation` selbst absichert (Präzisierung 5).

**Nach der Wächter-Prüfung (15.10.2026, `waechter-a2.md`, kein Blocker) umgesetzt:**

- **S1 – nur gespeicherter Essensplan:** `evaluationMealPlanUsable()` (core): Mahlzeitenliste, „x von y abgehakt“, „Gegessen“ und `plan_below_floor` nur aus einem **gespeicherten** Plan bzw. in der laufenden/nächsten Woche ab heute. Sonst „Für diesen Tag ist kein Essensplan gespeichert – deshalb gibt es hier keine Mahlzeiten zum Abhaken. Eintragen geht trotzdem.“ Gleiches in „Ernährung“ (`/ernaehrung?tag=`, E1): Der Plan bleibt sichtbar, „Gegessen“ fehlt dort mit Hinweis.
- **H3:** „Fehlt etwas? Du kannst es nachtragen.“ nur im Nachtrage-Fenster (`foodLogDateStatus`, E1); danach nur „Laut deinen Einträgen.“ (`entries_basis`).
- **H4:** Geplante Ausdauer ohne eingetragene Dauer = „• Eingetragen“ (Stufe `logged`); „Gemacht“ ohne Vorgabe = „•“. Nur „Ziel erreicht“ trägt ✓.
- **H5:** Künftige Tage: nur Tagesziel und „Geplante Mahlzeiten:“ ohne Abhak-Zahl und ohne „Gegessen“.
- **H7:** Wirft `dayEvaluation` (Datenfehler), zeigt die Seite „Dein Tag lässt sich gerade nicht auswerten …“ statt der Router-Fehlerseite; nichts wird geloggt.
- **H9:** Eigenschaft (b) auch für heute („offen“ links vor allen Zonen) und künftig (nie ein Balken); `achievement.test.ts` rechnet 3.000 Kraft- und 2.000 Ausdauer-Einheiten gegen ein unabhängiges Orakel (Zahlen aus Plan 2.5); Playwright „Zahlen aus“ prüft zusätzlich, dass im Essensteil außer der Mahlzeiten-Anzahl kein „x von y“/„x/y“ und keine Zahl ab 100 steht.
- **Screenshots** hell/dunkel für „Dein Tag“ in `e2e/screenshots.spec.ts` (`dein-tag`, `dein-tag-offen`, `dein-tag-balken`, `dein-tag-training`).
- **Gegenproben:** S1 Plan immer verwenden (core 1, App 2 rot), H3 immer „nachtragen“ (1), H4 ohne Dauer = „gemacht“ (core 1, App 1) bzw. Symbol ✓ (App 1), H5 Abhak-Zahl auch künftig (1), G1 ohne Abnehm-Regel (4) bzw. eigener Faktor 0,9 (5, u. a. Strukturtest d).

**Entschieden (Gründer, 15.10.2026):**

- **Wächter-G1 – Grün beim Abnehmen:** Grün erst etwa ab dem Tagesziel: G0 = max(U; Z × 0,95; B_min) bei Tagen mit Defizit (`goalAdjustment < 0`), Konstante `INTAKE_ZONES.lossGreenFromTargetFactor = 0,95` (VOR LIVEGANG FACHLICH PRÜFEN). Zwischen U und G0 gelb „Etwas unter deinem Tagesziel“, unter U rot; heute bis G0 neutral „Noch offen“. Halten/Aufbau unverändert. Tests: Grenzen ±1 kcal, Eigenschaft „bei Defizit nie Grün unter max(U; 0,95 × Z), Z immer grün“ (400 Engine-Tage), Orakel in den Engine-Grenzfällen, Strukturtest (d) unverändert (Faktor nur aus `INTAKE_ZONES`).
- **Wächter-G2 – vergangene Wochen ohne gespeicherten Plan:** wie empfohlen keine Mahlzeitenliste (S1).

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **G1 – Stufenname:** „Größtenteils gemacht“ (Voreinstellung, passt zu 2.4) oder wie im Plan-Entwurf „Größtenteils geschafft“?
- **G2 – Nährwerte am Server nachrechnen (E1 G4, „vor A2 neu entscheiden“):** Voreinstellung: **weiter nicht** – die Tagesauswertung rechnet nur auf dem Gerät und nur für die Person selbst, es gibt keine serverseitigen Bewertungen. Mit N7 Teil 2 (Supabase-Modus) erneut entscheiden (Empfehlung des Wächters: nachrechnen).
- **G3 – Gewicht ohne bekannte Übung:** Voreinstellung streng (nur die Vorgabe zählt). Alternative: Standard-Schritt 2 kg.
- **G4 – Kalender:** Voreinstellung Tippen auf den Tagesnamen. Alternative: ganze Tageszeile (würde mit Ziehen und „+ Einheit“ konkurrieren).
- Fachlich vor dem Livegang (bestehend): A-G5 (Farbgrenzen) und A-G11 (90/60 %).

**Offen:**

- Fachliche Prüfung `INTAKE_ZONES` (A-G5) und `SESSION_ACHIEVEMENT` (A-G11) durch Ernährungs- bzw. Trainingsfachkraft.
- Essen im Supabase-Modus seit N7 Teil 2 (nicht live getestet, HANDY-ANLEITUNG Teil 8 Punkte 16–20); Trainingsteil im Supabase-Modus nicht live getestet (Teil 8 der Handy-Anleitung).
- Nativ (APK/TestFlight) nicht geprüft – Balken, Tippen auf den Tagesnamen im Kalender, TalkBack/VoiceOver-Ansage des Balkens mit dem Workflow `eas-build` am Gerät prüfen.
- Wochenauswertung, Muster-Hinweis (≥ 3 Tage unter der Untergrenze) und „Tage ohne Eintrag zählen nicht“ kommen mit A3 (`weekEvaluation` baut auf `dayEvaluation` auf).

---

## 7. Etappe E2 – Eigene Gerichte (gratis)

Entspricht X3 aus PLAN-PHASE-5 Abschnitt 13 und KONZEPT 6.2.

**Ziel:** Gerichte, die man oft isst („Mein Porridge“, „Shake nach dem Training“), einmal anlegen und dann mit einem Tipp eintragen.

- **Anlegen:** Name (bis 60 Zeichen) und entweder (a) kcal/Makros je Portion direkt oder (b) aus Zutaten aus dem Katalog berechnet (Menge in g/Stück) + Anzahl Portionen.
- **Eintragen:** im Tagesverlauf und unter „Favoriten/Zuletzt“, Portion anpassbar (0,25–3).
- **Ändern:** Bereits eingetragene Tage behalten ihre Werte (Schnappschuss im Tagebuch).
- Höchstens 100 eigene Gerichte, 30 Zutaten je Gericht.
- Bei „Zahlen aus“: Anlegen nur über Zutaten (Werte werden berechnet, nicht gezeigt) oder ohne Werte.

**Core (`nutrition/custom-meal.ts`) + Tests:** `customMealSchema`, `customMealNutrients(meal, foods)` (gleiche Rechnung wie `recipe-nutrients.ts`), `entryFromCustomMeal(meal, portion)`. Grenzfälle: 1 und 30 Zutaten, Zutat archiviert (Werte bleiben aus Schnappschuss), 0-kcal-Gericht, direkte Werte gegen berechnete (Makros ergeben grob die kcal → Rückfrage bei mehr als 20 % Abweichung), Stück ohne Gewicht.

**DB (additiv):** `custom_meals` (id, user_id, name_de, servings, Werte je Portion, mode `direct | ingredients`, created_at, updated_at) und `custom_meal_items` ((meal_id, user_id) → Kaskade, order_no, food_id → `foods` `on delete restrict`, amount, unit). RLS: nur eigene Zeilen, Schreiben direkt per PostgREST mit CHECK-Grenzen oder über `save_custom_meal(p jsonb)` (atomar Gericht + Zutaten, Empfehlung). Export, Konto löschen per Kaskade. pgTAP: Isolation, Grenzen.

**Offline:** Anlegen und Eintragen offline über die Warteschlange.

**So testet ihr es am Handy:** Ernährung → „Eigene Gerichte“ → „Mein Porridge“ aus Haferflocken 60 g, Milch 200 g, Banane 1 Stück → Werte erscheinen → im Tagesverlauf mit einem Tipp eintragen, ½ Portion → Tagessumme stimmt. Gericht direkt mit 450 kcal anlegen → eintragen.

### Umsetzungsstand E2 (15.10.2026)

**Umgesetzt** nach Abschnitt 7 (dazu 2.3, 2.4, 2.7, 5/E1 mit den Wächter-Auflagen, 12, 13; A-G9, A-G12 wie empfohlen; A-G14 für eigene Gerichte enger gefasst, siehe Gründer-Frage E2-G1). Gratis, ohne KI. **Testmodus vollständig; Supabase-Modus mit N7 Teil 2 (16.10.2026) freigeschaltet** (`supportsNutrition = true`; Speichern über die Ernährungs-Warteschlange an `save_custom_meal`/`delete_custom_meal`).

**Was jetzt gilt**

- **Ernährung → „Eigene Gerichte“** (`ernaehrung/gerichte.tsx`): Liste (zuletzt eingetragen zuerst, sonst alphabetisch), „1 von 100 Gerichten“, **„Neues Gericht anlegen“** (bei 100 gesperrt mit Hinweis), je Gericht **Ändern** und **Löschen** (Rückfrage: „Bereits eingetragene Tage behalten ihre Werte und heißen dann ‚Eigenes Gericht‘“).
- **Anlegen/Ändern** (`ernaehrung/gericht.tsx`, `?id=` zum Ändern): Name (1–60 Zeichen) und entweder **„Aus Zutaten“** (Lebensmittel suchen, Menge in g/ml/Stück, 1–30 Zutaten, „Ergibt Portionen“ 1–20, „Werte je Portion“ live aus packages/core) oder **„Werte direkt“** (kcal je Portion, Eiweiß/Kohlenhydrate/Fett optional). Weichen die Makros um mehr als 20 % von den kcal ab, kommt die ruhige Rückfrage „Stimmen die Werte?“ (keine Sperre).
- **Eintragen:** im Tagesverlauf (`ernaehrung/index.tsx`, Abschnitt „Eigene Gerichte“: Mahlzeit nach Uhrzeit vorbelegt, Portion ¼ · ½ · ¾ · 1 · 1¼ · 1½ · 2 · 3, ein Tipp je Gericht, höchstens 5 sichtbar + „Alle eigenen Gerichte“), auf „Eintragen“ unter **Favoriten** (oben „Eigene Gerichte“ mit Portion) und unter **Zuletzt** (eingetragene Gerichte, neu gerechnet aus dem aktuellen Gericht mit derselben Portion). Ab 1.500 kcal je Eintrag die Rückfrage aus E1. Bearbeiten eines Eintrags: Portion ¼–3, Mahlzeit, Tag (wie E1).
- **Schnappschuss:** Der Tagebuch-Eintrag speichert Portion und Werte; Ändern oder Löschen des Gerichts ändert eingetragene Tage nicht.
- **„Kalorienzahlen aus“ / Schwangerschaft:** Anlegen nur **„Aus Zutaten“** (Werte im Hintergrund berechnet, „sichtbar, wenn du die Kalorienzahlen einschaltest“) oder **„Ohne Werte“** (Eintrag zählt dann nur als „gegessen“); nirgends kcal (Liste, Formular, Tagesverlauf, Eintragen – Playwright prüft das ganze DOM inkl. data-testid). Vorhandene direkte Werte bleiben beim Ändern erhalten (nur ausgeblendet).
- **Zustände:** Laden, Ladefehler (`NutritionGate`), noch keine Gerichte („Eigenes Gericht anlegen“), keine Einwilligung (Erklärung + „Einwilligung erteilen“), 100 Gerichte, Gericht gibt es nicht mehr, Suche ohne Treffer, Zutat nicht mehr im Bestand („Du kannst den Namen ändern; die Werte bleiben wie gespeichert“), ungültige Eingaben (Texte ohne Namen und ohne Werte), Supabase-Modus („kommt bald auch für Konten“).
- **Offline:** Im Testmodus liegt alles im Gerätespeicher – Anlegen, Ändern, Löschen und Eintragen gehen ohne Netz und überstehen Neuladen. Im Supabase-Modus (N7 Teil 2) gehen sie über die verschlüsselte Ernährungs-Warteschlange (wie E1).
- **Datenschutz (sichere Voreinstellung):** Der Name ist Freitext. Eigene Gerichte deshalb **nur mit gültiger Einwilligung `health_data`** (Sperre FOR SHARE wie E1), **beim Widerruf gelöscht** (samt Zutaten; Dialogtext „… samt Schnelleintrag-Favoriten und eigenen Gerichten …“), im Export, beim Konto-Löschen per Kaskade. Der Name steht **nie im Tagebuch** (fester Titel „Eigenes Gericht“ + Verweis `custom_meal_id`; Anzeige über den Verweis, nach dem Löschen neutral „Eigenes Gericht“), nie in Fehlermeldungen (Ergebnis-Codes statt Meldungen, kein „Failing row contains …“), nie in testIDs (nur Position; Playwright prüft es), nicht in Logs oder Analytics.

**Core** (`packages/core/src/nutrition/custom-meal.ts`, `constants.ts`): `CUSTOM_MEAL_LIMITS` (100 Gerichte, 30 Zutaten, Name 60, Portionen 1–20, Toleranz 20 %, 16 KB), `CUSTOM_MEAL_PORTION_CHOICES`; `customMealSchema`, `customMealItemSchema`, `customMealPayloadSchema`, `customMealSaveResultSchema` (Zod, strikt); `customMealNutrients` (Zutaten → `computeRecipeFacts`, also dieselbe Rechnung wie Rezepte), `buildCustomMeal`, `renameCustomMeal`, `customMealComputable`, `customMealValuesNeedConfirmation`, `entryFromCustomMeal`, `foodLogDisplayTitle`, `orderCustomMeals`, `isValidCustomMealName`, `normalizeCustomMealName`, `canAddCustomMeal`. In `food-log.ts`: Herkunft `custom_meal`, Feld `custom_meal_id`, `CUSTOM_MEAL_ENTRY_TITLE`, `finishFoodLogEntry`; eigene Gerichte haben keinen Stern und erscheinen unter „Zuletzt“ nur, solange es das Gericht gibt.

**Migrationen** (Zeitstempel nach A1b, rein additiv):

- `20261015160000_custom_meals.sql` – `custom_meals` (CHECKs Name/Art/Portionen/Werte, Form je Art), `custom_meal_items` ((meal_id, user_id) → Kaskade, `order_no` 1–30, `food_id` → `foods` **on delete restrict**, Menge wie im Tagebuch); RLS: eigene Zeilen lesen; keine Einfüge-, Änderungs- oder Löschrechte (nur `save_custom_meal`/`delete_custom_meal`); anon ohne Rechte. `food_log_entries`: neue Spalte `custom_meal_id` mit FK (custom_meal_id, user_id) → `custom_meals` **on delete set null (custom_meal_id)**; Herkunfts-CHECK und Form-CHECK um den Zweig `custom_meal` erweitert (fester Titel „Eigenes Gericht“, Portion, Werte optional, Makros nur mit kcal) – alle bisherigen Zeilen bleiben gültig; Verweis nur bei dieser Herkunft.
- `20261015160100_custom_meal_rpcs.sql` – `save_custom_meal(p_meal)` (security definer, `search_path = ''`, REVOKE public/anon, nur authenticated); `save_food_log_entries`, `private.consents_after_revoke()`, `export_my_data()` als **echte Obermenge der neuesten Fassung** aus `20261015130100_food_log_rpcs.sql`: jede alte Zeile steht unverändert und in derselben Reihenfolge darin (geprüft mit einem Zeilen-Teilfolgen-Abgleich; `git diff --word-diff` zeigt nur angehängte Kommas bzw. eingefügte Zeilen: save +22 Zeilen, Widerruf +4, Export +2).

**Präzisierungen** (vom Plan nicht festgelegt, vorsichtig entschieden):

1. **Kein Freitext im Tagebuch:** Einträge aus eigenen Gerichten tragen immer den Titel „Eigenes Gericht“ (CHECK in der Datenbank, Server setzt ihn, nie vom Gerät) und den Verweis; der Name kommt nur in der Anzeige aus `custom_meals`.
2. **Werte je Portion als Schnappschuss im Gericht** (auch „aus Zutaten“): Eine später archivierte Zutat ändert nichts; solange eine Zutat fehlt, geht nur Umbenennen (neu rechnen nicht, Hinweis in der App).
3. **Form:** „Werte direkt“ = genau 1 Portion, keine Zutaten, kcal 0–3.000 ganz, Makros 0–750 g (eine Nachkommastelle) optional und nur mit kcal (wie Schnelleintrag); „ohne Werte“ erlaubt. „Aus Zutaten“ = 1–30 Zutaten, 1–20 ganze Portionen, alle Werte gesetzt, je Zutat höchstens 2.000 g, je Portion höchstens 3.000 kcal. Name 1–60 Zeichen, ohne Steuerzeichen und Leerraum am Rand (die App fasst Leerraum zusammen). Der Server rundet nie still.
4. **Plausibilität (Plan: „Rückfrage bei mehr als 20 % Abweichung“):** Sind alle drei Makros angegeben, zählt die Abweichung in beide Richtungen (Bezug: angegebene kcal); fehlen Makros, nur „zu viel“ (die angegebenen Makros ergeben schon mehr als kcal + 20 %).
5. **Server-Prüfung (`save_custom_meal`):** Login, Profil, Einwilligung (FOR SHARE vor der Prüfung) → Advisory-Sperre je Person (Obergrenze 100 ohne Wettlauf) → Zeilen. Antwort `saved` · `conflict` (`revision` | `deleted` mit id null) · `rejected` (`invalid` | `limit`); Ausnahme nur ohne Login/Profil/Einwilligung. Idempotent je `write_id`, optimistische Sperre je `revision`, fremde id → neue id ohne unterscheidbare Meldung. Neue Zutaten nur aus **freigegebenen** Lebensmitteln; ein inzwischen archiviertes Lebensmittel bleibt erlaubt, wenn es schon in diesem Gericht steckt. Werte aus Zutaten rechnet der Server selbst (Nachtrag, E2-G2).
6. **`save_food_log_entries`:** Feld `custom_meal_id` (fehlt es, gilt null – ältere Geräte bleiben gültig); bei `custom_meal` setzt der Server den Titel und behält den Verweis nur für ein eigenes Gericht dieser Person (sonst leer, ohne unterscheidbare Meldung; FOR KEY SHARE hält das Gericht bis zum Ende des Speicherns); Verweis bei anderer Herkunft → `rejected`/`invalid`. Testmodus gleich (`checkFoodLogSave`).
7. **Löschen** geht immer (auch ohne Einwilligung, Recht auf Löschung) über `delete_custom_meal` (Nachtrag S1); Zutaten per Kaskade, Tagebuch-Verweise werden leer (Testmodus gleich).
8. **Kein Stern** für eigene Gerichte – sie stehen ohnehin unter „Favoriten“ → „Eigene Gerichte“ (keine Änderung an `food_log_favorites`).
9. **Gerätespeicher** ist nicht vertrauenswürdig: nur gültige Gerichte des eigenen Kontos (Zod, strikt, Zutaten lückenlos 1…n), höchstens 100; Tagebuch-Verweise auf verworfene Gerichte werden leer; E1-Einträge ohne `custom_meal_id` gelten als ohne Verweis.
10. **Neue Fehlercodes** in der App: `custom_meal_limit`, `custom_meal_rejected` (Texte ohne Namen und ohne Werte).
11. **Einwilligungstext** `health_data` wurde nicht hochgezählt (wie E1 Präzisierung 14); die nächste Fassung nennt zusätzlich „eigene Gerichte“.

**Tests**

- Core: `custom-meal.test.ts` (74 Tests: Grenzen, Name 1/60/61, Emoji, Steuerzeichen, Schema je Art, 1 und 30/31 Zutaten, Portionen 0/1/20/21/1,5, archivierte Zutat → Schnappschuss + Umbenennen, Stück ohne Gewicht, ml ohne Umrechnung, 2.000/2.001 g, 17 Bananen, 0-kcal-Gericht, über 3.000 kcal je Portion, direkte gegen berechnete Werte inkl. Grenzen ±20 %, Portion ¼/3 ja, 0,2/3,25 nein, 3.000 kcal × 3, Schnappschuss nach Ändern, Titel fest, kein Name im Eintrag, kein Stern, Anzeige nach Löschen, Reihenfolge, „Zuletzt“; **Eigenschaftstests** mit 60 s Timeout: 1.500 zufällige Zutaten-Gerichte = `computeRecipeFacts`, Eintrag skaliert, nie mit Namen; 3.000 direkte Gerichte; 3.000 Namen). `db-sync.test.ts` (E2: CHECK-Listen, Feldlisten = Zod, Grenzen, fester Titel, Sperr-Reihenfolge, Codes, Widerruf zweimal, restrict/set null; E1-Prüfungen lesen jetzt die neueste Fassung).
- App: `custom-meals.test.ts` (10 Tests: Einwilligung, Anlegen/Ändern/neu laden, ungültig ohne Namen in der Meldung, 100/101, Eintrag mit festem Titel, fremder Verweis, Löschen ohne Einwilligung, Widerruf, Export-Spalten, ungültiger Gerätespeicher), `row-types.test.ts` (Spalten = Datenbank), Export-Spalten in `food-log.test.ts`/`supabase-backend.test.ts`.
- pgTAP `32_custom_meals.test.sql` (86 Tests): Rechte inkl. anon, RLS, security definer, Sperr-Reihenfolge, Login/Profil/Einwilligung, direktes Einfügen verboten, Idempotenz, revision-/deleted-Konflikte, Grenzen (Name, kcal, Makros, Portionen, 30/31 Zutaten, Mengen, Felder), nur freigegebene Lebensmittel, archivierte Zutat im Gericht, on delete restrict, 100/101 Gerichte, Ablehnung ohne Namen/Werte, Tagebuch (fester Titel, Verweis, ohne Werte, Makros ohne kcal, Portion, Verweis bei anderer Herkunft, altes Gerät ohne Feld, Schnappschuss), Isolation (lesen, fremde id, ändern, löschen, fremder Verweis), Löschen (Verweis leer, Kaskade, ohne Einwilligung), Export, Widerruf, Kaskade beim Konto-Löschen. Lokal gegen Postgres 16 + pgTAP mit Supabase-Ersatz: **alle 30 Dateien, 1.475 Tests grün**.
- Zwei Verbindungen (Harness `race.sh`): Gericht speichern (ohne Commit) → Widerruf wartet (2,1 s) → danach 0 Gerichte, 0 Zutaten; Widerruf zuerst → Speichern abgelehnt („Einwilligung Gesundheitsdaten fehlt.“); Gegenprobe ohne FOR SHARE → 1 Gericht + 1 Zutat überleben den Widerruf.
- Playwright (Testmodus, Handy-Ansicht): `custom-meals.spec.ts` – „Mein Porridge“ aus Haferflocken 60 g, Milch 200 ml, Banane 1 Stück → 465 kcal → ½ Portion im Tagesverlauf → 233 kcal, Tagessumme, kein Stern; direkt 450 kcal; Rückfrage bei 20 % und Namensfehler; Favoriten/Zuletzt; Ändern (Schnappschuss bleibt); Löschen („Eigenes Gericht“); neu laden; kein Name in testIDs. Zweiter Test: „Kalorienzahlen aus“ (kein „Werte direkt“, kein kcal im ganzen DOM), ohne Werte, 100 Gerichte, Widerruf, ohne Einwilligung. Dazu `nutrition-food-log.spec.ts` und `nutrition.spec.ts` grün (11 Tests).

**Gegenproben** (gebrochen → rot → zurückgesetzt): Core – 2.000-g-Grenze je Zutat entfernt, Name statt festem Titel, gelöschte Gerichte in „Zuletzt“, Verweis bei anderer Herkunft erlaubt, 20 %-Regel abgeschaltet; db-sync – Obergrenze SQL 101 ≠ Core, Widerruf löscht nur einmal; App – Widerruf löscht Gerichte nicht, Anlegen ohne Einwilligung, Löschen lässt Verweis stehen, 101. Gericht erlaubt, fremde Gerichte im Gerätespeicher; pgTAP – FOR SHARE entfernt, Einwilligungs-Prüfung entfernt, Widerruf ohne Löschen der Gerichte, RLS `using (true)`, archivierte Lebensmittel erlaubt, Titel vom Gerät, Verweis auf fremdes Gericht, 101 Gerichte, Fehler nicht abgefangen (Meldung mit Zeileninhalt); Harness – ohne FOR SHARE überlebt ein gleichzeitig gespeichertes Gericht den Widerruf; Playwright – Name in einer testID und kcal trotz „Zahlen aus“ (beide Tests rot).

**Gründer-Entscheidungen**

- **E2-G1 Widerruf – entschieden 15.10.2026: löschen.** Eigene Gerichte werden nur mit Einwilligung `health_data` angelegt und beim Widerruf gelöscht (Abweichung von A-G14 ausdrücklich freigegeben; Begründung: der Name ist Freitext und kann Gesundheitsbezug haben, Art. 9 und Art. 17 Abs. 1 lit. b DSGVO). Die nächste Fassung des Einwilligungstexts nennt „eigene Gerichte (Name und Werte)“.
- **E2-G2 (= E1-G4) Server rechnet nach – entschieden 15.10.2026: ja.** Umgesetzt im Nachtrag unten.

**Nachtrag: Auflagen der Wächter-Prüfung E2 (`waechter-e2.md`) und Gründer-Entscheidungen – umgesetzt**

- **S1 Sperr-Reihenfolge beim Löschen:** neue Funktion `delete_custom_meal(p_id)` (security definer, `search_path = ''`, REVOKE public/anon): Person (dieselbe Advisory-Sperre wie `save_food_log_entries`) → Tagebuch-Einträge mit dem Verweis (FOR UPDATE) → Gericht → löschen. Geht ohne Einwilligung, fremde/gelöschte ids ohne Wirkung mit gleicher Antwort. Das DELETE-Recht auf `custom_meals` und die Lösch-Policy sind weg; App und Testmodus löschen über diesen Weg. Harness `race.sh` (mit 2 s Pause im Harness, damit das Zeitfenster sicher getroffen wird): Eintrag speichern ∥ Gericht löschen → beide fertig, Eintrag ohne Verweis; Widerruf ∥ Gericht löschen → beide fertig; **Gegenprobe mit der alten Reihenfolge (direktes DELETE) → „deadlock detected“** in beiden Fällen. Damit ist H6 erledigt.
- **S2 Löschen ohne gültige Einwilligung:** Fehlt die Einwilligung oder ist sie veraltet (neue Textfassung), zeigt „Eigene Gerichte“ einen Hinweis und die Liste nur mit „Löschen“ (kein Anlegen, Ändern, Eintragen; der Abschnitt im Tagesverlauf ist ausgeblendet). Test: App (`customMealAccess`) und Playwright.
- **H1 Namensprüfung gleich:** Core (`CUSTOM_MEAL_NAME_FORBIDDEN_CLASS`, `CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS`) und CHECK nutzen dieselben ausdrücklichen Unicode-Bereiche: keine Steuerzeichen (C0/C1), Zero-Width/Richtungsmarken (U+200B–200F), Zeilen-/Absatztrenner und Bidi-Steuerung (U+2028–202E), unsichtbare Operatoren (U+2060–2064), Bidi-Isolates (U+2066–2069), BOM (U+FEFF); kein Leerraum am Rand (auch U+00A0, U+3000 …). Dieselben 27 Fälle in `custom-meal.test.ts` und pgTAP 32 (`name_cases`); db-sync prüft die Zeichenklassen. Die App entfernt unsichtbare Zeichen beim Normalisieren.
- **H2 „Zuletzt“:** Ein Tipp trägt aus dem **aktuellen** Gericht mit der zuletzt gewählten Portion ein; die Detailzeile zeigt jetzt genau diese Werte (`recentDetailText`), nicht den alten Schnappschuss. Gelöschte Gerichte erscheinen nicht.
- **H3 Portionen:** „Ergibt Portionen“ bietet 1–20 an (aus `CUSTOM_MEAL_LIMITS`).
- **H4 Grenzen zentral:** Texte lesen die Grenzen aus `CUSTOM_MEAL_LIMITS`/`FOOD_LOG_LIMITS`; die Feldprüfung „Werte direkt“ ist `checkCustomMealDirectValues` in packages/core.
- **H5 Bedienhilfe:** Makro-Fehler stehen am jeweiligen Feld (`error`), nicht als Hinweis darunter.
- **H7:** zusätzlicher von Hand gerechneter Fall (Banane 2 Stück + Milch 300 ml, 3 Portionen = 140 kcal · 4,4 · 20,9 · 3,8) in Core und pgTAP.
- **H8 (Hinweis, wie E1):** Bei Ausnahmen außerhalb der abgefangenen Blöcke (fehlende Einwilligung, Deadlock) protokolliert Postgres die Anweisung; über PostgREST ist sie parametrisiert – der Name steht nur im Log, wenn `log_parameter_max_length_on_error` > 0 ist (Supabase-Standard 0). Vor dem Livegang einmal prüfen.
- **E1-G4/E2-G2 Server rechnet nach:** Hilfen `private.js_round`/`js_round1` (Math.round, halbe aufwärts – nicht Postgres-`round`, das double precision zur geraden Zahl rundet), `private.grams_per_unit` (= gramsPerUnit, Prise = PINCH_G), `private.ingredients_per_serving` (= computeRecipeFacts: Summe (Gramm × Wert)/100 der nicht optionalen, umrechenbaren Zutaten in Reihenfolge, ÷ Portionen), `private.food_log_server_values`. Rechnung in double precision mit derselben Reihenfolge der Operationen wie JavaScript. Die Werte kommen aus `foods.data` (Inhaltsdatei) und `recipe_ingredients`.
  - `save_custom_meal` „aus Zutaten“: Werte je Portion vom Server, Gerätewerte ignoriert; die Antwort `saved` nennt die gespeicherten Werte (`customMealSaveResultSchema`), die App übernimmt sie (Supabase-Modus seit N7 Teil 2; im Testmodus rechnet derselbe Core). Nicht berechenbar (Stück ohne Gewicht, über 2.000 g) → `rejected`/`invalid`.
  - `save_food_log_entries` (weiter echte Obermenge der neuesten Fassung, Sperr-Reihenfolge unverändert): Lebensmittel (= entryFromFood), Rezept (= entryFromRecipe aus den Rezept-Zutaten) und eigenes Gericht (= entryFromCustomMeal) bekommen ihre Werte vom Server; beim **Ändern desselben Inhalts** gilt seit der Nachprüfung (Runde 2, unten): gleiche Menge/Portion → Schnappschuss unverändert, Quelle im Bestand → neu aus der Quelle, sonst verhältnisgleich aus dem Schnappschuss. Schnelleintrag (feste Bezeichnung + kcal) und Plan-Mahlzeit (Schnappschuss des Essensplans mit Portionsfaktor/Tausch) behalten die Gerätewerte. Nicht berechenbar (unbekannter Inhalt, Stück ohne Gewicht, über 2.000 g) → `rejected`/`invalid` ohne Werte; ein fehlendes eigenes Gericht siehe Runde 2 (S1). Die App übernimmt die gespeicherten Werte beim Neuladen nach dem Speichern (N7 Teil 2); der Testmodus baut die Einträge mit derselben Rechnung.
  - Gleichheit Core ↔ SQL: db-sync (Einheiten, Prise, 2.000 g, Rundungsformel, Reihenfolge der Rechnung), pgTAP mit von packages/core gerechneten Werten (Hafer 60 g = 222 kcal, Banane 1 Stück = 112, Milch 200 ml = 132, Rezept mit optionaler Zutat, Stück ohne Gewicht und EL = 356 kcal bei 1½ Portionen, Porridge 465, manipulierte 1 kcal ersetzt) und ein **Kreuzvergleich im Harness: 4.306 Zufallsfälle (1.027 Lebensmittel, 1.796 Rezept-Einträge, 1.483 eigene Gerichte) mit 0 Abweichungen**.
- **Gegenproben (rot → zurückgesetzt):** S1 – `delete_custom_meal` ohne Eintrags-Sperre (pgTAP rot) und alte Reihenfolge im Harness (Deadlock); S2 – Liste ohne Einwilligung wieder gesperrt bzw. mit „Ändern“ (App/Playwright rot); H1 – Core ohne Bidi-Bereich bzw. CHECK wieder mit POSIX-Klassen (Core/db-sync/pgTAP rot); Server-Rechnung – Werte vom Gerät übernommen (pgTAP rot), `round()` statt Math.round (Kreuzvergleich mit Abweichungen).

**Nachtrag Runde 2: Nachprüfung des Wächters (`waechter-e2-nachpruefung.md`) – umgesetzt**

- **S1 Gelöschtes/fremdes Gericht hängt nicht mehr:** Fehlt das eigene Gericht (gelöscht oder fremd), wird der Verweis leer, der Titel bleibt „Eigenes Gericht“. Neuer Eintrag → die Werte des Geräts, geprüft mit denselben Grenzen wie die CHECKs (sonst `invalid`); keine Werte aus fremden Gerichten. Ändern eines Eintrags, dessen Gericht fehlt (alter Verweis = neuer, oder einer davon leer) → verhältnisgleich aus dem Schnappschuss. Server (`food_log_server_values`) und Testmodus (`checkFoodLogSave`, Kommentar korrigiert) gleich. pgTAP: (a) offline eingetragen, dann gelöscht → gespeichert, Verweis leer, 3.001 kcal abgelehnt; (b) Gerät A löscht, Gerät B ändert die Portion mit altem Verweis → gespeichert (200 × 2). App-Test (a)/(b) im Testmodus.
- **H1 2.000 g auch beim Ändern:** Der Schnappschuss-Weg prüft bei Lebensmitteln die Gramm über die Umrechnung aus `foods.data` (Stück/ml wie `rescaleEntry`). pgTAP: archivierte Gurke 2 → 6 Stück (2.400 g, nur 288 kcal) abgelehnt, 2 → 3 Stück geht.
- **H2 Ändern aus der Quelle:** Ist die Quelle im Bestand (Lebensmittel/Rezept freigegeben, eigenes Gericht vorhanden), wird beim Ändern von Menge bzw. Portion neu aus der Quelle gerechnet; nur ohne Quelle (archiviert, gelöscht) aus dem Schnappschuss; unveränderte Menge (z. B. nur verschieben) behält den Schnappschuss. Core: neue Funktion `rebuildEntry` (App „Eintrag ändern“ nutzt sie), SQL gleich. Test: Gurke 1 g → 2.000 g = 240 kcal · 12 · 36 (Core und pgTAP). Hinweis: Ändert man die Portion eines Eintrags aus einem inzwischen geänderten eigenen Gericht, gelten dafür die neuen Werte des Gerichts; nur Verschieben lässt den Schnappschuss unverändert.
- **H3 Gerätewerte weiter geprüft:** Vor dem Ersetzen prüft `private.food_log_device_values_ok` Form und Bereich wie die CHECKs (Lebensmittel/Rezept: alle Werte Pflicht; kcal 0–3.000, Makros 0–750; Makros nur mit kcal) – ungültig bleibt `invalid` wie in E1 und wie Zod. pgTAP: kcal null, 99.999 kcal, −1 g, 800 g Eiweiß, Gericht mit Makros ohne kcal.
- **H4 (nur Doku):** „Server rechnet nach“ ist keine Integritätsgrenze für alle Werte: **Schnelleintrag** (feste Bezeichnung + kcal) und **Plan-Mahlzeit** behalten die Werte des Geräts (geprüft nur auf Form und Grenzen). Die Plan-Mahlzeit wird mit N7 Teil 2 gegen den gespeicherten Essensplan geprüft (Rezept, Platz, Werte). Für A2: Werte aus dem Tagebuch sind Angaben der Person, keine geprüften Werte.
- **H5:** pgTAP prüft die Tabellen-CHECK `amount ≤ 2.000` direkt (Einfügen als Eigentümer ohne Funktion → `23514`).
- **Gegenproben (rot → zurückgesetzt):** S1 – gelöschtes Gericht wieder abgelehnt (pgTAP rot) bzw. im Testmodus abgelehnt (App rot); H1 – Gramm-Prüfung im Schnappschuss-Weg entfernt (pgTAP rot); H2 – immer aus dem Schnappschuss (pgTAP und Core rot); H3 – Prüfung der Gerätewerte entfernt (pgTAP rot).

**Offen**

- N7 Teil 2: App im Supabase-Modus (Laden von `custom_meals`/`custom_meal_items`, `save_custom_meal` über die eigene verschlüsselte Warteschlange wie das Tagebuch, Ergebnis-Codes in der App, abgelehnte Einträge nach G3 aus E1 lokal behalten).
- Neue Fassung des Einwilligungstexts `health_data` mit „Ernährungstagebuch und eigene Gerichte“ – vor N7 Teil 2, juristisch prüfen.
- Screenshots hell/dunkel (DoD 6) der neuen Bildschirme.
- Bekannt (Wächter E1 H4, bestehendes Muster): Konto löschen gleichzeitig mit Speichern kann einen Deadlock-Abbruch auslösen – kein Datenleck, nur Wiederholen. (Löschen eines Gerichts gegen Speichern/Widerruf – Wächter E2 S1/H6 – ist behoben.)
- Plan-Mahlzeiten: Werte bleiben der Schnappschuss des Essensplans vom Gerät (Portionsfaktor, Tausch, Ersatz sind serverseitig nicht nachrechenbar, solange `save_meal_plan` nicht nachrechnet).
- N7 Teil 2: Server-Werte nach dem Speichern übernehmen (Gericht: aus der Antwort; Tagebuch: neu laden).
- H8: `log_parameter_max_length_on_error` im Supabase-Projekt prüfen (Standard 0).

---

## 8. Etappe A3 – Wochenauswertung

**Ziel:** Bildschirm „Wochenauswertung“ (Mo–So, Woche beginnt Montag wie in der ganzen App), erreichbar aus „Woche“ und Kalender. Blättern wie bisher (`weekPager`).

**Inhalt:**

- **Essen:** Sieben kleine Tagesbalken mit Farbe und Text-Kürzel. Darunter: „An 5 Tagen eingetragen. Davon 3 im Zielbereich, 1 etwas darunter, 1 etwas darüber.“ Durchschnitt **je eingetragenem Tag** gegen das Durchschnittsziel dieser Tage („Ø 1.760 von Ø 1.840 kcal“). Tage ohne Eintrag zählen nicht mit. Keine Wochen-Bilanz in kcal, keine Prognose.
- **Training:** je Einheit Name, Tag, Stufe (2.5), Erfüllungsgrad. Summen: Einheiten erledigt/geplant, Kraft-Sätze erfüllt/geplant, Ausdauer-Minuten gemacht/geplant, km. Freie Einheiten extra aufgeführt.
- Muster-Hinweis aus 2.4 (≥ 3 Tage unter der Untergrenze).

**Core + Tests:** `weekEvaluation(days)` baut auf `weekLogSummary()` und `dayEvaluation()` auf. Tests: leere Woche, nur Training, nur Essen, laufende Woche (heute zählt als „offen“), Erholungswoche, Woche mit verschobenen und nachgetragenen Einheiten, freie Einheiten, Zahlen aus (keine kcal im Ergebnis), genau 2 vs. 3 Tage unter der Untergrenze.

**DB:** keine.

**Zustände:** wie A2, dazu „Diese Woche hat noch nicht begonnen“ und „Zu alt für den Gerätespeicher“.

**So testet ihr es am Handy:** Ein paar Tage abhaken und trainieren (auch nachtragen) → Woche → „Wochenauswertung“ → Zahlen stimmen mit den Tagesansichten überein. Vorwoche blättern. Zahlen aus → nur Mahlzeiten-Anzahl und Training. Drei Tage mit sehr wenig eintragen → ruhiger Hinweis mit Hilfe-Kontakten.

### Umsetzungsstand A3 (15.10.2026)

**Was gilt:**

- **Core** `packages/core/src/evaluation/week-evaluation.ts`: `weekEvaluation({ weekStart, today, showNumbers, days, sessions, logs, achievements, plannedTargets })` – prüft Montag und genau die Tage Mo–So (aus `weekLogSummary`), ruft je Tag `dayEvaluation()` mit den Einheiten des Tages aus `weekLogSummary()` auf und setzt nur zusammen: `days` (= „Dein Tag“ je Tag), `food` und `training`, `timing` (`past` | `current` | `future`), `easyWeek`. **Essen mit Zahlen** (`kind: 'numbers'`): `entryDays`, `valuedDays`, `withoutValueDays`, `zoneCounts` (Summe = `valuedDays`), `average` (Ø gegessen und Ø Tagesziel nur über vergangene Tage mit Balken; keine Summe, keine Bilanz, keine Prognose), `belowFloorDays`, `patternNotice`, `meals`, `todayOpen`, `targetNotices`. **Ohne Zahlen** (`kind: 'hidden'`, Überladung bei `showNumbers: false` → Typ `WeekEvaluationWithoutNumbers` ohne jede kcal): nur `entryDays`, `meals`, `todayOpen`. **Training:** `items` (Plan-Einheiten inkl. offen/verpasst/gestrichen/entfallen), `free` (freie Einheiten), `sessions` erledigt/geplant (`weekLogSummary`), `strengthSets` erfüllt/geplant/abgehakt, `enduranceMinutes` gemacht/geplant, `distanceM`, `freeTotals`. Neue Konstante `WEEK_EVALUATION.patternBelowFloorMinDays = 3` (A-G13, PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN); sonst keine Grenzwerte.
- **Keine Migration.** Gelesen werden Trainingstagebuch, Plan, Essensplan und Ernährungstagebuch aus dem Gerätespeicher; nichts wird gespeichert oder geloggt.
- **App** Route `apps/mobile/src/app/wochenauswertung.tsx` (`/wochenauswertung?woche=JJJJ-MM-TT`, jeder Tag der Woche erlaubt, wird auf Montag gesetzt), Bausteine `components/week-evaluation.tsx` (Tageszeile mit kleinem Balken aus `View`-Breiten, Zielmarke, Zeichen + Kurztext, ganze Zeile tippbar → „Dein Tag“; Einheit mit Tag, Stufe, Prozent), Abbildung `data/week-evaluation.ts` (`weekEvaluationInput`, `weekPlannedTargets`, `firstCompleteWeek`, `weekEvaluationNavigation`), Formulierung `lib/week-evaluation-format.ts`, Texte `i18n/de-week-eval.ts` (`t.weekEval`). Einstiege: **Woche** → „Wochenauswertung“ (angezeigte Woche), **Kalender** → „Wochenauswertung“ (angezeigte Woche, während des Ziehens gesperrt). Muster-Hinweis = Einleitungssatz + fester Hinweis `EatingHelpNotice` (gleicher Text wie PLAN-PHASE-5 4.9).
- **Zustände:** wie A2 (Laden von App/Ernährung/Bibliothek, offline-Hinweis, ohne Einwilligung, Angaben unvollständig/gesperrt/Rechenfehler, ohne Körperdaten (Einladung einmal), Schwangerschaft, Zahlen aus, kein Trainingsplan, keine Einheiten, Supabase-Modus Essen „kommt bald“, Rechenfehler → „Diese Woche lässt sich gerade nicht auswerten …“ ohne Log) sowie **„Diese Woche hat noch nicht begonnen“** (nur Training mit geplanten Einheiten, kein Essensteil), **„Zu alt für den Gerätespeicher“** (Supabase: Woche vor der ersten vollständig gespeicherten Woche → Hinweis + „Zum Verlauf“) und ungültige Woche (Fehlerzustand + „Zur Woche“).
- **Tests:** Core `week-evaluation.test.ts` (26: Eingaben, Zeitpunkt, leere Woche, nur Training, nur Essen, laufende Woche mit heute offen, Erholungs-/Einstiegswoche, verschobene/nachgeholte/nachgetragene Einheiten, freie Einheiten, gestrichen/entfallen, Zahlen aus mit Typprüfung, Schwangerschaft an einem Tag, genau 2/3 Tage und genau auf U, kein Hinweis über dem Ziel bzw. für heute, Ø ohne leere Tage und Einträge ohne kcal, ohne Körperdaten, ohne Tagebuch, Mahlzeiten, künftige Woche; Eigenschaften mit 250 zufälligen Wochen aus echten Engine-Zielen, je 60 s: Tage = „Dein Tag“, Wochenzahlen = Summe der Tagesansichten und = `weekLogSummary`, Ø nur über eingetragene Tage (leere Tage leeren ändert nichts), keine Bilanz/Summe/Prognose (Schlüsselliste, kcal nur im Ø), ohne Zahlen nur Anzahlen < 100 und nirgends „kcal“, Muster-Hinweis gegen unabhängiges Orakel; Strukturtest wie A2 d: keine Grenz-Funktionen/-Konstanten, kein Zugriff auf `floorKcal`/`band`/…, Importe nur erlaubte Module, aus `constants` nur `WEEK_EVALUATION`, keine Zahl-Literale außer 0 und 1). App `data/week-evaluation.test.ts` (11), `lib/week-evaluation-format.test.ts` (12, inkl. Sprachprüfung 2.4). Playwright `apps/mobile/e2e/week-evaluation.spec.ts` (4 Tests: Einstiege Woche/Kalender, Tageszeilen mit Kurztext und Bedienhilfe, Tippen → „Dein Tag“ mit gleicher Zone, Ø gegen die Tagesziele aus „Dein Tag“, heute offen, 2 Tage kein Hinweis / 3 Tage genau einmal mit Hilfe-Stellen, keine Bilanz, Training mit Summen und „◐ Teilweise gemacht“, Blättern, neu laden; „Zahlen aus“ ohne „kcal“/„Kilokalorien“ im ganzen DOM inkl. Attributen, keine Zahl ab 100 und kein „x von y“ außer Mahlzeiten im Essensteil; Schwangerschaft; noch nicht begonnene Woche; ungültige Woche). Screenshots hell/dunkel `wochenauswertung`, `wochenauswertung-summen`, `wochenauswertung-training`.

**Präzisierungen (vom Plan nicht ausdrücklich festgelegt, vorsichtig gelöst):**

1. **Heute zählt nicht mit** (weder in „An n Tagen“, Zonen, Ø noch Muster-Hinweis) – der Tag läuft noch („Heute läuft noch und zählt erst danach mit.“). Der kleine Balken von heute zeigt dieselbe Zone wie „Dein Tag“ (unter dem Beginn von Grün „Noch offen“).
2. **Muster-Hinweis:** Mit Zahlen erscheint er unter den Wochenzahlen, genau einmal, mit einem ruhigen Einleitungssatz ohne Zahl („Laut deinen Einträgen lagen in dieser Woche mehrere Tage unter deinem Mindestbedarf. Dein Körper braucht an solchen Tagen mehr.“) und dem festen Hinweis mit Hilfe-Stellen. Bei „Kalorienzahlen aus“ siehe „Nach der Wächter-Prüfung“ G1; bei Schwangerschaft/Stillzeit nie (keine Untergrenze, der Hinweis auf Ärztin/Arzt/Hebamme bleibt).
3. **Schwangerschaft an einem Tag der Woche** → die ganze Woche ohne Zahlen (wie `weekHidesEnergyNumbers`); `weekEvaluation` rechnet dann alle Tage ohne Zahlen neu, auch wenn die App „Zahlen an“ übergibt.
4. **Einträge ohne kcal:** Ein vergangener Tag nur mit solchen Einträgen zählt bei „eingetragen“ („1 ohne Kalorienangabe“), aber nicht in Zonen und Ø. Tage ohne Tagesziel getrennt („1 ohne Tagesziel“ + „Ohne Tagesziel gibt es keine Farben für die Tage.“, Wächter S2).
5. **Training „geplant“:** Einheiten = `weekLogSummary().sessionsPlanned` (aktiver Plan, Termin in der Woche, gestrichene nur mit Eintrag). Kraft-Sätze geplant = bei eingetragenen Einheiten die Vorgabe-Sätze aus dem Schnappschuss (wie der Erfüllungsgrad), bei offenen/verpassten die Summe `planned_exercises.sets`; gestrichene und entfallene zählen nicht. Ausdauer geplant = `estimated_minutes`. Erledigt = alle Einträge ohne freie (auch verwaiste). Freie Einheiten nur in `freeTotals`/„Freie Einheiten“.
6. **Blättern** wie „Woche“ (`summaryWeekBounds` + `weekPager`), Grenze im Supabase-Modus = erste **vollständig** gespeicherte Woche (`logHistoryStart` liegt meist mitten in einer Woche). Eine ältere bzw. außerhalb liegende Woche (nur per Link) wird nicht still auf eine andere geklemmt: „zu alt“ bzw. Weg zurück in die Grenzen.
7. **Kurztexte** je Tag: „✓ Im Zielbereich“, „↘ Etwas darunter“, „↗ Etwas darüber“, „↓ Unter Mindestbedarf“, „↑ Deutlich darüber“, „○ Noch offen“, „– Nichts eingetragen“, „– Ohne Kalorienangabe“, „– Kein Tagesziel“, „Geplant“; ohne Zahlen „x von y Mahlzeiten“ bzw. „• Eingetragen“. Bedienhilfe der Zeile „Montag, 12.10.: Im Zielbereich. Dein Tag öffnen“ (Rolle Link). testIDs nur mit Datum (`week-eval-day-<Datum>`), nie mit Zone oder Wert.
8. **Ø gerundet** auf ganze kcal in der Anzeige („Ø 1.760 von Ø 1.840 kcal je eingetragenem Tag“), mit dem Satz „Tage ohne Eintrag zählen nicht mit. Laut deinen Einträgen – Schätzwerte, nach deinen aktuellen Angaben.“

**Gegenproben (Regel absichtlich gebrochen → rot → zurückgesetzt):** Core: Hinweis erst ab 4 Tagen (3 Tests rot), heute zählt mit (3), Ø über alle 7 Tage (4), freie Einheiten in den Plan-Summen (2), Schwangerschaft ohne Neuberechnung (1), Zahl 3 statt `WEEK_EVALUATION` (Strukturtest, 1), offene Einheiten nicht als geplant (4). App: Tage ohne kcal-Angabe nicht genannt (1), ohne Zahlen mit Farbe/Balken (1), Leistungssprache „geschafft!“ (3). Playwright: Bildschirm übergibt immer „Zahlen an“ → Test „Kalorienzahlen aus“ rot.

**Nach der Wächter-Prüfung (15.10.2026, `waechter-a3.md`, kein Blocker) umgesetzt:**

- **S1 – Einheiten an der Wochengrenze:** Ein Eintrag gehört zur Woche des **Termins** seiner Einheit (coalesce(`original_date`, `scheduled_on`)); ohne bekannte Einheit (frei, verwaist) zur Woche seines Datums. Korrigiert in `weekLogSummary()` – damit gleich in „Woche“, „Dein Tag“ und Wochenauswertung, Liste **und** Summen. Liegt das Eintragsdatum außerhalb der Woche (± 1 Tag, W2), steht der Eintrag am Termin mit „gemacht am Mo, 19.10.“ (`DayItem.performedOn`); „Dein Tag“ und die Wochenauswertung lesen den Erfüllungsgrad deshalb aus den Einträgen ± 1 Tag (`dayAchievementInputsAround`). Vorher: Vorwoche „0 von 1“ ohne Zeile, Folgewoche „1 von 0“. Test für beide Wochen; Eigenschaftstest über drei Wochen mit verschobenen, nachgeholten, über die Wochengrenze nachgetragenen, gestrichenen, verwaisten und freien Einträgen (300 Folgen) gegen ein **unabhängiges Orakel** (eigene Wochenrechnung, Einheiten/Sätze/Minuten erledigt und geplant, jeder Eintrag in genau einer Woche, nie mehr erledigt als geplant für den aktiven Plan).
- **S2:** „ohne Kalorienangabe“ nur für Tage, deren Einträge wirklich keine kcal haben; Tage ohne Tagesziel eigene Zahl `noTargetDays` und ruhiger Text.
- **H1:** Die Mahlzeiten-Zahl zählt nur vergangene Tage (heute läuft noch – passt zum Satz darunter). **H2:** Bedienhilfe nie leer („Ernährungstagebuch hier nicht verfügbar“), heute wird angesagt („Donnerstag, 15.10., heute: …“). **H5:** ohne Geplantes nie „x von 0“ – dann „Einheiten: 1 erledigt“ bzw. „Ausdauer: 30 min“. **H6:** Playwright schaltet wirklich offline (`context.setOffline`) und blättert ohne Netz. **H7:** Handy-Anleitung 7h Schritt 6 nennt das Nachtragen in der Vorwoche.
- **G1 (sichere Wahl, Voreinstellung):** Bei „Kalorienzahlen aus“ wird intern weiter gezählt; ab 3 vergangenen Tagen unter der Untergrenze erscheint **nur** der feste Hilfe-Hinweis (`EatingHelpNotice`) – ohne Einleitungssatz, ohne „Mindestbedarf“, ohne Zahl, ohne Wertung. Im Typ ohne Zahlen nur ein Wahrheitswert `helpNotice`. Bei Schwangerschaft/Stillzeit nie.
- **G2 / H3:** Tage, deren gespeicherter Essensplan selbst unter der Untergrenze liegt, zählen weiter mit; die Woche sagt dazu „An n Tagen erreichte schon dein Essensplan deinen Mindestbedarf nicht – ergänze dort z. B. eine Portion Obst, Nüsse oder Joghurt.“ (Text wie „Dein Tag“, `planBelowFloorDays`).
- **Gegenproben:** S1 Woche wieder nach Eintragsdatum (3 rot), S2 alte Rechnung (2), G1 nie Hilfe-Hinweis (1, Playwright 1) bzw. auch bei Schwangerschaft (1), G2 kein Plan-Hinweis (1).

**Gründer-Fragen (sichere Voreinstellung gilt, bis ihr anders entscheidet):**

- **G1 – Hilfe-Hinweis bei „Kalorienzahlen aus“:** Voreinstellung (Wächter-Empfehlung): intern weiter zählen, ab 3 Tagen nur der feste Hilfe-Hinweis ohne Einleitung, ohne Zahl, ohne Wertung. **Mit einer Fachperson für Essstörungen prüfen.** Alternative: gar kein Hinweis bei „Zahlen aus“ (strikt A-G8).
- **G2 – Plan-Tage unter der Untergrenze:** Voreinstellung mitzählen + Plan-Hinweis in der Woche (umgesetzt).
- **G3 – Heute in der Woche:** Voreinstellung zählt erst ab morgen mit (auch bei den Mahlzeiten). Alternative: heute mitzählen, sobald grün erreicht ist.
- **G4 – Wochengrenze:** Voreinstellung zählt eine an der Wochengrenze nachgeholte Einheit in der Woche ihres Termins (Anzeige am Termin mit „gemacht am …“). Alternative: in der Woche des Eintrags.
- Fachlich vor dem Livegang (bestehend): A-G5, A-G11, dazu A-G13 (3 Tage).
- **Vor Livegang prüfen (Wächter H4):** Die Hilfe-Stellen im festen Hinweis (PLAN-PHASE-5 4.9) stehen noch ohne Telefonnummer/Adresse („bewusst ohne Telefonnummern, bis geprüft“) – vor der Veröffentlichung geprüfte, erreichbare Kontakte ergänzen.

**Offen:**

- Essen im Supabase-Modus seit N7 Teil 2 (Wochen vor der 4-Wochen-Frist ohne gespeicherten Plan); „Zu alt für den Gerätespeicher“ nur im Supabase-Modus erreichbar und dort nur per Unit-Test (`weekEvaluationNavigation`) geprüft, nicht live.
- Nativ (APK/TestFlight) nicht geprüft – Tageszeilen, TalkBack/VoiceOver-Ansage, Tippen mit dem Workflow `eas-build` am Gerät prüfen.
- E2 (eigene Gerichte) läuft parallel; Einträge aus eigenen Gerichten zählen über das Tagebuch automatisch mit (keine Anpassung nötig, solange sie `food_log_entries` mit kcal-Schnappschuss sind).

---

## 9. Etappe E3 – Gericht per Foto mit KI (Premium)

Entspricht KONZEPT 6.4 und 15. **Premium**, Echtzeit-KI, Anbieter laut Gründer-Entscheidung **Google Gemini** (Bildeingabe). Der Gratis-Weg (E1/E2) bleibt immer daneben nutzbar.

**Ablauf für die Person:**

1. Ernährung → „Per Foto“ → beim ersten Mal eigene Einwilligung (siehe 2.7) mit Hinweis auf Verarbeitung durch Google und auf „Schätzung“.
2. Foto aufnehmen oder wählen. Optional **kurze Info** (bis 120 Zeichen), z. B. „mit Sahnesoße, halbe Portion“.
3. Die App zeigt „Noch 23 Fotos in diesem Monat“.
4. Ergebnis als **Vorschlag**: erkannte Bestandteile (aus dem Lebensmittel-Katalog) mit geschätzter Menge. Alles änderbar, Bestandteile löschen/hinzufügen. Deutlich: „Schätzung – bitte prüfen“.
5. Erst „Eintragen“ schreibt ins Tagebuch (`source = photo`). Abbrechen speichert nichts.
6. Foto wird nach der Auswertung gelöscht (Standard). Speichern nur, wenn die Person es aktiv wählt (Frage A-G18; Empfehlung: in E3 gar nicht anbieten).

**Server (`apps/web`, Route `POST /api/ernaehrung/foto`):**

- Login prüfen, **Premium serverseitig** (`hasEntitlement('ai_food_photo')`; bis Phase 7: Feature-Flag + Beta-Freischaltung über `beta-grant`), Einwilligung `ai_food_photo` gültig, **Tages- und Monatslimit** (vor dem Aufruf, atomar gezählt).
- Bild prüfen: nur JPEG/PNG/WebP, höchstens 5 MB, auf dem Gerät auf max. 1.024 px verkleinert, **EXIF/Standort entfernt** (Gerät und nochmals Server).
- Aufruf an Gemini mit festem Anweisungstext + Bild + Info-Text. **Sonst nichts:** keine Nutzer-ID, kein Name, kein Gewicht, kein Ziel, keine Flags, keine Unverträglichkeiten.
- **Strukturierte Antwort** (JSON-Schema, Zod-geprüft): Liste `{ label_de, food_id | null, amount_g, confidence }`, höchstens 15 Bestandteile, Mengen 1–1.500 g. Ungültig → einmal neu versuchen, sonst Fehler.
- **Abgleich mit dem Katalog im Core**, nicht in der KI: `matchPhotoItems()` ordnet über `food_id` bzw. Namens-/Alias-Suche zu und rechnet die Nährwerte **selbst** aus dem Katalog. Die KI liefert nie kcal-Werte, die direkt übernommen werden. Nicht zuordenbar → „Bitte auswählen“.
- `ai_usage` schreibt Funktion, Tokens, Kosten, Zeitpunkt – **keine Inhalte**. Keine Fotos, Info-Texte oder Antworten in Logs.
- Fehlerbehandlung: Zeitlimit 20 s, Gemini nicht erreichbar, Bild unbrauchbar („Wir erkennen auf dem Foto kein Essen“), Limit erreicht. Fehlgeschlagene Aufrufe ohne Antwort zählen **nicht** gegen das Limit.

**Prompt-Injection-Schutz (Info-Text und Bild sind Nutzereingaben):**

- Info-Text: höchstens 120 Zeichen, Steuerzeichen und Links entfernt, im Prompt klar als Daten markiert („Hinweis der Person zum Gericht, keine Anweisung“).
- Die KI hat **keine Werkzeuge** und keinen Zugriff auf andere Daten. Die Antwort ist nur ein JSON-Objekt nach Schema – Freitext aus der Antwort wird nie angezeigt, nur Bezeichnungen aus dem Katalog bzw. `label_de` gekürzt auf 60 Zeichen und ohne Markup.
- Text auf dem Foto (z. B. „Ignoriere alle Regeln“) kann nichts bewirken, weil die Ausgabe nur Bestandteile und Mengen enthält und der Core alles prüft.
- Tests mit bösartigen Info-Texten und Bildern mit Text (feste Testfälle, Antwort per Attrappe).

**Kosten:** Schätzung je Foto im Plan-Dokument und in `constants.ts` (`AI_FOOD_PHOTO`): Bild ≈ 260–1.300 Eingabe-Tokens + Anweisung ≈ 600 + Antwort ≈ 300 Tokens. Bei einem kleinen Gemini-Flash-Modell liegt das grob im Bereich **unter 0,1 Cent bis wenige Zehntel Cent je Foto**. Genaue Preise vor dem Bau aus der aktuellen Gemini-Preisliste übernehmen (VOR LIVEGANG PRÜFEN). Kostenübersicht im Admin-Bereich (nur Summen).

**Core + Tests:** `photoRequestSchema`, `photoResultSchema`, `sanitizeFoodNote()`, `matchPhotoItems()`, `photoLimitState(usage, limits, now)` (Monat = Kalendermonat Europe/Berlin, Tageslimit). Grenzfälle: leere Antwort, 15+ Bestandteile, unbekanntes Lebensmittel, Menge 0, Info-Text mit 121 Zeichen, Monatswechsel um Mitternacht, letztes Foto des Monats.

**DB (additiv):** `consent_type` um `ai_food_photo` erweitern (+ Einwilligungstext v1 in `consent_documents`), `ai_usage` (falls noch nicht da: user_id, feature, input_tokens, output_tokens, cost_eur, created_at; RLS: eigene Zeilen lesen, Schreiben nur Server), Zähler-Funktion `ai_usage_reserve(feature)` gegen doppelte Anfragen. Privater Storage-Bucket `food-photos-tmp` (nur Server-Rolle) + Aufräum-Workflow. pgTAP.

**Neue Secrets:** `GEMINI_API_KEY` als Vercel Environment Variable (nur Server). In `.env.example` und SETUP.md eintragen; die Gründer tragen den Schlüssel selbst ein (Klick-Schritte im PR).

**Zustände:** kein Premium (Erklärung, Gratis-Weg anbieten), keine Einwilligung, Limit erreicht („Dein Kontingent für Fotos ist diesen Monat aufgebraucht, ab 1. November wieder verfügbar. Eintragen per Hand geht weiter.“), offline („Fotos brauchen Internet – trag es per Hand ein oder später“), Kamera verweigert, Auswertung läuft, Fehler.

**So testet ihr es am Handy:**

1. Erst mit Attrappe (kein Schlüssel nötig): Vorschau-Link → Testmodus → „Per Foto“ → Beispielantwort erscheint, änderbar, eintragen.
2. Dann mit echtem Schlüssel in der Vercel-Vorschau und freigeschaltetem Testkonto: Teller fotografieren, Info „halbe Portion“ → Vorschlag prüfen.
3. Limit testen: Konto mit Limit 2 → drittes Foto zeigt die Meldung.
4. Einwilligung widerrufen → Knopf „Per Foto“ fragt wieder.

### Umsetzungsstand E3 (16.10.2026)

**Gründer-Entscheidung 16.10.2026:** E3 als **Testversion ohne echte KI**. Die komplette Kette ist gebaut; der
Anbieter-Adapter nutzt standardmäßig eine **Attrappe** (feste, deterministische Beispielantworten inkl. bösartiger
Testfälle). Der echte Gemini-Adapter ist als Code vorbereitet und nur aktiv, wenn `FOOD_PHOTO_PROVIDER=gemini` **und**
`GEMINI_API_KEY` gesetzt sind. In Tests/CI gibt es keine echten Netzaufrufe (Ersatz-`fetch`, globales `fetch` im
Test gesperrt).

**Was jetzt gilt**

- **Ablauf:** Ernährung → „Eintragen“ → Kasten **„Per Foto“** (`ernaehrung/foto.tsx`) → beim ersten Mal eigene
  Einwilligung `ai_food_photo` (Text v1, A-G17) → „Noch 30 Fotos in diesem Monat · heute noch 8“ → optional kurze Info
  (≤ 120 Zeichen) → Foto (Browser: Kamera/Datei, auf dem Gerät auf 1.024 px verkleinert und als JPEG neu gezeichnet =
  ohne EXIF) bzw. im Testmodus „Beispielfoto verwenden“ → **Vorschlag** „Schätzung – bitte prüfen“: Bestandteile aus dem
  Katalog mit Menge, „unsicher“ unter 0,5, „Bitte auswählen“ mit Suche, Menge ändern, entfernen, hinzufügen (≤ 15) →
  **„Eintragen“** schreibt je Bestandteil einen Tagebuch-Eintrag mit Herkunft **`photo`** (alles oder nichts);
  **„Abbrechen“** speichert nichts.
- **Server** (`apps/web`, `POST /api/ernaehrung/foto`, `fra1`, Node): CORS nur eigene App (`APP_WEB_ORIGIN`,
  Produktionsadresse, Vorschauen nur mit `APP_PREVIEW_TEAM`), Login per Supabase-JWT (`/auth/v1/user`), Formular streng
  (`image` + optional `note`), dann `runFoodPhotoAnalysis` (packages/core): Info prüfen → Bild prüfen (Art am Inhalt,
  ≤ 4 MB, ≤ 1.024 px, EXIF/XMP/IPTC/Kommentare/Text-Chunks entfernt) → **Reservierung in der Datenbank**
  (`ai_food_photo_reserve`, nur service_role: Flag → Premium/Beta → Einwilligungen `ai_food_photo` UND `health_data`
  FOR SHARE → Advisory-Sperre → Tages-/Monatslimit Europe/Berlin → Zeile) → Anbieter (Attrappe bzw. Gemini, 20 s,
  ungültig → einmal neu) → **Abschluss** (`ai_food_photo_finish`: Token, Kosten, `succeeded`/`failed`; fehlgeschlagen
  zählt nicht) → Antwort nur mit geprüften Bestandteilen (Zod `foodPhotoResponseSchema`). Logs nur feste Codes.
- **Testmodus:** dieselbe Kette auf dem Gerät mit der Attrappe; Freischaltung immer an, Kontingent aus dem
  Gerätespeicher (nur Metadaten wie `ai_usage`).
- **Supabase-Modus:** Freischaltung über `ai_food_photo_access()`, Kontingent aus den eigenen `ai_usage`-Zeilen (RLS),
  Auswertung über die Route (braucht `EXPO_PUBLIC_WEB_URL`, sonst „noch nicht verfügbar“).
- **Zustände:** Laden, kein Premium (Erklärung + „Per Hand eintragen“), Funktion abgeschaltet, nicht eingerichtet,
  keine Gesundheits-Einwilligung, keine Foto-Einwilligung, Limit Tag/Monat („… ab 1. November wieder verfügbar.
  Eintragen per Hand geht weiter.“), offline („Fotos brauchen Internet …“), Auswertung läuft, kein Essen erkannt,
  Zeitlimit/Anbieter nicht erreichbar/unbrauchbare Antwort („zählt nicht gegen dein Kontingent“), Bild unlesbar, App
  ohne Fotoauswahl (Hinweis), gespeichert.
- **Datenschutz:** Foto **nie gespeichert** (A-G18) – **kein** Storage-Bucket `food-photos-tmp` und kein Aufräum-Job
  (der Plan sah ihn nur für die Dauer der Auswertung vor; die Verarbeitung im Arbeitsspeicher der Anfrage macht ihn
  überflüssig). `ai_usage` nur Funktion, Status, Modell, Token, Kosten, Zeitpunkte. Export: `ai_usage` und die eigene
  Beta-Freischaltung (ohne `granted_by`). Konto löschen: Kaskade; Protokoll `private.admin_actions` behält nur
  „Verweis leer“. Widerruf `ai_food_photo`: keine neuen Fotos; Tagebuch bleibt (gehört zu `health_data`), Widerruf
  `health_data` löscht auch Foto-Einträge.

**Core** (`packages/core/src/nutrition/food-photo.ts`, `food-photo-image.ts`, `food-photo-run.ts`, `constants.ts`
`AI_FOOD_PHOTO`): `sanitizeFoodNote`, `photoRequestSchema`, `buildFoodPhotoPrompt` (feste Anweisung, Info als
JSON-Zeichenkette zwischen Markierungen), `FOOD_PHOTO_RESPONSE_JSON_SCHEMA`, `photoResultSchema`/`parsePhotoResult`
(strikt, ≤ 15, 1–1.500 g, eigene kcal der KI → ungültig), `sanitizePhotoLabel` (≤ 60 Zeichen, ohne Markup/Links),
`matchPhotoFood`/`matchPhotoItems` (food_id nur, wenn im Katalog; Name/Suchbegriff; ganzes Wort; eindeutiger Anfang),
`changePhotoItem`, `addPhotoItem`, `photoEntries`, `photoItemKcal`, `photoLimitState` (Europe/Berlin, offene
Reservierung zählt, Versuchs-Deckel), `photoLimitsFor`, `aiFoodPhotoCostEur`, `mockFoodPhotoAnswer` (Fälle `beispiel`, `leer`, `viele`,
`unbekannt`, `menge0`, `boese`, `kcal`, `kaputt`, `zeitlimit` – Auswahl über „test:<fall>“ in der Info),
`checkPhotoImage` (JPEG/PNG/WebP), `runFoodPhotoAnalysis`, `createMockFoodPhotoProvider`, `foodPhotoResponseSchema`.
`FOOD_LOG_SOURCES` + `photo` (Form wie `food`, nur Gramm; als Vorlage/Favorit ein normaler Katalog-Eintrag;
`rebuildEntry` behält `photo`). `CONSENT_TYPES` + `ai_food_photo`, `CURRENT_CONSENT_VERSIONS.ai_food_photo = 1`.
`DATA_EXPORT_TABLES` + `ai_usage`, `beta_entitlements`.

**Migrationen** (rein additiv, ab 20261016160000):

- `20261016160000_ai_food_photo_enums.sql` – `consent_type` + `ai_food_photo` (eigene Datei vor der Verwendung).
- `20261016160100_ai_food_photo.sql` – Einwilligungstext v1, `private.has_valid_consent_for`, `private.feature_flags`
  (Flag `ai_food_photo` **aus**), `private.beta_entitlements`, `private.admin_actions`, `private.has_entitlement_for`
  (die eine Stelle für Premium, Phase 7 ersetzt nur den Rumpf), `public.has_entitlement`, `public.ai_usage` (RLS: eigene
  Zeilen lesen, kein Schreiben für Nutzer), `public.ai_food_photo_access`, `public.ai_food_photo_reserve`,
  `public.ai_food_photo_finish`, `public.beta_admin` (nur service_role, Antworten ohne Personenbezug, `status` mit
  Kostensummen). Aufbewahrung `ai_usage`: 400 Tage (beim Reservieren aufgeräumt).
- `20261016160200_food_log_photo.sql` – Herkunft `photo` (CHECK Herkunft + Form), `save_food_log_entries` neueste
  Fassung nur erweitert: `photo` wird wie `food` geprüft und **aus dem Katalog gerechnet**, gespeichert als `photo`.
- `20261016160300_ai_food_photo_export.sql` – `export_my_data()` neueste Fassung + `ai_usage`, `beta_entitlements`
  (über `private.my_beta_entitlements()`, nur die eigene Zeile).
- Workflow `.github/workflows/beta-grant.yml` (PLAN-PHASE-4B 6.3: Eingaben nur über `env:`, E-Mail erst geprüft, dann
  maskiert, `jq -n`, nur feste Felder in der Zusammenfassung).

**Präzisierungen** (vom Plan nicht festgelegt, vorsichtig entschieden):

1. **Bildgröße 4 MB statt 5 MB:** Vercel nimmt je Anfrage höchstens 4,5 MB an.
2. **Versuchs-Deckel 16 je Tag** (auch fehlgeschlagene): Fehlversuche zählen nicht gegen das Limit, dürfen aber nicht
   unbegrenzt Kosten erzeugen.
3. **„Kein Essen erkannt“ zählt** gegen das Kontingent (gültige, bezahlte Antwort). Gründer-Frage E3-G3.
4. **Gesundheits-Einwilligung zusätzlich Pflicht:** Das Ergebnis landet im Tagebuch (A-G12).
5. **Kostenübersicht** als `beta-grant` → `status` (Summen) statt Admin-Seite – der Admin-Bereich (Stufe A) zeigt
   bewusst keine Nutzerdaten (PLAN-PHASE-4B 6.3).
6. **App (iPhone/Android):** Fotoauswahl braucht `expo-image-picker` + `expo-image-manipulator` und einen neuen Build –
   in dieser Testversion nur im Browser; in der App im Testmodus „Beispielfoto verwenden“.
7. **Abgleich in der App:** Die Route liefert nur geprüfte Bestandteile; `matchPhotoItems` läuft im Core auf dem Gerät
   mit dem geladenen Katalog. Die Werte rechnet beim Speichern ohnehin der Server aus dem Katalog nach.
8. **Prompt:** `food_id` immer `null` (kein Katalog an Gemini – weniger Daten, weniger Token); die Zuordnung macht der
   Core über Namen.

**Tests**

- Core: `food-photo.test.ts` (Info 120/121, Emoji, Steuerzeichen/Links/Markup, 5 bösartige Infos bleiben in der
  Markierung, leere Antwort, 15/16 Bestandteile, Menge 0/1/1.500/1.501/NaN, KI-kcal, Freitext, Bezeichnung 60 Zeichen,
  Katalog-Abgleich inkl. mehrdeutig und SQL-/Pfad-`food_id`, Bearbeiten, Eintragen photo mit Katalog-Werten, voller
  Tag, Vorlage/Favorit/`rebuildEntry`, Limits: Monatswechsel Mitternacht Berlin (MEZ), 00:30 Berlin am 1. = neuer
  Monat, letztes Foto des Monats, Tageslimit, Fehlversuche, Reservierung ohne Abschluss zählt weiter, Jahreswechsel, Kosten, alle
  Attrappen-Fälle), `food-photo-image.test.ts` (Art, EXIF/GPS/Kommentar/Text-Chunks/XMP entfernt, RIFF-Größe,
  1.024/1.025 px, 4 MB, kaputte Dateien), `food-photo-run.test.ts`, `db-sync.test.ts` (Enum, Seed-Versionen, CHECK-
  Listen, Limits SQL = Core, `ai_usage`-Spalten nur Metadaten, kein Storage, Rechte, `save_food_log_entries` und
  `export_my_data` je Obermenge der Vorgänger-Fassung).
- Web: `handler.test.ts` (36 Tests: Attrappe Standard, Gemini nur mit Flag UND Schlüssel, CORS, Login, Eingaben vor der
  Reservierung, Flag/Premium/Einwilligung/Limit, Retry, Zeitlimit, Fehler zählen nicht, bösartige Antwort bereinigt,
  Logs ohne Info/Token/Nutzer-ID, Gemini-Anfrage nur Anweisung + Info + Bild, Schlüssel nur im Kopf).
- App: `food-photo.test.ts` (Testmodus-Kette, Metadaten, Limits, Widerruf, Export, Konto löschen, Supabase-Seite mit
  Ersatz-fetch), Einwilligungstexte = Migration.
- pgTAP `37_ai_food_photo.test.sql` (90 Tests; 34–36 belegt WP3) und Anpassungen in 01/17 (vier Einwilligungstexte,
  Export inkl. Beta-Freischaltung). Alle Dateien grün gegen Postgres 16 + pgTAP mit Supabase-Ersatz.
- Zwei Verbindungen (Harness): zwei gleichzeitige Reservierungen beim 8. Foto → genau eine; Widerruf während einer
  Reservierung wartet und wirkt danach.
- Playwright (Testmodus, Handy): `food-photo.spec.ts` – Einwilligung → echte Bilddatei → Vorschlag → zuordnen, Menge,
  entfernen → eintragen (3 × `photo`), Abbrechen speichert nichts, kein Essen; Tages- und Monatslimit; offline;
  Widerruf in den Einstellungen.

**Gegenproben** (gebrochen → rot → zurückgesetzt): Core – Markup nicht entfernt, KI-kcal erlaubt, 16 Bestandteile,
Fehlversuche zählen, Monat in UTC, `food_id` ungeprüft, Herkunft nicht `photo`, kein zweiter Versuch, EXIF nicht
entfernt, 121 Zeichen; Web – Gemini ohne Flag, Login übergangen, fremde Herkunft, Info im Log; App – Testmodus ohne
Einwilligungs-Prüfung, Antwort ohne Zod; pgTAP – ohne Flag-, Premium-, Gesundheits-Einwilligungs-Prüfung, `finish`
für Nutzer, RLS `using (true)`, Fehlversuche zählen, Monatsgrenze UTC, Tageslimit 9, zweiter Abschluss, E-Mail ohne
Prüfung, `photo` in Stück, `photo` mit Gerätewerten, Export ohne `ai_usage`, Export mit `granted_by`; Harness – ohne
Advisory-Sperre bekommen beide gleichzeitigen Anfragen eine Reservierung; Playwright – ohne Offline-Prüfung.

**Gründer-Fragen** (sichere Voreinstellung umgesetzt):

- **E3-G1 Fotoauswahl in der App:** `expo-image-picker` + `expo-image-manipulator` mit dem nächsten EAS-Build
  aufnehmen? Voreinstellung: **noch nicht** (Testversion nur im Browser).
- **E3-G2 Widerruf `ai_food_photo`:** `ai_usage`-Metadaten behalten (Kontingent, Kosten, keine Inhalte)?
  Voreinstellung: **behalten** (400 Tage, mit Konto gelöscht, im Export).
- **E3-G3 „Kein Essen erkannt“** zählt gegen das Kontingent? Voreinstellung: **ja** (gültige, bezahlte Antwort).
- **E3-G4 Versuchs-Deckel** 16 je Tag inkl. Fehlversuche? Voreinstellung: **ja**.
- **E3-G5 Bildgröße** 4 MB (Vercel-Grenze) statt 5 MB? Voreinstellung: **4 MB**.

**Nachtrag: Auflagen der Wächter-Prüfung E3 (`waechter-e3.md`, 16.10.2026) – umgesetzt**

- **M1 JPEG:** Metadaten-Marker (APP1–APP15, COM) werden auch zwischen den Scans entfernt; die Entropie-Daten (FF00,
  RST) bleiben, alles nach dem ERSTEN EOI wird abgeschnitten (angehängte zweite JPEGs, MPF, Gain-Maps samt EXIF/GPS).
  Ohne EOI = kaputt. **N3 WebP:** nur VP8/VP8L/VP8X/ALPH/ANIM/ANMF, ICCP und unbekannte Chunks weg (Merker EXIF/XMP/ICC
  gelöscht), Daten nach dem RIFF-Ende abgeschnitten, RIFF-Größe größer als die Datei = kaputt.
- **M2:** Die Route liest den Körper erst NACH Herkunft, Konfiguration, Bearer-Format, Content-Length-Grenze und
  `verifyUser` (`readForm` als Funktion an `handleFoodPhoto`). **N2:** Ohne Content-Length wird gestreamt mit hartem
  Byte-Limit gelesen und bei Überschreitung abgebrochen (`lib/food-photo/form.ts`).
- **M4 (fail closed):** Abschluss wird einmal wiederholt; scheitert er zweimal, bleibt die Reservierung offen und zählt
  weiter gegen Tages- und Monatslimit (die 5-Minuten-Regel entfällt in Core und SQL). Token (0–1.000.000) und Kosten
  (≤ 99 €) werden vor dem Abschluss begrenzt.
- **M3:** Einwilligungstext v1 beschreibt nur die Testversion („an keinen KI-Anbieter übermittelt … vor einer echten KI
  fragen wir dich erneut“) und sagt nichts mehr zu EU-Verarbeitung oder Training zu. `ai_food_photo_reserve(uid,
p_min_consent_version)`: Der Server verlangt mit dem echten Anbieter Fassung ≥ 2 (`AI_FOOD_PHOTO.
realProviderMinConsentVersion`), sonst `not_configured` – Gemini ist mit v1 nicht aktivierbar (SETUP L4).
- **N1:** CORS nur `fitnessapp-git-<branch>-<team>.vercel.app` und `fitnessapp-<9 Zeichen>-<team>.vercel.app`.
- **N4:** Export enthält `admin_actions` der Person (Aktion, Ablauf, Zeitpunkt – ohne `actor`) über
  `private.my_admin_actions()`; pgTAP 17 zählt die Tabelle mit.
- **N5:** beta-grant sendet beim Entziehen keine Tage mehr.
- **N6:** Limits je Person: `beta_entitlements.monthly_limit` (1–300) und `daily_limit` (1–50), gesetzt über beta-grant
  (`monatslimit`/`tageslimit`), sonst Standard; Versuchs-Deckel = 2 × Tageslimit (`photoLimitsFor`). Die App zeigt das
  eigene Kontingent (`ai_food_photo_access` liefert die Limits).
- **N7 (bewusst so, dokumentiert):** Die Herkunft `photo` kann ein angemeldetes Konto mit Gesundheits-Einwilligung auch
  ohne Premium/Reservierung speichern. Harmlos: Titel und Werte rechnet der Server aus dem Katalog; es ist ein normaler
  Katalog-Eintrag. Nur eine Statistik „Einträge per Foto“ wäre damit nicht verlässlich – vor einer solchen Auswertung
  eine Verknüpfung mit `ai_usage` einführen.
- **Gegenproben** (rot → zurückgesetzt): JPEG-Rest nach SOS ungeprüft (M1-Tests rot), Marker zwischen Scans behalten,
  WebP-Anhang behalten, Körper vor dem Login gelesen, Byte-Limit entfernt, Abschluss ohne Wiederholung, Reservierung
  zählt wieder nur 5 Minuten (Core und pgTAP), Token ungekürzt, Mindest-Fassung ignoriert (Web und pgTAP), CORS-Muster
  alt, Export ohne `admin_actions`, eigenes Limit ignoriert (pgTAP).

**Offen – was für den echten Gemini-Betrieb noch fehlt**

- **Einwilligungstext v2** (Pflicht, technisch erzwungen), AVV mit Google, juristische Prüfung, bezahlter Tarif;
  EU-Verarbeitung: Developer API sichert sie nicht zu – Vertex AI `europe-west3` oder ehrlich im Text v2 (Wächter M3).
- Preise in `AI_FOOD_PHOTO.pricesEurPerMTok` gegen die offizielle Preisseite prüfen (VOR LIVEGANG PRÜFEN).
- Test mit 30 echten Fotos gegen den Katalog (A-G19: Trefferquote, Kosten, ob `food_id`-Liste im Prompt nötig ist).
- `GEMINI_API_KEY` + `FOOD_PHOTO_PROVIDER=gemini` im Vercel-Projekt „Web“ (SETUP Teil L4) – jetzt nicht.
- Echte Premium-Prüfung mit Phase 7 (`private.has_entitlement_for` ersetzen), Fotoauswahl in der App (E3-G1),
  Live-Test mit Konto (Teil 8 der HANDY-ANLEITUNG).

---

## 10. Etappe E4 – Barcode und Open Food Facts (optional)

Entspricht X1 aus PLAN-PHASE-5 Abschnitt 13 und KONZEPT 6.1. Gratis, ohne KI.

- Barcode mit der Kamera (`expo-camera`; im Handy-Browser nur, wenn die Kamera-Schnittstelle verfügbar ist, sonst Nummer eintippen).
- Abruf über eine `apps/web`-Route mit Zwischenspeicher `food_products` (Name, Marke, Nährwerte je 100 g, Quelle, Abrufdatum). Quellenangabe „Daten von Open Food Facts (ODbL)“ in Produktansicht und Impressum/Lizenzen.
- Nicht gefunden → eigenes Produkt anlegen (nur für die Person sichtbar).
- Marken erscheinen **nur** bei selbst gescannten Produkten, nie in Vorschlägen (X0: nur Produktarten).
- Plausibilitätsprüfung der Fremddaten (z. B. Makros passen nicht zu kcal → Hinweis „Werte prüfen“).
- Neuer `source`-Wert `product` im Tagebuch.

Empfehlung: erst nach A3, wenn sich zeigt, dass Katalog + eigene Gerichte nicht reichen (Frage A-G16).

**Bau-Plan E4 (Entwurf 16.10.2026, wartet auf Freigabe):** [`docs/PLAN-E4.md`](PLAN-E4.md) – Recherche Open Food Facts
(API, 15 Abfragen/Minute je IP, User-Agent-Pflicht, ODbL/DbCL/CC BY-SA), Ablauf, Route `POST /api/ernaehrung/produkt`,
gemeinsamer Zwischenspeicher `food_products` ohne Personenbezug, eigene Produkte `user_food_products`, Herkunft
`product` mit Server-Nachrechnung, Plausibilitätsprüfung im Core, Kamera (E4b, neuer EAS-Build), Lizenz/Impressum,
Datenschutz, Migrationen ab `20261016200000`, pgTAP ab `39_`, Gründer-Fragen E4-G1 bis E4-G13. Etappen: **E4a**
Nummer + Zwischenspeicher + Tagebuch (ohne neuen Build), **E4b** Kamera.

---

## 11. Etappe A1c – Zusätzliche Einheit planen (optional, später)

Nur wenn ihr es wollt (A-G3). Regeln in 2.6. Neue Spalte `planned_sessions.is_extra` und Server-Funktion `add_extra_session` mit denselben Prüfungen wie der Core (Wochen-Ausdauerminuten, 48 h, Erholungswoche, Trainingstage). Abstimmung mit der Live-Anpassung (4b A: Änderungen ab morgen) nötig. Eigener Plan-Nachtrag vor dem Bau.

---

## 12. Definition of Done (je Etappe, CLAUDE.md)

1. Typen + Zod-Schemas.
2. Migration nur additiv, mit RLS und pgTAP (Workflow `db-test`).
3. Core-Logik in `packages/core` mit Tests inkl. Grenzfällen; neue Grenzwerte in `constants.ts` mit Quelle bzw. „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“.
4. UI mobil + Web-Export; Playwright im Testmodus (Drag-and-drop **und** „Verschieben …“-Menü).
5. Lade-, Leer-, Fehler- und Offline-Zustände.
6. Texte auf Deutsch in `i18n/de.ts`, Screenshots hell/dunkel.
7. Doku: dieser Plan (Umsetzungsstand), KONZEPT (neuer Abschnitt „Auswertung“), PLAN-PHASE-5 Abschnitt 13 (X1–X3 → Verweis auf E1–E4), KONZEPT 6.1/6.2/6.4, HANDY-ANLEITUNG.
8. Nur E3: Premium-Prüfung serverseitig, Limits, `ai_usage`, Feature-Flag, Prompt-Injection-Tests, Attrappe für Tests ohne Schlüssel, `.env.example`/SETUP.md.
9. Pull Request mit deutscher Zusammenfassung und „So testest du es am Handy“; Wächter-Prüfung.

---

## 13. Risiken

1. **Unvollständige Einträge** wirken wie „zu wenig“. _Gegenmittel:_ Tage ohne Eintrag grau, heute neutral, Satz „Laut deinen Einträgen – fehlt etwas?“.
2. **Druck durch Farben** (Essstörungen). _Gegenmittel:_ 2.3/2.4, Zahlen-aus ohne Balken, Muster-Hinweis, keine Serien.
3. **Tagesziel vergangener Tage ändert sich**, wenn Körperdaten korrigiert werden (Ziele werden nicht gespeichert). _Gegenmittel:_ bewusst so (Datenschutz); im Text „nach deinen aktuellen Angaben“.
4. **Drag-and-drop im Handy-Browser** kollidiert mit Scrollen. _Gegenmittel:_ Aufnehmen nur per langem Druck; Menü als gleichwertiger Weg.
5. **Ernährung im Supabase-Modus** fehlt noch (N7 Teil 2). _Gegenmittel:_ A2/A3 zuerst im Testmodus, Essen-Teil im Supabase-Modus erst nach N7 Teil 2; der Trainingsteil geht sofort.
6. **Zusammenspiel mit 4b** (Live-Anpassung ändert künftige Einheiten). _Gegenmittel:_ A1a ändert nur Datum; A1c erst nach 4b A.
7. **KI-Schätzung falsch** (Portionen, versteckte Fette). _Gegenmittel:_ nur Vorschlag, Werte aus dem Katalog, Hinweis „Schätzung“, Bearbeiten Pflicht-Schritt vor dem Eintragen.
8. **Prompt-Injection über Info-Text oder Text im Bild.** _Gegenmittel:_ keine Werkzeuge, nur Schema-Antwort, Core prüft alles, Freitext der KI wird nie angezeigt (E3).
9. **Datenschutz Foto** (Gesichter, Wohnung, Standort im Bild). _Gegenmittel:_ EXIF entfernen, sofort löschen, eigene Einwilligung, nur Foto + Info an Google, AVV.
10. **Kosten laufen davon.** _Gegenmittel:_ Monats- und Tageslimit vor dem Aufruf, `ai_usage`, Kostenübersicht, Feature-Flag zum sofortigen Abschalten.
11. **Tagebuch wird zur Last** (Essstörungen). _Gegenmittel:_ keine Pflicht, keine Erinnerungen ans Eintragen in E1, keine Serien, „Zahlen aus“ gilt überall.

---

## 14. Entscheidungen für die Gründer

**Entschieden (Gründer, 15.10.2026): alle Punkte A-G1 bis A-G20 wie empfohlen.** Fachliche Prüfungen (A-G5, A-G11), juristische Prüfung des Einwilligungstexts und AVV mit Google (A-G17) bleiben vor dem Livegang offen.

- **A-G1 Reihenfolge:** A1a → A1b → E1 → A2 → E2 → A3 → E3, optional E4 und A1c? _Empfehlung:_ **Ja.** Der Kalender bringt sofort Nutzen (auch im Supabase-Modus); E1 ist Pflicht vor dem Kalorienbalken.
- **A-G2 Umfang E1:** Plan-Mahlzeit per Tipp, Katalog, Rezept, Schnelleintrag, Zuletzt/Favoriten – Barcode erst als E4? _Empfehlung:_ **Ja.** Der Katalog mit Nährwerten ist schon da; Barcode bringt Fremddaten und Kamera-Aufwand.
- **A-G3 Zusätzliche Einheiten in der Zukunft (A1c):** jetzt oder später? _Empfehlung:_ **später** (nach 4b A). Jetzt: freie Einheit für heute und Nachtragen.
- **A-G4 Tauschen per Drag-and-drop** (auf belegten Tag ziehen = beide tauschen)? _Empfehlung:_ **Ja**, mit denselben Regeln für beide Einheiten.
- **A-G5 Farbgrenzen:** wie 2.1 (grün = Planband, rot unten = unter Mindestbedarf, rot oben = über max(Obergrenze, Ziel × 1,2))? _Empfehlung:_ **Ja**, vor dem Livegang von der Ernährungsfachkraft prüfen lassen.
- **A-G6 Heute neutral statt rot** bis zum Zielbereich? _Empfehlung:_ **Ja.**
- **A-G7 Freie Einheiten erhöhen das Tagesziel** (Trainingsenergie), zählen aber nicht für Progression und 10 %-Regel? _Empfehlung:_ **Ja.**
- **A-G8 „Kalorienzahlen aus“:** kein Balken, nur „3 von 4 Mahlzeiten“, keine Farben fürs Essen? _Empfehlung:_ **Ja.** Gilt genauso für Schwangerschaft/Stillzeit.
- **A-G9 Gratis oder Premium:** Kalender, Nachtragen, Tagebuch (E1), eigene Gerichte (E2), Barcode (E4), Tages- und Wochenauswertung **gratis**; nur Foto-KI (E3) **Premium**? _Empfehlung:_ **Ja** (KONZEPT 6.1/6.2 gratis, CLAUDE.md „Gratis ohne KI“). „Gegessen“ per Tipp aus dem eigenen Essensplan ist gratis; Premium bleibt die automatische Belegung rund ums Training (X4).
- **A-G10 Wochenstart:** Montag? _Empfehlung:_ **Ja** (wie die ganze App, ISO-Woche).
- **A-G11 „Trainingsziel erreicht“** ab 90 %, Stufen 60/90 %? _Empfehlung:_ **Ja**, fachlich vor dem Livegang prüfen.
- **A-G12 Ernährungstagebuch nur mit Gesundheits-Einwilligung** (vorsorglich Art. 9, offener Teil von X0; „nur Produktarten“ aus X0 ist schon entschieden)? _Empfehlung:_ **Ja.**
- **A-G13 Muster-Hinweis** bei ≥ 3 Tagen unter dem Mindestbedarf pro Woche? _Empfehlung:_ **Ja**, einmal pro Woche, mit Hilfe-Kontakten.
- **A-G14 Favoriten und eigene Gerichte beim Widerruf** der Gesundheits-Einwilligung behalten (Tagebuch-Einträge werden gelöscht)? _Empfehlung:_ **Ja** – sie sagen nichts über Körper oder Gesundheit; Löschen jederzeit selbst möglich. **Geändert – entschieden 15.10.2026 (E2-G1): eigene Gerichte werden beim Widerruf gelöscht** (Name = Freitext); Schnell-Favoriten ebenso (E1 G1); Favoriten aus Lebensmitteln und Rezepten bleiben.
- **A-G15 Foto-Limit:** _Empfehlung:_ **30 Fotos pro Monat, höchstens 8 pro Tag**, als Konstante änderbar. Bei geschätzt unter 0,5 Cent je Foto kostet das höchstens ~15 Cent pro Person und Monat (Preise vor dem Bau prüfen).
- **A-G16 Barcode (E4):** jetzt einplanen oder erst nach A3 entscheiden? _Empfehlung:_ **erst nach A3 entscheiden.**
- **A-G17 Einwilligungstext Foto-KI:** eigene Einwilligung „Gerichte per Foto auswerten“ mit: was gesendet wird (nur Foto ohne Standort + deine kurze Info), an wen (Google, Gemini-API, Auftragsverarbeitung, EU-Verarbeitung soweit verfügbar, keine Nutzung zum KI-Training), wie lange (Foto sofort nach der Auswertung gelöscht), Schätzung ohne Gewähr, Widerruf jederzeit. _Empfehlung:_ **so**, Text vor dem Livegang juristisch prüfen; AVV mit Google abschließen (Gründer-Aufgabe).
- **A-G18 Fotos speichern** (z. B. als Erinnerung)? _Empfehlung:_ **Nein** in E3 – nur „sofort löschen“. Weniger Risiko, kein Speicherplatz.
- **A-G19 Gemini-Modell:** kleines, günstiges Modell mit Bildeingabe (Flash-Klasse), austauschbar über Konfiguration? _Empfehlung:_ **Ja**; vor dem Livegang mit 30 Testfotos gegen den Katalog prüfen (Trefferquote, Kosten).
- **A-G20 Foto-KI vor Phase 7** (ohne Abos) testen? _Empfehlung:_ **Ja, nur für freigeschaltete Testkonten** (Feature-Flag + `beta-grant`), echte Premium-Prüfung mit Phase 7.

---

## Umsetzungsstand E1 – Ernährungstagebuch (15.10.2026)

**Umgesetzt** nach Abschnitt 5 (dazu 1.4, 1.5, 2.3, 2.4, 2.7, 12, 13; A-G2, A-G9, A-G12, A-G14 wie empfohlen). Gratis, ohne KI. **Testmodus vollständig; Supabase-Modus: Datenbank fertig und getestet, die App schaltet sie mit N7 Teil 2 frei** (bis dahin `supportsNutrition = false`, `supabase-backend.ts` speichert nie still ins Leere).

**Was jetzt gilt**

- **Wege zum Eintragen:** „Gegessen“ an jeder Mahlzeit des Essensplans (ein Tipp = 1 Portion, danach ½ · ¾ · 1 · 1¼ · 1½ · 2 wählbar, „Nicht gegessen“ entfernt den Eintrag), Bildschirm **„Eintragen“** (`ernaehrung/eintragen.tsx`) mit Reitern **Zuletzt · Favoriten · Suche · Schnell**, Tag (heute bis 14 Tage zurück) und Mahlzeit (Frühstück, Mittag, Abend, Snack). Suche über Lebensmittel (Name und Suchbegriffe, Menge in g, ml oder Stück) und Rezepte (Portionen); ohne Treffer „Schnelleintrag stattdessen“. Zusätzlich „Eintragen“ in der Rezeptansicht (nicht bei Plan-Mahlzeiten – die haben „Gegessen“).
- **Tagesverlauf** (`ernaehrung/index.tsx`): Abschnitt „Gegessen“ mit Summe („3 Einträge · 1.240 kcal“, Makros, „Ein Eintrag ohne Kalorienangabe“, „Laut deinen Einträgen – Schätzwerte“), Einträge gruppiert nach Frühstück, Hauptmahlzeit, Mittag, Abend, Snack, je Eintrag Ändern, Löschen (mit Rückfrage) und „Als Favorit merken“. Karte „Essen heute“ auf „Heute“: „Gegessen heute: 3 Einträge“ (kcal nur mit Zahlen) und „Essen eintragen“.
- **„Kalorienzahlen aus“ / Schwangerschaft:** Eintragen geht weiter; nirgends kcal, kein kcal-Feld im Schnelleintrag (Eintrag zählt dann nur als „gegessen“), Summe nur als Anzahl (`dayIntakeView` liefert dann einen Typ ohne Zahlen). Keine Farben, keine Bewertung (die kommen mit A2).
- **Zustände:** Laden, Ladefehler mit „Erneut versuchen“ (`NutritionGate`), noch nichts eingetragen, keine Einwilligung (Erklärung + „Einwilligung erteilen“), kein Essensplan (Eintragen geht trotzdem), Suche ohne Treffer, künftiger Tag („Eintragen geht ab dem Tag selbst“), älter als 14 Tage (Grund steht da; Löschen geht), Server/Regeln lehnen ab (Text ohne Werte), Plausibilitäts-Rückfrage ab 1.500 kcal („Stimmt die Menge?“, keine Sperre).
- **Offline:** Im Testmodus liegt alles im Gerätespeicher – Eintragen, Ändern, Löschen gehen ohne Netz und überstehen Neuladen.
- **Datenschutz:** nur mit gültiger Einwilligung `health_data` (A-G12); Widerruf löscht alle Einträge und die Schnell-Favoriten, Favoriten aus Lebensmitteln und Rezepten bleiben (A-G14, enger gefasst nach Wächter G1), der Widerrufs-Dialog sagt es vorher; Export und Konto löschen inklusive; keine Werte in Fehlermeldungen oder Logs.

**Core** (`packages/core/src/nutrition/food-log.ts`, `constants.ts`): `FOOD_LOG_LIMITS`, `FOOD_LOG_PORTION_CHOICES`, `FOOD_LOG_DEFAULT_SLOT_MINUTES`; `foodLogEntrySchema`, `foodLogPayloadEntrySchema`/`foodLogPayloadSchema`, `foodLogFavoriteSchema` (Zod, strikt); `entryFromPlanItem`, `entryFromFood`, `entryFromRecipe`, `quickEntry`, `entryFromTemplate`, `rescaleEntry`, `moveEntry`, `markPlanItemEaten`, `dayIntake`, `dayIntakeView`, `foodLogDay`, `recentEntries`, `favoriteFromEntry`, `upsertFavorite`, `orderFavorites`, `searchFoodLogCatalog`, `foodLogDateStatus`, `needsFoodLogConfirmation`, `canAddFoodLogEntries`, `foodLogGroup`, `defaultFoodLogSlot`.

**Migrationen** (rein additiv, Zeitstempel nach `20261015120000_swap_planned_sessions.sql` aus A1a):

- `20261015130000_food_log.sql` – `food_log_entries` (CHECKs je Herkunft, Index „Plan-Mahlzeit je Tag und Platz einmal“, RLS nur lesen), `food_log_favorites` (RLS: eigene Zeilen, Einfügen nur mit Profil, Schnell-Favoriten nur mit Einwilligung `health_data`, CHECK Schlüssel = Inhalt, Katalog/Rezept ohne Werte, Titel per Trigger aus dem Katalog, höchstens 100 per Trigger).
- `20261015130100_food_log_rpcs.sql` – `save_food_log_entries(p_entries)` (Ergebnis je Eintrag) und `delete_food_log_entry(p_id, p_base_revision)` (security definer, `search_path = ''`, REVOKE public/anon), `private.consents_after_revoke()` (löscht Tagebuch-Einträge am Anfang und am Ende sowie die Schnell-Favoriten), `export_my_data()` (+ `food_log_entries`, `food_log_favorites`).

**Präzisierungen** (vom Plan nicht festgelegt, vorsichtig entschieden):

1. **Plätze und Gruppen:** `slot` = Plätze des Essensplans + `other`. Anzeige in fünf Gruppen (Frühstück, Hauptmahlzeit, Mittag, Abend, Snack = Zwischenmahlzeiten, Ergänzungen und `other`). „Vor/nach dem Training“ steht weiter an der Plan-Mahlzeit (Rolle), nicht als eigene Gruppe. Frei eintragen: Frühstück/Mittag/Abend/Snack, vorbelegt nach Uhrzeit.
2. **Schnelleintrag:** feste Bezeichnungen „Snack“, „Auswärts gegessen“, „Getränk“, „Süßes“, „Mahlzeit“, „Sonstiges“ (`QUICK_ENTRY_LABELS`, CHECK in der Datenbank) – kein Freitext (2.7).
3. **Zahlenformat:** kcal ganzzahlig, Makros 0–750 g mit einer Nachkommastelle, Menge g/ml 1–2.000 (eine Nachkommastelle), Stück 0,5–20 in ½-Schritten und umgerechnet höchstens 2.000 g, Portion 0,25–3 in Viertel-Schritten. Der Server rundet nie still (zu viele Nachkommastellen → abgelehnt).
4. **Datumsfenster:** Gerät heute bis 14 Tage zurück, nie Zukunft; Server mit 1 Tag Zeitzonen-Toleranz (wie Training). Einträge älter als 14 Tage sind nicht mehr änderbar, Löschen geht immer – auch ohne Einwilligung (Recht auf Löschung).
5. **Server-Prüfung:** Lebensmittel bzw. Rezept müssen im Katalog stehen (freigegeben oder archiviert); den **Titel setzt der Server aus dem Katalog**, nie vom Gerät. Die Nährwerte sind der Schnappschuss des Geräts (Core rechnet); der Server prüft Form und Grenzen, rechnet aber nicht nach (wie `save_meal_plan`). **Seit E2 (Entscheidung G4, 15.10.2026): Der Server rechnet Lebensmittel, Rezept und eigenes Gericht selbst nach** (Umsetzungsstand E2, Nachtrag). Im Testmodus entfällt der Katalog-Abgleich (Core baut die Einträge immer aus dem Bestand).
6. **Plan-Mahlzeit:** höchstens ein Eintrag je Tag und Platz (ein zweites Gerät bekommt `conflict`/`plan_item_exists` mit der vorhandenen id); die Portion ist ein Faktor auf den geplanten Schnappschuss; Tag und Platz nicht änderbar. Plan-Mahlzeiten erscheinen nicht unter „Zuletzt“ und haben keinen Stern (sie sind im Plan einen Tipp entfernt).
7. **Favoriten-Schlüssel:** `food|id`, `recipe|id`, `quick|Bezeichnung|kcal` – gleicher Schlüssel ersetzt (zuletzt gewählte Menge). Reihenfolge: zuletzt gegessen zuerst, sonst alphabetisch. Favoriten aus Katalog/Rezept speichern nur Verweis und Menge bzw. Portion (keine Werte, Titel aus dem Katalog); beim Eintragen rechnet der Core neu aus dem Bestand (`entryFromFavorite`) – fehlt der Inhalt im Bestand, ist der Favorit nicht eintragbar.
8. **Suche ohne Profil-Filter:** Das Tagebuch hält fest, was gegessen wurde, und empfiehlt nichts – deshalb alle Lebensmittel und Rezepte des Bestands.
9. **Bearbeiten:** Menge bzw. Portion werden verhältnisgleich aus dem Schnappschuss neu gerechnet, die Einheit bleibt. Bei Stück/ml gilt wie beim Neu-Eintragen „umgerechnet höchstens 2.000 g“; dafür braucht es das Lebensmittel im Bestand – fehlt es (archiviert), lässt sich die Menge in Stück/ml nicht mehr ändern (vorsichtig, Wächter H6), Portion/Gramm/Löschen gehen weiter.
10. **Grenzen je Speichervorgang:** höchstens 40 Einträge und 32 KB je Aufruf (sonst ganzer Aufruf abgelehnt); das Tageslimit (40 je Tag) zählt nach dem Schreiben unter einer Advisory-Sperre je Person – ein voller Tag lehnt nur diesen Eintrag ab (`day_full`).
11. **Sperr-Reihenfolge** (Wächter N7 S2): Einwilligung FOR SHARE → Advisory-Sperre der Person → Eintrags-Zeilen; der Widerruf sperrt die Einwilligung zuerst (FOR UPDATE) und löscht danach. `delete_food_log_entry` sperrt nur die Zeile.
12. **Blättern im Tagesverlauf** bleibt innerhalb der Woche des Essensplans; ältere Tage (bis 14 zurück) trägt man über „Eintragen“ mit „← Früher“ nach.
13. **Neue Fehlercodes** in der App: `food_log_out_of_range`, `food_log_day_full`, `food_log_rejected`, `favorite_limit` (Texte ohne Werte).
14. **Einwilligungstext** `health_data` wurde **nicht** hochgezählt (2.7: „nächste Textfassung“). Im Testmodus werden keine echten Daten verarbeitet; vor der Freischaltung im Supabase-Modus (N7 Teil 2) muss die neue Fassung mit „Ernährungstagebuch (was du als gegessen einträgst)“ kommen (offener Punkt).

**Tests**

- Core: `food-log.test.ts` (61 Tests: Grenzen, jede Portion, 0/3.000/3.001 kcal, 14/15 Tage, Zukunft, Stück ohne Gewicht, ml ohne Umrechnung, 17 Stück > 2.000 g, Wasser 0 kcal, Plan ersetzt nach dem Abhaken, doppelt abgehakt, archiviertes Lebensmittel, 40 je Tag, Zuletzt 20/0, Favoriten 100, Suche, „Zahlen aus“ ohne kcal im Ergebnis); `db-sync.test.ts` (CHECK-Listen, Feldliste = Zod, Grenzen, Sperr-Reihenfolge, keine Record-Variablen, Widerruf, Export).
- App: `food-log.test.ts` (Testmodus: Einwilligung, Fenster, Tageslimit, Plan-Mahlzeit, Freitext, alte Einträge, neu laden, Favoriten, Widerruf, Export, ungültiger Gerätespeicher), `food-log-format.test.ts`, `row-types.test.ts`.
- pgTAP `30_food_log.test.sql` (67 Tests): Rechte, security definer, Sperr-Reihenfolge, Login/Profil/Einwilligung, Idempotenz, revision-Konflikte, Titel aus dem Katalog, Ablehnungen ohne Werte, Fenster 14/15/±1, alte Einträge, 40/41 je Tag, Isolation (fremde id → neue id), Löschen, Favoriten (Schlüssel, fremde Person, ohne Profil, 100), Widerruf (Einträge weg, Favoriten bleiben), Export, Kaskade. Lokal gegen Postgres 16 + pgTAP mit Supabase-Ersatz (alle 27 Dateien grün).
- Zwei Verbindungen (lokales Harness): Speichern hält die Einwilligung, Widerruf wartet und löscht danach (0 Einträge); Widerruf zuerst → Speichern abgelehnt.
- Playwright (Testmodus, Handy-Ansicht): `nutrition-food-log.spec.ts` – „Gegessen“ + ¾, Suche Banane 1 Stück unter Snack, Schnelleintrag 700 kcal mit Stern, Rückfrage 1.600 kcal, neu laden, Ändern, Löschen, Karte „Heute“; Nachtragen 14 Tage (nicht 15), „Zahlen aus“, Widerruf.

**Gegenproben** (gebrochen → rot → zurückgesetzt): Core – Gramm-Obergrenze entfernt, kcal trotz „Zahlen aus“, 15 Tage erlaubt, Plan-Mahlzeiten in „Zuletzt“; db-sync – Fenster SQL ≠ Core, Schnelleintrag-Liste geändert; App – Widerruf löscht Tagebuch nicht, Einwilligungs-Prüfung entfernt, fremde Einträge im Gerätespeicher; pgTAP – FOR SHARE entfernt, Einwilligungs-Prüfung entfernt, erstes bzw. zweites Löschen im Widerruf entfernt, alte Einträge änderbar, Titel vom Gerät, Plan-Mahlzeit-Index entfernt, Tageslimit 41, fremde id nicht neu vergeben, RLS `using (true)`, Fehler mit Zeileninhalt; Harness – ohne FOR SHARE überlebt ein gleichzeitig gespeicherter Eintrag den Widerruf (1 statt 0).

**Nachtrag: Auflagen der Wächter-Prüfung E1 (`waechter-e1.md`, 15.10.2026) – umgesetzt**

- **S1 Favoriten ohne Freitext:** Trigger `food_log_favorites_before_write` (security definer, `search_path=''`) setzt bei Katalog/Rezept den Titel aus dem Katalog (auch beim Ändern); CHECK: Katalog-/Rezept-Favoriten ohne kcal/Makros; Schnell-Favoriten nur mit fester Bezeichnung. Probe „Freitext: Essanfall nach Streit“ → Titel „Porridge“; Katalog-Favorit mit kcal → abgelehnt.
- **G1 (sichere Voreinstellung):** Widerruf löscht die Schnell-Favoriten (Bezeichnung + kcal), Katalog-/Rezept-Favoriten bleiben; Schnell-Favoriten nur mit Einwilligung (RLS-Policy, Testmodus gleich). Dialogtext: „… und dein Ernährungstagebuch samt Schnelleintrag-Favoriten (Favoriten aus Lebensmitteln und Rezepten bleiben)“. **Gründer-Frage G1:** so lassen (empfohlen), oder auch Katalog-/Rezept-Favoriten beim Widerruf löschen?
- **S2 Ergebnis je Eintrag:** `save_food_log_entries` arbeitet jeden Eintrag in einem eigenen Teilschritt ab und antwortet je Eintrag mit `saved` · `conflict` (`revision` | `plan_item_exists` mit vorhandener id | `deleted` mit id null) · `rejected` (`invalid` | `out_of_range` | `day_full`); gültige Einträge im selben Aufruf werden gespeichert. Ganzer Aufruf abgelehnt nur bei fehlendem Login/Profil/Einwilligung oder ungültiger Liste. Zod `foodLogSaveResultSchema`/`foodLogSaveResponseSchema` in packages/core (H1: id null nur bei `deleted`). Testmodus gleich (`checkFoodLogSave` liefert Ergebnisse je Eintrag; gültige werden gespeichert, danach Fehlermeldung ohne Werte).
- **S3 + G2:** keine kcal-Zahl in Fehlertexten (`too_much` → „Diese Menge ist ungewöhnlich groß – bitte prüfen.“); Rückfrage ab 1.500 kcal neutral „Bitte kurz prüfen – Stimmen Menge und Einheit: 750 g?“ (mit Zahlen zusätzlich kcal, ohne Zahlen nie); testIDs der Listen nur mit Position (kein Schlüssel mit kcal im DOM). Playwright prüft bei „Zahlen aus“: kein „kcal“ im ganzen DOM (inkl. data-testid).
- **Hinweise:** H5 Tagesansicht nutzt den angezeigten Tag; H6 `rescaleEntry` prüft 2.000 g auch für Stück/ml; H1 siehe S2.
- **Gegenproben (rot → zurückgesetzt):** Trigger-Titel entfernt, Katalog-Favorit mit kcal erlaubt, Schnell-Favorit ohne Einwilligung, Widerruf ohne Löschen der Schnell-Favoriten (pgTAP und Testmodus), kein Teilschritt je Eintrag, Plan-Duplikat nicht als Konflikt, „deleted“ als „revision“, Testmodus bricht ganzen Vorgang ab, Fehlertext mit kcal, Rückfrage mit kcal trotz „Zahlen aus“, Stück-Grenze beim Ändern, Core-Favorit mit kcal.
- **Nachprüfung (`waechter-e1-nachpruefung.md`) – umgesetzt:**
  - **S1:** Der Favoriten-Trigger `food_log_favorites_before_write` (security definer, `search_path=''`) sperrt bei Schnell-Favoriten (neu oder Wechsel zu quick) zuerst die aktiven `health_data`-Einwilligungen FOR SHARE und prüft dann `has_valid_consent` (gleiche Reihenfolge wie `save_food_log_entries`); sonst „Einwilligung Gesundheitsdaten fehlt.“ ohne Werte. Die RLS-Policy prüft zusätzlich. Harness: Favorit ohne Commit → Widerruf wartet → 0 Schnell-Favoriten; Widerruf zuerst → abgelehnt; Gegenprobe ohne FOR SHARE → 1 Schnell-Favorit bleibt.
  - **H1:** Derselbe Trigger prüft alle CHECK-Bedingungen (auch NOT NULL) vorab und bricht mit „Ungültiger Favorit.“ ohne Werte und ohne DETAIL ab; die CHECKs bleiben als zweite Linie. pgTAP prüft Meldung und DETAIL.
  - **H2:** Nach einem Teilerfolg im Testmodus lädt die App den gespeicherten Stand neu, bevor sie den Fehler meldet.
  - Offen bleibt H3 (App im Supabase-Modus, Warteschlange) mit N7 Teil 2.
- **Gründer-Frage G3 (für N7 Teil 2):** Abgelehnte Einträge aus der Warteschlange – sichere Voreinstellung: **lokal behalten mit Hinweis** („1 Eintrag konnte nicht gespeichert werden“), nie still verwerfen.
- **Gründer-Frage G4 (vor A2):** Soll der Server die Nährwerte für Katalog/Rezept/Plan-Mahlzeit selbst nachrechnen? Sichere Voreinstellung: **bis A2 rechnet der Server nicht nach** (wie `save_meal_plan`); vor Bewertungshinweisen in A2 neu entscheiden (Empfehlung des Wächters: nachrechnen). **Entschieden 15.10.2026: Server rechnet nach** – umgesetzt mit E2 für Lebensmittel, Rezept und eigenes Gericht (`save_food_log_entries`, siehe Umsetzungsstand E2, Nachtrag); Plan-Mahlzeiten behalten den Schnappschuss des Essensplans.
- Bekannt (Wächter H4, bestehendes Muster): Konto löschen gleichzeitig mit Speichern kann einen Deadlock-Abbruch auslösen – kein Datenleck, nur Wiederholen.

**Offen**

- N7 Teil 2: App im Supabase-Modus (Laden der Einträge/Favoriten, eigene verschlüsselte Warteschlange für Gesundheitsdaten, im Browser nur sessionStorage mit Hinweis).
- Neue Fassung des Einwilligungstexts `health_data` (Präzisierung 14) – vor N7 Teil 2, juristisch prüfen.
- Ist die Woche nicht berechenbar (Angaben unvollständig, Unverträglichkeit ohne gültige Einwilligung), zeigt der Tagesverlauf weiterhin nur den bestehenden Hinweis – das Tagebuch erscheint dann erst nach dem Beheben (bewusst nicht umgebaut).
- E2 (eigene Gerichte) und A2 (Tagesauswertung mit Kalorienbalken) bauen hierauf auf.
