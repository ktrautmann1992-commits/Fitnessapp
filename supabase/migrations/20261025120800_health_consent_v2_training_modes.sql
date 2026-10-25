-- Trainings-Modi (docs/PLAN-TRAINING-MODI.md 3): Einwilligungstext health_data Fassung 2 (ENTWURF, unveröffentlicht seit
-- 20261021130200_supplement_user_data.sql) nennt jetzt auch den Schmerz-/Verletzungsmodus. Nur additiv: geändert wird
-- AUSSCHLIESSLICH der unveröffentlichte Entwurf (published_at IS NULL) – eine schon veröffentlichte Fassung bleibt
-- unberührt (Nachweis, wem welcher Text vorlag). Sync: apps/mobile/src/data/consent-texts.ts (consent-texts.test.ts).
-- Vor dem Veröffentlichen juristisch prüfen (Frage 6).

insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'health_data',
  2,
  'Einwilligung in die Verarbeitung von Gesundheitsdaten',
  $txt$ENTWURF – juristisch prüfen

Damit wir deine Pläne sicher und passend erstellen können, möchten wir folgende Gesundheitsdaten von dir speichern und verarbeiten:
- Körperdaten: Größe, Gewicht, optional Körperfettanteil und Ruhepuls – jeweils mit Messdatum, auch frühere Messungen,
- Körperumfänge (z. B. Oberarm, Brust, Schulter, Taille, Bauch, Hüfte, Oberschenkel, Wade) – optional, mit Messdatum,
- deine Antworten im Gesundheits-Check (z. B. Herz-Kreislauf, Schwangerschaft, Beschwerden, Medikamente), die daraus abgeleiteten Hinweise (z. B. „vorsichtiger Plan“) und den Verlauf früherer Checks,
- Lebensmittel-Unverträglichkeiten,
- deine Antworten im Supplement-Check (Nieren, Stillzeit, Herzrhythmus, Empfindlichkeit für Koffein, optional deine Einschätzung, ob du dein Eiweißziel über das Essen schaffst),
- deine Auswahl unter „Meine Supplements“ („Nehme ich“ oder „Nicht für mich“),
- deine Angaben im Schmerz-/Verletzungsmodus: Körperregion (z. B. Knie, Schulter), Stärke (leicht, mittel, stark), Dauer und Beginn – ohne Freitext und ohne Diagnose. Diese Einträge löschen wir spätestens nach 12 Monaten.

Wofür: ausschließlich zur Berechnung deiner Trainings- und Ernährungspläne (z. B. Kalorienbedarf, vorsichtigere Pläne bei gesundheitlichen Auffälligkeiten) und für Supplement-Hinweise – im Schmerz-/Verletzungsmodus auch, um belastende Übungen für einige Tage gegen schonendere zu tauschen und dir zu raten, Beschwerden ärztlich abklären zu lassen, und – auch, um Shop-Links auszublenden, wenn eine Ergänzung bei deinen Angaben nicht passt. Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner. Shops und Partnernetzwerke erhalten keine dieser Angaben.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App auch ohne diese Einwilligung nutzen. Dann erhältst du nur allgemeine Pläne ohne Körperdaten und ohne Gesundheits-Check und bei Supplementen nur allgemeine Informationen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle oben genannten Daten – Körperdaten, Körperumfänge, alle Gesundheits-Checks samt Verlauf, Unverträglichkeiten, den Supplement-Check, „Meine Supplements“ und die Einträge im Schmerz-/Verletzungsmodus. Deine übrigen Angaben (z. B. Ziel, Ernährungsform, Vorlieben, Mess-Erinnerung) bleiben erhalten. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.

Neue Fassung: Ändern wir diesen Text, fragen wir dich erneut. Bis du zustimmst, bleiben deine bisherigen Daten sichtbar, können aber nicht ergänzt oder geändert werden.$txt$,
  null
)
on conflict (consent_type, version) do update
  set body_de = excluded.body_de
  where public.consent_documents.published_at is null;
