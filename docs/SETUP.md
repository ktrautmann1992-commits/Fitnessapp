# Einrichtung – nur mit dem Handy

Diese Anleitung verbindet das Repository mit **Supabase** (Datenbank), **Vercel** (Vorschau-Links im Browser),
**Expo** (echte App-Builds) und **Anthropic** (Inhalts-Erzeugung). Alles geht im Handy-Browser.

**Reihenfolge:** Teil A → B → C → D → E → F → G → H. Für den ersten Vorschau-Link reicht **Teil C**.
Für den Redaktionsbereich `/admin` der Website brauchst du **Teil G**.
Für die Content-Pipeline (Übungen und Plan-Vorlagen) brauchst du **Teil H**, für echte KI-Entwürfe zusätzlich
**Teil E**. Die Bedienung steht am Ende unter **„Inhalte erzeugen und freigeben am Handy“**.
Die anderen Teile kannst du später nachholen. Bis dahin überspringen die GitHub Actions ihre Arbeit mit einem Hinweis.
Sie werden nicht rot.

> **Tipp für GitHub und Vercel im Handy-Browser:** Fehlt ein Menüpunkt, öffne das Browser-Menü (⋯ bzw. ⋮) und
> wähle **„Desktop-Website anfordern“**.

> **Wichtig:** Schlüssel nie in den Chat mit Claude kopieren. Trage sie nur an den unten genannten Stellen ein.
> Kopiere jeden Schlüssel am besten direkt in deinen Passwort-Manager.

---

## Welcher Schlüssel wohin?

| Name                                   | Woher         | Wohin                                                                     | Geheim? |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Supabase (A5) | Vercel-Projekt **App** (C) + Expo (D6)                                    | nein    |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (A6) | Vercel-Projekt **App** (C) + Expo (D6)                                    | nein\*  |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase (A5) | Vercel-Projekt **Web** (C)                                                | nein    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (A6) | Vercel-Projekt **Web** (C)                                                | nein\*  |
| `NEXT_PUBLIC_APP_URL`                  | Vercel (C1)   | Vercel-Projekt **Web** (C), optional                                      | nein    |
| `SUPABASE_URL`                         | Supabase (A5) | GitHub Secret (B)                                                         | nein    |
| `SUPABASE_SECRET_KEY`                  | Supabase (A7) | GitHub Secret (B)                                                         | **JA**  |
| `SUPABASE_PROJECT_REF`                 | Supabase (A4) | GitHub Secret (B)                                                         | nein    |
| `SUPABASE_DB_PASSWORD`                 | Supabase (A3) | GitHub Secret (B)                                                         | **JA**  |
| `SUPABASE_ACCESS_TOKEN`                | Supabase (A8) | GitHub Secret (B)                                                         | **JA**  |
| `EXPO_TOKEN`                           | Expo (D4)     | GitHub Secret (B)                                                         | **JA**  |
| Expo-Projekt-ID                        | Expo (D3)     | Claude in einer Sitzung nennen (D5), kommt in `apps/mobile/app.config.ts` | nein    |
| `ANTHROPIC_API_KEY`                    | Anthropic (E) | GitHub Secret (B)                                                         | **JA**  |
| `CONTENT_MODEL` (optional)             | selbst (E5)   | GitHub **Variable** (E5), Standard `claude-opus-5-5`                      | nein    |
| `CONTENT_EFFORT` (optional)            | selbst (E5)   | GitHub **Variable** (E5), Standard `high`                                 | nein    |
| `CONTENT_MAX_USD` (optional)           | selbst (E5)   | GitHub **Variable** (E5), Standard `15`, höchstens `100`                  | nein    |
| `ADMIN_PASSWORD`                       | selbst (G1)   | Vercel-Projekt **Web**, Production + Preview (G2)                         | **JA**  |
| `ADMIN_SESSION_SECRET`                 | selbst (G1)   | Vercel-Projekt **Web**, Production + Preview (G2)                         | **JA**  |

