-- Gesundheits-Check: Flags berechnet die Datenbank aus den Antworten; Zeitstempel serverseitig.
-- Messdatum von Körperdaten/-umfängen höchstens 1 Tag in der Zukunft.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');
insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web');

-- Hilfstabelle mit „alles nein“ (temporär, nur in dieser Transaktion).
create temporary table no_answers as
select '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}'::jsonb as a;

-- ---------------------------------------------------------------------------------------------------------
-- Flags
-- ---------------------------------------------------------------------------------------------------------
insert into public.health_screening (id, answers) select '00000000-0000-4000-8000-000000000001'::uuid, a from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000001'),
  '{}'::text[], 'alles nein → keine Flags'
);
insert into public.health_screening (id, answers, flags)
     select '00000000-0000-4000-8000-000000000002'::uuid, a, '{medical_clearance_recommended,conservative_plan}' from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000002'),
  '{}'::text[], 'vom Client gesendete Flags werden ignoriert'
);
select throws_ok(
  $$ insert into public.health_screening (answers)
     select a || '{"dizziness": true}' from no_answers $$,
  '23514', null, 'Herz-Kreislauf ja ohne bestätigten Arzt-Hinweis: abgelehnt'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000003'::uuid, a || '{"dizziness": true}', now() from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000003'),
  '{medical_clearance_recommended,conservative_plan}'::text[], 'Schwindel → ärztliche Abklärung + vorsichtiger Plan'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000004'::uuid, a || '{"other_reason": true}', now() from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000004'),
  '{medical_clearance_recommended,conservative_plan}'::text[], 'anderer Grund → ärztliche Abklärung'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000005'::uuid, a || '{"pregnancy": true}', now() from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000005'),
  '{pregnancy,conservative_plan}'::text[], 'nur Schwangerschaft'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000006'::uuid, a || '{"bone_joint": true}', now() from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000006'),
  '{injury,conservative_plan}'::text[], 'nur Gelenke → injury'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000007'::uuid, a || '{"medication": true}', now() from no_answers;
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000007'),
  '{medication,conservative_plan}'::text[], 'nur Medikamente → medication'
);
insert into public.health_screening (id, answers, medical_notice_acknowledged_at)
     select '00000000-0000-4000-8000-000000000008'::uuid, '{"heart_condition": true, "chest_pain_exercise": true, "chest_pain_rest": true, "dizziness": true, "blood_pressure": true, "bone_joint": true, "pregnancy": true, "medication": true, "other_reason": true}', now();
select is(
  (select flags from public.health_screening where id = '00000000-0000-4000-8000-000000000008'),
  '{medical_clearance_recommended,pregnancy,injury,medication,conservative_plan}'::text[], 'alles ja → alle Flags'
);
select lives_ok(
  $$ insert into public.health_screening (answers) select a || '{"pregnancy": false}' from no_answers $$,
  'Schwangerschafts-Antwort ist optional und darf nein sein'
);
select throws_ok(
  $$ insert into public.health_screening (answers) select a - 'medication' from no_answers $$,
  '23514', null, 'unvollständige Antworten'
);
select throws_ok(
  $$ insert into public.health_screening (answers) select a || '{"smoking": false}' from no_answers $$,
  '23514', null, 'unbekannte Frage'
);
select throws_ok(
  $$ insert into public.health_screening (answers) select a || '{"medication": "ja"}' from no_answers $$,
  '23514', null, 'Antwort ist kein true/false'
);
select throws_ok(
  $$ insert into public.health_screening (answers) values ('[]') $$,
  '23514', null, 'Antworten müssen ein Objekt sein'
);

-- ---------------------------------------------------------------------------------------------------------
-- Zeitstempel
-- ---------------------------------------------------------------------------------------------------------
insert into public.health_screening (id, answers, created_at)
     select '00000000-0000-4000-8000-000000000009'::uuid, a, timestamptz '2000-01-01 00:00:00+00' from no_answers;
select is(
  (select created_at from public.health_screening where id = '00000000-0000-4000-8000-000000000009'),
  now(), 'created_at setzt die Datenbank'
);
select lives_ok(
  format(
    $$ insert into public.body_metrics (measured_on, weight_kg) values (%L, 70) $$,
    (now() at time zone 'Europe/Berlin')::date + 1
  ),
  'Körperdaten: morgen (1 Tag Toleranz) erlaubt'
);
select throws_ok(
  format(
    $$ insert into public.body_metrics (measured_on, weight_kg) values (%L, 70) $$,
    (now() at time zone 'Europe/Berlin')::date + 2
  ),
  '23514', null, 'Körperdaten: übermorgen abgelehnt'
);
select throws_ok(
  format(
    $$ update public.body_metrics set measured_on = %L $$,
    (now() at time zone 'Europe/Berlin')::date + 30
  ),
  '23514', null, 'Körperdaten: Datum nachträglich in die Zukunft abgelehnt'
);
select lives_ok(
  $$ insert into public.body_metrics (measured_on, weight_kg) values ('2020-05-01', 72) $$,
  'Körperdaten: Vergangenheit erlaubt'
);
select lives_ok(
  format(
    $$ insert into public.body_measurements (measured_on, waist_cm) values (%L, 80) $$,
    (now() at time zone 'Europe/Berlin')::date + 1
  ),
  'Umfänge: morgen erlaubt'
);
select throws_ok(
  format(
    $$ insert into public.body_measurements (measured_on, waist_cm) values (%L, 80) $$,
    (now() at time zone 'Europe/Berlin')::date + 2
  ),
  '23514', null, 'Umfänge: übermorgen abgelehnt'
);
select lives_ok(
  $$ insert into public.body_measurements (waist_cm) values (81) $$,
  'Umfänge: Standard-Datum heute'
);
select is(
  (select count(*) from public.health_screening),
  10::bigint, 'Verlauf: alle gültigen Checks gespeichert'
);
select is(
  (select count(*) from public.health_screening where cardinality(flags) > 0 and medical_notice_acknowledged_at is null),
  0::bigint, 'kein Check mit Flag ohne bestätigten Hinweis'
);

select * from finish();
rollback;
