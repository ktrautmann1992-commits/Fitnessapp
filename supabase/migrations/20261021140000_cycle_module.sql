-- Phase 9 · Zyklus-Modul, Etappe ZY2 – Grundlagen (docs/PLAN-PHASE-9.md Abschnitte 6, 7 und 8; Gründer-Freigabe
-- 21.10.2026, alle Fragen ZY-G1–G17 wie empfohlen). Nur additiv.
--
-- Inhalt:
-- 1. Erweiterungen pgcrypto (Schema extensions) und Supabase Vault prüfen – sonst Abbruch mit klarer Meldung.
-- 2. Schlüssel `cycle_data_key_v1` (32 Zufallsbytes) im Vault – IDEMPOTENT: nur anlegen, wenn er fehlt (sonst wären
--    alle Daten unlesbar). Der Schlüssel steht nie in Git, nie in GitHub Secrets, nie im Chat.
-- 3. Tabellen im Schema `private` (von der REST-Schnittstelle nicht ausgeliefert): cycle_settings, cycle_entries
--    (Inhalt nur verschlüsselt, Klartext nur wer/Datum/geändert), cycle_write_counts (Ratenbegrenzung). RLS an, keine
--    Policies, keine Rechte für public/anon/authenticated/service_role (S4) – Zugriff nur über die Server-Funktionen
--    in 20261021140100_cycle_rpcs.sql.
-- 4. Freischaltung bis zur Rechtsprüfung (N3): eigene Konfiguration `private.cycle_module_config` (Flag
--    `cycle_module` Standard AUS, Flag `cycle_warnings` Standard AN, Öffnung für alle AUS) und
--    `private.cycle_module_grants` (Freischaltung je Konto per Workflow beta-grant). Bewusst eigene Tabellen statt der
--    CHECK-Liste von private.feature_flags, damit parallele Migrationen die Liste nicht gegenseitig überschreiben.
-- 5. Einwilligungstext `cycle_data` Version 1 (ENTWURF – vor dem öffentlichen Livegang juristisch prüfen, K2).
-- 6. Erteilen von `cycle_data` nur mit Freischaltung (eigener Trigger, Code cycle_module_closed).
-- 7. Widerruf `cycle_data` löscht alle Zyklusdaten (eigener Trigger zusätzlich zu private.consents_after_revoke –
--    dessen Platzhalter bleibt unberührt, damit parallele Fassungen dieser Funktion nichts überschreiben).
-- 8. CHECK cycle_module_interest: erlaubt bei allen außer „männlich“ (ZY-G4).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Erweiterungen
-- ---------------------------------------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

do $check$
begin
  if to_regprocedure('extensions.pgp_sym_encrypt(text, text, text)') is null then
    raise exception 'Zyklus-Modul: Erweiterung pgcrypto fehlt im Schema extensions (Supabase → Database → Extensions → pgcrypto einschalten, docs/PLAN-PHASE-9.md 18).';
  end if;
  if to_regclass('vault.decrypted_secrets') is null
     or to_regprocedure('vault.create_secret(text, text, text, uuid)') is null then
    raise exception 'Zyklus-Modul: Supabase Vault fehlt (Supabase → Database → Extensions → supabase_vault einschalten, docs/PLAN-PHASE-9.md 18).';
  end if;
end;
$check$;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Schlüssel im Vault (idempotent; pgTAP 72 prüft: zweimal ausgeführt → unverändert)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.ensure_cycle_key(p_version smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_name constant text := 'cycle_data_key_v' || p_version::text;
begin
  if p_version is null or p_version < 1 then
    raise exception 'Ungültige Schlüssel-Version.';
  end if;
  if exists (select 1 from vault.decrypted_secrets s where s.name = key_name) then
    return;
  end if;
  perform vault.create_secret(
    encode(extensions.gen_random_bytes(32), 'hex'),
    key_name,
    'Zyklus-Modul: Schlüssel für private.cycle_* (nie ausgeben, nie löschen ohne Rotation)'
  );
end;
$$;
revoke all on function private.ensure_cycle_key(smallint) from public, anon, authenticated, service_role;

select private.ensure_cycle_key(1::smallint);

-- ---------------------------------------------------------------------------------------------------------
-- 3. Tabellen (nur verschlüsselter Inhalt)
-- ---------------------------------------------------------------------------------------------------------
create table private.cycle_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Status, letzte Periode beim Einschalten, Pause, Schlaf an/aus, Erinnerung, Hinweis-Zustände (S6) – verschlüsselt.
  payload_enc bytea not null,
  key_version smallint not null default 1 check (key_version >= 1),
  updated_at timestamptz not null default now()
);
comment on table private.cycle_settings is
  'Zyklus-Modul: Einstellungen je Person, nur verschlüsselt (pgcrypto, Schlüssel im Vault). Zugriff nur über '
  'save_/get_cycle_settings. Gelöscht bei Widerruf cycle_data und mit dem Konto.';

