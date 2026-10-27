-- Live-Begleitung (20261027170000_live_companion.sql, docs/PLAN-PHASE-10.md 21.4): Rechte und RLS (fremde Sitzung
-- unsichtbar, anon liest nichts, keine Kontakte-Tabelle), Token nur als SHA-256, eine offene Sitzung je Person,
-- nur die letzte Position (Ratenbremse 10 s, nur neuere), Lese-Funktion nur für service_role mit gleicher Antwort für
-- falsches/abgelaufenes Token, Ratenbremse je IP und je Sitzung, angekommen/beendet ohne Koordinaten (Position sofort
-- gelöscht, Status höchstens 2 h), 12-h-Grenze, Link neu erzeugen, Aufräumen, Export ohne token_hash, Konto löschen.
begin;
create extension if not exists pgtap with schema extensions;
select plan(75);

insert into auth.users (id, email) values
  ('11011011-1111-4111-8111-111111111111', 'live-a@example.test'),
  ('11011011-2222-4222-8222-222222222222', 'live-b@example.test');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- SHA-256 eines base64url-Tokens als Hex (wie /api/begleitung).
create function pg_temp.token_hash(p_token text) returns text language sql as $$
  select encode(sha256(decode(translate(p_token, '-_', '+/') || '=', 'base64')), 'hex')
$$;
grant execute on function pg_temp.token_hash(text) to service_role;

create function pg_temp.ip(p_n integer) returns text language sql as $$
  select encode(sha256(convert_to('ip-' || p_n, 'UTF8')), 'hex')
$$;
grant execute on function pg_temp.ip(integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
           where p.oid in ('public.start_live_session(text, text, integer, integer, boolean)'::regprocedure,
                           'public.push_live_position(uuid, double precision, double precision, integer, timestamptz)'::regprocedure,
                           'public.set_live_status(uuid, text)'::regprocedure,
                           'public.rotate_live_token(uuid)'::regprocedure,
                           'public.get_live_view(text, text)'::regprocedure,
                           'private.purge_live_sessions()'::regprocedure)),
  'alle Funktionen: security definer, search_path leer');
select ok(not has_function_privilege('anon', 'public.start_live_session(text, text, integer, integer, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.push_live_position(uuid, double precision, double precision, integer, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.set_live_status(uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.rotate_live_token(uuid)', 'execute'),
  'anon: keine Schreib-Funktionen');
select ok(not has_function_privilege('anon', 'public.get_live_view(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.get_live_view(text, text)', 'execute')
  and has_function_privilege('service_role', 'public.get_live_view(text, text)', 'execute'),
  'Lese-Funktion nur service_role (über /api/begleitung)');
select ok(not has_function_privilege('authenticated', 'public.live_cleanup()', 'execute')
  and has_function_privilege('service_role', 'public.live_cleanup()', 'execute'),
  'Aufräumen nur service_role');
select ok(not has_table_privilege('anon', 'public.live_sessions', 'select')
  and not has_table_privilege('anon', 'public.live_positions', 'select'), 'anon liest nichts');
select ok(not has_table_privilege('authenticated', 'public.live_sessions', 'insert')
  and not has_table_privilege('authenticated', 'public.live_sessions', 'update')
  and not has_table_privilege('authenticated', 'public.live_positions', 'insert')
  and not has_table_privilege('authenticated', 'public.live_positions', 'delete'),
  'kein direktes Schreiben');
select ok(not has_column_privilege('authenticated', 'public.live_sessions', 'token_hash', 'select')
  and has_column_privilege('authenticated', 'public.live_sessions', 'status', 'select'),
  'token_hash für Personen nicht lesbar');
select ok((select bool_and(relrowsecurity) from pg_class
           where oid in ('public.live_sessions'::regclass, 'public.live_positions'::regclass,
                         'private.live_view_attempts'::regclass)), 'RLS an');
select is_empty($$ select c.relname from pg_class c
                   where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace)
                     and c.relkind = 'r' and c.relname like '%contact%' $$,
  'keine Kontakte-Tabelle (Notfallkontakte nur auf dem Gerät)');

-- ---------------------------------------------------------------------------------------------------------
-- Start
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.start_live_session('Karsten', 'run', 60) $$, '42501', 'Nicht angemeldet.',
  'ohne Anmeldung kein Start');
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select throws_ok($$ select public.start_live_session(repeat('x', 31), 'run', 60) $$, '22023', null,
  'Anzeigename länger als 30 Zeichen abgelehnt');
select throws_ok($$ select public.start_live_session('  ', 'run', 60) $$, '22023', null, 'leerer Name abgelehnt');
select throws_ok($$ select public.start_live_session('Karsten', 'swim', 60) $$, '22023', null,
  'Schwimmen ist keine Aufzeichnungs-Sportart');
