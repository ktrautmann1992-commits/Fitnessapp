-- Phase 5 · N7: Aufzählungen des Onboarding-Schritts nutrition_setup (docs/PLAN-PHASE-5.md 7.2, 8.1) – eigene Datei
-- (S8). Spiegelung in packages/core/src/enums.ts (ACTIVITY_LEVELS, TRAINING_TIMES, MEALPREP_SLOT_MODES); der Abgleich
-- steht in packages/core/src/db-sync.test.ts und packages/db/src/database.types.test.ts.
--
-- Die übrigen Werte-Listen der Ernährung (Mahlzeiten-Plätze, Rollen, Abteilungen, tierische Bestandteile, Tierarten,
-- Mahlzeit-Arten, Kategorien, Einheiten) stehen als CHECK-Listen an den Spalten (Präzisierung N7: einfacher zu
-- erweitern als ein Enum; db-sync prüft sie genauso gegen packages/core).

-- Alltagsaktivität OHNE Sport (Plan 4.4).
create type public.activity_level as enum ('sedentary', 'light', 'active', 'very_active');

-- Übliche Trainingszeit (Plan 4.8); varies = unterschiedlich.
create type public.training_time as enum ('early', 'morning', 'midday', 'afternoon', 'evening', 'varies');

-- Was beim Meal-Prep vorgekocht wird (Plan 6.4): Mittag oder Mittag + Abend.
create type public.mealprep_slot_mode as enum ('lunch', 'lunch_dinner');
