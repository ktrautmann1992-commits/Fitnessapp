# Erweiterungen Teil 2 – Rezepte, Küche und Lead-Magnet

Ergänzt `docs/KONZEPT.md`, `docs/PROMPTS.md` und `docs/ERWEITERUNGEN.md`. Es gelten weiter alle Regeln aus `CLAUDE.md`, besonders: **Gratis ohne Echtzeit-KI, KI-Funktionen nur Premium**, kein Teilen und keine Community.

Zugehörige Dateien (liegen im Hauptverzeichnis, bis Prompt B sie einsortiert):
- `alpha5-rezepte.json` – Startbestand: 242 Rezepte, 236 Zutaten, 4 Meal-Prep-Wochenpläne, 2 Ratgeber
- `Alpha5-Gratis-Rezepte.pdf` – Lead-Magnet mit 20 Rezepten für die Landingpage

---

## 1. Rezept-Startbestand (`alpha5-rezepte.json`)

Aufbau:
- `zutaten[]`: `id`, `name`, `abteilung` (Supermarkt-Bereich), `pro_100g` (kcal, eiweiss_g, kohlenhydrate_g, fett_g), bei manchen `preis_eur_kg_schaetzung`
- `rezepte[]`: `id`, `name`, `beschreibung`, `kategorie`, `abschnitt` (z. B. Frühstück oder „60–90 Min. vorher“), `ernaehrungsformen[]`, `zeit_min`, `portionen`, `tags[]`, `zutaten[]` (zutat_id, menge_g, anzeige), `zubereitung[]`, `tipp`, `naehrwerte_pro_portion`, `status` = "draft", optional `kosten_eur_pro_portion`, `meal_prep_plan`
- `kategorien[]`: 4 Ernährungsformen + 8 Themen: Fertig in 10 Minuten, Pre-Workout, Post-Workout, Cardio & Ausdauer, Wettkampftag, Meal-Prep-Wochenpläne, Protein-Desserts, Spar-Küche
- `meal_prep_plaene[]`: Kochtag-Ablauf mit Startminuten, Aufbewahrung, Hinweis fürs Abendessen
- `ratgeber`: `wettkampf` (8 Abschnitte) und `unterwegs` (Grundregeln + 10 Orte)

Regeln:
- `ernaehrungsformen` nennt alle Gruppen, für die ein Rezept passt (vegan → alle vier). Filter in der App immer über dieses Feld, nie über `kategorie`.
- Mengen gelten für `portionen` (meist 1, Meal-Prep 5). Nährwerte sind schon pro Portion berechnet; beim Import trotzdem aus den Zutaten nachrechnen und Abweichungen > 3 % melden.
- Alle Rezepte kommen als `draft` und laufen durch den vorhandenen Freigabe-Prozess im Admin-Bereich.

## 2. Rezepte in der App

- **Rezeptsuche mit Filtern:** Ernährungsform (aus dem Profil vorbelegt), Kategorie, Mahlzeit/Zeitpunkt, „Unter 10 Minuten“, max. Kosten, Vorlieben/Abneigungen aus dem Profil.
- **Trainingsbezug:** Die Ernährungs-Engine schlägt vor jeder geplanten Einheit Rezepte aus *Pre-Workout*, danach aus *Post-Workout* vor; bei Ausdauereinheiten ab 75 Min. aus *Cardio & Ausdauer* inkl. Verpflegung unterwegs. Steht ein Wettkampf im Kalender, werden die Tage davor mit *Wettkampftag*-Rezepten geplant (Carb-Loading nur bei Wettkämpfen ab ca. 90 Min.).
- **Meal-Prep-Modus:** Plan wählen → Einkaufsliste → Kochtag-Ansicht mit Schritt-für-Schritt-Ablauf und Timern nach den Startminuten → Wochenplan Mo–Fr wird automatisch belegt, Abendessen bleibt frei für frische Rezepte.
- **Ratgeber-Seiten:** „Wettkampf-Ernährung“ und „Unterwegs essen“ als lesbare Seiten, offline verfügbar.
- **Portionen skalieren:** jede Rezeptansicht mit Portionswähler; Meal-Prep-Rezepte zeigen Gesamtmenge und pro Portion.

## 3. Zutaten-Austausch (Gratis, ohne KI)

- Nutzer tippt auf eine Zutat → „Austauschen“ → Liste passender Alternativen → Nährwerte und Einkaufsliste werden neu berechnet.
- Datenbasis: Tabelle `ingredient_substitutions` (zutat, ersatz, faktor, rolle, hinweis). `rolle` = eiweiß, kohlenhydrat, fett, gemüse, würze, süße. Der `faktor` hält die Hauptrolle gleich (z. B. Eiweißmenge bei Eiweißquellen).
- Nur Alternativen anbieten, die zur Ernährungsform und zu Unverträglichkeiten des Nutzers passen.
- Die Austausch-Tabelle wird offline über die Content-Pipeline erzeugt (Claude Batch-API), gegen ein Schema geprüft und im Admin-Bereich freigegeben – keine Echtzeit-KI.

