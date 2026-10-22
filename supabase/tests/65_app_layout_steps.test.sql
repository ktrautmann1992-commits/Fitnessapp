-- Kachel „Schritte“ mit Tagesziel (Gründer-Wunsch 22.10.2026, 20261022130000_app_layout_steps.sql): save_app_layout
-- kennt die Kachel „steps“ und das optionale Schrittziel (1.000–30.000, je 500); fehlt das Feld, bleibt das gespeicherte
-- Ziel; alte Anordnungen bleiben gültig; Lesen nur die eigene Zeile; direktes Schreiben gesperrt.
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

select has_column('public', 'app_layout_settings', 'step_goal', 'Spalte step_goal vorhanden');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.save_app_layout(jsonb)'::regprocedure), 'security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_app_layout(jsonb)', 'execute'),
  'anon: Funktion nicht ausführbar');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

-- Alle 9 Kacheln (mit „Schritte“) ohne Ziel → Ziel null (= Standard).
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}, {"id": "competition", "visible": true},
    {"id": "workouts", "visible": true}, {"id": "nutrition", "visible": true}, {"id": "body", "visible": true},
    {"id": "progress", "visible": true}, {"id": "endurance", "visible": true}, {"id": "steps", "visible": true},
    {"id": "shortcuts", "visible": true}]'
)) $$, 'Kachel „steps“ erlaubt');
select is((select dashboard_tiles -> 7 from public.app_layout_settings),
  '{"id": "steps", "visible": true}'::jsonb, 'Kachel gespeichert');
select is((select step_goal from public.app_layout_settings), null::integer, 'ohne Ziel: null (Standard)');

-- Ziel setzen.
select lives_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[{"id": "steps", "visible": true}]')
  || '{"step_goal": 10500}'::jsonb) $$, 'Schrittziel 10.500 erlaubt');
select is((select step_goal from public.app_layout_settings), 10500, 'Ziel gespeichert');

-- Ältere App-Fassung (ohne Feld) ändert nur die Anordnung – das Ziel bleibt.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}, {"id": "workouts", "visible": false}]')) $$,
  'alte Anordnung ohne neue Kachel und ohne Ziel erlaubt');
select is((select step_goal from public.app_layout_settings), 10500, 'Ziel bleibt ohne Feld');

-- null setzt auf den Standard zurück.
select lives_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"step_goal": null}'::jsonb) $$,
  'Ziel null erlaubt');
select is((select step_goal from public.app_layout_settings), null::integer, 'Ziel zurückgesetzt');

-- Ungültige Ziele.
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"step_goal": 500}'::jsonb) $$,
  '22023', 'Ungültiges Schrittziel.', 'unter 1.000 abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"step_goal": 30500}'::jsonb) $$,
  '22023', 'Ungültiges Schrittziel.', 'über 30.000 abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"step_goal": 8250}'::jsonb) $$,
  '22023', 'Ungültiges Schrittziel.', 'nicht im 500er-Raster abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"step_goal": "8000"}'::jsonb) $$,
  '22023', 'Ungültiges Schrittziel.', 'Text statt Zahl abgelehnt');
select throws_ok($$ select public.save_app_layout(
  pg_temp.layout('["uebersicht", "today", "mehr"]', '[]') || '{"steps": 8000}'::jsonb) $$,
  '22023', 'Ungültige Anordnung.', 'unbekanntes Feld abgelehnt');

-- Direktes Schreiben gesperrt; andere Person sieht die Zeile nicht.
select throws_ok($$ update public.app_layout_settings set step_goal = 5000 $$,
  '42501', null, 'direktes Ändern gesperrt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.app_layout_settings), 0, 'RLS: fremde Zeile unsichtbar');

select * from finish();
rollback;
