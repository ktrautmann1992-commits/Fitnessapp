import {
  addDays,
  evaluateHealthScreening,
  HEALTH_PLAN_CACHE_MAX_AGE_DAYS,
  healthScreeningAnswersSchema,
  isoDateInTimeZone,
  LOG_CACHE_WEEKS,
  type ConsentType,
  type PlanLibrary,
  type PlanSafetyRules,
  type SessionLogPayload,
} from '@fitnessapp/core';
import type { AppSupabaseClient, Json } from '@fitnessapp/db';

import {
  BackendError,
  type Backend,
  type BackendErrorCode,
  type BackendEvent,
  type LogSaveOutcome,
} from './backend';
import { DraftStore } from './draft-store';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { type ConsentVersions, versionsFromDocuments } from './mapping';
import {
  type CachedLibrary,
  libraryFromCache,
  libraryFromDbRows,
  libraryToCache,
} from './plan-library';
import { planSave } from './plan-save';
import {
  applySessionLog,
  logRowsOf,
  removeSessionLog,
  EMPTY_LOG_ROWS,
  type LogRows,
  mergeLogRows,
  neutralizeHealthPlanLogRows,
  deleteHealthPlanLogRows,
} from './log-rows';
import {
  ForeignQueueError,
  LogQueue,
  logQueueKey,
  type LogQueueEntry,
  type SaveLogResponse,
} from './log-queue';
import { createMemoryProtectedStore, type ProtectedStore } from './protected-store';
import { SyncQueue } from './sync-queue';
import { effectiveSafetyRules } from './training-plan';
import {
  emptyUserRows,
  type AuthSession,
  type CardioLogRow,
  type ConsentDocument,
  type ConsentPlatform,
  type ExerciseLogRow,
  type SessionLogRow,
  type SetLogRow,
  type StartWeightRow,
  type PlannedExerciseRow,
  type PlannedSessionRow,
  type UserPlanRow,
  type UserRows,
} from './types';
import {
  applyWriteOps,
  cacheableRows,
  isDirectOp,
  isSensitiveOp,
  type ApplyContext,
  type PlanRows,
  type WriteOp,
} from './write-ops';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';

/**
 * SUPABASE-MODUS: Login per 6-stelligem E-Mail-Code, Daten in der Datenbank (Frankfurt, RLS).
 *
 * Offline-Verhalten (docs/PLAN-PHASE-1.md Abschnitt 9):
 * - Nicht-Gesundheitsdaten: nach jedem Schritt auf dem Gerät zwischengespeichert (rowsCache) und über die
 *   Warteschlange (sync-queue.ts) gesendet, sobald wieder Verbindung besteht.
 * - Gesundheitsdaten (Körperdaten, Umfänge, Gesundheits-Check, Unverträglichkeiten) und Einwilligungen:
 *   nur im Arbeitsspeicher, direkt gesendet. Ohne Verbindung → Fehler mit „Erneut versuchen“.
 * - Trainingspläne (Phase 3): Pläne OHNE Gesundheitsbezug wie Nicht-Gesundheitsdaten (Zwischenspeicher,
 *   Verschieben über die Warteschlange mit Schlüssel update_planned_session:<id>). Pläne MIT Gesundheitsbezug und die
 *   wirksamen Sicherheitsregeln nur im geschützten Zwischenspeicher (Gründer-Entscheidung Frage 14:
 *   protected-store.ts – App verschlüsselt, Browser sessionStorage), Verschieben sofort gesendet. Gelöscht bei
 *   Widerruf, Abmelden, Konto löschen und sobald der Server keinen solchen aktiven Plan mehr liefert.
 * - Bibliothek: nur freigegebene Inhalte (allowDrafts nie true), offline der zwischengespeicherte Stand.
 *
 * Kann ohne Supabase-Projekt nicht live getestet werden; Abbildung und Fehlerbehandlung sind per Unit-Test
 * abgesichert (mapping.test.ts, supabase-backend.test.ts).
 */

interface ErrorLike {
  message?: string;
  code?: string;
  hint?: string;
  status?: number;
  name?: string;
}

const NETWORK_PATTERN =
  /failed to fetch|fetch failed|network request failed|networkerror|load failed|timeout|offline/i;

/** Fehler aus supabase-js (PostgREST oder Auth) → fester Fehler-Code. Rein, getestet. */
export function classifySupabaseError(error: unknown, sensitive = false): BackendErrorCode {
  if (error instanceof BackendError) {
    return error.code;
  }
  const e = (error ?? {}) as ErrorLike;
  const message = e.message ?? '';
  if (
    e.name === 'AuthRetryableFetchError' ||
    e.name === 'TypeError' ||
    e.status === 0 ||
    NETWORK_PATTERN.test(message)
  ) {
    return 'network';
  }
  if (
    e.status === 429 ||
    e.code === 'over_email_send_rate_limit' ||
    e.code === 'over_request_rate_limit'
  ) {
    return 'rate_limited';
  }
  if (
    e.code === 'otp_expired' ||
    e.code === 'otp_disabled' ||
    /token has expired or is invalid/i.test(message)
  ) {
    return 'invalid_code';
  }
  if (e.hint === 'min_age' || message.includes('ab 16 Jahren')) {
    return 'min_age';
  }
  // 42501 „Nicht angemeldet.“ aus den RPCs (auth.uid() ist leer) = Sitzung weg (Nachprüfung C1 N1).
  if (e.code === '42501' && /^nicht angemeldet/i.test(message)) {
    return 'not_signed_in';
  }
  // 42501 = RLS-Verstoß: bei Gesundheitsdaten fehlt die (aktuelle) Einwilligung, sonst das Profil.
  if (e.code === '42501') {
    return sensitive ? 'consent_required' : 'profile_missing';
  }
  // Abgelaufenes/ungültiges JWT: PostgREST ab 12 meldet PGRST303 („JWT expired“), ältere PGRST301/302.
  if (/^PGRST30[1-3]$/.test(e.code ?? '') || /jwt expired/i.test(message) || e.status === 401) {
    return 'not_signed_in';
  }
  return 'unknown';
}

function toBackendError(error: unknown, sensitive = false): BackendError {
  return error instanceof BackendError
    ? error
    : new BackendError(classifySupabaseError(error, sensitive), { sensitive, cause: error });
}

/**
 * Fehler beim Speichern/Ändern eines Plans: Netz und Anmeldung wie sonst, alles andere (Plan passt nicht zum
 * Gesundheits-Check, Tag belegt, Einheit ersetzt …) = „plan_rejected“ – die App lädt neu bzw. bietet „Plan neu
 * erstellen“ an. Die Meldungen der Datenbank enthalten keine Nutzerdaten.
 */
