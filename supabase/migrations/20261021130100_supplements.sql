-- Phase 6 · Etappe SU3 (docs/PLAN-PHASE-6.md 7.2) · Supplement-Inhalte. Rein additiv:
-- 1. Tabelle public.supplements – wie workouts/recipes: nur freigegebene bzw. zurückgezogene Einträge aus
--    content/supplements, authenticated liest nur „published“, anon nichts, schreiben nur seed_supplements
--    (service_role). Die Datei steht unverändert in `data` (Prüfer-Namen neutralisiert,
--    private.content_without_reviewer_names); Name, Stufe und Kategorie als Spalten. expert_reviewed wie bei Workouts
--    und Ernährung (Testphase sichtbar machen: „noch nicht fachlich geprüft“).
-- 2. public.seed_supplements(p_content, p_require_expert_review) – eine Transaktion, idempotent, archivieren statt
--    löschen, Versionen sinken nie, nur bekannte IDs (SUPPLEMENT_CONTENT_IDS, keine Probelauf-Einträge). Testphase wie
--    seed_workouts: nur mit p_require_expert_review = false auch ohne Fachprüfung (content/einspiel-regeln.json).
-- Dosis, Gegenanzeigen, Zeitpunkte und Pflichtsätze stehen NICHT in der Datenbank – sie rechnet der Core auf dem Gerät
-- (eine Wahrheit, getestet; Abweichung von KONZEPT 12: keine Tabelle supplement_contraindications).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Tabelle
-- ---------------------------------------------------------------------------------------------------------
create table public.supplements (
  -- Format wie SUPPLEMENT_IDS (Unterstrich). Bekannte IDs prüft seed_supplements.
  id text primary key check (id ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(id) between 3 and 60),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  name_de text not null check (char_length(name_de) between 2 and 80),
  -- Koffein hat keine Stufe (Plan 3.5, B2.3), alle anderen eine.
  evidence_level public.supplement_evidence,
  category public.supplement_category not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  expert_reviewed boolean not null
    generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((id = 'caffeine') = (evidence_level is null)),
  check ((category = 'safety_info') = (id = 'caffeine'))
);

comment on table public.supplements is
  'Supplement-Inhalte (nur freigegebene/zurückgezogene). Quelle: content/supplements im Repository, eingespielt von '
  'seed_supplements. data = Datei (Prüfer-Namen neutralisiert). Keine Dosis, keine Gegenanzeigen, keine Shops.';
comment on column public.supplements.expert_reviewed is
  'Fachlich geprüft (data.meta.expert_reviewed). false nur in der Testphase – vor dem Livegang 0 Zeilen mit '
  'status = published und false.';

create index supplements_status_idx on public.supplements (status);

create trigger supplements_set_updated_at
  before update on public.supplements
  for each row execute function private.set_updated_at();

alter table public.supplements enable row level security;
revoke all on table public.supplements from anon, authenticated;
grant select on table public.supplements to authenticated;
grant all on table public.supplements to service_role;

create policy "Freigegebene Supplement-Inhalte sind für angemeldete Nutzer lesbar"
  on public.supplements for select to authenticated
  using (status = 'published');

