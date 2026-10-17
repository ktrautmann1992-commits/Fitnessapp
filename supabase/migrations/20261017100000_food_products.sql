-- Etappe E4a · Produktabfrage per Barcode-Nummer über Open Food Facts (docs/PLAN-E4.md 3.2, 3.3, 6, 7; Gründer-
-- Entscheidung 17.10.2026: E4-G1 bis E4-G13 „wie empfohlen“). Gratis, ohne KI. Rein additiv:
-- 1. private.barcode_ok(code): Format + GS1-Prüfziffer (= hasValidCheckDigit in packages/core).
-- 2. public.food_products – gemeinsamer Zwischenspeicher OHNE Personenbezug (keine user_id, kein „abgefragt von“, keine
--    Zähler): RLS an und KEINE Policy, keine Rechte für anon/authenticated – niemand liest die Tabelle direkt (sonst
--    ließe sich die ganze Sammlung herunterladen; lizenzrechtlich wäre das eine öffentliche Datenbank, Plan 6.2).
--    Lesen/Schreiben nur über service_role bzw. security-definer-Funktionen. 30 Tage frisch, 90 Tage bis zum Löschen,
--    „nicht gefunden“ 1 Tag. Nie verknüpft mit foods/recipes (OFF-Daten bleiben getrennt vom BLS-Katalog).
-- 3. private.food_product_lookup_counts – Zähler je Person und Stunde OHNE Nummer (Limits 60/Stunde, 200/Tag), 2 Tage.
-- 4. private.off_request_budget – globaler Deckel 10 OFF-Abfragen je Minute für den ganzen Server, 5 Minuten Sperre
--    nach HTTP 429/503 von OFF.
-- 5. Feature-Flag `food_product_lookup` in private.feature_flags – AUS (bis zur Rechtsprüfung, Plan 6.2); schaltbar
--    über den Workflow beta-grant (beta_admin, Obermenge der E3-Fassung).
-- 6. public.food_product_lookup(uid, code) und public.food_product_upsert(p) – nur service_role (Route
--    POST /api/ernaehrung/produkt prüft vorher Herkunft und Login-Token); public.food_product_off_backoff().
-- 7. Aufräumen: beim Abfragen (höchstens 500 Zeilen) und täglich über pg_cron (falls verfügbar, wie N7 Teil 2).
-- Grenzen = FOOD_PRODUCT_LOOKUP_LIMITS / FOOD_PRODUCT_CHECK / OPEN_FOOD_FACTS (packages/core, db-sync.test.ts).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Nummer prüfen (sync: barcode.ts – BARCODE_PATTERN und gs1CheckDigit)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.barcode_ok(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_code ~ '^([0-9]{8}|[0-9]{13,14})$'
    and p_code !~ '^0+$'
    and (
      10 - (
        select sum((substr(p_code, char_length(p_code) - i, 1))::integer * case when i % 2 = 1 then 3 else 1 end)
        from generate_series(1, char_length(p_code) - 1) as i
      ) % 10
    ) % 10 = (substr(p_code, char_length(p_code), 1))::integer,
    false)
