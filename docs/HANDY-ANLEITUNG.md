# Start nur mit dem Handy – Schritt für Schritt

Ihr braucht keinen Computer. Claude Code arbeitet in der Cloud, GitHub speichert den Code,
Vercel zeigt die App im Handy-Browser, Expo baut die echten Apps in der Cloud.

## Teil 1 – Einmalige Einrichtung (ca. 30 Minuten)

### 1. Dateien aufs Handy speichern
1. In diesem Claude-Chat jede der 4 Dateien antippen → Teilen → „In Dateien sichern“ (iPhone) bzw. „Herunterladen“ (Android).
   Dateien: `CLAUDE.md`, `KONZEPT.md`, `PROMPTS.md`, `HANDY-ANLEITUNG.md`

### 2. GitHub-Konto und Repository
1. Im Handy-Browser github.com öffnen, Konto anlegen (falls noch keins), zusätzlich die **GitHub-App** installieren.
2. Im Browser: github.com/new öffnen.
3. Name eintragen (z. B. `fitness-app`), **Private** wählen, Häkchen bei **„Add a README file“** setzen → „Create repository“.

### 3. Dateien hochladen
1. Im Browser das neue Repository öffnen. Falls „Add file“ fehlt: im Browser-Menü „Desktop-Website anfordern“.
2. „Add file“ → „Upload files“ → „choose your files“ → alle 4 Dateien auswählen.
3. Unten „Commit changes“ tippen.
   (Alle Dateien landen im Hauptordner – Claude Code sortiert sie in Phase 0 selbst in den Ordner `docs/`.)

### 4. Claude Code verbinden
1. In der Claude-App unten auf den Tab **Code** tippen (oder im Browser claude.ai/code öffnen).
2. Der Aufforderung folgen, GitHub zu verbinden und die **Claude-GitHub-App** zu installieren.
   Zugriff auf euer Repository erlauben.
3. Repository auswählen, Branch `main`.

### 5. Weitere Konten (nur anlegen, verbinden macht Phase 0 mit euch)
- **Supabase** (supabase.com) – Datenbank. Beim Projekt Region **Frankfurt (eu-central-1)** wählen.
- **Vercel** (vercel.com) – mit GitHub anmelden.
- **Expo** (expo.dev) – für die App-Builds.
- **Google AI Studio** (aistudio.google.com) – Gemini-API-Schlüssel für die Inhalts-Erzeugung (seit 15.10.2026 statt
  Anthropic; Einrichtung `docs/SETUP.md` Teil E).
- Später, vor dem ersten nativen Build: **Apple Developer Program** (über die App „Apple Developer“, jährlich kostenpflichtig) und **Google Play Console** (einmalige Gebühr).

## Teil 2 – Der Arbeitsablauf pro Phase

1. **Neue Sitzung** im Code-Tab starten, Repository wählen.
2. Den Prompt der Phase aus `docs/PROMPTS.md` kopieren und einfügen.
3. Claude Code zeigt zuerst einen **Plan** → lesen → „Passt, umsetzen“ oder Änderungswünsche schreiben.
4. Ihr könnt das Handy weglegen – die Sitzung läuft in der Cloud weiter.
5. Fertig: Es gibt einen **Pull Request**. In der GitHub-App öffnen → dort steht „So testest du es am Handy“ mit Vorschau-Link.
6. Testen. Fehler? In derselben Claude-Code-Sitzung beschreiben, was nicht passt.
7. Alles gut → in der GitHub-App **Merge pull request**. Datenbank und Website aktualisieren sich automatisch.

## Teil 3 – Was ihr im Alltag in der GitHub-App macht
- **Pull Requests** prüfen und mergen
- **Actions** → Workflow auswählen → „Run workflow“ für:
  - `content-generate` – neue Übungen, Plan-Vorlagen, Austausch-Einträge, Packungsgrößen oder Rezepte als Entwurf
    erzeugen lassen (KI: Google Gemini, offline; auch als kostenloser Probelauf)
  - `content-collect` – fertige Entwürfe abholen (läuft auch alle 3 Stunden von selbst) → Pull Request
  - `content-review` – Inhalte freigeben oder zurückziehen → Pull Request (Merge = Freigabe); Art `recipe` = Rezepte
    einer Kategorie auf einmal freigeben (Sammelfreigabe), Art `ids` = einzelne Übungen/Vorlagen **oder** einzelne
    Rezepte (auch ohne Kategorie), Meal-Prep-Pläne und Ratgeber (`docs/SETUP.md` → „Inhalte erzeugen und freigeben am
    Handy“, 3b)
  - `content-seed` – freigegebene Inhalte einspielen (läuft nach jedem Merge von selbst)
  - Schritt für Schritt: `docs/SETUP.md` → „Inhalte erzeugen und freigeben am Handy“
  - `eas-build` – neue Android-APK / iOS-TestFlight-Version bauen
- Rote Kreuze bei Actions = Fehler → Link kopieren und Claude Code in einer Sitzung geben: „Diese Action schlägt fehl, bitte beheben.“

## Teil 4 – Schlüssel und Passwörter (wichtig)
- Schlüssel (Supabase, Gemini, Expo usw.) **nie in den Chat** mit Claude kopieren.
- Eintragen nur hier:
  - GitHub: Repository → Settings → Secrets and variables → Actions → „New repository secret“
  - Vercel: Projekt → Settings → Environment Variables
- Welche Schlüssel genau gebraucht werden, schreibt Claude Code euch in Phase 0 in `docs/SETUP.md`.

## Teil 5 – So testet ihr
- **Phasen 0–7:** über den Vercel-Link im Handy-Browser (Web-Version der App). Tipp: „Zum Home-Bildschirm hinzufügen“ – fühlt sich dann fast wie eine App an.
- **Android-App:** Workflow `eas-build` starten (android, preview, Einreichen nein) → Link zur APK öffnen → installieren. Schritt für Schritt: **Teil 9**.
- **iPhone-App:** Workflow `eas-build` mit ios, production, **Einreichen ja** → Upload zu **TestFlight** → TestFlight-App öffnen → installieren. Ihr beide werdet als interne Tester eingetragen. Einmalige Einrichtung: `docs/SETUP.md` Teil D2.
- **Smartwatch/Health-Funktionen (Phase 8)** funktionieren nur in der echten App, nicht im Browser.
- **App neu installieren nach größeren Daten-Änderungen** (z. B. Phase 3, Etappe B2 „Trainingstage + Gewichte“): Alte App-Builds werden dann nicht mehr unterstützt. Nach dem Merge den neuen `eas-build` laden und die App neu installieren (Android: neue APK; iPhone: Update in TestFlight). Im Browser genügt Neuladen. Im Testmodus werden alte Angaben auf dem Gerät automatisch umgewandelt; sicherer ist **Einstellungen → Testdaten löschen** und das Onboarding neu starten.
  - **Nach der Neuinstallation bitte die Trainingstage neu wählen** (Einstellungen bzw. Onboarding „Deine Trainingstage“): Alte Angaben wurden als Kraft-Tage übernommen – auch wenn euer Ziel Ausdauer ist; Lauftage müsst ihr selbst eintragen. Wunsch-Tage, deren Anzahl nicht zu „Tage pro Woche“ passte, sind entfallen.
  - Bei Etappe B2 wurden außerdem Langhantel-Werte über 25 kg entfernt (früher wohl als Gesamtgewicht eingetragen – jetzt zählen nur Scheiben je Paar plus Stange), und Wunsch-Tage entfallen, wenn ihre Anzahl nicht zu „Tage pro Woche“ passte (dann „Tage egal“).

## Teil 6 – Trainingsplan testen (Phase 3, Etappe C)
1. Vorschau-Link aus dem Pull Request öffnen (Testmodus, keine Supabase nötig). Schon einmal durchgeklickt? **Einstellungen → Testdaten löschen**.
2. Onboarding durchklicken (z. B. Muskelaufbau, Einsteiger, Mo/Mi/Fr Kraft im Studio 60 Minuten). „Geschafft!“ zeigt „Dein Plan ist fertig“ → **Zum Plan**.
3. „Heute“: oben „Testinhalte – KI-Entwurf, nicht fachlich geprüft“, darunter „Woche 1 von 6“ bzw. „Woche 0“, die heutige Einheit (Übungen mit Sätzen, Wiederholungen, Pause, „Wiederholungen in Reserve“, „Startgewicht finden“) oder „Heute ist Ruhetag“.
4. **Deine Woche**: Tage antippen → Einheit dieses Tages. **Einheit verschieben** → „Auf … verschoben“ bzw. Nachfrage „Einheit streichen?“, wenn diese Woche kein Tag mehr frei ist.
5. Mit Lauftag (Art „Ausdauer“): Einheit mit Minuten und „Anstrengung 3 von 10 …“; ohne Gesundheits-Check „Geh-Lauf-Wechsel“.
6. Im Gesundheits-Check eine Frage mit „Ja“ → über **jeder** Einheit steht der Arzt-Hinweis; „Dein Plan ist bewusst vorsichtig aufgebaut“.
7. **Einstellungen → Gesundheitsdaten widerrufen** → Plan ist komplett weg, „Heute“ bietet „Neuen Plan erstellen“.
8. **Einstellungen → Training → Angaben ändern** (z. B. einen Tag dazu) → „Heute“ fragt „Plan neu erstellen?“. **Plan neu erstellen** geht auch direkt in den Einstellungen.
9. Alles einmal hell und einmal dunkel ansehen.
- **In der echten App** (APK/TestFlight) liegt ein Plan, der auf dem Gesundheits-Check beruht, nur **verschlüsselt** auf dem Handy (für Training ohne Netz); im Browser nur, solange der Tab offen ist. Gelöscht wird er beim Widerruf, Abmelden und Konto löschen. Für diese Version neu installieren (neue Bausteine für die Verschlüsselung).
  - Gut zu wissen: Widerruft ihr auf einem **anderen** Gerät, sieht ein Handy, das gerade **offline** ist, den Plan noch, bis es wieder online lädt. Spätestens nach **14 Tagen ohne Verbindung** löscht die App den Zwischenspeicher von selbst.
- **Mit Supabase** erscheint ein Plan erst, wenn Inhalte freigegeben sind (`content-review` → Merge → `content-seed`); vorher zeigt „Heute“ richtigerweise „kein freigegebener Plan“.

