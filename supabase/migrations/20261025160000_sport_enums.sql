-- Sportarten Stufe 2 (Gründer-Freigabe 25.10.2026, docs/PLAN-SPORTARTEN.md): Sportarten zum Eintragen bzw. von der
-- Uhr – OHNE eigene Trainingspläne. Eigene Datei VOR 20261025160100_sportarten.sql (wie bei allen Enum-Dateien). Rein
-- additiv: neuer Typ, nichts Bestehendes geändert. Reihenfolge = SPORT_IDS in packages/core/src/enums.ts
-- (Abgleich in db-sync.test.ts). `other` = „Sonstige Sportart“.
create type public.sport_type as enum (
  'bouldering',
  'climbing',
  'football',
  'padel',
  'tennis',
  'badminton',
  'table_tennis',
  'basketball',
  'volleyball',
  'handball',
  'cross_trainer',
  'indoor_cycling',
  'hiit',
  'boxing',
  'kickboxing',
  'judo_bjj',
  'karate',
  'martial_arts',
  'cross_country_skiing',
  'ski_touring',
  'alpine_skiing',
  'snowboarding',
  'inline_skating',
  'sup',
  'kayaking',
  'dancing',
  'other'
);