$$;
revoke all on function private.barcode_ok(text) from public;
grant execute on function private.barcode_ok(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Zwischenspeicher (gemeinsam, ohne Personenbezug)
-- ---------------------------------------------------------------------------------------------------------
create table public.food_products (
  code text primary key check (private.barcode_ok(code)),
  -- false = OFF kennt die Nummer nicht (negativer Treffer, gilt 1 Tag)
  found boolean not null,
  -- Unveränderte OFF-Antwort, nur die abgefragten Felder (sync: FOOD_PRODUCT_LOOKUP_LIMITS.offFieldsMaxBytes)
  off_fields jsonb check (
    off_fields is null or (jsonb_typeof(off_fields) = 'object' and octet_length(off_fields::text) <= 16384)
  ),
  -- Aus off_fields abgeleitet und bereinigt (sanitizeOffText; sync: FOOD_PRODUCT_CHECK.nameMaxChars usw.)
  name_de text check (
    char_length(name_de) between 1 and 80
    and name_de !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff<>]'
  ),
  brand_de text check (
    char_length(brand_de) between 1 and 40
    and brand_de !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff<>]'
  ),
  quantity_label text check (
    char_length(quantity_label) between 1 and 30
    and quantity_label !~ '[\u0001-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff<>]'
  ),
  -- sync: FOOD_PRODUCT_BASE_UNITS
  base_unit text check (base_unit in ('g', 'ml')),
  -- Je 100 g bzw. 100 ml nach Normalisierung (sync: FOOD_PRODUCT_CHECK.kcalMax / macroMaxG)
  kcal integer check (kcal between 0 and 905),
  protein_g numeric check (protein_g between 0 and 100 and protein_g * 10 = trunc(protein_g * 10)),
  carbs_g numeric check (carbs_g between 0 and 100 and carbs_g * 10 = trunc(carbs_g * 10)),
  fat_g numeric check (fat_g between 0 and 100 and fat_g * 10 = trunc(fat_g * 10)),
  sugar_g numeric check (sugar_g between 0 and 100 and sugar_g * 10 = trunc(sugar_g * 10)),
  sat_fat_g numeric check (sat_fat_g between 0 and 100 and sat_fat_g * 10 = trunc(sat_fat_g * 10)),
  fiber_g numeric check (fiber_g between 0 and 100 and fiber_g * 10 = trunc(fiber_g * 10)),
  salt_g numeric check (salt_g between 0 and 100 and salt_g * 10 = trunc(salt_g * 10)),
  -- Portion bzw. Packung nur, wenn plausibel (sync: FOOD_PRODUCT_CHECK.amountG)
  serving_g numeric check (serving_g between 1 and 2000 and serving_g * 10 = trunc(serving_g * 10)),
  package_g numeric check (package_g between 1 and 2000 and package_g * 10 = trunc(package_g * 10)),
  -- Ergebnis der Core-Prüfung (sync: FOOD_PRODUCT_CHECK_LEVELS / FOOD_PRODUCT_CHECK_REASONS)
  check_level text check (check_level in ('ok', 'review', 'blocked')),
  check_reasons text[] not null default '{}' check (
    check_reasons <@ array[
      'energy_missing', 'macro_missing', 'invalid_value', 'kcal_too_high', 'macro_too_high', 'macro_sum_too_high',
      'kj_kcal_mismatch', 'prepared_only', 'atwater_mismatch', 'kcal_from_kj', 'from_serving', 'unit_assumed',
      'sugar_over_carbs', 'sat_fat_over_fat', 'upper_bound', 'serving_ignored'
    ]::text[]
  ),
  normalizer_version integer not null check (normalizer_version >= 1),
  -- Quelle (fest; Plan 3.3, 6.1)
  source_db text not null default 'open_food_facts' check (source_db = 'open_food_facts'),
  source_license text not null default 'ODbL-1.0' check (source_license = 'ODbL-1.0'),
  source_url text not null default 'https://world.openfoodfacts.org'
    check (source_url = 'https://world.openfoodfacts.org'),
  off_last_modified timestamptz,
  retrieved_at timestamptz not null,
  -- Form: nicht gefunden = nur Nummer; gefunden = Name + Bezug + Stufe; gesperrt = keine Werte; sonst alle vier.
  check (
    (not found
      and off_fields is null and name_de is null and brand_de is null and quantity_label is null
      and base_unit is null and kcal is null and protein_g is null and carbs_g is null and fat_g is null
      and sugar_g is null and sat_fat_g is null and fiber_g is null and salt_g is null and serving_g is null
      and package_g is null and check_level is null and check_reasons = '{}')
    or (found
      and off_fields is not null and name_de is not null and base_unit is not null and check_level is not null
      and (
        (check_level = 'blocked'
          and kcal is null and protein_g is null and carbs_g is null and fat_g is null and sugar_g is null
          and sat_fat_g is null and fiber_g is null and salt_g is null)
        or (check_level <> 'blocked'
          and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
      ))
  )
);

