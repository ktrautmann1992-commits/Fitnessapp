# Farben und Design – eine Datei für Website und App

Alle Farben, Abstände, Ecken-Rundungen und Schriftgrößen stehen in **einer einzigen Datei**:

**`packages/ui/theme.css`**

Wer das Aussehen ändern will, ändert nur diese Datei. Alles andere passt sich an.

> **Stand jetzt:** Die Datei enthält ein **Platzhalter-Farbschema** (Grün auf Hellgrau, dazu ein Dunkelmodus).
> Es wird durch eure eigene `style.css` ersetzt – wie das geht, steht unten.

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
| `--color-primary`      | Hauptfarbe: Buttons, Links, Hervorhebungen                    |
| `--color-primary-text` | Schrift **auf** der Hauptfarbe (z. B. Text im Button)         |
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
- Zusätzliche eigene Variablen (z. B. `--brand-green`) sind erlaubt. Pflicht-Variablen dürfen darauf verweisen:
  `--color-primary: var(--brand-green);`

---

## Vorlage zum Kopieren

Farbwerte austauschen, Namen und Aufbau so lassen:

```css
:root {
  /* Farben – hell */
  --color-background: #f7f8fa;
  --color-surface: #ffffff;
  --color-text: #111827;
  --color-text-muted: #4b5563;
  --color-primary: #0f9d58;
  --color-primary-text: #ffffff;
  --color-border: #e5e7eb;
  --color-success: #15803d;
  --color-warning: #b45309;
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
    --color-background: #0b0f14;
    --color-surface: #151b23;
    --color-text: #f3f4f6;
    --color-text-muted: #9ca3af;
    --color-primary: #34d399;
    --color-primary-text: #04130c;
    --color-border: #253041;
    --color-success: #4ade80;
    --color-warning: #fbbf24;
    --color-danger: #f87171;
  }
}

/* Farben – dunkel, per Umschalter erzwungen (gleiche Werte wie oben) */
:root[data-theme='dark'] {
  --color-background: #0b0f14;
  --color-surface: #151b23;
  --color-text: #f3f4f6;
  --color-text-muted: #9ca3af;
  --color-primary: #34d399;
  --color-primary-text: #04130c;
  --color-border: #253041;
  --color-success: #4ade80;
  --color-warning: #fbbf24;
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
  Schrift mindestens **3 : 1**. Das gilt für `--color-text`, `--color-text-muted` und `--color-primary-text`
  auf `--color-primary` – **hell und dunkel**. Prüfen geht z. B. mit einem „Contrast Checker“ im Browser, oder
  Claude in der Sitzung bitten: „Prüf die Kontraste.“
  _Beispiel aus dem Platzhalter:_ Weiß auf dem hellen Grün erreicht nur ca. 3,5 : 1 – reicht für große, fette
  Button-Schrift, aber nicht für kleinen Text.
- **Immer hell und dunkel festlegen.** Viele Menschen nutzen den Dunkelmodus, gerade abends beim Training.
- **Keine Web-Schriften nötig.** Website und App nutzen die Systemschrift des Geräts (schnell, gut lesbar).
  Eine eigene Schrift ist später möglich, muss aber für App und Website getrennt und **selbst gehostet** eingebunden
  werden (kein Nachladen von Google Fonts o. Ä. wegen DSGVO).
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
- Nur die Pflicht-Variablen landen in der App. Weitere Variablen kann nur die Website nutzen.
