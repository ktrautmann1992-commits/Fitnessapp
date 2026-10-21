import type { ConsentDocument } from './types';

/**
 * Einwilligungstexte Version 1 für den TESTMODUS (ohne Supabase).
 *
 * Wörtliche Kopie aus supabase/migrations/20261003120800_seed_consent_documents.sql (terms, privacy, health_data) und
 * 20261016160100_ai_food_photo.sql (ai_food_photo, Etappe E3) sowie 20261021120100_wearables.sql (wearable_data,
 * Phase 8) – consent-texts.test.ts
 * bricht ab, wenn beide auseinanderlaufen. Im Supabase-Modus kommen die Texte immer aus consent_documents.
 * ENTWURF – juristisch prüfen (Entscheidung zu Frage 6).
 */
export const LOCAL_CONSENT_DOCUMENTS: readonly ConsentDocument[] = [
  {
    type: 'terms',
    version: 1,
    title: 'Nutzungsbedingungen',
    body: `ENTWURF – juristisch prüfen

1. Geltungsbereich
Diese Nutzungsbedingungen gelten für die Nutzung der App „Fitnessapp“ und der zugehörigen Website.

2. Mindestalter
Die Nutzung ist ab 16 Jahren erlaubt. Mit der Registrierung bestätigst du, dass du mindestens 16 Jahre alt bist.

3. Keine medizinische Beratung
Die Trainings-, Ernährungs- und Supplement-Empfehlungen sind allgemeine Fitness-Informationen. Sie ersetzen keine ärztliche Untersuchung oder Beratung. Bei Vorerkrankungen, Beschwerden, in der Schwangerschaft oder bei Einnahme von Medikamenten sprich vor dem Start mit deiner Ärztin oder deinem Arzt. Brich das Training bei Schmerzen, Schwindel oder Atemnot sofort ab.

4. Dein Konto
Du bist für die Richtigkeit deiner Angaben verantwortlich. Du kannst dein Konto jederzeit in den Einstellungen löschen.

5. Änderungen
Ändern sich diese Bedingungen, informieren wir dich in der App und bitten dich erneut um Zustimmung.`,
  },
  {
    type: 'privacy',
    version: 1,
    title: 'Datenschutzerklärung',
    body: `ENTWURF – juristisch prüfen

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
Wir speichern deine Daten, solange dein Konto besteht. Beim Löschen des Kontos werden alle Daten gelöscht.`,
  },
  {
    type: 'health_data',
    version: 1,
    title: 'Einwilligung in die Verarbeitung von Gesundheitsdaten',
    body: `ENTWURF – juristisch prüfen

Damit wir deine Pläne sicher und passend erstellen können, möchten wir folgende Gesundheitsdaten von dir speichern und verarbeiten:
- Körperdaten: Größe, Gewicht, optional Körperfettanteil und Ruhepuls – jeweils mit Messdatum, auch frühere Messungen,
- Körperumfänge (z. B. Oberarm, Brust, Schulter, Taille, Bauch, Hüfte, Oberschenkel, Wade) – optional, mit Messdatum,
- deine Antworten im Gesundheits-Check (z. B. Herz-Kreislauf, Schwangerschaft, Beschwerden, Medikamente), die daraus abgeleiteten Hinweise (z. B. „vorsichtiger Plan“) und den Verlauf früherer Checks,
- Lebensmittel-Unverträglichkeiten.

Wofür: ausschließlich zur Berechnung deiner Trainings- und Ernährungspläne (z. B. Kalorienbedarf, vorsichtigere Pläne bei gesundheitlichen Auffälligkeiten). Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App auch ohne diese Einwilligung nutzen. Dann erhältst du nur allgemeine Pläne ohne Körperdaten und ohne Gesundheits-Check.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle oben genannten Daten – Körperdaten, Körperumfänge, alle Gesundheits-Checks samt Verlauf und Unverträglichkeiten. Deine übrigen Angaben (z. B. Ziel, Ernährungsform, Vorlieben, Mess-Erinnerung) bleiben erhalten. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.

Neue Fassung: Ändern wir diesen Text, fragen wir dich erneut. Bis du zustimmst, bleiben deine bisherigen Daten sichtbar, können aber nicht ergänzt oder geändert werden.`,
  },
  {
    type: 'ai_food_photo',
    version: 1,
    title: 'Einwilligung: Gerichte per Foto auswerten',
    body: `ENTWURF – juristisch prüfen

Mit „Per Foto“ kannst du ein Foto deiner Mahlzeit auswerten lassen. Die Auswertung schätzt, welche Lebensmittel zu sehen sind und wie viel davon. Weil ein Foto deines Essens Rückschlüsse auf deine Gesundheit und dein Essverhalten zulassen kann, brauchen wir dafür diese gesonderte Einwilligung.

Derzeit Testversion: Es antwortet ein Testprogramm mit festen Beispielen. Dein Foto und deine Info werden dabei an keinen KI-Anbieter übermittelt – auch nicht an Google. Bevor wir eine echte KI einschalten, legen wir dir eine neue Fassung dieses Textes vor (mit Anbieter, Verarbeitungsort und Speicherdauer beim Anbieter) und fragen dich erneut. Ohne deine neue Zustimmung bleibt es bei der Testversion.

Was verarbeitet wird: nur das Foto (auf deinem Gerät verkleinert, Standort und andere Bilddaten werden entfernt) und deine kurze Info zum Gericht (höchstens 120 Zeichen). Dein Name, deine E-Mail-Adresse, Körperdaten, Ziele, dein Gesundheits-Check und Unverträglichkeiten gehören nicht dazu.

Wie lange: Wir speichern das Foto nicht. Es wird nur für die Auswertung verarbeitet und danach sofort verworfen. Je Auswertung speichern wir nur Zeitpunkt, Ergebnis-Status, Menge der verarbeiteten Daten (Token) und Kosten – für dein monatliches Kontingent, ohne Inhalte.

Schätzung ohne Gewähr: Das Ergebnis ist ein Vorschlag. Du prüfst und änderst ihn, bevor etwas in dein Ernährungstagebuch kommt. Die Nährwerte rechnen wir selbst aus unserem Lebensmittel-Katalog.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Ohne diese Einwilligung kannst du dein Essen weiterhin per Hand eintragen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Danach werten wir keine Fotos mehr aus. Was du schon eingetragen hast, bleibt in deinem Ernährungstagebuch (dafür gilt die Einwilligung Gesundheitsdaten). Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.`,
  },
  {
    type: 'wearable_data',
    version: 1,
    title: 'Einwilligung: Daten deiner Smartwatch übernehmen',
    body: `ENTWURF – juristisch prüfen

Mit „Smartwatch verbinden“ übernimmt Alpha5 Daten deiner Smartwatch (z. B. Galaxy Watch) aus Health Connect auf deinem Android-Handy. Health Connect ist die Datensammelstelle von Android; die App deiner Uhr (z. B. Samsung Health) schreibt dort hinein. Alpha5 liest nur – wir schreiben nichts zurück und sprechen nie direkt mit deiner Uhr.

Welche Daten: nur die Arten, die du im Health-Connect-Dialog erlaubst:
- Trainingseinheiten (Art, Beginn, Ende, Distanz, verbrauchte kcal),
- Puls während deiner Einheiten – gespeichert wird nur eine Zusammenfassung je Einheit (Durchschnitt, Maximum, Minuten je Pulszone), keine Pulskurve,
- Ruhepuls je Tag, Schlafdauer je Nacht (ohne Schlafphasen) und Schritte je Tag.
Strecken (GPS) deiner Uhr übernehmen wir nicht.

Wofür: ausschließlich für dein Trainingstagebuch und deine eigenen Auswertungen (z. B. Puls und Pulszonen einer Einheit, Tageswerte). Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner, nicht im Partner-Modus und nie auf geteilten Bildern.

Speicherort und Dauer: auf Servern in der EU (Frankfurt am Main), solange dein Konto besteht oder bis du die Verbindung trennst bzw. diese Einwilligung widerrufst.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG). Voraussetzung ist zusätzlich deine Einwilligung in die Verarbeitung von Gesundheitsdaten.

Freiwillig: Ohne diese Einwilligung nutzt du die App wie bisher; Einheiten kannst du weiter selbst eintragen oder aufzeichnen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle Pulswerte, alle Tageswerte (Ruhepuls, Schlaf, Schritte) und die Verbindung. Übernommene Trainingseinheiten bleiben als normale Einträge ohne Puls in deinem Tagebuch – du kannst sie dort löschen. Beim Trennen der Uhr fragen wir dich, ob du die übernommenen Einheiten behalten oder löschen möchtest. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.`,
  },
];
