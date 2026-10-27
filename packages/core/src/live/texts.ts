import { AGE_CHECK_TIME_ZONE, LIVE_COMPANION } from '../constants';
import { liveTokenSchema, type LiveSport } from './schema';

/**
 * Live-Begleitung: Texte und Links (docs/PLAN-PHASE-10.md 21.2/21.3). Der Link enthält das Token NUR im Fragment
 * (`/begleitung#t=…`, F5) – Browser schicken das Fragment nie an den Server, es steht in keinem Log und keinem Referer.
 * SOS-Texte enthalten nur den letzten Standort als OpenStreetMap-Link und die Uhrzeit – nie Gesundheitswerte, Pace oder
 * Strecke. Versand immer durch die Person selbst (System-App), nie durch unseren Server.
 */

const L = LIVE_COMPANION;

/** Pfad der Begleit-Seite (apps/web). */
export const LIVE_PAGE_PATH = '/begleitung';

/** Fester Hinweis (App und Begleit-Seite): kein Notruf-Ersatz. */
export const LIVE_EMERGENCY_HINT =
  'Im Notfall immer 112 anrufen (Schweiz: 144 Sanität oder 112, Österreich: 140 Bergrettung oder 112).';

/** Uhrzeit „19:45“ (Standard Europe/Berlin). */
export function liveClockText(
  time: string | number,
  timeZone: string = AGE_CHECK_TIME_ZONE,
): string {
  const value = typeof time === 'number' ? time : Date.parse(time);
  if (!Number.isFinite(value)) return '–';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(value));
}

/** Dauer „25 Min“, „1 Std 5 Min“, „unter 1 Min“. */
export function liveDurationText(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  if (s < 60) return 'unter 1 Min';
  const totalMin = Math.floor(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} Min`;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

/** „vor 20 s“, „vor 4 Min“, „vor 1 Std 5 Min“ (Zukunft durch Uhr-Abweichung → „gerade eben“). */
export function liveAgoText(seconds: number): string {
  const s = Math.floor(Number.isFinite(seconds) ? seconds : 0);
  if (s < 5) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  return `vor ${liveDurationText(s)}`;
}

/** Link zur Begleit-Seite mit dem Token im Fragment; null bei ungültiger Adresse oder ungültigem Token. */
export function liveLinkUrl(baseUrl: string, token: string): string | null {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/#?]+(\/[^\s#?]*)?$/.test(base)) return null;
  if (!liveTokenSchema.safeParse(token).success) return null;
  return `${base}${LIVE_PAGE_PATH}#t=${token}`;
}

/** Ergebnis von parseLiveFragment: echtes Token oder die Demo (Testmodus der App). */
export type LiveFragment = { kind: 'token'; token: string } | { kind: 'demo' };

/** Token aus dem Fragment lesen (`#t=…`, auch mit weiteren Teilen `&…`). „#t=demo“ = Demo. Sonst null. */
export function parseLiveFragment(hash: string | null | undefined): LiveFragment | null {
  if (!hash) return null;
  const parts = hash.replace(/^#/, '').split('&');
  for (const part of parts) {
    if (!part.startsWith('t=')) continue;
    const value = part.slice(2);
    if (value === 'demo') return { kind: 'demo' };
    return liveTokenSchema.safeParse(value).success ? { kind: 'token', token: value } : null;
  }
  return null;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Token (base64url) → 32 Bytes; null bei ungültigem Token. Der Server speichert nur SHA-256 dieser Bytes. */
export function liveTokenBytes(token: string): Uint8Array | null {
  if (!liveTokenSchema.safeParse(token).success) return null;
  const out = new Uint8Array(L.tokenBytes);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of token) {
    buffer = (buffer << 6) | B64URL.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (index < out.length) out[index] = (buffer >> bits) & 0xff;
      index += 1;
    }
    buffer &= (1 << bits) - 1;
  }
  // 43 Zeichen = 258 Bit: die letzten 2 Bit müssen 0 sein (kanonische Form, sonst gäbe es 4 Schreibweisen je Token).
  return index === L.tokenBytes && buffer === 0 ? out : null;
}

/** Bytes → base64url ohne Auffüllung (Gegenstück zu liveTokenBytes, z. B. für Tests und die Demo). */
export function liveTokenFromBytes(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += B64URL[(buffer >> bits) & 0x3f];
    }
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) out += B64URL[(buffer << (6 - bits)) & 0x3f];
  return out;
}

const SPORT_INTRO: Record<LiveSport, string> = {
  run: 'Ich bin laufen.',
  bike: 'Ich bin mit dem Rad unterwegs.',
  walk: 'Ich bin zu Fuß unterwegs.',
};

/** Standardtext vor dem Link (anpassbar in den Einstellungen). */
export function defaultLiveMessage(sport: LiveSport): string {
  return `${SPORT_INTRO[sport]} Hier siehst du live, wo ich gerade bin`;
}

