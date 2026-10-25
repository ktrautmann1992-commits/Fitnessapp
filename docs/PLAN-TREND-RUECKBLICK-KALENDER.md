# Gewichtstrend, Monatsrückblick, Trainings im Handy-Kalender

Stand: 25.10.2026 · Status: **umgesetzt** (Zweig `claude/trend-rueckblick-kalender`) · Gründer-Freigabe 25.10.2026
(Punkte 8, 9 und 11 der Wunschliste)

## 1. Ziel in einfachen Worten

- **Gewichtstrend** im Reiter „Fortschritt“: eine ruhige Linie statt springender Tageswerte, das Tempo pro Woche und –
  nur wenn es sicher ist – eine grobe Schätzung, wann der Trend das Wunschgewicht erreicht.
- **Monatsrückblick**: am Monatsanfang (und jederzeit) eine private Zusammenfassung des Monats, als PDF sicherbar.
- **Trainings im Handy-Kalender**: auf Wunsch stehen die geplanten Einheiten als Termine im Kalender des Handys.

Alles bleibt privat: kein Teilen, keine Serien („Streaks“), keine Ranglisten.

## 2. Gewichtstrend

**Rechnung** (`packages/core/src/review/weight-trend.ts`, Werte in `WEIGHT_TREND`, constants.ts mit Quellen):

