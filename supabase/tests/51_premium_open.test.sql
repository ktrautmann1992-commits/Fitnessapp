-- Testphase „alles offen“ (Gründer-Entscheidung 19.10.2026, Migration 20261019120000_premium_open.sql, KONZEPT 13):
-- Flag premium_open (Standard AN) → jedes angemeldete Konto hat Premium; aus → nur Beta-Freischaltung; anon nie.
-- Die Flags der einzelnen Funktionen, Einwilligungen und die Monats-/Tageslimits (ai_usage) greifen weiter.
-- beta_admin schaltet premium_open (nur flag_on/flag_off/status, Antworten ohne Personenbezug).
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

-- A, B: angemeldet mit Gesundheits- und Foto-Einwilligung, ohne Beta. C: später Beta. E: Konto, das gelöscht wird.
insert into auth.users (id, email) values
  ('a1a1a1a1-1111-4111-8111-111111111111', 'open-a@example.test'),
  ('b2b2b2b2-2222-4222-8222-222222222222', 'open-b@example.test'),
  ('c3c3c3c3-3333-4333-8333-333333333333', 'open-c@example.test'),
  ('e5e5e5e5-5555-4555-8555-555555555555', 'open-e@example.test'),
  ('f6f6f6f6-6666-4666-8666-666666666666', 'open-f@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  'a1a1a1a1-1111-4111-8111-111111111111', 'b2b2b2b2-2222-4222-8222-222222222222',
  'c3c3c3c3-3333-4333-8333-333333333333', 'e5e5e5e5-5555-4555-8555-555555555555',
  'f6f6f6f6-6666-4666-8666-666666666666']::uuid[]) as u;
insert into public.consents (user_id, consent_type, version, platform) values
  ('a1a1a1a1-1111-4111-8111-111111111111', 'health_data', 1, 'web'),
  ('a1a1a1a1-1111-4111-8111-111111111111', 'ai_food_photo', 1, 'web'),
  ('b2b2b2b2-2222-4222-8222-222222222222', 'health_data', 1, 'web'),
  ('b2b2b2b2-2222-4222-8222-222222222222', 'ai_food_photo', 1, 'web'),
  ('f6f6f6f6-6666-4666-8666-666666666666', 'health_data', 1, 'web'),
  ('f6f6f6f6-6666-4666-8666-666666666666', 'ai_food_photo', 1, 'web');

create function pg_temp.reserve(p_user text) returns jsonb language sql as $$
  select public.ai_food_photo_reserve(p_user::uuid)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Flag, Rechte, unveränderte Funktions-Flags
-- ---------------------------------------------------------------------------------------------------------
select is((select enabled from private.feature_flags where key = 'premium_open'), true,
  'premium_open startet AN (Testphase)');
select is(
  (select array_agg(key order by key) from private.feature_flags where enabled),
  array['premium_open'],
  'Funktions-Flags unverändert AUS (ai_food_photo, food_product_lookup, live_adjustment)');
select ok(
  (select p.proconfig @> array['search_path=""'] and not p.prosecdef
   from pg_proc p where p.oid = 'private.has_entitlement_for(uuid, text)'::regprocedure),
  'has_entitlement_for: search_path leer, kein security definer (wie bisher)');
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'private.premium_open_flag_admin(text, text)'::regprocedure),
  'premium_open_flag_admin: security definer, search_path leer');
select ok(not has_function_privilege('authenticated', 'private.has_entitlement_for(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'private.has_entitlement_for(uuid, text)', 'execute'),
  'has_entitlement_for: weder anon noch authenticated');
select ok(not has_function_privilege('authenticated', 'private.premium_open_flag_admin(text, text)', 'execute')
          and not has_function_privilege('anon', 'private.premium_open_flag_admin(text, text)', 'execute'),
  'premium_open_flag_admin: weder anon noch authenticated');
select ok(not has_function_privilege('anon', 'public.has_entitlement(text)', 'execute'),
  'anon: has_entitlement nicht ausführbar');
select ok(not has_function_privilege('authenticated',
  'public.beta_admin(text, text, text, integer, text, integer, integer)', 'execute'),
  'authenticated: beta_admin nicht ausführbar');

-- ---------------------------------------------------------------------------------------------------------
-- An: jedes angemeldete Konto Premium, anon nie
-- ---------------------------------------------------------------------------------------------------------
select ok(private.has_entitlement_for('a1a1a1a1-1111-4111-8111-111111111111', 'premium'),
  'an: A ohne Beta → premium');
select ok(not private.has_entitlement_for('a1a1a1a1-1111-4111-8111-111111111111', 'anderes'),
  'an: nur das Entitlement premium wird geöffnet');
select ok(not private.has_entitlement_for('99999999-9999-4999-8999-999999999999', 'premium'),
  'an: unbekannte Person → kein premium');
select ok(not private.has_entitlement_for(null, 'premium'), 'an: null → kein premium');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(public.has_entitlement(), 'an: has_entitlement() für A = true');
select ok(public.premium_open_active(), 'an: premium_open_active() für A = true (Kennzeichen)');
select is(public.ai_food_photo_access(), '{"active": false, "reason": "flag_off"}'::jsonb,
  'an: Foto-Funktion bleibt hinter ihrem eigenen Flag');
select is(public.live_adjustment_status(), '{"active": false, "reason": "flag_off"}'::jsonb,
  'an: Live-Anpassung bleibt hinter ihrem eigenen Flag');
set local request.jwt.claims = '{"role":"authenticated"}';
select ok(not public.has_entitlement(), 'ohne Anmeldung (keine sub) → false');
reset role;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.has_entitlement() $$, '42501', null, 'anon: has_entitlement verweigert');
select throws_ok($$ select public.ai_food_photo_access() $$, '42501', null, 'anon: ai_food_photo_access verweigert');
select throws_ok($$ select public.premium_open_active() $$, '42501', null, 'anon: premium_open_active verweigert');
reset role;

