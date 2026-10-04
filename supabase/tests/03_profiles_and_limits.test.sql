-- Mindestalter 16 (serverseitig) und Wertebereiche (identisch zu packages/core/src/constants.ts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(68);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------------------------------------
-- Mindestalter 16 (Stichtag: heute in Europe/Berlin)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  format(
    $$ insert into public.profiles (birth_date) values (%L) $$,
    ((now() at time zone 'Europe/Berlin')::date - interval '16 years' + interval '1 day')::date
  ),
  '23514', 'Die App ist ab 16 Jahren nutzbar.', 'einen Tag vor dem 16. Geburtstag: abgelehnt'
);
select throws_ok(
  format($$ insert into public.profiles (birth_date) values (%L) $$, (now() at time zone 'Europe/Berlin')::date),
  '23514', null, 'heute geboren: abgelehnt'
);
select throws_ok(
  format(
    $$ insert into public.profiles (birth_date) values (%L) $$,
    ((now() at time zone 'Europe/Berlin')::date + 1)
  ),
  '23514', null, 'Geburtsdatum in der Zukunft: abgelehnt'
);
select throws_ok(
  $$ insert into public.profiles (birth_date) values ('1899-12-31') $$,
  '23514', null, 'Geburtsdatum vor 1900: abgelehnt'
);
select lives_ok(
  format(
    $$ insert into public.profiles (birth_date) values (%L) $$,
    ((now() at time zone 'Europe/Berlin')::date - interval '16 years')::date
  ),
  'am 16. Geburtstag: erlaubt'
);
select throws_ok(
  format(
    $$ update public.profiles set birth_date = %L $$,
    ((now() at time zone 'Europe/Berlin')::date - interval '15 years')::date
  ),
  '23514', null, 'nachträglich unter 16 ändern: abgelehnt'
);
select lives_ok($$ update public.profiles set birth_date = '1900-01-01' $$, 'sehr alt (1900): erlaubt');
select is((select locale::text from public.profiles), 'de-DE', 'Sprache standardmäßig de-DE');

-- Profil-Felder
select throws_ok(
  $$ update public.profiles set sex = 'male', cycle_module_interest = true $$,
  '23514', null, 'Zyklus-Interesse nur bei „weiblich“'
);
select throws_ok(
  $$ update public.profiles set sex = null, cycle_module_interest = true $$,
  '23514', null, 'Zyklus-Interesse nicht ohne Geschlecht'
);
select lives_ok(
  $$ update public.profiles set sex = 'female', cycle_module_interest = false $$,
  'weiblich mit Zyklus-Interesse nein'
);
select lives_ok($$ update public.profiles set sex = 'diverse', cycle_module_interest = null $$, 'divers');
select lives_ok($$ update public.profiles set sex = 'unspecified' $$, 'keine Angabe');
select throws_ok($$ update public.profiles set onboarding_step = 'wearable' $$, '23514', null, 'unbekannter Onboarding-Schritt');
select lives_ok($$ update public.profiles set onboarding_step = 'cooking' $$, 'bekannter Onboarding-Schritt');
select throws_ok($$ update public.profiles set locale = 'en-US' $$, '22P02', null, 'nicht unterstützte Sprache');

-- ---------------------------------------------------------------------------------------------------------
-- body_metrics (mit Einwilligung)
-- ---------------------------------------------------------------------------------------------------------
insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');

