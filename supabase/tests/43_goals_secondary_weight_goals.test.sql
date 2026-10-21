-- Ziele · Etappe Z3 (docs/PLAN-ZIELE.md 5.1/5.2): Nebenziel in goals (Paar-CHECK, Disziplin-CHECK), Onboarding-Schritt
-- weight_goal und die Tabelle weight_goals (Art. 9): RLS fremder Nutzer, nur mit Einwilligung, nur mit Abnehmziel
-- (Wächter S13), CHECKs (Wächter Z2 K-5), Verlängern nach Ablauf (S15), Lösch-Trigger bei goals-Update/-Delete,
-- Widerruf löscht, Export enthält beides.
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- ---------------------------------------------------------------------------------------------------------
-- 1. Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select has_column('public', 'goals', 'secondary_goal_type', 'goals.secondary_goal_type vorhanden');
select col_type_is('public', 'goals', 'secondary_goal_type', 'goal_type', 'Nebenziel ist ein goal_type');
select col_is_null('public', 'goals', 'secondary_goal_type', 'Nebenziel optional (null = kein Nebenziel)');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.weight_goals'::regclass),
  'weight_goals: RLS an'
);
select is(
  obj_description('public.weight_goals'::regclass, 'pg_class') like 'SENSIBEL (Art. 9%', true,
  'weight_goals: Kommentar „SENSIBEL (Art. 9“ (SENSIBEL-Test in db-sync.test.ts)'
);
select ok(
  not has_table_privilege('anon', 'public.weight_goals', 'select')
  and not has_table_privilege('anon', 'public.weight_goals', 'insert')
  and has_table_privilege('authenticated', 'public.weight_goals', 'insert')
  and has_table_privilege('service_role', 'public.weight_goals', 'delete'),
  'weight_goals: keine Rechte für anon, Tabellenrechte für authenticated/service_role'
);
select hasnt_column('public', 'weight_goals', 'start_weight_kg', 'kein Startgewicht (Wächter K9)');
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.goals'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%discipline IS NULL%'),
  1, 'genau ein Disziplin-CHECK (der alte unbenannte ist ersetzt)'
);

-- ---------------------------------------------------------------------------------------------------------
-- 2. goals: Nebenziel und Disziplin (Nutzer A)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

select lives_ok(
  $$ insert into public.goals (goal_type) values ('fat_loss') $$,
  'Ziel ohne Nebenziel (wie bisher)'
);
select lives_ok(
  $$ update public.goals set secondary_goal_type = 'muscle_gain' $$, 'erlaubtes Paar Abnehmen → Muskelaufbau'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'general_fitness' $$,
  '23514', null, 'Fitness als Nebenziel verboten'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'fat_loss' $$, '23514', null, 'dasselbe Ziel doppelt verboten'
);
select throws_ok(
  $$ update public.goals set goal_type = 'definition', secondary_goal_type = 'fat_loss' $$,
  '23514', null, 'Definition + Abnehmen verboten (Nebenziel neu gesetzt; unverändert mitgeführt räumt Test 46 auf)'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'muscle_gain', discipline = '5k' $$,
  '23514', null, 'Disziplin ohne Ausdauer-Ziel verboten'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = null, discipline = '5k' $$,
  '23514', null, 'Disziplin ohne Nebenziel und ohne Hauptziel Ausdauer verboten (kein NULL-Schlupfloch)'
);
select lives_ok(
  $$ update public.goals set secondary_goal_type = 'endurance', discipline = '5k' $$,
  'Disziplin bei Ausdauer als Nebenziel erlaubt'
);
select lives_ok(
  $$ update public.goals set goal_type = 'endurance', secondary_goal_type = 'fat_loss', discipline = '10k' $$,
  'Disziplin bei Ausdauer als Hauptziel (mit Nebenziel Abnehmen) erlaubt'
);
select is(
  (select (goal_type, secondary_goal_type, discipline)::text from public.goals),
  '(endurance,fat_loss,10k)', 'gespeichert: Ausdauer → Abnehmen, 10 km'
);

-- Onboarding-Schritt weight_goal (= ONBOARDING_STEPS)
select lives_ok(
  $$ update public.profiles set onboarding_step = 'weight_goal' $$, 'Schritt weight_goal ist erlaubt'
);
select throws_ok(
  $$ update public.profiles set onboarding_step = 'wunschgewicht' $$, '23514', null, 'unbekannter Schritt abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- 3. weight_goals: Einwilligung, Abnehmziel, CHECKs
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  '42501', null, 'ohne Einwilligung: Wunschgewicht abgelehnt'
);
insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');

update public.goals set goal_type = 'muscle_gain', secondary_goal_type = 'endurance', discipline = null;
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  '23514', 'Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.',
  'ohne Abnehmziel: Wunschgewicht abgelehnt (Wächter S13)'
);
update public.goals set secondary_goal_type = 'fat_loss';
select lives_ok(
  $$ insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  'Abnehmen als Nebenziel: Wunschgewicht erlaubt'
);
select is((select user_id::text from public.weight_goals), '11111111-1111-4111-8111-111111111111', 'user_id = auth.uid()');

