-- Phase 1 · Training: Ziel und Zeitbudget (goals), Geräte-Katalog (equipment), Geräte der Nutzer (user_equipment).
-- Grenzwerte = packages/core/src/constants.ts, dort mit Begründung.

-- ---------------------------------------------------------------------------------------------------------
-- goals: eine Zeile pro Nutzer. Spalten werden im Onboarding schrittweise gefüllt (Ziel → Zeitbudget → Ort),
-- deshalb sind alle außer goal_type optional. Pflichtfelder je Schritt prüft Zod in packages/core.
-- ---------------------------------------------------------------------------------------------------------
create table public.goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal_type public.goal_type not null,
  -- Disziplin nur beim Ziel Ausdauer.
  discipline public.endurance_discipline,
  -- Wettkampf- bzw. Zieldatum (optional).
  target_date date check (target_date >= date '2000-01-01'),
  sessions_per_week smallint check (sessions_per_week between 1 and 7),
  minutes_per_session smallint check (minutes_per_session between 10 and 240),
  -- Bevorzugte Wochentage nach ISO 8601: 1 = Montag … 7 = Sonntag.
  preferred_days smallint[] not null default '{}' check (
    preferred_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and array_position(preferred_days, null) is null
    and private.has_distinct_elements(preferred_days)
  ),
  training_location public.training_location,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discipline is null or goal_type = 'endurance')
);

alter table public.goals enable row level security;

revoke all on table public.goals from anon, authenticated;
grant select, insert, update, delete on table public.goals to authenticated;
grant all on table public.goals to service_role;

create policy "Nutzer sehen eigene Ziele"
  on public.goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Ziele an"
  on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.user_id = (select auth.uid())));
create policy "Nutzer ändern eigene Ziele"
  on public.goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Ziele"
  on public.goals for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- equipment: Katalog aller Geräte. Lesbar für angemeldete Nutzer, Pflege nur über service_role (Admin).
-- Startliste: 20261003120700_seed_equipment.sql (muss zu EQUIPMENT in packages/core passen).
-- ---------------------------------------------------------------------------------------------------------
create table public.equipment (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,49}$'),
  name_de text not null check (char_length(name_de) between 1 and 100),
  category public.equipment_category not null,
  -- true = Gewichtsstufen in kg sind sinnvoll (Kurzhanteln, Scheiben, Kettlebells).
  has_weights boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.equipment enable row level security;

revoke all on table public.equipment from anon, authenticated;
grant select on table public.equipment to authenticated;
grant all on table public.equipment to service_role;

create policy "Geräte-Katalog ist für angemeldete Nutzer lesbar"
  on public.equipment for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------------------------------------
-- user_equipment: welche Geräte wo (Zuhause/Studio), mit Gewichtsstufen.
-- „Sonstiges“: Katalog-Eintrag 'other' + Freitext in note (nur dort erlaubt und dort Pflicht).
-- ---------------------------------------------------------------------------------------------------------
create table public.user_equipment (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  equipment_id text not null references public.equipment (id) on update cascade,
  location public.equipment_location not null,
  -- Verfügbare Gewichtsstufen in kg (z. B. Kurzhanteln 2, 4, 6 oder Hantelscheiben 1.25, 2.5, 5).
  weights_kg numeric(5, 2)[] not null default '{}' check (
    cardinality(weights_kg) <= 40
    and array_position(weights_kg, null) is null
    and 0.25 <= all (weights_kg)
    and 200 >= all (weights_kg)
    and private.has_distinct_elements(weights_kg)
  ),
  note text check (char_length(note) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, equipment_id, location),
  check ((equipment_id = 'other') = (note is not null))
);

alter table public.user_equipment enable row level security;

revoke all on table public.user_equipment from anon, authenticated;
grant select, insert, update, delete on table public.user_equipment to authenticated;
grant all on table public.user_equipment to service_role;

create policy "Nutzer sehen eigene Geräte"
  on public.user_equipment for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Geräte an"
  on public.user_equipment for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.user_id = (select auth.uid())));
create policy "Nutzer ändern eigene Geräte"
  on public.user_equipment for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Geräte"
  on public.user_equipment for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger user_equipment_set_updated_at
  before update on public.user_equipment
  for each row execute function private.set_updated_at();
