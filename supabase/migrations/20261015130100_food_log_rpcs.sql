-- Etappe E1 · Server-Funktionen des Ernährungstagebuchs (docs/PLAN-AUSWERTUNG.md Abschnitt 5, 2.7):
-- save_food_log_entries, delete_food_log_entry; consents_after_revoke() und export_my_data() erweitert.
--
-- Muster wie save_session_log (Phase 4) und save_meal_plan (N7 Teil 1): security definer + search_path = '', user_id
-- immer aus auth.uid(), nur bekannte Felder (= foodLogPayloadEntrySchema in packages/core, db-sync.test.ts), Grenzen
-- über die CHECKs der Tabelle, alles in EINER Transaktion, idempotent je write_id, optimistische Sperre je revision.
-- Fehler ohne Zeileninhalt: Fehler der Klassen 22 und 23 werden abgefangen und ohne Detail neu ausgelöst.
--
-- Einwilligung (A-G12, Wächter N7 S2): Zuerst werden die aktiven health_data-Einwilligungen FOR SHARE gesperrt, erst
-- danach geprüft und geschrieben. Ein gleichzeitiger Widerruf (revoke_health_data sperrt die Einwilligungen FOR UPDATE
-- zuerst) wartet also, bis das Speichern fertig ist, und sein Trigger löscht danach auch die gerade gespeicherten
-- Einträge; läuft der Widerruf zuerst, sieht das Speichern keine gültige Einwilligung mehr. Sperr-Reihenfolge:
-- Einwilligung → Person (Advisory, Tageslimit) → Eintrags-Zeilen. delete_food_log_entry sperrt nur die Eintrags-Zeile
-- (Löschen braucht keine Einwilligung, Recht auf Löschung).
-- „Heute“ = private.berlin_today() (in Tests fest gesetzt).

-- ---------------------------------------------------------------------------------------------------------
-- 1. save_food_log_entries(p_entries jsonb) – einziger Schreibweg für Einträge (neu oder ganz ersetzen)
-- Eingabe: Liste von 1–40 Einträgen. Antwort: Liste in derselben Reihenfolge, JE EINTRAG ein Ergebnis (Wächter E1 S2,
-- = foodLogSaveResultSchema in packages/core):
--   {"result": "saved", "id", "revision"}                                    gespeichert (auch: gleiche Fassung erneut)
--   {"result": "conflict", "reason": "revision", "id", "revision"}           anderswo geändert, nichts geschrieben
--   {"result": "conflict", "reason": "plan_item_exists", "id", "revision"}   Plan-Mahlzeit schon eingetragen (id = vorhanden)
--   {"result": "conflict", "reason": "deleted", "id": null, "revision": null} Eintrag gibt es nicht mehr
--   {"result": "rejected", "code": "invalid" | "out_of_range" | "day_full"} dieser Eintrag nicht gespeichert
-- Jeder Eintrag läuft in einem eigenen Teilschritt (Subtransaktion): Ein ungültiger Eintrag hält die übrigen nicht auf
-- (sonst bliebe ein Stapel der künftigen Offline-Warteschlange dauerhaft hängen). Für den GANZEN Aufruf abgelehnt
-- (Ausnahme): nicht angemeldet, Profil fehlt, Einwilligung fehlt, Liste ungültig (kein Array, leer, über 40, über
-- 32 KB, doppelte id).
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
          carbs_g, fat_g, revision, last_write_id
        )
        values (
          v_id, current_user_id, v_eaten_on, e ->> 'slot', v_source, e ->> 'food_id', e ->> 'recipe_id', v_title,
          (e ->> 'amount')::numeric, e ->> 'unit', (e ->> 'portion')::numeric, (e ->> 'kcal')::integer,
          (e ->> 'protein_g')::numeric, (e ->> 'carbs_g')::numeric, (e ->> 'fat_g')::numeric, new_revision, v_write_id
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
-- 2. delete_food_log_entry(p_id, p_base_revision) – nur auf Basis der gespeicherten revision; ohne Einwilligung
-- möglich (Recht auf Löschung), auch für Einträge älter als 14 Tage. Schon gelöscht = ok (idempotent).
-- Antwort: {"result": "ok" | "conflict", "id": …, "revision": …}
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_food_log_entry(p_id uuid, p_base_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  ex_id uuid;
  ex_revision integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select f.id, f.revision into ex_id, ex_revision
  from public.food_log_entries f
  where f.id = p_id and f.user_id = current_user_id
  for update;
  if not found then
    return jsonb_build_object('result', 'ok', 'id', p_id, 'revision', null);
  end if;
  if p_base_revision is distinct from ex_revision then
    return jsonb_build_object('result', 'conflict', 'id', ex_id, 'revision', ex_revision);
  end if;
  delete from public.food_log_entries f where f.id = ex_id;
  return jsonb_build_object('result', 'ok', 'id', ex_id, 'revision', null);
end;
$$;

revoke all on function public.delete_food_log_entry(uuid, integer) from public, anon;
grant execute on function public.delete_food_log_entry(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Widerruf health_data: wie 20261014120600_meal_plan_rpcs.sql, zusätzlich alle Tagebuch-Einträge löschen (2.7).
-- Favoriten bleiben (A-G14). Am Ende noch einmal (Wächter N7 S2): fängt ab, was während der Lösch-Anweisungen fertig
-- geworden ist.
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
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- 4. export_my_data() – Recht auf Auskunft (Art. 15): wie 20261014120600_meal_plan_rpcs.sql, zusätzlich
-- food_log_entries und food_log_favorites. Schlüssel von „data“ = DATA_EXPORT_TABLES (db-sync.test.ts).
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
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
