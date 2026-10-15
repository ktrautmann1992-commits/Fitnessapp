-- Etappe A1a · Trainingskalender: zwei geplante Einheiten tauschen (docs/PLAN-AUSWERTUNG.md 2.6 und 3, Gründer-
-- Entscheidung A-G4 „Tauschen per Drag-and-drop: Ja, mit denselben Regeln für beide Einheiten“).
--
-- Rein ADDITIV: neue Funktion, keine Änderung an Tabellen, Index oder Trigger.
--
-- Warum eine eigene Funktion? Der eindeutige Teil-Index planned_sessions_one_per_day_idx (user_id, scheduled_on)
-- where status = 'planned' ist ein INDEX, kein Constraint – er lässt sich nicht „deferrable“ machen und prüft jede
-- Zeile sofort. Zwei einzelne Updates (A auf den Tag von B, dann B auf den Tag von A) scheitern deshalb schon beim
-- ersten Schritt (23505), und auch ein einziges UPDATE mit CASE kann je nach Zeilenreihenfolge scheitern. Den Index
-- durch eine aufschiebbare Exclusion-Constraint zu ersetzen wäre nicht additiv. Lösung: ein Zwischenschritt in EINER
-- Transaktion – A kurz auf `skipped` (fällt aus dem Teil-Index), B auf den Tag von A, A auf den Tag von B und zurück
-- auf `planned`. Den Zwischenstand sieht niemand (eine Transaktion, Zeilen gesperrt).
--
-- Gebunden an den geprüften Stand (Wächter A1a S1): Die App sendet die Tage, die sie für beide Einheiten geprüft hat
-- (p_a_on, p_b_on – dort liegen sie laut App GERADE). Stimmen sie nach dem Sperren nicht mehr (anderes Gerät hat
-- inzwischen verschoben/getauscht, oder dieselbe Anfrage kommt nach verlorener Antwort ein zweites Mal), lehnt die
-- Funktion mit „Der Plan hat sich inzwischen geändert.“ ab – nie wird ein Tag getauscht, den die App (48-h-Regel) nicht
-- geprüft hat, und eine Wiederholung tauscht nie zurück.
--
-- Fehler (feste Texte ohne Nutzerdaten) tragen einen `hint`, damit die App die Ursache unterscheiden kann:
-- `not_found` (fremde/unbekannte Einheit), `plan_changed` (Stand weicht ab, nicht mehr geplant, Plan nicht mehr aktiv),
-- `move_rules` (Regeln: Erholungswoche, Woche vorbei, Ziel vor heute/andere Woche).
--
-- Prüfungen – dieselben wie der Trigger private.planned_sessions_before_update für JEDE der beiden Einheiten (der
-- Trigger selbst greift hier nicht: security definer läuft als Eigentümer, und der Trigger prüft nur die Rolle
-- authenticated):
-- - angemeldet (auth.uid()); beide Einheiten gehören der Person (fremde = „nicht gefunden“, kein Hinweis auf Existenz),
-- - zwei verschiedene Einheiten, beide `planned` (erledigte und gestrichene sind fest),
-- - beide im AKTIVEN Plan,
-- - keine Einheit der Erholungswoche (dort nur streichen),
-- - die ISO-Woche von coalesce(original_date, scheduled_on) ist nicht vorbei (private.berlin_today()),
-- - jeder neue Tag liegt ab heute und in derselben ISO-Woche wie der ursprüngliche Tag der jeweiligen Einheit,
-- - original_date wird wie beim Verschieben nur beim ERSTEN Verschieben gesetzt.
-- NICHT geprüft: die 48-h-Erholungsregel (Kraft-Einheiten mit gleichen Muskeln an Nachbartagen). Sie bleibt – wie beim
-- Verschieben – eine Regel der App (validateSwap in packages/core/src/plan/move.ts prüft sie vor dem Senden); die
-- Datenbank verhindert nur das Stapeln. Ein Tausch ändert nie, WELCHE Tage belegt sind, nur welche Einheit wo liegt.
--
-- Sperren: beide Zeilen FOR NO KEY UPDATE (wie ein normales UPDATE ohne Schlüsseländerung; blockiert keine
-- Fremdschlüssel-Prüfungen) in fester Reihenfolge (id) – zwei gleichzeitige Tausche derselben Einheiten verklemmen
-- nicht. Keine Einwilligungs-Sperre nötig: Verschieben ist kein neues Gesundheitsdatum (wie der Trigger);
-- ein gleichzeitiger Widerruf (revoke_health_data: Einwilligung → Einheiten) wartet auf diese Zeilen bzw. umgekehrt.
-- Fehlermeldungen ohne Nutzerdaten (feste Texte, errcode check_violation bzw. insufficient_privilege).