select lives_ok(
  $$ insert into public.body_metrics (measured_on, height_cm, weight_kg, body_fat_pct, resting_heart_rate_bpm)
     values ('2026-01-01', 100, 30, 3, 30) $$,
  'Untergrenzen genau: erlaubt'
);
select lives_ok(
  $$ insert into public.body_metrics (measured_on, height_cm, weight_kg, body_fat_pct, resting_heart_rate_bpm)
     values ('2026-01-02', 250, 300, 60, 120) $$,
  'Obergrenzen genau: erlaubt'
);
select throws_ok($$ insert into public.body_metrics (measured_on, height_cm) values ('2026-02-01', 99.9) $$, '23514', null, 'Größe 99,9 cm');
select throws_ok($$ insert into public.body_metrics (measured_on, height_cm) values ('2026-02-01', 250.1) $$, '23514', null, 'Größe 250,1 cm');
select throws_ok($$ insert into public.body_metrics (measured_on, weight_kg) values ('2026-02-01', 29.9) $$, '23514', null, 'Gewicht 29,9 kg');
select throws_ok($$ insert into public.body_metrics (measured_on, weight_kg) values ('2026-02-01', 300.1) $$, '23514', null, 'Gewicht 300,1 kg');
select throws_ok($$ insert into public.body_metrics (measured_on, body_fat_pct) values ('2026-02-01', 2.9) $$, '23514', null, 'Körperfett 2,9 %');
select throws_ok($$ insert into public.body_metrics (measured_on, body_fat_pct) values ('2026-02-01', 60.1) $$, '23514', null, 'Körperfett 60,1 %');
select throws_ok($$ insert into public.body_metrics (measured_on, resting_heart_rate_bpm) values ('2026-02-01', 29) $$, '23514', null, 'Ruhepuls 29');
select throws_ok($$ insert into public.body_metrics (measured_on, resting_heart_rate_bpm) values ('2026-02-01', 121) $$, '23514', null, 'Ruhepuls 121');
select throws_ok($$ insert into public.body_metrics (measured_on) values ('2026-02-01') $$, '23514', null, 'Messung ganz ohne Werte');
select throws_ok(
  $$ insert into public.body_metrics (measured_on, weight_kg) values ('2026-01-01', 80) $$,
  '23505', null, 'nur eine Messung pro Tag (Upsert statt Doppel-Eintrag)'
);

-- ---------------------------------------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------------------------------------
-- Zeitbudget-Grenzen stehen seit Etappe B2 in training_slots (15_training_slots.test.sql).
select lives_ok(
  $$ insert into public.goals (goal_type, training_location) values ('muscle_gain', 'home') $$,
  'Ziel anlegen'
);
select hasnt_column('public', 'goals', 'sessions_per_week', 'goals ohne sessions_per_week');
select hasnt_column('public', 'goals', 'minutes_per_session', 'goals ohne minutes_per_session');
select hasnt_column('public', 'goals', 'preferred_days', 'goals ohne preferred_days');
select throws_ok($$ update public.goals set discipline = 'marathon' $$, '23514', null, 'Disziplin nur beim Ziel Ausdauer');
select lives_ok(
  $$ update public.goals set goal_type = 'endurance', discipline = 'triathlon_long', target_date = '2027-06-01' $$,
  'Ausdauer mit Disziplin und Wettkampfdatum'
);

-- ---------------------------------------------------------------------------------------------------------
-- user_equipment
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg) values ('kettlebells', 'home', '{0.25,200}') $$,
  'Gewichtsstufen an den Grenzen (0,25 und 200 kg)'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg) values ('dumbbells', 'home', '{0.2}') $$,
  '23514', null, 'Gewichtsstufe unter 0,25 kg'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg) values ('dumbbells', 'home', '{200.5}') $$,
  '23514', null, 'Gewichtsstufe über 200 kg'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg) values ('dumbbells', 'home', '{5,5}') $$,
  '23514', null, 'doppelte Gewichtsstufe'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('other', 'home') $$,
  '23514', null, 'Sonstiges ohne Freitext'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location, note) values ('treadmill', 'home', 'x') $$,
  '23514', null, 'Freitext nur bei Sonstiges'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('hovercraft', 'home') $$,
  '23503', null, 'Gerät muss im Katalog stehen'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('kettlebells', 'home') $$,
  '23505', null, 'Gerät je Ort nur einmal'
);
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('kettlebells', 'gym') $$,
  'dasselbe Gerät im Studio'
);
-- Langhantel (Etappe B2): Stange 5–25 kg nur bei der Langhantel, Scheiben höchstens 25 kg je Scheibe.
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg, bar_kg) values ('barbell', 'home', '{1.25,25}', 5) $$,
  'Langhantel: Stange 5 kg, Scheibe 25 kg'
);
select lives_ok($$ update public.user_equipment set bar_kg = 25 where equipment_id = 'barbell' $$, 'Stange 25 kg');
select throws_ok(
  $$ update public.user_equipment set bar_kg = 4.99 where equipment_id = 'barbell' $$, '23514', null, 'Stange unter 5 kg'
);
select throws_ok(
  $$ update public.user_equipment set bar_kg = 25.01 where equipment_id = 'barbell' $$, '23514', null, 'Stange über 25 kg'
);
select throws_ok(
  $$ update public.user_equipment set weights_kg = '{27.5}' where equipment_id = 'barbell' $$,
  '23514', null, 'Langhantel-Scheibe 27,5 kg abgelehnt'
);
select throws_ok(
  $$ update public.user_equipment set bar_kg = 20 where equipment_id = 'kettlebells' $$,
  '23514', null, 'Stange nur bei der Langhantel'
);
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location, weights_kg) values ('dumbbells', 'home', '{40}') $$,
  'Kurzhantel 40 kg je Hantel bleibt erlaubt'
);

