# Calisthenics, Schlingentrainer, Lauf-Kraft & Lauf-ABC

Stand 25.10.2026 · Gründer-Freigabe 25.10.2026 (Pakete A, B, C) · Branch `claude/calisthenics-schlinge` (von
`claude/training-modi`, kein PR, kein Merge). Gratis, ohne KI. Fachlogik in `packages/core/src/calisthenics/` und
`packages/core/src/plan/run-strength.ts`, Grenzwerte in `packages/core/src/constants.ts` (`SKILL_PROGRESSION`,
`SKILL_GATES`, `SUSPENSION_TRAINER_RULES`, `RUN_STRENGTH_RULES`), Datenbank `supabase/migrations/20261026120*`.
**Alle neuen Inhalte sind Entwürfe** (Freigabeliste in Abschnitt 5).

## 1. Kurzfassung

| Paket                   | Was die Person sieht                                                                                                                                                                                       | Was die App tut                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Calisthenics          | Ziel „Calisthenics / Körperbeherrschung“, neue Geräte (Klimmzugstange, Barren/Dip-Station, Turnringe, Parallettes, Calisthenics-Park), „Mehr → Skill-Pfade“, im Training „Nächste Stufe freigeschaltet: …“ | 10 Skill-Pfade mit Stufen; feste 2-für-2-Regel aus dem Tagebuch; Sperren (Einsteiger, ab 65/„Fit im Alter“, Gesundheits-Check, Schon-Modus, Voraussetzungen, Gerät) |
| B Schlingentrainer      | Schlingen-Übungen im Plan, beim Tauschen und im Reise-Modus; im Glossar „Schwierigkeit über den Körperwinkel“ + Anker-Hinweis                                                                              | Schlingentrainer zählt als Kraft-Gerät, sobald je Grundmuster eine Übung da ist; Tausch-Kandidaten aus Rückverweisen; „Nur Schlingentrainer“-Vorlagen               |
| C Lauf-Kraft & Lauf-ABC | An 1–2 lockeren Lauftagen pro Woche „Lauf-Kraft danach (15 min)“ mit Übungsliste und „Einheit mit Timer öffnen“                                                                                            | Zuordnung zur Anzeige (nicht gespeichert): nie am Tag vor einer Schlüsseleinheit, behutsam steigern, Erholungswoche nur sanft, Schon-Modus lässt Übungen entfallen  |

## 2. Calisthenics (Paket A)

### 2.1 Skill-Pfade

`SKILL_PATHS` (`calisthenics/skill-paths.ts`): je Pfad eine Stufenleiter aus Übungen der Bibliothek mit Ziel
(Sätze × Wiederholungen oder Sekunden halten). Gruppe „Grundlagen“: Klimmzug (7 Stufen, Toter Hang → einarmiger
Negativ-Klimmzug), Rudern (3), Dips (6), Liegestütz (6), Kniebeuge (5, bis Pistol), Rumpf (5, Hollow Body → L-Sitz).
Gruppe „Skills für Fortgeschrittene“: Handstand (5), Muscle-up (3), Front Lever (3), Back Lever (3). Stufen mit hoher
Technik tragen `advancedOnly`. Bestehende Übungen werden wiederverwendet (z. B. `liegestuetz`, `klimmzug`,
`pike-liegestuetz`), neue nur, wo eine Stufe fehlte.

### 2.2 Progressionsregel (deterministisch)

`SKILL_PROGRESSION` + `calisthenics/progression.ts`:

- **Sauber** = alle Ziel-Sätze erreicht (Wiederholungen bzw. Sekunden) und – falls eingetragen – RPE ≤ 8.
- **Freigeschaltet**: Ziel in **2 gewerteten Einheiten hintereinander** sauber → Vorschlag „Nächste Stufe
  freigeschaltet“. Kein automatischer Tausch; die Person wechselt über „Tauschen“.
