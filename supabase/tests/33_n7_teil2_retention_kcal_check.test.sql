-- Phase 5 · N7 Teil 2 (docs/PLAN-PHASE-5.md „Umsetzungsstand N7 Teil 2“): Löschfrist alter Essenspläne und
-- Einkaufslisten (G-N7-2, MEAL_PLAN_RETENTION_WEEKS = 4) und Mindest-Plausibilität der Tageskalorien in
-- save_meal_plan (G-W3, Spiegel von serverDayKcalFloor/mealPlanDaysBelowFloor in packages/core).
-- „Heute“ = Mittwoch, 14.10.2026 (Woche ab Montag 12.10.) → Löschfrist: Wochen vor Montag, 14.09.2026, werden gelöscht.
-- Erwartete Grundumsätze (kcal) aus packages/core gerechnet (n7-teil2.test.ts):
--   A: männlich, 1990-01-01, 180 cm, 80 kg → 10·80 + 6,25·180 − 5·36 + 5 = 1.750
--   E: weiblich, 16. Geburtstag am 14.10., 160 cm, 50 kg → 500 + 1.000 − 80 − 161 = 1.259 (am 13.10.: 15 J. → 1.264)
--   F: ohne Angabe (+5), 1931-01-01 (95 J.), 200 cm, 300 kg → 3.000 + 1.250 − 475 + 5 = 3.780
--   G: wie A, Körperfett 10 % vom 16.07. → am 14.10. (90 Tage) Katch 370 + 21,6·72 = 1.925,2; am 15.10. (91 Tage) 1.750
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-14'
$$;

-- A: Einwilligung + Körperdaten. B: OHNE Einwilligung health_data. C: schwanger. D: nur Gewicht. E: 16 Jahre.
-- F: 95 Jahre, sehr schwer, ohne Geschlecht. G: Körperfett.
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('b0000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('c0000000-0000-4000-8000-00000000000c', 'c@example.test'),
  ('d0000000-0000-4000-8000-00000000000d', 'd@example.test'),
  ('e0000000-0000-4000-8000-00000000000e', 'e@example.test'),
  ('f0000000-0000-4000-8000-00000000000f', 'f@example.test'),
  ('90000000-0000-4000-8000-000000000009', 'g@example.test');
insert into public.profiles (user_id, birth_date, sex) values
  ('a0000000-0000-4000-8000-00000000000a', '1990-01-01', 'male'),
  ('b0000000-0000-4000-8000-00000000000b', '1990-01-01', 'male'),
  ('c0000000-0000-4000-8000-00000000000c', '1990-01-01', 'female'),
  ('d0000000-0000-4000-8000-00000000000d', '1990-01-01', 'male'),
  ('e0000000-0000-4000-8000-00000000000e', '2010-10-14', 'female'),
  ('f0000000-0000-4000-8000-00000000000f', '1931-01-01', null),
  ('90000000-0000-4000-8000-000000000009', '1990-01-01', 'male');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array[
  'a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000c',
  'd0000000-0000-4000-8000-00000000000d', 'e0000000-0000-4000-8000-00000000000e',
  'f0000000-0000-4000-8000-00000000000f', '90000000-0000-4000-8000-000000000009'
]::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform)
select 'b0000000-0000-4000-8000-00000000000b', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) as t;
insert into public.body_metrics (user_id, measured_on, height_cm, weight_kg, body_fat_pct) values
  ('a0000000-0000-4000-8000-00000000000a', '2026-10-01', 180, 80, null),
  -- B: Körperdaten ohne Einwilligung (nur als Eigentümer möglich) – zählen nicht.
  ('b0000000-0000-4000-8000-00000000000b', '2026-10-01', 180, 80, null),
  ('c0000000-0000-4000-8000-00000000000c', '2026-10-01', 170, 70, null),
  ('d0000000-0000-4000-8000-00000000000d', '2026-10-01', null, 80, null),
  ('e0000000-0000-4000-8000-00000000000e', '2026-10-01', 160, 50, null),
  ('f0000000-0000-4000-8000-00000000000f', '2026-10-01', 200, 300, null),
  ('90000000-0000-4000-8000-000000000009', '2026-10-01', 180, 80, null),
  ('90000000-0000-4000-8000-000000000009', '2026-07-16', null, null, 10);
