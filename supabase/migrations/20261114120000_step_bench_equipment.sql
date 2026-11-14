-- Langhantel-Gruppenworkouts „Barbell Burn“ (Gründer-Auftrag 14.11.2026, docs/PLAN-BARBELL-BURN.md): neues Gerät im
-- Katalog. Nur additiv (on conflict do update), keine Nutzerdaten, RLS unverändert:
--  - Stepbrett (flaches Step zum Liegen bei Brust- und Trizeps-Übungen). Nicht zu Hause wählbar (nichts zu wählen): Es
--    fehlt nie – Ersatz: auf dem Boden liegen (App: OPTIONAL_AID_EQUIPMENT). Kategorie other – kein Kraft-Gerät.
-- Muss zu EQUIPMENT in packages/core/src/equipment.ts passen (db-sync.test.ts). Format bitte beibehalten: eine Zeile
-- je Gerät ('id', 'name_de', 'category', has_weights, sort_order, home_selectable).

insert into public.equipment (id, name_de, category, has_weights, sort_order, home_selectable) values
  ('step_bench', 'Stepbrett', 'other', false, 320, false)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order,
      home_selectable = excluded.home_selectable;
