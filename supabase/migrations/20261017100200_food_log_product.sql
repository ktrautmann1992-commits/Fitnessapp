-- Etappe E4a · Herkunft `product` im Ernährungstagebuch und Produkt-Favoriten (docs/PLAN-E4.md 2.4, 3.5; E4-G4,
-- E4-G10). Rein additiv:
-- 1. food_log_entries: Spalten product_code (Nummer, Format + Prüfziffer) und user_product_id (FK (id, user_id) →
--    user_food_products, on delete set null (user_product_id)); KEIN Fremdschlüssel auf food_products (der
--    Zwischenspeicher darf ablaufen – das Tagebuch hat seinen Schnappschuss). CHECK Herkunft + 'product', Form-CHECK um
--    den Zweig 'product' erweitert (alle bisherigen Zeilen bleiben gültig): Menge in g/ml, alle vier Werte, Nummer ODER
--    eigenes Produkt (nach dem Löschen beide leer, dann fester Titel „Eigenes Produkt“).
-- 2. food_log_favorites: Herkunft 'product' mit Schlüssel product|<Nummer> bzw. own_product|<id>, nur Verweis + Menge,
--    keine Werte; Titel setzt der Trigger (neueste Fassung aus 20261015130000_food_log.sql als Obermenge). Nur mit
--    Einwilligung health_data (Policies), beim Widerruf gelöscht (20261017100300).
-- 3. private.food_log_product_values – Werte eines Produkt-Eintrags vom SERVER (= serverProductEntry in packages/core).
-- 4. save_food_log_entries – neueste Fassung (20261016160200_food_log_photo.sql) unverändert übernommen und nur
--    erweitert (echte Obermenge, db-sync.test.ts): Felder product_code/user_product_id (fehlen sie, gilt null),
--    Herkunft 'product' mit Titel und Werten vom Server, neuer Ablehnungs-Code `product_unavailable`.

-- ---------------------------------------------------------------------------------------------------------
-- 1. food_log_entries
-- ---------------------------------------------------------------------------------------------------------
alter table public.food_log_entries add column product_code text check (product_code is null or private.barcode_ok(product_code));
alter table public.food_log_entries add column user_product_id uuid;

alter table public.food_log_entries
  add constraint food_log_entries_user_product_fkey
  foreign key (user_product_id, user_id) references public.user_food_products (id, user_id)
  on delete set null (user_product_id);

create index food_log_entries_user_product_id_idx on public.food_log_entries (user_product_id);

-- sync: FOOD_LOG_SOURCES
alter table public.food_log_entries drop constraint food_log_entries_source_check;
alter table public.food_log_entries
  add constraint food_log_entries_source_check
  check (source in ('plan_item', 'food', 'recipe', 'quick', 'custom_meal', 'photo', 'product'));

