-- Etappe B2 · Trainingstage mit Art und Dauer, Gewichte zum Antippen (docs/PLAN-PHASE-3-ERWEITERUNG.md
-- Abschnitte 4.1–4.3). Reihenfolge in dieser Datei (verbindlich):
-- 1. Tabelle training_slots + replace_training_slots,
-- 2. Übernahme des alten Zeitbudgets aus goals, danach Entfernen der drei goals-Spalten,
-- 3. Langhantel: ERST Werte über 25 kg entfernen, DANN den CHECK „Scheibe ≤ 25 kg“; neue Spalte bar_kg;
--    replace_user_equipment mit bar_kg.
-- Grenzen = packages/core/src/constants.ts (TRAINING_LIMITS, BARBELL_BAR_KG, BARBELL_PLATE_MAX_KG), abgeglichen
-- in db-sync.test.ts. Etappe-B-Migrationen bleiben unverändert.

-- ---------------------------------------------------------------------------------------------------------
-- 1. training_slots: höchstens 7 Trainingstage je Person (Art + Dauer, optional Wochentag).
-- Kein Gesundheitsdatum (Vorlieben wie das bisherige Zeitbudget in goals): keine Einwilligung nötig, wird beim
-- Widerruf von health_data nicht gelöscht. Kontolöschung über die Kaskade auf auth.users.
-- ---------------------------------------------------------------------------------------------------------
create type public.training_slot_kind as enum ('strength_gym', 'strength_home', 'endurance');

create table public.training_slots (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Laufende Nummer 1…n (lückenlos, prüft replace_training_slots) → höchstens 7 Einträge.
  slot_no smallint not null check (slot_no between 1 and 7),
  -- Wochentag nach ISO 8601 (1 = Montag … 7 = Sonntag); null = „Tag egal – verteilt für mich“.
  weekday smallint check (weekday between 1 and 7),
  kind public.training_slot_kind not null,
  minutes smallint not null check (minutes between 10 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot_no)
);

create unique index training_slots_user_weekday_key
  on public.training_slots (user_id, weekday)
  where weekday is not null;

alter table public.training_slots enable row level security;

-- Nur lesen: Regeln über mehrere Zeilen (fest ODER „Tag egal“, lückenlose Nummern) setzt allein
-- replace_training_slots durch – kein direktes Insert/Update/Delete über PostgREST.
revoke all on table public.training_slots from anon, authenticated;
grant select on table public.training_slots to authenticated;
grant all on table public.training_slots to service_role;

create policy "Nutzer sehen eigene Trainingstage"
  on public.training_slots for select to authenticated
  using (user_id = (select auth.uid()));

