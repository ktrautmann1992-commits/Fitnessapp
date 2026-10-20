-- Übersicht und Menüleiste anpassen · Etappe E2 (docs/PLAN-EINKAUFEN-AUSDAUER.md 4): app_layout_settings und
-- save_app_layout. Rechte (auch anon), nur eigene Zeile, Login/Profil, nur bekannte Felder und IDs, Regeln der
-- Menüleiste (Übersicht zuerst, Mehr zuletzt, 3–6 Knöpfe, keine Doppel), Kacheln (Form, Doppel, höchstens 20),
-- Ersetzen, kein Gesundheitsdatum (bleibt beim Widerruf), Export, Kaskade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, 1, 'web'
from unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;
create function pg_temp.layout(p_tabs jsonb default '["uebersicht", "today", "einkaufsliste", "mehr"]',
  p_tiles jsonb default '[{"id": "progress", "visible": true}, {"id": "training", "visible": false}]')
returns jsonb language sql as $$
  select jsonb_build_object('dashboard_tiles', p_tiles, 'tab_bar', p_tabs)
$$;
grant execute on function pg_temp.layout(jsonb, jsonb) to authenticated;

-- Rechte
select ok((select relrowsecurity from pg_class where oid = 'public.app_layout_settings'::regclass), 'RLS an');
select ok(has_table_privilege('authenticated', 'public.app_layout_settings', 'select')
          and not has_table_privilege('authenticated', 'public.app_layout_settings', 'insert')
          and not has_table_privilege('authenticated', 'public.app_layout_settings', 'update')
          and not has_table_privilege('authenticated', 'public.app_layout_settings', 'delete'),
  'authenticated: nur lesen (schreiben nur über save_app_layout)');
select ok(not has_table_privilege('anon', 'public.app_layout_settings', 'select'), 'anon: nicht lesbar');
select ok(not has_function_privilege('anon', 'public.save_app_layout(jsonb)', 'execute'),
  'anon: Funktion nicht ausführbar');
select ok((select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
           where p.oid = 'public.save_app_layout(jsonb)'::regprocedure), 'security definer, search_path leer');

set local role authenticated;
select throws_ok($$ select public.save_app_layout(pg_temp.layout()) $$, '42501', 'Nicht angemeldet.',
  'ohne Anmeldung abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.save_app_layout(pg_temp.layout()) $$, '42501', 'Profil fehlt.',
  'ohne Profil abgelehnt');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.save_app_layout(pg_temp.layout()) $$, 'A speichert');
select is((select tab_bar from public.app_layout_settings),
  '["uebersicht", "today", "einkaufsliste", "mehr"]'::jsonb, 'Menüleiste gespeichert');
select lives_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "mehr"]', '[]')) $$,
  '6 Knöpfe (mit Workouts) und keine Kacheln erlaubt');
select is((select count(*)::integer from public.app_layout_settings), 1, 'ersetzt (eine Zeile)');
select is((select jsonb_array_length(tab_bar) from public.app_layout_settings), 6, 'neuer Stand');

-- Regeln
select throws_ok($$ select public.save_app_layout(pg_temp.layout(
  '["uebersicht", "today", "workouts", "ernaehrung", "einkaufsliste", "fortschritt", "mehr"]')) $$, '22023', null,
  '7 Knöpfe abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "mehr"]')) $$, '22023', null,
  '2 Knöpfe abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["today", "uebersicht", "mehr"]')) $$, '22023',
  'Ungültige Menüleiste.', 'Übersicht nicht links abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "today", "ernaehrung"]')) $$,
  '22023', 'Ungültige Menüleiste.', 'ohne Mehr rechts abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "today", "today", "mehr"]')) $$,
  '22023', 'Ungültige Menüleiste.', 'doppelter Knopf abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout('["uebersicht", "raketen", "mehr"]')) $$,
  '22023', 'Ungültiger Bereich.', 'unbekannter Bereich abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout(p_tiles => '[{"id": "raketen", "visible": true}]')) $$,
  '22023', 'Ungültige Kachel.', 'unbekannte Kachel abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout(
  p_tiles => '[{"id": "body", "visible": true}, {"id": "body", "visible": false}]')) $$,
  '22023', 'Kachel doppelt.', 'doppelte Kachel abgelehnt');
select throws_ok($$ select public.save_app_layout(pg_temp.layout(
  p_tiles => '[{"id": "body", "visible": "ja"}]')) $$, '22023', 'Ungültige Kachel.', 'Sichtbarkeit kein bool');
select throws_ok($$ select public.save_app_layout(pg_temp.layout() || '{"extra": 1}') $$, '22023',
  'Ungültige Anordnung.', 'unbekanntes Feld abgelehnt');

-- Isolation, Widerruf, Export
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*)::integer from public.app_layout_settings), 0, 'D sieht die Zeile von A nicht');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select is((select jsonb_array_length(public.export_my_data() -> 'data' -> 'app_layout_settings')), 1,
  'kein Gesundheitsdatum: bleibt beim Widerruf, steht im Export');

reset role;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.app_layout_settings), 0, 'Konto löschen: Zeile weg (Kaskade)');

select * from finish();
rollback;
