import type { ConsentDocument } from './types';

/**
 * Aktuelle Einwilligungstexte für den TESTMODUS (ohne Supabase).
 *
 * Wörtliche Kopie aus supabase/migrations/20261003120800_seed_consent_documents.sql (terms, privacy),
 * 20261016160100_ai_food_photo.sql (ai_food_photo, Etappe E3), 20261023120100_wearable_routes.sql (wearable_data Fassung 2 mit Routen, 23.10.2026),
 * 20261025120000_recovery_hrv.sql (wearable_data Fassung 3 mit HRV und „Erholung“, 25.10.2026)
 * 20261021130200_supplement_user_data.sql (health_data Fassung 2, Supplement-Modul SU3; Entwurf ergänzt in
 * 20261025120800_health_consent_v2_training_modes.sql um den Schmerz-/Verletzungsmodus) und
 * 20261021140000_cycle_module.sql (cycle_data, Phase 9) – consent-texts.test.ts
 * bricht ab, wenn sie auseinanderlaufen. In der Datenbank ist health_data Fassung 2 bis zur juristischen Prüfung ein
 * unveröffentlichter Entwurf; der Testmodus nutzt sie schon (Supplement-Check testbar, Testschalter „Einwilligung nur
 * alte Fassung“ für die Hinweis-Karte). Im Supabase-Modus kommen die Texte immer aus consent_documents.
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
    version: 2,
    title: 'Einwilligung in die Verarbeitung von Gesundheitsdaten',
    body: `ENTWURF – juristisch prüfen

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
    version: 3,
    title: 'Einwilligung: Daten deiner Smartwatch übernehmen',
    body: `ENTWURF – juristisch prüfen

Mit „Smartwatch verbinden“ übernimmt Alpha5 Daten deiner Smartwatch (z. B. Galaxy Watch) aus Health Connect auf deinem Android-Handy. Health Connect ist die Datensammelstelle von Android; die App deiner Uhr (z. B. Samsung Health) schreibt dort hinein. Alpha5 liest nur – wir schreiben nichts zurück und sprechen nie direkt mit deiner Uhr.

Welche Daten: nur die Arten, die du im Health-Connect-Dialog erlaubst:
- Trainingseinheiten (Art, Beginn, Ende, Distanz, verbrauchte kcal),
- Routen (GPS-Strecken) deiner Läufe, Rad- und Geh-Einheiten – nur wenn du in Health Connect „Trainingsrouten“ erlaubst oder eine Route einzeln freigibst. Daraus rechnen wir Distanz, Höhenmeter und Kilometerzeiten; gespeichert wird nur eine vereinfachte Linie, keine Zeit je Punkt,
- Puls während deiner Einheiten – gespeichert wird nur eine Zusammenfassung je Einheit (Durchschnitt, Maximum, Minuten je Pulszone), keine Pulskurve,
- Ruhepuls je Tag, Schlafdauer je Nacht (ohne Schlafphasen), Schritte je Tag und Herzfrequenzvariabilität (HRV) je Tag – gespeichert wird nur ein Tageswert, keine einzelnen Messungen.

Wofür: ausschließlich für dein Trainingstagebuch und deine eigenen Auswertungen (z. B. Karte, Distanz und Pulszonen einer Einheit, Tageswerte) und für die „Erholung“: Aus Schlaf, Ruhepuls und HRV ermittelt die App mit festen Regeln einen Tagesstatus (gut, mittel, niedrig) – nur im Vergleich mit deinen eigenen Werten der letzten 14 Tage – und kann dir an Tagen mit niedriger Erholung eine leichtere Einheit vorschlagen. Du entscheidest selbst; der Plan ändert sich nie von allein. Die Erholung ist eine Trainingshilfe, keine Bewertung deiner Gesundheit; der Status selbst wird nicht gespeichert. Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner, nicht im Partner-Modus. Routen siehst nur du; eine Route erscheint nur dann auf einem Bild, wenn du selbst „Als Bild teilen“ wählst – ohne Anfang und Ende der Strecke und ohne Puls.

Speicherort und Dauer: auf Servern in der EU (Frankfurt am Main), solange dein Konto besteht oder bis du die Verbindung trennst bzw. diese Einwilligung widerrufst.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG). Voraussetzung ist zusätzlich deine Einwilligung in die Verarbeitung von Gesundheitsdaten.

Freiwillig: Ohne diese Einwilligung nutzt du die App wie bisher; Einheiten kannst du weiter selbst eintragen oder aufzeichnen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle Pulswerte, alle Tageswerte (Ruhepuls, Schlaf, Schritte, HRV), alle Routen deiner Uhr und die Verbindung. Übernommene Trainingseinheiten bleiben als normale Einträge ohne Puls und ohne Route in deinem Tagebuch – du kannst sie dort löschen. Beim Trennen der Uhr löschen wir Puls, Tageswerte und Routen ebenfalls und fragen dich, ob du die übernommenen Einheiten behalten oder löschen möchtest. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.`,
  },
  {
    type: 'cycle_data',
    version: 1,
    title: 'Einwilligung: Zyklusdaten',
    body: `ENTWURF – juristisch prüfen (Fassung für die Testphase, Prüfung vor dem öffentlichen Livegang)

Mit dem Zyklus-Modul kannst du täglich eintragen, wie es dir geht. Weil diese Angaben besonders sensible Gesundheitsdaten sind, brauchen wir dafür diese gesonderte Einwilligung – getrennt von der Einwilligung „Gesundheitsdaten“.

Was wir speichern: deine Tages-Checks (Blutung, Energie, Beschwerden, optional Schlaf), deinen Status (z. B. natürlicher Zyklus, hormonelle Verhütung, Wechseljahre, Stillzeit, Schwangerschaft), den Zeitpunkt deiner letzten Periode beim Einschalten und deine Einstellungen im Modul. Kein Freitext, keine Art oder Marke einer Verhütung.

Wozu: um dir an Tagen mit wenig Energie oder starken Beschwerden ein leichteres Training anzubieten, dir Hinweise zur Ernährung zu geben und dir allgemeine Hinweise zu geben, wann eine ärztliche Abklärung sinnvoll sein kann. Keine Vorhersage, keine fruchtbaren Tage, keine Diagnose.

Das Zyklus-Modul ist kein Medizinprodukt. Es ist nicht zur Verhütung oder Familienplanung geeignet und ersetzt keine ärztliche Untersuchung.

Wie: Die Daten liegen in der EU (Frankfurt am Main) bei unserem Dienstleister Supabase und sind dort zusätzlich verschlüsselt. Auf deinem Handy liegen sie verschlüsselt, im Browser nur bis zum Schließen des Tabs. Sie gehen nie in den Partner-Modus, nie in das PDF, nie an KI-Dienste, Werbung, Analyse-Dienste oder Shops. Einträge älter als 24 Monate löschen wir automatisch.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG).

Freiwillig: Du kannst die App ohne das Zyklus-Modul uneingeschränkt nutzen.

Widerruf: jederzeit unter Mehr → Zyklus → „Modul beenden“. Der Widerruf löscht sofort alle Zyklusdaten auf dem Server und auf diesem Gerät; andere Geräte löschen ihre Kopie beim nächsten Öffnen der App. Aus Sicherungskopien unseres Dienstleisters verschwinden sie nach spätestens 7 Tagen. Es bleibt: Trainings, die du als „leichter“ trainiert hast, bleiben im Tagebuch mit dieser Markierung und den verminderten Vorgaben – ohne Grund, denn den Knopf „Heute leichter“ gibt es für alle, auch ohne Zyklus-Modul. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.`,
  },
];
