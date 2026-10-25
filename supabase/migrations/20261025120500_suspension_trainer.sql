-- Trainings-Modi · Schlingentrainer im Geräte-Katalog (Gründer-Wunsch 25.10.2026, docs/PLAN-TRAINING-MODI.md 4).
-- Nur additiv: ein neues Gerät, markenneutral benannt. Kategorie `bodyweight` (wie die Klimmzugstange) – zählt nicht
-- als Kraft-Gerät, solange es keine Schlingentrainer-Übungen gibt (die folgen in einem eigenen Paket); wer nur ihn
-- hat, bekommt den Körpergewicht-Plan. Muss zu EQUIPMENT in packages/core/src/equipment.ts passen (db-sync.test.ts).
-- Format bitte beibehalten: eine Zeile je Gerät ('id', 'name_de', 'category', has_weights, sort_order,
-- home_selectable).

insert into public.equipment (id, name_de, category, has_weights, sort_order, home_selectable) values
  ('suspension_trainer', 'Schlingentrainer', 'bodyweight', false, 75, true)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order,
      home_selectable = excluded.home_selectable;
