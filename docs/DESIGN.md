# Farben und Design – eine Datei für Website und App

Alle Farben, Abstände, Ecken-Rundungen und Schriftgrößen stehen in **einer einzigen Datei**:

**`packages/ui/theme.css`**

Wer das Aussehen ändern will, ändert nur diese Datei. Alles andere passt sich an.

> **Stand jetzt:** Die Datei enthält das Farbschema der Marke **Alpha5** („Nacht & Kobalt“: Blau und Schwarz)
> aus [`docs/ALPHA5-PAKET.md`](ALPHA5-PAKET.md). Zuordnung und Kontraste: Abschnitt „Marke Alpha5“ unten.

---

## Marke Alpha5

### Logo

- **`packages/ui/brand/alpha5-mark.svg`** – „α5“, komplett Blau `#1f5bff`, als Vektor. Unverändert aus dem
  Alpha5-Paket übernommen. Nie durch Text ersetzen, nie umfärben oder verzerren.
- Basis ist Fira Sans ExtraBold Italic (OFL); die Form ist fest als Pfad gespeichert, die Schrift wird nicht gebraucht.

### Markenfarben (Palette)

Stehen in `theme.css` als `--brand-…` und in der App als `brandColors` (z. B. `brandColors.blau`).

| Variable               | App (`brandColors.`) | Hex       | Einsatz                                           |
| ---------------------- | -------------------- | --------- | ------------------------------------------------- |
| `--brand-schwarz`      | `schwarz`            | `#0a0c10` | Text, Kopfzeile, dunkle Flächen, Icon-Hintergrund |
| `--brand-graphit`      | `graphit`            | `#151922` | Karten auf Schwarz                                |
| `--brand-graphit-hell` | `graphitHell`        | `#262c3a` | Linien auf Dunkel                                 |
| `--brand-blau`         | `blau`               | `#1f5bff` | Logo, Buttons, Akzente                            |
| `--brand-blau-dunkel`  | `blauDunkel`         | `#1747cc` | Hover                                             |
| `--brand-himmel`       | `himmel`             | `#8db0ff` | heller Text auf Schwarz                           |
| `--brand-eisblau`      | `eisblau`            | `#e3ebff` | helle Flächen                                     |
| `--brand-hell`         | `hell`               | `#f4f6fa` | Seitenhintergrund                                 |
| `--brand-grau`         | `grau`               | `#586173` | Nebentext auf Hell                                |
| `--brand-grau-dunkel`  | `grauDunkel`         | `#b4bdd0` | Nebentext auf Dunkel                              |
| `--brand-signal`       | `signal`             | `#ffb020` | nur hohe Belastung und Fehlermeldungen            |
| `--brand-weiss`        | `weiss`              | `#ffffff` | Schrift auf Blau, Karten auf Hell                 |

### Zuordnung zu den Pflicht-Farben (mit Kontrast nach WCAG)

| Pflicht-Farbe          | Hell                       | Dunkel                 | Kontrast (AA: Text ≥ 4,5 : 1)                     |
| ---------------------- | -------------------------- | ---------------------- | ------------------------------------------------- |
| `--color-background`   | hell `#f4f6fa`             | schwarz `#0a0c10`      | –                                                 |
| `--color-surface`      | weiß `#ffffff`             | graphit `#151922`      | –                                                 |
| `--color-text`         | schwarz `#0a0c10`          | hell `#f4f6fa`         | 18,1 : 1 (hell und dunkel)                        |
| `--color-text-muted`   | grau `#586173`             | grau-dunkel `#b4bdd0`  | hell 5,8 (auf Weiß 6,2) · dunkel 10,4 (Karte 9,3) |
| `--color-primary`      | blau `#1f5bff`             | blau `#1f5bff`         | Fläche (Buttons): auf Schwarz 3,7 (≥ 3 : 1)       |
| `--color-primary-text` | weiß `#ffffff`             | weiß `#ffffff`         | auf Primär 5,3 (hell und dunkel)                  |
| `--color-link`         | blau-dunkel `#1747cc`      | himmel `#8db0ff`       | Link-Text: hell 6,9 (Weiß 7,5) · dunkel 9,1       |
| `--color-border`       | grau-dunkel `#b4bdd0`      | graphit-hell `#262c3a` | Linien, kein Text                                 |
| `--color-success`      | `#15803d` (grün)           | `#4ade80`              | hell 4,6 · dunkel 10,1                            |
| `--color-warning`      | `#a15c00` (Signal dunkler) | signal `#ffb020`       | hell 4,8 · dunkel 10,7                            |
| `--color-danger`       | `#b91c1c` (rot)            | `#f87171`              | hell 6,5 (auf Weiß) · dunkel 6,4 (Karte)          |

