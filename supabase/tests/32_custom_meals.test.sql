-- Etappe E2 · Eigene Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.7): custom_meals, custom_meal_items,
-- save_custom_meal, Tagebuch-Einträge aus eigenen Gerichten (save_food_log_entries), Widerruf, Export, Konto löschen.
-- Rechte (auch anon), security definer, Sperr-Reihenfolge, Login/Profil/Einwilligung health_data, nur bekannte Felder,
-- Grenzen ohne stilles Runden (Name 60, 30 Zutaten, 100 Gerichte, Portionen, Werte, Mengen), nur freigegebene
-- Lebensmittel, idempotent je write_id, optimistische Sperre, Isolation, Fehler ohne Werte und ohne Namen, Schnappschuss
-- im Tagebuch (fester Titel statt Name), Widerruf löscht Gerichte (sichere Voreinstellung E2), Export, Kaskade.
-- „Heute“ = Donnerstag, 15.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(86);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-15'
$$;

-- A: Einwilligung. B: ohne Einwilligung health_data. C: ohne Profil. D: Einwilligung (fremde Person, Isolation).
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform)
select '22222222-2222-4222-8222-222222222222', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) as t;

insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
values
  ('hafer', 1, 'published', 'Hafer', 'other', false, '{gluten}', '{}', '{}', false, false, 2, true, '{}'),
  ('milch', 1, 'published', 'Milch', 'chilled_dairy_eggs', false, '{dairy}', '{dairy}', '{}', false, false, 2, false, '{}'),
  ('banane', 1, 'published', 'Banane', 'fruit_vegetables', false, '{}', '{}', '{}', false, false, 2, false, '{}'),
  ('alt-lm', 1, 'archived', 'Altes Lebensmittel', 'other', false, '{}', '{}', '{}', false, false, 2, false, '{}');

create function pg_temp.uuid(n integer) returns text language sql as $$
  select '00000000-0000-4000-8000-' || lpad(n::text, 12, '0')
$$;
-- Eingabe wie customMealPayloadSchema (packages/core/src/nutrition/custom-meal.ts).
create function pg_temp.direct(
  p_id text, p_write text, p_base integer default null, p_name text default 'Mein Shake',
  p_kcal numeric default 450, p_protein numeric default 30, p_carbs numeric default 50, p_fat numeric default 12.5
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', p_base, 'name_de', p_name, 'mode', 'direct',
    'servings', 1, 'kcal', p_kcal, 'protein_g', p_protein, 'carbs_g', p_carbs, 'fat_g', p_fat, 'items', '[]'::jsonb)
$$;
create function pg_temp.item(p_food text, p_amount numeric, p_unit text default 'g')
returns jsonb language sql as $$
  select jsonb_build_object('food_id', p_food, 'amount', p_amount, 'unit', p_unit)
$$;
create function pg_temp.porridge(
  p_id text, p_write text, p_base integer default null, p_items jsonb default null, p_servings numeric default 1
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', p_base, 'name_de', 'Mein Porridge', 'mode', 'ingredients',
    'servings', p_servings, 'kcal', 459, 'protein_g', 16.8, 'carbs_g', 68.8, 'fat_g', 11.4,
    'items', coalesce(p_items, jsonb_build_array(
      pg_temp.item('hafer', 60), pg_temp.item('milch', 200, 'ml'), pg_temp.item('banane', 1, 'piece'))))
$$;
create function pg_temp.save(p_meal jsonb) returns jsonb language sql as $$
  select public.save_custom_meal(p_meal)
$$;
create function pg_temp.rejected(p_code text) returns jsonb language sql as $$
  select jsonb_build_object('result', 'rejected', 'code', p_code)
$$;
-- Tagebuch-Eintrag aus einem eigenen Gericht (foodLogPayloadEntrySchema).
create function pg_temp.entry(
  p_id text, p_write text, p_meal text, p_title text default 'Eigenes Gericht', p_kcal numeric default 225
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'eaten_on', '2026-10-15', 'slot', 'breakfast',
    'source', 'custom_meal', 'food_id', null, 'recipe_id', null, 'custom_meal_id', p_meal, 'title_de', p_title,
    'amount', null, 'unit', null, 'portion', 0.5, 'kcal', p_kcal, 'protein_g', 15, 'carbs_g', 25, 'fat_g', 6.3)
