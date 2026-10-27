# Start nur mit dem Handy – Schritt für Schritt

Ihr braucht keinen Computer. Claude Code arbeitet in der Cloud, GitHub speichert den Code,
Vercel zeigt die App im Handy-Browser, Expo baut die echten Apps in der Cloud.

> **Neue Reiter-Namen seit 26.10.2026 („App verschlanken“, Teil 9v):** unten **Heute · Training · Ernährung ·
> Einkaufen · Mehr**. Ältere Teile sagen noch „Übersicht“ (= jetzt **Heute**) bzw. „Heute“ (= jetzt **Training**);
> **Einstellungen** liegen unter **Mehr → Einstellungen** in 7 Themen, **Workouts** im Training oben im Umschalter.

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
  - Alles auf einmal freigeben: **Actions → content-review → Run workflow** → Art `ids`, IDs `alle`, Neuer Status `published`, Prüfer = dein Name → Pull Request prüfen und **mergen**. Danach spielt `content-seed` die Inhalte automatisch ein (braucht die GitHub-Secrets `SUPABASE_URL` und `SUPABASE_SECRET_KEY`).

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
8. **Tägliche Löschung prüfen:**
   1. GitHub-App → **Actions → db-migrate** → letzter Lauf → **Summary** → Abschnitt „Täglicher Löschlauf“: Dort
      stehen Zeitplan `23 2 * * *`, Rolle `postgres`, aktiv `t` und der letzte Lauf. Eine gelbe Warnung („Löschlauf
      fehlt“, „nicht lesbar“, „fehlgeschlagen“) bitte Claude schicken – der Lauf bleibt trotzdem grün, weil die
      Migrationen schon eingespielt sind.
   2. Zusätzlich in Supabase (Handy-Browser) → euer Projekt → links **Database → Extensions** → „pg_cron“ suchen:
      Schalter **an**.
   3. Links **Integrations → Cron** (bzw. **Database → Cron Jobs**) → Job **nutrition-weeks-retention** antippen →
      Reiter **History** (bzw. „Runs“): **Am Tag nach dem Merge** (erster Lauf 02:23 UTC = 03:23/04:23 Uhr) steht dort
      ein Lauf mit Status **succeeded**. Steht dort „failed“, die Zeile (ohne Daten, nur Status und Meldung) Claude
      schicken.
   4. Alternativ: links **SQL Editor** → `select status, start_time from cron.job_run_details order by start_time
      desc limit 3;` → **Run** → oberste Zeile **succeeded**.
   Ohne den Job werden alte Wochen nur beim Speichern gelöscht (inaktive Konten dann gar nicht – deshalb wichtig).
9. **Actions → content-seed** → letzter Lauf → **Summary**: Unter „Ernährung“ steht, was eingespielt wurde und was
   noch **wartet** (mit Grund, z. B. „Fachprüfung fehlt“). **Testphase (seit 19.10.2026):** Freigegebenes kommt auch
   ohne Fachprüfung in die App – die Summary zeigt „🧪 Testphase: … ohne Fachprüfung“ (Teil 7t).
10. Vorschau-Link öffnen → **mit Konto** anmelden → **Ernährung**: Solange keine Rezepte freigegeben sind, steht dort
    „Noch keine Rezepte: Unsere Rezepte werden gerade fachlich geprüft …“ (kein Fehler). Tagebuch und eigene
    Gerichte gehen trotzdem.
11. **Tagebuch offline:** Flugmodus an → etwas eintragen → im Tagebuch steht „1 Eintrag wird übertragen, sobald du
    wieder online bist.“ → Flugmodus aus → nach wenigen Sekunden ist der Hinweis weg. Im Browser steht zusätzlich,
    dass noch nicht Übertragenes nur bis zum Schließen des Tabs bleibt.
12. Supabase → **Advisors → Security Advisor → Refresh**: Neu erwartet ist höchstens ein Hinweis zu
    `purge_expired_nutrition_weeks` bzw. `meal_plan_day_kcal_floor` („security definer“). Beide liegen im Schema
    `private` und sind für angemeldete Nutzer nicht aufrufbar. Andere neue Meldungen bitte Claude schicken.

## Teil 7t – Testphase: Rezepte ohne Fachprüfung – und vor dem Livegang zurückstellen (19.10.2026)

Bis zum öffentlichen Start dürfen **freigegebene** Rezepte, Ratgeber usw. auch **ohne** Prüfung durch eine
Ernährungsfachkraft in die App. Sie tragen dort den Hinweis **„Testphase – noch nicht fachlich geprüft“**. Gesteuert
wird das von **einer Datei**: `content/einspiel-regeln.json` mit `"nur_fachlich_geprueft": false` (= Testphase).

**A. Testphase prüfen (nach dem Merge dieses Pull Requests)**

1. GitHub-App → **Actions**: Direkt nach dem Merge starten **db-migrate** und **content-seed** gleichzeitig. Ein
   **roter content-seed-Lauf** kurz nach dem Merge ist möglich und harmlos (die Datenbank kennt die neue Testphase-
   Einstellung erst, wenn db-migrate fertig ist; eingespielt wird dann nichts). **Es zählt der content-seed-Lauf
   NACH dem grünen db-migrate** – startet keiner von selbst: **content-seed → Run workflow → Run workflow**.
2. Diesen Lauf öffnen → **Summary**: „Einspiel-Regel: TESTPHASE …“. Ab dem ersten freigegebenen Rezept steht darunter
   „🧪 Testphase: … ohne Fachprüfung“ mit den IDs. Ratgeber mit Mengen-/Dosierungsangaben (Prüfhinweis **R21H**) kommen
   auch in der Testphase **nur mit Fachprüfung** in die App – sie stehen unter „nicht eingespielt“ mit dem Grund
   „Dosierungs-Befund (R21H)“.
3. Vorschau-Link → **mit Konto** anmelden → **Ernährung → Rezepte suchen**: Treffer zeigen klein „Testphase – nicht
   fachlich geprüft“. Rezept antippen → oben der Hinweis **„Testphase – noch nicht fachlich geprüft“** und die
   Allergen-Warnung. Ratgeber ebenso (auch in der Ratgeber-Liste gekennzeichnet).
4. Ohne Konto (Testmodus, Beispiel-Rezepte) bleibt alles wie bisher („Entwurf …“ mit Allergen-Warnung).

**B. Vor dem öffentlichen Livegang: auf „nur fachlich geprüft“ umstellen** (erst, wenn die Fachkraft geprüft hat)

1. Handy-Browser → github.com → euer Repository → Ordner **content** → Datei **einspiel-regeln.json** → Stift-Symbol
   (**Edit**; ggf. „Desktop-Website anfordern“).
2. `false` durch `true` ersetzen (nur dieses Wort; gern auch den Text bei `"grund"` anpassen, z. B. „Livegang“).
3. **Commit changes…** → **Create a new branch** wählen → **Propose changes** → **Create pull request**.
4. Auf grünes **ci** warten → **Merge pull request** → **Delete branch**.
5. **Actions → content-seed** läuft von selbst: Alles ohne Fachprüfung wird **zurückgezogen** (nicht gelöscht).
   Ist das mehr als die Hälfte einer Art, wird der Lauf **rot** („zu viele Inhalte würden zurückgezogen“) – das ist
   hier erwartet: **content-seed → Run workflow** → Häkchen **allow_mass_archive** → **Run workflow**.
6. Kontrolle in Supabase (Handy-Browser) → Projekt → links **SQL Editor** → einfügen →  **Run**:
   `select count(*) from recipes where status = 'published' and not expert_reviewed;` → **0**. (Gleiches für `foods`,
   `guides`, `ingredient_substitutions` und `meal_prep_plans`.)

Zurück in die Testphase geht genauso (Wort wieder `false`). Löscht jemand die Datei, gilt automatisch „nur fachlich
geprüft“. Ein Tippfehler in der Datei macht `ci` rot – dann wird nichts eingespielt.

## Teil 7t2 – Rezepte in die App bringen (Testphase, 20.10.2026)

Rezepte erscheinen erst, wenn (a) ihre Lebensmittel **katalog-geprüft** und (b) die Rezepte **freigegeben** sind und
(c) eingespielt wurden. Alles läuft über die GitHub-App, jeder Schritt ist ein Pull Request, den **ihr** mergt – die
Workflows genehmigen nie selbst. Voraussetzung: Der Pull Request mit den Rezept-Entwürfen ist gemergt.

**(a) Lebensmittel „Katalog geprüft“**

1. GitHub-App → euer Repository → **Actions** → **content-review** → **Run workflow**.
2. Branch **main** lassen. **Art:** `katalog` · **IDs:** `rezepte` (= alle Lebensmittel aus Rezept-Entwürfen) ·
   **Neuer Status:** `published` · **Prüfer:** euer Name. Kategorie und Häkchen nicht nötig. → **Run workflow**.
3. Lauf öffnen → **Summary**: Link zum Pull Request „Katalog geprüft: … Lebensmittel“. Übersprungene stehen mit Grund
   darunter (z. B. roter Befund).
4. Pull Request öffnen und die **Checkliste** abarbeiten: je Zeile Quelle (Quell-ID „Bezeichnung“), Gruppen,
   tierisch/Fleischart, Schwangerschaft, Salz (⚠️ = verarbeitete Ware, Salz besonders prüfen), Kühlschrank-Tage.
   Stimmt etwas nicht: **nicht mergen**, sondern in einer Claude-Sitzung die Zuordnung korrigieren lassen.
5. Warten, bis **ci** und **sources-integrity** grün sind (beide startet der Workflow selbst) → **Merge pull request**.
   Geändert werden nur Status, Prüfvermerk und „Katalog geprüft“ – Nährwerte und Quelle prüft sources-integrity mit.

**(b) Rezepte freigeben**

1. **Actions → content-review → Run workflow** → **Art:** `recipe` · **Kategorie:** z. B. `schnell` · **Neuer
   Status:** `published` · **Prüfer:** euer Name.
2. Häkchen **„Import-Annahmen geprüft“** nur setzen, wenn ihr die Annahmen „durchgegart“ dieser Rezepte gegen die
   Zubereitung geprüft habt (Website → `/admin` → **Rezepte** → Rezept → „Import-Annahmen“). Ohne Häkchen werden solche
   Rezepte übersprungen (Grund steht im Pull Request). **„fachlich geprüft“** nur, wenn eine Fachkraft geprüft hat – für
   die Testphase nicht nötig. → **Run workflow**.
3. Pull Request „Sammelfreigabe Rezepte …“ öffnen → Tabellen „Freigegeben“, „Übersprungen“ und gelbe Hinweise lesen →
   auf grünes **ci** warten → **Merge pull request**.
4. Für die nächste Kategorie wiederholen (erst nach dem Merge starten): `schnell`, `pre-workout`, `post-workout`,
   `cardio`, `wettkampf`, `meal-prep`, `protein-dessert`, `spar-kueche`, `fitness-fast-food`, `heissluftfritteuse`,
   `sommer-eis`, `low-carb`. Rezepte in mehreren Kategorien sind danach
   „schon freigegeben“.
5. Rezepte **ohne Kategorie** (Liste: `/admin` → Rezepte → „Ohne Kategorie“; Stand 20.10.2026:
   `asia-ofenlachs-mit-sesam-brokkoli, kabeljau-in-senfsauce-mit-spinat, kaesespaetzle-light-mit-roestzwiebeln,
   lachs-toast-mit-kraeuter-skyr-und-ei, pellkartoffeln-mit-kraeuterquark, schweinemedaillons-mit-pilzrahm-und-brokkoli,
   thunfisch-ei-toast-mit-avocado, zucchini-puffer-mit-skyr-tzatziki`): **Art:** `ids` · **IDs:** diese Liste
   (kopieren) · Häkchen wie in Schritt 2 → **Run workflow** → Pull Request prüfen → **Merge**.

**(c) Einspielen**

1. Nach jedem Merge startet **content-seed** von selbst (Actions → content-seed). Startet keiner:
   **content-seed → Run workflow → Run workflow**.
2. Lauf öffnen → **Summary**: „Einspiel-Regel: TESTPHASE …“ und „🧪 Testphase: … ohne Fachprüfung“ mit den IDs. Das
   Häkchen „fachlich geprüft“ braucht ihr dafür nicht – `content/einspiel-regeln.json` steht auf
   `"nur_fachlich_geprueft": false` (Teil 7t). Vor dem Livegang dort umstellen.
3. Vorschau-Link → **mit Konto** anmelden → **Ernährung → Rezepte suchen**: Die Rezepte erscheinen mit dem Hinweis
   „Testphase – noch nicht fachlich geprüft“.

## Teil 7j – Datenbank für den Wettkampf prüfen (Phase 10, Etappe WP3)
In der App ändert sich dadurch **nichts Sichtbares** (Wettkampf anlegen kam mit WP4 – testen siehe Teil 7k). Ihr müsst nichts einstellen und
keine Schlüssel eintragen. Prüfen könnt ihr am Handy:

1. GitHub-App → Pull Request öffnen → unten **Checks**: **db-test** (Migrationen + Datenbank-Tests) und **ci** sind
   grün. Falls db-test rot ist: nicht mergen, Claude im Chat Bescheid geben.
2. **Nach dem Merge:** **Actions → db-migrate** → Lauf öffnen und warten, bis er grün ist (er testet zuerst, spielt
   danach ein; vorhandene Pläne und Einträge bleiben unverändert).
3. Supabase im Handy-Browser → euer Projekt → links **Table Editor** → Tabelle **`competitions`** ist da und leer.
   Leer ist richtig – Wettkämpfe legt erst die App ab WP4 an.
4. Im **Table Editor** → **`planned_sessions`** → nach rechts wischen: neue Spalten `workout_type`, `training_phase`,
   `target_distance_m`, `workout_steps`. Bei allen bisherigen Plänen stehen dort **NULL** – richtig so.
5. Optional: Supabase → links **Advisors** → **Security Advisor** → **Refresh**. **Erwartet** sind Hinweise, dass
   angemeldete Nutzer `save_competition`, `cancel_competition`, `complete_competition` und `delete_competition`
   („security definer“) ausführen dürfen – sie prüfen Login und alle Werte selbst. Andere neue Meldungen bitte Claude
   schicken.

## Teil 7k – Wettkampf, Plan-Ansicht, Countdown und Intervall-Timer testen (Phase 10, Etappe WP4, Testmodus)
Ihr müsst nichts einstellen. Alles geht im Handy-Browser über die Vercel-Vorschau; Vibration und „Bildschirm bleibt an“
prüft ihr zusätzlich in der echten App (Teil 9).

1. Vorschau-Link aus dem Pull Request öffnen → **Einstellungen → Testdaten löschen** (falls schon getestet) →
   „Testmodus starten“ → Onboarding mit **Gesundheits-Check (alles „Nein“)**, Erfahrung **Fortgeschritten**, Ziel
   **Ausdauer → Halbmarathon**, „Ohne Vorschlag planen“ → **Mo 60, Mi 60 und Sa 90 Minuten Ausdauer**. Im Schritt „Ziel“
   könnt ihr ein **Wettkampf-Datum** eintragen – dann lädt „Heute“ euch später zum Wettkampf ein.
2. „Heute“ → **Einstellungen → Mein Wettkampf → Wettkampf eintragen**. Renntag **in 6 Wochen** eintragen → die Ampel
   zeigt **„✕ Zu kurz“** mit Grund und Vorschlägen. Bei „Späterer Renntag“ auf **Übernehmen** tippen → **„✓ Passt“**.
3. Ziel **Zielzeit** wählen, sehr schnelle Zeit eingeben (z. B. 1:30:00) und eine **Referenzzeit** (10 km in 50:00, Datum
   vor wenigen Wochen) → **„! Knapp“**, „Ziel im Plan: Ankommen“. Zurück auf **Ankommen** → „✓ Passt“.
4. **Wettkampfplan erstellen** → „Plan neu erstellen“ bestätigen → „Dein Wettkampfplan ist fertig“.
5. **Zurück zu Heute**: oben Countdown („Noch … Tage bis zum Halbmarathon“) und das Phasen-Band („Basis · …“). Die
   Einheit zeigt **Art**, **Pace-Richtwert** mit dem Satz „Die Anstrengung hat Vorrang …“, **Distanz-Richtwert** und den
   **Ablauf** (Aufwärmen, Hauptteil, Abwärmen). In späteren Wochen (Wochenübersicht/Kalender) gibt es Steigerungen bzw. ab
   dem Aufbau Tempo und Intervalle („6 × 3 min zügig …“).
6. **Ausdauer starten** → **Timer starten**: Schritt, große Restzeit, „Danach: …“. **Pause** → Zeit steht, **Weiter** →
   läuft. **Abbrechen und eintragen** → Bestätigen → die gelaufenen Minuten stehen unten bei der Dauer → **Training
   speichern**. Im Browser vibriert nichts (Hinweis steht dabei); in der App vibriert das Handy beim Schrittwechsel, mit
   VoiceOver/TalkBack wird der neue Schritt angesagt.
7. **Kalender**: Countdown oben; mit **Nächste Woche ›** bis zum Renntag blättern → „◆ Renntag: Halbmarathon“.
8. **Mein Wettkampf → Ändern** (z. B. Name) → „Speichern“. **Wettkampf absagen** → bestätigen → die App fragt „Plan ohne
   Wettkampf neu erstellen?“ → einmal **Abbrechen** testen, einmal bestätigen (neuer Grundlagen-Plan).
