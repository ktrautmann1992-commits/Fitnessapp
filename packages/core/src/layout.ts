import { z } from 'zod';

import { APP_LAYOUT } from './constants';

/**
 * Übersicht und Menüleiste anpassen (docs/PLAN-EINKAUFEN-AUSDAUER.md 4, Gründer-Entscheidung EA-G2 vom 20.10.2026;
 * Workouts-Bereich: Gründer-Wunsch vom 20.10.2026). Reine Regeln – die App speichert nur (Tabelle
 * `app_layout_settings`, Testmodus Gerätespeicher) und zeigt an. Kein Gesundheitsdatum.
 *
 * - **Kacheln** der Übersicht ein-/ausblenden und umsortieren. Hinweise oben („Im Training wartet etwas“, Plan dringend,
 *   Sicherheits-/Einwilligungshinweise) sind KEINE Kacheln – sie stehen immer über den Kacheln und lassen sich nicht
 *   ausblenden. Alle Kacheln aus ist erlaubt (die App zeigt dann „Alle Kacheln ausgeblendet“ + „Bearbeiten“).
 * - **Menüleiste**: „Übersicht“ immer da und immer links (Startseite), „Mehr“ immer da und immer rechts,
 *   `APP_LAYOUT.tabsMin`–`APP_LAYOUT.tabsMax` Knöpfe, jeder Bereich höchstens einmal. Bereiche ohne Knopf erreicht man
 *   über „Mehr“ (`areasInMore`).
 * - **Robust** (`normalizeLayout`): unbekannte, doppelte bzw. (noch) nicht vorhandene IDs fallen weg; fehlende Kacheln
 *   kommen an ihrer Standardstelle dazu (sichtbar); die Regeln der Menüleiste werden erzwungen; kaputter Speicher →
 *   Standard. Neue Bereiche kommen NICHT von selbst in eine selbst zusammengestellte Menüleiste (sie stehen unter
 *   „Mehr“) – nur der Standard enthält sie.
 * - Standard (`defaultLayout`) = Stand vom 20.10.2026: alle Kacheln sichtbar in der heutigen Reihenfolge (mit
 *   „Mein Wettkampf“ an zweiter Stelle); Menüleiste Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr
 *   (EA-1 + Workouts). „Wettkampf“ ist wählbar, aber nicht im Standard (steht unter „Mehr“). Ist ein Bereich in dieser
 *   App-Fassung nicht vorhanden (z. B. „Workouts“ vor dem Zusammenführen), fehlt er auch im Standard.
 */

export const DASHBOARD_TILES = [
  'training',
  // „Mein Wettkampf“ (Gründer-Rückmeldung 20.10.2026: Wettkampfplan leicht finden) – weit oben.
  'competition',
  'workouts',
  'nutrition',
  'body',
  'progress',
  'endurance',
  'shortcuts',
] as const;
export type DashboardTileId = (typeof DASHBOARD_TILES)[number];

export const NAV_AREAS = [
  'uebersicht',
  'today',
  'workouts',
  'ernaehrung',
  'einkaufsliste',
  // „Wettkampf“ (20.10.2026): wählbarer Knopf, NICHT im Standard – steht unter „Mehr“ als erster Bereich.
  'wettkampf',
  'fortschritt',
  'mehr',
] as const;
export type NavArea = (typeof NAV_AREAS)[number];

/** Standard-Menüleiste (EA-1 + Workouts, 20.10.2026). */
export const DEFAULT_TAB_BAR: readonly NavArea[] = [
  'uebersicht',
  'today',
  'workouts',
  'ernaehrung',
  'einkaufsliste',
  'mehr',
];

/** Fest: links bzw. rechts, nie ausblendbar. */
export const FIXED_FIRST_TAB: NavArea = 'uebersicht';
export const FIXED_LAST_TAB: NavArea = 'mehr';

export interface TileSetting {
  readonly id: DashboardTileId;
  readonly visible: boolean;
}

export interface AppLayout {
  /** Alle Kacheln in Anzeige-Reihenfolge (auch ausgeblendete). */
  readonly tiles: readonly TileSetting[];
  /** Knöpfe der Menüleiste von links nach rechts. */
  readonly tabs: readonly NavArea[];
}

const idSchema = z.string().regex(/^[a-z_]{1,40}$/);