-- Gelöschtes Konto: delete_my_account entfernt die Zeile aus auth.users → kein premium. Supabase-Auth kennt
-- zusätzlich deleted_at (weich gelöscht) und is_anonymous – geprüft, wenn es die Spalten gibt.
delete from auth.users where id = 'e5e5e5e5-5555-4555-8555-555555555555';
select ok(not private.has_entitlement_for('e5e5e5e5-5555-4555-8555-555555555555', 'premium'),
  'gelöschtes Konto → kein premium');
insert into auth.users (id, email) values ('e5e5e5e5-5555-4555-8555-555555555555', 'open-e@example.test');
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'auth' and table_name = 'users' and column_name = 'deleted_at') then
    execute $q$update auth.users set deleted_at = now() where id = 'e5e5e5e5-5555-4555-8555-555555555555'$q$;
  end if;
end;
$$;
select ok(
  case when exists (select 1 from information_schema.columns
                    where table_schema = 'auth' and table_name = 'users' and column_name = 'deleted_at')
       then not private.has_entitlement_for('e5e5e5e5-5555-4555-8555-555555555555', 'premium')
       else true end,
  'weich gelöschtes Konto (deleted_at, falls vorhanden) → kein premium');
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'auth' and table_name = 'users' and column_name = 'deleted_at') then
    execute $q$update auth.users set deleted_at = null where id = 'e5e5e5e5-5555-4555-8555-555555555555'$q$;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous') then
    execute $q$update auth.users set is_anonymous = true where id = 'e5e5e5e5-5555-4555-8555-555555555555'$q$;
  end if;
