# Plan Phase 1 – Anmeldung, Einwilligungen, Onboarding

**Status:** Freigegeben am 03.10.2026 mit den Empfehlungen (Antworten siehe Abschnitt 13).
Ergänzt um den optionalen Schritt „Körperumfänge“ (Erweiterungsbeschluss der Gründer, `docs/ERWEITERUNGEN.md`).
Grundlage: `CLAUDE.md`, `docs/KONZEPT.md` (Abschnitt 2 und 12), `docs/PROMPTS.md` (Phase 1).

---

## 1. Ziel in einem Satz

Neue Nutzer können sich anmelden, stimmen dem Datenschutz getrennt und nachvollziehbar zu und beantworten
Schritt für Schritt alle Fragen, die später für Trainings- und Ernährungsplan gebraucht werden – in der App
(iPhone, Android, Browser) und auf der Website.

## 2. Was ihr am Ende der Phase habt

1. Registrierung und Login per **E-Mail**, vorbereitet für **Apple** und **Google**.
2. Ein **Onboarding mit Fortschrittsanzeige** („Schritt 4 von 12“), das man unterbrechen und später fortsetzen kann.
3. **Altersprüfung ab 16 Jahren** (Selbstauskunft per Geburtsdatum, serverseitig erzwungen).
4. **Getrennte, versionierte Einwilligungen** (z. B. „Gesundheitsdaten“ getrennt von „Datenschutz/AGB“).
5. Einen **Gesundheits-Check**, der bei Auffälligkeiten einen Arzt-Hinweis zeigt und eine Markierung setzt,
   damit spätere Pläne vorsichtiger ausfallen.
6. Alle Antworten sicher in der Datenbank (Frankfurt), jeder Nutzer sieht nur seine eigenen Daten.
7. Einwilligung widerrufen und Konto löschen (einfache Version).

Noch **nicht** in Phase 1: Trainingsplan (Phase 3), Ernährungsplan (Phase 5), Zyklus-Modul (Phase 9),
Wearables (Phase 8), Abos (Phase 7).

---

## 3. Ablauf der Bildschirme

Reihenfolge nach `docs/KONZEPT.md` Abschnitt 2, ergänzt um Anmeldung und Altersprüfung.
Oben ist immer ein Fortschrittsbalken, jeder Schritt hat **Zurück** und **Weiter**.

| Nr.    | Bildschirm                    | Was gefragt wird                                                                                                                        | Pflicht?                   |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| A      | Willkommen                    | Kurze Vorstellung, Knopf „Los geht's“, Link „Ich habe schon ein Konto“                                                                  | –                          |
| B      | Alter                         | Geburtsdatum. Unter 16 → freundlicher Stopp, **nichts wird gespeichert**                                                                | ja                         |
| C      | Konto anlegen                 | E-Mail + 6-stelliger Code per Mail (ohne Passwort), später „Mit Apple anmelden“ / „Mit Google anmelden“                                 | ja                         |
| D      | Grund-Einwilligungen          | Nutzungsbedingungen und Datenschutzerklärung lesen und bestätigen                                                                       | ja                         |
| 1      | Geschlecht                    | männlich / weiblich / divers / keine Angabe. Bei „weiblich“: Zyklus-Modul kommt später (Interesse ja/nein)                              | ja                         |
| 2      | Einwilligung Gesundheitsdaten | Eigene Seite: welche Gesundheitsdaten wofür genutzt werden, Widerruf jederzeit. Häkchen **nicht** vorausgewählt                         | ja, für Schritte 3–4\*     |
| 3      | Körperdaten                   | Größe, Gewicht, optional Körperfett, optional Ruhepuls                                                                                  | Größe, Gewicht             |
| 3a     | Körperumfänge                 | Oberarme, Brust, Schultern, Taille, Bauch, Oberschenkel, Hüfte, Waden (cm) mit Mess-Anleitung; Erinnerung zum Nachmessen                | nein, überspringbar\*      |
| 4      | Gesundheits-Check             | Herz-Kreislauf, Brustschmerz/Schwindel, Bluthochdruck, Schwangerschaft, Verletzungen/Beschwerden, Medikamente ja/nein                   | ja                         |
| 5      | Trainingserfahrung            | Einsteiger / Fortgeschritten / Leistungssport                                                                                           | ja                         |
| 6      | Ziel                          | z. B. Muskelaufbau, Abnehmen, Fitness, Ausdauer; ggf. Disziplin (Laufen, Rad, Triathlon …) und Wettkampfdatum                           | Ziel ja, Rest optional     |
| 7      | Zeitbudget                    | Trainingstage pro Woche (1–7), Minuten pro Einheit, bevorzugte Wochentage                                                               | ja                         |
| 8      | Trainingsort                  | Studio / Zuhause / beides                                                                                                               | ja                         |
| 9      | Equipment zu Hause            | Liste aus dem Konzept (Kurzhanteln mit Gewichtsstufen, Langhantel, Kettlebells, Bänke, Klimmzugstange, Bänder, Cardiogeräte, Sonstiges) | nur bei „Zuhause“/„beides“ |
| 10     | Ernährung                     | omnivor / vegetarisch / vegan, Schwein ja/nein, mag / mag nicht, Unverträglichkeiten, Mahlzeiten pro Tag                                | Ernährungsform ja          |
| 11     | Kochmodus                     | täglich frisch / Meal-Prep (wie oft pro Woche)                                                                                          | ja                         |
| ~~12~~ | ~~Wearable~~                  | **entfällt in Phase 1** (Frage 8), Anbindung in Phase 8                                                                                 | –                          |
| E      | Fertig                        | Zusammenfassung, „Dein Plan wird vorbereitet“ (Plan kommt in Phase 3)                                                                   | –                          |

