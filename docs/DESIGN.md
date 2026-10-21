# Farben und Design – eine Datei für Website und App

Alle Farben, Abstände, Ecken-Rundungen und Schriftgrößen stehen in **einer einzigen Datei**:

**`packages/ui/theme.css`**

Wer das Aussehen ändern will, ändert nur diese Datei. Alles andere passt sich an.

> **Stand jetzt:** Die Datei enthält das Farbschema der Marke **Alpha5** („Nacht & Kobalt“: Blau und Schwarz)
> aus [`docs/ALPHA5-PAKET.md`](ALPHA5-PAKET.md). Zuordnung und Kontraste: Abschnitt „Marke Alpha5“ unten.
> Seit 20.10.2026 dazu das **neue App-Design** (Bereichsfarben, Plus Jakarta Sans, Kacheln): Abschnitt
> „Neues App-Design“ unten.

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
| `--color-caution`      | `#eab308` (Gelb)           | `#fde047`              | nur Fläche, nie Text (auf Weiß 1,9 : 1)           |
| `--color-danger`       | `#b91c1c` (rot)            | `#f87171`              | hell 6,5 (auf Weiß) · dunkel 6,4 (Karte)          |

Bewusste Entscheidungen:

- **Primär bleibt hell und dunkel Blau `#1f5bff` mit weißer Schrift** (5,3 : 1). Als Fläche auf Schwarz reicht
  Blau (3,7 : 1, Mindestwert für Bedienelemente 3 : 1), als **Text** auf Schwarz nicht. Darum gibt es
  `--color-link` für Links und Text in Hauptfarbe: hell blau-dunkel `#1747cc`, dunkel himmel `#8db0ff`.
  `--color-primary` nie als Textfarbe auf dem Hintergrund verwenden.
- **Signal `#ffb020` ist auf Hell als Text nicht lesbar** (1,7 : 1). Im hellen Modus ist die Warnfarbe daher ein
  abgedunkeltes Signal-Orange `#a15c00`; im Dunkelmodus Signal selbst.
- **Gelb `caution` nur als Fläche** (Etappe Z4, Erreichbarkeits-Ampel beim Abnehmziel, Stufe „ehrgeizig“): Gelb hat auf
  Weiß zu wenig Kontrast für Text. Texte daneben stehen immer in `--color-text`; der Zeiger der Ampel hat einen Rahmen
  in Textfarbe (≥ 3 : 1, WCAG 1.4.11). Die vier Ampel-Stufen nutzen `danger` (rot), `warning` (orange), `caution`
  (gelb) und `success` (grün), immer zusätzlich mit Wort und Zeichen.
- **Grün und Rot gibt es in der Palette nicht.** `success` und `danger` bleiben Grün und Rot, damit „erledigt“,
  „Achtung“ und „Fehler/löschen“ klar unterscheidbar sind (immer zusätzlich mit Text, nie nur über die Farbe).

### Muskelkarte (Übungen, 20.10.2026)

Eigene, selbst gezeichnete Körper-Silhouette (vorn und hinten, `react-native-svg`, gleich auf Web und Handy) – keine
fremden Vorlagen oder Bilder. Umrisse: `apps/mobile/src/lib/muscle-map-paths.ts` (nur linke Hälfte, gespiegelt =
symmetrisch), Baustein: `apps/mobile/src/components/muscle-map.tsx`, Zuordnung Muskel → Ansicht:
`packages/core/src/content/muscle-map.ts`.

| Stufe                    | Hell                   | Dunkel                    |
| ------------------------ | ---------------------- | ------------------------- |
| Hauptmuskeln             | blau `#1f5bff`         | `#4d7dff`                 |
| Mitbeteiligt             | himmel `#8db0ff`       | `#3b5bab`                 |
| Nicht beansprucht        | `#c9d0dc`              | `#363e4f`                 |
| Körper                   | `#e7ebf2`              | `#1d222d`                 |
| Trennlinien der Regionen | weiß `#ffffff` (Karte) | graphit `#151922` (Karte) |

