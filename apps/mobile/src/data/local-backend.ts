import { buildNutritionCatalog } from '@fitnessapp/content/catalog';
import {
  ageInYears,
  buildDataExportFile,
  chargeProductUse,
  isNewProductUse,
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
  shoppingProductLinkSchema,
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
  type TrackedRouteRow,
  hasValidConsent,
  type WearableImportResult,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import { applyPantryItems, applyShoppingProductLink, checkPantrySave } from './nutrition-sync';
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
  applySupplementScreening,
  applyUserSupplement,
  localSupplementExport,
  localSupplementUserData,
  rowsWithOldHealthConsent,
  withoutSupplementData,
  type LocalSupplementRecord,
} from './supplement-local';
import { supplementsFromBundle } from './supplement-library';
import {
  applySaveCompetition,
  cancelInRows,
  checkSaveInRows,
  completeInRows,
  deleteInRows,
  detachResultLog,
} from './competition-rows';
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
import {
  type LocalAdjustment,
  LiveAdjustStore,
  overlayPlanAdjustments,
  recomputeLiveAdjustments,
  revertAllowed,
} from './live-adjust';
import { checkSessionLog, isValidOp, isValidPlanOp, isValidPreferenceOp } from './local-rules';
import { checkRecipePreference } from './recipe-preference-rows';
import { markWorkoutSource, workoutsFromBundle } from './workout-library';
import {
  applyRouteAutoMatch,
  applyRouteMatch,
  applyRouteWeather,
  applyTrackedRouteDelete,
  applyTrackedRouteSave,
  applyTrackedRouteUpdate,
  detachRouteLogs,
  logEBikeToRoutes,
  type RouteCounter,
  routeEBikeToLog,
} from './tracked-route-rows';
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
import { HYDRATION_KEYS } from './hydration';
import { readJson, STORAGE_KEYS, writeJson, type KeyValueStore } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { localLoopRoutes } from './loop-routing';
import { consentRecordsFromRows, type ConsentVersions, versionsFromDocuments } from './mapping';
import {
  applyWearableConnect,
  applyWearableDisconnect,
  applyWearableImport,
  applyWearableResolve,
  applyWearableRevoke,
  EMPTY_LOCAL_WEARABLES,
  type LocalWearableStore,
  wearableRowsFor,
} from './wearable-rows';
import {
  applyWearableRouteSave,
  dismissWatchRoutes,
  followWatchRoute,
  normalizeRouteRow,
  type RouteDismissal,
  withoutWatchRoutes,
} from './wearable-route-rows';
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
  /**
   * Live-Anpassung (Phase 4b, Etappe D): Schalter „Live-Anpassung einschalten (Testmodus)“ (früher „Premium
   * simulieren“). Lebt AUSSCHLIESSLICH hier im Testmodus (Wächter K2) – kein Gesundheitsdatum, nur ein Schalter. Die
   * Anpassungen selbst liegen im geschützten Speicher `liveAdjust`, nie hier. Testphase „alles offen“ (KONZEPT 13):
   * fehlt der Wert, gilt AN (`simulatePremiumOn`); nur ein ausdrückliches `false` (Schalter aus) zeigt den Gratis-Weg.
   */
  simulatePremium?: boolean;
  /**
   * Strecken (Etappe E4, Testmodus): Zeilen wie tracked_routes (alle Konten dieses Geräts, gefiltert nach user_id) und
   * das Tageslimit wie private.tracked_route_daily_counts. Standortdaten liegen im Testmodus wie alle anderen Daten
   * nur auf diesem Gerät (dokumentierte Ausnahme des Testmodus).
   */
  trackedRoutes?: TrackedRouteRow[];
  routeCounter?: { userId: string } & RouteCounter;
  /** Von der Person gelöschte Routen der Uhr (wie private.wearable_route_dismissals, 23.10.2026). */
  routeDismissals?: RouteDismissal[];
  /**
   * Smartwatch (Phase 8, Testmodus): Zeilen wie wearable_connections/-sessions, heart_rate_summaries, daily_metrics
   * (alle Konten dieses Geräts, gefiltert nach user_id) – dokumentierte Ausnahme des Testmodus wie alle Daten hier.
   */
  wearables?: LocalWearableStore;
  /**
   * Supplement-Check und „Meine Supplements“ (Phase 6 SU4, Testmodus) je Konto – Gesundheitsdaten wie alle anderen
   * Testmodus-Daten nur auf diesem Gerät (dokumentierte Ausnahme), beim Widerruf health_data gelöscht.
   */
  supplements?: LocalSupplementRecord[];
}

