-- Alpha5 · Lead-Magnet „20 Rezepte gratis als PDF“ (ERWEITERUNGEN-2.md Abschnitt 8, Prompt G; docs/SETUP.md Teil I7).
--
-- Gründer-Entscheidung 11.10.2026: Download OHNE Newsletter-Pflicht. Der Newsletter ist ein eigenes, freiwilliges,
-- nicht vorausgewähltes Häkchen. Deshalb:
-- - waitlist.source: 'warteliste' (Formular „Sei beim Start dabei“) oder 'lead-magnet' (Gratis-Rezepte).
--   Eine Adresse kann in beiden Listen stehen (eigener Zweck, eigene Einwilligung, eigenes Double-Opt-in) →
--   eindeutig ist jetzt (email, source) statt email allein.
-- - waitlist.newsletter_opt_in: Newsletter (Infos zum Start, Rezepte, Trainingstipps) – NUR bei 'lead-magnet' und
--   nur mit Häkchen. Die Warteliste hat ihren eigenen, engeren Zweck (nur Infos zum Start) und hier immer false.
--   Newsletter-Versand nur an: source = 'lead-magnet' and newsletter_opt_in and confirmed_at is not null.
--   Start-Info an: Warteliste (confirmed_at is not null) und Newsletter-Abonnenten.
-- - Das Newsletter-Häkchen gilt nur, wenn die bestätigte Mail den Newsletter genannt hat: Jede neue Anfrage einer
--   unbestätigten Adresse ersetzt das Bestätigungs-Token (alter Link ungültig) – bestätigt werden kann nur über die
--   neueste Mail, und die nennt den Newsletter-Status ausdrücklich. Ist die Adresse schon bestätigt und kommt
--   jetzt das Häkchen dazu, gibt es ein eigenes Double-Opt-in nur für den Newsletter (newsletter_token_hash).
-- - Abmelde-Links: Jede Mail bekommt ein eigenes Abmelde-Token; ALLE bleiben gültig (Tabelle
--   waitlist_unsubscribe_tokens), damit auch der Link aus einer älteren Mail noch löscht.
-- - Lead-Magnet-Einträge ohne Newsletter werden 30 Tage nach der Bestätigung gelöscht (Zweck erfüllt;
--   die Frist dient nur dem Nachweis/erneuten Versand). TODO(Recht): Frist vor Livegang prüfen lassen.
-- - Zählung ohne personenbezogene Daten: waitlist_stats (pro Tag und Liste nur Anzahl Anmeldungen und Bestätigungen).
--
-- Zugriff wie bisher nur über service_role und die Datenbank-Funktionen. Keine Gesundheitsdaten.

-- ---------------------------------------------------------------------------------------------------------
-- Spalten
-- ---------------------------------------------------------------------------------------------------------
alter table public.waitlist
  add column source text not null default 'warteliste'
    check (source in ('warteliste', 'lead-magnet')),
  add column newsletter_opt_in boolean not null default false,
  add column newsletter_confirmed_at timestamptz,
  -- Version des Einwilligungstexts, unter dem der Newsletter bestellt wurde (eigene Spalte: die Version der
  -- Download-Einwilligung in consent_text_version bleibt unverändert, auch wenn der Newsletter später dazukommt).
  add column newsletter_consent_text_version integer check (newsletter_consent_text_version > 0),
  add column newsletter_token_hash text unique check (newsletter_token_hash ~ '^[0-9a-f]{64}$'),
  add column newsletter_token_expires_at timestamptz;
alter table public.waitlist
  add constraint waitlist_newsletter_only_lead check (source = 'lead-magnet' or not newsletter_opt_in),
  add constraint waitlist_newsletter_consent_version
    check (not newsletter_opt_in or newsletter_consent_text_version is not null);

alter table public.waitlist drop constraint waitlist_email_key;
alter table public.waitlist add constraint waitlist_email_source_key unique (email, source);

comment on column public.waitlist.source is
  'Herkunft: warteliste (Formular „Sei beim Start dabei“) oder lead-magnet (20 Rezepte gratis als PDF).';
comment on column public.waitlist.newsletter_opt_in is
  'Newsletter bestellt und per Double-Opt-in bestätigt (nur lead-magnet). Newsletter nur an lead-magnet + newsletter_opt_in + confirmed_at. Warteliste: immer false (eigener Zweck: Infos zum Start).';
comment on column public.waitlist.newsletter_token_hash is
  'Double-Opt-in NUR für den Newsletter, wenn eine schon bestätigte Adresse das Newsletter-Häkchen nachträglich setzt.';

