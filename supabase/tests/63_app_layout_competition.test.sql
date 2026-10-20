-- Wettkampfplan leicht finden (Gründer-Rückmeldung 20.10.2026, 20261020220000_app_layout_competition.sql): save_app_layout
-- kennt die Kachel „competition“ und den Bereich „wettkampf“; alte Anordnungen ohne sie bleiben gültig; die übrigen
-- Regeln (Rechte, Menüleiste, unbekannte IDs) gelten unverändert.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.layout(p_tabs jsonb, p_tiles jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('dashboard_tiles', p_tiles, 'tab_bar', p_tabs)
$$;
grant execute on function pg_temp.layout(jsonb, jsonb) to authenticated;

select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.save_app_layout(jsonb)'::regprocedure), 'security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_app_layout(jsonb)', 'execute'),
  'anon: Funktion nicht ausführbar');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

-- Alle 8 Kacheln (mit „Mein Wettkampf“) und der Standard der Menüleiste.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}, {"id": "competition", "visible": true},
    {"id": "workouts", "visible": true}, {"id": "nutrition", "visible": true}, {"id": "body", "visible": true},
    {"id": "progress", "visible": true}, {"id": "endurance", "visible": true}, {"id": "shortcuts", "visible": true}]'
)) $$, 'Kachel „competition“ erlaubt');
select is((select dashboard_tiles -> 1 from public.app_layout_settings),
  '{"id": "competition", "visible": true}'::jsonb, 'Kachel gespeichert');

-- „Wettkampf“ als Knopf (wählbar), auch an letzter Stelle vor „Mehr“.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "ernaehrung", "einkaufsliste", "wettkampf", "mehr"]',
  '[{"id": "competition", "visible": false}]')) $$, 'Bereich „wettkampf“ erlaubt');
select is((select tab_bar ->> 4 from public.app_layout_settings), 'wettkampf', 'Knopf gespeichert');

-- Alte Anordnung (vor dem 20.10.2026, ohne die neuen IDs) bleibt gültig.
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]',
  '[{"id": "training", "visible": true}, {"id": "workouts", "visible": false}]')) $$,
  'alte Anordnung ohne neue IDs erlaubt');

-- Regeln unverändert.
select throws_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "wettkampf", "mehr"]', '[]')) $$,
  '22023', null, '7 Knöpfe (mit Wettkampf) abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "wettkampf", "wettkampf", "mehr"]', '[]')) $$,
  '22023', 'Ungültige Menüleiste.', 'doppelter Knopf „wettkampf“ abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "today", "mehr"]',
  '[{"id": "competition", "visible": true}, {"id": "competition", "visible": false}]')) $$,
  '22023', 'Kachel doppelt.', 'doppelte Kachel „competition“ abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "today", "mehr"]',
  '[{"id": "wettkampf", "visible": true}]')) $$,
  '22023', 'Ungültige Kachel.', 'Bereichs-ID ist keine Kachel');

select * from finish();
rollback;
