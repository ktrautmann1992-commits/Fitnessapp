import {
  type DailyMetricRow,
  dailyMetricImportSchema,
  FREE_SESSION,
  groupModality,
  type HeartRateSummaryRow,
  removeSessionLog,
  type WearableConnectionRow,
  type WearableDataType,
  type WearableImportBatch,
  type WearableImportResult,
  type WearableRows,
  type WearableSessionImport,
  wearableSessionImportSchema,
  type WearableSessionRow,
  WEARABLE_SYNC,
  addDays,
} from '@fitnessapp/core';

import type { CardioLogRow, SessionLogRow, UserRows } from './types';

/**
 * Smartwatch im TESTMODUS (Phase 8): dieselben Regeln wie die Datenbank-Funktionen connect_wearable,
 * import_wearable_batch, resolve_wearable_duplicate, disconnect_wearable und der Widerruf
 * (20261021120100_wearables.sql, 20261021120200_wearable_revoke_export.sql) – auf den Zeilen im Gerätespeicher.
 * Rein, ohne Speicher- oder Netzzugriff; getestet in wearable-rows.test.ts.
 */

/** Smartwatch-Zeilen ALLER Konten dieses Geräts (gefiltert nach user_id, wie tracked_routes im Testmodus). */
export interface LocalWearableStore {
  connections: WearableConnectionRow[];
  sessions: WearableSessionRow[];
  heartRates: HeartRateSummaryRow[];
  dailyMetrics: DailyMetricRow[];
}

export const EMPTY_LOCAL_WEARABLES: LocalWearableStore = {
  connections: [],
  sessions: [],
  heartRates: [],
  dailyMetrics: [],
};

export interface WearableContext {
  userId: string;
  now: string;
  today: string;
  newId: () => string;
}

const sortTypes = (types: readonly WearableDataType[]) => [...new Set(types)].sort();

