-- Etappe E1 · Ernährungstagebuch (docs/PLAN-AUSWERTUNG.md Abschnitt 5, 2.7): save_food_log_entries,
-- delete_food_log_entry, food_log_favorites, Widerruf, Export, Konto löschen; Wächter E1 S1/S2/G1/H1.
-- Login/Profil/Einwilligung health_data, nur bekannte Felder, Datumsfenster (14 Tage zurück, 1 Tag Toleranz), Grenzen
-- ohne stilles Runden, Titel aus dem Katalog, Schnelleintrag nur mit Bezeichnung aus der Liste, idempotent je write_id,
-- optimistische Sperre, höchstens 40 Einträge je Tag, Isolation, Fehler ohne Zeileninhalt, Widerruf löscht Einträge
-- (Favoriten bleiben, A-G14), Export, Kaskade.
-- „Heute“ = Donnerstag, 15.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(82);

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
  ('banane', 1, 'published', 'Banane', 'fruit_vegetables', false, '{}', '{}', '{}', false, false, 2, false, '{}'),
  ('alt-lm', 1, 'archived', 'Altes Lebensmittel', 'other', false, '{}', '{}', '{}', false, false, 2, false, '{}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('porridge', 1, 'published', 'Porridge', '{breakfast}', 1, false, 'vegetarian', false, '{}');

-- Eingabe wie foodLogPayloadEntrySchema (packages/core/src/nutrition/food-log.ts).
create function pg_temp.food(
  p_id text, p_write text, p_base integer default null, p_date text default '2026-10-15',
  p_amount numeric default 60, p_kcal numeric default 222, p_food text default 'hafer'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', p_base, 'eaten_on', p_date, 'slot', 'breakfast',
    'source', 'food', 'food_id', p_food, 'recipe_id', null, 'title_de', 'Vom Gerät', 'amount', p_amount,
    'unit', 'g', 'portion', null, 'kcal', p_kcal, 'protein_g', 8.1, 'carbs_g', 35.2, 'fat_g', 4.2)
$$;
create function pg_temp.quick(p_id text, p_write text, p_label text default 'Auswärts gegessen',
  p_kcal numeric default 700, p_date text default '2026-10-15')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'eaten_on', p_date, 'slot', 'other',
    'source', 'quick', 'food_id', null, 'recipe_id', null, 'title_de', p_label, 'amount', null, 'unit', null,
    'portion', null, 'kcal', p_kcal, 'protein_g', null, 'carbs_g', null, 'fat_g', null)
$$;
create function pg_temp.plan_item(p_id text, p_write text, p_slot text default 'breakfast')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'eaten_on', '2026-10-15', 'slot', p_slot,
    'source', 'plan_item', 'food_id', null, 'recipe_id', 'porridge', 'title_de', 'Porridge', 'amount', null,
    'unit', null, 'portion', 0.75, 'kcal', 390, 'protein_g', 13.5, 'carbs_g', 57.8, 'fat_g', 10.1)
$$;
create function pg_temp.uuid(n integer) returns text language sql as $$
  select '00000000-0000-4000-8000-' || lpad(n::text, 12, '0')
$$;
-- Ergebnis eines einzelnen Eintrags (Wächter E1 S2: je Eintrag ein Ergebnis statt Abbruch des Aufrufs).
create function pg_temp.one(p_entry jsonb) returns jsonb language sql as $$
  select public.save_food_log_entries(jsonb_build_array(p_entry)) -> 0
