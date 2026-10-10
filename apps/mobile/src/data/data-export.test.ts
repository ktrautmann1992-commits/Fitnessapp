import {
  buildDataExportFile,
  DATA_EXPORT_TABLES,
  PENDING_DB_EXPORT_TABLES,
} from '@fitnessapp/core';
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
    expect(Object.keys(raw.data)).toEqual([...DATA_EXPORT_TABLES, ...PENDING_DB_EXPORT_TABLES]);
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

  it('enthält die Übungs-Präferenzen (Etappe T2), Zod-geprüft über catchall', () => {
    const preference = {
      user_id: USER_ID,
      exercise_id: 'liegestuetz',
      location: 'home' as const,
      kind: 'dislike' as const,
      replacement_exercise_id: 'knie-liegestuetz',
      created_at: NOW,
      updated_at: NOW,
    };
    const raw = localDataExport(rowsWith({ exercisePreferences: [preference] }), USER_ID, NOW);
    expect(raw.data.exercise_preferences).toEqual([preference]);
    expect(buildDataExportFile(raw, { email: null })?.data['exercise_preferences']).toEqual([
      preference,
    ]);
  });
});
