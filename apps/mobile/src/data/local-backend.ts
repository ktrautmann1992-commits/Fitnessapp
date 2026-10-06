import {
  ageInYears,
  buildDataExportFile,
  CURRENT_CONSENT_VERSIONS,
  createBirthDateSchema,
  evaluateHealthScreening,
  healthScreeningAnswersSchema,
  isoDateSchema,
  measurementReminderIntervalSchema,
  MIN_AGE_YEARS,
  requiresMedicalNotice,
  selectPlanContent,
  validateContent,
  type ConsentType,
  type ContentFile,
  type PlanLibrary,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import { BackendError, type Backend } from './backend';
import { LOCAL_CONSENT_DOCUMENTS } from './consent-texts';
import { localDataExport } from './data-export';
import { DraftStore } from './draft-store';
import { checkSessionLog, isValidOp, isValidPlanOp } from './local-rules';
import {
  applySessionLog,
  closeMissedSessionRows,
  deleteSessionLogRows,
  EMPTY_LOG_ROWS,
  neutralizeHealthPlanLogRows,
} from './log-rows';
import { createMemoryProtectedStore, type ProtectedStore } from './protected-store';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { type ConsentVersions, versionsFromDocuments } from './mapping';
import { planSave } from './plan-save';
import { emptyUserRows, type AuthSession, type ConsentPlatform, type UserRows } from './types';
import {
  applyHealthDataRevocation,
  applyWriteOps,
  isSensitiveOp,
  needsHealthConsent,
  type ApplyContext,
  type WriteOp,
} from './write-ops';

/**
 * TESTMODUS (ohne Supabase): Alle Daten liegen nur auf diesem Gerät (AsyncStorage, im Browser localStorage).
 *
 * Bewusste Ausnahme von der Regel „Gesundheitsdaten nur kurz auf dem Gerät“: Der Testmodus ist nur für den
 * Test durch die Gründer gedacht, solange es noch keine Datenbank gibt. Er wird automatisch aktiv, wenn die
 * Supabase-Werte fehlen, und zeigt dauerhaft den Hinweis „Testmodus – Daten bleiben nur auf diesem Gerät“.
 *
 * Es gelten dieselben Regeln wie in der Datenbank (supabase/migrations):
 * - Mindestalter 16 beim Anlegen des Profils,
 * - ohne Profil keine Einwilligungen und keine Daten,
 * - Einwilligung nur in der aktuellen Textversion,
 * - Gesundheitsdaten (inkl. Unverträglichkeiten) nur mit gültiger Einwilligung health_data,
 * - Wertebereiche und Messdatum wie die CHECK-Bedingungen (local-rules.ts, Schemas aus packages/core),
 * - Gesundheits-Check: Flags werden hier neu berechnet (evaluateHealthScreening), bei Flags muss der
 *   Arzt-Hinweis bestätigt sein,
 * - Widerruf von health_data löscht alle Gesundheitsdaten – auch alle Pläne mit Gesundheitsbezug,
 * - Trainingspläne: dieselben Regeln wie save_training_plan, append_plan_block und der Verschiebe-Trigger
 *   (local-rules.ts isValidPlanOp); Inhalte aus dem Repository gebündelt (scripts/bundle-content.mjs), erst bei
 *   Bedarf nachgeladen.
 */

interface LocalDb {
  session: AuthSession | null;
  rows: UserRows | null;
  /**
   * Tageslimit wie private.session_log_daily_counts (Etappe B K1): gezählt werden ERSTELLUNGEN je Tag, auch später
   * gelöschte. Kein Tagebuch-Inhalt.
   */
  logCounter?: { day: string; created: number } | null;
}

export interface LocalBackendOptions {
  platform: ConsentPlatform;
  today: () => string;
  now: () => string;
  newId: () => string;
  /** Inhaltsdateien für den Testmodus (Standard: gebündelt aus content/, erst bei Bedarf geladen). */
  loadContent?: () => Promise<readonly ContentFile[]>;
  /**
   * Geschützter Entwurfs-Speicher (PLAN-PHASE-4 4.1/4.2; App verschlüsselt, Browser sessionStorage). Auch im
   * Testmodus – die Tagebuch-Einträge selbst liegen dort wie alles andere in `localDb` (dokumentierte Ausnahme).
   * Standard (Tests): Arbeitsspeicher.
   */
  draftStore?: ProtectedStore;
}

async function bundledContent(): Promise<readonly ContentFile[]> {
  const { CONTENT_BUNDLE } = await import('../generated/content-files');
  return CONTENT_BUNDLE.files;
}

const LOCAL_VERSIONS: ConsentVersions = versionsFromDocuments(LOCAL_CONSENT_DOCUMENTS);

export function createLocalBackend(store: KeyValueStore, options: LocalBackendOptions): Backend {
  let library: PlanLibrary | null = null;
  const drafts = new DraftStore(options.draftStore ?? createMemoryProtectedStore());

  /**
   * Bibliothek des Testmodus. EINZIGE Stelle mit allowDrafts: true (PLAN-PHASE-3 5.2): Entwürfe ohne roten
   * Befund, nie Probelauf-Inhalte, nie archiviert. Der Supabase-Modus nutzt immer nur freigegebene Inhalte.
   */
  async function planLibrary(): Promise<PlanLibrary> {
    if (!library) {
      const files = await (options.loadContent ?? bundledContent)();
      library = selectPlanContent(validateContent(files), { allowDrafts: true });
    }
    return library;
  }

  async function load(): Promise<LocalDb> {
    const db = (await readJson<LocalDb>(store, STORAGE_KEYS.localDb)) ?? {
      session: null,
      rows: null,
    };
    return db.rows ? { ...db, rows: upgradeStoredRows(db.rows) } : db;
  }

  async function save(db: LocalDb): Promise<void> {
    await writeJson(store, STORAGE_KEYS.localDb, db);
  }

  async function requireUser(): Promise<{ db: LocalDb; session: AuthSession }> {
    const db = await load();
    if (!db.session) {
      throw new BackendError('not_signed_in');
    }
    return { db, session: db.session };
  }

  async function requireProfile(): Promise<{ db: LocalDb; rows: UserRows; session: AuthSession }> {
    const { db, session } = await requireUser();
    if (!db.rows?.profile) {
      throw new BackendError('profile_missing');
    }
    return { db, rows: db.rows, session };
  }

  function applyContext(): ApplyContext {
    return {
      now: options.now(),
      newId: options.newId,
      flagsFor: (answers) => evaluateHealthScreening(healthScreeningAnswersSchema.parse(answers)),
      today: options.today(),
    };
  }

  /** Plan-Vorgang prüfen (wie die Datenbank-Funktionen bzw. der Trigger) und anwenden, dann speichern. */
  async function applyPlanOp(op: WriteOp): Promise<UserRows> {
    const { db, rows } = await requireProfile();
    if (needsHealthConsent(op) && healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
      throw new BackendError('consent_required', { sensitive: true });
    }
    const ok = isValidPlanOp(op, {
      today: options.today(),
      rows,
      versions: LOCAL_VERSIONS,
      library: await planLibrary(),
    });
    if (!ok) {
      throw new BackendError('plan_rejected', { sensitive: isSensitiveOp(op) });
    }
    let next = applyWriteOps(rows, [op], applyContext());
    if (op.kind === 'save_training_plan' && healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
      // H-c: Plan ohne gültige Einwilligung → Einträge aus Gesundheits-Plänen neutralisieren (wie der Server).
      next = neutralizeHealthPlanLogRows(next);
    }
    await save({ ...db, rows: next });
    return next;
  }

  /** Widerruf health_data (R3): Entwürfe bereinigen, dann Einwilligung widerrufen und Daten wie der Trigger. */
  async function revokeHealth(deleteLogs: boolean): Promise<void> {
    const { db, rows } = await requireProfile();
    await drafts.cleanHealthPlanDrafts(deleteLogs ? 'delete' : 'neutralize');
    const now = options.now();
    const revoked: UserRows = {
      ...rows,
      consents: rows.consents.map((c) =>
        c.consent_type === 'health_data' && c.revoked_at === null ? { ...c, revoked_at: now } : c,
      ),
    };
    await save({ ...db, rows: applyHealthDataRevocation(revoked, { deleteLogs }) });
  }

  /** Prüft einen Vorgang wie die RLS-Policies/Trigger der Datenbank und wendet ihn an. */
  function applyChecked(rows: UserRows, op: WriteOp): UserRows {
    if (needsHealthConsent(op) && healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
      throw new BackendError('consent_required', { sensitive: true });
    }
    // Wertebereiche, Messdatum (höchstens heute + 1 Tag) usw. wie die CHECK-Bedingungen der Datenbank.
    if (!rows.profile || !isValidOp(op, { today: options.today(), profile: rows.profile })) {
      throw new BackendError('unknown', { sensitive: isSensitiveOp(op) });
    }
    if (op.kind === 'grant_consent' && op.version !== CURRENT_CONSENT_VERSIONS[op.consentType]) {
      throw new BackendError('unknown');
    }
    if (op.kind === 'insert_health_screening') {
      const parsed = healthScreeningAnswersSchema.safeParse(op.row.answers);
      if (!parsed.success) {
        throw new BackendError('unknown', { sensitive: true });
      }
      const flags = evaluateHealthScreening(parsed.data);
      if (requiresMedicalNotice(flags) && op.row.medical_notice_acknowledged_at === null) {
        throw new BackendError('unknown', { sensitive: true });
      }
    }
    return applyWriteOps(rows, [op], applyContext());
  }

  return {
    mode: 'local',
    signIn: {
      kind: 'test_mode',
      start: async () => {
        const db = await load();
        if (db.session) {
          return db.session;
        }
        const session: AuthSession = {
          userId: db.rows?.profile?.user_id ?? options.newId(),
          email: null,
        };
        await save({ ...db, session });
        return session;
      },
    },

    getSession: async () => (await load()).session,

    signOut: async () => {
      const db = await load();
      await save({ ...db, session: null });
      // Entwürfe samt Schlüssel löschen (4.1) – die App fragt vorher nach (R6).
      await drafts.clear();
    },

    loadConsentDocuments: async () => [...LOCAL_CONSENT_DOCUMENTS],

    createProfile: async (birthDate) => {
      const { db, session } = await requireUser();
      const today = options.today();
      if (!createBirthDateSchema(today).safeParse(birthDate).success) {
        const tooYoung =
          isoDateSchema.safeParse(birthDate).success &&
          (birthDate > today || ageInYears(birthDate, today) < MIN_AGE_YEARS);
        throw new BackendError(tooYoung ? 'min_age' : 'unknown');
      }
      const rows = db.rows ?? emptyUserRows();
      await save({
        ...db,
        rows: {
          ...rows,
          profile: rows.profile
            ? { ...rows.profile, birth_date: birthDate }
            : {
                user_id: session.userId,
                birth_date: birthDate,
                sex: null,
                experience_level: null,
                locale: 'de-DE',
                cycle_module_interest: null,
                onboarding_step: null,
                onboarding_completed_at: null,
              },
        },
      });
    },

    loadRows: async () => {
      const { db } = await requireUser();
      if (!db.rows) return { rows: emptyUserRows(), offline: false };
      // Wie close_missed_sessions() beim Laden: verpasste Einheiten nach Wochenende → gestrichen.
      const rows = closeMissedSessionRows(db.rows, options.today());
      if (rows !== db.rows) await save({ ...db, rows });
      return { rows, offline: false };
    },

    grantConsents: async (types: readonly ConsentType[], versions) => {
      const { db, rows } = await requireProfile();
      let next = rows;
      for (const type of types) {
        const version = versions[type];
        if (version === null) {
          throw new BackendError('unknown');
        }
        next = applyChecked(next, {
          kind: 'grant_consent',
          consentType: type,
          version,
          platform: options.platform,
        });
      }
      await save({ ...db, rows: next });
    },

    revokeConsent: async (type) => {
      if (type === 'health_data') {
        await revokeHealth(false);
        return;
      }
      const { db, rows } = await requireProfile();
      const now = options.now();
      const next: UserRows = {
        ...rows,
        consents: rows.consents.map((c) =>
          c.consent_type === type && c.revoked_at === null ? { ...c, revoked_at: now } : c,
        ),
      };
      await save({ ...db, rows: next });
    },

    saveStep: async (stepSave, context) => {
      const { db, rows, session } = await requireProfile();
      const planned = planSave(stepSave, {
        userId: session.userId,
        answers: context.answers,
        rows,
        versions: LOCAL_VERSIONS,
        platform: options.platform,
        now: options.now(),
      });
      // Alles oder nichts: erst alle Vorgänge prüfen und anwenden, dann einmal speichern.
      let next = rows;
      for (const op of planned.ops) {
        next = applyChecked(next, op);
      }
      await save({ ...db, rows: next });
      return next;
    },

    saveReminder: async (settings, nextDueOn) => {
      const { db, rows, session } = await requireProfile();
      const interval = measurementReminderIntervalSchema.safeParse(settings.intervalDays);
      if (!interval.success) {
        throw new BackendError('unknown');
      }
      const next = applyChecked(rows, {
        kind: 'upsert_measurement_reminder',
        row: {
          user_id: session.userId,
          enabled: settings.enabled,
          interval_days: interval.data,
          next_due_on: nextDueOn,
        },
      });
      await save({ ...db, rows: next });
      return next;
    },

    deleteAccount: async () => {
      await requireUser();
      await save({ session: null, rows: null });
      await drafts.clear();
    },

    pendingChanges: () => 0,
    flush: async () => true,

    loadPlanLibrary: async () => planLibrary(),
    savePlan: async (payload) => applyPlanOp({ kind: 'save_training_plan', payload }),
    appendPlanBlock: async (planId, usesHealthData, sessions) =>
      applyPlanOp({ kind: 'append_plan_block', planId, usesHealthData, sessions }),
    updatePlannedSession: async (update) =>
      applyPlanOp({ kind: 'update_planned_session', ...update }),
    // Keine Warteschlange im Testmodus → keine Hintergrund-Ereignisse.
    subscribe: () => () => undefined,

    clearDeviceData: async () => {
      for (const key of Object.values(STORAGE_KEYS)) {
        await store.removeItem(key);
      }
      await drafts.clear();
    },

    // --- Trainingstagebuch: dieselben Regeln wie save_session_log (local-rules.ts checkSessionLog) ----------
    loadDrafts: async () => {
      const { session } = await requireUser();
      return drafts.forOwner(session.userId);
    },
    saveDraft: async (draft) => {
      await drafts.put(draft);
    },
    discardDraft: async (key) => {
      await drafts.remove(key);
    },
    submitWorkout: async (draft, payload) => {
      const { db, rows, session } = await requireProfile();
      const today = options.today();
      const check = checkSessionLog(payload, {
        today,
        rows,
        exercises: (await planLibrary()).displayExercises ?? (await planLibrary()).exercises,
        healthConsentValid: healthConsentStatus(rows, LOCAL_VERSIONS) === 'valid',
        createdToday: db.logCounter?.day === today ? db.logCounter.created : 0,
      });
      switch (check.kind) {
        case 'repeat':
          await drafts.remove(draft.key);
          return { kind: 'saved', orphaned: check.result === 'orphaned' };
        case 'conflict':
          await drafts.put({ ...draft, state: 'conflict', serverRevision: check.revision });
          return { kind: 'conflict' };
        case 'reject':
          await drafts.put({ ...draft, state: 'rejected', rejectReason: check.reason });
          return { kind: 'rejected', reason: check.reason };
        case 'write': {
          // Wie der Server (Festlegung 7): schon vergebene ids (Eintrag/Übungen) bekommen eine neue id.
          const taken = (id: string) => rows.sessionLogs.some((l) => l.id === id);
          const id = check.isNew && taken(check.id) ? options.newId() : check.id;
          const otherExercises = new Set(
            rows.exerciseLogs.filter((e) => e.session_log_id !== id).map((e) => e.id),
          );
          const stored = {
            ...payload,
            exercises: payload.exercises.map((e) =>
              otherExercises.has(e.id) ? { ...e, id: options.newId() } : e,
            ),
          };
          const next = applySessionLog(rows, stored, {
            userId: session.userId,
            linked: check.linked,
            keepTargets: check.keepTargets,
            fromHealthPlan: check.fromHealthPlan,
            id,
            revision: check.revision,
            now: options.now(),
            isIntroWeek: check.isIntroWeek,
            isDeload: check.isDeload,
          });
          const logCounter = check.isNew
            ? {
                day: today,
                created: (db.logCounter?.day === today ? db.logCounter.created : 0) + 1,
              }
            : (db.logCounter ?? null);
          await save({ ...db, rows: next, logCounter });
          await drafts.remove(draft.key);
          return { kind: 'saved', orphaned: check.result === 'orphaned' };
        }
      }
    },
    deleteSessionLog: async (id, baseRevision) => {
      const { db, rows } = await requireProfile();
      const existing = rows.sessionLogs.find((l) => l.id === id);
      if (!existing) return 'ok';
      if (existing.revision !== baseRevision) return 'conflict';
      await save({ ...db, rows: deleteSessionLogRows(rows, id, options.today()) });
      return 'ok';
    },
    setStartWeight: async (exerciseId, weightKg) => {
      const { db, rows } = await requireProfile();
      const next = applyChecked(rows, { kind: 'set_exercise_start_weight', exerciseId, weightKg });
      await save({ ...db, rows: next });
      return next;
    },
    revokeHealthData: revokeHealth,
    pendingWorkouts: async () => {
      const db = await load();
      const owner = db.session?.userId;
      return { queued: 0, drafts: owner ? (await drafts.forOwner(owner)).length : 0 };
    },
    pendingLogSessionIds: () => [],
    hasForeignDeviceData: async () => {
      const db = await load();
      return db.session ? drafts.hasForeign(db.session.userId) : false;
    },
    discardForeignDeviceData: async () => {
      const db = await load();
      const owner = db.session?.userId;
      await drafts.removeWhere((d) => d.ownerUserId !== owner);
    },
    // Testmodus: das ganze Tagebuch liegt auf dem Gerät – nichts nachzuladen.
    logHistoryStart: () => null,
    loadOlderLogs: async () => ({ logs: EMPTY_LOG_ROWS, nextBefore: null }),
    exportMyData: async () => {
      const { rows, session } = await requireProfile();
      const file = buildDataExportFile(localDataExport(rows, session.userId, options.now()), {
        email: session.email,
      });
      if (!file) throw new BackendError('unknown');
      return file;
    },
  };
}
