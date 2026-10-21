-- Phase 9 · Zyklus-Modul ZY2 (docs/PLAN-PHASE-9.md 6.2, 6.3, 7.2a, 7.3, 7.5 Nr. 1, 5, 6, 7, 14, 15):
-- Schlüssel idempotent, Rechte (auch gegen service_role), verschlüsselte Spalten ohne Klartext, Freischaltung (N3),
-- Einwilligung nötig zum Schreiben, Lesen/Löschen auch ohne, fremde Daten unsichtbar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

-- ---------------------------------------------------------------------------------------------------------
-- Schlüssel und Rechte
-- ---------------------------------------------------------------------------------------------------------
create temp table key_before as
  select decrypted_secret as k from vault.decrypted_secrets where name = 'cycle_data_key_v1';
select is((select count(*)::integer from key_before), 1, 'Schlüssel cycle_data_key_v1 liegt im Vault');
select private.ensure_cycle_key(1::smallint);
select is((select decrypted_secret from vault.decrypted_secrets where name = 'cycle_data_key_v1'),
  (select k from key_before), 'Schlüssel-Migration zweimal ausgeführt → Schlüssel unverändert (15)');
select is((select count(*)::integer from vault.decrypted_secrets where name = 'cycle_data_key_v1'), 1,
  'kein zweiter Schlüssel');
select is(length((select k from key_before)), 64, 'Schlüssel: 32 Zufallsbytes (hex)');

select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(role),
    (values ('private.cycle_entries'), ('private.cycle_settings'), ('private.cycle_write_counts')) t(tab)
  where has_table_privilege(r.role, t.tab, 'select') or has_table_privilege(r.role, t.tab, 'insert')
     or has_table_privilege(r.role, t.tab, 'update') or has_table_privilege(r.role, t.tab, 'delete')),
  'Zyklus-Tabellen: keine Rechte für anon, authenticated, service_role (6)');
select ok(not exists (
  select 1 from (values ('anon'), ('authenticated'), ('service_role')) r(role),
    (values ('private.cycle_key(smallint)'), ('private.cycle_decrypt(bytea, smallint)'),
            ('private.cycle_encrypt(jsonb, smallint)'), ('private.ensure_cycle_key(smallint)'),
            ('private.cycle_check_write(uuid, timestamptz)'), ('private.cycle_retention()'),
            ('private.cycle_module_open_for(uuid)')) f(fn)
  where has_function_privilege(r.role, f.fn, 'execute')),
  'private.cycle_* nicht ausführbar für anon, authenticated, service_role (6)');
select ok(not has_table_privilege('anon', 'vault.decrypted_secrets', 'select')
          and not has_table_privilege('authenticated', 'vault.decrypted_secrets', 'select'),
  'vault.decrypted_secrets für anon und authenticated nicht lesbar (6)');
select ok(not exists (
  select 1 from (values ('anon'), ('service_role')) r(role),
    (values ('public.save_cycle_entry(text, jsonb, text)'), ('public.get_cycle_entries(text, text)'),
            ('public.save_cycle_settings(jsonb, text)'), ('public.get_cycle_settings()'),
            ('public.delete_cycle_entry(text)'), ('public.delete_all_cycle_entries()'),
            ('public.export_my_cycle_data()'), ('public.cycle_module_access()')) f(fn)
  where has_function_privilege(r.role, f.fn, 'execute')),
  'App-Funktionen: weder anon noch service_role');
select ok(has_function_privilege('authenticated', 'public.save_cycle_entry(text, jsonb, text)', 'execute')
          and has_function_privilege('authenticated', 'public.get_cycle_entries(text, text)', 'execute'),
  'App-Funktionen: authenticated darf');
select ok(has_function_privilege('service_role', 'public.cycle_module_admin(text, text, text, integer, text)',
                                  'execute')
          and not has_function_privilege('authenticated',
                                         'public.cycle_module_admin(text, text, text, integer, text)', 'execute'),
  'cycle_module_admin nur service_role');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.proname like '%cycle%' and n.nspname in ('public', 'private')
    and (p.prosecdef is false and p.proname not in ('cycle_is_scale', 'cycle_today', 'cycle_valid_entry',
                                                    'cycle_valid_settings', 'cycle_is_date_text',
                                                    'cycle_parse_date', 'cycle_parse_timestamp',
                                                    'cycle_current_key_version')
         or not coalesce(p.proconfig @> array['search_path=""'], false))),
  'alle Zyklus-Funktionen: security definer (wo nötig) und search_path leer');