/**
 * Gespeicherte Form (Spalten `dashboard_tiles`, `tab_bar` von `app_layout_settings`) – an der Grenze geprüft. IDs
 * werden hier nur auf ihre Form geprüft; ob sie bekannt sind, entscheidet `normalizeLayout` (spätere App-Fassungen
 * dürfen neue Kacheln kennen). Die Datenbank prüft gegen die bekannten Listen (sync: db-sync.test.ts).
 */
export const storedAppLayoutSchema = z.strictObject({
  dashboard_tiles: z
    .array(z.strictObject({ id: idSchema, visible: z.boolean() }))
    .max(APP_LAYOUT.storedTilesMax),
  tab_bar: z.array(idSchema).min(APP_LAYOUT.tabsMin).max(APP_LAYOUT.tabsMax),
});
export type StoredAppLayout = z.infer<typeof storedAppLayoutSchema>;

const isTile = (id: string): id is DashboardTileId =>
  (DASHBOARD_TILES as readonly string[]).includes(id);
const isArea = (id: string): id is NavArea => (NAV_AREAS as readonly string[]).includes(id);

/** Standard für die vorhandenen Bereiche (`available`, Standard: alle). */
export function defaultLayout(available: readonly NavArea[] = NAV_AREAS): AppLayout {
  return {
    tiles: DASHBOARD_TILES.map((id) => ({ id, visible: true })),
    tabs: DEFAULT_TAB_BAR.filter((a) => available.includes(a)),
  };
}

