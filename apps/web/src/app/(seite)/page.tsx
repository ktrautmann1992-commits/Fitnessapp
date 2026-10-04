import { Beispieleinheit } from './_components/Beispieleinheit';
import { WartelisteFormular } from './_components/WartelisteFormular';
import styles from './seite.module.css';

/** Startseite (Landingpage) – Umsetzung von index.html aus docs/ALPHA5-PAKET.md. */

const s = (...namen: string[]) => namen.map((name) => styles[name]).join(' ');

const ZIELE = [
  'Fettverlust',
  'Definition',
  'Muskelaufbau',
  'Allgemeine Fitness',
  '5 km',
  '10 km',
  'Halbmarathon',
  'Marathon',
  'Triathlon',
  'Radfahren',
  'Schwimmen',
];

const VERGLEICH: ReadonlyArray<readonly [string, boolean]> = [
  ['Profil und Ziel', true],
  ['Trainingstagebuch', true],
  ['Standard-Trainingsplan', true],
  ['Plan passt sich deiner Leistung an', false],
  ['Wettkampfvorbereitung', false],
  ['Ernährungsplan und Einkaufsliste', false],
];

export default function Startseite() {
  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={s('huelle', 'hero__raster')}>
          <div>
            <h1 className={styles['titel-gross']}>Training und Ernährung, die zu dir passen.</h1>
            <p className={styles.einleitung}>
              Alpha5 erstellt deinen Trainingsplan aus deinem Ziel, deiner Zeit und dem Equipment,
              das du wirklich hast. Im Studio oder zu Hause, vom ersten Workout bis zum Marathon.
            </p>
            <div className={styles['hero__knoepfe']}>
              <a className={s('knopf', 'knopf--primaer')} href="#warteliste">
                Auf die Warteliste
              </a>
              <a className={s('knopf', 'knopf--leise')} href="#ablauf">
                So funktioniert es
              </a>
            </div>
          </div>

          <Beispieleinheit />
        </div>
      </section>

      {/* ABLAUF */}
      <section className={s('abschnitt', 'abschnitt--minze')} id="ablauf">
        <div className={styles.huelle}>
          <h2 className={styles.titel}>In vier Schritten zu deinem Plan</h2>
          <ol className={styles.ablauf}>
            <li>
              <h3>Profil anlegen</h3>
              <p>Geschlecht, Alter, Größe, Gewicht und ein kurzer Gesundheits-Check.</p>
            </li>
            <li>
              <h3>Ziel wählen</h3>
              <p>
                Fettverlust, Definition, Muskelaufbau, allgemeine Fitness oder ein Ausdauerziel mit
                Wettkampfdatum.
              </p>
            </li>
            <li>
              <h3>Zeit und Equipment angeben</h3>
              <p>
                Trainingstage pro Woche, Minuten pro Einheit, Studio oder zu Hause. Zu Hause gibst
                du genau an, was du hast: Kurzhanteln mit Gewichten, Kettlebell, Flach- oder
                Schrägbank.
              </p>
            </li>
            <li>
              <h3>Plan erhalten</h3>
              <p>
                Jede Woche steht fest, was du trainierst. Gewichte und Umfang passen sich an deine
                Leistung an.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* MVP */}
      <section className={styles.abschnitt} id="start">
        <div className={styles.huelle}>
          <h2 className={styles.titel}>Zum Start dabei</h2>
          <p className={styles.einleitung}>
            Die erste Version konzentriert sich auf das, was jeden Tag zählt: ein Plan, der zu dir
            passt, und ein Tagebuch, aus dem dein Plan lernt.
          </p>

          <div className={styles.start}>
            <article className={styles.funktion}>
              <h3>Ein Profil, das dich wirklich kennt</h3>
              <p>
                Körperdaten, Trainingserfahrung vom Einstieg bis zum Leistungssport und ein
                Gesundheits-Check. Gibt es Hinweise auf Risiken, startet dein Plan behutsamer und
                wir empfehlen eine ärztliche Abklärung.
              </p>
            </article>

            <article className={styles.funktion}>
              <h3>Ziele für Kraft und Ausdauer</h3>
              <p>Wähle ein Ziel, bei Ausdauer auch deinen Wettkampf.</p>
              <ul className={styles.ziele}>
                {ZIELE.map((ziel) => (
                  <li key={ziel}>{ziel}</li>
                ))}
              </ul>
            </article>

            <article className={styles.funktion}>
              <h3>Dein persönlicher Trainingsplan</h3>
              <p>
                Übungen passend zu deinem Equipment, mit Sätzen, Wiederholungen, Zielgewicht und
                Pausen. Fällt eine Einheit aus, verschiebt die App sinnvoll, statt alles auf einen
                Tag zu stapeln. Regelmäßige leichtere Wochen sorgen für Erholung.
              </p>
            </article>

            <article className={styles.funktion}>
              <h3>Trainingstagebuch für jede Einheit</h3>
              <p>
                Hake jede Übung ab oder wähle eine Alternative. Trage Gewichte und Wiederholungen
                ein, beim Laufen und Radfahren Distanz und Zeit. Dein Belastungsempfinden gibst du
                von 0 bis 10 an. Schaffst du alle Wiederholungen, steigt das Gewicht in der nächsten
                Woche. Funktioniert auch ohne Netz im Studio.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* FAHRPLAN */}
      <section className={s('abschnitt', 'abschnitt--tanne')} id="fahrplan">
        <div className={styles.huelle}>
          <h2 className={styles.titel}>Was danach kommt</h2>
          <p className={styles.einleitung}>
            Diese Funktionen bauen wir Schritt für Schritt nach dem Start ein.
          </p>
          <ol className={styles.fahrplan}>
            <li>
              <span className={styles['fahrplan__phase']}>Als Nächstes</span>
              <h3>Ernährungsplan und Einkaufsliste</h3>
              <p>
                Mahlzeiten passend zu Ziel, Körpergewicht und Trainingstag, inklusive was du vor und
                nach dem Training isst. Vegan, vegetarisch, mit oder ohne Schwein. Für täglich
                frisches Kochen oder Meal-Prep für die Woche.
              </p>
            </li>
            <li>
              <span className={styles['fahrplan__phase']}>Danach</span>
              <h3>Supplementplan</h3>
              <p>
                Nur, was nachweislich wirkt, etwa Eiweiß oder Kreatin, mit dem passenden Zeitpunkt.
                Mit klaren Hinweisen, wann du vorher ärztlichen Rat einholen solltest.
              </p>
            </li>
            <li>
              <span className={styles['fahrplan__phase']}>Danach</span>
              <h3>Smartwatch und Tagesform</h3>
              <p>
                Verbindung mit Apple Health, Health Connect, Garmin und Strava. Schlaf und Ruhepuls
                zeigen, ob heute volle Leistung oder eine leichtere Einheit sinnvoll ist.
              </p>
            </li>
            <li>
              <span className={styles['fahrplan__phase']}>Danach</span>
              <h3>Zyklus berücksichtigen</h3>
              <p>
                Freiwillig und nur mit deiner Zustimmung: Training passt sich an Energie und
                Beschwerden an.
              </p>
            </li>
            <li>
              <span className={styles['fahrplan__phase']}>Danach</span>
              <h3>Wettkampf und Strecken</h3>
              <p>
                Plan rückwärts ab dem Wettkampftag, inklusive Erholungsphase vor dem Rennen und
                Verpflegung. Lauf- und Radstrecken in deiner Nähe.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* PREISE */}
      <section className={styles.abschnitt} id="preise">
        <div className={styles.huelle}>
          <h2 className={styles.titel}>Kostenlos starten</h2>
          <p className={styles.einleitung}>
            Die Grundfunktionen sind dauerhaft gratis. Premium schaltet die persönliche Anpassung
            frei.
          </p>
          <div className={styles['vergleich-rahmen']}>
            <table className={styles.vergleich}>
              <thead>
                <tr>
                  <th scope="col">Funktion</th>
                  <th scope="col">Gratis</th>
                  <th scope="col">Premium</th>
                </tr>
              </thead>
              <tbody>
                {VERGLEICH.map(([funktion, gratis]) => (
                  <tr key={funktion}>
                    <td>{funktion}</td>
                    <td className={gratis ? styles.ja : styles.nein}>{gratis ? 'Ja' : 'Nein'}</td>
                    <td className={styles.ja}>Ja</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.fussnote}>
            Preise geben wir zum Start bekannt. Wer auf der Warteliste steht, erfährt sie zuerst.
          </p>
        </div>
      </section>

      {/* DATENSCHUTZ */}
      <section className={s('abschnitt', 'abschnitt--minze')} id="datenschutz">
        <div className={styles.huelle}>
          <h2 className={styles.titel}>Deine Gesundheitsdaten bleiben deine</h2>
          <ul className={styles.schutz}>
            <li>
              <strong>Gespeichert in der EU</strong>Unsere Server stehen in Frankfurt.
            </li>
            <li>
              <strong>Kein Verkauf, keine Werbung</strong>Deine Körper- und Trainingsdaten nutzen
              wir nur für deinen Plan.
            </li>
            <li>
              <strong>Jederzeit exportieren und löschen</strong>Mit einem Tipp in den Einstellungen.
            </li>
            <li>
              <strong>Zyklusdaten nur mit Zustimmung</strong>Separat freigegeben und verschlüsselt
              gespeichert.
            </li>
          </ul>
        </div>
      </section>

      {/* WARTELISTE */}
      <section className={s('abschnitt', 'abschnitt--tanne')} id="warteliste">
        <div className={s('huelle', 'warteliste')}>
          <h2 className={styles.titel}>Sei beim Start dabei</h2>
          <p className={styles.einleitung}>Trag dich ein und teste Alpha5 als eine der Ersten.</p>
          <WartelisteFormular />
        </div>
      </section>
    </>
  );
}