\* Der „Publishable Key“ darf öffentlich in App und Website stehen. Die Daten schützt die Datenbank selbst
(Row Level Security). Der **Secret Key** dagegen darf **nie** in Vercel-Variablen mit `EXPO_PUBLIC_` oder
`NEXT_PUBLIC_` landen.

---

## Teil A – Supabase (Datenbank, Region Frankfurt)

1. **supabase.com** öffnen → **Sign in** → **Continue with GitHub**.
2. **New project** tippen. Organisation wählen (oder anlegen).
3. **Name:** `fitnessapp`. Bei **Database Password** auf **Generate a password** tippen und das Passwort
   **sofort im Passwort-Manager speichern**. Es ist `SUPABASE_DB_PASSWORD`.
4. **Region:** **Central EU (Frankfurt)** wählen (wichtig für den Datenschutz) → **Create new project**.
   Ein bis zwei Minuten warten. In der Adresszeile steht jetzt `…/project/abcdefghijklmnopqrst`.
   Diese Buchstabenfolge ist `SUPABASE_PROJECT_REF`.
5. Oben auf **Connect** tippen (oder links **Project Settings → Data API**). Die **Project URL**
   (`https://….supabase.co`) ist `SUPABASE_URL`. Derselbe Wert gehört auch in `EXPO_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_URL`.
6. **Project Settings → API Keys**: Der **Publishable key** (`sb_publishable_…`) ist
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
7. Auf derselben Seite beim **Secret key** (`sb_secret_…`) auf **Reveal** tippen und kopieren. Das ist `SUPABASE_SECRET_KEY`.
   Gibt es nur „Legacy“-Schlüssel, nimm stattdessen den Schlüssel `service_role`.
8. Oben rechts auf dein **Profilbild → Account preferences → Access Tokens → Generate new token**.
   Name: `github-actions` → **Generate** → kopieren. Das ist `SUPABASE_ACCESS_TOKEN`.

---

## Teil B – GitHub Secrets eintragen

So trägst du **jeden** Schlüssel ein, der in der Tabelle unter „GitHub Secret“ steht:

1. Im Handy-Browser **github.com** → dein Repository öffnen (ggf. „Desktop-Website anfordern“).
2. **Settings** → links **Secrets and variables** → **Actions**.
3. **New repository secret** tippen.
4. **Name** genau wie in der Tabelle schreiben (z. B. `SUPABASE_DB_PASSWORD`), bei **Secret** den Wert einfügen.
5. **Add secret** tippen. Für den nächsten Schlüssel mit Schritt 3 weitermachen.

Prüfen: **Actions** → links **db-migrate** → **Run workflow** → **Run workflow**. Ein grüner Haken ohne den
Hinweis „übersprungen“ bedeutet: Supabase ist verbunden.

---

## Teil C – Vercel (zwei Projekte → Vorschau-Links)

Aus **einem** Repository entstehen **zwei** Vercel-Projekte:

- **App:** die Web-Version der App aus `apps/mobile`. Damit testest du die App im Handy-Browser.
- **Web:** die Website aus `apps/web`, also Landingpage und später der Admin-Bereich.

### C1 – Projekt „App“ (apps/mobile)

1. **vercel.com** öffnen → **Continue with GitHub**.
2. **Add New…** → **Project**.
3. Neben deinem Repository auf **Import** tippen. Wird es nicht angezeigt, tippe auf **Configure GitHub App**
   und gib Vercel Zugriff auf das Repository.
4. **Project Name:** `fitnessapp-app`.
5. **Root Directory:** **Edit** tippen → Ordner **`apps/mobile`** wählen → **Continue**.
   (Lässt du das Feld leer, baut Vercel über die `vercel.json` im Hauptordner ebenfalls die App – beides funktioniert.)
6. **Framework Preset:** **Other**. Build-Einstellungen **nicht** ändern, sie kommen aus `apps/mobile/vercel.json`.
7. **Environment Variables** aufklappen (optional, geht auch später):
   - `EXPO_PUBLIC_SUPABASE_URL` = Wert aus A5
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Wert aus A6
8. **Deploy** tippen. Nach ca. 2 Minuten erscheint **Congratulations**. Tippe auf das Vorschaubild, um die
   Startseite der App zu öffnen.

