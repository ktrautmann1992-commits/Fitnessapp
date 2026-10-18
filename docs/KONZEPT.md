# Fachkonzept – Alpha5

Eingearbeitet: Erweiterungen aus dem Brainstorming der Gründer (`docs/ERWEITERUNGEN.md`). Die Abschnittsnummern 1–14
bleiben stabil, weil andere Dokumente darauf verweisen; neue Themen stehen als Unterabschnitte (z. B. 4.1, 6.1) oder
in den neuen Abschnitten 15 und 16.

Eingearbeitet am 11.10.2026: **Erweiterungen Teil 2** – Rezepte, Küche und Lead-Magnet (`docs/ERWEITERUNGEN-2.md`) in
den Abschnitten 3, 6.5–6.13, 11, 12, 13, 14 und im neuen Abschnitt 17 (Lead-Magnet). Konflikte mit bestehenden Regeln
und wie sie aufgelöst sind: Abschnitt 18. Umsetzungsplan: `docs/PLAN-PHASE-5.md` Abschnitt 19.

**Grundregeln für alle Erweiterungen:** Echtzeit-KI nur für Premium (Abschnitt 15). Kein Teilen, keine Community,
keine Ranglisten, keine öffentlichen Profile – Strecken, Fotos, Abzeichen und Challenges bleiben privat
(Ausnahme nur Partner-Modus, Abschnitt 11).

## 1. Zielgruppe & Ziele
- DACH, Einsteiger, Fortgeschrittene, ambitionierte/professionelle Ausdauersportler
- Ziele: Fettverlust, Definition, Muskelaufbau, Allgemeine Fitness, Ausdauer
- **Zwei Ziele** (seit Ziele Z1–Z5, `docs/PLAN-ZIELE.md`, Gründer-Entscheidung F1): Hauptziel + optionales Nebenziel aus
  einer festen Liste erlaubter Paare (Tabelle 4.2 dort). Die Trainingsvorlage folgt dem Hauptziel, das Nebenziel ergänzt
  (z. B. Ausdauer-Tage, mehr Eiweiß, kleineres Defizit). Abnehmen wahlweise **ohne festes Ziel** (Standard) oder **mit
  konkretem Ziel** (Wunschgewicht + Zeitraum) mit Planbarkeits-Ampel Rot → Grün; ein konkretes Ziel macht den Plan nie
  schneller als ohne (F5). Keine Gewichtsprognose, keine Kurve, kein Countdown (F7); Wunschgewicht und
  Zeitraum stehen nur unter Einstellungen; auf „Heute“ erscheinen nur die Karten „erreicht“/„Zeitraum vorbei“ ohne
  Zahlen (F13).
- Ausdauer-Disziplinen: 5 km, 10 km, Halbmarathon, Marathon, Triathlon (Sprint, Olympisch, Mitteldistanz, Langdistanz), Radfahren, Schwimmen
- Optional Wettkampfdatum → Periodisierung rückwärts vom Wettkampf

## 2. Onboarding (Reihenfolge)
Verbindlich ist der freigegebene Ablauf in `docs/PLAN-PHASE-1.md` Abschnitt 3 (Stand Phase 1):
- A. Willkommen
- B. **Geburtsdatum** (min. 16) – **vor** dem Konto; unter 16 freundlicher Stopp, nichts wird gespeichert
- C. Konto anlegen: Login per **E-Mail-Code** (6-stellig, ohne Passwort); Apple/Google folgen. Direkt danach wird das
  **Profil zuerst** angelegt (geprüftes Geburtsdatum = Voraussetzung für alle Einwilligungen und Daten)
- D. Grund-Einwilligungen: Nutzungsbedingungen und Datenschutzerklärung (getrennt, nicht vorausgewählt)

1. Geschlecht (männlich / weiblich / divers / keine Angabe) → bei weiblich: Interesse am Zyklusmodul ja/nein (Modul und eigene Einwilligung in Phase 9)
2. Einwilligung Gesundheitsdaten (`health_data`) – **vor** den Körperdaten; ohne Einwilligung geht es weiter, aber ohne Körperdaten und Gesundheits-Check (mit Hinweis)
3. Körperdaten: Größe, Gewicht, optional Körperfett, Ruhepuls; danach **optional** Körperumfänge mit Mess-Anleitung (Abschnitt 11.1)
4. Gesundheits-Check (Herz-Kreislauf, Schwangerschaft, Verletzungen/Beschwerden, Medikamente ja/nein)
5. Trainingserfahrung (Einsteiger / Fortgeschritten / Leistungssport)
6. Ziel + ggf. Disziplin + Wettkampfdatum – seit Ziele Z4 Haupt- und optionales Nebenziel (Disziplin/Datum, sobald
   Ausdauer Haupt- oder Nebenziel ist)
   6a. „Wie möchtest du abnehmen?“ (`weight_goal`, nur bei Abnehmen als Haupt- oder Nebenziel und mit Einwilligung
   Gesundheitsdaten): ohne festes Ziel / mit konkretem Ziel (Menge + Zeitraum, Ampel). Später unter Einstellungen →
   „Dein Abnehm-Ziel“ (Z5: bearbeiten, entfernen, verlängern)
7. Trainingstage (seit Phase 3, Etappe B2 – `docs/PLAN-PHASE-3-ERWEITERUNG.md`): je Wochentag Trainingsart (Kraft im Studio / Kraft zu Hause / Ausdauer mit Untertitel nach Disziplin) und Dauer (20/30/45/60/90 min oder eigene 10–240) – oder „Tage egal“ mit Anzahl je Art und Dauer; Live-Zusammenfassung und freundliche Hinweise (nie blockierend)
8. Trainingsort: **entfällt als eigener Schritt** – abgeleitet aus den Trainingstagen (nur Studio / nur zu Hause / beides / nur Ausdauer)
9. Equipment zu Hause (nur bei mindestens einem Tag „Kraft zu Hause“): Gewichte zum Antippen (Mehrfachauswahl) + eigene Werte – Kurzhanteln (je Hantel), Langhantel = Stange (10/15/20 kg oder eigene 5–25) + Scheiben je Paar (≤ 25 kg), Kettlebells (kg), Flachbank, Schrägbank, Klimmzugstange, Widerstandsbänder, Rudergerät, Ergometer, Laufband, Sonstiges (Freitext)
10. Ernährung: omnivor / vegetarisch / vegan; Schwein ja/nein; mag / mag nicht (Lebensmittel-Auswahl); Unverträglichkeiten; Mahlzeiten pro Tag
11. Kochmodus: täglich frisch / Meal-Prep (wie oft pro Woche)
- E. Fertig: Zusammenfassung
- Wearable verbinden: **in Phase 1 entfallen**, kommt mit Phase 8 (optional, überspringbar)

## 3. Content-Pipeline (Offline-KI)
- Skripte in `packages/content` erzeugen per **Google Gemini Batch API** (kostengünstig, asynchron; bis 14.10.2026
  Claude Message Batches API – Gründer-Entscheidung 14.10.2026 „KI läuft über Gemini – überall“,
  `docs/PLAN-PHASE-5.md` Umsetzungsstand N8):
  - Plan-Vorlagen (Matrix: Ziel × Level × Tage/Woche × Minuten × Equipment-Profil × Geschlecht wo sinnvoll)
  - Ausdauer-Blöcke (Basis, Aufbau, Spitze, Tapering) je Disziplin und Level
  - Rezepte (getaggt: Ernährungsform, Schwein, Kochmodus, Zubereitungszeit, Makros pro Portion, Haltbarkeit für Meal-Prep;
    zusätzlich Trainings-Tags `vor_training` / `waehrend` / `nach_training` für Abschnitt 6.3, inkl. schneller Varianten ohne Kochen)
  - Übungsbeschreibungen, Technik-Hinweise, Alternativen
- Jede Ausgabe: JSON-Schema-Validierung → Status `draft` → Review im Admin-Bereich → `published`
- Plausibilitäts-Checks automatisch (z. B. Makros eines Rezepts rechnerisch prüfen, Wochenvolumen innerhalb Grenzen)
- Fachliche Freigabe durch qualifizierte Person (Trainer/Ernährungsfachkraft) vor Veröffentlichung empfohlen

**Umsetzung ab Phase 2 (`docs/PLAN-PHASE-2.md` Abschnitte 3–5 und 7):**
- **Das Repository ist die einzige Wahrheit:** Jeder Inhalt ist eine JSON-Datei unter `content/`
  (`content/exercises/<id>.json`, `content/plan-templates/<id>.json`) mit Status `draft` / `published` / `archived`.
  Inhalte fließen nur in eine Richtung: Repository → Datenbank. Auch der Admin-Bereich schreibt nicht in die Datenbank.
- **Freigabe = Merge eines Pull Requests durch einen Menschen** (Status `published`, Prüfer in `meta.reviewed_by`).
  Workflows öffnen Pull Requests, genehmigen aber nie. Herkunft und Prüfvermerk stehen in `meta`
  (`origin` = `claude_session` / `batch` / `manual`, `expert_reviewed` = fachlich geprüft ja/nein); KI-Entwürfe ohne
  fachliche Prüfung werden als „KI-Entwurf – fachlich prüfen“ gekennzeichnet.
- **Prüfung `pnpm content:validate`** (Regeln Ü1–Ü6, V1–V13 aus `packages/core/src/content`, Grenzwerte in
  `constants.ts`): läuft in `ci` bei jedem Push. Schema-Fehler blockieren immer, andere rote Fehler nur bei
  freigegebenen Inhalten; gelbe Hinweise blockieren nie. Ändert sich ein freigegebener Inhalt, muss `version` steigen.
- **Einspielen:** Nur Freigegebenes kommt per `seed_content()` (eine Transaktion, nur `service_role`) in die
  Datenbank; nicht mehr Freigegebenes wird archiviert statt gelöscht. Entwürfe liegen nie in Supabase.
- Startbestand (Phase 2, Etappe A): 52 Übungen und 24 Plan-Vorlagen als KI-Entwurf (`origin: claude_session`).
- **Pipeline (Phase 2, Etappe B, `packages/content/src/pipeline`):** `content-generate` schickt einen Batch an die
  Gemini Batch API (seit Etappe N8; strukturierte JSON-Ausgabe per `responseJsonSchema`, Kostenschätzung vorab, Deckel
  `CONTENT_MAX_USD`, höchstens 200 Anfragen) und endet; `content-collect` (alle 3 Stunden + per Hand) holt die
  Ergebnisse über `custom_id` (Gemini `metadata.key`) ab, speichert gültige Antworten als `draft` (`origin: batch`),
  prüft alles und öffnet einen Pull Request; `content-review` setzt den Status per Pull Request; `content-seed` prüft
  alles und spielt nur `published` ein. Inhaltsarten (`exercise`, `plan_template`, `ingredient_substitution`,
  `package_size`, `recipe`) sind austauschbar; der KI-Anbieter steckt hinter einer Schnittstelle
  (`pipeline/provider/`). Probelauf ohne Schlüssel. Secret: `GEMINI_API_KEY` (`ANTHROPIC_API_KEY` entfällt).
- **Datenschutz der Offline-KI:** An Gemini gehen ausschließlich Inhalts-Prompts (Regeln, Lebensmittel-Katalog,
  Matrix-Werte) – **nie Nutzerdaten**; die Pipeline hat keinen Zugriff auf Nutzerdaten. Ein AVV mit Google ist dafür
  nicht nötig, wohl aber vor Premium-Echtzeit-KI (Abschnitt 15).

**Rezept-Startbestand aus `alpha5-rezepte.json` (Erweiterungen Teil 2, `docs/PLAN-PHASE-5.md` Abschnitt 19):**
- Die Gründer-Datei `packages/content/seed/alpha5-rezepte.json` (242 Rezepte, 236 Zutaten, 4 Meal-Prep-Wochenpläne,
  2 Ratgeber) **ersetzt die KI-Erzeugung des Rezept-Startbestands**. Ein Import-Skript wandelt sie (idempotent über die
  IDs, Zod-geprüft) in Inhaltsdateien unter `content/` um – alles als `draft`, Ergebnis als Pull Request. Die Datei
  selbst bleibt unverändert.
- **Nährwerte nie aus der Datei:** Jede der 236 Zutaten bekommt einen Eintrag der amtlichen Nährwertdatenbank (BLS
  o. ä., maschineller Import wie in Phase 5); die Werte der Datei dienen nur als Gegencheck (Abweichung > 3 % wird
  gemeldet). Allergene, Ernährungsform und „ohne Schwein“ berechnet der Core aus den Zutaten (Regeln aus Phase 5, N2a).
- Freigabe wie gehabt per Pull Request, zusätzlich **Sammelfreigabe pro Kategorie** über `content-review`; vor dem
  Livegang Fachprüfung durch eine Ernährungsfachkraft. Entwürfe kommen nie nach Supabase.
- Weitere Inhaltsarten über die Batch-Pipeline (je `draft` → Prüfung → Freigabe): **Austausch-Tabelle**
  `ingredient_substitutions` (6.9), **Packungsgrößen** der Zutaten (6.11); später Rezept-Ergänzungen.

## 4. Trainingsplan-Engine (`packages/core/plan`)
1. **Matching:** passende Vorlage nach Ziel, Level, Tagen, Dauer, Equipment-Profil (Scoring, beste Übereinstimmung).
   Mit zwei Zielen (`docs/PLAN-ZIELE.md` 4.3): Vorlage nach dem **Hauptziel** (Ziel-Profil `templateGoal`), keine
   gemischten Vorlagen; Nebenziel Ausdauer belegt zusätzlich Ausdauer-Tage vor („Hauptziel zuerst“). Der Trainingsplan
   kennt kein Wunschgewicht und kein Tempo; Planname mit beiden Zielen („Abnehmen + Muskelaufbau · 3 Tage“) auf
   „Heute“, in der Woche und im PDF (Z5). Ein geändertes Nebenziel führt zum Angebot „Plan neu erstellen?“.
2. **Equipment-Anpassung:** Übung nicht machbar → Alternative aus Bibliothek mit gleichem Bewegungsmuster/Muskelgruppe
3. **Terminierung:** Einheiten auf bevorzugte Wochentage, Erholungsabstände beachten
4. **Laststeuerung:** Startgewichte aus Selbsteinschätzung bzw. erstem Testtraining; danach doppelte Progression (erst Wiederholungen, dann Gewicht); RPE-Ziel pro Satz
5. **Deload:** alle 4–6 Wochen bzw. bei sinkender Leistung/hoher Belastungsempfindung
6. **Ausdauer:** Intensitätsverteilung ca. 80/20, Zonen aus Testlauf/Herzfrequenz, Umfangsteigerung ≤10 %/Woche, Tapering vor Wettkampf
7. **Neuplanung:** verpasste Einheiten sinnvoll verschieben oder streichen, nie stapeln
   **Verschieben mit Ziel-Tag (Etappe A1a, umgesetzt 15.10.2026, `docs/PLAN-AUSWERTUNG.md` 3):** Trainingskalender
   (Woche Mo–So) – Einheit per langem Druck auf einen anderen Tag ziehen oder über „Verschieben …“ einen Tag wählen.
   `moveTargets()` nennt für jeden Tag „erlaubt“ oder den Grund (harte Sperren: nur ab heute, nur dieselbe ISO-Woche,
   Erholungswoche nur streichen, nie zwei Einheiten am Tag, 48 h zwischen Kraft-Einheiten mit gleichen Muskeln, erledigte
   fest). Belegter Tag = **tauschen**, wenn beide Einheiten danach alle Regeln erfüllen (Server-Funktion
   `swap_planned_sessions`, braucht Verbindung). Danach „Rückgängig“ und der Hinweis zum Essensplan.
8. **Fallback:** keine Vorlage passt → Echtzeit-KI-Generierung mit gleichem Schema + Validierung (Premium, Limit über `ai_usage`, Abschnitt 15).
   Gratis (**beschlossen 04.10.2026**, `docs/PLAN-PHASE-3.md` Frage 1): nächstbeste Vorlage mit Hinweis, was nicht ganz passt.
   Fehlen freigegebene Inhalte ganz: klarer Fehlerzustand, kein Ersatz
9. **Equipment aus „Mein Studio“:** Hat das gespeicherte Studio eine Geräteliste, dient sie als Equipment-Profil (Abschnitt 16)

**Umsetzung ab Phase 3 (`docs/PLAN-PHASE-3.md`, Etappe A: Plan-Engine in `packages/core/src/plan`):**
- Reine, deterministische Funktionen ohne KI: `generateTrainingPlan(inputs, library, today)` = Angaben prüfen (Zod, **ohne
  Körperdaten**, Mindestalter 16) → Sicherheitsregeln → Vorlage wählen (Punkte: Ziel 35, Level 25, Tage 15, Ort 10, Geräte 10,
  Dauer 5; Güte „passt genau / mit Anpassungen / nächstbeste Vorlage“) → anpassen → Wochentage → erster Plan-Block.
- **Inhalte:** live nur `published`; Entwürfe nur im Testmodus der App (ohne roten Befund, nie Probelauf, gekennzeichnet).
- **Sicherheitsregeln (strengste gilt):** Gesundheits-Flag oder **kein Gesundheits-Check** → nur Einsteiger-Vorlagen, RPE ≤ 7,
  keine Übungen mit Sprüngen, schwerer Wirbelsäulenlast oder hoher Technik; bei Verletzung/Herz-Kreislauf und ohne Check auch
  kein Über-Kopf; Schwangerschaft zusätzlich keine lange Rückenlage; unter 18 RPE ≤ 8 ohne Technik-Übungen; ab 65 RPE ≤ 7
  ohne Sprünge/Technik; Einsteiger RPE ≤ 8. Nie Maximaltests. Strengere Regeln wirken sofort (Anzeige, Folgeblock),
  Lockerungen nur nach Bestätigung.
- **Ersatz** bei fehlendem Gerät oder Sicherheitsregel: Alternativen → Alternativen der Alternativen → gleiches Muster →
  gemeinsamer Hauptmuskel; nie schwerer, immer erlaubt; sonst entfällt die Übung.
- **Tage:** 1–2 Tage per Rotation der 3-Tage-Ganzkörper-Vorlage, höchstens 4 Krafteinheiten/Woche, Wunsch-Tage haben Vorrang.
- **Block:** Einstiegswoche (RPE −1, „Startgewicht finden“ statt vorab gerechnetem Gewicht), Einsteiger 5, sonst 4
  Belastungswochen, dann feste Erholungswoche (Sätze halbiert, RPE −2); angebrochene Startwoche mit weniger als der Hälfte der
  Einheiten = „Woche 0“; Folgeblock aus dem Schnappschuss mit aktuellen Sicherheitsregeln.
- **Doppelte Progression:** erst Wiederholungen, dann Gewicht (Gewichtsschritt bis 10 % direkt; größere Sprünge nie direkt,
  erst nach Puffer aus Zusatz-Wiederholungen und einem Zusatzsatz); Halteübungen +1–5 s; nie Last senken (das ist 4.1).
- **Verpasste Einheiten:** nächster freier Tag ab heute in derselben Kalenderwoche mit 48 h Erholung, sonst streichen.
- Pläne, in die der Gesundheits-Check eingeht, gelten vorsorglich als Gesundheitsdaten (`docs/PLAN-PHASE-3.md` Abschnitt 9).

**Umsetzung Ausdauer-Basis (Engine-Version 2, `docs/PLAN-PHASE-3-ERWEITERUNG.md`, Etappe B3):**
- Angaben = Trainingstage mit Art (Kraft im Studio / zu Hause / Ausdauer) und Dauer, fest oder „Tage egal“; je Tag höchstens
  eine Einheit; höchstens 4 Kraft-Tage, Ausdauer-Deckel je Gruppe (4/5/6, vorsichtig 3), Einsteiger/vorsichtig/unter 18/ab 65
  höchstens 5 Einheiten pro Woche.
- Kraft: Vorlage nach der Zahl der Kraft-Tage und der **längsten** Kraft-Dauer, Ort = Mehrheit; jede Einheit in der Fassung
  ihres Orts und **je Termin** auf die Minuten des Tages gekürzt; 48-h-Regel nur Kraft gegen Kraft.
