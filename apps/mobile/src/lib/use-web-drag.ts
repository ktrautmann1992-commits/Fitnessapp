import { useCallback, useEffect, useRef, useState } from 'react';

import { WEB_DRAG_IDLE, webDragStep, type WebDragEvent, type WebDragState } from './web-drag';

/** Erlaubte Bewegung während des langen Drucks (Pixel) – Bedienung, keine Fachregel. */
export const WEB_DRAG_TOLERANCE_PX = 10;

export interface WebDragCallbacks {
  onStart: () => void;
  onMove: (translationY: number, absoluteY: number) => void;
  onDrop: (absoluteY: number) => void;
  /** Auf JEDEM Weg nach einem Start genau einmal (abgelegt oder abgebrochen). */
  onEnd: () => void;
}

/**
 * DOM-Schicht für das Ziehen am Griff im Browser (lib/web-drag.ts ist der Zustandsautomat). Liefert eine Ref für den
 * Griff. Die Rückrufe dürfen sich ändern (sie werden über eine Ref gelesen); ein laufendes Ziehen bricht dadurch nicht
 * ab. Nur auf dem Griff: `touch-action: none` (die Seite scrollt über den Karten weiter).
 */
export function useWebHandleDrag(
  enabled: boolean,
  longPressMs: number,
  callbacks: WebDragCallbacks,
): (node: unknown) => void {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const latest = useRef(callbacks);
  useEffect(() => {
    latest.current = callbacks;
  });
  const ref = useCallback((node: unknown) => {
    setElement(typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null);
  }, []);

  useEffect(() => {
    if (!element) return;
    const el = element;
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.setProperty('-webkit-user-select', 'none');
    el.style.setProperty('-webkit-touch-callout', 'none');

    let state: WebDragState = WEB_DRAG_IDLE;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timeout !== null) clearTimeout(timeout);
      timeout = null;
    };
    const options = { longPressMs, tolerancePx: WEB_DRAG_TOLERANCE_PX };
    const run = (event: WebDragEvent) => {
      const step = webDragStep(state, event, options);
      state = step.state;
      for (const effect of step.effects) {
        switch (effect.kind) {
          case 'startTimer':
            clearTimer();
            timeout = setTimeout(() => {
              timeout = null;
              run({ type: 'timer', timer: effect.timer });
            }, effect.ms);
            break;
          case 'clearTimer':
            clearTimer();
            break;
          case 'capture':
            try {
              el.setPointerCapture(effect.pointerId);
            } catch {
              // Zeiger schon weg – Bewegung/Loslassen kommen trotzdem über window an.
            }
            break;
          case 'release':
            try {
              if (el.hasPointerCapture(effect.pointerId))
                el.releasePointerCapture(effect.pointerId);
            } catch {
              // nichts mehr freizugeben
            }
            break;
          case 'start':
            latest.current.onStart();
            break;
          case 'move':
            latest.current.onMove(effect.translationY, effect.absoluteY);
            break;
          case 'drop':
            latest.current.onDrop(effect.absoluteY);
            break;
          case 'end':
            latest.current.onEnd();
            break;
        }
      }
    };

    const onDown = (event: PointerEvent) => {
      if (!enabled) return;
      run({
        type: 'down',
        pointerId: event.pointerId,
        isPrimary: event.isPrimary,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
      });
    };
    // Bewegen/Loslassen über window (Einfangphase): kommt an, auch wenn der Fang fehlt oder jemand die Weitergabe stoppt.
    const onMove = (event: PointerEvent) =>
      run({ type: 'move', pointerId: event.pointerId, x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) =>
      run({ type: 'up', pointerId: event.pointerId, y: event.clientY });
    const onCancel = (event: PointerEvent) => run({ type: 'cancel', pointerId: event.pointerId });
    const onLost = (event: PointerEvent) =>
      run({
        type: 'lostcapture',
        pointerId: event.pointerId,
        stillCaptured: el.hasPointerCapture(event.pointerId),
      });
    const onAbort = () => run({ type: 'abort' });
    const onHidden = () => {
      if (document.visibilityState === 'hidden') onAbort();
    };
    // Kein Kontextmenü/Textauswahl beim langen Druck bzw. während des Ziehens.
    const prevent = (event: Event) => event.preventDefault();
    const preventWhileActive = (event: Event) => {
      if (state.phase !== 'idle') event.preventDefault();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('lostpointercapture', onLost);
    el.addEventListener('contextmenu', prevent);
    el.addEventListener('dragstart', prevent);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    window.addEventListener('blur', onAbort);
    window.addEventListener('selectstart', preventWhileActive, true);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      // Griff gesperrt, ersetzt oder entfernt: laufendes Ziehen sauber beenden (genau ein onEnd).
      onAbort();
      clearTimer();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('lostpointercapture', onLost);
      el.removeEventListener('contextmenu', prevent);
      el.removeEventListener('dragstart', prevent);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      window.removeEventListener('blur', onAbort);
      window.removeEventListener('selectstart', preventWhileActive, true);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [element, enabled, longPressMs]);

  return ref;
}
