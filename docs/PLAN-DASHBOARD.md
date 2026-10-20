# Bau-Plan – Anmelden, Mein Konto, Übersicht und Menüleiste

**Status:** **Freigegeben (18.10.2026)** – Gründer-Wünsche vom 18.10.2026 (siehe Abschnitt 1). **Umgesetzt – Stand 18.10.2026** (Abschnitt 6).

**Grundlage:** `CLAUDE.md` (Fachlogik nur in `packages/core`, Texte Deutsch, Leer-/Fehler-/Ladezustände,
Gesundheitsdaten nur mit Einwilligung, keine Gesundheitsdaten in Logs, KI nur Premium, kein Teilen),
`docs/DESIGN.md` (Design-Tokens aus `packages/ui`), `docs/KONZEPT.md` Abschnitt 5 (Tagesansicht) und
`docs/PLAN-ZIELE.md` F13 (kein Fortschritt zum Wunschgewicht auf „Heute“/„Fortschritt“/Übersicht).

---

## 1. Gründer-Entscheidungen (18.10.2026)

| Nr.  | Frage                            | Entscheidung                                                                            |
| ---- | -------------------------------- | --------------------------------------------------------------------------------------- |
| D-G1 | Wie meldet man sich an?          | **Startbildschirm „Anmelden“ + Bereich „Mein Konto“.** Nur E-Mail mit 6-stelligem Code. |
| D-G2 | Passwort, Google, Apple?         | **Nein.** Kein Passwort, kein Google-/Apple-Login (bleibt eine Vormerkung).             |
| D-G3 | Wie sieht die Startseite aus?    | **Kacheln + untere Menüleiste** („Übersicht“).                                          |
| D-G4 | Menüleiste                       | **Übersicht · Training · Ernährung · Fortschritt · Mehr**                               |
| D-G5 | Wunschgewicht auf der Übersicht? | **Nein** (F13 aus `docs/PLAN-ZIELE.md`): kein Wunschgewicht, kein Balken, keine Kurve.  |

## 2. Aufbau

### 2.1 Startbildschirm (ohne Sitzung)

- Route bleibt **`/welcome`** (immer dunkel, Marke Alpha5). Zwei klare Wege:
  1. **„Neu hier – Los geht's“** → Altersprüfung (`/age`) → Konto/Testmodus → Onboarding wie bisher.
  2. **„Anmelden“** (nur mit Datenbank, Supabase-Modus) → `/account?login=1`.
- **Testmodus** (ohne Supabase): statt „Anmelden“ ein kurzer Hinweis, dass Anmelden erst mit der Datenbank geht und
  im Testmodus alles nur auf diesem Gerät bleibt. Der Ablauf „Los geht's → Testmodus starten“ bleibt unverändert.

### 2.2 Anmelden mit Code (`/account`)

- Vorhandener Bildschirm `account.tsx` und vorhandene Backend-Funktionen (`signInWithOtp`, `verifyOtp` mit
  `type: 'email'`) – nichts doppelt.
- Neu: **„Code erneut senden“ erst nach 60 Sekunden**, mit sichtbarem Countdown („in 42 s“) und Ansage für den
  Bildschirmleser; Hinweis **„Schau auch im Spam-Ordner nach“**; verständliche Fehler (vorhanden in `errorText`):
  429/Rate-Limit → „Zu viele Versuche …“, falscher/abgelaufener Code → „Der Code ist falsch oder abgelaufen …“.
- Die Sperre rechnet eine reine Funktion (`apps/mobile/src/lib/otp-cooldown.ts`, mit Tests) – Anzeige-Logik, keine
  Fachlogik.
- Nach dem Code: **Profil vorhanden → Übersicht**, **kein Profil → Onboarding** (Altersprüfung zuerst). Das entscheidet
  wie bisher `resolveEntryRoute` (Ziel jetzt `/uebersicht` statt `/today`).

### 2.3 Mein Konto (`/konto`)

- Angemeldete E-Mail (Testmodus: „Testmodus – kein Konto, Daten nur auf diesem Gerät“).
- **Abmelden mit Rückfrage**; liegen noch Trainings/Einträge zum Senden vor, gilt die vorhandene Nachfrage (R6).
  Beim Abmelden werden wie bisher die lokalen sensiblen Daten gelöscht (`backend.signOut` + „Nur heute“-Tausche).
- **Einwilligungen** (`/einwilligungen`): derselbe Block wie in den Einstellungen (ausgelagert in eine Komponente,
  nicht kopiert).
- **Daten exportieren** und **Konto löschen**: aus den Einstellungen hierher verschoben (gleiche Funktionen, gleiche
  Dialoge, gleiche Testkennungen). Die Einstellungen verlinken auf „Mein Konto“.
