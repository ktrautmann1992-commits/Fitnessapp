import { describe, expect, it } from 'vitest';

import {
  WEB_DRAG_IDLE,
  webDragStep,
  type WebDragEffect,
  type WebDragEvent,
  type WebDragState,
} from './web-drag';

const options = { longPressMs: 400, tolerancePx: 10 };

/** Kleiner Treiber: Ereignisse nacheinander einspeisen, Wirkungen sammeln, Timer wie die DOM-Schicht merken. */
function driver() {
  let state: WebDragState = WEB_DRAG_IDLE;
  let timer: number | null = null;
  const log: WebDragEffect[] = [];
  const send = (event: WebDragEvent) => {
    const step = webDragStep(state, event, options);
    state = step.state;
    for (const effect of step.effects) {
      if (effect.kind === 'startTimer') timer = effect.timer;
      if (effect.kind === 'clearTimer') timer = null;
      log.push(effect);
    }
    return step.effects.map((effect) => effect.kind);
  };
  return {
    send,
    down: (pointerId = 1, y = 100, extra: Partial<Extract<WebDragEvent, { type: 'down' }>> = {}) =>
      send({ type: 'down', pointerId, isPrimary: true, button: 0, x: 50, y, ...extra }),
    /** Timer läuft ab (nur, wenn einer läuft – wie setTimeout nach clearTimeout nie feuert). */
    elapse: () => {
      if (timer === null) return [];
      const fired = timer;
      timer = null;
      return send({ type: 'timer', timer: fired });
    },
    move: (y: number, pointerId = 1, x = 50) => send({ type: 'move', pointerId, x, y }),
    up: (y: number, pointerId = 1) => send({ type: 'up', pointerId, y }),
    get state() {
      return state;
    },
    get timer() {
      return timer;
    },
    log,
  };
}

/** Nach jedem Pfad gilt: Ruhe, kein Timer, Fang freigegeben (sofern genommen), höchstens ein `end` je `start`. */
function expectClean(d: ReturnType<typeof driver>) {
  expect(d.state).toEqual(WEB_DRAG_IDLE);
  expect(d.timer).toBeNull();
  const count = (kind: WebDragEffect['kind']) => d.log.filter((e) => e.kind === kind).length;
  expect(count('end')).toBe(count('start'));
  expect(count('release')).toBeLessThanOrEqual(count('capture'));
}

