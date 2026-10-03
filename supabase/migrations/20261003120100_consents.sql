-- Phase 1 · Einwilligungen (DSGVO Art. 7 und Art. 9): Texte (consent_documents) und Nachweise (consents).
--
-- consent_documents: Katalog der Einwilligungstexte je Art und Version. Lesbar für alle (auch ohne Login,
--   damit die Texte vor der Registrierung angezeigt werden können), änderbar nur über service_role (Admin).
-- consents: Nachweis „wer, welche Art, welche Version, wann, auf welchem Gerät“. Nur Einfügen und Widerruf –
--   nie überschreiben, nie durch Nutzer löschen (Löschung nur mit dem Konto, siehe delete_my_account).

-- ---------------------------------------------------------------------------------------------------------
-- consent_documents
-- ---------------------------------------------------------------------------------------------------------
create table public.consent_documents (
  consent_type public.consent_type not null,
  version integer not null check (version >= 1),
  title_de text not null check (char_length(title_de) between 1 and 200),
  body_de text not null check (char_length(body_de) >= 1),
  -- NULL = noch nicht veröffentlicht (Entwurf). Gültig ist die höchste veröffentlichte Version.
  published_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (consent_type, version)
);

comment on table public.consent_documents is
  'Einwilligungstexte je Art und Version. Aktuelle Version = höchste veröffentlichte Version.';

alter table public.consent_documents enable row level security;

revoke all on table public.consent_documents from anon, authenticated;
grant select on table public.consent_documents to anon, authenticated;
grant all on table public.consent_documents to service_role;

create policy "Veröffentlichte Einwilligungstexte sind für alle lesbar"
  on public.consent_documents
  for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

-- Aktuell gültige Version einer Einwilligungsart (NULL, wenn noch kein Text veröffentlicht ist).
-- Spiegelung im Code: CURRENT_CONSENT_VERSIONS in packages/core/src/consent.ts.
create or replace function public.current_consent_version(p_type public.consent_type)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(d.version)
  from public.consent_documents d
  where d.consent_type = p_type
    and d.published_at is not null
    and d.published_at <= now();
$$;

revoke all on function public.current_consent_version(public.consent_type) from public, anon, authenticated;
grant execute on function public.current_consent_version(public.consent_type)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- consents
-- ---------------------------------------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  version integer not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  platform public.consent_platform not null,
  foreign key (consent_type, version) references public.consent_documents (consent_type, version),
  check (revoked_at is null or revoked_at >= granted_at)
);

comment on table public.consents is
  'Einwilligungs-Nachweise. Nur Einfügen und Widerruf (revoked_at), keine sonstigen Änderungen.';

create index consents_user_type_idx on public.consents (user_id, consent_type);
-- Höchstens eine aktive Einwilligung je Nutzer, Art und Version (doppeltes Senden bei Offline-Sync abfangen).
create unique index consents_one_active_per_version_idx
  on public.consents (user_id, consent_type, version)
  where revoked_at is null;

alter table public.consents enable row level security;

revoke all on table public.consents from anon, authenticated;
grant select, insert on table public.consents to authenticated;
-- Nutzer dürfen ausschließlich die Spalte revoked_at ändern (Widerruf).
grant update (revoked_at) on table public.consents to authenticated;
grant all on table public.consents to service_role;

create policy "Nutzer sehen eigene Einwilligungen"
  on public.consents
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer erteilen eigene Einwilligungen in der aktuellen Version"
  on public.consents
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and revoked_at is null
    and version = public.current_consent_version(consent_type)
    -- Voraussetzung für jede Einwilligung: ein Profil mit geprüftem Geburtsdatum (Mindestalter 16).
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );

create policy "Nutzer widerrufen eigene, noch aktive Einwilligungen"
  on public.consents
  for update
  to authenticated
  using (user_id = (select auth.uid()) and revoked_at is null)
  with check (user_id = (select auth.uid()));

-- Kein DELETE-Recht und keine DELETE-Policy für Nutzer.

-- Einfügen: Zeitpunkt setzt immer die Datenbank (kein Rückdatieren), ein Widerruf beim Einfügen ist unzulässig.
create or replace function private.consents_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.revoked_at is not null then
    raise exception 'Eine Einwilligung kann nicht bereits widerrufen eingefügt werden.'
      using errcode = 'check_violation';
  end if;
  new.granted_at := now();
  return new;
end;
$$;

create trigger consents_before_insert
  before insert on public.consents
  for each row execute function private.consents_before_insert();

-- Ändern: nur revoked_at von NULL auf einen Zeitpunkt (= jetzt). Alles andere ist unveränderlich –
-- auch für service_role, damit der Nachweis nicht nachträglich verfälscht werden kann.
create or replace function private.consents_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    raise exception 'Ein Widerruf kann nicht geändert oder zurückgenommen werden.'
      using errcode = 'check_violation';
  end if;
  if new.revoked_at is null then
    raise exception 'Einwilligungen können nur widerrufen, nicht geändert werden.'
      using errcode = 'check_violation';
  end if;
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.consent_type is distinct from old.consent_type
    or new.version is distinct from old.version
    or new.granted_at is distinct from old.granted_at
    or new.platform is distinct from old.platform then
    raise exception 'Einwilligungen können nur widerrufen, nicht geändert werden.'
      using errcode = 'check_violation';
  end if;
  new.revoked_at := now();
  return new;
end;
$$;

create trigger consents_before_update
  before update on public.consents
  for each row execute function private.consents_before_update();

-- Gültige Einwilligung des aufrufenden Nutzers: erteilt, nicht widerrufen und in der AKTUELLEN Version.
-- Zusätzlich (doppelte Absicherung) muss ein Profil mit geprüftem Geburtsdatum existieren.
-- Wird in den RLS-Policies der Tabellen mit Gesundheitsdaten verwendet.
create or replace function public.has_valid_consent(p_type public.consent_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consents c
    where c.user_id = auth.uid()
      and c.consent_type = p_type
      and c.revoked_at is null
      and c.version = public.current_consent_version(p_type)
  )
  and exists (select 1 from public.profiles p where p.user_id = auth.uid());
$$;

revoke all on function public.has_valid_consent(public.consent_type) from public, anon, authenticated;
grant execute on function public.has_valid_consent(public.consent_type) to authenticated, service_role;
