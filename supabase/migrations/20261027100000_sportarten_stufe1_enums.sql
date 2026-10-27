-- Sportarten Stufe 1 (Gründer-Freigabe 27.10.2026, docs/PLAN-SPORTARTEN-STUFE-1.md Abschnitt 3): Hyrox,
-- Wandern/Bergwandern, Indoor-Rudern, Yoga/Pilates/Mobility – neue Enum-Werte und Typen. Eigene Datei VOR
-- 20261027100100_sportarten_stufe1.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben Transaktion nicht
-- benutzt werden (Regel aus WP5). Rein additiv, bestehende Zeilen bleiben gültig. Neue Werte hängt Postgres hinten an –
-- die Listen in packages/core folgen derselben Reihenfolge (Abgleich in db-sync.test.ts):
-- ENDURANCE_DISCIPLINES, SESSION_FOCUSES, ENDURANCE_MODALITIES, CAUTION_TAGS, SPORT_IDS, WALK_KINDS, HYROX_DIVISIONS
-- (enums.ts), COMPETITION_DISCIPLINES (plan/competition-schema.ts), WORKOUT_TYPES (plan/intensity.ts),
-- WORKOUT_CATEGORIES und WORKOUT_FORMATS (workouts/schema.ts).

-- Hyrox (Plan 2.1): Ausdauer-Disziplin des Ziels und Wettkampf-Disziplin; Stations-Einheit (Kraft) und Kombi-Einheit.
alter type public.endurance_discipline add value if not exists 'hyrox';
alter type public.competition_discipline add value if not exists 'hyrox';
alter type public.session_focus add value if not exists 'hyrox_stations';
alter type public.workout_type add value if not exists 'hyrox_combo';

-- Division eines Hyrox-Wettkampfs (Entscheidung 2: Open und Pro mit eigenen Gewichten, Doubles/Staffel nur Angabe).
create type public.hyrox_division as enum ('open', 'pro', 'doubles', 'relay');

-- Indoor-Rudern (Plan 2.3): neue, planbare Ausdauer-Art (keine GPS-Strecke).
alter type public.endurance_modality add value if not exists 'row';

-- Wandern/Bergwandern (Plan 2.2): Art einer Geh-Einheit; die Sportart bleibt `walk` (null = Gehen wie bisher).
create type public.walk_kind as enum ('walk', 'hike', 'mountain_hike');

-- Yoga/Pilates/Mobility und Rudern-Workouts (Plan 2.3/2.4): Kategorien und Format „flow“ der Workout-Bibliothek.
alter type public.workout_category add value if not exists 'yoga';
alter type public.workout_category add value if not exists 'pilates';
alter type public.workout_category add value if not exists 'rowing';
alter type public.workout_format add value if not exists 'flow';

-- Merkmal „Umkehrhaltung“ (Kopf unter Herzhöhe) für die Sicherheitsfilter (Plan 2.4, Entscheidung 11).
alter type public.caution_tag add value if not exists 'inversion';

-- Sportart-Einträge (Plan 2.4): Studio-Kurs eintragen, Uhr-Arten „Yoga“ und „Pilates“ (Kategorie mind_body nur im Core).
alter type public.sport_type add value if not exists 'yoga';
alter type public.sport_type add value if not exists 'pilates';
