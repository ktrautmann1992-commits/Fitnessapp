-- Etappe E3 · Herkunft `photo` im Ernährungstagebuch (docs/PLAN-AUSWERTUNG.md Abschnitt 9: „Erst ‚Eintragen‘ schreibt
-- ins Tagebuch (source = photo)“). Rein additiv:
-- 1. CHECK der Herkunft um 'photo' erweitert; Form-CHECK um den Zweig 'photo' (wie 'food', aber nur Gramm).
-- 2. save_food_log_entries – neueste Fassung (20261015160100_custom_meal_rpcs.sql) unverändert übernommen und nur
--    erweitert: 'photo' wird geprüft und gerechnet wie 'food' (Titel und Werte aus dem Katalog, nie von der KI und nie
--    vom Gerät), gespeichert mit Herkunft 'photo'. Jede bisherige Zeile steht unverändert darin (Abgleich per diff,
--    db-sync.test.ts).
-- Widerruf health_data (consents_after_revoke) löscht weiterhin ALLE Tagebuch-Einträge – also auch Foto-Einträge;
-- Export enthält sie über food_log_entries. Keine neue Spalte, keine neue Tabelle.

-- ---------------------------------------------------------------------------------------------------------
-- 1. CHECKs (sync: FOOD_LOG_SOURCES und refineShape in packages/core/src/nutrition/food-log.ts)
-- ---------------------------------------------------------------------------------------------------------
alter table public.food_log_entries drop constraint food_log_entries_source_check;
alter table public.food_log_entries
  add constraint food_log_entries_source_check
  check (source in ('plan_item', 'food', 'recipe', 'quick', 'custom_meal', 'photo'));

alter table public.food_log_entries drop constraint food_log_entries_shape_check;
alter table public.food_log_entries
  add constraint food_log_entries_shape_check check (
    (source = 'food'
      and food_id is not null and recipe_id is null
      and amount is not null and unit is not null and portion is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
    or (source in ('recipe', 'plan_item')
      and recipe_id is not null and food_id is null
      and portion is not null and amount is null and unit is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
    or (source = 'quick'
      and food_id is null and recipe_id is null and amount is null and unit is null and portion is null
      -- sync: QUICK_ENTRY_LABELS
      and title_de in ('Snack', 'Auswärts gegessen', 'Getränk', 'Süßes', 'Mahlzeit', 'Sonstiges')
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    -- E2: eigenes Gericht – fester Titel statt Name (sync: CUSTOM_MEAL_ENTRY_TITLE), Portion, Werte optional (Gericht
    -- ohne Werte), Makros nur mit kcal.
    or (source = 'custom_meal'
      and food_id is null and recipe_id is null and amount is null and unit is null and portion is not null
      and title_de = 'Eigenes Gericht'
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    -- E3: Foto-Bestandteil – Katalog-Lebensmittel in Gramm mit allen Werten (aus dem Katalog).
    or (source = 'photo'
      and food_id is not null and recipe_id is null
      and amount is not null and unit = 'g' and portion is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
  );

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_food_log_entries – neueste Fassung (20261015160100_custom_meal_rpcs.sql) übernommen und nur erweitert
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
      if v_source in ('food', 'photo') then
        -- E3: Foto-Bestandteil = Katalog-Lebensmittel in Gramm; Titel aus dem Katalog wie bei 'food'.
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
        -- leer (ohne unterscheidbare Meldung). Werte (unten, food_log_server_values): ein neuer Eintrag ohne vorhandenes
        -- Gericht behält die geprüften Werte des Geräts, das Ändern eines Eintrags, dessen Gericht gelöscht ist, rechnet
        -- aus seinem Schnappschuss (Wächter E2 Nachprüfung S1). FOR KEY SHARE: das Gericht kann bis zum Ende dieses
        -- Speicherns nicht gelöscht werden.
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
      -- desselben Inhalts mit gleicher Menge der Schnappschuss, ohne Quelle im Bestand verhältnisgleich daraus. Die Werte
      -- vom Gerät werden ersetzt – außer bei einem eigenen Gericht, das es nicht (mehr) gibt (dann Gerätewerte, geprüft). Schnelleintrag
      -- und Plan-Mahlzeit (Schnappschuss des Essensplans) behalten die Werte des Geräts.
      if v_source in ('food', 'recipe', 'custom_meal', 'photo') then
        -- E3: Ein Foto-Bestandteil wird wie ein Katalog-Lebensmittel geprüft und gerechnet (Werte NIE von der KI oder
        -- vom Gerät, sondern aus dem Katalog) – deshalb hier als 'food' an die bestehenden Hilfen; gespeichert wird
        -- weiter die Herkunft 'photo'. Nur Gramm (CHECK der Tabelle).
        if v_source = 'photo' and e ->> 'unit' is distinct from 'g' then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        -- Gerätewerte trotzdem in Form und Bereich prüfen (Wächter E2 Nachprüfung H3, wie E1).
        if not private.food_log_device_values_ok(
             case when v_source = 'photo' then e || '{"source": "food"}'::jsonb else e end) then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        select to_jsonb(f) into ex_row from public.food_log_entries f where f.id = ex_id;
        if ex_row ->> 'source' = 'photo' then
          ex_row := ex_row || '{"source": "food"}'::jsonb;
        end if;
        v_values := private.food_log_server_values(
          case when v_source = 'photo' then e || '{"source": "food"}'::jsonb else e end,
          ex_row, v_custom_meal_id, current_user_id);
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