alter table public.food_log_entries drop constraint food_log_entries_shape_check;
alter table public.food_log_entries
  add constraint food_log_entries_shape_check check (
    (source = 'food'
      and food_id is not null and recipe_id is null
      and amount is not null and unit is not null and portion is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
    or (source in ('recipe', 'plan_item')
      and recipe_id is not null and food_id is null
      and portion is not null and amount is null and unit is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
    or (source = 'quick'
      and food_id is null and recipe_id is null and amount is null and unit is null and portion is null
      -- sync: QUICK_ENTRY_LABELS
      and title_de in ('Snack', 'Auswärts gegessen', 'Getränk', 'Süßes', 'Mahlzeit', 'Sonstiges')
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    -- E2: eigenes Gericht – fester Titel statt Name (sync: CUSTOM_MEAL_ENTRY_TITLE), Portion, Werte optional (Gericht
    -- ohne Werte), Makros nur mit kcal.
    or (source = 'custom_meal'
      and food_id is null and recipe_id is null and amount is null and unit is null and portion is not null
      and title_de = 'Eigenes Gericht'
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    -- E3: Foto-Bestandteil – Katalog-Lebensmittel in Gramm mit allen Werten (aus dem Katalog).
    or (source = 'photo'
      and food_id is not null and recipe_id is null
      and amount is not null and unit = 'g' and portion is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
    -- E4a: Produkt – Menge in g/ml, alle Werte (vom Server), Nummer ODER eigenes Produkt; ohne Nummer fester Titel
    -- (sync: USER_PRODUCT_ENTRY_TITLE).
    or (source = 'product'
      and food_id is null and recipe_id is null
      and amount is not null and unit in ('g', 'ml') and portion is null
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null
      and not (product_code is not null and user_product_id is not null)
      and (product_code is not null or title_de = 'Eigenes Produkt'))
  );

-- Produkt-Verweise nur bei dieser Herkunft.
alter table public.food_log_entries
  add constraint food_log_entries_product_check
  check (source = 'product' or (product_code is null and user_product_id is null));

-- ---------------------------------------------------------------------------------------------------------
-- 2. food_log_favorites
-- ---------------------------------------------------------------------------------------------------------
alter table public.food_log_favorites add column product_code text check (product_code is null or private.barcode_ok(product_code));
alter table public.food_log_favorites add column user_product_id uuid;

-- Favorit eines gelöschten eigenen Produkts geht mit (Kaskade).
alter table public.food_log_favorites
  add constraint food_log_favorites_user_product_fkey
  foreign key (user_product_id, user_id) references public.user_food_products (id, user_id)
  on delete cascade;

create index food_log_favorites_user_product_id_idx on public.food_log_favorites (user_product_id);

-- sync: FOOD_LOG_FAVORITE_SOURCES
alter table public.food_log_favorites drop constraint food_log_favorites_source_check;
alter table public.food_log_favorites
  add constraint food_log_favorites_source_check check (source in ('food', 'recipe', 'quick', 'product'));

-- Form: die bisherige (unbenannte) Bedingung aus 20261015130000_food_log.sql wird durch dieselbe Bedingung plus den
-- Zweig 'product' ersetzt. Sie ist die einzige CHECK-Bedingung mit den Schnelleintrag-Bezeichnungen (eindeutig, sonst
-- bricht die Migration ab).
do $$
declare
  shape_name text;
begin
  select c.conname into strict shape_name
  from pg_constraint c
  where c.conrelid = 'public.food_log_favorites'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%''Auswärts gegessen''%'
    and pg_get_constraintdef(c.oid) like '%''food|''%';
  execute format('alter table public.food_log_favorites drop constraint %I', shape_name);
end;
$$;

alter table public.food_log_favorites
  add constraint food_log_favorites_shape_check check (
    (source = 'food'
      and fav_key = 'food|' || food_id and recipe_id is null
      and amount is not null and unit is not null and portion is null
      and kcal is null and protein_g is null and carbs_g is null and fat_g is null)
    or (source = 'recipe'
      and fav_key = 'recipe|' || recipe_id and food_id is null
      and portion is not null and amount is null and unit is null
      and kcal is null and protein_g is null and carbs_g is null and fat_g is null)
    or (source = 'quick'
      and fav_key = 'quick|' || title_de || '|' || coalesce(kcal::text, '')
      and food_id is null and recipe_id is null and amount is null and unit is null and portion is null
      -- sync: QUICK_ENTRY_LABELS
      and title_de in ('Snack', 'Auswärts gegessen', 'Getränk', 'Süßes', 'Mahlzeit', 'Sonstiges')
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    -- E4a: Produkt – nur Verweis (Nummer ODER eigenes Produkt) + Menge in g/ml, keine Werte.
    or (source = 'product'
      and food_id is null and recipe_id is null and portion is null
      and amount is not null and unit in ('g', 'ml')
      and kcal is null and protein_g is null and carbs_g is null and fat_g is null
      and ((product_code is not null and user_product_id is null and fav_key = 'product|' || product_code)
        or (product_code is null and user_product_id is not null
          and fav_key = 'own_product|' || user_product_id::text)))
  );

alter table public.food_log_favorites
  add constraint food_log_favorites_product_check
  check (source = 'product' or (product_code is null and user_product_id is null));

-- Policies: Produkt-Favoriten (wie Schnell-Favoriten) nur mit gültiger Einwilligung health_data (E4-G10).
drop policy "Nutzer setzen Favoriten (mit Profil)" on public.food_log_favorites;
create policy "Nutzer setzen Favoriten (mit Profil)"
  on public.food_log_favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
    and (source not in ('quick', 'product') or public.has_valid_consent('health_data'))
  );
drop policy "Nutzer ändern eigene Favoriten" on public.food_log_favorites;
create policy "Nutzer ändern eigene Favoriten"
  on public.food_log_favorites for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (source not in ('quick', 'product') or public.has_valid_consent('health_data'))
  );

-- Favoriten-Trigger: neueste Fassung (20261015130000_food_log.sql) unverändert übernommen und nur um den Zweig
-- 'product' am Anfang erweitert (echte Obermenge).

create or replace function private.food_log_favorites_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalog_title text;
  valid boolean;
begin
  -- E4a: Produkt-Favoriten (Schlüssel product|<Nummer> bzw. own_product|<id>) – nur Verweis + Menge (g/ml), keine
  -- Werte; Titel vom Server (Zwischenspeicher „Name · Marke“, sonst fest „Produkt“; eigenes Produkt fest „Eigenes
  -- Produkt“ – nie Freitext vom Gerät). Nur mit gültiger Einwilligung health_data (beim Widerruf gelöscht, E4-G10):
  -- Einwilligung zuerst FOR SHARE sperren wie bei Schnell-Favoriten. Ungültig → Meldung OHNE Werte.
  if new.source = 'product' then
    if new.product_code is not null then
      select case when p.brand_de is null then p.name_de else p.name_de || ' · ' || p.brand_de end
      into catalog_title
      from public.food_products p
      where p.code = new.product_code and p.found;
      new.title_de := coalesce(btrim(left(catalog_title, 100)), 'Produkt');
    else
      new.title_de := 'Eigenes Produkt';
    end if;
    valid := coalesce(
      new.user_id is not null
      and char_length(new.fav_key) between 1 and 200
      and new.food_id is null and new.recipe_id is null and new.portion is null
      and new.unit in ('g', 'ml') and new.amount between 1 and 2000 and new.amount * 10 = trunc(new.amount * 10)
      and new.kcal is null and new.protein_g is null and new.carbs_g is null and new.fat_g is null
      and (
        (new.product_code is not null and new.user_product_id is null and private.barcode_ok(new.product_code)
          and new.fav_key = 'product|' || new.product_code)
        or (new.product_code is null and new.user_product_id is not null
          and new.fav_key = 'own_product|' || new.user_product_id::text
          and exists (
            select 1 from public.user_food_products u where u.id = new.user_product_id and u.user_id = new.user_id))
      ),
      false
    );
    if not valid then
      raise exception 'Ungültiger Favorit.' using errcode = 'check_violation';
    end if;
    perform 1
    from public.consents c
    where c.user_id = new.user_id and c.consent_type = 'health_data' and c.revoked_at is null
    order by c.id
    for share;
    if new.user_id is distinct from auth.uid() or not public.has_valid_consent('health_data') then
      raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;
  -- E4a: Produkt-Verweise nur bei Produkt-Favoriten.
  if new.product_code is not null or new.user_product_id is not null then
    raise exception 'Ungültiger Favorit.' using errcode = 'check_violation';
  end if;
  if new.source = 'food' then
    select f.name_de into catalog_title from public.foods f where f.id = new.food_id;
  elsif new.source = 'recipe' then
    select r.title_de into catalog_title from public.recipes r where r.id = new.recipe_id;
  end if;
  if catalog_title is not null then
    new.title_de := catalog_title;
  end if;

  -- Wie die CHECKs der Tabelle (null zählt als ungültig – auch NOT-NULL-Verstöße ohne Werte melden).
  valid := coalesce(
    new.user_id is not null
    and char_length(new.fav_key) between 1 and 200
    and new.source in ('food', 'recipe', 'quick')
    and char_length(new.title_de) between 1 and 100
    and (new.amount is null or new.amount > 0)
    and (new.unit is null or new.unit in ('g', 'ml', 'piece'))
    and (new.portion is null or (new.portion between 0.25 and 3 and new.portion * 4 = trunc(new.portion * 4)))
    and (new.kcal is null or new.kcal between 0 and 3000)
    and (new.protein_g is null or (new.protein_g between 0 and 750 and new.protein_g * 10 = trunc(new.protein_g * 10)))
    and (new.carbs_g is null or (new.carbs_g between 0 and 750 and new.carbs_g * 10 = trunc(new.carbs_g * 10)))
    and (new.fat_g is null or (new.fat_g between 0 and 750 and new.fat_g * 10 = trunc(new.fat_g * 10)))
    and (
      new.unit is null
      or (new.unit in ('g', 'ml') and new.amount between 1 and 2000 and new.amount * 10 = trunc(new.amount * 10))
      or (new.unit = 'piece' and new.amount between 0.5 and 20 and new.amount * 2 = trunc(new.amount * 2))
    )
    and (
      (new.source = 'food'
        and new.fav_key = 'food|' || new.food_id and new.recipe_id is null
        and new.amount is not null and new.unit is not null and new.portion is null
        and new.kcal is null and new.protein_g is null and new.carbs_g is null and new.fat_g is null)
      or (new.source = 'recipe'
        and new.fav_key = 'recipe|' || new.recipe_id and new.food_id is null
        and new.portion is not null and new.amount is null and new.unit is null
        and new.kcal is null and new.protein_g is null and new.carbs_g is null and new.fat_g is null)
      or (new.source = 'quick'
        and new.fav_key = 'quick|' || new.title_de || '|' || coalesce(new.kcal::text, '')
        and new.food_id is null and new.recipe_id is null and new.amount is null and new.unit is null
        and new.portion is null
        -- sync: QUICK_ENTRY_LABELS
        and new.title_de in ('Snack', 'Auswärts gegessen', 'Getränk', 'Süßes', 'Mahlzeit', 'Sonstiges')
        and (new.kcal is not null or (new.protein_g is null and new.carbs_g is null and new.fat_g is null)))
    ),
    false
  );
  if not valid then
    raise exception 'Ungültiger Favorit.' using errcode = 'check_violation';
  end if;

  if new.source = 'quick' then
    perform 1
    from public.consents c
    where c.user_id = new.user_id and c.consent_type = 'health_data' and c.revoked_at is null
    order by c.id
    for share;
    if new.user_id is distinct from auth.uid() or not public.has_valid_consent('health_data') then
      raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.food_log_favorites_before_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Werte eines Produkt-Eintrags vom SERVER (= serverProductEntry in packages/core/src/nutrition/food-product.ts,
-- gleiche Reihenfolge der Rechnung: Faktor = Menge / 100, js_round/js_round1 wie Math.round). Antwort
-- {"kcal", "protein_g", "carbs_g", "fat_g", "title_de"} · {"unavailable": true} (Nummer ohne nutzbare Speicher-Zeile,
-- neuer Eintrag) · null (ungültig, z. B. Einheit passt nicht zum Produkt).
-- Nummer: 1. Ändern desselben Inhalts mit gleicher Menge → Schnappschuss + Titel; 2. Speicher-Zeile nutzbar → neu
-- („Name · Marke“); 3. Ändern ohne Speicher-Zeile → verhältnisgleich aus dem Schnappschuss; 4. sonst unavailable.
-- Eigenes Produkt (wie eigene Gerichte, Wächter E2 Nachprüfung S1): vorhanden → aus dem Produkt; fehlt es (gelöscht
-- oder fremd) → Ändern aus dem Schnappschuss, neu mit den (vorher geprüften) Werten des Geräts. Titel fest.
-- Nicht über die API erreichbar, selbst KEIN security definer (läuft in save_food_log_entries).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.food_log_product_values(
  p_entry jsonb, p_old jsonb, p_user_product_id uuid, p_user_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_code text := p_entry ->> 'product_code';
  v_amount double precision := (p_entry ->> 'amount')::double precision;
  v_unit text := p_entry ->> 'unit';
  factor double precision;
  has_row boolean;
  r_found boolean;
  r_level text;
  r_unit text;
  r_name text;
  r_brand text;
  r_kcal double precision;
  r_protein double precision;
  r_carbs double precision;
  r_fat double precision;
  same_content boolean;
  same_amount boolean;
begin
  same_amount := p_old is not null and (p_old ->> 'amount')::numeric = (p_entry ->> 'amount')::numeric;
  if v_code is not null then
    select fp.found, fp.check_level, fp.base_unit, fp.name_de, fp.brand_de, fp.kcal, fp.protein_g, fp.carbs_g,
           fp.fat_g
    into r_found, r_level, r_unit, r_name, r_brand, r_kcal, r_protein, r_carbs, r_fat
    from public.food_products fp
    where fp.code = v_code;
    has_row := found;
    same_content := p_old is not null
      and p_old ->> 'source' = 'product'
      and p_old ->> 'product_code' = v_code
      and p_old ->> 'unit' = v_unit;
    if same_content and same_amount then
      return jsonb_build_object('kcal', p_old -> 'kcal', 'protein_g', p_old -> 'protein_g',
                                'carbs_g', p_old -> 'carbs_g', 'fat_g', p_old -> 'fat_g',
                                'title_de', p_old ->> 'title_de');
    end if;
    if has_row and r_found and r_level <> 'blocked' and r_kcal is not null and r_protein is not null
       and r_carbs is not null and r_fat is not null then
      if r_unit is distinct from v_unit then
        return null;
      end if;
      factor := v_amount / 100;
      return jsonb_build_object(
        'kcal', private.js_round(r_kcal * factor),
        'protein_g', private.js_round1(r_protein * factor),
        'carbs_g', private.js_round1(r_carbs * factor),
        'fat_g', private.js_round1(r_fat * factor),
        -- sync: productEntryTitle (höchstens FOOD_LOG_LIMITS.titleMaxChars Zeichen)
        'title_de', btrim(left(case when r_brand is null then r_name else r_name || ' · ' || r_brand end, 100)));
    end if;
    if same_content then
      factor := v_amount / (p_old ->> 'amount')::double precision;
      return jsonb_build_object(
        'kcal', private.js_round((p_old ->> 'kcal')::double precision * factor),
        'protein_g', private.js_round1((p_old ->> 'protein_g')::double precision * factor),
        'carbs_g', private.js_round1((p_old ->> 'carbs_g')::double precision * factor),
        'fat_g', private.js_round1((p_old ->> 'fat_g')::double precision * factor),
        'title_de', p_old ->> 'title_de');
    end if;
    return jsonb_build_object('unavailable', true);
  end if;

  -- Eigenes Produkt bzw. gelöschtes (beide Verweise leer).
  same_content := p_old is not null
    and p_old ->> 'source' = 'product'
    and p_old ->> 'product_code' is null
    and p_old ->> 'unit' = v_unit
    and ((p_old ->> 'user_product_id') is not distinct from (p_entry ->> 'user_product_id')
         or (p_user_product_id is null
             and (p_old ->> 'user_product_id' is null or p_entry ->> 'user_product_id' is null)));
  if same_content and same_amount then
    return jsonb_build_object('kcal', p_old -> 'kcal', 'protein_g', p_old -> 'protein_g',
                              'carbs_g', p_old -> 'carbs_g', 'fat_g', p_old -> 'fat_g',
                              'title_de', 'Eigenes Produkt');
  end if;
  if p_user_product_id is not null then
    select u.base_unit, u.kcal, u.protein_g, u.carbs_g, u.fat_g into r_unit, r_kcal, r_protein, r_carbs, r_fat
    from public.user_food_products u
    where u.id = p_user_product_id and u.user_id = p_user_id;
    if not found or r_unit is distinct from v_unit then
      return null;
    end if;
    factor := v_amount / 100;
    return jsonb_build_object(
      'kcal', private.js_round(r_kcal * factor),
      'protein_g', private.js_round1(r_protein * factor),
      'carbs_g', private.js_round1(r_carbs * factor),
      'fat_g', private.js_round1(r_fat * factor),
      'title_de', 'Eigenes Produkt');
  end if;
  if same_content then
    factor := v_amount / (p_old ->> 'amount')::double precision;
    return jsonb_build_object(
      'kcal', private.js_round((p_old ->> 'kcal')::double precision * factor),
      'protein_g', private.js_round1((p_old ->> 'protein_g')::double precision * factor),
      'carbs_g', private.js_round1((p_old ->> 'carbs_g')::double precision * factor),
      'fat_g', private.js_round1((p_old ->> 'fat_g')::double precision * factor),
      'title_de', 'Eigenes Produkt');
  end if;
  -- Neu, eigenes Produkt fehlt: Werte des Geräts (vorher mit food_log_device_values_ok geprüft), Verweis wird leer.
  return jsonb_build_object('kcal', p_entry -> 'kcal', 'protein_g', p_entry -> 'protein_g',
                            'carbs_g', p_entry -> 'carbs_g', 'fat_g', p_entry -> 'fat_g',
                            'title_de', 'Eigenes Produkt');
end;
$$;

revoke all on function private.food_log_product_values(jsonb, jsonb, uuid, uuid) from public;

-- ---------------------------------------------------------------------------------------------------------
-- 4. save_food_log_entries – neueste Fassung (20261016160200_food_log_photo.sql) übernommen und nur erweitert
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_food_log_entries(p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Felder = foodLogPayloadEntrySchema (db-sync.test.ts). NICHT erlaubt: user_id (auth.uid()), revision (Server),
  -- Zeitstempel (Server).
  entry_fields constant jsonb := '{
    "id": "string", "write_id": "string", "base_revision": "number|null", "eaten_on": "string",
    "slot": "string", "source": "string", "food_id": "string|null", "recipe_id": "string|null",
    "title_de": "string", "amount": "number|null", "unit": "string|null", "portion": "number|null",
    "custom_meal_id": "string|null|missing",
    "product_code": "string|null|missing", "user_product_id": "string|null|missing",
    "kcal": "number|null", "protein_g": "number|null", "carbs_g": "number|null", "fat_g": "number|null"
  }';
  -- sync: FOOD_LOG_LIMITS in packages/core/src/constants.ts
  backdate_days constant integer := 14;
  server_future_days constant integer := 1;
  max_entries_per_day constant integer := 40;
  max_entries_per_save constant integer := 40;
  payload_max_bytes constant integer := 32000;
  iso_date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  results jsonb := '[]'::jsonb;
  e jsonb;
  v_id uuid;
  v_write_id uuid;
  v_base_revision integer;
  v_eaten_on date;
  v_source text;
  v_title text;
  -- E2: Verweis auf das eigene Gericht (null = keins bzw. nicht (mehr) vorhanden).
  v_custom_meal_id uuid;
  -- E4a: Produkt aus Open Food Facts (Nummer) bzw. eigenes Produkt (Verweis; null = keins bzw. nicht (mehr) vorhanden).
  v_product_code text;
  v_user_product_id uuid;
  -- E1-G4/E2-G2 (entschieden 15.10.2026): gespeicherter Eintrag als jsonb (keine Record-Variable) und Server-Werte.
  ex_row jsonb;
  v_values jsonb;
  -- Bestehender Eintrag als einzelne Werte (keine Record-Variable, Wächter N1): null = keiner.
  ex_id uuid;
  ex_revision integer;
  ex_write_id uuid;
  ex_eaten_on date;
  has_existing boolean;
  -- Vorhandene Plan-Mahlzeit desselben Tags und Platzes (anderes Gerät).
  pi_id uuid;
  pi_revision integer;
  new_revision integer;
  day_count integer;
  err_message text;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Zuerst die Einwilligung sperren, dann prüfen (gleiche Reihenfolge wie revoke_health_data, Wächter N7 S2).
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  -- Tageslimit ohne Wettlauf: je Person nacheinander (nach der Einwilligung, vor den Zeilen).
  perform pg_advisory_xact_lock(hashtext('food_log|' || current_user_id::text));

  -- Die Liste als Ganzes (Fehler ohne Inhalte).
  begin
    if jsonb_typeof(p_entries) is distinct from 'array' then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
    end if;
    if octet_length(p_entries::text) > payload_max_bytes
       or jsonb_array_length(p_entries) not between 1 and max_entries_per_save
       or (select count(distinct x ->> 'id') <> count(*) from jsonb_array_elements(p_entries) x) then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
    end if;
  exception
    when data_exception or integrity_constraint_violation then
      raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = sqlstate;
  end;

  for e in select value from jsonb_array_elements(p_entries) loop
    -- Eigener Teilschritt je Eintrag: Fehler machen nur DIESEN Eintrag rückgängig. `results` wird erst am Ende eines
    -- erfolgreichen Teilschritts ergänzt (Variablen werden bei einem Rücksprung nicht zurückgesetzt).
    begin
      perform private.assert_log_fields(e, entry_fields);
      if (e ->> 'eaten_on') !~ iso_date_pattern then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      v_id := (e ->> 'id')::uuid;
      v_write_id := (e ->> 'write_id')::uuid;
      v_base_revision := (e ->> 'base_revision')::integer;
      v_eaten_on := (e ->> 'eaten_on')::date;
      v_source := e ->> 'source';
      v_custom_meal_id := null;
      v_product_code := null;
      v_user_product_id := null;

      select f.id, f.revision, f.last_write_id, f.eaten_on into ex_id, ex_revision, ex_write_id, ex_eaten_on
      from public.food_log_entries f
      where f.id = v_id and f.user_id = current_user_id
      for update;
      has_existing := found;

      -- Idempotenz: dieselbe Fassung erneut gesendet → saved mit aktueller revision, nichts ändern (auch nach Ablauf
      -- des Fensters).
      if has_existing and ex_write_id = v_write_id then
        results := results || jsonb_build_array(
          jsonb_build_object('result', 'saved', 'id', ex_id, 'revision', ex_revision));
        continue;
      end if;
      -- Optimistische Sperre: Ändern nur auf Basis der gespeicherten revision; neu nur ohne Zeile. Gibt es den Eintrag
      -- nicht mehr (anderswo gelöscht), sind id und revision null (Wächter E1 H1).
      if has_existing and v_base_revision is distinct from ex_revision then
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'conflict', 'reason', 'revision', 'id', ex_id, 'revision', ex_revision));
        continue;
      end if;
      if not has_existing and v_base_revision is not null then
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null));
        continue;
      end if;

      -- Datumsfenster: höchstens 14 Tage zurück, nie in die Zukunft (1 Tag Toleranz für die Gerätezeit). Ein Eintrag
      -- älter als 14 Tage ist nicht mehr änderbar (Löschen geht immer).
      if v_eaten_on < today - backdate_days or v_eaten_on > today + server_future_days
         or ex_eaten_on < today - backdate_days then
        raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;

      -- Zahlen: höchstens eine bzw. zwei Nachkommastellen VOR der Umwandlung (sonst würde still gerundet); kcal ganz.
      if (jsonb_typeof(e -> 'kcal') = 'number' and (e ->> 'kcal')::numeric <> trunc((e ->> 'kcal')::numeric))
         or exists (
           select 1 from unnest(array['protein_g', 'carbs_g', 'fat_g', 'amount']) k
           where jsonb_typeof(e -> k) = 'number' and (e ->> k)::numeric * 10 <> trunc((e ->> k)::numeric * 10)
         )
         or (jsonb_typeof(e -> 'portion') = 'number'
             and (e ->> 'portion')::numeric * 4 <> trunc((e ->> 'portion')::numeric * 4)) then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'check_violation';
      end if;

      -- „Gegessen“ an derselben Plan-Mahlzeit von einem anderen Gerät (eigene id): kein Fehler, sondern Konflikt mit
      -- dem vorhandenen Eintrag – die App übernimmt ihn (Plan 5: doppelt abgehakt = idempotent).
      if v_source = 'plan_item' then
        select f.id, f.revision into pi_id, pi_revision
        from public.food_log_entries f
        where f.user_id = current_user_id and f.eaten_on = v_eaten_on and f.slot = e ->> 'slot'
          and f.source = 'plan_item' and f.id <> v_id;
        if found then
          results := results || jsonb_build_array(jsonb_build_object(
            'result', 'conflict', 'reason', 'plan_item_exists', 'id', pi_id, 'revision', pi_revision));
          continue;
        end if;
      end if;

      -- Verweis auf ein eigenes Gericht nur bei dieser Herkunft (E2).
      if v_source <> 'custom_meal' and e ->> 'custom_meal_id' is not null then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      -- E4a: Produkt-Verweise nur bei Herkunft 'product', nie beide zugleich.
      if (v_source <> 'product' and (e ->> 'product_code' is not null or e ->> 'user_product_id' is not null))
         or (e ->> 'product_code' is not null and e ->> 'user_product_id' is not null) then
        raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
      end if;

      -- Nur Inhalte aus dem Katalog (freigegeben bzw. früher freigegeben = archiviert; Entwürfe liegen nie in der
      -- Datenbank). Der Titel kommt bei Katalog, Rezept und Plan-Mahlzeit aus dem Katalog – nie vom Gerät; beim
      -- Schnelleintrag aus der festen Liste (CHECK der Tabelle).
      if v_source in ('food', 'photo') then
        -- E3: Foto-Bestandteil = Katalog-Lebensmittel in Gramm; Titel aus dem Katalog wie bei 'food'.
        select f.name_de into v_title from public.foods f where f.id = e ->> 'food_id';
        if not found then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      elsif v_source in ('recipe', 'plan_item') then
        select r.title_de into v_title from public.recipes r where r.id = e ->> 'recipe_id';
        if not found then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      elsif v_source = 'custom_meal' then
        -- E2: Titel immer fest (kein Freitext im Tagebuch, nie der Name des Gerichts). Der Verweis gilt nur für ein
        -- eigenes Gericht DIESER Person; gibt es das nicht (mehr) – anderswo gelöscht oder fremd –, bleibt der Verweis
        -- leer (ohne unterscheidbare Meldung). Werte (unten, food_log_server_values): ein neuer Eintrag ohne vorhandenes
        -- Gericht behält die geprüften Werte des Geräts, das Ändern eines Eintrags, dessen Gericht gelöscht ist, rechnet
        -- aus seinem Schnappschuss (Wächter E2 Nachprüfung S1). FOR KEY SHARE: das Gericht kann bis zum Ende dieses
        -- Speicherns nicht gelöscht werden.
        v_title := 'Eigenes Gericht';
        select m.id into v_custom_meal_id
        from public.custom_meals m
        where m.id = (e ->> 'custom_meal_id')::uuid and m.user_id = current_user_id
        for key share;
      elsif v_source = 'product' then
        -- E4a: Titel setzt der Server (unten, private.food_log_product_values): Nummer → „Name · Marke“ aus dem
        -- Zwischenspeicher food_products (beim Ändern ohne Speicher-Zeile der bisherige Titel), eigenes Produkt → fest
        -- „Eigenes Produkt“ (nie Name oder Marke der Person). Der Verweis gilt nur für ein eigenes Produkt DIESER
        -- Person (sonst leer, ohne unterscheidbare Meldung); FOR KEY SHARE hält es bis zum Ende des Speicherns.
        v_product_code := e ->> 'product_code';
        if v_product_code is null and e ->> 'user_product_id' is not null then
          select u.id into v_user_product_id
          from public.user_food_products u
          where u.id = (e ->> 'user_product_id')::uuid and u.user_id = current_user_id
          for key share;
        end if;
        v_title := 'Eigenes Produkt';
      else
        v_title := e ->> 'title_de';
      end if;

      -- Werte rechnet der SERVER (Gründer-Entscheidung 15.10.2026, E1-G4/E2-G2) für Lebensmittel, Rezept und eigenes
      -- Gericht aus dem Bestand (private.food_log_server_values, gleiche Rechnung wie packages/core); beim Ändern
      -- desselben Inhalts mit gleicher Menge der Schnappschuss, ohne Quelle im Bestand verhältnisgleich daraus. Die Werte
      -- vom Gerät werden ersetzt – außer bei einem eigenen Gericht, das es nicht (mehr) gibt (dann Gerätewerte, geprüft). Schnelleintrag
      -- und Plan-Mahlzeit (Schnappschuss des Essensplans) behalten die Werte des Geräts.
      if v_source in ('food', 'recipe', 'custom_meal', 'photo') then
        -- E3: Ein Foto-Bestandteil wird wie ein Katalog-Lebensmittel geprüft und gerechnet (Werte NIE von der KI oder
        -- vom Gerät, sondern aus dem Katalog) – deshalb hier als 'food' an die bestehenden Hilfen; gespeichert wird
        -- weiter die Herkunft 'photo'. Nur Gramm (CHECK der Tabelle).
        if v_source = 'photo' and e ->> 'unit' is distinct from 'g' then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        -- Gerätewerte trotzdem in Form und Bereich prüfen (Wächter E2 Nachprüfung H3, wie E1).
        if not private.food_log_device_values_ok(
             case when v_source = 'photo' then e || '{"source": "food"}'::jsonb else e end) then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        select to_jsonb(f) into ex_row from public.food_log_entries f where f.id = ex_id;
        if ex_row ->> 'source' = 'photo' then
          ex_row := ex_row || '{"source": "food"}'::jsonb;
        end if;
        v_values := private.food_log_server_values(
          case when v_source = 'photo' then e || '{"source": "food"}'::jsonb else e end,
          ex_row, v_custom_meal_id, current_user_id);
        if v_values is null then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        e := e || v_values;
      end if;
      -- E4a: Produkt – Werte rechnet der SERVER aus dem Zwischenspeicher (Nummer) bzw. aus dem eigenen Produkt, nie vom
      -- Gerät (docs/PLAN-E4.md 3.5). Gesperrte bzw. fehlende Speicher-Zeile → neuer Eintrag `product_unavailable`
      -- („Produkt neu abrufen“); Ändern ohne Speicher-Zeile verhältnisgleich aus dem Schnappschuss.
      if v_source = 'product' then
        if e ->> 'unit' is null or e ->> 'unit' not in ('g', 'ml') then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        if not private.food_log_device_values_ok(e || '{"source": "food"}'::jsonb) then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        select to_jsonb(f) into ex_row from public.food_log_entries f where f.id = ex_id;
        v_values := private.food_log_product_values(e, ex_row, v_user_product_id, current_user_id);
        if v_values is null then
          raise exception 'Ungültige Werte im Ernährungstagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        if v_values ? 'unavailable' then
          raise exception 'Produkt nicht verfügbar.' using errcode = 'invalid_parameter_value';
        end if;
        v_title := v_values ->> 'title_de';
        e := e || (v_values - 'title_de');
      end if;

      if has_existing then
        new_revision := ex_revision + 1;
        update public.food_log_entries f
        set eaten_on = v_eaten_on,
            slot = e ->> 'slot',
            source = v_source,
            food_id = e ->> 'food_id',
            recipe_id = e ->> 'recipe_id',
            title_de = v_title,
            custom_meal_id = v_custom_meal_id,
            product_code = v_product_code,
            user_product_id = v_user_product_id,
            amount = (e ->> 'amount')::numeric,
            unit = e ->> 'unit',
            portion = (e ->> 'portion')::numeric,
            kcal = (e ->> 'kcal')::integer,
            protein_g = (e ->> 'protein_g')::numeric,
            carbs_g = (e ->> 'carbs_g')::numeric,
            fat_g = (e ->> 'fat_g')::numeric,
            revision = new_revision,
            last_write_id = v_write_id
        where f.id = ex_id;
      else
        -- Die id erzeugt das Gerät; ist sie schon vergeben (fremder Eintrag), vergibt der Server eine neue – ohne
        -- unterscheidbare Meldung (die App übernimmt die id aus der Antwort).
        if exists (select 1 from public.food_log_entries f where f.id = v_id) then
          v_id := gen_random_uuid();
        end if;
        new_revision := 1;
        insert into public.food_log_entries (
          id, user_id, eaten_on, slot, source, food_id, recipe_id, title_de, amount, unit, portion, kcal, protein_g,
          carbs_g, fat_g, revision, last_write_id,
          custom_meal_id
          , product_code, user_product_id
        )
        values (
          v_id, current_user_id, v_eaten_on, e ->> 'slot', v_source, e ->> 'food_id', e ->> 'recipe_id', v_title,
          (e ->> 'amount')::numeric, e ->> 'unit', (e ->> 'portion')::numeric, (e ->> 'kcal')::integer,
          (e ->> 'protein_g')::numeric, (e ->> 'carbs_g')::numeric, (e ->> 'fat_g')::numeric, new_revision, v_write_id,
          v_custom_meal_id
          , v_product_code, v_user_product_id
        );
      end if;

      -- Höchstens 40 Einträge je Tag (nach dem Schreiben gezählt; die Advisory-Sperre schließt Wettläufe aus).
      select count(*) into day_count
      from public.food_log_entries f
      where f.user_id = current_user_id and f.eaten_on = v_eaten_on;
      if day_count > max_entries_per_day then
        raise exception 'Zu viele Einträge an diesem Tag.' using errcode = 'program_limit_exceeded';
      end if;

      results := results || jsonb_build_array(
        jsonb_build_object('result', 'saved', 'id', v_id, 'revision', new_revision));
    exception
      -- Nur DIESER Eintrag wird zurückgerollt; Meldung bzw. Code ohne Werte (kein Zeileninhalt, kein Gesundheitsbezug).
      when program_limit_exceeded then
        results := results || jsonb_build_array(jsonb_build_object('result', 'rejected', 'code', 'day_full'));
      when data_exception or integrity_constraint_violation then
        get stacked diagnostics err_message = message_text;
        results := results || jsonb_build_array(jsonb_build_object(
          'result', 'rejected',
          'code', case when err_message = 'Das Datum liegt außerhalb des erlaubten Zeitraums.' then 'out_of_range'
                       when err_message = 'Produkt nicht verfügbar.' then 'product_unavailable'
                       else 'invalid' end));
    end;
  end loop;
  return results;
end;
$$;

revoke all on function public.save_food_log_entries(jsonb) from public, anon;
grant execute on function public.save_food_log_entries(jsonb) to authenticated;
