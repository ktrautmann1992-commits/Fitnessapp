-- Etappe E4 · Höhenprofil je Strecke (docs/PLAN-EINKAUFEN-AUSDAUER.md 6). NUR ADDITIV:
-- 1. private.elevation_profile_valid (= elevationProfileSchema in packages/core/src/routes/elevation-profile.ts):
--    2–300 Stützpunkte [Distanz in m, Höhe in dm], ganze Zahlen, Distanz 0–500.000 und nie fallend, Höhe −10.000 bis
--    100.000 dm (−1.000 bis 10.000 m, ROUTE_ELEVATION_PROFILE). Nie ein Fehler.
-- 2. Spalte tracked_routes.elevation_profile jsonb (null erlaubt – ältere Strecken und Aufzeichnungen ohne Höhen) mit
--    CHECK über die Funktion (gilt auch für service_role).
-- 3. save_tracked_route: NEUESTE Fassung (20261016220200_tracked_route_rpcs.sql) Zeile für Zeile übernommen und nur um
--    das OPTIONALE Feld elevation_profile erweitert – ältere App-Fassungen senden es nicht und funktionieren weiter
--    (route_keys bleiben Pflicht, optional_keys dürfen fehlen; db-sync.test.ts prüft die Obermenge).
-- Export: export_my_data nimmt to_jsonb(t) der ganzen Zeile – die neue Spalte ist automatisch dabei. Kein
-- Gesundheitsdatum (W-G15), RLS und Rechte der Tabelle unverändert.

-- ---------------------------------------------------------------------------------------------------------
-- 1. private.elevation_profile_valid
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.elevation_profile_valid(p_profile jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- sync: ROUTE_ELEVATION_PROFILE und TRACKED_ROUTE_LIMITS.distanceM in packages/core/src/constants.ts
  max_points constant integer := 300;
  max_distance_m constant integer := 500000;
  min_height_dm constant integer := -10000;
  max_height_dm constant integer := 100000;
  p jsonb;
  d numeric;
  h numeric;
  prev numeric := -1;
begin
  if p_profile is null or jsonb_typeof(p_profile) <> 'array'
     or jsonb_array_length(p_profile) not between 2 and max_points then
    return false;
  end if;
  for p in select value from jsonb_array_elements(p_profile) loop
    if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) <> 2
       or jsonb_typeof(p -> 0) <> 'number' or jsonb_typeof(p -> 1) <> 'number' then
      return false;
    end if;
    d := (p -> 0)::numeric;
    h := (p -> 1)::numeric;
    if d <> trunc(d) or h <> trunc(h) or d not between 0 and max_distance_m
       or h not between min_height_dm and max_height_dm or d < prev then
      return false;
    end if;
    prev := d;
  end loop;
  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.elevation_profile_valid(jsonb) from public;
