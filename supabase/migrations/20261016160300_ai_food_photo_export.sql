-- Etappe E3 · Datenexport (Art. 15 DSGVO) um Gericht per Foto erweitert: export_my_data() – NEUESTE Fassung
-- (20261016140200_competition_rpcs.sql) unverändert übernommen und nur um drei Schlüssel ergänzt (echte Obermenge, db-sync.test.ts und pgTAP 37
-- prüfen, dass alle bisherigen Bereiche erhalten bleiben):
-- - `ai_usage`: eigene Zeilen (nur Metadaten: Funktion, Status, Modell, Token, Kosten, Zeitpunkte),
-- - `beta_entitlements`: die eigene Beta-Freischaltung (Art, erteilt, Ablauf, Limits – ohne granted_by), PLAN-4B 4.7,
-- - `admin_actions`: das Protokoll der eigenen Freischaltungen und Entzüge ohne `actor` (Wächter E3 N4).
-- export_my_data bleibt security invoker; die private Tabelle liest nur die kleine Hilfsfunktion unten (security definer,
-- nur die EIGENE Zeile).

create or replace function private.my_beta_entitlements()
returns table (
  entitlement text, granted_at timestamptz, expires_at timestamptz, monthly_limit integer, daily_limit integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.entitlement, b.granted_at, b.expires_at, b.monthly_limit, b.daily_limit
  from private.beta_entitlements b
  where b.user_id = auth.uid();
$$;
revoke all on function private.my_beta_entitlements() from public, anon;
grant execute on function private.my_beta_entitlements() to authenticated;

-- Wächter E3 N4: eigene Einträge in private.admin_actions (Art. 15) – Aktion und Zeitpunkte, OHNE `actor` (GitHub-Name
-- der Gründer) und ohne Flag-Aktionen (die haben keinen Personenbezug).
create or replace function private.my_admin_actions()
returns table (action text, expires_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.action, a.expires_at, a.created_at
  from private.admin_actions a
  where a.target_user_id = auth.uid();
$$;
revoke all on function private.my_admin_actions() from public, anon;
grant execute on function private.my_admin_actions() to authenticated;

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
      'admin_actions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_admin_actions() t)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