## Teil 7 – Woche, Verlauf und Export testen (Phase 4, Etappe D, Testmodus)
1. Vorschau-Link aus dem Pull Request öffnen (Testmodus). Schon einmal durchgeklickt? **Einstellungen → Testdaten löschen**.
2. Onboarding (z. B. Mo/Mi/Fr Kraft im Studio) → **Zum Plan** → **Training starten** → ein paar Sätze abhaken →
   **Training speichern**.
3. „Heute“ → **Woche**: Jeder Tag zeigt Zeichen **und** Wort („✓ Erledigt“, „◐ Teilweise erledigt“, „! Verpasst“,
   „○ Geplant“, „Ruhetag“). Unten die Summen (Einheiten, Kraft-Sätze, Ausdauer-Minuten und -km).
4. **Nächste Woche ›** und **‹ Vorwoche** antippen – vor dem Plan-Beginn ist „Vorwoche“ ausgegraut.
5. Beim erledigten Tag **Ansehen** → der Eintrag mit Datum, Sätzen („Satz 1: 20 kg × 10“), Belastung und Notiz.
6. **Verlauf dieser Übung** → je Training der beste Satz. Zurück.
7. **Ändern** → z. B. Belastung ändern → **Training speichern** → zurück im Eintrag steht der neue Wert.
8. **Eintrag löschen** → Nachfrage → **Endgültig löschen** → „Eintrag gelöscht.“; auf „Heute“ ist die Einheit wieder offen.
9. **Einstellungen → Meine Daten exportieren** → Hinweis „Diese Datei enthält Gesundheitsdaten …“ →
   **Datei herunterladen** → die Datei `alpha5-meine-daten-<Datum>.json` liegt in „Downloads“ (in der Dateien-App
   antippen zeigt den Inhalt). Darin u. a. `session_logs` (Tagebuch), `consents` (Einwilligungen samt Verlauf) und
   `account` (im Testmodus ohne E-Mail).
10. Alles einmal hell und einmal dunkel ansehen.

## Teil 7a – Trainingskalender testen (Etappe A1a, Testmodus)
1. Vorschau-Link aus dem Pull Request öffnen → **Einstellungen → Testdaten löschen** (falls schon getestet) →
   „Testmodus starten“ → Onboarding mit **Di und Fr Kraft im Studio** (bei Mo/Mi/Fr ist jeder freie Tag zu nah an einer
   Ganzkörper-Einheit – dort geht nur Tauschen).
2. „Heute“ → **Kalender**. Den Griff **⠿** einer Einheit gedrückt halten (ca. eine halbe Sekunde) und auf einen grün
   gestrichelten Tag ziehen → „Verschoben auf …“ → **Rückgängig** antippen → die Einheit ist wieder am alten Tag.
3. Beim Ziehen zeigen gesperrte Tage rot den Grund, z. B. „Zu nah an deiner Einheit „Ganzkörper B“ am Freitag …“. Dort
   loslassen → „Nicht verschoben: …“, nichts ändert sich.
4. Auf den Tag der anderen Einheit ziehen → „Getauscht: …“ (beide Einheiten wechseln den Tag).
5. Ohne Ziehen: **Verschieben …** → Liste aller Tage mit ✓ (verschieben/tauschen) oder ✕ und Grund → einen Tag wählen.
6. Unter der Meldung steht „Dein Essensplan passt eventuell nicht mehr …“ → **Zum Essensplan**.
7. Flugmodus an → verschieben → Seite neu laden → bleibt verschoben. Tauschen im Flugmodus ist im Testmodus möglich (alles
   auf dem Gerät); mit Konto sagt die App „Tauschen braucht kurz Verbindung“.
8. Kalender auch über „Heute“ → **Woche** → **Im Kalender verschieben** erreichbar.
9. Android-APK (Workflow `eas-build`): die ganze Karte lange drücken und mit dem Finger ziehen – kurzes Vibrieren beim
   Aufnehmen. Mit TalkBack: auf den Namen der Einheit → Aktionen „Einen Tag früher/später“.
10. Einmal hell und einmal dunkel ansehen.

## Teil 7a2 – Nachtragen und freie Einheit testen (Etappe A1b, Testmodus)
1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit Plan (z. B. **Di und Fr Kraft im Studio**). Am besten an
   einem Tag testen, an dem schon ein Trainingstag vorbei ist.
2. „Heute“ → **Kalender** → an einem vergangenen Tag **+ Einheit** → unter „Geplante Einheit nachtragen“ die Einheit
   wählen → im Training oben **Datum ändern** ausprobieren → einen Satz abhaken → **Training speichern**. Zurück im
   Kalender steht der Eintrag mit „nachgetragen“; unter **Woche** ebenso.
3. **+ Einheit** an einem vergangenen Tag → „Freie Einheit“ → **Ausdauer** → Laufen → Weiter → 30 Minuten eintragen →
   speichern → im Kalender „✓ Lauf · frei“. Die nächste Kraft-Vorgabe auf „Heute“ bleibt gleich.
4. **+ Einheit** → „Freie Einheit“ → **Kraft** → Übung suchen (z. B. „Kniebeuge“) und antippen → Weiter → Wiederholungen
   eintragen, Satz abhaken → speichern → „Freie Kraft-Einheit · frei“. Ohne abgehakten Satz sagt die App, was fehlt.
5. **+ Einheit** für **heute** an einem Trainingstag → „… jetzt trainieren“ → normales Training mit Pausentimer, ohne
   Datumswahl.
6. Mit **‹ Vorwoche** zurückblättern: Tage älter als 14 Tage zeigen „Nachtragen nur bis 14 Tage zurück“, künftige Tage
   haben kein „+ Einheit“.
7. Flugmodus an → freie Einheit eintragen → bleibt gespeichert (mit Konto: wird übertragen, sobald wieder Netz da ist).
8. Mit TalkBack/VoiceOver: „+ Einheit“ nennt den Tag; beim Wählen von Übungen wird „1 Übung gewählt“ angesagt.

## Teil 7b – Übungen tauschen testen (Etappe T2, Testmodus)
1. Vorschau-Link öffnen, **Einstellungen → Testdaten löschen**, neues Testkonto: Ort **Zuhause**, Geräte **keine**,
   Mo/Mi/Fr Kraft zu Hause.
2. **Nur heute:** Auf „Heute“ bei **Kniebeuge mit Körpergewicht** auf **Tauschen** → **Kniebeuge zum Stuhl** → „Nur heute“
   → **Tauschen**. Darunter steht „heute getauscht“, oben „… ersetzt.“ mit **Rückgängig**. Training starten → die
   Kniebeuge zum Stuhl steht schon da. Ein anderer Tag (Wochenübersicht) zeigt weiter die Kniebeuge mit Körpergewicht.
3. **Ab jetzt immer:** Bei **Liegestütz mit erhöhten Händen** → **Liegestütz** → „Ab jetzt immer – zu Hause“ →
   „Mag ich nicht“ → **Tauschen**. Kennzeichen „getauscht (deine Wahl)“, auch an den anderen Tagen und in der PDF-Ansicht.
4. **Einstellungen → Ausgeschlossene Übungen** → **Wieder zulassen** → bestätigen → die Übung ist sofort zurück.
5. Übungen ohne gleichwertige Alternative (z. B. Türrahmen-Rudern) zeigen ehrlich „keine gleichwertige Alternative“.
6. Im Training **Tauschen** an einer Übung → Alternative wählen → Name wechselt, „statt …“ steht darunter.

## Teil 7c – Ernährung testen (Phase 5, Etappe N4, Testmodus)
1. Vorschau-Link öffnen, **Einstellungen → Testdaten löschen**, neues Testkonto: Einwilligung, **weiblich**, 70 kg,
   Ziel **Abnehmen**, Mo/Mi/Fr Kraft, **vegetarisch**, „Pilze: Mag ich nicht“, 4 Mahlzeiten, Meal-Prep 2×.
2. Neuer Schritt **„Alltag und Training“**: Ohne Auswahl kommt ein Hinweis; „Sitzend mit Bewegung“ und „Abends“ wählen.
3. „Geschafft!“ zeigt „Trainingstag ca. … kcal, Ruhetag ca. … kcal“.
4. „Heute“ → Karte **„Essen heute“** → **Ernährung**. Solange der Lebensmittel-Katalog fehlt: **„Beispiel-Rezepte mit
   Testwerten verwenden“** (gelb gekennzeichnet, keine echten Nährwerte).
5. Abendessen zeigt „nach dem Training“; Rezept antippen → Portion, „Enthält: …“, Warnung „Allergene noch nicht
   fachlich geprüft“; keine Pilze, kein Fleisch.
6. **Einstellungen → Kalorienzahlen anzeigen** aus → in Ernährung, Rezept und auf „Heute“ keine kcal mehr.
7. **Einstellungen → Einwilligung Gesundheitsdaten widerrufen** → Hinweis zu Unverträglichkeiten und Einkaufsliste,
   Häkchen „stattdessen unter ‚mag ich nicht‘“ → danach Ernährung ohne Kalorienziel.
8. Alles einmal hell und einmal dunkel ansehen.

**Woche, Tauschen, automatische Anpassung (Etappe N5a, Testmodus)** – mit dem Testkonto aus Schritt 1:

1. **Ernährung** → unten **„Wochenansicht“** → Montag bis Sonntag mit Mahlzeiten und Tagessumme; **„Diese Woche“** /
   **„Nächste Woche“** umschalten.
2. **„Andere Vorschläge“** → Nachfrage bestätigen → andere Rezepte ab heute. Seite neu laden → die neuen Rezepte
   bleiben (der Plan ist jetzt auf dem Gerät gespeichert).
3. Zurück zur Tagesansicht → unter einer Mahlzeit **„Rezept tauschen“** (am besten beim Snack nachmittags) →
   „Getauscht – neu: …“. Mit den wenigen Beispiel-Rezepten kommt oft „kein anderes passendes Rezept“ – das ist
   richtig, weil getauscht wird nur gegen ein Rezept, das in der Woche noch nicht vorkommt. Im **Flugmodus** geht das
   Tauschen auch.
4. **Einstellungen → Ernährung ändern** → z. B. Erdnüsse „Unverträglich“ → Ernährung öffnen → Hinweis **„Dein Plan
   wurde an deine neuen Angaben angepasst.“**, keine Erdnuss-Rezepte mehr ab heute → **„Verstanden“** → Hinweis weg.
5. **Einstellungen → Gesundheits-Check wiederholen** → „schwanger“ = Ja → Ernährung: Plan ab heute ohne Zahlen und ohne rohe Eier,
   Räucherfisch o. Ä.; die Tage vor heute bleiben, wie sie waren (Rezepte), aber auch dort ohne kcal.
