-- Phase 4 Etappe B · Trainingstagebuch: session_logs, exercise_logs, set_logs, cardio_logs, exercise_start_weights
-- (docs/PLAN-PHASE-4.md Abschnitte 3.1–3.5).
--
-- Rechte (3.5):
-- - session_logs, exercise_logs, set_logs, cardio_logs: authenticated darf NUR lesen (eigene Zeilen). Schreiben nur
--   über die security-definer-Funktionen der nächsten Migration (save_session_log, delete_session_log) – wie bei den
--   Plänen, damit niemand per PostgREST Prüfungen umgeht und das Ersetzen einer Einheit atomar ist. anon darf nichts.
-- - exercise_start_weights: bewusste Ausnahme (W14) – ein einzelner Wert ohne Zusammenhang zu anderen Zeilen, direkt
--   per PostgREST wie training_preferences (eigene Zeilen, Anlegen/Ändern nur mit Profil).
-- Schnappschuss statt Kaskade (3.3, B2): Einträge hängen NIE per Kaskade an Plänen. Verweise auf planned_sessions und
-- planned_exercises werden beim Löschen eines Plans per `on delete set null (spalte)` leer – user_id bleibt erhalten.
-- Grenzen = packages/core/src/constants.ts (SESSION_LOG_LIMITS, SET_RPE_LIMITS, SESSION_RPE_LIMITS,
-- CARDIO_LOG_LIMITS, TEMPLATE_DOSAGE_LIMITS, PLANNED_LOAD_LIMITS), abgeglichen in db-sync.test.ts.
-- Gesundheitsbezug (3.4): Das Tagebuch ist ein Trainingsheft. Vorgaben aus Plänen mit Gesundheits-Check
-- (from_health_plan) werden beim Widerruf neutralisiert (private.neutralize_health_plan_logs, nächste Migration).

-- ---------------------------------------------------------------------------------------------------------
-- Gemeinsamer Fremdschlüssel (id, user_id) auf planned_exercises – damit ein Eintrag nur auf EIGENE geplante
-- Übungen verweisen kann (wie planned_sessions/user_plans in Phase 3).
-- ---------------------------------------------------------------------------------------------------------
alter table public.planned_exercises
  add constraint planned_exercises_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------------------------------------
-- session_logs: ein Eintrag je durchgeführter Einheit.
-- id erzeugt das Gerät (beim Ersetzen behält der Server die bestehende id). revision/last_write_id: optimistische
-- Sperre und Idempotenz (W3, R4). from_health_plan setzt NUR der Server (S1).
-- ---------------------------------------------------------------------------------------------------------
create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_session_id uuid,
  kind public.planned_session_kind not null,
  performed_on date not null,
  started_at timestamptz,
  finished_at timestamptz,
  status public.session_log_status not null,
  -- Belastungsempfinden der Einheit 0–10 (SESSION_RPE_LIMITS).
  session_rpe smallint check (session_rpe between 0 and 10),
  -- Notiz: höchstens 280 Zeichen in Code-Points (SESSION_LOG_LIMITS.notesMaxChars, char_length wie codePointLength).
  notes text check (char_length(notes) <= 280),
  -- Schnappschuss der Einheit (3.3).
  name_de text not null check (char_length(name_de) between 1 and 200),
  is_intro_week boolean not null default false,
  is_deload boolean not null default false,
  from_health_plan boolean not null default false,
  revision integer not null default 1 check (revision >= 1),
  last_write_id uuid not null,
  source public.log_source not null default 'manual',
  -- Nur Anzeige/Notlösung; Werte in der Zukunft kappt save_session_log auf now().
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (planned_session_id, user_id) references public.planned_sessions (id, user_id)
    on delete set null (planned_session_id),
  check (not (is_intro_week and is_deload)),
  check (started_at is null or finished_at is null or started_at <= finished_at)
);

comment on table public.session_logs is
  'Trainingstagebuch: durchgeführte Einheiten (Schnappschuss, kein Verweis per Kaskade auf Pläne). Schreiben nur '
  'über save_session_log/delete_session_log (docs/PLAN-PHASE-4.md Abschnitt 3).';

-- Eine geplante Einheit wird nur einmal eingetragen.
create unique index session_logs_planned_session_idx
  on public.session_logs (planned_session_id)
  where planned_session_id is not null;
-- Nie zwei geplante Einheiten am selben Tag nachholen („nie stapeln“).
create unique index session_logs_one_per_day_idx
  on public.session_logs (user_id, performed_on)
  where planned_session_id is not null;
create index session_logs_user_performed_idx on public.session_logs (user_id, performed_on desc);

create trigger session_logs_set_updated_at
  before update on public.session_logs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- exercise_logs: je Übung des Eintrags. exercise_id = TATSÄCHLICH gemachte Übung; Vorgabe beim Training