describe('webDragStep', () => {
  it('langer Druck startet, Bewegung folgt dem Zeiger, Loslassen legt ab und beendet', () => {
    const d = driver();
    expect(d.down(1, 100)).toEqual(['startTimer']);
    expect(d.state.phase).toBe('pressing');
    expect(d.elapse()).toEqual(['capture', 'start']);
    expect(d.state.phase).toBe('dragging');
    d.move(160);
    expect(d.log.at(-1)).toEqual({ kind: 'move', translationY: 60, absoluteY: 160 });
    d.move(40);
    expect(d.log.at(-1)).toEqual({ kind: 'move', translationY: -60, absoluteY: 40 });
    expect(d.up(40)).toEqual(['drop', 'release', 'end']);
    expect(d.log.find((e) => e.kind === 'drop')).toEqual({ kind: 'drop', absoluteY: 40 });
    expectClean(d);
  });

  it('kurzes Tippen startet nicht (kein start, kein end, Timer gelöscht)', () => {
    const d = driver();
    d.down();
    expect(d.up(100)).toEqual(['clearTimer']);
    expect(d.elapse()).toEqual([]);
    expect(d.log.some((e) => e.kind === 'start')).toBe(false);
    expectClean(d);
  });

  it('Bewegung innerhalb der Toleranz hält den Druck; die Karte startet an der Zeigerstelle', () => {
    const d = driver();
    d.down(1, 100);
    d.move(106, 1, 53);
    expect(d.state.phase).toBe('pressing');
    expect(d.elapse()).toEqual(['capture', 'start', 'move']);
    expect(d.log.at(-1)).toEqual({ kind: 'move', translationY: 6, absoluteY: 106 });
  });

  it('Bewegung über die Toleranz vor Ablauf bricht ab (Scrollen/Wischen geht vor)', () => {
    const d = driver();
    d.down(1, 100);
    expect(d.move(111)).toEqual(['clearTimer']);
    expect(d.elapse()).toEqual([]);
    expect(d.up(111)).toEqual([]);
    expectClean(d);
    // Auch seitlich.
    d.down(1, 100);
    expect(d.move(100, 1, 70)).toEqual(['clearTimer']);
    expectClean(d);
  });

  it('nach einem abgelehnten Ablegen startet der nächste Druck sofort wieder (mehrfach hintereinander)', () => {
    const d = driver();
    for (let round = 0; round < 5; round += 1) {
      d.down(1, 100);
      expect(d.elapse()).toEqual(['capture', 'start']);
      d.move(220);
      // Ob abgelehnt oder verschoben, entscheidet der Bildschirm – für den Griff ist beides dasselbe Ende.
      expect(d.up(220)).toEqual(['drop', 'release', 'end']);
      // Wie Chrome: Freigabe des Fangs NACH pointerup – in Ruhe ohne Wirkung.
      expect(d.send({ type: 'lostcapture', pointerId: 1, stillCaptured: false })).toEqual([]);
      expectClean(d);
    }
  });

  it('verspätetes lostpointercapture beim nächsten Druck bricht diesen NICHT ab', () => {
    const d = driver();
    d.down();
    d.elapse();
    d.up(200);
    // Nächster Druck, dann kommt die alte Meldung erst an (CI-Nachstellung in calendar.spec.ts).
    d.down();
    expect(d.send({ type: 'lostcapture', pointerId: 1, stillCaptured: false })).toEqual([]);
    expect(d.state.phase).toBe('pressing');
    expect(d.elapse()).toEqual(['capture', 'start']);
    // Und während des neuen Ziehens (Fang wieder genommen) ist eine alte Meldung ebenfalls ohne Wirkung.
    expect(d.send({ type: 'lostcapture', pointerId: 1, stillCaptured: true })).toEqual([]);
    expect(d.state.phase).toBe('dragging');
    expect(d.up(300)).toEqual(['drop', 'release', 'end']);
    expectClean(d);
  });

  it('lostpointercapture VOR pointerup: Ziehen bricht ohne Ablegen ab, das spätere pointerup ist wirkungslos', () => {
    const d = driver();
    d.down();
    d.elapse();
    d.move(250);
    expect(d.send({ type: 'lostcapture', pointerId: 1, stillCaptured: false })).toEqual(['end']);
    expect(d.up(250)).toEqual([]);
    expect(d.log.some((e) => e.kind === 'drop')).toBe(false);
    expectClean(d);
    // Nächster Druck startet normal.
    d.down();
    expect(d.elapse()).toEqual(['capture', 'start']);
  });

  it('pointercancel beim Halten und beim Ziehen setzt alles zurück', () => {
    const d = driver();
    d.down();
    expect(d.send({ type: 'cancel', pointerId: 1 })).toEqual(['clearTimer']);
    expectClean(d);
    d.down();
    d.elapse();
    d.move(180);
    expect(d.send({ type: 'cancel', pointerId: 1 })).toEqual(['release', 'end']);
    expect(d.log.some((e) => e.kind === 'drop')).toBe(false);
    expectClean(d);
    d.down();
    expect(d.elapse()).toEqual(['capture', 'start']);
  });

  it('Fenster ohne Fokus / Griff gesperrt (abort) bricht ab; in Ruhe ohne Wirkung', () => {
    const d = driver();
    expect(d.send({ type: 'abort' })).toEqual([]);
    d.down();
    expect(d.send({ type: 'abort' })).toEqual(['clearTimer']);
    d.down();
    d.elapse();
    expect(d.send({ type: 'abort' })).toEqual(['release', 'end']);
    expectClean(d);
  });

  it('zwei Zeiger: der zweite Finger wird ignoriert, Ereignisse anderer Zeiger auch', () => {
    const d = driver();
    d.down(7, 100);
    // Zweiter Finger (nicht primär) – kein Neustart, kein Abbruch.
    expect(d.down(8, 300, { isPrimary: false })).toEqual([]);
    expect(d.move(400, 8)).toEqual([]);
    expect(d.up(400, 8)).toEqual([]);
    expect(d.send({ type: 'cancel', pointerId: 8 })).toEqual([]);
    expect(d.state.phase).toBe('pressing');
    expect(d.elapse()).toEqual(['capture', 'start']);
    expect(d.down(8, 300, { isPrimary: false })).toEqual([]);
    expect(d.move(400, 8)).toEqual([]);
    expect(d.send({ type: 'lostcapture', pointerId: 8, stillCaptured: false })).toEqual([]);
    d.move(150, 7);
    expect(d.up(150, 7)).toEqual(['drop', 'release', 'end']);
    expect(d.log.find((e) => e.kind === 'drop')).toEqual({ kind: 'drop', absoluteY: 150 });
    expectClean(d);
  });

  it('rechte/mittlere Maustaste startet nicht', () => {
    const d = driver();
    expect(d.down(1, 100, { button: 2 })).toEqual([]);
    expect(d.down(1, 100, { button: 1 })).toEqual([]);
    expectClean(d);
  });

  it('verlorenes pointerup: der nächste primäre Druck beendet das alte Ziehen sauber und startet frisch', () => {
    const d = driver();
    d.down(3);
    d.elapse();
    d.move(200, 3);
    expect(d.down(4, 120)).toEqual(['release', 'end', 'startTimer']);
    expect(d.state).toMatchObject({ phase: 'pressing', pointerId: 4, startY: 120 });
    expect(d.log.some((e) => e.kind === 'drop')).toBe(false);
    // Auch ein hängender Halte-Druck wird ersetzt; der alte Timer feuert nicht mehr in den neuen Druck.
    const stale = d.state.phase === 'pressing' ? d.state.timer : -1;
    d.down(5, 130);
    expect(webDragStep(d.state, { type: 'timer', timer: stale }, options).effects).toEqual([]);
    expect(d.elapse()).toEqual(['capture', 'start']);
    expect(d.up(130, 5)).toEqual(['drop', 'release', 'end']);
    expectClean(d);
  });

  it('veralteter Timer in Ruhe oder beim Ziehen ist wirkungslos', () => {
    const d = driver();
    expect(d.send({ type: 'timer', timer: 999 })).toEqual([]);
    d.down();
    d.elapse();
    expect(d.send({ type: 'timer', timer: 999 })).toEqual([]);
    expect(d.state.phase).toBe('dragging');
  });
});
