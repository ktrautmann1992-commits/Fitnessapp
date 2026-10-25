-- Schuh-Kilometerzähler (20261025120400_shoes.sql): RLS (nur eigene Zeilen lesen, kein direktes Schreiben),
-- save_shoe_data (ersetzt den Stand, prüft Form und Grenzen, Standard nur mit Schuh derselben Sportart, keine fremden
-- Schuhe), Löschen eines Schuhs (Standard → null, Wahl entfällt), delete_my_shoe_data, Export, Konto löschen.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1985-05-05');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Ein Schuh als JSON (Felder wie shoeSchema).
create function pg_temp.shoe(p_id text, p_sport text, p_name text, p_since text default '2026-09-01')
returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'sport', p_sport, 'name', p_name, 'brand', 'Marke', 'start_km', 0,
    'replace_km', null, 'in_use_since', p_since, 'retired_on', null)
$$;
grant execute on function pg_temp.shoe(text, text, text, text) to authenticated;

select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.save_shoe_data(jsonb)'::regprocedure), 'save_shoe_data: definer, search_path leer');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.delete_my_shoe_data()'::regprocedure), 'delete_my_shoe_data: definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_shoe_data(jsonb)', 'execute'), 'anon: speichern gesperrt');
select ok(not has_function_privilege('anon', 'public.delete_my_shoe_data()', 'execute'), 'anon: löschen gesperrt');
select ok(not has_table_privilege('authenticated', 'public.shoes', 'insert'), 'kein direktes Einfügen (shoes)');
select ok(not has_table_privilege('authenticated', 'public.shoe_assignments', 'update'),
  'kein direktes Ändern (shoe_assignments)');
select ok(not has_table_privilege('anon', 'public.shoes', 'select'), 'anon liest nichts');
select ok((select relrowsecurity from pg_class where oid = 'public.shoe_defaults'::regclass), 'RLS an (shoe_defaults)');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

select lives_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(
    pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000001', 'run', 'Pegasus 41'),
    pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000002', 'walk', 'Wanderschuh')),
  'defaults', '[{"sport": "run", "valid_from": "2026-09-01", "shoe_id": "aaaaaaaa-0000-4000-8000-000000000001"}]'::jsonb,
  'assignments', '[{"activity_key": "log:bbbbbbbb-0000-4000-8000-000000000001",
                    "shoe_id": "aaaaaaaa-0000-4000-8000-000000000002"},
                   {"activity_key": "route:bbbbbbbb-0000-4000-8000-000000000002", "shoe_id": null}]'::jsonb)) $$,
  'Nutzer A speichert zwei Schuhe, Standard und zwei Wahlen');
select is((select count(*)::integer from public.shoes), 2, 'zwei Schuhe');
select is((select count(*)::integer from public.shoe_assignments), 2, 'zwei Wahlen (eine „ohne Schuh“)');
select is((select shoe_id from public.shoe_defaults where sport = 'run'),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Standard gespeichert');

-- Ersetzen: Name ändern, created_at bleibt.
select lives_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000001', 'run', 'Pegasus 41 (alt)')),
  'defaults', '[{"sport": "run", "valid_from": "2026-09-01", "shoe_id": "aaaaaaaa-0000-4000-8000-000000000001"}]'::jsonb,
  'assignments', '[]'::jsonb)) $$, 'ersetzen');
select is((select array_agg(name) from public.shoes), array['Pegasus 41 (alt)'], 'nur noch ein Schuh, neuer Name');
select is((select count(*)::integer from public.shoe_assignments), 0, 'Wahlen ersetzt');

