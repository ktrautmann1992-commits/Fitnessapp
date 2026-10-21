import {
  buildSupplementInputs,
  CURRENT_CONSENT_VERSIONS,
  recommendSupplements,
  supplementOverview,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { CONTENT_BUNDLE } from '@/generated/content-files';
import {
  consent,
  NOW,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
  VERSIONS,
} from '@/test/fixtures';

import {
  supplementSourceFromRows,
  supplementsFromBundle,
  supplementsFromDbRows,
} from './supplement-library';
import { applyUserSupplement, rowsWithOldHealthConsent } from './supplement-local';
import type { UserRows } from './types';

// Supplement-Bereich in der App (docs/PLAN-PHASE-6.md 8, Etappe SU4): Quellen, Abbildung der Zeilen, Testmodus-Regeln.

const NO = { kidney: false, breastfeeding: false, heart_rhythm: false, caffeine_sensitive: false };

describe('Inhalte', () => {
  it('Testmodus: alle 18 Entwürfe aus dem Bündel (ohne roten Befund), Supabase: nur freigegebene, gültige', () => {
    const entries = supplementsFromBundle(CONTENT_BUNDLE.supplementFiles);
    expect(entries).toHaveLength(18);
    expect(entries.every((entry) => entry.status === 'draft')).toBe(true);
    const broken = { ...CONTENT_BUNDLE.supplementFiles[0]!, data: { id: 'kaputt' } };
    const archived = {
      ...CONTENT_BUNDLE.supplementFiles[1]!,
      data: { ...(CONTENT_BUNDLE.supplementFiles[1]!.data as object), status: 'archived' },
    };
    expect(supplementsFromBundle([broken, archived])).toEqual([]);
    const published = entries.map((entry) => ({
      ...entry,
      status: 'published' as const,
      meta: { ...entry.meta, reviewed_by: 'redaktion', reviewed_at: '2026-10-21' },
    }));
    expect(
      supplementsFromDbRows([
        ...published.map((data) => ({ data })),
        { data: { id: 'x' } },
        { data: entries[0] },
      ]),
    ).toHaveLength(18);
  });
});

describe('supplementSourceFromRows', () => {
  it('Einwilligung gültig (Fassung 2): Gesundheits-Check, Gewicht, Check und Tagebuch fließen ein', () => {
    const rows: UserRows = {
      ...planPersonRows({ flags: ['medication', 'conservative_plan'] }),
      bodyMetrics: [
        {
          id: 'b1',
          user_id: USER_ID,
          measured_on: '2026-09-01',
          height_cm: 180,
          weight_kg: 90,
          body_fat_pct: null,
          resting_heart_rate_bpm: null,
        },
        {
          id: 'b2',
          user_id: USER_ID,
          measured_on: '2026-10-01',
          height_cm: null,
          weight_kg: 82,
          body_fat_pct: null,
          resting_heart_rate_bpm: null,
        },
      ],
    };
    const screening = { answers: NO, flags: [], version: 1, updatedAt: NOW };
    const source = supplementSourceFromRows(rows, VERSIONS, TODAY, screening);
    expect(source).toMatchObject({
      validHealthConsentVersion: 2,
      healthFlags: ['medication', 'conservative_plan'],
      latestWeightKg: 82,
      screening,
      hasCompetition: false,
    });
    const recs = recommendSupplements(buildSupplementInputs(source!));
    expect(recs.personalized).toBe(true);
    expect(recs.items.find((item) => item.id === 'creatine')?.status).toBe('excluded');
  });

  it('nur alte Fassung (Testschalter) bzw. keine Einwilligung: keine Gesundheitsdaten, nur Info', () => {
    const rows = rowsWithOldHealthConsent(planPersonRows());
    expect(rows.consents.find((c) => c.consent_type === 'health_data')?.version).toBe(1);
    const old = supplementSourceFromRows(rows, VERSIONS, TODAY, null);
    expect(old).toMatchObject({
      validHealthConsentVersion: null,
      healthFlags: null,
      latestWeightKg: null,
      foodLog: [],
    });
    expect(recommendSupplements(buildSupplementInputs(old!)).personalized).toBe(false);
    const none = supplementSourceFromRows(
      planPersonRows({ consent: 'none' }),
      VERSIONS,
      TODAY,
      null,
    );
    expect(none?.validHealthConsentVersion).toBeNull();
  });

  it('Datenbank vor der Veröffentlichung (gültig ist Fassung 1): Info-Modus', () => {
    const rows: UserRows = {
      ...planPersonRows(),
      consents: [consent('terms'), consent('privacy'), consent('health_data', { version: 1 })],
    };
    const source = supplementSourceFromRows(rows, { ...VERSIONS, health_data: 1 }, TODAY, {
      answers: NO,
      flags: [],
      version: 1,
      updatedAt: NOW,
    });
    expect(source?.validHealthConsentVersion).toBe(1);
    expect(recommendSupplements(buildSupplementInputs(source!)).personalized).toBe(false);
  });

  it('Onboarding unvollständig → null; Wettkampf geplant → Doping-Hinweis', () => {
    expect(
      supplementSourceFromRows({ ...planPersonRows(), goals: null }, VERSIONS, TODAY, null),
    ).toBeNull();
    const rows = planPersonRows({ level: 'advanced' });
    const withCompetition = {
      ...rows,
      competitions: [{ status: 'planned' } as UserRows['competitions'][number]],
    };
    const source = supplementSourceFromRows(withCompetition, VERSIONS, TODAY, {
      answers: NO,
      flags: [],
      version: 1,
      updatedAt: NOW,
    });
    expect(source?.hasCompetition).toBe(true);
    const recs = recommendSupplements(buildSupplementInputs(source!));
    expect(recs.items.find((item) => item.id === 'creatine')?.notices).toContain('doping');
  });
});

describe('Testmodus: Supplement-Check und „Meine Supplements“ (gleiche Regeln wie die Datenbank)', () => {
  it('speichern mit Fassung 2; Flags rechnet der Speicherort; Auswahl; Export; Widerruf löscht', async () => {
    const { backend } = seededBackend(planPersonRows());
    expect(CURRENT_CONSENT_VERSIONS.health_data).toBe(2);
    const saved = await backend.saveSupplementScreening({
      kidney: true,
      heart_rhythm: false,
      caffeine_sensitive: false,
    });
    expect(saved.screening?.flags).toEqual(['kidney']);
    expect(saved.screening?.version).toBe(1);
    const chosen = await backend.setUserSupplement('omega3', 'taking');
    expect(chosen.choices).toEqual([{ supplementId: 'omega3', status: 'taking' }]);
    const exported = await backend.exportMyData();
    expect(exported.data.supplement_screening).toHaveLength(1);
    expect(exported.data.user_supplements).toEqual([
      { user_id: USER_ID, supplement_id: 'omega3', status: 'taking', updated_at: NOW },
    ]);
    await backend.revokeConsent('health_data');
    expect(await backend.loadSupplementUserData()).toEqual({ screening: null, choices: [] });
  });

  it('männlich: Stillzeit-Frage abgelehnt; fehlende Antwort abgelehnt (ohne Werte)', async () => {
    const { backend } = seededBackend(planPersonRows());
    await expect(backend.saveSupplementScreening({ ...NO })).rejects.toMatchObject({
      code: 'unknown',
      sensitive: true,
    });
    await expect(
      backend.saveSupplementScreening({ kidney: false, heart_rhythm: false } as never),
    ).rejects.toMatchObject({ code: 'unknown' });
  });

  it('nur alte Fassung bzw. ohne Einwilligung: Schreiben abgelehnt, Löschen geht, nichts geht verloren', async () => {
    const { backend } = seededBackend(planPersonRows());
    await backend.saveSupplementScreening({
      kidney: false,
      heart_rhythm: false,
      caffeine_sensitive: false,
    });
    await backend.simulateOldHealthConsent?.();
    const { rows } = await backend.loadRows();
    expect(rows.consents.find((c) => c.consent_type === 'health_data')?.version).toBe(1);
    // Kein Datenverlust durch die alte Fassung.
    expect((await backend.loadSupplementUserData()).screening).not.toBeNull();
    await expect(backend.setUserSupplement('creatine', 'taking')).rejects.toMatchObject({
      code: 'consent_required',
    });
    await expect(
      backend.saveSupplementScreening({
        kidney: false,
        heart_rhythm: false,
        caffeine_sensitive: false,
      }),
    ).rejects.toMatchObject({ code: 'consent_required' });
    // Erneut zustimmen → wieder schreibbar, Check ist noch da.
    await backend.grantConsents(['health_data'], VERSIONS);
    await expect(backend.setUserSupplement('creatine', 'taking')).resolves.toMatchObject({
      choices: [{ supplementId: 'creatine', status: 'taking' }],
    });
    await expect(backend.deleteSupplementData()).resolves.toEqual({ screening: null, choices: [] });
  });

  it('Koffein und Liste „Nicht empfohlen“ nie wählbar; Entfernen geht ohne Einwilligung', () => {
    const rows = planPersonRows();
    const base = { rows, versions: VERSIONS, userId: USER_ID, now: NOW };
    expect(() => applyUserSupplement([], { ...base, id: 'caffeine', status: 'taking' })).toThrow();
    expect(() => applyUserSupplement([], { ...base, id: 'bcaa', status: 'taking' })).toThrow();
    expect(() => applyUserSupplement([], { ...base, id: 'creatine', status: 'daily' })).toThrow();
    const records = applyUserSupplement([], { ...base, id: 'creatine', status: 'taking' });
    const noConsent = planPersonRows({ consent: 'none' });
    expect(
      applyUserSupplement(records, { ...base, rows: noConsent, id: 'creatine', status: null }),
    ).toEqual([]);
  });

  it('Übersicht im Testmodus mit echten Entwürfen: Kreatin passt (Muskelaufbau, alles „nein“)', async () => {
    const { backend } = seededBackend(planPersonRows());
    const data = await backend.saveSupplementScreening({
      kidney: false,
      heart_rhythm: false,
      caffeine_sensitive: false,
    });
    const { entries } = await backend.loadSupplementLibrary();
    const source = supplementSourceFromRows(planPersonRows(), VERSIONS, TODAY, data.screening);
    const overview = supplementOverview(
      recommendSupplements(buildSupplementInputs(source!)),
      entries,
      data,
    );
    expect(overview.groups.recommended.map((card) => card.id)).toContain('creatine');
    expect(overview.caffeine?.status).toBe('safety_info');
    expect(overview.notRecommended).toHaveLength(13);
  });
});
