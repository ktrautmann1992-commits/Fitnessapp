# Plan „Kalender, Tages- und Wochenauswertung“ (Gründer-Wünsche 15.10.2026)

**Status:** Entwurf zur Freigabe – noch kein Code. Erst nach eurer Freigabe (Abschnitt 14) und einer Wächter-Prüfung geht es los.

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
- **Ernährung läuft heute nur im Testmodus.** Der Supabase-Modus für Ernährung kommt mit N7 Teil 2 (wartet auf Freigabe).

### 1.6 Technik für Drag-and-drop

- `react-native-gesture-handler` 2.32 und `react-native-reanimated` 4.5 sind schon installiert. Beide laufen nativ und im Web-Export.
- `expo-haptics` ist da (kurzes Vibrieren beim Aufnehmen).
- Barrierefreiheit: `accessibilityActions` werden schon genutzt (`components/workout.tsx`).

---

## 2. Fachliche Festlegungen (Vorschläge)

### 2.1 Farbbänder des Kalorienbalkens – VOR LIVEGANG FACHLICH PRÜFEN

Bezeichnungen je Tag: **Z** = Tagesziel, **U** = Untergrenze (`floorKcal`), **O** = Obergrenze (`ceilingKcal`), **B** = Planband `[B_min; B_max]`. Alle Werte kommen aus `nutritionTargetsForWeek()` – keine eigene Rechnung.

| Zone | Bedingung (gegessen = G) | Farbe | Text (Entwurf) |
| --- | --- | --- | --- |
| unter Mindestbedarf | G < U | rot | „Unter deinem Mindestbedarf“ |
| ausreichend | U ≤ G < B_min | gelb | „Etwas unter deinem Ziel“ |
| im Zielbereich | B_min ≤ G ≤ B_max | grün | „Im Zielbereich“ |
| etwas darüber | B_max < G ≤ R | gelb | „Etwas über deinem Ziel“ |
| deutlich darüber | G > R | rot | „Deutlich über deinem Ziel“ |

mit **R = max(O; Z × 1,20)**.

**Begründung:**

- **Grün = Planband (Ziel ± 10 %, aber nie unter U).** Das Band ist schon die fachlich geprüfte Toleranz des Essensplans. Ein Tag nach Plan ist also grün.
- **Unter U ist immer rot.** Die Untergrenze ist die Schutzgrenze (Grundumsatz, 25 %-Deckel, 1 %/Woche, Energieverfügbarkeit). Ein Tag darunter darf nie „ausreichend“ heißen. Liegt U schon bei 90 % von Z, gibt es keine untere gelbe Zone.
- **Gelb unten = sicher, aber unter Ziel.** Das ist „ausreichend“ im Sinne eurer Vorgabe.
- **Rot oben erst ab der Obergrenze O** (bei Abnehmen etwa Tagesbedarf + 10 %). Ein Tag auf Erhaltungsniveau ist beim Abnehmen damit **gelb, nicht rot**. Das schützt vor Schuldgefühlen und passt zur Planlogik: Rot heißt „mehr, als wir je planen würden“.
- **Z × 1,20** sorgt bei Muskelaufbau (O liegt dort nah am Ziel) für eine sichtbare gelbe Zone.

**Beispiel Abnehmen (Ruhetag):** Z = 1.800, U = 1.725, O = 2.530 → rot < 1.725, gelb 1.725–1.799, grün 1.800–1.980 (hier ist B_min = Z, weil U über 90 % liegt), gelb 1.981–2.530, rot > 2.530.

**Beispiel Erhalt:** Z = 2.400, U = 1.800 → rot < 1.800, gelb 1.800–2.159, grün 2.160–2.640, gelb bis 2.880, rot darüber.

Die Grenzen landen als Konstante `INTAKE_ZONES` (Faktor 1,20, Quelle/Markierung „PRODUKTENTSCHEIDUNG – VOR LIVEGANG FACHLICH PRÜFEN“) in `packages/core/src/constants.ts`.

### 2.2 Heute anders als vergangene Tage

Am Morgen ist jeder Balken „unter dem Ziel“. Ein roter Balken um 8 Uhr wäre falsch und erzeugt Druck.

