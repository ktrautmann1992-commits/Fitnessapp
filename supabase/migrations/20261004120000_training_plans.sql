-- Phase 3 · Nutzerpläne: user_plans, planned_sessions, planned_exercises (docs/PLAN-PHASE-3.md Abschnitt 8).
--
-- Rechte (Abschnitt 8.1, gegen Umgehen per PostgREST):
-- - authenticated darf user_plans und planned_exercises NUR lesen (eigene Zeilen).
-- - planned_sessions: lesen und NUR Datum/Status ändern (Spalten-Recht + Trigger mit allen Verschiebe-Regeln).
-- - Anlegen nur über die geprüften Funktionen save_training_plan / append_plan_block (nächste Migration).
-- Grenzen = packages/core/src/constants.ts (TEMPLATE_DOSAGE_LIMITS, PLAN_BLOCK_LIMITS, PLANNED_LOAD_LIMITS),
-- abgeglichen in db-sync.test.ts. Gesundheitsbezug: Abschnitt 9 (uses_health_data, medical_notice).

-- ---------------------------------------------------------------------------------------------------------
-- Aufzählungen (= PLAN_STATUSES, PLANNED_SESSION_STATUSES, PLAN_MATCH_QUALITIES, PLAN_NOTES in enums.ts)
-- ---------------------------------------------------------------------------------------------------------
create type public.plan_status as enum ('active', 'replaced');
create type public.planned_session_status as enum ('planned', 'skipped');
create type public.plan_match_quality as enum ('exact', 'close', 'fallback');
create type public.plan_note as enum (
  'goal_endurance_not_yet',
  'days_rotated',
  'days_capped',
  'days_added',
  'back_to_back_sessions',
  'minutes_shortened',
  'minutes_below_minimum',
  'volume_reduced',
  'exercises_substituted',
  'exercises_removed',
  'no_pull_exercise',
  'location_mismatch'
);

-- ---------------------------------------------------------------------------------------------------------
-- „Heute“ in Deutschland/Österreich/Schweiz (Europe/Berlin, AGE_CHECK_TIME_ZONE) – EINE Stelle für alle
-- Datumsregeln der Pläne (Trigger unten, save_training_plan, append_plan_block, insert_plan_sessions).
-- Tests ersetzen sie innerhalb ihrer Transaktion per create or replace durch einen festen Tag (Rollback stellt
-- das Original wieder her) – so sind die Datumstests unabhängig vom Wochentag.
-- Ausführbar für authenticated nur, weil der Verschiebe-Trigger mit den Rechten des Nutzers läuft; die
-- Funktion liefert nur das Datum und liest keine Daten.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.now() at time zone 'Europe/Berlin')::date
$$;

revoke all on function private.berlin_today() from public, anon;
grant execute on function private.berlin_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- user_plans: ein Plan je Erzeugung; höchstens EIN aktiver Plan je Person.
-- uses_health_data/medical_notice bestimmt save_training_plan selbst (nie der Client).
-- inputs = Angaben OHNE Gesundheitsdaten (planInputsSnapshot); Gesundheitsschlüssel sind verboten. Die Werte
-- prüft save_training_plan (private.assert_plan_inputs); die Größe ist zusätzlich hier begrenzt
-- (PLAN_SAVE_LIMITS.inputsMaxBytes).
-- ---------------------------------------------------------------------------------------------------------
create table public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status public.plan_status not null default 'active',
  -- Vorlage: Fremdschlüssel ohne Kaskade beim Löschen (content-seed archiviert nur, löscht nie).
  template_id text not null references public.plan_templates (id) on update cascade on delete restrict,
  template_title_de text not null check (char_length(template_title_de) between 5 and 100),
  template_version integer not null check (template_version between 1 and 1000),
  engine_version smallint not null check (engine_version >= 1),
  match_quality public.plan_match_quality not null,
  notes public.plan_note[] not null default '{}' check (
    array_position(notes, null) is null and private.has_distinct_elements(notes)
  ),
  uses_health_data boolean not null default false,
  medical_notice boolean not null default false,
  inputs jsonb not null check (
    jsonb_typeof(inputs) = 'object'
    and not (inputs ?| array['healthScreening', 'flags', 'birthDate', 'weightKg', 'heightCm', 'bodyFatPct'])
    and octet_length(inputs::text) <= 4096
  ),
  start_date date not null,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  unique (id, user_id),
  -- Arzt-Hinweis nur zusammen mit Gesundheitsdaten.
  check (not medical_notice or uses_health_data),
  check ((status = 'replaced') = (replaced_at is not null))
);

comment on table public.user_plans is
  'Trainingspläne (Schnappschuss einer Vorlage). Mit uses_health_data = true wie Gesundheitsdaten behandelt: '
  'nur mit Einwilligung health_data, beim Widerruf vollständig gelöscht (docs/PLAN-PHASE-3.md Abschnitt 9).';