/**
 * Text für den System-Teilen-Dialog: „Ich bin laufen. Hier siehst du live, wo ich gerade bin (bis ca. 19:45):
 * https://…/begleitung#t=… – Bitte nicht weiterleiten.“ Eigener Text ersetzt den Anfang.
 */
export function buildLiveShareText(input: {
  sport: LiveSport;
  url: string;
  plannedEnd: string | number;
  message?: string | null;
  timeZone?: string;
}): string {
  const intro = input.message?.trim() || defaultLiveMessage(input.sport);
  const until = liveClockText(input.plannedEnd, input.timeZone);
  return `${intro} (bis ca. ${until}): ${input.url}\nBitte nicht weiterleiten.`;
}

/** OpenStreetMap-Link auf einen Punkt (funktioniert in jedem Browser, ohne App). */
export function liveMapUrl(lat: number, lon: number): string {
  const f = (x: number) => x.toFixed(L.coordDecimals);
  return `https://www.openstreetmap.org/?mlat=${f(lat)}&mlon=${f(lon)}#map=17/${f(lat)}/${f(lon)}`;
}

/**
 * SOS-Text: „SOS – ich brauche Hilfe. Mein letzter Standort: https://www.openstreetmap.org/… (Stand 19:21)“. Ohne
 * bekannte Position der Hinweis darauf; mit laufender Begleitung zusätzlich deren Link. Keine Gesundheitswerte.
 */
export function buildSosText(input: {
  position: { lat: number; lng: number; t: number } | null;
  liveUrl?: string | null;
  timeZone?: string;
}): string {
  const parts = ['SOS – ich brauche Hilfe.'];
  const p = input.position;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
    parts.push(
      `Mein letzter Standort: ${liveMapUrl(p.lat, p.lng)} (Stand ${liveClockText(p.t, input.timeZone)})`,
    );
  } else {
    parts.push('Mein Standort ist gerade nicht bekannt.');
  }
  if (input.liveUrl) parts.push(`Live: ${input.liveUrl}`);
  return parts.join(' ');
}

/** Ländervorwahl für Nummern mit führender 0 (DACH). */
export const LIVE_PHONE_COUNTRIES = { DE: '49', AT: '43', CH: '41' } as const;
export type LivePhoneCountry = keyof typeof LIVE_PHONE_COUNTRIES;

/**
 * Telefonnummer ins internationale Format (E.164) bringen: „0171 1234567“ → „+491711234567“ (Land Deutschland),
 * „0043 664 …“/„+43 664 …“ bleiben, „+49 (0) 171 …“ ohne die (0). null, wenn keine gültige Nummer.
 */
export function normalizePhoneNumber(
  input: string,
  country: LivePhoneCountry = 'DE',
): string | null {
  const trimmed = input.trim().replace(/\(0\)/g, '');
  if (trimmed === '' || !/^\+?[\d\s()/.-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/[^\d]/g, '');
  if (trimmed.startsWith('+')) {
    // schon international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = LIVE_PHONE_COUNTRIES[country] + digits.slice(1);
  } else {
    return null;
  }
  const e164 = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export type LivePlatform = 'ios' | 'android' | 'web';

/** Links des SOS-Blatts: öffnen NUR die System-App mit vorbereitetem Text – senden/anrufen tippt die Person selbst. */
export interface SosLinks {
  readonly sms: string | null;
  readonly whatsapp: string | null;
  /** Ersatz, wenn WhatsApp nicht installiert ist bzw. im Browser. */
  readonly whatsappWeb: string | null;
  readonly call: string | null;
  readonly email: string | null;
  /** Notruf (112). */
  readonly emergency: string;
}

export function sosLinks(input: {
  contact: { phone: string | null; email: string | null } | null;
  text: string;
  platform: LivePlatform;
}): SosLinks {
  const body = encodeURIComponent(input.text);
  const phone = input.contact?.phone ?? null;
  const email = input.contact?.email ?? null;
  const digits = phone?.replace(/^\+/, '') ?? null;
  return {
    // iOS erwartet „&body=“, Android und Browser „?body=“.
    sms: phone ? `sms:${phone}${input.platform === 'ios' ? '&' : '?'}body=${body}` : null,
    whatsapp: digits ? `whatsapp://send?phone=${digits}&text=${body}` : null,
    whatsappWeb: digits ? `https://wa.me/${digits}?text=${body}` : null,
    call: phone ? `tel:${phone}` : null,
    email: email ? `mailto:${email}?subject=${encodeURIComponent('SOS')}&body=${body}` : null,
    emergency: `tel:${L.emergencyNumber}`,
  };
}

/** Anzeigename vorschlagen: Vorname aus dem Profil, Leerzeichen bereinigt, höchstens 30 Zeichen; leer → null. */
export function defaultLiveDisplayName(firstName: string | null | undefined): string | null {
  const clean = (firstName ?? '')
    // eslint-disable-next-line no-control-regex -- Steuerzeichen entfernen
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean === '') return null;
  return [...clean].slice(0, L.displayNameMax).join('').trim();
}
