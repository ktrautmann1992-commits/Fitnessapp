import {
  addDays,
  buildDataExportFile,
  customMealPayloadSchema,
  customMealSaveResultSchema,
  userFoodProductPayloadSchema,
  userFoodProductSaveResultSchema,
  evaluateHealthScreening,
  type FoodLogEntry,
  foodLogPayloadEntrySchema,
  foodLogSaveResponseSchema,
  type MealPlanWeek,
  mealPlanRetentionStart,
  shoppingProductLinkSchema,
  type StoredShoppingList,
  toMealPlanPayload,
  toShoppingListPayload,
  foodGroupSchema,
  HEALTH_PLAN_CACHE_MAX_AGE_DAYS,
  healthScreeningAnswersSchema,
  HISTORY_PAGE_SIZE,
  intoleranceGroupsForConversion,
  isoDateInTimeZone,
  LOG_CACHE_WEEKS,
  nutritionSetupColumnsSchema,
  type CompetitionErrorReason,
  type ConsentType,
  type NutritionLibrary,
  type PlanLibrary,
  type PlanSafetyRules,
  type SessionLogPayload,
  type TrackedRoutePayload,
  type TrackedRouteRow,
  updateTrackedRouteSchema,
  routeWeatherSchema,
  type DailyMetricRow,
  type HeartRateSummaryRow,
  type WearableConnectionRow,
  type WearableImportBatch,
  wearableImportResultSchema,
  type WearableRoutePayload,
  type WearableRows,
  type WearableSessionRow,
  EMPTY_SUPPLEMENT_USER_DATA,
  storedSupplementScreeningSchema,
  type SupplementUserData,
  userSupplementChoiceSchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient, Json, Tables } from '@fitnessapp/db';

import {
  BackendError,
  type Backend,
  type BackendErrorCode,
  type BackendEvent,
  type IntoleranceConversion,
  type LogSaveOutcome,
  type OlderLogsPage,
} from './backend';
import { DraftStore } from './draft-store';
import { requestLiveAdjustment } from './live-adjust-remote';
import { createRemoteFoodPhoto } from './food-photo-remote';
import { appLayoutRowFromDb } from './app-layout';
import { createRemoteFoodProduct } from './food-product-remote';
import { applyUserFoodProductDelete, checkUserFoodProductSave } from './user-food-product-rows';
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
import { normalizeRouteRow } from './wearable-route-rows';
import {
  WearableQueue,
  type WearableRouteSendResult,
  type WearableSendResult,
} from './wearable-queue';
import { healthConsentStatus } from '../state/flow';
import { applyFavoriteChange, applyFoodLogDelete, checkFoodLogSave } from './food-log-rows';
import { applyCustomMealDelete, checkCustomMealSave } from './custom-meal-rows';
import {
  applyCookDayStart,
  applyMealPlanSave,
  applyShoppingListSave,
  checkMealPlanSave,
  checkShoppingListSave,
  storedMealPlanRow,
  storedShoppingListRow,
} from './meal-plan-rows';
import {
  applyNutritionQueue,
  checkedOnlyChanges,
  customMealRowsFromDb,
  userFoodProductRowsFromDb,
  type DbContentRow,
  type DbMealPlan,
  type DbMealPlanItem,
  type DbNutritionContent,
  type DbShoppingList,
  type DbShoppingListItem,
  EMPTY_NUTRITION_ROWS,
  foodLogFavoriteRowsFromDb,
  foodLogRowsFromDb,
  ForeignNutritionQueueError,
  NutritionQueueLockedError,
  fullPlansOf,
  mealPlanPayloadInputs,
  mealPlanRowsFromDb,
  NUTRITION_CONTENT_TABLES,
  nutritionLibraryFromDb,
  NutritionQueue,
  type NutritionQueueOp,
  type NutritionRejectReason,
  nutritionQueueKey,
  type NutritionRows,
  nutritionRowsOf,
  type NutritionSendResult,
  readNutritionCache,
  shoppingListRowsFromDb,
  applyShoppingProductLink,
  shoppingProductLinkRowsFromDb,
  withPreservedPastItems,
  writeNutritionCache,
} from './nutrition-sync';
import {
  applyFoodDislikes,
  applyRecipeRatings,
  checkFoodDislikesSave,
  checkRecipeRatingSave,
} from './rating-rows';
import { RouteQueue, type RouteSendResult } from './route-queue';
import { SyncQueue } from './sync-queue';
import { effectiveSafetyRules } from './training-plan';
import {
  emptyUserRows,
  NUTRITION_SETUP_DB_COLUMNS,
  type AuthSession,
  type CardioLogRow,
  type ConsentDocument,
  type CompetitionRow,
  type ConsentPlatform,
  type ExerciseLogRow,
  type FoodDislikeRow,
  type NutritionPrefsRow,
  type RecipeRatingRow,
  type SessionLogRow,
  type SetLogRow,
  type StartWeightRow,
  type PlannedExerciseRow,
  type PlannedSessionRow,
  type UserPlanRow,
  type UserRows,
  type WeightGoalRow,
} from './types';
import {
  applyHealthDataRevocation,
  applyWriteOps,
  cacheableRows,
  isDirectOp,
  isSensitiveOp,
  type ApplyContext,
  type PlanRows,
  type WriteOp,
} from './write-ops';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';
import { workoutsFromDbRows } from './workout-library';
import { supplementsFromDbRows } from './supplement-library';

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

/** Meldungen des Verschiebe-Triggers, die eine REGEL nennen (nicht „Stand geändert“). */
const MOVE_RULE_MESSAGE =
  /^(Diese Woche ist vorbei|Einheiten der Erholungswoche|Verschieben nur ab heute|Bitte zwei verschiedene)/;

/**
 * Fehler beim Verschieben/Tauschen (Kalender, Wächter A1a S2) – nie ein falscher Regel-Text für andere Ursachen:
 * - Netz → `network`, abgelaufene Sitzung → `not_signed_in`,
 * - Zeitlimit/Sperrkonflikt/Serialisierung (57xxx, 40P01, 40001), Server 5xx, Drosselung → `temporary`,
 * - swap_planned_sessions: `hint` move_rules → Regel; not_found/plan_changed → Stand geändert,
 * - Trigger (ohne hint): Regel-Meldungen → Regel; alles andere (23514 „nur geplante“, 23505 Tag belegt, Einheit fehlt,
 *   RLS) → Stand geändert.
 */
