import { buildWidgetSnapshot, widgetView, type WidgetView } from '@fitnessapp/core';
import { areaColors, colors } from '@fitnessapp/ui';
import { describe, expect, it } from 'vitest';

import {
  ringSvg,
  WIDGET_URI_SETTINGS,
  WIDGET_URI_TODAY,
  widgetLayout,
  widgetPalette,
  widgetSize,
} from './widget-layout';

const READY: WidgetView = {
  kind: 'ready',
  training: { kind: 'session', name: 'Ganzkörper A', done: false },
  steps: { steps: 6240, goal: 8000, fraction: 0.78, percent: 78, reached: false },
  kcal: { state: 'open', value: 1150 },
  metricsOutdated: false,
};

describe('widgetLayout', () => {
  it('Training, Schritte und kcal übrig mit Tausenderpunkt; Antippen → Heute', () => {
    const layout = widgetLayout(READY, 'small', 'light');
    expect(layout.uri).toBe(WIDGET_URI_TODAY);
    expect(layout.eyebrow).toBe('HEUTE');
    expect(layout.title).toBe('Ganzkörper A');
    // Klein: kein Hinweis-Text (Platz); mittel: „Antippen zum Starten“.
    expect(layout.subtitle).toBeNull();
    expect(widgetLayout(READY, 'medium', 'light').subtitle).toBe('Antippen zum Starten');
    expect(layout.steps).toEqual({
      value: '6.240',
      caption: 'von 8.000',
      fraction: 0.78,
      reached: false,
    });
    expect(layout.kcal).toEqual({ value: '1.150', caption: 'kcal übrig', over: false });
    expect(layout.note).toBeNull();
    expect(layout.a11y).toContain('6.240 von 8.000 Schritten');
    expect(layout.a11y).toContain('1.150 kcal übrig');
  });

  it('Ruhetag, erledigt, kein Plan', () => {
    const rest = widgetLayout({ ...READY, training: { kind: 'rest' } }, 'medium', 'dark');
    expect(rest.title).toBe('Ruhetag');
    const done = widgetLayout(
      { ...READY, training: { kind: 'session', name: 'Beine', done: true } },
      'small',
      'light',
    );
    expect(done.subtitle).toBe('Erledigt ✓');
    expect(widgetLayout({ ...READY, training: { kind: 'no_plan' } }, 'small', 'light').title).toBe(
      'Noch kein Trainingsplan',
    );
  });

  it('zu viel gegessen → „kcal zu viel“, Ziel Schritte erreicht', () => {
    const layout = widgetLayout(
      {
        ...READY,
        steps: { steps: 9000, goal: 8000, fraction: 1, percent: 113, reached: true },
        kcal: { state: 'over', value: 200 },
      },
      'small',
      'light',
    );
    expect(layout.kcal).toEqual({ value: '200', caption: 'kcal zu viel', over: true });
    expect(layout.steps?.caption).toBe('Ziel erreicht');
  });

  it('ohne Freigaben: keine Zahlen (nie Platzhalter-Zahlen)', () => {
    const layout = widgetLayout({ ...READY, steps: null, kcal: null }, 'medium', 'light');
    expect(layout.steps).toBeNull();
    expect(layout.kcal).toBeNull();
    expect(layout.a11y).not.toMatch(/kcal|Schritt/);
  });

  it('neuer Tag → Hinweis „App öffnen zum Aktualisieren“', () => {
    const layout = widgetLayout(
      { ...READY, steps: null, kcal: null, metricsOutdated: true },
      'small',
      'light',
    );
    expect(layout.note).toBe('App öffnen zum Aktualisieren');
  });

  it('aus → Hinweis zum Einschalten, Antippen → Einstellungen; zu alt → App öffnen', () => {
    const off = widgetLayout({ kind: 'off' }, 'small', 'light');
    expect(off.uri).toBe(WIDGET_URI_SETTINGS);
    expect(off.title).toBe('Widget aus');
    expect(off.steps).toBeNull();
    const refresh = widgetLayout({ kind: 'refresh' }, 'medium', 'dark');
    expect(refresh.title).toBe('App öffnen zum Aktualisieren');
    expect(refresh.uri).toBe(WIDGET_URI_TODAY);
  });

  it('Farben aus packages/ui (Bereiche Training, Ausdauer, Ernährung)', () => {
    const light = widgetPalette('light');
    expect(light.background).toBe(colors.light.surface);
    expect(light.stepsStrong).toBe(areaColors.light.ausdauer.strong);
    expect(light.kcalSurface).toBe(areaColors.light.ernaehrung.surface);
    const dark = widgetPalette('dark');
    expect(dark.background).toBe(colors.dark.surface);
    expect(dark.trainingFrom).toBe(areaColors.dark.training.strong);
    for (const value of Object.values(light)) expect(value).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('Größe nach Breite', () => {
    expect(widgetSize(150)).toBe('small');
    expect(widgetSize(249)).toBe('small');
    expect(widgetSize(250)).toBe('medium');
    expect(widgetSize(400)).toBe('medium');
  });

  it('Ende-zu-Ende: Stand → Anzeige → Aussehen', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    const snap = buildWidgetSnapshot({
      enabled: true,
      nowMs: now,
      today: '2026-10-25',
      sessions: null,
      steps: { allowed: true, today: 300, goal: 8000 },
      kcal: { showNumbers: false, consentValid: true, targetKcal: 2000, eatenKcal: 100 },
    });
    const view = widgetView({ enabled: true, snapshot: snap, nowMs: now, today: '2026-10-25' });
    const layout = widgetLayout(view, 'medium', 'light');
    expect(layout.title).toBe('Noch kein Trainingsplan');
    expect(layout.steps?.value).toBe('300');
    // „Kalorienzahlen aus“ → nirgends kcal.
    expect(layout.kcal).toBeNull();
    expect([layout.title, layout.subtitle, layout.note, layout.a11y].join(' ')).not.toContain(
      'kcal',
    );
  });
});

describe('ringSvg', () => {
  const ring = (fraction: number) =>
    ringSvg({ fraction, color: '#EA580C', track: '#FDBA74', size: 44, stroke: 6 });

  it('leer: nur die Spur', () => {
    expect(ring(0)).not.toContain('#EA580C');
    expect(ring(Number.NaN)).not.toContain('#EA580C');
  });

  it('Bogen proportional, nie über 100 %', () => {
    const r = (44 - 6) / 2;
    const c = 2 * Math.PI * r;
    expect(ring(0.5)).toContain(`stroke-dasharray="${(c / 2).toFixed(2)}`);
    expect(ring(3)).toContain(`stroke-dasharray="${c.toFixed(2)}`);
    expect(ring(0.5)).toMatch(/^<svg [^>]*viewBox="0 0 44 44"/);
  });
});