9. Ergebnis eintragen geht ab dem Renntag (im Test nicht ohne Weiteres erreichbar – der automatische Test stellt dafür
   die Uhr vor): „Mein Wettkampf“ → **Ergebnis eintragen** → Zeit, Anstrengung, Notiz → danach „Erholung nach dem
   Rennen“ und „Nächstes Ziel planen“.
10. Ohne Einwilligung (neuer Testmodus, „Ohne Einwilligung fortfahren“): Ampel **„✕ Nicht möglich“** mit Vorschlag
    „Gesundheits-Check“; **Nur Countdown speichern** geht trotzdem. Danach zeigt auch die Übersicht „Mein Wettkampf“ die
    Ampel – ohne Knopf „Wettkampfplan erstellen“.
11. Ampel in der Übersicht (neuer Testmodus wie Schritt 1): Wettkampf mit Renntag **in gut 10 Wochen** eintragen →
    „✕ Zu kurz“ → **Nur Countdown speichern**. Die Übersicht zeigt unter dem Wettkampf „Dein aktueller Plan ist ein
    Grundlagen-Plan …“ und darunter die Ampel **„Machbarkeit“** mit Erklärzeile, Grund und Vorschlägen, aber **keinen**
    Knopf. Bei „Späterer Renntag“ **Übernehmen** → Formular mit neuem Datum → „✓ Passt“ → **Nur Countdown speichern**.
    Jetzt steht in der Übersicht der Knopf **Wettkampfplan erstellen** → „Plan neu erstellen“ bestätigen → „Dein
    Wettkampfplan ist fertig“, die Ampel verschwindet.
12. Flugmodus an → „Heute“, Plan und Timer funktionieren; „Mein Wettkampf → Ändern/Absagen“ ist gesperrt mit Hinweis.
13. Einmal hell und einmal dunkel ansehen; die Ampel hat immer Zeichen **und** Wort.

Mit Konto (Supabase-Modus, nach dem Merge und `db-migrate` aus WP3): gleiche Schritte; Supabase → **Table Editor →
`competitions`** zeigt euren Wettkampf (Plan-Bezug nur mit Einwilligung), **`planned_sessions`** die Spalten
`workout_type`, `training_phase`, `workout_steps`, `target_distance_m` beim Wettkampfplan.

## Teil 7w – Wettkampf-Ernährung testen (Phase 10, Etappe W1, Testmodus)
Ihr müsst nichts einstellen – diese Etappe hat **keine** Datenbank-Änderung. Getestet mit **Chrome am iPhone**
(Vorschau-Link aus dem Pull Request), am besten in einem **Inkognito-Tab**: Chrome → unten rechts **⋯** → **Neuer
Inkognito-Tab**. Hinweis: Einen Wettkampf in wenigen Tagen lässt die App nicht anlegen (Mindestvorlauf) – deshalb
springt ihr über „Mein Wettkampf“ direkt zum Renntag in der Zukunft.

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **15.05.1990** → **Testmodus starten** → Zustimmen →
   **weiblich** → Einwilligung Gesundheitsdaten **erteilen** → Größe **170**, Gewicht **70** → Umfänge
   **Überspringen** → Gesundheits-Check **alles „Nein“** → Erfahrung **Einsteiger** → Ziel **Ausdauer → Halbmarathon**
   → Trainingstage z. B. Mo/Mi/Sa Ausdauer → Ernährung beliebig → **„Zum Plan“**. Gibt es noch keine Rezepte:
   Ernährung → **„Beispiel-Rezepte mit Testwerten verwenden“**.
2. **Einstellungen → Mein Wettkampf → Wettkampf eintragen** → Distanz **Halbmarathon**, Renntag in **ca. 17 Wochen**
   → **„Nur Countdown speichern“**.
3. In „Mein Wettkampf“ auf **„Ernährung zum Renntag“** tippen. **Prüfen (Renntag):** Karte **„◆ Renntag:
   Halbmarathon“**, darunter **„Dein Renntag – Zeitleiste“**: Frühstück 2 bis 4 Std. vor dem Start (mit Gramm), „Nach
   30 min … etwa 15–30 g Kohlenhydrate (z. B. Gel, Banane oder Sportgetränk)“, Ziel, Mahlzeit danach, „Trinken:
   Richtwert 400–800 ml pro Stunde“, „Nichts Neues am Renntag“. Unten der Knopf **Ratgeber „Wettkampf-Ernährung“**.
4. **„← Vortag“** → **„◇ Vorabend“** („nichts Neues ausprobieren“). Noch einmal **„← Vortag“** → **„▲ Carb-Loading-Tag“**
   mit „Heute mehr Kohlenhydrate – so geplant“, „Dein Tagesziel bleibt gleich …“ und „ohne Defizit“.
5. **Wochenansicht:** Die Wochenansicht zeigt nur diese und die nächste Woche. Liegt euer Wettkampf dort, sind die Tage
   mit Zeichen und Wort markiert (▲ Carb-Loading-Tag, ◇ Vorabend, ◆ Renntag) – bei 17 Wochen Vorlauf prüft das der
   automatische Test (Playwright), ihr seht es kurz vor dem echten Wettkampf.
6. **Kalorienzahlen aus:** **Einstellungen → Kalorienzahlen anzeigen** aus → wieder zum Renntag (Schritt
   3): **nirgends kcal oder Gramm**, stattdessen „Mengen in Gramm sind ausgeblendet …“; die Milliliter bleiben.
7. **5 km statt Halbmarathon:** Mein Wettkampf → **Ändern** → Distanz **5 km** → speichern → „Ernährung zum Renntag“ →
   zwei Tage zurück: **kein** Carb-Loading-Tag (nur „Wettkampfwoche“); am Renntag „Bei weniger als einer Stunde …“.
8. **Absagen:** Mein Wettkampf → **Wettkampf absagen** → in der Ernährung gibt es keine Wettkampf-Karte mehr.

„Dein Tag“ (Tagesauswertung) zeigt an einem Carb-Loading-Tag den Satz „Heute mehr Kohlenhydrate – so geplant.“
(Kalender → Tag antippen → „Dein Tag“; nur mit „Kalorienzahlen anzeigen“).

## Teil 7w2 – Rad und Triathlon testen (Phase 10, Etappe WP5, Testmodus)
Im Testmodus müsst ihr nichts einstellen. Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am
besten in einem **Inkognito-Tab**: Chrome → unten rechts **⋯** → **Neuer Inkognito-Tab**. Für jeden Durchgang einen
neuen Inkognito-Tab öffnen (dann startet ihr ohne alte Testdaten).

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **15.05.1990** → **Testmodus starten** → Zustimmen →
   Geschlecht beliebig → Einwilligung Gesundheitsdaten **erteilen** → Größe/Gewicht beliebig → Umfänge **Überspringen**
   → Gesundheits-Check **alles „Nein“** → Erfahrung **Fortgeschritten** → Ziel **Ausdauer → Triathlon Langdistanz** →
   **„Ohne Vorschlag planen“** → **Di, Do, Sa je 60 Minuten** und **So 90 Minuten Ausdauer** → Ernährung beliebig →
   **„Zum Plan“**.
2. **Einstellungen → Mein Wettkampf → Wettkampf eintragen.** **Prüfen:** blauer Hinweis „Dein Ziel ist Triathlon
   Langdistanz. Dafür erstellen wir keinen Wettkampfplan … Trainer oder Verein“. In der Distanz-Auswahl gibt es
   **keine** Mittel-/Langdistanz und kein Schwimmen, vorbelegt ist **Triathlon olympisch**.
3. **Triathlon Sprint** antippen → statt Zielzeit/Referenzzeit steht „Bei Rad und Triathlon planen wir auf
   „Ankommen“ …“, der Tag heißt „Tag für die lange Ausfahrt“. Renntag **in ca. 12 Wochen** (z. B. Sonntag) → Ampel
   **„✓ Passt“** mit dem Hinweis „Freiwasser nur mit Sicherheit: nie allein schwimmen …“ und „Längste Ausfahrt im
   Plan“.
4. **Wettkampfplan erstellen** → „Plan neu erstellen“ → „Dein Wettkampfplan ist fertig“. **Heute** bzw. im **Kalender**
   wechseln sich Schwimmen, Laufen und Rad ab; der Sonntag ist die **Lange Ausfahrt**. Eine Schwimm-Einheit antippen
   (Kalender) bzw. am Schwimm-Tag auf „Heute“: **„Art: Schwimmtechnik“** und der Kasten **„Sicherheit beim Schwimmen“**
   (nie allein, Neoprenanzug, Begleitung).
5. **Koppeltraining** (Rad → Lauf, eine Einheit mit zwei Teilen) kommt erst im **Aufbau** (nach einigen Wochen), wenn ein
   Rad-Tag mindestens 25 Minuten hat – im Kalender weiterblättern. Die Einheit zeigt „Zwei Teile in einer Einheit: Teil 1
   Rad … Teil 2 Laufen …“, der Ablauf „Hauptteil (Rad)“ und „Hauptteil (Laufen)“; im Trainingsmodus sagt der Timer
   den Wechsel aufs Laufen an. (Den Sprung über Wochen prüft der automatische Test.)
6. **Nur 2 Ausdauer-Tage:** neuer Inkognito-Tab, Schritt 1 mit nur **Sa 60 und So 90 Minuten** → Mein Wettkampf →
   Triathlon Sprint → Ampel **„✕ Zu kurz“** mit „mindestens 3 Ausdauer-Tage pro Woche – je einen für Schwimmen, Rad und
   Laufen“; „Wettkampfplan erstellen“ gibt es nicht.
7. **Rad:** neuer Inkognito-Tab, Schritt 1 mit Ziel **Ausdauer → Radfahren** (Tage wie oben) → Mein Wettkampf →
   **Radrennen** ist vorbelegt, darunter das Feld **„Distanz in km (20–300)“**. Renntag **in ca. 17 Wochen**, Distanz
   **250** → Ampel **„✕ Zu kurz“** mit Vorschlag **„Kürzere Distanz: Radrennen 120 km“** → **Übernehmen** → **„✓ Passt“**.
   Distanz **400** → Fehlertext „Bitte ganze Kilometer zwischen 20 und 300 eingeben.“
8. Wettkampfplan erstellen → „Mein Wettkampf“ zeigt „Distanz: Radrennen 120 km“ und „Noch … Tage bis zum Radrennen 120
   km“; alle Einheiten sind Rad (Lockere Ausfahrt, Lange Ausfahrt, ab dem Aufbau „Sweet-Spot auf dem Rad“).
9. **Unter 18:** neuer Inkognito-Tab mit Geburtsdatum **01.12.2009**, Ziel Triathlon → Triathlon **olympisch**, Renntag
   **in ca. 30 Wochen** → Ampel
   **„✕ Nicht möglich“** mit „Unter 18 planen wir … beim Triathlon nur den Sprint …“ und Vorschlag „Kürzere Distanz:
   Triathlon Sprint“.

Mit Konto (Supabase-Modus): Die Datenbank bekommt zwei neue Migrationen (`…_wp5_enums.sql`,
`…_wp5_rad_triathlon.sql`). Sie laufen nach dem Merge automatisch über die GitHub Action **db-migrate** – ihr müsst
nichts tun. Prüfen in der GitHub-App: **Actions → db-migrate** → letzter Lauf grün. Danach in Supabase → **Table
Editor → `competitions`**: beim Rad steht die Distanz in `distance_m` (z. B. 120000).

## Teil 7s – Datenbank für Strecken prüfen (Phase 10, Etappe S1 Teil 1)
In der App ändert sich dadurch **nichts Sichtbares** (Strecken aufzeichnen kommt erst nach dem Spike S0 mit der
echten App). Ihr müsst nichts einstellen und keine Schlüssel eintragen. Prüfen könnt ihr am Handy:

1. GitHub-App → Pull Request öffnen → unten **Checks**: **db-test** (Migrationen + Datenbank-Tests) und **ci** sind
   grün. Falls db-test rot ist: nicht mergen, Claude im Chat Bescheid geben.
2. **Nach dem Merge:** **Actions → db-migrate** → Lauf öffnen und warten, bis er grün ist (vorhandene Einträge, Pläne
   und Wettkämpfe bleiben unverändert).
3. Supabase im Handy-Browser → euer Projekt → links **Table Editor** → Tabelle **`tracked_routes`** ist da und leer.
   Leer ist richtig – Strecken speichert erst die App.
4. Supabase → links **Authentication** → **Policies** → bis zur Tabelle `tracked_routes` wischen: genau **eine**
   Regel „Nutzer sehen eigene Strecken“ (nur Lesen der eigenen Zeilen). Mehr Regeln
   dürfen dort nicht stehen – Strecken sind streng privat.
5. Optional: Supabase → links **Advisors** → **Security Advisor** → **Refresh**. **Erwartet** sind Hinweise, dass
   angemeldete Nutzer `save_tracked_route`, `update_tracked_route`, `delete_tracked_route` und
   `delete_all_tracked_routes` („security definer“) ausführen dürfen – sie prüfen Login und alle Werte selbst. Andere
   neue Meldungen bitte Claude schicken.
6. Optional in der Vorschau (Testmodus): **Einstellungen → Meine Daten exportieren** → **Datei herunterladen** → in
   der Datei steht der neue, leere Bereich `tracked_routes`.

## Teil 7s2 – Datenbank für die Smartwatch prüfen (Phase 8, Etappe H2)
1. GitHub-App → Pull Request → **Checks**: **db-test** und **ci** grün.
2. **Nach dem Merge:** **Actions → db-migrate** → Lauf grün (vorhandene Daten bleiben unverändert).
3. Supabase im Handy-Browser → **Table Editor**: neue, leere Tabellen **`wearable_connections`**,
   **`wearable_sessions`**, **`heart_rate_summaries`**, **`daily_metrics`**. Leer ist richtig.
4. Supabase → **Authentication → Policies**: je Tabelle genau **eine** Regel „Nutzer sehen eigene …“ (nur Lesen).
5. Optional **Advisors → Security Advisor → Refresh**: erwartet sind Hinweise zu `connect_wearable`,
   `import_wearable_batch`, `resolve_wearable_duplicate` und `disconnect_wearable` („security definer“) – sie prüfen
   Login, Einwilligung und alle Werte selbst. Andere neue Meldungen bitte Claude schicken.

## Teil 7z – Datenbank für zwei Ziele und Wunschgewicht prüfen (Ziele, Etappe Z3)
In der App ändert sich dadurch **nichts Sichtbares** (Nebenziel und Wunschgewicht wählt ihr erst mit Etappe Z4). Ihr
müsst nichts einstellen und keine Schlüssel eintragen. Prüfen könnt ihr am Handy:

1. GitHub-App → Pull Request öffnen → unten **Checks**: **db-test** (Migrationen + Datenbank-Tests) und **ci** sind
   grün. Falls db-test rot ist: nicht mergen, Claude im Chat Bescheid geben.
2. **Nach dem Merge:** **Actions → db-migrate** → Lauf öffnen und warten, bis er grün ist (vorhandene Ziele bleiben
   unverändert).
3. Supabase im Handy-Browser → euer Projekt → links **Table Editor** → **`goals`** → nach rechts wischen: neue Spalte
   `secondary_goal_type`, überall **NULL** – richtig so.
4. Im **Table Editor**: Tabelle **`weight_goals`** ist da und leer.
5. Supabase → links **Authentication** → **Policies** → bis `weight_goals` wischen: genau **vier** Regeln (sehen,
   speichern und ändern nur mit Einwilligung, löschen).
6. Optional in der Vorschau (Testmodus): **Einstellungen → Meine Daten exportieren** → **Datei herunterladen** → in
   der Datei steht der neue, leere Bereich `weight_goals`.

## Teil 7z2 – Zwei Ziele und Wunschgewicht mit Ampel testen (Ziele, Etappe Z4, Testmodus)
Ihr müsst nichts einstellen. Nach dem Merge spielt **db-migrate** einen kleinen Datenbank-Trigger ein (räumt ein
unpassendes zweites Ziel alter App-Stände auf) – in der GitHub-App unter **Actions → db-migrate** warten, bis der Lauf
grün ist (vorher müssen im Pull Request **db-test** und **ci** grün sein). Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull
Request). Am besten in einem **Inkognito-Tab**: Chrome → unten rechts **⋯** → **Neuer Inkognito-Tab** (oder vorher in der
App Einstellungen → **„Testdaten löschen“**).

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **01.09.1991** → **Testmodus starten** → Zustimmen →
   **männlich** → Einwilligung Gesundheitsdaten **erteilen** → Größe **180**, Gewicht **90** → Umfänge
   **Überspringen** → Gesundheits-Check **alles „Nein“** → Erfahrung **Einsteiger**.
2. Schritt **„Dein Ziel“**: oben „Was ist dir am wichtigsten?“ → **Muskelaufbau**. Darunter erscheint
   **„Zweites Ziel (optional)“**. **Prüfen:** „Definition“ und „Fitness & Gesundheit“ sind **ausgegraut** und lassen sich
   nicht antippen, darunter steht der Grund (z. B. „Definition verbindet schon Fettverlust und Muskelerhalt.“).
3. Zweites Ziel **Ausdauer** antippen → Disziplin und Wettkampf-Datum erscheinen (optional). Dann zweites Ziel
   **Abnehmen** → Satz „… Entspricht „Definition“ – zusätzlich kannst du ein Wunschgewicht festlegen.“
4. Hauptziel auf **Abnehmen** ändern → das zweite Ziel springt auf „Kein zweites Ziel“ (doppelt geht nicht). So
   lassen → **Weiter**.