create unique index user_plans_one_active_idx on public.user_plans (user_id) where status = 'active';
create index user_plans_user_id_idx on public.user_plans (user_id);
create index user_plans_template_id_idx on public.user_plans (template_id);

-- ---------------------------------------------------------------------------------------------------------
-- planned_sessions: geplante Einheiten. Nie zwei nicht gestrichene Einheiten am selben Tag – auch nicht über
-- Pläne hinweg („nie stapeln“).
-- ---------------------------------------------------------------------------------------------------------
create table public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  block_no smallint not null check (block_no between 1 and 1000),
  -- 0 = Woche 0 (angebrochene Startwoche), dann Belastungswochen, zuletzt die Erholungswoche.
  week_no smallint not null check (week_no between 0 and 6),
  is_intro_week boolean not null default false,
  is_deload boolean not null default false,
  template_day_index smallint not null check (template_day_index between 1 and 7),
  scheduled_on date not null,
  -- Ursprünglicher Tag, gesetzt vom Trigger beim ERSTEN Verschieben.
  original_date date,
  status public.planned_session_status not null default 'planned',
  name_de text not null check (char_length(name_de) between 2 and 60),
  focus public.session_focus not null,
  estimated_minutes smallint not null check (estimated_minutes between 1 and 600),
  warmup_de text not null check (char_length(warmup_de) between 1 and 400),
  cooldown_de text not null check (char_length(cooldown_de) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Fremde Pläne sind unmöglich: Einheit und Plan gehören derselben Person.
  foreign key (plan_id, user_id) references public.user_plans (id, user_id) on delete cascade,
  check (not (is_intro_week and is_deload))
);

create unique index planned_sessions_one_per_day_idx
  on public.planned_sessions (user_id, scheduled_on)
  where status <> 'skipped';
create index planned_sessions_user_id_scheduled_on_idx on public.planned_sessions (user_id, scheduled_on);
create index planned_sessions_plan_id_idx on public.planned_sessions (plan_id, block_no);

-- ---------------------------------------------------------------------------------------------------------
-- planned_exercises: fachliche Grenzen = TEMPLATE_DOSAGE_LIMITS (Regel V4/V8), Zielgewicht = PLANNED_LOAD_LIMITS.
-- ---------------------------------------------------------------------------------------------------------
create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Höchstens 8 Übungen je Einheit: order_no 1–8 und eindeutig je Einheit.
  order_no smallint not null check (order_no between 1 and 8),
  exercise_id text not null references public.exercises (id) on update cascade on delete restrict,
  -- Übung laut Vorlage (vor einem Tausch).
  source_exercise_id text not null references public.exercises (id) on update cascade on delete restrict,
  exercise_name_de text not null check (char_length(exercise_name_de) between 2 and 100),
  sets smallint not null check (sets between 1 and 6),
  reps_min smallint check (reps_min between 3 and 30),
  reps_max smallint check (reps_max between 3 and 30),
  duration_s smallint check (duration_s between 10 and 120),
  rest_s smallint not null check (rest_s between 0 and 600),
  rpe_target numeric(3, 1) not null check (rpe_target between 5 and 9 and rpe_target * 2 = trunc(rpe_target * 2)),
  superset_group text check (superset_group ~ '^[A-Z]$'),
  notes_de text check (char_length(notes_de) between 1 and 300),
  -- Phase 3 leer („Startgewicht finden“), ab Phase 4 per eigener Server-Funktion.
  target_weight_kg numeric(5, 2) check (target_weight_kg between 0.5 and 500),
  unique (session_id, order_no),
  foreign key (session_id, user_id) references public.planned_sessions (id, user_id) on delete cascade,
  check (
    (reps_min is not null and reps_max is not null and duration_s is null and reps_min <= reps_max)
    or (reps_min is null and reps_max is null and duration_s is not null)
  )
);

create index planned_exercises_user_id_idx on public.planned_exercises (user_id);
create index planned_exercises_exercise_id_idx on public.planned_exercises (exercise_id);
create index planned_exercises_source_exercise_id_idx on public.planned_exercises (source_exercise_id);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------------------------------------
alter table public.user_plans enable row level security;
alter table public.planned_sessions enable row level security;
alter table public.planned_exercises enable row level security;

revoke all on table public.user_plans from anon, authenticated;
revoke all on table public.planned_sessions from anon, authenticated;
revoke all on table public.planned_exercises from anon, authenticated;

grant select on table public.user_plans to authenticated;
grant select on table public.planned_exercises to authenticated;
grant select on table public.planned_sessions to authenticated;
-- Nur Datum und Status – original_date setzt der Trigger.
grant update (scheduled_on, status) on table public.planned_sessions to authenticated;

grant all on table public.user_plans to service_role;
grant all on table public.planned_sessions to service_role;
grant all on table public.planned_exercises to service_role;

