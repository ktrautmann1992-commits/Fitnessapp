-- Etappe E2 · Eigene Gerichte (docs/PLAN-AUSWERTUNG.md Abschnitt 7, 2.7; KONZEPT 6.2; Entscheidungen A-G9, A-G12,
-- A-G14 mit der E2-Voreinstellung unten).
--
-- custom_meals: Gerichte, die eine Person oft isst („Mein Porridge“) – Name (Freitext, 1–60 Zeichen), Art
-- `direct` (Werte je Portion direkt, oder ohne Werte) bzw. `ingredients` (aus Zutaten des Katalogs berechnet, Werte je
-- Portion als Schnappschuss), Portionen. custom_meal_items: Zutaten (Katalog-Lebensmittel + Menge), Kaskade mit dem
-- Gericht.
--
-- Datenschutz (sichere Voreinstellung E2, Gründer-Frage im Plan): Der Name ist Freitext und kann Rückschlüsse auf
-- Gesundheit und Essverhalten zulassen; die Werte sind selbst eingegeben (wie Schnell-Favoriten, Wächter E1 G1).
-- Deshalb: Anlegen/Ändern nur mit gültiger Einwilligung health_data (save_custom_meal, Einwilligung FOR SHARE wie
-- save_food_log_entries), beim Widerruf gelöscht (consents_after_revoke, nächste Migration), im Export, beim
-- Konto-Löschen per Kaskade weg. Name nie in Logs, Fehlermeldungen oder Analytics: Schreiben nur über
-- save_food_log_entries/save_custom_meal, die alle Fehler OHNE Zeileninhalt melden (kein „Failing row contains …“).
--
-- Tagebuch: Einträge aus einem Gericht (source `custom_meal`) speichern NICHT den Namen, sondern den festen Titel
-- „Eigenes Gericht“ (kein Freitext im Tagebuch, Plan 2.7) und den Verweis custom_meal_id (Anzeige des Namens in der
-- App); Werte und Portion als Schnappschuss. Wird das Gericht gelöscht, bleibt der Eintrag mit custom_meal_id = null.
-- Grenzen = CUSTOM_MEAL_LIMITS/FOOD_LOG_LIMITS, Listen = CUSTOM_MEAL_MODES/FOOD_LOG_SOURCES in packages/core
-- (db-sync.test.ts).

-- ---------------------------------------------------------------------------------------------------------
-- custom_meals
-- ---------------------------------------------------------------------------------------------------------
create table public.custom_meals (
  -- id erzeugt das Gerät (offline); ist sie schon vergeben, vergibt save_custom_meal eine neue.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- sync: CUSTOM_MEAL_LIMITS.nameMaxChars; ohne Steuerzeichen, ohne Leerraum am Rand (isValidCustomMealName)
  name_de text not null check (
    char_length(name_de) between 1 and 60
    and name_de !~ '[[:cntrl:]]'
    and name_de !~ '^[[:space:]]'
    and name_de !~ '[[:space:]]$'
  ),
  -- sync: CUSTOM_MEAL_MODES
  mode text not null check (mode in ('direct', 'ingredients')),
  -- sync: CUSTOM_MEAL_LIMITS.servings
  servings integer not null check (servings between 1 and 20),
  -- Werte JE PORTION (sync: FOOD_LOG_LIMITS.kcal/macroG)
  kcal integer check (kcal between 0 and 3000),
  protein_g numeric check (protein_g between 0 and 750 and protein_g * 10 = trunc(protein_g * 10)),
  carbs_g numeric check (carbs_g between 0 and 750 and carbs_g * 10 = trunc(carbs_g * 10)),
  fat_g numeric check (fat_g between 0 and 750 and fat_g * 10 = trunc(fat_g * 10)),
  revision integer not null default 1 check (revision >= 1),
  last_write_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Form je Art (wie customMealSchema): direkt = genau 1 Portion, Makros nur mit kcal; aus Zutaten = alle Werte.
  constraint custom_meals_shape_check check (
    (mode = 'direct'
      and servings = 1
      and (kcal is not null or (protein_g is null and carbs_g is null and fat_g is null)))
    or (mode = 'ingredients'
      and kcal is not null and protein_g is not null and carbs_g is not null and fat_g is not null)
  )
);

comment on table public.custom_meals is
  'Eigene Gerichte (E2). Name = Freitext: nur mit Einwilligung health_data, beim Widerruf gelöscht, nie loggen. '
  'Schreiben nur über save_custom_meal; Löschen direkt (eigene Zeilen).';

create index custom_meals_user_idx on public.custom_meals (user_id);

create trigger custom_meals_set_updated_at
  before update on public.custom_meals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- custom_meal_items: Zutaten (höchstens 30 je Gericht = order_no 1–30)