function toPlanError(error: unknown, sensitive: boolean): BackendError {
  if (error instanceof BackendError) return error;
  const code = classifySupabaseError(error, sensitive);
  return new BackendError(code === 'network' || code === 'not_signed_in' ? code : 'plan_rejected', {
    sensitive,
    cause: error,
  });
}

/**
 * Fehler von save_session_log (W8, W10, Nachprüfung C1 N1):
 * - 'retry' = Netz, abgelaufene Sitzung (auch 42501 „Nicht angemeldet.“) oder Server/Datenbank allgemein nicht
 *   erreichbar bzw. gedrosselt – betrifft ALLE Einträge: Senden anhalten, später erneut, nichts zählen.
 * - 'transient' = vorübergehend, aber womöglich nur DIESER Eintrag (z. B. 42501 „Profil fehlt“, Serverfehler 500,
 *   Zeitlimit, Serialisierung, unlesbare Antwort): Fehlversuch zählen, mit dem nächsten Eintrag weitermachen; nach
 *   LOG_QUEUE_RETRY Versuchen bzw. 24 h als abgelehnter Entwurf sichern (nie verwerfen).
 * - sonst der Grund der Ablehnung aus dem festen Fehlercode (die Meldungen enthalten keine Inhalte).
 */
export function classifyLogError(error: unknown): 'retry' | 'transient' | LogRejectReason {
  const code = classifySupabaseError(error);
  const e = (error ?? {}) as ErrorLike;
  const db = e.code ?? '';
  // Datenbank-Codes zuerst: 57014 meldet „…statement timeout“ und ist kein Netzfehler.
  if (/^57/.test(db) || db === '40001' || db === '40P01') return 'transient';
  if (
    code === 'network' ||
    code === 'not_signed_in' ||
    code === 'rate_limited' ||
    /^PGRST(00[0-3]|30[1-3])$/.test(db) ||
    /^(08|53)/.test(db) ||
    e.status === 502 ||
    e.status === 503 ||
    e.status === 504
  ) {
    return 'retry';
  }
  if (
    code === 'profile_missing' ||
    db === 'invalid_response' ||
    (typeof e.status === 'number' && e.status >= 500)
  ) {
    return 'transient';
  }
  if (db === '23505') return 'day_taken';
  if (db === '54000') return 'daily_limit';
  if ((e.message ?? '').includes('außerhalb des erlaubten Zeitraums')) return 'date_window';
  return 'invalid';
}

/**
 * Vorübergehende Fehler (Wächter C1 S1) – nie als Ablehnung werten: Netz, Sitzung (PGRST301–303, „JWT expired“,
 * 401, 42501 „Nicht angemeldet.“), fehlende Rechte (42501), Drosselung (429), Datenbank nicht erreichbar
 * (PGRST000–003), Klassen 08 (Verbindung), 53 (Ressourcen), 57 (Abbruch, z. B. 57014 Zeitlimit),
 * Serialisierung/Deadlock (40001/40P01), Server-Fehler (≥ 500) und unlesbare Antworten. Nur feste Codes – „jwt“ im
 * Fehlertext allein reicht nicht (Nachprüfung C1 N4).
 */
export function isTransientError(error: unknown): boolean {
  const kind = classifyLogError(error);
  return kind === 'retry' || kind === 'transient';
}

/** Antwort von save_session_log/delete_session_log prüfen (Abbildung, keine Werte loggen). */
function parseLogResponse(data: unknown): SaveLogResponse {
  const value = (data ?? {}) as Partial<SaveLogResponse>;
  const result =
    value.result === 'ok' || value.result === 'orphaned' || value.result === 'conflict'
      ? value.result
      : null;
  if (result === null) throw { code: 'invalid_response', message: 'Ungültige Antwort.' };
  return {
    result,
    id: typeof value.id === 'string' ? value.id : null,
    revision: typeof value.revision === 'number' ? value.revision : null,
    ...(value.exercise_ids ? { exercise_ids: value.exercise_ids } : {}),
  };
}

/** Wie viele IDs je `in`-Filter (Länge der Adresse begrenzen). */
const IN_CHUNK = 80;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Update ohne betroffene Zeile (Einheit gibt es nicht mehr, z. B. Plan ersetzt) – vom Server abgelehnt. */
const PLAN_ROW_MISSING = { code: 'plan_row_missing', message: 'Einheit nicht gefunden.' };

/** Doppelte aktive Einwilligung (unique index) – beim erneuten Senden kein Fehler. */
function isDuplicate(error: ErrorLike | null): boolean {
  return error?.code === '23505';
}

