# Nährstoff-Timing 2 – Essen rund ums Training

**Plan freigegeben am 27.10.2026 („Passt und baue es ein“)** – alle Empfehlungen in Abschnitt 10 gelten als
entschieden. Ergänzt `docs/PLAN-PHASE-5.md` 4.8 (Mahlzeiten-Timing) und die Ernährungs-Engine in `packages/core`.

**Ziel:** Die App verteilt Eiweiß und Kohlenhydrate an Trainingstagen so über die Mahlzeiten, dass sie für Training
und Erholung gut genutzt werden, und zeigt **wann** vor und nach der Einheit **welches echte Gericht** gegessen werden
soll. Gratis, ohne KI, feste Regeln.

**Grundregel:** Tagesenergie, Defizit-Grenzen, Grundumsatz-Schutz und alle Schutzgrenzen bleiben unverändert
(`clampCalorieTarget`). Neu ist nur die **Verteilung innerhalb des Tages**, die Zuordnung zu Zeitfenstern und die
Auswahl passender Gerichte. Ein Regressionstest stellt sicher, dass die Tagessummen gleich bleiben.

## 1. Eiweiß gleichmäßig über den Tag

- Richtwert ca. **0,4 g/kg je Hauptmahlzeit**, mindestens 3 Mahlzeiten mit Eiweiß; Tagesmenge unverändert nach Ziel
  (`PROTEIN_G_PER_KG`, 1,2–2,2 g/kg).
- Ab 65: ca. 0,4 g/kg, mindestens 25 g je Hauptmahlzeit (anabole Resistenz).
- Rezept- und Portionswahl zielen darauf, dass jede Hauptmahlzeit den Richtwert erreicht (Richtwert mit Hinweis, keine
  harte Regel – Entscheidung 1). Deutlich darunter → ein Hinweis mit Ergänzung („Frühstück eiweißarm – z. B. Joghurt
  oder Ei dazu“).
- Quellen: Schoenfeld BJ, Aragon AA (2018), J Int Soc Sports Nutr 15:10; Jäger R et al. (2017), ISSN Position Stand
  „Protein and exercise“, J Int Soc Sports Nutr 14:20; Bauer J et al. (2013), PROT-AGE, J Am Med Dir Assoc
  14(8):542–559.

## 2. Nach dem Training

- Mahlzeit nach dem Training (bis 2 h danach) mit ca. **0,4 g/kg Eiweiß** (`MEAL_TIMING_RULES.postProteinGPerKg`,
  bisher nur Konstante – wird jetzt eingeplant).
- Kohlenhydrate: nach Ausdauer-Einheiten ab 60 min höherer KH-Anteil in der Mahlzeit danach. Bei **zwei Einheiten am
  Tag** oder < 8 h bis zur nächsten Einheit: Richtwert ca. **1 g/kg KH** in der Mahlzeit danach.
- Quellen: Kerksick CM et al. (2017), ISSN Position Stand „Nutrient timing“, J Int Soc Sports Nutr 14:33; Thomas DT,
  Erdman KA, Burke LM (2016), Med Sci Sports Exerc 48(3):543–568; Burke LM et al. (2011), J Sports Sci 29 Suppl 1:S17–S27.

## 3. Vor dem Training

- Mahlzeit **2–4 h vorher**: kohlenhydratreich, eher wenig Fett und Ballaststoffe; Richtwert 1–2 g/kg KH je nach Abstand.
- Snack **30–60 min vorher**: klein, v. a. KH, kaum Fett/Ballaststoffe (z. B. Banane).
- Die Engine bewertet das selbst nach Nährwerten je Portion (Fett-/Ballaststoff-Grenzen in `constants.ts`,
  PRODUKTENTSCHEIDUNG) – Rezepte darüber rücken nach hinten, sind nicht verboten.
- Frühes Training: „kleiner Snack vorher oder Frühstück direkt danach“.
- Quelle: Thomas et al. (2016): 1–4 g/kg KH 1–4 h vor der Belastung, fett-/ballaststoffarm für die Verträglichkeit.

## 4. Kohlenhydrate rund ums Training bei allen Zielen

