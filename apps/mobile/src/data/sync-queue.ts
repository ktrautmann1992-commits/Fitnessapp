import { readJson, writeJson, type KeyValueStore } from './kv';
import { isDirectOp, type WriteOp } from './write-ops';

/**
 * Einfache Offline-Warteschlange für den Supabase-Modus.
 *
 * Nur NICHT-Gesundheitsdaten (Profil-Fortschritt, Ziel, Trainingstage, Equipment, Ernährung, Vorlieben, Mess-Erinnerung,
 * Verschieben einer Einheit eines Plans OHNE Gesundheitsbezug)
 * landen hier und damit auf dem Gerät. Gesundheitsdaten und Einwilligungen werden nie eingereiht, sondern
 * sofort gesendet (isDirectOp) – scheitert das, zeigt der Bildschirm „Erneut versuchen“.
 *
 * Neuere Änderungen an derselben Stelle ersetzen ältere (z. B. zweimal „Ziel“ → nur das neueste wird gesendet).
 * Profil-Änderungen werden zusammengeführt und immer ans Ende gestellt, damit der Fortschritt erst nach den
 * zugehörigen Daten in der Datenbank ankommt.
 */

export interface QueueEntry {
  key: string;
  op: WriteOp;
}

/** Spalten, die es in goals seit Etappe B2 nicht mehr gibt (jetzt Tabelle training_slots). */
const LEGACY_GOALS_COLUMNS = ['sessions_per_week', 'minutes_per_session', 'preferred_days'];

/**
 * Wartender upsert_goals-Vorgang einer App-Version vor Etappe B2? Er wird beim Laden still verworfen, NICHT
 * umgewandelt (Erweiterungsplan 4.5): Die Trainingstage werden mit dem neuen Schritt ohnehin neu erfasst, und eine
 * Umwandlung könnte einen neueren Stand überschreiben. Ziel und Ort schreibt der nächste Schritt erneut.
 */
export function isLegacyGoalsOp(op: WriteOp): boolean {
  return (
    op.kind === 'upsert_goals' &&
    LEGACY_GOALS_COLUMNS.some((column) => Object.hasOwn(op.row, column))
  );
}

/** Schlüssel, unter dem ein Vorgang ältere Vorgänge derselben Art ersetzt. */
export function queueKey(op: WriteOp): string {
  switch (op.kind) {
    case 'replace_user_equipment':
      return `${op.kind}:${op.location}`;
    case 'replace_food_preferences':
      return `${op.kind}:${op.scope}`;
    // Neuere Änderung derselben Einheit ersetzt die ältere (PLAN-PHASE-3 10.1 Punkt 5).
    case 'update_planned_session':
      return `${op.kind}:${op.sessionId}`;
    // Eigenes Startgewicht: neuester Wert je Übung gewinnt (PLAN-PHASE-4 4.3).
    case 'set_exercise_start_weight':
      return `${op.kind}:${op.exerciseId}`;
    default:
      return op.kind;
  }
}

/** Fügt Vorgänge ein (rein, ohne Speichern). Wirft bei Gesundheitsdaten oder Einwilligungen. */
export function enqueue(entries: readonly QueueEntry[], ops: readonly WriteOp[]): QueueEntry[] {
  let next = [...entries];
  for (const op of ops) {
    if (isDirectOp(op)) {
      throw new Error(
        'Gesundheitsdaten und Einwilligungen werden nie in die Warteschlange gelegt.',
      );
    }
    const key = queueKey(op);
    const previous = next.find((entry) => entry.key === key);
    next = next.filter((entry) => entry.key !== key);
    if (op.kind === 'update_profile' && previous?.op.kind === 'update_profile') {
      next.push({
        key,
        op: { kind: 'update_profile', patch: { ...previous.op.patch, ...op.patch } },
      });
    } else {
      next.push({ key, op });
    }
  }
  // Profil-Fortschritt immer zuletzt.
  return [
    ...next.filter((entry) => entry.op.kind !== 'update_profile'),
    ...next.filter((entry) => entry.op.kind === 'update_profile'),
  ];
}

export interface SyncQueueOptions {
  store: KeyValueStore;
  storageKey: string;
  /** Sendet einen Vorgang an den Server. */
  execute: (op: WriteOp) => Promise<void>;
  /** Netzwerkfehler → später erneut versuchen; andere Fehler → Vorgang verwerfen (würde nie gelingen). */
  isNetworkError: (error: unknown) => boolean;
  /** Wird bei verworfenen Vorgängen aufgerufen (ohne Inhalte loggen!). */
  onDropped?: (op: WriteOp, error: unknown) => void;
  /**
   * Angemeldetes Konto (R5, PLAN-PHASE-4 4.1): Die Warteschlange merkt sich ihr Konto und sendet nur, wenn es passt –
   * nie an das falsche Konto. Ohne Angabe (Tests, alte Stände) gilt jedes Konto.
   */
  currentUserId?: () => string | null;
}

