-- Calisthenics · Geräte-Katalog (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.3). Nur additiv bzw. Aktualisierung des
-- Katalogs (on conflict do update), keine Nutzerdaten:
--  - Barren/Dip-Station ist jetzt auch zu Hause wählbar (vorher nur Studio) und steht neben der Klimmzugstange,
--  - neu: Turnringe, Parallettes, Calisthenics-Park draußen (ein Ort, der Klimmzugstange und Barren mitbringt –
--    EQUIPMENT_IMPLIES in packages/core/src/equipment.ts, nur App-Logik).
-- Alle in Kategorie `bodyweight` (zählen nicht als Kraft-Gerät). Muss zu EQUIPMENT in packages/core/src/equipment.ts
-- passen (db-sync.test.ts). Format bitte beibehalten: eine Zeile je Gerät ('id', 'name_de', 'category', has_weights,
-- sort_order, home_selectable).

insert into public.equipment (id, name_de, category, has_weights, sort_order, home_selectable) values
  ('dip_station', 'Barren/Dip-Station', 'bodyweight', false, 62, true),
  ('gymnastic_rings', 'Turnringe', 'bodyweight', false, 64, true),
  ('parallettes', 'Parallettes', 'bodyweight', false, 66, true),
  ('calisthenics_park', 'Calisthenics-Park draußen', 'bodyweight', false, 68, true)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order,
      home_selectable = excluded.home_selectable;