/** Testphase „alles offen“ (Gründer 19.10.2026): Standard AN – nur ein ausdrücklich ausgeschalteter Schalter ist aus. */
export const simulatePremiumOn = (db: { simulatePremium?: boolean }): boolean =>
  db.simulatePremium !== false;

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
  /**
   * Live-Anpassung (Etappe D, docs/PLAN-PHASE-4B.md 8.3): geschützter Speicher der Anpassungen (App verschlüsselt,
   * Browser sessionStorage). Standard (Tests): Arbeitsspeicher.
   */
  liveAdjustStore?: ProtectedStore;
  /** Laufende Aufzeichnung (Etappe E4, geschützter Speicher `routeRecording`). Standard (Tests): Arbeitsspeicher. */
  routeRecordingStore?: ProtectedStore;
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
  'saveCompetition',
  'cancelCompetition',
  'completeCompetition',
  'deleteCompetition',
  'updatePlannedSession',
  'submitWorkout',
  'deleteSessionLog',
  'updateExercisePreferences',
  'setStartWeight',
  'setRecipePreference',
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
  'saveShoppingProductLink',
  'savePantryItems',
  'deletePantryItem',
  'saveAppLayout',
  'saveTrackedRoute',
  'updateTrackedRoute',
  'setRouteMatch',
  'setRouteAutoMatch',
  'setRouteWeather',
  'deleteTrackedRoute',
  'deleteAllTrackedRoutes',
  'saveSupplementScreening',
  'setUserSupplement',
  'deleteSupplementData',
  'simulateOldHealthConsent',
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
  // Live-Anpassung (Etappe D): lesen und schreiben localDb bzw. den geschützten Speicher – ebenfalls nacheinander.
  const live = backend.liveAdjust;
  if (live) {
    wrapped.liveAdjust = {
      simulatePremium: () => serial(() => live.simulatePremium()),
      setSimulatePremium: (enabled: boolean) => serial(() => live.setSimulatePremium(enabled)),
      adjustments: () => serial(() => live.adjustments()),
      revert: (id: string) => serial(() => live.revert(id)),
      decide: (id: string, accept: boolean) => serial(() => live.decide(id, accept)),
    } satisfies NonNullable<Backend['liveAdjust']>;
  }
  // Smartwatch (Phase 8): lesen und schreiben localDb – ebenfalls nacheinander.
  const wear = backend.wearables;
  wrapped.wearables = {
    load: () => serial(() => wear.load()),
    connect: (types) => serial(() => wear.connect(types)),
    importBatches: (batches, routes) => serial(() => wear.importBatches(batches, routes)),
    saveRoute: (route) => serial(() => wear.saveRoute(route)),
    resolveDuplicate: (id, merge) => serial(() => wear.resolveDuplicate(id, merge)),
    disconnect: (deleteImported) => serial(() => wear.disconnect(deleteImported)),
  } satisfies Backend['wearables'];
  return wrapped as unknown as Backend;
}

const isUserRows = (value: unknown): value is UserRows =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as Partial<UserRows>).plannedSessions) &&
  Array.isArray((value as Partial<UserRows>).plannedExercises) &&
  Array.isArray((value as Partial<UserRows>).plans);

/**
 * Live-Anpassung (Etappe D): JEDER Stand, den das Testmodus-Backend herausgibt, trägt die wirksamen Plan-Änderungen
 * (overlayPlanAdjustments) – so wie im Supabase-Modus die Plan-Spalten schon geändert vom Server kommen. Gespeichert
 * bleibt der ursprüngliche Plan. Ohne Anpassungen unverändert (Gratis).
 */
