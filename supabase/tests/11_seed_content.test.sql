-- seed_content(): eine Transaktion, idempotent, nur Freigegebenes, archivieren statt löschen,
-- Vorlage mit unveröffentlichter Übung / Alternative auf sich selbst / Studio-Gerät „Zuhause“ abgelehnt.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

-- Gemeinsame Bausteine (Format der Dateien unter content/, Einheiten zusätzlich mit estimated_minutes).
create temporary table fixture (name text primary key, doc jsonb not null);
insert into fixture (name, doc) values
('texte', '{
  "description_de": "Beschreibung der Übung mit genügend Zeichen.",
  "steps_de": ["Erster Schritt der Übung.", "Zweiter Schritt der Übung."],
  "tips_de": ["Ein hilfreicher Tipp."],
  "common_mistakes_de": ["Ein typischer Fehler."],
  "safety_note_de": "Gewicht so wählen, dass die Technik sauber bleibt.",
  "meta": {"origin": "claude_session", "model": "claude-opus-5-5", "batch_id": null, "created_on": "2026-10-03",
           "expert_reviewed": false, "reviewed_by": "KT", "reviewed_at": "2026-10-03", "review_note": null}
}'),
('kniebeuge', '{"id": "kniebeuge-test", "version": 1, "status": "published", "name_de": "Kniebeuge",
  "name_en": "Squat", "aliases_de": [], "movement_pattern": "squat", "primary_muscles": ["quadriceps", "glutes"],
  "secondary_muscles": ["adductors"], "equipment_ids": ["barbell", "power_rack"], "mechanics": "compound",
  "load_type": "weight", "unilateral": false, "difficulty": 2, "caution_tags": ["spinal_loading"],
  "alternatives": [{"alternative_id": "goblet-test", "reason": "other_equipment", "priority": 1},
                   {"alternative_id": "entwurf-test", "reason": "easier", "priority": 2}]}'),
('goblet', '{"id": "goblet-test", "version": 1, "status": "published", "name_de": "Goblet-Kniebeuge",
  "name_en": "Goblet Squat", "aliases_de": [], "movement_pattern": "squat", "primary_muscles": ["quadriceps"],
  "secondary_muscles": [], "equipment_ids": ["dumbbells"], "mechanics": "compound", "load_type": "weight",
  "unilateral": false, "difficulty": 1, "caution_tags": [],
  "alternatives": [{"alternative_id": "kniebeuge-test", "reason": "harder", "priority": 1}]}'),
('rudern', '{"id": "rudern-test", "version": 1, "status": "published", "name_de": "Rudern mit Band",
  "name_en": "Band Row", "aliases_de": [], "movement_pattern": "horizontal_pull", "primary_muscles": ["upper_back", "lats"],
  "secondary_muscles": ["biceps"], "equipment_ids": ["resistance_bands"], "mechanics": "compound", "load_type": "band",
  "unilateral": false, "difficulty": 1, "caution_tags": [], "alternatives": []}'),
('vorlage', '{"id": "vorlage-test", "version": 1, "status": "published", "title_de": "Testvorlage Zuhause",
  "description_de": "Beschreibung der Vorlage mit genügend Zeichen.", "goal_type": "general_fitness",
  "experience_level": "beginner", "sessions_per_week": 1, "minutes_min": 45, "minutes_max": 60, "location": "home",
  "required_equipment_ids": ["dumbbells", "resistance_bands"], "optional_equipment_ids": ["flat_bench"], "sex": null,
  "meta": {"origin": "claude_session", "model": "claude-opus-5-5", "batch_id": null, "created_on": "2026-10-03",
           "expert_reviewed": false, "reviewed_by": "KT", "reviewed_at": "2026-10-03", "review_note": null},
  "sessions": [{"day_index": 1, "name_de": "Ganzkörper", "focus": "full_body", "estimated_minutes": 48,
    "warmup_de": "5 Minuten locker aufwärmen.", "cooldown_de": "5 Minuten locker auslaufen.",
    "exercises": [
      {"order_no": 1, "exercise_id": "goblet-test", "sets": 3, "reps_min": 8, "reps_max": 12, "duration_s": null,
       "rest_s": 120, "rpe_target": 7, "superset_group": null, "notes_de": null},
      {"order_no": 2, "exercise_id": "rudern-test", "sets": 3, "reps_min": 10, "reps_max": 15, "duration_s": null,
       "rest_s": 90, "rpe_target": 7.5, "superset_group": null, "notes_de": "Schulterblätter zusammenziehen."}]}]}');

-- Übung = Stammdaten + Texte.
create function pg_temp.ex(p_name text) returns jsonb language sql as $$
  select (select doc from fixture where name = 'texte') || (select doc from fixture where name = p_name)
