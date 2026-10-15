-- Etappe A1a · swap_planned_sessions (docs/PLAN-AUSWERTUNG.md 3, A-G4): zwei eigene geplante Einheiten tauschen –
-- atomar, dieselben Regeln wie der Verschiebe-Trigger für BEIDE Einheiten, fremde Einheiten unsichtbar, ohne 48-h-Regel
-- (Core-Regel, hier ausdrücklich dokumentiert).
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt; der Rollback stellt
-- das Original wieder her): Montag dieser Woche 05.10., Sonntag 11.10., Montag der nächsten Woche 12.10.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- A: alter (ersetzter) Plan und aktiver Plan; B: aktiver Plan.
insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date)
values
  ('aaaaaaaa-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a',
   'Vorlage A für Tests', 1, 1, 'exact', '{}', date '2026-09-01');
insert into public.user_plans (id, user_id, template_id, template_title_de, template_version, engine_version,
  match_quality, inputs, start_date)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', date '2026-09-28'),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', date '2026-09-28');

-- Einheiten von A (aktiver Plan):
--   a1 Mo 05.10. Ganzkörper (verpasst), a2 Mi 07.10. Ganzkörper (heute), a3 Do 08.10. Oberkörper (erledigt),
--   a4 Fr 09.10. Unterkörper, a5 So 11.10. Oberkörper, a6 Mo 12.10. und a7 Mi 14.10. (nächste Woche),
--   a8 Fr 16.10. Erholungswoche, a9 Mo 28.09. und a10 Mi 30.09. (Vorwoche, noch geplant).
-- Alter Plan von A: x1 Sa 10.10. (noch „planned“, gehört aber zu einem ersetzten Plan).
-- B: b1 Fr 09.10.
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, is_deload, template_day_index,
  scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select v.id::uuid, v.plan_id::uuid, v.user_id::uuid, 1, v.week_no, v.is_deload, 1, v.day::date, 'Einheit', v.focus::public.session_focus,
  50, 'Aufwärmen.', 'Ausklingen.'
from (values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-05', 'full_body'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-07', 'full_body'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-08', 'upper'),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-09', 'lower'),
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-11', 'upper'),
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 3, false, '2026-10-12', 'full_body'),
  ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 3, false, '2026-10-14', 'full_body'),
  ('a1000000-0000-4000-8000-000000000008', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 4, true, '2026-10-16', 'full_body'),
  ('a1000000-0000-4000-8000-000000000009', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, false, '2026-09-28', 'full_body'),
  ('a1000000-0000-4000-8000-000000000010', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, false, '2026-09-30', 'full_body'),
  ('a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111', 2, false, '2026-10-10', 'full_body'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 2, false, '2026-10-09', 'full_body')
) as v(id, plan_id, user_id, week_no, is_deload, day, focus);
-- a3 erledigt (setzt nur save_session_log – hier als Eigentümer).
update public.planned_sessions set status = 'completed' where id = 'a1000000-0000-4000-8000-000000000003';

-- Kurzform für Datum/Ursprung/Status einer Einheit (als Eigentümer gelesen).
create or replace function pg_temp.at(p_id uuid) returns text language sql as $$
  select scheduled_on::text || '|' || coalesce(original_date::text, '-') || '|' || status::text
  from public.planned_sessions where id = p_id
$$;

-- Hilfsfunktion nur für diesen Test (Rollback): tauscht mit den Tagen, die der AUFRUFER gerade sieht (RLS) – wie die
-- App, die ihren geprüften Stand mitsendet. Fremde/unbekannte Einheiten → Platzhalter-Tag (scheitert vorher an
-- „nicht gefunden“).
create function public.test_swap(p_a uuid, p_b uuid) returns void language sql as $$
  select public.swap_planned_sessions(
    p_a, p_b,
    coalesce((select ps.scheduled_on from public.planned_sessions ps where ps.id = p_a), date '2000-01-01'),
    coalesce((select ps.scheduled_on from public.planned_sessions ps where ps.id = p_b), date '2000-01-01'))
$$;
-- Fehlercode und hint eines Aufrufs (für die Unterscheidung in der App).
create function public.test_error(p_sql text) returns text language plpgsql as $$
declare
  state text;
  detail_hint text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics state = returned_sqlstate, detail_hint = pg_exception_hint;
  return state || '|' || coalesce(detail_hint, '');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und Form
-- ---------------------------------------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.swap_planned_sessions(uuid, uuid, date, date)', 'execute'),
  'anon darf swap_planned_sessions nicht ausführen'
);
select ok(
  has_function_privilege('authenticated', 'public.swap_planned_sessions(uuid, uuid, date, date)', 'execute'),
  'authenticated darf swap_planned_sessions ausführen'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.swap_planned_sessions(uuid, uuid, date, date)'::regprocedure),
  'security definer mit festem, leerem search_path'
);
select ok(
  not has_function_privilege('public', 'public.swap_planned_sessions(uuid, uuid, date, date)', 'execute'),
  'PUBLIC hat kein Ausführungsrecht'
);
select ok(
  (select position('for no key update' in p.prosrc) > 0 and position('order by ps.id' in p.prosrc) > 0
   from pg_proc p where p.oid = 'public.swap_planned_sessions(uuid, uuid, date, date)'::regprocedure),
  'sperrt beide Zeilen in fester Reihenfolge (FOR NO KEY UPDATE, order by id)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer A
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Warum die Funktion nötig ist: direkt per Update scheitert schon der erste Schritt am Index „nie stapeln“.
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = date '2026-10-09' where id = 'a1000000-0000-4000-8000-000000000002' $$,
  '23505', null, 'ohne Funktion: Einheit auf belegten Tag schieben scheitert am Index (Grund für die Funktion)'
);

