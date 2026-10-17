-- Etappe E4a · Eigene Produkte (docs/PLAN-E4.md 2.3, 3.4, 3.6; E4-G8, E4-G10, E4-G13): user_food_products,
-- save_user_food_product, delete_user_food_product. Rechte (auch anon), security definer, Sperr-Reihenfolge,
-- Login/Profil/Einwilligung health_data, nur bekannte Felder, Grenzen ohne stilles Runden (Name 60, Marke 40, kcal 900,
-- je 100 höchstens 100 g, Summe 102 g bzw. 110 ml, Portion), 200 Produkte, idempotent je write_id, optimistische
-- Sperre, Isolation, Fehler ohne Namen/Werte, Löschen ohne Einwilligung, Widerruf löscht eigene Produkte und
-- Produkt-Favoriten, Export, Kaskade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

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
  ('haferflocken', 1, 'published', 'Haferflocken', 'other', true, '{}', '{}', '{}', false, false, 2, true,
   '{"nutrients_per_100g": {"kcal": 370, "protein_g": 13.5, "carbs_g": 58.7, "fat_g": 7}, "units": {}}');

create function pg_temp.uuid(n integer) returns text language sql as $$
  select '00000000-0000-4000-8000-' || lpad(n::text, 12, '0')
$$;
create function pg_temp.product(p_id text, p_over jsonb default '{}', p_base integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', p_base, 'name_de', 'Hafermilch Barista',
    'brand_de', 'Eigenmarke', 'code', '4006381333931', 'base_unit', 'ml', 'kcal', 46, 'protein_g', 1,
    'carbs_g', 6.7, 'fat_g', 1.5, 'sugar_g', 4, 'salt_g', 0.1, 'serving_g', 250, 'based_on_off', true) || p_over
$$;
create function pg_temp.save(p jsonb) returns jsonb language sql as $$
  select public.save_user_food_product(p)
$$;
grant execute on function pg_temp.uuid(integer) to authenticated;
grant execute on function pg_temp.product(text, jsonb, integer) to authenticated;
grant execute on function pg_temp.save(jsonb) to authenticated;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.user_food_products'::regclass), 'RLS an');
select ok(has_table_privilege('authenticated', 'public.user_food_products', 'select')
          and not has_table_privilege('authenticated', 'public.user_food_products', 'insert')
          and not has_table_privilege('authenticated', 'public.user_food_products', 'update')
          and not has_table_privilege('authenticated', 'public.user_food_products', 'delete'),
  'authenticated: nur lesen (schreiben nur über die Funktionen)');
select ok(not has_table_privilege('anon', 'public.user_food_products', 'select'), 'anon: nicht lesbar');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p where p.oid in ('public.save_user_food_product(jsonb)'::regprocedure,
                                  'public.delete_user_food_product(uuid)'::regprocedure)),
  'save/delete: security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.save_user_food_product(jsonb)', 'execute')
          and not has_function_privilege('anon', 'public.delete_user_food_product(uuid)', 'execute'),
  'anon: Funktionen nicht ausführbar');