-- Ungültige Eingaben.
select throws_ok($$ select public.save_shoe_data('{"shoes": [], "defaults": []}'::jsonb) $$,
  '22023', 'Ungültige Schuhe.', 'fehlendes Feld');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000003', 'swim', 'Flossen')),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.', 'Schwimmen abgelehnt');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000003', 'run', repeat('x', 41))),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.', 'Name zu lang');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000003', 'run', 'X')
    || '{"start_km": 5001}'::jsonb),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.', 'Start-km über 5.000');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000003', 'run', 'X')
    || '{"replace_km": 150}'::jsonb),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.', 'Grenze unter 200 km');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000003', 'run', 'X')
    || '{"retired_on": "2026-01-01"}'::jsonb),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.',
  'ausgemustert vor „In Gebrauch seit“');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000001', 'run', 'Pegasus')),
  'defaults', '[{"sport": "bike", "valid_from": "2026-09-01", "shoe_id": "aaaaaaaa-0000-4000-8000-000000000001"}]'::jsonb,
  'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.', 'Standard nur mit Schuh derselben Sportart');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', '[]'::jsonb, 'defaults', '[]'::jsonb,
  'assignments', '[{"activity_key": "log:bbbbbbbb-0000-4000-8000-000000000001",
                    "shoe_id": "aaaaaaaa-0000-4000-8000-000000000009"}]'::jsonb)) $$,
  '22023', 'Ungültige Schuhe.', 'Wahl auf unbekannten Schuh');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', '[]'::jsonb, 'defaults', '[]'::jsonb,
  'assignments', '[{"activity_key": "lauf:1", "shoe_id": null}]'::jsonb)) $$,
  '22023', 'Ungültige Schuhe.', 'Schlüssel der Wahl ungültig');
select is((select count(*)::integer from public.shoes), 1, 'nach Fehlern: Stand unverändert');

-- Nutzer B: sieht nichts von A, darf A's Schuh-ID nicht übernehmen.
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.shoes), 0, 'B sieht A''s Schuhe nicht');
select is((select count(*)::integer from public.shoe_defaults), 0, 'B sieht A''s Standard nicht');
select throws_ok($$ select public.save_shoe_data(jsonb_build_object(
  'shoes', jsonb_build_array(pg_temp.shoe('aaaaaaaa-0000-4000-8000-000000000001', 'run', 'Geklaut')),
  'defaults', '[]'::jsonb, 'assignments', '[]'::jsonb)) $$, '22023', 'Ungültige Schuhe.',
  'fremde Schuh-ID abgelehnt');

-- Ohne Profil: abgelehnt.
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.save_shoe_data('{"shoes": [], "defaults": [], "assignments": []}'::jsonb) $$,
  '42501', 'Profil fehlt.', 'ohne Profil abgelehnt');

-- Export und Löschen (A).
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'shoes'), 1, 'Export enthält die Schuhe');
select ok((public.export_my_data() -> 'data') ?& array['shoe_defaults', 'shoe_assignments'],
  'Export enthält Standard und Wahl');
select is(public.delete_my_shoe_data(), 1, 'Löschen: ein Schuh');
select is((select count(*)::integer from public.shoe_defaults), 0, 'Standard mit gelöscht');

reset role;
-- Schuh direkt löschen (Kaskade/SET NULL): Standard bleibt als „kein Standard“, Wahl entfällt.
insert into public.shoes (id, user_id, sport, name, in_use_since)
values ('aaaaaaaa-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', 'run', 'B-Schuh', '2026-09-01');
insert into public.shoe_defaults values
  ('22222222-2222-4222-8222-222222222222', 'run', '2026-09-01', 'aaaaaaaa-0000-4000-8000-000000000005');
insert into public.shoe_assignments (user_id, activity_key, shoe_id) values
  ('22222222-2222-4222-8222-222222222222', 'log:bbbbbbbb-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000005');
delete from public.shoes where id = 'aaaaaaaa-0000-4000-8000-000000000005';
select is((select shoe_id from public.shoe_defaults where user_id = '22222222-2222-4222-8222-222222222222'),
  null::uuid, 'Schuh gelöscht → Standard null');
select is((select count(*)::integer from public.shoe_assignments
           where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'Schuh gelöscht → Wahl entfällt');

-- Konto löschen: Kaskade.
insert into public.shoes (id, user_id, sport, name, in_use_since)
values ('aaaaaaaa-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'bike', 'Klick', '2026-09-01');
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.shoes where user_id = '22222222-2222-4222-8222-222222222222'), 0,
  'Konto löschen löscht die Schuhe');

select * from finish();
rollback;
