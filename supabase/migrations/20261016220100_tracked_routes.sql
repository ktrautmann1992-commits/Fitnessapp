-- Phase 10 · Etappe S1 · Strecken aufzeichnen (docs/PLAN-PHASE-10.md Abschnitte 11.2, 12 und 13; KONZEPT 10.1). Nur
-- additiv:
-- 1. Hilfsfunktionen für CHECK-Bedingungen: private.polyline_summary (Polyline lesen: Anzahl Punkte und
--    Begrenzungsrahmen, sonst null) und private.km_splits_valid (Kilometerzeiten),
-- 2. neue Tabelle tracked_routes – RLS nur eigene Zeilen lesen, schreiben nur über die Funktionen der nächsten Migration
--    (save_tracked_route, update_tracked_route, delete_tracked_route, delete_all_tracked_routes),
-- 3. private.tracked_route_daily_counts (Tageslimit gegen Missbrauch, wie private.session_log_daily_counts).
-- Grenzen = packages/core/src/constants.ts (TRACKED_ROUTE_LIMITS, CARDIO_PLAUSIBILITY_KMH, ROUTE_FILTER.jumpFactor),
-- Listen = packages/core/src/enums.ts (TRACKED_ROUTE_SPORTS, ROUTE_DIFFICULTIES, TRACKED_ROUTE_SOURCES), abgeglichen in
-- db-sync.test.ts.
--
-- Datenschutz (Plan 13, W-G15): Standortverläufe sind streng privat – nur eigene Zeilen, kein Partner-Zugriff, keine
-- Aggregation, keine öffentlichen Strecken. Gespeichert wird nur die vereinfachte Linie (höchstens 5.000 Punkte), nie
-- Rohpunkte, Genauigkeit oder Zeit je Punkt. Strecken sind KEIN Art.-9-Gesundheitsdatum (W-G15) und bleiben beim
-- Widerruf der Einwilligung health_data (consents_after_revoke unverändert); Konto löschen: Kaskade.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Hilfsfunktionen (immutable, nie ein Fehler; authenticated braucht EXECUTE, weil die CHECKs auch bei Änderungen
--    durch die Funktionen bzw. beim Leeren eines Verweises neu geprüft werden)
-- ---------------------------------------------------------------------------------------------------------