$$;
create function pg_temp.one(p_entry jsonb) returns jsonb language sql as $$
  select public.save_food_log_entries(jsonb_build_array(p_entry)) -> 0
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte, RLS, security definer, Sperr-Reihenfolge
-- ---------------------------------------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.custom_meals', 'select')
  and has_table_privilege('authenticated', 'public.custom_meals', 'delete')
  and not has_table_privilege('authenticated', 'public.custom_meals', 'insert')
  and not has_table_privilege('authenticated', 'public.custom_meals', 'update')
  and has_table_privilege('authenticated', 'public.custom_meal_items', 'select')
  and not has_table_privilege('authenticated', 'public.custom_meal_items', 'insert')
  and not has_table_privilege('authenticated', 'public.custom_meal_items', 'update')
  and not has_table_privilege('authenticated', 'public.custom_meal_items', 'delete'),
  'authenticated: Gerichte lesen und löschen, Zutaten nur lesen (Schreiben nur über save_custom_meal)'
);
select ok(
  not has_table_privilege('anon', 'public.custom_meals', 'select')
  and not has_table_privilege('anon', 'public.custom_meals', 'delete')
  and not has_table_privilege('anon', 'public.custom_meal_items', 'select')
  and not has_function_privilege('anon', 'public.save_custom_meal(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.save_custom_meal(jsonb)', 'execute'),
  'anon: keine Rechte auf Gerichte und Zutaten, save_custom_meal nicht ausführbar'
);
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.custom_meals'::regclass, 'public.custom_meal_items'::regclass)),
  'RLS auf custom_meals und custom_meal_items'
);
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
   where p.oid = 'public.save_custom_meal(jsonb)'::regprocedure),
  'save_custom_meal: security definer mit festem, leerem search_path'
);
select ok(
  (select position('for share' in p.prosrc) > 0
     and position('for share' in p.prosrc) < position('has_valid_consent' in p.prosrc)
     and position('has_valid_consent' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
     and position('pg_advisory_xact_lock' in p.prosrc) < position('for update' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_custom_meal(jsonb)'::regprocedure),
  'save_custom_meal sperrt die Einwilligung zuerst (FOR SHARE), prüft dann, dann Person, dann Zeilen'
);
select ok(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'delete from public.custom_meals where user_id = new.user_id;', '')))
          / length('delete from public.custom_meals where user_id = new.user_id;') = 2
   from pg_proc p where p.oid = 'private.consents_after_revoke()'::regprocedure),
  'Widerruf löscht eigene Gerichte am Anfang und am Ende (sichere Voreinstellung E2)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Login, Profil, Einwilligung – Ausnahme für den ganzen Aufruf
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Nicht angemeldet.', 'ohne Login abgelehnt');
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok($$ select pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Profil fehlt.', 'ohne Profil abgelehnt');
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$ select pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Einwilligung Gesundheitsdaten fehlt.', 'ohne Einwilligung health_data abgelehnt');
select throws_ok(
  $$ insert into public.custom_meals (user_id, name_de, mode, servings, last_write_id)
     values ('22222222-2222-4222-8222-222222222222', 'Direkt', 'direct', 1, gen_random_uuid()) $$,
  '42501', null, 'direktes Einfügen per API verboten');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern, Idempotenz, optimistische Sperre
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(101))),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1), 'A legt ein Gericht direkt an');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(101))),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1),
  'gleiche Fassung erneut (write_id) = idempotent');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(102), null)),
  jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', pg_temp.uuid(1), 'revision', 1),
  'neu ohne Basis, aber vorhanden → Konflikt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(103), 1, 'Mein Shake XL', 600)),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 2), 'Ändern auf Basis revision 1');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(104), 1)),
  jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', pg_temp.uuid(1), 'revision', 2),
  'veraltete Basis → Konflikt, nichts geschrieben');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(2), pg_temp.uuid(105), 3)),
  jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null),
  'Basis für nicht vorhandenes Gericht → deleted');
