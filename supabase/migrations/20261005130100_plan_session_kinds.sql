-- Etappe B3 · Pläne mit Art je Einheit: Kraft oder Ausdauer (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitt 4.4).
-- Etappe-B-Migrationen bleiben unverändert; Funktionen per `create or replace` (Signaturen gleich).
-- 1. planned_sessions: kind, endurance_modality, effort_target; focus/template_day_index nur bei Kraft,
-- 2. user_plans: Vorlage nullable (nur reine Ausdauer-Pläne), alle drei Angaben oder keine,
-- 3. private.insert_plan_sessions: neue Felder, Ausdauer ohne Übungen,
-- 4. save_training_plan / append_plan_block: ohne Vorlage keine Kraft-Einheit,
-- 5. private.assert_plan_inputs: Angaben-Format der Engine-Version 2 (schedule, verschachtelt geprüft).
-- Der Verschiebe-Trigger private.planned_sessions_before_update bleibt unverändert (Punkt 7); neue Spalten sind
-- für authenticated ohnehin nicht änderbar (Spalten-Recht nur auf scheduled_on und status).

-- ---------------------------------------------------------------------------------------------------------
-- 1. planned_sessions
-- ---------------------------------------------------------------------------------------------------------
alter table public.planned_sessions
  -- Bestehende Zeilen = Kraft.
  add column kind public.planned_session_kind not null default 'strength',
  add column endurance_modality public.endurance_modality,
  -- Anstrengung (Borg-CR10, Gesprächstest): in Phase 3 nur LOCKER, also höchstens 4 von 10
  -- (ENDURANCE_EFFORT_LIMITS = ENDURANCE_EFFORT.easyMax in packages/core); Phase 10 erweitert das.
  add column effort_target smallint check (effort_target between 1 and 4),
  alter column focus drop not null,
  alter column template_day_index drop not null,
  add constraint planned_sessions_kind_fields check (
    (kind = 'strength'
      and focus is not null and template_day_index is not null
      and endurance_modality is null and effort_target is null)
    or (kind = 'endurance'
      and focus is null and template_day_index is null
      and endurance_modality is not null and effort_target is not null
      -- Dauer wie ein Trainingstag (TRAINING_LIMITS.minutesPerSession).
      and estimated_minutes between 10 and 240)
  );

comment on column public.planned_sessions.kind is
  'strength = Kraft (Vorlagen-Einheit, Übungen); endurance = lockere Ausdauer (Dauer + Anstrengung, keine Übungen).';

-- ---------------------------------------------------------------------------------------------------------
-- 2. user_plans: Vorlage nur bei Plänen mit Kraft-Einheiten
-- ---------------------------------------------------------------------------------------------------------
alter table public.user_plans
  alter column template_id drop not null,
  alter column template_title_de drop not null,
  alter column template_version drop not null,
  add constraint user_plans_template_all_or_none check (
    (template_id is null) = (template_title_de is null)
    and (template_id is null) = (template_version is null)
  );