select ok(
  (select position('for share' in p.prosrc) between 1 and position('has_valid_consent' in p.prosrc)
          and position('has_valid_consent' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
          and position('pg_advisory_xact_lock' in p.prosrc) < position('for update' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_user_food_product(jsonb)'::regprocedure),
  'save: Einwilligung FOR SHARE → prüfen → Advisory-Sperre → Zeilen');
select ok(
  (select position('pg_advisory_xact_lock' in p.prosrc) < position('public.food_log_entries' in p.prosrc)
          and position('public.food_log_entries' in p.prosrc) < position('public.food_log_favorites' in p.prosrc)
          and position('public.food_log_favorites' in p.prosrc) < position('delete from' in p.prosrc)
          and position('has_valid_consent' in p.prosrc) = 0
   from pg_proc p where p.oid = 'public.delete_user_food_product(uuid)'::regprocedure),
  'delete: Person → Einträge → Favoriten → Produkt; ohne Einwilligung');

-- ---------------------------------------------------------------------------------------------------------
-- Login, Profil, Einwilligung
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select pg_temp.save(pg_temp.product(pg_temp.uuid(1))) $$, '42501', 'Nicht angemeldet.',
  'ohne Login abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select pg_temp.save(pg_temp.product(pg_temp.uuid(1))) $$, '42501', 'Profil fehlt.',
  'ohne Profil abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select pg_temp.save(pg_temp.product(pg_temp.uuid(1))) $$, '42501',
  'Einwilligung Gesundheitsdaten fehlt.', 'ohne Einwilligung health_data abgelehnt (Freitext, E2-G1)');
select throws_ok(
  $$ insert into public.user_food_products (user_id, name_de, base_unit, kcal, protein_g, carbs_g, fat_g, last_write_id)
     values ('22222222-2222-4222-8222-222222222222', 'X', 'g', 1, 0, 0, 0, gen_random_uuid()) $$,
  '42501', null, 'direktes Einfügen verboten');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern, Idempotenz, Konflikte
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
create temp table first_save as select pg_temp.product(pg_temp.uuid(1)) as p;
select is((select pg_temp.save(p) from first_save),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1), 'gespeichert');
select is((select pg_temp.save(p) from first_save),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1), 'gleiche Fassung erneut: idempotent');
select is(pg_temp.save(pg_temp.product(pg_temp.uuid(1), '{"name_de": "Hafermilch"}', 1)),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 2), 'ändern auf Basis revision 1');
select is(pg_temp.save(pg_temp.product(pg_temp.uuid(1), '{}', 1)),
  jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', pg_temp.uuid(1), 'revision', 2),
  'veraltete Basis → Konflikt');
select is(pg_temp.save(pg_temp.product(pg_temp.uuid(99), '{}', 3)),
  '{"result": "conflict", "reason": "deleted", "id": null, "revision": null}'::jsonb,
  'Basis ohne Zeile → gelöscht');
select ok((select name_de = 'Hafermilch' and based_on_off and code = '4006381333931' and base_unit = 'ml'
           from public.user_food_products where id = pg_temp.uuid(1)::uuid), 'Werte gespeichert');

-- ---------------------------------------------------------------------------------------------------------
-- Grenzen und Zeichenregeln (Antwort ohne Namen und ohne Werte)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.rejected(p jsonb) returns boolean language sql as $$
  select public.save_user_food_product(p) = '{"result": "rejected", "code": "invalid"}'::jsonb
$$;
grant execute on function pg_temp.rejected(jsonb) to authenticated;
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(2), '{"fat_g": 120}')), '120 g Fett je 100 g abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(2), '{"kcal": 901}')), 'kcal 901 abgelehnt');
select ok(not pg_temp.rejected(pg_temp.product(pg_temp.uuid(2), '{"kcal": 900, "fat_g": 100, "protein_g": 0, "carbs_g": 0, "salt_g": 0}')),
  'kcal 900 (reines Fett) geht');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(3), '{"kcal": 46.5}')), 'kcal mit Nachkommastelle abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(3), '{"protein_g": 1.25}')),
  'zwei Nachkommastellen abgelehnt (kein stilles Runden)');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(3), '{"protein_g": -1}')), 'negativer Wert abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(3),
  '{"base_unit": "g", "protein_g": 50, "carbs_g": 0, "fat_g": 52, "salt_g": 0.1}')), 'Summe 102,1 g je 100 g abgelehnt');
select ok(not pg_temp.rejected(pg_temp.product(pg_temp.uuid(3),
  '{"base_unit": "g", "protein_g": 50, "carbs_g": 0, "fat_g": 52, "salt_g": 0, "kcal": 668}')), 'Summe 102 g geht');