select results_eq(
  $$ select name_de, kcal, revision from public.custom_meals where id = pg_temp.uuid(1)::uuid $$,
  $$ values ('Mein Shake XL'::text, 600, 2) $$, 'Name, Werte und revision gespeichert');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(3), pg_temp.uuid(106))),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(3), 'revision', 1), 'Gericht aus 3 Zutaten');
select results_eq(
  $$ select order_no, food_id, amount, unit from public.custom_meal_items where meal_id = pg_temp.uuid(3)::uuid
     order by order_no $$,
  $$ values (1, 'hafer'::text, 60::numeric, 'g'::text), (2, 'milch', 200, 'ml'), (3, 'banane', 1, 'piece') $$,
  'Zutaten in Reihenfolge gespeichert');
select is(
  pg_temp.save(pg_temp.porridge(pg_temp.uuid(3), pg_temp.uuid(107), 1, jsonb_build_array(pg_temp.item('hafer', 80)))),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(3), 'revision', 2), 'Zutaten ändern');
select is((select count(*)::int from public.custom_meal_items where meal_id = pg_temp.uuid(3)::uuid), 1,
  'Ändern ersetzt alle Zutaten');
select is(pg_temp.save(jsonb_set(pg_temp.direct(pg_temp.uuid(4), pg_temp.uuid(108), null, 'Ohne Werte', null,
    null, null, null), '{kcal}', 'null')),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(4), 'revision', 1),
  'direkt ohne Werte (z. B. bei „Kalorienzahlen aus“)');

-- ---------------------------------------------------------------------------------------------------------
-- Grenzen und Form – Ablehnung nur als Code, ohne Werte und ohne Namen
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(5), pg_temp.uuid(201), null, repeat('ä', 60))) ->> 'result',
  'saved', 'Name mit 60 Zeichen erlaubt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(202), null, repeat('ä', 61))),
  pg_temp.rejected('invalid'), 'Name mit 61 Zeichen abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(203), null, '')),
  pg_temp.rejected('invalid'), 'leerer Name abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(204), null, ' Shake')),
  pg_temp.rejected('invalid'), 'Leerzeichen am Anfang abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(205), null, E'Zeile\nZwei')),
  pg_temp.rejected('invalid'), 'Zeilenumbruch (Steuerzeichen) abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(206), null, 'Shake', 3001)),
  pg_temp.rejected('invalid'), 'über 3.000 kcal je Portion abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(6), pg_temp.uuid(207), null, 'Shake', 3000)) ->> 'result',
  'saved', 'genau 3.000 kcal erlaubt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(208), null, 'Shake', 450.5)),
  pg_temp.rejected('invalid'), 'kcal mit Nachkommastelle abgelehnt (kein stilles Runden)');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(209), null, 'Shake', 450, 30.25)),
  pg_temp.rejected('invalid'), 'Eiweiß mit zwei Nachkommastellen abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(210), null, 'Shake', 450, 751)),
  pg_temp.rejected('invalid'), 'Makro über 750 g abgelehnt');
select is(pg_temp.save(jsonb_set(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(211)), '{kcal}', 'null')),
  pg_temp.rejected('invalid'), 'direkt: Makros ohne kcal abgelehnt');
select is(pg_temp.save(jsonb_set(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(212)), '{servings}', '2')),
  pg_temp.rejected('invalid'), 'direkt: nur 1 Portion');
select is(pg_temp.save(jsonb_set(pg_temp.direct(pg_temp.uuid(7), pg_temp.uuid(213)), '{items}',
    jsonb_build_array(pg_temp.item('hafer', 60)))),
  pg_temp.rejected('invalid'), 'direkt: keine Zutaten');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(7), pg_temp.uuid(214), null, '[]'::jsonb)),
  pg_temp.rejected('invalid'), 'aus Zutaten: mindestens eine Zutat');
