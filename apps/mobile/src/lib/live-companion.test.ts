import {
  DEFAULT_LIVE_SETTINGS,
  liveTokenFromBytes,
  pauseRecording,
  startRecording,
} from '@fitnessapp/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Backend } from '@/data/backend';
import {
  attachLive,
  createDemoLive,
  createRemoteLive,
  defaultContact,
  type LiveCompanionBackend,
  LiveError,
  liveErrorFrom,
  readLiveDeviceData,
  writeLiveDeviceData,
} from '@/data/live-companion';
import { createMemoryProtectedStore } from '@/data/protected-store';

import { contactFromDraft, emptyContactDraft } from './live-contacts';
import {
  liveCompanion,
  liveUrlFor,
  restoreLiveCompanion,
  startLiveCompanion,
} from './live-companion';
import { recordingSession } from './recording-session';

const TOKEN = liveTokenFromBytes(new Uint8Array(32).fill(7));
const SESSION_ID = '0b7c2f7e-3e1f-4f55-9a3b-1c2d3e4f5a6b';
const WEB = 'https://web.example';

function fakeBackend(): Backend {
  return {
    mode: 'remote',
    signOut: vi.fn(async () => undefined),
    deleteAccount: vi.fn(async () => undefined),
    clearDeviceData: vi.fn(async () => undefined),
  } as unknown as Backend;
}

/** Live-Schnittstelle, die alle Aufrufe mitschreibt (wie die Datenbank, aber im Speicher). */
function recordingLive(overrides: Partial<LiveCompanionBackend> = {}) {
  const calls: { fn: string; args: unknown[] }[] = [];
  const live: LiveCompanionBackend = {
    mode: 'remote',
    start: async (input) => {
      calls.push({ fn: 'start', args: [input] });
      return {
        id: SESSION_ID,
        token: TOKEN,
        startedAt: new Date().toISOString(),
        plannedEndAt: new Date(Date.now() + 3_600_000).toISOString(),
        expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      };
    },
    push: async (id, position) => {
      calls.push({ fn: 'push', args: [id, position] });
      return 'ok';
    },
    setStatus: async (id, status) => {
      calls.push({ fn: 'status', args: [id, status] });
    },
    rotate: async (id) => {
      calls.push({ fn: 'rotate', args: [id] });
      return {
        id,
        token: liveTokenFromBytes(new Uint8Array(32).fill(9)),
        startedAt: new Date().toISOString(),
        plannedEndAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      };
    },
    ...overrides,
  };
  return { live, calls };
}

function setup(live: LiveCompanionBackend) {
  const backend = fakeBackend();
  const contactsStore = createMemoryProtectedStore();
  const sessionStore = createMemoryProtectedStore();
  attachLive(backend, { live, contactsStore, sessionStore, webUrl: WEB });
  return { backend, contactsStore, sessionStore };
}

