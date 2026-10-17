import { buildNutritionCatalog } from '@fitnessapp/content/catalog';
import {
  ageInYears,
  buildDataExportFile,
  createMockFoodPhotoProvider,
  runFoodPhotoAnalysis,
  displayPairs,
  displaySwapRules,
  preferenceChainFrom,
  preferenceLimitReached,
  CURRENT_CONSENT_VERSIONS,
  createBirthDateSchema,
  evaluateHealthScreening,
  healthScreeningAnswersSchema,
  intoleranceGroupsForConversion,
  isoDateSchema,
  measurementReminderIntervalSchema,
  MIN_AGE_YEARS,
  requiresMedicalNotice,
  selectNutritionContent,
  selectPlanContent,
  validateContent,
  type ConsentType,
  type ContentFile,
  type FoodProductRecord,
  type FoodGroupId,
  foodGroupSchema,
  type NutritionContentFile,
  type NutritionLibrary,
  type PlanLibrary,
  type PreferenceChange,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import {
  BackendError,
  type Backend,
  type NutritionLibraryResult,
  type PreferenceSwapContext,
} from './backend';
import { LOCAL_CONSENT_DOCUMENTS } from './consent-texts';
import {
  finishLocal,
  localPhotoLimit,
  reserveLocal,
  type LocalAiUsageRow,
} from './food-photo-local';
import { localDataExport } from './data-export';
import {
  localProductFor,
  runLocalProductLookup,
  type LocalProductLookupCount,
} from './food-product-local';
import {
  applyUserFoodProductDelete,
  applyUserFoodProductSave,
  checkUserFoodProductSave,
} from './user-food-product-rows';
import {
  applyCustomMealDelete,
  applyCustomMealSave,
  checkCustomMealSave,
} from './custom-meal-rows';
import { DraftStore } from './draft-store';
import {
  applyFavoriteChange,
  applyFoodLogDelete,
  applyFoodLogSave,
  checkFoodLogSave,
} from './food-log-rows';
import {
  applyFoodDislikes,
  applyRecipeRatings,
  checkFoodDislikesSave,
  checkRecipeRatingSave,
} from './rating-rows';
import { preferencesFromRows, sessionDisplay } from './exercise-swap';
import { checkSessionLog, isValidOp, isValidPlanOp, isValidPreferenceOp } from './local-rules';
import {
  applySessionLog,
  closeMissedSessionRows,
  deleteSessionLogRows,
  EMPTY_LOG_ROWS,
  neutralizeHealthPlanLogRows,
} from './log-rows';
import {
  applyCookDayStart,
  applyMealPlanSave,
  applyShoppingListSave,
  checkMealPlanSave,
  checkShoppingListSave,
  pruneExpiredNutritionWeeks,
} from './meal-plan-rows';
import { createMemoryProtectedStore, type ProtectedStore } from './protected-store';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { type ConsentVersions, versionsFromDocuments } from './mapping';
import { planSave } from './plan-save';
import { activePlan, effectiveSafetyRules, planSnapshot, profilesFor } from './training-plan';
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
  /**
   * Gericht per Foto (Etappe E3): Metadaten je Auswertung wie public.ai_usage (Zeitpunkt, Status, Modell, Token,
   * Kosten) – nie Foto, Info oder Antwort.
   */
  aiUsage?: LocalAiUsageRow[];
  /**
   * Produktabfrage (Etappe E4a, Testmodus mit Attrappe): Zwischenspeicher OHNE Personenbezug (wie food_products) und
   * Zähler je Stunde ohne Nummer (wie food_product_lookup_counts).
   */
  foodProducts?: Record<string, FoodProductRecord>;
  productLookups?: LocalProductLookupCount[];
}

export interface LocalBackendOptions {
  platform: ConsentPlatform;
  today: () => string;
  now: () => string;
  newId: () => string;
  /** Inhaltsdateien für den Testmodus (Standard: gebündelt aus content/, erst bei Bedarf geladen). */
  loadContent?: () => Promise<readonly ContentFile[]>;
  /**
   * Ernährungs-Bestand (Standard: Bündel bzw. Beispiel-Rezepte mit Testwerten, erst bei Bedarf geladen). Für Tests.
   */
  loadNutrition?: (options: { demo: boolean; force?: boolean }) => Promise<NutritionLibraryResult>;
  /**
   * Geschützter Entwurfs-Speicher (PLAN-PHASE-4 4.1/4.2; App verschlüsselt, Browser sessionStorage). Auch im
   * Testmodus – die Tagebuch-Einträge selbst liegen dort wie alles andere in `localDb` (dokumentierte Ausnahme).
   * Standard (Tests): Arbeitsspeicher.
   */
  draftStore?: ProtectedStore;
}

