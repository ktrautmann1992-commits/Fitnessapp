-- „Meine Strecken“ (Migration 20261025120000_route_match.sql, Gründer-Entscheidung 25.10.2026):
-- - Spalten route_match (CHECK), match_rejected_ids (höchstens 20), auto_match (Standard true), Bestand → repeat,
-- - Trigger: Verweis ohne Herkunft → repeat, Verweis leer (auch Löschen des Favoriten) → Herkunft leer,
-- - set_route_match: nur eigene Strecken (fremd/anon abgelehnt), Ziel eigener Favorit derselben Sportart, ±10 %,
--   nicht sie selbst, kein Kreis, „auto“ überschreibt keine Entscheidung, „Nein“ gemerkt, „Rückgängig“, Uhr-Läufe,
-- - set_route_auto_match, RLS (B sieht nichts von A), Export enthält die Spalten, Funktionen security definer.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');

create function pg_temp.enc(p_value bigint) returns text language plpgsql as $$
declare
  z bigint := case when p_value < 0 then -2 * p_value - 1 else 2 * p_value end;
  out text := '';
begin
  while z >= 32 loop
    out := out || chr(((z % 32) + 32 + 63)::integer);
    z := z / 32;
  end loop;
  return out || chr((z + 63)::integer);
end;
$$;
create function pg_temp.poly3() returns text language sql as $$
  select pg_temp.enc(5094130) || pg_temp.enc(695830) || pg_temp.enc(10) || pg_temp.enc(0) || pg_temp.enc(10)
    || pg_temp.enc(0)
$$;
-- Strecke direkt anlegen (als Eigentümer der Tabelle; Tageslimit von save_tracked_route gilt hier nicht).
create function pg_temp.mk(p_id uuid, p_user uuid, p_sport text, p_distance integer, p_fav boolean,
  p_base uuid default null)
returns void language plpgsql as $$
declare
  s numeric[] := private.polyline_summary(pg_temp.poly3());
begin
  insert into public.tracked_routes (id, user_id, name, sport, started_at, duration_s, moving_s, distance_m, polyline,
    point_count, bbox, km_splits, is_favorite, base_route_id, source)
  values (p_id, p_user, 'Runde', p_sport::public.endurance_modality, now() - interval '1 day', 3600, 3600, p_distance,
    pg_temp.poly3(), s[1]::integer, s[2:5],
    coalesce((select jsonb_agg(300) from generate_series(1, p_distance / 1000)), '[]'::jsonb), p_fav, p_base,
    'recorded');
end;
$$;
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
create function pg_temp.state(p_id uuid) returns text language sql security definer as $$
  select coalesce(t.route_match, '-') || '|' || coalesce(t.base_route_id::text, '-') || '|'
    || cardinality(t.match_rejected_ids)
  from public.tracked_routes t where t.id = p_id
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- A: Favorit F (Laufen 5.000 m), Favorit G (Laufen 5.200 m), Lauf R (5.100 m), Rad-Favorit K, Lauf L (5.600 m = +12 %),
-- kein Favorit N; B: Favorit X.
select pg_temp.mk('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'run', 5000, true);
select pg_temp.mk('a0000000-0000-4000-8000-0000000000f2', '11111111-1111-4111-8111-111111111111', 'run', 5200, true);
select pg_temp.mk('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'run', 5100, false);
select pg_temp.mk('a0000000-0000-4000-8000-0000000000b1', '11111111-1111-4111-8111-111111111111', 'bike', 5000, true);
select pg_temp.mk('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'run', 5600, false);
select pg_temp.mk('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'run', 5000, false);
select pg_temp.mk('b0000000-0000-4000-8000-0000000000f1', '22222222-2222-4222-8222-222222222222', 'run', 5000, true);

-- ---------------------------------------------------------------------------------------------------------
-- Spalten, CHECKs, Trigger
-- ---------------------------------------------------------------------------------------------------------
select col_default_is('public', 'tracked_routes', 'auto_match', 'true', 'auto_match: Standard true');
select col_not_null('public', 'tracked_routes', 'match_rejected_ids', 'match_rejected_ids not null');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), '-|-|0', 'neuer Lauf: nicht zugeordnet');
select throws_ok(
  $$ update public.tracked_routes set route_match = 'egal' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'CHECK: nur repeat/auto/confirmed/rejected');
select throws_ok(
  $$ update public.tracked_routes set match_rejected_ids = array_fill(gen_random_uuid(), array[21])
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'CHECK: höchstens 20 abgelehnte Strecken');
-- Verweis ohne Herkunft (wie save_tracked_route mit „Erneut laufen“) → repeat.
select pg_temp.mk('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'run', 5000, false,
  'a0000000-0000-4000-8000-0000000000f1');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000004'), 'repeat|a0000000-0000-4000-8000-0000000000f1|0',
  'Erneut laufen → repeat');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('set_route_match', 'set_route_auto_match')),
  'Funktionen security definer, search_path leer, nur authenticated');

