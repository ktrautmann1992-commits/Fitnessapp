import { describe, expect, it } from 'vitest';

import { cycleExportTables, parseCycleExport } from './export';
import { defaultCycleSettings } from './schemas';

describe('Zyklusdaten im Export (Plan 7.5)', () => {
  it('Einstellungen und Einträge entschlüsselt, ohne key_version', () => {
    const parsed = parseCycleExport({
      settings: { payload: defaultCycleSettings(), updated_at: '2026-10-21T08:00:00Z' },
      entries: [
        { entry_date: '2026-10-20', payload: { energy: 2 }, updated_at: '2026-10-20T08:00:00Z' },
      ],
    });
    expect(parsed?.entries).toEqual([
      { entry_date: '2026-10-20', energy: 2, updated_at: '2026-10-20T08:00:00Z' },
    ]);
    const tables = cycleExportTables(parsed ?? { settings: null, entries: [] });
    expect(Object.keys(tables)).toEqual(['cycle_settings', 'cycle_entries']);
    expect(JSON.stringify(tables)).not.toContain('key_version');
  });

  it('ohne Daten keine Tabellen; ungültige Antwort → null; ungültige Zeile bleibt erhalten', () => {
    expect(cycleExportTables({ settings: null, entries: [] })).toEqual({});
    expect(parseCycleExport({ entries: 'x' })).toBeNull();
    const odd = parseCycleExport({
      settings: null,
      entries: [{ entry_date: '2026-10-20', payload: { legacy: 1 }, updated_at: 'x' }],
    });
    expect(odd?.entries).toEqual([{ entry_date: '2026-10-20', legacy: 1, updated_at: 'x' }]);
  });
});
