-- Etappe E3 · Gericht per Foto (Premium, Echtzeit-KI) – Datenbank-Teil (docs/PLAN-AUSWERTUNG.md Abschnitt 9, 2.7,
-- A-G15, A-G17, A-G18, A-G20; KONZEPT 6.4 und 15; PLAN-PHASE-4B 4.4/4.6/6.3 für Freischaltung und Feature-Flag).
--
-- Inhalt (rein additiv):
-- 1. Einwilligungstext `ai_food_photo` Version 1 (ENTWURF – juristisch prüfen, A-G17).
-- 2. Feature-Flags und Beta-Freischaltung bis Phase 7 (`private.feature_flags`, `private.beta_entitlements`,
--    `private.admin_actions`, `private.has_entitlement_for`, `public.has_entitlement`) – Namen und Form wie in
--    PLAN-PHASE-4B 4.4/4.6, damit 4b sie weiterverwendet. Flag `ai_food_photo` ist AUS.
-- 3. `public.ai_usage` – NUR Metadaten je KI-Aufruf (Funktion, Status, Modell, Token, Kosten, Zeitpunkte), nie
--    Inhalte (kein Foto, keine Info, keine Antwort). RLS: eigene Zeilen lesen; schreiben nur der Server.
-- 4. `public.ai_food_photo_access()` (Anzeige in der App), `public.ai_food_photo_reserve(uid)` (atomar: Flag,
--    Freischaltung, Einwilligungen, Tages- und Monatslimit, dann Reservierung) und `public.ai_food_photo_finish(…)`
--    (Abschluss mit Token/Kosten; fehlgeschlagen zählt nicht gegen das Limit) – beide nur service_role (Route
--    POST /api/ernaehrung/foto in apps/web prüft vorher das Login-Token).
-- 5. `public.beta_admin(…)` für den Workflow beta-grant (nur service_role, Antworten ohne Personenbezug).
--
-- KEIN Storage-Bucket (A-G18, Gründer-Entscheidung 16.10.2026): Das Foto bleibt nur im Arbeitsspeicher der Anfrage
-- und wird nie gespeichert – damit entfallen der im Plan genannte tmp-Bucket `food-photos-tmp` und sein Aufräum-Job.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Einwilligungstext (sync: CURRENT_CONSENT_VERSIONS.ai_food_photo = 1, apps/mobile consent-texts.ts)
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'ai_food_photo',
  1,
  'Einwilligung: Gerichte per Foto auswerten',
  $txt$ENTWURF – juristisch prüfen

Mit „Per Foto“ kannst du ein Foto deiner Mahlzeit auswerten lassen. Die Auswertung schätzt, welche Lebensmittel zu sehen sind und wie viel davon. Weil ein Foto deines Essens Rückschlüsse auf deine Gesundheit und dein Essverhalten zulassen kann, brauchen wir dafür diese gesonderte Einwilligung.

Was gesendet wird: nur das Foto (verkleinert, ohne Standort und ohne andere Bilddaten) und deine kurze Info zum Gericht (höchstens 120 Zeichen). Nicht gesendet werden dein Name, deine E-Mail-Adresse, deine Nutzerkennung, Körperdaten, Ziele, dein Gesundheits-Check und Unverträglichkeiten.

An wen: an Google (Gemini-API) als unseren Auftragsverarbeiter, mit Verarbeitung in der EU, soweit verfügbar. Google darf die Daten nicht zum Training seiner KI verwenden.

Wie lange: Wir speichern das Foto nicht. Es wird nur für die Auswertung übertragen und danach sofort verworfen. Je Auswertung speichern wir nur Zeitpunkt, Ergebnis-Status, Menge der verarbeiteten Daten (Token) und Kosten – für dein monatliches Kontingent, ohne Inhalte.

Schätzung ohne Gewähr: Das Ergebnis ist ein Vorschlag. Du prüfst und änderst ihn, bevor etwas in dein Ernährungstagebuch kommt. Die Nährwerte rechnen wir selbst aus unserem Lebensmittel-Katalog.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Ohne diese Einwilligung kannst du dein Essen weiterhin per Hand eintragen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Danach werten wir keine Fotos mehr aus. Was du schon eingetragen hast, bleibt in deinem Ernährungstagebuch (dafür gilt die Einwilligung Gesundheitsdaten). Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.$txt$,
  now()
)
on conflict (consent_type, version) do nothing;

-- Gültige Einwilligung einer BESTIMMTEN Person (für Server-Funktionen ohne auth.uid(), z. B. service_role) – gleiche
-- Regel wie public.has_valid_consent: aktiv, aktuelle Version, Profil vorhanden.
create or replace function private.has_valid_consent_for(p_user_id uuid, p_type public.consent_type)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.consents c
    where c.user_id = p_user_id
      and c.consent_type = p_type
      and c.revoked_at is null
      and c.version = public.current_consent_version(p_type)
  )
  and exists (select 1 from public.profiles p where p.user_id = p_user_id);