6. Mit einem frischen Testkonto (ohne Schwangerschaft): in der Adresszeile hinter den Vorschau-Link
   `/onboarding/body_metrics?edit=1` setzen → **Gewicht** um etwa 10 kg erhöhen → Ernährung: Hinweis „Dein Bedarf hat
   sich geändert“ mit Knopf **„Plan aktualisieren“** → Portionen ab heute neu.
7. Die **Einkaufsliste** und der **Meal-Prep-Kochtag**: siehe nächster Abschnitt (Etappe N5b).

**Einkaufsliste und Meal-Prep-Kochtag (Etappe N5b, Testmodus)** – mit dem Testkonto aus Schritt 1:

1. **Ernährung** → unten **„Einkaufsliste“** → Einträge nach Supermarkt-Abteilungen, oben „Einkauf für … bis …“.
   Ein paar Einträge antippen → Häkchen. **Flugmodus an** → weitere abhaken und unten einen **eigenen Eintrag**
   (z. B. „Kaffee“, Abteilung wählen) hinzufügen → geht ohne Netz. Flugmodus aus, Seite neu laden → Häkchen und
   eigener Eintrag sind noch da.
2. **„Erledigte ausblenden“** antippen → abgehakte Einträge verschwinden; nochmal → wieder da. **„Vorrat anzeigen“**
   klappt Salz, Öl usw. auf. Eigener Eintrag: **✕** löscht ihn.
3. **„Zeitraum“** → bei „Von“ z. B. Donnerstag wählen → **„Zeitraum übernehmen“** → nur noch der Einkauf ab
   Donnerstag; Häkchen bleiben.
4. Ein Rezept direkt öffnen (z. B. Vorschau-Link + `/rezept/porridge-banane`) → Portionen mit **+** wählen →
   **„Zur Einkaufsliste (2 Portionen)“** → „Steht auf deiner Einkaufsliste“ → **„Einkaufsliste öffnen“** → unten
   „Aus Rezepten hinzugefügt“, dort **„Entfernen“**. Ein Rezept aus dem Essensplan zeigt stattdessen „steht über
   deinen Essensplan schon auf der Einkaufsliste“.
5. **Einstellungen → Gesundheits-Check wiederholen** → „schwanger“ = Ja → **Einkaufsliste** öffnen: Hinweis „Deine
   Einkaufsliste wurde an deinen geänderten Plan angepasst“, Einkauf ab heute, keine offenen Zutaten aus Rezepten mit
   Schwangerschafts-Hinweis mehr; Häkchen und eigene Einträge bleiben, schon abgehakte, nicht mehr gebrauchte Einträge
   stehen als „nicht mehr im Plan“ da.
6. **Ernährung → „Meal-Prep-Pläne“** → drei Beispiel-Wochen. Was nicht zu deinen Angaben passt, ist ausgegraut mit
   „Passt nicht zu deinen Angaben“ (ohne Grund; z. B. die Fisch-Woche bei vegetarisch, die Curry-Woche bei
   Erdnuss-Unverträglichkeit). Ab Samstag ist „Nächste Woche“ vorausgewählt.
7. **„Pasta-Woche“** antippen → Rezepte, Kochtag und Aufbewahrung (Kühlschrank / einfrieren und am Vorabend auftauen /
   frisch) → **„Plan für diese Woche wählen“** → bestätigen → „Für diese Woche gewählt“. **„Zur Einkaufsliste“** → die
   Liste enthält den Kochtag-Einkauf.
8. Zurück → **„Zum Kochtag“** → **„Kochtag starten“** → oben „Nächster Schritt in 5:00“, der aktuelle Schritt ist
   umrandet. App schließen oder Flugmodus an, ein paar Minuten warten, wieder öffnen → der Timer ist weitergelaufen.
   Im Browser fragt die Seite einmal nach Mitteilungen (nur solange die Seite offen ist); in der App vibriert sie bei
   jedem neuen Schritt, solange sie geöffnet ist. **„Kochtag beenden“** setzt zurück.
9. In der **Tagesansicht** steht am Vorabend eines Tages mit eingefrorener Portion „Heute Abend auftauen“.
10. **Kalorienzahlen ausschalten** (Einstellungen → Ernährung ändern) → Meal-Prep-Pläne, Kochtag und Einkaufsliste
    zeigen nirgends kcal.

**Rezeptsuche und Ratgeber (Etappe N5c, Testmodus)** – mit dem Testkonto aus Schritt 1:

1. **Ernährung** → unten **„Rezepte suchen“** → oben steht „Deine Ernährungsform: vegetarisch“; die Karten zeigen
   Zeit und „kcal je Portion“. Kein Fleisch, keine Pilze („mag ich nicht“ lässt sich hier nicht abschalten).
2. **„Auch mit Fleisch“** antippen → zusätzliche Rezepte mit dem Hinweis „Passt nicht zu deiner Ernährungsform: mit
   Fleisch“. Schweinefleisch erscheint trotzdem nicht (keine Angabe „isst Schwein“).
3. **„Unter 10 Minuten“** antippen → nur schnelle Rezepte. Oben ins Suchfeld z. B. „Oats“ tippen → Treffer filtern
   sich; ein Wort ohne Treffer → „Keine passenden Rezepte gefunden“. **„Filter zurücksetzen“** stellt alles zurück.
4. Ein gekennzeichnetes Rezept öffnen (z. B. „Hähnchen …“) → oben derselbe Hinweis; Portionen mit **+** auf 3 →
   die Mengen verdreifachen sich → **„Zur Einkaufsliste (3 Portionen)“** → **„Einkaufsliste öffnen“** → das Rezept
   und seine Fleisch-Zutat sind mit „passt nicht zu deiner Ernährungsform“ markiert. In den Essensplan kommt es nie.
5. **Ernährung** → **„Ratgeber“** → zwei Beispiel-Ratgeber (Testtexte, „Entwurf“). **Flugmodus an** →
   „Wettkampf-Ernährung (Beispiel)“ öffnen → Abschnitte und der feste Hinweis beim Carb-Loading erscheinen ohne Netz;
   zurück → „Unterwegs essen (Beispiel)“ mit „Beim Bäcker“. Flugmodus aus.
6. **Kalorienzahlen ausschalten** → in der Suche keine kcal mehr, im Rezept mit Portionswähler keine Nährwerte; im
   Ratgeber steht „Zahlenangaben … sind ausgeblendet“, die Absätze mit kcal bzw. „g … pro kg“ fehlen, der feste
   Carb-Loading-Hinweis bleibt.
7. Mit einem frischen Testkonto **vegan**, „Erdnüsse: Unverträglich“ und „schwanger“ = Ja: In der Suche auch mit
   „Auch vegetarisch“ und „Auch mit Fleisch“ kein Erdnuss-Rezept, kein Räucherlachs, keine rohen Eier.

**Essensplan und Einkaufsliste als PDF (Etappe N6 – PDF P5, Testmodus, gratis)** – mit dem Testkonto aus Schritt 1:

1. **Ernährung** → **Woche** → **„Als PDF speichern“** → Hinweis „Bevor du speicherst“ (euer Plan nutzt
   Gesundheitsangaben; der Text erwähnt, dass Ersatzprodukte wie „Laktosefreie Milch statt Vollmilch“ darauf
   schließen lassen) → **Abbrechen** führt zurück, nichts entsteht. Nochmal → **Weiter**.
2. Druckansicht „Essensplan als PDF“: Vorschau mit Logo, „Dein Essensplan“, Woche, Arzt-Hinweis, Wochenübersicht Mo–So
   (Rezept + Menge „× 1,5“, Kochtag/vorgekocht) und Tagessummen in kcal, danach jedes Rezept mit Zutaten je Menge und
   Schritten. **Prüfen:** keine Gründe, kein Gewicht, kein Ziel, keine Unverträglichkeit, kein Alter. Häkchen „Meinen
   Namen auf das Deckblatt drucken“ → Name erscheint nur im PDF.
3. **„Drucken / als PDF sichern“** → Android (Chrome): Drucker **„Als PDF speichern“** → Herunterladen. iPhone
   (Safari): in den Druckoptionen oben das **Teilen-Symbol** → **„In Dateien sichern“**. PDF öffnen: A4 hochkant,
   nichts abgeschnitten, Fußzeile auf jeder Seite.
4. **Einkaufsliste** → einen Eintrag abhaken → **„Als PDF speichern“** → Hinweis → **Weiter** → Vorschau: nach
   Abteilungen, zwei Spalten mit **Kästchen**, der abgehakte Eintrag mit Haken, „Hast du wahrscheinlich da“ am Ende,
   **keine kcal**. Drucken wie in Schritt 3.
5. **Kalorienzahlen ausschalten** (Einstellungen → Ernährung ändern) → Essensplan-PDF ohne kcal und ohne
   „Tagessumme“. Mit einem frischen Testkonto „schwanger“ = Ja: auch mit eingeschalteten Zahlen keine kcal im PDF.
6. Ohne Handy: GitHub-App → **Actions** → letzter **ci**-Lauf → Artefakt **pdf-vorschau** → die Dateien
   `alpha5-essensplan-…` und `alpha5-einkaufsliste-…` öffnen (Beispiel-Personen mit Testwerten, auch Belastungstests).

**Zutaten austauschen (Etappe N9, Testmodus, gratis, ohne KI)** – mit dem Testkonto aus Schritt 1 (vegetarisch,
Pilze „mag ich nicht“):

1. **Ernährung** → eine Mahlzeit von **heute oder später** antippen (z. B. mit Tofu, Reis, Spaghetti oder Honig) → in
   der Rezeptansicht steht neben Zutaten mit Rolle (Eiweißquelle, Beilage, Süße …) der Knopf **„Austauschen“**.
2. **„Austauschen“** → „Zutat austauschen“ zeigt die Zutat in deiner Portion, ihre Rolle und **nur passende
   Alternativen** (z. B. Ei statt Tofu, Spaghetti statt Reis) mit Menge, Hinweis und „Mahlzeit danach: … kcal“.
   **Prüfen:** kein Hähnchen, kein Fisch (vegetarisch), keine Pilze („mag ich nicht“). Gibt es keine passende
   Alternative, steht das ohne Grund da.
3. **Flugmodus an** → bei einer Alternative **„Nehmen“** → zurück im Rezept steht z. B. „Ei statt Tofu
   (ausgetauscht)“; Menge, Nährwerte und „Enthält: …“ sind neu. Flugmodus aus, Seite neu laden → der Tausch bleibt.
