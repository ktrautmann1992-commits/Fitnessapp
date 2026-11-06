# Supplemente rund ums Training (Gründer-Entscheidung 06.11.2026)

Ergänzt `docs/PLAN-PHASE-6.md`. Alles regelbasiert in `packages/core`, gratis, keine KI, keine Affiliate-Daten.
Alle Zahlen stehen mit Quelle in `packages/core/src/constants.ts` (`SUPPLEMENT_RULES`, `SUPPLEMENT_TIMING_RULES`).
**VOR LIVEGANG FACHLICH PRÜFEN.**

## 1. Fünf neue Einträge (`content/supplements/*.json`, alle Stufe B, keine zugelassene Angabe)

| ID             | Name                             | Kategorie     | „Passt zu dir“ nur, wenn …                             | Menge                                 |
| -------------- | -------------------------------- | ------------- | ------------------------------------------------------ | ------------------------------------- |
| `beta_alanine` | Beta-Alanin                      | `sport`       | Intervall-/Sprint-Einheiten im Plan, ab 18             | 3,2–6,4 g/Tag, je Portion ≤ 1,6 g     |
| `eaa`          | EAA (essenzielle Aminosäuren)    | `food`        | Eiweiß-Lücke UND vegane Ernährung (Essen/Shake zuerst) | 10–15 g je Portion                    |
| `electrolytes` | Elektrolyte (Natrium und Kalium) | `sport`       | Einheiten ab 90 min im Plan                            | 300–600 mg Natrium je Stunde          |
| `zinc`         | Zink                             | `diet_season` | **nie** – nur Info (Blutwerte ärztlich prüfen)         | keine; Hinweis „höchstens 25 mg/Tag“  |
| `magnesium`    | Magnesium                        | `diet_season` | **nie** – nur Info                                     | keine; Hinweis „höchstens 250 mg/Tag“ |

Warum Stufe B: Beta-Alanin ist nur für kurze, sehr intensive Belastungen gut untersucht (Trexler 2015, Saunders
2017); EAA nur als Ergänzung, wenn Eiweiß über Essen/Shake fehlt (Ferrando 2023, Jäger 2017); Elektrolyte nur bei
langen bzw. heißen Einheiten (ACSM 2007, McCubbin 2020); Zink und Magnesium nur bei ärztlich festgestelltem Bedarf
(EFSA 2014/2015) – deshalb nie „passt“, aber auch nicht „Nicht empfohlen“ (Stufe C wäre falsch beschriftet).

Sperren (strengste Regel gewinnt, `FLAG_RULES` in `eligibility.ts`): Schwangerschaft, Stillzeit, Niere → bei allen
fünf „Nicht für dich – bitte ärztlich abklären“; Medikamente → Beta-Alanin, Elektrolyte, Zink, Magnesium; Arzt-Flag →
Beta-Alanin, Elektrolyte; Herzrhythmus → Elektrolyte, Magnesium. Feste Hinweise (`notices.ts`): Kribbeln harmlos,
Teildosen, „Trinke nach Durst“, Salz/Medikamente ärztlich abklären, Wechselwirkung mit Antibiotika und
Knochen-Mitteln (Apotheke fragen), Blutwerte prüfen, Höchstmengen. Datenbank: Aufzählung `supplement_id` und
`seed_supplements` kennen die neuen IDs (Migrationen `20261106120000`/`20261106120100`, RLS unverändert).

## 2. Zeitpunkte rund um die Einheit (`supplements/training-timing.ts`)

`supplementTrainingDayTiming(einordnung, auswahl, einheit | null, gewicht)` → Zeilen „Vorher / Während / Danach /
Zu den Mahlzeiten / Uhrzeit egal“. Es erscheinen „passt zu dir“ (ohne „Nicht für mich“) und gewählte („Nehme ich“).

- Kreatin: täglich, Uhrzeit egal (z. B. zur Mahlzeit nach dem Training); auch am Ruhetag.
- Proteinpulver: nach dem Training (bis ca. 2 h nach dem Ende) oder zu einer Mahlzeit; nicht am Ruhetag.
- EAA: kurz vor (ab 30 min) oder direkt nach dem Training; nicht am Ruhetag.
- Beta-Alanin: über den Tag verteilt zu den Mahlzeiten, ≤ 1,6 g je Portion.
- Elektrolyte: nur bei einer Einheit ab 90 min, während und danach (unbekannte Dauer → keine Zeile).
- Vitamin D / Omega-3: täglich zu einer Mahlzeit.
- Koffein: nur neutrale Sicherheits-Info (B2.3), nur an Trainingstagen und nur bei `safety_info` (nicht bei
  Schwangerschaft, unter 18, „ärztlich abklären“): 30–60 min vor dem Start mit persönlicher Grenze bzw. Tassen-Satz;
  Start nach 16 Uhr (`CAFFEINE_LIMITS.latestTrainingStartMinutes`) → „Nimm vorher kein Koffein“.

Uhrzeit: echter Beginn einer erledigten Einheit vor der geplanten `start_time` (`timingStartMinutes`; App:
`todayTimingSession`). Anzeige: Karte „Supplemente heute“ im Reiter Training („Training heute“).

## 3. Schalter „Nahrungsergänzungsmittel anzeigen“

Geräte-Einstellung (`STORAGE_KEYS.supplementPrefs`, `lib/supplement-prefs.ts`), keine Migration nötig, kein
Gesundheitsdatum. Standard **aus**; ohne eigene Wahl **an** für alle, die schon einen Supplement-Check oder „Meine
Supplements“ gespeichert haben. Aus: keine Karte „Supplemente heute“, keine Kachel unter „Ernährung“, Supplement-Seite
nur mit Erklärung und Schalter, in den Einstellungen nur der Schalter. Erinnerungen zu Supplementen gibt es nicht.

## 4. Offen

- Zugelassene Angaben (z. B. Magnesium, Zink, Elektrolyt-Lösungen) erst nach Prüfung des Wortlauts im EU-Register.
- Koffein-Zeile auf „Training heute“ ist eine Abweichung von B2.3 („keine Zeile auf Heute“) – juristisch prüfen.
- Fachprüfung aller Zahlen und Texte vor dem Livegang (`expert_reviewed: false`).