select throws_ok($$ select public.start_live_session('Karsten', 'run', 721) $$, '22023', null,
  'mehr als 12 h geplant abgelehnt');
select throws_ok($$ select public.start_live_session('Karsten', 'run', 60, 5) $$, '22023', null,
  'Intervall unter 15 s abgelehnt');

select set_config('live.a1', public.start_live_session(' Karsten ', 'run', 60)::text, true);
select ok(current_setting('live.a1')::jsonb ->> 'token' ~ '^[A-Za-z0-9_-]{43}$', 'Token: 43 Zeichen base64url');
select is((select array_agg(k order by k) from jsonb_object_keys(current_setting('live.a1')::jsonb) k),
  array['expires_at', 'id', 'planned_end_at', 'started_at', 'token'], 'Start-Antwort: genau diese Felder');
select results_eq(
  $$ select display_name, sport, status, update_interval_s::integer, expires_at - started_at,
            planned_end_at - started_at, ended_at
     from public.live_sessions where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid $$,
  $$ values ('Karsten'::text, 'run'::text, 'active'::text, 30, interval '12 hours', interval '60 minutes',
             null::timestamptz) $$,
  'Sitzung: Name getrimmt, aktiv, Ablauf Start + 12 h');
select throws_ok($$ select public.start_live_session('Karsten', 'run', 60) $$, '55000', null,
  'zweite offene Sitzung abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Positionen
-- ---------------------------------------------------------------------------------------------------------
select is(public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.941334567, 6.958284444, 8, now() - interval '1 minute'), 'ok', 'erste Position gespeichert');
select results_eq($$ select lat, lon, accuracy_m::integer from public.live_positions $$,
  $$ values (50.94133::numeric, 6.95828::numeric, 8) $$, 'auf 5 Nachkommastellen gerundet, Besitzer liest sie');
select is(public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9420, 6.9590, 8, now()), 'throttled', 'Update innerhalb von 10 s ignoriert');
select is(public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9420, 6.9590, 8, now() - interval '2 minutes'), 'older', 'ältere Position (nach Funkloch) ignoriert');
select throws_ok($$ select public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  91.5, 6.9, 8, now()) $$, '22023', 'Ungültige Position.', 'ungültige Koordinate: Fehler ohne Wert');
select throws_ok($$ select public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  'NaN'::double precision, 6.9, 8, now()) $$, '22023', 'Ungültige Position.', 'NaN abgelehnt');
select throws_ok($$ select public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9, 6.9, 8, now() + interval '10 minutes') $$, '22023', 'Ungültiger Zeitpunkt.', 'Zeit in der Zukunft abgelehnt');

reset role;
update public.live_positions set received_at = now() - interval '11 seconds';
set local role authenticated;
select is(public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9430, 6.9600, null, now()), 'ok', 'nach 10 s wieder angenommen');
select results_eq($$ select count(*)::integer, max(lat), bool_and(accuracy_m is null) from public.live_positions $$,
  $$ values (1, 50.94300::numeric, true) $$, 'genau EINE Zeile (überschrieben, keine Spur)');

-- Fremde Person
select pg_temp.as_user('11011011-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.live_sessions) + (select count(*)::integer from public.live_positions),
  0, 'B sieht weder Sitzung noch Position von A');
select throws_ok($$ select public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9, 6.9, 8, now()) $$, '42501', null, 'B kann keine Position für A senden');
select throws_ok($$ select public.set_live_status((current_setting('live.a1')::jsonb ->> 'id')::uuid, 'ended') $$,
  '42501', null, 'B kann A nicht beenden');
select throws_ok($$ select public.rotate_live_token((current_setting('live.a1')::jsonb ->> 'id')::uuid) $$,
  '55000', null, 'B kann As Link nicht neu erzeugen');
reset role;

-- anon liest nichts
set local role anon;
select throws_ok($$ select count(*) from public.live_sessions $$, '42501', null, 'anon: live_sessions gesperrt');
select throws_ok($$ select count(*) from public.live_positions $$, '42501', null, 'anon: live_positions gesperrt');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Ansicht der Vertrauensperson (service_role)
-- ---------------------------------------------------------------------------------------------------------
select is(encode(token_hash, 'hex'), pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'),
  'gespeichert ist nur SHA-256 des Tokens')
  from public.live_sessions where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid;

