-- Phase 2 · Inhalte einspielen: public.seed_content(p_content jsonb) (docs/PLAN-PHASE-2.md Abschnitt 5, Punkt 5).
--
-- Aufruf nur durch service_role (Workflow content-seed, Etappe B) – NICHT durch Nutzer.
-- - Eine Transaktion: Der Funktionsaufruf ist atomar – entweder alles oder nichts.
-- - Nur freigegebene Inhalte (status 'published'). Was bisher freigegeben war und nicht mehr mitkommt, wird auf
--   'archived' gesetzt (archivieren statt löschen – spätere Nutzerpläne können darauf verweisen).
-- - Idempotent: Zweimal dasselbe einspielen ergibt denselben Stand (unveränderte Zeilen werden nicht angefasst).
-- - Prüft zusätzlich zu content:validate: Vorlagen nur mit freigegebenen Übungen, keine Alternative auf sich
--   selbst, Alternativen mit gleichem Bewegungsmuster, Geräte im Katalog, Zuhause-Vorlagen ohne Studio-Geräte,
--   Versionen sinken nie.
--
-- p_content = { "exercises": [...], "plan_templates": [...] } im Format der Dateien unter content/
-- (packages/core/src/content/schemas.ts); jede Einheit einer Vorlage zusätzlich mit "estimated_minutes".
-- Rückgabe: Anzahl eingespielter und archivierter Inhalte. Fehlermeldungen enthalten nur Inhalts-IDs.

