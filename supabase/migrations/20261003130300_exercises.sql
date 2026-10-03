-- Phase 2 · Übungsbibliothek: exercises und exercise_alternatives (docs/PLAN-PHASE-2.md Abschnitt 5).
--
-- Inhaltstabellen ohne Nutzerdaten. Die Wahrheit liegt im Repository (content/exercises/*.json); hier stehen
-- nur FREIGEGEBENE (und später zurückgezogene) Inhalte – Entwürfe nie (CHECK status <> 'draft').
-- Schreiben ausschließlich über public.seed_content() (service_role, Workflow content-seed).
-- RLS: anon sieht nichts, authenticated liest nur „published“.
-- Grenzen = CONTENT_SCHEMA_LIMITS bzw. Textlängen in packages/core/src/content/schemas.ts.

-- true, wenn alle Texte im Array zwischen min_len und max_len Zeichen lang sind (und keiner NULL ist).
create or replace function private.text_lengths_between(values_ text[], min_len integer, max_len integer)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(bool_and(v is not null and char_length(v) between min_len and max_len), true)
  from unnest(values_) as t(v);
$$;
revoke all on function private.text_lengths_between(text[], integer, integer) from public;
grant execute on function private.text_lengths_between(text[], integer, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- exercises
-- ---------------------------------------------------------------------------------------------------------
create table public.exercises (
  -- Lesbarer Schlüssel = Dateiname, z. B. 'kniebeuge-langhantel'.
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  -- Entwürfe liegen nie in der Datenbank.
  status public.content_status not null check (status <> 'draft'),
  name_de text not null check (char_length(name_de) between 2 and 100),
  name_en text not null check (char_length(name_en) between 2 and 100),
  aliases_de text[] not null default '{}' check (
    cardinality(aliases_de) <= 5
    and private.text_lengths_between(aliases_de, 2, 100)
    and private.has_distinct_elements(aliases_de)
  ),
  movement_pattern public.movement_pattern not null,
  primary_muscles public.muscle_group[] not null check (
    cardinality(primary_muscles) between 1 and 4
    and array_position(primary_muscles, null) is null
    and private.has_distinct_elements(primary_muscles)
  ),
  secondary_muscles public.muscle_group[] not null default '{}' check (
    cardinality(secondary_muscles) <= 6
    and array_position(secondary_muscles, null) is null
    and private.has_distinct_elements(secondary_muscles)
  ),
  -- Alle nötigen Geräte (leer = Körpergewicht). Existenz im Katalog prüft seed_content().
  equipment_ids text[] not null default '{}' check (
    cardinality(equipment_ids) <= 4
    and array_position(equipment_ids, null) is null
    and private.has_distinct_elements(equipment_ids)
  ),
  mechanics public.exercise_mechanics not null,
  load_type public.load_type not null,
  unilateral boolean not null default false,
  difficulty smallint not null check (difficulty between 1 and 3),
  caution_tags public.caution_tag[] not null default '{}' check (
    array_position(caution_tags, null) is null and private.has_distinct_elements(caution_tags)
  ),
  description_de text not null check (char_length(description_de) between 30 and 600),
  steps_de text[] not null check (
    cardinality(steps_de) between 2 and 8 and private.text_lengths_between(steps_de, 10, 300)
  ),
  tips_de text[] not null check (
    cardinality(tips_de) between 1 and 6 and private.text_lengths_between(tips_de, 10, 300)
  ),
  common_mistakes_de text[] not null check (
    cardinality(common_mistakes_de) between 1 and 6
    and private.text_lengths_between(common_mistakes_de, 10, 300)
  ),
  safety_note_de text not null check (char_length(safety_note_de) between 20 and 400),
  -- Herkunft und Prüfvermerk (origin, model, batch_id, created_on, expert_reviewed, reviewed_by …).
  meta jsonb not null default '{}' check (jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (primary_muscles && secondary_muscles))
);

comment on table public.exercises is
  'Übungsbibliothek (nur freigegebene/zurückgezogene Inhalte). Quelle: content/exercises im Repository.';

alter table public.exercises enable row level security;

revoke all on table public.exercises from anon, authenticated;
grant select on table public.exercises to authenticated;
grant all on table public.exercises to service_role;

create policy "Freigegebene Übungen sind für angemeldete Nutzer lesbar"
  on public.exercises for select to authenticated
  using (status = 'published');

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- exercise_alternatives: Ersatzübungen mit demselben Bewegungsmuster (prüft seed_content()).
-- Sichtbar nur, wenn BEIDE Übungen freigegeben sind.
-- ---------------------------------------------------------------------------------------------------------
create table public.exercise_alternatives (
  exercise_id text not null references public.exercises (id) on update cascade on delete cascade,
  alternative_id text not null references public.exercises (id) on update cascade on delete cascade,
  reason public.alternative_reason not null,
  priority smallint not null check (priority between 1 and 20),
  primary key (exercise_id, alternative_id),
  check (exercise_id <> alternative_id)
);

create index exercise_alternatives_alternative_id_idx
  on public.exercise_alternatives (alternative_id);

alter table public.exercise_alternatives enable row level security;

revoke all on table public.exercise_alternatives from anon, authenticated;
grant select on table public.exercise_alternatives to authenticated;
grant all on table public.exercise_alternatives to service_role;

create policy "Alternativen sichtbar, wenn beide Übungen freigegeben"
  on public.exercise_alternatives for select to authenticated
  using (
    exists (
      select 1 from public.exercises e
      where e.id = exercise_alternatives.exercise_id and e.status = 'published'
    )
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_alternatives.alternative_id and e.status = 'published'
    )
  );