- Ausdauer ohne KI: lockere Einheiten (Anstrengung 3–4 von 10, Gesprächstest) – Dauerlauf, Geh-Lauf-Wechsel (Einsteiger
  anfangs, ohne Check immer), zügiges Gehen (Flag, ab 65), Schwangerschaft nur Gehen/Ergometer/lockeres Schwimmen (nie Rad
  im Freien), Rad/Schwimmen nach Disziplin. Startumfang 60/120/150 min (vorsichtig 45), +10 % je Woche gegen die letzte
  Belastungswoche (`Math.floor`), Erholungswoche 60 %, je Einheit höchstens 50 % der Woche, am Start höchstens 90 min,
  Start-Deckel je Einheit 30/20 min, Einheiten unter 10 min entfallen. Reine Ausdauer-Pläne haben keine Vorlage.
- Wettkampf-Periodisierung, Intervalle, Zonen, Strecken bleiben Phase 10.
- **Wettkampf, Ampel und Phasen rückwärts (Phase 10, Etappe WP1, Core umgesetzt 16.10.2026, `docs/PLAN-PHASE-10.md`
  Umsetzungsstand WP1):** Laufen 5 km bis Marathon. `competitionFeasibility` → Passt / Knapp / Zu kurz / Nicht möglich
  mit Vorschlägen (kürzere Distanz, späteres Datum, ohne Wettkampf weiter) – mit derselben 10-%-Kette wie der Plan, nie
  gestaucht. `macroCycle` plant rückwärts Basis → Aufbau → Spitze → Tapering → Rennwoche → Erholung (Erholungswochen fest,
  3 : 1 im Aufbau für Einsteiger, nie direkt vor dem Tapering). Noch ohne App und ohne Speicherung (WP3/WP4).
- **Einheiten, Intensität, Wochenbau (Phase 10, Etappe WP2, Core umgesetzt 16.10.2026, `docs/PLAN-PHASE-10.md`
  Umsetzungsstand WP2):** Nur im Wettkampfplan – Pläne ohne Wettkampf bleiben byte-gleich. Arten locker, Erholungslauf,
  langer Lauf, Steigerungen, Fahrtspiel, Tempo, Intervalle, Renntempo als feste Textbausteine mit Schritten (Timer ab
  WP4). Langer Lauf mit eigener Steigerungsregel (+10 % je Belastungswoche ab Start-Deckel, ≤ 50 % der Woche, Laufen
  ≤ 180 min, Halbmarathon ≤ 120 min) – die Ampel prüft ihn mit. 80/20: höchstens 20 % der Wochenminuten mit Anstrengung
  ≥ 6. Harte Einheiten erst ab Aufbau (Einsteiger/unter 18 höchstens 1, sonst 2 je Woche; Flag, ab 65, Schwangerschaft
  keine), nie an zwei Tagen hintereinander, nie neben dem langen Lauf oder einem Kraft-Tag mit Beinen (auch beim
  Verschieben: Grund `hard_endurance_48h`). Spitze/Tapering höchstens 1 Kraft-Einheit, Beine leicht. Pace und
  Distanz-Richtwert nur mit eigener Referenzzeit (Riegel, nur bis Distanzfaktor 4), Zielzeit höchstens 5 % schneller als
  die Vorhersage. „Nur
  Gehen“ (Flag, ab 65) → Ampel höchstens „Knapp“ (G7).
- **Datenmodell Wettkampf (Phase 10, Etappe WP3, umgesetzt 16.10.2026, `docs/PLAN-PHASE-10.md` Umsetzungsstand WP3):**
  Tabelle `competitions` (ein geplanter Wettkampf je Person, Speichern nur über `save_competition`), Wettkampf-Felder je
  Einheit in `planned_sessions` (Art, Phase, Schritte, Distanz-Richtwert; Anstrengung bis 8 nur bei harter Art). Der
  Server prüft zusätzlich je Person: Wettkampfplan nur mit Gesundheits-Check, nicht in der Schwangerschaft, unter 18
  höchstens 7 und kein Marathon, ab 65 höchstens 6, mit Arzt-Hinweis keine harten Einheiten, harte Einheiten je Woche
  (Einsteiger/vorsichtig 1, sonst 2). Der Wettkampf selbst ist kein Gesundheitsdatum; der daraus abgeleitete Plan-Bezug
  nur mit Einwilligung, beim Widerruf geleert.
- **Wettkampf in der App (Phase 10, Etappe WP4, umgesetzt 16.10.2026, `docs/PLAN-PHASE-10.md` Umsetzungsstand WP4):**
  Einstellungen → „Mein Wettkampf“: Wettkampf eintragen, Ampel sofort beim Datum (Zeichen + Wort, Gründe, Vorschläge),
  „Wettkampfplan erstellen“ nur bei „Passt“/„Knapp“ (erst `save_competition` mit Plan-Bezug, dann der Plan) oder „Nur
  Countdown“. „Heute“ zeigt Countdown und Phasen-Band („Aufbau · Woche 6 von 14“), jede Einheit Art, Ablauf, Pace und
  Distanz-Richtwert (nur mit Referenzzeit, immer mit „Die Anstrengung hat Vorrang …“); der Kalender markiert den Renntag.
  Trainingsmodus mit Intervall-Timer (Schritt für Schritt, Pause/Weiter, „Abbrechen und eintragen“, Vibration in der
  App, Ansage für den Bildschirmleser). Ergebnis ab dem Renntag als freie Einheit; Absagen mit Bestätigung, danach
  „Plan neu erstellen“. Endet der Wettkampfplan, schlägt die App einen neuen (vorsichtigen) Plan vor statt eines
  Folgeblocks von der Spitze aus.
- Ausdauer-Ziel klarer (Gründer-Feedback „Ziel Marathon → Plan für allgemeine Fitness“): Beim Ziel Ausdauer belegt
  „Deine Trainingstage“ Ausdauer-Tage vor (`suggestedTrainingSlots`, Werte `ENDURANCE_GOAL_SUGGESTION`: 3 Ausdauer + 2 Kraft,
  Leistungssport 4 + 2, vorsichtig 2 + 1, Triathlon mehr Ausdauer; Deckel wie oben) – nur ohne gewählte Tage, änderbar
  („Ohne Vorschlag planen“). Der Plan heißt „Ausdauer-Grundlage – <Disziplin>“ (`planTitle`, nur Anzeige; gespeichert bleibt
  `template_title_de`). Den Wettkampfplan rückwärts ab Renntag gibt es seit Phase 10 WP4 unter „Mein Wettkampf“.

**Training nur mit dem eigenen Körpergewicht (Engine-Version 3, `docs/PLAN-KOERPERGEWICHT.md`, Etappen K1–K4):**
- Sind alle Kraft-Tage zu Hause und gibt es dort keine Kraft-Geräte (freie Gewichte, Bänder, Maschinen; Bank,
  Klimmzugstange und Ausdauer-Geräte zählen nicht), gibt es nur **Körpergewicht-Vorlagen** (3 Ziele × 2 Level × 2/3/4
  Tage, nur Übungen ohne Geräte, Rudern über Türrahmen bzw. Handtuch, Hüftbeugen ohne Gewicht, jede Einheit mit Rumpf).
  Steigern über mehr Wiederholungen, dann einen Satz mehr, dann eine schwerere Variante. Gemischte Wochen (Studio +
  Zuhause ohne Geräte) bekommen vorerst die Studio-Vorlage, die Zuhause-Tage tauschen auf Übungen ohne Geräte.
- **Ehrlich gesagt:** Ohne Geräte ist der Trainingsreiz begrenzt – vor allem für Rücken und Beinrückseite und je
  fortgeschrittener man ist. Die Pläne halten fit und bauen Kraft auf; für maximalen Muskelaufbau sind Geräte besser
  (schon ein Widerstandsband oder Kurzhanteln). Das steht in der Planbeschreibung und als Hinweis „Training ohne
  Geräte“ in der App (Fertig-Bildschirm und „Heute“, `planInfoNotices()` in `packages/core` entscheidet allein über
  das Vorlagen-Kennzeichen). Trägt die Person Geräte nach, bietet die App einen neuen Plan an.

**Umsetzung ab Phase 4 (`docs/PLAN-PHASE-4.md`, Etappe A: Core in `packages/core/src/log`):**
- **Progression aus dem Tagebuch, nicht in den Plan geschrieben:** Grundlage ist der gespeicherte, ortsunabhängige
  Zustand `state_*` (Gewicht, Ziel-Wdh., Zusatzsatz, Dauer) des neuesten zählenden Eintrags – nie die angezeigte Vorgabe.
  `nextLoad()` bekommt diesen und den Eintrag davor (nur bei gleichem Zustand = „zweimal in Folge“). Jede Einheit zählt
  gegen ihre eigene Satzzahl (kurze Fassungen); Gewichtssprung und Zusatzsatz nur, wenn eine der beiden Einheiten die
  Vorlagen-Satzzahl hatte. Der gespeicherte Rohwert wird nie auf ein gerundetes Gewicht gesenkt; heute
  wirksam ist die abgerundete Stufe des Orts. Kann der Ort den Rohwert nicht zeigen (z. B. zu Hause), gilt der
  Wdh.-Fortschritt dort nur für diesen Ort; zurück im Studio geht es mit dem Studio-Stand weiter.
- **Einstiegswoche/Woche 0** zählt nicht für „zweimal in Folge“, kalibriert aber das erste Arbeitsgewicht
  (`estimateWorkingWeight()`, ohne RPE „keine Reserve“); **Erholungswoche** ändert den Zustand nie (Anzeige ×0,9).
- **Alternative** hat ihren eigenen Verlauf und ihre eigene angezeigte Vorgabe; die geplante Übung bleibt unverändert.
- **Wiedereinstieg nach Pause (Gratis-Schutzregel):** Pause = 28 Tage ohne Training an mindestens dem heute gezeigten
  Gewicht (gilt je Ort, auch am gerundeten Ort; gestemmt zählt nur bestätigtes bzw. plausibles, einheitliches Gewicht,
  keine Tippfehler; jede Wiedereinstiegs-Einheit setzt die Uhr zurück; nur Einstiegswoche
  zählt auch; ganz ohne Eintrag kein Wiedereinstieg) → erste Einheit mit Gewicht ×0,9, reps_min, ohne Zusatzsatz, RPE −1 (nur Anzeige, zählt nicht; Rohwert bleibt);
  in der Erholungswoche gewinnt das Strengere (Mujika & Padilla 2000, Werte PRODUKTENTSCHEIDUNG).
- **Eigenes Gewicht:** alle Arbeitssätze gleich und anders als die Vorgabe → neuer Ausgangspunkt ohne Sprung; leichter
  bis 50 % des Zustands, schwerer bis 10 % immer, sonst nur nach bestätigter Warnung (Orts-Rundung zählt nie als eigene
  Wahl); erster Eintrag/Startgewicht über 50 kg je
  Kurzhantel bzw. 200 kg Langhantel/Maschine nur mit Bestätigung. Nie automatisch weniger Gewicht (das ist 4.1).
- **Anzeige** (`prescriptionForDisplay()`): Gewicht auf die Stufen des Orts abgerundet, Wdh.-Ziel in reps_min…reps_max + 2,
  Zusatzsatz nur außerhalb der Erholungswoche und im Rahmen der Wochensätze, erste Einheit nach großem Sprung RPE −1;
  danach die aktuellen Sicherheitsregeln (strengste gewinnt).
- **Ausdauer:** Pace/Geschwindigkeit berechnet, Plausibilitätswarnung je Art; der 10-%-Bezug des Folgeblocks zählt mit
  Tagebuch nur `min(geplant, eingetragen)` je Einheit (verwaiste Einträge nie).
- Pausentimer mit Zeitstempeln, Woche/Verlauf und Nachhol-Regel (`canCatchUp()`, Datumsfenster gleiche ISO-Woche ± 1 Tag,
  höchstens heute + 1 und heute − 14) sowie das strikte Zod-Schema für `save_session_log` liegen ebenfalls in `log/`.

### 4.1 Live-Anpassung des Plans (Premium, ohne KI)
- **Gratis:** nur die doppelte Progression aus Punkt 4 oben (alle Wiederholungen geschafft → Gewicht steigt) – **ohne** die
  Regeln dieses Abschnitts. Mess-Erinnerungen (Abschnitt 11.1) bleiben ebenfalls gratis.
- **Premium:** Plan passt sich **sofort** an, sobald neue Daten eingehen – über feste Regeln in `packages/core`, nicht über KI.
- **Auslöser:** Einheit eingetragen, Einheit verpasst, Mess-Update (Abschnitt 11.1), neue Wearable-Daten, Ziel oder Wettkampfdatum geändert.
- **Regeln** (Startwerte zentral in `constants.ts`, mit Quellenkommentar und Tests):
  - Alle Wiederholungen geschafft und Belastung niedrig → Last steigt
  - Belastung über mehrere Einheiten sehr hoch → Last oder Umfang sinkt
  - Keine Steigerung bei einer Übung über ca. 3 Wochen → Variation oder Erholungswoche
  - Weniger als ca. 70 % der Einheiten geschafft über 3 Wochen → Vorschlag, auf weniger Trainingstage umzustellen (Nutzer bestätigt)
  - Fettverlust: Taille/Bauch und Gewicht stagnieren über ca. 4 Wochen → Kalorien leicht anpassen, **immer innerhalb der Schutzgrenzen aus CLAUDE.md**
  - Muskelaufbau: Gewicht und Umfänge stagnieren, Kraft steigt nicht → Kalorien leicht erhöhen oder Volumen anpassen
  - Schlechte Tagesform aus Wearable (Readiness, Abschnitt 9) → leichtere Einheit für heute vorschlagen
- **Transparenz:** Jede Anpassung landet in `plan_adjustments` (Auslöser, Regel, vorher, nachher, bestätigt). Ansicht
  „Warum hat sich mein Plan geändert?“ in einfachen Worten aus festen Textbausteinen (keine KI). Optional (Premium-KI,
  Abschnitt 15): ausführlichere Erklärung in Worten.
- **Kleine Anpassungen automatisch**, große (weniger Trainingstage, Kalorienänderung) nur nach Bestätigung.
- Sicherheitsgrenzen (Deload, ≤10 %/Woche Ausdauer, Gesundheits-Check-Flags) gelten unverändert; Regeln, die
  Körperdaten nutzen, greifen nur mit gültiger `health_data`-Einwilligung.
- **Technik:** Neuberechnung ereignisgesteuert auf dem Server (Datenbank-Trigger bzw. Server-Funktion), Ergebnis sofort
  in der App sichtbar; offline eingetragene Daten lösen die Neuberechnung beim nächsten Sync aus. Premium-Prüfung serverseitig.

**Umsetzung ab Phase 4b (`docs/PLAN-PHASE-4B.md`, Etappe A: Core in `packages/core/src/adjust`):** Regel-Engine
`computeLiveAdjustments()` – rein, deterministisch, **ohne KI**; ohne Premium (`entitled = false`) entsteht nichts, Gratis
behält genau die Progression aus Punkt 4. Startwerte in `LIVE_ADJUSTMENT` (`constants.ts`, Quellen, PRODUKTENTSCHEIDUNG –
vor dem Livegang fachlich prüfen). Server (Etappen B/C) und App-Testmodus (Etappe D) folgen; Etappe A ändert weder
Datenbank noch App.
- **Zustands-Vorgaben** (gelten nur für den neuesten zählenden Eintrag der Übung, sonst veraltet): R1 schneller steigern
  (alle Sätze bei reps_max und jeder Satz mit RPE ≤ Ziel − 2 → Schritt schon nach einer Einheit; 10-%-Deckel und Puffer
  bleiben; nie bei vorsichtigem Plan, unter 18, ab 65, Einsteigern im ersten Block); R2 Gewicht senken (zweimal deutlich
  verfehlt → roher Zustand −10 %, Wdh. = reps_min, ohne Zusatzsatz; die Anzeige rundet auf die eigene Stufe ab, nie unter
  die kleinste; je Übung höchstens alle 14 Tage; eigenes leichteres Gewicht hat Vorrang). R2 schlägt R1. Die einzige
  Stelle, an der der Zustand sinken darf, ist `progressFromLogs(…, { stateOverride })`.
- **Plan-Änderungen nur an Einheiten ab morgen**, die noch `planned` sind und keinen Tagebuch-Eintrag haben
  (`eligiblePlannedSessions()`): R3 Kraft (3 neueste Krafteinheiten binnen 14 Tagen mit Belastung ≥ 9 → nächste Woche je
  Übung 1 Satz weniger; Erholungswoche ≤ 2 Wochen entfernt → nur Hinweis), R3 Ausdauer (2 der 3 neuesten Einträge über
  der Schwelle `enduranceOverloadThreshold(Ziel)` → nächste Woche × 0,85, Folgewochen nur gesenkt), R4 Stillstand
  (≥ 3 Einträge über ≥ 21 Tage ohne Schritt → Tausch auf eine gleichwertige, erlaubte, nicht schwerere Alternative,
  höchstens einmal je Übung und Block), R5 weniger Trainingstage (< 70 % über 3 abgeschlossene Wochen → nur Vorschlag
  mit Bestätigung). Höchstens 3 automatische Änderungen je Woche, darüber nur Hinweise.
- **Tausch-Regel „Erholungswoche vorziehen“** (R3 zweimal in Folge bzw. R4 ohne Alternative): nur wenn die geplante
  Erholungswoche D mindestens 2 Wochen nach der nächsten Woche n liegt, höchstens einmal je Block und nur, wenn alle
  Einheiten der Wochen n bis D noch unberührt sind. Woche n wird Erholungswoche (Sätze halbiert, RPE −2, Ausdauer
  floor(0,6 × laufende Woche)); die Wochen dazwischen werden in der Ausdauer neu auf +10 % gedeckelt (nur senken); die
  frühere Erholungswoche D wird Belastungswoche mit **höchstens der Dosierung der Woche davor**. Der Folgeblock zählt die
  übrigen Belastungswochen mit (`carriedLoadWeeks = trailingLoadWeeks(plan)`), damit nie mehr als 4 bzw. 5
  Belastungswochen in Folge entstehen. Im **Wettkampfplan** wird nicht getauscht (Phasen, Tapering und langer Lauf hängen
  am Makrozyklus); dort reduziert die Ausdauer-Regel nur lockere Einheiten.
- **Wochen-Invarianten** (`checkWeekInvariants()`, gleiche Prüfung später in SQL): nie mehr als L Belastungswochen in Folge
  (Woche 0 zählt nicht, Einstiegswoche zählt), Ausdauer je Belastungswoche ≤ floor(1,1 × Bezug), Erholungswochen
  reduziert, getauschte Woche nie über der Vorwoche. Jeder heute erzeugbare Plan (auch Wettkampf- und
  Körpergewichtspläne) erfüllt sie ohne Anpassung (Regressionstest).
- **Folgeblock:** `restoreTemporaryChanges()` setzt vorübergehend gekürzte Kraft-Sätze vor `baseSessionsFromBlock()`
  zurück; der Ausdauer-Bezug bleibt die tatsächlich geplante letzte Belastungswoche (vorsichtig).
- **Erklärungen** aus festen Bausteinen (`ADJUST_TEXTS_DE`), nur Zahlen, Daten und Übungsnamen, keine Aussagen über
  Körper oder Gesundheit. **Kalorien** (`calorie_adjust`) bleiben reserviert; Schutzgrenzen nur in `clampCalorieTarget`.

## 5. Tagesansicht & Trainingstagebuch

**App-Aufbau seit 18.10.2026 (`docs/PLAN-DASHBOARD.md`):** Ohne Sitzung zeigt die App den **Startbildschirm** mit zwei
Wegen – „Neu hier – Los geht's“ (Altersprüfung → Onboarding) und „Anmelden“ (E-Mail mit 6-stelligem Code, kein
Passwort, kein Google/Apple; nur mit Datenbank). Danach ist die **Übersicht** (`/uebersicht`) die Startseite: Kacheln
Training heute, Ernährung heute (kcal nur mit „Kalorienzahlen anzeigen“), Körperdaten (letztes Gewicht nur mit
Einwilligung, nie Wunschgewicht/Prognose, F13), Fortschritt und Schnellzugriffe. Die **untere Menüleiste** (Expo Router
Tabs) hat fünf Reiter: **Übersicht · Training (= „Heute“) · Ernährung · Fortschritt · Mehr**; „Mehr“ führt zu **Mein
Konto** (E-Mail, Abmelden mit Rückfrage, Einwilligungen, Datenexport, Konto löschen, Lizenzen), Einstellungen und den
übrigen Bereichen. Onboarding, Anmelden, Trainingsmodus und Unterseiten liegen ohne Leiste darüber. Daten der Kacheln:
`packages/core/src/dashboard.ts`.

