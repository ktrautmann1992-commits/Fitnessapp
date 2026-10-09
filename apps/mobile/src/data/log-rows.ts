/**
 * Trainingstagebuch als Zeilen: Die Abbildung (Eintrag ↔ Tabellen, Zeilen → Eingaben der Progression) liegt seit
 * Etappe A0 (docs/PLAN-PHASE-4B.md 5.1) in packages/core/src/log/rows.ts, damit App und Server dieselbe nutzen.
 * Diese Datei reicht sie nur weiter (bestehende Importe der App bleiben gültig); Speicher und Netz bleiben in der
 * App (local-backend.ts, supabase-backend.ts, write-ops.ts).
 */
export {
  type ApplyLogMeta,
  applySessionLog,
  closeMissedSessionRows,
  deleteHealthPlanLogRows,
  deleteSessionLogRows,
  detachLogs,
  EMPTY_LOG_ROWS,
  logEntriesFromRows,
  logForSession,
  type LogRows,
  logRowsOf,
  mergeLogRows,
  neutralizeHealthPlanLogRows,
  removeSessionLog,
  startWeightsFromRows,
} from '@fitnessapp/core';
