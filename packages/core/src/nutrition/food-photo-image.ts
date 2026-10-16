import { AI_FOOD_PHOTO } from '../constants';

/**
 * Bildprüfung für „Per Foto“ (Etappe E3, Plan 9): Art am Dateianfang erkennen (nicht am Dateinamen oder an der
 * Angabe des Geräts), Größe und Seitenlänge prüfen und Metadaten (EXIF mit Standort, XMP, IPTC, Kommentare, Text)
 * entfernen. Läuft auf dem Gerät (Testmodus) und auf dem Server (vor dem Senden an den KI-Anbieter) – „Gerät und
 * nochmals Server“. Reine Byte-Logik ohne Abhängigkeiten; das Bild selbst wird nicht neu kodiert.
 */

export type PhotoMimeType = (typeof AI_FOOD_PHOTO.imageMimeTypes)[number];

export type PhotoImageCheck =
  | {
      readonly ok: true;
      readonly mimeType: PhotoMimeType;
      readonly width: number;
      readonly height: number;
      /** Bild ohne Metadaten (neues Array). */
      readonly bytes: Uint8Array;
    }
  | { readonly ok: false; readonly reason: 'type' | 'too_big' | 'too_large_px' | 'broken' };

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));
const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u32be = (b: Uint8Array, at: number) =>
  (((b[at] ?? 0) << 24) | ((b[at + 1] ?? 0) << 16) | ((b[at + 2] ?? 0) << 8) | (b[at + 3] ?? 0)) >>>
  0;
const u32le = (b: Uint8Array, at: number) =>
  ((b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16) | ((b[at + 3] ?? 0) << 24)) >>>
  0;
const u24le = (b: Uint8Array, at: number) =>
  (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);

/** Bildart am Dateianfang; null = nicht JPEG/PNG/WebP. */
export function detectPhotoType(bytes: Uint8Array): PhotoMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && ascii(bytes, 1, 3) === 'PNG' && bytes[0] === 0x89) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

class BrokenImage extends Error {}

// --- JPEG: alle Marker-Segmente bis zum ERSTEN Bildende (EOI) durchgehen ---

/** Metadaten-Marker: APP1–APP15 (EXIF, XMP, MPF, IPTC, ICC …) und COM. APP0 (JFIF) bleibt. */
const isJpegMetadata = (marker: number) => (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;

/**
 * Entfernt APP1–APP15 und COM überall – vor dem ersten Scan UND zwischen den Scans eines progressiven JPEG (Wächter E3
 * M1). Die Bilddaten (Entropie-Daten mit FF00 und RST-Markern) werden bis zum ersten EOI übernommen; alles danach wird
 * abgeschnitten (angehängte zweite JPEGs von Motion Photos, MPF-Folgebilder, Gain-Maps – samt deren EXIF/GPS).
 * Ohne EOI gilt die Datei als kaputt (sichere Richtung).
 */
function stripJpeg(bytes: Uint8Array): { bytes: Uint8Array; width: number; height: number } {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let at = 2;
  let scanned = false;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) throw new BrokenImage();
    const marker = bytes[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1; // Füllbyte
      continue;
    }
    if (marker === 0xd9) {
      // Erstes Bildende: übernehmen, alles danach abschneiden.
      if (!scanned || width === 0 || height === 0) throw new BrokenImage();
      parts.push(bytes.subarray(at, at + 2));
      return { bytes: concat(parts), width, height };
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0x01) {
      throw new BrokenImage();
    }
    const length = u16be(bytes, at + 2);
    if (length < 2 || at + 2 + length > bytes.length) throw new BrokenImage();
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      height = u16be(bytes, at + 5);
      width = u16be(bytes, at + 7);
    }
    if (!isJpegMetadata(marker)) parts.push(bytes.subarray(at, at + 2 + length));
    at += 2 + length;
    if (marker === 0xda) {
      // Entropie-Daten bis zum nächsten echten Marker: FF00 (Byte-Stuffing), RST0–7 und Füllbytes gehören dazu.
      scanned = true;
      const start = at;
      while (at < bytes.length) {
        if (bytes[at] !== 0xff) {
          at += 1;
          continue;
        }
        const next = bytes[at + 1];
        if (next === undefined) throw new BrokenImage();
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          at += 2;
          continue;
        }
        if (next === 0xff) {
          at += 1;
          continue;
        }
        break;
      }
      parts.push(bytes.subarray(start, at));
    }
  }
  throw new BrokenImage();
}

// --- PNG: nur bekannte Bild-Chunks behalten ---