- **Farbe nie allein:** Unter der Karte steht immer die Legende in Worten („Hauptmuskeln: Brust“, „Mitbeteiligt:
  Trizeps, vordere Schulter“) mit Farbfeld; Screenreader lesen „Trainiert vor allem: … Mitbeteiligt: …“.
- **Groß** im Übungsdetail (zwei Ansichten, je 260 px hoch), **klein** im Trainingsmodus rechts neben dem Namen
  (64 px, Tippfläche ≥ 48 px) – antippen öffnet einen Dialog mit der großen Karte.

### Übungs-Illustrationen „Ausgangsposition“ (21.10.2026, Gründer-Entscheidung B)

Eigene, einheitliche Strich-Illustrationen für **alle Übungen** – keine fremden Bilder, keine KI-Bilder. Sie werden nicht
von Hand gezeichnet, sondern von einem **Generator** aus Gelenkwinkeln erzeugt; dadurch sehen alle Bilder gleich aus und
lassen sich jederzeit ändern.

- **Figur:** stilisiert und geschlechtsneutral (Kopf als Kreis, Rumpf als Fläche, Glieder als runde Striche), immer
  gleiche Proportionen und Strichstärken (`packages/content/src/illustrations/rig.ts`). Dem Betrachter zugewandte Arme
  und Beine in voller Figurfarbe mit schmalem Rand in Kartenfarbe, abgewandte heller. Seitenansicht als Standard,
  Vorderansicht wo die Bewegung seitlich läuft (Hampelmann, Step-Jacks, Seitheben, Fliegende, Pallof Press, Seitstütz).
- **Ansichtsbox** 240 × 180, Bodenlinie bei y = 170, Inhalt waagerecht mittig. Geräte angedeutet: Hanteln, Bänder,
  Kabel in Markenblau, Möbel/Maschinen in Grau.
- **Daten:** Gelenkwinkel, Geräte und deutscher Alt-Text je Übung in `packages/content/src/illustrations/poses.ts`
  (Winkel absolut, 0° = nach vorn, 90° = nach oben; für Hände/Füße auf Griff, Bank oder Boden gibt es Zielpunkte).
- **Neu erzeugen:** `pnpm illustrations` (in der Claude-Code-Sitzung: „Erzeuge die Übungsbilder neu.“). Ausgabe:
  `apps/mobile/assets/exercise-media/<id>-start.svg` (helle Farben, zum Ansehen), `content/exercise-media/<id>.json`
  (Alt-Text, Herkunft `own_work`, Lizenz „eigene Illustration Alpha5“) und
  `apps/mobile/src/data/exercise-illustrations.generated.ts` (Vorlagen mit Farbmarken für die App). Ein Test schlägt
  fehl, wenn die eingecheckten Dateien nicht zum Generator passen, eine Übung kein Bild hat oder ein Bild über den Rand
  ragt.
- **In der App:** Übungsdetail, Karte „Ausgangsposition“ über der Muskelkarte, Screenreader liest den Alt-Text
  („Ausgangsposition: …“). Bilder sind im Bundle, kein Netzaufruf.

| Rolle                        | Hell                   | Dunkel            |
| ---------------------------- | ---------------------- | ----------------- |
| Figur (vorn)                 | graphit-hell `#262c3a` | eisblau `#e3ebff` |
| Figur (abgewandte Seite)     | `#8a93a6`              | `#7d869a`         |
| Geräte (Hantel, Band, Kabel) | blau `#1f5bff`         | `#4d7dff`         |
| Gerät hell (Handtuch, Matte) | himmel `#8db0ff`       | `#3b5bab`         |
| Möbel-Fläche                 | `#d5dbe5`              | `#2c3342`         |
| Möbel-Linie, Bank, Maschine  | `#9aa4b8`              | `#4f5a70`         |
| Bodenlinie                   | grau-dunkel `#b4bdd0`  | `#3a4254`         |
| Rand um vordere Glieder      | weiß `#ffffff` (Karte) | graphit `#151922` |

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

