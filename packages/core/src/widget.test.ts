import { describe, expect, it } from 'vitest';

import { STEP_GOAL, WIDGET_SNAPSHOT } from './constants';
import type { StoredSession } from './plan/view';
import {
  buildWidgetSnapshot,
  type WidgetSnapshotInput,
  widgetName,
  widgetSnapshotSchema,
  widgetView,
} from './widget';

// Nur die Felder, die die Regeln lesen.
const s = (
  id: string,
  scheduled_on: string,
  name_de: string,
  status: 'planned' | 'completed' | 'skipped' = 'planned',
): StoredSession => ({ id, scheduled_on, status, name_de }) as unknown as StoredSession;

// Sonntag, 25.10.2026, 12:00 Uhr UTC.
const TODAY = '2026-10-25';
const NOW = Date.parse('2026-10-25T12:00:00Z');
const HOUR = 3_600_000;

const base = (over: Partial<WidgetSnapshotInput> = {}): WidgetSnapshotInput => ({
  enabled: true,
  nowMs: NOW,
  today: TODAY,
  sessions: [s('a', TODAY, 'Ganzkörper A'), s('b', '2026-10-27', 'Lockerer Dauerlauf')],
  steps: { allowed: true, today: 5234, goal: 8000 },
  kcal: { showNumbers: true, consentValid: true, targetKcal: 2200, eatenKcal: 1400 },
  ...over,
});

