import {
  CYCLE_ERROR_CODES,
  type CycleEntry,
  type CycleErrorCode,
  type CycleExportTable,
  type CycleSettings,
} from '@fitnessapp/core';

import type { Backend } from './backend';
import type { ConsentRow } from './types';

/**
 * Zyklus-Modul in der App (docs/PLAN-PHASE-9.md ZY3/ZY4): eigene Schnittstelle NEBEN dem Backend, damit die großen
 * Backend-Dateien unberührt bleiben. Zwei Umsetzungen:
 * - cycle-local.ts: Testmodus – alles im geschützten Speicher `cycleCache` (Browser: nur sessionStorage),
 * - cycle-remote.ts: Supabase – Server-Funktionen (nur POST), Zwischenspeicher `cycleCache` (120 Tage) und
 *   Warteschlange `cycleQueue` mit Einwilligungszeitpunkt (S5).
 * `attachCycle` verbindet beides: Widerruf, Abmelden, Konto löschen und „Gerätedaten löschen“ leeren die
 * Zyklus-Speicher; beim Laden ohne aktive Einwilligung `cycle_data` ebenso (S5); der Datenexport bekommt die
 * Tabellen cycle_settings/cycle_entries. Nie Inhalte in Fehlern oder Logs.
 */

export interface CycleAccess {
  /** Supabase: Flag cycle_module an und Konto freigeschaltet; Testmodus: immer true. */
  readonly open: boolean;
  /** Flag cycle_warnings (aus → statischer Ratgeber). */
  readonly warnings: boolean;
}

export interface CycleSnapshot {
  readonly settings: CycleSettings | null;
  /** Einträge (Testmodus: alle; Supabase: bis 400 Tage, offline die letzten 120), nach Datum sortiert. */
  readonly entries: readonly CycleEntry[];
  /** Noch nicht gesendete Einträge (nur Supabase). */
  readonly pending: number;
  /** Server nicht erreichbar – Anzeige aus dem geschützten Zwischenspeicher. */
  readonly offline: boolean;
}

export type CycleSaveResult = 'saved' | 'queued';

export interface CycleTestMode {
  /** 90 Tage Beispieldaten mit Lücken (Plan 9.3). */
  loadSampleData(today: string): Promise<void>;
  /** Simuliert das Flag cycle_warnings (aus → Ratgeber). */
  setWarningsOff(off: boolean): Promise<void>;
}

export interface CycleBackend {
  readonly mode: 'local' | 'supabase';
  access(): Promise<CycleAccess>;
  load(today: string): Promise<CycleSnapshot>;
  /** Speichert sofort (Supabase offline: Warteschlange). `consentGrantedAt` = Zeitpunkt der gültigen Einwilligung. */
  saveEntry(entry: CycleEntry, consentGrantedAt: string, today: string): Promise<CycleSaveResult>;
  deleteEntry(date: string): Promise<void>;
  deleteAllEntries(): Promise<void>;
  saveSettings(settings: CycleSettings, consentGrantedAt: string): Promise<void>;
  /** Tabellen für die Export-Datei (leer, wenn es keine Zyklusdaten gibt). */
  exportTables(): Promise<Partial<Record<CycleExportTable, Record<string, unknown>[]>>>;
  /** Warteschlange senden (Supabase); Testmodus: nichts zu tun. */
  flush(): Promise<void>;
  /** Alle Zyklusdaten auf DIESEM Gerät löschen (Speicher und Schlüssel). */
  clearDevice(): Promise<void>;
  readonly testMode?: CycleTestMode;
}

/** Fehler des Zyklus-Moduls – nur ein fester Code, nie Inhalte. */
export class CycleError extends Error {
  constructor(readonly code: CycleErrorCode | 'network' | 'not_signed_in' | 'unknown') {
    super(`CycleError: ${code}`);
    this.name = 'CycleError';
  }
}

/** Fester Code aus einer Server-Fehlermeldung (nur bekannte Codes, sonst „unknown“). */
export function cycleErrorCode(message: string | undefined | null): CycleError['code'] {
  const text = message ?? '';
  for (const code of CYCLE_ERROR_CODES) if (text.includes(code)) return code;
  if (text.includes('cycle_not_signed_in')) return 'not_signed_in';
  if (/failed to fetch|fetch failed|network request failed|networkerror|load failed/i.test(text)) {
    return 'network';
  }
  return 'unknown';
}

