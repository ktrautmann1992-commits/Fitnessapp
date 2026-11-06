-- Supplemente rund ums Training (Gründer-Entscheidung 06.11.2026, docs/PLAN-SUPPLEMENTE-TRAINING.md) · Teil 1.
-- Rein additiv: fünf neue Werte der Aufzählung supplement_id (für „Meine Supplements“, Tabelle user_supplements).
-- Eigene Migration, weil Postgres einen neuen Enum-Wert erst nach dem Commit der Transaktion verwenden lässt.
-- Spiegelung: SUPPLEMENT_IDS in packages/core/src/supplement-ids.ts (db-sync.test.ts). RLS unverändert.

alter type public.supplement_id add value if not exists 'beta_alanine';
alter type public.supplement_id add value if not exists 'eaa';
alter type public.supplement_id add value if not exists 'electrolytes';
alter type public.supplement_id add value if not exists 'zinc';
alter type public.supplement_id add value if not exists 'magnesium';
