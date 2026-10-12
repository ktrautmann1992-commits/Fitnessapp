/**
 * Test-Hilfen für die Quell-Infrastruktur: kleine xlsx-Dateien bauen (ZIP + XML) und eine erfundene
 * Test-Quelle. ACHTUNG: Alle Werte hier sind TESTWERTE, keine BLS-Daten.
 */
import { deflateRawSync } from 'node:zlib';

import type { DownloadFetch, DownloadResponse, FetchedOriginal } from './download';
import type { SourceDefinition } from './sources';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Baut ein ZIP-Archiv (Methode 0 = gespeichert, 8 = deflate). */
export function buildZip(files: Record<string, string | Buffer>, method: 0 | 8 = 8): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(text) ? text : Buffer.from(text, 'utf8');
    const stored = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, stored);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + stored.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  const count = Object.keys(files).length;
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnLetters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * Baut eine xlsx-Datei. Zellen: Zahl → numerische Zelle, Text → geteilter Text, `null` → leer (fehlt).
 * `inline: true` speichert Texte als Inline-Text statt in sharedStrings.
 */
export function buildXlsx(
  rows: readonly (readonly (string | number | null)[])[],
  options: { sheetName?: string; inline?: boolean; method?: 0 | 8 } = {},
): Buffer {
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();
  const rowXml = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const ref = `${columnLetters(c)}${r + 1}`;
          if (cell === null) {
            return '';
          }
          if (typeof cell === 'number') {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          if (options.inline) {
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
          }
          let index = sharedIndex.get(cell);
          if (index === undefined) {
            index = shared.length;
            shared.push(cell);
            sharedIndex.set(cell, index);
          }
          return `<c r="${ref}" t="s"><v>${index}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const sheetName = options.sheetName ?? 'BLS';
  return buildZip(
    {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types/>',
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':
        '<?xml version="1.0" encoding="UTF-8"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?><sst count="${shared.length}">${shared.map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join('')}</sst>`,
      'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${rowXml}</sheetData></worksheet>`,
    },
    options.method ?? 8,
  );
}

/** Kopfzeile einer erfundenen Test-Quelle im Stil der BLS-Dokumentation (Code Name [Einheit]). */
export const TEST_HEADER = [
  'SBLS',
  'ST',
  'STE',
  'ENERCC Energie (Kilokalorien) [kcal/100g]',
  'ENERCC Datenherkunft',
  'PROT625 Protein [g/100g]',
  'CHO Kohlenhydrate, verfügbar [g/100g]',
  'SUGAR Zucker [g/100g]',
  'FAT Fett [g/100g]',
  'FASAT Fettsäuren, gesättigt [g/100g]',
  'FIBT Ballaststoffe [g/100g]',
  'NA Natrium [mg/100g]',
];

/** Testzeilen (erfundene Werte!): Schlüssel, Name, engl. Name, kcal, Herkunft, E, KH, Zucker, F, ges. F, Bst., Na. */
export const TEST_ROWS: (string | number | null)[][] = [
  ['C133000', 'Haferflocken', 'Oat flakes', 370, 'A', 13.5, 58.7, 0.7, 7, 1.2, 10, 4],
  ['M141200', 'Joghurt, 1,5 % Fett', 'Yoghurt', 47, 'A', 3.4, 4.1, 4.1, 1.5, 1, 0, 50],
  ['F110100', 'Apfel, roh', 'Apple, raw', 54, 'A', 0.3, 12, 10, 0.2, 0, 2, 1],
  ['T100000', 'Lachs "Atlantik", roh', 'Salmon', 200, 'B', 20, 0, 0, 13, 3, 0, 60],
  ['X999999', 'Unvollständig', 'Incomplete', null, 'C', 1, 1, 1, 1, 1, 1, 1],
];

export function testOriginal(extraRows: (string | number | null)[][] = []): Buffer {
  return buildXlsx([TEST_HEADER, ...TEST_ROWS, ...extraRows]);
}