- Exponentiell geglätteter Durchschnitt (EMA) mit **10 % je Tag** (Walker, „The Hacker's Diet“; Hunter 1986). Lücken:
  ein neuer Wert wirkt so stark wie die Tage seit dem letzten Wert zusammen (α = 1 − 0,9^Tage). Nach mehr als
  **28 Tagen** ohne Wert beginnt die Linie neu.
- Anzeige: letzte **90 Tage**; ältere Werte schwingen die Linie nur ein. Punkte = einzelne Werte (blass), Linie = Trend.
- **Tempo je Woche**: Steigung der Trendwerte der letzten 14 Tage (mindestens 5 Werte über 10 Tage, Abschnitt mindestens
  14 Tage alt). Unter ±0,1 %/Woche „etwa gleichbleibend“.
- **Schätzung** zum Wunschgewicht (nur mit `weight_goals`): nur wenn der Trend sinkt, das Tempo zwischen 0,1 % und der
  Schutzgrenze liegt (1 %/Woche, Fit im Alter 0,5 % – dieselbe Grenze wie die Ernährungs-Engine,
  `weightTrendLossLimit`) und das Ziel höchstens 52 Wochen entfernt ist. Angezeigt nur als **Monat** („etwa im
  Dezember 2026 … grobe Schätzung, keine Vorgabe“).
- **Zu schnell** (über der Grenze): Hinweis „Langsamer ist besser … iss im Zweifel etwas mehr …“ plus Hilfe-Stellen –
  **keine** Schätzung, kein Tempo-Lob.
- **Schwangerschaft/Stillzeit** (Gesundheits-Check oder Zyklus-Status „schwanger“): kein Tempo, kein „zu schnell“, keine
  Schätzung – nur die Werte.
- Letzter Wert älter als 14 Tage: „veraltet“, kein Tempo, keine Schätzung.

**Sichtbarkeit** (`data/review.ts`, `weightTrendVisibility`):

| Fall                                   | Anzeige                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| Keine gültige Einwilligung health_data | Einladung zur Einwilligung, kein Gewicht                       |
| „Kalorienzahlen anzeigen“ aus          | ausgeblendet (gleicher Schutzgedanke: kein Druck durch Zahlen) |
| Auf diesem Gerät ausgeblendet          | „ausgeblendet“ + „einblenden“ (Schalter nur auf dem Gerät)     |
| sonst                                  | Linie, Tempo, ggf. Schätzung                                   |

**Zyklus-Hinweis**: nur mit gültiger Einwilligung `cycle_data` ein fester Satz („Gewicht schwankt im Zyklus oft um
1–2 kg …“). Es werden **keine** Zyklusdaten gelesen oder gezeigt.

**Daten**: Gewicht steht schon in `body_metrics` (eine Zeile je Tag, RLS, Einwilligung). Neu ist nur das Lesen des
Verlaufs `Backend.loadWeightHistory(from)` – Supabase: eine Abfrage `measured_on, weight_kg` (nur online, nie
zwischengespeichert, nie geloggt); ohne Netz die Werte auf dem Gerät mit Hinweis. **Keine neue Tabelle, keine
Migration, kein pgTAP nötig.**

**F13 (docs/PLAN-ZIELE.md)**: Die Empfehlung „keine Kurve, keine Prognose“ ist für den Reiter Fortschritt durch die
Gründer-Freigabe vom 25.10.2026 ersetzt – mit den Schutzregeln oben. Weiterhin gilt: **keine Ziellinie** im Diagramm,
kein Fortschrittsbalken, Wunschgewicht nie im PDF, nie im Partner-Modus.

## 3. Monatsrückblick

**Rechnung** (`review/month-review.ts`, `MONTH_REVIEW`):

- **Training** aus `weekLogSummary` (wie Woche/Wochenauswertung): gemacht von geplant, ausgelassen (verpasst oder
  gestrichen – die App markiert vergangene Einheiten ohne Eintrag mit der Zeit als gestrichen; im Rückblick zählt beides
  gleich, ohne Wertung), noch offen, freie Einheiten.
- **Kilometer je Sportart** aus den Ausdauer-Einträgen (`cardio_logs`, auch freie und von der Uhr übernommene).
- **Kraft**: bis zu 3 Übungen mit der größten Steigerung des geschätzten Maximums (Epley, `E1RM_ESTIMATE`) gegenüber
  allen früheren Einträgen, ab 1 %. Angezeigt als „vorher 60 kg × 8 → jetzt 65 kg × 8“.
- **Essen nur als Anzahlen**: Tage mit Einträgen, abgehakte Mahlzeiten aus dem Essensplan – nie kcal, nie Zonen.
- **Gewicht** (nur sichtbar wie in 2): Trend am ersten und letzten Messtag des Monats, mit Datum.
- Neutrale Texte, keine Serien, kein Lob, keine Prognose.

**Wann**: vom 1. bis 7. eines Monats eine Kachel „Dein Rückblick auf <Vormonat> ist da“ im Reiter Fortschritt, bis er
geöffnet wurde (nur auf dem Gerät gemerkt, keine Benachrichtigung). Sonst der Knopf „Monatsrückblick“ mit Blättern
(Vormonat/Folgemonat). Supabase: ältere Monate als das Tagebuch auf dem Gerät (12 Wochen) zeigen einen Hinweis statt
unvollständiger Zahlen.

**PDF** (`export/month-review-document.ts`, Codes `month-review-print-texts.ts`): gleicher Weg wie Trainings- und
Essensplan (Dokumentmodell → Übersetzung → HTML → Druckdialog bzw. Druckansicht). Essen und Gewicht **nur** mit dem
Schalter „Essen und Gewicht ins PDF aufnehmen“ (Standard aus) und Bestätigung; sonst ein neutraler Satz. Zweite
Schutzschicht: Das Dokument-Schema lehnt Gesundheits-Codes ab, wenn `meta.includesHealthData` nicht gesetzt ist oder
das Dokument kein Rückblick ist. Nie im PDF: Wunschgewicht, Schätzung, Tempo, Ziele, Zyklus, Schwangerschaft, Name.

## 4. Trainings im Handy-Kalender

- **Opt-in** unter Einstellungen → „Trainings im Handy-Kalender“. Erst eine Erklärung (warum, was im Termin steht), dann
  die System-Abfrage. Abgelehnt → Hinweis mit Weg zu den Handy-Einstellungen.
- **Eigener Kalender „Alpha5 Training“** (Android: lokales Konto; iOS: Quelle des Standard-Kalenders). Termine: nur
  „Alpha5: <Name der Einheit>“, Tag, Uhrzeit, Dauer – keine Notizen, kein Ort, keine Gesundheitsangaben.
- **Termine** (`review/calendar-events.ts`): offene Einheiten des aktiven Plans von heute bis +28 Tage; Einheiten mit
  Eintrag, erledigte und gestrichene fallen weg. Uhrzeit: Trainingszeit aus dem Ernährungs-Setup, sonst wählbar
  (Standard 18:00). Dauer: geschätzte Minuten (15–300).
- **Abgleich** (`lib/device-calendar.ts`, ausgelöst von `TrainingCalendarSync` im Wurzel-Layout): nach jeder
  Plan-Änderung (Tausch, Verschieben, erledigt) und beim Tageswechsel – anlegen, ändern, löschen; nie doppelt (Abgleiche
  laufen nacheinander, Zwischenstand wird gesichert). Ausschalten bzw. Abmelden entfernt den Kalender samt Terminen.
- Auf dem Gerät gespeichert: nur Kalender-Kennung, Termin-Kennungen, Fingerabdrücke und die Uhrzeit-Wahl.
- **Browser**: kein Kalenderzugriff – stattdessen **.ics-Datei** zum Herunterladen (RFC 5545, Ortszeit „floating“).
- Berechtigungen: Android `READ_CALENDAR` + `WRITE_CALENDAR`, iOS `NSCalendarsUsageDescription` +
  `NSCalendarsFullAccessUsageDescription` (eigener Kalender braucht vollen Zugriff), **keine** Erinnerungen.

## 5. Tests

- Core (Vitest): `review/weight-trend.test.ts` (Lücken, Einzelwert, Neustart, Schwankung, sehr leicht/schwer, Fit im
  Alter, Schwangerschaft, zu schnell, keine Prognose in allen Sperrfällen), `review/month-review.test.ts` (Monatsgrenzen,
  Schaltjahr, 1 vs. 7 Tage, Kraft, Kilometer, Essen ohne kcal), `review/calendar-events.test.ts` (Fenster, Dauer,
  Abgleich, .ics mit Faltung/Escaping), `export/month-review-document.test.ts` (Gesundheits-Schalter, Schema).
- App (Vitest): `data/review.test.ts`, `lib/device-calendar.test.ts`, `lib/print-month-review.test.ts`,
  `native-config.test.ts` (Berechtigungen), `notification-permission-sites.test.ts` (Abfrage nur nach Tipp).
- E2E (Playwright, Web-Export 390 px): `e2e/trend-rueckblick-kalender.spec.ts`.

## 6. So testest du es am Handy

1. Vercel-Vorschau öffnen → „Testmodus starten“ → Onboarding mit Gewicht.
2. Mehrmals unter „Körperdaten“ ein Gewicht mit verschiedenen Messdaten eintragen → Reiter **Fortschritt** →
   „Gewichtstrend“: Linie, Tempo; unter Einstellungen → Abnehm-Ziel ein Wunschgewicht setzen → Schätzung.
3. Fortschritt → „Monatsrückblick“ → „Als PDF sichern“ → ohne und mit Schalter „Essen und Gewicht“ ansehen.
4. Einstellungen → „Trainings im Handy-Kalender“ → im Browser „Kalender-Datei herunterladen“ und in der Kalender-App
   öffnen. **Echter Handy-Kalender erst mit neuer APK/TestFlight** (neues natives Modul expo-calendar):
   GitHub-App → Actions → `eas-build` → „Run workflow“.

## 7. Offene Punkte

- **Neuer EAS-Build nötig** (expo-calendar ist ein natives Modul); auf Android und iPhone prüfen: Kalender anlegen,
  Termine nach Tausch, Ausschalten entfernt alles.
- Kein Hintergrund-Abgleich: Die Termine werden aktualisiert, wenn die App geöffnet ist (genügt für 28 Tage Vorlauf).
- Fachliche Prüfung der Texte „zu schnell“ und der Schwellen (PRODUKTENTSCHEIDUNG in constants.ts).
- Kraft-Steigerungen nutzen Epley ohne RPE-Reserve (gleiche Formel wie Lasten); Kraftkurven folgen auf eigenem Zweig.
