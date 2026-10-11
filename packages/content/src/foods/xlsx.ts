/**
 * Minimaler, abhängigkeitsfreier Leser für xlsx-Dateien (Office Open XML) – nur Lesen der Zellen-Texte eines
 * Tabellenblatts. Grund: Der Quellauszug muss die Zellen GENAU so übernehmen, wie sie gespeichert sind (keine
 * Formatierung, keine Rundung, keine Datums-Umwandlung). Unterstützt: ZIP mit „stored“/„deflate“, geteilte
 * Texte (sharedStrings), Inline-Texte, Zahlen, Wahrheitswerte, Formelergebnisse. Nicht unterstützt (Abbruch):
 * ZIP64, verschlüsselte Dateien.
 */
import { inflateRawSync } from 'node:zlib';

/** Obergrenzen gegen kaputte oder bösartige Dateien. */
export const XLSX_LIMITS = {
  /** Größe einer entpackten Datei im Archiv. */
  maxEntryBytes: 512 * 1024 * 1024,
  /** Anzahl Dateien im Archiv. */
  maxEntries: 10_000,
} as const;

interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
  readonly flags: number;
}

function fail(message: string): never {
  throw new Error(`xlsx: ${message}`);
}

function readZipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // Ende des zentralen Verzeichnisses suchen (höchstens 64 KiB Kommentar).
  const minEocd = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= minEocd; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    fail('keine gültige ZIP-Datei (Ende des Verzeichnisses fehlt).');
  }
  const count = buffer.readUInt16LE(eocd + 10);
  const dirOffset = buffer.readUInt32LE(eocd + 16);
  if (count === 0xffff || dirOffset === 0xffffffff) {
    fail('ZIP64 wird nicht unterstützt.');
  }
  if (count > XLSX_LIMITS.maxEntries) {
    fail(`zu viele Dateien im Archiv (${count}).`);
  }
  const entries = new Map<string, ZipEntry>();
  let pos = dirOffset;
  for (let n = 0; n < count; n += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      fail('Verzeichniseintrag beschädigt.');
    }
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
    entries.set(name, {
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      flags,
    });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  if ((entry.flags & 0x1) !== 0) {
    fail(`„${entry.name}“ ist verschlüsselt.`);
  }
  if (entry.uncompressedSize > XLSX_LIMITS.maxEntryBytes) {
    fail(`„${entry.name}“ ist zu groß.`);
  }
  const at = entry.localHeaderOffset;
  if (at + 30 > buffer.length || buffer.readUInt32LE(at) !== 0x04034b50) {
    fail(`lokaler Kopf von „${entry.name}“ beschädigt.`);
  }
  const start = at + 30 + buffer.readUInt16LE(at + 26) + buffer.readUInt16LE(at + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  let out: Buffer;
  if (entry.method === 0) {
    out = Buffer.from(data);
  } else if (entry.method === 8) {
    out = inflateRawSync(data, { maxOutputLength: XLSX_LIMITS.maxEntryBytes });
  } else {
    fail(`Kompressionsart ${entry.method} von „${entry.name}“ wird nicht unterstützt.`);
  }
  if (out.length !== entry.uncompressedSize) {
    fail(`„${entry.name}“: Größe passt nicht zum Verzeichnis.`);
  }
  return out;
}

/** XML-Entitäten und die OOXML-Maskierung `_xHHHH_` auflösen. */
export function decodeXmlText(value: string): string {
  return value
    .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_m, entity: string) => {
      switch (entity) {
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'amp':
          return '&';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default:
          return String.fromCodePoint(
            entity.startsWith('#x')
              ? Number.parseInt(entity.slice(2), 16)
              : Number.parseInt(entity.slice(1), 10),
          );
      }
    })
    .replace(/_x([0-9a-fA-F]{4})_/g, (_m, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

function attribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return match?.[1] === undefined ? undefined : decodeXmlText(match[1]);
}

/** Text eines `<si>`- oder `<is>`-Elements: alle `<t>` außer Lautschrift (`<rPh>`). */
function richText(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let text = '';
  for (const match of withoutPhonetic.matchAll(
    /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g,
  )) {
    text += decodeXmlText(match[1] ?? '');
  }
  return text;
}

function sharedStrings(xml: string | undefined): string[] {
  if (xml === undefined) {
    return [];
  }
  const result: string[] = [];
  for (const match of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g)) {
    result.push(richText(match[1] ?? ''));
  }
  return result;
}

