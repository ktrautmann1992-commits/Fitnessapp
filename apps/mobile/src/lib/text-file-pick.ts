/**
 * Textdatei wählen und lesen – Browser (Web-Export). Für den GPX-Import (Sportarten Stufe 1 · Wandern): Die Datei
 * wird nur im Arbeitsspeicher gelesen, nichts wird hochgeladen. Zu große Dateien werden vor dem Lesen abgelehnt.
 * Gegenstück für iPhone/Android: text-file-pick.native.ts.
 */
export type TextFilePick =
  | { readonly kind: 'ok'; readonly text: string; readonly name: string }
  | { readonly kind: 'cancelled' | 'unreadable' | 'too_large' | 'unsupported' };

export const TEXT_FILE_PICK_SUPPORTED = true;

/** Eingabefeld für Tests erreichbar (Playwright: Dateiauswahl). */
export const TEXT_FILE_INPUT_TEST_ID = 'gpx-file-input';

export function pickTextFile(options: {
  readonly accept: string;
  readonly maxBytes: number;
}): Promise<TextFilePick> {
  if (typeof document === 'undefined') return Promise.resolve({ kind: 'unsupported' });
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    input.setAttribute('data-testid', TEXT_FILE_INPUT_TEST_ID);
    input.style.display = 'none';
    let done = false;
    const finish = (result: TextFilePick) => {
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
      if (file.size > options.maxBytes) {
        finish({ kind: 'too_large' });
        return;
      }
      void file.text().then(
        (text) => finish({ kind: 'ok', text, name: file.name }),
        () => finish({ kind: 'unreadable' }),
      );
    });
    input.addEventListener('cancel', () => finish({ kind: 'cancelled' }));
    document.body.appendChild(input);
    input.click();
  });
}
