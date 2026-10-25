-- Schuh-Kilometerzähler (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-10.md Abschnitt 21). NUR ADDITIV:
-- 1. Tabellen shoes (eigene Schuhe je Sportart run | walk | bike), shoe_defaults (Standard-Schuh je Sportart ab einem
--    Tag; null = ab dann kein Standard) und shoe_assignments (Wahl je Lauf, Schlüssel wie EnduranceActivity.key
--    „route:<uuid>“ bzw. „log:<uuid>“; shoe_id null = ausdrücklich ohne Schuh). Kein Gesundheitsdatum (Ausrüstung):
--    bleibt beim Widerruf, steht im Export, Konto löschen per Kaskade.
-- 2. Lesen per RLS nur die eigenen Zeilen; Schreiben nur über save_shoe_data (ersetzt den ganzen Stand atomar – so
--    kann die App offline den neuesten Stand in die Warteschlange legen, ohne Reihenfolge-Probleme) und
--    delete_my_shoe_data (Recht auf Löschung). Beide security definer, search_path = '', REVOKE public/anon.
-- 3. Die Zuordnung Lauf → Schuh (Standard am Tag, Wahl je Lauf) und die Kilometer rechnet packages/core
--    (shoes/shoes.ts) – die Datenbank speichert nur die Angaben. Grenzen = SHOE_MILEAGE (db-sync.test.ts).
-- 4. Export als Obermenge der neuesten Fassung (20261021130200_supplement_user_data.sql) plus die drei Tabellen.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabellen
-- ---------------------------------------------------------------------------------------------------------
create table public.shoes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sportart wie tracked_routes (run | bike | walk, kein Schwimmen) = SHOE_SPORTS
  sport public.endurance_modality not null check (sport in ('run', 'bike', 'walk')),
  -- sync: SHOE_MILEAGE.nameMaxLength / brandMaxLength
  name text not null check (char_length(name) between 1 and 40 and name = btrim(name)),
  brand text check (brand is null or (char_length(brand) between 1 and 40 and brand = btrim(brand))),
  -- sync: SHOE_MILEAGE.startKmMax
  start_km integer not null default 0 check (start_km between 0 and 5000),
  -- sync: SHOE_MILEAGE.replaceKmLimits (null = Standard 800 km)
  replace_km integer check (replace_km is null or replace_km between 200 and 2000),
  in_use_since date not null,
  retired_on date check (retired_on is null or retired_on >= in_use_since),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Für die Fremdschlüssel der beiden anderen Tabellen (gleiche Person, beim Standard auch gleiche Sportart).
  unique (id, user_id),
  unique (id, user_id, sport)
);
create index shoes_user_idx on public.shoes (user_id);

comment on table public.shoes is
  'Eigene Schuhe je Sportart (Schuh-Kilometerzähler, 25.10.2026). Kein Gesundheitsdatum. Schreiben nur über '
  'save_shoe_data.';

create table public.shoe_defaults (
  user_id uuid not null references auth.users (id) on delete cascade,
  sport public.endurance_modality not null check (sport in ('run', 'bike', 'walk')),
  valid_from date not null,
  shoe_id uuid,
  primary key (user_id, sport, valid_from),
  -- Schuh gelöscht → ab dem Tag kein Standard (frühere Läufe bekommen nicht plötzlich einen älteren Schuh).
  foreign key (shoe_id, user_id, sport) references public.shoes (id, user_id, sport) on delete set null (shoe_id)
);

comment on table public.shoe_defaults is
  'Standard-Schuh je Sportart ab einem Tag (null = kein Standard). Kein Gesundheitsdatum.';