- **Heute:** Unter B_min füllt sich der Balken in **neutraler Farbe** (Markenfarbe) mit dem Text „Noch offen“. Ab B_min grün, darüber gelb/rot wie oben.
- **Vergangene Tage:** volle Farbskala.
- **Tage ohne Eintrag:** grau, „Nichts eingetragen“ – **nie** als 0 kcal und nie rot.
- **Künftige Tage:** nur Tagesziel und Plan, kein Balken.
- Rot unten an einem vergangenen Tag immer mit dem Satz: „Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.“

### 2.3 „Kalorienzahlen aus“, Schwangerschaft/Stillzeit, keine Ziele

| Fall | Was die Tagesauswertung zeigt |
| --- | --- |
| „Kalorienzahlen anzeigen“ aus | **Kein Kalorienbalken, keine Farben fürs Essen.** Nur eine neutrale Liste „Mahlzeiten heute: 3 von 4 abgehakt“ und der Trainingsteil. |
| Schwangerschaft/Stillzeit (`no_targets`, `showNumbers = false`) | wie „Zahlen aus“ + bestehender Hinweis (Ärztin/Arzt/Hebamme). Keine Zahl, keine Farbe. |
| Keine Körperdaten oder keine Einwilligung | Kein Ziel → kein Balken. Ohne Einwilligung auch kein Tagebuch (2.7). Einladung „Mit Größe und Gewicht …“ wie bisher. |
| Plan-Tag `below_floor` | Balken normal. Der bestehende Hinweis „Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze …“ steht dabei. |

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

| Stufe | Bedingung | Text |
| --- | --- | --- |
| erreicht | ≥ 90 % | „Ziel erreicht“ |
| größtenteils | 60–89 % | „Größtenteils geschafft“ |
| teilweise | 1–59 % | „Teilweise gemacht“ |
| offen / verpasst / gestrichen | kein Eintrag | wie heute in der Woche |

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

- zählt **nicht** für die Progression und nicht für den 10 %-Bezug der Ausdauer (konservativ, wie verwaiste Einträge),
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
- **Eigene Gerichte** (E2) sind für sich kein Gesundheitsdatum (wie Rezepte), werden aber zusammen mit dem Tagebuch exportiert und gelöscht. Beim Widerruf bleiben sie (Empfehlung), Tagebuch-Einträge gehen.
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
- **Testmodus zuerst** (`localDb`); Supabase-Teil zusammen mit bzw. nach N7 Teil 2.

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

Kurz beantworten reicht („alles wie empfohlen“ geht auch).

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
- **A-G14 Favoriten und eigene Gerichte beim Widerruf** der Gesundheits-Einwilligung behalten (Tagebuch-Einträge werden gelöscht)? _Empfehlung:_ **Ja** – sie sagen nichts über Körper oder Gesundheit; Löschen jederzeit selbst möglich.
- **A-G15 Foto-Limit:** _Empfehlung:_ **30 Fotos pro Monat, höchstens 8 pro Tag**, als Konstante änderbar. Bei geschätzt unter 0,5 Cent je Foto kostet das höchstens ~15 Cent pro Person und Monat (Preise vor dem Bau prüfen).
- **A-G16 Barcode (E4):** jetzt einplanen oder erst nach A3 entscheiden? _Empfehlung:_ **erst nach A3 entscheiden.**
- **A-G17 Einwilligungstext Foto-KI:** eigene Einwilligung „Gerichte per Foto auswerten“ mit: was gesendet wird (nur Foto ohne Standort + deine kurze Info), an wen (Google, Gemini-API, Auftragsverarbeitung, EU-Verarbeitung soweit verfügbar, keine Nutzung zum KI-Training), wie lange (Foto sofort nach der Auswertung gelöscht), Schätzung ohne Gewähr, Widerruf jederzeit. _Empfehlung:_ **so**, Text vor dem Livegang juristisch prüfen; AVV mit Google abschließen (Gründer-Aufgabe).
- **A-G18 Fotos speichern** (z. B. als Erinnerung)? _Empfehlung:_ **Nein** in E3 – nur „sofort löschen“. Weniger Risiko, kein Speicherplatz.
- **A-G19 Gemini-Modell:** kleines, günstiges Modell mit Bildeingabe (Flash-Klasse), austauschbar über Konfiguration? _Empfehlung:_ **Ja**; vor dem Livegang mit 30 Testfotos gegen den Katalog prüfen (Trefferquote, Kosten).
- **A-G20 Foto-KI vor Phase 7** (ohne Abos) testen? _Empfehlung:_ **Ja, nur für freigeschaltete Testkonten** (Feature-Flag + `beta-grant`), echte Premium-Prüfung mit Phase 7.

