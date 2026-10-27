import { readFileSync } from 'node:fs';

import { loadWeeksBeforeDeload, startOfIsoWeek, toSavePlanPayload } from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it, vi } from 'vitest';

import { planPersonRows, USER_ID, VERSIONS } from '../test/fixtures';
import type { Backend } from './backend';
import { createMemoryStore, readJson, STORAGE_KEYS, writeJson } from './kv';
import { seedTrainingLogs } from '../../e2e/live-adjust-helpers';
import { activePlanAdjustments, followUpAdjustments, stateOverridesFor } from './live-adjust';
import { applyFewerDays } from './live-adjust-fewer-days';
import { requestLiveAdjustment } from './live-adjust-remote';
import { createLocalBackend } from './local-backend';
import { createMemoryProtectedStore, type ProtectedStore } from './protected-store';
import { createSupabaseBackend } from './supabase-backend';
import {
  activePlan,
  effectiveSafetyRules,
  generatePlanFromRows,
  nextBlockFromRows,
} from './training-plan';
import type { SessionLogRow, UserRows } from './types';

/**
 * Live-Anpassung im Testmodus (Phase 4b, Etappe D, docs/PLAN-PHASE-4B.md 8.1–8.4 und DoD D): Reihenfolge nach dem
 * Sync, Anpassungen nur im geschützten Speicher, Widerruf leert sie, Schalter nur im Testmodus (K2), Folgeblock nach
 * `deload_forward` mit höchstens L Belastungswochen in Folge, ohne EXPO_PUBLIC_WEB_URL kein Aufruf.
 * Person wie „Ben“ der CI-Beispiele: Einsteiger, Studio Mo/Mi/Fr, Plan ab Montag 05.10.2026.
 */

const MONDAY = '2026-10-05';

interface Device {
  store: ReturnType<typeof createMemoryStore>;
  live: ReturnType<typeof createMemoryProtectedStore>;
}

function backendOn(device: Device, today: string): Backend {
  let counter = 0;
  return createLocalBackend(device.store, {
    platform: 'web',
    today: () => today,
    now: () => `${today}T19:00:00.000Z`,
    newId: () => `id-${today}-${++counter}`,
    draftStore: createMemoryProtectedStore(),
    liveAdjustStore: device.live,
  });
}

async function setup(): Promise<Device> {
  const person = planPersonRows();
  const device: Device = {
    store: createMemoryStore({
      [STORAGE_KEYS.localDb]: JSON.stringify({
        session: { userId: USER_ID, email: null },
        rows: person,
      }),
    }),
    live: createMemoryProtectedStore(),
  };
  const backend = backendOn(device, MONDAY);
  const library = await backend.loadPlanLibrary({ allowCached: false });
  if (!library) throw new Error('Bibliothek fehlt');
  const result = generatePlanFromRows(person, VERSIONS, library, MONDAY);
  if (!result.ok) throw new Error(result.error);
  await backend.savePlan(toSavePlanPayload(result.plan), person);
  return device;
}

/** Kraft-Einheiten im Zeitraum mit Belastung `rpe` eintragen (direkt in den Gerätespeicher, wie save_session_log). */
async function logStrength(device: Device, from: string, to: string, rpe: number) {
  const db = await readJson<{ rows: UserRows }>(device.store, STORAGE_KEYS.localDb);
  if (!db) throw new Error('Gerätespeicher leer');
  const rows = db.rows;
  const planned = rows.plannedSessions.filter(
    (s) =>
      s.kind === 'strength' && s.scheduled_on >= from && s.scheduled_on <= to && s.week_no >= 1,
  );
  const logs: SessionLogRow[] = planned.map((s) => ({
    id: `log-${s.id}`,
    user_id: USER_ID,
    planned_session_id: s.id,
    kind: 'strength',
    performed_on: s.scheduled_on,
    started_at: null,
    finished_at: `${s.scheduled_on}T18:00:00Z`,
    status: 'completed',
    session_rpe: rpe,
    notes: null,
    name_de: s.name_de,
    is_intro_week: s.is_intro_week,
    is_deload: s.is_deload,
    from_health_plan: true,
    is_free: false,
    revision: 1,
    last_write_id: `w-${s.id}`,
    source: 'manual',
    client_updated_at: `${s.scheduled_on}T18:00:00Z`,
    created_at: `${s.scheduled_on}T18:00:00Z`,
    updated_at: `${s.scheduled_on}T18:00:00Z`,
    sport: null,
    sport_duration_s: null,
    sport_distance_m: null,
    hyrox_splits: null,
  }));
  const ids = new Set(planned.map((s) => s.id));
  await writeJson(device.store, STORAGE_KEYS.localDb, {
    ...db,
    rows: {
      ...rows,
      sessionLogs: [...rows.sessionLogs, ...logs],
      plannedSessions: rows.plannedSessions.map((s) =>
        ids.has(s.id) ? { ...s, status: 'completed' } : s,
      ),
    },
  });
  return planned.length;
}