4. **Einkaufsliste** öffnen → die neue Zutat steht drauf, die alte (für diese Mahlzeit) nicht mehr.
5. Wieder **„Austauschen“** → ganz oben **„Original aus dem Rezept“** → „Nehmen“ → die Zutat ist zurückgetauscht.
6. Bei einem vorgekochten Gericht (Meal-Prep): Vor dem Kochtag gilt der Tausch für **alle Portionen dieses Kochtags**;
   was danach nicht mehr so lange hält, wird eingefroren oder frisch gekocht. **Am Tag nach dem Kochtag** gibt es für
   die vorgekochten Portionen keinen Knopf mehr.
7. **Kalorienzahlen ausschalten** (Einstellungen → Ernährung ändern) → im Dialog „Zutat austauschen“ keine kcal.
8. Ohne Einwilligung zu Gesundheitsangaben gibt es kein „Austauschen“ (ein Plan mit getauschten Zutaten zählt als
   Gesundheitsdatum). Rezepte ohne Kochen (z. B. Overnight Oats) bekommen nie Ei, Fisch oder Fleisch als Alternative.
   Ist der Kochtag-Timer gestartet, gibt es für die Gerichte dieses Kochtags keinen Austausch mehr.
9. Redaktionsbereich: `/admin` → **Austausch** → die Austausch-Tabelle (Testwerte erst mit echten Einträgen; im Moment
   „Noch keine Austausch-Einträge“). Neue Einträge: **Actions → content-generate** → Art
   **ingredient-substitutions** (Probelauf ohne Schlüssel möglich) → Pull Request prüfen; freigeben mit **Actions →
   content-review** → Art `ids` mit den IDs (`tausch-…`).

**Bewertung nach dem Essen (Etappe N10, Testmodus, gratis, ohne KI)** – mit dem Testkonto aus Schritt 1:

1. **Ernährung** → eine Mahlzeit von **heute** antippen → unten in der Rezeptansicht steht **„Wie war’s?“** mit
   **„Daumen hoch“** und **„Daumen runter“**. Bei einer Mahlzeit von morgen steht dort nur „Bewerten kannst du eine
   Mahlzeit, sobald ihr Tag da ist.“
2. **„Daumen runter“** → „Warum? (freiwillig)“: „Schmeckt mir nicht“, „Zu aufwendig“, „Zu teuer“, „Macht nicht satt“,
   „Unverträglich“ oder „Kein Grund“ → **„Speichern“**. **Prüfen:** Hier stehen nirgends kcal, und es steht da, bis
   wann das Rezept nicht mehr vorgeschlagen wird (8 Wochen).
3. **Ernährung** öffnen → dein Plan ist **unverändert** (eine Bewertung plant nichts automatisch um). **Woche →
   „Andere Vorschläge“** → das abgelehnte Rezept kommt ab heute nicht mehr vor (außer schon Vorgekochtem).
4. Rezept wieder öffnen → „Deine Bewertung: Daumen runter … bis einschließlich …“ → **„Bewertung zurücknehmen“**.
5. Andere Mahlzeit von heute → „Daumen runter“ → **„Unverträglich“** → „Speichern“ → Dialog **„Zutaten als ‚mag ich
   nicht‘ übernehmen?“**. **Prüfen:** Kein Häkchen ist gesetzt, „Übernehmen“ geht erst nach einer Auswahl. Eine Zutat
   wählen → „Übernehmen“ → Rezepte mit dieser Zutat kommen ab heute nicht mehr in den Plan (der Plan passt sich beim
   Öffnen an). Der Grund „Unverträglich“ wird **nicht gespeichert** – nur „Daumen runter“ und die gewählte Zutat.
   **Prüfen:** Der Hinweis sagt, dass nur genau diese Lebensmittel ausgeschlossen werden (keine verwandten Produkte,
   keine Spuren), und der Knopf „Allergien und Unverträglichkeiten im Profil eintragen“ führt ins Profil.
5a. **Nächste Woche:** Ernährung → Woche → „Nächste Woche“ ansehen (der Plan wird gespeichert) → ein Rezept daraus, das
   auch heute in deinem Plan steht, mit Daumen runter bewerten → in der nächsten Woche erscheint der Hinweis „In
   diesem Plan steht ein Rezept, das du mit Daumen runter bewertet hast“ mit **„Plan aktualisieren“**. Die laufende
   Woche bekommt diesen Hinweis nicht.
6. **Einstellungen → Ernährung → „Abgelehnte Lebensmittel und Bewertungen“** → die Zutat steht dort → **„Wieder
   zulassen“**. Darunter **„Alle Bewertungen löschen“** (mit Nachfrage).
7. **Einstellungen → Meine Daten exportieren** → in der Datei stehen `recipe_ratings` und `food_dislikes` (ohne Grund
   „Unverträglich“). **„Testdaten löschen“** entfernt auch Bewertungen und Abneigungen.

**Was habe ich da? – Kühlschrank-Suche (Etappe N11, Testmodus, gratis, ohne KI)** – mit dem Testkonto aus Schritt 1
(vegetarisch, Pilze „mag ich nicht“):

1. **Ernährung** → unten **„Was habe ich da?“** (auch oben in **„Rezepte suchen“**). **Prüfen:** Dort steht „Deine
   Auswahl wird nicht gespeichert“ und „Wähle oben mindestens eine Zutat aus …“.
2. In der Liste (nach Supermarkt-Abteilungen) gibt es **kein Fleisch** und **keine Champignons** – angeboten wird nur,
   was in Rezepten für dich vorkommt.
3. Nur **„Speisesalz“** antippen → Hinweis „Gewürze und Backzutaten allein reichen nicht …“.
4. **„Banane“** dazu → Rezepte erscheinen, sortiert nach „… % passt“. „Banane“ steht mit **„100 % passt“** und „Alle
   Hauptzutaten hast du da.“ ganz oben; andere Karten zeigen „Hast du: …“, „Fehlt noch: …“ und „Aus dem Vorrat: …“
   (Vorrat und Gewürze zählen weniger). Über der Liste steht die Warnung „Allergene noch nicht fachlich geprüft“.
5. Oben bei **„Zutat suchen“** z. B. „hafer“ tippen → die Liste wird kürzer. Nur **„Olivenöl“** gewählt → keine
   Karte mit „0 % passt“. Bei vielen Treffern stehen zuerst 30 Karten da, darunter **„Mehr anzeigen (noch …)“**.
6. Eine Karte antippen → Rezeptansicht (wie aus der Rezeptsuche). Zurück, Seite neu laden → **die Auswahl ist weg**.
7. **Kalorienzahlen ausschalten** (Einstellungen → Ernährung) → in „Was habe ich da?“ stehen nirgends kcal.
8. Mit einem zweiten Testkonto **vegan**, **Erdnüsse: Unverträglich** und **schwanger** (Gesundheits-Check): Erdnüsse,
   Räucherlachs, Ei und Milch tauchen in der Auswahl gar nicht auf; mit Banane + Tofu kommt kein Erdnuss-Rezept.

**Einkaufsliste weitergeben (Etappe N12, Testmodus, gratis, ohne KI)** – mit dem Testkonto aus Schritt 1. Weitergeben
heißt: **du selbst** schickst die Liste als Text an wen oder wohin du willst (WhatsApp, Notizen, Erinnerungen). Die App
schickt nichts selbst, es gibt kein öffentliches Profil und nichts für andere Nutzer.

1. **Ernährung → Einkaufsliste → „Weitergeben“**. **Prüfen:** Unter „So sieht der Text aus“ steht der ganze Text:
   „Einkaufsliste … – …“, darunter die Abteilungen (z. B. „Obst & Gemüse“) mit Zeilen wie „- 500 g …“ oder „- 3 Stück
   …“, am Ende „Vorrat (hast du wahrscheinlich da)“. **Nirgends** kcal, Gewicht, Ziel, Unverträglichkeit oder „statt“.
2. **„Weitergeben“** antippen → zuerst kommt **„Bevor du weitergibst“** (dein Plan berücksichtigt Gesundheitsangaben).
   „Abbrechen“ → „Abgebrochen – es wurde nichts weitergegeben.“ Nochmal → **„Weiter“** → der Teilen-Dialog deines Handys
   geht auf (Android-Chrome, iPhone-Safari) → z. B. **WhatsApp** an dich selbst oder **Notizen** wählen. **Prüfen:**
   Der Text sieht dort genauso aus wie in der Vorschau (Umlaute, Emojis aus eigenen Einträgen).
3. Häkchen **„Vorrat mitnehmen“** aus → der Vorrat verschwindet aus der Vorschau. Auf der Liste einen Eintrag
   abhaken → in „Weitergeben“ fehlt er; mit **„Erledigte Einträge mitnehmen“** steht er mit „(erledigt)“ da.
4. **„Text kopieren“** antippen → „Text kopiert – füge ihn … ein“ → in einer Notiz einfügen. Im Handy-Browser ohne
   Teilen-Dialog (z. B. Firefox auf Android) kopiert auch „Weitergeben“ den Text. Geht beides nicht, steht „Markiere den
   Text oben und kopiere ihn selbst“.
   **Echte App auf Android:** Nach dem Teilen-Dialog steht nur „Teilen-Dialog geöffnet.“ (Android meldet nicht, ob du
   wirklich etwas verschickt hast).
5. **Nach einem Zutaten-Austausch** („Zutaten austauschen“ oben) erneut „Weitergeben“ → der Hinweis nennt unter
   **„Betrifft: …“** die ausgetauschten Zutaten (sie stehen ohne Grund in der Liste, lassen aber Rückschlüsse zu).
6. Es gibt **keinen** Knopf „Bei einem Händler bestellen“ – die Händler-Anbindung ist vorbereitet, aber ausgeschaltet
   (kein Händler, keine Daten an Dritte). **„Stattdessen als PDF speichern“** führt zur PDF-Ansicht (Etappe N6).

**Portionsfaktor und Reste-Score (Etappe N13, nur Rechenlogik, ohne KI):** In der App gibt es dazu **noch nichts zu
sehen** – die Anzeige „Dieses Rezept verbraucht deinen restlichen Brokkoli“ und die Packungsangabe in der
Einkaufsliste kommen mit Etappe N14, das gemeinsame Kochen („Anna 180 g Reis · Ben 120 g Reis“) erst mit dem
Partner-Modus (Phase 11). So prüft ihr N13 am Handy:

