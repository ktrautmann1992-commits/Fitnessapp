-- Etappe B3 · Aufzählungen für Ausdauer-Einheiten (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitt 4.4 Punkte 1 und 6).
-- Eigene Datei VOR 20261005130100_plan_session_kinds.sql: Neue Enum-Werte (`alter type … add value`) dürfen in
-- derselben Transaktion nicht benutzt werden. Werte = PLANNED_SESSION_KINDS, ENDURANCE_MODALITIES und PLAN_NOTES in
-- packages/core/src/enums.ts (db-sync.test.ts).

-- Art einer geplanten Einheit.
create type public.planned_session_kind as enum ('strength', 'endurance');

-- Modalität einer Ausdauer-Einheit; Schwimmen nur mit Dauer und Anstrengung, ohne Technik (Frage 3).
create type public.endurance_modality as enum ('run', 'walk', 'bike', 'swim');

-- Neue Hinweis-Codes (Abschnitt 5.8), bewusst ohne Gesundheitsbezug.
alter type public.plan_note add value 'endurance_days_capped';
alter type public.plan_note add value 'endurance_volume_ramped';
alter type public.plan_note add value 'endurance_walk';
alter type public.plan_note add value 'rest_day_added';
alter type public.plan_note add value 'week_total_capped';
alter type public.plan_note add value 'endurance_basic_only';
