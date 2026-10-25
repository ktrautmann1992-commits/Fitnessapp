import {
  isBackfilledLog,
  type LogAssignment,
  logAssignmentSchema,
  parseStoredLogAssignments,
  sportForLog,
  sportLogDurationS,
  weekStatus,
  type WeekStatus,
  type WeekStatusLog,
  type WeekStatusSession,
} from '@fitnessapp/core';

import { type KeyValueStore, STORAGE_KEYS } from './kv';
import type { UserRows } from './types';

/**
 * Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“): Zeilen → Eingaben von `weekStatus()` aus packages/core
 * und Gerätespeicher der Antworten auf „Soll dieser Lauf dafür zählen?“. Nur Abbildung und Speicher, keine Regeln.
 *
 * Antworten liegen wie die Day-Swaps unter einem eigenen Schlüssel (`fitnessapp.log-assignments.v1`, in STORAGE_KEYS,
 * damit „Alles auf dem Gerät löschen“, Abmelden und Konto löschen ihn mitnehmen): nur IDs und Zeitpunkt, kein
 * Gesundheitsdatum, nicht geräteübergreifend. Einträge anderer Konten bleiben beim Schreiben unverändert liegen.
 */

/** Zeilen → Eingaben; `kcalOf` liefert die kcal je Eintrag (laut Uhr bzw. geschätzt) oder null. */
export function weekStatusInputs(
  rows: Pick<
    UserRows,
    'plans' | 'plannedSessions' | 'sessionLogs' | 'exerciseLogs' | 'setLogs' | 'cardioLogs'
  >,
  kcalOf: (logId: string) => number | null = () => null,
): { sessions: WeekStatusSession[]; logs: WeekStatusLog[] } {
  const activePlans = new Set(rows.plans.filter((p) => p.status === 'active').map((p) => p.id));
  const sessions = rows.plannedSessions.map((s): WeekStatusSession => ({
    id: s.id,
    scheduled_on: s.scheduled_on,
    original_date: s.original_date,
    status: s.status,
    kind: s.kind,
    endurance_modality: s.endurance_modality ?? null,
    name_de: s.name_de,
    plan_active: activePlans.has(s.plan_id),
    estimated_minutes: s.estimated_minutes,
    is_deload: s.is_deload,
  }));
  const exerciseOf = new Map(rows.exerciseLogs.map((e) => [e.id, e.session_log_id] as const));
  const doneSets = new Map<string, number>();
  for (const set of rows.setLogs) {
    const logId = exerciseOf.get(set.exercise_log_id);
    if (logId !== undefined && set.done) doneSets.set(logId, (doneSets.get(logId) ?? 0) + 1);
  }
  const cardio = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c] as const));
  const logs = rows.sessionLogs.map((l): WeekStatusLog => {
    const c = cardio.get(l.id);
    // Sportarten Stufe 2: Sportart, Dauer und Distanz aus dem Eintrag (bzw. Titel der Uhr-Einheit).
    const sport = c ? null : sportForLog(l);
    return {
      id: l.id,
      planned_session_id: l.planned_session_id,
      performed_on: l.performed_on,
      kind: l.kind,
      status: l.status,
      name_de: l.name_de,
      is_free: l.is_free === true,
      source: l.source,
      modality: c?.modality ?? null,
      duration_s: c?.duration_s ?? (sport ? sportLogDurationS(l) : null),
      distance_m: c?.distance_m ?? (sport ? (l.sport_distance_m ?? null) : null),
      sport,
      done_sets: doneSets.get(l.id) ?? 0,
      kcal: kcalOf(l.id),
      started_at: l.started_at,
      backfilled: isBackfilledLog({
        performed_on: l.performed_on,
        created_at: l.created_at,
        ...(l.source !== undefined ? { source: l.source } : {}),
      }),
    };
  });
  return { sessions, logs };
}

/** Wochen-Status aus den Zeilen. */
export function weekStatusFromRows(
  rows: Parameters<typeof weekStatusInputs>[0],
  options: {
    readonly weekOf: string;
    readonly today: string;
    readonly assignments: readonly LogAssignment[];
    readonly kcalOf?: (logId: string) => number | null;
  },
): WeekStatus {
  const { sessions, logs } = weekStatusInputs(rows, options.kcalOf);
  return weekStatus({
    sessions,
    logs,
    assignments: options.assignments,
    weekOf: options.weekOf,
    today: options.today,
  });
}

export interface LogAssignmentStore {
  load(ownerUserId: string): Promise<LogAssignment[]>;
  save(ownerUserId: string, list: readonly LogAssignment[]): Promise<void>;
}

/** Gültige Einträge ANDERER Konten (beim Schreiben beibehalten). */
function foreignEntries(raw: string | null, ownerUserId: string): LogAssignment[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = logAssignmentSchema.safeParse(item);
    return parsed.success && parsed.data.ownerUserId !== ownerUserId ? [parsed.data] : [];
  });
}

export function createLogAssignmentStore(store: KeyValueStore): LogAssignmentStore {
  const key = STORAGE_KEYS.logAssignments;
  return {
    load: async (ownerUserId) => parseStoredLogAssignments(await store.getItem(key), ownerUserId),
    save: async (ownerUserId, list) => {
      const others = foreignEntries(await store.getItem(key), ownerUserId);
      const all = [...others, ...list.filter((a) => a.ownerUserId === ownerUserId)];
      if (all.length === 0) await store.removeItem(key);
      else await store.setItem(key, JSON.stringify(all));
    },
  };
}
