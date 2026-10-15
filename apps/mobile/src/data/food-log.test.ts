/**
 * Etappe E1 – Ernährungstagebuch in der App (Testmodus; docs/PLAN-AUSWERTUNG.md Abschnitt 5, 2.7): Speichern im
 * Gerätespeicher mit denselben Regeln wie save_food_log_entries (Einwilligung, Datumsfenster, Form, Tageslimit,
 * Plan-Mahlzeit einmal je Tag und Platz), Löschen ohne Einwilligung, Favoriten (Obergrenze, bleiben beim Widerruf),
 * Widerruf löscht die Einträge, Export, ungültiger Gerätespeicher, „neu laden → alles da“ (offline). Die Regeln selbst
 * testet packages/core (food-log.test.ts).
 */
import {
  entryFromFood,
  entryFromPlanItem,
  favoriteFromEntry,
  type FoodLogBuild,
  type FoodLogEntry,
  quickEntry,
  zeroNutrients,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  localBackendOn,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
  VERSIONS,
} from '../test/fixtures';
import { BackendError } from './backend';
import { localDataExport } from './data-export';
import { checkFoodLogSave } from './food-log-rows';
import { upgradeStoredRows } from './legacy-rows';
import type { UserRows } from './types';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const banane = {
  id: 'banane',
  name_de: 'Banane',
  units: { piece_g: 120 },
  nutrients_per_100g: { ...zeroNutrients(), kcal: 93, protein_g: 1.2, carbs_g: 20, fat_g: 0.2 },
};
const meal = {
  slot: 'lunch' as const,
  recipeId: 'nudeln',
  titleDe: 'Nudeln',
  nutrients: { ...zeroNutrients(), kcal: 600, protein_g: 20, carbs_g: 100, fat_g: 10 },
};

function ok(build: FoodLogBuild): FoodLogEntry {
  if (!build.ok) throw new Error(build.reason);
  return build.entry;
}

const snack = (n: number, date = TODAY) =>
  ok(quickEntry({ label: 'Snack', kcal: 100 }, { id: ID(n), date, slot: 'other' }));

