-- Nährstoff-Timing 2 (docs/PLAN-NAEHRSTOFF-TIMING.md, Etappe T0): Uhrzeit an der geplanten Einheit
-- (planned_sessions.start_time) und „selbst gewählt“ an der Mahlzeit (meal_plan_items.user_chosen).
-- Geprüft: Spalten, Grenzen (CHECK), Spalten-Rechte, Durchreichen in private.insert_plan_sessions (über
-- save_training_plan), Ändern durch die Person selbst (Trigger-Regeln unverändert, RLS), Mitwandern beim Verschieben
-- und Tauschen, neue Fassung von save_meal_plan (Feld user_chosen) mit unveränderten Rechten.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

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

-- Ausdauer-Einheit wie toSavePlanSession() (packages/core); Tage ab Montag, 12.10. + Versatz; optional mit Uhrzeit.
create function pg_temp.endurance(p_day integer, p_start jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Lockerer Dauerlauf',
    'focus', null, 'endurance_modality', 'run', 'effort_target', 4, 'estimated_minutes', 40,
    'warmup_de', '5 Minuten zügig gehen.', 'cooldown_de', '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
    'exercises', '[]'::jsonb
  ) || case when p_start is null then '{}'::jsonb else jsonb_build_object('start_time', p_start) end
$$;
create function pg_temp.payload(p_sessions jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '["endurance_basic_only"]'::jsonb,
    'uses_health_data', false, 'medical_notice', false,
    'inputs', '{"goalType": "endurance", "discipline": "10k", "experienceLevel": "beginner",
                "schedule": {"mode": "flex", "slots": [{"kind": "endurance", "minutes": 40}, {"kind": "endurance", "minutes": 40}]},
                "trainingLocation": null,
                "homeEquipment": [{"equipmentId": "barbell", "weightsKg": [1.25, 2.5], "barKg": 15}]}'::jsonb,
    'start_date', '2026-10-07', 'sessions', p_sessions
  )
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
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select has_column('public', 'planned_sessions', 'start_time', 'planned_sessions.start_time');
select col_type_is('public', 'planned_sessions', 'start_time', 'time without time zone', 'Uhrzeit ohne Zeitzone');
select col_is_null('public', 'planned_sessions', 'start_time', 'Uhrzeit optional (Altbestand bleibt null)');
select has_column('public', 'meal_plan_items', 'user_chosen', 'meal_plan_items.user_chosen');
select col_not_null('public', 'meal_plan_items', 'user_chosen', 'user_chosen nie null');
select col_default_is('public', 'meal_plan_items', 'user_chosen', 'false', 'user_chosen Standard false');
select ok(
  has_column_privilege('authenticated', 'public.planned_sessions', 'start_time', 'UPDATE'),
  'Person darf die Uhrzeit ändern (Spalten-Recht)'
);
select ok(
  not has_column_privilege('authenticated', 'public.planned_sessions', 'estimated_minutes', 'UPDATE'),
  'andere Spalten bleiben gesperrt'
);
select ok(
  not has_column_privilege('anon', 'public.planned_sessions', 'start_time', 'UPDATE'),
  'anon darf die Uhrzeit nicht ändern'
);
select ok(
  not has_column_privilege('authenticated', 'public.meal_plan_items', 'user_chosen', 'UPDATE'),
  'user_chosen nur über save_meal_plan (kein direktes Update)'
);
select ok(
  has_function_privilege('authenticated', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute'),
  'save_meal_plan: Rechte unverändert'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
   from pg_proc p where p.oid = 'public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure),
  'save_meal_plan: security definer mit leerem search_path'
);
select ok(
  (select position('''user_chosen''' in p.prosrc) > 0
     and position('coalesce((x.v ->> ''user_chosen'')::boolean, false)' in p.prosrc) > 0
   from pg_proc p where p.oid = 'public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure),
  'save_meal_plan kennt user_chosen (fehlt = false)'
);
select ok(
  not has_function_privilege('authenticated', 'private.insert_plan_sessions(uuid, uuid, jsonb, integer, date, date)', 'execute'),
  'insert_plan_sessions bleibt intern'
);

-- ---------------------------------------------------------------------------------------------------------
-- Speichern mit Uhrzeit (private.insert_plan_sessions über save_training_plan)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
    pg_temp.endurance(0, '"24:00"')))) $$),
  '23514: Ungültige Werte im Plan.', 'Uhrzeit 24:00 abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
    pg_temp.endurance(0, '"18:30:15"')))) $$),
  '23514: Ungültige Werte im Plan.', 'Sekunden abgelehnt (nur HH:MM)'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
    pg_temp.endurance(0, '"7:05"')))) $$),
  '23514: Ungültige Werte im Plan.', 'Uhrzeit ohne führende Null abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
    pg_temp.endurance(0, '1830')))) $$),
  '23514: Ungültige Werte im Plan.', 'Uhrzeit als Zahl abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
    pg_temp.endurance(0, '"18:30"') || '{"start_minutes": 1110}'::jsonb))) $$),
  '22023: Unbekanntes Feld in der Eingabe (Einheit).', 'unbekanntes Feld weiter abgelehnt'
);
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       pg_temp.endurance(0, '"18:30"'), pg_temp.endurance(3, 'null'), pg_temp.endurance(5)))) $$,
  'Plan mit Uhrzeit, mit null und ohne Feld gespeichert'
);
select results_eq(
  $$ select scheduled_on, start_time from public.planned_sessions order by scheduled_on $$,
  $$ values (date '2026-10-12', time '18:30'), (date '2026-10-15', null::time), (date '2026-10-17', null::time) $$,
  'Uhrzeit nur an der ersten Einheit, sonst null'
);

