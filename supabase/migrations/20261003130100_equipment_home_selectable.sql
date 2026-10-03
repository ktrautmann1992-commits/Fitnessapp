-- Phase 2 · Geräte-Katalog für das Studio erweitern (docs/PLAN-PHASE-2.md Abschnitt 5, Ergänzung 2).
--
-- - Neue Spalte home_selectable (Standard true): false = nur im Studio, unter „Equipment zu Hause“ nicht
--   auswählbar. Die Phase-1-Geräte bleiben unverändert auswählbar (die alte Seed-Migration bleibt wie sie ist).
-- - Neue Studio-Geräte mit home_selectable = false.
-- - Die Datenbank lehnt Studio-Geräte beim Ort „home“ ab – dieselbe Regel wie equipmentItemSchema in
--   packages/core/src/validation.ts.
-- Muss zu EQUIPMENT in packages/core/src/equipment.ts passen – ein Test in packages/core liest diese Datei.
-- Format bitte beibehalten: eine Zeile je Gerät ('id', 'name_de', 'category', has_weights, sort_order,
-- home_selectable).

alter table public.equipment
  add column home_selectable boolean not null default true;

comment on column public.equipment.home_selectable is
  'false = Studio-Gerät: beim Ort „home“ nicht erlaubt (Trigger auf user_equipment).';

insert into public.equipment (id, name_de, category, has_weights, sort_order, home_selectable) values
  ('power_rack', 'Rack (Hantelablage)', 'free_weights', false, 200, false),
  ('cable_station', 'Kabelzug', 'machines', false, 210, false),
  ('lat_pulldown', 'Latzug', 'machines', false, 220, false),
  ('leg_press', 'Beinpresse', 'machines', false, 230, false),
  ('machine_chest_press', 'Brustpresse', 'machines', false, 240, false),
  ('leg_curl_machine', 'Beinbeuger-Maschine', 'machines', false, 250, false),
  ('leg_extension_machine', 'Beinstrecker-Maschine', 'machines', false, 260, false),
  ('dip_station', 'Dip-Station', 'bodyweight', false, 270, false)
on conflict (id) do update
  set name_de = excluded.name_de,
      category = excluded.category,
      has_weights = excluded.has_weights,
      sort_order = excluded.sort_order,
      home_selectable = excluded.home_selectable;

-- ---------------------------------------------------------------------------------------------------------
-- user_equipment: Studio-Geräte nicht „zu Hause“. Als Trigger, weil eine CHECK-Bedingung keine andere
-- Tabelle lesen darf. Unbekannte Geräte lehnt weiterhin der Fremdschlüssel ab (23503).
-- Die Fehlermeldung enthält keine Nutzerdaten.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.check_user_equipment_home_selectable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.location = 'home' and exists (
    select 1 from public.equipment e where e.id = new.equipment_id and not e.home_selectable
  ) then
    raise exception 'Dieses Gerät gibt es nur im Studio.'
      using errcode = 'check_violation', hint = 'home_selectable';
  end if;
  return new;
end;
$$;

create trigger user_equipment_home_selectable
  before insert or update of equipment_id, location on public.user_equipment
  for each row execute function private.check_user_equipment_home_selectable();