### C2 – Projekt „Web“ (apps/web)

1. Wieder **Add New…** → **Project** → dasselbe Repository → **Import**.
2. **Project Name:** `fitnessapp-web`.
3. **Root Directory:** **Edit** → **`apps/web`** → **Continue**.
4. **Framework Preset:** **Next.js**, das wird meist automatisch erkannt.
5. **Environment Variables** (optional, geht auch später):
   - `NEXT_PUBLIC_SUPABASE_URL` = Wert aus A5
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Wert aus A6
6. **Deploy** tippen.

### Variablen später ergänzen oder ändern

1. vercel.com → Projekt öffnen → **Settings** → **Environment Variables**.
2. Name und Wert eintragen. Bei **Environments** alle drei anhaken: Production, Preview, Development → **Save**.
3. Die Änderung wirkt erst nach einem neuen Build: **Deployments** → beim obersten Eintrag **⋯** → **Redeploy**.

Danach steht in jedem Pull Request automatisch ein Kommentar von Vercel mit zwei Vorschau-Links (App und Web).

### C3 – Knopf „App im Browser öffnen“ auf der Website

Die Landingpage verlinkt auf die Web-Version der App. Ohne Eintrag zeigt der Knopf auf
`https://fitnessapp-alpha-five.vercel.app`. Hat euer Projekt „App“ eine andere Adresse:

1. vercel.com → Projekt **fitnessapp-app** öffnen → oben die Adresse unter **Domains** kopieren.
2. Projekt **fitnessapp-web** → **Settings** → **Environment Variables**.
3. Name `NEXT_PUBLIC_APP_URL`, Wert = kopierte Adresse mit `https://` → alle drei Environments → **Save**.
4. **Deployments** → oberster Eintrag **⋯** → **Redeploy**.

---

## Teil D – Expo (echte Apps für Android und iPhone)

1. **expo.dev** öffnen → **Sign up** (oder **Log in**).
2. **Projects** → **Create a project**. **Name:** `fitnessapp`, **Slug:** `fitnessapp`.
   Der Slug muss genau so heißen → **Create**.
3. In der Projektübersicht steht die **ID** (Format `1234abcd-…`). Kopieren. Sie ist **kein** Geheimnis.
4. Oben rechts auf dein **Profilbild → Account settings → Access tokens → Create token**.
   Name: `github-actions` → **Create** → kopieren. Das ist `EXPO_TOKEN`. Trage es als GitHub Secret ein (Teil B).
5. In einer Claude-Code-Sitzung schreiben: **„Trag die Expo-Projekt-ID `…` in apps/mobile/app.config.ts ein.“**
6. Für die echten Apps auch die Datenbank-Werte hinterlegen: expo.dev → Projekt → **Environment variables** →
   **Add variable**:
   - `EXPO_PUBLIC_SUPABASE_URL` (Visibility: **Plain text**, Environments: **preview** und **production**)
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (genauso)

Der erste vollständige Android- und iPhone-Build (Signatur-Schlüssel, Apple- und Google-Konto, TestFlight) wird
in **Phase 4** eingerichtet. Bis dahin endet der Workflow `eas-build` mit einem Hinweis statt mit einem Fehler.

---

## Teil E – Anthropic (Inhalts-Erzeugung, ab Phase 2)

Nur nötig für **echte** KI-Entwürfe. Den Probelauf (siehe „Inhalte erzeugen und freigeben am Handy“) kannst du
ohne Schlüssel machen.

1. **console.anthropic.com** öffnen → anmelden.
2. **Settings → Limits**: ein monatliches **Ausgabenlimit** festlegen – Empfehlung **30 $**. Das ist der dritte
   Kostenschutz neben dem Deckel pro Lauf (15 $) und höchstens 200 Anfragen pro Lauf.
3. **API Keys → Create Key** → Name `github-actions` → kopieren.
4. Als GitHub Secret `ANTHROPIC_API_KEY` eintragen (Teil B). `content-generate` und `content-collect` brauchen
   **nur** diesen Schlüssel.
