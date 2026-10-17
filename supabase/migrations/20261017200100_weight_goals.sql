-- Ziele · Etappe Z3 (docs/PLAN-ZIELE.md 5.2, Wächter S13, S15, K7, K9, Z2 K-5): konkretes Abnehmziel
-- („Wunschgewicht“) als eigene Tabelle. Gesundheitsdatum (Art. 9 DSGVO): nur mit Einwilligung health_data, RLS wie
-- body_metrics, beim Widerruf gelöscht (consents_after_revoke in 20261017200200_weight_goals_revoke_export.sql).
-- Nur additiv: neue, leere Tabelle.
-- - Eine Zeile je Nutzer. Kein Startgewicht (Wächter K9, Datensparsamkeit: wäre eine Kopie aus body_metrics).
-- - start_date = Tag des Speicherns, bei JEDEM Speichern neu (Wächter S15) – deshalb hält der Datums-CHECK auch beim
--   Verlängern nach Ablauf. Die App setzt ihn (Zod, weightGoalSchema in packages/core).
-- - CHECKs exakt wie weightGoalSchema (Wächter Z2 K-5): numeric(4,1), 30–300 kg (BODY_METRIC_LIMITS.weightKg),
--   Zeitraum 28–728 Tage (WEIGHT_GOAL_DAYS = 4–104 Wochen), Modi = WEIGHT_GOAL_AMOUNT_MODES / WEIGHT_GOAL_TIME_MODES.
-- - Nur mit Abnehmziel (Wächter S13, Art. 5 Abs. 1 c): BEFORE-Trigger auf weight_goals; Trigger auf goals löscht das
--   Wunschgewicht, sobald Abnehmen weder Haupt- noch Nebenziel ist bzw. die Zeile gelöscht wird.
-- - Ziel-BMI prüfen Zod beim Speichern sowie Engine und Ampel bei jeder Rechnung mit der neuesten Größe (Wächter S14,
--   F8); ein unzulässiges Ziel wird ignoriert und lockert keine Grenze (F5) – kein DB-Trigger dafür.
-- - Kein Partner-Modus (Wächter K7): weight_goals bleibt auch bei freigegebener „Ernährung“ privat.
-- Fehlermeldungen: feste deutsche Texte ohne Werte.

create table public.weight_goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  target_weight_kg numeric(4, 1) not null check (target_weight_kg between 30 and 300),
  -- Nie vor 2026-01-01 (= WEIGHT_GOAL_START_DATE_MIN, Wächter Z3 N1).
  start_date date not null check (start_date >= date '2026-01-01'),
  target_date date not null,
  amount_mode text not null check (amount_mode in ('kg_to_lose', 'target_weight')),
  time_mode text not null check (time_mode in ('weeks', 'date')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date between start_date + 28 and start_date + 728)
);

comment on table public.weight_goals is
  'SENSIBEL (Art. 9 DSGVO). Nur mit Einwilligung health_data; wird beim Widerruf gelöscht. Nur mit Abnehmziel; nie im Partner-Modus.';

alter table public.weight_goals enable row level security;

revoke all on table public.weight_goals from anon, authenticated;
grant select, insert, update, delete on table public.weight_goals to authenticated;
grant all on table public.weight_goals to service_role;

create policy "Nutzer sehen eigenes Wunschgewicht"
  on public.weight_goals
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer speichern eigenes Wunschgewicht nur mit Einwilligung"
  on public.weight_goals
  for insert
  to authenticated
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));

create policy "Nutzer ändern eigenes Wunschgewicht nur mit Einwilligung"
  on public.weight_goals
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_valid_consent('health_data'));

create policy "Nutzer löschen eigenes Wunschgewicht"
  on public.weight_goals
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create trigger weight_goals_set_updated_at
  before update on public.weight_goals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- Einwilligung gesperrt, dann nur mit Abnehmziel (Wächter S13, Wächter Z3 M1).
-- 1. Die eigene gültige Einwilligung health_data wird FOR SHARE gesperrt und danach erneut geprüft (Muster
--    private.food_log_favorites_before_write, Wächter N7 S2): Ein gleichzeitiger Widerruf wartet auf dieses Speichern
--    und löscht das Wunschgewicht danach (consents_after_revoke); kommt der Widerruf zuerst, wird hier abgelehnt. Die
--    RLS-Prüfung allein sähe die Einwilligung noch im alten Stand.
-- 2. Abnehmen muss Haupt- oder Nebenziel der goals-Zeile DESSELBEN Nutzers sein; die Zeile wird FOR SHARE gesperrt,
--    damit ein gleichzeitiges Ändern des Ziels wartet und dessen Lösch-Trigger danach das neue Wunschgewicht sieht.
-- security definer (Sperren ohne eigene Schreibrechte auf consents); Schreiben deshalb nur als der Nutzer selbst
-- (new.user_id = auth.uid()), wie die RLS-Policies.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.weight_goals_require_fat_loss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.consents c
  where c.user_id = new.user_id and c.consent_type = 'health_data' and c.revoked_at is null
  order by c.id
  for share;
  if new.user_id is distinct from auth.uid() or not public.has_valid_consent('health_data') then
    raise exception 'Einwilligung Gesundheitsdaten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1
    from public.goals g
    where g.user_id = new.user_id
      and (g.goal_type = 'fat_loss' or g.secondary_goal_type is not distinct from 'fat_loss')
    for share
  ) then
    raise exception 'Ein Wunschgewicht gibt es nur beim Ziel Abnehmen.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.weight_goals_require_fat_loss() from public, anon, authenticated;

create trigger weight_goals_require_fat_loss
  before insert or update on public.weight_goals
  for each row execute function private.weight_goals_require_fat_loss();

-- ---------------------------------------------------------------------------------------------------------
-- Datensparsamkeit (Wächter S13): Ist Abnehmen nach einer Änderung weder Haupt- noch Nebenziel bzw. ist die
-- goals-Zeile gelöscht, wird das Wunschgewicht gelöscht. security definer: gilt auch für Änderungen über
-- service_role oder Funktionen; Rechte des Eigentümers (umgeht RLS), betroffen ist nur die Zeile desselben Nutzers.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.goals_drop_weight_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.weight_goals where user_id = old.user_id;
    return null;
  end if;
  if not (new.goal_type = 'fat_loss' or new.secondary_goal_type is not distinct from 'fat_loss') then
    delete from public.weight_goals where user_id = new.user_id;
  end if;
  -- Falls die Zeile den Nutzer wechselt (praktisch nie): das Ziel des bisherigen Nutzers gehört nicht mehr dazu.
  if new.user_id is distinct from old.user_id then
    delete from public.weight_goals where user_id = old.user_id;
  end if;
  return null;
end;
$$;

revoke all on function private.goals_drop_weight_goal() from public;

create trigger goals_drop_weight_goal
  after update or delete on public.goals
  for each row execute function private.goals_drop_weight_goal();
