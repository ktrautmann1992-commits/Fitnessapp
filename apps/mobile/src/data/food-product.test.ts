/**
 * Etappe E4a – Produktabfrage per Barcode-Nummer und eigene Produkte im Testmodus (docs/PLAN-E4.md 3.2–3.6, 8.2):
 * dieselbe Kette wie der Server mit der Attrappe (Testnummern, ausgedachte Testwerte, kein Netz), Einwilligung
 * health_data, Limits je Person, Zwischenspeicher ohne Personenbezug, Eintragen mit Herkunft product (Werte wie der
 * Server aus dem Speicher bzw. eigenen Produkt), eigene Produkte (anlegen/ändern/löschen/200), Widerruf, Export, Konto
 * löschen, ungültiger Gerätespeicher und die Supabase-Seite (Route) mit Ersatz-fetch.
 */
import {
  entryFromProduct,
  entryFromUserProduct,
  favoriteFromEntry,
  MOCK_PRODUCT_CASES,
  type FoodLogEntry,
  type UserFoodProduct,
  USER_PRODUCT_ENTRY_TITLE,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';
import { describe, expect, it, vi } from 'vitest';

import {
  localBackendOn,
  NOW,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
} from '../test/fixtures';
import { BackendError } from './backend';
import { entryFromRow } from './food-log-rows';
import { createRemoteFoodProduct } from './food-product-remote';
import { upgradeStoredRows } from './legacy-rows';
import type { UserRows } from './types';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const code = (key: (typeof MOCK_PRODUCT_CASES)[number]['key']) =>
  MOCK_PRODUCT_CASES.find((c) => c.key === key)?.code ?? '';
const rows = (health = true): UserRows => planPersonRows({ consent: health ? 'valid' : 'none' });
const target = (n: number) => ({ id: ID(n), date: TODAY, slot: 'other' as const });

function stored(store: { dump: () => Record<string, string> }) {
  return JSON.parse(store.dump()['fitnessapp.local.v1'] ?? '{}') as {
    foodProducts?: Record<string, Record<string, unknown>>;
    productLookups?: Record<string, unknown>[];
    rows?: UserRows;
  };
}

const own = (over: Partial<UserFoodProduct> = {}): UserFoodProduct => ({
  id: ID(100),
  name_de: 'Hafermilch Essanfall',
  brand_de: 'Eigenmarke',
  code: code('nicht_gefunden'),
  base_unit: 'ml',
  kcal: 64,
  protein_g: 3.3,
  carbs_g: 4.8,
  fat_g: 3.5,
  sugar_g: null,
  salt_g: null,
  serving_g: 250,
  based_on_off: false,
  ...over,
});

async function expectCode(promise: Promise<unknown>, codeName: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(BackendError);
    expect((error as BackendError).code).toBe(codeName);
    // Nie Name, Marke oder Nummer in Fehlermeldungen.
    expect((error as Error).message).not.toMatch(/Hafermilch|Eigenmarke|Essanfall|\d{8,}/);
    return;
  }
  throw new Error('kein Fehler');
}

describe('Produktabfrage im Testmodus (Attrappe)', () => {
  it('ohne Einwilligung health_data → no_consent, nichts gezählt, nichts gespeichert (E4-G12)', async () => {
    const { backend, store } = seededBackend(rows(false));
    expect(await backend.lookupFoodProduct(code('plausibel'))).toEqual({ code: 'no_consent' });
    expect(stored(store).productLookups ?? []).toEqual([]);
    expect(stored(store).foodProducts ?? {}).toEqual({});
  });

  it('ungültige Nummer und Ladencode ohne Zählung', async () => {
    const { backend, store } = seededBackend(rows());
    expect(await backend.lookupFoodProduct('4006381333932')).toEqual({ code: 'invalid_code' });
    expect(await backend.lookupFoodProduct('2012345678903')).toEqual({ code: 'not_food_code' });
    expect(stored(store).productLookups ?? []).toEqual([]);
  });

  it('gefunden: Attrappe markiert, Speicher ohne Personenbezug, Zähler ohne Nummer', async () => {
    const { backend, store } = seededBackend(rows());
    const r = await backend.lookupFoodProduct(code('plausibel'));
    expect(r).toMatchObject({ code: 'found', mock: true, check: { level: 'ok' } });
    const s = stored(store);
    const record = s.foodProducts?.[code('plausibel')];
    expect(record).toMatchObject({ found: true, kcal: 380 });
    expect(JSON.stringify(s.foodProducts)).not.toContain(USER_ID);
    expect(s.productLookups).toEqual([
      { hour_start: '2026-10-03T10:00:00.000Z', lookups: 1, user_id: USER_ID },
    ]);
    expect(JSON.stringify(s.productLookups)).not.toContain(code('plausibel'));
  });

  it('Zeitlimit und 429 der Attrappe → nicht erreichbar; nicht gefunden', async () => {
    const { backend } = seededBackend(rows());
    expect(await backend.lookupFoodProduct(code('zeitlimit'))).toEqual({ code: 'unavailable' });
    expect(await backend.lookupFoodProduct(code('ueberlastet'))).toEqual({ code: 'unavailable' });
    expect(await backend.lookupFoodProduct(code('nicht_gefunden'))).toEqual({ code: 'not_found' });
  });

  it('Limit je Person: 61. Abfrage der Stunde → rate_limited', async () => {
    const { backend, store } = seededBackend(rows());
    const raw = JSON.parse(store.dump()['fitnessapp.local.v1'] ?? '{}') as Record<string, unknown>;
    await store.setItem(
      'fitnessapp.local.v1',
      JSON.stringify({
        ...raw,
        productLookups: [{ hour_start: '2026-10-03T10:00:00.000Z', lookups: 60, user_id: USER_ID }],
      }),
    );
    expect(await backend.lookupFoodProduct(code('plausibel'))).toEqual({
      code: 'rate_limited',
      scope: 'hour',
    });
  });
});

