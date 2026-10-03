-- RLS-Test: Nutzer B sieht und ändert keine Zeilen von Nutzer A, anon sieht gar nichts.
-- Läuft mit `supabase test db` (pgTAP) – lokal und in der GitHub Action db-test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(67);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer A legt in jeder Tabelle Daten an.
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.profiles (user_id, sex, birth_date, experience_level, cycle_module_interest)
     values ('11111111-1111-4111-8111-111111111111', 'female', '1990-05-17', 'beginner', true) $$,
  'A: Profil anlegen (Voraussetzung für Einwilligungen)'
);
select lives_ok(
  $$ insert into public.consents (user_id, consent_type, version, platform) values
       ('11111111-1111-4111-8111-111111111111', 'terms', 1, 'web'),
       ('11111111-1111-4111-8111-111111111111', 'privacy', 1, 'web'),
       ('11111111-1111-4111-8111-111111111111', 'health_data', 1, 'ios') $$,
  'A: Einwilligungen erteilen'
);
select lives_ok(
  $$ insert into public.body_metrics (user_id, height_cm, weight_kg, body_fat_pct, resting_heart_rate_bpm)
     values ('11111111-1111-4111-8111-111111111111', 168.5, 62.3, 24.5, 58) $$,
  'A: Körperdaten mit Einwilligung speichern'
);
select lives_ok(
  $$ insert into public.health_screening (user_id, answers, flags)
     values ('11111111-1111-4111-8111-111111111111', '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}', '{}') $$,
  'A: Gesundheits-Check mit Einwilligung speichern'
);
select lives_ok(
  $$ insert into public.goals (user_id, goal_type, discipline, sessions_per_week, minutes_per_session,
       preferred_days, training_location)
     values ('11111111-1111-4111-8111-111111111111', 'endurance', 'half_marathon', 4, 60, '{1,3,5,6}', 'both') $$,
  'A: Ziel anlegen'
);
select lives_ok(
  $$ insert into public.user_equipment (user_id, equipment_id, location, weights_kg, note) values
       ('11111111-1111-4111-8111-111111111111', 'dumbbells', 'home', '{2,4,6.5}', null),
       ('11111111-1111-4111-8111-111111111111', 'other', 'home', '{}', 'Sprossenwand') $$,
  'A: Geräte anlegen (inkl. Sonstiges mit Freitext)'
);
select lives_ok(
  $$ insert into public.nutrition_prefs (user_id, diet_type, eats_pork, meals_per_day, cooking_mode, mealprep_days)
     values ('11111111-1111-4111-8111-111111111111', 'omnivore', false, 4, 'meal_prep', 2) $$,
  'A: Ernährungsangaben anlegen'
);
select lives_ok(
  $$ insert into public.food_preferences (user_id, food_group, kind) values
       ('11111111-1111-4111-8111-111111111111', 'fish', 'like'),
       ('11111111-1111-4111-8111-111111111111', 'lactose', 'intolerance') $$,
  'A: Vorlieben und Unverträglichkeit anlegen'
);

select is((select count(*) from public.profiles), 1::bigint, 'A sieht das eigene Profil');
select is((select count(*) from public.consents), 3::bigint, 'A sieht die eigenen Einwilligungen');
select is((select count(*) from public.body_metrics), 1::bigint, 'A sieht die eigenen Körperdaten');
select is((select count(*) from public.health_screening), 1::bigint, 'A sieht den eigenen Gesundheits-Check');
select is((select count(*) from public.food_preferences), 2::bigint, 'A sieht die eigenen Vorlieben');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer B: sieht nichts von A, kann nichts von A ändern oder löschen und nichts in A's Namen anlegen.
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is_empty($$ select 1 from public.profiles $$, 'B sieht keine Profile von A');
select is_empty($$ select 1 from public.consents $$, 'B sieht keine Einwilligungen von A');
select is_empty($$ select 1 from public.body_metrics $$, 'B sieht keine Körperdaten von A');
select is_empty($$ select 1 from public.health_screening $$, 'B sieht keine Gesundheits-Checks von A');
select is_empty($$ select 1 from public.goals $$, 'B sieht keine Ziele von A');
select is_empty($$ select 1 from public.user_equipment $$, 'B sieht keine Geräte von A');
select is_empty($$ select 1 from public.nutrition_prefs $$, 'B sieht keine Ernährungsangaben von A');
select is_empty($$ select 1 from public.food_preferences $$, 'B sieht keine Vorlieben von A');

