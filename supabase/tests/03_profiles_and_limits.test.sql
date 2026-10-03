-- Mindestalter 16 (serverseitig) und Wertebereiche (identisch zu packages/core/src/constants.ts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(66);

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
select lives_ok(
  $$ insert into public.goals (goal_type, sessions_per_week, minutes_per_session, preferred_days)
     values ('muscle_gain', 1, 10, '{1}') $$,
  'Ziel mit Untergrenzen (1 Tag, 10 Minuten)'
);
select lives_ok(
  $$ update public.goals set sessions_per_week = 7, minutes_per_session = 240, preferred_days = '{1,2,3,4,5,6,7}' $$,
  'Obergrenzen (7 Tage, 240 Minuten, alle Wochentage)'
);
select throws_ok($$ update public.goals set sessions_per_week = 0 $$, '23514', null, '0 Tage pro Woche');
select throws_ok($$ update public.goals set sessions_per_week = 8 $$, '23514', null, '8 Tage pro Woche');
select throws_ok($$ update public.goals set minutes_per_session = 9 $$, '23514', null, '9 Minuten');
select throws_ok($$ update public.goals set minutes_per_session = 241 $$, '23514', null, '241 Minuten');
select throws_ok($$ update public.goals set preferred_days = '{0}' $$, '23514', null, 'Wochentag 0');
select throws_ok($$ update public.goals set preferred_days = '{8}' $$, '23514', null, 'Wochentag 8');
select throws_ok($$ update public.goals set preferred_days = '{2,2}' $$, '23514', null, 'doppelter Wochentag');
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
