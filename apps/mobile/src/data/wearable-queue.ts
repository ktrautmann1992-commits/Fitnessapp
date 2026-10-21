import {
  type WearableImportBatch,
  wearableImportBatchSchema,
  type WearableImportResult,
  type WearableRows,
} from '@fitnessapp/core';

import type { ProtectedStore } from './protected-store';

/**
 * Warteschlange für Smartwatch-Abgleiche (Phase 8, Supabase-Modus, docs/PLAN-PHASE-8.md 7.1 „offline-first“): Ein
 * gelesener Abgleich geht erst in diese VERSCHLÜSSELTE Warteschlange (geschützter Speicher `wearableQueue`, Browser:
 * sessionStorage) und wird gesendet, sobald Verbindung besteht – NACH den Tagebuch-Einträgen, auf die er verweist
 * (Zusammenführen/Doppel-Hinweis). Teilerfolge bleiben: jeder gesendete Teil wird sofort entfernt. Daneben liegt hier
 * der zuletzt geladene Stand (offline anzeigen). Gehört einem Konto; Abmelden/Konto löschen/Trennen leeren alles.
 * Gesundheitsdaten (Art. 9): nie loggen.
 */

export type WearableSendResult =
  | { readonly kind: 'ok'; readonly result: WearableImportResult }
  /** Später erneut (offline, Sitzung abgelaufen, Server vorübergehend). */
  | { readonly kind: 'retry' }
  /** Einwilligung fehlt – alles verwerfen (keine Gesundheitsdaten ohne Einwilligung aufbewahren). */
  | { readonly kind: 'consent' }
  /** Aufbau abgelehnt – dieser Teil kann nie gelingen, verwerfen. */
  | { readonly kind: 'reject' };

interface StoredQueue {
  format: 1;
  owner: string;
  batches: WearableImportBatch[];
  cache: WearableRows | null;
}

export interface WearableFlushResult {
  readonly state: 'done' | 'later' | 'consent' | 'rejected';
  /** Summen der in diesem Lauf gesendeten Teile. */
  readonly result: WearableImportResult;
}

const ZERO: WearableImportResult = { created: 0, updated: 0, merged: 0, skipped: 0, days: 0 };

export class WearableQueue {
  private data: StoredQueue | null = null;
  private loaded = false;
  private running: Promise<WearableFlushResult> | null = null;

  constructor(
    private readonly options: {
      store: ProtectedStore;
      send: (batch: WearableImportBatch) => Promise<WearableSendResult>;
      /** Wartet ein Tagebuch-Eintrag, auf den der Abgleich verweist, noch in seiner Warteschlange? */
      isLogPending: (sessionLogId: string) => boolean;
      currentUserId: () => string | null;
    },
  ) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const text = await this.options.store.read();
      const parsed = text ? (JSON.parse(text) as StoredQueue) : null;
      this.data =
        parsed &&
        parsed.format === 1 &&
        typeof parsed.owner === 'string' &&
        Array.isArray(parsed.batches)
          ? {
              ...parsed,
              // Nur gültige Abgleiche (Zod) – kaputte werden nie gesendet.
              batches: parsed.batches.filter((b) => wearableImportBatchSchema.safeParse(b).success),
            }
          : null;
    } catch {
      this.data = null;
    }
  }

  private async persist(): Promise<void> {
    if (this.data) await this.options.store.write(JSON.stringify(this.data));
  }

  private async own(owner: string): Promise<StoredQueue> {
    await this.load();
    if (!this.data || this.data.owner !== owner) {
      this.data = { format: 1, owner, batches: [], cache: null };
    }
    return this.data;
  }

  /** Wartende Abgleiche des angemeldeten Kontos. */
  async size(): Promise<number> {
    await this.load();
    const owner = this.options.currentUserId();
    return this.data && owner && this.data.owner === owner ? this.data.batches.length : 0;
  }

  async add(batches: readonly WearableImportBatch[], owner: string): Promise<void> {
    const data = await this.own(owner);
    data.batches = [...data.batches, ...batches];
    await this.persist();
  }

  async readCache(): Promise<WearableRows | null> {
    await this.load();
    const owner = this.options.currentUserId();
    return this.data && owner && this.data.owner === owner ? this.data.cache : null;
  }

  async writeCache(rows: WearableRows, owner: string): Promise<void> {
    const data = await this.own(owner);
    data.cache = rows;
    await this.persist();
  }

  /** Wartende Abgleiche verwerfen (Trennen, Widerruf); der Zwischenstand bleibt nur ohne Gesundheitswerte leer. */
  async discardAll(): Promise<void> {
    await this.load();
    if (!this.data) return;
    this.data = { ...this.data, batches: [], cache: null };
    await this.persist();
  }

  async clear(): Promise<void> {
    this.data = null;
    this.loaded = true;
    await this.options.store.clear();
  }

  /** Wartende Abgleiche senden (nacheinander). */
  flush(): Promise<WearableFlushResult> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run(): Promise<WearableFlushResult> {
    await this.load();
    const owner = this.options.currentUserId();
    let total = ZERO;
    if (!this.data || !owner || this.data.owner !== owner) return { state: 'done', result: total };
    let state: WearableFlushResult['state'] = 'done';
    while (this.data.batches.length > 0) {
      const batch = this.data.batches[0] as WearableImportBatch;
      const waits = batch.sessions.some(
        (s) =>
          (s.merge_into !== null && this.options.isLogPending(s.merge_into)) ||
          (s.possible_duplicate_of !== null && this.options.isLogPending(s.possible_duplicate_of)),
      );
      if (waits) {
        state = 'later';
        break;
      }
      const outcome = await this.options.send(batch);
      if (outcome.kind === 'retry') {
        state = 'later';
        break;
      }
      if (outcome.kind === 'consent') {
        this.data.batches = [];
        this.data.cache = null;
        await this.persist();
        return { state: 'consent', result: total };
      }
      this.data.batches = this.data.batches.slice(1);
      await this.persist();
      if (outcome.kind === 'reject') {
        state = 'rejected';
        continue;
      }
      const r = outcome.result;
      total = {
        created: total.created + r.created,
        updated: total.updated + r.updated,
        merged: total.merged + r.merged,
        skipped: total.skipped + r.skipped,
        days: total.days + r.days,
      };
    }
    return { state, result: total };
  }
}