describe('Eintragen mit Herkunft product (Server rechnet nach – im Testmodus gleich)', () => {
  async function withProduct() {
    const seeded = seededBackend(rows());
    const r = await seeded.backend.lookupFoodProduct(code('plausibel'));
    if (r.code !== 'found') throw new Error('nicht gefunden');
    return { ...seeded, view: r.product };
  }
  const forEntry = (view: { code: string; name_de: string; brand_de: string | null }) => ({
    code: view.code,
    name_de: view.name_de,
    brand_de: view.brand_de,
    base_unit: 'g' as const,
    check_level: 'ok' as const,
    kcal: 380,
    protein_g: 10,
    carbs_g: 60,
    fat_g: 9,
  });

  it('Werte und Titel aus dem Zwischenspeicher, manipulierte Gerätewerte ersetzt', async () => {
    const { backend, view } = await withProduct();
    const built = entryFromProduct(forEntry(view), 50, target(1));
    if (!built.ok) throw new Error(built.reason);
    const next = await backend.saveFoodLogEntries(
      [{ ...built.entry, kcal: 1, title_de: 'Freitext' }],
      rows(),
    );
    expect(next.foodLogEntries[0]).toMatchObject({
      source: 'product',
      product_code: code('plausibel'),
      kcal: 190,
      title_de: 'Testprodukt Müsli (Testwerte) · Testmarke',
    });
  });

  it('Nummer ohne Speicher-Zeile → food_log_product_unavailable (Produkt neu abrufen)', async () => {
    const { backend } = seededBackend(rows());
    const built = entryFromProduct(
      forEntry({ code: code('getraenk'), name_de: 'x', brand_de: null }),
      50,
      target(2),
    );
    if (!built.ok) throw new Error(built.reason);
    await expectCode(
      backend.saveFoodLogEntries([built.entry], rows()),
      'food_log_product_unavailable',
    );
  });

  it('Ändern nach Ablauf des Speichers: verhältnisgleich aus dem Schnappschuss', async () => {
    const { backend, store, view } = await withProduct();
    const built = entryFromProduct(forEntry(view), 50, target(3));
    if (!built.ok) throw new Error(built.reason);
    const saved = await backend.saveFoodLogEntries([built.entry], rows());
    const raw = JSON.parse(store.dump()['fitnessapp.local.v1'] ?? '{}') as Record<string, unknown>;
    await store.setItem('fitnessapp.local.v1', JSON.stringify({ ...raw, foodProducts: {} }));
    const row = entryFromRow(saved.foodLogEntries[0]!);
    const next = await backend.saveFoodLogEntries([{ ...row, amount: 100, kcal: 0 }], saved);
    expect(next.foodLogEntries[0]).toMatchObject({ kcal: 380, amount: 100 });
  });

  it('Produkt-Favorit: nur Verweis + Menge; ohne Einwilligung keiner', async () => {
    const { backend, view } = await withProduct();
    const built = entryFromProduct(forEntry(view), 50, target(4));
    if (!built.ok) throw new Error(built.reason);
    const fav = favoriteFromEntry(built.entry);
    if (fav === null) throw new Error('kein Favorit');
    const next = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, rows());
    expect(next.foodLogFavorites[0]).toMatchObject({ source: 'product', kcal: null, amount: 50 });
    const noConsent = seededBackend(rows(false)).backend;
    await expectCode(
      noConsent.changeFoodLogFavorite({ op: 'set', favorite: fav }, rows(false)),
      'consent_required',
    );
  });
});

