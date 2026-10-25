-- Trainings-Modi (docs/PLAN-TRAINING-MODI.md, Gründer-Freigabe 25.10.2026): Schmerz-/Verletzungsmodus und
-- Reise-Modus. Nur additiv. Aufwärmen & Dehnen braucht keine Tabelle (Schalter nur auf dem Gerät).
--
-- 1. Enums body_region, pain_intensity, travel_equipment (sync: BODY_REGIONS, PAIN_INTENSITIES,
--    TRAVEL_EQUIPMENT_OPTIONS in packages/core/src/enums.ts, db-sync.test.ts).
-- 2. pain_episodes – GESUNDHEITSDATEN (Art. 9 DSGVO): Region, Stärke, Dauer, Beginn, vorzeitiges Ende. Kein Freitext,
--    keine Diagnose. Schreiben nur mit gültiger Einwilligung health_data (RLS); Widerruf löscht und Export enthält sie
--    (private.consents_after_revoke / export_my_data in 20261025120700_training_modes_revoke_export.sql); nach
--    PAIN_MODE.historyDays (365) Tagen automatisch gelöscht.
-- 3. travel_modes – kein Gesundheitsdatum (Zeitraum + Geräte); nur die eigene Person (RLS), im Export.
-- Beide Tabellen hängen per on delete cascade am Konto (Konto löschen).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------------------------------------
create type public.body_region as enum ('knee', 'shoulder', 'lower_back', 'elbow', 'wrist', 'hip', 'ankle', 'neck');
create type public.pain_intensity as enum ('mild', 'moderate', 'severe');
create type public.travel_equipment as enum ('bodyweight', 'dumbbells', 'hotel_gym', 'band', 'suspension_trainer');

-- ---------------------------------------------------------------------------------------------------------
-- 2. pain_episodes
-- ---------------------------------------------------------------------------------------------------------
create table public.pain_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  region public.body_region not null,
  intensity public.pain_intensity not null,
  -- PAIN_MODE.durationsDays
  duration_days smallint not null check (duration_days in (3, 7, 14)),
  started_on date not null,
  -- Vorzeitig beendet an diesem Tag (ab dann normaler Plan); null = endet automatisch nach duration_days.
  ended_early_on date check (ended_early_on is null or ended_early_on >= started_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pain_episodes_user_started on public.pain_episodes (user_id, started_on);

comment on table public.pain_episodes is
  'SENSIBEL (Art. 9 DSGVO). Schmerz-/Verletzungsmodus: Region, Stärke, Dauer – nur mit Einwilligung health_data; '
  'beim Widerruf und nach 365 Tagen gelöscht. Keine Diagnose, kein Freitext.';

alter table public.pain_episodes enable row level security;
revoke all on table public.pain_episodes from anon, authenticated;
grant select, insert, update, delete on table public.pain_episodes to authenticated;
grant all on table public.pain_episodes to service_role;

create policy "Nutzer sehen eigene Schmerz-Einträge"
  on public.pain_episodes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer speichern eigene Schmerz-Einträge nur mit Einwilligung"
  on public.pain_episodes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_valid_consent('health_data')
    and coalesce(public.current_consent_version('health_data'), 0) >= 2
  );
create policy "Nutzer beenden eigene Schmerz-Einträge nur mit Einwilligung"
  on public.pain_episodes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_valid_consent('health_data')
    and coalesce(public.current_consent_version('health_data'), 0) >= 2
  );
create policy "Nutzer löschen eigene Schmerz-Einträge"
  on public.pain_episodes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Einwilligung: gültige health_data in Fassung ≥ 2 (sync: PAIN_MODE_HEALTH_CONSENT_MIN_VERSION, db-sync.test.ts) –
-- erst Fassung 2 nennt den Schmerz-/Verletzungsmodus (20261025120800_health_consent_v2_training_modes.sql). Solange
-- Fassung 2 in der Datenbank ein unveröffentlichter Entwurf ist, kann niemand Schmerz-Einträge speichern (die App
-- zeigt dann „kommt nach der rechtlichen Prüfung“); der Testmodus nutzt Fassung 2 schon.
-- Regeln, die eine CHECK-Bedingung nicht kann (heutiges Datum, andere Zeilen). Fehler ohne Inhalte, nur Codes.
-- - Einwilligung sperren (FOR SHARE, wie require_supplement_consent): ein gleichzeitiger Widerruf wartet auf das
--   Speichern und löscht danach – nie bleibt ein Eintrag ohne Einwilligung zurück.
-- - Beginn = heute (Europe/Berlin) ± 1 Tag (Zeitzonen der Geräte).
-- - Höchstens 20 neue Einträge je Konto und Tag (Schutz vor Missbrauch).
-- - Ändern: nur das vorzeitige Ende setzen (einmal, nicht zurücknehmen, höchstens bis morgen) – Region, Stärke,
--   Dauer und Beginn bleiben (neue Angabe = neuer Eintrag).
create or replace function private.pain_episodes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: PAIN_MODE_HEALTH_CONSENT_MIN_VERSION in packages/core/src/constants.ts (db-sync.test.ts)
  min_version constant integer := 2;
  today date := private.berlin_today();
