-- Etappe E4a · Wächter-Auflage M1 (Migration 20261017100400_food_product_use_limit.sql): Der gemeinsame Speicher
-- food_products ist nicht an den Limits vorbei über Tagebuch-Einträge bzw. Favoriten `product|<Nummer>` auslesbar.
-- Jede NEUE Nutzung einer Nummer zählt wie eine Abfrage (private.food_product_lookup_counts, ohne Nummer); beim Limit
-- → `product_limit` bzw. Favorit abgelehnt. Menge ändern, vorhandenen Favoriten erneut setzen, eigene Produkte zählen
-- nicht. Erwartete Werte = packages/core (chargeProductUse, isNewProductUse).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, 1, 'web'
from unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;

-- Zwischenspeicher (ausgedachte Testwerte).
insert into public.food_products (code, found, off_fields, name_de, brand_de, base_unit, kcal, protein_g, carbs_g,
                                  fat_g, check_level, check_reasons, normalizer_version, retrieved_at)
values
  ('4006381333931', true, '{}', 'Testmüsli', 'Testmarke', 'g', 380, 10, 60, 9, 'ok', '{}', 1, now()),
  ('0036000291452', true, '{}', 'Testgetränk', 'Testmarke', 'ml', 24, 0, 5.5, 0, 'review', '{kcal_from_kj}', 1, now());
insert into public.user_food_products (id, user_id, last_write_id, name_de, base_unit, kcal, protein_g, carbs_g, fat_g)
values ('00000000-0000-4000-8000-0000000000aa', '11111111-1111-4111-8111-111111111111', gen_random_uuid(), 'Eigen',
        'g', 100, 1, 1, 1);

create function pg_temp.uuid(n integer) returns text language sql as $$
  select '00000000-0000-4000-8000-' || lpad(n::text, 12, '0')
$$;
create function pg_temp.entry(p_id text, p_over jsonb default '{}', p_base integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', p_base,
    'eaten_on', to_char(private.berlin_today(), 'YYYY-MM-DD'), 'slot', 'breakfast', 'source', 'product',
    'food_id', null, 'recipe_id', null, 'custom_meal_id', null, 'product_code', '4006381333931',
    'user_product_id', null, 'title_de', 'x', 'amount', 45, 'unit', 'g', 'portion', null,
    'kcal', 171, 'protein_g', 4.5, 'carbs_g', 27, 'fat_g', 4.1) || p_over
$$;
create function pg_temp.one(p jsonb) returns jsonb language sql as $$
  select public.save_food_log_entries(jsonb_build_array(p)) -> 0
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.uuid(integer) to authenticated;
grant execute on function pg_temp.entry(text, jsonb, integer) to authenticated;
grant execute on function pg_temp.one(jsonb) to authenticated;
grant execute on function pg_temp.as_user(uuid) to authenticated;
-- Zähler lesen (als Eigentümer; private ist für authenticated nicht lesbar).
create function pg_temp.used() returns integer language sql as $$
  select coalesce(sum(lookups), 0)::integer from private.food_product_lookup_counts
  where user_id = '11111111-1111-4111-8111-111111111111'
$$;

-- Rechte
select ok(not has_function_privilege('authenticated', 'private.food_product_charge(uuid)', 'execute'),
  'authenticated darf private.food_product_charge nicht direkt aufrufen');
select ok(not has_function_privilege('anon', 'private.food_product_charge(uuid)', 'execute'),
  'anon auch nicht');

-- ---------------------------------------------------------------------------------------------------------
-- Tagebuch
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1))) ->> 'result', 'saved', 'neuer Produkt-Eintrag gespeichert');
reset role;
select is(pg_temp.used(), 1, 'neuer Produkt-Eintrag zählt wie eine Abfrage');

set local role authenticated;
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"amount": 90}', 1)) ->> 'result', 'saved', 'Menge geändert');
reset role;
select is(pg_temp.used(), 1, 'Menge ändern zählt nicht');

set local role authenticated;
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"product_code": "0036000291452", "unit": "ml"}', 2))
  ->> 'result', 'saved', 'andere Nummer am selben Eintrag');
reset role;
select is(pg_temp.used(), 2, 'andere Nummer zählt');

set local role authenticated;
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(2), '{"unit": "ml"}')),
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'ungültiger Eintrag abgelehnt');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(3),
  '{"product_code": null, "user_product_id": "00000000-0000-4000-8000-0000000000aa", "title_de": "Eigenes Produkt"}'))
  ->> 'result', 'saved', 'Eintrag aus eigenem Produkt');
reset role;
select is(pg_temp.used(), 2, 'abgelehnte Einträge und eigene Produkte zählen nicht');

-- ---------------------------------------------------------------------------------------------------------
-- Favoriten
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'product|4006381333931', 'product', '4006381333931', 'x', 50, 'g');
insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
values ('11111111-1111-4111-8111-111111111111', 'product|4006381333931', 'product', '4006381333931', 'x', 60, 'g')
on conflict (user_id, fav_key) do update set amount = excluded.amount;
reset role;
select is(pg_temp.used(), 3, 'neuer Produkt-Favorit zählt, erneut setzen (Upsert) nicht');

-- ---------------------------------------------------------------------------------------------------------
-- Limit erreicht (60 in dieser Stunde)
-- ---------------------------------------------------------------------------------------------------------
update private.food_product_lookup_counts set lookups = 60
where user_id = '11111111-1111-4111-8111-111111111111' and hour_start = date_trunc('hour', now());
set local role authenticated;
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(4))),
  '{"result": "rejected", "code": "product_limit"}'::jsonb, 'Limit erreicht → neuer Eintrag product_limit');
select is((select count(*)::integer from public.food_log_entries where id = pg_temp.uuid(4)::uuid), 0,
  'abgelehnter Eintrag nicht gespeichert (kein Titel/Werte aus dem Speicher)');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(1), '{"product_code": "0036000291452", "unit": "ml", "amount": 120}',
  3)) ->> 'result', 'saved', 'beim Limit: Menge eines vorhandenen Eintrags ändern geht weiter');
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
     values ('11111111-1111-4111-8111-111111111111', 'product|0036000291452', 'product', '0036000291452', 'x', 250,
             'ml') $$,
  '22023', 'Produkt-Limit erreicht.', 'Limit erreicht → neuer Produkt-Favorit abgelehnt (Meldung ohne Nummer)');
select is((select count(*)::integer from public.food_log_favorites where fav_key = 'product|0036000291452'), 0,
  'kein Favorit, kein Titel aus dem Speicher');
select lives_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, user_product_id, title_de, amount, unit)
     values ('11111111-1111-4111-8111-111111111111', 'own_product|00000000-0000-4000-8000-0000000000aa', 'product',
             '00000000-0000-4000-8000-0000000000aa', 'x', 100, 'g') $$,
  'Favorit eines eigenen Produkts zählt nicht (auch beim Limit)');
reset role;
select is(pg_temp.used(), 60, 'Zähler bleibt bei 60');

select * from finish();
rollback;