- **Zurück**: 3 Einheiten hintereinander deutlich verfehlt (bester Satz < 60 % des Ziels) → Tipp „vorige Stufe üben“.
- Gewertet wird wie bei der Progression: keine Einstiegs-/Erholungswoche, kein Wiedereinstieg, keine freie Einheit.
- Aktuelle Stufe = höchste Stufe mit Eintrag in den letzten 90 Tagen; Voraussetzungen zählen aus 180 Tagen.
- Quellen: Baechle & Earle (2008, 2-für-2-Regel), Zourdos et al. (2016, RPE/RIR), Low (2016, Overcoming Gravity).

### 2.3 Sicherheits-Sperren

`SKILL_GATES` + `calisthenics/gates.ts` (`skillStageGate`), Gründe in `SKILL_LOCK_REASONS`:

| Grund             | Regel                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `experience`      | `advancedOnly`-Stufen nicht für Einsteiger                                                                                                  |
| `age`             | ab 65 Jahren oder Ziel „Fit im Alter“ keine `advancedOnly`-Stufe                                                                            |
| `safety_rules`    | Plan-Regeln schließen die Übung aus (z. B. `high_skill`, Überkopf, Sprünge)                                                                 |
| `health_check`    | Gesundheits-Check-Flags (vorsichtiger Plan) sperren hohe Technik                                                                            |
| `pain`            | Schon-Modus: Übung belastet eine geschonte Stelle (`PAIN_REGION_LOAD`, um die neuen Übungen ergänzt)                                        |
| `requirement`     | **Muscle-up erst ab 8 sauberen Klimmzügen und 10 Barren-Dips** (ein Satz); Front Lever ab 8 Klimmzügen; Back Lever ab 5 Klimmzügen + 5 Dips |
| `equipment`       | Gerät fehlt (Stange, Barren, Ringe, Parallettes; der Park bringt Stange + Barren mit)                                                       |
| `missing_content` | Übung nicht in der Bibliothek (Supabase: noch nicht freigegeben)                                                                            |

### 2.4 Ziel, Geräte, Vorlagen

- **Ziel `calisthenics`** (Enum `goal_type`, `GOAL_TEMPLATE_MAPPING` „same“): Energie ±0, Protein 1,6 g/kg, Volumen
  Einsteiger 4–12 / Fortgeschritten 6–18 Sätze je Muskel und Woche; Kombination mit Abnehmen erlaubt
  (`calisthenics>fat_loss`, −15 %, 2,0 g/kg).
- **Geräte** (Kategorie Körpergewicht, zu Hause wählbar, auch im Profil): `pull_up_bar` (bestand), `dip_station`
  (jetzt auch zu Hause), `gymnastic_rings`, `parallettes`, `calisthenics_park` (bringt `pull_up_bar` + `dip_station`
  mit, `EQUIPMENT_IMPLIES`). Reise-Modus: neu „Turnringe“ und „Calisthenics-Park“ (`TRAVEL_MODE.equipment`).
- **Vorlagen** (Entwurf): `calisthenics-einsteiger-2t`, `-einsteiger-3t`, `-fortgeschritten-3t`. Sie sind
  ortsneutral (zu Hause, Park, Studio) und nur beim Ziel Calisthenics wählbar (`isCalisthenicsTemplate`). Ohne
  freigegebene Vorlage greift der übliche Rückfall (Qualität „fallback“).

### 2.5 App

- **„Mehr → Skill-Pfade“** (`app/skill-pfade.tsx`): je Pfad aktuelle Stufe, Ziel, „noch N saubere Einheiten“,
  Vorschlag, alle Stufen mit Sperr-Gründen und fehlenden Voraussetzungen; Stufe antippen → Glossar. Kennzeichnung
  „Testinhalt“ bei Entwürfen, leerer Zustand ohne freigegebene Übungen, Lade-/Fehlerzustand.
- **Im Training** (`workout/[sessionId].tsx`): neutraler Hinweis „Nächste Stufe freigeschaltet: …“ bzw. „Tipp: vorige
  Stufe üben“ – schon aus der laufenden Einheit, nicht in Erholungswochen und nicht beim Bearbeiten.