$$;
create function pg_temp.rejected(p_code text) returns jsonb language sql as $$
  select jsonb_build_object('result', 'rejected', 'code', p_code)
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(
  has_table_privilege('authenticated', 'public.food_log_entries', 'select')
  and not has_table_privilege('authenticated', 'public.food_log_entries', 'insert')
  and not has_table_privilege('authenticated', 'public.food_log_entries', 'update')
  and not has_table_privilege('authenticated', 'public.food_log_entries', 'delete'),
  'Einträge: authenticated darf nur lesen (Schreiben nur über die Funktionen)'
);
select ok(
  not has_function_privilege('anon', 'public.save_food_log_entries(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.delete_food_log_entry(uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.save_food_log_entries(jsonb)', 'execute'),
  'anon darf die Funktionen nicht ausführen'
);
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']) from pg_proc p
   where p.oid in ('public.save_food_log_entries(jsonb)'::regprocedure,
                   'public.delete_food_log_entry(uuid, integer)'::regprocedure)),
  'security definer mit festem, leerem search_path'
);
-- Sperr-Reihenfolge wie revoke_health_data (Wächter N7 S2): Einwilligung FOR SHARE → Person → Eintrags-Zeilen.
select ok(
  (select position('for share' in p.prosrc) > 0
     and position('for share' in p.prosrc) < position('has_valid_consent' in p.prosrc)
     and position('has_valid_consent' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
     and position('pg_advisory_xact_lock' in p.prosrc) < position('for update' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_food_log_entries(jsonb)'::regprocedure),
  'save_food_log_entries sperrt die Einwilligung zuerst (FOR SHARE), prüft dann, dann Person, dann Zeilen'
);
-- Wächter E1 Nachprüfung S1: Schnell-Favoriten sperren die Einwilligung (FOR SHARE), bevor sie geprüft wird.
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
     and position('for share' in p.prosrc) > 0
     and position('for share' in p.prosrc) < position('has_valid_consent' in p.prosrc)
   from pg_proc p where p.oid = 'private.food_log_favorites_before_write()'::regprocedure),
  'Favoriten-Trigger: security definer, Einwilligung FOR SHARE vor der Prüfung'
);
select is(
  (select (length(p.prosrc) - length(replace(p.prosrc, 'delete from public.food_log_entries where', '')))
     / length('delete from public.food_log_entries where')
   from pg_proc p where p.oid = 'private.consents_after_revoke()'::regprocedure),
  2, 'Widerruf löscht Tagebuch-Einträge am Anfang und am Ende (Wächter N7 S2)'
);
select ok(
  (select position('delete from public.food_log_favorites where user_id = new.user_id and source = ''quick''' in p.prosrc) > 0
     and (length(p.prosrc) - length(replace(p.prosrc, 'food_log_favorites', ''))) / length('food_log_favorites') = 1
   from pg_proc p where p.oid = 'private.consents_after_revoke()'::regprocedure),
  'Widerruf löscht nur Schnell-Favoriten (Wächter E1 G1); Katalog-/Rezept-Favoriten bleiben (A-G14)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Login, Profil, Einwilligung – Ausnahme für den GANZEN Aufruf
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Nicht angemeldet.', 'ohne Login abgelehnt'
);
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ select pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Profil fehlt.', 'ohne Profil abgelehnt'
);
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(101))) $$,
  '42501', 'Einwilligung Gesundheitsdaten fehlt.', 'ohne Einwilligung health_data abgelehnt (A-G12)'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
     values ('quick|Snack|5', 'quick', 'Snack', 5) $$,
  '42501', null, 'Schnell-Favorit (mit kcal) ohne Einwilligung health_data abgelehnt (Wächter E1 G1)'
);
select lives_ok(
  $$ insert into public.food_log_favorites (fav_key, source, food_id, title_de, amount, unit)
     values ('food|banane', 'food', 'banane', 'Banane', 1, 'piece') $$,
  'Katalog-Favorit (ohne Werte) geht auch ohne Einwilligung'
);

-- ---------------------------------------------------------------------------------------------------------
-- Speichern, Idempotenz, optimistische Sperre
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.save_food_log_entries(jsonb_build_array(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(101)))),
  jsonb_build_array(jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1)),
  'A trägt Hafer ein (neu, revision 1)'
);
select is(
  (select title_de from public.food_log_entries where id = pg_temp.uuid(1)::uuid),
  'Hafer', 'Titel kommt aus dem Katalog, nie vom Gerät'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(101))),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 1),
  'gleiche write_id erneut → saved, nichts geändert (idempotent)'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(102), 1, '2026-10-15', 80, 296)),
  jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1), 'revision', 2),
  'Ändern auf Basis revision 1 → revision 2'
);
select results_eq(
  $$ select amount, kcal, revision from public.food_log_entries where id = pg_temp.uuid(1)::uuid $$,
  $$ values (80::numeric, 296, 2) $$,
  'Menge und Wert geändert'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(103), 1)),
  jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', pg_temp.uuid(1), 'revision', 2),
  'veraltete revision → conflict mit Server-Stand, nichts geschrieben'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(2), pg_temp.uuid(104), 1)),
  jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null),
  'Ändern eines Eintrags, den es nicht (mehr) gibt → conflict „deleted“ mit id null (Wächter E1 H1)'
);
select is(
  jsonb_array_length(public.save_food_log_entries(jsonb_build_array(
    pg_temp.quick(pg_temp.uuid(3), pg_temp.uuid(105)),
    pg_temp.quick(pg_temp.uuid(4), pg_temp.uuid(106), 'Snack', null),
    pg_temp.plan_item(pg_temp.uuid(5), pg_temp.uuid(107))
  ))),
  3, 'mehrere Einträge in einem Aufruf (Schnelleintrag mit und ohne kcal, Plan-Mahlzeit)'
);
select is(
  (select kcal from public.food_log_entries where id = pg_temp.uuid(4)::uuid), null::integer,
  'Schnelleintrag ohne kcal („Zahlen aus“) gespeichert'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(6), pg_temp.uuid(108), null, '2026-10-15', 60, 222, 'alt-lm')) ->> 'result',
  'saved', 'archiviertes Lebensmittel (früher freigegeben) bleibt eintragbar'
);

