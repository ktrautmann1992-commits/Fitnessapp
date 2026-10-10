import type {
  ConsentType,
  DataExportFile,
  PreferenceChange,
  PlanLibrary,
  PlanSafetyRules,
  SavePlanPayload,
  SavePlanSession,
  SessionLogPayload,
} from '@fitnessapp/core';

import type { LogRows } from './log-rows';
import type { ConsentVersions } from './mapping';
import type {
  AuthSession,
  ConsentDocument,
  OnboardingAnswers,
  ReminderSettings,
  StepSave,
  UserRows,
} from './types';
import type { LogRejectReason, WorkoutDraft } from './workout-draft';

/**
 * Gemeinsame Schnittstelle der beiden Betriebsarten:
 * - local-backend.ts: Testmodus (ohne Supabase), alle Daten nur auf dem Gerät,
 * - supabase-backend.ts: echte Datenbank in Frankfurt mit Login per E-Mail-Code.
 * Die Bildschirme kennen nur diese Schnittstelle.
 */
export type BackendMode = 'local' | 'supabase';

export type SignIn =
  | { kind: 'test_mode'; start: () => Promise<AuthSession> }
  | {
      kind: 'email_code';
      requestCode: (email: string) => Promise<void>;
      verifyCode: (email: string, code: string) => Promise<AuthSession>;
    };

export interface SnapshotResult {
  rows: UserRows;
  /** true = Server nicht erreichbar, angezeigt wird der zwischengespeicherte Stand (ohne Gesundheitsdaten). */
  offline: boolean;
  /**
   * Nur offline: zuletzt wirksame Sicherheitsregeln aus dem geschützten Zwischenspeicher (Frage 14), damit strengere
   * Deckel auch ohne Netz greifen (die Gesundheits-Checks selbst liegen nie auf dem Gerät).
   */
  cachedSafetyRules?: PlanSafetyRules | null;
}

/** Einheit verschieben oder streichen (nur Datum und Status, wie der Datenbank-Trigger es erlaubt). */
export interface SessionUpdate {
  sessionId: string;
  planId: string;
  /** Plan mit Gesundheitsbezug → sofort senden, nie Warteschlange. */
  usesHealthData: boolean;
  scheduledOn: string;
  status: 'planned' | 'skipped';
}

/** Ereignisse aus dem Hintergrund (Warteschlange). */
export type BackendEvent =
  /** Eine wartende Verschiebung wurde vom Server abgelehnt und verworfen → Plan neu laden + Meldung. */
  | { kind: 'plan_change_dropped' }
  /** Ein Training wurde übertragen (neu laden). `orphaned` = Plan hatte sich geändert (B4). */
  | { kind: 'log_saved'; orphaned: boolean; key: string; writeId: string }
  /** Ein Training kam als Konflikt bzw. Ablehnung zurück – es liegt als Entwurf vor (4.3). */
  | { kind: 'log_conflict'; key: string; writeId: string }
  | { kind: 'log_rejected'; reason: LogRejectReason; key: string; writeId: string }
  /** Senden scheiterte an der abgelaufenen Sitzung – erneut anmelden, Einträge bleiben (R5). */
  | { kind: 'session_expired' };

/** Ergebnis von „Training speichern“ (docs/PLAN-PHASE-4.md 4.3, 6.3). */
export type LogSaveOutcome =
  /** Gespeichert; `orphaned` = Plan hatte sich geändert, Training trotzdem gespeichert (B4). */
  | { kind: 'saved'; orphaned: boolean }
  /** Offline bzw. noch nicht übertragen – liegt verschlüsselt in der Warteschlange. */
  | { kind: 'queued' }
  /** Auf einem anderen Gerät geändert – die eigene Fassung liegt als Entwurf vor (W3). */
  | { kind: 'conflict' }
  /** Abgelehnt – liegt als Entwurf vor (nie stilles Verwerfen). */
  | { kind: 'rejected'; reason: LogRejectReason };

/** Wartende Trainings (Abmelde-Nachfrage R6, Anzeige). */
export interface PendingWorkouts {
  /** In der Tagebuch-Warteschlange (noch nicht übertragen). */
  queued: number;
  /** Offene Entwürfe sowie abgelehnte und Konflikt-Fassungen. */
  drafts: number;
}

/** Online nachgeladene ältere Tagebuch-Einträge (Verlauf, Etappe D) – nur im Arbeitsspeicher, nie im Gerätespeicher. */
export interface OlderLogsPage {
  logs: LogRows;
  /** Für die nächste Seite: Einträge vor diesem Datum; null = keine älteren mehr. */
  nextBefore: string | null;
}

/**
 * Wo „Ab jetzt immer“ gewählt wurde (für die Prüfung canExclude im Testmodus, docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 9):
 * Einheit des aktiven Plans, gespeicherte Position und die Übungen, die dort gerade angezeigt werden.
 */
