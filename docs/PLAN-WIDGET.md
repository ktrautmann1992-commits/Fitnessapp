# Plan: Widget auf dem Startbildschirm („Alpha5 – Heute“)

Gründer-Entscheidung 25.10.2026: Ein Widget zeigt **Training heute** (Name oder „Ruhetag“), einen **Schritte-Ring**
(Schritte / Ziel) und **„kcal übrig“** (nur wenn die Person Kalorienzahlen sieht). Antippen öffnet die App auf
**Heute**. Testanleitung: docs/HANDY-ANLEITUNG.md Teil 9d.

## 1. Umfang und Stand

|                               | Android                                           | iPhone                        | Browser                              |
| ----------------------------- | ------------------------------------------------- | ----------------------------- | ------------------------------------ |
| Widget                        | ✅ umgesetzt (react-native-android-widget 0.24.0) | ⏳ Folgeschritt (Abschnitt 7) | – (nur Hinweis in den Einstellungen) |
| Schalter in den Einstellungen | ✅                                                | Hinweis „kommt später“        | Hinweis                              |

Größen: 2 × 2 (klein) und auf bis 4 × 2 vergrößerbar (mittel, ab 250 dp Breite eigene Kacheln für Schritte und kcal).
Hell und dunkel nach Systemdesign.

## 2. Datenfluss

1. **Stand bauen** – `buildWidgetSnapshot` in `packages/core/src/widget.ts` (reine Funktion, Tests in
   `widget.test.ts`). Inhalt (Aufbau `WIDGET_SNAPSHOT.version` = 1): Trainingsnamen für heute + 6 Tage (Kürzung auf 60
   Zeichen; angezeigte „sichere“ Namen wie in Heute), heutige Schritte + Ziel, kcal „übrig“/„erreicht“/„zu viel“ als
   eine Zahl. **Nicht** enthalten: Gewicht, Zyklus, Gesundheits-Check, Namen von Beschwerden, Ziel- oder
   Gegessen-kcal, Mahlzeiten, Puls, Schlaf.
2. **Schreiben** – `apps/mobile/src/widget/widget-sync.tsx` (im Layout der Reiter): beim Öffnen, bei jeder inhaltlichen
   Änderung (z. B. nach dem Smartwatch-Abgleich, nach einem Tagebuch-Eintrag), beim Zurückkehren in die App und beim
   Wechsel in den Hintergrund. Nur wenn der Schalter an ist. Gespeichert **verschlüsselt** (AES-256-GCM, eigener
   Schlüssel im Android-Keystore; `widget-store.android.ts`). Danach wird das Widget sofort neu gezeichnet.
3. **Anzeigen** – `widgetView` in `packages/core` entscheidet: Schalter aus → „Widget aus“; kein/kaputter Stand oder
   **älter als 24 h** (bzw. > 10 min „aus der Zukunft“) → „App öffnen zum Aktualisieren“; **neuer Tag** (< 24 h) →
   Training des neuen Tages aus dem Stand, Schritte/kcal von gestern **nicht** mehr, dafür der Hinweis „App öffnen zum
   Aktualisieren“. Android ruft die Hintergrund-Aufgabe beim Hinzufügen, bei Größenänderung und **stündlich**
   (`updatePeriodMillis`) – ohne Netz, nur der gespeicherte Stand.
4. **Aussehen** – `widget-layout.ts` (Datenmodell mit Tests, Farben nur aus `packages/ui`: Training = Blau mit
   Verlauf, Schritte = Bereich „ausdauer“ Orange, kcal = Bereich „ernaehrung“ Grün; Ziel erreicht = Erfolgsfarbe,
   „zu viel“ = Rot) → `today-widget.android.tsx` (Umsetzung mit FlexWidget/TextWidget/SvgWidget). Antippen: Deep Link
   `fitnessapp://today` (Heute), bei „Widget aus“ `fitnessapp://settings`.

## 3. Datenschutz und Regeln (CLAUDE.md)

- **Standard aus.** Schalter „Widget auf dem Startbildschirm“ unter Einstellungen → Startbildschirm, mit Hinweis, dass
  der Inhalt auf dem Startbildschirm für alle sichtbar ist, die das entsperrte Handy sehen. Solange aus, wird **nichts**
  gespeichert; Ausschalten löscht den Stand samt Schlüssel.
- **Gleiche Freigaben wie die Kacheln der Übersicht:** Schritte nur mit verbundener Uhr und gültigen Einwilligungen
  „Smartwatch-Daten“ + „Gesundheitsdaten“; kcal nur mit „Kalorienzahlen anzeigen“ = an, **nicht** in
  Schwangerschaft/Stillzeit (`showNumbers` der App, `weekHidesEnergyNumbers`) und mit gültiger Einwilligung
  Gesundheitsdaten. `buildWidgetSnapshot` prüft die Freigaben ein zweites Mal. Widerruf → beim nächsten Schreiben
  verschwinden die Zahlen.
