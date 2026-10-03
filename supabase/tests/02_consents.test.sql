-- Einwilligungen: nur Einfügen + Widerruf, Gesundheitsdaten nur mit gültiger Einwilligung in der aktuellen
-- Version, Widerruf löscht alle Gesundheitsdaten.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

-- ---------------------------------------------------------------------------------------------------------
-- Ohne Einwilligung: keine Gesundheitsdaten.
-- ---------------------------------------------------------------------------------------------------------
select is(public.has_valid_consent('health_data'), false, 'ohne Einwilligung: has_valid_consent = false');
select throws_ok(
  $$ insert into public.body_metrics (height_cm, weight_kg) values (180, 80) $$,
  '42501', null, 'ohne Einwilligung: Körperdaten werden abgelehnt'
);
select throws_ok(
  $$ insert into public.health_screening (answers) values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}') $$,
  '42501', null, 'ohne Einwilligung: Gesundheits-Check wird abgelehnt'
);
select throws_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('gluten', 'intolerance') $$,
  '42501', null, 'ohne Einwilligung: Unverträglichkeit wird abgelehnt'
);
select lives_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('gluten', 'dislike') $$,
  'ohne Einwilligung: „mag nicht“ ist erlaubt (keine Gesundheitsdaten)'
);
select throws_ok(
  $$ update public.food_preferences set kind = 'intolerance' where food_group = 'gluten' $$,
  '42501', null, 'ohne Einwilligung: „mag nicht“ lässt sich nicht in Unverträglichkeit umwandeln'
);

-- Andere Einwilligungen ersetzen health_data nicht.
select lives_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('terms', 1, 'web'), ('privacy', 1, 'web') $$,
  'AGB und Datenschutz erteilen'
);
select is(public.has_valid_consent('health_data'), false, 'AGB/Datenschutz ersetzen health_data nicht');

-- ---------------------------------------------------------------------------------------------------------
-- Einfügen: nur aktuelle, veröffentlichte Version; Zeitpunkt setzt die Datenbank.
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web') $$,
  '42501', null, 'Einwilligung in eine nicht existierende Version wird abgelehnt'
);
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('cycle_data', 1, 'web') $$,
  '42501', null, 'cycle_data hat in Phase 1 noch keinen Text und ist nicht erteilbar'
);
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform, revoked_at)
     values ('health_data', 1, 'web', now()) $$,
  '23514', null, 'bereits widerrufen einfügen ist unzulässig'
);
select lives_ok(
  $$ insert into public.consents (consent_type, version, platform, granted_at)
     values ('health_data', 1, 'android', timestamptz '2000-01-01 00:00:00+00') $$,
  'health_data Version 1 erteilen (mit Versuch, rückzudatieren)'
);
select is(
  (select granted_at from public.consents where consent_type = 'health_data'),
  now(), 'granted_at setzt die Datenbank (kein Rückdatieren)'
);
select is(public.has_valid_consent('health_data'), true, 'mit Einwilligung: has_valid_consent = true');
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web') $$,
  '23505', null, 'doppelte aktive Einwilligung derselben Version wird abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Mit Einwilligung: Gesundheitsdaten speichern.
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.body_metrics (height_cm, weight_kg) values (180, 80) $$,
  'mit Einwilligung: Körperdaten gespeichert'
);
select lives_ok(
  $$ insert into public.health_screening (answers, flags, medical_notice_acknowledged_at)
     values ('{"heart_condition": true, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}', '{}', now()) $$,
  'mit Einwilligung: Gesundheits-Check mit Flags und bestätigtem Arzt-Hinweis gespeichert'
);
select lives_ok(
  $$ update public.food_preferences set kind = 'intolerance' where food_group = 'gluten' $$,
  'mit Einwilligung: Unverträglichkeit gespeichert'
);
select lives_ok(
  $$ insert into public.food_preferences (food_group, kind) values ('fish', 'like') $$,
  'Vorliebe gespeichert'
);

