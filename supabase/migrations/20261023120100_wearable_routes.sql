-- Phase 8 · Routen der Uhr (Gründer-Entscheidung 23.10.2026 „Routen lesen“, docs/PLAN-PHASE-8.md 14): Die App
-- liest bei Ausdauer-Einheiten die Route (GPS) aus Health Connect, rechnet Distanz, Höhenmeter und Kilometerzeiten selbst
-- (packages/core/src/wearables/route.ts, gleiche Filter wie die eigene Aufzeichnung) und speichert die vereinfachte Linie
-- als Strecke mit Herkunft `watch` – dieselbe Auswertung wie eigene Aufzeichnungen (/ausdauer/[id]). Rein additiv:
-- 1. Einwilligungstext wearable_data Version 2 (nennt jetzt die Routen; Version 1 sagte „keine Strecken“). Wer Version 1
--    erteilt hat, wird vor dem nächsten Abgleich erneut gefragt (has_valid_consent prüft die aktuelle Version).
-- 2. tracked_routes.wearable_session_log_id: Verknüpfung zur übernommenen Uhr-Einheit (zusammengesetzter Fremdschlüssel
--    auf wearable_sessions, on update/delete cascade) – genau bei Herkunft `watch` gesetzt (CHECK), je Einheit höchstens
--    eine Route. Geht die Uhr-Einheit (Eintrag gelöscht, Trennen mit „löschen“), geht ihre Route mit.
-- 3. private.wearable_route_dismissals: Route von der Person gelöscht → der nächste Abgleich legt sie nicht wieder an
--    (außer über „Route freigeben“).
-- 4. Trigger: Trennen und Widerruf (beide löschen wearable_connections) löschen alle Routen der Uhr; „Möglicher
--    Doppel-Eintrag → Zusammenführen“ hängt die Route an den führenden Eintrag (oder löscht sie, wenn der schon eine
--    eigene Strecke hat – App führend, W8-9).
-- 5. save_wearable_route(p_route, p_explicit) – einziger Schreibweg für Herkunft `watch`.
-- Eigene Trigger statt neuer Fassungen von consents_after_revoke/disconnect_wearable/resolve_wearable_duplicate: so
-- überschreiben parallele Fassungen dieser Funktionen nichts (Muster: consents_after_revoke_cycle).
-- Datenschutz: Routen sind Standortdaten, kein Art.-9-Datum (W-G15) – sie stammen aber aus der Uhr und hängen deshalb
-- an der Einwilligung wearable_data (+ health_data) und an der Verbindung. RLS der Tabelle unverändert (nur eigene
-- Zeilen lesen, kein Partner-Zugriff, nie öffentlich). Export: export_my_data nimmt to_jsonb(t) der ganzen Zeile – die
-- neue Spalte ist automatisch dabei. Fehlermeldungen ohne Koordinaten.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Einwilligungstext Version 2
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'wearable_data',
  2,
  'Einwilligung: Daten deiner Smartwatch übernehmen',
  $txt$ENTWURF – juristisch prüfen

Mit „Smartwatch verbinden“ übernimmt Alpha5 Daten deiner Smartwatch (z. B. Galaxy Watch) aus Health Connect auf deinem Android-Handy. Health Connect ist die Datensammelstelle von Android; die App deiner Uhr (z. B. Samsung Health) schreibt dort hinein. Alpha5 liest nur – wir schreiben nichts zurück und sprechen nie direkt mit deiner Uhr.

Welche Daten: nur die Arten, die du im Health-Connect-Dialog erlaubst:
- Trainingseinheiten (Art, Beginn, Ende, Distanz, verbrauchte kcal),
- Routen (GPS-Strecken) deiner Läufe, Rad- und Geh-Einheiten – nur wenn du in Health Connect „Trainingsrouten“ erlaubst oder eine Route einzeln freigibst. Daraus rechnen wir Distanz, Höhenmeter und Kilometerzeiten; gespeichert wird nur eine vereinfachte Linie, keine Zeit je Punkt,
- Puls während deiner Einheiten – gespeichert wird nur eine Zusammenfassung je Einheit (Durchschnitt, Maximum, Minuten je Pulszone), keine Pulskurve,
- Ruhepuls je Tag, Schlafdauer je Nacht (ohne Schlafphasen) und Schritte je Tag.

Wofür: ausschließlich für dein Trainingstagebuch und deine eigenen Auswertungen (z. B. Karte, Distanz und Pulszonen einer Einheit, Tageswerte). Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner, nicht im Partner-Modus. Routen siehst nur du; eine Route erscheint nur dann auf einem Bild, wenn du selbst „Als Bild teilen“ wählst – ohne Anfang und Ende der Strecke und ohne Puls.