$$;
revoke all on function private.has_valid_consent_for(uuid, public.consent_type) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Feature-Flags und Beta-Freischaltung (PLAN-PHASE-4B 4.4; nur service_role, RLS an ohne Policies)
-- ---------------------------------------------------------------------------------------------------------
create table private.feature_flags (
  -- Bekannte Flags (4b ergänzt `live_adjustment` per Migration).
  key text primary key check (key in ('ai_food_photo')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  -- GitHub-Name aus dem Workflow beta-grant (kein Freitext mit Personenbezug).
  updated_by text check (updated_by ~ '^[A-Za-z0-9-]{1,39}$')
);
comment on table private.feature_flags is
  'Feature-Flags (E3, später 4b). Nur service_role, geschaltet über den Workflow beta-grant. Kein Nutzerbezug.';
insert into private.feature_flags (key, enabled) values ('ai_food_photo', false)
on conflict (key) do nothing;

create table private.beta_entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entitlement text not null default 'premium' check (entitlement in ('premium')),
  granted_at timestamptz not null default now(),
  granted_by text not null check (granted_by ~ '^[A-Za-z0-9-]{1,39}$'),
  expires_at timestamptz not null,
  -- höchstens 180 Tage (PLAN-PHASE-4B 6.3)
  check (expires_at > granted_at and expires_at <= granted_at + interval '180 days')
);
comment on table private.beta_entitlements is
  'Beta-Freischaltung (Premium) bis Phase 7. Nur service_role. Brücke bis zur echten entitlements-Tabelle.';

create table private.admin_actions (
  id bigserial primary key,
  action text not null check (action in ('beta_grant', 'beta_revoke', 'flag_on', 'flag_off')),
  actor text not null check (actor ~ '^[A-Za-z0-9-]{1,39}$'),
  target_user_id uuid references auth.users (id) on delete set null,
  flag_key text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table private.admin_actions is
  'Protokoll der Workflow-Aktionen (beta-grant). Keine E-Mail, kein Freitext. Nur service_role.';

alter table private.feature_flags enable row level security;
alter table private.beta_entitlements enable row level security;
alter table private.admin_actions enable row level security;
revoke all on table private.feature_flags, private.beta_entitlements, private.admin_actions
  from public, anon, authenticated;
grant all on table private.feature_flags, private.beta_entitlements, private.admin_actions to service_role;
revoke all on sequence private.admin_actions_id_seq from public, anon, authenticated;
grant all on sequence private.admin_actions_id_seq to service_role;

-- EINE Stelle für „Premium“ (KONZEPT 15 hasEntitlement): bis Phase 7 = gültige Beta-Freischaltung. Phase 7 ersetzt
-- nur diesen Rumpf.
create or replace function private.has_entitlement_for(p_user_id uuid, p_entitlement text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from private.beta_entitlements b
    where b.user_id = p_user_id and b.entitlement = p_entitlement and b.expires_at > now()
  );
$$;
revoke all on function private.has_entitlement_for(uuid, text) from public, anon, authenticated;

create or replace function private.feature_enabled(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select f.enabled from private.feature_flags f where f.key = p_key), false);
$$;
revoke all on function private.feature_enabled(text) from public, anon, authenticated;

-- Für die App (Anzeige): hat die angemeldete Person Premium? Die Wahrheit prüft der Server bei jedem Aufruf erneut.
create or replace function public.has_entitlement(p_entitlement text default 'premium')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and private.has_entitlement_for(auth.uid(), p_entitlement);
$$;
revoke all on function public.has_entitlement(text) from public, anon;
grant execute on function public.has_entitlement(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 3. ai_usage – nur Metadaten (KONZEPT 15: Funktion, Tokens, Kosten, Zeitpunkt; keine Inhalte)
-- ---------------------------------------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- sync: AI_FOOD_PHOTO.feature (weitere KI-Funktionen kommen per Migration dazu)
  feature text not null check (feature in ('food_photo')),
  -- sync: AI_USAGE_STATUSES
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  -- Modellname (z. B. gemini-3.5-flash-lite, „attrappe“) – kein Freitext.
  model text check (model ~ '^[a-z0-9.-]{1,60}$'),
  input_tokens integer check (input_tokens between 0 and 1000000),
  output_tokens integer check (output_tokens between 0 and 1000000),
  cost_eur numeric(12, 6) check (cost_eur >= 0 and cost_eur < 100),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status = 'reserved') = (finished_at is null))
);
comment on table public.ai_usage is
  'Metadaten je KI-Aufruf (E3: Gericht per Foto). KEINE Inhalte (kein Foto, keine Info, keine Antwort). '
  'Lesen nur eigene Zeilen, schreiben nur der Server (ai_food_photo_reserve/finish).';