$$;
-- Einspiel-Paket aus Übungen und Vorlagen.
create function pg_temp.pkg(p_exercises jsonb, p_templates jsonb) returns jsonb language sql as $$
  select jsonb_build_object('exercises', p_exercises, 'plan_templates', p_templates)
$$;
create function pg_temp.standard() returns jsonb language sql as $$
  select pg_temp.pkg(
    jsonb_build_array(pg_temp.ex('kniebeuge'), pg_temp.ex('goblet'), pg_temp.ex('rudern')),
    jsonb_build_array((select doc from fixture where name = 'vorlage'))
  )
$$;
-- Gesamter Inhaltsstand als ein Wert (für „zweimal einspielen = derselbe Stand“).
create function pg_temp.snapshot() returns text language sql as $$
  select concat_ws('|',
    (select string_agg(to_jsonb(e)::text, ',' order by id) from public.exercises e),
    (select string_agg(to_jsonb(a)::text, ',' order by exercise_id, alternative_id) from public.exercise_alternatives a),
    (select string_agg(to_jsonb(t)::text, ',' order by id) from public.plan_templates t),
    (select string_agg(to_jsonb(s)::text, ',' order by template_id, day_index) from public.template_sessions s),
    (select string_agg(to_jsonb(x)::text, ',' order by template_id, day_index, order_no) from public.template_exercises x))
$$;
create temporary table state (step text primary key, snap text);

-- Einspielen läuft als service_role; Ergebnisse und Fehler prüfen wir als Datenbank-Eigentümer.
-- Die Testfunktionen liegen in pg_temp des Eigentümers, deshalb wird der Aufruf hier vorbereitet.
create function pg_temp.seed(p jsonb) returns jsonb language plpgsql as $$
declare result jsonb;
begin
  set local role service_role;
  result := public.seed_content(p);
  reset role;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Erstes Einspielen
-- ---------------------------------------------------------------------------------------------------------
select is(
  pg_temp.seed(pg_temp.standard()),
  '{"exercises": 3, "plan_templates": 1, "archived_exercises": 0, "archived_plan_templates": 0}'::jsonb,
  'Einspielen meldet 3 Übungen und 1 Vorlage'
);
select results_eq(
  $$ select exercise_id || '→' || alternative_id from public.exercise_alternatives order by 1 $$,
  array['goblet-test→kniebeuge-test', 'kniebeuge-test→goblet-test'],
  'Alternativen übernommen; Alternative zu einem Entwurf (nicht in der Datenbank) übersprungen'
);
select is((select count(*)::int from public.template_exercises), 2, 'Vorlagen-Übungen eingespielt');
select is((select rpe_target from public.template_exercises where order_no = 2), 7.5::numeric, 'RPE 7,5 übernommen');
select is(
  (select primary_muscles from public.exercises where id = 'kniebeuge-test'),
  array['quadriceps', 'glutes']::public.muscle_group[], 'Enum-Listen übernommen'
);
insert into state values ('erst', pg_temp.snapshot());

-- Zweimal hintereinander → derselbe Stand
select lives_ok($$ select pg_temp.seed(pg_temp.standard()) $$, 'zweites Einspielen läuft');
select is(pg_temp.snapshot(), (select snap from state where step = 'erst'), 'idempotent: derselbe Stand');

-- ---------------------------------------------------------------------------------------------------------
-- Abgelehnte Pakete – danach ist der Stand jeweils unverändert (eine Transaktion)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('goblet'), pg_temp.ex('rudern')),
       jsonb_build_array((select doc from fixture where name = 'vorlage')
         #- '{sessions,0,exercises,1}'
         || jsonb_build_object('sessions', jsonb_build_array(
              ((select doc from fixture where name = 'vorlage') -> 'sessions' -> 0)
              || '{"exercises": [{"order_no": 1, "exercise_id": "kniebeuge-test", "sets": 3, "reps_min": 5, "reps_max": 8,
                   "duration_s": null, "rest_s": 180, "rpe_target": 7, "superset_group": null, "notes_de": null}]}'))))) $$,
  '23503', 'Vorlage vorlage-test enthält eine nicht freigegebene Übung.',
  'Vorlage mit unveröffentlichter Übung wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('goblet') || '{"alternatives": [{"alternative_id": "goblet-test", "reason": "easier", "priority": 1}]}'),
       '[]')) $$,
  '23514', 'Übung goblet-test ist als ihre eigene Alternative eingetragen.',
  'Alternative auf sich selbst wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('goblet') || '{"alternatives": [{"alternative_id": "rudern-test", "reason": "easier", "priority": 1}]}',
                         pg_temp.ex('rudern')),
       '[]')) $$,
  '23514', null, 'Alternative mit anderem Bewegungsmuster wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(jsonb_build_array(pg_temp.ex('goblet') || '{"status": "draft"}'), '[]')) $$,
  '22023', null, 'Entwürfe werden nicht eingespielt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(jsonb_build_array(pg_temp.ex('goblet') || '{"equipment_ids": ["hovercraft"]}'), '[]')) $$,
  '23503', 'Gerät nicht im Katalog: hovercraft', 'unbekanntes Gerät wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('kniebeuge'), pg_temp.ex('goblet'), pg_temp.ex('rudern')),
       jsonb_build_array((select doc from fixture where name = 'vorlage') || '{"optional_equipment_ids": ["cable_station"]}'))) $$,
  '23514', 'Zuhause-Vorlage mit Studio-Gerät: vorlage-test', 'Studio-Gerät in Zuhause-Vorlage wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('goblet'), pg_temp.ex('goblet')), '[]')) $$,
  '23505', null, 'doppelte ID wird abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed('[]') $$, '22023', null, 'kein Objekt → abgelehnt'
);
select throws_ok(
  $$ select pg_temp.seed(pg_temp.pkg(jsonb_build_array(pg_temp.ex('goblet') || '{"difficulty": 7}'), '[]')) $$,
  '23514', null, 'CHECK-Grenzen greifen auch beim Einspielen (Schwierigkeit 1–3)'
);
select is(pg_temp.snapshot(), (select snap from state where step = 'erst'), 'nach allen Fehlern: Stand unverändert');

