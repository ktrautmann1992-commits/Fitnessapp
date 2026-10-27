-- Nährstoff-Timing 2 – Essen rund ums Training (docs/PLAN-NAEHRSTOFF-TIMING.md, freigegeben 27.10.2026) · Etappe T0.
--
-- Rein ADDITIV: zwei neue, optionale Spalten, neue Spalten-Rechte. Bestehende Zeilen bleiben, wie sie sind (null bzw.
-- false = Verhalten wie bisher). RLS unverändert (die Richtlinien der Tabellen gelten für die neuen Spalten mit).
--
-- 1. public.planned_sessions.start_time (Entscheidung 10: „Uhrzeit der Einheit auf dem Server, an der geplanten
--    Einheit“). Optional; null = ohne eigene Uhrzeit – die App rechnet dann mit der Angabe „Trainingszeit“
--    (TRAINING_TIME_START_MINUTES) und schreibt „ca.“. Ganze Minuten von 00:00 bis 23:59 (SESSION_START_TIME in
--    packages/core/src/constants.ts, db-sync.test.ts). Die Uhrzeit hängt an der Einheit: Verschieben (anderer Tag,
--    Kalender, „Tag tauschen“, public.swap_planned_sessions) nimmt sie mit.
--    Ändern darf die Person sie selbst (Spalten-Recht wie Datum und Status). Der bestehende Trigger
--    private.planned_sessions_before_update prüft dabei unverändert: nur geplante Einheiten des aktiven Plans, Woche
--    nicht vorbei (Uhrzeit steht nicht in seiner Liste der unveränderlichen Spalten – keine neue Fassung nötig).
--    Kein Gesundheitsdatum (Uhrzeit einer Trainingseinheit); Export über to_jsonb (export_my_data) automatisch.
--
-- 2. public.meal_plan_items.user_chosen (Abschnitt 6: „selbst gewählte/getauschte Gerichte werden nicht automatisch
--    geändert“). true = die Person hat das Gericht selbst gewählt („Rezept tauschen“ bzw. „Rückgängig“ nach einer
--    Anpassung ans Training). Fehlt in der Payload = false (ältere App-Fassungen bleiben gültig). Kein Gesundheitsdatum.

alter table public.planned_sessions
  add column start_time time;

-- sync: SESSION_START_TIME (ganze Minuten 0–1439) in packages/core/src/constants.ts
alter table public.planned_sessions
  add constraint planned_sessions_start_time_check
  check (start_time is null or (start_time <= time '23:59' and extract(second from start_time) = 0));

comment on column public.planned_sessions.start_time is
  'Nährstoff-Timing (T0): Uhrzeit der Einheit (ganze Minuten), optional. null = Standard aus „Trainingszeit“ (App zeigt „ca.“). Wandert beim Verschieben mit.';

-- Nur Datum, Status und Uhrzeit – original_date setzt der Trigger (20261004120000_training_plans.sql).
grant update (start_time) on table public.planned_sessions to authenticated;

alter table public.meal_plan_items
  add column user_chosen boolean not null default false;

comment on column public.meal_plan_items.user_chosen is
  'Nährstoff-Timing (T0): Gericht selbst gewählt (Rezept tauschen / Rückgängig) – wird beim Verschieben des Trainings nie automatisch getauscht.';