Speicherort und Dauer: auf Servern in der EU (Frankfurt am Main), solange dein Konto besteht oder bis du die Verbindung trennst bzw. diese Einwilligung widerrufst.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG). Voraussetzung ist zusätzlich deine Einwilligung in die Verarbeitung von Gesundheitsdaten.

Freiwillig: Ohne diese Einwilligung nutzt du die App wie bisher; Einheiten kannst du weiter selbst eintragen oder aufzeichnen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle Pulswerte, alle Tageswerte (Ruhepuls, Schlaf, Schritte), alle Routen deiner Uhr und die Verbindung. Übernommene Trainingseinheiten bleiben als normale Einträge ohne Puls und ohne Route in deinem Tagebuch – du kannst sie dort löschen. Beim Trennen der Uhr löschen wir Puls, Tageswerte und Routen ebenfalls und fragen dich, ob du die übernommenen Einheiten behalten oder löschen möchtest. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.$txt$,
  now()
)
on conflict (consent_type, version) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Verknüpfung Strecke ↔ Uhr-Einheit
-- ---------------------------------------------------------------------------------------------------------
-- Ziel des zusammengesetzten Fremdschlüssels (session_log_id ist schon Primärschlüssel – eindeutig auch mit user_id).
alter table public.wearable_sessions
  add constraint wearable_sessions_session_log_id_user_id_key unique (session_log_id, user_id);

alter table public.tracked_routes add column wearable_session_log_id uuid;
-- Prüfung erst am Ende der Transaktion (die Kaskade selbst läuft sofort): Wird der Tagebuch-Eintrag gelöscht, leert
-- dessen Fremdschlüssel (on delete set null) session_log_id der Route, während die Uhr-Einheit per Kaskade schon weg
-- ist – die Route geht danach mit der Einheit; eine sofortige Prüfung würde dazwischen fälschlich abbrechen.
alter table public.tracked_routes
  add constraint tracked_routes_wearable_session_fkey
  foreign key (wearable_session_log_id, user_id) references public.wearable_sessions (session_log_id, user_id)
  on update cascade on delete cascade deferrable initially deferred;
-- Herkunft `watch` genau dann, wenn die Uhr-Einheit verknüpft ist (eigene Aufzeichnungen/GPX nie, Uhr-Routen immer).
alter table public.tracked_routes
  add constraint tracked_routes_watch_link check ((source = 'watch') = (wearable_session_log_id is not null));
-- Je Uhr-Einheit höchstens eine Route.
create unique index tracked_routes_wearable_session_idx on public.tracked_routes (wearable_session_log_id)
  where wearable_session_log_id is not null;

comment on column public.tracked_routes.wearable_session_log_id is
  'Route einer Uhr-Einheit (Herkunft watch, 23.10.2026): verknüpfte wearable_sessions-Zeile; geht mit ihr. Sonst null.';

-- ---------------------------------------------------------------------------------------------------------
-- 3. Von der Person gelöschte Uhr-Routen (nicht wieder anlegen)
-- ---------------------------------------------------------------------------------------------------------
create table private.wearable_route_dismissals (
  session_log_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  foreign key (session_log_id, user_id) references public.wearable_sessions (session_log_id, user_id)
    on update cascade on delete cascade
);
alter table private.wearable_route_dismissals enable row level security;
revoke all on table private.wearable_route_dismissals from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Trigger
-- ---------------------------------------------------------------------------------------------------------
-- 4a. Uhr-Route gelöscht, Uhr-Einheit besteht weiter (Person hat die Strecke gelöscht) → merken. Beim Löschen der
--     Einheit selbst (Kaskade) gibt es die Einheit nicht mehr – dann nichts merken.
create or replace function private.tracked_routes_watch_dismiss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.wearable_route_dismissals (session_log_id, user_id)
  select ws.session_log_id, ws.user_id
  from public.wearable_sessions ws
  where ws.session_log_id = old.wearable_session_log_id and ws.user_id = old.user_id
  on conflict (session_log_id) do nothing;
  return null;
end;
$$;
revoke all on function private.tracked_routes_watch_dismiss() from public, anon, authenticated;

create trigger tracked_routes_watch_dismiss
  after delete on public.tracked_routes
  for each row
  when (old.source = 'watch')
  execute function private.tracked_routes_watch_dismiss();

-- 4b. Verbindung gelöscht (Trennen – beide Varianten – und Widerruf wearable_data/health_data über
--     consents_after_revoke) → alle Routen dieser Uhr-Quelle weg, Merkliste leeren.
create or replace function private.wearable_connections_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tracked_routes t
  where t.user_id = old.user_id and t.source = 'watch'
    and t.wearable_session_log_id in (
      select ws.session_log_id from public.wearable_sessions ws
      where ws.user_id = old.user_id and ws.provider = old.provider
    );
  delete from private.wearable_route_dismissals d where d.user_id = old.user_id;
  return null;
