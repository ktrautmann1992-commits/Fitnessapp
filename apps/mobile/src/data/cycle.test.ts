import { defaultCycleSettings, type CycleEntry } from '@fitnessapp/core';
import { describe, expect, it, vi } from 'vitest';

import type { Backend, SnapshotResult } from './backend';
import {
  attachCycle,
  CycleError,
  cycleBackendFor,
  cycleErrorCode,
  hasActiveCycleConsent,
  onCycleDeviceCleared,
  validCycleConsentGrantedAt,
  type CycleBackend,
} from './cycle-backend';
import { createLocalCycle, sampleCycleEntries } from './cycle-local';
import { createRemoteCycle } from './cycle-remote';
import { createMemoryProtectedStore } from './protected-store';
import type { ConsentRow } from './types';

const TODAY = '2026-10-21';
const GRANTED = '2026-10-01T08:00:00.123456+00:00';
const entry = (date: string, energy: number): CycleEntry => ({ date, payload: { energy } });

function consent(overrides: Partial<ConsentRow> = {}): ConsentRow {
  return {
    id: 'c1',
    user_id: 'u1',
    consent_type: 'cycle_data',
    version: 1,
    granted_at: GRANTED,
    revoked_at: null,
    platform: 'web',
    ...overrides,
  } as ConsentRow;
}

function stores() {
  return { cycleCache: createMemoryProtectedStore(), cycleQueue: createMemoryProtectedStore() };
}

describe('Einwilligung cycle_data (S5)', () => {
  it('gültig nur aktiv und in der aktuellen Version; der neueste Zeitpunkt zählt', () => {
    expect(validCycleConsentGrantedAt([consent()], 1)).toBe(GRANTED);
    expect(validCycleConsentGrantedAt([consent({ version: 1 })], 2)).toBeNull();
    expect(validCycleConsentGrantedAt([consent({ revoked_at: GRANTED })], 1)).toBeNull();
    expect(validCycleConsentGrantedAt([consent()], null)).toBeNull();
    expect(
      validCycleConsentGrantedAt([consent({ granted_at: '2026-10-02T00:00:00Z' }), consent()], 1),
    ).toBe('2026-10-02T00:00:00Z');
    expect(hasActiveCycleConsent([consent({ version: 1 })])).toBe(true);
    expect(hasActiveCycleConsent([consent({ consent_type: 'health_data' })])).toBe(false);
  });

  it('Fehlercodes nur aus festen Codes, nie mit Inhalt', () => {
    expect(cycleErrorCode('cycle_consent_outdated')).toBe('cycle_consent_outdated');
    expect(cycleErrorCode('Failed to fetch')).toBe('network');
    expect(cycleErrorCode('invalid input syntax for type integer: "3x"')).toBe('unknown');
    expect(new CycleError('cycle_payload_invalid').message).toBe(
      'CycleError: cycle_payload_invalid',
    );
  });
});

describe('Testmodus (cycle-local)', () => {
  it('speichert je Tag einen Eintrag, löscht einzeln und alle, Einstellungen bleiben', async () => {
    const s = stores();
    const cycle = createLocalCycle(s);
    await cycle.saveEntry(entry('2026-10-20', 2), GRANTED, TODAY);
    await cycle.saveEntry(entry('2026-10-20', 4), GRANTED, TODAY);
    await cycle.saveEntry(entry('2026-10-21', 3), GRANTED, TODAY);
    await cycle.saveSettings({ ...defaultCycleSettings(), status: 'natural' }, GRANTED);
    let snap = await cycle.load(TODAY);
    expect(snap.entries.map((e) => [e.date, e.payload.energy])).toEqual([
      ['2026-10-20', 4],
      ['2026-10-21', 3],
    ]);
    await cycle.deleteEntry('2026-10-20');
    expect((await cycle.load(TODAY)).entries).toHaveLength(1);
    await cycle.deleteAllEntries();
    snap = await cycle.load(TODAY);
    expect(snap.entries).toEqual([]);
    expect(snap.settings?.status).toBe('natural');
  });

  it('ohne Einwilligung kein Speichern; ungültige Einträge abgelehnt', async () => {
    const cycle = createLocalCycle(stores());
    await expect(cycle.saveEntry(entry(TODAY, 3), '', TODAY)).rejects.toMatchObject({
      code: 'cycle_consent_missing',
    });
    await expect(
      cycle.saveEntry({ date: TODAY, payload: {} }, GRANTED, TODAY),
    ).rejects.toMatchObject({ code: 'cycle_payload_invalid' });
  });

  it('Export als Tabellen cycle_settings/cycle_entries; Gerät leeren löscht alles', async () => {
    const s = stores();
    const cycle = createLocalCycle(s);
    expect(await cycle.exportTables()).toEqual({});
    await cycle.saveEntry(entry(TODAY, 3), GRANTED, TODAY);
    expect(await cycle.exportTables()).toEqual({
      cycle_entries: [{ entry_date: TODAY, energy: 3 }],
    });
    await cycle.clearDevice();
    expect(s.cycleCache.peek()).toBeNull();
  });

  it('Beispieldaten: 90 Tage mit Lücken, heute starke Blutung; „Warnungen aus“', async () => {
    const samples = sampleCycleEntries(TODAY);
    expect(samples.length).toBeLessThan(90);
    expect(samples.at(-1)).toMatchObject({ date: TODAY, payload: { bleeding: 'heavy' } });
    const cycle = createLocalCycle(stores());
    await cycle.testMode?.loadSampleData(TODAY);
    expect((await cycle.load(TODAY)).entries.length).toBe(samples.length);
    expect((await cycle.access()).warnings).toBe(true);
    await cycle.testMode?.setWarningsOff(true);
    expect(await cycle.access()).toEqual({ open: true, warnings: false });
  });
});