-- ---------------------------------------------------------------------------------------------------------
-- Ändern: nur Widerruf; alles andere ist unveränderlich.
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ update public.consents set consent_type = 'cycle_data' $$,
  '42501', null, 'consent_type ist nicht änderbar'
);
select throws_ok($$ update public.consents set version = 2 $$, '42501', null, 'version ist nicht änderbar');
select throws_ok(
  $$ update public.consents set granted_at = now() - interval '1 day' $$,
  '42501', null, 'granted_at ist nicht änderbar'
);
select throws_ok($$ update public.consents set platform = 'ios' $$, '42501', null, 'platform ist nicht änderbar');
select throws_ok($$ delete from public.consents $$, '42501', null, 'Nutzer können Einwilligungen nicht löschen');

-- Widerruf von AGB löscht keine Gesundheitsdaten.
select lives_ok(
  $$ update public.consents set revoked_at = now() where consent_type = 'terms' $$,
  'AGB widerrufen'
);
select is((select count(*) from public.body_metrics), 1::bigint, 'AGB-Widerruf lässt Körperdaten stehen');
select is_empty(
  $$ update public.consents set revoked_at = null where consent_type = 'terms' returning 1 $$,
  'ein Widerruf kann vom Nutzer nicht zurückgenommen werden'
);
select isnt(
  (select revoked_at from public.consents where consent_type = 'terms'),
  null, 'Widerruf bleibt bestehen'
);

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data → alle Gesundheitsdaten gelöscht, Rest bleibt.
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ update public.consents set revoked_at = now() where consent_type = 'health_data' $$,
  'health_data widerrufen'
);
select is(public.has_valid_consent('health_data'), false, 'nach Widerruf: has_valid_consent = false');
select is_empty($$ select 1 from public.body_metrics $$, 'nach Widerruf: Körperdaten gelöscht');
select is_empty($$ select 1 from public.health_screening $$, 'nach Widerruf: Gesundheits-Checks gelöscht');
select is_empty(
  $$ select 1 from public.food_preferences where kind = 'intolerance' $$,
  'nach Widerruf: Unverträglichkeiten gelöscht'
);
select is(
  (select count(*) from public.food_preferences where kind = 'like'),
  1::bigint, 'nach Widerruf: Vorlieben bleiben'
);
select is((select count(*) from public.consents), 3::bigint, 'Einwilligungs-Nachweise bleiben erhalten');
select throws_ok(
  $$ insert into public.body_metrics (weight_kg) values (80) $$,
  '42501', null, 'nach Widerruf: neue Körperdaten werden abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Neue Textversion → alte Einwilligung reicht nicht mehr (erneute Zustimmung nötig).
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web') $$,
  'health_data Version 1 erneut erteilen'
);
reset role;
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at)
values ('health_data', 2, 'Einwilligung Gesundheitsdaten', 'ENTWURF Version 2', null);
set local role authenticated;
select is(public.current_consent_version('health_data'), 1, 'unveröffentlichte Version 2 zählt noch nicht');
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web') $$,
  '42501', null, 'Einwilligung in eine unveröffentlichte Version wird abgelehnt'
);
reset role;
update public.consent_documents set published_at = now() where consent_type = 'health_data' and version = 2;
set local role authenticated;
select is(public.has_valid_consent('health_data'), false, 'nach Veröffentlichung von Version 2 reicht Version 1 nicht');
select throws_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 1, 'web') $$,
  '42501', null, 'Einwilligung in eine veraltete Version wird abgelehnt'
);
select lives_ok(
  $$ insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web') $$,
  'health_data Version 2 erteilen'
);
select is(public.has_valid_consent('health_data'), true, 'mit Version 2: has_valid_consent = true');

-- ---------------------------------------------------------------------------------------------------------
-- Auch der Datenbank-Admin (ohne RLS) kann Nachweise nicht verfälschen.
-- ---------------------------------------------------------------------------------------------------------
reset role;
select throws_ok(
  $$ update public.consents set version = 1 where consent_type = 'health_data' and version = 2 $$,
  '23514', null, 'Admin: Version eines Nachweises nicht änderbar'
);

select * from finish();
rollback;