/** Gespeichertes Format: seit Phase 4 mit Konto; ältere Stände waren nur die Liste. */
interface StoredSyncQueue {
  ownerUserId: string | null;
  entries: QueueEntry[];
}

export class SyncQueue {
  private entries: QueueEntry[] = [];
  private owner: string | null = null;
  private loaded = false;
  private flushing: Promise<boolean> | null = null;

  constructor(private readonly options: SyncQueueOptions) {}

  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }
    const raw = await readJson<QueueEntry[] | StoredSyncQueue>(
      this.options.store,
      this.options.storageKey,
    );
    const stored = Array.isArray(raw) ? raw : (raw?.entries ?? []);
    this.owner = Array.isArray(raw) ? null : (raw?.ownerUserId ?? null);
    // Sicherheitsnetz: falls je ein Gesundheitsdatum hineingeraten wäre, nicht senden und verwerfen.
    // Alte Ziel-Vorgänge mit Zeitbudget-Spalten (vor Etappe B2) würden am Server scheitern → still verwerfen.
    this.entries = stored.filter((entry) => !isDirectOp(entry.op) && !isLegacyGoalsOp(entry.op));
    this.loaded = true;
  }

  size(): number {
    return this.entries.length;
  }

  snapshot(): readonly QueueEntry[] {
    return this.entries;
  }

  /** Liegen wartende Änderungen eines ANDEREN Kontos auf dem Gerät (R5)? */
  async hasForeign(userId: string): Promise<boolean> {
    await this.load();
    return this.entries.length > 0 && this.owner !== null && this.owner !== userId;
  }

  async add(ops: readonly WriteOp[]): Promise<void> {
    await this.load();
    const current = this.options.currentUserId?.() ?? null;
    if (
      this.entries.length > 0 &&
      this.owner !== null &&
      current !== null &&
      current !== this.owner
    ) {
      // Nie Änderungen zweier Konten mischen – die App fragt vorher („Einträge eines anderen Kontos – löschen?“).
      throw new Error('SyncQueue: Änderungen eines anderen Kontos.');
    }
    if (this.entries.length === 0 || this.owner === null) this.owner = current;
    this.entries = enqueue(this.entries, ops);
    await this.persist();
  }

  /** Sendet alle Vorgänge der Reihe nach. true = Warteschlange leer, false = weiterhin offline. */
  flush(): Promise<boolean> {
    this.flushing ??= this.runFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  /**
   * Entfernt wartende Vorgänge, z. B. alle Verschiebungen des alten Plans, sobald ein neuer Plan gespeichert ist
   * (save_training_plan ersetzt ältere Änderungen ausdrücklich, PLAN-PHASE-3 10.1 Punkt 5).
   */
  async remove(predicate: (op: WriteOp) => boolean): Promise<void> {
    await this.load();
    this.entries = this.entries.filter((entry) => !predicate(entry.op));
    await this.persist();
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.owner = null;
    this.loaded = true;
    await this.options.store.removeItem(this.options.storageKey);
  }

  private async runFlush(): Promise<boolean> {
    await this.load();
    if (this.options.currentUserId && this.entries.length > 0 && this.owner !== null) {
      const current = this.options.currentUserId();
      // Anderes (oder kein) Konto angemeldet: nichts senden, nichts verwerfen (R5).
      if (current !== this.owner) return false;
    }
    while (this.entries.length > 0) {
      const [entry] = this.entries;
      if (!entry) {
        break;
      }
      try {
        await this.options.execute(entry.op);
      } catch (error) {
        if (this.options.isNetworkError(error)) {
          return false;
        }
        this.options.onDropped?.(entry.op, error);
      }
      // Nur den gesendeten Eintrag entfernen – zwischenzeitlich ergänzte Einträge bleiben erhalten.
      this.entries = this.entries.filter((candidate) => candidate !== entry);
      await this.persist();
    }
    return true;
  }

  private async persist(): Promise<void> {
    if (this.entries.length === 0) {
      this.owner = null;
      await this.options.store.removeItem(this.options.storageKey);
    } else {
      await writeJson(this.options.store, this.options.storageKey, {
        ownerUserId: this.owner,
        entries: this.entries,
      } satisfies StoredSyncQueue);
    }
  }
}
