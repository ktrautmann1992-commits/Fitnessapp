import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { byRole, cleanup, render } from '@/test/render';

import { CollapsibleRow, NoticeStack, SegmentedSwitch } from './slim';

afterEach(cleanup);

const click = (el: HTMLElement | null | undefined) => act(() => el?.click());
const byTestId = (view: HTMLElement, id: string) =>
  view.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('NoticeStack (Hinweis-Zeile, 26.10.2026)', () => {
  it('höchstens ein Hinweis offen, Rest hinter „+N weitere Hinweise“ zum Aufklappen', () => {
    const view = render(
      <NoticeStack
        testID="n"
        items={[
          { id: 'test', level: 'info', node: <span>Testinhalte</span> },
          { id: 'draft', level: 'action', node: <span>Entwurf</span> },
          null,
          { id: 'saved', level: 'success', node: <span>Gespeichert</span> },
        ]}
      />,
    );
    expect(view.textContent).toContain('Entwurf');
    expect(view.textContent).not.toContain('Testinhalte');
    const more = byTestId(view, 'n-more');
    expect(more?.textContent).toContain('+2 weitere Hinweise');
    expect(more?.getAttribute('aria-expanded')).toBe('false');
    click(more);
    expect(view.textContent).toContain('Testinhalte');
    expect(view.textContent).toContain('Gespeichert');
    expect(byTestId(view, 'n-more')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('sperrende Hinweise immer sichtbar, nie zugeklappt; leer → nichts', () => {
    const view = render(
      <NoticeStack
        testID="n"
        items={[
          { id: 'medical', level: 'blocking', node: <span>Arzt</span> },
          { id: 'test', level: 'info', node: <span>Testinhalte</span> },
          { id: 'measure', level: 'info', node: <span>Messen</span> },
        ]}
      />,
    );
    expect(view.textContent).toContain('Arzt');
    expect(view.textContent).not.toContain('Testinhalte');
    expect(byTestId(view, 'n-more')?.textContent).toContain('+2');
    const empty = render(<NoticeStack testID="leer" items={[null, false]} />);
    expect(byTestId(empty, 'leer')).toBeNull();
  });
});

describe('SegmentedSwitch', () => {
  it('Rolle tab mit „ausgewählt“; der gewählte Teil löst nichts aus', () => {
    const plan = vi.fn();
    const workouts = vi.fn();
    const view = render(
      <SegmentedSwitch
        accessibilityLabel="Training"
        selected="plan"
        items={[
          { key: 'plan', label: 'Mein Plan', onPress: plan },
          { key: 'workouts', label: 'Workouts', onPress: workouts },
        ]}
      />,
    );
    const tabs = byRole(view, 'tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    click(tabs[0]);
    click(tabs[1]);
    expect(plan).not.toHaveBeenCalled();
    expect(workouts).toHaveBeenCalledTimes(1);
  });
});

describe('CollapsibleRow', () => {
  it('zugeklappt bis zum Antippen, Zustand für Bildschirmleser', () => {
    const view = render(
      <CollapsibleRow icon="info" title="Dein Plan" subtitle="Vorlage" testID="c">
        <span>Inhalt</span>
      </CollapsibleRow>,
    );
    const toggle = byTestId(view, 'c-toggle');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(view.textContent).not.toContain('Inhalt');
    click(toggle);
    expect(view.textContent).toContain('Inhalt');
    expect(byTestId(view, 'c-toggle')?.getAttribute('aria-expanded')).toBe('true');
  });
});
