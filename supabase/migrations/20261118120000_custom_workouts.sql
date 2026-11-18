-- ---------------------------------------------------------------------------------------------------------
-- Eigene Workouts und Übungstausch in Workouts (Gründer-Wunsch 18.11.2026, docs/PLAN-EIGENE-WORKOUTS.md). NUR ADDITIV:
-- 1. custom_workouts   – eigene Workouts: Name + Bauanleitung (Eingaben und Tracks, customWorkoutDefinitionSchema).
-- 2. workout_variants  – persönliche Variante eines Bibliotheks-Workouts: nur die Täusche je Position
--                        (workoutVariantSchema). Ohne Fremdschlüssel auf workouts: eine neue Fassung des Workouts
--                        lässt die Variante stehen, die App wendet nur noch passende Täusche an.
-- 3. exercise_dislikes – „Mag ich nicht“ je Übung (eigene Workouts und Tausch-Kandidaten in Workouts).
-- RLS: nur eigene Zeilen (lesen, schreiben, löschen), kein Partner-Zugriff, nie öffentlich, kein Teilen. Schreiben
-- braucht ein Profil. Kein Gesundheitsdatum (Vorlieben ohne Grund, keine Körperdaten) → offline über die normale
-- Warteschlange der App, bleibt beim Widerruf der Gesundheits-Einwilligung bestehen. Konto löschen: Kaskade über
-- auth.users. Export: *_custom_workouts_export.sql. Die Regeln (Bauen, Tauschen, Dauer) rechnet packages/core – hier
-- nur Speicher und eine Form-Prüfung als zweite Grenze (die App prüft vorher mit Zod).
-- Grenzen = packages/core/src/constants.ts CUSTOM_WORKOUT_RULES (maxCustom 50, maxVariants 200, maxDislikes 300,
-- name 3–60) und WORKOUT_LIMITS (exercises 2–12, reps 3–30, workS 10–180 Flow/120, sets 1–6, restS 0–180).
-- ---------------------------------------------------------------------------------------------------------

-- Form-Prüfung einer Workout-Position (exercise_id, reps, duration_s, sets, rest_s, note_de, side).
create or replace function private.workout_item_shape_ok(p_item jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    return false;
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_item) k
    where k not in ('exercise_id', 'reps', 'duration_s', 'sets', 'rest_s', 'note_de', 'side')
  ) then
    return false;
  end if;
  return jsonb_typeof(p_item -> 'exercise_id') = 'string'
    and (p_item ->> 'exercise_id') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(p_item ->> 'exercise_id') between 3 and 80
    -- genau eines von Wiederholungen und Sekunden
    and ((jsonb_typeof(p_item -> 'reps') = 'number') <> (jsonb_typeof(p_item -> 'duration_s') = 'number'))
    and (jsonb_typeof(p_item -> 'reps') is distinct from 'number'
         or ((p_item ->> 'reps')::numeric between 3 and 30 and (p_item ->> 'reps')::numeric % 1 = 0))
    and (jsonb_typeof(p_item -> 'duration_s') is distinct from 'number'
         or ((p_item ->> 'duration_s')::numeric between 10 and 180 and (p_item ->> 'duration_s')::numeric % 1 = 0))
    and (jsonb_typeof(p_item -> 'sets') is distinct from 'number'
         or ((p_item ->> 'sets')::numeric between 1 and 6 and (p_item ->> 'sets')::numeric % 1 = 0))
    and jsonb_typeof(p_item -> 'rest_s') = 'number'
    and (p_item ->> 'rest_s')::numeric between 0 and 180;
end;
$$;
revoke all on function private.workout_item_shape_ok(jsonb) from public, anon;
-- Aufgerufen im Trigger (Rechte der schreibenden Person).
grant execute on function private.workout_item_shape_ok(jsonb) to authenticated, service_role;

