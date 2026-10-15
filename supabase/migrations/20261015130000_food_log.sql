-- Etappe E1 · Ernährungstagebuch (docs/PLAN-AUSWERTUNG.md Abschnitt 5, 2.7; Entscheidungen A-G2, A-G9, A-G12, A-G14).
--
-- food_log_entries: was die Person als gegessen einträgt. Vorsorglich Gesundheitsdatum (Art. 9 DSGVO, A-G12): nur mit
-- gültiger Einwilligung health_data (prüft save_food_log_entries), beim Widerruf gelöscht (consents_after_revoke,
-- nächste Migration), im Export, beim Konto-Löschen per Kaskade weg. Nie in Logs oder Analytics.
-- food_log_favorites: Stern je Lebensmittel/Rezept/Schnelleintrag – KEIN Gesundheitsdatum (A-G14), bleibt beim
-- Widerruf, direkt per PostgREST (eigene Zeilen, wie exercise_start_weights), im Export, Kaskade.
--
-- Schnappschuss statt Verweis (Plan 5): Titel, Menge, Einheit, Portion und Nährwerte stehen im Eintrag; food_id bzw.
-- recipe_id nur zur Zuordnung („Zuletzt“, Favoriten). Kein Freitext: Schnelleinträge haben eine Bezeichnung aus fester
-- Liste (2.7). Ziele und Zonen werden NIE gespeichert (2.7, wie Phase 5 7.1).
-- Grenzen = FOOD_LOG_LIMITS, Listen = FOOD_LOG_SOURCES/FOOD_LOG_SLOTS/FOOD_LOG_UNITS/QUICK_ENTRY_LABELS in
-- packages/core (db-sync.test.ts).

-- ---------------------------------------------------------------------------------------------------------
-- food_log_entries
-- ---------------------------------------------------------------------------------------------------------
create table public.food_log_entries (
  -- id erzeugt das Gerät (offline); ist sie schon vergeben, vergibt save_food_log_entries eine neue.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_on date not null,
  -- Plätze = MEAL_PLAN_SLOT_KEYS + other (FOOD_LOG_SLOTS)
  slot text not null check (
    slot in (
      'main',
      'breakfast',
      'snack_morning',
      'lunch',
      'snack_afternoon',
      'snack_pre_dinner',
      'dinner',
      'snack_late',
      'snack_night',
      'extra_1',
      'extra_2',
      'other'
    )
  ),
  -- FOOD_LOG_SOURCES (später custom_meal, photo, product)
  source text not null check (source in ('plan_item', 'food', 'recipe', 'quick')),
  food_id text references public.foods (id) on update cascade on delete restrict,
  recipe_id text references public.recipes (id) on update cascade on delete restrict,
  -- sync: FOOD_LOG_LIMITS.titleMaxChars
  title_de text not null check (char_length(title_de) between 1 and 100),
  -- sync: FOOD_LOG_LIMITS.amountMass / amountPiece (Einheit FOOD_LOG_UNITS)
  amount numeric check (amount > 0),
  unit text check (unit in ('g', 'ml', 'piece')),
  -- sync: FOOD_LOG_LIMITS.portion (Viertel-Schritte)
  portion numeric check (portion between 0.25 and 3 and portion * 4 = trunc(portion * 4)),
  -- sync: FOOD_LOG_LIMITS.kcal (ganze kcal) und macroG (eine Nachkommastelle)
  kcal integer check (kcal between 0 and 3000),
  protein_g numeric check (protein_g between 0 and 750 and protein_g * 10 = trunc(protein_g * 10)),
  carbs_g numeric check (carbs_g between 0 and 750 and carbs_g * 10 = trunc(carbs_g * 10)),
  fat_g numeric check (fat_g between 0 and 750 and fat_g * 10 = trunc(fat_g * 10)),
  revision integer not null default 1 check (revision >= 1),
  last_write_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Menge je Einheit: g/ml 1–2.000 (eine Nachkommastelle), Stück 0,5–20 in ½-Schritten.
  check (
    unit is null
    or (unit in ('g', 'ml') and amount between 1 and 2000 and amount * 10 = trunc(amount * 10))
    or (unit = 'piece' and amount between 0.5 and 20 and amount * 2 = trunc(amount * 2))
  ),
  -- Form je Herkunft (wie foodLogEntrySchema).
  check (
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
  ),
  check (source <> 'plan_item' or slot <> 'other')
);

comment on table public.food_log_entries is
  'Ernährungstagebuch (E1). SENSIBEL (Art. 9, vorsorglich): nur mit Einwilligung health_data, beim Widerruf gelöscht, '
  'nie loggen. Schreiben nur über save_food_log_entries/delete_food_log_entry.';

-- „Gegessen“ je Plan-Mahlzeit höchstens einmal je Tag und Platz (doppelt tippen = idempotent).
create unique index food_log_entries_plan_item_idx
  on public.food_log_entries (user_id, eaten_on, slot)
  where source = 'plan_item';
create index food_log_entries_user_eaten_idx on public.food_log_entries (user_id, eaten_on desc);
create index food_log_entries_food_id_idx on public.food_log_entries (food_id);
create index food_log_entries_recipe_id_idx on public.food_log_entries (recipe_id);

