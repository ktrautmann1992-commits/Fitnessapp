-- Supplemente rund ums Training (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md) · Teil 2.
-- seed_supplements kennt die fünf neuen Inhalts-IDs (beta_alanine, eaa, electrolytes, zinc, magnesium). Sonst
-- unverändert gegenüber 20261021130100_supplements.sql (gleicher Text, gleiche Rechte). Tabelle und RLS unverändert.

create or replace function public.seed_supplements(p_content jsonb, p_require_expert_review boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- sync: SUPPLEMENT_CONTENT_IDS in packages/core/src/content/supplement-schema.ts (db-sync.test.ts)
  known_ids constant text[] := array[
    'creatine', 'caffeine', 'protein_powder', 'vitamin_d', 'omega3',
    'beta_alanine', 'eaa', 'electrolytes', 'zinc', 'magnesium',
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
