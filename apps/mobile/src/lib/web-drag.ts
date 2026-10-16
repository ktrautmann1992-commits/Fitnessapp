/**
 * Ziehen am Griff ⠿ im BROWSER (Trainingskalender, Etappe A1a) – reiner Zustandsautomat ohne DOM und ohne React,
 * getestet in web-drag.test.ts. Keine Fachlogik (Erlaubt/Grund rechnet packages/core), nur Bedienung: Wann beginnt
 * ein Ziehen, wohin bewegt es sich, wann ist es vorbei?
 *
 * Hintergrund (docs/PLAN-AUSWERTUNG.md, Umsetzungsstand A1a Punkt 14): Mit react-native-gesture-handler (Web) startete
 * in der CI (Chrome 153) nach einem ABGELEHNTEN Ablegen das nächste Ziehen nicht mehr – auch nicht mit neu
 * aufgebauter Geste, nur mit einer neuen Seite. Der hängende Zustand lag also global in der Bibliothek, außerhalb
 * unserer Kontrolle. Im Browser zieht die App deshalb mit dieser eigenen, kleinen Zeiger-Logik; nativ bleibt der
 * Pan mit langem Druck von react-native-gesture-handler.
 *
 * Regeln:
 * - Nur die primäre Taste bzw. der erste Finger startet; weitere Zeiger werden ignoriert.
 * - Ein neuer primärer Druck beginnt IMMER frisch – egal, was vorher hängen geblieben ist (verlorenes pointerup,
 *   verspätetes lostpointercapture). Ein laufendes Ziehen wird dabei sauber beendet (ohne Ablegen).
 * - Erst nach `longPressMs` ruhigem Halten beginnt das Ziehen; Bewegung über `tolerancePx` vorher bricht ab.
 * - Jeder Weg aus einem Druck (Tippen, zu früh bewegt, abgelegt, pointercancel, Zeiger-Fang verloren, Fenster ohne
 *   Fokus, Griff gesperrt/entfernt) endet in `idle` mit Timer gelöscht, Fang freigegeben und – falls gezogen wurde –
 *   genau einem `end`.
 */

export interface WebDragOptions {
  /** Langer Druck bis zum Aufnehmen (DRAG_LONG_PRESS_MS). */
  longPressMs: number;
  /** Erlaubte Bewegung während des langen Drucks (Pixel), darüber: abbrechen (Scrollen/Wischen geht vor). */
  tolerancePx: number;
}

export type WebDragState =
  | { phase: 'idle' }
  | {
      phase: 'pressing';
      pointerId: number;
      startX: number;
      startY: number;
      lastY: number;
      timer: number;
    }
  | { phase: 'dragging'; pointerId: number; startY: number; captured: boolean };

export type WebDragEvent =
  | {
      type: 'down';
      pointerId: number;
      isPrimary: boolean;
      /** 0 = linke Maustaste bzw. Finger/Stift. */
      button: number;
      x: number;
      y: number;
    }
  | { type: 'move'; pointerId: number; x: number; y: number }
  /** Der Timer des langen Drucks ist abgelaufen (`timer` = Kennung aus `startTimer`). */
  | { type: 'timer'; timer: number }
  | { type: 'up'; pointerId: number; y: number }
  | { type: 'cancel'; pointerId: number }
  /**
   * Der Griff hat den Zeiger-Fang verloren. `stillCaptured`: Das Element hält den Fang trotzdem (noch/wieder) – dann
   * ist die Meldung veraltet (z. B. vom vorigen Ziehen verspätet zugestellt) und wird ignoriert.
   */
  | { type: 'lostcapture'; pointerId: number; stillCaptured: boolean }
  /** Fenster verliert den Fokus, Griff wird gesperrt oder verschwindet: alles abbrechen. */
  | { type: 'abort' };