-- ---------------------------------------------------------------------------------------------------------
-- Weitere Abmelde-Token (jede Mail hat ihr eigenes; alle bleiben gültig, bis der Eintrag gelöscht ist)
-- ---------------------------------------------------------------------------------------------------------
create table public.waitlist_unsubscribe_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  waitlist_id uuid not null references public.waitlist (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index waitlist_unsubscribe_tokens_entry on public.waitlist_unsubscribe_tokens (waitlist_id);

comment on table public.waitlist_unsubscribe_tokens is
  'Abmelde-Token weiterer Mails (nur HMAC-Hashes). Der erste steht in waitlist.unsubscribe_token_hash.';

alter table public.waitlist_unsubscribe_tokens enable row level security;
revoke all on table public.waitlist_unsubscribe_tokens from public, anon, authenticated;
grant all on table public.waitlist_unsubscribe_tokens to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Zählung (nur Zahlen, keine Adressen, keine Hashes)
-- ---------------------------------------------------------------------------------------------------------
create table public.waitlist_stats (
  day date not null default current_date,
  source text not null check (source in ('warteliste', 'lead-magnet')),
  signups integer not null default 0 check (signups >= 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  primary key (day, source)
);

comment on table public.waitlist_stats is
  'Anzahl Anmeldungen (Bestätigungs-Mail verschickt) und Bestätigungen pro Tag und Liste. Keine personenbezogenen Daten.';

alter table public.waitlist_stats enable row level security;
revoke all on table public.waitlist_stats from public, anon, authenticated;
grant all on table public.waitlist_stats to service_role;

create or replace function public.waitlist_count(p_source text, p_signups integer, p_confirmations integer)
returns void
language sql
set search_path = ''
as $$
  insert into public.waitlist_stats (day, source, signups, confirmations)
  values (current_date, p_source, p_signups, p_confirmations)
  on conflict (day, source) do update set
    signups = public.waitlist_stats.signups + excluded.signups,
    confirmations = public.waitlist_stats.confirmations + excluded.confirmations;
$$;

revoke all on function public.waitlist_count(text, integer, integer) from public, anon, authenticated;
grant execute on function public.waitlist_count(text, integer, integer) to service_role;

-- Abmelde-Token zu einem Eintrag hinzufügen (außer es ist schon das erste).
create or replace function public.waitlist_add_unsubscribe_token(p_waitlist_id uuid, p_token_hash text)
returns void
language sql
set search_path = ''
as $$
  insert into public.waitlist_unsubscribe_tokens (waitlist_id, token_hash)
  select p_waitlist_id, p_token_hash
  where not exists (
    select 1 from public.waitlist where id = p_waitlist_id and unsubscribe_token_hash = p_token_hash
  )
  on conflict (token_hash) do nothing;
$$;

revoke all on function public.waitlist_add_unsubscribe_token(uuid, text) from public, anon, authenticated;
grant execute on function public.waitlist_add_unsubscribe_token(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen: wie bisher + Lead-Magnet ohne Newsletter 30 Tage nach Bestätigung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_cleanup()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_attempts integer;
  v_entries integer;
  v_leads integer;
begin
  delete from public.waitlist_attempts where created_at < now() - interval '24 hours';
  get diagnostics v_attempts = row_count;
  delete from public.waitlist where confirmed_at is null and token_expires_at < now();
  get diagnostics v_entries = row_count;
  delete from public.waitlist
  where source = 'lead-magnet' and not newsletter_opt_in and confirmed_at < now() - interval '30 days';
  get diagnostics v_leads = row_count;
  -- Abgelaufene Newsletter-Bestätigungen verwerfen (Prüfwert und Version der nie bestätigten Bestellung).
  update public.waitlist set
    newsletter_token_hash = null,
    newsletter_token_expires_at = null,
    newsletter_consent_text_version = case when newsletter_opt_in then newsletter_consent_text_version end
  where newsletter_token_expires_at < now();
  return v_attempts + v_entries + v_leads;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Eintragen: jetzt mit Liste (p_source) und Newsletter-Häkchen (p_newsletter_opt_in, nur lead-magnet).
-- Beide Parameter haben Standardwerte (Warteliste) – so funktioniert ein Aufruf mit den alten 7 Parametern
-- weiter (z. B. alte Website-Version in den Minuten zwischen Migration und Deployment).
-- Ergebnis:
--   'send'                        Bestätigungs-Mail schicken (nennt den Newsletter-Status ausdrücklich)
--   'confirmed'                   Warteliste schon bestätigt – keine Mail
--   'rate_limited'                zu viele Versuche
--   'resend_download'             Gratis-Rezepte schon bestätigt (ohne Newsletter) → Download-Link erneut
--   'resend_download_newsletter'  wie oben, Newsletter ist bereits bestätigt
--   'newsletter_confirm'          Gratis-Rezepte schon bestätigt, Newsletter-Häkchen NEU → eigenes Double-Opt-in
--                                 nur für den Newsletter (Mail mit Bestätigungs-Link + Download-Link)
-- Abmelde-Token: Jede Mail bekommt ein neues, die alten bleiben gültig (waitlist_unsubscribe_tokens).
-- ---------------------------------------------------------------------------------------------------------
drop function public.waitlist_signup(text, integer, text, text, text, text, timestamptz);

create function public.waitlist_signup(
  p_email text,
  p_consent_text_version integer,
  p_ip_hash text,
  p_email_hash text,
  p_token_hash text,
  p_unsubscribe_token_hash text,
  p_token_expires_at timestamptz,
  p_source text default 'warteliste',
  p_newsletter_opt_in boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ip_count integer;
  v_email_count integer;
  v_row public.waitlist;
  v_id uuid;
begin
  if p_source is null or p_source not in ('warteliste', 'lead-magnet') then
    raise exception 'Unbekannte Liste' using errcode = '22023';
  end if;
  if p_newsletter_opt_in is null or (p_source = 'warteliste' and p_newsletter_opt_in) then
    raise exception 'Newsletter nur bei den Gratis-Rezepten' using errcode = '22023';
  end if;

  perform public.waitlist_cleanup();

  insert into public.waitlist_attempts (key_hash)
  values ('ip:' || p_ip_hash), ('email:' || p_email_hash);

  select count(*) into v_ip_count from public.waitlist_attempts
  where key_hash = 'ip:' || p_ip_hash and created_at > now() - interval '1 hour';
  select count(*) into v_email_count from public.waitlist_attempts
  where key_hash = 'email:' || p_email_hash and created_at > now() - interval '24 hours';
  if v_ip_count > 10 or v_email_count > 3 then
    return 'rate_limited';
  end if;

  -- Neuer Eintrag? Erst einfügen (bei gleichzeitiger Erstanfrage derselben Adresse gewinnt eine, die andere
  -- fügt nichts ein und behandelt die Zeile danach wie „schon vorhanden“ – kein Fehler 23505).
  insert into public.waitlist (
    email, source, newsletter_opt_in, newsletter_consent_text_version, consent_text_version, token_hash,
    token_expires_at, unsubscribe_token_hash
  ) values (
    p_email, p_source, p_newsletter_opt_in,
    case when p_newsletter_opt_in then p_consent_text_version end,
    p_consent_text_version, p_token_hash, p_token_expires_at, p_unsubscribe_token_hash
  )
  on conflict (email, source) do nothing
  returning id into v_id;
  if v_id is not null then
    perform public.waitlist_count(p_source, 1, 0);
    return 'send';
  end if;

  -- Schon vorhanden: Zeile sperren (Folgeanfragen derselben Adresse laufen nacheinander).
  select * into v_row from public.waitlist
  where email = p_email and source = p_source for update;

  if v_row.confirmed_at is not null then
    if p_source = 'warteliste' then
      return 'confirmed';
    end if;
    perform public.waitlist_add_unsubscribe_token(v_row.id, p_unsubscribe_token_hash);
    if p_newsletter_opt_in and not v_row.newsletter_opt_in then
      update public.waitlist set
        newsletter_token_hash = p_token_hash,
        newsletter_token_expires_at = p_token_expires_at,
        newsletter_consent_text_version = p_consent_text_version
      where id = v_row.id;
      return 'newsletter_confirm';
    end if;
    return case when v_row.newsletter_opt_in then 'resend_download_newsletter' else 'resend_download' end;
  end if;

  -- Noch nicht bestätigt: neues Token (alter Bestätigungs-Link wird ungültig), Newsletter-Häkchen dieser Anfrage.
  -- Bestätigt werden kann so nur über die neueste Mail – und die nennt den Newsletter-Status.
  update public.waitlist set
    newsletter_opt_in = p_newsletter_opt_in,
    newsletter_consent_text_version = case when p_newsletter_opt_in then p_consent_text_version end,
    consent_text_version = p_consent_text_version,
    consent_given_at = now(),
    token_hash = p_token_hash,
    token_expires_at = p_token_expires_at
  where id = v_row.id;
  perform public.waitlist_add_unsubscribe_token(v_row.id, p_unsubscribe_token_hash);

  perform public.waitlist_count(p_source, 1, 0);
  return 'send';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Bestätigen der Warteliste: nur noch Einträge der Warteliste (Gratis-Rezepte → lead_magnet_confirm).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_confirm(p_token_hash text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_row public.waitlist;
  v_result text;
begin
  select * into v_row from public.waitlist
  where token_hash = p_token_hash and source = 'warteliste' for update;
  if not found then
    v_result := 'invalid';
  elsif v_row.confirmed_at is not null then
    v_result := 'confirmed';
  elsif v_row.token_expires_at is null or v_row.token_expires_at < now() then
    v_result := 'expired';
  else
    update public.waitlist set confirmed_at = now() where id = v_row.id;
    perform public.waitlist_count('warteliste', 0, 1);
    v_result := 'confirmed';
  end if;
  perform public.waitlist_cleanup();
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Bestätigen der Gratis-Rezepte (Bestätigungs-Link der 1. Mail ODER Newsletter-Bestätigung).
-- Ergebnis (jsonb): { result, email, newsletter_opt_in }
--   result 'confirmed'  Adresse bestätigt. email NUR beim ersten Bestätigen (→ genau eine Download-Mail; dafür
--                       wird p_unsubscribe_token_hash als weiteres Abmelde-Token gespeichert), sonst null.
--   result 'newsletter' Newsletter nachträglich per eigenem Double-Opt-in bestätigt (email null, keine Mail).
--   result 'expired' | 'invalid'
-- newsletter_opt_in: Stand nach der Bestätigung (für den Text auf der Seite), null bei expired/invalid.
-- ---------------------------------------------------------------------------------------------------------
create function public.lead_magnet_confirm(p_token_hash text, p_unsubscribe_token_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_row public.waitlist;
  v_result text;
  v_email text;
  v_newsletter boolean;
begin
  select * into v_row from public.waitlist
  where source = 'lead-magnet' and (token_hash = p_token_hash or newsletter_token_hash = p_token_hash)
  for update;
  if not found then
    v_result := 'invalid';
  elsif v_row.newsletter_token_hash = p_token_hash then
    if v_row.newsletter_token_expires_at is null or v_row.newsletter_token_expires_at < now() then
      v_result := 'expired';
    else
      update public.waitlist set
        newsletter_opt_in = true,
        newsletter_confirmed_at = now(),
        newsletter_token_hash = null,
        newsletter_token_expires_at = null
      where id = v_row.id;
      v_result := 'newsletter';
      v_newsletter := true;
    end if;
  elsif v_row.confirmed_at is not null then
    v_result := 'confirmed';
    v_newsletter := v_row.newsletter_opt_in;
  elsif v_row.token_expires_at is null or v_row.token_expires_at < now() then
    v_result := 'expired';
  else
    update public.waitlist set
      confirmed_at = now(),
      newsletter_confirmed_at = case when v_row.newsletter_opt_in then now() end
    where id = v_row.id;
    perform public.waitlist_add_unsubscribe_token(v_row.id, p_unsubscribe_token_hash);
    perform public.waitlist_count('lead-magnet', 0, 1);
    v_result := 'confirmed';
    v_email := v_row.email;
    v_newsletter := v_row.newsletter_opt_in;
  end if;
  perform public.waitlist_cleanup();
  return jsonb_build_object('result', v_result, 'email', v_email, 'newsletter_opt_in', v_newsletter);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Abmelden: löscht den Eintrag, zu dem das Token gehört (erstes Token ODER Token einer späteren Mail).
-- Gelöscht wird nur dieser Eintrag (eine Liste); steht die Adresse auch in der anderen Liste, hat diese ihren
-- eigenen Abmelde-Link. Ergebnis: true = gelöscht, false = nichts (mehr) gefunden.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_unsubscribe(p_unsubscribe_token_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_deleted boolean;
begin
  delete from public.waitlist
  where unsubscribe_token_hash = p_unsubscribe_token_hash
     or id = (select waitlist_id from public.waitlist_unsubscribe_tokens
              where token_hash = p_unsubscribe_token_hash);
  v_deleted := found;
  perform public.waitlist_cleanup();
  return v_deleted;
end;
$$;

revoke all on function public.waitlist_signup(text, integer, text, text, text, text, timestamptz, text, boolean)
  from public, anon, authenticated;
grant execute on function public.waitlist_signup(text, integer, text, text, text, text, timestamptz, text, boolean)
  to service_role;
revoke all on function public.waitlist_confirm(text) from public, anon, authenticated;
grant execute on function public.waitlist_confirm(text) to service_role;
revoke all on function public.lead_magnet_confirm(text, text) from public, anon, authenticated;
grant execute on function public.lead_magnet_confirm(text, text) to service_role;
revoke all on function public.waitlist_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.waitlist_unsubscribe(text) to service_role;
revoke all on function public.waitlist_cleanup() from public, anon, authenticated;
grant execute on function public.waitlist_cleanup() to service_role;