function withPlanOverlay(
  backend: Backend,
  overlay: (rows: UserRows) => Promise<UserRows>,
): Backend {
  const wrapped: Record<string, unknown> = { ...backend };
  for (const [key, value] of Object.entries(backend)) {
    if (typeof value !== 'function') continue;
    const method = value as (...args: unknown[]) => unknown;
    wrapped[key] = (...args: unknown[]) => {
      const result = method(...args);
      if (!(result instanceof Promise)) return result;
      return result.then(async (resolved: unknown) => {
        if (isUserRows(resolved)) return overlay(resolved);
        if (
          typeof resolved === 'object' &&
          resolved !== null &&
          'offline' in resolved &&
          isUserRows((resolved as { rows?: unknown }).rows)
        ) {
          const snapshot = resolved as unknown as { rows: UserRows };
          return { ...snapshot, rows: await overlay(snapshot.rows) };
        }
        return resolved;
      });
    };
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
  const liveStore = new LiveAdjustStore(options.liveAdjustStore ?? createMemoryProtectedStore());
  const recordingStore = options.routeRecordingStore ?? createMemoryProtectedStore();

  /** Anpassungen des Kontos (geschützter Speicher); ohne Konto leer. */
  async function adjustmentsOf(owner: string | null | undefined): Promise<LocalAdjustment[]> {
    return owner ? liveStore.load(owner) : [];
  }

  /** Stand mit wirksamen Plan-Änderungen (nur für Anzeige und Prüfungen; gespeichert wird der ursprüngliche Plan). */
  async function overlaid(rows: UserRows): Promise<UserRows> {
    try {
      const list = await adjustmentsOf(rows.profile?.user_id);
      return list.length === 0 ? rows : overlayPlanAdjustments(rows, list);
    } catch {
      // Wächter D M2: Ein Fehler der Live-Anpassung blockiert nie das Backend – Rückfall auf den gespeicherten Plan.
      return rows;
    }
  }

  /**
   * Neu rechnen (Plan 8.2, Testmodus): nach dem gespeicherten Training und beim Laden (= Sync, nach
   * close_missed_sessions). NUR mit „Live-Anpassung einschalten“ (Standard an) entstehen Anpassungen; ohne Schalter werden höchstens offene
   * Vorschläge als abgelaufen markiert. Fehler sind still (der Plan bleibt gültig, 8.4) – nie blockierend.
   */
  async function recomputeLive(rows: UserRows, entitled: boolean): Promise<void> {
    const owner = rows.profile?.user_id;
    if (!owner) return;
    try {
      const stored = await liveStore.load(owner);
      if (!entitled && stored.length === 0) return;
      const next = recomputeLiveAdjustments(rows, stored, {
        library: entitled ? await planLibrary() : null,
        versions: LOCAL_VERSIONS,
        today: options.today(),
        now: options.now(),
        newId: options.newId,
        entitled,
      });
      if (next !== stored) await liveStore.save(owner, next);
    } catch {
      // still – erneuter Versuch beim nächsten Speichern bzw. Laden (8.4 „Neu berechnen gescheitert“).
    }
  }

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
      // Live-Anpassung: geprüft wird der Plan, den die App anzeigt (mit wirksamen Plan-Änderungen).
      rows: await overlaid(rows),
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
    // Phase 8: Widerruf health_data löscht auch Puls, Tageswerte und Smartwatch-Verbindung (consents_after_revoke).
    // Phase 6 SU3 (Plan 7.3): Supplement-Check und „Meine Supplements“ ganz gelöscht.
    const session = db.session;
    const owner = rows.profile?.user_id;
    await save({
      ...db,
      rows: next,
      wearables:
        db.wearables && session ? applyWearableRevoke(db.wearables, session.userId) : db.wearables,
      // 23.10.2026: Routen der Uhr gehen mit der Verbindung (wearable_connections_after_delete).
      ...(session ? watchRoutesRemoved(db, session.userId) : {}),
      supplements: owner ? withoutSupplementData(db.supplements ?? [], owner) : db.supplements,
    });
    // Live-Anpassung (8.3, 4.7): Anpassungen sind (mittelbar) Gesundheitsdaten – der geschützte Speicher wird geleert.
    await liveStore.clear();
  }

  /** Trennen/Widerruf: Routen der Uhr und Merkliste der Person weg (wearable_connections_after_delete). */
  function watchRoutesRemoved(
    db: LocalDb,
    userId: string,
  ): Pick<LocalDb, 'trackedRoutes' | 'routeDismissals'> {
    const next = withoutWatchRoutes(db.trackedRoutes ?? [], db.routeDismissals ?? [], userId);
    return { trackedRoutes: next.routes, routeDismissals: next.dismissals };
  }

  /** Wie private.wearable_consents_locked: Einwilligungen wearable_data UND health_data gültig, sonst Ablehnung. */
  function requireWearableConsents(rows: UserRows): void {
    const records = consentRecordsFromRows(rows.consents);
    if (
      !hasValidConsent(records, 'wearable_data', LOCAL_VERSIONS.wearable_data) ||
      !hasValidConsent(records, 'health_data', LOCAL_VERSIONS.health_data)
    ) {
      throw new BackendError('consent_required', { sensitive: true });
    }
  }

  /** Prüft einen Vorgang wie die RLS-Policies/Trigger der Datenbank und wendet ihn an. */
  function applyChecked(rows: UserRows, op: WriteOp): UserRows {
    if (needsHealthConsent(op) && healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
      throw new BackendError('consent_required', { sensitive: true });
    }
    // Wertebereiche, Messdatum (höchstens heute + 1 Tag) usw. wie die CHECK-Bedingungen der Datenbank.
    if (
      !rows.profile ||
      !isValidOp(op, { today: options.today(), profile: rows.profile, goals: rows.goals })
    ) {
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
    // Live-Anpassung: Anzeige und Prüfung mit den wirksamen Plan-Änderungen (gespeichert wird ohne).
    const liveList = await adjustmentsOf(session.userId);
    const view = (current: UserRows) => overlayPlanAdjustments(current, liveList);
    const active = activePlan(view(rows));
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
        rows: view(current),
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

  const liveAdjust: NonNullable<Backend['liveAdjust']> = {
    simulatePremium: async () => simulatePremiumOn(await load()),
    setSimulatePremium: async (enabled) => {
      const { db } = await requireUser();
      await save({ ...db, simulatePremium: enabled });
      // Einschalten rechnet sofort (wie manual_recheck); Ausschalten behält die bisherigen Anpassungen (8.4).
      if (enabled && db.rows) await recomputeLive(db.rows, true);
    },
    adjustments: async () => {
      const { session } = await requireUser();
      return liveStore.load(session.userId);
    },
    revert: async (id) => {
      const { rows, session } = await requireProfile();
      const list = await liveStore.load(session.userId);
      const target = list.find((a) => a.id === id);
      if (
        !target ||
        !revertAllowed(overlayPlanAdjustments(rows, list), list, target, {
          versions: LOCAL_VERSIONS,
          today: options.today(),
        })
      ) {
        return 'not_allowed';
      }
      const now = options.now();
      await liveStore.save(
        session.userId,
        list.map((a) => (a.id === id ? { ...a, status: 'reverted', decidedAt: now } : a)),
      );
      return 'reverted';
    },
    decide: async (id, accept) => {
      const { session } = await requireProfile();
      const list = await liveStore.load(session.userId);
      const target = list.find((a) => a.id === id);
      const today = options.today();
      const now = options.now();
      if (!target || target.status !== 'pending_confirmation') return 'expired';
      if (target.expiresOn !== null && target.expiresOn < today) {
        await liveStore.save(
          session.userId,
          list.map((a) => (a.id === id ? { ...a, status: 'expired', decidedAt: now } : a)),
        );
        return 'expired';
      }
      const status = accept ? 'confirmed' : 'declined';
      await liveStore.save(
        session.userId,
        list.map((a) => (a.id === id ? { ...a, status, decidedAt: now } : a)),
      );
      return status;
    },
  };

  const backend: Backend = {
    mode: 'local',
    liveAdjust,
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
      await liveStore.clear();
      // Laufende Aufzeichnung (Standortdaten) gehört dem Konto – mit abmelden.
      await recordingStore.clear();
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
      // Plan 8.2 (Testmodus): nach close_missed_sessions neu rechnen – NUR mit „Live-Anpassung einschalten“ (Standard an).
      await recomputeLive(rows, simulatePremiumOn(db));
      return {
        rows,
        offline: false,
        liveAdjust: {
          simulatePremium: simulatePremiumOn(db),
          adjustments: await adjustmentsOf(rows.profile?.user_id),
        },
      };
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
      const { db, rows, session } = await requireProfile();
      const now = options.now();
      const next: UserRows = {
        ...rows,
        consents: rows.consents.map((c) =>
          c.consent_type === type && c.revoked_at === null ? { ...c, revoked_at: now } : c,
        ),
      };
      await save({
        ...db,
        rows: next,
        // Phase 8: Widerruf wearable_data löscht Puls, Tageswerte und Verbindung (Einheiten bleiben).
        wearables:
          type === 'wearable_data' && db.wearables
            ? applyWearableRevoke(db.wearables, session.userId)
            : db.wearables,
        // 23.10.2026: … und alle Routen der Uhr (wearable_connections_after_delete).
        ...(type === 'wearable_data' ? watchRoutesRemoved(db, session.userId) : {}),
      });
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

    // Testphase „alles offen“ (KONZEPT 13): ohne Server ist im Testmodus alles offen.
    testPhaseOpen: async () => true,
    // Erholung (25.10.2026): Angebot nur mit „Live-Anpassung einschalten“ – wie die Live-Anpassung selbst.
    liveAdjustmentActive: async () => simulatePremiumOn(await load()),

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

    // --- Rundkurs-Vorschlag (docs/PLAN-RUNDKURS.md): Testmodus immer mit der Attrappe, ohne Netz -------------
    planLoopRoutes: (request) => localLoopRoutes(request),

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
    // Etappe E2: Anordnung der Übersicht/Menüleiste – dieselben Regeln wie save_app_layout (local-rules.ts).
    saveAppLayout: async (layout) => {
      const { db, rows, session } = await requireProfile();
      const next = applyChecked(rows, {
        kind: 'save_app_layout',
        row: { user_id: session.userId, ...layout },
      });
      await save({ ...db, rows: next });
      return next;
    },
    // Einkaufen E1: gelernte Zuordnung – dieselben Regeln wie save_shopping_product_link (Einwilligung, Nummer,
    // Lebensmittel, höchstens SHOPPING_SCAN.linksMax). Nummer und Lebensmittel nie in Meldungen oder Logs.
    saveShoppingProductLink: async (link) => {
      const { db, rows, session } = await requireProfile();
      if (healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
        throw new BackendError('consent_required', { sensitive: true });
      }
      const parsed = shoppingProductLinkSchema.safeParse(link);
      if (!parsed.success) throw new BackendError('unknown', { sensitive: true });
      const next = applyShoppingProductLink(rows, parsed.data, {
        userId: session.userId,
        now: options.now(),
      });
      await save({ ...db, rows: next });
      return next;
    },

    // Vorratsschrank (25.10.2026): dieselben Regeln wie save_pantry_item (Einwilligung, Schema, Grenze). Lebensmittel
    // und Mengen nie in Meldungen oder Logs.
    savePantryItems: async (items) => {
      const { db, rows, session } = await requireProfile();
      if (healthConsentStatus(rows, LOCAL_VERSIONS) !== 'valid') {
        throw new BackendError('consent_required', { sensitive: true });
      }
      const parsed = checkPantrySave(rows, items);
      const next = applyPantryItems(rows, parsed, { userId: session.userId, now: options.now() });
      await save({ ...db, rows: next });
      return next;
    },
    // Löschen geht immer (Recht auf Löschung).
    deletePantryItem: async (foodId) => {
      const { db, rows } = await requireProfile();
      const next = { ...rows, pantryItems: rows.pantryItems.filter((p) => p.food_id !== foodId) };
      await save({ ...db, rows: next });
      return next;
    },

    deleteAccount: async () => {
      await requireUser();
      await save({ session: null, rows: null });
      await drafts.clear();
      await liveStore.clear();
      await recordingStore.clear();
    },

    pendingChanges: () => 0,
    flush: async () => true,

    loadPlanLibrary: async () => planLibrary(),
    savePlan: async (payload) => applyPlanOp({ kind: 'save_training_plan', payload }),
    appendPlanBlock: async (planId, usesHealthData, sessions) =>
      applyPlanOp({ kind: 'append_plan_block', planId, usesHealthData, sessions }),
    // Wettkampf (Etappe WP4): dieselben Regeln wie save/cancel/complete/delete_competition (packages/core).
    saveCompetition: async (payload) => {
      const { db, rows, session } = await requireProfile();
      const check = checkSaveInRows(rows, payload, {
        today: options.today(),
        versions: LOCAL_VERSIONS,
      });
      if (!check.ok) {
        throw new BackendError('competition_rejected', { competitionReason: check.reason });
      }
      const next = applySaveCompetition(rows, payload, {
        userId: session.userId,
        now: options.now(),
        newId: options.newId,
      }).rows;
      await save({ ...db, rows: next });
      return next;
    },
    cancelCompetition: async (id) => {
      const { db, rows } = await requireProfile();
      const result = cancelInRows(rows, id, options.now());
      if (!result.ok) {
        throw new BackendError('competition_rejected', { competitionReason: result.reason });
      }
      await save({ ...db, rows: result.rows });
      return result.rows;
    },
    completeCompetition: async (id, sessionLogId) => {
      const { db, rows } = await requireProfile();
      const result = completeInRows(rows, id, sessionLogId, {
        today: options.today(),
        now: options.now(),
      });
      if (!result.ok) {
        throw new BackendError('competition_rejected', { competitionReason: result.reason });
      }
      await save({ ...db, rows: result.rows });
      return result.rows;
    },
    deleteCompetition: async (id) => {
      const { db, rows } = await requireProfile();
      const result = deleteInRows(rows, id);
      if (!result.ok) {
        throw new BackendError('competition_rejected', { competitionReason: result.reason });
      }
      await save({ ...db, rows: result.rows });
      return result.rows;
    },
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
      await liveStore.clear();
      await recordingStore.clear();
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
      // Live-Anpassung: geprüft gegen den Plan, den die App anzeigt (z. B. getauschte Übung, Erholungswoche).
      const check = checkSessionLog(payload, {
        today,
        rows: await overlaid(rows),
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
          const applied = applySessionLog(rows, stored, {
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
          // Workout-Timer (docs/PLAN-WORKOUTS.md): Herkunft „workout“ wie mark_session_log_workout.
          const next = draft.workoutId === undefined ? applied : markWorkoutSource(applied, id);
          const logCounter = check.isNew
            ? {
                day: today,
                created: (db.logCounter?.day === today ? db.logCounter.created : 0) + 1,
              }
            : (db.logCounter ?? null);
          // E-Bike: verknüpfte Rad-Strecke folgt dem Eintrag (wie save_session_log).
          const trackedRoutes = db.trackedRoutes
            ? logEBikeToRoutes(db.trackedRoutes, {
                cardioLogs: next.cardioLogs.filter((c) => c.session_log_id === id),
              })
            : db.trackedRoutes;
          await save({ ...db, rows: next, logCounter, trackedRoutes });
          await drafts.remove(draft.key);
          // Plan 8.2 (Testmodus): nach dem gespeicherten Training neu rechnen – NUR mit „Live-Anpassung einschalten“ (Standard an).
          await recomputeLive(next, simulatePremiumOn(db));
          return { kind: 'saved', orphaned: check.result === 'orphaned' };
        }
      }
    },
    deleteSessionLog: async (id, baseRevision) => {
      const { db, rows } = await requireProfile();
      const existing = rows.sessionLogs.find((l) => l.id === id);
      if (!existing) return 'ok';
      if (existing.revision !== baseRevision) return 'conflict';
      // Ergebnis eines Wettkampfs: Verweis wird leer, der Wettkampf bleibt erledigt (on delete set null).
      const nextRows = detachResultLog(deleteSessionLogRows(rows, id, options.today()), id);
      await save({
        ...db,
        rows: nextRows,
        // Strecke mit diesem Eintrag: Verweis leer, Strecke bleibt (on delete set null).
        trackedRoutes: detachRouteLogs(
          db.trackedRoutes ?? [],
          new Set(nextRows.sessionLogs.map((l) => l.id)),
        ),
      });
      return 'ok';
    },
    updateExercisePreferences: (changes, at) => updatePreferences(changes, at),
    setStartWeight: async (exerciseId, weightKg) => {
      const { db, rows } = await requireProfile();
      const next = applyChecked(rows, { kind: 'set_exercise_start_weight', exerciseId, weightKg });
      await save({ ...db, rows: next });
      return next;
    },
    setRecipePreference: async (recipeId, kind) => {
      // Wie recipe_preferences (RLS: eigene Zeile, Profil-Pflicht, Höchstzahl) – geht ohne Netz (Gerätespeicher).
      const { db, rows } = await requireProfile();
      const userId = rows.profile?.user_id ?? '';
      const check = checkRecipePreference(
        rows,
        { recipeId, kind },
        { userId, today: options.today() },
      );
      if (!check.ok) {
        throw new BackendError(check.reason === 'limit' ? 'recipe_preference_limit' : 'unknown');
      }
      const next = applyChecked(rows, { kind: 'set_recipe_preference', recipeId, row: check.row });
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
      // Wächter M1: neue Nutzung einer Nummer zählt wie eine Abfrage (wie private.food_product_charge).
      let lookups = [...(db.productLookups ?? [])];
      const outcomes = check.outcomes.map((o) => {
        if (o.kind !== 'saved') return o;
        const previous = rows.foodLogEntries.find((e) => e.id === o.entry.id) ?? null;
        if (!isNewProductUse(o.entry, previous)) return o;
        const charged = chargeProductUse(
          lookups.filter((c) => c.user_id === session.userId),
          options.now(),
        );
        if (charged === null) return { kind: 'rejected' as const, code: 'product_limit' as const };
        lookups = [
          ...lookups.filter((c) => c.user_id !== session.userId),
          ...charged.map((c) => ({ ...c, user_id: session.userId })),
        ];
        return o;
      });
      // Wie der Server: gültige Einträge werden gespeichert, auch wenn ein anderer abgelehnt wird (Wächter E1 S2).
      const saved = outcomes.flatMap((o) => (o.kind === 'saved' ? [o.entry] : []));
      const next =
        saved.length === 0
          ? rows
          : applyFoodLogSave(rows, saved, {
              userId: session.userId,
              now: options.now(),
              newId: options.newId,
            });
      if (saved.length > 0) await save({ ...db, rows: next, productLookups: lookups });
      const failed = outcomes.find((o) => o.kind !== 'saved');
      if (failed) {
        // Danach melden (ohne Werte); die gespeicherten Einträge bleiben.
        const code =
          failed.kind === 'rejected' && failed.code === 'out_of_range'
            ? 'food_log_out_of_range'
            : failed.kind === 'rejected' && failed.code === 'day_full'
              ? 'food_log_day_full'
              : failed.kind === 'rejected' && failed.code === 'product_unavailable'
                ? 'food_log_product_unavailable'
                : failed.kind === 'rejected' && failed.code === 'product_limit'
                  ? 'food_log_product_limit'
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
      // Wächter M1: ein NEUER Produkt-Favorit mit Nummer zählt wie eine Abfrage.
      let lookups = db.productLookups ?? [];
      if (
        change.op === 'set' &&
        change.favorite.source === 'product' &&
        change.favorite.product_code !== null &&
        !rows.foodLogFavorites.some((f) => f.fav_key === change.favorite.fav_key)
      ) {
        const charged = chargeProductUse(
          lookups.filter((c) => c.user_id === session.userId),
          options.now(),
        );
        if (charged === null) throw new BackendError('food_log_product_limit', { sensitive: true });
        lookups = [
          ...lookups.filter((c) => c.user_id !== session.userId),
          ...charged.map((c) => ({ ...c, user_id: session.userId })),
        ];
      }
      await save({ ...db, rows: next, productLookups: lookups });
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
    // Testmodus: alle Körperdaten liegen im Gerätespeicher.
    loadWeightHistory: async (from) => {
      const db = await load();
      return (db.rows?.bodyMetrics ?? [])
        .filter((r) => r.weight_kg !== null && r.measured_on >= from)
        .map((r) => ({ measured_on: r.measured_on, weight_kg: r.weight_kg as number }))
        .sort((a, b) => a.measured_on.localeCompare(b.measured_on));
    },
    // Workout-Bibliothek (docs/PLAN-WORKOUTS.md): aus dem Bündel, geprüft wie content:validate.
    loadWorkoutLibrary: async () => {
      const { CONTENT_BUNDLE } = await import('../generated/content-files');
      return {
        workouts: workoutsFromBundle(CONTENT_BUNDLE.files, CONTENT_BUNDLE.workoutFiles),
        cached: false,
      };
    },
    // --- Supplemente (Phase 6 SU4): Inhalte aus dem Bündel, Nutzerdaten im Gerätespeicher (supplement-local.ts) ---
    loadSupplementLibrary: async () => {
      const { CONTENT_BUNDLE } = await import('../generated/content-files');
      const entries = supplementsFromBundle(CONTENT_BUNDLE.supplementFiles ?? []);
      return {
        entries,
        cached: false,
        drafts: entries.some((entry) => entry.status === 'draft'),
      };
    },
    loadSupplementUserData: async () => {
      const { db, session } = await requireUser();
      return localSupplementUserData(db.supplements ?? [], session.userId);
    },
    saveSupplementScreening: async (answers) => {
      const { db, rows, session } = await requireProfile();
      const supplements = applySupplementScreening(db.supplements ?? [], {
        rows,
        versions: LOCAL_VERSIONS,
        userId: session.userId,
        answers,
        now: options.now(),
      });
      await save({ ...db, supplements });
      return localSupplementUserData(supplements, session.userId);
    },
    setUserSupplement: async (id, status) => {
      const { db, rows, session } = await requireProfile();
      const supplements = applyUserSupplement(db.supplements ?? [], {
        rows,
        versions: LOCAL_VERSIONS,
        userId: session.userId,
        id,
        status,
        now: options.now(),
      });
      await save({ ...db, supplements });
      return localSupplementUserData(supplements, session.userId);
    },
    deleteSupplementData: async () => {
      const { db, session } = await requireUser();
      const supplements = withoutSupplementData(db.supplements ?? [], session.userId);
      await save({ ...db, supplements });
      return localSupplementUserData(supplements, session.userId);
    },
    simulateOldHealthConsent: async () => {
      const { db, rows } = await requireProfile();
      await save({ ...db, rows: rowsWithOldHealthConsent(rows) });
    },
    exportMyData: async () => {
      const { db, rows, session } = await requireProfile();
      const file = buildDataExportFile(
        localDataExport(rows, session.userId, options.now(), {
          aiUsage: db.aiUsage ?? [],
          productLookups: (db.productLookups ?? []).filter((c) => c.user_id === session.userId),
          planAdjustments: await liveStore.load(session.userId),
          trackedRoutes: (db.trackedRoutes ?? []).filter((r) => r.user_id === session.userId),
          wearables: wearableRowsFor(db.wearables ?? EMPTY_LOCAL_WEARABLES, rows, session.userId),
          ...localSupplementExport(db.supplements ?? [], session.userId),
          // Trinken (25.10.2026): eigener Gerätespeicher (data/hydration.ts), nur eigene Zeilen.
          hydrationLogs: (
            (await readJson<{ user_id?: unknown }[]>(store, HYDRATION_KEYS.local).catch(
              () => null,
            )) ?? []
          ).filter((r) => r && r.user_id === session.userId),
        }),
        {
          email: session.email,
        },
      );
      if (!file) throw new BackendError('unknown');
      return file;
    },

    // --- Ausdauer: Strecken (Etappe E4) – dieselben Regeln wie save/update/delete_tracked_route -------------------
    loadTrackedRoutes: async () => {
      const { db, session } = await requireUser();
      const routes = (db.trackedRoutes ?? [])
        .filter((r) => r.user_id === session.userId)
        .map(normalizeRouteRow)
        .sort((a, b) => b.started_at.localeCompare(a.started_at));
      return { routes, pending: [], offline: false };
    },
    saveTrackedRoute: async (payload) => {
      const { db, rows, session } = await requireProfile();
      const today = options.today();
      const counter =
        db.routeCounter && db.routeCounter.userId === session.userId ? db.routeCounter : null;
      const result = applyTrackedRouteSave(
        payload,
        { routes: db.trackedRoutes ?? [], rows, counter },
        { userId: session.userId, now: options.now(), today, newId: options.newId },
      );
      if (result.kind === 'repeat') return 'saved';
      if (result.kind === 'reject') {
        throw new BackendError(result.reason === 'daily_limit' ? 'route_limit' : 'route_rejected');
      }
      await save({
        ...db,
        rows: result.rows,
        trackedRoutes: result.routes,
        routeCounter: { userId: session.userId, ...result.counter },
      });
      return 'saved';
    },
    updateTrackedRoute: async (payload) => {
      const { db, rows, session } = await requireProfile();
      const now = options.now();
      const next = applyTrackedRouteUpdate(payload, db.trackedRoutes ?? [], {
        userId: session.userId,
        now,
      });
      if (next === 'invalid' || next === 'not_found') throw new BackendError('route_rejected');
      // E-Bike angegeben: verknüpfter Rad-Eintrag folgt (wie update_tracked_route, Revision + 1).
      const route = next.find((r) => r.id === payload.id);
      const nextRows =
        payload.e_bike !== undefined && route ? routeEBikeToLog(rows, route, now) : rows;
      await save({ ...db, rows: nextRows, trackedRoutes: next });
    },
    setRouteMatch: async (routeId, favoriteId, state) => {
      const { db, session } = await requireUser();
      const result = applyRouteMatch(
        (db.trackedRoutes ?? []).map(normalizeRouteRow),
        { routeId, favoriteId, state },
        { userId: session.userId, now: options.now() },
      );
      if (result.kind === 'reject') throw new BackendError('route_rejected');
      if (result.outcome !== 'unchanged') await save({ ...db, trackedRoutes: result.routes });
      return result.outcome;
    },
    setRouteWeather: async (routeId, weather) => {
      const { db, session } = await requireUser();
      const next = applyRouteWeather(
        (db.trackedRoutes ?? []).map(normalizeRouteRow),
        routeId,
        weather,
        { userId: session.userId, now: options.now() },
      );
      if (next === 'invalid' || next === 'not_found') throw new BackendError('route_rejected');
      await save({ ...db, trackedRoutes: next });
    },
    setRouteAutoMatch: async (routeId, enabled) => {
      const { db, session } = await requireUser();
      const next = applyRouteAutoMatch(
        (db.trackedRoutes ?? []).map(normalizeRouteRow),
        routeId,
        enabled,
        { userId: session.userId, now: options.now() },
      );
      if (next === 'not_found') throw new BackendError('route_rejected');
      await save({ ...db, trackedRoutes: next });
    },
    deleteTrackedRoute: async (id) => {
      const { db, session } = await requireUser();
      const next = applyTrackedRouteDelete(db.trackedRoutes ?? [], id, session.userId);
      if (next === 'not_found') return;
      const removed = (db.trackedRoutes ?? []).filter((r) => r.id === id);
      await save({
        ...db,
        trackedRoutes: next,
        routeDismissals: dismissWatchRoutes(removed, db.routeDismissals ?? []),
      });
    },
    deleteAllTrackedRoutes: async () => {
      const { db, session } = await requireUser();
      const all = db.trackedRoutes ?? [];
      const own = all.filter((r) => r.user_id === session.userId);
      await save({
        ...db,
        trackedRoutes: all.filter((r) => r.user_id !== session.userId),
        routeDismissals: dismissWatchRoutes(own, db.routeDismissals ?? []),
      });
      return own.length;
    },
    // Keine Warteschlange im Testmodus.
    retryPendingRoute: async () => undefined,
    discardPendingRoute: async () => undefined,
    readRecording: () => recordingStore.read(),
    writeRecording: (text) => recordingStore.write(text),
    clearRecording: () => recordingStore.clear(),

    // --- Smartwatch (Phase 8) – dieselben Regeln wie connect_wearable/import_wearable_batch/… -------------------
    wearables: {
      load: async () => {
        const { db, session } = await requireUser();
        return {
          rows: wearableRowsFor(
            db.wearables ?? EMPTY_LOCAL_WEARABLES,
            db.rows ?? { sessionLogs: [] },
            session.userId,
          ),
          pending: 0,
          offline: false,
        };
      },
      connect: async (types) => {
        const { db, rows, session } = await requireProfile();
        requireWearableConsents(rows);
        await save({
          ...db,
          wearables: applyWearableConnect(db.wearables ?? EMPTY_LOCAL_WEARABLES, types, {
            userId: session.userId,
            now: options.now(),
          }),
        });
      },
      importBatches: async (batches, routes = []) => {
        const { db, rows, session } = await requireProfile();
        requireWearableConsents(rows);
        let store = db.wearables ?? EMPTY_LOCAL_WEARABLES;
        let next = rows;
        const total: WearableImportResult = {
          created: 0,
          updated: 0,
          merged: 0,
          skipped: 0,
          days: 0,
        };
        for (const batch of batches) {
          const applied = applyWearableImport(store, next, batch, {
            userId: session.userId,
            now: options.now(),
            today: options.today(),
            newId: options.newId,
          });
          store = applied.store;
          next = applied.rows;
          total.created += applied.result.created;
          total.updated += applied.result.updated;
          total.merged += applied.result.merged;
          total.skipped += applied.result.skipped;
          total.days += applied.result.days;
        }
        // Routen der Uhr NACH den Einheiten (save_wearable_route braucht die übernommene Einheit).
        let trackedRoutes = db.trackedRoutes ?? [];
        let routeDismissals = db.routeDismissals ?? [];
        for (const route of routes) {
          const saved = applyWearableRouteSave(
            route,
            false,
            { routes: trackedRoutes, rows: next, wearables: store, dismissals: routeDismissals },
            { userId: session.userId, now: options.now(), newId: options.newId },
          );
          if (saved.kind === 'reject') continue;
          trackedRoutes = saved.routes;
          routeDismissals = saved.dismissals;
          next = saved.rows;
        }
        await save({ ...db, rows: next, wearables: store, trackedRoutes, routeDismissals });
        return { kind: 'imported', result: total };
      },
      saveRoute: async (route) => {
        const { db, rows, session } = await requireProfile();
        requireWearableConsents(rows);
        const saved = applyWearableRouteSave(
          route,
          true,
          {
            routes: db.trackedRoutes ?? [],
            rows,
            wearables: db.wearables ?? EMPTY_LOCAL_WEARABLES,
            dismissals: db.routeDismissals ?? [],
          },
          { userId: session.userId, now: options.now(), newId: options.newId },
        );
        if (saved.kind === 'reject') throw new BackendError('route_rejected');
        await save({
          ...db,
          rows: saved.rows,
          trackedRoutes: saved.routes,
          routeDismissals: saved.dismissals,
        });
      },
      resolveDuplicate: async (id, merge) => {
        const { db, rows, session } = await requireProfile();
        if (merge) requireWearableConsents(rows);
        const result = applyWearableResolve(
          db.wearables ?? EMPTY_LOCAL_WEARABLES,
          rows,
          id,
          merge,
          {
            userId: session.userId,
            now: options.now(),
          },
        );
        if (result === 'not_found' || result === 'invalid') {
          throw new BackendError('wearable_rejected', { sensitive: true });
        }
        const target = (db.wearables ?? EMPTY_LOCAL_WEARABLES).sessions.find(
          (w) => w.session_log_id === id,
        )?.duplicate_of;
        await save({
          ...db,
          rows: result.rows,
          wearables: result.store,
          // Route folgt dem führenden Eintrag (wearable_route_follow_session).
          trackedRoutes:
            merge && target
              ? followWatchRoute(db.trackedRoutes ?? [], id, target, session.userId)
              : db.trackedRoutes,
        });
      },
      disconnect: async (deleteImported) => {
        const { db, rows, session } = await requireProfile();
        const result = applyWearableDisconnect(
          db.wearables ?? EMPTY_LOCAL_WEARABLES,
          rows,
          deleteImported,
          session.userId,
        );
        await save({
          ...db,
          rows: result.rows,
          wearables: result.store,
          ...watchRoutesRemoved(db, session.userId),
        });
        return result.deleted;
      },
    },
  };
  return serializeWrites(withPlanOverlay(backend, overlaid));
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
let demoTestphaseCache: Promise<NutritionLibrary> | null = null;

/**
 * Beispiel-Rezepte mit TESTWERTEN (`@fitnessapp/core/demo-nutrition`) – dieselben Regeln wie der echte Bestand.
 * `testphase` (nur E2E): dieselben Inhalte als „freigegeben, nicht fachlich geprüft“ (Testphase 19.10.2026).
 */
async function demoNutritionLibrary(testphase = false): Promise<NutritionLibrary> {
  const load = () =>
    import('@fitnessapp/core/demo-nutrition').then(
      ({ demoNutritionContent, demoNutritionContentAsTestphase }) => {
        const demo = testphase ? demoNutritionContentAsTestphase() : demoNutritionContent();
        return selectNutritionContent(
          validateContent(demo.files, { nutritionCatalog: demo.catalog }),
          { allowDrafts: true },
        );
      },
    );
  if (testphase) {
    demoTestphaseCache ??= load();
    return demoTestphaseCache;
  }
  demoCache ??= load();
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
  /** Nur E2E-Tests: Beispiel-Rezepte als „freigegeben, nicht fachlich geprüft“ (Testphase 19.10.2026). */
  testphase?: boolean;
}): Promise<NutritionLibraryResult> {
  nutritionCache ??= import('../generated/content-files').then(({ CONTENT_BUNDLE }) =>
    nutritionLibraryFromBundle(CONTENT_BUNDLE),
  );
  const library = await nutritionCache;
  const demoAvailable = library.recipes.length === 0;
  if ((demoAvailable && options.demo) || options.force === true) {
    return {
      library: await demoNutritionLibrary(options.testphase === true),
      demo: true,
      demoAvailable,
    };
  }
  return { library, demo: false, demoAvailable };
}
