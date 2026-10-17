-- Etappe E4a · Wächter-Auflage M1 (docs/PLAN-E4.md „Umsetzungsstand E4a“, Nachtrag): Der gemeinsame Zwischenspeicher
-- food_products darf nicht an den Limits vorbei auslesbar sein. Bisher lieferte ein Tagebuch-Eintrag bzw. Favorit mit
-- `product|<Nummer>` Titel („Name · Marke“) und Werte aus dem Speicher, ohne die Abfrage-Limits (60/Stunde, 200/Tag je
-- Person, E4-G13) zu belasten. Ab jetzt zählt jede NEUE Nutzung einer Nummer wie eine Abfrage:
--   - neuer Produkt-Eintrag im Tagebuch bzw. geänderte Nummer an einem Eintrag (nicht: Menge/Mahlzeit ändern),
--   - neuer Produkt-Favorit (nicht: vorhandenen Favoriten erneut setzen).
-- Ist das Limit erreicht, wird der Eintrag mit dem Code `product_limit` abgelehnt bzw. der Favorit nicht gespeichert.
-- Zählung ohne Nummer, in private.food_product_lookup_counts (dieselbe Zeile wie die Abfrage).
-- Sperr-Reihenfolge (Wächter N7 S2): Einwilligung health_data FOR SHARE → food_log|<Person> (save_food_log_entries)
-- → food_product_lookup|<Person> (hier). Der Favoriten-Trigger food_log_favorites_before_write sperrt die Einwilligung
-- vorher (Trigger laufen alphabetisch: before_write < product_charge).
-- Variante „zählen“ statt „nur nach eigener Abfrage“: braucht keine personenbezogene Liste abgefragter Nummern.

-- sync: FOOD_PRODUCT_LOOKUP_LIMITS in packages/core/src/constants.ts (wie public.food_product_lookup)
create or replace function private.food_product_charge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  per_hour constant integer := 60;
  per_day constant integer := 200;
  this_hour timestamptz := date_trunc('hour', now());
  hour_used integer;
  day_used integer;
begin
  if p_user_id is null then
    raise exception 'Produkt-Limit erreicht.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('food_product_lookup|' || p_user_id::text));
  select coalesce(sum(c.lookups) filter (where c.hour_start = this_hour), 0),
         coalesce(sum(c.lookups) filter (
           where (c.hour_start at time zone 'Europe/Berlin')::date = private.berlin_today()), 0)
  into hour_used, day_used
  from private.food_product_lookup_counts c
  where c.user_id = p_user_id;
  if day_used >= per_day or hour_used >= per_hour then
    -- Meldung ohne Nummer und ohne Werte; save_food_log_entries übersetzt sie in den Code product_limit.
    raise exception 'Produkt-Limit erreicht.' using errcode = 'invalid_parameter_value';
  end if;
  insert into private.food_product_lookup_counts (user_id, hour_start, lookups) values (p_user_id, this_hour, 1)
  on conflict (user_id, hour_start) do update set lookups = private.food_product_lookup_counts.lookups + 1;
end;
$$;
revoke all on function private.food_product_charge(uuid) from public, anon, authenticated;

-- Tagebuch: neue Nutzung einer Nummer (INSERT bzw. andere Nummer beim UPDATE).
create or replace function private.food_log_entries_product_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_code is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.product_code is not distinct from new.product_code then
    return new;
  end if;
  perform private.food_product_charge(new.user_id);
  return new;
end;
$$;
revoke all on function private.food_log_entries_product_charge() from public, anon, authenticated;

create trigger food_log_entries_product_charge
  before insert or update of product_code on public.food_log_entries
  for each row execute function private.food_log_entries_product_charge();

-- Favoriten: nur ein NEUER Produkt-Favorit mit Nummer zählt (Upsert eines vorhandenen Favoriten nicht).
create or replace function private.food_log_favorites_product_charge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source is distinct from 'product' or new.product_code is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.product_code is not distinct from new.product_code then
    return new;
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.food_log_favorites f
    where f.user_id = new.user_id and f.fav_key = new.fav_key and f.product_code is not distinct from new.product_code
  ) then
    return new;
  end if;
  perform private.food_product_charge(new.user_id);
  return new;
end;
$$;
revoke all on function private.food_log_favorites_product_charge() from public, anon, authenticated;

create trigger food_log_favorites_product_charge
  before insert or update of product_code on public.food_log_favorites
  for each row execute function private.food_log_favorites_product_charge();