describe('buildWidgetSnapshot', () => {
  it('Widget aus (Standard) → kein Stand', () => {
    expect(buildWidgetSnapshot(base({ enabled: false }))).toBeNull();
  });

  it('enthält nur Training, Schritte mit Ziel und kcal übrig', () => {
    const snap = buildWidgetSnapshot(base());
    expect(snap).not.toBeNull();
    expect(Object.keys(snap!).sort()).toEqual(['date', 'days', 'kcal', 'savedAt', 'steps', 'v']);
    expect(snap!.days).toHaveLength(WIDGET_SNAPSHOT.days);
    expect(snap!.days[0]).toEqual({
      date: TODAY,
      training: { kind: 'session', name: 'Ganzkörper A', done: false },
    });
    expect(snap!.days[1]).toEqual({ date: '2026-10-26', training: { kind: 'rest' } });
    expect(snap!.days[2]?.training).toEqual({
      kind: 'session',
      name: 'Lockerer Dauerlauf',
      done: false,
    });
    expect(snap!.days[6]?.date).toBe('2026-10-31');
    expect(snap!.steps).toEqual({ steps: 5234, goal: 8000 });
    expect(snap!.kcal).toEqual({ state: 'open', value: 800 });
    // Keine Zwischenwerte (Ziel, Gegessenes) im Stand.
    expect(JSON.stringify(snap)).not.toContain('2200');
    expect(JSON.stringify(snap)).not.toContain('1400');
    expect(widgetSnapshotSchema.safeParse(snap).success).toBe(true);
  });

  it('kein aktiver Plan → no_plan an allen Tagen', () => {
    const snap = buildWidgetSnapshot(base({ sessions: null }))!;
    expect(snap.days.every((d) => d.training.kind === 'no_plan')).toBe(true);
  });

  it('erledigte Einheit heute → done', () => {
    const snap = buildWidgetSnapshot(
      base({ sessions: [s('a', TODAY, 'Oberkörper', 'completed')] }),
    )!;
    expect(snap.days[0]?.training).toEqual({ kind: 'session', name: 'Oberkörper', done: true });
  });

  it('gestrichene Einheit → Ruhetag', () => {
    const snap = buildWidgetSnapshot(base({ sessions: [s('a', TODAY, 'Beine', 'skipped')] }))!;
    expect(snap.days[0]?.training).toEqual({ kind: 'rest' });
  });

  it('angezeigte (sichere) Namen gehen vor', () => {
    const snap = buildWidgetSnapshot(
      base({
        sessions: [s('a', TODAY, 'Intervalle 6 × 400 m')],
        displayNames: new Map([['a', 'Lockerer Dauerlauf']]),
      }),
    )!;
    expect(snap.days[0]?.training).toMatchObject({ name: 'Lockerer Dauerlauf' });
  });

  it('1 vs. 7 Trainingstage', () => {
    const one = buildWidgetSnapshot(base({ sessions: [s('a', TODAY, 'A')] }))!;
    expect(one.days.filter((d) => d.training.kind === 'session')).toHaveLength(1);
    const seven = buildWidgetSnapshot(
      base({
        sessions: Array.from({ length: 7 }, (_, i) =>
          s(`s${i}`, `2026-10-${String(25 + i).padStart(2, '0')}`, `Tag ${i + 1}`),
        ),
      }),
    )!;
    expect(seven.days.every((d) => d.training.kind === 'session')).toBe(true);
  });

  describe('Schritte nur wie die Kachel', () => {
    it('ohne Einwilligung/Uhr → keine Schritte', () => {
      expect(
        buildWidgetSnapshot(base({ steps: { allowed: false, today: 9000, goal: 8000 } }))!.steps,
      ).toBeNull();
    });
    it('heute noch kein Wert → keine Schritte', () => {
      expect(
        buildWidgetSnapshot(base({ steps: { allowed: true, today: null, goal: 8000 } }))!.steps,
      ).toBeNull();
    });
    it('0 Schritte bleiben 0 (echter Wert)', () => {
      expect(
        buildWidgetSnapshot(base({ steps: { allowed: true, today: 0, goal: 8000 } }))!.steps,
      ).toEqual({ steps: 0, goal: 8000 });
    });
    it('ungültiges Ziel → Standardziel; sehr viele Schritte gekappt', () => {
      const snap = buildWidgetSnapshot(
        base({ steps: { allowed: true, today: 10_000_000, goal: -5 } }),
      )!;
      expect(snap.steps?.goal).toBe(STEP_GOAL.default);
      expect(snap.steps!.steps).toBeLessThan(10_000_000);
    });
  });

  describe('kcal nur wie die Kachel', () => {
    const kcal = (k: Partial<WidgetSnapshotInput['kcal']>) =>
      buildWidgetSnapshot(
        base({
          kcal: {
            showNumbers: true,
            consentValid: true,
            targetKcal: 2000,
            eatenKcal: 500,
            ...k,
          },
        }),
      )!.kcal;

    it('„Kalorienzahlen aus“ bzw. Schwangerschaft/Stillzeit → keine kcal', () => {
      expect(kcal({ showNumbers: false })).toBeNull();
    });
    it('ohne Einwilligung Gesundheitsdaten → keine kcal', () => {
      expect(kcal({ consentValid: false })).toBeNull();
    });
    it('ohne Ziel oder ohne Tagebuch-Zahl → keine kcal (nie erfunden)', () => {
      expect(kcal({ targetKcal: null })).toBeNull();
      expect(kcal({ eatenKcal: null })).toBeNull();
      expect(kcal({ targetKcal: 0 })).toBeNull();
    });
    it('übrig, erreicht, zu viel', () => {
      expect(kcal({ eatenKcal: 0 })).toEqual({ state: 'open', value: 2000 });
      expect(kcal({ eatenKcal: 2000 })).toEqual({ state: 'reached', value: 0 });
      expect(kcal({ eatenKcal: 2350 })).toEqual({ state: 'over', value: 350 });
    });
  });

  it('ungültiges Datum wird abgelehnt', () => {
    expect(() => buildWidgetSnapshot(base({ today: '25.10.2026' }))).toThrow();
  });
});

