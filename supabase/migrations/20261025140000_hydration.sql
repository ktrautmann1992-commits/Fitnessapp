-- Trinken-Tracker (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-10.md Nachtrag „Trinken“). NUR ADDITIV:
-- 1. Tabelle hydration_logs (getrunkene Menge in ml je Tag) – RLS nur eigene Zeilen lesen; schreiben nur über die
--    Funktionen (add_hydration, delete_hydration, delete_all_hydration).
-- 2. export_my_data(): Obermenge der neuesten Fassung (20261021130200_supplement_user_data.sql), Zeile für Zeile
--    übernommen, zusätzlich hydration_logs (Art. 15/20; db-sync.test.ts prüft die Obermenge).
-- Konto löschen: Kaskade über auth.users. Kein Art.-9-Gesundheitsdatum im engeren Sinn (Trinkmenge ohne Diagnose), aber
-- Nutzerdaten: streng privat, kein Partner-Zugriff, nie in Logs. Das Tagesziel rechnet die App (packages/core, HYDRATION)
-- und speichert es nicht.
-- Grenzen = packages/core/src/constants.ts HYDRATION (entryMl 50–2.000, maxEntriesPerDay 40, backfillDays 14).

create table public.hydration_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  amount_ml integer not null check (amount_ml between 50 and 2000),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.hydration_logs is
  'Getrunkene Mengen (ml je Eintrag und Tag), Trinken-Tracker 25.10.2026. Nur eigene Zeilen; schreiben nur über '
  'add_hydration/delete_hydration/delete_all_hydration.';

create index hydration_logs_user_day_idx on public.hydration_logs (user_id, day);

alter table public.hydration_logs enable row level security;
revoke all on table public.hydration_logs from anon, authenticated;
grant select on table public.hydration_logs to authenticated;
grant all on table public.hydration_logs to service_role;

create policy "Nutzer sehen eigene Trink-Einträge"
  on public.hydration_logs for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- add_hydration(p_entry jsonb) → id. Felder = hydrationEntrySchema (id, day, amount_ml). Warteschlange: dieselbe
-- eigene id erneut → unverändert; id einer anderen Person → neue id (ohne unterscheidbare Meldung). Tag: heute
-- (Europe/Berlin) bis 14 Tage zurück; höchstens 40 Einträge je Tag.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.add_hydration(p_entry jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_keys constant text[] := array['id', 'day', 'amount_ml'];
  -- sync: HYDRATION in packages/core/src/constants.ts
  max_per_day constant integer := 40;
  backfill_days constant integer := 14;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  v_id uuid;
  v_day date;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception 'Ungültige Angaben zum Trinken.' using errcode = 'invalid_parameter_value';
  end if;
  perform private.assert_json_keys(p_entry, entry_keys, 'Trinken');
  if not (p_entry ?& entry_keys)
     or jsonb_typeof(p_entry -> 'id') <> 'string'
     or jsonb_typeof(p_entry -> 'day') <> 'string'
     or (p_entry ->> 'day') !~ '^\d{4}-\d{2}-\d{2}$'
     or not private.jsonb_number_between(p_entry -> 'amount_ml', 50, 2000, 0) then
    raise exception 'Ungültige Angaben zum Trinken.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (p_entry ->> 'id')::uuid;
    v_day := (p_entry ->> 'day')::date;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Angaben zum Trinken.' using errcode = 'invalid_parameter_value';
  end;
  if v_day > today or v_day < today - backfill_days then
    raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.hydration_logs h where h.id = v_id and h.user_id = current_user_id) then
    return v_id;
  end if;
  if exists (select 1 from public.hydration_logs h where h.id = v_id) then
    v_id := gen_random_uuid();
  end if;
  perform pg_advisory_xact_lock(hashtext('hydration|' || current_user_id::text));
  if (select count(*) from public.hydration_logs h where h.user_id = current_user_id and h.day = v_day)
     >= max_per_day then
    raise exception 'An diesem Tag sind schon sehr viele Einträge gespeichert.' using errcode = 'program_limit_exceeded';
  end if;
  insert into public.hydration_logs (id, user_id, day, amount_ml)
  values (v_id, current_user_id, v_day, (p_entry ->> 'amount_ml')::integer);
  return v_id;
end;
$$;

revoke all on function public.add_hydration(jsonb) from public, anon;
grant execute on function public.add_hydration(jsonb) to authenticated;

create or replace function public.delete_hydration(p_id uuid)
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
  -- Schon gelöscht (Warteschlange) ist kein Fehler.
  delete from public.hydration_logs h where h.id = p_id and h.user_id = current_user_id;
end;
$$;

revoke all on function public.delete_hydration(uuid) from public, anon;
grant execute on function public.delete_hydration(uuid) to authenticated;

create or replace function public.delete_all_hydration()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.hydration_logs h where h.user_id = current_user_id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.delete_all_hydration() from public, anon;
grant execute on function public.delete_all_hydration() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Datenexport (Obermenge der neuesten Fassung 20261021130200_supplement_user_data.sql): zusätzlich hydration_logs.
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
      'user_supplements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.supplement_id), '[]'::jsonb) from public.user_supplements t where t.user_id = current_user_id),
      -- Trinken-Tracker (25.10.2026): getrunkene Mengen je Tag.
      'hydration_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.created_at, t.id), '[]'::jsonb) from public.hydration_logs t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