5. Neuer Schritt **„Wie möchtest du abnehmen?“** – vorausgewählt „In gesundem Tempo, ohne festes Ziel“. **„Mit konkretem
   Ziel“** antippen → Feld „kg abnehmen ab heute“ **10**, „Wochen“ **12**.
6. **Prüfen (Ampel):** Zeiger im **orangen** Bereich, Titel „Sehr ehrgeizig – wir planen etwas langsamer“, Text „Sicher
   planbar sind für dich etwa **22 Wochen**.“ und „Benötigt etwa 1 % deines Gewichts pro Woche.“ Keine kcal, kein
   Datum, keine Gewichtsprognose.
7. Knopf **„Zeitraum auf 22 Wochen setzen“** → Wochen stehen auf 22, Zeiger wandert nach **gelb**, Titel „Ehrgeizig,
   aber machbar“.
8. Oben auf **„Zielgewicht“** umschalten → **60** eingeben → **Weiter** → rote Meldung „Dieses Zielgewicht liegt unter
   dem Bereich, den wir planen …“ (Ziel-BMI unter 20), es geht nicht weiter. Auf **80** ändern → **Weiter** → „Deine
   Trainingstage“. Mit **Zurück** steht das Ziel wieder im Formular.
9. **Ohne Einwilligung:** neuer Inkognito-Tab, wie Schritt 1, aber „Ohne Einwilligung fortfahren“ → Ziel **Abnehmen** → Hinweis
   „Wunschgewicht nur mit Einwilligung“ mit Knopf „Einwilligung erteilen“; **Weiter** führt direkt zu „Deine
   Trainingstage“ (kein Wunschgewicht-Schritt).
10. **Dunkel:** iPhone → Einstellungen → Anzeige & Helligkeit → **Dunkel** → Schritte 5–7 wiederholen: Balken und
    Texte gut lesbar.
11. **Optional mit VoiceOver** (Einstellungen → Bedienungshilfen → VoiceOver): Auf der Ampel liest das iPhone einen
    ganzen Satz vor, z. B. „Planbarkeit: sehr ehrgeizig. Benötigt etwa 1 % deines Gewichts pro Woche. Sicher
    planbar sind etwa 22 Wochen.“

Falls etwas nicht so aussieht: Screenshot machen und Claude im Chat schicken.

## Teil 7z3 – „Dein Abnehm-Ziel“ in den Einstellungen testen (Ziele, Etappe Z5, Testmodus)
Ihr müsst nichts einstellen – diese Etappe hat **keine** Datenbank-Änderung. Getestet mit **Chrome am iPhone**
(Vorschau-Link aus dem Pull Request), am besten in einem **Inkognito-Tab**: Chrome → unten rechts **⋯** → **Neuer
Inkognito-Tab**.

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **15.05.1990** → **Testmodus starten** → Zustimmen →
   **weiblich** → Einwilligung Gesundheitsdaten **erteilen** → Größe **170**, Gewicht **70** → Umfänge
   **Überspringen** → Gesundheits-Check **alles „Nein“** → Erfahrung **Einsteiger** → Ziel **Abnehmen** → „Wie möchtest
   du abnehmen?“ **ohne festes Ziel** lassen → Trainingstage z. B. Mo/Mi/Fr Kraft im Studio → Ernährung beliebig →
   **„Zum Plan“**.
2. **Prüfen (Heute):** In der Plan-Karte steht **„Dein Plan: Abnehmen · 3 Tage“**. Kein Wunschgewicht, kein Balken.
3. Unten **Einstellungen** → Abschnitt **„Dein Abnehm-Ziel“** → Knopf **„Dein Abnehm-Ziel“** → „Ohne festes Ziel – wir
   planen in gesundem Tempo.“ → **„Konkretes Ziel festlegen“** → „Mit konkretem Ziel“ → **3** kg, **12** Wochen →
   **Speichern**. **Prüfen:** „Wunschgewicht: 67 kg“ und „Zeitraum: 12 Wochen, gespeichert am …“ (heutiges Datum).
4. **Bearbeiten:** **„Ziel bearbeiten“** → Wochen auf **20** → **Speichern** → „Zeitraum: 20 Wochen …“.
5. Mit **Zurück** zu **Heute**: **kein** Wunschgewicht, keine Zahl zum Ziel (nur unter Einstellungen sichtbar).
   **Ernährung → Woche:** Kasten „Dein Abnehm-Ziel“ erscheint höchstens einmal (nur wenn wir langsamer planen müssen).
6. **Erreicht:** Einstellungen → „Dein Abnehm-Ziel“ → **„Neues Gewicht eintragen“** → Größe 170, Gewicht **66** →
   **Speichern**. Auf **Heute** erscheint die Karte **„Wunschgewicht erreicht“** – ohne Zahlen, ohne Konfetti – mit
   „Gewicht halten“, „Muskelaufbau“, „Neues Wunschgewicht“. **„Gewicht halten“** antippen → „Dein Ziel ist geändert …“
   und darunter **„Plan neu erstellen?“**. Der Eintrag „Dein Abnehm-Ziel“ in den Einstellungen ist jetzt weg (Ziel
   „Fitness & Gesundheit“).
7. **Entfernen:** neuer Inkognito-Tab, Schritte 1 und 3 wiederholen → **„Ziel entfernen“** → Rückfrage →
   **„Ziel entfernen“** → „Dein Ziel ist entfernt …“ und wieder „Ohne festes Ziel“.
8. **Verlängern:** Ein abgelaufenes Ziel lässt sich am Handy nicht einfach herstellen (der Zeitraum ist mindestens
   4 Wochen). Diesen Fall prüft der automatische Test (Karte „Dein Zeitraum ist vorbei“ → **„Verlängern“** → neuer
   Zeitraum nötig; „Angaben ändern“ verlängert nie still). Wer mag: Ziel mit 4 Wochen anlegen und nach 4 Wochen
   nachsehen.
9. **Zweites Ziel → Plan neu erstellen?:** Einstellungen → **„Angaben ändern“** → Weiter → bei „Dein Ziel“ zweites Ziel
   **Muskelaufbau** → Weiter bis „Heute“ → Kasten **„Deine Angaben haben sich geändert – Plan neu erstellen?“** →
   **„Plan neu erstellen“** → Plan-Karte: **„Dein Plan: Abnehmen + Muskelaufbau · 3 Tage“**; ebenso oben in
   **„Woche“**.
10. **PDF:** Heute → „Als PDF speichern“ → in der Vorschau steht „Abnehmen + Muskelaufbau · 3 Tage“, **nie** ein
    Wunschgewicht, Zeitraum oder Tempo.
11. **Widerruf:** Ziel wie in Schritt 3 anlegen → Einstellungen → **„Gesundheitsdaten: Widerrufen“** → **„Tagebuch
    behalten (empfohlen)“** → „Dein Abnehm-Ziel“ öffnen → nur noch der Hinweis zur Einwilligung, das Wunschgewicht ist
    gelöscht.

Falls etwas nicht so aussieht: Screenshot machen und Claude im Chat schicken.

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
## Teil 7j – Gericht per Foto testen (Etappe E3, Testversion mit Attrappe)

„Per Foto“ ist eine **Premium-Funktion mit KI**. In dieser Testversion antwortet eine **Attrappe** mit festen
Beispielen – es geht kein Foto an Google, es entstehen keine Kosten, ihr braucht keinen Schlüssel. Im **Testmodus**
ist „Per Foto“ immer freigeschaltet. Nach dem Merge spielt **db-migrate** die neuen Tabellen ein; die Funktion ist für
Konten dort zunächst **aus** (SETUP Teil L).

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit dem Testkonto aus Teil 7c (Einwilligung
   Gesundheitsdaten erteilt) → **Ernährung** → **„Eintragen“** → Kasten **„Per Foto“**.
2. Beim ersten Mal kommt die **eigene Einwilligung** „Gerichte per Foto auswerten“ (Testversion ohne Übermittlung an
   einen KI-Anbieter, Foto wird nicht gespeichert, Schätzung; vor einer echten KI wird erneut gefragt). „Einwilligungstext lesen“ zeigt den ganzen Text → **„Zustimmen und fortfahren“**.
3. Oben steht **„Noch 30 Fotos in diesem Monat · heute noch 8“** und der Hinweis „Testversion: … Attrappe …“.
4. Optional eine **kurze Info** (z. B. „halbe Portion“) → **„Foto aufnehmen oder wählen“** → Teller fotografieren (oder
   ein Bild wählen). Alternativ **„Beispielfoto verwenden (Testmodus)“**.
5. Es erscheint der **Vorschlag** mit „Schätzung – bitte prüfen“: Hähnchenbrust, Reis, Paprika und „Bitte auswählen“
   (die Attrappe erkennt eine „helle Soße“, die es im Katalog nicht gibt).
6. Beim unbekannten Bestandteil ein Lebensmittel suchen und wählen (z. B. „Oliven“ → Olivenöl), eine **Menge ändern**,
   einen Bestandteil **entfernen**, unten bei Bedarf **„Bestandteil hinzufügen“**.
7. **„Eintragen“** → „3 Bestandteile eingetragen.“ → **„Zum Tagesverlauf“**: Die Einträge stehen unter der gewählten
   Mahlzeit, die Werte kommen aus dem Katalog.
8. **„Noch ein Foto“** → Beispielfoto → **„Abbrechen“** → „Abgebrochen – es wurde nichts gespeichert.“
9. **Testfälle der Attrappe** (in die Info schreiben): `test:leer` → „Wir erkennen auf dem Foto kein Essen“;
   `test:kaputt` oder `test:viele` → „keine brauchbare Antwort … zählt nicht gegen dein Kontingent“; `test:zeitlimit` →
   „hat zu lange gedauert“; `test:boese` → Bezeichnungen mit Code und Links werden bereinigt angezeigt.
10. **Flugmodus an** → „Per Foto“ zeigt „Fotos brauchen Internet – trag es per Hand ein oder später.“
11. **Einstellungen** → Karte „Gerichte per Foto auswerten“ → **„Widerrufen“** → danach fragt „Per Foto“ wieder nach der
    Einwilligung. Was schon eingetragen ist, bleibt im Tagebuch.

**Mit Konto (optional, SETUP Teil L2/L3):** Flag einschalten und euer Testkonto per Workflow **beta-grant**
freischalten → in der App mit Konto dieselben Schritte (es antwortet weiter die Attrappe). Ohne Freischaltung zeigt
„Per Foto“ nach dem Ende der Testphase: „Per Foto ist für dein Konto gerade nicht freigeschaltet …“ – in der Testphase
(Teil 7t) braucht es keine Freischaltung, nur das Flag. Zum Testen des Limits das Konto per
**beta-grant** mit **monatslimit** `2` freischalten → nach zwei Fotos kommt die Monats-Meldung. Das Limit (8 am Tag, 30 im Monat) zeigt bei
Erreichen „Für heute sind keine Fotos mehr möglich, ab morgen wieder“ bzw. „… ab 1. November wieder verfügbar“.

**Hinweis:** In der App auf dem Handy (APK/TestFlight) geht in dieser Testversion nur „Beispielfoto verwenden“ (im
Testmodus); die echte Kamera-Auswahl braucht ein neues Paket und einen neuen Build (offener Punkt E3).

## Teil 7k – Produkt per Barcode-Nummer testen (Etappe E4a, Testmodus mit Attrappe)

„Produkt (Barcode)“ ist **gratis und ohne KI**. Noch **ohne Kamera** – man tippt die Nummer unter dem Strichcode ein.
Im **Testmodus** antwortet eine **Attrappe** im Handy mit ausgedachten Testwerten (keine Daten von Open Food Facts,
kein Netz nötig). Ihr müsst **nichts einstellen**. Für Konten ist die Funktion nach dem Merge zunächst **aus** (SETUP
Teil M).

1. Vorschau-Link aus dem Pull Request öffnen → Testmodus mit dem Testkonto aus Teil 7c (Einwilligung Gesundheitsdaten
   erteilt) → **Ernährung** → **„Eintragen“** → Karte **„Produkt (Barcode)“**.
2. Unter dem Eingabefeld steht **„Testnummern (nur im Testmodus)“**. Auf **„Gefunden, Werte plausibel: …“** tippen →
   **„Produkt suchen“** → „Testprodukt Müsli (Testwerte)“ mit Nährwerten je 100 g, Hinweis „Testmodus: Antwort einer
   Attrappe …“ und unten die Quelle „Produktdaten: Open Food Facts …, Lizenz ODbL 1.0“.
3. **„1 Portion (50 g)“** → Mahlzeit wählen → **„Eintragen“** → „Eingetragen.“ → **„Fertig“** → im Tagesverlauf steht
   der Eintrag mit 190 kcal.
4. Wieder „Produkt (Barcode)“ → **„Werte prüfen“** → gelber Hinweis; „Eintragen“ geht erst nach dem Haken **„Ich habe
   die Werte mit der Packung verglichen“**.
5. **„Werte unbrauchbar“** → „Für dieses Produkt fehlen verlässliche Nährwerte“ → **„Eigenes Produkt anlegen“**: Name
   und Nummer sind schon ausgefüllt → Werte von einer echten Packung eintragen → **„Speichern“** → eintragen.
6. **„Nicht gefunden“** → „Dieses Produkt kennen wir noch nicht.“ → eigenes Produkt anlegen (z. B. „Hofjoghurt“, 70
   kcal, 4 / 5 / 3,5 g, Portion 150) → „Eintragen“. Dieselbe Nummer noch einmal → es erscheint direkt **„Dein eigenes
   Produkt mit dieser Nummer“** (ohne Abfrage).
7. Eine Nummer mit einer falschen letzten Ziffer (z. B. `4000000000010`) → „Die Nummer stimmt nicht“. Eine Nummer, die
   mit 2 beginnt (z. B. `2012345678903`, Frischetheke) → „Dieser Code gilt nur im Laden …“.
8. **„Zeitlimit“** bzw. **„Open Food Facts überlastet“** → ruhiger Hinweis „gerade nicht erreichbar“, eigenes Produkt
   als Ausweg.
9. **Flugmodus an** → „Produkt suchen“ → „Für die Produktabfrage brauchst du Internet …“; eigene Produkte gehen weiter.
10. **Ernährung → Eigene Gerichte → „Eigene Produkte“**: Liste (z. B. „1 von 200 Produkten“), Ändern, Löschen.
11. **Einstellungen → „Lizenzen und Quellen“**: Hinweise zu Open Food Facts (ODbL/DbCL) und zum
    Bundeslebensmittelschlüssel. Auf der Website steht dieselbe Seite unter `/lizenzen` (Link im Fuß).
12. **Einstellungen → Kalorienzahlen anzeigen** aus: Produkte zeigen keine Zahlen („Nährwerte ausgeblendet“),
    eintragen geht weiter; eigene Produkte anlegen geht dann nicht.
13. **Einstellungen → Gesundheitsdaten → „Widerrufen“**: Der Hinweis nennt jetzt auch „eigenen Produkten und
    Produkt-Favoriten“ – danach sind beide weg.

**Mit Konto (später, SETUP Teil M):** Vercel-Variable `OFF_CONTACT_EMAIL` eintragen und Flag per **beta-grant**
(`flag_an`, `food_product_lookup`) einschalten → eine Packung aus dem Schrank nehmen, die 13 Ziffern eintippen → Name,
Marke und Werte mit der Packung vergleichen → eintragen. Dieselbe Nummer noch einmal kommt sofort aus dem
Zwischenspeicher. Ohne die Variable bzw. mit Flag aus zeigt die App „Die Produktabfrage ist noch nicht eingeschaltet“.

## Teil 7l – Strichcode mit der Kamera scannen (Etappe E4b)

Neu auf „Produkt (Barcode)“: der Knopf **„Mit der Kamera scannen“**. Er erscheint nur, wenn euer Gerät es kann. Die
Kamerabilder bleiben auf dem Handy und werden nicht gespeichert oder gesendet – weiter geht nur die Nummer. Danach läuft
alles wie beim Eintippen (Teil 7k). Im Testmodus findet die Attrappe nur die Testnummern.

**Strichcodes zum Scannen ohne Packung:** Auf einem **zweiten Handy** (oder Tablet/Laptop) den Vorschau-Link öffnen →
Testmodus → „Produkt (Barcode)“ → unter den Testnummern **„Strichcodes der Testnummern anzeigen“**. Dort steht jede
Testnummer als Strichcode (schwarz auf weiß). Diesen Bildschirm mit dem ersten Handy scannen – z. B. „Gefunden, Werte
plausibel“ → das Testprodukt erscheint. Bildschirm hell stellen, nicht spiegeln lassen. Eine echte Packung geht auch;
im Testmodus kommt dann „Dieses Produkt kennen wir noch nicht“ – das zeigt, dass die Nummer erkannt wurde.

**iPhone, Chrome (Vorschau-Link):**

1. Vorschau-Link aus dem Pull Request in **Chrome** öffnen → Testmodus → **Ernährung** → **„Eintragen“** →
   **„Produkt (Barcode)“** → **„Mit der Kamera scannen“**.
2. Beim ersten Mal fragt das iPhone nach der Kamera → **„Erlauben“**. Der Leser lädt kurz (etwa 1 MB, nur beim
   ersten Mal) – „Kamera startet …“.
3. Strichcode in den Rahmen halten (gut beleuchtet, 10–20 cm Abstand) → die Kamera geht von selbst aus, die Nummer steht
   im Feld, das Produkt bzw. der passende Hinweis erscheint.
