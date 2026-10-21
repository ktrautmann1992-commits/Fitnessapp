-- Phase 6 · Etappe SU3 (docs/PLAN-PHASE-6.md 7.2, 7.3, 11.1) · Supplement-Check, „Meine Supplements“ und
-- Einwilligung health_data Fassung 2. Rein additiv:
-- 1. consent_documents: Text health_data Version 2 als ENTWURF (published_at NULL). Er wird erst nach der
--    juristischen Prüfung veröffentlicht (Plan 11.1/16: „v2 in Produktion erst nach juristischer Prüfung“) – mit einer
--    eigenen kleinen Migration `update … set published_at = now()` (docs/HANDY-ANLEITUNG.md, Supplemente). Bis dahin
--    bleibt Version 1 gültig, NIEMAND verliert eine Einwilligung, und Supplement-Check sowie „Meine Supplements“
--    lassen sich in der Datenbank nicht speichern (die App bleibt im Info-Modus mit allgemeinen Hinweisen).
-- 2. private.require_supplement_consent(): gültige Einwilligung health_data in der AKTUELLEN Fassung UND mindestens
--    Fassung 2 (SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION); sperrt die eigene Einwilligung FOR SHARE (wie weight_goals) –
--    ein gleichzeitiger Widerruf wartet und löscht danach.
-- 3. supplement_screening (eine Zeile je Person, SENSIBEL): Antworten { frage: true/false, protein_self_check? },
--    Flags berechnet die Datenbank selbst (Trigger = evaluateSupplementScreening, db-sync.test.ts). Lesen nur die
--    eigene Zeile, Schreiben nur über save_supplement_screening.
-- 4. user_supplements („Meine Supplements“, SENSIBEL): je Person und Supplement „Nehme ich“/„Nicht für mich“
--    (kein Koffein). Lesen nur eigene Zeilen, Schreiben nur über set_user_supplement.
-- 5. delete_my_supplement_data(): Supplement-Check und „Meine Supplements“ löschen – geht immer, auch ohne
--    Einwilligung (Recht auf Löschung).
-- 6./7. Widerruf health_data löscht beide Tabellen; Export enthält beide (Obermengen der neuesten Fassungen
--    20261021120200_wearable_revoke_export.sql – Vereinigung mit Phase 8 Smartwatch).
-- Konto löschen: Kaskade über auth.users. Klick-Zähler und Shops (SU5) kommen erst mit der Affiliate-Etappe.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Einwilligungstext health_data Version 2 (ENTWURF, unveröffentlicht)
-- Wörtlich gleich apps/mobile/src/data/consent-texts.ts (consent-texts.test.ts). CURRENT_CONSENT_VERSIONS.health_data
-- = 2 (höchste Fassung im Seed); der Supabase-Modus liest die gültige Fassung aus der Datenbank (nur veröffentlichte).
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'health_data',
  2,
  'Einwilligung in die Verarbeitung von Gesundheitsdaten',
  $txt$ENTWURF – juristisch prüfen

Damit wir deine Pläne sicher und passend erstellen können, möchten wir folgende Gesundheitsdaten von dir speichern und verarbeiten:
- Körperdaten: Größe, Gewicht, optional Körperfettanteil und Ruhepuls – jeweils mit Messdatum, auch frühere Messungen,
- Körperumfänge (z. B. Oberarm, Brust, Schulter, Taille, Bauch, Hüfte, Oberschenkel, Wade) – optional, mit Messdatum,
- deine Antworten im Gesundheits-Check (z. B. Herz-Kreislauf, Schwangerschaft, Beschwerden, Medikamente), die daraus abgeleiteten Hinweise (z. B. „vorsichtiger Plan“) und den Verlauf früherer Checks,
- Lebensmittel-Unverträglichkeiten,
- deine Antworten im Supplement-Check (Nieren, Stillzeit, Herzrhythmus, Empfindlichkeit für Koffein, optional deine Einschätzung, ob du dein Eiweißziel über das Essen schaffst),
- deine Auswahl unter „Meine Supplements“ („Nehme ich“ oder „Nicht für mich“).

