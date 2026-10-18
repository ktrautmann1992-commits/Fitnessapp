-- Phase 4b · Etappe B · Live-Anpassung des Plans – Tabellen und Spalten (docs/PLAN-PHASE-4B.md 4.4, 4.5). Nur additiv:
-- 1. Prüf-Hilfen für CHECKs (Zustands-Vorgabe = ExerciseProgress, Erklär-Parameter ohne Freitext),
-- 2. public.plan_adjustments – RLS: nur eigene Zeilen LESEN; schreiben nur über die Funktionen der übernächsten
--    Migration (apply_plan_adjustments nur service_role, confirm/revert für authenticated),
-- 3. planned_sessions.adjustment_id und planned_exercises.adjustment_id (Kennzeichen „angepasst“; für authenticated
--    NICHT änderbar – die Spalten-Rechte bleiben scheduled_on, status),
-- 4. private.adjustment_events (Ereignis-Liste/Outbox, nur Premium, ohne Werte), private.live_adjust_hourly_counts
--    (geteilter Zähler der Ratenbegrenzung, Wächter S3) – beide nur service_role,
-- 5. Feature-Flag live_adjustment (AUS) in private.feature_flags (E3).
-- Konto löschen: Kaskade über auth.users (admin_actions.target_user_id → set null, schon seit E3).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Prüf-Hilfen (immutable, nie ein Fehler)
-- ---------------------------------------------------------------------------------------------------------

-- Zustands-Vorgabe = ExerciseProgress (stateOverrideSchema in packages/core/src/adjust/schemas.ts): genau die Schlüssel
-- weightKg, targetReps, extraSet, durationS; Grenzen wie state_* in exercise_logs (PLANNED_LOAD_LIMITS,
-- TEMPLATE_DOSAGE_LIMITS).
create or replace function private.adjust_state_valid(p_state jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_state) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p_state) k)
        = array['durationS', 'extraSet', 'targetReps', 'weightKg']
    and (jsonb_typeof(p_state -> 'weightKg') = 'null'
         or private.jsonb_number_between(p_state -> 'weightKg', 0.5, 500, 2))
    and (jsonb_typeof(p_state -> 'targetReps') = 'null'
         or private.jsonb_number_between(p_state -> 'targetReps', 3, 30, 0))
    and jsonb_typeof(p_state -> 'extraSet') = 'boolean'
    and (jsonb_typeof(p_state -> 'durationS') = 'null'
         or private.jsonb_number_between(p_state -> 'durationS', 10, 120, 0)),
    false)
$$;
revoke all on function private.adjust_state_valid(jsonb) from public, anon;
grant execute on function private.adjust_state_valid(jsonb) to authenticated, service_role;

