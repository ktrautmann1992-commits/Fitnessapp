-- Etappe E4a · Zwischenspeicher food_products (docs/PLAN-E4.md 3.2, 3.3, 8.2): ohne Personenbezug, nicht direkt
-- lesbar, nur service_role; Flag food_product_lookup (aus, beta_admin); Einwilligung health_data; Limits je Person
-- 60/Stunde und 200/Tag (Europe/Berlin), Zähler ohne Nummer; globaler Deckel 10/Minute, Sperre nach 429/503;
-- Speicher 30 Tage frisch, 90 Tage bis zum Löschen, „nicht gefunden“ 1 Tag; CHECKs; Export der eigenen Zähler.
begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333']::uuid[]) as u;
-- A und C mit Einwilligung health_data, B ohne.
insert into public.consents (user_id, consent_type, version, platform) values
  ('11111111-1111-4111-8111-111111111111', 'health_data', 1, 'web'),
  ('33333333-3333-4333-8333-333333333333', 'health_data', 1, 'web');

-- Testnummern (Prüfziffer gültig; ausgedachte Testwerte, keine OFF-Daten).
create function pg_temp.rec(p_code text, p_found boolean default true, p_retrieved timestamptz default now(),
  p_kcal integer default 380, p_level text default 'ok') returns jsonb language sql as $$
  select jsonb_build_object(
    'code', p_code, 'found', p_found,
    'off_fields', case when p_found then '{"product_name_de": "Testmüsli"}'::jsonb end,
    'name_de', case when p_found then 'Testmüsli' end, 'brand_de', case when p_found then 'Testmarke' end,
    'quantity_label', case when p_found then '500 g' end, 'base_unit', case when p_found then 'g' end,
    'kcal', case when p_found and p_level <> 'blocked' then p_kcal end,
    'protein_g', case when p_found and p_level <> 'blocked' then 10 end,
    'carbs_g', case when p_found and p_level <> 'blocked' then 60 end,
    'fat_g', case when p_found and p_level <> 'blocked' then 9 end,
    'sugar_g', null, 'sat_fat_g', null, 'fiber_g', null, 'salt_g', null, 'serving_g', case when p_found then 50 end,
    'package_g', case when p_found then 500 end, 'check_level', case when p_found then p_level end,
    'check_reasons', '[]'::jsonb, 'normalizer_version', 1, 'off_last_modified', null,
    'retrieved_at', to_char(p_retrieved at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
$$;
create function pg_temp.lookup(p_user text, p_code text) returns jsonb language sql as $$
  select public.food_product_lookup(p_user::uuid, p_code)
$$;
create function pg_temp.reset_budget() returns void language sql as $$
  update private.off_request_budget set window_start = date_trunc('minute', now()), requests = 0, blocked_until = null
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte: niemand liest den Speicher direkt, kein Personenbezug
-- ---------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.food_products'::regclass), 'food_products: RLS an');
select is((select count(*)::integer from pg_policies where tablename = 'food_products'), 0,
  'food_products: keine Policy (auch nicht für authenticated)');
select ok(not has_table_privilege('authenticated', 'public.food_products', 'select')
          and not has_table_privilege('anon', 'public.food_products', 'select')
          and not has_table_privilege('authenticated', 'public.food_products', 'insert'),
  'authenticated/anon: food_products weder lesen noch schreiben');
select is(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'public' and table_name = 'food_products'),
  array['code', 'found', 'off_fields', 'name_de', 'brand_de', 'quantity_label', 'base_unit', 'kcal', 'protein_g',
        'carbs_g', 'fat_g', 'sugar_g', 'sat_fat_g', 'fiber_g', 'salt_g', 'serving_g', 'package_g', 'check_level',
        'check_reasons', 'normalizer_version', 'source_db', 'source_license', 'source_url', 'off_last_modified',
        'retrieved_at'],
  'food_products: genau diese Spalten – keine user_id, kein „abgefragt von“, keine Zähler');
select is_empty(
  $$ select c.conname from pg_constraint c
     where c.contype = 'f' and (c.conrelid = 'public.food_products'::regclass
                                or c.confrelid = 'public.food_products'::regclass) $$,
  'kein Fremdschlüssel von oder auf food_products (nicht mit foods/recipes/Tagebuch verknüpft)');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where (n.nspname, p.proname) in (('public', 'food_product_lookup'), ('public', 'food_product_upsert'),
                                    ('public', 'food_product_off_backoff'), ('private', 'food_product_flag_admin'))),
  'Funktionen: security definer, search_path leer');
