import { renderPrintHtml } from '@fitnessapp/ui/print';
import { expect, test } from '@playwright/test';

import { translatePrintDocument } from '../src/lib/print-document';
import { exampleDocument, extremeDocument, PRINT_EXAMPLES } from '../src/test/print-examples';
import { expectA4, pageHeights, pdfPageCount } from './print-helpers';

/**
 * PDF-Export: Passt jede Seite auf A4? (docs/PLAN-PDF-EXPORT.md §12, Wächter K2)
 * Für alle CI-Beispiele und den Belastungstest (8 Übungen, lange Namen, Supersatz + „ersetzt“, 600 Zeichen
 * Aufwärmen), hochkant und quer: Höhe jeder `section.page` beim Drucken ≤ 297 mm bzw. ≤ 210 mm, und das von
 * Chromium erzeugte PDF hat genau so viele Seiten wie das Dokument Abschnitte.
 */

const cases: { name: string; html: () => string }[] = [
  ...PRINT_EXAMPLES.map((example) => ({
    name: example.slug,
    html: () => renderPrintHtml(translatePrintDocument(exampleDocument(example))),
  })),
  {
    name: 'belastungstest-hochkant',
    html: () => renderPrintHtml(translatePrintDocument(extremeDocument())),
  },
  {
    name: 'belastungstest-quer',
    html: () =>
      renderPrintHtml(translatePrintDocument(extremeDocument({ logColumns: 8, landscape: true }))),
  },
];

test.describe('Druck-HTML passt auf A4', () => {
  test.use({ viewport: { width: 1200, height: 900 }, isMobile: false, hasTouch: false });

  for (const c of cases) {
    test(c.name, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : undefined));
      await page.setContent(c.html(), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'print' });
      const pages = await pageHeights(page, 'section.page');
      expectA4(pages);
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      expect(pdfPageCount(pdf)).toBe(pages.length);
      expect(errors).toEqual([]);
    });
  }
});