-- Erklär-Parameter (explainParamsSchema): höchstens 20 Schlüssel `^[a-z][a-z_]{0,30}$`, Werte nur Zahlen oder Codes
-- bzw. Datumsangaben bzw. Übungs-IDs `^[a-z0-9][a-z0-9_-]{0,99}$` – kein Freitext.
create or replace function private.adjust_explain_params_valid(p_params jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_params) = 'object'
    and (select count(*) from jsonb_object_keys(p_params)) <= 20
    and not exists (
      select 1 from jsonb_each(p_params) e
      where e.key !~ '^[a-z][a-z_]{0,30}$'
         or not (jsonb_typeof(e.value) = 'number'
                 or (jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^[a-z0-9][a-z0-9_-]{0,99}$'))
    ),
    false)
$$;
revoke all on function private.adjust_explain_params_valid(jsonb) from public, anon;
grant execute on function private.adjust_explain_params_valid(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. plan_adjustments
-- ---------------------------------------------------------------------------------------------------------
create table public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Plan der Anpassung; fällt der Plan weg (Widerruf, Aufräumen der 20 neuesten), gehen seine Anpassungen mit.
  plan_id uuid not null,
  trigger public.adjustment_trigger not null,
  rule public.adjustment_rule not null,
  kind public.adjustment_kind not null,
  status public.adjustment_status not null,
  requires_confirmation boolean not null default false,
  exercise_id text references public.exercises (id) on update cascade on delete restrict,
  -- Betroffene Einheiten (≤ LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment = 42, Umsetzungsstand A Nr. 11).
  planned_session_ids uuid[] not null default '{}' check (
    cardinality(planned_session_ids) <= 42 and array_position(planned_session_ids, null) is null
  ),
  -- Nur Vergleichswert (KEIN Fremdschlüssel): Einheit des neuesten zählenden Eintrags bei der Berechnung.
  basis_session_log_id uuid,
  basis_performed_on date,
  state_before jsonb check (state_before is null or private.adjust_state_valid(state_before)),
  state_after jsonb check (state_after is null or private.adjust_state_valid(state_after)),
  -- Vorher/Nachher je Regel (Schlüssel prüft apply_plan_adjustments streng). Höchstens 32 KB: Ein Tausch bei 7
  -- Trainingstagen ändert bis zu 42 Einheiten mit je bis zu 8 Übungen (Präzisierung zu „≤ 4 KB“ im Plan).
  change_before jsonb check (
    change_before is null or (jsonb_typeof(change_before) = 'object' and octet_length(change_before::text) <= 32768)
  ),
  change_after jsonb check (
    change_after is null or (jsonb_typeof(change_after) = 'object' and octet_length(change_after::text) <= 32768)
  ),
  explain_params jsonb not null default '{}' check (private.adjust_explain_params_valid(explain_params)),
  effective_from date not null,
  expires_on date,
  engine_version smallint not null check (engine_version >= 1),
  rule_version smallint not null check (rule_version >= 1),
  -- Idempotenz: Hash der Eingaben (inputFingerprint in packages/core/src/adjust/fingerprint.ts).
  input_fingerprint text not null check (input_fingerprint ~ '^[a-z_]+:[0-9a-f]{16}$'),
  -- Setzt nur der Server: Regel hat Körperdaten gelesen (in 4b keine aktive Regel) bzw. Plan mit Gesundheits-Check.
  uses_body_data boolean not null,
  from_health_plan boolean not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, rule, input_fingerprint),
  foreign key (plan_id, user_id) references public.user_plans (id, user_id) on delete cascade,
  -- Plan 4.4: Zustands-Vorgabe ⇔ Übung und Vorgabe gesetzt.
  check ((kind = 'state_override') = (exercise_id is not null and state_after is not null)),
  check (kind = 'state_override' or (state_before is null and state_after is null)),
  check (kind <> 'state_override' or (state_before is not null and change_before is null and change_after is null)),
  check (kind = 'state_override' or (change_before is not null and change_after is not null)),
  -- Bestätigung nur bei Vorschlägen; offener Vorschlag braucht Bestätigung; Ablaufdatum nur bei Vorschlägen.
  check (status <> 'pending_confirmation' or requires_confirmation),
  check (requires_confirmation = (kind = 'proposal')),
  check ((expires_on is not null) = (kind = 'proposal')),
  check (status not in ('confirmed', 'declined', 'reverted', 'expired') or decided_at is not null)
);

comment on table public.plan_adjustments is
  'Live-Anpassungen des Plans (Phase 4b, Premium, ohne KI). TEILWEISE SENSIBEL: Anpassungen mit from_health_plan oder '
  'uses_body_data gelten als mittelbare Gesundheitsdaten und werden beim Widerruf health_data gelöscht. Nur lesen; '
  'schreiben nur über apply_plan_adjustments (Server), confirm_plan_adjustment und revert_plan_adjustment.';

create index plan_adjustments_user_created_idx on public.plan_adjustments (user_id, created_at desc);
create index plan_adjustments_plan_id_idx on public.plan_adjustments (plan_id);
create index plan_adjustments_exercise_id_idx on public.plan_adjustments (exercise_id) where exercise_id is not null;

create trigger plan_adjustments_set_updated_at
  before update on public.plan_adjustments
  for each row execute function private.set_updated_at();

