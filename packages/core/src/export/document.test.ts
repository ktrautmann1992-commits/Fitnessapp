import { describe, expect, it } from 'vitest';

import {
  PRINT_TEXT_CODES,
  printBlockSchema,
  printData,
  printDocumentSchema,
  printLabel,
  printText,
  printTextSchema,
} from './document';

const doc = {
  meta: {
    kind: 'training_plan',
    title: printLabel('doc.title'),
    fileName: 'alpha5-trainingsplan-2026-10-05',
    footer: printLabel('doc.footer'),
    createdOn: '2026-10-05',
  },
  sections: [{ type: 'heading', level: 1, text: printLabel('cover.heading') }],
};

describe('Druck-Dokument (Zod)', () => {
  it('nimmt ein gültiges Dokument an', () => {
    expect(printDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it('jeder Code hat ein Parameter-Schema; falsche Parameter werden abgelehnt', () => {
    expect(PRINT_TEXT_CODES.length).toBeGreaterThan(40);
    expect(printTextSchema.safeParse(printText('value.kg', { kg: 22.5 })).success).toBe(true);
    for (const bad of [
      { kind: 'text', code: 'value.kg', params: { kg: '22,5' } },
      { kind: 'text', code: 'value.kg', params: { kg: 1, extra: true } },
      { kind: 'text', code: 'unbekannt', params: {} },
      { kind: 'text', code: 'plan.note', params: { note: 'endurance_walk' } },
      {
        kind: 'text',
        code: 'plan.name',
        params: {
          goal: 'muscle_gain',
          discipline: null,
          strengthDays: 3,
          enduranceDays: 0,
          level: 'beginner',
        },
      },
      { kind: 'data', value: 'Zeile\u0007' },
      { kind: 'date', iso: '05.10.2026' },
      { kind: 'number', value: Number.NaN },
    ]) {
      expect(printTextSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('Tabelle: jede Zeile hat so viele Zellen wie Spalten ohne Zeilenkopf', () => {
    const table = {
      type: 'table',
      caption: printLabel('week.heading'),
      columns: [
        { header: printLabel('col.exercise'), role: 'label' },
        { header: printLabel('col.sets'), role: 'value' },
      ],
      rows: [{ header: [printData('Kniebeuge')], cells: [[]] }],
    };
    expect(printBlockSchema.safeParse(table).success).toBe(true);
    expect(
      printBlockSchema.safeParse({ ...table, rows: [{ header: [], cells: [[], []] }] }).success,
    ).toBe(false);
  });

  it('mehr als 4 Mitschreib-Spalten nur auf Querformat-Seiten (B9, K5)', () => {
    const table = (logs: number) => ({
      type: 'table',
      caption: printLabel('week.heading'),
      columns: [
        { header: printLabel('col.exercise'), role: 'label' },
        ...Array.from({ length: logs }, (_, i) => ({
          header: printText('col.log', { no: i + 1 }),
          role: 'log',
        })),
      ],
      rows: [{ header: [printData('Kniebeuge')], cells: Array.from({ length: logs }, () => []) }],
    });
    const withSections = (sections: unknown[]) => ({
      ...doc,
      sections: [...doc.sections, ...sections],
    });
    expect(printDocumentSchema.safeParse(withSections([table(4)])).success).toBe(true);
    expect(printDocumentSchema.safeParse(withSections([table(5)])).success).toBe(false);
    expect(
      printDocumentSchema.safeParse(
        withSections([{ type: 'pageBreak', orientation: 'landscape' }, table(8)]),
      ).success,
    ).toBe(true);
    expect(
      printDocumentSchema.safeParse(
        withSections([
          { type: 'pageBreak', orientation: 'landscape' },
          { type: 'pageBreak', orientation: 'portrait' },
          table(8),
        ]),
      ).success,
    ).toBe(false);
  });

  it('Inhalte ohne Steuer- und Formatzeichen (z. B. Rechts-nach-links U+202E, K4)', () => {
    expect(printTextSchema.safeParse(printData('Anna\u202Eabc')).success).toBe(false);
    expect(printTextSchema.safeParse(printData('Anna\u200Bx')).success).toBe(false);
    expect(printTextSchema.safeParse(printData('Anna-Lena Müller')).success).toBe(true);
  });

  it('Dateiname nur aus [a-z0-9-] (kein Name, keine Pfade)', () => {
    for (const fileName of ['Anna Plan', '../x', 'alpha5_plan', 'plan.pdf']) {
      expect(
        printDocumentSchema.safeParse({ ...doc, meta: { ...doc.meta, fileName } }).success,
      ).toBe(false);
    }
  });
});
