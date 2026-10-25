import { describe, expect, it, vi } from 'vitest';

import { createMemoryStore } from '@/data/kv';

vi.mock('@/data/create-backend', () => ({ deviceStore: createMemoryStore() }));

const { readWidgetEnabled, resetWidgetPrefs, resetWidgetPrefsForTests, setWidgetEnabled } =
  await import('./widget-prefs');

describe('Schalter „Widget auf dem Startbildschirm“', () => {
  it('Standard aus; nur echtes true schaltet ein; Zurücksetzen löscht', async () => {
    const kv = createMemoryStore();
    resetWidgetPrefsForTests(kv);
    expect(await readWidgetEnabled(kv)).toBe(false);
    await kv.setItem('fitnessapp.widget-enabled.v1', '"true"');
    expect(await readWidgetEnabled(kv)).toBe(false);
    await kv.setItem('fitnessapp.widget-enabled.v1', 'kaputt{');
    expect(await readWidgetEnabled(kv)).toBe(false);
    await setWidgetEnabled(true);
    expect(await readWidgetEnabled(kv)).toBe(true);
    await resetWidgetPrefs();
    expect(await readWidgetEnabled(kv)).toBe(false);
    expect(kv.dump()).toEqual({});
  });
});
