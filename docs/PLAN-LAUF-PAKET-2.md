# Lauf-Paket 2 – Pulszonen, Belastung, Zeitprognose, GAP, Kadenz, Dunkelheit

Gründer-Freigabe „Baue alles“ (25.10.2026, Aufgabe #34). Alles wird **auf dem Gerät** aus vorhandenen Daten gerechnet:
keine neue Tabelle, keine Migration, keine Echtzeit-KI. Fachlogik in `packages/core/src/running/`, Grenzwerte mit
Quellen in `packages/core/src/constants.ts` (`HR_RESERVE_ZONES`, `LOAD_RATIO`, `RACE_PREDICTION`, `GAP_MINETTI`,
`CADENCE`, `DAYLIGHT`), Texte in `apps/mobile/src/i18n/de-runner.ts`, Oberfläche in `apps/mobile/src/components/runner.tsx`.

## 1. Überblick

| Funktion         | Wo in der App                                        | Datengrundlage                              | Core                 |
| ---------------- | ---------------------------------------------------- | ------------------------------------------- | -------------------- |
| Pulszonen        | Lauf-Detail (Uhr-Puls), Einstellung auf „Smartwatch“ | Puls-Zusammenfassung der Uhr, Ruhepuls      | `heart-zones.ts`     |
| Belastungs-Ampel | Ausdauer                                             | Tagebuch (Dauer × Anstrengung), Lauf-km     | `load-ratio.ts`      |
| Zeitprognose     | Ausdauer                                             | eigene Läufe ab 3 km, 8 Wochen              | `race-prediction.ts` |
| GAP              | Lauf-Detail (Laufen mit Höhenprofil)                 | gespeichertes Höhenprofil + Kilometerzeiten | `gap.ts`             |
| Kadenz           | Lauf-Detail (Uhr-Einheit Laufen/Gehen)               | Schritte der Uhr im Zeitraum der Einheit    | `cadence.ts`         |
| Dunkelheit       | Ausdauer (vor dem Start), Aufzeichnen (live)         | Datum + grob gerundete Position             | `daylight.ts`        |

## 2. Pulszonen

- Fünf Zonen, Anteile wie bisher 50/60/70/80/90/100 % (`HR_ZONE_PERCENTS`).
- **HFmax:** eigener Wert (120–230 /min) oder Tanaka (208 − 0,7 × Alter).
- **Herzfrequenz-Reserve (Karvonen):** Grenze = Ruhepuls + Anteil × (HFmax − Ruhepuls), wenn ein Ruhepuls bekannt ist
  und „Ruhepuls einbeziehen“ an ist (Standard: an). Ruhepuls = Median der Uhr-Tageswerte der letzten 14 Tage (mind. 3),
  sonst Körperdaten. Reserve unter 60 /min → % HFmax.
- Die **Zeit je Zone** rechnet der Abgleich mit der Uhr aus den Messwerten (wie bisher, nur mit den neuen Grenzen);
  gespeichert wird weiterhin nur die Zusammenfassung (`heart_rate_summaries`, keine Pulsreihe).
- Damit die angezeigten Bereiche zu den gerechneten Zeiten passen, merkt sich das Gerät je Uhr-Einheit die Grundlage
  (`fitnessapp.run-zone-basis.v1`: verwendeter Ruhepuls bzw. null). Ohne Eintrag (älterer Abgleich, anderes Gerät)
  zeigt die App % HFmax wie vorher.
- Einstellung (eigener Maximalpuls, Ruhepuls einbeziehen) je Konto **nur auf dem Gerät** (`fitnessapp.pulse-zones.v1`),
  nur mit Einwilligung health_data bedienbar; gilt für Einheiten, die ab dann abgeglichen werden.
- Puls ist Gesundheitsdatum: sichtbar nur mit den bestehenden Einwilligungen (wearable_data + health_data), **nie auf
  dem Story-Bild** (Positivliste unverändert, E2E prüft „/min“ und „Zone“). Löschen der Geräte-Einträge beim Abmelden,
  Konto löschen, Widerruf health_data und „Gerätedaten löschen“.

## 3. Belastungs-Ampel

- Belastungspunkte je Einheit = Minuten × Anstrengung (vorhandene Session-RPE-Logik `SPORT_LOAD`).
- akut = letzte 7 Tage, chronisch = 28 Tage ÷ 4; Verhältnis ≤ 1,3 grün, ≤ 1,5 gelb, darüber rot; unter 0,8 grün mit
  „weniger als gewohnt“.
- **10-%-Regel:** Lauf-km der letzten 7 Tage > 10 % über den 7 Tagen davor (Vorwoche ≥ 5 km) → Grün wird Gelb, Text
  nennt die Steigerung.
- Keine Ampel unter 21 Tagen Tagebuch bzw. unter 60 Punkten Wochenmittel („zu wenig Daten“).
- Sanfte Texte, Wort + Zeichen (nie nur Farbe), Hinweis „keine medizinische Aussage“.

## 4. Zeitprognose

- Riegel t2 = t1 × (d2/d1)^1,06 – dieselbe Funktion wie die Wettkampf-Pace (`riegelTime`), dieselbe Grenze
  (höchstens Faktor 4 zwischen Lauf und Ziel).
- Grundlage: eigene Läufe (Sportart Laufen) ab 3 km der letzten 8 Wochen mit plausibler Pace (2:30–12:00 min/km);
  je Ziel die schnellste Prognose. Unter 2 Läufen keine Prognose.
- Bereich ± (3 % + 4 % je Verdopplung der Distanz, + 2 % bei weniger als 4 Läufen); gerundet (5 s / 10 s / 30 s / 60 s).
- Ziel zu weit weg → „Dafür fehlt ein Lauf ab … km“.

## 5. GAP (bergbereinigtes Tempo)

- Minetti-Kostenkurve C(i) (Steigung begrenzt auf ±45 %), Profil in Stücke ≥ 50 m; GAP = Bewegungszeit ÷ „flache“
  Distanz (Σ Stück × C(i)/C(0)). Je km ebenfalls berechnet (`perSegment`, derzeit nicht angezeigt).
- Nur Laufen, ab 1 km, wenn mind. die Hälfte der Strecke ein Profil hat.

## 6. Kadenz

- Health Connect: Summe „Schritte“ im Zeitraum der Uhr-Einheit (nur Laufen/Gehen, nur mit der schon erteilten
  Freigabe „Schritte“ – keine neue Berechtigung). Ø Kadenz = Schritte ÷ Dauer (inkl. Pausen).
- Plausibel nur 100–230 (Laufen) bzw. 50–160 (Gehen), ab 5 min. Gemerkt nur auf dem Gerät
  (`fitnessapp.run-cadence.v1`), nie an den Server.
- Hinweis-Bereiche beim Laufen (unter 150 / 150–185 / darüber), ausdrücklich keine Regel.

## 7. Dunkelheit

- Sonnenauf-/-untergang und bürgerliche Dämmerung nach NOAA (Bruchjahr-Näherung) auf dem Gerät, Position auf 0,1°
  gerundet, Tag in Europe/Berlin. Kein Netz, nichts gespeichert.
- Vor dem Start: Startort des letzten gespeicherten Laufs (vor dem Start fragt die App keinen Standort ab). Beim
  Aufzeichnen: erster Punkt der laufenden Aufzeichnung.
- Hinweis bei Sonnenuntergang in ≤ 60 min, in der Dämmerung oder bei Dunkelheit, mit Tipp zu heller Kleidung/Lampe.

## 8. Lauf-Kraft / Lauf-ABC

Nicht Teil dieses Pakets: zugewiesen an den Zweig `claude/calisthenics-schlinge`. Geprüft am 25.10.2026: Der Zweig
(bereits in `claude/integration-1` enthalten) deckt Lauf-Kraft/Lauf-ABC **nicht** ab – dort weiter offen.

## 9. Tests

- Core: `packages/core/src/running/*.test.ts` (Grenzfälle: 16/90 Jahre, Reserve zu klein, 1 vs. 7 Trainingstage,
  Zukunft, Polartag/-nacht, Schaltjahr, zu wenige Läufe, Faktor 4), `wearables/sessions.test.ts` (eigene Zonen).
- App: `apps/mobile/src/data/runner.test.ts` (Gerätespeicher, Abgleich mit Beispiel-Uhr: Kadenz, Karvonen-Zonen).
- E2E: `apps/mobile/e2e/lauf-paket-2.spec.ts` (mit `SCREENSHOT_DIR` Bildschirmfotos 390 px).

## 10. Offene Punkte (fachliche Prüfung vor Livegang)

- Schwellen der Ampel (1,3/1,5, 21 Tage, 60 Punkte) und die Kopplung an die 10-%-Regel; ACWR ist umstritten.
- Unsicherheits-Bereich der Zeitprognose; Marathon-Prognose für Freizeitläufer oft zu optimistisch.
- Minetti bergab (überschätzt die Ersparnis bei steilem Gefälle); evtl. angepasste Kurve.
- Standard „Ruhepuls einbeziehen = an“: Zonen weichen dann von den Zonen der Uhr (meist % HFmax) ab.
- Eigener Maximalpuls liegt unverschlüsselt im Gerätespeicher (wie andere Einstellungen); ggf. in den geschützten
  Speicher verlegen.
- Kadenz enthält Pausen der Uhr-Einheit (eher zu niedrig).
