# ALPHA5-PAKET – Marke, App-Icons und Landingpage

Diese Datei enthält alles, was Claude Code braucht. Der Nutzer arbeitet nur am Handy:
nichts lokal ausführen lassen, alles selbst erzeugen, committen und als Pull Request liefern.

## Aufgaben für Claude Code (in dieser Reihenfolge)

1. **Name:** Die App heißt **Alpha5**. Ersetze im ganzen Repository den Platzhalter `[APP-NAME]` und den Arbeitstitel `Kadenz` durch `Alpha5`.
2. **Marke anlegen:** Speichere das Logo aus Abschnitt „Logo“ unverändert als `packages/ui/brand/alpha5-mark.svg`. Lege die Farben aus Abschnitt „Farben“ als Design-Tokens in `packages/ui` an (für App und Web).
3. **Icons erzeugen:** Schreibe `packages/ui/brand/generate-icons.mjs` (Node, `sharp`), das aus `alpha5-mark.svg` alle Dateien aus Abschnitt „Icons“ erzeugt. Führe das Skript in deiner Sitzung aus und committe die erzeugten Dateien. Prüfe die Ergebnisse visuell (Bild öffnen), bevor du committest.
4. **Icons einbinden:** `icon.png` und `adaptive-icon.png` in `apps/mobile/assets`, Eintrag in `app.json` (Android-Hintergrundfarbe `#0a0c10`), Splash-Screen mit dem Logo auf `#0a0c10`. Favicon und Apple-Touch-Icon in `apps/web` und im Web-Export der App.
5. **Landingpage:** Baue die Seite aus Abschnitt „Landingpage“ als Startseite in `apps/web` (Next.js) nach – Design, Texte, Farben und Abstände exakt. Das Logo in der Kopfzeile nutzt `alpha5-mark.svg`. Die interaktive Beispiel-Einheit als React-Komponente. Schrift Archivo selbst hosten (next/font), keine Verbindung zu Google zur Laufzeit.
6. **Warteliste:** Supabase-Tabelle `waitlist` (email, consent_text_version, created_at, confirmed_at), RLS: öffentlich nur Einfügen. Double-Opt-in per Bestätigungsmail, Spamschutz (Rate-Limit, Honeypot). Klick-Schritte für den Handy-Browser in `docs/SETUP.md`, welchen E-Mail-Dienst ich einrichten muss.
7. **Rechtliches:** Seiten `/impressum`, `/datenschutz`, `/agb` mit klar markierten Platzhaltern.
8. **SEO:** Title, Description, Open-Graph-Bild (1200 × 630, Logo auf `#0a0c10`), `sitemap.xml`, `robots.txt`.
9. **Aufräumen:** Falls im Hauptverzeichnis alte Entwurfsdateien liegen (`index.html`, `styles.css`, Icon-Dateien, `LANDINGPAGE-ANLEITUNG.md`), nach `docs/archiv/` verschieben. Diese Datei nach `docs/ALPHA5-PAKET.md` verschieben.

Zuerst Plan in einfachen Worten zeigen und auf Freigabe warten. Ergebnis als Pull Request mit „So testest du es am Handy“.

---

## Farben

| Token | Hex | Einsatz |
|---|---|---|
| schwarz | #0a0c10 | Text, Kopfzeile, dunkle Flächen, Icon-Hintergrund |
| graphit | #151922 | Karten auf Schwarz |
| graphit-hell | #262c3a | Linien auf Dunkel |
| blau | #1f5bff | Logo, Buttons, Akzente |
| blau-dunkel | #1747cc | Hover |
| himmel | #8db0ff | heller Text auf Schwarz |
| eisblau | #e3ebff | helle Flächen |
| hell | #f4f6fa | Seitenhintergrund |
| grau | #586173 | Nebentext auf Hell |
| grau-dunkel | #b4bdd0 | Nebentext auf Dunkel |
| signal | #ffb020 | nur hohe Belastung und Fehlermeldungen |

Schriften: Logo = Vektorform unten (basiert auf Fira Sans ExtraBold Italic, OFL). Oberfläche = Archivo.

## Logo