## 4. Bewertung nach dem Essen (Gratis, ohne KI)

- Nach einer geplanten Mahlzeit: Daumen hoch/runter, optional Grund: „Schmeckt mir nicht“, „Zu aufwendig“, „Zu teuer“, „Macht nicht satt“, „Unverträglich“.
- Empfehlung nach festen Regeln: Daumen hoch → häufiger vorschlagen; Daumen runter → 8 Wochen nicht mehr vorschlagen; „Unverträglich“ → Zutat als Abneigung im Profil vorschlagen (Nutzer bestätigt); „Zu aufwendig“ → mehr Rezepte unter 15 Min.
- Tabelle `recipe_ratings` (user_id, recipe_id, wert, grund, datum) mit RLS. Bewertungen sind privat und werden nicht angezeigt (keine Community).

## 5. Resteverwertung (Kühlschrank-Suche gratis, automatische Resteplanung Premium)

- **Kühlschrank-Suche (Gratis):** „Was habe ich da?“ – Nutzer wählt Zutaten aus → Rezepte sortiert nach Übereinstimmung (Anteil der vorhandenen Zutaten, gewichtet nach Menge), gefiltert nach Ernährungsform.
- **Packungsgrößen:** Feld `packungsgroesse_g` bei Zutaten (übliche Handelsgröße, z. B. Brokkoli 500 g, Quark 500 g). Wird über die Content-Pipeline vorgeschlagen und im Admin freigegeben.
- **Automatische Resteplanung (Premium):** Beim Erzeugen des Wochenplans rundet die Einkaufsliste auf Packungen auf. Was übrig bleibt, erhöht den Score von Rezepten, die diese Zutat verbrauchen (frische Zutaten mit kurzer Haltbarkeit zuerst). Anzeige: „Dieses Rezept verbraucht deinen restlichen Brokkoli.“
- Regel-Engine in `packages/core/nutrition/leftovers.ts` mit Tests.

## 6. Paar-Modus beim Kochen (Premium)

- Baut auf dem Partner-Modus auf (beidseitige Zustimmung). Gemeinsame Mahlzeiten werden einmal geplant, aber für jede Person eigene Portion berechnet.
- Portionsfaktor pro Person = Kalorienziel dieser Mahlzeit ÷ kcal pro Portion des Rezepts, begrenzt auf 0,6–1,8, gerundet auf sinnvolle Schritte (z. B. 10 g bei Beilagen, halbe Eier nicht).
- Optional: Beilagen (Reis, Nudeln, Kartoffeln) unterschiedlich skalieren, Eiweißquelle gleich lassen – die Rezept-Zutaten bekommen dafür die Rolle aus Abschnitt 3.
- Eine gemeinsame Einkaufsliste mit Summe beider Portionen. Anzeige im Rezept z. B.: „Anna 180 g Reis · Ben 120 g Reis“ (Namen aus den Profilen).
- Monetarisierung prüfen: „Partner-Abo“ (zwei Konten, ein günstigerer Preis).

## 7. Einkaufsliste weitergeben (Gratis) und Händler-Anbindung (später)

- Sofort: Einkaufsliste als Text teilen (System-Teilen-Dialog → WhatsApp, Notizen, Erinnerungen), als PDF exportieren, gemeinsame Liste im Paar-Modus.
- Später: Anbindung an Lebensmittel-Lieferdienste oder Supermärkte. **Vorher klären**, ob und zu welchen Bedingungen ein Händler eine Schnittstelle oder ein Partner-/Affiliate-Programm anbietet; keine inoffiziellen Schnittstellen nutzen. Technisch als Modul mit Feature-Flag vorbereiten, Affiliate-Links gekennzeichnet („Anzeige“).

## 8. Lead-Magnet auf der Landingpage

- Neuer Abschnitt vor der Warteliste: „20 Rezepte gratis als PDF“ mit Vorschau-Bild (Deckblatt des PDFs) und Formular (E-Mail + Einwilligung).
- Ablauf: Eintrag in `waitlist` mit `source = 'lead-magnet'` → Double-Opt-in-Mail → nach Bestätigung Mail mit Download-Link. Das PDF liegt in `apps/web/public/downloads/` oder in einem öffentlichen Supabase-Bucket.
- Einwilligungstext klar formulieren: Wofür die E-Mail genutzt wird (Infos zum Start von Alpha5 und Newsletter), Abmeldung jederzeit. **Hinweis:** Ob der Download an die Newsletter-Einwilligung gekoppelt werden darf, vor dem Livegang rechtlich prüfen lassen; alternativ den Download ohne Newsletter-Pflicht anbieten.
- Tracking ohne Gesundheitsdaten: nur Anzahl Anmeldungen und Bestätigungen.

## 9. Gratis / Premium – Ergänzung

