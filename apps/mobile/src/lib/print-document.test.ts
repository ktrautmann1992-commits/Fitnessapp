import { printLabel, printText, type PrintDocument } from '@fitnessapp/core';
import { renderPrintHtml } from '@fitnessapp/ui/print';
import { describe, expect, it } from 'vitest';

import { t } from '@/i18n';

import { exampleDocument, extremeDocument, PRINT_EXAMPLES } from '../test/print-examples';
import { translatePrintDocument, translatePrintText } from './print-document';

describe('translatePrintText', () => {
  it('Planname ohne Level aus Ziel und Tagen', () => {
    expect(
      translatePrintText(
        printText('plan.name', {
          goal: 'muscle_gain',
          discipline: null,
          strengthDays: 3,
          enduranceDays: 0,
        }),
      ),
    ).toBe('Muskelaufbau · 3 Tage');
    expect(
      translatePrintText(
        printText('plan.name', {
          goal: 'endurance',
          discipline: '10k',
          strengthDays: 2,
          enduranceDays: 3,
        }),
      ),
    ).toBe('Ausdauer-Grundlage – 10 km · 2 × Kraft, 3 × Ausdauer');
    expect(
      translatePrintText(
        printText('plan.name', { goal: null, discipline: null, strengthDays: 1, enduranceDays: 0 }),
      ),
    ).toBe('Trainingsplan · 1 Tag');
  });

  it('Werte deutsch formatiert', () => {
    expect(translatePrintText(printText('value.kg', { kg: 22.5 }))).toBe('22,5 kg');
    expect(translatePrintText(printText('value.rpe', { rpe: 7.5 }))).toBe('7,5');
    expect(translatePrintText(printText('value.reps', { min: 8, max: 12 }))).toBe('8–12');
    expect(translatePrintText(printText('value.rest', { seconds: 90 }))).toBe('1:30 min');
    expect(translatePrintText(printText('value.rest', { seconds: 45 }))).toBe('45 s');
    expect(translatePrintText(printText('value.rest', { seconds: 120 }))).toBe('2 min');
    expect(translatePrintText(printText('value.effort', { effort: 3 }))).toBe('3 von 10 – locker');
    expect(
      translatePrintText(printText('value.dateRange', { from: '2026-10-05', to: '2026-11-15' })),
    ).toBe('05.10.2026 – 15.11.2026');
    expect(
      translatePrintText(printText('value.weekDates', { from: '2026-10-05', to: '2026-10-11' })),
    ).toBe('05.10.–11.10.');
    expect(
      translatePrintText(printText('value.trainingDays', { count: 3, weekdays: [1, 3, 5] })),
    ).toBe('3 pro Woche (Mo, Mi, Fr)');
    expect(
      translatePrintText(printText('week.row', { weekNo: 6, intro: false, deload: true })),
    ).toBe('Woche 6 · Erholung');
    expect(translatePrintText(printLabel('mark.equipmentSwap'))).toBe(t.plan.substituted);
  });

  it('neutraler Arzt-Hinweis (Plan §4)', () => {
    expect(translatePrintText(printLabel('notice.medical'))).toBe(
      'Bitte kläre vor Trainingsbeginn ärztlich ab, ob das Training für dich passt. Alpha5 ersetzt keine ärztliche Beratung.',
    );
    expect(translatePrintText(printLabel('doc.footer'))).toBe(
      'Alpha5 ersetzt keine ärztliche Beratung.',
    );
  });

  it('Texte nach Belastungsart (Wächter S2) und Legende ohne Ruhetag (K6)', () => {
    expect(translatePrintText(printLabel('load.bodyweight'))).toBe('Körper\u00ADgewicht');
    expect(translatePrintText(printText('session.weightHint', { hasWeight: false }))).not.toMatch(
      /Startgewicht/,
    );
    expect(
      translatePrintText(printText('cover.howTo', { logColumns: 4, hasWeight: false })),
    ).not.toMatch(/Gewicht|kg/);
    expect(
      translatePrintText(
        printText('week.legend', {
          hasRestDay: false,
          hasIntroWeek: true,
          hasDeloadWeek: false,
          hasWeight: false,
        }),
      ),
    ).toBe(t.print.legendIntroNoWeight);
  });
});

describe('Beispiele: Plan → Dokument → übersetzt → HTML', () => {
  it.each(PRINT_EXAMPLES.map((e) => [e.slug, e] as const))('%s', (_slug, example) => {
    const doc: PrintDocument = exampleDocument(example);
    const translated = translatePrintDocument(doc);
    expect(translated.title).toBe('Trainingsplan');
    const html = renderPrintHtml(translated);
    // Keine Codes übrig, kein Level, keine Gesundheitsbegriffe.
    expect(html).not.toMatch(/\b(cover|value|week|col|mark|session|notice|plan)\.[a-zA-Z]/);
    expect(html).not.toMatch(/Einsteiger|Fortgeschritten|Leistungssport/);
    expect(html).not.toMatch(/schwanger|Gesundheits-Check|Flag|Zyklus|Körpergewicht \d|Geburts/i);
    expect(html).toContain('Bitte kläre vor Trainingsbeginn ärztlich ab');
    expect(html.match(/Wochenübersicht/g)).toHaveLength(1);
    if (example.slug === 'koerpergewicht-und-ausdauer') {
      expect(html).not.toMatch(/Startgewicht|Wähle Gewichte|20 × 10/);
    }
    if (example.options?.includeName) {
      expect(html).toContain(example.options.name);
      expect(html).toContain('<title>Trainingsplan</title>');
    }
  });

  it('Mo Studio / Sa Zuhause: eigene Gewichte je Ort (20 kg im Studio, 12 kg zu Hause)', () => {
    const example = PRINT_EXAMPLES.find((e) => e.slug === 'studio-und-zuhause');
    if (!example) throw new Error('Beispiel fehlt');
    const html = renderPrintHtml(translatePrintDocument(exampleDocument(example)));
    expect(html).toContain('<dt>Tage</dt><dd>Montag</dd></div><div><dt>Ort</dt><dd>Studio</dd>');
    expect(html).toContain('<dt>Tage</dt><dd>Samstag</dd></div><div><dt>Ort</dt><dd>Zuhause</dd>');
    expect(html).toContain('20 kg');
    expect(html).toContain('12 kg');
  });
});

describe('Belastungstest (Wächter K2) – Grundlage für den A4-Test in e2e/print.spec.ts', () => {
  it('8 Übungen mit langen Namen, jede „ersetzt“, Supersätze, 600 Zeichen Aufwärmen', () => {
    for (const options of [{}, { logColumns: 8, landscape: true }]) {
      const html = renderPrintHtml(translatePrintDocument(extremeDocument(options)));
      // Exercise-Zeilen (Wochenübersicht hat andere Zeilenköpfe): jede mit „ersetzt“, 8 je Einheit.
      const swaps = html.match(/ersetzt \(Gerät fehlt\)/g) ?? [];
      const warmups = html.match(/<p>Locker einlaufen[^<]{550,}<\/p>/g) ?? [];
      expect(warmups.length).toBeGreaterThan(0);
      expect(swaps.length).toBe((warmups.length / 2) * 8);
      expect(html.match(/Supersatz A/g)).toHaveLength((warmups.length / 2) * 2);
      expect(html).toContain('langsam, kontrolliert');
      // Zu lang für eine Seite → Fortsetzungsseiten (Wächter K2).
      expect(html).toContain('(Fortsetzung)');
    }
  });
});