-- ---------------------------------------------------------------------------------------------------------
-- Personen: A (freigeschaltet), B (freigeschaltet), C (nicht freigeschaltet)
-- ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('72727272-0000-4000-8000-00000000000a', 'zyklus-a@example.test'),
  ('72727272-0000-4000-8000-00000000000b', 'zyklus-b@example.test'),
  ('72727272-0000-4000-8000-00000000000c', 'zyklus-c@example.test');

create function pg_temp.as_user(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to authenticated;

set local role authenticated;
select pg_temp.as_user('72727272-0000-4000-8000-00000000000a');
insert into public.profiles (birth_date, sex) values ('1995-01-01', 'female');
select pg_temp.as_user('72727272-0000-4000-8000-00000000000b');
insert into public.profiles (birth_date, sex) values ('1995-01-01', 'diverse');
select pg_temp.as_user('72727272-0000-4000-8000-00000000000c');
insert into public.profiles (birth_date, sex) values ('1995-01-01', 'female');
reset role;

-- Flag aus (Standard): niemand darf die Einwilligung erteilen.
set local role authenticated;
select pg_temp.as_user('72727272-0000-4000-8000-00000000000a');
select throws_ok($$ insert into public.consents (consent_type, version, platform) values ('cycle_data', 1, 'web') $$,
  '42501', 'cycle_module_closed', 'Flag cycle_module aus → Einwilligung nicht erteilbar (N3)');
select is(public.cycle_module_access(), '{"open": false, "warnings": true}'::jsonb,
  'cycle_module_access: zu, Warnungen an (Standard)');
reset role;

-- Flag an + Freischaltung für A und B (Workflow beta-grant).
select is(public.cycle_module_admin('flag_on', 'gruender', null, 90, 'cycle_module') ->> 'result', 'flag_on',
  'Workflow: Flag cycle_module an');
select is(public.cycle_module_admin('grant', 'gruender', 'zyklus-a@example.test', 30, 'cycle_module') ->> 'result',
  'granted', 'Workflow: A freigeschaltet');
select public.cycle_module_admin('grant', 'gruender', 'zyklus-b@example.test', 30, 'cycle_module');
select is(public.cycle_module_admin('grant', 'gruender', 'unbekannt@example.test', 30, 'cycle_module') ->> 'result',
  'not_found', 'Workflow: unbekannte E-Mail ohne Personenbezug');
select is(public.cycle_module_admin('grant', 'gruender', 'zyklus-a@example.test', 181, 'cycle_module') ->> 'result',
  'invalid_input', 'Workflow: höchstens 180 Tage');

set local role authenticated;
select pg_temp.as_user('72727272-0000-4000-8000-00000000000c');
select throws_ok($$ insert into public.consents (consent_type, version, platform) values ('cycle_data', 1, 'web') $$,
  '42501', 'cycle_module_closed', 'ohne Freischaltung (C) → Einwilligung nicht erteilbar');

-- A: ohne Einwilligung scheitert Schreiben (1).
select pg_temp.as_user('72727272-0000-4000-8000-00000000000a');
select throws_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, %L) $$,
         to_char(private_today.d, 'YYYY-MM-DD'), now()::text),
  '42501', 'cycle_consent_missing', 'Schreiben ohne Einwilligung scheitert (1)')
from (select (now() at time zone 'Europe/Berlin')::date as d) private_today;

insert into public.consents (consent_type, version, platform, granted_at)
values ('cycle_data', 1, 'web', now());
select pg_temp.as_user('72727272-0000-4000-8000-00000000000b');
insert into public.consents (consent_type, version, platform) values ('cycle_data', 1, 'ios');

