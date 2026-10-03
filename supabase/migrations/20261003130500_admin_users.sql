-- Phase 2 · Wer darf in den Redaktionsbereich (/admin)? Erst ab Login Stufe B (Supabase) benutzt
-- (docs/PLAN-PHASE-2.md Abschnitt 6). Enthält nur Konto-ID und Rolle, keine Gesundheitsdaten.
--
-- RLS: Jeder angemeldete Nutzer sieht höchstens die EIGENE Zeile (damit der Server prüfen kann, ob das Konto
-- Admin ist). Eintragen/Löschen nur service_role (Workflow admin-grant oder Supabase Table Editor).

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.admin_role not null default 'content_admin',
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;
grant all on table public.admin_users to service_role;

create policy "Nutzer sehen nur die eigene Admin-Zeile"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));
