import { afterEach, describe, expect, it } from 'vitest';

import { AccessibilityProvider } from '@/lib/accessibility';
import { byRole, cleanup, render } from '@/test/render';

import { Text } from './text';
import { Button } from './ui';

afterEach(cleanup);

const large = { largeView: true, readAloud: false };
const normal = { largeView: false, readAloud: false };

function fontSizeOf(el: Element | null): string {
  return el ? getComputedStyle(el).fontSize : '';
}

describe('Große Ansicht (FA5, docs/PLAN-FIT-IM-ALTER.md 12)', () => {
  it('vergrößert Text um den Faktor 1,25 (16 → 20 px)', () => {
    const view = render(
      <AccessibilityProvider initial={large}>
        <Text testID="t" style={{ fontSize: 16, lineHeight: 24 }}>
          Hallo
        </Text>
      </AccessibilityProvider>,
    );
    const el = view.querySelector('[data-testid="t"]');
    expect(fontSizeOf(el)).toBe('20px');
    expect(el ? getComputedStyle(el).lineHeight : '').toBe('30px');
  });

  it('lässt Text ohne große Ansicht unverändert', () => {
    const view = render(
      <AccessibilityProvider initial={normal}>
        <Text testID="t" style={{ fontSize: 16 }}>
          Hallo
        </Text>
      </AccessibilityProvider>,
    );
    expect(fontSizeOf(view.querySelector('[data-testid="t"]'))).toBe('16px');
  });

  it('Knöpfe sind in der großen Ansicht mindestens 56 px hoch', () => {
    const view = render(
      <AccessibilityProvider initial={large}>
        <Button label="Weiter" onPress={() => undefined} />
      </AccessibilityProvider>,
    );
    const [button] = byRole(view, 'button');
    expect(button ? getComputedStyle(button).minHeight : '').toBe('56px');
  });
});