end;
$$;
select ok(
  case when exists (select 1 from information_schema.columns
                    where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous')
       then not private.has_entitlement_for('e5e5e5e5-5555-4555-8555-555555555555', 'premium')
       else true end,
  'anonymes Konto (is_anonymous, falls vorhanden) → kein premium');

-- ---------------------------------------------------------------------------------------------------------
-- Limits greifen weiter (Standard 30/Monat, 8/Tag; ai_usage protokolliert)
-- ---------------------------------------------------------------------------------------------------------
-- Zusatzauflage Plan-Prüfung: KI läuft nur mit ihrem EIGENEN Flag – premium_open öffnet keine KI.
set local role service_role;
select is(pg_temp.reserve('a1a1a1a1-1111-4111-8111-111111111111'), '{"result": "flag_off"}'::jsonb,
  'an: KI-Flag ai_food_photo aus → Reservieren flag_off (premium_open öffnet keine KI)');
reset role;
select is((select count(*) from public.ai_usage), 0::bigint, 'an: KI-Flag aus → keine Zeile in ai_usage');
set local role service_role;
select is(public.beta_admin('flag_on', 'gruender-1', null, 90, 'ai_food_photo'), '{"result": "flag_on"}'::jsonb,
  'Foto-Flag für den Test an');
create temp table res as select pg_temp.reserve('a1a1a1a1-1111-4111-8111-111111111111') as r;
select is((select r - 'id' from res),
  '{"result": "reserved", "remaining_month": 29, "remaining_today": 7}'::jsonb,
  'an: A ohne Beta reserviert mit Standard-Limits');
select is(public.ai_food_photo_finish((select (r ->> 'id')::uuid from res), 'a1a1a1a1-1111-4111-8111-111111111111',
  'succeeded', 'attrappe', 1, 1, 0), '{"result": "ok"}'::jsonb, 'Abschluss protokolliert');
reset role;
select is((select count(*) from public.ai_usage where user_id = 'a1a1a1a1-1111-4111-8111-111111111111'
           and status = 'succeeded'), 1::bigint, 'ai_usage: Aufruf protokolliert');
-- A: 7 weitere erfolgreiche Fotos heute → Tageslimit 8.
insert into public.ai_usage (user_id, feature, status, model, finished_at)
select 'a1a1a1a1-1111-4111-8111-111111111111', 'food_photo', 'succeeded', 'attrappe', now()
from generate_series(1, 7);
-- B: 30 erfolgreiche Fotos in diesem Monat → Monatslimit 30.
insert into public.ai_usage (user_id, feature, status, model, finished_at)
select 'b2b2b2b2-2222-4222-8222-222222222222', 'food_photo', 'succeeded', 'attrappe', now()
from generate_series(1, 30);
set local role service_role;
select is(pg_temp.reserve('a1a1a1a1-1111-4111-8111-111111111111') ->> 'scope', 'day',
  'an: Tageslimit greift weiter');
select is(pg_temp.reserve('b2b2b2b2-2222-4222-8222-222222222222') ->> 'scope', 'month',
  'an: Monatslimit greift weiter');
select is(pg_temp.reserve('c3c3c3c3-3333-4333-8333-333333333333'), '{"result": "no_consent"}'::jsonb,
  'an: Einwilligung bleibt Pflicht');
-- KI-Flag wieder aus (premium_open bleibt an) → sofort keine KI mehr, auch für B unter dem Limit.
select is(public.beta_admin('flag_off', 'gruender-1', null, 90, 'ai_food_photo'), '{"result": "flag_off"}'::jsonb,
  'Foto-Flag aus');
select is(pg_temp.reserve('a1a1a1a1-1111-4111-8111-111111111111'), '{"result": "flag_off"}'::jsonb,
  'an + KI-Flag aus → flag_off');
select is(public.beta_admin('flag_on', 'gruender-1', null, 90, 'ai_food_photo'), '{"result": "flag_on"}'::jsonb,
  'Foto-Flag wieder an (für die folgenden Fälle)');
reset role;

-- Globale Kostenbremse (Wächter M1): Obergrenze über ALLE Konten, solange premium_open an ist.
select is((select (monthly_calls_cap, monthly_cost_eur_cap)::text from private.ai_budget where feature = 'food_photo'),
  '(2000,10.00)', 'ai_budget: vorsichtiger Standard 2000 Aufrufe / 10 € im Monat');
select ok((select relrowsecurity from pg_class where oid = 'private.ai_budget'::regclass)
          and not has_table_privilege('authenticated', 'private.ai_budget', 'select')
          and not has_table_privilege('anon', 'private.ai_budget', 'select'),
  'ai_budget: RLS an, weder anon noch authenticated');
select ok(
  (select position('ai_food_photo|'' || p_user_id' in p.prosrc) > 0
          and position('ai_food_photo|'' || p_user_id' in p.prosrc) < position('ai_food_photo|global' in p.prosrc)
          and position('ai_food_photo|global' in p.prosrc) < position('from private.ai_budget' in p.prosrc)
          and position('from private.ai_budget' in p.prosrc) < position('insert into public.ai_usage' in p.prosrc)
   from pg_proc p where p.oid = 'public.ai_food_photo_reserve(uuid, integer)'::regprocedure),
  'reserve: Personen-Sperre → globale Sperre → Budget zählen → schreiben');
-- Bisher 38 Aufrufe im Monat (A 8, B 30): Obergrenze genau erreicht → zu, auch für F mit freiem Einzel-Limit.
update private.ai_budget set monthly_calls_cap = 38 where feature = 'food_photo';
set local role service_role;
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666'), '{"result": "flag_off"}'::jsonb,
  'globale Aufruf-Obergrenze erreicht → flag_off, kein KI-Aufruf');
reset role;
select is((select count(*) from public.ai_usage where user_id = 'f6f6f6f6-6666-4666-8666-666666666666'), 0::bigint,
  'globale Obergrenze → keine Reservierung');
update private.ai_budget set monthly_calls_cap = 39 where feature = 'food_photo';
set local role service_role;
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666') ->> 'result', 'reserved',
  'unter der globalen Obergrenze → reserviert');
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666'), '{"result": "flag_off"}'::jsonb,
  'laufende Reservierung zählt global mit (fail closed)');