-- A schreibt Eintrag und Einstellungen.
select pg_temp.as_user('72727272-0000-4000-8000-00000000000a');
create temp table today as select (now() at time zone 'Europe/Berlin')::date as d;
grant select on today to authenticated;
select lives_ok(
  format($$ select public.save_cycle_entry(%L, '{"bleeding": "heavy", "energy": 2, "symptoms": {"cramps": "strong"}}'::jsonb, %L) $$,
         (select d from today), (select granted_at from public.consents where consent_type = 'cycle_data')::text),
  'A: Tages-Check gespeichert');
select lives_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 4}'::jsonb, %L) $$,
         (select d from today), (select granted_at from public.consents where consent_type = 'cycle_data')::text),
  'A: gleicher Tag → überschreibt (je Tag ein Eintrag)');
select lives_ok(
  format($$ select public.save_cycle_settings('{"status": "natural", "lastPeriodAtStart": "over_3_months", "enabledOn": "2026-10-21", "paused": false, "sleepTracking": false, "reminder": {"enabled": false, "time": "19:00"}, "noBleedingConfirmedUntil": null, "dismissed": {"W1": "2026-10-21"}}'::jsonb, %L) $$,
         (select granted_at from public.consents where consent_type = 'cycle_data')::text),
  'A: Einstellungen gespeichert');
select is(
  (public.get_cycle_entries(to_char((select d from today) - 1, 'YYYY-MM-DD'), to_char((select d from today), 'YYYY-MM-DD')) -> 0 -> 'payload'),
  '{"energy": 4}'::jsonb, 'A liest den eigenen Eintrag entschlüsselt');
select is(public.get_cycle_settings() -> 'payload' ->> 'status', 'natural', 'A liest die eigenen Einstellungen');

-- Fremde Person liest nichts (5).
select pg_temp.as_user('72727272-0000-4000-8000-00000000000b');
select is(public.get_cycle_entries(to_char((select d from today) - 1, 'YYYY-MM-DD'), to_char((select d from today), 'YYYY-MM-DD')),
  '[]'::jsonb, 'B sieht keine Einträge von A (auch nicht mit A-Zeitraum)');
select is(public.get_cycle_settings(), null, 'B sieht keine Einstellungen von A');
select is(public.delete_cycle_entry(to_char((select d from today), 'YYYY-MM-DD')), false,
  'B kann den Eintrag von A nicht löschen');
reset role;

-- Spalte enthält keinen Klartext (7).
select ok(not exists (
  select 1 from private.cycle_entries e
  where position(convert_to('energy', 'UTF8') in e.payload_enc) > 0
     or position(convert_to('heavy', 'UTF8') in e.payload_enc) > 0),
  'cycle_entries.payload_enc enthält keinen Klartext');
select ok(not exists (
  select 1 from private.cycle_settings s
  where position(convert_to('natural', 'UTF8') in s.payload_enc) > 0
     or position(convert_to('over_3_months', 'UTF8') in s.payload_enc) > 0),
  'cycle_settings.payload_enc enthält keinen Klartext');
select is((select count(*)::integer from private.cycle_entries), 1, 'genau ein Eintrag (A, heute)');

-- Freischaltung entzogen: Lesen und Löschen gehen, Schreiben nicht (N3, 14).
select is(public.cycle_module_admin('revoke', 'gruender', 'zyklus-a@example.test', 90, 'cycle_module') ->> 'result',
  'revoked', 'Workflow: A entzogen');
set local role authenticated;
select pg_temp.as_user('72727272-0000-4000-8000-00000000000a');
select throws_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, %L) $$,
         (select d from today), now()::text),
  '42501', 'cycle_module_closed', 'ohne Freischaltung: Schreiben scheitert');
select is(jsonb_array_length(public.export_my_cycle_data() -> 'entries'), 1,
  'ohne Freischaltung: Export geht');
select is(public.delete_all_cycle_entries(), 1, 'ohne Freischaltung: Alle Einträge löschen geht');
select is(public.get_cycle_settings() -> 'payload' ->> 'status', 'natural',
  'Alle Einträge löschen lässt die Einstellungen stehen');
reset role;

select * from finish();
rollback;