create policy "Nutzer sehen eigene Pläne"
  on public.user_plans for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene geplante Einheiten"
  on public.planned_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer verschieben oder streichen eigene Einheiten"
  on public.planned_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene geplante Übungen"
  on public.planned_exercises for select to authenticated
  using (user_id = (select auth.uid()));

-- Archivierte Übungen bleiben lesbar, solange sie in einem EIGENEN Plan stehen (Abschnitt 8.3). Nur
-- archivierte – freigegebene sind ohnehin lesbar, Entwürfe nie.
create policy "Übungen aus eigenen Plänen sind lesbar"
  on public.exercises for select to authenticated
  using (
    status = 'archived'
    and exists (
      select 1
      from public.planned_exercises pe
      where pe.user_id = (select auth.uid())
        and (pe.exercise_id = exercises.id or pe.source_exercise_id = exercises.id)
    )
  );

-- ---------------------------------------------------------------------------------------------------------
-- Verschieben/Streichen (Abschnitt 8.1 Punkt 2). Die Grundregeln von rescheduleSession() in packages/core als
-- harte Grenze:
-- - nur scheduled_on und status ändern (andere Spalten: Fehler),
-- - nur Einheiten des AKTIVEN Plans, nur Status planned → skipped (nicht zurück),
-- - Einheiten der Erholungswoche (is_deload) werden nie verschoben, nur gestrichen,
-- - der alte Termin darf in der Vergangenheit liegen; der neue liegt nicht vor heute (private.berlin_today())
--   und in derselben ISO-Woche wie coalesce(original_date, scheduled_on),
-- - ist diese ISO-Woche vorbei, ändert sich nichts mehr,
-- - original_date wird nur beim ERSTEN Verschieben gesetzt.
-- NICHT hier geprüft: die 48-h-Erholungsregel zwischen Einheiten an Nachbartagen – sie bleibt eine Regel der
-- App (rescheduleSession() wählt den Tag); die Datenbank verhindert nur das Stapeln (eindeutiger Index).
-- Ausnahmen: Der Trigger greift nur für die Rolle authenticated (Zugriff per PostgREST). Der Datenbank-Eigentümer
-- (security-definer-Funktionen, Migrationen) und service_role (Server-Aufgaben, z. B. Phase 4 „gestern
-- verpasst → skipped“) sind ausgenommen und müssen die Regeln selbst einhalten.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.planned_sessions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := private.berlin_today();
  reference date := coalesce(old.original_date, old.scheduled_on);
  week_start date := date_trunc('week', coalesce(old.original_date, old.scheduled_on))::date;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if (new.id, new.plan_id, new.user_id, new.block_no, new.week_no, new.is_intro_week, new.is_deload,
      new.template_day_index, new.name_de, new.focus, new.estimated_minutes, new.warmup_de, new.cooldown_de,
      new.original_date, new.created_at)
     is distinct from
     (old.id, old.plan_id, old.user_id, old.block_no, old.week_no, old.is_intro_week, old.is_deload,
      old.template_day_index, old.name_de, old.focus, old.estimated_minutes, old.warmup_de, old.cooldown_de,
      old.original_date, old.created_at) then
    raise exception 'Nur Datum und Status einer Einheit sind änderbar.' using errcode = 'check_violation';
  end if;
  if old.status <> 'planned' then
    raise exception 'Gestrichene Einheiten lassen sich nicht mehr ändern.' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.user_plans p where p.id = old.plan_id and p.status = 'active'
  ) then
    raise exception 'Nur Einheiten des aktiven Plans sind änderbar.' using errcode = 'check_violation';
  end if;
  if week_start + 6 < today then
    raise exception 'Diese Woche ist vorbei.' using errcode = 'check_violation';
  end if;
  if new.scheduled_on is distinct from old.scheduled_on then
    if old.is_deload then
      raise exception 'Einheiten der Erholungswoche lassen sich nur streichen, nicht verschieben.'
        using errcode = 'check_violation';
    end if;
    if new.scheduled_on < today
       or date_trunc('week', new.scheduled_on)::date <> week_start then
      raise exception 'Verschieben nur ab heute und innerhalb derselben Woche.' using errcode = 'check_violation';
    end if;
    new.original_date := reference;
  end if;
  return new;
end;
$$;

revoke all on function private.planned_sessions_before_update() from public;

create trigger planned_sessions_before_update
  before update on public.planned_sessions
  for each row execute function private.planned_sessions_before_update();

create trigger planned_sessions_set_updated_at
  before update on public.planned_sessions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data (Abschnitt 8.2): zusätzlich ALLE Pläne mit uses_health_data vollständig löschen
-- (aktiv und ersetzt, mit allen Einheiten und Übungen). In Phase 3 gibt es noch kein Tagebuch; ab Phase 4
-- verweisen Einträge mit on delete set null und eigener Kopie (PLAN-PHASE-3 Abschnitt 8.2).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;
