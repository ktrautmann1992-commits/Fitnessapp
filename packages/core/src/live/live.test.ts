import { describe, expect, it } from 'vitest';

import { LIVE_COMPANION } from '../constants';
import {
  buildLiveShareText,
  buildSosText,
  canChangeLiveStatus,
  clampPlannedMinutes,
  DEFAULT_LIVE_SETTINGS,
  defaultLiveDisplayName,
  defaultLiveMessage,
  LIVE_EMERGENCY_HINT,
  liveAgoText,
  liveClockText,
  liveContactSchema,
  liveContactsSchema,
  liveDeviceDataSchema,
  liveDisplayNameSchema,
  liveDurationText,
  liveLinkUrl,
  liveMapUrl,
  livePhase,
  livePlannedEnd,
  liveSessionExpiry,
  liveSessionHardEnd,
  liveSettingsSchema,
  liveStartResultSchema,
  liveTokenBytes,
  liveTokenFromBytes,
  liveTokenSchema,
  liveViewSchema,
  noSignOfLifeAt,
  noSignOfLifeDue,
  normalizePhoneNumber,
  parseLiveFragment,
  positionStaleness,
  roundLivePosition,
  shouldPushPosition,
  sosLinks,
} from './index';

const H = 3_600_000;
const MIN = 60_000;
const START = Date.parse('2026-10-27T17:00:00Z'); // 18:00 in Berlin (Winterzeit)
const TOKEN = liveTokenFromBytes(new Uint8Array(32).map((_, i) => (i * 37 + 11) % 256));

describe('Pflicht-Grenzen aus CLAUDE.md (Live-Begleitung)', () => {
  it('Token mindestens 128 Bit, Höchstdauer 12 h, Status ohne Karte höchstens 2 h, höchstens 3 Kontakte, Name 30', () => {
    expect(LIVE_COMPANION.tokenBytes * 8).toBeGreaterThanOrEqual(128);
    expect(LIVE_COMPANION.tokenChars).toBe(Math.ceil((LIVE_COMPANION.tokenBytes * 8) / 6));
    expect(LIVE_COMPANION.sessionMaxH).toBeLessThanOrEqual(12);
    expect(LIVE_COMPANION.linkGraceH).toBeLessThanOrEqual(2);
    expect(LIVE_COMPANION.maxContacts).toBeLessThanOrEqual(3);
    expect(LIVE_COMPANION.displayNameMax).toBeLessThanOrEqual(30);
  });

  it('Hinweis „Im Notfall 112“ inkl. Schweiz 144 und Österreich 140', () => {
    expect(LIVE_EMERGENCY_HINT).toContain('112');
    expect(LIVE_EMERGENCY_HINT).toContain('144');
    expect(LIVE_EMERGENCY_HINT).toContain('140');
  });
});