- **Lizenzen** (`/lizenzen`).
- **E-Mail ändern: weggelassen** (Vormerkung, Abschnitt 5).

### 2.4 Übersicht (`/uebersicht`) – neue Startseite

Kacheln, jede führt in den vorhandenen Bereich:

| Kachel                                    | Inhalt                                                                                                                                | Ziel                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Training heute                            | heutige Einheit (Name, erledigt?) mit **„Training starten“** bzw. Ruhetag + nächste Einheit; kein Plan → „Plan erstellen“ im Training | `/workout/…` bzw. `/today`      |
| Ernährung heute                           | nächste Mahlzeit, Einträge heute; **kcal nur bei „Kalorienzahlen anzeigen“ an**                                                       | `/ernaehrung`                   |
| Körperdaten                               | **letztes Gewicht nur mit Einwilligung und nur, wenn vorhanden**; ohne Einwilligung ein Hinweis; nie Wunschgewicht/Prognose (F13)     | Einstellungen bzw. Einwilligung |
| Fortschritt                               | „Diese Woche: x von y Einheiten erledigt“                                                                                             | `/fortschritt`                  |
| Rezepte, Übungen, Einkaufsliste, Kalender | kleine Schnellzugriffe                                                                                                                | vorhandene Bereiche             |

- Daten für die Kacheln aus reinen Funktionen in **`packages/core/src/dashboard.ts`** (`trainingToday`,
  `weekTrainingProgress`, `latestBodyWeight`) mit Unit-Tests.
- **Nichts aus „Heute“ geht verloren:** „Heute“ bleibt vollständig erhalten und ist jetzt der Reiter **„Training“**
  (Karten „erreicht“/„Zeitraum vorbei“, „Plan neu erstellen?“, Entwürfe, Konflikte, Hinweise, Wettkampf-Countdown).
  Wartet dort etwas (Entwurf, Konflikt, neue Einwilligungsfassung, Plan-Hinweis, fremde Daten, abgelaufene Sitzung),
  zeigt die Übersicht oben einen Hinweis **„Im Training wartet etwas auf dich“** mit Knopf.
- Lade-, Fehler- und Leerzustände je Kachel (Plan fehlt, Ernährung noch nicht eingerichtet, keine Einwilligung).

### 2.5 Fortschritt (`/fortschritt`)

Kleiner Sammelbereich: Wochenzahlen (Einheiten erledigt), Links zu Wochenauswertung, Trainingswoche, Verlauf,
Kalender. Kein Wunschgewicht, keine Kurve zum Ziel (F13).

### 2.6 Mehr (`/mehr`)

Mein Konto, Einstellungen, Rezepte, Übungen, Ratgeber, Einkaufsliste, Meal-Prep, Wettkampf, Lizenzen.

## 3. Navigation

- **Expo Router Tabs** in der Gruppe `src/app/(tabs)/`: `uebersicht`, `today` (Reiter „Training“), `ernaehrung`
  (Reiter „Ernährung“), `fortschritt`, `mehr`. Die Adressen bleiben gleich (`/today`, `/ernaehrung` …), Gruppen
  ändern keine URL – alle Deep-Links und Vorschau-Links funktionieren weiter.
- Eigene Menüleiste (`components/tab-bar.tsx`) aus den Design-Tokens, hell/dunkel, Tippfläche ≥ 56 px, Symbol +
  Beschriftung, Bildschirmleser: Rolle „Tab“, „ausgewählt“, Beschriftung je Reiter.
- **Ohne Leiste:** Startbildschirm, Anmelden, Onboarding, Training durchführen (`/workout/…`), Druckansichten und
  alle Unterseiten (sie liegen im Stapel über den Reitern und haben „Zurück“).
- Einstieg nach dem Start bzw. der Anmeldung: **`/uebersicht`** (`HOME_ROUTE` in `state/flow.ts`).
  „Geschafft! → Zum Plan“ und „Angaben ändern“ führen wie bisher zu „Heute“ (Reiter Training).

## 4. Prüfen

`pnpm format:check`, `pnpm check`, Playwright (alle Specs, Handy-Ansicht), neue E2E-Tests für Startbildschirm,
Anmelden (Testmodus), Übersicht, Menüleiste und Mein Konto; Bildschirmfotos hell/dunkel.

## 5. Offene Punkte / Vormerkungen

- **E-Mail ändern:** braucht `auth.updateUser({ email })` mit Bestätigungscode an die neue Adresse
  (`verifyOtp` mit `type: 'email_change'`) und eine angepasste E-Mail-Vorlage „Change Email Address“ mit
  `{{ .Token }}` in Supabase. Das ist mit der vorhandenen Infrastruktur nicht sicher prüfbar → vorgemerkt.
