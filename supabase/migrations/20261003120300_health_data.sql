-- Phase 1 · Gesundheitsdaten (DSGVO Art. 9): Körperdaten und Gesundheits-Check.
--
-- Speichern NUR mit gültiger Einwilligung health_data in der aktuellen Version (public.has_valid_consent).
-- Beim Widerruf werden alle Zeilen gelöscht (Trigger in 20261003120600_account_and_revocation.sql).
-- Grenzwerte = packages/core/src/constants.ts (BODY_METRIC_LIMITS), dort mit Begründung.
-- Keine Werte in Fehlermeldungen oder Logs.

-- ---------------------------------------------------------------------------------------------------------
-- body_metrics: Größe, Gewicht, Körperfett, Ruhepuls – eine Zeile pro Nutzer und Messtag.
-- ---------------------------------------------------------------------------------------------------------
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date check (measured_on >= date '1900-01-01'),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  weight_kg numeric(4, 1) check (weight_kg between 30 and 300),
  body_fat_pct numeric(3, 1) check (body_fat_pct between 3 and 60),
  resting_heart_rate_bpm smallint check (resting_heart_rate_bpm between 30 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Eine Messung ohne jeden Wert ergibt keinen Sinn.
  check (num_nonnulls(height_cm, weight_kg, body_fat_pct, resting_heart_rate_bpm) >= 1),
  -- Ein Eintrag pro Tag: macht wiederholtes Senden (Offline-Sync) per Upsert ungefährlich.
  unique (user_id, measured_on)
);

comment on table public.body_metrics is
  'SENSIBEL (Art. 9 DSGVO). Nur mit Einwilligung health_data; wird beim Widerruf gelöscht.';

alter table public.body_metrics enable row level security;

revoke all on table public.body_metrics from anon, authenticated;
grant select, insert, update, delete on table public.body_metrics to authenticated;
grant all on table public.body_metrics to service_role;

create policy "Nutzer sehen eigene Körperdaten"
  on public.body_metrics
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer speichern eigene Körperdaten nur mit Einwilligung"
  on public.body_metrics
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));

create policy "Nutzer ändern eigene Körperdaten nur mit Einwilligung"
  on public.body_metrics
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));

create policy "Nutzer löschen eigene Körperdaten"
  on public.body_metrics
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create trigger body_metrics_set_updated_at
  before update on public.body_metrics
  for each row execute function private.set_updated_at();

-- Messdatum höchstens 1 Tag in der Zukunft (Stichtag Europe/Berlin; 1 Tag Toleranz für Zeitzonen/Reisen).
-- = MEASURED_ON_MAX_DAYS_AHEAD in packages/core/src/constants.ts. Als Trigger, weil CHECK mit dem
-- aktuellen Datum nicht „immutable“ ist. Wird auch für body_measurements verwendet. Meldung ohne Datum.
create or replace function private.check_measured_on()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_days_ahead constant integer := 1; -- = MEASURED_ON_MAX_DAYS_AHEAD in packages/core/src/constants.ts
begin
  if new.measured_on > (now() at time zone 'Europe/Berlin')::date + max_days_ahead then
    raise exception 'Das Messdatum liegt in der Zukunft.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger body_metrics_check_measured_on
  before insert or update of measured_on on public.body_metrics
  for each row execute function private.check_measured_on();

-- ---------------------------------------------------------------------------------------------------------
-- health_screening: Gesundheits-Check (PAR-Q-angelehnt). Jeder Check ist ein neuer Eintrag (Verlauf).
-- Fragen und Flag-Berechnung: packages/core/src/health-screening.ts.
-- ---------------------------------------------------------------------------------------------------------
create table public.health_screening (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Antworten als { frage_id: true/false }; Struktur wird in packages/core per Zod geprüft.
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  -- Berechnete Flags (HEALTH_FLAGS in packages/core/src/health-screening.ts).
  flags text[] not null default '{}' check (
    flags <@ array[
      'medical_clearance_recommended',
      'pregnancy',
      'injury',
      'medication',
      'conservative_plan'
    ]::text[]
    and array_position(flags, null) is null
    and private.has_distinct_elements(flags)
    -- Jedes Flag zieht „vorsichtiger Plan“ nach sich (Plan Abschnitt 7).
    and (cardinality(flags) = 0 or 'conservative_plan' = any (flags))
  ),
  -- Bestätigter Arzt-Hinweis. Pflicht, sobald ein Flag gesetzt ist (Entscheidung zu Frage 5:
  -- weiter erlaubt nach bestätigtem Hinweis, Plan wird vorsichtiger).
  medical_notice_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  check (cardinality(flags) = 0 or medical_notice_acknowledged_at is not null)
);