/** Führt einen Schreib-Vorgang gegen Supabase aus. Wirft bei Fehlern das supabase-js-Fehlerobjekt. */
export async function executeWriteOp(
  client: AppSupabaseClient,
  userId: string,
  op: WriteOp,
): Promise<void> {
  const check = (result: { error: ErrorLike | null }) => {
    if (result.error) {
      throw result.error;
    }
  };
  switch (op.kind) {
    case 'update_profile':
      check(await client.from('profiles').update(op.patch).eq('user_id', userId));
      return;
    case 'grant_consent': {
      const result = await client.from('consents').insert({
        consent_type: op.consentType,
        version: op.version,
        platform: op.platform,
      });
      if (!isDuplicate(result.error)) {
        check(result);
      }
      return;
    }
    case 'upsert_goals':
      check(await client.from('goals').upsert(op.row, { onConflict: 'user_id' }));
      return;
    // Löschen + Einfügen atomar und mit allen Regeln (fest ODER „Tag egal“, lückenlos) in der Datenbank-Funktion
    // (Migration 20261005120000_training_slots.sql).
    case 'replace_training_slots':
      check(
        await client.rpc('replace_training_slots', {
          p_items: op.rows.map((row) => ({
            slot_no: row.slot_no,
            weekday: row.weekday,
            kind: row.kind,
            minutes: row.minutes,
          })),
        }),
      );
      return;
    // Löschen + Einfügen atomar in einer Datenbank-Funktion (Migration 20261003120900_replace_rpcs.sql).
    case 'replace_user_equipment':
      check(
        await client.rpc('replace_user_equipment', {
          p_location: op.location,
          p_items: op.rows.map((row) => ({
            equipment_id: row.equipment_id,
            weights_kg: row.weights_kg,
            note: row.note,
            bar_kg: row.bar_kg,
          })),
        }),
      );
      return;
    case 'upsert_nutrition_prefs':
      check(await client.from('nutrition_prefs').upsert(op.row, { onConflict: 'user_id' }));
      return;
    case 'replace_food_preferences':
      check(
        await client.rpc('replace_food_preferences', {
          p_scope: op.scope,
          p_items: op.rows.map((row) => ({ food_group: row.food_group, kind: row.kind })),
        }),
      );
      return;
    case 'upsert_body_metrics':
      check(
        await client.from('body_metrics').upsert(op.row, { onConflict: 'user_id,measured_on' }),
      );
      return;
    case 'upsert_body_measurements':
      check(
        await client
          .from('body_measurements')
          .upsert(op.row, { onConflict: 'user_id,measured_on' }),
      );
      return;
    case 'insert_health_screening':
      // Flags berechnet die Datenbank selbst (Trigger private.health_screening_before_insert).
      check(await client.from('health_screening').insert(op.row));
      return;
    case 'upsert_measurement_reminder':
      check(await client.from('measurement_reminders').upsert(op.row, { onConflict: 'user_id' }));
      return;
    // Pläne nur über die geprüften Datenbank-Funktionen (security definer, PLAN-PHASE-3 8.1).
    case 'save_training_plan':
      check(await client.rpc('save_training_plan', { p_plan: toJson(op.payload) }));
      return;
    case 'append_plan_block':
      check(
        await client.rpc('append_plan_block', {
          p_plan_id: op.planId,
          p_sessions: toJson(op.sessions),
        }),
      );
      return;
    // Eigenes Startgewicht direkt per PostgREST (bewusste Ausnahme W14; RLS: eigene Zeilen, Profil-Pflicht).
    case 'set_exercise_start_weight':
      if (op.weightKg === null) {
        check(
          await client
            .from('exercise_start_weights')
            .delete()
            .eq('user_id', userId)
            .eq('exercise_id', op.exerciseId),
        );
      } else {
        check(
          await client
            .from('exercise_start_weights')
            .upsert(
              { user_id: userId, exercise_id: op.exerciseId, weight_kg: op.weightKg },
              { onConflict: 'user_id,exercise_id' },
            ),
        );
      }
      return;
    // Nur Datum und Status (Trigger private.planned_sessions_before_update prüft den Rest).
    case 'update_planned_session': {
      const result = await client
        .from('planned_sessions')
        .update({ scheduled_on: op.scheduledOn, status: op.status })
        .eq('id', op.sessionId)
        .eq('user_id', userId)
        .select('id');
      check(result);
      if (!result.data || result.data.length === 0) {
        throw PLAN_ROW_MISSING;
      }
      return;
    }
  }
}

function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

interface RowsCache {
  userId: string;
  rows: UserRows;
}

/** Inhalt des geschützten Zwischenspeichers (Frage 14). */
interface HealthPlanCache {
  userId: string;
  /** Letzter Server-Kontakt (ISO-Zeitstempel); älter als HEALTH_PLAN_CACHE_MAX_AGE_DAYS → verworfen. */
  savedAt: string;
  plans: PlanRows | null;
  safetyRules: PlanSafetyRules | null;
}

export interface SupabaseBackendOptions {
  client: AppSupabaseClient;
  store: KeyValueStore;
  platform: ConsentPlatform;
  now: () => string;
  newId: () => string;
  /**
   * Geschützter Zwischenspeicher für Pläne mit Gesundheitsbezug (App: verschlüsselt, Browser: sessionStorage).
   * Standard (Tests): nur Arbeitsspeicher.
   */
  protectedStore?: ProtectedStore;
  /**
   * Geschützte Tagebuch-Speicher (PLAN-PHASE-4 4.1): Entwurf, Tagebuch-Warteschlange, Tagebuch-Zwischenspeicher –
   * je ein eigener Speicher mit eigenem Schlüssel. Standard (Tests): nur Arbeitsspeicher.
   */
  workoutDraftStore?: ProtectedStore;
  logQueueStore?: ProtectedStore;
  logCacheStore?: ProtectedStore;
}

/** Inhalt des geschützten Tagebuch-Zwischenspeichers (4.6). */
interface LogCache {
  userId: string;
  logs: LogRows;
}

const CONSENT_TYPES_WITH_TEXT = ['terms', 'privacy', 'health_data'] as const;