- Heute: geplante Einheit mit allen Übungen, Sätzen, Wiederholungen, Zielgewicht, Pause
- Pro Übung: abhaken / nicht gemacht / tauschen (Auswahl aus gleichwertigen Alternativen, „Nur heute“ oder „Ab jetzt immer“)
- Pro Satz: Gewicht, Wiederholungen, optional RPE
- Ausdauer: Distanz, Zeit, Pace/Geschwindigkeit, Höhenmeter, Herzfrequenz (manuell oder aus Wearable) – **Herzfrequenz
  erst ab Phase 8** (Gesundheitsdatum mit eigener Einwilligungslogik, `docs/PLAN-PHASE-4.md` 3.4 S2); Phase 4 speichert
  keine Herzfrequenz, auch nicht manuell
- Belastungsempfinden der Einheit: Schieberegler 0–10
- Notizen, Pausentimer, Aufwärm- und Mobility-Block, Übungsvideos/Animationen
- In der App aufgezeichnete Strecken (Abschnitt 10.1) landen automatisch als Ausdauer-Eintrag im Tagebuch
- Offline-fähig, Sync später

**Umsetzung Phase 4 (`docs/PLAN-PHASE-4.md`, Etappen C1–D):** Trainingsmodus Kraft und Ausdauer offline (verschlüsselter
Entwurf und Tagebuch-Warteschlange), Pausentimer, Bildschirm an; **Woche** (`app/week.tsx`: Mo–So mit Status-Zeichen
und Wort – erledigt, teilweise, verpasst, gestrichen, geplant, entfallen –, Summen Einheiten/Kraft-Sätze/Ausdauer-Minuten
und -km, Blättern; nachgeholte Einheiten am tatsächlichen Datum), **Verlauf** (`app/history/`: nach Wochen, je 20 weitere,
ältere als 12 Wochen online nachladen; Verlauf je Übung mit bestem Satz „Gewicht × Wiederholungen“, keine 1RM),
**Eintrag** (`app/log/[logId].tsx`: ansehen, ändern im Datumsfenster, löschen nur online) und **Datenexport** „Meine Daten“
(seit 18.10.2026 unter „Mein Konto“; JSON aller eigenen Daten inkl. Konto-E-Mail und Einwilligungs-Verlauf; Browser: Download, App: Ordner
wählen – kein Teilen-Dialog). Regeln in `packages/core/src/log/summary.ts` und `packages/core/src/export/data-export.ts`.
Übungsvideos/Animationen und automatische Einträge aus Strecken/Wearables kommen später (Phase 8/10).

**Nachtragen und freie Einheit (`docs/PLAN-AUSWERTUNG.md` Abschnitt 4, Etappe A1b, gratis):** Im Kalender steht an jedem
Tag von heute bis 14 Tage zurück **„+ Einheit“** (ältere Tage: „Nachtragen nur bis 14 Tage zurück“; Stichtag ist die
deutsche Zeit wie in der Datenbank). Dort: **geplante Einheit nachtragen** (nur Einheiten des aktiven Plans, im
Datumsfenster der Datenbank: Woche des Termins ± 1 Tag, nie zwei geplante am Tag, gesperrte mit Grund) – sie zählt
normal, auch für die Progression – **oder freie Einheit** eintragen: Kraft mit Übungen aus der Bibliothek (höchstens 12,
nur abgehakte Sätze, Tippfehler-Schutz wie live) bzw. Ausdauer (Art aus fester Liste, Dauer, Distanz, Anstrengung).
Freie Einheiten (`session_logs.is_free`) haben keinen Planbezug, keine Vorgaben und einen Namen aus fester Liste; sie
zählen **nie** für Progression, Kalibrierung und den 10-%-Bezug der Ausdauer, wohl aber in Woche, Verlauf und – über
ihre Trainingsenergie – fürs Tagesziel (nur erhöhend, Deckel bleibt). Datumswahl im Trainingsmodus gibt es nur beim
Nachtragen vergangener Tage (kein Pausentimer); „+ Einheit“ für **heute** öffnet das normale Training (Pausentimer,
dieselben Prüfungen wie live). Woche, Verlauf, Eintrag und Kalender zeigen „nachgetragen“ (abgeleitet: an einem späteren
Tag angelegt) und „freie Einheit“. Freie Einheiten lassen sich nicht ändern, nur löschen und neu eintragen. Offline über
Entwurf und Tagebuch-Warteschlange. Hinweis: Verwaiste Einträge (Einheit gelöscht/Plan ersetzt) zählen seit Phase 4
weiter für die Kraft-Progression (Gründer-Frage G1). Regeln in `packages/core/src/log/backfill.ts` und
`free-session.ts`, Datenbank `supabase/migrations/20261015140000_free_session_logs.sql`.

**Tagesauswertung „Dein Tag“ (`docs/PLAN-AUSWERTUNG.md` Abschnitt 6, Etappe A2, gratis, ohne KI):** Route
`app/tag/[date].tsx`, erreichbar aus „Heute“, Kalender (Tippen auf den Tag) und Woche, Blättern mit ← / →. **Essen:**
Kalorienbalken mit Ist und Tagesziel („1.640 von 1.800 kcal“), Zielmarke und hell hinterlegten Zonen; Farbe nie allein
(immer Text und Zeichen). Zonen (2.1, A-G5): rot unter der Untergrenze, gelb bis zum Planband, grün im Planband (beim
Abnehmen erst ab max(Untergrenze; Ziel × 0,95), Gründer-Entscheidung 15.10.2026), gelb bis max(Obergrenze; Ziel × 1,2),
darüber rot – alle Grenzen kommen unverändert aus `nutritionTargetsForWeek`, nur der
Faktor 1,2 steht als `INTAKE_ZONES` in `constants.ts` (PRODUKTENTSCHEIDUNG, vor Livegang fachlich prüfen). **Heute**
unter dem Planband neutral „Noch offen“ (A-G6), Tage ohne Eintrag grau (nie 0 kcal, nie rot), künftige Tage nur
Tagesziel. Rot unten an vergangenen Tagen mit „Laut deinen Einträgen. Fehlt etwas? Du kannst es nachtragen.“; Texte
ruhig und essstörungssensibel (2.4). **„Kalorienzahlen aus“ und Schwangerschaft/Stillzeit:** kein Balken, keine Farbe,
keine kcal – nur „Mahlzeiten: 3 von 4 abgehakt“ (A-G8; der Typ von `intakeZone` enthält dann keine Zahl). Darunter die
Plan-Mahlzeiten mit „Gegessen“ – nur aus einem gespeicherten Essensplan (vergangene Wochen ohne gespeicherten
Plan: keine Mahlzeitenliste); künftige Tage nur Tagesziel und Plan. **Training:** Einheiten des Tages mit Status und Erfüllungsgrad (`sessionAchievement`,
2.5, A-G11): Kraft je Satz abgehakt, Wdh. ≥ `reps_min`, Gewicht ≥ Vorgabe − eine Gewichtsstufe (Halteübung ≥ 90 % der
Dauer), Ausdauer Minuten / geplante Minuten; ≥ 90 % „Ziel erreicht“, 60–89 % „Größtenteils gemacht“, 1–59 %
„Teilweise gemacht“; freie Einheiten „Gemacht“ ohne Prozent; Erholungs-/Einstiegswoche „leichter ist hier richtig“.
Ziele und Zonen werden nie gespeichert; keine neue Tabelle. Regeln in `packages/core/src/evaluation/` und
`packages/core/src/log/achievement.ts`.

**Wochenauswertung (`docs/PLAN-AUSWERTUNG.md` Abschnitt 8, Etappe A3, gratis, ohne KI):** Route
`app/wochenauswertung.tsx` (`?woche=JJJJ-MM-TT`, Mo–So), erreichbar aus „Woche“ und Kalender, Blättern wie „Woche“.
`weekEvaluation()` (`packages/core/src/evaluation/week-evaluation.ts`) setzt nur `weekLogSummary()` und
`dayEvaluation()` zusammen – die Wochenzahlen sind genau die Summe der Tagesansichten. **Essen:** sieben kleine
Tagesbalken mit Farbe, Zeichen und Kurztext (Tippen öffnet „Dein Tag“), „An 5 Tagen eingetragen. Davon 3 im
Zielbereich, …“, Durchschnitt je eingetragenem Tag gegen das Durchschnittsziel genau dieser Tage. Gezählt werden nur
vergangene Tage mit Einträgen (heute „läuft noch“, Tage ohne Eintrag zählen nicht). Keine Wochen-Bilanz in kcal, keine
Summe, keine Prognose. **Muster-Hinweis:** ab 3 vergangenen Tagen einer Woche unter der Untergrenze einmal der feste
Essstörungs-Hinweis mit Hilfe-Stellen (2.4, A-G13; `WEEK_EVALUATION.patternBelowFloorMinDays`). **„Kalorienzahlen aus“
und Schwangerschaft/Stillzeit (an einem Tag der Woche):** nur Anzahlen (Tage mit Einträgen, Mahlzeiten), keine Farbe,
nirgends kcal; ab 3 Tagen unter der Untergrenze nur der feste Hilfe-Hinweis ohne Einleitung und ohne Zahl (Schwangerschaft nie). **Training:** je Einheit Tag, Stufe und Erfüllungsgrad; Summen Einheiten
erledigt/geplant, Kraft-Sätze erfüllt/geplant, Ausdauer-Minuten gemacht/geplant, Strecke; freie Einheiten getrennt.
Einheiten zählen in der Woche ihres Termins (auch an der Wochengrenze nachgeholte, „gemacht am …“); lag schon der Essensplan unter der Untergrenze, sagt die Woche das dazu. Zustände zusätzlich „Diese Woche hat noch nicht begonnen“ und „zu alt für den Gerätespeicher“. Keine Migration.

**Übungs-Glossar (`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md`, Etappe G1, umgesetzt):** Seite „Übungen“ (`app/uebungen/`) mit
Suche (Name, andere Namen, englischer Name, Beschreibung; Umlaute und Bindestriche egal) und Filtern (Bereich,
Ausrüstung: ohne Geräte / mit meinen Geräten zu Hause / Studio mit Geräten, Schwierigkeit); Detailseite mit
Beschreibung, „So geht's“-Schritten, Tipps, häufigen Fehlern, Sicherheitshinweis, ähnlichen Übungen (erlaubt, machbar,
gleiches Muster, nicht schwerer) und Link zum eigenen Verlauf. Erreichbar über den Übungsnamen auf „Heute“, „Alle
Übungen“ (Heute/Woche/Einstellungen), aufklappbares „So geht's“ im Trainingsmodus (ohne den Bildschirm zu verlassen),
Verlauf je Übung und Eintrag (auch archivierte Übungen). Nur Text aus den vorhandenen Feldern – Bilder/Videos folgen
(G2). Ist eine Übung nach den aktuellen Sicherheitsregeln nicht für den Plan vorgesehen, steht nur ein neutraler Satz
ohne Grund da. Entwürfe tragen im Testmodus „Testinhalt – noch nicht fachlich geprüft“; live nur freigegebene Inhalte.

**Übungen tauschen (`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md`, Etappen T1/T2, im Testmodus umgesetzt; Supabase folgt mit
T3):** „Tauschen“ an jeder Übung einer geplanten Kraft-Einheit auf „Heute“ (auch für andere Tage über die
Wochenübersicht) und im Trainingsmodus (ersetzt „Alternative durchgeführt“). Der Dialog zeigt nur gleichwertige oder
leichtere Übungen mit gleichem Bewegungsmuster, geprüft gegen die aktuellen Sicherheitsregeln **und** die Untergrenze
des laufenden Plans (`displaySwapRules`; Lockerungen öffnen erst nach „Plan neu erstellen“). Dauer: **„Nur heute“**
(bzw. „Nur bei diesem Training“; vor dem Training als Gerätedaten `fitnessapp.day-swaps.v1`, im Training im Entwurf)
oder **„Ab jetzt immer – zu Hause / im Studio“** mit Grund „Mag ich nicht“ oder „Hier nicht machbar“ (kein Freitext,
kein Gesundheitsgrund; bei unklarem Ort fragt die App nach). „Immer“ wirkt als Schicht beim Anzeigen in allen Einheiten,
Folgeblöcken, neuen Plänen und im PDF – der gespeicherte Plan bleibt unverändert. Kennzeichen: „heute getauscht“ bzw.
„getauscht (deine Wahl)“ – auch wenn vorher ein Sicherheits-Ersatz stand (die angezeigte Übung ist dann die Wahl der
Person); ein reiner Sicherheits-Ersatz heißt weiter „angepasst an deine aktuellen Angaben“. „Rückgängig“ ohne Zeitlimit,
Verwaltung unter Einstellungen → „Ausgeschlossene Übungen“ (Wieder zulassen; nicht mehr angebotene Übungen „nicht mehr
verfügbar“ + Entfernen). Entfällt eine „hier nicht machbare“ Übung mangels Alternative, steht ein neutraler Hinweis da –
nie „Plan neu erstellen“. Präferenzen sind im Datenexport (Testmodus) enthalten; „Nur heute“-Tausche als Gerätedaten
nicht.
Regeln in `packages/core/src/content/glossary.ts`, Grenzen in `GLOSSARY_LIMITS`.

## 6. Ernährungs-Engine (`packages/core/nutrition`)
- Grundumsatz: Mifflin-St Jeor (bzw. Katch-McArdle, wenn Körperfett bekannt)
- Gesamtumsatz: Grundumsatz × Alltagsfaktor + Trainingsenergie der geplanten Einheiten (tagesgenau)
- Zielanpassung: Defizit/Überschuss je Ziel, mit Schutzgrenzen aus CLAUDE.md. Seit Ziele Z1/Z2 aus dem **Ziel-Profil**
  (Haupt- + Nebenziel, `GOAL_PAIR_RULES`; Energie-Richtung aus dem Vorzeichen). Ein konkretes Abnehmziel kann das
  Defizit nur **verkleinern** (geplantes Tempo = min(benötigt, Standard), danach immer `clampCalorieTarget`); erreicht →
  Erhalt bis zur Wahl, Zeitraum vorbei → Standard-Tempo und Angebot „Verlängern“ (nie automatisch). Ein neues,
  geändertes, erreichtes, abgelaufenes oder entferntes Ziel plant den Essensplan ab heute automatisch neu (Z5); eine neue
  Gewichtsangabe bei unverändertem Ziel nur, wenn ein Tag aus dem Planband fällt. Hinweise
  dazu nur einmal je Woche in der Ernährungs-Übersicht der Woche (Wächter K10), nie im Trainings- oder Ernährungs-PDF.
- Makros: Eiweiß nach g/kg je Ziel; Kohlenhydrate bei Ausdauer an Trainingslast periodisiert; Rest Fett (Mindestmenge einhalten)
- Timing: Mahlzeit vor dem Training (2–3 h vorher) bzw. Snack (30–60 min vorher), Mahlzeit nach dem Training mit Eiweiß + Kohlenhydraten; an Tagen mit langen Einheiten Verpflegung während des Trainings
- Wettkampf: Carb-Loading-Tage, Frühstück am Wettkampftag, Gel-/Trinkplan
- Plan-Erzeugung: Rezepte aus Datenbank filtern (Vorlieben, Ernährungsform, Kochmodus) → Optimierung auf Tagesmakros (Portionsgrößen skalieren) → Wochenplan
- Einkaufsliste: aggregiert, nach Supermarkt-Abteilung sortiert, abhakbar, Meal-Prep-Mengen
- Lebensmittel tauschen (Zutaten-Austausch, Abschnitt 6.9), Barcode-Scanner (Open Food Facts; Lizenz beachten, Abschnitt 6.1)
- Rezepte, Küche und Einkauf aus den Erweiterungen Teil 2: Abschnitte 6.5–6.13

**Umsetzung ab Phase 5 (`docs/PLAN-PHASE-5.md`, Etappe N1: Core in `packages/core/src/nutrition`):** Grundumsatz
Mifflin-St Jeor (divers/keine Angabe −78) bzw. Katch-McArdle nur mit Körperfett ≤ 90 Tage und **nur für den Vorschlag**;
alle Schutzgrenzen rechnen mit `TagesbedarfGrenze = max(Mifflin, Katch) × Alltagsfaktor + Trainingsenergie`
(bei divers/keine Angabe für die Grenzen Mifflin mit +5 und FFM nach der Männer-Formel – sichere Richtung).
Alltagsfaktor **ohne Sport** (Mitte der D-A-CH-Spannen 1,45/1,65/1,85/2,2, ohne Angabe 1,45), Trainingsenergie netto
(MET − 1) × kg × h tagesgenau aus aktivem und ersetztem Plan (Deckel 3.000 kcal → Tag ohne Defizit). Zielanpassung vom
Grundbedarf ohne Training. `clampCalorieTarget` ist die einzige Stelle mit Schutzgrenzen (Grundumsatz, 25 %, ~1 %/Woche,
Energieverfügbarkeit ≥ 30 kcal/kg FFM mit brutto-Trainingsenergie, Obergrenze in jedem Modus, gerichtete Rundung auf
10 kcal, Planband ±10 %); `clampCalorieAdjustment` (für 4b) begrenzt nur Schritt (≤ 150) und Summe (±1.000) des
Versatzes. Sonderfälle je Tag: `no_targets` (keine Einwilligung, keine Größe/kein Gewicht, Schwangerschaft/Stillzeit),
`maintenance_only` (unter 18 bzw. Untergewicht bei Fettverlust/Definition, kein Check bei Geschlecht ≠ männlich),
Deckel 15 % (kein Check, Medikamente/Arzt-Hinweis, ab 65) bzw. 10 % (BMI 18,5–20). Makros Eiweiß → Fett → Kohlenhydrate
(Rest, Energie verbindlich), Timing vor/nach dem Training über die Angabe „Trainingszeit“. Abweichungen: Tabelle in
`docs/PLAN-PHASE-5.md` Abschnitt 17.
**Essensplan (Etappe N3, Core):** Rezepte filtert eine einzige Funktion (`filter.ts`: Ernährungsform, Schwein nur bei
„isst Schwein = ja“, Unverträglichkeiten, „mag ich nicht“, Schwangerschaft inkl. ungegarter Zutaten; optionale Zutaten
weglassen, Ersatzprodukte mit erneutem Filter). Der Wochenplan skaliert Portionen (0,5–2,0) so, dass jeder Tag im
Planband liegt – sonst bis zu 2 Ergänzungs-Snacks bzw. „unvollständiger Vorschlag“ (`below_floor`); über der
Obergrenze wird nie ausgeliefert. Meal-Prep hält die Haltbarkeit der tatsächlich verwendeten Zutaten ein (sonst
einfrieren oder frisch kochen); Meal-Prep-Wochenpläne werden nur angeboten, wenn jedes Rezept den kompletten Filter
besteht. Einkaufsliste nach Abteilungen, Mengen aufgerundet, Häkchen bleiben bei Neuplanung erhalten.

