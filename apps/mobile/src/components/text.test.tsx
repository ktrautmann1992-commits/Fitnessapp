import { afterEach, describe, expect, it } from 'vitest';

import { fontWeightName } from '@/lib/fonts';
import { cleanup, render } from '@/test/render';

import { Text } from './text';

afterEach(cleanup);

describe('fontWeightName', () => {
  it('ordnet Stärken den vier Schnitten zu', () => {
    expect(fontWeightName(undefined)).toBe('regular');
    expect(fontWeightName('normal')).toBe('regular');
    expect(fontWeightName('400')).toBe('regular');
    expect(fontWeightName('500')).toBe('semibold');
    expect(fontWeightName('600')).toBe('semibold');
    expect(fontWeightName('bold')).toBe('bold');
    expect(fontWeightName(700)).toBe('bold');
    expect(fontWeightName('800')).toBe('extrabold');
    expect(fontWeightName('900')).toBe('extrabold');
  });
});

describe('Text', () => {
  it('rendert wie Text aus react-native (Rolle, Inhalt)', () => {
    const view = render(
      <Text accessibilityRole="header" style={{ fontWeight: '700' }}>
        Hallo
      </Text>,
    );
    expect(view.querySelector('[role="heading"]')?.textContent).toBe('Hallo');
  });
});