- Neutral und privat: keine Abzeichen, Punkte, Ranglisten oder Teilen (Test der Texte in `skill-paths.test.ts`).

## 3. Schlingentrainer (Paket B)

### 3.1 Körperwinkel und Anker

Kein Schema-Umbau der Übung: `SUSPENSION_SETUPS` (`calisthenics/suspension.ts`) hält je Schlingen-Übung die
Aufstellung (`facing_anchor`, `facing_away`, `feet_in_straps`, `supine_heels`, `assisted`) und den Winkel leicht/schwer
(Grad gegen die Senkrechte); dazu Text in Tipps/Beschreibung. Das Glossar zeigt „Schwierigkeit über den Körperwinkel“
und immer: **„Anker sicher befestigen: an der Tür nur auf der Seite, zu der sich die Tür schließt, und die Tür
abschließen. Belastung vor dem ersten Satz vorsichtig testen.“**

### 3.2 Tausch und Alternativen

Veröffentlichte Übungen bleiben unverändert (sonst Versionssprung, CI `--base origin/main`). Stattdessen verweisen die
Schlingen-Entwürfe in `alternatives` auf die Original-Übungen; `suspensionLinksTo` kehrt das um. `findSubstitute`
Schritt 2b und `swapCandidatesFor` nutzen diese Rückverweise **nur, wenn der Schlingentrainer im Profil ist**, nie
schwerer als das Original. So mischt sich der Schlingentrainer mit Kurzhanteln bei allen Zielen.

### 3.3 Wann zählt der Schlingentrainer als Kraft-Gerät?

`suspensionTrainerReady` (`SUSPENSION_TRAINER_RULES`): je Grundmuster-Gruppe (Ziehen, Drücken, Kniebeuge/Ausfallschritt,
Hüfte/Beinrückseite) mindestens eine nutzbare Schlingen-Übung. Supabase lädt nur freigegebene Übungen → erst nach der
Freigabe wirksam; im Testmodus zählen Entwürfe (mit „Testinhalt“). Davor gilt wie bisher: Schlingentrainer im
Reise-Modus wie Körpergewicht (Hinweistext abhängig vom Stand).

### 3.4 „Nur Schlingentrainer“-Vorlagen

Entwürfe `fitness-einsteiger-3t-schlingentrainer`, `fitness-fortgeschritten-3t-schlingentrainer`,
`muskelaufbau-einsteiger-3t-schlingentrainer`, `fettverlust-einsteiger-3t-schlingentrainer`. Wählbar nur für ein
„Nur Schlingentrainer“-Profil (`isSuspensionOnly`: zu Hause, Schlingentrainer bereit, sonst keine Kraft-Geräte).

## 4. Lauf-Kraft & Lauf-ABC (Paket C)

`RUN_STRENGTH_RULES` + `plan/run-strength.ts` (`planRunStrength`, `runStrengthOn`, `runStrengthUnit`); App
`data/run-strength.ts`, Anzeige im „Heute“-Block nach dem Lauf.

- Einheiten (Entwürfe, `content/workouts`, Kategorie `run_strength`, je 15 min): `lauf-kraft-waden-fuesse`,
  `lauf-kraft-huefte-rumpf`, `lauf-abc-koordination`, sanft ohne Sprünge `lauf-kraft-ohne-spruenge`.
- Häufigkeit: vorsichtig/Einsteiger 1×, Fortgeschritten/Wettkampf 2× pro Woche; höchstens +1 gegenüber der Vorwoche
  (wie die 10-%-Regel); Woche 0, Einstiegs- und Erholungswochen höchstens 1× und nur sanft. Die Einheiten zählen
  **nicht** zum Laufumfang (`ENDURANCE_PROGRESSION` unverändert).
- Ort: nur lockere Läufe; **nie am Tag vor einer Schlüsseleinheit** (langer Lauf oder harte Art), nie am langen Lauf
  selbst, mindestens 2 Tage Abstand.
