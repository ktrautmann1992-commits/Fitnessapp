-- Etappe E4a · Herkunft `product` im Ernährungstagebuch (docs/PLAN-E4.md 3.5, 8.2): Werte und Titel vom Server
-- (Zwischenspeicher bzw. eigenes Produkt) statt vom Gerät, gesperrt/fehlend → product_unavailable, Ändern aus dem
-- Schnappschuss, fester Titel „Eigenes Produkt“, fremder Verweis, 2.000 g/ml, 3.000 kcal, Favoriten-Trigger ohne
-- Werte, Widerruf, Export. Erwartete Werte = packages/core (food-product.test.ts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
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

-- Zwischenspeicher (ausgedachte Testwerte): Müsli (g, ok), gesperrt, Getränk (ml), Öl (g).
insert into public.food_products (code, found, off_fields, name_de, brand_de, base_unit, kcal, protein_g, carbs_g,
                                  fat_g, check_level, check_reasons, normalizer_version, retrieved_at)
values
  ('4006381333931', true, '{}', 'Testmüsli', 'Testmarke', 'g', 380, 10, 60, 9, 'ok', '{}', 1, now()),
  ('96385074', true, '{}', 'Testprodukt gesperrt', null, 'g', null, null, null, null, 'blocked', '{energy_missing}', 1,
   now()),
  ('0036000291452', true, '{}', 'Testgetränk', 'Testmarke', 'ml', 24, 0, 5.5, 0, 'review', '{kcal_from_kj}', 1, now()),
  ('4000000000013', true, '{}', 'Testöl', null, 'g', 900, 0, 0, 100, 'ok', '{}', 1, now());

create function pg_temp.uuid(n integer) returns text language sql as $$
  select '00000000-0000-4000-8000-' || lpad(n::text, 12, '0')
$$;
create function pg_temp.entry(p_id text, p_over jsonb default '{}', p_base integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', p_base,
    'eaten_on', to_char(private.berlin_today(), 'YYYY-MM-DD'), 'slot', 'breakfast', 'source', 'product',
    'food_id', null, 'recipe_id', null, 'custom_meal_id', null, 'product_code', '4006381333931',
    'user_product_id', null, 'title_de', 'Freitext vom Gerät', 'amount', 45, 'unit', 'g', 'portion', null,
    'kcal', 1, 'protein_g', 0, 'carbs_g', 0, 'fat_g', 0) || p_over
$$;
create function pg_temp.one(p jsonb) returns jsonb language sql as $$
  select public.save_food_log_entries(jsonb_build_array(p)) -> 0
$$;
grant execute on function pg_temp.uuid(integer) to authenticated;
grant execute on function pg_temp.entry(text, jsonb, integer) to authenticated;
grant execute on function pg_temp.one(jsonb) to authenticated;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.row_of(p_id text) returns jsonb language sql as $$
  select to_jsonb(f) from public.food_log_entries f where f.id = p_id::uuid
$$;
grant execute on function pg_temp.row_of(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select pg_get_constraintdef(c.oid) like '%''product''%' from pg_constraint c
   where c.conname = 'food_log_entries_source_check'),
  'Herkunft product erlaubt');
select is_empty(
  $$ select 1 from pg_constraint c where c.contype = 'f' and c.confrelid = 'public.food_products'::regclass $$,
  'kein Fremdschlüssel auf food_products (Speicher darf ablaufen)');
select throws_ok(
  $$ insert into public.food_log_entries (user_id, eaten_on, slot, source, title_de, amount, unit, kcal, protein_g,
       carbs_g, fat_g, last_write_id)
     values ('11111111-1111-4111-8111-111111111111', current_date, 'other', 'product', 'Freitext', 45, 'g', 1, 0, 0, 0,
             gen_random_uuid()) $$,
  '23514', null, 'CHECK: ohne Nummer nur mit festem Titel „Eigenes Produkt“');
select throws_ok(
  $$ insert into public.food_log_entries (user_id, eaten_on, slot, source, food_id, title_de, amount, unit, kcal,
       protein_g, carbs_g, fat_g, last_write_id, product_code)
     values ('11111111-1111-4111-8111-111111111111', current_date, 'other', 'food', 'haferflocken', 'x', 45, 'g', 1, 0,
             0, 0, gen_random_uuid(), '4006381333931') $$,
  '23514', null, 'CHECK: Nummer nur bei Herkunft product');
select throws_ok(
  $$ insert into public.food_log_entries (user_id, eaten_on, slot, source, title_de, amount, unit, kcal, protein_g,
       carbs_g, fat_g, last_write_id, product_code)
     values ('11111111-1111-4111-8111-111111111111', current_date, 'other', 'product', 'x', 45, 'g', 1, 0, 0, 0,
             gen_random_uuid(), '4006381333932') $$,
  '23514', null, 'CHECK: Nummer mit falscher Prüfziffer');