select ok(not pg_temp.rejected(pg_temp.product(pg_temp.uuid(4),
  '{"protein_g": 5, "carbs_g": 95, "fat_g": 10, "salt_g": 0, "kcal": 490}')), 'ml: Summe 110 geht (Sirup)');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(5),
  '{"protein_g": 5, "carbs_g": 95, "fat_g": 10, "salt_g": 0.1}')), 'ml: Summe 110,1 abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(5), jsonb_build_object('name_de', repeat('x', 61)))),
  'Name 61 Zeichen abgelehnt');
select ok(not pg_temp.rejected(pg_temp.product(pg_temp.uuid(5), jsonb_build_object('name_de', repeat('x', 60)))),
  'Name 60 Zeichen geht');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), jsonb_build_object('name_de', E'Hafer\u0007milch'))),
  'Steuerzeichen im Namen abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), jsonb_build_object('name_de', E'Hafer\u202emilch'))),
  'Bidi-Zeichen im Namen abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"name_de": " Hafermilch"}')),
  'Leerzeichen am Rand abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), jsonb_build_object('brand_de', repeat('m', 41)))),
  'Marke 41 Zeichen abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"brand_de": ""}')), 'leere Marke abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"code": "4006381333932"}')),
  'Nummer mit falscher Prüfziffer abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"serving_g": 2001}')), 'Portion 2.001 abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"base_unit": "piece"}')), 'Einheit Stück abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), '{"user_id": "44444444-4444-4444-8444-444444444444"}')),
  'unbekanntes Feld (user_id) abgelehnt');
select ok(pg_temp.rejected(pg_temp.product(pg_temp.uuid(6), jsonb_build_object('name_de', repeat('x', 5000)))),
  'zu große Eingabe abgelehnt');
select ok(not pg_temp.rejected(pg_temp.product(pg_temp.uuid(6),
  '{"brand_de": null, "code": null, "sugar_g": null, "salt_g": null, "serving_g": null}')),
  'ohne Marke, Nummer, Zucker, Salz, Portion geht');

-- ---------------------------------------------------------------------------------------------------------
-- Obergrenze 200
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into public.user_food_products (user_id, name_de, base_unit, kcal, protein_g, carbs_g, fat_g, last_write_id)
select '11111111-1111-4111-8111-111111111111', 'Produkt ' || n, 'g', 100, 1, 1, 1, gen_random_uuid()
from generate_series(1, 200 - (select count(*)::integer from public.user_food_products
                                where user_id = '11111111-1111-4111-8111-111111111111')) n;
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.save(pg_temp.product(pg_temp.uuid(201))), '{"result": "rejected", "code": "limit"}'::jsonb,
  '201. Produkt abgelehnt (limit)');
select is((select count(*)::integer from public.user_food_products), 200, 'genau 200 Produkte');
select is(pg_temp.save(pg_temp.product(pg_temp.uuid(1), '{"kcal": 47}', 2)) ->> 'result', 'saved',
  'Ändern bei 200 geht');

-- ---------------------------------------------------------------------------------------------------------
-- Isolation
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*)::integer from public.user_food_products), 0, 'D sieht keine Produkte von A');
select ok((select r ->> 'result' = 'saved' and r ->> 'id' <> pg_temp.uuid(1)
           from (select pg_temp.save(pg_temp.product(pg_temp.uuid(1))) as r) x),
  'fremde id → neue id ohne unterscheidbare Meldung');
select is(public.delete_user_food_product(pg_temp.uuid(1)::uuid),
  jsonb_build_object('result', 'ok', 'id', pg_temp.uuid(1)), 'fremdes Produkt löschen: gleiche Antwort');
reset role;
select ok(exists (select 1 from public.user_food_products where id = pg_temp.uuid(1)::uuid
                  and user_id = '11111111-1111-4111-8111-111111111111'), '… ohne Wirkung');