\* Schritte 3, 3a und 4 nur mit Einwilligung Gesundheitsdaten. Ohne Einwilligung geht es weiter, aber ohne
Körperdaten und Gesundheits-Check (mit Hinweis).

**Abweichung vom Konzept (entschieden, Frage 3):** Im Konzept stehen die Einwilligungen erst bei Schritt 3.
Größe, Gewicht, Körperfett und Ruhepuls sind aber schon **Gesundheitsdaten**. Deshalb schlagen wir vor, die
Gesundheits-Einwilligung **vor** die Körperdaten zu ziehen. Aus demselben Grund steht die Körpergröße nicht wie in
`docs/KONZEPT.md` Abschnitt 12 in `profiles`, sondern in `body_metrics` (nur mit Einwilligung).

**Zustände auf jedem Bildschirm:** Laden (Spinner), Fehler („Keine Verbindung – deine Angaben sind gespeichert,
wir versuchen es gleich nochmal“), leere Auswahl mit Hinweis, was fehlt.

---

## 4. Anmeldung: E-Mail, Apple, Google

Alle drei laufen über **Supabase Auth** (Server in Frankfurt).

1. **E-Mail** – funktioniert sofort und ist im Vercel-Vorschau-Link testbar.
   - Anmeldung mit 6-stelligem Code per Mail (Frage 7) – kein Passwort, daher kein „Passwort vergessen“.
   - Supabase verschickt ohne eigenen Mail-Dienst nur sehr wenige Mails pro Stunde. Für Tests reicht das,
     vor dem Start braucht ihr einen eigenen Mail-Dienst (EU-Anbieter, z. B. Brevo). Vor der Auswahl
     Serverstandort und Auftragsverarbeitungsvertrag (AV-Vertrag) prüfen.
2. **Apple („Mit Apple anmelden“)** – empfohlen. Bietet die App Google-Login an, verlangt Apple (App-Store-Richtlinie 4.8)
   zusätzlich eine gleichwertige, datenschutzfreundliche Login-Option. „Mit Apple anmelden“ erfüllt das.
   Was ihr grob einrichten müsst:
   1. Apple Developer Program (kostenpflichtig, wird für die iPhone-App ohnehin gebraucht).
   2. Dort eine „Services ID“ und einen Schlüssel für „Sign in with Apple“ anlegen.
   3. Diese Werte in Supabase eintragen: **Authentication → Sign In / Providers → Apple**.
      Claude schreibt dafür eine Klick-Anleitung in `docs/SETUP.md`.
3. **Google („Mit Google anmelden“)** – was ihr grob einrichten müsst:
   1. Google Cloud Console: Projekt anlegen, „OAuth-Zustimmungsbildschirm“ ausfüllen (App-Name, Datenschutz-Link).
   2. Zugangsdaten („OAuth-Client-IDs“) für Web, Android und iPhone anlegen.
   3. In Supabase eintragen: **Authentication → Sign In / Providers → Google**.
