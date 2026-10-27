import { z } from 'zod';

import { APP_LAYOUT } from './constants';
import { resolveStepGoal, stepGoalSchema } from './wearables/steps';

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
 * - **Schrittziel** (22.10.2026) wird mit der Anordnung gespeichert (`step_goal`, kein Gesundheitsdatum) – siehe
 *   `toStoredLayout`/`storedStepGoal`; die Anordnung selbst (`AppLayout`) kennt es nicht.
 * - Standard (`defaultLayout`) seit „App verschlanken“ (Gründer-Freigabe 26.10.2026, docs/PLAN-DASHBOARD.md 11):
 *   Menüleiste mit 5 Knöpfen **Heute · Training · Ernährung · Einkaufen · Mehr** (IDs `uebersicht` = Reiter „Heute“,
 *   `today` = Reiter „Training“). „Workouts“ steht als Umschalter im Training, bleibt aber als Knopf wählbar, ebenso
 *   „Wettkampf“ und „Fortschritt“. Kacheln (`DEFAULT_TILES`): Training heute, Deine Woche, Ernährung, Ausdauer,
 *   Schritte, Erholung, Wettkampf sichtbar; Workouts, Körperdaten und Schnellzugriffe ausgeblendet (über „Kacheln
 *   anpassen“ wieder einblendbar). Ist ein Bereich in dieser App-Fassung nicht vorhanden, fehlt er auch im Standard.
 * - **Umstellung alter Standards** (`normalizeLayout`): Eine gespeicherte Menüleiste, die genau dem alten Standard vom
 *   20.10.2026 entspricht (6 Knöpfe mit „Workouts“), und Kacheln, die nie verändert wurden (alle sichtbar, alte
 *   Standard-Reihenfolge), bekommen den neuen Standard. Selbst Zusammengestelltes bleibt unverändert.
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
  // „Schritte“ mit Tagesziel als Ring (Gründer-Wunsch 22.10.2026, docs/PLAN-PHASE-8.md 13.4) – neben „Ausdauer“.
  'steps',
  // „Erholung“ aus Schlaf, Ruhepuls und HRV der Uhr (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15) – hinter
  // „Schritte“, eigene Zeile (Mini-Verlauf braucht die Breite).
  'recovery',
  'shortcuts',
] as const;
export type DashboardTileId = (typeof DASHBOARD_TILES)[number];

export interface TileSetting {
  readonly id: DashboardTileId;
  readonly visible: boolean;
}

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

/** Standard-Menüleiste seit „App verschlanken“ (26.10.2026): Heute · Training · Ernährung · Einkaufen · Mehr. */
export const DEFAULT_TAB_BAR: readonly NavArea[] = [
  'uebersicht',
  'today',
  'ernaehrung',
  'einkaufsliste',
  'mehr',
];

/** Alter Standard (EA-1 + Workouts, 20.10.2026) – unverändert gespeichert → neuer Standard (`normalizeLayout`). */
export const LEGACY_DEFAULT_TAB_BAR: readonly NavArea[] = [
  'uebersicht',
  'today',
  'workouts',
  'ernaehrung',
  'einkaufsliste',
  'mehr',
];

/**
 * Standard-Kacheln der Startseite „Heute“ (26.10.2026, Entwurf 1-heute): Reihenfolge und Sichtbarkeit. Jede Kachel aus
 * `DASHBOARD_TILES` steht genau einmal darin (Test). Ausgeblendete Kacheln lassen sich über „Kacheln anpassen“
 * wieder einblenden.
 */
export const DEFAULT_TILES: readonly TileSetting[] = [
  { id: 'training', visible: true },
  // „Deine Woche“ (bisher „Fortschritt“): Wochenstreifen „0 von 3 erledigt“.
  { id: 'progress', visible: true },
  { id: 'nutrition', visible: true },
  { id: 'endurance', visible: true },
  { id: 'steps', visible: true },
  { id: 'recovery', visible: true },
  { id: 'competition', visible: true },
  // Workouts stehen im Training (Umschalter), Körperdaten unter Mehr › Fortschritt, Kurzwege in den Reitern.
  { id: 'workouts', visible: false },
  { id: 'body', visible: false },
  { id: 'shortcuts', visible: false },
];

/** Fest: links bzw. rechts, nie ausblendbar. */
export const FIXED_FIRST_TAB: NavArea = 'uebersicht';
export const FIXED_LAST_TAB: NavArea = 'mehr';

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
  // Eigenes Schrittziel (22.10.2026, Spalte `step_goal`): fehlt bzw. null = Standard (STEP_GOAL.default).
  step_goal: stepGoalSchema.nullable().optional(),
  // Fassung der Anordnung (26.10.2026, Spalte `layout_version`): fehlt bzw. null = alte Fassung (vor „App
  // verschlanken“). Spätere App-Fassungen dürfen höhere Zahlen speichern.
  layout_version: z.number().int().min(1).max(APP_LAYOUT.versionMax).nullable().optional(),
  // „Erholungs-Routine vorschlagen“ (Sportarten Stufe 1, 27.10.2026, Spalte `recovery_routine`): fehlt = Standard an;
  // save_app_layout behält ohne das Feld die gespeicherte Einstellung.
  recovery_routine: z.boolean().optional(),
});
export type StoredAppLayout = z.infer<typeof storedAppLayoutSchema>;

