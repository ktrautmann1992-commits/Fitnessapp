-- Phase 6 · Etappe SU3 (docs/PLAN-PHASE-6.md 7.1) · Aufzählungen des Supplement-Moduls. Eigene Datei VOR den Tabellen
-- (20261021130100/…130200): neue Typen werden erst danach benutzt. Rein additiv.
-- Werte = packages/core (db-sync.test.ts): SUPPLEMENT_IDS (supplement-ids.ts), SUPPLEMENT_EVIDENCE_LEVELS und
-- SUPPLEMENT_CONTENT_CATEGORIES (content/supplement-schema.ts), SUPPLEMENT_FLAGS (supplements/screening.ts),
-- USER_SUPPLEMENT_STATUSES (supplements/user-data.ts).
-- Bewusst (noch) nicht: `supplement_timing` und `dose_unit` – die Zeitpunkte rechnet nur der Core (SU6), Mengen je
-- Produkt braucht erst die Affiliate-Etappe SU5. Sie kommen mit der Etappe, die sie nutzt.

-- Eingeordnete Supplemente und Koffein (Sicherheits-Info). Die Liste „Nicht empfohlen“ (Stufe C) steht NICHT hier –
-- sie bekommt nie eine Auswahl „Nehme ich“ und nie einen Shop-Link.
create type public.supplement_id as enum ('creatine', 'caffeine', 'protein_powder', 'vitamin_d', 'omega3');

-- Studienlage (Plan 3.1): a gut, b begrenzt, c nicht ausreichend. Koffein hat keine Stufe (NULL).
create type public.supplement_evidence as enum ('a', 'b', 'c');

-- Kategorie (Plan 3.2; `diet_season` = „Ergänzung bei bestimmter Ernährung oder Jahreszeit“).
create type public.supplement_category as enum ('sport', 'food', 'diet_season', 'safety_info');

-- Flags des Supplement-Checks (Plan 3.4) – berechnet die Datenbank selbst (Trigger, wie beim Gesundheits-Check).
create type public.supplement_flag as enum ('kidney', 'breastfeeding', 'heart_rhythm', 'caffeine_sensitive');

-- „Meine Supplements“ (SU-G8): „Nehme ich“ bzw. „Nicht für mich“. Kein Abhaken je Tag, keine Erinnerungen.
create type public.user_supplement_status as enum ('taking', 'not_for_me');
