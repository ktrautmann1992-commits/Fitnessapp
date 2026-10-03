-- replace_user_equipment / replace_food_preferences: atomar, nur eigene Zeilen, RLS greift weiter.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- Nutzer B: eigene Geräte und Vorlieben (dürfen von A nie berührt werden).
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');
select public.replace_user_equipment('home', '[{"equipment_id":"barbell","weights_kg":[20]}]');
select public.replace_food_preferences('taste', '[{"food_group":"fish","kind":"like"}]');

-- Nutzer A
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_user_equipment('home', '[{"equipment_id":"dumbbells"}]') $$,
  '42501', null, 'ohne Profil: Geräte werden abgelehnt (RLS greift in der Funktion)'
);
insert into public.profiles (birth_date) values ('1990-01-01');

-- ---------------------------------------------------------------------------------------------------------
-- Geräte
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ select public.replace_user_equipment('home',
       '[{"equipment_id":"dumbbells","weights_kg":[2.5,10]},{"equipment_id":"other","note":"Sprungseil"}]') $$,
  'Geräte zu Hause speichern'
);
select is(
  (select weights_kg from public.user_equipment where equipment_id = 'dumbbells'),
  array[2.5, 10]::numeric(5, 2)[], 'Gewichtsstufen aus JSON übernommen'
);
select lives_ok(
  $$ select public.replace_user_equipment('gym', '[{"equipment_id":"treadmill"}]') $$,
  'Geräte im Studio speichern'
);
select lives_ok(
  $$ select public.replace_user_equipment('home', '[{"equipment_id":"kettlebells","weights_kg":[8]}]') $$,
  'Geräte zu Hause ersetzen'
);
select results_eq(
  $$ select equipment_id || '@' || location from public.user_equipment order by 1 $$,
  array['kettlebells@home', 'treadmill@gym'],
  'nur der Ort „home“ wurde ersetzt; Nutzer B ist unsichtbar'
);
select throws_ok(
  $$ select public.replace_user_equipment('home',
       '[{"equipment_id":"dumbbells"},{"equipment_id":"other"}]') $$,
  '23514', null, 'ungültiger Eintrag („Sonstiges“ ohne Freitext) wird abgelehnt'
);
select results_eq(
  $$ select equipment_id from public.user_equipment where location = 'home' $$,
  array['kettlebells'],
  'atomar: nach dem Fehler ist der alte Stand unverändert'
);
select throws_ok(
  $$ select public.replace_user_equipment('home', '{"equipment_id":"dumbbells"}') $$,
  '22023', null, 'kein JSON-Array → abgelehnt'
);
select lives_ok(
  $$ select public.replace_user_equipment('home', '[]') $$,
  'leere Liste löscht die Geräte des Orts'
);
select is((select count(*)::int from public.user_equipment where location = 'home'), 0, 'zu Hause leer');

-- ---------------------------------------------------------------------------------------------------------
-- Vorlieben
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ select public.replace_food_preferences('taste',
       '[{"food_group":"fish","kind":"like"},{"food_group":"eggs","kind":"dislike"}]') $$,
  'mag / mag nicht speichern'
);
select throws_ok(
  $$ select public.replace_food_preferences('intolerance', '[{"food_group":"peanuts","kind":"intolerance"}]') $$,
  '42501', null, 'ohne Einwilligung: Unverträglichkeiten werden abgelehnt'
);
select throws_ok(
  $$ select public.replace_food_preferences('taste', '[{"food_group":"peanuts","kind":"intolerance"}]') $$,
  '22023', null, 'Art passt nicht zum Bereich → abgelehnt'
);
select throws_ok(
  $$ select public.replace_food_preferences('taste',
       '[{"food_group":"fish","kind":"like"},{"food_group":"fish","kind":"dislike"}]') $$,
  '23505', null, '„mag“ und „mag nicht“ für dieselbe Gruppe → abgelehnt'
);
select is(
  (select count(*)::int from public.food_preferences), 2,
  'atomar: nach den Fehlern sind die bisherigen Vorlieben erhalten'
);

insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');
select lives_ok(
  $$ select public.replace_food_preferences('intolerance', '[{"food_group":"peanuts","kind":"intolerance"}]') $$,
  'mit Einwilligung: Unverträglichkeiten speichern'
);
select results_eq(
  $$ select food_group || ':' || kind from public.food_preferences order by 1 $$,
  array['eggs:dislike', 'fish:like', 'peanuts:intolerance'],
  'Bereiche werden getrennt ersetzt'
);

select * from finish();
rollback;
