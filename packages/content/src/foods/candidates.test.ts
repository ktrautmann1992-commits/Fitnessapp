/**
 * Kandidatensuche und Namensliste (Modus „kandidaten“, docs/PLAN-PHASE-5.md 19.3): Ranking (alle Wörter zuerst,
 * Grundprodukt vor Gericht, dann Länge), bis zu 15 Kandidaten, Bereinigung, Namensliste fürs Log.
 */
import { describe, expect, it } from 'vitest';

import {
  cleanSourceText,
  findCandidates,
  formatNameList,
  MAX_CANDIDATES,
  MAX_SOURCE_NAME_LENGTH,
  matchTier,
  nameListMarkers,
  preparationRank,
} from './candidates';

const DEF = { db: 'bls', keyColumn: 0, keyPattern: '^[A-Z][0-9A-Z]{6}$', nameColumn: 1 } as const;
const HEADER = ['BLS Code', 'Lebensmittelbezeichnung', 'ENERCC Energie (Kilokalorien) [kcal/100g]'];

function records(rows: [string, string][]): string[][] {
  return [HEADER, ...rows.map(([ref, name]) => [ref, name, '370'])];
}

const refs = (rows: [string, string][], search: string[]) =>
  findCandidates(records(rows), DEF, search).map((c) => c.ref);

describe('Kandidaten: Ranking', () => {
  it('Treffer mit allen Wörtern eines Suchbegriffs vor Teil-Treffern', () => {
    const rows: [string, string][] = [
      ['H154000', 'Kokosmilch/Kokosnussmilch'],
      ['H154100', 'Kokosmilch fettreduziert'],
    ];
    expect(refs(rows, ['Kokosmilch fettreduziert'])).toEqual(['H154100', 'H154000']);
    // Ohne passende Variante erscheint wenigstens das Grundprodukt (Teil-Treffer).
    expect(refs([rows[0]!], ['Kokosmilch fettreduziert'])).toEqual(['H154000']);
  });

  it('Wortanfang vor Wortinnerem („Reis“ nicht zuerst in „Erdbeereis“)', () => {
    const rows: [string, string][] = [
      ['Y996510', 'Erdbeereis'],
      ['C351000', 'Reis poliert, roh'],
    ];
    expect(refs(rows, ['Reis'])).toEqual(['C351000', 'Y996510']);
    expect(matchTier('Reis poliert, roh', ['Reis'])).toBe(0);
    expect(matchTier('Erdbeereis', ['Reis'])).toBe(1);
    expect(matchTier('Reis Mehl', ['Reis poliert'])).toBe(2);
    expect(matchTier('Reiswaffeln', ['Hafer Flocken'])).toBeNull();
  });

  it('Teil-Treffer nur über Wörter ab 4 Zeichen am Wortanfang (keine Zufallstreffer)', () => {
    expect(matchTier('Eisbergsalat roh', ['Tofu roh'])).toBeNull();
    expect(matchTier('Tofu', ['Tofu geräuchert'])).toBe(2);
  });

  it('„roh“/Grundprodukt vor zubereiteten Gerichten, dann die Länge', () => {
    const rows: [string, string][] = [
      ['X446153', 'Karottensuppe'],
      ['G620132', 'Karotte/Möhre, gekocht'],
      ['G620100', 'Karotte/Möhre, roh'],
      ['Y444123', 'Lammragout mit Karotten'],
      ['N272000', 'Karottensaftschorle'],
    ];
    expect(refs(rows, ['Karotte'])).toEqual([
      'G620100', // roh
      'N272000', // neutral
      'X446153', // Gericht (X, …suppe), kürzer
      'G620132', // gekocht
      'Y444123', // Gericht, länger
    ]);
  });

  it('Heuristik „Grundprodukt“: roh 0, neutral 1, Zubereitung/Gericht 2', () => {
    expect(preparationRank('Spinat roh', 'G211100')).toBe(0);
    expect(preparationRank('Spinat tiefgefroren', 'G211200')).toBe(1);
    expect(preparationRank('Spinat gedünstet', 'G211152')).toBe(2);
    expect(preparationRank('Kartoffelsuppe mit Gemüsebrühe', 'X449023')).toBe(2);
    expect(preparationRank('Apfelmus ungesüßt', 'Y864112')).toBe(2);
    expect(preparationRank('Honigkuchen', 'D401400')).toBe(2);
    expect(preparationRank('Kopfsalat roh', 'G105100')).toBe(0);
  });

  it(`höchstens ${MAX_CANDIDATES} Kandidaten (vorher 8), doppelte Quell-IDs nur einmal`, () => {
    expect(MAX_CANDIDATES).toBe(15);
    const rows: [string, string][] = Array.from({ length: 30 }, (_, i) => [
      `G5${String(i).padStart(5, '0')}`,
      `Tomate Sorte ${i}`,
    ]);
    rows.push(['G500000', 'Tomate doppelt']);
    const found = refs(rows, ['Tomate']);
    expect(found).toHaveLength(15);
    expect(new Set(found).size).toBe(15);
  });
});

