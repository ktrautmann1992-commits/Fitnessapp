/**
 * Ablauf einer Zieh-Geste im Trainingskalender (Etappe A1a) – rein, ohne React Native, getestet in
 * drag-lifecycle.test.ts. Keine Fachlogik (Erlaubt/Grund rechnet packages/core), nur: Wann ist das Ziehen vorbei, und
 * wann wird die Geste neu aufgebaut?
 *
 * Hintergrund (docs/PLAN-AUSWERTUNG.md, Umsetzungsstand A1a): Im Browser startete in der CI nach einem ABGELEHNTEN
 * Ablegen das nächste Ziehen am selben Griff nicht mehr – bis zum Neuladen der Seite. Nach einem erfolgreichen Ablegen
 * trat das nie auf, weil die Karte dabei an einem anderen Tag neu entsteht (neuer Griff, neue Geste). Die Geste im
 * Browser (react-native-gesture-handler, Web) hängt am DOM-Element des Griffs: Zeiger-Fang (setPointerCapture), Zähler
 * gedrückter Zeiger und Zustand des Handlers leben dort weiter. Meldet der Browser die Freigabe des Zeigers verspätet
 * (lostpointercapture erst beim nächsten Druck), bricht die Geste diesen nächsten Druck sofort wieder ab – und jeden
 * weiteren ebenso. Deshalb wird die Geste im Browser nach JEDEM Ende neu aufgebaut (frischer Griff = Zustand wie nach
 * einem erfolgreichen Ablegen), nativ nach jedem tatsächlich gestarteten Ziehen.
 */
export interface DragLifecycle {
  /** Ziehen hat begonnen (Geste aktiv, Karte angehoben). */
  start(): void;
  /**
   * Geste ist vorbei – auf JEDEM Weg: abgelegt, abgelehnt, abgebrochen (pointercancel, Zeiger verloren, Geste
   * deaktiviert) oder nie gestartet (kurzes Tippen, zu früh bewegt). `renewGesture`: Geste neu aufbauen.
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

export function createDragLifecycle({ web }: { web: boolean }): DragLifecycle {
  let started = false;
  return {
    start() {
      started = true;
    },
    finish() {
      const wasStarted = started;
      started = false;
      return { renewGesture: web || wasStarted };
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