Bewusste Entscheidungen:

- **Primär bleibt hell und dunkel Blau `#1f5bff` mit weißer Schrift** (5,3 : 1). Als Fläche auf Schwarz reicht
  Blau (3,7 : 1, Mindestwert für Bedienelemente 3 : 1), als **Text** auf Schwarz nicht. Darum gibt es
  `--color-link` für Links und Text in Hauptfarbe: hell blau-dunkel `#1747cc`, dunkel himmel `#8db0ff`.
  `--color-primary` nie als Textfarbe auf dem Hintergrund verwenden.
- **Signal `#ffb020` ist auf Hell als Text nicht lesbar** (1,7 : 1). Im hellen Modus ist die Warnfarbe daher ein
  abgedunkeltes Signal-Orange `#a15c00`; im Dunkelmodus Signal selbst.
- **Grün und Rot gibt es in der Palette nicht.** `success` und `danger` bleiben Grün und Rot, damit „erledigt“,
  „Achtung“ und „Fehler/löschen“ klar unterscheidbar sind (immer zusätzlich mit Text, nie nur über die Farbe).

### Icons und Favicons

Alle Icons werden aus dem Logo erzeugt – nie von Hand zeichnen:

- Skript: `packages/ui/brand/generate-icons.mjs` (`pnpm --filter @fitnessapp/ui icons`, nutzt `sharp`).
  In der Claude-Code-Sitzung: **„Erzeuge die Icons neu.“**
- Ausgabe: `packages/ui/brand/generated/` und Kopien an die Stellen, an denen App und Website sie nutzen.
- Schrift im Open-Graph-Bild: **Archivo Bold** (OFL, Lizenz in `packages/ui/brand/fonts/OFL.txt`), liegt als Datei
  im Repository – kein Nachladen von Google.

| Datei                  | Größe       | Hintergrund                         | Logo-Breite | Verwendet in                                                  |
| ---------------------- | ----------- | ----------------------------------- | ----------- | ------------------------------------------------------------- |
| `icon.png`             | 1024 × 1024 | schwarz + blauer Schein, ohne Alpha | 66 %        | `apps/mobile/assets/images/` (App-Icon iOS/Android)           |
| `adaptive-icon.png`    | 1024 × 1024 | transparent                         | 50 %        | `apps/mobile/assets/images/` (Android, Hintergrund `#0a0c10`) |
| `splash-icon.png`      | 1024 × 1024 | transparent                         | 50 %        | `apps/mobile/assets/images/` (Startbildschirm auf `#0a0c10`)  |
| `favicon.svg`          | 64 × 64     | schwarz                             | 84 %        | `apps/web/src/app/icon.svg`                                   |
| `favicon.png`          | 48 × 48     | schwarz                             | 84 %        | `apps/web/src/app/icon.png`, App im Browser (`web.favicon`)   |
| `apple-touch-icon.png` | 180 × 180   | schwarz                             | 70 %        | `apps/web/src/app/apple-icon.png`, `apps/mobile/public/`      |
| `og-image.png`         | 1200 × 630  | schwarz + Schein, Text in Weiß      | 30 % + Text | `apps/web/src/app/opengraph-image.png`, `twitter-image.png`   |