describe('Eigene Produkte (nur für die Person)', () => {
  it('anlegen, ändern, eintragen (fester Titel), löschen (Eintrag bleibt, Verweis leer)', async () => {
    const { backend } = seededBackend(rows());
    let r = await backend.saveUserFoodProduct(own(), rows());
    expect(r.userFoodProducts).toHaveLength(1);
    r = await backend.saveUserFoodProduct(own({ name_de: 'Hafermilch' }), r);
    expect(r.userFoodProducts[0]).toMatchObject({ name_de: 'Hafermilch', revision: 2 });
    const built = entryFromUserProduct(own(), 250, target(5));
    if (!built.ok) throw new Error(built.reason);
    r = await backend.saveFoodLogEntries([{ ...built.entry, kcal: 9 }], r);
    expect(r.foodLogEntries[0]).toMatchObject({
      title_de: USER_PRODUCT_ENTRY_TITLE,
      user_product_id: ID(100),
      kcal: 160,
    });
    expect(JSON.stringify(r.foodLogEntries)).not.toContain('Hafermilch');
    const fav = favoriteFromEntry(r.foodLogEntries[0] as FoodLogEntry);
    if (fav === null) throw new Error('kein Favorit');
    r = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, r);
    r = await backend.deleteUserFoodProduct(ID(100), r);
    expect(r.userFoodProducts).toEqual([]);
    expect(r.foodLogEntries[0]).toMatchObject({ user_product_id: null, kcal: 160 });
    expect(r.foodLogFavorites).toEqual([]);
  });

  it('ungültig (120 g Fett) bzw. ohne Einwilligung abgelehnt – Meldung ohne Name/Werte; Löschen geht immer', async () => {
    const { backend } = seededBackend(rows());
    await expectCode(
      backend.saveUserFoodProduct(own({ fat_g: 120 }), rows()),
      'user_product_rejected',
    );
    await expectCode(
      backend.saveUserFoodProduct(
        own({ kcal: 900, protein_g: 0, carbs_g: 0, fat_g: 100, base_unit: 'g', salt_g: 3 }),
        rows(),
      ),
      'user_product_rejected',
    );
    const noConsent = seededBackend(rows(false)).backend;
    await expectCode(noConsent.saveUserFoodProduct(own(), rows(false)), 'consent_required');
    const withOne = {
      ...rows(false),
      userFoodProducts: [
        {
          ...own(),
          user_id: USER_ID,
          revision: 1,
          last_write_id: ID(9),
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    };
    const deleted = await seededBackend(withOne).backend.deleteUserFoodProduct(ID(100), withOne);
    expect(deleted.userFoodProducts).toEqual([]);
  });

  it('höchstens 200 eigene Produkte', async () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      ...own({ id: ID(1000 + i), name_de: `P${i}` }),
      user_id: USER_ID,
      revision: 1,
      last_write_id: ID(9),
      created_at: NOW,
      updated_at: NOW,
    }));
    const base = { ...rows(), userFoodProducts: many };
    const { backend } = seededBackend(base);
    await expectCode(
      backend.saveUserFoodProduct(own({ id: ID(5000) }), base),
      'user_product_limit',
    );
    const changed = await backend.saveUserFoodProduct(own({ id: ID(1000), name_de: 'Neu' }), base);
    expect(changed.userFoodProducts).toHaveLength(200);
  });

  it('Widerruf health_data löscht eigene Produkte und Produkt-Favoriten (E4-G10), Katalog-Favoriten bleiben', async () => {
    const { backend } = seededBackend(rows());
    let r = await backend.saveUserFoodProduct(own(), rows());
    const lookedUp = await backend.lookupFoodProduct(code('plausibel'));
    expect(lookedUp.code).toBe('found');
    const built = entryFromUserProduct(own(), 250, target(6));
    if (!built.ok) throw new Error(built.reason);
    r = await backend.saveFoodLogEntries([built.entry], r);
    const fav = favoriteFromEntry(r.foodLogEntries[0] as FoodLogEntry);
    if (fav === null) throw new Error('kein Favorit');
    r = await backend.changeFoodLogFavorite({ op: 'set', favorite: fav }, r);
    // Produkt-Favorit mit Nummer (Open Food Facts) – nur Verweis + Menge, auch er geht beim Widerruf.
    if (lookedUp.code !== 'found') throw new Error('nicht gefunden');
    const offBuilt = entryFromProduct(
      {
        code: lookedUp.product.code,
        name_de: lookedUp.product.name_de,
        brand_de: lookedUp.product.brand_de,
        base_unit: 'g',
        check_level: 'ok',
        kcal: 380,
        protein_g: 10,
        carbs_g: 60,
        fat_g: 9,
      },
      50,
      target(7),
    );
    if (!offBuilt.ok) throw new Error(offBuilt.reason);
    const offFav = favoriteFromEntry(offBuilt.entry);
    if (offFav === null) throw new Error('kein Favorit');
    r = await backend.changeFoodLogFavorite({ op: 'set', favorite: offFav }, r);
    expect(r.foodLogFavorites.map((f) => f.source).sort()).toEqual(['product', 'product']);
    await backend.changeFoodLogFavorite(
      {
        op: 'set',
        favorite: {
          fav_key: 'food|haferflocken',
          source: 'food',
          food_id: 'haferflocken',
          recipe_id: null,
          product_code: null,
          user_product_id: null,
          title_de: 'Haferflocken',
          amount: 60,
          unit: 'g',
          portion: null,
          kcal: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
        },
      },
      r,
    );
    await backend.revokeHealthData(false, null);
    const after = (await backend.loadRows()).rows;
    expect(after.userFoodProducts).toEqual([]);
    expect(after.foodLogEntries).toEqual([]);
    expect(after.foodLogFavorites.map((f) => f.source)).toEqual(['food']);
  });

  it('Export: eigene Produkte (Spalten wie user_food_products) und Zähler ohne Nummern; Konto löschen', async () => {
    const { backend, store } = seededBackend(rows());
    await backend.saveUserFoodProduct(own(), rows());
    await backend.lookupFoodProduct(code('plausibel'));
    const file = await backend.exportMyData();
    expect(Object.keys(file.data.user_food_products[0] as object).sort()).toEqual(
      [
        'id',
        'user_id',
        'name_de',
        'brand_de',
        'code',
        'base_unit',
        'kcal',
        'protein_g',
        'carbs_g',
        'fat_g',
        'sugar_g',
        'salt_g',
        'serving_g',
        'based_on_off',
        'revision',
        'last_write_id',
        'created_at',
        'updated_at',
      ].sort(),
    );
    expect(file.data.food_product_lookup_counts).toEqual([
      { hour_start: '2026-10-03T10:00:00.000Z', lookups: 1 },
    ]);
    expect(JSON.stringify(file.data)).not.toContain(code('plausibel'));
    await backend.deleteAccount();
    const again = localBackendOn(store, TODAY, NOW);
    expect(await again.getSession()).toBeNull();
  });

  it('Gerätespeicher ist nicht vertrauenswürdig: fremde/ungültige Produkte fallen weg, Verweise werden leer', () => {
    const good = {
      ...own(),
      user_id: USER_ID,
      revision: 1,
      last_write_id: ID(9),
      created_at: NOW,
      updated_at: NOW,
    };
    const built = entryFromUserProduct(own({ id: ID(101) }), 250, target(7));
    if (!built.ok) throw new Error(built.reason);
    const upgraded = upgradeStoredRows({
      ...rows(),
      userFoodProducts: [
        good,
        { ...good, id: ID(101), user_id: 'fremd' },
        { ...good, id: ID(102), fat_g: 120 },
      ],
      foodLogEntries: [
        {
          ...built.entry,
          user_id: USER_ID,
          revision: 1,
          last_write_id: ID(8),
          created_at: NOW,
          updated_at: NOW,
        },
      ],
    });
    expect(upgraded.userFoodProducts.map((p) => p.id)).toEqual([ID(100)]);
    expect(upgraded.foodLogEntries[0]).toMatchObject({ user_product_id: null });
  });
});