/**
 * Alle Vorgänge, die den Gerätespeicher lesen und danach schreiben („laden → ändern → speichern“), laufen im Testmodus
 * NACHEINANDER (Wächter N5a S3): Sonst könnten sich zwei automatische Schreiber überholen (z. B. Essensplan speichern
 * und Folgeblock des Trainingsplans anhängen am Montag) und eine Änderung ginge verloren – im schlimmsten Fall eine
 * Änderung an Einwilligung oder Gesundheits-Check. Reine Lesevorgänge ohne Schreiben laufen frei.
 */
const SERIALIZED_METHODS = [
  'getSession',
  'signOut',
  'createProfile',
  'loadRows',
  'grantConsents',
  'revokeConsent',
  'saveStep',
  'saveReminder',
  'deleteAccount',
  'clearDeviceData',
  'savePlan',
  'appendPlanBlock',
  'updatePlannedSession',
  'submitWorkout',
  'deleteSessionLog',
  'updateExercisePreferences',
  'setStartWeight',
  'revokeHealthData',
  'deleteStoredIntolerances',
  'saveMealPlan',
  'saveShoppingList',
  'saveCookDayStart',
  'saveRecipeRating',
  'deleteRecipeRatings',
  'saveFoodDislikes',
  'saveFoodLogEntries',
  'deleteFoodLogEntry',
  'changeFoodLogFavorite',
  'saveCustomMeal',
  'deleteCustomMeal',
  'analyzeFoodPhoto',
  'lookupFoodProduct',
  'saveUserFoodProduct',
  'deleteUserFoodProduct',
] as const satisfies readonly (keyof Backend)[];