export interface PreferenceSwapContext {
  sessionId: string;
  storedOrderNo: number;
  inSession: readonly string[];
  /** Ort der Einheit nur geraten (4.4) – Ausschlüsse beider Orte zählen. */
  ambiguousLocation: boolean;
}

export interface Backend {
  readonly mode: BackendMode;
  /**
   * „Ab jetzt immer“ und „Ausgeschlossene Übungen“ (Etappe T2): Testmodus ja; Supabase-Modus erst mit Etappe T3
   * (Tabelle exercise_preferences) – bis dahin nur „Nur heute“, kein halbfertiger Zustand (8.2).
   */
  readonly supportsExercisePreferences: boolean;
  readonly signIn: SignIn;
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  /** Aktuelle Einwilligungstexte (terms, privacy, health_data). */
  loadConsentDocuments(): Promise<ConsentDocument[]>;
  /** Profil mit Geburtsdatum anlegen – Voraussetzung für Einwilligungen und alle weiteren Daten. */
  createProfile(birthDate: string): Promise<void>;
  loadRows(): Promise<SnapshotResult>;
  grantConsents(types: readonly ConsentType[], versions: ConsentVersions): Promise<void>;
  /** Widerruf aller aktiven Einwilligungen dieser Art; bei health_data werden alle Gesundheitsdaten gelöscht. */
  revokeConsent(type: ConsentType): Promise<void>;
  /** Speichert einen Onboarding-Schritt und liefert den neuen Stand (inkl. Fortschritt im Profil). */
  saveStep(save: StepSave, context: SaveContext): Promise<UserRows>;
  saveReminder(
    settings: ReminderSettings,
    nextDueOn: string | null,
    rows: UserRows,
  ): Promise<UserRows>;
  deleteAccount(): Promise<void>;
  /** Wartende Änderungen (nur Supabase-Modus, offline). */
  pendingChanges(): number;
  /** Wartende Änderungen senden; false = weiterhin offline. */
  flush(): Promise<boolean>;
  /** Testmodus: alles auf dem Gerät löschen. Supabase-Modus: lokale Zwischenspeicher löschen. */
  clearDeviceData(): Promise<void>;

  // --- Trainingsplan (Phase 3) ---------------------------------------------------------------------------
  /**
   * Inhalte für die Plan-Engine. Testmodus: gebündelte Entwürfe (allowDrafts nur hier); Supabase: nur
   * freigegebene Inhalte. `allowCached` = offline den zwischengespeicherten Stand (nur Übungen, für die Anzeige)
   * zulassen; null = nichts vorhanden.
   */
  loadPlanLibrary(options: { allowCached: boolean }): Promise<PlanLibrary | null>;
  /** Neuen Plan speichern (ersetzt den aktiven). Braucht Verbindung. Liefert den neuen Stand. */
  savePlan(payload: SavePlanPayload, rows: UserRows): Promise<UserRows>;
  /** Folgeblock anhängen. Braucht Verbindung. */
  appendPlanBlock(
    planId: string,
    usesHealthData: boolean,
    sessions: SavePlanSession[],
    rows: UserRows,
  ): Promise<UserRows>;
  /**
   * Einheit verschieben/streichen. Pläne ohne Gesundheitsbezug offline über die Warteschlange, mit
   * Gesundheitsbezug sofort (ohne Netz → Fehler „Erneut versuchen“).
   */
  updatePlannedSession(update: SessionUpdate, rows: UserRows): Promise<UserRows>;
  /** Hintergrund-Ereignisse abonnieren; Rückgabe = abbestellen. */
  subscribe(listener: (event: BackendEvent) => void): () => void;

