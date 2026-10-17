-- Etappe E4a · Eigene Produkte (docs/PLAN-E4.md 2.3, 3.4; E4-G7, E4-G8, E4-G10, E4-G13). Gratis, ohne KI.
-- Nur für die Person: Name und Marke sind Freitext (wie eigene Gerichte, E2-G1) – nur mit gültiger Einwilligung
-- health_data, beim Widerruf gelöscht (consents_after_revoke, 20261017100300), im Export, beim Konto-Löschen per
-- Kaskade. Nie im Tagebuch-Titel (fester Titel „Eigenes Produkt“ + Verweis), nie in Logs oder Fehlermeldungen, nie an
-- Open Food Facts, nie in den gemeinsamen Zwischenspeicher food_products.
-- Schreiben nur über save_user_food_product / delete_user_food_product (security definer, search_path = '', REVOKE
-- public/anon) – Muster wie save_custom_meal/delete_custom_meal (E2). Grenzen = USER_FOOD_PRODUCT_LIMITS,
-- FOOD_PRODUCT_CHECK.macroSumMaxG (packages/core, db-sync.test.ts).

create table public.user_food_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Gleiche Zeichenregeln wie custom_meals.name_de (Wächter E2 H1; sync: USER_FOOD_PRODUCT_LIMITS.nameMaxChars)
  name_de text not null check (
    char_length(name_de) between 1 and 60
    and name_de !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]'
    and name_de !~ '^[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]'
    and name_de !~ '[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]$'
  ),
  -- sync: USER_FOOD_PRODUCT_LIMITS.brandMaxChars
  brand_de text check (
    char_length(brand_de) between 1 and 40
    and brand_de !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]'
    and brand_de !~ '^[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]'
    and brand_de !~ '[ \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]$'
  ),
  code text check (code is null or private.barcode_ok(code)),
  -- sync: FOOD_PRODUCT_BASE_UNITS
  base_unit text not null check (base_unit in ('g', 'ml')),
  -- Je 100 g bzw. 100 ml (sync: USER_FOOD_PRODUCT_LIMITS.kcal / per100G / servingG)
  kcal integer not null check (kcal between 0 and 900),
  protein_g numeric not null check (protein_g between 0 and 100 and protein_g * 10 = trunc(protein_g * 10)),
  carbs_g numeric not null check (carbs_g between 0 and 100 and carbs_g * 10 = trunc(carbs_g * 10)),
  fat_g numeric not null check (fat_g between 0 and 100 and fat_g * 10 = trunc(fat_g * 10)),
  sugar_g numeric check (sugar_g between 0 and 100 and sugar_g * 10 = trunc(sugar_g * 10)),
  salt_g numeric check (salt_g between 0 and 100 and salt_g * 10 = trunc(salt_g * 10)),
  serving_g numeric check (serving_g between 1 and 2000 and serving_g * 10 = trunc(serving_g * 10)),
  -- Vorausgefüllt aus Open Food Facts (nur Merker)
  based_on_off boolean not null default false,
  revision integer not null default 1 check (revision >= 1),
  last_write_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Unmögliche Werte (sync: FOOD_PRODUCT_CHECK.macroSumMaxG, refineUserProduct)
  check (
    protein_g + carbs_g + fat_g + coalesce(salt_g, 0) <= case when base_unit = 'ml' then 110 else 102 end
  )
);

comment on table public.user_food_products is
  'Eigene Produkte (E4a). SENSIBEL (Freitext, Art. 9 vorsorglich): nur mit Einwilligung health_data, beim Widerruf '
  'gelöscht, nie loggen. Nur für die Person; nie an Open Food Facts, nie in food_products. Schreiben nur über '
  'save_user_food_product/delete_user_food_product.';

create index user_food_products_user_idx on public.user_food_products (user_id, updated_at desc);

create trigger user_food_products_set_updated_at
  before update on public.user_food_products
  for each row execute function private.set_updated_at();

alter table public.user_food_products enable row level security;
revoke all on table public.user_food_products from public, anon, authenticated;
grant select on table public.user_food_products to authenticated;
grant all on table public.user_food_products to service_role;