select ok(
  not has_function_privilege('authenticated', 'public.food_product_lookup(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.food_product_lookup(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.food_product_upsert(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.food_product_off_backoff()', 'execute'),
  'authenticated/anon: Abfrage, Speichern und Sperre nicht ausführbar (nur der Server)');
select ok(
  has_function_privilege('service_role', 'public.food_product_lookup(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.food_product_upsert(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.food_product_off_backoff()', 'execute'),
  'service_role: Abfrage, Speichern, Sperre');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('private.food_product_lookup_counts'::regclass, 'private.off_request_budget'::regclass))
  and not has_table_privilege('authenticated', 'private.food_product_lookup_counts', 'select')
  and not has_table_privilege('authenticated', 'private.off_request_budget', 'select'),
  'Zähler und Deckel: RLS an, für authenticated nicht lesbar');
select is(
  (select array_agg(column_name::text order by ordinal_position) from information_schema.columns
   where table_schema = 'private' and table_name = 'food_product_lookup_counts'),
  array['user_id', 'hour_start', 'lookups'], 'Zähler: ohne Nummer');
select ok(
  (select position('for share' in p.prosrc) between 1 and position('has_valid_consent_for' in p.prosrc)
          and position('has_valid_consent_for' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
          and position('pg_advisory_xact_lock' in p.prosrc)
              < position('insert into private.food_product_lookup_counts' in p.prosrc)
   from pg_proc p where p.oid = 'public.food_product_lookup(uuid, text)'::regprocedure),
  'Abfrage: Einwilligung FOR SHARE → prüfen → Advisory-Sperre → zählen');

-- ---------------------------------------------------------------------------------------------------------
-- Nummer prüfen (= barcode.ts)
-- ---------------------------------------------------------------------------------------------------------
select ok(private.barcode_ok('4006381333931') and private.barcode_ok('96385074')
          and private.barcode_ok('0036000291452'), 'barcode_ok: EAN-13, EAN-8, UPC-A als EAN-13');
select ok(not private.barcode_ok('4006381333932') and not private.barcode_ok('400638133393')
          and not private.barcode_ok('00000000') and not private.barcode_ok('40063813339A1')
          and not private.barcode_ok(null), 'barcode_ok: falsche Prüfziffer, 12 Ziffern, nur Nullen, Buchstaben, null');

-- ---------------------------------------------------------------------------------------------------------
-- Flag (aus) und beta_admin
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333931'), '{"result": "flag_off"}'::jsonb,
  'Flag aus (Standard) → flag_off, keine Abfrage');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-a@example.test', 90, 'food_product_lookup'),
  '{"result": "invalid_input"}'::jsonb, 'beta_admin: keine Freischaltung je Person für die Produktabfrage');
select is(public.beta_admin('flag_on', 'gruender 1', null, 90, 'food_product_lookup'),
  '{"result": "invalid_input"}'::jsonb, 'beta_admin: ungültiger Name abgelehnt');
select is(public.beta_admin('flag_on', 'gruender-1', null, 90, 'food_product_lookup'), '{"result": "flag_on"}'::jsonb,
  'beta_admin: Flag an');