  // --- Trainingstagebuch (Phase 4, Etappe C) --------------------------------------------------------------
  /** Entwürfe des angemeldeten Kontos (geschützter Entwurfs-Speicher). */
  loadDrafts(): Promise<WorkoutDraft[]>;
  /** Entwurf sofort sichern (jeder Tipp, 4.2). */
  saveDraft(draft: WorkoutDraft): Promise<void>;
  /** Entwurf verwerfen. */
  discardDraft(key: string): Promise<void>;
  /**
   * Training beenden: Testmodus speichert sofort lokal (gleiche Regeln wie save_session_log); Supabase legt die
   * Fassung in die verschlüsselte Tagebuch-Warteschlange und sendet sie, sobald möglich. Der Entwurf wird erst
   * entfernt, wenn die Fassung sicher in der Warteschlange bzw. gespeichert ist; Konflikt/Ablehnung → Entwurf.
   */
  submitWorkout(draft: WorkoutDraft, payload: SessionLogPayload): Promise<LogSaveOutcome>;
  /** Eintrag löschen (nur online, mit Revision, R4). */
  deleteSessionLog(id: string, baseRevision: number): Promise<'ok' | 'conflict'>;
  /**
   * Übungs-Präferenzen ändern (der Reihe nach, alles oder nichts): „Ab jetzt immer“ (`at` Pflicht – geprüft wie der
   * Tausch-Dialog mit canExclude), Rückgängig, „Wieder zulassen“. Entfernen braucht kein `at`. Fehler
   * `preference_rejected`. Supabase-Modus vor T3: nicht unterstützt (`supportsExercisePreferences`).
   */
  updateExercisePreferences(
    changes: readonly PreferenceChange[],
    at: PreferenceSwapContext | null,
    rows: UserRows,
  ): Promise<UserRows>;
  /** Eigenes Startgewicht (nur ohne Eintrag sinnvoll); null = entfernen. */
  setStartWeight(exerciseId: string, weightKg: number | null, rows: UserRows): Promise<UserRows>;
  /**
   * Widerruf health_data (R3): Senden der Tagebuch-Warteschlange sperren, Einträge aus Gesundheits-Plänen in
   * Warteschlange, Entwurf und Zwischenspeicher bereinigen (neutralisieren bzw. bei `deleteLogs` entfernen), dann
   * revoke_health_data(deleteLogs) in EINER Transaktion.
   */
  revokeHealthData(deleteLogs: boolean): Promise<void>;
  /** Wartende Trainings und Entwürfe (R6). */
  pendingWorkouts(): Promise<PendingWorkouts>;
  /** Planned-Session-IDs mit noch nicht übertragenem Training (Anzeige „wird übertragen“). */
  pendingLogSessionIds(): readonly string[];
  /** Liegen Einträge eines anderen Kontos auf dem Gerät (R5)? */
  hasForeignDeviceData(): Promise<boolean>;
  /** Einträge eines anderen Kontos löschen (nach Nachfrage). */
  discardForeignDeviceData(): Promise<void>;

  // --- Woche, Verlauf, Export (Phase 4, Etappe D) -----------------------------------------------------------
  /**
   * Ab diesem Datum liegt das Tagebuch VOLLSTÄNDIG auf dem Gerät (Supabase: die letzten LOG_CACHE_WEEKS Wochen);
   * null = alles (Testmodus). Ältere Einheiten aus recent_exercise_logs() sind unvollständig (nur einzelne Übungen).
   */
  logHistoryStart(): string | null;
  /** Ältere Einträge vor `before` nachladen (nur online, je bis zu 20 Einheiten; 4.5). */
  loadOlderLogs(before: string): Promise<OlderLogsPage>;
  /**
   * Datenexport (Recht auf Auskunft, 3.7): alle eigenen Zeilen aller Tabellen (export_my_data) plus Konto-E-Mail.
   * Nur online. Enthält Gesundheitsdaten – nie loggen, nie zwischenspeichern.
   */
  exportMyData(): Promise<DataExportFile>;
}

export interface SaveContext {
  /** Antworten vor diesem Schritt. */
  answers: OnboardingAnswers;
  rows: UserRows;
  versions: ConsentVersions;
}

export type BackendErrorCode =
  | 'network'
  | 'min_age'
  | 'consent_required'
  | 'not_signed_in'
  | 'profile_missing'
  | 'invalid_code'
  | 'rate_limited'
  /** Plan vom Server/den Regeln abgelehnt (z. B. Gesundheits-Check geändert, Tag belegt) → neu laden/erstellen. */
  | 'plan_rejected'
  /** Keine passende freigegebene Vorlage (no_template). */
  | 'no_template'
  /** Nur online möglich (Löschen, Export, Widerruf). */
  | 'online_only'
  /** Auf dem Gerät liegen noch nicht übertragene Trainings eines anderen Kontos (R5). */
  | 'foreign_data'
  /** Geschützter Gerätespeicher nicht beschreibbar (Browser: sessionStorage voll/gesperrt, K9). */
  | 'storage_unavailable'
  /**
   * Übungs-Präferenz abgelehnt (Etappe T2): keine gleichwertige Alternative mehr, Obergrenze erreicht oder die Auswahl
   * passt nicht mehr zum aktuellen Stand (gleiche Prüfung wie der Tausch-Dialog, canExclude).
   */
  | 'preference_rejected'
  /** Obergrenze EXERCISE_PREFERENCE_LIMITS.maxPerUser erreicht. */
  | 'preference_limit'
  | 'unknown';

/** Fehler mit festem Code – die Bildschirme zeigen dazu einen deutschen Text (i18n errors.*). */
export class BackendError extends Error {
  readonly code: BackendErrorCode;
  /** true = betraf Gesundheitsdaten (nicht auf dem Gerät zwischengespeichert). */
  readonly sensitive: boolean;

  constructor(code: BackendErrorCode, options: { sensitive?: boolean; cause?: unknown } = {}) {
    // Bewusst ohne Werte in der Meldung – keine Gesundheitsdaten in Fehlern oder Logs.
    super(`BackendError: ${code}`);
    this.name = 'BackendError';
    this.code = code;
    this.sensitive = options.sensitive ?? false;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function errorCode(error: unknown): BackendErrorCode {
  return error instanceof BackendError ? error.code : 'unknown';
}
