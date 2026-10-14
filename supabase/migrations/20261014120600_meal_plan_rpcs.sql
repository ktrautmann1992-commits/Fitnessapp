-- Phase 5 · N7: Server-Funktionen für Essenspläne, Einkaufslisten und „mag ich nicht“ je Lebensmittel
-- (docs/PLAN-PHASE-5.md 7.3, 7.4, 19.7 N9/N10) sowie Widerruf und Datenexport.
--
-- save_meal_plan / replace_shopping_list: security definer + search_path = '' (Muster save_training_plan) – Nutzer
-- haben auf meal_plans/meal_plan_items/shopping_lists/shopping_list_items KEIN Einfüge-Recht; nur diese Funktionen
-- schreiben, und sie prüfen alles selbst:
-- - angemeldet (auth.uid()), Profil und Ernährungsangaben vorhanden, user_id immer aus dem Login,
-- - nur bekannte Felder (= mealPlanPayloadSchema bzw. shoppingListPayloadSchema in packages/core, strikt),
-- - Datumsrahmen: laufende und nächste Woche (mealPlanWeekEditable; „heute“ = private.berlin_today(), ±1 Tag für die
--   Gerätezeit),
-- - für Mahlzeiten ab heute: Rezept freigegeben in genau dieser Version; Weglassen nur optionaler Zutaten (S3);
--   Ersatzprodukt nur aus der Ersatzliste des Lebensmittels (S4); Zutaten-Tausch nur mit freigegebenem Eintrag in
--   ingredient_substitutions (N9, S7); danach Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“ (Gruppen
--   und je Lebensmittel) und Alkohol ERNEUT je Zutat geprüft (7.3). pregnancy_caution und die Kalorien-Grenzen prüft
--   bewusst nur der Core auf dem Gerät (S9, R2-K8; KONZEPT 12),
-- - Faktor ≠ 1 (und jeder andere Gesundheitsbezug) ohne gültige health_data-Einwilligung wird abgelehnt (S9),
-- - uses_health_data bestimmt der Server (7.1, Wächter N3 K5, N9 S5) – nie der Client.
-- Alles in EINER Transaktion. Fehlermeldungen ohne Nutzerdaten: Fehler der CHECKs/Indizes/Umwandlungen werden
-- abgefangen und ohne Detail neu ausgelöst (gleicher Fehlercode).

-- ---------------------------------------------------------------------------------------------------------
-- Hilfsfunktion: Gesundheitsbezug aus Sicht der Datenbank für den ANGEMELDETEN Nutzer – wie usesHealthData der
-- Ziele in packages/core (nutritionEligibility: Einwilligung UND (Körperdaten ODER Gesundheits-Check)).
--
-- Wächter N7 S2 (Race mit dem Widerruf): Zuerst werden die aktiven health_data-Einwilligungen FOR SHARE gesperrt.
-- Ein gleichzeitiger Widerruf (UPDATE consents) wartet dann, bis die speichernde Transaktion fertig ist; die
-- Lösch-Anweisungen im Trigger consents_after_revoke() sehen danach (Read Committed: neuer Snapshot je Anweisung) den
-- gerade gespeicherten Plan und löschen ihn. Umgekehrt: Läuft der Widerruf zuerst, wartet die Sperre auf ihn und
-- sieht danach keine aktive Einwilligung mehr. Deshalb nicht STABLE (Zeilensperre).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.nutrition_health_basis(out consent_ok boolean, out targets_basis boolean,
  out has_intolerances boolean)
language plpgsql
volatile
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  consent_ok := public.has_valid_consent('health_data');
  targets_basis := consent_ok and (
    exists (select 1 from public.body_metrics b where b.user_id = current_user_id)
    or exists (select 1 from public.health_screening h where h.user_id = current_user_id)
  );
  has_intolerances := exists (
    select 1 from public.food_preferences fp where fp.user_id = current_user_id and fp.kind = 'intolerance'
  );
end;
$$;

revoke all on function private.nutrition_health_basis() from public;

