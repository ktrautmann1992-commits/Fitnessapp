# Einrichtung – nur mit dem Handy

Diese Anleitung verbindet das Repository mit **Supabase** (Datenbank), **Vercel** (Vorschau-Links im Browser),
**Expo** (echte App-Builds) und **Anthropic** (Inhalts-Erzeugung). Alles geht im Handy-Browser.

**Reihenfolge:** Teil A → B → C → D (→ D2 für iPhone/Stores) → E → F → G → H (→ J für die Nährwert-Quelle). Für den ersten Vorschau-Link reicht **Teil C**.
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

| Name                                   | Woher         | Wohin                                                                      | Geheim? |
| -------------------------------------- | ------------- | -------------------------------------------------------------------------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Supabase (A5) | Vercel-Projekt **App** (C) + Expo (D6)                                     | nein    |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (A6) | Vercel-Projekt **App** (C) + Expo (D6)                                     | nein\*  |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase (A5) | Vercel-Projekt **Web** (C)                                                 | nein    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (A6) | Vercel-Projekt **Web** (C)                                                 | nein\*  |
| `NEXT_PUBLIC_APP_URL`                  | Vercel (C1)   | Vercel-Projekt **Web** (C), optional                                       | nein    |
| `SUPABASE_URL`                         | Supabase (A5) | GitHub Secret (B)                                                          | nein    |
| `SUPABASE_SECRET_KEY`                  | Supabase (A7) | GitHub Secret (B)                                                          | **JA**  |
| `SUPABASE_PROJECT_REF`                 | Supabase (A4) | GitHub Secret (B)                                                          | nein    |
| `SUPABASE_DB_PASSWORD`                 | Supabase (A3) | GitHub Secret (B)                                                          | **JA**  |
| `SUPABASE_ACCESS_TOKEN`                | Supabase (A8) | GitHub Secret (B)                                                          | **JA**  |
| `EXPO_TOKEN`                           | Expo (D4)     | GitHub Secret (B)                                                          | **JA**  |
| Expo-Projekt-ID                        | Expo (D3)     | Claude in einer Sitzung nennen (D5), kommt in `apps/mobile/app.config.ts`  | nein    |
| Apple-ID der App (Zahl)                | Apple (D2 A2) | Claude in einer Sitzung nennen, kommt in `apps/mobile/eas.json`            | nein    |
| `ASC_API_KEY_P8`                       | Apple (D2 A4) | GitHub Secret (B), nur für die Einrichtung, danach löschen (D2 A4)         | **JA**  |
| .p8-Datei „App-Manager“                | Apple (D2 A5) | nur auf expo.dev → Credentials → iOS (D2 A5)                               | **JA**  |
| `ASC_KEY_ID`                           | Apple (D2 A4) | GitHub Secret (B)                                                          | nein    |
| `ASC_ISSUER_ID`                        | Apple (D2 A4) | GitHub Secret (B)                                                          | nein    |
| `APPLE_TEAM_ID`                        | Apple (D2 A3) | GitHub Secret (B)                                                          | nein    |
| `APPLE_TEAM_TYPE` (optional)           | selbst (D2)   | GitHub **Variable**, nur `INDIVIDUAL` bei Einzelperson-Konto               | nein    |
| Google-Dienstkonto (JSON)              | Google (D2 G) | nur auf expo.dev → Credentials → Android (D2 G4)                           | **JA**  |
| `ANTHROPIC_API_KEY`                    | Anthropic (E) | GitHub Secret (B)                                                          | **JA**  |
| `CONTENT_MODEL` (optional)             | selbst (E5)   | GitHub **Variable** (E5), Standard `claude-opus-5-5`                       | nein    |
| `CONTENT_EFFORT` (optional)            | selbst (E5)   | GitHub **Variable** (E5), Standard `high`                                  | nein    |
| `CONTENT_MAX_USD` (optional)           | selbst (E5)   | GitHub **Variable** (E5), Standard `15`, höchstens `100`                   | nein    |
| `ADMIN_PASSWORD`                       | selbst (G1)   | Vercel-Projekt **Web**, Production + Preview (G2)                          | **JA**  |
| `ADMIN_SESSION_SECRET`                 | selbst (G1)   | Vercel-Projekt **Web**, Production + Preview (G2)                          | **JA**  |
| `RESEND_API_KEY`                       | Resend (I3)   | Vercel-Projekt **Web**, Production + Preview (I5)                          | **JA**  |
| `WAITLIST_FROM_EMAIL`                  | Resend (I2)   | Vercel-Projekt **Web**, Production + Preview (I5)                          | nein    |
| `WAITLIST_TOKEN_SECRET`                | selbst (I4)   | Vercel-Projekt **Web**, Production + Preview (I5)                          | **JA**  |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase (A7) | Vercel-Projekt **Web**, Production + Preview (I5) – nur für die Warteliste | **JA**  |
| `NEXT_PUBLIC_SITE_URL` (optional)      | Vercel (C2)   | Vercel-Projekt **Web**, nur bei eigener Domain (I6)                        | nein    |

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
   - `EXPO_PUBLIC_SUPABASE_URL` (Visibility: **Plain text**, Environments: **development**, **preview** und
     **production**)
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (genauso)

   **Nicht „Secret“ wählen:** Alles mit `EXPO_PUBLIC_` steht ohnehin lesbar im App-Paket (wie im Browser). Expo
   legt solche Variablen deshalb selbst als „Plain text“ an; „Secret“ ist für echte Geheimnisse gedacht, die nur
   auf den Expo-Servern gelesen werden. Welche Umgebung ein Build nimmt, steht in `apps/mobile/eas.json`
   (`preview` → preview, `production` → production). Ohne diese Variablen startet die App im **Testmodus**.

