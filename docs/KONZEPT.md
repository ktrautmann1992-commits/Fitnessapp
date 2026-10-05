# Fachkonzept – Alpha5

Eingearbeitet: Erweiterungen aus dem Brainstorming der Gründer (`docs/ERWEITERUNGEN.md`). Die Abschnittsnummern 1–14
bleiben stabil, weil andere Dokumente darauf verweisen; neue Themen stehen als Unterabschnitte (z. B. 4.1, 6.1) oder
in den neuen Abschnitten 15 und 16.

**Grundregeln für alle Erweiterungen:** Echtzeit-KI nur für Premium (Abschnitt 15). Kein Teilen, keine Community,
keine Ranglisten, keine öffentlichen Profile – Strecken, Fotos, Abzeichen und Challenges bleiben privat
(Ausnahme nur Partner-Modus, Abschnitt 11).

## 1. Zielgruppe & Ziele
- DACH, Einsteiger, Fortgeschrittene, ambitionierte/professionelle Ausdauersportler
- Ziele: Fettverlust, Definition, Muskelaufbau, Allgemeine Fitness, Ausdauer
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
6. Ziel + ggf. Disziplin + Wettkampfdatum
7. Trainingstage (seit Phase 3, Etappe B2 – `docs/PLAN-PHASE-3-ERWEITERUNG.md`): je Wochentag Trainingsart (Kraft im Studio / Kraft zu Hause / Ausdauer mit Untertitel nach Disziplin) und Dauer (20/30/45/60/90 min oder eigene 10–240) – oder „Tage egal“ mit Anzahl je Art und Dauer; Live-Zusammenfassung und freundliche Hinweise (nie blockierend)
8. Trainingsort: **entfällt als eigener Schritt** – abgeleitet aus den Trainingstagen (nur Studio / nur zu Hause / beides / nur Ausdauer)
9. Equipment zu Hause (nur bei mindestens einem Tag „Kraft zu Hause“): Gewichte zum Antippen (Mehrfachauswahl) + eigene Werte – Kurzhanteln (je Hantel), Langhantel = Stange (10/15/20 kg oder eigene 5–25) + Scheiben je Paar (≤ 25 kg), Kettlebells (kg), Flachbank, Schrägbank, Klimmzugstange, Widerstandsbänder, Rudergerät, Ergometer, Laufband, Sonstiges (Freitext)
10. Ernährung: omnivor / vegetarisch / vegan; Schwein ja/nein; mag / mag nicht (Lebensmittel-Auswahl); Unverträglichkeiten; Mahlzeiten pro Tag
11. Kochmodus: täglich frisch / Meal-Prep (wie oft pro Woche)
- E. Fertig: Zusammenfassung
- Wearable verbinden: **in Phase 1 entfallen**, kommt mit Phase 8 (optional, überspringbar)

## 3. Content-Pipeline (Offline-KI)
- Skripte in `packages/content` erzeugen per Claude Message Batches API (kostengünstig, asynchron):
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
  Claude Message Batches API (Structured Outputs, Kostenschätzung vorab, Deckel `CONTENT_MAX_USD`, höchstens 200
  Anfragen) und endet; `content-collect` (alle 3 Stunden + per Hand) holt die Ergebnisse über `custom_id` ab, speichert
  gültige Antworten als `draft` (`origin: batch`), prüft alles und öffnet einen Pull Request; `content-review` setzt den
  Status per Pull Request; `content-seed` prüft alles und spielt nur `published` ein. Inhaltsarten (`exercise`,
  `plan_template`) sind austauschbar – Rezepte kommen in Phase 5 als weitere Art dazu. Probelauf ohne Schlüssel.

