-- Einkaufen · Etappe E1 (docs/PLAN-EINKAUFEN-AUSDAUER.md 3): shopping_product_links, save_shopping_product_link,
-- delete_shopping_product_link. Rechte (auch anon), security definer, Sperr-Reihenfolge, Login/Profil/Einwilligung,
-- Nummer (Prüfziffer) und Lebensmittel, gleiche Nummer ersetzt, höchstens 500 (älteste fällt weg), Isolation (fremde
-- Zuordnungen unsichtbar), Löschen ohne Einwilligung, Widerruf löscht, Export, Kaskade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

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
values
  ('haferflocken', 1, 'published', 'Haferflocken', 'cereal_breakfast', true, '{}', '{}', '{}', false, false, 2, true,
   '{"nutrients_per_100g": {"kcal": 370, "protein_g": 13.5, "carbs_g": 58.7, "fat_g": 7}, "units": {}}'),
  ('reis', 1, 'published', 'Reis', 'pasta_rice_grains', true, '{}', '{}', '{}', false, false, 2, true,
   '{"nutrients_per_100g": {"kcal": 350, "protein_g": 7, "carbs_g": 78, "fat_g": 1}, "units": {}}');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
-- Gültige EAN-13 (12 Ziffern + GS1-Prüfziffer) aus einer laufenden Nummer.
create function pg_temp.ean(n integer) returns text language plpgsql as $$
declare
  body text := '400999' || lpad(n::text, 6, '0');
  total integer := 0;
begin
  for i in 1..12 loop
    total := total + substr(body, i, 1)::integer * case when i % 2 = 0 then 3 else 1 end;
  end loop;
  return body || ((10 - total % 10) % 10)::text;
end;
$$;
grant execute on function pg_temp.ean(integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.shopping_product_links'::regclass), 'RLS an');
select ok(has_table_privilege('authenticated', 'public.shopping_product_links', 'select')
          and not has_table_privilege('authenticated', 'public.shopping_product_links', 'insert')
          and not has_table_privilege('authenticated', 'public.shopping_product_links', 'update')
          and not has_table_privilege('authenticated', 'public.shopping_product_links', 'delete'),
  'authenticated: nur lesen (schreiben nur über die Funktionen)');
select ok(not has_table_privilege('anon', 'public.shopping_product_links', 'select'), 'anon: nicht lesbar');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.oid in ('public.save_shopping_product_link(text, text)'::regprocedure,
                                  'public.delete_shopping_product_link(text)'::regprocedure)),
  'save/delete: security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_shopping_product_link(text, text)', 'execute')
          and not has_function_privilege('anon', 'public.delete_shopping_product_link(text)', 'execute'),
  'anon: Funktionen nicht ausführbar');
select ok(
  (select position('for share' in p.prosrc) between 1 and position('has_valid_consent' in p.prosrc)
          and position('has_valid_consent' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_shopping_product_link(text, text)'::regprocedure),
  'save: Einwilligung FOR SHARE → prüfen → Advisory-Sperre');

-- ---------------------------------------------------------------------------------------------------------
-- Anmeldung, Profil, Einwilligung, Eingaben
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'reis') $$, '42501',
  'Nicht angemeldet.', 'ohne Anmeldung abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'reis') $$, '42501', 'Profil fehlt.',
  'ohne Profil abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'reis') $$, '42501',
  'Einwilligung Gesundheitsdaten fehlt.', 'ohne Einwilligung abgelehnt (Konsum = sensibel)');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.save_shopping_product_link('4000000000010', 'reis') $$, '22023',
  'Ungültige Nummer.', 'falsche Prüfziffer abgelehnt');
select throws_ok($$ select public.save_shopping_product_link(null, 'reis') $$, '22023', 'Ungültige Nummer.',
  'keine Nummer abgelehnt');
select throws_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'gibt-es-nicht') $$, '22023',
  'Unbekanntes Lebensmittel.', 'unbekanntes Lebensmittel abgelehnt (ohne Nummer in der Meldung)');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern, ersetzen, Grenze, Isolation
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'haferflocken') $$, 'A speichert');
select lives_ok($$ select public.save_shopping_product_link(pg_temp.ean(1), 'reis') $$, 'gleiche Nummer erneut');
select is((select food_id from public.shopping_product_links where code = pg_temp.ean(1)), 'reis',
  'gleiche Nummer ersetzt die Zuordnung');
select is((select count(*)::integer from public.shopping_product_links), 1, 'genau eine Zeile');
select lives_ok($$ select public.save_shopping_product_link(pg_temp.ean(n), 'reis') from generate_series(2, 501) n $$,
  'bis 501 Nummern speichern');
select is((select count(*)::integer from public.shopping_product_links), 500, 'höchstens 500 je Person');
select ok(not exists (select 1 from public.shopping_product_links where code = pg_temp.ean(1)),
  'die älteste Zuordnung fällt weg');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select lives_ok($$ select public.save_shopping_product_link(pg_temp.ean(7), 'haferflocken') $$, 'D speichert');
select is((select count(*)::integer from public.shopping_product_links), 1, 'D sieht nur die eigene Zuordnung');
select lives_ok($$ select public.delete_shopping_product_link(pg_temp.ean(3)) $$, 'D löscht fremde Nummer: nichts');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.shopping_product_links), 500, 'A unverändert');

-- Löschen geht ohne Einwilligung (Recht auf Löschung): B hat nichts, A löscht eine.
select lives_ok($$ select public.delete_shopping_product_link(pg_temp.ean(2)) $$, 'A löscht eine Zuordnung');

-- Export, Widerruf
select is((select jsonb_array_length(public.export_my_data() -> 'data' -> 'shopping_product_links')), 499,
  'Export: alle eigenen Zuordnungen');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select is((select count(*)::integer from public.shopping_product_links), 0, 'Widerruf: Zuordnungen gelöscht');

-- Kaskade
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.shopping_product_links
           where user_id = '44444444-4444-4444-8444-444444444444'), 0, 'Konto löschen: Zuordnungen weg');

select * from finish();
rollback;