insert into public.health_screening (user_id, answers, medical_notice_acknowledged_at)
values ('c0000000-0000-4000-8000-00000000000c',
  '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": true, "medication": false, "other_reason": false}',
  now());
insert into public.nutrition_prefs (user_id, diet_type, eats_pork)
select u, 'vegan', null
from unnest(array[
  'a0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-00000000000b',
  'c0000000-0000-4000-8000-00000000000c', 'd0000000-0000-4000-8000-00000000000d',
  'e0000000-0000-4000-8000-00000000000e', 'f0000000-0000-4000-8000-00000000000f',
  '90000000-0000-4000-8000-000000000009'
]::uuid[]) as u;

insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
values ('hafer', 1, 'published', 'Hafer', 'other', false, '{gluten}', '{}', '{}', false, false, 2, true, '{}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('muesli', 1, 'published', 'Müsli', '{breakfast,main}', 1, true, 'vegan', false, '{}');
insert into public.recipe_ingredients (recipe_id, position, food_id, amount, unit, optional, scales)
values ('muesli', 0, 'hafer', 60, 'g', false, true);

-- Seit H1 rechnet der Server die Nährwerte nach: Für eine frei wählbare Tagessumme gibt es je kcal-Wert ein
-- Lebensmittel mit genau diesen kcal je 100 g und ein Rezept mit 100 g davon (Faktor 1 → kcal = Wert).
create function pg_temp.recipe_for(p_kcal numeric)
returns text language plpgsql security definer set search_path = '' as $$
declare
  rid text := 'kcal-' || replace(p_kcal::text, '.', '-');
begin
  if not exists (select 1 from public.recipes where id = rid) then
    insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
      pregnancy_caution, alcohol, max_fridge_days, freezable, data)
    values (rid, 1, 'published', 'Testkost', 'other', false, '{}', '{}', '{}', false, false, 2, true,
      jsonb_build_object('units', '{}'::jsonb, 'nutrients_per_100g',
        jsonb_build_object('kcal', p_kcal, 'protein_g', 0, 'carbs_g', 0, 'fat_g', 0)));
    insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
    values (rid, 1, 'published', 'Testgericht', '{breakfast,main}', 1, true, 'vegan', false, '{}');
    insert into public.recipe_ingredients (recipe_id, position, food_id, amount, unit, optional, scales)
    values (rid, 0, rid, 100, 'g', false, true);
  end if;
  return rid;
end;
$$;

-- Eingabe wie toMealPlanPayload() mit frei wählbarer Tagessumme.
create function pg_temp.item(
  p_date text, p_kcal numeric, p_status text default 'complete', p_slot text default 'breakfast',
  p_device_kcal numeric default null
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'date', p_date, 'slot', p_slot, 'role', null, 'recipe_id', pg_temp.recipe_for(p_kcal), 'recipe_version', 1,
    'title_de', 'Testgericht', 'factor', 1, 'kcal', coalesce(p_device_kcal, p_kcal), 'protein_g', 0, 'carbs_g', 0,
    'fat_g', 0,
    'substitutions', '[]'::jsonb, 'omitted_optional', '[]'::jsonb, 'ingredient_swaps', '[]'::jsonb,
    'is_fill', false, 'prep_kind', 'fresh', 'cook_date', p_date, 'storage', null, 'meal_prep_plan_id', null,
    'day_status', p_status
  )
$$;
create function pg_temp.plan(p_items jsonb, p_week text default '2026-10-12')
returns jsonb language sql as $$
  select jsonb_build_object(
    'week_start', p_week, 'engine_version', 1, 'variant', 0, 'meal_prep_plan_id', null,
    'inputs', jsonb_build_object('diet', 'vegan', 'meals_per_day', 3, 'cooking_mode', 'daily',
      'mealprep_days', null, 'mealprep_slots', 'lunch'),
    'items', p_items
  )
