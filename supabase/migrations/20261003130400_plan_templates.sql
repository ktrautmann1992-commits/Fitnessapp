-- Phase 2 · Plan-Vorlagen: plan_templates, template_sessions, template_exercises (PLAN-PHASE-2 Abschnitt 5).
--
-- Wie exercises: nur freigegebene/zurückgezogene Inhalte, Schreiben nur über seed_content() (service_role).
-- RLS: anon sieht nichts; authenticated liest Vorlagen mit Status „published“ und deren Einheiten/Übungen.
-- Abweichung zum Plan (Spalte session_id): Einheiten haben den Schlüssel (template_id, day_index), Übungen
-- (template_id, day_index, order_no) – stabile Schlüssel, damit ein erneutes Einspielen denselben Stand ergibt.
-- Grenzen = CONTENT_SCHEMA_LIMITS / TRAINING_LIMITS in packages/core/src/constants.ts.

create table public.plan_templates (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  title_de text not null check (char_length(title_de) between 5 and 100),
  description_de text not null check (char_length(description_de) between 30 and 800),
  -- Matrix Phase 2 (TEMPLATE_GOAL_TYPES / TEMPLATE_EXPERIENCE_LEVELS in packages/core/src/enums.ts).
  goal_type public.goal_type not null check (goal_type in ('muscle_gain', 'fat_loss', 'general_fitness')),
  experience_level public.experience_level not null check (experience_level in ('beginner', 'advanced')),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  minutes_min smallint not null check (minutes_min between 10 and 240),
  minutes_max smallint not null check (minutes_max between 10 and 240),
  -- Studio oder Zuhause (bei Zuhause nur Geräte mit home_selectable – prüft seed_content()).
  location public.equipment_location not null,
  required_equipment_ids text[] not null default '{}' check (
    cardinality(required_equipment_ids) <= 20
    and array_position(required_equipment_ids, null) is null
    and private.has_distinct_elements(required_equipment_ids)
  ),
  optional_equipment_ids text[] not null default '{}' check (
    cardinality(optional_equipment_ids) <= 20
    and array_position(optional_equipment_ids, null) is null
    and private.has_distinct_elements(optional_equipment_ids)
  ),
  -- Meist leer = für alle.
  sex public.sex,
  meta jsonb not null default '{}' check (jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (minutes_min <= minutes_max),
  check (not (required_equipment_ids && optional_equipment_ids))
);

comment on table public.plan_templates is
  'Trainingsplan-Vorlagen (nur freigegebene/zurückgezogene). Quelle: content/plan-templates im Repository.';

create table public.template_sessions (
  template_id text not null references public.plan_templates (id) on update cascade on delete cascade,
  day_index smallint not null check (day_index between 1 and 7),
  name_de text not null check (char_length(name_de) between 2 and 60),
  focus public.session_focus not null,
  -- Geschätzte Dauer (estimateSessionMinutes in packages/core), berechnet beim Einspielen.
  estimated_minutes smallint not null check (estimated_minutes between 1 and 600),
  warmup_de text not null check (char_length(warmup_de) between 10 and 400),
  cooldown_de text not null check (char_length(cooldown_de) between 10 and 400),
  primary key (template_id, day_index)
);

create table public.template_exercises (
  template_id text not null,
  day_index smallint not null,
  order_no smallint not null check (order_no between 1 and 20),
  exercise_id text not null references public.exercises (id) on update cascade,
  sets smallint not null check (sets between 1 and 10),
  reps_min smallint check (reps_min between 1 and 100),
  reps_max smallint check (reps_max between 1 and 100),
  duration_s smallint check (duration_s between 5 and 600),
  rest_s smallint not null check (rest_s between 0 and 600),
  rpe_target numeric(3, 1) not null check (rpe_target between 1 and 10 and rpe_target * 2 = trunc(rpe_target * 2)),
  superset_group text check (superset_group ~ '^[A-Z]$'),
  notes_de text check (char_length(notes_de) between 3 and 300),
  primary key (template_id, day_index, order_no),
  foreign key (template_id, day_index)
    references public.template_sessions (template_id, day_index) on update cascade on delete cascade,
  -- Entweder Wiederholungen (beide) oder Dauer.
  check (
    (reps_min is not null and reps_max is not null and duration_s is null and reps_min <= reps_max)
    or (reps_min is null and reps_max is null and duration_s is not null)
  )
);

create index template_exercises_exercise_id_idx on public.template_exercises (exercise_id);

alter table public.plan_templates enable row level security;
alter table public.template_sessions enable row level security;
alter table public.template_exercises enable row level security;

revoke all on table public.plan_templates from anon, authenticated;
revoke all on table public.template_sessions from anon, authenticated;
revoke all on table public.template_exercises from anon, authenticated;
grant select on table public.plan_templates to authenticated;
grant select on table public.template_sessions to authenticated;
grant select on table public.template_exercises to authenticated;
grant all on table public.plan_templates to service_role;
grant all on table public.template_sessions to service_role;
grant all on table public.template_exercises to service_role;

create policy "Freigegebene Vorlagen sind für angemeldete Nutzer lesbar"
  on public.plan_templates for select to authenticated
  using (status = 'published');

create policy "Einheiten freigegebener Vorlagen sind lesbar"
  on public.template_sessions for select to authenticated
  using (
    exists (
      select 1 from public.plan_templates t
      where t.id = template_sessions.template_id and t.status = 'published'
    )
  );

create policy "Übungen freigegebener Vorlagen sind lesbar"
  on public.template_exercises for select to authenticated
  using (
    exists (
      select 1 from public.plan_templates t
      where t.id = template_exercises.template_id and t.status = 'published'
    )
  );

create trigger plan_templates_set_updated_at
  before update on public.plan_templates
  for each row execute function private.set_updated_at();
