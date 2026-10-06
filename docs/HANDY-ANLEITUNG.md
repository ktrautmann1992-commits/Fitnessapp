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
- **Anthropic Console** (console.anthropic.com) – API-Schlüssel für die Inhalts-Erzeugung.
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
  - `content-generate` – neue Übungen/Plan-Vorlagen als Entwurf erzeugen lassen (auch als kostenloser Probelauf)
  - `content-collect` – fertige Entwürfe abholen (läuft auch alle 3 Stunden von selbst) → Pull Request
  - `content-review` – Inhalte freigeben oder zurückziehen → Pull Request (Merge = Freigabe)
  - `content-seed` – freigegebene Inhalte einspielen (läuft nach jedem Merge von selbst)
  - Schritt für Schritt: `docs/SETUP.md` → „Inhalte erzeugen und freigeben am Handy“
  - `eas-build` – neue Android-APK / iOS-TestFlight-Version bauen
- Rote Kreuze bei Actions = Fehler → Link kopieren und Claude Code in einer Sitzung geben: „Diese Action schlägt fehl, bitte beheben.“

## Teil 4 – Schlüssel und Passwörter (wichtig)
- Schlüssel (Supabase, Anthropic, Expo usw.) **nie in den Chat** mit Claude kopieren.
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

## Tipps
- Eine Sitzung = eine Aufgabe. Lieber mehrere kurze Sitzungen als eine endlose.
- Bei Unsicherheit einfach fragen: „Erklär mir in einfachen Worten, was du gerade geändert hast.“
- Größere Zwischenstände in der GitHub-App mit einem Release/Tag markieren lassen („Markiere den aktuellen Stand als v0.1“).
