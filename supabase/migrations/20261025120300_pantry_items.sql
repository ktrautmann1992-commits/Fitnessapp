-- Vorratsschrank (Gründer-Freigabe 25.10.2026, KONZEPT 6.13 „Vorratsschrank“, Logik packages/core/src/nutrition/pantry.ts).
-- Rein additiv:
-- 1. pantry_items: je Person und Lebensmittel des Katalogs eine Zeile – Menge in Kaufeinheiten (optional, 0,5–99 in
--    halben Schritten), Packungsgröße (optional, nur mit Menge), „fast leer“. SENSIBEL wie gelernte Strichcode-
--    Zuordnungen (Konsum; Vorrat kann auf Unverträglichkeiten schließen lassen): nur mit gültiger Einwilligung
--    health_data, beim Widerruf gelöscht, im Export, beim Konto-Löschen per Kaskade, Partner-Modus sieht nichts.
--    Lesen per RLS nur eigene Zeilen; Schreiben nur über save_pantry_item / delete_pantry_item (security definer,
--    search_path = '', REVOKE public/anon). Grenzen = PANTRY in packages/core/src/constants.ts (db-sync.test.ts).
-- 2. save_pantry_item: neu/ersetzen, „letzter Stand gewinnt“ über den Zeitpunkt des Geräts (offline-first: die App
--    reiht Änderungen in die verschlüsselte Ernährungs-Warteschlange ein und sendet sie später). Ein älterer Stand als
--    der gespeicherte wird still übergangen (`stale`). Höchstens items_max Einträge (`limit`).
-- 3. delete_pantry_item: geht immer (Recht auf Löschung, auch ohne Einwilligung).
-- 4. Widerruf health_data → Vorrat löschen: EIGENER Trigger (wie consents_after_revoke_cycle), damit
--    private.consents_after_revoke unberührt bleibt.
-- 5. Datenexport: neueste Fassung (20261021130200_supplement_user_data.sql) unverändert übernommen, zusätzlich
--    pantry_items (Obermenge, db-sync.test.ts). Hinweis: jsonb_build_object nimmt höchstens 100 Argumente – „data“ hat
--    damit 50 Schlüssel (= 100 Argumente); der nächste Schlüssel braucht ein zweites jsonb_build_object (… || …).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------------------------------------------
create table public.pantry_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null references public.foods (id) on update cascade on delete cascade,
  -- sync: PANTRY.countStep / countMax
  count numeric(3, 1) check (count is null or (count >= 0.5 and count <= 99 and mod(count * 2, 1) = 0)),
  -- sync: PANTRY.packSizeMax
  pack_size integer check (pack_size is null or (pack_size >= 1 and pack_size <= 5000)),
  low boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, food_id),
  constraint pantry_items_pack_size_needs_count check (count is not null or pack_size is null)
);

comment on table public.pantry_items is
  'SENSIBEL (Art. 9 vorsorglich, Konsum): Vorratsschrank je Person (Lebensmittel des Katalogs, Menge in '
  'Kaufeinheiten, „fast leer“). Nur mit Einwilligung health_data, beim Widerruf gelöscht, nie loggen. Schreiben nur '
  'über save_pantry_item / delete_pantry_item.';

create index pantry_items_food_idx on public.pantry_items (food_id);

alter table public.pantry_items enable row level security;
revoke all on table public.pantry_items from public, anon, authenticated;
grant select on table public.pantry_items to authenticated;
grant all on table public.pantry_items to service_role;

create policy "Nutzer sehen eigenen Vorrat"
  on public.pantry_items for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_pantry_item(p_food_id, p_count, p_pack_size, p_low, p_at) → {"result": "saved" | "stale" | "limit"}
--    Sperr-Reihenfolge (Wächter N7 S2): Einwilligung FOR SHARE → prüfen → Person (Advisory) → Zeilen.
--    p_at = Zeitpunkt der Änderung auf dem Gerät; höchstens „jetzt“ (eine vorgehende Geräte-Uhr gewinnt nicht ewig).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_pantry_item(
  p_food_id text,
  p_count numeric,
  p_pack_size integer,
  p_low boolean,
  p_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: PANTRY.itemsMax in packages/core/src/constants.ts
  items_max constant integer := 300;
  current_user_id uuid := auth.uid();
  v_at timestamptz := least(coalesce(p_at, clock_timestamp()), clock_timestamp());
  v_existing timestamptz;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if p_food_id is null or not exists (select 1 from public.foods f where f.id = p_food_id) then
    raise exception 'Unbekanntes Lebensmittel.' using errcode = 'invalid_parameter_value';
  end if;
  if p_low is null
    or (p_count is not null and (p_count < 0.5 or p_count > 99 or mod(p_count * 2, 1) <> 0))
    or (p_pack_size is not null and (p_count is null or p_pack_size < 1 or p_pack_size > 5000)) then
    raise exception 'Ungültige Menge.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('pantry_items|' || current_user_id::text));
  select i.updated_at into v_existing
  from public.pantry_items i
  where i.user_id = current_user_id and i.food_id = p_food_id
  for update;
  if found then
    if v_existing > v_at then
      return jsonb_build_object('result', 'stale');
    end if;
    update public.pantry_items
    set count = p_count, pack_size = p_pack_size, low = p_low, updated_at = v_at
    where user_id = current_user_id and food_id = p_food_id;
    return jsonb_build_object('result', 'saved');
  end if;
  if (select count(*) from public.pantry_items i where i.user_id = current_user_id) >= items_max then
    return jsonb_build_object('result', 'limit');
  end if;
  insert into public.pantry_items (user_id, food_id, count, pack_size, low, updated_at)
  values (current_user_id, p_food_id, p_count, p_pack_size, p_low, v_at);
  return jsonb_build_object('result', 'saved');
end;
$$;

revoke all on function public.save_pantry_item(text, numeric, integer, boolean, timestamptz) from public, anon;
grant execute on function public.save_pantry_item(text, numeric, integer, boolean, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. delete_pantry_item(p_food_id): geht immer (Recht auf Löschung, auch ohne Einwilligung).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_pantry_item(p_food_id text)
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
  delete from public.pantry_items i where i.user_id = current_user_id and i.food_id = p_food_id;
end;
$$;

revoke all on function public.delete_pantry_item(text) from public, anon;
grant execute on function public.delete_pantry_item(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Widerruf health_data → Vorrat löschen (eigener Trigger). save_pantry_item sperrt die Einwilligung FOR SHARE: Der
--    Widerruf wartet auf laufende Speichervorgänge und löscht danach alles.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke_pantry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pantry_items where user_id = new.user_id;
  return null;
end;
$$;
revoke all on function private.consents_after_revoke_pantry() from public, anon, authenticated, service_role;

create trigger consents_after_revoke_pantry
  after update of revoked_at on public.consents
  for each row
  when (old.revoked_at is null and new.revoked_at is not null and new.consent_type = 'health_data')
  execute function private.consents_after_revoke_pantry();

-- ---------------------------------------------------------------------------------------------------------
-- 5. Datenexport (Obermenge der neuesten Fassung 20261021130200_supplement_user_data.sql): zusätzlich pantry_items.
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
      -- Vorratsschrank (25.10.2026): Lebensmittel, Menge in Kaufeinheiten, „fast leer“.
      'pantry_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.food_id), '[]'::jsonb) from public.pantry_items t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
