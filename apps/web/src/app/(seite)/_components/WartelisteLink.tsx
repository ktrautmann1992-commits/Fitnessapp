import type { Metadata } from 'next';

import { GRATIS_REZEPTE_PDF } from '@/lib/site';

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
/** Warteliste („Sei beim Start dabei“) oder Gratis-Rezepte (Lead-Magnet). */
export type Bereich = 'warteliste' | 'gratis-rezepte';

type Texte = Record<
  Aktion,
  { titel: string; frage: string; knopf: string; ergebnisse: Record<string, string> }
>;

const WARTELISTE: Texte = {
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
      ok: 'Du bist abgemeldet. Deine E-Mail-Adresse ist aus der Warteliste gelöscht.',
      unbekannt:
        'Zu diesem Link ist keine Adresse (mehr) gespeichert – sie ist schon gelöscht. Fragen? Die Kontaktdaten stehen im Impressum.',
      ungueltig: 'Dieser Link ist ungültig. Bitte nutze den Abmelde-Link aus unserer E-Mail.',
      inaktiv: 'Die Warteliste ist bald aktiv. Bitte versuch es in ein paar Tagen noch einmal.',
      fehler: 'Das hat gerade nicht geklappt. Bitte öffne den Link später noch einmal.',
    },
  },
};

// TODO(Recht): Texte vor dem Livegang prüfen lassen.
const GRATIS_REZEPTE: Texte = {
  bestaetigen: {
    titel: 'E-Mail-Adresse bestätigen',
    frage:
      'Tippe auf den Knopf, um zu bestätigen, was in deiner E-Mail steht (nur Download-Link oder zusätzlich Newsletter).',
    knopf: 'Jetzt bestätigen',
    ergebnisse: {
      ok: 'Danke! Deine Adresse ist bestätigt. Du bekommst nur den Download-Link, keinen Newsletter. Den Link haben wir dir auch per E-Mail geschickt.',
      'ok-newsletter':
        'Danke! Deine Adresse und dein Newsletter-Abo sind bestätigt. Den Download-Link haben wir dir auch per E-Mail geschickt. Abmelden kannst du dich jederzeit über den Link in jeder Mail.',
      newsletter:
        'Danke! Dein Newsletter-Abo ist bestätigt. Abmelden kannst du dich jederzeit über den Link in jeder Mail.',
      // Ohne gültigen Nachweis aus der Bestätigung (z. B. Seite später neu geladen oder Adresse abgetippt):
      // nichts behaupten, was diese Seite nicht weiß.
      neutral:
        'Wenn du deine Adresse bestätigt hast, findest du den Download-Link in unserer E-Mail. Sonst öffne den Link aus der neuesten Mail und tippe auf „Jetzt bestätigen“.',
      abgelaufen:
        'Dieser Link ist abgelaufen (er gilt 48 Stunden). Fordere die Rezepte einfach noch einmal an.',
      ungueltig:
        'Dieser Link ist ungültig oder abgelaufen – gültig ist nur der Link aus der neuesten Mail. Fordere die Rezepte sonst einfach noch einmal auf der Startseite an.',
      inaktiv: 'Der Download ist bald verfügbar. Bitte versuch es in ein paar Tagen noch einmal.',
      fehler: 'Das hat gerade nicht geklappt. Bitte öffne den Link später noch einmal.',
    },
  },
  abmelden: {
    titel: 'Adresse löschen',
    frage:
      'Tippe auf den Knopf, um deine E-Mail-Adresse aus der Liste der Gratis-Rezepte zu löschen. Falls du den Newsletter bestellt hast, ist er damit abbestellt. Die Warteliste hat einen eigenen Abmelde-Link.',
    knopf: 'Adresse löschen',
    ergebnisse: {
      ok: 'Erledigt. Deine E-Mail-Adresse ist aus der Liste der Gratis-Rezepte gelöscht – und damit auch vom Newsletter abgemeldet. Stehst du zusätzlich auf der Warteliste, melde dich dort über den Link in der Wartelisten-Mail ab.',
      unbekannt:
        'Zu diesem Link ist keine Adresse (mehr) gespeichert – sie ist schon gelöscht. Fragen? Die Kontaktdaten stehen im Impressum.',
      ungueltig: 'Dieser Link ist ungültig. Bitte nutze den Link aus unserer E-Mail.',
      inaktiv: 'Der Download ist bald verfügbar. Bitte versuch es in ein paar Tagen noch einmal.',
      fehler: 'Das hat gerade nicht geklappt. Bitte öffne den Link später noch einmal.',
    },
  },
};

const TEXTE: Record<Bereich, Texte> = { warteliste: WARTELISTE, 'gratis-rezepte': GRATIS_REZEPTE };

/** Ergebnisse nach echter Bestätigung der Gratis-Rezepte (zeigen Dank und Download nur mit Nachweis). */
export const BESTAETIGT_ERGEBNISSE: ReadonlySet<string> = new Set([
  'ok',
  'ok-newsletter',
  'newsletter',
]);

export const erster = (wert: string | string[] | undefined) =>
  Array.isArray(wert) ? wert[0] : wert;

/**
 * Seite zum Mail-Link. Bestätigt/abgemeldet wird erst per Knopf (POST) – nicht schon beim Öffnen des Links,
 * denn manche Mail-Programme rufen Links automatisch auf (Virenscanner, Vorschau).
 */
export function WartelisteLinkSeite({
  aktion,
  searchParams,
  bereich = 'warteliste',
  downloadErlaubt = false,
}: {
  aktion: Aktion;
  searchParams: Record<string, string | string[] | undefined>;
  bereich?: Bereich;
  /** Nur nach echter Bestätigung (signierter, kurzlebiger Nachweis, geprüft auf dem Server). */
  downloadErlaubt?: boolean;
}) {
  const texte = TEXTE[bereich][aktion];
  const roh = erster(searchParams.ergebnis);
  // Gratis-Rezepte: Dankestexte („bestätigt“) nur mit gültigem, signiertem Nachweis – sonst neutral.
  const ergebnis =
    bereich === 'gratis-rezepte' &&
    aktion === 'bestaetigen' &&
    roh !== undefined &&
    BESTAETIGT_ERGEBNISSE.has(roh) &&
    !downloadErlaubt
      ? 'neutral'
      : roh;
  const ergebnisText = ergebnis ? (texte.ergebnisse[ergebnis] ?? texte.ergebnisse.fehler) : null;
  // Nach der Bestätigung der Gratis-Rezepte gleich hier herunterladen (zusätzlich zur Mail).
  const download = bereich === 'gratis-rezepte' && aktion === 'bestaetigen' && downloadErlaubt;

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
            action={`/api/${bereich}/${aktion}`}
            frage={texte.frage}
            knopf={texte.knopf}
            ungueltig={texte.ergebnisse.ungueltig ?? ''}
          />
        )}
        {download ? (
          <a
            className={`${styles.knopf} ${styles['knopf--primaer']}`}
            href={GRATIS_REZEPTE_PDF}
            download
          >
            PDF herunterladen
          </a>
        ) : null}
        <p className={styles.einleitung}>
          <a href="/">Zur Startseite</a>
        </p>
      </div>
    </section>
  );
}
