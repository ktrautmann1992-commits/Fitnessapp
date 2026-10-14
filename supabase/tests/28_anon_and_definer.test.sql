-- Phase 5 · N7: Allgemeine Schutzprüfungen über ALLE Objekte (Supabase-Advisor, CLAUDE.md „RLS auf JEDER Tabelle“):
-- - anon kann keine Funktion im Schema public ausführen (auch nicht mehr current_consent_version – die App liest die
--   Version vor dem Login direkt aus consent_documents),
-- - anon hat nur Leserecht auf consent_documents (veröffentlichte Einwilligungstexte vor der Registrierung),
-- - jede Tabelle in public hat RLS,
-- - jede security-definer-Funktion hat einen festen, leeren search_path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon kann keine Funktion im Schema public ausführen'
);
select ok(
  not has_function_privilege('anon', 'public.current_consent_version(public.consent_type)', 'execute')
  and has_function_privilege('authenticated', 'public.current_consent_version(public.consent_type)', 'execute')
  and has_function_privilege('service_role', 'public.current_consent_version(public.consent_type)', 'execute'),
  'current_consent_version: nicht anon, weiter authenticated (Einwilligungs-Policy) und service_role'
);
select is(
  (select array_agg(c.relname::text order by c.relname::text) from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
       or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))),
  array['consent_documents'],
  'anon: nur Leserecht auf consent_documents'
);
select ok(
  not has_table_privilege('anon', 'public.consent_documents', 'insert')
  and not has_table_privilege('anon', 'public.consent_documents', 'update'),
  'anon: consent_documents nur lesen'
);
select is_empty(
  $$ select c.relname::text from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'RLS auf jeder Tabelle im Schema public'
);
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosecdef
       and not coalesce(p.proconfig @> array['search_path=""'], false) $$,
  'jede security-definer-Funktion hat search_path = '''''
);

-- Wächter N7 S2: Funktionen, die die Einwilligung prüfen und Gesundheitsbezug speichern, sperren sie vorher
-- (FOR SHARE); der Widerruf sperrt sie zuerst (FOR UPDATE) und löscht Pläne/Listen am Ende noch einmal. Den
-- Ablauf mit zwei gleichzeitigen Verbindungen kann pgTAP (eine Verbindung) nicht abbilden – er ist im Umsetzungsstand
-- N7 beschrieben und im lokalen Harness nachgestellt.
select ok(
  (select bool_and(p.provolatile = 'v' and p.prosrc like '%for share%') from pg_proc p
   where p.oid in ('private.nutrition_health_basis()'::regprocedure, 'private.plan_health_basis()'::regprocedure)),
  'S2: nutrition_health_basis und plan_health_basis sperren die Einwilligung (FOR SHARE, volatile)'
);
select ok(
  (select position('for update' in p.prosrc) > 0
     and position('for update' in p.prosrc) < position('for update of ps' in p.prosrc)
   from pg_proc p where p.oid = 'public.revoke_health_data(boolean)'::regprocedure),
  'S2: revoke_health_data sperrt die Einwilligungen vor den Einheiten'
);
-- Nachprüfung N7 S-N1: append_plan_block sperrt die Einwilligung VOR dem eigenen Plan (user_plans FOR UPDATE) –
-- dieselbe Reihenfolge wie der Widerruf (Einwilligung → Plan-Zeilen), sonst Deadlock (Harness: race.sh append_revoke).
select ok(
  (select position('for share' in p.prosrc) > 0
     and position('for share' in p.prosrc) < position('for update' in p.prosrc)
   from pg_proc p where p.oid = 'public.append_plan_block(uuid, jsonb)'::regprocedure),
  'S-N1: append_plan_block sperrt die Einwilligung (FOR SHARE) vor user_plans (FOR UPDATE)'
);
-- Nachprüfung N7: Essensplan und Einkaufsliste derselben Woche teilen den Advisory-Schlüssel (Person + Woche).
select ok(
  (select bool_and(p.prosrc like '%pg_advisory_xact_lock(hashtext(''nutrition_week|'' || current_user_id::text || ''|'' || week::text))%')
   from pg_proc p
   where p.oid in ('public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure, 'public.replace_shopping_list(jsonb)'::regprocedure)),
  'save_meal_plan und replace_shopping_list nutzen denselben Wochen-Schlüssel'
);
select is(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'delete from public.meal_plans where', '')))
     / length('delete from public.meal_plans where')
   from pg_proc p where p.oid = 'private.consents_after_revoke()'::regprocedure),
  2, 'S2: Widerruf löscht Essenspläne mit Gesundheitsbezug am Ende ein zweites Mal'
);

-- Vor dem Login (anon) liefert die Tabelle dieselbe Version wie die Funktion.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
create temporary table anon_version on commit drop as
  select consent_type, max(version) as version from public.consent_documents group by consent_type;
reset role;
select results_eq(
  $$ select consent_type, version from anon_version order by consent_type $$,
  $$ select t, public.current_consent_version(t) from unnest(enum_range(null::public.consent_type)) as t
     where public.current_consent_version(t) is not null order by t $$,
  'anon liest dieselbe aktuelle Version direkt aus consent_documents'
);

select * from finish();
rollback;
