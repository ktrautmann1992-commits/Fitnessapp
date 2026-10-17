import { MOCK_PRODUCT_CASES } from '@fitnessapp/core';
import { expect, test, type Page } from '@playwright/test';

import { onboardNutrition, openNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe E4b im TESTMODUS (docs/PLAN-E4.md 5.1, 8.2): Strichcode per Kamera im Browser. Kamera und Leser sind im Test
 * ersetzt: `getUserMedia` liefert eine Zeichenfläche mit einem gezeichneten EAN-13-Strichcode statt eines
 * Kamerabildes, der eingebaute `BarcodeDetector` ist ein Ersatz-Objekt. Geprüft: Knopf nur mit Kamera; eingebauter
 * Leser (Chrome Android) → Produktansicht; ZXing-Leser (iPhone: Safari/Chrome = WebKit ohne eingebauten Leser) von
 * UNSERER Domain, erst nach dem Knopfdruck geladen, nie vom CDN; Kamera endet nach dem Treffer; Kamera verweigert →
 * Hinweis + Nummer eintippen. Keine Bilder verlassen die Seite (alle fremden Adressen sind gesperrt).
 */

const PLAUSIBEL = MOCK_PRODUCT_CASES.find((c) => c.key === 'plausibel')?.code ?? '';

type CameraMode = 'none' | 'canvas' | 'denied' | 'missing';

/** Ersatz für Kamera (und optional den eingebauten Leser) – vor dem Laden der Seite. */
async function fakeCamera(
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

/** Alle Anfragen an fremde Adressen sperren und merken (keine Bilder, kein CDN). */
async function recordRequests(page: Page) {
  const local: string[] = [];
  const foreign: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:') {
      local.push(url.pathname);
      return route.continue();
    }
    foreign.push(url.href);
    return route.abort();
  });
  return { local, foreign };
}

async function openProduct(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);
  await page.getByTestId('food-log').getByTestId('food-log-add').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await page.getByTestId('food-log-product').click();
  await expect(page.getByTestId('food-product')).toBeVisible();
  await expect(page.getByTestId('food-product-code')).toBeVisible();
}

const scanState = (page: Page) =>
  page.evaluate(() => {
    const s = (
      window as unknown as {
        __scan: {
          getUserMedia: number;
          detect: number;
          tracks: MediaStreamTrack[];
          formats: unknown;
        };
      }
    ).__scan;
    return {
      getUserMedia: s.getUserMedia,
      detect: s.detect,
      formats: s.formats,
      tracksLive: s.tracks.filter((t) => t.readyState === 'live').length,
      tracks: s.tracks.length,
    };
  });

test('ohne Kamera-Schnittstelle: kein Kamera-Knopf, Nummer eintippen geht', async ({ page }) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'none', builtInDetector: false });
  await openProduct(page);
  await expect(page.getByTestId('food-product-scan')).toHaveCount(0);
  await page.getByTestId('food-product-code').fill(PLAUSIBEL);
  await page.getByTestId('food-product-search').click();
  await expect(page.getByTestId('food-product-card')).toBeVisible();
});

test('eingebauter Leser (Chrome Android): Scan → Produktansicht, Fehllesung übersprungen, Kamera aus', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'canvas', builtInDetector: true });
  const requests = await recordRequests(page);
  await openProduct(page);
  await expect(page.getByTestId('food-product-scan')).toHaveText('Mit der Kamera scannen');
  await page.getByTestId('food-product-scan').click();

  await expect(page.getByTestId('food-product-card')).toContainText(
    'Testprodukt Müsli (Testwerte)',
  );
  // Gleicher Ablauf wie beim Eintippen: Nummer steht im Feld, Mengenwahl da.
  await expect(page.getByTestId('food-product-code')).toHaveValue(PLAUSIBEL);
  await expect(page.getByTestId('food-product-amount-serving')).toBeVisible();
  await expect(page.getByTestId('food-product-scanner')).toHaveCount(0);
  const state = await scanState(page);
  expect(state.getUserMedia).toBe(1);
  expect(state.detect).toBe(4);
  expect(state.formats).toEqual(['ean_13', 'ean_8', 'upc_a', 'upc_e']);
  expect(state.tracks).toBeGreaterThan(0);
  expect(state.tracksLive).toBe(0);
  // Der ZXing-Leser wurde nicht gebraucht und nicht geladen.
  expect(requests.local.filter((p) => p.includes('ponyfill') || p.includes('/scanner/'))).toEqual(
    [],
  );
  expect(requests.foreign).toEqual([]);
});