1. GitHub-App → Pull Request von N13 → unten **Checks** → **ci** muss grün sein (dort laufen die neuen Tests:
   „Portionsfaktor hebt nie über die Obergrenze …“ und „Reste-Score an/aus → gleiche Kandidaten …“).
2. Vorschau-Link öffnen → **Ernährung** → die Woche sieht genauso aus wie vorher (N13 ändert bestehende Pläne nicht).

**Resteplanung (Etappe N14, Testmodus, ohne KI – nur der sichere Teil):** Der Essensplan bevorzugt jetzt Rezepte, die
angebrochene Packungen weiterverwenden, und sagt es an der Mahlzeit. **Packungszahlen und Restmengen zeigt die App
bewusst noch nicht** – dafür fehlen eure Entscheidungen G-N13-4 (wie lange halten z. B. Hartkäse, Butter, Öl, Salami
angebrochen) und N11-G3 (Packung bei Stückware). Mit dem Testkonto aus Schritt 1 (Beispiel-Rezepte an):

1. **Ernährung** → mit **„Nächster Tag“** durch die Woche blättern. **Prüfen:** An manchen Mahlzeiten steht
   **„Nutzt deinen Rest: Tofu (seit Mo)“** o. ä., darunter „Packungsgröße noch nicht geprüft (Testwert)“; unter den
   Mahlzeiten ein kurzer Satz, dass der Plan von üblichen Packungsgrößen ausgeht. **Nirgends** eine Gramm- oder
   Packungszahl im Hinweis.
2. **Wochenansicht** → an denselben Mahlzeiten steht „· nutzt einen Rest“.
3. Seite neu laden → **dieselben** Hinweise an denselben Mahlzeiten (der Plan ist fest).
4. Einstellungen → **Kalorienzahlen anzeigen** aus → die Hinweise bleiben, nirgends kcal.
5. Steht ein Hinweis an einem kurz haltbaren Lebensmittel (Fleisch, Fisch, Rohmilchkäse, Sprossen), kommt dazu
   „Angebrochen nur kurz haltbar: Die App plant diesen Rest nur bis zum Folgetag ein …“ – ein Rest von übermorgen wird
   nie eingeplant. (Mit den Beispiel-Rezepten kommt das nicht vor.)
6. Mit eingeschaltetem Screenreader (TalkBack/VoiceOver) eine Mahlzeit mit Hinweis antippen → vorgelesen wird
   „Rezept öffnen … Nutzt deinen Rest …“ samt „Testwert“-Hinweis.
7. Ein bereits gespeicherter Plan ändert sich durch N14 **nicht**; erst „Andere Vorschläge“ oder eine neue Woche
   plant mit dem Reste-Score.

**Redaktionsbereich Ernährung (Etappe N2d):** Vorschau-Link der Website → `/admin` → anmelden → oben **Rezepte**,
**Lebensmittel**, **Meal-Prep**, **Ratgeber**, **Austausch** (N9) und **Packungen** (N11: Lebensmittel mit Gramm je
Packung, Prüfbericht R24, Klick-Schritte „Freigabe per ID“; solange es keine gibt, steht dort „Noch keine
Packungsgrößen“). Rezepte: Kategorie antippen → Zahlen (Entwürfe, rot, Zutaten ohne
Katalog-Prüfung, offene Annahmen, Abweichungen) und je Rezept „Sammelfreigabe: wird freigegeben / übersprungen – Grund“;
unter **Ohne Kategorie** steht „Freigabe per ID“ (diese Rezepte erreicht die Sammelfreigabe nie). Rezept-Seite:
Import-Annahmen „bestätigt“, „noch nicht bestätigt“ oder „seitdem geändert“ (Zubereitung nach der Bestätigung geändert
→ erneut bestätigen). Lebensmittel: Checkliste der Katalog-Prüfung und je Lebensmittel die Angaben dazu. Meal-Prep und
Ratgeber zeigen die ID und die Klick-Schritte zur Freigabe. Nur ansehen – freigegeben wird über **Actions →
content-review** (Art `recipe` mit Kategorie oder Art `ids` mit IDs, SETUP 3b). Solange `foods-import`/`alpha5-import` nicht gelaufen sind, steht dort
„Noch keine Rezepte“ bzw. „Noch keine Lebensmittel“.

## Teil 7d – Datenbank für die Ernährung prüfen (Phase 5, Etappe N7 Teil 1)
In der App ändert sich dadurch **nichts Sichtbares**: Der Testmodus bleibt wie bisher, und der Supabase-Modus zeigt die
Ernährung erst mit Teil 2. Ihr müsst nichts einstellen und keine Schlüssel eintragen. Prüfen könnt ihr am Handy:

1. **Vor dem Merge:** Supabase im Handy-Browser → euer Projekt → links **Table Editor** → in der Liste darf es noch
   **keine** Tabellen `foods`, `recipes`, `guides`, `meal_plans` geben (sonst Claude Bescheid geben, nicht mergen).
2. GitHub-App → Pull Request öffnen → unten **Checks**: **db-test** (Migrationen + Datenbank-Tests) und **ci** sind
   grün. Falls db-test rot ist: nicht mergen, Claude im Chat Bescheid geben.
3. Optional: **Actions → db-types → Run workflow → Run workflow** → Lauf öffnen → **Summary**. Steht dort
   „database.types.ts ist aktuell“, ist alles gut; sonst den Unterschied Claude in den Chat kopieren (die Typen sind
   von Hand nachgezogen, kleine Reihenfolge-Unterschiede sind möglich).
4. **Nach dem Merge:** **Actions → db-migrate** → Lauf öffnen. Er testet zuerst die Datenbank („Datenbank-Tests vor dem
   Einspielen“) und spielt erst danach die neuen Tabellen ein (vorhandene Daten bleiben unverändert). **Warten, bis
   db-migrate grün ist.** Erst dann: Vercel → Projekt „fitnessapp“ → **Deployments** → neuestes → **⋯ → Redeploy**, und
   falls jemand die APK/TestFlight-App nutzt: **Actions → eas-build → Run workflow** (neuer Build). Grund: Ältere
   App-Stände lesen die Einwilligungstexte noch über eine Funktion, die jetzt für nicht Angemeldete gesperrt ist.
   Danach läuft **content-seed** wie bisher.
5. Supabase → links **Advisors** → **Security Advisor** → **Refresh**: Der Hinweis zu `current_consent_version`
   („executable by anon“) ist weg. **Erwartet und in Ordnung** sind Warnungen, dass angemeldete Nutzer Funktionen mit
   „security definer“ ausführen dürfen – z. B. `save_meal_plan`, `replace_shopping_list`, `save_training_plan`,
   `revoke_health_data`, `delete_my_account`. Diese Funktionen prüfen Login, Einwilligung und alle Werte selbst; nur so
   kann die App Pläne speichern, ohne direkt in die Tabellen schreiben zu dürfen. Neue, andere Meldungen bitte Claude
   schicken.
6. Optional: Supabase → **Table Editor**: Es gibt die neuen, leeren Tabellen `foods`, `recipes`, `meal_plans`,
   `shopping_lists`, `recipe_ratings`, `food_dislikes` u. a. Leer ist richtig – Rezepte kommen erst nach der
   Fachprüfung (Gründer-Entscheidung 6), Nutzerdaten erst mit Teil 2.

### Teil 7d (Fortsetzung) – Ernährung mit Konto (Etappe N7 Teil 2)
Ab jetzt läuft die Ernährung auch **mit Konto** (Supabase-Modus): Essensplan, Einkaufsliste, Tagebuch und eigene
Gerichte werden in der Datenbank gespeichert. Ihr müsst keine Schlüssel eintragen.

7. **Nach dem Merge:** GitHub-App → **Actions → db-migrate** → Lauf öffnen → **warten, bis er grün ist**. Erst dann
   Vercel → Projekt „fitnessapp“ → **Deployments** → neuestes → **⋯ → Redeploy** (und bei Bedarf **Actions →
   eas-build → Run workflow**). Meldet die App beim Löschen der Unverträglichkeiten „Löschen ist gerade nicht
   möglich …“, ist db-migrate noch nicht durch – dann warten und erneut versuchen (es wird nichts halb gelöscht).
8. **Tägliche Löschung prüfen:** Supabase im Handy-Browser → euer Projekt → links **Database → Extensions** → nach
   „pg_cron“ suchen: Der Schalter sollte **an** sein. Danach links **Integrations → Cron** (bzw. **Database → Cron
   Jobs**) → es gibt den Job **nutrition-weeks-retention** (täglich 02:23 UTC). Fehlt er: im Lauf von db-migrate nach
   „pg_cron“ suchen und den Hinweis Claude schicken. Ohne den Job werden alte Wochen nur beim Speichern gelöscht.
9. **Actions → content-seed** → letzter Lauf → **Summary**: Unter „Ernährung“ steht, was eingespielt wurde und was
   noch **wartet** (mit Grund, z. B. „Fachprüfung fehlt“). Solange die Fachprüfung offen ist, wartet alles – das ist
   richtig.
10. Vorschau-Link öffnen → **mit Konto** anmelden → **Ernährung**: Solange keine Rezepte freigegeben sind, steht dort
    „Noch keine Rezepte: Unsere Rezepte werden gerade fachlich geprüft …“ (kein Fehler). Tagebuch und eigene
    Gerichte gehen trotzdem.
11. **Tagebuch offline:** Flugmodus an → etwas eintragen → im Tagebuch steht „1 Eintrag wird übertragen, sobald du
    wieder online bist.“ → Flugmodus aus → nach wenigen Sekunden ist der Hinweis weg. Im Browser steht zusätzlich,
    dass noch nicht Übertragenes nur bis zum Schließen des Tabs bleibt.
12. Supabase → **Advisors → Security Advisor → Refresh**: Neu erwartet ist höchstens ein Hinweis zu
    `purge_expired_nutrition_weeks` bzw. `meal_plan_day_kcal_floor` („security definer“). Beide liegen im Schema
    `private` und sind für angemeldete Nutzer nicht aufrufbar. Andere neue Meldungen bitte Claude schicken.

## Teil 7f – Ernährungstagebuch testen (Etappe E1, Testmodus)
Das Tagebuch läuft im **Testmodus** und seit N7 Teil 2 auch mit Konto (Teil 7d, Schritt 11). Ihr müsst nichts einstellen.
Nach dem Merge spielt **db-migrate** (erst nach grünem db-test) zwei neue, leere Tabellen ein (`food_log_entries`,
`food_log_favorites`) – vorhandene Daten bleiben unverändert.

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit dem Testkonto aus Teil 7c (Einwilligung
   Gesundheitsdaten erteilt) → **Ernährung**.