- Innerhalb **derselben Tagesmenge** wandern KH in die Mahlzeiten vor/nach dem Training, Fett in die übrigen
  (Entscheidung 2: alle Ziele). Ruhetage gleichmäßig.

## 5. Lange Trainingseinheiten

- Geplante Ausdauer-Einheiten ab 90 min: Richtwert für unterwegs nach `COMPETITION_NUTRITION.fueling` (60–120 min bis
  30 g/h; bis 150 min 30–60 g/h; darüber 60–90 g/h nur Fortgeschrittene mit „vorher testen“) + Trinken 400–800 ml/h
  nach Durst, Hitze/Salz-Hinweis. Nur als Hinweis (Entscheidung 4). Quelle: Jeukendrup A (2014), Sports Med 44
  Suppl 1:S25–S33.

## 6. Die Uhrzeit hängt an der Trainingseinheit

- Jede geplante Einheit bekommt eine **Uhrzeit** (`planned_sessions`, neue optionale Spalte, Server – Entscheidung 10).
  Startwert aus „Trainingszeit“ (`TRAINING_TIME_START_MINUTES`); änderbar mit Tipp auf die Uhrzeit im Training-Reiter.
  Ohne Uhrzeit rechnet die App mit dem Standardwert und schreibt „ca.“.
- **Wird die Einheit verschoben** (andere Uhrzeit, anderer Tag per Kalender/„Tag tauschen“), **wandern die
  Mahlzeiten mit**:
  - Zeitfenster neu berechnet; alter Tag wird Ruhetag, neuer Tag Trainingstag; Energie/Makros beider Tage neu
    (mit allen Schutzgrenzen).
  - Gerichte, die nicht mehr zur Rolle passen, tauscht die App automatisch gegen passende (Entscheidung 9) –
    Rückmeldung „Mahlzeiten an dein Training angepasst · Rückgängig“.
  - **Nicht** automatisch geändert: schon als gegessen eingetragene Mahlzeiten und selbst gewählte/getauschte
    Gerichte – dort nur ein Vorschlag („Für vor dem Training wäre X besser – tauschen?“).
  - Einkaufsliste: geänderte Zutaten mit Hinweis „Einkaufsliste angepasst“; Abgehaktes bleibt abgehakt.
- Spontane oder von der Uhr importierte Einheiten: nur die Mahlzeit **danach** wird angepasst.
- Zwei Einheiten am Tag: zwei Fenster, dazwischen eine Auffüll-Mahlzeit.

## 7. Zeitplan „Essen rund ums Training“ – echte Mahlzeiten

Tagesansicht **Ernährung** (optional Kachel auf **Heute**) zeigt an Trainingstagen eine Zeitleiste:

```
Training heute 18:00 – 19:00 (Kraft, 60 min)
14:00–16:00  Mahlzeit vor dem Training – Hähnchen-Reis-Pfanne, 1 Portion · ca. 75 g KH · 35 g Eiweiß
17:00–17:30  Snack (optional) – 1 Banane · ca. 25 g KH
18:00–19:00  Training (ab 90 min: KH je Stunde + Trinken)
bis 21:00    Mahlzeit nach dem Training – Lachs mit Kartoffeln · ca. 30 g Eiweiß · 60 g KH
```

- Jedes Fenster zeigt ein **konkretes Gericht mit Portion**, nie nur Gramm-Zahlen; Werte klein darunter.
- Rezept und Portionsfaktor so gewählt, dass die Werte nah am Bedarf liegen (Toleranz ca. ±15 %,
  PRODUKTENTSCHEIDUNG); reicht ein Gericht nicht, kleine Beilage dazu („+ 1 Glas Milch“). Vorlieben,
  Unverträglichkeiten und Allergien gelten wie immer.
- Snack vorher: echtes Lebensmittel mit Menge aus einer festen, geprüften **Snack-Liste** (Inhalt, Entwurf →
  Freigabe); auf Wunsch auf die Einkaufsliste.