-- (target_*, Anzeige-Schnappschuss) und Progressions-Zustand VOR der Einheit (state_*, roh, W4) getrennt.
-- ---------------------------------------------------------------------------------------------------------
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  session_log_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Übungen je Einheit 1–12 (SESSION_LOG_LIMITS.exercisesPerSession).
  order_no smallint not null check (order_no between 1 and 12),
  planned_exercise_id uuid,
  exercise_id text not null references public.exercises (id) on update cascade on delete restrict,
  exercise_name_de text not null check (char_length(exercise_name_de) between 1 and 200),
  load_type public.load_type not null,
  status public.exercise_log_status not null,
  -- Vorgabe beim Training (TEMPLATE_DOSAGE_LIMITS, PLANNED_LOAD_LIMITS).
  target_sets smallint check (target_sets between 1 and 6),
  reps_min smallint check (reps_min between 3 and 30),
  reps_max smallint check (reps_max between 3 and 30),
  target_reps smallint check (target_reps between 3 and 30),
  target_extra_set boolean,
  target_weight_kg numeric(5, 2) check (target_weight_kg between 0.5 and 500),
  target_duration_s smallint check (target_duration_s between 10 and 120),
  target_rpe numeric(3, 1) check (target_rpe between 5 and 9 and target_rpe * 2 = trunc(target_rpe * 2)),
  -- Progressions-Zustand VOR dieser Einheit (roh, ortsunabhängig).
  state_weight_kg numeric(5, 2) check (state_weight_kg between 0.5 and 500),
  state_target_reps smallint check (state_target_reps between 3 and 30),
  state_extra_set boolean,
  state_duration_s smallint check (state_duration_s between 10 and 120),
  -- Plausibilitäts-Warnung beim Gewicht ausdrücklich bestätigt (W5).
  weight_confirmed boolean not null default false,
  -- Wiedereinstieg nach Pause (RETURN_AFTER_PAUSE, Etappe A C1) – zählt nicht für die Progression.
  is_return boolean not null default false,
  unique (session_log_id, order_no),
  unique (id, user_id),
  foreign key (session_log_id, user_id) references public.session_logs (id, user_id) on delete cascade,
  foreign key (planned_exercise_id, user_id) references public.planned_exercises (id, user_id)
    on delete set null (planned_exercise_id),
  check (reps_min is null or reps_max is null or reps_min <= reps_max),
  -- Zustand ganz oder gar nicht (wie exerciseLogSchema: mit Zustand ist state_extra_set gesetzt).
  check (
    (state_weight_kg is null and state_target_reps is null and state_extra_set is null and state_duration_s is null)
    or state_extra_set is not null
  )
);

comment on column public.exercise_logs.exercise_id is
  'Tatsächlich gemachte Übung (bei status = alternative die Alternative; planned_exercise_id = geplante Übung).';

create index exercise_logs_user_exercise_idx on public.exercise_logs (user_id, exercise_id);
create index exercise_logs_exercise_id_idx on public.exercise_logs (exercise_id);
create index exercise_logs_planned_exercise_id_idx on public.exercise_logs (planned_exercise_id);

-- ---------------------------------------------------------------------------------------------------------
-- set_logs: Sätze einer Übung. Gewicht je Hantel bzw. Kugel (Langhantel gesamt). Gewicht nur bei
-- load_type = 'weight', Dauer nur bei 'time' – prüft save_session_log (die Art steht in exercise_logs).
-- ---------------------------------------------------------------------------------------------------------
create table public.set_logs (
  exercise_log_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Sätze je Übung 1–10 (SESSION_LOG_LIMITS.setsPerExercise).
  set_no smallint not null check (set_no between 1 and 10),
  reps smallint check (reps between 0 and 100),
  weight_kg numeric(5, 2) check (weight_kg between 0 and 500),
  duration_s smallint check (duration_s between 1 and 600),
  -- RPE je Satz 5–10 in 0,5er-Schritten (SET_RPE_LIMITS).
  rpe numeric(3, 1) check (rpe between 5 and 10 and rpe * 2 = trunc(rpe * 2)),
  done boolean not null,
  primary key (exercise_log_id, set_no),
  foreign key (exercise_log_id, user_id) references public.exercise_logs (id, user_id) on delete cascade
);

create index set_logs_user_id_idx on public.set_logs (user_id);

-- ---------------------------------------------------------------------------------------------------------
-- cardio_logs: Ausdauer-Eintrag (1:1 zur Einheit, nur bei kind = 'endurance' – prüft save_session_log).
-- KEINE Herzfrequenz (Gesundheitsdatum, Phase 8, S2).
-- ---------------------------------------------------------------------------------------------------------
create table public.cardio_logs (
  session_log_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  modality public.endurance_modality not null,
  -- CARDIO_LOG_LIMITS: 1 min–12 h, 0–500 km, 0–10 000 Höhenmeter.
  duration_s integer not null check (duration_s between 60 and 43200),
  distance_m integer check (distance_m between 0 and 500000),
  elevation_m integer check (elevation_m between 0 and 10000),
  foreign key (session_log_id, user_id) references public.session_logs (id, user_id) on delete cascade
);

