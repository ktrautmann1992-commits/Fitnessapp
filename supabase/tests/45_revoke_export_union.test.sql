-- Zusammenführung E4a + Ziele Z3 (Wächter-Bericht E4a H1, Migration 20261017210000_revoke_export_union.sql): Der
-- Widerruf health_data löscht Wunschgewicht (weight_goals) UND eigene Produkte (user_food_products) samt
-- Produkt-Favoriten; der Export enthält alle drei Schlüssel. Fremde Daten bleiben unberührt.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.food_products (code, found, off_fields, name_de, brand_de, base_unit, kcal, protein_g, carbs_g,
                                  fat_g, check_level, check_reasons, normalizer_version, retrieved_at)
values ('4006381333931', true, '{}', 'Testmüsli', 'Testmarke', 'g', 380, 10, 60, 9, 'ok', '{}', 1, now());

-- Beide Personen: Profil, Abnehmziel, Einwilligung, Wunschgewicht, eigenes Produkt, Produkt-Favoriten.
create function pg_temp.fill(p_user text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  insert into public.profiles (birth_date) values ('1990-01-01');
  insert into public.goals (goal_type) values ('fat_loss');
  insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');
  insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
  values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks');
  perform public.save_user_food_product(jsonb_build_object(
    'id', substr(p_user, 1, 8) || '-0000-4000-8000-0000000000aa', 'write_id', gen_random_uuid(), 'base_revision', null,
    'name_de', 'Hofjoghurt', 'brand_de', null, 'code', null, 'base_unit', 'g', 'kcal', 70, 'protein_g', 4,
    'carbs_g', 5, 'fat_g', 3.5, 'sugar_g', null, 'salt_g', null, 'serving_g', 150, 'based_on_off', false));
  insert into public.food_log_favorites (user_id, fav_key, source, product_code, title_de, amount, unit)
  values (p_user::uuid, 'product|4006381333931', 'product', '4006381333931', 'x', 50, 'g');
  insert into public.food_log_favorites (user_id, fav_key, source, user_product_id, title_de, amount, unit)
  values (p_user::uuid, 'own_product|' || substr(p_user, 1, 8) || '-0000-4000-8000-0000000000aa', 'product',
          (substr(p_user, 1, 8) || '-0000-4000-8000-0000000000aa')::uuid, 'x', 150, 'g');
end;
$$;
grant execute on function pg_temp.fill(text) to authenticated;

set local role authenticated;
select pg_temp.fill('11111111-1111-4111-8111-111111111111');
select pg_temp.fill('22222222-2222-4222-8222-222222222222');

-- Export (Person A) vor dem Widerruf: alle drei Schlüssel.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select ok(
  (select jsonb_array_length(d -> 'weight_goals') = 1 and jsonb_array_length(d -> 'user_food_products') = 1
          and d ? 'food_product_lookup_counts'
   from (select public.export_my_data() -> 'data' as d) x),
  'Export enthält weight_goals, user_food_products und food_product_lookup_counts');
reset role;
select is((select count(*)::integer from public.weight_goals), 2, 'vorher: zwei Wunschgewichte');
select is((select count(*)::integer from public.user_food_products), 2, 'vorher: zwei eigene Produkte');
select is((select count(*)::integer from public.food_log_favorites where source = 'product'), 4,
  'vorher: vier Produkt-Favoriten');

-- Widerruf health_data (Person A).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
update public.consents set revoked_at = now() where consent_type = 'health_data' and revoked_at is null;
reset role;

select is((select count(*)::integer from public.weight_goals
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Widerruf: Wunschgewicht gelöscht (Z3)');
select is((select count(*)::integer from public.user_food_products
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Widerruf: eigene Produkte gelöscht (E4a)');
select is((select count(*)::integer from public.food_log_favorites
           where user_id = '11111111-1111-4111-8111-111111111111' and source = 'product'), 0,
  'Widerruf: Produkt-Favoriten gelöscht (E4a)');
select is((select count(*)::integer from public.weight_goals
           where user_id = '22222222-2222-4222-8222-222222222222'), 1, 'Person B: Wunschgewicht bleibt');
select is((select count(*)::integer from public.user_food_products
           where user_id = '22222222-2222-4222-8222-222222222222'), 1, 'Person B: eigenes Produkt bleibt');
select is((select count(*)::integer from public.food_log_favorites
           where user_id = '22222222-2222-4222-8222-222222222222' and source = 'product'), 2,
  'Person B: Produkt-Favoriten bleiben');

-- Export (Person A) nach dem Widerruf: Schlüssel da, Listen leer.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select ok(
  (select jsonb_array_length(d -> 'weight_goals') = 0 and jsonb_array_length(d -> 'user_food_products') = 0
   from (select public.export_my_data() -> 'data' as d) x),
  'Export nach dem Widerruf: leere Listen');
reset role;

-- Neueste Fassungen sind die Vereinigung (keine ältere gewinnt).
select ok(
  (select prosrc like '%delete from public.weight_goals%' and prosrc like '%delete from public.user_food_products%'
   from pg_proc where oid = 'private.consents_after_revoke()'::regprocedure),
  'consents_after_revoke enthält beide Löschungen');
select ok(
  (select prosrc like '%''weight_goals'', (select%' and prosrc like '%''user_food_products'', (select%'
          and prosrc like '%''food_product_lookup_counts'', (select%'
   from pg_proc where oid = 'public.export_my_data()'::regprocedure),
  'export_my_data enthält alle drei Schlüssel');
select is(
  obj_description('public.user_food_products'::regclass, 'pg_class') like 'SENSIBEL (Art. 9%', true,
  'user_food_products: Kommentar „SENSIBEL (Art. 9“ (SENSIBEL-Test)');

select * from finish();
rollback;
