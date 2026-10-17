import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { encodePolyline } from './polyline';
import { trackedRouteSchema } from './schema';
import { offset, START } from './test-helpers';

/**
 * Datenschutz (docs/PLAN-PHASE-10.md 13): Standortdaten nie in Logs, an Analytics oder nach außen. Der Strecken-Code in
 * packages/core ist rein rechnend – kein console, kein Netzwerk, kein Speicher – und Fehler der Eingabe-Prüfung
 * enthalten keine Koordinaten.
 */
describe('Strecken: keine Koordinaten in Logs, Netz oder Fehlermeldungen', () => {
  const dir = new URL('./', import.meta.url);
  const sources = readdirSync(dir).filter(
    (name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'test-helpers.ts',
  );

  it.each(sources)('%s: kein console, fetch, XMLHttpRequest, localStorage, sendBeacon', (name) => {
    const code = readFileSync(new URL(name, dir), 'utf8');
    expect(code).not.toMatch(/\bconsole\.|\bfetch\(|XMLHttpRequest|localStorage|sendBeacon/);
  });

  it('Fehler der Eingabe-Prüfung enthalten weder Polyline noch Koordinaten', () => {
    const points = [offset(START, 123.4, 0), offset(START, 0, 567.8), offset(START, 999, 999)];
    const polyline = encodePolyline(points);
    const result = trackedRouteSchema.safeParse({
      id: 'kein-uuid',
      name: '',
      sport: 'run',
      started_at: 'gestern',
      duration_s: 10,
      moving_s: 20,
      distance_m: 99_999,
      elevation_gain_m: null,
      // gültige Zeichen, aber nur 1 Punkt nach dem Abschneiden
      polyline: polyline.slice(0, 9),
      km_splits: [1],
      difficulty: null,
      is_favorite: false,
      base_route_id: null,
      note: null,
      session_log_id: null,
      source: 'recorded',
    });
    expect(result.success).toBe(false);
    const text = JSON.stringify(result.error?.issues);
    expect(text).not.toContain(polyline.slice(0, 9));
    for (const p of points) {
      expect(text).not.toContain(p.lat.toFixed(3));
      expect(text).not.toContain(p.lng.toFixed(3));
    }
  });
});