select ok(
  (select s ->> 'result' = 'status' and (s ->> 'flag_enabled')::boolean and s ? 'cached_products'
          and s ? 'lookups_today' and not s ? 'user_id' and not s ? 'email'
   from (select public.beta_admin('status', 'gruender-1', null, 90, 'food_product_lookup') as s) x),
  'beta_admin status: nur Summen, kein Personenbezug');
select is((public.beta_admin('status', 'gruender-1')) ->> 'flag', 'ai_food_photo',
  'beta_admin: Foto-Flag unverändert (Obermenge)');
select is((select count(*)::integer from private.admin_actions where flag_key = 'food_product_lookup'), 1,
  'Protokoll der Flag-Aktion');

-- ---------------------------------------------------------------------------------------------------------
-- Einwilligung, ungültige Nummer
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.lookup('22222222-2222-4222-8222-222222222222', '4006381333931'), '{"result": "no_consent"}'::jsonb,
  'ohne Einwilligung health_data → no_consent (E4-G12)');
select throws_ok($$ select pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333932') $$,
  '22023', 'Ungültige Anfrage.', 'falsche Prüfziffer → Fehler ohne Werte');
select is((select count(*)::integer from private.food_product_lookup_counts), 0, 'ohne Einwilligung nichts gezählt');

-- ---------------------------------------------------------------------------------------------------------
-- Speicher: leer → fetch; Zeile frisch → cached; älter → fetch mit alter Zeile
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.reset_budget();
select is(pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333931'),
  '{"result": "fetch", "record": null}'::jsonb, 'leerer Speicher → OFF abfragen (Platz im Deckel genommen)');
