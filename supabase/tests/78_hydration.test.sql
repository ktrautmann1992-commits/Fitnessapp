-- Trinken-Tracker (Migration 20261025140000_hydration.sql): RLS (B sieht nichts von A, anon nichts), Schreiben nur
-- über die Funktionen, Grenzen (50–2.000 ml, heute bis 14 Tage zurück, 40 je Tag), Warteschlange (gleiche id),
-- Löschen, Export, Konto löschen (Kaskade).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
declare
  code text;
  msg text;
begin
  execute p_sql;
  return 'kein Fehler';
exception when others then
  get stacked diagnostics code = returned_sqlstate, msg = message_text;
  return code || ': ' || msg;
end;
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.e(p_id text, p_ml integer, p_day date default private.berlin_today()) returns jsonb
language sql as $$
  select jsonb_build_object('id', p_id, 'day', p_day::text, 'amount_ml', p_ml)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

select ok((select relrowsecurity from pg_class where oid = 'public.hydration_logs'::regclass), 'RLS an');
select ok(not has_table_privilege('authenticated', 'public.hydration_logs', 'insert'), 'kein direktes Einfügen');
select ok(not has_table_privilege('anon', 'public.hydration_logs', 'select'), 'anon liest nicht');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('add_hydration', 'delete_hydration', 'delete_all_hydration')),
  'Funktionen: search_path leer, nur authenticated');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000001', 250)),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'A trägt 250 ml ein');
select is(public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000001', 250)),
  'a0000000-0000-4000-8000-000000000001'::uuid, 'gleiche id erneut (Warteschlange) → unverändert');
select is((select count(*)::integer from public.hydration_logs), 1, 'nur ein Eintrag');
select lives_ok($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000002', 500,
  private.berlin_today() - 14)) $$, '14 Tage zurück erlaubt');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000003', 500,
  private.berlin_today() - 15)) $$), '22023: Das Datum liegt außerhalb des erlaubten Zeitraums.', '15 Tage zurück abgelehnt');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000003', 500,
  private.berlin_today() + 1)) $$), '22023: Das Datum liegt außerhalb des erlaubten Zeitraums.', 'Zukunft abgelehnt');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000003', 49)) $$),
  '22023: Ungültige Angaben zum Trinken.', 'unter 50 ml abgelehnt');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000003', 2001)) $$),
  '22023: Ungültige Angaben zum Trinken.', 'über 2.000 ml abgelehnt');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000003', 250)
  || '{"user_id": "22222222-2222-4222-8222-222222222222"}') $$),
  '22023: Unbekanntes Feld in der Eingabe (Trinken).', 'fremdes Feld (user_id) abgelehnt');
select is(
  (select count(*)::integer from (select public.add_hydration(pg_temp.e(gen_random_uuid()::text, 100, private.berlin_today() - 1))
     from generate_series(1, 40)) x), 40, '40 Einträge an einem Tag');
select is(pg_temp.error_of($$ select public.add_hydration(pg_temp.e(gen_random_uuid()::text, 100,
  private.berlin_today() - 1)) $$), '54000: An diesem Tag sind schon sehr viele Einträge gespeichert.', 'der 41. abgelehnt');

-- B sieht nichts von A und kann nichts löschen.
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.hydration_logs), 0, 'RLS: B sieht keine Einträge von A');
select lives_ok($$ select public.delete_hydration('a0000000-0000-4000-8000-000000000001') $$, 'B löscht „nichts“');
select is(public.add_hydration(pg_temp.e('a0000000-0000-4000-8000-000000000001', 300)) =
  'a0000000-0000-4000-8000-000000000001'::uuid, false, 'fremde id → neue id');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'hydration_logs'), 42, 'Export: alle eigenen Einträge');
select is(public.delete_all_hydration(), 42, 'alle eigenen löschen');

reset role;
select * from finish();
rollback;
