-- Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7): Widerruf und Datenexport. Beide Funktionen als Obermenge der
-- neuesten Fassung (20261021130200_supplement_user_data.sql) Zeile für Zeile übernommen (db-sync.test.ts):
-- 1. private.consents_after_revoke: Widerruf health_data löscht zusätzlich alle pain_episodes (Art. 9) – am Anfang
--    und noch einmal am Ende (wie die übrigen Tabellen, falls gleichzeitig gespeichert wurde).
-- 2. public.export_my_data: zusätzlich pain_episodes und travel_modes (Art. 15).
-- Konto löschen: beide Tabellen hängen per on delete cascade an auth.users.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Widerruf
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    -- 4b (PLAN-PHASE-4B 4.7): ZUERST alle Plan-Anpassungen aus Gesundheits-Plänen bzw. mit Körperdaten (mittelbare
    -- Gesundheitsdaten); die übrigen Anpassungen dieser Pläne fallen danach per Kaskade mit den Plänen weg. Ereignisse
    -- zu Messungen und Zielen (nur Verweise; Ziele inkl. Wunschgewicht – sichere Voreinstellung) gehen ebenfalls.
    delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);
    delete from private.adjustment_events
    where user_id = new.user_id and trigger in ('measurement_updated', 'goal_changed');
    perform private.neutralize_health_plan_logs(new.user_id);
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    -- Supplement-Modul (Phase 6 SU3, Plan 7.3/11.1): Supplement-Check und „Meine Supplements“ ganz gelöscht.
    delete from public.supplement_screening where user_id = new.user_id;
    delete from public.user_supplements where user_id = new.user_id;
    -- Wunschgewicht (Ziele Z3, docs/PLAN-ZIELE.md 5.2): Gesundheitsdatum, ganz gelöscht.
    delete from public.weight_goals where user_id = new.user_id;
    -- Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7): Schmerz-Einträge (Art. 9) ganz gelöscht.
    delete from public.pain_episodes where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    -- Wettkämpfe (Phase 10 WP3): nur den aus dem Gesundheits-Check abgeleiteten Plan-Bezug leeren.
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    -- Ernährungstagebuch (E1, A-G12): alle Einträge. Favoriten: Schnell-Favoriten enthalten Bezeichnung + kcal
    -- („Süßes 250 kcal“) und gehen mit (Wächter E1 G1, sichere Voreinstellung); Katalog-/Rezept-Favoriten speichern
    -- keine Werte (S1) und bleiben (A-G14).
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';
    -- E4a (E4-G10): Produkt-Favoriten (Marken verraten Konsum) und eigene Produkte (Name/Marke sind Freitext) –
    -- sichere Voreinstellung wie Schnell-Favoriten und eigene Gerichte. Favoriten eigener Produkte gehen zusätzlich per
    -- Kaskade mit. Der gemeinsame Zwischenspeicher food_products enthält nichts von der Person.
    delete from public.food_log_favorites where user_id = new.user_id and source = 'product';
    delete from public.user_food_products where user_id = new.user_id;
    -- Einkaufen E1 (PLAN-EINKAUFEN-AUSDAUER 3): gelernte Zuordnungen Strichcode → Lebensmittel verraten Konsum wie
    -- Produkt-Favoriten (E4a) – sichere Voreinstellung: ganz gelöscht.
    delete from public.shopping_product_links where user_id = new.user_id;
    -- Eigene Gerichte (E2): Name ist Freitext, Werte selbst eingegeben – sichere Voreinstellung wie die
    -- Schnell-Favoriten (Wächter E1 G1): gelöscht, Zutaten per Kaskade (Gründer-Frage E2-G1 im Plan).
    delete from public.custom_meals where user_id = new.user_id;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
    -- Ebenso Pläne, Listen und Tagebuch (Wächter N7 S2): Die speichernden Funktionen sperren die Einwilligung FOR
    -- SHARE, der Widerruf wartet also auf sie; jede Anweisung sieht danach den neuesten Stand. Die Wiederholung fängt
    -- zusätzlich ab, was während der Lösch-Anweisungen oben fertig geworden ist.
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.custom_meals where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'product';
    delete from public.user_food_products where user_id = new.user_id;
    delete from public.shopping_product_links where user_id = new.user_id;
    delete from public.weight_goals where user_id = new.user_id;
    delete from public.pain_episodes where user_id = new.user_id;
    delete from public.supplement_screening where user_id = new.user_id;
    delete from public.user_supplements where user_id = new.user_id;
    delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
  end if;
  -- Phase 8 (Smartwatch, W8-5/W8-12): Widerruf von wearable_data ODER health_data löscht Pulsdaten, Tageswerte und die
  -- Verbindung sofort. Übernommene Einheiten bleiben als normale Tagebuch-Einträge ohne Puls (wearable_sessions bleibt,
  -- wie „Trennen – behalten“). import_wearable_batch sperrt beide Einwilligungen FOR SHARE – der Widerruf wartet also
  -- auf einen laufenden Abgleich und sieht danach dessen Zeilen.
  if new.consent_type in ('health_data', 'wearable_data') then
    delete from public.heart_rate_summaries where user_id = new.user_id;
    delete from public.daily_metrics where user_id = new.user_id;
    delete from public.wearable_connections where user_id = new.user_id;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;
revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Datenexport
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
    -- jsonb_build_object nimmt höchstens 100 Argumente (50 Schlüssel) – weitere Tabellen in einem zweiten Objekt.
    ) || jsonb_build_object(
      -- Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7): Schmerz-Einträge (Art. 9) und Reise-Zeiträume.
      'pain_episodes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_on, t.created_at), '[]'::jsonb) from public.pain_episodes t where t.user_id = current_user_id),
      'travel_modes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.starts_on, t.created_at), '[]'::jsonb) from public.travel_modes t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
