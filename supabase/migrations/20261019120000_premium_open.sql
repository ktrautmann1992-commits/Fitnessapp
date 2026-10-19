-- Testphase „alles offen“ (Gründer-Entscheidung 19.10.2026, docs/KONZEPT.md Abschnitt 13): Bis die Testphase
-- abgeschlossen ist, gibt es keine Abos – alle angemeldeten Konten dürfen alles testen. Nur additiv:
--  1. Feature-Flag `premium_open` in private.feature_flags – AN (per Migration gesetzt).
--  2. private.has_entitlement_for – neueste Fassung (20261016160100_ai_food_photo.sql) als Basis: Premium gilt
--     zusätzlich, wenn `premium_open` an ist UND die Person ein angemeldetes, nicht gelöschtes, nicht anonymes Konto
--     hat. Sonst wie bisher (gültige Beta-Freischaltung). Die Prüfung bleibt serverseitig (CLAUDE.md „KI-Grenze“).
--  3. public.beta_admin – neueste Fassung (20261018200300_live_adjust_rpcs.sql) unverändert übernommen und nur um
--     EINEN Zweig erweitert: Flag `premium_open` (flag_on/flag_off/status; keine Freischaltung je Person), damit die
--     Gründer die Testphase per Workflow beta-grant beenden können.
--  4. public.ai_food_photo_reserve – Standard-Limits auch ohne Beta-Zeile (sonst gälte für offene Konten kein Limit)
--     und, solange premium_open an ist, eine GLOBALE Monatsobergrenze über alle Konten (Kostenbremse, Wächter M1):
--     Tabelle private.ai_budget (Aufrufe und Kosten je Kalendermonat Europe/Berlin), geprüft unter einer eigenen
--     Advisory-Sperre. Erreicht → `flag_off` („gerade abgeschaltet“), nie ein KI-Aufruf.
--  5. public.premium_open_active() – nur Anzeige für die App (Kennzeichen „Testphase: kostenlos“).
-- Unverändert wirksam: Feature-Flags der einzelnen Funktionen (ai_food_photo, food_product_lookup, live_adjustment),
-- Einwilligungen, Monats-/Tageslimits je Person (ai_food_photo_reserve: Standard 30/8, ai_usage-Protokoll) und alle
-- Rechte. Nach `premium_open` = aus gilt wieder allein private.beta_entitlements.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Flag premium_open (AN)
-- ---------------------------------------------------------------------------------------------------------
alter table private.feature_flags drop constraint feature_flags_key_check;
alter table private.feature_flags
  add constraint feature_flags_key_check
  check (key in ('ai_food_photo', 'food_product_lookup', 'live_adjustment', 'premium_open'));
insert into private.feature_flags (key, enabled) values ('premium_open', true)
on conflict (key) do nothing;

-- Globale KI-Kostenbremse je Funktion (Wächter M1). Nur service_role. Standard vorsichtig – sync:
-- AI_GLOBAL_BUDGET in packages/core/src/constants.ts (db-sync.test.ts). Ändern per Migration (Pull Request).
create table private.ai_budget (
  feature text primary key check (feature in ('food_photo')),
  monthly_calls_cap integer not null check (monthly_calls_cap between 1 and 100000),
  monthly_cost_eur_cap numeric(10, 2) not null check (monthly_cost_eur_cap > 0 and monthly_cost_eur_cap <= 10000),
  updated_at timestamptz not null default now()
);
comment on table private.ai_budget is
  'Globale Monatsobergrenze je KI-Funktion über alle Konten (Testphase alles offen). Nur service_role.';
alter table private.ai_budget enable row level security;
revoke all on table private.ai_budget from public, anon, authenticated;
grant all on table private.ai_budget to service_role;
insert into private.ai_budget (feature, monthly_calls_cap, monthly_cost_eur_cap) values ('food_photo', 2000, 10)
on conflict (feature) do nothing;
-- Für die Summe über alle Konten im Monat (die bestehende Index-Reihenfolge beginnt mit user_id).
create index if not exists ai_usage_feature_created_idx on public.ai_usage (feature, created_at);

