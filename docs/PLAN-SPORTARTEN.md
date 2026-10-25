# Sportarten Stufe 2 – eintragen, von der Uhr übernehmen, kcal und Belastung

Gründer-Freigabe 25.10.2026. Sportarten **ohne eigene Trainingspläne**: eintragen bzw. nachtragen, mit GPS
aufzeichnen (wo sinnvoll) und von der Uhr übernehmen – jeweils mit kcal und Trainingsbelastung.

## 1. Umfang

| Gruppe             | Sportarten                                                        | GPS                  |
| ------------------ | ----------------------------------------------------------------- | -------------------- |
| Ballsport          | Fußball, Basketball, Volleyball, Handball                         | –                    |
| Rückschlag         | Padel, Tennis, Badminton, Tischtennis                             | –                    |
| Klettern           | Bouldern, Klettern (Halle/Fels)                                   | –                    |
| Kampfsport         | Boxen, Kickboxen, Judo/BJJ, Karate, Kampfsport (sonstige)         | –                    |
| Wintersport        | Skilanglauf, Skitour, Ski alpin, Snowboard                        | Skilanglauf, Skitour |
| Wassersport        | SUP, Kajak/Kanu                                                   | ja                   |
| Fitness & Ausdauer | Crosstrainer, Spinning/Indoor-Cycling, HIIT/Zirkel, Inline-Skaten | Inline-Skaten        |
| Tanzen             | Tanzen                                                            | –                    |
| Sonstiges          | Sonstige Sportart                                                 | –                    |

Schwimmen bleibt wie bisher Ausdauer-Art (Laufen, Gehen, Rad, Schwimmen). „Kampfsport (sonstige)“ ist zusätzlich zur
Freigabe aufgenommen, damit die Health-Connect-Art MARTIAL_ARTS eine passende Sportart hat.

## 2. Datenmodell (additiv)

- Enum `sport_type` (= `SPORT_IDS`), Spalten `session_logs.sport`, `sport_duration_s` (60–43 200 s),
  `sport_distance_m` (0–500 000 m, nur GPS-Sportarten); alle `null` bei Kraft/Ausdauer.
- Ein Sportart-Eintrag ist eine **freie Einheit der Art „strength“ ohne Übungen und ohne Ausdauer**, Name = Name der
  Sportart (feste Liste), Anstrengung in `session_rpe`. So bleiben Pläne, Progression, Kalibrierung, 10-%-Regel und
  Strecken unberührt. CHECK in der Datenbank, Regeln in `save_session_log` (neueste Fassung + optionales Feld `sport`,
  Migration `20261025160100_sportarten.sql`), gleich in Zod (`sportLogSchema`) und im Testmodus.
- Uhr: `import_wearable_batch` bleibt unverändert. „Sonstige“ Uhr-Einheiten werden wie bisher mit deutschem Titel
  gespeichert; die App leitet die Sportart aus dem Titel ab (`sportFromWearableTitle`). Ausnahme: „Skaten“, „Skifahren“,
  „Snowboarden“ heißen für neue Einheiten „Inline-Skaten“, „Ski alpin“, „Snowboard“, unbekannte Arten „Sonstige
  Sportart“ (früher „Sonstiges Training“; alte Titel werden weiter erkannt).
- Export: `to_jsonb(session_logs)` – die Spalten sind automatisch dabei. Kein Gesundheitsdatum, RLS unverändert.

## 3. kcal (Formel SESSION_KCAL)

Brutto MET × kg × h, gerundet auf 5 kcal, Uhr-Wert geht vor. MET je Sportart aus `SPORT_CATALOGUE` (Ainsworth 2011,
Codes im Quellkommentar in `constants.ts`): Anstrengung ≤ 3 → niedriger Wert, ≥ 8 → hoher Wert, dazwischen linear,
ohne Angabe der hohe Wert (`SPORT_INTENSITY`).

