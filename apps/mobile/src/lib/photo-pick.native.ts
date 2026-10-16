/**
 * Foto aufnehmen oder wählen – iPhone/Android (Etappe E3). In dieser Testversion noch NICHT eingebaut: Dafür braucht
 * die App `expo-image-picker` und `expo-image-manipulator` (Kamera-Rechte, Verkleinern auf 1.024 px, EXIF entfernen)
 * und damit einen neuen EAS-Build. Bis dahin zeigt der Bildschirm einen Hinweis; im Testmodus geht „Beispielfoto
 * verwenden“. Gegenstück für den Browser: photo-pick.ts.
 */
export type PhotoPick =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'cancelled' | 'unreadable' | 'unsupported' };

export const PHOTO_PICK_SUPPORTED = false;

export const PHOTO_INPUT_TEST_ID = 'food-photo-file-input';

export function pickPhoto(): Promise<PhotoPick> {
  return Promise.resolve({ kind: 'unsupported' });
}
