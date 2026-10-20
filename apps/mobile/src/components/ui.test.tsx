import { afterEach, describe, expect, it, vi } from 'vitest';

import { byRole, cleanup, render } from '@/test/render';

import { BUTTON_HEIGHT, Button, Card, Heading, MIN_TOUCH } from './ui';

afterEach(cleanup);

describe('ui.tsx im neuen Aussehen (API unverändert)', () => {
  it('Heading ist eine Überschrift mit Ebene', () => {
    const view = render(<Heading level={2}>Deine Woche</Heading>);
    const [heading] = byRole(view, 'heading');
    expect(heading?.textContent).toBe('Deine Woche');
    expect(heading?.getAttribute('aria-level')).toBe('2');
  });

  it('Button: Rolle, Name und Antippen', () => {
    const onPress = vi.fn();
    const view = render(<Button label="Training starten" onPress={onPress} />);
    const [button] = byRole(view, 'button');
    expect(button?.getAttribute('aria-label')).toBe('Training starten');
    button?.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(BUTTON_HEIGHT).toBeGreaterThanOrEqual(MIN_TOUCH);
  });

  it('Button als Link', () => {
    const view = render(<Button label="Mehr" variant="link" onPress={() => undefined} />);
    expect(byRole(view, 'link')).toHaveLength(1);
  });

  it('Card zeigt den Inhalt', () => {
    const view = render(<Card>Hallo</Card>);
    expect(view.textContent).toBe('Hallo');
  });
});
