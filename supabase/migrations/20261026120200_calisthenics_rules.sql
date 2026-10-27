-- Calisthenics · Regeln in der Datenbank (docs/PLAN-CALISTHENICS-SCHLINGE.md 2). Nur additiv:
--  1. plan_templates.goal_type: Vorlagen mit dem Ziel 'calisthenics' sind erlaubt (= TEMPLATE_GOAL_TYPES). Heute
--     liegen nur ENTWÜRFE im Repository – in der Datenbank steht nie ein Entwurf; der CHECK macht das spätere
--     Einspielen nach der Freigabe möglich.
--  2. private.goal_pair_allowed: neues Paar Calisthenics → Abnehmen (= GOAL_PAIR_RULES). Neueste Fassung aus
--     20261021150100_active_aging_rules.sql unverändert übernommen und nur ergänzt; Autoclear-Trigger und Paar-CHECK
--     auf goals nutzen die Funktion und gelten damit sofort mit.

alter table public.plan_templates drop constraint if exists plan_templates_goal_type_check;
alter table public.plan_templates
  add constraint plan_templates_goal_type_check
  check (goal_type in ('muscle_gain', 'fat_loss', 'general_fitness', 'calisthenics'));

create or replace function private.goal_pair_allowed(p_primary public.goal_type, p_secondary public.goal_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_primary::text, p_secondary::text) in (
    ('fat_loss', 'muscle_gain'),
    ('fat_loss', 'endurance'),
    ('definition', 'endurance'),
    ('muscle_gain', 'fat_loss'),
    ('muscle_gain', 'endurance'),
    ('general_fitness', 'fat_loss'),
    ('general_fitness', 'endurance'),
    ('endurance', 'fat_loss'),
    ('endurance', 'definition'),
    ('endurance', 'muscle_gain'),
    ('active_aging', 'fat_loss'),
    ('calisthenics', 'fat_loss')
  )
$$;

revoke all on function private.goal_pair_allowed(public.goal_type, public.goal_type) from public;
grant execute on function private.goal_pair_allowed(public.goal_type, public.goal_type) to authenticated, service_role;
