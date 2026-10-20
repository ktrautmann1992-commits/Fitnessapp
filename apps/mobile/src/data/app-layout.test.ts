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
    const added = setTabShown(layout, 'fortschritt', true, AVAILABLE_AREAS);
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

describe('Standard in dieser App-Fassung', () => {
  it('ohne Route „Workouts“: Übersicht · Training · Ernährung · Einkaufen · Mehr', () => {
    expect(AVAILABLE_AREAS).not.toContain('workouts');
    expect(defaultLayout(AVAILABLE_AREAS).tabs).toEqual([
      'uebersicht',
      'today',
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