/** Längste Folge von Belastungswochen (ohne Woche 0, Erholungswochen beenden die Folge). */
function longestLoadRun(
  sessions: readonly { scheduled_on: string; week_no: number; is_deload: boolean }[],
) {
  const weeks = new Map<string, { deload: boolean; zero: boolean }>();
  for (const s of sessions) {
    const monday = startOfIsoWeek(s.scheduled_on);
    const w = weeks.get(monday) ?? { deload: true, zero: true };
    weeks.set(monday, { deload: w.deload && s.is_deload, zero: w.zero && s.week_no === 0 });
  }
  let run = 0;
  let best = 0;
  for (const [, w] of [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (w.zero) continue;
    run = w.deload ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

describe('Testmodus: Live-Anpassung nur mit Schalter „Live-Anpassung einschalten“ (Standard an)', () => {
  it('Schalter aus passiert nichts (Gratis unverändert): keine Anpassung, gleicher Plan', async () => {
    const device = await setup();
    expect(await logStrength(device, '2026-10-12', '2026-10-16', 9)).toBe(3);
    const backend = backendOn(device, '2026-10-16');
    // Testphase „alles offen“: Standard AN – der Gratis-Weg braucht den ausdrücklich ausgeschalteten Schalter.
    await backend.liveAdjust?.setSimulatePremium(false);
    expect(await backend.liveAdjust?.simulatePremium()).toBe(false);
    const before = await readJson<{ rows: UserRows }>(device.store, STORAGE_KEYS.localDb);
    const { rows } = await backend.loadRows();
    expect(await backend.liveAdjust?.adjustments()).toEqual([]);
    expect(device.live.peek()).toBeNull();
    expect(rows.plannedExercises).toEqual(before?.rows.plannedExercises);
  });

  it('Testphase „alles offen“ (KONZEPT 13): ohne gespeicherten Schalter gilt AN – Anpassung beim Laden', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    const backend = backendOn(device, '2026-10-16');
    expect(
      (await readJson<{ simulatePremium?: boolean }>(device.store, STORAGE_KEYS.localDb))
        ?.simulatePremium,
    ).toBeUndefined();
    expect(await backend.liveAdjust?.simulatePremium()).toBe(true);
    const { liveAdjust } = await backend.loadRows();
    expect(liveAdjust?.simulatePremium).toBe(true);
    expect((await backend.liveAdjust?.adjustments())?.map((a) => a.rule)).toEqual([
      'volume_reduce',
    ]);
  });

  it('nach dem Sync (Laden) bzw. Einschalten: Sätze −1 nächste Woche; NUR im geschützten Speicher', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    const backend = backendOn(device, '2026-10-16');
    await backend.liveAdjust?.setSimulatePremium(true);
    const list = (await backend.liveAdjust?.adjustments()) ?? [];
    expect(list.map((a) => [a.rule, a.status])).toEqual([['volume_reduce', 'applied']]);
    // Geschützter Speicher hat die Anpassung, der normale Gerätespeicher nicht (nur den Schalter).
    expect(device.live.peek()).toContain('volume_reduce');
    const raw = JSON.stringify(device.store.dump());
    expect(raw).not.toContain('volume_reduce');
    expect(raw).not.toContain('inputFingerprint');
    expect(
      (await readJson<{ simulatePremium?: boolean }>(device.store, STORAGE_KEYS.localDb))
        ?.simulatePremium,
    ).toBe(true);
    // Der gespeicherte Plan bleibt; angezeigt wird er mit einem Satz weniger in der Woche ab 19.10.
    const stored = (await readJson<{ rows: UserRows }>(device.store, STORAGE_KEYS.localDb))?.rows;
    const { rows } = await backend.loadRows();
    const week = rows.plannedSessions.filter(
      (s) =>
        s.kind === 'strength' && s.scheduled_on >= '2026-10-19' && s.scheduled_on <= '2026-10-25',
    );
    expect(week.length).toBeGreaterThan(0);
    for (const s of week) {
      const shown = rows.plannedExercises.filter((e) => e.session_id === s.id);
      const base = stored?.plannedExercises.filter((e) => e.session_id === s.id) ?? [];
      expect(shown.map((e) => e.sets)).toEqual(base.map((e) => Math.max(1, e.sets - 1)));
    }
    // Gleiche Lage → keine zweite Anpassung (Idempotenz).
    await backend.loadRows();
    expect((await backend.liveAdjust?.adjustments())?.length).toBe(1);
  });

  it('Rückgängig stellt den Plan wieder her; Widerruf health_data leert den geschützten Speicher', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    const backend = backendOn(device, '2026-10-16');
    await backend.liveAdjust?.setSimulatePremium(true);
    const [adjustment] = (await backend.liveAdjust?.adjustments()) ?? [];
    if (!adjustment) throw new Error('Anpassung fehlt');
    expect(await backend.liveAdjust?.revert(adjustment.id)).toBe('reverted');
    expect((await backend.liveAdjust?.adjustments())?.[0]?.status).toBe('reverted');
    const stored = (await readJson<{ rows: UserRows }>(device.store, STORAGE_KEYS.localDb))?.rows;
    expect((await backend.loadRows()).rows.plannedExercises).toEqual(stored?.plannedExercises);
    // Zurückgenommene Lage feuert nicht erneut.
    expect((await backend.liveAdjust?.adjustments())?.length).toBe(1);

    await backend.revokeConsent('health_data');
    expect(device.live.peek()).toBeNull();
    expect(await backend.liveAdjust?.adjustments()).toEqual([]);
  });

  it('zweimal in Folge → Erholungswoche vorgezogen; Folgeblock hält höchstens L Belastungswochen in Folge', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    await backendOn(device, '2026-10-16').liveAdjust?.setSimulatePremium(true);
    await logStrength(device, '2026-10-19', '2026-10-23', 9);
    const backend = backendOn(device, '2026-10-23');
    const { rows } = await backend.loadRows();
    const list = (await backend.liveAdjust?.adjustments()) ?? [];
    expect(list.map((a) => a.rule)).toEqual(['volume_reduce', 'deload_forward']);
    const active = activePlan(rows);
    const library = await backend.loadPlanLibrary({ allowCached: false });
    const rules = effectiveSafetyRules(rows, VERSIONS, '2026-10-23');
    if (!active || !library || !rules) throw new Error('Plan fehlt');
    const L = loadWeeksBeforeDeload('beginner', rules.cautious);
    // Vorgezogene Erholungswoche ab 26.10.
    expect(
      active.sessions
        .filter((s) => s.scheduled_on >= '2026-10-26' && s.scheduled_on <= '2026-11-01')
        .every((s) => s.is_deload),
    ).toBe(true);
    const next = nextBlockFromRows(
      rows,
      active,
      rules,
      library,
      '2026-10-23',
      activePlanAdjustments(rows, list),
    );
    if (!next) throw new Error('Folgeblock fehlt');
    expect(longestLoadRun([...active.sessions, ...next])).toBeLessThanOrEqual(L);
    // Gegenprobe: ohne Anpassungen (carriedLoadWeeks fehlt) wären es mehr als L in Folge.
    const plain = nextBlockFromRows(rows, active, rules, library, '2026-10-23');
    expect(longestLoadRun([...active.sessions, ...(plain ?? [])])).toBeGreaterThan(L);
  });

  it('ohne Schalter keine Zustands-Vorgabe in der Anzeige (stateOverridesFor leer)', async () => {
    const device = await setup();
    const { rows } = await backendOn(device, '2026-10-16').loadRows();
    expect(stateOverridesFor(rows, []).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Supabase-Modus: kein Schalter (K2), Aufruf der Route nur vorbereitet
// ---------------------------------------------------------------------------------------------------------

function fakeClient(status: unknown) {
  const calls: string[] = [];
  const thenable = (table: string): unknown =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            const data = table === 'rpc:live_adjustment_status' ? status : null;
            return (resolve: (v: unknown) => void) => resolve({ data, error: null });
          }
          return () => thenable(table);
        },
      },
    );
  const client = {
    from: (table: string) => {
      calls.push(table);
      return thenable(table);
    },
    rpc: (name: string) => {
      calls.push(`rpc:${name}`);
      return thenable(`rpc:${name}`);
    },
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: USER_ID, email: 'a@b.de' }, access_token: 'token' } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
  return { client: client as unknown as AppSupabaseClient, calls };
}

