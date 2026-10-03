import {
  ageInYears,
  CURRENT_CONSENT_VERSIONS,
  createBirthDateSchema,
  evaluateHealthScreening,
  healthScreeningAnswersSchema,
  isoDateSchema,
  measurementReminderIntervalSchema,
  MIN_AGE_YEARS,
  requiresMedicalNotice,
  type ConsentType,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import { BackendError, type Backend } from './backend';
import { LOCAL_CONSENT_DOCUMENTS } from './consent-texts';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './kv';
import { type ConsentVersions, versionsFromDocuments } from './mapping';
import { planSave } from './plan-save';
import { emptyUserRows, type AuthSession, type ConsentPlatform, type UserRows } from './types';
import {
  applyWriteOps,
  isSensitiveOp,
  withoutHealthData,
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
 * - Gesundheits-Check: Flags werden hier neu berechnet (evaluateHealthScreening), bei Flags muss der
 *   Arzt-Hinweis bestätigt sein,
 * - Widerruf von health_data löscht alle Gesundheitsdaten.
 */

interface LocalDb {
  session: AuthSession | null;
  rows: UserRows | null;
}

export interface LocalBackendOptions {
  platform: ConsentPlatform;
  today: () => string;
  now: () => string;
  newId: () => string;
}

const LOCAL_VERSIONS: ConsentVersions = versionsFromDocuments(LOCAL_CONSENT_DOCUMENTS);

export function createLocalBackend(store: KeyValueStore, options: LocalBackendOptions): Backend {
  async function load(): Promise<LocalDb> {
    return (await readJson<LocalDb>(store, STORAGE_KEYS.localDb)) ?? { session: null, rows: null };
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
    };
  }

  /** Prüft einen Vorgang wie die RLS-Policies/Trigger der Datenbank und wendet ihn an. */
  function applyChecked(rows: UserRows, op: WriteOp): UserRows {
    if (isSensitiveOp(op) && healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
      throw new BackendError('consent_required', { sensitive: true });
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
      return { rows: db.rows ?? emptyUserRows(), offline: false };
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
      const { db, rows } = await requireProfile();
      const now = options.now();
      let next: UserRows = {
        ...rows,
        consents: rows.consents.map((c) =>
          c.consent_type === type && c.revoked_at === null ? { ...c, revoked_at: now } : c,
        ),
      };
      if (type === 'health_data') {
        next = withoutHealthData(next);
      }
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
    },

    pendingChanges: () => 0,
    flush: async () => true,

    clearDeviceData: async () => {
      for (const key of Object.values(STORAGE_KEYS)) {
        await store.removeItem(key);
      }
    },
  };
}