- **Mit Apple/Google anmelden:** bewusst nicht (D-G2).
- **Anmelden im Supabase-Modus** ist in den E2E-Tests der CI nicht abgedeckt (sie laufen im Testmodus); die
  Sperr-Logik ist per Unit-Test geprüft, der Ablauf wurde einmalig mit einem Supabase-Web-Export und gemockten
  Auth-Antworten geprüft (Countdown 60 → 42 s, Spam-Hinweis, 429, abgelaufener Code). Live-Test mit echter
  Datenbank: `docs/HANDY-ANLEITUNG.md` Teil 7m B.

## 6. Umsetzungsstand (18.10.2026)

- **Core:** `packages/core/src/dashboard.ts` (`trainingToday`, `weekTrainingProgress`, `latestBodyWeight`) mit Tests
  (Grenzfälle: kein Plan, Ruhetag/Planende, gestrichen, 1 und 7 Trainingstage, Wochenwechsel, sehr leicht/schwer,
  unmögliche Werte).
- **App:** Gruppe `src/app/(tabs)/` mit eigener Menüleiste (`components/tab-bar.tsx`); `today.tsx` und
  `ernaehrung/index.tsx` liegen jetzt dort (Adressen unverändert, „Ernährung“ ohne „Zurück“). Neu: `uebersicht.tsx`,
  `fortschritt.tsx`, `mehr.tsx`, `konto.tsx`, `einwilligungen.tsx`, `components/consent-settings.tsx` (aus den
  Einstellungen ausgelagert), `components/dashboard.tsx`, `lib/otp-cooldown.ts`. `HOME_ROUTE = '/uebersicht'`
  (`state/flow.ts`) ersetzt in allen Bildschirmen den Vergleich mit `/today`.
- **Einstellungen:** Abmelden, Datenexport und Konto löschen → „Mein Konto“; dort Abmelden mit Rückfrage. Der Hinweis
  „Mit Apple/Google anmelden folgen später“ ist entfernt (D-G2).
- **Body-Daten aus der Übersicht:** „Gewicht eintragen“ öffnet den vorhandenen Schritt Körperdaten
  (`?edit=1&zurueck=uebersicht`) und kehrt zur Übersicht zurück.
- **Tests:** `e2e/dashboard.spec.ts` (Startbildschirm, Kacheln, Menüleiste, ohne Einwilligung, „Im Training wartet
  etwas“, Mein Konto); bestehende Specs nur in der Navigation angepasst (Neustart → Übersicht, Export/Abmelden unter
  „Mein Konto“). Bildschirmfotos hell/dunkel in `e2e/screenshots.spec.ts` ergänzt.
- **Keine Migration**, keine neuen Secrets.

### Nachbesserung nach der Wächter-Prüfung (18.10.2026)

- **H1:** „Plan neu erstellen?“ und „Im Training wartet etwas“ kommen aus einer gemeinsamen Auswertung für „Heute“ und
  die Übersicht (`planNotice`, `trainingAttentionReasons` in `packages/core/src/dashboard.ts`, App-Seite
  `src/data/training-attention.ts`). Strengere Regeln bzw. abgelaufener Plan: eigener roter Hinweis auf der Übersicht,
  **kein** „Training starten“. Geänderte Angaben: Hinweis „Deine Angaben haben sich geändert …“.
- **M1/N7:** Wege aus dem Stapel in den Reiter „Ernährung“ nutzen `router.dismissTo` (keine zweite Reiter-Instanz);
  ein gewählter anderer Tag (`?tag=`) zeigt „Zu heute“ (und „Zurück“, wenn möglich); Antippen des Reiters springt
  auf heute.
- **M2/N3/N4:** Countdown-Ansage per Live-Region (`aria-live="polite"`, nur bei 30/10/0 s), Uhr stoppt bei 0, nach 429
  ebenfalls 60 s Sperre (auch „Code senden“).
- **N1/N2:** Nur warnende Trainings-Rückmeldungen (Konflikt, abgelehnt, ungültig) und der Wettkampf-Hinweis „passt
  nicht“ zählen für den Sammelhinweis.
- **N5:** `trainingToday` nutzt `sessionOn`/`nextPlannedSession` aus `plan/view.ts`.
- **N6:** „Training starten“ nur mit berechneter Vorgabe (`workoutView`), sonst Grund statt Knopf.
- **N8:** `viewport-fit=cover` in `public/index.html`; die sicheren Ränder liest react-native-safe-area-context im
  Browser über `env(safe-area-inset-*)` – die Menüleiste bleibt über der Home-Leiste.

## 7. Änderung der Menüleiste (20.10.2026, Etappe E1 „Einkaufen“)