begin
  perform 1 from public.consents c
  where c.user_id = new.user_id and c.consent_type = 'health_data' and c.revoked_at is null
  for share;
  if not found or coalesce(public.current_consent_version('health_data'), 0) < min_version then
    raise exception 'pain_consent_missing' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'INSERT' then
    if new.started_on < today - 1 or new.started_on > today + 1 then
      raise exception 'pain_start_invalid' using errcode = 'check_violation';
    end if;
    if new.ended_early_on is not null and new.ended_early_on > today + 1 then
      raise exception 'pain_end_invalid' using errcode = 'check_violation';
    end if;
    if (
      select count(*) from public.pain_episodes p
      where p.user_id = new.user_id and p.created_at >= now() - interval '1 day'
    ) >= 20 then
      raise exception 'pain_rate_limited' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.region is distinct from old.region
     or new.intensity is distinct from old.intensity
     or new.duration_days is distinct from old.duration_days
     or new.started_on is distinct from old.started_on
     or new.created_at is distinct from old.created_at then
    raise exception 'pain_episode_immutable' using errcode = 'check_violation';
  end if;
  if old.ended_early_on is not null and new.ended_early_on is distinct from old.ended_early_on then
    raise exception 'pain_episode_already_ended' using errcode = 'check_violation';
  end if;
  if new.ended_early_on is not null and new.ended_early_on > today + 1 then
    raise exception 'pain_end_invalid' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.pain_episodes_guard() from public, anon, authenticated, service_role;

create trigger pain_episodes_guard
  before insert or update on public.pain_episodes
  for each row execute function private.pain_episodes_guard();

-- Aufräumen: Einträge, deren letzter Tag länger als 365 Tage (PAIN_MODE.historyDays) zurückliegt.
create or replace function private.cleanup_pain_episodes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.pain_episodes
  where started_on + duration_days - 1 < private.berlin_today() - 365;
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function private.cleanup_pain_episodes() from public, anon, authenticated;
grant execute on function private.cleanup_pain_episodes() to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. travel_modes
-- ---------------------------------------------------------------------------------------------------------
create table public.travel_modes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  equipment public.travel_equipment not null,
  -- TRAVEL_MODE.minutesOptions; null = Dauer wie geplant.
  max_minutes smallint check (max_minutes is null or max_minutes in (20, 30, 45, 60)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- TRAVEL_MODE.maxDays (42)
  check (ends_on >= starts_on and ends_on - starts_on + 1 <= 42)
);
create index travel_modes_user_starts on public.travel_modes (user_id, starts_on);

comment on table public.travel_modes is
  'Reise-Modus: Zeitraum, Geräte unterwegs, kürzere Einheiten. Kein Gesundheitsdatum. Der Plan selbst bleibt '
  'unverändert; die App setzt die Anzeige der Tage im Zeitraum neu zusammen.';

alter table public.travel_modes enable row level security;
revoke all on table public.travel_modes from anon, authenticated;
grant select, insert, update, delete on table public.travel_modes to authenticated;
grant all on table public.travel_modes to service_role;

create policy "Nutzer sehen eigene Reise-Zeiträume"
  on public.travel_modes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Reise-Zeiträume an"
  on public.travel_modes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Nutzer ändern eigene Reise-Zeiträume"
  on public.travel_modes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Reise-Zeiträume"
  on public.travel_modes for delete to authenticated
  using (user_id = (select auth.uid()));

-- - Beginn ab gestern (Zeitzonen) bis höchstens 365 Tage im Voraus (TRAVEL_MODE.maxStartAheadDays).
-- - Keine Überschneidung mit einem anderen eigenen Zeitraum.
-- - Höchstens 50 Zeiträume je Konto.
-- - Ändern: nur das Ende vorziehen (vorzeitig beenden) – nie verlängern, Beginn und Geräte bleiben.
create or replace function private.travel_modes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := private.berlin_today();
begin
  if tg_op = 'INSERT' then
    if new.starts_on < today - 1 or new.starts_on > today + 365 then
      raise exception 'travel_start_invalid' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.travel_modes t where t.user_id = new.user_id) >= 50 then
      raise exception 'travel_limit_reached' using errcode = 'check_violation';
    end if;
  else
    if new.user_id is distinct from old.user_id
       or new.starts_on is distinct from old.starts_on
       or new.equipment is distinct from old.equipment
       or new.max_minutes is distinct from old.max_minutes
       or new.created_at is distinct from old.created_at
       or new.ends_on > old.ends_on then
      raise exception 'travel_mode_immutable' using errcode = 'check_violation';
    end if;
    new.updated_at := now();
  end if;
  if exists (
    select 1 from public.travel_modes t
    where t.user_id = new.user_id
      and t.id <> new.id
      and t.starts_on <= new.ends_on
      and new.starts_on <= t.ends_on
  ) then
    raise exception 'travel_overlap' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.travel_modes_guard() from public, anon, authenticated, service_role;

create trigger travel_modes_guard
  before insert or update on public.travel_modes
  for each row execute function private.travel_modes_guard();

-- Täglicher Lauf des Aufräumens (pg_cron, 03:17 UTC) – nur, wenn die Erweiterung verfügbar ist (Supabase: ja; lokales
-- Postgres ohne pg_cron: übersprungen). Wie live-adjust-maintenance.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule('pain-episodes-retention', '17 3 * * *', 'select private.cleanup_pain_episodes()');
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet (SQLSTATE %) – Aufräumen der Schmerz-Einträge manuell.', sqlstate;
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Aufräumen der Schmerz-Einträge manuell.';
  end if;
end;
$cron$;
