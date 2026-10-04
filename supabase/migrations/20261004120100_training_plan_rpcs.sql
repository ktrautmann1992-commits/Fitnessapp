-- Phase 3 · Pläne speichern: save_training_plan(p_plan jsonb), append_plan_block(p_plan_id, p_sessions)
-- (docs/PLAN-PHASE-3.md Abschnitt 8.1).
--
-- security definer + search_path = '' (Muster delete_my_account): Nutzer haben auf user_plans und
-- planned_exercises KEIN Schreibrecht – nur diese Funktionen schreiben, und sie prüfen alles selbst:
-- - angemeldet (auth.uid()), Profil vorhanden, user_id immer aus dem Login (nie aus der Eingabe),
-- - nur bekannte Felder (wie das Zod-Schema savePlanPayloadSchema .strict() in packages/core),
-- - Angaben (inputs) nach Werten wie savePlanInputsSchema (private.assert_plan_inputs),
-- - Vorlage und alle Übungen existieren und sind freigegeben, Vorlagen-Version stimmt,
-- - Datumsrahmen (PLAN_SAVE_LIMITS): Einheiten und Plan-Start frühestens gestern, Start spätestens in 7 Tagen
--   und nie nach der ersten Einheit, Einheiten höchstens 7 × 7 + 7 Tage voraus (Folgeblock: ab der letzten
--   Einheit bzw. heute),
-- - uses_health_data und medical_notice bestimmt die Datenbank SELBST aus dem neuesten Gesundheits-Check und
--   der Einwilligung health_data; weicht die Eingabe ab, wird der Aufruf abgelehnt (die App hat mit falschen
--   Regeln gerechnet und muss neu erzeugen),
-- - Grenzen der Werte prüfen die CHECK-Bedingungen der Tabellen.
-- Alles in EINER Transaktion. Fehlermeldungen ohne Nutzerdaten: Fehler der CHECKs/Indizes beim Einfügen
-- („Failing row contains (…)“ mit user_id, uses_health_data …) werden abgefangen und als „Ungültige Werte im
-- Plan.“ mit demselben Fehlercode und OHNE Detail neu ausgelöst.
-- „Heute“ = private.berlin_today() (Europe/Berlin, in Tests fest gesetzt).

-- ---------------------------------------------------------------------------------------------------------
-- Hilfsfunktionen (nicht über die API erreichbar; laufen innerhalb der security-definer-Funktionen mit deren
-- Rechten, sind selbst KEIN security definer)
-- ---------------------------------------------------------------------------------------------------------

-- Nur erlaubte Schlüssel in einem JSON-Objekt (wie Zod .strict()).
create or replace function private.assert_json_keys(p_value jsonb, p_allowed text[], p_label text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    raise exception 'Ungültige Eingabe (%).', p_label using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from jsonb_object_keys(p_value) k where not k = any (p_allowed)) then
    raise exception 'Unbekanntes Feld in der Eingabe (%).', p_label using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

revoke all on function private.assert_json_keys(jsonb, text[], text) from public;

