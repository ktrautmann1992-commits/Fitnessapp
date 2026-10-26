/**
 * Übersicht und Menüleiste anpassen (docs/PLAN-EINKAUFEN-AUSDAUER.md 4, seit 26.10.2026 „App verschlanken“,
 * docs/PLAN-DASHBOARD.md 11): Ränder (erste/letzte), alle Kacheln aus, 7 Knöpfe abgelehnt, ohne „Mehr“/„Heute“ nicht
 * möglich, unbekannte/doppelte IDs, neue Kachel nach einem Update, fehlender Bereich, kaputter Speicher, Idempotenz,
 * Umstellung alter Standards (nur Unverändertes, nur alte Fassung), markierter Knopf.
 */
import { describe, expect, it } from 'vitest';

import { APP_LAYOUT } from './constants';
import {
  areasInMore,
  DASHBOARD_TILES,
  DEFAULT_TILES,
  defaultLayout,
  highlightedTab,
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
const V = APP_LAYOUT.version;
const OLD_TABS: NavArea[] = [
  'uebersicht',
  'today',
  'workouts',
  'ernaehrung',
  'einkaufsliste',
  'mehr',
];
const NEW_TABS: NavArea[] = ['uebersicht', 'today', 'ernaehrung', 'einkaufsliste', 'mehr'];

describe('defaultLayout', () => {
  it('= „App verschlanken“ (26.10.2026): Heute · Training · Ernährung · Einkaufen · Mehr; Kacheln wie Entwurf', () => {
    const layout = defaultLayout();
    expect(layout.tabs).toEqual(NEW_TABS);
    expect(layout.tiles).toEqual([
      { id: 'training', visible: true },
      { id: 'progress', visible: true },
      { id: 'nutrition', visible: true },
      { id: 'endurance', visible: true },
      { id: 'steps', visible: true },
      { id: 'recovery', visible: true },
      { id: 'competition', visible: true },
      { id: 'workouts', visible: false },
      { id: 'body', visible: false },
      { id: 'shortcuts', visible: false },
    ]);
    // Jede Kachel genau einmal im Standard.
    expect(DEFAULT_TILES.map((t) => t.id).sort()).toEqual([...DASHBOARD_TILES].sort());
    // „Workouts“, „Wettkampf“, „Fortschritt“ bleiben wählbar (unter „Mehr“).
    expect(areasInMore(layout)).toEqual(['workouts', 'wettkampf', 'fortschritt']);
  });

  it('ohne Bereich „Workouts“ (Route fehlt) → dieselben 5 Knöpfe', () => {
    expect(defaultLayout(WITHOUT_WORKOUTS).tabs).toEqual(NEW_TABS);
  });

  it('Standard ist eine Kopie (DEFAULT_TILES bleibt unverändert)', () => {
    expect(defaultLayout().tiles[0]).not.toBe(DEFAULT_TILES[0]);
    expect(defaultLayout().tiles).toEqual(DEFAULT_TILES);
  });
});

describe('Umstellung alter Standards (26.10.2026)', () => {
  const oldTiles = DASHBOARD_TILES.map((id) => ({ id, visible: true }));

  it('unveränderter alter Standard (ohne Fassung) → neuer Standard (Leiste und Kacheln)', () => {
    expect(normalizeLayout({ dashboard_tiles: oldTiles, tab_bar: OLD_TABS })).toEqual(
      defaultLayout(),
    );
    // Ältere Fassungen mit weniger Kacheln (vor „Schritte“/„Erholung“) zählen auch als unverändert.
    const older = oldTiles.filter((t) => t.id !== 'steps' && t.id !== 'recovery');
    expect(normalizeLayout({ dashboard_tiles: older, tab_bar: OLD_TABS })).toEqual(defaultLayout());
    // Fassung 1 bzw. null ausdrücklich gespeichert = alt.
    for (const layoutVersion of [1, null]) {
      expect(
        normalizeLayout({
          dashboard_tiles: oldTiles,
          tab_bar: OLD_TABS,
          layout_version: layoutVersion,
        }),
      ).toEqual(defaultLayout());
    }
  });

  it('alter Standard ohne Bereich „Workouts“ (Route fehlt) → neuer Standard', () => {
    expect(
      normalizeLayout(
        { dashboard_tiles: oldTiles, tab_bar: OLD_TABS.filter((a) => a !== 'workouts') },
        WITHOUT_WORKOUTS,
      ).tabs,
    ).toEqual(NEW_TABS);
  });

  it('selbst Zusammengestelltes bleibt (nur das Unveränderte wird umgestellt)', () => {
    const ownTabs = ['uebersicht', 'today', 'fortschritt', 'ernaehrung', 'einkaufsliste', 'mehr'];
    const hidden = oldTiles.map((t) => (t.id === 'body' ? { ...t, visible: false } : t));
    const layout = normalizeLayout({ dashboard_tiles: hidden, tab_bar: ownTabs });
    expect(layout.tabs).toEqual(ownTabs);
    expect(layout.tiles).toEqual(hidden);
    // Umsortiert (alle sichtbar) gilt als verändert …
    const moved = [oldTiles[1], oldTiles[0], ...oldTiles.slice(2)];
    const kept = normalizeLayout({ dashboard_tiles: moved, tab_bar: OLD_TABS });
    expect(kept.tiles).toEqual(moved);
    // … die unveränderte alte Leiste wird trotzdem umgestellt.
    expect(kept.tabs).toEqual(NEW_TABS);
    // Leere Kachel-Liste ist kein „unverändert“ (alle Kacheln kommen mit Standard-Sichtbarkeit dazu).
    expect(normalizeLayout({ dashboard_tiles: [], tab_bar: OLD_TABS }).tiles).toEqual(
      defaultLayout().tiles,
    );
  });

  it('neue Fassung: dieselbe Leiste bewusst gewählt („Workouts“ an 3. Stelle) bleibt erhalten', () => {
    const chosen = { dashboard_tiles: oldTiles, tab_bar: OLD_TABS, layout_version: V };
    const layout = normalizeLayout(chosen);
    expect(layout.tabs).toEqual(OLD_TABS);
    expect(layout.tiles).toEqual(oldTiles);
    expect(toStoredLayout(layout).layout_version).toBe(V);
    expect(normalizeLayout(toStoredLayout(layout))).toEqual(layout);
    // Spätere App-Fassung (höhere Zahl) → ebenfalls nichts umstellen; ungültige Fassung → Standard (Zod).
    expect(normalizeLayout({ ...chosen, layout_version: V + 1 }).tabs).toEqual(OLD_TABS);
    expect(normalizeLayout({ ...chosen, layout_version: 0 })).toEqual(defaultLayout());
    expect(normalizeLayout({ ...chosen, layout_version: 1.5 })).toEqual(defaultLayout());
    expect(normalizeLayout({ ...chosen, layout_version: APP_LAYOUT.versionMax + 1 })).toEqual(
      defaultLayout(),
    );
  });
});

describe('normalizeLayout', () => {
  it('kaputter oder fehlender Speicher → Standard', () => {
    for (const bad of [null, undefined, 42, 'x', {}, { dashboard_tiles: [], tab_bar: ['mehr'] }]) {
      expect(normalizeLayout(bad)).toEqual(defaultLayout());
    }
  });

  it('unbekannte und doppelte IDs fallen weg, fehlende Kacheln an ihrer Standardstelle (Standard-Sichtbarkeit)', () => {
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
      { id: 'nutrition', visible: true },
      { id: 'endurance', visible: true },
      { id: 'steps', visible: true },
      { id: 'recovery', visible: true },
      { id: 'competition', visible: true },
      { id: 'workouts', visible: false },
      { id: 'body', visible: false },
      { id: 'shortcuts', visible: false },
      { id: 'training', visible: true },
    ]);
    expect(layout.tabs).toEqual(['uebersicht', 'fortschritt', 'mehr']);
  });

  it('neue Kachel nach einem Update: hinter ihrem Standard-Vorgänger', () => {
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
      'progress',
      'nutrition',
      'endurance',
      'steps',
      'recovery',
      'competition',
      'workouts',
      'body',
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
      tab_bar: ['uebersicht', 'today', 'ernaehrung', 'fortschritt', 'mehr'],
    };
    const layout = normalizeLayout(old);
    expect(layout.tiles).toHaveLength(DASHBOARD_TILES.length);
    // Standard-Vorgänger von „competition“ ist „recovery“ (hinter „steps“ hinter „endurance“).
    expect(layout.tiles.map((t) => t.id).slice(5)).toEqual([
      'endurance',
      'steps',
      'recovery',
      'competition',
      'shortcuts',
    ]);
    expect(layout.tiles.find((t) => t.id === 'competition')?.visible).toBe(true);
    // Die eigene Menüleiste bleibt, wie sie war (kein neuer Knopf „Wettkampf“).
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
    const stored = {
      dashboard_tiles: [],
      tab_bar: ['uebersicht', 'today', 'workouts', 'fortschritt', 'mehr'],
      layout_version: V,
    };
    expect(normalizeLayout(stored, WITHOUT_WORKOUTS).tabs).toEqual([
      'uebersicht',
      'today',
      'fortschritt',
      'mehr',
    ]);
    expect(areasInMore(normalizeLayout(stored))).toEqual([
      'ernaehrung',
      'einkaufsliste',
      'wettkampf',
    ]);
  });

  it('idempotent', () => {
    const once = normalizeLayout({
      dashboard_tiles: [{ id: 'body', visible: false }],
      tab_bar: ['today', 'uebersicht', 'mehr', 'workouts'],
    });
    expect(normalizeLayout(toStoredLayout(once))).toEqual(once);
    const legacy = normalizeLayout({
      dashboard_tiles: DASHBOARD_TILES.map((id) => ({ id, visible: true })),
      tab_bar: OLD_TABS,
    });
    expect(normalizeLayout(toStoredLayout(legacy))).toEqual(legacy);
  });
});

