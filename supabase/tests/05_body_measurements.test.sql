-- Körperumfänge (body_measurements) und Mess-Erinnerung (measurement_reminders):
-- Einwilligung, Fremdzugriff, Widerruf, Grenzwerte, Konto-Löschung.
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

-- ---------------------------------------------------------------------------------------------------------
-- Einwilligung
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.body_measurements (waist_cm) values (80) $$,
  '42501', null, 'ohne Einwilligung: Körperumfänge werden abgelehnt'
);
select lives_ok(
  $$ insert into public.measurement_reminders (next_due_on) values ('2026-10-31') $$,
  'Mess-Erinnerung braucht keine Gesundheits-Einwilligung'
);
select is(
  (select interval_days from public.measurement_reminders),
  28::smallint, 'Erinnerung standardmäßig alle 28 Tage'
);
select is((select enabled from public.measurement_reminders), true, 'Erinnerung standardmäßig aktiv');

insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');

-- ---------------------------------------------------------------------------------------------------------
-- Grenzwerte (Untergrenze/Obergrenze genau erlaubt, knapp daneben abgelehnt)
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.body_measurements (measured_on, upper_arm_left_cm, upper_arm_right_cm, chest_cm,
       shoulders_cm, waist_cm, abdomen_cm, thigh_left_cm, thigh_right_cm, hip_cm, calf_left_cm, calf_right_cm)
     values ('2026-01-01', 15, 15, 50, 70, 40, 40, 25, 25, 50, 15, 15) $$,
  'alle Untergrenzen genau: erlaubt'
);
select lives_ok(
  $$ insert into public.body_measurements (measured_on, upper_arm_left_cm, upper_arm_right_cm, chest_cm,
       shoulders_cm, waist_cm, abdomen_cm, thigh_left_cm, thigh_right_cm, hip_cm, calf_left_cm, calf_right_cm)
     values ('2026-01-02', 80, 80, 200, 220, 250, 250, 120, 120, 250, 80, 80) $$,
  'alle Obergrenzen genau: erlaubt'
);
select throws_ok($$ insert into public.body_measurements (measured_on, upper_arm_left_cm) values ('2026-02-01', 14.9) $$, '23514', null, 'Oberarm links 14,9');
select throws_ok($$ insert into public.body_measurements (measured_on, upper_arm_left_cm) values ('2026-02-01', 80.1) $$, '23514', null, 'Oberarm links 80,1');
select throws_ok($$ insert into public.body_measurements (measured_on, upper_arm_right_cm) values ('2026-02-01', 14.9) $$, '23514', null, 'Oberarm rechts 14,9');
select throws_ok($$ insert into public.body_measurements (measured_on, upper_arm_right_cm) values ('2026-02-01', 80.1) $$, '23514', null, 'Oberarm rechts 80,1');
select throws_ok($$ insert into public.body_measurements (measured_on, chest_cm) values ('2026-02-01', 49.9) $$, '23514', null, 'Brust 49,9');
select throws_ok($$ insert into public.body_measurements (measured_on, chest_cm) values ('2026-02-01', 200.1) $$, '23514', null, 'Brust 200,1');
select throws_ok($$ insert into public.body_measurements (measured_on, shoulders_cm) values ('2026-02-01', 69.9) $$, '23514', null, 'Schultern 69,9');
select throws_ok($$ insert into public.body_measurements (measured_on, shoulders_cm) values ('2026-02-01', 220.1) $$, '23514', null, 'Schultern 220,1');
select throws_ok($$ insert into public.body_measurements (measured_on, waist_cm) values ('2026-02-01', 39.9) $$, '23514', null, 'Taille 39,9');
select throws_ok($$ insert into public.body_measurements (measured_on, waist_cm) values ('2026-02-01', 250.1) $$, '23514', null, 'Taille 250,1');
select throws_ok($$ insert into public.body_measurements (measured_on, abdomen_cm) values ('2026-02-01', 39.9) $$, '23514', null, 'Bauch 39,9');
select throws_ok($$ insert into public.body_measurements (measured_on, abdomen_cm) values ('2026-02-01', 250.1) $$, '23514', null, 'Bauch 250,1');
select throws_ok($$ insert into public.body_measurements (measured_on, thigh_left_cm) values ('2026-02-01', 24.9) $$, '23514', null, 'Oberschenkel links 24,9');
select throws_ok($$ insert into public.body_measurements (measured_on, thigh_left_cm) values ('2026-02-01', 120.1) $$, '23514', null, 'Oberschenkel links 120,1');
select throws_ok($$ insert into public.body_measurements (measured_on, thigh_right_cm) values ('2026-02-01', 24.9) $$, '23514', null, 'Oberschenkel rechts 24,9');
select throws_ok($$ insert into public.body_measurements (measured_on, thigh_right_cm) values ('2026-02-01', 120.1) $$, '23514', null, 'Oberschenkel rechts 120,1');
select throws_ok($$ insert into public.body_measurements (measured_on, hip_cm) values ('2026-02-01', 49.9) $$, '23514', null, 'Hüfte 49,9');
select throws_ok($$ insert into public.body_measurements (measured_on, hip_cm) values ('2026-02-01', 250.1) $$, '23514', null, 'Hüfte 250,1');
select throws_ok($$ insert into public.body_measurements (measured_on, calf_left_cm) values ('2026-02-01', 14.9) $$, '23514', null, 'Wade links 14,9');
select throws_ok($$ insert into public.body_measurements (measured_on, calf_left_cm) values ('2026-02-01', 80.1) $$, '23514', null, 'Wade links 80,1');
select throws_ok($$ insert into public.body_measurements (measured_on, calf_right_cm) values ('2026-02-01', 14.9) $$, '23514', null, 'Wade rechts 14,9');
select throws_ok($$ insert into public.body_measurements (measured_on, calf_right_cm) values ('2026-02-01', 80.1) $$, '23514', null, 'Wade rechts 80,1');
select throws_ok($$ insert into public.body_measurements (measured_on) values ('2026-02-01') $$, '23514', null, 'Messung ganz ohne Werte');