$$;
create function pg_temp.list(p_week text default '2026-10-12')
returns jsonb language sql as $$
  select jsonb_build_object(
    'week_start', p_week, 'from_date', p_week, 'to_date', (p_week::date + 6)::text, 'uses_health_data', false,
    'plan_key', 'k', 'recipes', '[]'::jsonb,
    'items', jsonb_build_array(jsonb_build_object(
      'item_key', 'manual|brot', 'food_id', null, 'label_de', 'Brot', 'amount', null, 'unit', null,
      'category', 'other', 'is_pantry', false, 'is_manual', true, 'checked', false, 'substitute_for', '[]'::jsonb,
      'amount_changed', false, 'not_in_plan', false))
  )
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Grundumsatz je Tag (private.meal_plan_day_kcal_floor) = serverDayKcalFloor
-- ---------------------------------------------------------------------------------------------------------
select is(private.meal_plan_day_kcal_floor('a0000000-0000-4000-8000-00000000000a', '2026-10-14', '2026-10-14'),
  1750::numeric, 'A: Mifflin-St Jeor (männlich)');
select is(private.meal_plan_day_kcal_floor('e0000000-0000-4000-8000-00000000000e', '2026-10-14', '2026-10-14'),
  1259::numeric, 'E: 16. Geburtstag am Tag selbst');
select is(private.meal_plan_day_kcal_floor('e0000000-0000-4000-8000-00000000000e', '2026-10-13', '2026-10-14'),
  1264::numeric, 'E: am Tag davor noch 15 Jahre');
select is(private.meal_plan_day_kcal_floor('f0000000-0000-4000-8000-00000000000f', '2026-10-14', '2026-10-14'),
  3780::numeric, 'F: 95 Jahre, 300 kg, ohne Geschlecht = männlicher Offset (Grenzen)');
select is(private.meal_plan_day_kcal_floor('90000000-0000-4000-8000-000000000009', '2026-10-14', '2026-10-14'),
  1925.2::numeric, 'G: Körperfett 90 Tage alt → Katch-McArdle (höher)');
select is(private.meal_plan_day_kcal_floor('90000000-0000-4000-8000-000000000009', '2026-10-15', '2026-10-14'),
  1750::numeric, 'G: Körperfett 91 Tage alt → nur Mifflin');
select is(private.meal_plan_day_kcal_floor('c0000000-0000-4000-8000-00000000000c', '2026-10-14', '2026-10-14'),
  null, 'C: Schwangerschaft → kein Grundumsatz (no_targets)');
select is(private.meal_plan_day_kcal_floor('d0000000-0000-4000-8000-00000000000d', '2026-10-14', '2026-10-14'),
  null, 'D: ohne Größe → kein Grundumsatz');
-- Messung von morgen zählt als heute; je Feld der neueste Wert.
insert into public.body_metrics (user_id, measured_on, weight_kg)
values ('d0000000-0000-4000-8000-00000000000d', '2026-10-15', 90);
insert into public.body_metrics (user_id, measured_on, height_cm)
values ('d0000000-0000-4000-8000-00000000000d', '2026-09-01', 170);
select is(private.meal_plan_day_kcal_floor('d0000000-0000-4000-8000-00000000000d', '2026-10-14', '2026-10-14'),
  1787.5::numeric, 'D: Größe aus älterer Zeile, Gewicht von morgen (900 + 1.062,5 − 180 + 5)');
select ok(
  not has_function_privilege('authenticated', 'private.meal_plan_day_kcal_floor(uuid, date, date)', 'execute')
  and not has_function_privilege('anon', 'private.meal_plan_day_kcal_floor(uuid, date, date)', 'execute'),
  'Grundumsatz-Funktion nicht über die API aufrufbar'
);

