import { normalizeScannedBarcode } from '@fitnessapp/core';

/**
 * Strichcode per Kamera (Etappe E4b, docs/PLAN-E4.md 5) – reine Entscheidungen ohne Kamera und ohne DOM, damit sie
 * sich ohne Gerät testen lassen. Die Bildschirm-Teile stehen in `components/barcode-scanner.tsx` (Browser) bzw.
 * `barcode-scanner.native.tsx` (App).
 *
 * Datenschutz: Kamerabilder bleiben im Arbeitsspeicher des Geräts. Sie werden nie gespeichert, nie gesendet und nie
 * geloggt – weiter geht nur die erkannte Nummer, und die durch dieselbe Prüfung wie beim Eintippen (Prüfziffer, UPC-A
 * → EAN-13, Ladencodes ohne Abfrage).
 */

/** Ergebnis eines Scans für den Bildschirm. */
export type BarcodeScanResult =
  /** Gültige Nummer oder Laden-/Buchcode: Ziffern fürs Nummernfeld, danach derselbe Ablauf wie beim Eintippen. */
  | { readonly kind: 'code'; readonly digits: string }
  /** Kamera-Erlaubnis verweigert → Nummer eintippen + Hinweis, wo man die Erlaubnis ändert. */
  | { readonly kind: 'denied' }
  /** Keine Kamera, Kamera belegt, Leser lädt nicht … → Nummer eintippen. */
  | { readonly kind: 'unavailable' };

/** Was der Browser mitbringt – als Parameter, damit Tests ohne echten Browser auskommen. */
export interface WebScanEnvironment {
  readonly isSecureContext?: boolean;
  readonly mediaDevices?: { readonly getUserMedia?: unknown } | undefined;
  readonly BarcodeDetector?: unknown;
  readonly WebAssembly?: unknown;
}

/**
 * Knopf „Mit der Kamera scannen“ im Browser nur, wenn Kamera (HTTPS + getUserMedia) und ein Leser da sind:
 * eingebauter `BarcodeDetector` (Chrome Android) oder WebAssembly für den ZXing-Leser (iPhone: Safari und Chrome,
 * beide WebKit; Firefox).
 */
export function webScanSupported(env: WebScanEnvironment): boolean {
  if (env.isSecureContext === false) return false;
  if (typeof env.mediaDevices?.getUserMedia !== 'function') return false;
  return typeof env.BarcodeDetector === 'function' || typeof env.WebAssembly === 'object';
}

/** Formate, nach denen der Browser-Leser sucht (Namen der Barcode Detection API). */
export const WEB_SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

/**
 * Eingebauter Leser nur, wenn er EAN-13 kann (`getSupportedFormats()`, Plan 5.1) – sonst ZXing (nachgeladen).
 * Fehler beim Abfragen → ZXing.
 */
export async function prefersBuiltInDetector(detector: unknown): Promise<boolean> {
  if (typeof detector !== 'function') return false;
  const getFormats = (detector as { getSupportedFormats?: unknown }).getSupportedFormats;
  if (typeof getFormats !== 'function') return false;
  try {
    const formats: unknown = await (getFormats as () => Promise<unknown>).call(detector);
    return Array.isArray(formats) && formats.includes('ean_13');
  } catch {
    return false;
  }
}

/**
 * Fehler von `getUserMedia` bzw. der App-Kamera → verweigert oder nicht verfügbar. `NotAllowedError` (Person oder
 * Browser-Einstellung), `SecurityError` (z. B. kein HTTPS, Richtlinie) und das alte `PermissionDeniedError` gelten als
 * verweigert.
 */
export function cameraErrorKind(error: unknown): 'denied' | 'unavailable' {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? (error as { name: unknown }).name
      : null;
  return name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError'
    ? 'denied'
    : 'unavailable';
}

/** Ein erkannter Code, wie ihn Browser-Leser (`rawValue`/`format`) bzw. expo-camera (`data`/`type`) liefern. */
export interface RawScan {
  readonly value: unknown;
  readonly format: unknown;
}

/**
 * Erster brauchbarer Code aus einem Bild: gültig (`ok`) oder Laden-/Buchcode (`not_food`, damit der Hinweis kommt).
 * Fehllesungen (falsche Prüfziffer, QR-Code, falsche Länge) → null, die Kamera sucht weiter.
 */
export function firstUsableScan(scans: readonly RawScan[]): string | null {
  for (const scan of scans.slice(0, 20)) {
    const checked = normalizeScannedBarcode(scan.value, scan.format);
    if (checked.digits !== null && (checked.ok || checked.reason === 'not_food')) {
      return checked.digits;
    }
  }
  return null;
}

/** Abstand zwischen zwei Leseversuchen im Browser (Plan 5.1: ~200 ms; schont Akku und Rechenzeit). */
export const WEB_SCAN_INTERVAL_MS = 200;

/**
 * Pfad des ZXing-Lesers (WebAssembly) auf UNSERER Domain – nie vom CDN (jsDelivr) des Pakets, das würde die
 * IP-Adresse der Person an Dritte geben. Die Datei kopiert `scripts/copy-scanner-wasm.mjs` beim Bauen nach
 * `public/scanner/<Version>/`.
 */
export function scannerWasmPath(version: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('Unerwartete Version des Strichcode-Lesers.');
  return `/scanner/${version}/zxing_reader.wasm`;
}
