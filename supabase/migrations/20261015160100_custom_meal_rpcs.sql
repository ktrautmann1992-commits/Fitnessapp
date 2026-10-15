-- Etappe E2 · Server-Funktionen der eigenen Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.7): save_custom_meal und
-- delete_custom_meal neu;
-- save_food_log_entries, consents_after_revoke() und export_my_data() in der NEUESTEN Fassung (20261015130100_food_log
-- _rpcs.sql) übernommen und nur erweitert (echte Obermenge – jede bisherige Zeile steht unverändert darin, Abgleich per
-- diff im Plan, Umsetzungsstand E2).
--
-- Muster wie save_food_log_entries (E1): security definer + search_path = '', user_id immer aus auth.uid(), nur
-- bekannte Felder (= customMealPayloadSchema in packages/core, db-sync.test.ts), idempotent je write_id, optimistische
-- Sperre je revision, Fehler OHNE Zeileninhalt und ohne Namen (Ergebnis-Codes statt Meldungen mit Werten).
-- Sperr-Reihenfolge (Wächter N7 S2): Einwilligung health_data FOR SHARE → prüfen → Person (Advisory, Obergrenze 100)
-- → Zeilen. Ein gleichzeitiger Widerruf wartet also auf das Speichern und löscht das Gericht danach; läuft er zuerst,
-- wird das Speichern abgelehnt.

-- ---------------------------------------------------------------------------------------------------------
-- 0. Werte rechnet der SERVER (Gründer-Entscheidung 15.10.2026: E1-G4 / E2-G2 „Server rechnet nach“). Die Hilfen
-- bilden die Rechnung von packages/core Schritt für Schritt in double precision nach (gleiche Reihenfolge der
-- Operationen wie JavaScript, damit auch die Rundung gleich ausfällt; Abgleich db-sync.test.ts, pgTAP 32 und der
-- Kreuzvergleich im Harness):
-- - Gramm je Einheit = gramsPerUnit (units.ts), Prise = PINCH_G,
-- - Rezept/Zutaten = computeRecipeFacts (recipe-nutrients.ts): Summe (Gramm × Wert) / 100 der nicht optionalen,
--   umrechenbaren Zutaten in Reihenfolge, ÷ Portionen,
-- - Rundung = Math.round (halbe aufwärts) bzw. round1 (eine Nachkommastelle).
-- Nicht über die API erreichbar, selbst KEIN security definer (laufen in den aufrufenden Funktionen).
-- ---------------------------------------------------------------------------------------------------------