## 4. Trainingsplan-Engine (`packages/core/plan`)
1. **Matching:** passende Vorlage nach Ziel, Level, Tagen, Dauer, Equipment-Profil (Scoring, beste Übereinstimmung)
2. **Equipment-Anpassung:** Übung nicht machbar → Alternative aus Bibliothek mit gleichem Bewegungsmuster/Muskelgruppe
3. **Terminierung:** Einheiten auf bevorzugte Wochentage, Erholungsabstände beachten
4. **Laststeuerung:** Startgewichte aus Selbsteinschätzung bzw. erstem Testtraining; danach doppelte Progression (erst Wiederholungen, dann Gewicht); RPE-Ziel pro Satz
5. **Deload:** alle 4–6 Wochen bzw. bei sinkender Leistung/hoher Belastungsempfindung
6. **Ausdauer:** Intensitätsverteilung ca. 80/20, Zonen aus Testlauf/Herzfrequenz, Umfangsteigerung ≤10 %/Woche, Tapering vor Wettkampf
7. **Neuplanung:** verpasste Einheiten sinnvoll verschieben oder streichen, nie stapeln
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
- Ausdauer-Ziel klarer (Gründer-Feedback „Ziel Marathon → Plan für allgemeine Fitness“): Beim Ziel Ausdauer belegt
  „Deine Trainingstage“ Ausdauer-Tage vor (`suggestedTrainingSlots`, Werte `ENDURANCE_GOAL_SUGGESTION`: 3 Ausdauer + 2 Kraft,
  Leistungssport 4 + 2, vorsichtig 2 + 1, Triathlon mehr Ausdauer; Deckel wie oben) – nur ohne gewählte Tage, änderbar
  („Ohne Vorschlag planen“). Der Plan heißt „Ausdauer-Grundlage – <Disziplin>“ (`planTitle`, nur Anzeige; gespeichert bleibt
  `template_title_de`). Hinweis: Wettkampfplan rückwärts ab Renndatum kommt in Phase 10.

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

## 5. Tagesansicht & Trainingstagebuch
- Heute: geplante Einheit mit allen Übungen, Sätzen, Wiederholungen, Zielgewicht, Pause
- Pro Übung: abhaken / nicht gemacht / Alternative durchgeführt (Auswahl aus Alternativen)
- Pro Satz: Gewicht, Wiederholungen, optional RPE
- Ausdauer: Distanz, Zeit, Pace/Geschwindigkeit, Höhenmeter, Herzfrequenz (manuell oder aus Wearable)
- Belastungsempfinden der Einheit: Schieberegler 0–10
- Notizen, Pausentimer, Aufwärm- und Mobility-Block, Übungsvideos/Animationen
- In der App aufgezeichnete Strecken (Abschnitt 10.1) landen automatisch als Ausdauer-Eintrag im Tagebuch
- Offline-fähig, Sync später

## 6. Ernährungs-Engine (`packages/core/nutrition`)
- Grundumsatz: Mifflin-St Jeor (bzw. Katch-McArdle, wenn Körperfett bekannt)
- Gesamtumsatz: Grundumsatz × Alltagsfaktor + Trainingsenergie der geplanten Einheiten (tagesgenau)
- Zielanpassung: Defizit/Überschuss je Ziel, mit Schutzgrenzen aus CLAUDE.md
- Makros: Eiweiß nach g/kg je Ziel; Kohlenhydrate bei Ausdauer an Trainingslast periodisiert; Rest Fett (Mindestmenge einhalten)
- Timing: Mahlzeit vor dem Training (2–3 h vorher) bzw. Snack (30–60 min vorher), Mahlzeit nach dem Training mit Eiweiß + Kohlenhydraten; an Tagen mit langen Einheiten Verpflegung während des Trainings
- Wettkampf: Carb-Loading-Tage, Frühstück am Wettkampftag, Gel-/Trinkplan
- Plan-Erzeugung: Rezepte aus Datenbank filtern (Vorlieben, Ernährungsform, Kochmodus) → Optimierung auf Tagesmakros (Portionsgrößen skalieren) → Wochenplan
- Einkaufsliste: aggregiert, nach Supermarkt-Abteilung sortiert, abhakbar, Meal-Prep-Mengen
- Lebensmittel tauschen, Barcode-Scanner (Open Food Facts; Lizenz beachten, Abschnitt 6.1)

### 6.1 Lebensmittel-Tracker mit Barcode-Scan (Gratis)
- Scan über die Handykamera, Abfrage bei **Open Food Facts**; Ergebnis in `food_products` zwischenspeichern
- **Lizenz ODbL:** Quellenangabe „Daten von Open Food Facts (ODbL)“ sichtbar in der App (Produktansicht und Impressum/Lizenzen)
- Nicht gefunden: manuell anlegen (Name, Marke, kcal, Eiweiß, Kohlenhydrate, Fett pro 100 g) – nur für den eigenen Nutzer sichtbar
- Menge eingeben (g, Stück, Portion), Zuordnung zu Mahlzeit: Frühstück, Mittag, Abend, Snack, vor/nach Training
- Tagesübersicht: Ziel aus der Ernährungs-Engine gegen tatsächlich Gegessenes
- „Zuletzt gegessen“ und Favoriten für schnelles Eintragen