create index ai_usage_user_feature_created_idx on public.ai_usage (user_id, feature, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;
grant all on table public.ai_usage to service_role;

create policy "Nutzer sehen eigene KI-Nutzung"
  on public.ai_usage
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Zählung wie photoLimitState (packages/core): erfolgreiche + laufende Reservierungen (jünger als 5 Minuten) im
-- Kalendermonat bzw. -tag Europe/Berlin; alle Versuche des Tages für den Versuchs-Deckel.
create or replace function private.ai_food_photo_usage(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  -- sync: AI_FOOD_PHOTO.reservationStaleMinutes
  with rows as (
    select (u.created_at at time zone 'Europe/Berlin')::date as day,
           u.status = 'succeeded'
             or (u.status = 'reserved' and u.created_at > now() - interval '5 minutes') as counts
    from public.ai_usage u
    where u.user_id = p_user_id
      and u.feature = 'food_photo'
      and u.created_at >= (date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')
  )
  select jsonb_build_object(
    'month_used', count(*) filter (where counts),
    'day_used', count(*) filter (where counts and day = private.berlin_today()),
    'attempts_today', count(*) filter (where day = private.berlin_today()))
  from rows;
$$;
revoke all on function private.ai_food_photo_usage(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4a. Anzeige für die App: freigeschaltet? (ohne Zähler – die liest die App per RLS aus ai_usage)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.ai_food_photo_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not private.feature_enabled('ai_food_photo') then
    return jsonb_build_object('active', false, 'reason', 'flag_off');
  end if;
  if not private.has_entitlement_for(current_user_id, 'premium') then
    return jsonb_build_object('active', false, 'reason', 'no_entitlement');
  end if;
  return jsonb_build_object('active', true, 'reason', 'ok');
end;
$$;
revoke all on function public.ai_food_photo_access() from public, anon;
grant execute on function public.ai_food_photo_access() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4b. Reservieren (nur service_role) – VOR dem Aufruf des KI-Anbieters, atomar je Person.
-- Antwort:
--   {"result": "reserved", "id", "remaining_month", "remaining_today"}
--   {"result": "flag_off" | "no_entitlement" | "no_consent"}
--   {"result": "limit", "scope": "month" | "day", "available_from": "JJJJ-MM-TT"}
-- Sperr-Reihenfolge wie save_food_log_entries (Wächter N7 S2): Einwilligungen FOR SHARE → prüfen → Person
-- (Advisory-Sperre, keine zwei Reservierungen gleichzeitig) → zählen → schreiben. Ein gleichzeitiger Widerruf wartet
-- also, bis die Reservierung steht; läuft er zuerst, wird abgelehnt.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.ai_food_photo_reserve(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: AI_FOOD_PHOTO in packages/core/src/constants.ts (db-sync.test.ts)
  monthly_limit constant integer := 30;
  daily_limit constant integer := 8;
  daily_attempts_max constant integer := 16;
  -- Datensparsamkeit: eigene Zeilen älter als 400 Tage werden beim Reservieren gelöscht (Kostenübersicht 13 Monate).
  retention_days constant integer := 400;
  usage jsonb;
  month_used integer;
  day_used integer;
  attempts_today integer;
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
revoke all on function public.ai_food_photo_reserve(uuid) from public, anon, authenticated;
grant execute on function public.ai_food_photo_reserve(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 4c. Abschluss (nur service_role): nur eine eigene, noch laufende Reservierung. `succeeded` zählt gegen das Limit,
-- `failed` (keine verwertbare Antwort, Zeitlimit, Anbieter nicht erreichbar) nicht. Token/Kosten nur als Zahlen.
-- Antwort {"result": "ok"} bzw. {"result": "not_found"}.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.ai_food_photo_finish(
  p_id uuid,
  p_user_id uuid,
  p_status text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_eur numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('succeeded', 'failed') then
    raise exception 'Ungültiger Status.' using errcode = 'invalid_parameter_value';
  end if;
  update public.ai_usage u
  set status = p_status,
      model = p_model,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cost_eur = p_cost_eur,
      finished_at = now()
  where u.id = p_id and u.user_id = p_user_id and u.status = 'reserved';
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  return jsonb_build_object('result', 'ok');
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    -- Ohne Werte (keine Inhalte in Fehlern).
    raise exception 'Ungültige Werte.' using errcode = 'check_violation';
end;
$$;
revoke all on function public.ai_food_photo_finish(uuid, uuid, text, text, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.ai_food_photo_finish(uuid, uuid, text, text, integer, integer, numeric)
  to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. beta_admin – nur service_role, nur vom Workflow beta-grant (PLAN-PHASE-4B 4.6 Punkt 10 und 6.3)
-- p_action: grant | revoke | flag_on | flag_off | status. Antworten OHNE Personenbezug (keine E-Mail, keine user_id).
-- status: Flag an/aus, aktive Freischaltungen und die Kostenübersicht der Foto-KI (nur Summen, Plan 9).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.beta_admin(
  p_action text,
  p_actor text,
  p_email text default null,
  p_days integer default 90,
  p_flag text default 'ai_food_photo'
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
      if p_days is null or p_days not between 1 and 180 then
        return jsonb_build_object('result', 'invalid_input');
      end if;
      expires := now() + make_interval(days => p_days);
      insert into private.beta_entitlements (user_id, entitlement, granted_at, granted_by, expires_at)
      values (target, 'premium', now(), p_actor, expires)
      on conflict (user_id) do update
        set granted_at = excluded.granted_at, granted_by = excluded.granted_by, expires_at = excluded.expires_at;
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
revoke all on function public.beta_admin(text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.beta_admin(text, text, text, integer, text) to service_role;