select is((select requests from private.off_request_budget), 1, 'globaler Deckel: 1 Abfrage gezählt');
select is((select lookups from private.food_product_lookup_counts
           where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'Person: 1 Abfrage gezählt (ohne Nummer)');
select is(public.food_product_upsert(pg_temp.rec('4006381333931')), '{"result": "ok"}'::jsonb, 'Speichern');
select ok(
  (select r ->> 'result' = 'cached' and not (r ->> 'stale')::boolean
          and (r -> 'record' ->> 'kcal')::integer = 380 and r -> 'record' ->> 'name_de' = 'Testmüsli'
          and not (r -> 'record') ? 'source_db' and not (r -> 'record') ? 'user_id'
   from (select pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333931') as r) x),
  'frische Zeile → cached ohne OFF (Felder = FoodProductRecord, ohne Personenbezug)');
select is((select requests from private.off_request_budget), 1, 'Treffer im Speicher: kein Platz im Deckel');
select is((select lookups from private.food_product_lookup_counts
           where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'Treffer im Speicher zählt für die Person');
select is(public.food_product_upsert(pg_temp.rec('4006381333931', true, now() - interval '31 days')),
  '{"result": "ok"}'::jsonb, 'Zeile 31 Tage alt');
select ok(
  (select r ->> 'result' = 'fetch' and r -> 'record' ->> 'code' = '4006381333931'
   from (select pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333931') as r) x),
  'nach 30 Tagen → neu abfragen (alte Zeile für „Stand vom …“ dabei)');
select is(public.food_product_upsert(pg_temp.rec('96385074', false)), '{"result": "ok"}'::jsonb,
  'negativer Treffer gespeichert');
select ok(
  (select r ->> 'result' = 'cached' and not (r -> 'record' ->> 'found')::boolean
   from (select pg_temp.lookup('11111111-1111-4111-8111-111111111111', '96385074') as r) x),
  'negativer Treffer gilt (1 Tag)');

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen: 90 Tage, negative nach 1 Tag, höchstens 500 je Aufruf, Zähler nach 2 Tagen
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into public.food_products (code, found, off_fields, name_de, base_unit, kcal, protein_g, carbs_g, fat_g,
                                  check_level, normalizer_version, retrieved_at)
select c || (10 - (
         (select sum(substr(c, length(c) - i + 1, 1)::integer * case when i % 2 = 1 then 3 else 1 end)
          from generate_series(1, 12) i)) % 10) % 10,
       true, '{}', 'Alt', 'g', 1, 0, 0, 0, 'ok', 1, now() - interval '91 days'
from (select '400' || lpad(n::text, 9, '0') as c from generate_series(1, 501) n) x;
update public.food_products set retrieved_at = now() - interval '2 days' where code = '96385074';
insert into private.food_product_lookup_counts values
  ('33333333-3333-4333-8333-333333333333', date_trunc('hour', now() - interval '3 days'), 5);
select is(private.purge_food_products(), 500, 'Aufräumen: höchstens 500 Zeilen je Aufruf');
select is((select count(*)::integer from public.food_products where retrieved_at < now() - interval '90 days'), 1,
  'Rest beim nächsten Aufruf');
select is(private.purge_food_products(), 2, 'Rest gelöscht (inkl. negativer Treffer nach 1 Tag)');
select ok(not exists (select 1 from public.food_products where code = '96385074'), 'negativer Treffer nach 1 Tag weg');
select ok(exists (select 1 from public.food_products where code = '4006381333931'), 'Zeile mit 31 Tagen bleibt');
select is((select count(*)::integer from private.food_product_lookup_counts
           where user_id = '33333333-3333-4333-8333-333333333333'), 0, 'Zähler nach 2 Tagen gelöscht');

-- ---------------------------------------------------------------------------------------------------------
-- Globaler Deckel 10/Minute, Sperre nach 429/503
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.reset_budget();
select is((select count(*)::integer from generate_series(1, 11) i where private.off_request_reserve()), 10,
  'globaler Deckel: 10 von 11 Abfragen in derselben Minute');
update private.off_request_budget set window_start = date_trunc('minute', now()) - interval '1 minute';
select ok(private.off_request_reserve(), 'neue Minute: wieder frei');
set local role service_role;
select is(public.food_product_off_backoff(), '{"result": "ok"}'::jsonb, 'Sperre nach 429/503');
reset role;
update private.off_request_budget set window_start = date_trunc('minute', now()) - interval '1 minute', requests = 0;
select ok(not private.off_request_reserve(), 'während der Sperre keine Abfrage (auch in neuer Minute)');
select ok((select blocked_until between now() + interval '299 seconds' and now() + interval '301 seconds'
           from private.off_request_budget), 'Sperre 5 Minuten');
set local role service_role;
select is(public.food_product_upsert(pg_temp.rec('4006381333931', true, now() - interval '40 days')),
  '{"result": "ok"}'::jsonb, 'alte Zeile');
select ok(
  (select r ->> 'result' = 'cached' and (r ->> 'stale')::boolean
   from (select pg_temp.lookup('11111111-1111-4111-8111-111111111111', '4006381333931') as r) x),
  'Deckel voll/gesperrt + alte Zeile → „Stand vom …“');
select is((select lookups from private.food_product_lookup_counts
           where user_id = '33333333-3333-4333-8333-333333333333'), null::integer, '(C noch ohne Zähler)');
select is(pg_temp.lookup('33333333-3333-4333-8333-333333333333', '0036000291452'),
  '{"result": "unavailable"}'::jsonb, 'Deckel voll/gesperrt ohne Zeile → nicht erreichbar');
select is((select count(*)::integer from private.food_product_lookup_counts
           where user_id = '33333333-3333-4333-8333-333333333333'), 0, '„nicht erreichbar“ zählt nicht');

-- ---------------------------------------------------------------------------------------------------------
-- Limits je Person: 60 je Stunde, 200 je Kalendertag (Europe/Berlin)
-- ---------------------------------------------------------------------------------------------------------
reset role;
select pg_temp.reset_budget();
delete from private.food_product_lookup_counts;
insert into private.food_product_lookup_counts values
  ('33333333-3333-4333-8333-333333333333', date_trunc('hour', now()), 59);
set local role service_role;
select is(pg_temp.lookup('33333333-3333-4333-8333-333333333333', '4006381333931') ->> 'result', 'fetch',
  '60. Abfrage der Stunde geht');
select is(pg_temp.lookup('33333333-3333-4333-8333-333333333333', '4006381333931'),
  '{"result": "rate_limited", "scope": "hour"}'::jsonb, '61. Abfrage der Stunde → rate_limited');
reset role;
delete from private.food_product_lookup_counts;
-- 200 heute (Berlin) verteilt auf vier Stunden (auch spätere Stunden des Tages zählen zum Tag).
insert into private.food_product_lookup_counts
select '33333333-3333-4333-8333-333333333333',
       ((private.berlin_today() + make_interval(hours => h))::timestamp at time zone 'Europe/Berlin'), 50
from generate_series(20, 23) h;
set local role service_role;
select is(pg_temp.lookup('33333333-3333-4333-8333-333333333333', '4006381333931'),
  '{"result": "rate_limited", "scope": "day"}'::jsonb, '201. Abfrage des Tages → rate_limited (Tag)');
reset role;
delete from private.food_product_lookup_counts;
-- Gestern (Berlin, 23:00) zählt nicht für heute.
insert into private.food_product_lookup_counts
select '33333333-3333-4333-8333-333333333333',
       ((private.berlin_today() - 1 + make_interval(hours => h))::timestamp at time zone 'Europe/Berlin'), 50
from generate_series(20, 23) h;
set local role service_role;
select isnt(pg_temp.lookup('33333333-3333-4333-8333-333333333333', '4006381333931') ->> 'result', 'rate_limited',
  'Abfragen von gestern (Europe/Berlin) zählen nicht für heute');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern: Form und Grenzen (Fehler ohne Werte)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931') || '{"user_id": "x"}') $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'unbekanntes Feld (z. B. user_id) abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931', true, now(), 906)) $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'kcal über 905 je 100 abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931', true, now(), 380, 'blocked')
                                                      || '{"kcal": 380}') $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'gesperrt mit Werten abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931') || '{"check_reasons": ["boese"]}') $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'unbekannter Grund-Code abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931', true, now() + interval '1 hour')) $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'Abrufzeit in der Zukunft abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931')
                     || jsonb_build_object('off_fields', jsonb_build_object('x', repeat('y', 17000)))) $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'OFF-Felder über 16 KB abgelehnt');
