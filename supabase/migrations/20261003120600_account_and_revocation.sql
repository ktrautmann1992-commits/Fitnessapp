-- Phase 1 · Widerruf der Gesundheits-Einwilligung und Konto löschen (Recht auf Löschung, Art. 17 DSGVO).

-- Widerruf von health_data → alle Körper- und Gesundheitsdaten des Nutzers sofort löschen:
-- body_metrics, body_measurements, health_screening und Unverträglichkeiten in food_preferences
-- (Plan Abschnitt 5, Punkt 4). Die Mess-Erinnerung (measurement_reminders) enthält keine Gesundheitswerte
-- und bleibt bestehen.
-- security definer, weil Nutzer health_screening selbst nicht löschen dürfen (Verlauf).
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;

create trigger consents_after_revoke
  after update of revoked_at on public.consents
  for each row
  when (old.revoked_at is null and new.revoked_at is not null)
  execute function private.consents_after_revoke();

-- Konto löschen: entfernt den eigenen Eintrag in auth.users. Alle Tabellen mit Nutzerdaten hängen per
-- ON DELETE CASCADE daran – auch die Einwilligungs-Nachweise (Entscheidung zu Frage 10: alles löschen).
create or replace function public.delete_my_account()
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
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon, authenticated, service_role;
grant execute on function public.delete_my_account() to authenticated;