/** Anweisungen an die DOM-Schicht, in genau dieser Reihenfolge auszuführen. */
export type WebDragEffect =
  | { kind: 'startTimer'; timer: number; ms: number }
  | { kind: 'clearTimer' }
  | { kind: 'capture'; pointerId: number }
  | { kind: 'release'; pointerId: number }
  | { kind: 'start' }
  /** Wie bisher bei react-native-gesture-handler: translationY = Weg seit dem Druck, absoluteY = Lage im Fenster. */
  | { kind: 'move'; translationY: number; absoluteY: number }
  | { kind: 'drop'; absoluteY: number }
  /** Ziehen ist vorbei (abgelegt oder abgebrochen) – Karte zurück, Zieh-Zustand des Bildschirms zurücksetzen. */
  | { kind: 'end' };

export interface WebDragStep {
  state: WebDragState;
  effects: WebDragEffect[];
}

export const WEB_DRAG_IDLE: WebDragState = { phase: 'idle' };

/** Alles zurücksetzen, was der aktuelle Zustand belegt (Timer, Fang, Ziehen). */
function reset(state: WebDragState, effects: WebDragEffect[] = []): WebDragStep {
  if (state.phase === 'pressing') effects.push({ kind: 'clearTimer' });
  if (state.phase === 'dragging') {
    if (state.captured) effects.push({ kind: 'release', pointerId: state.pointerId });
    effects.push({ kind: 'end' });
  }
  return { state: WEB_DRAG_IDLE, effects };
}

let timerCounter = 0;

export function webDragStep(
  state: WebDragState,
  event: WebDragEvent,
  options: WebDragOptions,
): WebDragStep {
  switch (event.type) {
    case 'down': {
      if (!event.isPrimary || event.button !== 0) return { state, effects: [] };
      // Frischer Start – vorher Hängengebliebenes zuerst aufräumen.
      const { effects } = reset(state);
      timerCounter += 1;
      const timer = timerCounter;
      effects.push({ kind: 'startTimer', timer, ms: options.longPressMs });
      return {
        state: {
          phase: 'pressing',
          pointerId: event.pointerId,
          startX: event.x,
          startY: event.y,
          lastY: event.y,
          timer,
        },
        effects,
      };
    }
    case 'timer': {
      if (state.phase !== 'pressing' || state.timer !== event.timer) return { state, effects: [] };
      return {
        state: {
          phase: 'dragging',
          pointerId: state.pointerId,
          startY: state.startY,
          captured: true,
        },
        effects: [
          { kind: 'capture', pointerId: state.pointerId },
          { kind: 'start' },
          // Schon während des Haltens leicht verrutscht: Karte gleich an die richtige Stelle.
          ...(state.lastY !== state.startY
            ? [
                {
                  kind: 'move' as const,
                  translationY: state.lastY - state.startY,
                  absoluteY: state.lastY,
                },
              ]
            : []),
        ],
      };
    }
    case 'move': {
      if (state.phase === 'idle' || state.pointerId !== event.pointerId) {
        return { state, effects: [] };
      }
      if (state.phase === 'pressing') {
        const distance = Math.hypot(event.x - state.startX, event.y - state.startY);
        if (distance > options.tolerancePx) return reset(state);
        return { state: { ...state, lastY: event.y }, effects: [] };
      }
      return {
        state,
        effects: [{ kind: 'move', translationY: event.y - state.startY, absoluteY: event.y }],
      };
    }
    case 'up': {
      if (state.phase === 'idle' || state.pointerId !== event.pointerId) {
        return { state, effects: [] };
      }
      if (state.phase === 'pressing') return reset(state);
      return reset(state, [{ kind: 'drop', absoluteY: event.y }]);
    }
    case 'cancel': {
      if (state.phase === 'idle' || state.pointerId !== event.pointerId) {
        return { state, effects: [] };
      }
      return reset(state);
    }
    case 'lostcapture': {
      // Fang gibt es nur beim Ziehen. Beim Halten (oder in Ruhe) ist eine solche Meldung immer eine verspätete vom
      // vorigen Durchgang und darf den neuen Druck NICHT abbrechen.
      if (
        state.phase !== 'dragging' ||
        state.pointerId !== event.pointerId ||
        event.stillCaptured
      ) {
        return { state, effects: [] };
      }
      // Fang ist schon weg – nicht noch einmal freigeben.
      return reset({ ...state, captured: false });
    }
    case 'abort':
      return reset(state);
  }
}