α5, komplett blau. Als Vektor, darf nicht durch Text ersetzt werden.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1133 697">
  <path fill="#1f5bff" d="M402 263 430 145H579L470 416L481 513Q484 538 495.5 550.0Q507 562 530 565L460 696Q359 684 350 601L348 576Q314 638 273.0 667.5Q232 697 176 697Q96 697 48.0 641.5Q0 586 0 483Q0 399 27.5 317.5Q55 236 114.5 181.5Q174 127 265 127Q389 127 402 263ZM176 480Q176 527 188.5 547.5Q201 568 227 568Q258 568 286.5 530.5Q315 493 343 402Q339 320 324.0 287.5Q309 255 277 255Q243 255 220.0 295.0Q197 335 186.5 388.0Q176 441 176 480Z"/>
  <path fill="#1f5bff" d="M1096 126H861L843 251Q888 229 942 229Q1016 229 1061.0 278.0Q1106 327 1106 417Q1106 480 1074.5 544.5Q1043 609 974.5 653.0Q906 697 802 697Q662 697 582 591L688 501Q736 564 807 564Q862 564 894.5 526.0Q927 488 927 427Q927 349 857 349Q836 349 817.0 354.0Q798 359 775 373H657L709 0H1133Z"/>
</svg>
```

## Icons

Logo immer waagerecht und senkrecht zentriert. „Breite“ = Anteil der Logo-Breite an der Kantenlänge.

| Datei | Größe | Hintergrund | Logo-Breite |
|---|---|---|---|
| icon.png | 1024 × 1024 | #0a0c10 + weicher blauer Schein in der Mitte (radialer Verlauf #1f5bff, 28 % Deckkraft innen, 0 % außen) | 66 % |
| adaptive-icon.png | 1024 × 1024 | transparent (Android-Vordergrund) | 50 % |
| splash-icon.png | 1024 × 1024 | transparent | 50 % |
| favicon.svg | 64 × 64 | #0a0c10 | 84 % |
| favicon.png | 48 × 48 | #0a0c10 | 84 % |
| apple-touch-icon.png | 180 × 180 | #0a0c10 | 70 % |
| og-image.png | 1200 × 630 | #0a0c10 + Schein | 30 %, darunter „Training und Ernährung, die zu dir passen.“ in Weiß |

icon.png ohne Transparenz und ohne abgerundete Ecken (die Stores runden selbst).

## Landingpage

### index.html (Entwurf)
```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alpha5 – Training und Ernährung, die zu dir passen</title>
  <meta name="description" content="Alpha5 erstellt deinen Trainingsplan aus deinem Ziel, deiner Zeit und deinem Equipment. Im Studio oder zu Hause, vom ersten Workout bis zum Marathon.">
  <meta name="theme-color" content="#0a0c10">
  <!-- Nur für die Vorschau. Vor dem Livegang Schrift selbst hosten (DSGVO). -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>

<header class="kopf">
  <div class="huelle kopf__innen">
    <a class="logo" href="#">
      <svg class="logo__alpha" viewBox="0 0 1133 697" aria-hidden="true">
        <path class="mark-alpha" d="M402 263 430 145H579L470 416L481 513Q484 538 495.5 550.0Q507 562 530 565L460 696Q359 684 350 601L348 576Q314 638 273.0 667.5Q232 697 176 697Q96 697 48.0 641.5Q0 586 0 483Q0 399 27.5 317.5Q55 236 114.5 181.5Q174 127 265 127Q389 127 402 263ZM176 480Q176 527 188.5 547.5Q201 568 227 568Q258 568 286.5 530.5Q315 493 343 402Q339 320 324.0 287.5Q309 255 277 255Q243 255 220.0 295.0Q197 335 186.5 388.0Q176 441 176 480Z" fill="#1f5bff"/>
        <path class="mark-fuenf" d="M1096 126H861L843 251Q888 229 942 229Q1016 229 1061.0 278.0Q1106 327 1106 417Q1106 480 1074.5 544.5Q1043 609 974.5 653.0Q906 697 802 697Q662 697 582 591L688 501Q736 564 807 564Q862 564 894.5 526.0Q927 488 927 427Q927 349 857 349Q836 349 817.0 354.0Q798 359 775 373H657L709 0H1133Z" fill="#1f5bff"/>
      </svg>
      Alpha5
    </a>
    <a class="knopf knopf--primaer" href="#warteliste">Auf die Warteliste</a>
  </div>
</header>

