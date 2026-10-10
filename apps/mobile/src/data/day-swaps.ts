import {
  activePlan,
  allSessions,
  type DaySwap,
  daySwapSchema,
  parseStoredDaySwaps,
  pruneDaySwaps,
} from '@fitnessapp/core';

import { type KeyValueStore, STORAGE_KEYS } from './kv';
import type { UserRows } from './types';

/**
 * „Nur heute“ vor dem Training (Day-Swaps, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 5.1/9, Wächter B3/S5) – NUR der
 * Gerätespeicher, keine Fachlogik: Prüfen beim Lesen, Anwenden und Aufräumen stehen in packages/core
 * (parseStoredDaySwaps, applyDaySwaps über prepareSessionForDisplay, pruneDaySwaps).
 *
 * Eigener Schlüssel `fitnessapp.day-swaps.v1` (in STORAGE_KEYS, damit „Alles auf dem Gerät löschen“ ihn mitnimmt).
 * Kein Gesundheitsdatum (nur IDs und Datum), unverschlüsselt, nicht geräteübergreifend (Frage 7); gilt in beiden
 * Betriebsarten gleich. Einträge anderer Konten bleiben beim Schreiben unverändert liegen (wie Entwürfe, R5).
 */
export interface DaySwapStore {
  /** Gültige Einträge (Zod je Eintrag) des Kontos; kaputter Speicher → leer. */
  load(ownerUserId: string): Promise<DaySwap[]>;
  /** Einträge des Kontos ersetzen (andere Konten bleiben). */
  save(ownerUserId: string, swaps: readonly DaySwap[]): Promise<void>;
  /** Alle Einträge des Kontos entfernen (Abmelden, Konto löschen). */
  removeOwner(ownerUserId: string): Promise<void>;
}

/** Gültige Einträge ANDERER Konten (beim Schreiben beibehalten; kaputte Einträge fallen weg). */
function foreignEntries(raw: string | null, ownerUserId: string): DaySwap[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = daySwapSchema.safeParse(item);
    return parsed.success && parsed.data.ownerUserId !== ownerUserId ? [parsed.data] : [];
  });
}

export function createDaySwapStore(store: KeyValueStore): DaySwapStore {
  const key = STORAGE_KEYS.daySwaps;
  async function write(ownerUserId: string, own: readonly DaySwap[]): Promise<void> {
    const others = foreignEntries(await store.getItem(key), ownerUserId);
    const all = [...others, ...own];
    if (all.length === 0) await store.removeItem(key);
    else await store.setItem(key, JSON.stringify(all));
  }
  return {
    load: async (ownerUserId) => parseStoredDaySwaps(await store.getItem(key), ownerUserId),
    save: (ownerUserId, swaps) =>
      write(
        ownerUserId,
        swaps.filter((s) => s.ownerUserId === ownerUserId),
      ),
    removeOwner: (ownerUserId) => write(ownerUserId, []),
  };
}

/**
 * Aufräumen beim Laden (Core pruneDaySwaps): Einheit fehlt, nicht mehr geplant, vorbei (und nicht nachholbar) oder
 * Plan ersetzt → weg.
 */
export function prunedDaySwaps(
  rows: UserRows,
  swaps: readonly DaySwap[],
  today: string,
): DaySwap[] {
  return pruneDaySwaps(swaps, allSessions(rows), {
    today,
    activePlanId: activePlan(rows)?.plan.id ?? null,
  });
}

/**
 * Widerruf health_data (9, wie cleanHealthPlanDrafts): Day-Swaps zu Plänen mit Gesundheitsbezug entfernen – diese
 * Pläne werden dabei gelöscht, die Einträge wären verwaist.
 */
export function withoutHealthPlanSwaps(rows: UserRows, swaps: readonly DaySwap[]): DaySwap[] {
  const healthPlans = new Set(rows.plans.filter((p) => p.uses_health_data).map((p) => p.id));
  return swaps.filter((s) => !healthPlans.has(s.planId));
}