create policy "Nutzer sehen eigene Produkte"
  on public.user_food_products for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- save_user_food_product(p_product jsonb) – einziger Schreibweg (neu oder ganz ersetzen). Eingabe =
-- userFoodProductPayloadSchema. Antwort (= userFoodProductSaveResultSchema):
--   {"result": "saved", "id", "revision"} · {"result": "conflict", "reason": "revision", "id", "revision"}
--   {"result": "conflict", "reason": "deleted", "id": null, "revision": null}
--   {"result": "rejected", "code": "invalid" | "limit"}
-- Ausnahme (ganzer Aufruf): nicht angemeldet, Profil fehlt, Einwilligung fehlt. Sperr-Reihenfolge (Wächter N7 S2):
-- Einwilligung FOR SHARE → prüfen → Person (Advisory, Obergrenze 200 ohne Wettlauf) → Zeilen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_user_food_product(p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Felder = userFoodProductPayloadSchema (db-sync.test.ts)
  product_fields constant jsonb := '{
    "id": "string", "write_id": "string", "base_revision": "number|null", "name_de": "string",
    "brand_de": "string|null", "code": "string|null", "base_unit": "string", "kcal": "number",
    "protein_g": "number", "carbs_g": "number", "fat_g": "number", "sugar_g": "number|null", "salt_g": "number|null",
    "serving_g": "number|null", "based_on_off": "boolean"
  }';
  -- sync: USER_FOOD_PRODUCT_LIMITS in packages/core/src/constants.ts
  max_products constant integer := 200;
  payload_max_bytes constant integer := 4000;
  current_user_id uuid := auth.uid();
  v_id uuid;
  v_write_id uuid;
  v_base_revision integer;
  ex_id uuid;
  ex_revision integer;
  ex_write_id uuid;
  has_existing boolean;
  new_revision integer;
  product_count integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform 1
  from public.consents c
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('user_food_products|' || current_user_id::text));

  begin
    if jsonb_typeof(p_product) is distinct from 'object' or octet_length(p_product::text) > payload_max_bytes then
      raise exception 'Ungültiges eigenes Produkt.' using errcode = 'invalid_parameter_value';
    end if;
    perform private.assert_log_fields(p_product, product_fields);
    -- Zahlen VOR der Umwandlung prüfen (sonst würde still gerundet): kcal ganz, sonst höchstens eine Nachkommastelle.
    if (p_product ->> 'kcal')::numeric <> trunc((p_product ->> 'kcal')::numeric)
       or exists (
         select 1 from unnest(array['protein_g', 'carbs_g', 'fat_g', 'sugar_g', 'salt_g', 'serving_g']) k
         where jsonb_typeof(p_product -> k) = 'number'
           and (p_product ->> k)::numeric * 10 <> trunc((p_product ->> k)::numeric * 10)
       ) then
      raise exception 'Ungültiges eigenes Produkt.' using errcode = 'check_violation';
    end if;
    v_id := (p_product ->> 'id')::uuid;
    v_write_id := (p_product ->> 'write_id')::uuid;
    v_base_revision := (p_product ->> 'base_revision')::integer;

    select u.id, u.revision, u.last_write_id into ex_id, ex_revision, ex_write_id
    from public.user_food_products u
    where u.id = v_id and u.user_id = current_user_id
    for update;
    has_existing := found;

    if has_existing and ex_write_id = v_write_id then
      return jsonb_build_object('result', 'saved', 'id', ex_id, 'revision', ex_revision);
    end if;
    if has_existing and v_base_revision is distinct from ex_revision then
      return jsonb_build_object('result', 'conflict', 'reason', 'revision', 'id', ex_id, 'revision', ex_revision);
    end if;
    if not has_existing and v_base_revision is not null then
      return jsonb_build_object('result', 'conflict', 'reason', 'deleted', 'id', null, 'revision', null);
    end if;

    if has_existing then
      new_revision := ex_revision + 1;
      update public.user_food_products u
      set name_de = p_product ->> 'name_de',
          brand_de = p_product ->> 'brand_de',
          code = p_product ->> 'code',
          base_unit = p_product ->> 'base_unit',
          kcal = (p_product ->> 'kcal')::integer,
          protein_g = (p_product ->> 'protein_g')::numeric,
          carbs_g = (p_product ->> 'carbs_g')::numeric,
          fat_g = (p_product ->> 'fat_g')::numeric,
          sugar_g = (p_product ->> 'sugar_g')::numeric,
          salt_g = (p_product ->> 'salt_g')::numeric,
          serving_g = (p_product ->> 'serving_g')::numeric,
          based_on_off = (p_product ->> 'based_on_off')::boolean,
          revision = new_revision,
          last_write_id = v_write_id
      where u.id = ex_id;
    else
      -- Fremde id → neue id ohne unterscheidbare Meldung (wie save_custom_meal).
      if exists (select 1 from public.user_food_products u where u.id = v_id) then
        v_id := gen_random_uuid();
      end if;
      new_revision := 1;
      insert into public.user_food_products (
        id, user_id, name_de, brand_de, code, base_unit, kcal, protein_g, carbs_g, fat_g, sugar_g, salt_g, serving_g,
        based_on_off, revision, last_write_id
      )
      values (
        v_id, current_user_id, p_product ->> 'name_de', p_product ->> 'brand_de', p_product ->> 'code',
        p_product ->> 'base_unit', (p_product ->> 'kcal')::integer, (p_product ->> 'protein_g')::numeric,
        (p_product ->> 'carbs_g')::numeric, (p_product ->> 'fat_g')::numeric, (p_product ->> 'sugar_g')::numeric,
        (p_product ->> 'salt_g')::numeric, (p_product ->> 'serving_g')::numeric,
        (p_product ->> 'based_on_off')::boolean, new_revision, v_write_id
      );
    end if;

    select count(*) into product_count from public.user_food_products u where u.user_id = current_user_id;
    if product_count > max_products then
      raise exception 'Zu viele eigene Produkte.' using errcode = 'program_limit_exceeded';
    end if;
    return jsonb_build_object('result', 'saved', 'id', v_id, 'revision', new_revision);
  exception
    when program_limit_exceeded then
      return jsonb_build_object('result', 'rejected', 'code', 'limit');
    when data_exception or integrity_constraint_violation then
      -- Ohne Namen, ohne Werte (kein „Failing row contains …“).
      return jsonb_build_object('result', 'rejected', 'code', 'invalid');
  end;