<main>

  <!-- HERO -->
  <section class="hero">
    <div class="huelle hero__raster">
      <div>
        <h1 class="titel-gross">Training und Ernährung, die zu dir passen.</h1>
        <p class="einleitung">Alpha5 erstellt deinen Trainingsplan aus deinem Ziel, deiner Zeit und dem Equipment, das du wirklich hast. Im Studio oder zu Hause, vom ersten Workout bis zum Marathon.</p>
        <div class="hero__knoepfe">
          <a class="knopf knopf--primaer" href="#warteliste">Auf die Warteliste</a>
          <a class="knopf knopf--leise" href="#ablauf">So funktioniert es</a>
        </div>
      </div>

      <div class="einheit" aria-label="Beispiel einer Trainingseinheit zum Ausprobieren">
        <div class="einheit__kopf">
          <div>
            <p class="einheit__name">Heute: Oberkörper A</p>
            <p class="einheit__hinweis">Beispiel zum Ausprobieren, zu Hause mit Kurzhanteln</p>
          </div>
          <span class="einheit__stand" id="stand">0 von 4</span>
        </div>

        <ul class="uebungen" id="uebungen">
          <li class="uebung" data-erledigt="false" data-alt="Liegestütze mit erhöhten Füßen">
            <button class="uebung__haken" aria-pressed="false" aria-label="Kurzhantel-Bankdrücken als erledigt markieren">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
            </button>
            <div><span class="uebung__name">Kurzhantel-Bankdrücken</span><span class="uebung__daten">3 × 10 Wdh., 22 kg</span></div>
            <button class="uebung__alt">Alternative</button>
          </li>
          <li class="uebung" data-erledigt="false" data-alt="Rudern mit Widerstandsband">
            <button class="uebung__haken" aria-pressed="false" aria-label="Einarmiges Rudern als erledigt markieren">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
            </button>
            <div><span class="uebung__name">Einarmiges Rudern</span><span class="uebung__daten">3 × 10 Wdh., 22 kg</span></div>
            <button class="uebung__alt">Alternative</button>
          </li>
          <li class="uebung" data-erledigt="false" data-alt="Pike-Liegestütze">
            <button class="uebung__haken" aria-pressed="false" aria-label="Schulterdrücken sitzend als erledigt markieren">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
            </button>
            <div><span class="uebung__name">Schulterdrücken sitzend</span><span class="uebung__daten">3 × 12 Wdh., 14 kg</span></div>
            <button class="uebung__alt">Alternative</button>
          </li>
          <li class="uebung" data-erledigt="false" data-alt="Bizepscurls mit Kettlebell">
            <button class="uebung__haken" aria-pressed="false" aria-label="Hammercurls als erledigt markieren">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>
            </button>
            <div><span class="uebung__name">Hammercurls</span><span class="uebung__daten">3 × 12 Wdh., 12 kg</span></div>
            <button class="uebung__alt">Alternative</button>
          </li>
        </ul>

        <div class="empfinden">
          <label for="rpe">Wie anstrengend war es? <span class="empfinden__wert" id="rpe-wert">6</span></label>
          <input type="range" id="rpe" min="0" max="10" value="6" aria-describedby="rpe-text">
          <p class="empfinden__text" id="rpe-text">Fordernd, aber gut machbar</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ABLAUF -->
  <section class="abschnitt abschnitt--minze" id="ablauf">
    <div class="huelle">
      <h2 class="titel">In vier Schritten zu deinem Plan</h2>
      <ol class="ablauf">
        <li>
          <h3>Profil anlegen</h3>
          <p>Geschlecht, Alter, Größe, Gewicht und ein kurzer Gesundheits-Check.</p>
        </li>
        <li>
          <h3>Ziel wählen</h3>
          <p>Fettverlust, Definition, Muskelaufbau, allgemeine Fitness oder ein Ausdauerziel mit Wettkampfdatum.</p>
        </li>
        <li>
          <h3>Zeit und Equipment angeben</h3>
          <p>Trainingstage pro Woche, Minuten pro Einheit, Studio oder zu Hause. Zu Hause gibst du genau an, was du hast: Kurzhanteln mit Gewichten, Kettlebell, Flach- oder Schrägbank.</p>
        </li>
        <li>
          <h3>Plan erhalten</h3>
          <p>Jede Woche steht fest, was du trainierst. Gewichte und Umfang passen sich an deine Leistung an.</p>
        </li>
      </ol>
    </div>
  </section>

  <!-- MVP -->
  <section class="abschnitt" id="start">
    <div class="huelle">
      <h2 class="titel">Zum Start dabei</h2>
      <p class="einleitung">Die erste Version konzentriert sich auf das, was jeden Tag zählt: ein Plan, der zu dir passt, und ein Tagebuch, aus dem dein Plan lernt.</p>

      <div class="start">
        <article class="funktion">
          <h3>Ein Profil, das dich wirklich kennt</h3>
          <p>Körperdaten, Trainingserfahrung vom Einstieg bis zum Leistungssport und ein Gesundheits-Check. Gibt es Hinweise auf Risiken, startet dein Plan behutsamer und wir empfehlen eine ärztliche Abklärung.</p>
        </article>

        <article class="funktion">
          <h3>Ziele für Kraft und Ausdauer</h3>
          <p>Wähle ein Ziel, bei Ausdauer auch deinen Wettkampf.</p>
          <ul class="ziele">
            <li>Fettverlust</li><li>Definition</li><li>Muskelaufbau</li><li>Allgemeine Fitness</li>
            <li>5 km</li><li>10 km</li><li>Halbmarathon</li><li>Marathon</li>
            <li>Triathlon</li><li>Radfahren</li><li>Schwimmen</li>
          </ul>
        </article>

        <article class="funktion">
          <h3>Dein persönlicher Trainingsplan</h3>
          <p>Übungen passend zu deinem Equipment, mit Sätzen, Wiederholungen, Zielgewicht und Pausen. Fällt eine Einheit aus, verschiebt die App sinnvoll, statt alles auf einen Tag zu stapeln. Regelmäßige leichtere Wochen sorgen für Erholung.</p>
        </article>

        <article class="funktion">
          <h3>Trainingstagebuch für jede Einheit</h3>
          <p>Hake jede Übung ab oder wähle eine Alternative. Trage Gewichte und Wiederholungen ein, beim Laufen und Radfahren Distanz und Zeit. Dein Belastungsempfinden gibst du von 0 bis 10 an. Schaffst du alle Wiederholungen, steigt das Gewicht in der nächsten Woche. Funktioniert auch ohne Netz im Studio.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- FAHRPLAN -->
  <section class="abschnitt abschnitt--tanne" id="fahrplan">
    <div class="huelle">
      <h2 class="titel">Was danach kommt</h2>
      <p class="einleitung">Diese Funktionen bauen wir Schritt für Schritt nach dem Start ein.</p>
      <ol class="fahrplan">
        <li>
          <span class="fahrplan__phase">Als Nächstes</span>
          <h3>Ernährungsplan und Einkaufsliste</h3>
          <p>Mahlzeiten passend zu Ziel, Körpergewicht und Trainingstag, inklusive was du vor und nach dem Training isst. Vegan, vegetarisch, mit oder ohne Schwein. Für täglich frisches Kochen oder Meal-Prep für die Woche.</p>
        </li>
        <li>
          <span class="fahrplan__phase">Danach</span>
          <h3>Supplementplan</h3>
          <p>Nur, was nachweislich wirkt, etwa Eiweiß oder Kreatin, mit dem passenden Zeitpunkt. Mit klaren Hinweisen, wann du vorher ärztlichen Rat einholen solltest.</p>
        </li>
        <li>
          <span class="fahrplan__phase">Danach</span>
          <h3>Smartwatch und Tagesform</h3>
          <p>Verbindung mit Apple Health, Health Connect, Garmin und Strava. Schlaf und Ruhepuls zeigen, ob heute volle Leistung oder eine leichtere Einheit sinnvoll ist.</p>
        </li>
        <li>
          <span class="fahrplan__phase">Danach</span>
          <h3>Zyklus berücksichtigen</h3>
          <p>Freiwillig und nur mit deiner Zustimmung: Training passt sich an Energie und Beschwerden an.</p>
        </li>
        <li>
          <span class="fahrplan__phase">Danach</span>
          <h3>Wettkampf und Strecken</h3>
          <p>Plan rückwärts ab dem Wettkampftag, inklusive Erholungsphase vor dem Rennen und Verpflegung. Lauf- und Radstrecken in deiner Nähe.</p>
        </li>
      </ol>
    </div>
  </section>

  <!-- PREISE -->
  <section class="abschnitt" id="preise">
    <div class="huelle">
      <h2 class="titel">Kostenlos starten</h2>
      <p class="einleitung">Die Grundfunktionen sind dauerhaft gratis. Premium schaltet die persönliche Anpassung frei.</p>
      <div class="vergleich-rahmen">
        <table class="vergleich">
          <thead>
            <tr><th scope="col">Funktion</th><th scope="col">Gratis</th><th scope="col">Premium</th></tr>
          </thead>
          <tbody>
            <tr><td>Profil und Ziel</td><td class="ja">Ja</td><td class="ja">Ja</td></tr>
            <tr><td>Trainingstagebuch</td><td class="ja">Ja</td><td class="ja">Ja</td></tr>
            <tr><td>Standard-Trainingsplan</td><td class="ja">Ja</td><td class="ja">Ja</td></tr>
            <tr><td>Plan passt sich deiner Leistung an</td><td class="nein">Nein</td><td class="ja">Ja</td></tr>
            <tr><td>Wettkampfvorbereitung</td><td class="nein">Nein</td><td class="ja">Ja</td></tr>
            <tr><td>Ernährungsplan und Einkaufsliste</td><td class="nein">Nein</td><td class="ja">Ja</td></tr>
          </tbody>
        </table>
      </div>
      <p class="fussnote">Preise geben wir zum Start bekannt. Wer auf der Warteliste steht, erfährt sie zuerst.</p>
    </div>
  </section>

  <!-- DATENSCHUTZ -->
  <section class="abschnitt abschnitt--minze" id="datenschutz">
    <div class="huelle">
      <h2 class="titel">Deine Gesundheitsdaten bleiben deine</h2>
      <ul class="schutz">
        <li><strong>Gespeichert in der EU</strong>Unsere Server stehen in Frankfurt.</li>
        <li><strong>Kein Verkauf, keine Werbung</strong>Deine Körper- und Trainingsdaten nutzen wir nur für deinen Plan.</li>
        <li><strong>Jederzeit exportieren und löschen</strong>Mit einem Tipp in den Einstellungen.</li>
        <li><strong>Zyklusdaten nur mit Zustimmung</strong>Separat freigegeben und verschlüsselt gespeichert.</li>
      </ul>
    </div>
  </section>

  <!-- WARTELISTE -->
  <section class="abschnitt abschnitt--tanne" id="warteliste">
    <div class="huelle warteliste">
      <h2 class="titel">Sei beim Start dabei</h2>
      <p class="einleitung">Trag dich ein und teste Alpha5 als eine der Ersten.</p>

      <div class="feld">
        <label for="email">E-Mail-Adresse</label>
        <input type="email" id="email" autocomplete="email" placeholder="name@beispiel.de" required>
      </div>
      <label class="zustimmung">
        <input type="checkbox" id="zustimmung">
        <span>Ich möchte per E-Mail über den Start von Alpha5 informiert werden. Abmelden kann ich mich jederzeit. Es gilt die <a href="#">Datenschutzerklärung</a>.</span>
      </label>
      <button class="knopf knopf--primaer" id="eintragen" type="button">Auf die Warteliste</button>
      <p class="meldung" id="meldung" role="status" aria-live="polite"></p>
    </div>
  </section>

