/**
 * Passwortprüfung in konstanter Zeit (docs/PLAN-PHASE-2.md Abschnitt 6, Stufe A, Punkt 3):
 * Eingabe und hinterlegtes Passwort werden zuerst per HMAC-SHA256 auf gleiche Länge (32 Byte) gebracht,
 * dann mit timingSafeEqual verglichen. So verrät weder die Länge noch die Position eines Unterschieds etwas.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AdminCredentials } from './config';

/** Längere Eingaben werden gar nicht erst verglichen (Schutz vor Riesen-Formularen). */
export const ADMIN_PASSWORD_INPUT_MAX_LENGTH = 1024;
/** Verzögerung nach einem Fehlversuch (Plan: ca. 1 Sekunde). */
export const FAILED_LOGIN_DELAY_MS = 1000;

function digest(credentials: AdminCredentials, value: string): Buffer {
  // Eigener Schlüssel (abgeleitet aus ADMIN_SESSION_SECRET), getrennt vom Sitzungs-Schlüssel.
  const key = createHmac('sha256', credentials.sessionSecret)
    .update('fitnessapp-admin-password-compare-v1')
    .digest();
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

/** true = Eingabe entspricht dem Passwort. */
export function verifyAdminPassword(credentials: AdminCredentials, input: unknown): boolean {
  const candidate =
    typeof input === 'string' && input.length <= ADMIN_PASSWORD_INPUT_MAX_LENGTH ? input : '';
  // Auch bei ungültiger Eingabe wird verglichen (gleicher Rechenaufwand); leer passt nie (Mindestlänge 20).
  const equal = timingSafeEqual(
    digest(credentials, candidate),
    digest(credentials, credentials.password),
  );
  return equal && candidate.length > 0;
}
