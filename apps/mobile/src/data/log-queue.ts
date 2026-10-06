import { neutralizeSessionLogPayload, type SessionLogPayload } from '@fitnessapp/core';

import { neutralizeDraft } from './draft-store';
import type { ProtectedStore } from './protected-store';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';

/**
 * Eigene Tagebuch-Warteschlange (docs/PLAN-PHASE-4.md 4.3): save_session_log läuft NICHT über die normale SyncQueue
 * (dort würde SyncQueue.load() Direkt-Vorgänge still verwerfen). Gleiche Logik wie SyncQueue – ersetzen per
 * Schlüssel, Reihenfolge, Netzwerkfehler = später –, aber gespeichert als EIN Text im geschützten Speicher
 * `logQueue` (App verschlüsselt, Browser sessionStorage) und nie stilles Verwerfen:
 * - Schlüssel `save_session_log:<planned_session_id>` (ohne Planbezug `:<id>`); eine neuere Fassung ersetzt die
 *   ältere, die `base_revision` bleibt die der zuletzt BESTÄTIGTEN Fassung (W3).
 * - Jede Fassung trägt eine `write_id` (R4); Neuversuche senden dieselbe.
 * - Netzwerkfehler und 401 (Sitzung abgelaufen) = später erneut, nie verwerfen.
 * - `conflict` (W3) und inhaltliche Ablehnung: ERST als Entwurf sichern (onConflict/onRejected), DANN aus der
 *   Warteschlange entfernen.
 * - Konto-Bindung (R5): gesendet wird nur, wenn das angemeldete Konto dem der Warteschlange entspricht.
 * - Vor einem Widerruf wird das Senden gesperrt (R3) und die Warteschlange bereinigt (cleanHealthPlanEntries).
 */

export interface LogQueueEntry {
  key: string;
  payload: SessionLogPayload;
  /** Entwurf, aus dem die Fassung stammt – wird bei Konflikt/Ablehnung wiederhergestellt. */
  draft: WorkoutDraft;
  /** Lokal: Eintrag aus einem Plan mit Gesundheits-Check (S1, nie gesendet). */
  fromHealthPlan: boolean;
}

/** Antwort von save_session_log. */
export interface SaveLogResponse {
  result: 'ok' | 'orphaned' | 'conflict';
  id: string | null;
  revision: number | null;
  exercise_ids?: Record<string, string>;
}

export type LogFlushResult =
  /** Warteschlange leer. */
  | 'done'
  /** offline bzw. Sitzung abgelaufen – später erneut. */
  | 'later'
  /** gesperrt (Widerruf läuft). */
  | 'locked'
  /** Einträge gehören einem anderen Konto (R5) – nichts gesendet. */
  | 'foreign';

interface StoredQueue {
  format: 1;
  ownerUserId: string | null;
  entries: LogQueueEntry[];
}

/** Die Warteschlange gehört einem anderen Konto (R5) – nie mischen. */
export class ForeignQueueError extends Error {
  constructor() {
    super('LogQueue: Einträge eines anderen Kontos.');
    this.name = 'ForeignQueueError';
  }
}

export function logQueueKey(payload: Pick<SessionLogPayload, 'planned_session_id' | 'id'>): string {
  return `save_session_log:${payload.planned_session_id ?? payload.id}`;
}

export interface LogQueueOptions {
  store: ProtectedStore;
  /** Sendet eine Fassung (save_session_log). Wirft bei Fehlern. */
  execute: (payload: SessionLogPayload) => Promise<SaveLogResponse>;
  /** Fehler einordnen: 'retry' = Netz/Sitzung (später), sonst Grund der Ablehnung. */
  classify: (error: unknown) => 'retry' | LogRejectReason;
  /** Angemeldetes Konto (null = keins). */
  currentUserId: () => string | null;
  onSaved?: (entry: LogQueueEntry, response: SaveLogResponse) => Promise<void> | void;
  /** Konflikt: lokale Fassung als Entwurf sichern (MUSS gespeichert sein, bevor der Eintrag entfernt wird). */
  onConflict: (entry: LogQueueEntry, response: SaveLogResponse) => Promise<void>;
  /** Abgelehnt: als Entwurf sichern (vor dem Entfernen). Ohne Inhalte loggen! */
  onRejected: (entry: LogQueueEntry, reason: LogRejectReason) => Promise<void>;
}

export class LogQueue {
  private entries: LogQueueEntry[] = [];
  private owner: string | null = null;
  private loaded = false;
  private locked = false;
  private flushing: Promise<LogFlushResult> | null = null;