5. Optional, nicht geheim: GitHub → Repository → **Settings → Secrets and variables → Actions** → Reiter
   **Variables** → **New repository variable**:
   - `CONTENT_MODEL` – Modell, Standard `claude-opus-5-5` (Claude Opus 5.5). Nur ändern, wenn ihr das
     ausdrücklich wollt (z. B. `claude-sonnet-5-5`, günstiger).
   - `CONTENT_EFFORT` – Denktiefe `low`, `medium`, `high` (Standard), `xhigh` oder `max`.
   - `CONTENT_MAX_USD` – Kostendeckel pro Lauf in Dollar, Standard `15`. Liegt die Schätzung (schlimmster Fall)
     darüber, wird **nichts** gesendet. Höchstens **100** möglich (harte Obergrenze im Code) – ein größerer Wert
     bricht den Lauf mit Hinweis ab.

---

## Teil F – Supabase-Anmeldung per E-Mail-Code

> **Ohne Supabase läuft die App im Testmodus:** Fehlen `EXPO_PUBLIC_SUPABASE_URL` und
> `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` im Vercel-Projekt **App**, zeigt die App oben
> „Testmodus – Daten bleiben nur auf diesem Gerät“. Statt der Anmeldung gibt es den Knopf
> **„Testmodus starten“**. Alles (auch Einwilligungen und Gesundheitsdaten) bleibt dann nur im Browser
> bzw. auf dem Handy. In den Einstellungen löscht **„Testdaten löschen“** alles wieder.
> Sobald die Supabase-Werte eingetragen sind (Teil C, danach **Redeploy**), meldet man sich mit einem
> 6-stelligen Code per E-Mail an.

Einmalig in Supabase einrichten (Handy-Browser, ggf. „Desktop-Website anfordern“):

1. **supabase.com** → euer Projekt öffnen → links **Authentication**.
2. **Sign In / Providers** → **Email** antippen → **Enable Email provider** eingeschaltet lassen.
   **Confirm email** eingeschaltet lassen. Prüfen, dass **Email OTP Length** auf **6** steht (die App
   erwartet genau 6 Ziffern) → **Save**.
3. **Emails** (bzw. **Email Templates**) → Vorlage **Magic Link** öffnen.
   - **Subject:** `Dein Anmeldecode für Fitnessapp`
   - **Body** komplett ersetzen durch:
     ```html
     <h2>Dein Anmeldecode</h2>
     <p>Gib diesen Code in der App ein:</p>
     <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
     <p>
       Der Code ist eine Stunde gültig. Wenn du dich nicht anmelden wolltest, ignoriere diese
       E-Mail.
     </p>
     ```
   - **Save changes**.
4. Dieselbe Vorlage auch bei **Confirm signup** eintragen (Subject `Dein Bestätigungscode für Fitnessapp`,
   gleicher Body mit `{{ .Token }}`) → **Save changes**. Neue Konten bekommen beim ersten Mal diese Mail.
5. **URL Configuration** → **Site URL** = Adresse eures Vercel-Projekts **App**
   (z. B. `https://fitnessapp-alpha-five.vercel.app`) → **Save**.
   Unter **Redirect URLs** → **Add URL** → `https://*-DEIN-VERCEL-TEAM.vercel.app/**` (für Vorschau-Links) → **Save**.
6. Testen: Vorschau-Link öffnen → **Los geht's** → Geburtsdatum → E-Mail eingeben → **Code senden** →
   Code aus der Mail eintippen → **Anmelden**. In **Table Editor → profiles** steht danach eure Zeile.

**Hinweis:** Ohne eigenen Mail-Dienst verschickt Supabase nur wenige Mails pro Stunde (Meldung
„Zu viele Versuche“). Für den Start einen EU-Mail-Dienst eintragen – je nach Supabase-Version unter
**Authentication → Emails → SMTP Settings** (siehe docs/PLAN-PHASE-1.md Abschnitt 4).

---

## Teil G – Redaktionsbereich `/admin` (Passwort, Stufe A)