const isTile = (id: string): id is DashboardTileId =>
  (DASHBOARD_TILES as readonly string[]).includes(id);
const isArea = (id: string): id is NavArea => (NAV_AREAS as readonly string[]).includes(id);

/** Standard für die vorhandenen Bereiche (`available`, Standard: alle). */
export function defaultLayout(available: readonly NavArea[] = NAV_AREAS): AppLayout {
  return {
    tiles: DEFAULT_TILES.map((tile) => ({ ...tile })),
    tabs: DEFAULT_TAB_BAR.filter((a) => available.includes(a)),
  };
}

/**
 * Fehlende Kacheln an ihrer Standardstelle (hinter dem vorigen vorhandenen Standard-Nachbarn aus `DEFAULT_TILES`)
 * ergänzen – mit der Standard-Sichtbarkeit.
 */
function withMissingTiles(tiles: TileSetting[]): TileSetting[] {
  const out = [...tiles];
  DEFAULT_TILES.forEach((tile, index) => {
    if (out.some((t) => t.id === tile.id)) return;
    let at = 0;
    for (let k = index - 1; k >= 0; k -= 1) {
      const found = out.findIndex((t) => t.id === DEFAULT_TILES[k]?.id);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { ...tile });
  });
  return out;
}

/** Gespeicherte Menüleiste = alter Standard (ohne nicht vorhandene Bereiche)? Dann gilt der neue Standard. */
function isLegacyDefaultTabs(ids: readonly string[], available: readonly NavArea[]): boolean {
  const legacy = LEGACY_DEFAULT_TAB_BAR.filter((a) => available.includes(a));
  return ids.length === legacy.length && ids.every((id, index) => id === legacy[index]);
}

/**
 * Kacheln nie verändert? Alle sichtbar und in der alten Standard-Reihenfolge (`DASHBOARD_TILES`, auch ältere Fassungen
 * mit weniger Kacheln). Dann gilt der neue Standard (`DEFAULT_TILES`).
 */
function isLegacyDefaultTiles(tiles: readonly TileSetting[]): boolean {
  if (tiles.length === 0 || tiles.some((t) => !t.visible)) return false;
  const order = tiles.map((t) => (DASHBOARD_TILES as readonly string[]).indexOf(t.id));
  return order.every((value, index) => index === 0 || value > (order[index - 1] ?? -1));
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
  // Umstellung nur für Anordnungen aus der Zeit vor „App verschlanken“ (ohne bzw. mit alter Fassung).
  const legacy = (parsed.data.layout_version ?? 1) < APP_LAYOUT.version;
  const tabIds =
    legacy && isLegacyDefaultTabs(parsed.data.tab_bar, available)
      ? DEFAULT_TAB_BAR
      : parsed.data.tab_bar;
  return {
    tiles:
      legacy && isLegacyDefaultTiles(tiles)
        ? defaultLayout(available).tiles
        : withMissingTiles(tiles),
    tabs: ruledTabs(tabIds, available),
  };
}

/**
 * Zum Speichern (Spaltennamen wie `app_layout_settings`). `stepGoal` (optional) = eigenes Schrittziel; ohne bzw. null
 * fehlt das Feld (die Datenbank behält dann das gespeicherte Ziel). Immer mit der aktuellen Fassung
 * (`layout_version`), damit eine bewusst gewählte Leiste nie mehr umgestellt wird.
 */
export function toStoredLayout(layout: AppLayout, stepGoal?: number | null): StoredAppLayout {
  return storedAppLayoutSchema.parse({
    dashboard_tiles: layout.tiles.map((t) => ({ id: t.id, visible: t.visible })),
    tab_bar: [...layout.tabs],
    ...(stepGoal === undefined || stepGoal === null ? {} : { step_goal: stepGoal }),
    layout_version: APP_LAYOUT.version,
  });
}

/** Schrittziel aus dem gespeicherten Stand (fehlt/ungültig → Standard 8.000). */
export function storedStepGoal(stored: unknown): number {
  if (typeof stored !== 'object' || stored === null) return resolveStepGoal(null);
  return resolveStepGoal((stored as { step_goal?: unknown }).step_goal);
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

/**
 * Welcher Knopf ist markiert, wenn `focused` offen ist (Entwurf 8-navigation, 26.10.2026)? Der eigene Knopf, sonst
 * der Reiter, unter dem der Bereich jetzt steht: „Workouts“ → „Training“ (Umschalter), „Wettkampf“ und „Fortschritt“
 * → „Mehr“. Sonst keiner (null).
 */
export const AREA_PARENT: Readonly<Partial<Record<NavArea, NavArea>>> = {
  workouts: 'today',
  wettkampf: 'mehr',
  fortschritt: 'mehr',
};

export function highlightedTab(
  tabs: readonly NavArea[],
  focused: string | undefined,
): NavArea | null {
  if (focused === undefined || !isArea(focused)) return null;
  if (tabs.includes(focused)) return focused;
  const parent = AREA_PARENT[focused];
  return parent !== undefined && tabs.includes(parent) ? parent : null;
}