select throws_ok($$ update public.measurement_reminders set interval_days = 6 $$, '23514', null, 'Erinnerung alle 6 Tage');
select throws_ok($$ update public.measurement_reminders set interval_days = 91 $$, '23514', null, 'Erinnerung alle 91 Tage');
select lives_ok($$ update public.measurement_reminders set interval_days = 7 $$, 'Erinnerung alle 7 Tage');
select lives_ok($$ update public.measurement_reminders set interval_days = 90, enabled = false $$, 'Erinnerung alle 90 Tage, aus');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer B: kein Zugriff auf A's Zeilen
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is_empty($$ select 1 from public.body_measurements $$, 'B sieht keine Körperumfänge von A');
select is_empty($$ select 1 from public.measurement_reminders $$, 'B sieht keine Erinnerung von A');
select is_empty($$ update public.body_measurements set waist_cm = 100 returning 1 $$, 'B kann A''s Umfänge nicht ändern');
select is_empty($$ update public.measurement_reminders set enabled = true returning 1 $$, 'B kann A''s Erinnerung nicht ändern');
select is_empty($$ delete from public.body_measurements returning 1 $$, 'B kann A''s Umfänge nicht löschen');
select throws_ok(
  $$ insert into public.measurement_reminders (user_id) values ('11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'B kann keine Erinnerung für A anlegen'
);

-- anon
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select 1 from public.body_measurements $$, '42501', null, 'anon: kein Zugriff auf body_measurements');
select throws_ok($$ select 1 from public.measurement_reminders $$, '42501', null, 'anon: kein Zugriff auf measurement_reminders');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data löscht die Umfänge, die Erinnerung bleibt.
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*) from public.body_measurements), 2::bigint, 'A sieht die eigenen Umfänge');
update public.consents set revoked_at = now() where consent_type = 'health_data';
select is_empty($$ select 1 from public.body_measurements $$, 'nach Widerruf: Körperumfänge gelöscht');
select is((select count(*) from public.measurement_reminders), 1::bigint, 'nach Widerruf: Erinnerung bleibt (keine Gesundheitswerte)');

-- ---------------------------------------------------------------------------------------------------------
-- Konto löschen entfernt auch die Erinnerung.
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.delete_my_account() $$, 'A löscht das Konto');
reset role;
select is_empty(
  $$ select 1 from public.measurement_reminders where user_id = '11111111-1111-4111-8111-111111111111' $$,
  'Konto gelöscht: Erinnerung entfernt'
);

select * from finish();
rollback;