create table public.shoe_assignments (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_key text not null check (
    activity_key ~ '^(route|log):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  shoe_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_key),
  -- Schuh gelöscht → Wahl entfällt (der Lauf ist wieder automatisch).
  foreign key (shoe_id, user_id) references public.shoes (id, user_id) on delete cascade
);

comment on table public.shoe_assignments is
  'Schuh je Lauf (route:<id> bzw. log:<id>), null = ohne Schuh. Ohne Zeile gilt der Standard am Tag des Laufs.';

alter table public.shoes enable row level security;
alter table public.shoe_defaults enable row level security;
alter table public.shoe_assignments enable row level security;
revoke all on table public.shoes, public.shoe_defaults, public.shoe_assignments from public, anon, authenticated;
grant select on table public.shoes, public.shoe_defaults, public.shoe_assignments to authenticated;
grant all on table public.shoes, public.shoe_defaults, public.shoe_assignments to service_role;

create policy "Nutzer sehen die eigenen Schuhe"
  on public.shoes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen die eigenen Standard-Schuhe"
  on public.shoe_defaults for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen die eigene Schuh-Wahl"
  on public.shoe_assignments for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_shoe_data(p_data jsonb): { shoes, defaults, assignments } genau wie shoeDataSchema (packages/core) –
--    ersetzt den ganzen eigenen Stand. Fehler: „Ungültige Schuhe.“ (22023).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_shoe_data(p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: SHOE_MILEAGE.maxShoes / maxAssignments in packages/core/src/constants.ts (db-sync.test.ts)
  max_shoes constant integer := 30;
  max_defaults constant integer := 600;
  max_assignments constant integer := 10000;
  shoe_keys constant text[] := array[
    'brand', 'id', 'in_use_since', 'name', 'replace_km', 'retired_on', 'sport', 'start_km'
  ];
  default_keys constant text[] := array['shoe_id', 'sport', 'valid_from'];
  assignment_keys constant text[] := array['activity_key', 'shoe_id'];
  iso_date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  current_user_id uuid := auth.uid();
  v_shoes jsonb;
  v_defaults jsonb;
  v_assignments jsonb;
  e jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_data) is distinct from 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_data) k)
        is distinct from array['assignments', 'defaults', 'shoes'] then
    raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
  end if;
  v_shoes := p_data -> 'shoes';
  v_defaults := p_data -> 'defaults';
  v_assignments := p_data -> 'assignments';
  if jsonb_typeof(v_shoes) is distinct from 'array' or jsonb_array_length(v_shoes) > max_shoes
     or jsonb_typeof(v_defaults) is distinct from 'array' or jsonb_array_length(v_defaults) > max_defaults
     or jsonb_typeof(v_assignments) is distinct from 'array'
     or jsonb_array_length(v_assignments) > max_assignments then
    raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
  end if;
  -- Form je Eintrag (genau die Felder, richtige JSON-Typen; Werte prüfen danach die CHECKs der Tabellen).
  for e in select value from jsonb_array_elements(v_shoes) loop
    if jsonb_typeof(e) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(e) k) is distinct from shoe_keys
       or jsonb_typeof(e -> 'id') is distinct from 'string'
       or jsonb_typeof(e -> 'sport') is distinct from 'string'
       or jsonb_typeof(e -> 'name') is distinct from 'string'
       or jsonb_typeof(e -> 'brand') not in ('string', 'null')
       or not private.jsonb_number_between(e -> 'start_km', 0, 5000, 0)
       or not (jsonb_typeof(e -> 'replace_km') = 'null'
               or private.jsonb_number_between(e -> 'replace_km', 200, 2000, 0))
       or coalesce(e ->> 'in_use_since', '') !~ iso_date_pattern
       or not (jsonb_typeof(e -> 'retired_on') = 'null' or (e ->> 'retired_on') ~ iso_date_pattern) then
      raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  for e in select value from jsonb_array_elements(v_defaults) loop
    if jsonb_typeof(e) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(e) k) is distinct from default_keys
       or jsonb_typeof(e -> 'sport') is distinct from 'string'
       or coalesce(e ->> 'valid_from', '') !~ iso_date_pattern
       or jsonb_typeof(e -> 'shoe_id') not in ('string', 'null') then
      raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  for e in select value from jsonb_array_elements(v_assignments) loop
    if jsonb_typeof(e) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(e) k) is distinct from assignment_keys
       or jsonb_typeof(e -> 'activity_key') is distinct from 'string'
       or jsonb_typeof(e -> 'shoe_id') not in ('string', 'null') then
      raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  begin
    -- Fremde Schuh-IDs (gehören jemand anderem) nie überschreiben.
    if exists (
      select 1 from jsonb_array_elements(v_shoes) s
      join public.shoes t on t.id = ((s ->> 'id')::uuid)
      where t.user_id <> current_user_id
    ) then
      raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
    end if;
    delete from public.shoe_assignments where user_id = current_user_id;
    delete from public.shoe_defaults where user_id = current_user_id;
    delete from public.shoes t
    where t.user_id = current_user_id
      and t.id not in (select (s ->> 'id')::uuid from jsonb_array_elements(v_shoes) s);
    insert into public.shoes as t (
      id, user_id, sport, name, brand, start_km, replace_km, in_use_since, retired_on
    )
    select (s ->> 'id')::uuid, current_user_id, (s ->> 'sport')::public.endurance_modality, s ->> 'name',
           s ->> 'brand', (s ->> 'start_km')::integer, (s ->> 'replace_km')::integer,
           (s ->> 'in_use_since')::date, (s ->> 'retired_on')::date
    from jsonb_array_elements(v_shoes) s
    on conflict (id) do update
      set sport = excluded.sport, name = excluded.name, brand = excluded.brand, start_km = excluded.start_km,
          replace_km = excluded.replace_km, in_use_since = excluded.in_use_since,
          retired_on = excluded.retired_on, updated_at = now()
      where t.user_id = current_user_id;
    insert into public.shoe_defaults (user_id, sport, valid_from, shoe_id)
    select current_user_id, (d ->> 'sport')::public.endurance_modality, (d ->> 'valid_from')::date,
           (d ->> 'shoe_id')::uuid
    from jsonb_array_elements(v_defaults) d;
    insert into public.shoe_assignments (user_id, activity_key, shoe_id)
    select current_user_id, a ->> 'activity_key', (a ->> 'shoe_id')::uuid
    from jsonb_array_elements(v_assignments) a;
  exception
    when check_violation or foreign_key_violation or unique_violation or not_null_violation
      or invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Schuhe.' using errcode = 'invalid_parameter_value';
  end;
