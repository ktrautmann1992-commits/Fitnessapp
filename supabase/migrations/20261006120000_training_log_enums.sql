-- Phase 4 Etappe B · Aufzählungen für das Trainingstagebuch (docs/PLAN-PHASE-4.md Abschnitt 3.2).
-- Eigene Datei VOR 20261006120100_training_logs.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben
-- Transaktion nicht benutzt werden. Werte = SESSION_LOG_STATUSES, EXERCISE_LOG_STATUSES, LOG_SOURCES und
-- PLANNED_SESSION_STATUSES in packages/core/src/enums.ts (db-sync.test.ts).

-- Status eines Eintrags: ganz oder teilweise geschafft.
create type public.session_log_status as enum ('completed', 'partial');

-- Status einer Übung im Eintrag: gemacht, nicht gemacht (bewusst OHNE Grund, S3), Alternative durchgeführt.
create type public.exercise_log_status as enum ('done', 'skipped', 'alternative');

-- Herkunft eines Eintrags; später `route` (Phase 10) und `wearable` (Phase 8).
create type public.log_source as enum ('manual');

-- Eingetragene Einheiten. Setzt NUR save_session_log (security definer); der Verschiebe-Trigger verbietet den Wert
-- für authenticated (W1, nächste Migration).
alter type public.planned_session_status add value 'completed';
