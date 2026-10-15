-- Etappe E2 · Server-Funktionen der eigenen Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.7): save_custom_meal neu;
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
-- 1. save_custom_meal(p_meal jsonb) – einziger Schreibweg für Gerichte (neu oder ganz ersetzen, Zutaten inklusive).
-- Eingabe = customMealPayloadSchema. Antwort (= customMealSaveResultSchema):
--   {"result": "saved", "id", "revision"}                                     gespeichert (auch: gleiche Fassung erneut)
--   {"result": "conflict", "reason": "revision", "id", "revision"}            anderswo geändert, nichts geschrieben
--   {"result": "conflict", "reason": "deleted", "id": null, "revision": null} Gericht gibt es nicht mehr
--   {"result": "rejected", "code": "invalid" | "limit"}                       ungültig bzw. schon 100 Gerichte
-- Ausnahme (ganzer Aufruf): nicht angemeldet, Profil fehlt, Einwilligung fehlt.
-- Werte: Bei `ingredients` sind die Werte je Portion der Schnappschuss des Geräts (Core rechnet mit derselben
-- Rechnung wie Rezepte); der Server prüft Form und Grenzen, rechnet aber nicht nach (wie save_food_log_entries,
-- Gründer-Frage G4 aus E1). Zutaten: nur Lebensmittel des Katalogs mit Status `published`; ein inzwischen
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
      return jsonb_build_object('result', 'saved', 'id', ex_id, 'revision', ex_revision);
    end if;
    -- Optimistische Sperre: Ändern nur auf Basis der gespeicherten revision; neu nur ohne Zeile.
    if has_existing and v_base_revision is distinct from ex_revision then
      return jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', ex_id, 'revision', ex_revision);
    end if;
    if not has_existing and v_base_revision is not null then
      return jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null);
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
    return jsonb_build_object('result', 'saved', 'id', v_id, 'revision', new_revision);
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
        -- eigenes Gericht DIESER Person; gibt es das nicht (mehr) – anderswo gelöscht oder fremd –, bleibt der Eintrag
        -- ohne Verweis (Schnappschuss, ohne unterscheidbare Meldung). FOR KEY SHARE: das Gericht kann bis zum Ende
        -- dieses Speicherns nicht gelöscht werden.
        v_title := 'Eigenes Gericht';
        select m.id into v_custom_meal_id
        from public.custom_meals m
        where m.id = (e ->> 'custom_meal_id')::uuid and m.user_id = current_user_id
        for key share;
      else
        v_title := e ->> 'title_de';
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