Danach geht schon die **Android-APK** (Workflow `eas-build`, Plattform android, Profil preview). Für das iPhone
(TestFlight) und den Play Store kommt **Teil D2** dazu. Fehlt etwas, endet der Workflow `eas-build` mit einem
Hinweis statt mit einem Fehler.

---

## Teil D2 – Apple und Google verbinden (iPhone über TestFlight, Play Store)

> **Schlüssel nie in den Chat.** Sie kommen nur in **GitHub → Settings → Secrets and variables → Actions** oder
> auf **expo.dev → Credentials**. Claude braucht nur zwei Zahlen, die **kein** Geheimnis sind: die Expo-Projekt-ID
> (Teil D) und die Apple-ID der App (Schritt A2).

**Kosten (Stand 06.10.2026):** Apple Developer Program **99 USD pro Jahr**, Google Play **25 USD einmalig**. Der
**Expo-Gratisplan** enthält **15 Android- und 15 iPhone-Builds pro Monat** in einer Warteschlange mit niedriger
Priorität (oft 10–30 Minuten Wartezeit); Einreichen bei den Stores ist enthalten. Mehr Builds bzw. schnellere
Warteschlange: Plan „Starter“ (19 USD/Monat). Werte ändern sich – aktuell auf **expo.dev/pricing**.

### Wie das iPhone ohne Terminal und ohne Mac klappt (W11)

Geprüft im Quelltext der aktuellen Expo-Werkzeuge (eas-cli 24.11.0, 05.10.2026):

- Ein Build aus GitHub läuft immer **ohne Rückfragen**. So kann Expo das **Verteilungs-Zertifikat** für das
  iPhone **nicht** neu erzeugen – es muss vorher bei Expo liegen. Das **Provisioning-Profil** dagegen kann Expo
  selbst erneuern, wenn ein App-Store-Connect-Schlüssel hinterlegt ist.
- Deshalb gibt es den Workflow **`eas-ios-setup`**: Er läuft **einmal** und legt Zertifikat und Profil bei Expo an.
  Die Anmeldung bei Apple macht er mit dem App-Store-Connect-Schlüssel (kein Apple-Passwort, kein Code aufs Handy).
  Dafür muss der Schlüssel einmal als **GitHub-Secret** eingetragen werden (Schritt A4). Der Workflow schreibt ihn
  nur während des Laufs in eine geschützte Temp-Datei und löscht sie am Ende immer.
- Für die Einrichtung braucht es einen Schlüssel mit Rolle **Admin**, der danach widerrufen wird. Zum
  **Einreichen bei TestFlight** liegt ein zweiter Schlüssel mit Rolle **App-Manager** auf **expo.dev** (Schritt A5).

### A – Apple (TestFlight)

1. **developer.apple.com** → **Account** → dem **Apple Developer Program** beitreten (99 USD/Jahr; als Firma mit
   D-U-N-S-Nummer, Frage 10 im Plan). Die Prüfung durch Apple kann einige Tage dauern.
2. **appstoreconnect.apple.com** → **Apps** → **+** → **Neue App**: Plattform iOS, Name **Alpha5**, Sprache
   **Deutsch**, Bundle-ID **`de.fitnessapp.app`** (fehlt sie in der Liste: developer.apple.com → **Certificates,
   Identifiers & Profiles → Identifiers → +** → App IDs → Bundle ID „Explicit“ `de.fitnessapp.app` anlegen, dann
   zurück), SKU **`alpha5`** → **Erstellen**. Danach **App-Informationen** öffnen und die **Apple-ID** (eine
   Zahl, z. B. `6612345678`) in einer Claude-Code-Sitzung nennen: **„Trag die Apple-ID der App `…` in
   apps/mobile/eas.json ein.“** – das ist kein Geheimnis.
3. **Team-ID** notieren: developer.apple.com → **Account** → **Membership details** → **Team ID** (10 Zeichen).
4. App-Store-Connect-Schlüssel erzeugen: appstoreconnect.apple.com → **Benutzer und Zugriff** →
   **Integrationen** → **App Store Connect API** → Reiter **Team-Schlüssel** → **+** → Name `expo-einrichtung`,
   Zugriff **Admin** → **Generieren**. **Issuer-ID** (oben) und **Schlüssel-ID** notieren, dann **API-Schlüssel
   herunterladen** – das geht **nur einmal**, die Datei `AuthKey_….p8` landet in „Downloads“. Im
   Passwort-Manager sichern.
   Dann in GitHub eintragen (Repository → **Settings → Secrets and variables → Actions → New repository secret**):
   - `ASC_API_KEY_P8` – der **Inhalt** der .p8-Datei. iPhone: Dateien-App → Downloads → Datei antippen (zeigt den
     Text) → lange drücken → **Alles auswählen** → **Kopieren** → im Secret-Feld einfügen. Android: Datei mit einem
     Text-Editor öffnen und den ganzen Text kopieren. Der Text beginnt mit `-----BEGIN PRIVATE KEY-----`.
   - `ASC_KEY_ID` – Schlüssel-ID
   - `ASC_ISSUER_ID` – Issuer-ID
   - `APPLE_TEAM_ID` – Team-ID aus Schritt 3
   - Nur bei einem **Einzelperson-Konto** (keine Firma): unter **Variables** (nicht Secrets) `APPLE_TEAM_TYPE` =
     `INDIVIDUAL`. Bei einer Firma nichts eintragen.

   **Warum „Admin“ und wie lange?** Zertifikate und Profile anlegen darf nur ein Schlüssel mit viel Recht. Der
   Admin-Schlüssel ist deshalb **nur für die Einrichtung** (Schritt 6) gedacht: Danach in App Store Connect
   **widerrufen** (Benutzer und Zugriff → Integrationen → App Store Connect API → Schlüssel → **Widerrufen**) und
   die vier GitHub-Secrets `ASC_*`/`APPLE_TEAM_ID` **löschen**. Für das tägliche Einreichen bei TestFlight reicht
   ein zweiter Schlüssel mit Rolle **App-Manager**, der nur auf expo.dev liegt (Schritt 5). Läuft das Profil nach
   einem Jahr ab oder meldet ein iPhone-Build „Provisioning profile…“, dann wieder kurz einen Admin-Schlüssel
   anlegen, Schritt 4 und 6 wiederholen und danach widerrufen.