2. Beim Frühstück **„Gegessen“** tippen. Beim Mittagessen „Gegessen“ tippen und danach **¾** wählen. Unten im
   Abschnitt **„Gegessen“** stehen beide mit Summe.
3. **„Eintragen“** → Mahlzeit **Snack** → Reiter **Suche** → „Banane“ → Banane antippen → **1 Stück** →
   „Eintragen“ → „Fertig“: Banane steht unter **Snack**.
4. „Eintragen“ → Reiter **Schnell** → **„Auswärts gegessen“**, **700** kcal → „Eintragen“ → **„Als Favorit
   merken“**. Reiter **Favoriten** zeigt ihn (auch morgen).
5. Mehr als 1.500 kcal in einem Eintrag → ruhige Rückfrage „Bitte kurz prüfen – Stimmen Menge und Einheit?“ (keine
   Sperre; bei „Kalorienzahlen aus“ ohne kcal).
6. **Flugmodus an** → etwas eintragen → Seite neu laden → alles ist noch da.
7. „Eintragen“ → **„← Früher“** bis zum 14. Tag zurück: geht; weiter zurück ist gesperrt, der Grund steht da.
8. Einen Eintrag **„Ändern“** (z. B. 2 Stück) und einen **„Löschen“**.
9. **Einstellungen → Kalorienzahlen anzeigen** aus → im Tagebuch keine kcal, im Schnelleintrag kein kcal-Feld.
10. **Einstellungen → Gesundheitsdaten widerrufen** → der Dialog nennt vorher „dein Ernährungstagebuch samt
    Schnelleintrag-Favoriten und eigenen Gerichten (Favoriten aus Lebensmitteln und Rezepten bleiben)“ → danach sind alle Einträge und der
    Favorit „Auswärts gegessen“ weg, ein Favorit wie „Banane“ ist noch da; „Eintragen“ bittet um die Einwilligung.
11. „Heute“ zeigt auf der Karte „Essen heute“: „Gegessen heute: … Einträge“ und „Essen eintragen“.

## Teil 7i – Eigene Gerichte testen (Etappe E2, Testmodus)
Eigene Gerichte laufen wie das Tagebuch im **Testmodus** und seit N7 Teil 2 auch mit Konto. Ihr müsst
nichts einstellen. Nach dem Merge spielt **db-migrate** (erst nach grünem db-test) zwei neue, leere Tabellen ein
(`custom_meals`, `custom_meal_items`) und erweitert das Tagebuch um die Herkunft „eigenes Gericht“ – vorhandene Daten
bleiben unverändert.

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit dem Testkonto aus Teil 7c (Einwilligung
   Gesundheitsdaten erteilt) → **Ernährung** → ganz unten Abschnitt **„Eigene Gerichte“** → **„Eigenes Gericht
   anlegen“**.
2. Name **„Mein Porridge“**, „Aus Zutaten“: „Hafer“ suchen → Haferflocken **60 g** → „Hinzufügen“; „Milch“ →
   Einheit **ml**, **200** → „Hinzufügen“; „Banane“ → **1 Stück** → „Hinzufügen“. Unter „Werte je Portion“ erscheinen
   die Werte → **„Speichern“**.
3. Zurück im Tagesverlauf: bei **„Eigene Gerichte“** Portion **½** wählen → bei „Mein Porridge“ **„Eintragen“**. Im
   Abschnitt „Gegessen“ steht „Mein Porridge · ½ Portion“, die Tagessumme stimmt (halbe Werte).
4. **„Eigene Gerichte verwalten“** → **„Neues Gericht anlegen“** → „Shake nach dem Training“, **„Werte direkt“**,
   **450** kcal (Eiweiß/Kohlenhydrate/Fett optional) → „Speichern“. Passen die Makros gar nicht zu den kcal (mehr als
   20 % daneben), kommt eine ruhige Rückfrage – keine Sperre.
5. **„Eintragen“** → Reiter **Favoriten**: oben „Eigene Gerichte“ mit Portion → Shake eintragen. Reiter **Zuletzt**
   zeigt beide.
6. „Mein Porridge“ **ändern** (z. B. „Ergibt Portionen“ 2) → der schon eingetragene Tag behält seine Werte.
7. Den Shake **löschen** → der Eintrag im Tagebuch bleibt mit seinen Werten und heißt jetzt „Eigenes Gericht“.
8. **Flugmodus an** → ein Gericht anlegen und eintragen → Seite neu laden → alles ist noch da.
9. **Einstellungen → Kalorienzahlen anzeigen** aus → beim Anlegen gibt es nur „Aus Zutaten“ (Werte im Hintergrund)
   oder „Ohne Werte“, nirgends kcal.
10. **Einstellungen → Gesundheitsdaten widerrufen** → der Dialog nennt „… samt Schnelleintrag-Favoriten und eigenen
    Gerichten …“ → danach sind die eigenen Gerichte weg; „Eigene Gerichte“ bittet um die Einwilligung.
## Teil 7g – „Dein Tag“ testen (Etappe A2, Testmodus)
Die Tagesauswertung braucht keine Einstellung und keine Datenbank-Änderung. Das Essen erscheint vorerst nur im
**Testmodus** (mit Konto folgt es mit N7 Teil 2), der Trainingsteil geht in beiden Modi.

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit dem Testkonto aus Teil 7c → auf „Heute“
   **„Dein Tag – Essen und Training“** tippen. Ohne Einträge steht „Nichts eingetragen.“ und das Tagesziel – kein
   Balken, nie „0 kcal“.
2. Bei der ersten Mahlzeit **„Gegessen“** → der Balken füllt sich **neutral** mit „○ Noch offen“ (heute nie rot). Alle
   Mahlzeiten „Gegessen“ → **„✓ Im Zielbereich“** (grün; beim Abnehmen erst etwa ab dem Tagesziel, darunter gelb
   „Etwas unter deinem Tagesziel“), darüber „1.640 von 1.800 kcal“ (eure Zahlen).
3. **„← Vortag“** → gestern ohne Einträge ist grau „Nichts eingetragen.“. Über „Mahlzeiten und Einträge“ →
   „Eintragen“ (gestern ist schon gewählt) → Schnell → „Mahlzeit“ **300** kcal → wieder „Dein Tag“ für gestern:
   **„↓ Unter deinem Mindestbedarf“** (rot) mit ruhigem Satz und „Laut deinen Einträgen. Fehlt etwas? Du kannst es
   nachtragen.“
4. Gestern zusätzlich **3.000** kcal eintragen → „↑ Deutlich über deinem Ziel“ mit „Ein einzelner Tag ändert wenig.“
   (kein Ausrufezeichen, kein Warnsymbol). Dazwischen gibt es gelb „Etwas unter/über deinem Ziel“.
5. Ein Tag in der Zukunft (**„Folgetag →“**): Vorschau mit Tagesziel und geplanter Einheit, kein Balken.
6. **Kalender** → auf den Namen eines Tages tippen („· Dein Tag ›“) bzw. **Woche** → „Dein Tag“ unter einem Tag:
   öffnet die Tagesauswertung dieses Tages.
7. Training: Einheit von heute starten, **einen** Satz abhaken, speichern → „Dein Tag“ zeigt „◐ Teilweise gemacht ·
   … %“ und je Übung „1/3 Sätze“. Alle Sätze nach Vorgabe → „✓ Ziel erreicht“; 2 von 3 → „◕ Größtenteils gemacht“.
8. **Einstellungen → Kalorienzahlen anzeigen** aus → „Dein Tag“ zeigt **keinen Balken, keine Farbe, keine kcal**,
   nur „Mahlzeiten: x von y abgehakt“ und das Training.
9. Testkonto mit Gesundheits-Check „schwanger“ (Teil 7c): kein Balken, keine Zahl, Hinweis auf Ärztin, Arzt oder
   Hebamme.
10. Ein Tag der **Vorwoche**, für die nie ein Essensplan gespeichert war: keine Mahlzeitenliste, keine
    „Gegessen“-Knöpfe, Text „Für diesen Tag ist kein Essensplan gespeichert …“.
11. **Flugmodus an** → „Dein Tag“ neu laden → alles ist noch da (Gerätespeicher).

**Bitte fachlich prüfen lassen (vor dem Livegang):** Farbgrenzen (A-G5: grün = Planband, beim Abnehmen erst ab max(Untergrenze; Ziel × 0,95) – Gründer-Entscheidung 15.10.2026, rot unten = unter dem
Mindestbedarf, rot oben = über max(Obergrenze; Ziel × 1,2)) und „Ziel erreicht ab 90 %“ (A-G11) – beide stehen als
Konstanten `INTAKE_ZONES` und `SESSION_ACHIEVEMENT` in `packages/core/src/constants.ts`.

## Teil 7h – Wochenauswertung testen (Etappe A3, Testmodus)
Keine Einstellung und keine Datenbank-Änderung nötig. Das Essen erscheint vorerst nur im **Testmodus** (mit Konto folgt
es mit N7 Teil 2), der Trainingsteil geht in beiden Modi.

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus → ein paar Tage dieser Woche Mahlzeiten „Gegessen“ abhaken
   bzw. über „Eintragen“ nachtragen und eine Einheit trainieren (auch nachtragen, Teil 7a2).
2. **Woche** → **„Wochenauswertung“** (oder im **Kalender** → „Wochenauswertung“): je Tag ein kleiner Balken mit
   Zeichen und Kurztext („✓ Im Zielbereich“, „↓ Unter Mindestbedarf“ …). Heute steht „Noch offen“ bzw. „Heute läuft
   noch und zählt erst danach mit.“
3. Einen Tag antippen → „Dein Tag“ zeigt dieselbe Farbe. Die Zahlen der Woche („An 3 Tagen eingetragen. Davon …“,
   „Ø … von Ø … kcal je eingetragenem Tag“) passen zu den Tagesansichten; Tage ohne Eintrag zählen nicht mit. Es gibt
   **keine** Wochen-Summe in kcal und keine Prognose.
4. Training: „Einheiten: x von y erledigt“, „Kraft-Sätze: x von y erfüllt“, Ausdauer-Minuten, Strecke; je Einheit Tag,
   Stufe und Prozent. Freie Einheiten stehen extra.