- Gründer-Entscheidung EA-G1/EA-1 (`docs/PLAN-EINKAUFEN-AUSDAUER.md`): Standard-Menüleiste **Übersicht · Training ·
  Ernährung · Einkaufen · Mehr**. Der Reiter „Einkaufen“ ist die Einkaufsliste (`src/app/(tabs)/einkaufsliste.tsx`,
  Adresse unverändert `/einkaufsliste`; Drucken/Weitergeben bleiben Unterseiten). Wege aus Unterseiten dorthin nutzen
  `router.dismissTo` (wie „Ernährung“, M1).
- „Fortschritt“ bleibt als Reiter-Bildschirm (`/fortschritt`) und ist über die Kachel und **Mehr → Fortschritt**
  erreichbar; ist er offen, ist kein Knopf markiert. Die Übersicht-Kachel „Einkaufsliste“ und „Mehr“ führen in den
  Reiter.

## 8. Übersicht und Menüleiste anpassen (20.10.2026, Etappe E2) – Umsetzungsstand

- Gründer-Entscheidung EA-G2 (`docs/PLAN-EINKAUFEN-AUSDAUER.md` 4) und Gründer-Wunsch „Workouts mit eigenem Menü“
  (20.10.2026). **Core** `packages/core/src/layout.ts` (+ `APP_LAYOUT` in `constants.ts`): Kacheln `training`,
  `nutrition`, `body`, `progress`, `shortcuts`; Bereiche `uebersicht`, `today`, `workouts`, `ernaehrung`,
  `einkaufsliste`, `fortschritt`, `mehr`. Regeln: „Übersicht“ immer links, „Mehr“ immer rechts, **3 bis 6 Knöpfe**,
  jeder Bereich einmal; Hinweise oben sind keine Kacheln (nie ausblendbar); alle Kacheln aus ist erlaubt.
  `normalizeLayout` macht jeden Speicherstand gültig (unbekannte/doppelte IDs raus, neue Kacheln an ihrer Standardstelle,
  kaputter Speicher → Standard). Standard: alle Kacheln, Menüleiste **Übersicht · Training · Workouts · Ernährung ·
  Einkaufen · Mehr**.
- **Workouts (zusammengeführt mit der Workout-Bibliothek, PR #123):** Bereich `workouts` steht in
  `apps/mobile/src/lib/app-areas.ts` (`AVAILABLE_AREAS`) und als Reiter in `src/app/(tabs)/_layout.tsx`; Standard also
  6 Knöpfe. Die Kachel **„Workouts“** (`WorkoutsTile`) steht auf der Übersicht hinter „Training heute“ und lässt sich
  wie jede Kachel aus- und umstellen. Ist „Workouts“ nicht in der Menüleiste, zeigt „Mehr“ ihn unter „Weitere
  Bereiche“ (sonst wie bisher bei „Inhalte“). Ein künftiger neuer Bereich kommt in `AVAILABLE_AREAS` und
  `(tabs)/_layout.tsx` dazu; wer die Menüleiste schon selbst angepasst hat, findet ihn unter „Mehr“.
- **App:** Übersicht → **„Bearbeiten“** (`components/dashboard-edit.tsx`): je Kachel „… anzeigen“, „Nach oben“/„Nach
  unten“ (Ansage „Ernährung heute ist jetzt an Stelle 1 von 5.“ per Live-Region), „Menüleiste anpassen“, „Auf Standard
  zurücksetzen“, „Fertig“. **„Menüleiste anpassen“** (`/menueleiste`, aus „Mehr“ und „Bearbeiten“): Bereiche an/aus,
  „Nach links“/„Nach rechts“, Gründe bei Regelverstoß („Mindestens 3 Knöpfe …“, „Höchstens 6 Knöpfe …“), Vorschau,
  Zurücksetzen. **„Mehr“** zeigt automatisch alle Bereiche ohne Knopf („Weitere Bereiche“). Bei 6 Knöpfen etwas kleinere
  Beschriftung und Symbolfläche; geprüft bei 320 px Breite.
- **Speicherung:** Tabelle `app_layout_settings` (Migration `20261020130000_app_layout_settings.sql`, eine Zeile je
  Person, RLS nur eigene Zeile, Schreiben nur über `save_app_layout` mit denselben Regeln, kein Gesundheitsdatum – bleibt
  beim Widerruf, im Export, Kaskade beim Konto-Löschen; pgTAP 62). Supabase-Modus: sofort lokal, Senden über die
  vorhandene Warteschlange (offline möglich); Testmodus: Gerätespeicher.
- **Tests:** `layout.test.ts` (Ränder, alle aus, 7. Knopf, ohne Mehr/Übersicht, unbekannte IDs, neue Kachel,
  fehlender Bereich, Idempotenz), `app-layout.test.ts` (Testmodus, Regeln, Export, Widerruf), db-sync (ID-Listen und
  Grenzen = Core), Playwright `dashboard-edit.spec.ts`.