alter table public.plan_adjustments enable row level security;
revoke all on table public.plan_adjustments from anon, authenticated;
grant select on table public.plan_adjustments to authenticated;
grant all on table public.plan_adjustments to service_role;

create policy "Nutzer sehen eigene Plan-Anpassungen"
  on public.plan_adjustments for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 3. Kennzeichen „angepasst“ an Einheiten und Übungen (Plan 4.4). Spalten-Rechte für authenticated unverändert
--    (planned_sessions: nur scheduled_on, status; planned_exercises: nur lesen).
-- ---------------------------------------------------------------------------------------------------------
alter table public.planned_sessions add column adjustment_id uuid;
alter table public.planned_sessions
  add constraint planned_sessions_adjustment_fkey foreign key (adjustment_id, user_id)
  references public.plan_adjustments (id, user_id) on delete set null (adjustment_id);
create index planned_sessions_adjustment_id_idx on public.planned_sessions (adjustment_id)
  where adjustment_id is not null;

alter table public.planned_exercises add column adjustment_id uuid;
alter table public.planned_exercises
  add constraint planned_exercises_adjustment_fkey foreign key (adjustment_id, user_id)
  references public.plan_adjustments (id, user_id) on delete set null (adjustment_id);
create index planned_exercises_adjustment_id_idx on public.planned_exercises (adjustment_id)
  where adjustment_id is not null;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Ereignis-Liste und Zähler der Ratenbegrenzung (nur service_role, RLS an ohne Policies)
-- ---------------------------------------------------------------------------------------------------------
-- Entsteht NUR bei Premium (Flag an und Freischaltung, Wächter S2) über private.enqueue_adjustment_event. Keine Werte,
-- nur Verweise. Ein Ereignis je (Person, Auslöser, Verweis) – auch ohne Verweis (nulls not distinct). Verarbeitete
-- Ereignisse werden sofort gelöscht (daher kein processed_at), alte spätestens nach 30 Tagen.
create table private.adjustment_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger public.adjustment_trigger not null,
  ref_id uuid,
  created_at timestamptz not null default now(),
  -- Zeitpunkt der letzten Übernahme durch claim_adjustment_events (Sperrfrist gegen parallele Läufe).
  claimed_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 100),
  -- Fester Fehlercode der Route, kein Inhalt.
  last_error_code text check (last_error_code ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint adjustment_events_one unique nulls not distinct (user_id, trigger, ref_id)
);
comment on table private.adjustment_events is
  'Ereignis-Liste der Live-Anpassung (nur Premium, nur Verweise, keine Werte). Nur service_role.';
create index adjustment_events_open_idx on private.adjustment_events (created_at) where attempts < 5;

create table private.live_adjust_hourly_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  hour_start timestamptz not null,
  count smallint not null check (count >= 1),
  primary key (user_id, hour_start)
);
comment on table private.live_adjust_hourly_counts is
  'Geteilter Zähler der Ratenbegrenzung von POST /api/live-anpassung (Wächter S3). Aufräumen nach 24 h.';

alter table private.adjustment_events enable row level security;
alter table private.live_adjust_hourly_counts enable row level security;
revoke all on table private.adjustment_events, private.live_adjust_hourly_counts from public, anon, authenticated;
grant all on table private.adjustment_events, private.live_adjust_hourly_counts to service_role;
revoke all on sequence private.adjustment_events_id_seq from public, anon, authenticated;
grant all on sequence private.adjustment_events_id_seq to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 5. Feature-Flag live_adjustment (AUS; geschaltet über den Workflow beta-grant)
-- ---------------------------------------------------------------------------------------------------------
alter table private.feature_flags drop constraint feature_flags_key_check;
alter table private.feature_flags
  add constraint feature_flags_key_check check (key in ('ai_food_photo', 'food_product_lookup', 'live_adjustment'));
insert into private.feature_flags (key, enabled) values ('live_adjustment', false)
on conflict (key) do nothing;