select throws_ok($$ select public.food_product_upsert(pg_temp.rec('4006381333931') || '{"name_de": "<b>x</b>"}') $$,
  '23514', 'Ungültiger Speicher-Eintrag.', 'Markup im Namen abgelehnt (CHECK)');

-- ---------------------------------------------------------------------------------------------------------
-- Export: nur die eigenen Zähler; Konto löschen
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into private.food_product_lookup_counts values
  ('11111111-1111-4111-8111-111111111111', date_trunc('hour', now()) - interval '1 hour', 3);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(
  (select jsonb_array_length(e -> 'data' -> 'food_product_lookup_counts') >= 1
          and not (e -> 'data') ? 'food_products'
          and (select bool_and(not r ? 'user_id') from jsonb_array_elements(e -> 'data' -> 'food_product_lookup_counts') r)
   from (select public.export_my_data() as e) x),
  'Export: eigene Zähler (ohne Nummer), nie der gemeinsame Speicher');
select is((select count(*)::integer from private.my_food_product_lookup_counts()), 1,
  'Export: nur eigene Zeilen (C hat auch Zähler, die fehlen)');
select throws_ok($$ select * from public.food_products $$, '42501', null, 'authenticated: Speicher nicht lesbar');
reset role;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from private.food_product_lookup_counts
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Konto löschen: Zähler weg (Kaskade)');

select * from finish();
rollback;
