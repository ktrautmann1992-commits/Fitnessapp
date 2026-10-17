-- Ziele · Etappe Z4, Wächter-Auflage zu Z3 N3 (docs/PLAN-ZIELE.md 14): Ein unverändert mitgeführtes Nebenziel, das
-- nicht zum neuen Hauptziel passt, wird beim Ändern des Ziels auf null gesetzt (alter App-Stand ohne Spalte
-- secondary_goal_type) – statt 23514. Ein ausdrücklich neu gesetztes, unpassendes Nebenziel bleibt ein Fehler.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

select has_trigger('public', 'goals', 'goals_clear_stale_secondary', 'Trigger vorhanden');
select is(
  (select prosecdef from pg_proc where oid = 'private.goals_clear_stale_secondary'::regproc), false,
  'läuft mit den Rechten des Aufrufers (kein security definer)'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');
insert into public.goals (goal_type, secondary_goal_type) values ('muscle_gain', 'fat_loss');

-- Alter App-Stand: Upsert ohne secondary_goal_type, neues Hauptziel Abnehmen (Abnehmen → Abnehmen wäre doppelt).
select lives_ok(
  $$ insert into public.goals (goal_type) values ('fat_loss')
     on conflict (user_id) do update set goal_type = excluded.goal_type $$,
  'Upsert ohne Nebenziel-Spalte: kein 23514'
);
select is((select goal_type::text from public.goals), 'fat_loss', 'neues Hauptziel gespeichert');
select is((select secondary_goal_type from public.goals), null, 'unpassendes Nebenziel auf null gesetzt');

-- Passendes Nebenziel bleibt beim Wechsel des Hauptziels stehen.
update public.goals set secondary_goal_type = 'muscle_gain';
update public.goals set goal_type = 'general_fitness';
select is(
  (select secondary_goal_type::text from public.goals), null,
  'Fitness → Muskelaufbau ist verboten → aufgeräumt'
);
update public.goals set goal_type = 'fat_loss', secondary_goal_type = 'endurance', discipline = '10k';
update public.goals set goal_type = 'muscle_gain';
select is(
  (select secondary_goal_type::text || '/' || discipline::text from public.goals), 'endurance/10k',
  'passendes Nebenziel (Muskelaufbau → Ausdauer) und Disziplin bleiben'
);

-- Hauptziel wird das Nebenziel selbst: Nebenziel weg, Disziplin bleibt (Hauptziel Ausdauer).
update public.goals set goal_type = 'endurance';
select is(
  (select coalesce(secondary_goal_type::text, 'null') || '/' || discipline::text from public.goals), 'null/10k',
  'Ausdauer → Ausdauer: Nebenziel null, Disziplin gehört jetzt zum Hauptziel'
);

-- Ausdrücklich neu gesetztes, unpassendes Nebenziel bleibt ein Fehler (Paar-CHECK).
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'general_fitness' $$,
  '23514', null, 'neu gesetztes verbotenes Nebenziel: weiterhin 23514'
);
select throws_ok(
  $$ update public.goals set goal_type = 'definition', secondary_goal_type = 'fat_loss' $$,
  '23514', null, 'Hauptziel und neues verbotenes Nebenziel zusammen: 23514'
);

-- Mit Wunschgewicht: Fällt Abnehmen durch das Aufräumen weg, löscht goals_drop_weight_goal das Wunschgewicht.
reset role;
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at)
select 'health_data', 1, 'Einwilligung Gesundheitsdaten', 'Version 1', now()
where not exists (select 1 from public.consent_documents where consent_type = 'health_data');
set local role authenticated;
insert into public.consents (consent_type, version, platform)
select 'health_data', max(version), 'web' from public.consent_documents where consent_type = 'health_data';
update public.goals set goal_type = 'muscle_gain', secondary_goal_type = 'fat_loss', discipline = null;
insert into public.weight_goals (target_weight_kg, start_date, target_date, amount_mode, time_mode)
values (80, current_date, current_date + 84, 'kg_to_lose', 'weeks');
select is((select count(*)::int from public.weight_goals), 1, 'Wunschgewicht gespeichert');
-- Alter App-Stand wählt Hauptziel Definition (Definition + Abnehmen verboten → Nebenziel weg, kein Abnehmen mehr).
insert into public.goals (goal_type) values ('definition')
on conflict (user_id) do update set goal_type = excluded.goal_type;
select is((select count(*)::int from public.weight_goals), 0, 'ohne Abnehmen kein Wunschgewicht mehr');

select * from finish();
rollback;