### 6.1 Lebensmittel-Tracker mit Barcode-Scan (Gratis)
- Scan über die Handykamera, Abfrage bei **Open Food Facts**; Ergebnis in `food_products` zwischenspeichern
- **Lizenz ODbL:** Quellenangabe „Daten von Open Food Facts (ODbL)“ sichtbar in der App (Produktansicht und Impressum/Lizenzen)
- Nicht gefunden: manuell anlegen (Name, Marke, kcal, Eiweiß, Kohlenhydrate, Fett pro 100 g) – nur für den eigenen Nutzer sichtbar
- Menge eingeben (g, Stück, Portion), Zuordnung zu Mahlzeit: Frühstück, Mittag, Abend, Snack, vor/nach Training
- Tagesübersicht: Ziel aus der Ernährungs-Engine gegen tatsächlich Gegessenes
- „Zuletzt gegessen“ und Favoriten für schnelles Eintragen
- **Umgesetzt als Etappe E1 (15.10.2026, ohne Barcode – der kommt als E4; `docs/PLAN-AUSWERTUNG.md` Abschnitt 5 und
  Umsetzungsstand E1):** Ernährungstagebuch (gratis, ohne KI) mit „Gegessen“ per Tipp an der Plan-Mahlzeit (Portion
  ½ bis 2), Lebensmittel aus dem Katalog (g, ml, Stück), Rezept mit Portionen, Schnelleintrag (feste Bezeichnungen, kcal
  optional, Makros optional), „Zuletzt“ (20 verschiedene) und Favoriten; Bearbeiten, Löschen, Nachtragen bis 14 Tage,
  nie in die Zukunft; Rückfrage ab 1.500 kcal je Eintrag. Gruppen: Frühstück, Hauptmahlzeit, Mittag, Abend, Snack
  („vor/nach Training“ steht an der Plan-Mahlzeit). „Kalorienzahlen aus“: Eintragen geht weiter, ohne kcal-Anzeige und
  ohne kcal-Feld. Nur mit Einwilligung `health_data` (vorsorglich Art. 9); der Widerruf löscht die Einträge und die
  Schnell-Favoriten, Favoriten aus Lebensmitteln/Rezepten (ohne Werte gespeichert) bleiben. Grenzen `FOOD_LOG_LIMITS` in `constants.ts`, Logik `packages/core/src/nutrition/food-log.ts`, Datenbank
  `food_log_entries`/`food_log_favorites` mit `save_food_log_entries`/`delete_food_log_entry`. Testmodus und
  Supabase-Modus (N7 Teil 2, offline über eine verschlüsselte Warteschlange) fertig. Die Tagesübersicht „Ziel gegen Gegessenes“ (Kalorienbalken) kommt mit A2.

- **Tagesauswertung (Etappe A2, 15.10.2026):** Der Kalorienbalken „Dein Tag“ baut auf dem Tagebuch auf (Abschnitt 5,
  „Tagesauswertung“); bei „Kalorienzahlen aus“ und in Schwangerschaft/Stillzeit ohne Balken, nur die Mahlzeiten-Anzahl.
- **Wochenauswertung (Etappe A3, 15.10.2026):** Tagesbalken der Woche, Durchschnitt je eingetragenem Tag (keine
  Wochen-Bilanz), Muster-Hinweis ab 3 Tagen unter der Untergrenze (Abschnitt 5, „Wochenauswertung“).
- **Produkt per Barcode-Nummer (Etappe E4a, 17.10.2026, `docs/PLAN-E4.md` Umsetzungsstand E4a):** Ernährung →
  Eintragen → „Produkt (Barcode)“: Nummer unter dem Strichcode eintippen (Prüfziffer, Laden-/Waagencodes → Suche);
  Abfrage nur über unseren Server (`POST /api/ernaehrung/produkt`, Login + Einwilligung `health_data`, an Open Food
  Facts geht nur die Nummer); gemeinsamer Zwischenspeicher `food_products` ohne Personenbezug (30 Tage frisch, nach 90
  Tagen gelöscht); je Person 60 Abfragen pro Stunde und 200 pro Tag, insgesamt 10 pro Minute. Zweistufige Prüfung im
  Core (`food-product.ts`: „Werte prüfen“ mit Pflicht-Haken bzw. „unbrauchbar“), Menge in g/ml mit Portion/Packung,
  Herkunft `product` – Werte rechnet der Server aus dem Speicher nach. Marke nur in der Produktansicht, „Zuletzt“ und
  Favoriten. Keine Produktbilder, kein Nutri-Score. Quellenangabe „Open Food Facts, ODbL 1.0“ in der Produktansicht,
  Seite „Lizenzen und Quellen“ (App und Website). Unbekannt/unbrauchbar → **eigenes Produkt** (Abschnitt 6.2). Noch ohne
  Kamera (E4b, neuer Build). Feature-Flag `food_product_lookup` (Standard aus) und Vercel-Variable `OFF_CONTACT_EMAIL`
  (SETUP Teil M).

### 6.2 Standardgerichte (Gratis)
- Eigene Gerichte anlegen („Mein Porridge“, „Shake nach dem Training“) mit kcal und Makros – direkt eingegeben oder aus Zutaten berechnet
- Mit einem Tipp ins Tagebuch, Portion anpassbar
- **Umgesetzt als Etappe E2 (15.10.2026, `docs/PLAN-AUSWERTUNG.md` Abschnitt 7 und Umsetzungsstand E2):** Ernährung →
  „Eigene Gerichte“ (Liste, Anlegen, Ändern, Löschen); Name bis 60 Zeichen; entweder Werte je Portion direkt (kcal,
  Makros optional; Rückfrage, wenn die Makros mehr als 20 % von den kcal abweichen) oder aus 1–30 Zutaten des Katalogs
  (g, ml, Stück) + 1–20 Portionen, berechnet mit derselben Rechnung wie Rezepte. Eintragen im Tagesverlauf und unter
  „Favoriten“/„Zuletzt“ mit Portion ¼ bis 3. Im Tagebuch steht ein Schnappschuss der Werte mit dem festen Titel
  „Eigenes Gericht“ und einem Verweis (der Name wird nur angezeigt): Ändern oder Löschen des Gerichts ändert
  eingetragene Tage nicht. Höchstens 100 Gerichte. „Kalorienzahlen aus“: nur aus Zutaten (Werte im Hintergrund) oder
  ohne Werte, nirgends kcal. Datenschutz: Der Name ist Freitext – nur mit Einwilligung `health_data`, beim Widerruf
  gelöscht (Gründer-Entscheidung E2-G1, 15.10.2026), im Export, Konto löschen per Kaskade, nie in Logs,
  Fehlermeldungen oder testIDs. Logik `packages/core/src/nutrition/custom-meal.ts`, Grenzen `CUSTOM_MEAL_LIMITS`,
  Datenbank `custom_meals`/`custom_meal_items` mit `save_custom_meal`/`delete_custom_meal`; die Werte aus Zutaten und die Werte der Tagebuch-Einträge (Lebensmittel, Rezept, eigenes Gericht) rechnet der Server mit derselben Rechnung nach (Entscheidung E1-G4/E2-G2). Testmodus und Supabase-Modus (N7 Teil 2) fertig.
- **Eigene Produkte (Etappe E4a, 17.10.2026):** Ernährung → Eigene Gerichte → „Eigene Produkte“ bzw. direkt aus der
  Produktabfrage („Eigenes Produkt anlegen“, aus Open Food Facts vorausgefüllt): Name (bis 60), Marke und Nummer
  freiwillig, Werte je 100 g bzw. 100 ml (kcal 0–900, Eiweiß/Kohlenhydrate/Fett Pflicht, Zucker/Salz/Portion
  freiwillig), Rückfrage, wenn Energie und Makros nicht zusammenpassen. Höchstens 200, nur für die Person, gehen der
  Abfrage vor (auch offline). Im Tagebuch fester Titel „Eigenes Produkt“ + Verweis (wie eigene Gerichte). Nicht bei
  „Kalorienzahlen aus“ (Gründer-Entscheidung E4-G8). Widerruf `health_data` löscht eigene Produkte und
  Produkt-Favoriten (E4-G10), im Export, Konto löschen per Kaskade. Datenbank `user_food_products` mit
  `save_user_food_product`/`delete_user_food_product`.

### 6.3 Gerichte vor, während und nach dem Training (Premium, ohne KI)
- Für **jede geplante Einheit** berechnet die Ernährungs-Engine **Zielmengen** (kcal, Eiweiß, Kohlenhydrate, Fett, bei
  langen Einheiten Flüssigkeit) und Zeitfenster – abhängig von Art, Dauer und Intensität der Einheit sowie Körpergewicht und Ziel:
  - größere Mahlzeit ca. 2–3 Stunden vorher
  - kleiner Snack ca. 30–60 Minuten vorher (optional)
  - Mahlzeit nach dem Training innerhalb von ca. 1–2 Stunden
  - bei langen Ausdauereinheiten zusätzlich Verpflegung **während** der Einheit
- Pro Zeitfenster **2–3 konkrete Vorschläge** aus der freigegebenen Rezeptdatenbank, jeweils mit Mengen und Nährwerten.
  Die Portion wird auf die Zielmenge skaliert (Abweichung höchstens **±10 %**, Toleranz in `constants.ts`).
- Gefiltert nach Ernährungsform, Schwein ja/nein, Vorlieben, Abneigungen, Unverträglichkeiten und Kochmodus.
- Immer eine **schnelle Alternative ohne Kochen** (z. B. Shake, Banane mit Quark).
- Sonderfall **Training früh morgens**: kleiner, leicht verdaulicher Vorschlag oder Fokus auf die Mahlzeit danach.
- **Push-Erinnerung** zum richtigen Zeitpunkt („In 2 Stunden ist Training – Zeit für …“), abschaltbar.
- **„Gegessen“ per Tipp** trägt den Vorschlag direkt ins Ernährungstagebuch (`food_log_entries`) ein.
- Rezepte kommen aus der Content-Pipeline (Abschnitt 3) mit Tag `vor_training` / `waehrend` / `nach_training`.
- **Offene Entscheidung (in Phase 5 treffen):** Vorschläge mit konkreten Marken (z. B. bestimmter Riegel) oder nur mit
  Produktarten („Haferriegel“)? Marken wären werbeähnlich und müssten herstellerneutral bzw. gekennzeichnet sein.
  → Entschieden in Phase 5 (`docs/PLAN-PHASE-5.md` 16 A, Nr. 18): **nur Produktarten**.
- **Abgrenzung zu den Erweiterungen Teil 2 (Abschnitt 6.6):** Bedarf, Zeitfenster und Timing-Hinweise sind gratis
  (Phase-5-Entscheidung 1); gratis ist auch das **selbst Suchen** in den Kategorien Pre-Workout, Post-Workout und
  Cardio & Ausdauer. **Premium** ist das, was dieser Abschnitt beschreibt: die **automatische Belegung** jeder
  geplanten Einheit mit passenden, skalierten Rezepten samt Erinnerung („Rezepte automatisch passend zu jeder
  Trainingseinheit“ in Abschnitt 13).

### 6.4 Kalorien per Foto (Premium, KI)
- Foto der Mahlzeit → KI-API (Gemini, Gründer-Entscheidung 14.10.2026) mit Bildeingabe schätzt Lebensmittel und
  Portionen → Abgleich mit Lebensmitteldatenbank
- Ergebnis immer als **Vorschlag**: Nutzer bestätigt oder korrigiert Lebensmittel und Mengen, erst dann wird eingetragen
- Sichtbarer Hinweis, dass es sich um eine **Schätzung** handelt
- Foto standardmäßig **nach der Auswertung löschen**; speichern nur, wenn der Nutzer es aktiv möchte
- Foto und Schätzung gelten als Gesundheitsdaten → **eigene Einwilligung** (inkl. Hinweis auf Verarbeitung durch den KI-Anbieter)
- Tages- und Monatslimit über `ai_usage` (Abschnitt 15)
- **Umgesetzt als Testversion (Etappe E3, 16.10.2026, `docs/PLAN-AUSWERTUNG.md` Umsetzungsstand E3):** ganze Kette
  (Einwilligung `ai_food_photo`, Beta-Freischaltung + Feature-Flag serverseitig, Limit 8/Tag und 30/Monat atomar,
  Bildprüfung mit EXIF-Entfernung, Prompt-Injection-Schutz, Abgleich mit dem Katalog im Core, Eintragen mit Herkunft
  `photo`); es antwortet standardmäßig eine **Attrappe**. Der Gemini-Adapter ist vorbereitet und nur mit
  `FOOD_PHOTO_PROVIDER=gemini` **und** `GEMINI_API_KEY` aktiv. Das Foto wird **nie gespeichert** (A-G18, kein Bucket).

### 6.5 Rezepte in der App (Gratis)
Quelle: `docs/ERWEITERUNGEN-2.md` Abschnitte 1–2. Startbestand aus `alpha5-rezepte.json` (Abschnitt 3).
- **Kategorien:** 4 Ernährungsformen (vegan, vegetarisch, mit Fleisch, ohne Schweinefleisch) und 8 Themen: Fertig in
  10 Minuten, Pre-Workout, Post-Workout, Cardio & Ausdauer, Wettkampftag, Meal-Prep-Wochenpläne, Protein-Desserts,
  Spar-Küche. Ein Rezept kann in mehreren Themen stehen (n:m).
- **Ernährungsform „passt für“:** Ein Rezept passt für alle Gruppen, deren Regeln es erfüllt (vegan → alle vier,
  vegetarisch → vegetarisch und beide Fleisch-Gruppen, ohne Schwein → beide Fleisch-Gruppen). Gefiltert wird **immer
  über die Ernährungsform, die der Core aus den Zutaten berechnet**, nie über die Themen-Kategorie und nie allein über
  die Angabe in der Gründer-Datei (die dient nur als Gegencheck, siehe Abschnitt 18).
- **Rezeptsuche mit Filtern:** Ernährungsform (aus dem Profil vorbelegt, erweiterbar – sie ist eine Vorliebe), Kategorie, Mahlzeit/Zeitpunkt (Abschnitt,
  z. B. Frühstück oder „60–90 Min. vorher“), „Unter 10 Minuten“, max. Kosten (nur Rezepte mit Kostenschätzung, 6.13),
  Vorlieben/Abneigungen und Unverträglichkeiten aus dem Profil. Ausschlüsse (Unverträglichkeit, „mag ich nicht“,
  Schwein, Schwangerschafts-Vorsicht) wirken in der Suche genauso hart wie im Essensplan.
- **Rezeptansicht mit Portionswähler:** Mengen und Nährwerte werden für die gewählte Portionenzahl umgerechnet;
  Meal-Prep-Rezepte (meist 5 Portionen) zeigen Gesamtmenge **und** Menge pro Portion. Die Einkaufsliste daraus ist
  abhakbar (Abschnitt 6).

### 6.6 Trainingsbezug und Wettkampftage
- **Gratis:** Bedarf, Zeitfenster und Timing-Hinweise vor/nach dem Training (Phase 5), Rezeptsuche in den Kategorien
  Pre-Workout, Post-Workout und Cardio & Ausdauer, Ratgeber (6.8).
- **Premium (ohne KI, = Abschnitt 6.3):** Die Ernährungs-Engine belegt automatisch vor jeder geplanten Einheit
  Rezepte aus *Pre-Workout*, danach aus *Post-Workout*; bei Ausdauereinheiten **ab 75 Minuten** aus *Cardio &
  Ausdauer* inklusive Verpflegung unterwegs.
- **Wettkampftage (mit Phase 10):** Steht ein Wettkampf im Kalender, werden die Tage davor mit *Wettkampftag*-Rezepten
  geplant; **Carb-Loading nur bei Wettkämpfen ab ca. 90 Minuten**. Bis Phase 10 sind die Wettkampf-Rezepte nur über
  die Suche und den Ratgeber erreichbar, nicht im automatischen Plan.
- **Schutzgrenzen gelten immer:** An Carb-Loading-Tagen (1–2 Tage vor dem Wettkampf) wird statt eines Defizits auf
  **Erhalt** geplant; zusätzlich verschieben sich die Makros zu mehr Kohlenhydraten. Beides läuft als Eingabe durch die
  zentrale Begrenzung `clampCalorieTarget` (Phase 5) – nie an den Kalorien-Schutzgrenzen aus CLAUDE.md vorbei; eine
  Live-Anpassung (4.1) wirkt an diesen Tagen nicht. Fett bleibt bei mindestens 20 % der Energie. Im Modus ohne Kalorienziel (z. B. Schwangerschaft)
  nur allgemeine Hinweise.

### 6.7 Meal-Prep-Modus (1 Plan gratis, alle Pläne Premium)
- Ablauf: Plan wählen → Einkaufsliste → **Kochtag-Ansicht** mit Schritt-für-Schritt-Ablauf und **Timern** nach den
  Startminuten → Wochenplan Mo–Fr wird automatisch belegt; das **Abendessen bleibt frei** für frische Rezepte.
- **Harte Filter gelten auch hier:** Jedes Rezept eines Plans läuft durch den kompletten Filter (Allergene,
  Unverträglichkeiten, Ernährungsform, Schwein, „mag ich nicht“, Schwangerschafts-Vorsicht). Passt auch nur ein Rezept
  nicht, wird der Plan dieser Person **nicht angeboten** („Passt nicht zu deinen Angaben“, ohne Grund zu nennen).
- Der Schalter „Kalorienzahlen ausblenden“ gilt hier und in allen Ansichten aus 6.5–6.13.
- Aufbewahrung und Haltbarkeit folgen **immer** den Regeln aus Phase 5 (Haltbarkeit je Lebensmittel, z. B. gekochter
  Reis, Fisch, Hackfleisch, Geflügel höchstens 1 Tag im Kühlschrank, sonst einfrieren oder frisch kochen) – auch wenn
  der Text eines Plans etwas anderes sagt (Abschnitt 18).
- Start mit 4 Plänen (je Ernährungsform einer). Welcher Plan gratis ist, wird mit Phase 7 festgelegt (Vorschlag: der
  erste Plan, der den kompletten Filter besteht; besteht keiner, gibt es keinen); in der Testphase sind alle offen.

### 6.8 Ratgeber (Gratis, offline)
- Lesbare Seiten **„Wettkampf-Ernährung“** (8 Abschnitte) und **„Unterwegs essen“** (Grundregeln + 10 Orte), mit der
  App gebündelt und **offline** verfügbar.
- Der Wettkampf-Ratgeber trägt beim Carb-Loading den festen Hinweis „Im Kaloriendefizit, unter 18 Jahren oder in der
  Schwangerschaft nicht ohne fachliche Absprache.“; Mengenangaben wie g/kg prüft die Fachkraft.
- Texte laufen durch dieselben Textregeln wie Rezepte (keine Heil- und Nährwertversprechen, Health-Claims-Verordnung)
  und durch die Fachprüfung vor dem Livegang.

### 6.9 Zutaten-Austausch (Gratis, ohne KI)
- Zutat antippen → „Austauschen“ → Liste passender Alternativen → Nährwerte und Einkaufsliste werden neu berechnet.
- Datenbasis: Tabelle `ingredient_substitutions` (Zutat, Ersatz, Faktor, Rolle, Hinweis). Rolle = Eiweiß,
  Kohlenhydrat, Fett, Gemüse, Würze, Süße; der Faktor hält die Hauptrolle gleich (z. B. Eiweißmenge bei Eiweißquellen).
- **Nur sichere Alternativen:** Jede Alternative durchläuft den kompletten Filter aus Phase 5 (Ernährungsform,
  Schwein, Unverträglichkeiten, „mag ich nicht“, Schwangerschafts-Vorsicht, Allergen-Regeln) – wie die festen
  Ersatz-Zutaten. Wird eine Zutat durch Ei, Fisch, Fleisch o. Ä. ersetzt, gilt sie als **ungegart**, bis es anders
  feststeht (sichere Richtung bei Schwangerschaft). Der Tag wird danach erneut gegen die Kalorien-Schutzgrenzen
  (Unter- **und** Obergrenze) geprüft; passt er nicht, wird der Tausch nicht angeboten.
- **Haltbarkeit:** Nach dem Tausch wird die Haltbarkeit neu berechnet und der Meal-Prep-Zeitplan angepasst (einfrieren
  oder frisch kochen); für schon vorgekochte Portionen wird kein Tausch angeboten.
- Der Server prüft getauschte Zutaten beim Speichern erneut (ab Supabase-Etappe).
- Die Austausch-Tabelle entsteht **offline** über die Content-Pipeline (Batch-API, seit N8 Gemini), wird gegen ein Schema
  geprüft und im Admin-Bereich freigegeben – keine Echtzeit-KI.
- **Umsetzung (Etappe N9, Testmodus, 14.10.2026):** Tabelle `content/substitutions/` (Regel R23, Batch-Art
  `ingredient-substitutions`, Freigabe über `content-review`), Regeln in `packages/core/src/nutrition/substitute.ts`
  (Filter nach dem Tausch, R11, Planband, Haltbarkeit, Kochtag), Dialog „Zutat austauschen“ in der Rezeptansicht des
  Essensplans; Details und Präzisierungen in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N9.