| Sportart                                | MET niedrig / hoch | Compendium 2011               |
| --------------------------------------- | ------------------ | ----------------------------- |
| Bouldern, Klettern                      | 5,8 / 8,0          | 15535 / 15533                 |
| Fußball                                 | 7,0 / 10,0         | 15610 / 15605                 |
| Padel                                   | 6,0 / 7,3          | Analogie Tennis 15680 / 15675 |
| Tennis                                  | 6,0 / 8,0          | 15680 / 15690                 |
| Badminton                               | 5,5 / 7,0          | 15030 / 15020                 |
| Tischtennis                             | 4,0 / 4,0          | 15660                         |
| Basketball                              | 6,0 / 8,0          | 15050 / 15040                 |
| Volleyball                              | 3,0 / 6,0          | 15720 / 15711                 |
| Handball                                | 8,0 / 12,0         | 15330 / 15320                 |
| Crosstrainer                            | 5,0 / 6,8          | 02048 / Annahme wie 02012     |
| Spinning                                | 6,8 / 8,5          | 02012 / 02019                 |
| HIIT/Zirkel                             | 4,3 / 8,0          | 02045 / 02040                 |
| Boxen                                   | 5,5 / 7,8          | 15110 / 15120                 |
| Kickboxen, Judo/BJJ, Karate, Kampfsport | 5,3 / 10,3         | 15425 / 15430                 |
| Skilanglauf                             | 6,8 / 9,0          | 19160 / 19170                 |
| Skitour                                 | 6,8 / 9,0          | Analogie Skilanglauf          |
| Ski alpin, Snowboard                    | 4,3 / 5,3          | 19190 / 19192 (aktive Zeit)   |
| Inline-Skaten                           | 7,5 / 9,8          | 15591 / 15592                 |
| SUP                                     | 3,5 / 6,0          | Analogie 18070 / 18365        |
| Kajak/Kanu                              | 3,5 / 5,8          | 18070 / 18080                 |
| Tanzen                                  | 4,5 / 7,8          | 03025 / 03031                 |
| Sonstige Sportart                       | 4,0 / 6,0          | Produktentscheidung           |

Fürs Tagesziel der Ernährung zählt ein Sportart-Eintrag mit seiner Dauer und dem MET von Krafttraining (sichere
Richtung, keine Änderung der Ernährungs-Engine).

## 4. Trainingsbelastung

Session-RPE (Foster 2001): **Minuten × Anstrengung 0–10 = Punkte**, ohne Angabe die übliche Anstrengung der Sportart
(`typicalEffort`), bei Kraft/Ausdauer 5 (`SPORT_LOAD`). Die Woche ist die Summe aller Einheiten (Karte „Sportarten diese
Woche“: je Sportart Einheiten, Zeit, km, kcal, Punkte; darunter Belastung der Woche).

## 5. Training-Übersicht

Sportarten zählen **nie** für geplante Einheiten (keine Zuordnung, keine Frage „Soll das zählen?“) – sie stehen als
„Zusätzliche Einheit“ am Tag, mit Icon, Dauer und kcal.

## 6. Plan-Hinweis nach hoher Beinbelastung

Sportarten mit `legLoad: high` (Fußball, Handball, Basketball, Volleyball, Tennis, Padel, Badminton, Spinning,
Skilanglauf, Skitour, Ski alpin) ab 30 min und Anstrengung ≥ 5 (`LEG_LOAD_HINT`): Eine am Folgetag geplante harte
Einheit (Kraft mit Fokus Beine/Ganzkörper, Ausdauer mit harter Art bzw. Anstrengung über „locker“, nicht Schwimmen)
bekommt im Tages-Blatt einen sanften Hinweis. **Nur Vorschlag** – keine Plan-Änderung, kein Eintrag in der
Live-Anpassung.

## 7. GPS

GPS-Sportarten nutzen die normale Aufzeichnung (Filter/Geschwindigkeit wie `gpsProfile`: Rad bzw. Laufen) und
speichern einen Sportart-Eintrag mit Bewegungszeit und Distanz. Die Karte der Strecke wird für diese Sportarten noch
**nicht** gespeichert (das sagt die App beim Speichern).

## 8. Offene Punkte

1. **Fachliche Prüfung** der MET-Werte (Codes aus dem Gedächtnis, nicht gegen das Original geprüft; ggf. Compendium
   2024), der Annahmen Padel/Skitour/SUP/Crosstrainer, der üblichen Anstrengung und der Belastungs-/Hinweis-Schwellen.
2. Karte/Strecke für GPS-Sportarten (braucht `tracked_routes` mit Sportart – nach Zusammenführen mit „Meine Strecken“).
3. Health Connect kennt kein Padel, Skilanglauf (nur SKIING → „Ski alpin“), SUP (PADDLING → „Kajak/Kanu“), Judo,
   Karate, Kickboxen; Distanz und Route von Uhr-Sportarten werden nicht übernommen. Später: Sportart einer Uhr-Einheit
   ändern können.
4. Sportart-Einträge sind (wie alle freien Einheiten) nicht bearbeitbar, nur löschbar.
5. Abgelehnte Sportart-Einträge aus der Warteschlange (offline gespeichert, später abgelehnt) erscheinen als Entwurf,
   der Trainingsmodus zeigt sie aber als leere Kraft-Einheit – selten, später eigener Weg.
6. `save_session_log` wurde erneut übernommen – parallele Zweige, die die Funktion ändern, müssen auf diese Fassung
   aufsetzen.