select is(pg_temp.save(jsonb_set(pg_temp.porridge(pg_temp.uuid(7), pg_temp.uuid(215)), '{fat_g}', 'null')),
  pg_temp.rejected('invalid'), 'aus Zutaten: alle Werte Pflicht');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(7), pg_temp.uuid(216), null,
    (select jsonb_agg(pg_temp.item('hafer', 10)) from generate_series(1, 30)))) ->> 'result',
  'saved', 'genau 30 Zutaten erlaubt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(8), pg_temp.uuid(217), null,
    (select jsonb_agg(pg_temp.item('hafer', 10)) from generate_series(1, 31)))),
  pg_temp.rejected('invalid'), '31 Zutaten abgelehnt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(8), pg_temp.uuid(218), null, null, 20)) ->> 'result',
  'saved', '20 Portionen erlaubt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(219), null, null, 21)),
  pg_temp.rejected('invalid'), '21 Portionen abgelehnt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(220), null, null, 1.5)),
  pg_temp.rejected('invalid'), 'Portionen nur ganz');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(221), null,
    jsonb_build_array(pg_temp.item('hafer', 2001)))),
  pg_temp.rejected('invalid'), 'Zutat über 2.000 g abgelehnt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(222), null,
    jsonb_build_array(pg_temp.item('banane', 0.3, 'piece')))),
  pg_temp.rejected('invalid'), 'Stück nur in halben Schritten ab ½');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(223), null,
    jsonb_build_array(pg_temp.item('gibt-es-nicht', 50)))),
  pg_temp.rejected('invalid'), 'unbekanntes Lebensmittel abgelehnt');
select is(pg_temp.save(pg_temp.porridge(pg_temp.uuid(9), pg_temp.uuid(224), null,
    jsonb_build_array(pg_temp.item('alt-lm', 50)))),
  pg_temp.rejected('invalid'), 'archiviertes Lebensmittel für neue Zutat abgelehnt (nur freigegebene)');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(9), pg_temp.uuid(225)) || '{"user_id": "44444444-4444-4444-8444-444444444444"}'),
  pg_temp.rejected('invalid'), 'unbekanntes Feld (user_id) abgelehnt');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(9), pg_temp.uuid(226)) - 'mode'),
  pg_temp.rejected('invalid'), 'fehlendes Feld abgelehnt');
select is(pg_temp.save('[]'::jsonb), pg_temp.rejected('invalid'), 'kein Objekt abgelehnt');
select ok(
  position('Geheimer Name' in pg_temp.save(pg_temp.direct(pg_temp.uuid(9), pg_temp.uuid(227), null,
    'Geheimer Name', 9999))::text) = 0,
  'Ablehnung enthält weder Namen noch Werte'
);
-- Archiviertes Lebensmittel, das schon im Gericht steckt: Umbenennen bleibt möglich.
reset role;
update public.foods set status = 'archived' where id = 'hafer';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  pg_temp.save(jsonb_set(pg_temp.porridge(pg_temp.uuid(3), pg_temp.uuid(228), 2,
    jsonb_build_array(pg_temp.item('hafer', 80))), '{name_de}', '"Porridge neu"')),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(3), 'revision', 3),
  'archivierte Zutat, die schon im Gericht steckt: Umbenennen geht');
reset role;
update public.foods set status = 'published' where id = 'hafer';
select throws_ok($$ delete from public.foods where id = 'hafer' $$,
  '23503', null, 'Lebensmittel in einem eigenen Gericht lässt sich nicht löschen (on delete restrict)');

-- ---------------------------------------------------------------------------------------------------------
-- Höchstens 100 Gerichte
-- ---------------------------------------------------------------------------------------------------------
insert into public.custom_meals (user_id, name_de, mode, servings, last_write_id)
select '11111111-1111-4111-8111-111111111111', 'Füller ' || i, 'direct', 1, gen_random_uuid()
from generate_series(1, 100 - (select count(*)::int from public.custom_meals
                               where user_id = '11111111-1111-4111-8111-111111111111') - 1) i;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(10), pg_temp.uuid(301))) ->> 'result', 'saved',
  'das 100. Gericht geht');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(11), pg_temp.uuid(302))), pg_temp.rejected('limit'),
  'das 101. Gericht wird abgelehnt (limit)');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(10), pg_temp.uuid(303), 1, 'Geändert')) ->> 'result', 'saved',
  'Ändern geht auch bei 100 Gerichten');