-- ---------------------------------------------------------------------------------------------------------
-- Je Eintrag abgelehnt (Wächter E1 S2) – Code ohne Werte, die übrigen Einträge gelten
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.quick(pg_temp.uuid(60), pg_temp.uuid(160), 'Getränk', 50),
    pg_temp.plan_item(pg_temp.uuid(61), pg_temp.uuid(161))
  )),
  jsonb_build_array(
    jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(60), 'revision', 1),
    jsonb_build_object('result', 'conflict', 'reason', 'plan_item_exists', 'id', pg_temp.uuid(5), 'revision', 1)
  ),
  'gültiger Eintrag + doppelte Plan-Mahlzeit (anderes Gerät) im selben Aufruf: gültiger gespeichert, Konflikt mit vorhandener id'
);
select results_eq(
  $$ select (select count(*)::int from public.food_log_entries where id = pg_temp.uuid(60)::uuid),
            (select count(*)::int from public.food_log_entries where id = pg_temp.uuid(61)::uuid) $$,
  $$ values (1, 0) $$,
  '… Getränk gespeichert, zweite Plan-Mahlzeit nicht'
);
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.quick(pg_temp.uuid(62), pg_temp.uuid(162), 'Snack', 3001),
    pg_temp.quick(pg_temp.uuid(63), pg_temp.uuid(163), 'Snack', 20)
  )) -> 1 ->> 'result',
  'saved', 'ein ungültiger Eintrag hält den gültigen danach nicht auf'
);
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109)) || '{"user_id": "44444444-4444-4444-8444-444444444444"}'),
  pg_temp.rejected('invalid'), 'unbekanntes Feld (user_id) abgelehnt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109)) - 'fat_g'),
  pg_temp.rejected('invalid'), 'fehlendes Feld abgelehnt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109), null, '2026-10-15', 60, 222, 'gibt-es-nicht')),
  pg_temp.rejected('invalid'), 'unbekanntes Lebensmittel abgelehnt');
select is(pg_temp.one(pg_temp.quick(pg_temp.uuid(9), pg_temp.uuid(109), 'Geheimer Freitext')),
  pg_temp.rejected('invalid'), 'Schnelleintrag nur mit Bezeichnung aus der Liste (kein Freitext)');
select is(pg_temp.one(pg_temp.quick(pg_temp.uuid(9), pg_temp.uuid(109), 'Snack', 3001)),
  pg_temp.rejected('invalid'), 'über 3.000 kcal abgelehnt (Antwort ohne Wert)');
select is(pg_temp.one(pg_temp.quick(pg_temp.uuid(10), pg_temp.uuid(110), 'Snack', 3000)) ->> 'result',
  'saved', 'genau 3.000 kcal erlaubt');
select is(pg_temp.one(pg_temp.quick(pg_temp.uuid(9), pg_temp.uuid(109), 'Snack', 12.5)),
  pg_temp.rejected('invalid'), 'kcal mit Nachkommastelle abgelehnt (nie still gerundet)');
select is(pg_temp.one(jsonb_set(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109)), '{protein_g}', '1.25')),
  pg_temp.rejected('invalid'), 'Makro mit zwei Nachkommastellen abgelehnt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109), null, '2026-10-15', 2000.5)),
  pg_temp.rejected('invalid'), 'Menge über 2.000 g abgelehnt');
