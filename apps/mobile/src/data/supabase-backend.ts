import {
  evaluateHealthScreening,
  HEALTH_PLAN_CACHE_MAX_AGE_DAYS,
  healthScreeningAnswersSchema,
  isoDateInTimeZone,
  type ConsentType,
  type PlanLibrary,
  type PlanSafetyRules,
} from '@fitnessapp/core';
import type { AppSupabaseClient, Json } from '@fitnessapp/db';

import { BackendError, type Backend, type BackendErrorCode, type BackendEvent } from './backend';
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
import { createMemoryProtectedStore, type ProtectedStore } from './protected-store';
import { SyncQueue } from './sync-queue';
import { effectiveSafetyRules } from './training-plan';
import {
  type AuthSession,
  type ConsentDocument,
  type ConsentPlatform,
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
  // 42501 = RLS-Verstoß: bei Gesundheitsdaten fehlt die (aktuelle) Einwilligung, sonst das Profil.
  if (e.code === '42501') {
    return sensitive ? 'consent_required' : 'profile_missing';
  }
  if (e.code === 'PGRST301' || e.status === 401) {
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
}

const CONSENT_TYPES_WITH_TEXT = ['terms', 'privacy', 'health_data'] as const;

export function createSupabaseBackend(options: SupabaseBackendOptions): Backend {
  const { client, store } = options;
  const protectedStore = options.protectedStore ?? createMemoryProtectedStore();
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
        for (const listener of listeners) listener({ kind: 'plan_change_dropped' });
      }
    },
  });

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
  async function writeCache(userId: string, rows: UserRows): Promise<void> {
    const split = cacheableRows(rows, { allowHealthPlanCache: true });
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
    await writeCache(userId, rows);
    return rows;
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
      await queue.flush();
      await client.auth.signOut();
      await queue.clear();
      await store.removeItem(STORAGE_KEYS.rowsCache);
      await protectedStore.clear();
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
      await queue.flush();
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
        const rows = upgradeStoredRows(cache.rows);
        const health = await readHealthCache(session.userId);
        return {
          rows: health?.plans
            ? {
                ...rows,
                plans: [...rows.plans, ...health.plans.plans],
                plannedSessions: [...rows.plannedSessions, ...health.plans.plannedSessions],
                plannedExercises: [...rows.plannedExercises, ...health.plans.plannedExercises],
              }
            : rows,
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
      if (type === 'health_data') {
        // Die Datenbank löscht alle Pläne mit Gesundheitsbezug – der geschützte Zwischenspeicher sofort auch.
        await protectedStore.clear();
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
      await queue.clear();
      await store.removeItem(STORAGE_KEYS.rowsCache);
      await protectedStore.clear();
      // Die Sitzung gehört zu einem gelöschten Konto – nur lokal abmelden.
      await client.auth.signOut({ scope: 'local' });
      currentUserId = null;
    },

    pendingChanges: () => queue.size(),
    flush: () => queue.flush(),

    clearDeviceData: async () => {
      await queue.clear();
      for (const key of Object.values(STORAGE_KEYS)) {
        await store.removeItem(key);
      }
      await protectedStore.clear();
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
      try {
        await executeWriteOp(client, session.userId, { kind: 'save_training_plan', payload });
      } catch (error) {
        throw toPlanError(error, payload.uses_health_data);
      }
      // Ein neuer Plan ersetzt ausdrücklich alle wartenden Verschiebungen des alten Plans.
      await queue.remove((op) => op.kind === 'update_planned_session');
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
  };

  void queue.load();
  return backend;
}
