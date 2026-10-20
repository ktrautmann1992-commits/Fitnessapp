import { MOCK_PRODUCT_CASES } from '@fitnessapp/core';
import type { Page } from '@playwright/test';

/**
 * Ersatz für Kamera und eingebauten Strichcode-Leser im Browser (Etappe E4b, genutzt von food-product-scan.spec.ts und
 * shopping-scan.spec.ts): `getUserMedia` liefert eine Zeichenfläche mit einem gezeichneten EAN-13-Strichcode, der
 * eingebaute `BarcodeDetector` ist ein Ersatz-Objekt (erst leere Bilder und eine Fehllesung, dann `code`).
 */

const PLAUSIBEL = MOCK_PRODUCT_CASES.find((c) => c.key === 'plausibel')?.code ?? '';

export type CameraMode = 'none' | 'canvas' | 'denied' | 'missing';

/** Ersatz für Kamera (und optional den eingebauten Leser) – vor dem Laden der Seite. */
export async function fakeCamera(
  page: Page,
  options: { camera: CameraMode; builtInDetector: boolean; code?: string },
) {
  await page.addInitScript(
    ({ camera, builtInDetector, code }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__scan = { getUserMedia: 0, detect: 0, tracks: [] as MediaStreamTrack[], formats: null };
      const state = w.__scan as {
        getUserMedia: number;
        detect: number;
        tracks: MediaStreamTrack[];
        formats: unknown;
      };
      // Der Linux-Chromium der Tests hat keinen eingebauten Leser – sicherheitshalber entfernen.
      delete w.BarcodeDetector;
      if (camera === 'none') {
        Object.defineProperty(Navigator.prototype, 'mediaDevices', {
          configurable: true,
          get: () => undefined,
        });
        return;
      }
      if (builtInDetector) {
        w.BarcodeDetector = class {
          static getSupportedFormats() {
            return Promise.resolve(['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code']);
          }
          constructor(opts: { formats: string[] }) {
            state.formats = opts.formats;
          }
          detect() {
            state.detect += 1;
            // Erst ein paar leere Bilder und eine Fehllesung (falsche Prüfziffer), dann der richtige Code.
            if (state.detect < 3) return Promise.resolve([]);
            if (state.detect === 3) {
              return Promise.resolve([{ rawValue: '4000000000010', format: 'ean_13' }]);
            }
            return Promise.resolve([{ rawValue: code, format: 'ean_13' }]);
          }
        };
      }
      const patterns = {
        L: [
          '0001101',
          '0011001',
          '0010011',
          '0111101',
          '0100011',
          '0110001',
          '0101111',
          '0111011',
          '0110111',
          '0001011',
        ],
        G: [
          '0100111',
          '0110011',
          '0011011',
          '0100001',
          '0011101',
          '0111001',
          '0000101',
          '0010001',
          '0001001',
          '0010111',
        ],
        R: [
          '1110010',
          '1100110',
          '1101100',
          '1000010',
          '1011100',
          '1001110',
          '1010000',
          '1000100',
          '1001000',
          '1110100',
        ],
      };
      const parity = [
        'LLLLLL',
        'LLGLGG',
        'LLGGLG',
        'LLGGGL',
        'LGLLGG',
        'LGGLLG',
        'LGGGLL',
        'LGLGLG',
        'LGLGGL',
        'LGGLGL',
      ];
      const ean13Modules = (digits: string) => {
        const d = digits.split('').map(Number);
        const first = d[0] ?? 0;
        let bits = '101';
        for (let i = 1; i <= 6; i += 1) {
          const set = (parity[first] ?? 'LLLLLL')[i - 1] as 'L' | 'G';
          bits += patterns[set][d[i] ?? 0];
        }
        bits += '01010';
        for (let i = 7; i <= 12; i += 1) bits += patterns.R[d[i] ?? 0];
        return `${bits}101`;
      };
      navigator.mediaDevices.getUserMedia = (constraints?: MediaStreamConstraints) => {
        state.getUserMedia += 1;
        if (constraints?.audio)
          return Promise.reject(new DOMException('Kein Ton', 'NotAllowedError'));
        if (camera === 'denied') {
          return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
        }
        if (camera === 'missing') {
          return Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
        }
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        const bits = code ? ean13Modules(code) : '';
        const draw = () => {
          if (!ctx) return;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (!code) return;
          ctx.fillStyle = '#000';
          const module = 5;
          const left = (canvas.width - bits.length * module) / 2;
          for (let i = 0; i < bits.length; i += 1) {
            if (bits[i] === '1') ctx.fillRect(left + i * module, 140, module, 200);
          }
        };
        draw();
        setInterval(draw, 100);
        const stream = canvas.captureStream(15);
        state.tracks.push(...stream.getTracks());
        return Promise.resolve(stream);
      };
    },
    { code: PLAUSIBEL, ...options },
  );
}
