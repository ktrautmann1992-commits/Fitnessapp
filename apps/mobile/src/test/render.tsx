import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * Kleiner Render-Helfer für Baustein-Tests (*.test.tsx, Gruppe „components“ in vitest.config.mts): rendert über
 * react-native-web in den happy-dom-Browser und gibt den Container zurück. Keine zusätzliche Test-Bibliothek nötig.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Root[] = [];

export function render(element: ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  mounted.push(root);
  return container;
}

/** Alle gerenderten Bäume abbauen (in afterEach aufrufen). */
export function cleanup(): void {
  for (const root of mounted.splice(0)) act(() => root.unmount());
  document.body.innerHTML = '';
}

/** Elemente mit einer Rolle (role-Attribut, wie react-native-web es aus accessibilityRole setzt). */
export function byRole(container: HTMLElement, role: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
}
