-- Phase 1 · Geräte und Lebensmittel-Vorlieben atomar ersetzen (Löschen + Einfügen in EINER Transaktion).
--
-- Die App ersetzt im Onboarding die komplette Geräteliste (je Ort) bzw. alle Vorlieben eines Bereichs.
-- Als zwei getrennte Aufrufe (DELETE, dann INSERT) könnte ein Verbindungsabbruch dazwischen die Daten leeren.
-- Ein Funktionsaufruf läuft in einer Transaktion: Scheitert das Einfügen, bleibt der alte Stand erhalten.
--
-- security invoker: Die Funktionen laufen mit den Rechten des aufrufenden Nutzers – alle RLS-Policies
-- (eigene Zeilen, Profil vorhanden, Unverträglichkeiten nur mit Einwilligung health_data) greifen weiter.
-- Fehlermeldungen enthalten keine Nutzerdaten.

-- ---------------------------------------------------------------------------------------------------------
-- user_equipment: alle Geräte des Nutzers an einem Ort ersetzen.
-- p_items: JSON-Array aus Objekten { equipment_id, weights_kg?: number[], note?: string }.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.replace_user_equipment(
  p_location public.equipment_location,
  p_items jsonb
)
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
  if p_location is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Ungültige Geräteliste.' using errcode = 'invalid_parameter_value';
  end if;

  delete from public.user_equipment
  where user_id = current_user_id and location = p_location;

  insert into public.user_equipment (user_id, equipment_id, location, weights_kg, note)
  select current_user_id, i.equipment_id, p_location, coalesce(i.weights_kg, '{}'), i.note
  from jsonb_to_recordset(p_items) as i(equipment_id text, weights_kg numeric(5, 2)[], note text);
end;
$$;

revoke all on function public.replace_user_equipment(public.equipment_location, jsonb)
  from public, anon;
grant execute on function public.replace_user_equipment(public.equipment_location, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- food_preferences: alle Vorlieben eines Bereichs ersetzen.
-- p_scope: 'taste' (mag / mag nicht) oder 'intolerance' (Unverträglichkeiten = Gesundheitsdaten).
-- p_items: JSON-Array aus Objekten { food_group, kind } – kind muss zum Bereich passen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.replace_food_preferences(p_scope text, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  scope_kinds public.food_preference_kind[];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  scope_kinds := case p_scope
    when 'taste' then array['like', 'dislike']::public.food_preference_kind[]
    when 'intolerance' then array['intolerance']::public.food_preference_kind[]
  end;
  if scope_kinds is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Ungültige Vorlieben.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(food_group text, kind public.food_preference_kind)
    where i.kind is null or not i.kind = any (scope_kinds)
  ) then
    raise exception 'Ungültige Vorlieben.' using errcode = 'invalid_parameter_value';
  end if;

  delete from public.food_preferences
  where user_id = current_user_id and kind = any (scope_kinds);

  insert into public.food_preferences (user_id, food_group, kind)
  select current_user_id, i.food_group, i.kind
  from jsonb_to_recordset(p_items) as i(food_group text, kind public.food_preference_kind);
end;
$$;

revoke all on function public.replace_food_preferences(text, jsonb) from public, anon;
grant execute on function public.replace_food_preferences(text, jsonb) to authenticated, service_role;