-- ---------------------------------------------------------------------------------------------------------
-- save_meal_plan(p_plan, p_auto_adjusted, p_recipes_changed) – ersetzt den Plan derselben Woche
--
-- Zutaten-Änderungen je Zutat-INDEX (Wächter N7 S3): Ersatz {index, food_id, substitute_food_id}, Weglassen
-- {index, food_id}, Tausch {index, food_id, substitute_food_id}. index = Stelle im Rezept (0-basiert, wie
-- recipe_ingredients.position); food_id muss zur Zutat an dieser Stelle passen. So bleibt ein Rezept mit derselben
-- Zutat an zwei Stellen (z. B. Milch zweimal, einmal optional) eindeutig. Je Stelle höchstens eine Änderung.
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
  return new_plan_id;
end;
$$;

revoke all on function public.save_meal_plan(jsonb, boolean, boolean) from public, anon;
grant execute on function public.save_meal_plan(jsonb, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- replace_shopping_list(p_list) – ersetzt die Einkaufsliste derselben Woche (6.5). Die Häkchen übernimmt die App
-- vor dem Senden über item_key (mergeShoppingList in packages/core); der Server speichert den gesendeten Stand.
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
  return v_list_id;
end;
$$;

revoke all on function public.replace_shopping_list(jsonb) from public, anon;
grant execute on function public.replace_shopping_list(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- replace_food_dislikes(p_food_ids) – „mag ich nicht“ je Lebensmittel atomar ersetzen (19.7 N10). security invoker:
-- RLS (eigene Zeilen, Profil-Pflicht) und der Zähl-Trigger (höchstens 300) greifen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.replace_food_dislikes(p_food_ids jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  ids text[];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_food_ids) is distinct from 'array'
     or exists (select 1 from jsonb_array_elements(p_food_ids) v where jsonb_typeof(v) <> 'string') then
    raise exception 'Ungültige Liste.' using errcode = 'invalid_parameter_value';
  end if;
  ids := array(select jsonb_array_elements_text(p_food_ids));
  if not private.has_distinct_elements(ids) then
    raise exception 'Lebensmittel doppelt.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    delete from public.food_dislikes where user_id = current_user_id;
    insert into public.food_dislikes (user_id, food_id)
    select current_user_id, id from unnest(ids) as id;
  exception
    when foreign_key_violation or check_violation then
      raise exception 'Unbekanntes Lebensmittel oder zu viele Einträge.' using errcode = sqlstate;
  end;
end;
$$;

revoke all on function public.replace_food_dislikes(jsonb) from public, anon;
grant execute on function public.replace_food_dislikes(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- delete_stored_intolerances() – „Gespeicherte Unverträglichkeiten löschen“ (Recht auf Löschung, Wächter N4 NK2):
-- geht ohne Einwilligung; löscht im SELBEN Schritt Essenspläne und Einkaufslisten mit Gesundheitsbezug (Ersatz,
-- Weglassen und leere Plätze lassen auf Unverträglichkeiten schließen, Wächter N3 K5 – wie im Testmodus).
-- security invoker: nur eigene Zeilen (Lösch-Policies).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_stored_intolerances()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.food_preferences where user_id = current_user_id and kind = 'intolerance';
  delete from public.meal_plans where user_id = current_user_id and uses_health_data;
  delete from public.shopping_lists where user_id = current_user_id and uses_health_data;
end;
$$;

revoke all on function public.delete_stored_intolerances() from public, anon;
grant execute on function public.delete_stored_intolerances() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data (7.4, 3.7): wie 20261006120200_training_log_rpcs.sql, zusätzlich Essenspläne und
-- Einkaufslisten mit Gesundheitsbezug löschen (Kaskade: Mahlzeiten, Einträge inkl. eigener Einträge – K10).
-- Bewertungen und „mag ich nicht“ je Lebensmittel bleiben (kein Gesundheitsdatum, 19.7 N10).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    perform private.neutralize_health_plan_logs(new.user_id);
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
    -- Ebenso Pläne und Listen (Wächter N7 S2): Die speichernden Funktionen sperren die Einwilligung FOR SHARE, der
    -- Widerruf wartet also auf sie; jede Anweisung sieht danach den neuesten Stand. Die Wiederholung fängt
    -- zusätzlich ab, was während der Lösch-Anweisungen oben fertig geworden ist.
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- Wächter N7 S2 auch für Trainingspläne (gleiches Muster, „alle Funktionen, die die Einwilligung prüfen und
-- Gesundheitsbezug speichern“): private.plan_health_basis() (save_training_plan, append_plan_block) sperrt die aktiven
-- health_data-Einwilligungen FOR SHARE, bevor sie geprüft werden. Sonst unverändert gegenüber
-- 20261004120100_training_plan_rpcs.sql (gleiche Signatur); nicht mehr STABLE (Zeilensperre).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.plan_health_basis(out uses_health_data boolean, out medical_notice boolean)
language plpgsql
volatile
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  latest_flags text[];
  consent_ok boolean;
begin
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  consent_ok := public.has_valid_consent('health_data');
  select h.flags into latest_flags
  from public.health_screening h
  where h.user_id = current_user_id
  order by h.created_at desc
  limit 1;
  uses_health_data := found and consent_ok;
  medical_notice := uses_health_data and cardinality(latest_flags) > 0;
end;
$$;

revoke all on function private.plan_health_basis() from public;

-- ---------------------------------------------------------------------------------------------------------
-- append_plan_block(p_plan_id, p_sessions): wie 20261005130100_plan_session_kinds.sql (gleiche Signatur, gleiches
-- Verhalten), aber die aktiven health_data-Einwilligungen werden ZUERST FOR SHARE gesperrt, erst danach der Plan
-- (user_plans FOR UPDATE). Sonst: Folgeblock hält user_plans und wartet in plan_health_basis auf die Einwilligung,
-- während der Widerruf die Einwilligung hält und im Trigger user_plans löschen will → Deadlock (Wächter N7
-- Nachprüfung S-N1). Die zweite Sperre in plan_health_basis ist dann harmlos (schon gehalten).
-- Reihenfolge überall: Einwilligung → Plan-/Einheiten-Zeilen (save_training_plan über plan_health_basis vor dem
-- Plan-Update, revoke_health_data, append_plan_block); save_meal_plan/replace_shopping_list: Woche (Advisory) →
-- Einwilligung → Plan/Liste. save_session_log, delete_session_log und close_missed_sessions sperren keine Einwilligung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.append_plan_block(p_plan_id uuid, p_sessions jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: PLAN_SAVE_LIMITS in packages/core/src/constants.ts
  past_tolerance_days constant integer := 1;
  schedule_max_days_ahead constant integer := 56;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  plan record;
  basis record;
  last_block integer;
  last_date date;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Zuerst die Einwilligung (gleiche Reihenfolge wie revoke_health_data), dann der Plan.
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  select * into plan
  from public.user_plans p
  where p.id = p_plan_id and p.user_id = current_user_id and p.status = 'active'
  for update;
  if not found then
    raise exception 'Kein eigener aktiver Plan.' using errcode = 'insufficient_privilege';
  end if;
  -- Plan ohne Vorlage (reine Ausdauer): auch im Folgeblock keine Kraft-Einheit.
  if plan.template_id is null
     and jsonb_typeof(p_sessions) = 'array'
     and exists (
       select 1 from jsonb_array_elements(p_sessions) s where s ->> 'kind' is distinct from 'endurance'
     ) then
    raise exception 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.' using errcode = 'invalid_parameter_value';
  end if;
  select * into basis from private.plan_health_basis();
  if basis.uses_health_data is distinct from plan.uses_health_data
     or basis.medical_notice is distinct from plan.medical_notice then
    raise exception 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.'
      using errcode = 'invalid_parameter_value';
  end if;
  select max(s.block_no), max(s.scheduled_on) into last_block, last_date
  from public.planned_sessions s
  where s.plan_id = p_plan_id;
  perform private.insert_plan_sessions(
    p_plan_id, current_user_id, p_sessions, coalesce(last_block, 0) + 1,
    greatest(today - past_tolerance_days, last_date + 1),
    greatest(last_date, today) + schedule_max_days_ahead
  );
  return coalesce(last_block, 0) + 1;
end;
$$;

revoke all on function public.append_plan_block(uuid, jsonb) from public, anon;
grant execute on function public.append_plan_block(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- revoke_health_data(p_delete_logs): wie 20261006120200_training_log_rpcs.sql, aber die Einwilligungen werden ZUERST
-- gesperrt (FOR UPDATE), danach die Einheiten. So nehmen Widerruf und die speichernden Funktionen (Einwilligung FOR
-- SHARE, danach Plan-Zeilen) die Sperren in derselben Reihenfolge – kein Deadlock (Wächter N7 S2).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.revoke_health_data(p_delete_logs boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_delete_logs is null then
    raise exception 'Ungültige Eingabe.' using errcode = 'invalid_parameter_value';
  end if;
  -- Zuerst die aktiven Einwilligungen: Speichernde Funktionen (FOR SHARE) sind danach fertig bzw. warten.
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for update;
  -- Einheiten der Gesundheits-Pläne sperren: ein gleichzeitig laufendes save_session_log ist danach fertig und
  -- sein Eintrag für das folgende Löschen sichtbar (Wächter Etappe B, S2).
  perform 1
  from public.planned_sessions ps
  join public.user_plans p on p.id = ps.plan_id
  where ps.user_id = current_user_id and p.uses_health_data
  order by ps.id
  for update of ps;
  if p_delete_logs then
    delete from public.session_logs sl where sl.user_id = current_user_id and sl.from_health_plan;
  end if;
  update public.consents c
  set revoked_at = now()
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null;
  -- Auch ohne aktive Einwilligung (z. B. schon widerrufen): keine Vorgaben aus Gesundheits-Plänen behalten.
  perform private.neutralize_health_plan_logs(current_user_id);
end;
$$;

revoke all on function public.revoke_health_data(boolean) from public, anon;
grant execute on function public.revoke_health_data(boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- export_my_data() – Recht auf Auskunft (Art. 15): wie 20261006120200_training_log_rpcs.sql, zusätzlich die sechs
-- Ernährungs-Tabellen (die neuen nutrition_prefs-Spalten kommen über to_jsonb automatisch mit). Schlüssel von „data“
-- = DATA_EXPORT_TABLES in packages/core/src/export/data-export.ts (db-sync.test.ts); pgTAP prüft, dass jede
-- public-Tabelle mit Spalte user_id enthalten ist.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'format_version', 1,
    'exported_at', now(),
    'user_id', current_user_id,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id = current_user_id),
      'consents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.granted_at), '[]'::jsonb) from public.consents t where t.user_id = current_user_id),
      'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t where t.user_id = current_user_id),
      'body_measurements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_measurements t where t.user_id = current_user_id),
      'measurement_reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measurement_reminders t where t.user_id = current_user_id),
      'health_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.health_screening t where t.user_id = current_user_id),
      'goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id = current_user_id),
      'user_equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_equipment t where t.user_id = current_user_id),
      'training_slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_slots t where t.user_id = current_user_id),
      'nutrition_prefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.nutrition_prefs t where t.user_id = current_user_id),
      'food_preferences', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_preferences t where t.user_id = current_user_id),
      'admin_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_users t where t.user_id = current_user_id),
      'user_plans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_plans t where t.user_id = current_user_id),
      'planned_sessions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_sessions t where t.user_id = current_user_id),
      'planned_exercises', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_exercises t where t.user_id = current_user_id),
      'session_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.performed_on), '[]'::jsonb) from public.session_logs t where t.user_id = current_user_id),
      'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_logs t where t.user_id = current_user_id),
      'set_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.set_logs t where t.user_id = current_user_id),
      'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cardio_logs t where t.user_id = current_user_id),
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id),
      'meal_plans', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.meal_plans t where t.user_id = current_user_id),
      'meal_plan_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.date, t.slot), '[]'::jsonb) from public.meal_plan_items t where t.user_id = current_user_id),
      'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.shopping_lists t where t.user_id = current_user_id),
      'shopping_list_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shopping_list_items t where t.user_id = current_user_id),
      'recipe_ratings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.recipe_ratings t where t.user_id = current_user_id),
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
