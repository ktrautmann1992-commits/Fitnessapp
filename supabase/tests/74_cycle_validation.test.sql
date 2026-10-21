-- Phase 9 · Zyklus-Modul ZY2 (docs/PLAN-PHASE-9.md 6.3a, 7.5 Nr. 8, 9, 13; B3): ungültige Eingaben scheitern mit
-- festem Code, die Meldung enthält den Eingabewert NIE; Zeitraum > 400 Tage abgelehnt; Ratenbegrenzung; CHECK
-- cycle_module_interest (nicht „männlich“).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values ('74747474-0000-4000-8000-00000000000a', 'zyklus-a74@example.test');
select public.cycle_module_admin('flag_on', 'gruender', null, 90, 'cycle_module');
select public.cycle_module_admin('grant', 'gruender', 'zyklus-a74@example.test', 30, 'cycle_module');
create temp table ctx as select (now() at time zone 'Europe/Berlin')::date as d, null::text as granted;
grant select on ctx to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"74747474-0000-4000-8000-00000000000a","role":"authenticated"}';
insert into public.profiles (birth_date, sex) values ('2010-01-01', 'unspecified');
insert into public.consents (consent_type, version, platform) values ('cycle_data', 1, 'web');
reset role;
update ctx set granted = (select granted_at::text from public.consents where consent_type = 'cycle_data');

create function pg_temp.save(p_date text, p_payload text) returns text language sql as $$
  select format('select public.save_cycle_entry(%L, %L::jsonb, %L)', p_date, p_payload, (select granted from ctx));
$$;
grant execute on function pg_temp.save(text, text) to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"74747474-0000-4000-8000-00000000000a","role":"authenticated"}';

-- Gültig (16-Jährige, „keine Angabe“): Grenzen genau.
select lives_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": 5, "sleep": 1}'),
  'Energie 5 und Schlaf 1 sind gültig');
select lives_ok(pg_temp.save(to_char((select d from ctx) - 60, 'YYYY-MM-DD'), '{"bleeding": "spotting"}'),
  'genau 60 Tage zurück ist gültig');
select lives_ok(pg_temp.save(to_char((select d from ctx) - 1, 'YYYY-MM-DD'),
  '{"symptoms": {"cramps": "strong", "low_mood": "mild"}, "energy": null}'), 'Beschwerden ohne Energie');

-- Ungültig: fester Code, ohne Eingabewert (8).
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": "drei-geheim"}'),
  '22023', 'cycle_payload_invalid', 'Text statt Zahl');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": 99999999999999999999}'),
  '22023', 'cycle_payload_invalid', 'riesige Zahl');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": 2.5}'),
  '22023', 'cycle_payload_invalid', 'Kommazahl');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": 0}'),
  '22023', 'cycle_payload_invalid', 'Energie 0');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"bleeding": "sehr-geheim"}'),
  '22023', 'cycle_payload_invalid', 'unbekannte Blutungsstufe');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"symptoms": {"geheim": "mild"}}'),
  '22023', 'cycle_payload_invalid', 'unbekannte Beschwerde');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"symptoms": {"cramps": "medium"}}'),
  '22023', 'cycle_payload_invalid', 'unbekannte Stärke');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"note": "geheim"}'),
  '22023', 'cycle_payload_invalid', 'Freitext-Feld abgelehnt');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{}'),
  '22023', 'cycle_payload_invalid', 'leerer Eintrag');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": null, "symptoms": {}}'),
  '22023', 'cycle_payload_invalid', 'nur leere Felder');
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '[1, 2]'),
  '22023', 'cycle_payload_invalid', 'kein Objekt');
select throws_ok(pg_temp.save('2026-02-30', '{"energy": 3}'),
  '22023', 'cycle_payload_invalid', 'falsches Datum');
select throws_ok(pg_temp.save('geheim', '{"energy": 3}'),
  '22023', 'cycle_payload_invalid', 'kein Datum');
select throws_ok(pg_temp.save(to_char((select d from ctx) + 1, 'YYYY-MM-DD'), '{"energy": 3}'),
  '22023', 'cycle_payload_invalid', 'Zukunft');
select throws_ok(pg_temp.save(to_char((select d from ctx) - 61, 'YYYY-MM-DD'), '{"energy": 3}'),
  '22023', 'cycle_payload_invalid', 'mehr als 60 Tage zurück');
select throws_ok(
  format($$ select public.save_cycle_settings('{"status": "geheim"}'::jsonb, %L) $$, (select granted from ctx)),
  '22023', 'cycle_payload_invalid', 'Einstellungen: unvollständig/unbekannter Status');
select throws_ok(
  format($$ select public.save_cycle_settings(jsonb_build_object(
    'status', 'natural', 'lastPeriodAtStart', null, 'enabledOn', null, 'paused', false, 'sleepTracking', false,
    'reminder', jsonb_build_object('enabled', false, 'time', '19:00'), 'noBleedingConfirmedUntil', null,
    'dismissed', '{}'::jsonb, 'contraceptive', 'geheim'), %L) $$, (select granted from ctx)),
  '22023', 'cycle_payload_invalid', 'Einstellungen: zusätzliches Feld (Art der Verhütung) abgelehnt');

-- Zeitraum > 400 Tage (9).
select throws_ok(
  format($$ select public.get_cycle_entries(%L, %L) $$,
         to_char((select d from ctx) - 401, 'YYYY-MM-DD'), to_char((select d from ctx), 'YYYY-MM-DD')),
  '22023', 'cycle_payload_invalid', 'Zeitraum über 400 Tage abgelehnt');
select is(jsonb_array_length(public.get_cycle_entries(to_char((select d from ctx) - 400, 'YYYY-MM-DD'),
                                                      to_char((select d from ctx), 'YYYY-MM-DD'))), 3,
  'genau 400 Tage: alle drei Einträge');
reset role;

-- Ratenbegrenzung (9): Zähler auf 200 → nächster Schreibvorgang scheitert.
update private.cycle_write_counts set writes = 200
where user_id = '74747474-0000-4000-8000-00000000000a' and day = (select d from ctx);
set local role authenticated;
set local request.jwt.claims = '{"sub":"74747474-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(pg_temp.save(to_char((select d from ctx), 'YYYY-MM-DD'), '{"energy": 3}'),
  '54000', 'cycle_rate_limited', 'mehr als 200 Schreibvorgänge am Tag');

-- Nicht angemeldet.
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.get_cycle_settings() $$, '42501', 'cycle_not_signed_in',
  'ohne Anmeldung kein Lesen');
reset role;

-- CHECK cycle_module_interest (13): männlich abgelehnt, divers/keine Angabe/ohne Angabe erlaubt.
select lives_ok($$ update public.profiles set sex = 'diverse', cycle_module_interest = true
                  where user_id = '74747474-0000-4000-8000-00000000000a' $$, 'divers + Interesse erlaubt');
select throws_ok($$ update public.profiles set sex = 'male', cycle_module_interest = true
                   where user_id = '74747474-0000-4000-8000-00000000000a' $$, '23514', null,
  'männlich + Interesse abgelehnt');
select lives_ok($$ update public.profiles set sex = 'male', cycle_module_interest = null
                  where user_id = '74747474-0000-4000-8000-00000000000a' $$, 'männlich ohne Interesse erlaubt');

select * from finish();
rollback;