| Funktion | Gratis | Premium |
|---|---|---|
| Rezeptsuche mit allen Filtern | Ja | Ja |
| Ratgeber Wettkampf und Unterwegs | Ja | Ja |
| Zutaten-Austausch | Ja | Ja |
| Bewertung nach dem Essen | Ja | Ja |
| Kühlschrank-Suche | Ja | Ja |
| Einkaufsliste teilen | Ja | Ja |
| Meal-Prep-Wochenpläne mit Kochtag-Modus | 1 Plan | Alle |
| Automatische Resteplanung | Nein | Ja |
| Paar-Modus beim Kochen | Nein | Ja |
| Rezepte automatisch passend zu jeder Trainingseinheit | Nein | Ja |

---

## Prompts für Claude Code

Jede Sitzung beginnt implizit mit: „Lies CLAUDE.md und die genannten Dateien. Erst Plan in einfachen Worten zeigen und auf Freigabe warten. Ergebnis als Pull Request mit ‚So testest du es am Handy‘.“

### Prompt B – Dokumente einarbeiten und Rezepte importieren
(Nach Phase 5 – Ernährungs-Engine. Wenn ihr früher startet, nur Schritt 1 und 2 ausführen.)
```
Lies CLAUDE.md und ERWEITERUNGEN-2.md im Hauptverzeichnis.
1. Verschiebe ERWEITERUNGEN-2.md nach docs/, alpha5-rezepte.json nach packages/content/seed/ und Alpha5-Gratis-Rezepte.pdf nach apps/web/public/downloads/.
2. Arbeite ERWEITERUNGEN-2.md in docs/KONZEPT.md (Abschnitte und Gratis/Premium-Tabelle) und docs/PROMPTS.md (neue Phasen an passender Stelle) ein.
3. Erweitere das Datenbankschema für Rezepte, falls nötig: Kategorien, Ernährungsformen (n:m), Tags, Abschnitt, Portionen, Kosten, Meal-Prep-Pläne mit Kochtag-Schritten, Ratgeber-Seiten. Migrationen mit RLS (Inhalte für alle lesbar, Schreiben nur Admin).
4. Schreibe ein Import-Skript in packages/content (idempotent über die ids), validiere die Datei mit Zod, rechne Nährwerte aus den Zutaten nach und melde Abweichungen über 3 %. Lege den GitHub-Workflow content-seed so an, dass er die Datei importiert (manuell startbar).
5. Alle importierten Rezepte bleiben status=draft und erscheinen im Admin-Bereich zur Freigabe; baue dort eine Sammel-Freigabe pro Kategorie.
Zeig mir am Ende, wie viele Rezepte, Zutaten und Pläne importiert wurden.
```

### Prompt C – Rezepte in der App
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 2 um: Rezeptsuche mit Filtern (Ernährungsform aus dem Profil vorbelegt), Rezeptansicht mit Portionswähler und abhakbarer Einkaufsliste, Trainingsbezug in der Ernährungs-Engine (Pre-/Post-Workout, Cardio ab 75 Min., Wettkampftage), Meal-Prep-Modus mit Kochtag-Ansicht und Timern, Ratgeber-Seiten offline. Gratis/Premium nach Abschnitt 9, Prüfung auf dem Server.
```

### Prompt D – Austausch, Bewertung, Kühlschrank-Suche
```
Setze docs/ERWEITERUNGEN-2.md Abschnitte 3, 4 und 5 (nur Kühlschrank-Suche und Packungsgrößen) um. Die Austausch-Tabelle und die Packungsgrößen erzeugst du über die Content-Pipeline (Batch-API, Zod-Schema, status=draft, Freigabe im Admin). Regel-Logik in packages/core mit Tests. Keine Echtzeit-KI.
```

### Prompt E – Resteplanung und Paar-Modus (Premium)
```
Setze docs/ERWEITERUNGEN-2.md Abschnitte 5 (automatische Resteplanung) und 6 (Paar-Modus beim Kochen) um. Beides Premium, Prüfung auf dem Server. Portionsfaktor und Reste-Score als reine Funktionen in packages/core mit Tests (Grenzfälle: sehr unterschiedliche Kalorienziele, Rezept ohne Beilage, 5-Portionen-Rezepte).
```

### Prompt F – Einkaufsliste teilen
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 7 (nur den Teil „Sofort“) um: Einkaufsliste als Text teilen, als PDF exportieren, gemeinsame Liste im Paar-Modus. Bereite ein Modul für spätere Händler-Anbindungen mit Feature-Flag vor, ohne einen Händler anzubinden.
```

### Prompt G – Lead-Magnet auf der Landingpage
(Kann sofort nach der Landingpage laufen.)
```
Setze docs/ERWEITERUNGEN-2.md Abschnitt 8 um: Abschnitt „20 Rezepte gratis als PDF“ auf der Landingpage im bestehenden Design (Vorschaubild aus Seite 1 von apps/web/public/downloads/Alpha5-Gratis-Rezepte.pdf erzeugen), Formular mit Einwilligung, waitlist.source = 'lead-magnet', Double-Opt-in, nach Bestätigung Mail mit Download-Link. Spamschutz wie bei der Warteliste. Erkläre mir in docs/SETUP.md mit Klick-Schritten am Handy, wie ich den Text der Bestätigungsmail ändere.
```
