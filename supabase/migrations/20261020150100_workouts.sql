-- Workout-Bibliothek (docs/PLAN-WORKOUTS.md, Gründer-Wunsch 20.10.2026). Rein additiv:
-- 1. Tabelle public.workouts – Inhalt wie exercises/plan_templates: nur freigegebene bzw. zurückgezogene Workouts,
--    authenticated liest nur „published“, anon nichts, schreiben nur seed_workouts (service_role). Die Datei steht
--    unverändert in `data` (Prüfer-Namen neutralisiert, private.content_without_reviewer_names); Spalten für Filter und
--    Verweise werden daraus berechnet. expert_reviewed wie bei den Ernährungs-Inhalten (Testphase sichtbar machen).
-- 2. public.seed_workouts(p_content, p_require_expert_review) – eine Transaktion, idempotent, archivieren statt
--    löschen, Versionen sinken nie; nur freigegebene Übungen und Katalog-Geräte. Testphase wie
--    seed_nutrition_content: nur mit p_require_expert_review = false auch ohne Fachprüfung (content/einspiel-regeln.json).
-- 3. public.mark_session_log_workout(p_log_id) – setzt die Herkunft „workout“ an einer EIGENEN freien Kraft-Einheit
--    (nach save_session_log, das neue Einträge nur mit „manual“ annimmt). save_session_log und export_my_data bleiben
--    unverändert: Der Export enthält source über to_jsonb(session_logs) automatisch (pgTAP 60).
-- Grenzen = WORKOUT_LIMITS in packages/core/src/constants.ts (db-sync.test.ts).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------------------------------------------
create table public.workouts (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  title_de text not null check (char_length(title_de) between 3 and 60),
  category public.workout_category not null,
  -- Sterne 1–5 (WORKOUT_LIMITS.stars).
  difficulty smallint not null check (difficulty between 1 and 5),
  -- Dauer des Timers in Minuten (WORKOUT_LIMITS.minutes).
  minutes smallint not null check (minutes between 5 and 60),
  format public.workout_format not null,
  equipment_ids text[] not null default '{}' check (
    cardinality(equipment_ids) <= 8
    and array_position(equipment_ids, null) is null
    and private.has_distinct_elements(equipment_ids)
  ),
  -- Übungen in Reihenfolge (WORKOUT_LIMITS.exercises), jede höchstens einmal.
  exercise_ids text[] not null check (
    cardinality(exercise_ids) between 2 and 12
    and array_position(exercise_ids, null) is null
    and private.has_distinct_elements(exercise_ids)
  ),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  expert_reviewed boolean not null
    generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workouts is
  'Workout-Bibliothek (nur freigegebene/zurückgezogene). Quelle: content/workouts im Repository, eingespielt von '
  'seed_workouts. data = Datei (Prüfer-Namen neutralisiert).';
comment on column public.workouts.expert_reviewed is
  'Fachlich geprüft (data.meta.expert_reviewed). false nur in der Testphase – vor dem Livegang 0 Zeilen mit '
  'status = published und false.';

create index workouts_status_idx on public.workouts (status);

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function private.set_updated_at();

alter table public.workouts enable row level security;
revoke all on table public.workouts from anon, authenticated;
grant select on table public.workouts to authenticated;
grant all on table public.workouts to service_role;

create policy "Freigegebene Workouts sind für angemeldete Nutzer lesbar"
  on public.workouts for select to authenticated
  using (status = 'published');

-- ---------------------------------------------------------------------------------------------------------
-- 2. seed_workouts(p_content, p_require_expert_review) – nur service_role (Workflow content-seed)
-- p_content = { "workouts": [...] } im Format von content/workouts/*.json (packages/core/src/workouts/schema.ts).
-- Rückgabe: Anzahl eingespielter und archivierter Workouts. Fehlermeldungen enthalten nur Inhalts-IDs.
-- ---------------------------------------------------------------------------------------------------------
create function public.seed_workouts(p_content jsonb, p_require_expert_review boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  workout_ids text[];
  bad text;
  archived integer;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
    or jsonb_typeof(p_content -> 'workouts') is distinct from 'array'
    or exists (select 1 from jsonb_object_keys(p_content) as k where k <> 'workouts') then
    raise exception 'Ungültige Inhalte: erwartet {"workouts": [...]}.' using errcode = 'invalid_parameter_value';
  end if;

  -- Nie zwei Einspiel-Vorgänge gleichzeitig.
  perform pg_advisory_xact_lock(hashtext('public.seed_workouts'));

  select coalesce(x ->> 'id', '(ohne ID)') into bad
  from jsonb_array_elements(p_content -> 'workouts') as x
  where jsonb_typeof(x) is distinct from 'object' or x ->> 'status' is distinct from 'published'
  limit 1;
  if bad is not null then
    raise exception 'Nur freigegebene Inhalte dürfen eingespielt werden: %', bad
      using errcode = 'invalid_parameter_value';
  end if;

  workout_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'workouts') as x);
  if array_position(workout_ids, null) is not null then
    raise exception 'Inhalt ohne ID.' using errcode = 'invalid_parameter_value';
  end if;
  if not private.has_distinct_elements(workout_ids) then
    raise exception 'Doppelte Inhalts-ID.' using errcode = 'unique_violation';
  end if;

  -- Prüfvermerk: immer ein Wahrheitswert; ohne „fachlich geprüft“ nur in der Testphase (null zählt als true).
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'workouts') as x
  where jsonb_typeof(x -> 'meta' -> 'expert_reviewed') is distinct from 'boolean'
    or jsonb_typeof(x -> 'exercises') is distinct from 'array'
    or jsonb_typeof(x -> 'equipment_ids') is distinct from 'array'
  limit 1;
  if bad is not null then
    raise exception 'Workout % ist unvollständig (Prüfvermerk, Übungen oder Geräte).', bad
      using errcode = 'check_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'workouts') as x
  where coalesce(p_require_expert_review, true)
    and (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb
  limit 1;
  if bad is not null then
    raise exception 'Workout % ist nicht fachlich geprüft.', bad using errcode = 'check_violation';
  end if;

  -- Geräte im Katalog (Regel W3).
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'workouts') as x,
    jsonb_array_elements_text(x -> 'equipment_ids') as g
  where not exists (select 1 from public.equipment e where e.id = g)
  limit 1;
  if bad is not null then
    raise exception 'Workout % nennt ein Gerät, das es im Katalog nicht gibt.', bad
      using errcode = 'foreign_key_violation';
  end if;

  -- Nur freigegebene Übungen (Regel W2).
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'workouts') as x,
    jsonb_array_elements(x -> 'exercises') as item
  where not exists (
    select 1 from public.exercises e where e.id = item ->> 'exercise_id' and e.status = 'published'
  )
  limit 1;
  if bad is not null then
    raise exception 'Workout % enthält eine nicht freigegebene Übung.', bad
      using errcode = 'foreign_key_violation';
  end if;

  -- Versionen sinken nie.
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'workouts') as x
  join public.workouts old on old.id = x ->> 'id'
  where (x ->> 'version')::integer < old.version
  limit 1;
  if bad is not null then
    raise exception 'Version von % ist kleiner als in der Datenbank.', bad using errcode = 'check_violation';
  end if;

  insert into public.workouts as cur (
    id, version, status, title_de, category, difficulty, minutes, format, equipment_ids, exercise_ids, data
  )
  select
    x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'title_de',
    (x ->> 'category')::public.workout_category, (x ->> 'difficulty')::smallint, (x ->> 'minutes')::smallint,
    (x ->> 'format')::public.workout_format, private.jsonb_text_array(x -> 'equipment_ids'),
    array(select item ->> 'exercise_id' from jsonb_array_elements(x -> 'exercises') with ordinality as t(item, n)
          order by n),
    private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'workouts') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        title_de = excluded.title_de,
        category = excluded.category,
        difficulty = excluded.difficulty,
        minutes = excluded.minutes,
        format = excluded.format,
        equipment_ids = excluded.equipment_ids,
        exercise_ids = excluded.exercise_ids,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  update public.workouts set status = 'archived'
  where status = 'published' and not (id = any (workout_ids));
  get diagnostics archived = row_count;

  return jsonb_build_object('workouts', cardinality(workout_ids), 'archived', archived);
end;
$$;

revoke all on function public.seed_workouts(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.seed_workouts(jsonb, boolean) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. mark_session_log_workout(p_log_id) – Herkunft „workout“ an einer eigenen freien Kraft-Einheit
-- Antwort: {"result": "ok"}. Idempotent (schon „workout“ → ok). Fremde, fehlende, geplante oder Ausdauer-Einträge und
-- Einträge mit anderer Herkunft (z. B. GPS) → Fehler ohne Werte. Ändert nur source (keine Revision: kein Inhalt).
-- ---------------------------------------------------------------------------------------------------------
create function public.mark_session_log_workout(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing record;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select sl.id, sl.is_free, sl.kind, sl.source into existing
  from public.session_logs sl
  where sl.id = p_log_id and sl.user_id = current_user_id
  for update;
  if not found or not existing.is_free or existing.kind <> 'strength'
     or existing.source not in ('manual', 'workout') then
    raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
  end if;
  if existing.source = 'manual' then
    update public.session_logs set source = 'workout' where id = p_log_id and user_id = current_user_id;
  end if;
  return jsonb_build_object('result', 'ok');
end;
$$;

revoke all on function public.mark_session_log_workout(uuid) from public, anon;
grant execute on function public.mark_session_log_workout(uuid) to authenticated;