5. Schlüssel fürs Einreichen bei Expo hochladen: wie Schritt 4 einen **zweiten** Schlüssel erzeugen, Name `expo`,
   Zugriff **App-Manager**, .p8 herunterladen. Dann **expo.dev** → Projekt **fitnessapp** → **Credentials** →
   **iOS** → Bundle-ID `de.fitnessapp.app` → bei **App Store Connect API Key** (für „Submissions“)
   **Add/Upload** → diese .p8 aus „Downloads“ wählen, Schlüssel-ID, Issuer-ID und Team-ID eintragen → **Save**. (Heißen die Knöpfe bei euch
   anders, Claude kurz schreiben, wie die Seite aussieht – ohne Schlüssel.)
6. GitHub-App → Repository → **Actions** → **eas-ios-setup** → **Run workflow** → im Feld **confirm** genau
   **JA** eintippen → **Run workflow** (einmalig; ohne „JA“ passiert nichts). Grün = in der Zusammenfassung steht
   „iPhone-Zugangsdaten bei EAS eingerichtet“; auf expo.dev unter **Credentials → iOS** sind jetzt **Distribution
   Certificate** und **Provisioning Profile** zu sehen. Rot = die Zusammenfassung sagt, was fehlt (Liste) bzw. was
   zu tun ist (z. B. Apple-Grenze für Zertifikate erreicht – mit Klick-Anleitung); sonst Link des Laufs an Claude
   geben. Danach den Admin-Schlüssel widerrufen und die Secrets löschen (Kasten in Schritt 4).
7. **TestFlight**: appstoreconnect.apple.com → **Apps → Alpha5 → TestFlight** → **Interne Tests** → **+** →
   Gruppe „Gründer“ → euch beide hinzufügen (ihr müsst als Benutzer im App-Store-Connect-Team sein). Interne Tester
   brauchen **keine** Beta-Prüfung durch Apple.
8. Erster iPhone-Build: **Actions → eas-build → Run workflow** → Plattform **ios**, Profil **production**,
   Einreichen **ja**. Nach dem Build (15–30 Minuten) und der Verarbeitung bei Apple (ca. 10–30 Minuten) erscheint
   Alpha5 in der **TestFlight-App** → **Installieren**. Beim ersten Mal fragt App Store Connect evtl. nach der
   Exportkontrolle – die App ist mit „keine eigene Verschlüsselung“ markiert, die Frage sollte entfallen.

### G – Google (Play Store; zum Testen reicht die APK aus Teil D)

1. **play.google.com/console** → Entwicklerkonto anlegen (25 USD einmalig; Firma empfohlen). Achtung: Neue
   **private** Konten müssen vor der Veröffentlichung 14 Tage mit mindestens 12 Testern testen – für interne Tests
   gilt das nicht.
2. **App erstellen** → Name **Alpha5**, Sprache Deutsch, **App**, **Kostenlos** → Erklärungen bestätigen.
3. Dienstkonto für das automatische Hochladen: **console.cloud.google.com** → Projekt anlegen → **IAM und
   Verwaltung → Dienstkonten → Dienstkonto erstellen** → **Schlüssel → Schlüssel hinzufügen → JSON** (die Datei
   landet in „Downloads“). In der **Play Console → Nutzer und Berechtigungen → Neue Nutzer einladen** die
   E-Mail-Adresse des Dienstkontos einladen, Rechte für die App Alpha5 („Releases verwalten“).
4. **expo.dev** → Projekt → **Credentials** → **Android** → `de.fitnessapp.app` → **Google Service Account Key**
   → JSON-Datei aus „Downloads“ hochladen.
5. **Der allererste Upload muss von Hand sein** (Google-Regel): **eas-build** mit Plattform **android**, Profil
   **production**, Einreichen **nein** → auf der Build-Seite (Link in der Zusammenfassung) die **.aab**
   herunterladen → Play Console → **Testen → Interner Test → Neuen Release erstellen** → .aab hochladen →
   speichern. Ab dann geht „Einreichen: ja“ automatisch (als **Entwurf** im internen Test, solange die App nie
   veröffentlicht war – im Release auf **Überprüfen und einführen** tippen).

### Wann was bauen?

| Ziel                       | Plattform | Profil     | Einreichen | Ergebnis                                      |
| -------------------------- | --------- | ---------- | ---------- | --------------------------------------------- |
| Android-App testen         | android   | preview    | nein       | APK zum Installieren (Link in der Zusammenf.) |
| iPhone-App testen          | ios       | production | ja         | TestFlight                                    |
| Play Store (interner Test) | android   | production | ja         | Entwurf im internen Test (nach erstem Upload) |
| Beide Stores               | all       | production | ja         | TestFlight + Play intern                      |
| ios + preview              | –         | –          | –          | wird abgefangen: iPhone nur über TestFlight   |