## Neues App-Design (Entwurf „Übersicht neu“ / „Mehr neu“, 20.10.2026)

Gründer-Freigabe: „Die Richtung passt.“ Etappe 1 (diese) liefert Tokens, Schrift und Bausteine; die Bildschirme
Übersicht, Mehr und Menüleiste werden in der nächsten Etappe darauf umgebaut.

### Bereichsfarben

Jeder Bereich hat eine dezente Farbe – **nur in Icon-Chips und kleinen Akzenten** (Kennzeile, Ring, Balken).
Texte bleiben immer in `--color-text` bzw. `--color-text-muted`. In `theme.css` als `--area-<bereich>-<rolle>`, in
der App als `areaColors[modus][bereich][rolle]` (Typ `AreaId`, Hook `useAreaColors(area)` in
`apps/mobile/src/components/design.tsx`).

Rollen: **surface** = Chip-Fläche · **icon** = Strich und Akzent-Text · **strong** = Ring/Balken kräftig ·
**soft** = Balken zart (nur Deko).

| Bereich (`AreaId`) | Hell: surface / icon / strong / soft          | Dunkel: surface / icon / strong / soft        | icon auf Karte (hell · dunkel) | strong auf Karte |
| ------------------ | --------------------------------------------- | --------------------------------------------- | ------------------------------ | ---------------- |
| `training`         | `#E3EBFF` / `#1747CC` / `#1F5BFF` / `#8DB0FF` | `#1C2A4D` / `#8DB0FF` / `#4D7DFF` / `#2E4A8F` | 7,5 · 8,2                      | 5,3 · 4,8        |
| `workouts`         | `#EDE9FE` / `#6D28D9` / `#7C3AED` / `#C4B5FD` | `#2A1F4A` / `#C4B5FD` / `#9F7AEA` / `#4C3A85` | 7,1 · 9,5                      | 5,7 · 5,4        |
| `ernaehrung`       | `#DCFCE7` / `#15803D` / `#16A34A` / `#86EFAC` | `#12321F` / `#86EFAC` / `#22C55E` / `#1F6B3D` | 5,0 · 12,5                     | 3,3 · 7,7        |
| `einkaufen`        | `#CFFAFE` / `#0E7490` / `#0891B2` / `#67E8F9` | `#0E3038` / `#67E8F9` / `#06B6D4` / `#155E6B` | 5,4 · 12,1                     | 3,7 · 7,2        |
| `ausdauer`         | `#FFEDD5` / `#C2410C` / `#EA580C` / `#FDBA74` | `#3A2312` / `#FF9A5C` / `#F97316` / `#7C3F17` | 5,2 · 8,4                      | 3,6 · 6,3        |
| `wettkampf`        | `#FDECD8` / `#C2410C` / `#EA580C` / `#FDBA74` | `#3D2614` / `#FF9A5C` / `#F97316` / `#7C3F17` | 5,2 · 8,4                      | 3,6 · 6,3        |
| `fortschritt`      | wie `training`                                | wie `training`                                | 7,5 · 8,2                      | 5,3 · 4,8        |

Regeln (geprüft in `packages/ui/src/tokens.test.ts`):

- **icon** als Text auf der Karte ≥ 4,5 : 1; als Icon auf der eigenen Chip-Fläche ≥ 3 : 1 (WCAG 1.4.11);
  **strong** auf der Karte ≥ 3 : 1; `--color-text` auf jeder Chip-Fläche ≥ 4,5 : 1. **soft** ist reine Deko.