create trigger food_log_entries_set_updated_at
  before update on public.food_log_entries
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- food_log_favorites: Vorlage ohne Datum und Platz; Schlüssel wie foodLogKey (packages/core).
-- ---------------------------------------------------------------------------------------------------------
create table public.food_log_favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fav_key text not null check (char_length(fav_key) between 1 and 200),
  source text not null check (source in ('food', 'recipe', 'quick')),
  food_id text references public.foods (id) on update cascade on delete cascade,
  recipe_id text references public.recipes (id) on update cascade on delete cascade,
  title_de text not null check (char_length(title_de) between 1 and 100),
  amount numeric check (amount > 0),
  unit text check (unit in ('g', 'ml', 'piece')),
  portion numeric check (portion between 0.25 and 3 and portion * 4 = trunc(portion * 4)),
  kcal integer check (kcal between 0 and 3000),
  protein_g numeric check (protein_g between 0 and 750 and protein_g * 10 = trunc(protein_g * 10)),
  carbs_g numeric check (carbs_g between 0 and 750 and carbs_g * 10 = trunc(carbs_g * 10)),
  fat_g numeric check (fat_g between 0 and 750 and fat_g * 10 = trunc(fat_g * 10)),
  created_at timestamptz not null default now(),
  primary key (user_id, fav_key),
  check (
    unit is null
    or (unit in ('g', 'ml') and amount between 1 and 2000 and amount * 10 = trunc(amount * 10))
    or (unit = 'piece' and amount between 0.5 and 20 and amount * 2 = trunc(amount * 2))
  ),
  check (
    -- Katalog/Rezept: nur Verweis + Menge bzw. Portion, KEINE Werte (Wächter E1 S1) – der Core rechnet beim
    -- Eintragen neu aus dem Bestand; den Titel setzt der Trigger aus dem Katalog (kein Freitext).
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
  )
);

comment on table public.food_log_favorites is
  'Favoriten des Ernährungstagebuchs (E1). Katalog/Rezept: nur Verweis + Menge, Titel aus dem Katalog, keine Werte – '
  'bleiben beim Widerruf (A-G14). Schnell-Favoriten (Bezeichnung + kcal): nur mit Einwilligung health_data, beim '
  'Widerruf gelöscht (Wächter E1 G1). Nur eigene Zeilen.';

create index food_log_favorites_food_id_idx on public.food_log_favorites (food_id);
create index food_log_favorites_recipe_id_idx on public.food_log_favorites (recipe_id);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------------------------------------
alter table public.food_log_entries enable row level security;
alter table public.food_log_favorites enable row level security;

revoke all on table public.food_log_entries, public.food_log_favorites from anon, authenticated;
-- Einträge: nur lesen; schreiben und löschen nur über die Funktionen der nächsten Migration.
grant select on table public.food_log_entries to authenticated;
grant select, insert, update, delete on table public.food_log_favorites to authenticated;
grant all on table public.food_log_entries, public.food_log_favorites to service_role;

create policy "Nutzer sehen eigene Tagebuch-Einträge"
  on public.food_log_entries for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Favoriten"
  on public.food_log_favorites for select to authenticated
  using (user_id = (select auth.uid()));
-- Schnell-Favoriten (Bezeichnung + kcal) nur mit gültiger Einwilligung health_data (Wächter E1 G1) – wie die
-- Tagebuch-Einträge, aus denen sie entstehen.
create policy "Nutzer setzen Favoriten (mit Profil)"
  on public.food_log_favorites for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
    and (source <> 'quick' or public.has_valid_consent('health_data'))
  );
create policy "Nutzer ändern eigene Favoriten"
  on public.food_log_favorites for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (source <> 'quick' or public.has_valid_consent('health_data'))
  );
create policy "Nutzer löschen eigene Favoriten"
  on public.food_log_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

-- Titel von Katalog-/Rezept-Favoriten immer aus dem Katalog (Wächter E1 S1: kein Freitext über die rohe API). Der
-- Trigger läuft als Eigentümer (security definer, fester search_path), damit er auch archivierte Inhalte lesen kann.
-- Unbekannter Inhalt: der Fremdschlüssel lehnt ab (hier bleibt der Titel dann unverändert).
create or replace function private.food_log_favorites_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  catalog_title text;
begin
  if new.source = 'food' then
    select f.name_de into catalog_title from public.foods f where f.id = new.food_id;
  elsif new.source = 'recipe' then
    select r.title_de into catalog_title from public.recipes r where r.id = new.recipe_id;
  end if;
  if catalog_title is not null then
    new.title_de := catalog_title;
  end if;
  return new;
end;
$$;

revoke all on function private.food_log_favorites_before_write() from public, anon, authenticated;

create trigger food_log_favorites_before_write
  before insert or update on public.food_log_favorites
  for each row execute function private.food_log_favorites_before_write();

-- Höchstens FOOD_LOG_LIMITS.maxFavorites Favoriten je Person (nach dem Einfügen gezählt, wie food_dislikes).
create or replace function private.food_log_favorites_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: FOOD_LOG_LIMITS.maxFavorites
  max_favorites constant integer := 100;
begin
  if exists (
    select 1 from public.food_log_favorites f
    where f.user_id in (select n.user_id from new_rows n)
    group by f.user_id
    having count(*) > max_favorites
  ) then
    raise exception 'Zu viele Favoriten.' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

revoke all on function private.food_log_favorites_after_insert() from public;

create trigger food_log_favorites_after_insert
  after insert on public.food_log_favorites
  referencing new table as new_rows
  for each statement execute function private.food_log_favorites_after_insert();