-- CHECKs = weightGoalSchema
select throws_ok($$ update public.weight_goals set target_weight_kg = 29.9 $$, '23514', null, 'Zielgewicht 29,9 kg');
select throws_ok($$ update public.weight_goals set target_weight_kg = 300.1 $$, '23514', null, 'Zielgewicht 300,1 kg');
select lives_ok($$ update public.weight_goals set target_weight_kg = 30 $$, 'Zielgewicht 30 kg');
select lives_ok($$ update public.weight_goals set target_weight_kg = 300 $$, 'Zielgewicht 300 kg');
select is((select target_weight_kg from public.weight_goals), 300.0::numeric(4, 1), 'numeric(4,1)');
select throws_ok(
  $$ update public.weight_goals set target_date = start_date + 27 $$, '23514', null, 'Zeitraum 27 Tage'
);
select lives_ok($$ update public.weight_goals set target_date = start_date + 28 $$, 'Zeitraum 28 Tage (4 Wochen)');
select lives_ok($$ update public.weight_goals set target_date = start_date + 728 $$, 'Zeitraum 728 Tage (104 Wochen)');
select throws_ok(
  $$ update public.weight_goals set target_date = start_date + 729 $$, '23514', null, 'Zeitraum 729 Tage'
);
select throws_ok(
  $$ update public.weight_goals set amount_mode = 'kg' $$, '23514', null, 'unbekannter Mengen-Modus'
);
select throws_ok(
  $$ update public.weight_goals set time_mode = 'monate' $$, '23514', null, 'unbekannter Zeit-Modus'
);
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  '23505', null, 'höchstens ein Wunschgewicht je Nutzer'
);

-- Verlängern nach Ablauf (Wächter S15): jedes Speichern setzt start_date = heute neu → CHECK hält.
select throws_ok(
  $$ update public.weight_goals set start_date = '2025-12-31', target_date = '2026-02-01' $$,
  '23514', null, 'start_date vor 2026-01-01 abgelehnt (= WEIGHT_GOAL_START_DATE_MIN, Wächter Z3 N1)'
);
update public.weight_goals set start_date = '2026-01-01', target_date = '2026-02-01';
select throws_ok(
  $$ update public.weight_goals set target_date = '2028-01-15' $$,
  '23514', null, 'nur das Datum verlängern ohne neuen Start (> 728 Tage) scheitert'
);
select lives_ok(
  $$ update public.weight_goals set start_date = '2026-10-17', target_date = '2026-12-01' $$,
  'Verlängern mit neuem start_date gelingt (S15)'
);