export function createSupabaseBackend(options: SupabaseBackendOptions): Backend {
  const { client, store } = options;
  const protectedStore = options.protectedStore ?? createMemoryProtectedStore();
  const logCacheStore = options.logCacheStore ?? createMemoryProtectedStore();
  const drafts = new DraftStore(options.workoutDraftStore ?? createMemoryProtectedStore());
  let currentUserId: string | null = null;
  /** Zuletzt geladene Einwilligungs-Versionen (für die wirksamen Sicherheitsregeln im Zwischenspeicher). */
  let versions: ConsentVersions | null = null;
  const listeners = new Set<(event: BackendEvent) => void>();
  const today = () => isoDateInTimeZone(options.now());

  const queue = new SyncQueue({
    store,
    storageKey: STORAGE_KEYS.syncQueue,
    execute: (op) => {
      if (!currentUserId) {
        return Promise.reject(new BackendError('network'));
      }
      return executeWriteOp(client, currentUserId, op);
    },
    isNetworkError: (error) => {
      const code = classifySupabaseError(error);
      return code === 'network' || code === 'not_signed_in';
    },
    onDropped: (op) => {
      // Nur die Art des Vorgangs – nie Inhalte (keine Nutzerdaten in Logs).
      console.warn(`Änderung verworfen (${op.kind}): vom Server abgelehnt.`);
      if (op.kind === 'update_planned_session') {
        // Verschiebung abgelehnt (Einheit ersetzt, Tag belegt …) → App lädt den Plan neu und meldet es.
        emit({ kind: 'plan_change_dropped' });
      }
    },
    currentUserId: () => currentUserId,
  });

  function emit(event: BackendEvent) {
    for (const listener of listeners) listener(event);
  }

  /**
   * Eigene Tagebuch-Warteschlange (4.3): nie stilles Verwerfen – Konflikt und Ablehnung werden ERST als Entwurf
   * gesichert, dann entfernt. Keine Inhalte in Logs (nur die Art des Ereignisses).
   */
  const logQueue = new LogQueue({
    store: options.logQueueStore ?? createMemoryProtectedStore(),
    execute: async (payload) => {
      const { data, error, status } = await client.rpc('save_session_log', {
        p_log: toJson(payload),
      });
      // PostgrestError trägt keinen HTTP-Status – für 429/5xx (später erneut, S1) ergänzen.
      if (error) throw { ...error, status };
      return parseLogResponse(data);
    },
    classify: (error) => {
      const kind = classifyLogError(error);
      if (kind === 'retry' && classifySupabaseError(error) === 'not_signed_in') {
        emit({ kind: 'session_expired' });
      }
      return kind;
    },
    currentUserId: () => currentUserId,
    onSaved: async (entry, response) => {
      // N2: Lag die Fassung nur im Arbeitsspeicher (Gerätespeicher nicht beschreibbar, K9), blieb ihr Entwurf
      // stehen – nach der Übertragung entfernen, solange er seither nicht geändert wurde.
      await drafts
        .removeWhere(
          (d) =>
            d.key === entry.draft.key &&
            d.state === 'open' &&
            d.updatedAt === entry.draft.updatedAt,
        )
        .catch(() => undefined);
      emit({
        kind: 'log_saved',
        orphaned: response.result === 'orphaned',
        key: entry.key,
        writeId: entry.payload.write_id,
      });
    },
    onConflict: async (entry, response) => {
      await drafts.put({ ...entry.draft, state: 'conflict', serverRevision: response.revision });
      emit({ kind: 'log_conflict', key: entry.key, writeId: entry.payload.write_id });
    },
    onRejected: async (entry, reason) => {
      await drafts.put({ ...entry.draft, state: 'rejected', rejectReason: reason });
      console.warn(
        reason === 'not_transferred'
          ? 'Training nach mehreren Versuchen nicht übertragen – als Entwurf gesichert.'
          : 'Training vom Server abgelehnt – als Entwurf gesichert.',
      );
      emit({ kind: 'log_rejected', reason, key: entry.key, writeId: entry.payload.write_id });
    },
  });

  /**
   * Bereinigung nach einem Widerruf auf einem ANDEREN Gerät bzw. nach H-c (R3, S1): Liegen Warteschlangen-Einträge
   * ODER Entwürfe aus Plänen mit Gesundheits-Check auf dem Gerät und ist die Einwilligung health_data nicht (mehr)
   * gültig, werden beide neutralisiert. false = offline (später erneut).
   */
  async function cleanHealthIfConsentInvalid(): Promise<boolean> {
    await logQueue.load();
    const hasHealth =
      logQueue.hasHealthPlanEntries() || (await drafts.all()).some((d) => d.fromHealthPlan);
    if (!hasHealth) return true;
    try {
      const { data, error } = await client.rpc('has_valid_consent', { p_type: 'health_data' });
      if (error) throw error;
      if (data !== true) {
        await logQueue.cleanHealthPlanEntries('neutralize');
        await drafts.cleanHealthPlanDrafts('neutralize');
      }
      return true;
    } catch (error) {
      return !isTransientError(error);
    }
  }

  /**
   * Sende-Reihenfolge (W8): normale Warteschlange → Tagebuch-Warteschlange → close_missed_sessions(). Vorher die
   * Bereinigung bei ungültiger Einwilligung (cleanHealthIfConsentInvalid). true = beide Warteschlangen leer.
   */
  async function flushAll(): Promise<boolean> {
    const syncDone = await queue.flush();
    if (!syncDone) return false;
    if (!(await cleanHealthIfConsentInvalid())) return false;
    const logResult = await logQueue.flush();
    // 'blocked' = einzelne Einträge warten auf ihren nächsten Versuch (N1) – die Verbindung steht, also hängt
    // close_missed_sessions nicht dahinter (skipped → completed bleibt erlaubt, W8).
    if (logResult !== 'done' && logResult !== 'blocked') return false;
    try {
      const { error } = await client.rpc('close_missed_sessions');
      if (error && isTransientError(error)) return false;
    } catch {
      // Nur Statuspflege – beim nächsten Laden erneut.
    }
    return logResult === 'done';
  }

  function applyContext(): ApplyContext {
    return { now: options.now(), newId: options.newId, flagsFor: () => [], today: today() };
  }

  /** Wie applyContext, aber mit Flags für die Anzeige (die Datenbank berechnet sie beim Speichern selbst). */
  function displayContext(): ApplyContext {
    return {
      ...applyContext(),
      flagsFor: (answers) => {
        const parsed = healthScreeningAnswersSchema.safeParse(answers);
        return parsed.success ? evaluateHealthScreening(parsed.data) : [];
      },
    };
  }

  async function requireSession(): Promise<AuthSession> {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      throw new BackendError('not_signed_in');
    }
    currentUserId = data.session.user.id;
    return { userId: data.session.user.id, email: data.session.user.email ?? null };
  }

  async function knownVersions(): Promise<ConsentVersions | null> {
    if (versions) return versions;
    const cached = await readJson<ConsentDocument[]>(store, STORAGE_KEYS.documentsCache);
    return cached && cached.length > 0 ? versionsFromDocuments(cached) : null;
  }

  /**
   * Zwischenspeicher für offline: normale Zeilen IMMER ohne Gesundheitsdaten und ohne Pläne mit Gesundheitsbezug
   * (cacheableRows); Pläne mit Gesundheitsbezug und gesundheitsbezogene Sicherheitsregeln nur in den geschützten
   * Zwischenspeicher. Liefert der Server keinen solchen Plan mehr (ersetzt/fehlt/Widerruf), wird er gelöscht.
   */
  /**
   * Bestätigter Stand (Wächter C1 S2): Tagebuch und Status der Einheiten so, wie der Server sie zuletzt geliefert hat.
   * In die Zwischenspeicher kommt nie die Anzeige-Überlagerung noch nicht übertragener Trainings (withPendingLogs) –
   * sonst zeigte das Gerät offline „erledigt“, obwohl die Fassung später abgelehnt wird.
   */
  let confirmed: { logs: LogRows; status: Map<string, PlannedSessionRow['status']> } | null = null;

  function rememberConfirmed(rows: UserRows): void {
    confirmed = {
      logs: logRowsOf(rows),
      status: new Map(rows.plannedSessions.map((s) => [s.id, s.status] as const)),
    };
  }

  /** Anzeige-Zeilen ohne die Überlagerung wartender Trainings. */
  function withoutPendingLogs(rows: UserRows): UserRows {
    const pendingWrites = new Set(logQueue.snapshot().map((e) => e.payload.write_id));
    const pendingSessions = new Set(
      logQueue
        .snapshot()
        .map((e) => e.payload.planned_session_id)
        .filter((id): id is string => id !== null),
    );
    const logs: LogRows = confirmed
      ? confirmed.logs
      : pendingWrites.size === 0
        ? logRowsOf(rows)
        : rows.sessionLogs
            .filter((l) => pendingWrites.has(l.last_write_id))
            .reduce((next, l) => removeSessionLog(next, l.id), rows);
    return {
      ...rows,
      ...logRowsOf({ ...rows, ...logs }),
      plannedSessions: rows.plannedSessions.map((s) => {
        if (s.status !== 'completed' || !pendingSessions.has(s.id)) return s;
        const before = confirmed?.status.get(s.id);
        return before !== undefined && before !== 'completed' ? { ...s, status: before } : s;
      }),
    };
  }

  /** `server` = Zeilen kommen direkt vom Server (ohne Überlagerung) und werden der neue bestätigte Stand. */
  async function writeCache(
    userId: string,
    displayRows: UserRows,
    origin: 'server' | 'display' = 'display',
  ): Promise<void> {
    if (origin === 'server') rememberConfirmed(displayRows);
    const rows = origin === 'server' ? displayRows : withoutPendingLogs(displayRows);
    const split = cacheableRows(rows, { allowHealthPlanCache: true });
    // Tagebuch nur im eigenen geschützten Speicher (S4); nie im normalen rowsCache.
    await logCacheStore.write(JSON.stringify({ userId, logs: split.logs } satisfies LogCache));
    await writeJson(store, STORAGE_KEYS.rowsCache, {
      userId,
      rows: split.rows,
    } satisfies RowsCache);
    const known = await knownVersions();
    const rules = known ? effectiveSafetyRules(rows, known, today()) : null;
    const healthRules = rules?.usesHealthData ? rules : null;
    if (split.healthPlans || healthRules) {
      await protectedStore.write(
        JSON.stringify({
          userId,
          savedAt: options.now(),
          plans: split.healthPlans,
          safetyRules: healthRules,
        } satisfies HealthPlanCache),
      );
    } else {
      await protectedStore.clear();
    }
  }

  async function readHealthCache(userId: string): Promise<HealthPlanCache | null> {
    const raw = await protectedStore.read();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as HealthPlanCache;
      const age = Date.parse(options.now()) - Date.parse(parsed.savedAt);
      if (!(age <= HEALTH_PLAN_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)) {
        // Zu lange ohne Server-Kontakt (oder ohne Zeitstempel): verwerfen – ein Widerruf auf einem anderen Gerät
        // soll hier nicht unbegrenzt unbemerkt bleiben.
        await protectedStore.clear();
        return null;
      }
      return parsed.userId === userId ? parsed : null;
    } catch {
      return null;
    }
  }

  async function readLogCache(userId: string): Promise<LogRows> {
    const raw = await logCacheStore.read();
    if (!raw) return EMPTY_LOG_ROWS;
    try {
      const parsed = JSON.parse(raw) as LogCache;
      return parsed.userId === userId ? { ...EMPTY_LOG_ROWS, ...parsed.logs } : EMPTY_LOG_ROWS;
    } catch {
      return EMPTY_LOG_ROWS;
    }
  }

  /**
   * Noch nicht übertragene Trainings über den Stand legen (Anzeige „erledigt – wird übertragen“). Nur für die
   * Anzeige – in den Zwischenspeicher kommt ausschließlich der Server-Stand.
   */
  function withPendingLogs(rows: UserRows, userId: string): UserRows {
    return logQueue.snapshot().reduce((next, entry) => {
      const linked = next.plannedSessions.some((s) => s.id === entry.payload.planned_session_id);
      const existing = next.sessionLogs.find(
        (l) =>
          (linked && l.planned_session_id === entry.payload.planned_session_id) ||
          l.id === entry.payload.id,
      );
      return applySessionLog(next, entry.payload, {
        userId,
        linked,
        keepTargets: true,
        fromHealthPlan: entry.fromHealthPlan,
        id: existing?.id ?? entry.payload.id,
        // Noch unbestätigt: Revision der Basis (0 = neu) – die Warteschlange behält ohnehin deren base_revision.
        revision: entry.payload.base_revision ?? 0,
        now: options.now(),
        isIntroWeek: entry.payload.is_intro_week,
        isDeload: entry.payload.is_deload,
      });
    }, rows);
  }

  /**
   * Tagebuch laden (4.6): die letzten LOG_CACHE_WEEKS Wochen plus recent_exercise_logs() (Grundlage der
   * Progression, auch für ältere Einträge); RLS: nur eigene Zeilen.
   */
  async function fetchLogs(userId: string): Promise<LogRows> {
    const since = addDays(today(), -LOG_CACHE_WEEKS * 7);
    const sessions = await client
      .from('session_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('performed_on', since)
      .order('performed_on');
    if (sessions.error) throw sessions.error;
    const sessionLogs = (sessions.data ?? []) as SessionLogRow[];
    const exerciseLogs: ExerciseLogRow[] = [];
    const cardioLogs: CardioLogRow[] = [];
    for (const ids of chunks(
      sessionLogs.map((l) => l.id),
      IN_CHUNK,
    )) {
      const [exercises, cardio] = await Promise.all([
        client.from('exercise_logs').select('*').in('session_log_id', ids),
        client.from('cardio_logs').select('*').in('session_log_id', ids),
      ]);
      if (exercises.error) throw exercises.error;
      if (cardio.error) throw cardio.error;
      exerciseLogs.push(...((exercises.data ?? []) as ExerciseLogRow[]));
      cardioLogs.push(...((cardio.data ?? []) as CardioLogRow[]));
    }
    const setLogs: SetLogRow[] = [];
    for (const ids of chunks(
      exerciseLogs.map((e) => e.id),
      IN_CHUNK,
    )) {
      const sets = await client.from('set_logs').select('*').in('exercise_log_id', ids);
      if (sets.error) throw sets.error;
      setLogs.push(...((sets.data ?? []) as SetLogRow[]));
    }
    const recent = await client.rpc('recent_exercise_logs', { p_per_exercise: 2 });
    if (recent.error) throw recent.error;
    const extra = (recent.data ?? {}) as Partial<LogRows> & {
      session_logs?: SessionLogRow[];
      exercise_logs?: ExerciseLogRow[];
      set_logs?: SetLogRow[];
    };
    return mergeLogRows(
      { sessionLogs, exerciseLogs, setLogs, cardioLogs },
      {
        sessionLogs: extra.session_logs ?? [],
        exerciseLogs: extra.exercise_logs ?? [],
        setLogs: extra.set_logs ?? [],
        cardioLogs: [],
      },
    );
  }

  /** Aktiver Plan mit Einheiten und Übungen (RLS: nur eigene Zeilen). */
  async function fetchActivePlan(userId: string): Promise<PlanRows> {
    const plan = await client
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (plan.error) throw plan.error;
    if (!plan.data) return { plans: [], plannedSessions: [], plannedExercises: [] };
    const sessions = await client
      .from('planned_sessions')
      .select('*')
      .eq('plan_id', plan.data.id)
      .order('scheduled_on');
    if (sessions.error) throw sessions.error;
    const sessionRows = (sessions.data ?? []).map(
      ({ created_at: _created, updated_at: _updated, ...row }) => row as PlannedSessionRow,
    );
    let exercises: PlannedExerciseRow[] = [];
    if (sessionRows.length > 0) {
      const result = await client
        .from('planned_exercises')
        .select('*')
        .in(
          'session_id',
          sessionRows.map((row) => row.id),
        )
        .order('order_no');
      if (result.error) throw result.error;
      exercises = result.data ?? [];
    }
    return {
      plans: [plan.data as UserPlanRow],
      plannedSessions: sessionRows,
      plannedExercises: exercises,
    };
  }

  /** Server-Stand + noch nicht gesendete Änderungen, danach Zwischenspeicher aktualisieren. */
  async function refreshRows(userId: string): Promise<UserRows> {
    const serverRows = await fetchRows(userId);
    const rows = applyWriteOps(
      serverRows,
      queue.snapshot().map((entry) => entry.op),
      applyContext(),
    );
    await writeCache(userId, rows, 'server');
    return withPendingLogs(rows, userId);
  }

  async function fetchLibrary(): Promise<PlanLibrary> {
    const [exercises, alternatives, templates, sessions, templateExercises] = await Promise.all([
      // Archivierte Übungen nur für die Anzeige laufender Pläne (libraryFromDbRows trennt sie von der Engine).
      client.from('exercises').select('*').in('status', ['published', 'archived']),
      client.from('exercise_alternatives').select('*'),
      client.from('plan_templates').select('*').eq('status', 'published'),
      client.from('template_sessions').select('*'),
      client.from('template_exercises').select('*'),
    ]);
    for (const result of [exercises, alternatives, templates, sessions, templateExercises]) {
      if (result.error) throw result.error;
    }
    // Engine immer nur mit freigegebenen Inhalten – planLibraryFromContent, allowDrafts: false.
    return libraryFromDbRows({
      exercises: exercises.data ?? [],
      alternatives: alternatives.data ?? [],
      templates: templates.data ?? [],
      sessions: sessions.data ?? [],
      templateExercises: templateExercises.data ?? [],
    });
  }

  async function fetchRows(userId: string): Promise<UserRows> {
    const [
      profile,
      consents,
      goals,
      slots,
      equipment,
      prefs,
      food,
      metrics,
      measurements,
      screening,
      reminder,
    ] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      client.from('consents').select('*').eq('user_id', userId),
      client.from('goals').select('*').eq('user_id', userId).maybeSingle(),
      client.from('training_slots').select('*').eq('user_id', userId).order('slot_no'),
      client.from('user_equipment').select('*').eq('user_id', userId),
      client.from('nutrition_prefs').select('*').eq('user_id', userId).maybeSingle(),
      client.from('food_preferences').select('*').eq('user_id', userId),
      // Gesundheitsdaten: nur der jeweils neueste Eintrag, nur im Arbeitsspeicher.
      client
        .from('body_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('measured_on', { ascending: false })
        .limit(1),
      client
        .from('body_measurements')
        .select('*')
        .eq('user_id', userId)
        .order('measured_on', { ascending: false })
        .limit(1),
      client
        .from('health_screening')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
      client.from('measurement_reminders').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    const plan = await fetchActivePlan(userId);
    const startWeights = await client
      .from('exercise_start_weights')
      .select('*')
      .eq('user_id', userId);
    if (startWeights.error) throw startWeights.error;
    const logs = await fetchLogs(userId);
    for (const result of [
      profile,
      consents,
      goals,
      slots,
      equipment,
      prefs,
      food,
      metrics,
      measurements,
      screening,
      reminder,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }
    return {
      profile: profile.data,
      consents: consents.data ?? [],
      goals: goals.data,
      trainingSlots: slots.data ?? [],
      userEquipment: equipment.data ?? [],
      nutritionPrefs: prefs.data,
      foodPreferences: food.data ?? [],
      bodyMetrics: metrics.data ?? [],
      bodyMeasurements: measurements.data ?? [],
      healthScreenings: screening.data ?? [],
      reminder: reminder.data,
      ...plan,
      ...logs,
      startWeights: (startWeights.data ?? []) as StartWeightRow[],
    };
  }

  async function fetchConsentDocuments(): Promise<ConsentDocument[]> {
    const versions = await Promise.all(
      CONSENT_TYPES_WITH_TEXT.map(async (type) => {
        const { data, error } = await client.rpc('current_consent_version', { p_type: type });
        if (error) {
          throw error;
        }
        return { type, version: data as number | null };
      }),
    );
    const documents: ConsentDocument[] = [];
    for (const { type, version } of versions) {
      if (version === null) {
        continue;
      }
      const { data, error } = await client
        .from('consent_documents')
        .select('consent_type, version, title_de, body_de')
        .eq('consent_type', type)
        .eq('version', version)
        .single();
      if (error) {
        throw error;
      }
      documents.push({ type, version, title: data.title_de, body: data.body_de });
    }
    return documents;
  }

  const backend: Backend = {
    mode: 'supabase',
    signIn: {
      kind: 'email_code',
      requestCode: async (email) => {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) {
          throw toBackendError(error);
        }
      },
      verifyCode: async (email, code) => {
        const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error || !data.user) {
          throw error ? toBackendError(error) : new BackendError('invalid_code');
        }
        currentUserId = data.user.id;
        return { userId: data.user.id, email: data.user.email ?? email };
      },
    },

    getSession: async () => {
      const { data } = await client.auth.getSession();
      if (!data.session) {
        return null;
      }
      currentUserId = data.session.user.id;
      return { userId: data.session.user.id, email: data.session.user.email ?? null };
    },

    signOut: async () => {
      // Die App fragt vorher nach, wenn noch Trainings warten (R6) – hier wird alles samt Schlüsseln geleert.
      await flushAll().catch(() => false);
      await client.auth.signOut();
      await clearLocal();
      currentUserId = null;
    },

    loadConsentDocuments: async () => {
      try {
        const documents = await fetchConsentDocuments();
        await writeJson(store, STORAGE_KEYS.documentsCache, documents);
        versions = versionsFromDocuments(documents);
        return documents;
      } catch (error) {
        // Offline: zuletzt geladene Texte und Versionen nutzen statt „Laden fehlgeschlagen“.
        if (classifySupabaseError(error) === 'network') {
          const cached = await readJson<ConsentDocument[]>(store, STORAGE_KEYS.documentsCache);
          if (cached && cached.length > 0) {
            return cached;
          }
        }
        throw toBackendError(error);
      }
    },

    createProfile: async (birthDate) => {
      await requireSession();
      const { error } = await client.from('profiles').insert({ birth_date: birthDate });
      if (error && !isDuplicate(error)) {
        throw toBackendError(error);
      }
    },

    loadRows: async () => {
      const session = await requireSession();
      // Nie an ein fremdes Konto senden (R5): flushAll() sendet nur passende Warteschlangen.
      await flushAll().catch(() => false);
      try {
        // Noch nicht gesendete Änderungen darüberlegen, damit die Anzeige zum Gerät passt.
        const rows = await refreshRows(session.userId);
        return { rows, offline: false };
      } catch (error) {
        if (classifySupabaseError(error) !== 'network') {
          throw toBackendError(error);
        }
        const cache = await readJson<RowsCache>(store, STORAGE_KEYS.rowsCache);
        if (cache?.userId !== session.userId) {
          throw new BackendError('network', { cause: error });
        }
        const cached = {
          ...upgradeStoredRows(cache.rows),
          ...(await readLogCache(session.userId)),
        };
        const health = await readHealthCache(session.userId);
        const rows = health?.plans
          ? {
              ...cached,
              plans: [...cached.plans, ...health.plans.plans],
              plannedSessions: [...cached.plannedSessions, ...health.plans.plannedSessions],
              plannedExercises: [...cached.plannedExercises, ...health.plans.plannedExercises],
            }
          : cached;
        rememberConfirmed(rows);
        return {
          rows: withPendingLogs(rows, session.userId),
          offline: true,
          cachedSafetyRules: health?.safetyRules ?? null,
        };
      }
    },

    grantConsents: async (types: readonly ConsentType[], versions) => {
      const session = await requireSession();
      for (const type of types) {
        const version = versions[type];
        if (version === null) {
          throw new BackendError('unknown');
        }
        try {
          await executeWriteOp(client, session.userId, {
            kind: 'grant_consent',
            consentType: type,
            version,
            platform: options.platform,
          });
        } catch (error) {
          throw toBackendError(error);
        }
      }
    },

    revokeConsent: async (type) => {
      if (type === 'health_data') {
        await revokeHealthData(false);
        return;
      }
      const session = await requireSession();
      const { error } = await client
        .from('consents')
        .update({ revoked_at: options.now() })
        .eq('user_id', session.userId)
        .eq('consent_type', type)
        .is('revoked_at', null);
      if (error) {
        throw toBackendError(error);
      }
    },

    saveStep: async (stepSave, context) => {
      const session = await requireSession();
      const planned = planSave(stepSave, {
        userId: session.userId,
        answers: context.answers,
        rows: context.rows,
        versions: context.versions,
        platform: options.platform,
        now: options.now(),
      });
      // 1. Gesundheitsdaten und Einwilligungen sofort senden (nie auf dem Gerät speichern).
      for (const op of planned.ops.filter(isDirectOp)) {
        try {
          await executeWriteOp(client, session.userId, op);
        } catch (error) {
          throw toBackendError(error, isSensitiveOp(op));
        }
      }
      // 2. Alles andere zwischenspeichern und über die Warteschlange senden.
      const queued = planned.ops.filter((op) => !isDirectOp(op));
      // Neuer Stand für die Anzeige (Gesundheitsdaten nur im Arbeitsspeicher, nicht im Zwischenspeicher).
      const next = applyWriteOps(context.rows, planned.ops, displayContext());
      await writeCache(session.userId, next);
      await queue.add(queued);
      void queue.flush();
      return next;
    },

    saveReminder: async (settings, nextDueOn, rows) => {
      const session = await requireSession();
      const op: WriteOp = {
        kind: 'upsert_measurement_reminder',
        row: {
          user_id: session.userId,
          enabled: settings.enabled,
          interval_days: settings.intervalDays,
          next_due_on: nextDueOn,
        },
      };
      const next = applyWriteOps(rows, [op], displayContext());
      await writeCache(session.userId, next);
      await queue.add([op]);
      void queue.flush();
      return next;
    },

    deleteAccount: async () => {
      await requireSession();
      const { error } = await client.rpc('delete_my_account');
      if (error) {
        throw toBackendError(error);
      }
      await clearLocal();
      // Die Sitzung gehört zu einem gelöschten Konto – nur lokal abmelden.
      await client.auth.signOut({ scope: 'local' });
      currentUserId = null;
    },

    pendingChanges: () => queue.size() + logQueue.size(),
    flush: () => flushAll().catch(() => false),

    clearDeviceData: async () => {
      await clearLocal();
      for (const key of Object.values(STORAGE_KEYS)) {
        await store.removeItem(key);
      }
    },

    loadPlanLibrary: async ({ allowCached }) => {
      try {
        const library = await fetchLibrary();
        // Nur Inhalte (keine Nutzerdaten) – für die Prüfung der Sicherheitsregeln offline.
        await writeJson(store, STORAGE_KEYS.planLibrary, libraryToCache(library));
        return library;
      } catch (error) {
        if (allowCached && classifySupabaseError(error) === 'network') {
          return libraryFromCache(await readJson<CachedLibrary>(store, STORAGE_KEYS.planLibrary));
        }
        throw toBackendError(error);
      }
    },

    savePlan: async (payload) => {
      const session = await requireSession();
      // H-b: wartende Trainings zuerst senden, damit sie ihrer Einheit zugeordnet werden statt zu verwaisen.
      await logQueue.flush().catch(() => 'later');
      try {
        await executeWriteOp(client, session.userId, { kind: 'save_training_plan', payload });
      } catch (error) {
        throw toPlanError(error, payload.uses_health_data);
      }
      // Ein neuer Plan ersetzt ausdrücklich alle wartenden Verschiebungen des alten Plans.
      await queue.remove((op) => op.kind === 'update_planned_session');
      // H-c: Plan ohne gültige Einwilligung → Entwürfe/Warteschlange aus Gesundheits-Plänen neutralisieren.
      await cleanHealthIfConsentInvalid();
      return refreshRows(session.userId);
    },

    appendPlanBlock: async (planId, usesHealthData, sessions) => {
      const session = await requireSession();
      try {
        await executeWriteOp(client, session.userId, {
          kind: 'append_plan_block',
          planId,
          usesHealthData,
          sessions,
        });
      } catch (error) {
        throw toPlanError(error, usesHealthData);
      }
      return refreshRows(session.userId);
    },

    updatePlannedSession: async (update, rows) => {
      const session = await requireSession();
      const op: WriteOp = { kind: 'update_planned_session', ...update };
      if (isDirectOp(op)) {
        // Plan mit Gesundheitsbezug: sofort senden, nie in die Warteschlange (Abschnitt 9).
        try {
          await executeWriteOp(client, session.userId, op);
        } catch (error) {
          throw toPlanError(error, true);
        }
        const next = applyWriteOps(rows, [op], displayContext());
        await writeCache(session.userId, next);
        return next;
      }
      const next = applyWriteOps(rows, [op], displayContext());
      await writeCache(session.userId, next);
      await queue.add([op]);
      void queue.flush();
      return next;
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // --- Trainingstagebuch (4.1–4.5) ---------------------------------------------------------------------
    loadDrafts: async () => {
      const session = await requireSession();
      return drafts.forOwner(session.userId);
    },
    saveDraft: async (draft) => {
      await drafts.put(draft);
    },
    discardDraft: async (key) => {
      await drafts.remove(key);
    },
    submitWorkout: async (draft, payload) => submit(draft, payload),
    deleteSessionLog: async (id, baseRevision) => {
      await requireSession();
      const { data, error } = await client.rpc('delete_session_log', {
        p_id: id,
        p_base_revision: baseRevision,
      });
      if (error) {
        const code = classifySupabaseError(error);
        throw new BackendError(code === 'network' ? 'online_only' : code, { cause: error });
      }
      return parseLogResponse(data).result === 'conflict' ? 'conflict' : 'ok';
    },
    setStartWeight: async (exerciseId, weightKg, rows) => {
      const session = await requireSession();
      const op: WriteOp = { kind: 'set_exercise_start_weight', exerciseId, weightKg };
      const next = applyWriteOps(rows, [op], displayContext());
      await writeCache(session.userId, next);
      await queue.add([op]);
      void queue.flush();
      return next;
    },
    revokeHealthData: (deleteLogs) => revokeHealthData(deleteLogs),
    pendingWorkouts: async () => {
      await logQueue.load();
      const owner = currentUserId;
      return {
        queued: owner !== null && logQueue.ownerUserId() === owner ? logQueue.size() : 0,
        drafts: owner ? (await drafts.forOwner(owner)).length : 0,
      };
    },
    pendingLogSessionIds: () =>
      logQueue
        .snapshot()
        .map((entry) => entry.payload.planned_session_id)
        .filter((id): id is string => id !== null),
    hasForeignDeviceData: async () => {
      const session = await requireSession();
      return (
        (await logQueue.hasForeign(session.userId)) ||
        (await queue.hasForeign(session.userId)) ||
        (await drafts.hasForeign(session.userId))
      );
    },
    discardForeignDeviceData: async () => {
      const session = await requireSession();
      if (await logQueue.hasForeign(session.userId)) await logQueue.clear();
      if (await queue.hasForeign(session.userId)) await queue.clear();
      await drafts.removeWhere((d) => d.ownerUserId !== session.userId);
    },
  };

  /** Alles Lokale samt Schlüsseln löschen (Abmelden, Konto löschen, Testdaten löschen – 4.1). */
  async function clearLocal(): Promise<void> {
    await queue.clear();
    await logQueue.clear();
    await drafts.clear();
    await store.removeItem(STORAGE_KEYS.rowsCache);
    await protectedStore.clear();
    await logCacheStore.clear();
  }

  /**
   * Training beenden (4.3): Fassung in die verschlüsselte Warteschlange, DANN Entwurf entfernen, dann senden. Kommt
   * die Fassung als Konflikt/Ablehnung zurück, liegt sie wieder als Entwurf vor (onConflict/onRejected).
   */
  async function submit(draft: WorkoutDraft, payload: SessionLogPayload): Promise<LogSaveOutcome> {
    const session = await requireSession();
    const entry: LogQueueEntry = {
      key: logQueueKey(payload),
      payload,
      draft: { ...draft, state: 'open', rejectReason: null },
      fromHealthPlan: draft.fromHealthPlan,
    };
    let persisted = true;
    try {
      await logQueue.add(entry, session.userId);
    } catch (error) {
      if (error instanceof ForeignQueueError) throw new BackendError('foreign_data');
      // Gerätespeicher nicht beschreibbar (K9): Die Fassung liegt nur im Arbeitsspeicher der Warteschlange – sofort
      // senden; der Entwurf bleibt, bis sie übertragen ist.
      persisted = false;
    }
    if (persisted) await drafts.remove(draft.key);
    // Nur das Ergebnis GENAU dieser Fassung zählt (Wächter C1 S4) – nicht das einer anderen wartenden Einheit.
    let outcome: LogSaveOutcome | null = null;
    const unsubscribe = backend.subscribe((event) => {
      if (!('writeId' in event) || event.writeId !== payload.write_id) return;
      if (event.kind === 'log_saved') outcome = { kind: 'saved', orphaned: event.orphaned };
      if (event.kind === 'log_conflict') outcome = { kind: 'conflict' };
      if (event.kind === 'log_rejected') outcome = { kind: 'rejected', reason: event.reason };
    });
    try {
      await flushAll();
    } finally {
      unsubscribe();
    }
    const stillQueued = logQueue.snapshot().some((e) => e.payload.write_id === payload.write_id);
    if (!persisted) {
      if (stillQueued || outcome === null) throw new BackendError('storage_unavailable');
      await drafts.remove(draft.key).catch(() => undefined);
    }
    return stillQueued || outcome === null ? { kind: 'queued' } : outcome;
  }

  /**
   * Widerruf health_data (R3): Senden sperren, laufendes Senden abwarten, Warteschlange/Entwurf/Zwischenspeicher
   * bereinigen, dann revoke_health_data(p_delete_logs) – eine Transaktion auf dem Server.
   */
  async function revokeHealthData(deleteLogs: boolean): Promise<void> {
    const session = await requireSession();
    logQueue.setLocked(true);
    try {
      await logQueue.idle();
      const mode = deleteLogs ? 'delete' : 'neutralize';
      await logQueue.cleanHealthPlanEntries(mode);
      await drafts.cleanHealthPlanDrafts(mode);
      const cached = await readLogCache(session.userId);
      const base = asRows(cached);
      const cleaned = neutralizeHealthPlanLogRows(
        deleteLogs ? deleteHealthPlanLogRows(base) : base,
      );
      await logCacheStore.write(
        JSON.stringify({
          userId: session.userId,
          logs: {
            sessionLogs: cleaned.sessionLogs,
            exerciseLogs: cleaned.exerciseLogs,
            setLogs: cleaned.setLogs,
            cardioLogs: cleaned.cardioLogs,
          },
        } satisfies LogCache),
      );
      const { error } = await client.rpc('revoke_health_data', { p_delete_logs: deleteLogs });
      if (error) {
        const code = classifySupabaseError(error, true);
        throw new BackendError(code === 'network' ? 'online_only' : code, {
          sensitive: true,
          cause: error,
        });
      }
      // Die Datenbank löscht alle Pläne mit Gesundheitsbezug – der geschützte Zwischenspeicher sofort auch.
      await protectedStore.clear();
    } finally {
      logQueue.setLocked(false);
    }
  }

  void queue.load();
  void logQueue.load();
  return backend;
}

function asRows(logs: LogRows): UserRows {
  return { ...emptyUserRows(), ...logs };
}