describe('highlightedTab (welcher Knopf ist markiert)', () => {
  it('eigener Knopf; Workouts → Training; Wettkampf/Fortschritt → Mehr; sonst keiner', () => {
    const tabs = defaultLayout().tabs;
    expect(highlightedTab(tabs, 'ernaehrung')).toBe('ernaehrung');
    expect(highlightedTab(tabs, 'workouts')).toBe('today');
    expect(highlightedTab(tabs, 'wettkampf')).toBe('mehr');
    expect(highlightedTab(tabs, 'fortschritt')).toBe('mehr');
    expect(highlightedTab(tabs, undefined)).toBeNull();
    expect(highlightedTab(tabs, 'raketen')).toBeNull();
    // Hat die Person „Workouts“ bzw. „Wettkampf“ als eigenen Knopf, ist dieser markiert.
    expect(highlightedTab(OLD_TABS, 'workouts')).toBe('workouts');
    expect(highlightedTab(['uebersicht', 'wettkampf', 'mehr'], 'wettkampf')).toBe('wettkampf');
    // Ohne „Training“ in der Leiste ist bei Workouts nichts markiert.
    expect(highlightedTab(['uebersicht', 'ernaehrung', 'mehr'], 'workouts')).toBeNull();
    // Ohne Elternknopf (Einkaufen nicht in der Leiste) → keiner.
    expect(highlightedTab(['uebersicht', 'today', 'mehr'], 'einkaufsliste')).toBeNull();
  });
});

