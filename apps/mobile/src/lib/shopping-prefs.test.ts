import { describe, expect, it, vi } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';

vi.mock('@/data/create-backend', () => ({ deviceStore: createMemoryStore() }));

const {
  parseShoppingPrefs,
  resetShoppingPrefsForTests,
  setShoppingWeekManual,
  updateShoppingPrefs,
} = await import('./shopping-prefs');

describe('Einstellungen der Einkaufsliste (Gerätespeicher)', () => {
  it('Standard: 3 Tage, Erledigte ausblenden an, nichts zugeklappt', () => {
    expect(parseShoppingPrefs(null)).toEqual({
      mode: 'days',
      manualWeeks: [],
      hideChecked: true,
      collapsed: [],
    });
  });

  it('kaputte Werte → Standard je Feld', () => {
    expect(
      parseShoppingPrefs({
        mode: 'month',
        manualWeeks: ['x'],
        hideChecked: 'ja',
        collapsed: ['fish', 'gibt-es-nicht'],
      }),
    ).toEqual({ mode: 'days', manualWeeks: [], hideChecked: true, collapsed: [] });
    expect(parseShoppingPrefs('kaputt')).toEqual({
      mode: 'days',
      manualWeeks: [],
      hideChecked: true,
      collapsed: [],
    });
    expect(parseShoppingPrefs({ mode: 'week', collapsed: ['fish'], hideChecked: false })).toEqual({
      mode: 'week',
      manualWeeks: [],
      hideChecked: false,
      collapsed: ['fish'],
    });
  });

  it('Änderungen werden gespeichert; alte Wochen mit eigenem Zeitraum fallen weg', async () => {
    const kv = createMemoryStore();
    resetShoppingPrefsForTests(kv);
    updateShoppingPrefs(() => ({ mode: 'week', hideChecked: false }));
    setShoppingWeekManual('2026-10-05', true, '2026-10-05');
    setShoppingWeekManual('2026-10-12', true, '2026-10-14');
    setShoppingWeekManual('2026-10-19', true, '2026-10-14');
    setShoppingWeekManual('2026-10-19', false, '2026-10-14');
    await Promise.resolve();
    const saved = JSON.parse(kv.dump()[STORAGE_KEYS.shoppingPrefs] ?? '{}') as unknown;
    expect(parseShoppingPrefs(saved)).toEqual({
      mode: 'week',
      manualWeeks: ['2026-10-12'],
      hideChecked: false,
      collapsed: [],
    });
  });
});
