-- Phase 9 · Zyklus-Modul ZY2 (docs/PLAN-PHASE-9.md 7.5 Nr. 1–4, 10, 14; S5): Widerruf löscht alles (beide Tabellen),
-- veraltete Einwilligung (Warteschlange) abgelehnt, Lesen/Export/Löschen danach erlaubt, Konto löschen per Cascade,
-- Aufbewahrung 24 Monate.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('73737373-0000-4000-8000-00000000000a', 'zyklus-a73@example.test'),
  ('73737373-0000-4000-8000-00000000000b', 'zyklus-b73@example.test');
select public.cycle_module_admin('flag_on', 'gruender', null, 90, 'cycle_module');
select public.cycle_module_admin('grant', 'gruender', 'zyklus-a73@example.test', 30, 'cycle_module');
select public.cycle_module_admin('grant', 'gruender', 'zyklus-b73@example.test', 30, 'cycle_module');

create temp table today as select (now() at time zone 'Europe/Berlin')::date as d;
grant select on today to authenticated;

create function pg_temp.fill(p_user text, p_granted timestamptz) returns void language plpgsql as $$
declare
  granted text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  insert into public.profiles (birth_date, sex) values ('1990-01-01', 'female');
  insert into public.consents (consent_type, version, platform, granted_at) values ('cycle_data', 1, 'web', p_granted);
  select c.granted_at::text into granted from public.consents c where c.consent_type = 'cycle_data';
  perform public.save_cycle_entry(to_char((select d from today), 'YYYY-MM-DD'), '{"energy": 2}'::jsonb, granted);
  perform public.save_cycle_entry(to_char((select d from today) - 1, 'YYYY-MM-DD'), '{"bleeding": "medium"}'::jsonb,
                                  granted);
  perform public.save_cycle_settings(jsonb_build_object(
    'status', 'natural', 'lastPeriodAtStart', null, 'enabledOn', null, 'paused', false, 'sleepTracking', false,
    'reminder', jsonb_build_object('enabled', false, 'time', '19:00'), 'noBleedingConfirmedUntil', null,
    'dismissed', '{}'::jsonb), granted);
end;
$$;
grant execute on function pg_temp.fill(text, timestamptz) to authenticated;
create function pg_temp.as_user(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to authenticated;

set local role authenticated;
select pg_temp.fill('73737373-0000-4000-8000-00000000000a', now());
select pg_temp.fill('73737373-0000-4000-8000-00000000000b', now());
reset role;
select is((select count(*)::integer from private.cycle_entries), 4, 'vorher: 4 Einträge');
select is((select count(*)::integer from private.cycle_settings), 2, 'vorher: 2 Einstellungen');

-- Export vor dem Widerruf (A): Einstellungen + Einträge, ohne key_version.
set local role authenticated;
select pg_temp.as_user('73737373-0000-4000-8000-00000000000a');
select is(jsonb_array_length(public.export_my_cycle_data() -> 'entries'), 2, 'Export: 2 Einträge (A)');
select ok(public.export_my_cycle_data()::text not like '%key_version%', 'Export ohne key_version');
select is(public.export_my_cycle_data() -> 'settings' -> 'payload' ->> 'status', 'natural', 'Export: Einstellungen');

-- Widerruf (A) → null Zeilen in beiden Tabellen (2), B unberührt.
update public.consents set revoked_at = now() where consent_type = 'cycle_data' and revoked_at is null;
reset role;
select is((select count(*)::integer from private.cycle_entries
           where user_id = '73737373-0000-4000-8000-00000000000a'), 0, 'nach Widerruf: keine Einträge (A)');
select is((select count(*)::integer from private.cycle_settings
           where user_id = '73737373-0000-4000-8000-00000000000a'), 0, 'nach Widerruf: keine Einstellungen (A)');
select is((select count(*)::integer from private.cycle_entries), 2, 'B unberührt');

set local role authenticated;
select pg_temp.as_user('73737373-0000-4000-8000-00000000000a');
select is(public.export_my_cycle_data(), '{"settings": null, "entries": []}'::jsonb,
  'Export nach Widerruf ohne Zyklusdaten');
-- Nach Widerruf: Schreiben mit der alten Einwilligung scheitert.
select throws_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, %L) $$, (select d from today), now()::text),
  '42501', 'cycle_consent_missing', 'nach Widerruf: Schreiben scheitert');

-- Erneute Einwilligung: ein Eintrag aus der Warteschlange mit dem ALTEN Zeitpunkt wird abgelehnt (S5).
insert into public.consents (consent_type, version, platform, granted_at)
values ('cycle_data', 1, 'web', now() + interval '1 second');
select throws_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, %L) $$,
         (select d from today), (now() - interval '1 hour')::text),
  '42501', 'cycle_consent_outdated', 'Eintrag mit Zeitpunkt vor der aktuellen Einwilligung scheitert (1, S5)');
select throws_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, 'kein-datum') $$, (select d from today)),
  '42501', 'cycle_consent_outdated', 'kaputter Zeitpunkt → veraltet, ohne Wert in der Meldung');
select lives_ok(
  format($$ select public.save_cycle_entry(%L, '{"energy": 3}'::jsonb, %L) $$,
         (select d from today), (now() + interval '1 second')::text),
  'mit aktuellem Zeitpunkt klappt es');
reset role;

-- Gleichzeitiger Widerruf: Schreiben sperrt die Einwilligung FOR SHARE (3) – der Widerruf wartet und löscht danach.
select ok(pg_get_functiondef('private.cycle_check_write(uuid, timestamptz)'::regprocedure) ~* 'for share',
  'cycle_check_write sperrt die Einwilligung FOR SHARE');

-- Konto löschen per Cascade (4).
delete from auth.users where id = '73737373-0000-4000-8000-00000000000b';
select is((select count(*)::integer from private.cycle_entries
           where user_id = '73737373-0000-4000-8000-00000000000b'), 0, 'Konto gelöscht → Einträge weg (Cascade)');

-- Aufbewahrung 24 Monate (10): Rand ± 1 Tag (Schaltjahr und Monatsende über interval '24 months').
insert into private.cycle_entries (user_id, entry_date, payload_enc)
select '73737373-0000-4000-8000-00000000000a', d, private.cycle_encrypt('{"energy": 3}'::jsonb, 1::smallint)
from (values ((private.cycle_today() - interval '24 months')::date - 1),
             ((private.cycle_today() - interval '24 months')::date),
             ((private.cycle_today() - interval '24 months')::date + 1)) v(d);
select is(private.cycle_retention(), 1, 'Aufbewahrung: nur der Tag VOR der 24-Monats-Grenze wird gelöscht');
select is(('2028-02-29'::date - interval '24 months')::date, '2026-02-28'::date,
  'Grenze am 29.02. und Monatsende: interval ''24 months'' rechnet kalendarisch');

select * from finish();
rollback;