set local role service_role;
select set_config('live.v1', public.get_live_view(
  pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'), pg_temp.ip(1))::text, true);
select is(current_setting('live.v1')::jsonb ->> 'state', 'active', 'richtiges Token: aktiv');
select is((select array_agg(k order by k) from jsonb_object_keys(current_setting('live.v1')::jsonb) k),
  array['display_name', 'position', 'server_time', 'sport', 'started_at', 'state'],
  'nur Name, Sportart, Start, Serverzeit, Status, Position – keine Gesundheits- oder Leistungswerte');
select is((select array_agg(k order by k) from jsonb_object_keys(current_setting('live.v1')::jsonb -> 'position') k),
  array['accuracy_m', 'lat', 'lon', 'recorded_at'], 'Position: nur der letzte Punkt');
select is((current_setting('live.v1')::jsonb -> 'position' ->> 'lat')::numeric, 50.943::numeric, 'letzte Position');
select is(public.get_live_view(repeat('0', 64), pg_temp.ip(1)), '{"state": "invalid"}'::jsonb,
  'unbekanntes Token: invalid');
select is(public.get_live_view('kein-hash', pg_temp.ip(1)), '{"state": "invalid"}'::jsonb,
  'kaputter Hash: gleiche Antwort');
select throws_ok($$ select public.get_live_view(repeat('0', 64), '1.2.3.4') $$, '22023', null,
  'IP nur als Hash');

-- Ratenbremse je IP: 10 Abfragen je Minute.
-- array_agg wertet jede Zeile aus (bei ORDER BY … LIMIT würde Postgres die Funktion nur einmal aufrufen).
select is((select (array_agg(public.get_live_view(repeat('0', 64), pg_temp.ip(2)) order by g))[10]
           from generate_series(1, 10) g), '{"state": "invalid"}'::jsonb, '10 Abfragen je IP erlaubt');
select is(public.get_live_view(pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'), pg_temp.ip(2)),
  '{"state": "rate_limited"}'::jsonb, '11. Abfrage je IP und Minute gebremst (auch mit gültigem Token)');
-- Ratenbremse je Sitzung: 30 je Minute (verschiedene IPs).
select is((select (array_agg(public.get_live_view(pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'),
             pg_temp.ip(100 + g)) ->> 'state' order by g))[31] from generate_series(1, 31) g),
  'rate_limited', 'mehr als 30 Abfragen je Sitzung und Minute gebremst');
reset role;
delete from private.live_view_attempts;

-- ---------------------------------------------------------------------------------------------------------
-- Pause, Angekommen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select is(public.set_live_status((current_setting('live.a1')::jsonb ->> 'id')::uuid, 'paused') ->> 'status',
  'paused', 'pausiert');
select is(public.set_live_status((current_setting('live.a1')::jsonb ->> 'id')::uuid, 'arrived') ->> 'status',
  'arrived', 'angekommen');
select is((select count(*)::integer from public.live_positions), 0, 'Position beim Ankommen SOFORT gelöscht');
select results_eq(
  $$ select expires_at = least(now() + interval '2 hours', started_at + interval '12 hours'), ended_at = now()
     from public.live_sessions where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid $$,
  $$ values (true, true) $$, 'Status noch höchstens 2 h sichtbar');
select throws_ok($$ select public.set_live_status((current_setting('live.a1')::jsonb ->> 'id')::uuid, 'active') $$,
  '55000', null, 'angekommen bleibt angekommen');
select lives_ok($$ select public.set_live_status((current_setting('live.a1')::jsonb ->> 'id')::uuid, 'ended') $$,
  'erneutes Beenden ohne Fehler');
select is(public.push_live_position((current_setting('live.a1')::jsonb ->> 'id')::uuid,
  50.9, 6.9, 8, now()), 'closed', 'nach dem Ankommen keine Position mehr');
select throws_ok($$ select public.rotate_live_token((current_setting('live.a1')::jsonb ->> 'id')::uuid) $$,
  '55000', null, 'abgeschlossene Sitzung: kein neuer Link');
reset role;

set local role service_role;
select set_config('live.v2', public.get_live_view(
  pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'), pg_temp.ip(3))::text, true);
select is(current_setting('live.v2')::jsonb ->> 'state', 'arrived', 'Kontakt sieht „angekommen“');
select ok(not (current_setting('live.v2')::jsonb ? 'position') and current_setting('live.v2')::jsonb ? 'ended_at',
  'angekommen: OHNE Koordinaten, mit Uhrzeit');
reset role;

-- Nach 2 h: Link ungültig (gleiche Antwort wie falsches Token).
update public.live_sessions
   set started_at = started_at - interval '3 hours', planned_end_at = planned_end_at - interval '3 hours',
       ended_at = ended_at - interval '3 hours', expires_at = expires_at - interval '3 hours'
 where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid;
set local role service_role;
select is(public.get_live_view(pg_temp.token_hash(current_setting('live.a1')::jsonb ->> 'token'), pg_temp.ip(3)),
  '{"state": "invalid"}'::jsonb, 'nach Ablauf: gleiche Antwort wie falsches Token');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Neuer Start, Link neu erzeugen, Ersetzen, 12-h-Grenze
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select set_config('live.a2', public.start_live_session('Karsten', 'bike', 90, 15)::text, true);
select is(public.push_live_position((current_setting('live.a2')::jsonb ->> 'id')::uuid, 48.1, 11.5, 12, now()),
  'ok', 'neue Sitzung (die alte ist abgeschlossen)');
select set_config('live.a2r', public.rotate_live_token((current_setting('live.a2')::jsonb ->> 'id')::uuid)::text, true);
select isnt(current_setting('live.a2r')::jsonb ->> 'token', current_setting('live.a2')::jsonb ->> 'token',
  'Link neu erzeugt: neues Token');
reset role;
set local role service_role;
select is(public.get_live_view(pg_temp.token_hash(current_setting('live.a2')::jsonb ->> 'token'), pg_temp.ip(4)),
  '{"state": "invalid"}'::jsonb, 'altes Token sofort ungültig');
select is(public.get_live_view(pg_temp.token_hash(current_setting('live.a2r')::jsonb ->> 'token'), pg_temp.ip(4))
  ->> 'sport', 'bike', 'neues Token gültig');
reset role;

set local role authenticated;
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select set_config('live.a3', public.start_live_session('Karsten', 'walk', 60, 30, true)::text, true);
select results_eq(
  $$ select status from public.live_sessions where id = (current_setting('live.a2')::jsonb ->> 'id')::uuid $$,
  $$ values ('ended'::text) $$, 'Ersetzen beendet die alte Sitzung');
select is((select count(*)::integer from public.live_positions), 0, 'Ersetzen löscht die alte Position');
select is(public.push_live_position((current_setting('live.a3')::jsonb ->> 'id')::uuid, 47.4, 8.5, 5,
  now()), 'ok', 'Position der neuen Sitzung');
reset role;

-- 12-h-Grenze: Sitzung begann vor 12 h 1 min.
update public.live_sessions
   set started_at = started_at - interval '12 hours 1 minute',
       planned_end_at = planned_end_at - interval '12 hours 1 minute',
       expires_at = expires_at - interval '12 hours 1 minute'
 where id = (current_setting('live.a3')::jsonb ->> 'id')::uuid;
update public.live_positions set recorded_at = recorded_at - interval '12 hours 1 minute';
set local role service_role;
select is(public.get_live_view(pg_temp.token_hash(current_setting('live.a3')::jsonb ->> 'token'), pg_temp.ip(5)),
  '{"state": "invalid"}'::jsonb, 'nach 12 h ist der Link ungültig');
reset role;
set local role authenticated;
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select is(public.push_live_position((current_setting('live.a3')::jsonb ->> 'id')::uuid, 47.4, 8.5, 5, now()),
  'closed', 'nach 12 h keine Position mehr');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen
-- ---------------------------------------------------------------------------------------------------------
insert into private.live_view_attempts (key, created_at) values ('ip:' || pg_temp.ip(9), now() - interval '2 hours');
select cmp_ok(private.purge_live_sessions(), '>', 0, 'Aufräumen läuft');
select results_eq(
  $$ select status, ended_at = expires_at from public.live_sessions
     where id = (current_setting('live.a3')::jsonb ->> 'id')::uuid $$,
  $$ values ('ended'::text, true) $$, 'abgelaufene offene Sitzung geschlossen');
select is((select count(*)::integer from public.live_positions), 0, 'Position abgelaufener Sitzung gelöscht');
select is((select count(*)::integer from private.live_view_attempts where created_at < now() - interval '1 hour'),
  0, 'Prüfwerte älter als 1 h gelöscht');
select is((select count(*)::integer from public.live_sessions where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid),
  1, 'Metadaten bleiben bis 24 h nach Ablauf');
update public.live_sessions
   set started_at = started_at - interval '1 day', planned_end_at = planned_end_at - interval '1 day',
       ended_at = ended_at - interval '1 day', expires_at = expires_at - interval '1 day'
 where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid;
select lives_ok($$ select public.live_cleanup() $$, 'live_cleanup (GitHub Action) läuft');
select is((select count(*)::integer from public.live_sessions where id = (current_setting('live.a1')::jsonb ->> 'id')::uuid),
  0, 'Sitzung 24 h nach Ablauf gelöscht');

-- ---------------------------------------------------------------------------------------------------------
-- Export und Konto löschen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11011011-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'live_sessions'), 2,
  'Export: eigene Sitzungen');
select ok(not exists (select 1 from jsonb_array_elements(public.export_my_data() -> 'data' -> 'live_sessions') e
                      where e ? 'token_hash'), 'Export ohne token_hash');
reset role;

delete from auth.users where id = '11011011-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.live_sessions), 0, 'Konto löschen: Sitzungen weg (Kaskade)');

select * from finish();
rollback;