describe('widgetName', () => {
  it('kürzt lange Namen und vereinheitlicht Leerraum', () => {
    expect(widgetName('  Ganzkörper   A ')).toBe('Ganzkörper A');
    const long = widgetName('x'.repeat(200));
    expect(long).toHaveLength(WIDGET_SNAPSHOT.maxNameLength);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('widgetView', () => {
  const snap = buildWidgetSnapshot(base());
  const view = (over: Partial<Parameters<typeof widgetView>[0]> = {}) =>
    widgetView({ enabled: true, snapshot: snap, nowMs: NOW, today: TODAY, ...over });

  it('Schalter aus → off (auch mit altem Stand)', () => {
    expect(view({ enabled: false })).toEqual({ kind: 'off' });
  });

  it('kein oder kaputter Stand → refresh', () => {
    expect(view({ snapshot: null })).toEqual({ kind: 'refresh' });
    expect(view({ snapshot: { v: 99 } })).toEqual({ kind: 'refresh' });
    expect(view({ snapshot: 'Unsinn' })).toEqual({ kind: 'refresh' });
  });

  it('heute: Training, Schritte-Ring, kcal übrig', () => {
    expect(view()).toEqual({
      kind: 'ready',
      training: { kind: 'session', name: 'Ganzkörper A', done: false },
      steps: { steps: 5234, goal: 8000, fraction: 5234 / 8000, percent: 65, reached: false },
      kcal: { state: 'open', value: 800 },
      metricsOutdated: false,
    });
  });

  it('Ziel erreicht → Ring voll', () => {
    const reached = buildWidgetSnapshot(
      base({ steps: { allowed: true, today: 12_000, goal: 8000 } }),
    );
    const v = view({ snapshot: reached });
    expect(v.kind === 'ready' && v.steps).toMatchObject({ fraction: 1, reached: true });
  });

  it('genau 24 h alt → noch gültig; älter → refresh', () => {
    const later = '2026-10-26';
    expect(view({ nowMs: NOW + 24 * HOUR, today: later }).kind).toBe('ready');
    expect(view({ nowMs: NOW + 24 * HOUR + 1, today: later })).toEqual({ kind: 'refresh' });
  });

  it('Stand aus der Zukunft (Uhr verstellt) → refresh', () => {
    expect(view({ nowMs: NOW - 11 * 60_000 })).toEqual({ kind: 'refresh' });
    expect(view({ nowMs: NOW - 5 * 60_000 }).kind).toBe('ready');
  });

  it('nach Mitternacht: Training des neuen Tages, keine Zahlen von gestern', () => {
    const v = view({ nowMs: NOW + 13 * HOUR, today: '2026-10-26' });
    expect(v).toEqual({
      kind: 'ready',
      training: { kind: 'rest' },
      steps: null,
      kcal: null,
      metricsOutdated: true,
    });
    const v2 = view({ nowMs: NOW + 20 * HOUR, today: '2026-10-27' });
    expect(v2.kind === 'ready' && v2.training).toEqual({
      kind: 'session',
      name: 'Lockerer Dauerlauf',
      done: false,
    });
  });

  it('neuer Tag ohne Zahlen im Stand → kein Hinweis', () => {
    const noMetrics = buildWidgetSnapshot(
      base({
        steps: { allowed: false, today: null, goal: 8000 },
        kcal: { showNumbers: false, consentValid: true, targetKcal: 2000, eatenKcal: 100 },
      }),
    );
    const v = view({ snapshot: noMetrics, nowMs: NOW + 13 * HOUR, today: '2026-10-26' });
    expect(v.kind === 'ready' && v.metricsOutdated).toBe(false);
  });

  it('Tag außerhalb des Stands → refresh', () => {
    expect(view({ today: '2026-10-24' })).toEqual({ kind: 'refresh' });
  });

  it('Stand mit unerwarteten Werten → refresh', () => {
    expect(view({ snapshot: { ...snap, steps: { steps: -1, goal: 8000 } } })).toEqual({
      kind: 'refresh',
    });
    expect(
      view({
        snapshot: {
          ...snap,
          days: [{ date: TODAY, training: { kind: 'session', name: '', done: false } }],
        },
      }),
    ).toEqual({ kind: 'refresh' });
  });
});