-- Erlaubt: heute (Mi) ↔ Fr.
select lives_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  'Tausch Mi ↔ Fr klappt'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-09|2026-10-07|planned', 'Mi-Einheit liegt jetzt am Fr (Ursprung Mi)');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000004'), '2026-10-07|2026-10-09|planned', 'Fr-Einheit liegt jetzt am Mi (Ursprung Fr)');
select is(
  (select count(*)::integer from public.planned_sessions
   where user_id = '11111111-1111-4111-8111-111111111111' and status = 'skipped'),
  0, 'kein Zwischenstand bleibt übrig (keine gestrichene Einheit)'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Zurücktauschen: Daten wieder wie vorher, original_date bleibt (nur beim ERSTEN Verschieben gesetzt).
select lives_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002') $$,
  'Rücktausch (Rückgängig) klappt'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-07|2026-10-07|planned', 'Rücktausch: wieder Mi, Ursprung bleibt Mi');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000004'), '2026-10-09|2026-10-09|planned', 'Rücktausch: wieder Fr, Ursprung bleibt Fr');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Nächste Woche (Mo ↔ Mi) – beide in derselben, künftigen Woche.
select lives_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000007') $$,
  'Tausch in der nächsten Woche klappt'
);

-- 48-h-Regel prüft NUR der Core (validateSwap): Fr (Unterkörper) ↔ So (Oberkörper) legt Oberkörper auf Fr neben die
-- erledigte Oberkörper-Einheit am Do – die Datenbank lässt das zu (dokumentiertes Verhalten, Präzisierung A1a).
select lives_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005') $$,
  'Server prüft die 48-h-Regel NICHT (Core-Regel) – Tausch Fr ↔ So geht durch'
);
select public.test_swap('a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000004');

