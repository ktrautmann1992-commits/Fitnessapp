import type { SessionLogPayload } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { USER_ID } from '../test/fixtures';
import { LogQueue, logQueueKey, type LogQueueEntry, type SaveLogResponse } from './log-queue';
import { createMemoryProtectedStore } from './protected-store';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';

/**
 * Eigene Tagebuch-Warteschlange (docs/PLAN-PHASE-4.md 4.3, DoD Etappe C): Schlüssel, Reihenfolge, gleiche write_id
 * bei Neuversuch (R4), 401 = später, Ablehnung/Konflikt sichern den Entwurf VOR dem Entfernen, Konto-Bindung (R5),
 * Sperre und Bereinigung vor dem Widerruf (R3).
 */

const OTHER_USER = '00000000-0000-4000-8000-000000000002';

function payload(id: string, overrides: Partial<SessionLogPayload> = {}): SessionLogPayload {
  return {
    id,
    write_id: `w-${id}`,
    base_revision: null,
    planned_session_id: `ps-${id}`,
    planned_date: '2026-10-05',
    kind: 'strength',
    performed_on: '2026-10-05',
    started_at: null,
    finished_at: null,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: 'Zügiges Gehen',
    is_intro_week: false,
    is_deload: false,
    source: 'manual',
    client_updated_at: '2026-10-05T18:00:00Z',
    exercises: [
      {
        id: `e-${id}`,
        order_no: 1,
        planned_exercise_id: null,
        exercise_id: 'goblet-kniebeuge',
        exercise_name_de: 'Goblet-Kniebeuge',
        load_type: 'weight',
        status: 'done',
        target_sets: 3,
        reps_min: 8,
        reps_max: 12,
        target_reps: 8,
        target_extra_set: false,
        target_weight_kg: 20,
        target_duration_s: null,
        target_rpe: 7,
        state_weight_kg: 20,
        state_target_reps: 8,
        state_extra_set: false,
        state_duration_s: null,
        weight_confirmed: false,
        is_return: false,
        sets: [{ set_no: 1, reps: 8, weight_kg: 20, duration_s: null, rpe: null, done: true }],
      },
    ],
    cardio: null,
    ...overrides,
  };
}

function entry(
  id: string,
  overrides: Partial<SessionLogPayload> = {},
  health = false,
): LogQueueEntry {
  const p = payload(id, overrides);
  return {
    key: logQueueKey(p),
    payload: p,
    draft: {
      key: p.planned_session_id ?? p.id,
      nameDe: p.name_de,
      kind: p.kind,
      fromHealthPlan: health,
      exercises: [],
    } as unknown as WorkoutDraft,
    fromHealthPlan: health,
  };
}

type Step = SaveLogResponse | Error | { reject: true };

function setup(steps: Step[] = [], user: string | null = USER_ID) {
  const store = createMemoryProtectedStore();
  const sent: SessionLogPayload[] = [];
  const events: string[] = [];
  let currentUser = user;
  const queue = new LogQueue({
    store,
    execute: async (p) => {
      sent.push(p);
      const step = steps.shift() ?? { result: 'ok', id: p.id, revision: 1 };
      if (step instanceof Error) throw step;
      if ('reject' in step) throw { code: '23505', message: 'An diesem Tag …' };
      return step;
    },
    classify: (error): 'retry' | LogRejectReason =>
      error instanceof Error ? 'retry' : 'day_taken',
    currentUserId: () => currentUser,
    onSaved: (e, r) => {
      events.push(`saved:${e.key}:${r.result}`);
    },
    onConflict: async (e) => {
      // Muss gespeichert sein, BEVOR der Eintrag entfernt wird.
      events.push(`conflict:${e.key}:queued=${String(queue.snapshot().includes(e))}`);
    },
    onRejected: async (e, reason) => {
      events.push(`rejected:${e.key}:${reason}:queued=${String(queue.snapshot().includes(e))}`);
    },
  });
  return { queue, store, sent, events, setUser: (u: string | null) => (currentUser = u) };
}