-- ---------------------------------------------------------------------------------------------------------
-- set_route_match als A
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'auto'),
  'auto', 'auto: Lauf wird vorläufig zugeordnet');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), 'auto|a0000000-0000-4000-8000-0000000000f1|0',
  'auto: Verweis gesetzt');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f2', 'auto'),
  'unchanged', 'auto überschreibt keine bestehende Zuordnung');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1',
  'rejected'), 'rejected', 'Nein');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), 'rejected|-|1', 'Nein: Verweis leer, gemerkt');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'auto'),
  'unchanged', 'nach Nein: kein erneuter automatischer Vorschlag');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1', 'clear'),
  'clear', 'Rückgängig');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), '-|-|0', 'Rückgängig: wieder offen, nicht abgelehnt');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f2',
  'confirmed'), 'confirmed', 'Andere Strecke wählen: bestätigt');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), 'confirmed|a0000000-0000-4000-8000-0000000000f2|0',
  'bestätigt: Verweis auf die gewählte Strecke');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1',
  'rejected'), 'rejected', 'Nein zu einer anderen Strecke');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), 'confirmed|a0000000-0000-4000-8000-0000000000f2|1',
  'Nein zu einer anderen Strecke lässt die bestätigte Zuordnung stehen');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000f1',
  'confirmed'), 'confirmed', 'Ja nach Nein');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), 'confirmed|a0000000-0000-4000-8000-0000000000f1|0',
  'Ja nimmt die Strecke aus der Ablehnungsliste');

-- Falsche Ziele
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-0000000000b1', 'confirmed') $$),
  '22023: Dieser Lauf passt nicht zu der Strecke.', 'andere Sportart abgelehnt');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-0000000000f1', 'confirmed') $$),
  '22023: Dieser Lauf passt nicht zu der Strecke.', 'Distanz +12 % abgelehnt');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f2',
  'confirmed'), 'confirmed', 'Distanz +7,7 % erlaubt');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001', 'confirmed') $$),
  '22023: Dieser Lauf passt nicht zu der Strecke.', 'Ziel ist kein Favorit');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-0000000000f1',
  'a0000000-0000-4000-8000-0000000000f1', 'confirmed') $$),
  '22023: Ungültige Angaben zur Strecke.', 'nicht sie selbst');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-0000000000f2',
  'a0000000-0000-4000-8000-0000000000f1', 'confirmed') $$),
  '22023: Dieser Lauf passt nicht zu der Strecke.', 'eine Meine Strecke gehört zu keiner anderen (kein Kreis)');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-0000000000f1', 'vielleicht') $$),
  '22023: Ungültige Angaben zur Strecke.', 'unbekannter Zustand abgelehnt');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-0000000000f1', 'confirmed') $$),
  '22023: Die Strecke wurde nicht gefunden.', 'fremder Favorit als Ziel abgelehnt (ohne Werte)');

-- Automatisch zuordnen ausgeschaltet → auto ändert nichts; Schalter nur für eigene Strecken.
select lives_ok($$ select public.set_route_auto_match('a0000000-0000-4000-8000-0000000000f1', false) $$,
  'Schalter aus');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f1', 'auto'),
  'unchanged', 'auto bei ausgeschalteter Zuordnung: unverändert');
select lives_ok($$ select public.set_route_auto_match('a0000000-0000-4000-8000-0000000000f1', true) $$,
  'Schalter an');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-0000000000f1', 'auto'),
  'auto', 'auto bei eingeschalteter Zuordnung');

-- ---------------------------------------------------------------------------------------------------------
-- Fremd und anonym
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.error_of($$ select public.set_route_match('a0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-0000000000f1', 'clear') $$),
  '42501: Strecke nicht gefunden.', 'B ändert keine Zuordnung von A');
select is(pg_temp.error_of($$ select public.set_route_auto_match('a0000000-0000-4000-8000-0000000000f1', false) $$),
  '42501: Strecke nicht gefunden.', 'B schaltet nichts bei A');
select is((select count(*)::integer from public.tracked_routes where user_id = '11111111-1111-4111-8111-111111111111'),
  0, 'RLS: B sieht keine Strecken von A');
reset role;
set local role anon;
select throws_ok($$ select public.set_route_match('a0000000-0000-4000-8000-000000000003', null, 'clear') $$,
  '42501', null, 'anon: kein Zugriff');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Ablehnungsliste höchstens 20 (älteste fallen heraus), Favorit gelöscht, Export
-- ---------------------------------------------------------------------------------------------------------
update public.tracked_routes set match_rejected_ids = (select array_agg(gen_random_uuid()) from generate_series(1, 20))
where id = 'a0000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.set_route_match('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-0000000000f1',
  'rejected'), 'rejected', 'Nein bei voller Liste');
select ok((select cardinality(match_rejected_ids) = 20
             and match_rejected_ids[20] = 'a0000000-0000-4000-8000-0000000000f1'
           from public.tracked_routes where id = 'a0000000-0000-4000-8000-000000000002'),
  'Liste bleibt bei 20, neueste hinten');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000002'), 'confirmed|a0000000-0000-4000-8000-0000000000f2|20',
  'Zuordnung zu einer anderen Strecke bleibt');
select lives_ok($$ select public.delete_tracked_route('a0000000-0000-4000-8000-0000000000f1') $$,
  'Favorit F löschen');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000001'), '-|-|0',
  'Favorit gelöscht: Lauf wieder offen (Herkunft leer)');
select is(pg_temp.state('a0000000-0000-4000-8000-000000000004'), '-|-|0',
  'Favorit gelöscht: Erneut-laufen-Lauf ebenfalls offen');
select ok(
  (select bool_and(t ? 'route_match' and t ? 'match_rejected_ids' and t ? 'auto_match')
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') t),
  'Export enthält route_match, match_rejected_ids, auto_match');
select is(
  (select count(*)::integer from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') t
   where t ->> 'route_match' = 'confirmed'),
  1, 'Export: Zuordnung je Zeile');

reset role;
select * from finish();
rollback;
