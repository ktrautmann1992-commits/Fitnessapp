-- „App verschlanken“ (Gründer-Freigabe 26.10.2026, docs/PLAN-DASHBOARD.md 11): neue Standard-Menüleiste mit 5 Knöpfen
-- (Heute · Training · Ernährung · Einkaufen · Mehr) und neue Standard-Kacheln. Rein additiv:
-- 1. app_layout_settings bekommt die Spalte layout_version (Fassung der gespeicherten Anordnung, null = vor dem
--    26.10.2026). Die App (packages/core normalizeLayout) stellt NUR Anordnungen ohne bzw. mit alter Fassung um, die
--    noch genau dem alten Standard entsprechen; eine bewusst gewählte Leiste (Fassung 2) bleibt immer erhalten.
--    Einstellung, KEIN Gesundheitsdatum: bleibt beim Widerruf, steht im Export (export_my_data nimmt die ganze Zeile
--    per to_jsonb), Konto löschen per Kaskade; RLS unverändert (nur die eigene Zeile lesen, Schreiben nur über
--    save_app_layout).
-- 2. save_app_layout nimmt optional „layout_version“ an (ganze Zahl 1–99, sync: APP_LAYOUT.versionMax). Fehlt das Feld
--    (ältere App-Fassung), wird null gespeichert. Kachel-/Bereichs-IDs und alle übrigen Regeln (Heute links, Mehr
--    rechts, 3–6 Knöpfe, keine Doppel, Schrittziel) sind unverändert wie in 20261025120100_app_layout_recovery.sql.

alter table public.app_layout_settings
  -- sync: APP_LAYOUT.versionMax
  add column layout_version smallint check (layout_version is null or layout_version between 1 and 99);

comment on column public.app_layout_settings.layout_version is
  'Fassung der gespeicherten Anordnung (2 = seit „App verschlanken“ 26.10.2026); null = ältere Fassung. Einstellung, kein Gesundheitsdatum.';

create or replace function public.save_app_layout(p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: DASHBOARD_TILES, NAV_AREAS, APP_LAYOUT (auch version/versionMax), STEP_GOAL in packages/core (db-sync.test.ts)
  tile_ids constant text[] := array[
    'training', 'competition', 'workouts', 'nutrition', 'body', 'progress', 'endurance', 'steps', 'recovery',
    'shortcuts'
  ];
  area_ids constant text[] := array[
    'uebersicht', 'today', 'workouts', 'ernaehrung', 'einkaufsliste', 'wettkampf', 'fortschritt', 'mehr'
  ];
  tabs_min constant integer := 3;
  tabs_max constant integer := 6;
  tiles_max constant integer := 20;
  step_goal_min constant integer := 1000;
  step_goal_max constant integer := 30000;
  step_goal_step constant integer := 500;
  layout_version_max constant integer := 99;
  current_user_id uuid := auth.uid();
  tiles jsonb;
  tabs jsonb;
  entry jsonb;
  has_goal boolean;
  goal_value jsonb;
  new_goal integer;
  version_value jsonb;
  new_version integer;
  allowed_keys constant text[] := array['dashboard_tiles', 'layout_version', 'step_goal', 'tab_bar'];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'object' then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  -- Pflicht: dashboard_tiles, tab_bar; optional: step_goal, layout_version (seit 26.10.2026). Sonst nichts.
  if not (p_layout ? 'dashboard_tiles' and p_layout ? 'tab_bar')
     or exists (select 1 from jsonb_object_keys(p_layout) k where not (k = any (allowed_keys))) then
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
  -- Schrittziel (optional): ganze Zahl im Raster, null = Standard; fehlt das Feld, bleibt das gespeicherte Ziel.
  has_goal := p_layout ? 'step_goal';
  new_goal := null;
  if has_goal then
    goal_value := p_layout -> 'step_goal';
    if jsonb_typeof(goal_value) = 'number' then
      if (goal_value #>> '{}')::numeric not between step_goal_min and step_goal_max
         or (goal_value #>> '{}')::numeric % step_goal_step <> 0 then
        raise exception 'Ungültiges Schrittziel.' using errcode = 'invalid_parameter_value';
      end if;
      new_goal := (goal_value #>> '{}')::integer;
    elsif jsonb_typeof(goal_value) is distinct from 'null' then
      raise exception 'Ungültiges Schrittziel.' using errcode = 'invalid_parameter_value';
    end if;
  end if;
  -- Fassung der Anordnung (optional): ganze Zahl 1–99; fehlt das Feld (ältere App-Fassung), gilt die Anordnung als
  -- alte Fassung (null) – die App stellt dann einen unveränderten alten Standard um (normalizeLayout).
  new_version := null;
  if p_layout ? 'layout_version' then
    version_value := p_layout -> 'layout_version';
    if jsonb_typeof(version_value) = 'number' then
      if (version_value #>> '{}')::numeric not between 1 and layout_version_max
         or (version_value #>> '{}')::numeric % 1 <> 0 then
        raise exception 'Ungültige Fassung.' using errcode = 'invalid_parameter_value';
      end if;
      new_version := (version_value #>> '{}')::integer;
    elsif jsonb_typeof(version_value) is distinct from 'null' then
      raise exception 'Ungültige Fassung.' using errcode = 'invalid_parameter_value';
    end if;
  end if;
  insert into public.app_layout_settings as s
    (user_id, dashboard_tiles, tab_bar, step_goal, layout_version, updated_at)
  values (current_user_id, tiles, tabs, new_goal, new_version, now())
  on conflict (user_id) do update
    set dashboard_tiles = excluded.dashboard_tiles, tab_bar = excluded.tab_bar,
        step_goal = case when has_goal then excluded.step_goal else s.step_goal end,
        layout_version = excluded.layout_version,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_app_layout(jsonb) from public, anon;
grant execute on function public.save_app_layout(jsonb) to authenticated;