-- ---------------------------------------------------------------------------------------------------------
-- nutrition_prefs und food_preferences
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.nutrition_prefs (diet_type, eats_pork) values ('vegan', true) $$,
  '23514', null, 'vegan und Schwein schließen sich aus'
);
select lives_ok(
  $$ insert into public.nutrition_prefs (diet_type, meals_per_day) values ('vegetarian', 1) $$,
  '1 Mahlzeit pro Tag'
);
select lives_ok($$ update public.nutrition_prefs set meals_per_day = 8 $$, '8 Mahlzeiten pro Tag');
select throws_ok(
  $$ update public.nutrition_prefs set mealprep_days = 3 $$,
  '23514', null, 'Meal-Prep-Tage ohne Kochmodus'
);
select throws_ok($$ update public.nutrition_prefs set meals_per_day = 0 $$, '23514', null, '0 Mahlzeiten');
select throws_ok($$ update public.nutrition_prefs set meals_per_day = 9 $$, '23514', null, '9 Mahlzeiten');
select throws_ok(
  $$ update public.nutrition_prefs set cooking_mode = 'meal_prep' $$,
  '23514', null, 'Meal-Prep ohne Anzahl Tage'
);
select lives_ok($$ update public.nutrition_prefs set cooking_mode = 'meal_prep', mealprep_days = 1 $$, 'Meal-Prep 1 Tag');
select lives_ok($$ update public.nutrition_prefs set mealprep_days = 7 $$, 'Meal-Prep 7 Tage');
select throws_ok($$ update public.nutrition_prefs set mealprep_days = 8 $$, '23514', null, 'Meal-Prep 8 Tage');
select throws_ok(
  $$ update public.nutrition_prefs set cooking_mode = 'daily' $$,
  '23514', null, 'täglich frisch mit Meal-Prep-Tagen'
);
select lives_ok($$ update public.nutrition_prefs set cooking_mode = 'daily', mealprep_days = null $$, 'täglich frisch');

select throws_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('chocolate', 'like') $$,
  '23514', null, 'unbekannte Lebensmittel-Gruppe'
);
select lives_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('dairy', 'like'), ('dairy', 'intolerance') $$,
  'mag Milchprodukte und verträgt sie nicht – beides möglich'
);
select throws_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('dairy', 'dislike') $$,
  '23505', null, 'mag und mag nicht für dieselbe Gruppe schließen sich aus'
);

-- ---------------------------------------------------------------------------------------------------------
-- Kataloge sind für Nutzer schreibgeschützt.
-- ---------------------------------------------------------------------------------------------------------
select is((select count(*) from public.equipment), 19::bigint, 'Geräte-Katalog lesbar (19 Einträge: 11 aus Phase 1, 8 Studio-Geräte aus Phase 2)');
select throws_ok(
  $$ insert into public.equipment (id, name_de, category) values ('sled', 'Schlitten', 'other') $$,
  '42501', null, 'Nutzer können den Geräte-Katalog nicht ändern'
);
select throws_ok(
  $$ update public.consent_documents set body_de = 'geändert' $$,
  '42501', null, 'Nutzer können Einwilligungstexte nicht ändern'
);

select * from finish();
rollback;