- Schon-Modus und Plan-Regeln (z. B. keine Sprünge): belastende Übungen entfallen; bleiben weniger als 3, entfällt die
  Einheit. Reise-Geräte werden berücksichtigt.
- Reine Anzeige (wie Aufwärmen): keine Datenbank-Änderung, im Tagebuch über „Einheit mit Timer öffnen“ (Workout-Log).
- Quelle: Blagrove et al. (2018), Sports Med 48:1117–1149; Lauf-ABC und Zahlen PRODUKTENTSCHEIDUNG.

## 5. Freigabeliste für die Gründer (alle `status: draft`)

Vor der Freigabe Fachprüfung (Trainer/Physio) – besonders Technik-Texte, Sperren und Bilder der Skills.

**Übungen (74), je mit eigener Illustration (Start/Ende) und deutschen Texten**

- Calisthenics (38): toter-hang, skapula-klimmzug, klimmzug-negativ, chin-up, archer-klimmzug,
  einarmiger-klimmzug-negativ, australian-pull-up, ring-rudern, explosiver-klimmzug, muscle-up-negativ, muscle-up,
  stuetz-barren, dips-negativ-barren, dips-barren, ring-stuetz, dips-ringe, diamant-liegestuetz, planche-lehne,
  pseudo-planche-liegestuetz, ring-liegestuetz, pistol-kniebeuge-halt, pistol-kniebeuge-kasten, pistol-kniebeuge,
  hechtstuetz-erhoeht, wandlaufen, handstand-wand, handstand-frei, hollow-body-gehockt, hollow-body-halten,
  knieheben-haengend, l-sitz-gehockt, l-sitz, front-lever-gehockt, front-lever-einbeinig, front-lever, deutscher-hang,
  back-lever-gehockt, back-lever.
- Schlingentrainer (23): schlingentrainer-atomic-liegestuetz, -ausfallschritt, -ausfallschritt-assistiert,
  -beinbeuger, -bergsteiger, -bizepscurl, -brustpresse, -einbeinige-kniebeuge, -face-pull, -fallout, -fliegende,
  -hueftheben, -knie-zur-brust, -kniebeuge, -liegestuetz, -pike, -rudern, -rudern-einarmig, -seitstuetz, -t-heben,
  -trizepsstrecken, -unterarmstuetz, -y-heben. Mit Rückverweisen (`alternatives`) auf die Original-Übungen.
- Lauf-ABC / Lauf-Kraft (13): lauf-abc-anfersen, -fussgelenksarbeit, -hopserlauf, -kniehebelauf, -seitgalopp,
  -skippings, -ueberkreuzlauf, wadenheben-gebeugtes-knie, einbeinstand-laeufer, laeufer-kniehub-stand,
  step-down-stufe, seitlicher-ausfallschritt, copenhagen-seitstuetz-knie.

**Vorlagen (7):** calisthenics-einsteiger-2t, calisthenics-einsteiger-3t, calisthenics-fortgeschritten-3t,
fitness-einsteiger-3t-schlingentrainer, fitness-fortgeschritten-3t-schlingentrainer,
muskelaufbau-einsteiger-3t-schlingentrainer, fettverlust-einsteiger-3t-schlingentrainer.

**Workouts (4):** lauf-kraft-waden-fuesse, lauf-kraft-huefte-rumpf, lauf-abc-koordination, lauf-kraft-ohne-spruenge.

**Landung in zwei Schritten (25.10.2026):** Die Pflichtprüfung „sources-integrity (Code von main)“ prüft
`content/` mit dem Code von main – der kennt `goal_type` „calisthenics“ und die Kategorie „run_strength“ erst nach
dem Merge von PR #182. Deshalb kommen die 3 Calisthenics-Vorlagen und die 4 Lauf-Kraft-Workouts erst danach mit dem
Branch `claude/calisthenics-inhalte-2` nach `content/` (unverändert). Bis dahin: Ziel Calisthenics nutzt die
nächstbeste Vorlage (Güte „fallback“), der Lauf-Kraft-Block am Lauftag bleibt ausgeblendet; die Logik-Tests nutzen
unveränderte Kopien in `packages/core/src/plan/test-fixtures/inhalte-folgen/`.

