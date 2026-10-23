-- Phase 8 · Routen der Uhr (Gründer-Entscheidung 23.10.2026 „Routen lesen“, docs/PLAN-PHASE-8.md 14).
-- Eigene Datei VOR 20261023120100_wearable_routes.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben
-- Transaktion nicht benutzt werden. Wert = TRACKED_ROUTE_SOURCES in packages/core/src/enums.ts (db-sync.test.ts).
-- Rein additiv.

-- Herkunft einer Strecke: Route einer Uhr-Einheit aus Health Connect (schreibt NUR save_wearable_route).
alter type public.tracked_route_source add value 'watch';
