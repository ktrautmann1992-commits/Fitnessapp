-- Workout-Bibliothek (docs/PLAN-WORKOUTS.md) · Aufzählungen. Eigene Datei VOR 20261020150100_workouts.sql: Neue
-- Enum-Werte (`alter type … add value`) dürfen in derselben Transaktion nicht benutzt werden. Rein additiv.
-- Werte = packages/core (db-sync.test.ts): WORKOUT_CATEGORIES, WORKOUT_FORMATS (workouts/schema.ts), LOG_SOURCES (enums.ts).

-- Ziel/Kategorie eines Workouts (Liste und Filter).
create type public.workout_category as enum (
  'full_body', 'core', 'upper_body', 'legs_glutes', 'hiit_cardio', 'mobility', 'back_fit'
);

-- Ablauf: Zirkel mit Runden, Intervall nach Zeit, Sätze × Wiederholungen.
create type public.workout_format as enum ('circuit', 'interval', 'sets_reps');

-- Herkunft eines Tagebuch-Eintrags: freie Kraft-Einheit aus dem Workout-Timer. Setzt ausschließlich
-- mark_session_log_workout (nächste Migration) – save_session_log nimmt für NEUE Einträge weiter nur „manual“ an und
-- behält eine gespeicherte Herkunft beim Ändern.
alter type public.log_source add value 'workout';
