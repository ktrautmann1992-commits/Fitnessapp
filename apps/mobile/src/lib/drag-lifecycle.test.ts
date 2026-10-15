import { describe, expect, it } from 'vitest';

import { createDragLifecycle } from './drag-lifecycle';

describe('createDragLifecycle', () => {
  it('Browser: nach abgelehntem Ablegen wird die Geste neu aufgebaut (wie nach erfolgreichem Ablegen)', () => {
    const drag = createDragLifecycle({ web: true });
    drag.start();
    expect(drag.dragging).toBe(true);
    // Ablehnen und erfolgreiches Ablegen enden beide in finish – kein Unterschied mehr für die Geste.
    expect(drag.finish()).toEqual({ renewGesture: true });
    expect(drag.dragging).toBe(false);
    // Zweites Ziehen am selben Griff: wieder frischer Start.
    drag.start();
    expect(drag.dragging).toBe(true);
    expect(drag.finish()).toEqual({ renewGesture: true });
  });

  it('Browser: auch ein abgebrochener/nie gestarteter Druck baut die Geste neu auf (kein hängender Zustand)', () => {
    const drag = createDragLifecycle({ web: true });
    expect(drag.finish()).toEqual({ renewGesture: true });
    expect(drag.finish()).toEqual({ renewGesture: true });
    expect(drag.dragging).toBe(false);
  });

  it('nativ: neu aufbauen nur nach tatsächlichem Ziehen, nicht bei jedem Antippen oder Scrollen über die Karte', () => {
    const drag = createDragLifecycle({ web: false });
    expect(drag.finish()).toEqual({ renewGesture: false });
    drag.start();
    expect(drag.finish()).toEqual({ renewGesture: true });
    expect(drag.finish()).toEqual({ renewGesture: false });
  });

  it('Karte verschwindet während des Ziehens → Ende muss gemeldet werden, danach nicht mehr', () => {
    const drag = createDragLifecycle({ web: true });
    drag.start();
    expect(drag.unmount()).toBe(true);
    expect(drag.dragging).toBe(false);
    expect(drag.unmount()).toBe(false);
  });

  it('Karte verschwindet nach sauberem Ende → nichts mehr zu melden', () => {
    const drag = createDragLifecycle({ web: false });
    drag.start();
    drag.finish();
    expect(drag.unmount()).toBe(false);
  });
});
