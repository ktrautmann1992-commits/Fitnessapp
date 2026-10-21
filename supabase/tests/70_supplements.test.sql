-- Supplement-Inhalte (docs/PLAN-PHASE-6.md 7.2, Etappe SU3; Migrationen 20261021130000/…130100): Tabelle supplements
-- (RLS: nur published für authenticated, anon nichts, schreiben nur seed_supplements) und seed_supplements (nur
-- service_role, Testphase-Schalter, nur bekannte IDs, Versionen, archivieren statt löschen, idempotent, Prüfer-Namen
-- neutralisiert, Koffein ohne Stufe).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01');

-- Baustein im Format von content/supplements/*.json (packages/core/src/content/supplement-schema.ts).
create function pg_temp.supp(
  p_id text, p_version integer default 1, p_expert boolean default false, p_status text default 'published',
  p_evidence text default 'a', p_category text default 'sport'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'version', p_version, 'status', p_status, 'name_de', 'Supplement ' || p_id,
    'evidence_level', p_evidence, 'category', p_category,
    'summary_de', 'Kurzbeschreibung mit genug Zeichen.', 'how_to_de', null, 'claim_ids', '[]'::jsonb,
    'sources', '[]'::jsonb, 'not_recommended_reason_de', null,
    'meta', jsonb_build_object('origin', 'claude_session', 'model', 'claude-opus-5-5', 'batch_id', null,
      'created_on', '2026-10-19', 'expert_reviewed', p_expert, 'reviewed_by', 'Prüferin GF',
      'reviewed_at', '2026-10-21', 'review_note', 'Interner Vermerk GF')
  )
$$;
create function pg_temp.pkg(variadic p_items jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('supplements', coalesce(to_jsonb(p_items), '[]'::jsonb))
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
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Tabelle, Rechte, RLS
-- ---------------------------------------------------------------------------------------------------------
select has_table('public', 'supplements', 'Tabelle supplements vorhanden');
select ok((select relrowsecurity from pg_class where oid = 'public.supplements'::regclass),
  'RLS auf supplements aktiv');
select is((select attgenerated::text from pg_attribute
           where attrelid = 'public.supplements'::regclass and attname = 'expert_reviewed'), 's',
  'expert_reviewed wird aus data berechnet (nicht beschreibbar)');
select is(enum_range(null::public.supplement_id)::text[],
  array['creatine', 'caffeine', 'protein_powder', 'vitamin_d', 'omega3'], 'Aufzählung supplement_id = SUPPLEMENT_IDS');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('entwurf_x', 1, 'draft', 'Entwurf', 'a', 'sport', '{}') $$,
  '23514', null, 'Entwürfe nie in der Datenbank (CHECK)');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('caffeine', 1, 'published', 'Koffein', 'a', 'safety_info', '{}') $$,
  '23514', null, 'Koffein hat keine Stufe (CHECK)');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('creatine', 1, 'published', 'Kreatin', null, 'sport', '{}') $$,
  '23514', null, 'alle außer Koffein haben eine Stufe (CHECK)');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('bcaa', 1, 'published', 'BCAA', 'c', 'safety_info', '{}') $$,
  '23514', null, 'Kategorie „Sicherheits-Info“ nur für Koffein (CHECK)');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('Kreatin-X', 1, 'published', 'Kreatin', 'a', 'sport', '{}') $$,
  '23514', null, 'ID nur Kleinbuchstaben, Ziffern und Unterstrich (CHECK)');

set local role anon;
select throws_ok($$ select count(*) from public.supplements $$, '42501', null, 'anon liest keine Supplemente');
select throws_ok($$ select public.seed_supplements('{"supplements": []}') $$, '42501', null,
  'anon darf nicht einspielen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.seed_supplements('{"supplements": []}') $$, '42501', null,
  'angemeldete Nutzer dürfen nicht einspielen');
select throws_ok($$ insert into public.supplements (id, version, status, name_de, evidence_level, category, data)
    values ('creatine', 1, 'published', 'Kreatin', 'a', 'sport', '{}') $$,
  '42501', null, 'angemeldete Nutzer schreiben nicht direkt');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- seed_supplements (service_role)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select alike(pg_temp.error_of($$ select public.seed_supplements('{"supplements": [], "x": 1}') $$),
  '22023:%', 'unbekannter Schlüssel im Paket → abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine', p_status => 'draft'))) $$),
  '22023: Nur freigegebene Inhalte%', 'Entwurf im Paket → abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('probelauf_creatine'))) $$),
  '22023: Unbekanntes Supplement: probelauf_creatine', 'unbekannte ID (Probelauf) → abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine'), pg_temp.supp('creatine'))) $$),
  '23505:%', 'doppelte ID → abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine'))) $$),
  '23514: Supplement creatine ist nicht fachlich geprüft.', 'Livegang-Regel: ohne Fachprüfung abgelehnt (Standard)');
select is(public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine', p_expert => true))),
  '{"supplements": 1, "archived": 0}'::jsonb, 'fachlich geprüft → eingespielt');

-- Testphase: auch ohne Fachprüfung (einspiel-regeln.json „nur_fachlich_geprueft“: false).
select is(public.seed_supplements(pg_temp.pkg(
    pg_temp.supp('creatine', p_expert => true),
    pg_temp.supp('caffeine', p_evidence => null, p_category => 'safety_info'),
    pg_temp.supp('omega3', p_evidence => 'b', p_category => 'diet_season'),
    pg_temp.supp('bcaa', p_evidence => 'c')), false),
  '{"supplements": 4, "archived": 0}'::jsonb, 'Testphase: auch ohne Fachprüfung eingespielt');
select results_eq($$ select id, evidence_level::text, category::text, expert_reviewed from public.supplements order by id $$,
  $$ values ('bcaa', 'c', 'sport', false), ('caffeine', null, 'safety_info', false), ('creatine', 'a', 'sport', true),
            ('omega3', 'b', 'diet_season', false) $$,
  'Spalten aus der Datei, Koffein ohne Stufe, Prüfvermerk aus meta');
select is((select data -> 'meta' ->> 'reviewed_by' from public.supplements where id = 'creatine'), 'redaktion',
  'Prüfer-Name neutralisiert');
select is((select data -> 'meta' -> 'review_note' from public.supplements where id = 'creatine'), 'null'::jsonb,
  'interner Vermerk entfernt');

-- Idempotent: gleicher Lauf ändert nichts (updated_at bleibt).
create temp table before_rerun as select id, updated_at from public.supplements;
select is(public.seed_supplements(pg_temp.pkg(
    pg_temp.supp('creatine', p_expert => true),
    pg_temp.supp('caffeine', p_evidence => null, p_category => 'safety_info'),
    pg_temp.supp('omega3', p_evidence => 'b', p_category => 'diet_season'),
    pg_temp.supp('bcaa', p_evidence => 'c')), false),
  '{"supplements": 4, "archived": 0}'::jsonb, 'erneuter Lauf: gleiche Antwort');
select is((select count(*)::integer from public.supplements s join before_rerun b using (id)
           where s.updated_at <> b.updated_at), 0, 'erneuter Lauf ändert keine Zeile');

-- Version sinkt nie.
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine', p_version => 0, p_expert => true)), false) $$),
  '23514:%', 'Version 0 → abgelehnt (Schema)');
select is(public.seed_supplements(pg_temp.pkg(
    pg_temp.supp('creatine', p_version => 2, p_expert => true),
    pg_temp.supp('caffeine', p_evidence => null, p_category => 'safety_info'),
    pg_temp.supp('omega3', p_evidence => 'b', p_category => 'diet_season'),
    pg_temp.supp('bcaa', p_evidence => 'c')), false),
  '{"supplements": 4, "archived": 0}'::jsonb, 'höhere Version → übernommen');
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(pg_temp.supp('creatine', p_version => 1, p_expert => true)), false) $$),
  '23514: Version von creatine ist kleiner als in der Datenbank.', 'niedrigere Version → abgelehnt');

-- Fehlt ein Eintrag im Paket → archiviert, nicht gelöscht.
select is(public.seed_supplements(pg_temp.pkg(
    pg_temp.supp('creatine', p_version => 2, p_expert => true),
    pg_temp.supp('caffeine', p_evidence => null, p_category => 'safety_info')), false),
  '{"supplements": 2, "archived": 2}'::jsonb, 'fehlende Einträge werden archiviert');
select results_eq($$ select id, status::text from public.supplements order by id $$,
  $$ values ('bcaa', 'archived'), ('caffeine', 'published'), ('creatine', 'published'), ('omega3', 'archived') $$,
  'archiviert statt gelöscht');
reset role;

-- Angemeldete sehen nur freigegebene.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select id from public.supplements order by id $$, $$ values ('caffeine'), ('creatine') $$,
  'authenticated sieht nur freigegebene Supplemente');
select is((select version from public.supplements where id = 'creatine'), 2, 'aktuelle Version lesbar');
reset role;

-- Livegang-Regel wieder an: ein ungeprüfter Eintrag blockiert das ganze Paket (eine Transaktion).
set local role service_role;
select alike(pg_temp.error_of($$ select public.seed_supplements(pg_temp.pkg(
    pg_temp.supp('creatine', p_version => 2, p_expert => true),
    pg_temp.supp('caffeine', p_evidence => null, p_category => 'safety_info'))) $$),
  '23514: Supplement caffeine ist nicht fachlich geprüft.', 'Livegang-Regel: ganzes Paket abgelehnt');
reset role;
select results_eq($$ select id, status::text from public.supplements order by id $$,
  $$ values ('bcaa', 'archived'), ('caffeine', 'published'), ('creatine', 'published'), ('omega3', 'archived') $$,
  'nach Ablehnung unverändert');

select * from finish();
rollback;