create or replace function public.swap_planned_sessions(p_a uuid, p_b uuid, p_a_on date, p_b_on date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  a public.planned_sessions%rowtype;
  b public.planned_sessions%rowtype;
  a_week date;
  b_week date;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_a is null or p_b is null or p_a = p_b or p_a_on is null or p_b_on is null then
    raise exception 'Bitte zwei verschiedene Einheiten mit ihren Tagen angeben.'
      using errcode = 'check_violation', hint = 'move_rules';
  end if;

  -- Beide Zeilen sperren (feste Reihenfolge), dann lesen.
  perform 1
  from public.planned_sessions ps
  where ps.id in (p_a, p_b) and ps.user_id = current_user_id
  order by ps.id
  for no key update;
  select * into a from public.planned_sessions ps where ps.id = p_a and ps.user_id = current_user_id;
  select * into b from public.planned_sessions ps where ps.id = p_b and ps.user_id = current_user_id;
  if a.id is null or b.id is null then
    raise exception 'Einheit nicht gefunden.' using errcode = 'check_violation', hint = 'not_found';
  end if;
  -- An den geprüften Stand gebunden (S1): Wiederholung nach verlorener Antwort tauscht nie zurück.
  if a.scheduled_on <> p_a_on or b.scheduled_on <> p_b_on then
    raise exception 'Der Plan hat sich inzwischen geändert.' using errcode = 'check_violation', hint = 'plan_changed';
  end if;

  if a.status <> 'planned' or b.status <> 'planned' then
    raise exception 'Nur geplante Einheiten lassen sich tauschen.'
      using errcode = 'check_violation', hint = 'plan_changed';
  end if;
  if not exists (select 1 from public.user_plans p where p.id = a.plan_id and p.status = 'active')
     or not exists (select 1 from public.user_plans p where p.id = b.plan_id and p.status = 'active') then
    raise exception 'Nur Einheiten des aktiven Plans sind änderbar.'
      using errcode = 'check_violation', hint = 'plan_changed';
  end if;
  if a.is_deload or b.is_deload then
    raise exception 'Einheiten der Erholungswoche lassen sich nur streichen, nicht verschieben.'
      using errcode = 'check_violation', hint = 'move_rules';
  end if;

  a_week := date_trunc('week', coalesce(a.original_date, a.scheduled_on))::date;
  b_week := date_trunc('week', coalesce(b.original_date, b.scheduled_on))::date;
  if a_week + 6 < today or b_week + 6 < today then
    raise exception 'Diese Woche ist vorbei.' using errcode = 'check_violation', hint = 'move_rules';
  end if;
  if b.scheduled_on < today or date_trunc('week', b.scheduled_on)::date <> a_week
     or a.scheduled_on < today or date_trunc('week', a.scheduled_on)::date <> b_week then
    raise exception 'Verschieben nur ab heute und innerhalb derselben Woche.'
      using errcode = 'check_violation', hint = 'move_rules';
  end if;

  -- Zwischenschritt wegen des Teil-Index (siehe oben).
  update public.planned_sessions ps set status = 'skipped' where ps.id = a.id;
  update public.planned_sessions ps
  set scheduled_on = a.scheduled_on, original_date = coalesce(b.original_date, b.scheduled_on)
  where ps.id = b.id;
  update public.planned_sessions ps
  set scheduled_on = b.scheduled_on, status = 'planned', original_date = coalesce(a.original_date, a.scheduled_on)
  where ps.id = a.id;
end;
$$;

comment on function public.swap_planned_sessions(uuid, uuid, date, date) is
  'Etappe A1a: tauscht die Tage zweier eigener geplanter Einheiten des aktiven Plans atomar, nur wenn sie noch an den erwarteten Tagen liegen (Regeln wie der Verschiebe-Trigger, ohne 48-h-Regel).';

revoke all on function public.swap_planned_sessions(uuid, uuid, date, date) from public, anon;
grant execute on function public.swap_planned_sessions(uuid, uuid, date, date) to authenticated;