-- ---------------------------------------------------------------------------------------------------------
-- Neu eintragen: Werte und Titel vom Server
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1))) ->> 'result', 'saved', 'Produkt-Eintrag gespeichert');
select ok(
  (select r ->> 'kcal' = '171' and r ->> 'protein_g' = '4.5' and r ->> 'carbs_g' = '27' and r ->> 'fat_g' = '4.1'
          and r ->> 'title_de' = 'Testmüsli · Testmarke' and r ->> 'product_code' = '4006381333931'
          and r ->> 'user_product_id' is null and r ->> 'source' = 'product'
   from (select pg_temp.row_of(pg_temp.uuid(1)) as r) x),
  'Werte aus dem Speicher (45 g = 171 kcal · 4,5 · 27 · 4,1), Titel „Name · Marke“ vom Server, nie vom Gerät');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2), '{"product_code": "96385074"}')),
  '{"result": "rejected", "code": "product_unavailable"}'::jsonb, 'gesperrtes Produkt → product_unavailable');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2), '{"product_code": "4006381333948"}')),
  '{"result": "rejected", "code": "product_unavailable"}'::jsonb, 'Nummer ohne Speicher-Zeile → product_unavailable');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2), '{"unit": "ml"}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Einheit passt nicht zum Produkt → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2), '{"unit": "piece", "amount": 2}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Stück → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2),
  '{"product_code": "0036000291452", "unit": "ml", "amount": 2000}')) ->> 'result', 'saved', '2.000 ml geht');
select is((pg_temp.row_of(pg_temp.uuid(2)) ->> 'kcal')::integer, 480, '2.000 ml Getränk = 480 kcal');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(3),
  '{"product_code": "0036000291452", "unit": "ml", "amount": 2001}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, '2.001 ml → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(3), '{"product_code": "4000000000013", "amount": 333}')) ->> 'result',
  'saved', 'Öl 333 g = 2.997 kcal geht');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4), '{"product_code": "4000000000013", "amount": 334}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Öl 334 g = 3.006 kcal → invalid (3.000 je Eintrag)');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4), '{"user_product_id": "00000000-0000-4000-8000-000000000001"}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Nummer UND eigenes Produkt → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4), '{"source": "food", "food_id": "haferflocken"}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Nummer bei anderer Herkunft → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4), '{"kcal": null}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Gerätewerte ungültig (kcal fehlt) → invalid');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4), '{"kcal": 99999}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Gerätewerte außerhalb der Grenzen → invalid');
-- Ältere Geräte ohne Produkt-Felder bleiben gültig (food).
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(5), '{"source": "food", "food_id": "haferflocken", "title_de": "x"}')
  - 'product_code' - 'user_product_id' - 'custom_meal_id') ->> 'result',
  'saved', 'Eintrag ohne die neuen Felder (ältere App) gespeichert');

-- ---------------------------------------------------------------------------------------------------------
-- Ändern: gleiche Menge = Schnappschuss; neu aus dem Speicher; ohne Speicher-Zeile aus dem Schnappschuss
-- ---------------------------------------------------------------------------------------------------------
reset role;
update public.food_products set kcal = 400 where code = '4006381333931';
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"slot": "lunch", "kcal": 5}', 1)) ->> 'result', 'saved',
  'verschieben (gleiche Menge)');
select ok((select r ->> 'kcal' = '171' and r ->> 'slot' = 'lunch' from (select pg_temp.row_of(pg_temp.uuid(1)) r) x),
  'gleiche Menge: Schnappschuss bleibt (auch wenn der Speicher sich geändert hat)');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"amount": 90}', 2)) ->> 'result', 'saved', 'Menge ändern');
select is((pg_temp.row_of(pg_temp.uuid(1)) ->> 'kcal')::integer, 360, 'neue Menge: neu aus dem Speicher (400 × 0,9)');
reset role;
delete from public.food_products where code = '4006381333931';
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"amount": 45}', 3)) ->> 'result', 'saved',
  'Ändern ohne Speicher-Zeile geht');
select ok((select r ->> 'kcal' = '180' and r ->> 'title_de' = 'Testmüsli · Testmarke'
           from (select pg_temp.row_of(pg_temp.uuid(1)) r) x),
  'ohne Speicher-Zeile: verhältnisgleich aus dem Schnappschuss (360 × ½), Titel bleibt');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(6))),
  '{"result": "rejected", "code": "product_unavailable"}'::jsonb,
  'neuer Eintrag ohne Speicher-Zeile → product_unavailable („Produkt neu abrufen“)');