-- ---------------------------------------------------------------------------------------------------------
-- Löschen ohne Einwilligung (Recht auf Löschung)
-- ---------------------------------------------------------------------------------------------------------
insert into public.user_food_products (id, user_id, name_de, base_unit, kcal, protein_g, carbs_g, fat_g, last_write_id)
values (pg_temp.uuid(500)::uuid, '22222222-2222-4222-8222-222222222222', 'Alt', 'g', 100, 1, 1, 1, gen_random_uuid());
set local role authenticated;
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(public.delete_user_food_product(pg_temp.uuid(500)::uuid) ->> 'result', 'ok', 'B löscht ohne Einwilligung');
select is((select count(*)::integer from public.user_food_products), 0, '… und das Produkt ist weg');

-- ---------------------------------------------------------------------------------------------------------
-- Produkt-Favoriten (Trigger: Titel vom Server, Einwilligung) und Widerruf (E4-G10)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, user_product_id, title_de, amount, unit)
     values ('22222222-2222-4222-8222-222222222222', 'own_product|' || pg_temp.uuid(500), 'product',
             pg_temp.uuid(500)::uuid, 'Freitext', 100, 'g') $$,
  '23514', 'Ungültiger Favorit.', 'Favorit auf ein nicht (mehr) vorhandenes Produkt abgelehnt (ohne Werte)');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
insert into public.food_log_favorites (user_id, fav_key, source, user_product_id, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'own_product|' || pg_temp.uuid(1), 'product', pg_temp.uuid(1)::uuid,
        'Freitext vom Gerät', 250, 'ml');
select is((select title_de from public.food_log_favorites where fav_key = 'own_product|' || pg_temp.uuid(1)),
  'Eigenes Produkt', 'Favorit eines eigenen Produkts: fester Titel vom Server (kein Freitext)');
insert into public.food_log_favorites (user_id, fav_key, source, food_id, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'food|haferflocken', 'food', 'haferflocken', 'x', 60, 'g');
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit, kcal)
     values ('11111111-1111-4111-8111-111111111111', 'product|4006381333931', 'product', '4006381333931', 'x', 45, 'g',
             171) $$,
  '23514', 'Ungültiger Favorit.', 'Produkt-Favorit mit Werten abgelehnt');
insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'product|4006381333931', 'product', '4006381333931', 'x', 45, 'g');
select is((select title_de from public.food_log_favorites where fav_key = 'product|4006381333931'), 'Produkt',
  'Produkt-Favorit ohne Speicher-Zeile: fester Titel „Produkt“');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
     values ('22222222-2222-4222-8222-222222222222', 'product|4006381333931', 'product', '4006381333931', 'x', 45, 'g') $$,
  '42501', null, 'Produkt-Favorit ohne Einwilligung abgelehnt');

-- Export (vor dem Widerruf)
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select jsonb_array_length(public.export_my_data() -> 'data' -> 'user_food_products')), 200,
  'Export: alle eigenen Produkte');
select ok((select bool_and(r ->> 'user_id' = '11111111-1111-4111-8111-111111111111')
           from jsonb_array_elements(public.export_my_data() -> 'data' -> 'user_food_products') r),
  'Export: nur eigene Produkte');

select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select is((select count(*)::integer from public.user_food_products), 0, 'Widerruf: eigene Produkte gelöscht (E4-G10)');
select is((select count(*)::integer from public.food_log_favorites where source = 'product'), 0,
  'Widerruf: Produkt-Favoriten gelöscht (E4-G10)');
select is((select count(*)::integer from public.food_log_favorites where source = 'food'), 1,
  'Widerruf: Katalog-Favorit bleibt (A-G14)');

-- ---------------------------------------------------------------------------------------------------------
-- Kaskade beim Konto-Löschen
-- ---------------------------------------------------------------------------------------------------------
reset role;
select is((select count(*)::integer from public.user_food_products
           where user_id = '44444444-4444-4444-8444-444444444444'), 1, 'D hat ein Produkt');
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.user_food_products
           where user_id = '44444444-4444-4444-8444-444444444444'), 0, 'Konto löschen: eigene Produkte weg');
select is((select count(*)::integer from public.user_food_products where user_id = '11111111-1111-4111-8111-111111111111'),
  0, '(A schon leer)');

select * from finish();
rollback;
