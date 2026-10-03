-- Phase 2 · Aufzählungstypen für Inhalte (Übungsbibliothek und Plan-Vorlagen).
-- Spiegelung in packages/core/src/enums.ts – db-sync.test.ts prüft, dass beide Seiten übereinstimmen.

create type public.content_status as enum ('draft', 'published', 'archived');
create type public.movement_pattern as enum (
  'squat',
  'hinge',
  'lunge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_isolation',
  'knee_flexion',
  'knee_extension',
  'hip_extension',
  'calf_raise',
  'core_anti_extension',
  'core_anti_rotation',
  'core_flexion',
  'carry',
  'conditioning',
  'mobility'
);
create type public.muscle_group as enum (
  'chest',
  'lats',
  'upper_back',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower_back',
  'glutes',
  'quadriceps',
  'hamstrings',
  'adductors',
  'calves'
);
create type public.exercise_mechanics as enum ('compound', 'isolation');
create type public.load_type as enum ('weight', 'bodyweight', 'band', 'time');
-- Eigenschaften einer Übung (keine Diagnosen) für vorsichtigere Pläne beim Flag conservative_plan.
create type public.caution_tag as enum (
  'high_impact',
  'spinal_loading',
  'overhead',
  'long_supine',
  'high_skill'
);
create type public.alternative_reason as enum ('other_equipment', 'easier', 'harder', 'home');
create type public.session_focus as enum ('full_body', 'upper', 'lower');
create type public.admin_role as enum ('content_admin');