</main>

<footer class="fuss">
  <div class="huelle fuss__innen">
    <p>© 2026 Alpha5. Alpha5 ersetzt keine ärztliche Beratung.</p>
    <nav aria-label="Rechtliches">
      <a href="#">Impressum</a>
      <a href="#">Datenschutz</a>
      <a href="#">AGB</a>
    </nav>
  </div>
</footer>

<script>
  // Beispiel-Einheit: abhaken, Alternative, Fortschritt
  const liste = document.getElementById('uebungen');
  const stand = document.getElementById('stand');
  const zaehlen = () => {
    const alle = liste.querySelectorAll('.uebung').length;
    const fertig = liste.querySelectorAll('[data-erledigt="true"]').length;
    stand.textContent = fertig === alle ? 'Einheit geschafft' : `${fertig} von ${alle}`;
  };
  liste.addEventListener('click', (e) => {
    const zeile = e.target.closest('.uebung');
    if (!zeile) return;
    if (e.target.closest('.uebung__haken')) {
      const an = zeile.dataset.erledigt !== 'true';
      zeile.dataset.erledigt = an;
      e.target.closest('.uebung__haken').setAttribute('aria-pressed', an);
      zaehlen();
    }
    if (e.target.closest('.uebung__alt')) {
      const name = zeile.querySelector('.uebung__name');
      const alt = zeile.dataset.alt;
      zeile.dataset.alt = name.textContent;
      name.textContent = alt;
      const knopf = e.target.closest('.uebung__alt');
      knopf.textContent = knopf.textContent === 'Alternative' ? 'Original' : 'Alternative';
    }
  });

  // Belastungsempfinden 0–10
  const rpe = document.getElementById('rpe');
  const texte = ['Völlig locker','Sehr leicht','Leicht','Locker','Angenehm fordernd','Spürbar','Fordernd, aber gut machbar','Anstrengend','Sehr anstrengend','Fast am Limit','Absolutes Maximum'];
  rpe.addEventListener('input', () => {
    document.getElementById('rpe-wert').textContent = rpe.value;
    document.getElementById('rpe-text').textContent = texte[rpe.value];
  });

  // Warteliste (wird später mit der Datenbank verbunden)
  document.getElementById('eintragen').addEventListener('click', () => {
    const email = document.getElementById('email');
    const ok = document.getElementById('zustimmung').checked;
    const meldung = document.getElementById('meldung');
    meldung.classList.remove('meldung--fehler');
    if (!email.checkValidity() || !email.value) {
      meldung.textContent = 'Bitte gib eine gültige E-Mail-Adresse ein.';
      meldung.classList.add('meldung--fehler');
    } else if (!ok) {
      meldung.textContent = 'Bitte bestätige, dass wir dich per E-Mail informieren dürfen.';
      meldung.classList.add('meldung--fehler');
    } else {
      meldung.textContent = 'Fast geschafft. Bitte bestätige den Link in deiner E-Mail.';
    }
  });
