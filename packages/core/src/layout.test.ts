/**
 * Übersicht und Menüleiste anpassen (docs/PLAN-EINKAUFEN-AUSDAUER.md 4): Ränder (erste/letzte), alle Kacheln aus,
 * 7 Knöpfe abgelehnt, ohne „Mehr“/„Übersicht“ nicht möglich, unbekannte/doppelte IDs, neue Kachel nach einem Update,
 * fehlender Bereich (Workouts vor dem Zusammenführen), kaputter Speicher, Idempotenz.
 */
import { describe, expect, it } from 'vitest';

import { APP_LAYOUT } from './constants';
import {
  areasInMore,
  DASHBOARD_TILES,
  defaultLayout,
  moveTab,
  moveTile,
  NAV_AREAS,
  type NavArea,
  normalizeLayout,
  sameLayout,
  setTabShown,
  setTileVisible,
  tilePosition,
  storedStepGoal,
  toStoredLayout,
} from './layout';

const WITHOUT_WORKOUTS: NavArea[] = NAV_AREAS.filter((a) => a !== 'workouts');

describe('defaultLayout', () => {
  it('= Stand 20.10.2026: alle Kacheln sichtbar; Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr', () => {
    const layout = defaultLayout();
    expect(layout.tiles).toEqual(DASHBOARD_TILES.map((id) => ({ id, visible: true })));
    expect(layout.tabs).toEqual([
      'uebersicht',
      'today',
      'workouts',
      'ernaehrung',
      'einkaufsliste',
      'mehr',
    ]);
    expect(layout.tabs).toHaveLength(APP_LAYOUT.tabsMax);
  });

  it('ohne Bereich „Workouts“ (Route fehlt) → 5 Knöpfe', () => {
    expect(defaultLayout(WITHOUT_WORKOUTS).tabs).toEqual([
      'uebersicht',
      'today',
      'ernaehrung',
      'einkaufsliste',
      'mehr',
    ]);
  });
});

