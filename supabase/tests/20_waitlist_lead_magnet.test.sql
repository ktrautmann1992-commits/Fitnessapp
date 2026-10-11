-- Lead-Magnet „20 Rezepte gratis als PDF“ (Migration 20261011120000_waitlist_lead_magnet.sql):
-- Liste (source), Newsletter nur per Double-Opt-in über eine Mail, die ihn nennt (newsletter_opt_in), eigene
-- Bestätigung mit Download-Mail, Newsletter-Double-Opt-in für schon bestätigte Adressen, alle Abmelde-Links
-- bleiben gültig, Zählung ohne personenbezogene Daten, Löschfrist ohne Newsletter, Rechte nur für service_role.
begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und Schema
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.waitlist_stats'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.waitlist_unsubscribe_tokens'::regclass),
  'RLS ist auf waitlist_stats und waitlist_unsubscribe_tokens an'
);
select ok(
  not has_table_privilege('anon', 'public.waitlist_stats', 'select')
  and not has_table_privilege('authenticated', 'public.waitlist_stats', 'select')
  and not has_table_privilege('anon', 'public.waitlist_stats', 'insert')
  and not has_table_privilege('authenticated', 'public.waitlist_stats', 'update')
  and not has_table_privilege('anon', 'public.waitlist_unsubscribe_tokens', 'select')
  and not has_table_privilege('authenticated', 'public.waitlist_unsubscribe_tokens', 'insert'),
  'anon/authenticated haben keine Rechte auf die neuen Tabellen'
);
select ok(
  not has_function_privilege('anon', 'public.lead_magnet_confirm(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.lead_magnet_confirm(text, text)', 'execute')
  and has_function_privilege('service_role', 'public.lead_magnet_confirm(text, text)', 'execute')
  and not has_function_privilege('anon', 'public.waitlist_count(text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.waitlist_count(text, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_count(text, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.waitlist_add_unsubscribe_token(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.waitlist_add_unsubscribe_token(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.waitlist_add_unsubscribe_token(uuid, text)', 'execute'),
  'neue Funktionen nur für service_role'
);
select is(
  (select count(*)::int from pg_proc where proname = 'waitlist_signup' and pronamespace = 'public'::regnamespace),
  1, 'waitlist_signup gibt es genau einmal (keine mehrdeutige Überladung für PostgREST)'
);
select ok(
  (select prosrc from pg_proc where proname = 'waitlist_signup' and pronamespace = 'public'::regnamespace)
    ~ 'on conflict \(email, source\) do nothing',
  'G1: gleichzeitige Erstanfragen ohne Fehler 23505 (Einfügen mit on conflict do nothing)'
);
select is(
  (select array_agg(proconfig::text order by proname) from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('lead_magnet_confirm', 'waitlist_add_unsubscribe_token', 'waitlist_count',
                     'waitlist_unsubscribe', 'waitlist_signup')),
  array_fill('{"search_path=\"\""}'::text, array[5]),
  'alle Funktionen mit leerem search_path'
);
select is(
  (select array_agg(attname::text order by attname) from pg_attribute
   where attrelid = 'public.waitlist_stats'::regclass and attnum > 0 and not attisdropped),
  array['confirmations', 'day', 'signups', 'source'],
  'waitlist_stats enthält nur Datum, Liste und Zahlen'
);

set local role anon;
select throws_ok($$ select * from public.waitlist_stats $$, '42501', null, 'anon kann Zählung nicht lesen');
select throws_ok($$ select * from public.waitlist_unsubscribe_tokens $$, '42501', null,
  'anon kann Abmelde-Token nicht lesen');
select throws_ok($$ select public.lead_magnet_confirm(repeat('a', 64), repeat('b', 64)) $$, '42501', null,
  'anon kann lead_magnet_confirm nicht aufrufen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select * from public.waitlist_stats $$, '42501', null,
  'authenticated kann Zählung nicht lesen');
select throws_ok(
  $$ select public.waitlist_signup('x@example.test', 1, repeat('a', 64), repeat('b', 64), repeat('c', 64),
       repeat('d', 64), now() + interval '48 hours', 'lead-magnet', false) $$,
  '42501', null, 'authenticated kann waitlist_signup nicht aufrufen'
);
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Ablauf als service_role
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;