-- ---------------------------------------------------------------------------------------------------------
-- Versionen und Archivieren
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('kniebeuge'), pg_temp.ex('goblet') || '{"version": 2, "name_de": "Goblet-Kniebeuge neu"}',
                         pg_temp.ex('rudern')),
       jsonb_build_array((select doc from fixture where name = 'vorlage')))) $$,
  'neue Version einspielen'
);
select is((select name_de from public.exercises where id = 'goblet-test'), 'Goblet-Kniebeuge neu', 'Änderung übernommen');
select throws_ok(
  $$ select pg_temp.seed(pg_temp.standard()) $$,
  '23514', 'Version von goblet-test ist kleiner als in der Datenbank.', 'Version darf nicht sinken'
);

select is(
  pg_temp.seed(pg_temp.pkg(
    jsonb_build_array(pg_temp.ex('goblet') || '{"version": 2, "name_de": "Goblet-Kniebeuge neu"}', pg_temp.ex('rudern')),
    jsonb_build_array((select doc from fixture where name = 'vorlage')))),
  '{"exercises": 2, "plan_templates": 1, "archived_exercises": 1, "archived_plan_templates": 0}'::jsonb,
  'nicht mehr mitgelieferte Übung wird archiviert'
);
select is((select status::text from public.exercises where id = 'kniebeuge-test'), 'archived',
  'archiviert statt gelöscht');
select is(
  pg_temp.seed(pg_temp.pkg(
    jsonb_build_array(pg_temp.ex('goblet') || '{"version": 2, "name_de": "Goblet-Kniebeuge neu"}', pg_temp.ex('rudern')),
    '[]')),
  '{"exercises": 2, "plan_templates": 0, "archived_exercises": 0, "archived_plan_templates": 1}'::jsonb,
  'nicht mehr mitgelieferte Vorlage wird archiviert'
);
select is((select count(*)::int from public.template_sessions), 1, 'Einheiten der archivierten Vorlage bleiben erhalten');

-- Sicht eines Nutzers nach dem Archivieren
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select id from public.exercises order by id $$, array['goblet-test', 'rudern-test'],
  'Nutzer sieht nur freigegebene Übungen');
select is_empty($$ select 1 from public.exercise_alternatives $$,
  'Alternativen zur archivierten Übung sind unsichtbar');
select is_empty($$ select 1 from public.plan_templates $$, 'archivierte Vorlage ist unsichtbar');
select throws_ok(
  $$ select public.seed_content('{"exercises": [], "plan_templates": []}') $$,
  '42501', null, 'Nutzer darf seed_content nicht aufrufen'
);
reset role;

-- Wieder freigeben: archivierte Übung kommt zurück, Alternativen werden neu aufgebaut.
select lives_ok(
  $$ select pg_temp.seed(pg_temp.pkg(
       jsonb_build_array(pg_temp.ex('kniebeuge'), pg_temp.ex('goblet') || '{"version": 2, "name_de": "Goblet-Kniebeuge neu"}',
                         pg_temp.ex('rudern')),
       jsonb_build_array((select doc from fixture where name = 'vorlage')))) $$,
  'erneut freigegebene Inhalte einspielen'
);
select is((select status::text from public.exercises where id = 'kniebeuge-test'), 'published',
  'archivierte Übung ist wieder freigegeben');
select is((select count(*)::int from public.exercise_alternatives), 2, 'Alternativen neu aufgebaut');

select * from finish();
rollback;