create index cardio_logs_user_id_idx on public.cardio_logs (user_id);

-- ---------------------------------------------------------------------------------------------------------
-- exercise_start_weights: „eigenes Startgewicht“ je Übung (Phase-3-Vormerkung 5.8 Punkt 4, calibration.ts).
-- ---------------------------------------------------------------------------------------------------------
create table public.exercise_start_weights (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on update cascade on delete restrict,
  -- PLANNED_LOAD_LIMITS.targetWeightKg (= exerciseStartWeightSchema).
  weight_kg numeric(5, 2) not null check (weight_kg between 0.5 and 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index exercise_start_weights_exercise_id_idx on public.exercise_start_weights (exercise_id);

create trigger exercise_start_weights_set_updated_at
  before update on public.exercise_start_weights
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS (3.5)
-- ---------------------------------------------------------------------------------------------------------
alter table public.session_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.set_logs enable row level security;
alter table public.cardio_logs enable row level security;
alter table public.exercise_start_weights enable row level security;

revoke all on table public.session_logs from anon, authenticated;
revoke all on table public.exercise_logs from anon, authenticated;
revoke all on table public.set_logs from anon, authenticated;
revoke all on table public.cardio_logs from anon, authenticated;
revoke all on table public.exercise_start_weights from anon, authenticated;

grant select on table public.session_logs to authenticated;
grant select on table public.exercise_logs to authenticated;
grant select on table public.set_logs to authenticated;
grant select on table public.cardio_logs to authenticated;
grant select, insert, update, delete on table public.exercise_start_weights to authenticated;

grant all on table public.session_logs to service_role;
grant all on table public.exercise_logs to service_role;
grant all on table public.set_logs to service_role;
grant all on table public.cardio_logs to service_role;
grant all on table public.exercise_start_weights to service_role;

create policy "Nutzer sehen eigene Tagebuch-Einheiten"
  on public.session_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Tagebuch-Übungen"
  on public.exercise_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Sätze"
  on public.set_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Ausdauer-Einträge"
  on public.cardio_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Startgewichte"
  on public.exercise_start_weights for select to authenticated
  using (user_id = (select auth.uid()));
-- Anlegen/Ändern nur mit Profil und nur für Übungen, die die Person lesen darf (keine Entwürfe).
create policy "Nutzer legen eigene Startgewichte an"
  on public.exercise_start_weights for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises x where x.id = exercise_start_weights.exercise_id)
  );
create policy "Nutzer ändern eigene Startgewichte"
  on public.exercise_start_weights for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises x where x.id = exercise_start_weights.exercise_id)
  );
create policy "Nutzer löschen eigene Startgewichte"
  on public.exercise_start_weights for delete to authenticated
  using (user_id = (select auth.uid()));

-- Archivierte Übungen bleiben lesbar, solange sie in einem EIGENEN Tagebuch-Eintrag stehen (3.5, wie Phase 3 für
-- Pläne). Nur archivierte – freigegebene sind ohnehin lesbar, Entwürfe nie.
create policy "Übungen aus eigenen Tagebuch-Einträgen sind lesbar"
  on public.exercises for select to authenticated
  using (
    status = 'archived'
    and exists (
      select 1
      from public.exercise_logs el
      where el.user_id = (select auth.uid()) and el.exercise_id = exercises.id
    )
  );

-- ---------------------------------------------------------------------------------------------------------
-- „Nie stapeln“ bei geplanten Einheiten gilt ab jetzt nur für noch GEPLANTE Einheiten. Bisher (nur planned |
-- skipped) war `status <> 'skipped'` gleichbedeutend. Mit `completed` würde eine erledigte Einheit sonst ihren Tag
-- dauerhaft belegen: save_training_plan könnte heute keinen neuen Plan mit einer Einheit am selben Tag speichern
-- (erledigte Einheiten des alten Plans bleiben als Verlauf), und ein nachgetragenes `skipped → completed` (W8)
-- könnte an einer inzwischen dorthin verschobenen Einheit scheitern. Das Tagebuch selbst stapelt nie
-- (session_logs_one_per_day_idx).
-- ---------------------------------------------------------------------------------------------------------
drop index public.planned_sessions_one_per_day_idx;
create unique index planned_sessions_one_per_day_idx
  on public.planned_sessions (user_id, scheduled_on)
  where status = 'planned';

-- ---------------------------------------------------------------------------------------------------------
-- Verschiebe-Trigger (W1): authenticated darf den Status nur auf planned oder skipped setzen – „completed“ setzt
-- ausschließlich save_session_log (als Eigentümer, am Trigger vorbei). Sonst unverändert gegenüber
-- 20261004120000_training_plans.sql.
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
      old.original_date, old.created_at)
     or new.status::text not in ('planned', 'skipped') then
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
