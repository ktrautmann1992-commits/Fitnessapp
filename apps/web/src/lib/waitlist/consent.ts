/**
 * Einwilligungstext der Warteliste (Text aus docs/ALPHA5-PAKET.md). Gespeichert wird die Version.
 * Text ändern = Version erhöhen (alte Einträge behalten ihre Version).
 */
export const WAITLIST_CONSENT = {
  version: 1,
  text: 'Ich möchte per E-Mail über den Start von Alpha5 informiert werden. Abmelden kann ich mich jederzeit. Es gilt die Datenschutzerklärung.',
} as const;
