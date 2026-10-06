import { buildDataExportFile, DATA_EXPORT_TABLES } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { consent, NOW, rowsWith, USER_ID } from '../test/fixtures';
import { localDataExport } from './data-export';

describe('Datenexport im Testmodus (Etappe D, 3.7)', () => {
  it('gleiche Form wie export_my_data(): alle Tabellen, Einwilligungs-Verlauf, Zod-geprüft', () => {
    const rows = rowsWith({
      consents: [
        consent('privacy', { granted_at: '2026-10-02T10:00:00Z' }),
        consent('terms', { granted_at: '2026-10-01T10:00:00Z' }),
        consent('health_data', { revoked_at: '2026-10-03T09:00:00Z' }),
      ],
    });
    const raw = localDataExport(rows, USER_ID, NOW);
    expect(Object.keys(raw.data)).toEqual([...DATA_EXPORT_TABLES]);
    expect(raw.data.consents.map((c) => (c as { consent_type: string }).consent_type)).toEqual([
      'terms',
      'privacy',
      'health_data',
    ]);
    expect(raw.data.profiles).toHaveLength(1);
    expect(raw.data.goals).toEqual([]);
    const file = buildDataExportFile(raw, { email: null });
    expect(file).not.toBeNull();
    expect(file?.account.email).toBeNull();
    expect(file?.user_id).toBe(USER_ID);
  });
});