reset role;
-- Kosten-Obergrenze.
update private.ai_budget set monthly_calls_cap = 2000, monthly_cost_eur_cap = 0.01 where feature = 'food_photo';
update public.ai_usage set cost_eur = 0.01
where id = (select id from public.ai_usage where user_id = 'b2b2b2b2-2222-4222-8222-222222222222' limit 1);
set local role service_role;
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666'), '{"result": "flag_off"}'::jsonb,
  'globale Kosten-Obergrenze erreicht → flag_off');
reset role;
-- Ohne Budget-Zeile: zu (fail closed).
delete from private.ai_budget where feature = 'food_photo';
set local role service_role;
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666'), '{"result": "flag_off"}'::jsonb,
  'ohne Budget-Zeile → flag_off');
reset role;
insert into private.ai_budget (feature, monthly_calls_cap, monthly_cost_eur_cap) values ('food_photo', 2000, 10);
delete from public.ai_usage where user_id = 'f6f6f6f6-6666-4666-8666-666666666666';
update public.ai_usage set cost_eur = 0 where cost_eur > 0;

-- ---------------------------------------------------------------------------------------------------------
-- beta_admin: premium_open schalten (nur flag_on/flag_off/status, Antworten ohne Personenbezug)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(public.beta_admin('grant', 'gruender-1', 'open-a@example.test', 30, 'premium_open'),
  '{"result": "invalid_input"}'::jsonb, 'premium_open: keine Freischaltung je Person');
select is(public.beta_admin('flag_off', 'gruender 1; drop', null, 90, 'premium_open'),
  '{"result": "invalid_input"}'::jsonb, 'premium_open: ungültiger GitHub-Name → invalid_input');
select is(public.beta_admin('status', 'gruender-1', null, 90, 'premium_open') - 'accounts',
  '{"result": "status", "flag": "premium_open", "flag_enabled": true, "active_grants": 0,
    "ai_calls_this_month": 38, "ai_cost_eur_this_month": 0, "photo_calls_cap": 2000,
    "photo_cost_eur_cap": 10.00}'::jsonb,
  'premium_open: Status nur Zahlen');
select ok(public.beta_admin('status', 'gruender-1', null, 90, 'premium_open')::text !~ '(open-|@|a1a1)',
  'Status ohne E-Mail und ohne user_id');
select is(public.beta_admin('flag_off', 'gruender-1', null, 90, 'premium_open'), '{"result": "flag_off"}'::jsonb,
  'premium_open aus');
reset role;

-- Aus: nur Beta-Freischaltung zählt.
select ok(not private.has_entitlement_for('a1a1a1a1-1111-4111-8111-111111111111', 'premium'),
  'aus: A ohne Beta → kein premium');
set local role service_role;
select is(pg_temp.reserve('a1a1a1a1-1111-4111-8111-111111111111'), '{"result": "no_entitlement"}'::jsonb,
  'aus: Reservieren ohne Beta → no_entitlement');
select is(public.beta_admin('grant', 'gruender-1', 'open-c@example.test', 30, 'ai_food_photo') ->> 'result',
  'granted', 'Beta-Freischaltung für C');
-- Globale Obergrenze gilt nur in der Testphase: aus → Beta-Konto F reserviert trotz erreichter Obergrenze.
select is(public.beta_admin('grant', 'gruender-1', 'open-f@example.test', 30, 'ai_food_photo') ->> 'result',
  'granted', 'Beta-Freischaltung für F');
reset role;
update private.ai_budget set monthly_calls_cap = 1 where feature = 'food_photo';
set local role service_role;
select is(pg_temp.reserve('f6f6f6f6-6666-4666-8666-666666666666') ->> 'result', 'reserved',
  'aus: globale Obergrenze greift nicht (nur Beta, Einzel-Limits)');
reset role;
select ok(private.has_entitlement_for('c3c3c3c3-3333-4333-8333-333333333333', 'premium'),
  'aus: C mit Beta → premium');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1a1a1a1-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(not public.has_entitlement(), 'aus: has_entitlement() für A = false');
select ok(not public.premium_open_active(), 'aus: premium_open_active() = false (kein Kennzeichen)');
select is(public.ai_food_photo_access(), '{"active": false, "reason": "no_entitlement"}'::jsonb,
  'aus: Foto-Zugang für A → no_entitlement');
reset role;

set local role service_role;
select is(public.beta_admin('flag_on', 'gruender-1', null, 90, 'premium_open'), '{"result": "flag_on"}'::jsonb,
  'premium_open wieder an');
reset role;
select ok(private.has_entitlement_for('a1a1a1a1-1111-4111-8111-111111111111', 'premium'),
  'wieder an: A → premium');
select is(
  (select array_agg(action order by id) from private.admin_actions where flag_key = 'premium_open'),
  array['flag_off', 'flag_on'],
  'Protokoll: jede Schaltung von premium_open in admin_actions');

select * from finish();
rollback;