select is_empty(
  $$ update public.profiles set locale = 'de-AT' returning 1 $$,
  'B kann A''s Profil nicht ändern'
);
select is_empty(
  $$ update public.consents set revoked_at = now() returning 1 $$,
  'B kann A''s Einwilligungen nicht widerrufen'
);
select is_empty(
  $$ update public.body_metrics set weight_kg = 99 returning 1 $$,
  'B kann A''s Körperdaten nicht ändern'
);
select is_empty(
  $$ update public.goals set sessions_per_week = 7 returning 1 $$,
  'B kann A''s Ziele nicht ändern'
);
select is_empty(
  $$ update public.user_equipment set weights_kg = '{20}' returning 1 $$,
  'B kann A''s Geräte nicht ändern'
);
select is_empty(
  $$ update public.nutrition_prefs set meals_per_day = 1 returning 1 $$,
  'B kann A''s Ernährungsangaben nicht ändern'
);
select is_empty(
  $$ update public.food_preferences set food_group = 'beef' returning 1 $$,
  'B kann A''s Vorlieben nicht ändern'
);

select is_empty($$ delete from public.body_metrics returning 1 $$, 'B kann A''s Körperdaten nicht löschen');
select is_empty($$ delete from public.goals returning 1 $$, 'B kann A''s Ziele nicht löschen');
select is_empty($$ delete from public.user_equipment returning 1 $$, 'B kann A''s Geräte nicht löschen');
select is_empty($$ delete from public.nutrition_prefs returning 1 $$, 'B kann A''s Ernährungsangaben nicht löschen');
select is_empty($$ delete from public.food_preferences returning 1 $$, 'B kann A''s Vorlieben nicht löschen');

-- B hat ein eigenes Profil und eine eigene Gesundheits-Einwilligung – trotzdem darf B nichts unter A's
-- Nutzer-ID speichern.
insert into public.profiles (user_id, birth_date) values ('22222222-2222-4222-8222-222222222222', '1985-03-01');
select lives_ok(
  $$ insert into public.consents (user_id, consent_type, version, platform)
     values ('22222222-2222-4222-8222-222222222222', 'health_data', 1, 'android') $$,
  'B: eigene Gesundheits-Einwilligung erteilen'
);
select throws_ok(
  $$ insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01') $$,
  '42501', null, 'B kann kein Profil für A anlegen'
);
select throws_ok(
  $$ insert into public.consents (user_id, consent_type, version, platform)
     values ('11111111-1111-4111-8111-111111111111', 'terms', 1, 'web') $$,
  '42501', null, 'B kann keine Einwilligung für A erteilen'
);
select throws_ok(
  $$ insert into public.body_metrics (user_id, weight_kg) values ('11111111-1111-4111-8111-111111111111', 80) $$,
  '42501', null, 'B kann keine Körperdaten für A speichern'
);
select throws_ok(
  $$ insert into public.health_screening (user_id, answers)
     values ('11111111-1111-4111-8111-111111111111', '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}') $$,
  '42501', null, 'B kann keinen Gesundheits-Check für A speichern'
);
select throws_ok(
  $$ insert into public.goals (user_id, goal_type) values ('11111111-1111-4111-8111-111111111111', 'fat_loss') $$,
  '42501', null, 'B kann kein Ziel für A anlegen'
);
select throws_ok(
  $$ insert into public.user_equipment (user_id, equipment_id, location)
     values ('11111111-1111-4111-8111-111111111111', 'barbell', 'gym') $$,
  '42501', null, 'B kann keine Geräte für A anlegen'
);
select throws_ok(
  $$ insert into public.nutrition_prefs (user_id, diet_type) values ('11111111-1111-4111-8111-111111111111', 'vegan') $$,
  '42501', null, 'B kann keine Ernährungsangaben für A anlegen'
);
select throws_ok(
  $$ insert into public.food_preferences (user_id, food_group, kind)
     values ('11111111-1111-4111-8111-111111111111', 'beef', 'dislike') $$,
  '42501', null, 'B kann keine Vorlieben für A anlegen'
);
-- Eigene Zeile anlegen und auf A umschreiben geht auch nicht.
select lives_ok(
  $$ insert into public.goals (user_id, goal_type) values ('22222222-2222-4222-8222-222222222222', 'fat_loss') $$,
  'B: eigenes Ziel anlegen'
);
select throws_ok(
  $$ update public.goals set user_id = '11111111-1111-4111-8111-111111111111' $$,
  '42501', null, 'B kann die eigene Zeile nicht auf A umschreiben'
);
select throws_ok(
  $$ update public.health_screening set flags = '{}' $$,
  '42501', null, 'Gesundheits-Checks sind für Nutzer nicht änderbar (Verlauf)'
);
select throws_ok(
  $$ delete from public.health_screening $$,
  '42501', null, 'Gesundheits-Checks sind für Nutzer nicht einzeln löschbar'
);

