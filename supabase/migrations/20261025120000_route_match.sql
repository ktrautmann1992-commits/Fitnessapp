-- „Meine Strecken“ – gleiche Strecke wiedererkennen (Vorschlag 24.10.2026, Gründer-Entscheidung 25.10.2026;
-- docs/PLAN-PHASE-10.md Nachtrag „Meine Strecken“). NUR ADDITIV:
-- 1. tracked_routes.route_match (Text mit CHECK = ROUTE_MATCH_STATES: repeat | auto | confirmed | rejected; null =
--    nicht zugeordnet): Herkunft der Verknüpfung base_route_id. Bestand: base_route_id gesetzt → repeat.
--    tracked_routes.match_rejected_ids (uuid[], höchstens ROUTE_MATCH.maxRejected = 20): „Nein“ je Strecke gemerkt.
--    tracked_routes.auto_match (boolean, Standard true): nur bei Favoriten („Meine Strecke“) wirksam – „Neue Läufe
--    automatisch zuordnen“.
-- 2. Trigger private.tracked_routes_route_match: hält route_match und base_route_id stimmig (Verweis gesetzt ohne
--    Herkunft → repeat, z. B. save_tracked_route mit „Erneut laufen“; Verweis leer – auch durch „on delete set null“
--    beim Löschen der Strecke – → Herkunft leer, außer rejected).
-- 3. set_route_match(p_route, p_favorite, p_state): einziger Schreibweg der Zuordnung (security definer). Die Linie
--    prüft der Core auf dem Gerät (routes/match.ts, Fréchet-Abstand); der Server prüft billig: eigene Strecke, Ziel ist
--    eigener Favorit derselben Sportart, nicht sie selbst, kein Kreis, Distanz ±10 % (ROUTE_MATCH.distanceTolerance).
--    Gilt für alle Herkünfte, auch Uhr-Läufe (source = watch).
-- 4. set_route_auto_match(p_route, p_enabled): Schalter „Neue Läufe automatisch zuordnen“ einer eigenen Strecke.
-- update_tracked_route, save_tracked_route und save_wearable_route bleiben unverändert (keine neuen Fassungen).
-- Datenschutz: Strecken bleiben streng privat (RLS nur eigene Zeilen, keine neue Policy, kein Vergleich mit anderen,
-- keine Ranglisten). Export: export_my_data nimmt to_jsonb der ganzen Zeile – die Spalten sind automatisch dabei;
-- Konto löschen: Kaskade wie bisher.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Spalten
-- ---------------------------------------------------------------------------------------------------------
alter table public.tracked_routes add column route_match text;
alter table public.tracked_routes
  add constraint tracked_routes_route_match_state
  check (route_match in ('repeat', 'auto', 'confirmed', 'rejected'));
alter table public.tracked_routes add column match_rejected_ids uuid[] not null default '{}';
-- sync: ROUTE_MATCH.maxRejected in packages/core/src/constants.ts
alter table public.tracked_routes
  add constraint tracked_routes_match_rejected_max
  check (cardinality(match_rejected_ids) <= 20 and array_position(match_rejected_ids, null) is null);
alter table public.tracked_routes add column auto_match boolean not null default true;

update public.tracked_routes t set route_match = 'repeat' where t.base_route_id is not null;

-- Zugeordnet (repeat/auto/confirmed) nur mit Verweis; abgelehnt nur ohne Verweis.
alter table public.tracked_routes
  add constraint tracked_routes_route_match_link check (
    (route_match is null or route_match = 'rejected' or base_route_id is not null)
    and (route_match is distinct from 'rejected' or base_route_id is null)
  );

comment on column public.tracked_routes.route_match is
  'Herkunft der Verknüpfung base_route_id (repeat = Erneut laufen, auto = automatisch erkannt, confirmed = bestätigt) '
  'bzw. rejected („Nein“); null = nicht zugeordnet. Schreiben nur über set_route_match.';
comment on column public.tracked_routes.match_rejected_ids is
  'Eigene Strecken, die die Person für diesen Lauf abgelehnt hat (höchstens 20) – kein erneuter Vorschlag.';
comment on column public.tracked_routes.auto_match is
  'Nur bei Favoriten („Meine Strecke“): neue Läufe automatisch zuordnen. Standard true.';

-- ---------------------------------------------------------------------------------------------------------
-- 2. Trigger: Herkunft und Verweis stimmig halten
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.tracked_routes_route_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.base_route_id is null and new.route_match in ('repeat', 'auto', 'confirmed') then
    new.route_match := null;
  elsif new.base_route_id is not null and (new.route_match is null or new.route_match = 'rejected') then
    new.route_match := 'repeat';
  end if;
  return new;
end;
$$;

revoke all on function private.tracked_routes_route_match() from public, anon, authenticated;

create trigger tracked_routes_route_match
  before insert or update of base_route_id, route_match on public.tracked_routes
  for each row execute function private.tracked_routes_route_match();

