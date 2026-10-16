/**
 * Ablauf der NATIVEN Zieh-Geste im Trainingskalender (Etappe A1a, react-native-gesture-handler) – rein, ohne React
 * Native, getestet in drag-lifecycle.test.ts. Keine Fachlogik (Erlaubt/Grund rechnet packages/core), nur: Wann ist das
 * Ziehen vorbei, und wann wird die Geste neu aufgebaut?
 *
 * Nativ wird die Geste nach jedem tatsächlich gestarteten Ziehen neu aufgebaut (frischer Handler, wie nach einem
 * erfolgreichen Ablegen, bei dem die Karte an einem anderen Tag neu entsteht). Verschwindet die Karte mitten im
 * Ziehen, meldet `unmount`, dass der Bildschirm den Zieh-Zustand selbst zurücksetzen muss.
 * Im Browser zieht die App nicht mit react-native-gesture-handler, sondern mit lib/web-drag.ts
 * (docs/PLAN-AUSWERTUNG.md, Umsetzungsstand A1a Punkt 14).
 */
export interface DragLifecycle {
  /** Ziehen hat begonnen (Geste aktiv, Karte angehoben). */
  start(): void;
  /**
   * Geste ist vorbei – auf JEDEM Weg: abgelegt, abgelehnt, abgebrochen oder nie gestartet (kurzes Tippen, Scrollen
   * über die Karte). `renewGesture`: Geste neu aufbauen (nur nach echtem Ziehen).
   */
  finish(): { renewGesture: boolean };
  /**
   * Die Karte verschwindet (Woche gewechselt, Plan neu geladen …). true = sie wurde gerade gezogen und das Ende
   * ist noch nicht gemeldet – der Bildschirm muss den Zieh-Zustand selbst zurücksetzen (sonst bliebe Scrollen aus).
   */
  unmount(): boolean;
  /** Läuft gerade ein Ziehen? */
  readonly dragging: boolean;
}

export function createDragLifecycle(): DragLifecycle {
  let started = false;
  return {
    start() {
      started = true;
    },
    finish() {
      const wasStarted = started;
      started = false;
      return { renewGesture: wasStarted };
    },
    unmount() {
      const wasStarted = started;
      started = false;
      return wasStarted;
    },
    get dragging() {
      return started;
    },
  };
}