-- ---------------------------------------------------------------------------------------------------------
-- 3.–5. Funktionen
-- ---------------------------------------------------------------------------------------------------------
-- Angaben (user_plans.inputs) wie savePlanInputsSchema in packages/core/src/plan/payload.ts (Engine-Version 2,
-- Erweiterungsplan 4.4 Punkt 5): alle Felder vorhanden, VERSCHACHTELT geprüft – `schedule` genau mit `mode` und
-- `slots`; `slots` 1–7 Objekte mit genau den erlaubten Schlüsseln (`weekday` nur bei `fixed`, eindeutig 1–7; `kind`
-- aus training_slot_kind; `minutes` 10–240 ganzzahlig); `trainingLocation` darf null sein (nur Ausdauer);
-- `homeEquipment[]` mit `equipmentId`, `weightsKg`, `barKg` (5–25, nur Langhantel). Größe: CHECK auf user_plans.inputs.
create or replace function private.assert_plan_inputs(p_inputs jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  input_keys constant text[] := array[
    'goalType', 'discipline', 'experienceLevel', 'schedule', 'trainingLocation', 'homeEquipment'
  ];
  schedule_keys constant text[] := array['mode', 'slots'];
  fixed_slot_keys constant text[] := array['weekday', 'kind', 'minutes'];
  flex_slot_keys constant text[] := array['kind', 'minutes'];
  equipment_keys constant text[] := array['equipmentId', 'weightsKg', 'barKg'];
  schedule jsonb;
  slot_keys text[];
  item jsonb;
begin
  perform private.assert_json_keys(p_inputs, input_keys, 'Angaben');
  if not (p_inputs ?& input_keys)
     or ((p_inputs ->> 'goalType') = any (enum_range(null::public.goal_type)::text[])) is not true
     or (jsonb_typeof(p_inputs -> 'discipline') <> 'null'
         and ((p_inputs ->> 'discipline') = any (enum_range(null::public.endurance_discipline)::text[])) is not true)
     or ((p_inputs ->> 'experienceLevel') = any (enum_range(null::public.experience_level)::text[])) is not true
     or (jsonb_typeof(p_inputs -> 'trainingLocation') <> 'null'
         and ((p_inputs ->> 'trainingLocation') = any (enum_range(null::public.training_location)::text[])) is not true) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;

  -- Zeitplan: fest (mit Wochentag) oder „Tage egal“ (ohne), 1–7 Einträge.
  schedule := p_inputs -> 'schedule';
  perform private.assert_json_keys(schedule, schedule_keys, 'Zeitplan');
  if not (schedule ?& schedule_keys)
     or (schedule ->> 'mode') is null
     or (schedule ->> 'mode') not in ('fixed', 'flex')
     or jsonb_typeof(schedule -> 'slots') <> 'array' then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(schedule -> 'slots') not between 1 and 7 then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;
  slot_keys := case when schedule ->> 'mode' = 'fixed' then fixed_slot_keys else flex_slot_keys end;
  for item in select value from jsonb_array_elements(schedule -> 'slots') loop
    perform private.assert_json_keys(item, slot_keys, 'Trainingstag');
    if not (item ?& slot_keys)
       or ((item ->> 'kind') = any (enum_range(null::public.training_slot_kind)::text[])) is not true
       or not private.jsonb_number_between(item -> 'minutes', 10, 240, 0)
       or (schedule ->> 'mode' = 'fixed' and not private.jsonb_number_between(item -> 'weekday', 1, 7, 0)) then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if schedule ->> 'mode' = 'fixed' and (
    select count(distinct s -> 'weekday') <> count(*) from jsonb_array_elements(schedule -> 'slots') s
  ) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;

  -- Geräte zu Hause: je Gerät genau equipmentId (aus dem Katalog), weightsKg (höchstens 40 Stufen,
  -- 0,25–200 kg, höchstens 2 Nachkommastellen) und barKg (null oder 5–25 kg, nur Langhantel); jedes Gerät nur einmal.
  if jsonb_typeof(p_inputs -> 'homeEquipment') <> 'array' then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;
  for item in select value from jsonb_array_elements(p_inputs -> 'homeEquipment') loop
    perform private.assert_json_keys(item, equipment_keys, 'Geräte');
    if not (item ?& equipment_keys)
       or jsonb_typeof(item -> 'equipmentId') <> 'string'
       or not exists (select 1 from public.equipment eq where eq.id = item ->> 'equipmentId')
       or jsonb_typeof(item -> 'weightsKg') <> 'array'
       or (jsonb_typeof(item -> 'barKg') <> 'null'
           and (item ->> 'equipmentId' <> 'barbell' or not private.jsonb_number_between(item -> 'barKg', 5, 25, 2))) then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_array_length(item -> 'weightsKg') > 40
       or exists (
         select 1 from jsonb_array_elements(item -> 'weightsKg') w
         where not private.jsonb_number_between(w, 0.25, 200, 2)
       ) then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
    -- Langhantel: Scheiben je Paar höchstens 25 kg (wie der CHECK auf user_equipment, BARBELL_PLATE_MAX_KG).
    if item ->> 'equipmentId' = 'barbell'
       and exists (select 1 from jsonb_array_elements(item -> 'weightsKg') w where w::numeric > 25) then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (
    select count(distinct x ->> 'equipmentId') <> count(*)
    from jsonb_array_elements(p_inputs -> 'homeEquipment') x
  ) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

revoke all on function private.assert_plan_inputs(jsonb) from public;

create or replace function private.insert_plan_sessions(
  p_plan_id uuid,
  p_user_id uuid,
  p_sessions jsonb,
  p_block_no integer,
  p_earliest date,
  p_latest date
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  session_keys constant text[] := array[
    'block_no', 'week_no', 'is_intro_week', 'is_deload', 'kind', 'template_day_index', 'scheduled_on', 'name_de',
    'focus', 'endurance_modality', 'effort_target', 'estimated_minutes', 'warmup_de', 'cooldown_de', 'exercises'
  ];
  exercise_keys constant text[] := array[
    'order_no', 'exercise_id', 'source_exercise_id', 'exercise_name_de', 'sets', 'reps_min', 'reps_max',
    'duration_s', 'rest_s', 'rpe_target', 'superset_group', 'notes_de', 'target_weight_kg'
  ];
  s jsonb;
  e jsonb;
  scheduled date;
  new_session_id uuid;
begin
  if jsonb_typeof(p_sessions) is distinct from 'array'
     or jsonb_array_length(p_sessions) not between 1 and 49 then
    raise exception 'Ungültige Einheiten.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    for s in select value from jsonb_array_elements(p_sessions) loop
      perform private.assert_json_keys(s, session_keys, 'Einheit');
      if (s ->> 'block_no')::integer is distinct from p_block_no then
        raise exception 'Falsche Block-Nummer.' using errcode = 'invalid_parameter_value';
      end if;
      scheduled := (s ->> 'scheduled_on')::date;
      if scheduled is null or scheduled < p_earliest or scheduled > p_latest then
        raise exception 'Einheiten liegen außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;
      if p_block_no > 1
         and ((s ->> 'week_no')::integer < 1 or (s ->> 'is_intro_week')::boolean) is not false then
        raise exception 'Ein Folgeblock hat keine Woche 0 und keine Einstiegswoche.'
          using errcode = 'invalid_parameter_value';
      end if;
      -- Kraft: 1–8 Übungen; Ausdauer: keine Übungen (Dauer + Anstrengung, Erweiterungsplan 4.4 Punkt 3).
      if jsonb_typeof(s -> 'exercises') is distinct from 'array'
         or (s ->> 'kind') is null
         or (case when s ->> 'kind' = 'endurance'
               then jsonb_array_length(s -> 'exercises') <> 0
               else jsonb_array_length(s -> 'exercises') not between 1 and 8
             end) then
        raise exception 'Ungültige Übungen.' using errcode = 'invalid_parameter_value';
      end if;

      insert into public.planned_sessions (
        plan_id, user_id, block_no, week_no, is_intro_week, is_deload, kind, template_day_index, scheduled_on,
        name_de, focus, endurance_modality, effort_target, estimated_minutes, warmup_de, cooldown_de
      )
      values (
        p_plan_id, p_user_id, p_block_no, (s ->> 'week_no')::smallint, (s ->> 'is_intro_week')::boolean,
        (s ->> 'is_deload')::boolean, (s ->> 'kind')::public.planned_session_kind,
        (s ->> 'template_day_index')::smallint, scheduled,
        s ->> 'name_de', (s ->> 'focus')::public.session_focus,
        (s ->> 'endurance_modality')::public.endurance_modality, (s ->> 'effort_target')::smallint,
        (s ->> 'estimated_minutes')::smallint, s ->> 'warmup_de', s ->> 'cooldown_de'
      )
      returning id into new_session_id;

      for e in select value from jsonb_array_elements(s -> 'exercises') loop
        perform private.assert_json_keys(e, exercise_keys, 'Übung');
        if not exists (
          select 1 from public.exercises x where x.id = e ->> 'exercise_id' and x.status = 'published'
        ) or not exists (
          select 1 from public.exercises x where x.id = e ->> 'source_exercise_id' and x.status = 'published'
        ) then
          raise exception 'Übung nicht freigegeben.' using errcode = 'invalid_parameter_value';
        end if;
        -- RPE in 0,5er-Schritten und Zielgewicht mit höchstens 2 Nachkommastellen – VOR der Spaltenrundung.
        if (e ->> 'rpe_target')::numeric * 2 <> trunc((e ->> 'rpe_target')::numeric * 2)
           or (e ->> 'target_weight_kg')::numeric <> round((e ->> 'target_weight_kg')::numeric, 2) then
          raise exception 'Ungültige Werte im Plan.' using errcode = 'check_violation';
        end if;
        insert into public.planned_exercises (
          session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min,
          reps_max, duration_s, rest_s, rpe_target, superset_group, notes_de, target_weight_kg
        )
        values (
          new_session_id, p_user_id, (e ->> 'order_no')::smallint, e ->> 'exercise_id', e ->> 'source_exercise_id',
          e ->> 'exercise_name_de', (e ->> 'sets')::smallint, (e ->> 'reps_min')::smallint,
          (e ->> 'reps_max')::smallint, (e ->> 'duration_s')::smallint, (e ->> 'rest_s')::smallint,
          (e ->> 'rpe_target')::numeric, e ->> 'superset_group', e ->> 'notes_de', (e ->> 'target_weight_kg')::numeric
        );
      end loop;
    end loop;
  exception
    -- Ohne „Failing row contains (…)“/Schlüsselwerte nach außen (kein Gesundheitsbezug in Client und Log).
    when check_violation or unique_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Werte im Plan.' using errcode = sqlstate;
  end;
end;
$$;

revoke all on function private.insert_plan_sessions(uuid, uuid, jsonb, integer, date, date) from public;

create or replace function public.save_training_plan(p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_keys constant text[] := array[
    'template_id', 'template_title_de', 'template_version', 'engine_version', 'match_quality', 'notes',
    'uses_health_data', 'medical_notice', 'inputs', 'start_date', 'sessions'
  ];
  -- sync: PLAN_SAVE_LIMITS in packages/core/src/constants.ts
  past_tolerance_days constant integer := 1;
  start_date_max_days_ahead constant integer := 7;
  schedule_max_days_ahead constant integer := 56;
  kept_replaced_plans constant integer := 20;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  basis record;
  start_on date;
  old_plan_id uuid;
  new_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(p_plan, plan_keys, 'Plan');
  perform private.assert_plan_inputs(p_plan -> 'inputs');

  -- Vorlage: freigegeben in genau dieser Version – oder (nur reine Ausdauer-Pläne) gar keine; dann keine
  -- Kraft-Einheit (Erweiterungsplan 4.4 Punkt 4).
  if jsonb_typeof(p_plan -> 'template_id') = 'null' then
    if jsonb_typeof(p_plan -> 'template_title_de') <> 'null'
       or jsonb_typeof(p_plan -> 'template_version') <> 'null'
       or jsonb_typeof(p_plan -> 'sessions') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_plan -> 'sessions') s where s ->> 'kind' is distinct from 'endurance'
       ) then
      raise exception 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.' using errcode = 'invalid_parameter_value';
    end if;
  elsif not exists (
    select 1 from public.plan_templates t
    where t.id = p_plan ->> 'template_id'
      and t.status = 'published'
      and t.version::text = p_plan ->> 'template_version'
  ) then
    raise exception 'Vorlage nicht freigegeben oder veraltet.' using errcode = 'invalid_parameter_value';
  end if;

  select * into basis from private.plan_health_basis();
  if (p_plan -> 'uses_health_data') is distinct from to_jsonb(basis.uses_health_data)
     or (p_plan -> 'medical_notice') is distinct from to_jsonb(basis.medical_notice) then
    raise exception 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Bisherigen aktiven Plan ersetzen; seine noch geplanten Einheiten ab GESTERN entfallen (der neue Plan darf
  -- ab gestern planen – sonst Kollision im Index „nie stapeln“). Ältere Einheiten bleiben als Verlauf.
  update public.user_plans
  set status = 'replaced', replaced_at = now()
  where user_id = current_user_id and status = 'active'
  returning id into old_plan_id;
  if old_plan_id is not null then
    delete from public.planned_sessions
    where plan_id = old_plan_id and status = 'planned' and scheduled_on >= today - past_tolerance_days;
  end if;

  begin
    start_on := (p_plan ->> 'start_date')::date;
    insert into public.user_plans (
      user_id, status, template_id, template_title_de, template_version, engine_version, match_quality, notes,
      uses_health_data, medical_notice, inputs, start_date
    )
    values (
      current_user_id, 'active', p_plan ->> 'template_id', p_plan ->> 'template_title_de',
      (p_plan ->> 'template_version')::integer, (p_plan ->> 'engine_version')::smallint,
      (p_plan ->> 'match_quality')::public.plan_match_quality,
      coalesce(
        (select array_agg(n::public.plan_note) from jsonb_array_elements_text(p_plan -> 'notes') n),
        '{}'
      ),
      basis.uses_health_data, basis.medical_notice, p_plan -> 'inputs', start_on
    )
    returning id into new_plan_id;
  exception
    -- Ohne „Failing row contains (…)“ (u. a. user_id, uses_health_data) nach außen.
    when check_violation or unique_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Werte im Plan.' using errcode = sqlstate;
  end;
  if start_on not between today - past_tolerance_days and today + start_date_max_days_ahead then
    raise exception 'Der Plan-Start liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
  end if;

  perform private.insert_plan_sessions(
    new_plan_id, current_user_id, p_plan -> 'sessions', 1,
    today - past_tolerance_days, today + schedule_max_days_ahead
  );
  if start_on > (select min(s.scheduled_on) from public.planned_sessions s where s.plan_id = new_plan_id) then
    raise exception 'Der Plan-Start liegt nach der ersten Einheit.' using errcode = 'invalid_parameter_value';
  end if;

  -- Aufräumen: ersetzte Pläne ohne Einheiten jenseits der neuesten 20 ersetzten.
  delete from public.user_plans p
  where p.user_id = current_user_id
    and p.status = 'replaced'
    and not exists (select 1 from public.planned_sessions s where s.plan_id = p.id)
    and p.id not in (
      select r.id
      from public.user_plans r
      where r.user_id = current_user_id and r.status = 'replaced'
      order by r.replaced_at desc, r.created_at desc
      limit kept_replaced_plans
    );

  return new_plan_id;
end;
$$;

revoke all on function public.save_training_plan(jsonb) from public, anon;
grant execute on function public.save_training_plan(jsonb) to authenticated;

create or replace function public.append_plan_block(p_plan_id uuid, p_sessions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: PLAN_SAVE_LIMITS in packages/core/src/constants.ts
  past_tolerance_days constant integer := 1;
  schedule_max_days_ahead constant integer := 56;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  plan record;
  basis record;
  last_block integer;
  last_date date;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select * into plan
  from public.user_plans p
  where p.id = p_plan_id and p.user_id = current_user_id and p.status = 'active'
  for update;
  if not found then
    raise exception 'Kein eigener aktiver Plan.' using errcode = 'insufficient_privilege';
  end if;
  -- Plan ohne Vorlage (reine Ausdauer): auch im Folgeblock keine Kraft-Einheit.
  if plan.template_id is null
     and jsonb_typeof(p_sessions) = 'array'
     and exists (
       select 1 from jsonb_array_elements(p_sessions) s where s ->> 'kind' is distinct from 'endurance'
     ) then
    raise exception 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.' using errcode = 'invalid_parameter_value';
  end if;
  select * into basis from private.plan_health_basis();
  if basis.uses_health_data is distinct from plan.uses_health_data
     or basis.medical_notice is distinct from plan.medical_notice then
    raise exception 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.'
      using errcode = 'invalid_parameter_value';
  end if;
  select max(s.block_no), max(s.scheduled_on) into last_block, last_date
  from public.planned_sessions s
  where s.plan_id = p_plan_id;
  perform private.insert_plan_sessions(
    p_plan_id, current_user_id, p_sessions, coalesce(last_block, 0) + 1,
    greatest(today - past_tolerance_days, last_date + 1),
    greatest(last_date, today) + schedule_max_days_ahead
  );
  return coalesce(last_block, 0) + 1;
end;
$$;

revoke all on function public.append_plan_block(uuid, jsonb) from public, anon;
grant execute on function public.append_plan_block(uuid, jsonb) to authenticated;