-- Gesperrt: Vergangenheit (Fr-Einheit käme auf den verpassten Montag).
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004') $$,
  '23514', 'Verschieben nur ab heute und innerhalb derselben Woche.', 'Tausch mit verpasster Einheit (Ziel vor heute) wird abgelehnt'
);
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001') $$,
  '23514', 'Verschieben nur ab heute und innerhalb derselben Woche.', '… auch in umgekehrter Reihenfolge'
);
-- Gesperrt: andere Woche.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006') $$,
  '23514', 'Verschieben nur ab heute und innerhalb derselben Woche.', 'Tausch über die Wochengrenze wird abgelehnt'
);
-- Gesperrt: Erholungswoche.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000008') $$,
  '23514', 'Einheiten der Erholungswoche lassen sich nur streichen, nicht verschieben.', 'Erholungswoche: nur streichen'
);
-- Gesperrt: erledigte Einheit.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003') $$,
  '23514', 'Nur geplante Einheiten lassen sich tauschen.', 'erledigte Einheit ist fest'
);
-- Gesperrt: Einheit eines ersetzten Plans.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a9000000-0000-4000-8000-000000000001') $$,
  '23514', 'Nur Einheiten des aktiven Plans sind änderbar.', 'Einheit eines ersetzten Plans ist fest'
);
-- Gesperrt: Woche vorbei.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000010') $$,
  '23514', 'Diese Woche ist vorbei.', 'vergangene Woche: nichts mehr änderbar'
);
-- Gesperrt: gleiche Einheit bzw. leer.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004') $$,
  '23514', 'Bitte zwei verschiedene Einheiten mit ihren Tagen angeben.', 'gleiche Einheit zweimal wird abgelehnt'
);
select throws_ok(
  $$ select public.test_swap(null, 'a1000000-0000-4000-8000-000000000004') $$,
  '23514', 'Bitte zwei verschiedene Einheiten mit ihren Tagen angeben.', 'leere Einheit wird abgelehnt'
);
-- Fremde Einheit: wie nicht vorhanden.
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001') $$,
  '23514', 'Einheit nicht gefunden.', 'Tausch mit fremder Einheit: „nicht gefunden“'
);
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001') $$,
  '23514', 'Einheit nicht gefunden.', 'unbekannte Einheit: dieselbe Meldung'
);
-- S1: an den geprüften Stand gebunden. Veralteter Stand (App glaubt Fr am Do) → abgelehnt, hint plan_changed.
select throws_ok(
  $$ select public.swap_planned_sessions('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', date '2026-10-07', date '2026-10-08') $$,
  '23514', 'Der Plan hat sich inzwischen geändert.', 'veralteter Stand: erwarteter Tag stimmt nicht → abgelehnt'
);
select is(
  public.test_error($$ select public.swap_planned_sessions('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', date '2026-10-06', date '2026-10-09') $$),
  '23514|plan_changed', 'veralteter Stand: Code 23514, hint plan_changed'
);
select is(
  public.test_error($$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001') $$),
  '23514|not_found', 'fremde Einheit: hint not_found'
);
select is(
  public.test_error($$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000006') $$),
  '23514|move_rules', 'Regelverstoß (andere Woche): hint move_rules'
);
-- Wiederholung nach verlorener Antwort: dieselbe Anfrage zweimal → der zweite Aufruf tauscht NICHT zurück.
select lives_ok(
  $$ select public.swap_planned_sessions('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', date '2026-10-07', date '2026-10-11') $$,
  'Tausch heute (Mi) ↔ Sonntag klappt (Grenzen der Woche)'
);
select throws_ok(
  $$ select public.swap_planned_sessions('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', date '2026-10-07', date '2026-10-11') $$,
  '23514', 'Der Plan hat sich inzwischen geändert.', 'Wiederholung derselben Anfrage wird abgelehnt (kein Rücktausch)'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-11|2026-10-07|planned', 'nach Wiederholung: Mi-Einheit bleibt am So');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000005'), '2026-10-07|2026-10-11|planned', 'nach Wiederholung: So-Einheit bleibt am Mi');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
-- Zweiter Tausch einer schon verschobenen Einheit: original_date bleibt der allererste Tag.
select lives_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  'zweiter Tausch einer schon verschobenen Einheit (So ↔ Fr) klappt'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-09|2026-10-07|planned', 'zweiter Tausch: Ursprung bleibt Mi');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000004'), '2026-10-11|2026-10-09|planned', 'zweiter Tausch: Fr-Einheit am So, Ursprung Fr');
-- Zurück in den Ausgangsstand (als Eigentümer, am Trigger vorbei) für die folgenden Prüfungen.
update public.planned_sessions set status = 'skipped' where id = 'a1000000-0000-4000-8000-000000000002';
update public.planned_sessions set scheduled_on = date '2026-10-09' where id = 'a1000000-0000-4000-8000-000000000004';
update public.planned_sessions set scheduled_on = date '2026-10-11' where id = 'a1000000-0000-4000-8000-000000000005';
update public.planned_sessions set scheduled_on = date '2026-10-07', status = 'planned' where id = 'a1000000-0000-4000-8000-000000000002';
-- Gestrichene Partner-Einheit (H7): eigene gestrichene Einheit am Sa anlegen (gestrichene belegen den Index nicht).
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  status, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
values ('a1000000-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', 1, 2, 1, date '2026-10-10', 'skipped', 'Einheit', 'upper', 50, 'Aufwärmen.', 'Ausklingen.');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000011') $$,
  '23514', 'Nur geplante Einheiten lassen sich tauschen.', 'gestrichene Partner-Einheit ist fest'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000004'), '2026-10-09|2026-10-09|planned', 'nach allen Ablehnungen: Fr-Einheit unverändert');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000001'), '2026-10-05|-|planned', 'verpasste Montags-Einheit unverändert');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000003'), '2026-10-08|-|completed', 'erledigte Einheit unverändert');
select is(pg_temp.at('a9000000-0000-4000-8000-000000000001'), '2026-10-10|-|planned', 'Einheit des ersetzten Plans unverändert');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000006'), '2026-10-14|2026-10-12|planned', 'nächste Woche: Mo-Einheit liegt am Mi');
select is(pg_temp.at('a1000000-0000-4000-8000-000000000007'), '2026-10-12|2026-10-14|planned', 'nächste Woche: Mi-Einheit liegt am Mo');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer B: kann Einheiten von A weder tauschen noch sehen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  '23514', 'Einheit nicht gefunden.', 'B kann zwei Einheiten von A nicht tauschen'
);
select throws_ok(
  $$ select public.test_swap('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002') $$,
  '23514', 'Einheit nicht gefunden.', 'B kann eigene mit fremder Einheit nicht tauschen'
);
select is(
  (select count(*)::integer from public.planned_sessions where user_id = '11111111-1111-4111-8111-111111111111'),
  0, 'B sieht keine Einheiten von A (RLS)'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-07|2026-10-07|planned', 'A-Einheit nach Versuch von B unverändert');
select is(pg_temp.at('b1000000-0000-4000-8000-000000000001'), '2026-10-09|-|planned', 'B-Einheit unverändert');

-- ---------------------------------------------------------------------------------------------------------
-- Nicht angemeldet / anon
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  '42501', 'Nicht angemeldet.', 'ohne Anmeldung (auth.uid() leer) abgelehnt'
);
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.test_swap('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004') $$,
  '42501', null, 'anon: keine Ausführungsrechte'
);
reset role;
select is(pg_temp.at('a1000000-0000-4000-8000-000000000002'), '2026-10-07|2026-10-07|planned', 'nach anon-Versuch unverändert');

select * from finish();
rollback;
