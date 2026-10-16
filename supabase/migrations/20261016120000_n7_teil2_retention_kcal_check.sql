-- Phase 5 · N7 Teil 2: Löschfrist für Essenspläne/Einkaufslisten (G-N7-2) und Mindest-Plausibilität der
-- Tageskalorien in save_meal_plan (G-W3) – Gründer-Entscheidungen vom 16.10.2026 (docs/PLAN-PHASE-5.md
-- „Umsetzungsstand N7 Teil 2“).
--
-- Additiv: neue Hilfsfunktionen; save_meal_plan und replace_shopping_list per `create or replace` mit gleicher Signatur
-- und sonst unverändertem Verhalten wie in 20261014120600_meal_plan_rpcs.sql (Sperr-Reihenfolge Woche → Einwilligung →
-- Plan/Liste bleibt, REVOKE/GRANT erneut).
--
-- 1. Löschfrist (MEAL_PLAN_RETENTION_WEEKS = 4): Gespeichert bleiben die laufende Woche und die vier Wochen davor;
--    ältere Pläne (samt Mahlzeiten) und Listen (samt eigener Einträge) werden gelöscht –
--    a) bei jedem save_meal_plan/replace_shopping_list für die speichernde Person (robust ohne externen Dienst),
--    b) täglich für alle Personen über pg_cron, falls die Erweiterung verfügbar ist (Supabase: ja). Ohne pg_cron
--       (z. B. ein lokales Postgres) bleibt a) – die Migration bricht dann nicht ab.
-- 2. G-W3: save_meal_plan lehnt ab heute jeden Tag mit Status complete/no_targets ab, dessen Tagessumme unter dem
--    Grundumsatz für die Schutzgrenzen liegt (max(Mifflin-St Jeor „Grenzen“, Katch-McArdle mit Körperfett ≤ 90 Tage) ×
--    MIN_INTAKE_RELATIVE_TO_BMR, aus den gespeicherten Körperdaten; Spiegel von serverDayKcalFloor in
--    packages/core/src/nutrition/plausibility.ts, db-sync.test.ts). Ohne Einwilligung, Größe/Gewicht oder bei
--    Schwangerschaft: keine Prüfung (Modus no_targets wie im Core). Meldung ohne Werte; Gesundheitsdaten nie in Logs.

-- ---------------------------------------------------------------------------------------------------------
-- Grundumsatz für die Schutzgrenzen an einem Tag (G-W3) – nur für save_meal_plan (security definer, Eigentümer).
-- Die gültige Einwilligung health_data prüft der Aufrufer (ohne sie keine Prüfung). null = keine Prüfung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.meal_plan_day_kcal_floor(p_user_id uuid, p_day date, p_today date)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  -- sync: MIFFLIN_ST_JEOR in packages/core/src/constants.ts (Offset „Grenzen“: divers/keine Angabe = männlich)
  kg_factor constant numeric := 10;
  cm_factor constant numeric := 6.25;
  age_factor constant numeric := 5;
  offset_male constant numeric := 5;
  offset_female constant numeric := -161;
  offset_unknown constant numeric := 5;
  -- sync: KATCH_MCARDLE, BODY_FAT_MAX_AGE_DAYS, MIN_INTAKE_RELATIVE_TO_BMR
  katch_intercept constant numeric := 370;
  katch_ffm_factor constant numeric := 21.6;
  body_fat_max_age_days constant integer := 90;
  min_intake_relative_to_bmr constant numeric := 1.0;
  v_birth date;
  v_sex text;
  v_height numeric;
  v_weight numeric;
  v_fat numeric;
  v_fat_on date;
  v_age integer;
  v_mifflin numeric;
  v_katch numeric;
begin
  -- Schwangerschaft (neuester Gesundheits-Check) → Modus no_targets, kein Grundumsatz.
  if coalesce((
    select 'pregnancy' = any (h.flags)
    from public.health_screening h
    where h.user_id = p_user_id
    order by h.created_at desc
    limit 1
  ), false) then
    return null;
  end if;
  select p.birth_date, p.sex::text into v_birth, v_sex from public.profiles p where p.user_id = p_user_id;
  if v_birth is null then
    return null;
  end if;
  -- Je Feld der neueste Wert (latestBodyValues); Messdaten nach heute zählen als heute (measuredOnForEngine).
  select b.height_cm into v_height from public.body_metrics b
  where b.user_id = p_user_id and b.height_cm is not null order by b.measured_on desc limit 1;
  select b.weight_kg into v_weight from public.body_metrics b
  where b.user_id = p_user_id and b.weight_kg is not null order by b.measured_on desc limit 1;
  if v_height is null or v_weight is null then
    return null;
  end if;
  select b.body_fat_pct, least(b.measured_on, p_today) into v_fat, v_fat_on from public.body_metrics b
  where b.user_id = p_user_id and b.body_fat_pct is not null order by b.measured_on desc limit 1;
  -- Alter am Tag wie ageInYears (vor der Geburt 0).
  v_age := case
    when p_day < v_birth then 0
    else extract(year from p_day)::integer - extract(year from v_birth)::integer
      - case
          when (extract(month from p_day), extract(day from p_day))
             < (extract(month from v_birth), extract(day from v_birth)) then 1
          else 0
        end
  end;
  v_mifflin := kg_factor * v_weight + cm_factor * v_height - age_factor * v_age
    + case v_sex when 'male' then offset_male when 'female' then offset_female else offset_unknown end;
  v_katch := case
    when v_fat is not null and p_day - v_fat_on between 0 and body_fat_max_age_days
      then katch_intercept + katch_ffm_factor * (v_weight * (1 - v_fat / 100))
  end;
  return greatest(v_mifflin, coalesce(v_katch, v_mifflin)) * min_intake_relative_to_bmr;