</script>
</body>
</html>

```

### styles.css (Entwurf)
```css
/* =========================================================
   Alpha5 – Landingpage
   Farbschema „Nacht & Kobalt“ – Blau und Schwarz
   ========================================================= */

/* Schrift: Archivo (variable, mit Breiten-Achse).
   Vor dem Livegang SELBST HOSTEN (DSGVO). */

:root {
  /* Grundfarben */
  --schwarz: #0a0c10;       /* Haupttext, dunkle Flächen, Kopfzeile */
  --graphit: #151922;       /* Karten auf Schwarz */
  --graphit-hell: #262c3a;  /* Linien und Hover auf Dunkel */
  --blau: #1f5bff;          /* Primär: Buttons, Logo, Akzente */
  --blau-dunkel: #1747cc;   /* Hover */
  --himmel: #8db0ff;        /* heller Text auf Schwarz */
  --eisblau: #e3ebff;       /* ruhige helle Flächen */
  --hell: #f4f6fa;          /* Seitenhintergrund */
  --grau: #586173;          /* Nebentext auf Hell */
  --grau-dunkel: #b4bdd0;   /* Nebentext auf Dunkel */
  --signal: #ffb020;        /* nur hohe Belastung und Fehlermeldungen */
  --weiss: #ffffff;

  /* Typografie */
  --schrift: "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif;
  --text-s: 0.875rem;
  --text-m: 1.0625rem;
  --text-l: 1.25rem;
  --text-xl: clamp(1.75rem, 5vw, 2.5rem);
  --text-xxl: clamp(2.75rem, 11vw, 5.5rem);

  /* Abstände & Form */
  --raum-s: 0.75rem;
  --raum-m: 1.25rem;
  --raum-l: 2.5rem;
  --raum-xl: clamp(4rem, 12vw, 7.5rem);
  --rund-klein: 6px;
  --rund-gross: 20px;
  --breite: 72rem;
}