### 6.10 Bewertung nach dem Essen (Gratis, ohne KI, privat)
- Nach einer geplanten Mahlzeit: Daumen hoch/runter, optional Grund: „Schmeckt mir nicht“, „Zu aufwendig“,
  „Zu teuer“, „Macht nicht satt“, „Unverträglich“.
- Feste Regeln: Daumen hoch → häufiger vorschlagen; Daumen runter → 8 Wochen nicht mehr vorschlagen; „Unverträglich“ →
  App bietet an, einzelne Zutaten als Abneigung („mag ich nicht“, je Lebensmittel) ins Profil zu übernehmen – einzeln
  auswählbar, **nichts vorausgewählt**, der Nutzer bestätigt; „Zu aufwendig“ → mehr Rezepte unter 15 Minuten; „Macht
  nicht satt“ / „Zu teuer“ → nur andere Reihenfolge der Vorschläge. Kein Grund ändert Energie, Portionen oder Grenzen.
- Tabelle `recipe_ratings` (user_id, recipe_id, Wert, Grund, Datum) mit RLS. Bewertungen sind **privat**, werden nie
  angezeigt oder ausgewertet (keine Community, keine Durchschnittsnoten), sind in Export und Löschung enthalten.
- „Unverträglich“ ist ein Gesundheitsbezug (Art. 9): wird **nicht** als Grund gespeichert, sondern führt nur zum
  Bestätigungs-Dialog (Abschnitt 18).
- **Umsetzung (Etappe N10, Testmodus, 14.10.2026):** Regeln in `packages/core/src/nutrition/ratings.ts` (8 Wochen =
  Bewertungstag + 55 Tage, Gründe wirken im selben Zeitraum, nur Reihenfolge), `food_dislikes` hart in `filter.ts`;
  „Wie war’s?“ in der Rezeptansicht des Essensplans, Bildschirm „Daumen runter“ mit Dialog ohne Vorauswahl,
  Einstellungen „Abgelehnte Lebensmittel und Bewertungen“. Eine Bewertung plant den laufenden Plan nicht um; sie wirkt
  ab der nächsten Planung. Details in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N10.

### 6.11 Resteverwertung (Kühlschrank-Suche gratis, automatische Resteplanung Premium)
- **Kühlschrank-Suche (Gratis):** „Was habe ich da?“ – Zutaten auswählen → Rezepte sortiert nach Übereinstimmung
  (Anteil der vorhandenen Zutaten, gewichtet nach Menge), gefiltert nach Ernährungsform und allen Ausschlüssen.
  Die Auswahl wird nicht dauerhaft gespeichert.
- **Packungsgrößen:** Feld Packungsgröße bei den Zutaten (übliche Handelsgröße, z. B. Brokkoli 500 g, Quark 500 g),
  über die Content-Pipeline vorgeschlagen und im Admin freigegeben.
- **Automatische Resteplanung (Premium):** Die Einkaufsliste rundet auf Packungen auf; was übrig bleibt, erhöht den
  Score von Rezepten, die diese Zutat verbrauchen (frische Zutaten mit kurzer Haltbarkeit zuerst; angebrochenes rohes
  Fleisch, Fisch oder Rohmilch zählt nur für den Folgetag). Anzeige: „Dieses
  Rezept verbraucht deinen restlichen Brokkoli.“ Regel-Engine in `packages/core` (`nutrition/leftovers.ts`) mit Tests.
  Der Reste-Score ändert nur die Reihenfolge der Kandidaten, nie die Filter oder Schutzgrenzen.
- **Umsetzung (Etappe N11, Testmodus, 14.10.2026):** Kühlschrank-Suche „Was habe ich da?“ in
  `packages/core/src/nutrition/fridge-search.ts` – zuerst dieselben harten Filter wie die Rezeptsuche (Ernährungsform
  des Profils, nicht erweiterbar), danach Übereinstimmung nach Menge in Gramm (Vorrat und Gewürze zählen ein
  Zehntel, optionale Zutaten gar nicht), Gewürze allein ergeben keinen Treffer, stabile Sortierung; Auswahl nur im
  Zustand der Ansicht. Packungsgrößen als eigene Inhaltsart `content/package-sizes/` (Regel R24, 1–5.000 g, Batch-Art
  `package-sizes`, Freigabe über `content-review`, Admin „Packungen“), weil `content/foods/` nur der Lebensmittel-Import
  schreiben darf; mit N7 werden sie zur Spalte an `foods`. Details in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N11.
- **Umsetzung (Etappe N13, nur Logik in `packages/core`, 14.10.2026):** `nutrition/leftovers.ts` rundet die
  Einkaufsliste mit den Packungsgrößen aus N11 auf Packungen auf (`shoppingListPackages`: angebrochene Packungen und
  Rest je Zutat; Zutaten ohne Packungsgröße bleiben ohne Aufrundung) und verfolgt angebrochene Packungen über die Woche.
  Ein roher Rest von Fleisch, Fisch, Krebs-/Weichtieren oder Rohmilch (und empfindliche Lebensmittel wie rohe
  Sprossen) zählt nur bis zum Folgetag (danach Hinweis
  „einfrieren“), übrige Reste nach festen Tagen je Supermarkt-Abteilung (`LEFTOVER_RAW_DAYS`, VOR LIVEGANG FACHLICH
  PRÜFEN); ein abgelaufener Rest wird nie eingeplant, dann zählt eine neue Packung. Der Reste-Score (Menge des
  verbrauchten Rests ÷ Packung × Dringlichkeit, Vorrat zählt nicht, höchstens 1 Punkt – weniger als der Abzug für eine
  Wiederholung) ändert im Essensplan nur die Reihenfolge der Kandidaten; eingeschaltet wird er erst in N14 (Premium).
  Details in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N13.
- **Umsetzung (Etappe N14, Testmodus, nur der sichere Teil, 14.10.2026):** Der Wochenplan nutzt den Reste-Score,
  sobald es Packungsgrößen gibt (neue Pläne, „Andere Vorschläge“, „Plan aktualisieren“, automatische Neuplanung –
  gespeicherte Pläne bleiben). An der Mahlzeit steht „Nutzt deinen Rest: Tofu (seit Mo)“ (`leftoverMealHints`): nur
  Reste aus einer an einem früheren Tag angebrochenen Packung, nie abgelaufene, nie Vorrat, nicht an vorgekochten
  Meal-Prep-Portionen (Verbuchung zeitlich nach Kochtag); bei kurz haltbaren Resten (roh tierisch, Rohmilchkäse,
  Sprossen, Kochschinken) der neutrale Satz „nur bis zum Folgetag … gut gekühlt lagern“; Hinweis auch im Vorlesetext; ungeprüfte
  Packungsgrößen als „Testwert“ gekennzeichnet. **Bewusst nicht angezeigt:** Packungszahl, Restmenge und „übrig am
  Ende/einfrieren“ in Einkaufsliste und Plan – sie hängen an den offenen Gründer-Fragen G-N13-4 (Rest-Tage je
  Untergruppe, z. B. Hartkäse, Butter, Öl, Rohwurst) und N11-G3 (Packung bei Stückware) und wären bis dahin
  irreführend (z. B. Parmesan 3 × 20 g → 3 Packungen). Premium-Prüfung serverseitig mit Phase 7; Testphase offen.
  Details in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N14.

### 6.12 Paar-Modus beim Kochen (Premium, braucht den Partner-Modus)
- Baut auf dem **Partner-Modus** auf (Abschnitt 11, beidseitige Zustimmung) – die Oberfläche kommt deshalb erst mit
  Phase 11; die Rechenlogik vorher.
- **Eigener, einzeln freigegebener Bereich „Gemeinsam kochen“:** Jede Person willigt ausdrücklich ein (Gesundheitsdaten,
  Art. 9 DSGVO), mit dem Hinweis „Deine Portionsgrößen und die Rezeptauswahl lassen Rückschlüsse auf deinen Bedarf und
  deine Unverträglichkeiten zu.“ Ohne diese Einwilligung: Standardportion, keine Ausschlüsse der Person im Text.
- Gemeinsame Mahlzeiten werden einmal geplant, aber für jede Person eine eigene Portion berechnet:
  **Portionsfaktor = Kalorienziel dieser Mahlzeit ÷ kcal pro Portion**, begrenzt auf **0,6–1,8**, gerundet auf
  sinnvolle Schritte (z. B. 10 g bei Beilagen, keine halben Eier). Optional Beilagen unterschiedlich skalieren,
  Eiweißquelle gleich (Rolle je Rezept-Zutat, 6.9). Ohne Kalorienziel (z. B. Schwangerschaft) gilt Faktor 1.
- Das Kalorienziel jeder Person kommt nur aus ihrer eigenen Ernährungs-Engine (mit Schutzgrenzen); der Portionsfaktor
  ist **keine** eigene Begrenzungsstelle und darf den Tag einer Person nie unter ihre Untergrenze oder über ihre
  Obergrenze bringen – geht das nicht, bekommt diese Person für die Mahlzeit einen eigenen Vorschlag.
- Gemeinsame Rezepte und jeder Tausch darin müssen die Ausschlüsse **beider** Personen erfüllen.
- Eine gemeinsame Einkaufsliste mit der Summe beider Portionen; Anzeige z. B. „Anna 180 g Reis · Ben 120 g Reis“.
  Sichtbar sind keine Zahlen zu Zielen oder Körperdaten – **Portionen lassen aber Rückschlüsse zu** (deshalb die
  eigene Einwilligung).
- Monetarisierung prüfen (Phase 7): „Partner-Abo“ (zwei Konten, günstigerer Preis).
- **Umsetzung der Rechenlogik (Etappe N13, `packages/core/src/nutrition/portion-factor.ts`, 14.10.2026):** Faktor je
  Person aus ihrem eigenen Planband (Anteil der Mahlzeit × Bandmitte ÷ kcal je Portion), 0,6–1,8; ohne Ziele oder ohne
  `health_data`-Einwilligung Faktor 1 (genau die Standardportion). Wahlweise „Beilagen getrennt“: Eiweißquelle und
  übrige Zutaten für alle gleich (kleinster der Faktoren), nur die Beilage (Rolle `carb`) je Person; Rezept ohne Beilage →
  gleichmäßig. Beilagen in 10-g-Schritten, Eier ganz. Der Tag jeder Person wird nur über ihre übrigen Mahlzeiten und
  Ergänzungs-Snacks ausgeglichen; läge er über ihrer Obergrenze, bekommt sie für diese Mahlzeit einen eigenen Vorschlag.
  Gemeinsame Gerichte bestehen den Filter jeder Person (sonst eigener Vorschlag). Noch keine Oberfläche und keine
  Speicherung – beides mit P1 (Phase 11). Optionale Zutaten der geteilten Portion zählen für die Obergrenze mit
  (sonst eigener Vorschlag); ein Tausch einer anderen Mahlzeit lässt die geteilte Portion unverändert, ein Tausch der
  geteilten Mahlzeit macht sie zur eigenen. Details in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N13.

### 6.13 Einkaufsliste weitergeben, Kosten und Händler
- **Sofort (Gratis):** Einkaufsliste als Text weitergeben (System-Teilen-Dialog → WhatsApp, Notizen, Erinnerungen),
  als PDF exportieren; gemeinsame Liste im Paar-Modus (mit Phase 11). Das ist **privates Weitergeben** durch den
  Nutzer selbst, kein öffentliches Teilen (Abschnitt 18). Inhalt wie beim PDF: nur Produkte und Mengen, keine kcal,
  keine Gründe, kein Körpergewicht; Hinweis vor dem Weitergeben, wenn Ersatzprodukte auf eine Unverträglichkeit schließen
  lassen.
  **Umgesetzt im Testmodus (Etappe N12, 14.10.2026, `docs/PLAN-PHASE-5.md` Umsetzungsstand N12):** „Einkaufsliste →
  Weitergeben“ mit Vorschau des genauen Texts (Abteilungen, Produktarten, Mengen in g/ml/Stück, Vorrat am Ende; wahlweise
  mit Erledigten, ohne Vorrat, ohne eigene Einträge), System-Teilen-Dialog (nativ `Share`, Web `navigator.share`) bzw.
  „Text kopieren“, Rückfall „Text markieren“. Der Text entsteht in `packages/core` (`shoppingListToText`) nur aus
  Produktnamen, Mengen, Abteilung und Vorrats-/Erledigt-Kennzeichen – keine kcal, Gründe, Ziele, Unverträglichkeiten,
  kein „statt …“, kein App-Link, keine Werbung; Links stehen nur drin, wenn die Person sie selbst in einen eigenen Eintrag
  schreibt – dann ohne Tracking-Anhang ab „?“/„#“, `javascript:`-Links werden entfernt; unsichtbare Zeichen (auch
  versteckter Text über Tag-Zeichen) werden entfernt. Vor dem Weitergeben erscheint ein Hinweis, wenn die Liste aus einem
  Plan mit Gesundheitsbezug stammt oder Ersatzprodukte/ausgetauschte Zutaten enthält (diese werden dort genannt). Nichts
  geht an einen Server, nichts wird gespeichert. Gemeinsame Liste im Paar-Modus weiter mit Phase 11 (P1).
- **Kosten:** Preise und „Kosten pro Portion“ sind immer als **Schätzung** gekennzeichnet („ca. 1,20 € pro Portion,
  Schätzung, Stand 2026“) und nur dort sichtbar, wo eine freigegebene Schätzung vorliegt.
- **Später – Händler-Anbindung:** Lieferdienste/Supermärkte erst, wenn geklärt ist, ob und zu welchen Bedingungen ein
  Händler eine offizielle Schnittstelle oder ein Partner-/Affiliate-Programm anbietet; **keine inoffiziellen
  Schnittstellen**. Technisch als Modul hinter Feature-Flag; Affiliate-Links als „Anzeige“ gekennzeichnet; Affiliate
  beeinflusst nie, welches Rezept oder Produkt vorgeschlagen wird. Einschalten nur mit eigener Einwilligung,
  DSFA-Ergänzung und Datenminimierung (nur Produktarten und Mengen, keine Ersatz-Hinweise, keine Plan-/Profildaten).
  **Vorbereitet (N12):** `packages/core/src/retail/` nur als Schnittstelle (`RetailProvider`, `retailOrderLines` =
  Datenminimierung, `retailIntegrationAvailable`), Feature-Flag `retail_integration` in `constants.ts` **aus**, kein
  Händler, kein Netzwerkaufruf, kein Knopf in der App. Bis zur Gründer-Entscheidung G7 (PLAN-PHASE-5 N12) gingen
  Ersatz-Einträge und Listen aus Plänen mit Gesundheitsbezug nie an einen Händler.

## 7. Supplement-Modul
- Nur evidenzbasiert: Proteinpulver (wenn Eiweißziel über Ernährung schwer erreichbar), Kreatin-Monohydrat, Koffein (vor Training, mit Tageslimit und Hinweis auf Schlaf), Vitamin D (Hinweis: Spiegel ärztlich prüfen lassen), bei Ausdauer: Kohlenhydrat-Gels/Elektrolyte; Omega-3 optional
- Zeitplan: vor Training / nach Training / vor dem Schlafen / täglich
- Datenfeld pro Supplement: Evidenzstufe, Begründungstext, Gegenanzeigen-Flags (Schwangerschaft, Nierenerkrankung, Medikamente, Alter <18)
- Gegenanzeige erkannt → keine Empfehlung, Hinweis auf ärztliche Rücksprache
- Affiliate-Links pro Supplement (mehrere Shops), klar als Werbung gekennzeichnet

## 8. Zyklus-Modul (opt-in)
- Zyklusstart, Länge, Symptome, Energie, Schlaf – täglich in Sekunden erfassbar
- Hormonelle Verhütung / Schwangerschaft / Wechseljahre als Status
- Anpassung adaptiv: bei gemeldeten Beschwerden/niedriger Energie leichtere Alternative vorschlagen; keine starren Regeln nach Phase
- Ernährungshinweise flexibel (z. B. Energiebedarf, Eisenreiche Lebensmittel)

## 9. Wearables & Readiness
- HealthKit (iOS), Health Connect (Android), Strava, Garmin; später Polar, Fitbit, Suunto
- Import: Workouts, Herzfrequenz, Ruhepuls, HRV, Schlaf, Schritte
- Readiness-Score aus Schlaf, Ruhepuls, HRV, letzter Belastung → Vorschlag „Einheit wie geplant / leichter / Ruhetag“
- Neue Wearable-Daten sind Auslöser der Live-Anpassung (Abschnitt 4.1) und liefern Fortschritt für Challenges (Abschnitt 11.3)

## 10. Strecken
- Vorschläge im Umkreis des Standorts nach Disziplin, Distanz, Höhenmetern, Untergrund
- Quellen: OpenStreetMap, eigene kuratierte Strecken, Nutzer-GPX; Strava/Komoot nur nach Lizenzprüfung
- Kartenanzeige, Navigation per Export (GPX) an Uhr
- **Kein Teilen:** keine öffentlichen Strecken, keine Ranglisten/Segmente, keine Strecken anderer Nutzer.
  „Nutzer-GPX“ heißt: eigene Datei, nur für den eigenen Nutzer sichtbar.

### 10.1 Strecken aufzeichnen (Gratis, privat)
- GPS-Aufzeichnung in der App für Laufen und Radfahren: Distanz, Höhenmeter, Dauer, Pace bzw. Geschwindigkeit, Strecke auf der Karte
- Aufzeichnung im Hintergrund (Standortberechtigung mit verständlicher Begründung für App Store und Play Store)
- Speichern mit Name, **Favorit**, Schwierigkeit **leicht / mittel / schwer**, Notiz
- Favoriten erneut laufen/fahren und Zeiten vergleichen; Aufzeichnung landet automatisch im Trainingstagebuch (Abschnitt 5)
- GPX-Export für die Uhr
- Alles privat, kein Teilen. Standortverläufe nie an Analytics, Werbung oder Dritte

## 11. Fortschritt & Motivation
- Gewicht, Körperumfänge, Fotos (privat), persönliche Rekorde, Wochenumfang, Konsistenz
- Partner-Modus: gemeinsame Einkaufsliste/Wochenplan, gegenseitige Freigaben. Das ist **kein öffentliches Teilen**:
  genau zwei Personen, beidseitige Zustimmung, nur ausdrücklich freigegebene Bereiche, jederzeit beendbar. Körperfotos,
  Gesundheits- und Zyklusdaten sind davon ausgeschlossen, solange nicht ausdrücklich anders beschlossen. **Feste Regel
  (Ziele, Wächter K7):** Das Wunschgewicht (`weight_goals`) und die Planbarkeits-Ampel sind **immer** ausgeschlossen –
  auch wenn „Ernährung“ freigegeben ist.
  Darauf baut der **Paar-Modus beim Kochen** auf (Abschnitt 6.12, Premium): eigener Bereich mit eigener
  Art.-9-Einwilligung beider Personen; gemeinsame Mahlzeiten mit eigener Portion je Person und gemeinsamer
  Einkaufsliste – keine Zahlen zu Zielen oder Körperdaten, Portionen lassen aber Rückschlüsse zu.
- Wettkampf-Countdown, Erfolge (dezent, nicht ans Gewicht gekoppelt)

### 11.1 Körperumfänge mit Mess-Erinnerung (Gratis) – Grundlage in Phase 1 umgesetzt
- Erfassung: Oberarm, Brust, Schulter, Taille, Bauch, Oberschenkel, optional Hüfte, Wade; links/rechts wo sinnvoll
- Im Onboarding als **optionaler** Schritt mit kurzer Mess-Anleitung pro Stelle (Bild/Animation)
- **Mess-Update:** Erinnerung in festem Abstand (Standard alle 4 Wochen = 28 Tage, einstellbar 7–90) zum Nachmessen, zusammen mit Gewicht
- Verlaufsdiagramme pro Umfang; Werte fließen in die Live-Anpassung (Abschnitt 4.1)
- Umgesetzt in Phase 1 (Etappe A): Tabellen `body_measurements` und `measurement_reminders`, an die `health_data`-Einwilligung
  gebunden (siehe Abschnitt 12, Abweichungen). Verlaufsdiagramme und Anleitungsbilder folgen später.
