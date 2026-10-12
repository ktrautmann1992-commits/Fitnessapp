/**
 * Format der geladenen Antwort erkennen (docs/PLAN-PHASE-5.md, Umsetzungsstand N2b – Quelle auf blsdb.de):
 *
 * - xlsx direkt (ZIP mit `[Content_Types].xml` und `xl/…`) → unverändert übernehmen;
 * - ZIP-Archiv mit den Daten → genau EINE passende Datei (Endung wie `format` in sources.ts; ein Eintrag mit dem
 *   Namen `originalFilename` hat Vorrang) entpacken – mit dem eigenen ZIP-Leser aus xlsx.ts;
 * - csv direkt (nur bei `format: 'csv'`);
 * - sonst (Webseite, Challenge, unbekanntes Archiv) → Abbruch mit Beschreibung (Status, Typ, Größe, Dateiname,
 *   Einträge).
 *
 * „Original-Datei“ (SHA-256 in SOURCE.json, Zeilenvergleich in sources-integrity) ist immer die xlsx- bzw.
 * csv-Datei selbst – bei einem ZIP der entpackte Eintrag, damit die Prüfsumme nicht an Zeitstempeln des Archivs
 * hängt.
 */
import { CHALLENGE_MESSAGE, detectChallenge, maskUrl, SourceDownloadError } from './download-page';
import type { SourceDefinition } from './sources';
import {
  isXlsxArchive,
  readXlsxRows,
  readXlsxSheetNames,
  readZipEntries,
  readZipEntry,
  type ZipEntry,
} from './xlsx';

export interface ResponseMeta {
  readonly status: number;
  readonly contentType: string | null;
  readonly contentDisposition: string | null;
  /** Adresse nach Weiterleitungen (Codes gekürzt). */
  readonly finalUrl: string;
}

export interface UnpackedOriginal {
  /** Die Datei, deren Zeilen gelesen werden (xlsx bzw. csv). */
  readonly data: Buffer;
  /** Dateiname (ZIP-Eintrag, sonst laut Content-Disposition); null = unbekannt. */
  readonly filename: string | null;
  readonly container: 'datei' | 'zip';
  /** Protokoll für die Zusammenfassung (Markdown-Listenpunkte ohne „- “). */
  readonly details: string[];
}

/** Dateiname aus `Content-Disposition` (filename* nach RFC 5987 hat Vorrang); nur der Name, ohne Pfad. */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (header === null) {
    return null;
  }
  let name: string | undefined;
  const star = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(header);
  if (star?.[1] !== undefined) {
    try {
      name = decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {
      name = star[1].trim();
    }
  }
  if (name === undefined) {
    const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(header);
    name = (plain?.[1] ?? plain?.[2])?.trim();
  }
  if (name === undefined || name === '') {
    return null;
  }
  const base = name.split(/[\\/]/).pop() ?? '';
  return base.replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 200) || null;
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Einträge eines Archivs für die Diagnose (Name und Größe, höchstens 50). */
export function describeEntries(entries: ReadonlyMap<string, ZipEntry>): string {
  const list = [...entries.values()];
  const shown = list.slice(0, 50).map((e) => `\`${e.name}\` (${e.uncompressedSize} Bytes)`);
  return `${list.length} Einträge: ${shown.join(', ')}${list.length > 50 ? ', …' : ''}`;
}

/** Druckbarer Anfang einer Antwort (keine Geheimnisse, nur öffentliche Server-Antwort). */
export function printableStart(buffer: Buffer, length = 160): string {
  return buffer
    .subarray(0, length)
    .toString('utf8')
    .replace(/[^\x20-\x7EÀ-ſ]+/g, ' ')
    .trim();
}

function describe(meta: ResponseMeta, buffer: Buffer, filename: string | null): string[] {
  return [
    `HTTP ${meta.status}`,
    `Typ ${meta.contentType ?? 'unbekannt'}`,
    `Größe ${buffer.length} Bytes`,
    `Dateiname laut Server ${filename ?? 'keiner'}`,
    `Adresse ${maskUrl(meta.finalUrl)}`,
  ];
}