4. **Wichtig für die Vorschau-Links:** In Supabase unter **Authentication → URL Configuration** müssen die
   Vercel-Adressen als erlaubte Weiterleitung stehen. Claude nennt euch die genauen Einträge.
5. **Technischer Hinweis:** Apple- und Google-Login in der echten App funktionieren nur im „Development Build“
   (nicht in Expo Go). Im Browser (Vercel-Vorschau) gehen sie, sobald die Anbieter eingerichtet sind.

---

## 5. Einwilligungen (DSGVO Art. 9)

1. **Getrennte Einwilligungen**, jede einzeln, nie vorausgewählt:
   - `terms` – Nutzungsbedingungen
   - `privacy` – Datenschutzerklärung (Kenntnisnahme)
   - `health_data` – Gesundheits- und Körperdaten (Größe, Gewicht, Körperfett, Ruhepuls, Gesundheits-Check, Unverträglichkeiten)
   - `cycle_data` – Zyklusdaten (**eigene** Einwilligung; wird erst eingeholt, wenn das Zyklus-Modul in Phase 9
     kommt – in Phase 1 speichern wir nur „Interesse ja/nein“, siehe Frage 4)
2. **Versioniert:** Jeder Einwilligungstext hat eine Versionsnummer (z. B. `health_data` Version 1).
   Gespeichert wird: wer, welche Art, welche Version, wann zugestimmt, wann widerrufen, auf welchem Gerät (App/Web).
3. **Neue Version des Textes** → beim nächsten Öffnen fragt die App erneut nach.
4. **Widerruf** jederzeit in den Einstellungen. Folge bei `health_data`: **alle** Körper- und Gesundheitsdaten werden
   gelöscht – also alle Zeilen in `body_metrics` (Größe, Gewicht, Körperfett, Ruhepuls), `body_measurements`
   (Körperumfänge), `health_screening` und die
   Unverträglichkeiten in `food_preferences`. Der Rest des Kontos bleibt.
5. **Ohne gültige `health_data`-Einwilligung** speichert die Datenbank keinen einzigen Körper- oder Gesundheitswert
   (auch nicht die Körpergröße). `profiles` enthält nur Geschlecht, Geburtsdatum, Erfahrung und Sprache – das
   Geschlecht ist kein Gesundheitsdatum im Sinne von Art. 9, das Geburtsdatum wird für die Altersprüfung gebraucht.
   Auch das „Interesse am Zyklus-Modul“ ist nur ein Ja/Nein-Wunsch ohne Zyklusdaten.
6. Die Einwilligungs-Tabelle wird **nur ergänzt**, nie überschrieben – so bleibt nachweisbar, wer wann was erlaubt hat.
   Nach einer **neuen Textversion** bleiben die bisherigen Gesundheitsdaten lesbar, können aber nicht ergänzt oder
   geändert werden, bis neu eingewilligt wird. Der **Widerruf** in den Einstellungen bezieht sich auf die aktuelle
   Einwilligung (alle aktiven `health_data`-Einträge) und löscht alle Gesundheitsdaten.
7. Die Texte erstellt Claude als **Entwurf**. Sie müssen juristisch geprüft werden (Frage 6).

---

## 6. Altersgrenze 16

1. Erster Pflicht-Schritt ist das **Geburtsdatum** – noch **vor** dem Anlegen des Kontos.
2. Unter 16: freundliche Stopp-Seite („Die App ist ab 16 Jahren nutzbar“). Es wird **nichts** gespeichert.
3. Die Grenze steht zentral in `packages/core/src/constants.ts` (`MIN_AGE_YEARS = 16`, existiert schon)
   und wird zusätzlich **in der Datenbank** geprüft (serverseitig erzwungen).
   **Ein Profil mit geprüftem Geburtsdatum ist Voraussetzung für alle Einwilligungen und Daten:** Direkt nach dem
   Login legt die App das Profil mit dem Geburtsdatum aus Schritt B an; erst danach werden die
   Grund-Einwilligungen gespeichert. Ohne Profil lehnt die Datenbank Einwilligungen und alle weiteren Nutzerdaten ab. Es bleibt eine **Selbstauskunft**:
   Wer ein falsches Geburtsdatum angibt, wird nicht erkannt. Ein Umgehen der Prüfung über die App selbst ist aber nicht möglich.
