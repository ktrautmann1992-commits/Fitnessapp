-- Calisthenics, Schlingentrainer, Lauf-Kraft (Gründer-Freigabe 25.10.2026, docs/PLAN-CALISTHENICS-SCHLINGE.md):
-- neue Enum-Werte – in einer EIGENEN Migrationsdatei, weil Postgres neue Enum-Werte erst nach dem Commit nutzen kann
-- (`alter type … add value`). Nur additiv; keine Tabelle, keine Daten. Abgleich mit packages/core in db-sync.test.ts.
--  - goal_type 'calisthenics' (Ziel „Calisthenics / Körperbeherrschung“, GOAL_TYPES),
--  - workout_category 'run_strength' (15-min-Einheiten „Lauf-Kraft & Lauf-ABC“, WORKOUT_CATEGORIES),
--  - travel_equipment 'rings' und 'outdoor_park' (Reise-Modus: Turnringe im Gepäck, Calisthenics-Park am Reiseort,
--    TRAVEL_EQUIPMENT_OPTIONS).

alter type public.goal_type add value if not exists 'calisthenics';

alter type public.workout_category add value if not exists 'run_strength';

alter type public.travel_equipment add value if not exists 'rings';
alter type public.travel_equipment add value if not exists 'outdoor_park';