-- JSON-Zahl im Bereich [p_min, p_max] mit höchstens p_scale Nachkommastellen (0 = ganze Zahl). Alles andere
-- (Text, null, fehlend) → false, nie ein Fehler.
create or replace function private.jsonb_number_between(p_value jsonb, p_min numeric, p_max numeric, p_scale integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then
      p_value::numeric between p_min and p_max and p_value::numeric = round(p_value::numeric, p_scale)
    else false
  end
$$;

revoke all on function private.jsonb_number_between(jsonb, numeric, numeric, integer) from public;

-- Angaben (user_plans.inputs) wie savePlanInputsSchema in packages/core/src/plan/payload.ts: alle Felder
-- vorhanden, Aufzählungen, Bereiche (TRAINING_LIMITS, Wochentage 1–7, Gewichtsstufen EQUIPMENT_LIMITS),
-- Geräte aus dem Katalog. Die Größe begrenzt zusätzlich ein CHECK auf user_plans.inputs.
create or replace function private.assert_plan_inputs(p_inputs jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  input_keys constant text[] := array[
    'goalType', 'discipline', 'experienceLevel', 'sessionsPerWeek', 'minutesPerSession', 'preferredDays',
    'trainingLocation', 'homeEquipment'
  ];
  equipment_keys constant text[] := array['equipmentId', 'weightsKg'];
  item jsonb;
begin
  perform private.assert_json_keys(p_inputs, input_keys, 'Angaben');
  if not (p_inputs ?& input_keys)
     or ((p_inputs ->> 'goalType') = any (enum_range(null::public.goal_type)::text[])) is not true
     or (jsonb_typeof(p_inputs -> 'discipline') <> 'null'
         and ((p_inputs ->> 'discipline') = any (enum_range(null::public.endurance_discipline)::text[])) is not true)
     or ((p_inputs ->> 'experienceLevel') = any (enum_range(null::public.experience_level)::text[])) is not true
     or ((p_inputs ->> 'trainingLocation') = any (enum_range(null::public.training_location)::text[])) is not true
     or not private.jsonb_number_between(p_inputs -> 'sessionsPerWeek', 1, 7, 0)
     or not private.jsonb_number_between(p_inputs -> 'minutesPerSession', 10, 240, 0) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;

  -- Wunsch-Tage: höchstens 7, jeweils 1–7, jeder Tag nur einmal.
  if jsonb_typeof(p_inputs -> 'preferredDays') <> 'array' then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  elsif jsonb_array_length(p_inputs -> 'preferredDays') > 7
     or exists (
       select 1 from jsonb_array_elements(p_inputs -> 'preferredDays') d
       where not private.jsonb_number_between(d, 1, 7, 0)
     )
     or (select count(distinct d) <> count(*) from jsonb_array_elements(p_inputs -> 'preferredDays') d) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;

  -- Geräte zu Hause: je Gerät genau equipmentId (aus dem Katalog) und weightsKg (höchstens 40 Stufen,
  -- 0,25–200 kg, höchstens 2 Nachkommastellen); jedes Gerät nur einmal.
  if jsonb_typeof(p_inputs -> 'homeEquipment') <> 'array' then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;
  for item in select value from jsonb_array_elements(p_inputs -> 'homeEquipment') loop
    perform private.assert_json_keys(item, equipment_keys, 'Geräte');
    if not (item ?& equipment_keys)
       or jsonb_typeof(item -> 'equipmentId') <> 'string'
       or not exists (select 1 from public.equipment eq where eq.id = item ->> 'equipmentId')
       or jsonb_typeof(item -> 'weightsKg') <> 'array' then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_array_length(item -> 'weightsKg') > 40
       or exists (
         select 1 from jsonb_array_elements(item -> 'weightsKg') w
         where not private.jsonb_number_between(w, 0.25, 200, 2)
       ) then
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

-- Gesundheitsbezug aus Sicht der Datenbank für den ANGEMELDETEN Nutzer (auth.uid() – dieselbe Person für Check
-- und Einwilligung): Gesundheits-Check vorhanden UND Einwilligung health_data gültig (aktuelle Version)
-- → uses_health_data; Arzt-Hinweis bei jedem Flag des NEUESTEN Checks (wie requiresMedicalNotice() in
-- packages/core).
create or replace function private.plan_health_basis(out uses_health_data boolean, out medical_notice boolean)
language plpgsql
stable
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  latest_flags text[];
  consent_ok boolean := public.has_valid_consent('health_data');
begin
  select h.flags into latest_flags
  from public.health_screening h
  where h.user_id = current_user_id
  order by h.created_at desc
  limit 1;
  uses_health_data := found and consent_ok;
  medical_notice := uses_health_data and cardinality(latest_flags) > 0;
end;
$$;

revoke all on function private.plan_health_basis() from public;

-- Legt Einheiten und Übungen eines Blocks an. Prüft Felder, Status der Übungen, Datumsrahmen
-- [p_earliest, p_latest], Folgeblock ohne Woche 0/Einstiegswoche und RPE-Schritte VOR der Rundung der Spalte
-- (numeric(3, 1) würde 7,49 sonst still zu 7,5 machen); alle übrigen Werte prüfen die CHECKs.
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
    'block_no', 'week_no', 'is_intro_week', 'is_deload', 'template_day_index', 'scheduled_on', 'name_de',
    'focus', 'estimated_minutes', 'warmup_de', 'cooldown_de', 'exercises'
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
      if jsonb_typeof(s -> 'exercises') is distinct from 'array'
         or jsonb_array_length(s -> 'exercises') not between 1 and 8 then
        raise exception 'Ungültige Übungen.' using errcode = 'invalid_parameter_value';
      end if;

      insert into public.planned_sessions (
        plan_id, user_id, block_no, week_no, is_intro_week, is_deload, template_day_index, scheduled_on,
        name_de, focus, estimated_minutes, warmup_de, cooldown_de
      )
      values (
        p_plan_id, p_user_id, p_block_no, (s ->> 'week_no')::smallint, (s ->> 'is_intro_week')::boolean,
        (s ->> 'is_deload')::boolean, (s ->> 'template_day_index')::smallint, scheduled,
        s ->> 'name_de', (s ->> 'focus')::public.session_focus, (s ->> 'estimated_minutes')::smallint,
        s ->> 'warmup_de', s ->> 'cooldown_de'
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

-- ---------------------------------------------------------------------------------------------------------
-- save_training_plan: neuen Plan speichern, bisherigen aktiven Plan ersetzen (eine Transaktion).
-- Eingabe = toSavePlanPayload() aus packages/core. Rückgabe: ID des neuen Plans.
-- Aufräumen (PLAN_SAVE_LIMITS.keptReplacedPlans): Ersetzte Pläne OHNE verbleibende Einheiten werden gelöscht,
-- sobald es mehr als 20 ersetzte Pläne gibt (älteste zuerst). Ersetzte Pläne mit vergangenen Einheiten bleiben
-- als Verlauf; da beim Ersetzen alle Einheiten ab gestern entfallen, entsteht so ein Eintrag höchstens alle
-- zwei Tage – häufiges Neu-Erzeugen lässt die Tabelle nicht wachsen.
-- ---------------------------------------------------------------------------------------------------------
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

  if not exists (
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

-- ---------------------------------------------------------------------------------------------------------
-- append_plan_block: Folgeblock an den EIGENEN AKTIVEN Plan hängen. Nur block_no = bisheriges Maximum + 1,
-- ohne Woche 0 und Einstiegswoche, nur Tage NACH der letzten Einheit des Plans (frühestens gestern) und höchstens
-- 7 × 7 + 7 Tage nach der letzten Einheit bzw. nach heute.
-- Passt der Gesundheitsbezug nicht mehr (z. B. Plan mit Gesundheitsdaten, Einwilligung veraltet oder neuer
-- Check mit/ohne Flag), wird abgelehnt → neuer Plan nötig (Abschnitt 10.4).
-- ---------------------------------------------------------------------------------------------------------
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