-- ---------------------------------------------------------------------------------------------------------
create table public.custom_meal_items (
  meal_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- sync: CUSTOM_MEAL_LIMITS.maxItems
  order_no integer not null check (order_no between 1 and 30),
  -- Ein Lebensmittel, das in einem eigenen Gericht steckt, darf nicht gelöscht werden (Archivieren geht).
  food_id text not null references public.foods (id) on update cascade on delete restrict,
  amount numeric not null check (amount > 0),
  -- sync: FOOD_LOG_UNITS
  unit text not null check (unit in ('g', 'ml', 'piece')),
  primary key (meal_id, order_no),
  -- Gericht derselben Person; mit dem Gericht gelöscht.
  foreign key (meal_id, user_id) references public.custom_meals (id, user_id) on delete cascade,
  -- Menge je Einheit wie im Tagebuch (sync: FOOD_LOG_LIMITS.amountMass/amountPiece).
  constraint custom_meal_items_amount_unit_check check (
    (unit in ('g', 'ml') and amount between 1 and 2000 and amount * 10 = trunc(amount * 10))
    or (unit = 'piece' and amount between 0.5 and 20 and amount * 2 = trunc(amount * 2))
  )
);

comment on table public.custom_meal_items is
  'Zutaten eigener Gerichte (E2) – Katalog-Lebensmittel + Menge. Nur eigene Zeilen, mit dem Gericht gelöscht.';

create index custom_meal_items_user_idx on public.custom_meal_items (user_id);
create index custom_meal_items_food_id_idx on public.custom_meal_items (food_id);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS: lesen und löschen eigene Zeilen; Anlegen/Ändern nur über save_custom_meal (nächste Migration).
-- Löschen braucht keine Einwilligung (Recht auf Löschung); die Zutaten gehen per Kaskade mit.
-- ---------------------------------------------------------------------------------------------------------
alter table public.custom_meals enable row level security;
alter table public.custom_meal_items enable row level security;

revoke all on table public.custom_meals, public.custom_meal_items from anon, authenticated;
grant select, delete on table public.custom_meals to authenticated;
grant select on table public.custom_meal_items to authenticated;
grant all on table public.custom_meals, public.custom_meal_items to service_role;

create policy "Nutzer sehen eigene Gerichte"
  on public.custom_meals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Gerichte"
  on public.custom_meals for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen Zutaten eigener Gerichte"
  on public.custom_meal_items for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- food_log_entries: neue Herkunft `custom_meal` (FOOD_LOG_SOURCES) mit Verweis custom_meal_id. Rein additiv: neue
-- Spalte (nullable), CHECK-Bedingungen werden nur um den Zweig `custom_meal` erweitert (alle bisherigen Zeilen
-- bleiben gültig).
-- ---------------------------------------------------------------------------------------------------------
alter table public.food_log_entries add column custom_meal_id uuid;

-- Nur ein eigenes Gericht DERSELBEN Person; wird es gelöscht, bleibt der Eintrag (Schnappschuss) mit
-- custom_meal_id = null (nur diese Spalte, user_id bleibt).
alter table public.food_log_entries
  add constraint food_log_entries_custom_meal_fkey
  foreign key (custom_meal_id, user_id) references public.custom_meals (id, user_id)
  on delete set null (custom_meal_id);

create index food_log_entries_custom_meal_id_idx on public.food_log_entries (custom_meal_id);

-- sync: FOOD_LOG_SOURCES
alter table public.food_log_entries drop constraint food_log_entries_source_check;
alter table public.food_log_entries
  add constraint food_log_entries_source_check
  check (source in ('plan_item', 'food', 'recipe', 'quick', 'custom_meal'));

-- Form je Herkunft: die bisherige (unbenannte) Bedingung aus 20261015130000_food_log.sql wird durch dieselbe
-- Bedingung plus den Zweig `custom_meal` ersetzt. Sie ist die einzige CHECK-Bedingung mit den Schnelleintrag-
-- Bezeichnungen und der Herkunft 'food' (eindeutig, sonst bricht die Migration ab).
do $$
declare
  shape_name text;
begin
  select c.conname into strict shape_name
  from pg_constraint c
  where c.conrelid = 'public.food_log_entries'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%''Auswärts gegessen''%'
    and pg_get_constraintdef(c.oid) like '%''food''%';
  execute format('alter table public.food_log_entries drop constraint %I', shape_name);
end;
$$;

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
  );

-- Verweis auf ein eigenes Gericht nur bei dieser Herkunft.
alter table public.food_log_entries
  add constraint food_log_entries_custom_meal_check check (source = 'custom_meal' or custom_meal_id is null);
