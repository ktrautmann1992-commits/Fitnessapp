-- Sportarten Stufe 1 · Restpunkte (Gründer-Auftrag 27.10.2026, docs/PLAN-SPORTARTEN-STUFE-1.md 11): neue Geräte im
-- Katalog. Nur additiv (on conflict do update), keine Nutzerdaten, RLS unverändert:
--  - Hyrox-Geräte: Ski-Ergometer, Schlitten, Sandsack, Wall Ball. Zu Hause wählbar; im Studio NICHT automatisch (App:
--    GYM_OPTIONAL_EQUIPMENT_IDS) – nur mit der Angabe „Hyrox-Geräte im Studio“ (user_equipment mit Ort gym, wie „Im
--    Studio auch rudern“). Kategorie cardio bzw. other – zählen nicht als Kraft-Gerät.
--  - Yoga/Pilates-Hilfsmittel: Matte und Block. Nicht zu Hause wählbar (nichts zu wählen): Sie fehlen nie – Ersatz
--    Handtuch/Decke bzw. Kissen/Buch (App: OPTIONAL_AID_EQUIPMENT).
-- Muss zu EQUIPMENT in packages/core/src/equipment.ts passen (db-sync.test.ts). Format bitte beibehalten: eine Zeile
-- je Gerät ('id', 'name_de', 'category', has_weights, sort_order, home_selectable).

insert into public.equipment (id, name_de, category, has_weights, sort_order, home_selectable) values
  ('ski_erg', 'Ski-Ergometer', 'cardio', false, 105, true),
  ('sled', 'Schlitten (Sled)', 'other', false, 110, true),
  ('sandbag', 'Sandsack', 'other', false, 115, true),
  ('wall_ball', 'Wall Ball (Medizinball)', 'other', false, 120, true),
  ('mat', 'Matte', 'other', false, 300, false),
  ('yoga_block', 'Block', 'other', false, 310, false)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order,
      home_selectable = excluded.home_selectable;
