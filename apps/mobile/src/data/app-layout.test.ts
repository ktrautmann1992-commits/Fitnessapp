/**
 * Etappe E2 (docs/PLAN-EINKAUFEN-AUSDAUER.md 4): Anordnung der Übersicht/Menüleiste im TESTMODUS (Gerätespeicher,
 * Regeln wie save_app_layout), Export, kein Gesundheitsdatum (bleibt beim Widerruf), Zeilen aus der Datenbank (Zod),
 * Standard ohne „Workouts“, solange der Bereich in dieser App-Fassung fehlt.
 */
import {
  defaultLayout,
  moveTile,
  normalizeLayout,
  setTabShown,
  toStoredLayout,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, USER_ID } from '../test/fixtures';
import { BackendError } from './backend';
import { appLayoutRowFromDb } from './app-layout';
import { AVAILABLE_AREAS } from '../lib/app-areas';

const rows = () => planPersonRows({ consent: 'valid' });

describe('Anordnung im Testmodus', () => {
  it('speichern, im Export, bleibt beim Widerruf (kein Gesundheitsdatum)', async () => {
    const { backend } = seededBackend(rows());
    const layout = moveTile(defaultLayout(AVAILABLE_AREAS), 'body', 'up');
    const removed = setTabShown(layout, 'workouts', false, AVAILABLE_AREAS);
    if (!removed.ok) throw new Error(removed.reason);
    const added = setTabShown(removed.layout, 'fortschritt', true, AVAILABLE_AREAS);
    if (!added.ok) throw new Error(added.reason);
    const stored = toStoredLayout(added.layout);
    const next = await backend.saveAppLayout(stored, rows());
    expect(next.appLayout).toEqual({ user_id: USER_ID, ...stored });
    expect(normalizeLayout(stored, AVAILABLE_AREAS)).toEqual(added.layout);
    await backend.revokeHealthData(false, null);
    const file = await backend.exportMyData();
    expect(file.data.app_layout_settings).toEqual([{ user_id: USER_ID, ...stored }]);
  });

  it('Regeln wie save_app_layout: Mehr nicht rechts, unbekannter Bereich bzw. doppelte Kachel → abgelehnt', async () => {
    const { backend } = seededBackend(rows());
    const base = toStoredLayout(defaultLayout(AVAILABLE_AREAS));
    for (const bad of [
      { ...base, tab_bar: ['uebersicht', 'mehr', 'today'] },
      { ...base, tab_bar: ['uebersicht', 'raketen', 'mehr'] },
      { ...base, dashboard_tiles: [...base.dashboard_tiles, { id: 'body', visible: false }] },
      { ...base, tab_bar: ['uebersicht', 'mehr'] },
    ]) {
      await expect(backend.saveAppLayout(bad, rows())).rejects.toBeInstanceOf(BackendError);
    }
  });
});

describe('Schrittziel (22.10.2026) im Testmodus', () => {
  it('speichern, ohne Feld bleibt das Ziel, im Export; ungültig → abgelehnt', async () => {
    const { backend } = seededBackend(rows());
    const layout = defaultLayout(AVAILABLE_AREAS);
    const withGoal = await backend.saveAppLayout(toStoredLayout(layout, 10_000), rows());
    expect(withGoal.appLayout?.step_goal).toBe(10_000);
    // Anordnung ändern ohne Ziel (z. B. ältere Fassung) → Ziel bleibt.
    const moved = await backend.saveAppLayout(
      toStoredLayout(moveTile(layout, 'steps', 'up')),
      withGoal,
    );
    expect(moved.appLayout?.step_goal).toBe(10_000);
    const file = await backend.exportMyData();
    expect(file.data.app_layout_settings).toEqual([expect.objectContaining({ step_goal: 10_000 })]);
    for (const bad of [500, 30_500, 8250]) {
      await expect(
        backend.saveAppLayout({ ...toStoredLayout(layout), step_goal: bad }, moved),
      ).rejects.toBeInstanceOf(BackendError);
    }
  });

  it('Zeile aus der Datenbank: step_goal übernommen, null/fehlend → kein eigenes Ziel', () => {
    const base = { user_id: USER_ID, ...toStoredLayout(defaultLayout(AVAILABLE_AREAS)) };
    expect(appLayoutRowFromDb({ ...base, step_goal: 9000 })?.step_goal).toBe(9000);
    expect(appLayoutRowFromDb({ ...base, step_goal: null })).toEqual(base);
    expect(appLayoutRowFromDb(base)).toEqual(base);
  });
});

describe('Standard in dieser App-Fassung', () => {
  it('mit Bereich „Workouts“: Übersicht · Training · Workouts · Ernährung · Einkaufen · Mehr (6)', () => {
    expect(AVAILABLE_AREAS).toContain('workouts');
    expect(defaultLayout(AVAILABLE_AREAS).tabs).toEqual([
      'uebersicht',
      'today',
      'workouts',
      'ernaehrung',
      'einkaufsliste',
      'mehr',
    ]);
  });
});

describe('appLayoutRowFromDb', () => {
  it('Zod an der Grenze: gültig → Zeile, sonst null', () => {
    const stored = toStoredLayout(defaultLayout());
    expect(appLayoutRowFromDb({ user_id: USER_ID, ...stored })).toEqual({
      user_id: USER_ID,
      ...stored,
    });
    expect(appLayoutRowFromDb({ user_id: USER_ID, ...stored, tab_bar: 'x' })).toBeNull();
    expect(appLayoutRowFromDb({ ...stored })).toBeNull();
    expect(appLayoutRowFromDb(undefined)).toBeNull();
  });
});
