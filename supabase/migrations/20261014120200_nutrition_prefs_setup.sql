-- Phase 5 · N7: Spalten des Onboarding-Schritts nutrition_setup an public.nutrition_prefs (docs/PLAN-PHASE-5.md 7.2,
-- 8.1, R2-S3). Spaltennamen = nutritionSetupColumnsSchema in packages/core/src/nutrition/schemas.ts.
--
-- Rein additiv: neue Spalten, bestehende Zeilen behalten alle Werte. activity_level/training_time bleiben NULL, bis
-- die Person den Schritt beantwortet (NULL = Schritt offen); mealprep_slots und show_energy_numbers bekommen den
-- Standard der App (Mittag, Zahlen an – Frage 16 B (h)). Kein Gesundheitsdatum; RLS und Rechte der Tabelle gelten
-- unverändert (eigene Zeile, Profil-Pflicht beim Anlegen).

alter table public.nutrition_prefs
  add column activity_level public.activity_level,
  add column training_time public.training_time,
  add column mealprep_slots public.mealprep_slot_mode not null default 'lunch',
  add column show_energy_numbers boolean not null default true,
  -- Optional „werktags höchstens X Minuten“ (Plan 6.1, 7.2). sync: mealPlanProfileSchema.maxPrepMinutesWeekday
  add column max_prep_minutes_weekday smallint check (max_prep_minutes_weekday between 10 and 120);

-- Alltag und Trainingszeit werden im Schritt immer gemeinsam beantwortet.
alter table public.nutrition_prefs
  add constraint nutrition_prefs_setup_together
  check ((activity_level is null) = (training_time is null));

comment on column public.nutrition_prefs.activity_level is
  'Schritt nutrition_setup: Alltagsaktivität ohne Sport. NULL = Schritt noch nicht beantwortet.';
comment on column public.nutrition_prefs.show_energy_numbers is
  'Schalter „Kalorienzahlen anzeigen“ (Standard an, Frage 16 B (h)).';