-- Math.round für Werte ≥ 0, exakt wie JavaScript (x − floor(x) ist in double precision exakt).
create or replace function private.js_round(p_x double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case when p_x - floor(p_x) >= 0.5 then floor(p_x) + 1 else floor(p_x) end
$$;

-- round1 aus packages/core: Math.round(x × 10) / 10.
create or replace function private.js_round1(p_x double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select private.js_round(p_x * 10) / 10
$$;

-- Gramm je Einheit eines Lebensmittels (data.units); null = nicht umrechenbar. sync: gramsPerUnit, PINCH_G.
create or replace function private.grams_per_unit(p_units jsonb, p_unit text)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case p_unit
    when 'g' then 1::double precision
    when 'ml' then (p_units ->> 'ml_to_g')::double precision
    when 'piece' then (p_units ->> 'piece_g')::double precision
    when 'tbsp' then (p_units ->> 'tbsp_g')::double precision
    when 'tsp' then (p_units ->> 'tsp_g')::double precision
    when 'pinch' then 0.5::double precision
  end
$$;

-- Werte JE PORTION aus Zutaten [{food_id, amount, unit, optional?}] (Reihenfolge der Liste) = computeRecipeFacts.
-- Ergebnis {kcal, Eiweiß, Kohlenhydrate, Fett}, ungerundet. p_strict (eigene Gerichte, customMealNutrients): fehlendes
-- Lebensmittel, nicht umrechenbare Einheit oder über 2.000 g je Zutat → null; sonst (Rezepte) wird die Zutat wie im
-- Core übersprungen.
create or replace function private.ingredients_per_serving(p_items jsonb, p_servings integer, p_strict boolean)
returns double precision[]
language plpgsql
stable
set search_path = ''
as $$
declare
  -- sync: FOOD_LOG_LIMITS.gramsMax
  grams_max constant double precision := 2000;
  item jsonb;
  food_data jsonb;
  per_unit double precision;
  grams double precision;
  t_kcal double precision := 0;
  t_protein double precision := 0;
  t_carbs double precision := 0;
  t_fat double precision := 0;
begin
  for item in select x.value from jsonb_array_elements(p_items) with ordinality as x(value, ord) order by x.ord loop
    select f.data into food_data from public.foods f where f.id = item ->> 'food_id';
    if not found then
      if p_strict then return null; end if;
      continue;
    end if;
    per_unit := private.grams_per_unit(food_data -> 'units', item ->> 'unit');
    if per_unit is null then
      if p_strict then return null; end if;
      continue;
    end if;
    grams := (item ->> 'amount')::double precision * per_unit;
    if p_strict and grams > grams_max then
      return null;
    end if;
    if coalesce((item ->> 'optional')::boolean, false) then
      continue;
    end if;
    t_kcal := t_kcal + (grams * (food_data -> 'nutrients_per_100g' ->> 'kcal')::double precision) / 100;
    t_protein := t_protein + (grams * (food_data -> 'nutrients_per_100g' ->> 'protein_g')::double precision) / 100;
    t_carbs := t_carbs + (grams * (food_data -> 'nutrients_per_100g' ->> 'carbs_g')::double precision) / 100;
    t_fat := t_fat + (grams * (food_data -> 'nutrients_per_100g' ->> 'fat_g')::double precision) / 100;
  end loop;
  return array[t_kcal / p_servings, t_protein / p_servings, t_carbs / p_servings, t_fat / p_servings];
end;
$$;

-- Werte eines Tagebuch-Eintrags (Lebensmittel, Rezept, eigenes Gericht) aus dem Bestand – wie entryFromFood,
-- entryFromRecipe, entryFromCustomMeal; beim Ändern DESSELBEN Inhalts (gleiche Herkunft, gleicher Verweis, gleiche
-- Einheit) verhältnisgleich aus dem gespeicherten Schnappschuss wie rescaleEntry (der Schnappschuss bleibt, auch wenn
-- sich Katalog oder Gericht inzwischen geändert haben). null = nicht berechenbar (Eintrag wird abgelehnt).
-- Antwort {"kcal", "protein_g", "carbs_g", "fat_g"} (Werte bzw. null).
create or replace function private.food_log_server_values(
  p_entry jsonb, p_old jsonb, p_custom_meal_id uuid, p_user_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  -- sync: FOOD_LOG_LIMITS.gramsMax
  grams_max constant double precision := 2000;
  src text := p_entry ->> 'source';
  factor double precision;
  food_data jsonb;
  per_unit double precision;
  grams double precision;
  per double precision[];
  portion double precision;
  r_servings integer;
  m_kcal double precision;
  m_protein double precision;
  m_carbs double precision;
  m_fat double precision;
  found_meal boolean;
begin
  if src not in ('food', 'recipe', 'custom_meal') then
    return null;
  end if;
  -- Ändern desselben Inhalts: Schnappschuss × (neue Menge bzw. Portion ÷ alte) – wie rescaleEntry/scaled().
  if p_old is not null
     and p_old ->> 'source' = src
     and (p_old ->> 'food_id') is not distinct from (p_entry ->> 'food_id')
     and (p_old ->> 'recipe_id') is not distinct from (p_entry ->> 'recipe_id')
     and (p_old ->> 'custom_meal_id') is not distinct from (p_entry ->> 'custom_meal_id')
     and (p_old ->> 'unit') is not distinct from (p_entry ->> 'unit') then
    factor := case when src = 'food'
                then (p_entry ->> 'amount')::double precision / (p_old ->> 'amount')::double precision
                else (p_entry ->> 'portion')::double precision / (p_old ->> 'portion')::double precision end;
    return jsonb_build_object(
      'kcal', private.js_round((p_old ->> 'kcal')::double precision * factor),
      'protein_g', private.js_round1((p_old ->> 'protein_g')::double precision * factor),
      'carbs_g', private.js_round1((p_old ->> 'carbs_g')::double precision * factor),
      'fat_g', private.js_round1((p_old ->> 'fat_g')::double precision * factor));
  end if;
  if src = 'food' then
    -- entryFromFood: Gramm = Menge × Gramm je Einheit (höchstens 2.000 g), Faktor = Gramm / 100.
    select f.data into food_data from public.foods f where f.id = p_entry ->> 'food_id';
    if not found then return null; end if;
    per_unit := private.grams_per_unit(food_data -> 'units', p_entry ->> 'unit');
    if per_unit is null then return null; end if;
    grams := (p_entry ->> 'amount')::double precision * per_unit;
    if grams > grams_max then return null; end if;
    factor := grams / 100;
    return jsonb_build_object(
      'kcal', private.js_round((food_data -> 'nutrients_per_100g' ->> 'kcal')::double precision * factor),
      'protein_g', private.js_round1((food_data -> 'nutrients_per_100g' ->> 'protein_g')::double precision * factor),
      'carbs_g', private.js_round1((food_data -> 'nutrients_per_100g' ->> 'carbs_g')::double precision * factor),
      'fat_g', private.js_round1((food_data -> 'nutrients_per_100g' ->> 'fat_g')::double precision * factor));
  end if;
  portion := (p_entry ->> 'portion')::double precision;
  if src = 'recipe' then
    -- entryFromRecipe: Werte je Portion aus den Zutaten (computeRecipeFacts) × Portionen.
    select r.servings into r_servings from public.recipes r where r.id = p_entry ->> 'recipe_id';
    if not found then return null; end if;
    per := private.ingredients_per_serving(
      (select coalesce(jsonb_agg(jsonb_build_object('food_id', i.food_id, 'amount', i.amount, 'unit', i.unit,
                                                    'optional', i.optional) order by i.position), '[]'::jsonb)
       from public.recipe_ingredients i where i.recipe_id = p_entry ->> 'recipe_id'),
      r_servings, false);
    return jsonb_build_object(
      'kcal', private.js_round(per[1] * portion),
      'protein_g', private.js_round1(per[2] * portion),
      'carbs_g', private.js_round1(per[3] * portion),
      'fat_g', private.js_round1(per[4] * portion));
  end if;
  -- entryFromCustomMeal: Werte je Portion des eigenen Gerichts × Portion; ohne Werte bleibt ohne Werte.
  if p_custom_meal_id is null then return null; end if;
  select m.kcal, m.protein_g, m.carbs_g, m.fat_g into m_kcal, m_protein, m_carbs, m_fat
  from public.custom_meals m where m.id = p_custom_meal_id and m.user_id = p_user_id;
  found_meal := found;
  if not found_meal then return null; end if;
  return jsonb_build_object(
    'kcal', private.js_round(m_kcal * portion),
    'protein_g', case when m_kcal is null then null else private.js_round1(m_protein * portion) end,
    'carbs_g', case when m_kcal is null then null else private.js_round1(m_carbs * portion) end,
    'fat_g', case when m_kcal is null then null else private.js_round1(m_fat * portion) end);
end;
$$;

revoke all on function private.js_round(double precision) from public;
revoke all on function private.js_round1(double precision) from public;
revoke all on function private.grams_per_unit(jsonb, text) from public;
revoke all on function private.ingredients_per_serving(jsonb, integer, boolean) from public;
revoke all on function private.food_log_server_values(jsonb, jsonb, uuid, uuid) from public;

-- ---------------------------------------------------------------------------------------------------------
-- 1. save_custom_meal(p_meal jsonb) – einziger Schreibweg für Gerichte (neu oder ganz ersetzen, Zutaten inklusive).
-- Eingabe = customMealPayloadSchema. Antwort (= customMealSaveResultSchema):
--   {"result": "saved", "id", "revision", "kcal", "protein_g", "carbs_g", "fat_g"} gespeichert (auch: gleiche Fassung
--                                                                             erneut) – mit den GESPEICHERTEN Werten
--   {"result": "conflict", "reason": "revision", "id", "revision"}            anderswo geändert, nichts geschrieben
--   {"result": "conflict", "reason": "deleted", "id": null, "revision": null} Gericht gibt es nicht mehr
--   {"result": "rejected", "code": "invalid" | "limit"}                       ungültig bzw. schon 100 Gerichte
-- Ausnahme (ganzer Aufruf): nicht angemeldet, Profil fehlt, Einwilligung fehlt.
-- Werte (entschieden 15.10.2026, E2-G2): Bei `ingredients` rechnet der SERVER die Werte je Portion aus den Zutaten
-- (private.ingredients_per_serving, gleiche Rechnung wie customMealNutrients); vom Gerät gesendete Werte werden
-- ignoriert, die Antwort nennt die gespeicherten. Bei `direct` gelten die eingegebenen Werte. Zutaten: nur Lebensmittel des Katalogs mit Status `published`; ein inzwischen
-- archiviertes Lebensmittel bleibt nur erlaubt, wenn es schon in DIESEM Gericht steckt (Umbenennen bleibt möglich).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_custom_meal(p_meal jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Felder = customMealPayloadSchema (db-sync.test.ts). NICHT erlaubt: user_id (auth.uid()), revision (Server),
  -- Zeitstempel (Server).
  meal_fields constant jsonb := '{
    "id": "string", "write_id": "string", "base_revision": "number|null", "name_de": "string", "mode": "string",
    "servings": "number", "kcal": "number|null", "protein_g": "number|null", "carbs_g": "number|null",
    "fat_g": "number|null", "items": "array"
  }';
  -- Felder = customMealItemSchema
  item_fields constant jsonb := '{"food_id": "string", "amount": "number", "unit": "string"}';
  -- sync: CUSTOM_MEAL_LIMITS in packages/core/src/constants.ts
  max_meals constant integer := 100;
  max_items constant integer := 30;
  payload_max_bytes constant integer := 16000;
  current_user_id uuid := auth.uid();
  v_id uuid;
  v_write_id uuid;
  v_base_revision integer;
  v_mode text;
  v_items jsonb;
  item jsonb;
  -- Bestehendes Gericht als einzelne Werte (keine Record-Variable, Wächter N1).
  ex_id uuid;
  ex_revision integer;
  ex_write_id uuid;
  has_existing boolean;
  new_revision integer;
  meal_count integer;
  per double precision[];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Zuerst die Einwilligung sperren, dann prüfen (gleiche Reihenfolge wie revoke_health_data, Wächter N7 S2).
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Obergrenze 100 ohne Wettlauf: je Person nacheinander (nach der Einwilligung, vor den Zeilen).
  perform pg_advisory_xact_lock(hashtext('custom_meals|' || current_user_id::text));

  -- Eigener Teilschritt: Fehler machen alles in diesem Aufruf rückgängig und werden zu einem Code OHNE Werte und
  -- ohne Namen (kein „Failing row contains …“ an den Client oder ins Log).
  begin
    if jsonb_typeof(p_meal) is distinct from 'object' or octet_length(p_meal::text) > payload_max_bytes then
      raise exception 'Ungültiges eigenes Gericht.' using errcode = 'invalid_parameter_value';
    end if;
    perform private.assert_log_fields(p_meal, meal_fields);
    v_items := p_meal -> 'items';
    if jsonb_array_length(v_items) > max_items then
      raise exception 'Ungültiges eigenes Gericht.' using errcode = 'invalid_parameter_value';
    end if;
    for item in select value from jsonb_array_elements(v_items) loop
      perform private.assert_log_fields(item, item_fields);
    end loop;
    v_mode := p_meal ->> 'mode';
    -- Zutaten je Art: direkt keine, aus Zutaten mindestens eine (die übrige Form prüfen die CHECKs).
    if (v_mode = 'direct' and jsonb_array_length(v_items) <> 0)
       or (v_mode = 'ingredients' and jsonb_array_length(v_items) < 1) then
      raise exception 'Ungültiges eigenes Gericht.' using errcode = 'invalid_parameter_value';
    end if;
    -- Zahlen VOR der Umwandlung prüfen (sonst würde still gerundet): kcal und Portionen ganz, Makros und Mengen höchstens
    -- eine Nachkommastelle.
    if (p_meal ->> 'servings')::numeric <> trunc((p_meal ->> 'servings')::numeric)
       or (jsonb_typeof(p_meal -> 'kcal') = 'number'
           and (p_meal ->> 'kcal')::numeric <> trunc((p_meal ->> 'kcal')::numeric))
       or exists (
         select 1 from unnest(array['protein_g', 'carbs_g', 'fat_g']) k
         where jsonb_typeof(p_meal -> k) = 'number'
           and (p_meal ->> k)::numeric * 10 <> trunc((p_meal ->> k)::numeric * 10)
       )
       or exists (
         select 1 from jsonb_array_elements(v_items) x
         where (x ->> 'amount')::numeric * 10 <> trunc((x ->> 'amount')::numeric * 10)
       ) then
      raise exception 'Ungültiges eigenes Gericht.' using errcode = 'check_violation';
    end if;
    v_id := (p_meal ->> 'id')::uuid;
    v_write_id := (p_meal ->> 'write_id')::uuid;
    v_base_revision := (p_meal ->> 'base_revision')::integer;

    select m.id, m.revision, m.last_write_id into ex_id, ex_revision, ex_write_id
    from public.custom_meals m
    where m.id = v_id and m.user_id = current_user_id
    for update;
    has_existing := found;

    -- Idempotenz: dieselbe Fassung erneut gesendet → saved mit aktueller revision, nichts ändern.
    if has_existing and ex_write_id = v_write_id then
      return jsonb_build_object('result', 'saved', 'id', ex_id, 'revision', ex_revision) || (
        select jsonb_build_object('kcal', m.kcal, 'protein_g', m.protein_g, 'carbs_g', m.carbs_g, 'fat_g', m.fat_g)
        from public.custom_meals m where m.id = ex_id);
    end if;
    -- Optimistische Sperre: Ändern nur auf Basis der gespeicherten revision; neu nur ohne Zeile.
    if has_existing and v_base_revision is distinct from ex_revision then
      return jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', ex_id, 'revision', ex_revision);
    end if;
    if not has_existing and v_base_revision is not null then
      return jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null);
    end if;

    -- Werte aus Zutaten rechnet der Server (E2-G2); nicht berechenbar (Einheit, über 2.000 g) → ungültig.
    if v_mode = 'ingredients' then
      per := private.ingredients_per_serving(v_items, (p_meal ->> 'servings')::integer, true);
      if per is null then
        raise exception 'Ungültiges eigenes Gericht.' using errcode = 'invalid_parameter_value';
      end if;
      p_meal := p_meal || jsonb_build_object(
        'kcal', private.js_round(per[1]),
        'protein_g', private.js_round1(per[2]),
        'carbs_g', private.js_round1(per[3]),
        'fat_g', private.js_round1(per[4]));
    end if;

    -- Zutaten nur aus dem Katalog: freigegeben, oder archiviert und schon in diesem Gericht (Schnappschuss bleibt).
    if exists (
      select 1
      from jsonb_array_elements(v_items) x
      left join public.foods f on f.id = x ->> 'food_id'
      where f.id is null
         or (f.status <> 'published'
             and not exists (
               select 1 from public.custom_meal_items i
               where i.meal_id = ex_id and i.user_id = current_user_id and i.food_id = f.id
             ))
    ) then
      raise exception 'Ungültiges eigenes Gericht.' using errcode = 'invalid_parameter_value';
    end if;

    if has_existing then
      new_revision := ex_revision + 1;
      update public.custom_meals m
      set name_de = p_meal ->> 'name_de',
          mode = v_mode,
          servings = (p_meal ->> 'servings')::integer,
          kcal = (p_meal ->> 'kcal')::integer,
          protein_g = (p_meal ->> 'protein_g')::numeric,
          carbs_g = (p_meal ->> 'carbs_g')::numeric,
          fat_g = (p_meal ->> 'fat_g')::numeric,
          revision = new_revision,
          last_write_id = v_write_id
      where m.id = ex_id;
      delete from public.custom_meal_items i where i.meal_id = ex_id;
    else
      -- Die id erzeugt das Gerät; ist sie schon vergeben (fremdes Gericht), vergibt der Server eine neue – ohne
      -- unterscheidbare Meldung (die App übernimmt die id aus der Antwort).
      if exists (select 1 from public.custom_meals m where m.id = v_id) then
        v_id := gen_random_uuid();
      end if;
      new_revision := 1;
      insert into public.custom_meals (
        id, user_id, name_de, mode, servings, kcal, protein_g, carbs_g, fat_g, revision, last_write_id
      )
      values (
        v_id, current_user_id, p_meal ->> 'name_de', v_mode, (p_meal ->> 'servings')::integer,
        (p_meal ->> 'kcal')::integer, (p_meal ->> 'protein_g')::numeric, (p_meal ->> 'carbs_g')::numeric,
        (p_meal ->> 'fat_g')::numeric, new_revision, v_write_id
      );
    end if;
    insert into public.custom_meal_items (meal_id, user_id, order_no, food_id, amount, unit)
    select v_id, current_user_id, t.ord::integer, t.x ->> 'food_id', (t.x ->> 'amount')::numeric, t.x ->> 'unit'
    from jsonb_array_elements(v_items) with ordinality as t(x, ord);

    -- Höchstens 100 Gerichte je Person (nach dem Schreiben gezählt; die Advisory-Sperre schließt Wettläufe aus).
    select count(*) into meal_count from public.custom_meals m where m.user_id = current_user_id;
    if meal_count > max_meals then
      raise exception 'Zu viele eigene Gerichte.' using errcode = 'program_limit_exceeded';
    end if;
    return jsonb_build_object('result', 'saved', 'id', v_id, 'revision', new_revision) || (
      select jsonb_build_object('kcal', m.kcal, 'protein_g', m.protein_g, 'carbs_g', m.carbs_g, 'fat_g', m.fat_g)
      from public.custom_meals m where m.id = v_id);
  exception
    when program_limit_exceeded then
      return jsonb_build_object('result', 'rejected', 'code', 'limit');
    when data_exception or integrity_constraint_violation then
      return jsonb_build_object('result', 'rejected', 'code', 'invalid');
  end;
end;
$$;

revoke all on function public.save_custom_meal(jsonb) from public, anon;
grant execute on function public.save_custom_meal(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1b. delete_custom_meal(p_id) – einziger Löschweg für Gerichte (Wächter E2 S1). Geht OHNE Einwilligung (Recht auf
-- Löschung), auch für fremde oder schon gelöschte ids (dann ohne Wirkung, gleiche Antwort – nichts unterscheidbar).
-- Sperr-Reihenfolge wie save_food_log_entries und der Widerruf, damit sich die Wege nicht gegenseitig blockieren
-- (sonst Deadlock: direktes DELETE sperrte erst das Gericht, dann per „on delete set null“ die Einträge):
--   1. Person (dieselbe Advisory-Sperre wie save_food_log_entries – Speichern und Löschen laufen nacheinander),
--   2. die Tagebuch-Einträge mit diesem Verweis (FOR UPDATE),
--   3. das Gericht (FOR UPDATE), dann löschen (Zutaten per Kaskade, Verweise werden leer).
-- Die Einwilligung wird NICHT gesperrt (Löschen braucht keine); der Widerruf sperrt Einwilligung → Einträge →
-- Gerichte, also dieselbe Richtung Einträge vor Gericht.
-- Antwort: {"result": "ok", "id": p_id}
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_custom_meal(p_id uuid)
returns jsonb
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
  perform pg_advisory_xact_lock(hashtext('food_log|' || current_user_id::text));
  perform 1
  from public.food_log_entries f
  where f.user_id = current_user_id and f.custom_meal_id = p_id
  order by f.id
  for update;
  perform 1
  from public.custom_meals m
  where m.id = p_id and m.user_id = current_user_id
  for update;
  delete from public.custom_meals m where m.id = p_id and m.user_id = current_user_id;
  return jsonb_build_object('result', 'ok', 'id', p_id);
end;
$$;

revoke all on function public.delete_custom_meal(uuid) from public, anon;
grant execute on function public.delete_custom_meal(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_food_log_entries – neueste Fassung (20261015130100_food_log_rpcs.sql) unverändert übernommen und nur
-- erweitert: Feld custom_meal_id (fehlt es, gilt null – ältere Geräte bleiben gültig), Herkunft `custom_meal` mit
-- festem Titel „Eigenes Gericht“ (nie vom Gerät, nie der Name) und Verweis nur auf ein eigenes Gericht.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_food_log_entries(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Felder = foodLogPayloadEntrySchema (db-sync.test.ts). NICHT erlaubt: user_id (auth.uid()), revision (Server),
  -- Zeitstempel (Server).
  entry_fields constant jsonb := '{
    "id": "string", "write_id": "string", "base_revision": "number|null", "eaten_on": "string",
    "slot": "string", "source": "string", "food_id": "string|null", "recipe_id": "string|null",
    "title_de": "string", "amount": "number|null", "unit": "string|null", "portion": "number|null",
    "custom_meal_id": "string|null|missing",
    "kcal": "number|null", "protein_g": "number|null", "carbs_g": "number|null", "fat_g": "number|null"
  }';
  -- sync: FOOD_LOG_LIMITS in packages/core/src/constants.ts
  backdate_days constant integer := 14;
  server_future_days constant integer := 1;
  max_entries_per_day constant integer := 40;
  max_entries_per_save constant integer := 40;
  payload_max_bytes constant integer := 32000;
  iso_date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  results jsonb := '[]'::jsonb;
  e jsonb;
  v_id uuid;
  v_write_id uuid;
  v_base_revision integer;
  v_eaten_on date;
  v_source text;
  v_title text;
  -- E2: Verweis auf das eigene Gericht (null = keins bzw. nicht (mehr) vorhanden).
  v_custom_meal_id uuid;
  -- E1-G4/E2-G2 (entschieden 15.10.2026): gespeicherter Eintrag als jsonb (keine Record-Variable) und Server-Werte.
  ex_row jsonb;
  v_values jsonb;
  -- Bestehender Eintrag als einzelne Werte (keine Record-Variable, Wächter N1): null = keiner.
  ex_id uuid;
  ex_revision integer;
  ex_write_id uuid;
  ex_eaten_on date;
  has_existing boolean;
  -- Vorhandene Plan-Mahlzeit desselben Tags und Platzes (anderes Gerät).
  pi_id uuid;
  pi_revision integer;
  new_revision integer;
  day_count integer;
  err_message text;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Zuerst die Einwilligung sperren, dann prüfen (gleiche Reihenfolge wie revoke_health_data, Wächter N7 S2).
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Tageslimit ohne Wettlauf: je Person nacheinander (nach der Einwilligung, vor den Zeilen).
  perform pg_advisory_xact_lock(hashtext('food_log|' || current_user_id::text));

  -- Die Liste als Ganzes (Fehler ohne Inhalte).
  begin
    if jsonb_typeof(p_entries) is distinct from 'array' then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
    end if;
    if octet_length(p_entries::text) > payload_max_bytes
       or jsonb_array_length(p_entries) not between 1 and max_entries_per_save
       or (select count(distinct x ->> 'id') <> count(*) from jsonb_array_elements(p_entries) x) then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
    end if;
  exception
    when data_exception or integrity_constraint_violation then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = sqlstate;
  end;

  for e in select value from jsonb_array_elements(p_entries) loop
    -- Eigener Teilschritt je Eintrag: Fehler machen nur DIESEN Eintrag rückgängig. `results` wird erst am Ende eines
    -- erfolgreichen Teilschritts ergänzt (Variablen werden bei einem Rücksprung nicht zurückgesetzt).
    begin
      perform private.assert_log_fields(e, entry_fields);
      if (e ->> 'eaten_on') !~ iso_date_pattern then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      v_id := (e ->> 'id')::uuid;
      v_write_id := (e ->> 'write_id')::uuid;
      v_base_revision := (e ->> 'base_revision')::integer;
      v_eaten_on := (e ->> 'eaten_on')::date;
      v_source := e ->> 'source';
      v_custom_meal_id := null;

      select f.id, f.revision, f.last_write_id, f.eaten_on into ex_id, ex_revision, ex_write_id, ex_eaten_on
      from public.food_log_entries f
      where f.id = v_id and f.user_id = current_user_id
      for update;
      has_existing := found;

      -- Idempotenz: dieselbe Fassung erneut gesendet → saved mit aktueller revision, nichts ändern (auch nach Ablauf
      -- des Fensters).
      if has_existing and ex_write_id = v_write_id then
        results := results || jsonb_build_array(
          jsonb_build_object('result', 'saved', 'id', ex_id, 'revision', ex_revision));
        continue;
      end if;
      -- Optimistische Sperre: Ändern nur auf Basis der gespeicherten revision; neu nur ohne Zeile. Gibt es den Eintrag
      -- nicht mehr (anderswo gelöscht), sind id und revision null (Wächter E1 H1).
      if has_existing and v_base_revision is distinct from ex_revision then
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'conflict', 'reason', 'revision', 'id', ex_id, 'revision', ex_revision));
        continue;
      end if;
      if not has_existing and v_base_revision is not null then
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null));
        continue;
      end if;

      -- Datumsfenster: höchstens 14 Tage zurück, nie in die Zukunft (1 Tag Toleranz für die Gerätezeit). Ein Eintrag
      -- älter als 14 Tage ist nicht mehr änderbar (Löschen geht immer).
      if v_eaten_on < today - backdate_days or v_eaten_on > today + server_future_days
         or ex_eaten_on < today - backdate_days then
        raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;

      -- Zahlen: höchstens eine bzw. zwei Nachkommastellen VOR der Umwandlung (sonst würde still gerundet); kcal ganz.
      if (jsonb_typeof(e -> 'kcal') = 'number' and (e ->> 'kcal')::numeric <> trunc((e ->> 'kcal')::numeric))
         or exists (
           select 1 from unnest(array['protein_g', 'carbs_g', 'fat_g', 'amount']) k
           where jsonb_typeof(e -> k) = 'number' and (e ->> k)::numeric * 10 <> trunc((e ->> k)::numeric * 10)
         )
         or (jsonb_typeof(e -> 'portion') = 'number'
             and (e ->> 'portion')::numeric * 4 <> trunc((e ->> 'portion')::numeric * 4)) then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'check_violation';
      end if;

      -- „Gegessen“ an derselben Plan-Mahlzeit von einem anderen Gerät (eigene id): kein Fehler, sondern Konflikt mit
      -- dem vorhandenen Eintrag – die App übernimmt ihn (Plan 5: doppelt abgehakt = idempotent).
      if v_source = 'plan_item' then
        select f.id, f.revision into pi_id, pi_revision
        from public.food_log_entries f
        where f.user_id = current_user_id and f.eaten_on = v_eaten_on and f.slot = e ->> 'slot'
          and f.source = 'plan_item' and f.id <> v_id;
        if found then
          results := results || jsonb_build_array(jsonb_build_object(
            'result', 'conflict', 'reason', 'plan_item_exists', 'id', pi_id, 'revision', pi_revision));
          continue;
        end if;
      end if;

      -- Verweis auf ein eigenes Gericht nur bei dieser Herkunft (E2).
      if v_source <> 'custom_meal' and e ->> 'custom_meal_id' is not null then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
      end if;

      -- Nur Inhalte aus dem Katalog (freigegeben bzw. früher freigegeben = archiviert; Entwürfe liegen nie in der
      -- Datenbank). Der Titel kommt bei Katalog, Rezept und Plan-Mahlzeit aus dem Katalog – nie vom Gerät; beim
      -- Schnelleintrag aus der festen Liste (CHECK der Tabelle).
      if v_source = 'food' then
        select f.name_de into v_title from public.foods f where f.id = e ->> 'food_id';
        if not found then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      elsif v_source in ('recipe', 'plan_item') then
        select r.title_de into v_title from public.recipes r where r.id = e ->> 'recipe_id';
        if not found then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      elsif v_source = 'custom_meal' then
        -- E2: Titel immer fest (kein Freitext im Tagebuch, nie der Name des Gerichts). Der Verweis gilt nur für ein
        -- eigenes Gericht DIESER Person; gibt es das nicht (mehr) – anderswo gelöscht oder fremd –, bleibt der Verweis
        -- leer (ohne unterscheidbare Meldung). Die Werte rechnet der Server (unten): ein NEUER Eintrag ohne vorhandenes
        -- Gericht ist dann nicht berechenbar und wird abgelehnt; das Ändern eines Eintrags, dessen Gericht gelöscht
        -- ist, rechnet aus seinem Schnappschuss. FOR KEY SHARE: das Gericht kann bis zum Ende dieses Speicherns nicht
        -- gelöscht werden.
        v_title := 'Eigenes Gericht';
        select m.id into v_custom_meal_id
        from public.custom_meals m
        where m.id = (e ->> 'custom_meal_id')::uuid and m.user_id = current_user_id
        for key share;
      else
        v_title := e ->> 'title_de';
      end if;

      -- Werte rechnet der SERVER (Gründer-Entscheidung 15.10.2026, E1-G4/E2-G2) für Lebensmittel, Rezept und eigenes
      -- Gericht aus dem Bestand (private.food_log_server_values, gleiche Rechnung wie packages/core); beim Ändern
      -- desselben Inhalts verhältnisgleich aus dem Schnappschuss. Die Werte vom Gerät werden ersetzt. Schnelleintrag
      -- und Plan-Mahlzeit (Schnappschuss des Essensplans) behalten die Werte des Geräts.
      if v_source in ('food', 'recipe', 'custom_meal') then
        select to_jsonb(f) into ex_row from public.food_log_entries f where f.id = ex_id;
        v_values := private.food_log_server_values(e, ex_row, v_custom_meal_id, current_user_id);
        if v_values is null then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        e := e || v_values;
      end if;

      if has_existing then
        new_revision := ex_revision + 1;
        update public.food_log_entries f
        set eaten_on = v_eaten_on,
            slot = e ->> 'slot',
            source = v_source,
            food_id = e ->> 'food_id',
            recipe_id = e ->> 'recipe_id',
            title_de = v_title,
            custom_meal_id = v_custom_meal_id,
            amount = (e ->> 'amount')::numeric,
            unit = e ->> 'unit',
            portion = (e ->> 'portion')::numeric,
            kcal = (e ->> 'kcal')::integer,
            protein_g = (e ->> 'protein_g')::numeric,
            carbs_g = (e ->> 'carbs_g')::numeric,
            fat_g = (e ->> 'fat_g')::numeric,
            revision = new_revision,
            last_write_id = v_write_id
        where f.id = ex_id;
      else
        -- Die id erzeugt das Gerät; ist sie schon vergeben (fremder Eintrag), vergibt der Server eine neue – ohne
        -- unterscheidbare Meldung (die App übernimmt die id aus der Antwort).
        if exists (select 1 from public.food_log_entries f where f.id = v_id) then
          v_id := gen_random_uuid();
        end if;
        new_revision := 1;
        insert into public.food_log_entries (
          id, user_id, eaten_on, slot, source, food_id, recipe_id, title_de, amount, unit, portion, kcal, protein_g,
          carbs_g, fat_g, revision, last_write_id,
          custom_meal_id
        )
        values (
          v_id, current_user_id, v_eaten_on, e ->> 'slot', v_source, e ->> 'food_id', e ->> 'recipe_id', v_title,
          (e ->> 'amount')::numeric, e ->> 'unit', (e ->> 'portion')::numeric, (e ->> 'kcal')::integer,
          (e ->> 'protein_g')::numeric, (e ->> 'carbs_g')::numeric, (e ->> 'fat_g')::numeric, new_revision, v_write_id,
          v_custom_meal_id
        );
      end if;

      -- Höchstens 40 Einträge je Tag (nach dem Schreiben gezählt; die Advisory-Sperre schließt Wettläufe aus).
      select count(*) into day_count
      from public.food_log_entries f
      where f.user_id = current_user_id and f.eaten_on = v_eaten_on;
      if day_count > max_entries_per_day then
        raise exception 'Zu viele Einträge an diesem Tag.' using errcode = 'program_limit_exceeded';
      end if;

      results := results || jsonb_build_array(
        jsonb_build_object('result', 'saved', 'id', v_id, 'revision', new_revision));
    exception
      -- Nur DIESER Eintrag wird zurückgerollt; Meldung bzw. Code ohne Werte (kein Zeileninhalt, kein Gesundheitsbezug).
      when program_limit_exceeded then
        results := results || jsonb_build_array(jsonb_build_object('result', 'rejected', 'code', 'day_full'));
      when data_exception or integrity_constraint_violation then
        get stacked diagnostics err_message = message_text;
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'rejected',
          'code', case when err_message = 'Das Datum liegt außerhalb des erlaubten Zeitraums.' then 'out_of_range'
                       else 'invalid' end));
    end;
  end loop;
  return results;