/** Spaltenbuchstaben → Index (A = 0). */
export function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function resolveSheetPath(files: Map<string, Buffer>, sheet: string | null): string {
  const workbook = files.get('xl/workbook.xml')?.toString('utf8');
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (workbook === undefined || rels === undefined) {
    fail('Arbeitsmappe (xl/workbook.xml) fehlt.');
  }
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({
    name: attribute(m[1] ?? '', 'name') ?? '',
    rid: attribute(m[1] ?? '', 'r:id') ?? '',
  }));
  const chosen = sheet === null ? sheets[0] : sheets.find((s) => s.name === sheet);
  if (chosen === undefined) {
    fail(
      sheet === null
        ? 'kein Tabellenblatt gefunden.'
        : `Tabellenblatt „${sheet}“ fehlt (vorhanden: ${sheets.map((s) => s.name).join(', ')}).`,
    );
  }
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = m[1] ?? '';
    if (attribute(attrs, 'Id') === chosen.rid) {
      const target = attribute(attrs, 'Target') ?? '';
      return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    }
  }
  return fail(`Verweis auf Tabellenblatt „${chosen.name}“ fehlt.`);
}

/**
 * Zellen-Texte eines Tabellenblatts als Zeilen (leere Zellen = ""; Zeilen ohne Zellen fallen weg).
 * Zahlen bleiben der gespeicherte Text (z. B. „12.5“ oder „1.2E-2“), nie formatiert.
 */
export function readXlsxRows(buffer: Buffer, sheet: string | null = null): string[][] {
  const entries = readZipEntries(buffer);
  const wanted = (name: string) =>
    name === 'xl/workbook.xml' ||
    name === 'xl/_rels/workbook.xml.rels' ||
    name === 'xl/sharedStrings.xml' ||
    name.startsWith('xl/worksheets/');
  const files = new Map<string, Buffer>();
  for (const entry of entries.values()) {
    if (wanted(entry.name)) {
      files.set(entry.name, readZipEntry(buffer, entry));
    }
  }
  const sheetPath = resolveSheetPath(files, sheet);
  const sheetXml = files.get(sheetPath)?.toString('utf8');
  if (sheetXml === undefined) {
    fail(`Tabellenblatt-Datei „${sheetPath}“ fehlt.`);
  }
  const strings = sharedStrings(files.get('xl/sharedStrings.xml')?.toString('utf8'));

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells: string[] = [];
    let next = 0;
    for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1] ?? '';
      const inner = cellMatch[2] ?? '';
      const ref = attribute(attrs, 'r');
      const col = ref === undefined ? next : columnIndex(/^[A-Z]+/.exec(ref)?.[0] ?? 'A');
      next = col + 1;
      const type = attribute(attrs, 't') ?? 'n';
      const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value: string;
      if (type === 's') {
        const index = Number.parseInt(raw ?? '', 10);
        const shared = strings[index];
        if (shared === undefined) {
          fail(`Zelle ${ref ?? '?'}: geteilter Text Nr. ${raw ?? '?'} fehlt.`);
        }
        value = shared;
      } else if (type === 'inlineStr') {
        const is = /<is(?:\s[^>]*)?>([\s\S]*?)<\/is>/.exec(inner)?.[1];
        value = richText(is ?? '');
      } else {
        value = raw === undefined ? '' : decodeXmlText(raw);
      }
      while (cells.length < col) {
        cells.push('');
      }
      cells[col] = value;
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}
