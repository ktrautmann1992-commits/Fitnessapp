-- Phase 1 · Startliste Geräte-Katalog (docs/KONZEPT.md Abschnitt 2, Punkt 8).
-- Muss zu EQUIPMENT in packages/core/src/equipment.ts passen – ein Test in packages/core liest diese Datei.
-- Format bitte beibehalten: eine Zeile je Gerät ('id', 'name_de', 'category', has_weights, sort_order).

insert into public.equipment (id, name_de, category, has_weights, sort_order) values
  ('dumbbells', 'Kurzhanteln', 'free_weights', true, 10),
  ('barbell', 'Langhantel mit Scheiben', 'free_weights', true, 20),
  ('kettlebells', 'Kettlebells', 'free_weights', true, 30),
  ('flat_bench', 'Flachbank', 'bench', false, 40),
  ('incline_bench', 'Schrägbank', 'bench', false, 50),
  ('pull_up_bar', 'Klimmzugstange', 'bodyweight', false, 60),
  ('resistance_bands', 'Widerstandsbänder', 'bands', false, 70),
  ('rowing_machine', 'Rudergerät', 'cardio', false, 80),
  ('bike_ergometer', 'Ergometer (Fahrrad)', 'cardio', false, 90),
  ('treadmill', 'Laufband', 'cardio', false, 100),
  ('other', 'Sonstiges', 'other', false, 1000)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order;