/** Fehlende Kacheln an ihrer Standardstelle (hinter dem vorigen vorhandenen Standard-Nachbarn) ergänzen. */
function withMissingTiles(tiles: TileSetting[]): TileSetting[] {
  const out = [...tiles];
  DASHBOARD_TILES.forEach((id, index) => {
    if (out.some((t) => t.id === id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k -= 1) {
      const found = out.findIndex((t) => t.id === DASHBOARD_TILES[k]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { id, visible: true });
  });
  return out;
}

/** Regeln der Menüleiste erzwingen (Übersicht links, Mehr rechts, 3–6, jeder Bereich einmal, nur vorhandene). */
function ruledTabs(ids: readonly string[], available: readonly NavArea[]): NavArea[] {
  const seen = new Set<NavArea>();
  const middle: NavArea[] = [];
  for (const id of ids) {
    if (!isArea(id) || !available.includes(id) || seen.has(id)) continue;
    seen.add(id);
    if (id !== FIXED_FIRST_TAB && id !== FIXED_LAST_TAB) middle.push(id);
  }
  const room = APP_LAYOUT.tabsMax - 2;
  const kept = middle.slice(0, room);
  // Zu wenige Knöpfe → mit dem Standard auffüllen (in Standard-Reihenfolge).
  for (const area of DEFAULT_TAB_BAR) {
    if (kept.length + 2 >= APP_LAYOUT.tabsMin) break;
    if (area === FIXED_FIRST_TAB || area === FIXED_LAST_TAB || !available.includes(area)) continue;
    if (!kept.includes(area)) kept.push(area);
  }
  return [FIXED_FIRST_TAB, ...kept, FIXED_LAST_TAB];
}

/**
 * Gespeicherten (oder fehlenden) Stand in eine gültige Anordnung bringen – siehe Modulkommentar. Idempotent:
 * `normalizeLayout(toStoredLayout(normalizeLayout(x)))` = `normalizeLayout(x)`.
 */
export function normalizeLayout(
  stored: unknown,
  available: readonly NavArea[] = NAV_AREAS,
): AppLayout {
  const parsed = storedAppLayoutSchema.safeParse(stored);
  if (!parsed.success) return defaultLayout(available);
  const seen = new Set<string>();
  const tiles: TileSetting[] = [];
  for (const tile of parsed.data.dashboard_tiles) {
    if (!isTile(tile.id) || seen.has(tile.id)) continue;
    seen.add(tile.id);
    tiles.push({ id: tile.id, visible: tile.visible });
  }
  return { tiles: withMissingTiles(tiles), tabs: ruledTabs(parsed.data.tab_bar, available) };
}

/** Zum Speichern (Spaltennamen wie `app_layout_settings`). */
export function toStoredLayout(layout: AppLayout): StoredAppLayout {
  return storedAppLayoutSchema.parse({
    dashboard_tiles: layout.tiles.map((t) => ({ id: t.id, visible: t.visible })),
    tab_bar: [...layout.tabs],
  });
}

export type MoveDirection = 'up' | 'down';

/** Kachel um eine Stelle verschieben; am Rand keine Änderung. */
export function moveTile(
  layout: AppLayout,
  id: DashboardTileId,
  direction: MoveDirection,
): AppLayout {
  const from = layout.tiles.findIndex((t) => t.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= layout.tiles.length) return layout;
  const tiles = [...layout.tiles];
  const [moved] = tiles.splice(from, 1);
  if (moved === undefined) return layout;
  tiles.splice(to, 0, moved);
  return { ...layout, tiles };
}

/** Kachel ein- bzw. ausblenden. */
export function setTileVisible(
  layout: AppLayout,
  id: DashboardTileId,
  visible: boolean,
): AppLayout {
  return { ...layout, tiles: layout.tiles.map((t) => (t.id === id ? { ...t, visible } : t)) };
}

/** Stelle (1-basiert) und Anzahl – für die Ansage „… ist jetzt an Stelle 2 von 5“. */
export function tilePosition(
  layout: AppLayout,
  id: DashboardTileId,
): { index: number; count: number } {
  return { index: layout.tiles.findIndex((t) => t.id === id) + 1, count: layout.tiles.length };
}

export type TabChange =
  | { readonly ok: true; readonly layout: AppLayout }
  /** `fixed`: Übersicht/Mehr; `max`: schon 6 Knöpfe; `min`: nur noch 3 Knöpfe; `unavailable`: Bereich fehlt. */
  | { readonly ok: false; readonly reason: 'fixed' | 'max' | 'min' | 'unavailable' };

/** Bereich in die Menüleiste aufnehmen (vor „Mehr“) bzw. herausnehmen – mit Regeln und verständlichem Grund. */
export function setTabShown(
  layout: AppLayout,
  area: NavArea,
  shown: boolean,
  available: readonly NavArea[] = NAV_AREAS,
): TabChange {
  if (area === FIXED_FIRST_TAB || area === FIXED_LAST_TAB) return { ok: false, reason: 'fixed' };
  if (!available.includes(area)) return { ok: false, reason: 'unavailable' };
  const has = layout.tabs.includes(area);
  if (shown === has) return { ok: true, layout };
  if (shown) {
    if (layout.tabs.length >= APP_LAYOUT.tabsMax) return { ok: false, reason: 'max' };
    return {
      ok: true,
      layout: { ...layout, tabs: [...layout.tabs.slice(0, -1), area, FIXED_LAST_TAB] },
    };
  }
  if (layout.tabs.length <= APP_LAYOUT.tabsMin) return { ok: false, reason: 'min' };
  return { ok: true, layout: { ...layout, tabs: layout.tabs.filter((a) => a !== area) } };
}

/** Knopf um eine Stelle verschieben – nur zwischen „Übersicht“ und „Mehr“; am Rand keine Änderung. */
export function moveTab(layout: AppLayout, area: NavArea, direction: MoveDirection): AppLayout {
  const from = layout.tabs.indexOf(area);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from <= 0 || from >= layout.tabs.length - 1) return layout;
  if (to <= 0 || to >= layout.tabs.length - 1) return layout;
  const tabs = [...layout.tabs];
  tabs.splice(from, 1);
  tabs.splice(to, 0, area);
  return { ...layout, tabs };
}

/** Bereiche ohne Knopf – „Mehr“ zeigt sie (ohne Übersicht/Mehr, nur vorhandene, in Standard-Reihenfolge). */
export function areasInMore(
  layout: AppLayout,
  available: readonly NavArea[] = NAV_AREAS,
): NavArea[] {
  return NAV_AREAS.filter(
    (a) =>
      a !== FIXED_FIRST_TAB &&
      a !== FIXED_LAST_TAB &&
      available.includes(a) &&
      !layout.tabs.includes(a),
  );
}

/** Gleiche Anordnung? (z. B. „Auf Standard zurücksetzen“ nur anbieten, wenn etwas anders ist) */
export function sameLayout(a: AppLayout, b: AppLayout): boolean {
  return JSON.stringify(toStoredLayout(a)) === JSON.stringify(toStoredLayout(b));
}