- Passt nichts: das beste Gericht mit ehrlichem Hinweis („etwas weniger Eiweiß als ideal“).
- Je Eintrag eine kurze Begründung („Warum?“) in einfachen Worten.
- Optionale lokale Erinnerung („In 1 Stunde: Snack vor dem Training“), Standard aus (Entscheidung 8), nur auf dem Gerät.
- Mahlzeit-Karten tragen „Vor dem Training“/„Nach dem Training“; höchstens ein Timing-Hinweis pro Tag über die
  Hinweis-Zeile (NoticeStack).
- Ratgeber-Entwurf „Essen rund ums Training“.

## 8. Sicherheit und Ausnahmen

- Tagesenergie und alle Schutzgrenzen unberührt (Strukturtest).
- Unter 18: nur Zeitfenster, Gerichte und allgemeine Hinweise, keine Gramm-Angaben.
- Schwangerschaft/Stillzeit (`no_targets`): kein Timing in Gramm, nur allgemeine Texte.
- Gramm je kg nur mit Körpergewicht (Einwilligung) und „Kalorienzahlen anzeigen“.
- Nieren-Hinweis über 1,6 g/kg unverändert. Keine Gesundheitsdaten in Logs.
- Alle Werte in `constants.ts` mit Quelle und „VOR LIVEGANG FACHLICH PRÜFEN“.

## 9. Umsetzung (Etappen)

- **T0 Datenbank:** `planned_sessions.start_time` (optional, Uhrzeit, CHECK, RLS wie Tabelle), Durchreichen in den
  Server-Funktionen zum Speichern/Verschieben geplanter Einheiten (neue Fassungen auf die neueste aufsetzen), pgTAP,
  `db-sync.test.ts`, Zod/Typen.
- **T1 Core mit Tests:** Zeitfenster aus Uhrzeit und Dauer, Rollen inkl. Doppel-Tag, Makro-Verteilung je Mahlzeit
  (Eiweiß je Mahlzeit, KH-Verschiebung), Gericht- und Portionswahl mit Toleranz und Beilage, Vor-Training-Bewertung nach
  Nährwerten, Neuplanung beim Verschieben (was getauscht wird, was nicht), Einkaufslisten-Differenz, Unterwegs-Richtwert.
  Grenzfälle: 16/80 Jahre, sehr leicht/schwer, 1 vs. 7 Trainingstage, Ruhetag, zwei Einheiten, frühes Training, ohne
  Uhrzeit, ohne Gewicht, unter 18, `no_targets`. Regression: Tagessummen unverändert, Pläne ohne Trainingszeit gleich.
- **T2 App:** Zeitleiste, Uhrzeit an der Einheit (Training-Reiter), Verschieben samt Rückgängig, Einkaufslisten-Hinweis,
  Erinnerung, Testmodus-Szenario, Leer-/Fehler-/Ladezustände.
- **T3 Inhalte und Doku:** Snack-Liste (Entwurf), Markierungen vor/nach Training nach Nährwert-Regeln, Ratgeber-Entwurf,
  `docs/KONZEPT.md`, `docs/HANDY-ANLEITUNG.md`.

## 10. Entscheidungen (freigegeben 27.10.2026)

1. Eiweiß je Mahlzeit als Richtwert mit Hinweis (nicht harte Regel).
2. KH-Verschiebung innerhalb des Tages bei allen Zielen.
3. – (ersetzt durch 10)
4. Verpflegung unterwegs nur als Richtwert-Hinweis.
5. Alles gratis.
6. „Eiweiß vor dem Schlafen“ nicht in diesem Paket.
7. – (ersetzt durch 10)
8. Erinnerungen vor dem Training standardmäßig aus.
9. Unpassende Gerichte nach dem Verschieben automatisch tauschen, mit Rückgängig.
10. Uhrzeit der Einheit auf dem Server (an der geplanten Einheit).

## 11. Umsetzungsstand

