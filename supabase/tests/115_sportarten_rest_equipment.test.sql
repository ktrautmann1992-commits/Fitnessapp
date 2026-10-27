-- Sportarten Stufe 1 · Restpunkte (20261027180000_sportarten_rest_equipment.sql, docs/PLAN-SPORTARTEN-STUFE-1.md 11):
-- - Hyrox-Geräte (Ski-Ergometer, Schlitten, Sandsack, Wall Ball) im Katalog, zu Hause wählbar, kein Kraft-Gerät,
-- - „Hyrox-Geräte im Studio“ = Zeilen mit Ort gym über replace_user_equipment (wie „Im Studio auch rudern“),
-- - Matte und Block: im Katalog, nicht zu Hause speicherbar (nichts zu wählen), RLS unverändert.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

select results_eq(
  $$ select id || ':' || category::text || ':' || home_selectable::text from public.equipment
     where id in ('ski_erg', 'sled', 'sandbag', 'wall_ball', 'mat', 'yoga_block')
     order by sort_order $$,
  array['ski_erg:cardio:true', 'sled:other:true', 'sandbag:other:true', 'wall_ball:other:true',
        'mat:other:false', 'yoga_block:other:false'],
  'neue Geräte mit Kategorie und „zu Hause wählbar“'
);
select is(
  (select count(*)::int from public.equipment where id in ('ski_erg', 'sled', 'sandbag', 'wall_ball') and has_weights),
  0,
  'Hyrox-Geräte ohne Gewichtsstufen'
);

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
insert into public.profiles (birth_date) values ('1990-01-01');

select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('sandbag', 'home'), ('wall_ball', 'home') $$,
  'Sandsack und Wall Ball zu Hause speicherbar'
);
select lives_ok(
  $$ select public.replace_user_equipment('gym', '[
       {"equipment_id": "rowing_machine"}, {"equipment_id": "ski_erg"}, {"equipment_id": "sled"},
       {"equipment_id": "sandbag"}, {"equipment_id": "wall_ball"}]'::jsonb) $$,
  '„Hyrox-Geräte im Studio“ und „Im Studio auch rudern“ zusammen als Studio-Zeilen'
);
select is(
  (select count(*)::int from public.user_equipment where location = 'gym'),
  5,
  'fünf Studio-Zeilen gespeichert'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('mat', 'home') $$,
  '23514', null,
  'Matte ist nicht zu Hause speicherbar (Hilfsmittel, nichts zu wählen)'
);

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::int from public.user_equipment), 0, 'B sieht die Geräte von A nicht');
select lives_ok(
  $$ select public.replace_user_equipment('gym', '[]'::jsonb) $$,
  'B kann seine (leeren) Studio-Geräte ersetzen, ohne A zu berühren'
);

select * from finish();
rollback;
