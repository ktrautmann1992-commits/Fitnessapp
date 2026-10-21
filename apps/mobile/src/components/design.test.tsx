import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { byRole, cleanup, render } from '@/test/render';

import {
  AreaButton,
  AreaProgress,
  HeroCard,
  Icon,
  ICON_NAMES,
  IconButton,
  IconChip,
  ListGroup,
  ListRow,
  MIN_ROW,
  MiniBars,
  NumberChip,
  ProgressRing,
  SectionLabel,
  StatValue,
  Tile,
} from './design';
import { ProgressRing as NutritionRing } from './nutrition-day-overview';

afterEach(cleanup);

describe('Icon', () => {
  it('hat alle Icons aus dem Entwurf', () => {
    expect(ICON_NAMES).toEqual(
      expect.arrayContaining([
        'dumbbell',
        'stopwatch',
        'utensils',
        'cart',
        'run',
        'trophy',
        'trend',
        'grid',
        'dots',
        'book',
        'recipe',
        'box',
        'settings',
        'info',
        'edit',
        'chevron',
        'play',
        'bar-menu',
      ]),
    );
  });

  it.each(ICON_NAMES)('zeichnet „%s“ als SVG und blendet es als Deko aus', (name) => {
    const view = render(<Icon name={name} testID="icon" />);
    const box = view.querySelector('[data-testid="icon"]');
    expect(box?.getAttribute('aria-hidden')).toBe('true');
    expect(box?.querySelector('svg')).not.toBeNull();
    expect(box?.querySelectorAll('path, circle, rect').length).toBeGreaterThan(0);
  });

  it('ist mit Namen ein Bild für Bildschirmleser', () => {
    const view = render(<Icon name="info" accessibilityLabel="Hinweis" />);
    const [img] = byRole(view, 'img');
    expect(img?.getAttribute('aria-label')).toBe('Hinweis');
  });
});