*,
*::before,
*::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--schrift);
  font-size: var(--text-m);
  line-height: 1.55;
  color: var(--schwarz);
  background: var(--hell);
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; display: block; }
a { color: inherit; }

:focus-visible {
  outline: 3px solid var(--blau);
  outline-offset: 3px;
  border-radius: var(--rund-klein);
}

.huelle {
  width: min(100% - 2.5rem, var(--breite));
  margin-inline: auto;
}

/* ---------- Überschriften ---------- */
.titel-gross,
.titel {
  font-variation-settings: "wdth" 75;
  font-weight: 800;
  line-height: 0.95;
  letter-spacing: -0.01em;
  margin: 0;
}
.titel-gross { font-size: var(--text-xxl); }
.titel { font-size: var(--text-xl); line-height: 1.05; }

.einleitung {
  font-size: var(--text-l);
  color: var(--grau);
  max-width: 38rem;
  margin: var(--raum-m) 0 0;
}

/* ---------- Buttons ---------- */
.knopf {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0 1.4rem;
  border-radius: 999px;
  border: 2px solid transparent;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}
.knopf--primaer { background: var(--blau); color: var(--weiss); }
.knopf--primaer:hover { background: var(--blau-dunkel); }
.knopf--leise { border-color: var(--schwarz); color: var(--schwarz); background: transparent; }
.knopf--leise:hover { background: var(--schwarz); color: var(--weiss); }