end;
$$;

revoke all on function public.save_food_log_entries(jsonb) from public, anon;
grant execute on function public.save_food_log_entries(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Widerruf health_data – neueste Fassung (20261015130100_food_log_rpcs.sql) unverändert übernommen und nur
-- erweitert: eigene Gerichte werden gelöscht (am Anfang und am Ende, wie die Tagebuch-Einträge; Zutaten per Kaskade).
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
    -- Ernährungstagebuch (E1, A-G12): alle Einträge. Favoriten: Schnell-Favoriten enthalten Bezeichnung + kcal
    -- („Süßes 250 kcal“) und gehen mit (Wächter E1 G1, sichere Voreinstellung); Katalog-/Rezept-Favoriten speichern
    -- keine Werte (S1) und bleiben (A-G14).
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';
    -- Eigene Gerichte (E2): Name ist Freitext, Werte selbst eingegeben – sichere Voreinstellung wie die
    -- Schnell-Favoriten (Wächter E1 G1): gelöscht, Zutaten per Kaskade (Gründer-Frage E2-G1 im Plan).
    delete from public.custom_meals where user_id = new.user_id;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
    -- Ebenso Pläne, Listen und Tagebuch (Wächter N7 S2): Die speichernden Funktionen sperren die Einwilligung FOR
    -- SHARE, der Widerruf wartet also auf sie; jede Anweisung sieht danach den neuesten Stand. Die Wiederholung fängt
    -- zusätzlich ab, was während der Lösch-Anweisungen oben fertig geworden ist.
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.custom_meals where user_id = new.user_id;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- 4. export_my_data() – neueste Fassung (20261015130100_food_log_rpcs.sql) unverändert übernommen und nur erweitert:
-- custom_meals und custom_meal_items. Schlüssel von „data“ = DATA_EXPORT_TABLES (db-sync.test.ts).
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
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id),
      'food_log_entries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.eaten_on, t.created_at), '[]'::jsonb) from public.food_log_entries t where t.user_id = current_user_id),
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id),
      'custom_meals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.custom_meals t where t.user_id = current_user_id),
      'custom_meal_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.meal_id, t.order_no), '[]'::jsonb) from public.custom_meal_items t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
