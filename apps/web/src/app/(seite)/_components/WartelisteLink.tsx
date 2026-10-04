import type { Metadata } from 'next';

import styles from '../seite.module.css';
import { TokenFormular } from './TokenFormular';

/** Seiten der Mail-Links: nie indexieren. Das Token steht im #Fragment (geht an keinen Server, in keinen Referer). */
export const wartelisteMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: false },
  // „same-origin“ statt „no-referrer“: Sonst schicken Browser beim Formular `Origin: null`.
  referrer: 'same-origin',
});

type Aktion = 'bestaetigen' | 'abmelden';

const TEXTE: Record<
  Aktion,
  { titel: string; frage: string; knopf: string; ergebnisse: Record<string, string> }
> = {
  bestaetigen: {
    titel: 'Anmeldung bestätigen',
    frage: 'Tippe auf den Knopf, um deine Anmeldung zur Alpha5-Warteliste zu bestätigen.',
    knopf: 'Anmeldung bestätigen',
    ergebnisse: {
      ok: 'Danke! Du stehst jetzt auf der Warteliste. Wir melden uns, sobald Alpha5 startet.',
      abgelaufen:
        'Dieser Link ist abgelaufen (er gilt 48 Stunden). Trag dich einfach noch einmal ein.',
      ungueltig:
        'Dieser Link ist ungültig oder abgelaufen. Trag dich einfach noch einmal auf der Startseite ein.',
      inaktiv: 'Die Warteliste ist bald aktiv. Bitte versuch es in ein paar Tagen noch einmal.',
      fehler: 'Das hat gerade nicht geklappt. Bitte öffne den Link später noch einmal.',
    },
  },
  abmelden: {
    titel: 'Von der Warteliste abmelden',
    frage: 'Tippe auf den Knopf, um dich abzumelden. Wir löschen dann deine E-Mail-Adresse.',
    knopf: 'Abmelden',
    ergebnisse: {
      ok: 'Du bist abgemeldet. Deine E-Mail-Adresse ist gelöscht.',
      ungueltig: 'Dieser Link ist ungültig. Bitte nutze den Abmelde-Link aus unserer E-Mail.',
      inaktiv: 'Die Warteliste ist bald aktiv. Bitte versuch es in ein paar Tagen noch einmal.',
      fehler: 'Das hat gerade nicht geklappt. Bitte öffne den Link später noch einmal.',
    },
  },
};

const erster = (wert: string | string[] | undefined) => (Array.isArray(wert) ? wert[0] : wert);

/**
 * Seite zum Mail-Link. Bestätigt/abgemeldet wird erst per Knopf (POST) – nicht schon beim Öffnen des Links,
 * denn manche Mail-Programme rufen Links automatisch auf (Virenscanner, Vorschau).
 */
export function WartelisteLinkSeite({
  aktion,
  searchParams,
}: {
  aktion: Aktion;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const texte = TEXTE[aktion];
  const ergebnis = erster(searchParams.ergebnis);
  const ergebnisText = ergebnis ? (texte.ergebnisse[ergebnis] ?? texte.ergebnisse.fehler) : null;

  return (
    <section className={`${styles.abschnitt} ${styles['abschnitt--tanne']}`}>
      <div className={`${styles.huelle} ${styles.warteliste}`}>
        <h1 className={styles.titel}>{texte.titel}</h1>
        {ergebnisText ? (
          <p className={styles.einleitung} role="status">
            {ergebnisText}
          </p>
        ) : (
          <TokenFormular
            aktion={aktion}
            frage={texte.frage}
            knopf={texte.knopf}
            ungueltig={texte.ergebnisse.ungueltig ?? ''}
          />
        )}
        <p className={styles.einleitung}>
          <a href="/">Zur Startseite</a>
        </p>
      </div>
    </section>
  );
}