end;
$$;

revoke all on function public.save_user_food_product(jsonb) from public, anon;
grant execute on function public.save_user_food_product(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- delete_user_food_product(p_id) – einziger Löschweg. Geht OHNE Einwilligung (Recht auf Löschung), fremde oder schon
-- gelöschte ids ohne Wirkung mit gleicher Antwort. Sperr-Reihenfolge wie delete_custom_meal (Wächter E2 S1):
-- Person (Advisory wie save_food_log_entries) → Tagebuch-Einträge mit dem Verweis → Favoriten → Produkt, dann löschen
-- (Einträge behalten ihren Schnappschuss, Verweis leer; Produkt-Favoriten per Kaskade).
-- Antwort {"result": "ok", "id": p_id}
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_user_food_product(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('food_log|' || current_user_id::text));
  perform 1
  from public.food_log_entries f
  where f.user_id = current_user_id and f.user_product_id = p_id
  order by f.id
  for update;
  perform 1
  from public.food_log_favorites f
  where f.user_id = current_user_id and f.user_product_id = p_id
  for update;
  perform 1
  from public.user_food_products u
  where u.id = p_id and u.user_id = current_user_id
  for update;
  delete from public.user_food_products u where u.id = p_id and u.user_id = current_user_id;
  return jsonb_build_object('result', 'ok', 'id', p_id);
end;
$$;

revoke all on function public.delete_user_food_product(uuid) from public, anon;
grant execute on function public.delete_user_food_product(uuid) to authenticated;