/** Eigene Zeilen; Verweise auf gelöschte Einträge fallen weg (wie on delete cascade / set null). */
export function wearableRowsFor(
  store: LocalWearableStore,
  rows: Pick<UserRows, 'sessionLogs'>,
  userId: string,
): WearableRows {
  const logs = new Set(rows.sessionLogs.map((l) => l.id));
  return {
    connection: store.connections.find((c) => c.user_id === userId) ?? null,
    sessions: store.sessions
      .filter((s) => s.user_id === userId && logs.has(s.session_log_id))
      .map((s) =>
        s.duplicate_of !== null && !logs.has(s.duplicate_of) ? { ...s, duplicate_of: null } : s,
      ),
    heartRates: store.heartRates.filter((h) => h.user_id === userId && logs.has(h.session_log_id)),
    dailyMetrics: store.dailyMetrics
      .filter((d) => d.user_id === userId)
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

function upsertConnection(
  store: LocalWearableStore,
  userId: string,
  types: readonly WearableDataType[],
  now: string,
  sync: { at: string; count: number } | null,
): LocalWearableStore {
  const granted = sortTypes(types);
  const existing = store.connections.find((c) => c.user_id === userId);
  const next: WearableConnectionRow = {
    user_id: userId,
    provider: 'health_connect',
    status: granted.length > 0 ? 'connected' : 'permission_missing',
    granted_types: granted,
    connected_at: existing?.connected_at ?? now,
    last_sync_at: sync ? sync.at : (existing?.last_sync_at ?? null),
    last_sync_count: sync ? sync.count : (existing?.last_sync_count ?? null),
    updated_at: now,
  };
  return {
    ...store,
    connections: [...store.connections.filter((c) => c.user_id !== userId), next],
  };
}

/** connect_wearable: Verbindung mit den freigegebenen Datentypen. */
export function applyWearableConnect(
  store: LocalWearableStore,
  types: readonly WearableDataType[],
  ctx: Pick<WearableContext, 'userId' | 'now'>,
): LocalWearableStore {
  return upsertConnection(store, ctx.userId, types, ctx.now, null);
}

/** Wie die Prüfungen in import_wearable_batch: Schema plus Name, Zeitrahmen. */
function sessionValid(s: WearableSessionImport, now: string): boolean {
  const names: Record<string, string> = {
    ...FREE_SESSION.names.endurance,
    strength: FREE_SESSION.names.strength,
  };
  if (s.group !== 'other' && s.name_de !== names[s.group]) return false;
  const nowMs = Date.parse(now);
  if (Date.parse(s.started_at) < nowMs - WEARABLE_SYNC.importMaxAgeDays * 86_400_000) return false;
  if (Date.parse(s.finished_at) > nowMs + WEARABLE_SYNC.clockSkewS * 1000) return false;
  return true;
}

function upsertHeartRate(
  list: HeartRateSummaryRow[],
  logId: string,
  userId: string,
  hr: NonNullable<WearableSessionImport['heart_rate']>,
  now: string,
): HeartRateSummaryRow[] {
  return [
    ...list.filter((h) => h.session_log_id !== logId),
    {
      session_log_id: logId,
      user_id: userId,
      avg_bpm: hr.avg_bpm,
      max_bpm: hr.max_bpm,
      zone_s: [...hr.zone_s],
      hf_max_used: hr.hf_max_used,
      updated_at: now,
    },
  ];
}

/**
 * import_wearable_batch im Testmodus. Einwilligungen prüft der Aufrufer (wie die Datenbank: sonst
 * `consent_required`). Ungültige Einheiten/Tage werden übersprungen und gezählt.
 */
export function applyWearableImport(
  store: LocalWearableStore,
  rows: UserRows,
  batch: WearableImportBatch,
  ctx: WearableContext,
): { store: LocalWearableStore; rows: UserRows; result: WearableImportResult } {
  const result = { created: 0, updated: 0, merged: 0, skipped: 0, days: 0 };
  let sessions = [...store.sessions];
  let heartRates = [...store.heartRates];
  let sessionLogs = [...rows.sessionLogs];
  let cardioLogs = [...rows.cardioLogs];
  const own = (logId: string) =>
    sessionLogs.find((l) => l.id === logId && l.user_id === ctx.userId) ?? null;

  for (const raw of batch.sessions) {
    const parsed = wearableSessionImportSchema.safeParse(raw);
    if (!parsed.success || !sessionValid(parsed.data, ctx.now)) {
      result.skipped += 1;
      continue;
    }
    const s = parsed.data;
    const modality = groupModality(s.group);
    const kind = modality === null ? 'strength' : 'endurance';
    const existing = sessions.find(
      (w) =>
        w.user_id === ctx.userId &&
        w.provider === batch.provider &&
        w.external_id === s.external_id,
    );
    if (existing) {
      sessions = sessions.map((w) =>
        w === existing
          ? {
              ...w,
              origin: s.origin,
              started_at: s.started_at,
              finished_at: s.finished_at,
              kcal: s.kcal ?? w.kcal,
              updated_at: ctx.now,
            }
          : w,
      );
      if (!existing.merged) {
        sessionLogs = sessionLogs.map((l) =>
          l.id === existing.session_log_id &&
          (l.started_at !== s.started_at ||
            l.finished_at !== s.finished_at ||
            l.performed_on !== s.performed_on)
            ? {
                ...l,
                started_at: s.started_at,
                finished_at: s.finished_at,
                performed_on: s.performed_on,
                revision: l.revision + 1,
                last_write_id: ctx.newId(),
                client_updated_at: ctx.now,
                updated_at: ctx.now,
              }
            : l,
        );
        cardioLogs = cardioLogs.map((c) =>
          c.session_log_id === existing.session_log_id && c.modality === modality
            ? { ...c, duration_s: s.duration_s, distance_m: s.distance_m ?? c.distance_m }
            : c,
        );
      }
      if (s.heart_rate) {
        heartRates = upsertHeartRate(
          heartRates,
          existing.session_log_id,
          ctx.userId,
          s.heart_rate,
          ctx.now,
        );
      }
      result.updated += 1;
      continue;
    }

    let logId: string | null = null;
    if (s.merge_into !== null) {
      const target = own(s.merge_into);
      const targetCardio = cardioLogs.find((c) => c.session_log_id === s.merge_into) ?? null;
      const fits =
        target !== null &&
        !sessions.some((w) => w.session_log_id === target.id) &&
        target.kind === kind &&
        (targetCardio?.modality ?? null) === modality &&
        (target.started_at !== null && target.finished_at !== null
          ? Date.parse(target.started_at) < Date.parse(s.finished_at) &&
            Date.parse(target.finished_at) > Date.parse(s.started_at)
          : target.performed_on === s.performed_on);
      if (fits && target) {
        logId = target.id;
        sessions.push({
          session_log_id: target.id,
          user_id: ctx.userId,
          provider: batch.provider,
          external_id: s.external_id,
          origin: s.origin,
          started_at: s.started_at,
          finished_at: s.finished_at,
          kcal: s.kcal,
          merged: true,
          duplicate_of: null,
          imported_at: ctx.now,
          updated_at: ctx.now,
        });
        result.merged += 1;
      }
    }
    if (logId === null) {
      logId = ctx.newId();
      const log: SessionLogRow = {
        id: logId,
        user_id: ctx.userId,
        planned_session_id: null,
        kind,
        performed_on: s.performed_on,
        started_at: s.started_at,
        finished_at: s.finished_at,
        status: 'completed',
        session_rpe: null,
        notes: null,
        name_de: s.name_de,
        is_intro_week: false,
        is_deload: false,
        from_health_plan: false,
        is_free: true,
        revision: 1,
        last_write_id: ctx.newId(),
        source: 'health_connect',
        client_updated_at: ctx.now,
        created_at: ctx.now,
        updated_at: ctx.now,
      };
      sessionLogs.push(log);
      if (modality !== null) {
        const cardio: CardioLogRow = {
          session_log_id: logId,
          user_id: ctx.userId,
          modality,
          duration_s: s.duration_s,
          distance_m: s.distance_m,
          elevation_m: null,
          // Health Connect kennt kein E-Bike (nur BIKING/BIKING_STATIONARY) → normales Rad, umstellbar im Eintrag.
          e_bike: false,
        };
        cardioLogs.push(cardio);
      }
      const dup =
        s.possible_duplicate_of !== null && own(s.possible_duplicate_of) !== null
          ? s.possible_duplicate_of
          : null;
      sessions.push({
        session_log_id: logId,
        user_id: ctx.userId,
        provider: batch.provider,
        external_id: s.external_id,
        origin: s.origin,
        started_at: s.started_at,
        finished_at: s.finished_at,
        kcal: s.kcal,
        merged: false,
        duplicate_of: dup,
        imported_at: ctx.now,
        updated_at: ctx.now,
      });
      result.created += 1;
    }
    if (s.heart_rate) {
      heartRates = upsertHeartRate(heartRates, logId, ctx.userId, s.heart_rate, ctx.now);
    }
  }

  let dailyMetrics = [...store.dailyMetrics];
  for (const raw of batch.days) {
    const parsed = dailyMetricImportSchema.safeParse(raw);
    if (
      !parsed.success ||
      parsed.data.day < addDays(ctx.today, -WEARABLE_SYNC.importMaxAgeDays) ||
      parsed.data.day > addDays(ctx.today, 1)
    ) {
      result.skipped += 1;
      continue;
    }
    const d = parsed.data;
    const old = dailyMetrics.find(
      (m) => m.user_id === ctx.userId && m.provider === batch.provider && m.day === d.day,
    );
    dailyMetrics = [
      ...dailyMetrics.filter((m) => m !== old),
      {
        user_id: ctx.userId,
        day: d.day,
        provider: batch.provider,
        resting_hr_bpm: d.resting_hr_bpm ?? old?.resting_hr_bpm ?? null,
        sleep_min: d.sleep_min ?? old?.sleep_min ?? null,
        steps: d.steps ?? old?.steps ?? null,
        updated_at: ctx.now,
      },
    ];
    result.days += 1;
  }

  const next = upsertConnection(
    { ...store, sessions, heartRates, dailyMetrics },
    ctx.userId,
    batch.granted_types,
    ctx.now,
    {
      at: ctx.now,
      count: Math.min(result.created + result.merged, WEARABLE_SYNC.maxSessionsPerBatch),
    },
  );
  return { store: next, rows: { ...rows, sessionLogs, cardioLogs }, result };
}

/** resolve_wearable_duplicate im Testmodus: 'not_found' = kein Hinweis, 'invalid' = nicht zusammenführbar. */
export function applyWearableResolve(
  store: LocalWearableStore,
  rows: UserRows,
  sessionLogId: string,
  merge: boolean,
  ctx: Pick<WearableContext, 'userId' | 'now'>,
): { store: LocalWearableStore; rows: UserRows } | 'not_found' | 'invalid' {
  const entry = store.sessions.find(
    (w) =>
      w.session_log_id === sessionLogId &&
      w.user_id === ctx.userId &&
      !w.merged &&
      w.duplicate_of !== null,
  );
  if (!entry || entry.duplicate_of === null) return 'not_found';
  if (!merge) {
    return {
      store: {
        ...store,
        sessions: store.sessions.map((w) =>
          w === entry ? { ...w, duplicate_of: null, updated_at: ctx.now } : w,
        ),
      },
      rows,
    };
  }
  const target = entry.duplicate_of;
  if (
    !rows.sessionLogs.some((l) => l.id === target && l.user_id === ctx.userId) ||
    store.sessions.some((w) => w.session_log_id === target)
  ) {
    return 'invalid';
  }
  return {
    store: {
      ...store,
      heartRates: store.heartRates.map((h) =>
        h.session_log_id === sessionLogId
          ? { ...h, session_log_id: target, updated_at: ctx.now }
          : h,
      ),
      sessions: store.sessions.map((w) =>
        w === entry
          ? { ...w, session_log_id: target, merged: true, duplicate_of: null, updated_at: ctx.now }
          : w,
      ),
    },
    rows: removeSessionLog(rows, sessionLogId),
  };
}

/** disconnect_wearable im Testmodus (W8-12): Puls und Tageswerte immer weg. */
export function applyWearableDisconnect(
  store: LocalWearableStore,
  rows: UserRows,
  deleteImported: boolean,
  userId: string,
): { store: LocalWearableStore; rows: UserRows; deleted: number } {
  const ownSessions = store.sessions.filter((w) => w.user_id === userId);
  const ownLogIds = new Set(ownSessions.map((w) => w.session_log_id));
  let nextRows = rows;
  let deleted = 0;
  if (deleteImported) {
    for (const w of ownSessions) {
      if (w.merged || !nextRows.sessionLogs.some((l) => l.id === w.session_log_id)) continue;
      nextRows = removeSessionLog(nextRows, w.session_log_id);
      deleted += 1;
    }
  }
  return {
    store: {
      connections: store.connections.filter((c) => c.user_id !== userId),
      sessions: deleteImported
        ? store.sessions.filter((w) => w.user_id !== userId)
        : store.sessions,
      heartRates: store.heartRates.filter(
        (h) => !(h.user_id === userId && ownLogIds.has(h.session_log_id)),
      ),
      dailyMetrics: store.dailyMetrics.filter((d) => d.user_id !== userId),
    },
    rows: nextRows,
    deleted,
  };
}

/**
 * Widerruf wearable_data bzw. health_data (consents_after_revoke): Puls, Tageswerte und Verbindung sofort weg;
 * übernommene Einheiten bleiben als normale Einträge.
 */
export function applyWearableRevoke(store: LocalWearableStore, userId: string): LocalWearableStore {
  return {
    connections: store.connections.filter((c) => c.user_id !== userId),
    sessions: store.sessions,
    heartRates: store.heartRates.filter((h) => h.user_id !== userId),
    dailyMetrics: store.dailyMetrics.filter((d) => d.user_id !== userId),
  };
}
