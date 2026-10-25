/**
 * Kraft-Entwicklung (Gründer-Freigabe 25.10.2026): Diagramm, Mini-Kurve, Umschalter und Kachel – Bilder mit Ansage in
 * Worten, Werte auch als Text, Leer-Hinweise, keine Wörter wie „Rekord“ oder „Bestleistung“.
 */
import {
  addDays,
  type StrengthLogEntry,
  strengthOverview,
  strengthSeries,
  strengthSessions,
} from '@fitnessapp/core';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { byRole, cleanup, render } from '@/test/render';

import {
  StrengthChart,
  StrengthProgressSection,
  StrengthSparkline,
  StrengthTileRows,
} from './strength-chart';

const TODAY = '2026-10-25';

afterEach(cleanup);

function entry(
  performedOn: string,
  kg: number | null,
  reps = 8,
  extra: Partial<StrengthLogEntry> = {},
): StrengthLogEntry {
  const set = { reps, weightKg: kg, durationS: null, rpe: null, done: true };
  return {
    exerciseId: 'kniebeuge',
    performedOn,
    loggedAt: `${performedOn}T18:00:00.000Z`,
    status: 'done',
    loadType: kg === null ? 'bodyweight' : 'weight',
    isDeload: false,
    sets: [set, set, set],
    ...extra,
  };
}

/** 10 Wochen Kniebeuge (+2,5 kg je Woche), Woche 6 Erholungswoche (vor 4 Wochen → Bezug ist die Woche davor). */
const SQUATS = Array.from({ length: 10 }, (_, i) =>
  entry(addDays(TODAY, -7 * (9 - i)), i === 5 ? 50 : 60 + 2.5 * i, 8, { isDeload: i === 5 }),
);

const click = (view: HTMLElement, testID: string) =>
  act(() => view.querySelector<HTMLElement>(`[data-testid="${testID}"]`)?.click());

describe('StrengthChart', () => {
  it('Bild mit Ansage (Anzahl, Zeitraum, erster und letzter Wert), ein Punkt je Training', () => {
    const sessions = strengthSessions('kniebeuge', SQUATS);
    const series = strengthSeries(sessions, 'weight', 'all', TODAY);
    const view = render(<StrengthChart series={series} today={TODAY} range="all" />);
    const [img] = byRole(view, 'img');
    expect(img?.getAttribute('aria-label')).toBe(
      'Gewicht: 10 Trainings vom 23.08.2026 bis 25.10.2026, von 60 Kilogramm auf 82,5 Kilogramm.',
    );
    expect(view.querySelectorAll('circle')).toHaveLength(10);
    expect(view.textContent).toContain('82,5 kg');
    expect(view.textContent).not.toMatch(/Rekord|Bestleistung|1RM/);
  });

  it('ohne Punkte: nichts gezeichnet', () => {
    const view = render(
      <StrengthChart
        series={{ metric: 'weight', points: [], min: null, max: null }}
        today={TODAY}
        range="4w"
      />,
    );
    expect(view.querySelector('svg')).toBeNull();
  });
});

describe('StrengthSparkline', () => {
  it('Mini-Kurve als Bild mit Ansage; ein Wert = nur ein Punkt', () => {
    const view = render(
      <StrengthSparkline values={[0, 0.5, 1]} accessibilityLabel="Kniebeuge: von 60 auf 70 kg." />,
    );
    expect(byRole(view, 'img')[0]?.getAttribute('aria-label')).toBe('Kniebeuge: von 60 auf 70 kg.');
    expect(view.querySelectorAll('path')).toHaveLength(1);
    const one = render(<StrengthSparkline values={[0.5]} accessibilityLabel="x" />);
    expect(one.querySelectorAll('path')).toHaveLength(0);
    expect(one.querySelectorAll('circle')).toHaveLength(1);
  });
});

describe('StrengthProgressSection', () => {
  it('Umschalter Kennzahl und Zeitraum (Radio-Gruppen), Vergleich in Worten, Wechsel auf Volumen und Zeitraum', () => {
    const sessions = strengthSessions('kniebeuge', SQUATS);
    const view = render(<StrengthProgressSection sessions={sessions} today={TODAY} />);
    expect(byRole(view, 'radiogroup')).toHaveLength(2);
    // Ausgewählt zusätzlich mit Häkchen (nie nur Farbe).
    expect(byRole(view, 'radio').map((r) => r.textContent?.replace('✓ ', ''))).toEqual([
      'Gewicht',
      'Volumen',
      'Wiederholungen',
      '4 W',
      '3 M',
      'Alles',
    ]);
    expect(view.querySelector('[data-testid="strength-compare"]')?.textContent).toBe(
      '+12,5 kg gegenüber vor 5 Wochen',
    );
    click(view, 'strength-metric-volume');
    expect(view.querySelector('[data-testid="strength-compare"]')?.textContent).toBe(
      '+300 kg gegenüber vor 5 Wochen',
    );
    click(view, 'strength-range-all');
    expect(view.querySelectorAll('circle')).toHaveLength(10);
    expect(view.textContent).toContain('Hohler Punkt = Erholungswoche');
    click(view, 'strength-range-4w');
    expect(view.querySelectorAll('circle')).toHaveLength(4);
    expect(view.textContent).not.toContain('Hohler Punkt');
  });

  it('eigenes Körpergewicht: nur „Wiederholungen“, kein Umschalter für die Kennzahl', () => {
    const sessions = strengthSessions('kniebeuge', [
      entry('2026-10-01', null, 10),
      entry('2026-10-22', null, 12),
    ]);
    const view = render(<StrengthProgressSection sessions={sessions} today={TODAY} />);
    expect(view.querySelector('[data-testid="strength-metrics"]')).toBeNull();
    expect(view.querySelector('[data-testid="strength-last"]')?.textContent).toContain('36 Wdh.');
    expect(view.querySelector('[data-testid="strength-compare"]')?.textContent).toBe(
      '+6 Wdh. gegenüber vor 3 Wochen',
    );
  });

  it('leer bzw. nichts im Zeitraum: verständlicher Hinweis', () => {
    const empty = render(<StrengthProgressSection sessions={[]} today={TODAY} />);
    expect(empty.querySelector('[data-testid="strength-empty"]')).not.toBeNull();
    const old = strengthSessions('kniebeuge', [entry('2026-01-05', 40), entry('2026-01-12', 42.5)]);
    const view = render(<StrengthProgressSection sessions={old} today={TODAY} />);
    expect(view.querySelector('[data-testid="strength-empty-range"]')).not.toBeNull();
  });
});

describe('StrengthTileRows', () => {
  it('je Übung ein Knopf mit Name, Wert, Vergleich und Mini-Kurve; leer ein Hinweis', () => {
    const items = strengthOverview(SQUATS, TODAY).map((item) => ({ ...item, name: 'Kniebeuge' }));
    const onOpen = vi.fn();
    const view = render(<StrengthTileRows items={items} onOpen={onOpen} />);
    const [button] = byRole(view, 'button');
    expect(button?.getAttribute('aria-label')).toBe(
      'Kraft-Entwicklung: Kniebeuge öffnen. 82,5 Kilogramm. 12,5 Kilogramm mehr als vor 5 Wochen',
    );
    act(() => button?.click());
    expect(onOpen).toHaveBeenCalledWith('kniebeuge');
    const empty = render(<StrengthTileRows items={[]} onOpen={onOpen} />);
    expect(empty.querySelector('[data-testid="strength-tile-empty"]')?.textContent).toContain(
      'zweimal',
    );
  });
});