-- Alter Aufruf mit 7 Parametern geht weiter (Warteliste, kein Newsletter)
select is(
  public.waitlist_signup('alt@example.test', 1, repeat('a', 64), repeat('c', 64), repeat('1', 64),
    repeat('e', 64), now() + interval '48 hours'),
  'send', 'Aufruf ohne neue Parameter → Warteliste'
);
select is(
  (select source || '/' || newsletter_opt_in from public.waitlist where email = 'alt@example.test'),
  'warteliste/false', 'Warteliste: eigener Zweck, kein Newsletter'
);
select throws_ok(
  $$ select public.waitlist_signup('nein@example.test', 1, repeat('b', 64), repeat('0', 64), repeat('4', 64),
       repeat('5', 64), now() + interval '48 hours', 'warteliste', true) $$,
  '22023', null, 'Warteliste mit Newsletter abgelehnt'
);
select throws_ok(
  $$ select public.waitlist_signup('nein@example.test', 1, repeat('b', 64), repeat('0', 64), repeat('4', 64),
       repeat('5', 64), now() + interval '48 hours', 'gewinnspiel', false) $$,
  '22023', null, 'unbekannte Liste abgelehnt'
);
select throws_ok(
  $$ insert into public.waitlist (email, source, newsletter_opt_in, consent_text_version, unsubscribe_token_hash)
     values ('direkt@example.test', 'warteliste', true, 1, repeat('6', 64)) $$,
  '23514', null, 'Prüfregel: Newsletter nur bei den Gratis-Rezepten'
);

-- Gratis-Rezepte OHNE Newsletter (Token 2, Abmelde-Token f)
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('a', 64), repeat('d1', 32), repeat('2', 64),
    repeat('f', 64), now() + interval '48 hours', 'lead-magnet', false),
  'send', 'Gratis-Rezepte ohne Newsletter → Bestätigungs-Mail'
);
select is(
  (select newsletter_opt_in from public.waitlist where email = 'lena@example.test' and source = 'lead-magnet'),
  false, 'ohne Häkchen: newsletter_opt_in = false'
);
-- Dieselbe Adresse zusätzlich auf der Warteliste: eigener Eintrag
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('a', 64), repeat('d2', 32), repeat('3', 64),
    repeat('9', 64), now() + interval '48 hours'),
  'send', 'dieselbe Adresse auch auf der Warteliste'
);
select is((select count(*)::int from public.waitlist where email = 'lena@example.test'), 2,
  'zwei Einträge: je Liste einer');
select is((select newsletter_consent_text_version from public.waitlist
  where email = 'lena@example.test' and source = 'lead-magnet'), null, 'ohne Häkchen: keine Newsletter-Version');

-- B1: Fremde Folgeanfrage MIT Newsletter vor der Bestätigung → neues Token, alter Link (ohne Newsletter) tot.
-- Bestätigt werden kann nur über die neue Mail, die den Newsletter nennt.
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('b', 64), repeat('d3', 32), repeat('5', 64),
    repeat('8', 64), now() + interval '48 hours', 'lead-magnet', true),
  'send', 'Folgeanfrage mit Newsletter → neue Bestätigungs-Mail (nennt den Newsletter)'
);
select is(public.lead_magnet_confirm(repeat('2', 64), repeat('0', 64)) ->> 'result', 'invalid',
  'alter Bestätigungs-Link (Mail ohne Newsletter) gilt nicht mehr');
-- Eigentümerin fordert erneut OHNE Newsletter an → wieder neue Mail, Häkchen wieder aus
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('a', 64), repeat('d4', 32), repeat('7', 64),
    repeat('6', 64), now() + interval '48 hours', 'lead-magnet', false),
  'send', 'dritte Anfrage (ohne Newsletter) → neue Mail'
);
select is(public.lead_magnet_confirm(repeat('5', 64), repeat('0', 64)) ->> 'result', 'invalid',
  'Link aus der Mail mit Newsletter gilt nicht mehr');

-- Bestätigen: Warteliste-Funktion nimmt keine Gratis-Rezepte-Token (und umgekehrt)
select is(public.waitlist_confirm(repeat('7', 64)), 'invalid', 'waitlist_confirm ignoriert Lead-Magnet-Token');
select is(public.lead_magnet_confirm(repeat('3', 64), repeat('0', 64)) ->> 'result', 'invalid',
  'lead_magnet_confirm ignoriert Warteliste-Token');

-- Erstes Bestätigen der neuesten Mail: Adresse zurück (für die Download-Mail), weiteres Abmelde-Token
select set_config('test.ergebnis', public.lead_magnet_confirm(repeat('7', 64), repeat('4', 64))::text, true);
select is(current_setting('test.ergebnis')::jsonb ->> 'result', 'confirmed', 'Gratis-Rezepte bestätigt');
select is(current_setting('test.ergebnis')::jsonb ->> 'email', 'lena@example.test', 'Adresse für die Download-Mail');
select is((current_setting('test.ergebnis')::jsonb ->> 'newsletter_opt_in')::boolean, false,
  'Stand der letzten Anfrage: ohne Newsletter');
