import { AI_FOOD_PHOTO } from '@fitnessapp/core';

/**
 * Foto aufnehmen oder wählen – Browser (Web-Export, Etappe E3). Öffnet die Dateiauswahl (auf dem Handy mit Kamera),
 * verkleinert das Bild auf höchstens 1.024 px (längste Seite) und speichert es neu als JPEG. Das Neu-Zeichnen auf
 * einer Zeichenfläche entfernt dabei alle Metadaten (EXIF, Standort) – der Server entfernt sie zur Sicherheit noch
 * einmal. Das Bild bleibt nur im Arbeitsspeicher; nichts wird auf dem Gerät gespeichert.
 * Gegenstück für iPhone/Android: photo-pick.native.ts.
 */
export type PhotoPick =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'cancelled' | 'unreadable' | 'unsupported' };

export const PHOTO_PICK_SUPPORTED = true;

/** Eingabefeld für Tests erreichbar (Playwright: Dateiauswahl). */
export const PHOTO_INPUT_TEST_ID = 'food-photo-file-input';

export function pickPhoto(): Promise<PhotoPick> {
  if (typeof document === 'undefined') return Promise.resolve({ kind: 'unsupported' });
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = AI_FOOD_PHOTO.imageMimeTypes.join(',');
    input.setAttribute('capture', 'environment');
    input.setAttribute('data-testid', PHOTO_INPUT_TEST_ID);
    input.style.display = 'none';
    let done = false;
    const finish = (result: PhotoPick) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(result);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish({ kind: 'cancelled' });
        return;
      }
      void shrink(file).then(finish, () => finish({ kind: 'unreadable' }));
    });
    input.addEventListener('cancel', () => finish({ kind: 'cancelled' }));
    document.body.appendChild(input);
    input.click();
  });
}

async function shrink(file: Blob): Promise<PhotoPick> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    if (longest === 0) return { kind: 'unreadable' };
    const scale = Math.min(1, AI_FOOD_PHOTO.maxImagePx / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return { kind: 'unreadable' };
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob) return { kind: 'unreadable' };
    return { kind: 'ok', bytes: new Uint8Array(await blob.arrayBuffer()) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