comment on table public.food_products is
  'Zwischenspeicher Open Food Facts (E4a). KEIN Personenbezug (keine user_id). Nicht direkt lesbar (RLS ohne Policy); '
  'nur service_role bzw. security-definer-Funktionen. ODbL 1.0 / DbCL 1.0. Nie mit foods/recipes verknüpfen.';

create index food_products_retrieved_idx on public.food_products (retrieved_at);

alter table public.food_products enable row level security;
revoke all on table public.food_products from public, anon, authenticated;
grant select, insert, update, delete on table public.food_products to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Zähler je Person (ohne Nummer) und 4. globaler Deckel
-- ---------------------------------------------------------------------------------------------------------
create table private.food_product_lookup_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Volle Stunde (UTC = Stundengrenze Europe/Berlin)
  hour_start timestamptz not null check (hour_start = date_trunc('hour', hour_start)),
  lookups integer not null check (lookups between 1 and 60),
  primary key (user_id, hour_start)
);
comment on table private.food_product_lookup_counts is
  'Anzahl Produktabfragen je Person und Stunde (E4a, Limits 60/Stunde, 200/Tag). KEINE Nummern. 2 Tage.';

create table private.off_request_budget (
  id smallint primary key default 1 check (id = 1),
  window_start timestamptz not null,
  requests integer not null default 0 check (requests between 0 and 10),
  blocked_until timestamptz
);
comment on table private.off_request_budget is
  'Globaler Deckel für Abfragen bei Open Food Facts (E4a): höchstens 10 je Minute, 5 Minuten Sperre nach 429/503.';
insert into private.off_request_budget (id, window_start, requests) values (1, date_trunc('minute', now()), 0)
on conflict (id) do nothing;

alter table private.food_product_lookup_counts enable row level security;
alter table private.off_request_budget enable row level security;
revoke all on table private.food_product_lookup_counts, private.off_request_budget
  from public, anon, authenticated;
grant all on table private.food_product_lookup_counts, private.off_request_budget to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Feature-Flag `food_product_lookup` (AUS)
-- ---------------------------------------------------------------------------------------------------------
alter table private.feature_flags drop constraint feature_flags_key_check;
alter table private.feature_flags
  add constraint feature_flags_key_check check (key in ('ai_food_photo', 'food_product_lookup'));
