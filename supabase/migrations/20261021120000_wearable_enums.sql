-- Phase 8 · Etappe H2 · Smartwatch über Health Connect (docs/PLAN-PHASE-8.md 4 und 6, Gründer-Freigabe W8-1…W8-13).
-- Eigene Datei VOR 20261021120100_wearables.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben
-- Transaktion nicht benutzt werden. Werte = CONSENT_TYPES, LOG_SOURCES, WEARABLE_PROVIDERS und
-- WEARABLE_CONNECTION_STATUSES in packages/core/src/enums.ts (db-sync.test.ts). Rein additiv.

-- Eigene, getrennte Einwilligung „Smartwatch-Daten“ (W8-5); setzt zusätzlich health_data voraus.
alter type public.consent_type add value 'wearable_data';

-- Herkunft eines Tagebuch-Eintrags: aus Health Connect übernommen (setzt nur import_wearable_batch).
alter type public.log_source add value 'health_connect';

-- Datenquelle einer Verbindung (Etappe 1 nur Health Connect auf Android).
create type public.wearable_provider as enum ('health_connect');

-- Stand einer Verbindung: verbunden bzw. in Health Connect alle Rechte entzogen („Zugriff fehlt“).
create type public.wearable_connection_status as enum ('connected', 'permission_missing');