-- ---------------------------------------------------------------------------------------------------------
-- 4. Fremder Nutzer (B) sieht und ändert nichts
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');
insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');
select is_empty($$ select 1 from public.weight_goals $$, 'B sieht das Wunschgewicht von A nicht');
select is_empty(
  $$ update public.weight_goals set target_weight_kg = 70 returning 1 $$, 'B ändert das Wunschgewicht von A nicht'
);
select is_empty($$ delete from public.weight_goals returning 1 $$, 'B löscht das Wunschgewicht von A nicht');
select throws_ok(
  $$ insert into public.weight_goals (user_id, target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values ('11111111-1111-4111-8111-111111111111', 80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  '42501', null, 'B kann kein Wunschgewicht für A anlegen (nur als der Nutzer selbst)'
);
-- B hat kein Ziel → auch für sich selbst kein Wunschgewicht
select throws_ok(
  $$ insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks') $$,
  '23514', null, 'ohne goals-Zeile kein Wunschgewicht'
);
insert into public.goals (goal_type) values ('fat_loss');
insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
values (70, '2026-10-17', '2027-01-09', 'target_weight', 'date');

-- ---------------------------------------------------------------------------------------------------------
-- 5. Datensparsamkeit (S13): goals-Update ohne Abnehmen bzw. goals-Delete löscht das Wunschgewicht
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
update public.goals set secondary_goal_type = 'fat_loss', target_date = '2027-05-01';
select isnt_empty($$ select 1 from public.weight_goals $$, 'Ziel geändert, Abnehmen bleibt: Wunschgewicht bleibt');
update public.goals set goal_type = 'fat_loss', secondary_goal_type = null;
select isnt_empty($$ select 1 from public.weight_goals $$, 'Abnehmen wird Hauptziel: Wunschgewicht bleibt');
update public.goals set secondary_goal_type = 'endurance';
select isnt_empty($$ select 1 from public.weight_goals $$, 'Nebenziel Ausdauer dazu: Wunschgewicht bleibt');
update public.goals set goal_type = 'muscle_gain', secondary_goal_type = 'endurance';
select is_empty($$ select 1 from public.weight_goals $$, 'Abnehmen weder Haupt- noch Nebenziel: Wunschgewicht gelöscht');
reset role;
select is(
  (select count(*)::int from public.weight_goals where user_id = '22222222-2222-4222-8222-222222222222'),
  1, 'das Wunschgewicht von B bleibt unberührt'
);
set local role authenticated;
update public.goals set goal_type = 'fat_loss', secondary_goal_type = null;
insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks');
delete from public.goals;
select is_empty($$ select 1 from public.weight_goals $$, 'goals-Zeile gelöscht: Wunschgewicht gelöscht');

-- ---------------------------------------------------------------------------------------------------------
-- 5b. Einwilligung gesperrt, dann geprüft (Wächter Z3 M1): Die Trigger-Funktion sperrt die eigene gültige
-- Einwilligung FOR SHARE und prüft danach erneut – ein gleichzeitiger Widerruf wartet auf das Speichern und löscht
-- danach (gleichzeitige Sitzungen kann pgTAP nicht nachstellen; geprüft werden Aufbau und Reihenfolge).
-- ---------------------------------------------------------------------------------------------------------
reset role;
select ok(
  (select prosecdef from pg_proc where oid = 'private.weight_goals_require_fat_loss()'::regprocedure),
  'Trigger-Funktion ist security definer (Sperre auf consents ohne eigenes Schreibrecht)'
);
select ok(
  (select position('for share' in prosrc) > 0
      and position('for share' in prosrc) < position('has_valid_consent' in prosrc)
      and position('has_valid_consent' in prosrc) < position('public.goals' in prosrc)
   from pg_proc where oid = 'private.weight_goals_require_fat_loss()'::regprocedure),
  'Reihenfolge: Einwilligung sperren → erneut prüfen → Abnehmziel prüfen'
);
select ok(
  not has_function_privilege('authenticated', 'private.weight_goals_require_fat_loss()', 'execute'),
  'Trigger-Funktion nicht direkt aufrufbar'
);
set local role service_role;
select throws_ok(
  $$ insert into public.weight_goals (user_id, target_weight_kg, start_date, target_date, amount_mode, time_mode)
     values ('22222222-2222-4222-8222-222222222222', 80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks')
     on conflict (user_id) do update set target_weight_kg = excluded.target_weight_kg $$,
  '42501', null, 'auch service_role schreibt kein Wunschgewicht ohne Login des Nutzers'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------------------------------------
-- 6. Export und Widerruf
-- ---------------------------------------------------------------------------------------------------------
insert into public.goals (goal_type, secondary_goal_type) values ('fat_loss', 'muscle_gain');
insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
values (80, '2026-10-17', '2027-01-09', 'kg_to_lose', 'weeks');
create temp table export_a as select public.export_my_data() as e;
select is(
  jsonb_array_length((select e -> 'data' -> 'weight_goals' from export_a)), 1, 'Export: eigenes Wunschgewicht'
);
select is(
  (select e -> 'data' -> 'weight_goals' -> 0 ->> 'target_weight_kg' from export_a), '80.0', 'Export: Zielgewicht'
);
select is(
  (select e -> 'data' -> 'goals' -> 0 ->> 'secondary_goal_type' from export_a), 'muscle_gain',
  'Export: Nebenziel in goals'
);
select ok(
  (select array_agg(k) from jsonb_object_keys((select e -> 'data' from export_a)) k) @> array[
    'profiles', 'consents', 'body_metrics', 'body_measurements', 'measurement_reminders', 'health_screening',
    'goals', 'user_equipment', 'training_slots', 'nutrition_prefs', 'food_preferences', 'admin_users', 'user_plans',
    'planned_sessions', 'planned_exercises', 'session_logs', 'exercise_logs', 'set_logs', 'cardio_logs',
    'exercise_start_weights', 'meal_plans', 'meal_plan_items', 'shopping_lists', 'shopping_list_items',
    'recipe_ratings', 'food_dislikes', 'food_log_entries', 'food_log_favorites', 'custom_meals', 'custom_meal_items',
    'competitions', 'ai_usage', 'beta_entitlements', 'admin_actions', 'tracked_routes', 'weight_goals'],
  'Export: alle bisherigen Bereiche plus weight_goals'
);

-- Neue Textversion → alte Einwilligung reicht nicht: Ändern abgelehnt, Löschen erlaubt (Recht auf Löschung).
reset role;
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at)
values ('health_data', 2, 'Einwilligung Gesundheitsdaten', 'Version 2', now())
-- SU3: Fassung 2 liegt als unveröffentlichter Entwurf vor (20261021120200) – hier nur veröffentlichen.
on conflict (consent_type, version) do update set published_at = excluded.published_at;
set local role authenticated;
select throws_ok(
  $$ update public.weight_goals set target_weight_kg = 79 $$,
  '42501', null, 'veraltete Einwilligung: Ändern abgelehnt'
);
insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web');

update public.consents set revoked_at = now() where consent_type = 'health_data' and revoked_at is null;
select is_empty($$ select 1 from public.weight_goals $$, 'Widerruf health_data löscht das Wunschgewicht');
select isnt_empty($$ select 1 from public.goals $$, 'Widerruf: goals (kein Gesundheitsdatum) bleibt');

select * from finish();
rollback;