describe('Kacheln', () => {
  it('verschieben: Ränder ändern nichts; Stelle für die Ansage', () => {
    const layout = defaultLayout();
    expect(moveTile(layout, 'training', 'up')).toBe(layout);
    expect(moveTile(layout, 'shortcuts', 'down')).toBe(layout);
    const moved = moveTile(layout, 'nutrition', 'up');
    expect(moved.tiles.map((t) => t.id).slice(0, 3)).toEqual(['training', 'nutrition', 'progress']);
    expect(tilePosition(moved, 'nutrition')).toEqual({ index: 2, count: 10 });
    expect(tilePosition(moveTile(moved, 'nutrition', 'down'), 'nutrition')).toEqual({
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
    // Standard hat 5 Knöpfe – „Workouts“ passt noch als 6., dann ist voll.
    const added6 = setTabShown(defaultLayout(), 'workouts', true);
    if (!added6.ok) throw new Error(added6.reason);
    const full = added6.layout;
    expect(full.tabs).toEqual([
      'uebersicht',
      'today',
      'ernaehrung',
      'einkaufsliste',
      'workouts',
      'mehr',
    ]);
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
      'einkaufsliste',
      'ernaehrung',
      'mehr',
    ]);
  });

  it('„Mehr“ zeigt alle Bereiche ohne Knopf; sameLayout', () => {
    // „Workouts“, „Wettkampf“ und „Fortschritt“ sind nicht im Standard, stehen unter „Mehr“.
    expect(areasInMore(defaultLayout())).toEqual(['workouts', 'wettkampf', 'fortschritt']);
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
      // „competition“ fehlte ebenfalls → hinter ihrem Standard-Vorgänger („recovery“).
      { id: 'competition', visible: true },
    ]);
    expect(layout.tiles.find((t) => t.id === 'training')).toEqual({
      id: 'training',
      visible: false,
    });
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
    expect(layout.tiles.slice(0, 4)).toEqual([
      { id: 'steps', visible: false },
      { id: 'recovery', visible: true },
      // „competition“ und „workouts“ fehlten ebenfalls → hinter ihrem Standard-Vorgänger, Standard-Sichtbarkeit.
      { id: 'competition', visible: true },
      { id: 'workouts', visible: false },
    ]);
    expect(layout.tiles.find((t) => t.id === 'training')).toEqual({
      id: 'training',
      visible: true,
    });
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
