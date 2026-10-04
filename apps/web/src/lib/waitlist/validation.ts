import { z } from 'zod';

/** Höchstlänge einer E-Mail-Adresse (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

/**
 * Eingabe des Wartelisten-Formulars. `website` ist der Honeypot: ein für Menschen unsichtbares Feld, das nur
 * Bots ausfüllen. Gefüllt → wir tun so, als hätte alles geklappt (der Bot lernt nichts).
 */
export const waitlistSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(EMAIL_MAX_LENGTH, 'Bitte gib eine gültige E-Mail-Adresse ein.')
    .pipe(z.email('Bitte gib eine gültige E-Mail-Adresse ein.')),
  consent: z.literal(true, 'Bitte bestätige, dass wir dich per E-Mail informieren dürfen.'),
  website: z.string().max(500).optional().default(''),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupSchema>;