Logo immer waagerecht und senkrecht zentriert; beim Open-Graph-Bild ist Logo + Text zusammen mittig.
Zusätzlich (nicht in der Paket-Tabelle): `android-icon-monochrome.png` (1024 × 1024, transparent, Logo einfarbig
weiß, 50 %) für „Designte Symbole“ ab Android 13 (`android.adaptiveIcon.monochromeImage`).

### Offener Punkt: Rahmenkontrast

WCAG 1.4.11 verlangt für Rahmen von Bedienelementen (Eingabefelder, Auswahlkarten) mindestens 3 : 1 zum
Hintergrund. `--color-border` erreicht das nicht (hell `#b4bdd0` auf Weiß 1,9 : 1, dunkel `#262c3a` auf Schwarz
1,4 : 1). Checkboxen und Radio-Kreise nutzen bereits `--color-text-muted` (ausreichend). Vorschlag für später:
eigenes Token für Feld-Rahmen (z. B. hell grau `#586173`, dunkel `#7d869a`) oder Felder zusätzlich mit Fläche
absetzen – mit den Gründern abstimmen.

---

## So funktioniert es

```
packages/ui/theme.css  ──────────────►  Website (apps/web) liest die Datei direkt
        │
        │  automatisch übersetzt
        ▼
packages/ui/src/tokens.generated.ts  ─►  App (iPhone, Android und App im Browser)
```

1. **Website:** Die Website bindet `theme.css` direkt ein. Jede Farbe wird dort als Variable verwendet,
   z. B. `var(--color-primary)`.
2. **App:** iPhone- und Android-Apps können kein CSS lesen. Deshalb übersetzt ein kleines Programm die
   Datei in eine App-taugliche Liste (`tokens.generated.ts`). Diese Datei **nie von Hand bearbeiten**.
3. **Sicherheitsnetz:** Bei jedem Pull Request prüft GitHub (Workflow `ci`, Schritt **„Farbschema prüfen“**),
   ob App und Website noch dieselben Werte haben. Wenn nicht, wird der Schritt rot und sagt, was zu tun ist.
4. **Dunkelmodus:** Ist das Handy auf „Dunkel“ gestellt, nehmen Website und App automatisch die dunklen Farben.

---

## Pflicht-Variablen

Alle folgenden Variablen **müssen** in der Datei stehen. Namen bitte genau so schreiben.

### Farben (je einmal hell und einmal dunkel)

| Variable               | Wofür                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `--color-background`   | Hintergrund der ganzen Seite                                  |
| `--color-surface`      | Hintergrund von Karten, Feldern, Dialogen                     |
| `--color-text`         | normaler Text                                                 |
| `--color-text-muted`   | Nebentext, Hinweise, Beschriftungen                           |
| `--color-primary`      | Hauptfarbe: Buttons, Hervorhebungen (Fläche, nicht als Text)  |
| `--color-primary-text` | Schrift **auf** der Hauptfarbe (z. B. Text im Button)         |
| `--color-link`         | Links und Text in Hauptfarbe auf dem Hintergrund              |
| `--color-border`       | Rahmen und Trennlinien                                        |
| `--color-success`      | Erfolg, „erledigt“ (z. B. grüner Punkt „Datenbank verbunden“) |
| `--color-warning`      | Warnung, „Achtung“                                            |
| `--color-danger`       | Fehler, „löschen“                                             |

Erlaubte Schreibweisen: `#1A2B3C`, `#ABC`, `#1A2B3C80` (mit Transparenz), `rgb(…)`, `rgba(…)`, `hsl(…)`, `hsla(…)`.
**Nicht** erlaubt: Farbnamen wie `red` oder `blue`.

### Größen (gelten hell und dunkel gleich)