create trigger training_slots_set_updated_at
  before update on public.training_slots
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- replace_training_slots: alle Trainingstage der angemeldeten Person atomar ersetzen.
-- p_items: JSON-Array aus Objekten { slot_no, weekday, kind, minutes } (= trainingSlotItemSchema in
-- packages/core/src/training-schedule.ts). Prüft: Login, Profil zuerst, 1–7 Einträge, nur bekannte Felder (alle
-- Pflicht, weekday darf null sein), Werte, slot_no lückenlos 1…n, entweder alle oder keiner mit Wochentag,
-- Wochentag eindeutig. Fehlermeldungen deutsch, ohne Nutzerdaten.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.replace_training_slots(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_keys constant text[] := array['slot_no', 'weekday', 'kind', 'minutes'];
  current_user_id uuid := auth.uid();
  item jsonb;
  item_count integer;
  with_day integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Profil zuerst – und zugleich sperren: Zwei gleichzeitige Aufrufe derselben Person laufen nacheinander (sonst
  -- könnte das Einfügen des zweiten an training_slots_pkey scheitern, weil beide vor dem Löschen begonnen haben).
  perform 1 from public.profiles p where p.user_id = current_user_id for update;
  if not found then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Ungültige Trainingstage.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_array_length(p_items) not between 1 and 7 then
    raise exception 'Ungültige Trainingstage.' using errcode = 'invalid_parameter_value';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    perform private.assert_json_keys(item, item_keys, 'Trainingstag');
    if not (item ?& item_keys)
       or not private.jsonb_number_between(item -> 'slot_no', 1, 7, 0)
       or not (jsonb_typeof(item -> 'weekday') = 'null'
               or private.jsonb_number_between(item -> 'weekday', 1, 7, 0))
       or ((item ->> 'kind') = any (enum_range(null::public.training_slot_kind)::text[])) is not true
       or not private.jsonb_number_between(item -> 'minutes', 10, 240, 0) then
      raise exception 'Ungültige Trainingstage.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  item_count := jsonb_array_length(p_items);
  select count(*) filter (where jsonb_typeof(i -> 'weekday') <> 'null')
  into with_day
  from jsonb_array_elements(p_items) as i;

  -- slot_no lückenlos 1…n (n verschiedene Nummern zwischen 1 und n).
  if (select count(distinct (i ->> 'slot_no')::numeric) from jsonb_array_elements(p_items) as i) <> item_count
     or exists (
       select 1 from jsonb_array_elements(p_items) as i where (i ->> 'slot_no')::numeric > item_count
     ) then
    raise exception 'Ungültige Trainingstage.' using errcode = 'invalid_parameter_value';
  end if;
  -- Kein gemischter Modus; jeder Wochentag höchstens einmal.
  if with_day not in (0, item_count)
     or (select count(distinct (i ->> 'weekday')::numeric)
         from jsonb_array_elements(p_items) as i
         where jsonb_typeof(i -> 'weekday') <> 'null') <> with_day then
    raise exception 'Ungültige Trainingstage.' using errcode = 'invalid_parameter_value';
  end if;

  delete from public.training_slots where user_id = current_user_id;

  insert into public.training_slots (user_id, slot_no, weekday, kind, minutes)
  select current_user_id, (i ->> 'slot_no')::smallint, (i ->> 'weekday')::smallint,
    (i ->> 'kind')::public.training_slot_kind, (i ->> 'minutes')::smallint
  from jsonb_array_elements(p_items) as i;
exception
  -- Sicherheitsnetz (sollte wegen der Sperre nie eintreten): verständliche Meldung ohne Nutzerdaten.
  when unique_violation then
    raise exception 'Trainingstage wurden gleichzeitig geändert – bitte erneut versuchen.'
      using errcode = 'serialization_failure';
end;
$$;

revoke all on function public.replace_training_slots(jsonb) from public, anon;
grant execute on function public.replace_training_slots(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Übernahme des alten Zeitbudgets (nur wo Tage pro Woche UND Minuten gesetzt sind – die App schreibt beide
-- immer zusammen): Art aus dem Ort (home → Kraft zu Hause; gym, both, ohne Ort → Kraft im Studio), Minuten =
-- minutes_per_session. Anzahl Wunsch-Tage = Tage pro Woche → feste Tage mit diesen Wochentagen; sonst „Tag
-- egal“ mit sessions_per_week Einträgen (die Wunsch-Tage entfallen). Gleiche Regel wie
-- scheduleFromLegacyGoals() in packages/core (Gerätespeicher des Testmodus).
-- ---------------------------------------------------------------------------------------------------------
-- Als Funktion, damit pgTAP dieselbe Regel prüfen kann, mit der hier übernommen wird (die alten Zeilen gibt es
-- in der Test-Datenbank nicht). Nur für diese Übernahme; nicht für Nutzer ausführbar.
create or replace function private.legacy_time_budget_slots(
  p_sessions_per_week smallint,
  p_minutes_per_session smallint,
  p_preferred_days smallint[],
  p_training_location public.training_location
)
returns table (slot_no smallint, weekday smallint, kind public.training_slot_kind, minutes smallint)
language sql
immutable
set search_path = ''
as $$
  select
    n.idx::smallint,
    case when cardinality(p_preferred_days) = p_sessions_per_week then d.days[n.idx] end,
    case when p_training_location = 'home' then 'strength_home' else 'strength_gym' end::public.training_slot_kind,
    p_minutes_per_session
  from (select array(select x from unnest(p_preferred_days) as x order by x) as days) as d
  cross join generate_series(1, p_sessions_per_week) as n(idx)
  where p_sessions_per_week is not null and p_minutes_per_session is not null
$$;

revoke all on function private.legacy_time_budget_slots(smallint, smallint, smallint[], public.training_location)
  from public, anon, authenticated;

insert into public.training_slots (user_id, slot_no, weekday, kind, minutes)
select g.user_id, s.slot_no, s.weekday, s.kind, s.minutes
from public.goals g
cross join lateral private.legacy_time_budget_slots(
  g.sessions_per_week, g.minutes_per_session, g.preferred_days, g.training_location
) as s;

alter table public.goals
  drop column sessions_per_week,
  drop column minutes_per_session,
  drop column preferred_days;

comment on column public.goals.training_location is
  'Abgeleitet aus training_slots (deriveTrainingLocation in packages/core); null = nur Ausdauer bzw. noch offen.';

-- ---------------------------------------------------------------------------------------------------------
-- 3. Langhantel: weights_kg = SCHEIBEN je Paar (höchstens 25 kg), Stange getrennt in bar_kg (5–25 kg).
-- Werte über 25 kg wurden früher wohl als Gesamtgewicht eingetragen. Sichere Wahl: entfernen statt deuten – ein
-- falsch gedeutetes Gewicht wäre gefährlicher als ein fehlendes. ERST entfernen, DANN den CHECK anlegen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.barbell_plates_only(p_weights numeric[])
returns numeric[]
language sql
immutable
set search_path = ''
as $$
  select array(select w from unnest(p_weights) as w where w <= 25 order by w)
$$;

revoke all on function private.barbell_plates_only(numeric[]) from public, anon, authenticated;

update public.user_equipment
set weights_kg = private.barbell_plates_only(weights_kg)
where equipment_id = 'barbell' and exists (select 1 from unnest(weights_kg) as w where w > 25);

alter table public.user_equipment
  add column bar_kg numeric(4, 2) check (bar_kg between 5 and 25),
  add constraint user_equipment_bar_kg_only_barbell check (bar_kg is null or equipment_id = 'barbell'),
  add constraint user_equipment_barbell_plates_max check (equipment_id <> 'barbell' or 25 >= all (weights_kg));

comment on column public.user_equipment.weights_kg is
  'Gewichtsstufen in kg: Kurzhanteln je Hantel, Kettlebells je Kugel, Langhantel = Scheiben je Paar (≤ 25 kg).';
comment on column public.user_equipment.bar_kg is
  'Nur Langhantel: Gewicht der Stange in kg (5–25); null = Standard 20 kg (BARBELL_DEFAULT_BAR_KG).';

-- replace_user_equipment (20261003120900_replace_rpcs.sql) um bar_kg erweitert, Signatur unverändert.
create or replace function public.replace_user_equipment(
  p_location public.equipment_location,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_location is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Ungültige Geräteliste.' using errcode = 'invalid_parameter_value';
  end if;

  delete from public.user_equipment
  where user_id = current_user_id and location = p_location;

  insert into public.user_equipment (user_id, equipment_id, location, weights_kg, note, bar_kg)
  select current_user_id, i.equipment_id, p_location, coalesce(i.weights_kg, '{}'), i.note, i.bar_kg
  from jsonb_to_recordset(p_items)
    as i(equipment_id text, weights_kg numeric(5, 2)[], note text, bar_kg numeric(4, 2));
end;
$$;

revoke all on function public.replace_user_equipment(public.equipment_location, jsonb)
  from public, anon;
grant execute on function public.replace_user_equipment(public.equipment_location, jsonb)
  to authenticated, service_role;
