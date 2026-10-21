-- Fit im Alter · Etappe FA1 (docs/PLAN-FIT-IM-ALTER.md 5.1, 7.3 Variante B, 13.1): neue Enum-Werte – in einer EIGENEN
-- Migrationsdatei, weil Postgres neue Enum-Werte erst nach dem Commit nutzen kann (`alter type … add value`).
-- Nur additiv; keine Tabelle, keine Daten. Abgleich mit packages/core/src/enums.ts in db-sync.test.ts und
-- packages/db/src/database.types.test.ts.
--  - goal_type 'active_aging' (Ziel „Fit im Alter“),
--  - session_focus 'balance' (Kraft-Einheit mit Schwerpunkt Gleichgewicht, keine neue Einheit-Art – Variante B),
--  - movement_pattern 'balance' (Gleichgewichtsübungen; Inhalte folgen mit Etappe FA2),
--  - caution_tag 'floor_transfer', 'spinal_flexion', 'loaded_flexion', 'trunk_rotation', 'deep_hip_flexion',
--    'hip_cross_midline' (Merkmale der Übung, keine Diagnosen; welche bestehenden Übungen sie bekommen, regelt FA2).

alter type public.goal_type add value if not exists 'active_aging';

alter type public.session_focus add value if not exists 'balance';

alter type public.movement_pattern add value if not exists 'balance';

alter type public.caution_tag add value if not exists 'floor_transfer';
alter type public.caution_tag add value if not exists 'spinal_flexion';
alter type public.caution_tag add value if not exists 'loaded_flexion';
alter type public.caution_tag add value if not exists 'trunk_rotation';
alter type public.caution_tag add value if not exists 'deep_hip_flexion';
alter type public.caution_tag add value if not exists 'hip_cross_midline';
