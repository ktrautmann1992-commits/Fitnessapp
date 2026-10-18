-- Phase 4b · Etappe B · Server-Funktionen der Live-Anpassung (docs/PLAN-PHASE-4B.md 4.6, Wächter B1, B2, S1–S3, S-n2).
-- Alle `security definer`, `search_path = ''`, `revoke … from public, anon`. Nur additiv:
--  1. private.enqueue_adjustment_event(uid, Auslöser, Verweis) – Ereignis NUR bei Premium (Flag + Freischaltung, S2);
--     Fehler brechen den Gratis-Weg nie ab.
--  2. public.live_adjustment_status() (authenticated, nur Anzeige).
--  3. public.apply_plan_adjustments(uid, batch) – NUR service_role: Premium, Feldliste, Grenzen, zulässige Einheiten
--     (S1), Wochen-Invarianten (B2) und Wochen-Deckel nachgerechnet; schreibt atomar; idempotent.
--  4. public.confirm_plan_adjustment(id, annehmen) und 5. public.revert_plan_adjustment(id) (authenticated).
--  6. public.claim_adjustment_events(uid, limit) mit Ratenbegrenzung (S3) und public.mark_adjustment_events_processed
--     (beide nur service_role); private.expire_plan_adjustments() (Ablauf, Aufräumen; Sweep und pg_cron).
--  7. public.beta_admin – neueste Fassung (E4a) plus Flag live_adjustment und dessen Status (nur Zahlen).
-- Ergebnisse als feste Codes ohne Zeileninhalt. Konstanten mit „sync:“ gleicht db-sync.test.ts mit
-- packages/core/src/constants.ts (LIVE_ADJUSTMENT u. a.) ab.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Ereignis schreiben (Outbox) – nur Premium, nie ein Fehler nach außen
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.enqueue_adjustment_event(
  p_user_id uuid, p_trigger public.adjustment_trigger, p_ref_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or not private.feature_enabled('live_adjustment')
     or not private.has_entitlement_for(p_user_id, 'premium') then
    return;
  end if;
  insert into private.adjustment_events (user_id, trigger, ref_id)
  values (p_user_id, p_trigger, p_ref_id)
  on conflict on constraint adjustment_events_one do nothing;
exception
  when others then
    -- Gratis-Weg (Speichern, Verpasst, Messung, Ziel, Trainingstage) läuft weiter; nur ein fester Code im Log.
    raise warning 'live_adjust_enqueue_failed';
end;
$$;
revoke all on function private.enqueue_adjustment_event(uuid, public.adjustment_trigger, uuid)
  from public, anon, authenticated;

-- Feste Ergebnis-Codes intern als Ausnahme (Nachricht = Code), damit alles Geschriebene zurückgerollt wird.
create or replace function private.adjust_assert(p_ok boolean, p_code text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_ok is not true then
    raise exception using message = p_code, errcode = 'P0001';
  end if;
end;
$$;
revoke all on function private.adjust_assert(boolean, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Status für die Anzeige (die Wahrheit prüft apply_plan_adjustments)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.live_adjustment_status()
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
  if not private.feature_enabled('live_adjustment') then
    return jsonb_build_object('active', false, 'reason', 'flag_off');
  end if;
  if not private.has_entitlement_for(current_user_id, 'premium') then
    return jsonb_build_object('active', false, 'reason', 'no_entitlement');
  end if;
  return jsonb_build_object('active', true, 'reason', 'ok');
end;
$$;
revoke all on function public.live_adjustment_status() from public, anon;
grant execute on function public.live_adjustment_status() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Wochen D früherer wirksamer deload_forward eines Plans (swappedWeeksOf: explain_params.swapped_week_start → Woche
-- mit diesem Montag), optional ohne eine Anpassung (Rücknahme).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.plan_swapped_weeks(p_plan_id uuid, p_sessions jsonb, p_without uuid default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with weeks as (
    select (s ->> 'block_no')::integer as block_no, (s ->> 'week_no')::integer as week_no,
           date_trunc('week', min((s ->> 'scheduled_on')::date))::date as monday
    from jsonb_array_elements(p_sessions) s
    group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object('blockNo', w.block_no, 'weekNo', w.week_no)
                            order by a.created_at, a.id), '[]'::jsonb)
  from public.plan_adjustments a
  join lateral (
    select * from weeks w where w.monday::text = a.explain_params ->> 'swapped_week_start'
    order by w.block_no, w.week_no limit 1
  ) w on true
  where a.plan_id = p_plan_id
    and a.rule = 'deload_forward'
    and a.status in ('applied', 'confirmed')
    and (p_without is null or a.id <> p_without)
$$;
revoke all on function private.plan_swapped_weeks(uuid, jsonb, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Prüfung einer Plan-Änderung (Struktur je Regel, Wertebereiche, Vorher = aktueller Plan). Wirft feste Codes:
-- invalid_input (Form/Grenzen) bzw. plan_changed (Vorher passt nicht mehr zum Plan).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.assert_plan_change(
  p_rule text, p_before jsonb, p_after jsonb, p_planned_ids jsonb, p_cur jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  -- Erlaubte Felder je Regel (Vorher/Nachher-Bausteine in packages/core/src/adjust/plan-changes.ts).
  rule_session_keys constant jsonb := '{
    "volume_reduce": ["id", "estimated_minutes", "exercises"],
    "endurance_reduce": ["id", "estimated_minutes", "workout_steps", "target_distance_m"],
    "deload_forward": ["id", "is_deload", "estimated_minutes", "exercises", "workout_steps", "target_distance_m"],
    "stagnation_variation": ["id", "exercises"]
  }';
  rule_exercise_keys constant jsonb := '{
    "volume_reduce": ["order_no", "sets"],
    "deload_forward": ["order_no", "sets", "rpe_target"],
    "stagnation_variation": ["order_no", "exercise_id", "exercise_name_de"]
  }';
  -- sync: LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment, LIVE_ADJUSTMENT.highSessionLoad.setsReduction,
  -- SESSION_FIT.minSetsCompound, SESSION_FIT.minSetsIsolation, ENDURANCE_SESSION_LIMITS.minSessionMinutes
  max_sessions constant integer := 42;
  sets_reduction constant integer := 1;
  min_sets_compound constant integer := 2;
  min_sets_isolation constant integer := 1;
  min_session_minutes constant integer := 10;
  allowed_s text[];
  allowed_e text[];
  b jsonb;
  a jsonb;
  cur jsonb;
  eb jsonb;
  ea jsonb;
  ce jsonb;
  k text;
  ids text[];
begin
  allowed_s := array(select jsonb_array_elements_text(rule_session_keys -> p_rule));
  allowed_e := array(select jsonb_array_elements_text(coalesce(rule_exercise_keys -> p_rule, '[]'::jsonb)));
  perform private.adjust_assert(
    jsonb_typeof(p_before) = 'object' and jsonb_typeof(p_after) = 'object'
    and (select array_agg(x) from jsonb_object_keys(p_before) x) = array['sessions']
    and (select array_agg(x) from jsonb_object_keys(p_after) x) = array['sessions']
    and jsonb_typeof(p_before -> 'sessions') = 'array' and jsonb_typeof(p_after -> 'sessions') = 'array'
    and jsonb_array_length(p_after -> 'sessions') between 1 and max_sessions
    and jsonb_array_length(p_before -> 'sessions') = jsonb_array_length(p_after -> 'sessions'),
    'invalid_input');
  -- Gleiche Einheiten vorher und nachher, je einmal; planned_session_ids = genau diese Einheiten.
  ids := array(select x ->> 'id' from jsonb_array_elements(p_after -> 'sessions') x order by 1);
  perform private.adjust_assert(
    (select count(distinct x ->> 'id') from jsonb_array_elements(p_after -> 'sessions') x) = cardinality(ids)
    and ids = array(select x ->> 'id' from jsonb_array_elements(p_before -> 'sessions') x order by 1)
    and ids = array(select x from jsonb_array_elements_text(p_planned_ids) x order by 1),
    'invalid_input');

  for a in select value from jsonb_array_elements(p_after -> 'sessions') loop
    select value into b from jsonb_array_elements(p_before -> 'sessions') where value ->> 'id' = a ->> 'id';
    select value into cur from jsonb_array_elements(p_cur) where value ->> 'id' = a ->> 'id';
    perform private.adjust_assert(cur is not null, 'not_eligible');
    -- Gleiche Schlüssel vorher/nachher, nur erlaubte.
    perform private.adjust_assert(
      (select array_agg(x order by x) from jsonb_object_keys(a) x) = (select array_agg(x order by x) from jsonb_object_keys(b) x)
      and not exists (select 1 from jsonb_object_keys(a) x where not x = any (allowed_s)),
      'invalid_input');
    -- Wertebereiche nachher (= CHECKs von planned_sessions).
    perform private.adjust_assert(
      (not a ? 'is_deload' or jsonb_typeof(a -> 'is_deload') = 'boolean')
      and (not a ? 'estimated_minutes' or private.jsonb_number_between(a -> 'estimated_minutes', 1, 600, 0))
      and (not a ? 'target_distance_m' or jsonb_typeof(a -> 'target_distance_m') = 'null'
           or private.jsonb_number_between(a -> 'target_distance_m', 100, 60000, 0))
      and (not a ? 'workout_steps' or jsonb_typeof(a -> 'workout_steps') = 'array')
      -- Wächter B Auflage 1: Schritte nur bei lockeren Wettkampf-Arten neu (isReducibleEndurance; die Anstrengung
      -- begrenzt dort der CHECK workout_steps_fit_type auf ≤ 4) – harte Einheiten, Steigerungen, Koppeltraining und
      -- Technik behalten ihre Schritte. Distanz-Richtwert nie höher: nachher null oder ≤ vorher.
      and (not a ? 'workout_steps' or cur ->> 'workout_type' in ('easy', 'recovery', 'long'))
      and (not a ? 'target_distance_m' or jsonb_typeof(a -> 'target_distance_m') = 'null'
           or (jsonb_typeof(b -> 'target_distance_m') = 'number'
               and (a ->> 'target_distance_m')::integer <= (b ->> 'target_distance_m')::integer))
      and (not a ? 'exercises' or (jsonb_typeof(a -> 'exercises') = 'array'
                                  and jsonb_typeof(b -> 'exercises') = 'array'
                                  and jsonb_array_length(a -> 'exercises') between 1 and 8)),
      'invalid_input');
    -- Vorher = aktueller Plan (sonst wurde der Plan inzwischen geändert).
    foreach k in array array['is_deload', 'estimated_minutes', 'workout_steps', 'target_distance_m'] loop
      if b ? k then
        perform private.adjust_assert(b -> k = coalesce(cur -> k, 'null'::jsonb), 'plan_changed');
      end if;
    end loop;
    if a ? 'exercises' then
      perform private.adjust_assert(
        array(select (x ->> 'order_no') from jsonb_array_elements(a -> 'exercises') x order by 1)
        = array(select (x ->> 'order_no') from jsonb_array_elements(b -> 'exercises') x order by 1)
        and (select count(distinct x -> 'order_no') from jsonb_array_elements(a -> 'exercises') x)
            = jsonb_array_length(a -> 'exercises'),
        'invalid_input');
      for ea in select value from jsonb_array_elements(a -> 'exercises') loop
        select value into eb from jsonb_array_elements(b -> 'exercises') where value -> 'order_no' = ea -> 'order_no';
        select value into ce from jsonb_array_elements(cur -> 'exercises') where value -> 'order_no' = ea -> 'order_no';
        perform private.adjust_assert(
          (select array_agg(x order by x) from jsonb_object_keys(ea) x)
            = (select array_agg(x order by x) from jsonb_object_keys(eb) x)
          and not exists (select 1 from jsonb_object_keys(ea) x where not x = any (allowed_e))
          and private.jsonb_number_between(ea -> 'order_no', 1, 8, 0)
          and (not ea ? 'sets' or private.jsonb_number_between(ea -> 'sets', 1, 6, 0))
          and (not ea ? 'rpe_target' or (private.jsonb_number_between(ea -> 'rpe_target', 5, 9, 1)
                                         and (ea ->> 'rpe_target')::numeric * 2 = trunc((ea ->> 'rpe_target')::numeric * 2)))
          and (not ea ? 'exercise_id' or jsonb_typeof(ea -> 'exercise_id') = 'string')
          and (not ea ? 'exercise_name_de' or (jsonb_typeof(ea -> 'exercise_name_de') = 'string'
                                               and char_length(ea ->> 'exercise_name_de') between 2 and 100)),
          'invalid_input');
        perform private.adjust_assert(ce is not null, 'plan_changed');
        foreach k in array array['sets', 'rpe_target', 'exercise_id', 'exercise_name_de'] loop
          if eb ? k then
            perform private.adjust_assert(eb -> k = ce -> k, 'plan_changed');
          end if;
        end loop;
        -- Regel-Grenzen je Übung.
        if p_rule = 'volume_reduce' then
          -- Sätze −1, nie unter SESSION_FIT (Grundübung 2, Isolationsübung 1).
          perform private.adjust_assert(
            (ea ->> 'sets')::integer = (eb ->> 'sets')::integer - sets_reduction
            and (ea ->> 'sets')::integer >= (
              select case when x.mechanics = 'isolation' then min_sets_isolation else min_sets_compound end
              from public.exercises x where x.id = ce ->> 'exercise_id'),
            'invalid_input');
        elsif p_rule = 'stagnation_variation' then
          -- Tausch nur auf eine freigegebene Alternative der alten Übung bzw. gleiches Bewegungsmuster; Name aus der
          -- Bibliothek. Die volle Sicherheitsprüfung macht core; die Anzeige wendet die Sicherheitsregeln zuletzt an.
          perform private.adjust_assert(
            ea ->> 'exercise_id' <> eb ->> 'exercise_id'
            and exists (
              select 1
              from public.exercises n
              join public.exercises o on o.id = eb ->> 'exercise_id'
              where n.id = ea ->> 'exercise_id'
                and n.status = 'published'
                and n.name_de = ea ->> 'exercise_name_de'
                and (n.movement_pattern = o.movement_pattern
                     or exists (select 1 from public.exercise_alternatives x
                                where x.exercise_id = o.id and x.alternative_id = n.id))),
            'invalid_input');
        end if;
      end loop;
    end if;
    -- Regel-Grenzen je Einheit.
    if p_rule = 'volume_reduce' then
      perform private.adjust_assert(
        cur ->> 'kind' = 'strength'
        and (a ->> 'estimated_minutes')::integer <= (b ->> 'estimated_minutes')::integer,
        'invalid_input');
    elsif p_rule = 'endurance_reduce' then
      -- Minuten nur nach unten, nie unter das Minimum (bzw. den bisherigen Wert, wenn der schon darunter lag).
      perform private.adjust_assert(
        cur ->> 'kind' = 'endurance'
        and (a ->> 'estimated_minutes')::integer <= (b ->> 'estimated_minutes')::integer
        and (a ->> 'estimated_minutes')::integer >= least((b ->> 'estimated_minutes')::integer, min_session_minutes),
        'invalid_input');
    elsif p_rule = 'deload_forward' then
      -- Ausdauer-Minuten der vorgezogenen bzw. neu gedeckelten Wochen: nie unter das Minimum; Obergrenzen über die
      -- Wochen-Invarianten (getauschte Woche ≤ Vorwoche, 10-%-Regel).
      perform private.adjust_assert(
        not a ? 'estimated_minutes' or cur ->> 'kind' = 'strength'
        or (a ->> 'estimated_minutes')::integer >= least((b ->> 'estimated_minutes')::integer, min_session_minutes),
        'invalid_input');
    end if;
  end loop;
end;
$$;
revoke all on function private.assert_plan_change(text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. apply_plan_adjustments – nur service_role (Route POST /api/live-anpassung bzw. Sweep, Etappe C)
-- ---------------------------------------------------------------------------------------------------------
-- p_batch = { plan_id, trigger, max_load_weeks, adjustments: [AdjustmentProposal …] } (Feldnamen wie
-- adjustmentProposalSchema). Ergebnis: { result: ok, applied, duplicates } oder ein fester Code ohne Änderung:
-- not_entitled, invalid_input, plan_changed, not_eligible, weekly_limit, invariant_violation.
create or replace function public.apply_plan_adjustments(p_user uuid, p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_keys constant text[] := array['plan_id', 'trigger', 'max_load_weeks', 'adjustments'];
  -- Feldliste = adjustmentProposalSchema in packages/core/src/adjust/schemas.ts (db-sync.test.ts).
  adjustment_keys constant text[] := array[
    'rule', 'kind', 'requiresConfirmation', 'exerciseId', 'plannedSessionIds', 'basisSessionLogId',
    'basisPerformedOn', 'stateBefore', 'stateAfter', 'changeBefore', 'changeAfter', 'explainParams', 'effectiveFrom',
    'expiresOn', 'inputFingerprint', 'engineVersion', 'ruleVersion', 'usesBodyData', 'fromHealthPlan'
  ];
  fewer_days_keys constant text[] := array['days', 'drop_weekday'];
  -- Aktive Regeln und ihre Art (RULE_KIND); reservierte Regeln sind in 4b nicht erlaubt.
  rule_kinds constant jsonb := '{
    "fast_increase": "state_override", "load_reduce": "state_override", "volume_reduce": "plan_change",
    "deload_forward": "plan_change", "endurance_reduce": "plan_change", "stagnation_variation": "plan_change",
    "fewer_days": "proposal"
  }';
  -- sync: LIVE_ADJUSTMENT.maxPerBatch, maxPlannedSessionsPerAdjustment, maxAutomaticPerWeek, proposalExpiresDays,
  -- loadReduce.factor, loadReduce.holdMinS, LOAD_PROGRESSION.maxIncreaseFraction in packages/core/src/constants.ts
  max_per_batch constant integer := 20;
  max_sessions constant integer := 42;
  max_automatic_per_week constant integer := 3;
  proposal_expires_days constant integer := 14;
  load_reduce_factor constant numeric := 0.9;
  hold_min_s constant integer := 10;
  max_increase_fraction constant numeric := 0.1;
  -- sync: LOAD_PROGRESSION.extraRepsBuffer
  extra_reps_buffer constant integer := 2;
  fingerprint_pattern constant text := '^[a-z_]+:[0-9a-f]{16}$';
  date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  today date := private.berlin_today();
  v_plan_id uuid;
  v_plan_start date;
  v_plan_health boolean;
  v_trigger public.adjustment_trigger;
  load_weeks integer;
  before_plan jsonb;
  cur jsonb;
  existing_swapped jsonb;
  new_swapped jsonb := '[]'::jsonb;
  item jsonb;
  items jsonb := '[]'::jsonb;
  v_rule text;
  v_kind text;
  ids uuid[];
  basis_on date;
  sb jsonb;
  sa jsonb;
  first_effective date;
  automatic_new integer := 0;
  automatic_existing integer;
  duplicates integer := 0;
  applied integer := 0;
  new_id uuid;
  violations jsonb;
  swap_monday text;
  swap_week jsonb;
  c jsonb;
  ce jsonb;
  options jsonb;
  err text;
begin
  if p_user is null then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  -- Premium zuerst (Flag und Freischaltung); ohne beides keine Änderung.
  if not private.feature_enabled('live_adjustment') or not private.has_entitlement_for(p_user, 'premium') then
    return jsonb_build_object('result', 'not_entitled');
  end if;

  begin
    perform private.adjust_assert(
      jsonb_typeof(p_batch) = 'object' and p_batch ?& batch_keys
      and not exists (select 1 from jsonb_object_keys(p_batch) k where not k = any (batch_keys))
      and jsonb_typeof(p_batch -> 'plan_id') = 'string' and (p_batch ->> 'plan_id') ~ uuid_pattern
      and jsonb_typeof(p_batch -> 'trigger') = 'string'
      and jsonb_typeof(p_batch -> 'adjustments') = 'array'
      and jsonb_array_length(p_batch -> 'adjustments') between 0 and max_per_batch,
      'invalid_input');
    v_trigger := (p_batch ->> 'trigger')::public.adjustment_trigger;

    -- Aktiver eigener Plan, gesperrt (gleichzeitige Aufrufe derselben Person laufen nacheinander).
    select p.id, p.start_date, p.uses_health_data into v_plan_id, v_plan_start, v_plan_health
    from public.user_plans p
    where p.id = (p_batch ->> 'plan_id')::uuid and p.user_id = p_user and p.status = 'active'
    for update;
    perform private.adjust_assert(v_plan_id is not null, 'plan_changed');
    -- Belastungswochen bis zur Erholungswoche: aus Level und Gesundheits-Bezug des Plans (nie vom Aufrufer).
    load_weeks := private.plan_load_weeks(v_plan_id);
    perform private.adjust_assert(p_batch -> 'max_load_weeks' = to_jsonb(load_weeks), 'invalid_input');

    -- Betroffene Einheiten sperren, BEVOR geprüft wird, ob es einen Eintrag gibt (save_session_log sperrt die Einheit
    -- ebenfalls zuerst) – so kann kein Eintrag zwischen Prüfung und Schreiben entstehen (S1).
    perform 1
    from public.planned_sessions ps
    where ps.plan_id = v_plan_id
      and ps.id::text in (
        select jsonb_array_elements_text(x -> 'plannedSessionIds')
        from jsonb_array_elements(p_batch -> 'adjustments') x
        where jsonb_typeof(x -> 'plannedSessionIds') = 'array')
    order by ps.id
    for update;

    before_plan := private.plan_sessions_json(v_plan_id);
    cur := before_plan;
    existing_swapped := private.plan_swapped_weeks(v_plan_id, before_plan);

    for item in select value from jsonb_array_elements(p_batch -> 'adjustments') loop
      -- Feldliste (alle Pflicht, keine fremden) und Grundformen.
      perform private.adjust_assert(
        jsonb_typeof(item) = 'object' and item ?& adjustment_keys
        and not exists (select 1 from jsonb_object_keys(item) k where not k = any (adjustment_keys))
        and jsonb_typeof(item -> 'rule') = 'string' and rule_kinds ? (item ->> 'rule')
        and item ->> 'kind' = rule_kinds ->> (item ->> 'rule')
        and item -> 'requiresConfirmation' = to_jsonb(item ->> 'rule' = 'fewer_days')
        and jsonb_typeof(item -> 'inputFingerprint') = 'string' and (item ->> 'inputFingerprint') ~ fingerprint_pattern
        and private.jsonb_number_between(item -> 'engineVersion', 1, 32767, 0)
        and private.jsonb_number_between(item -> 'ruleVersion', 1, 32767, 0)
        and jsonb_typeof(item -> 'usesBodyData') = 'boolean'
        and jsonb_typeof(item -> 'fromHealthPlan') = 'boolean'
        and private.adjust_explain_params_valid(item -> 'explainParams')
        and jsonb_typeof(item -> 'effectiveFrom') = 'string' and (item ->> 'effectiveFrom') ~ date_pattern
        and (jsonb_typeof(item -> 'expiresOn') = 'null'
             or (jsonb_typeof(item -> 'expiresOn') = 'string' and (item ->> 'expiresOn') ~ date_pattern))
        and (jsonb_typeof(item -> 'basisSessionLogId') = 'null'
             or (jsonb_typeof(item -> 'basisSessionLogId') = 'string' and (item ->> 'basisSessionLogId') ~ uuid_pattern))
        and (jsonb_typeof(item -> 'basisPerformedOn') = 'null'
             or (jsonb_typeof(item -> 'basisPerformedOn') = 'string' and (item ->> 'basisPerformedOn') ~ date_pattern))
        and (jsonb_typeof(item -> 'exerciseId') = 'null'
             or (jsonb_typeof(item -> 'exerciseId') = 'string' and char_length(item ->> 'exerciseId') between 1 and 100))
        and jsonb_typeof(item -> 'plannedSessionIds') = 'array'
        and jsonb_array_length(item -> 'plannedSessionIds') <= max_sessions
        and not exists (select 1 from jsonb_array_elements(item -> 'plannedSessionIds') x
                        where jsonb_typeof(x) <> 'string' or (x #>> '{}') !~ uuid_pattern),
        'invalid_input');
      v_rule := item ->> 'rule';
      v_kind := item ->> 'kind';

      -- Idempotenz (unique user_id, rule, input_fingerprint): schon vorhanden bzw. doppelt im Aufruf → ok ohne Änderung.
      if exists (select 1 from public.plan_adjustments a
                 where a.user_id = p_user and a.rule = v_rule::public.adjustment_rule
                   and a.input_fingerprint = item ->> 'inputFingerprint')
         or exists (select 1 from jsonb_array_elements(items) x
                    where x ->> 'rule' = v_rule and x ->> 'inputFingerprint' = item ->> 'inputFingerprint') then
        duplicates := duplicates + 1;
        continue;
      end if;

      -- Gesundheits-Bezug setzt der Server (Plan mit Gesundheits-Check); Körperdaten nur mit gültiger Einwilligung.
      perform private.adjust_assert(
        (item -> 'fromHealthPlan')::boolean = v_plan_health
        and (not (item -> 'usesBodyData')::boolean or private.has_valid_consent_for(p_user, 'health_data')),
        'invalid_input');
      -- Frühestens morgen (S1).
      perform private.adjust_assert((item ->> 'effectiveFrom')::date > today, 'invalid_input');
      -- Basis-Eintrag gehört der Person (nur Vergleichswert, kein Fremdschlüssel).
      if jsonb_typeof(item -> 'basisSessionLogId') = 'string' then
        select sl.performed_on into basis_on
        from public.session_logs sl
        where sl.id = (item ->> 'basisSessionLogId')::uuid and sl.user_id = p_user;
        perform private.adjust_assert(
          found and (jsonb_typeof(item -> 'basisPerformedOn') = 'null'
                     or (item ->> 'basisPerformedOn')::date = basis_on),
          'invalid_input');
      else
        perform private.adjust_assert(jsonb_typeof(item -> 'basisPerformedOn') = 'null', 'invalid_input');
      end if;
      if jsonb_typeof(item -> 'exerciseId') = 'string' then
        perform private.adjust_assert(
          exists (select 1 from public.exercises x where x.id = item ->> 'exerciseId'), 'invalid_input');
      end if;

      if v_kind = 'state_override' then
        sb := item -> 'stateBefore';
        sa := item -> 'stateAfter';
        perform private.adjust_assert(
          jsonb_typeof(item -> 'exerciseId') = 'string'
          and jsonb_typeof(item -> 'basisSessionLogId') = 'string'
          and private.adjust_state_valid(sb) and private.adjust_state_valid(sa)
          and jsonb_typeof(item -> 'changeBefore') = 'null' and jsonb_typeof(item -> 'changeAfter') = 'null'
          and jsonb_array_length(item -> 'plannedSessionIds') = 0
          and jsonb_typeof(item -> 'expiresOn') = 'null'
          -- Gewicht nur zusammen mit Gewicht, Dauer nur zusammen mit Dauer.
          and jsonb_typeof(sb -> 'weightKg') = jsonb_typeof(sa -> 'weightKg')
          and jsonb_typeof(sb -> 'durationS') = jsonb_typeof(sa -> 'durationS'),
          'invalid_input');
        if v_rule = 'fast_increase' then
          -- Gewicht hoch höchstens um LOAD_PROGRESSION.maxIncreaseFraction, nie runter; Dauer unverändert. Genau EIN
          -- Schritt wie nextLoad() (Wächter B Auflage 3): Gewicht hoch (dann kein Zusatzsatz, Wdh. nicht höher),
          -- sonst Zusatzsatz an (Wdh. gleich), sonst höchstens +1 Wdh.; Wdh. nie über reps_max + Puffer des
          -- Basis-Eintrags. Vorher (= normaler Fortschritt) lässt sich ohne nextLoad() nicht nachrechnen; die Übung
          -- muss aber im Basis-Eintrag vorkommen.
          perform private.adjust_assert(
            (jsonb_typeof(sa -> 'weightKg') = 'null'
             or ((sa ->> 'weightKg')::numeric >= (sb ->> 'weightKg')::numeric
                 and (sa ->> 'weightKg')::numeric <= (sb ->> 'weightKg')::numeric * (1 + max_increase_fraction)))
            and sa -> 'durationS' = sb -> 'durationS'
            and exists (
              select 1 from public.exercise_logs el
              where el.session_log_id = (item ->> 'basisSessionLogId')::uuid
                and el.user_id = p_user
                and el.exercise_id = item ->> 'exerciseId'
                and (jsonb_typeof(sa -> 'targetReps') = 'null'
                     or (sa ->> 'targetReps')::integer <= coalesce(el.reps_max, 30) + extra_reps_buffer))
            and case
              when jsonb_typeof(sa -> 'weightKg') = 'number'
                   and (sa ->> 'weightKg')::numeric > (sb ->> 'weightKg')::numeric then
                (sa ->> 'extraSet')::boolean = false
                and (sa ->> 'targetReps')::integer <= coalesce((sb ->> 'targetReps')::integer, 30)
              when sa -> 'extraSet' <> sb -> 'extraSet' then
                (sa ->> 'extraSet')::boolean and sa -> 'targetReps' = sb -> 'targetReps'
              else
                sa -> 'targetReps' = sb -> 'targetReps'
                or (sa ->> 'targetReps')::integer = (sb ->> 'targetReps')::integer + 1
            end,
            'invalid_input');
        else
          -- load_reduce: Vorher = gespeicherter Zustand des Basis-Eintrags dieser Übung; Gewicht runter höchstens auf
          -- LIVE_ADJUSTMENT.loadReduce.factor × vorher, nie hoch; Halteübung × 0,9 (≥ 10 s); kein Zusatzsatz.
          perform private.adjust_assert(
            exists (
              select 1 from public.exercise_logs el
              where el.session_log_id = (item ->> 'basisSessionLogId')::uuid
                and el.user_id = p_user
                and el.exercise_id = item ->> 'exerciseId'
                and el.state_weight_kg is not distinct from (sb ->> 'weightKg')::numeric
                and el.state_target_reps is not distinct from (sb ->> 'targetReps')::smallint
                and el.state_extra_set is not distinct from (sb ->> 'extraSet')::boolean
                and el.state_duration_s is not distinct from (sb ->> 'durationS')::smallint)
            and (jsonb_typeof(sa -> 'weightKg') = 'null'
                 or ((sa ->> 'weightKg')::numeric <= (sb ->> 'weightKg')::numeric
                     and (sa ->> 'weightKg')::numeric >= (sb ->> 'weightKg')::numeric * load_reduce_factor))
            and (jsonb_typeof(sa -> 'durationS') = 'null'
                 or ((sa ->> 'durationS')::integer <= (sb ->> 'durationS')::integer
                     and (sa ->> 'durationS')::integer
                         >= least((sb ->> 'durationS')::integer,
                                  greatest(hold_min_s, floor((sb ->> 'durationS')::integer * load_reduce_factor)))))
            and (sa ->> 'extraSet')::boolean = false,
            'invalid_input');
        end if;
      elsif v_kind = 'plan_change' then
        perform private.adjust_assert(
          jsonb_typeof(item -> 'stateBefore') = 'null' and jsonb_typeof(item -> 'stateAfter') = 'null'
          and jsonb_typeof(item -> 'expiresOn') = 'null',
          'invalid_input');
        perform private.assert_plan_change(v_rule, item -> 'changeBefore', item -> 'changeAfter',
                                           item -> 'plannedSessionIds', cur);
        ids := array(select jsonb_array_elements_text(item -> 'plannedSessionIds')::uuid);
        -- Zulässige Einheiten (S1): eigener aktiver Plan, geplant, nach heute, ohne Tagebuch-Eintrag.
        perform private.adjust_assert(
          (select count(*) from public.planned_sessions ps
           where ps.id = any (ids) and ps.plan_id = v_plan_id and ps.user_id = p_user
             and ps.status = 'planned' and ps.scheduled_on > today) = cardinality(ids)
          and not exists (select 1 from public.session_logs sl where sl.planned_session_id = any (ids)),
          'not_eligible');
        -- Wirksam ab der frühesten betroffenen Einheit (nie vor morgen).
        perform private.adjust_assert(
          (item ->> 'effectiveFrom')::date
            <= (select min(ps.scheduled_on) from public.planned_sessions ps where ps.id = any (ids)),
          'invalid_input');
        if v_rule = 'deload_forward' then
          -- Kein Wettkampfplan (Präzisierung A Nr. 8); getauschte Woche D = eine Woche dieses Plans mit geänderten
          -- Einheiten; höchstens ein deload_forward je Block (auch zurückgenommene zählen, wie tryDeloadForward).
          perform private.adjust_assert(
            not exists (select 1 from jsonb_array_elements(cur) s where s ? 'training_phase'),
            'invalid_input');
          swap_monday := item -> 'explainParams' ->> 'swapped_week_start';
          select jsonb_build_object('blockNo', (s ->> 'block_no')::integer, 'weekNo', (s ->> 'week_no')::integer)
          into swap_week
          from jsonb_array_elements(cur) s
          where s ->> 'id' = any (ids::text[])
          group by (s ->> 'block_no')::integer, (s ->> 'week_no')::integer
          having date_trunc('week', min((s ->> 'scheduled_on')::date))::date::text = swap_monday
          limit 1;
          perform private.adjust_assert(swap_week is not null, 'invalid_input');
          perform private.adjust_assert(
            not exists (
              select 1 from public.plan_adjustments a
              join public.planned_sessions ps on ps.id = any (a.planned_session_ids)
              where a.plan_id = v_plan_id and a.rule = 'deload_forward'
                and a.status in ('applied', 'confirmed', 'reverted')
                and ps.block_no = (swap_week ->> 'blockNo')::integer)
            and not exists (select 1 from jsonb_array_elements(new_swapped) x
                            where x -> 'blockNo' = swap_week -> 'blockNo'),
            'invariant_violation');
          new_swapped := new_swapped || jsonb_build_array(swap_week);
          swap_week := null;
        end if;
        cur := private.apply_plan_change_json(cur, item -> 'changeAfter');
        first_effective := least(first_effective, (item ->> 'effectiveFrom')::date);
      else
        -- Vorschlag weniger Trainingstage (R5): Tage −1, Ablauf in höchstens proposalExpiresDays Tagen.
        perform private.adjust_assert(
          jsonb_typeof(item -> 'exerciseId') = 'null'
          and jsonb_typeof(item -> 'stateBefore') = 'null' and jsonb_typeof(item -> 'stateAfter') = 'null'
          and jsonb_array_length(item -> 'plannedSessionIds') = 0
          and jsonb_typeof(item -> 'changeBefore') = 'object' and jsonb_typeof(item -> 'changeAfter') = 'object'
          and not exists (select 1 from jsonb_object_keys(item -> 'changeBefore') k where not k = any (fewer_days_keys))
          and not exists (select 1 from jsonb_object_keys(item -> 'changeAfter') k where not k = any (fewer_days_keys))
          and private.jsonb_number_between(item -> 'changeBefore' -> 'days', 2, 7, 0)
          and private.jsonb_number_between(item -> 'changeAfter' -> 'days', 1, 6, 0)
          and (item -> 'changeAfter' ->> 'days')::integer = (item -> 'changeBefore' ->> 'days')::integer - 1
          and (not (item -> 'changeBefore') ? 'drop_weekday'
               or private.jsonb_number_between(item -> 'changeBefore' -> 'drop_weekday', 1, 7, 0))
          and (not (item -> 'changeAfter') ? 'drop_weekday'
               or private.jsonb_number_between(item -> 'changeAfter' -> 'drop_weekday', 1, 7, 0))
          and jsonb_typeof(item -> 'expiresOn') = 'string'
          and (item ->> 'expiresOn')::date between today + 1 and today + proposal_expires_days,
          'invalid_input');
      end if;
      if v_kind <> 'proposal' then
        automatic_new := automatic_new + 1;
      end if;
      items := items || jsonb_build_array(item);
    end loop;

    -- Höchstens LIVE_ADJUSTMENT.maxAutomaticPerWeek automatische Änderungen je Kalenderwoche (wie die Engine:
    -- angelegt in der Kalenderwoche von jetzt, auch zurückgenommene). Beide Seiten in Europe/Berlin; die Engine nimmt
    -- das Datum des Zeitstempels (UTC) – in der Stunde um Mitternacht kann der Server damit strenger sein (sicher).
    if automatic_new > 0 then
      select count(*) into automatic_existing
      from public.plan_adjustments a
      where a.user_id = p_user and not a.requires_confirmation
        and date_trunc('week', (a.created_at at time zone 'Europe/Berlin')::date)
            = date_trunc('week', (now() at time zone 'Europe/Berlin')::date);
      perform private.adjust_assert(automatic_existing + automatic_new <= max_automatic_per_week, 'weekly_limit');
    end if;

    -- Wochen-Invarianten über den Plan NACH allen Änderungen des Aufrufs – nur neu entstehende bzw. verschlimmerte
    -- Verstöße ab der Woche der frühesten Änderung (Wächter B2, wie die Schlussprüfung der Engine).
    if first_effective is not null then
      options := jsonb_build_object(
        'maxLoadWeeks', load_weeks, 'planStart', v_plan_start,
        'fromMonday', date_trunc('week', first_effective)::date);
      violations := private.new_week_invariant_violations(
        before_plan, cur,
        options || jsonb_build_object('swappedWeeks', existing_swapped || new_swapped),
        options || jsonb_build_object('swappedWeeks', existing_swapped));
      perform private.adjust_assert(jsonb_array_length(violations) = 0, 'invariant_violation');
    end if;

    -- Schreiben (Reihenfolge des Aufrufs; created_at = Uhrzeit je Anpassung, damit „neuer“ eindeutig ist).
    for item in select value from jsonb_array_elements(items) loop
      v_rule := item ->> 'rule';
      v_kind := item ->> 'kind';
      insert into public.plan_adjustments (
        user_id, plan_id, trigger, rule, kind, status, requires_confirmation, exercise_id, planned_session_ids,
        basis_session_log_id, basis_performed_on, state_before, state_after, change_before, change_after,
        explain_params, effective_from, expires_on, engine_version, rule_version, input_fingerprint, uses_body_data,
        from_health_plan, created_at, updated_at
      )
      values (
        p_user, v_plan_id, v_trigger, v_rule::public.adjustment_rule, v_kind::public.adjustment_kind,
        case when v_kind = 'proposal' then 'pending_confirmation' else 'applied' end::public.adjustment_status,
        v_kind = 'proposal', item ->> 'exerciseId',
        array(select jsonb_array_elements_text(item -> 'plannedSessionIds')::uuid order by 1),
        (item ->> 'basisSessionLogId')::uuid, (item ->> 'basisPerformedOn')::date,
        nullif(item -> 'stateBefore', 'null'::jsonb), nullif(item -> 'stateAfter', 'null'::jsonb),
        nullif(item -> 'changeBefore', 'null'::jsonb), nullif(item -> 'changeAfter', 'null'::jsonb),
        item -> 'explainParams', (item ->> 'effectiveFrom')::date, (item ->> 'expiresOn')::date,
        (item ->> 'engineVersion')::smallint, (item ->> 'ruleVersion')::smallint, item ->> 'inputFingerprint',
        (item ->> 'usesBodyData')::boolean, v_plan_health, clock_timestamp(), clock_timestamp()
      )
      returning id into new_id;
      applied := applied + 1;

      if v_kind = 'state_override' then
        -- Ältere Zustands-Vorgaben derselben Übung sind überholt.
        update public.plan_adjustments a
        set status = 'superseded'
        where a.user_id = p_user and a.kind = 'state_override' and a.exercise_id = item ->> 'exerciseId'
          and a.status = 'applied' and a.id <> new_id;
      elsif v_kind = 'plan_change' then
        for c in select value from jsonb_array_elements(item -> 'changeAfter' -> 'sessions') loop
          update public.planned_sessions ps
          set is_deload = case when c ? 'is_deload' then (c ->> 'is_deload')::boolean else ps.is_deload end,
              estimated_minutes = case when c ? 'estimated_minutes' then (c ->> 'estimated_minutes')::smallint
                                       else ps.estimated_minutes end,
              workout_steps = case when c ? 'workout_steps' then c -> 'workout_steps' else ps.workout_steps end,
              target_distance_m = case when c ? 'target_distance_m' then (c ->> 'target_distance_m')::integer
                                       else ps.target_distance_m end,
              adjustment_id = new_id
          where ps.id = (c ->> 'id')::uuid and ps.user_id = p_user;
          for ce in select value from jsonb_array_elements(coalesce(c -> 'exercises', '[]'::jsonb)) loop
            update public.planned_exercises pe
            set sets = case when ce ? 'sets' then (ce ->> 'sets')::smallint else pe.sets end,
                rpe_target = case when ce ? 'rpe_target' then (ce ->> 'rpe_target')::numeric else pe.rpe_target end,
                exercise_id = case when ce ? 'exercise_id' then ce ->> 'exercise_id' else pe.exercise_id end,
                exercise_name_de = case when ce ? 'exercise_name_de' then ce ->> 'exercise_name_de'
                                        else pe.exercise_name_de end,
                adjustment_id = new_id
            where pe.session_id = (c ->> 'id')::uuid and pe.user_id = p_user
              and pe.order_no = (ce ->> 'order_no')::smallint;
          end loop;
        end loop;
      end if;
    end loop;
  exception
    when raise_exception then
      get stacked diagnostics err = message_text;
      if err in ('invalid_input', 'plan_changed', 'not_eligible', 'weekly_limit', 'invariant_violation') then
        return jsonb_build_object('result', err);
      end if;
      return jsonb_build_object('result', 'invalid_input');
    -- Ohne Zeileninhalt (W10): ganze Fehlerklassen 22 und 23 als fester Code.
    when data_exception or integrity_constraint_violation then
      return jsonb_build_object('result', 'invalid_input');
  end;
  return jsonb_build_object('result', 'ok', 'applied', applied, 'duplicates', duplicates);
end;
$$;
revoke all on function public.apply_plan_adjustments(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_plan_adjustments(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Bestätigen bzw. Ablehnen eines Vorschlags (R5) – ohne Premium (Plan 4.6 Punkt 4)
-- ---------------------------------------------------------------------------------------------------------
-- Ergebnis: confirmed | declined | expired | not_pending | not_found. Ein Vorschlag eines gerade ersetzten Plans
-- (App: erst neuer Plan, dann bestätigen – Umsetzungsstand D Nr. 2) lässt sich noch confirm_after_replace_minutes
-- lang annehmen; danach verfällt er (private.expire_plan_adjustments).
create or replace function public.confirm_plan_adjustment(p_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirm_after_replace_minutes constant integer := 60;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  v_status public.adjustment_status;
  v_expires date;
  v_rule public.adjustment_rule;
  v_plan_status public.plan_status;
  v_replaced_at timestamptz;
  v_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null or p_accept is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  select a.status, a.expires_on, a.rule, p.status, p.replaced_at, p.id
  into v_status, v_expires, v_rule, v_plan_status, v_replaced_at, v_plan_id
  from public.plan_adjustments a
  join public.user_plans p on p.id = a.plan_id
  where a.id = p_id and a.user_id = current_user_id
  for update of a;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if v_status <> 'pending_confirmation' then
    return jsonb_build_object('result', 'not_pending');
  end if;
  if v_expires < today
     or (v_plan_status <> 'active'
         and not (p_accept and v_rule = 'fewer_days'
                  and v_replaced_at >= now() - make_interval(mins => confirm_after_replace_minutes)
                  -- nur der zuletzt ersetzte Plan (der neue aktive Plan setzt den Vorschlag um)
                  and not exists (select 1 from public.user_plans r
                                  where r.user_id = current_user_id and r.status = 'replaced'
                                    and r.replaced_at > v_replaced_at))) then
    update public.plan_adjustments a set status = 'expired', decided_at = now() where a.id = p_id;
    return jsonb_build_object('result', 'expired');
  end if;
  update public.plan_adjustments a
  set status = case when p_accept then 'confirmed' else 'declined' end::public.adjustment_status,
      decided_at = now()
  where a.id = p_id;
  return jsonb_build_object('result', case when p_accept then 'confirmed' else 'declined' end);
end;
$$;
revoke all on function public.confirm_plan_adjustment(uuid, boolean) from public, anon;
grant execute on function public.confirm_plan_adjustment(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Rückgängig (Plan 4.6 Punkt 5, canRevert() in packages/core/src/adjust/apply.ts) – ohne Premium
-- ---------------------------------------------------------------------------------------------------------
-- Ergebnis: reverted | not_revertible | invariant_violation | not_found.
-- - Nur `applied` ohne Bestätigungspflicht.
-- - Zustands-Vorgabe: nur, solange der neueste zählende Eintrag dieser Übung noch der Basis-Eintrag ist.
-- - Plan-Änderung (deload_forward nur als Ganzes): alle Einheiten noch geplant, ab morgen, ohne Eintrag; KEINE neuere
--   wirksame Plan-Änderung in denselben Wochen und die Einheiten stehen noch genau auf change_after (nur in
--   umgekehrter Reihenfolge); das Zurückschreiben erzeugt keinen NEUEN Verstoß der Wochen-Invarianten (ab der ersten
--   betroffenen Woche). Dann wird change_before zurückgeschrieben.
create or replace function public.revert_plan_adjustment(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  adj record;
  found_adj boolean := false;
  plan_ok boolean;
  v_plan_start date;
  sessions jsonb;
  reverted jsonb;
  own_weeks jsonb;
  first_monday date;
  options jsonb;
  latest_basis uuid;
  c jsonb;
  ce jsonb;
  k text;
  cur jsonb;
  cex jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Erst den Plan sperren (gleiche Reihenfolge wie apply_plan_adjustments), dann die Anpassung.
  perform 1
  from public.user_plans p
  join public.plan_adjustments a on a.plan_id = p.id
  where a.id = p_id and a.user_id = current_user_id
  for update of p;
  select a.* into adj
  from public.plan_adjustments a
  where a.id = p_id and a.user_id = current_user_id
  for update;
  found_adj := found;
  if not found_adj then
    return jsonb_build_object('result', 'not_found');
  end if;
  if adj.status <> 'applied' or adj.requires_confirmation then
    return jsonb_build_object('result', 'not_revertible');
  end if;

  if adj.kind = 'state_override' then
    -- Neuester zählender Eintrag der Übung (isCountingEntry: ohne Einstiegs-/Erholungswoche, Wiedereinstieg, frei;
    -- ohne „nicht gemacht“), Reihenfolge wie compareEntries (Datum, dann Zeitpunkt).
    select el.session_log_id into latest_basis
    from public.exercise_logs el
    join public.session_logs sl on sl.id = el.session_log_id
    where el.user_id = current_user_id and el.exercise_id = adj.exercise_id and el.status <> 'skipped'
      and not sl.is_free and not sl.is_intro_week and not sl.is_deload and not el.is_return
    order by sl.performed_on desc, coalesce(sl.finished_at, sl.client_updated_at) desc
    limit 1;
    if latest_basis is distinct from adj.basis_session_log_id then
      return jsonb_build_object('result', 'not_revertible');
    end if;
  else
    select p.status = 'active', p.start_date into plan_ok, v_plan_start
    from public.user_plans p where p.id = adj.plan_id;
    perform 1 from public.planned_sessions ps where ps.id = any (adj.planned_session_ids) order by ps.id for update;
    if not plan_ok
       or (select count(*) from public.planned_sessions ps
           where ps.id = any (adj.planned_session_ids) and ps.plan_id = adj.plan_id
             and ps.status = 'planned' and ps.scheduled_on > today) <> cardinality(adj.planned_session_ids)
       or exists (select 1 from public.session_logs sl where sl.planned_session_id = any (adj.planned_session_ids)) then
      return jsonb_build_object('result', 'not_revertible');
    end if;
    sessions := private.plan_sessions_json(adj.plan_id);
    -- Wochen (Block:Woche) der eigenen Einheiten.
    select jsonb_agg(distinct (s ->> 'block_no') || ':' || (s ->> 'week_no')) into own_weeks
    from jsonb_array_elements(sessions) s
    where (s ->> 'id')::uuid = any (adj.planned_session_ids);
    -- Neuere wirksame Plan-Änderung in denselben Wochen → erst diese zurücknehmen.
    if exists (
      select 1
      from public.plan_adjustments o
      join public.planned_sessions ps on ps.id = any (o.planned_session_ids)
      where o.plan_id = adj.plan_id and o.id <> adj.id and o.kind = 'plan_change'
        and o.status in ('applied', 'confirmed') and o.created_at > adj.created_at
        and own_weeks ? (ps.block_no || ':' || ps.week_no)
    ) then
      return jsonb_build_object('result', 'not_revertible');
    end if;
    -- Einheiten stehen noch genau auf change_after (stillAsAfter).
    for c in select value from jsonb_array_elements(adj.change_after -> 'sessions') loop
      select value into cur from jsonb_array_elements(sessions) where value ->> 'id' = c ->> 'id';
      if cur is null then
        return jsonb_build_object('result', 'not_revertible');
      end if;
      foreach k in array array['is_deload', 'estimated_minutes', 'workout_steps'] loop
        if c ? k and c -> k is distinct from coalesce(cur -> k, 'null'::jsonb) then
          return jsonb_build_object('result', 'not_revertible');
        end if;
      end loop;
      for ce in select value from jsonb_array_elements(coalesce(c -> 'exercises', '[]'::jsonb)) loop
        select value into cex from jsonb_array_elements(cur -> 'exercises') where value -> 'order_no' = ce -> 'order_no';
        if cex is null then
          return jsonb_build_object('result', 'not_revertible');
        end if;
        foreach k in array array['sets', 'rpe_target', 'exercise_id'] loop
          if ce ? k and ce -> k is distinct from cex -> k then
            return jsonb_build_object('result', 'not_revertible');
          end if;
        end loop;
        cex := null;
      end loop;
      cur := null;
    end loop;
    -- Wochen-Invarianten nach dem Zurückschreiben: nur neu entstehende Verstöße ab der ersten betroffenen Woche.
    reverted := private.apply_plan_change_json(sessions, adj.change_before);
    select min(date_trunc('week', (s ->> 'scheduled_on')::date))::date into first_monday
    from jsonb_array_elements(sessions) s
    where own_weeks ? ((s ->> 'block_no') || ':' || (s ->> 'week_no'));
    options := jsonb_build_object('maxLoadWeeks', private.plan_load_weeks(adj.plan_id), 'planStart', v_plan_start,
                                  'fromMonday', first_monday);
    if jsonb_array_length(private.new_week_invariant_violations(
         sessions, reverted,
         options || jsonb_build_object('swappedWeeks', private.plan_swapped_weeks(adj.plan_id, sessions, adj.id)),
         options || jsonb_build_object('swappedWeeks', private.plan_swapped_weeks(adj.plan_id, sessions)))) > 0 then
      return jsonb_build_object('result', 'invariant_violation');
    end if;
    -- change_before zurückschreiben; das Kennzeichen dieser Anpassung entfällt.
    for c in select value from jsonb_array_elements(adj.change_before -> 'sessions') loop
      update public.planned_sessions ps
      set is_deload = case when c ? 'is_deload' then (c ->> 'is_deload')::boolean else ps.is_deload end,
          estimated_minutes = case when c ? 'estimated_minutes' then (c ->> 'estimated_minutes')::smallint
                                   else ps.estimated_minutes end,
          workout_steps = case when c ? 'workout_steps' then c -> 'workout_steps' else ps.workout_steps end,
          target_distance_m = case when c ? 'target_distance_m' then (c ->> 'target_distance_m')::integer
                                   else ps.target_distance_m end,
          adjustment_id = case when ps.adjustment_id = adj.id then null else ps.adjustment_id end
      where ps.id = (c ->> 'id')::uuid and ps.user_id = current_user_id;
      for ce in select value from jsonb_array_elements(coalesce(c -> 'exercises', '[]'::jsonb)) loop
        update public.planned_exercises pe
        set sets = case when ce ? 'sets' then (ce ->> 'sets')::smallint else pe.sets end,
            rpe_target = case when ce ? 'rpe_target' then (ce ->> 'rpe_target')::numeric else pe.rpe_target end,
            exercise_id = case when ce ? 'exercise_id' then ce ->> 'exercise_id' else pe.exercise_id end,
            exercise_name_de = case when ce ? 'exercise_name_de' then ce ->> 'exercise_name_de'
                                    else pe.exercise_name_de end,
            adjustment_id = case when pe.adjustment_id = adj.id then null else pe.adjustment_id end
        where pe.session_id = (c ->> 'id')::uuid and pe.user_id = current_user_id
          and pe.order_no = (ce ->> 'order_no')::smallint;
      end loop;
    end loop;
  end if;

  -- Zurückgenommen: input_fingerprint bleibt belegt (dieselbe Lage feuert nicht erneut).
  update public.plan_adjustments a set status = 'reverted', decided_at = now() where a.id = adj.id;
  return jsonb_build_object('result', 'reverted');
exception
  when data_exception or integrity_constraint_violation then
    return jsonb_build_object('result', 'not_revertible');
end;
$$;
revoke all on function public.revert_plan_adjustment(uuid) from public, anon;
grant execute on function public.revert_plan_adjustment(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Ereignisse holen und abschließen; Ablauf und Aufräumen
-- ---------------------------------------------------------------------------------------------------------
-- Ablauf und Aufräumen (Plan 4.6 Punkt 9): Vorschläge nach expires_on bzw. eines seit über einer Stunde ersetzten
-- Plans → expired; Ereignisse nach 30 Tagen, Zähler nach 24 h, admin_actions nach 1 Jahr gelöscht. Nur Zahlen zurück.
create or replace function private.expire_plan_adjustments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: LIVE_ADJUSTMENT.eventRetentionDays (30), Zähler 24 h, admin_actions 1 Jahr (Plan 4.4); Annahme nach
  -- Planwechsel 60 min (confirm_plan_adjustment)
  event_retention_days constant integer := 30;
  count_retention_hours constant integer := 24;
  admin_retention_days constant integer := 365;
  confirm_after_replace_minutes constant integer := 60;
  today date := private.berlin_today();
  n_expired integer;
  n_events integer;
  n_counts integer;
  n_admin integer;
begin
  update public.plan_adjustments a
  set status = 'expired', decided_at = now()
  from public.user_plans p
  where p.id = a.plan_id
    and a.status = 'pending_confirmation'
    and (a.expires_on < today
         or (p.status <> 'active' and p.replaced_at < now() - make_interval(mins => confirm_after_replace_minutes)));
  get diagnostics n_expired = row_count;
  delete from private.adjustment_events e where e.created_at < now() - make_interval(days => event_retention_days);
  get diagnostics n_events = row_count;
  delete from private.live_adjust_hourly_counts c
  where c.hour_start < now() - make_interval(hours => count_retention_hours);
  get diagnostics n_counts = row_count;
  delete from private.admin_actions a where a.created_at < now() - make_interval(days => admin_retention_days);
  get diagnostics n_admin = row_count;
  return jsonb_build_object('expired', n_expired, 'events_deleted', n_events, 'counts_deleted', n_counts,
                            'admin_actions_deleted', n_admin);
end;
$$;
revoke all on function private.expire_plan_adjustments() from public, anon, authenticated;

-- Offene Ereignisse übernehmen (parallele Läufe sicher: for update skip locked + Sperrfrist claimed_at). Mit p_user
-- (Sofort-Anstoß der App) zuerst die Ratenbegrenzung (geteilter Zähler, Wächter S3): über
-- LIVE_ADJUSTMENT.recompute.maxPerUserPerHour → { rate_limited: true } ohne Ereignisse. Der Sweep (p_user null)
-- zählt nicht und ruft zuerst private.expire_plan_adjustments() auf. Ab 5 Fehlversuchen bleibt ein Ereignis stehen.
create or replace function public.claim_adjustment_events(p_user uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: LIVE_ADJUSTMENT.recompute.maxPerUserPerHour in packages/core/src/constants.ts
  max_per_user_per_hour constant integer := 20;
  max_attempts constant integer := 5;
  claim_lease_minutes constant integer := 5;
  max_limit constant integer := 500;
  calls integer;
  events jsonb;
begin
  if p_limit is null or p_limit not between 1 and max_limit then
    raise exception 'Ungültige Eingabe.' using errcode = 'invalid_parameter_value';
  end if;
  if p_user is not null then
    insert into private.live_adjust_hourly_counts as c (user_id, hour_start, count)
    values (p_user, date_trunc('hour', now()), 1)
    on conflict (user_id, hour_start) do update set count = least(c.count + 1, 32767)
    returning c.count into calls;
    if calls > max_per_user_per_hour then
      return jsonb_build_object('rate_limited', true, 'events', '[]'::jsonb);
    end if;
  else
    perform private.expire_plan_adjustments();
  end if;
  with picked as (
    select e.id
    from private.adjustment_events e
    where (p_user is null or e.user_id = p_user)
      and e.attempts < max_attempts
      and (e.claimed_at is null or e.claimed_at < now() - make_interval(mins => claim_lease_minutes))
    order by e.created_at, e.id
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update private.adjustment_events e
    set attempts = e.attempts + 1, claimed_at = now()
    from picked
    where e.id = picked.id
    returning e.id, e.user_id, e.trigger, e.ref_id, e.created_at, e.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'user_id', c.user_id, 'trigger', c.trigger, 'ref_id', c.ref_id, 'created_at', c.created_at,
           'attempts', c.attempts) order by c.created_at, c.id), '[]'::jsonb)
  into events
  from claimed c;
  return jsonb_build_object('rate_limited', false, 'events', events);
end;
$$;
revoke all on function public.claim_adjustment_events(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_adjustment_events(uuid, integer) to service_role;

-- Abschluss: ohne Fehlercode verarbeitet → gelöscht; mit festem Fehlercode (kein Inhalt) → bleibt für den nächsten
-- Versuch (Sperrfrist aufgehoben). Ergebnis: Anzahl betroffener Ereignisse.
create or replace function public.mark_adjustment_events_processed(p_ids bigint[], p_error_code text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_ids is null or cardinality(p_ids) > 500
     or (p_error_code is not null and p_error_code !~ '^[a-z][a-z0-9_]{0,39}$') then
    raise exception 'Ungültige Eingabe.' using errcode = 'invalid_parameter_value';
  end if;
  if p_error_code is null then
    delete from private.adjustment_events e where e.id = any (p_ids);
  else
    update private.adjustment_events e
    set last_error_code = p_error_code, claimed_at = null
    where e.id = any (p_ids);
  end if;
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.mark_adjustment_events_processed(bigint[], text) from public, anon, authenticated;
grant execute on function public.mark_adjustment_events_processed(bigint[], text) to service_role;

-- Stündlicher Lauf von Ablauf und Aufräumen (pg_cron, Minute 41) zusätzlich zum Sweep – nur, wenn die Erweiterung
-- verfügbar ist (Supabase: ja; lokales Postgres ohne pg_cron: übersprungen). Wie N7 Teil 2 und E4a.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule('live-adjust-maintenance', '41 * * * *', 'select private.expire_plan_adjustments()');
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet (SQLSTATE %) – Ablauf und Aufräumen laufen über den Sweep.', sqlstate;
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Ablauf und Aufräumen laufen über den Sweep.';
  end if;
end;
$cron$;

-- ---------------------------------------------------------------------------------------------------------
-- 7. beta_admin – neueste Fassung (20261017100000_food_products.sql) unverändert übernommen; neu: Flag
--    live_adjustment (Freischalten/Entziehen = dieselbe Premium-Freischaltung) und sein Status (nur Zahlen ohne
--    Personenbezug: Flag, aktive Freischaltungen, offene Ereignisse, Fehlversuche ≥ 5, Anpassungen je Regel in den
--    letzten 7 Tagen). Antwort ohne E-Mail und user_id, jede Aktion in private.admin_actions (Wächter B1, S-n2).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.live_adjust_status_admin()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'result', 'status',
    'flag', 'live_adjustment',
    'flag_enabled', private.feature_enabled('live_adjustment'),
    'active_grants', (select count(*) from private.beta_entitlements b where b.expires_at > now()),
    'open_events', (select count(*) from private.adjustment_events e where e.attempts < 5),
    'failed_events', (select count(*) from private.adjustment_events e where e.attempts >= 5),
    'adjustments_7d', (select coalesce(jsonb_object_agg(x.rule, x.n), '{}'::jsonb)
                       from (select a.rule, count(*) as n from public.plan_adjustments a
                             where a.created_at >= now() - interval '7 days' group by a.rule) x))
$$;
revoke all on function private.live_adjust_status_admin() from public, anon, authenticated;

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
