import { describe, expect, it } from 'vitest';

import {
  expandUpcE,
  gs1CheckDigit,
  normalizeBarcode,
  normalizeScannedBarcode,
  scannedBarcodeDigits,
  scannedBarcodeFormat,
} from './barcode';

// Kamera-Scan (Etappe E4b, docs/PLAN-E4.md 4.2 und 5). Die Tipp-Prüfung (normalizeBarcode) testet
// food-product.test.ts; hier nur, was der Scanner zusätzlich braucht.

const withCheck = (body: string) => `${body}${gs1CheckDigit(body)}`;

describe('scannedBarcodeFormat', () => {
  it.each([
    ['ean_13', 'ean13'],
    ['ean13', 'ean13'],
    ['EAN-13', 'ean13'],
    ['ean_8', 'ean8'],
    ['ean8', 'ean8'],
    ['upc_a', 'upca'],
    ['UPC-A', 'upca'],
    ['upc_e', 'upce'],
  ])('%s → %s', (input, expected) => {
    expect(scannedBarcodeFormat(input)).toBe(expected);
  });

  it.each([
    ['qr_code'],
    ['code_128'],
    ['itf'],
    ['datamatrix'],
    [''],
    ['x'.repeat(40)],
    [13],
    [null],
  ])('%s → null (keine Lebensmittel-Nummer)', (input) => {
    expect(scannedBarcodeFormat(input)).toBeNull();
  });
});

describe('expandUpcE (GS1 5.2.2.4.2)', () => {
  it.each([
    // Bekannte Beispiele (Nummernsystem 0, mit Prüfziffer)
    ['04252614', '042100005264'],
    ['01234565', '012345000065'],
    // Regel je letzter Ziffer 0–2 / 3 / 4 / 5–9
    ['0123450', withCheck('01200000345')],
    ['0123453', withCheck('01230000045')],
    ['0123454', withCheck('01234000005')],
    ['0123457', withCheck('01234500007')],
    // 6 Ziffern = Nummernsystem 0 ohne Prüfziffer
    ['425261', '042100005264'],
    // Nummernsystem 1
    ['1425261', withCheck('14210000526')],
  ])('%s → %s', (input, expected) => {
    expect(expandUpcE(input)).toBe(expected);
  });

  it('Prüfziffer muss zur erweiterten Nummer passen', () => {
    expect(expandUpcE('04252615')).toBeNull();
  });

  it.each([['24252614'], ['92345678'], ['12345'], ['123456789'], ['0425261a'], ['']])(
    '%s → null (Nummernsystem, Länge, Zeichen)',
    (input) => {
      expect(expandUpcE(input)).toBeNull();
    },
  );

  it('erweiterte Nummer besteht die normale Prüfung (UPC-A → EAN-13)', () => {
    for (const code of ['04252614', '01234565', '0123457']) {
      const upcA = expandUpcE(code);
      expect(upcA).not.toBeNull();
      expect(normalizeBarcode(upcA ?? '')).toEqual({ ok: true, code: `0${upcA}` });
    }
  });
});

describe('scannedBarcodeDigits / normalizeScannedBarcode', () => {
  it('EAN-13 und EAN-8 wie beim Eintippen', () => {
    expect(normalizeScannedBarcode('4006381333931', 'ean_13')).toEqual({
      ok: true,
      code: '4006381333931',
      digits: '4006381333931',
    });
    expect(normalizeScannedBarcode('96385074', 'ean8')).toEqual({
      ok: true,
      code: '96385074',
      digits: '96385074',
    });
  });

  it('UPC-A (12) → EAN-13; iOS liefert UPC-A teils schon mit führender 0', () => {
    expect(normalizeScannedBarcode('036000291452', 'upc_a')).toMatchObject({
      ok: true,
      code: '0036000291452',
    });
    expect(normalizeScannedBarcode('0036000291452', 'upc_a')).toMatchObject({
      ok: true,
      code: '0036000291452',
    });
  });

  it('UPC-E → UPC-A → EAN-13; Feld bekommt die erweiterten Ziffern', () => {
    expect(normalizeScannedBarcode('04252614', 'upc_e')).toEqual({
      ok: true,
      code: '0042100005264',
      digits: '042100005264',
    });
    // Manche Leser liefern UPC-E schon erweitert.
    expect(normalizeScannedBarcode('042100005264', 'upc_e')).toMatchObject({
      ok: true,
      code: '0042100005264',
    });
  });

  it('falsche Prüfziffer, Länge passt nicht zum Format, Leerzeichen innen → invalid (Kamera läuft weiter)', () => {
    expect(normalizeScannedBarcode('4006381333932', 'ean_13')).toEqual({
      ok: false,
      reason: 'invalid',
      digits: '4006381333932',
    });
    expect(scannedBarcodeDigits('96385074', 'ean_13')).toBeNull();
    expect(scannedBarcodeDigits('4006381333931', 'ean_8')).toBeNull();
    expect(scannedBarcodeDigits('4006381333931', 'upc_a')).toBeNull();
    expect(scannedBarcodeDigits('4006 381333931', 'ean_13')).toBeNull();
    expect(normalizeScannedBarcode('0000000000000', 'ean_13')).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
  });

  it('Text um die Ziffern (Leerraum am Rand) wird abgeschnitten, Buchstaben/Emoji/sehr lang → null', () => {
    expect(scannedBarcodeDigits(' 4006381333931\n', 'ean_13')).toBe('4006381333931');
    expect(scannedBarcodeDigits('40063813339A1', 'ean_13')).toBeNull();
    expect(scannedBarcodeDigits('400638133393🍫', 'ean_13')).toBeNull();
    expect(scannedBarcodeDigits('4'.repeat(1000), 'ean_13')).toBeNull();
    expect(scannedBarcodeDigits(4006381333931, 'ean_13')).toBeNull();
  });

  it('QR-Code mit Ziffern wird nicht angenommen', () => {
    expect(normalizeScannedBarcode('4006381333931', 'qr_code')).toEqual({
      ok: false,
      reason: 'invalid',
      digits: null,
    });
  });

  it('Laden-/Waagencode und Buch per Kamera → not_food (keine Abfrage, Kamera endet)', () => {
    expect(normalizeScannedBarcode(withCheck('201234567890'), 'ean_13')).toMatchObject({
      ok: false,
      reason: 'not_food',
    });
    expect(normalizeScannedBarcode(withCheck('978316148410'), 'ean_13')).toMatchObject({
      ok: false,
      reason: 'not_food',
    });
    expect(normalizeScannedBarcode(withCheck('2123456'), 'ean_8')).toMatchObject({
      ok: false,
      reason: 'not_food',
    });
  });

  it('Eigenschaft: jeder gültige EAN-13-Scan ergibt dasselbe wie Eintippen', () => {
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed;
    };
    for (let i = 0; i < 2000; i += 1) {
      const body =
        String(next() % 10 ** 6).padStart(6, '0') + String(next() % 10 ** 6).padStart(6, '0');
      const code = withCheck(body);
      const { digits, ...scanned } = normalizeScannedBarcode(code, 'ean_13');
      expect(digits).toBe(code);
      expect(scanned).toEqual(normalizeBarcode(code));
    }
  });
});