select is(pg_temp.one(jsonb_set(pg_temp.plan_item(pg_temp.uuid(9), pg_temp.uuid(109), 'dinner'), '{portion}', '0.3')),
  pg_temp.rejected('invalid'), 'Portion außerhalb der Viertel-Schritte abgelehnt');
select is(pg_temp.one(jsonb_set(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109)), '{portion}', '1')),
  pg_temp.rejected('invalid'), 'Katalog-Eintrag mit Portion (falsche Form) abgelehnt');
select is(pg_temp.one(pg_temp.plan_item(pg_temp.uuid(9), pg_temp.uuid(109), 'other')),
  pg_temp.rejected('invalid'), 'Plan-Mahlzeit nie auf dem Platz „other“');
select throws_ok(
  $$ select public.save_food_log_entries('[]'::jsonb) $$,
  '22023', 'Ungültige Werte im Ernährungstagebuch.', 'leere Liste: ganzer Aufruf abgelehnt'
);
select throws_ok(
  $$ select public.save_food_log_entries(jsonb_build_array(pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(109)), pg_temp.food(pg_temp.uuid(9), pg_temp.uuid(110)))) $$,
  '22023', 'Ungültige Werte im Ernährungstagebuch.', 'doppelte id in einer Liste: ganzer Aufruf abgelehnt'
);
select throws_ok(
  $$ select public.save_food_log_entries('{"id": 1}'::jsonb) $$,
  '22023', 'Ungültige Werte im Ernährungstagebuch.', 'keine Liste: ganzer Aufruf abgelehnt'
);
select is(
  (select count(*)::int from public.food_log_entries where id = pg_temp.uuid(9)::uuid), 0,
  'abgelehnte Einträge schreiben nichts'
);

-- ---------------------------------------------------------------------------------------------------------
-- Datumsfenster: 14 Tage zurück, 1 Tag Toleranz voraus (Gerätezeit), alte Einträge nicht mehr änderbar
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(11), pg_temp.uuid(111), null, '2026-10-01')) ->> 'result',
  'saved', 'genau 14 Tage zurück erlaubt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(12), pg_temp.uuid(112), null, '2026-09-30')),
  pg_temp.rejected('out_of_range'), '15 Tage zurück abgelehnt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(13), pg_temp.uuid(113), null, '2026-10-16')) ->> 'result',
  'saved', '1 Tag voraus (Zeitzonen-Toleranz) erlaubt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(14), pg_temp.uuid(114), null, '2026-10-17')),
  pg_temp.rejected('out_of_range'), '2 Tage voraus abgelehnt');
select is(pg_temp.one(pg_temp.food(pg_temp.uuid(14), pg_temp.uuid(114), null, 'infinity')),
  pg_temp.rejected('invalid'), 'kein ISO-Datum abgelehnt');
reset role;
-- Alter Eintrag (vor 20 Tagen) als Eigentümer angelegt.
insert into public.food_log_entries (id, user_id, eaten_on, slot, source, title_de, kcal, revision, last_write_id)
values (pg_temp.uuid(15)::uuid, '11111111-1111-4111-8111-111111111111', '2026-09-25', 'other', 'quick', 'Snack', 100, 1,
        pg_temp.uuid(115)::uuid);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(pg_temp.one(jsonb_set(pg_temp.quick(pg_temp.uuid(15), pg_temp.uuid(116), 'Snack', 120), '{base_revision}', '1')),
  pg_temp.rejected('out_of_range'), 'Eintrag älter als 14 Tage nicht mehr änderbar (auch nicht auf heute)');
select is(
  public.delete_food_log_entry(pg_temp.uuid(15)::uuid, 1),
  jsonb_build_object('result', 'ok', 'id', pg_temp.uuid(15), 'revision', null),
  'alter Eintrag lässt sich löschen'
);