/** Erfundene Test-Quelle mit fester Adresse (wie ein Eintrag in sources.ts). */
export const TEST_SOURCE: SourceDefinition = {
  db: 'bls',
  version: '4.0',
  title: 'Test-Quelle (erfunden)',
  url: 'https://example.org/quelle/v4/original.xlsx',
  downloadPage: null,
  urlStatus: 'confirmed',
  licenseStatus: 'confirmed',
  confirmedBy: 'Testeintrag',
  originalFilename: 'original.xlsx',
  format: 'xlsx',
  sheet: null,
  csvDelimiter: ',',
  originalSha256: null,
  keyColumn: 0,
  nameColumn: 1,
  nutrients: {
    kcal: [{ code: 'ENERCC', unit: 'kcal', convert: 'none' }],
    protein_g: [{ code: 'PROT625', unit: 'g', convert: 'none' }],
    carbs_g: [{ code: 'CHO', unit: 'g', convert: 'none' }],
    sugar_g: [{ code: 'SUGAR', unit: 'g', convert: 'none' }],
    fat_g: [{ code: 'FAT', unit: 'g', convert: 'none' }],
    sat_fat_g: [{ code: 'FASAT', unit: 'g', convert: 'none' }],
    fiber_g: [{ code: 'FIBT', unit: 'g', convert: 'none' }],
    salt_g: [
      { code: 'NACL', unit: 'g', convert: 'none' },
      { code: 'NA', unit: 'mg', convert: 'sodium_mg_to_salt_g' },
    ],
  },
  columnsStatus: 'confirmed',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
  licenseText: 'Test-Lizenzhinweis (erfunden).',
  attribution: 'Test-Herausgeber (2025): Test-Quelle, Version 4.0. Lizenz: CC BY 4.0.',
  changesNote: 'Testauszug.',
};

/** Erfundene Test-Quelle mit Download-Seite (wie BLS auf blsdb.de, aber Host example.org). */
export const TEST_PAGE_SOURCE: SourceDefinition = {
  ...TEST_SOURCE,
  url: 'https://daten.example.org/download',
  downloadPage: { linkPath: '/download', tokenParam: 'token', redirectHosts: [] },
};

/** Ergebnis von `fetchSourceOriginal` für eine direkt geladene Datei (Tests). */
export function fetchedOf(data: Buffer, downloadUrl = TEST_SOURCE.url): FetchedOriginal {
  return { data, filename: null, container: 'datei', details: [], downloadUrl };
}

/** Antwort einer Test-Webseite. */
export interface FakeRoute {
  readonly status?: number;
  readonly body: Buffer | string;
  readonly headers?: Record<string, string>;
  /** Adresse nach Weiterleitung (Standard: die angefragte). */
  readonly redirectTo?: string;
}

/**
 * Erfundene Website: Adresse → Antwort; `token=…` in der Anfrage zählt als beliebiger Code (`token=*`).
 * Merkt sich alle Anfragen mit Kopfzeilen.
 */
export function fakeSite(routes: Record<string, FakeRoute>): {
  fetch: DownloadFetch;
  requests: { url: string; headers: Record<string, string> }[];
} {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl: DownloadFetch = (url, init) => {
    requests.push({ url, headers: init?.headers ?? {} });
    const key = url.replace(/token=[^&]*/, 'token=*');
    const route = routes[url] ?? routes[key];
    const headers = new Map(
      Object.entries(route?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const body = route === undefined ? Buffer.from('nicht gefunden') : Buffer.from(route.body);
    const status = route === undefined ? 404 : (route.status ?? 200);
    const response: DownloadResponse = {
      ok: status >= 200 && status < 300,
      status,
      url: route?.redirectTo ?? url,
      headers: { get: (name) => headers.get(name.toLowerCase()) ?? null },
      arrayBuffer: () => Promise.resolve(new Uint8Array(body).buffer as ArrayBuffer),
    };
    return Promise.resolve(response);
  };
  return { fetch: fetchImpl, requests };
}

/** Download-Seite im Stil von blsdb.de mit den angegebenen Links. */
export function downloadPageHtml(links: readonly string[], extra = ''): string {
  return `<!DOCTYPE html><html><head><title>BLS Download</title></head><body><h1>Download</h1>${links
    .map((href) => `<a class="btn" href="${href}">Download BLS-Daten</a>`)
    .join('')}${extra}</body></html>`;
}