4. **„Abbrechen und Nummer eintippen“** schließt die Kamera.
5. Erlaubnis verweigern: Es kommt „Ohne Kamera-Erlaubnis kannst du die Nummer eintippen“ mit dem Weg zur Einstellung.
   Wieder erlauben: **iPhone-Einstellungen → Chrome → Kamera** einschalten, danach die Seite neu laden. Oft reicht
   auch: **Seite neu laden** (Pfeil im Chrome-Menü bzw. Adresse antippen → Eingabe) und beim nächsten „Mit der Kamera
   scannen“ **erneut „Erlauben“** tippen. (In Safari geht es gleich; dort: Einstellungen → Safari → Kamera.)
6. Während die Kamera läuft, zu einer anderen App wechseln → die Kamera geht aus; zurück in Chrome steht „Die Kamera
   wurde beendet …“ – einfach noch einmal scannen.

**Android, Chrome (Vorschau-Link):** gleiche Schritte; Android nutzt den eingebauten Leser von Chrome. Erlaubnis
ändern: links neben der Adresse auf das Symbol tippen → **Berechtigungen** → **Kamera**.

**Android-App (APK) bzw. iPhone-App (TestFlight):** Die Kamera braucht einen **neuen App-Build** – ältere Builds zeigen
den Knopf einfach nicht (kein Absturz), dort geht nur „Nummer eintippen“.

1. GitHub-App → Repository → **Actions** → **eas-build** → **Run workflow** → Plattform **android**, Profil
   **preview** → **Run workflow**. Für das iPhone: Plattform **ios**, Profil **production** (TestFlight, SETUP Teil
   D2).
2. Nach dem Build (etwa 15–30 Minuten) den Link aus dem Workflow bzw. von expo.dev öffnen → APK installieren bzw. in
   TestFlight aktualisieren.
3. App öffnen → „Produkt (Barcode)“ → **„Mit der Kamera scannen“** → Abfrage „Alpha5 nutzt die Kamera nur, um den
   Strichcode von Lebensmitteln zu lesen …“ → **Erlauben** → scannen.
4. Verweigert → Hinweis mit **„Einstellungen öffnen“** (dort Kamera für Alpha5 einschalten).

## Teil 7rk – Rundkurs-Vorschlag (25.10.2026)

**Im Testmodus (sofort, ohne Schlüssel):** Vorschau-Link öffnen → **Ausdauer** → **„Rundkurs vorschlagen“**.

1. Distanz (z. B. **10 km**) und Untergrund (**Wald- und Feldwege**) antippen.
2. **„Beispiel-Start Köln (Testmodus)“** tippen (oder „Meinen Standort verwenden“ und im Browser erlauben).
3. **„Runden vorschlagen“** → 2–3 Runden mit Distanz, Höhenmetern und Untergrund. Im Testmodus sind es **ausgedachte**
   Runden (keine echten Wege) – sie prüfen nur den Ablauf.
4. Eine Runde antippen → sie wird auf der Karte farbig. **„Als Meine Strecke merken“** → Name → **Merken**: Sie steht
   unten unter „Gemerkte Runden“ (nur auf diesem Gerät).
5. **„Andere Runden“** → neue Vorschläge. **„Diese Runde laufen“** → die Demo-Aufzeichnung startet, oben die Runde als
   Leitlinie und „Noch ca. … km bis zum Start“. Beim Speichern ist der Name vorbelegt und „Favorit“ angehakt – so wird
   die Runde zu einer „Meinen Strecke“.

**Echte Runden (Vercel-Projekt „Web“, einmalig, ca. 5 Minuten):**

1. Im Handy-Browser **openrouteservice.org** öffnen → oben **„Sign up“** → Konto anlegen (E-Mail bestätigen).
2. Nach dem Anmelden: **Dashboard** → bei **„Request a token“** Typ **Standard** wählen, Name „Alpha5“ → **Create
   token**. Den langen Schlüssel **kopieren** (nicht in den Chat schreiben!).
3. **vercel.com** öffnen → Projekt **„Web“** (fitnessapp-web) → **Settings** → **Environment Variables**.
4. **Key:** `ORS_API_KEY`, **Value:** Schlüssel einfügen, **Environments:** Production und Preview anhaken →
   **Save**. (Keinen Namen mit `NEXT_PUBLIC_` oder `EXPO_PUBLIC_` – der Schlüssel bleibt auf dem Server.)
5. **Deployments** → beim obersten Eintrag **⋯** → **Redeploy** → bestätigen.
6. In der App mit Konto (nicht Testmodus): Ausdauer → „Rundkurs vorschlagen“ → „Meinen Standort verwenden“ →
   „Runden vorschlagen“. Ohne Schlüssel steht dort „Rundkurs-Vorschläge sind gerade nicht verfügbar“.

**Nur zum Testen ohne Schlüssel:** Statt Schritt 1–4 die Variable `LOOP_ROUTING_PROVIDER` mit dem Wert `attrappe`
anlegen (nur Preview) → ausgedachte Runden auch mit Konto. Vor dem Livegang wieder löschen.

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

## Teil 7r – Ernährung: Tagesansicht mit Kalorien-Ring testen (20.10.2026, Testmodus)

Die Tagesansicht im Reiter **Ernährung** sieht jetzt so aus (eigenes Alpha5-Design, hell und dunkel):

- Oben **„Heute“** und darunter Datum mit Kalenderwoche (z. B. „Montag, 12.10. · KW 42“). Anderer Tag: Wochentag und „KW …“.
- Karte **„Übersicht“**: großer **Kalorien-Ring** – in der Mitte „… übrig“ (bzw. neutral „… zu viel“), links
  **„Gegessen“**, rechts **„Verbrannt“** (Training des Tages, steht klein „im Ziel enthalten“ – es wird **nicht**
  doppelt dazugezählt) oder – an Tagen ohne Training – **„Ziel“**. Darunter „Tagesziel: … kcal“ und drei
  **Makro-Balken** Kohlenhydrate / Eiweiß / Fett („47 / 222 g“ = gegessen / Ziel). **Seit 23.10.2026:** dunkle Karte
  mit grünem Schein und drei **Makro-Ringen** (Kohlenhydrate hellblau, Eiweiß violett, Fett rosa) – siehe 10.
- Abschnitt **„Ernährung“**: je eine Karte **Frühstück, Mittagessen, Abendessen, Snacks** mit kleinem Ring,
  „317 / 606 kcal“ (gegessen / Anteil am Tagesziel), Vorschau der Einträge und rundem **„+“** rechts. Die Gerichte aus
  dem Essensplan stehen in der passenden Karte (antippen = Rezept, „Gegessen“, „Rezept tauschen“ wie bisher). Bei nur
  einer Mahlzeit am Tag heißt die Karte „Hauptmahlzeit“.
- Darunter wie bisher **„Gegessen“** mit allen Einträgen (Ändern, Löschen, Stern) und „Eigene Gerichte“.

So prüft ihr es am Handy:

1. Vorschau-Link → Testkonto wie in Teil 7c (4 Mahlzeiten, Mo/Mi/Fr Kraft) → **Ernährung**.
2. **Prüfen:** Ring zeigt „… übrig“, links „Gegessen 0“, darunter „Noch nichts eingetragen.“; an einem Trainingstag
   rechts „Verbrannt … im Ziel enthalten“, sonst „Ziel“.
3. Bei **Frühstück** auf **„+“** tippen → der Eintrage-Dialog öffnet sich mit **Mahlzeit „Frühstück“** vorgewählt
   (Zuletzt, Favoriten, Suche, Schnell, „Per Foto“, „Barcode“ wie gewohnt). Z. B. Suche „Banane“ → eintragen → zurück.
   **Prüfen:** Frühstücks-Karte zeigt „… / … kcal“ und „Banane“, der große Ring „Gegessen“ ist gestiegen, „übrig“
   entsprechend gesunken; die Makro-Balken füllen sich.
4. Snacks **„+“** → Schnelleintrag z. B. „Auswärts gegessen, 3.000 kcal“ → **Prüfen:** In der Mitte steht neutral
   „… zu viel“, der Ring wird voll und rot, darunter „über dem Ziel“ (seit 23.10.2026, siehe 10).
5. Mit **„Nächster Tag“** auf einen künftigen Tag → Ring zeigt nur das **Tagesziel**, keine „+“-Knöpfe.
6. **Flugmodus an** (bzw. im Browser offline) → oben Hinweis „Du bist offline …“ – Eintragen geht weiter.
7. **Einstellungen → Kalorienzahlen anzeigen** aus → kein Ring, keine kcal, Karten nur mit Vorschau und „+“.
8. Mit Bildschirmleser (VoiceOver/TalkBack): Ring wird z. B. als „1.391 kcal übrig von 2.869 kcal Tagesziel“
   vorgelesen, die Balken als „Eiweiß: 47 von 222 Gramm gegessen“, „+“ als „Frühstück für heute eintragen“.
9. Alles einmal hell und einmal dunkel ansehen.
10. **Makro-Ringe (23.10.2026):** Jeder Ring füllt sich bis zum Tagesziel, in der Mitte steht der Anteil („38 %“).
    Liegt ein Wert über dem Ziel (z. B. viel Eiweiß eintragen), wird der Ring **voll und rot**, der Wert rot und darunter
    erscheint die dunkelrote Plakette **„über dem Ziel“**. Genau 100 % ist noch nicht drüber. Dasselbe beim großen
    kcal-Ring (statt der früheren zweiten Runde). Auf der **Übersicht** zeigt die Kachel „Ernährung heute“ kleine Ringe
    „KH / EW / Fett“.
11. **Mehr Farbe (23.10.2026):** Auf der Übersicht sind Training, Wettkampf, Workouts, Ernährung, Ausdauer und Schritte
    dunkle Kacheln mit Farbschein in ihrer Bereichsfarbe; Körperdaten und Fortschritt bleiben hell. Workouts und
    Einkaufen haben oben eine farbige Kopf-Karte (Einkaufen mit „… von … abgehakt“).

## Teil 7m – Startbildschirm, Anmelden, Übersicht und Menüleiste testen (18.10.2026)
Ihr müsst nichts einstellen – keine Datenbank-Änderung. Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull
Request), am besten in einem **Inkognito-Tab**: Chrome → unten rechts **⋯** → **Neuer Inkognito-Tab** → Vorschau-Link
einfügen. Plan dazu: `docs/PLAN-DASHBOARD.md`.

**A) Testmodus (Vorschau-Link ohne Datenbank)**

1. Startbildschirm (dunkel, Alpha5): großer Knopf **„Neu hier – Los geht's“**. Statt „Anmelden“ steht ein kurzer
   Hinweis, dass Anmelden erst mit der Datenbank geht. Unten ist **keine** Menüleiste.
2. „Neu hier – Los geht's“ → Geburtsdatum → **„Testmodus starten“** → Onboarding wie bisher → **„Zum Plan“**.
   Es öffnet sich **„Training“** (bis 26.10.2026 „Heute“), unten die Menüleiste **Heute · Training · Ernährung · Einkaufen · Mehr** (seit 26.10.2026, Teil 9v; davor
   20.10.2026; „Fortschritt“ steht als Kachel auf der Übersicht und unter „Mehr“); „Training“ ist markiert.
3. **„Übersicht“** antippen: Kacheln **Training heute** (an einem Trainingstag mit **„Training starten“**, sonst
   „Ruhetag“ und die nächste Einheit), **Ernährung heute**, **Körperdaten** (mit Einwilligung euer zuletzt
   eingetragenes Gewicht – **nie** ein Wunschgewicht oder ein Balken zum Ziel), **Fortschritt** („Diese Woche: x von
   y Einheiten erledigt“) und Schnellzugriffe (Rezepte, Übungen, Einkaufsliste, Kalender).
4. Jede Kachel führt in den bekannten Bereich. **„Training starten“** öffnet den Trainingsmodus **ohne** Menüleiste;
   der Zurück-Pfeil **‹** von Chrome am iPhone (unten links in der Chrome-Leiste) bzw. „Zurück zu Heute“ in der App
   führt wieder zurück.
   - Plan mit **strengeren Regeln** (Einstellungen → „Gesundheits-Check wiederholen“, eine Frage mit „Ja“): Die
     Übersicht zeigt rot **„Bitte Plan neu erstellen“** und **keinen** „Training starten“-Knopf. Geänderte
     Trainingstage (Einstellungen → „Angaben ändern“) zeigen den Hinweis „Deine Angaben haben sich geändert …“.
   - Aus **Kalender**, **Woche** oder **„Dein Tag“** einen anderen Tag in der Ernährung öffnen → unten **„Zu heute“**;
     der Reiter **„Ernährung“** springt beim Antippen ebenfalls auf heute.
5. Ein Training anfangen (einen Satz abhaken) und **Übersicht** öffnen → oben der Hinweis **„Im Training wartet etwas
   auf dich“** → „Zum Training“ zeigt die bekannte Frage „fortsetzen, speichern oder verwerfen?“.
6. **Einstellungen → Kalorienzahlen anzeigen** aus → die Kachel „Ernährung heute“ zeigt **nirgends kcal**.
7. **Ohne Einwilligung** (neuer Inkognito-Tab, „Ohne Einwilligung fortfahren“): Kachel „Körperdaten“ zeigt nur den
   Hinweis auf die Einwilligung, **kein** Gewicht.
8. **Mehr → Mein Konto**: „Testmodus – kein Konto“, **Einwilligungen**, **Lizenzen**, **Meine Daten** (Export) und
   **Konto löschen**. **Abmelden** fragt zuerst „Wirklich abmelden?“ – „Abbrechen“ lässt alles, wie es ist.
9. Hell/dunkel: iPhone **Einstellungen → Anzeige & Helligkeit → Dunkel** → Menüleiste und Kacheln bleiben gut lesbar.
10. Direkte Adressen funktionieren weiter: Vorschau-Link + `/today`, `/ernaehrung`, `/uebersicht` zeigen die
    Menüleiste; `/settings`, `/rezepte`, `/history` liegen darüber mit „Zurück“.

**B) Mit Datenbank (nur, wenn die Supabase-Variablen gesetzt sind – Teil 8)**

1. Neuer Inkognito-Tab → Startbildschirm → **„Anmelden“** → E-Mail eingeben → **„Code senden“**.
2. Hinweis „Schau auch im Spam- oder Werbung-Ordner nach“ ist sichtbar. **„Code erneut senden (in 60 s)“** zählt
   herunter und ist erst danach antippbar.
3. Einen **falschen** Code eingeben → „Der Code ist falsch oder abgelaufen …“. Mehrmals schnell neu anfordern →
   „Zu viele Versuche. Bitte warte ein paar Minuten …“.
4. Richtigen Code eingeben: **mit fertigem Profil → Übersicht**, **neue E-Mail-Adresse → Geburtsdatum** (Onboarding).
5. **Mehr → Mein Konto** zeigt eure E-Mail-Adresse. **Abmelden** → Rückfrage → zurück zum Startbildschirm; die Daten
   sind vom Gerät gelöscht (neu anmelden mit Code holt sie wieder).
6. **E-Mail-Adresse ändern** gibt es noch nicht (vorgemerkt, `docs/PLAN-DASHBOARD.md` Abschnitt 5).

## Teil 7o – Einkaufen testen (Etappe E1, Testmodus, 20.10.2026)

Ihr müsst nichts einstellen. Getestet mit **Chrome am Android-Handy** (Kamera geht dort direkt) oder **Chrome am
iPhone** (Vorschau-Link aus dem Pull Request, am besten im Inkognito-Tab). Plan: `docs/PLAN-EINKAUFEN-AUSDAUER.md`
Abschnitt 3.

1. Vorschau-Link → **„Neu hier – Los geht's“** → **„Testmodus starten“** → Onboarding mit Ernährung → **„Zum Plan“**.
2. Unten in der Menüleiste: **Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr**. **„Einkaufen“** antippen → eure
   Einkaufsliste der Woche (aus dem Essensplan), Überschrift **„Einkaufen“**, ohne „Zurück“-Knopf.
3. **Abhaken:** Einen Eintrag antippen → Haken. Seite neu laden (Chrome: **⋯ → Neu laden**) → der Haken ist noch da.
4. **Alle Haken zurücksetzen** → Rückfrage → **„Zurücksetzen“** → alle Einträge sind wieder offen.
5. **Eigener Artikel:** Unten bei „Eigener Eintrag“ z. B. **Kaffee** und bei **„Menge (optional)“** **500 g** →
   „Hinzufügen“ → „500 g Kaffee“ steht auf der Liste. „viel“ als Menge → verständlicher Hinweis mit Beispielen.
   Mit **✕** löscht ihr eigene Artikel wieder.
