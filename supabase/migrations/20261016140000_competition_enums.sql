-- Phase 10 · Etappe WP3 · Aufzählungen für Wettkampf und Wettkampfplan (docs/PLAN-PHASE-10.md Abschnitt 7).
-- Eigene Datei VOR 20261016140100_competitions.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben
-- Transaktion nicht benutzt werden. Rein additiv. Werte = packages/core (db-sync.test.ts):
-- COMPETITION_DISCIPLINES, COMPETITION_GOALS, COMPETITION_STATUSES (plan/competition-schema.ts),
-- ENDURANCE_START_GROUPS (plan/safety.ts), WORKOUT_TYPES (plan/intensity.ts), COMPETITION_PHASES und LOG_SOURCES.

-- Disziplinen mit Wettkampfplan (W-G2: zuerst Laufen 5 km bis Marathon; Rad/Triathlon kommen mit WP5 per add value).
create type public.competition_discipline as enum ('5k', '10k', 'half_marathon', 'marathon');

-- Ziel „Ankommen“ (Standard, W-G6) oder Zielzeit (nur mit Referenzzeit).
create type public.competition_goal as enum ('finish', 'time');

-- Stand: geplant (höchstens einer je Person, W-G9), erledigt, abgesagt.
create type public.competition_status as enum ('planned', 'done', 'cancelled');

-- Startgruppe Ausdauer des bisherigen Plans im Tagebuch-Bezug (Wächter H1 zu WP1).
create type public.endurance_start_group as enum ('cautious', 'beginner', 'advanced', 'competitive');

-- Einheiten-Arten (Plan 3.4); harte Arten: fartlek, tempo, intervals, race_pace (HARD_WORKOUT_TYPES).
create type public.workout_type as enum (
  'easy', 'recovery', 'long', 'strides', 'fartlek', 'tempo', 'intervals', 'race_pace'
);

-- Phase der Woche im Wettkampfplan (Plan 3.1, macroCycle).
create type public.training_phase as enum ('base', 'build', 'peak', 'taper', 'race_week', 'recovery');

-- Herkunft eines Tagebuch-Eintrags: vorbereitet für GPS-Aufzeichnung (S1) und GPX-Import (S2a). Noch von keiner App
-- geschrieben; save_session_log nimmt jeden Wert des Enums an (die Strecken-Etappen prüfen ihn dann genauer).
alter type public.log_source add value 'gps';
alter type public.log_source add value 'gpx_import';