-- ---------------------------------------------------------------------------------------------------------
-- 2. EINE Stelle für „Premium“ (KONZEPT 15 hasEntitlement). Phase 7 ersetzt nur diesen Rumpf.
--    `to_jsonb(u)` liest deleted_at/is_anonymous nur, wenn es die Spalten gibt (Supabase-Auth hat sie; die lokale
--    Test-Datenbank ohne Auth-Dienst nicht) – fehlt die Spalte, gilt das Konto als nicht gelöscht bzw. nicht anonym.
--    Gelöschte Konten (delete_my_account) stehen ohnehin nicht mehr in auth.users.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.has_entitlement_for(p_user_id uuid, p_entitlement text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from private.beta_entitlements b
    where b.user_id = p_user_id and b.entitlement = p_entitlement and b.expires_at > now()
  )
  or (
    p_entitlement = 'premium'
    and private.feature_enabled('premium_open')
    and exists (
      select 1 from auth.users u
      where u.id = p_user_id
        and (to_jsonb(u) ->> 'deleted_at') is null
        and coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false) = false
    )
  );
$$;
revoke all on function private.has_entitlement_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. beta_admin + Flag premium_open (nur Zahlen ohne Personenbezug, jede Aktion in private.admin_actions)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.premium_open_flag_admin(p_action text, p_actor text)
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
    values ('premium_open', p_action = 'flag_on', now(), p_actor)
    on conflict (key) do update
      set enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    insert into private.admin_actions (action, actor, flag_key) values (p_action, p_actor, 'premium_open');
    return jsonb_build_object('result', p_action);
  end if;
  return jsonb_build_object(
    'result', 'status',
    'flag', 'premium_open',
    'flag_enabled', private.feature_enabled('premium_open'),
    'accounts', (select count(*) from auth.users),
    'active_grants', (select count(*) from private.beta_entitlements b where b.expires_at > now()),
    'ai_calls_this_month', (select count(*) from public.ai_usage u
                            where u.status = 'succeeded'
                              and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin')
                                                   at time zone 'Europe/Berlin')),
    'ai_cost_eur_this_month', (select coalesce(round(sum(u.cost_eur), 4), 0) from public.ai_usage u
                               where u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin')
                                                      at time zone 'Europe/Berlin')),
    'photo_calls_cap', (select b.monthly_calls_cap from private.ai_budget b where b.feature = 'food_photo'),
    'photo_cost_eur_cap', (select b.monthly_cost_eur_cap from private.ai_budget b where b.feature = 'food_photo'));