  constructor(private readonly options: LogQueueOptions) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    const raw = await this.options.store.read();
    if (this.loaded) return;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredQueue;
        if (parsed.format === 1 && Array.isArray(parsed.entries)) {
          this.entries = parsed.entries;
          this.owner = parsed.ownerUserId;
        }
      } catch {
        // Unlesbar (z. B. beschädigt): leer – der Speicher selbst verwirft unlesbaren Geheimtext.
      }
    }
    this.loaded = true;
  }

  size(): number {
    return this.entries.length;
  }

  snapshot(): readonly LogQueueEntry[] {
    return this.entries;
  }

  ownerUserId(): string | null {
    return this.entries.length > 0 ? this.owner : null;
  }

  /** Liegen wartende Einträge eines ANDEREN Kontos auf dem Gerät (R5)? */
  async hasForeign(userId: string): Promise<boolean> {
    await this.load();
    return this.entries.length > 0 && this.owner !== null && this.owner !== userId;
  }

  /**
   * Fassung einreihen (ersetzt eine ältere derselben Einheit; deren base_revision bleibt). Wirft, wenn die
   * Warteschlange einem anderen Konto gehört (nie mischen, R5).
   */
  async add(entry: LogQueueEntry, ownerUserId: string): Promise<void> {
    await this.load();
    if (this.entries.length > 0 && this.owner !== null && this.owner !== ownerUserId) {
      throw new ForeignQueueError();
    }
    const previous = this.entries.find((e) => e.key === entry.key);
    const next: LogQueueEntry = previous
      ? { ...entry, payload: { ...entry.payload, base_revision: previous.payload.base_revision } }
      : entry;
    this.owner = ownerUserId;
    this.entries = [...this.entries.filter((e) => e.key !== entry.key), next];
    await this.persist();
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  isLocked(): boolean {
    return this.locked;
  }

  flush(): Promise<LogFlushResult> {
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  /** Wartet auf ein laufendes Senden (z. B. vor dem Sperren beim Widerruf). */
  async idle(): Promise<void> {
    await this.flushing?.catch(() => undefined);
  }

  /**
   * Einträge aus Plänen mit Gesundheits-Check bereinigen (S1, R3): neutralisieren (Vorgaben/Zustand leer, Name
   * neutral, Kennzeichen false) oder – bei „auch löschen“ – entfernen.
   */
  async cleanHealthPlanEntries(mode: 'neutralize' | 'delete'): Promise<void> {
    await this.load();
    if (!this.entries.some((e) => e.fromHealthPlan)) return;
    this.entries =
      mode === 'delete'
        ? this.entries.filter((e) => !e.fromHealthPlan)
        : this.entries.map((e) =>
            e.fromHealthPlan
              ? {
                  ...e,
                  fromHealthPlan: false,
                  payload: neutralizeSessionLogPayload(e.payload),
                  draft: neutralizeDraft(e.draft),
                }
              : e,
          );
    await this.persist();
  }

  hasHealthPlanEntries(): boolean {
    return this.entries.some((e) => e.fromHealthPlan);
  }

  /** Daten UND Schlüssel löschen (Abmelden, Konto löschen, Testdaten löschen). */
  async clear(): Promise<void> {
    this.entries = [];
    this.owner = null;
    this.loaded = true;
    await this.persist();
  }

  private async runFlush(): Promise<LogFlushResult> {
    await this.load();
    if (this.entries.length === 0) return 'done';
    if (this.locked) return 'locked';
    const current = this.options.currentUserId();
    if (current === null) return 'later';
    if (this.owner !== null && this.owner !== current) return 'foreign';
    while (this.entries.length > 0) {
      if (this.locked) return 'locked';
      const [entry] = this.entries;
      if (!entry) break;
      try {
        const response = await this.options.execute(entry.payload);
        if (response.result === 'conflict') {
          await this.options.onConflict(entry, response);
        } else {
          await this.options.onSaved?.(entry, response);
          // Während des Sendens kam eine neuere Fassung derselben Einheit dazu: sie baut jetzt auf der eben
          // bestätigten Revision auf (sonst gäbe es einen Konflikt mit sich selbst).
          this.entries = this.entries.map((candidate) =>
            candidate !== entry && candidate.key === entry.key && response.revision !== null
              ? {
                  ...candidate,
                  payload: {
                    ...candidate.payload,
                    id: response.id ?? candidate.payload.id,
                    base_revision: response.revision,
                  },
                }
              : candidate,
          );
        }
      } catch (error) {
        const kind = this.options.classify(error);
        if (kind === 'retry') return 'later';
        await this.options.onRejected(entry, kind);
      }
      // Nur den gesendeten Eintrag entfernen – zwischenzeitlich ersetzte/ergänzte Einträge bleiben.
      this.entries = this.entries.filter((candidate) => candidate !== entry);
      await this.persist();
    }
    return 'done';
  }

  /** Schreibvorgänge nacheinander (Wächter C1 B1) – der zuletzt veranlasste Stand landet zuletzt. */
  private persistChain: Promise<void> = Promise.resolve();

  private persist(): Promise<void> {
    const snapshot =
      this.entries.length === 0
        ? null
        : JSON.stringify({
            format: 1,
            ownerUserId: this.owner,
            entries: this.entries,
          } satisfies StoredQueue);
    if (snapshot === null) this.owner = null;
    const run = () =>
      snapshot === null ? this.options.store.clear() : this.options.store.write(snapshot);
    const next = this.persistChain.then(run, run);
    this.persistChain = next.catch(() => undefined);
    return next;
  }
}