describe('normalizeLayout', () => {
  it('kaputter oder fehlender Speicher → Standard', () => {
    for (const bad of [null, undefined, 42, 'x', {}, { dashboard_tiles: [], tab_bar: ['mehr'] }]) {
      expect(normalizeLayout(bad)).toEqual(defaultLayout());
    }
  });

  it('unbekannte und doppelte IDs fallen weg, fehlende Kacheln an ihrer Standardstelle (sichtbar)', () => {
    const layout = normalizeLayout({
      dashboard_tiles: [
        { id: 'progress', visible: false },
        { id: 'raketen', visible: true },
        { id: 'progress', visible: true },
        { id: 'training', visible: true },
      ],
      tab_bar: ['uebersicht', 'fortschritt', 'fortschritt', 'raketen', 'mehr'],
    });
    expect(layout.tiles).toEqual([
      { id: 'progress', visible: false },
      { id: 'endurance', visible: true },
      { id: 'steps', visible: true },
      { id: 'recovery', visible: true },
      { id: 'shortcuts', visible: true },
      { id: 'training', visible: true },
      { id: 'competition', visible: true },
      { id: 'workouts', visible: true },
      { id: 'nutrition', visible: true },
      { id: 'body', visible: true },
    ]);
    expect(layout.tabs).toEqual(['uebersicht', 'fortschritt', 'mehr']);
  });

  it('neue Kachel nach einem Update (z. B. „Workouts“): hinter ihrem Standard-Vorgänger', () => {
    const layout = normalizeLayout({
      dashboard_tiles: [
        { id: 'shortcuts', visible: true },
        { id: 'training', visible: false },
        { id: 'progress', visible: true },
      ],
      tab_bar: ['uebersicht', 'today', 'mehr'],
    });
    expect(layout.tiles.map((t) => t.id)).toEqual([
      'shortcuts',
      'training',
      'competition',
      'workouts',
      'nutrition',
      'body',
      'progress',
      'endurance',
      'steps',
      'recovery',
    ]);
  });

  it('„Mein Wettkampf“ in einer gespeicherten Anordnung von vor dem 20.10.2026: an der Standardstelle, sichtbar', () => {
    // Gespeicherte Fassung ohne „competition“ (alle 7 alten Kacheln, eigene Reihenfolge, teils ausgeblendet).
    const old = {
      dashboard_tiles: [
        { id: 'nutrition', visible: true },
        { id: 'training', visible: true },
        { id: 'workouts', visible: false },
        { id: 'body', visible: true },
        { id: 'progress', visible: true },
        { id: 'endurance', visible: true },
        { id: 'shortcuts', visible: true },
      ],
      tab_bar: ['uebersicht', 'today', 'workouts', 'ernaehrung', 'einkaufsliste', 'mehr'],
    };
    const layout = normalizeLayout(old);
    expect(layout.tiles.slice(0, 4)).toEqual([
      { id: 'nutrition', visible: true },
      { id: 'training', visible: true },
      { id: 'competition', visible: true },
      { id: 'workouts', visible: false },
    ]);
    expect(layout.tiles).toHaveLength(DASHBOARD_TILES.length);
    // Standard: direkt hinter „Training heute“ (weit oben).
    expect(
      defaultLayout()
        .tiles.map((t) => t.id)
        .slice(0, 2),
    ).toEqual(['training', 'competition']);
    // Ohne „Training heute“ im Speicher: „Training heute“ und „Mein Wettkampf“ kommen ganz nach oben.
    expect(
      normalizeLayout({ ...old, dashboard_tiles: old.dashboard_tiles.slice(2) }).tiles[0],
    ).toEqual({ id: 'training', visible: true });
    expect(
      normalizeLayout({ ...old, dashboard_tiles: old.dashboard_tiles.slice(2) }).tiles[1],
    ).toEqual({ id: 'competition', visible: true });
    // Die Menüleiste bleibt, wie sie war (kein neuer Knopf „Wettkampf“).
    expect(layout.tabs).toEqual(old.tab_bar);
    expect(normalizeLayout(toStoredLayout(layout))).toEqual(layout);
  });

  it('Regeln erzwungen: Übersicht links, Mehr rechts, auch wenn sie fehlen bzw. falsch stehen; höchstens 6', () => {
    const layout = normalizeLayout({
      dashboard_tiles: [],
      tab_bar: ['mehr', 'today', 'ernaehrung', 'uebersicht', 'einkaufsliste', 'fortschritt'],
    });
    expect(layout.tabs).toEqual([
      'uebersicht',
      'today',
      'ernaehrung',
      'einkaufsliste',
      'fortschritt',
      'mehr',
    ]);
    // Zu wenige (nur fest) → mit dem Standard aufgefüllt auf 3.
    expect(
      normalizeLayout({ dashboard_tiles: [], tab_bar: ['uebersicht', 'mehr', 'mehr'] }).tabs,
    ).toEqual(['uebersicht', 'today', 'mehr']);
  });

  it('fehlender Bereich (Workouts ohne Route) fällt weg; neuer Bereich kommt nicht von selbst in eine eigene Leiste', () => {
    const stored = toStoredLayout(defaultLayout());
    expect(normalizeLayout(stored, WITHOUT_WORKOUTS).tabs).not.toContain('workouts');
    const own = { ...toStoredLayout(defaultLayout(WITHOUT_WORKOUTS)) };
    expect(normalizeLayout(own).tabs).not.toContain('workouts');
    expect(areasInMore(normalizeLayout(own))).toEqual(['workouts', 'wettkampf', 'fortschritt']);
  });

  it('idempotent', () => {
    const once = normalizeLayout({
      dashboard_tiles: [{ id: 'body', visible: false }],
      tab_bar: ['today', 'uebersicht', 'mehr', 'workouts'],
    });
    expect(normalizeLayout(toStoredLayout(once))).toEqual(once);
  });
});