Das Profil `development` (Development Build mit `expo-dev-client`) ist vorbereitet, aber erst ab den
Wearables/Abos nötig – das Paket ist noch nicht installiert und der Workflow bietet das Profil nicht an.

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
   - **Subject:** `Dein Anmeldecode für Alpha5`
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
4. Dieselbe Vorlage auch bei **Confirm signup** eintragen (Subject `Dein Bestätigungscode für Alpha5`,
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
2. Neuen Eintrag anlegen, Name `Alpha5 Admin`.
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

## Teil I – Warteliste der Landingpage (E-Mail-Dienst Resend)

Die Warteliste auf der Startseite verschickt eine Bestätigungs-Mail (Double-Opt-in). Dafür braucht es einen
E-Mail-Dienst: **Resend**. Solange die Werte unten fehlen, zeigt das Formular freundlich „Die Warteliste ist bald
aktiv“ – kaputt geht nichts. Handy-Browser, ggf. „Desktop-Website anfordern“.

> **Datenschutz:** Resend ist ein Anbieter aus den **USA**. Vor dem Livegang: in Resend den
> **Auftragsverarbeitungsvertrag (DPA)** abschließen (auf der Resend-Website unter „Legal“ → „DPA“; Menüname kann sich ändern),
> als Versandregion **EU (eu-west-1, Irland)** wählen und Resend in der Datenschutzerklärung (`/datenschutz`,
> Abschnitt 4) mit Firma und Anschrift eintragen. Die Datenbank (Supabase) steht weiter in Frankfurt.

### I1 – Konto anlegen

1. **resend.com** öffnen → **Get started** → mit E-Mail registrieren und die Bestätigungs-Mail anklicken.
2. Team-Name z. B. `Alpha5`.

### I2 – Eigene Domain verifizieren (Absender-Adresse)

Ohne eigene Domain verschickt Resend nur an eure eigene Adresse. Ihr braucht eine Domain (z. B. `alpha5.de`).

1. In Resend links **Domains → Add Domain**.
2. **Name:** eine Subdomain nur für Mails, z. B. `mail.alpha5.de`. **Region:** **Ireland (eu-west-1)** →
   **Add**.
3. Resend zeigt 3–4 **DNS-Einträge** (Typ **MX** und **TXT**, ggf. **CNAME**) mit **Name** und **Value**.
4. In einem zweiten Tab beim **Domain-Anbieter** anmelden (z. B. IONOS, Strato, All-Inkl, Cloudflare) →
   Domain → **DNS-Einstellungen** → für jeden Eintrag **Eintrag hinzufügen**: Typ, Name und Wert genau
   übernehmen (Wert per Kopieren, nicht abtippen) → **Speichern**.
5. Zurück in Resend → **Verify DNS Records**. Grün „Verified“ kann einige Minuten bis wenige Stunden dauern.
6. Die Absender-Adresse ist dann z. B. `Alpha5 <warteliste@mail.alpha5.de>`. Das ist `WAITLIST_FROM_EMAIL`.

### I3 – API-Schlüssel erstellen

1. Resend → **API Keys → Create API Key**.
2. **Name:** `alpha5-web`. **Permission:** **Sending access**. **Domain:** eure Domain aus I2 → **Add**.
3. Den Schlüssel (`re_…`) **sofort kopieren** – er wird nur einmal angezeigt. Das ist `RESEND_API_KEY`.
   Nicht in den Chat mit Claude kopieren.

### I4 – Token-Schlüssel erzeugen

1. Im Passwort-Manager einen neuen Eintrag `Alpha5 Warteliste` anlegen.
2. **Passwort generieren** – Länge mindestens **40 Zeichen**. Das ist `WAITLIST_TOKEN_SECRET` (damit werden
   Bestätigungs-Links und IP-Prüfwerte gesichert). Wird er geändert, gelten offene Bestätigungs-Links nicht mehr.

### I5 – In Vercel eintragen

1. **vercel.com** → Projekt **fitnessapp-web** → **Settings** → **Environment Variables**.
2. Für jede Zeile **Key** und **Value** eintragen, Schalter **Sensitive** einschalten (außer bei
   `WAITLIST_FROM_EMAIL`) → **Save**:
   - `RESEND_API_KEY` = Schlüssel aus I3 – Environments **Production** und **Preview**
   - `WAITLIST_FROM_EMAIL` = Absender aus I2, z. B. `Alpha5 <warteliste@mail.alpha5.de>` – **Production** und
     **Preview**
   - `WAITLIST_TOKEN_SECRET` = Wert aus I4 – **Production** und **Preview**
   - `SUPABASE_SERVICE_ROLE_KEY` = **Secret key** aus Supabase (Teil A, Schritt 7, `sb_secret_…`) – **nur
     Production**! Vorschau-Links (Preview) bekommen den Schlüssel nicht; dort zeigt die Warteliste „Die
     Warteliste ist bald aktiv“. So kann Code aus einem Pull Request nie mit vollen Datenbank-Rechten laufen.
     Die Vorschauen bleiben zusätzlich durch **Deployment Protection** (Teil G4) geschützt.
3. `NEXT_PUBLIC_SUPABASE_URL` steht schon aus Teil C2 dort – sonst ergänzen.
4. **Deployments** → oberster Eintrag **⋯** → **Redeploy** → **Redeploy**.
5. Testen: Website öffnen → ganz unten E-Mail eintragen, Haken setzen → **Auf die Warteliste** → Mail öffnen →
   **Anmeldung bestätigen** → auf der Seite noch einmal **Anmeldung bestätigen** tippen.
   In Supabase → **Table Editor → waitlist** steht die Adresse mit `confirmed_at`. (Nur auf der
   Produktions-Adresse – Vorschau-Links zeigen „bald aktiv“, siehe Schritt 2.)

> **Warum der geheime Supabase-Schlüssel?** Die Tabelle `waitlist` ist für die Öffentlichkeit komplett
> gesperrt – auch Einfügen (strenger als „öffentlich nur Einfügen“). Sonst könnte jemand an Rate-Limit und
> Bestätigungs-Mail vorbei fremde Adressen eintragen. Nur der Server der Website schreibt, über drei
> Datenbank-Funktionen. Der Schlüssel darf **nie** mit `NEXT_PUBLIC_` beginnen.

### I6 – Eigene Domain der Website (später, optional)

Die Website meldet Suchmaschinen und Vorschaubildern als Adresse `https://fitnessapp-web-eight.vercel.app`.
Mit eigener Domain: Variable **`NEXT_PUBLIC_SITE_URL`** = `https://www.alpha5.de` (ohne `/` am Ende) wie in I5
eintragen → **Redeploy**. **Pflicht**, sobald die Domain aktiv ist: Die Links in den Mails werden nur aus dieser
Adresse gebaut, und das Formular nimmt Anfragen nur von bekannten Adressen an (sonst „Anfrage abgelehnt“).

### Was die Warteliste speichert

- E-Mail-Adresse, Version des Einwilligungstexts, Zeitpunkte von Eintragung und Bestätigung.
- Bestätigungs- und Abmelde-Link nur als pseudonymisierter Prüfwert (HMAC-Hash). Das Token steht im Link
  hinter `#` – es wird nie an einen Server geschickt, landet also in keinem Log.
- Gegen Missbrauch: je IP höchstens 10 Versuche pro Stunde (IPv6: je /64-Netz), je E-Mail höchstens 3 pro Tag
  (nur pseudonymisierte Prüfwerte/HMAC-Hashes,
  spätestens nach 2 Tagen gelöscht). Ein für Menschen unsichtbares Feld fängt Bots ab.
- Nicht bestätigte Einträge werden spätestens nach 3 Tagen gelöscht (Link gilt 48 Stunden, Löschung täglich); **Abmelden** (Link in jeder Mail) löscht den
  Eintrag ganz.
- Liste exportieren: Supabase → **Table Editor → waitlist** → **Export → CSV** (nur Zeilen mit `confirmed_at`
  anschreiben).
- **Löschfristen automatisch:** Workflow **waitlist-cleanup** läuft täglich (GitHub → **Actions** →
  **waitlist-cleanup**; per **Run workflow** auch sofort). Er nutzt die GitHub-Secrets `SUPABASE_URL` und
  `SUPABASE_SECRET_KEY` aus Teil B; fehlen sie, endet er grün mit Hinweis. Zusätzlich wird bei jedem Eintragen,
  Bestätigen und Abmelden aufgeräumt. Achtung: Ist das Repository öffentlich, schaltet GitHub zeitgesteuerte
  Workflows nach 60 Tagen ohne Aktivität ab – dann unter **Actions → waitlist-cleanup → Enable workflow** wieder
  einschalten.
- Bestätigte Einträge bleiben bis zum Start bzw. bis zur Abmeldung (Frist in der Datenschutzerklärung festlegen).
- Trägt sich eine noch unbestätigte Adresse erneut ein, wird der alte Link ungültig und eine neue Mail geht raus
  (das alte Token liegt nur als Hash vor). Das Limit von 3 Mails pro Adresse und Tag begrenzt Missbrauch.

> **Vorgemerkt für die Start-Mail an alle:** Jede Mail braucht pro Empfänger ein **neues Abmelde-Token** (das
> alte liegt nur als Hash vor) und die Kopfzeilen `List-Unsubscribe` + `List-Unsubscribe-Post:
List-Unsubscribe=One-Click` (RFC 8058, Ein-Klick-Abmelden – Pflicht bei Gmail/Yahoo für Massen-Mails). Dafür
> braucht es dann einen POST-Endpunkt ohne Zwischenseite.

### I7 – Gratis-Rezepte als PDF (Lead-Magnet)

Auf der Startseite steht vor der Warteliste der Abschnitt **„20 Rezepte gratis als PDF“**. Er nutzt dieselben
Einstellungen wie die Warteliste (I1–I5) – es gibt **nichts zusätzlich einzurichten**. Fehlen die Werte, zeigt das
Formular „Der Download ist bald verfügbar“.

So läuft es ab:

1. Besucherin gibt ihre E-Mail ein und setzt das **Pflicht-Häkchen** (nur: „Schickt mir den Download-Link“).
   Das **Newsletter-Häkchen** ist freiwillig und **nicht** vorausgewählt (Entscheidung vom 11.10.2026: Download
   ohne Newsletter-Pflicht).
2. Sie bekommt eine **Bestätigungs-Mail** (Double-Opt-in). Die Mail sagt ausdrücklich, was bestätigt wird:
   „nur Download-Link, kein Newsletter“ oder „Mit dem Klick bestätigst du auch den Newsletter“. Link antippen →
   auf der Seite **Jetzt bestätigen**. Fordert jemand dieselbe Adresse vor der Bestätigung noch einmal an, gilt nur
   der Link aus der **neuesten** Mail (die den dann gültigen Newsletter-Stand nennt).
3. Danach: zweite Mail mit dem **Download-Link** (`/downloads/Alpha5-Gratis-Rezepte.pdf`), und auf der Seite
   erscheint der Knopf **PDF herunterladen** (nur direkt nach der echten Bestätigung, 30 Minuten lang).
4. Fordert eine schon bestätigte Adresse die Rezepte noch einmal an, geht der Download-Link direkt noch einmal
   raus. Setzt sie dabei **neu** das Newsletter-Häkchen, kommt stattdessen eine eigene Bestätigungs-Mail nur für
   den Newsletter (mit dem Download-Link darin).

> **Bewusste Entscheidung (Info für die Gründer):** Das PDF liegt öffentlich unter
> `/downloads/Alpha5-Gratis-Rezepte.pdf`. Wer die Adresse kennt, kann es ohne Anmeldung laden. Das ist
> datenschutzrechtlich unkritisch (das PDF enthält keine personenbezogenen Daten); Suchmaschinen bekommen
> „nicht indexieren“ (`X-Robots-Tag: noindex`). Soll der Download wirklich geschützt sein, müsste das PDF in einen
> privaten Speicher mit zeitlich begrenzten Links – sagt Claude Bescheid.

Was gespeichert wird (Tabelle `waitlist`, wie bei der Warteliste, Spamschutz identisch):

- Spalte `source` = `lead-magnet` (Warteliste: `warteliste`). Eine Adresse kann in beiden Listen stehen.
- Spalte `newsletter_opt_in` = Newsletter bestellt **und** per Mail bestätigt (Zeitpunkt in
  `newsletter_confirmed_at`). Die Warteliste hat hier immer `false` – ihr Zweck ist nur „Infos zum Start“.
- **Wer darf was bekommen?** (Export: Supabase → **Table Editor → waitlist → Filter** → **Export → CSV**)
  - **Newsletter** (Rezepte, Trainingstipps, Start-Infos): nur `source` „= lead-magnet“ **und**
    `newsletter_opt_in` „= true“ **und** `confirmed_at` „is not null“. Niemals an die Warteliste.
  - **Start-Info** („Alpha5 ist da“): Warteliste (`source` „= warteliste“, `confirmed_at` „is not null“) **und** die
    Newsletter-Abonnenten von oben. Doppelte Adressen nur einmal anschreiben.
  - Gratis-Rezepte ohne Newsletter: **keine** weiteren Mails.
- Abmelden: Jede Mail hat ihren eigenen Abmelde-Link, und **alle** bleiben gültig, bis der Eintrag gelöscht ist
  (Tabelle `waitlist_unsubscribe_tokens`, nur Prüfwerte). Abmelden löscht nur den Eintrag dieser Liste – die
  Warteliste hat ihren eigenen Link. Für künftige Newsletter-Mails: jede Mail bekommt ein neues Abmelde-Token
  (Datenbank-Funktion `waitlist_add_unsubscribe_token`).
- Ohne Newsletter wird die Adresse **30 Tage nach der Bestätigung automatisch gelöscht** (Workflow
  waitlist-cleanup).
- **Zahlen ohne Personenbezug:** Supabase → **Table Editor → waitlist_stats** – pro Tag und Liste nur
  `signups` (Bestätigungs-Mails verschickt) und `confirmations` (Bestätigungen). Keine Adressen, keine
  Gesundheitsdaten.
- PDF austauschen: neue Datei unter `apps/web/public/downloads/Alpha5-Gratis-Rezepte.pdf` (gleicher Name)
  per Pull Request. Das Vorschaubild (`apps/web/public/bilder/gratis-rezepte-deckblatt-*.webp`) bitte Claude neu
  erzeugen lassen, wenn sich das Deckblatt ändert.

> **TODO vor dem Livegang:** Einwilligungstexte, Mail-Texte, die 30-Tage-Frist und den Abschnitt 5 der
> Datenschutzerklärung (`/datenschutz`) rechtlich prüfen lassen.

### I8 – Text der Bestätigungs-Mail ändern (am Handy)

Alle Mail-Texte (Warteliste, Gratis-Rezepte: Bestätigung und Download-Mail) stehen in **einer Datei**:
`apps/web/src/lib/waitlist/mail-texte.ts`. Links fügt die Website selbst ein. Im Handy-Browser (nicht in der
GitHub-App – dort kann man keine Dateien bearbeiten):

1. **github.com** öffnen und anmelden → euer Repository **Fitnessapp** antippen.
2. Nacheinander die Ordner antippen: **apps → web → src → lib → waitlist → mail-texte.ts**.
3. Oben rechts auf das **Stift-Symbol** („Edit this file“) tippen. Siehst du es nicht: **⋯** → **Edit file**
   (ggf. im Browser-Menü „Desktop-Website anfordern“).
4. Den passenden Block suchen – z. B. `gratisRezepteBestaetigen` für die Bestätigungs-Mail der Gratis-Rezepte,
   `warteliste` für die Warteliste, `gratisRezepteDownload` für die Mail mit dem Download-Link,
   `gratisRezepteNewsletter` für die nachträgliche Newsletter-Bestätigung. `betreff` ist die Betreffzeile, `text`
   der Haupttext, `knopf…` die Beschriftung des Knopfs. `mitNewsletter`/`ohneNewsletter` sind die Sätze, die
   sagen, ob der Klick den Newsletter mit bestätigt – **diese Aussage nie streichen oder abschwächen** (sonst ist
   die Newsletter-Einwilligung nicht nachweisbar).
5. **Nur den Text zwischen den einfachen Anführungszeichen `'…'` ändern.** Anführungszeichen und Komma am
   Zeilenende stehen lassen. Im Text kein `'` tippen – stattdessen `’` (z. B. „Das war’s“).
6. Oben **Commit changes…** → **Create a new branch for this commit and start a pull request** auswählen →
   **Propose changes** → **Create pull request**.
7. Warten, bis die Prüfung **ci** grün ist (Tests prüfen, dass die Datei in Ordnung ist und alle Texte gefüllt
   sind). Rot? Meist fehlt ein Anführungszeichen – Claude im PR um Korrektur bitten.
8. **Merge pull request** → **Confirm merge**. Vercel veröffentlicht die Website neu; ab dann gilt der neue Text.
   Testen: auf der Produktions-Adresse selbst eintragen (Vorschau-Links verschicken keine Mails, siehe I5).

> Die **Einwilligungstexte** neben den Häkchen stehen in `apps/web/src/lib/waitlist/consent.ts`. Ändert ihr
> dort etwas, muss auch die Zahl bei `version` um 1 steigen (damit nachvollziehbar bleibt, wer welchem Text
> zugestimmt hat) – das lieber Claude machen lassen. Wichtig: Bei den Gratis-Rezepten laufen **beide** Texte
> (Download-Häkchen und Newsletter-Häkchen) unter **einer** gemeinsamen `version` – ändert sich nur einer der
> beiden, steigt trotzdem diese eine Zahl. Mail-Texte (`mail-texte.ts`) haben keine Version.

---

## Teil J – Nährwert-Quelle schützen und Lebensmittel importieren (Phase 5, Etappe N2b)

Nährwerte kommen **nur** aus der amtlichen Quelle (Bundeslebensmittelschlüssel 4.0 des Max Rubner-Instituts,
Lizenz CC BY 4.0). Den Auszug schreibt **nur** der Workflow `foods-import`; die Prüfung `sources-integrity` in `ci`
wird rot, wenn jemand Werte von Hand oder per Claude-Sitzung ändert. Zwei Schutzregeln richtet ihr einmal im
Handy-Browser ein (ggf. „Desktop-Website anfordern“). Details: `docs/PLAN-PHASE-5.md` 5.1 und Umsetzungsstand N2b.

### J1 – Regel für die Import-Branches `foods-import/*`

Ziel: Auf einen Branch, den der Workflow angelegt hat, kann niemand nachträglich eigene Commits schieben.

1. **github.com** → euer Repository → **Settings**.
2. Links **Rules → Rulesets** → **New ruleset** → **New branch ruleset**.
3. **Ruleset Name:** `foods-import geschützt`. **Enforcement status:** **Active**.
4. **Target branches** → **Add target** → **Include by pattern** → `foods-import/*` → **Add inclusion pattern**.
5. Unter **Rules** anhaken: **Restrict updates** und **Block force pushes**. „Restrict deletions“ nicht
   anhaken, damit ihr den Branch nach dem Merge löschen könnt.
6. **Bypass list** leer lassen → ganz unten **Create**.

> **Hinweis zu „Restrict creations“:** Diese Regel lassen wir aus, weil der Workflow den Branch sonst nicht
> anlegen kann. Euer eigenes Konto (und damit auch eine Claude-Sitzung) könnte deshalb selbst einen Branch
> `foods-import/…` anlegen. Das fängt die Prüfung **sources-integrity** ab (nur verifizierte Commits von
> `github-actions[bot]` aus einem echten `foods-import`-Lauf auf main), nicht das Ruleset.

### J2 – Regel für `main`: Pflicht-Freigabe und Pflicht-Checks

Die Datei `.github/CODEOWNERS` nennt **nur** die Ordner `content/sources/` und `content/foods/`. Diese schreibt
ausschließlich der Workflow `foods-import` (Autor `github-actions[bot]`) – deshalb könnt ihr diese Pull Requests
selbst freigeben, und eure eigenen Pull Requests bleiben frei mergebar. Ein zweites GitHub-Konto ist nicht nötig.

1. **Settings → Rules → Rulesets** → **New ruleset** → **New branch ruleset**.
2. **Ruleset Name:** `main schützen`. **Enforcement status:** **Active**.
3. **Target branches** → **Add target** → **Include default branch**.
4. **Require a pull request before merging** anhaken → aufklappen:
   - **Required approvals:** `0` lassen.
   - **Require review from Code Owners** anhaken. (Zeigt GitHub an, dass das nur mit mindestens einer Freigabe
     wirkt, „Required approvals“ auf `1` stellen und Claude Bescheid geben – dann braucht jeder Pull Request
     eure Freigabe.)
5. **Require status checks to pass** anhaken → **Add checks** → nacheinander suchen und antippen:
   - `Lint, Typen, Tests, Build`
   - `sources-integrity`
   - `sources-integrity (Code von main)`

   Ein Check erscheint erst in der Auswahl, wenn er einmal gelaufen ist (nach dem Merge dieser Etappe beim
   nächsten Pull Request). Fehlt einer, später nachtragen. **Nicht** als Pflicht eintragen:
   `Migrationen + RLS-Tests (pgTAP)` – dieser Check läuft nur, wenn sich `supabase/` ändert, und würde andere
   Pull Requests sonst blockieren. Pull Requests von `foods-import` starten wegen einer GitHub-Regel
   (Pull Requests mit dem Workflow-Schlüssel lösen keine Workflows aus) keine Checks von selbst – `foods-import`
   startet deshalb `ci` **und** `sources-integrity-main` ausdrücklich für den Branch `foods-import/<Lauf-ID>`.
   Die Checks hängen dann am Kopf-Commit des Pull Requests und erfüllen die Pflicht. Fehlt einer („Expected –
   Waiting for status“), unter **Actions → sources-integrity-main** bzw. **ci → Run workflow** den Branch
   `foods-import/<Lauf-ID>` wählen.

6. **Block force pushes** anhaken → **Create**.
7. **Pull Request von `foods-import` freigeben** – das macht **immer ein Gründer selbst** in der GitHub-App bzw.
   im Handy-Browser, **nie eine Claude-Sitzung**: Pull Request öffnen → **Files changed** → **Review changes** →
   **Approve** → **Submit review** → **Merge pull request**.

> **Regel für Claude-Sitzungen:** Claude gibt keine Pull Requests frei (kein „Approve“), merged keine
> Pull Requests von `foods-import/*` und startet `sources-integrity-main` nie per Hand (ein per Hand gestarteter
> Lauf nutzt die Workflow-Datei des gewählten Branches – auf einem eigenen Branch ließe sich der Check sonst
> fälschen). Claude arbeitet mit eurem Konto – technisch könnte es das, deshalb gilt die
> Regel ausdrücklich (festgehalten in `docs/PLAN-PHASE-5.md`, Umsetzungsstand N2b).

### J3 – Lebensmittel importieren

1. **Actions → foods-import → Run workflow** → Branch **main**.
2. **quelle** `bls`, **version** `4.0`, **modus** `kandidaten` → **Run workflow**.
3. Lauf antippen → **Summary**: oben „Spalten der Quelle“ (welche Spalte je Nährwert genutzt wird), darunter für
   jede Zutat ohne Quell-ID passende Einträge der Quelle (BLS-Schlüssel und Bezeichnung, keine Nährwerte). Ist der Lauf rot mit „Original-Datei nicht geladen“, stimmt die Adresse in
   `packages/content/src/foods/sources.ts` nicht – Claude in einer Sitzung Bescheid geben (siehe unten).
4. Die gewählten Schlüssel trägt eine Claude-Sitzung (oder ihr per Pull Request) in
   `content/food-mapping/alpha5-zuordnung.json` bei `source.ref` ein → Pull Request → mergen.
5. **Actions → foods-import → Run workflow** → **modus** `import`. Es erscheint ein Pull Request
   **„Lebensmittel: Bundeslebensmittelschlüssel …“** mit Adresse, beiden Prüfsummen, Import-Bericht und dem
   Gegencheck gegen `alpha5-rezepte.json` (🔴 = „Zuordnung prüfen“).
6. Auf grüne Checks warten (`ci` inkl. **sources-integrity** und **sources-integrity (Code von main)**) →
   **selbst** freigeben und mergen (J2 Schritt 7).
7. Danach prüft ihr jedes Lebensmittel mit der Checkliste (Plan 5.1.1 d) – markierte Zuordnungen zuerst.

**Wöchentliche Prüfung:** Jeden Montag lädt `ci` die Original-Datei neu und vergleicht die Prüfsummen. GitHub
schaltet zeitgesteuerte Läufe in öffentlichen Repositories nach **60 Tagen ohne Aktivität** ab – dann unter
**Actions → ci** den Hinweis antippen und **Enable workflow** wählen.

**Adresse der Original-Datei bestätigen (einmalig):** Im Handy-Browser
`https://www.openagrar.de/receive/openagrar_mods_00112643` öffnen → bei der Datei
**BLS_4_0_Daten_2025_DE.xlsx** lange auf den Link tippen → **Link kopieren** → in einer Claude-Sitzung einfügen.
Claude trägt die Adresse in `sources.ts` ein (bisher aus der Recherche abgeleitet, noch nicht bestätigt).

**Rezepte importieren (Etappe N2c, erst NACH dem Merge des Lebensmittel-Pull-Requests):**

1. GitHub-App → Repository → **Actions** → **alpha5-import** → **Run workflow**.
2. Branch **main**, Modus **pull-request** → **Run workflow**.
3. Nach 2–3 Minuten liegt ein Pull Request **„Rezepte als Entwurf: alpha5-rezepte.json …“** vor. Im Text: Zahlen
   (Soll 242 Rezepte, 236 Zutaten, 4 Meal-Prep-Pläne, 2 Ratgeber), Abweichungen > 3 %, Annahmen „erhitzt“,
   Haltbarkeit der Meal-Prep-Pläne, Abdeckung.
4. Ist der Katalog noch leer, entsteht **kein** Pull Request – die Zusammenfassung des Laufs sagt „Katalog fehlt“.
5. Auf grünes **ci** warten → prüfen → selbst mergen. Alle Rezepte bleiben Entwürfe, bis ihr sie freigebt.
   Ein erneuter Lauf überschreibt keine von euch korrigierten oder freigegebenen Dateien.

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

**Trainingsplan mit Supabase testen (ab Phase 3, Etappe C):** Die App nutzt live **nur freigegebene** Vorlagen und
Übungen. Vor dem ersten Test mit Supabase deshalb erst Inhalte freigeben (Schritte oben, `content-seed` grün) – sonst
zeigt „Heute“ richtigerweise „Für deine Angaben gibt es gerade keinen freigegebenen Plan“.

---

## Überblick: Was passiert automatisch?

| Workflow                 | Wann                                                                | Braucht                                                                                |
| ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ci`                     | bei jedem Push und Pull Request (inkl. Klick-Tests), per Hand       | nichts                                                                                 |
| `db-migrate`             | nach Merge in `main`, wenn sich Migrationen ändern, oder per Hand   | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`                |
| `content-generate`       | per Hand (Actions → Run workflow)                                   | `ANTHROPIC_API_KEY` (Probelauf: nichts)                                                |
| `content-collect`        | alle 3 Stunden und per Hand                                         | Teil H; `ANTHROPIC_API_KEY` nur für echte Läufe                                        |
| `content-review`         | per Hand                                                            | Teil H                                                                                 |
| `content-seed`           | nach Merge in `main` (Inhalte), nach `db-migrate` und per Hand      | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ohne: nur Prüfung)                              |
| `waitlist-cleanup`       | täglich 03:17 UTC und per Hand (Löschfristen der Warteliste)        | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`                                                  |
| `foods-import`           | per Hand (Branch main, Modus kandidaten/import)                     | Teil H, J                                                                              |
| `ci` · sources-integrity | bei jedem PR, auf main und wöchentlich (Mo 04:23 UTC)               | nichts (Original-Datei wird aus dem Internet geladen)                                  |
| `sources-integrity-main` | bei jedem PR (`pull_request_target`, Prüfung mit dem Code von main) | nichts                                                                                 |
| `eas-build`              | per Hand (Plattform, Profil, Einreichen ja/nein)                    | `EXPO_TOKEN` + Expo-Projekt-ID; iPhone/Stores zusätzlich Teil D2                       |
| `eas-ios-setup`          | einmal per Hand vor dem ersten iPhone-Build (Eingabe „JA“)          | `EXPO_TOKEN`, Projekt-ID, `ASC_*`-Secrets, `APPLE_TEAM_ID` (D2); rot, wenn etwas fehlt |
| Vercel                   | bei jedem Push automatisch                                          | Teil C                                                                                 |

Fehlt etwas, endet der Workflow **grün** mit dem Hinweis „übersprungen“. Den Hinweis siehst du in der GitHub-App
unter **Actions** → Lauf antippen → **Summary**.