- **Abmelden, Konto löschen, „Testdaten löschen“:** Schalter aus, Stand + Schlüssel gelöscht, Widget zeigt „Widget aus“.
- Kein Netz, keine Logs, keine Analytics, keine Freigabe an andere Apps (Widget-Empfänger `exported=false`).
- **Bibliothek ab 0.24.0:** Die Bibliothek zeichnet das Widget als Bild und gibt es dem Startbildschirm über einen
  exportierten Bild-Provider. Bis 0.23 waren die Dateinamen erratbar (andere Apps hätten das Bild mit Schritten/kcal
  lesen können); 0.24.0 hängt ein Zufallstoken an. Deshalb fest 0.24.0 (Test in `native-config.test.ts`).
- Keine neue Android-Berechtigung (Test „nur erlaubte Berechtigungen“ in `native-config.test.ts`).

## 4. Dateien

- `packages/core/src/widget.ts` (+ Test), `WIDGET_SNAPSHOT` in `constants.ts`
- `apps/mobile/src/widget/` – `widget-sync.tsx`, `widget-state.ts`, `widget-prefs.ts`, `widget-store(.android).ts`,
  `widget-bridge(.android).ts`, `widget-layout.ts` (+ Test), `today-widget.android.tsx`, `register(.android).ts`,
  `reset.ts`, `widget-settings.tsx`, `widget-names.ts`
- `apps/mobile/index.ts` (neuer Einstieg: Expo Router + Hintergrund-Aufgabe des Widgets), `package.json` `main`
- `apps/mobile/app.config.ts` – `HOME_WIDGET` + Plugin `react-native-android-widget`
- `apps/mobile/assets/images/widget-preview.png` – Vorschau in der Widget-Auswahl
- Texte: `apps/mobile/src/i18n/de-widget.ts`

## 5. Prüfung ohne Handy (erledigt)

- Tests core + mobile grün; `expo config --type public` ok; `expo prebuild --platform android --no-install` in einer
  Kopie: Empfänger `.widget.AlphaToday` (nicht exportiert), `res/xml/widgetprovider_alphatoday.xml` (2 × 2, bis
  420 × 240 dp, stündlich), Vorschaubild, Beschreibung. Native Ordner werden **nicht** eingecheckt (EAS erzeugt sie).
- Web-Export: Bibliothek nicht im Browser-Bündel. Android-JS-Bündel (`expo export --platform android`): Widget-Aufgabe
  und Deep Link enthalten.

## 6. Risiken

- **Erst der echte Build zeigt es:** Hintergrund-Aufgabe (Headless JS) unter React Native 0.86 / neue Architektur ist
  mit 0.24.0 nicht von uns auf einem Gerät geprüft. Fällt sie aus, zeigt das Widget nur das, was die App beim letzten
  Öffnen gezeichnet hat (App zeichnet selbst neu).
- Startbildschirme (Samsung One UI) runden und skalieren Widgets unterschiedlich – Text kann in 2 × 2 knapp werden
  (2 Zeilen Trainingsname, Zahlen gekürzt).
- Stündliche Aktualisierung: Android kann sie im Energiesparen verzögern; dann wechselt das Training nach Mitternacht
  etwas später.
- Schrift: Systemschrift (nicht Plus Jakarta Sans) – bewusst, keine Schriftdateien im Build.

## 7. iPhone (Folgeschritt)

Machbar ohne Mac (EAS baut), aber eigener Schritt mit Apple-Einrichtung:

- Weg: **expo-widgets** (offizielles Expo-Paket, in SDK 57 enthalten, `~57.0.22`; Widget in JSX mit `@expo/ui`) – es
  legt das Widget-Ziel (App Extension) und die App Group (`group.de.fitnessapp.app`) per Config-Plugin an. Alternative:
  `@bacons/apple-targets` 4.0.7 mit Swift/WidgetKit (mehr Eigenbau).
- Daten: derselbe Stand (`buildWidgetSnapshot`) in die App Group (geteilte UserDefaults) bzw. über
  `Widget.updateSnapshot` von expo-widgets; Anzeige-Regeln (`widgetView`) bleiben gleich.
- Risiken: neue Bundle-ID der Extension + App-Group-Fähigkeit brauchen neue Provisioning-Profile; der Workflow
  `eas-ios-setup`/ASC-Schlüssel muss sie anlegen, sonst scheitert der iPhone-Build mit „Credentials are not set up“.
  Daten in einer App Group sind nicht mit unserem Keystore-Schlüssel verschlüsselt → nur der kleine Stand dort, mit
  Dateischutz „bis zum ersten Entsperren“. Erst nach dem ersten erfolgreichen TestFlight-Build angehen.