comment on table public.health_screening is
  'SENSIBEL (Art. 9 DSGVO). Nur mit Einwilligung health_data; nur Einfügen und Lesen; Löschung beim Widerruf.';

-- Die Datenbank berechnet die Flags selbst aus den Antworten (gleiche Regeln wie evaluateHealthScreening()
-- in packages/core/src/health-screening.ts, abgeglichen in db-sync.test.ts) und setzt den Zeitpunkt.
-- Vom Client gesendete flags/created_at werden überschrieben – so kann conservative_plan nicht verloren gehen.
-- Antworten müssen vollständig sein: alle Fragen außer pregnancy (wird bei „männlich“ nicht gestellt),
-- nur bekannte Fragen, nur true/false. Fehlermeldungen enthalten keine Antworten.
create or replace function private.health_screening_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: Fragen je Flag (HEALTH_SCREENING_QUESTIONS in packages/core/src/health-screening.ts)
  clearance_questions constant text[] := array['heart_condition', 'chest_pain_exercise', 'chest_pain_rest', 'dizziness', 'blood_pressure', 'other_reason'];
  pregnancy_questions constant text[] := array['pregnancy'];
  injury_questions constant text[] := array['bone_joint'];
  medication_questions constant text[] := array['medication'];
  optional_questions constant text[] := array['pregnancy'];
  all_questions text[];
  answer_key text;
  result text[] := '{}';
begin
  all_questions := clearance_questions || pregnancy_questions || injury_questions || medication_questions;

  if jsonb_typeof(new.answers) is distinct from 'object' then
    raise exception 'Ungültige Antworten im Gesundheits-Check.' using errcode = 'check_violation';
  end if;
  for answer_key in select jsonb_object_keys(new.answers) loop
    if not answer_key = any (all_questions)
      or jsonb_typeof(new.answers -> answer_key) is distinct from 'boolean' then
      raise exception 'Ungültige Antworten im Gesundheits-Check.' using errcode = 'check_violation';
    end if;
  end loop;
  foreach answer_key in array all_questions loop
    if not answer_key = any (optional_questions) and not new.answers ? answer_key then
      raise exception 'Der Gesundheits-Check ist unvollständig.' using errcode = 'check_violation';
    end if;
  end loop;

  if exists (select 1 from unnest(clearance_questions) q where (new.answers ->> q)::boolean) then
    result := result || 'medical_clearance_recommended'::text;
  end if;
  if exists (select 1 from unnest(pregnancy_questions) q where (new.answers ->> q)::boolean) then
    result := result || 'pregnancy'::text;
  end if;
  if exists (select 1 from unnest(injury_questions) q where (new.answers ->> q)::boolean) then
    result := result || 'injury'::text;
  end if;
  if exists (select 1 from unnest(medication_questions) q where (new.answers ->> q)::boolean) then
    result := result || 'medication'::text;
  end if;
  if cardinality(result) > 0 then
    result := result || 'conservative_plan'::text;
  end if;

  new.flags := result;
  new.created_at := now();
  return new;
end;
$$;

create trigger health_screening_before_insert
  before insert on public.health_screening
  for each row execute function private.health_screening_before_insert();

create index health_screening_user_created_idx on public.health_screening (user_id, created_at desc);

alter table public.health_screening enable row level security;

revoke all on table public.health_screening from anon, authenticated;
-- Verlauf: Nutzer dürfen nur einfügen und lesen (kein Ändern, kein Einzel-Löschen).
grant select, insert on table public.health_screening to authenticated;
grant all on table public.health_screening to service_role;

create policy "Nutzer sehen eigene Gesundheits-Checks"
  on public.health_screening
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer speichern eigene Gesundheits-Checks nur mit Einwilligung"
  on public.health_screening
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));
