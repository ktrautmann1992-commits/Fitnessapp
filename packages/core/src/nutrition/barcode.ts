import { z } from 'zod';

/**
 * Barcode-Nummern (Etappe E4a, docs/PLAN-E4.md 4.2): Die Person tippt die 8 oder 13 Ziffern unter dem Strichcode ein.
 * Die Prüfziffer prüft schon das Gerät (gleiche Funktion auf dem Server) – eine vertippte Nummer geht nie an Open Food
 * Facts. Laden- und Waagencodes (Frischetheke), Bücher, Zeitschriften und Gutscheine sind keine Lebensmittel-Nummern:
 * keine Abfrage (Datenschutz und OFF-Kontingent).
 *
 * Normalform (so steht die Nummer in food_products.code, food_log_entries.product_code, user_food_products.code und
 * im Favoriten-Schlüssel – CHECK in der Datenbank):
 * - EAN-8 (8 Ziffern) bleibt,
 * - UPC-A (12 Ziffern) wird mit führender 0 zu EAN-13 (GS1: gleiche Nummer, gleiche Prüfziffer),
 * - EAN-13 (13 Ziffern) bleibt,
 * - GTIN-14 (14 Ziffern): mit Indikator 0 → EAN-13 (führende 0 weg), sonst bleibt sie (Umverpackung).
 * UPC-E (6/8 Ziffern komprimiert) liefert nur die Kamera (E4b) – hier nicht.
 */

/** Gespeicherte Form: 8, 13 oder 14 Ziffern (sync: CHECK `^([0-9]{8}|[0-9]{13,14})$`). */
export const BARCODE_PATTERN = /^(\d{8}|\d{13,14})$/;

/** Höchstens so viele Zeichen werden überhaupt angesehen (Eingabe-Schutz). */
export const BARCODE_INPUT_MAX_CHARS = 64;

/**
 * Prüfziffer nach GS1 (Modulo 10) für die Ziffern OHNE Prüfziffer: von rechts abwechselnd × 3 und × 1, Summe auf den
 * nächsten Zehner ergänzen. Quelle: GS1 General Specifications, Abschnitt 7.9 „Check digit calculation“.
 */
export function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** true = die letzte Ziffer ist die richtige GS1-Prüfziffer. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{2,}$/.test(code)) return false;
  return gs1CheckDigit(code.slice(0, -1)) === code.charCodeAt(code.length - 1) - 48;
}

/**
 * Präfixe ohne Lebensmittel-Bezug bzw. nur im Laden gültig (GS1-Präfix-Liste, GS1 General Specifications 1.4.x;
 * VOR LIVEGANG PRÜFEN): Laden-/Waagencodes 020–029, 040–049 und 200–299 (Restricted Circulation Numbers, z. B. Preis
 * oder Gewicht der Frischetheke), Gutscheine 050–059 und 981–984/99, Pfand-/Rückgabebelege 980, Zeitschriften 977
 * (ISSN), Bücher 978/979 (ISBN). Bei EAN-8 sind die Präfixe 0 und 2 Ladencodes (RCN-8). Plan 4.2 nennt 02, 20–29, 977,
 * 978/979, 98/99 – 04x/05x kommen aus derselben GS1-Liste dazu (vorsichtig: lieber keine Abfrage).
 */
function isNonFoodPrefix(code: string): boolean {
  if (code.length === 8) return code.startsWith('0') || code.startsWith('2');
  // GTIN-14: Präfix nach der Indikator-Ziffer.
  const gs1 = code.length === 14 ? code.slice(1) : code;
  const p3 = Number(gs1.slice(0, 3));
  if (p3 >= 20 && p3 <= 29) return true;
  if (p3 >= 40 && p3 <= 59) return true;
  if (p3 >= 200 && p3 <= 299) return true;
  if (p3 === 977 || p3 === 978 || p3 === 979) return true;
  return p3 >= 980;
}

export type BarcodeCheck =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly reason: 'invalid' | 'not_food' };

/**
 * Eingabe → Normalform. Leerzeichen und Bindestriche werden entfernt; sonst nur Ziffern. `invalid` = falsche Länge,
 * falsche Prüfziffer, nur Nullen, Buchstaben, zu lang. `not_food` = Laden-/Waagencode, Buch, Zeitschrift, Gutschein
 * (Hinweis ohne Abfrage).
 */
export function normalizeBarcode(input: unknown): BarcodeCheck {
  if (typeof input !== 'string' || input.length > BARCODE_INPUT_MAX_CHARS) {
    return { ok: false, reason: 'invalid' };
  }
  const digits = input.replace(/[\s-]/gu, '');
  if (!/^\d+$/.test(digits) || /^0+$/.test(digits)) return { ok: false, reason: 'invalid' };
  if (![8, 12, 13, 14].includes(digits.length) || !hasValidCheckDigit(digits)) {
    return { ok: false, reason: 'invalid' };
  }
  let code = digits;
  if (code.length === 12) code = `0${code}`;
  if (code.length === 14 && code.startsWith('0')) code = code.slice(1);
  if (/^0+$/.test(code.slice(0, -1))) return { ok: false, reason: 'invalid' };
  if (isNonFoodPrefix(code)) return { ok: false, reason: 'not_food' };
  return { ok: true, code };
}

/** Gespeicherte Nummer (Normalform, Prüfziffer gültig, kein Ladencode) – Zod für Tagebuch, Favoriten, eigene Produkte. */
export const barcodeSchema = z.string().refine((value) => {
  const check = normalizeBarcode(value);
  return BARCODE_PATTERN.test(value) && check.ok && check.code === value;
}, 'Ungültige Nummer.');
