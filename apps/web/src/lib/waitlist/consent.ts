/**
 * Einwilligungstexte. Gespeichert wird die Version (Spalte consent_text_version).
 * Text ändern = Version erhöhen (alte Einträge behalten ihre Version).
 * TODO(Recht): Texte vor dem Livegang rechtlich prüfen lassen.
 */

/** Warteliste (Text aus docs/ALPHA5-PAKET.md). */
export const WAITLIST_CONSENT = {
  version: 1,
  text: 'Ich möchte per E-Mail über den Start von Alpha5 informiert werden. Abmelden kann ich mich jederzeit. Es gilt die Datenschutzerklärung.',
} as const;

/**
 * „20 Rezepte gratis als PDF“ (ERWEITERUNGEN-2.md Abschnitt 8). Gründer-Entscheidung 11.10.2026: Download OHNE
 * Newsletter-Pflicht. `download` ist Pflicht und deckt NUR die Zusendung des Download-Links ab; `newsletter` ist ein
 * eigenes, freiwilliges, nicht vorausgewähltes Häkchen. Eine Version für beide Texte (gespeichert wird zusätzlich,
 * ob das Newsletter-Häkchen gesetzt war: Spalte newsletter_opt_in).
 * Bei der Prüfung klären: Für die bloße Zusendung des Links genügt evtl. Art. 6 Abs. 1 lit. b DSGVO statt Einwilligung.
 */
export const LEAD_MAGNET_CONSENT = {
  version: 1,
  download:
    'Schickt mir den Download-Link für die 20 Rezepte an diese E-Mail-Adresse. Meine Adresse wird nur dafür genutzt und 30 Tage nach der Bestätigung gelöscht – außer ich bestelle unten zusätzlich den Newsletter. Es gilt die Datenschutzerklärung.',
  newsletter:
    'Freiwillig: Ich möchte zusätzlich den Alpha5-Newsletter mit Infos zum Start der App, Rezepten und Trainingstipps per E-Mail bekommen. Abmelden kann ich mich jederzeit.',
} as const;