create or replace function public.seed_content(p_content jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  exercise_ids text[];
  template_ids text[];
  bad text;
  archived_exercises integer;
  archived_templates integer;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
    or jsonb_typeof(p_content -> 'exercises') is distinct from 'array'
    or jsonb_typeof(p_content -> 'plan_templates') is distinct from 'array' then
    raise exception 'Ungültige Inhalte: erwartet {"exercises": [...], "plan_templates": [...]}.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Nie zwei Einspiel-Vorgänge gleichzeitig.
  perform pg_advisory_xact_lock(hashtext('public.seed_content'));

  -- -------------------------------------------------------------------------------------------------------
  -- Eingaben prüfen
  -- -------------------------------------------------------------------------------------------------------
  select coalesce(x ->> 'id', '(ohne ID)') into bad
  from (
    select x from jsonb_array_elements(p_content -> 'exercises') as x
    union all
    select x from jsonb_array_elements(p_content -> 'plan_templates') as x
  ) as items
  where x ->> 'status' is distinct from 'published'
  limit 1;
  if bad is not null then
    raise exception 'Nur freigegebene Inhalte dürfen eingespielt werden: %', bad
      using errcode = 'invalid_parameter_value';
  end if;

  exercise_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'exercises') as x);
  template_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'plan_templates') as x);
  if not private.has_distinct_elements(exercise_ids) or not private.has_distinct_elements(template_ids) then
    raise exception 'Doppelte Inhalts-ID.' using errcode = 'unique_violation';
  end if;

  select g into bad
  from jsonb_array_elements(p_content -> 'exercises') as x,
    jsonb_array_elements_text(x -> 'equipment_ids') as g
  where not exists (select 1 from public.equipment e where e.id = g)
  union all
  select g
  from jsonb_array_elements(p_content -> 'plan_templates') as t,
    jsonb_array_elements_text(
      coalesce(t -> 'required_equipment_ids', '[]') || coalesce(t -> 'optional_equipment_ids', '[]')
    ) as g
  where not exists (select 1 from public.equipment e where e.id = g)
  limit 1;
  if bad is not null then
    raise exception 'Gerät nicht im Katalog: %', bad using errcode = 'foreign_key_violation';
  end if;

  select t ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'plan_templates') as t
  cross join lateral jsonb_array_elements_text(
    coalesce(t -> 'required_equipment_ids', '[]') || coalesce(t -> 'optional_equipment_ids', '[]')
  ) as g
  join public.equipment e on e.id = g
  where t ->> 'location' = 'home' and not e.home_selectable
  limit 1;
  if bad is not null then
    raise exception 'Zuhause-Vorlage mit Studio-Gerät: %', bad using errcode = 'check_violation';
  end if;

  select t ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'plan_templates') as t,
    jsonb_array_elements(t -> 'sessions') as s,
    jsonb_array_elements(s -> 'exercises') as te
  where not (te ->> 'exercise_id' = any (exercise_ids))
  limit 1;
  if bad is not null then
    raise exception 'Vorlage % enthält eine nicht freigegebene Übung.', bad
      using errcode = 'foreign_key_violation';
  end if;

  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'exercises') as x,
    jsonb_array_elements(coalesce(x -> 'alternatives', '[]')) as a
  where a ->> 'alternative_id' = x ->> 'id'
  limit 1;
  if bad is not null then
    raise exception 'Übung % ist als ihre eigene Alternative eingetragen.', bad
      using errcode = 'check_violation';
  end if;

  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'exercises') as x
  join public.exercises old on old.id = x ->> 'id'
  where (x ->> 'version')::integer < old.version
  union all
  select t ->> 'id'
  from jsonb_array_elements(p_content -> 'plan_templates') as t
  join public.plan_templates old on old.id = t ->> 'id'
  where (t ->> 'version')::integer < old.version
  limit 1;
  if bad is not null then
    raise exception 'Version von % ist kleiner als in der Datenbank.', bad
      using errcode = 'check_violation';
  end if;

  -- -------------------------------------------------------------------------------------------------------
  -- Übungen
  -- -------------------------------------------------------------------------------------------------------
  insert into public.exercises as cur (
    id, version, status, name_de, name_en, aliases_de, movement_pattern, primary_muscles,
    secondary_muscles, equipment_ids, mechanics, load_type, unilateral, difficulty, caution_tags,
    description_de, steps_de, tips_de, common_mistakes_de, safety_note_de, meta
  )
  select
    r.id, r.version, r.status, r.name_de, r.name_en, coalesce(r.aliases_de, '{}'), r.movement_pattern,
    r.primary_muscles, coalesce(r.secondary_muscles, '{}'), coalesce(r.equipment_ids, '{}'), r.mechanics,
    r.load_type, r.unilateral, r.difficulty, coalesce(r.caution_tags, '{}'), r.description_de, r.steps_de,
    r.tips_de, r.common_mistakes_de, r.safety_note_de, coalesce(r.meta, '{}')
  from jsonb_to_recordset(p_content -> 'exercises') as r(
    id text, version integer, status public.content_status, name_de text, name_en text,
    aliases_de text[], movement_pattern public.movement_pattern, primary_muscles public.muscle_group[],
    secondary_muscles public.muscle_group[], equipment_ids text[], mechanics public.exercise_mechanics,
    load_type public.load_type, unilateral boolean, difficulty smallint,
    caution_tags public.caution_tag[], description_de text, steps_de text[], tips_de text[],
    common_mistakes_de text[], safety_note_de text, meta jsonb
  )
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        name_de = excluded.name_de,
        name_en = excluded.name_en,
        aliases_de = excluded.aliases_de,
        movement_pattern = excluded.movement_pattern,
        primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles,
        equipment_ids = excluded.equipment_ids,
        mechanics = excluded.mechanics,
        load_type = excluded.load_type,
        unilateral = excluded.unilateral,
        difficulty = excluded.difficulty,
        caution_tags = excluded.caution_tags,
        description_de = excluded.description_de,
        steps_de = excluded.steps_de,
        tips_de = excluded.tips_de,
        common_mistakes_de = excluded.common_mistakes_de,
        safety_note_de = excluded.safety_note_de,
        meta = excluded.meta
    where (
      cur.version, cur.status, cur.name_de, cur.name_en, cur.aliases_de, cur.movement_pattern,
      cur.primary_muscles, cur.secondary_muscles, cur.equipment_ids, cur.mechanics, cur.load_type,
      cur.unilateral, cur.difficulty, cur.caution_tags, cur.description_de, cur.steps_de, cur.tips_de,
      cur.common_mistakes_de, cur.safety_note_de, cur.meta
    ) is distinct from (
      excluded.version, excluded.status, excluded.name_de, excluded.name_en, excluded.aliases_de,
      excluded.movement_pattern, excluded.primary_muscles, excluded.secondary_muscles,
      excluded.equipment_ids, excluded.mechanics, excluded.load_type, excluded.unilateral,
      excluded.difficulty, excluded.caution_tags, excluded.description_de, excluded.steps_de,
      excluded.tips_de, excluded.common_mistakes_de, excluded.safety_note_de, excluded.meta
    );

  update public.exercises
  set status = 'archived'
  where status = 'published' and not (id = any (exercise_ids));
  get diagnostics archived_exercises = row_count;

  -- Alternativen: gleiches Bewegungsmuster (Ziel muss existieren). Ziele, die noch Entwurf sind, fehlen in
  -- der Datenbank und werden übersprungen – sie kommen beim Einspielen nach ihrer Freigabe dazu.
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'exercises') as x
  cross join lateral jsonb_array_elements(coalesce(x -> 'alternatives', '[]')) as a
  join public.exercises target on target.id = a ->> 'alternative_id'
  where target.movement_pattern::text is distinct from x ->> 'movement_pattern'
  limit 1;
  if bad is not null then
    raise exception 'Übung % hat eine Alternative mit anderem Bewegungsmuster.', bad
      using errcode = 'check_violation';
  end if;

  delete from public.exercise_alternatives where exercise_id = any (exercise_ids);
  insert into public.exercise_alternatives (exercise_id, alternative_id, reason, priority)
  select x ->> 'id', a ->> 'alternative_id', (a ->> 'reason')::public.alternative_reason,
    (a ->> 'priority')::smallint
  from jsonb_array_elements(p_content -> 'exercises') as x,
    jsonb_array_elements(coalesce(x -> 'alternatives', '[]')) as a
  where a ->> 'alternative_id' = any (exercise_ids);

  -- -------------------------------------------------------------------------------------------------------
  -- Plan-Vorlagen mit Einheiten und Übungen
  -- -------------------------------------------------------------------------------------------------------
  insert into public.plan_templates as cur (
    id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
    minutes_min, minutes_max, location, required_equipment_ids, optional_equipment_ids, sex, meta
  )
  select
    r.id, r.version, r.status, r.title_de, r.description_de, r.goal_type, r.experience_level,
    r.sessions_per_week, r.minutes_min, r.minutes_max, r.location,
    coalesce(r.required_equipment_ids, '{}'), coalesce(r.optional_equipment_ids, '{}'), r.sex,
    coalesce(r.meta, '{}')
  from jsonb_to_recordset(p_content -> 'plan_templates') as r(
    id text, version integer, status public.content_status, title_de text, description_de text,
    goal_type public.goal_type, experience_level public.experience_level, sessions_per_week smallint,
    minutes_min smallint, minutes_max smallint, location public.equipment_location,
    required_equipment_ids text[], optional_equipment_ids text[], sex public.sex, meta jsonb
  )
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        title_de = excluded.title_de,
        description_de = excluded.description_de,
        goal_type = excluded.goal_type,
        experience_level = excluded.experience_level,
        sessions_per_week = excluded.sessions_per_week,
        minutes_min = excluded.minutes_min,
        minutes_max = excluded.minutes_max,
        location = excluded.location,
        required_equipment_ids = excluded.required_equipment_ids,
        optional_equipment_ids = excluded.optional_equipment_ids,
        sex = excluded.sex,
        meta = excluded.meta
    where (
      cur.version, cur.status, cur.title_de, cur.description_de, cur.goal_type, cur.experience_level,
      cur.sessions_per_week, cur.minutes_min, cur.minutes_max, cur.location, cur.required_equipment_ids,
      cur.optional_equipment_ids, cur.sex, cur.meta
    ) is distinct from (
      excluded.version, excluded.status, excluded.title_de, excluded.description_de, excluded.goal_type,
      excluded.experience_level, excluded.sessions_per_week, excluded.minutes_min, excluded.minutes_max,
      excluded.location, excluded.required_equipment_ids, excluded.optional_equipment_ids, excluded.sex,
      excluded.meta
    );

  update public.plan_templates
  set status = 'archived'
  where status = 'published' and not (id = any (template_ids));
  get diagnostics archived_templates = row_count;

  -- Einheiten und Übungen der eingespielten Vorlagen komplett ersetzen (stabile Schlüssel → gleicher Stand).
  delete from public.template_sessions where template_id = any (template_ids);

  insert into public.template_sessions (
    template_id, day_index, name_de, focus, estimated_minutes, warmup_de, cooldown_de
  )
  select t ->> 'id', s.day_index, s.name_de, s.focus, s.estimated_minutes, s.warmup_de, s.cooldown_de
  from jsonb_array_elements(p_content -> 'plan_templates') as t,
    jsonb_to_recordset(t -> 'sessions') as s(
      day_index smallint, name_de text, focus public.session_focus, estimated_minutes smallint,
      warmup_de text, cooldown_de text
    );

  insert into public.template_exercises (
    template_id, day_index, order_no, exercise_id, sets, reps_min, reps_max, duration_s, rest_s,
    rpe_target, superset_group, notes_de
  )
  select t ->> 'id', (s ->> 'day_index')::smallint, e.order_no, e.exercise_id, e.sets, e.reps_min,
    e.reps_max, e.duration_s, e.rest_s, e.rpe_target, e.superset_group, e.notes_de
  from jsonb_array_elements(p_content -> 'plan_templates') as t,
    jsonb_array_elements(t -> 'sessions') as s,
    jsonb_to_recordset(s -> 'exercises') as e(
      order_no smallint, exercise_id text, sets smallint, reps_min smallint, reps_max smallint,
      duration_s smallint, rest_s smallint, rpe_target numeric(3, 1), superset_group text, notes_de text
    );

  return jsonb_build_object(
    'exercises', cardinality(exercise_ids),
    'plan_templates', cardinality(template_ids),
    'archived_exercises', archived_exercises,
    'archived_plan_templates', archived_templates
  );
end;
$$;

revoke all on function public.seed_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_content(jsonb) to service_role;