function beginRecording(id = 'rec-1', now = Date.now()) {
  recordingSession.begin(
    {
      mode: 'gps',
      diaryLogId: null,
      state: startRecording({ id, ownerUserId: 'u', sport: 'run', now: now - 60_000 }),
    },
    async () => undefined,
  );
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(async () => {
  await liveCompanion.clear();
  await recordingSession.reset();
  vi.useRealTimers();
});

describe('Live-Begleitung: Start nur während einer Aufzeichnung', () => {
  it('ohne laufende Aufzeichnung kein Start', async () => {
    const { live, calls } = recordingLive();
    const { backend } = setup(live);
    await expect(
      startLiveCompanion({
        backend,
        sport: 'run',
        displayName: 'Karsten',
        contactIds: [],
        plannedMinutes: 60,
        intervalS: 30,
        noSignOfLifeMin: null,
        replace: false,
      }),
    ).rejects.toBeInstanceOf(LiveError);
    expect(calls).toEqual([]);
  });

  it('Start → Link mit Token im Fragment; Position gedrosselt; Pause; Speichern beendet automatisch', async () => {
    const { live, calls } = recordingLive();
    const { backend, sessionStore } = setup(live);
    beginRecording();
    const state = await startLiveCompanion({
      backend,
      sport: 'run',
      displayName: ' Karsten ',
      contactIds: ['k1'],
      plannedMinutes: 2,
      intervalS: 30,
      noSignOfLifeMin: 30,
      replace: false,
    });
    expect(state.url).toBe(`${WEB}/begleitung#t=${TOKEN}`);
    expect(state.displayName).toBe('Karsten');
    expect(state.plannedMinutes).toBe(5); // auf 5–720 begrenzt
    expect(calls[0]?.args[0]).toMatchObject({
      displayName: 'Karsten',
      sport: 'run',
      replace: false,
    });
    // Gesichert (für Neustart), verschlüsselter Speicher.
    expect(await sessionStore.read()).toContain(SESSION_ID);

    const t0 = Date.now();
    recordingSession.addPoints([{ lat: 50.941334567, lng: 6.958284444, t: t0, accuracyM: 7.6 }]);
    await flush();
    const pushes = () => calls.filter((c) => c.fn === 'push');
    expect(pushes()).toHaveLength(1);
    expect(pushes()[0]?.args[1]).toEqual({
      lat: 50.94133,
      lon: 6.95828,
      accuracyM: 8,
      recordedAt: new Date(t0).toISOString(),
    });
    // Gleich danach: gedrosselt (Intervall 30 s).
    recordingSession.addPoints([{ lat: 50.95, lng: 6.96, t: t0 + 1000, accuracyM: 5 }]);
    await flush();
    expect(pushes()).toHaveLength(1);

    // Pause der Aufzeichnung → „pausiert“.
    recordingSession.update((s) => pauseRecording(s, Date.now()));
    await flush();
    expect(calls.filter((c) => c.fn === 'status').map((c) => c.args[1])).toEqual(['paused']);
    expect(liveCompanion.get()?.status).toBe('paused');

    // Aufzeichnung gespeichert/verworfen → Begleitung endet, lokaler Stand weg.
    await recordingSession.reset();
    await flush();
    await flush();
    expect(calls.filter((c) => c.fn === 'status').map((c) => c.args[1])).toEqual([
      'paused',
      'ended',
    ]);
    expect(liveCompanion.get()).toBeNull();
    expect(await sessionStore.read()).toBeNull();
  });

  it('„Angekommen“ mit einem Tipp; danach keine Positionen mehr', async () => {
    const { live, calls } = recordingLive();
    const { backend } = setup(live);
    beginRecording();
    await startLiveCompanion({
      backend,
      sport: 'bike',
      displayName: 'Anna',
      contactIds: [],
      plannedMinutes: 60,
      intervalS: 15,
      noSignOfLifeMin: null,
      replace: false,
    });
    await liveCompanion.setStatus('arrived');
    expect(calls.filter((c) => c.fn === 'status').map((c) => c.args[1])).toEqual(['arrived']);
    expect(liveCompanion.get()).toBeNull();
    recordingSession.addPoints([{ lat: 50, lng: 7, t: Date.now(), accuracyM: 5 }]);
    await flush();
    expect(calls.filter((c) => c.fn === 'push')).toHaveLength(0);
  });

  it('Abschluss offline: bleibt gesichert und wird nachgereicht', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    let fail = true;
    const { live, calls } = recordingLive({
      setStatus: async (id, status) => {
        calls.push({ fn: 'status', args: [id, status] });
        if (fail) throw new LiveError('offline');
      },
    });
    const { backend, sessionStore } = setup(live);
    beginRecording();
    await startLiveCompanion({
      backend,
      sport: 'run',
      displayName: 'K',
      contactIds: [],
      plannedMinutes: 60,
      intervalS: 30,
      noSignOfLifeMin: null,
      replace: false,
    });
    await liveCompanion.setStatus('ended');
    expect(liveCompanion.get()?.synced).toBe(false);
    expect(await sessionStore.read()).toContain('"status":"ended"');
    fail = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(liveCompanion.get()).toBeNull();
    expect(calls.filter((c) => c.fn === 'status')).toHaveLength(2);
  });

  it('Link neu erzeugen: neue Adresse', async () => {
    const { live } = recordingLive();
    const { backend } = setup(live);
    beginRecording();
    const first = await startLiveCompanion({
      backend,
      sport: 'run',
      displayName: 'K',
      contactIds: [],
      plannedMinutes: 60,
      intervalS: 30,
      noSignOfLifeMin: null,
      replace: false,
    });
    const url = await liveCompanion.rotate();
    expect(url).not.toBe(first.url);
    expect(liveCompanion.get()?.url).toBe(url);
  });

  it('Neustart ohne laufende Aufzeichnung: gesicherte Begleitung wird sofort beendet', async () => {
    const { live, calls } = recordingLive();
    const { backend, sessionStore } = setup(live);
    beginRecording();
    await startLiveCompanion({
      backend,
      sport: 'run',
      displayName: 'K',
      contactIds: [],
      plannedMinutes: 60,
      intervalS: 30,
      noSignOfLifeMin: null,
      replace: false,
    });
    const saved = await sessionStore.read();
    // App-Neustart nachstellen: Speicher bleibt, Arbeitsspeicher leer, keine Aufzeichnung.
    await liveCompanion.clear();
    await recordingSession.reset();
    await sessionStore.write(saved ?? '');
    calls.length = 0;
    await restoreLiveCompanion(backend);
    await flush();
    expect(calls.map((c) => [c.fn, c.args[1]])).toEqual([['status', 'ended']]);
    expect(liveCompanion.get()).toBeNull();
  });

  it('Abmelden beendet die Begleitung und löscht Kontakte vom Gerät', async () => {
    const { live, calls } = recordingLive();
    const { backend, contactsStore } = setup(live);
    await contactsStore.write('{"v":1}');
    beginRecording();
    await startLiveCompanion({
      backend,
      sport: 'walk',
      displayName: 'K',
      contactIds: [],
      plannedMinutes: 60,
      intervalS: 30,
      noSignOfLifeMin: null,
      replace: false,
    });
    await backend.signOut();
    expect(calls.filter((c) => c.fn === 'status').map((c) => c.args[1])).toEqual(['ended']);
    expect(await contactsStore.read()).toBeNull();
    expect(liveCompanion.get()).toBeNull();
  });
});