4. Bei Apple/Google-Login gilt dieselbe Prüfung, bevor das Profil angelegt wird.

---

## 7. Gesundheits-Check → Flags → vorsichtigere Pläne

1. Fragen angelehnt an den PAR-Q-Fragebogen (ja/nein), in einfacher Sprache.
2. Aus den Antworten berechnet eine Funktion in `packages/core` feste **Flags**, z. B.:
   - `medical_clearance_recommended` – mindestens eine Herz-Kreislauf-Frage mit „ja“
   - `pregnancy` – schwanger
   - `injury` – Verletzung/Beschwerden
   - `medication` – nimmt Medikamente
   - `conservative_plan` – wird gesetzt, sobald eines der Flags oben zutrifft
3. Bei einem Flag: Hinweis „Bitte vor dem Start ärztlich abklären“, den man bestätigen muss.
   Danach geht es weiter (ob gesperrt oder weiter erlaubt: Frage 5).
4. **Wirkung später:** Die Plan-Engine (Phase 3) startet bei `conservative_plan` mit geringerer Intensität,
   ohne Maximaltests. Ernährung (Phase 5) plant bei `pregnancy` **kein** Kaloriendefizit, Supplements (Phase 6)
   berücksichtigen `pregnancy`/`medication` als Gegenanzeige.
5. Jeder Check wird als **neuer Eintrag** gespeichert (Verlauf), Wiederholung jederzeit möglich.
6. Die Logik bekommt Unit-Tests mit Grenzfällen (alles nein, alles ja, nur Schwangerschaft …).

---

## 8. Datenbank-Tabellen

Jede Tabelle bekommt eine Migration in `supabase/migrations` und **Row Level Security (RLS)**.
Regel: Jeder sieht und ändert nur Zeilen mit seiner eigenen Nutzer-ID.