end;
$$;

revoke all on function private.meal_plan_day_kcal_floor(uuid, date, date) from public;

-- ---------------------------------------------------------------------------------------------------------
-- Löschfrist (G-N7-2): Pläne und Listen von Wochen VOR (Montag der laufenden Woche − 4 Wochen) löschen.
-- p_user_id null = alle Personen (täglicher Lauf); sonst nur diese Person (beim Speichern).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.purge_expired_nutrition_weeks(p_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: MEAL_PLAN_RETENTION_WEEKS in packages/core/src/constants.ts
  retention_weeks constant integer := 4;
  cutoff date := date_trunc('week', private.berlin_today())::date - 7 * retention_weeks;
  n_lists integer;
  n_plans integer;
begin
  delete from public.shopping_lists sl
  where sl.week_start < cutoff and (p_user_id is null or sl.user_id = p_user_id);
  get diagnostics n_lists = row_count;
  delete from public.meal_plans mp
  where mp.week_start < cutoff and (p_user_id is null or mp.user_id = p_user_id);
  get diagnostics n_plans = row_count;
  return n_lists + n_plans;
end;
$$;

revoke all on function private.purge_expired_nutrition_weeks(uuid) from public, anon, authenticated;
grant execute on function private.purge_expired_nutrition_weeks(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- save_meal_plan(p_plan, p_auto_adjusted, p_recipes_changed) – wie 20261014120600_meal_plan_rpcs.sql, zusätzlich
-- G-W3 (nach der Einwilligungs-Prüfung) und die Löschfrist (am Ende).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_meal_plan(
  p_plan jsonb,
  p_auto_adjusted boolean default false,
  p_recipes_changed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_keys constant text[] := array[
    'week_start', 'engine_version', 'variant', 'meal_prep_plan_id', 'inputs', 'items'
  ];
  input_keys constant text[] := array[
    'diet', 'meals_per_day', 'cooking_mode', 'mealprep_days', 'mealprep_slots'
  ];
  item_keys constant text[] := array[
    'date', 'slot', 'role', 'recipe_id', 'recipe_version', 'title_de', 'factor', 'kcal', 'protein_g', 'carbs_g',
    'fat_g', 'substitutions', 'omitted_optional', 'ingredient_swaps', 'is_fill', 'prep_kind', 'cook_date',
    'storage', 'meal_prep_plan_id', 'day_status'
  ];
  pair_keys constant text[] := array['index', 'food_id', 'substitute_food_id'];
  omit_keys constant text[] := array['index', 'food_id'];
  -- sync: MEAL_PLAN_ENGINE_VERSION
  engine_version_max constant integer := 1;
  -- sync: 7 × (NUTRITION_LIMITS.mealsPerDay.max + EXTRA_SLOTS) in mealPlanPayloadSchema
  items_max constant integer := 70;
  -- sync: RECIPE_SCHEMA_LIMITS.ingredients.max – höchstens eine Änderung je Zutat (Wächter N7 H1)
  changes_max constant integer := 20;
  -- sync: MEAL_PLAN_PAYLOAD_MAX_BYTES (Wächter N7 H1)
  payload_max_bytes constant integer := 262144;
  -- sync: MEAL_PLAN_DAY_KCAL_CHECK in packages/core/src/constants.ts (G-W3)
  checked_day_statuses constant text[] := array['complete', 'no_targets'];
  kcal_tolerance constant numeric := 1;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  prefs record;
  basis record;
  week date;
  excluded_groups text[];
  uses boolean;
  old_plan record;
  new_plan_id uuid;
  item jsonb;
  pair jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Größe zuerst (Wächter N7 H1): billig, klare Meldung, bevor Schleifen über die Eingabe laufen.
  if octet_length(p_plan::text) > payload_max_bytes then
    raise exception 'Essensplan zu groß.' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  select np.diet_type, np.eats_pork into prefs
  from public.nutrition_prefs np where np.user_id = current_user_id;
  if not found then
    raise exception 'Ernährungsangaben fehlen.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    -- -----------------------------------------------------------------------------------------------------
    -- Form (wie mealPlanPayloadSchema, strikt)
    -- -----------------------------------------------------------------------------------------------------
    perform private.assert_json_keys(p_plan, plan_keys, 'Essensplan');
    perform private.assert_json_keys(p_plan -> 'inputs', input_keys, 'Angaben');
    if jsonb_typeof(p_plan -> 'week_start') is distinct from 'string'
       or not private.jsonb_number_between(p_plan -> 'engine_version', 1, engine_version_max, 0)
       or not private.jsonb_number_between(p_plan -> 'variant', 0, 10000, 0)
       or coalesce(jsonb_typeof(p_plan -> 'meal_prep_plan_id'), 'fehlt') not in ('string', 'null')
       or jsonb_typeof(p_plan -> 'items') is distinct from 'array' then
      raise exception 'Ungültiger Essensplan.' using errcode = 'invalid_parameter_value';
    end if;
    -- Angaben (ohne Gesundheitsdaten, K8): alle Felder, Werte wie mealPlanPayloadSchema.inputs.
    if jsonb_typeof(p_plan -> 'inputs' -> 'diet') is distinct from 'string'
       or not private.jsonb_number_between(p_plan -> 'inputs' -> 'meals_per_day', 1, 8, 0)
       or jsonb_typeof(p_plan -> 'inputs' -> 'cooking_mode') is distinct from 'string'
       or (jsonb_typeof(p_plan -> 'inputs' -> 'mealprep_days') is distinct from 'null'
           and not private.jsonb_number_between(p_plan -> 'inputs' -> 'mealprep_days', 1, 7, 0))
       or jsonb_typeof(p_plan -> 'inputs' -> 'mealprep_slots') is distinct from 'string' then
      raise exception 'Ungültige Angaben im Essensplan.' using errcode = 'invalid_parameter_value';
    end if;
    perform (p_plan -> 'inputs' ->> 'diet')::public.diet_type,
      (p_plan -> 'inputs' ->> 'cooking_mode')::public.cooking_mode,
      (p_plan -> 'inputs' ->> 'mealprep_slots')::public.mealprep_slot_mode;

    week := (p_plan ->> 'week_start')::date;
    if extract(isodow from week) <> 1
       or week < date_trunc('week', today - 1)::date
       or week > date_trunc('week', today + 1)::date + 7 then
      raise exception 'Woche außerhalb des Rahmens.' using errcode = 'invalid_parameter_value';
    end if;

    if jsonb_array_length(p_plan -> 'items') > items_max then
      raise exception 'Zu viele Mahlzeiten.' using errcode = 'invalid_parameter_value';
    end if;
    for item in select value from jsonb_array_elements(p_plan -> 'items') loop
      perform private.assert_json_keys(item, item_keys, 'Mahlzeit');
      if jsonb_typeof(item -> 'date') is distinct from 'string'
         or jsonb_typeof(item -> 'slot') is distinct from 'string'
         or coalesce(jsonb_typeof(item -> 'role'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(item -> 'recipe_id') is distinct from 'string'
         or not private.jsonb_number_between(item -> 'recipe_version', 1, 1000, 0)
         or jsonb_typeof(item -> 'title_de') is distinct from 'string'
         or jsonb_typeof(item -> 'factor') is distinct from 'number'
         or jsonb_typeof(item -> 'kcal') is distinct from 'number'
         or jsonb_typeof(item -> 'protein_g') is distinct from 'number'
         or jsonb_typeof(item -> 'carbs_g') is distinct from 'number'
         or jsonb_typeof(item -> 'fat_g') is distinct from 'number'
         or jsonb_typeof(item -> 'substitutions') is distinct from 'array'
         or jsonb_typeof(item -> 'omitted_optional') is distinct from 'array'
         or jsonb_typeof(item -> 'ingredient_swaps') is distinct from 'array'
         or jsonb_typeof(item -> 'is_fill') is distinct from 'boolean'
         or jsonb_typeof(item -> 'prep_kind') is distinct from 'string'
         or jsonb_typeof(item -> 'cook_date') is distinct from 'string'
         or coalesce(jsonb_typeof(item -> 'storage'), 'fehlt') not in ('string', 'null')
         or coalesce(jsonb_typeof(item -> 'meal_prep_plan_id'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(item -> 'day_status') is distinct from 'string' then
        raise exception 'Ungültige Mahlzeit.' using errcode = 'invalid_parameter_value';
      end if;
      -- Höchstens eine Änderung je Zutat, also zusammen höchstens so viele wie Zutaten (H1).
      if jsonb_array_length(item -> 'substitutions') + jsonb_array_length(item -> 'omitted_optional')
           + jsonb_array_length(item -> 'ingredient_swaps') > changes_max then
        raise exception 'Zu viele Zutaten-Änderungen.' using errcode = 'invalid_parameter_value';
      end if;
      for pair in
        select value from jsonb_array_elements(item -> 'substitutions')
        union all
        select value from jsonb_array_elements(item -> 'ingredient_swaps')
      loop
        perform private.assert_json_keys(pair, pair_keys, 'Ersatz');
        if not private.jsonb_number_between(pair -> 'index', 0, changes_max - 1, 0)
           or jsonb_typeof(pair -> 'food_id') is distinct from 'string'
           or jsonb_typeof(pair -> 'substitute_food_id') is distinct from 'string' then
          raise exception 'Ungültiger Ersatz.' using errcode = 'invalid_parameter_value';
        end if;
      end loop;
      for pair in select value from jsonb_array_elements(item -> 'omitted_optional') loop
        perform private.assert_json_keys(pair, omit_keys, 'Weglassen');
        if not private.jsonb_number_between(pair -> 'index', 0, changes_max - 1, 0)
           or jsonb_typeof(pair -> 'food_id') is distinct from 'string' then
          raise exception 'Ungültige Mahlzeit.' using errcode = 'invalid_parameter_value';
        end if;
      end loop;
    end loop;

    -- -----------------------------------------------------------------------------------------------------
    -- Mahlzeiten und Zutaten-Änderungen als Zeilen (Werte prüfen danach die CHECKs der Tabelle)
    -- -----------------------------------------------------------------------------------------------------
    create temporary table if not exists pg_temp.meal_plan_rows (
      ord integer,
      date date,
      slot text,
      recipe_id text,
      recipe_version integer,
      factor numeric,
      substitutions jsonb,
      omitted jsonb,
      swaps jsonb,
      cook_date date,
      day_status text
    ) on commit drop;
    truncate pg_temp.meal_plan_rows;
    insert into pg_temp.meal_plan_rows
    select i.ord::integer, (i.v ->> 'date')::date, i.v ->> 'slot', i.v ->> 'recipe_id',
      (i.v ->> 'recipe_version')::integer, (i.v ->> 'factor')::numeric, i.v -> 'substitutions',
      i.v -> 'omitted_optional', i.v -> 'ingredient_swaps', (i.v ->> 'cook_date')::date, i.v ->> 'day_status'
    from jsonb_array_elements(p_plan -> 'items') with ordinality as i(v, ord);

    -- Eine Zeile je Zutaten-Änderung: Art, Stelle, Lebensmittel der Zutat, Ersatz.
    create temporary table if not exists pg_temp.meal_plan_changes (
      ord integer,
      date date,
      recipe_id text,
      kind text,
      idx integer,
      food_id text,
      substitute_food_id text
    ) on commit drop;
    truncate pg_temp.meal_plan_changes;
    insert into pg_temp.meal_plan_changes
    select r.ord, r.date, r.recipe_id, c.kind, (c.v ->> 'index')::integer, c.v ->> 'food_id',
      c.v ->> 'substitute_food_id'
    from pg_temp.meal_plan_rows r
    cross join lateral (
      select 'sub' as kind, v from jsonb_array_elements(r.substitutions) as v
      union all
      select 'omit', v from jsonb_array_elements(r.omitted) as v
      union all
      select 'swap', v from jsonb_array_elements(r.swaps) as v
    ) as c;

    if exists (
      select 1 from pg_temp.meal_plan_rows r
      where r.date < week or r.date > week + 6
        -- Gekocht wird höchstens am Sonntag vor der Woche und nie nach dem Tag selbst.
        or r.cook_date < week - 1 or r.cook_date > r.date
    ) then
      raise exception 'Datum passt nicht zur Woche.' using errcode = 'invalid_parameter_value';
    end if;

    -- Rezepte: ab heute freigegeben in genau dieser Version; vergangene Tage bleiben, wie sie waren (Version höchstens
    -- die aktuelle, Rezept existiert).
    if exists (
      select 1 from pg_temp.meal_plan_rows r
      left join public.recipes rc on rc.id = r.recipe_id
      where rc.id is null
        or (r.date >= today and (rc.status <> 'published' or rc.version <> r.recipe_version))
        or (r.date < today and r.recipe_version > rc.version)
    ) then
      raise exception 'Rezept nicht freigegeben oder veraltet.' using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Zutaten-Änderungen (ab heute): je Stelle höchstens eine, die Stelle gibt es und trägt dieses Lebensmittel
    -- -----------------------------------------------------------------------------------------------------
    if exists (
      select 1 from pg_temp.meal_plan_changes c group by c.ord, c.idx having count(*) > 1
    ) then
      raise exception 'Zutat mehrfach geändert.' using errcode = 'invalid_parameter_value';
    end if;
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today
        and not exists (
          select 1 from public.recipe_ingredients ri
          where ri.recipe_id = c.recipe_id and ri.position = c.idx and ri.food_id = c.food_id
        )
    ) then
      raise exception 'Zutat passt nicht zum Rezept.' using errcode = 'invalid_parameter_value';
    end if;
    -- Weglassen nur bei optionalen Zutaten (S3).
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      join public.recipe_ingredients ri on ri.recipe_id = c.recipe_id and ri.position = c.idx
      where c.date >= today and c.kind = 'omit' and not ri.optional
    ) then
      raise exception 'Nur optionale Zutaten können weggelassen werden.' using errcode = 'invalid_parameter_value';
    end if;
    -- Ersatzprodukt (S4): steht in der Ersatzliste des Lebensmittels und ist freigegeben.
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today and c.kind = 'sub'
        and (
          not exists (
            select 1 from public.foods f, jsonb_array_elements(coalesce(f.data -> 'substitutes', '[]')) as fs(v)
            where f.id = c.food_id and fs.v ->> 'food_id' = c.substitute_food_id
          )
          or not exists (
            select 1 from public.foods f2 where f2.id = c.substitute_food_id and f2.status = 'published'
          )
        )
    ) then
      raise exception 'Ersatzprodukt nicht erlaubt.' using errcode = 'invalid_parameter_value';
    end if;
    -- Zutaten-Tausch (N9, S7): freigegebener Eintrag der Austausch-Tabelle.
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today and c.kind = 'swap'
        and not exists (
          select 1 from public.ingredient_substitutions x
          where x.food_id = c.food_id and x.substitute_food_id = c.substitute_food_id and x.status = 'published'
        )
    ) then
      raise exception 'Zutaten-Tausch nicht erlaubt.' using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Harte Regeln je Zutat erneut prüfen (7.3): Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“
    -- (Gruppen und je Lebensmittel), Alkohol; Lebensmittel freigegeben. Optionale Zutaten zählen, solange sie nicht
    -- weggelassen sind (S3). Wirksam ist je Stelle: Tausch, sonst Ersatz, sonst die Zutat selbst.
    -- -----------------------------------------------------------------------------------------------------
    excluded_groups := array(
      select fp.food_group from public.food_preferences fp
      where fp.user_id = current_user_id and fp.kind in ('intolerance', 'dislike')
    );
    if exists (
      select 1
      from pg_temp.meal_plan_rows r
      join public.recipe_ingredients ri on ri.recipe_id = r.recipe_id
      left join pg_temp.meal_plan_changes c on c.ord = r.ord and c.idx = ri.position
      left join public.foods f
        on f.id = case when c.kind in ('sub', 'swap') then c.substitute_food_id else ri.food_id end
      where r.date >= today
        and c.kind is distinct from 'omit'
        and (
          f.id is null
          or f.status <> 'published'
          or f.alcohol
          or not private.diet_allows(prefs.diet_type, private.food_diet(f.animal))
          or (prefs.eats_pork is distinct from true
              and private.food_contains_pork(f.meat_kind, f.animal, f.gelatin_origin))
          or f.groups && excluded_groups
          or exists (
            select 1 from public.food_dislikes d where d.user_id = current_user_id and d.food_id = f.id
          )
        )
    ) then
      raise exception 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Sperren (Wächter N7 S2, H15): erst die Woche dieser Person (gleichzeitiges erstes Speichern derselben Woche
    -- wartet und ersetzt dann, statt mit „Ungültige Werte“ abzubrechen; derselbe Schlüssel wie in
    -- replace_shopping_list), dann die Einwilligung (FOR SHARE in nutrition_health_basis).
    -- -----------------------------------------------------------------------------------------------------
    perform pg_advisory_xact_lock(hashtext('nutrition_week|' || current_user_id::text || '|' || week::text));
    select * into basis from private.nutrition_health_basis();
    select mp.id, mp.uses_health_data, mp.meal_prep_plan_id, mp.cook_day_started_at into old_plan
    from public.meal_plans mp
    where mp.user_id = current_user_id and mp.week_start = week
    for update;
    -- Gesundheitsbezug (7.1) und Einwilligung (S9)
    uses := basis.targets_basis
      or basis.has_intolerances
      or exists (
        select 1 from pg_temp.meal_plan_rows r
        where r.factor <> 1
          or r.day_status <> 'no_targets'
          or jsonb_array_length(r.swaps) > 0
          -- Ersatz und Weglassen lassen mit Einwilligung auf Unverträglichkeiten schließen (Wächter N3 K5).
          or (basis.consent_ok and (jsonb_array_length(r.substitutions) > 0 or jsonb_array_length(r.omitted) > 0))
      )
      -- Übernommene vergangene Tage tragen den Gesundheitsbezug des alten Plans weiter (Wächter N5a S1).
      or (coalesce(old_plan.uses_health_data, false)
          and exists (select 1 from pg_temp.meal_plan_rows r where r.date < today));
    if uses and not basis.consent_ok then
      raise exception 'Für diesen Essensplan fehlt die Einwilligung.' using errcode = 'insufficient_privilege';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Mindest-Plausibilität der Tageskalorien (Etappe N7 Teil 2, G-W3, mealPlanDaysBelowFloor in packages/core):
    -- ab heute kein Tag mit Status complete/no_targets unter dem Grundumsatz aus den GESPEICHERTEN Körperdaten
    -- (private.meal_plan_day_kcal_floor). Ohne Einwilligung, ohne Größe/Gewicht oder bei Schwangerschaft gibt es
    -- keinen Grundumsatz (null → keine Prüfung, wie Modus no_targets im Core). Meldung ohne Werte.
    -- -----------------------------------------------------------------------------------------------------
    if basis.consent_ok and exists (
      select 1
      from (
        select (v ->> 'date')::date as day, sum((v ->> 'kcal')::numeric) as kcal,
          bool_or((v ->> 'day_status') = any (checked_day_statuses)) as checked
        from jsonb_array_elements(p_plan -> 'items') as v
        where (v ->> 'date')::date >= today
        group by 1
      ) as d
      where d.checked
        and d.kcal + kcal_tolerance < private.meal_plan_day_kcal_floor(current_user_id, d.day, today)
    ) then
      raise exception 'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Speichern: Plan der Woche ersetzen (höchstens einer je Woche); Kochtag-Start bleibt nur beim selben
    -- Meal-Prep-Plan.
    -- -----------------------------------------------------------------------------------------------------
    if old_plan.id is not null then
      delete from public.meal_plans where id = old_plan.id;
    end if;
    insert into public.meal_plans (
      user_id, week_start, status, engine_version, variant, meal_prep_plan_id, inputs, uses_health_data,
      auto_adjusted, recipes_changed, cook_day_started_at
    )
    values (
      current_user_id, week, 'active', (p_plan ->> 'engine_version')::smallint, (p_plan ->> 'variant')::integer,
      p_plan ->> 'meal_prep_plan_id', p_plan -> 'inputs', uses, coalesce(p_auto_adjusted, false),
      coalesce(p_recipes_changed, false),
      case
        when old_plan.id is not null and old_plan.meal_prep_plan_id is not null
          and old_plan.meal_prep_plan_id = p_plan ->> 'meal_prep_plan_id'
          then old_plan.cook_day_started_at
      end
    )
    returning id into new_plan_id;

    insert into public.meal_plan_items (
      plan_id, user_id, date, slot, role, recipe_id, recipe_version, title_de, factor, kcal, protein_g, carbs_g,
      fat_g, substitutions, omitted_optional, ingredient_swaps, is_fill, prep_kind, cook_date, storage,
      meal_prep_plan_id, day_status
    )
    select new_plan_id, current_user_id, (v ->> 'date')::date, v ->> 'slot', v ->> 'role', v ->> 'recipe_id',
      (v ->> 'recipe_version')::integer, v ->> 'title_de', (v ->> 'factor')::numeric, (v ->> 'kcal')::numeric,
      (v ->> 'protein_g')::numeric, (v ->> 'carbs_g')::numeric, (v ->> 'fat_g')::numeric, v -> 'substitutions',
      v -> 'omitted_optional', v -> 'ingredient_swaps', (v ->> 'is_fill')::boolean,
      v ->> 'prep_kind', (v ->> 'cook_date')::date, v ->> 'storage', v ->> 'meal_prep_plan_id',
      v ->> 'day_status'
    from jsonb_array_elements(p_plan -> 'items') as v;
  exception
    when data_exception or integrity_constraint_violation then
      -- Keine Werte in der Meldung (Fehler der Umwandlungen/CHECKs nennen sonst die Zeile).
      if sqlstate = '22023' then
        raise exception using errcode = sqlstate, message = sqlerrm;
      end if;
      raise exception 'Ungültige Werte im Essensplan.' using errcode = sqlstate;
  end;

  -- Einkaufsliste der Woche zeigt auf den neuen Plan (der alte ist ersetzt).
  update public.shopping_lists set meal_plan_id = new_plan_id
  where user_id = current_user_id and week_start = week;
  -- Löschfrist (G-N7-2): ältere Wochen dieser Person löschen – unabhängig von pg_cron.
  perform private.purge_expired_nutrition_weeks(current_user_id);
  return new_plan_id;
end;
$$;

revoke all on function public.save_meal_plan(jsonb, boolean, boolean) from public, anon;
grant execute on function public.save_meal_plan(jsonb, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- replace_shopping_list(p_list) – wie 20261014120600_meal_plan_rpcs.sql, zusätzlich die Löschfrist (am Ende).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.replace_shopping_list(p_list jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  list_keys constant text[] := array[
    'week_start', 'from_date', 'to_date', 'uses_health_data', 'plan_key', 'recipes', 'items'
  ];
  recipe_keys constant text[] := array['recipe_id', 'servings', 'diet'];
  item_keys constant text[] := array[
    'item_key', 'food_id', 'label_de', 'amount', 'unit', 'category', 'is_pantry', 'is_manual', 'checked',
    'substitute_for', 'amount_changed', 'not_in_plan'
  ];
  -- sync: SHOPPING_LIST_EXTRAS, SHOPPING_LIST_ROUNDING.manualItemsMax, RECIPE_SERVINGS_PICKER
  items_max constant integer := 1000;
  manual_items_max constant integer := 100;
  recipes_max constant integer := 20;
  -- sync: shoppingListItemPayloadSchema.substitute_for (max 50), SHOPPING_LIST_PAYLOAD_MAX_BYTES (Wächter N7 H1)
  substitute_for_max constant integer := 50;
  payload_max_bytes constant integer := 2097152;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  basis record;
  week date;
  plan record;
  uses boolean;
  v_list_id uuid;
  entry jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Größe zuerst (Wächter N7 H1).
  if octet_length(p_list::text) > payload_max_bytes then
    raise exception 'Einkaufsliste zu groß.' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;

  begin
    perform private.assert_json_keys(p_list, list_keys, 'Einkaufsliste');
    if jsonb_typeof(p_list -> 'week_start') is distinct from 'string'
       or jsonb_typeof(p_list -> 'from_date') is distinct from 'string'
       or jsonb_typeof(p_list -> 'to_date') is distinct from 'string'
       or jsonb_typeof(p_list -> 'uses_health_data') is distinct from 'boolean'
       or jsonb_typeof(p_list -> 'plan_key') is distinct from 'string'
       or jsonb_typeof(p_list -> 'recipes') is distinct from 'array'
       or jsonb_typeof(p_list -> 'items') is distinct from 'array' then
      raise exception 'Ungültige Einkaufsliste.' using errcode = 'invalid_parameter_value';
    end if;
    week := (p_list ->> 'week_start')::date;
    if extract(isodow from week) <> 1
       or week < date_trunc('week', today - 1)::date
       or week > date_trunc('week', today + 1)::date + 7 then
      raise exception 'Woche außerhalb des Rahmens.' using errcode = 'invalid_parameter_value';
    end if;
    if jsonb_array_length(p_list -> 'items') > items_max
       or jsonb_array_length(p_list -> 'recipes') > recipes_max then
      raise exception 'Zu viele Einträge.' using errcode = 'invalid_parameter_value';
    end if;

    for entry in select value from jsonb_array_elements(p_list -> 'recipes') loop
      perform private.assert_json_keys(entry, recipe_keys, 'Rezept');
      if jsonb_typeof(entry -> 'recipe_id') is distinct from 'string'
         or not private.jsonb_number_between(entry -> 'servings', 1, 12, 0)
         or coalesce(jsonb_typeof(entry -> 'diet'), 'fehlt') not in ('string', 'null') then
        raise exception 'Ungültiges Rezept in der Einkaufsliste.' using errcode = 'invalid_parameter_value';
      end if;
      perform (entry ->> 'diet')::public.diet_type;
      if not exists (
        select 1 from public.recipes r where r.id = entry ->> 'recipe_id' and r.status = 'published'
      ) then
        raise exception 'Rezept nicht freigegeben.' using errcode = 'invalid_parameter_value';
      end if;
    end loop;
    if not private.has_distinct_elements(
      array(select e ->> 'recipe_id' from jsonb_array_elements(p_list -> 'recipes') as e)
    ) then
      raise exception 'Rezept doppelt.' using errcode = 'invalid_parameter_value';
    end if;

    for entry in select value from jsonb_array_elements(p_list -> 'items') loop
      perform private.assert_json_keys(entry, item_keys, 'Eintrag');
      if jsonb_typeof(entry -> 'item_key') is distinct from 'string'
         or coalesce(jsonb_typeof(entry -> 'food_id'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(entry -> 'label_de') is distinct from 'string'
         or coalesce(jsonb_typeof(entry -> 'amount'), 'fehlt') not in ('number', 'null')
         or coalesce(jsonb_typeof(entry -> 'unit'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(entry -> 'category') is distinct from 'string'
         or jsonb_typeof(entry -> 'is_pantry') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'is_manual') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'checked') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'substitute_for') is distinct from 'array'
         or jsonb_typeof(entry -> 'amount_changed') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'not_in_plan') is distinct from 'boolean'
         or jsonb_array_length(entry -> 'substitute_for') > substitute_for_max
         or exists (
           select 1 from jsonb_array_elements(entry -> 'substitute_for') s where jsonb_typeof(s) <> 'string'
         ) then
        raise exception 'Ungültiger Eintrag.' using errcode = 'invalid_parameter_value';
      end if;
    end loop;
    if (
      select count(*) from jsonb_array_elements(p_list -> 'items') e where (e ->> 'is_manual')::boolean
    ) > manual_items_max then
      raise exception 'Zu viele eigene Einträge.' using errcode = 'invalid_parameter_value';
    end if;

    -- Sperren wie in save_meal_plan (Wächter N7 S2, H15): erst die Woche dieser Person – DERSELBE Schlüssel wie in
    -- save_meal_plan (Nachprüfung N7), damit Plan und Liste derselben Woche nie gleichzeitig geschrieben werden und der
    -- Plan der Woche unten konsistent gelesen wird –, dann die Einwilligung.
    perform pg_advisory_xact_lock(hashtext('nutrition_week|' || current_user_id::text || '|' || week::text));
    -- Gesundheitsbezug (7.1, K10) – sichere Richtung: Angabe der App ODER Plan der Woche ODER (zusätzliche Rezepte
    -- mit Unverträglichkeiten bzw. Gesundheitsangaben gefiltert) ODER Ersatzprodukte mit Einwilligung.
    select * into basis from private.nutrition_health_basis();
    select mp.id, mp.uses_health_data into plan
    from public.meal_plans mp where mp.user_id = current_user_id and mp.week_start = week;
    uses := (p_list ->> 'uses_health_data')::boolean
      or coalesce(plan.uses_health_data, false)
      or (jsonb_array_length(p_list -> 'recipes') > 0 and (basis.has_intolerances or basis.targets_basis))
      or (basis.consent_ok and exists (
        select 1 from jsonb_array_elements(p_list -> 'items') e where jsonb_array_length(e -> 'substitute_for') > 0
      ));
    if uses and not basis.consent_ok then
      raise exception 'Für diese Einkaufsliste fehlt die Einwilligung.' using errcode = 'insufficient_privilege';
    end if;

    select sl.id into v_list_id
    from public.shopping_lists sl where sl.user_id = current_user_id and sl.week_start = week
    for update;
    if v_list_id is null then
      insert into public.shopping_lists (
        user_id, week_start, meal_plan_id, from_date, to_date, plan_key, added_recipes, uses_health_data
      )
      values (
        current_user_id, week, plan.id, (p_list ->> 'from_date')::date, (p_list ->> 'to_date')::date,
        p_list ->> 'plan_key', p_list -> 'recipes', uses
      )
      returning id into v_list_id;
    else
      update public.shopping_lists
      set meal_plan_id = plan.id,
          from_date = (p_list ->> 'from_date')::date,
          to_date = (p_list ->> 'to_date')::date,
          plan_key = p_list ->> 'plan_key',
          added_recipes = p_list -> 'recipes',
          uses_health_data = uses
      where id = v_list_id;
      delete from public.shopping_list_items i where i.list_id = v_list_id;
    end if;

    insert into public.shopping_list_items (
      list_id, user_id, item_key, food_id, label_de, amount, unit, category, is_pantry, is_manual, checked,
      substitute_for, amount_changed, not_in_plan
    )
    select v_list_id, current_user_id, e ->> 'item_key', e ->> 'food_id', e ->> 'label_de', (e ->> 'amount')::numeric,
      e ->> 'unit', e ->> 'category', (e ->> 'is_pantry')::boolean, (e ->> 'is_manual')::boolean,
      (e ->> 'checked')::boolean, private.jsonb_text_array(e -> 'substitute_for'),
      (e ->> 'amount_changed')::boolean, (e ->> 'not_in_plan')::boolean
    from jsonb_array_elements(p_list -> 'items') as e;
  exception
    when data_exception or integrity_constraint_violation then
      if sqlstate = '22023' then
        raise exception using errcode = sqlstate, message = sqlerrm;
      end if;
      raise exception 'Ungültige Werte in der Einkaufsliste.' using errcode = sqlstate;
  end;
  -- Löschfrist (G-N7-2): ältere Wochen dieser Person löschen – unabhängig von pg_cron.
  perform private.purge_expired_nutrition_weeks(current_user_id);
  return v_list_id;
end;
$$;

revoke all on function public.replace_shopping_list(jsonb) from public, anon;
grant execute on function public.replace_shopping_list(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Täglicher Lauf der Löschfrist (pg_cron, 02:23 UTC). Nur, wenn die Erweiterung verfügbar ist (Supabase: ja;
-- lokales Postgres ohne pg_cron: übersprungen). Fehler beim Einrichten brechen die Migration nicht ab – die Löschung
-- beim Speichern (oben) wirkt immer. cron.schedule mit Namen ersetzt einen vorhandenen Lauf (idempotent).
-- ---------------------------------------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule(
        'nutrition-weeks-retention',
        '23 2 * * *',
        'select private.purge_expired_nutrition_weeks()'
      );
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet – Löschfrist wirkt beim Speichern (save_meal_plan/replace_shopping_list).';
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Löschfrist wirkt beim Speichern (save_meal_plan/replace_shopping_list).';
  end if;
end;
$cron$;