6. **Im Laden scannen** (Kasten oben):
   - **„Strichcode scannen“** → Kamera erlauben → Strichcode einer Packung in den Rahmen halten. Im Testmodus kennt
     die App nur Testnummern – nehmt **„Nummer eintippen“** und tippt eine der **Testnummern** an (oder zeigt die
     Testnummer am zweiten Handy unter Ernährung → Eintragen → „Produkt (Barcode)“ → „Strichcodes der Testnummern
     anzeigen“).
   - **„Gefunden, Werte plausibel“** (Testprodukt Müsli) → **„Nicht auf deiner Liste – zusätzlich hinzufügen?“**:
     Name ist vorbefüllt, Abteilung wählbar → **„Ja, hinzufügen“** → steht abgehakt auf der Liste.
   - Eigenen Artikel **„Müsli“** anlegen und dieselbe Testnummer erneut → **„✓ Müsli abgehakt“** mit
     **„Rückgängig“** (macht den Eintrag wieder offen).
   - Zusätzlich **„Bio-Müsli“** anlegen und erneut scannen → **„Welcher Eintrag ist es?“** → den richtigen antippen.
     Bei Einträgen aus dem Essensplan merkt sich die App eure Wahl (nur mit Einwilligung Gesundheitsdaten, nur in
     eurem Konto) – beim nächsten Scan desselben Produkts klappt es dann ohne Auswahl, auch ohne Netz.
   - **„Nicht gefunden“** → **„Produkt nicht erkannt“** → Eintrag aus der Liste antippen oder **„Als eigenen Artikel
     hinzufügen“**.
   - **Nährwerte (neu, 22.10.2026):** Nach jedem erkannten Scan steht unten im Kasten **„Nährwerte je 100 g“** (bei
     Getränken „je 100 ml“): Energie, Eiweiß, Kohlenhydrate, davon Zucker, Fett, Salz – fehlende Werte als „–“.
     **Prüfen:** „Gefunden, Werte plausibel“ → 380 kcal, 10 g Eiweiß … mit Quellenangabe Open Food Facts und
     „Mehr zur Lizenz“ (im Testmodus zusätzlich der Hinweis auf die Attrappe). **„Werte prüfen“** → Zahlen mit
     Hinweis „Bitte prüfen“. **„Werte unbrauchbar“** → keine Zahlen, nur „Für dieses Produkt fehlen verlässliche
     Nährwerte“. Eigene Produkte zeigen „Deine Angaben“, gelernte Zuordnungen die Werte des Lebensmittels (Quelle BLS
     bzw. Testwerte). Beim nächsten Scan verschwindet die Karte; gespeichert wird nichts. Mit **„Kalorienzahlen aus“**
     (Einstellungen → Ernährung ändern) erscheinen keine Zahlen, nur „Nährwerte ausgeblendet“.
7. **Ohne Essensplan:** Wer die Ernährung noch nicht eingerichtet hat, sieht im Einkaufen den Hinweis „keinen
   Essensplan“ – eigene Artikel, Abhaken und Scannen gehen trotzdem.
8. **„Fortschritt“** findet ihr jetzt unter **Mehr → Fortschritt** und über die Kachel auf der Übersicht.

**Mit Datenbank (nach dem Merge, Teil 8):** Die Migration `20261020120000_shopping_product_links.sql` spielt
`db-migrate` beim Merge automatisch ein. Häkchen von Listen mit Gesundheitsbezug gehen jetzt auch **ohne Netz**
(verschlüsselte Warteschlange auf dem Gerät) und werden bei Verbindung gesendet. Gelernte Zuordnungen stehen im
Datenexport (Mehr → Mein Konto → Meine Daten) unter `shopping_product_links` und werden beim Widerruf der
Einwilligung in Gesundheitsdaten gelöscht.

## Teil 7p – Übersicht und Menüleiste anpassen (Etappe E2, Testmodus, 20.10.2026)

Ihr müsst nichts einstellen. Vorschau-Link aus dem Pull Request im Handy-Browser öffnen, Testmodus starten,
Onboarding bis **„Zum Plan“**, dann unten **„Übersicht“**.

1. Ganz unten auf der Übersicht **„Bearbeiten“** antippen.
2. Bei **„Körperdaten anzeigen“** den Haken entfernen → die Kachel verschwindet sofort.
3. Bei **„Ernährung heute“** so oft **„Nach oben“** antippen, bis die Kachel ganz oben steht. (Mit eingeschaltetem
   TalkBack/VoiceOver sagt das Handy z. B. „Ernährung heute ist jetzt an Stelle 1 von 8.“)
4. **„Fertig“** → Seite neu laden (Chrome: **⋯ → Neu laden**) → die Reihenfolge bleibt.
5. Alle Haken entfernen → Hinweis „Alle Kacheln sind ausgeblendet“; Hinweise oben (z. B. „Im Training wartet etwas“)
   bleiben trotzdem sichtbar. **„Bearbeiten“ → „Auf Standard zurücksetzen“** holt alles zurück.
6. **Mehr → „Menüleiste anpassen“** (oder in „Bearbeiten“): Es sind schon 6 Knöpfe – **„Fortschritt in der
   Menüleiste“** geht erst, wenn ihr z. B. **„Workouts“** herausnehmt (die App sagt „Höchstens 6 Knöpfe …“). Mit **„Nach links“/„Nach rechts“** ändert ihr die Reihenfolge. „Übersicht“ (links) und
   „Mehr“ (rechts) bleiben immer. Bei 6 Knöpfen ist kein weiterer möglich, unter 3 auch nicht – die App sagt warum.
7. Einen Bereich herausnehmen (z. B. „Ernährung“) → er steht unter **Mehr → „Weitere Bereiche“** und funktioniert
   wie vorher.
8. **„Auf Standard zurücksetzen“** → Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr. Auch die Kachel
   **„Workouts“** auf der Übersicht lässt sich unter „Bearbeiten“ aus- und umstellen.

**Mit Datenbank:** Die Migration `20261020130000_app_layout_settings.sql` spielt `db-migrate` beim Merge ein. Die
Anordnung gilt dann für euer Konto auf allen Geräten, steht im Datenexport (`app_layout_settings`) und bleibt beim
Widerruf der Gesundheits-Einwilligung (kein Gesundheitsdatum).

## Teil 7q – Wettkampfplan finden (20.10.2026, Testmodus)

Ihr müsst nichts einstellen. Vorschau-Link aus dem Pull Request im Handy-Browser öffnen, Testmodus starten,
Onboarding mit Ziel **„Ausdauer“** (z. B. Halbmarathon) bis **„Zum Plan“**, dann unten **„Übersicht“**.

1. Direkt unter „Training heute“ steht die Kachel **„Mein Wettkampf“** → **„Wettkampf planen“** antippen.
2. Renntag eintragen (z. B. in 4 Monaten), Ampel zeigt **„✓ Passt“** → **„Wettkampfplan erstellen“** → **„Plan neu
   erstellen“**.
3. Unter der Zusammenfassung steht **„So ist dein Plan aufgebaut“**: alle Phasen mit Wochen und Datum, **„▶ Du bist
   hier“** bei der aktuellen Phase, die aktuelle Woche mit **„jetzt“**, Erholungswochen mit **„Erholung“**.
4. Eine Woche antippen → der Kalender öffnet genau diese Woche. **„Zurück“** führt zum Wettkampf.
5. **Übersicht:** Die Kachel zeigt jetzt Name, Countdown, Phase und „Woche X von Y“ und **„Wettkampfplan ansehen“**.
6. **Training:** ganz oben der Knopf **„Wettkampfplan“** (die Countdown-Karte bleibt darunter).
7. **Mehr:** **„Wettkampf“** steht ganz oben unter „Weitere Bereiche“.
8. Wer „Wettkampf“ als Knopf unten möchte: **Mehr → „Menüleiste anpassen“** → erst z. B. „Workouts“ herausnehmen, dann
   **„Wettkampf in der Menüleiste“** antippen.

**Mit Datenbank:** Die Migration `20261020220000_app_layout_competition.sql` spielt `db-migrate` beim Merge ein (nur
die erlaubten Kacheln/Bereiche für „Übersicht und Menüleiste anpassen“ kommen dazu, keine neuen Daten).

## Teil 7n – Live-Anpassung des Plans testen (Phase 4b, Etappe D, Testmodus, 18.10.2026)
Die Live-Anpassung ist in der **Testphase kostenlos** (Teil 7t). Im Testmodus ist **„Live-Anpassung einschalten
(Testmodus)“** von Anfang an **an** – die App rechnet die Regeln nach jedem gespeicherten Training auf dem Handy,
**ohne KI**. Mit Konto (Supabase) gibt es den Schalter nicht; dort kommt die Live-Anpassung erst mit Etappe C.

Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am besten in einem **Inkognito-Tab**: Chrome →
unten rechts **⋯** → **Neuer Inkognito-Tab**. Wichtig: Im Browser bleiben die Anpassungen nur, **solange der Tab offen
ist** (geschützter Speicher) – Tab schließen = Anpassungen weg, der Plan ist dann wieder wie vorher.

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **15.05.1990** → **Testmodus starten** → Zustimmen →
   Einwilligung Gesundheitsdaten **erteilen** → Gesundheits-Check **alles „Nein“** → Erfahrung beliebig → Ziel
   **Muskelaufbau** → **Mo, Mi, Fr Kraft im Studio** → Ernährung beliebig → **„Zum Plan“**.
2. **Einstellungen** → Abschnitt **„Live-Anpassung“** mit Kennzeichen **„Testphase: kostenlos“** → Haken
   **„Live-Anpassung einschalten (Testmodus)“** ist schon gesetzt. **Prüfen:** Der Abschnitt steht nur im Testmodus. Darunter **„Warum hat sich mein Plan geändert?“** → „Noch keine
   Anpassungen – dein Plan läuft wie geplant.“
3. **Gewicht senken:** Die Regeln greifen erst ab der **zweiten Planwoche** (die Einstiegswoche zählt nicht). Trainiert
   (bzw. über **Kalender → + Einheit** nachgetragen) eine Übung **zweimal hintereinander** mit deutlich weniger
   Wiederholungen als das untere Ziel (z. B. Ziel 12, eingetragen 8/8/7) → **Training speichern**. **Prüfen:** Bei der
   nächsten Einheit mit dieser Übung steht **„↻ angepasst“** mit „Übung: 20 kg → 18 kg“, die Vorgabe ist leichter →
   **„Warum?“** → Erklärsatz „… war zweimal deutlich zu schwer – nächstes Mal 18 kg statt 20 kg.“ → **„Rückgängig“** →
   „Anpassung zurückgenommen“, die Vorgabe ist wieder wie vorher.
4. **Sehr anstrengende Woche:** drei Kraft-Einheiten einer Woche mit **Belastung 9** beenden → in der Woche danach
   steht „↻ angepasst – Ein Satz weniger“, jede Übung hat einen Satz weniger. Passiert das **zwei Wochen in Folge**, wird
   die **Erholungswoche vorgezogen** („Erholungswoche: ab … statt ab …“); die frühere Erholungswoche ist dann eine
   normale Woche mit denselben Sätzen wie die Woche davor.
5. **Weniger Trainingstage:** Schafft ihr über drei Wochen deutlich weniger als 70 % der Einheiten, erscheint auf
   **Heute** oben die Karte **„Weniger Trainingstage?“** → **Ansehen** → wegfallenden Tag wählen → **Umstellen** →
   „Umgestellt: Dein neuer Plan hat 2 Trainingstage.“ Euer Verlauf bleibt vollständig. **„Nein danke“** lässt alles,
   wie es ist.
6. Haken **„Live-Anpassung einschalten“** entfernen (= so läuft die App ohne Live-Anpassung) → bisherige Anpassungen
   bleiben sichtbar (mit Hinweis), neue kommen nicht dazu.
7. **Einstellungen → Einwilligungen → Gesundheitsdaten widerrufen** → die Anpassungen sind gelöscht.

Die Fälle über mehrere Wochen (Schritte 4 und 5, Stillstand → Übung getauscht, abgelaufener Vorschlag) prüft der
automatische Test `e2e/live-adjust.spec.ts` mit festem Datum – im Pull Request unter **Checks → ci** grün.

## Teil 7v – Lieblingsgerichte und Kraft-Entwicklung testen (25.10.2026, Testmodus)
Beides gratis, ohne KI, alles bleibt privat auf dem Handy bzw. Konto.

**Lieblingsgerichte und „Nie wieder“**
1. Vorschau-Link im Handy-Browser öffnen → **Testmodus starten** → Onboarding mit Ernährung → **Ernährung**.
2. An einer Mahlzeit oben rechts auf **⋯** tippen → **Lieblingsgericht** → unter dem Titel steht „Lieblingsgericht“.
3. **Rezepte suchen** → jedes Rezept hat rechts ein Herz; **Nur Lieblingsgerichte** zeigt nur eure Herzen.
4. Ein Rezept öffnen → Karte **Dein Geschmack** → **Nie wieder** → zurück: das Rezept fehlt in der Suche, unten steht
   „1 Gericht ist ausgeblendet.“ → **Ausgeblendete Gerichte** → **Wieder zulassen**.
5. Den Weg gibt es auch unter **Mehr → Einstellungen → Ernährung → Ausgeblendete Gerichte**.
6. Ab der nächsten Woche plant die App das ausgeblendete Gericht nicht mehr ein; die laufende Woche bleibt (mit
   **Tauschen** ersetzt ihr es sofort).

**Kraft-Entwicklung**
1. Zwei bis drei Krafttrainings im Trainingsmodus eintragen (für den Test auch an verschiedenen Tagen).
2. **Fortschritt** → Kachel **Kraft-Entwicklung** mit Mini-Kurve je Übung → antippen.
3. Oben die Kurve: **Gewicht / Volumen / Wiederholungen** und **4 W / 3 M / Alles** umschalten.
4. **Verlauf** → ein Training öffnen → unter jeder Übung z. B. „Kniebeuge: +5 kg gegenüber vor 4 Wochen“.
Es gibt bewusst keine Bestleistungen, Rekorde oder Abzeichen und keine geschätzte Maximalkraft.

## Teil 7o – Workouts mit Sternen und Timer testen (20.10.2026, Testmodus)
Fertige Workouts (1 Stern leicht – 5 Sterne sehr schwer) mit Timer; nach dem Abschluss stehen sie als Eintrag am
heutigen Tag. Alle 27 Workouts sind **Testphase – noch nicht fachlich geprüft** (so steht es auch in der App).
Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am besten im **Inkognito-Tab**.

1. Vorschau-Link öffnen → **„Los geht's“** → Geburtsdatum **15.05.1990** → **Testmodus starten** → Zustimmen →
   beliebig weiter bis **„Zum Plan“**.
2. Unten in der Menüleiste **„Workouts“** antippen (auch über **Mehr → Workouts**). **Prüfen:** „27 Workouts“, jede
   Karte zeigt Titel, Sterne mit Wort (z. B. „★★☆☆☆ eher leicht“), Minuten, Ziel und Geräte.
3. **Filter:** Stern **★★★★★** antippen → nur 2 Workouts. Wieder lösen, **★** und Ziel **„Bauch & Rumpf“** → nur
   „Rumpf-Basis“. **„Filter zurücksetzen“** → **„Nur ohne Geräte“** → nur Workouts ohne Geräte.
4. **„Bauch-Blitz“** öffnen → Sterne, Ablauf, Übungen mit Sekunden und Pausen, Aufwärmen, Sicherheitshinweis.
   Bei einem Workout mit 4–5 Sternen steht für Einsteiger zusätzlich „lieber mit 1–3 Sternen beginnen“ (nur Hinweis).
5. **„Workout starten“** → 5 Sekunden „Gleich geht's los“, dann großer Countdown je Übung, darunter **„Als
   Nächstes“**. **Prüfen:** **Pausieren** hält die Zeit an, **Fortsetzen** läuft weiter, **Überspringen** springt
   zur nächsten Übung, in der Pause **„Pause beenden“**. Ton und Vibration lassen sich unten abschalten (im Browser nur
   Ton). Der Bildschirm bleibt an.
6. Ein Workout mit **Sätzen** (z. B. „Kurzhantel-Basis“): Hier läuft keine Zeit ab – nach jedem Satz **„Satz erledigt
   ✓“**, dann startet die Satzpause von selbst.
7. Ende abwarten oder **„Beenden“** → Nachfrage → **„Beenden“**. Anstrengung (0–10) und Notiz sind freiwillig →
   **„Für heute speichern“** → „Gespeichert …“. **Prüfen:** Der Knopf ist danach weg (kein zweiter Eintrag), **„Zum
   heutigen Tag“** zeigt die Einheit, im **Kalender** steht „✓ Freie Kraft-Einheit · Workout“, im Eintrag die Notiz
   „Workout „Bauch-Blitz“ (★★☆☆☆) · …“. Zurück in der Liste: **„Heute erledigt ✓“** auf der Karte.
8. Offline (Flugmodus) speichern geht auch – der Eintrag wird übertragen, sobald ihr wieder online seid (mit Konto).

**Mit Konto (Supabase):** Nach dem Merge legt **db-migrate** die Tabelle an; danach **Actions → content-seed → Run
workflow** – solange in `content/einspiel-regeln.json` die Testphase eingestellt ist, kommen die Workouts mit. Vor dem
Livegang gilt dieselbe Regel wie bei den Rezepten (Teil 7t): nur fachlich geprüfte Workouts.

## Teil 7u – Supplemente testen und freigeben (Phase 6, Etappen SU3/SU4, 21.10.2026)

Die App zeigt Nahrungsergänzungen mit guter Studienlage und ordnet sie nach festen Regeln ein: **„Passt zu dir“**,
**„Zur Info“**, **„Ab 18 Jahren“**, **„Nicht für dich – bitte ärztlich abklären“**, dazu **Koffein** nur als
Sicherheits-Info und die Liste **„Nicht empfohlen“**. **Keine Shops, keine Links, keine Werbung** (das kommt frühestens
mit SU5 und bleibt bis zur Rechtsprüfung aus). Alle 18 Texte sind KI-Entwürfe – in der App steht **„Testphase – noch
nicht fachlich geprüft“**. Getestet mit **Chrome am iPhone** (Vorschau-Link aus dem Pull Request), am besten im
**Inkognito-Tab** (Chrome → unten rechts **⋯** → **Neuer Inkognito-Tab**; für jeden Durchgang einen neuen).

**(a) Im Testmodus ansehen** (Vorschau-Link, ohne Konto)