- **Ausdauer-Orange ist keine Warnfarbe.** Signal-Orange `#ffb020` (bzw. `--color-warning`) bleibt für hohe
  Belastung und Warnungen reserviert. Ausdauer/Wettkampf nutzen ein **rötlicheres Orange** (Farbton ≥ 12° Abstand
  zu Signal und Warnung, Test „Ausdauer-Orange ist klar von Signal/Warnung getrennt“), immer nur im Chip mit
  Lauf-/Pokal-Icon, nie als Fläche einer Meldung. Warnungen kommen weiter als `Notice tone="warning"` (Rand links,
  Wort „Achtung“ o. ä.).
- Farbe nie allein: Jede Kachel hat Titel in Worten; Icons sind für Bildschirmleser ausgeblendet.

### Hero-Karte und Karten

| Token               | Hell              | Dunkel                 | Einsatz                                    |
| ------------------- | ----------------- | ---------------------- | ------------------------------------------ |
| `--hero-background` | schwarz `#0a0c10` | graphit `#151922`      | Fläche „Training heute“                    |
| `--hero-text`       | weiß              | weiß                   | Titel (19,6 bzw. 16,9 : 1)                 |
| `--hero-muted`      | `#b4bdd0`         | `#b4bdd0`              | Untertitel, „Woche 3 von 12“ (≥ 8,6 : 1)   |
| `--hero-accent`     | himmel `#8db0ff`  | himmel `#8db0ff`       | Kennzeile „TRAINING HEUTE“ (≥ 7,6 : 1)     |
| `--hero-border`     | wie Fläche        | graphit-hell `#262c3a` | Rand – hebt die Karte im Dunkelmodus ab    |
| `--card-border`     | `#e3e7ef`         | graphit-hell `#262c3a` | zarter Kartenrand (Deko, kein Feld-Rahmen) |
| `--card-divider`    | `#eef1f6`         | `#1f2430`              | Trennlinien zwischen `ListRow`-Zeilen      |

Maße aus dem Entwurf: Karten weiß, **Radius 20** (`radius.lg`), Rand 1 px `--card-border`, Polster 16; Icon-Chip
36/40 px mit Radius 12 (`radius.md`), 52 px mit Radius 16; Hero-Polster 20, Pillen-Knopf **52 px** hoch, Schrift 17/700.
Abschnitts-Überschriften 13 px, fett, Großbuchstaben, Sperrung 0,8, grau.

Hinweis Kontrast: Der zarte Kartenrand erreicht keine 3 : 1 (WCAG 1.4.11). Er ist Deko – antippbare Kacheln sind
zusätzlich über Titel, Pfeil (`row`) bzw. Fläche erkennbar. Eingabefelder behalten `--color-border` (siehe „Offener
Punkt: Rahmenkontrast“).

### Schrift: Plus Jakarta Sans