insert into private.feature_flags (key, enabled) values ('food_product_lookup', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- Hilfen: globaler Deckel, Sperre, Aufräumen
-- ---------------------------------------------------------------------------------------------------------

-- Einen Platz im globalen Deckel nehmen (true) – höchstens 10 je Minute, nicht während einer Sperre.
create or replace function private.off_request_reserve()
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  -- sync: FOOD_PRODUCT_LOOKUP_LIMITS.globalPerMinute
  per_minute constant integer := 10;
  b_window timestamptz;
  b_requests integer;
  b_blocked timestamptz;
  this_minute timestamptz := date_trunc('minute', now());
begin
  select b.window_start, b.requests, b.blocked_until into b_window, b_requests, b_blocked
  from private.off_request_budget b where b.id = 1
  for update;
  if not found then
    insert into private.off_request_budget (id, window_start, requests) values (1, this_minute, 0)
    on conflict (id) do nothing;
    b_window := this_minute;
    b_requests := 0;
  end if;
  if b_blocked is not null and b_blocked > now() then
    return false;
  end if;
  if b_window = this_minute then
    if b_requests >= per_minute then
      return false;
    end if;
    update private.off_request_budget set requests = requests + 1 where id = 1;
  else
    update private.off_request_budget set window_start = this_minute, requests = 1 where id = 1;
  end if;
  return true;
end;
$$;
revoke all on function private.off_request_reserve() from public, anon, authenticated;

-- Nach HTTP 429/503 von OFF: 5 Minuten keine Abfragen (Schutz vor einer IP-Sperre). Nur service_role (Route).
create or replace function public.food_product_off_backoff()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: OPEN_FOOD_FACTS.backoffMinutes
  backoff_minutes constant integer := 5;
begin
  update private.off_request_budget
  set blocked_until = now() + make_interval(mins => backoff_minutes)
  where id = 1;
  return jsonb_build_object('result', 'ok');
end;
$$;
revoke all on function public.food_product_off_backoff() from public, anon, authenticated;
grant execute on function public.food_product_off_backoff() to service_role;

-- Abgelaufene Speicher-Zeilen löschen: gefunden nach 90 Tagen ohne Auffrischung, „nicht gefunden“ nach 1 Tag; je
-- Aufruf höchstens 500 Zeilen. Tagebuch-Einträge haben einen eigenen Schnappschuss (kein Fremdschlüssel).
create or replace function private.purge_food_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: FOOD_PRODUCT_LOOKUP_LIMITS
  delete_days constant integer := 90;
  negative_days constant integer := 1;
  purge_batch constant integer := 500;
  counts_retention_days constant integer := 2;
  removed integer;
begin
  delete from public.food_products p
  where p.code in (
    select q.code from public.food_products q
    where (q.found and q.retrieved_at < now() - make_interval(days => delete_days))
       or (not q.found and q.retrieved_at < now() - make_interval(days => negative_days))
    order by q.retrieved_at
    limit purge_batch
  );
  get diagnostics removed = row_count;
  delete from private.food_product_lookup_counts c
  where c.hour_start < now() - make_interval(days => counts_retention_days);
  return removed;
end;
$$;
revoke all on function private.purge_food_products() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6a. Abfrage beginnen (nur service_role) – atomar je Person. Antwort (= ProductLookupBegin in packages/core):
--   {"result": "flag_off" | "no_consent" | "unavailable"}
--   {"result": "rate_limited", "scope": "hour" | "day"}
--   {"result": "cached", "stale": false|true, "record": {…}}   Speicher-Zeile (frisch bzw. älter, wenn der Deckel voll)
--   {"result": "fetch", "record": {…} | null}                  OFF darf gefragt werden (Platz im Deckel genommen)
-- Sperr-Reihenfolge wie save_food_log_entries (Wächter N7 S2): Einwilligung health_data FOR SHARE → prüfen → Person
-- (Advisory-Sperre: Limits ohne Wettlauf) → Zähler/Speicher. Zählung OHNE Nummer; „unavailable“ zählt nicht.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.food_product_lookup(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: FOOD_PRODUCT_LOOKUP_LIMITS in packages/core/src/constants.ts
  per_hour constant integer := 60;
  per_day constant integer := 200;
  fresh_days constant integer := 30;
  negative_days constant integer := 1;
  this_hour timestamptz := date_trunc('hour', now());
  hour_used integer;
  day_used integer;
  rec jsonb;
begin
  if p_user_id is null or not private.barcode_ok(p_code) then
    raise exception 'Ungültige Anfrage.' using errcode = 'invalid_parameter_value';
  end if;
  if not private.feature_enabled('food_product_lookup') then
    return jsonb_build_object('result', 'flag_off');
  end if;
  perform 1
  from public.consents c
  where c.user_id = p_user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if not private.has_valid_consent_for(p_user_id, 'health_data') then
    return jsonb_build_object('result', 'no_consent');
  end if;
  perform pg_advisory_xact_lock(hashtext('food_product_lookup|' || p_user_id::text));

  perform private.purge_food_products();

  select coalesce(sum(c.lookups) filter (where c.hour_start = this_hour), 0),
         coalesce(sum(c.lookups) filter (
           where (c.hour_start at time zone 'Europe/Berlin')::date = private.berlin_today()), 0)
  into hour_used, day_used
  from private.food_product_lookup_counts c
  where c.user_id = p_user_id;
  if day_used >= per_day then
    return jsonb_build_object('result', 'rate_limited', 'scope', 'day');
  end if;
  if hour_used >= per_hour then
    return jsonb_build_object('result', 'rate_limited', 'scope', 'hour');
  end if;

  select to_jsonb(p) - 'source_db' - 'source_license' - 'source_url' into rec
  from public.food_products p
  where p.code = p_code;

  if rec is not null and (
       ((rec ->> 'found')::boolean and (rec ->> 'retrieved_at')::timestamptz > now() - make_interval(days => fresh_days))
       or (not (rec ->> 'found')::boolean
           and (rec ->> 'retrieved_at')::timestamptz > now() - make_interval(days => negative_days))) then
    insert into private.food_product_lookup_counts (user_id, hour_start, lookups) values (p_user_id, this_hour, 1)
    on conflict (user_id, hour_start) do update set lookups = private.food_product_lookup_counts.lookups + 1;
    return jsonb_build_object('result', 'cached', 'stale', false, 'record', rec);
  end if;

  if private.off_request_reserve() then
    insert into private.food_product_lookup_counts (user_id, hour_start, lookups) values (p_user_id, this_hour, 1)
    on conflict (user_id, hour_start) do update set lookups = private.food_product_lookup_counts.lookups + 1;
    return jsonb_build_object('result', 'fetch', 'record', rec);
  end if;

  -- Deckel voll bzw. gesperrt: ältere Zeile mit „Stand vom …“, sonst nicht erreichbar (zählt nicht).
  if rec is not null and (rec ->> 'found')::boolean then
    insert into private.food_product_lookup_counts (user_id, hour_start, lookups) values (p_user_id, this_hour, 1)
    on conflict (user_id, hour_start) do update set lookups = private.food_product_lookup_counts.lookups + 1;
    return jsonb_build_object('result', 'cached', 'stale', true, 'record', rec);
  end if;
  return jsonb_build_object('result', 'unavailable');
end;
$$;
revoke all on function public.food_product_lookup(uuid, text) from public, anon, authenticated;
grant execute on function public.food_product_lookup(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 6b. Speicher-Zeile schreiben (nur service_role) – Felder = FoodProductRecord (packages/core), Form prüfen die
-- CHECKs. Fehler OHNE Werte. Antwort {"result": "ok"}.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.food_product_upsert(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields constant jsonb := '{
    "code": "string", "found": "boolean", "off_fields": "object|null", "name_de": "string|null",
    "brand_de": "string|null", "quantity_label": "string|null", "base_unit": "string|null",
    "kcal": "number|null", "protein_g": "number|null", "carbs_g": "number|null", "fat_g": "number|null",
    "sugar_g": "number|null", "sat_fat_g": "number|null", "fiber_g": "number|null", "salt_g": "number|null",
    "serving_g": "number|null", "package_g": "number|null", "check_level": "string|null",
    "check_reasons": "array", "normalizer_version": "number", "off_last_modified": "string|null",
    "retrieved_at": "string"
  }';
  v_retrieved timestamptz;
begin
  begin
    perform private.assert_log_fields(p, fields);
    v_retrieved := (p ->> 'retrieved_at')::timestamptz;
    if v_retrieved > now() + interval '5 minutes' or v_retrieved < now() - interval '90 days'
       or (jsonb_typeof(p -> 'kcal') = 'number' and (p ->> 'kcal')::numeric <> trunc((p ->> 'kcal')::numeric)) then
      raise exception 'Ungültiger Speicher-Eintrag.' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.food_products as fp (
      code, found, off_fields, name_de, brand_de, quantity_label, base_unit, kcal, protein_g, carbs_g, fat_g,
      sugar_g, sat_fat_g, fiber_g, salt_g, serving_g, package_g, check_level, check_reasons, normalizer_version,
      off_last_modified, retrieved_at
    )
    values (
      p ->> 'code', (p ->> 'found')::boolean, case when jsonb_typeof(p -> 'off_fields') = 'object' then p -> 'off_fields' end,
      p ->> 'name_de', p ->> 'brand_de', p ->> 'quantity_label', p ->> 'base_unit', (p ->> 'kcal')::integer,
      (p ->> 'protein_g')::numeric, (p ->> 'carbs_g')::numeric, (p ->> 'fat_g')::numeric, (p ->> 'sugar_g')::numeric,
      (p ->> 'sat_fat_g')::numeric, (p ->> 'fiber_g')::numeric, (p ->> 'salt_g')::numeric,
      (p ->> 'serving_g')::numeric, (p ->> 'package_g')::numeric, p ->> 'check_level',
      array(select jsonb_array_elements_text(p -> 'check_reasons')), (p ->> 'normalizer_version')::integer,
      (p ->> 'off_last_modified')::timestamptz, v_retrieved
    )
    on conflict (code) do update
      set found = excluded.found, off_fields = excluded.off_fields, name_de = excluded.name_de,
          brand_de = excluded.brand_de, quantity_label = excluded.quantity_label, base_unit = excluded.base_unit,
          kcal = excluded.kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g,
          sugar_g = excluded.sugar_g, sat_fat_g = excluded.sat_fat_g, fiber_g = excluded.fiber_g,
          salt_g = excluded.salt_g, serving_g = excluded.serving_g, package_g = excluded.package_g,
          check_level = excluded.check_level, check_reasons = excluded.check_reasons,
          normalizer_version = excluded.normalizer_version, off_last_modified = excluded.off_last_modified,
          retrieved_at = excluded.retrieved_at;
  exception
    when data_exception or integrity_constraint_violation then
      raise exception 'Ungültiger Speicher-Eintrag.' using errcode = 'check_violation';
  end;
  return jsonb_build_object('result', 'ok');
end;
$$;
revoke all on function public.food_product_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.food_product_upsert(jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- beta_admin – neueste Fassung (20261016160100_ai_food_photo.sql) unverändert übernommen und nur um EINEN Zweig am
-- Anfang erweitert: Flag `food_product_lookup` (nur flag_on/flag_off/status; keine Freischaltung je Person – die
-- Funktion ist gratis). Status nur Summen ohne Personenbezug.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.food_product_flag_admin(p_action text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9-]{1,39}$'
     or p_action is null or p_action not in ('flag_on', 'flag_off', 'status') then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  if p_action in ('flag_on', 'flag_off') then
    insert into private.feature_flags (key, enabled, updated_at, updated_by)
    values ('food_product_lookup', p_action = 'flag_on', now(), p_actor)
    on conflict (key) do update
      set enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    insert into private.admin_actions (action, actor, flag_key) values (p_action, p_actor, 'food_product_lookup');
    return jsonb_build_object('result', p_action);
  end if;
  return jsonb_build_object(
    'result', 'status',
    'flag', 'food_product_lookup',
    'flag_enabled', private.feature_enabled('food_product_lookup'),
    'cached_products', (select count(*) from public.food_products p where p.found),
    'lookups_today', (select coalesce(sum(c.lookups), 0) from private.food_product_lookup_counts c
                      where (c.hour_start at time zone 'Europe/Berlin')::date = private.berlin_today()),
    'off_blocked', coalesce((select b.blocked_until > now() from private.off_request_budget b where b.id = 1), false));
end;
$$;
revoke all on function private.food_product_flag_admin(text, text) from public, anon, authenticated;

create or replace function public.beta_admin(
  p_action text,
  p_actor text,
  p_email text default null,
  p_days integer default 90,
  p_flag text default 'ai_food_photo',
  -- Wächter E3 N6: Limits je Person beim Freischalten (null = Standard).
  p_monthly_limit integer default null,
  p_daily_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_pattern constant text := '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$';
  target uuid;
  expires timestamptz;
begin
  -- E4a: Flag der Produktabfrage (gratis, keine Freischaltung je Person).
  if p_flag = 'food_product_lookup' then
    return private.food_product_flag_admin(p_action, p_actor);
  end if;
  if p_actor is null or p_actor !~ '^[A-Za-z0-9-]{1,39}$'
     or p_action is null or p_action not in ('grant', 'revoke', 'flag_on', 'flag_off', 'status')
     or p_flag is null or p_flag not in ('ai_food_photo') then
    return jsonb_build_object('result', 'invalid_input');
  end if;

  if p_action in ('grant', 'revoke') then
    if p_email is null or p_email !~ email_pattern or p_email ~ '[\r\n]' then
      return jsonb_build_object('result', 'invalid_input');
    end if;
    select u.id into target from auth.users u where lower(u.email) = lower(p_email);
    if target is null then
      return jsonb_build_object('result', 'not_found');
    end if;
    if p_action = 'grant' then
      if p_days is null or p_days not between 1 and 180
         or (p_monthly_limit is not null and p_monthly_limit not between 1 and 300)
         or (p_daily_limit is not null and p_daily_limit not between 1 and 50) then
        return jsonb_build_object('result', 'invalid_input');
      end if;
      expires := now() + make_interval(days => p_days);
      insert into private.beta_entitlements (user_id, entitlement, granted_at, granted_by, expires_at, monthly_limit,
                                             daily_limit)
      values (target, 'premium', now(), p_actor, expires, p_monthly_limit, p_daily_limit)
      on conflict (user_id) do update
        set granted_at = excluded.granted_at, granted_by = excluded.granted_by, expires_at = excluded.expires_at,
            monthly_limit = excluded.monthly_limit, daily_limit = excluded.daily_limit;
      insert into private.admin_actions (action, actor, target_user_id, expires_at)
      values ('beta_grant', p_actor, target, expires);
      return jsonb_build_object('result', 'granted',
        'expires_on', to_char((expires at time zone 'Europe/Berlin')::date, 'DD.MM.YYYY'));
    end if;
    delete from private.beta_entitlements b where b.user_id = target;
    insert into private.admin_actions (action, actor, target_user_id) values ('beta_revoke', p_actor, target);
    return jsonb_build_object('result', 'revoked');
  end if;

  if p_action in ('flag_on', 'flag_off') then
    insert into private.feature_flags (key, enabled, updated_at, updated_by)
    values (p_flag, p_action = 'flag_on', now(), p_actor)
    on conflict (key) do update
      set enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    insert into private.admin_actions (action, actor, flag_key) values (p_action, p_actor, p_flag);
    return jsonb_build_object('result', p_action);
  end if;

  -- status: nur Zahlen.
  return jsonb_build_object(
    'result', 'status',
    'flag', p_flag,
    'flag_enabled', private.feature_enabled(p_flag),
    'active_grants', (select count(*) from private.beta_entitlements b where b.expires_at > now()),
    'photos_this_month', (select count(*) from public.ai_usage u
                          where u.feature = 'food_photo' and u.status = 'succeeded'
                            and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin')
                                                 at time zone 'Europe/Berlin')),
    'failed_this_month', (select count(*) from public.ai_usage u
                          where u.feature = 'food_photo' and u.status = 'failed'
                            and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin')
                                                 at time zone 'Europe/Berlin')),
    'cost_eur_this_month', (select coalesce(round(sum(u.cost_eur), 4), 0) from public.ai_usage u
                            where u.feature = 'food_photo'
                              and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin')
                                                   at time zone 'Europe/Berlin')));
end;
$$;
revoke all on function public.beta_admin(text, text, text, integer, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.beta_admin(text, text, text, integer, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Export (Art. 15): eigene Zähler (Stunde, Anzahl – es gibt keine Nummern). Gelesen von export_my_data
-- (20261017100300_food_product_revoke_export.sql), nur die EIGENEN Zeilen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.my_food_product_lookup_counts()
returns table (hour_start timestamptz, lookups integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.hour_start, c.lookups
  from private.food_product_lookup_counts c
  where c.user_id = auth.uid();
$$;
revoke all on function private.my_food_product_lookup_counts() from public, anon;
grant execute on function private.my_food_product_lookup_counts() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Täglicher Lauf des Aufräumens (pg_cron, 02:37 UTC) – nur, wenn die Erweiterung verfügbar ist (wie N7 Teil 2).
-- Ohne pg_cron räumt food_product_lookup bei jeder Abfrage auf (höchstens 500 Zeilen).
-- ---------------------------------------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule(
        'food-products-retention',
        '37 2 * * *',
        'select private.purge_food_products()'
      );
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet (SQLSTATE %) – Aufräumen wirkt bei jeder Produktabfrage.', sqlstate;
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Aufräumen wirkt bei jeder Produktabfrage.';
  end if;
end;
$cron$;
