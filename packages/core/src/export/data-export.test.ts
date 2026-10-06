import { describe, expect, it } from 'vitest';

import {
  buildDataExportFile,
  DATA_EXPORT_TABLES,
  dataExportFileName,
  dataExportJson,
} from './data-export';

const USER = '11111111-1111-4111-8111-111111111111';

function serverExport(extra: Record<string, unknown> = {}) {
  return {
    format_version: 1,
    exported_at: '2026-10-07T09:00:00+02:00',
    user_id: USER,
    data: {
      ...Object.fromEntries(DATA_EXPORT_TABLES.map((t) => [t, []])),
      session_logs: [{ id: 'l1', notes: 'Griff eng' }],
      consents: [{ consent_type: 'terms', version: 1, revoked_at: null }],
      ...extra,
    },
  };
}

describe('Datenexport (3.7, W9)', () => {
  it('ergänzt die Konto-E-Mail und behält alle Tabellen unverändert', () => {
    const file = buildDataExportFile(serverExport(), { email: 'a@b.de' });
    expect(file?.account).toEqual({ email: 'a@b.de' });
    expect(Object.keys(file?.data ?? {}).sort()).toEqual([...DATA_EXPORT_TABLES].sort());
    expect(file?.data.session_logs).toEqual([{ id: 'l1', notes: 'Griff eng' }]);
    expect(file?.data.consents).toHaveLength(1);
  });

  it('Testmodus ohne E-Mail', () => {
    expect(buildDataExportFile(serverExport(), { email: null })?.account.email).toBeNull();
  });

  it('neue Tabelle einer neueren Datenbank bleibt in der Datei (nie Daten verlieren)', () => {
    const file = buildDataExportFile(serverExport({ new_table: [{ a: 1 }] }), { email: null });
    expect(file?.data['new_table']).toEqual([{ a: 1 }]);
  });

  it('ungültige Antwort: fehlende Tabelle, falsches Format, keine Liste → null', () => {
    const missing = serverExport();
    delete (missing.data as Record<string, unknown>)['set_logs'];
    expect(buildDataExportFile(missing, { email: null })).toBeNull();
    expect(
      buildDataExportFile({ ...serverExport(), format_version: 2 }, { email: null }),
    ).toBeNull();
    expect(
      buildDataExportFile(serverExport({ session_logs: { id: 'x' } }), { email: null }),
    ).toBeNull();
    expect(buildDataExportFile(null, { email: null })).toBeNull();
    expect(buildDataExportFile({ ...serverExport(), extra: 1 }, { email: null })).toBeNull();
  });

  it('Dateiname nur mit Datum, Inhalt als lesbares JSON', () => {
    expect(dataExportFileName('2026-10-07')).toBe('alpha5-meine-daten-2026-10-07.json');
    const file = buildDataExportFile(serverExport(), { email: 'a@b.de' });
    if (!file) throw new Error('Export ungültig');
    const json = dataExportJson(file);
    expect(JSON.parse(json)).toEqual(file);
    expect(json).toContain('\n  "account": {');
  });
});