export function toMoveError(error: unknown, sensitive: boolean): BackendError {
  if (error instanceof BackendError) return error;
  const e = (error ?? {}) as ErrorLike;
  const db = e.code ?? '';
  // Datenbank-Codes zuerst: 57014 meldet „…statement timeout“ und ist kein Netzfehler (wie classifyLogError).
  const code = /^5[37]/.test(db) ? 'unknown' : classifySupabaseError(error, sensitive);
  if (code === 'network' || code === 'not_signed_in') {
    return new BackendError(code, { sensitive, cause: error });
  }
  if (
    code === 'rate_limited' ||
    /^57/.test(db) ||
    /^53/.test(db) ||
    db === '40P01' ||
    db === '40001' ||
    (e.status !== undefined && e.status >= 500)
  ) {
    return new BackendError('temporary', { sensitive, cause: error });
  }
  const hint = e.hint ?? '';
  const rules = hint === 'move_rules' || (hint === '' && MOVE_RULE_MESSAGE.test(e.message ?? ''));
  return new BackendError('plan_rejected', {
    sensitive,
    cause: error,
    moveReason: rules ? 'move_rules' : 'plan_changed',
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

/** Einheiten je nachgeladener Verlaufs-Seite. */
const OLDER_LOGS_PAGE = HISTORY_PAGE_SIZE;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Update ohne betroffene Zeile (Einheit gibt es nicht mehr, z. B. Plan ersetzt) – vom Server abgelehnt. */
const PLAN_ROW_MISSING = { code: 'plan_row_missing', message: 'Einheit nicht gefunden.' };
/** Abhaken eines Eintrags, den es nicht mehr gibt (Liste ersetzt) – vom Server abgelehnt. */
const SHOPPING_ITEM_MISSING = { code: 'shopping_item_missing', message: 'Eintrag nicht gefunden.' };
/** nutrition_setup ohne Zeile in nutrition_prefs (Schritt „nutrition“ fehlt) – abgelehnt statt ins Leere. */
const NUTRITION_PREFS_MISSING = {
  code: 'nutrition_prefs_missing',
  message: 'Ernährungsangaben fehlen.',
};

/**
 * nutrition_prefs aus der Datenbank → Zeilen der App (Etappe N7): die Spalten des Schritts nutrition_setup getrennt
 * (wie im Testmodus `nutritionSetup`). Beantwortet ist der Schritt erst mit Alltag UND Trainingszeit; Werte an der
 * Grenze mit Zod geprüft (nutritionSetupColumnsSchema) – ungültig = Schritt offen. Rein, getestet.
 */
export function nutritionPrefsFromDb(
  row: Tables<'nutrition_prefs'> | null,
): Pick<UserRows, 'nutritionPrefs' | 'nutritionSetup'> {
  if (row === null) return { nutritionPrefs: null, nutritionSetup: null };
  const prefs: Record<string, unknown> = { ...row };
  for (const column of [...NUTRITION_SETUP_DB_COLUMNS, 'created_at', 'updated_at']) {
    delete prefs[column];
  }
  const setup = nutritionSetupColumnsSchema.safeParse({
    activity_level: row.activity_level,
    training_time: row.training_time,
    mealprep_slots: row.mealprep_slots,
    show_energy_numbers: row.show_energy_numbers,
  });
  return {
    nutritionPrefs: prefs as NutritionPrefsRow,
    nutritionSetup: setup.success ? { user_id: row.user_id, ...setup.data } : null,
  };
}

/**
 * Tabelle bzw. Datenbank-Funktion gibt es (noch) nicht (Wächter N7 S1): Ein App-Stand kann vor den Migrationen live
 * sein (PR-Vorschau, Deploy vor `db-migrate`). PostgREST meldet PGRST205 (Tabelle) bzw. PGRST202 (Funktion), Postgres
 * 42P01 bzw. 42883. Dann wird nicht die ganze Anmeldung abgebrochen, sondern sauber zurückgefallen. Rein, getestet.
 */
export function isMissingRelation(error: unknown): boolean {
  const code = (error as ErrorLike | null)?.code;
  return code === 'PGRST205' || code === '42P01';
}

export function isMissingFunction(error: unknown): boolean {
  const code = (error as ErrorLike | null)?.code;
  return code === 'PGRST202' || code === '42883';
}

/** Ergebnis einer Abfrage auf eine Tabelle, die es vor `db-migrate` noch nicht gibt: dann leer statt Fehler. */
function emptyIfMissing<T>(result: { data: T[] | null; error: unknown }): {
  data: T[] | null;
  error: unknown;
} {
  return result.error !== null && isMissingRelation(result.error)
    ? { data: [], error: null }
    : result;
}

/**
 * Feste Fehlertexte der Wettkampf-Funktionen (20261016140200_competition_rpcs.sql) → Grund (gleiche Gründe wie der
 * Testmodus, packages/core competition-rules.ts). Die Meldungen enthalten keine Werte.
 */
const COMPETITION_MESSAGES: readonly [RegExp, CompetitionErrorReason][] = [
  [/^Es gibt schon einen geplanten Wettkampf/, 'competition_exists'],
  [/^(Der Renntag liegt außerhalb|Bis zum Renntag ist zu wenig Zeit)/, 'race_date'],
  [/^Die Referenzzeit ist zu alt/, 'reference_date'],
  [/^Ein Wettkampfplan braucht den Gesundheits-Check/, 'health_check_required'],
  [
    /^(In der Schwangerschaft|Für diese Distanz|Eine Zielzeit ist hier nicht möglich)/,
    'not_allowed',
  ],
  [/^Wettkampf nicht gefunden/, 'not_found'],
  [/^(Nur geplante Wettkämpfe|Ein abgesagter Wettkampf)/, 'not_planned'],
  [/^(Der Wettkampf liegt noch in der Zukunft|Dieser Eintrag passt nicht)/, 'result_rejected'],
];

/** Fehler von save/cancel/complete/delete_competition: Netz → „online_only“ (Anlegen nur online), sonst Grund. */
export function toCompetitionError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const e = (error ?? {}) as ErrorLike;
  // Datenbank-Codes zuerst: 57014 meldet „…statement timeout“ und ist kein Netzfehler (wie toMoveError).
  if (/^5[37]/.test(e.code ?? '') || (e.status !== undefined && e.status >= 500)) {
    return new BackendError('temporary', { cause: error });
  }
  const code = classifySupabaseError(error);
  if (code === 'network') return new BackendError('online_only', { cause: error });
  if (code === 'not_signed_in' || code === 'rate_limited') {
    return new BackendError(code, { cause: error });
  }
  const message = e.message ?? '';
  const reason = COMPETITION_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? 'invalid';
  return new BackendError('competition_rejected', { cause: error, competitionReason: reason });
}

/** Fehler eines Schreibvorgangs, der nur online geht (ohne Netz → „online_only“, sonst fester Code). */
function onlineOnlyError(error: unknown): BackendError {
  const code = classifySupabaseError(error);
  return new BackendError(code === 'network' ? 'online_only' : code, { cause: error });
}

/**
 * Ereignis zu einem vom Server abgelehnten, verworfenen Vorgang der Warteschlange (oder keines):
 * - Verschiebung abgelehnt (Einheit ersetzt, Tag belegt …) → Plan neu laden und melden.
 * - Ziel abgelehnt mit 23514 (CHECK, z. B. Paar-CHECK mit einem Nebenziel, das ein älterer App-Stand stehen ließ –
 *   Wächter Z3 N3) → verständliche Meldung „Bitte App aktualisieren“ statt stillem Verwerfen.
 * Rein, getestet.
 */
export function droppedOpEvent(op: WriteOp, error: unknown): BackendEvent | null {
  if (op.kind === 'update_planned_session') return { kind: 'plan_change_dropped' };
  if (op.kind === 'upsert_goals' && (error as ErrorLike | null)?.code === '23514') {
    return { kind: 'goals_rejected' };
  }
  return null;
}

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
    // Seit Etappe Z4 ohne Rückfall bei fehlender Spalte (Wächter Z3 N2): Ein zweiter Versuch ohne secondary_goal_type
    // ließe ein vorhandenes Nebenziel in der Datenbank stehen, während die App „kein Nebenziel“ zeigt.
    case 'upsert_goals':
      check(await client.from('goals').upsert(op.row, { onConflict: 'user_id' }));
      return;
    // Wunschgewicht (Etappe Z3): RLS verlangt die Einwilligung, der Trigger das Abnehmziel (Wächter S13).
    case 'upsert_weight_goal':
      check(await client.from('weight_goals').upsert(op.row, { onConflict: 'user_id' }));
      return;
    case 'delete_weight_goal': {
      const result = await client.from('weight_goals').delete().eq('user_id', userId);
      // Vor `db-migrate` gibt es die Tabelle nicht – dann gibt es auch nichts zu löschen.
      if (!(result.error && isMissingRelation(result.error))) check(result);
      return;
    }
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
    // Etappe E2: Anordnung über save_app_layout (prüft Form und Regeln erneut).
    case 'save_app_layout':
      check(
        await client.rpc('save_app_layout', {
          // Schrittziel nur, wenn gesetzt – so klappt das Speichern der Anordnung auch vor `db-migrate`.
          p_layout: toJson({
            dashboard_tiles: op.row.dashboard_tiles,
            tab_bar: op.row.tab_bar,
            ...(op.row.step_goal === undefined || op.row.step_goal === null
              ? {}
              : { step_goal: op.row.step_goal }),
          }),
        }),
      );
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
    // Schritt nutrition_setup (Etappe N7): Spalten an nutrition_prefs. Die Zeile legt der Schritt „nutrition“ vorher an;
    // fehlt sie, wird nichts ins Leere geschrieben (abgelehnt mit NUTRITION_PREFS_MISSING).
    case 'upsert_nutrition_setup': {
      const result = await client
        .from('nutrition_prefs')
        .update({
          activity_level: op.row.activity_level,
          training_time: op.row.training_time,
          mealprep_slots: op.row.mealprep_slots,
          show_energy_numbers: op.row.show_energy_numbers,
        })
        .eq('user_id', userId)
        .select('user_id');
      check(result);
      if (!result.data || result.data.length === 0) {
        throw NUTRITION_PREFS_MISSING;
      }
      return;
    }
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
    // Tauschen (Etappe A1a): Server-Funktion prüft dieselben Regeln wie der Trigger für beide Einheiten.
    case 'swap_planned_sessions':
      check(
        await client.rpc('swap_planned_sessions', {
          p_a: op.sessionId,
          p_b: op.otherSessionId,
          p_a_on: op.sessionOn,
          p_b_on: op.otherSessionOn,
        }),
      );
      return;
    // Etappe N7 Teil 2: Abhaken direkt über die Spalte `checked` (Update-Recht nur auf diese Spalte, RLS).
    case 'set_shopping_item_checked': {
      const result = await client
        .from('shopping_list_items')
        .update({ checked: op.checked })
        .eq('list_id', op.listId)
        .eq('item_key', op.itemKey)
        .eq('user_id', userId)
        .select('item_key');
      check(result);
      if (!result.data || result.data.length === 0) throw SHOPPING_ITEM_MISSING;
      return;
    }
    // Kochtag-Start (Update-Recht nur auf die Merker und diese Spalte; CHECK: nur mit Meal-Prep-Plan).
    case 'set_cook_day_start': {
      const result = await client
        .from('meal_plans')
        .update({ cook_day_started_at: op.startedAt })
        .eq('id', op.planId)
        .eq('user_id', userId)
        .select('id');
      check(result);
      if (!result.data || result.data.length === 0) throw PLAN_ROW_MISSING;
      return;
    }
    // Favoriten direkt per PostgREST (RLS: eigene Zeilen; Schnell-Favoriten nur mit Einwilligung; Titel per Trigger).
    case 'upsert_food_log_favorite': {
      // created_at setzt die Datenbank selbst.
      const row: Partial<typeof op.row> = { ...op.row };
      delete row.created_at;
      check(
        await client
          .from('food_log_favorites')
          .upsert({ ...row, user_id: userId } as typeof op.row, { onConflict: 'user_id,fav_key' }),
      );
      return;
    }
    case 'delete_food_log_favorite':
      check(
        await client
          .from('food_log_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('fav_key', op.favKey),
      );
      return;
  }
}

function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

/** Einwilligung fehlt: 42501 mit „Einwilligung“ in der festen Meldung der Funktion (ohne Werte). */
function isConsentError(error: unknown): boolean {
  const e = (error ?? {}) as ErrorLike;
  return e.code === '42501' && /einwilligung/i.test(e.message ?? '');
}

/**
 * Fehler beim Speichern von Essensplan bzw. Einkaufsliste (Etappe N7 Teil 2) – immer „sensibel“ (Gesundheitsbezug
 * möglich), nie mit Werten: Einwilligung fehlt → `consent_required` (Wächter N7 H3: die App zeigt dazu den klaren
 * Zustand), Netz/Sitzung wie sonst, vorübergehend → `temporary`, alles andere (Form, Rezept nicht freigegeben, Filter,
 * G-W3 Grundumsatz) → `plan_rejected`.
 */
export function toMealPlanSaveError(error: unknown): BackendError {
  if (error instanceof BackendError) return error;
  const e = (error ?? {}) as ErrorLike;
  const db = e.code ?? '';
  if (isConsentError(error)) {
    return new BackendError('consent_required', { sensitive: true, cause: error });
  }
  const code = /^5[37]/.test(db) ? 'unknown' : classifySupabaseError(error, true);
  if (code === 'network' || code === 'not_signed_in') {
    return new BackendError(code, { sensitive: true, cause: error });
  }
  if (
    code === 'rate_limited' ||
    /^5[37]/.test(db) ||
    db === '40P01' ||
    db === '40001' ||
    (e.status !== undefined && e.status >= 500)
  ) {
    return new BackendError('temporary', { sensitive: true, cause: error });
  }
  return new BackendError('plan_rejected', { sensitive: true, cause: error });
}

/** Ergebnis eines gesendeten Ernährungs-Vorgangs (Tagebuch, eigene Gerichte) aus einem Fehler – ohne Werte. */
export function nutritionSendErrorResult(error: unknown): NutritionSendResult {
  if (isConsentError(error)) return { kind: 'rejected', reason: 'consent_required' };
  const kind = classifyLogError(error);
  if (kind === 'retry') return { kind: 'retry' };
  if (kind === 'transient') return { kind: 'transient' };
  return { kind: 'rejected', reason: 'invalid' };
}

/** Grund einer Ablehnung → fester Fehler-Code für den Bildschirm (Tagebuch bzw. eigene Gerichte). */
function foodLogRejectCode(reason: NutritionRejectReason): BackendErrorCode {
  if (reason === 'consent_required') return 'consent_required';
  if (reason === 'out_of_range') return 'food_log_out_of_range';
  if (reason === 'day_full') return 'food_log_day_full';
  if (reason === 'product_unavailable') return 'food_log_product_unavailable';
  if (reason === 'product_limit') return 'food_log_product_limit';
  return 'food_log_rejected';
}

function customMealRejectCode(reason: NutritionRejectReason): BackendErrorCode {
  if (reason === 'consent_required') return 'consent_required';
  if (reason === 'limit') return 'custom_meal_limit';
  return 'custom_meal_rejected';
}

function userProductRejectCode(reason: NutritionRejectReason): BackendErrorCode {
  if (reason === 'consent_required') return 'consent_required';
  if (reason === 'limit') return 'user_product_limit';
  return 'user_product_rejected';
}

/** Spalten von meal_plan_items, die die App liest (= Felder der Payload). */
const MEAL_PLAN_ITEM_COLUMNS =
  'plan_id, date, slot, role, recipe_id, recipe_version, title_de, factor, kcal, protein_g, carbs_g, fat_g, ' +
  'substitutions, omitted_optional, ingredient_swaps, is_fill, prep_kind, cook_date, storage, meal_prep_plan_id, ' +
  'day_status';

/** Leerer Bestand (Tabellen fehlen noch bzw. offline ohne Zwischenspeicher). */
const EMPTY_NUTRITION_CONTENT: DbNutritionContent = {
  foods: [],
  recipes: [],
  ingredient_substitutions: [],
  food_package_sizes: [],
  meal_prep_plans: [],
  guides: [],
};

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
  /**
   * Etappe N7 Teil 2: geschützte Speicher für die Ernährungs-Zeilen (vollständige Essenspläne, Listen, Tagebuch, eigene
   * Gerichte, Favoriten) und die Ernährungs-Warteschlange. Standard (Tests): nur Arbeitsspeicher.
   */
  nutritionCacheStore?: ProtectedStore;
  nutritionQueueStore?: ProtectedStore;
  /**
   * Etappe E3: Adresse von apps/web (EXPO_PUBLIC_WEB_URL) für POST /api/ernaehrung/foto. null/fehlt = „Per Foto“ nicht
   * verfügbar (still, wie Premium aus).
   */
  webUrl?: string | null;
  /** Nur Tests: Ersatz für fetch (Foto-Route). */
  fetchFn?: typeof fetch;
  /**
   * Live-Anpassung (Phase 4b, 8.2 Schritt 4) – nur VORBEREITET: erst mit den Etappen B und C (Datenbank, Route) einschalten.
   * Bis dahin fehlt die Option, im Supabase-Modus wird nichts gerechnet und nichts aufgerufen. Ohne `webUrl` nie ein
   * Aufruf. Der Schalter „Premium simulieren“ gehört nur zum Testmodus (Wächter K2) und hat hier kein Feld.
   */
  liveAdjustServer?: boolean;
  /**
   * Etappe E4: geschützte Speicher für die Strecken-Warteschlange (samt zuletzt geladener Liste) und die laufende
   * Aufzeichnung (Standortdaten). Standard (Tests): nur Arbeitsspeicher.
   */
  routeQueueStore?: ProtectedStore;
  routeRecordingStore?: ProtectedStore;
  /** Phase 8: geschützter Speicher der Smartwatch-Abgleiche (samt zuletzt geladenem Stand). Standard: Arbeitsspeicher. */
  wearableQueueStore?: ProtectedStore;
}

/**
 * Antwort von import_wearable_batch einordnen (Phase 8): Netz/Anmeldung/Server vorübergehend → später erneut;
 * Einwilligung fehlt → verwerfen; sonst (Aufbau ungültig) verwerfen. Meldungen der Datenbank enthalten keine Werte.
 */
export function classifyWearableError(error: unknown): 'retry' | 'consent' | 'reject' {
  if (isConsentError(error)) return 'consent';
  return classifyRouteError(error) === 'retry' ? 'retry' : 'reject';
}

/** Fehler der übrigen Smartwatch-Aufrufe: Netz → „nur online“, Einwilligung, sonst „abgelehnt“. */
function wearableError(error: unknown): BackendError {
  if (isConsentError(error)) return new BackendError('consent_required', { sensitive: true });
  const code = classifySupabaseError(error, true);
  if (code === 'network') return new BackendError('online_only', { sensitive: true, cause: error });
  if (code === 'not_signed_in') return new BackendError(code, { cause: error });
  return new BackendError('wearable_rejected', { sensitive: true, cause: error });
}

/** Inhalt des geschützten Tagebuch-Zwischenspeichers (4.6). */
interface LogCache {
  userId: string;
  logs: LogRows;
}

const CONSENT_TYPES_WITH_TEXT = [
  'terms',
  'privacy',
  'health_data',
  'ai_food_photo',
  'wearable_data',
] as const;

/** Höchstens so viele Strecken laden (neueste zuerst) – „Meine Läufe“ (Etappe E4). */
export const TRACKED_ROUTES_LOAD_LIMIT = 1000;

/**
 * Antwort von save_tracked_route einordnen (Etappe E4): Netz/Anmeldung/Server vorübergehend → später erneut;
 * Verknüpfung passt nicht (Eintrag abgelehnt oder gelöscht, Favorit weg) → ohne Verweise erneut; sonst abgelehnt.
 * Meldungen der Datenbank enthalten keine Werte.
 */