Der Redaktionsbereich der Website zeigt alle Übungen und Plan-Vorlagen aus dem Repository mit Prüfbericht – auch
die Entwürfe eines Pull Requests in dessen Vercel-Vorschau. Er ist **gesperrt**, bis zwei geheime Werte im
Vercel-Projekt **Web** stehen („Redaktionsbereich nicht eingerichtet“). Nichts davon steht im Code.

### G1 – Zwei lange Zufallswerte im Passwort-Manager erzeugen

1. Passwort-Manager öffnen (z. B. iCloud-Schlüsselbund/Passwörter-App, Bitwarden, 1Password).
2. Neuen Eintrag anlegen, Name `Fitnessapp Admin`.
3. **Passwort generieren** – Länge mindestens **24 Zeichen** (Pflicht: mindestens 20), Buchstaben + Ziffern.
   Das ist `ADMIN_PASSWORD` – damit meldet ihr euch an.
4. Im selben Eintrag ein Notizfeld bzw. zweites Feld anlegen und noch einmal generieren – Länge mindestens
   **40 Zeichen** (Pflicht: mindestens 32). Das ist `ADMIN_SESSION_SECRET` – damit werden die Anmeldungen signiert.
   Ihr braucht es nie einzutippen.
5. Speichern. Beide Werte müssen **verschieden** sein. Nicht in den Chat mit Claude kopieren.

### G2 – In Vercel eintragen

1. **vercel.com** → Projekt **fitnessapp-web** → **Settings** → **Environment Variables**.
2. **Key** `ADMIN_PASSWORD`, **Value** = Passwort aus G1, Schalter **Sensitive** einschalten.
3. Bei **Environments** **Production** und **Preview** anhaken (Development nicht nötig) → **Save**.
4. Dasselbe für **Key** `ADMIN_SESSION_SECRET` mit dem zweiten Wert.
5. **Deployments** → oberster Eintrag **⋯** → **Redeploy** → **Redeploy**. Werte wirken erst nach einem neuen
   Build; neue Pull-Request-Vorschauen haben sie automatisch.
6. Testen: Website-Adresse + `/admin` öffnen → Passwort einfügen → **Anmelden**. Die Anmeldung gilt **8 Stunden**
   auf diesem Gerät; **Abmelden** oben rechts.

### G3 – Alle abmelden / Passwort wechseln

- **Alle Geräte abmelden:** in G2 bei `ADMIN_SESSION_SECRET` **⋯ → Edit** → neuen Zufallswert aus dem
  Passwort-Manager → **Save** → **Redeploy**. Alle bisherigen Anmeldungen sind sofort ungültig.
- **Passwort wechseln** (z. B. wenn es jemand Unbefugtes kennen könnte): `ADMIN_PASSWORD` genauso ändern →
  **Redeploy**. Auch das meldet alle ab.
- Wert gelöscht oder zu kurz → `/admin` ist wieder gesperrt (sicherer Standard).

### G4 – Schutz, der eingeschaltet bleibt

- **Deployment Protection** für Vorschau-Links: **Settings → Deployment Protection** → **Vercel Authentication**
  bleibt **an** (Standard). Dann sehen nur Mitglieder eures Vercel-Teams die Vorschauen.
- Fehlversuche: Jeder falsche Versuch dauert ca. 1 Sekunde; das lange Zufallspasswort ist praktisch nicht zu
  erraten. **Optional** zusätzlich: **Firewall** → **Configure** → **New Rule** → Name `admin-login`, **If**
  _Request Path_ _starts with_ `/admin/api/login` → **Then** **Rate Limit** (z. B. 10 Anfragen pro 60 Sekunden je
  IP) → **Save** → **Publish**.
- Der Bereich ist für Suchmaschinen gesperrt (`noindex`) und wird nicht zwischengespeichert. Er zeigt nur
  Inhalte, keine Nutzerdaten, und ändert nichts: **Freigeben** geht weiter per Workflow `content-review`
  (unten, „Inhalte erzeugen und freigeben am Handy“, Schritt 3). Dafür gibt es im Bereich „IDs kopieren“.

---

