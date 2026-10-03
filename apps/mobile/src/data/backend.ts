import type { ConsentType } from '@fitnessapp/core';

import type { ConsentVersions } from './mapping';
import type {
  AuthSession,
  ConsentDocument,
  OnboardingAnswers,
  ReminderSettings,
  StepSave,
  UserRows,
} from './types';

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
}

export interface Backend {
  readonly mode: BackendMode;
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
