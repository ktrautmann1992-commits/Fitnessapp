-- Phase 4b · Nachtrag zu Etappe B · R1-Ausschlüsse auf dem Server (docs/PLAN-PHASE-4B.md 5.2 „Nie bei“, Frage 5,
-- Umsetzungsstand B „Nachtrag R1-Ausschlüsse“). Nur additiv:
--  1. private.fast_increase_exclusion(uid, Plan, Stichtag) – Grund, warum R1 `fast_increase` ausgeschlossen ist, oder
--     null. Gleiche Liste wie fastIncreaseExclusion() / FAST_INCREASE_EXCLUSIONS in
--     packages/core/src/adjust/rules/state-rules.ts (db-sync.test.ts): vorsichtiger Plan, unter 18, ab 65, Einsteiger
--     im ersten Block. Bei fehlenden Daten (kein Profil, kein Plan) gilt die Person als ausgeschlossen (sicher).
--  2. public.apply_plan_adjustments – neueste Fassung aus 20261018200300_live_adjust_rpcs.sql, nur ergänzt: enthält
--     der Aufruf ein fast_increase und ist die Person ausgeschlossen, lehnt der Server den GANZEN Aufruf mit dem festen
--     Code `not_allowed` ab (ohne Änderung, ohne Zeileninhalt). Rechte, search_path und alle Prüfungen unverändert.

-- ---------------------------------------------------------------------------------------------------------
-- 1. R1-Ausschluss je Person und Plan
-- ---------------------------------------------------------------------------------------------------------
-- „Vorsichtig“ = strengste Lesart aus Plan UND aktuellem Stand: wie private.plan_load_weeks (Plan ohne Gesundheitsbezug
-- oder mit Arzt-Hinweis) und wie planSafetyRules().cautious, das Core mit dem AKTUELLEN Gesundheits-Check rechnet
-- (keine gültige Einwilligung, kein Check oder ein Flag). Alter in vollendeten Jahren am Stichtag (age() rechnet
-- kalendarisch wie ageInYears(), 29.02. → 01.03.). Einsteiger: Stufe aus den Angaben des Plans (planSnapshot); die
-- „aktuelle“ Einheit ist die erste ab dem Stichtag, sonst die letzte des Plans (gleiches Datum: kleinster Block).
create or replace function private.fast_increase_exclusion(p_user uuid, p_plan_id uuid, p_today date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  -- sync: AGE_PLAN_RULES.minor.belowAge, AGE_PLAN_RULES.senior.fromAge in packages/core/src/constants.ts
  minor_below_age constant integer := 18;
  senior_from_age constant integer := 65;
  -- sync: EXPERIENCE_LEVELS ohne 'beginner' (packages/core/src/enums.ts); unbekannte Stufe zählt als Einsteiger.
  non_beginner_levels constant text[] := array['advanced', 'competitive'];
  v_plan record;
  latest_flags text[];
  age_years integer;
  current_on date;
  current_block integer;
begin
  select p.uses_health_data, p.medical_notice, p.inputs ->> 'experienceLevel' as level
  into v_plan
  from public.user_plans p
  where p.id = p_plan_id and p.user_id = p_user;
  if not found then
    return 'cautious_plan';
  end if;

  -- Vorsichtiger Plan (Gesundheits-Flag oder kein Check).
  if not v_plan.uses_health_data or v_plan.medical_notice then
    return 'cautious_plan';
  end if;
  select h.flags into latest_flags
  from public.health_screening h
  where h.user_id = p_user
  order by h.created_at desc
  limit 1;
  if not found or cardinality(latest_flags) > 0
     or not private.has_valid_consent_for(p_user, 'health_data') then
    return 'cautious_plan';
  end if;

  -- Alter am Stichtag (kein Profil → wie unter 18 behandelt, sicher).
  select extract(year from age(p_today, pr.birth_date))::integer into age_years
  from public.profiles pr
  where pr.user_id = p_user;
  if age_years is null or age_years < minor_below_age then
    return 'minor';
  end if;
  if age_years >= senior_from_age then
    return 'senior';
  end if;

  -- Einsteiger im ersten Block.
  if v_plan.level is null or not v_plan.level = any (non_beginner_levels) then
    select coalesce(min(s.scheduled_on) filter (where s.scheduled_on >= p_today), max(s.scheduled_on))
    into current_on
    from public.planned_sessions s
    where s.plan_id = p_plan_id;
    select min(s.block_no) into current_block
    from public.planned_sessions s
    where s.plan_id = p_plan_id and s.scheduled_on = current_on;
    if current_block is null or current_block <= 1 then
      return 'beginner_first_block';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.fast_increase_exclusion(uuid, uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. apply_plan_adjustments – nur service_role; Fassung aus 20261018200300 plus R1-Ausschluss
-- ---------------------------------------------------------------------------------------------------------
-- p_batch = { plan_id, trigger, max_load_weeks, adjustments: [AdjustmentProposal …] } (Feldnamen wie
-- adjustmentProposalSchema). Ergebnis: { result: ok, applied, duplicates } oder ein fester Code ohne Änderung:
-- not_entitled, invalid_input, plan_changed, not_eligible, weekly_limit, invariant_violation.
-- Neu (R1-Ausschlüsse): not_allowed – fast_increase für eine ausgeschlossene Person (private.fast_increase_exclusion).
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
  r1_checked boolean := false;
  r1_exclusion text;
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
      -- R1 nie bei vorsichtigem Plan, unter 18, ab 65, Einsteigern im ersten Block (wie fastIncreaseExclusion() in
      -- Core): ein fast_increase einer ausgeschlossenen Person lehnt den GANZEN Aufruf ab (auch als Duplikat).
      if v_rule = 'fast_increase' then
        if not r1_checked then
          r1_exclusion := private.fast_increase_exclusion(p_user, v_plan_id, today);
          r1_checked := true;
        end if;
        perform private.adjust_assert(r1_exclusion is null, 'not_allowed');
      end if;

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
      if err = 'not_allowed' then
        return jsonb_build_object('result', err);
      end if;
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
