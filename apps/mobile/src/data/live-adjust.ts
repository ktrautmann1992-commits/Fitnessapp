import {
  activeStateOverride,
  canRevert,
  computeLiveAdjustments,
  type EquipmentLocation,
  type ExerciseProgress,
  experienceLevelSchema,
  type JsonValue,
  latestCountingSessionLogId,
  liveEntriesFromRows,
  type LiveAdjustmentEnvironment,
  type LiveAdjustmentInputs,
  type LiveExerciseEntry,
  liveSessionLogsFromRows,
  loadWeeksBeforeDeload,
  type PlanChange,
  type PlanLibrary,
  progressionContextsForPlan,
  sessionLocationInfo,
  type StoredAdjustment,
  storedAdjustmentSchema,
  type StoredSession,
  weeklySetRange,
  cautiousProgression,
} from '@fitnessapp/core';
import { z } from 'zod';

import type { ConsentVersions } from './mapping';
import type { ProtectedStore } from './protected-store';
import { healthConsentStatus } from '../state/flow';
import { activePlan, effectiveSafetyRules, planSnapshot, profilesFor } from './training-plan';
import type { UserRows } from './types';

/**
 * Live-Anpassung in der App (Phase 4b, Etappe D, docs/PLAN-PHASE-4B.md 8.1–8.4). Nur Zusammensetzen und Abbilden –
 * alle Regeln stehen in packages/core/src/adjust (computeLiveAdjustments, canRevert, applyAdjustmentsToPlan …).
 *
 * TESTMODUS (Gründer-Entscheidung 09.10.2026 „erst ohne Supabase“): Das lokale Backend rechnet die Regeln nach jedem
 * gespeicherten Training bzw. beim Laden (wie der Sync) – NUR mit „Premium simulieren“ (nur Testmodus, Wächter K2).
 * Die Anpassungen (plan_adjustments) liegen ausschließlich im eigenen GESCHÜTZTEN Speicher `liveAdjust` (App
 * verschlüsselt, Browser sessionStorage, 8.3); der Widerruf von health_data leert ihn. Der gespeicherte Plan im
 * Gerätespeicher bleibt unverändert – die Plan-Änderungen legt `overlayPlanAdjustments()` beim Lesen darüber, so wie
 * `apply_plan_adjustments` sie im Supabase-Modus (Etappe B) in die Plan-Spalten schreibt. Geht der geschützte Speicher
 * verloren (Browser-Tab zu), gilt wieder der ursprüngliche Plan – nie eine Änderung ohne Erklärung.
 */

/** Gespeicherte Anpassung samt Plan (plan_adjustments.plan_id). */
export type LocalAdjustment = StoredAdjustment & { readonly planId: string };

const STORE_FORMAT = 1;

const localAdjustmentSchema = storedAdjustmentSchema.extend({ planId: z.string().min(1) });

interface StoredLiveAdjust {
  format: typeof STORE_FORMAT;
  ownerUserId: string;
  adjustments: LocalAdjustment[];
}

/**
 * Geschützter Speicher der Anpassungen (eigener Schlüssel, `liveAdjust`). Jede Liste gehört zu einem Konto; ein
 * fremdes Konto bzw. unlesbare Einträge ergeben eine leere Liste (Zod an der Grenze, nie Absturz).
 */
export class LiveAdjustStore {
  constructor(private readonly store: ProtectedStore) {}

  /** Unlesbar (Speicher gesperrt, Schlüssel fehlt, beschädigt) → leere Liste; nie blockierend (Wächter D M2). */
  async load(ownerUserId: string): Promise<LocalAdjustment[]> {
    try {
      const raw = await this.store.read();
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Partial<StoredLiveAdjust>;
      if (parsed.format !== STORE_FORMAT || parsed.ownerUserId !== ownerUserId) return [];
      return (parsed.adjustments ?? []).flatMap((a) =>
        localAdjustmentSchema.safeParse(a).success ? [a] : [],
      );
    } catch {
      return [];
    }
  }

  async save(ownerUserId: string, adjustments: readonly LocalAdjustment[]): Promise<void> {
    if (adjustments.length === 0) {
      await this.store.clear();
      return;
    }
    await this.store.write(
      JSON.stringify({
        format: STORE_FORMAT,
        ownerUserId,
        adjustments: [...adjustments],
      } satisfies StoredLiveAdjust),
    );
  }

