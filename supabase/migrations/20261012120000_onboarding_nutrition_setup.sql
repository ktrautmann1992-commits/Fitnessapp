-- Phase 5 · Etappe N4 (docs/PLAN-PHASE-5.md 8.1, S8, W16): neuer Onboarding-Schritt „nutrition_setup“
-- (Alltagsaktivität, Trainingszeit, Meal-Prep-Plätze, „Kalorienzahlen anzeigen“).
--
-- Nur die CHECK-Liste von profiles.onboarding_step wird ergänzt – harmlos, keine neuen Daten, keine neuen Spalten.
-- Die Spalten für die Antworten (nutrition_prefs.activity_level, training_time, show_energy_numbers,
-- mealprep_slots) kommen erst mit Etappe N7; bis dahin zeigt der Supabase-Modus den Schritt nicht
-- (OnboardingState.nutritionSetupAvailable, R2-S3) und speichert ihn nie.
-- Liste = ONBOARDING_STEPS in packages/core/src/onboarding.ts (geprüft in db-sync.test.ts, letzte Fassung zählt).

alter table public.profiles drop constraint if exists profiles_onboarding_step_check;

alter table public.profiles add constraint profiles_onboarding_step_check check (
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
    'cooking',
    'nutrition_setup'
  )
);