/* ---------- Kopfzeile (dunkel) ---------- */
.kopf {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgb(10 12 16 / 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--graphit-hell);
  color: var(--weiss);
}
.kopf__innen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 4rem;
}
.logo {
  font-size: 1.5rem;
  font-weight: 900;
  font-variation-settings: "wdth" 70;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.logo__alpha { height: 1.35rem; width: auto; aspect-ratio: 1133 / 697; }
.logo__alpha path { fill: var(--blau); }
.kopf .knopf { min-height: 2.5rem; padding: 0 1rem; font-size: var(--text-s); }

/* ---------- Hero (dunkel) ---------- */
.hero {
  background: var(--schwarz);
  color: var(--weiss);
  padding-block: var(--raum-l) var(--raum-xl);
}
.hero .einleitung { color: var(--grau-dunkel); }
.hero .knopf--leise { border-color: var(--weiss); color: var(--weiss); }
.hero .knopf--leise:hover { background: var(--weiss); color: var(--schwarz); }
.hero__raster {
  display: grid;
  gap: var(--raum-l);
  align-items: center;
}
.hero__knoepfe {
  display: flex;
  flex-wrap: wrap;
  gap: var(--raum-s);
  margin-top: var(--raum-l);
}

/* Interaktive Beispiel-Einheit */
.einheit {
  background: var(--graphit);
  color: var(--weiss);
  border: 1px solid var(--graphit-hell);
  border-radius: var(--rund-gross);
  padding: var(--raum-m);
  box-shadow: 0 30px 80px -30px rgb(31 91 255 / 0.45);
}
.einheit__kopf {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--raum-s);
  margin-bottom: var(--raum-m);
}
.einheit__name {
  font-size: 1.6rem;
  font-weight: 800;
  font-variation-settings: "wdth" 75;
  margin: 0;
}
.einheit__hinweis { font-size: var(--text-s); color: var(--himmel); margin: 0.2rem 0 0; }
.einheit__stand {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  background: var(--blau);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  white-space: nowrap;
  font-size: var(--text-s);
}

.uebungen { list-style: none; margin: 0; padding: 0; }
.uebung {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--raum-s);
  align-items: center;
  padding: 0.8rem 0;
  border-top: 1px solid var(--graphit-hell);
}
.uebung__haken {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 2px solid var(--himmel);
  background: transparent;
  color: var(--weiss);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background-color 0.15s, border-color 0.15s;
}
.uebung__haken svg { opacity: 0; transition: opacity 0.15s; }
.uebung[data-erledigt="true"] .uebung__haken { background: var(--blau); border-color: var(--blau); }
.uebung[data-erledigt="true"] .uebung__haken svg { opacity: 1; }
.uebung[data-erledigt="true"] .uebung__name { text-decoration: line-through; text-decoration-thickness: 2px; opacity: 0.7; }
.uebung__name { font-weight: 700; display: block; }
.uebung__daten { font-size: var(--text-s); color: var(--grau-dunkel); font-variant-numeric: tabular-nums; }
.uebung__alt {
  font: inherit;
  font-size: var(--text-s);
  color: var(--weiss);
  background: none;
  border: 1px solid var(--graphit-hell);
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}
.uebung__alt:hover { border-color: var(--himmel); }

.empfinden { margin-top: var(--raum-m); padding-top: var(--raum-m); border-top: 1px solid var(--graphit-hell); }
.empfinden label { display: flex; justify-content: space-between; font-weight: 700; }
.empfinden__wert { font-variant-numeric: tabular-nums; color: var(--himmel); }
.empfinden__text { font-size: var(--text-s); color: var(--grau-dunkel); margin: 0.4rem 0 0; min-height: 1.3em; }

input[type="range"] {
  width: 100%;
  margin-top: 0.75rem;
  appearance: none;
  height: 0.6rem;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--himmel), var(--blau) 60%, var(--signal));
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--weiss);
  border: 3px solid var(--schwarz);
  cursor: pointer;
}
input[type="range"]::-moz-range-thumb {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--weiss);
  border: 3px solid var(--schwarz);
  cursor: pointer;
}

/* ---------- Abschnitte ----------
   .abschnitt--minze = helle blaue Fläche
   .abschnitt--tanne = schwarze Fläche
   (Klassennamen bleiben, damit index.html unverändert passt) */
.abschnitt { padding-block: var(--raum-xl); }
.abschnitt--minze { background: var(--eisblau); }
.abschnitt--tanne { background: var(--schwarz); color: var(--weiss); }
.abschnitt--tanne .einleitung { color: var(--grau-dunkel); }

/* Ablauf */
.ablauf {
  list-style: none;
  counter-reset: schritt;
  margin: var(--raum-l) 0 0;
  padding: 0;
  display: grid;
  gap: var(--raum-l);
}
.ablauf li { counter-increment: schritt; max-width: 34rem; }
.ablauf li::before {
  content: counter(schritt);
  display: block;
  font-size: 3.5rem;
  font-weight: 900;
  font-variation-settings: "wdth" 62;
  line-height: 1;
  color: var(--blau);
  margin-bottom: 0.4rem;
}
.ablauf h3 { margin: 0 0 0.3rem; font-size: var(--text-l); }
.ablauf p { margin: 0; color: var(--grau); }