## Teil H – GitHub: Workflows dürfen Pull Requests öffnen

Nötig für `content-collect` und `content-review`. Handy-Browser, ggf. „Desktop-Website anfordern“.

1. **github.com** → euer Repository → **Settings**.
2. Links **Actions → General**.
3. Ganz unten bei **Workflow permissions**: **Read and write permissions** wählen.
4. Den Haken **Allow GitHub Actions to create and approve pull requests** setzen → **Save**.

> **Wichtig:** Unsere Workflows **öffnen** nur Pull Requests – sie **genehmigen nie** einen. Die Freigabe ist
> immer der **Merge durch einen Menschen**. Schaltet ihr später Pflicht-Genehmigungen ein, darf eine Bot-Genehmigung
> nicht als Freigabe zählen.

**Optional: Schutzregel für `main`** (empfohlen, Pflicht bevor der Admin-Bereich je Schreibzugriff bekommt):

1. **Settings → Branches** (bzw. **Rules → Rulesets**) → **Add branch protection rule** bzw. **New ruleset**.
2. Branch: `main`.
3. **Require a pull request before merging** anhaken. Die Zahl der nötigen Genehmigungen auf **0** lassen –
   ihr könnt weiter selbst mergen.
4. **Create** bzw. **Save changes**.

---

## Inhalte erzeugen und freigeben am Handy

Alle Inhalte (Übungen, Plan-Vorlagen) liegen als Dateien im Repository. Der Weg ist immer:
**erzeugen → abholen (Pull Request) → ansehen und mergen → freigeben (Pull Request) → mergen → einspielen**.
Voraussetzung: Teil H. Wo du die Workflows findest: GitHub-App → Repository → **Actions** → Workflow antippen →
**Run workflow** (oben rechts bzw. unten).

### 1. Probelauf (ohne Schlüssel, kostenlos) – zuerst ausprobieren

1. **Actions → content-generate → Run workflow**.
2. **Welche Inhalte erzeugen?** `exercises` (oder `plan-templates`), **Probelauf** anhaken → **Run workflow**.
3. Nach ca. 1 Minute ist der Lauf grün. In der **Summary** steht der Arbeits-Branch `content/batch-…`.
4. **Actions → content-collect → Run workflow → Run workflow** (oder bis zu 3 Stunden warten – er läuft auch
   automatisch).
5. Unter **Pull requests** erscheint **„Probelauf: Neue Entwürfe … – nicht mergen“**. Im Text steht der
   Prüfbericht: zwei gespeicherte Beispiele, eines absichtlich **ungültig**, eines **abgelehnt**. Darunter läuft
   `ci`.
6. Ansehen – am schönsten in der Vercel-Vorschau der **Website** unter `/admin` (Teil G) –, dann den Pull
   Request **schließen** (nicht mergen) und unten **Delete branch** tippen. Probelauf-Inhalte lassen sich nie
   freigeben (`content:validate` meldet sie als rot, Regel PROBELAUF).

### 2. Echte Entwürfe erzeugen (mit Schlüssel aus Teil E)

1. **Actions → content-generate → Run workflow**.
2. **Welche Inhalte?** `plan-templates` oder `exercises`.
3. **Auswahl** (optional): `alle` oder Begriffe aus der Matrix, getrennt mit Leerzeichen oder Komma:
   - Vorlagen: Ziel `muskelaufbau`/`fettverlust`/`fitness`, Level `einsteiger`/`fortgeschritten`, Tage `3t`/`4t`,
     Ort `studio`/`zuhause`, Minuten `30-45`/`45-60`/`60-75` – z. B. `muskelaufbau 30-45`.
     Vorhandene Vorlagen werden übersprungen.
   - Übungen: Bewegungsmuster (z. B. `squat`, `hinge`) und/oder Geräte `langhantel`, `kurzhantel`,
     `kettlebell`, `kabel_maschine`, `band`, `koerpergewicht` – z. B. `squat band`.
