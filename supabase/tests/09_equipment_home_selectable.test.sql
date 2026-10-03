-- Geräte-Katalog Phase 2: Studio-Geräte (home_selectable = false) sind beim Ort „home“ verboten.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

select has_column('public', 'equipment', 'home_selectable', 'Spalte equipment.home_selectable');
select col_default_is('public', 'equipment', 'home_selectable', 'true', 'Standard: zu Hause auswählbar');
select results_eq(
  $$ select id from public.equipment where not home_selectable order by sort_order $$,
  array['power_rack', 'cable_station', 'lat_pulldown', 'leg_press', 'machine_chest_press',
        'leg_curl_machine', 'leg_extension_machine', 'dip_station'],
  'Studio-Geräte sind nicht zu Hause auswählbar'
);
select is(
  (select count(*)::int from public.equipment where home_selectable), 11,
  'die 11 Geräte aus Phase 1 bleiben zu Hause auswählbar'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('cable_station', 'home') $$,
  '23514', 'Dieses Gerät gibt es nur im Studio.', 'Kabelzug „zu Hause“ wird abgelehnt'
);
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('cable_station', 'gym') $$,
  'Kabelzug im Studio ist erlaubt'
);
select throws_ok(
  $$ update public.user_equipment set location = 'home' where equipment_id = 'cable_station' $$,
  '23514', null, 'Ort nachträglich auf „home“ ändern wird abgelehnt'
);
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('dumbbells', 'home') $$,
  'Heim-Gerät zu Hause erlaubt'
);
select throws_ok(
  $$ update public.user_equipment set equipment_id = 'leg_press' where equipment_id = 'dumbbells' $$,
  '23514', null, 'Gerät zu Hause nachträglich gegen Studio-Gerät tauschen wird abgelehnt'
);
select throws_ok(
  $$ select public.replace_user_equipment('home', '[{"equipment_id":"kettlebells"},{"equipment_id":"leg_press"}]') $$,
  '23514', null, 'replace_user_equipment: Studio-Gerät zu Hause wird abgelehnt'
);
select results_eq(
  $$ select equipment_id || '@' || location from public.user_equipment order by 1 $$,
  array['cable_station@gym', 'dumbbells@home'],
  'atomar: nach dem Fehler ist der alte Stand unverändert'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('hovercraft', 'home') $$,
  '23503', null, 'unbekanntes Gerät weiterhin über den Fremdschlüssel abgelehnt'
);
select throws_ok(
  $$ update public.equipment set home_selectable = true where id = 'leg_press' $$,
  '42501', null, 'Nutzer können home_selectable nicht ändern'
);

reset role;
select is(
  (select home_selectable from public.equipment where id = 'leg_press'), false,
  'Katalog unverändert'
);

select * from finish();
rollback;