- `--font-family-base: 'Plus Jakarta Sans', system-ui, …` → App `fontFamily.base`. Stärken 400/600/700/**800**
  (`--font-weight-extrabold`, neu), neue Größe `--font-size-xs: 13px`.
- **Lokal ausgeliefert, kein Google-Fonts-Server (DSGVO):**
  - App im Browser: `apps/mobile/public/fonts/plus-jakarta-sans-latin-wght-normal.woff2` (variabel 200–800, aus
    `@fontsource-variable/plus-jakarta-sans` 5.3.0), `@font-face` in `apps/mobile/public/index.html` für alle Texte.
  - iPhone/Android: `@expo-google-fonts/plus-jakarta-sans` 0.4.2 – nur die vier Schnitte, einzeln per `require`
    (`use-brand-fonts.native.ts`). Startbildschirm bleibt, bis die Schrift geladen ist; bei Fehler oder nach 3 s
    startet die App mit Systemschrift (kein Hänger).
  - Lizenz SIL OFL 1.1: `apps/mobile/public/fonts/OFL-PlusJakartaSans.txt`, Seite „Lizenzen und Quellen“ (App und
    Website).
- In Bausteinen: `appFont('regular' | 'semibold' | 'bold' | 'extrabold')` aus `apps/mobile/src/lib/fonts.ts`
  **nach** dem eigenen Stil anhängen (iPhone/Android brauchen je Stärke einen eigenen Schriftnamen).
  `displayFont()` = ExtraBold mit Sperrung −0,5 für Bildschirmtitel und große Zahlen.
- Website (Landingpage) und Druckansichten bleiben bei **Archivo**.

### Umgesetzte Bildschirme (Etappe 2)

Menüleiste, Übersicht und Mehr nutzen die Bausteine (Details: `docs/PLAN-DASHBOARD.md` Abschnitt 10). Zuordnung
Bereich → Farbe/Icon zentral in `apps/mobile/src/lib/area-style.ts`. Aktiver Menüknopf: Pille in `surface`, Icon und
Beschriftung in `icon` der Bereichsfarbe. Kennzeilen und Abschnitts-Überschriften stehen nur per Stil
(`textTransform: 'uppercase'`) in Großbuchstaben – Bildschirmleser lesen den normalen Text.

### Bereiche im neuen Design (Etappe 3)

- **Seitenkopf:** `Screen` nimmt `area` und `icon` – Icon-Chip (40 px) in der Bereichsfarbe neben dem Titel. Training,
  Kalender, Woche, Verlauf-Unterseiten blau; Ernährung, Rezepte, Meal-Prep grün; Workouts und Timer violett;
  Einkaufen türkis; Ausdauer und Wettkampf orange; Fortschritt blau; Einstellungen, Konto, Ratgeber, Lizenzen in
  Markenblau. Onboarding und Einwilligungen bleiben ohne Chip.
- **Schrift überall:** `components/text.tsx` ersetzt `Text` aus react-native in allen Bildschirmen und hängt auf
  iPhone/Android den passenden Jakarta-Schnitt zur Stärke an (`fontWeightName` → `appFont`). Neue Bildschirme
  importieren `Text` aus `@/components/text`.
- **Karten:** `useThemeColors()` liefert zusätzlich `cardBorder` und `divider` (`--card-…`). Inhalts-Karten (Mahlzeiten,
  Rezepte, Workouts, Ratgeber, Meal-Prep, Listenzeilen) nutzen `cardBorder` und Radius 20 bzw. 16; Eingabefelder,
  Auswahlknöpfe und Rahmen von Bedienelementen bleiben bei `--color-border`.
- **Training:** Kopf der Einheit auf „Heute“ als Hero-Karte (Name bleibt Überschrift), Wochenliste mit Tages-Chips
  (Einheit: Trainingsblau, Ruhetag neutral, Wort daneben), Link „Wettkampfplan“ als orange Kachel.
- **Ernährung:** Kalorien-Ring, kleine Ringe und Makro-Balken in Ernährungsgrün; Mahlzeiten ohne Ring mit Chip;
  „+“ als Icon; Rezeptkarten (Suche, Kühlschrank) mit Rezept-Chip.
- **Workouts:** Sterne in Workout-Violett, leere Sterne in Nebentext-Grau (≥ 4,5 : 1) – nicht mehr in der Warnfarbe.
  Timer: Zeit 80 px extra fett auf dunkler Fläche, Rahmen violett (Arbeit) bzw. grün (Pause), immer mit Wort;
  „Pausiert“ in Signal (auf Dunkel 10,7 : 1).
- **Einkaufen:** Häkchen-Zeilen ≥ 52 px, Kasten 30 px in Einkaufs-Türkis mit Haken-Icon; Scan-Knopf mit Symbol
  (`Button` hat dafür `icon`).
- **Ausdauer/Wettkampf:** Strecken-Skizze, Kilometer-Balken, Höhenprofil, Summen, Phasen-Band, Wochen-Chips und
  Intervall-Schritte in Orange (`strong`, Text `icon`). Die Karte (OpenStreetMap) zeichnet die Strecke weiter blau.

### Feinschliff der Bildschirme (Etappe 4, 21.10.2026)

- **Training durchführen** (`/workout/[sessionId]`): oben die **aktuelle Übung als Hero-Karte** (Kennzeile „Übung X von
  Y“, Name, „Satz X von Y · Vorgabe“), darin der Fortschritt der Einheit als Balken (`AreaProgress`, Trainingsblau,
  Rolle „Fortschrittsanzeige“). Jeder Satz als eigene Fläche (Radius 16), abgehakt in Trainingsblau plus „✓ Satz
  geschafft“; −/+ 56 px rund, Wert 28 px extra fett. Pausen-Timer unten als dunkle Fläche mit Restzeit 44 px.
  Muskelkarte und „So geht's“ in der Kachel „Übungs-Info“.
- **Rezept** (`/rezept/[id]`): Kopf-Chips (Zeit, kcal je Portion nur bei sichtbaren Zahlen, Portionen), Nährwerte als
  grüner Ring mit kcal plus `StatValue` für Eiweiß/Kohlenhydrate/Fett (der Ring ist Rahmen, kein Ziel), Zutaten als
  `ListGroup`/`ListRow` (Anzeige-Zeilen, „Austauschen“ rechts), Schritte nummeriert in Karten (`NumberChip`), Hinweise
  (Testphase, Allergene, „Enthält“, Haftung) als `Notice` mit Icon.
- **Ausdauer**: Aufzeichnen mit dunkler Fläche (Zeit 56 px, Distanz/Pace 32 px, Status in Orange bzw. „Pausiert“ in
  Signal), Start/Pause/Fortsetzen/Stopp als große Knöpfe (`AreaButton`, 64 px) in Ausdauer-Orange (Stopp als Umriss,
  immer mit Rückfrage). Auswertung: Werte-Raster in zwei Spalten, Karte, Kilometerzeiten und Höhenprofil je in einer
  Karte, „Löschen“ abgesetzt am Ende.
- **Einstellungen / Mein Konto**: Abschnitte mit `SectionLabel`, Navigation als `ListRow` (Rolle Link), Aktionen mit
  Rückfrage als `ListRow role="button"`. Destruktive Aktionen (Konto löschen, Testdaten löschen) als `ListRow
tone="danger"` – rot, fett, Papierkorb-Icon, in eigener Gruppe am Ende.

### Bausteine (`apps/mobile/src/components/design.tsx`)

| Baustein       | Props (Auszug)                                                                                                                                                                                                                                                                                                   | Barrierefreiheit                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `Icon`         | `name` (`IconName`: dumbbell, stopwatch, utensils, cart, run, trophy, trend, grid, dots, book, recipe, box, settings, info, edit, chevron, play, bar-menu, plus, check, calendar, pause, stop, trash, download, shield, logout, swap, alert, bell, map …), `size`, `color`, `strokeWidth`, `accessibilityLabel?` | Deko (ausgeblendet); mit Label Rolle „Bild“         |
| `IconChip`     | `area`, `icon`, `size` 36/40/52                                                                                                                                                                                                                                                                                  | Deko                                                |
| `SectionLabel` | `children` (Text), `level` 2/3                                                                                                                                                                                                                                                                                   | Überschrift                                         |
| `Tile`         | `area`, `icon`, `title`, `subtitle?`, `eyebrow?`, `variant` header/stacked/row, `onPress?`, `role` button/link, `children`                                                                                                                                                                                       | ganz antippbar; Name = Kennzeile, Titel, Untertitel |
| `HeroCard`     | `eyebrow`, `eyebrowIcon?`, `meta?`, `title`, `subtitle?`, `actionLabel?`, `onAction?`, `actionIcon`, `actionRole`, `children`                                                                                                                                                                                    | Kennzeile = Überschrift; Knopf 52 px                |
| `ListGroup`    | `children`                                                                                                                                                                                                                                                                                                       | –                                                   |
| `ListRow`      | `icon?`, `label`, `description?`, `onPress?` (ohne: Anzeige-Zeile), `role` (Standard link), `tone` default/danger, `trailing?`, `disabled`, `last`                                                                                                                                                               | ≥ 44 px (52), Name = Text + Beschreibung            |
| `IconButton`   | `icon`, `accessibilityLabel` (Pflicht), `onPress`                                                                                                                                                                                                                                                                | 44 × 44 px                                          |
| `StatValue`    | `value`, `label`, `size` md (20 px)/lg (22 px), `accessibilityLabel?`, `valueTestID?`                                                                                                                                                                                                                            | Zahl und Beschriftung zusammen                      |
| `ProgressRing` | `size`, `stroke`, `fraction`, `overFraction?`, `color?`, `trackColor?`, `children`                                                                                                                                                                                                                               | Grafik ausgeblendet, Ansage setzt der Rahmen        |
| `MiniBars`     | `values` (0–1), `area`, `highlightIndex?`, `height`, `accessibilityLabel` (Pflicht)                                                                                                                                                                                                                              | Rolle „Bild“ mit Ansage                             |
| `AreaProgress` | `area`, `current`, `total`, `accessibilityLabel` (Pflicht), `onDark`                                                                                                                                                                                                                                             | Rolle „Fortschrittsanzeige“ mit Wert                |
| `AreaButton`   | `area`, `label`, `onPress`, `icon?`, `variant` filled/outline                                                                                                                                                                                                                                                    | Knopf 64 px; hell Weiß auf `icon`, dunkel Schwarz   |
| `NumberChip`   | `area`, `value`                                                                                                                                                                                                                                                                                                  | Deko (Zahl steht im Namen der Zeile)                |

- `ProgressRing` ist derselbe Baustein wie im Kalorien-Ring (aus `nutrition-day-overview.tsx` hierher verschoben,
  dort weiter exportiert). Werte (Anteile, Kilometer) rechnet immer der Aufrufer bzw. `packages/core`.
- `ui.tsx` (gleiche API, `Notice` zusätzlich mit `icon?`): `Heading` 1 = 26/800, `Heading` 2 = 20/700, alle Texte in Jakarta; `Card` Radius 20 mit
  `--card-border`; `Button` 52 px hoch, Schrift 17/700.
- Tests: `design.test.tsx`, `ui.test.tsx` (Vitest-Gruppe „components“: react-native-web in happy-dom, Helfer
  `src/test/render.tsx`).

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
| `--color-caution`      | Gelb, nur als Fläche (Ampel „ehrgeizig“), nie als Textfarbe   |
| `--color-danger`       | Fehler, „löschen“                                             |

Erlaubte Schreibweisen: `#1A2B3C`, `#ABC`, `#1A2B3C80` (mit Transparenz), `rgb(…)`, `rgba(…)`, `hsl(…)`, `hsla(…)`.

**Freiwillige Variablen** (keine Pflicht; fehlen sie, fehlen sie auch in der App): `--font-size-xs`,
`--font-weight-extrabold`, `--font-family-<name>`, `--area-<bereich>-<rolle>`, `--hero-<rolle>`, `--card-<rolle>`
(die letzten drei hell und dunkel, siehe „Neues App-Design“).
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
  --color-caution: #eab308;
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
    --color-caution: #fde047;
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
  --color-caution: #fde047;
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
  (DSGVO). Die App nutzt **Plus Jakarta Sans**, ebenfalls lokal (siehe „Neues App-Design“); der Redaktionsbereich
  die Systemschrift.
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
- App: nutzt `colors`, `spacing`, `radius`, `fontSize`, `fontWeight`, `maxContentWidth` aus `@fitnessapp/ui`, dazu
  `areaColors` (Typ `AreaId`, `AreaPalette`), `heroColors`, `cardColors`, `largeViewColors`, `fontFamily`.
- **„Große Ansicht“** (docs/PLAN-FIT-IM-ALTER.md 12, Etappe FA5): `--large-text`, `--large-text-muted`, `--large-link`
  (→ `largeViewColors`) ersetzen in der App `text`, `textMuted` und `link`, sobald die große Ansicht an ist. Pflicht:
  mindestens **7 : 1** (WCAG AAA) auf `--color-background` und `--color-surface`, hell und dunkel –
  `packages/ui/src/tokens.test.ts` prüft das. Schrift ×1,25 (Grundschrift 20 px), Tippflächen mindestens 56 px
  (Werte in `packages/core/src/constants.ts`, `LARGE_VIEW`).
- In der App landen die Pflicht-Variablen (`colors`, …) und die Markenfarben `--brand-…` (`brandColors`).
  Weitere Variablen kann nur die Website nutzen.
- `pnpm --filter @fitnessapp/ui icons` erzeugt alle Icons aus `packages/ui/brand/alpha5-mark.svg` (siehe oben).

---

## App: Schrift und Willkommensseite

- **Schrift seit 20.10.2026 Plus Jakarta Sans** (siehe „Neues App-Design“), Stile in `apps/mobile/src/lib/fonts.ts`.
  Archivo liegt in der App nur noch für die Druck-Vorschau im Browser (`public/fonts/archivo-latin-wdth-normal.woff2`,
  Lizenz `public/fonts/OFL-Archivo.txt`).
- **Logo in der App:** `apps/mobile/src/components/brand.tsx` (`Alpha5Mark`, Pfade aus `alpha5-mark.svg`,
  über `react-native-svg`).
- **Willkommensseite** (`apps/mobile/src/app/welcome.tsx`): immer dunkel (Schwarz mit blauem Schein, wie
  Startbildschirm und Landingpage-Hero). Nutzenpunkte sind eine Liste mit Häkchen – bewusst keine Karten mit
  Rahmen, damit nichts wie ein Knopf aussieht. Noch nicht verfügbare Funktionen tragen die Plakette „Bald“.
- **Testmodus-Hinweis:** dezente Plakette (hell: Eisblau, dunkel: Graphit) statt Leiste mit Signal-Linie.

---

## App: Kalorien-Ring und Mahlzeiten-Karten (Ernährung, 20.10.2026)

Bausteine in `apps/mobile/src/components/nutrition-day-overview.tsx` (eigenes Alpha5-Design – kein fremdes Vorbild
kopiert; `ProgressRing` liegt seit 20.10.2026 in `components/design.tsx` und hat zusätzlich `color`/`trackColor`):

- **`ProgressRing`** (react-native-svg): Spur in `--color-border`, Füllung in `--color-primary` ab 12 Uhr im
  Uhrzeigersinn, abgerundete Enden. Über dem Ziel eine **zweite Runde in `--color-text`** (neutral, kein Rot/Orange –
  „zu viel“ ist keine Warnung). Die Grafik ist für Bildschirmleser ausgeblendet; die Ansage kommt in Worten vom Rahmen
  („1.391 kcal übrig von 2.869 kcal Tagesziel“). Groß 152 px (Strich 12), klein 44 px (Strich 5).
- **`DayOverviewCard`**: Karte „Übersicht“ – links „Gegessen“, Mitte Ring mit Zahl (`displayFont`, `--font-size-xl`) und
  „übrig“/„zu viel“, rechts „Verbrannt“ bzw. „Ziel“; darunter drei Makro-Balken nebeneinander (8 px hoch, Spur
  `--color-border`, Füllung `--color-primary`, Text „47 / 222 g“ in `--color-text-muted`).
- **`MealCard`**: Karte je Mahlzeit mit kleinem Ring, Titel, „317 / 606 kcal“, Vorschau (2 Zeilen) und rundem
  **„+“-Knopf** (48 × 48 px, `--color-primary`, Zeichen in `--color-primary-text`).
- Farbe nie allein: jede Zahl steht zusätzlich als Text daneben. Alle Werte rechnet `packages/core`
  (`nutrition/day-ring.ts`); die Bausteine zeigen nur an.
