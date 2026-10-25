import { describe, expect, it } from 'vitest';

import {
  type ShoeForm,
  shoeChipText,
  shoeDraftFromForm,
  shoeKmText,
  shoeStatusText,
} from './shoe-format';

const ID = '11111111-1111-4111-8111-111111111111';
const form = (over: Partial<ShoeForm> = {}): ShoeForm => ({
  name: ' Pegasus 41 ',
  brand: '',
  sport: 'run',
  startKm: '',
  replaceKm: '',
  since: { day: '01', month: '09', year: '2026' },
  makeDefault: true,
  ...over,
});

describe('Schuh-Anzeige', () => {
  it('km ganzzahlig mit Tausender-Punkt', () => {
    expect(shoeKmText(412.4)).toBe('412');
    expect(shoeKmText(412.5)).toBe('413');
    expect(shoeKmText(1203)).toBe('1.203');
    expect(shoeKmText(0)).toBe('0');
  });

  it('Hinweis in Zeichen und Wort (nie nur Farbe)', () => {
    expect(shoeStatusText('ok')).toBe('✓ Gut in Schuss');
    expect(shoeStatusText('soon')).toBe('! Bald wechseln');
    expect(shoeStatusText('replace')).toBe('‼ Wechsel empfohlen');
  });

  it('Chip am Lauf', () => {
    expect(shoeChipText('Pegasus 41', 412.2)).toBe('Schuh: Pegasus 41 (412 km)');
    expect(shoeChipText(null, 0)).toBe('Schuh: keiner');
  });
});

describe('Formular → Entwurf', () => {
  it('gültig: Name getrimmt, leere Marke = null, km 0, Standard-Grenze = null', () => {
    expect(shoeDraftFromForm(form(), ID, '2026-10-25')).toEqual({
      ok: true,
      draft: {
        id: ID,
        sport: 'run',
        name: 'Pegasus 41',
        brand: null,
        startKm: 0,
        replaceKm: null,
        inUseSince: '2026-09-01',
        makeDefault: true,
      },
    });
    const own = shoeDraftFromForm(
      form({ startKm: '1.200', replaceKm: '650', brand: 'Nike' }),
      ID,
      '2026-10-25',
    );
    expect(own.ok && own.draft).toMatchObject({ startKm: 1200, replaceKm: 650, brand: 'Nike' });
    const standard = shoeDraftFromForm(form({ replaceKm: '800' }), ID, '2026-10-25');
    expect(standard.ok && standard.draft.replaceKm).toBeNull();
  });

  it('Fehler je Feld', () => {
    const result = shoeDraftFromForm(
      form({
        name: ' ',
        brand: 'x'.repeat(41),
        startKm: '-3',
        replaceKm: '100',
        since: { day: '31', month: '02', year: '2026' },
      }),
      ID,
      '2026-10-25',
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(
      ['brand', 'name', 'replaceKm', 'since', 'startKm'].sort(),
    );
  });

  it('Datum in der Zukunft und km über 5.000 abgelehnt', () => {
    const result = shoeDraftFromForm(
      form({ startKm: '5001', since: { day: '26', month: '10', year: '2026' } }),
      ID,
      '2026-10-25',
    );
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['since', 'startKm']);
  });
});