-- ---------------------------------------------------------------------------------------------------------
-- Eigene Produkte
-- ---------------------------------------------------------------------------------------------------------
select is(public.save_user_food_product(jsonb_build_object(
  'id', pg_temp.uuid(100), 'write_id', gen_random_uuid(), 'base_revision', null, 'name_de', 'Hafermilch',
  'brand_de', null, 'code', null, 'base_unit', 'ml', 'kcal', 64, 'protein_g', 3.3, 'carbs_g', 4.8, 'fat_g', 3.5,
  'sugar_g', null, 'salt_g', null, 'serving_g', null, 'based_on_off', false)) ->> 'result', 'saved', 'eigenes Produkt');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(7), jsonb_build_object(
  'product_code', null, 'user_product_id', pg_temp.uuid(100), 'unit', 'ml', 'amount', 250))) ->> 'result', 'saved',
  'Eintrag aus eigenem Produkt');
select ok(
  (select r ->> 'kcal' = '160' and r ->> 'protein_g' = '8.3' and r ->> 'carbs_g' = '12' and r ->> 'fat_g' = '8.8'
          and r ->> 'title_de' = 'Eigenes Produkt' and r ->> 'user_product_id' = pg_temp.uuid(100)
   from (select pg_temp.row_of(pg_temp.uuid(7)) r) x),
  'Werte aus dem eigenen Produkt (250 ml = 160 kcal), fester Titel, nie Name/Marke');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(8), jsonb_build_object(
  'product_code', null, 'user_product_id', pg_temp.uuid(100), 'unit', 'ml', 'amount', 250, 'kcal', 77))) ->> 'result',
  'saved', 'D mit Verweis auf A''s Produkt: gespeichert …');
reset role;
select ok((select r ->> 'user_product_id' is null and r ->> 'kcal' = '77' and r ->> 'title_de' = 'Eigenes Produkt'
           from (select pg_temp.row_of(pg_temp.uuid(8)) r) x),
  '… aber ohne Verweis und ohne fremde Werte (Gerätewerte, geprüft)');
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.delete_user_food_product(pg_temp.uuid(100)::uuid) ->> 'result', 'ok', 'eigenes Produkt löschen');
select ok((select r ->> 'user_product_id' is null and r ->> 'kcal' = '160'
           from (select pg_temp.row_of(pg_temp.uuid(7)) r) x),
  'Eintrag bleibt (Schnappschuss), Verweis leer');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(7), jsonb_build_object(
  'product_code', null, 'user_product_id', pg_temp.uuid(100), 'unit', 'ml', 'amount', 500, 'title_de',
  'Eigenes Produkt'), 1)) ->> 'result', 'saved', 'Ändern mit altem Verweis (anderes Gerät) geht');
select is((pg_temp.row_of(pg_temp.uuid(7)) ->> 'kcal')::integer, 320,
  'gelöschtes Produkt: verhältnisgleich aus dem Schnappschuss (160 × 2)');

-- ---------------------------------------------------------------------------------------------------------
-- Favoriten: Titel vom Server, keine Werte
-- ---------------------------------------------------------------------------------------------------------
insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'product|0036000291452', 'product', '0036000291452', 'Freitext', 250,
        'ml');
select is((select title_de from public.food_log_favorites where fav_key = 'product|0036000291452'),
  'Testgetränk · Testmarke', 'Produkt-Favorit: Titel aus dem Speicher (nicht vom Gerät)');
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
     values ('11111111-1111-4111-8111-111111111111', 'product|4000000000013', 'product', '0036000291452', 'x', 1, 'g') $$,
  '23514', 'Ungültiger Favorit.', 'Schlüssel passt nicht zur Nummer → abgelehnt (ohne Werte)');
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, food_id, product_code, title_de, amount, unit)
     values ('11111111-1111-4111-8111-111111111111', 'food|haferflocken', 'food', 'haferflocken', '0036000291452', 'x',
             60, 'g') $$,
  '23514', 'Ungültiger Favorit.', 'Nummer an einem Katalog-Favoriten → abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Export, Widerruf
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select bool_or(r ->> 'product_code' = '0036000291452') and bool_and(r ? 'user_product_id')
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'food_log_entries') r),
  'Export: Einträge mit product_code/user_product_id');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select is((select count(*)::integer from public.food_log_entries), 0, 'Widerruf: alle Einträge (auch product) weg');
select is((select count(*)::integer from public.food_log_favorites where source = 'product'), 0,
  'Widerruf: Produkt-Favoriten weg');
reset role;
select is((select count(*)::integer from public.food_log_entries where user_id = '44444444-4444-4444-8444-444444444444'),
  1, 'D unberührt');

select * from finish();
rollback;