### 6.2 Standardgerichte (Gratis)
- Eigene Gerichte anlegen („Mein Porridge“, „Shake nach dem Training“) mit kcal und Makros – direkt eingegeben oder aus Zutaten berechnet
- Mit einem Tipp ins Tagebuch, Portion anpassbar

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

### 6.4 Kalorien per Foto (Premium, KI)
- Foto der Mahlzeit → Claude-API mit Bildeingabe schätzt Lebensmittel und Portionen → Abgleich mit Lebensmitteldatenbank
- Ergebnis immer als **Vorschlag**: Nutzer bestätigt oder korrigiert Lebensmittel und Mengen, erst dann wird eingetragen
- Sichtbarer Hinweis, dass es sich um eine **Schätzung** handelt
- Foto standardmäßig **nach der Auswertung löschen**; speichern nur, wenn der Nutzer es aktiv möchte
- Foto und Schätzung gelten als Gesundheitsdaten → **eigene Einwilligung** (inkl. Hinweis auf Verarbeitung durch den KI-Anbieter)
- Tages- und Monatslimit über `ai_usage` (Abschnitt 15)

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
  Gesundheits- und Zyklusdaten sind davon ausgeschlossen, solange nicht ausdrücklich anders beschlossen.
- Wettkampf-Countdown, Erfolge (dezent, nicht ans Gewicht gekoppelt)

### 11.1 Körperumfänge mit Mess-Erinnerung (Gratis) – Grundlage in Phase 1 umgesetzt
- Erfassung: Oberarm, Brust, Schulter, Taille, Bauch, Oberschenkel, optional Hüfte, Wade; links/rechts wo sinnvoll
- Im Onboarding als **optionaler** Schritt mit kurzer Mess-Anleitung pro Stelle (Bild/Animation)
- **Mess-Update:** Erinnerung in festem Abstand (Standard alle 4 Wochen = 28 Tage, einstellbar 7–90) zum Nachmessen, zusammen mit Gewicht
- Verlaufsdiagramme pro Umfang; Werte fließen in die Live-Anpassung (Abschnitt 4.1)
- Umgesetzt in Phase 1 (Etappe A): Tabellen `body_measurements` und `measurement_reminders`, an die `health_data`-Einwilligung
  gebunden (siehe Abschnitt 12, Abweichungen). Push-Erinnerung, Verlaufsdiagramme und Anleitungsbilder folgen später.

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
- `foods`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_items`, `shopping_lists`, `shopping_list_items`
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
  aktiver Plan; die 48-h-Regel bleibt eine App-Regel). Anlegen nur über `save_training_plan(p_plan)` und
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

## 13. Monetarisierung
- **Gratis:** Onboarding, Standard-Plan aus Vorlagen mit einfacher Progression (Gewicht steigt bei geschafften
  Wiederholungen), Trainingstagebuch, Grundberechnung Kalorien/Makros, Supplement-Übersicht, außerdem alles aus der
  Tabelle unten mit „Ja“ bei Gratis
- **Premium (Abo monatlich/jährlich):** Live-Anpassung des Plans, Ernährungsplan + Einkaufsliste, Gerichte vor/während/nach
  dem Training, Wettkampfvorbereitung, Zyklus-Anpassung, Wearables & Readiness, Strecken-Vorschläge (Abschnitt 10),
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

## 14. Rechtliches (vor Launch prüfen lassen)
- DSGVO Art. 9 Einwilligung, Datenschutzfolgenabschätzung, AV-Verträge (Supabase, Vercel, RevenueCat, Stripe)
- Abgrenzung zum Medizinprodukt (MDR): keine Diagnosen, keine Therapieaussagen
- Health-Claims-Verordnung, Kennzeichnung Werbung/Affiliate (UWG)
- App-Store-Richtlinien: In-App-Kauf für digitale Abos, HealthKit-Daten nicht für Werbung
- Impressum, AGB, Widerrufsbelehrung, Haftungsausschluss
- Schweiz (revDSG) und Österreich mitprüfen
- KI-Funktionen mit Fotos: Verarbeitung durch den KI-Anbieter (AV-Vertrag, Datenübermittlung, keine Nutzung zum Training) prüfen
- Lizenzen: Open Food Facts und OpenStreetMap (ODbL) mit Quellenangabe in der App
- Standortberechtigung im Hintergrund (Strecken): Begründungstexte für App Store und Play Store
- Mitgliedschafts-Erinnerung: nur Erinnerung an selbst eingetragene Fristen, keine Rechtsberatung zur Kündigung

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
