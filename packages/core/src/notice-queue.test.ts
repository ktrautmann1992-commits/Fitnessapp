/**
 * Hinweis-Zeile (docs/PLAN-DASHBOARD.md 11.3): Vorrang sperrend → handeln → info → erfolg, sperrende nie zugeklappt,
 * höchstens ein übriger Hinweis vollständig, Rest hinter dem Zähler; leere Eingabe, Doppel, stabile Reihenfolge.
 */
import { describe, expect, it } from 'vitest';

import { noticeQueue, type QueuedNotice } from './notice-queue';

const n = (id: string, level: QueuedNotice['level']): QueuedNotice => ({ id, level });
const ids = (list: readonly QueuedNotice[]) => list.map((x) => x.id);

describe('noticeQueue', () => {
  it('nichts da → leer', () => {
    const empty = { blocking: [], lead: null, rest: [], success: [] };
    expect(noticeQueue([])).toEqual(empty);
    expect(noticeQueue([null, undefined, false])).toEqual(empty);
  });

  it('ein Hinweis → vollständig, kein Zähler', () => {
    const q = noticeQueue([n('test', 'info')]);
    expect(q.lead?.id).toBe('test');
    expect(q.rest).toEqual([]);
  });

  it('Vorrang: handeln vor info; gleiche Stufe in Eingabe-Reihenfolge; Erfolg immer sichtbar', () => {
    const q = noticeQueue([
      n('saved', 'success'),
      n('test', 'info'),
      n('draft', 'action'),
      n('measure', 'info'),
      n('offline', 'action'),
    ]);
    expect(q.blocking).toEqual([]);
    expect(q.lead?.id).toBe('draft');
    expect(ids(q.rest)).toEqual(['offline', 'test', 'measure']);
    expect(ids(q.success)).toEqual(['saved']);
  });

  it('sperrende stehen immer oben, alle übrigen hinter dem Zähler', () => {
    const q = noticeQueue([
      n('test', 'info'),
      n('reconsent', 'blocking'),
      n('draft', 'action'),
      n('ended', 'blocking'),
    ]);
    expect(ids(q.blocking)).toEqual(['reconsent', 'ended']);
    expect(q.lead).toBeNull();
    expect(ids(q.rest)).toEqual(['draft', 'test']);
  });

  it('sperrend + genau ein übriger → der übrige bleibt sichtbar (kein „+1“ für einen)', () => {
    const q = noticeQueue([n('test', 'info'), n('foreign', 'blocking')]);
    expect(ids(q.blocking)).toEqual(['foreign']);
    expect(q.lead?.id).toBe('test');
    expect(q.rest).toEqual([]);
  });

  it('nur Erfolg → kein lead, Erfolg sichtbar; mit sperrenden auch', () => {
    const q = noticeQueue([n('saved', 'success')]);
    expect(q.lead).toBeNull();
    expect(ids(q.success)).toEqual(['saved']);
    const b = noticeQueue([
      n('saved', 'success'),
      n('foreign', 'blocking'),
      n('a', 'info'),
      n('b', 'info'),
    ]);
    expect(ids(b.success)).toEqual(['saved']);
    expect(ids(b.rest)).toEqual(['a', 'b']);
  });

  it('nur sperrende → kein lead, kein Zähler', () => {
    const q = noticeQueue([n('a', 'blocking'), n('b', 'blocking')]);
    expect(ids(q.blocking)).toEqual(['a', 'b']);
    expect(q.lead).toBeNull();
    expect(q.rest).toEqual([]);
  });

  it('doppelte IDs zählen einmal (der erste gewinnt)', () => {
    const q = noticeQueue([n('x', 'info'), n('x', 'blocking'), n('y', 'info')]);
    expect(q.blocking).toEqual([]);
    expect(q.lead).toEqual(n('x', 'info'));
    expect(ids(q.rest)).toEqual(['y']);
  });

  it('viele Hinweise (über 20 wie früher auf „Training“): genau einer oben', () => {
    const many = Array.from({ length: 22 }, (_, i) => n(`h${i}`, i % 2 ? 'info' : 'action'));
    const q = noticeQueue(many);
    expect(q.lead?.id).toBe('h0');
    expect(q.rest).toHaveLength(21);
  });

  it('zusätzliche Felder bleiben erhalten (generisch)', () => {
    const q = noticeQueue([{ id: 'a', level: 'info' as const, text: 'Hallo' }]);
    expect(q.lead?.text).toBe('Hallo');
  });
});
