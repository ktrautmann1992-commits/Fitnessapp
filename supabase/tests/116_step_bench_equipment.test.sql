-- Barbell Burn (20261114120000_step_bench_equipment.sql, docs/PLAN-BARBELL-BURN.md): Stepbrett im Katalog, Kategorie
-- other, ohne Gewichtsstufen, nicht zu Hause speicherbar (Hilfsmittel – Ersatz Boden, nichts zu wählen).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

select results_eq(
  $$ select id || ':' || category::text || ':' || has_weights::text || ':' || home_selectable::text
     from public.equipment where id = 'step_bench' $$,
  array['step_bench:other:false:false'],
  'Stepbrett mit Kategorie, ohne Gewichte, nicht zu Hause wählbar'
);

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
insert into public.profiles (birth_date) values ('1990-01-01');

select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('step_bench', 'home') $$,
  '23514', null,
  'Stepbrett ist nicht zu Hause speicherbar (Hilfsmittel, nichts zu wählen)'
);

select * from finish();
rollback;
