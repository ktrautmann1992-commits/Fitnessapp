import {
  countProductLookup,
  type FoodProductRecord,
  hasValidConsent,
  mockOffFetch,
  type ProductForEntry,
  productForEntryOf,
  productLookupLimit,
  type ProductLookupCount,
  type ProductLookupResponse,
  productRecordExpired,
  productRecordFresh,
  runProductLookup,
} from '@fitnessapp/core';

import { consentRecordsFromRows, type ConsentVersions } from './mapping';
import type { UserRows } from './types';

/**
 * Produktabfrage im TESTMODUS (Etappe E4a, docs/PLAN-E4.md 3.2 „Testmodus“): dieselbe Kette wie die Route
 * (`runProductLookup`) mit denselben Regeln wie die Datenbank-Funktion food_product_lookup – aber auf dem Gerät und
 * immer mit der ATTRAPPE (`mockOffFetch`: feste Testnummern, ausgedachte Testwerte, kein Netz, nie Open Food Facts).
 * Gespeichert werden der Zwischenspeicher (ohne Personenbezug, wie food_products) und die Zähler je Stunde ohne Nummer
 * (wie food_product_lookup_counts, Export).
 */

export interface LocalProductLookupCount extends ProductLookupCount {
  readonly user_id: string;
}

export interface LocalProductState {
  /** Zwischenspeicher (Nummer → Zeile), ohne Personenbezug. */
  readonly foodProducts: Readonly<Record<string, FoodProductRecord>>;
  /** Zähler je Person und Stunde (ohne Nummer). */
  readonly productLookups: readonly LocalProductLookupCount[];
}

export async function runLocalProductLookup(
  state: LocalProductState,
  input: {
    rows: UserRows;
    versions: ConsentVersions;
    userId: string;
    now: string;
    code: unknown;
  },
): Promise<{ response: ProductLookupResponse; state: LocalProductState }> {
  // Abgelaufene Zeilen und alte Zähler wie purge_food_products.
  let products: Record<string, FoodProductRecord> = Object.fromEntries(
    Object.entries(state.foodProducts).filter(([, r]) => !productRecordExpired(r, input.now)),
  );
  let counts = [...state.productLookups];
  const own = () => counts.filter((c) => c.user_id === input.userId);
  const count = () => {
    const next = countProductLookup(own(), input.now).map((c) => ({ ...c, user_id: input.userId }));
    counts = [...counts.filter((c) => c.user_id !== input.userId), ...next];
  };
  const result = await runProductLookup(
    { code: input.code },
    {
      begin: (code) => {
        const consent = hasValidConsent(
          consentRecordsFromRows(input.rows.consents),
          'health_data',
          input.versions.health_data,
        );
        if (!consent) return Promise.resolve({ result: 'no_consent' as const });
        const limit = productLookupLimit(own(), input.now);
        if (limit !== null)
          return Promise.resolve({ result: 'rate_limited' as const, scope: limit });
        const record = products[code] ?? null;
        count();
        if (record !== null && productRecordFresh(record, input.now)) {
          return Promise.resolve({ result: 'cached' as const, record, stale: false });
        }
        return Promise.resolve({ result: 'fetch' as const, record });
      },
      fetchOff: mockOffFetch,
      store: (record) => {
        products = { ...products, [record.code]: record };
        return Promise.resolve();
      },
      backoff: () => Promise.resolve(),
      now: () => input.now,
      mock: true,
    },
  );
  return { response: result.body, state: { foodProducts: products, productLookups: counts } };
}

/** Speicher-Zeile → Produkt für die Nachrechnung beim Speichern (abgelaufen/unbekannt → null). */
export function localProductFor(
  state: Pick<LocalProductState, 'foodProducts'>,
  now: string,
): (code: string) => ProductForEntry | null {
  return (code) => {
    const record = state.foodProducts[code];
    if (record === undefined || productRecordExpired(record, now)) return null;
    return productForEntryOf(record);
  };
}
