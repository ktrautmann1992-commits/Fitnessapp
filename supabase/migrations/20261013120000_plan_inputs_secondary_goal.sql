-- Ziele · Etappe Z1 (docs/PLAN-ZIELE.md 5.1, Wächter B1 und N3): Haupt- und optionales Nebenziel in den Angaben
-- eines Plans (user_plans.inputs). NUR Datenbank-Funktionen, keine Tabelle, keine neuen Daten – harmlos.
-- 1. private.goal_pair_allowed(Hauptziel, Nebenziel): feste Liste der erlaubten Paare
--    (= GOAL_PAIR_RULES/GOAL_COMBINATIONS in packages/core, Abgleich in db-sync.test.ts).
-- 2. private.assert_plan_inputs neu gefasst (Basis: letzte Fassung aus *_plan_session_kinds.sql): optionaler
--    Schlüssel `secondaryGoalType`. Alte Payloads ohne den Schlüssel bleiben gültig (alte App + neue Datenbank);
--    die App sendet ihn nur, wenn ein Nebenziel gesetzt ist (neue App + alte Datenbank, docs/PLAN-ZIELE.md 4.6).
-- Die aktuelle save_training_plan (*_training_log_rpcs.sql) ruft assert_plan_inputs auf; andere Aufrufer gibt es
-- nicht, deshalb wird nur diese Funktion ersetzt (Signatur gleich). Die Spalte goals.secondary_goal_type folgt in
-- Etappe Z3.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Erlaubte Paare Hauptziel → Nebenziel (Tabelle 4.2). Kein Nebenziel prüft der Aufrufer (null = erlaubt).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.goal_pair_allowed(p_primary public.goal_type, p_secondary public.goal_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_primary::text, p_secondary::text) in (
    ('fat_loss', 'muscle_gain'),
    ('fat_loss', 'endurance'),
    ('definition', 'endurance'),
    ('muscle_gain', 'fat_loss'),
    ('muscle_gain', 'endurance'),
    ('general_fitness', 'fat_loss'),
    ('general_fitness', 'endurance'),
    ('endurance', 'fat_loss'),
    ('endurance', 'definition'),
    ('endurance', 'muscle_gain')
  )
$$;

revoke all on function private.goal_pair_allowed(public.goal_type, public.goal_type) from public;
-- Ab Etappe Z3 Teil der CHECK-Bedingung auf goals (secondary_goal_type); CHECKs laufen mit den Rechten der
-- aufrufenden Rolle (Muster private.has_distinct_elements, Wächter Z1 S-2). anon bekommt kein Recht.
grant execute on function private.goal_pair_allowed(public.goal_type, public.goal_type) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Angaben eines Plans (wie savePlanInputsSchema in packages/core/src/plan/payload.ts)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.assert_plan_inputs(p_inputs jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  -- Pflicht (für `?&`) und erlaubt (für assert_json_keys) getrennt (Wächter N3): `secondaryGoalType` ist optional.
  required_keys constant text[] := array[
    'goalType', 'discipline', 'experienceLevel', 'schedule', 'trainingLocation', 'homeEquipment'
  ];
  allowed_keys constant text[] := array[
    'goalType', 'secondaryGoalType', 'discipline', 'experienceLevel', 'schedule', 'trainingLocation',
    'homeEquipment'
  ];
  schedule_keys constant text[] := array['mode', 'slots'];
  fixed_slot_keys constant text[] := array['weekday', 'kind', 'minutes'];
  flex_slot_keys constant text[] := array['kind', 'minutes'];
  equipment_keys constant text[] := array['equipmentId', 'weightsKg', 'barKg'];
  schedule jsonb;
  slot_keys text[];
  item jsonb;
begin
  perform private.assert_json_keys(p_inputs, allowed_keys, 'Angaben');
  if not (p_inputs ?& required_keys)
     or ((p_inputs ->> 'goalType') = any (enum_range(null::public.goal_type)::text[])) is not true
     or (jsonb_typeof(p_inputs -> 'discipline') <> 'null'
         and ((p_inputs ->> 'discipline') = any (enum_range(null::public.endurance_discipline)::text[])) is not true)
     or ((p_inputs ->> 'experienceLevel') = any (enum_range(null::public.experience_level)::text[])) is not true
     or (jsonb_typeof(p_inputs -> 'trainingLocation') <> 'null'
         and ((p_inputs ->> 'trainingLocation') = any (enum_range(null::public.training_location)::text[])) is not true) then
    raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
  end if;

  -- Nebenziel (docs/PLAN-ZIELE.md 5.1): fehlender Schlüssel und JSON-null heißen beide „kein Nebenziel“. Sonst ein
  -- Text, der ZUERST gegen die Enum-Werte geprüft wird (kein unkontrollierter Fehler 22P02 beim Umwandeln) und erst
  -- danach als goal_type an private.goal_pair_allowed geht.
  if coalesce(jsonb_typeof(p_inputs -> 'secondaryGoalType'), 'null') <> 'null' then
    if jsonb_typeof(p_inputs -> 'secondaryGoalType') <> 'string'
       or ((p_inputs ->> 'secondaryGoalType') = any (enum_range(null::public.goal_type)::text[])) is not true then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
    -- Erst nach der Prüfung oben umwandeln (eigene Bedingung, keine Auswertungsreihenfolge innerhalb von `or`).
    if not private.goal_pair_allowed(
      (p_inputs ->> 'goalType')::public.goal_type,
      (p_inputs ->> 'secondaryGoalType')::public.goal_type
    ) then
      raise exception 'Ungültige Angaben im Plan.' using errcode = 'invalid_parameter_value';
    end if;
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