end;
$$;

revoke all on function public.save_shoe_data(jsonb) from public, anon;
grant execute on function public.save_shoe_data(jsonb) to authenticated;

-- delete_my_shoe_data(): alle eigenen Schuh-Angaben löschen (Recht auf Löschung). Gibt die Zahl der Schuhe zurück.
create or replace function public.delete_my_shoe_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deleted integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.shoe_assignments where user_id = current_user_id;
  delete from public.shoe_defaults where user_id = current_user_id;
  delete from public.shoes where user_id = current_user_id;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke all on function public.delete_my_shoe_data() from public, anon;
grant execute on function public.delete_my_shoe_data() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Datenexport (Obermenge der neuesten Fassung 20261021130200_supplement_user_data.sql): zusätzlich shoes,
--    shoe_defaults, shoe_assignments.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'format_version', 1,
    'exported_at', now(),
    'user_id', current_user_id,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id = current_user_id),
      'consents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.granted_at), '[]'::jsonb) from public.consents t where t.user_id = current_user_id),
      'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t where t.user_id = current_user_id),
      'body_measurements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_measurements t where t.user_id = current_user_id),
      'measurement_reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measurement_reminders t where t.user_id = current_user_id),
      'health_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.health_screening t where t.user_id = current_user_id),
      'goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id = current_user_id),
      'user_equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_equipment t where t.user_id = current_user_id),
      'training_slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_slots t where t.user_id = current_user_id),
      'nutrition_prefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.nutrition_prefs t where t.user_id = current_user_id),
      'food_preferences', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_preferences t where t.user_id = current_user_id),
      'admin_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_users t where t.user_id = current_user_id),
      'user_plans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_plans t where t.user_id = current_user_id),
      'planned_sessions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_sessions t where t.user_id = current_user_id),
      'planned_exercises', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_exercises t where t.user_id = current_user_id),
      'session_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.performed_on), '[]'::jsonb) from public.session_logs t where t.user_id = current_user_id),
      'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_logs t where t.user_id = current_user_id),
      'set_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.set_logs t where t.user_id = current_user_id),
      'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cardio_logs t where t.user_id = current_user_id),
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id),
      'meal_plans', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.meal_plans t where t.user_id = current_user_id),
      'meal_plan_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.date, t.slot), '[]'::jsonb) from public.meal_plan_items t where t.user_id = current_user_id),
      'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.shopping_lists t where t.user_id = current_user_id),
      'shopping_list_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shopping_list_items t where t.user_id = current_user_id),
      'recipe_ratings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.recipe_ratings t where t.user_id = current_user_id),
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id),
      'food_log_entries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.eaten_on, t.created_at), '[]'::jsonb) from public.food_log_entries t where t.user_id = current_user_id),
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id),
      'custom_meals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.custom_meals t where t.user_id = current_user_id),
      'custom_meal_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.meal_id, t.order_no), '[]'::jsonb) from public.custom_meal_items t where t.user_id = current_user_id),
      'competitions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.race_date, t.created_at), '[]'::jsonb) from public.competitions t where t.user_id = current_user_id),
      -- Etappe E3: KI-Nutzung (nur Metadaten) und die eigene Beta-Freischaltung (private Tabelle, ohne granted_by).
      'ai_usage', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.ai_usage t where t.user_id = current_user_id),
      'beta_entitlements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from private.my_beta_entitlements() t),
      -- Wächter E3 N4: Protokoll der eigenen Freischaltungen/Entzüge (ohne Admin-Identität `actor`).
      'admin_actions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_admin_actions() t),
      -- Phase 10 S1: eigene Strecken (vereinfachte Linie, Kilometerzeiten; GPX je Strecke erzeugt die App).
      'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb) from public.tracked_routes t where t.user_id = current_user_id),
      -- Etappe E4a: eigene Produkte und die eigenen Abfrage-Zähler (Stunde, Anzahl – ohne Nummern). Der gemeinsame
      -- Zwischenspeicher food_products gehört niemandem und kommt nicht in den Export.
      'user_food_products', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.user_food_products t where t.user_id = current_user_id),
      'food_product_lookup_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_food_product_lookup_counts() t),
      -- Ziele Z3: Wunschgewicht (Gesundheitsdatum; das Nebenziel steht als Spalte in goals).
      'weight_goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.weight_goals t where t.user_id = current_user_id),
      -- Phase 4b Etappe B (PLAN-PHASE-4B 4.7): Plan-Anpassungen, offene Ereignisse der Live-Anpassung (Auslöser und
      -- Zeitpunkte, ohne Verweise) und die eigenen Zähler der Ratenbegrenzung (private Tabellen, Art. 15). Die eigene
      -- Beta-Freischaltung steht seit E3 unter beta_entitlements.
      'plan_adjustments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.plan_adjustments t where t.user_id = current_user_id),
      'adjustment_events', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_adjustment_events() t),
      'live_adjust_hourly_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_live_adjust_hourly_counts() t),
      -- Einkaufen E1 (PLAN-EINKAUFEN-AUSDAUER 3): gelernte Zuordnungen Strichcode → Lebensmittel.
      'shopping_product_links', (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at, t.code), '[]'::jsonb) from public.shopping_product_links t where t.user_id = current_user_id),
      -- Etappe E2 (PLAN-EINKAUFEN-AUSDAUER 4): Anordnung der Übersicht und der Menüleiste.
      'app_layout_settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_layout_settings t where t.user_id = current_user_id),
      -- Phase 8 (Smartwatch, PLAN-PHASE-8 4): Verbindung, übernommene Einheiten, Puls-Zusammenfassungen, Tageswerte.
      'wearable_connections', (select coalesce(jsonb_agg(to_jsonb(t) order by t.provider), '[]'::jsonb) from public.wearable_connections t where t.user_id = current_user_id),
      'wearable_sessions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.session_log_id), '[]'::jsonb) from public.wearable_sessions t where t.user_id = current_user_id),
      'heart_rate_summaries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.session_log_id), '[]'::jsonb) from public.heart_rate_summaries t where t.user_id = current_user_id),
      'daily_metrics', (select coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.provider), '[]'::jsonb) from public.daily_metrics t where t.user_id = current_user_id),
      -- Phase 6 SU3 (Plan 7.3): Supplement-Check und „Meine Supplements“ (Gesundheitsdaten, Art. 9).
      'supplement_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.supplement_screening t where t.user_id = current_user_id),
      'user_supplements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.supplement_id), '[]'::jsonb) from public.user_supplements t where t.user_id = current_user_id)
    -- jsonb_build_object nimmt höchstens 100 Argumente (= 50 Tabellen): weitere Tabellen in einem zweiten Objekt.
    ) || jsonb_build_object(
      -- Schuh-Kilometerzähler (20261025120000_shoes.sql): Schuhe, Standard je Sportart, Wahl je Lauf.
      'shoes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.shoes t where t.user_id = current_user_id),
      'shoe_defaults', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sport, t.valid_from), '[]'::jsonb) from public.shoe_defaults t where t.user_id = current_user_id),
      'shoe_assignments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.activity_key), '[]'::jsonb) from public.shoe_assignments t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