-- ---------------------------------------------------------------------------------------------------------
-- Ändern durch die Person selbst (Trigger-Regeln unverändert)
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ update public.planned_sessions set start_time = time '06:45' where scheduled_on = date '2026-10-15' $$,
  'Uhrzeit einer geplanten Einheit setzen'
);
select is(
  (select start_time from public.planned_sessions where scheduled_on = date '2026-10-15'), time '06:45',
  'Uhrzeit gespeichert'
);
select is(
  pg_temp.error_of($$ update public.planned_sessions set start_time = time '07:00:30'
                      where scheduled_on = date '2026-10-15' $$),
  '23514: new row for relation "planned_sessions" violates check constraint "planned_sessions_start_time_check"',
  'Sekunden per Update abgelehnt (CHECK)'
);
select lives_ok(
  $$ update public.planned_sessions set start_time = null where scheduled_on = date '2026-10-17' $$,
  'Uhrzeit wieder entfernen (null) erlaubt'
);
-- Verschieben auf einen freien Tag: die Uhrzeit wandert mit.
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = date '2026-10-13' where scheduled_on = date '2026-10-12' $$,
  'Einheit verschieben'
);
select is(
  (select start_time from public.planned_sessions where scheduled_on = date '2026-10-13'), time '18:30',
  'Uhrzeit wandert beim Verschieben mit'
);
-- Tauschen (public.swap_planned_sessions): jede Einheit behält ihre Uhrzeit.
select lives_ok(
  $$ select public.swap_planned_sessions(
       (select id from public.planned_sessions where scheduled_on = date '2026-10-13'),
       (select id from public.planned_sessions where scheduled_on = date '2026-10-15'),
       date '2026-10-13', date '2026-10-15') $$,
  'zwei Einheiten tauschen'
);
select results_eq(
  $$ select scheduled_on, start_time from public.planned_sessions order by scheduled_on $$,
  $$ values (date '2026-10-13', time '06:45'), (date '2026-10-15', time '18:30'), (date '2026-10-17', null::time) $$,
  'nach dem Tausch: Uhrzeiten hängen an den Einheiten'
);
-- Weiterhin gesperrt: andere Spalten.
select is(
  pg_temp.error_of($$ update public.planned_sessions set estimated_minutes = 90 where scheduled_on = date '2026-10-17' $$),
  '42501: permission denied for table planned_sessions', 'Dauer bleibt gesperrt'
);

-- Erledigte Einheit: Uhrzeit fest (Trigger: nur geplante Einheiten).
reset role;
update public.planned_sessions set status = 'completed' where scheduled_on = date '2026-10-17';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  pg_temp.error_of($$ update public.planned_sessions set start_time = time '09:00' where scheduled_on = date '2026-10-17' $$),
  '23514: Nur Datum und Status einer Einheit sind änderbar.', 'erledigte Einheit: Uhrzeit nicht änderbar'
);

-- ---------------------------------------------------------------------------------------------------------
-- RLS: fremde Einheiten weder lesbar noch änderbar
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is_empty($$ select 1 from public.planned_sessions $$, 'B sieht die Einheiten von A nicht');
update public.planned_sessions set start_time = time '05:00';
reset role;
select is(
  (select count(*)::int from public.planned_sessions where start_time = time '05:00'), 0,
  'Update von B ändert nichts bei A'
);

-- ---------------------------------------------------------------------------------------------------------
-- CHECK auch für den Eigentümer (Grenzen 00:00–23:59, ganze Minuten)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ update public.planned_sessions set start_time = time '24:00' where scheduled_on = date '2026-10-13' $$,
  '23514', null, '24:00 verletzt den CHECK'
);
select lives_ok(
  $$ update public.planned_sessions set start_time = time '23:59' where scheduled_on = date '2026-10-13' $$,
  '23:59 erlaubt'
);
select lives_ok(
  $$ update public.planned_sessions set start_time = time '00:00' where scheduled_on = date '2026-10-13' $$,
  '00:00 erlaubt'
);
select is(
  (select count(*)::int from public.planned_sessions where start_time is not null), 2,
  'Uhrzeiten unverändert vorhanden (Eigentümer-Update betrifft nur eine Zeile)'
);

select * from finish();
rollback;
