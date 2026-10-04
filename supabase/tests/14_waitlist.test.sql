-- Warteliste (Alpha5): anon/authenticated haben keinerlei Zugriff; nur service_role über die drei Funktionen.
-- Rate-Limit je IP und je E-Mail, Double-Opt-in, Ablauf, Abmelden löscht.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- Hilfswerte: 64-stellige Hex-Hashes
create temporary table h as
select repeat('a', 64) as ip1, repeat('b', 64) as ip2, repeat('c', 64) as mail1, repeat('d', 64) as mail2,
  repeat('1', 64) as tok1, repeat('2', 64) as tok2, repeat('3', 64) as tok3,
  repeat('e', 64) as uns1, repeat('f', 64) as uns2, repeat('9', 64) as uns3;
grant select on h to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.waitlist'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.waitlist_attempts'::regclass),
  'RLS ist auf beiden Tabellen an'
);
select ok(
  not has_table_privilege('anon', 'public.waitlist', 'select')
  and not has_table_privilege('anon', 'public.waitlist', 'insert')
  and not has_table_privilege('authenticated', 'public.waitlist', 'select')
  and not has_table_privilege('authenticated', 'public.waitlist', 'insert')
  and not has_table_privilege('anon', 'public.waitlist_attempts', 'select')
  and not has_table_privilege('authenticated', 'public.waitlist_attempts', 'insert'),
  'anon/authenticated haben keine Tabellenrechte'
);
select ok(
  not has_function_privilege('anon', 'public.waitlist_signup(text, integer, text, text, text, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.waitlist_signup(text, integer, text, text, text, text, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.waitlist_confirm(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.waitlist_unsubscribe(text)', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_signup(text, integer, text, text, text, text, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_confirm(text)', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_unsubscribe(text)', 'execute')
  and not has_function_privilege('anon', 'public.waitlist_cleanup()', 'execute')
  and not has_function_privilege('authenticated', 'public.waitlist_cleanup()', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_cleanup()', 'execute'),
  'Funktionen nur für service_role ausführbar'
);
select is(
  (select proconfig from pg_proc where oid = 'public.waitlist_signup(text, integer, text, text, text, text, timestamptz)'::regprocedure),
  array['search_path=""'], 'waitlist_signup mit leerem search_path'
);

set local role anon;
select throws_ok($$ select * from public.waitlist $$, '42501', null, 'anon kann nicht lesen');
select throws_ok(
  $$ insert into public.waitlist (email, consent_text_version, unsubscribe_token_hash)
     values ('x@example.test', 1, repeat('a', 64)) $$,
  '42501', null, 'anon kann nicht einfügen'
);
select throws_ok(
  $$ select public.waitlist_signup('x@example.test', 1, repeat('a', 64), repeat('b', 64), repeat('c', 64),
       repeat('d', 64), now() + interval '48 hours') $$,
  '42501', null, 'anon kann waitlist_signup nicht aufrufen'
);
select throws_ok($$ select public.waitlist_confirm(repeat('a', 64)) $$, '42501', null,
  'anon kann waitlist_confirm nicht aufrufen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select * from public.waitlist $$, '42501', null, 'authenticated kann nicht lesen');
select throws_ok($$ select * from public.waitlist_attempts $$, '42501', null,
  'authenticated kann Versuche nicht lesen');
select throws_ok(
  $$ insert into public.waitlist (email, consent_text_version, unsubscribe_token_hash)
     values ('x@example.test', 1, repeat('a', 64)) $$,
  '42501', null, 'authenticated kann nicht einfügen'
);
select throws_ok($$ select public.waitlist_unsubscribe(repeat('a', 64)) $$, '42501', null,
  'authenticated kann waitlist_unsubscribe nicht aufrufen');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Ablauf als service_role
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;

select is(
  (select public.waitlist_signup('anna@example.test', 1, ip1, mail1, tok1, uns1, now() + interval '48 hours') from h),
  'send', 'Neuer Eintrag → Mail schicken'
);
select is(
  (select confirmed_at from public.waitlist where email = 'anna@example.test'), null,
  'Eintrag ist noch nicht bestätigt'
);
select is(
  (select public.waitlist_signup('anna@example.test', 1, ip1, mail1, tok2, uns2, now() + interval '48 hours') from h),
  'send', 'Erneut eintragen (unbestätigt) → neues Token, neue Mail'
);
select is((select count(*)::int from public.waitlist where email = 'anna@example.test'), 1,
  'kein doppelter Eintrag');
select is((select public.waitlist_confirm(tok1) from h), 'invalid', 'altes Token gilt nicht mehr');
select is((select public.waitlist_confirm(tok2) from h), 'confirmed', 'neues Token bestätigt');
select isnt((select confirmed_at from public.waitlist where email = 'anna@example.test'), null,
  'confirmed_at gesetzt');
select is((select public.waitlist_confirm(tok2) from h), 'confirmed', 'zweiter Klick: weiterhin bestätigt');
select is(
  (select public.waitlist_signup('anna@example.test', 1, ip1, mail1, tok3, uns3, now() + interval '48 hours') from h),
  'confirmed', 'Bestätigte Adresse erneut eintragen → keine Mail'
);
select throws_ok(
  $$ select public.waitlist_signup('Anna@Example.test', 1, repeat('a', 64), repeat('d', 64), repeat('4', 64),
       repeat('5', 64), now() + interval '48 hours') $$,
  '23514', null, 'E-Mail muss klein geschrieben sein'
);

-- Abgelaufenes Token
insert into public.waitlist (email, consent_text_version, token_hash, token_expires_at, unsubscribe_token_hash)
values ('alt@example.test', 1, repeat('6', 64), now() - interval '1 minute', repeat('7', 64));
select is(public.waitlist_confirm(repeat('6', 64)), 'expired', 'abgelaufenes Token');

-- Rate-Limit je E-Mail (3 pro 24 h; Anna hatte schon 3 Versuche)
select is(
  (select public.waitlist_signup('anna@example.test', 1, ip2, mail1, repeat('8', 64), repeat('0', 64),
     now() + interval '48 hours') from h),
  'rate_limited', 'vierter Versuch für dieselbe E-Mail wird gebremst'
);

-- Rate-Limit je IP (10 pro Stunde): ip2 hatte 1 Versuch, 9 weitere sind erlaubt, der 11. nicht
select is(
  (select count(*)::int from (
     select public.waitlist_signup('person' || n || '@example.test', 1, h.ip2, md5(n::text) || md5('x' || n),
       md5('t' || n) || md5('u' || n), md5('v' || n) || md5('w' || n), now() + interval '48 hours') as r
     from h, generate_series(1, 9) n) s where r = 'send'),
  9, 'bis zu 10 Versuche je IP erlaubt'
);
select is(
  (select public.waitlist_signup('elf@example.test', 1, ip2, mail2, repeat('4', 64), repeat('5', 64),
     now() + interval '48 hours') from h),
  'rate_limited', 'elfter Versuch derselben IP wird gebremst'
);

-- Abmelden löscht
select ok((select public.waitlist_unsubscribe(uns2) from h), 'Abmelden mit gültigem Token');
select is((select count(*)::int from public.waitlist where email = 'anna@example.test'), 0,
  'Eintrag ist gelöscht');

-- Löschfristen: waitlist_cleanup()
insert into public.waitlist (email, consent_text_version, token_hash, token_expires_at, unsubscribe_token_hash)
values ('weg@example.test', 1, repeat('5', 64), now() - interval '1 hour', repeat('4', 64)),
       ('bleibt@example.test', 1, repeat('8', 64), now() + interval '1 hour', repeat('0', 64));
insert into public.waitlist (email, consent_text_version, token_hash, token_expires_at, unsubscribe_token_hash, confirmed_at)
values ('bestaetigt@example.test', 1, repeat('b', 64), now() - interval '10 days', repeat('c', 64), now() - interval '9 days');
insert into public.waitlist_attempts (key_hash, created_at)
values ('ip:' || repeat('f', 64), now() - interval '25 hours');
select ok(public.waitlist_cleanup() >= 2, 'waitlist_cleanup löscht Abgelaufenes');
select is((select count(*)::int from public.waitlist where email = 'weg@example.test'), 0,
  'unbestätigt + abgelaufen → gelöscht');
select is((select count(*)::int from public.waitlist where email in ('bleibt@example.test', 'bestaetigt@example.test')), 2,
  'noch gültige und bestätigte Einträge bleiben');
select is((select count(*)::int from public.waitlist_attempts where created_at < now() - interval '24 hours'), 0,
  'Versuche älter als 24 h → gelöscht');
reset role;

set local role anon;
select throws_ok($$ select public.waitlist_cleanup() $$, '42501', null, 'anon kann waitlist_cleanup nicht aufrufen');
reset role;
select * from finish();
rollback;
