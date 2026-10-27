-- „App verschlanken“ (Gründer-Freigabe 26.10.2026, 20261026150000_app_layout_version.sql): save_app_layout nimmt optional
-- die Fassung der Anordnung (layout_version 1–99) an; ohne Feld (ältere App-Fassung) wird null gespeichert; die neue
-- Standard-Leiste mit 5 Knöpfen ist erlaubt; Schrittziel und alle bisherigen Regeln bleiben; Lesen nur die eigene
-- Zeile; direktes Schreiben gesperrt.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1985-05-05');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.layout(p_tabs jsonb, p_tiles jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('dashboard_tiles', p_tiles, 'tab_bar', p_tabs)
$$;
grant execute on function pg_temp.layout(jsonb, jsonb) to authenticated;

select has_column('public', 'app_layout_settings', 'layout_version', 'Spalte layout_version vorhanden');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.save_app_layout(jsonb)'::regprocedure), 'security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_app_layout(jsonb)', 'execute'),
  'anon: Funktion nicht ausführbar');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

-- Neuer Standard (5 Knöpfe) mit Fassung 2 und Schrittziel.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}, {"id": "progress", "visible": true},
    {"id": "workouts", "visible": false}, {"id": "shortcuts", "visible": false}]'
) || '{"layout_version": 2, "step_goal": 9000}'::jsonb) $$, 'neuer Standard mit Fassung 2 erlaubt');
select is((select layout_version::integer from public.app_layout_settings), 2, 'Fassung gespeichert');
select is((select step_goal from public.app_layout_settings), 9000, 'Schrittziel gespeichert');
select is((select jsonb_array_length(tab_bar) from public.app_layout_settings), 5, '5 Knöpfe gespeichert');

-- Ältere App-Fassung (ohne Feld) → Fassung null, Schrittziel bleibt.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}]')) $$, 'alte Anordnung ohne Fassung erlaubt');
select is((select layout_version from public.app_layout_settings), null::smallint, 'ohne Feld: Fassung null');
select is((select step_goal from public.app_layout_settings), 9000, 'Schrittziel bleibt ohne Feld');

-- Fassung null ausdrücklich erlaubt.
select lives_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"layout_version": null}'::jsonb) $$,
  'Fassung null erlaubt');

-- Ungültige Fassungen und Felder.
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"layout_version": 0}'::jsonb) $$,
  '22023', 'Ungültige Fassung.', 'Fassung 0 abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"layout_version": 100}'::jsonb) $$,
  '22023', 'Ungültige Fassung.', 'Fassung über 99 abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"layout_version": 2.5}'::jsonb) $$,
  '22023', 'Ungültige Fassung.', 'Kommazahl abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"layout_version": "2"}'::jsonb) $$,
  '22023', 'Ungültige Fassung.', 'Text statt Zahl abgelehnt');
select throws_ok($$ select public.save_app_layout(
  '{"dashboard_tiles": [], "layout_version": 2}'::jsonb) $$,
  '22023', 'Ungültige Anordnung.', 'ohne Menüleiste abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"version": 2}'::jsonb) $$,
  '22023', 'Ungültige Anordnung.', 'unbekanntes Feld abgelehnt');

-- Direktes Schreiben gesperrt; andere Person sieht die Zeile nicht.
select throws_ok($$ update public.app_layout_settings set layout_version = 2 $$,
  '42501', null, 'direktes Ändern gesperrt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.app_layout_settings), 0, 'RLS: fremde Zeile unsichtbar');

select * from finish();
rollback;
