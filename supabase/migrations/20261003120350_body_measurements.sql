-- Phase 1 · Körperumfänge (optionaler Onboarding-Schritt „Körperumfänge“) und Mess-Erinnerung.
-- Quelle: Erweiterungsbeschluss der Gründer (docs/ERWEITERUNGEN.md).
--
-- body_measurements ist SENSIBEL (Körperdaten, Art. 9 DSGVO): Speichern nur mit gültiger Einwilligung
-- health_data; beim Widerruf gelöscht (Trigger in 20261003120600_account_and_revocation.sql).
-- Grenzwerte = BODY_MEASUREMENT_LIMITS in packages/core/src/constants.ts, dort mit Begründung.
-- Messstellen und Mess-Anleitung: packages/core/src/body-measurements.ts.

-- ---------------------------------------------------------------------------------------------------------
-- body_measurements: Umfänge in cm, eine Zeile pro Nutzer und Messtag.
-- ---------------------------------------------------------------------------------------------------------
create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null default current_date check (measured_on >= date '1900-01-01'),
  upper_arm_left_cm numeric(4, 1) check (upper_arm_left_cm between 15 and 80),
  upper_arm_right_cm numeric(4, 1) check (upper_arm_right_cm between 15 and 80),
  chest_cm numeric(4, 1) check (chest_cm between 50 and 200),
  shoulders_cm numeric(4, 1) check (shoulders_cm between 70 and 220),
  waist_cm numeric(4, 1) check (waist_cm between 40 and 250),
  abdomen_cm numeric(4, 1) check (abdomen_cm between 40 and 250),
  thigh_left_cm numeric(4, 1) check (thigh_left_cm between 25 and 120),
  thigh_right_cm numeric(4, 1) check (thigh_right_cm between 25 and 120),
  hip_cm numeric(4, 1) check (hip_cm between 50 and 250),
  calf_left_cm numeric(4, 1) check (calf_left_cm between 15 and 80),
  calf_right_cm numeric(4, 1) check (calf_right_cm between 15 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mindestens ein Umfang muss angegeben sein.
  check (
    num_nonnulls(
      upper_arm_left_cm,
      upper_arm_right_cm,
      chest_cm,
      shoulders_cm,
      waist_cm,
      abdomen_cm,
      thigh_left_cm,
      thigh_right_cm,
      hip_cm,
      calf_left_cm,
      calf_right_cm
    ) >= 1
  ),
  -- Eine Messung pro Tag: wiederholtes Senden (Offline-Sync) per Upsert ungefährlich.
  unique (user_id, measured_on)
);

comment on table public.body_measurements is
  'SENSIBEL (Art. 9 DSGVO). Körperumfänge nur mit Einwilligung health_data; wird beim Widerruf gelöscht.';

alter table public.body_measurements enable row level security;

revoke all on table public.body_measurements from anon, authenticated;
grant select, insert, update, delete on table public.body_measurements to authenticated;
grant all on table public.body_measurements to service_role;

create policy "Nutzer sehen eigene Körperumfänge"
  on public.body_measurements for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer speichern eigene Körperumfänge nur mit Einwilligung"
  on public.body_measurements for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));
create policy "Nutzer ändern eigene Körperumfänge nur mit Einwilligung"
  on public.body_measurements for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));
create policy "Nutzer löschen eigene Körperumfänge"
  on public.body_measurements for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function private.set_updated_at();

-- Messdatum höchstens 1 Tag in der Zukunft (Funktion aus 20261003120300_health_data.sql).
create trigger body_measurements_check_measured_on
  before insert or update of measured_on on public.body_measurements
  for each row execute function private.check_measured_on();

-- ---------------------------------------------------------------------------------------------------------
-- measurement_reminders: Erinnerung „Umfänge neu messen“. Enthält keine Gesundheitswerte.
-- Berechnung des nächsten Termins: nextMeasurementDue() in packages/core/src/body-measurements.ts.
-- ---------------------------------------------------------------------------------------------------------
create table public.measurement_reminders (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- = MEASUREMENT_REMINDER_INTERVAL_DAYS in packages/core/src/constants.ts
  interval_days smallint not null default 28 check (interval_days between 7 and 90),
  next_due_on date,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.measurement_reminders enable row level security;

revoke all on table public.measurement_reminders from anon, authenticated;
grant select, insert, update, delete on table public.measurement_reminders to authenticated;
grant all on table public.measurement_reminders to service_role;

create policy "Nutzer sehen eigene Mess-Erinnerung"
  on public.measurement_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Mess-Erinnerung an"
  on public.measurement_reminders for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.user_id = (select auth.uid())));
create policy "Nutzer ändern eigene Mess-Erinnerung"
  on public.measurement_reminders for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Mess-Erinnerung"
  on public.measurement_reminders for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger measurement_reminders_set_updated_at
  before update on public.measurement_reminders
  for each row execute function private.set_updated_at();