create table private.cycle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  -- Blutung, Energie, Beschwerden, Schlaf – verschlüsselt. Klartext ist nur: wer, welches Datum, wann geändert.
  payload_enc bytea not null,
  key_version smallint not null default 1 check (key_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
comment on table private.cycle_entries is
  'Zyklus-Modul: Tages-Checks, nur verschlüsselt. Zugriff nur über save_/get_/delete_cycle_entry(s). Gelöscht bei '
  'Widerruf cycle_data, mit dem Konto und nach 24 Monaten (ZY-G8).';

create table private.cycle_write_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  writes integer not null default 0 check (writes >= 0),
  primary key (user_id, day)
);
comment on table private.cycle_write_counts is
  'Ratenbegrenzung der Zyklus-Schreibvorgänge je Konto und Tag (nur Zähler, kein Inhalt).';

alter table private.cycle_settings enable row level security;
alter table private.cycle_entries enable row level security;
alter table private.cycle_write_counts enable row level security;
revoke all on table private.cycle_settings, private.cycle_entries, private.cycle_write_counts
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Freischaltung bis zur Rechtsprüfung (N3, 7.2a)
-- ---------------------------------------------------------------------------------------------------------
create table private.cycle_module_config (
  id boolean primary key default true check (id),
  -- Flag `cycle_module`: Modul im Supabase-Modus überhaupt verfügbar (Standard AUS).
  enabled boolean not null default false,
  -- Öffnung für alle – erst nach der Rechtsprüfung, nur per eigener Migration (nicht über den Workflow).
  open_for_all boolean not null default false,
  -- Flag `cycle_warnings`: persönliche Warnsignale an (Standard AN); aus → statischer Ratgeber (S1, ZY-G17).
  warnings_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text check (updated_by ~ '^[A-Za-z0-9-]{1,39}$')
);
comment on table private.cycle_module_config is
  'Zyklus-Modul: Flags cycle_module (aus), cycle_warnings (an), Öffnung für alle (aus). Nur Workflow beta-grant.';
insert into private.cycle_module_config (id) values (true) on conflict (id) do nothing;

create table private.cycle_module_grants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by text not null check (granted_by ~ '^[A-Za-z0-9-]{1,39}$'),
  expires_at timestamptz not null,
  check (expires_at > granted_at and expires_at <= granted_at + interval '180 days')
);
comment on table private.cycle_module_grants is
  'Zyklus-Modul: Freischaltung je Konto bis zur Rechtsprüfung (N3). Nur Workflow beta-grant.';

alter table private.cycle_module_config enable row level security;
alter table private.cycle_module_grants enable row level security;
revoke all on table private.cycle_module_config, private.cycle_module_grants
  from public, anon, authenticated;
grant all on table private.cycle_module_config, private.cycle_module_grants to service_role;

-- Darf diese Person schreiben bzw. die Einwilligung erteilen? Flag an UND (Öffnung für alle ODER Freischaltung).
create or replace function private.cycle_module_open_for(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.enabled from private.cycle_module_config c where c.id), false)
    and (
      coalesce((select c.open_for_all from private.cycle_module_config c where c.id), false)
      or exists (
        select 1 from private.cycle_module_grants g where g.user_id = p_user_id and g.expires_at > now()
      )
    );
