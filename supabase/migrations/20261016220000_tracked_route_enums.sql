-- Phase 10 · Etappe S1 · Strecken aufzeichnen (docs/PLAN-PHASE-10.md Abschnitt 12): neue Enums in eigener Datei VOR
-- ihrer Verwendung (= packages/core/src/enums.ts, Abgleich in db-sync.test.ts). Nur additiv.
-- Sportart der Strecke: vorhandenes Enum endurance_modality mit CHECK (run | bike | walk, kein Schwimmen) in der
-- Tabelle – so passt sie ohne Umrechnung zur Ausdauer-Art des Tagebuch-Eintrags (cardio_logs.modality).

-- Schwierigkeit (KONZEPT 10.1: leicht / mittel / schwer) = ROUTE_DIFFICULTIES.
create type public.route_difficulty as enum ('easy', 'medium', 'hard');

-- Herkunft der Strecke: in der App aufgezeichnet (S1) oder eigene GPX-Datei (S2a) = TRACKED_ROUTE_SOURCES.
create type public.tracked_route_source as enum ('recorded', 'gpx_import');
