import { HYDRATION } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './kv';
import { createLocalHydration, HydrationError, mergeHydration } from './hydration';

const ME = '11111111-1111-4111-8111-111111111111';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function local(userId: string | null = ME) {
  const store = createMemoryStore();
  return {
    store,
    h: createLocalHydration({
      store,
      userId: async () => userId,
      now: () => '2026-10-25T09:00:00.000Z',
      today: () => '2026-10-25',
    }),
  };
}

describe('Trinken im Testmodus (gleiche Regeln wie add_hydration)', () => {
  it('eintragen, gleiche id kein Doppel, laden je Zeitraum, löschen, Export', async () => {
    const { h } = local();
    await h.add({ id: uuid(1), day: '2026-10-25', amount_ml: 250 });
    await h.add({ id: uuid(1), day: '2026-10-25', amount_ml: 250 });
    await h.add({ id: uuid(2), day: '2026-10-20', amount_ml: 500 });
    expect((await h.load('2026-10-19', '2026-10-25')).entries).toHaveLength(2);
    expect((await h.load('2026-10-21', '2026-10-25')).entries.map((e) => e.amount_ml)).toEqual([
      250,
    ]);
    await h.remove(uuid(1));
    expect((await h.load('2026-10-01', '2026-10-25')).entries).toHaveLength(1);
    expect(await h.deleteAll()).toBe(1);
  });

  it('Grenzen: Menge, Zeitraum, Einträge je Tag, nicht angemeldet', async () => {
    const { h } = local();
    await expect(h.add({ id: uuid(3), day: '2026-10-25', amount_ml: 20 })).rejects.toBeInstanceOf(
      HydrationError,
    );
    await expect(h.add({ id: uuid(3), day: '2026-10-26', amount_ml: 200 })).rejects.toThrow(
      'invalid',
    );
    await expect(h.add({ id: uuid(3), day: '2026-10-10', amount_ml: 200 })).rejects.toThrow(
      'invalid',
    );
    for (let i = 0; i < HYDRATION.maxEntriesPerDay; i += 1) {
      await h.add({ id: uuid(100 + i), day: '2026-10-24', amount_ml: 100 });
    }
    await expect(h.add({ id: uuid(999), day: '2026-10-24', amount_ml: 100 })).rejects.toThrow(
      'limit',
    );
    await expect(local(null).h.load('2026-10-19', '2026-10-25')).rejects.toThrow('not_signed_in');
  });
});

describe('mergeHydration (offline-first)', () => {
  it('wartende Einträge zählen sofort, gelöschte fallen weg, fremde Konten nie', () => {
    const server = [
      {
        id: uuid(1),
        user_id: ME,
        day: '2026-10-25',
        amount_ml: 250,
        created_at: '2026-10-25T07:00:00Z',
      },
      {
        id: uuid(2),
        user_id: 'other',
        day: '2026-10-25',
        amount_ml: 999,
        created_at: '2026-10-25T07:00:00Z',
      },
    ];
    const merged = mergeHydration(
      server,
      [
        {
          op: 'add',
          userId: ME,
          entry: { id: uuid(3), day: '2026-10-25', amount_ml: 500 },
          at: '2026-10-25T08:00:00Z',
        },
        { op: 'delete', userId: ME, id: uuid(1) },
      ],
      ME,
    );
    expect(merged.map((e) => e.id)).toEqual([uuid(3)]);
  });
});