/** Erlaubte Chunks (Bild und Darstellung). Text (tEXt, zTXt, iTXt), eXIf, tIME, iCCP u. a. fallen weg. */
const PNG_KEEP = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'cHRM',
  'sRGB',
  'sBIT',
  'bKGD',
  'pHYs',
]);

function stripPng(bytes: Uint8Array): { bytes: Uint8Array; width: number; height: number } {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  let width = 0;
  let height = 0;
  let ended = false;
  while (at + 12 <= bytes.length) {
    const length = u32be(bytes, at);
    const type = ascii(bytes, at + 4, 4);
    const end = at + 12 + length;
    if (end > bytes.length) throw new BrokenImage();
    if (type === 'IHDR') {
      width = u32be(bytes, at + 8);
      height = u32be(bytes, at + 12);
    }
    if (PNG_KEEP.has(type)) parts.push(bytes.subarray(at, end));
    at = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended || width === 0 || height === 0) throw new BrokenImage();
  return { bytes: concat(parts), width, height };
}

// --- WebP: nur bekannte Bild-Chunks, nur bis zum RIFF-Ende (Wächter E3 N3) ---

/**
 * Erlaubte Chunks: Bild (VP8, VP8L), Kopf (VP8X), Transparenz (ALPH), Animation (ANIM, ANMF). EXIF, XMP, ICCP und alle
 * unbekannten Chunks fallen weg; die Merker für EXIF (0x08), XMP (0x04) und ICC (0x20) im VP8X-Kopf werden gelöscht.
 * Daten nach dem RIFF-Ende werden abgeschnitten.
 */
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF']);

function stripWebp(bytes: Uint8Array): { bytes: Uint8Array; width: number; height: number } {
  const riffEnd = 8 + u32le(bytes, 4);
  if (riffEnd > bytes.length || riffEnd < 12) throw new BrokenImage();
  const chunks: Uint8Array[] = [];
  let at = 12;
  let width = 0;
  let height = 0;
  while (at + 8 <= riffEnd) {
    const type = ascii(bytes, at, 4);
    const size = u32le(bytes, at + 4);
    const end = at + 8 + size + (size % 2);
    if (at + 8 + size > riffEnd) throw new BrokenImage();
    const chunk = bytes.slice(at, Math.min(end, riffEnd));
    if (type === 'VP8X') {
      chunk[8] = (chunk[8] ?? 0) & ~(0x08 | 0x04 | 0x20); // EXIF-, XMP- und ICC-Merker
      width = u24le(chunk, 12) + 1;
      height = u24le(chunk, 15) + 1;
    } else if (type === 'VP8 ' && width === 0) {
      width = u16le(chunk, 14) & 0x3fff || 0;
      height = u16le(chunk, 16) & 0x3fff || 0;
    } else if (type === 'VP8L' && width === 0) {
      const bits = u32le(chunk, 9);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
    if (WEBP_KEEP.has(type)) chunks.push(chunk);
    at = end;
  }
  if (chunks.length === 0 || width === 0 || height === 0) throw new BrokenImage();
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  const riffSize = body.length + 4;
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >>> 8) & 0xff;
  header[6] = (riffSize >>> 16) & 0xff;
  header[7] = (riffSize >>> 24) & 0xff;
  return { bytes: concat([header, body]), width, height };
}

const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * Bild prüfen und Metadaten entfernen: Art JPEG/PNG/WebP (am Inhalt erkannt), höchstens 4 MB, längste Seite höchstens
 * 1.024 px (das Gerät verkleinert vorher). Ergebnis ist eine bereinigte Kopie.
 */
export function checkPhotoImage(bytes: Uint8Array): PhotoImageCheck {
  if (bytes.length > AI_FOOD_PHOTO.maxImageBytes) return { ok: false, reason: 'too_big' };
  const mimeType = detectPhotoType(bytes);
  if (mimeType === null) return { ok: false, reason: 'type' };
  let stripped: { bytes: Uint8Array; width: number; height: number };
  try {
    stripped =
      mimeType === 'image/jpeg'
        ? stripJpeg(bytes)
        : mimeType === 'image/png'
          ? stripPng(bytes)
          : stripWebp(bytes);
  } catch {
    return { ok: false, reason: 'broken' };
  }
  if (Math.max(stripped.width, stripped.height) > AI_FOOD_PHOTO.maxImagePx) {
    return { ok: false, reason: 'too_large_px' };
  }
  return { ok: true, mimeType, ...stripped };
}
