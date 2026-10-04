/**
 * Token und Hashes der Warteliste. In der Datenbank stehen nur HMAC-SHA-256-Hashes (64 Hex-Zeichen) –
 * der Klartext des Tokens steht nur im Link der Bestätigungs-Mail. Auch IP-Adresse und E-Mail landen im
 * Rate-Limit nur als HMAC-Hash (mit eigenem Präfix, damit sich die Hashes nicht vergleichen lassen).
 */
import { createHmac, randomBytes } from 'node:crypto';

/** Gültigkeit des Bestätigungslinks. */
export const WAITLIST_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export { isWellFormedToken } from './token-format';

export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

function hmac(secret: string, purpose: string, value: string): string {
  return createHmac('sha256', secret)
    .update(`alpha5-waitlist:${purpose}\u0000${value}`)
    .digest('hex');
}

export const hashConfirmToken = (secret: string, token: string) => hmac(secret, 'confirm', token);
export const hashUnsubscribeToken = (secret: string, token: string) =>
  hmac(secret, 'unsubscribe', token);
export const hashIp = (secret: string, ip: string) => hmac(secret, 'ip', ip);
export const hashEmail = (secret: string, email: string) => hmac(secret, 'email', email);

/**
 * IP-Adresse des Besuchers hinter Vercel: erster Eintrag von X-Forwarded-For bzw. X-Real-IP (setzt Vercel selbst).
 * Wird nur gehasht weiterverwendet, nie gespeichert oder geloggt.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unbekannt';
}

/** IPv6-Adresse in 8 Blöcke zerlegen („::“ aufgefüllt). null, wenn keine gültige Form. */
function expandIpv6(ip: string): string[] | null {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const blocks = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  return blocks.every((b) => /^[0-9a-f]{1,4}$/i.test(b)) ? blocks : null;
}

/**
 * Für das Rate-Limit: IPv6 auf das /64-Netz kürzen (ein Anschluss hat meist ein ganzes /64 – sonst könnte man
 * das Limit durch Adresswechsel umgehen). IPv4 (auch als ::ffff:a.b.c.d) bleibt vollständig.
 */
export function rateLimitIpKey(ip: string): string {
  const value = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/%.*$/, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) return mapped[1] as string;
  if (!value.includes(':')) return value;
  const blocks = expandIpv6(value);
  if (!blocks) return value;
  return `${blocks
    .slice(0, 4)
    .map((b) => b.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