/** Hat die Person eine (auch veraltete) aktive Einwilligung cycle_data? */
export function hasActiveCycleConsent(consents: readonly ConsentRow[]): boolean {
  return consents.some((row) => row.consent_type === 'cycle_data' && row.revoked_at === null);
}

/** Zeitpunkt der gültigen Einwilligung cycle_data (aktuelle Version) – für Speichern und Warteschlange (S5). */
export function validCycleConsentGrantedAt(
  consents: readonly ConsentRow[],
  currentVersion: number | null,
): string | null {
  if (currentVersion === null) return null;
  const rows = consents
    .filter(
      (row) =>
        row.consent_type === 'cycle_data' &&
        row.revoked_at === null &&
        row.version === currentVersion,
    )
    .sort((a, b) => b.granted_at.localeCompare(a.granted_at));
  return rows[0]?.granted_at ?? null;
}

// ---------------------------------------------------------------------------------------------------------
// Verbindung mit dem Backend (eine Stelle, create-backend.ts)
// ---------------------------------------------------------------------------------------------------------
const registry = new WeakMap<Backend, CycleBackend>();
const clearedListeners = new Set<() => void>();

/** Benachrichtigung, wenn die Zyklusdaten dieses Geräts gelöscht wurden (z. B. Arbeitsspeicher-Stand verwerfen). */
export function onCycleDeviceCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => clearedListeners.delete(listener);
}

/** Zyklus-Schnittstelle zu einem Backend (null = nicht verbunden, z. B. in Tests ohne Zyklus). */
export function cycleBackendFor(backend: Backend): CycleBackend | null {
  return registry.get(backend) ?? null;
}

/**
 * Verbindet die Zyklus-Schnittstelle mit dem Backend: Aufräumen bei Widerruf/Abmelden/Konto löschen/Gerätedaten
 * löschen, Abgleich beim Laden (S5) und Export. Gibt dasselbe Backend-Objekt zurück.
 */
export function attachCycle(backend: Backend, cycle: CycleBackend): Backend {
  registry.set(backend, cycle);
  const clear = async () => {
    await cycle.clearDevice().catch(() => undefined);
    for (const listener of clearedListeners) listener();
  };

  const revokeConsent = backend.revokeConsent.bind(backend);
  backend.revokeConsent = async (type) => {
    await revokeConsent(type);
    if (type === 'cycle_data') await clear();
  };
  const signOut = backend.signOut.bind(backend);
  backend.signOut = async () => {
    await clear();
    await signOut();
  };
  const deleteAccount = backend.deleteAccount.bind(backend);
  backend.deleteAccount = async () => {
    await deleteAccount();
    await clear();
  };
  const clearDeviceData = backend.clearDeviceData.bind(backend);
  backend.clearDeviceData = async () => {
    await clear();
    await clearDeviceData();
  };
  const loadRows = backend.loadRows.bind(backend);
  backend.loadRows = async () => {
    const result = await loadRows();
    // S5: Fehlt die Einwilligung (z. B. auf einem anderen Gerät widerrufen), leert die App Zwischenspeicher und
    // Warteschlange – nur mit frischem Stand vom Server, nie offline.
    if (!result.offline && !hasActiveCycleConsent(result.rows.consents)) await clear();
    return result;
  };
  const exportMyData = backend.exportMyData.bind(backend);
  backend.exportMyData = async () => {
    const file = await exportMyData();
    const tables = await cycle.exportTables();
    return { ...file, data: { ...file.data, ...tables } };
  };
  return backend;
}

/** Nach Datum sortiert, je Tag ein Eintrag (der spätere gewinnt). */
export function mergeEntries(
  base: readonly CycleEntry[],
  overrides: readonly CycleEntry[],
): CycleEntry[] {
  const byDate = new Map<string, CycleEntry>();
  for (const entry of base) byDate.set(entry.date, entry);
  for (const entry of overrides) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
