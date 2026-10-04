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
- **Android-App:** Workflow `eas-build` starten → Link zur APK öffnen → installieren.
- **iPhone-App:** Workflow `eas-build` startet auch den Upload zu **TestFlight** → TestFlight-App öffnen → installieren. Ihr beide könnt als Tester eingetragen werden.
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

## Tipps
- Eine Sitzung = eine Aufgabe. Lieber mehrere kurze Sitzungen als eine endlose.
- Bei Unsicherheit einfach fragen: „Erklär mir in einfachen Worten, was du gerade geändert hast.“
- Größere Zwischenstände in der GitHub-App mit einem Release/Tag markieren lassen („Markiere den aktuellen Stand als v0.1“).