- Plan freigegeben 27.10.2026.
- **T0 Datenbank (umgesetzt, Branch `claude/naehrstoff-timing-impl`):** Migration `20261027160000_naehrstoff_timing.sql`
  (`planned_sessions.start_time` optional, ganze Minuten 00:00–23:59, CHECK, Spalten-Recht zum Ändern; Trigger und RLS
  unverändert; `meal_plan_items.user_chosen` Standard false) und `20261027160100_naehrstoff_timing_rpcs.sql` (neue
  Fassungen von `private.insert_plan_sessions` – optionales Feld `start_time` – und `public.save_meal_plan` – optionales
  Feld `user_chosen`, jeweils auf die neueste Fassung aufgesetzt). pgTAP `105_naehrstoff_timing.test.sql`,
  `db-sync.test.ts`, Zod, Datenbank-Typen. Verschieben (Update, `swap_planned_sessions`) nimmt die Uhrzeit ohne neue
  Fassung mit.
- **T1 Core (umgesetzt):** `nutrition/timing.ts` (Zeitfenster, Rollen je Fenster, zwei Einheiten),
  `training-meal-targets.ts` (Makro-Anteile je Mahlzeit, Verträglichkeit vor dem Training), `targets.ts`
  (`trainingTiming` nur an Tagen mit eigener Uhrzeit), Rezeptwahl in `meal-plan.ts` (nur Reihenfolge),
  `training-replan.ts` (Verschieben, Rückgängig, Einkaufslisten-Differenz), `training-timeline.ts` (Zeitleiste,
  Snack/Beilage, unterwegs, ein Hinweis je Tag), `plan/session-time.ts`. Werte in `constants.ts`
  (`SESSION_START_TIME`, `NUTRIENT_TIMING`, `TRAINING_TAG_RULES`) mit Quelle, VOR LIVEGANG FACHLICH PRÜFEN.
  Tests `naehrstoff-timing.test.ts` (alle Grenzfälle aus 9 T1, Eigenschaftstest 200 Fälle: Tagessummen identisch,
  Schnappschuss Altbestand).
- **Umsetzungs-Entscheidungen (PRODUKTENTSCHEIDUNG, zur Fachprüfung):** Fett vor dem Training ≤ 30 % der Energie der
  Portion, Ballaststoffe ≤ 15 g je 1000 kcal (mind. 8 g); Snack ≤ 5 g Fett, ≤ 3 g Ballaststoffe, ≤ 250 kcal;
  KH-Verschiebung +25 %; Toleranz ±15 %; Standard-Start ohne Trainingszeit 17:30. Die **Rezeptwahl** des Essensplans
  ändert sich nur an Tagen mit **eigener Uhrzeit** (Altbestand bleibt byte-gleich); die **Zeitleiste** gibt es an jedem
  Trainingstag (sonst „ca.“). Die Anpassung beim Verschieben greift, wenn sich Rollen vor/nach dem Training ändern
  (eigene Uhrzeit oder „Trainingszeit“); ohne beides gilt die bisherige automatische Neuplanung.
- **T2 App (umgesetzt):** Karte „Essen rund ums Training“ in Ernährung · Tag, Uhrzeit im Tages-Blatt (Training),
  Rückmeldung „Mahlzeiten an dein Training angepasst · Rückgängig“ mit Einkaufslisten-Hinweis und Vorschlägen für
  selbst gewählte Gerichte, Erinnerung (lokal, Standard aus), Testmodus-e2e `naehrstoff-timing.spec.ts`.
- **T3 Inhalte und Doku (umgesetzt, Entwürfe):** Ratgeber `content/guides/essen-rund-ums-training.json`, Snack-Liste
  als Snack-Rezepte (Banane vor dem Training, Reiswaffeln mit Honig, Datteln, Skyr natur, Ein Glas Milch, Skyr mit
  Banane), Prüfregel R22T (gelb: Markierung vor/nach Training passt nicht zu den Nährwerten), KONZEPT 6.3a,
  HANDY-ANLEITUNG Teil 9w. Keine neuen Schema-Felder → kein eigener Inhalts-Branch nötig.
- **Offen:** Kachel auf „Heute“ (optional, nicht gebaut); Fachprüfung aller Werte; Freigabe der Entwürfe; im
  Supabase-Modus gibt es „Rückgängig“ nur, wenn der vollständige Plan auf dem Gerät liegt (sonst wird still angepasst).