select is((select count(*)::int from public.custom_meals), 100, 'A hat genau 100 Gerichte');

-- ---------------------------------------------------------------------------------------------------------
-- Tagebuch: Eintrag aus eigenem Gericht – fester Titel, Verweis, Schnappschuss
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(501), pg_temp.uuid(601), pg_temp.uuid(1), 'Mein Shake XL')),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(501), 'revision', 1), 'A trägt ½ Portion ein');
select results_eq(
  $$ select title_de, custom_meal_id::text, portion, kcal from public.food_log_entries
     where id = pg_temp.uuid(501)::uuid $$,
  $$ values ('Eigenes Gericht'::text, pg_temp.uuid(1), 0.5::numeric, 225) $$,
  'Titel fest „Eigenes Gericht“ (nie der Name vom Gerät), Verweis und Werte gespeichert');
select is(pg_temp.one(jsonb_set(pg_temp.entry(pg_temp.uuid(502), pg_temp.uuid(602), pg_temp.uuid(1)), '{kcal}',
    'null') || '{"protein_g": null, "carbs_g": null, "fat_g": null}') ->> 'result',
  'saved', 'Eintrag ohne Werte (Gericht ohne Werte) erlaubt');
select is(pg_temp.one(jsonb_set(pg_temp.entry(pg_temp.uuid(503), pg_temp.uuid(603), pg_temp.uuid(1)), '{kcal}', 'null')),
  pg_temp.rejected('invalid'), 'Makros ohne kcal abgelehnt');
select is(pg_temp.one(jsonb_set(pg_temp.entry(pg_temp.uuid(503), pg_temp.uuid(604), pg_temp.uuid(1)), '{portion}', '3.5')),
  pg_temp.rejected('invalid'), 'Portion über 3 abgelehnt');
select is(pg_temp.one(jsonb_build_object(
    'id', pg_temp.uuid(504), 'write_id', pg_temp.uuid(605), 'base_revision', null, 'eaten_on', '2026-10-15',
    'slot', 'other', 'source', 'quick', 'food_id', null, 'recipe_id', null, 'custom_meal_id', pg_temp.uuid(1),
    'title_de', 'Snack', 'amount', null, 'unit', null, 'portion', null, 'kcal', 100, 'protein_g', null,
    'carbs_g', null, 'fat_g', null)),
  pg_temp.rejected('invalid'), 'Verweis auf ein Gericht nur bei Herkunft custom_meal');
select is(pg_temp.one(jsonb_build_object(
    'id', pg_temp.uuid(505), 'write_id', pg_temp.uuid(606), 'base_revision', null, 'eaten_on', '2026-10-15',
    'slot', 'other', 'source', 'quick', 'food_id', null, 'recipe_id', null,
    'title_de', 'Snack', 'amount', null, 'unit', null, 'portion', null, 'kcal', 100, 'protein_g', null,
    'carbs_g', null, 'fat_g', null)) ->> 'result',
  'saved', 'ältere Geräte ohne Feld custom_meal_id bleiben gültig');
-- Gericht ändern: eingetragene Tage behalten ihre Werte (Schnappschuss).
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(109), 2, 'Mein Shake XL', 900)) ->> 'result',
  'saved', 'Gericht auf 900 kcal geändert');
select is((select kcal from public.food_log_entries where id = pg_temp.uuid(501)::uuid), 225,
  'Eintrag behält seine Werte (Schnappschuss)');

-- ---------------------------------------------------------------------------------------------------------
-- Isolation
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.custom_meals) + (select count(*)::int from public.custom_meal_items), 0,
  'D sieht keine Gerichte und Zutaten von A');
select isnt(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(701), null, 'Ds Gericht')) ->> 'id',
  pg_temp.uuid(1), 'fremde id: D bekommt eine neue id');
select is(pg_temp.save(pg_temp.direct(pg_temp.uuid(1), pg_temp.uuid(702), 3, 'Übernommen')),
  jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null),
  'D kann As Gericht nicht ändern');
select lives_ok($$ delete from public.custom_meals where id = pg_temp.uuid(1)::uuid $$,
  'D versucht As Gericht zu löschen');