grant execute on function private.elevation_profile_valid(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Spalte
-- ---------------------------------------------------------------------------------------------------------
alter table public.tracked_routes add column elevation_profile jsonb;
alter table public.tracked_routes add constraint tracked_routes_elevation_profile_valid
  check (elevation_profile is null or private.elevation_profile_valid(elevation_profile));

comment on column public.tracked_routes.elevation_profile is
  'Höhenprofil [Distanz m, Höhe dm], höchstens 300 Stützpunkte (Etappe E4); null = keines.';

-- ---------------------------------------------------------------------------------------------------------
-- 3. save_tracked_route(p_route jsonb) → id – neueste Fassung + optionales Feld elevation_profile
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_tracked_route(p_route jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_keys constant text[] := array[
    'id', 'name', 'sport', 'started_at', 'duration_s', 'moving_s', 'distance_m', 'elevation_gain_m', 'polyline',
    'km_splits', 'difficulty', 'is_favorite', 'base_route_id', 'note', 'session_log_id', 'source'
  ];
  -- Etappe E4: darf fehlen (ältere App-Fassungen). sync: TRACKED_ROUTE_OPTIONAL_KEYS in packages/core
  optional_keys constant text[] := array['elevation_profile'];
  -- sync: TRACKED_ROUTE_LIMITS in packages/core/src/constants.ts
  max_saves_per_day constant integer := 20;
  clock_skew_s constant integer := 300;
  iso_timestamp_pattern constant text :=
    '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  r jsonb := p_route;
  v_id uuid;
  v_sport public.endurance_modality;
  v_started_at timestamptz;
  v_duration_s integer;
  v_base_route_id uuid;
  v_session_log_id uuid;
  v_source public.tracked_route_source;
  v_summary numeric[];
  log_row record;
  log_found boolean := false;
  created_today integer;
  saved_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(r, route_keys || optional_keys, 'Strecke');
  -- Alle Felder vorhanden und vom richtigen JSON-Typ; Zahlen ganz und im Bereich (Rest prüfen die CHECKs).
  if not (r ?& route_keys)
     or jsonb_typeof(r -> 'id') <> 'string'
     or jsonb_typeof(r -> 'name') <> 'string'
     or jsonb_typeof(r -> 'sport') <> 'string'
     or jsonb_typeof(r -> 'started_at') <> 'string'
     or not private.jsonb_number_between(r -> 'duration_s', 60, 43200, 0)
     or not private.jsonb_number_between(r -> 'moving_s', 0, 43200, 0)
     or not private.jsonb_number_between(r -> 'distance_m', 0, 500000, 0)
     or not (jsonb_typeof(r -> 'elevation_gain_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_gain_m', 0, 10000, 0))
     or jsonb_typeof(r -> 'polyline') <> 'string'
     or jsonb_typeof(r -> 'km_splits') <> 'array'
     or jsonb_typeof(r -> 'difficulty') not in ('string', 'null')
     or jsonb_typeof(r -> 'is_favorite') <> 'boolean'
     or jsonb_typeof(r -> 'base_route_id') not in ('string', 'null')
     or jsonb_typeof(r -> 'note') not in ('string', 'null')
     or jsonb_typeof(r -> 'session_log_id') not in ('string', 'null')
     or jsonb_typeof(r -> 'source') <> 'string'
     or (r ? 'elevation_profile' and jsonb_typeof(r -> 'elevation_profile') not in ('array', 'null'))
     or (r ->> 'started_at') !~ iso_timestamp_pattern then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (r ->> 'id')::uuid;
    v_sport := (r ->> 'sport')::public.endurance_modality;
    v_started_at := (r ->> 'started_at')::timestamptz;
    v_duration_s := (r ->> 'duration_s')::integer;
    v_base_route_id := (r ->> 'base_route_id')::uuid;
    v_session_log_id := (r ->> 'session_log_id')::uuid;
    v_source := (r ->> 'source')::public.tracked_route_source;
    perform (r ->> 'difficulty')::public.route_difficulty;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end;
  -- Nicht in der Zukunft (Spielraum für die Uhr des Geräts).
  if v_started_at + make_interval(secs => v_duration_s) > now() + make_interval(secs => clock_skew_s) then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  -- Warteschlange: dieselbe eigene Strecke erneut gesendet → nichts ändern.
  if exists (select 1 from public.tracked_routes t where t.id = v_id and t.user_id = current_user_id) then
    return v_id;
  end if;
  if exists (select 1 from public.tracked_routes t where t.id = v_id) then
    v_id := gen_random_uuid();
  end if;

  -- Wiederholung: nur eine eigene Favoriten-Strecke derselben Sportart.
  if v_base_route_id is not null and not exists (
    select 1 from public.tracked_routes t
    where t.id = v_base_route_id and t.user_id = current_user_id and t.is_favorite and t.sport = v_sport
    for share
  ) then
    raise exception 'Die Favoriten-Strecke wurde nicht gefunden.' using errcode = 'invalid_parameter_value';
  end if;

  -- Tagebuch-Eintrag: eigener Ausdauer-Eintrag derselben Art vom Tag des Beginns (oder 1 Tag danach), noch ohne
  -- Strecke. Gesperrt, damit gleichzeitiges Löschen/Ändern nicht dazwischenkommt.
  if v_session_log_id is not null then
    select sl.kind, sl.performed_on, cl.modality, cl.duration_s, cl.distance_m into log_row
    from public.session_logs sl
    join public.cardio_logs cl on cl.session_log_id = sl.id
    where sl.id = v_session_log_id and sl.user_id = current_user_id and sl.kind = 'endurance'
      and cl.modality = v_sport
    for update of sl;
    log_found := found;
    if not log_found then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'invalid_parameter_value';
    end if;
    if not private.session_log_fits_route(
         v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer, (r ->> 'distance_m')::integer,
         log_row.kind, log_row.modality, log_row.performed_on, log_row.duration_s, log_row.distance_m)
       or exists (select 1 from public.tracked_routes t where t.session_log_id = v_session_log_id) then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  v_summary := private.polyline_summary(r ->> 'polyline');
  if v_summary is null or v_summary[1] not between 2 and 5000 then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  -- Schutz gegen Missbrauch: höchstens max_saves_per_day NEUE Strecken je Kalendertag; die Zeile des Zählers sperrt
  -- gleichzeitige Aufrufe derselben Person.
  insert into private.tracked_route_daily_counts as c (user_id, day, created)
  values (current_user_id, today, 1)
  on conflict (user_id, day) do update set created = c.created + 1
  returning c.created into created_today;
  if created_today > max_saves_per_day then
    raise exception 'Heute wurden schon zu viele Strecken gespeichert.' using errcode = 'program_limit_exceeded';
  end if;
  delete from private.tracked_route_daily_counts c where c.user_id = current_user_id and c.day < today;

  begin
    insert into public.tracked_routes (
      id, user_id, name, sport, started_at, duration_s, moving_s, distance_m, elevation_gain_m, polyline, point_count,
      bbox, km_splits, difficulty, is_favorite, base_route_id, note, session_log_id, source,
      elevation_profile
    )
    values (
      v_id, current_user_id, r ->> 'name', v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer,
      (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer, r ->> 'polyline',
      v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', (r ->> 'difficulty')::public.route_difficulty,
      (r ->> 'is_favorite')::boolean, v_base_route_id, r ->> 'note', v_session_log_id, v_source,
      case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end
    )
    returning id into saved_id;
  exception
    when unique_violation then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'unique_violation';
    -- Ohne „Failing row contains (…)“ nach außen (keine Koordinaten, keine Notiz).
    when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
      or numeric_value_out_of_range then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = sqlstate;
  end;

  -- Herkunft des Tagebuch-Eintrags (WP3 Präzisierung 8): nur hier gesetzt, nie vom Gerät.
  if v_session_log_id is not null then
    update public.session_logs sl
    set source = case v_source when 'recorded' then 'gps' else 'gpx_import' end::public.log_source,
        revision = sl.revision + 1
    where sl.id = v_session_log_id;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_tracked_route(jsonb) from public, anon;
grant execute on function public.save_tracked_route(jsonb) to authenticated;