/* MVP-Funktionen */
.start {
  display: grid;
  gap: var(--raum-l);
  margin-top: var(--raum-l);
}
.funktion { border-top: 3px solid var(--schwarz); padding-top: var(--raum-m); }
.funktion h3 {
  margin: 0 0 0.5rem;
  font-size: 1.6rem;
  font-weight: 800;
  font-variation-settings: "wdth" 75;
  line-height: 1.05;
}
.funktion p { margin: 0; color: var(--grau); max-width: 34rem; }

.ziele { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: var(--raum-m) 0 0; padding: 0; list-style: none; }
.ziele li {
  background: var(--eisblau);
  color: var(--blau-dunkel);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  font-size: var(--text-s);
  font-weight: 700;
}

/* Fahrplan */
.fahrplan { list-style: none; margin: var(--raum-l) 0 0; padding: 0; }
.fahrplan li {
  position: relative;
  padding: 0 0 var(--raum-l) 2rem;
  border-left: 2px solid var(--graphit-hell);
  margin-left: 0.5rem;
  max-width: 40rem;
}
.fahrplan li:last-child { padding-bottom: 0; border-left-color: transparent; }
.fahrplan li::before {
  content: "";
  position: absolute;
  left: -0.6rem;
  top: 0.2rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--blau);
  border: 2px solid var(--schwarz);
}
.fahrplan__phase { font-size: var(--text-s); color: var(--himmel); font-weight: 700; }
.fahrplan h3 { margin: 0.1rem 0 0.3rem; font-size: var(--text-l); }
.fahrplan p { margin: 0; color: var(--grau-dunkel); }

/* Preisvergleich */
.vergleich-rahmen { overflow-x: auto; margin-top: var(--raum-l); }
.vergleich {
  width: 100%;
  min-width: 20rem;
  border-collapse: collapse;
  background: var(--weiss);
  border-radius: var(--rund-gross);
  overflow: hidden;
}
.vergleich th,
.vergleich td { padding: 0.85rem 1rem; text-align: left; border-bottom: 1px solid var(--hell); }
.vergleich thead th { background: var(--schwarz); color: var(--weiss); font-size: var(--text-l); }
.vergleich td:not(:first-child),
.vergleich th:not(:first-child) { text-align: center; width: 6.5rem; }
.ja { color: var(--blau); font-weight: 800; }
.nein { color: #9aa3b5; }
.fussnote { font-size: var(--text-s); color: var(--grau); margin-top: var(--raum-s); }

/* Datenschutz */
.schutz { display: grid; gap: var(--raum-m); margin: var(--raum-l) 0 0; padding: 0; list-style: none; }
.schutz li { border-left: 3px solid var(--blau); padding-left: var(--raum-m); max-width: 32rem; }
.schutz strong { display: block; font-size: var(--text-l); }

/* Warteliste */
.warteliste { max-width: 34rem; }
.feld { display: flex; flex-direction: column; gap: 0.4rem; margin-top: var(--raum-l); }
.feld label { font-weight: 700; }
.feld input[type="email"] {
  font: inherit;
  min-height: 3.25rem;
  padding: 0 1rem;
  border-radius: var(--rund-klein);
  border: 2px solid var(--graphit-hell);
  background: var(--graphit);
  color: var(--weiss);
}
.feld input[type="email"]::placeholder { color: #7d869a; }
.feld input[type="email"]:focus { border-color: var(--blau); }
.zustimmung { display: flex; gap: 0.6rem; align-items: flex-start; margin-top: var(--raum-m); font-size: var(--text-s); color: var(--grau-dunkel); }
.zustimmung input { width: 1.25rem; height: 1.25rem; margin-top: 0.1rem; accent-color: var(--blau); flex-shrink: 0; }
.warteliste .knopf { margin-top: var(--raum-m); width: 100%; }
.meldung { margin-top: var(--raum-m); font-weight: 700; min-height: 1.5em; color: var(--himmel); }
.meldung--fehler { color: var(--signal); }

/* Fuß */
.fuss { padding-block: var(--raum-l); font-size: var(--text-s); color: var(--grau); }
.fuss__innen { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--raum-m); }
.fuss nav { display: flex; gap: var(--raum-m); }

/* ---------- Größere Bildschirme ---------- */
@media (min-width: 900px) {
  .hero__raster { grid-template-columns: 1.15fr 1fr; }
  .ablauf { grid-template-columns: repeat(4, 1fr); }
  .start { grid-template-columns: repeat(2, 1fr); gap: var(--raum-l) var(--raum-xl); }
  .schutz { grid-template-columns: repeat(2, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; }
}

```