1. **„Los geht's“** → Geburtsdatum z. B. **15.05.1990** → **Testmodus starten** → Zustimmen → Geschlecht wählen →
   **Einwilligung Gesundheitsdaten zustimmen** (neuer Text mit „Supplement-Check“ und „Meine Supplements“) →
   Gesundheits-Check alles **„Nein“** → Ziel **Muskelaufbau** → weiter bis **„Zum Plan“**.
2. **Mehr → Essen → „Supplemente“** (oder **Ernährung** → ganz unten **„Supplemente“**). **Prüfen:** oben der Hinweis
   „Bitte lesen“ mit den Pflichtsätzen, gelber Hinweis „Testmodus: Die Texte sind Entwürfe …“, alles nur „Zur Info“.
3. **„Check machen“** → Fragen beantworten (bei „männlich“ ohne Stillzeit-Frage), freiwillig „Eher nicht“ beim
   Eiweiß → **„Antworten speichern“**. **Prüfen:** Kreatin steht unter **„Passt zu dir“** mit „Menge: 3 g am Tag“ und
   „Täglich zu einer Mahlzeit“, Proteinpulver nur bei „Eher nicht“, Vitamin D unter **„Zur Info“** mit Richtwert,
   Koffein in eigener Gruppe – nie „Passt zu dir“.
4. **Kreatin** antippen → Angabe „Kreatin erhöht die körperliche Leistung …“ **direkt mit** dem Pflichthinweis
   „… täglichen Aufnahme von 3 g Kreatin …“, Hinweis zu 1–2 kg Wasser, „Bitte beachten“ mit den Pflichtsätzen,
   „Quellen anzeigen“ klappt die Quellen auf. **„Nehme ich“** → zurück → Karte **„Meine Supplements“**.
5. **Koffein** antippen: Bei Training **„Abends“** steht „Du trainierst abends: Nimm vor dem Training kein Koffein.“,
   bei „Nachmittags“ bzw. „Unterschiedlich“ der Satz mit „vor 16 Uhr“.
6. **Sperre:** Einstellungen → **Gesundheits-Check wiederholen** → Medikamente bzw. (weiblich) Schwangerschaft „Ja“ →
   zurück zu Supplemente → Kreatin unter **„Nicht für dich“**, ohne Menge, ohne „Nehme ich“.
7. **Unter 18:** neuer Inkognito-Tab, Geburtsdatum vor weniger als 18 Jahren → Kreatin unter **„Ab 18 Jahren“**,
   ohne Menge.
8. **Neue Einwilligung (Re-Consent):** In Supplemente unten **„Test: Einwilligung nur alte Fassung“** → Karte „Wir haben
   die Einwilligung zu Gesundheitsdaten ergänzt“ erscheint, alles nur „Zur Info“ → **„Neuen Text lesen und
   zustimmen“** → zustimmen → zurück: Der Check ist noch da (**„Supplement-Check ändern“**), Kreatin passt wieder.
9. Löschen: **„Supplement-Check ändern“** → ganz unten **„Supplement-Check und „Meine Supplements“ löschen“**. Der
   Widerruf der Einwilligung Gesundheitsdaten löscht beides ebenfalls; **Mein Konto → Daten exportieren** enthält beides.

**(b) Texte freigeben (nach dem Merge dieses Pull Requests)**

1. GitHub-App → Repository → **Actions** → **content-review** → **Run workflow**, Branch **main**.
2. **Art:** `ids` · **IDs:** `supplemente` (= alle Supplemente im Entwurf) – oder einzeln, z. B.
   `creatine, protein_powder, vitamin_d, omega3, caffeine, bcaa, glutamine, l_carnitine, cla, fat_burner,
   testo_booster, pre_workout, hmb, ashwagandha, collagen, multivitamin, iron, melatonin` · **Neuer Status:**
   `published` · **Prüfer:** euer Name · **fachlich geprüft:** nur ankreuzen, wenn eine Fachkraft (Ernährung/
   Sportmedizin) geprüft hat – für die Testphase nicht nötig. Kategorie und „Import-Annahmen“ haben hier keine Wirkung.
   → **Run workflow**.
3. Lauf öffnen → **Summary** → Pull Request „Freigabe Supplemente: …“ → Tabelle „Freigegeben“ (Stufe, Angaben,
   Anzahl Quellen) lesen → auf grünes **ci** warten → **Merge pull request**. Supplemente nicht mit Übungen oder Rezepten
   in einem Lauf mischen.

**(c) Einspielen und mit Konto ansehen**

1. Nach dem Merge laufen **db-migrate** (legt die Tabellen an) und **content-seed** von selbst. Startet keiner:
   **Actions → content-seed → Run workflow**. Die Summary nennt „Supplemente eingespielt: 18“ und „🧪 Testphase: 18
   Supplemente ohne Fachprüfung“ (Regel aus `content/einspiel-regeln.json`, Teil 7t).
2. **Mit Konto** zeigt die App die Texte sofort – aber zunächst **nur „Zur Info“** mit dem Hinweis „Die persönliche
   Einordnung kommt, sobald die ergänzte Einwilligung Gesundheitsdaten freigegeben ist“. Grund: Die neue Fassung 2 der
   Einwilligung liegt in der Datenbank als **Entwurf** und wird erst nach der **juristischen Prüfung** veröffentlicht
   (Plan 6, Abschnitte 11.1 und 18). Niemand verliert dadurch eine Einwilligung oder Daten.
3. **Fassung 2 veröffentlichen** (erst nach der Rechtsprüfung): In einer Claude-Sitzung schreiben „Einwilligung
   health_data Fassung 2 veröffentlichen“ – das wird eine kleine Migration
   (`update consent_documents set published_at = now() where consent_type = 'health_data' and version = 2`) als Pull
   Request. Nach dem Merge sehen alle mit Konto einmal die Karte „Einwilligung ergänzt“; bis zur Zustimmung können sie
   keine Gesundheitsdaten ergänzen (bestehende bleiben sichtbar).

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

## Teil 7t – Testphase: alles offen (Gründer-Entscheidung 19.10.2026)

Bis der Test abgeschlossen ist, gibt es **keine Abos**: Jedes angemeldete Konto hat alles, was später Premium ist. In
der App steht dort das Kennzeichen **„Testphase: kostenlos“** (nur solange der Server die Testphase meldet), nirgends
ein Kauf- oder Abo-Hinweis. Für KI gilt zusätzlich eine **Obergrenze über alle Konten** (Gericht per Foto: 2000
Aufrufe bzw. 10 € im Monat); ist sie erreicht, zeigt die App „gerade abgeschaltet“. Nach dem Merge
schaltet **db-migrate** das automatisch ein (Flag `premium_open` = an). Ihr müsst nichts tun.

**Status ansehen oder Testphase beenden** (GitHub-App):
1. Repository öffnen → **Actions** → **beta-grant** → **Run workflow**.
2. **aktion** `status` (oder später `flag_aus`), **flag** `premium_open` → **Run workflow**.
3. Den Lauf öffnen → Zusammenfassung: an/aus, Anzahl Konten, Beta-Freischaltungen, KI-Aufrufe und KI-Kosten im Monat.

**Trotz „offen“ noch nicht nutzbar** (bewusst, aus Sicherheits- bzw. Kostengründen, Flags bleiben aus):
- **Live-Anpassung mit Konto:** braucht Etappe C (Rechnen auf dem Server) und danach das Flag `live_adjustment`. Im
  Testmodus geht sie schon (Teil 7n).
- **Gericht per Foto mit Konto:** Flag `ai_food_photo` ist aus → „gerade abgeschaltet“. Einschalten per beta-grant
  (`flag_an`, flag `ai_food_photo`) → dann antwortet die **Attrappe**. Echte KI erst mit `FOOD_PHOTO_PROVIDER=gemini`
  + `GEMINI_API_KEY` in Vercel, neuer Einwilligungstext (Version 2) und AV-Vertrag mit Google. Limits bleiben 30 im
  Monat und 8 am Tag je Konto. Im Testmodus geht die Attrappe (Teil 7j).
- **Produkt per Barcode online (Open Food Facts):** Flag `food_product_lookup` aus (Rechtsprüfung) und
  `OFF_CONTACT_EMAIL` in Vercel nötig. Im Testmodus antwortet die Attrappe (Teil 7k).
- **Kamera-Fotoauswahl in der installierten App:** braucht einen neuen Build (offener Punkt E3); im Browser geht sie.
- **Noch nicht gebaut:** Supplement-Modul (Phase 6, Plan zur Freigabe), Zyklus, Wearables, Partner-/Paar-Modus,
  Strecken in der App, KI-Coach, Körperfoto-Analyse, KI-Erklärungen.

**Pflicht, bevor echte KI (Gemini) eingeschaltet wird – Budget-Warnung in Google Cloud** (Handy-Browser):

1. console.cloud.google.com öffnen und anmelden → oben links **☰** → **Abrechnung** (Billing).
2. Das Rechnungskonto des Gemini-Projekts wählen → **Budgets und Benachrichtigungen** → **Budget erstellen**.
3. Name z. B. „Alpha5 KI“, **Projekte:** nur das Gemini-Projekt → **Weiter**.
4. **Betrag:** fester Betrag, z. B. **10 €** im Monat → **Weiter**.
5. **Schwellenwerte:** 50 %, 90 % und 100 % → **E-Mail-Benachrichtigungen an Abrechnungsadministratoren** anhaken →
   **Fertigstellen**.

Die Warnung stoppt nichts von selbst – abschalten geht sofort per beta-grant (`flag_aus`, flag `ai_food_photo`).

## Teil 7o – Muskelkarte testen (20.10.2026, Testmodus)
1. Vorschau-Link aus dem Pull Request öffnen (Testmodus) → Onboarding → **Zum Plan**.
2. Einen Übungsnamen auf „Heute“ antippen (oder **Einstellungen → Übungen (Glossar)** → Übung wählen): Karte
   **„Beanspruchte Muskeln“** mit Körper **Vorn** und **Hinten**. Hauptmuskeln kräftig blau, mitbeteiligte hellblau,
   der Rest grau. Darunter in Worten: „Hauptmuskeln: …“ und „Mitbeteiligt: …“.
3. **Training starten**: Rechts neben jedem Übungsnamen eine kleine Muskelkarte → antippen → große Karte mit Legende →
   **Schließen**. Der Pausentimer läuft dabei weiter.
4. Mit Bildschirmleser (VoiceOver/TalkBack): Die Karte wird vorgelesen als „Trainiert vor allem: Brust. Mitbeteiligt:
   Trizeps, vordere Schulter.“
5. Alles einmal hell und einmal dunkel ansehen.
6. **Ausgangsposition** (seit 21.10.2026): Im Übungsdetail steht über der Muskelkarte die Karte **„Ausgangsposition“**
   mit einer eigenen Strich-Illustration der Übung. Prüfen: Passt die Haltung zur Übung? Hell und dunkel gut
   erkennbar? Fehler bitte mit Übungsname an Claude („Übungsbild Kreuzheben: Knie zu stark gebeugt“) – die Bilder
   werden aus Gelenkwinkeln erzeugt und lassen sich schnell korrigieren.

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
2. **Keine Berechtigungs-Abfragen:** Beim ganzen Durchklicken fragt die App **nie** nach Fotos, Face ID oder
   Kontakten – und **nie ungefragt** nach Mitteilungen oder Standort: Die Mitteilungs-Abfrage kommt erst, wenn ihr
   eine Erinnerung mit „Ja“ annehmt bzw. in den Einstellungen einschaltet (Teil 9a), die Standort-Abfrage erst nach
   dem Erklär-Bildschirm beim ersten **Aufzeichnen** unter „Ausdauer“ (Teil 9b) – nie beim Start oder im Onboarding.
   Android: Einstellungen → Apps → Alpha5 → Berechtigungen zeigt höchstens Kamera, Standort und Benachrichtigungen
   (Internet und Vibration zählen nicht als Berechtigung). Beim Standort steht nur **„Nur während der Nutzung der
   App zulassen“** zur Wahl – **„Immer zulassen“ gibt es nicht** (gewollt).
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

## Teil 9z – Zyklus-Modul testen (Phase 9, 21.10.2026, Testmodus)

Am besten im **Inkognito-Tab** (Chrome → ⋯ → Neuer Inkognito-Tab), für jeden Durchgang neu. Im Browser bleiben die
Zyklusdaten nur, bis der Tab geschlossen wird.

1. Vorschau-Link → „Ohne Konto testen“ → Geschlecht **weiblich** (oder divers) → Onboarding fertig, ein Trainingstag heute.
2. **Mehr → Zyklus** → Einführung lesen (Satz „nicht zur Verhütung“) → Einwilligung ankreuzen → **Modul einschalten**.
3. Status **Natürlicher Zyklus** → „Letzte Periode: vor weniger als 1 Monat“ → **Fertig**.
4. Tages-Check: Blutung **Mittel**, Energie **2**, Unterleibsschmerzen **stark** → speichert sofort. Darunter erscheint
   „Heute leichter? – passend zu deiner Tagesform“ mit der Vorschau (je Übung ein Satz weniger).
5. **Heute** öffnen → Karte „Wie geht’s dir heute?“, aber **kein** Wort wie Periode oder Zyklus.
6. Neuer Tab, Schritte 1–3 mit „vor mehr als 3 Monaten“ → sofort die Karte „Deine Periode ist seit drei Monaten ausgeblieben …“.
7. **Zyklus → Einstellungen → Zyklus-Beispieldaten laden** → zurück: Eisen-Hinweis. Haken **Warnungen aus** → statt
   der Karten erscheint „Wann ärztlich abklären?“.
8. Einstellungen → **Status ändern** → „Hormonelle Verhütung“ → die Ausbleiben-Karte verschwindet.
9. Einstellungen → **Modul beenden** → bestätigen → alles gelöscht, auf „Heute“ keine Karte mehr.
10. Neuer Tab mit **männlich** → unter Mehr gibt es kein Zyklus-Modul.

## Teil 9a – Benachrichtigungen testen (Phase 4b, Etappe E)
Mess-Erinnerung und Pausenende sind **lokale** Benachrichtigungen: nur auf dem Handy geplant, ohne Server, ohne Werte
im Text, standardmäßig aus.

**Im Handy-Browser (Vercel-Vorschau, Testmodus)** – geht sofort:
1. Vorschau-Link öffnen → **Ohne Konto testen** → Onboarding bis **Geschafft!** → **Zum Plan**.
2. **Einstellungen** → Abschnitt **Benachrichtigungen**: Es steht nur der Hinweis „Im Browser gibt es keine
   Benachrichtigungen …“ – keine Schalter. Der Schalter **Erinnerung an Körperumfänge** weiter unten bleibt wie bisher.

**In der echten App (APK bzw. TestFlight)** – erst mit dem **nächsten** Build (Teil 9 A–C; neues natives Modul,
diese Änderung baut noch keine APK):
1. **Ohne Konto testen** → Onboarding: Es kommt **keine** Mitteilungs-Abfrage.
2. Training starten (Kraft): oben die Frage **„Pausenende melden?“** → **Ja, melden** → jetzt erst fragt das Handy
   nach Mitteilungen → **Erlauben**. Satz abhaken (Pause läuft) → Handy sperren bzw. App schließen → zum Pausenende
   kommt „Pause vorbei – nächster Satz“. App vor dem Ende wieder öffnen → keine Mitteilung (nur die Pausen-Leiste).
3. Einstellungen → Benachrichtigungen → **Mess-Erinnerung als Benachrichtigung** einschalten (braucht die Einwilligung
   in Gesundheitsdaten) → **Test: Mess-Erinnerung in 2 Minuten** (nur im Testmodus) → Bildschirm sperren → nach ca.
   2 Minuten kommt „Alpha5: Zeit für dein Mess-Update“ (ohne Werte) → antippen → die Messung öffnet sich.
4. Einstellungen → Einwilligung Gesundheitsdaten **widerrufen** → Test-Knopf meldet „nur mit deiner Einwilligung“; eine
   geplante Erinnerung kommt nicht mehr.
5. Auf einem zweiten Handy (noch nie gefragt) bei der Abfrage **Nicht erlauben** wählen: Die App läuft normal weiter,
   in den Einstellungen steht, wie man Mitteilungen in den System-Einstellungen erlaubt.
6. **Verspätung messen (Android):** Pause auf 1:30 stellen, Satz abhaken, sofort sperren und mit der Uhr stoppen, wann
   „Pause vorbei“ kommt – einmal mit Ladekabel, einmal ohne und im Energiesparmodus. Wie viele Sekunden zu spät?
   (Android plant ohne exakte Wecker „ungefähr“, die App weist darauf hin.)
Ergebnis bitte Claude schreiben, z. B. „E Android: 1–5 ok, Pause 4 s / 70 s zu spät“ (ohne Passwörter oder Codes).

## Teil 9b – Ausdauer aufzeichnen und als Bild teilen (Etappen E3–E6, 20.10.2026)
Neu unter **Ausdauer** (Kachel auf der **Übersicht** bzw. **Mehr → Ausdauer**): Laufen, Rad und Gehen mit GPS
aufzeichnen, „Meine Läufe“, Auswertung je Lauf (Karte, Kilometerzeiten, Höhenprofil), Summen je Woche/Monat und ein
Story-Bild 9:16. Standortdaten sind privat (nur ihr seht eure Strecken), das Bild entsteht nur auf dem Handy.

**A – Im Handy-Browser (Vercel-Vorschau, Testmodus) – geht sofort, ohne APK**
1. Vorschau-Link → **Ohne Konto testen** → Onboarding bis **Geschafft!** → **Zum Plan** → **Übersicht** → Kachel
   **Ausdauer** → **Zu Ausdauer**.