describe('Bereinigung von Quell-Text', () => {
  it('entfernt Steuer- und Formatzeichen, fasst Leerraum zusammen, begrenzt die Länge', () => {
    expect(cleanSourceText('Apfel,\troh\r\n')).toBe('Apfel, roh');
    expect(cleanSourceText('A\u0000B\u001bC​D E')).toBe('A B C D E');
    const long = cleanSourceText('x'.repeat(500));
    expect(long).toHaveLength(MAX_SOURCE_NAME_LENGTH);
    expect(long.endsWith('…')).toBe(true);
  });

  it('Kandidaten nutzen dieselbe Bereinigung', () => {
    const [c] = findCandidates(records([['F110100', 'Apfel,\n roh\u0007']]), DEF, ['Apfel']);
    expect(c).toEqual({ ref: 'F110100', name: 'Apfel, roh' });
  });

  it('S2/K2: „::“ (Workflow-Kommandos) und „===“ (Marker) in Bezeichnungen entschärft', () => {
    expect(cleanSourceText('::stop-commands::abc')).toBe(': :stop-commands: :abc');
    expect(cleanSourceText('::add-mask::geheim')).not.toContain('::');
    expect(cleanSourceText('=== BLS-NAMENSLISTE ENDE ===')).toBe(
      '= = = BLS-NAMENSLISTE ENDE = = =',
    );
    expect(cleanSourceText('Apfel: roh = gut')).toBe('Apfel: roh = gut');
  });
});

describe('Namensliste fürs Actions-Log (nur Modus „kandidaten“)', () => {
  it('S2: Quell-ID nur im Format der Quelle; abweichende Zeilen werden nur gezählt', () => {
    const result = formatNameList(
      records([
        ['::stop-commands::x', 'Apfel'],
        ['::error ::boom', 'Birne'],
        ['F110100', '::stop-commands::tok'],
        ['f110100', 'klein'],
        ['F1101000', 'zu lang'],
        [' G561100 ', 'Tomate roh'],
        ['G561100', 'doppelt erlaubt'],
        ['X999999', '=== BLS-NAMENSLISTE ENDE ==='],
      ]),
      DEF,
    );
    const lines = result.text.split('\n');
    expect(result.skipped).toBe(4);
    expect(lines).toEqual([
      '=== BLS-NAMENSLISTE BEGINN ===',
      'F110100\t: :stop-commands: :tok',
      'G561100\tTomate roh',
      'G561100\tdoppelt erlaubt',
      'X999999\t= = = BLS-NAMENSLISTE ENDE = = =',
      '=== BLS-NAMENSLISTE ENDE ===',
    ]);
    // Keine Zeile beginnt mit „::“, der Ende-Marker steht genau einmal (am Schluss).
    expect(lines.some((l) => l.startsWith('::'))).toBe(false);
    expect(lines.filter((l) => l.includes('NAMENSLISTE ENDE ==='))).toEqual([
      '=== BLS-NAMENSLISTE ENDE ===',
    ]);
  });

  it('Kandidaten übergehen Zeilen mit abweichender Quell-ID; ohne gültiges keyPattern Abbruch', () => {
    const rows = records([
      ['::warning ::x', 'Apfel roh'],
      ['F110100', 'Apfel, roh'],
    ]);
    expect(findCandidates(rows, DEF, ['Apfel']).map((c) => c.ref)).toEqual(['F110100']);
    expect(() => findCandidates(rows, { ...DEF, keyPattern: '[A-Z]+' }, ['Apfel'])).toThrow(
      /keyPattern/,
    );
    expect(() =>
      formatNameList(rows, { ...DEF, keyPattern: undefined as unknown as string }),
    ).toThrow(/keyPattern/);
  });

  it('alle Zeilen als Quell-ID<TAB>Bezeichnung zwischen festen Markern, ohne Nährwerte', () => {
    const result = formatNameList(
      records([
        ['F110100', 'Apfel, roh'],
        ['', 'ohne Schlüssel'],
        ['T100000', 'Lachs\t"Atlantik",\nroh'],
      ]),
      DEF,
    );
    const list = result.text;
    expect(result).toMatchObject({ written: 2, skipped: 1 });
    const lines = list.split('\n');
    expect(nameListMarkers('bls')).toEqual({
      begin: '=== BLS-NAMENSLISTE BEGINN ===',
      end: '=== BLS-NAMENSLISTE ENDE ===',
    });
    expect(lines).toEqual([
      '=== BLS-NAMENSLISTE BEGINN ===',
      'F110100\tApfel, roh',
      'T100000\tLachs "Atlantik", roh',
      '=== BLS-NAMENSLISTE ENDE ===',
    ]);
    expect(list).not.toContain('370');
    // Kopfzeile nicht als Eintrag
    expect(list).not.toContain('Lebensmittelbezeichnung');
    // Jede Datenzeile hat genau einen Tab (Bezeichnung ohne Tab/Zeilenumbruch).
    for (const line of lines.slice(1, -1)) {
      expect(line.split('\t')).toHaveLength(2);
    }
  });
});