-- Zweiter Klick: bestätigt, aber keine Adresse (= keine zweite Mail)
select is(public.lead_magnet_confirm(repeat('7', 64), repeat('0', 64)),
  '{"email": null, "result": "confirmed", "newsletter_opt_in": false}'::jsonb, 'zweiter Klick: keine Mail');

-- B2: Abmelde-Token aller Mails bleiben gültig (f, 8, 6 aus den Anfragen, 4 aus der Download-Mail)
select is(
  (select count(*)::int from public.waitlist_unsubscribe_tokens t
   join public.waitlist w on w.id = t.waitlist_id where w.email = 'lena@example.test' and w.source = 'lead-magnet'),
  3, 'drei weitere Abmelde-Token gespeichert (erstes bleibt in waitlist)'
);

-- Schon bestätigt + erneut angefordert (ohne Häkchen) → Download-Link erneut
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('a', 64), repeat('d5', 32), repeat('c', 64),
    repeat('1', 64), now() + interval '48 hours', 'lead-magnet', false),
  'resend_download', 'bestätigte Adresse fordert erneut an → Download-Link erneut'
);

-- S2: Schon bestätigt + Newsletter-Häkchen NEU → eigenes Double-Opt-in nur für den Newsletter
select is(
  public.waitlist_signup('lena@example.test', 2, repeat('a', 64), repeat('d6', 32), repeat('e', 64),
    repeat('2', 64), now() + interval '48 hours', 'lead-magnet', true),
  'newsletter_confirm', 'Newsletter nachträglich → eigene Bestätigungs-Mail'
);
select is(
  (select newsletter_opt_in from public.waitlist where email = 'lena@example.test' and source = 'lead-magnet'),
  false, 'Newsletter erst nach Bestätigung an'
);
select is(
  (select consent_text_version || '/' || newsletter_consent_text_version from public.waitlist
   where email = 'lena@example.test' and source = 'lead-magnet'),
  '1/2', 'G2: Version der Download-Einwilligung bleibt, Newsletter-Version in eigener Spalte'
);
select is(public.lead_magnet_confirm(repeat('e', 64), repeat('0', 64)),
  '{"email": null, "result": "newsletter", "newsletter_opt_in": true}'::jsonb, 'Newsletter bestätigt, keine Download-Mail');
select is(
  (select newsletter_opt_in::text || '/' || (newsletter_confirmed_at is not null)::text || '/'
     || coalesce(newsletter_token_hash, '-')
   from public.waitlist where email = 'lena@example.test' and source = 'lead-magnet'),
  'true/true/-', 'Newsletter an, Zeitpunkt gespeichert, Token verbraucht'
);
select is(public.lead_magnet_confirm(repeat('e', 64), repeat('0', 64)) ->> 'result', 'invalid',
  'Newsletter-Link nur einmal');
select is(
  public.waitlist_signup('lena@example.test', 1, repeat('a', 64), repeat('d7', 32), repeat('d', 64),
    repeat('3', 64), now() + interval '48 hours', 'lead-magnet', true),
  'resend_download_newsletter', 'mit bestätigtem Newsletter → Download-Link erneut'
);

-- Abgelaufene Newsletter-Bestätigung
insert into public.waitlist (email, source, consent_text_version, token_hash, token_expires_at,
  unsubscribe_token_hash, confirmed_at, newsletter_token_hash, newsletter_token_expires_at)
values ('nl@example.test', 'lead-magnet', 1, repeat('ab', 32), now() - interval '3 days', repeat('cd', 32),
  now() - interval '2 days', repeat('ef', 32), now() - interval '1 minute');
select is(public.lead_magnet_confirm(repeat('ef', 32), repeat('0', 64)) ->> 'result', 'expired',
  'abgelaufene Newsletter-Bestätigung');
-- G3: Aufräumen verwirft abgelaufene Newsletter-Bestätigungen
-- (lead_magnet_confirm hat schon aufgeräumt – daher erneut eine abgelaufene Bestellung anlegen)
update public.waitlist set newsletter_consent_text_version = 1, newsletter_token_hash = repeat('ef', 32),
  newsletter_token_expires_at = now() - interval '1 minute'
where email = 'nl@example.test';
select ok(public.waitlist_cleanup() >= 0, 'waitlist_cleanup läuft (Newsletter-Token)');
select is(
  (select coalesce(newsletter_token_hash, '-') || '/' || coalesce(newsletter_consent_text_version::text, '-')
     || '/' || newsletter_opt_in from public.waitlist where email = 'nl@example.test'),
  '-/-/false', 'G3: abgelaufenes Newsletter-Token und dessen Version geleert, Newsletter bleibt aus'
);