-- ---------------------------------------------------------------------------------------------------------
-- 3. set_route_match(p_route, p_favorite, p_state) → neuer Stand (route_match) bzw. 'unchanged'
-- - 'auto': Erkennung auf dem Gerät. Nur wenn der Lauf noch NICHT zugeordnet ist (route_match null), der Favorit
--   nicht abgelehnt wurde und „automatisch zuordnen“ an ist – sonst 'unchanged' (Entscheidungen der Person bleiben).
-- - 'confirmed': „Ja, gehört dazu“ bzw. „Andere Strecke wählen“; nimmt den Favoriten aus der Ablehnungsliste.
-- - 'rejected': „Nein“ – Favorit in die Ablehnungsliste (höchstens 20, älteste fallen heraus); hing der Lauf an
--   diesem Favoriten, wird der Verweis leer.
-- - 'clear': „Rückgängig“ – Zuordnung leer; mit p_favorite auch aus der Ablehnungsliste.
-- Fehler ohne Werte (keine Koordinaten, keine Namen).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_route_match(p_route uuid, p_favorite uuid, p_state text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: ROUTE_MATCH.maxRejected, ROUTE_MATCH.distanceTolerance (0,1 → × 10) in packages/core/src/constants.ts
  max_rejected constant integer := 20;
  current_user_id uuid := auth.uid();
  v_route record;
  v_fav record;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_route is null or p_state is null or p_state not in ('auto', 'confirmed', 'rejected', 'clear') then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  select t.id, t.sport, t.distance_m, t.is_favorite, t.base_route_id, t.route_match, t.match_rejected_ids
  into v_route
  from public.tracked_routes t
  where t.id = p_route and t.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;

  if p_state = 'clear' then
    update public.tracked_routes t
    set base_route_id = null, route_match = null,
        match_rejected_ids = case when p_favorite is null then t.match_rejected_ids
                                  else array_remove(t.match_rejected_ids, p_favorite) end
    where t.id = p_route;
    return 'clear';
  end if;

  if p_favorite is null or p_favorite = p_route then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  select t.id, t.sport, t.distance_m, t.is_favorite, t.base_route_id, t.auto_match into v_fav
  from public.tracked_routes t
  where t.id = p_favorite and t.user_id = current_user_id
  for share;
  if not found then
    raise exception 'Die Strecke wurde nicht gefunden.' using errcode = 'invalid_parameter_value';
  end if;

  if p_state = 'rejected' then
    update public.tracked_routes t
    set match_rejected_ids = (
          select coalesce(array_agg(x order by o), '{}')
          from (
            select x, o from unnest(array_remove(t.match_rejected_ids, p_favorite) || p_favorite)
              with ordinality as u(x, o)
            order by o desc
            limit max_rejected
          ) keep
        ),
        base_route_id = case when t.base_route_id = p_favorite then null else t.base_route_id end,
        route_match = case when t.base_route_id = p_favorite or t.base_route_id is null then 'rejected'
                           else t.route_match end
    where t.id = p_route;
    return 'rejected';
  end if;

  -- Zuordnen: Ziel ist eigener Favorit derselben Sportart, ähnlich lang (±10 %), kein Kreis, der Lauf selbst ist
  -- keine „Meine Strecke“.
  if not v_fav.is_favorite or v_fav.sport <> v_route.sport or v_route.is_favorite
     or v_fav.base_route_id is not distinct from p_route
     or v_fav.distance_m <= 0
     or abs(v_route.distance_m - v_fav.distance_m)::bigint * 10 > v_fav.distance_m then
    raise exception 'Dieser Lauf passt nicht zu der Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  if p_state = 'auto' then
    if v_route.route_match is not null or v_route.base_route_id is not null or not v_fav.auto_match
       or p_favorite = any (v_route.match_rejected_ids) then
      return 'unchanged';
    end if;
    update public.tracked_routes t set base_route_id = p_favorite, route_match = 'auto' where t.id = p_route;
    return 'auto';
  end if;

  update public.tracked_routes t
  set base_route_id = p_favorite, route_match = 'confirmed',
      match_rejected_ids = array_remove(t.match_rejected_ids, p_favorite)
  where t.id = p_route;
  return 'confirmed';
end;
$$;

revoke all on function public.set_route_match(uuid, uuid, text) from public, anon;
grant execute on function public.set_route_match(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. set_route_auto_match(p_route, p_enabled): „Neue Läufe automatisch zuordnen“ einer eigenen Strecke.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_route_auto_match(p_route uuid, p_enabled boolean)
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
  if p_route is null or p_enabled is null then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  update public.tracked_routes t set auto_match = p_enabled
  where t.id = p_route and t.user_id = current_user_id;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.set_route_auto_match(uuid, boolean) from public, anon;
grant execute on function public.set_route_auto_match(uuid, boolean) to authenticated;