select is(pg_temp.one(pg_temp.entry(pg_temp.uuid(801), pg_temp.uuid(901), pg_temp.uuid(1))) ->> 'result', 'saved',
  'D trägt mit As Gericht-id ein');
select is((select custom_meal_id from public.food_log_entries where id = pg_temp.uuid(801)::uuid), null,
  'Verweis auf fremdes Gericht wird nicht gespeichert');
reset role;
select results_eq(
  $$ select (select name_de from public.custom_meals where id = pg_temp.uuid(1)::uuid),
            (select count(*)::int from public.custom_meals where user_id = '44444444-4444-4444-8444-444444444444') $$,
  $$ values ('Mein Shake XL'::text, 1) $$,
  'As Gericht unverändert und nicht gelöscht; D hat ein eigenes');

-- ---------------------------------------------------------------------------------------------------------
-- Löschen: eigene Zeilen, auch ohne Einwilligung; Tagebuch behält den Eintrag ohne Verweis
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ delete from public.custom_meals where id = pg_temp.uuid(1)::uuid $$, 'A löscht ein Gericht');
select results_eq(
  $$ select title_de, custom_meal_id, kcal from public.food_log_entries where id = pg_temp.uuid(501)::uuid $$,
  $$ values ('Eigenes Gericht'::text, null::uuid, 225) $$,
  'Tagebuch-Eintrag bleibt mit neutralem Titel und Werten, Verweis leer');
select is((select count(*)::int from public.custom_meal_items where meal_id = pg_temp.uuid(3)::uuid), 1,
  'Zutaten anderer Gerichte bleiben');
select lives_ok($$ delete from public.custom_meals where id = pg_temp.uuid(3)::uuid $$, 'Gericht mit Zutaten löschen');
reset role;
select is((select count(*)::int from public.custom_meal_items where meal_id = pg_temp.uuid(3)::uuid), 0,
  'Zutaten per Kaskade gelöscht');
insert into public.custom_meals (id, user_id, name_de, mode, servings, last_write_id)
values (pg_temp.uuid(30)::uuid, '22222222-2222-4222-8222-222222222222', 'Altbestand', 'direct', 1, gen_random_uuid());
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
delete from public.custom_meals where id = pg_temp.uuid(30)::uuid;
select is((select count(*)::int from public.custom_meals), 0, 'Löschen geht ohne Einwilligung (Recht auf Löschung)');

-- ---------------------------------------------------------------------------------------------------------
-- Export
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok((public.export_my_data() -> 'data') ?& array['custom_meals', 'custom_meal_items'],
  'Export enthält eigene Gerichte und Zutaten');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'custom_meals'),
  (select count(*)::int from public.custom_meals), 'Export: alle eigenen Gerichte von A');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'custom_meal_items'), 33,
  'Export: Zutaten von A (Gerichte mit 30 und 3 Zutaten)');
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((public.export_my_data() -> 'data' -> 'custom_meals' -> 0 ->> 'name_de'), 'Ds Gericht',
  'Export von D: nur das eigene Gericht');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf: Gerichte (samt Zutaten) und Tagebuch von A weg, D unberührt
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.custom_meals where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.custom_meal_items where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.food_log_entries where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.custom_meals where user_id = '44444444-4444-4444-8444-444444444444') $$,
  $$ values (0, 0, 0, 1) $$,
  'Widerruf: alle Gerichte, Zutaten und Einträge von A gelöscht; D unberührt'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select pg_temp.save(pg_temp.direct(pg_temp.uuid(40), pg_temp.uuid(401))) $$,
  '42501', 'Einwilligung Gesundheitsdaten fehlt.', 'nach dem Widerruf kein Anlegen mehr');

-- ---------------------------------------------------------------------------------------------------------
-- Konto löschen: Kaskade
-- ---------------------------------------------------------------------------------------------------------
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is(
  (select count(*)::int from public.custom_meals where user_id = '44444444-4444-4444-8444-444444444444')
  + (select count(*)::int from public.custom_meal_items where user_id = '44444444-4444-4444-8444-444444444444'),
  0, 'Konto löschen: Gerichte und Zutaten per Kaskade weg'
);

select * from finish();
rollback;