// ---------------------------------------------------------------------------------------------------------
// Wächter-Auflagen Etappe D
// ---------------------------------------------------------------------------------------------------------

/** Vorschlag „weniger Trainingstage“ (4 von 9 Einheiten in drei Wochen) am Montag 02.11. */
async function fewerDaysSetup() {
  const device = await setup();
  const raw = await device.store.getItem(STORAGE_KEYS.localDb);
  await device.store.setItem(
    STORAGE_KEYS.localDb,
    seedTrainingLogs(
      raw ?? '',
      ['2026-10-12', '2026-10-19', '2026-10-26', '2026-10-28'].map((date) => ({
        date,
        sessionRpe: 7,
        exercises: [],
      })),
    ),
  );
  const backend = backendOn(device, '2026-11-02');
  await backend.liveAdjust?.setSimulatePremium(true);
  const { rows } = await backend.loadRows();
  const proposal = (await backend.liveAdjust?.adjustments())?.find((a) => a.rule === 'fewer_days');
  if (!proposal) throw new Error('Vorschlag fehlt');
  return { device, backend, rows, proposal };
}

const weekdays = (rows: UserRows) => rows.trainingSlots.map((s) => s.weekday);

describe('M1: „Umstellen“ bleibt nie halb hängen', () => {
  it('Erfolg: neue Tage, neuer Plan, Vorschlag bestätigt, Tagebuch bleibt', async () => {
    const { backend, rows, proposal } = await fewerDaysSetup();
    const outcome = await applyFewerDays(backend, {
      rows,
      versions: VERSIONS,
      proposal,
      dropWeekday: 3,
      today: '2026-11-02',
    });
    expect(outcome).toMatchObject({ ok: true, days: 2 });
    const after = (await backend.loadRows()).rows;
    expect(weekdays(after)).toEqual([1, 5]);
    expect(after.plans.map((p) => p.status).sort()).toEqual(['active', 'replaced']);
    expect(after.sessionLogs).toHaveLength(rows.sessionLogs.length);
    expect(
      (await backend.liveAdjust?.adjustments())?.find((a) => a.id === proposal.id)?.status,
    ).toBe('confirmed');
  });

  it('Plan lässt sich nicht erzeugen → Trainingstage und Plan unverändert, Vorschlag offen', async () => {
    const { backend, rows, proposal } = await fewerDaysSetup();
    const library = await backend.loadPlanLibrary({ allowCached: false });
    const failing: Backend = {
      ...backend,
      loadPlanLibrary: async () => (library ? { ...library, templates: [] } : null),
    };
    const outcome = await applyFewerDays(failing, {
      rows,
      versions: VERSIONS,
      proposal,
      dropWeekday: 5,
      today: '2026-11-02',
    });
    expect(outcome).toMatchObject({ ok: false, code: 'no_template', rows: null });
    const after = (await backend.loadRows()).rows;
    expect(weekdays(after)).toEqual([1, 3, 5]);
    expect(after.plans).toEqual(rows.plans);
    expect(
      (await backend.liveAdjust?.adjustments())?.find((a) => a.id === proposal.id)?.status,
    ).toBe('pending_confirmation');
  });

  it('Plan speichern scheitert → alte Trainingstage zurückgeschrieben', async () => {
    const { backend, rows, proposal } = await fewerDaysSetup();
    const failing: Backend = {
      ...backend,
      savePlan: async () => {
        throw new Error('kaputt');
      },
    };
    const outcome = await applyFewerDays(failing, {
      rows,
      versions: VERSIONS,
      proposal,
      dropWeekday: 5,
      today: '2026-11-02',
    });
    expect(outcome.ok).toBe(false);
    expect(weekdays((await backend.loadRows()).rows)).toEqual([1, 3, 5]);
  });

  it('Basis passt nicht mehr (Tage inzwischen geändert) bzw. abgelaufen → nichts geändert', async () => {
    const { backend, rows, proposal } = await fewerDaysSetup();
    const twoDays = { ...rows, trainingSlots: rows.trainingSlots.slice(0, 2) };
    expect(
      await applyFewerDays(backend, {
        rows: twoDays,
        versions: VERSIONS,
        proposal,
        dropWeekday: 1,
        today: '2026-11-02',
      }),
    ).toMatchObject({ ok: false, code: 'expired', rows: null });
    expect(
      await applyFewerDays(backend, {
        rows,
        versions: VERSIONS,
        proposal,
        dropWeekday: 5,
        today: '2026-12-01',
      }),
    ).toMatchObject({ ok: false, code: 'expired', rows: null });
    expect(weekdays((await backend.loadRows()).rows)).toEqual([1, 3, 5]);
  });
});