Wofür: ausschließlich zur Berechnung deiner Trainings- und Ernährungspläne (z. B. Kalorienbedarf, vorsichtigere Pläne bei gesundheitlichen Auffälligkeiten) und für Supplement-Hinweise – auch, um Shop-Links auszublenden, wenn eine Ergänzung bei deinen Angaben nicht passt. Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner. Shops und Partnernetzwerke erhalten keine dieser Angaben.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App auch ohne diese Einwilligung nutzen. Dann erhältst du nur allgemeine Pläne ohne Körperdaten und ohne Gesundheits-Check und bei Supplementen nur allgemeine Informationen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle oben genannten Daten – Körperdaten, Körperumfänge, alle Gesundheits-Checks samt Verlauf, Unverträglichkeiten, den Supplement-Check und „Meine Supplements“. Deine übrigen Angaben (z. B. Ziel, Ernährungsform, Vorlieben, Mess-Erinnerung) bleiben erhalten. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.

Neue Fassung: Ändern wir diesen Text, fragen wir dich erneut. Bis du zustimmst, bleiben deine bisherigen Daten sichtbar, können aber nicht ergänzt oder geändert werden.$txt$,
  null
)
on conflict (consent_type, version) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. private.require_supplement_consent()
-- ---------------------------------------------------------------------------------------------------------
create function private.require_supplement_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: SUPPLEMENT_HEALTH_CONSENT_MIN_VERSION in packages/core/src/constants.ts (db-sync.test.ts)
  min_version constant integer := 2;
begin
  -- Eigene aktive Einwilligung sperren (Wächter Z3 M1): Ein gleichzeitiger Widerruf wartet auf das Speichern und
  -- löscht danach (consents_after_revoke) – nie bleibt ein Supplement-Check ohne Einwilligung zurück.
  perform 1 from public.consents c
  where c.user_id = auth.uid() and c.consent_type = 'health_data' and c.revoked_at is null
  for share;
  if not public.has_valid_consent('health_data')
     or coalesce(public.current_consent_version('health_data'), 0) < min_version then
    raise exception 'Einwilligung Gesundheitsdaten (Fassung 2) fehlt.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function private.require_supplement_consent() from public;

-- ---------------------------------------------------------------------------------------------------------
-- 3. supplement_screening
-- ---------------------------------------------------------------------------------------------------------
create table public.supplement_screening (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- { kidney, breastfeeding?, heart_rhythm, caffeine_sensitive: true/false, protein_self_check?: 'mostly_yes'|'rather_not' }
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  -- Berechnet (Trigger), Reihenfolge wie SUPPLEMENT_FLAGS.
  flags public.supplement_flag[] not null default '{}' check (
    array_position(flags, null) is null and private.has_distinct_elements(flags)
  ),
  -- Fassung der Fragen (SUPPLEMENT_SCREENING_VERSION).
  version smallint not null check (version between 1 and 100),
  updated_at timestamptz not null default now()
);

comment on table public.supplement_screening is
  'SENSIBEL (Art. 9 DSGVO). Supplement-Check (Plan 3.4): nur mit Einwilligung health_data Fassung 2, Schreiben nur '
  'über save_supplement_screening; Löschung beim Widerruf, im Export.';

-- Die Datenbank prüft die Antworten selbst (wie createSupplementScreeningAnswersSchema: strikt, Stillzeit nicht bei
-- „männlich“, sonst Pflicht) und berechnet die Flags (wie evaluateSupplementScreening). Vom Client gesendete Flags und
-- Zeitpunkte werden überschrieben. Fehlermeldungen enthalten keine Antworten.
create function private.supplement_screening_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: SUPPLEMENT_FLAGS / SUPPLEMENT_SCREENING_QUESTIONS (packages/core/src/supplements/screening.ts)
  flag_questions constant text[] := array['kidney', 'breastfeeding', 'heart_rhythm', 'caffeine_sensitive'];
  -- sync: PROTEIN_SELF_CHECK_ANSWERS
  protein_answers constant text[] := array['mostly_yes', 'rather_not'];
  answer_key text;
  person_sex text;