5. **„‹ Vorwoche“ / „Nächste Woche ›“** blättern. Eine kommende Woche zeigt „Diese Woche hat noch nicht begonnen“.
6. An **drei** vergangenen Tagen nur je **300** kcal eintragen → ruhiger Hinweis „Laut deinen Einträgen lagen in
   dieser Woche mehrere Tage unter deinem Mindestbedarf …“ mit den Hilfe-Stellen (genau einmal). Bei zwei Tagen kommt
   er nicht. Am Montag oder Dienstag gibt es noch keine drei vergangenen Tage – dann in der **Vorwoche**
   nachtragen („Eintragen“ → Tag bis 14 Tage zurück wählen) und dort mit „‹ Vorwoche“ ansehen.
7. **Einstellungen → Kalorienzahlen anzeigen** aus → keine Balken, keine Farben, nirgends kcal – nur
   „An n Tagen eingetragen“, „Mahlzeiten: x von y abgehakt“ und das Training. Mit den drei Tagen aus Schritt 6 steht
   dann **nur** der feste Hilfe-Hinweis („Wenn Essen oder Gewicht dich belasten“) da – ohne „Mindestbedarf“, ohne
   Zahl. Mit Gesundheits-Check „schwanger“: keine Zahlen, kein Hilfe-Hinweis, dafür der Hinweis auf Ärztin, Arzt oder
   Hebamme.
8. **Flugmodus an** → neu laden → alles ist noch da (Gerätespeicher).

**Bitte fachlich prüfen lassen (vor dem Livegang):** Muster-Hinweis ab 3 Tagen unter dem Mindestbedarf je Woche
(A-G13, Konstante `WEEK_EVALUATION` in `packages/core/src/constants.ts`).

## Teil 7e – Neue Rezepte per KI erzeugen (Phase 5, Etappe N8, Gemini offline)

Die KI (Google Gemini) schreibt **nur Entwürfe** – offline über die Batch-API, nie in der App. Nutzerdaten gehen nie an
Gemini, nur Regeln und der Lebensmittel-Katalog. Jeder Entwurf wird automatisch geprüft und muss von euch freigegeben
werden.

**A. Probelauf (ohne Schlüssel, kostenlos) – zuerst ausprobieren**

1. GitHub-App → Repository → **Actions** → **content-generate** → **Run workflow**.
2. **Welche Inhalte erzeugen?** → `recipes`. **Probelauf** anhaken. Rest so lassen → **Run workflow**.
3. Nach ca. 1 Minute ist der Lauf grün. **Actions → content-collect → Run workflow → Run workflow**.
4. Unter **Pull requests** erscheint **„Probelauf: Neue Entwürfe (Rezepte) – nicht mergen“**. Im Text: ein Beispiel-
   Rezept gespeichert (`probelauf-haferflocken-banane`), eines **ungültig**, eines **abgelehnt**. Kosten: keine.
5. Pull Request **schließen** (nicht mergen) → **Delete branch**.

**B. Echter Lauf (mit `GEMINI_API_KEY`, kostet Geld)** – erst sinnvoll, wenn es katalog-geprüfte Lebensmittel gibt
(sonst steht in der Summary „Rezepte gerade nicht möglich“ und es wird nichts gesendet).

**Vorher einmalig: Monatsbudget mit Warnung** (Handy-Browser, ggf. „Desktop-Website anfordern“):
**console.cloud.google.com** → oben das Projekt des Schlüssels wählen → **☰ → Billing → Budgets & alerts → Create
budget** → Name `gemini-content`, nur dieses Projekt → **Next** → Betrag **10 $** → **Next** → Schwellen 50/90/100 %
lassen, E-Mail-Warnung anhaken → **Finish**. Das Budget warnt nur; die harte Grenze ist der Deckel von 3 $ pro Lauf im
Skript (Details `docs/SETUP.md` Teil E, Schritt 3a).

1. **Actions → content-generate → Run workflow** → Art `recipes`.
2. **Auswahl**, z. B. `fruehstueck vegan schnell` oder `hauptgericht meal_prep` (`alle` = alle 45 Kombinationen;
   bei „alle“ wechseln sich Mahlzeit und Ernährungsform ab, und der Start rückt nach jedem gemergten Lauf weiter –
   die Summary nennt die Startstelle).
3. **Anzahl**: beim **ersten echten Lauf `3`** (= Standard; prüft günstig, ob Gemini den großen Katalog annimmt),
   danach höchstens so viele, wie unter den Deckel von 3 $ passen (Summary zeigt die Schätzung). **Modell** leer
   lassen (Standard für Rezepte `gemini-3.8-flash`, Denktiefe `medium`; Flash-Lite ist günstiger, für Rezepte aber
   fachlich fraglich). Probelauf **nicht** anhaken → **Run
   workflow**.
4. Summary öffnen: Dort stehen **Kostenschätzung** (schlimmster Fall) und Deckel. Liegt sie darüber: „abgebrochen –
   nichts gesendet“. Steht dort **„AUSGANG UNKLAR“** (Netzfehler beim Absenden): **nicht** neu starten, sondern in
   Google AI Studio unter „Batches“ nach dem genannten Anzeigenamen (`alpha5-recipes-<Datum>-<kurz>`) sehen und Claude
   Bescheid geben – sonst zahlt ihr evtl. doppelt.
5. Meist nach einigen Stunden (Ziel von Google: innerhalb von 24 Stunden) öffnet **content-collect** automatisch den Pull Request **„Neue Entwürfe: …
   Rezepte“** – schneller: **content-collect → Run workflow**. Im Text: Prüfbericht je Rezept (✅/🔴/🟡), nicht
   gespeicherte Antworten mit Grund, tatsächliche Kosten.
6. Ansehen: Vercel-Vorschau der Website → `/admin` → **Rezepte** (Hinweis „KI-Entwurf – fachlich prüfen“). Rot heißt
   z. B. „deklarierte Allergene passen nicht zu den Zutaten“ – solche Entwürfe nicht freigeben, sondern korrigieren
   lassen oder löschen. Fehlende Lebensmittel stehen unter **Prüfnotiz** (nur Vorschlag).
7. Passt alles: auf grünes **ci** warten → **Merge pull request** → **Delete branch**. Die Rezepte sind jetzt
   **Entwürfe** in `main`. Freigeben: **Actions → content-review** → Art `ids` → IDs der Rezepte → `published`.
   Vor dem Livegang prüft zusätzlich eine Ernährungsfachkraft.

## Teil 8 – Live-Test mit Supabase (Pflicht vor „MVP fertig“, W13) – **offen, braucht euch**
Diesen Test kann Claude in der Cloud-Sitzung nicht machen (kein echtes Konto, keine zwei Handys). Bitte einmal
durchspielen und das Ergebnis Claude im Chat schreiben („W13: Punkt 1–14 ok, Punkt 9 Fehler: …“) – **ohne**
Passwörter oder Codes. Claude trägt es dann im Umsetzungsstand von `docs/PLAN-PHASE-4.md` ein.

**Vorbereitung**
1. Supabase ist eingerichtet (docs/SETUP.md), Migrationen sind durch (GitHub-App → Actions → `db-migrate` grün),
   freigegebene Inhalte sind eingespielt (`content-seed`).
2. Vercel → Projekt „fitnessapp“ → **Settings → Environment Variables**: `EXPO_PUBLIC_SUPABASE_URL` und
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sind für „Preview“ und „Production“ eingetragen → **Deployments → Redeploy**.
3. Zwei Handys (A und B), auf beiden den Vorschau-Link (bzw. die Produktions-Adresse) im Browser öffnen und mit
   **demselben Konto** per E-Mail-Code anmelden. Wenn vorhanden: zusätzlich die Android-APK/TestFlight-App (für 12–14).

**Prüfpunkte W13**
1. Handy A: Onboarding fertig, Plan erstellt. Handy B: Seite neu laden → derselbe Plan.
2. Handy A: **Flugmodus an** → Training starten, Sätze abhaken, **Training speichern** → „noch nicht übertragen“.
3. Handy A: **Flugmodus aus** → nach wenigen Sekunden verschwindet „wird übertragen“ (spätestens nach 15 Sekunden
   bzw. beim Zurückkehren in die App).
4. Handy B: neu laden → das Training ist auf „Heute“ erledigt, in **Woche** und **Verlauf** sichtbar.
5. **Konflikt:** Auf A und B denselben Eintrag öffnen (**Ansehen/Ändern**), auf A etwas ändern und speichern, danach auf
   B etwas anderes ändern und speichern → B zeigt „Diese Einheit wurde auf einem anderen Gerät geändert.“ →
   **Meine Fassung behalten** → A zeigt nach dem Neuladen die Fassung von B.
6. **Löschen nur online:** Handy A Flugmodus an → Verlauf → Eintrag → **Eintrag löschen** → „Dafür brauchst du kurz
   Verbindung.“ Flugmodus aus → erneut löschen → „Eintrag gelöscht.“; B zeigt ihn nach dem Neuladen nicht mehr.
7. **Export:** Einstellungen → **Meine Daten exportieren** → Datei öffnen: eure **E-Mail** steht unter `account`,
   `session_logs` und `consents` sind gefüllt. Im Flugmodus kommt „Dafür brauchst du kurz Verbindung.“
8. **Widerruf:** Einstellungen → Gesundheitsdaten → **Widerrufen** → „Tagebuch behalten (empfohlen)“ → Plan wird neu
   angeboten, der **Verlauf bleibt**; Einträge zeigen keine Vorgaben aus dem Gesundheits-Check mehr. Danach wieder
   einwilligen und neuen Plan erstellen.
9. **Abmelden mit Wartendem:** Flugmodus an → Training speichern → Einstellungen → **Abmelden** → Nachfrage „1 Training
   ist noch nicht übertragen“ → **Jetzt senden** → „immer noch nicht alles übertragen“ → **Abbrechen**, Flugmodus aus,
   erneut Abmelden → ohne Nachfrage abgemeldet.

**Prüfpunkte S5 (aus der Wächter-Prüfung C1) und Geräte-Punkte**
10. **App hart beenden:** (App bzw. APK) Flugmodus an, ein Training speichern und ein zweites nur anfangen (Entwurf) →
    App aus dem App-Wechsler wischen → neu öffnen → „Du hast ein Training … nicht beendet“ und das wartende Training
    sind noch da → Flugmodus aus → beides wird übertragen (Entwurf vorher speichern).
11. **Sitzung abgelaufen:** Training im Flugmodus speichern, die App mehrere Stunden (über Nacht) zu lassen, dann
    Flugmodus aus → kommt „Bitte melde dich erneut an“, bleibt das Training wartend; nach dem Anmelden wird es
    übertragen.
