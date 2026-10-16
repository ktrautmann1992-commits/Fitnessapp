import { describe, expect, it } from 'vitest';

import { createDragLifecycle } from './drag-lifecycle';

describe('createDragLifecycle (nativ)', () => {
  it('neu aufbauen nur nach tatsächlichem Ziehen, nicht bei jedem Antippen oder Scrollen über die Karte', () => {
    const drag = createDragLifecycle();
    expect(drag.finish()).toEqual({ renewGesture: false });
    drag.start();
    expect(drag.dragging).toBe(true);
    expect(drag.finish()).toEqual({ renewGesture: true });
    expect(drag.dragging).toBe(false);
    expect(drag.finish()).toEqual({ renewGesture: false });
  });

  it('mehrfach hintereinander ziehen (z. B. nach abgelehntem Ablegen): jedes Mal frischer Start', () => {
    const drag = createDragLifecycle();
    for (let round = 0; round < 3; round += 1) {
      drag.start();
      expect(drag.finish()).toEqual({ renewGesture: true });
    }
  });

  it('Karte verschwindet während des Ziehens → Ende muss gemeldet werden, danach nicht mehr', () => {
    const drag = createDragLifecycle();
    drag.start();
    expect(drag.unmount()).toBe(true);
    expect(drag.dragging).toBe(false);
    expect(drag.unmount()).toBe(false);
  });

  it('Karte verschwindet nach sauberem Ende → nichts mehr zu melden', () => {
    const drag = createDragLifecycle();
    drag.start();
    drag.finish();
    expect(drag.unmount()).toBe(false);
  });
});