-- ---------------------------------------------------------------------------------------------------------
-- A's Daten sind unverändert vorhanden (Prüfung als Datenbank-Admin ohne RLS).
-- ---------------------------------------------------------------------------------------------------------
reset role;
select is(
  (select locale::text from public.profiles where user_id = '11111111-1111-4111-8111-111111111111'),
  'de-DE', 'A''s Profil unverändert'
);
select is(
  (select count(*) from public.consents
   where user_id = '11111111-1111-4111-8111-111111111111' and revoked_at is null),
  3::bigint, 'A''s Einwilligungen unverändert'
);
select is(
  (select weight_kg from public.body_metrics where user_id = '11111111-1111-4111-8111-111111111111'),
  62.3::numeric, 'A''s Körperdaten unverändert'
);
select is(
  (select sessions_per_week from public.goals where user_id = '11111111-1111-4111-8111-111111111111'),
  4::smallint, 'A''s Ziel unverändert'
);
select is(
  (select count(*) from public.user_equipment where user_id = '11111111-1111-4111-8111-111111111111'),
  2::bigint, 'A''s Geräte unverändert'
);
select is(
  (select meals_per_day from public.nutrition_prefs where user_id = '11111111-1111-4111-8111-111111111111'),
  4::smallint, 'A''s Ernährungsangaben unverändert'
);
select is(
  (select count(*) from public.food_preferences where user_id = '11111111-1111-4111-8111-111111111111'),
  2::bigint, 'A''s Vorlieben unverändert'
);

-- ---------------------------------------------------------------------------------------------------------
-- anon (nicht angemeldet): keine Nutzerdaten, nur veröffentlichte Einwilligungstexte.
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon: kein Zugriff auf profiles');
select throws_ok($$ select 1 from public.consents $$, '42501', null, 'anon: kein Zugriff auf consents');
select throws_ok($$ select 1 from public.body_metrics $$, '42501', null, 'anon: kein Zugriff auf body_metrics');
select throws_ok($$ select 1 from public.health_screening $$, '42501', null, 'anon: kein Zugriff auf health_screening');
select throws_ok($$ select 1 from public.goals $$, '42501', null, 'anon: kein Zugriff auf goals');
select throws_ok($$ select 1 from public.equipment $$, '42501', null, 'anon: kein Zugriff auf equipment');
select throws_ok($$ select 1 from public.user_equipment $$, '42501', null, 'anon: kein Zugriff auf user_equipment');
select throws_ok($$ select 1 from public.nutrition_prefs $$, '42501', null, 'anon: kein Zugriff auf nutrition_prefs');
select throws_ok($$ select 1 from public.food_preferences $$, '42501', null, 'anon: kein Zugriff auf food_preferences');
select throws_ok(
  $$ insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01') $$,
  '42501', null, 'anon: kann kein Profil anlegen'
);
select throws_ok(
  $$ select public.has_valid_consent('health_data') $$,
  '42501', null, 'anon: has_valid_consent nicht aufrufbar'
);
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon: delete_my_account nicht aufrufbar');
select is(
  (select count(*) from public.consent_documents),
  3::bigint, 'anon: liest die drei veröffentlichten Einwilligungstexte'
);
select is(public.current_consent_version('health_data'), 1, 'anon: aktuelle Version health_data = 1');

select * from finish();
rollback;