begin
  if jsonb_typeof(new.answers) is distinct from 'object' then
    raise exception 'Ungültige Antworten im Supplement-Check.' using errcode = 'check_violation';
  end if;
  for answer_key in select jsonb_object_keys(new.answers) loop
    if answer_key = 'protein_self_check' then
      if jsonb_typeof(new.answers -> answer_key) is distinct from 'string'
         or not (new.answers ->> answer_key) = any (protein_answers) then
        raise exception 'Ungültige Antworten im Supplement-Check.' using errcode = 'check_violation';
      end if;
    elsif not answer_key = any (flag_questions)
       or jsonb_typeof(new.answers -> answer_key) is distinct from 'boolean' then
      raise exception 'Ungültige Antworten im Supplement-Check.' using errcode = 'check_violation';
    end if;
  end loop;
  foreach answer_key in array array['kidney', 'heart_rhythm', 'caffeine_sensitive'] loop
    if not new.answers ? answer_key then
      raise exception 'Der Supplement-Check ist unvollständig.' using errcode = 'check_violation';
    end if;
  end loop;
  select p.sex::text into person_sex from public.profiles p where p.user_id = new.user_id;
  if person_sex = 'male' and new.answers ? 'breastfeeding' then
    raise exception 'Ungültige Antworten im Supplement-Check.' using errcode = 'check_violation';
  end if;
  if person_sex is distinct from 'male' and not new.answers ? 'breastfeeding' then
    raise exception 'Der Supplement-Check ist unvollständig.' using errcode = 'check_violation';
  end if;

  new.flags := array(
    select q::public.supplement_flag
    from unnest(flag_questions) with ordinality as t(q, n)
    where coalesce((new.answers ->> q)::boolean, false)
    order by n
  );
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.supplement_screening_before_write() from public;

create trigger supplement_screening_before_write
  before insert or update on public.supplement_screening
  for each row execute function private.supplement_screening_before_write();

alter table public.supplement_screening enable row level security;
revoke all on table public.supplement_screening from public, anon, authenticated;
grant select on table public.supplement_screening to authenticated;
grant all on table public.supplement_screening to service_role;

create policy "Nutzer sehen den eigenen Supplement-Check"
  on public.supplement_screening for select to authenticated
  using (user_id = (select auth.uid()));

