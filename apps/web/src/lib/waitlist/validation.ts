import { z } from 'zod';

/** Höchstlänge einer E-Mail-Adresse (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, 'Bitte gib eine gültige E-Mail-Adresse ein.')
  .pipe(z.email('Bitte gib eine gültige E-Mail-Adresse ein.'));

/** Honeypot: ein für Menschen unsichtbares Feld, das nur Bots ausfüllen. */
const honeypotSchema = z.string().max(500).optional().default('');

/**
 * Eingabe des Wartelisten-Formulars. `website` ist der Honeypot: Gefüllt → wir tun so, als hätte alles geklappt
 * (der Bot lernt nichts).
 */
export const waitlistSignupSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, 'Bitte bestätige, dass wir dich per E-Mail informieren dürfen.'),
  website: honeypotSchema,
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupSchema>;

/**
 * Eingabe des Formulars „20 Rezepte gratis als PDF“. `consent` (Pflicht) = nur Zusendung des Download-Links;
 * `newsletter` ist freiwillig und standardmäßig AUS (fehlt das Feld → false; nur echtes `true` zählt).
 */
export const leadMagnetSignupSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, 'Bitte bestätige, dass wir dir den Download-Link schicken dürfen.'),
  newsletter: z.boolean('Ungültige Angabe zum Newsletter.').optional().default(false),
  website: honeypotSchema,
});

export type LeadMagnetSignupInput = z.infer<typeof leadMagnetSignupSchema>;