export function classifyRouteError(error: unknown): RouteSendResult {
  const e = (error ?? {}) as ErrorLike;
  const db = e.code ?? '';
  const code = /^5[37]/.test(db) ? 'temporary' : classifySupabaseError(error);
  if (
    code === 'network' ||
    code === 'not_signed_in' ||
    code === 'rate_limited' ||
    code === 'temporary' ||
    db === '40P01' ||
    db === '40001' ||
    (e.status !== undefined && e.status >= 500)
  ) {
    return 'retry';
  }
  if (
    /^(Dieser Eintrag passt nicht zur Strecke|Die Favoriten-Strecke wurde nicht gefunden)/.test(
      e.message ?? '',
    )
  ) {
    return 'unlink';
  }
  return 'reject';
}

/** Fehler beim Ändern/Löschen einer Strecke: Netz → „nur online“, sonst „abgelehnt“. */
function routeError(error: unknown): BackendError {
  const code = classifySupabaseError(error);
  if (code === 'network') return new BackendError('online_only', { cause: error });
  if (code === 'not_signed_in') return new BackendError(code, { cause: error });
  return new BackendError('route_rejected', { cause: error });
}

export function createSupabaseBackend(options: SupabaseBackendOptions): Backend {
  const { client, store } = options;
  const protectedStore = options.protectedStore ?? createMemoryProtectedStore();
  const logCacheStore = options.logCacheStore ?? createMemoryProtectedStore();
  const drafts = new DraftStore(options.workoutDraftStore ?? createMemoryProtectedStore());
  const nutritionCacheStore = options.nutritionCacheStore ?? createMemoryProtectedStore();
  const recordingStore = options.routeRecordingStore ?? createMemoryProtectedStore();
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
    onDropped: (op, error) => {
      // Nur die Art des Vorgangs – nie Inhalte (keine Nutzerdaten in Logs).
      console.warn(`Änderung verworfen (${op.kind}): vom Server abgelehnt.`);
      const event = droppedOpEvent(op, error);
      if (event) emit(event);
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
      // Workout-Timer (docs/PLAN-WORKOUTS.md): Herkunft „workout“ nach dem Speichern setzen (save_session_log nimmt
      // neue Einträge nur mit „manual“ an). Netz/Sitzung → werfen: Die Warteschlange versucht es später erneut (das
      // erneute save_session_log mit derselben write_id ist idempotent). Andere Fehler: Eintrag bleibt „manual“
      // (gespeichert ist er) – nie als abgelehnter Entwurf.
      if (entry.draft.workoutId !== undefined && response.result === 'ok') {
        const id = response.id ?? entry.payload.id;
        const { error, status } = await client.rpc('mark_session_log_workout', { p_log_id: id });
        if (error) {
          if (classifyLogError({ ...error, status }) === 'retry') throw { ...error, status };
          console.warn('Workout-Eintrag gespeichert, Herkunft „workout“ nicht gesetzt.');
        }
      }
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
   * Strecken-Warteschlange (Etappe E4): verschlüsselt, gesendet NACH dem verknüpften Tagebuch-Eintrag (Plan S1).
   * Ältere Datenbank ohne Spalte elevation_profile (App vor db-migrate): einmal ohne Höhenprofil senden.
   */
  const routeQueue = new RouteQueue({
    store: options.routeQueueStore ?? createMemoryProtectedStore(),
    send: (payload) => sendTrackedRoute(payload),
    isLogPending: (logId) => logQueue.snapshot().some((e) => e.payload.id === logId),
    currentUserId: () => currentUserId,
  });

  /**
   * Smartwatch-Warteschlange (Phase 8): verschlüsselt, gesendet NACH den Tagebuch-Einträgen, auf die ein Abgleich
   * verweist (Zusammenführen/Doppel-Hinweis).
   */
  const wearableQueue = new WearableQueue({
    store: options.wearableQueueStore ?? createMemoryProtectedStore(),
    send: (batch) => sendWearableBatch(batch),
    sendRoute: (route) => sendWearableRoute(route, false),
    isLogPending: (logId) => logQueue.snapshot().some((e) => e.payload.id === logId),
    currentUserId: () => currentUserId,
  });

  async function sendWearableBatch(batch: WearableImportBatch): Promise<WearableSendResult> {
    try {
      const { data, error, status } = await client.rpc('import_wearable_batch', {
        p_batch: toJson(batch),
      });
      if (error) {
        const kind = classifyWearableError({ ...error, status });
        return { kind };
      }
      const parsed = wearableImportResultSchema.safeParse(data);
      return parsed.success ? { kind: 'ok', result: parsed.data } : { kind: 'reject' };
    } catch (error) {
      return { kind: classifyWearableError(error) };
    }
  }

  /**
   * Route der Uhr senden (save_wearable_route, 23.10.2026). Vor db-migrate fehlt die Funktion – dann verwerfen
   * (die Route kommt beim nächsten Abgleich im Zeitraum wieder).
   */
  async function sendWearableRoute(
    route: WearableRoutePayload,
    explicit: boolean,
  ): Promise<WearableRouteSendResult> {
    try {
      const { error, status } = await client.rpc('save_wearable_route', {
        p_route: toJson(route),
        p_explicit: explicit,
      });
      if (!error) return { kind: 'ok' };
      return { kind: classifyWearableError({ ...error, status }) };
    } catch (error) {
      return { kind: classifyWearableError(error) };
    }
  }

  async function sendTrackedRoute(payload: TrackedRoutePayload): Promise<RouteSendResult> {
    const call = async (body: TrackedRoutePayload) => {
      const { error, status } = await client.rpc('save_tracked_route', { p_route: toJson(body) });
      return error ? { ...error, status } : null;
    };
    try {
      let error = await call(payload);
      if (
        error &&
        payload.elevation_profile !== undefined &&
        /Unbekanntes Feld/.test(error.message ?? '')
      ) {
        const older: TrackedRoutePayload = { ...payload };
        delete older.elevation_profile;
        error = await call(older);
      }
      if (!error) return 'ok';
      return classifyRouteError(error);
    } catch (error) {
      return classifyRouteError(error);
    }
  }

  /**
   * Ernährungs-Warteschlange (Etappe N7 Teil 2): Tagebuch-Einträge und eigene Gerichte sind (vorsorglich)
   * Gesundheitsdaten – deshalb NICHT die normale SyncQueue, sondern verschlüsselt im geschützten Speicher
   * `nutritionQueue` (Browser: sessionStorage). Offline möglich; abgelehnte Fassungen bleiben lokal mit Hinweis
   * (Gründer-Frage G3 aus E1), nie still verwerfen. Meldungen nur mit der Art, nie mit Inhalten.
   */
  const nutritionQueue = new NutritionQueue({
    store: options.nutritionQueueStore ?? createMemoryProtectedStore(),
    send: (op) => sendNutritionOp(op),
    currentUserId: () => currentUserId,
  });

  async function sendNutritionOp(op: NutritionQueueOp): Promise<NutritionSendResult> {
    switch (op.kind) {
      case 'food_log_save': {
        const payload = foodLogPayloadEntrySchema.safeParse({
          ...op.entry,
          write_id: op.writeId,
          base_revision: op.baseRevision,
        });
        if (!payload.success) return { kind: 'rejected', reason: 'invalid' };
        const { data, error, status } = await client.rpc('save_food_log_entries', {
          p_entries: toJson([payload.data]),
        });
        if (error) return nutritionSendErrorResult({ ...error, status });
        const parsed = foodLogSaveResponseSchema.safeParse(data);
        const first = parsed.success ? parsed.data[0] : undefined;
        if (first === undefined) return { kind: 'transient' };
        if (first.result === 'saved') return { kind: 'done' };
        if (first.result === 'conflict') return { kind: 'rejected', reason: 'conflict' };
        return {
          kind: 'rejected',
          reason:
            first.code === 'out_of_range'
              ? 'out_of_range'
              : first.code === 'day_full'
                ? 'day_full'
                : first.code === 'product_unavailable'
                  ? 'product_unavailable'
                  : first.code === 'product_limit'
                    ? 'product_limit'
                    : 'invalid',
        };
      }
      case 'food_log_delete': {
        const { data, error, status } = await client.rpc('delete_food_log_entry', {
          p_id: op.id,
          p_base_revision: op.baseRevision,
        });
        if (error) return nutritionSendErrorResult({ ...error, status });
        const result = (data as { result?: unknown } | null)?.result;
        if (result === 'ok') return { kind: 'done' };
        if (result === 'conflict') return { kind: 'rejected', reason: 'conflict' };
        return { kind: 'transient' };
      }
      case 'custom_meal_save': {
        const payload = customMealPayloadSchema.safeParse({
          ...op.meal,
          write_id: op.writeId,
          base_revision: op.baseRevision,
        });
        if (!payload.success) return { kind: 'rejected', reason: 'invalid' };
        const { data, error, status } = await client.rpc('save_custom_meal', {
          p_meal: toJson(payload.data),
        });
        if (error) return nutritionSendErrorResult({ ...error, status });
        const parsed = customMealSaveResultSchema.safeParse(data);
        if (!parsed.success) return { kind: 'transient' };
        if (parsed.data.result === 'saved') return { kind: 'done' };
        if (parsed.data.result === 'conflict') return { kind: 'rejected', reason: 'conflict' };
        return { kind: 'rejected', reason: parsed.data.code === 'limit' ? 'limit' : 'invalid' };
      }
      case 'custom_meal_delete': {
        const { error, status } = await client.rpc('delete_custom_meal', { p_id: op.id });
        if (error) return nutritionSendErrorResult({ ...error, status });
        return { kind: 'done' };
      }
      case 'user_product_save': {
        const payload = userFoodProductPayloadSchema.safeParse({
          ...op.product,
          write_id: op.writeId,
          base_revision: op.baseRevision,
        });
        if (!payload.success) return { kind: 'rejected', reason: 'invalid' };
        const { data, error, status } = await client.rpc('save_user_food_product', {
          p_product: toJson(payload.data),
        });
        if (error) return nutritionSendErrorResult({ ...error, status });
        const parsed = userFoodProductSaveResultSchema.safeParse(data);
        if (!parsed.success) return { kind: 'transient' };
        if (parsed.data.result === 'saved') return { kind: 'done' };
        if (parsed.data.result === 'conflict') return { kind: 'rejected', reason: 'conflict' };
        return { kind: 'rejected', reason: parsed.data.code === 'limit' ? 'limit' : 'invalid' };
      }
      case 'user_product_delete': {
        const { error, status } = await client.rpc('delete_user_food_product', { p_id: op.id });
        if (error) return nutritionSendErrorResult({ ...error, status });
        return { kind: 'done' };
      }
      // Häkchen einer sensiblen Einkaufsliste (offline eingereiht): über den vorhandenen Schreibweg (Spalte `checked`,
      // RLS). Liste bzw. Eintrag verschwunden → still verworfen; endgültige Ablehnungen ebenso (ein Häkchen ist kein
      // Datensatz, den die Person zurückholen müsste) – nur Netz/Server vorübergehend → später erneut.
      case 'shopping_check': {
        const found = await client
          .from('shopping_lists')
          .select('id')
          .eq('week_start', op.weekStart)
          .maybeSingle();
        if (found.error) {
          const result = nutritionSendErrorResult({ ...found.error, status: found.status });
          return result.kind === 'rejected' ? { kind: 'done' } : result;
        }
        if (found.data === null) return { kind: 'done' };
        const updated = await client
          .from('shopping_list_items')
          .update({ checked: op.checked })
          .eq('list_id', found.data.id)
          .eq('item_key', op.itemKey)
          .select('item_key');
        if (updated.error) {
          const result = nutritionSendErrorResult({ ...updated.error, status: updated.status });
          return result.kind === 'rejected' ? { kind: 'done' } : result;
        }
        return { kind: 'done' };
      }
    }
  }

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
    // Ernährungs-Warteschlange (N7 Teil 2): Tagebuch und eigene Gerichte.
    const nutritionDone = (await nutritionQueue.flush().catch(() => 'later' as const)) === 'done';
    // Strecken (Etappe E4): erst nach den Tagebuch-Einträgen (Verknüpfung, Plan S1).
    await routeQueue.flush().catch(() => 'later' as const);
    // Smartwatch (Phase 8): ebenfalls nach den Tagebuch-Einträgen (Zusammenführen verweist auf sie).
    await wearableQueue.flush().catch(() => undefined);
    try {
      const { error } = await client.rpc('close_missed_sessions');
      if (error && isTransientError(error)) return false;
    } catch {
      // Nur Statuspflege – beim nächsten Laden erneut.
    }
    // 8.2 Schritt 4: Live-Anpassung anstoßen (still, nie blockierend; danach lädt loadRows neu = Schritt 5).
    if (options.liveAdjustServer === true) {
      await requestLiveAdjustment({
        client,
        webUrl: options.webUrl ?? null,
        fetchFn: options.fetchFn ?? ((url, init) => fetch(url, init)),
      });
    }
    return logResult === 'done' && nutritionDone;
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
    // Ernährungs-Zeilen (N7 Teil 2) nur im eigenen geschützten Speicher – samt vollständiger Essenspläne (damit die
    // Zeilen der Datenbank beim nächsten Laden wieder dem Plan der Engine zugeordnet werden, G-N7-1).
    await writeNutritionCache(
      nutritionCacheStore,
      userId,
      nutritionRowsOf(displayRows),
      options.now(),
    );
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

  /** Ab hier lädt fetchLogs() das Tagebuch vollständig (4.6). */
  function logWindowStart(): string {
    return addDays(today(), -LOG_CACHE_WEEKS * 7);
  }

  /** Übungen, Sätze und Ausdauer zu Einträgen (RLS: nur eigene Zeilen; `in`-Filter in Paketen). */
  async function fetchLogDetails(sessionLogs: SessionLogRow[]): Promise<LogRows> {
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
    return { sessionLogs, exerciseLogs, setLogs, cardioLogs };
  }

  /**
   * Ältere Einträge vor `before` (Verlauf, Etappe D): die neuesten OLDER_LOGS_PAGE Einheiten, dazu alle weiteren vom
   * ältesten Tag der Seite (sonst gingen beim Weiterblättern mit `performed_on < before` Einträge desselben Tages
   * verloren). Nur online; nie in den Zwischenspeicher.
   */
  async function fetchOlderLogs(userId: string, before: string): Promise<OlderLogsPage> {
    const page = await client
      .from('session_logs')
      .select('*')
      .eq('user_id', userId)
      .lt('performed_on', before)
      .order('performed_on', { ascending: false })
      .limit(OLDER_LOGS_PAGE);
    if (page.error) throw page.error;
    const sessionLogs = (page.data ?? []) as SessionLogRow[];
    let nextBefore: string | null = null;
    const oldest = sessionLogs.at(-1)?.performed_on;
    if (sessionLogs.length >= OLDER_LOGS_PAGE && oldest !== undefined) {
      const sameDay = await client
        .from('session_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('performed_on', oldest);
      if (sameDay.error) throw sameDay.error;
      const known = new Set(sessionLogs.map((l) => l.id));
      sessionLogs.push(
        ...((sameDay.data ?? []) as SessionLogRow[]).filter((l) => !known.has(l.id)),
      );
      nextBefore = oldest;
    }
    return { logs: await fetchLogDetails(sessionLogs), nextBefore };
  }

  /**
   * Tagebuch laden (4.6): die letzten LOG_CACHE_WEEKS Wochen plus recent_exercise_logs() (Grundlage der
   * Progression, auch für ältere Einträge); RLS: nur eigene Zeilen.
   */
  async function fetchLogs(userId: string): Promise<LogRows> {
    const sessions = await client
      .from('session_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('performed_on', logWindowStart())
      .order('performed_on');
    if (sessions.error) throw sessions.error;
    const { sessionLogs, exerciseLogs, setLogs, cardioLogs } = await fetchLogDetails(
      (sessions.data ?? []) as SessionLogRow[],
    );
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

  /**
   * Körperdaten (Gesundheitsdaten, nur im Arbeitsspeicher): der neueste Eintrag und je Feld der neueste Eintrag mit
   * Größe, Gewicht bzw. Körperfett (Etappe N7 Teil 2) – genau die Werte, mit denen die Engine rechnet
   * (`latestBodyValues` je Feld) und die `save_meal_plan` für die Plausibilität der Tageskalorien liest (G-W3). Sonst
   * fehlte z. B. eine ältere Größe, wenn der neueste Eintrag nur das Gewicht hat. Aufsteigend nach Datum (bei gleichem
   * Datum gewinnt in der Engine die spätere Zeile).
   */
  async function fetchBodyMetrics(
    userId: string,
  ): Promise<{ data: Tables<'body_metrics'>[] | null; error: unknown }> {
    const newest = (column?: 'height_cm' | 'weight_kg' | 'body_fat_pct') => {
      const query = client.from('body_metrics').select('*').eq('user_id', userId);
      return (column === undefined ? query : query.not(column, 'is', null))
        .order('measured_on', { ascending: false })
        .limit(1);
    };
    const results = await Promise.all([
      newest(),
      newest('height_cm'),
      newest('weight_kg'),
      newest('body_fat_pct'),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) return { data: null, error: failed.error };
    const byDate = new Map<string, Tables<'body_metrics'>>();
    for (const result of results) {
      for (const row of result.data ?? []) byDate.set(row.measured_on, row);
    }
    return {
      data: [...byDate.values()].sort((a, b) => a.measured_on.localeCompare(b.measured_on)),
      error: null,
    };
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
    await nutritionQueue.load();
    const rows = withPendingNutrition(
      applyWriteOps(
        serverRows,
        queue.snapshot().map((entry) => entry.op),
        applyContext(),
      ),
      userId,
    );
    await writeCache(userId, rows, 'server');
    return withPendingLogs(rows, userId);
  }

  /** Noch nicht übertragene Tagebuch-Einträge/eigene Gerichte über den Stand legen (nur eigenes Konto, R5). */
  function withPendingNutrition(rows: UserRows, userId: string): UserRows {
    const owner = nutritionQueue.ownerUserId();
    if (owner !== null && owner !== userId) return rows;
    return applyNutritionQueue(rows, nutritionQueue.snapshot(), { userId, now: options.now() });
  }

  /** Vollständige Essenspläne aus dem geschützten Speicher (zum Abgleich mit den Zeilen der Datenbank). */
  async function cachedFullPlans(userId: string): Promise<Map<string, MealPlanWeek>> {
    const cached = await readNutritionCache(
      nutritionCacheStore,
      userId,
      options.now(),
      HEALTH_PLAN_CACHE_MAX_AGE_DAYS,
    );
    return cached === null ? new Map() : fullPlansOf(cached);
  }

  /**
   * Ernährungs-Zeilen des Kontos (Etappe N7 Teil 2, RLS: nur eigene): Essenspläne und Listen innerhalb der Löschfrist
   * (G-N7-2), Tagebuch der letzten LOG_CACHE_WEEKS Wochen, Favoriten, eigene Gerichte. Vor `db-migrate` fehlen die
   * Tabellen ggf. noch – dann leer (G-W1, tolerant). Alles an der Grenze erneut geprüft (Zod, Wächter N7 H5).
   */
  async function fetchNutritionRows(userId: string): Promise<NutritionRows> {
    const cutoff = mealPlanRetentionStart(today());
    const [plans, lists, entries, favorites, meals, userProducts, productLinks] = await Promise.all(
      [
        client
          .from('meal_plans')
          .select(
            'id, user_id, week_start, engine_version, variant, meal_prep_plan_id, inputs, uses_health_data, ' +
              'auto_adjusted, recipes_changed, cook_day_started_at, created_at',
          )
          .eq('user_id', userId)
          .gte('week_start', cutoff)
          .then(emptyIfMissing),
        client
          .from('shopping_lists')
          .select(
            'id, user_id, week_start, from_date, to_date, plan_key, added_recipes, uses_health_data, created_at, ' +
              'updated_at',
          )
          .eq('user_id', userId)
          .gte('week_start', cutoff)
          .then(emptyIfMissing),
        client
          .from('food_log_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('eaten_on', logWindowStart())
          .then(emptyIfMissing),
        client.from('food_log_favorites').select('*').eq('user_id', userId).then(emptyIfMissing),
        client.from('custom_meals').select('*').eq('user_id', userId).then(emptyIfMissing),
        // Eigene Produkte (Etappe E4a) – Tabelle fehlt vor db-migrate: leer.
        client.from('user_food_products').select('*').eq('user_id', userId).then(emptyIfMissing),
        // Gelernte Zuordnungen (Einkaufen E1) – Tabelle fehlt vor db-migrate: leer.
        client
          .from('shopping_product_links')
          .select('*')
          .eq('user_id', userId)
          .then(emptyIfMissing),
      ],
    );
    for (const result of [plans, lists, entries, favorites, meals, userProducts, productLinks]) {
      if (result.error) throw result.error;
    }
    const planRows = (plans.data ?? []) as unknown as DbMealPlan[];
    const listRows = (lists.data ?? []) as unknown as DbShoppingList[];
    const mealRows = (meals.data ?? []) as unknown as Record<string, unknown>[];
    const planItems: DbMealPlanItem[] = [];
    for (const ids of chunks(
      planRows.map((p) => p.id),
      IN_CHUNK,
    )) {
      const result = await client
        .from('meal_plan_items')
        .select(MEAL_PLAN_ITEM_COLUMNS)
        .in('plan_id', ids);
      if (result.error) throw result.error;
      planItems.push(...((result.data ?? []) as unknown as DbMealPlanItem[]));
    }
    const listItems: DbShoppingListItem[] = [];
    for (const ids of chunks(
      listRows.map((l) => l.id),
      IN_CHUNK,
    )) {
      const result = await client.from('shopping_list_items').select('*').in('list_id', ids);
      if (result.error) throw result.error;
      listItems.push(...((result.data ?? []) as unknown as DbShoppingListItem[]));
    }
    const mealItems: Record<string, unknown>[] = [];
    for (const ids of chunks(
      mealRows.map((m) => String(m.id)),
      IN_CHUNK,
    )) {
      const result = await client.from('custom_meal_items').select('*').in('meal_id', ids);
      if (result.error) throw result.error;
      mealItems.push(...((result.data ?? []) as unknown as Record<string, unknown>[]));
    }
    return {
      mealPlans: mealPlanRowsFromDb(planRows, planItems, await cachedFullPlans(userId), today()),
      shoppingLists: shoppingListRowsFromDb(listRows, listItems, today()),
      foodLogEntries: foodLogRowsFromDb(
        (entries.data ?? []) as unknown as Record<string, unknown>[],
      ),
      foodLogFavorites: foodLogFavoriteRowsFromDb(
        (favorites.data ?? []) as unknown as Record<string, unknown>[],
      ),
      ...customMealRowsFromDb(mealRows, mealItems),
      userFoodProducts: userFoodProductRowsFromDb(
        (userProducts.data ?? []) as unknown as Record<string, unknown>[],
      ),
      shoppingProductLinks: shoppingProductLinkRowsFromDb(
        (productLinks.data ?? []) as unknown as Record<string, unknown>[],
      ),
    };
  }

  /** Workout-Bibliothek (docs/PLAN-WORKOUTS.md): nur `data`, RLS liefert nur freigegebene. */
  /**
   * Supplement-Check und „Meine Supplements“ (Gesundheitsdaten): nur online, nie zwischengespeichert. Ungültige Zeilen
   * (z. B. von einer neueren App) werden übergangen – dann fragt die App den Check neu ab.
   */
  async function loadSupplementUserData(): Promise<SupplementUserData> {
    const session = await requireSession();
    const [screening, choices] = await Promise.all([
      client
        .from('supplement_screening')
        .select('answers, flags, version, updated_at')
        .eq('user_id', session.userId)
        .maybeSingle(),
      client.from('user_supplements').select('supplement_id, status').eq('user_id', session.userId),
    ]);
    if (screening.error) throw toBackendError(screening.error, true);
    if (choices.error) throw toBackendError(choices.error, true);
    const parsed =
      screening.data === null
        ? null
        : storedSupplementScreeningSchema.safeParse({
            answers: screening.data.answers,
            flags: screening.data.flags,
            version: screening.data.version,
            updatedAt: screening.data.updated_at,
          });
    return {
      screening: parsed?.success ? parsed.data : null,
      choices: (choices.data ?? []).flatMap((row) => {
        const choice = userSupplementChoiceSchema.safeParse({
          supplementId: row.supplement_id,
          status: row.status,
        });
        return choice.success ? [choice.data] : [];
      }),
    };
  }

  async function fetchWorkouts(): Promise<unknown[]> {
    const { data, error } = await client.from('workouts').select('data').order('id');
    if (error) throw error;
    return (data ?? []).map((row) => row.data);
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
      ratingsResult,
      dislikesResult,
      weightGoalResult,
      competitionsResult,
      layoutResult,
    ] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      client.from('consents').select('*').eq('user_id', userId),
      client.from('goals').select('*').eq('user_id', userId).maybeSingle(),
      client.from('training_slots').select('*').eq('user_id', userId).order('slot_no'),
      client.from('user_equipment').select('*').eq('user_id', userId),
      client.from('nutrition_prefs').select('*').eq('user_id', userId).maybeSingle(),
      client.from('food_preferences').select('*').eq('user_id', userId),
      // Gesundheitsdaten: nur die neuesten Einträge (je Feld, wie die Engine sie nutzt), nur im Arbeitsspeicher.
      fetchBodyMetrics(userId),
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
      // Bewertungen und „mag ich nicht“ je Lebensmittel (Etappe N7) – kein Gesundheitsdatum, aber privat.
      client
        .from('recipe_ratings')
        .select('user_id, recipe_id, value, reason, rated_on')
        .eq('user_id', userId),
      client.from('food_dislikes').select('user_id, food_id').eq('user_id', userId),
      // Wunschgewicht (Etappe Z3): Gesundheitsdatum, nur im Arbeitsspeicher (cacheableRows).
      client.from('weight_goals').select('*').eq('user_id', userId).limit(1),
      // Wettkämpfe (Phase 10 WP3/WP4) – kein Gesundheitsdatum; der Plan-Bezug kommt nie in den normalen Zwischenspeicher.
      client.from('competitions').select('*').eq('user_id', userId),
      // Anordnung der Übersicht/Menüleiste (Etappe E2) – vor `db-migrate` leer (Standard).
      client
        .from('app_layout_settings')
        // `*` statt Spaltenliste: die Spalte step_goal (22.10.2026) fehlt vor `db-migrate`.
        .select('*')
        .eq('user_id', userId)
        .limit(1),
    ]);
    // Etappe N7 (Wächter N7 S1): vor `db-migrate` gibt es die Tabellen noch nicht – dann leer, Anmeldung läuft weiter.
    const ratings = emptyIfMissing(ratingsResult);
    const dislikes = emptyIfMissing(dislikesResult);
    // Etappe Z3: vor `db-migrate` gibt es weight_goals noch nicht – dann kein Wunschgewicht.
    const weightGoal = emptyIfMissing(weightGoalResult);
    const competitions = emptyIfMissing(competitionsResult);
    const layout = emptyIfMissing(layoutResult);
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
      ratings,
      dislikes,
      weightGoal,
      competitions,
      layout,
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
      // Seit Etappe N7 stehen die Antworten des Schritts nutrition_setup an derselben Zeile – aufgeteilt wie im
      // Testmodus (nutritionPrefsFromDb, Zod an der Grenze).
      ...nutritionPrefsFromDb(prefs.data),
      foodPreferences: food.data ?? [],
      bodyMetrics: metrics.data ?? [],
      bodyMeasurements: measurements.data ?? [],
      healthScreenings: screening.data ?? [],
      weightGoal: ((weightGoal.data ?? [])[0] as WeightGoalRow | undefined) ?? null,
      reminder: reminder.data,
      ...plan,
      ...logs,
      startWeights: (startWeights.data ?? []) as StartWeightRow[],
      // Übungs-Präferenzen gibt es in der Datenbank erst mit Etappe T3 (supportsExercisePreferences = false).
      exercisePreferences: [],
      recipeRatings: (ratings.data ?? []) as RecipeRatingRow[],
      foodDislikes: (dislikes.data ?? []) as FoodDislikeRow[],
      // Essenspläne, Einkaufslisten, Ernährungstagebuch, Favoriten und eigene Gerichte (Etappe N7 Teil 2).
      ...(await fetchNutritionRows(userId)),
      // Wettkämpfe (Phase 10 WP4): eigene Zeilen (RLS), vor `db-migrate` leer.
      competitions: (competitions.data ?? []) as CompetitionRow[],
      appLayout: appLayoutRowFromDb((layout.data ?? [])[0]),
    };
  }

  /**
   * Aktuelle Einwilligungstexte – auch VOR dem Login (anon). Seit Etappe N7 direkt aus consent_documents (RLS: nur
   * veröffentlichte Texte); die höchste Version je Art ist die gültige – dasselbe Ergebnis wie
   * public.current_consent_version, die für anon nicht mehr ausführbar ist (Supabase-Advisor).
   */
  async function fetchConsentDocuments(): Promise<ConsentDocument[]> {
    const documents: ConsentDocument[] = [];
    for (const type of CONSENT_TYPES_WITH_TEXT) {
      const { data, error } = await client
        .from('consent_documents')
        .select('consent_type, version, title_de, body_de')
        .eq('consent_type', type)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (data === null) {
        continue;
      }
      documents.push({ type, version: data.version, title: data.title_de, body: data.body_de });
    }
    return documents;
  }

  const backend: Backend = {
    mode: 'supabase',
    // Übungs-Präferenzen erst mit Etappe T3 (Tabelle exercise_preferences) – bis dahin nur „Nur heute“ (8.2).
    supportsExercisePreferences: false,
    // Gericht per Foto (Etappe E3): Freischaltung, Kontingent und Auswertung über apps/web.
    // Produktabfrage (Etappe E4a): über apps/web (Nummer im Körper; Flag, Einwilligung, Limits prüft der Server).
    ...createRemoteFoodProduct({ client, webUrl: options.webUrl ?? null }),
    ...createRemoteFoodPhoto({
      client,
      webUrl: options.webUrl ?? null,
      now: options.now,
      ...(options.fetchFn ? { fetchFn: options.fetchFn } : {}),
    }),
    // Ernährung im Supabase-Modus seit Etappe N7 Teil 2 (inkl. Schritt nutrition_setup, R2-S3): Essensplan/Einkaufsliste
    // aus der Datenbank ohne Planband (Rekonstruktion im Core), Bestand aus der Datenbank (nur freigegeben und fachlich
    // geprüft), Tagebuch und eigene Gerichte über die verschlüsselte Ernährungs-Warteschlange.
    supportsNutrition: true,
    // Testphase „alles offen“ (Wächter N3): nur Anzeige; Fehler und offline → kein Kennzeichen.
    testPhaseOpen: async () => {
      try {
        const { data, error } = await client.rpc('premium_open_active');
        return !error && data === true;
      } catch {
        return false;
      }
    },
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
        const nutrition =
          (await readNutritionCache(
            nutritionCacheStore,
            session.userId,
            options.now(),
            HEALTH_PLAN_CACHE_MAX_AGE_DAYS,
          )) ?? EMPTY_NUTRITION_ROWS;
        const cached = {
          // Ernährungs-Zeilen aus dem geschützten Speicher – erneut geprüft wie der Gerätespeicher (upgradeStoredRows).
          ...upgradeStoredRows({ ...cache.rows, ...nutrition }),
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
        await nutritionQueue.load();
        return {
          rows: withPendingNutrition(withPendingLogs(rows, session.userId), session.userId),
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
        await revokeHealthData(false, null);
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
      // Phase 8: Widerruf wearable_data – wartende Abgleiche und der Zwischenstand (Gesundheitsdaten) weg.
      if (type === 'wearable_data') await wearableQueue.discardAll();
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
        // Spalten von nutrition_prefs seit N7 Teil 1; der Schritt wird seit N7 Teil 2 angezeigt.
        nutritionSetupAvailable: true,
      });
      // 0. Wunschgewicht braucht das Abnehmziel in `goals` (Trigger weight_goals_require_fat_loss). Das Ziel läuft über
      //    die Warteschlange – deshalb vorher die Warteschlange senden; hängt ein Ziel noch fest (offline), nicht
      //    senden, sondern „Erneut versuchen“ melden (sonst 23514 bei einem Netzaussetzer).
      if (planned.ops.some((op) => op.kind === 'upsert_weight_goal')) {
        await queue.flush();
        if (queue.snapshot().some((entry) => entry.op.kind === 'upsert_goals')) {
          throw new BackendError('network', { sensitive: true });
        }
      }
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

    pendingChanges: () => queue.size() + logQueue.size() + nutritionQueue.size(),
    flush: () => flushAll().catch(() => false),

    clearDeviceData: async () => {
      await clearLocal();
      for (const key of Object.values(STORAGE_KEYS)) {
        await store.removeItem(key);
      }
    },

    loadWorkoutLibrary: async () => {
      try {
        const rows = await fetchWorkouts();
        // Nur Inhalte (keine Nutzerdaten) – für offline.
        await writeJson(store, STORAGE_KEYS.workoutLibrary, rows);
        return { workouts: workoutsFromDbRows(rows.map((data) => ({ data }))), cached: false };
      } catch (error) {
        if (classifySupabaseError(error) === 'network') {
          const cached = await readJson<unknown[]>(store, STORAGE_KEYS.workoutLibrary);
          if (Array.isArray(cached)) {
            return { workouts: workoutsFromDbRows(cached.map((data) => ({ data }))), cached: true };
          }
        }
        throw toBackendError(error);
      }
    },

    // --- Supplemente (Phase 6 SU3/SU4) -----------------------------------------------------------------------
    loadSupplementLibrary: async () => {
      try {
        const { data, error } = await client.from('supplements').select('data').order('id');
        if (error) throw error;
        const rows = (data ?? []).map((row) => row.data);
        // Nur Inhalte (keine Nutzerdaten) – für offline.
        await writeJson(store, STORAGE_KEYS.supplementLibrary, rows);
        return {
          entries: supplementsFromDbRows(rows.map((item) => ({ data: item }))),
          cached: false,
          drafts: false,
        };
      } catch (error) {
        if (classifySupabaseError(error) === 'network') {
          const cached = await readJson<unknown[]>(store, STORAGE_KEYS.supplementLibrary);
          if (Array.isArray(cached)) {
            return {
              entries: supplementsFromDbRows(cached.map((item) => ({ data: item }))),
              cached: true,
              drafts: false,
            };
          }
        }
        throw toBackendError(error);
      }
    },
    loadSupplementUserData: async () => loadSupplementUserData(),
    saveSupplementScreening: async (answers) => {
      await requireSession();
      const { error } = await client.rpc('save_supplement_screening', {
        p_answers: answers as unknown as Json,
      });
      if (error) throw toBackendError(error, true);
      return loadSupplementUserData();
    },
    setUserSupplement: async (id, status) => {
      await requireSession();
      const { error } = await client.rpc('set_user_supplement', {
        p_supplement_id: id,
        p_status: status,
      });
      if (error) throw toBackendError(error, true);
      return loadSupplementUserData();
    },
    deleteSupplementData: async () => {
      await requireSession();
      const { error } = await client.rpc('delete_my_supplement_data');
      if (error) throw toBackendError(error, true);
      return EMPTY_SUPPLEMENT_USER_DATA;
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

    // Wettkampf (Etappe WP4): immer sofort, nie Warteschlange (Anlegen nur online). Danach neu laden.
    saveCompetition: async (payload) => {
      const session = await requireSession();
      const { error } = await client.rpc('save_competition', {
        p_competition: { ...payload } as Json,
      });
      if (error) throw toCompetitionError(error);
      return refreshRows(session.userId);
    },
    cancelCompetition: async (id) => {
      const session = await requireSession();
      const { error } = await client.rpc('cancel_competition', { p_id: id });
      if (error) throw toCompetitionError(error);
      return refreshRows(session.userId);
    },
    completeCompetition: async (id, sessionLogId) => {
      const session = await requireSession();
      // Wartende Trainings zuerst senden (das Ergebnis ist ein Tagebuch-Eintrag vom Renntag).
      await logQueue.flush().catch(() => 'later');
      const { error } = await client.rpc('complete_competition', {
        p_id: id,
        p_session_log_id: sessionLogId,
      });
      if (error) throw toCompetitionError(error);
      return refreshRows(session.userId);
    },
    deleteCompetition: async (id) => {
      const session = await requireSession();
      const { error } = await client.rpc('delete_competition', { p_id: id });
      if (error) throw toCompetitionError(error);
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
          throw toMoveError(error, true);
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

    swapPlannedSessions: async (swap, rows) => {
      const session = await requireSession();
      const op: WriteOp = { kind: 'swap_planned_sessions', ...swap };
      // Wartende Verschiebungen zuerst senden: Der Tausch prüft den SERVER-Stand beider Einheiten. Bleibt etwas
      // liegen (offline), wird nicht getauscht.
      if (queue.snapshot().some((entry) => entry.op.kind === 'update_planned_session')) {
        if (!(await queue.flush().catch(() => false))) {
          throw new BackendError('online_only', { sensitive: swap.usesHealthData });
        }
      }
      try {
        await executeWriteOp(client, session.userId, op);
      } catch (error) {
        const failure = toMoveError(error, swap.usesHealthData);
        throw failure.code === 'network'
          ? new BackendError('online_only', { sensitive: swap.usesHealthData, cause: error })
          : failure;
      }
      // Frischer Stand vom Server (eine eben gesendete Verschiebung könnte abgelehnt worden sein); scheitert das
      // Laden, gilt der lokal getauschte Stand.
      try {
        return await refreshRows(session.userId);
      } catch {
        const next = applyWriteOps(rows, [op], displayContext());
        await writeCache(session.userId, next);
        return next;
      }
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
    updateExercisePreferences: async () => {
      // Kein halbfertiger Zustand: Die App bietet „Ab jetzt immer“ ohne supportsExercisePreferences nicht an.
      throw new BackendError('preference_rejected');
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
    revokeHealthData: (deleteLogs, conversion) => revokeHealthData(deleteLogs, conversion),
    deleteStoredIntolerances: async () => {
      await requireSession();
      // Eine Transaktion – Unverträglichkeiten UND Essenspläne/Einkaufslisten mit Gesundheitsbezug (wie im Testmodus,
      // Wächter N3 K5). Geht ohne Einwilligung; Gesundheitsdaten → sofort, nie Warteschlange.
      const { error } = await client.rpc('delete_stored_intolerances');
      if (error) {
        // Etappe N7 Teil 2 Nr. 7: kein Rückfall auf direktes Löschen mehr (dabei blieben Pläne/Listen mit
        // Gesundheitsbezug stehen). Fehlt die Funktion (App vor db-migrate), klarer Fehler – nichts halb gelöscht.
        if (isMissingFunction(error)) {
          throw new BackendError('delete_unavailable', { sensitive: true, cause: error });
        }
        const code = classifySupabaseError(error, true);
        throw new BackendError(code === 'network' ? 'online_only' : code, {
          sensitive: true,
          cause: error,
        });
      }
      // Die Datenbank hat Pläne/Listen mit Gesundheitsbezug gelöscht – der geschützte Zwischenspeicher auch.
      await nutritionCacheStore.clear();
    },
    loadNutritionLibrary: async () => {
      let library: NutritionLibrary;
      try {
        const content = await fetchNutritionContent();
        // Nur Inhalte (keine Nutzerdaten) – für offline.
        await writeJson(store, STORAGE_KEYS.nutritionLibrary, content);
        library = nutritionLibraryFromDb(content);
      } catch (error) {
        const cached =
          classifySupabaseError(error) === 'network'
            ? await readJson<Partial<DbNutritionContent>>(store, STORAGE_KEYS.nutritionLibrary)
            : null;
        if (cached === null) throw toBackendError(error);
        library = nutritionLibraryFromDb({ ...EMPTY_NUTRITION_CONTENT, ...cached });
      }
      return {
        library,
        demo: false,
        demoAvailable: false,
        // Ohne freigegebene Rezepte (Fachprüfung offen, G-N7-3) ein klarer Leer-Zustand.
        awaitingReview: library.recipes.length === 0,
      };
    },
    saveMealPlan: async (plan, saveOptions, rows) => saveMealPlanRemote(plan, saveOptions, rows),
    saveShoppingList: async (list, rows) => saveShoppingListRemote(list, rows),
    saveCookDayStart: async (weekStart, startedAt, rows) => {
      const session = await requireSession();
      const row = storedMealPlanRow(rows, weekStart);
      if (
        row === null ||
        (startedAt !== null && Number.isNaN(Date.parse(startedAt))) ||
        applyCookDayStart(rows, weekStart, startedAt) === null
      ) {
        throw new BackendError('plan_rejected', { sensitive: row?.uses_health_data ?? true });
      }
      const op: WriteOp = {
        kind: 'set_cook_day_start',
        planId: row.id,
        weekStart,
        startedAt,
        usesHealthData: row.uses_health_data,
      };
      return applyNutritionWriteOp(session.userId, op, rows);
    },
    // Ernährungstagebuch (Etappe E1, N7 Teil 2): dieselben Regeln wie im Testmodus vorab (food-log-rows.ts), dann über
    // die verschlüsselte Ernährungs-Warteschlange an save_food_log_entries. Werte nie in Meldungen oder Logs.
    saveFoodLogEntries: async (entries, rows) => saveFoodLogRemote(entries, rows),
    deleteFoodLogEntry: async (id, rows) => {
      const session = await requireSession();
      const existing = rows.foodLogEntries.find((e) => e.id === id);
      if (existing === undefined) return rows;
      const queued = await enqueueNutrition(
        {
          kind: 'food_log_delete',
          id,
          // revision 0 = noch nicht übertragen: die Warteschlange verwirft dann beide Vorgänge (nichts zu löschen).
          baseRevision: Math.max(existing.revision, 1),
        },
        session.userId,
      );
      return finishNutritionWrite(
        session.userId,
        applyFoodLogDelete(rows, id),
        [queued],
        'food_log',
      );
    },
    changeFoodLogFavorite: async (change, rows) => {
      const session = await requireSession();
      const versions = await requireVersions();
      const next = applyFavoriteChange(rows, change, {
        userId: session.userId,
        now: options.now(),
        versions,
      });
      if (next === null) {
        throw new BackendError(
          change.op === 'set' && rows.foodLogFavorites.length >= 100
            ? 'favorite_limit'
            : change.op === 'set' &&
                (change.favorite.source === 'quick' || change.favorite.source === 'product') &&
                healthConsentStatus(rows, versions) !== 'valid'
              ? 'consent_required'
              : 'unknown',
        );
      }
      const saved =
        change.op === 'set'
          ? next.foodLogFavorites.find((f) => f.fav_key === change.favorite.fav_key)
          : undefined;
      const op: WriteOp =
        change.op === 'set' && saved !== undefined
          ? { kind: 'upsert_food_log_favorite', row: saved }
          : {
              kind: 'delete_food_log_favorite',
              favKey: change.op === 'remove' ? change.favKey : change.favorite.fav_key,
            };
      return applyNutritionWriteOp(session.userId, op, rows);
    },
    // Eigene Gerichte (Etappe E2, N7 Teil 2): Regeln wie im Testmodus vorab, dann über die Ernährungs-Warteschlange an
    // save_custom_meal (Werte aus Zutaten rechnet der Server, die App übernimmt sie beim Neuladen). Name und Werte nie in
    // Meldungen oder Logs.
    saveCustomMeal: async (meal, rows) => {
      const session = await requireSession();
      const versions = await requireVersions();
      const check = checkCustomMealSave(rows, meal, { versions });
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
      const existing = rows.customMeals.find((m) => m.id === check.meal.id);
      const queued = await enqueueNutrition(
        {
          kind: 'custom_meal_save',
          meal: check.meal,
          writeId: options.newId(),
          baseRevision: existing !== undefined && existing.revision > 0 ? existing.revision : null,
        },
        session.userId,
      );
      return finishNutritionWrite(session.userId, rows, [queued], 'custom_meal');
    },
    deleteCustomMeal: async (id, rows) => {
      const session = await requireSession();
      const queued = await enqueueNutrition({ kind: 'custom_meal_delete', id }, session.userId);
      return finishNutritionWrite(
        session.userId,
        applyCustomMealDelete(rows, id),
        [queued],
        'custom_meal',
      );
    },
    // Eigene Produkte (Etappe E4a): Regeln wie im Testmodus vorab, dann über die Ernährungs-Warteschlange an
    // save_user_food_product (offline möglich). Name, Marke und Werte nie in Meldungen oder Logs.
    saveUserFoodProduct: async (product, rows) => {
      const session = await requireSession();
      const versions = await requireVersions();
      const check = checkUserFoodProductSave(rows, product, { versions });
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
      const existing = rows.userFoodProducts.find((p) => p.id === check.product.id);
      const queued = await enqueueNutrition(
        {
          kind: 'user_product_save',
          product: check.product,
          writeId: options.newId(),
          baseRevision: existing !== undefined && existing.revision > 0 ? existing.revision : null,
        },
        session.userId,
      );
      return finishNutritionWrite(session.userId, rows, [queued], 'user_product');
    },
    deleteUserFoodProduct: async (id, rows) => {
      const session = await requireSession();
      const queued = await enqueueNutrition({ kind: 'user_product_delete', id }, session.userId);
      return finishNutritionWrite(
        session.userId,
        applyUserFoodProductDelete(rows, id),
        [queued],
        'user_product',
      );
    },
    // Etappe E2: Anordnung – sofort lokal, Senden über die Warteschlange (kein Gesundheitsdatum, offline möglich).
    saveAppLayout: async (layout, rows) => {
      const session = await requireSession();
      const op: WriteOp = { kind: 'save_app_layout', row: { user_id: session.userId, ...layout } };
      const next = applyWriteOps(rows, [op], displayContext());
      await writeCache(session.userId, next);
      await queue.add([op]);
      void queue.flush();
      return next;
    },
    // Einkaufen E1: gelernte Zuordnung über save_shopping_product_link (prüft Einwilligung, Nummer, Lebensmittel und
    // die Obergrenze erneut). Sensibel → nie in die normale Warteschlange; ohne Netz `online_only` (das Lernen ist
    // eine Bequemlichkeit, das Abhaken klappt trotzdem).
    saveShoppingProductLink: async (link, rows) => {
      const session = await requireSession();
      const parsed = shoppingProductLinkSchema.safeParse(link);
      if (!parsed.success) throw new BackendError('unknown', { sensitive: true });
      const { error, status } = await client.rpc('save_shopping_product_link', {
        p_code: parsed.data.code,
        p_food_id: parsed.data.food_id,
      });
      if (error) {
        if (isConsentError(error)) throw new BackendError('consent_required', { sensitive: true });
        const code = classifySupabaseError({ ...error, status }, true);
        throw new BackendError(code === 'network' ? 'online_only' : code, {
          sensitive: true,
          cause: error,
        });
      }
      const next = applyShoppingProductLink(rows, parsed.data, {
        userId: session.userId,
        now: options.now(),
      });
      await writeCache(session.userId, next);
      return next;
    },
    nutritionSync: async () => {
      await nutritionQueue.load();
      const owner = currentUserId;
      const own = owner !== null && nutritionQueue.ownerUserId() === owner;
      return {
        queued: own ? nutritionQueue.size() : 0,
        rejected: own ? nutritionQueue.rejected().length : 0,
        sessionOnly: nutritionQueue.storeKind === 'session',
      };
    },
    discardRejectedNutrition: async () => {
      await requireSession();
      await nutritionQueue.discardRejected();
    },
    // Bewertung nach dem Essen und „mag ich nicht“ je Lebensmittel (Etappe N7, Tabellen recipe_ratings/food_dislikes,
    // RLS: nur eigene Zeilen). Gleiche Prüfung wie im Testmodus (rating-rows.ts); nur online (kein Gesundheitsdatum,
    // aber auch nicht wichtig genug für die Warteschlange). Werte nie in Meldungen oder Logs.
    saveRecipeRating: async (change, rows) => {
      const session = await requireSession();
      const check = checkRecipeRatingSave(rows, change, today());
      if (!check.ok) throw new BackendError('unknown');
      const rating = check.ratings.find((r) => r.recipeId === change.recipeId) ?? null;
      const result =
        rating === null
          ? await client
              .from('recipe_ratings')
              .delete()
              .eq('user_id', session.userId)
              .eq('recipe_id', change.recipeId)
          : await client.from('recipe_ratings').upsert(
              {
                user_id: session.userId,
                recipe_id: rating.recipeId,
                value: rating.value,
                reason: rating.reason,
                rated_on: rating.ratedOn,
              },
              { onConflict: 'user_id,recipe_id' },
            );
      if (result.error) throw onlineOnlyError(result.error);
      const next = applyRecipeRatings(rows, check.ratings, session.userId);
      await writeCache(session.userId, next);
      return next;
    },
    deleteRecipeRatings: async (rows) => {
      const session = await requireSession();
      const { error } = await client.from('recipe_ratings').delete().eq('user_id', session.userId);
      if (error) throw onlineOnlyError(error);
      const next = applyRecipeRatings(rows, [], session.userId);
      await writeCache(session.userId, next);
      return next;
    },
    saveFoodDislikes: async (foodIds, rows) => {
      const session = await requireSession();
      const check = checkFoodDislikesSave(foodIds);
      if (!check.ok) throw new BackendError('unknown');
      // Atomar ersetzen (replace_food_dislikes, security invoker: RLS und Höchstzahl 300 greifen).
      const { error } = await client.rpc('replace_food_dislikes', { p_food_ids: check.foodIds });
      if (error) throw onlineOnlyError(error);
      const next = applyFoodDislikes(rows, check.foodIds, session.userId);
      await writeCache(session.userId, next);
      return next;
    },
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
        (await drafts.hasForeign(session.userId)) ||
        (await nutritionQueue.hasForeign(session.userId))
      );
    },
    discardForeignDeviceData: async () => {
      const session = await requireSession();
      if (await logQueue.hasForeign(session.userId)) await logQueue.clear();
      if (await queue.hasForeign(session.userId)) await queue.clear();
      await drafts.removeWhere((d) => d.ownerUserId !== session.userId);
      if (await nutritionQueue.hasForeign(session.userId)) await nutritionQueue.clear();
    },

    // --- Woche, Verlauf, Export (Etappe D) -----------------------------------------------------------------
    logHistoryStart: () => logWindowStart(),
    loadOlderLogs: async (before) => {
      const session = await requireSession();
      try {
        return await fetchOlderLogs(session.userId, before);
      } catch (error) {
        const code = classifySupabaseError(error);
        throw new BackendError(code === 'network' ? 'online_only' : code, { cause: error });
      }
    },
    exportMyData: async () => {
      const session = await requireSession();
      const { data, error } = await client.rpc('export_my_data');
      if (error) {
        // Nur der Fehlercode – nie Inhalte (der Export enthält Gesundheitsdaten).
        const code = classifySupabaseError(error);
        throw new BackendError(code === 'network' ? 'online_only' : code, {
          sensitive: true,
          cause: error,
        });
      }
      const file = buildDataExportFile(data, { email: session.email });
      if (!file) throw new BackendError('unknown', { sensitive: true });
      return file;
    },

    // --- Ausdauer: Strecken (Etappe E4) -------------------------------------------------------------------------
    loadTrackedRoutes: async () => {
      const session = await requireSession();
      const pending = await routeQueue.entries();
      const pendingIds = new Set(pending.map((p) => p.payload.id));
      try {
        const { data, error } = await client
          .from('tracked_routes')
          .select('*')
          .eq('user_id', session.userId)
          .order('started_at', { ascending: false })
          .limit(TRACKED_ROUTES_LOAD_LIMIT);
        if (error) throw error;
        // Vor db-migrate (23.10.2026) fehlt die Spalte wearable_session_log_id – mit null ergänzen.
        const routes = ((data ?? []) as unknown as TrackedRouteRow[]).map(normalizeRouteRow);
        await routeQueue.writeCache(routes, session.userId).catch(() => undefined);
        return { routes: routes.filter((r) => !pendingIds.has(r.id)), pending, offline: false };
      } catch (error) {
        if (classifySupabaseError(error) !== 'network') throw toBackendError(error);
        const cached = (await routeQueue.readCache()) ?? [];
        return { routes: cached.filter((r) => !pendingIds.has(r.id)), pending, offline: true };
      }
    },
    saveTrackedRoute: async (payload) => {
      const session = await requireSession();
      try {
        await routeQueue.add(payload, session.userId);
      } catch {
        throw new BackendError('storage_unavailable');
      }
      await flushAll().catch(() => false);
      const entry = (await routeQueue.entries()).find((e) => e.payload.id === payload.id);
      if (entry?.state === 'rejected') throw new BackendError('route_rejected');
      return entry ? 'queued' : 'saved';
    },
    updateTrackedRoute: async (payload) => {
      await requireSession();
      const parsed = updateTrackedRouteSchema.safeParse(payload);
      if (!parsed.success) throw new BackendError('route_rejected');
      const { error } = await client.rpc('update_tracked_route', { p_route: toJson(parsed.data) });
      if (error) throw routeError(error);
    },
    setRouteMatch: async (routeId, favoriteId, state) => {
      await requireSession();
      const { data, error } = await client.rpc('set_route_match', {
        p_route: routeId,
        p_favorite: favoriteId,
        p_state: state,
      });
      if (error) throw routeError(error);
      return data === 'auto' || data === 'confirmed' || data === 'rejected' || data === 'clear'
        ? data
        : 'unchanged';
    },
    setRouteWeather: async (routeId, weather) => {
      await requireSession();
      const parsed = weather === null ? null : routeWeatherSchema.safeParse(weather);
      if (parsed && !parsed.success) throw new BackendError('route_rejected');
      const { error } = await client.rpc('set_route_weather', {
        p_route: routeId,
        p_weather: parsed ? toJson(parsed.data) : null,
      });
      if (error) throw routeError(error);
    },
    setRouteAutoMatch: async (routeId, enabled) => {
      await requireSession();
      const { error } = await client.rpc('set_route_auto_match', {
        p_route: routeId,
        p_enabled: enabled,
      });
      if (error) throw routeError(error);
    },
    deleteTrackedRoute: async (id) => {
      await requireSession();
      if ((await routeQueue.entries()).some((e) => e.payload.id === id)) {
        await routeQueue.discard(id);
        return;
      }
      const { error } = await client.rpc('delete_tracked_route', { p_id: id });
      if (error) throw routeError(error);
    },
    deleteAllTrackedRoutes: async () => {
      await requireSession();
      const { data, error } = await client.rpc('delete_all_tracked_routes');
      if (error) throw routeError(error);
      for (const entry of await routeQueue.entries()) await routeQueue.discard(entry.payload.id);
      return typeof data === 'number' ? data : 0;
    },
    retryPendingRoute: async (id) => {
      await routeQueue.retry(id);
      await flushAll().catch(() => false);
    },
    discardPendingRoute: (id) => routeQueue.discard(id),
    readRecording: () => recordingStore.read(),
    writeRecording: (text) => recordingStore.write(text),
    clearRecording: () => recordingStore.clear(),

    // --- Smartwatch (Phase 8) ---------------------------------------------------------------------------------
    wearables: {
      load: async () => {
        const session = await requireSession();
        const pending = await wearableQueue.size();
        try {
          const [connections, sessions, heartRates, dailyMetrics] = await Promise.all([
            client.from('wearable_connections').select('*').eq('user_id', session.userId),
            client.from('wearable_sessions').select('*').eq('user_id', session.userId),
            client.from('heart_rate_summaries').select('*').eq('user_id', session.userId),
            client
              .from('daily_metrics')
              .select('*')
              .eq('user_id', session.userId)
              .order('day', { ascending: false })
              .limit(62),
          ]);
          // Vor db-migrate gibt es die Tabellen noch nicht: leer statt Fehler.
          const list = <T>(r: { data: unknown; error: unknown }): T[] => {
            if (r.error) {
              if (isMissingRelation(r.error)) return [];
              throw r.error;
            }
            return (r.data ?? []) as T[];
          };
          const rows: WearableRows = {
            connection: list<WearableConnectionRow>(connections)[0] ?? null,
            sessions: list<WearableSessionRow>(sessions),
            heartRates: list<HeartRateSummaryRow>(heartRates),
            dailyMetrics: list<DailyMetricRow>(dailyMetrics).sort((a, b) =>
              a.day.localeCompare(b.day),
            ),
          };
          await wearableQueue.writeCache(rows, session.userId).catch(() => undefined);
          return { rows, pending, offline: false };
        } catch (error) {
          if (classifySupabaseError(error) !== 'network') throw toBackendError(error, true);
          const cached = await wearableQueue.readCache();
          return {
            rows: cached ?? { connection: null, sessions: [], heartRates: [], dailyMetrics: [] },
            pending,
            offline: true,
          };
        }
      },
      connect: async (types) => {
        await requireSession();
        const { error } = await client.rpc('connect_wearable', {
          p_provider: 'health_connect',
          p_granted_types: toJson([...types]),
        });
        if (error) throw wearableError(error);
      },
      importBatches: async (batches, routes = []) => {
        const session = await requireSession();
        try {
          await wearableQueue.add(batches, session.userId, routes);
        } catch {
          throw new BackendError('storage_unavailable', { sensitive: true });
        }
        // Erst wartende Tagebuch-Einträge (Verweise), dann die Smartwatch-Warteschlange.
        await logQueue.flush().catch(() => undefined);
        const flushed = await wearableQueue.flush();
        if (flushed.state === 'consent')
          throw new BackendError('consent_required', { sensitive: true });
        if (flushed.state === 'rejected')
          throw new BackendError('wearable_rejected', { sensitive: true });
        if (flushed.state === 'later') return { kind: 'queued' };
        return { kind: 'imported', result: flushed.result };
      },
      saveRoute: async (route) => {
        await requireSession();
        const outcome = await sendWearableRoute(route, true);
        if (outcome.kind === 'consent')
          throw new BackendError('consent_required', { sensitive: true });
        if (outcome.kind === 'retry') throw new BackendError('online_only', { sensitive: true });
        if (outcome.kind === 'reject') throw new BackendError('route_rejected');
      },
      resolveDuplicate: async (id, merge) => {
        await requireSession();
        const { error } = await client.rpc('resolve_wearable_duplicate', {
          p_session_log_id: id,
          p_merge: merge,
        });
        if (error) throw wearableError(error);
      },
      disconnect: async (deleteImported) => {
        await requireSession();
        const { data, error } = await client.rpc('disconnect_wearable', {
          p_provider: 'health_connect',
          p_delete_imported: deleteImported,
        });
        if (error) throw wearableError(error);
        // Wartende Abgleiche würden sonst nach dem Trennen wieder übernommen.
        await wearableQueue.discardAll();
        return typeof data === 'number' ? data : 0;
      },
    },
  };

  // --- Ernährung im Supabase-Modus (Etappe N7 Teil 2) ----------------------------------------------------------

  /** Einwilligungs-Versionen (für die Prüfungen wie im Testmodus); ohne geladene Texte geht nichts. */
  async function requireVersions(): Promise<ConsentVersions> {
    const known = await knownVersions();
    if (known === null) throw new BackendError('network');
    return known;
  }

  /** Bestand aus der Datenbank (nur freigegebene Inhalte, RLS); fehlt eine Tabelle (vor db-migrate), leer. */
  async function fetchNutritionContent(): Promise<DbNutritionContent> {
    const tables = Object.keys(NUTRITION_CONTENT_TABLES) as (keyof DbNutritionContent)[];
    const results = await Promise.all(
      tables.map((table) =>
        client
          .from(table as 'foods')
          .select('id, data')
          .eq('status', 'published')
          .then(emptyIfMissing),
      ),
    );
    const content: DbNutritionContent = { ...EMPTY_NUTRITION_CONTENT };
    tables.forEach((table, index) => {
      const result = results[index];
      if (result?.error) throw result.error;
      content[table] = (result?.data ?? []) as unknown as DbContentRow[];
    });
    return content;
  }

  /**
   * Einfacher Ernährungs-Vorgang (Abhaken, Kochtag-Start, Favorit): Mit Gesundheitsbezug sofort (nur online), sonst
   * über die normale Warteschlange (offline möglich). Die Anzeige zeigt den neuen Stand sofort.
   */
  async function applyNutritionWriteOp(
    userId: string,
    op: WriteOp,
    rows: UserRows,
  ): Promise<UserRows> {
    const next = applyWriteOps(rows, [op], displayContext());
    if (isDirectOp(op)) {
      try {
        await executeWriteOp(client, userId, op);
      } catch (error) {
        const code = classifySupabaseError(error, true);
        throw new BackendError(
          code === 'network'
            ? 'online_only'
            : code === 'unknown' && op.kind !== 'upsert_food_log_favorite'
              ? 'plan_rejected'
              : code,
          { sensitive: true, cause: error },
        );
      }
      await writeCache(userId, next);
      return next;
    }
    await writeCache(userId, next);
    await queue.add([op]);
    void queue.flush();
    return next;
  }

  /**
   * In die verschlüsselte Ernährungs-Warteschlange legen. Ist der geschützte Speicher nicht beschreibbar (z. B. privates
   * Browser-Fenster), wird sofort gesendet – klappt das nicht, Fehler `storage_unavailable` (nie still verloren).
   */
  async function enqueueNutrition(
    op: NutritionQueueOp,
    userId: string,
  ): Promise<{ key: string; sentDirectly: NutritionSendResult | null }> {
    const key = nutritionQueueKey(op);
    try {
      await nutritionQueue.add(op, userId);
      return { key, sentDirectly: null };
    } catch (error) {
      if (error instanceof ForeignNutritionQueueError) throw new BackendError('foreign_data');
      // Widerruf/Abmelden läuft gerade (M2): nichts senden, nichts behalten – „bitte gleich noch einmal“.
      if (error instanceof NutritionQueueLockedError) {
        throw new BackendError('temporary', { sensitive: true });
      }
      const result = await sendNutritionOp(op).catch((): NutritionSendResult => ({
        kind: 'retry',
      }));
      if (result.kind === 'retry' || result.kind === 'transient') {
        throw new BackendError('storage_unavailable', { sensitive: true });
      }
      return { key, sentDirectly: result };
    }
  }

  /**
   * Nach dem Einreihen senden und das Ergebnis GENAU dieser Vorgänge melden: abgelehnt → Fehler-Code ohne Werte (die
   * Person erfährt es sofort, deshalb nicht zusätzlich als Hinweis behalten); gespeichert → Werte und Revisionen vom
   * Server übernehmen (E1/E2: „Server rechnet nach“); offline → lokal mit „wird übertragen“.
   */
  async function finishNutritionWrite(
    userId: string,
    displayRows: UserRows,
    queued: { key: string; sentDirectly: NutritionSendResult | null }[],
    area: 'food_log' | 'custom_meal' | 'user_product',
  ): Promise<UserRows> {
    const fromQueue = queued.filter((q) => q.sentDirectly === null).map((q) => q.key);
    for (const key of fromQueue) nutritionQueue.lastResults.delete(key);
    if (fromQueue.length > 0) await nutritionQueue.flush().catch(() => 'later');
    const results = queued.map((q) => q.sentDirectly ?? nutritionQueue.lastResults.get(q.key));
    let rejection: NutritionRejectReason | null = null;
    for (const [index, result] of results.entries()) {
      if (result?.kind !== 'rejected') continue;
      const entry = queued[index];
      if (entry !== undefined && entry.sentDirectly === null) {
        await nutritionQueue.takeRejected(entry.key);
      }
      rejection ??= result.reason;
    }
    let next = withPendingNutrition(displayRows, userId);
    if (results.some((r) => r?.kind === 'done' || r?.kind === 'rejected')) {
      try {
        const fresh = await fetchNutritionRows(userId);
        next = withPendingNutrition(
          {
            ...displayRows,
            foodLogEntries: fresh.foodLogEntries,
            foodLogFavorites: fresh.foodLogFavorites,
            customMeals: fresh.customMeals,
            customMealItems: fresh.customMealItems,
            userFoodProducts: fresh.userFoodProducts,
          },
          userId,
        );
      } catch {
        // Neu laden gescheitert – der lokale Stand bleibt bis zum nächsten Laden.
      }
    }
    await writeCache(userId, next);
    if (rejection !== null) {
      throw new BackendError(
        area === 'food_log'
          ? foodLogRejectCode(rejection)
          : area === 'custom_meal'
            ? customMealRejectCode(rejection)
            : userProductRejectCode(rejection),
        { sensitive: true },
      );
    }
    return next;
  }

  async function saveFoodLogRemote(
    entries: readonly FoodLogEntry[],
    rows: UserRows,
  ): Promise<UserRows> {
    const session = await requireSession();
    const versions = await requireVersions();
    const check = checkFoodLogSave(rows, entries, { today: today(), versions });
    if (!check.ok) {
      throw new BackendError(
        check.reason === 'consent_required' ? 'consent_required' : 'food_log_rejected',
        { sensitive: true },
      );
    }
    const queued: { key: string; sentDirectly: NutritionSendResult | null }[] = [];
    for (const outcome of check.outcomes) {
      if (outcome.kind !== 'saved') continue;
      const existing = rows.foodLogEntries.find((e) => e.id === outcome.entry.id);
      queued.push(
        await enqueueNutrition(
          {
            kind: 'food_log_save',
            entry: outcome.entry,
            writeId: options.newId(),
            baseRevision:
              existing !== undefined && existing.revision > 0 ? existing.revision : null,
          },
          session.userId,
        ),
      );
    }
    const next =
      queued.length === 0
        ? rows
        : await finishNutritionWrite(session.userId, rows, queued, 'food_log');
    // Wie der Server: gültige Einträge gelten, ein ungültiger wird danach gemeldet (Wächter E1 S2).
    const failed = check.outcomes.find((o) => o.kind !== 'saved');
    if (failed) {
      throw new BackendError(
        failed.kind === 'rejected' && failed.code === 'out_of_range'
          ? 'food_log_out_of_range'
          : failed.kind === 'rejected' && failed.code === 'day_full'
            ? 'food_log_day_full'
            : 'food_log_rejected',
        { sensitive: true },
      );
    }
    return next;
  }

  /**
   * Essensplan speichern (Etappe N7 Teil 2): dieselben Prüfungen wie im Testmodus vorab (Zod, Woche, Einwilligung),
   * dann `save_meal_plan` (prüft alles erneut, G-W3, Löschfrist). Braucht Verbindung – angezeigt wird schon vorher der
   * richtige Plan, das Speichern wird beim nächsten Öffnen bzw. mit „Erneut versuchen“ wiederholt.
   */
  async function saveMealPlanRemote(
    plan: MealPlanWeek,
    saveOptions: {
      autoAdjusted: boolean;
      recipesChanged?: boolean;
      shoppingList?: StoredShoppingList | undefined;
    },
    rows: UserRows,
  ): Promise<UserRows> {
    const session = await requireSession();
    const versions = await requireVersions();
    const ctx = { today: today(), rows, versions };
    const check = checkMealPlanSave(plan, ctx);
    const listCheck =
      saveOptions.shoppingList === undefined
        ? null
        : checkShoppingListSave(saveOptions.shoppingList, ctx);
    const failed = !check.ok ? check : listCheck !== null && !listCheck.ok ? listCheck : null;
    if (failed !== null) {
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
    const inputs = mealPlanPayloadInputs(rows);
    if (inputs === null) throw new BackendError('plan_rejected', { sensitive: true });
    let payload: ReturnType<typeof toMealPlanPayload>;
    try {
      payload = toMealPlanPayload(check.plan, inputs);
    } catch {
      throw new BackendError('plan_rejected', { sensitive: true });
    }
    const stored = storedMealPlanRow(rows, check.plan.weekStart);
    // Wächter N7 H9: vergangene Mahlzeiten mit archiviertem Rezept unverändert behalten.
    payload = withPreservedPastItems(payload, stored?.record, today());
    // Wächter N7 H3 / N5a K-c: Ohne gültige Einwilligung wird ein gespeicherter Plan mit Gesundheitsbezug dieser Woche
    // nicht weiterverwendet, sondern durch einen Plan ohne Gesundheitsdaten ersetzt (wie im Testmodus). Der Server
    // würde sonst die übernommenen vergangenen Tage als Gesundheitsbezug werten und „Einwilligung fehlt“ melden.
    if (stored?.uses_health_data === true && healthConsentStatus(rows, versions) !== 'valid') {
      const removed = await client
        .from('meal_plans')
        .delete()
        .eq('user_id', session.userId)
        .eq('id', stored.id);
      if (removed.error) throw toMealPlanSaveError(removed.error);
    }
    const saved = await client.rpc('save_meal_plan', {
      p_plan: toJson(payload),
      p_auto_adjusted: saveOptions.autoAdjusted,
      p_recipes_changed: saveOptions.recipesChanged ?? false,
    });
    if (saved.error) throw toMealPlanSaveError({ ...saved.error, status: saved.status });
    const planId = String(saved.data);
    const planUses = await serverUsesHealthData('meal_plans', planId, true);
    let next = applyMealPlanSave(rows, check.plan, {
      id: planId,
      userId: session.userId,
      now: options.now(),
      autoAdjusted: saveOptions.autoAdjusted,
      recipesChanged: saveOptions.recipesChanged ?? false,
    });
    next = {
      ...next,
      mealPlans: next.mealPlans.map((row) =>
        row.id === planId
          ? {
              ...row,
              uses_health_data: planUses || row.uses_health_data,
              record: { usesHealthData: planUses || row.uses_health_data, payload },
            }
          : row,
      ),
    };
    // Plan und Einkaufsliste (R2-S4, W22): zwei Funktionen, die Liste direkt danach. Scheitert sie, ist der Plan
    // gespeichert – die Liste wird beim nächsten Öffnen wieder an den Plan angepasst.
    if (listCheck?.ok === true) {
      try {
        next = await replaceShoppingListRemote(session.userId, listCheck.list, next);
      } catch (error) {
        await writeCache(session.userId, next);
        throw error;
      }
    }
    await writeCache(session.userId, next);
    return next;
  }

  /** Gesundheitsbezug eines eben gespeicherten Plans bzw. einer Liste (setzt der Server); im Zweifel `fallback`. */
  async function serverUsesHealthData(
    table: 'meal_plans' | 'shopping_lists',
    id: string,
    fallback: boolean,
  ): Promise<boolean> {
    const { data, error } = await client
      .from(table)
      .select('uses_health_data')
      .eq('id', id)
      .maybeSingle();
    return error || data === null ? fallback : data.uses_health_data;
  }

  async function replaceShoppingListRemote(
    userId: string,
    list: StoredShoppingList,
    rows: UserRows,
  ): Promise<UserRows> {
    let payload: ReturnType<typeof toShoppingListPayload>;
    try {
      payload = toShoppingListPayload(list);
    } catch {
      throw new BackendError('plan_rejected', { sensitive: true });
    }
    const saved = await client.rpc('replace_shopping_list', { p_list: toJson(payload) });
    if (saved.error) throw toMealPlanSaveError({ ...saved.error, status: saved.status });
    const listId = String(saved.data);
    const uses = await serverUsesHealthData('shopping_lists', listId, true);
    const next = applyShoppingListSave(rows, list, { id: listId, userId, now: options.now() });
    return {
      ...next,
      shoppingLists: next.shoppingLists.map((row) =>
        row.id === listId
          ? { ...row, id: listId, uses_health_data: uses || row.uses_health_data }
          : row,
      ),
    };
  }

  /**
   * Einkaufsliste speichern (Etappe N5b/N7 Teil 2): Ändern sich nur Häkchen, gehen sie direkt an die Spalte `checked`
   * (ohne Gesundheitsbezug offline über die Warteschlange); sonst `replace_shopping_list`.
   */
  async function saveShoppingListRemote(
    list: StoredShoppingList,
    rows: UserRows,
  ): Promise<UserRows> {
    const session = await requireSession();
    const versions = await requireVersions();
    const check = checkShoppingListSave(list, { today: today(), rows, versions });
    if (!check.ok) {
      throw new BackendError(
        check.reason === 'consent_required' ? 'consent_required' : 'plan_rejected',
        { sensitive: true },
      );
    }
    const stored = storedShoppingListRow(rows, check.list.weekStart);
    const changes = stored === null ? null : checkedOnlyChanges(stored.list, check.list);
    if (stored !== null && changes !== null) {
      if (changes.length === 0) return rows;
      // Liste mit Gesundheitsbezug: Häkchen in die verschlüsselte Ernährungs-Warteschlange (offline möglich, Lücke
      // „online_only“ geschlossen, docs/PLAN-EINKAUFEN-AUSDAUER.md 3); sonst wie bisher über die Warteschlange.
      if (stored.uses_health_data) {
        const now = options.now();
        for (const change of changes) {
          await enqueueNutrition(
            {
              kind: 'shopping_check',
              weekStart: stored.week_start,
              itemKey: change.itemKey,
              checked: change.checked,
              at: now,
            },
            session.userId,
          );
        }
        void nutritionQueue.flush().catch(() => 'later');
        const next = applyNutritionQueue(
          rows,
          changes.map((change) => ({
            key: '',
            op: {
              kind: 'shopping_check' as const,
              weekStart: stored.week_start,
              itemKey: change.itemKey,
              checked: change.checked,
              at: now,
            },
          })),
          { userId: session.userId, now },
        );
        await writeCache(session.userId, next);
        return next;
      }
      let next = rows;
      for (const change of changes) {
        next = await applyNutritionWriteOp(
          session.userId,
          {
            kind: 'set_shopping_item_checked',
            listId: stored.id,
            weekStart: stored.week_start,
            itemKey: change.itemKey,
            checked: change.checked,
            usesHealthData: stored.uses_health_data,
          },
          next,
        );
      }
      return next;
    }
    const next = await replaceShoppingListRemote(session.userId, check.list, rows);
    await writeCache(session.userId, next);
    return next;
  }

  /** Alles Lokale samt Schlüsseln löschen (Abmelden, Konto löschen, Testdaten löschen – 4.1). */
  async function clearLocal(): Promise<void> {
    // M2: laufendes Senden der Ernährung abwarten, dann leeren (die Generation verwirft späte Ergebnisse zusätzlich).
    nutritionQueue.setLocked(true);
    try {
      await nutritionQueue.idle();
      await clearLocalStores();
    } finally {
      nutritionQueue.setLocked(false);
    }
  }

  async function clearLocalStores(): Promise<void> {
    await queue.clear();
    await logQueue.clear();
    await drafts.clear();
    await store.removeItem(STORAGE_KEYS.rowsCache);
    await protectedStore.clear();
    await logCacheStore.clear();
    await nutritionQueue.clear();
    await nutritionCacheStore.clear();
    await routeQueue.clear();
    await recordingStore.clear();
    await wearableQueue.clear();
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
  async function revokeHealthData(
    deleteLogs: boolean,
    conversion: IntoleranceConversion | null,
  ): Promise<void> {
    const session = await requireSession();
    // Phase 8: Smartwatch-Abgleiche sind Gesundheitsdaten – vor dem Widerruf verwerfen (nie danach senden).
    await wearableQueue.discardAll();
    // 7.4 Schritt 1 (R2-K4): Gruppen der Unverträglichkeiten NUR bei Zustimmung einlesen – nur IDs, nur im
    // Arbeitsspeicher. Ohne Zustimmung wird nichts gelesen und nichts behalten.
    const dislikeGroups = conversion
      ? intoleranceGroupsForConversion(
          conversion.rows.foodPreferences.flatMap((row) => {
            const group = foodGroupSchema.safeParse(row.food_group);
            return group.success ? [{ foodGroup: group.data, kind: row.kind }] : [];
          }),
        )
      : [];
    logQueue.setLocked(true);
    // Wächter N7 Teil 2 M2: auch die Ernährungs-Warteschlange sperren und ein laufendes Senden abwarten – danach
    // leert der Widerruf sie (nichts kommt nachträglich zurück auf das Gerät).
    nutritionQueue.setLocked(true);
    try {
      await logQueue.idle();
      await nutritionQueue.idle();
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
      // Ebenso Ernährung (N7 Teil 2): Tagebuch, eigene Gerichte, Pläne/Listen mit Gesundheitsbezug, Schnell-Favoriten
      // löscht der Widerruf auf dem Server; noch nicht übertragene bzw. abgelehnte Fassungen sind Gesundheitsdaten und
      // würden ohne Einwilligung ohnehin abgelehnt – auf ausdrücklichen Widerruf hin gelöscht.
      await nutritionQueue.clear();
      await nutritionCacheStore.clear();
      // 7.4 Schritt 3 (S17): die Gruppen als „mag ich nicht“ schreiben („mag ich“ derselben Gruppe wird ersetzt). Kein
      // Gesundheitsdatum → über die Warteschlange: Bricht die Verbindung ab, bleibt die Umwandlung als wartender
      // Vorgang gespeichert („Umwandlung ausstehend“) und wird bei der nächsten Verbindung gesendet; die Anzeige (Stand +
      // Warteschlange, refreshRows) enthält die Ausschlüsse sofort.
      // Reihenfolge (Wächter N4 S1): ZUERST in die (gespeicherte) Warteschlange, dann der Zwischenspeicher – bricht die
      // App dazwischen ab, wird der Vorgang trotzdem gesendet. Im Zwischenspeicher ist health_data widerrufen.
      if (conversion && dislikeGroups.length > 0) {
        const now = options.now();
        const revoked: UserRows = {
          ...conversion.rows,
          consents: conversion.rows.consents.map((c) =>
            c.consent_type === 'health_data' && c.revoked_at === null
              ? { ...c, revoked_at: now }
              : c,
          ),
        };
        const next = applyHealthDataRevocation(revoked, { deleteLogs, dislikeGroups });
        const op: WriteOp = {
          kind: 'replace_food_preferences',
          scope: 'taste',
          rows: next.foodPreferences,
        };
        await queue.add([op]);
        await writeCache(session.userId, applyWriteOps(next, [op], displayContext()));
        void queue.flush();
      }
    } finally {
      logQueue.setLocked(false);
      nutritionQueue.setLocked(false);
    }
  }

  void queue.load();
  void logQueue.load();
  void nutritionQueue.load();
  return backend;
}

function asRows(logs: LogRows): UserRows {
  return { ...emptyUserRows(), ...logs };
}