describe('IconChip', () => {
  it('ist reine Deko', () => {
    const view = render(<IconChip area="ernaehrung" icon="utensils" testID="chip" />);
    expect(view.querySelector('[data-testid="chip"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SectionLabel', () => {
  it('ist eine Überschrift (Großbuchstaben nur per Stil)', () => {
    const view = render(<SectionLabel>Training & Sport</SectionLabel>);
    const [heading] = byRole(view, 'heading');
    expect(heading?.textContent).toBe('Training & Sport');
    expect(heading?.getAttribute('aria-level')).toBe('2');
  });
});

describe('Tile', () => {
  it('ist ohne onPress keine Schaltfläche', () => {
    const view = render(
      <Tile area="einkaufen" icon="cart" title="Einkaufen">
        <StatValue value="7 offen" label="von 19 Artikeln" />
      </Tile>,
    );
    expect(byRole(view, 'button')).toHaveLength(0);
    expect(view.textContent).toContain('Einkaufen');
  });

  it('ist mit onPress ganz antippbar und nennt Kennzeile, Titel und Untertitel', () => {
    const onPress = vi.fn();
    const view = render(
      <Tile
        variant="row"
        area="wettkampf"
        icon="trophy"
        eyebrow="Mein Wettkampf"
        title="Halbmarathon Köln"
        subtitle="noch 47 Tage"
        onPress={onPress}
        role="link"
      />,
    );
    const [link] = byRole(view, 'link');
    expect(link?.getAttribute('aria-label')).toBe(
      'Mein Wettkampf, Halbmarathon Köln, noch 47 Tage',
    );
    expect(view.textContent).toContain('Mein Wettkampf');
    link?.click();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Variante „stacked“ zeigt Titel und Untertitel', () => {
    const view = render(
      <Tile
        variant="stacked"
        area="ausdauer"
        icon="run"
        title="Ausdauer"
        subtitle="Laufen, Rad, Gehen"
        onPress={() => undefined}
      />,
    );
    const [button] = byRole(view, 'button');
    expect(button?.getAttribute('aria-label')).toBe('Ausdauer, Laufen, Rad, Gehen');
  });
});

describe('HeroCard', () => {
  it('hat Kennzeile als Überschrift und einen großen Knopf', () => {
    const onAction = vi.fn();
    const view = render(
      <HeroCard
        eyebrow="Training heute"
        eyebrowIcon="dumbbell"
        meta="Woche 3 von 12"
        title="Ganzkörper A"
        subtitle="6 Übungen · ca. 45 Min"
        actionLabel="Training starten"
        onAction={onAction}
        testID="hero"
      />,
    );
    expect(byRole(view, 'heading')[0]?.textContent).toBe('Training heute');
    const [button] = byRole(view, 'button');
    expect(button?.getAttribute('aria-label')).toBe('Training starten');
    button?.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('zeigt ohne Aktion keinen Knopf', () => {
    const view = render(<HeroCard eyebrow="Training heute" title="Ruhetag" />);
    expect(byRole(view, 'button')).toHaveLength(0);
  });
});

describe('ListRow / ListGroup', () => {
  it('sind Links mit Namen und Beschreibung', () => {
    const view = render(
      <ListGroup>
        <ListRow icon="book" label="Ratgeber" onPress={() => undefined} />
        <ListRow
          icon="settings"
          label="Einstellungen"
          description="Benachrichtigungen"
          onPress={() => undefined}
          last
        />
      </ListGroup>,
    );
    const links = byRole(view, 'link');
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      'Ratgeber',
      'Einstellungen, Benachrichtigungen',
    ]);
    expect(MIN_ROW).toBeGreaterThanOrEqual(44);
  });
});

describe('ListRow (Anzeige, Knopf rechts, destruktiv)', () => {
  it('ist ohne onPress nur Anzeige – ohne Rolle, ohne Pfeil, mit eigenem Knopf rechts', () => {
    const view = render(
      <ListGroup>
        <ListRow
          label="150 g Haferflocken"
          labelTestID="zutat"
          trailing={
            <IconButton icon="swap" accessibilityLabel="Tauschen" onPress={() => undefined} />
          }
          last
        />
      </ListGroup>,
    );
    expect(byRole(view, 'link')).toHaveLength(0);
    expect(byRole(view, 'button').map((b) => b.getAttribute('aria-label'))).toEqual(['Tauschen']);
    expect(view.querySelector('[data-testid="zutat"]')?.textContent).toBe('150 g Haferflocken');
  });

  it('kennzeichnet destruktive Aktionen als Knopf mit Wort', () => {
    const view = render(
      <ListRow
        icon="trash"
        label="Konto löschen"
        role="button"
        tone="danger"
        onPress={() => undefined}
        last
      />,
    );
    expect(byRole(view, 'button')[0]?.getAttribute('aria-label')).toBe('Konto löschen');
  });
});

describe('AreaProgress', () => {
  it('ist eine Fortschrittsanzeige mit Wert und Ansage', () => {
    const view = render(
      <AreaProgress area="training" current={2} total={5} accessibilityLabel="Übung 3 von 5" />,
    );
    const [bar] = byRole(view, 'progressbar');
    expect(bar?.getAttribute('aria-label')).toBe('Übung 3 von 5');
    expect(bar?.getAttribute('aria-valuenow')).toBe('2');
    expect(bar?.getAttribute('aria-valuemax')).toBe('5');
  });

  it('bleibt bei 0 Übungen bei 0 % (kein Fehler)', () => {
    const view = render(
      <AreaProgress area="training" current={0} total={0} accessibilityLabel="leer" onDark />,
    );
    expect(byRole(view, 'progressbar')).toHaveLength(1);
  });
});

describe('AreaButton', () => {
  it('ist ein großer Knopf mit Namen (gefüllt und Umriss)', () => {
    const pressed: string[] = [];
    const view = render(
      <>
        <AreaButton area="ausdauer" icon="pause" label="Pause" onPress={() => pressed.push('p')} />
        <AreaButton
          area="ausdauer"
          icon="stop"
          label="Stopp"
          variant="outline"
          onPress={() => undefined}
        />
      </>,
    );
    const buttons = byRole(view, 'button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Pause', 'Stopp']);
    act(() => buttons[0]?.click());
    expect(pressed).toEqual(['p']);
  });
});

describe('NumberChip', () => {
  it('zeigt die Zahl und ist für Bildschirmleser ausgeblendet', () => {
    const view = render(<NumberChip area="ernaehrung" value={3} />);
    expect(view.textContent).toBe('3');
    expect(view.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('IconButton', () => {
  it('braucht einen Namen', () => {
    const view = render(
      <IconButton
        icon="edit"
        accessibilityLabel="Übersicht bearbeiten"
        onPress={() => undefined}
      />,
    );
    expect(byRole(view, 'button')[0]?.getAttribute('aria-label')).toBe('Übersicht bearbeiten');
  });
});

describe('StatValue', () => {
  it('liest Zahl und Beschriftung zusammen vor', () => {
    const view = render(<StatValue value="9" label="Einheiten" testID="stat" />);
    expect(view.querySelector('[data-testid="stat"]')?.getAttribute('aria-label')).toBe(
      '9 Einheiten',
    );
  });

  it('nimmt eine ausgeschriebene Ansage', () => {
    const view = render(
      <StatValue
        value="18,4 km"
        label="diese Woche"
        accessibilityLabel="18,4 Kilometer"
        testID="s"
      />,
    );
    expect(view.querySelector('[data-testid="s"]')?.getAttribute('aria-label')).toBe(
      '18,4 Kilometer',
    );
  });
});

describe('ProgressRing', () => {
  it('ist derselbe Baustein wie in der Ernährung (keine Kopie)', () => {
    expect(NutritionRing).toBe(ProgressRing);
  });

  it('zeichnet Spur, Bogen und zweite Runde; die Grafik ist ausgeblendet', () => {
    const view = render(<ProgressRing size={64} stroke={7} fraction={1} overFraction={0.2} />);
    expect(view.querySelectorAll('circle')).toHaveLength(3);
    expect(view.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('zeichnet bei 0 nur die Spur und zeigt den Inhalt in der Mitte', () => {
    const view = render(
      <ProgressRing size={64} stroke={7} fraction={0} color="#16A34A">
        <StatValue value="62 %" label="" />
      </ProgressRing>,
    );
    expect(view.querySelectorAll('circle')).toHaveLength(1);
    expect(view.textContent).toContain('62 %');
  });
});

describe('MiniBars', () => {
  it('ist ein Bild mit Ansage und einem Balken je Wert', () => {
    const view = render(
      <MiniBars
        values={[0.4, 0, 0.75, 0, 1, Number.NaN, -1]}
        area="ausdauer"
        highlightIndex={4}
        accessibilityLabel="Kilometer je Tag"
        testID="bars"
      />,
    );
    const [img] = byRole(view, 'img');
    expect(img?.getAttribute('aria-label')).toBe('Kilometer je Tag');
    expect(view.querySelector('[data-testid="bars"]')?.children).toHaveLength(7);
  });
});