-- ---------------------------------------------------------------------------------------------------------
-- Höchstens 40 Einträge je Tag
-- ---------------------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from jsonb_array_elements(public.save_food_log_entries(
     (select jsonb_agg(pg_temp.quick(pg_temp.uuid(1000 + i), pg_temp.uuid(2000 + i), 'Snack', 10, '2026-10-14'))
      from generate_series(1, 40) i))) r where r ->> 'result' = 'saved'),
  40, '40 Einträge an einem Tag erlaubt'
);
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.quick(pg_temp.uuid(1041), pg_temp.uuid(2041), 'Snack', 10, '2026-10-14'),
    pg_temp.quick(pg_temp.uuid(1042), pg_temp.uuid(2042), 'Snack', 10, '2026-10-13')
  )),
  jsonb_build_array(
    pg_temp.rejected('day_full'),
    jsonb_build_object('result', 'saved', 'id', pg_temp.uuid(1042), 'revision', 1)
  ),
  'der 41. Eintrag am selben Tag abgelehnt, ein Eintrag an einem anderen Tag im selben Aufruf gespeichert'
);
select throws_ok(
  $$ select public.save_food_log_entries(
       (select jsonb_agg(pg_temp.quick(pg_temp.uuid(3000 + i), pg_temp.uuid(4000 + i), 'Snack', 10, '2026-10-12'))
        from generate_series(1, 41) i)) $$,
  '22023', 'Ungültige Werte im Ernährungstagebuch.', 'höchstens 40 Einträge je Aufruf'
);

-- ---------------------------------------------------------------------------------------------------------
-- Isolation: D sieht nur eigene Zeilen, fremde ids werden nie überschrieben
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(
  (select count(*)::int from public.food_log_entries), 0, 'D sieht keine Einträge von A (RLS)'
);
select is(
  pg_temp.one(pg_temp.food(pg_temp.uuid(1), pg_temp.uuid(201))) ->> 'result',
  'saved', 'D sendet eine id, die A gehört → gespeichert'
);
select isnt(
  (select id::text from public.food_log_entries), pg_temp.uuid(1),
  '… aber unter einer neuen id (A unverändert)'
);
select is(
  public.delete_food_log_entry(pg_temp.uuid(1)::uuid, 2),
  jsonb_build_object('result', 'ok', 'id', pg_temp.uuid(1), 'revision', null),
  'D „löscht“ den Eintrag von A → ok ohne Wirkung'
);
reset role;
select results_eq(
  $$ select revision, kcal from public.food_log_entries where id = pg_temp.uuid(1)::uuid $$,
  $$ values (2, 296) $$,
  'Eintrag von A unverändert'
);

-- ---------------------------------------------------------------------------------------------------------
-- Löschen mit revision
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.delete_food_log_entry(pg_temp.uuid(1)::uuid, 1),
  jsonb_build_object('result', 'conflict', 'id', pg_temp.uuid(1), 'revision', 2),
  'Löschen mit veralteter revision → conflict'
);
select is(
  public.delete_food_log_entry(pg_temp.uuid(1)::uuid, 2),
  jsonb_build_object('result', 'ok', 'id', pg_temp.uuid(1), 'revision', null),
  'Löschen mit aktueller revision → ok'
);
select is(
  public.delete_food_log_entry(pg_temp.uuid(1)::uuid, 2),
  jsonb_build_object('result', 'ok', 'id', pg_temp.uuid(1), 'revision', null),
  'erneut löschen → ok (idempotent)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Favoriten (direkt per PostgREST): kein Freitext, keine freien Werte bei Katalog/Rezept (Wächter E1 S1)
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
     values ('quick|Auswärts gegessen|700', 'quick', 'Auswärts gegessen', 700) $$,
  'A setzt einen Stern (Schnelleintrag 700 kcal, mit Einwilligung)'
);
select lives_ok(
  $$ insert into public.food_log_favorites (fav_key, source, recipe_id, title_de, portion)
     values ('recipe|porridge', 'recipe', 'porridge', 'Freitext: Essanfall nach Streit', 1) $$,
  'Rezept-Favorit mit Freitext-Titel: angenommen …'
);
select is(
  (select title_de from public.food_log_favorites where fav_key = 'recipe|porridge'),
  'Porridge', '… aber der Titel kommt aus dem Katalog (Freitext überschrieben)'
);
select lives_ok(
  $$ update public.food_log_favorites set title_de = 'Freitext: nochmal' where fav_key = 'recipe|porridge' $$,
  'Ändern des Titels per API …'
);
select is(
  (select title_de from public.food_log_favorites where fav_key = 'recipe|porridge'),
  'Porridge', '… bleibt beim Katalog-Titel'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, food_id, title_de, amount, unit, kcal, protein_g, carbs_g, fat_g)
     values ('food|hafer', 'food', 'hafer', 'Hafer', 60, 'g', 9, 1, 1, 1) $$,
  '23514', null, 'Katalog-Favorit mit kcal abgelehnt (Werte nicht frei speicherbar)'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
     values ('quick|Freitext|5', 'quick', 'Freitext', 5) $$,
  '23514', null, 'Schnell-Favorit nur mit fester Bezeichnung'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
     values ('quick|Snack|1', 'quick', 'Snack', 700) $$,
  '23514', null, 'Schlüssel muss zum Inhalt passen'
);
select throws_ok(
  $$ insert into public.food_log_favorites (user_id, fav_key, source, title_de, kcal)
     values ('44444444-4444-4444-8444-444444444444', 'quick|Snack|5', 'quick', 'Snack', 5) $$,
  '42501', null, 'kein Favorit für eine andere Person'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
       select 'quick|Snack|' || i, 'quick', 'Snack', i from generate_series(1, 99) i $$,
  '23514', 'Zu viele Favoriten.', 'höchstens 100 Favoriten'
);
-- Wächter E1 Nachprüfung H1: Verstöße melden keine Werte (kein „Failing row contains (…)“ in Meldung oder DETAIL).
create function pg_temp.fav_error(p_sql text) returns text language plpgsql as $f$
declare
  msg text;
  detail text;
