/**
 * Vorratsschrank (25.10.2026) im TESTMODUS und in der Ernährungs-Warteschlange (Supabase-Modus, offline-first):
 * dieselben Regeln wie save_pantry_item (Einwilligung, Schema, Grenze), Löschen ohne Einwilligung, Widerruf löscht,
 * Export enthält den Vorrat, letzter Stand je Lebensmittel gewinnt in der Warteschlange, Zeilen aus der Datenbank mit
 * Zod.
 */
import { PANTRY, type PantryItem } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, seededBackend, USER_ID } from '../test/fixtures';
import { BackendError } from './backend';
import {
  applyNutritionQueue,
  enqueueNutritionOp,
  type NutritionQueueEntry,
  nutritionQueueKey,
  pantryItemRowsFromDb,
} from './nutrition-sync';
import type { UserRows } from './types';

const rows = (health = true): UserRows => planPersonRows({ consent: health ? 'valid' : 'none' });
const item = (food_id: string, count: number | null = null, low = false): PantryItem => ({
  food_id,
  count,
  pack_size: null,
  low,
});

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Vorratsschrank im Testmodus', () => {
  it('speichern, ersetzen, löschen; im Export; Widerruf löscht', async () => {
    const { backend } = seededBackend(rows());
    let r = await backend.savePantryItems([item('haferflocken'), item('reis', 2)], rows());
    r = await backend.savePantryItems([item('haferflocken', 1, true)], r);
    expect(r.pantryItems).toEqual(
      expect.arrayContaining([
        { ...item('haferflocken', 1, true), user_id: USER_ID, updated_at: NOW },
        { ...item('reis', 2), user_id: USER_ID, updated_at: NOW },
      ]),
    );
    expect(r.pantryItems).toHaveLength(2);
    r = await backend.deletePantryItem('reis', r);
    expect(r.pantryItems.map((p) => p.food_id)).toEqual(['haferflocken']);
    const file = await backend.exportMyData();
    expect(file.data.pantry_items).toEqual([
      { ...item('haferflocken', 1, true), user_id: USER_ID, updated_at: NOW },
    ]);
    await backend.revokeHealthData(false, null);
    expect((await backend.exportMyData()).data.pantry_items).toEqual([]);
  });

  it('ohne Einwilligung abgelehnt; ungültige Menge abgelehnt (ohne Lebensmittel in der Meldung)', async () => {
    await expectCode(
      seededBackend(rows(false)).backend.savePantryItems([item('reis')], rows(false)),
      'consent_required',
    );
    const bad = seededBackend(rows()).backend.savePantryItems([item('reis', 0.3)], rows());
    await expectCode(bad, 'unknown');
    await bad.catch((error: Error) => expect(error.message).not.toContain('reis'));
  });

  it('Löschen geht auch ohne Einwilligung', async () => {
    const base = {
      ...rows(false),
      pantryItems: [{ ...item('reis'), user_id: USER_ID, updated_at: NOW }],
    };
    const { backend } = seededBackend(base);
    const r = await backend.deletePantryItem('reis', base);
    expect(r.pantryItems).toEqual([]);
  });

  it('höchstens 300 Lebensmittel (pantry_limit), bestehende ändern geht', async () => {
    const full = {
      ...rows(),
      pantryItems: Array.from({ length: PANTRY.itemsMax }, (_, i) => ({
        ...item(`lebensmittel-${i}`),
        user_id: USER_ID,
        updated_at: NOW,
      })),
    };
    const { backend } = seededBackend(full);
    await expectCode(backend.savePantryItems([item('reis')], full), 'pantry_limit');
    const r = await backend.savePantryItems([item('lebensmittel-1', 2)], full);
    expect(r.pantryItems.find((p) => p.food_id === 'lebensmittel-1')?.count).toBe(2);
  });
});

describe('Ernährungs-Warteschlange (offline-first)', () => {
  it('letzter Stand je Lebensmittel gewinnt; Löschen ersetzt das Speichern', () => {
    let queue: NutritionQueueEntry[] = [];
    queue = enqueueNutritionOp(queue, { kind: 'pantry_save', item: item('reis'), at: NOW });
    queue = enqueueNutritionOp(queue, { kind: 'pantry_save', item: item('reis', 2), at: NOW });
    queue = enqueueNutritionOp(queue, { kind: 'pantry_save', item: item('haferflocken'), at: NOW });
    expect(queue).toHaveLength(2);
    expect(queue.find((e) => e.key === 'pantry:reis')?.op).toMatchObject({ item: item('reis', 2) });
    queue = enqueueNutritionOp(queue, { kind: 'pantry_delete', foodId: 'reis', at: NOW });
    expect(queue.map((e) => e.op.kind).sort()).toEqual(['pantry_delete', 'pantry_save']);
    expect(nutritionQueueKey({ kind: 'pantry_delete', foodId: 'reis', at: NOW })).toBe(
      'pantry:reis',
    );
  });

  it('wartende Vorgänge über den Server-Stand legen', () => {
    const base = {
      ...rows(),
      pantryItems: [{ ...item('reis'), user_id: USER_ID, updated_at: NOW }],
    };
    const next = applyNutritionQueue(
      base,
      [
        { key: 'pantry:reis', op: { kind: 'pantry_delete', foodId: 'reis', at: NOW } },
        {
          key: 'pantry:haferflocken',
          op: {
            kind: 'pantry_save',
            item: item('haferflocken', 1.5),
            at: '2026-10-25T10:00:00.000Z',
          },
        },
      ],
      { userId: USER_ID, now: NOW },
    );
    expect(next.pantryItems).toEqual([
      { ...item('haferflocken', 1.5), user_id: USER_ID, updated_at: '2026-10-25T10:00:00.000Z' },
    ]);
  });

  it('Zeilen aus der Datenbank: numeric als Text, ungültige fallen weg', () => {
    expect(
      pantryItemRowsFromDb([
        {
          user_id: USER_ID,
          food_id: 'reis',
          count: '2.0',
          pack_size: 500,
          low: false,
          updated_at: NOW,
        },
        {
          user_id: USER_ID,
          food_id: 'haferflocken',
          count: null,
          pack_size: null,
          low: true,
          updated_at: NOW,
        },
        {
          user_id: USER_ID,
          food_id: 'Ungültig!',
          count: null,
          pack_size: null,
          low: false,
          updated_at: NOW,
        },
        {
          user_id: USER_ID,
          food_id: 'nudeln',
          count: 0.3,
          pack_size: null,
          low: false,
          updated_at: NOW,
        },
      ]),
    ).toEqual([
      {
        user_id: USER_ID,
        food_id: 'haferflocken',
        count: null,
        pack_size: null,
        low: true,
        updated_at: NOW,
      },
      { user_id: USER_ID, food_id: 'reis', count: 2, pack_size: 500, low: false, updated_at: NOW },
    ]);
  });
});
