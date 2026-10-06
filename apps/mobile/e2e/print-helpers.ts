import { expect, type Page } from '@playwright/test';

/** Hilfen für die A4-Prüfung der Druckansicht (Wächter K2) – genutzt von print-pages.spec.ts und training-plan.spec.ts. */

const MM = 96 / 25.4; // CSS-Pixel je Millimeter
const TOLERANCE_PX = 1;

/** Höhe und Ausrichtung jeder Seite im Druck-Layout (A4-Breite, Druck-CSS). */
export async function pageHeights(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((sections) =>
    sections.map((section) => ({
      landscape: section.classList.contains('page--landscape'),
      height: section.getBoundingClientRect().height,
      hasFooter: section.querySelector('.page-footer') !== null,
    })),
  );
}

export function expectA4(pages: { landscape: boolean; height: number; hasFooter: boolean }[]) {
  expect(pages.length).toBeGreaterThan(0);
  pages.forEach((p, index) => {
    const limit = (p.landscape ? 210 : 297) * MM + TOLERANCE_PX;
    expect(
      p.height,
      `Seite ${index + 1} (${p.landscape ? 'quer' : 'hochkant'}) zu hoch`,
    ).toBeLessThanOrEqual(limit);
    expect(p.hasFooter).toBe(true);
  });
}

/** Seiten im PDF zählen (Seiten-Objekte, nicht der Seitenbaum „/Pages“). */
export function pdfPageCount(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;
}