  /**
   * Daten UND Schlüssel löschen (Widerruf health_data, Abmelden, Konto löschen, Testdaten löschen). Ein Fehler des
   * Speichers blockiert diese Wege nie; ein liegengebliebener Rest ist ohne Schlüssel nicht lesbar bzw. endet mit dem Tab.
   */
  async clear(): Promise<void> {
    try {
      await this.store.clear();
    } catch {
      // still – siehe oben
    }
  }
}

const isEffective = (a: Pick<StoredAdjustment, 'status'>) =>
  a.status === 'applied' || a.status === 'confirmed';

// ---------------------------------------------------------------------------------------------------------
// Plan-Änderungen über die Zeilen legen (wie apply_plan_adjustments die Plan-Spalten schreibt)
// ---------------------------------------------------------------------------------------------------------

/**
 * Wirksame Plan-Änderungen (ältere zuerst) auf die Plan-Zeilen legen: Sätze, RPE-Ziel, Übung (Tausch), Minuten,
 * Erholungswoche, Schritte. Status, Datum und alles andere bleiben. Ohne Anpassungen dieselben Zeilen (Gratis).
 */
export function overlayPlanAdjustments(
  rows: UserRows,
  adjustments: readonly StoredAdjustment[],
): UserRows {
  const changes = adjustments
    .filter((a) => isEffective(a) && a.kind === 'plan_change' && a.changeAfter !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (changes.length === 0) return rows;
  const sessions = new Map(rows.plannedSessions.map((s) => [s.id, s] as const));
  const exercises = new Map<string, UserRows['plannedExercises'][number]>(
    rows.plannedExercises.map((e) => [`${e.session_id}|${e.order_no}`, e]),
  );
  for (const a of changes) {
    for (const c of (a.changeAfter as PlanChange).sessions) {
      const s = sessions.get(c.id);
      if (!s) continue;
      sessions.set(c.id, {
        ...s,
        ...(c.is_deload === undefined ? {} : { is_deload: c.is_deload }),
        ...(c.estimated_minutes === undefined ? {} : { estimated_minutes: c.estimated_minutes }),
        ...(c.workout_steps === undefined
          ? {}
          : { workout_steps: c.workout_steps as unknown as JsonValue }),
        ...(c.target_distance_m === undefined ? {} : { target_distance_m: c.target_distance_m }),
      });
      for (const ec of c.exercises ?? []) {
        const key = `${c.id}|${ec.order_no}`;
        const e = exercises.get(key);
        if (!e) continue;
        exercises.set(key, {
          ...e,
          ...(ec.sets === undefined ? {} : { sets: ec.sets }),
          ...(ec.rpe_target === undefined ? {} : { rpe_target: ec.rpe_target }),
          ...(ec.exercise_id === undefined ? {} : { exercise_id: ec.exercise_id }),
          ...(ec.exercise_name_de === undefined ? {} : { exercise_name_de: ec.exercise_name_de }),
        });
      }
    }
  }
  return {
    ...rows,
    plannedSessions: rows.plannedSessions.map((s) => sessions.get(s.id) ?? s),
    plannedExercises: rows.plannedExercises.map(
      (e) => exercises.get(`${e.session_id}|${e.order_no}`) ?? e,
    ),
  };
}

// ---------------------------------------------------------------------------------------------------------
// Eingaben der Engine aus den Zeilen
// ---------------------------------------------------------------------------------------------------------

export interface LiveAdjustContext {
  library: PlanLibrary;
  versions: ConsentVersions;
  today: string;
}

/**
 * Eingaben für computeLiveAdjustments() aus den (überlagerten) Zeilen des aktiven Plans. `entitled` kommt im Testmodus
 * NUR vom Schalter „Premium simulieren“. null = kein aktiver Plan bzw. Angaben unvollständig.
 */
export function liveAdjustmentInputsFromRows(
  rows: UserRows,
  adjustments: readonly StoredAdjustment[],
  ctx: LiveAdjustContext & { entitled: boolean },
): { inputs: LiveAdjustmentInputs; env: LiveAdjustmentEnvironment } | null {
  const active = activePlan(rows);
  const snapshot = active ? planSnapshot(active.plan) : null;
  const rules = effectiveSafetyRules(rows, ctx.versions, ctx.today);
  const level = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  if (!active || !snapshot || !rules || !rows.profile || !level.success) return null;
  const lookup = ctx.library.displayExercises ?? ctx.library.exercises;
  const profiles = profilesFor(snapshot);
  const sessionLocations: Record<string, EquipmentLocation> = {};
  for (const s of active.sessions) {
    if (s.kind !== 'strength') continue;
    const info = sessionLocationInfo(s, snapshot.schedule, {
      library: lookup,
      homeProfile: profiles.get('home'),
    });
    // Mehrdeutiger Ort → ohne Angabe (ein Tausch muss dann an JEDEM Ort machbar sein).
    if (!info.ambiguous) sessionLocations[s.id] = info.location;
  }
  const template = ctx.library.templates.find((tpl) => tpl.id === active.plan.template_id);
  const contexts = progressionContextsForPlan({
    sessions: active.sessions,
    today: ctx.today,
    library: lookup,
    profiles,
    sessionLocations,
    weeklySetMax: template ? weeklySetRange(template).max : null,
  });
  return {
    inputs: {
      today: ctx.today,
      entitled: ctx.entitled,
      healthConsentValid: healthConsentStatus(rows, ctx.versions) === 'valid',
      person: { birthDate: rows.profile.birth_date },
      plan: {
        id: active.plan.id,
        startDate: active.plan.start_date,
        experienceLevel: snapshot.experienceLevel,
        fromHealthPlan: active.plan.uses_health_data,
        sessions: active.sessions,
      },
      rules,
      sessionLogs: liveSessionLogsFromRows(rows.sessionLogs),
      exerciseEntries: liveEntriesFromRows(rows),
      contexts,
      adjustments,
      sessionLocations,
    },
    env: { library: ctx.library.exercises, profiles },
  };
}

/**
 * Neu rechnen (Testmodus, nach dem gespeicherten Training bzw. beim Laden = Sync): Vorschläge abgelaufener bzw.
 * ersetzter Pläne → `expired`, dann die Engine auf dem aktiven Plan; neue Anpassungen werden `applied` (bzw. Vorschläge
 * `pending_confirmation`), ältere Zustands-Vorgaben derselben Übung `superseded` (wie apply_plan_adjustments).
 * Ohne `entitled` entsteht NICHTS (Gratis unverändert). Gibt dieselbe Liste zurück, wenn sich nichts ändert.
 */
export function recomputeLiveAdjustments(
  baseRows: UserRows,
  stored: readonly LocalAdjustment[],
  ctx: Omit<LiveAdjustContext, 'library'> & {
    /** Nur mit `entitled` nötig (ohne wird nichts gerechnet). */
    library: PlanLibrary | null;
    entitled: boolean;
    now: string;
    newId: () => string;
  },
): readonly LocalAdjustment[] {
  let changed = false;
  const activeId = activePlan(baseRows)?.plan.id ?? null;
  let list: LocalAdjustment[] = stored.map((a) => {
    const expired =
      a.status === 'pending_confirmation' &&
      ((a.expiresOn !== null && a.expiresOn < ctx.today) || a.planId !== activeId);
    if (!expired) return a;
    changed = true;
    return { ...a, status: 'expired', decidedAt: ctx.now };
  });
  if (!ctx.entitled || activeId === null || ctx.library === null) return changed ? list : stored;
  const own = list.filter((a) => a.planId === activeId);
  const built = liveAdjustmentInputsFromRows(overlayPlanAdjustments(baseRows, list), own, {
    ...ctx,
    library: ctx.library,
  });
  if (!built) return changed ? list : stored;
  const result = computeLiveAdjustments(built.inputs, built.env);
  if (result.proposals.length === 0) return changed ? list : stored;
  const fresh: LocalAdjustment[] = result.proposals.map((p) => ({
    ...p,
    id: ctx.newId(),
    planId: activeId,
    status: p.requiresConfirmation ? 'pending_confirmation' : 'applied',
    createdAt: ctx.now,
    decidedAt: null,
  }));
  const overridden = new Set(
    fresh.filter((a) => a.kind === 'state_override').map((a) => a.exerciseId),
  );
  list = list.map((a) =>
    a.kind === 'state_override' &&
    a.status === 'applied' &&
    a.planId === activeId &&
    overridden.has(a.exerciseId)
      ? { ...a, status: 'superseded', decidedAt: ctx.now }
      : a,
  );
  return [...list, ...fresh];
}

// ---------------------------------------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------------------------------------

/**
 * Anpassungen für den Folgeblock (carriedLoadWeeks, restoreTemporaryChanges). null = Stand der Anpassungen gerade
 * unbekannt (wird geladen bzw. Fehler) → den Folgeblock JETZT nicht anhängen (Wächter D M4), sonst entstünde er ohne
 * `carriedLoadWeeks`. Ohne Live-Anpassung (Supabase-Modus bis B/C) immer [] (Gratis unverändert).
 */
export function followUpAdjustments(
  rows: UserRows,
  live: {
    readonly available: boolean;
    readonly status: 'loading' | 'ready' | 'error';
    readonly adjustments: readonly LocalAdjustment[];
  },
): LocalAdjustment[] | null {
  if (!live.available) return [];
  if (live.status !== 'ready') return null;
  return activePlanAdjustments(rows, live.adjustments);
}

/** Anpassungen des aktiven Plans (neueste zuerst). */
export function activePlanAdjustments(
  rows: UserRows,
  adjustments: readonly LocalAdjustment[],
): LocalAdjustment[] {
  const id = activePlan(rows)?.plan.id;
  return adjustments
    .filter((a) => a.planId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/** Tagebuch-Einträge mit Einheit (Basis der Zustands-Vorgaben). */
function entriesOf(rows: UserRows): LiveExerciseEntry[] {
  return liveEntriesFromRows(rows);
}

/**
 * Wirksame Zustands-Vorgaben je Übung für den Trainingsmodus und „Heute“ (activeStateOverride: nur für den NEUESTEN
 * zählenden Eintrag; veraltete werden ignoriert). Leer ohne Anpassungen (Gratis unverändert).
 */
export function stateOverridesFor(
  rows: UserRows,
  adjustments: readonly LocalAdjustment[],
): ReadonlyMap<string, ExerciseProgress> {
  const own = activePlanAdjustments(rows, adjustments).filter(
    (a) => a.kind === 'state_override' && a.exerciseId !== null,
  );
  if (own.length === 0) return new Map();
  const entries = entriesOf(rows);
  const out = new Map<string, ExerciseProgress>();
  for (const id of new Set(own.map((a) => a.exerciseId as string))) {
    const override = activeStateOverride(id, own, latestCountingSessionLogId(id, entries));
    if (override) out.set(id, override);
  }
  return out;
}

/** Wirksame Anpassungen, die diese Einheit betreffen (Plan-Änderung bzw. Zustands-Vorgabe einer ihrer Übungen). */
export function adjustmentsForSession(
  rows: UserRows,
  adjustments: readonly LocalAdjustment[],
  session: Pick<StoredSession, 'id' | 'exercises'>,
): LocalAdjustment[] {
  const own = activePlanAdjustments(rows, adjustments).filter(isEffective);
  const overrides = stateOverridesFor(rows, adjustments);
  const exerciseIds = new Set(session.exercises.map((e) => e.exercise_id));
  const entries = entriesOf(rows);
  return own.filter((a) =>
    a.kind === 'plan_change'
      ? a.plannedSessionIds.includes(session.id)
      : a.kind === 'state_override' &&
        a.exerciseId !== null &&
        exerciseIds.has(a.exerciseId) &&
        overrides.has(a.exerciseId) &&
        a.basisSessionLogId === latestCountingSessionLogId(a.exerciseId, entries),
  );
}

/** Offener Vorschlag „weniger Trainingstage“ des aktiven Plans (nicht abgelaufen). */
export function openProposal(
  rows: UserRows,
  adjustments: readonly LocalAdjustment[],
  today: string,
): LocalAdjustment | null {
  return (
    activePlanAdjustments(rows, adjustments).find(
      (a) => a.status === 'pending_confirmation' && (a.expiresOn === null || a.expiresOn >= today),
    ) ?? null
  );
}

/** Darf „Rückgängig“ angeboten werden? canRevert() aus packages/core mit dem Stand des aktiven Plans. */
export function revertAllowed(
  rows: UserRows,
  adjustments: readonly LocalAdjustment[],
  adjustment: LocalAdjustment,
  ctx: { versions: ConsentVersions; today: string },
): boolean {
  const active = activePlan(rows);
  if (!active || active.plan.id !== adjustment.planId) return false;
  const snapshot = planSnapshot(active.plan);
  const rules = effectiveSafetyRules(rows, ctx.versions, ctx.today);
  return canRevert(adjustment, {
    sessions: active.sessions,
    sessionLogs: liveSessionLogsFromRows(rows.sessionLogs),
    entries: entriesOf(rows),
    today: ctx.today,
    adjustments: adjustments.filter((a) => a.planId === adjustment.planId),
    ...(snapshot && rules
      ? {
          maxLoadWeeks: loadWeeksBeforeDeload(snapshot.experienceLevel, cautiousProgression(rules)),
        }
      : {}),
    planStart: active.plan.start_date,
  });
}