4. **Anzahl**: höchstens so viele Anfragen (1–200, Standard 10). **Probelauf** nicht anhaken → **Run workflow**.
5. Die **Summary** zeigt die **Kostenschätzung** (schlimmster Fall) und endet sofort. Liegt die Schätzung über
   dem Deckel, steht dort „abgebrochen – nichts gesendet“.
6. Meist innerhalb einer Stunde ist der Batch fertig. `content-collect` öffnet dann automatisch (spätestens nach
   3 Stunden) den Pull Request **„Neue Entwürfe: …“** – mit Prüfbericht und tatsächlichen Kosten. Schneller:
   **content-collect → Run workflow**.
7. Pull Request ansehen (Tab **Files changed** bzw. die Vercel-Vorschau der Website), auf grünes `ci` warten,
   **Merge pull request** → danach **Delete branch**. Die Inhalte sind jetzt **Entwürfe** in `main` – noch nicht
   freigegeben. Abgelehnte oder ungültige Antworten stehen nur im Bericht; ein neuer Lauf wiederholt sie.

### 3. Freigeben (oder zurückziehen)

1. **Actions → content-review → Run workflow**.
2. **IDs**: eine oder mehrere IDs, z. B. `goblet-kniebeuge, liegestuetz` (die ID ist der Dateiname ohne `.json`).
   Am einfachsten im Redaktionsbereich `/admin` filtern und **IDs kopieren** tippen.
3. **Neuer Status**: `published` (freigeben), `archived` (zurückziehen) oder `draft` (zurück auf Entwurf).
4. **Wer hat geprüft?** Name oder Kürzel → **Run workflow**.
5. Es erscheint ein Pull Request **„Freigabe: …“**. Hat ein Inhalt einen roten Fehler, gibt es **keinen** Pull
   Request; der Grund steht in der Summary. Tipp: Eine Vorlage lässt sich nur zusammen mit ihren Übungen
   freigeben – dann alle IDs in einem Lauf angeben.
6. Auf grünes `ci` warten → **Merge pull request**. **Merge = Freigabe.**

### 4. Einspielen in die Datenbank (automatisch)

Nach jedem Merge, der Inhalte ändert, läuft **content-seed** von selbst: Es prüft alle Inhalte und spielt nur
freigegebene ein. Ohne Supabase endet es grün mit „übersprungen – Supabase fehlt“.

**Schutz vor Massen-Archivierung:** Würde ein Lauf mehr als **die Hälfte** der bisher in der Datenbank
freigegebenen Übungen oder Vorlagen (je Art) auf „zurückgezogen“ setzen – z. B. weil Dateien versehentlich gelöscht
wurden –, bricht content-seed **rot** ab und spielt **nichts** ein. Die Summary nennt die betroffenen IDs. Ist das
wirklich gewollt: **Actions → content-seed → Run workflow** → Häkchen **allow_mass_archive** → **Run workflow**.
Automatische Läufe (nach Merge, nach `db-migrate`) erlauben das nie.

---

## Überblick: Was passiert automatisch?

| Workflow           | Wann                                                              | Braucht                                                                 |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ci`               | bei jedem Push und Pull Request (inkl. Klick-Tests), per Hand     | nichts                                                                  |
| `db-migrate`       | nach Merge in `main`, wenn sich Migrationen ändern, oder per Hand | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` |
| `content-generate` | per Hand (Actions → Run workflow)                                 | `ANTHROPIC_API_KEY` (Probelauf: nichts)                                 |
| `content-collect`  | alle 3 Stunden und per Hand                                       | Teil H; `ANTHROPIC_API_KEY` nur für echte Läufe                         |
| `content-review`   | per Hand                                                          | Teil H                                                                  |
| `content-seed`     | nach Merge in `main` (Inhalte), nach `db-migrate` und per Hand    | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ohne: nur Prüfung)               |
| `eas-build`        | per Hand                                                          | `EXPO_TOKEN` + Expo-Projekt-ID                                          |
| Vercel             | bei jedem Push automatisch                                        | Teil C                                                                  |

Fehlt etwas, endet der Workflow **grün** mit dem Hinweis „übersprungen“. Den Hinweis siehst du in der GitHub-App
unter **Actions** → Lauf antippen → **Summary**.