| Variable                                                                                  | Wofür                                     | Einheit           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, `--space-xxl`       | Abstände, von sehr klein bis sehr groß    | `px` (oder `rem`) |
| `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`                              | Ecken-Rundung (`pill` = ganz rund)        | `px`              |
| `--font-size-sm`, `--font-size-md`, `--font-size-lg`, `--font-size-xl`, `--font-size-xxl` | Schriftgrößen                             | `px` (oder `rem`) |
| `--font-weight-regular`, `--font-weight-semibold`, `--font-weight-bold`                   | Schriftstärke                             | `100` bis `900`   |
| `--max-content-width`                                                                     | maximale Breite des Inhalts auf Tablet/PC | `px`              |

`1rem` zählt als `16px`. Zahlen ohne Einheit (außer `0`) sind bei Größen nicht erlaubt.

### Regeln für den Dunkelmodus

- Die dunklen Farben stehen in einem eigenen Block (siehe Vorlage).
- **Fehlt der Dunkel-Block ganz**, meldet die Prüfung einen Fehler.
- **Fehlt dort nur eine einzelne Farbe**, wird die helle Farbe genommen (mit Hinweis in der Prüfung).
- `[data-theme='dark']` und `[data-theme='light']` sind für einen späteren Umschalter „Hell/Dunkel“ in der App da.
  Die Werte im `[data-theme='dark']`-Block müssen dieselben sein wie im `@media`-Block.
- Zusätzliche eigene Variablen sind erlaubt. Pflicht-Variablen dürfen darauf verweisen:
  `--color-primary: var(--brand-blau);`. Variablen mit `--brand-` am Anfang (nur Kleinbuchstaben, Ziffern,
  Bindestriche) bekommt auch die App, als `brandColors` (gelten hell und dunkel gleich).

---

## Vorlage zum Kopieren

Farbwerte austauschen, Namen und Aufbau so lassen (Werte = aktuelles Alpha5-Schema, hier ohne `--brand-…`-Verweise):

```css
:root {
  /* Farben – hell */
  --color-background: #f4f6fa;
  --color-surface: #ffffff;
  --color-text: #0a0c10;
  --color-text-muted: #586173;
  --color-primary: #1f5bff;
  --color-primary-text: #ffffff;
  --color-link: #1747cc;
  --color-border: #b4bdd0;
  --color-success: #15803d;
  --color-warning: #a15c00;
  --color-danger: #b91c1c;

  /* Abstände */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-xxl: 48px;

  /* Ecken-Rundung */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 999px;

  /* Schrift */
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 28px;
  --font-size-xxl: 36px;
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --max-content-width: 560px;
}

/* Farben – dunkel (wenn das Handy auf „Dunkel“ steht) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-background: #0a0c10;
    --color-surface: #151922;
    --color-text: #f4f6fa;
    --color-text-muted: #b4bdd0;
    --color-primary: #1f5bff;
    --color-primary-text: #ffffff;
    --color-link: #8db0ff;
    --color-border: #262c3a;
    --color-success: #4ade80;
    --color-warning: #ffb020;
    --color-danger: #f87171;
  }
}

/* Farben – dunkel, per Umschalter erzwungen (gleiche Werte wie oben) */
:root[data-theme='dark'] {
  --color-background: #0a0c10;
  --color-surface: #151922;
  --color-text: #f4f6fa;
  --color-text-muted: #b4bdd0;
  --color-primary: #1f5bff;
  --color-primary-text: #ffffff;
  --color-link: #8db0ff;
  --color-border: #262c3a;
  --color-success: #4ade80;
  --color-warning: #ffb020;
  --color-danger: #f87171;
}
```

---

## Eure eigene `style.css` einspielen

### Variante 1 (empfohlen): mit Claude Code

Funktioniert auch, wenn eure Datei **ganz andere Variablennamen** hat (z. B. von einer Designerin oder aus
einem Design-Tool).