- Umgesetzt in Phase 4b (Etappe E): Mess-Erinnerung als **lokale** Benachrichtigung (statt Push, siehe Abschnitt 12,
  Abweichungen ab Phase 4b).

### 11.2 Körperfoto-Analyse (Premium, KI)
- Fotos in festen Posen (vorne, seitlich, hinten) mit Umriss-Hilfe auf dem Kamerabild; Erinnerung zusammen mit dem Mess-Update
- KI vergleicht zwei Zeitpunkte und beschreibt **sichtbare Veränderungen** sachlich und ermutigend
- **Formulierungsregeln:** keine Körperfett-Prozentzahl aus Fotos, keine Bewertung von Aussehen oder Attraktivität,
  keine abwertenden Aussagen, keine medizinischen Aussagen
- **Eigene Einwilligung** (getrennt von `health_data`), verschlüsselte Speicherung im privaten Storage-Bucket, jederzeit
  löschbar, keine Nutzung für andere Zwecke (kein Training von Modellen, keine Weitergabe)
- Monatslimit über `ai_usage` (Abschnitt 15)

### 11.3 Monats-Challenges (Gratis, privat)
- Jeden Monat eine Auswahl an Challenges, im Admin-Bereich angelegt; Nutzer tippt „Ich mache mit“
- Arten: Anzahl Einheiten, Lauf-/Raddistanz, Schritte, Mobility-Minuten, Wasser trinken, regelmäßiges Messen.
  Dauer: Woche oder Monat, Ziel täglich oder gesamt
- **Fortschritt automatisch** aus Tagebuch, Strecken und Wearables; manuelles Abhaken nur, wo nötig
- Nur passende Challenges anzeigen: keine Konflikte mit Erholungswoche, Tapering oder Gesundheits-Check-Flags;
  Umfang innerhalb der Sicherheitsgrenzen (z. B. ≤10 %/Woche Ausdauer)
- **Verboten:** Essens-, Fasten- oder Abnehm-Challenges sowie Challenges, die zu Übertraining verleiten
- Ein **Joker pro Monat** für einen verpassten Tag; Serien springen nicht hart auf null
- Abzeichen nach Abschluss, **privat** – keine Ranglisten, kein Vergleich mit anderen
- Optional Sponsor (Supplement-Hersteller, Partnerstudio) mit Rabattcode – klar als „Werbung“ gekennzeichnet; Sponsor
  sieht keine Teilnehmer- oder Gesundheitsdaten

## 12. Datenmodell (Kern, Postgres)
- `profiles` (user_id, sex, birth_date, height_cm, experience_level, locale) – `height_cm` **geändert, siehe Abweichungen** (steht in `body_metrics`)
- `body_metrics` (user_id, date, weight_kg, body_fat_pct, waist_cm …) – **geändert, siehe Abweichungen** (Größe hier; Umfänge wie `waist_cm` in `body_measurements`)
- `consents` (user_id, type, version, granted_at, revoked_at)
- `health_screening` (user_id, answers jsonb, flags, created_at) – sensibel
- `goals` (user_id, goal_type, discipline, target_date, sessions_per_week, minutes_per_session, preferred_days) – **geändert in Etappe B2, siehe Abweichungen ab Phase 3**
- `user_equipment` (user_id, location, equipment_id, weights_kg numeric[]) – **ergänzt um `bar_kg` (Etappe B2)**
- `nutrition_prefs` (user_id, diet_type, eats_pork, cooking_mode, mealprep_days, meals_per_day)
- `food_preferences` (user_id, food_id, like/dislike/intolerance)
- `exercises`, `exercise_alternatives`, `equipment` – **umgesetzt in Phase 2, siehe Abweichungen ab Phase 2**
- `plan_templates`, `template_sessions`, `template_exercises` (Inhalte, status draft/published) – **umgesetzt in Phase 2,
  siehe Abweichungen ab Phase 2**