describe('Datenschicht', () => {
  it('Demo: Link zur Demo-Seite, abgeschlossen bleibt abgeschlossen, nichts gesendet', async () => {
    const demo = createDemoLive({ newId: () => 'demo-1', now: () => 0 });
    const handle = await demo.start({
      displayName: 'K',
      sport: 'run',
      plannedMinutes: 60,
      intervalS: 30,
      replace: false,
    });
    expect(liveUrlFor(WEB, handle.token)).toBe(`${WEB}/begleitung#t=demo`);
    expect(await demo.push(handle.id, { lat: 0, lon: 0, accuracyM: null, recordedAt: '' })).toBe(
      'ok',
    );
    await demo.setStatus(handle.id, 'arrived');
    expect(await demo.push(handle.id, { lat: 0, lon: 0, accuracyM: null, recordedAt: '' })).toBe(
      'closed',
    );
    await expect(demo.setStatus(handle.id, 'active')).rejects.toBeInstanceOf(LiveError);
  });

  it('Supabase: nur Datenbank-Funktionen, Antworten geprüft, Fehler ohne Inhalte', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'start_live_session') {
        return {
          data: {
            id: SESSION_ID,
            token: TOKEN,
            started_at: '2026-10-27T17:00:00+00:00',
            planned_end_at: '2026-10-27T18:00:00+00:00',
            expires_at: '2026-10-28T05:00:00+00:00',
          },
          error: null,
        };
      }
      if (name === 'push_live_position') return { data: 'throttled', error: null };
      if (name === 'set_live_status') return { data: null, error: { code: '55000', message: 'x' } };
      return { data: { token: 'kaputt' }, error: null };
    });
    const remote = createRemoteLive({ client: { rpc } as never });
    const handle = await remote.start({
      displayName: 'K',
      sport: 'run',
      plannedMinutes: 60,
      intervalS: 30,
      replace: true,
    });
    expect(handle.token).toBe(TOKEN);
    expect(rpc).toHaveBeenCalledWith('start_live_session', {
      p_display_name: 'K',
      p_sport: 'run',
      p_planned_minutes: 60,
      p_update_interval_s: 30,
      p_replace: true,
    });
    expect(await remote.push(SESSION_ID, { lat: 1, lon: 2, accuracyM: 3, recordedAt: 'x' })).toBe(
      'throttled',
    );
    await expect(remote.setStatus(SESSION_ID, 'ended')).rejects.toMatchObject({ code: 'active' });
    await expect(remote.rotate(SESSION_ID)).rejects.toMatchObject({ code: 'unknown' });
  });

  it('Fehlercodes', () => {
    expect(liveErrorFrom({ code: '55000' }).code).toBe('active');
    expect(liveErrorFrom({ code: '42501' }).code).toBe('not_signed_in');
    expect(liveErrorFrom({ code: '22023' }).code).toBe('invalid');
    expect(liveErrorFrom({ message: 'Failed to fetch' }).code).toBe('offline');
    expect(liveErrorFrom({ code: 'XX000' }).code).toBe('unknown');
  });

  it('Kontakte nur im Gerätespeicher: kaputt → leer, ungültig → nicht gespeichert', async () => {
    const store = createMemoryProtectedStore();
    expect((await readLiveDeviceData(store)).contacts).toEqual([]);
    await store.write('kaputt');
    expect((await readLiveDeviceData(store)).contacts).toEqual([]);
    const contact = {
      id: 'k1',
      name: 'Anna',
      phone: '+491711234567',
      email: null,
      isDefault: true,
    };
    await writeLiveDeviceData(store, {
      v: 1,
      contacts: [contact],
      settings: DEFAULT_LIVE_SETTINGS,
    });
    expect((await readLiveDeviceData(store)).contacts).toEqual([contact]);
    await expect(
      writeLiveDeviceData(store, {
        v: 1,
        contacts: [1, 2, 3, 4].map((i) => ({ ...contact, id: `k${i}`, isDefault: i === 1 })),
        settings: DEFAULT_LIVE_SETTINGS,
      }),
    ).rejects.toBeInstanceOf(LiveError);
    expect(defaultContact([{ ...contact, isDefault: false }])?.id).toBe('k1');
    expect(defaultContact([])).toBeNull();
  });

  it('Formular: Nummer mit 0 → E.164 je Land, Fehlerfeld', () => {
    const draft = {
      ...emptyContactDraft(true),
      name: 'Anna',
      phone: '0664 1234567',
      country: 'AT' as const,
    };
    const ok = contactFromDraft(draft, 'k1');
    expect(ok).toEqual({
      ok: true,
      contact: { id: 'k1', name: 'Anna', phone: '+436641234567', email: null, isDefault: true },
    });
    expect(contactFromDraft({ ...draft, phone: '12' }, 'k1')).toEqual({
      ok: false,
      field: 'phone',
    });
    expect(contactFromDraft({ ...draft, phone: '' }, 'k1')).toEqual({ ok: false, field: 'phone' });
    expect(
      contactFromDraft({ ...draft, phone: '', email: 'Anna@Example.org' }, 'k1'),
    ).toMatchObject({ ok: true, contact: { email: 'anna@example.org', phone: null } });
    expect(contactFromDraft({ ...draft, name: ' ' }, 'k1')).toEqual({ ok: false, field: 'name' });
    expect(contactFromDraft({ ...draft, email: 'kaputt' }, 'k1')).toEqual({
      ok: false,
      field: 'email',
    });
  });
});
