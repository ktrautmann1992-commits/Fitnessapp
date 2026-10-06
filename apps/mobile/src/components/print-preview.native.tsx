/**
 * iPhone/Android: keine Vorschau in der App – expo-print zeigt das Dokument im System-Druckdialog
 * (lib/print-output.native.ts). Gegenstück für den Browser: print-preview.tsx.
 */
export function PrintPreview(props: { html: string; title: string }): null {
  void props;
  return null;
}