-- ---------------------------------------------------------------------------------------------------------
-- 2. seed_supplements(p_content, p_require_expert_review) – nur service_role (Workflow content-seed)
-- p_content = { "supplements": [...] } im Format von content/supplements/*.json
-- (packages/core/src/content/supplement-schema.ts). Rückgabe: Anzahl eingespielter und archivierter Einträge.
-- Fehlermeldungen enthalten nur Inhalts-IDs.
-- ---------------------------------------------------------------------------------------------------------
create function public.seed_supplements(p_content jsonb, p_require_expert_review boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- sync: SUPPLEMENT_CONTENT_IDS in packages/core/src/content/supplement-schema.ts (db-sync.test.ts)
  known_ids constant text[] := array[
    'creatine', 'caffeine', 'protein_powder', 'vitamin_d', 'omega3',
    'bcaa', 'glutamine', 'l_carnitine', 'cla', 'fat_burner', 'testo_booster', 'pre_workout', 'hmb',
    'ashwagandha', 'collagen', 'multivitamin', 'iron', 'melatonin'
  ];
  supplement_ids text[];
  bad text;
  archived integer;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
    or jsonb_typeof(p_content -> 'supplements') is distinct from 'array'
    or exists (select 1 from jsonb_object_keys(p_content) as k where k <> 'supplements') then
    raise exception 'Ungültige Inhalte: erwartet {"supplements": [...]}.' using errcode = 'invalid_parameter_value';
  end if;

  -- Nie zwei Einspiel-Vorgänge gleichzeitig.
  perform pg_advisory_xact_lock(hashtext('public.seed_supplements'));

  select coalesce(x ->> 'id', '(ohne ID)') into bad
  from jsonb_array_elements(p_content -> 'supplements') as x
  where jsonb_typeof(x) is distinct from 'object' or x ->> 'status' is distinct from 'published'
  limit 1;
  if bad is not null then
    raise exception 'Nur freigegebene Inhalte dürfen eingespielt werden: %', bad
      using errcode = 'invalid_parameter_value';
  end if;

  supplement_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'supplements') as x);
  if array_position(supplement_ids, null) is not null then
    raise exception 'Inhalt ohne ID.' using errcode = 'invalid_parameter_value';
  end if;
  if not private.has_distinct_elements(supplement_ids) then
    raise exception 'Doppelte Inhalts-ID.' using errcode = 'unique_violation';
  end if;
  -- Nur bekannte IDs (Regel SK2) – Probelauf-Entwürfe und Tippfehler kommen nie in die Datenbank.
  select id into bad from unnest(supplement_ids) as id where not (id = any (known_ids)) limit 1;
  if bad is not null then
    raise exception 'Unbekanntes Supplement: %', bad using errcode = 'invalid_parameter_value';
  end if;

  -- Prüfvermerk: immer ein Wahrheitswert; ohne „fachlich geprüft“ nur in der Testphase (null zählt als true).
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'supplements') as x
  where jsonb_typeof(x -> 'meta' -> 'expert_reviewed') is distinct from 'boolean'
    or jsonb_typeof(x -> 'name_de') is distinct from 'string'
    or jsonb_typeof(x -> 'category') is distinct from 'string'
    or jsonb_typeof(x -> 'version') is distinct from 'number'
  limit 1;
  if bad is not null then
    raise exception 'Supplement % ist unvollständig (Prüfvermerk, Name, Kategorie oder Version).', bad
      using errcode = 'check_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'supplements') as x
  where coalesce(p_require_expert_review, true)
    and (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb
  limit 1;
  if bad is not null then
    raise exception 'Supplement % ist nicht fachlich geprüft.', bad using errcode = 'check_violation';
  end if;

  -- Versionen sinken nie.
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'supplements') as x
  join public.supplements old on old.id = x ->> 'id'
  where (x ->> 'version')::integer < old.version
  limit 1;
  if bad is not null then
    raise exception 'Version von % ist kleiner als in der Datenbank.', bad using errcode = 'check_violation';
  end if;

  insert into public.supplements as cur (id, version, status, name_de, evidence_level, category, data)
  select
    x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'name_de',
    (x ->> 'evidence_level')::public.supplement_evidence, (x ->> 'category')::public.supplement_category,
    private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'supplements') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        name_de = excluded.name_de,
        evidence_level = excluded.evidence_level,
        category = excluded.category,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  update public.supplements set status = 'archived'
  where status = 'published' and not (id = any (supplement_ids));
  get diagnostics archived = row_count;

  return jsonb_build_object('supplements', cardinality(supplement_ids), 'archived', archived);
end;
$$;

revoke all on function public.seed_supplements(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.seed_supplements(jsonb, boolean) to service_role;
