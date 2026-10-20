-- Wettkampfplan leicht finden (Gründer-Rückmeldung vom 20.10.2026): neue Kachel „Mein Wettkampf“ (`competition`) auf
-- der Übersicht und „Wettkampf“ (`wettkampf`) als wählbarer Bereich der Menüleiste. Rein additiv: save_app_layout bekommt
-- die erweiterten ID-Listen (sync: DASHBOARD_TILES, NAV_AREAS in packages/core/src/layout.ts, db-sync.test.ts), alles
-- andere ist unverändert wie in 20261020130000_app_layout_settings.sql. Gespeicherte Anordnungen bleiben gültig (die App
-- ergänzt fehlende Kacheln an ihrer Standardstelle, normalizeLayout). Kein Gesundheitsdatum, keine Tabellenänderung.

create or replace function public.save_app_layout(p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: DASHBOARD_TILES, NAV_AREAS, APP_LAYOUT in packages/core (db-sync.test.ts)
  tile_ids constant text[] := array[
    'training', 'competition', 'workouts', 'nutrition', 'body', 'progress', 'endurance', 'shortcuts'
  ];
  area_ids constant text[] := array[
    'uebersicht', 'today', 'workouts', 'ernaehrung', 'einkaufsliste', 'wettkampf', 'fortschritt', 'mehr'
  ];
  tabs_min constant integer := 3;
  tabs_max constant integer := 6;
  tiles_max constant integer := 20;
  current_user_id uuid := auth.uid();
  tiles jsonb;
  tabs jsonb;
  entry jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_layout) k)
        is distinct from array['dashboard_tiles', 'tab_bar'] then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  tiles := p_layout -> 'dashboard_tiles';
  tabs := p_layout -> 'tab_bar';
  if jsonb_typeof(tiles) is distinct from 'array' or jsonb_array_length(tiles) > tiles_max
     or jsonb_typeof(tabs) is distinct from 'array'
     or jsonb_array_length(tabs) not between tabs_min and tabs_max then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tiles) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(entry) k) is distinct from array['id', 'visible']
       or jsonb_typeof(entry -> 'id') is distinct from 'string'
       or jsonb_typeof(entry -> 'visible') is distinct from 'boolean'
       or not ((entry ->> 'id') = any (tile_ids)) then
      raise exception 'Ungültige Kachel.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(tiles) e) <> jsonb_array_length(tiles) then
    raise exception 'Kachel doppelt.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tabs) loop
    if jsonb_typeof(entry) is distinct from 'string' or not ((entry #>> '{}') = any (area_ids)) then
      raise exception 'Ungültiger Bereich.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(tabs) e) <> jsonb_array_length(tabs)
     or tabs ->> 0 is distinct from 'uebersicht'
     or tabs ->> (jsonb_array_length(tabs) - 1) is distinct from 'mehr' then
    raise exception 'Ungültige Menüleiste.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.app_layout_settings (user_id, dashboard_tiles, tab_bar, updated_at)
  values (current_user_id, tiles, tabs, now())
  on conflict (user_id) do update
    set dashboard_tiles = excluded.dashboard_tiles, tab_bar = excluded.tab_bar, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_app_layout(jsonb) from public, anon;
grant execute on function public.save_app_layout(jsonb) to authenticated;
