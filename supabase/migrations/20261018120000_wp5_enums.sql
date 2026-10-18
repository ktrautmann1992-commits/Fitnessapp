-- Phase 10 · Etappe WP5 · Rad und Triathlon Sprint/Olympisch – neue Enum-Werte (docs/PLAN-PHASE-10.md Abschnitt 9,
-- Gründer-Entscheidung W-G2). Eigene Datei VOR 20261018120100_wp5_rad_triathlon.sql: Neue Enum-Werte
-- (`alter type … add value`) dürfen in derselben Transaktion nicht benutzt werden. Rein additiv, bestehende Zeilen
-- bleiben gültig. Werte = packages/core (db-sync.test.ts): COMPETITION_DISCIPLINES (plan/competition-schema.ts),
-- WORKOUT_TYPES (plan/intensity.ts). Triathlon Mittel-/Langdistanz und Schwimm-Wettkämpfe bekommen bewusst KEINEN
-- Wettkampfplan (Hinweis Trainer/Verein) und deshalb keinen Wert.

-- Rad (freie Distanz 20–300 km) und Triathlon Sprint/Olympisch.
alter type public.competition_discipline add value 'cycling';
alter type public.competition_discipline add value 'triathlon_sprint';
alter type public.competition_discipline add value 'triathlon_olympic';

-- Koppeltraining Rad → Lauf (eine Einheit mit zwei Teilen) und Schwimmtechnik – beide locker (keine harten Arten).
alter type public.workout_type add value 'brick';
alter type public.workout_type add value 'technique';