function serializeWrites(backend: Backend): Backend {
  let tail: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const result = tail.then(run, run);
    // Fehler eines Vorgangs halten die Reihe nicht an.
    tail = result.catch(() => undefined);
    return result;
  };
  const wrapped: Record<string, unknown> = { ...backend };
  for (const key of SERIALIZED_METHODS) {
    const method = backend[key] as (...args: unknown[]) => Promise<unknown>;
    wrapped[key] = (...args: unknown[]) => serial(() => method(...args));
  }
  if (backend.signIn.kind === 'test_mode') {
    const start = backend.signIn.start;
    wrapped.signIn = { kind: 'test_mode', start: () => serial(start) };
  }
  return wrapped as unknown as Backend;
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

  /**
   * Widerruf health_data (R3): Entwürfe bereinigen, dann Einwilligung widerrufen und Daten wie der Trigger.
   * Umwandlung der Unverträglichkeiten (docs/PLAN-PHASE-5.md 7.4, S17, R2-K4, W12): NUR bei Zustimmung
   * (`convertIntolerances`) werden die Gruppen eingelesen und im SELBEN Schritt als „mag ich nicht“ geschrieben – im
   * Testmodus atomar (ein einziges Speichern von `localDb`, dazwischen gibt es keinen Stand ohne Ausschluss). Ohne
   * Zustimmung wird nichts eingelesen und nichts behalten.
   */
  async function revokeHealth(deleteLogs: boolean, convertIntolerances: boolean): Promise<void> {
    const { db, rows } = await requireProfile();
    const dislikeGroups: FoodGroupId[] | undefined = convertIntolerances
      ? intoleranceGroupsForConversion(
          rows.foodPreferences.flatMap((row) => {
            const group = foodGroupSchema.safeParse(row.food_group);
            return group.success ? [{ foodGroup: group.data, kind: row.kind }] : [];
          }),
        )
      : undefined;
    await drafts.cleanHealthPlanDrafts(deleteLogs ? 'delete' : 'neutralize');
    const now = options.now();
    const revoked: UserRows = {
      ...rows,
      consents: rows.consents.map((c) =>
        c.consent_type === 'health_data' && c.revoked_at === null ? { ...c, revoked_at: now } : c,
      ),
    };
    // Ein Widerruf darf nie scheitern (Wächter N4 K3): ungültige Alt-Einträge verwirft die Umwandlung in core.
    const next = applyHealthDataRevocation(revoked, { deleteLogs, dislikeGroups });
    await save({ ...db, rows: next });
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

  /**
   * Übungs-Präferenzen (Etappe T2): jede Änderung der Reihe nach prüfen wie die spätere Datenbank (RLS, Limit-Trigger)
   * plus canExclude für das Paar der Einheit (wie der Tausch-Dialog) – alles oder nichts.
   */
  async function updatePreferences(
    changes: readonly PreferenceChange[],
    at: PreferenceSwapContext | null,
  ): Promise<UserRows> {
    const { db, rows, session } = await requireProfile();
    const library = await planLibrary();
    const active = activePlan(rows);
    const storedSession =
      at && active
        ? active.sessions.find((s) => s.id === at.sessionId && s.kind === 'strength')
        : undefined;
    const today = options.today();
    const rules = effectiveSafetyRules(rows, LOCAL_VERSIONS, today);
    const swapRules =
      active && rules && rows.profile
        ? displaySwapRules(active.plan, rows.profile.birth_date, rules)
        : null;
    const profiles = profilesFor(active ? planSnapshot(active.plan) : null);
    /**
     * Paar der Einheit, wie es JETZT angezeigt wird (Wächter T2-K1): Die Präferenz muss an der angezeigten Übung hängen
     * oder an der Übung X einer Kette X → angezeigt (preferenceChainFrom). Ohne Day-Swaps (eine Präferenz hängt nie an
     * einem Tagestausch).
     */
    function pairFor(current: UserRows, exerciseId: string) {
      if (!active || !rules || !storedSession || !at) return null;
      const shown = sessionDisplay({
        rows: current,
        active,
        library,
        rules,
        session: storedSession,
        today,
        daySwaps: null,
        ownerUserId: null,
      });
      const pair = displayPairs(storedSession, shown.shown).find(
        (p) => p.storedOrderNo === at.storedOrderNo,
      );
      if (!pair) return null;
      const chainFrom = preferenceChainFrom(
        shown.shown.preferenceSwapped,
        pair.storedOrderNo,
        pair.shown.exercise_id,
      );
      return exerciseId === pair.shown.exercise_id || exerciseId === chainFrom
        ? { stored: pair.stored, shown: { ...pair.stored, exercise_id: exerciseId } }
        : null;
    }
    let next = rows;
    for (const change of changes) {
      if (
        change.op === 'upsert' &&
        preferenceLimitReached(
          preferencesFromRows(next),
          change.preference.exercise_id,
          change.preference.location,
        )
      ) {
        throw new BackendError('preference_limit');
      }
      const op: WriteOp =
        change.op === 'upsert'
          ? {
              kind: 'upsert_exercise_preference',
              row: { ...change.preference, user_id: session.userId },
            }
          : {
              kind: 'delete_exercise_preference',
              exerciseId: change.exercise_id,
              location: change.location,
            };
      const ok = isValidPreferenceOp(op, {
        rows: next,
        library,
        pair: change.op === 'upsert' ? pairFor(next, change.preference.exercise_id) : null,
        inSession: new Set(at?.inSession ?? []),
        ambiguousLocation: at?.ambiguousLocation ?? false,
        swapRules,
        profiles,
      });
      if (!ok) throw new BackendError('preference_rejected');
      next = applyWriteOps(next, [op], applyContext());
    }
    await save({ ...db, rows: next });
    return next;
  }

  const backend: Backend = {
    mode: 'local',
    supportsExercisePreferences: true,
    // Ernährung im Testmodus ab Etappe N4 (inkl. Schritt nutrition_setup, R2-S3).
    supportsNutrition: true,
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
      // Wie close_missed_sessions() beim Laden: verpasste Einheiten nach Wochenende → gestrichen. Löschfrist alter
      // Essenspläne/Einkaufslisten wie auf dem Server (G-N7-2).
      const rows = pruneExpiredNutritionWeeks(
        closeMissedSessionRows(db.rows, options.today()),
        options.today(),
      );
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
        await revokeHealth(false, false);
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
        nutritionSetupAvailable: true,
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

    // --- Gericht per Foto (Etappe E3): Testmodus immer mit der Attrappe, gleiche Kette wie der Server ---------
    foodPhotoStatus: async () => {
      const db = await load();
      return {
        availability: 'available',
        limit: localPhotoLimit(db.aiUsage ?? [], options.now()),
        mock: true,
      };
    },
    analyzeFoodPhoto: async ({ image, note }) => {
      const { session } = await requireProfile();
      return (
        await runFoodPhotoAnalysis(
          { note, image },
          {
            provider: createMockFoodPhotoProvider(),
            reserve: async () => {
              const db = await load();
              if (!db.rows) throw new BackendError('profile_missing');
              const reserved = reserveLocal(db.aiUsage ?? [], {
                rows: db.rows,
                versions: LOCAL_VERSIONS,
                now: options.now(),
                id: options.newId(),
                userId: session.userId,
              });
              await save({ ...db, aiUsage: reserved.usage });
              return reserved.result;
            },
            finish: async (params) => {
              const db = await load();
              await save({ ...db, aiUsage: finishLocal(db.aiUsage ?? [], params, options.now()) });
            },
          },
        )
      ).body;
    },

    // --- Produktabfrage (Etappe E4a): Testmodus immer mit der Attrappe, gleiche Kette wie der Server ---------
    lookupFoodProduct: async (code) => {
      const { db, rows, session } = await requireProfile();
      const result = await runLocalProductLookup(
        { foodProducts: db.foodProducts ?? {}, productLookups: db.productLookups ?? [] },
        { rows, versions: LOCAL_VERSIONS, userId: session.userId, now: options.now(), code },
      );
      await save({
        ...db,
        foodProducts: { ...result.state.foodProducts },
        productLookups: [...result.state.productLookups],
      });
      return result.response;
    },
    // Eigene Produkte (Etappe E4a): dieselben Regeln wie save_user_food_product (user-food-product-rows.ts); im
    // Testmodus ohne Netz. Name, Marke und Werte nie in Meldungen oder Logs.
    saveUserFoodProduct: async (product) => {
      const { db, rows, session } = await requireProfile();
      const check = checkUserFoodProductSave(rows, product, { versions: LOCAL_VERSIONS });
      if (!check.ok) {
        throw new BackendError(
          check.reason === 'consent_required'
            ? 'consent_required'
            : check.reason === 'limit'
              ? 'user_product_limit'
              : 'user_product_rejected',
          { sensitive: true },
        );
      }
      const next = applyUserFoodProductSave(rows, check.product, {
        userId: session.userId,
        now: options.now(),
        newId: options.newId,
      });
      await save({ ...db, rows: next });
      return next;
    },
    deleteUserFoodProduct: async (id) => {
      const { db, rows } = await requireProfile();
      const next = applyUserFoodProductDelete(rows, id);
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
    swapPlannedSessions: async (swap) => applyPlanOp({ kind: 'swap_planned_sessions', ...swap }),
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
      const library = await planLibrary();
      const check = checkSessionLog(payload, {
        today,
        rows,
        exercises: library.displayExercises ?? library.exercises,
        // Freie Einheit (A1b): nur freigegebene Übungen (wie der Server).
        publishedExercises: library.exercises,
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
            exercises: payload.exercises.map((e) => {
              const withId = otherExercises.has(e.id) ? { ...e, id: options.newId() } : e;
              // Freie Einheit: Name aus der Bibliothek übernehmen (wie der Server, Wächter S1).
              const name = library.exercises.get(e.exercise_id)?.name_de;
              return payload.is_free === true && name
                ? { ...withId, exercise_name_de: name }
                : withId;
            }),
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
    updateExercisePreferences: (changes, at) => updatePreferences(changes, at),
    setStartWeight: async (exerciseId, weightKg) => {
      const { db, rows } = await requireProfile();
      const next = applyChecked(rows, { kind: 'set_exercise_start_weight', exerciseId, weightKg });
      await save({ ...db, rows: next });
      return next;
    },
    revokeHealthData: (deleteLogs, conversion) => revokeHealth(deleteLogs, conversion !== null),
    deleteStoredIntolerances: async () => {
      // Wie die Lösch-Policy von food_preferences: eigene Zeilen, ohne Einwilligungs-Prüfung.
      const { db, rows } = await requireProfile();
      await save({
        ...db,
        rows: {
          ...rows,
          foodPreferences: rows.foodPreferences.filter((p) => p.kind !== 'intolerance'),
          // Essenspläne mit Gesundheitsbezug lassen über Ersatz, Weglassen und leere Plätze auf die Unverträglichkeiten
          // schließen (Wächter N3 K5) – mit löschen (sichere Richtung, Etappe N5); beim Öffnen wird neu geplant.
          mealPlans: rows.mealPlans.filter((p) => !p.uses_health_data),
          // Einkaufslisten ebenso (Ersatzprodukte, fehlende Zutaten; Etappe N5b) – samt eigener Einträge (K10).
          shoppingLists: rows.shoppingLists.filter((l) => !l.uses_health_data),
        },
      });
    },
    loadNutritionLibrary: (nutritionOptions) =>
      (options.loadNutrition ?? loadNutritionLibrary)(nutritionOptions),
    saveMealPlan: async (plan, { autoAdjusted, recipesChanged, shoppingList }) => {
      const { db, rows, session } = await requireProfile();
      const ctx = { today: options.today(), rows, versions: LOCAL_VERSIONS };
      const check = checkMealPlanSave(plan, ctx);
      const listCheck =
        shoppingList === undefined ? null : checkShoppingListSave(shoppingList, ctx);
      const failed = !check.ok ? check : listCheck !== null && !listCheck.ok ? listCheck : null;
      if (failed !== null) {
        // Ohne Werte in der Meldung (Gesundheitsdaten, 7.1).
        throw new BackendError(
          failed.reason === 'consent_required' ? 'consent_required' : 'plan_rejected',
          { sensitive: true },
        );
      }
      if (
        !check.ok ||
        (listCheck?.ok === true && listCheck.list.weekStart !== check.plan.weekStart)
      ) {
        throw new BackendError('plan_rejected', { sensitive: true });
      }
      const now = options.now();
      let next = applyMealPlanSave(rows, check.plan, {
        id: options.newId(),
        userId: session.userId,
        now,
        autoAdjusted,
        recipesChanged: recipesChanged ?? false,
      });
      // Plan und Einkaufsliste im selben Schritt (R2-S4, W22) – ein Speichervorgang.
      if (listCheck?.ok === true) {
        next = applyShoppingListSave(next, listCheck.list, {
          id: options.newId(),
          userId: session.userId,
          now,
        });
      }
      // Löschfrist wie save_meal_plan auf dem Server (G-N7-2).
      next = pruneExpiredNutritionWeeks(next, options.today());
      await save({ ...db, rows: next });
      return next;
    },
    saveShoppingList: async (list) => {
      const { db, rows, session } = await requireProfile();
      const check = checkShoppingListSave(list, {
        today: options.today(),
        rows,
        versions: LOCAL_VERSIONS,
      });
      if (!check.ok) {
        throw new BackendError(
          check.reason === 'consent_required' ? 'consent_required' : 'plan_rejected',
          { sensitive: true },
        );
      }
      const next = pruneExpiredNutritionWeeks(
        applyShoppingListSave(rows, check.list, {
          id: options.newId(),
          userId: session.userId,
          now: options.now(),
        }),
        options.today(),
      );
      await save({ ...db, rows: next });
      return next;
    },
    saveRecipeRating: async (change) => {
      // Wie die künftige Tabelle recipe_ratings (RLS: eigene Zeilen); Werte nie in Meldungen oder Logs.
      const { db, rows, session } = await requireProfile();
      const check = checkRecipeRatingSave(rows, change, options.today());
      if (!check.ok) throw new BackendError('unknown');
      const next = applyRecipeRatings(rows, check.ratings, session.userId);
      await save({ ...db, rows: next });
      return next;
    },
    deleteRecipeRatings: async () => {
      const { db, rows, session } = await requireProfile();
      const next = applyRecipeRatings(rows, [], session.userId);
      await save({ ...db, rows: next });
      return next;
    },
    saveFoodDislikes: async (foodIds) => {
      const { db, rows, session } = await requireProfile();
      const check = checkFoodDislikesSave(foodIds);
      if (!check.ok) throw new BackendError('unknown');
      const next = applyFoodDislikes(rows, check.foodIds, session.userId);
      await save({ ...db, rows: next });
      return next;
    },
    // Ernährungstagebuch (Etappe E1): dieselben Regeln wie save_food_log_entries/food_log_favorites (food-log-rows.ts);
    // im Testmodus immer ohne Netz (Gerätespeicher). Werte nie in Meldungen oder Logs.
    saveFoodLogEntries: async (entries) => {
      const { db, rows, session } = await requireProfile();
      const check = checkFoodLogSave(rows, entries, {
        today: options.today(),
        versions: LOCAL_VERSIONS,
        // E4a: Produkt-Einträge rechnet der Testmodus wie der Server aus dem Zwischenspeicher nach.
        products: localProductFor({ foodProducts: db.foodProducts ?? {} }, options.now()),
      });
      if (!check.ok) {
        throw new BackendError(
          check.reason === 'consent_required' ? 'consent_required' : 'food_log_rejected',
          { sensitive: true },
        );
      }
      // Wie der Server: gültige Einträge werden gespeichert, auch wenn ein anderer abgelehnt wird (Wächter E1 S2).
      const saved = check.outcomes.flatMap((o) => (o.kind === 'saved' ? [o.entry] : []));
      const next =
        saved.length === 0
          ? rows
          : applyFoodLogSave(rows, saved, {
              userId: session.userId,
              now: options.now(),
              newId: options.newId,
            });
      if (saved.length > 0) await save({ ...db, rows: next });
      const failed = check.outcomes.find((o) => o.kind !== 'saved');
      if (failed) {
        // Danach melden (ohne Werte); die gespeicherten Einträge bleiben.
        const code =
          failed.kind === 'rejected' && failed.code === 'out_of_range'
            ? 'food_log_out_of_range'
            : failed.kind === 'rejected' && failed.code === 'day_full'
              ? 'food_log_day_full'
              : failed.kind === 'rejected' && failed.code === 'product_unavailable'
                ? 'food_log_product_unavailable'
                : 'food_log_rejected';
        throw new BackendError(code, { sensitive: true });
      }
      return next;
    },
    deleteFoodLogEntry: async (id) => {
      const { db, rows } = await requireProfile();
      const next = applyFoodLogDelete(rows, id);
      await save({ ...db, rows: next });
      return next;
    },
    changeFoodLogFavorite: async (change) => {
      const { db, rows, session } = await requireProfile();
      const next = applyFavoriteChange(rows, change, {
        userId: session.userId,
        now: options.now(),
        versions: LOCAL_VERSIONS,
      });
      if (next === null) {
        throw new BackendError(
          change.op === 'set' && rows.foodLogFavorites.length >= 100
            ? 'favorite_limit'
            : change.op === 'set' &&
                (change.favorite.source === 'quick' || change.favorite.source === 'product') &&
                healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid'
              ? 'consent_required'
              : 'unknown',
        );
      }
      await save({ ...db, rows: next });
      return next;
    },
    // Eigene Gerichte (Etappe E2): dieselben Regeln wie save_custom_meal (custom-meal-rows.ts); im Testmodus immer
    // ohne Netz (Gerätespeicher). Name und Werte nie in Meldungen oder Logs.
    saveCustomMeal: async (meal) => {
      const { db, rows, session } = await requireProfile();
      const check = checkCustomMealSave(rows, meal, { versions: LOCAL_VERSIONS });
      if (!check.ok) {
        throw new BackendError(
          check.reason === 'consent_required'
            ? 'consent_required'
            : check.reason === 'limit'
              ? 'custom_meal_limit'
              : 'custom_meal_rejected',
          { sensitive: true },
        );
      }
      const next = applyCustomMealSave(rows, check.meal, {
        userId: session.userId,
        now: options.now(),
        newId: options.newId,
      });
      await save({ ...db, rows: next });
      return next;
    },
    deleteCustomMeal: async (id) => {
      const { db, rows } = await requireProfile();
      const next = applyCustomMealDelete(rows, id);
      await save({ ...db, rows: next });
      return next;
    },
    saveCookDayStart: async (weekStart, startedAt) => {
      const { db, rows } = await requireProfile();
      if (startedAt !== null && Number.isNaN(Date.parse(startedAt))) {
        throw new BackendError('plan_rejected');
      }
      const next = applyCookDayStart(rows, weekStart, startedAt);
      if (next === null) throw new BackendError('plan_rejected');
      await save({ ...db, rows: next });
      return next;
    },
    pendingWorkouts: async () => {
      const db = await load();
      const owner = db.session?.userId;
      return { queued: 0, drafts: owner ? (await drafts.forOwner(owner)).length : 0 };
    },
    pendingLogSessionIds: () => [],
    // Keine Ernährungs-Warteschlange im Testmodus (alles sofort im Gerätespeicher).
    nutritionSync: async () => ({ queued: 0, rejected: 0, sessionOnly: false }),
    discardRejectedNutrition: async () => undefined,
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
      const { db, rows, session } = await requireProfile();
      const file = buildDataExportFile(
        localDataExport(rows, session.userId, options.now(), {
          aiUsage: db.aiUsage ?? [],
          productLookups: (db.productLookups ?? []).filter((c) => c.user_id === session.userId),
        }),
        {
          email: session.email,
        },
      );
      if (!file) throw new BackendError('unknown');
      return file;
    },
  };
  return serializeWrites(backend);
}

// ---------------------------------------------------------------------------------------------------------
// Ernährung (docs/PLAN-PHASE-5.md 13 N2c, R2-S6, W24): Lebensmittel, Rezepte, Meal-Prep-Pläne und Ratgeber aus
// dem Inhalts-Bündel, geprüft mit `validateContent` und ausgewählt mit `selectNutritionContent(…, { allowDrafts:
// true })` – wie die Plan-Bibliothek nur hier (Testmodus). Die Katalog-Begleitdaten übersetzt
// `@fitnessapp/content/catalog` (eine Stelle, R17). Im Supabase-Build ist das Bündel leer (ab N7 Datenbank).
// ---------------------------------------------------------------------------------------------------------

/** Teil des Inhalts-Bündels, den die Ernährung braucht (siehe `src/generated/content-files.ts`). */
export interface NutritionBundle {
  readonly nutritionFiles: readonly NutritionContentFile[];
  readonly nutritionCatalog: {
    readonly extracts: readonly {
      readonly db: string;
      readonly version: string;
      readonly csv: string | null;
    }[];
    readonly expectations: string | null;
    readonly exceptions: string | null;
  };
}

/**
 * Bestand aus dem Bündel. Sind die Begleitdaten fehlerhaft (Quelle nicht in der Allowlist, Liste ungültig), werden
 * sie verworfen – dann sind alle Lebensmittel rot (R17/R18) und nichts wird ausgewählt (sichere Richtung).
 */
export function nutritionLibraryFromBundle(bundle: NutritionBundle): NutritionLibrary {
  const { catalog, problems } = buildNutritionCatalog({
    extracts: bundle.nutritionCatalog.extracts,
    expectations: bundle.nutritionCatalog.expectations ?? undefined,
    exceptions: bundle.nutritionCatalog.exceptions ?? undefined,
  });
  const result = validateContent(
    bundle.nutritionFiles,
    problems.length === 0 ? { nutritionCatalog: catalog } : {},
  );
  return selectNutritionContent(result, { allowDrafts: true });
}

let nutritionCache: Promise<NutritionLibrary> | null = null;
let demoCache: Promise<NutritionLibrary> | null = null;

/** Beispiel-Rezepte mit TESTWERTEN (`@fitnessapp/core/demo-nutrition`) – dieselben Regeln wie der echte Bestand. */
async function demoNutritionLibrary(): Promise<NutritionLibrary> {
  demoCache ??= import('@fitnessapp/core/demo-nutrition').then(({ demoNutritionContent }) => {
    const demo = demoNutritionContent();
    return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
      allowDrafts: true,
    });
  });
  return demoCache;
}

/**
 * Ernährungs-Bestand des Testmodus, erst bei Bedarf geladen (wie die Plan-Bibliothek). Hat das Bündel noch keine
 * verwendbaren Rezepte (echter Katalog fehlt), gibt es auf Wunsch (`demo`) die Beispiel-Rezepte mit Testwerten –
 * sonst den leeren Bestand (Zustand „noch keine Rezepte“). Echte Rezepte haben immer Vorrang.
 */
export async function loadNutritionLibrary(options: {
  demo: boolean;
  /** Nur E2E-Tests: Beispiel-Rezepte erzwingen (Wächter N4 K7). */
  force?: boolean;
}): Promise<NutritionLibraryResult> {
  nutritionCache ??= import('../generated/content-files').then(({ CONTENT_BUNDLE }) =>
    nutritionLibraryFromBundle(CONTENT_BUNDLE),
  );
  const library = await nutritionCache;
  const demoAvailable = library.recipes.length === 0;
  if ((demoAvailable && options.demo) || options.force === true) {
    return { library: await demoNutritionLibrary(), demo: true, demoAvailable };
  }
  return { library, demo: false, demoAvailable };
}
