-- Ohne Profil (= ohne geprüftes Geburtsdatum) keine Einwilligung, keine Gesundheitsdaten, keine sonstigen
-- Nutzerdaten. Verhindert, dass das Mindestalter 16 durch Weglassen des Profils umgangen wird.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

-- Doppelte Absicherung prüfen: Einwilligung existiert (vom Admin eingefügt), aber kein Profil.
insert into public.consents (user_id, consent_type, version, platform)
values ('11111111-1111-4111-8111-111111111111', 'health_data', 1, 'web');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('terms', 1, 'web') $$,
  '42501', null, 'ohne Profil: keine Einwilligung'
);
select is(public.has_valid_consent('health_data'), false, 'ohne Profil: has_valid_consent = false');
select throws_ok(
  $$ insert into public.body_metrics (weight_kg) values (70) $$,
  '42501', null, 'ohne Profil: keine Körperdaten'
);
select throws_ok(
  $$ insert into public.body_measurements (waist_cm) values (80) $$,
  '42501', null, 'ohne Profil: keine Körperumfänge'
);
select throws_ok(
  $$ insert into public.health_screening (answers) values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}') $$,
  '42501', null, 'ohne Profil: kein Gesundheits-Check'
);
select throws_ok(
  $$ insert into public.goals (goal_type) values ('fat_loss') $$,
  '42501', null, 'ohne Profil: kein Ziel'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('barbell', 'home') $$,
  '42501', null, 'ohne Profil: keine Geräte'
);
select throws_ok(
  $$ insert into public.nutrition_prefs (diet_type) values ('vegan') $$,
  '42501', null, 'ohne Profil: keine Ernährungsangaben'
);
select throws_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('fish', 'like') $$,
  '42501', null, 'ohne Profil: keine Vorlieben'
);
select throws_ok(
  $$ insert into public.measurement_reminders (interval_days) values (28) $$,
  '42501', null, 'ohne Profil: keine Mess-Erinnerung'
);

-- Unter 16 gibt es kein Profil – und damit auch keinen Weg zu Einwilligungen.
select throws_ok(
  format(
    $$ insert into public.profiles (birth_date) values (%L) $$,
    ((now() at time zone 'Europe/Berlin')::date - interval '15 years')::date
  ),
  '23514', null, 'unter 16: kein Profil'
);

-- Mit Profil geht es.
insert into public.profiles (birth_date) values ('1990-01-01');
select is(public.has_valid_consent('health_data'), true, 'mit Profil: Einwilligung gültig');
select lives_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('terms', 1, 'web') $$,
  'mit Profil: Einwilligung möglich'
);

select * from finish();
rollback;
