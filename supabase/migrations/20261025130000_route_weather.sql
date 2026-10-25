-- Wetter je Lauf (Gründer-Wunsch 25.10.2026, docs/PLAN-PHASE-10.md Nachtrag „Wetter“). NUR ADDITIV:
-- 1. private.route_weather_valid(jsonb): Form wie routeWeatherSchema (packages/core/src/routes/weather.ts) – genau die
--    Felder hour, temp_c, feels_c, wind_kmh, precip_mm, humidity_pct, code, source; Wertebereiche = ROUTE_WEATHER.
-- 2. tracked_routes.weather (jsonb, null = kein Wetter) mit CHECK.
-- 3. set_route_weather(p_route, p_weather): einziger Schreibweg (security definer) – nur eigene Strecken; null löscht.
-- Das Gerät holt das Wetter selbst bei Open-Meteo (nur auf 0,1° gerundete Startposition, Tag und Stunde – nie die
-- Strecke) und speichert hier nur das Ergebnis. Kein Gesundheitsdatum; RLS der Tabelle unverändert (nur eigene
-- Zeilen). Export: export_my_data nimmt to_jsonb der ganzen Zeile – die Spalte ist automatisch dabei; Konto löschen:
-- Kaskade wie bisher. Keine neuen Fassungen bestehender Funktionen.

-- sync: ROUTE_WEATHER in packages/core/src/constants.ts (tempC −60…60, windKmh 0…300, precipMm 0…500,
-- humidityPct 0…100, code 0…99)
create or replace function private.route_weather_valid(p_weather jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  weather_keys constant text[] := array[
    'hour', 'temp_c', 'feels_c', 'wind_kmh', 'precip_mm', 'humidity_pct', 'code', 'source'
  ];
  k text;
begin
  if p_weather is null then
    return true;
  end if;
  if jsonb_typeof(p_weather) <> 'object' or not (p_weather ?& weather_keys) then
    return false;
  end if;
  for k in select jsonb_object_keys(p_weather) loop
    if not (k = any (weather_keys)) then
      return false;
    end if;
  end loop;
  return jsonb_typeof(p_weather -> 'hour') = 'string'
    and (p_weather ->> 'hour') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?Z$'
    and private.jsonb_number_between(p_weather -> 'temp_c', -60, 60, 1)
    and (jsonb_typeof(p_weather -> 'feels_c') = 'null'
      or private.jsonb_number_between(p_weather -> 'feels_c', -60, 60, 1))
    and (jsonb_typeof(p_weather -> 'wind_kmh') = 'null'
      or private.jsonb_number_between(p_weather -> 'wind_kmh', 0, 300, 1))
    and (jsonb_typeof(p_weather -> 'precip_mm') = 'null'
      or private.jsonb_number_between(p_weather -> 'precip_mm', 0, 500, 1))
    and (jsonb_typeof(p_weather -> 'humidity_pct') = 'null'
      or private.jsonb_number_between(p_weather -> 'humidity_pct', 0, 100, 1))
    and (jsonb_typeof(p_weather -> 'code') = 'null'
      or private.jsonb_number_between(p_weather -> 'code', 0, 99, 0))
    and p_weather ->> 'source' in ('forecast', 'archive');
exception
  when others then
    return false;
end;
$$;

revoke all on function private.route_weather_valid(jsonb) from public;
grant execute on function private.route_weather_valid(jsonb) to authenticated, service_role;

alter table public.tracked_routes add column weather jsonb;
alter table public.tracked_routes
  add constraint tracked_routes_weather_valid check (private.route_weather_valid(weather));
comment on column public.tracked_routes.weather is
  'Wetter zum Start (Open-Meteo, gerundete Startposition); null = keins. Schreiben nur über set_route_weather.';

create or replace function public.set_route_weather(p_route uuid, p_weather jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_route is null or not private.route_weather_valid(p_weather)
     or octet_length(coalesce(p_weather::text, '')) > 2000 then
    raise exception 'Ungültige Angaben zum Wetter.' using errcode = 'invalid_parameter_value';
  end if;
  update public.tracked_routes t set weather = p_weather
  where t.id = p_route and t.user_id = current_user_id;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.set_route_weather(uuid, jsonb) from public, anon;
grant execute on function public.set_route_weather(uuid, jsonb) to authenticated;
