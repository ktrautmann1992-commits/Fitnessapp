/**
 * Im Browser bindet public/index.html die Schrift per @font-face ein (font-display: swap) –
 * hier gibt es nichts zu laden. Gegenstück für iPhone/Android: use-brand-fonts.native.ts.
 */
export function useBrandFonts(): boolean {
  return true;
}
