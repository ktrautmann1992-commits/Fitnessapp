-- Vorratsschrank (Gründer-Freigabe 25.10.2026): pantry_items, save_pantry_item, delete_pantry_item, Widerruf-Trigger,
-- Export. Rechte (auch anon), security definer, Sperr-Reihenfolge, Login/Profil/Einwilligung, Lebensmittel und Menge
-- (halbe Schritte, Packungsgröße nur mit Menge), „letzter Stand gewinnt“ (älterer Stand → stale, Zukunft gekappt),
-- höchstens 300 (limit), Isolation (fremder Vorrat unsichtbar), Löschen ohne Einwilligung, Widerruf löscht, Export,
-- Kaskade (Konto und Lebensmittel).
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- A: Einwilligung. B: ohne Einwilligung. C: ohne Profil. D: Einwilligung (fremde Person).
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
select id, 1, 'published', id, 'pasta_rice_grains', true, '{}', '{}', '{}', false, false, 2, true,
  '{"nutrients_per_100g": {"kcal": 350, "protein_g": 7, "carbs_g": 78, "fat_g": 1}, "units": {}}'
from (select 'vorrat-' || n as id from generate_series(1, 302) n) f;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.pantry_items'::regclass), 'RLS an');
select ok(has_table_privilege('authenticated', 'public.pantry_items', 'select')
          and not has_table_privilege('authenticated', 'public.pantry_items', 'insert')
          and not has_table_privilege('authenticated', 'public.pantry_items', 'update')
          and not has_table_privilege('authenticated', 'public.pantry_items', 'delete'),
  'authenticated: nur lesen (schreiben nur über die Funktionen)');
select ok(not has_table_privilege('anon', 'public.pantry_items', 'select'), 'anon: nicht lesbar');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.oid in ('public.save_pantry_item(text, numeric, integer, boolean, timestamptz)'::regprocedure,
                                  'public.delete_pantry_item(text)'::regprocedure,
                                  'private.consents_after_revoke_pantry()'::regprocedure)),
  'save/delete/Widerruf: security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_pantry_item(text, numeric, integer, boolean, timestamptz)', 'execute')
          and not has_function_privilege('anon', 'public.delete_pantry_item(text)', 'execute'),
  'anon: Funktionen nicht ausführbar');
select ok(
  (select position('for share' in p.prosrc) between 1 and position('has_valid_consent' in p.prosrc)
          and position('has_valid_consent' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_pantry_item(text, numeric, integer, boolean, timestamptz)'::regprocedure),
  'save: Einwilligung FOR SHARE → prüfen → Advisory-Sperre');

-- ---------------------------------------------------------------------------------------------------------
-- Anmeldung, Profil, Einwilligung, Eingaben
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.save_pantry_item('vorrat-1', null, null, false, now()) $$, '42501',
  'Nicht angemeldet.', 'ohne Anmeldung abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.save_pantry_item('vorrat-1', null, null, false, now()) $$, '42501', 'Profil fehlt.',
  'ohne Profil abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.save_pantry_item('vorrat-1', null, null, false, now()) $$, '42501',
  'Einwilligung Gesundheitsdaten fehlt.', 'ohne Einwilligung abgelehnt (Vorrat = sensibel)');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.save_pantry_item('gibt-es-nicht', null, null, false, now()) $$, '22023',
  'Unbekanntes Lebensmittel.', 'unbekanntes Lebensmittel abgelehnt');
select throws_ok($$ select public.save_pantry_item('vorrat-1', 0.3, null, false, now()) $$, '22023',
  'Ungültige Menge.', 'Menge nicht in halben Schritten abgelehnt');
select throws_ok($$ select public.save_pantry_item('vorrat-1', 99.5, null, false, now()) $$, '22023',
  'Ungültige Menge.', 'Menge über 99 abgelehnt');
select throws_ok($$ select public.save_pantry_item('vorrat-1', null, 500, false, now()) $$, '22023',
  'Ungültige Menge.', 'Packungsgröße ohne Menge abgelehnt');