2. Oben steht „Aufzeichnen mit GPS geht in der App“. **Laufen** wählen → **Demo-Aufzeichnung starten (Testmodus)**:
   Eine ausgedachte Runde am Rhein läuft im Zeitraffer (1 Sekunde = 40 Sekunden). Große Zahlen: Zeit, Distanz,
   Ø-Pace (Rad: km/h). **Pause** → Zahlen stehen; **Fortsetzen** → weiter.
3. Nach ca. 30 Sekunden (über 1 km) **Stopp** → **Ja, beenden** → Name ändern, **Als Favoriten-Strecke merken**,
   Schwierigkeit, Notiz → **Speichern**. Darunter steht „Wird als freie Einheit ins Trainingstagebuch eingetragen“.
4. Auswertung: Gesamt- und Bewegungszeit, Distanz, Ø-Pace, Höhenmeter mit „ca.“ und Hinweis „Höhenmeter per GPS sind
   ungenau“, **Karte** (OpenFreeMap, unten „© OpenStreetMap-Mitwirkende“), **Kilometerzeiten** als Balken,
   **Höhenprofil**. Lädt die Karte nicht, steht ein Hinweis – die Zahlen bleiben.
5. **Als Bild teilen** → Vorschau (schwarz, Alpha5-Logo, Linie ohne Anfang/Ende, Zeit, Distanz, Pace, Höhenmeter –
   **keine Uhrzeit, kein Puls, kein Gewicht**) → Schalter **Strecke zeigen** / **Datum zeigen** ausprobieren →
   **Bild teilen** (Handy-Browser öffnet den Teilen-Dialog) bzw. **Bild herunterladen**.