-- ---------------------------------------------------------------------------------------------------------
-- G-W3 in save_meal_plan
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1748.9)))) $$,
  '22023', 'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.',
  'A: Tag „complete“ unter dem Grundumsatz (1.748,9 + 1 < 1.750) abgelehnt – Meldung ohne Werte'
);
select is((select count(*)::int from public.meal_plans), 0, 'A: nichts gespeichert');
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1749)))) $$,
  'A: genau auf der Grenze (1.749 + 1 = 1.750, Rundung) erlaubt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 900), pg_temp.item('2026-10-14', 849.5, p_slot => 'lunch')))) $$,
  'A: Tagessumme über mehrere Mahlzeiten (1.749,5) erlaubt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 900), pg_temp.item('2026-10-14', 840, p_slot => 'lunch')))) $$,
  '22023', null, 'A: Tagessumme über mehrere Mahlzeiten (1.740) abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-15', 500, 'below_floor')))) $$,
  'A: „Unvollständiger Vorschlag“ (below_floor) bleibt erlaubt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-15', 500, 'no_targets')))) $$,
  '22023', null, 'A: no_targets trotz Körperdaten und Einwilligung unter dem Grundumsatz abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-13', 300), pg_temp.item('2026-10-14', 1800)))) $$,
  'A: vergangener Tag wird nicht geprüft (bleibt, wie er war)'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-19', 1760)), '2026-10-19')) $$,
  'A: nächste Woche über dem Grundumsatz erlaubt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-19', 1760), pg_temp.item('2026-10-25', 1000)), '2026-10-19')) $$,
  '22023', null, 'A: ein einziger Tag darunter (Sonntag) reicht zur Ablehnung'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 300, 'no_targets')))) $$,
  'B: ohne Einwilligung keine Prüfung (Modus no_targets wie im Core)'
);
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 300, 'no_targets')))) $$,
  'C: Schwangerschaft → keine Prüfung'
);
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-00000000000e","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1257)))) $$,
  '22023', null, 'E (16 J.): 1.257 + 1 < 1.259 abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1258)))) $$,
  'E (16 J.): 1.258 erlaubt'
);
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-00000000000f","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 3700)))) $$,
  '22023', null, 'F (95 J., 300 kg): 3.700 < 3.780 abgelehnt'
);
set local request.jwt.claims = '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1900)))) $$,
  '22023', null, 'G: Körperfett (Katch 1.925,2) – 1.900 abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-15', 1900)))) $$,
  'G: am Tag danach zählt das Körperfett nicht mehr (1.750) – 1.900 erlaubt'
);
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Löschfrist (G-N7-2): beim Speichern für die Person, täglich für alle
-- ---------------------------------------------------------------------------------------------------------
insert into public.meal_plans (id, user_id, week_start, engine_version, variant, inputs, uses_health_data) values
  ('11000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '2026-09-07', 1, 0, '{}', true),
  ('11000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', '2026-09-14', 1, 0, '{}', true),
  ('11000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b', '2026-09-07', 1, 0, '{}', false),
  ('11000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-00000000000c', '2026-08-31', 1, 0, '{}', true);
insert into public.meal_plan_items (plan_id, user_id, date, slot, recipe_id, recipe_version, title_de, factor, kcal,
  protein_g, carbs_g, fat_g, is_fill, prep_kind, cook_date, day_status) values
  ('11000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '2026-09-07', 'breakfast',
   'muesli', 1, 'Müsli', 1, 400, 10, 50, 10, false, 'fresh', '2026-09-07', 'complete');
insert into public.shopping_lists (user_id, week_start, meal_plan_id, from_date, to_date, plan_key, uses_health_data)
values
  ('a0000000-0000-4000-8000-00000000000a', '2026-09-07', '11000000-0000-4000-8000-000000000001', '2026-09-07',
   '2026-09-13', 'k', true),
  ('a0000000-0000-4000-8000-00000000000a', '2026-09-14', null, '2026-09-14', '2026-09-20', 'k', true),
  ('b0000000-0000-4000-8000-00000000000b', '2026-09-07', null, '2026-09-07', '2026-09-13', 'k', false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 1800)))) $$,
  'A speichert die laufende Woche'
);
select results_eq(
  $$ select week_start from public.meal_plans order by week_start $$,
  $$ values (date '2026-09-14'), (date '2026-10-12'), (date '2026-10-19') $$,
  'A: Plan von vor 5 Wochen gelöscht, 4 Wochen zurück bleibt (RLS: nur eigene sichtbar)'
);
select results_eq(
  $$ select week_start from public.shopping_lists order by week_start $$,
  $$ values (date '2026-09-14') $$,
  'A: Einkaufsliste von vor 5 Wochen ebenfalls gelöscht'
);
reset role;
select is(
  (select count(*)::int from public.meal_plan_items where plan_id = '11000000-0000-4000-8000-000000000001'), 0,
  'Mahlzeiten des alten Plans per Kaskade gelöscht'
);
select results_eq(
  $$ select user_id::text, week_start from public.meal_plans where week_start < '2026-09-14' order by user_id $$,
  $$ values ('b0000000-0000-4000-8000-00000000000b', date '2026-09-07'),
            ('c0000000-0000-4000-8000-00000000000c', date '2026-08-31') $$,
  'Speichern löscht nur alte Wochen der speichernden Person'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}';