Freigabe wie gewohnt über `content-seed.yml` (nur `published` + Fachprüfung). `content:validate`: 0 Fehler,
136 gelbe Hinweise (nur V11 „kleine Muskelgruppen“ in Vorlagen).

## 6. Datenmodell (Supabase, nur additiv)

- `20261026120000_calisthenics_enums.sql`: `goal_type` + `calisthenics`, `workout_category` + `run_strength`,
  `travel_equipment` + `rings`, `outdoor_park`.
- `20261026120100_calisthenics_equipment.sql`: Geräte `gymnastic_rings`, `parallettes`, `calisthenics_park`;
  `dip_station` zusätzlich zu Hause wählbar.
- `20261026120200_calisthenics_rules.sql`: CHECK `plan_templates_goal_type_check` und `goal_pair_allowed` um
  Calisthenics erweitert (12 Paare). Keine neue Tabelle mit Nutzerdaten, RLS unverändert; Skill-Fortschritt und
  Lauf-Kraft werden aus dem Tagebuch bzw. Plan berechnet, nicht gespeichert.
- pgTAP `supabase/tests/91_calisthenics.test.sql` (20 Tests); `09_*` angepasst (16 Heim-Geräte).

## 7. Tests

- Core (Vitest, 6526 grün): `calisthenics/{skill-paths,progression,gates,suspension}.test.ts`,
  `plan/run-strength.test.ts`, `plan/calisthenics-plan.test.ts` – Grenzfälle Einsteiger/Fortgeschritten, 64/65 Jahre,
  1 vs. 7 Tage, Erholungswoche, Schon-Modus, Tag vor dem langen Lauf. **Bewusst geänderte Snapshots:**
  `log/workout.test.ts.snap` und `plan/swap-properties.test.ts.snap` (neue Übungen/Rückverweise in der Bibliothek);
  ein Property-Test der Ernährung akzeptiert jetzt beide Rundungen (verschobene Zufallsfolge).
- Content (1456 grün), Validierung 0 Fehler; Illustrations-Tests (Boden, Rahmen, Hängen).
- Mobile (Vitest 1472 grün, neu `data/skill-paths.test.ts`); Playwright `e2e/calisthenics.spec.ts`: Skill-Pfade
  (Sperren, Muscle-up-Voraussetzungen), Schlingentrainer zu Hause, Kurzhanteln + Schlingentrainer (Schlingen-Übung als
  Tausch-Alternative), Reise-Modus mit Park/Schlingentrainer, Lauf-Kraft-Block. `training-modes.spec.ts` angepasst
  (Schlingen-Hinweis im Testmodus jetzt „stellt um“).
- pgTAP läuft im CI-Workflow `db-test` (in der Sitzung nicht lokal ausführbar).

## 8. Offene Punkte

1. **Fachprüfung** aller 74 Übungen, 7 Vorlagen, 4 Workouts – vor allem Handstand, Hebel, Muscle-up, Planche-Lehne,
   Copenhagen und die Körperwinkel in `SUSPENSION_SETUPS`.
2. Zahlen der Sperren und der 2-für-2-Regel sind Produktentscheidungen – vom Trainer bestätigen lassen.
3. Illustrationen: `dips-ringe` (Hände an den Ringen kaum erkennbar) und `front-lever-gehockt` (Hocke liest sich
   schwach) vor der Freigabe nachbessern; übrige Bilder sind schematisch wie der Bestand.
4. Calisthenics-Ziel ist nicht Teil der Batch-Erzeugung (`PipelineGoal`), Vorlagen sind von Hand geschrieben.
5. Tausch-Rückverweise: sobald die Original-Übungen ohnehin eine neue Version bekommen, können die Schlingen-Varianten
   direkt in deren `alternatives` stehen.