end;
$$;
revoke all on function private.premium_open_flag_admin(text, text) from public, anon, authenticated;

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
  -- Testphase (Gründer 19.10.2026): Flag premium_open – alle angemeldeten Konten Premium; nur flag_on/flag_off/status.
  if p_flag = 'premium_open' then
    return private.premium_open_flag_admin(p_action, p_actor);
  end if;
  if p_actor is null or p_actor !~ '^[A-Za-z0-9-]{1,39}$'
     or p_action is null or p_action not in ('grant', 'revoke', 'flag_on', 'flag_off', 'status')
     or p_flag is null or p_flag not in ('ai_food_photo', 'live_adjustment') then
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

  -- 4b: Status der Live-Anpassung (nur Zahlen).
  if p_flag = 'live_adjustment' then
    return private.live_adjust_status_admin();
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
-- 4. ai_food_photo_reserve – einzige Fassung (20261016160100_ai_food_photo.sql) unverändert übernommen, nur drei
--    Zeilen eingefügt: Standard-Limits auch OHNE Zeile in private.beta_entitlements. Bisher hatte jede Person mit
--    Premium eine Beta-Zeile; mit premium_open nicht mehr – ohne diese Zeilen gälte dann gar kein Limit.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.ai_food_photo_reserve(p_user_id uuid, p_min_consent_version integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: AI_FOOD_PHOTO in packages/core/src/constants.ts (db-sync.test.ts); je Person überschreibbar (N6)
  default_monthly_limit constant integer := 30;
  default_daily_limit constant integer := 8;
  default_daily_attempts_max constant integer := 16;
  monthly_limit integer;
  daily_limit integer;
  daily_attempts_max integer;
  -- Datensparsamkeit: eigene Zeilen älter als 400 Tage werden beim Reservieren gelöscht (Kostenübersicht 13 Monate).
  retention_days constant integer := 400;
  usage jsonb;
  month_used integer;
  day_used integer;
  attempts_today integer;
  -- Globale Kostenbremse (Wächter M1)
  global_calls_cap integer;
  global_cost_cap numeric;
  global_calls bigint;
  global_cost numeric;
  new_id uuid;
begin
  if p_user_id is null then
    raise exception 'Ungültige Anfrage.' using errcode = 'invalid_parameter_value';
  end if;
  if not private.feature_enabled('ai_food_photo') then
    return jsonb_build_object('result', 'flag_off');
  end if;
  if not private.has_entitlement_for(p_user_id, 'premium') then
    return jsonb_build_object('result', 'no_entitlement');
  end if;
  if p_min_consent_version is null
     or p_min_consent_version > coalesce(public.current_consent_version('ai_food_photo'), 0) then
    return jsonb_build_object('result', 'not_configured');
  end if;
  -- Einwilligungen sperren, dann prüfen: Foto-KI UND Gesundheitsdaten (das Ergebnis landet im Tagebuch).
  perform 1
  from public.consents c
  where c.user_id = p_user_id and c.consent_type in ('ai_food_photo', 'health_data') and c.revoked_at is null
  order by c.id
  for share;
  if not private.has_valid_consent_for(p_user_id, 'ai_food_photo')
     or not private.has_valid_consent_for(p_user_id, 'health_data') then
    return jsonb_build_object('result', 'no_consent');
  end if;
  perform pg_advisory_xact_lock(hashtext('ai_food_photo|' || p_user_id::text));

  delete from public.ai_usage u
  where u.user_id = p_user_id and u.created_at < now() - make_interval(days => retention_days);

  select coalesce(b.monthly_limit, default_monthly_limit), coalesce(b.daily_limit, default_daily_limit),
         case when b.daily_limit is null then default_daily_attempts_max else 2 * b.daily_limit end
  into monthly_limit, daily_limit, daily_attempts_max
  from private.beta_entitlements b where b.user_id = p_user_id;
  -- Testphase (premium_open): Ohne Beta-Zeile liefert SELECT INTO keine Zeile, die Variablen blieben null – und
  -- `month_used >= null` hätte KEIN Limit gesetzt. Darum hier die Standard-Limits (KI-Grenze: Limits immer wirksam).
  monthly_limit := coalesce(monthly_limit, default_monthly_limit);
  daily_limit := coalesce(daily_limit, default_daily_limit);
  daily_attempts_max := coalesce(daily_attempts_max, default_daily_attempts_max);
  usage := private.ai_food_photo_usage(p_user_id);
  month_used := (usage ->> 'month_used')::integer;
  day_used := (usage ->> 'day_used')::integer;
  attempts_today := (usage ->> 'attempts_today')::integer;
  if month_used >= monthly_limit then
    return jsonb_build_object('result', 'limit', 'scope', 'month',
      'available_from', to_char((date_trunc('month', private.berlin_today()) + interval '1 month')::date, 'YYYY-MM-DD'));
  end if;
  if day_used >= daily_limit or attempts_today >= daily_attempts_max then
    return jsonb_build_object('result', 'limit', 'scope', 'day',
      'available_from', to_char(private.berlin_today() + 1, 'YYYY-MM-DD'));
  end if;
  -- Globale Kostenbremse, solange premium_open an ist (Wächter M1): eigene Sperre NACH der Personen-Sperre (immer
  -- dieselbe Reihenfolge, keine Verklemmung), dann alle Konten im Kalendermonat Europe/Berlin zählen. Laufende
  -- Reservierungen zählen mit (fail closed). Ohne Budget-Zeile: zu.
  if private.feature_enabled('premium_open') then
    perform pg_advisory_xact_lock(hashtext('ai_food_photo|global'));
    select b.monthly_calls_cap, b.monthly_cost_eur_cap into global_calls_cap, global_cost_cap
    from private.ai_budget b where b.feature = 'food_photo';
    select count(*) filter (where u.status in ('succeeded', 'reserved')), coalesce(sum(u.cost_eur), 0)
    into global_calls, global_cost
    from public.ai_usage u
    where u.feature = 'food_photo'
      and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin');
    if global_calls_cap is null or global_cost_cap is null
       or global_calls >= global_calls_cap or global_cost >= global_cost_cap then
      return jsonb_build_object('result', 'flag_off');
    end if;
  end if;

  insert into public.ai_usage (user_id, feature, status) values (p_user_id, 'food_photo', 'reserved')
  returning id into new_id;
  return jsonb_build_object(
    'result', 'reserved',
    'id', new_id,
    'remaining_month', monthly_limit - month_used - 1,
    'remaining_today', least(monthly_limit - month_used, daily_limit - day_used,
                             daily_attempts_max - attempts_today) - 1);
end;
$$;
revoke all on function public.ai_food_photo_reserve(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_food_photo_reserve(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Anzeige für die App: Läuft die Testphase für die angemeldete Person? (Kennzeichen „Testphase: kostenlos“,
--    Wächter N3). Nur Anzeige – die Wahrheit prüft der Server bei jeder Funktion erneut.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.premium_open_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and private.feature_enabled('premium_open')
    and private.has_entitlement_for(auth.uid(), 'premium');
$$;
revoke all on function public.premium_open_active() from public, anon;
grant execute on function public.premium_open_active() to authenticated;