select throws_ok($$ select public.save_pantry_item('vorrat-1', 1, 5001, false, now()) $$, '22023',
  'Ungültige Menge.', 'Packungsgröße über 5.000 abgelehnt');
select throws_ok($$ select public.save_pantry_item('vorrat-1', 1, null, null, now()) $$, '22023',
  'Ungültige Menge.', '„fast leer“ fehlt → abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern, letzter Stand gewinnt, Grenze, Isolation
-- ---------------------------------------------------------------------------------------------------------
select is(public.save_pantry_item('vorrat-1', 2, 500, false, now() - interval '1 hour') ->> 'result', 'saved',
  'A speichert mit Menge und Packungsgröße');
select is((select count from public.pantry_items where food_id = 'vorrat-1'), 2.0::numeric(3, 1), 'Menge gespeichert');
select is(public.save_pantry_item('vorrat-1', null, null, true, now() - interval '2 hours') ->> 'result', 'stale',
  'älterer Stand (offline nachgereicht) → stale');
select is((select count from public.pantry_items where food_id = 'vorrat-1'), 2.0::numeric(3, 1),
  'älterer Stand überschreibt nichts');
select is(public.save_pantry_item('vorrat-1', 0.5, null, true, now()) ->> 'result', 'saved', 'neuerer Stand ersetzt');
select ok((select low and count = 0.5 and pack_size is null from public.pantry_items where food_id = 'vorrat-1'),
  'fast leer, halbe Packung');
select is(public.save_pantry_item('vorrat-2', null, null, false, now() + interval '10 days') ->> 'result', 'saved',
  'Zeitpunkt in der Zukunft');
select ok((select updated_at <= clock_timestamp() from public.pantry_items where food_id = 'vorrat-2'),
  'Zeitpunkt in der Zukunft wird auf „jetzt“ gekappt');
select lives_ok($$ select public.save_pantry_item('vorrat-' || n, null, null, false, now()) from generate_series(3, 300) n $$,
  'bis 300 Einträge speichern');
select is((select count(*)::integer from public.pantry_items), 300, '300 Einträge');
select is(public.save_pantry_item('vorrat-301', null, null, false, now()) ->> 'result', 'limit',
  'Eintrag 301 → limit');
select is(public.save_pantry_item('vorrat-300', 1, null, false, now()) ->> 'result', 'saved',
  'bestehenden Eintrag ändern geht auch an der Grenze');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(public.save_pantry_item('vorrat-1', 1, null, false, now()) ->> 'result', 'saved', 'D speichert dasselbe Lebensmittel');
select is((select count(*)::integer from public.pantry_items), 1, 'D sieht nur den eigenen Vorrat');
select lives_ok($$ select public.delete_pantry_item('vorrat-5') $$, 'D löscht fremdes Lebensmittel: nichts');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.pantry_items), 300, 'A unverändert');
select ok((select count = 2.0 from public.pantry_items where food_id = 'vorrat-1') is not true,
  'Ds Eintrag ändert As Eintrag nicht');

-- Löschen geht ohne Einwilligung (Recht auf Löschung).
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select public.delete_pantry_item('vorrat-1') $$, 'B (ohne Einwilligung) darf löschen');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.delete_pantry_item('vorrat-2') $$, 'A löscht einen Eintrag');

-- Export, Widerruf
select is((select jsonb_array_length(public.export_my_data() -> 'data' -> 'pantry_items')), 299,
  'Export: der ganze eigene Vorrat');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select is((select count(*)::integer from public.pantry_items), 0, 'Widerruf: Vorrat gelöscht');

-- Kaskade: Lebensmittel und Konto
reset role;
delete from public.foods where id = 'vorrat-1';
select is((select count(*)::integer from public.pantry_items where user_id = '44444444-4444-4444-8444-444444444444'), 0,
  'Lebensmittel gelöscht: Vorrats-Eintrag weg');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(public.save_pantry_item('vorrat-3', null, null, false, now()) ->> 'result', 'saved', 'D speichert erneut');
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.pantry_items where user_id = '44444444-4444-4444-8444-444444444444'), 0,
  'Konto löschen: Vorrat weg');

select * from finish();
rollback;