-- Mit Newsletter gleich bei der ersten Anfrage
select is(
  public.waitlist_signup('max@example.test', 1, repeat('b', 64), repeat('7', 64), repeat('6', 64),
    repeat('a1', 32), now() + interval '48 hours', 'lead-magnet', true),
  'send', 'Gratis-Rezepte mit Newsletter'
);
select is(public.lead_magnet_confirm(repeat('6', 64), repeat('a2', 32)) ->> 'newsletter_opt_in', 'true',
  'mit Häkchen bestätigt: Newsletter an');
select isnt(
  (select newsletter_confirmed_at from public.waitlist where email = 'max@example.test'), null,
  'Zeitpunkt der Newsletter-Bestätigung gespeichert'
);
select is(
  (select newsletter_consent_text_version from public.waitlist where email = 'max@example.test'), 1,
  'G2: Newsletter-Version bei Bestellung mit der ersten Anfrage gespeichert'
);
select throws_ok(
  $$ insert into public.waitlist (email, source, newsletter_opt_in, consent_text_version, unsubscribe_token_hash)
     values ('ohneversion@example.test', 'lead-magnet', true, 1, repeat('31', 32)) $$,
  '23514', null, 'G2: Newsletter nur mit Version der Einwilligung'
);

-- Abgelaufen
insert into public.waitlist (email, source, consent_text_version, token_hash, token_expires_at,
  unsubscribe_token_hash)
values ('spaet@example.test', 'lead-magnet', 1, repeat('c', 64), now() - interval '1 minute', repeat('d', 64));
select is(public.lead_magnet_confirm(repeat('c', 64), repeat('e', 64)) ->> 'result', 'expired',
  'abgelaufener Link');

-- Zählung: nur Zahlen pro Tag und Liste
select is(
  (select signups || '/' || confirmations from public.waitlist_stats
   where day = current_date and source = 'lead-magnet'),
  '4/2', 'Lead-Magnet: 4 Anmeldungen (Bestätigungs-Mails), 2 Bestätigungen'
);
select is(
  (select signups || '/' || confirmations from public.waitlist_stats
   where day = current_date and source = 'warteliste'),
  '2/0', 'Warteliste: 2 Anmeldungen, noch keine Bestätigung'
);

-- B2: Abmelden mit dem Link einer ÄLTEREN Mail löscht (nur den Gratis-Rezepte-Eintrag)
select ok(public.waitlist_unsubscribe(repeat('f', 64)), 'Abmelde-Link der allerersten Mail löscht');
select is((select count(*)::int from public.waitlist where email = 'lena@example.test' and source = 'lead-magnet'), 0,
  'Gratis-Rezepte-Eintrag gelöscht');
select is((select count(*)::int from public.waitlist where email = 'lena@example.test' and source = 'warteliste'), 1,
  'Wartelisten-Eintrag derselben Adresse bleibt (eigener Abmelde-Link)');
select is(
  (select count(*)::int from public.waitlist_unsubscribe_tokens where token_hash in (repeat('8', 64), repeat('4', 64))),
  0, 'weitere Abmelde-Token mit gelöscht'
);
select ok(not public.waitlist_unsubscribe(repeat('4', 64)), 'schon gelöscht → false (ehrliche Antwort)');
select ok(public.waitlist_unsubscribe(repeat('a2', 32)), 'Abmelde-Token der Download-Mail löscht');

-- Warteliste: Abmelde-Link der ersten Mail bleibt nach erneutem Eintragen gültig
select is(
  public.waitlist_signup('alt@example.test', 1, repeat('a', 64), repeat('c', 64), repeat('11', 32),
    repeat('12', 32), now() + interval '48 hours'),
  'send', 'Warteliste erneut (unbestätigt)'
);
select ok(public.waitlist_unsubscribe(repeat('12', 32)), 'Abmelde-Link der zweiten Mail löscht');

-- Löschfrist: ohne Newsletter 30 Tage nach Bestätigung, mit Newsletter bleibt
insert into public.waitlist (email, source, newsletter_opt_in, newsletter_consent_text_version,
  consent_text_version, unsubscribe_token_hash, confirmed_at)
values ('ohne@example.test', 'lead-magnet', false, null, 1, repeat('21', 32), now() - interval '31 days'),
       ('mit@example.test', 'lead-magnet', true, 1, 1, repeat('22', 32), now() - interval '31 days'),
       ('jung@example.test', 'lead-magnet', false, null, 1, repeat('23', 32), now() - interval '29 days');
select ok(public.waitlist_cleanup() >= 1, 'waitlist_cleanup läuft');
select is((select count(*)::int from public.waitlist where email = 'ohne@example.test'), 0,
  'ohne Newsletter: nach 30 Tagen gelöscht');
select is((select count(*)::int from public.waitlist where email in ('mit@example.test', 'jung@example.test')), 2,
  'mit Newsletter bzw. jünger als 30 Tage: bleibt');
reset role;

select * from finish();
rollback;