describe('Kacheln', () => {
  it('verschieben: Ränder ändern nichts; Stelle für die Ansage', () => {
    const layout = defaultLayout();
    expect(moveTile(layout, 'training', 'up')).toBe(layout);
    expect(moveTile(layout, 'shortcuts', 'down')).toBe(layout);
    const moved = moveTile(layout, 'workouts', 'up');
    expect(moved.tiles.map((t) => t.id).slice(0, 3)).toEqual([
      'training',
      'workouts',
      'competition',
    ]);
    expect(tilePosition(moved, 'workouts')).toEqual({ index: 2, count: 10 });
    expect(tilePosition(moveTile(moved, 'workouts', 'down'), 'workouts')).toEqual({
      index: 3,
      count: 10,
    });
  });

  it('alle Kacheln aus ist erlaubt; wieder an', () => {
    let layout = defaultLayout();
    for (const id of DASHBOARD_TILES) layout = setTileVisible(layout, id, false);
    expect(layout.tiles.every((t) => !t.visible)).toBe(true);
    expect(normalizeLayout(toStoredLayout(layout)).tiles.every((t) => !t.visible)).toBe(true);
    layout = setTileVisible(layout, 'body', true);
    expect(layout.tiles.find((t) => t.id === 'body')?.visible).toBe(true);
  });
});

describe('Menüleiste', () => {
  it('7. Knopf abgelehnt (max), unter 3 abgelehnt (min), Übersicht/Mehr fest, fehlender Bereich', () => {
    const full = defaultLayout();
    expect(setTabShown(full, 'fortschritt', true)).toEqual({ ok: false, reason: 'max' });
    expect(setTabShown(full, 'mehr', false)).toEqual({ ok: false, reason: 'fixed' });
    expect(setTabShown(full, 'uebersicht', false)).toEqual({ ok: false, reason: 'fixed' });
    expect(
      setTabShown(defaultLayout(WITHOUT_WORKOUTS), 'workouts', true, WITHOUT_WORKOUTS),
    ).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    let layout = full;
    for (const area of ['workouts', 'ernaehrung', 'einkaufsliste'] as const) {
      const r = setTabShown(layout, area, false);
      if (!r.ok) throw new Error(r.reason);
      layout = r.layout;
    }
    expect(layout.tabs).toEqual(['uebersicht', 'today', 'mehr']);
    expect(setTabShown(layout, 'today', false)).toEqual({ ok: false, reason: 'min' });
    const added = setTabShown(layout, 'fortschritt', true);
    expect(added.ok && added.layout.tabs).toEqual(['uebersicht', 'today', 'fortschritt', 'mehr']);
    expect(setTabShown(layout, 'today', true)).toEqual({ ok: true, layout });
    // „Wettkampf“ ist wählbar wie jeder Bereich (vor „Mehr“), aber nur bis 6 Knöpfe.
    const race = setTabShown(layout, 'wettkampf', true);
    expect(race.ok && race.layout.tabs).toEqual(['uebersicht', 'today', 'wettkampf', 'mehr']);
    expect(setTabShown(full, 'wettkampf', true)).toEqual({ ok: false, reason: 'max' });
    expect(defaultLayout().tabs).not.toContain('wettkampf');
  });

  it('verschieben nur zwischen Übersicht und Mehr', () => {
    const layout = defaultLayout();
    expect(moveTab(layout, 'today', 'up')).toBe(layout);
    expect(moveTab(layout, 'einkaufsliste', 'down')).toBe(layout);
    expect(moveTab(layout, 'uebersicht', 'down')).toBe(layout);
    expect(moveTab(layout, 'mehr', 'up')).toBe(layout);
    expect(moveTab(layout, 'einkaufsliste', 'up').tabs).toEqual([
      'uebersicht',
      'today',
      'workouts',
      'einkaufsliste',
      'ernaehrung',
      'mehr',
    ]);
  });

  it('„Mehr“ zeigt alle Bereiche ohne Knopf; sameLayout', () => {
    // „Wettkampf“ ist nicht im Standard, steht unter „Mehr“ als erster Bereich.
    expect(areasInMore(defaultLayout())).toEqual(['wettkampf', 'fortschritt']);
    expect(areasInMore(defaultLayout(WITHOUT_WORKOUTS), WITHOUT_WORKOUTS)).toEqual([
      'wettkampf',
      'fortschritt',
    ]);
    expect(sameLayout(defaultLayout(), defaultLayout())).toBe(true);
    expect(sameLayout(defaultLayout(), moveTile(defaultLayout(), 'body', 'up'))).toBe(false);
  });
});