end;
$$;
revoke all on function private.wearable_connections_after_delete() from public, anon, authenticated;

create trigger wearable_connections_after_delete
  after delete on public.wearable_connections
  for each row
  execute function private.wearable_connections_after_delete();

-- 4c. Uhr-Einheit wechselt den Eintrag (resolve_wearable_duplicate „Zusammenführen“): Route folgt dem führenden
--     Eintrag; hat der schon eine eigene Strecke (Aufzeichnung/GPX), ist die eigene führend und die Uhr-Route geht.
--     Gesucht wird über alte UND neue id – die Reihenfolge zur Kaskade des Fremdschlüssels ist so egal.
create or replace function private.wearable_route_follow_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tracked_routes t
    where t.session_log_id = new.session_log_id and t.source <> 'watch'
  ) then
    delete from public.tracked_routes t
    where t.user_id = new.user_id and t.source = 'watch'
      and t.wearable_session_log_id in (old.session_log_id, new.session_log_id);
  else
    update public.tracked_routes t
    set session_log_id = new.session_log_id
    where t.user_id = new.user_id and t.source = 'watch'
      and t.wearable_session_log_id in (old.session_log_id, new.session_log_id)
      and t.session_log_id is distinct from new.session_log_id;
  end if;
  return null;
end;
$$;
revoke all on function private.wearable_route_follow_session() from public, anon, authenticated;

create trigger wearable_route_follow_session
  after update of session_log_id on public.wearable_sessions
  for each row
  when (old.session_log_id is distinct from new.session_log_id)
  execute function private.wearable_route_follow_session();