$$;
revoke all on function private.cycle_module_open_for(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Einwilligungstext cycle_data v1 (sync: CURRENT_CONSENT_VERSIONS.cycle_data = 1, apps/mobile consent-texts.ts)
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'cycle_data',
  1,
  'Einwilligung: Zyklusdaten',
  $txt$ENTWURF – juristisch prüfen (Fassung für die Testphase, Prüfung vor dem öffentlichen Livegang)

Mit dem Zyklus-Modul kannst du täglich eintragen, wie es dir geht. Weil diese Angaben besonders sensible Gesundheitsdaten sind, brauchen wir dafür diese gesonderte Einwilligung – getrennt von der Einwilligung „Gesundheitsdaten“.

Was wir speichern: deine Tages-Checks (Blutung, Energie, Beschwerden, optional Schlaf), deinen Status (z. B. natürlicher Zyklus, hormonelle Verhütung, Wechseljahre, Stillzeit, Schwangerschaft), den Zeitpunkt deiner letzten Periode beim Einschalten und deine Einstellungen im Modul. Kein Freitext, keine Art oder Marke einer Verhütung.

Wozu: um dir an Tagen mit wenig Energie oder starken Beschwerden ein leichteres Training anzubieten, dir Hinweise zur Ernährung zu geben und dir allgemeine Hinweise zu geben, wann eine ärztliche Abklärung sinnvoll sein kann. Keine Vorhersage, keine fruchtbaren Tage, keine Diagnose.

Das Zyklus-Modul ist kein Medizinprodukt. Es ist nicht zur Verhütung oder Familienplanung geeignet und ersetzt keine ärztliche Untersuchung.

Wie: Die Daten liegen in der EU (Frankfurt am Main) bei unserem Dienstleister Supabase und sind dort zusätzlich verschlüsselt. Auf deinem Handy liegen sie verschlüsselt, im Browser nur bis zum Schließen des Tabs. Sie gehen nie in den Partner-Modus, nie in das PDF, nie an KI-Dienste, Werbung, Analyse-Dienste oder Shops. Einträge älter als 24 Monate löschen wir automatisch.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App ohne das Zyklus-Modul uneingeschränkt nutzen.

Widerruf: jederzeit unter Mehr → Zyklus → „Modul beenden“. Der Widerruf löscht sofort alle Zyklusdaten auf dem Server und auf diesem Gerät; andere Geräte löschen ihre Kopie beim nächsten Öffnen der App. Aus Sicherungskopien unseres Dienstleisters verschwinden sie nach spätestens 7 Tagen. Es bleibt: Trainings, die du als „leichter“ trainiert hast, bleiben im Tagebuch mit dieser Markierung und den verminderten Vorgaben – ohne Grund, denn den Knopf „Heute leichter“ gibt es für alle, auch ohne Zyklus-Modul. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.$txt$,
  now()
)
on conflict (consent_type, version) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Erteilen nur mit Freischaltung (N3) – Code cycle_module_closed, ohne Personenbezug
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.cycle_consent_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'cycle_data' and not private.cycle_module_open_for(new.user_id) then
    raise exception 'cycle_module_closed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.cycle_consent_guard() from public, anon, authenticated, service_role;

create trigger consents_cycle_guard
  before insert on public.consents
  for each row
  when (new.consent_type = 'cycle_data')
  execute function private.cycle_consent_guard();

-- ---------------------------------------------------------------------------------------------------------
-- 7. Widerruf cycle_data → alle Zyklusdaten löschen (7.5). save_cycle_* sperren die Einwilligung FOR SHARE: Der
--    Widerruf wartet auf laufende Speichervorgänge und löscht danach alles (pgTAP 72, gleichzeitiger Widerruf).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.cycle_entries where user_id = new.user_id;
  delete from private.cycle_settings where user_id = new.user_id;
  delete from private.cycle_write_counts where user_id = new.user_id;
  return null;
end;
$$;
revoke all on function private.consents_after_revoke_cycle() from public, anon, authenticated, service_role;

create trigger consents_after_revoke_cycle
  after update of revoked_at on public.consents
  for each row
  when (old.revoked_at is null and new.revoked_at is not null and new.consent_type = 'cycle_data')
  execute function private.consents_after_revoke_cycle();

-- ---------------------------------------------------------------------------------------------------------
-- 8. Interesse am Modul bei allen außer „männlich“, weiter nicht ohne Geschlecht (ZY-G4; sync: sexStepSchema in
--    packages/core/src/validation.ts)
-- ---------------------------------------------------------------------------------------------------------
do $constraint$
declare
  old_name text;
begin
  select c.conname into old_name
  from pg_constraint c
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%cycle_module_interest%';
  if old_name is not null then
    execute format('alter table public.profiles drop constraint %I', old_name);
  end if;
end;
$constraint$;
alter table public.profiles
  add constraint profiles_cycle_module_interest_check
  check (cycle_module_interest is null or coalesce(sex <> 'male', false));