1. In der Claude-App den Tab **Code** öffnen → **neue Sitzung** → euer Repository wählen.
2. Die Datei `style.css` anhängen (Büroklammer bzw. **+**) **oder** ihren Inhalt in die Nachricht einfügen.
3. Dazu schreiben: **„Übernimm diese style.css als Farbschema.“**
4. Claude ordnet eure Farben den Pflicht-Variablen zu, ergänzt fehlende Werte (z. B. Dunkelmodus) und fragt
   nach, wenn etwas unklar ist. Danach erzeugt Claude die App-Tokens und öffnet einen **Pull Request**.
5. Im Pull Request auf die **Vercel-Vorschau-Links** tippen (App und Website) und am Handy anschauen –
   einmal im hellen und einmal im dunklen Modus des Handys.
6. Gefällt es: in der GitHub-App **Merge pull request**.

### Variante 2: Datei selbst bei GitHub hochladen

Nur geeignet, wenn ihr **nur Farbwerte austauschen** wollt. Voraussetzungen:

- Es werden **genau die Variablennamen** aus der Vorlage oben verwendet.
- In `theme.css` kommen **nur die Variablen-Blöcke** (`:root { … }` und die beiden Dunkelmodus-Blöcke) –
  **keine anderen Regeln** (z. B. für `body`, `.button`, `h1`), denn die würden die ganze Website verändern.
- **Kein `@import` von Web-Schriften** (z. B. Google Fonts). Das lädt Schriften von fremden Servern und überträgt
  dabei die IP-Adresse der Besucher – ein Datenschutz-Problem (DSGVO).

Ist eure `style.css` eine **komplette Datei** mit eigenen Namen, weiteren Regeln oder Schriften, nehmt lieber
**Variante 1**. Claude übernimmt dann nur das Passende.

**2a – Inhalt einfügen (am einfachsten am Handy):**

1. Im Handy-Browser **github.com** → euer Repository öffnen. Fehlen Menüpunkte: Browser-Menü (⋯ bzw. ⋮) →
   **„Desktop-Website anfordern“**.
2. Ordner **`packages`** → **`ui`** → Datei **`theme.css`** antippen.
3. Oben rechts auf den **Stift** (Edit this file) tippen.
4. Den ganzen Inhalt markieren und löschen, dann **nur die Variablen-Blöcke** aus eurer `style.css` einfügen
   (am einfachsten: die Vorlage oben kopieren und darin eure Farbwerte eintragen).
5. **Commit changes…** tippen → **„Create a new branch for this commit and start a pull request“** wählen →
   **Propose changes** → **Create pull request**.

**2b – Datei hochladen:**

1. Nur wenn die Datei **ausschließlich** die Variablen-Blöcke enthält (siehe Voraussetzungen): Datei auf dem Handy
   vorher in **`theme.css`** umbenennen (Dateien-App: lange drücken → Umbenennen).
2. Wie oben bis in den Ordner **`packages/ui`** gehen.
3. **Add file** → **Upload files** → **choose your files** → `theme.css` auswählen.
4. Unten **„Create a new branch for this commit and start a pull request“** wählen → **Propose changes** →
   **Create pull request**.

**Danach (2a und 2b):** Im Pull Request läuft `ci`. Der Schritt **„Farbschema prüfen“** wird fast immer
**rot** – das ist normal, denn die App-Tokens müssen aus der neuen Datei erst erzeugt werden. Steht dort
„Pflicht-Variable … fehlt“ oder „keine gültige Farbe“, ist in der Datei selbst etwas falsch.

So geht es weiter: Claude-Code-Sitzung öffnen und schreiben:
**„Im Pull Request #… habe ich theme.css geändert. Erzeuge die Design-Tokens neu und behebe Fehler.“**
Claude ergänzt den Pull Request, `ci` wird grün, die Vorschau-Links zeigen die neuen Farben.

---

## Hinweise für ein gutes Farbschema

