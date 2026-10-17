import { requireOptionalNativeModule } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { Body, Card, Heading, LoadingState } from '@/components/ui';
import { t } from '@/i18n';
import { type BarcodeScanResult, firstUsableScan } from '@/lib/barcode-scan';
import { useThemeColors } from '@/lib/theme';

/**
 * Strichcode per Kamera – iPhone/Android (Etappe E4b, docs/PLAN-E4.md 5.2): `expo-camera` (`CameraView`) liest
 * EAN-13, EAN-8, UPC-A und UPC-E direkt auf dem Gerät (iOS: AVFoundation, Android: ML Kit). Keine Fotos, kein Video,
 * kein Mikrofon; Bilder werden nie gespeichert oder gesendet, weiter geht nur die Nummer.
 *
 * Ältere App-Builds ohne das native Kamera-Modul: `requireOptionalNativeModule` liefert null → kein Knopf, nur
 * „Nummer eintippen“ (kein Absturz). Erst ein neuer EAS-Build bringt die Kamera ins Gerät.
 * Gegenstück für den Browser: barcode-scanner.tsx.
 */

type ExpoCameraModule = typeof import('expo-camera');

const cameraModule: ExpoCameraModule | null = (() => {
  if (requireOptionalNativeModule('ExpoCamera') === null) return null;
  try {
    // Erst laden, wenn das native Modul sicher da ist (expo-camera verlangt es beim Import).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-camera') as ExpoCameraModule;
  } catch {
    return null;
  }
})();

/** Knopf „Mit der Kamera scannen“ zeigen? */
export function barcodeScanSupported(): boolean {
  return cameraModule !== null;
}

/** Hinweis, wo man die Kamera-Erlaubnis ändert (App). */
export const CAMERA_SETTINGS_HELP = t.foodProduct.scan.deniedHowToApp;

/** Öffnet die Einstellungen der App (Kamera-Erlaubnis). */
export const openCameraSettings: (() => void) | null = () => {
  void Linking.openSettings().catch(() => undefined);
};

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export function BarcodeScanner({
  onResult,
}: {
  /** Genau einmal: Code, verweigert oder nicht verfügbar (Abbrechen: Bildschirm entfernt den Scanner). */
  onResult: (result: BarcodeScanResult) => void;
}) {
  const theme = useThemeColors();
  const resultRef = useRef(onResult);
  const done = useRef(false);
  const [granted, setGranted] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let active = true;
    const finish = (result: BarcodeScanResult) => {
      if (!active || done.current) return;
      done.current = true;
      resultRef.current(result);
    };
    if (cameraModule === null) {
      finish({ kind: 'unavailable' });
      return () => {
        active = false;
      };
    }
    cameraModule.Camera.requestCameraPermissionsAsync()
      .then((permission) => {
        if (!active) return;
        if (permission.granted) setGranted(true);
        else finish({ kind: 'denied' });
      })
      .catch(() => finish({ kind: 'unavailable' }));
    return () => {
      active = false;
    };
  }, []);

  const finish = (result: BarcodeScanResult) => {
    if (done.current) return;
    done.current = true;
    setFinished(true);
    resultRef.current(result);
  };

  const CameraView = cameraModule?.CameraView;
  return (
    <Card>
      <Heading level={2}>{t.foodProduct.scan.title}</Heading>
      {granted && CameraView && !finished ? (
        <View
          testID="food-product-scanner"
          style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={(scan) => {
              const digits = firstUsableScan([{ value: scan.data, format: scan.type }]);
              if (digits !== null) finish({ kind: 'code', digits });
            }}
            onMountError={() => finish({ kind: 'unavailable' })}
            accessibilityLabel={t.foodProduct.scan.previewLabel}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '10%',
              right: '10%',
              top: '38%',
              bottom: '38%',
              borderWidth: 3,
              borderRadius: 8,
              borderColor: theme.primary,
            }}
          />
        </View>
      ) : (
        <LoadingState label={t.foodProduct.scan.starting} />
      )}
      <Body muted>{granted ? t.foodProduct.scan.hint : t.foodProduct.scan.starting}</Body>
      <Body muted>{t.foodProduct.scan.privacy}</Body>
    </Card>
  );
}
