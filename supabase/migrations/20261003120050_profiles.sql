-- Phase 1 · Profil: Geschlecht, Geburtsdatum, Erfahrung, Sprache, Onboarding-Fortschritt.
--
-- Bewusst KEINE Körper- oder Gesundheitswerte (auch nicht die Körpergröße) – die stehen in body_metrics
-- und brauchen die Einwilligung health_data (docs/PLAN-PHASE-1.md Abschnitt 5).
-- „Interesse am Zyklus-Modul“ ist nur ein Ja/Nein-Wunsch ohne Zyklusdaten (Frage 4).
--
-- Das Profil (mit geprüftem Geburtsdatum) ist VORAUSSETZUNG für alle Einwilligungen und alle weiteren
-- Nutzerdaten: Die Insert-Policies von consents, goals, user_equipment, nutrition_prefs, food_preferences,
-- measurement_reminders sowie public.has_valid_consent() verlangen eine profiles-Zeile. Damit lässt sich das
-- Mindestalter nicht umgehen. Die App legt das Profil direkt nach dem Login an (Geburtsdatum aus Schritt B).

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Spiegelung: SEX_OPTIONS in packages/core/src/validation.ts
  sex public.sex,
  -- Mindestalter 16 wird per Trigger geprüft (siehe unten). Untergrenze = BIRTH_DATE_MIN in constants.ts.
  birth_date date not null check (birth_date >= date '1900-01-01'),
  experience_level public.experience_level,
  locale public.app_locale not null default 'de-DE',
  cycle_module_interest boolean,
  -- Aktueller Onboarding-Schritt. Liste = ONBOARDING_STEPS in packages/core/src/onboarding.ts.
  onboarding_step text check (
    onboarding_step in (
      'sex',
      'health_consent',
      'body_metrics',
      'body_measurements',
      'health_screening',
      'experience',
      'goal',
      'time_budget',
      'training_location',
      'equipment',
      'nutrition',
      'cooking'
    )
  ),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Das Zyklus-Modul wird nur bei „weiblich“ angeboten.
  check (cycle_module_interest is null or coalesce(sex = 'female', false))
);

comment on table public.profiles is
  'Profil ohne Körper-/Gesundheitswerte. Mindestalter 16 serverseitig per Trigger erzwungen.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "Nutzer sehen das eigene Profil"
  on public.profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer legen das eigene Profil an"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Nutzer ändern das eigene Profil"
  on public.profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Kein DELETE für Nutzer: Das Profil verschwindet mit dem Konto (delete_my_account → Kaskade).

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Mindestalter (MIN_AGE_YEARS = 16 in packages/core/src/constants.ts – dort mit Quelle).
-- Als Trigger, weil eine CHECK-Bedingung mit current_date nicht „immutable“ ist.
-- Stichtag ist das heutige Datum in Deutschland/Österreich/Schweiz (Europe/Berlin), damit ein Nutzer an
-- seinem 16. Geburtstag auch kurz nach Mitternacht Ortszeit nicht abgewiesen wird (Server läuft in UTC).
-- age() rechnet kalendarisch wie ageInYears() in packages/core/src/age.ts (29.02. → Geburtstag am 01.03.).
-- Die Fehlermeldung enthält bewusst kein Datum.
create or replace function private.profiles_check_min_age()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  min_age_years constant integer := 16; -- = MIN_AGE_YEARS in packages/core/src/constants.ts
  today date := (now() at time zone 'Europe/Berlin')::date;
begin
  if new.birth_date > today
    or extract(year from age(today, new.birth_date)) < min_age_years then
    raise exception 'Die App ist ab 16 Jahren nutzbar.'
      using errcode = 'check_violation', hint = 'min_age';
  end if;
  return new;
end;
$$;

create trigger profiles_check_min_age
  before insert or update of birth_date on public.profiles
  for each row execute function private.profiles_check_min_age();
