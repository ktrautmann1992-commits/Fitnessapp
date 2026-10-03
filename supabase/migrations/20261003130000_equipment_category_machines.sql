-- Phase 2 · Neue Geräte-Kategorie „machines“ (Maschinen und Kabelzug, nur im Studio).
--
-- Eigene Migration, weil Postgres einen neuen Enum-Wert erst nach dem Commit der Transaktion verwenden lässt.
-- Die Studio-Geräte folgen in 20261003130100_equipment_home_selectable.sql.
-- Spiegelung: EQUIPMENT_CATEGORIES in packages/core/src/enums.ts (geprüft in db-sync.test.ts).

alter type public.equipment_category add value if not exists 'machines';
