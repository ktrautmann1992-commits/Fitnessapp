-- Etappe E3 · Gericht per Foto (docs/PLAN-AUSWERTUNG.md Abschnitt 9 und 2.7, KONZEPT 6.4 und 15).
-- Eigene Datei VOR 20261016160100_ai_food_photo.sql: Neue Enum-Werte (`alter type … add value`) dürfen in derselben
-- Transaktion noch nicht benutzt werden (Muster 20261006120000_training_log_enums.sql).
--
-- Neue, GETRENNTE Einwilligungsart `ai_food_photo` (Art. 9 + Übermittlung des Fotos an Google als
-- Auftragsverarbeiter). sync: CONSENT_TYPES in packages/core/src/enums.ts (db-sync.test.ts).
alter type public.consent_type add value 'ai_food_photo';