describe('M2: Lesefehler im geschützten Speicher blockiert das Backend nie', () => {
  it('werfender Speicher → Laden, Training-Anzeige und Rechnen laufen weiter (ursprünglicher Plan)', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    const broken: ProtectedStore = {
      kind: 'memory',
      read: async () => {
        throw new Error('gesperrt');
      },
      write: async () => {
        throw new Error('gesperrt');
      },
      clear: async () => {
        throw new Error('gesperrt');
      },
    };
    const backend = createLocalBackend(device.store, {
      platform: 'web',
      today: () => '2026-10-16',
      now: () => '2026-10-16T19:00:00.000Z',
      newId: () => 'x',
      liveAdjustStore: broken,
    });
    await backend.liveAdjust?.setSimulatePremium(true);
    const stored = (await readJson<{ rows: UserRows }>(device.store, STORAGE_KEYS.localDb))?.rows;
    const result = await backend.loadRows();
    expect(result.rows.plannedExercises).toEqual(stored?.plannedExercises);
    expect(result.liveAdjust?.adjustments).toEqual([]);
    await backend.revokeConsent('health_data');
    await backend.signOut();
  });
});

describe('M4: Folgeblock nur mit sicherem Stand der Anpassungen', () => {
  it('loadRows liefert die Anpassungen im selben Schritt; unbekannter Stand → kein Folgeblock', async () => {
    const device = await setup();
    await logStrength(device, '2026-10-12', '2026-10-16', 9);
    const backend = backendOn(device, '2026-10-16');
    await backend.liveAdjust?.setSimulatePremium(true);
    const result = await backend.loadRows();
    expect(result.liveAdjust?.adjustments.map((a) => a.rule)).toEqual(['volume_reduce']);
    const live = { available: true, adjustments: result.liveAdjust?.adjustments ?? [] };
    expect(followUpAdjustments(result.rows, { ...live, status: 'ready' })?.length).toBe(1);
    expect(followUpAdjustments(result.rows, { ...live, status: 'loading' })).toBeNull();
    expect(followUpAdjustments(result.rows, { ...live, status: 'error' })).toBeNull();
    // Ohne Live-Anpassung (Supabase bis B/C): Gratis-Folgeblock.
    expect(
      followUpAdjustments(result.rows, { available: false, status: 'loading', adjustments: [] }),
    ).toEqual([]);
  });
});