describe('Token', () => {
  it('32 Bytes ↔ 43 Zeichen base64url, hin und zurück', () => {
    expect(TOKEN).toHaveLength(43);
    expect(liveTokenSchema.safeParse(TOKEN).success).toBe(true);
    const bytes = liveTokenBytes(TOKEN);
    expect(bytes).not.toBeNull();
    expect(liveTokenFromBytes(bytes as Uint8Array)).toBe(TOKEN);
  });

  it('gleiche Kodierung wie Node (Buffer base64url)', () => {
    const bytes = new Uint8Array(32).fill(255);
    expect(liveTokenFromBytes(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
    const zero = new Uint8Array(32);
    expect(liveTokenFromBytes(zero)).toBe(Buffer.from(zero).toString('base64url'));
  });

  it('falsche Länge, falsche Zeichen, nicht kanonische Endung → ungültig', () => {
    expect(liveTokenBytes(TOKEN.slice(1))).toBeNull();
    expect(liveTokenBytes(`${TOKEN}A`)).toBeNull();
    expect(liveTokenBytes(`${TOKEN.slice(0, 42)}+`)).toBeNull();
    // letztes Zeichen trägt nur 4 Bit Nutzdaten: „B“ (…01) ist nicht kanonisch
    const canonical = liveTokenFromBytes(new Uint8Array(32));
    expect(liveTokenBytes(`${canonical.slice(0, 42)}B`)).toBeNull();
    expect(liveTokenBytes('demo')).toBeNull();
  });
});

describe('Link und Fragment', () => {
  it('Token steht im Fragment, nie im Pfad', () => {
    const url = liveLinkUrl('https://fitnessapp-web-eight.vercel.app/', TOKEN);
    expect(url).toBe(`https://fitnessapp-web-eight.vercel.app/begleitung#t=${TOKEN}`);
    expect(url?.split('#')[0]).not.toContain(TOKEN);
  });

  it('nur https, gültiges Token', () => {
    expect(liveLinkUrl('http://example.org', TOKEN)).toBeNull();
    expect(liveLinkUrl('https://example.org', 'kurz')).toBeNull();
    expect(liveLinkUrl('https://example.org?x=1', TOKEN)).toBeNull();
    expect(liveLinkUrl('', TOKEN)).toBeNull();
  });

  it('parseLiveFragment: #t=…, mit weiteren Teilen, Demo, Unsinn', () => {
    expect(parseLiveFragment(`#t=${TOKEN}`)).toEqual({ kind: 'token', token: TOKEN });
    expect(parseLiveFragment(`#x=1&t=${TOKEN}`)).toEqual({ kind: 'token', token: TOKEN });
    expect(parseLiveFragment('#t=demo')).toEqual({ kind: 'demo' });
    expect(parseLiveFragment('#t=abc')).toBeNull();
    expect(parseLiveFragment('')).toBeNull();
    expect(parseLiveFragment(null)).toBeNull();
    expect(parseLiveFragment(`#token=${TOKEN}`)).toBeNull();
  });
});

describe('Zeitgrenzen', () => {
  it('offen: Ablauf = Start + 12 h', () => {
    expect(liveSessionExpiry({ startedAt: START, endedAt: null })).toBe(START + 12 * H);
    expect(liveSessionHardEnd(new Date(START).toISOString())).toBe(START + 12 * H);
  });

  it('beendet: Ende + 2 h, aber nie nach Start + 12 h', () => {
    expect(liveSessionExpiry({ startedAt: START, endedAt: START + H })).toBe(START + 3 * H);
    expect(liveSessionExpiry({ startedAt: START, endedAt: START + 11 * H })).toBe(START + 12 * H);
    expect(liveSessionExpiry({ startedAt: START, endedAt: START })).toBe(START + 2 * H);
  });

  it('livePhase: abgelaufen schlägt alles, genau an der Grenze abgelaufen', () => {
    const base = { startedAt: START, endedAt: null };
    expect(livePhase({ ...base, status: 'active', now: START + 12 * H - 1 })).toBe('active');
    expect(livePhase({ ...base, status: 'active', now: START + 12 * H })).toBe('expired');
    expect(livePhase({ ...base, status: 'paused', now: START + H })).toBe('paused');
    expect(
      livePhase({ status: 'arrived', startedAt: START, endedAt: START + H, now: START + 2 * H }),
    ).toBe('arrived');
    expect(
      livePhase({ status: 'arrived', startedAt: START, endedAt: START + H, now: START + 3 * H }),
    ).toBe('expired');
    expect(livePhase({ status: 'ended', startedAt: START, endedAt: null, now: START })).toBe(
      'ended',
    );
  });

  it('geplante Dauer 5–720 min, sonst 60', () => {
    expect(clampPlannedMinutes(null)).toBe(60);
    expect(clampPlannedMinutes(Number.NaN)).toBe(60);
    expect(clampPlannedMinutes(1)).toBe(5);
    expect(clampPlannedMinutes(10_000)).toBe(720);
    expect(clampPlannedMinutes(44.6)).toBe(45);
    expect(livePlannedEnd(START, 45)).toBe(START + 45 * MIN);
  });

  it('Status-Wechsel: nur aus offenen Sitzungen', () => {
    expect(canChangeLiveStatus('active', 'paused')).toBe(true);
    expect(canChangeLiveStatus('paused', 'active')).toBe(true);
    expect(canChangeLiveStatus('active', 'arrived')).toBe(true);
    expect(canChangeLiveStatus('paused', 'ended')).toBe(true);
    expect(canChangeLiveStatus('arrived', 'active')).toBe(false);
    expect(canChangeLiveStatus('ended', 'arrived')).toBe(false);
  });
});

describe('shouldPushPosition (Abstand/Herzschlag)', () => {
  const p = { lat: 50.94133, lng: 6.95828 };
  const moved = { lat: 50.9416, lng: 6.95828 }; // ≈ 30 m nördlich
  const near = { lat: 50.94135, lng: 6.95828 }; // ≈ 2 m

  it('erste Position sofort', () => {
    expect(shouldPushPosition({ last: null, next: p, now: START })).toBe(true);
  });

  it('vor Ablauf des Intervalls nie', () => {
    expect(
      shouldPushPosition({ last: { ...p, sentAt: START }, next: moved, now: START + 29_000 }),
    ).toBe(false);
  });

  it('nach dem Intervall nur bei ≥ 20 m Bewegung', () => {
    expect(
      shouldPushPosition({ last: { ...p, sentAt: START }, next: moved, now: START + 30_000 }),
    ).toBe(true);
    expect(
      shouldPushPosition({ last: { ...p, sentAt: START }, next: near, now: START + 30_000 }),
    ).toBe(false);
  });

  it('Herzschlag nach 60 s auch ohne Bewegung', () => {
    expect(
      shouldPushPosition({ last: { ...p, sentAt: START }, next: near, now: START + 60_000 }),
    ).toBe(true);
  });

  it('Intervall 15/60 s; nie unter der Server-Bremse von 10 s', () => {
    const last = { ...p, sentAt: START };
    expect(shouldPushPosition({ last, next: moved, now: START + 15_000, intervalS: 15 })).toBe(
      true,
    );
    expect(shouldPushPosition({ last, next: moved, now: START + 45_000, intervalS: 60 })).toBe(
      false,
    );
    expect(shouldPushPosition({ last, next: near, now: START + 60_000, intervalS: 60 })).toBe(true);
    expect(shouldPushPosition({ last, next: moved, now: START + 5_000, intervalS: 1 })).toBe(false);
  });

  it('ungültige Koordinaten nie', () => {
    expect(shouldPushPosition({ last: null, next: { lat: 91, lng: 0 }, now: START })).toBe(false);
    expect(shouldPushPosition({ last: null, next: { lat: Number.NaN, lng: 0 }, now: START })).toBe(
      false,
    );
  });
});

describe('roundLivePosition', () => {
  it('5 Nachkommastellen, Genauigkeit ganzzahlig und gekappt', () => {
    expect(roundLivePosition({ lat: 50.941334567, lng: 6.958284444, accuracyM: 7.6 })).toEqual({
      lat: 50.94133,
      lon: 6.95828,
      accuracyM: 8,
    });
    expect(roundLivePosition({ lat: 0, lng: 0, accuracyM: 99_999 })?.accuracyM).toBe(5000);
    expect(roundLivePosition({ lat: 0, lng: 0, accuracyM: -1 })?.accuracyM).toBeNull();
    expect(roundLivePosition({ lat: 0, lng: 0, accuracyM: null })?.accuracyM).toBeNull();
  });

  it('Grenzen ±90/±180 erlaubt, darüber null', () => {
    expect(roundLivePosition({ lat: -90, lng: 180, accuracyM: 1 })).not.toBeNull();
    expect(roundLivePosition({ lat: 90.1, lng: 0, accuracyM: 1 })).toBeNull();
    expect(roundLivePosition({ lat: 0, lng: -180.5, accuracyM: 1 })).toBeNull();
  });
});

describe('positionStaleness', () => {
  it('frisch < 3 min ≤ alt < 15 min ≤ sehr alt', () => {
    expect(positionStaleness(START, START + 179_000)).toBe('fresh');
    expect(positionStaleness(START, START + 180_000)).toBe('stale');
    expect(positionStaleness(new Date(START).toISOString(), START + 899_000)).toBe('stale');
    expect(positionStaleness(START, START + 900_000)).toBe('very_stale');
    // Uhr des Kontakts geht nach: nie negativ
    expect(positionStaleness(START + 10_000, START)).toBe('fresh');
  });
});

describe('„Kein Lebenszeichen“-Erinnerung (nur lokal)', () => {
  const base = { startedAt: START, plannedMinutes: 60, graceMin: 30 };
  it('fällig erst geplante Dauer + 30 min', () => {
    expect(noSignOfLifeDue({ ...base, now: START + 89 * MIN })).toBe(false);
    expect(noSignOfLifeDue({ ...base, now: START + 90 * MIN })).toBe(true);
    expect(noSignOfLifeAt(base)).toBe(START + 90 * MIN);
  });
  it('aus (null) nie; nach „Mir geht’s gut“ erst wieder nach weiteren 30 min', () => {
    expect(noSignOfLifeDue({ ...base, graceMin: null, now: START + 12 * H })).toBe(false);
    expect(noSignOfLifeAt({ ...base, graceMin: null })).toBeNull();
    const ack = START + 95 * MIN;
    expect(noSignOfLifeDue({ ...base, acknowledgedAt: ack, now: ack + 29 * MIN })).toBe(false);
    expect(noSignOfLifeDue({ ...base, acknowledgedAt: ack, now: ack + 30 * MIN })).toBe(true);
  });
  it('ohne geplante Dauer 60 min angenommen', () => {
    expect(noSignOfLifeAt({ ...base, plannedMinutes: null })).toBe(START + 90 * MIN);
  });
});

describe('Texte', () => {
  it('Uhrzeit in Berlin (Winter- und Sommerzeit)', () => {
    expect(liveClockText(START)).toBe('18:00');
    expect(liveClockText('2026-07-01T17:45:00Z')).toBe('19:45');
    expect(liveClockText('kaputt')).toBe('–');
    expect(liveClockText(START, 'Europe/Zurich')).toBe('18:00');
  });

  it('Dauer und „vor …“', () => {
    expect(liveDurationText(30)).toBe('unter 1 Min');
    expect(liveDurationText(25 * 60 + 10)).toBe('25 Min');
    expect(liveDurationText(3600)).toBe('1 Std');
    expect(liveDurationText(3900)).toBe('1 Std 5 Min');
    expect(liveAgoText(2)).toBe('gerade eben');
    expect(liveAgoText(-30)).toBe('gerade eben');
    expect(liveAgoText(20)).toBe('vor 20 s');
    expect(liveAgoText(240)).toBe('vor 4 Min');
  });

  it('Teilen-Text: Sportart, „bis ca.“, Link, nicht weiterleiten; eigener Text ersetzt den Anfang', () => {
    const url = `https://x.example/begleitung#t=${TOKEN}`;
    const text = buildLiveShareText({ sport: 'run', url, plannedEnd: START + 105 * MIN });
    expect(text).toBe(
      `Ich bin laufen. Hier siehst du live, wo ich gerade bin (bis ca. 19:45): ${url}\nBitte nicht weiterleiten.`,
    );
    expect(buildLiveShareText({ sport: 'bike', url, plannedEnd: START })).toContain(
      'Ich bin mit dem Rad unterwegs.',
    );
    expect(defaultLiveMessage('walk')).toContain('zu Fuß');
    expect(
      buildLiveShareText({ sport: 'walk', url, plannedEnd: START, message: '  Bin wandern  ' }),
    ).toMatch(/^Bin wandern \(bis ca\. 18:00\): /);
  });

  it('SOS-Text: OSM-Link + Uhrzeit, ohne Position Hinweis, keine Gesundheitswerte', () => {
    const text = buildSosText({ position: { lat: 50.941334, lng: 6.958284, t: START + 21 * MIN } });
    expect(text).toBe(
      'SOS – ich brauche Hilfe. Mein letzter Standort: https://www.openstreetmap.org/?mlat=50.94133&mlon=6.95828#map=17/50.94133/6.95828 (Stand 18:21)',
    );
    expect(buildSosText({ position: null })).toBe(
      'SOS – ich brauche Hilfe. Mein Standort ist gerade nicht bekannt.',
    );
    expect(buildSosText({ position: null, liveUrl: 'https://x/begleitung#t=a' })).toContain(
      'Live: https://x/begleitung#t=a',
    );
    expect(text).not.toMatch(/puls|kcal|bpm|pace|km\/h|gewicht/i);
    expect(liveMapUrl(1, 2)).toBe(
      'https://www.openstreetmap.org/?mlat=1.00000&mlon=2.00000#map=17/1.00000/2.00000',
    );
  });

  it('Anzeigename: Vorname, bereinigt, höchstens 30 Zeichen', () => {
    expect(defaultLiveDisplayName('  Karsten ')).toBe('Karsten');
    expect(defaultLiveDisplayName('Anna\tMaria')).toBe('Anna Maria');
    expect(defaultLiveDisplayName('')).toBeNull();
    expect(defaultLiveDisplayName(null)).toBeNull();
    expect(defaultLiveDisplayName('x'.repeat(40))).toHaveLength(30);
    expect(liveDisplayNameSchema.safeParse('x'.repeat(31)).success).toBe(false);
    expect(liveDisplayNameSchema.safeParse(' ').success).toBe(false);
    expect(liveDisplayNameSchema.safeParse('A\u0007').success).toBe(false);
    expect(liveDisplayNameSchema.parse('  Jo ')).toBe('Jo');
  });
});

describe('Telefonnummern und SOS-Links', () => {
  it('normalizePhoneNumber: DACH, international, Unsinn', () => {
    expect(normalizePhoneNumber('0171 1234567')).toBe('+491711234567');
    expect(normalizePhoneNumber('0664 1234567', 'AT')).toBe('+436641234567');
    expect(normalizePhoneNumber('079 123 45 67', 'CH')).toBe('+41791234567');
    expect(normalizePhoneNumber('+49 (0) 171 / 123-4567')).toBe('+491711234567');
    expect(normalizePhoneNumber('0043 664 1234567')).toBe('+436641234567');
    expect(normalizePhoneNumber('1234567')).toBeNull();
    expect(normalizePhoneNumber('abc')).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('+0 123456789')).toBeNull();
    expect(normalizePhoneNumber('+49 1')).toBeNull();
  });

  it('sosLinks: SMS (iOS &body, sonst ?body), WhatsApp, Anruf, E-Mail, 112', () => {
    const contact = { phone: '+491711234567', email: 'anna@example.org' };
    const ios = sosLinks({ contact, text: 'SOS & Hilfe', platform: 'ios' });
    expect(ios.sms).toBe('sms:+491711234567&body=SOS%20%26%20Hilfe');
    const android = sosLinks({ contact, text: 'SOS', platform: 'android' });
    expect(android.sms).toBe('sms:+491711234567?body=SOS');
    expect(android.whatsapp).toBe('whatsapp://send?phone=491711234567&text=SOS');
    expect(android.whatsappWeb).toBe('https://wa.me/491711234567?text=SOS');
    expect(android.call).toBe('tel:+491711234567');
    expect(android.email).toBe('mailto:anna@example.org?subject=SOS&body=SOS');
    expect(android.emergency).toBe('tel:112');
    const none = sosLinks({ contact: null, text: 'SOS', platform: 'web' });
    expect(none).toEqual({
      sms: null,
      whatsapp: null,
      whatsappWeb: null,
      call: null,
      email: null,
      emergency: 'tel:112',
    });
  });
});

describe('Schemas', () => {
  const contact = {
    id: 'k1',
    name: 'Anna',
    phone: '+491711234567',
    email: null,
    isDefault: true,
  };

  it('Kontakt: Telefon ODER E-Mail, E.164', () => {
    expect(liveContactSchema.safeParse(contact).success).toBe(true);
    expect(liveContactSchema.safeParse({ ...contact, phone: null }).success).toBe(false);
    expect(liveContactSchema.safeParse({ ...contact, phone: '0171 123' }).success).toBe(false);
    expect(
      liveContactSchema.safeParse({ ...contact, phone: null, email: 'anna@example.org' }).success,
    ).toBe(true);
    expect(liveContactSchema.safeParse({ ...contact, extra: 1 }).success).toBe(false);
  });

  it('Kontakte: höchstens 3, ein Standard, eindeutige ids', () => {
    const list = [1, 2, 3].map((i) => ({ ...contact, id: `k${i}`, isDefault: i === 1 }));
    expect(liveContactsSchema.safeParse(list).success).toBe(true);
    expect(
      liveContactsSchema.safeParse([...list, { ...contact, id: 'k4', isDefault: false }]).success,
    ).toBe(false);
    expect(liveContactsSchema.safeParse(list.map((c) => ({ ...c, isDefault: true }))).success).toBe(
      false,
    );
    expect(liveContactsSchema.safeParse([contact, contact]).success).toBe(false);
    expect(liveContactsSchema.safeParse([]).success).toBe(true);
  });

  it('Einstellungen und Gerätespeicher', () => {
    expect(liveSettingsSchema.safeParse(DEFAULT_LIVE_SETTINGS).success).toBe(true);
    expect(liveSettingsSchema.safeParse({ ...DEFAULT_LIVE_SETTINGS, intervalS: 20 }).success).toBe(
      false,
    );
    expect(
      liveSettingsSchema.safeParse({ ...DEFAULT_LIVE_SETTINGS, noSignOfLifeMin: null }).success,
    ).toBe(true);
    expect(
      liveDeviceDataSchema.safeParse({ v: 1, contacts: [contact], settings: DEFAULT_LIVE_SETTINGS })
        .success,
    ).toBe(true);
  });

  it('Start-Antwort', () => {
    const ok = {
      id: '0b7c2f7e-3e1f-4f55-9a3b-1c2d3e4f5a6b',
      token: TOKEN,
      started_at: '2026-10-27T17:00:00+00:00',
      planned_end_at: '2026-10-27T18:00:00+00:00',
      expires_at: '2026-10-28T05:00:00+00:00',
    };
    expect(liveStartResultSchema.safeParse(ok).success).toBe(true);
    expect(liveStartResultSchema.safeParse({ ...ok, token: 'x' }).success).toBe(false);
  });

  it('Ansicht des Kontakts: abgeschlossen NIE mit Koordinaten, keine Zusatzfelder', () => {
    const base = {
      display_name: 'Karsten',
      sport: 'run',
      started_at: '2026-10-27T17:00:00Z',
      server_time: '2026-10-27T17:20:00Z',
    };
    const position = {
      lat: 50.94133,
      lon: 6.95828,
      accuracy_m: 8,
      recorded_at: '2026-10-27T17:19:40Z',
    };
    expect(liveViewSchema.safeParse({ state: 'active', ...base, position }).success).toBe(true);
    expect(liveViewSchema.safeParse({ state: 'paused', ...base, position: null }).success).toBe(
      true,
    );
    expect(
      liveViewSchema.safeParse({ state: 'arrived', ...base, ended_at: base.server_time }).success,
    ).toBe(true);
    expect(
      liveViewSchema.safeParse({ state: 'arrived', ...base, ended_at: base.server_time, position })
        .success,
    ).toBe(false);
    expect(
      liveViewSchema.safeParse({ state: 'active', ...base, position, heart_rate: 150 }).success,
    ).toBe(false);
    expect(liveViewSchema.safeParse({ state: 'invalid' }).success).toBe(true);
    expect(liveViewSchema.safeParse({ state: 'invalid', display_name: 'x' }).success).toBe(false);
  });
});