function isZip(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

function looksLikeHtml(buffer: Buffer, contentType: string | null): boolean {
  if (contentType !== null && /text\/html|application\/xhtml/i.test(contentType)) {
    return true;
  }
  const start = buffer
    .subarray(0, 512)
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart();
  return /^<(!doctype html|html|head|body)\b/i.test(start);
}

/** Antwort auswerten: Datei zurückgeben oder mit Beschreibung abbrechen. */
export function unpackOriginal(
  buffer: Buffer,
  def: Pick<SourceDefinition, 'format' | 'originalFilename'>,
  meta: ResponseMeta,
): UnpackedOriginal {
  const served = filenameFromContentDisposition(meta.contentDisposition);
  const info = describe(meta, buffer, served);
  const details = [
    `Antwort: ${info.join(', ')}`,
    ...(served === null ? [] : [`Dateiname laut Server (Content-Disposition): \`${served}\``]),
  ];
  if (!isZip(buffer)) {
    if (looksLikeHtml(buffer, meta.contentType)) {
      const html = buffer.toString('utf8');
      const challenge = detectChallenge(html, meta.finalUrl);
      if (challenge !== null) {
        throw new SourceDownloadError(`${CHALLENGE_MESSAGE} (${challenge})`, [
          `Antwort: ${info.join(', ')}`,
          `Anfang „${printableStart(buffer)}“`,
        ]);
      }
      throw new SourceDownloadError(
        `Der Server liefert eine Webseite statt der Datei (${info.join(', ')}).`,
        [`Antwort: ${info.join(', ')}`, `Anfang „${printableStart(buffer)}“`],
      );
    }
    if (def.format === 'csv') {
      return { data: buffer, filename: served, container: 'datei', details };
    }
    throw new SourceDownloadError(
      `Antwort ist weder xlsx noch ZIP (${info.join(', ')}, Anfang „${printableStart(buffer, 60)}“).`,
      [`Antwort: ${info.join(', ')}`, `Anfang „${printableStart(buffer)}“`],
    );
  }

  let entries: Map<string, ZipEntry>;
  try {
    entries = readZipEntries(buffer);
  } catch (error) {
    throw new SourceDownloadError(
      `ZIP-Antwort nicht lesbar: ${(error as Error).message} (${info.join(', ')})`,
      [`Antwort: ${info.join(', ')}`],
    );
  }
  const listing = describeEntries(entries);
  if (isXlsxArchive(entries)) {
    if (def.format !== 'xlsx') {
      throw new SourceDownloadError(
        `Antwort ist eine xlsx-Datei, sources.ts erwartet ${def.format}.`,
        [`Antwort: ${info.join(', ')}`, `ZIP: ${listing}`],
      );
    }
    return { data: buffer, filename: served, container: 'datei', details };
  }

  const extension = `.${def.format}`;
  const candidates = [...entries.values()].filter(
    (e) =>
      !e.name.endsWith('/') &&
      !e.name.startsWith('__MACOSX/') &&
      !basename(e.name).startsWith('.') &&
      e.name.toLowerCase().endsWith(extension),
  );
  const byName = candidates.filter((e) => basename(e.name) === def.originalFilename);
  const chosen = byName.length === 1 ? byName[0] : candidates.length === 1 ? candidates[0] : null;
  if (chosen === null || chosen === undefined) {
    throw new SourceDownloadError(
      candidates.length === 0
        ? `ZIP-Archiv enthält keine ${extension}-Datei (${info.join(', ')}).`
        : `ZIP-Archiv enthält ${candidates.length} ${extension}-Dateien und keine eindeutig mit dem Namen ${def.originalFilename} – es wird nicht geraten.`,
      [`Antwort: ${info.join(', ')}`, `ZIP: ${listing}`],
    );
  }
  let data: Buffer;
  try {
    data = readZipEntry(buffer, chosen);
  } catch (error) {
    throw new SourceDownloadError(
      `„${chosen.name}“ im ZIP-Archiv nicht lesbar: ${(error as Error).message}`,
      [`ZIP: ${listing}`],
    );
  }
  if (def.format === 'xlsx') {
    let inner: Map<string, ZipEntry> | null;
    try {
      inner = isZip(data) ? readZipEntries(data) : null;
    } catch {
      inner = null;
    }
    if (inner === null || !isXlsxArchive(inner)) {
      throw new SourceDownloadError(
        `„${chosen.name}“ im ZIP-Archiv ist keine gültige xlsx-Datei.`,
        [`ZIP: ${listing}`],
      );
    }
  }
  return {
    data,
    filename: basename(chosen.name),
    container: 'zip',
    details: [...details, `ZIP: ${listing}`, `Entpackt: \`${chosen.name}\` (${data.length} Bytes)`],
  };
}

/**
 * Diagnose einer Datei für die Zusammenfassung (Modus „kandidaten“): Einträge, Tabellenblätter, Kopfzeile –
 * KEINE Nährwerte (nur Kopfzeile und Zeilenzahl).
 */
export function diagnoseOriginal(
  buffer: Buffer,
  def: Pick<SourceDefinition, 'format' | 'sheet' | 'csvDelimiter'>,
): string[] {
  const lines = [`Größe ${buffer.length} Bytes`];
  if (isZip(buffer)) {
    try {
      lines.push(`ZIP: ${describeEntries(readZipEntries(buffer))}`);
    } catch (error) {
      lines.push(`ZIP nicht lesbar: ${(error as Error).message}`);
      return lines;
    }
    try {
      lines.push(`Tabellenblätter: ${readXlsxSheetNames(buffer).join(', ') || '–'}`);
      const rows = readXlsxRows(buffer, def.sheet);
      lines.push(`Zeilen im Blatt ${def.sheet ?? '(erstes)'}: ${rows.length}`);
      lines.push(headerLine(rows[0] ?? []));
    } catch (error) {
      lines.push(`xlsx nicht lesbar: ${(error as Error).message}`);
    }
    return lines;
  }
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  lines.push(`Erste Zeile (Kopfzeile, gekürzt): „${first.slice(0, 2000)}“`);
  lines.push(`Anfang „${printableStart(buffer)}“`);
  return lines;
}

/** Kopfzeile als nummerierte Liste (höchstens 80 Spalten). */
export function headerLine(header: readonly string[]): string {
  const shown = header.slice(0, 80).map((h, i) => `${i}: ${h}`);
  return `Kopfzeile (erste ${shown.length} von ${header.length} Spalten): ${shown.join(' | ')}`;
}