describe('Kachel „Schritte“ und Schrittziel (22.10.2026)', () => {
  it('Standard: „Schritte“ direkt hinter „Ausdauer“, sichtbar', () => {
    const ids = defaultLayout().tiles.map((t) => t.id);
    expect(ids.indexOf('steps')).toBe(ids.indexOf('endurance') + 1);
    expect(defaultLayout().tiles.find((t) => t.id === 'steps')?.visible).toBe(true);
  });

  it('gespeicherte Anordnung von vorher (ohne „steps“): erscheint hinter „Ausdauer“, eigene Reihenfolge bleibt', () => {
    const layout = normalizeLayout({
      dashboard_tiles: [
        { id: 'endurance', visible: true },
        { id: 'training', visible: false },
        { id: 'shortcuts', visible: true },
      ],
      tab_bar: ['uebersicht', 'today', 'mehr'],
    });
    expect(layout.tiles.slice(0, 4)).toEqual([
      { id: 'endurance', visible: true },
      { id: 'steps', visible: true },
      { id: 'recovery', visible: true },
      { id: 'training', visible: false },
    ]);
  });

  it('„Erholung“ (25.10.2026): Standard direkt hinter „Schritte“; in alten Anordnungen hinter „Schritte“ ergänzt', () => {
    const ids = defaultLayout().tiles.map((t) => t.id);
    expect(ids.indexOf('recovery')).toBe(ids.indexOf('steps') + 1);
    const layout = normalizeLayout({
      dashboard_tiles: [
        { id: 'steps', visible: false },
        { id: 'training', visible: true },
      ],
      tab_bar: ['uebersicht', 'today', 'mehr'],
    });
    expect(layout.tiles.slice(0, 3)).toEqual([
      { id: 'steps', visible: false },
      { id: 'recovery', visible: true },
      // „shortcuts“ fehlte ebenfalls → hinter ihrem Standard-Vorgänger („recovery“).
      { id: 'shortcuts', visible: true },
    ]);
    expect(layout.tiles[3]).toEqual({ id: 'training', visible: true });
  });

  it('Schrittziel wird mit gespeichert; ohne Ziel fehlt das Feld; ungültig → nicht speicherbar', () => {
    const layout = defaultLayout();
    expect(toStoredLayout(layout)).not.toHaveProperty('step_goal');
    expect(toStoredLayout(layout, null)).not.toHaveProperty('step_goal');
    expect(toStoredLayout(layout, 10_000).step_goal).toBe(10_000);
    expect(() => toStoredLayout(layout, 10_250)).toThrow();
    // Anordnung unverändert durch das Ziel.
    expect(normalizeLayout(toStoredLayout(layout, 10_000))).toEqual(layout);
  });

  it('storedStepGoal: gespeichert → Ziel; fehlt/null/ungültig/kein Objekt → 8.000', () => {
    const stored = toStoredLayout(defaultLayout(), 12_000);
    expect(storedStepGoal(stored)).toBe(12_000);
    expect(storedStepGoal(toStoredLayout(defaultLayout()))).toBe(8000);
    expect(storedStepGoal({ ...stored, step_goal: null })).toBe(8000);
    expect(storedStepGoal({ ...stored, step_goal: 42 })).toBe(8000);
    expect(storedStepGoal(null)).toBe(8000);
    expect(storedStepGoal('x')).toBe(8000);
  });

  it('ungültiges Ziel im Speicher → Anordnung fällt auf den Standard (Zod an der Grenze)', () => {
    const stored = { ...toStoredLayout(moveTile(defaultLayout(), 'body', 'up')), step_goal: 99 };
    expect(normalizeLayout(stored)).toEqual(defaultLayout());
  });
});
