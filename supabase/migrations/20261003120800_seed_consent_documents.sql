-- Phase 1 · Einwilligungstexte Version 1 (terms, privacy, health_data).
--
-- ENTWURF – juristisch prüfen (Entscheidung zu Frage 6). Die Texte sind von Claude erstellte Entwürfe und
-- müssen vor dem öffentlichen Start von einer Fachanwältin/einem Fachanwalt (DE, AT, CH) geprüft werden.
-- Eine geänderte Fassung wird als NEUE Version eingefügt (nie die alte überschreiben) und in
-- CURRENT_CONSENT_VERSIONS (packages/core/src/consent.ts) nachgezogen – dann fragt die App erneut nach.
-- cycle_data bekommt erst mit dem Zyklus-Modul (Phase 9) einen Text.

insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'terms',
  1,
  'Nutzungsbedingungen',
  $txt$ENTWURF – juristisch prüfen

1. Geltungsbereich
Diese Nutzungsbedingungen gelten für die Nutzung der App „Fitnessapp“ und der zugehörigen Website.

2. Mindestalter
Die Nutzung ist ab 16 Jahren erlaubt. Mit der Registrierung bestätigst du, dass du mindestens 16 Jahre alt bist.

3. Keine medizinische Beratung
Die Trainings-, Ernährungs- und Supplement-Empfehlungen sind allgemeine Fitness-Informationen. Sie ersetzen keine ärztliche Untersuchung oder Beratung. Bei Vorerkrankungen, Beschwerden, in der Schwangerschaft oder bei Einnahme von Medikamenten sprich vor dem Start mit deiner Ärztin oder deinem Arzt. Brich das Training bei Schmerzen, Schwindel oder Atemnot sofort ab.

4. Dein Konto
Du bist für die Richtigkeit deiner Angaben verantwortlich. Du kannst dein Konto jederzeit in den Einstellungen löschen.

5. Änderungen
Ändern sich diese Bedingungen, informieren wir dich in der App und bitten dich erneut um Zustimmung.$txt$,
  timestamptz '2026-10-03 00:00:00+00'
),
(
  'privacy',
  1,
  'Datenschutzerklärung',
  $txt$ENTWURF – juristisch prüfen

1. Verantwortliche Stelle
[Name und Anschrift der Betreiber – vor dem Start eintragen]

2. Welche Daten wir verarbeiten
- Konto: E-Mail-Adresse und Anmeldezeitpunkte.
- Profil: Geburtsdatum (für die Altersprüfung), Geschlecht, Trainingserfahrung, Sprache.
- Trainings- und Ernährungsangaben: Ziel, Zeitbudget, Trainingsort, Geräte, Ernährungsform, Vorlieben, Kochmodus.
- Gesundheitsdaten nur mit deiner gesonderten Einwilligung – siehe „Einwilligung Gesundheitsdaten“: Körperdaten (Größe, Gewicht, Körperfett, Ruhepuls), Körperumfänge (z. B. Oberarm, Brust, Schulter, Taille, Bauch, Hüfte, Oberschenkel, Wade), Antworten im Gesundheits-Check samt Verlauf und Lebensmittel-Unverträglichkeiten.
- Mess-Erinnerung: wie oft du an das Nachmessen erinnert werden möchtest (enthält keine Messwerte).

3. Zweck
Wir nutzen die Daten ausschließlich, um dir persönliche Trainings- und Ernährungspläne zu erstellen und die App bereitzustellen.

4. Speicherort
Die Daten liegen auf Servern in der EU (Frankfurt am Main) bei unserem Dienstleister Supabase. Mit ihm besteht ein Vertrag zur Auftragsverarbeitung.

5. Keine Weitergabe von Gesundheitsdaten
Gesundheitsdaten geben wir nicht an Analyse-, Werbe- oder Affiliate-Partner weiter und schreiben sie nicht in Protokolle.

6. Deine Rechte
Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Einwilligungen kannst du jederzeit in den Einstellungen widerrufen. Dein Konto mit allen Daten kannst du jederzeit in der App löschen.

7. Speicherdauer
Wir speichern deine Daten, solange dein Konto besteht. Beim Löschen des Kontos werden alle Daten gelöscht.$txt$,
  timestamptz '2026-10-03 00:00:00+00'
),
(
  'health_data',
  1,
  'Einwilligung in die Verarbeitung von Gesundheitsdaten',
  $txt$ENTWURF – juristisch prüfen

Damit wir deine Pläne sicher und passend erstellen können, möchten wir folgende Gesundheitsdaten von dir speichern und verarbeiten:
- Körperdaten: Größe, Gewicht, optional Körperfettanteil und Ruhepuls – jeweils mit Messdatum, auch frühere Messungen,
- Körperumfänge (z. B. Oberarm, Brust, Schulter, Taille, Bauch, Hüfte, Oberschenkel, Wade) – optional, mit Messdatum,
- deine Antworten im Gesundheits-Check (z. B. Herz-Kreislauf, Schwangerschaft, Beschwerden, Medikamente), die daraus abgeleiteten Hinweise (z. B. „vorsichtiger Plan“) und den Verlauf früherer Checks,
- Lebensmittel-Unverträglichkeiten.

Wofür: ausschließlich zur Berechnung deiner Trainings- und Ernährungspläne (z. B. Kalorienbedarf, vorsichtigere Pläne bei gesundheitlichen Auffälligkeiten). Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App auch ohne diese Einwilligung nutzen. Dann erhältst du nur allgemeine Pläne ohne Körperdaten und ohne Gesundheits-Check.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle oben genannten Daten – Körperdaten, Körperumfänge, alle Gesundheits-Checks samt Verlauf und Unverträglichkeiten. Deine übrigen Angaben (z. B. Ziel, Ernährungsform, Vorlieben, Mess-Erinnerung) bleiben erhalten. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.

Neue Fassung: Ändern wir diesen Text, fragen wir dich erneut. Bis du zustimmst, bleiben deine bisherigen Daten sichtbar, können aber nicht ergänzt oder geändert werden.$txt$,
  timestamptz '2026-10-03 00:00:00+00'
)
on conflict (consent_type, version) do nothing;