- `user_plans`, `planned_sessions`, `planned_exercises`
- `session_logs` (planned_session_id, status, rpe_0_10, notes, source)
- `set_logs` (session_log_id, planned_exercise_id, performed_exercise_id, set_no, reps, weight_kg, rpe, done)
- `cardio_logs` (session_log_id, distance_m, duration_s, elevation_m, avg_hr, source)
- `foods`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_items`, `shopping_lists`, `shopping_list_items` –
  **umgesetzt in Phase 5, Etappe N7 (Teil 1), siehe Abweichungen ab Phase 5**
- `supplements`, `supplement_contraindications`, `affiliate_links`, `user_supplement_plans`
- `cycle_entries` – sensibel, verschlüsselt
- `wearable_connections`, `daily_metrics`
- `routes` (geometry, distance_m, elevation_m, discipline, source, license)
- `subscriptions` / Entitlements (über RevenueCat-Webhook)
- `partner_links`, später `organizations` (Fitnessstudios), `org_memberships`

### Abweichungen ab Phase 1 (umgesetzt, siehe `docs/PLAN-PHASE-1.md` und `supabase/migrations`)
- **Körpergröße** steht nicht in `profiles`, sondern in `body_metrics` (Gesundheitsdatum → nur mit Einwilligung `health_data`). `profiles` enthält keine Körper- oder Gesundheitswerte.
- **Geschlecht** (`sex`): männlich / weiblich / divers / keine Angabe (`male|female|diverse|unspecified`); bei divers/keine Angabe nimmt die Kalorienformel später den Mittelwert. Zusätzlich `cycle_module_interest` (nur Ja/Nein-Wunsch, keine Zyklusdaten).
- **`consent_documents`** (consent_type, version, title_de, body_de, published_at): versionierte Einwilligungstexte; gültig ist die höchste veröffentlichte Version. `consents` ist nur ergänzbar (Einfügen + Widerruf), Widerruf von `health_data` löscht alle Körper-/Gesundheitsdaten.
- **`body_measurements`** (Körperumfänge in cm, optionaler Onboarding-Schritt) und **`measurement_reminders`** (Mess-Erinnerung, Standard alle 28 Tage) – Erweiterungsbeschluss der Gründer (`docs/ERWEITERUNGEN.md`).
- **`food_preferences`** nutzt bis Phase 5 feste Lebensmittel-Gruppen (`food_group`, Liste in `packages/core/src/food-groups.ts`) statt `food_id`.
- **`user_equipment`**: „Sonstiges“ = Katalog-Eintrag `other` mit Freitext `note`.
- **Profil zuerst:** Ein Profil mit geprüftem Geburtsdatum (Mindestalter 16, serverseitig) ist Voraussetzung für alle Einwilligungen und Nutzerdaten (RLS).
- **Neue Textversion einer Einwilligung:** bisherige Gesundheitsdaten bleiben lesbar, sind aber nicht änderbar/ergänzbar, bis neu eingewilligt wird. Der Widerruf in den Einstellungen gilt der aktuellen Einwilligung und löscht alle Gesundheitsdaten (Körperdaten, Körperumfänge, Gesundheits-Checks, Unverträglichkeiten).
- **Gesundheits-Check:** Flags (`conservative_plan` usw.) berechnet die Datenbank selbst aus den Antworten; Zeitstempel serverseitig.
- **Login** per E-Mail mit 6-stelligem Code (OTP, ohne Passwort); Apple/Google folgen.
- Onboarding **ohne Wearable-Schritt** (kommt mit Phase 8); Einwilligung Gesundheitsdaten **vor** den Körperdaten.

### Abweichungen ab Phase 3, Etappe B2 (umgesetzt, siehe `docs/PLAN-PHASE-3-ERWEITERUNG.md` und `supabase/migrations/20261005120000_training_slots.sql`)
- **`training_slots`** (user_id, slot_no 1–7, weekday 1–7 oder null = „Tag egal“, kind `strength_gym|strength_home|endurance`, minutes 10–240) ersetzt das Zeitbudget in `goals`; entweder alle Einträge mit Wochentag oder keiner. Schreiben nur über `replace_training_slots(p_items)` (Login, Profil, alle Regeln, atomar); kein Gesundheitsdatum.
- **`goals`** ohne `sessions_per_week`, `minutes_per_session`, `preferred_days` (bei der Migration in `training_slots` übernommen: Anzahl Wunsch-Tage = Tage pro Woche → feste Tage, sonst „Tag egal“). `training_location` bleibt, wird aus den Trainingstagen abgeleitet.
- **`user_equipment.bar_kg`** (5–25 kg, nur Langhantel); `weights_kg` der Langhantel = Scheiben je Paar (≤ 25 kg; ältere Werte > 25 kg wurden entfernt). Kurzhanteln/Kettlebells: Gewicht je Hantel bzw. Kugel.
- Onboarding-Schritt „Trainingsort“ ist nie mehr anwendbar (bleibt nur wegen der CHECK-Liste von `profiles.onboarding_step`).

### Abweichungen ab Phase 2 (umgesetzt, siehe `docs/PLAN-PHASE-2.md` und `supabase/migrations`)
- **Inhaltstabellen enthalten nur Freigegebenes:** `status` ist `published` oder `archived` (CHECK: nie `draft`).
  RLS: `anon` sieht nichts, `authenticated` liest nur `published`, Schreiben nur `service_role` über
  `seed_content(p_content jsonb)` (eine Transaktion, idempotent, archivieren statt löschen, nicht für Nutzer ausführbar).
- **`exercises`** (id = lesbarer Schlüssel, version, status, name_de, **name_en** als englischer Zweitname, aliases_de,
  movement_pattern, primary_muscles/secondary_muscles (`muscle_group[]`), equipment_ids, mechanics, load_type,
  unilateral, difficulty 1–3, caution_tags, Texte: description_de, steps_de, tips_de, common_mistakes_de,
  safety_note_de, meta).
- **`exercise_alternatives`** (exercise_id, alternative_id, reason, priority): gleiches Bewegungsmuster; sichtbar nur,
  wenn beide Übungen freigegeben sind.
- **`plan_templates`** (Matrix Phase 2: goal_type `muscle_gain|fat_loss|general_fitness`, experience_level
  `beginner|advanced`, sessions_per_week, minutes_min/max, location `gym|home`, required/optional_equipment_ids, sex,
  meta). **`template_sessions`** mit Schlüssel (template_id, day_index) statt eigener ID, dazu focus,
  estimated_minutes, warmup_de, cooldown_de. **`template_exercises`** mit Schlüssel (template_id, day_index, order_no)
  statt `session_id`; sets, reps_min/max **oder** duration_s, rest_s, rpe_target (0,5er-Schritte), superset_group,
  notes_de. Stabile Schlüssel, damit erneutes Einspielen denselben Stand ergibt.
- **`admin_users`** (user_id, role `content_admin`, created_at): nur die eigene Zeile lesbar; erst ab Login Stufe B.
- **`equipment.home_selectable`** (Standard true) und Studio-Geräte (Rack, Kabelzug, Latzug, Beinpresse, Brustpresse,
  Beinbeuger-/Beinstrecker-Maschine, Dip-Station) mit `false`; neue Kategorie `machines`. Datenbank und App lehnen
  Studio-Geräte beim Ort „Zuhause“ ab; das Onboarding zeigt sie dort nicht.
- Neue Enums: `content_status`, `movement_pattern`, `muscle_group`, `exercise_mechanics`, `load_type`, `caution_tag`,
  `alternative_reason`, `session_focus`, `admin_role` (abgeglichen mit `packages/core` durch `db-sync.test.ts`).

### Abweichungen ab Phase 3 (umgesetzt, siehe `docs/PLAN-PHASE-3.md` und `supabase/migrations`)
- **`user_plans`** (id, user_id, status `active|replaced`, template_id → `plan_templates` (`on delete restrict`), Schnappschuss
  template_title_de, template_version, engine_version, match_quality, notes `plan_note[]` (nur Codes ohne Gesundheitsbezug),
  **uses_health_data**, **medical_notice**, inputs jsonb (Angaben **ohne** Gesundheitsdaten), start_date, created_at,
  replaced_at): höchstens ein aktiver Plan je Person.
- **`planned_sessions`** (plan_id + user_id als gemeinsamer Fremdschlüssel, block_no, week_no 0–6, is_intro_week, is_deload,
  template_day_index, scheduled_on, original_date, status `planned|skipped`, Schnappschuss Name/Schwerpunkt/Dauer/Texte):
  nie zwei nicht gestrichene Einheiten am selben Tag (eindeutiger Index je Person und Datum).
- **`planned_exercises`** (session_id + user_id, order_no 1–8, exercise_id und source_exercise_id → `exercises`
  (`on delete restrict`), Schnappschuss Name, Dosierung mit den fachlichen Grenzen V4 als CHECK, target_weight_kg).
- **Rechte:** Nutzer dürfen Pläne und geplante Übungen nur **lesen**; an Einheiten nur Datum und Status ändern (Trigger:
  ab heute, gleiche ISO-Woche wie der ursprüngliche Tag, Erholungseinheiten nur streichen, nur `planned → skipped`, nur
  aktiver Plan; die 48-h-Regel bleibt eine App-Regel). Tauschen zweier Einheiten nur über
  `swap_planned_sessions(p_a, p_b, p_a_on, p_b_on)` (Etappe A1a, `security definer`, dieselben Prüfungen für beide,
  atomar, nur wenn beide noch an den von der App geprüften Tagen liegen). Anlegen nur über `save_training_plan(p_plan)` und
  `append_plan_block(p_plan_id, p_sessions)` (`security definer`, prüfen Login, Profil, Besitz, nur bekannte Felder, Werte
  der Angaben, nur freigegebene Inhalte, Datumsrahmen `PLAN_SAVE_LIMITS`; `uses_health_data`/`medical_notice` bestimmt
  die Datenbank selbst aus dem neuesten Gesundheits-Check und der Einwilligung; Fehler ohne Zeilen-Details). Ersetzte
  Pläne ohne Einheiten werden jenseits der neuesten 20 aufgeräumt.
- **Gesundheitsdaten:** Pläne, in die der Gesundheits-Check eingeht (`uses_health_data`), gelten vorsorglich als
  Gesundheitsdaten (EuGH C-184/20): nur mit gültiger Einwilligung, beim Widerruf werden **alle** solchen Pläne vollständig
  gelöscht. Archivierte Übungen bleiben über eigene Pläne lesbar.
- **Gerätespeicher** solcher Pläne (Offline-Training): Ausnahme zur Phase-1-Regel, **Gründer-Entscheidung Frage 14 = JA**
  (`docs/PLAN-PHASE-3.md`): App verschlüsselt (Schlüssel im sicheren Schlüsselspeicher), Browser nur sessionStorage;
  gelöscht bei Widerruf, Abmelden, Konto löschen, „Plan ersetzt/fehlt“ und nach 14 Tagen ohne Server-Kontakt. Ein
  offline liegendes Gerät zeigt einen Plan nach Widerruf auf einem anderen Gerät bis zum nächsten Online-Laden.
- **Vorgemerkt für Phase 4:** optionales Feld „eigenes Startgewicht“ (Selbsteinschätzung); Tagebuch-Einträge
  (`set_logs.planned_exercise_id`) mit `on delete set null` und eigener Kopie, damit der Widerruf kein Tagebuch mitlöscht;
  „gestern verpasst → skipped“ und Progressions-Änderungen an `planned_exercises` über eigene `security definer`-Funktionen.

### Abweichungen ab Phase 4, Etappe B (umgesetzt, siehe `docs/PLAN-PHASE-4.md` und `supabase/migrations/20261006120*`)
- **`exercise_logs` zwischen `session_logs` und `set_logs`:** „nicht gemacht“ ist eine Übung **ohne** Sätze, und Vorgabe
  (`target_*`) und Progressions-Zustand (`state_*`, roh) werden je Übung einmal gespeichert. `exercise_logs` enthält die
  **tatsächlich gemachte** Übung (`exercise_id`), bei einer Alternative den Verweis auf die geplante
  (`planned_exercise_id`), dazu `weight_confirmed`, `target_extra_set` und `is_return`. `set_logs` (exercise_log_id,
  set_no, reps, weight_kg, duration_s, rpe, done) verweist daher **nicht** selbst auf `planned_exercise_id`.
- **`session_logs`** (planned_session_id, kind, performed_on, status `completed|partial`, session_rpe 0–10, notes ≤ 280
  Zeichen, Schnappschuss name_de/is_intro_week/is_deload, **from_health_plan** (nur Server), **revision** und
  **last_write_id** (Konflikte und Idempotenz), source `manual`): eine Einheit nur einmal, nie zwei geplante Einheiten am
  selben Tag. **`cardio_logs`** (1:1, modality, duration_s, distance_m, elevation_m) – **ohne** `avg_hr` (Phase 8).
- **Schnappschuss statt Kaskade:** Verweise auf Pläne `on delete set null (spalte)`; ein Widerruf oder das Aufräumen
  ersetzter Pläne löscht kein Tagebuch. Beim Widerruf `health_data` werden Vorgaben, Zustand und Varianten-Name aus
  Plänen mit Gesundheits-Check **neutralisiert** (Ist-Werte bleiben); auf Wunsch löscht `revoke_health_data(true)`
  diese Einträge in derselben Transaktion. Gleiches ohne gültige Einwilligung (abgelehnte Neu-Einwilligung).
- **Rechte:** Tagebuch nur lesen; Schreiben nur über `save_session_log`/`delete_session_log` (`security definer`).
  Ausnahme **`exercise_start_weights`** (eigenes Startgewicht, direkt schreibbar, mit Profil). `planned_session_status`
  hat zusätzlich `completed` (nur vom Server gesetzt); „nie stapeln“ bei geplanten Einheiten gilt nur noch für
  `planned`; wird ein Eintrag gelöscht, geht die Einheit nur zurück auf `planned`, wenn ihr Plan aktiv ist, ihre
  Woche läuft und der Tag frei ist (sonst `skipped`). Export aller eigenen Daten über `export_my_data()` (ohne
  Konto-E-Mail, die die App ergänzt, und ohne `waitlist`). Tageslimit neuer Einträge über einen Zähler
  (`private.session_log_daily_counts`, kein Inhalt).

### Abweichungen ab Phase 5, Etappe N7 Teil 1 (umgesetzt, siehe `docs/PLAN-PHASE-5.md` Umsetzungsstand N7 und `supabase/migrations/20261014120*`)
- **Inhalte** (nur `published|archived`, anon nichts, angemeldete Nutzer lesen nur `published`, Schreiben nur über
  `seed_nutrition_content()` – eigene Funktion neben `seed_content()`, nur `service_role`): `foods`, `recipes`,
  `recipe_ingredients` (Index je Zutat, Rolle), `ingredient_substitutions`, `food_package_sizes` (eigene Tabelle statt
  Spalte an `foods`), `meal_prep_plans` (eine Tabelle, Schritte/Aufbewahrung in `data`), `guides`. Jede Inhaltstabelle
  hat `data jsonb` = die geprüfte Inhaltsdatei **unverändert** (inkl. `meta.import_assumptions*`), nur die Namen der
  Prüfenden werden beim Einspielen durch „redaktion“ ersetzt und Prüfnotizen entfernt (Wächter N7 H8); die übrigen Spalten
  sind daraus abgeleitet (Server-Prüfungen, Fremdschlüssel). Kategorien als Liste `recipes.categories` (CHECK) statt
  `recipe_categories`/`recipe_category_links`. Eingespielt wird nur **fachlich geprüft** (`meta.expert_reviewed`,
  Lebensmittel zusätzlich Katalog-Prüfung) – Gründer-Entscheidung 6 serverseitig.
- **`nutrition_prefs`** ergänzt um `activity_level`, `training_time` (Enums), `mealprep_slots` (Enum, Standard Mittag),
  `show_energy_numbers` (Standard an), `max_prep_minutes_weekday` (10–120) – kein Gesundheitsdatum.
- **`meal_plans`** (ein Plan je Person und Woche; `uses_health_data` setzt nur der Server; `inputs` ohne Körperdaten,
  Flags, Unverträglichkeiten, Abneigungen, „ohne Schwein“; Merker `auto_adjusted`, `recipes_changed`, Kochtag-Start) und
  **`meal_plan_items`** (Schnappschuss je Mahlzeit: Rezept-Version, Titel, Faktor 0,5–2, Nährwerte, Ersatz, Weglassen
  und Tausch **je Zutat-Stelle** `{index, food_id, …}` (Wächter N7 S3), Kochtag, Aufbewahrung, Tagesstatus). **Nicht** gespeichert: Ziele, Planband, Abgleich-Schlüssel, Modus,
  leere Plätze mit Gründen, Hinweise (verraten Gesundheitsangaben; werden auf dem Gerät neu gerechnet). Geteilte
  Mahlzeiten erst mit P1.
- **`shopping_lists`** (eine je Woche, Verweis auf den Plan `on delete set null (meal_plan_id)`, Zeitraum, Plan-Schlüssel,
  zusätzliche Rezepte) und **`shopping_list_items`** (Häkchen direkt änderbar, sonst nur über `replace_shopping_list`).
- **`recipe_ratings`** (Grund nur bei Daumen runter, nie „unverträglich“, Datum = heute ±1 Tag, höchstens 2.000) und
  **`food_dislikes`** (ohne Zeitstempel und ohne Grund, höchstens 300) – privat, keine Aggregation, nie Analytics.
- **Funktionen:** `save_meal_plan` (Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“ je Gruppe und je
  Lebensmittel und Alkohol je Zutat erneut geprüft, inkl. Ersatz/Weglassen/Tausch; Faktor ≠ 1 bzw. jeder
  Gesundheitsbezug ohne Einwilligung abgelehnt), `replace_shopping_list`, `replace_food_dislikes`,
  `delete_stored_intolerances` (löscht Pläne/Listen mit Gesundheitsbezug mit). **Bewusst nur im Core** (Abschnitt 6,
  Plan 7.3): Kalorien-Schutzgrenzen und `pregnancy_caution` – ein manipulierter Client schadet nur sich selbst.
- **Gleichzeitigkeit (Wächter N7 S2):** Funktionen, die die Einwilligung prüfen und Gesundheitsbezug speichern
  (`save_meal_plan`, `replace_shopping_list`, `save_training_plan`/`append_plan_block` über `plan_health_basis`),
  sperren die aktive Einwilligung vorher (`FOR SHARE`); der Widerruf sperrt sie zuerst (`FOR UPDATE`) und löscht
  Pläne/Listen am Ende noch einmal – ein gleichzeitig gespeicherter Plan überlebt den Widerruf nicht. Feste
  Reihenfolge überall: **erst die Einwilligung, dann Plan-/Einheiten-Zeilen** (sonst Deadlock; `append_plan_block` dafür
  korrigiert, Nachprüfung N7 S-N1). Essensplan und Einkaufsliste derselben Woche teilen eine Sperre je Person und Woche
  (`pg_advisory_xact_lock`), die Liste liest den Plan der Woche dadurch konsistent.
- **Logs:** Die Payloads enthalten Gesundheitsbezüge; der Supabase-Standard `log_parameter_max_length_on_error = 0`
  (Parameter nicht ins Postgres-Log) darf nicht geändert werden (Wächter N7 H10).
- **Widerruf `health_data`** löscht zusätzlich Essenspläne und Einkaufslisten mit Gesundheitsbezug (samt eigener
  Einträge); Bewertungen und „mag ich nicht“ bleiben. **Export** (`export_my_data`) enthält alle sechs neuen
  Nutzertabellen, **Konto löschen** entfernt sie per Kaskade.
- **Einwilligungstexte vor dem Login:** `current_consent_version` ist nicht mehr für `anon` ausführbar; die App liest
  die höchste veröffentlichte Version direkt aus `consent_documents`.
- **N7 Teil 2 (umgesetzt 16.10.2026, `supabase/migrations/20261016120000_*`):** Essensplan, Einkaufsliste,
  Rezept-Bestand, Tagebuch und eigene Gerichte im Supabase-Modus der App; der Core rekonstruiert den Plan aus den Zeilen
  (ohne Planband/Abgleich-Schlüssel, Modus aus `day_status`) und prüft ihn danach wie 6.6. `content-seed` spielt die
  Ernährung ein (nur `published` und fachlich geprüft, Schutz vor Massen-Archivierung). **Löschfrist:** Essenspläne und
  Einkaufslisten älter als `MEAL_PLAN_RETENTION_WEEKS` (4) Wochen vor der laufenden Woche werden beim Speichern und
  täglich (`pg_cron`) gelöscht, im Testmodus beim Laden/Speichern; das Tagebuch bleibt. **Server-Plausibilität (G-W3):**
  `save_meal_plan` rechnet die Nährwerte jeder Mahlzeit selbst nach (Rezept × Faktor mit Ersatz, Weglassen, Tausch –
  wie `scalePortion`), speichert nur diese Werte, lehnt abweichende Angaben ab und lehnt Tage ab heute ab, deren Summe
  unter dem Grundumsatz für die Schutzgrenzen liegt (dieselbe Formel wie der Core, `nutrition/plausibility.ts`;
  Meldungen ohne Werte). Details: `docs/PLAN-PHASE-5.md`,
  Umsetzungsstand N7 Teil 2.

### Erweiterungen (geplant, `docs/ERWEITERUNGEN.md`)
Alle Tabellen mit RLS (jeder sieht nur eigene Zeilen; Ausnahmen: Katalog-/Inhaltstabellen für alle lesbar, Pflege nur
durch Admin). **sensibel** = Gesundheitsdaten nach DSGVO Art. 9: nur mit gültiger Einwilligung speichern, beim Widerruf
löschen, nie in Logs/Analytics.
- `food_products` (barcode, name, brand, Nährwerte pro 100 g, source `off|user`, user_id nur bei eigenen Produkten) –
  Open-Food-Facts-Einträge für alle lesbar, eigene nur für den Nutzer (Phase 5)
- `food_log_entries` (user_id, date, meal_slot, product_id oder custom_meal_id, amount, unit, Nährwerte) – Ernährungstagebuch;
  enthält ggf. Unverträglichkeits-Bezüge, daher nie an Analytics/Werbung; ob eine `health_data`-Einwilligung nötig ist,
  in Phase 5 juristisch klären (Phase 5)
- `custom_meals`, `custom_meal_items` – Standardgerichte (Phase 5)
- `meal_photo_estimates` (user_id, result jsonb, confirmed, photo_saved, photo_path) – **sensibel**, eigene Einwilligung
  „Fotoauswertung Mahlzeiten“; Foto standardmäßig nach Auswertung gelöscht (Phase 7b)
- `gyms` (osm_id, name, address, lat, lng, equipment jsonb, is_partner) – Studio-Katalog aus OpenStreetMap; `is_partner`
  bereitet B2B (`organizations`) vor (Phase 9b)
- `user_gyms` (user_id, gym_id, is_home_gym), `gym_memberships` (user_id, gym_id, start_date, min_term_months,
  notice_period_days, monthly_fee, notes) (Phase 9b)
- `tracked_routes` (user_id, name, sport, geometry, distance_m, elevation_m, duration_s, difficulty `easy|medium|hard`,
  is_favorite, note) – eigene Aufzeichnungen, streng privat (Standortverlauf); getrennt von `routes` (vorgeschlagene
  Strecken) (Phase 10)
- `body_measurements`, `measurement_reminders` – **bereits in Phase 1 umgesetzt** (siehe Abweichungen oben);
  `body_measurements` ist **sensibel** (`health_data`)
- `progress_photos` (user_id, date, pose `front|side|back`, storage_path) – **sensibel**, eigene Einwilligung
  „Körperfotos“, privater Storage-Bucket, verschlüsselt (angelegt in Phase 7b; die Fortschrittsansicht in Phase 11 nutzt sie)
- `photo_analyses` (user_id, photo_a_id, photo_b_id, result_text) – **sensibel**, gleiche Einwilligung wie Körperfotos (Phase 7b)
- `plan_adjustments` (user_id, created_at, trigger, rule, before jsonb, after jsonb, confirmed) – enthält bei Kalorien-
  und Umfangsregeln Gesundheitsbezüge, daher wie Gesundheitsdaten behandeln (Phase 4b)
- `ai_usage` (user_id, feature, tokens, cost, created_at) – nur Nutzungs-/Kostendaten, **keine Inhalte** (keine Fotos,
  Prompts oder Gesundheitswerte) (Phase 7)
- `challenges` (inkl. optionalem Sponsor + Rabattcode), `challenge_participations`, `challenge_progress` (Phase 11b)
- Neue Einwilligungsarten (`consent_documents`) für Körperfotos und für Mahlzeiten-Fotos; Namen beim Umsetzen festlegen.
- Spaltennamen in Englisch wie die bestehenden Tabellen; die deutschen Feldnamen aus `docs/ERWEITERUNGEN.md` sind nur Beschreibung.

### Erweiterungen Teil 2 (geplant, `docs/ERWEITERUNGEN-2.md`, Details `docs/PLAN-PHASE-5.md` Abschnitt 19)
Inhaltstabellen: für angemeldete Nutzer nur `published` lesbar, Schreiben **nur** über `seed_content()` (strenger als
„nur Admin“: auch der Admin-Bereich schreibt nicht in die Datenbank, Abschnitt 3). Nutzertabellen: RLS, jeder sieht nur
eigene Zeilen, in Export und Kontolöschung enthalten.
- `recipes` erweitert um Abschnitt (`section_de`), Gesamtzeit, Tags, Tipp, Kostenschätzung pro Portion (mit Stand),
  `meal_prep_plan_id`; `recipe_categories` (Katalog der 8 Themen) + `recipe_category_links` (n:m). Ernährungsformen
  brauchen **kein** eigenes n:m: „passt für“ ergibt sich aus der berechneten Ernährungsform und „ohne Schwein“ (6.5).
- `meal_prep_plans` (Titel, Beschreibung, Aufbewahrung, Hinweis Abendessen) mit `meal_prep_plan_recipes` und
  `meal_prep_plan_steps` (Startminute, Schritt) – Inhalt
- `guides` (Ratgeber Wettkampf, Unterwegs; Abschnitte als jsonb) – Inhalt
- `ingredient_substitutions` (food_id, substitute_food_id, factor, role, note_de) – Inhalt, per Batch-API erzeugt
- `foods` erweitert um Packungsgröße (Quelle: freigegebene Einträge aus `content/package-sizes/`, N11) und – falls
  entschieden – Schätzpreis je kg (Inhalt, als Schätzung gekennzeichnet)
- `recipe_ratings` (user_id, recipe_id, value, reason, rated_on) – Nutzerdaten, privat, kein Grund „unverträglich“ (6.10)
- `food_dislikes` (user_id, food_id) – „mag ich nicht“ je Lebensmittel (6.10), hart wie die Gruppen-Abneigungen
- `food_log_entries` (id, user_id, eaten_on, slot, source `plan_item|food|recipe|quick`, food_id/recipe_id, title_de,
  amount, unit, portion, kcal, protein_g, carbs_g, fat_g, revision, last_write_id, Zeitstempel) – Ernährungstagebuch
  (6.1, Etappe E1), vorsorglich Gesundheitsdatum: nur mit Einwilligung `health_data`, beim Widerruf gelöscht, Schreiben
  nur über `save_food_log_entries`/`delete_food_log_entry`
- `food_log_favorites` (user_id, fav_key, Vorlage ohne Datum) – Favoriten des Tagebuchs; Katalog/Rezept nur Verweis +
  Menge (Titel aus dem Katalog, keine Werte), bleiben beim Widerruf; Schnell-Favoriten (Bezeichnung + kcal) nur mit
  Einwilligung und beim Widerruf gelöscht; direkt per RLS (eigene Zeilen, höchstens 100)
- Alle diese Tabellen kommen gemeinsam mit der Supabase-Etappe N7 der Phase 5 (vorher nur Testmodus) – **umgesetzt in
  N7 Teil 1** mit den Präzisierungen oben (Kategorien als Liste, Meal-Prep-Pläne als eine Tabelle, Packungsgrößen als
  eigene Tabelle)
- `recipe_ingredients` erweitert um die Rolle je Zutat; Meal-Prep-Pläne mit strukturiertem Aufbewahrungsplan
  (Rezept, Wochentag, Kühlschrank/Einfrieren/frisch), geprüft gegen die Haltbarkeitsregeln
- Paar-Modus: gemeinsame Pläne/Einkaufslisten erst mit dem Partner-Modus (Phase 11), Tabellen dort festlegen
- `waitlist.source` (`warteliste` | `lead-magnet`) für den Lead-Magnet (Abschnitt 17) – nicht Teil der App-Daten

### Abweichungen ab Phase 10, Etappe WP3 (umgesetzt, siehe `docs/PLAN-PHASE-10.md` Abschnitt 7 und `supabase/migrations/20261016140*`)
- **`competitions`** (user_id, name 1–80, discipline `5k|10k|half_marathon|marathon`, distance_m aus der Disziplin,
  race_date, goal_kind `finish|time`, target_time_s, reference_* ganz oder gar nicht, long_run_weekday, status
  `planned|done|cancelled`, result_session_log_id, Plan-Bezug own_start_weekly_minutes/start_reference_*/effective_goal,
  uses_health_data): ein geplanter Wettkampf je Person; nur eigene Zeilen lesen, Schreiben nur über `save_competition`,
  `cancel_competition`, `complete_competition`, `delete_competition`. Kein Standort, nur Name/Datum (Abschnitt 10).
- **`planned_sessions`** ergänzt um `workout_type`, `training_phase`, `target_distance_m`, `workout_steps` (nur im
  Wettkampfplan); `effort_target` 1–8 statt 1–4, über 4 nur bei harter Art.
- **`log_source`** ergänzt um `gps`, `gpx_import` (vorbereitet für Strecken).

### Abweichungen ab Phase 10, Etappe S1 Teil 1 (umgesetzt, siehe `docs/PLAN-PHASE-10.md` Abschnitt 12 und `supabase/migrations/20261016220*`)
- **`tracked_routes`** statt der Kern-Tabelle `routes` für EIGENE Strecken (user_id, name 1–80, sport `run|bike|walk`,
  started_at, duration_s 1 min–12 h, moving_s, distance_m, elevation_gain_m, polyline (vereinfacht, höchstens 5.000
  Punkte), point_count und bbox (rechnet der Server), km_splits, difficulty `easy|medium|hard`, is_favorite,
  base_route_id (eigener Favorit), note, session_log_id (eigener Eintrag), source `recorded|gpx_import`): nur eigene
  Zeilen lesen, kein Partner-Zugriff; Schreiben nur über `save_tracked_route`, `update_tracked_route`,
  `delete_tracked_route`, `delete_all_tracked_routes` (Tageslimit 20). Kein Gesundheitsdatum (W-G15), bleibt beim
  Widerruf; im Export enthalten. `routes` (Vorschläge, Lizenz) bleibt für S2b.
- **`session_logs.source`** `gps`/`gpx_import` setzt nur `save_tracked_route` (Eintrag mit Strecke verknüpft); ein
  verknüpfter Eintrag muss zur Strecke passen (Art, Tag, Distanz, Dauer – `private.session_log_fits_route`).

### Abweichungen ab Phase 4b, Etappe E (umgesetzt, siehe `docs/PLAN-PHASE-4B.md` Abschnitt 7 und Umsetzungsstand E)
- **Lokal statt Push** (Gründer-Entscheidung Frage 8, Abweichung von PROMPTS „Mess-Erinnerungen per Push“):
  Mess-Erinnerung und Pausenende sind **lokale** Benachrichtigungen (`expo-notifications`), die die App auf dem Gerät
  plant – ohne Push-Token, ohne Server und ohne Versand über Expo, Apple oder Google mit Nutzerbezug. Datensparsamer:
  kein Auftragsverarbeiter, keine neue Tabelle, **keine Migration**. iOS ohne Push-Fähigkeit (`aps-environment`
  entfernt). Server-Push (z. B. „Dein Plan wurde angepasst“) erst später, falls gewünscht – dann Push-Token als
  personenbezogenes Datum und Expo Push Service als Auftragsverarbeiter.
- **`measurement_reminders.enabled`** bleibt der Schalter für den Hinweis auf „Heute“ (Standard an). Die Benachrichtigung
  ist eine eigene **Geräte-Einstellung** (Opt-in, Standard aus, nur auf dem Gerät, beim Abmelden zurückgesetzt).
- Mess-Erinnerung am Fälligkeitstag um 08:00 Ortszeit, nur mit gültiger `health_data`-Einwilligung; Text fest
  „Alpha5: Zeit für dein Mess-Update“, nie Werte. Im Browser keine Benachrichtigungen, nur ein Hinweis.

### Abweichungen ab Ziele, Etappe Z3 (umgesetzt, siehe `docs/PLAN-ZIELE.md` Abschnitt 13 und `supabase/migrations/20261017200*`)
- **`goals.secondary_goal_type`** (Nebenziel, null = keins): nur erlaubte Paare (`private.goal_pair_allowed` =
  `GOAL_COMBINATIONS`); Disziplin, wenn Ausdauer Haupt- **oder** Nebenziel ist. Kein Gesundheitsdatum.
- **`weight_goals`** (user_id, target_weight_kg 30–300 mit 0,1 kg, start_date = Tag des Speicherns, target_date 4–104
  Wochen danach, amount_mode `kg_to_lose|target_weight`, time_mode `weeks|date`) – **sensibel** (`health_data`), kein
  Startgewicht. Nur mit Abnehmziel (Trigger); wird gelöscht, wenn Abnehmen weder Haupt- noch Nebenziel ist, beim Widerruf
  und mit dem Konto; im Export enthalten; nie im Partner-Modus.
- **Onboarding-Schritt `weight_goal`** in der CHECK-Liste von `profiles.onboarding_step` (Bildschirm erst mit Z4).
- **Ziel-BMI-Untergrenze** (Gründer-Entscheidung F8, 17.10.2026): 20, ab 70 Jahren 22 (Alter am Zieldatum).

### Abweichungen ab Ziele, Etappen Z4/Z5 (umgesetzt, siehe `docs/PLAN-ZIELE.md` Abschnitte 14 und 15)
- **Z4:** Trigger `goals_clear_stale_secondary` (`…20261017220000_goals_secondary_autoclear.sql`) räumt ein unverändert
  mitgeführtes, nicht mehr passendes Nebenziel alter App-Stände auf.
- **Z5:** keine Migration. „Erreicht“ und „Zeitraum vorbei“ bleiben zustandslos aus Messungen bzw. Datum abgeleitet
  (keine Spalte). Der Abgleich-Schlüssel des Essensplans (`safetyKey`, nur auf dem Gerät) bekommt bei konkretem Ziel einen
  Teil `wg=<Stand>:<Kennung des Ziels>` – Hash aus Start, Zieldatum, Zielgewicht und Eingabeart, nicht im Klartext, und
  unabhängig vom aktuellen Gewicht (Wächter Z5 H1: eine neue Gewichtsangabe plant nur neu, wenn ein Tag aus dem Planband
  fällt). Ohne Ziel bleibt er unverändert.

## 13. Monetarisierung
- **Gratis:** Onboarding, Standard-Plan aus Vorlagen mit einfacher Progression (Gewicht steigt bei geschafften
  Wiederholungen), Trainingstagebuch, Grundberechnung Kalorien/Makros, Supplement-Übersicht, außerdem alles aus der
  Tabelle unten mit „Ja“ bei Gratis
- **Premium (Abo monatlich/jährlich):** Live-Anpassung des Plans, Ernährungsplan + Einkaufsliste (laut Phase-5-Entscheidung
  in der Testphase für alle offen, endgültig mit Phase 7; Bedarf, Makros, Timing, Rezepte und PDF gratis), Gerichte
  vor/während/nach dem Training (automatische Belegung, 6.6), alle Meal-Prep-Pläne, automatische Resteplanung,
  Paar-Modus beim Kochen, Wettkampfvorbereitung, Zyklus-Anpassung, Wearables & Readiness, Strecken-Vorschläge (Abschnitt 10),
  Partner-Modus, **alle KI-Funktionen** (KI-Coach, Kalorien per Foto, Körperfoto-Analyse, KI-Erklärungen) – siehe Abschnitt 15
- **Affiliate:** Supplement-Shops (gekennzeichnet, neutral)
- **Sponsoring:** optional bei Monats-Challenges (Rabattcode, als „Werbung“ gekennzeichnet, ohne Datenweitergabe)
- **B2B Fitnessstudios (später):** Studio-Branding, Geräteliste des Studios als Equipment-Profil, Trainer-Dashboard, Lizenz pro Mitglied

**Gratis / Premium für die Erweiterungen** (Vorschlag der Gründer, `docs/ERWEITERUNGEN.md`):

| Funktion | Gratis | Premium |
|---|---|---|
| Lebensmittel-Tracker mit Barcode | Ja | Ja |
| Standardgerichte | Ja | Ja |
| Fitnessstudio suchen und im Profil anlegen | Ja | Ja |
| Mitgliedschaft mit Laufzeit, Preis, Kündigungserinnerung | Ja | Ja |
| Strecken aufzeichnen, Favoriten, Schwierigkeit | Ja | Ja |
| Körperumfänge und Mess-Erinnerungen | Ja | Ja |
| Monats-Challenges | Ja | Ja |
| Einfache Progression (Gewicht steigt bei geschafften Wdh.) | Ja | Ja |
| Live-Anpassung des Plans (alle Regeln aus Abschnitt 4.1) | Nein | Ja |
| Gerichte vor, während und nach dem Training | Nein | Ja |
| Kalorien per Foto (KI) | Nein | Ja |
| Körperfoto-Analyse (KI) | Nein | Ja |

**Gratis / Premium für die Erweiterungen Teil 2** (`docs/ERWEITERUNGEN-2.md` Abschnitt 9; Premium in der Testphase für
alle offen, Server-Prüfung mit Phase 7):

| Funktion | Gratis | Premium |
|---|---|---|
| Rezeptsuche mit allen Filtern (6.5) | Ja | Ja |
| Ratgeber Wettkampf und Unterwegs (6.8) | Ja | Ja |
| Zutaten-Austausch (6.9) | Ja | Ja |
| Bewertung nach dem Essen (6.10) | Ja | Ja |
| Kühlschrank-Suche (6.11) | Ja | Ja |
| Einkaufsliste weitergeben (Text, PDF) (6.13) | Ja | Ja |
| Bedarf und Timing vor/nach dem Training, Suche in Pre-/Post-Workout und Cardio (6.6) | Ja | Ja |
| Meal-Prep-Wochenpläne mit Kochtag-Modus (6.7) | 1 Plan | Alle |
| Automatische Resteplanung (6.11) | Nein | Ja |
| Paar-Modus beim Kochen (6.12, ab Partner-Modus) | Nein | Ja |
| Rezepte automatisch passend zu jeder Trainingseinheit (6.3/6.6) | Nein | Ja |
| 20 Gratis-Rezepte als PDF auf der Landingpage (17) | Ja | – |

## 14. Rechtliches (vor Launch prüfen lassen)
- DSGVO Art. 9 Einwilligung, Datenschutzfolgenabschätzung, AV-Verträge (Supabase, Vercel, RevenueCat, Stripe)
- **DSFA-Ergänzung `weight_goals` (Ziele Z3–Z6):** Zweck: Ernährungsplanung mit konkretem Abnehmziel (nur auf Wunsch,
  Standard „ohne festes Ziel“). Daten: Zielgewicht, Start- und Zieldatum, Eingabeart – kein Startgewicht (Datensparsamkeit,
  K9). Rechtsgrundlage: ausdrückliche Einwilligung `health_data` (Art. 9 Abs. 2 a). Schutz: RLS nur eigene Zeile,
  Schreiben nur mit gültiger Einwilligung (Trigger mit Sperre gegen gleichzeitigen Widerruf), nur bei Abnehmen als Haupt-
  oder Nebenziel (sonst automatisch gelöscht), Löschung beim Widerruf und mit dem Konto, im Datenexport enthalten. Nie in
  Analytics, Logs, Crash-Reports, Trainings- oder Ernährungs-PDF, nie im Partner-Modus. Risiko „Druck durch Zahlen“
  (Essstörungen): harte Ziel-BMI-Untergrenze (20, ab 70 J. 22), Tempo nie schneller als ohne Ziel, keine Prognose, kein
  Fortschrittsbalken, Wunschgewicht und Zeitraum nur unter Einstellungen (auf „Heute“ nur die Karten
  „erreicht“/„Zeitraum vorbei“ ohne Zahlen), fester Hilfe-Hinweis, keine Abzeichen. Restrisiko: Das
  Wunschgewicht steht im Klartext in der Datenbank (wie `body_metrics`) – vor Livegang mit der DSFA bewerten.
- Abgrenzung zum Medizinprodukt (MDR): keine Diagnosen, keine Therapieaussagen
- Health-Claims-Verordnung, Kennzeichnung Werbung/Affiliate (UWG)
- App-Store-Richtlinien: In-App-Kauf für digitale Abos, HealthKit-Daten nicht für Werbung
- Impressum, AGB, Widerrufsbelehrung, Haftungsausschluss
- Schweiz (revDSG) und Österreich mitprüfen
- KI-Funktionen mit Fotos: Verarbeitung durch den KI-Anbieter (AV-Vertrag, Datenübermittlung, keine Nutzung zum Training) prüfen
- **KI-Anbieter Google Gemini (seit 14.10.2026):** Für die Offline-Inhalte (nur Inhalts-Prompts, keine Nutzerdaten) kein
  AVV nötig; nur bezahlte API-Stufe nutzen (Eingaben der kostenlosen Stufe darf Google zur Produktverbesserung
  verwenden). **Vor Premium-Echtzeit-KI (Phase 7b):** AVV/Datenverarbeitungsbedingungen mit Google abschließen,
  Serverstandort/Drittlandtransfer (SCC/DPF) prüfen, „keine Nutzung zum Training“ bestätigen, DSFA ergänzen –
  Gründer-Aufgabe
- Lizenzen: Open Food Facts und OpenStreetMap (ODbL) mit Quellenangabe in der App
- Nährwerte: Bundeslebensmittelschlüssel 4.0 (Max Rubner-Institut), Lizenz CC BY 4.0 – Namensnennung „Max
  Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe.
  DOI: 10.25826/Data20251217-134202-0“ in der App („Lizenzen“) und im PDF-Fuß, Änderungen kenntlich machen. Wortlaut
  der Nutzungsbedingungen auf https://blsdb.de/download von den Gründern am 12.10.2026 bestätigt (Screenshot); Bezug
  der Datei über diese Seite (docs/PLAN-PHASE-5.md Umsetzungsstand N2b)
- **Hilfe-Stellen bei Essstörungen (harte Freigabe-Bedingung, Phase 5 N4, Wächter N4 S5):** Namen, Erreichbarkeit und
  Telefonnummern für DE, AT und CH (CH inkl. Notruf 144 neben 112) fachlich prüfen und eintragen, BEVOR ein Build mit
  Supabase-Werten oder ein Store-Build (TestFlight/Play Store) erstellt wird. Bis dahin nur Namen ohne Nummern, nur im
  Testmodus (`apps/mobile/src/i18n/de-nutrition.ts`, Vermerk „VOR VERÖFFENTLICHUNG PRÜFEN“; Checkliste `docs/SETUP.md`
  Teil K)
- **Strichcode-Kamera (E4b, Pflicht vor dem Livegang):** `expo-camera` bindet auf Android Googles ML Kit
  (`com.google.mlkit:barcode-scanning`, Erkennung auf dem Gerät) und `play-services-code-scanner` ein. Klären und
  schriftlich festhalten, ob dabei Daten an Google gehen (ML-Kit-Bedingungen: Nutzungs-/Diagnosedaten, Google-Play-
  Dienste), ggf. Datenschutzerklärung und Play-Store-Datensicherheitsangaben anpassen. Bildinhalte verlassen das Gerät
  nach unserer Prüfung nicht. Lizenzhinweise Software von Dritten (zxing-cpp Apache 2.0: Lizenztext mitliefern?)
  prüfen. `docs/PLAN-E4.md` Umsetzungsstand E4b
- Standortberechtigung im Hintergrund (Strecken): Begründungstexte für App Store und Play Store
- Mitgliedschafts-Erinnerung: nur Erinnerung an selbst eingetragene Fristen, keine Rechtsberatung zur Kündigung
- Erweiterungen Teil 2: Lizenz der Nährwertdatenbank (Namensnennung) für alle 236 Zutaten; Ratgeber- und Rezepttexte
  gegen die Health-Claims-Verordnung; Preise nur als Schätzung (keine Preisangabe im Sinne der PAngV);
  Lead-Magnet-Einwilligung ohne Kopplung an den Newsletter (Abschnitt 17, Art. 7 Abs. 4 DSGVO);
  Händler-Anbindung nur über offizielle Schnittstellen bzw. Partnerprogramme, Kennzeichnung „Anzeige“
- Datenschutzerklärung, Abschnitt Auskunft/Datenexport (Phase 12, aus `docs/PLAN-PHASE-4.md` Etappe D): „Meine Daten
  exportieren“ liefert den Stand **auf dem Server** (alle eigenen Tabellen, Einwilligungs-Verlauf, Konto-E-Mail).
  Nicht enthalten sind Entwürfe und noch nicht übertragene Trainings auf dem Gerät (die App nennt deren Zahl vor dem
  Speichern), der interne Tageszähler gegen Missbrauch sowie Wartelisten-Einträge (Auskunft per E-Mail). Die Datei
  enthält Gesundheitsdaten und wird nur lokal gespeichert (Download bzw. selbst gewählter Ordner, kein Teilen-Dialog).

## 15. KI-Grenze & Premium-Prüfung
- **Gratis ohne KI, Premium mit KI:** Alle Funktionen mit Echtzeit-KI sind ausschließlich Premium – KI-Coach (Abschnitt 11),
  Kalorien per Foto (6.4), Körperfoto-Analyse (11.2), KI-Erklärungen in Worten (4.1) sowie der Plan-Fallback (4, Punkt 8).
- Alles andere läuft über feste Regeln und Datenbank, ohne laufende KI-Kosten.
- **Premium-Prüfung immer auf dem Server** (zentrale Funktion `hasEntitlement()`, Phase 7), nie nur in der App.
- **Monatslimit pro Nutzer und Funktion**, konfigurierbar; bei Kalorien per Foto zusätzlich ein Tageslimit.
  `ai_usage` protokolliert Funktion, Tokens, Kosten und Zeitpunkt – keine Inhalte.
- **Limit erreicht:** klare Meldung („Dein Kontingent für … ist diesen Monat aufgebraucht, ab … wieder verfügbar“),
  keine stille Fehlfunktion. Die Grundfunktion ohne KI (z. B. manuelles Eintragen) bleibt nutzbar.
- Alle KI-Funktionen hinter Feature-Flag; Kostenübersicht im Admin-Bereich.
- **Stand E3 (16.10.2026):** `ai_usage` (nur Metadaten, RLS: eigene Zeilen lesen, schreiben nur der Server über
  `ai_food_photo_reserve`/`ai_food_photo_finish`), Feature-Flags und Beta-Freischaltung in `private.*`
  (`private.has_entitlement_for` = die eine Stelle für `hasEntitlement()`, Phase 7 ersetzt nur deren Rumpf), Workflow
  `beta-grant` (freischalten/entziehen/Flag/Status mit Kostensummen statt Admin-Seite). Grenzen in
  `packages/core/src/constants.ts` (`AI_FOOD_PHOTO`, Preise VOR LIVEGANG PRÜFEN).
- **KI-Anbieter: Google Gemini (API)** für Offline-Inhalte und Premium-KI (Gründer-Entscheidung 14.10.2026). Offline
  gehen nur Inhalts-Prompts an Gemini; bevor Premium-Funktionen Nutzerdaten (Fotos, Chat, Körperdaten) an Gemini
  senden, braucht es den AVV mit Google und die Prüfungen aus Abschnitt 14 (Gründer-Aufgabe).
- **Übungs-Präferenzen gehen nicht an den KI-Coach** („Mag ich nicht“ / „Hier nicht machbar“,
  `docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md` Abschnitt 6, D-5) – nur nach neuer Datenschutz-Bewertung.
  **DSFA-Merkposten (Restrisiko):** Ein Muster von Ausschlüssen (z. B. alle kniebelastenden Übungen) könnte mittelbar
  auf Beschwerden schließen lassen (EuGH C-184/20). Milderung: kein Grund-Feld mit Gesundheitsbezug, kein Freitext, RLS,
  Export, Löschung, keine Auswertung außerhalb des Tauschs, keine Weitergabe an Analytics, Logs oder Partner.

## 16. Fitnessstudio & Mitgliedschaft (Gratis)
- **Studio in der Nähe:** Suche im Umkreis des Standorts über **OpenStreetMap** (kostenlos; andere Anbieter nur nach
  Kostenprüfung). Quellenangabe nach ODbL.
- Studio im Profil als **„Mein Studio“** speichern.
- Hat das Studio eine hinterlegte Geräteliste (Partnerstudio oder vom Nutzer gepflegt), nutzt die Plan-Engine sie
  automatisch als **Equipment-Profil** für den Ort „Studio“ (Abschnitt 4).
- Vorbereitung für B2B: Feld „Partnerstudio“, später eigene Geräteliste und Branding (`organizations`).
- **Mitgliedschaft:** Studio, Vertragsbeginn, Mindestlaufzeit, Kündigungsfrist, Monatsbeitrag, Notizen.
- **Erinnerung vor Ablauf der Kündigungsfrist** (z. B. 4 Wochen und 1 Woche vorher).
- Kennzahl **„Kosten pro Trainingsbesuch“** aus Beitrag und protokollierten Studio-Einheiten.

## 17. Lead-Magnet auf der Landingpage (Erweiterungen Teil 2)
- Abschnitt **„20 Rezepte gratis als PDF“** vor der Warteliste, mit Vorschaubild (Deckblatt) und Formular (E-Mail +
  Einwilligung). PDF: `apps/web/public/downloads/Alpha5-Gratis-Rezepte.pdf`.
- Ablauf: Eintrag in `waitlist` mit `source = 'lead-magnet'` → Double-Opt-in-Mail → nach Bestätigung Mail mit
  Download-Link. Spamschutz wie bei der Warteliste.
- **Gründer-Entscheidung 11.10.2026:** Download **ohne Newsletter-Pflicht** – Pflicht-Häkchen nur für den Download-Link,
  Newsletter über ein **separates, freiwilliges, nicht vorausgewähltes Häkchen** (kein Kopplungsproblem nach Art. 7
  Abs. 4 DSGVO). Abmeldung jederzeit. Ohne Newsletter werden Adressen 30 Tage nach der Bestätigung gelöscht.
- Tracking ohne Gesundheitsdaten: nur Anzahl Anmeldungen und Bestätigungen.
- Umsetzung und Klick-Schritte: `docs/SETUP.md` Abschnitt I7 (Prompt G). Vor dem Livegang: Einwilligungs- und
  Mail-Texte rechtlich prüfen; Texte im PDF gegen die Health-Claims-Verordnung prüfen.
- **Bedingung für den Livegang – Nährwerte im PDF:** Sie stammen aus der Gründer-Datei, nicht aus der amtlichen
  Datenbank. Die 20 Rezepte werden nach dem Katalog-Import (Phase 5, N2b) gegen die Katalogwerte geprüft (Abweichung
  > 3 % → PDF korrigieren) und fachlich geprüft. Bis dahin trägt das PDF die Kennzeichnung „Richtwerte, nicht fachlich
  geprüft“ – oder es geht erst danach live.

## 18. Erweiterungen Teil 2: Konflikte mit bestehenden Regeln und ihre Auflösung
| Thema | Konflikt | Auflösung |
|---|---|---|
| Einkaufsliste weitergeben vs. „Kein Teilen, keine Community“ | ERWEITERUNGEN-2 Abschnitt 7 erlaubt Teilen per System-Dialog | **Privates Weitergeben** durch den Nutzer selbst an Menschen/Apps seiner Wahl ist kein öffentliches Teilen (kein Profil, kein Feed, keine Sichtbarkeit für andere Nutzer). Inhalt wie beim PDF: keine kcal, keine Gründe, kein Körpergewicht; Hinweis bei verräterischen Ersatzprodukten. Der Datenexport (Abschnitt 14) bleibt ohne Teilen-Dialog, weil er Gesundheitsdaten enthält. |
| Nährwert-Herkunft | Die Gründer-Datei enthält Nährwerte pro 100 g und pro Portion | Maßgeblich sind **nur** die Werte aus der amtlichen Datenbank (maschineller Import, Phase 5); jede der 236 Zutaten bekommt einen Quell-Eintrag. Datei-Werte nur als Gegencheck, Abweichung > 3 % wird gemeldet. |
| Filter über `ernaehrungsformen` | ERWEITERUNGEN-2: „Filter immer über dieses Feld“ | Gefiltert wird über die **aus den Zutaten berechnete** Ernährungsform (gleiche Bedeutung „passt für“, 6.5). Das Feld der Datei ist Gegencheck; Abweichung → Rezept bleibt Entwurf, bis geklärt (Prüfregeln R6/R8). |
| Allergene | Die Datei enthält keine Allergen-Angaben | Allergene kommen aus den Allergen-Pflichtregeln für alle 23 Gruppen (Phase 5, N2a) und der menschlichen Katalog-Prüfung. |
| Paar-Modus | braucht zwei verknüpfte Konten; Portionen verraten Bedarf und Unverträglichkeiten | Erst mit dem **Partner-Modus (Phase 11)**, als eigener Bereich mit eigener Art.-9-Einwilligung beider Personen; die Rechenlogik (Portionsfaktor) kommt vorher, die Oberfläche danach. |
| „Rezepte passend zu jeder Einheit“ Premium vs. Phase-5-Timing gratis | Phase 5 hat Bedarf und Timing gratis entschieden | **Bedarf, Zeitfenster, Timing-Hinweise und die Suche gratis; die automatische Rezept-Belegung je Einheit Premium** (6.3, 6.6). |
| Budget/Kosten | Phase 5 (Frage 13): „kein Budget“ | Neuer Gründer-Wunsch ersetzt das: Filter „max. Kosten“ und Spar-Küche, Preise **nur als Schätzung** gekennzeichnet (6.13). |
| Meal-Prep-Haltbarkeit | Pläne der Datei nennen z. B. „Curry mit Reis 3–4 Tage“ | Es gelten die Haltbarkeitsregeln aus Phase 5 (u. a. gekochter Reis 1 Tag im Kühlschrank, sonst einfrieren/frisch kochen), auch nach einem Zutaten-Tausch; maschinell geprüft über einen strukturierten Aufbewahrungsplan. Wie die Pläne angepasst werden, ist Gründer-Frage (`docs/PLAN-PHASE-5.md` 19.12 (b)). |
| Meal-Prep-Pläne als festes Rezept-Bündel | ein Plan könnte Ausschlüsse umgehen | Jedes Rezept läuft durch den kompletten Filter; passt eines nicht, wird der Plan nicht angeboten (6.7). |
| Lead-Magnet-PDF | Nährwerte aus der Gründer-Datei gehen öffentlich | Livegang-Bedingung: Abgleich mit den Katalogwerten + Fachprüfung, bis dahin Kennzeichnung „Richtwerte“ (Abschnitt 17). |
| Bewertung „Unverträglich“ | wäre ein Gesundheitsdatum (Art. 9) in `recipe_ratings` | Grund wird nicht gespeichert; nur Dialog „als ‚mag ich nicht‘ übernehmen?“ (Bestätigung durch den Nutzer); eine Unverträglichkeit nur über das Profil mit `health_data`-Einwilligung. |
| Import „in die Datenbank“ (Prompt B) | Inhalte fließen nur Repository → Datenbank, Entwürfe nie nach Supabase | Import erzeugt Inhaltsdateien als `draft` per Pull Request; `content-seed` spielt weiter nur Freigegebenes ein; Admin-Bereich schreibt nicht in die Datenbank (Sammelfreigabe über `content-review`). |
| Carb-Loading / Portionsfaktor / Tausch vs. Kalorien-Schutzgrenzen | alle verändern Mengen | `clampCalorieTarget` bleibt die **einzige** Stelle mit Schutzgrenzen; jeder Tag bleibt zwischen Unter- und Obergrenze. an Carb-Loading-Tagen Erhalt statt Defizit (ohne 4b-Versatz) und Makro-Verschiebung innerhalb des begrenzten Ziels (Fett ≥ 20 %, Eiweiß-Minimum); Portionsfaktor und Tausch rechnen nur mit begrenzten Zielen. |