-- Form-Prüfung der Bauanleitung (customWorkoutDefinitionSchema): version 1, Eingaben, 2–14 Tracks, 2–12 Übungen,
-- jede Übung höchstens einmal, höchstens 32 KB.
create or replace function private.custom_workout_definition_ok(p_def jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  track jsonb;
  item jsonb;
  total integer := 0;
  ids text[] := '{}';
begin
  if p_def is null or jsonb_typeof(p_def) <> 'object' or octet_length(p_def::text) > 32768 then
    return false;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_def) k) <> array['input', 'tracks', 'version']
     or p_def -> 'version' <> '1'::jsonb
     or jsonb_typeof(p_def -> 'input') <> 'object'
     -- sync: CUSTOM_WORKOUT_RULES.minutes
     or not coalesce((p_def -> 'input' -> 'minutes') in ('15', '20', '30', '45', '60'), false)
     or jsonb_typeof(p_def -> 'input' -> 'areas') <> 'array'
     or jsonb_array_length(p_def -> 'input' -> 'areas') not between 1 and 8
     or jsonb_typeof(p_def -> 'tracks') <> 'array'
     or jsonb_array_length(p_def -> 'tracks') not between 2 and 14 then
    return false;
  end if;
  for track in select value from jsonb_array_elements(p_def -> 'tracks') loop
    if jsonb_typeof(track) <> 'object'
       or jsonb_typeof(track -> 'kind') <> 'string'
       or (track ->> 'kind') not in ('warmup', 'area', 'cooldown')
       or jsonb_typeof(track -> 'items') <> 'array' then
      return false;
    end if;
    for item in select value from jsonb_array_elements(track -> 'items') loop
      if not private.workout_item_shape_ok(item) then
        return false;
      end if;
      total := total + 1;
      ids := ids || (item ->> 'exercise_id');
    end loop;
  end loop;
  return total between 2 and 12 and cardinality(ids) = (select count(distinct x) from unnest(ids) x);
exception
  when others then
    return false;
end;
$$;
revoke all on function private.custom_workout_definition_ok(jsonb) from public, anon;
-- Aufgerufen im Trigger (Rechte der schreibenden Person).
grant execute on function private.custom_workout_definition_ok(jsonb) to authenticated, service_role;

-- Form-Prüfung einer Variante (workoutVariantSchema): version 1, base_version, 1–12 Täusche {index, from, to}.
create or replace function private.workout_variant_definition_ok(p_def jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  swap jsonb;
  indexes integer[] := '{}';
begin
  if p_def is null or jsonb_typeof(p_def) <> 'object' or octet_length(p_def::text) > 8192 then
    return false;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_def) k) <> array['base_version', 'swaps', 'version']
     or p_def -> 'version' <> '1'::jsonb
     or jsonb_typeof(p_def -> 'base_version') <> 'number'
     or (p_def ->> 'base_version')::numeric not between 1 and 1000
     or jsonb_typeof(p_def -> 'swaps') <> 'array'
     or jsonb_array_length(p_def -> 'swaps') not between 1 and 12 then
    return false;
  end if;
  for swap in select value from jsonb_array_elements(p_def -> 'swaps') loop
    if jsonb_typeof(swap) <> 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(swap) k) <> array['from', 'index', 'to']
       or jsonb_typeof(swap -> 'index') <> 'number'
       or (swap ->> 'index')::numeric not between 0 and 11
       or (swap ->> 'index')::numeric % 1 <> 0
       or jsonb_typeof(swap -> 'from') <> 'string'
       or jsonb_typeof(swap -> 'to') <> 'string'
       or (swap ->> 'from') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or (swap ->> 'to') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or (swap ->> 'from') = (swap ->> 'to') then
      return false;
    end if;
    indexes := indexes || (swap ->> 'index')::integer;
  end loop;
  return cardinality(indexes) = (select count(distinct x) from unnest(indexes) x);
exception
  when others then
    return false;
