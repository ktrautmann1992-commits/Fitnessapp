-- Rezept-Favoriten (Migration 20261025120000_recipe_preferences.sql, Gründer-Freigabe 25.10.2026, KONZEPT 6.10a):
-- recipe_preferences mit RLS (A sieht und ändert nur Eigenes, anon nichts), CHECK der Arten, eine Vorliebe je Rezept,
-- Datum nicht in der Zukunft, Höchstzahl 2.000 (Ändern einer vorhandenen geht immer), Profil-Pflicht, Export nur der
-- eigenen Zeilen, Konto löschen per Kaskade. „Heute“ = Sonntag, 25.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-25'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('porridge', 1, 'published', 'Porridge', '{breakfast}', 1, false, 'vegan', false, '{}'),
       ('linsen-dal', 1, 'published', 'Linsen-Dal', '{main}', 1, false, 'vegan', false, '{}');
insert into public.recipe_preferences (user_id, recipe_id, kind, set_on)
values ('22222222-2222-4222-8222-222222222222', 'porridge', 'hidden', '2026-10-20');

-- ---------------------------------------------------------------------------------------------------------
-- Struktur
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.recipe_preferences'::regclass),
  'RLS auf recipe_preferences'
);
select col_is_pk('public', 'recipe_preferences', array['user_id', 'recipe_id'], 'eine Vorliebe je Person und Rezept');
select fk_ok('public', 'recipe_preferences', 'user_id', 'auth', 'users', 'id', 'Fremdschlüssel auf auth.users');

-- ---------------------------------------------------------------------------------------------------------
-- A sieht und ändert nur Eigenes
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is_empty($$ select 1 from public.recipe_preferences $$, 'A sieht keine Vorlieben von B');
select lives_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('porridge', 'favorite', '2026-10-25') $$,
  'A setzt ein Herz'
);
select throws_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('porridge', 'hidden', '2026-10-25') $$,
  '23505', null, 'eine Vorliebe je Rezept (die App ersetzt per Upsert)'
);
select lives_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('porridge', 'hidden', '2026-10-25')
     on conflict (user_id, recipe_id) do update set kind = excluded.kind, set_on = excluded.set_on $$,
  'A ersetzt Herz durch „Nie wieder“ (Upsert)'
);
select is(
  (select kind from public.recipe_preferences where recipe_id = 'porridge'), 'hidden', 'Vorliebe ersetzt'
);
select throws_ok(
  $$ update public.recipe_preferences set kind = 'like' where recipe_id = 'porridge' $$,
  '23514', null, 'nur favorite oder hidden'
);
select throws_ok(
  $$ update public.recipe_preferences set set_on = '2026-10-28' where recipe_id = 'porridge' $$,
  '23514', 'Ungültiges Datum.', 'Datum nicht in der Zukunft (Gerätezeit + 1 Tag)'
);
select lives_ok(
  $$ update public.recipe_preferences set set_on = '2026-10-19' where recipe_id = 'porridge' $$,
  'offline gesetzt und Tage später angekommen: erlaubt'
);
select throws_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('gibt-es-nicht', 'favorite', '2026-10-25') $$,
  '23503', null, 'nur bekannte Rezepte'
);
select throws_ok(
  $$ insert into public.recipe_preferences (user_id, recipe_id, kind, set_on)
     values ('22222222-2222-4222-8222-222222222222', 'linsen-dal', 'favorite', '2026-10-25') $$,
  '42501', null, 'A setzt keine Vorliebe im Namen von B'
);
-- Fremde Zeilen: Ändern und Löschen bleiben ohne Wirkung (RLS).
update public.recipe_preferences set kind = 'favorite' where user_id = '22222222-2222-4222-8222-222222222222';
delete from public.recipe_preferences where user_id = '22222222-2222-4222-8222-222222222222';
select is(
  (select jsonb_array_length(public.export_my_data() -> 'data' -> 'recipe_preferences')), 1,
  'Export: genau die eigene Vorliebe'
);
select lives_ok($$ delete from public.recipe_preferences where recipe_id = 'porridge' $$, 'A lässt das Gericht wieder zu');
select is_empty($$ select 1 from public.recipe_preferences $$, 'A: keine Vorliebe mehr');

reset role;
select results_eq(
  $$ select kind from public.recipe_preferences where user_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values ('hidden'::text) $$, 'B: Vorliebe unverändert (A konnte nichts ändern oder löschen)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Höchstzahl 2.000: vorhandene ändern geht, neue nicht
-- ---------------------------------------------------------------------------------------------------------
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
select 'rz-' || n, 1, 'published', 'Rezept ' || n, '{main}', 1, false, 'vegan', false, '{}'
from generate_series(1, 2000) as n;
insert into public.recipe_preferences (user_id, recipe_id, kind, set_on)
select '22222222-2222-4222-8222-222222222222', 'rz-' || n, 'favorite', '2026-10-25' from generate_series(1, 1999) as n;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('porridge', 'favorite', '2026-10-25')
     on conflict (user_id, recipe_id) do update set kind = excluded.kind $$,
  'B ändert eine vorhandene Vorliebe bei 2.000 Einträgen'
);
select throws_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('rz-2000', 'favorite', '2026-10-25') $$,
  '23514', 'Zu viele Rezept-Vorlieben.', 'keine 2.001. Vorliebe'
);

-- Ohne Profil: nichts speichern.
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.recipe_preferences (recipe_id, kind, set_on) values ('porridge', 'favorite', '2026-10-25') $$,
  '42501', null, 'ohne Profil: keine Vorliebe'
);

-- anon: kein Zugriff
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select 1 from public.recipe_preferences $$, '42501', null, 'anon: kein Zugriff auf recipe_preferences'
);

-- Konto löschen: Vorlieben gehen mit (Kaskade).
reset role;
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::int from public.recipe_preferences where user_id = '22222222-2222-4222-8222-222222222222'), 0,
  'Konto gelöscht → Vorlieben gelöscht'
);

select * from finish();
rollback;