select lives_ok($$ select public.replace_shopping_list(pg_temp.list()) $$, 'B speichert eine Einkaufsliste');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.meal_plans where user_id = 'b0000000-0000-4000-8000-00000000000b'
               and week_start < '2026-09-14'),
            (select count(*)::int from public.shopping_lists where user_id = 'b0000000-0000-4000-8000-00000000000b'
               and week_start < '2026-09-14') $$,
  $$ values (0, 0) $$,
  'B: replace_shopping_list löscht alte Pläne und Listen der Person'
);

-- Täglicher Lauf (alle Personen).
select is(private.purge_expired_nutrition_weeks(), 1, 'Täglicher Lauf: löscht den übrigen alten Plan (C)');
select is(
  (select count(*)::int from public.meal_plans where week_start < '2026-09-14')
    + (select count(*)::int from public.shopping_lists where week_start < '2026-09-14'),
  0, 'danach keine Woche vor der Frist mehr'
);
select is(private.purge_expired_nutrition_weeks(), 0, 'zweiter Lauf ändert nichts (idempotent)');
select ok(
  (select count(*) from public.meal_plans where week_start = '2026-09-14') = 1,
  'Woche genau 4 Wochen zurück bleibt'
);
select ok(
  not has_function_privilege('authenticated', 'private.purge_expired_nutrition_weeks(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.purge_expired_nutrition_weeks(uuid)', 'execute')
  and has_function_privilege('service_role', 'private.purge_expired_nutrition_weeks(uuid)', 'execute')
  and (select prosecdef from pg_proc where oid = 'private.purge_expired_nutrition_weeks(uuid)'::regprocedure),
  'Löschlauf: security definer, nur service_role/Eigentümer'
);
-- pg_cron (Supabase): täglicher Lauf eingerichtet. Ohne die Erweiterung (lokales Postgres) gilt der Test als erfüllt –
-- dann wirkt die Löschung beim Speichern (oben geprüft).
create function pg_temp.cron_job_ok()
returns boolean language plpgsql as $$
declare
  found_job boolean;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return true;
  end if;
  execute $q$
    select exists (
      select 1 from cron.job
      where jobname = 'nutrition-weeks-retention'
        and command = 'select private.purge_expired_nutrition_weeks()'
    )
  $q$ into found_job;
  return found_job;
end;
$$;
select ok(pg_temp.cron_job_ok(), 'pg_cron: täglicher Lauf „nutrition-weeks-retention“ (falls verfügbar)');