test('ZXing-Leser (iPhone/WebKit, kein eingebauter Leser): echter Scan, Leser von unserer Domain, erst nach Knopfdruck', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'canvas', builtInDetector: false });
  const requests = await recordRequests(page);
  await openProduct(page);
  expect(requests.local.filter((p) => p.includes('ponyfill') || p.includes('/scanner/'))).toEqual(
    [],
  );
  // Kein Warten auf die Vorschau: Mit zwischengespeichertem Leser ist der Treffer oft schneller als die Prüfung.
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-card')).toContainText(
    'Testprodukt Müsli (Testwerte)',
    { timeout: 30_000 },
  );
  await expect(page.getByTestId('food-product-code')).toHaveValue(PLAUSIBEL);
  expect(requests.local.some((p) => /\/ponyfill-[0-9a-f]+\.js$/.test(p))).toBe(true);
  expect(requests.local).toContain('/scanner/3.1.3/zxing_reader.wasm');
  expect(requests.foreign).toEqual([]);
  expect((await scanState(page)).tracksLive).toBe(0);

  // Eintragen wie beim Eintippen.
  await page.getByTestId('food-product-amount-serving').click();
  await page.getByTestId('food-product-add').click();
  await expect(page.getByTestId('food-product-message')).toBeVisible();
});

test('Kamera verweigert: freundlicher Hinweis, Nummer eintippen führt weiter', async ({ page }) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'denied', builtInDetector: true });
  await openProduct(page);
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scan-denied')).toContainText(
    'Ohne Kamera-Erlaubnis kannst du die Nummer eintippen.',
  );
  await expect(page.getByTestId('food-product-scan-denied')).toContainText('Berechtigungen');
  await expect(page.getByTestId('food-product-scanner')).toHaveCount(0);
  await page.getByTestId('food-product-code').fill(PLAUSIBEL);
  await page.getByTestId('food-product-search').click();
  await expect(page.getByTestId('food-product-card')).toBeVisible();
  await expect(page.getByTestId('food-product-scan-denied')).toHaveCount(0);
});

test('keine Kamera gefunden: Hinweis, zurück zur Nummer', async ({ page }) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'missing', builtInDetector: true });
  await openProduct(page);
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scan-unavailable')).toContainText(
    'Die Kamera ließ sich nicht starten',
  );
  await expect(page.getByTestId('food-product-code')).toBeVisible();
});

test('Abbrechen beendet die Kamera', async ({ page }) => {
  test.setTimeout(120_000);
  // Bild ohne Strichcode: Die Kamera läuft, bis die Person abbricht.
  await fakeCamera(page, { camera: 'canvas', builtInDetector: false, code: '' });
  await openProduct(page);
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scanner')).toBeVisible();
  await expect(page.getByTestId('food-product-scan-ready')).toBeVisible();
  await expect.poll(async () => (await scanState(page)).tracksLive).toBeGreaterThan(0);
  await page.getByTestId('food-product-scan-cancel').click();
  await expect(page.getByTestId('food-product-scanner')).toHaveCount(0);
  await expect(page.getByTestId('food-product-code')).toBeVisible();
  await expect.poll(async () => (await scanState(page)).tracksLive).toBe(0);
});

test('Kamera vom System beendet (Track „ended“): Kamera aus, Hinweis, zurück zur Nummer', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'canvas', builtInDetector: false, code: '' });
  await openProduct(page);
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scan-ready')).toBeVisible();
  // track.stop() allein löst kein „ended“ aus (Spezifikation) – das System (z. B. Kamera getrennt) schon.
  await page.evaluate(() => {
    const s = (window as unknown as { __scan: { tracks: MediaStreamTrack[] } }).__scan;
    for (const track of s.tracks) {
      track.stop();
      track.dispatchEvent(new Event('ended'));
    }
  });
  await expect(page.getByTestId('food-product-scan-interrupted')).toContainText(
    'Die Kamera wurde beendet',
  );
  await expect(page.getByTestId('food-product-scanner')).toHaveCount(0);
  await expect(page.getByTestId('food-product-code')).toBeVisible();
});

test('Seite im Hintergrund (visibilitychange): Kamera sofort aus, zurück zur Nummer', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'canvas', builtInDetector: false, code: '' });
  await openProduct(page);
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scan-ready')).toBeVisible();
  await expect.poll(async () => (await scanState(page)).tracksLive).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await scanState(page)).tracksLive).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
  await expect(page.getByTestId('food-product-scan-interrupted')).toBeVisible();
  await expect(page.getByTestId('food-product-scanner')).toHaveCount(0);
  // Erneut scannen geht.
  await page.getByTestId('food-product-scan').click();
  await expect(page.getByTestId('food-product-scan-ready')).toBeVisible();
});

test('Testmodus: Strichcodes der Testnummern zum Scannen am zweiten Handy', async ({ page }) => {
  test.setTimeout(120_000);
  await fakeCamera(page, { camera: 'none', builtInDetector: false });
  await openProduct(page);
  await expect(page.getByTestId('food-product-testbarcodes')).toHaveCount(0);
  await page.getByTestId('food-product-testbarcodes-toggle').click();
  const list = page.getByTestId('food-product-testbarcodes');
  await expect(list).toContainText('zweiten Handy');
  await expect(list.locator('svg')).toHaveCount(MOCK_PRODUCT_CASES.length);
  // EAN-13 hat 30 Striche (12 Ziffern × 2 + Rand-/Mittelzeichen 3 × 2), dazu das weiße Hintergrund-Rechteck.
  await expect(list.locator('svg').first().locator('rect')).toHaveCount(31);
  await page.getByTestId('food-product-testbarcodes-toggle').click();
  await expect(page.getByTestId('food-product-testbarcodes')).toHaveCount(0);
});
