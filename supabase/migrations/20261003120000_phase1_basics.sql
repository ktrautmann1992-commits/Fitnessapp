-- Phase 1 · Grundlagen: Hilfsschema, Hilfsfunktionen und Aufzählungstypen (Enums).
--
-- Regeln (CLAUDE.md / docs/PLAN-PHASE-1.md):
-- - RLS auf jeder Tabelle mit Nutzerdaten, Fachgrenzen identisch zu packages/core/src/constants.ts.
-- - Keine Gesundheitsdaten in Fehlermeldungen oder Logs (RAISE-Texte bleiben allgemein).
-- - Die Werte der Enums müssen zu packages/core passen (siehe dort *.test.ts).

-- Hilfsfunktionen, die NICHT über die API (PostgREST) erreichbar sein sollen, liegen im Schema „private“.
-- Das Schema ist nicht in supabase/config.toml → [api].schemas eingetragen und damit nicht öffentlich.
create schema if not exists private;
revoke all on schema private from public;
-- authenticated braucht USAGE, weil CHECK-Bedingungen (z. B. private.has_distinct_elements) beim
-- Einfügen mit den Rechten der aufrufenden Rolle ausgewertet werden.
grant usage on schema private to authenticated, service_role;

-- Setzt updated_at bei jeder Änderung automatisch.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- true, wenn ein Array keine doppelten Einträge enthält (für CHECK-Bedingungen).
create or replace function private.has_distinct_elements(values_ anyarray)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select count(*) = count(distinct v) from unnest(values_) as t(v);
$$;
revoke all on function private.has_distinct_elements(anyarray) from public;
grant execute on function private.has_distinct_elements(anyarray) to authenticated, service_role;

-- Aufzählungstypen. Spiegelung in packages/core (sex.ts, consent.ts, validation.ts).
create type public.sex as enum ('male', 'female', 'diverse', 'unspecified');
create type public.experience_level as enum ('beginner', 'advanced', 'competitive');
create type public.app_locale as enum ('de-DE', 'de-AT', 'de-CH');
create type public.consent_type as enum ('terms', 'privacy', 'health_data', 'cycle_data');
create type public.consent_platform as enum ('ios', 'android', 'web');
create type public.goal_type as enum (
  'fat_loss',
  'definition',
  'muscle_gain',
  'general_fitness',
  'endurance'
);
create type public.endurance_discipline as enum (
  '5k',
  '10k',
  'half_marathon',
  'marathon',
  'triathlon_sprint',
  'triathlon_olympic',
  'triathlon_middle',
  'triathlon_long',
  'cycling',
  'swimming'
);
create type public.training_location as enum ('gym', 'home', 'both');
create type public.equipment_location as enum ('home', 'gym');
create type public.equipment_category as enum (
  'free_weights',
  'bench',
  'bodyweight',
  'bands',
  'cardio',
  'other'
);
create type public.diet_type as enum ('omnivore', 'vegetarian', 'vegan');
create type public.cooking_mode as enum ('daily', 'meal_prep');
create type public.food_preference_kind as enum ('like', 'dislike', 'intolerance');