-- ---------------------------------------------------------------------------------------------------------
-- H1 (Wächter N7 Teil 2): Nährwerte rechnet der Server (private.meal_plan_item_nutrients = scalePortion).
-- Fixture wie packages/core/src/nutrition/server-meal-values.test.ts; die Zeilen „-- core H1 …“ prüft der Core.
-- ---------------------------------------------------------------------------------------------------------
insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
values
  ('h-hafer', 1, 'published', 'Hafer', 'other', false, '{}', '{}', '{}', false, false, 2, true,
   '{"units": {"tbsp_g": 10}, "nutrients_per_100g": {"kcal": 370, "protein_g": 13.5, "carbs_g": 58.7, "fat_g": 7}}'),
  ('h-milch', 1, 'published', 'Milch', 'other', false, '{}', '{}', '{}', false, false, 2, false,
   '{"units": {"ml_to_g": 1.03}, "nutrients_per_100g": {"kcal": 64, "protein_g": 3.3, "carbs_g": 4.8, "fat_g": 3.6}, "substitutes": [{"food_id": "h-haferdrink", "for_groups": ["lactose"]}]}'),
  ('h-haferdrink', 1, 'published', 'Haferdrink', 'other', false, '{}', '{}', '{}', false, false, 2, false,
   '{"units": {"ml_to_g": 1.02}, "nutrients_per_100g": {"kcal": 46, "protein_g": 0.4, "carbs_g": 7.4, "fat_g": 1.4}}'),
  ('h-ei', 1, 'published', 'Ei', 'other', false, '{eggs}', '{egg}', '{}', false, false, 2, false,
   '{"units": {"piece_g": 58}, "nutrients_per_100g": {"kcal": 137, "protein_g": 12.6, "carbs_g": 0.6, "fat_g": 9.3}}'),
  ('h-salz', 1, 'published', 'Salz', 'other', true, '{}', '{}', '{}', false, false, 2, false,
   '{"units": {}, "nutrients_per_100g": {"kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}}'),
  ('h-nuss', 1, 'published', 'Nuss', 'other', false, '{}', '{}', '{}', false, false, 2, true,
   '{"units": {}, "nutrients_per_100g": {"kcal": 600, "protein_g": 25, "carbs_g": 10, "fat_g": 50}}'),
  ('h-haehnchen', 1, 'published', 'Hähnchen', 'other', false, '{}', '{}', '{}', false, false, 1, true,
   '{"units": {}, "nutrients_per_100g": {"kcal": 105, "protein_g": 23.5, "carbs_g": 0, "fat_g": 1.2}}'),
  ('h-tofu', 1, 'published', 'Tofu', 'other', false, '{}', '{}', '{}', false, false, 2, true,
   '{"units": {}, "nutrients_per_100g": {"kcal": 124, "protein_g": 13.4, "carbs_g": 1.4, "fat_g": 7.4}}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('h-bowl', 1, 'published', 'Bowl', '{breakfast,main}', 2, false, 'vegan', false, '{}'),
       ('h-alt', 2, 'published', 'Neue Fassung', '{breakfast,main}', 1, false, 'vegan', false, '{}');
insert into public.recipe_ingredients (recipe_id, position, food_id, amount, unit, optional, scales, role) values
  ('h-bowl', 0, 'h-hafer', 75, 'g', false, true, null),
  ('h-bowl', 1, 'h-milch', 250, 'ml', false, true, null),
  ('h-bowl', 2, 'h-ei', 1, 'piece', false, true, null),
  ('h-bowl', 3, 'h-salz', 1, 'pinch', false, false, null),
  ('h-bowl', 4, 'h-nuss', 15, 'g', true, true, null),
  ('h-bowl', 5, 'h-haehnchen', 125, 'g', false, true, 'protein'),
  ('h-bowl', 6, 'h-hafer', 1, 'tbsp', false, true, null),
  ('h-alt', 0, 'h-hafer', 100, 'g', false, true, null);
insert into public.ingredient_substitutions (id, version, status, food_id, substitute_food_id, factor, role, data)
values ('h-haehnchen-zu-h-tofu', 1, 'published', 'h-haehnchen', 'h-tofu', 1.1, 'protein', '{}'),
       ('h-haehnchen-zu-h-ei', 1, 'published', 'h-haehnchen', 'h-ei', 0.8, 'protein', '{}');

-- A isst vegetarisch (Ei erlaubt).
update public.nutrition_prefs set diet_type = 'vegetarian' where user_id = 'a0000000-0000-4000-8000-00000000000a';

create function pg_temp.server_values(p_factor numeric, p_subs jsonb, p_omitted jsonb, p_swaps jsonb)
returns numeric[] language sql security definer set search_path = '' as $$
  select array[private.js_round1(n[1]), private.js_round1(n[2]), private.js_round1(n[3]), private.js_round1(n[4])]::numeric[]
  from (select private.meal_plan_item_nutrients('h-bowl', p_factor::double precision, p_subs, p_omitted, p_swaps) as n) x
$$;
-- core H1 c1: [484.3, 40.5, 41, 16.6]
select is(pg_temp.server_values(1.35, '[]', '[]', '[]'), array[484.3, 40.5, 41, 16.6]::numeric[],
  'H1 c1: Faktor 1,35, Rundung g/ml/Stück/EL, Prise ohne Skalierung, optionale Nuss zählt nicht');
-- core H1 c2: [242.2, 15.5, 19.8, 10.6]
select is(pg_temp.server_values(0.5, '[{"index": 1, "food_id": "h-milch", "substitute_food_id": "h-haferdrink"}]',
    '[{"index": 4, "food_id": "h-nuss"}]',
    '[{"index": 5, "food_id": "h-haehnchen", "substitute_food_id": "h-tofu"}]'),
  array[242.2, 15.5, 19.8, 10.6]::numeric[], 'H1 c2: Faktor 0,5 mit Ersatzprodukt, Weglassen und Tausch (× 1,1)');
-- core H1 c3: [717.7, 41.9, 63.3, 31.4]
select is(pg_temp.server_values(2, '[]', '[]', '[{"index": 5, "food_id": "h-haehnchen", "substitute_food_id": "h-ei"}]'),
  array[717.7, 41.9, 63.3, 31.4]::numeric[], 'H1 c3: Faktor 2, Tausch zu Ei (Stück, ganze Eier)');
-- core H1 c4: [396.6, 32.9, 32.9, 14]
select is(pg_temp.server_values(1, '[]', '[]', '[]'), array[396.6, 32.9, 32.9, 14]::numeric[], 'H1 c4: Faktor 1');
-- core H1 c5: [297, 25, 22.4, 11.4]
select is(pg_temp.server_values(0.73, '[]', '[{"index": 4, "food_id": "h-nuss"}]', '[]'),
  array[297, 25, 22.4, 11.4]::numeric[], 'H1 c5: Faktor 0,73, kleine Mengen (< 20 g auf 1 g)');
select ok(
  not has_function_privilege('authenticated',
    'private.meal_plan_item_nutrients(text, double precision, jsonb, jsonb, jsonb)', 'execute')
  and not has_function_privilege('anon',
    'private.meal_plan_item_nutrients(text, double precision, jsonb, jsonb, jsonb)', 'execute'),
  'H1: Rechenfunktion nicht über die API aufrufbar'
);

create function pg_temp.bowl(p_date text, p_factor numeric, p_kcal numeric, p_protein numeric, p_carbs numeric,
  p_fat numeric, p_slot text default 'dinner', p_recipe text default 'h-bowl', p_version integer default 1)
returns jsonb language sql as $$
  select jsonb_build_object(
    'date', p_date, 'slot', p_slot, 'role', null, 'recipe_id', p_recipe, 'recipe_version', p_version,
    'title_de', 'Bowl', 'factor', p_factor, 'kcal', p_kcal, 'protein_g', p_protein, 'carbs_g', p_carbs,
    'fat_g', p_fat, 'substitutions', '[]'::jsonb, 'omitted_optional', '[]'::jsonb, 'ingredient_swaps', '[]'::jsonb,
    'is_fill', false, 'prep_kind', 'fresh', 'cook_date', p_date, 'storage', null, 'meal_prep_plan_id', null,
    'day_status', 'complete'
  )
$$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
-- Angriff (Wächter-Probe): Faktor 0,5, behauptet 5.000 kcal → abgelehnt (die Werte passen nicht zum Rezept).
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.bowl('2026-10-14', 0.5, 5000, 20, 50, 10)))) $$,
  '22023', 'Die Nährwerte im Essensplan passen nicht zu den Rezepten – bitte neu erstellen.',
  'H1: Faktor 0,5 mit behaupteten 5.000 kcal abgelehnt (Meldung ohne Werte)'
);
-- Mit den richtigen Werten (198,3 kcal bei Faktor 0,5) bleibt der Tag unter dem Grundumsatz → G-W3 greift.
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.bowl('2026-10-14', 0.5, (pg_temp.server_values(0.5, '[]', '[]', '[]'))[1],
         (pg_temp.server_values(0.5, '[]', '[]', '[]'))[2], (pg_temp.server_values(0.5, '[]', '[]', '[]'))[3],
         (pg_temp.server_values(0.5, '[]', '[]', '[]'))[4])))) $$,
  '22023', 'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.',
  'H1: ehrliche Werte → G-W3 prüft die Server-Summe'
);
-- Abweichung innerhalb des Spielraums (1 kcal, 0,1 g): gespeichert werden die Werte des Servers.
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 1500, p_slot => 'breakfast'),
       pg_temp.bowl('2026-10-14', 1.35, 485.3, 40.4, 41.1, 16.5)))) $$,
  'H1: Abweichung im Spielraum angenommen'
);
select results_eq(
  $$ select i.kcal, i.protein_g, i.carbs_g, i.fat_g from public.meal_plan_items i
     where i.recipe_id = 'h-bowl' and i.date = '2026-10-14' $$,
  $$ values (484.3::numeric, 40.5::numeric, 41::numeric, 16.6::numeric) $$,
  'H1: gespeichert (und exportiert) werden die Server-Werte, nicht die des Geräts'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 1500, p_slot => 'breakfast'),
       pg_temp.bowl('2026-10-14', 1.35, 484.3, 40.7, 41, 16.6)))) $$,
  '22023', null, 'H1: Eiweiß 0,2 g daneben → abgelehnt'
);
-- Vergangener Tag: Werte desselben Gerichts aus dem bisherigen Plan (vom Server gerechnet), nie die des Geräts.
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-13', 300), pg_temp.item('2026-10-14', 1800)))) $$,
  'H1: Plan mit vergangenem Tag (300 kcal, nachgerechnet) gespeichert'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-13', 300, p_device_kcal => 9999),
       pg_temp.item('2026-10-14', 1800)))) $$,
  'H1: vergangener Tag mit veränderter Angabe angenommen …'
);
select is(
  (select i.kcal from public.meal_plan_items i where i.date = '2026-10-13'), 300::numeric,
  '… gespeichert bleibt der Server-Wert (300)'
);
-- Vergangener Tag mit älterer Rezept-Fassung ohne passende Mahlzeit im bisherigen Plan → nicht nachrechenbar.
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.bowl('2026-10-13', 1, 370, 13.5, 58.7, 7, 'breakfast', 'h-alt', 1),
       pg_temp.item('2026-10-14', 1800)))) $$,
  '22023', 'Nährwerte des Essensplans lassen sich nicht nachrechnen – bitte neu erstellen.',
  'H1: alte Rezept-Fassung ohne Gegenstück im bisherigen Plan abgelehnt'
);
reset role;

-- Struktur: gleiche Rechte und leerer search_path wie zuvor (die Sperr-Reihenfolge Woche → Einwilligung → Plan prüft
-- packages/core/src/db-sync.test.ts per Textvergleich).

select ok(
  has_function_privilege('authenticated', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute')
  and has_function_privilege('authenticated', 'public.replace_shopping_list(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.replace_shopping_list(jsonb)', 'execute')
  and (select proconfig from pg_proc where oid = 'public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure)
    = array['search_path=""'],
  'save_meal_plan/replace_shopping_list: Rechte und leerer search_path wie zuvor'
);

select * from finish();
rollback;
