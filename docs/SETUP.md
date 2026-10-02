# Einrichtung – nur mit dem Handy

Diese Anleitung verbindet das Repository mit **Supabase** (Datenbank), **Vercel** (Vorschau-Links im Browser),
**Expo** (echte App-Builds) und **Anthropic** (Inhalts-Erzeugung). Alles geht im Handy-Browser.

**Reihenfolge:** Teil A → B → C → D → E. Für den ersten Vorschau-Link reicht **Teil C**.
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
| `SUPABASE_URL`                         | Supabase (A5) | GitHub Secret (B)                                                         | nein    |
| `SUPABASE_SECRET_KEY`                  | Supabase (A7) | GitHub Secret (B)                                                         | **JA**  |
| `SUPABASE_PROJECT_REF`                 | Supabase (A4) | GitHub Secret (B)                                                         | nein    |
| `SUPABASE_DB_PASSWORD`                 | Supabase (A3) | GitHub Secret (B)                                                         | **JA**  |
| `SUPABASE_ACCESS_TOKEN`                | Supabase (A8) | GitHub Secret (B)                                                         | **JA**  |
| `EXPO_TOKEN`                           | Expo (D4)     | GitHub Secret (B)                                                         | **JA**  |
| Expo-Projekt-ID                        | Expo (D3)     | Claude in einer Sitzung nennen (D5), kommt in `apps/mobile/app.config.ts` | nein    |
| `ANTHROPIC_API_KEY`                    | Anthropic (E) | GitHub Secret (B)                                                         | **JA**  |

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

1. **console.anthropic.com** öffnen → anmelden.
2. **Settings → Limits**: ein monatliches **Ausgabenlimit** festlegen (Kostenschutz).
3. **API Keys → Create Key** → Name `github-actions` → kopieren.
4. Als GitHub Secret `ANTHROPIC_API_KEY` eintragen (Teil B).

---

## Überblick: Was passiert automatisch?

| Workflow           | Wann                                                              | Braucht                                                                 |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ci`               | bei jedem Push und Pull Request                                   | nichts                                                                  |
| `db-migrate`       | nach Merge in `main`, wenn sich Migrationen ändern, oder per Hand | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` |
| `content-generate` | per Hand (Actions → Run workflow)                                 | `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`              |
| `content-seed`     | per Hand                                                          | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`                                   |
| `eas-build`        | per Hand                                                          | `EXPO_TOKEN` + Expo-Projekt-ID                                          |
| Vercel             | bei jedem Push automatisch                                        | Teil C                                                                  |

Fehlt etwas, endet der Workflow **grün** mit dem Hinweis „übersprungen“. Den Hinweis siehst du in der GitHub-App
unter **Actions** → Lauf antippen → **Summary**.