-- ---------------------------------------------------------------------------------------------------------
-- 5. save_wearable_route(p_route jsonb, p_explicit boolean) → 'saved' | 'skipped'
-- Eingabe = wearableRoutePayloadSchema (packages/core/src/wearables/route.ts). Ablauf:
-- - Anmeldung, Profil, Einwilligung wearable_data + health_data (FOR SHARE gesperrt, dann Advisory-Sperre wie der
--   Abgleich),
-- - Uhr-Einheit über external_id (eigene, Health Connect); Sportart = Ausdauer-Art des Eintrags (nur run/bike/walk),
--   Beginn und Dauer = die der Uhr-Einheit, Name fest aus der Sportart – nichts davon vom Gerät,
-- - Eintrag hat schon eine eigene Strecke (Aufzeichnung/GPX) → Uhr-Route weg, 'skipped' (App führend, W8-9),
-- - Route von der Person gelöscht → 'skipped', außer p_explicit („Route freigeben“),
-- - sonst Route anlegen bzw. ändern (Linie, Distanz, Bewegungszeit, Höhenmeter, Kilometerzeiten, Höhenprofil; Name,
--   Favorit, Notiz, Schwierigkeit der Person bleiben); Prüfung über die CHECKs der Tabelle,
-- - eigene Uhr-Einheit (nicht zusammengeführt): Distanz und Höhenmeter des Eintrags = Route, revision + 1.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_wearable_route(p_route jsonb, p_explicit boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_keys constant text[] := array[
    'external_id', 'distance_m', 'moving_s', 'elevation_gain_m', 'polyline', 'km_splits', 'elevation_profile'
  ];
  -- sync: FREE_SESSION.names.endurance (ohne Schwimmen – keine Strecke im Wasser)
  route_names constant jsonb := '{"run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt"}';
  -- sync: WEARABLE_SYNC.externalIdMaxLength, TRACKED_ROUTE_LIMITS (CARDIO_LOG_LIMITS)
  payload_max_bytes constant integer := 200000;
  current_user_id uuid := auth.uid();
  r jsonb := p_route;
  ws_row record;
  v_duration integer;
  v_summary numeric[];
  v_route_id uuid;
  v_has_route boolean;
  v_changed integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if not private.wearable_consents_locked(current_user_id) then
    raise exception 'Einwilligung Smartwatch-Daten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if r is null or p_explicit is null or jsonb_typeof(r) <> 'object' or octet_length(r::text) > payload_max_bytes then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  perform private.assert_json_keys(r, route_keys, 'Strecke');
  if not (r ?& route_keys)
     or jsonb_typeof(r -> 'external_id') <> 'string'
     or char_length(r ->> 'external_id') not between 1 and 200
     or not private.jsonb_number_between(r -> 'distance_m', 0, 500000, 0)
     or not private.jsonb_number_between(r -> 'moving_s', 0, 43200, 0)
     or not (jsonb_typeof(r -> 'elevation_gain_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_gain_m', 0, 10000, 0))
     or jsonb_typeof(r -> 'polyline') <> 'string'
     or jsonb_typeof(r -> 'km_splits') <> 'array'
     or jsonb_typeof(r -> 'elevation_profile') not in ('array', 'null') then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));

  select ws.session_log_id, ws.merged, ws.started_at, ws.finished_at, cl.modality into ws_row
  from public.wearable_sessions ws
  left join public.cardio_logs cl on cl.session_log_id = ws.session_log_id
  where ws.user_id = current_user_id and ws.provider = 'health_connect' and ws.external_id = (r ->> 'external_id')
  for update of ws;
  if not found then
    raise exception 'Diese Einheit von der Uhr wurde nicht gefunden.' using errcode = 'invalid_parameter_value';
  end if;
  if ws_row.modality is null or ws_row.modality not in ('run', 'bike', 'walk') then
    return 'skipped';
  end if;
  -- Eigene Strecke am Eintrag ist führend (W8-9).
  if exists (
    select 1 from public.tracked_routes t
    where t.session_log_id = ws_row.session_log_id and t.source <> 'watch'
  ) then
    delete from public.tracked_routes t
    where t.user_id = current_user_id and t.wearable_session_log_id = ws_row.session_log_id;
    return 'skipped';
  end if;
  -- Von der Person gelöscht: nur „Route freigeben“ legt sie wieder an.
  if exists (select 1 from private.wearable_route_dismissals d where d.session_log_id = ws_row.session_log_id) then
    if not p_explicit then
      return 'skipped';
    end if;
    delete from private.wearable_route_dismissals d where d.session_log_id = ws_row.session_log_id;
  end if;

  v_duration := round(extract(epoch from (ws_row.finished_at - ws_row.started_at)))::integer;
  v_summary := private.polyline_summary(r ->> 'polyline');
  if v_summary is null or v_summary[1] not between 2 and 5000 then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  select t.id into v_route_id
  from public.tracked_routes t
  where t.user_id = current_user_id and t.wearable_session_log_id = ws_row.session_log_id
  for update;
  v_has_route := found;
  begin
    if v_has_route then
      update public.tracked_routes t
      set sport = ws_row.modality, started_at = ws_row.started_at, duration_s = v_duration,
          moving_s = (r ->> 'moving_s')::integer, distance_m = (r ->> 'distance_m')::integer,
          elevation_gain_m = (r ->> 'elevation_gain_m')::integer, polyline = r ->> 'polyline',
          point_count = v_summary[1]::integer, bbox = v_summary[2:5], km_splits = r -> 'km_splits',
          elevation_profile = case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
          session_log_id = ws_row.session_log_id
      where t.id = v_route_id;
    else
      insert into public.tracked_routes (
        user_id, name, sport, started_at, duration_s, moving_s, distance_m, elevation_gain_m, polyline, point_count,
        bbox, km_splits, difficulty, is_favorite, base_route_id, note, session_log_id, source, elevation_profile,
        wearable_session_log_id
      )
      values (
        current_user_id, route_names ->> ws_row.modality::text, ws_row.modality, ws_row.started_at, v_duration,
        (r ->> 'moving_s')::integer, (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer,
        r ->> 'polyline', v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', null, false, null, null,
        ws_row.session_log_id, 'watch',
        case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
        ws_row.session_log_id
      );
    end if;
  exception
    when unique_violation then
      raise exception 'Dieser Eintrag hat schon eine Strecke.' using errcode = 'unique_violation';
    -- Ohne „Failing row contains (…)“ nach außen (keine Koordinaten).
    when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
      or numeric_value_out_of_range then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = sqlstate;
  end;

  -- Eigene Uhr-Einheit: Distanz und Höhenmeter des Eintrags folgen der Route (Abgleich mit der Strecke,
  -- private.session_log_fits_route). Zusammengeführt: der eigene Eintrag bleibt führend.
  if not ws_row.merged then
    update public.cardio_logs cl
    set distance_m = (r ->> 'distance_m')::integer,
        elevation_m = coalesce((r ->> 'elevation_gain_m')::integer, cl.elevation_m)
    where cl.session_log_id = ws_row.session_log_id
      and (cl.distance_m, cl.elevation_m) is distinct from
        ((r ->> 'distance_m')::integer, coalesce((r ->> 'elevation_gain_m')::integer, cl.elevation_m));
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.session_logs sl
      set revision = sl.revision + 1, last_write_id = gen_random_uuid(), client_updated_at = now()
      where sl.id = ws_row.session_log_id and sl.user_id = current_user_id;
    end if;
  end if;
  return 'saved';
end;
$$;

revoke all on function public.save_wearable_route(jsonb, boolean) from public, anon;
grant execute on function public.save_wearable_route(jsonb, boolean) to authenticated;
