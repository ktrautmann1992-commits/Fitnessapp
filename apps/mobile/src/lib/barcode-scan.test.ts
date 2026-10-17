import { describe, expect, it } from 'vitest';

import {
  cameraErrorKind,
  firstUsableScan,
  prefersBuiltInDetector,
  scannerWasmPath,
  webScanSupported,
} from './barcode-scan';

// Strichcode per Kamera (Etappe E4b, docs/PLAN-E4.md 5): Entscheidungen ohne Kamera und ohne Browser.

const getUserMedia = () => Promise.resolve(null);
class FakeDetector {
  static getSupportedFormats() {
    return Promise.resolve(['ean_13', 'ean_8', 'qr_code']);
  }
}

describe('webScanSupported – Knopf nur, wenn das Gerät es kann', () => {
  it('Chrome Android: Kamera + eingebauter Leser', () => {
    expect(
      webScanSupported({
        isSecureContext: true,
        mediaDevices: { getUserMedia },
        BarcodeDetector: FakeDetector,
        WebAssembly: {},
      }),
    ).toBe(true);
  });

  it('iPhone (Safari/Chrome = WebKit): kein eingebauter Leser, aber WebAssembly → ZXing', () => {
    expect(
      webScanSupported({ isSecureContext: true, mediaDevices: { getUserMedia }, WebAssembly: {} }),
    ).toBe(true);
  });

  it('ohne Kamera-Schnittstelle, ohne HTTPS oder ohne jeden Leser → kein Knopf', () => {
    expect(webScanSupported({ isSecureContext: true, WebAssembly: {} })).toBe(false);
    expect(webScanSupported({ isSecureContext: true, mediaDevices: {}, WebAssembly: {} })).toBe(
      false,
    );
    expect(
      webScanSupported({ isSecureContext: false, mediaDevices: { getUserMedia }, WebAssembly: {} }),
    ).toBe(false);
    expect(webScanSupported({ isSecureContext: true, mediaDevices: { getUserMedia } })).toBe(false);
  });
});

describe('prefersBuiltInDetector – eingebauter Leser nur mit EAN-13', () => {
  it('mit ean_13 → eingebaut', async () => {
    await expect(prefersBuiltInDetector(FakeDetector)).resolves.toBe(true);
  });

  it('ohne ean_13, Fehler, kein Leser → ZXing', async () => {
    class QrOnly {
      static getSupportedFormats() {
        return Promise.resolve(['qr_code']);
      }
    }
    class Broken {
      static getSupportedFormats() {
        return Promise.reject(new Error('kaputt'));
      }
    }
    await expect(prefersBuiltInDetector(QrOnly)).resolves.toBe(false);
    await expect(prefersBuiltInDetector(Broken)).resolves.toBe(false);
    await expect(prefersBuiltInDetector(undefined)).resolves.toBe(false);
    await expect(prefersBuiltInDetector(class {})).resolves.toBe(false);
  });
});

describe('cameraErrorKind – verweigert oder nicht verfügbar', () => {
  it.each([['NotAllowedError'], ['SecurityError'], ['PermissionDeniedError']])(
    '%s → denied',
    (name) => {
      expect(cameraErrorKind({ name })).toBe('denied');
    },
  );

  it.each([['NotFoundError'], ['NotReadableError'], ['OverconstrainedError'], ['AbortError']])(
    '%s → unavailable',
    (name) => {
      expect(cameraErrorKind({ name })).toBe('unavailable');
    },
  );

  it('kein Fehlerobjekt → unavailable', () => {
    expect(cameraErrorKind(null)).toBe('unavailable');
    expect(cameraErrorKind('NotAllowedError')).toBe('unavailable');
  });
});

describe('firstUsableScan – erster brauchbarer Code', () => {
  it('Browser-Namen (ean_13) und expo-camera-Namen (ean13, upc_e)', () => {
    expect(firstUsableScan([{ value: '4006381333931', format: 'ean_13' }])).toBe('4006381333931');
    expect(firstUsableScan([{ value: '4006381333931', format: 'ean13' }])).toBe('4006381333931');
    expect(firstUsableScan([{ value: '04252614', format: 'upc_e' }])).toBe('042100005264');
  });

  it('Fehllesungen und QR-Codes werden übersprungen, der nächste gültige zählt', () => {
    expect(
      firstUsableScan([
        { value: 'https://example.org', format: 'qr_code' },
        { value: '4006381333932', format: 'ean_13' },
        { value: '96385074', format: 'ean_8' },
      ]),
    ).toBe('96385074');
    expect(firstUsableScan([{ value: '4006381333932', format: 'ean_13' }])).toBeNull();
    expect(firstUsableScan([])).toBeNull();
  });

  it('Laden-/Waagencode beendet die Kamera auch (Hinweis ohne Abfrage folgt im Ablauf)', () => {
    expect(firstUsableScan([{ value: '2012345678903', format: 'ean_13' }])).toBe('2012345678903');
  });

  it('kein Text → null', () => {
    expect(firstUsableScan([{ value: undefined, format: 'ean_13' }])).toBeNull();
    expect(firstUsableScan([{ value: 4006381333931, format: 'ean_13' }])).toBeNull();
  });
});

describe('scannerWasmPath – Leser von unserer Domain, nie vom CDN', () => {
  it('fester Pfad auf derselben Domain', () => {
    expect(scannerWasmPath('3.1.3')).toBe('/scanner/3.1.3/zxing_reader.wasm');
    expect(scannerWasmPath('3.1.3')).not.toMatch(/^https?:/);
  });

  it('unerwartete Version → Fehler (kein Pfad aus fremden Zeichen)', () => {
    expect(() => scannerWasmPath('../x')).toThrow();
    expect(() => scannerWasmPath('https://cdn')).toThrow();
  });
});
