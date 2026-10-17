-- Ziele · Etappe Z4, Wächter-Auflage zu Z3 N3 (docs/PLAN-ZIELE.md 13 und 14): Alte App-Stände (zwischengespeicherter
-- Web-Build, alte APK) senden beim Speichern des Ziels keine Spalte secondary_goal_type. Ein vorhandenes Nebenziel
-- bliebe dann stehen; passt es nicht zum neuen Hauptziel, scheiterte das Speichern am Paar-CHECK (23514), und das Ziel
-- ließe sich nicht mehr ändern.
--
-- Lösung in der Datenbank: Ein BEFORE-UPDATE-Trigger auf goals setzt ein Nebenziel auf null, wenn es UNVERÄNDERT
-- mitgeführt wird (alter Wert) und nicht mehr zum neuen Hauptziel passt (private.goal_pair_allowed = GOAL_COMBINATIONS).
-- Ein ausdrücklich NEU gesetztes, unpassendes Nebenziel bleibt ein Fehler (Paar-CHECK). Mit dem Nebenziel entfällt eine
-- Disziplin, die nur dazu gehörte (Disziplin-CHECK). Fällt dabei Abnehmen weg, löscht der bestehende Trigger
-- goals_drop_weight_goal das Wunschgewicht (Datensparsamkeit, Wächter S13).
-- Nur eine Funktion und ein Trigger, keine Daten- oder Tabellenänderung. Kein Gesundheitsdatum.

create or replace function private.goals_clear_stale_secondary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.secondary_goal_type is not null
     and new.secondary_goal_type is not distinct from old.secondary_goal_type
     and not private.goal_pair_allowed(new.goal_type, new.secondary_goal_type) then
    new.secondary_goal_type := null;
    if new.discipline is not null and new.goal_type <> 'endurance' then
      new.discipline := null;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.goals_clear_stale_secondary() from public;

create trigger goals_clear_stale_secondary
  before update on public.goals
  for each row execute function private.goals_clear_stale_secondary();
