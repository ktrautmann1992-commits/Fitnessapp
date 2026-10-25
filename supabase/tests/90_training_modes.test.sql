-- Trainings-Modi (docs/PLAN-TRAINING-MODI.md 7): pain_episodes (Gesundheitsdaten) und travel_modes.
-- Einwilligung, RLS (Nutzer B sieht nichts von A), Wertebereiche, Unveränderlichkeit, Überschneidung, Widerruf,
-- Export und Konto-Löschung.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- Heute in Europe/Berlin (wie private.berlin_today()).
create temporary table t_today as select (now() at time zone 'Europe/Berlin')::date as d;
grant select on t_today to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

-- ---------------------------------------------------------------------------------------------------------
-- pain_episodes: Einwilligung
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 3, d from t_today $$,
  '42501', null, 'ohne Einwilligung health_data: Schmerz-Eintrag abgelehnt'
);
select lives_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d, d + 6, 'bodyweight' from t_today $$,
  'Reise-Modus braucht keine Gesundheits-Einwilligung'
);

insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');

-- Fassung 1 (heute veröffentlicht) nennt den Schmerz-Modus nicht → auch mit gültiger Einwilligung abgelehnt.
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 3, d from t_today $$,
  '42501', null, 'nur Fassung 1 veröffentlicht: Schmerz-Eintrag abgelehnt (Fassung ≥ 2 nötig)'
);

-- Fassung 2 veröffentlichen (nur in diesem Test, rollback) und ihr zustimmen.
reset role;
update public.consent_documents set published_at = now()
where consent_type = 'health_data' and version = 2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(
  (select body_de like '%Schmerz-/Verletzungsmodus: Körperregion%' from public.consent_documents
   where consent_type = 'health_data' and version = 2),
  'Fassung 2 nennt den Schmerz-/Verletzungsmodus'
);
update public.consents set revoked_at = now() where consent_type = 'health_data';
insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web');

-- ---------------------------------------------------------------------------------------------------------
-- pain_episodes: Werte
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'moderate', 7, d from t_today $$,
  'Knie mittel 7 Tage ab heute: erlaubt'
);
select lives_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'neck', 'severe', 14, d - 1 from t_today $$,
  'Beginn gestern (Zeitzone): erlaubt'
);
select lives_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'wrist', 'mild', 3, d + 1 from t_today $$,
  'Beginn morgen (Zeitzone): erlaubt'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 3, d - 2 from t_today $$,
  '23514', 'pain_start_invalid', 'Beginn vorgestern: abgelehnt'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 3, d + 2 from t_today $$,
  '23514', 'pain_start_invalid', 'Beginn übermorgen: abgelehnt'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 5, d from t_today $$,
  '23514', null, 'Dauer 5 Tage: nicht wählbar'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'mild', 21, d from t_today $$,
  '23514', null, 'Dauer 21 Tage: nicht wählbar'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'zeh', 'mild', 3, d from t_today $$,
  '22P02', null, 'unbekannte Region: abgelehnt'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on)
     select 'knee', 'unerträglich', 3, d from t_today $$,
  '22P02', null, 'unbekannte Stärke: abgelehnt'
);
select throws_ok(
  $$ insert into public.pain_episodes (region, intensity, duration_days, started_on, ended_early_on)
     select 'hip', 'mild', 3, d, d - 1 from t_today $$,
  '23514', null, 'Ende vor dem Beginn: abgelehnt'
);

-- Ändern: nur vorzeitig beenden
select lives_ok(
  $$ update public.pain_episodes set ended_early_on = (select d from t_today) where region = 'knee' $$,
  'vorzeitig beenden: erlaubt'
);
select throws_ok(
  $$ update public.pain_episodes set ended_early_on = null where region = 'knee' $$,
  '23514', 'pain_episode_already_ended', 'Ende zurücknehmen: abgelehnt'
);
select throws_ok(
  $$ update public.pain_episodes set intensity = 'mild' where region = 'neck' $$,
  '23514', 'pain_episode_immutable', 'Stärke nachträglich ändern: abgelehnt'
);
select throws_ok(
  $$ update public.pain_episodes set duration_days = 3 where region = 'neck' $$,
  '23514', 'pain_episode_immutable', 'Dauer nachträglich ändern: abgelehnt'
);
select throws_ok(
  $$ update public.pain_episodes set ended_early_on = (select d + 5 from t_today) where region = 'neck' $$,
  '23514', 'pain_end_invalid', 'Ende weit in der Zukunft: abgelehnt'
);
select is((select count(*)::int from public.pain_episodes), 3, 'A hat 3 Schmerz-Einträge');