describe('LogQueue', () => {
  it('Schlüssel je geplanter Einheit (sonst id); neuere Fassung ersetzt ältere, base_revision bleibt', async () => {
    const { queue } = setup();
    expect(logQueueKey({ planned_session_id: 'ps-1', id: 'x' })).toBe('save_session_log:ps-1');
    expect(logQueueKey({ planned_session_id: null, id: 'x' })).toBe('save_session_log:x');
    await queue.add(entry('1', { base_revision: 3 }), USER_ID);
    await queue.add(entry('2'), USER_ID);
    await queue.add(entry('1', { base_revision: 4, write_id: 'neu', session_rpe: 8 }), USER_ID);
    expect(queue.size()).toBe(2);
    const replaced = queue.snapshot().find((e) => e.key === 'save_session_log:ps-1');
    expect(replaced?.payload).toMatchObject({ base_revision: 3, write_id: 'neu', session_rpe: 8 });
    // Reihenfolge: die ersetzte Fassung rückt ans Ende.
    expect(queue.snapshot().map((e) => e.key)).toEqual([
      'save_session_log:ps-2',
      'save_session_log:ps-1',
    ]);
  });

  it('Netzwerkfehler bzw. 401 = später; Neuversuch sendet dieselbe write_id (R4)', async () => {
    const { queue, sent, store } = setup([new Error('offline'), new Error('401')]);
    await queue.add(entry('1'), USER_ID);
    expect(await queue.flush()).toBe('later');
    expect(await queue.flush()).toBe('later');
    expect(queue.size()).toBe(1);
    expect(await queue.flush()).toBe('done');
    expect(sent.map((p) => p.write_id)).toEqual(['w-1', 'w-1', 'w-1']);
    expect(store.peek()).toBeNull();
  });

  it('Konflikt und Ablehnung: Entwurf wird gesichert, solange der Eintrag noch in der Warteschlange liegt', async () => {
    const { queue, events } = setup([
      { result: 'conflict', id: '1', revision: 5 },
      { reject: true },
      { result: 'orphaned', id: '3', revision: 1 },
    ]);
    await queue.add(entry('1'), USER_ID);
    await queue.add(entry('2'), USER_ID);
    await queue.add(entry('3'), USER_ID);
    expect(await queue.flush()).toBe('done');
    expect(events).toEqual([
      'conflict:save_session_log:ps-1:queued=true',
      'rejected:save_session_log:ps-2:day_taken:queued=true',
      'saved:save_session_log:ps-3:orphaned',
    ]);
    expect(queue.size()).toBe(0);
  });

  it('Konto-Bindung (R5): fremdes Konto angemeldet → nichts gesendet; kein Mischen beim Einreihen', async () => {
    const { queue, sent, setUser } = setup();
    await queue.add(entry('1'), USER_ID);
    setUser(OTHER_USER);
    expect(await queue.flush()).toBe('foreign');
    expect(sent).toHaveLength(0);
    expect(await queue.hasForeign(OTHER_USER)).toBe(true);
    await expect(queue.add(entry('2'), OTHER_USER)).rejects.toThrow();
    // Sitzung abgelaufen (niemand angemeldet): nichts senden, nichts leeren.
    setUser(null);
    expect(await queue.flush()).toBe('later');
    setUser(USER_ID);
    expect(await queue.flush()).toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('Gespeichert in der Warteschlange: unlesbar ohne den geschützten Speicher, mit Konto', async () => {
    const { queue, store } = setup();
    await queue.add(entry('1'), USER_ID);
    const stored = JSON.parse(store.peek() ?? '{}') as { ownerUserId: string };
    expect(stored.ownerUserId).toBe(USER_ID);
    // Neu geladen (App-Neustart) – gleicher Inhalt.
    const reloaded = new LogQueue({
      store,
      execute: async () => ({ result: 'ok', id: '1', revision: 1 }),
      classify: () => 'retry',
      currentUserId: () => USER_ID,
      onConflict: async () => undefined,
      onRejected: async () => undefined,
    });
    await reloaded.load();
    expect(reloaded.size()).toBe(1);
  });

  it('Widerruf (R3): gesperrt wird nichts gesendet; Gesundheits-Einträge neutralisiert bzw. entfernt', async () => {
    const { queue, sent } = setup();
    await queue.add(entry('1', {}, true), USER_ID);
    await queue.add(entry('2', {}, false), USER_ID);
    queue.setLocked(true);
    expect(await queue.flush()).toBe('locked');
    expect(sent).toHaveLength(0);
    await queue.cleanHealthPlanEntries('neutralize');
    const neutral = queue.snapshot().find((e) => e.key === 'save_session_log:ps-1');
    expect(neutral?.fromHealthPlan).toBe(false);
    expect(neutral?.payload.name_de).toBe('Kraft-Einheit');
    expect(neutral?.payload.exercises[0]).toMatchObject({
      target_sets: null,
      target_weight_kg: null,
      state_weight_kg: null,
      reps_min: null,
    });
    // Ist-Werte bleiben.
    expect(neutral?.payload.exercises[0]?.sets).toHaveLength(1);
    // Nicht-Gesundheits-Eintrag unverändert.
    expect(queue.snapshot().find((e) => e.key === 'save_session_log:ps-2')?.payload.name_de).toBe(
      'Zügiges Gehen',
    );
    await queue.add(entry('3', {}, true), USER_ID);
    await queue.cleanHealthPlanEntries('delete');
    expect(queue.snapshot().map((e) => e.key)).toEqual([
      'save_session_log:ps-1',
      'save_session_log:ps-2',
    ]);
    queue.setLocked(false);
    expect(await queue.flush()).toBe('done');
  });

  it('Neuere Fassung während des Sendens: baut auf der eben bestätigten Revision auf', async () => {
    const { queue, sent } = setup([{ result: 'ok', id: 'server-1', revision: 1 }]);
    await queue.add(entry('1'), USER_ID);
    const flushing = queue.flush();
    await queue.add(entry('1', { write_id: 'zweite', session_rpe: 9 }), USER_ID);
    await flushing;
    // Die zweite Fassung wartet noch (erst nach dem ersten Senden eingereiht) – mit Basis 1 und Server-id.
    if (queue.size() > 0) {
      expect(queue.snapshot()[0]?.payload).toMatchObject({ base_revision: 1, id: 'server-1' });
      await queue.flush();
    }
    expect(sent.at(-1)?.write_id).toBe('zweite');
  });
});