- **Kontrast:** Normaler Text braucht mindestens **4,5 : 1** Kontrast zum Hintergrund (WCAG AA), große oder fette
  Schrift mindestens **3 : 1**. Das gilt für `--color-text`, `--color-text-muted`, `--color-link` und
  `--color-primary-text` auf `--color-primary` – **hell und dunkel**. Prüfen geht z. B. mit einem „Contrast Checker“ im Browser, oder
  Claude in der Sitzung bitten: „Prüf die Kontraste.“
  _Beispiel Alpha5:_ Weiß auf Blau `#1f5bff` erreicht 5,3 : 1 (gut), Blau als Text auf Schwarz nur 3,7 : 1 –
  deshalb haben Links eine eigene Farbe `--color-link` (dunkel himmel `#8db0ff`, siehe „Marke Alpha5“).
- **Immer hell und dunkel festlegen.** Viele Menschen nutzen den Dunkelmodus, gerade abends beim Training.
- **Schriften:** Die Landingpage und die Rechtsseiten nutzen **Archivo** (variabel, mit Breiten-Achse),
  **selbst gehostet** über `next/font/local` (`apps/web/src/app/fonts/`, OFL) – kein Nachladen von Google Fonts
  (DSGVO). App und Redaktionsbereich nutzen weiter die Systemschrift.
- **Signalfarben** (`success`, `warning`, `danger`) sollten klar unterscheidbar bleiben – auch für Menschen mit
  Rot-Grün-Schwäche. Nie nur über die Farbe informieren, immer auch mit Text oder Symbol.

---

## Für Entwickler (Kurzfassung)

| Befehl                                      | Wirkung                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @fitnessapp/ui tokens`       | erzeugt `packages/ui/src/tokens.generated.ts` aus `theme.css`                                                     |
| `pnpm --filter @fitnessapp/ui tokens:check` | Exit-Code 1, wenn beide nicht zusammenpassen (eigener Schritt in `ci`; zusätzlich prüft ein Vitest-Test dasselbe) |

- Parser: `packages/ui/scripts/theme-parser.mjs` (ohne Abhängigkeiten, getestet in `theme-parser.test.mjs`).
- Website: `apps/web/src/app/layout.tsx` importiert `@fitnessapp/ui/theme.css`; Seiten nutzen nur `var(--…)`.
- App: nutzt weiter `colors`, `spacing`, `radius`, `fontSize`, `fontWeight`, `maxContentWidth` aus `@fitnessapp/ui`.
- In der App landen die Pflicht-Variablen (`colors`, …) und die Markenfarben `--brand-…` (`brandColors`).
  Weitere Variablen kann nur die Website nutzen.
- `pnpm --filter @fitnessapp/ui icons` erzeugt alle Icons aus `packages/ui/brand/alpha5-mark.svg` (siehe oben).

---

## App: Schrift und Willkommensseite

- **Schrift Archivo** (OFL) wie auf der Landingpage, ohne Verbindung zu Google:
  - App im Browser: `apps/mobile/public/fonts/archivo-latin-wdth-normal.woff2`, eingebunden in
    `apps/mobile/public/index.html` (gilt für alle Texte). Große Überschriften schmal (Breite 75, Stärke 800).
  - iPhone/Android: `apps/mobile/assets/fonts/Archivo-Bold.ttf` über `expo-font`, nur für Überschriften.
  - Stile: `apps/mobile/src/lib/fonts.ts`.
- **Logo in der App:** `apps/mobile/src/components/brand.tsx` (`Alpha5Mark`, Pfade aus `alpha5-mark.svg`,
  über `react-native-svg`).
- **Willkommensseite** (`apps/mobile/src/app/welcome.tsx`): immer dunkel (Schwarz mit blauem Schein, wie
  Startbildschirm und Landingpage-Hero). Nutzenpunkte sind eine Liste mit Häkchen – bewusst keine Karten mit
  Rahmen, damit nichts wie ein Knopf aussieht. Noch nicht verfügbare Funktionen tragen die Plakette „Bald“.
- **Testmodus-Hinweis:** dezente Plakette (hell: Eisblau, dunkel: Graphit) statt Leiste mit Signal-Linie.