function rows(consent: 'valid' | 'none' = 'valid'): UserRows {
  return planPersonRows({ consent });
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(BackendError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('Tagebuch im Testmodus (E1)', () => {
  it('ohne Einwilligung health_data kein Eintrag (A-G12)', async () => {
    const { backend } = seededBackend(rows('none'));
    const data = rows('none');
    await expectCode(backend.saveFoodLogEntries([snack(1)], data), 'consent_required');
  });

  it('eintragen, ändern, löschen – mit revision und Zeitstempeln wie die Datenbank', async () => {
    const { backend } = seededBackend(rows());
    const entry = ok(entryFromFood(banane, 1, 'piece', { id: ID(1), date: TODAY, slot: 'other' }));
    let next = await backend.saveFoodLogEntries([entry], rows());
    expect(next.foodLogEntries).toHaveLength(1);
    expect(next.foodLogEntries[0]).toMatchObject({
      id: ID(1),
      user_id: USER_ID,
      revision: 1,
      kcal: 112,
    });
    const twice = ok(entryFromFood(banane, 2, 'piece', { id: ID(1), date: TODAY, slot: 'other' }));
    next = await backend.saveFoodLogEntries([twice], next);
    expect(next.foodLogEntries[0]).toMatchObject({ revision: 2, kcal: 223, amount: 2 });
    next = await backend.deleteFoodLogEntry(ID(1), next);
    expect(next.foodLogEntries).toEqual([]);
  });

  it('Datumsfenster: genau 14 Tage zurück ja, 15 nicht, Zukunft nicht', async () => {
    const { backend } = seededBackend(rows());
    await expect(
      backend.saveFoodLogEntries([snack(1, '2026-09-19')], rows()),
    ).resolves.toBeTruthy();
    await expectCode(
      backend.saveFoodLogEntries([snack(2, '2026-09-18')], rows()),
      'food_log_out_of_range',
    );
    await expectCode(
      backend.saveFoodLogEntries([snack(3, '2026-10-04')], rows()),
      'food_log_out_of_range',
    );
  });

  it('höchstens 40 Einträge je Tag', async () => {
    const { backend } = seededBackend(rows());
    const forty = Array.from({ length: 40 }, (_, i) => snack(100 + i));
    const next = await backend.saveFoodLogEntries(forty, rows());
    expect(next.foodLogEntries).toHaveLength(40);
    await expectCode(backend.saveFoodLogEntries([snack(200)], next), 'food_log_day_full');
  });

  it('Plan-Mahlzeit je Tag und Platz nur einmal; doppelt tippen mit gleicher id ersetzt', async () => {
    const { backend } = seededBackend(rows());
    const first = ok(entryFromPlanItem(meal, 1, { id: ID(1), date: TODAY }));
    const next = await backend.saveFoodLogEntries([first], rows());
    const again = ok(entryFromPlanItem(meal, 0.75, { id: ID(1), date: TODAY }));
    const replaced = await backend.saveFoodLogEntries([again], next);
    expect(replaced.foodLogEntries).toHaveLength(1);
    expect(replaced.foodLogEntries[0]?.portion).toBe(0.75);
    const other = ok(entryFromPlanItem(meal, 1, { id: ID(2), date: TODAY }));
    await expectCode(backend.saveFoodLogEntries([other], replaced), 'food_log_rejected');
  });

  it('ungültige Werte (Freitext im Schnelleintrag, unbekanntes Feld) abgelehnt – ohne Werte in der Meldung', async () => {
    const { backend } = seededBackend(rows());
    const bad = { ...snack(1), title_de: 'Pizza bei Mama' };
    const error = await backend.saveFoodLogEntries([bad], rows()).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'food_log_rejected', sensitive: true });
    expect(String((error as Error).message)).not.toContain('Pizza');
    await expectCode(
      backend.saveFoodLogEntries([{ ...snack(2), user_id: 'x' } as FoodLogEntry], rows()),
      'food_log_rejected',
    );
  });

  it('alte Einträge (über 14 Tage) sind nicht mehr änderbar, aber löschbar', () => {
    const data: UserRows = {
      ...rows(),
      foodLogEntries: [
        {
          ...snack(1, '2026-09-01'),
          user_id: USER_ID,
          revision: 1,
          last_write_id: 'w',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
      ],
    };
    expect(checkFoodLogSave(data, [snack(1, TODAY)], { today: TODAY, versions: VERSIONS })).toEqual(
      { ok: true, outcomes: [{ kind: 'rejected', code: 'out_of_range' }] },
    );
  });

  it('„Flugmodus → eintragen → neu laden → alles da“: der Gerätespeicher behält die Einträge', async () => {
    const { backend, store } = seededBackend(rows());
    await backend.saveFoodLogEntries([snack(1)], rows());
    const reopened = localBackendOn(store, TODAY, '2026-10-03T12:00:00.000Z');
    await reopened.getSession();
    const loaded = await reopened.loadRows();
    expect(loaded.rows.foodLogEntries.map((e) => e.id)).toEqual([ID(1)]);
  });

  it('Favoriten: setzen, ersetzen, entfernen, höchstens 100', async () => {
    const { backend } = seededBackend(rows());
    const fav = favoriteFromEntry(
      ok(
        quickEntry(
          { label: 'Auswärts gegessen', kcal: 700 },
          { id: ID(1), date: TODAY, slot: 'dinner' },
        ),
      ),
    );
    if (!fav) throw new Error('kein Favorit');
    let next = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, rows());
    expect(next.foodLogFavorites.map((f) => f.fav_key)).toEqual(['quick|Auswärts gegessen|700']);
    next = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, next);
    expect(next.foodLogFavorites).toHaveLength(1);
    next = await backend.changeFoodLogFavorite({ op: 'remove', favKey: fav.fav_key }, next);
    expect(next.foodLogFavorites).toEqual([]);
    const full = {
      ...rows(),
      foodLogFavorites: Array.from({ length: 100 }, (_, i) => ({
        ...fav,
        fav_key: `quick|Snack|${i}`,
        title_de: 'Snack',
        kcal: i,
        user_id: USER_ID,
        created_at: 'x',
      })),
    };
    const seeded = seededBackend(full);
    await expectCode(
      seeded.backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, full),
      'favorite_limit',
    );
    await expectCode(
      backend.changeFoodLogFavorite({ op: 'set', favorite: { ...fav, fav_key: 'falsch' } }, rows()),
      'unknown',
    );
  });

  it('Widerruf health_data: Einträge und Schnell-Favoriten gelöscht, Katalog-Favoriten bleiben (G1/A-G14)', async () => {
    const { backend } = seededBackend(rows());
    const entry = ok(
      quickEntry(
        { label: 'Auswärts gegessen', kcal: 700 },
        { id: ID(1), date: TODAY, slot: 'dinner' },
      ),
    );
    const banana = ok(entryFromFood(banane, 1, 'piece', { id: ID(2), date: TODAY, slot: 'other' }));
    let next = await backend.saveFoodLogEntries([entry, banana], rows());
    for (const e of [entry, banana]) {
      const fav = favoriteFromEntry(e);
      if (!fav) throw new Error('kein Favorit');
      next = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, next);
    }
    expect(next.foodLogFavorites).toHaveLength(2);
    // Katalog-Favorit ohne Werte (Wächter E1 S1).
    expect(next.foodLogFavorites.find((f) => f.source === 'food')?.kcal).toBeNull();
    await backend.revokeConsent('health_data');
    const after = (await backend.loadRows()).rows;
    expect(after.foodLogEntries).toEqual([]);
    expect(after.foodLogFavorites.map((f) => f.fav_key)).toEqual(['food|banane']);
    // Ohne Einwilligung: kein neuer Schnell-Favorit; Löschen geht weiter (Recht auf Löschung).
    const quickFav = favoriteFromEntry(entry);
    if (!quickFav) throw new Error('kein Favorit');
    await expectCode(
      backend.changeFoodLogFavorite({ op: 'set', favorite: quickFav }, after),
      'consent_required',
    );
    await expect(backend.deleteFoodLogEntry(ID(1), after)).resolves.toBeTruthy();
  });

  it('je Eintrag ein Ergebnis (Wächter E1 S2): gültiger Eintrag gespeichert, doppelte Plan-Mahlzeit gemeldet', async () => {
    const { backend } = seededBackend(rows());
    const first = ok(entryFromPlanItem(meal, 1, { id: ID(1), date: TODAY }));
    const saved = await backend.saveFoodLogEntries([first], rows());
    const other = ok(entryFromPlanItem(meal, 1, { id: ID(2), date: TODAY }));
    const check = checkFoodLogSave(saved, [snack(3), other], { today: TODAY, versions: VERSIONS });
    expect(check).toEqual({
      ok: true,
      outcomes: [
        { kind: 'saved', entry: snack(3) },
        { kind: 'conflict', reason: 'plan_item_exists', id: ID(1) },
      ],
    });
    await expectCode(backend.saveFoodLogEntries([snack(3), other], saved), 'food_log_rejected');
    const after = (await backend.loadRows()).rows;
    expect(after.foodLogEntries.map((e) => e.id).sort()).toEqual([ID(1), ID(3)]);
  });

  it('Export enthält Tagebuch und Favoriten in Spalten wie die Datenbank', async () => {
    const { backend } = seededBackend(rows());
    const next = await backend.saveFoodLogEntries([snack(2), snack(1, '2026-10-01')], rows());
    const file = localDataExport(next, USER_ID, '2026-10-03T12:00:00Z');
    expect(file.data.food_log_entries.map((e) => (e as { id: string }).id)).toEqual([ID(1), ID(2)]);
    expect(Object.keys(file.data.food_log_entries[0] as object).sort()).toEqual(
      [
        'amount',
        'carbs_g',
        'created_at',
        'eaten_on',
        'fat_g',
        'food_id',
        'id',
        'kcal',
        'last_write_id',
        'portion',
        'protein_g',
        'recipe_id',
        'revision',
        'slot',
        'source',
        'title_de',
        'unit',
        'updated_at',
        'user_id',
      ].sort(),
    );
    expect(file.data.food_log_favorites).toEqual([]);
  });

  it('Gerätespeicher ist nicht vertrauenswürdig: ungültige oder fremde Einträge fallen weg', () => {
    const good = {
      ...snack(1),
      user_id: USER_ID,
      revision: 1,
      last_write_id: 'w',
      created_at: 'a',
      updated_at: 'a',
    };
    const stored = {
      ...rows(),
      foodLogEntries: [
        good,
        { ...good, id: ID(2), user_id: 'fremd' },
        { ...good, id: ID(3), kcal: 99999 },
        { ...good, id: ID(4), revision: 0 },
        { ...good, id: ID(1) },
        'kaputt',
      ],
      foodLogFavorites: [{ fav_key: 'x' }],
    } as unknown as UserRows;
    const upgraded = upgradeStoredRows(stored);
    expect(upgraded.foodLogEntries.map((e) => e.id)).toEqual([ID(1)]);
    expect(upgraded.foodLogFavorites).toEqual([]);
    const old = { ...rows() } as Partial<UserRows>;
    delete old.foodLogEntries;
    delete old.foodLogFavorites;
    expect(upgradeStoredRows(old as UserRows).foodLogEntries).toEqual([]);
  });
});
