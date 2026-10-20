import {
  type TrackedRoutePayload,
  type TrackedRouteRow,
  trackedRouteSchema,
} from '@fitnessapp/core';

import type { ProtectedStore } from './protected-store';

/**
 * Warteschlange für Strecken (Etappe E4, Supabase-Modus): Eine gespeicherte Aufzeichnung geht erst in diese
 * VERSCHLÜSSELTE Warteschlange (geschützter Speicher `routeQueue`, Browser: sessionStorage) und wird gesendet, sobald
 * Verbindung besteht – NACH dem verknüpften Tagebuch-Eintrag (Plan S1: erst save_session_log, dann save_tracked_route).
 * Daneben liegt hier die zuletzt geladene Liste der eigenen Strecken (für „Meine Läufe“ ohne Netz). Gehört einem Konto;
 * Abmelden/Konto löschen leeren alles. Keine Koordinaten in Logs.
 */

export type RouteSendResult =
  /** Gespeichert (auch: dieselbe id lag schon vor). */
  | 'ok'
  /** Später erneut (offline, Sitzung abgelaufen, Server vorübergehend). */
  | 'retry'
  /** Verknüpfung passt nicht (Eintrag fehlt/abgelehnt, Favorit weg) → ohne Verweise erneut senden. */
  | 'unlink'
  /** Abgelehnt (Tageslimit, ungültig) – bleibt sichtbar mit Hinweis, nie still verwerfen. */
  | 'reject';

export interface PendingRoute {
  payload: TrackedRoutePayload;
  state: 'waiting' | 'rejected';
}

interface StoredQueue {
  format: 1;
  owner: string;
  entries: PendingRoute[];
  /** Zuletzt geladene eigene Strecken (offline anzeigen). */
  cache: TrackedRouteRow[] | null;
}

export class RouteQueue {
  private data: StoredQueue | null = null;
  private loaded = false;
  private running: Promise<'done' | 'later'> | null = null;

  constructor(
    private readonly options: {
      store: ProtectedStore;
      send: (payload: TrackedRoutePayload) => Promise<RouteSendResult>;
      /** Wartet der verknüpfte Tagebuch-Eintrag noch in seiner Warteschlange? Dann noch nicht senden. */
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
        Array.isArray(parsed.entries)
          ? {
              ...parsed,
              // Nur gültige Eingaben (Zod) – kaputte Einträge werden nie gesendet.
              entries: parsed.entries.filter(
                (e) => trackedRouteSchema.safeParse(e.payload).success,
              ),
            }
          : null;
    } catch {
      this.data = null;
    }
  }

  private async persist(): Promise<void> {
    if (this.data) await this.options.store.write(JSON.stringify(this.data));
  }

  /** Einträge des angemeldeten Kontos (anderes Konto → leer). */
  async entries(): Promise<PendingRoute[]> {
    await this.load();
    const owner = this.options.currentUserId();
    return this.data && owner && this.data.owner === owner ? [...this.data.entries] : [];
  }

  async size(): Promise<number> {
    return (await this.entries()).filter((e) => e.state === 'waiting').length;
  }

  private async own(owner: string): Promise<StoredQueue> {
    await this.load();
    if (!this.data || this.data.owner !== owner) {
      this.data = { format: 1, owner, entries: [], cache: null };
    }
    return this.data;
  }

  async add(payload: TrackedRoutePayload, owner: string): Promise<void> {
    const data = await this.own(owner);
    data.entries = [
      ...data.entries.filter((e) => e.payload.id !== payload.id),
      { payload, state: 'waiting' },
    ];
    await this.persist();
  }

  async discard(id: string): Promise<void> {
    await this.load();
    if (!this.data) return;
    this.data.entries = this.data.entries.filter((e) => e.payload.id !== id);
    await this.persist();
  }

  /** Abgelehnte Strecke erneut versuchen. */
  async retry(id: string): Promise<void> {
    await this.load();
    if (!this.data) return;
    this.data.entries = this.data.entries.map((e) =>
      e.payload.id === id ? { ...e, state: 'waiting' } : e,
    );
    await this.persist();
  }

  async readCache(): Promise<TrackedRouteRow[] | null> {
    await this.load();
    const owner = this.options.currentUserId();
    return this.data && owner && this.data.owner === owner ? this.data.cache : null;
  }

  async writeCache(routes: TrackedRouteRow[], owner: string): Promise<void> {
    const data = await this.own(owner);
    data.cache = routes;
    await this.persist();
  }

  async clear(): Promise<void> {
    this.data = null;
    this.loaded = true;
    await this.options.store.clear();
  }

  /** Wartende Strecken senden (nacheinander); 'later' = etwas wartet weiter. */
  flush(): Promise<'done' | 'later'> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run(): Promise<'done' | 'later'> {
    await this.load();
    const owner = this.options.currentUserId();
    if (!this.data || !owner || this.data.owner !== owner) return 'done';
    let result: 'done' | 'later' = 'done';
    for (const entry of [...this.data.entries]) {
      if (entry.state !== 'waiting') continue;
      const logId = entry.payload.session_log_id;
      if (logId !== null && this.options.isLogPending(logId)) {
        result = 'later';
        continue;
      }
      let outcome = await this.options.send(entry.payload);
      let payload = entry.payload;
      if (outcome === 'unlink') {
        payload = { ...payload, session_log_id: null, base_route_id: null };
        outcome = await this.options.send(payload);
      }
      if (outcome === 'retry') {
        result = 'later';
        break;
      }
      this.data.entries =
        outcome === 'ok'
          ? this.data.entries.filter((e) => e.payload.id !== entry.payload.id)
          : this.data.entries.map((e) =>
              e.payload.id === entry.payload.id ? { payload, state: 'rejected' } : e,
            );
      await this.persist();
    }
    return result;
  }
}