-- save_supplement_screening(p_answers) → {"flags": [...]}: ersetzt den eigenen Check (eine Zeile je Person).
create function public.save_supplement_screening(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: SUPPLEMENT_SCREENING_VERSION in packages/core/src/constants.ts (db-sync.test.ts)
  screening_version constant smallint := 1;
  current_user_id uuid := auth.uid();
  saved public.supplement_flag[];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  perform private.require_supplement_consent();
  insert into public.supplement_screening as cur (user_id, answers, version)
  values (current_user_id, p_answers, screening_version)
  on conflict (user_id) do update set answers = excluded.answers, version = excluded.version
  returning cur.flags into saved;
  return jsonb_build_object('flags', to_jsonb(saved));
end;
$$;

revoke all on function public.save_supplement_screening(jsonb) from public, anon;
grant execute on function public.save_supplement_screening(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. user_supplements („Meine Supplements“)
-- ---------------------------------------------------------------------------------------------------------
create table public.user_supplements (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Koffein ist nur eine Sicherheits-Info – nie „Nehme ich“ (B2.3).
  supplement_id public.supplement_id not null check (supplement_id <> 'caffeine'),
  status public.user_supplement_status not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, supplement_id)
);

comment on table public.user_supplements is
  'SENSIBEL (Art. 9 DSGVO). „Meine Supplements“ (SU-G8): nur mit Einwilligung health_data Fassung 2, Schreiben nur '
  'über set_user_supplement; Löschung beim Widerruf, im Export.';

alter table public.user_supplements enable row level security;
revoke all on table public.user_supplements from public, anon, authenticated;
grant select on table public.user_supplements to authenticated;
grant all on table public.user_supplements to service_role;

create policy "Nutzer sehen die eigenen Supplements"
  on public.user_supplements for select to authenticated
  using (user_id = (select auth.uid()));

-- set_user_supplement(p_supplement_id, p_status): setzt „taking“/„not_for_me“; p_status NULL = Auswahl entfernen
-- (geht immer, auch ohne Einwilligung – Recht auf Löschung).
create function public.set_user_supplement(p_supplement_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_supplement_id is null or p_supplement_id = 'caffeine'
     or not p_supplement_id = any (enum_range(null::public.supplement_id)::text[]) then
    raise exception 'Unbekanntes Supplement.' using errcode = 'invalid_parameter_value';
  end if;
  if p_status is null then
    delete from public.user_supplements
    where user_id = current_user_id and supplement_id = p_supplement_id::public.supplement_id;
    return;
  end if;
  if not p_status = any (enum_range(null::public.user_supplement_status)::text[]) then
    raise exception 'Ungültige Auswahl.' using errcode = 'invalid_parameter_value';
  end if;
  perform private.require_supplement_consent();
  insert into public.user_supplements as cur (user_id, supplement_id, status)
  values (current_user_id, p_supplement_id::public.supplement_id, p_status::public.user_supplement_status)
  on conflict (user_id, supplement_id) do update set status = excluded.status, updated_at = now();
end;
$$;

revoke all on function public.set_user_supplement(text, text) from public, anon;
grant execute on function public.set_user_supplement(text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. delete_my_supplement_data(): Check und Auswahl löschen (immer erlaubt)
-- ---------------------------------------------------------------------------------------------------------
create function public.delete_my_supplement_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.supplement_screening where user_id = current_user_id;
  delete from public.user_supplements where user_id = current_user_id;
end;
$$;

revoke all on function public.delete_my_supplement_data() from public, anon;
grant execute on function public.delete_my_supplement_data() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6. Widerruf (Obermenge der neuesten Fassung 20261021120200_wearable_revoke_export.sql, Phase 8 Smartwatch):
--    zusätzlich supplement_screening und user_supplements beim Widerruf health_data, am Anfang und in der Wiederholung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    -- 4b (PLAN-PHASE-4B 4.7): ZUERST alle Plan-Anpassungen aus Gesundheits-Plänen bzw. mit Körperdaten (mittelbare
    -- Gesundheitsdaten); die übrigen Anpassungen dieser Pläne fallen danach per Kaskade mit den Plänen weg. Ereignisse
    -- zu Messungen und Zielen (nur Verweise; Ziele inkl. Wunschgewicht – sichere Voreinstellung) gehen ebenfalls.
    delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);
    delete from private.adjustment_events
    where user_id = new.user_id and trigger in ('measurement_updated', 'goal_changed');
    perform private.neutralize_health_plan_logs(new.user_id);
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    -- Supplement-Modul (Phase 6 SU3, Plan 7.3/11.1): Supplement-Check und „Meine Supplements“ ganz gelöscht.
    delete from public.supplement_screening where user_id = new.user_id;
    delete from public.user_supplements where user_id = new.user_id;
    -- Wunschgewicht (Ziele Z3, docs/PLAN-ZIELE.md 5.2): Gesundheitsdatum, ganz gelöscht.
    delete from public.weight_goals where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    -- Wettkämpfe (Phase 10 WP3): nur den aus dem Gesundheits-Check abgeleiteten Plan-Bezug leeren.
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    -- Ernährungstagebuch (E1, A-G12): alle Einträge. Favoriten: Schnell-Favoriten enthalten Bezeichnung + kcal
    -- („Süßes 250 kcal“) und gehen mit (Wächter E1 G1, sichere Voreinstellung); Katalog-/Rezept-Favoriten speichern
    -- keine Werte (S1) und bleiben (A-G14).
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';
    -- E4a (E4-G10): Produkt-Favoriten (Marken verraten Konsum) und eigene Produkte (Name/Marke sind Freitext) –
    -- sichere Voreinstellung wie Schnell-Favoriten und eigene Gerichte. Favoriten eigener Produkte gehen zusätzlich per
    -- Kaskade mit. Der gemeinsame Zwischenspeicher food_products enthält nichts von der Person.
    delete from public.food_log_favorites where user_id = new.user_id and source = 'product';
    delete from public.user_food_products where user_id = new.user_id;
    -- Einkaufen E1 (PLAN-EINKAUFEN-AUSDAUER 3): gelernte Zuordnungen Strichcode → Lebensmittel verraten Konsum wie
    -- Produkt-Favoriten (E4a) – sichere Voreinstellung: ganz gelöscht.
    delete from public.shopping_product_links where user_id = new.user_id;
    -- Eigene Gerichte (E2): Name ist Freitext, Werte selbst eingegeben – sichere Voreinstellung wie die
    -- Schnell-Favoriten (Wächter E1 G1): gelöscht, Zutaten per Kaskade (Gründer-Frage E2-G1 im Plan).
    delete from public.custom_meals where user_id = new.user_id;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
    -- Ebenso Pläne, Listen und Tagebuch (Wächter N7 S2): Die speichernden Funktionen sperren die Einwilligung FOR
    -- SHARE, der Widerruf wartet also auf sie; jede Anweisung sieht danach den neuesten Stand. Die Wiederholung fängt
    -- zusätzlich ab, was während der Lösch-Anweisungen oben fertig geworden ist.
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.custom_meals where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'product';
    delete from public.user_food_products where user_id = new.user_id;
    delete from public.shopping_product_links where user_id = new.user_id;
    delete from public.weight_goals where user_id = new.user_id;
    delete from public.supplement_screening where user_id = new.user_id;
    delete from public.user_supplements where user_id = new.user_id;
    delete from public.plan_adjustments where user_id = new.user_id and (uses_body_data or from_health_plan);
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
  end if;
  -- Phase 8 (Smartwatch, W8-5/W8-12): Widerruf von wearable_data ODER health_data löscht Pulsdaten, Tageswerte und die
  -- Verbindung sofort. Übernommene Einheiten bleiben als normale Tagebuch-Einträge ohne Puls (wearable_sessions bleibt,
  -- wie „Trennen – behalten“). import_wearable_batch sperrt beide Einwilligungen FOR SHARE – der Widerruf wartet also
  -- auf einen laufenden Abgleich und sieht danach dessen Zeilen.
  if new.consent_type in ('health_data', 'wearable_data') then
    delete from public.heart_rate_summaries where user_id = new.user_id;
    delete from public.daily_metrics where user_id = new.user_id;
    delete from public.wearable_connections where user_id = new.user_id;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;
revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- 7. Datenexport (Obermenge der neuesten Fassung 20261021120200_wearable_revoke_export.sql): zusätzlich
--    supplement_screening und user_supplements.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'format_version', 1,
    'exported_at', now(),
    'user_id', current_user_id,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id = current_user_id),
      'consents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.granted_at), '[]'::jsonb) from public.consents t where t.user_id = current_user_id),
      'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t where t.user_id = current_user_id),
      'body_measurements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_measurements t where t.user_id = current_user_id),
      'measurement_reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measurement_reminders t where t.user_id = current_user_id),
      'health_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.health_screening t where t.user_id = current_user_id),
      'goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id = current_user_id),
      'user_equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_equipment t where t.user_id = current_user_id),
      'training_slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_slots t where t.user_id = current_user_id),
      'nutrition_prefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.nutrition_prefs t where t.user_id = current_user_id),
      'food_preferences', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_preferences t where t.user_id = current_user_id),
      'admin_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_users t where t.user_id = current_user_id),
      'user_plans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_plans t where t.user_id = current_user_id),
      'planned_sessions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_sessions t where t.user_id = current_user_id),
      'planned_exercises', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_exercises t where t.user_id = current_user_id),
      'session_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.performed_on), '[]'::jsonb) from public.session_logs t where t.user_id = current_user_id),
      'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_logs t where t.user_id = current_user_id),
      'set_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.set_logs t where t.user_id = current_user_id),
      'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cardio_logs t where t.user_id = current_user_id),
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id),
      'meal_plans', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.meal_plans t where t.user_id = current_user_id),
      'meal_plan_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.date, t.slot), '[]'::jsonb) from public.meal_plan_items t where t.user_id = current_user_id),
      'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.shopping_lists t where t.user_id = current_user_id),
      'shopping_list_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shopping_list_items t where t.user_id = current_user_id),
      'recipe_ratings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.recipe_ratings t where t.user_id = current_user_id),
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id),
      'food_log_entries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.eaten_on, t.created_at), '[]'::jsonb) from public.food_log_entries t where t.user_id = current_user_id),
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id),
      'custom_meals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.custom_meals t where t.user_id = current_user_id),
      'custom_meal_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.meal_id, t.order_no), '[]'::jsonb) from public.custom_meal_items t where t.user_id = current_user_id),
      'competitions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.race_date, t.created_at), '[]'::jsonb) from public.competitions t where t.user_id = current_user_id),
      -- Etappe E3: KI-Nutzung (nur Metadaten) und die eigene Beta-Freischaltung (private Tabelle, ohne granted_by).
      'ai_usage', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.ai_usage t where t.user_id = current_user_id),
      'beta_entitlements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from private.my_beta_entitlements() t),
      -- Wächter E3 N4: Protokoll der eigenen Freischaltungen/Entzüge (ohne Admin-Identität `actor`).
      'admin_actions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_admin_actions() t),
      -- Phase 10 S1: eigene Strecken (vereinfachte Linie, Kilometerzeiten; GPX je Strecke erzeugt die App).
      'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb) from public.tracked_routes t where t.user_id = current_user_id),
      -- Etappe E4a: eigene Produkte und die eigenen Abfrage-Zähler (Stunde, Anzahl – ohne Nummern). Der gemeinsame
      -- Zwischenspeicher food_products gehört niemandem und kommt nicht in den Export.
      'user_food_products', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.user_food_products t where t.user_id = current_user_id),
      'food_product_lookup_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_food_product_lookup_counts() t),
      -- Ziele Z3: Wunschgewicht (Gesundheitsdatum; das Nebenziel steht als Spalte in goals).
      'weight_goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.weight_goals t where t.user_id = current_user_id),
      -- Phase 4b Etappe B (PLAN-PHASE-4B 4.7): Plan-Anpassungen, offene Ereignisse der Live-Anpassung (Auslöser und
      -- Zeitpunkte, ohne Verweise) und die eigenen Zähler der Ratenbegrenzung (private Tabellen, Art. 15). Die eigene
      -- Beta-Freischaltung steht seit E3 unter beta_entitlements.
      'plan_adjustments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.plan_adjustments t where t.user_id = current_user_id),
      'adjustment_events', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_adjustment_events() t),
      'live_adjust_hourly_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_live_adjust_hourly_counts() t),
      -- Einkaufen E1 (PLAN-EINKAUFEN-AUSDAUER 3): gelernte Zuordnungen Strichcode → Lebensmittel.
      'shopping_product_links', (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at, t.code), '[]'::jsonb) from public.shopping_product_links t where t.user_id = current_user_id),
      -- Etappe E2 (PLAN-EINKAUFEN-AUSDAUER 4): Anordnung der Übersicht und der Menüleiste.
      'app_layout_settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_layout_settings t where t.user_id = current_user_id),
      -- Phase 8 (Smartwatch, PLAN-PHASE-8 4): Verbindung, übernommene Einheiten, Puls-Zusammenfassungen, Tageswerte.
      'wearable_connections', (select coalesce(jsonb_agg(to_jsonb(t) order by t.provider), '[]'::jsonb) from public.wearable_connections t where t.user_id = current_user_id),
      'wearable_sessions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.session_log_id), '[]'::jsonb) from public.wearable_sessions t where t.user_id = current_user_id),
      'heart_rate_summaries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.session_log_id), '[]'::jsonb) from public.heart_rate_summaries t where t.user_id = current_user_id),
      'daily_metrics', (select coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.provider), '[]'::jsonb) from public.daily_metrics t where t.user_id = current_user_id),
      -- Phase 6 SU3 (Plan 7.3): Supplement-Check und „Meine Supplements“ (Gesundheitsdaten, Art. 9).
      'supplement_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.supplement_screening t where t.user_id = current_user_id),
      'user_supplements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.supplement_id), '[]'::jsonb) from public.user_supplements t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