| Tabelle                 | Inhalt                                                                                                       | Besonderheit                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`              | Geschlecht, Geburtsdatum, Erfahrung, Sprache, Onboarding-Fortschritt                                         | Datenbank prüft Mindestalter 16; **keine** Körper- oder Gesundheitswerte                                                                        |
| `body_metrics`          | Datum, Größe, Gewicht, Körperfett, Ruhepuls                                                                  | **sensibel** – Speichern nur mit gültiger `health_data`-Einwilligung; beim Widerruf gelöscht                                                    |
| `consents`              | Art, Version, zugestimmt am, widerrufen am, Plattform                                                        | nur Einfügen + Widerruf, kein Überschreiben                                                                                                     |
| `consent_documents`     | Einwilligungstexte je Art und Version                                                                        | für alle lesbar, Änderung nur durch Admin                                                                                                       |
| `health_screening`      | Antworten, berechnete Flags, Zeitpunkt                                                                       | **sensibel** – nur mit `health_data`-Einwilligung; nie in Logs                                                                                  |
| `body_measurements`     | Datum, Körperumfänge in cm (Oberarm l/r, Brust, Schultern, Taille, Bauch, Oberschenkel l/r, Hüfte, Wade l/r) | **sensibel** – Speichern nur mit gültiger `health_data`-Einwilligung; beim Widerruf gelöscht; mind. ein Wert                                    |
| `measurement_reminders` | Erinnerung „Umfänge neu messen“: Abstand in Tagen (Standard 28, 7–90), nächster Termin, an/aus               | eine Zeile pro Nutzer; keine Gesundheitswerte                                                                                                   |
| `goals`                 | Ziel, Disziplin, Wettkampfdatum, Tage/Woche, Minuten, Wunschtage, Trainingsort                               | –                                                                                                                                               |
| `equipment`             | Liste aller Geräte (Katalog)                                                                                 | für alle lesbar, Pflege nur durch Admin; Startliste aus dem Konzept                                                                             |
| `user_equipment`        | Welche Geräte wo (Zuhause/Studio), Gewichtsstufen in kg, Freitext „Sonstiges“                                | –                                                                                                                                               |
| `nutrition_prefs`       | Ernährungsform, Schwein ja/nein, Kochmodus, Meal-Prep-Tage, Mahlzeiten/Tag                                   | –                                                                                                                                               |
| `food_preferences`      | mag / mag nicht / Unverträglichkeit                                                                          | Unverträglichkeiten = Gesundheitsdaten → nur mit Einwilligung; Lebensmittel-Liste vorerst als feste Gruppen, Verknüpfung mit `foods` in Phase 5 |

Weitere Regeln:

1. Wird ein Konto gelöscht, werden alle zugehörigen Zeilen automatisch mitgelöscht.
2. Keine Gesundheitsdaten an Analyse-Dienste, keine in Fehlermeldungen oder Logs.
3. Eingaben werden doppelt geprüft: in App/Website mit Zod und in der Datenbank mit Grenzen (z. B. Größe 100–250 cm).
4. **Automatischer RLS-Test:** Eine GitHub Action startet eine Test-Datenbank, legt zwei Test-Nutzer an und
   prüft, dass Nutzer A die Daten von Nutzer B **nicht** sehen kann.
5. Die Datenbank-Typen in `packages/db` werden danach neu erzeugt (per GitHub Action).

---

## 9. Offline und Speicherung auf dem Gerät

1. Die Anmeldung bleibt auf dem Gerät gespeichert – man muss sich nicht jedes Mal neu einloggen.
2. Der **Onboarding-Fortschritt** wird nach jedem Schritt gesichert. Bricht man ab, geht es beim nächsten Öffnen an
   derselben Stelle weiter – auch auf einem anderen Gerät, sobald der Schritt online gespeichert ist.
3. Ohne Internet: Antworten bleiben auf dem Gerät und werden gesendet, sobald wieder Verbindung besteht.
4. **Gesundheitsdaten** (Gesundheits-Check, Körperdaten) werden auf dem Gerät nur kurz und so wenig wie möglich
   zwischengespeichert und nach dem erfolgreichen Senden sofort entfernt.
5. Alle Texte stehen zentral in einer deutschen Textdatei (vorbereitet für Englisch).

---

## 10. Umsetzung in kleinen Schritten

Jeder Schritt wird ein eigener Pull Request mit Vorschau-Link:

1. **Datenbank:** Tabellen, RLS, Mindestalter-Prüfung, Geräte-Katalog, automatischer RLS-Test.
2. **Fachlogik in `packages/core`:** Gesundheits-Check → Flags, Prüfregeln für alle Eingaben, Einwilligungs-Versionen –
   alles mit Tests.
3. **Anmeldung:** E-Mail-Registrierung und Login per Code, Abmelden – App und Website.
4. **Onboarding:** alle Bildschirme mit Fortschrittsbalken, Zwischenspeichern, Lade-/Fehlerzustände.
5. **Einstellungen:** Einwilligungen ansehen/widerrufen, Konto löschen.
6. **Apple/Google-Login** aktivieren, sobald ihr die Konten eingerichtet habt (siehe Frage 2).
7. **Doku:** `docs/SETUP.md` (Klick-Schritte für Supabase-Auth, Apple, Google) und `docs/KONZEPT.md` aktualisieren.

---

## 11. Was ihr am Handy testen könnt

1. Vorschau-Link öffnen → mit einer echten E-Mail-Adresse registrieren → Bestätigungs-Mail antippen.
2. Geburtsdatum unter 16 eingeben → Stopp-Seite erscheint, kein Konto entsteht.
3. Onboarding mittendrin schließen, später wieder öffnen → es geht an derselben Stelle weiter.
4. Gesundheits-Einwilligung **nicht** geben → was passiert, hängt von Frage 3 ab; es dürfen keine Körperdaten gespeichert werden.
5. Im Gesundheits-Check eine Herz-Frage mit „ja“ beantworten → Arzt-Hinweis erscheint.
6. In Supabase (**Table Editor**) nachsehen, dass eure Antworten in den Tabellen stehen.
7. Mit einem zweiten Test-Konto prüfen: Daten des ersten Kontos sind nicht sichtbar.
8. Flugmodus an → einen Schritt ausfüllen → Flugmodus aus → Daten kommen an.
9. Einstellungen → Einwilligung widerrufen / Konto löschen → Daten sind weg.
10. Alles einmal im hellen und einmal im dunklen Modus des Handys ansehen.

---

## 12. Was ihr dafür einrichten müsst

1. **Supabase** (falls noch nicht geschehen): Teil A und B in `docs/SETUP.md`.
2. **E-Mail-Anmeldung:** in Supabase eingeschaltet lassen (Standard). Claude nennt euch die Weiterleitungs-Adressen.
3. **Apple:** Apple-Developer-Konto (wird auch für die iPhone-App in Phase 4 gebraucht).
4. **Google:** Google-Cloud-Projekt mit OAuth-Zugang (kostenlos).
5. **Vor dem Start (nicht für Tests nötig):** EU-Mail-Dienst, juristisch geprüfte Texte.

---

## 13. Fragen und Entscheidungen (freigegeben am 03.10.2026)

Unsere Empfehlung steht jeweils dabei.

1. **App-Name:** Bleibt es vorerst bei „Fitnessapp“? Der Name erscheint in Mails, im Login-Fenster von Apple/Google
   und in den Einwilligungstexten. _Empfehlung:_ Arbeitstitel behalten, Name später an einer Stelle ändern.
   **Antwort:** Arbeitstitel „Fitnessapp“ bleibt.
2. **Apple/Google sofort oder später?** _Empfehlung:_ Zuerst nur E-Mail (sofort testbar), Apple und Google im
   selben Phase-1-Ablauf freischalten, sobald ihr die Konten eingerichtet habt.
   **Antwort:** Zuerst nur E-Mail; Apple/Google später.
3. **Einwilligung Gesundheitsdaten vor die Körperdaten ziehen** (Abweichung vom Konzept)? Und: Darf man die App
   **ohne** diese Einwilligung nutzen? _Empfehlung:_ Ja, vorziehen. Ohne Einwilligung: Nutzung möglich, aber nur
   allgemeine Pläne ohne Körperdaten und ohne Gesundheits-Check – mit deutlichem Hinweis.
   **Antwort:** Ja, vorziehen; ohne Einwilligung weiter, aber ohne Körperdaten/Gesundheits-Check (Hinweis).
4. **Zyklus-Modul:** In Phase 1 nur „Interesse ja/nein“ speichern und die eigentliche Zyklus-Einwilligung erst in
   Phase 9 einholen? _Empfehlung:_ Ja, weil der Einwilligungstext genau beschreiben muss, was gespeichert wird.
   **Antwort:** Ja, nur „Interesse ja/nein“ in `profiles`.
5. **Gesundheits-Check mit Auffälligkeit:** Weiter erlauben (mit bestätigtem Arzt-Hinweis und vorsichtigem Plan)
   oder sperren, bis eine ärztliche Freigabe bestätigt wird? _Empfehlung:_ Weiter erlauben mit vorsichtigem Plan.
   **Antwort:** Weiter erlauben nach bestätigtem Arzt-Hinweis, Flag `conservative_plan`.
6. **Juristische Prüfung:** Wer prüft Einwilligungstexte, Datenschutzerklärung und Nutzungsbedingungen (DE, AT, CH)?
   _Empfehlung:_ Claude liefert Entwürfe, eine Fachanwältin/ein Fachanwalt prüft vor dem Start.
   **Antwort:** Texte sind Entwürfe („ENTWURF – juristisch prüfen“), Prüfung vor dem Start.
7. **E-Mail-Login:** mit Passwort oder mit 6-stelligem Code per Mail (ohne Passwort)?
   _Empfehlung:_ Code per Mail – einfacher am Handy, kein Passwort vergessen.
   **Antwort:** 6-stelliger Code per Mail (OTP), kein Passwort.
8. **Wearable-Schritt:** In Phase 1 als „kommt bald“ zeigen oder ganz weglassen? _Empfehlung:_ Weglassen, bis Phase 8.
   **Antwort:** Weglassen bis Phase 8.
9. **Geschlecht:** Nur männlich/weiblich wie im Konzept, oder zusätzlich „divers / keine Angabe“ (Kalorienformel
   nimmt dann einen Mittelwert)? _Empfehlung:_ Zusätzliche Option anbieten.
   **Antwort:** männlich / weiblich / divers / keine Angabe.
10. **Konto löschen:** Sollen Einwilligungs-Nachweise nach dem Löschen noch eine Zeit lang (ohne Gesundheitsdaten)
    aufbewahrt werden? _Empfehlung:_ Juristisch klären lassen (Frage 6); bis dahin wird alles gelöscht.
    **Antwort:** Alles löschen (inkl. Einwilligungs-Nachweise), bis juristisch anders geklärt.

---

## Freigabe

Phase 1 wurde am 03.10.2026 mit allen Empfehlungen freigegeben. Claude setzt die Schritte aus Abschnitt 10
nacheinander als Pull Requests um (Etappe A: Datenbank + Fachlogik, Etappe B: Bildschirme).

## Erweiterung: Körperumfänge (Erweiterungsbeschluss der Gründer, `docs/ERWEITERUNGEN.md`)

1. Optionaler, überspringbarer Onboarding-Schritt **„Körperumfänge“** direkt nach „Körperdaten“ – nur mit
   Einwilligung Gesundheitsdaten. Messstellen mit kurzer Mess-Anleitung: Schultern, Brust, Oberarm links/rechts,
   Taille, Bauch, Hüfte, Oberschenkel links/rechts, Wade links/rechts (in cm).
2. Tabelle `body_measurements` (sensibel, Einwilligung nötig, beim Widerruf gelöscht) und
   `measurement_reminders` (Erinnerung zum Nachmessen, Standard alle 28 Tage, einstellbar 7–90 Tage).
3. Grenzen und Messstellen zentral in `packages/core` (`constants.ts`, `body-measurements.ts`),
   nächster Termin über `nextMeasurementDue()`.

## Umsetzungsstand (03.10.2026)

**Etappe A – Datenbank + Fachlogik: erledigt.** Migrationen mit RLS, Mindestalter, versionierte
Einwilligungen, Gesundheits-Check mit Flags, Körperumfänge und Mess-Erinnerung, pgTAP-Tests;
Fachlogik in `packages/core` mit Unit-Tests.

**Etappe B – Bildschirme: erledigt** (`apps/mobile`, läuft auf iPhone, Android und als Web-App auf Vercel).

1. Kompletter Ablauf laut Abschnitt 3: Willkommen → Alter (unter 16: Stopp, nichts gespeichert) → Konto →
   Grund-Einwilligungen → Schritte 1–11 → Fertig, mit „Schritt X von Y“, Zurück/Weiter und Fortsetzen nach
   Neustart.
2. **Zwei Betriebsarten** hinter einer Schnittstelle (`apps/mobile/src/data/backend.ts`):
   - **Testmodus** (automatisch ohne Supabase-Werte): Hinweis oben, Knopf „Testmodus starten“, alle Daten nur
     auf dem Gerät, dieselben Regeln wie die Datenbank. Bewusste Ausnahme für den Gründer-Test: Gesundheitsdaten
     liegen hier dauerhaft auf dem Gerät. „Testdaten löschen“ in den Einstellungen.
   - **Supabase-Modus**: Login per 6-stelligem E-Mail-Code, Profil direkt nach dem Login, Einwilligungen in der
     aktuellen Textversion, Daten per Upsert. Offline: Nicht-Gesundheitsdaten in einer Warteschlange auf dem
     Gerät; Gesundheitsdaten nur im Arbeitsspeicher und direkt gesendet („Erneut versuchen“).
3. Einstellungen: Einwilligungen ansehen/widerrufen (Widerruf Gesundheitsdaten löscht alle Körper- und
   Gesundheitsdaten), Neu-Einwilligung bei neuer Textversion, Mess-Erinnerung (7–90 Tage), Konto löschen,
   Abmelden.
4. Website: Knopf „App im Browser öffnen“ (`NEXT_PUBLIC_APP_URL`).
5. Tests: Unit-Tests für Abbildung, Testmodus-Regeln, Warteschlange und Supabase-Anbindung (Vitest);
   Klick-Test der Web-App im Testmodus (Playwright, läuft in `ci`).

**Noch offen:**

- **Echtes Supabase-Projekt** anlegen und verbinden (docs/SETUP.md Teil A–C und F). Der Supabase-Modus ist
  nur per Unit-Test geprüft, noch nicht live.
- **Apple- und Google-Login** (Frage 2) – sobald die Konten eingerichtet sind.
- **Juristische Prüfung** der Einwilligungstexte, Nutzungsbedingungen und Datenschutzerklärung (Frage 6).
- Mess-Erinnerung als **Push-Benachrichtigung** (bisher nur Hinweis in der App, „Heute“-Seite).
- Körperdaten **nachträglich** eintragen, wenn die Gesundheits-Einwilligung erst später erteilt wird.
- EU-Mail-Dienst vor dem Start (Abschnitt 4).
