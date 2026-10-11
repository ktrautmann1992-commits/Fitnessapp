/**
 * TEXTE DER E-MAILS (Warteliste und „20 Rezepte gratis als PDF“).
 *
 * Hier kannst du die Texte ändern – Anleitung mit Klick-Schritten am Handy: docs/SETUP.md, Teil I8.
 * Regeln:
 * - Nur den Text zwischen den einfachen Anführungszeichen '…' ändern. Anführungszeichen, Kommas und Klammern
 *   drumherum stehen lassen.
 * - Im Text selbst kein einfaches ' verwenden (sonst ist die Datei kaputt) – stattdessen ’ oder „…“.
 * - Links (Bestätigen, Download, Abmelden) fügt die Website selbst ein – die gehören nicht in die Texte.
 * - Ist etwas kaputt, wird der Pull Request rot (Prüfung „ci“) und nichts geht live.
 *
 * TODO(Recht): Alle Mail-Texte und Einwilligungstexte vor dem Livegang rechtlich prüfen lassen.
 */
export const MAIL_TEXTE = {
  /** Gilt für alle Mails. */
  anrede: 'Hallo,',
  gruss: 'Dein Alpha5-Team',

  /** Bestätigungs-Mail der Warteliste („Sei beim Start dabei“). */
  warteliste: {
    betreff: 'Bitte bestätige deine Anmeldung zur Alpha5-Warteliste',
    text: 'du hast dich für die Warteliste von Alpha5 eingetragen. Bitte bestätige deine E-Mail-Adresse:',
    knopf: 'Anmeldung bestätigen',
    hinweis:
      'Der Link ist 48 Stunden gültig. Wenn du dich nicht eingetragen hast, ignoriere diese E-Mail einfach – ohne Bestätigung löschen wir deine Adresse automatisch.',
    abmelden: 'Von der Warteliste abmelden',
  },

  /** Bestätigungs-Mail für die Gratis-Rezepte (1. Mail, Double-Opt-in). */
  gratisRezepteBestaetigen: {
    betreff: 'Bitte bestätige deine E-Mail-Adresse – dann kommen deine 20 Alpha5-Rezepte',
    text: 'du hast unsere 20 Rezepte als PDF angefordert. Bitte bestätige kurz deine E-Mail-Adresse – danach schicken wir dir sofort den Download-Link:',
    /** Wer das Newsletter-Häkchen NICHT gesetzt hat: Satz und Knopf. */
    ohneNewsletter: 'Du bekommst nur den Download-Link – keinen Newsletter.',
    knopfOhneNewsletter: 'E-Mail-Adresse bestätigen',
    /** Wer das Newsletter-Häkchen gesetzt hat: Satz und Knopf (der Klick bestätigt auch den Newsletter). */
    mitNewsletter:
      'Mit dem Klick bestätigst du auch den Alpha5-Newsletter (Infos zum Start der App, Rezepte und Trainingstipps). Abmelden kannst du dich jederzeit.',
    knopfMitNewsletter: 'Adresse und Newsletter bestätigen',
    hinweis:
      'Der Link ist 48 Stunden gültig. Wenn du nichts angefordert hast, ignoriere diese E-Mail einfach – ohne Bestätigung löschen wir deine Adresse automatisch.',
    abmelden: 'Anfrage zurückziehen und Adresse löschen',
  },

  /** Mail mit dem Download-Link (2. Mail, nach der Bestätigung – oder bei erneuter Anforderung). */
  gratisRezepteDownload: {
    betreff: 'Deine 20 Alpha5-Rezepte als PDF',
    text: 'hier sind deine 20 Lieblingsrezepte aus dem Alpha5-Rezeptbuch – vor und nach dem Training, für lange Läufe, schnell in 10 Minuten und als Protein-Dessert.',
    knopf: 'PDF herunterladen',
    /** Wer den Newsletter NICHT bestellt hat. */
    ohneNewsletter:
      'Weitere E-Mails bekommst du von uns nicht. Deine Adresse löschen wir 30 Tage nach deiner Bestätigung automatisch.',
    /** Wer den Newsletter bestellt und bestätigt hat. */
    mitNewsletter:
      'Du hast außerdem unseren Newsletter abonniert: Wir melden uns mit Infos zum Start von Alpha5, Rezepten und Trainingstipps. Abmelden kannst du dich jederzeit über den Link unten.',
    abmeldenOhneNewsletter: 'Adresse aus der Liste der Gratis-Rezepte löschen',
    abmeldenMitNewsletter:
      'Newsletter abbestellen und Adresse aus der Liste der Gratis-Rezepte löschen',
  },

  /**
   * Adresse hat die Rezepte schon bestätigt und setzt jetzt das Newsletter-Häkchen: eigene Bestätigung NUR für
   * den Newsletter. Der Download-Link steht zusätzlich in der Mail.
   */
  gratisRezepteNewsletter: {
    betreff: 'Bitte bestätige deinen Alpha5-Newsletter',
    text: 'du hast unsere 20 Rezepte noch einmal angefordert und dabei den Alpha5-Newsletter bestellt (Infos zum Start der App, Rezepte und Trainingstipps). Mit dem Klick bestätigst du den Newsletter:',
    knopf: 'Newsletter bestätigen',
    download: 'Deine Rezepte als PDF',
    hinweis:
      'Der Link ist 48 Stunden gültig. Wenn du keinen Newsletter möchtest, ignoriere diese E-Mail einfach – dann bleibt alles wie bisher.',
    abmelden: 'Adresse aus der Liste der Gratis-Rezepte löschen',
  },
} as const;
