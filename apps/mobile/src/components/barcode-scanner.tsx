import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Body, Card, Heading } from '@/components/ui';
import { t } from '@/i18n';
import {
  type BarcodeScanResult,
  cameraErrorKind,
  firstUsableScan,
  prefersBuiltInDetector,
  scannerWasmPath,
  WEB_SCAN_FORMATS,
  WEB_SCAN_INTERVAL_MS,
  webScanSupported,
} from '@/lib/barcode-scan';
import { useThemeColors } from '@/lib/theme';

/**
 * Strichcode per Kamera – Browser (Web-Export, Etappe E4b, docs/PLAN-E4.md 5.1). Kamera über `getUserMedia`
 * (Rückkamera), Vorschau im Bildschirm, alle ~200 ms ein Leseversuch. Leser: eingebauter `BarcodeDetector`
 * (Chrome auf Android), sonst ZXing als WebAssembly (iPhone: Safari und Chrome sind WebKit und haben keinen
 * eingebauten Leser) – erst beim Druck auf „Mit der Kamera scannen“ nachgeladen, von unserer Domain.
 * Der erste gültige Code beendet die Kamera sofort. Bilder werden nie gespeichert, gesendet oder geloggt.
 * Gegenstück für iPhone/Android: barcode-scanner.native.tsx.
 */

/** Knopf „Mit der Kamera scannen“ zeigen? */
export function barcodeScanSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return webScanSupported({
    isSecureContext: window.isSecureContext,
    mediaDevices: navigator.mediaDevices,
    BarcodeDetector: (window as { BarcodeDetector?: unknown }).BarcodeDetector,
    WebAssembly: (globalThis as { WebAssembly?: unknown }).WebAssembly,
  });
}

/** Hinweis, wo man die Kamera-Erlaubnis ändert (Browser). */
export const CAMERA_SETTINGS_HELP = t.foodProduct.scan.deniedHowToWeb;

/** Im Browser gibt es keinen Knopf zu den Einstellungen. */
export const openCameraSettings: (() => void) | null = null;

interface DetectedCode {
  readonly rawValue: string;
  readonly format: string;
}
interface Detector {
  detect(source: HTMLVideoElement): Promise<readonly DetectedCode[]>;
}
type DetectorClass = new (options: { formats: string[] }) => Detector;

const noop = () => undefined;

/**
 * ZXing einmal je Seite vorbereiten (gleiche `overrides` = gleiches Modul, kein zweites Laden). Schlägt das Laden
 * fehl (z. B. kurz offline), wird beim nächsten Versuch neu angefangen.
 */
let zxingReady: Promise<DetectorClass> | null = null;

function loadZxing(): Promise<DetectorClass> {
  zxingReady ??= (async () => {
    const zxing = await import('barcode-detector/ponyfill');
    const wasm = scannerWasmPath(zxing.ZXING_WASM_VERSION);
    await zxing.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? wasm : prefix + path,
        print: noop,
        printErr: noop,
      },
      fireImmediately: true,
    });
    return zxing.BarcodeDetector as unknown as DetectorClass;
  })().catch((error: unknown) => {
    zxingReady = null;
    throw error;
  });
  return zxingReady;
}

async function createDetector(): Promise<Detector> {
  const builtIn = (window as { BarcodeDetector?: unknown }).BarcodeDetector;
  if (await prefersBuiltInDetector(builtIn)) {
    return new (builtIn as DetectorClass)({ formats: [...WEB_SCAN_FORMATS] });
  }
  // Nachladen nur hier (eigenes Bündel, ~1 MB WebAssembly). Die WebAssembly-Datei kommt von unserer Domain statt vom
  // voreingestellten CDN; Ausgaben des Lesers gehen nicht in die Konsole.
  const ZXingDetector = await loadZxing();
  return new ZXingDetector({ formats: [...WEB_SCAN_FORMATS] });
}

export function BarcodeScanner({
  onResult,
}: {
  /** Genau einmal: Code, verweigert oder nicht verfügbar (Abbrechen: Bildschirm entfernt den Scanner). */
  onResult: (result: BarcodeScanResult) => void;
}) {
  const theme = useThemeColors();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resultRef = useRef(onResult);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer !== undefined) clearTimeout(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
      stream = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
    const finish = (result: BarcodeScanResult) => {
      if (stopped) return;
      stop();
      resultRef.current(result);
    };
    // Seite im Hintergrund (App gewechselt, Bildschirm aus) oder Kamera vom System beendet → Kamera aus, zurück zur
    // Nummer. Nie im Hintergrund weiterfilmen.
    const interrupted = () => finish({ kind: 'interrupted' });
    function onVisibility() {
      if (document.hidden) interrupted();
    }
    document.addEventListener('visibilitychange', onVisibility);
    // Leser parallel zur Kamera-Frage laden (spart Wartezeit); Fehler erst auswerten, wenn die Kamera läuft.
    const detectorPromise = createDetector().then(
      (detector) => ({ detector }),
      () => ({ detector: null }),
    );
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (error) {
        finish({ kind: cameraErrorKind(error) });
        return;
      }
      if (stopped) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      for (const track of stream.getTracks()) track.addEventListener('ended', interrupted);
      const video = videoRef.current;
      if (!video) {
        finish({ kind: 'unavailable' });
        return;
      }
      video.srcObject = stream;
      await video.play().catch(noop);
      const { detector } = await detectorPromise;
      if (stopped) return;
      if (detector === null) {
        finish({ kind: 'unavailable' });
        return;
      }
      setReady(true);
      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const found = await detector.detect(video);
            const digits = firstUsableScan(
              found.map((code) => ({ value: code.rawValue, format: code.format })),
            );
            if (digits !== null) {
              finish({ kind: 'code', digits });
              return;
            }
          } catch {
            // Einzelnes Bild nicht lesbar – beim nächsten weiter.
          }
        }
        if (!stopped) timer = setTimeout(() => void tick(), WEB_SCAN_INTERVAL_MS);
      };
      void tick();
    })();
    return stop;
  }, []);

  return (
    <Card>
      <Heading level={2}>{t.foodProduct.scan.title}</Heading>
      <View
        testID="food-product-scanner"
        style={{
          width: '100%',
          aspectRatio: 4 / 3,
          maxHeight: 360,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label={t.foodProduct.scan.previewLabel}
          data-testid="food-product-scan-video"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: '30%',
            bottom: '30%',
            borderWidth: 3,
            borderRadius: 8,
            borderColor: theme.primary,
          }}
        />
      </View>
      <Body muted testID={ready ? 'food-product-scan-ready' : 'food-product-scan-starting'}>
        {ready ? t.foodProduct.scan.hint : t.foodProduct.scan.starting}
      </Body>
      <Body muted>{t.foodProduct.scan.privacy}</Body>
    </Card>
  );
}