6. Zurück → **Ausdauer**: Der Lauf steht in **Meine Läufe** mit Linien-Skizze, oben die **Woche** (Umschalter
   **Monat**, **Zurück**/**Weiter**) mit Summen und neutralem Vergleich („… km mehr als letzte Woche“).
7. **Eintragen ohne GPS** → Ausdauer → Rad → Dauer und Distanz → Speichern → erscheint ebenfalls in „Meine Läufe“
   (Kennzeichen „ohne GPS“), einmal gezählt.
8. **Krafttraining als Bild:** Training → eine Einheit speichern → im Verlauf bzw. Kalender den Eintrag öffnen → **Als
   Bild teilen**: Name, Datum, Dauer, Übungen (bis 5 Namen), Sätze, Volumen **nur aus Zusatzlast** (ohne
   Körpergewicht).
9. Auswertung → **Strecke löschen** → weg; der Tagebuch-Eintrag bleibt (separat löschbar). **Alle Strecken löschen**
   unten in der Liste.

**B – In der echten App (Test-APK) – braucht einen neuen Build** (neue native Module: Standort, Hintergrund-Aufgabe,
Bild-Aufnahme, Teilen, WebView)
1. GitHub-App → **Actions** → **eas-build** → **Run workflow** → Branch **claude/ausdauer-gps** (vor dem Merge) bzw.
   **main** (nach dem Merge) → **android / preview / nein** → APK wie in Teil 9 B installieren (alte Version einfach
   überschreiben).
2. **Ausdauer** → **Laufen** → **Aufzeichnung starten** → erst kommt **unser** Erklär-Bildschirm („Wir nutzen deinen
   Standort nur, während du aufzeichnest …“) → **Weiter zur Abfrage** → Android fragt: **„Nur während der Nutzung der
   App“** wählen (iPhone: **„Beim Verwenden der App erlauben“**). „Immer“ wird nie gefragt und ist nicht nötig.
3. Draußen eine kurze Runde (mind. 1 Minute und 100 m). Oben zuerst „Suche GPS …“, dann laufen die Zahlen. **Handy
   sperren** und weitergehen: Android zeigt die Benachrichtigung **„Alpha5 – Aufzeichnung läuft“**, iPhone den blauen
   Standort-Hinweis oben. Entsperren → Zahlen sind weitergelaufen.
4. **Pause** → Benachrichtigung verschwindet (Standort aus) → **Fortsetzen** → wieder an. **Stopp** → speichern →
   Auswertung mit Karte.
5. **Absturz-Test:** Aufzeichnung starten, 1–2 Minuten gehen, App im App-Wechsler **wegwischen** → App neu öffnen →
   **Ausdauer** zeigt „Aufzeichnung gefunden“ → **Fortsetzen** oder **Beenden und speichern**. (Gesichert wird
   spätestens alle 30 Sekunden; die letzten Sekunden vor dem Wegwischen können fehlen.)
6. **Funkloch/offline (mit Konto):** Flugmodus an → aufzeichnen → speichern → Liste zeigt „wird übertragen“ → Flugmodus
   aus → App öffnen → Eintrag ist gespeichert.
7. **Teilen:** Auswertung → **Als Bild teilen** → **Bild teilen** → System-Teilen-Dialog (z. B. WhatsApp, Instagram,
   „Bild sichern“/„In Fotos speichern“). Die App fragt dabei **nicht** nach Zugriff auf eure Fotos.
8. **GPX-Datei:** Auswertung → **Als GPX-Datei speichern** → Ordner wählen (wie beim Datenexport).
9. **Berechtigung ablehnen:** Auf einem Handy bei der Abfrage **Nicht zulassen** → die App zeigt „Kein Zugriff auf den
   Standort“ mit **Einstellungen öffnen** (dort: Apps → Alpha5 → Berechtigungen → Standort → „Nur während der Nutzung
   der App zulassen“) → zurück → **Erneut prüfen** → Aufzeichnung startet.
10. **Akku:** Wer mag, eine lange Runde (60 min) aufzeichnen und den Akkuverbrauch notieren. Energiesparmodus bzw.
    „Akku optimieren“ kann die Aufzeichnung auf manchen Android-Handys stören – dann Alpha5 dort ausnehmen
    (Einstellungen → Apps → Alpha5 → Akku → „Nicht eingeschränkt“).

Ergebnis bitte Claude schreiben, z. B. „9b Android: 1–9 ok, Punkt 5: 40 s fehlten“ (ohne Passwörter oder Codes).

## Teil 9c – Galaxy Watch verbinden (Phase 8, Health Connect, 21.10.2026)
Neu unter **Einstellungen → Smartwatch → Smartwatch verbinden**: Trainingseinheiten, Puls während der Einheit (nur
Ø, Max und Minuten je Pulszone), Ruhepuls, Schlafdauer und Schritte eurer Galaxy Watch landen automatisch in Alpha5.
Der Weg: Uhr → **Samsung Health** (Handy) → **Health Connect** (Android) → Alpha5. Alpha5 **liest nur**, schreibt
nichts zurück, übernimmt keine Strecken der Uhr und gleicht **nicht im Hintergrund** ab (nur beim Öffnen der App,
höchstens alle 15 Minuten, und mit **Jetzt abgleichen**). Nur in der **Android-App** – im Browser und auf dem iPhone
steht ein Hinweis.

**A – Im Handy-Browser (Vercel-Vorschau, Testmodus) – geht sofort, ohne APK (Beispiel-Uhr mit ausgedachten Daten)**
1. Vorschau-Link → **Ohne Konto testen** → Onboarding **mit** Einwilligung Gesundheitsdaten bis **Geschafft!** →
   **Zum Plan**.
2. **Mehr → Einstellungen** → bis **Smartwatch** wischen → **Smartwatch verbinden**. Ihr seht „Was übernommen wird“
   und „Was nicht passiert“.
3. **Zustimmen und verbinden** (eigene Einwilligung „Smartwatch-Daten“, Text über **Einwilligungstext lesen**) →
   **Beispiel-Uhr verbinden (Testmodus)** → Meldung „Abgleich fertig – 5 neu“. Darunter: verbunden seit, letzter
   Abgleich, freigegebene Daten (✓), Tageswerte der letzten 7 Tage (Schritte, Schlaf, Ruhepuls).
4. **Jetzt abgleichen** → „keine neuen Einheiten“ (nichts doppelt).
5. **Verlauf** (Training → Verlauf): Einträge mit **⌚ Smartwatch**. Einen **Lauf** öffnen → „⌚ aus Samsung Health ·
   … kcal (laut Uhr)“, **Puls (laut Uhr)** mit Ø/Max und **Zeit je Pulszone** (Balken mit Minuten) und dem Hinweis
   „Pulszonen sind Schätzwerte … Betablocker …“.
6. Im Lauf **Als Bild teilen** → im Bild steht **kein Puls, keine Zonen, keine kcal**.
7. **Ausdauer** → „Meine Läufe“: die Uhr-Läufe mit „⌚ aus Samsung Health“.
8. **Einstellungen → Einwilligungen → Smartwatch-Daten → Widerrufen** → Pulswerte und Tageswerte sind weg, die
   Einheiten bleiben im Tagebuch (ohne Puls).
9. Alternativ **Smartwatch → Trennen** → **Einheiten löschen** (alles von der Uhr weg) bzw. **Einheiten behalten**
   (bleiben als normale Einträge). Puls und Tageswerte werden in beiden Fällen gelöscht.

**B – Mit der echten Galaxy Watch (Test-APK) – braucht einen neuen Build** (neues natives Modul Health Connect,
Android 8 oder neuer)
1. Uhr ist in der App **Galaxy Wearable** gekoppelt, Daten erscheinen in **Samsung Health**.
2. **Samsung Health** öffnen → unten **Menü** (bzw. ⋮ oben rechts) → **Einstellungen** → **Health Connect** →
   Samsung Health darf **alle Datentypen schreiben** (Schalter an). Je nach Version heißt der Punkt auch
   „Health Connect-Berechtigungen“.
3. **Android 13 oder älter:** im **Play Store** „Health Connect“ installieren bzw. aktualisieren. Ab Android 14 ist es
   eingebaut (Einstellungen → Sicherheit & Datenschutz → Health Connect). Android-Version: Einstellungen →
   Telefoninfo → Softwareinformationen.
4. GitHub-App → **Actions** → **eas-build** → **Run workflow** → Branch des Pull Requests (vor dem Merge) bzw.
   **main** (nach dem Merge) → **android / preview** → nach dem Bau Link im Lauf öffnen → APK installieren (alte
   Alpha5-Version wird ersetzt).
5. Alpha5 → **Mehr → Einstellungen → Smartwatch verbinden** → Erklärung lesen → **Zustimmen und verbinden** →
   **Weiter zu Health Connect** → Android zeigt den Health-Connect-Dialog mit **nur Lese**-Rechten (Trainings,
   Distanz, verbrannte Kalorien, Herzfrequenz, Ruhepuls, Schlaf, Schritte) → **Alle zulassen** (oder einzelne
   abwählen – Alpha5 arbeitet mit dem Rest) → **Zulassen**.
6. Ergebnis: „Abgleich fertig – … neu“ (bis zu 30 Tage zurück). Kommt „Noch keine Daten von der Uhr“: Punkt 2 prüfen;
   Samsung Health überträgt manchmal erst nach einigen Minuten.
7. Mit der Uhr einen kurzen Lauf/Spaziergang aufzeichnen → warten, bis er in Samsung Health steht → Alpha5 öffnen (der
   Abgleich läuft beim Öffnen, höchstens alle 15 Minuten) oder **Jetzt abgleichen** → Eintrag mit „⌚“ im Verlauf, Puls
   und Zonen in der Auswertung.
8. **Doppelt aufgezeichnet:** gleichzeitig mit der App (Ausdauer → Aufzeichnen) **und** der Uhr laufen → nach dem
   Abgleich gibt es **nur einen** Eintrag: die App-Aufzeichnung (mit Linie) bekommt Puls und kcal der Uhr. Überlappen
   sich die Zeiten nur teilweise, steht beim Uhr-Eintrag **„Möglicher Doppel-Eintrag“** mit **Zusammenführen** bzw.
   **Beide behalten**.
9. **Zugriff entziehen:** Android-Einstellungen → Sicherheit & Datenschutz → **Health Connect** → **App-
   Berechtigungen** → **Alpha5** → alles aus → Alpha5 → Smartwatch zeigt **„Zugriff fehlt“** mit **Berechtigungen
   öffnen**. Danach **Trennen** → **Einheiten löschen** testen.
10. **Ohne Netz:** Flugmodus an → **Jetzt abgleichen** → „wird gesendet, sobald du wieder online bist“ → Flugmodus aus
    → App neu öffnen → Einträge sind da.

**C – Routen der Uhr (seit 23.10.2026): Distanz wie in Samsung Health, Karte mit Tempo-Farben** – braucht wieder
einen **neuen Build** (Leserecht „Trainingsrouten“ und Patch der Health-Connect-Bibliothek).
1. **Samsung Health** → ☰/⋮ → **Einstellungen** → **Health Connect** → Samsung Health darf auch **Trainingsrouten**
   (Routen/Strecken) schreiben – Schalter an. Ohne das kommt in Alpha5 keine Route an.
2. Neue APK installieren (wie B4) → Alpha5 → **Einstellungen → Smartwatch**. Wer schon verbunden war: Hinweis **„Neue
   Fassung der Einwilligung“** → Text lesen → **Neuer Fassung zustimmen** (die neue Fassung nennt die Routen).
3. **Berechtigungen öffnen** → **Alpha5** → **Trainingsrouten** → **Immer zulassen** (Android 15 und neuer). Steht
   auf der Smartwatch-Seite „✓ Trainingsrouten: für alle Einheiten erlaubt“, liest Alpha5 jede Route selbst.
4. Fragt Health Connect je Lauf (Android 14 bzw. „Jedes Mal fragen“): Nach dem Abgleich steht „Für N Läufe fragt
   Health Connect nach der Route“. Lauf öffnen (Verlauf) → **Route freigeben** → im Health-Connect-Fenster zulassen →
   Alpha5 öffnet die Auswertung mit Karte.
5. Prüfen: Distanz in Alpha5 ≈ Samsung Health (z. B. 22,84 km), Kopf-Karte mit „⌚ laut Uhr“, Ø Puls und „kcal laut
   Uhr“, Karte „Strecke“ mit Tempo-Farben und „Route von der Uhr, nur für dich sichtbar“, darunter **Pulszonen**.
   Ohne Route steht am Lauf **„Strecke laut Uhr (ohne Route)“** mit Erklärung.
6. Schon übernommene Läufe der letzten 30 Tage bekommen ihre Route beim **ersten Abgleich nach dem Update**
   (einmaliges Nachladen); gelöschte Einträge kommen dabei nicht zurück.
7. **Trennen** (egal ob „behalten“ oder „löschen“) und **Widerruf** der Einwilligung löschen alle Routen der Uhr;
   eigene Aufzeichnungen bleiben.

**D – Erholung aus der Uhr (seit 25.10.2026): Status gut / mittel / niedrig und „Leichter trainieren“**
Im **Handy-Browser (Vorschau, Testmodus)** sofort testbar mit der Beispiel-Uhr (21 Tage Werte; „heute“ ist absichtlich
eine kurze Nacht mit höherem Ruhepuls und niedrigerer HRV):
1. Onboarding mit Einwilligung Gesundheitsdaten und einem **Trainingstag heute** → **Zum Plan**.
2. **Übersicht** → Kachel **Erholung**: ohne Uhr Hinweis + **Uhr verbinden** (auch in der Kachel **Schritte** steht
   „Uhr verbinden“ jetzt in **einer** Zeile).
3. **Uhr verbinden** → Einwilligung (Fassung 3 nennt HRV und die Erholung) → **Beispiel-Uhr verbinden**.
4. Zurück zur **Übersicht** → Kachel **Erholung**: „● niedrig“, „Schlaf kurz · Ruhepuls erhöht · HRV niedriger“,
   „Deine Werte sprechen für einen leichteren Tag.“ und 7 Säulen (vorgestern mittel, heute niedrig). Antippen →
   Smartwatch-Seite mit Werten heute, „So entsteht die Erholung“ und dem Hinweis „keine Bewertung deiner Gesundheit“.
5. **Training (Heute)** → Karte **„Heute leichter trainieren?“** → **Wie geplant** (Hinweis, „Doch leichter“) bzw.
   **Leichter trainieren** → **Training starten** → oben „Heute leichter: …“, je Übung ein Satz weniger.
6. **Einstellungen** → „Live-Anpassung einschalten (Testmodus)“ **aus** → **Heute** zeigt das Angebot **trotzdem**
   (gratis seit Gründer-Entscheidung 26.10.2026; nur die übrige Live-Anpassung bleibt Premium).

Mit der **echten Galaxy Watch** (neuer Build nötig – neues Leserecht HRV): Samsung Health → Einstellungen → Health
Connect → auch **Herzfrequenzvariabilität** und **Ruhepuls** schreiben lassen → Alpha5 → Smartwatch → **Neuer Fassung
zustimmen** → **Berechtigungen öffnen** → „Herzfrequenzvariabilität“ erlauben. Die Erholung braucht **7 Tage** Werte
für Ruhepuls/HRV („Wir lernen deine Werte noch“); bis dahin zählt nur der Schlaf. Bitte mitteilen, ob **HRV** und
**Ruhepuls** ankommen (ohne Werte zu nennen).

Ergebnis bitte Claude schreiben, z. B. „9c Android 14, Galaxy Watch 6: 1–10 ok, Ruhepuls fehlt“ (ohne Passwörter,
Codes oder Gesundheitswerte). **Wichtig für den Spike:** Bitte mitteilen, ob **Ruhepuls**, **Distanz** und **kcal**
bei euren Einheiten ankommen – das klärt, was Samsung wirklich nach Health Connect schreibt.

## Teil 7fa5 – Große Ansicht und Vorlesen testen (Fit im Alter, Etappe FA5, Testmodus)

Chrome am Handy, Vorschau-Link aus dem Pull Request, **Inkognito-Tab**.

1. „Ohne Konto testen“ → Onboarding wie immer (Geburtsdatum z. B. **1955**, dann seid ihr über 60).
2. **Heute** → oben rechts **Einstellungen** → Abschnitt **„Lesen und Hören“**: Ab 60 steht dort der Tipp „Die große
   Ansicht ist besser lesbar“. **Große Ansicht** antippen.
3. Schrift und Knöpfe werden größer, grauer Text dunkler. **Zurück zu Heute** → nur das Wichtigste; Kalender, Woche,
   Verlauf und Übungen liegen hinter **„Mehr anzeigen“**.
4. **Vorlesen:** Unter „Lesen und Hören“ steht entweder **„Anleitungen vorlesen“** (antippen) oder der Hinweis, dass es
   auf diesem Gerät keine deutsche Sprachausgabe ohne Internet gibt (dann geht Vorlesen dort nicht – gewollt). Mit
   Schalter: **Heute → Mehr anzeigen → Alle Übungen** → eine Übung → **„Anleitung vorlesen“** → das Handy liest die
   Anleitung vor; **„Vorlesen stoppen“** hält an.
5. **Großdruck:** **Heute → Plan als PDF** → Häkchen **„Großdruck“** → Vorschau mit größerer Schrift.
6. **Bildschirm-Zoom:** In Chrome ⋯ → **Einstellungen → Bedienungshilfen → Textskalierung** auf 200 % → die Seiten
   bleiben ohne Wischen zur Seite lesbar.

**Checkliste am EAS-Build (App, nicht Browser):** Systemschrift auf die größte Stufe stellen (iPhone: Einstellungen →
Bedienungshilfen → Anzeige & Textgröße → Größerer Text; Android: Einstellungen → Display → Schriftgröße) und
nacheinander **Onboarding, Heute, Training, Übung, Einstellungen** öffnen: Nichts abgeschnitten, Knöpfe erreichbar,
kein Text überlappt. Zusätzlich mit „Große Ansicht“ an. Ergebnis bitte Claude schreiben, z. B. „FA5 Android: 1–6 ok,
Training: Pausen-Timer abgeschnitten“.

## Teil 9d – Widget auf dem Startbildschirm (25.10.2026, nur Android-App)
Ein Widget „**Alpha5 – Heute**“ zeigt auf dem Startbildschirm euer **Training heute** (Name oder „Ruhetag“), einen
**Schritte-Ring** (Schritte / Ziel) und „**kcal übrig**“. Antippen öffnet die App auf **Heute**. Plan und Hintergründe:
docs/PLAN-WIDGET.md. **Braucht eine neue APK** (neues natives Modul) – im Browser gibt es nur den Hinweis in den
Einstellungen, auf dem iPhone kommt es später.

**A – Neue APK bauen (einmal)**
1. GitHub-App → Repository → **Actions** → **eas-build** → **Run workflow**.
2. Branch: der Branch des Pull Requests (z. B. `claude/widget`), Plattform **android**, Profil **preview** →
   **Run workflow**.
3. Nach ca. 15–30 Minuten: im Lauf unten **Zusammenfassung** → Link zur Build-Seite antippen → **Install** → APK
   öffnen → installieren (die alte Alpha5-App wird ersetzt, eure Daten bleiben).

**B – Widget einschalten (in der App)**
1. Alpha5 öffnen → **Mehr → Einstellungen** → bis **Startbildschirm** wischen.
2. Häkchen **Widget auf dem Startbildschirm** setzen. Hinweis lesen: Was im Widget steht, sieht jeder, der euer
   entsperrtes Handy sieht. Standard ist **aus**.

**C – Widget hinzufügen (Android, Samsung)**
1. Auf dem Startbildschirm eine freie Stelle **lange gedrückt halten**.
2. **Widgets** antippen → nach unten zu **Alpha5** wischen (oder oben „Alpha5“ suchen) → antippen.
3. **Alpha5 – Heute** antippen bzw. gedrückt halten und auf den Startbildschirm ziehen → **Hinzufügen**.
4. Größe ändern: Widget lange drücken → an den blauen Punkten ziehen. Ab 4 Feldern Breite liegen Schritte und kcal als
   eigene Kacheln neben dem Training.

**D – Prüfen**
1. Widget zeigt das Training von heute (bzw. „Ruhetag“). Ohne verbundene Uhr **kein** Schritte-Ring, mit
   „Kalorienzahlen anzeigen“ = aus **keine** kcal – beides gewollt.
2. Ein Lebensmittel eintragen → App in den Hintergrund (Home-Taste) → „kcal übrig“ im Widget hat sich geändert.
3. Widget antippen → App öffnet sich auf **Heute**.
4. Einstellungen → Häkchen weg → Widget zeigt „Widget aus“ (keine Zahlen mehr). Wieder an → App einmal öffnen.
5. Handy dunkel stellen (Einstellungen → Anzeige → Dunkel) → Widget wird dunkel.
6. App 1 Tag nicht öffnen → nach Mitternacht steht das neue Training da, aber ohne Schritte/kcal von gestern; nach
   über 24 Stunden steht nur noch „App öffnen zum Aktualisieren“.

**iPhone:** noch kein Widget. Unter Einstellungen steht „Das Widget gibt es zuerst in der Android-App …“. Es kommt mit
einem späteren Update (docs/PLAN-WIDGET.md Abschnitt 7). Später so hinzufügen: Startbildschirm lange drücken → oben
links **+** → **Alpha5** → Größe wählen → **Widget hinzufügen**.

Ergebnis bitte Claude schreiben, z. B. „9d Android 14: A–D ok, Widget 2×2 Text abgeschnitten“ (ohne Gesundheitswerte,
gern mit Bildschirmfoto vom Widget **ohne** echte Zahlen).

## Teil 9t – Schon-Modus, Reise-Modus, Aufwärmen testen (25.10.2026, Testmodus)

Chrome am Handy, Vorschau-Link aus dem Pull Request, **Inkognito-Tab**. Onboarding mit Einwilligung
„Gesundheitsdaten“ und Kraft im Studio.

1. **Heute → Einstellungen → „Schmerz-/Verletzungsmodus“** → auf der Figur das **Knie** antippen (oder unten in der
   Liste), **mittel**, **7 Tage** → **„Schon-Modus starten“**.
2. **Zurück zu Heute:** oben „Schon-Modus bis …“, an der Einheit „heute geschont“, keine Kniebeugen mehr.
3. Wieder in den Schon-Modus → Knie **stark** → vor dem Speichern erscheint „Bitte ärztlich abklären lassen“.
   **Beenden** → auf „Heute“ ist wieder der normale Plan.
4. **Einstellungen → „Reise-Modus“** → heute bis in 6 Tagen, **Nur Körpergewicht**, **30 min** → Speichern →
   auf „Heute“ steht „Reise-Modus bis …“, die Übungen gehen ohne Geräte. **Schlingentrainer** zeigt den Hinweis
   zum Anker (im Testmodus gibt es Schlingen-Übungen als Testinhalt; siehe Teil 9u).
5. **Training starten** → oben „Aufwärmen (ca. 5 min)“, unten „Dehnen danach“, jeweils **Überspringen**. In den
   Einstellungen **„Aufwärmen & Dehnen“** ausschalten → im Training kein Block mehr.

Rückmeldung an Claude z. B. „Training-Modi: 1–5 ok, Körperkarte zu klein“.

## Teil 9u – Calisthenics, Schlingentrainer, Lauf-Kraft testen (25.10.2026, Testmodus)

Chrome am Handy, Vorschau-Link, **Inkognito-Tab**. Alle neuen Übungen sind Entwürfe und als „Testinhalt“ markiert.

1. Onboarding: Ziel **„Calisthenics / Körperbeherrschung“**, Einsteiger, 3 Tage **Kraft zu Hause**, Equipment
   **Klimmzugstange** und **Barren/Dip-Station** → „Heute“ zeigt Übungen mit Stange/Barren.
2. **Mehr → „Skill-Pfade“** → je Pfad „Aktuell: …“ und die Stufen. Handstand, Muscle-up und Hebel sind gesperrt
   („Erst für Fortgeschrittene“), beim Muscle-up stehen die Voraussetzungen (8 Klimmzüge, 10 Dips). Stufe antippen →
   Übungsseite.
3. Einstellungen → **Testdaten löschen**, neu: Muskelaufbau, 3 Tage Kraft zu Hause, Equipment **Kurzhanteln** (4 kg,
   8 kg) und **Schlingentrainer** → z. B. bei der Goblet-Kniebeuge **Tauschen** → „Kniebeuge am Schlingentrainer“ steht in
   der Liste. Übungsseite einer Schlingen-Übung: „Schwierigkeit über den Körperwinkel“ und der Anker-Hinweis.
4. **Einstellungen → Reise-Modus** → **Calisthenics-Park** zeigt einen Hinweis; **Schlingentrainer** wählen und
   speichern → auf „Heute“ Schlingen-Übungen.
5. Testdaten löschen, neu: Ziel **Ausdauer**, Fortgeschritten, Halbmarathon, Montag/Mittwoch/Samstag Ausdauer – am
   Montag öffnen: unter dem Lauf **„Lauf-Kraft danach (15 min)“** → „Einheit mit Timer öffnen“.

Rückmeldung an Claude z. B. „Calisthenics: 1–5 ok, Skill-Pfade zu lang“.

## Teil 9v – App verschlanken: 5 Reiter, weniger pro Seite (26.10.2026, Testmodus)

**Neue Namen (gilt ab jetzt für alle Teile dieser Anleitung):** Die Menüleiste unten heißt **Heute · Training ·
Ernährung · Einkaufen · Mehr**. Was früher **„Übersicht“** hieß, ist jetzt **„Heute“** (Startseite). Was früher oben
**„Heute“** hieß (Plan, Woche, Übungen), ist jetzt der Reiter **„Training“**. **„Workouts“** steht im Training oben im
Umschalter **Mein Plan · Workouts · Übungen**. **Einstellungen** findet ihr unter **Mehr → Einstellungen** (7 Themen).
Steht in einem älteren Teil „Heute → …“, meint er den Reiter **Training**; „Übersicht“ meint **Heute**.

1. Vorschau-Link aus dem Pull Request öffnen → **Ohne Konto testen** → Onboarding bis **Geschafft!** → **Zum Plan**.
2. **Menüleiste:** unten 5 Knöpfe **Heute · Training · Ernährung · Einkaufen · Mehr**; „Training“ ist markiert.
3. **Training:** oben der Umschalter **Mein Plan · Workouts · Übungen**. Darunter höchstens **ein** Hinweis (z. B.
   „Testinhalte …“); weitere Hinweise liegen hinter **„+2 weitere Hinweise“** – antippen klappt sie auf. Danach
   **Deine Woche**, die Zeile **„Woche 1 von 6 – Einstiegswoche …“**, die Karte **Training starten** und die Übungen.
   Unten **Kalender · Verlauf · Tauschen · Als PDF** und die Zeile **„Dein Plan: …“** (antippen = Vorlage und Hinweise).
4. Im Umschalter **Workouts** antippen → Liste der Workouts, unten bleibt **„Training“** markiert. **Filter** antippen →
   Sterne, Dauer, Ziel, „ohne Geräte“ klappen auf. **Übungen** öffnet das Übungs-Lexikon.
5. **Heute:** Gruß, ein Hinweis, **Training heute** mit **Training starten**, **Deine Woche** (Tag antippen öffnet ihn im
   Training), **Ernährung heute** mit „Als Nächstes: …“, **Gegessen** und **Essen eintragen**, dann Ausdauer,
   Schritte, Erholung, Wettkampf. Ganz unten **„Kacheln anpassen“** (oder der Stift oben).
6. **Ernährung:** oben **Tag · Woche · Rezepte**, darunter **‹ Heute ›** zum Blättern und das **Zahnrad** (= Ernährung
   ändern). Ein Hinweis + Zähler, dann Ring, Mahlzeiten. **⋯** an einer Mahlzeit → **Rezept tauschen**, Lieblingsgericht,
   Nie wieder. Unten bunte Kacheln **Einkaufsliste, Meal-Prep, Was habe ich da?, Vorrat, Supplemente, Ratgeber** und die
   Zeile **„Wenn Essen oder Gewicht dich belasten“** (antippen = Hilfe-Stellen).
7. **Einkaufen:** die Liste steht gleich oben. **„+ Etwas hinzufügen …“** antippen → Name, Menge, Abteilung. **⋯** oben
   rechts → **Weitergeben, Als PDF speichern, Zeitraum wählen, Erledigte ausblenden, Alle Häkchen entfernen**. Unten
   **„Hast du wahrscheinlich da“** und **„Aus diesen Rezepten“** zum Aufklappen und der blaue Knopf **Scannen**.
8. **Mehr:** **Mein Konto**, Kacheln **Fortschritt, Kalender** · **Wettkampf, Ausdauer, Skill-Pfade** · **Rezepte,
   Supplemente, Ratgeber, Zyklus**, darunter **Einstellungen, Menüleiste anpassen, Lizenzen**.
9. **Mehr → Fortschritt:** „Diese Woche“ mit drei Zahlen und **Wochenauswertung**, **Körperdaten** mit **Eintragen**,
   Kacheln **Verlauf, Kalender, Dein Tag, Trainingswoche**. Unten ist **„Mehr“** markiert.
10. **Mehr → Einstellungen:** 7 Themen (Profil & Ziel, Training, Ernährung, Smartwatch & Apps, Anzeige & Bedienung,
    Erinnerungen, Konto/Daten/Einwilligungen). Ein Thema antippen → nur dessen Schalter; **„Zurück zu den
    Einstellungen“** unten.
11. **Eigene Menüleiste bleibt:** Wer schon „Workouts“ oder „Wettkampf“ selbst als Knopf gewählt hatte, behält seine
    Leiste. Wer nie etwas geändert hat, bekommt die neue Leiste automatisch. **Mehr → Menüleiste anpassen** → „Workouts“
    wieder aufnehmen geht weiterhin (bis 6 Knöpfe).

## Teil 9w-R – Indoor-Rudern testen (27.10.2026, Testmodus)

Chrome am Handy, Vorschau-Link, **Inkognito-Tab**. Rudergerät-Übungen und Rudern-Workouts sind Entwürfe („Testinhalt“).

1. Onboarding: Ziel z. B. **„Fitness & Gesundheit“** (ohne Disziplin), Einsteiger, Trainingstage **Mo Kraft zu Hause, Di/Do/Sa
   Ausdauer**, Equipment zu Hause u. a. **Rudergerät** → **Training → Woche**: jede zweite Ausdauer-Einheit heißt
   **„Lockeres Rudern“** (gleiche Minuten wie ohne Rudergerät). Ohne Rudergerät gibt es kein Rudern im Plan.
   **Studio:** Testdaten löschen, neu mit **Mo Kraft im Studio, Di/Do/Sa Ausdauer** → im Schritt „Trainingstage“ unten
   **„Im Studio auch rudern (Rudergerät)“** ankreuzen (Standard aus) → gleiche Woche mit Rudern. Ohne Haken: kein
   Rudern. Später ändern: **Mehr → Einstellungen → Training → „Im Studio auch rudern“** → Trainingstage → Haken → danach
   „Plan neu erstellen“.
2. Ruder-Einheit öffnen: Hinweis **„Technik am Rudergerät“** (Beine – Rumpf – Arme, Dämpfer 3–5). **Training
   starten** → Art **Rudern**, 20 min, Distanz **4,8** → Zeile **„Split 2:05 /500 m“** und „≈ … Watt (aus dem Split
   berechnet)“. Optional Ø Watt und Schlagzahl; **„Wiederholung hinzufügen“** → 500 m / 1:58 → Split je Wiederholung.
   Speichern → im Verlauf stehen Split, Watt, Schlagzahl und das Intervall-Ergebnis.
3. Prüfen: Schlagzahl **70** → Fehler am Feld; Distanz **10** km in 20 min → „Bitte prüfen: Der Split ist schneller als
   1:10 /500 m“ (nur Hinweis).
4. **Training → Workouts** → Filter **Rudern**: 10 Workouts (z. B. „4 × 500 m“, „30/30“) mit Timer.
5. **Schon-Modus** einschalten (wie Teil 9t) mit **Knie „mittel“** → an der Ruder-Einheit: „Heute lieber
   Rad-Ergometer oder zügiges Gehen“. **Reise-Modus „Nur Körpergewicht“** → „Unterwegs ohne Rudergerät …“.
6. **Nachtragen** → Art **Rudern** ist wählbar (freie Einheit „Rudern“).

Smartwatch: Health Connect „Rudergerät“ (54) kommt als **Rudern** mit Dauer und Distanz ins Tagebuch; „Rudern“ im Boot
(53) bleibt „Sonstige Sportart“.

Rückmeldung an Claude z. B. „Rudern: 1–6 ok, Split-Zeile zu klein“.

## Tipps
- Eine Sitzung = eine Aufgabe. Lieber mehrere kurze Sitzungen als eine endlose.
- Bei Unsicherheit einfach fragen: „Erklär mir in einfachen Worten, was du gerade geändert hast.“
- Größere Zwischenstände in der GitHub-App mit einem Release/Tag markieren lassen („Markiere den aktuellen Stand als v0.1“).