-- Polyline (Google „Encoded Polyline Algorithm Format“, 5 Nachkommastellen = TRACKED_ROUTE_LIMITS.polylinePrecision)
-- lesen wie decodePolyline in packages/core/src/routes/polyline.ts: nur ASCII 63–126, höchstens 60.000 Zeichen, jeder
-- Wert höchstens 7 Gruppen, Breite/Länge paarweise, jede Koordinate in −90…90 bzw. −180…180.
-- Ergebnis: array[Anzahl Punkte, Süd, West, Nord, Ost] (Grad, 5 Nachkommastellen) oder null bei ungültiger Eingabe.
create or replace function private.polyline_summary(p_polyline text)
returns numeric[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  bytes bytea;
  n integer;
  i integer := 0;
  b integer;
  factor bigint;
  val bigint;
  groups integer;
  delta bigint;
  is_lng boolean := false;
  lat bigint := 0;
  lng bigint := 0;
  cnt integer := 0;
  south bigint;
  west bigint;
  north bigint;
  east bigint;
begin
  if p_polyline is null or char_length(p_polyline) not between 1 and 60000 or p_polyline !~ '^[?-~]+$' then
    return null;
  end if;
  bytes := convert_to(p_polyline, 'UTF8');
  n := length(bytes);
  while i < n loop
    val := 0;
    factor := 1;
    groups := 0;
    loop
      if i >= n then
        return null;
      end if;
      b := get_byte(bytes, i) - 63;
      i := i + 1;
      val := val + (b % 32) * factor;
      factor := factor * 32;
      groups := groups + 1;
      if groups > 7 then
        return null;
      end if;
      exit when b < 32;
    end loop;
    delta := case when val % 2 = 1 then -(val + 1) / 2 else val / 2 end;
    if not is_lng then
      lat := lat + delta;
      is_lng := true;
    else
      lng := lng + delta;
      is_lng := false;
      if abs(lat) > 9000000 or abs(lng) > 18000000 then
        return null;
      end if;
      cnt := cnt + 1;
      south := least(south, lat);
      north := greatest(north, lat);
      west := least(west, lng);
      east := greatest(east, lng);
    end if;
  end loop;
  if is_lng then
    return null;
  end if;
  return array[
    cnt::numeric, round(south / 100000.0, 5), round(west / 100000.0, 5), round(north / 100000.0, 5),
    round(east / 100000.0, 5)
  ];
exception
  when others then
    return null;
end;
$$;

revoke all on function private.polyline_summary(text) from public;
grant execute on function private.polyline_summary(text) to authenticated, service_role;

-- Kilometerzeiten wie kmSplits in packages/core/src/routes/track.ts: Liste ganzer Sekunden 1–43.200 je VOLLEM Kilometer
-- (Anzahl = Distanz div 1.000), Summe höchstens die Bewegungszeit. Jede andere Eingabe → false (nie ein Fehler).
create or replace function private.km_splits_valid(p_splits jsonb, p_distance_m integer, p_moving_s integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  s jsonb;
  total bigint := 0;
begin
  if p_splits is null or p_distance_m is null or p_moving_s is null or jsonb_typeof(p_splits) <> 'array'
     or jsonb_array_length(p_splits) <> p_distance_m / 1000 then
    return false;
  end if;
  for s in select value from jsonb_array_elements(p_splits) loop
    if jsonb_typeof(s) <> 'number' or s::numeric not between 1 and 43200 or s::numeric <> trunc(s::numeric) then
      return false;
    end if;
    total := total + s::numeric::bigint;
  end loop;
  return total <= p_moving_s;
exception
  when others then
    return false;
end;
$$;

revoke all on function private.km_splits_valid(jsonb, integer, integer) from public;
grant execute on function private.km_splits_valid(jsonb, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. tracked_routes
-- ---------------------------------------------------------------------------------------------------------
create table public.tracked_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Name 1–80 Zeichen ohne Leerraum am Rand – genau die Zeichen von String.prototype.trim() (wie competitions.name,
  -- TRACKED_ROUTE_NAME_TRIM_CLASS = COMPETITION_NAME_TRIM_CLASS).
  name text not null check (
    char_length(name) between 1 and 80
    and name !~ '^[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
    and name !~ '[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]$'
  ),
  -- TRACKED_ROUTE_SPORTS (Ausdauer-Art des Tagebuchs, ohne Schwimmen).
  sport public.endurance_modality not null check (sport in ('run', 'bike', 'walk')),
  -- Beginn ab TRACKED_ROUTE_LIMITS.startedAtMin; „nicht in der Zukunft“ prüft save_tracked_route (now()).
  started_at timestamptz not null check (started_at >= timestamptz '2020-01-01 00:00:00+00'),
  -- CARDIO_LOG_LIMITS: Dauer 1 min–12 h, Distanz bis 500 km, Höhenmeter bis 10.000 m.
  duration_s integer not null check (duration_s between 60 and 43200),
  moving_s integer not null check (moving_s between 0 and 43200),
  distance_m integer not null check (distance_m between 0 and 500000),
  elevation_gain_m integer check (elevation_gain_m between 0 and 10000),
  -- Vereinfachte Linie (Douglas-Peucker), höchstens 5.000 Punkte, höchstens 60.000 Zeichen ASCII 63–126.
  polyline text not null check (char_length(polyline) between 1 and 60000 and polyline ~ '^[?-~]+$'),
  -- Anzahl Punkte und Begrenzungsrahmen [Süd, West, Nord, Ost] rechnet der Server aus der Polyline.
  point_count integer not null check (point_count between 2 and 5000),
  bbox numeric[] not null check (cardinality(bbox) = 4),
  -- Kilometerzeiten (Bewegungszeit je vollem km) für den Zeitvergleich auf Favoriten-Strecken.
  km_splits jsonb not null default '[]'::jsonb,
  difficulty public.route_difficulty,
  is_favorite boolean not null default false,
  -- Wiederholung einer eigenen Favoriten-Strecke („Erneut laufen“); beim Löschen der Favoriten-Strecke nur die
  -- Spalte leer.
  base_route_id uuid,
  -- Notiz höchstens 280 Zeichen in Code-Points (wie session_logs.notes).
  note text check (char_length(note) between 1 and 280),
  -- Eigener Tagebuch-Eintrag (Ausdauer, gleiche Art); beim Löschen des Eintrags bleibt die Strecke.
  session_log_id uuid,
  source public.tracked_route_source not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Nur EIGENE Strecken bzw. Einträge (zusammengesetzte Fremdschlüssel mit user_id).
  foreign key (base_route_id, user_id) references public.tracked_routes (id, user_id)
    on delete set null (base_route_id),
  foreign key (session_log_id, user_id) references public.session_logs (id, user_id)
    on delete set null (session_log_id),
  constraint tracked_routes_moving check (moving_s <= duration_s),
  -- Distanz-Plausibilität (trackedRouteDistancePlausible): Durchschnitt über die ganze Dauer höchstens
  -- ROUTE_FILTER.jumpFactor × CARDIO_PLAUSIBILITY_KMH (Laufen 37,5, Rad 105, Gehen 15 km/h), in ganzen Zahlen:
  -- distance_m × 36 ≤ (km/h × 10) × duration_s.
  constraint tracked_routes_distance_plausible check (
    distance_m * 36 <= (case sport when 'run' then 375 when 'bike' then 1050 when 'walk' then 150 end) * duration_s
  ),
  -- Anzahl und Rahmen passen zur Polyline (ungültige Polyline → null → abgelehnt).
  constraint tracked_routes_polyline check (
    private.polyline_summary(polyline) is not distinct from (array[point_count::numeric] || bbox)
  ),
  constraint tracked_routes_km_splits check (private.km_splits_valid(km_splits, distance_m, moving_s)),
  constraint tracked_routes_base_not_self check (base_route_id is distinct from id)
);

comment on table public.tracked_routes is
  'Eigene aufgezeichnete Strecken (Phase 10 S1). Streng privat (nur eigene Zeilen, kein Teilen, keine Ranglisten), '
  'kein Gesundheitsdatum (W-G15). Schreiben nur über save_tracked_route/update_tracked_route/delete_tracked_route/'
  'delete_all_tracked_routes (docs/PLAN-PHASE-10.md Abschnitt 12).';

create index tracked_routes_user_id_idx on public.tracked_routes (user_id, started_at);
create index tracked_routes_base_route_id_idx on public.tracked_routes (base_route_id)
  where base_route_id is not null;
-- Ein Tagebuch-Eintrag hat höchstens EINE Strecke.
create unique index tracked_routes_session_log_id_idx on public.tracked_routes (session_log_id)
  where session_log_id is not null;

create trigger tracked_routes_set_updated_at
  before update on public.tracked_routes
  for each row execute function private.set_updated_at();

alter table public.tracked_routes enable row level security;
revoke all on table public.tracked_routes from anon, authenticated;
grant select on table public.tracked_routes to authenticated;
grant all on table public.tracked_routes to service_role;

-- Nur eigene Zeilen. KEINE weitere Policy (kein Partner-Modus, keine geteilten oder öffentlichen Strecken, Plan 13).
create policy "Nutzer sehen eigene Strecken"
  on public.tracked_routes for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 3. Tageslimit (TRACKED_ROUTE_LIMITS.maxSavesPerDay): gezählt werden Erstellungen, auch später gelöschte.
-- ---------------------------------------------------------------------------------------------------------
create table private.tracked_route_daily_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created integer not null check (created >= 1),
  primary key (user_id, day)
);
alter table private.tracked_route_daily_counts enable row level security;
revoke all on table private.tracked_route_daily_counts from public, anon, authenticated;
