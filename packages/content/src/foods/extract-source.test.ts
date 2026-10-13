import { describe, expect, it } from 'vitest';

import { parseCsv, serializeCsv, serializeRecord } from './csv';
import {
  attributionMarkdown,
  canonicalRecordSet,
  extractSourceRows,
  readExtractRecords,
  readOriginalRecords,
  sha256Hex,
  sourceManifestSchema,
} from './extract-source';
import {
  convertSourceValue,
  parseSourceNumber,
  resolveNutrientColumns,
  sourceNutrientRows,
} from './source-rows';
import { SOURCES } from './sources';
import { buildXlsx, buildZip, TEST_HEADER, TEST_SOURCE, testOriginal } from './test-helpers';
import { columnIndex, decodeXmlText, readXlsxRows } from './xlsx';

describe('CSV (kanonische Zeilen)', () => {
  it('setzt Anführungszeichen nur wenn nötig und liest es wieder gleich', () => {
    const records = [
      ['a', 'b,c', 'd"e', ' f', 'g\nh', ''],
      ['1', '', '3'],
    ];
    const text = serializeCsv(records);
    expect(text).toBe('a,"b,c","d""e"," f","g\nh"\n1,,3\n');
    expect(parseCsv(text)).toEqual([
      ['a', 'b,c', 'd"e', ' f', 'g\nh'],
      ['1', '', '3'],
    ]);
  });

  it('lässt leere Zellen am Zeilenende weg (eindeutige Form)', () => {
    expect(serializeRecord(['x', '', ''])).toBe('x');
  });

  it('liest Semikolon, CRLF und BOM; offenes Anführungszeichen → Fehler', () => {
    expect(parseCsv('﻿a;b\r\nc;d\r\n', ';')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(() => parseCsv('"offen')).toThrow(/nicht geschlossen/);
  });
});

describe('xlsx-Leser', () => {
  it('liest geteilte Texte, Zahlen und leere Zellen genau wie gespeichert', () => {
    const buffer = buildXlsx([
      ['Kopf', 'Zahl'],
      ['Lachs "roh" & mehr', 0.1],
      ['Lücke', null, 1.2e-7],
    ]);
    expect(readXlsxRows(buffer)).toEqual([
      ['Kopf', 'Zahl'],
      ['Lachs "roh" & mehr', '0.1'],
      ['Lücke', '', '1.2e-7'],
    ]);
  });

  it('liest Inline-Texte und unkomprimierte Archive', () => {
    const buffer = buildXlsx([['ä', 'ß']], { inline: true, method: 0 });
    expect(readXlsxRows(buffer)).toEqual([['ä', 'ß']]);
  });

  it('wählt ein Blatt nach Namen; fehlendes Blatt → verständlicher Fehler', () => {
    const buffer = buildXlsx([['a']], { sheetName: 'Daten' });
    expect(readXlsxRows(buffer, 'Daten')).toEqual([['a']]);
    expect(() => readXlsxRows(buffer, 'Anderes')).toThrow(/Tabellenblatt „Anderes“ fehlt/);
  });

  it('kein ZIP oder Arbeitsmappe fehlt → Fehler statt Raten', () => {
    expect(() => readXlsxRows(Buffer.from('<html>Startseite</html>'))).toThrow(/keine gültige ZIP/);
    expect(() => readXlsxRows(buildZip({ 'a.txt': 'x' }))).toThrow(/Arbeitsmappe/);
  });

  it('Hilfsfunktionen: Spaltenbuchstaben, XML-Entitäten', () => {
    expect(columnIndex('A')).toBe(0);
    expect(columnIndex('Z')).toBe(25);
    expect(columnIndex('AA')).toBe(26);
    expect(decodeXmlText('&lt;a&gt; &amp; &#228; &#xFC; _x000D_')).toBe('<a> & ä ü \r');
  });
});

describe('Auszug (extract-source) – Zeilen unverändert', () => {
  const records = readOriginalRecords(testOriginal(), TEST_SOURCE);

  it('filtert nur benötigte Quell-IDs, Reihenfolge wie im Original, Kopfzeile zuerst', () => {
    const result = extractSourceRows(records, TEST_SOURCE, ['F110100', 'C133000', 'NICHTDA']);
    expect(result.foundRefs).toEqual(['C133000', 'F110100']);
    expect(result.missingRefs).toEqual(['NICHTDA']);
    const extracted = readExtractRecords(result.csv);
    expect(extracted[0]).toEqual(TEST_HEADER);
    // Jede Zeile ist eine unveränderte Zeile des Originals.
    const original = canonicalRecordSet(records);
    for (const row of extracted) {
      expect(original.has(serializeRecord(row))).toBe(true);
    }
  });

  it('Werte bleiben Text der Quelle (keine Rundung, keine Umrechnung)', () => {
    const result = extractSourceRows(records, TEST_SOURCE, ['T100000']);
    expect(result.csv).toContain('T100000,"Lachs ""Atlantik"", roh",Salmon,200,B,20,0,0,13,3,0,60');
  });

  it('doppelte Quell-ID im Original → Abbruch', () => {
    const doubled = readOriginalRecords(
      testOriginal([['C133000', 'Haferflocken 2', '', 1, '', 1, 1, 1, 1, 1, 1, 1]]),
      TEST_SOURCE,
    );
    expect(() => extractSourceRows(doubled, TEST_SOURCE, ['C133000'])).toThrow(/mehrfach/);
  });

  it('Prüfsumme ist SHA-256 (hex)', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('Quellzeilen → Nährwerte (source-rows)', () => {
  it('findet Spalten über Code + Einheit, Natrium mg → Salz g × 2,5 / 1000', () => {
    const records = readOriginalRecords(testOriginal(), TEST_SOURCE);
    const { rows, problems } = sourceNutrientRows(records, TEST_SOURCE);
    expect(rows.get('bls|4.0|C133000')).toBeUndefined(); // Schlüssel ist die Quell-ID
    const oats = rows.get('C133000');
    expect(oats?.name).toBe('Haferflocken');
    expect(oats?.nutrients_per_100g).toEqual({
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    });
    expect(rows.get('M141200')?.nutrients_per_100g.salt_g).toBe(0.125);
    expect(problems).toEqual([
      { ref: 'X999999', message: expect.stringMatching(/kcal/) as unknown as string },
    ]);
  });

  it('fehlende oder falsche Spalte → Abbruch mit Liste der Kopfzeile (nie raten)', () => {
    const header = TEST_HEADER.map((h) => h.replace('FASAT', 'FAXX'));
    expect(() => resolveNutrientColumns(header, TEST_SOURCE)).toThrow(/sat_fat_g.*FASAT/s);
    const wrongUnit = TEST_HEADER.map((h) =>
      h.replace('NA Natrium [mg/100g]', 'NA Natrium [g/100g]'),
    );
    expect(() => resolveNutrientColumns(wrongUnit, TEST_SOURCE)).toThrow(/Einheit „mg“/);
    const twice = [...TEST_HEADER, 'FAT Fett nochmal [g/100g]'];
    expect(() => resolveNutrientColumns(twice, TEST_SOURCE)).toThrow(/mehrfach/);
  });

  it('Zahlen: Punkt, Komma, Exponent; Text/leer = fehlt', () => {
    expect(parseSourceNumber('12.5')).toBe(12.5);
    expect(parseSourceNumber('12,5')).toBe(12.5);
    expect(parseSourceNumber('1.2E-2')).toBe(0.012);
    expect(parseSourceNumber('')).toBeNull();
    expect(parseSourceNumber('-')).toBeNull();
    expect(parseSourceNumber('Spuren')).toBeNull();
    expect(convertSourceValue(1, 'sodium_mg_to_salt_g')).toBe(0.0025);
    expect(convertSourceValue(0.1 + 0.2, 'none')).toBe(0.3);
  });

  it('ergänzende Werte ohne Zahl („-“, „<LOD“) → null + Hinweis; Pflichtwert ohne Zahl → Zeile fehlt (PR #47)', () => {
    const records = [
      TEST_HEADER,
      // Honig: Ballaststoffe „<LOD or <LOQ“ → null, Zeile bleibt.
      ['S120000', 'Honig', '', '310', '', '0.4', '76', '75', '0', '0', '<LOD or <LOQ', '5'],
      // Backpulver: gesättigte Fettsäuren „-“ → null.
      ['R421100', 'Backpulver', '', '100', '', '0.1', '24', '0', '0.1', '-', '0', '11000'],
      // Orangensaft: Fett „<LOD or <LOQ“ ist Pflicht → nicht übernommen (nie 0 eingesetzt).
      ['F603600', 'Orangensaft', '', '45', '', '0.7', '9', '8', '<LOD or <LOQ', '0', '0.2', '1'],
    ];
    const { rows, problems, gaps } = sourceNutrientRows(records, TEST_SOURCE);
    expect(rows.get('S120000')?.nutrients_per_100g.fiber_g).toBeNull();
    expect(rows.get('R421100')?.nutrients_per_100g.sat_fat_g).toBeNull();
    expect(rows.has('F603600')).toBe(false);
    expect(problems).toEqual([
      { ref: 'F603600', message: expect.stringMatching(/fat_g/) as unknown as string },
    ]);
    expect(problems[0]?.message).not.toMatch(/fiber_g/);
    expect(gaps.map((g) => g.ref)).toEqual(['S120000', 'R421100']);
    expect(gaps[0]?.message).toMatch(/fiber_g .*„<LOD or <LOQ“/);
  });

  it('R4-Zusatzspalten (organische Säuren, Alkohol, Polyole) nur für eingetragene Codes; fehlt die Spalte, fehlt das Feld', () => {
    const def = {
      ...TEST_SOURCE,
      energyExtras: {
        organic_acids_g: [{ code: 'OA', unit: 'g', convert: 'none' }],
        alcohol_g: [{ code: 'ALC', unit: 'g', convert: 'none' }],
        polyols_g: [{ code: 'POLYL', unit: 'g', convert: 'none' }],
      },
    } as const;
    const header = [
      ...TEST_HEADER,
      'OA Organische Säuren, gesamt [g/100g]',
      'ALC Alkohol (Ethanol) [g/100g]',
    ];
    const records = [
      header,
      [
        'R123100',
        'Apfelessig',
        '',
        '18',
        '',
        '0.2',
        '0.15',
        '0.1',
        '0',
        '0',
        '0',
        '1',
        '5.48',
        '<LOD',
      ],
    ];
    const { rows } = sourceNutrientRows(records, def);
    const n = rows.get('R123100')?.nutrients_per_100g;
    expect(n?.organic_acids_g).toBe(5.48);
    expect(n?.alcohol_g).toBeNull(); // „<LOD“ → kein Wert
    expect(n && 'polyols_g' in n).toBe(false); // Spalte fehlt → Feld fehlt
    // Ohne `energyExtras` bleiben die Lebensmittel wie bisher (keine Zusatzfelder).
    expect(
      Object.keys(
        sourceNutrientRows(records, TEST_SOURCE).rows.get('R123100')?.nutrients_per_100g ?? {},
      ),
    ).not.toContain('organic_acids_g');
    // Vorhandener Code mit falscher Einheit → Abbruch (nie geraten).
    const wrong = header.map((h) =>
      h.replace('OA Organische Säuren, gesamt [g/100g]', 'OA Organische Säuren [mg/100g]'),
    );
    expect(() => sourceNutrientRows([wrong, records[1] ?? []], def)).toThrow(/Einheit „g“/);
  });

  it('BLS 4.0: Zusatzspalten OA, ALC und POLYL sind festgenagelt (nur R4, Code + Einheit g, unverändert)', () => {
    // Wächter Import-Lauf 1, K2: Zeigte ein Feld auf eine andere Spalte (z. B. WATER), wäre R4 praktisch aus.
    const bls = SOURCES.find((s) => s.db === 'bls' && s.version === '4.0');
    expect(bls?.energyExtras).toEqual({
      organic_acids_g: [{ code: 'OA', unit: 'g', convert: 'none' }],
      alcohol_g: [{ code: 'ALC', unit: 'g', convert: 'none' }],
      polyols_g: [{ code: 'POLYL', unit: 'g', convert: 'none' }],
    });
  });

  it('Zeile mit unmöglichen Werten (Zucker > Kohlenhydrate) wird nicht übernommen', () => {
    const records = [
      TEST_HEADER,
      ['A1', 'Kaputt', '', '100', '', '1', '5', '9', '1', '0', '0', '0'],
    ];
    const { rows, problems } = sourceNutrientRows(records, TEST_SOURCE);
    expect(rows.size).toBe(0);
    expect(problems[0]?.message).toMatch(/Zucker/);
  });
});

describe('SOURCE.json, Namensnennung und Allowlist', () => {
  it('Schema verlangt HTTPS, Prüfsummen und Lauf-ID', () => {
    const ok = {
      db: 'bls',
      version: '4.0',
      title: 'BLS',
      url: 'https://example.org/a.xlsx',
      original_filename: 'a.xlsx',
      original_bytes: 10,
      original_sha256: 'a'.repeat(64),
      extract_sha256: 'b'.repeat(64),
      extract_rows: 3,
      retrieved_at: '2026-10-11T10:00:00Z',
      workflow_run_id: '123',
      license: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Max Rubner-Institut (2025): BLS 4.0',
    };
    expect(sourceManifestSchema.safeParse(ok).success).toBe(true);
    expect(sourceManifestSchema.safeParse({ ...ok, url: 'http://example.org/a' }).success).toBe(
      false,
    );
    expect(sourceManifestSchema.safeParse({ ...ok, original_sha256: 'xyz' }).success).toBe(false);
    expect(sourceManifestSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it('Allowlist: nur HTTPS, feste versionierte Datei, Lizenz und Namensnennung gesetzt', () => {
    for (const source of SOURCES) {
      expect(source.url.startsWith('https://')).toBe(true);
      expect(source.url).not.toMatch(/latest|neueste|current/i);
      if (source.downloadPage === null) {
        expect(source.url).toMatch(/\.(xlsx|csv)$/);
        expect(source.url).toContain(source.originalFilename);
      } else {
        // Feste Seite ohne Code; der Link mit wechselndem Code wird erst beim Laden gelesen.
        expect(new URL(source.url).search).toBe('');
        expect(source.downloadPage.linkPath.startsWith('/')).toBe(true);
        expect(source.downloadPage.redirectHosts).toEqual([]);
      }
      expect(source.attribution.length).toBeGreaterThan(20);
      expect(source.license).toBe('CC BY 4.0');
    }
    const bls = SOURCES.find((s) => s.db === 'bls');
    expect(bls?.url).toBe('https://blsdb.de/download');
    expect(bls?.downloadPage).toEqual({
      linkPath: '/assets/uploads/BLS_4_0_2025_DE.zip',
      tokenParam: 'token',
      redirectHosts: [],
    });
    expect(bls?.attribution).toContain('Max Rubner-Institut');
    expect(bls?.attribution).toContain('DOI: 10.25826/Data20251217-134202-0');
    expect(bls?.licenseText).toContain('CC BY 4.0');
    expect(bls?.licenseStatus).toBe('confirmed');
    expect(bls?.confirmedBy).toMatch(/Gründer 12\.10\.2026/);
    expect(attributionMarkdown(TEST_SOURCE)).toContain('foods-import');
  });
});

describe('Einheit in der Spaltenüberschrift', () => {
  it('„/100g“ zählt nicht als Einheit g', async () => {
    const { headerHasUnit } = await import('./source-rows');
    expect(headerHasUnit('ENERCC Energie [kcal/100g]', 'kcal')).toBe(true);
    expect(headerHasUnit('ENERCC Energie [kcal/100g]', 'g')).toBe(false);
    expect(headerHasUnit('NA Natrium [mg/100 g]', 'mg')).toBe(true);
    expect(headerHasUnit('NA Natrium [mg/100 g]', 'g')).toBe(false);
    expect(headerHasUnit('FAT Fett (g)', 'g')).toBe(true);
    expect(headerHasUnit('FAT Datenherkunft', 'g')).toBe(false);
  });
});
