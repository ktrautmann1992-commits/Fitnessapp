# Erinnerungen an Training, Essen und Trinken

Gründer-Wunsch 29.10.2026: „Die App soll Benachrichtigungen senden für Essen, trinken und Trainieren.“
Branch `claude/handy-schritte-erinnerungen`. Umgesetzt als **lokale Benachrichtigungen** (expo-notifications, kein
Push-Server, kein Token) – nur in der App (Android/iPhone), im Browser nur ein Hinweis.

## Bedienung

Einstellungen → Benachrichtigungen → Karte „Erinnerungen an Training, Essen und Trinken“. Drei Schalter, Standard
**aus**; die System-Erlaubnis wird erst beim Einschalten gefragt.

| Art      | Optionen                                                                                               | Wann                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Training | Vorlauf 15 / 30 / 60 / 120 min (Standard 60)                                                           | Vor dem Start der Einheit (eigene Uhrzeit `planned_sessions.start_time`, sonst „Trainingszeit“, „ca.“). Ohne jede Uhrzeit einmal um 08:00 „Heute steht Training an“.                                                                                                                                                                                                                                                         |
| Essen    | Essenszeiten Frühstück / Mittag / Abend (Standard 07:30 / 12:30 / 18:30, 07:00–21:30, 30-min-Schritte) | Mahlzeiten aus dem gespeicherten Essensplan mit Gericht im Text, ohne Plan Frühstück/Mittag/Abend. Mahlzeit vor/nach dem Training mit eigenem Titel. Fehlt vor dem Training eine Mahlzeit/ein Snack → „Kleiner Snack vor dem Training“ 60 min vorher; fehlt danach eine Mahlzeit → Hinweis 15 min nach dem Ende. Diese Hinweise wandern mit, wenn die Einheit verschoben wird. Snacks ohne Trainingsbezug: keine Erinnerung. |
| Trinken  | Zeitfenster (Standard 08–20 Uhr, 07–22 Uhr möglich), stündlich / 1,5 / 2 / 3 Std.                      | Im Fenster; entfällt, wenn eine andere Erinnerung näher als 20 min liegt.                                                                                                                                                                                                                                                                                                                                                    |

## Regeln (packages/core `reminders.ts`, Werte in `constants.ts` `REMINDERS`)

- **Nachtruhe 22:00–07:00**, nicht abschaltbar; nichts über Mitternacht hinaus (eine Erinnerung vor einem Training
  um 00:30 entfällt).
- Höchstens die **nächsten 7 Tage** und **60** Benachrichtigungen (iOS-Grenze 64); Uhrzeiten in der Zeitzone des
  Geräts inkl. Sommerzeit (`zonedTimeToUtcMs`).
- Snack-Hinweis entfällt neben einer Trainings-Erinnerung zur selben Zeit (nie zwei Meldungen direkt hintereinander).
- **Trink-Tagesziel erreicht** (Nachtrag 30.10.2026): Ist die heutige Menge im Trink-Tracker ≥ Tagesziel
  (`drinkProgress`, `drinkGoalReached`), entfallen die restlichen Trink-Erinnerungen dieses Tages (Folgetage
  unverändert). Sinkt die Menge wieder darunter (Eintrag zurückgenommen) oder steigt das Ziel (Training, Wärme),
  kommen sie wieder. Ohne Ziel (Herz/Niere, kein Gewicht) oder ohne Tracker-Stand: wie bisher. Ein Stand von gestern
  wirkt nach Mitternacht nicht.
- Vitest: Mitternacht, Sommer-/Winterzeit Europe/Berlin, Einheit verschoben, keine Einheit, 1 vs. 7 Trainingstage,
  Grenze 60, ungültige Einstellungen; Trink-Ziel genau erreicht, knapp darunter, über Mitternacht, Ziel geändert,
  ohne Ziel, kein Tracker.

## App (apps/mobile)

- `lib/reminder-prefs.ts`: Geräte-Einstellung (`fitnessapp.reminder-prefs.v1`, keine Nutzerdaten).
- `lib/reminders.ts`: Tage aus den Zeilen (aktiver Plan, offene Einheiten, `mealPlans[].plan`), feste Texte.
- `lib/notifications.ts` `syncReminders`: ersetzt nur Geändertes, storniert Weggefallenes (gemerkt in
  `fitnessapp.reminder-scheduled.v1`), ohne Erlaubnis alles storniert; `reset` (Abmelden/Konto löschen) löscht alles.
- `components/reminders.tsx` `ReminderScheduler` im Wurzel-Layout: plant beim App-Start, bei Rückkehr in die App,
  bei jeder Plan-/Einstellungsänderung (Zeilen), bei Tageswechsel und bei jedem Eintrag im Trink-Tracker neu.
- `state/use-drink-progress.ts`: heutige Menge (Trink-Tracker, nur wenn Trink-Erinnerungen an) und Tagesziel – wie auf
  der Karte „Trinken“ (`lib/hydration-status.ts`, inkl. Wärme und Nieren-Angabe, nur Arbeitsspeicher); vor der ersten
  Anzeige der Karte (Neustart) aus den Zeilen (Gewicht, Alter, Training, Herz-Angabe).
- Android-Kanäle je Art: „Training“, „Essen“, „Trinken“ (leiser) – einzeln in den System-Einstellungen abschaltbar.
- Antippen öffnet „Heute“ (Training), „Ernährung“ (Essen), „Übersicht“ (Trinken).
- Texte ohne Gesundheitswerte: nur Uhrzeit, Name der Einheit bzw. Gericht (kein Gewicht, keine kcal, kein Zyklus).
- Web: Testmodus zeigt die Karte zum Ausprobieren (Hinweis „nur in der App“), Supabase-Modus nur den Hinweis.

## So testest du es am Handy

1. Android-APK installieren (EAS-Build), App öffnen.
2. Einstellungen → Benachrichtigungen → „Training“ einschalten → „Zulassen“ tippen.
3. Im Training-Reiter einer Einheit heute eine Uhrzeit geben (z. B. in 70 Minuten) → Erinnerung nach 10 Minuten.
4. „Essen“ und „Trinken“ einschalten, Zeiten anpassen.
5. Android-Einstellungen → Apps → Alpha5 → Benachrichtigungen: Kanäle „Training“, „Essen“, „Trinken“ sichtbar.

## Einschränkungen

- Wird die App länger als 7 Tage nicht geöffnet, laufen die Erinnerungen aus (kein Hintergrund-Planen).
- Android ohne „exakte Wecker“: Meldungen können im Energiesparen einige Minuten später kommen.
- Trink-Erinnerungen enden mit erreichtem Tagesziel nur, wenn die App danach einmal geplant hat (Eintrag in der App,
  App-Start, Rückkehr) – ohne Eintrag in der App weiß sie nichts vom Trinken. Nach einem Neustart gilt bis zur
  Anzeige der Karte „Trinken“ das Ziel ohne Wärme- und Nieren-Angabe.
- Ein Essensplan, der nur als Datenbank-Zeilen (ohne vollständigen Plan) vorliegt, liefert keine Gerichte – dann
  Frühstück/Mittag/Abend; nach dem Öffnen von „Ernährung“ ist der Plan da.
- Die bisherige Einzel-Erinnerung „Snack vor dem Training“ in der Zeitleiste bleibt unabhängig bestehen.
