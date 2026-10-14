-- Phase 5 · N7 (Vorarbeit): public.current_consent_version ist nicht mehr für anon ausführbar (Supabase-Advisor
-- „security definer function executable by anon“).
--
-- Bewertung (docs/PLAN-PHASE-5.md, Umsetzungsstand N7): Die App braucht die Einwilligungstexte VOR dem Login
-- (Onboarding: Alter → Texte → Konto). Dafür genügt die Tabelle public.consent_documents, die anon ohnehin lesen darf
-- (Policy „Veröffentlichte Einwilligungstexte sind für alle lesbar“, nur published_at <= now()). Die App liest die
-- höchste veröffentlichte Version jetzt direkt aus der Tabelle (gleiches Ergebnis wie die Funktion, RLS greift).
-- Damit ist die security-definer-Funktion für anon nicht nötig.
--
-- authenticated behält das Recht: Die INSERT-Policy auf public.consents ruft die Funktion mit den Rechten des
-- angemeldeten Nutzers auf; has_valid_consent() (security definer) ruft sie als Eigentümer auf.
-- Rein additiv in der Wirkung auf Daten (nur ein Recht weniger), keine Tabellen- oder Datenänderung.

revoke execute on function public.current_consent_version(public.consent_type) from anon;