-- ---------------------------------------------------------------------------------------------------------
-- travel_modes: Werte, Überschneidung, nur vorziehen
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 3, d + 10, 'dumbbells' from t_today $$,
  '23514', 'travel_overlap', 'Überschneidung mit bestehender Reise: abgelehnt'
);
select lives_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment, max_minutes)
     select d + 10, d + 51, 'suspension_trainer', 30 from t_today $$,
  '42 Tage mit Schlingentrainer und 30 min: erlaubt'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 60, d + 102, 'band' from t_today $$,
  '23514', null, '43 Tage: abgelehnt'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 120, d + 119, 'band' from t_today $$,
  '23514', null, 'Ende vor Beginn: abgelehnt'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d - 2, d - 1, 'band' from t_today $$,
  '23514', 'travel_start_invalid', 'Beginn in der Vergangenheit: abgelehnt'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 366, d + 370, 'band' from t_today $$,
  '23514', 'travel_start_invalid', 'Beginn mehr als 365 Tage voraus: abgelehnt'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment, max_minutes) select d + 200, d + 201, 'band', 25 from t_today $$,
  '23514', null, '25 Minuten: nicht wählbar'
);
select throws_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 200, d + 201, 'TRX' from t_today $$,
  '22P02', null, 'unbekanntes Gerät: abgelehnt'
);
select lives_ok(
  $$ update public.travel_modes set ends_on = starts_on + 2 where equipment = 'bodyweight' $$,
  'Ende vorziehen: erlaubt'
);
select throws_ok(
  $$ update public.travel_modes set ends_on = starts_on + 9 where equipment = 'bodyweight' $$,
  '23514', 'travel_mode_immutable', 'Ende verlängern: abgelehnt'
);
select throws_ok(
  $$ update public.travel_modes set equipment = 'hotel_gym' where equipment = 'bodyweight' $$,
  '23514', 'travel_mode_immutable', 'Geräte nachträglich ändern: abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Export
-- ---------------------------------------------------------------------------------------------------------
select is(
  jsonb_array_length(public.export_my_data() -> 'data' -> 'pain_episodes'), 3, 'Export enthält die Schmerz-Einträge'
);
select is(
  jsonb_array_length(public.export_my_data() -> 'data' -> 'travel_modes'), 2, 'Export enthält die Reise-Zeiträume'
);

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer B: kein Zugriff auf A
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1985-05-05');
select is((select count(*)::int from public.pain_episodes), 0, 'B sieht keine Schmerz-Einträge von A');
select is((select count(*)::int from public.travel_modes), 0, 'B sieht keine Reise-Zeiträume von A');
update public.pain_episodes set ended_early_on = (select d from t_today);
delete from public.travel_modes;
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'pain_episodes'), 0, 'Export von B ohne Einträge von A');
select throws_ok(
  $$ insert into public.pain_episodes (user_id, region, intensity, duration_days, started_on)
     select '11111111-1111-4111-8111-111111111111', 'knee', 'mild', 3, d from t_today $$,
  '42501', null, 'B kann nicht für A schreiben'
);
-- B kann ohne eigene Einwilligung nicht schreiben, auch nicht mit Überschneidung zu A (eigene Zeiträume sind getrennt).
select lives_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d, d + 6, 'hotel_gym' from t_today $$,
  'B: eigener Reise-Zeitraum, unabhängig von A'
);

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.pain_episodes where ended_early_on is null), 2, 'Änderung von B wirkte nicht bei A');
select is((select count(*)::int from public.travel_modes), 2, 'Löschen von B wirkte nicht bei A');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data → Schmerz-Einträge weg, Reise-Zeiträume bleiben (kein Gesundheitsdatum)
-- ---------------------------------------------------------------------------------------------------------
update public.consents set revoked_at = now() where consent_type = 'health_data';
select is((select count(*)::int from public.pain_episodes), 0, 'Widerruf löscht alle Schmerz-Einträge');
select is((select count(*)::int from public.travel_modes), 2, 'Widerruf lässt Reise-Zeiträume stehen');

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen nach 365 Tagen und Konto löschen
-- ---------------------------------------------------------------------------------------------------------
reset role;
alter table public.pain_episodes disable trigger pain_episodes_guard;
insert into public.pain_episodes (user_id, region, intensity, duration_days, started_on, created_at)
  select '22222222-2222-4222-8222-222222222222', 'hip', 'mild', 3, d, now() from t_today;
insert into public.pain_episodes (user_id, region, intensity, duration_days, started_on)
  select '22222222-2222-4222-8222-222222222222', 'hip', 'mild', 3, d - 400 from t_today;
alter table public.pain_episodes enable trigger pain_episodes_guard;
select is(private.cleanup_pain_episodes(), 1, 'Aufräumen löscht nur Einträge älter als 365 Tage');

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is(
  (select count(*)::int from public.pain_episodes where user_id = '22222222-2222-4222-8222-222222222222')
  + (select count(*)::int from public.travel_modes where user_id = '22222222-2222-4222-8222-222222222222'),
  0, 'Konto löschen entfernt Schmerz-Einträge und Reise-Zeiträume'
);

select * from finish();
rollback;