begin
  execute p_sql;
  return 'kein Fehler';
exception when others then
  get stacked diagnostics msg = message_text, detail = pg_exception_detail;
  return sqlstate || ' ' || msg || ' | ' || coalesce(detail, '');
end;
$f$;
select is(
  pg_temp.fav_error($$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
                       values ('quick|Süßes|4250', 'quick', 'Süßes', 4250) $$),
  '23514 Ungültiger Favorit. | ', 'ungültiger Schnell-Favorit: Meldung ohne Werte, ohne DETAIL'
);
select is(
  pg_temp.fav_error($$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
                       values ('quick|Süßes|250', 'quick', null, 250) $$),
  '23514 Ungültiger Favorit. | ', 'fehlende Bezeichnung (NOT NULL): Meldung ohne Werte, ohne DETAIL'
);
select is(
  pg_temp.fav_error($$ update public.food_log_favorites set kcal = 9 where fav_key = 'recipe|porridge' $$),
  '23514 Ungültiger Favorit. | ', 'Ändern eines Rezept-Favoriten auf kcal: Meldung ohne Werte'
);
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, food_id, title_de, amount, unit)
     values ('food|hafer', 'food', 'hafer', 'Hafer', 60, 'g') $$,
  '42501', null, 'ohne Profil keine Favoriten'
);
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.food_log_favorites), 0, 'D sieht keine Favoriten von A');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf: Einträge und Schnell-Favoriten weg, Katalog-/Rezept-Favoriten bleiben; fremde Einträge bleiben
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.food_log_entries where user_id = '11111111-1111-4111-8111-111111111111'),
            (select string_agg(fav_key, ',' order by fav_key) from public.food_log_favorites
             where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.food_log_entries where user_id = '44444444-4444-4444-8444-444444444444') $$,
  $$ values (0, 'recipe|porridge', 1) $$,
  'Widerruf: alle Tagebuch-Einträge und Schnell-Favoriten von A gelöscht, Rezept-Favorit bleibt (G1/A-G14), D unberührt'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select pg_temp.one(pg_temp.food(pg_temp.uuid(20), pg_temp.uuid(120))) $$,
  '42501', 'Einwilligung Gesundheitsdaten fehlt.', 'nach dem Widerruf kein Eintragen mehr'
);
select throws_ok(
  $$ insert into public.food_log_favorites (fav_key, source, title_de, kcal)
     values ('quick|Snack|5', 'quick', 'Snack', 5) $$,
  '42501', null, 'nach dem Widerruf keine Schnell-Favoriten mehr'
);

-- ---------------------------------------------------------------------------------------------------------
-- Export und Konto löschen
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (public.export_my_data() -> 'data') ?& array['food_log_entries', 'food_log_favorites'],
  'Export enthält Tagebuch und Favoriten'
);
select is(
  jsonb_array_length(public.export_my_data() -> 'data' -> 'food_log_favorites'), 1, 'Export: eigene Favoriten'
);
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(
  jsonb_array_length(public.export_my_data() -> 'data' -> 'food_log_entries'), 1, 'Export von D: eigener Eintrag'
);
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is(
  (select count(*)::int from public.food_log_entries where user_id = '44444444-4444-4444-8444-444444444444'), 0,
  'Konto löschen: Einträge per Kaskade weg'
);

select * from finish();
rollback;
