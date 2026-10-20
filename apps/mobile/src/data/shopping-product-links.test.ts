/**
 * Einkaufen E1 (docs/PLAN-EINKAUFEN-AUSDAUER.md 3): gelernte Zuordnungen Strichcode → Lebensmittel im TESTMODUS –
 * dieselben Regeln wie save_shopping_product_link (Einwilligung, Nummer, gleiche Nummer ersetzt), Widerruf löscht,
 * Export enthält sie, Zeilen aus der Datenbank mit Zod.
 */
import { MOCK_PRODUCT_CASES } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { NOW, planPersonRows, seededBackend, USER_ID } from '../test/fixtures';
import { BackendError } from './backend';
import { shoppingProductLinkRowsFromDb } from './nutrition-sync';
import type { UserRows } from './types';

const CODE = MOCK_PRODUCT_CASES[0].code;
const rows = (health = true): UserRows => planPersonRows({ consent: health ? 'valid' : 'none' });

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Gelernte Zuordnungen im Testmodus', () => {
  it('speichern, gleiche Nummer ersetzt; im Export; Widerruf löscht', async () => {
    const { backend } = seededBackend(rows());
    let r = await backend.saveShoppingProductLink({ code: CODE, food_id: 'haferflocken' }, rows());
    r = await backend.saveShoppingProductLink({ code: CODE, food_id: 'reis' }, r);
    expect(r.shoppingProductLinks).toEqual([
      { code: CODE, food_id: 'reis', user_id: USER_ID, updated_at: NOW },
    ]);
    const file = await backend.exportMyData();
    expect(file.data.shopping_product_links).toEqual([
      { code: CODE, food_id: 'reis', user_id: USER_ID, updated_at: NOW },
    ]);
    await backend.revokeHealthData(false, null);
    const after = await backend.exportMyData();
    expect(after.data.shopping_product_links).toEqual([]);
  });

  it('ohne Einwilligung bzw. mit ungültiger Nummer abgelehnt (ohne Nummer in der Meldung)', async () => {
    await expectCode(
      seededBackend(rows(false)).backend.saveShoppingProductLink(
        { code: CODE, food_id: 'reis' },
        rows(false),
      ),
      'consent_required',
    );
    const bad = seededBackend(rows()).backend.saveShoppingProductLink(
      { code: '4000000000010', food_id: 'reis' },
      rows(),
    );
    await expectCode(bad, 'unknown');
    await bad.catch((error: Error) => expect(error.message).not.toContain('4000000000010'));
  });

  it('Zeilen aus der Datenbank: ungültige fallen weg, sortiert nach Zeitpunkt', () => {
    expect(
      shoppingProductLinkRowsFromDb([
        { user_id: USER_ID, code: CODE, food_id: 'reis', updated_at: '2026-10-02T00:00:00Z' },
        { user_id: USER_ID, code: '123', food_id: 'reis', updated_at: NOW },
        { user_id: USER_ID, code: CODE, food_id: 'Ungültig!', updated_at: NOW },
        {
          user_id: USER_ID,
          code: CODE,
          food_id: 'haferflocken',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ]).map((l) => l.food_id),
    ).toEqual(['haferflocken', 'reis']);
  });
});