12. **Plan geändert, während ein Training wartet (echter Server):** Handy A Flugmodus an, Training speichern; auf
    Handy B **Einstellungen → Plan neu erstellen**; dann auf A Flugmodus aus → das Training wird übertragen und steht
    im **Verlauf** (je nach Stand mit dem Hinweis „Dein Plan hat sich geändert – dein Training wurde trotzdem
    gespeichert.“) – nichts geht verloren. (Eine echte
    Ablehnung lässt sich am Handy kaum auslösen; sie ist mit automatischen Tests geprüft.)
13. **Privates Browser-Fenster:** Link im privaten Tab öffnen, anmelden, Flugmodus an, Training speichern → Hinweis
    „Offline-Speicher nicht verfügbar …“ (bzw. Speichern klappt online).
14. **Nur in der App (APK/TestFlight):** Pausentimer-Ende **vibriert**; der **Bildschirm bleibt an**, solange das
    Training offen ist (Schalter in den Einstellungen); **Meine Daten exportieren** öffnet die Ordner-Auswahl
    (iPhone: „Dateien“, Android: z. B. „Downloads“) und die Datei liegt danach dort.
15. **Export zweimal am selben Tag** (App): denselben Ordner wählen → die zweite Datei heißt
    `alpha5-meine-daten-<Datum>-2.json`, die erste bleibt unverändert. Auf dem **iPhone** einmal mit
    **„Auf meinem iPhone“** und einmal mit **iCloud Drive** prüfen (beide Male „Die Datei wurde gespeichert.“ und die
    Datei ist in der Dateien-App zu sehen).

**Prüfpunkte Ernährung mit Konto (N7 Teil 2)** – erst, wenn Rezepte nach der Fachprüfung eingespielt sind (16–18),
19–20 gehen schon vorher:
16. Handy A: **Ernährung** → Plan wird erstellt → Handy B neu laden → **derselbe Plan** (gleiche Gerichte).
17. Handy A: **Einkaufsliste** → Flugmodus an → zwei Einträge abhaken → Flugmodus aus → Handy B neu laden → beide
    abgehakt. (Mit Unverträglichkeiten geht Abhaken nur online – dann kommt „Dafür brauchst du kurz Verbindung.“)
18. Handy B: Seite neu laden, ohne etwas zu ändern → der Plan bleibt gleich (kein neuer Vorschlag), auch nach
    Ab- und wieder Anmelden.
19. Handy A: Tagebuch → im Flugmodus „Banane“ eintragen → Einstellungen → **Abmelden** → Nachfrage „1 Eintrag
    (Training oder Ernährung) ist noch nicht übertragen.“ → **Abbrechen** → Flugmodus aus → Handy B zeigt die Banane.
20. Handy B Flugmodus an → einen Tagebuch-Eintrag ändern. Handy A ändert denselben Eintrag (online). Handy B Flugmodus
    aus → B zeigt „1 Eintrag konnte nicht gespeichert werden (z. B. auf einem anderen Gerät geändert …)“ und behält
    seine Fassung, bis ihr **Verwerfen** tippt; danach zeigt B nach dem Neuladen die Fassung von A.

**Vorschlag (noch nicht gebaut): automatischer Smoke-Test.** Ein manuell startbarer GitHub-Workflow könnte die
Punkte 2–7 ohne Handys gegen Supabase prüfen (Playwright im Supabase-Modus mit einem eigenen Test-Konto). Dafür
bräuchte es ein zweites Supabase-Projekt nur für Tests (sonst landen Testdaten im echten Projekt) und einen Weg, den
Anmelde-Code ohne Postfach zu bekommen (Service-Role-Schlüssel als GitHub-Secret). Das ist größer als dieser Schritt
und braucht eure Entscheidung – die Handy-Prüfung oben ersetzt er ohnehin nicht (zwei Geräte, Flugmodus, App-Funktionen).

## Teil 9 – Echte App bauen und auf dem Handy prüfen (Phase 4, Etappe E) – **braucht euch**
Claude kann in der Cloud-Sitzung weder Expo-, Apple- noch Google-Konten bedienen. Die Einrichtung steht in
`docs/SETUP.md` Teil D (Expo, Android) und Teil D2 (Apple/TestFlight, Google Play). Schlüssel **nie** in den Chat –
nur in GitHub-Secrets bzw. auf expo.dev.

**A – Workflow starten (GitHub-App)**
1. GitHub-App → Repository → **Actions** → **eas-build** → oben **Run workflow** (fehlt der Knopf: im Browser
   „Desktop-Website anfordern“).
2. Branch **main**, Plattform, Profil und „Nach dem Build einreichen“ wählen:
   - Android-Test: **android / preview / nein**
   - iPhone-Test: **ios / production / ja** (vorher einmal `eas-ios-setup` mit Eingabe **JA**, SETUP D2 Schritt A6)
3. **Run workflow** → nach ca. 1–3 Minuten ist der Lauf grün. Lauf antippen → **Summary**: dort steht der Link zur
   Build-Seite auf expo.dev (oder, falls etwas fehlt, „eas-build übersprungen“ mit dem Grund – z. B. fehlendes
   `EXPO_TOKEN` oder fehlende Projekt-ID).
4. Der eigentliche Build dauert auf expo.dev ca. 15–30 Minuten (Gratisplan: Warteschlange).

**B – Android-APK installieren**
1. Build-Seite auf dem Android-Handy öffnen (bei expo.dev angemeldet) → **Install** bzw. **Download** → APK öffnen.
2. Beim ersten Mal fragt Android „Installation aus unbekannten Quellen“ → für den Browser **erlauben** → zurück →
   **Installieren**. Play Protect warnt evtl. („unbekannte App“) → **Trotzdem installieren**.
3. Neue Version: einfach die neue APK genauso installieren (die Daten bleiben).

**C – iPhone über TestFlight**
1. Einmalig die App **TestFlight** aus dem App Store laden und mit der Apple-ID anmelden, die in App Store Connect
   als interne Testerin bzw. interner Tester eingetragen ist (SETUP D2 Schritt A7).
2. Nach dem Build mit „Einreichen: ja“ dauert die Verarbeitung bei Apple noch ca. 10–30 Minuten; dann kommt eine
   E-Mail bzw. Mitteilung von TestFlight → **TestFlight → Alpha5 → Installieren**.

**D – Was auf echten Geräten zu prüfen ist** (je einmal Android und iPhone; Ergebnis Claude schreiben, z. B.
„E: Punkt 1–9 ok, Punkt 4 iPhone Fehler: …“ – ohne Passwörter oder Codes)
1. **Start:** App-Name **Alpha5** unter dem Symbol, Logo-Symbol (Android auch rund und als „Designtes Symbol“),
   Startbildschirm Logo auf Schwarz, App startet ohne Absturz; hell und dunkel.
2. **Keine Berechtigungs-Abfragen:** Beim ganzen Durchklicken fragt die App **nie** nach Kamera, Fotos, Standort,
   Face ID, Kontakten oder Mitteilungen. Android: Einstellungen → Apps → Alpha5 → Berechtigungen zeigt
   „Keine Berechtigungen“ (Internet und Vibration zählen nicht als Berechtigung).
3. **Testmodus und Anmeldung:** „Ohne Konto testen“ funktioniert; mit Supabase-Werten auf expo.dev (SETUP D6)
   klappt die Anmeldung per E-Mail-Code.
4. **Pausentimer vibriert** am Ende der Pause (Etappe C2) – App offen lassen; Ton aus/Vibration an.
5. **Bildschirm bleibt an**, solange das Training offen ist (Bildschirm-Sperre z. B. 30 Sekunden einstellen und
   warten); Schalter in den Einstellungen aus → Bildschirm geht wieder aus (C2).
6. **Offline:** Flugmodus an → Training eintragen und speichern → App aus dem App-Wechsler wischen → neu öffnen →
   Eintrag und Entwurf sind noch da (Teil 8 Punkt 10, im Supabase-Modus).
7. **Datenexport in einen Ordner** (Etappe D): Einstellungen → **Meine Daten exportieren** → Hinweis → Ordner
   wählen (iPhone: „Dateien“ → „Auf meinem iPhone“ bzw. iCloud Drive; Android: z. B. „Downloads“) →
   „Die Datei wurde gespeichert.“ → Datei ist im Ordner. Zweiter Export am selben Tag → Datei mit `-2` (Teil 8
   Punkte 14–15).
8. **PDF-Export** (Plan P4): „Heute“ → **Als PDF speichern** → (Hinweis bei Gesundheits-Check) → **Drucken / als
   PDF sichern** → System-Druckdialog erscheint; A4 hochkant, Logo, Tabellen nicht abgeschnitten. iPhone: in der
   Druckvorschau Teilen-Symbol → **In Dateien sichern**; Android: Drucker **Als PDF speichern**. Auch im
   **Flugmodus**. Abbrechen des Dialogs zeigt keinen Fehler.
9. **Sicherung:** Android-Einstellungen → Google → Sicherung: Alpha5 wird nicht mitgesichert (gewollt – das
   Tagebuch ist verschlüsselt, die Sicherung ist der Server).
10. **Live-Test W13** (Teil 8) am besten gleich mit der echten App wiederholen – Punkte 10–15 gehen nur dort.
11. **PDF Essensplan und Einkaufsliste** (Etappe N6 – PDF P5, im Testmodus „Ohne Konto testen“): Ernährung → Woche
    → **Als PDF speichern** → Hinweis → **Weiter** → **Drucken / als PDF sichern** → System-Druckdialog; A4
    hochkant, Logo, Wochenübersicht nicht abgeschnitten, Rezepte mit Schritten. Dasselbe in der **Einkaufsliste**
    (Kästchen, keine kcal). Auch im **Flugmodus**; Abbrechen des Dialogs zeigt keinen Fehler. Nativ gibt es keine
    Vorschau in der App – das Dokument erscheint direkt im Druckdialog. **Noch nicht geprüft** (Claude kann keinen
    EAS-Build starten): bitte einmal Android (A + B oben) und Ergebnis schreiben, z. B. „N6 Android ok“.

## Tipps
- Eine Sitzung = eine Aufgabe. Lieber mehrere kurze Sitzungen als eine endlose.
- Bei Unsicherheit einfach fragen: „Erklär mir in einfachen Worten, was du gerade geändert hast.“
- Größere Zwischenstände in der GitHub-App mit einem Release/Tag markieren lassen („Markiere den aktuellen Stand als v0.1“).