describe('N3/N5: Export, Abmelden, Konto löschen, Testdaten löschen', () => {
  it('Export enthält die Anpassungen; Abmelden/Konto löschen/Testdaten löschen leeren den Speicher', async () => {
    for (const action of ['signOut', 'deleteAccount', 'clearDeviceData'] as const) {
      const device = await setup();
      await logStrength(device, '2026-10-12', '2026-10-16', 9);
      const backend = backendOn(device, '2026-10-16');
      await backend.liveAdjust?.setSimulatePremium(true);
      expect(device.live.peek()).toContain('volume_reduce');
      if (action === 'signOut') {
        const file = await backend.exportMyData();
        expect(JSON.stringify(file.data['plan_adjustments'])).toContain('volume_reduce');
      }
      await backend[action]();
      expect(device.live.peek()).toBeNull();
    }
  });
});

describe('Supabase-Modus (bis Etappe B/C ausgeblendet)', () => {
  it('K2: kein Schalter „Premium simulieren“, keine Live-Anpassung im Supabase-Backend', () => {
    const { client } = fakeClient(null);
    const backend = createSupabaseBackend({
      client,
      store: createMemoryStore(),
      platform: 'web',
      now: () => '2026-10-16T10:00:00.000Z',
      newId: () => 'x',
    });
    expect(backend.liveAdjust).toBeUndefined();
    expect('liveAdjust' in backend).toBe(false);
    const source = readFileSync(new URL('./supabase-backend.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/simulatePremium|liveAdjustStore|recomputeLive/);
    // Der Testmodus hat ihn.
    expect(
      backendOn({ store: createMemoryStore(), live: createMemoryProtectedStore() }, MONDAY)
        .liveAdjust,
    ).toBeDefined();
  });

  it('Reihenfolge nach dem Sync (8.2): … → close_missed_sessions → Status → POST /api/live-anpassung', async () => {
    const { client, calls } = fakeClient({ active: true, reason: 'ok' });
    const fetchFn = vi.fn(async (url: string) => {
      calls.push(`POST ${url}`);
      return new Response(null, { status: 200 });
    });
    const backend = createSupabaseBackend({
      client,
      store: createMemoryStore(),
      platform: 'web',
      now: () => '2026-10-16T10:00:00.000Z',
      newId: () => 'x',
      webUrl: 'https://web.example',
      fetchFn: fetchFn as unknown as typeof fetch,
      liveAdjustServer: true,
    });
    await backend.flush();
    const close = calls.indexOf('rpc:close_missed_sessions');
    expect(close).toBeGreaterThanOrEqual(0);
    expect(calls.slice(close)).toEqual([
      'rpc:close_missed_sessions',
      'rpc:live_adjustment_status',
      'POST https://web.example/api/live-anpassung',
    ]);
  });

  it('ohne EXPO_PUBLIC_WEB_URL kein Aufruf; ohne Freigabe (Standard bis B/C) kein Aufruf', async () => {
    const fetchFn = vi.fn();
    for (const options of [
      { webUrl: null, liveAdjustServer: true },
      { webUrl: 'https://web.example' },
    ]) {
      const { client, calls } = fakeClient({ active: true, reason: 'ok' });
      const backend = createSupabaseBackend({
        client,
        store: createMemoryStore(),
        platform: 'web',
        now: () => '2026-10-16T10:00:00.000Z',
        newId: () => 'x',
        fetchFn: fetchFn as unknown as typeof fetch,
        ...options,
      });
      await backend.flush();
      expect(calls).toContain('rpc:close_missed_sessions');
      expect(calls).not.toContain('rpc:live_adjustment_status');
    }
    expect(fetchFn).not.toHaveBeenCalled();
    const { client } = fakeClient({ active: true, reason: 'ok' });
    expect(await requestLiveAdjustment({ client, webUrl: null, fetchFn })).toBe('skipped');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('Status inaktiv (flag_off) → kein POST; Fehler sind still', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 429 }));
    const off = fakeClient({ active: false, reason: 'flag_off' });
    expect(
      await requestLiveAdjustment({ client: off.client, webUrl: 'https://w.example', fetchFn }),
    ).toBe('skipped');
    expect(fetchFn).not.toHaveBeenCalled();
    const on = fakeClient({ active: true, reason: 'ok' });
    expect(
      await requestLiveAdjustment({ client: on.client, webUrl: 'https://w.example', fetchFn }),
    ).toBe('failed');
  });
});