describe('Supabase-Seite: Route POST /api/ernaehrung/produkt (Ersatz-fetch)', () => {
  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { access_token: 'tok-123' } }, error: null }),
    },
  } as unknown as AppSupabaseClient;

  it('Nummer nur im Körper, Login-Token als Bearer, Antwort Zod-geprüft', async () => {
    const fetchFn = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ code: 'not_found' }), { status: 200 })),
    );
    const remote = createRemoteFoodProduct({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(await remote.lookupFoodProduct(code('plausibel'))).toEqual({ code: 'not_found' });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('https://web.example.test/api/ernaehrung/produkt');
    expect(url).not.toContain(code('plausibel'));
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ code: code('plausibel') });
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok-123' });
  });

  it('ohne Adresse der Website → not_configured; kaputte Antwort → Fehler; offline → network', async () => {
    expect(await createRemoteFoodProduct({ client, webUrl: null }).lookupFoodProduct('1')).toEqual({
      code: 'not_configured',
    });
    const bad = createRemoteFoodProduct({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: (() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'boese' })),
        )) as unknown as typeof fetch,
    });
    await expectCode(bad.lookupFoodProduct('1'), 'unknown');
    const offline = createRemoteFoodProduct({
      client,
      webUrl: 'https://web.example.test',
      fetchFn: (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch,
    });
    await expectCode(offline.lookupFoodProduct('1'), 'network');
  });
});