end;
$$;
revoke all on function private.workout_variant_definition_ok(jsonb) from public, anon;
-- Aufgerufen im Trigger (Rechte der schreibenden Person).
grant execute on function private.workout_variant_definition_ok(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 1. Eigene Workouts
-- ---------------------------------------------------------------------------------------------------------
create table public.custom_workouts (
  -- Von der App erzeugt (offline-first, gleiche id = kein Doppel).
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- sync: CUSTOM_WORKOUT_RULES.name
  name text not null check (char_length(name) between 3 and 60 and name = btrim(name)),
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.custom_workouts is
  'Eigene Workouts (Name + Bauanleitung). Privat – nur eigene Zeilen, nie geteilt, nie aggregiert, nie Analytics/Logs.';

create index custom_workouts_user_idx on public.custom_workouts (user_id, updated_at);

alter table public.custom_workouts enable row level security;
revoke all on table public.custom_workouts from anon, authenticated;
grant select, insert, update, delete on table public.custom_workouts to authenticated;
grant all on table public.custom_workouts to service_role;

create policy "Nutzer sehen eigene Workouts"
  on public.custom_workouts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Workouts an (mit Profil)"
  on public.custom_workouts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );
create policy "Nutzer ändern eigene Workouts"
  on public.custom_workouts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Workouts"
  on public.custom_workouts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Form der Bauanleitung, Höchstzahl (nur NEUE Zeilen zählen), Besitzer bleibt, updated_at.
create or replace function private.custom_workouts_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: CUSTOM_WORKOUT_RULES.maxCustom
  max_entries constant integer := 50;
begin
  if not private.custom_workout_definition_ok(new.definition) then
    raise exception 'Ungültiges eigenes Workout.' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Besitzer nicht änderbar.' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT'
     and (select count(*) from public.custom_workouts c where c.user_id = new.user_id) >= max_entries then
    raise exception 'Zu viele eigene Workouts.' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.custom_workouts_before_write() from public;

create trigger custom_workouts_before_write
  before insert or update on public.custom_workouts
  for each row execute function private.custom_workouts_before_write();

-- ---------------------------------------------------------------------------------------------------------
-- 2. Persönliche Varianten von Bibliotheks-Workouts
-- ---------------------------------------------------------------------------------------------------------
create table public.workout_variants (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id text not null check (workout_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(workout_id) between 3 and 80),
  definition jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_id)
);

comment on table public.workout_variants is
  'Getauschte Übungen je Bibliotheks-Workout (persönliche Variante). Privat – nur eigene Zeilen, nie Analytics/Logs.';

alter table public.workout_variants enable row level security;
revoke all on table public.workout_variants from anon, authenticated;
grant select, insert, update, delete on table public.workout_variants to authenticated;
grant all on table public.workout_variants to service_role;

create policy "Nutzer sehen eigene Workout-Varianten"
  on public.workout_variants for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen Workout-Varianten an (mit Profil)"
  on public.workout_variants for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );
create policy "Nutzer ändern eigene Workout-Varianten"
  on public.workout_variants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Workout-Varianten"
  on public.workout_variants for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.workout_variants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: CUSTOM_WORKOUT_RULES.maxVariants
  max_entries constant integer := 200;
begin
  if not private.workout_variant_definition_ok(new.definition) then
    raise exception 'Ungültige Workout-Variante.' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT'
     and not exists (
       select 1 from public.workout_variants v where v.user_id = new.user_id and v.workout_id = new.workout_id
     )
     and (select count(*) from public.workout_variants v where v.user_id = new.user_id) >= max_entries then
    raise exception 'Zu viele Workout-Varianten.' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.workout_variants_before_write() from public;

create trigger workout_variants_before_write
  before insert or update on public.workout_variants
  for each row execute function private.workout_variants_before_write();

-- ---------------------------------------------------------------------------------------------------------
-- 3. „Mag ich nicht“ je Übung
-- ---------------------------------------------------------------------------------------------------------
create table public.exercise_dislikes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

comment on table public.exercise_dislikes is
  '„Mag ich nicht“ je Übung (eigene Workouts, Tausch in Workouts). Ohne Grund. Privat – nur eigene Zeilen.';

create index exercise_dislikes_exercise_id_idx on public.exercise_dislikes (exercise_id);

alter table public.exercise_dislikes enable row level security;
revoke all on table public.exercise_dislikes from anon, authenticated;
grant select, insert, delete on table public.exercise_dislikes to authenticated;
grant all on table public.exercise_dislikes to service_role;

create policy "Nutzer sehen eigene Abneigungen"
  on public.exercise_dislikes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer setzen Abneigungen (mit Profil)"
  on public.exercise_dislikes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );
create policy "Nutzer löschen eigene Abneigungen"
  on public.exercise_dislikes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.exercise_dislikes_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: CUSTOM_WORKOUT_RULES.maxDislikes
  max_entries constant integer := 300;
begin
  if (select count(*) from public.exercise_dislikes d where d.user_id = new.user_id) >= max_entries then
    raise exception 'Zu viele Übungen auf „Mag ich nicht“.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.exercise_dislikes_before_insert() from public;

create trigger exercise_dislikes_before_insert
  before insert on public.exercise_dislikes
  for each row execute function private.exercise_dislikes_before_insert();