/** Attrappe des Supabase-Clients: rpc(name, args) → Antwort aus `handlers`. */
function fakeClient(
  handlers: Record<string, (args: Record<string, unknown> | undefined) => unknown>,
) {
  const calls: { name: string; args: Record<string, unknown> | undefined }[] = [];
  const client = {
    rpc(name: string, args?: Record<string, unknown>) {
      calls.push({ name, args });
      try {
        const handler = handlers[name];
        if (!handler) return Promise.resolve({ data: null, error: { message: 'unknown' } });
        return Promise.resolve({ data: handler(args), error: null });
      } catch (error) {
        if (error instanceof TypeError) return Promise.reject(error);
        return Promise.resolve({ data: null, error: { message: (error as Error).message } });
      }
    },
  };
  return { client: client as never, calls };
}

describe('Supabase-Modus (cycle-remote)', () => {
  it('ruft nur die Server-Funktionen per rpc (POST, ohne get) mit Datum als Text auf', async () => {
    const { client, calls } = fakeClient({ save_cycle_entry: () => ({ saved: TODAY }) });
    const s = stores();
    const cycle = createRemoteCycle({ client, stores: s });
    expect(await cycle.saveEntry(entry(TODAY, 2), GRANTED, TODAY)).toBe('saved');
    expect(calls).toEqual([
      {
        name: 'save_cycle_entry',
        args: { p_date: TODAY, p_payload: { energy: 2 }, p_consent_granted_at: GRANTED },
      },
    ]);
    expect(JSON.parse(s.cycleCache.peek() ?? '{}').entries).toEqual([entry(TODAY, 2)]);
  });

  it('offline: Warteschlange (je Datum der neueste) und Senden bei Verbindung', async () => {
    let online = false;
    const sent: unknown[] = [];
    const { client } = fakeClient({
      save_cycle_entry: (args) => {
        if (!online) throw new TypeError('Failed to fetch');
        sent.push(args);
        return { saved: true };
      },
      get_cycle_settings: () => null,
      get_cycle_entries: () => [],
    });
    const s = stores();
    const cycle = createRemoteCycle({ client, stores: s });
    expect(await cycle.saveEntry(entry(TODAY, 2), GRANTED, TODAY)).toBe('queued');
    expect(await cycle.saveEntry(entry(TODAY, 4), GRANTED, TODAY)).toBe('queued');
    expect(JSON.parse(s.cycleQueue.peek() ?? '[]')).toHaveLength(1);
    online = true;
    const snap = await cycle.load(TODAY);
    expect(sent).toHaveLength(1);
    expect(snap.pending).toBe(0);
    expect(s.cycleQueue.peek()).toBeNull();
  });

  it('veralteter Eintrag (andere Einwilligung) wird verworfen statt endlos gesendet (S5)', async () => {
    let attempts = 0;
    const { client } = fakeClient({
      save_cycle_entry: () => {
        attempts += 1;
        throw new Error('cycle_consent_outdated');
      },
      get_cycle_settings: () => null,
      get_cycle_entries: () => [],
    });
    const s = stores();
    s.cycleQueue.write(JSON.stringify([{ entry: entry(TODAY, 2), consentGrantedAt: GRANTED }]));
    const cycle = createRemoteCycle({ client, stores: s });
    await cycle.flush();
    await cycle.flush();
    expect(attempts).toBe(1);
    expect(s.cycleQueue.peek()).toBeNull();
  });

  it('Laden offline: Zwischenspeicher + Warteschlange, Kennzeichen offline', async () => {
    const { client } = fakeClient({
      get_cycle_settings: () => {
        throw new TypeError('Failed to fetch');
      },
      get_cycle_entries: () => {
        throw new TypeError('Failed to fetch');
      },
      save_cycle_entry: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const s = stores();
    s.cycleCache.write(
      JSON.stringify({ settings: null, entries: [entry('2026-10-19', 3)], access: null }),
    );
    const cycle = createRemoteCycle({ client, stores: s });
    await cycle.saveEntry(entry(TODAY, 1), GRANTED, TODAY);
    const snap = await cycle.load(TODAY);
    expect(snap.offline).toBe(true);
    expect(snap.pending).toBe(1);
    expect(snap.entries.map((e) => e.date)).toEqual(['2026-10-19', TODAY]);
  });

  it('Export: Tabellen aus export_my_cycle_data, Lesen mit 400 Tagen Zeitraum', async () => {
    const { client, calls } = fakeClient({
      export_my_cycle_data: () => ({
        settings: null,
        entries: [{ entry_date: TODAY, payload: { energy: 3 }, updated_at: 'x' }],
      }),
      get_cycle_settings: () => null,
      get_cycle_entries: () => [{ entry_date: TODAY, payload: { energy: 3 } }],
    });
    const cycle = createRemoteCycle({ client, stores: stores() });
    expect(await cycle.exportTables()).toEqual({
      cycle_entries: [{ entry_date: TODAY, energy: 3, updated_at: 'x' }],
    });
    await cycle.load(TODAY);
    expect(calls.find((c) => c.name === 'get_cycle_entries')?.args).toEqual({
      p_from: '2025-09-16',
      p_to: TODAY,
    });
  });
});

describe('attachCycle: Aufräumen und Export', () => {
  function fakeBackend(consents: ConsentRow[]) {
    const backend = {
      revokeConsent: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      deleteAccount: vi.fn(async () => undefined),
      clearDeviceData: vi.fn(async () => undefined),
      loadRows: vi.fn(
        async (): Promise<SnapshotResult> =>
          ({ rows: { consents }, offline: false }) as unknown as SnapshotResult,
      ),
      exportMyData: vi.fn(async () => ({
        format_version: 1,
        exported_at: 'x',
        user_id: 'u1',
        account: { email: null },
        data: { profiles: [] },
      })),
    };
    return backend as unknown as Backend;
  }
  function fakeCycle(): CycleBackend & { cleared: number } {
    const cycle = {
      ...createLocalCycle(stores()),
      cleared: 0,
      clearDevice: async () => {
        cycle.cleared += 1;
      },
      exportTables: async () => ({ cycle_entries: [{ entry_date: TODAY, energy: 3 }] }),
    };
    return cycle;
  }

  it('Widerruf cycle_data, Abmelden, Konto löschen, Gerätedaten löschen leeren die Zyklus-Speicher', async () => {
    const cycle = fakeCycle();
    const backend = attachCycle(fakeBackend([consent()]), cycle);
    const cleared = vi.fn();
    const off = onCycleDeviceCleared(cleared);
    expect(cycleBackendFor(backend)).toBe(cycle);
    await backend.revokeConsent('health_data');
    expect(cycle.cleared).toBe(0);
    await backend.revokeConsent('cycle_data');
    await backend.signOut();
    await backend.deleteAccount();
    await backend.clearDeviceData();
    expect(cycle.cleared).toBe(4);
    expect(cleared).toHaveBeenCalledTimes(4);
    off();
  });

  it('Laden ohne aktive Einwilligung (z. B. auf anderem Gerät widerrufen) leert – offline nicht', async () => {
    const cycle = fakeCycle();
    await attachCycle(fakeBackend([consent()]), cycle).loadRows();
    expect(cycle.cleared).toBe(0);
    await attachCycle(fakeBackend([consent({ revoked_at: GRANTED })]), cycle).loadRows();
    expect(cycle.cleared).toBe(1);
    const offline = fakeBackend([]);
    (offline.loadRows as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      rows: { consents: [] },
      offline: true,
    });
    await attachCycle(offline, cycle).loadRows();
    expect(cycle.cleared).toBe(1);
  });

  it('Datenexport enthält die Zyklus-Tabellen', async () => {
    const file = await attachCycle(fakeBackend([consent()]), fakeCycle()).exportMyData();
    expect(file.data['cycle_entries']).toEqual([{ entry_date: TODAY, energy: 3 }]);
    expect(file.data['profiles']).toEqual([]);
  });
});
