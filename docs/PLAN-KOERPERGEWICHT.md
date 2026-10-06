# Plan: Training nur mit dem eigenen Körpergewicht

Stand: 06.10.2026 · Status: **vom Wächter mit Auflagen freigegeben, Auflagen eingearbeitet** (Abschnitt 10) · **K1–K4
umgesetzt** (siehe „Umsetzungsstand“); offen bleiben Fachprüfung, Freigabe (`published`) und Einspielen

## 1. Ziel in einfachen Worten

Gründer-Wunsch: „Wenn jemand absolut keine Geräte zur Verfügung hat, bekommt er nur Pläne mit dem eigenen
Körpergewicht.“ Heute bekommt diese Person eine **Hantel-Vorlage**, aus der die Engine alles Machbare herausschneidet –
übrig bleibt ein dünner Plan ohne Rücken-Übung. Künftig gibt es **eigene Körpergewicht-Vorlagen**, die vollständig
ohne Geräte funktionieren, sicher sind und sich auch ohne Gewichte steigern lassen.

**Ehrlich gesagt (A9, auch in KONZEPT):** Ohne Geräte ist der Trainingsreiz für Fortgeschrittene begrenzt – vor
allem für Rücken und Beinbeuger. Die Pläne halten fit und bauen Kraft auf; für maximalen Muskelaufbau sind Geräte
(schon ein Band oder eine Klimmzugstange) besser. Das steht so in der Planbeschreibung.

## 2. Ist-Stand (geprüft am 05.10.2026)

- **Übungen ganz ohne Geräte (`equipment_ids: []`): nur 8 von 52** – `kniebeuge-koerpergewicht`, `split-kniebeuge`,
  `liegestuetz`, `glute-bridge`, `wadenheben-koerpergewicht`, `unterarmstuetz`, `dead-bug`, `hampelmann`.
  - **Keine Zug-Übung** (`horizontal_pull`/`vertical_pull`) und **kein Hüftbeugen** (`hinge`) ohne Gerät.
  - `glute-bridge` und `dead-bug` tragen `long_supine` → bei Schwangerschaft gesperrt; `hampelmann` trägt
    `high_impact` → bei vorsichtigem Plan und ab 65 gesperrt.
  - Alle `harder`-Alternativen der Körpergewicht-Übungen brauchen Geräte. Der Progressions-Hinweis `harder_variant`
    läuft ohne Geräte also **ins Leere**.
- **Vorlagen:** 24 Stück (3 Ziele × 2 Level × 3/4 Tage × Studio/Zuhause). Alle Zuhause-Vorlagen verlangen
  Kurzhanteln + Bänder.
- **Engine (`packages/core/src/plan/`):**
  - `equipment-profile.ts`: Zuhause ohne Geräte → `available` leer („Sonstiges“ wird herausgefiltert).
  - `match.ts`: Punkte (Ziel 35, Level 25, Tage 15, Ort 10, **Geräte nur 10**, Dauer 5) – eine Körpergewicht-Vorlage
    würde nicht verlässlich gewinnen und umgekehrt bei Profilen **mit** Geräten sogar gewinnen können.
  - `adapt.ts`/`findSubstitute()`: Tausch über Alternativen → Muster → Hauptmuskel, nie schwerer. Fehlt danach jede
    Zug-Übung → Hinweis `no_pull_exercise`.
  - `loads.ts` (Zeile 231): Körpergewicht = +1 Wdh. bis `reps_max`, dann nur Hinweis `harder_variant`; kein Puffer,
    kein Zusatzsatz wie bei Gewicht.
- **Content-Prüfung:** V2 lässt Übungen mit Geräten durch, wenn eine Alternative passt (`checks.ts` 376–392);
  **V10 rot** (Untergrenze Wochensätze für `lats`, `upper_back`, `hamstrings` …); V7 zählt Ziehen nur über
  `horizontal_pull`/`vertical_pull` (`analysis.ts` 105). Rote Befunde an **Entwürfen** blockieren nichts
  (`isBlockingIssue`), `selectPlanContent` wirft fehlerhafte Inhalte still heraus.

## 3. Neue Übungen (Entwürfe, direkt in der Sitzung geschrieben)

Wie der Startbestand: `meta.origin: "claude_session"`, **`meta.model` Pflicht** (z. B. `claude-opus-5-5`),
`expert_reviewed: false`, `status: "draft"`. **Alltagsgegenstände** (Wand, Türrahmen, stabiler Stuhl, Handtuch,
Treppenstufe mit Geländer) gelten als „ohne Geräte“ (`equipment_ids: []`); Voraussetzung und Stabilitäts-Check stehen
in `steps_de`. Neue IDs dürfen nicht mit bestehenden kollidieren (z. B. **`bulgarische-split-kniebeuge-stuhl`**, nicht
`bulgarische-split-kniebeuge`).

**Ketten je Bewegungsmuster (A8, Regel Ü4: Alternativen nur im selben Muster):**

| Muster                | Kette (`easier` → Erstwahl → `harder`)                                                                                                                                  | Merkmale / Sicherheit                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `horizontal_pull`     | **Türrahmen-Rudern einarmig** (stehend) → Handtuch-Rudern im Sitzen (Selbstwiderstand, `load_type: "time"` mit Haltezeit je Wdh. – A14) → _Tisch-Rudern_ (nur `harder`) | Tisch-Rudern bis zur Fachfreigabe **nicht in Vorlagen** (A7), Merkmal `high_skill`; Türrahmen-Rudern ohne Merkmal = Erstwahl        |
| `vertical_pull`       | **Handtuch-Latziehen (Halten, K2)** → bestehend `klimmzug-band-unterstuetzt`, `klimmzug` – nur machbar mit Klimmzugstange (A6)                                          | Einsteiger/vorsichtig: Vorschlag nur eine Stufe schwerer (W8)                                                                       |
| `shoulder_isolation`  | **Y-T-W vorgebeugt im Stand / an der Wand** (Erstwahl) → Y-T-W in Bauchlage (nur Alternative)                                                                           | zählt **nicht** als Ziehen für V7, nur für `upper_back`/`rear_delts` (A8); Bauchlage nie Erstwahl (A4)                              |
| `hinge`               | **Good Morning ohne Gewicht** → **einbeinige RDL mit Hand an der Wand**                                                                                                 | Halt an der Wand = **Pflichtschritt** in `steps_de` (A7)                                                                            |
| `knee_flexion`        | Beinbeuger mit Handtuch auf glattem Boden → _Nordic Curl mit Händen abgefangen_ (nur `harder`)                                                                          | Handtuch-Variante `long_supine`; Nordic `high_skill`, nie in 2-Tage- oder Einsteiger-Vorlagen (A7); **Einordnung Fachprüfung** (A9) |
| `hip_extension`       | **Hüftstrecken im Vierfüßlerstand** (Erstwahl, kein Merkmal) ↔ Glute Bridge → einbeinige Glute Bridge → Hip Thrust Schultern auf Sofa                                   | Bridge-/Thrust-Varianten `long_supine`; Vierfüßler = Ersatz bei Schwangerschaft                                                     |
| `horizontal_push`     | Liegestütz Hände erhöht (Wand/Tisch) → `liegestuetz` → Füße erhöht → Archer-Liegestütz                                                                                  | –                                                                                                                                   |
| `vertical_push`       | Pike-Liegestütz                                                                                                                                                         | `overhead`; **in K2 in keiner Vorlage** (keine Alternative ohne Gerät und Merkmal)                                                  |
| `elbow_extension`     | Trizeps-Liegestütz eng (Erstwahl) → _Dips am Stuhl_ (nur Alternative)                                                                                                   | Stuhl-Dips nie Erstwahl, kein `high_skill` (passt nicht, A7); Fachprüfung                                                           |
| `squat`               | Kniebeuge zum Stuhl → `kniebeuge-koerpergewicht` → Kniebeuge mit Pause unten → Tempo-Kniebeuge 3-1-3                                                                    | Tempo/Pause = eigene IDs (eigener Fortschritt je `exercise_id`)                                                                     |
| `lunge`               | Step-up auf Treppenstufe → `split-kniebeuge` → `bulgarische-split-kniebeuge-stuhl`                                                                                      | Halt am Geländer bzw. an der Wand = Pflichtschritt (A7)                                                                             |
| `core_anti_extension` | `unterarmstuetz`, `dead-bug`, Bird-Dog                                                                                                                                  | Bird-Dog = Ersatz für `dead-bug` bei Schwangerschaft                                                                                |
| `core_anti_rotation`  | Seitstütz (Knie) → Seitstütz                                                                                                                                            | Seitstütz kommt hierhin, es gibt **kein** eigenes Muster für seitliches Stützen (A8)                                                |
| `calf_raise`          | `wadenheben-koerpergewicht` → einbeiniges Wadenheben (Hand an der Wand)                                                                                                 | –                                                                                                                                   |
| `conditioning`        | **Step-Jacks** (ohne Sprung) ↔ `hampelmann`                                                                                                                             | in K2 in keiner Vorlage (`conditioning` bis Phase 10 ausgeschlossen); Step-Jacks bleiben Alternative (A14)                          |

**Bauchlage und Schwangerschaft (A4, nicht verschoben):** Stehende bzw. vorgebeugte Varianten sind überall
Erstwahl; Bauchlage-Übungen (Y-T-W, Superman) gibt es nur als Alternative. Damit braucht es **kein** neues Merkmal
`prone` und keine Migration. Wird bei der Fachprüfung doch ein Merkmal gefordert, kommt es mit Migration und
Eintrag in `PREGNANCY_EXCLUDED_CAUTION_TAGS` in derselben Etappe.

**Fachprüf-Liste (vor `published`, A7/A9, W5):** Tisch-Rudern, Stuhl-Dips, Nordic Curl, einbeinige RDL, Bulgarische
am Stuhl, Step-up, Einordnung Beinbeuger mit Handtuch, **Handtuch-Latziehen** (Hauptmuskel `lats` bei selbst
bestimmtem Widerstand, Zählung für V10, Eignung als Erstwahl in 14 Vorlagen) und **Handtuch-Rudern im Sitzen** als
Erstwahl-Ziehübung, **Good Morning ohne Gewicht** (Reiz und Einordnung – steht nach dem Umbau 33-mal als
Hüftbeuge-Erstwahl, N5).

## 4. Neue Vorlagen „Körpergewicht“

- Kennzeichen ohne Schema-Änderung: `location: "home"`, `required_equipment_ids: []`, `optional_equipment_ids: []`.
  **Neue rote Prüfung (A1):** Eine solche Vorlage darf **nur** Übungen mit `equipment_ids: []` enthalten (V2 allein
  reicht nicht, weil es Alternativen gelten lässt). Mit Test.
- **Matrix: 3 Ziele × 2 Level × 2/3/4 Tage**, ID `<ziel>-<level>-<n>t-koerpergewicht`. 2 Tage = Ganzkörper (neu),
  3 Tage = Ganzkörper, 4 Tage = Ober-/Unterkörper. **Ausnahme (A9):** „Muskelaufbau · Fortgeschritten · 2 Tage“ mit
  `minutes_max 60`, damit V10 ohne zu hohe Dichte erreichbar ist; gelingt das nicht grün, entfällt diese Vorlage
  (Matching nimmt dann die 3-Tage-Vorlage, Hinweis `days_rotated`).
- **Dauer (A14, Widerspruch behoben):** alle anderen Vorlagen `minutes_min 30`, `minutes_max 45`. Kürzere Budgets
  (20 min) über das bestehende `fitSessionToMinutes()`; **längere Budgets bekommen keine Extra-Sätze** – die Vorlage
  bleibt bei 45 min (ehrlich, mehr Umfang ohne Last bringt wenig).
- Jede Einheit: Drücken, **Ziehen über `horizontal_pull`** (Türrahmen- bzw. Handtuch-Rudern) – Y-T-W zählt für V7
  **nicht** (A8) –, Kniebeuge/Ausfallschritt, Hüftbeugen bzw. Hüftstrecken, Rumpf.
- **Sicherheit:** Einsteiger-Vorlagen ohne `high_skill`, `high_impact`, `overhead` als Erstwahl (kein Pike-Liegestütz,
  A13); Tisch-Rudern, Nordic Curl und Stuhl-Dips nie als Erstwahl (A7). **Umgesetzt (K2):** Hampelmann/Step-Jacks
  und Pike-Liegestütz stehen in keiner Vorlage (Ausdauer-Übungen bis Phase 10 ausgeschlossen; Pike ohne Alternative
  ohne Gerät und Merkmal); A14 bleibt erfüllt, weil Hampelmann nie Erstwahl ist. Für jede Übung mit Merkmal gibt es
  eine erlaubte Alternative ohne Gerät.

## 5. Engine-Anpassung (`packages/core`, Etappe K3)

1. **Körpergewicht-Profil (A6, W2):** `isBodyweightOnly(profile)` = Zuhause **und keine Kraft-Geräte**. Kraft-Geräte
   sind nur lastgebende Geräte (freie Gewichte, Bänder, Maschinen); Ausdauer-Geräte (Laufband, Ergometer,
   Rudergerät), Bänke und Dip-Station zählen nicht. **Nur Klimmzugstange** → trotzdem Körpergewicht-Vorlage; die
   Stange macht `klimmzug-band-unterstuetzt`/`klimmzug` als Alternative machbar.
2. `isBodyweightTemplate(template)` = Zuhause, keine Pflicht- und keine Optional-Geräte.
3. **Harte Regel in `isTemplateEligible` statt Punkte, nur wenn ALLE Kraft-Tage „zu Hause ohne Kraft-Geräte“ sind
   (A2):**
   - Alle Kraft-Tage zu Hause ohne Kraft-Geräte → nur Körpergewicht-Vorlagen wählbar. Gibt es keine passende (z. B.
     Geschlecht), greift die bisherige Suche **mit sichtbarem Hinweis** (bestehender Code `location_mismatch`, im Test
     geprüft, A5).
   - **Gemischte Wochen** (Studio-Tage + Zuhause ohne Geräte): vorerst **Studio-Vorlage** wie heute plus
     verständlicher Hinweis für die Zuhause-Tage (bestehender Tausch-Weg, kein zweites Vorlagen-Matching). Ein
     eigenes Matching je Ort ist als **offene Verbesserung** vermerkt (Frage 7).
   - Alle anderen Profile → Körpergewicht-Vorlagen **nicht** wählbar.
4. **`daysScore` (A12):** Bei 1 Trainingstag bekommt die 2-Tage-Ganzkörper-Vorlage die meisten Punkte, bei 2 Tagen die
   exakte; Kommentar an `MAX_STRENGTH_SESSIONS_PER_WEEK` aktualisieren.
5. **Progression (A10):** Körpergewicht nutzt die **bestehenden** `LOAD_PROGRESSION.extraRepsBuffer` und
   `extraSets` (keine doppelte Konstante): +1 Wdh. bis `reps_max`, dann Puffer bis `reps_max + 2` (≤ 30), dann +1 Satz
   (V9), dann `harder_variant`. `findHarderVariant()` wird in K3 neu angebunden – mit **aktuellen Sicherheitsregeln
   und Orts-Profil**, damit nie eine gesperrte oder nicht machbare Variante vorgeschlagen wird. Wechsel bleibt ein
   Hinweis mit Variantenname; macht die Person sie, läuft es über den Alternativ-Weg (eigener Verlauf).
6. Anpassungen mitziehen: `loads.ts` 231, `progression.test.ts` 261, Tabelle in `PLAN-PHASE-3.md` §5.9,
   `PLAN-PHASE-4.md` 5.1; **`PLAN_ENGINE_VERSION` erhöhen**. Keine neuen Hinweis-Codes, keine Migration.
7. App: Planname zeigt „Körpergewicht“; die Auswahl „Keine Geräte (Körpergewicht)“ gibt es schon.

## 6. Tests (Vitest, Grenzfälle laut CLAUDE.md)

- **Content (A1, A5):** neue rote Prüfung „Körpergewicht-Vorlage nur Übungen ohne Geräte“; Test über die **echten
  `content/`-Dateien**: **0 rote Befunde auch an Entwürfen** für alle neuen IDs (Abnahme-Kriterium, weil Entwürfe
  sonst still herausfallen).
- **Matching:** Körpergewicht-Profil × alle Ziele × Level × 1–7 Tage → immer eine `*-koerpergewicht`-Vorlage (mit
  echten Inhalten); Rückfall-Fall → Hinweis-Code sichtbar; Profil mit Kurzhanteln, Studio, „beides“ → nie; nur
  Laufband/Ergometer/Rudergerät → Körpergewicht; nur Klimmzugstange → Körpergewicht mit machbarem Klimmzug (A6);
  **gemischte Wochen Studio:Zuhause 1:1, 2:1, 1:2** → Studio-Vorlage + Hinweis (A2); 1 Tag → 2-Tage-Vorlage (A12).
- **Regression (A11):** 24 bestehende Vorlagen × typische Profile (Studio, Zuhause Hanteln+Band, nur Band, ohne
  Geräte, vorsichtig, ab 65, Schwangerschaft) → gleiche Übungen wie vor K1. Abweichungen durch die neuen
  Alternativen werden im Test **bewusst** als erwartete Änderung ausgewiesen und im PR-Text genannt.
- **Eigenschaftstest:** zufällige Profile ohne Kraft-Geräte inkl. Schwangerschaft, ab 65, unter 18, vorsichtig, 20 und
  240 min → immer eine `horizontal_pull`- und eine Hüft-Übung, nie `no_pull_exercise`, keine gesperrten Merkmale, keine
  Bauchlage als Erstwahl.
- **Progression:** Puffer → Zusatzsatz → `harder_variant`; Variante gesperrt (z. B. ab 65 Tisch-Rudern) oder nicht
  machbar → kein Vorschlag; Erholungswoche ohne Schritt.

## 7. Etappen (je ein Pull Request, Reihenfolge A3)

| Etappe | Inhalt                                                                                                              | Prüfung                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| K1     | ~20 neue Übungen als Entwürfe + Ketten der bestehenden 8; Regressionstest (A11)                                     | `content:validate` 0 rot, CI grün       |
| K2+K3  | **in einem PR:** neue rote Prüfung, Matching-Regel, `daysScore`, Progression, Doku-Anpassungen **und** die Vorlagen | CI grün inkl. Tests mit echten Inhalten |
| K4     | App-Text „Körpergewicht“, KONZEPT (ehrlicher Satz), PLAN-PHASE-3 Lücke als erledigt                                 | Vercel-Vorschau                         |

Grund für K2+K3 zusammen: Ohne die harte Regel würden Körpergewicht-Vorlagen über die Punkte auch Profilen **mit**
Geräten zugeteilt (A3). Danach: Fachprüfung, Freigabe (`published`) und Einspielen per `content-seed.yml`.

## 8. So testet ihr es am Handy

1. Im Pull Request auf den **Vercel-Vorschau-Link** tippen.
2. Neues Testkonto → Onboarding: Ort **Zuhause**, Geräte **„Keine Geräte (Körpergewicht)“**, 2 Tage, 30 Minuten.
3. Plan prüfen: Name enthält „Körpergewicht“, jede Einheit hat eine Rudern-Übung (z. B. Türrahmen-Rudern), kein
   Hinweis „Für Rücken-Übungen …“.
4. Angaben ändern: Alter ab 65 bzw. Gesundheits-Check mit Auffälligkeit → Einsteiger-Vorlage, kein Tisch-Rudern (Hampelmann
   steht in keiner Vorlage).
5. Gegenproben: Geräte „Kurzhanteln“ → Hantel-Plan. Nur „Klimmzugstange“ oder nur „Flachbank“ → Körpergewicht-Plan. Eine Woche mit einem
   Studio- und einem Zuhause-Tag → Studio-Plan mit Hinweis.
6. GitHub-App → Actions → letzter `ci`-Lauf → Zusammenfassung „Content-Prüfung“ ohne rote Befunde.

## 9. Offene Fragen mit Empfehlung

1. **Zählen Möbel (Wand, Türrahmen, Stuhl) als „keine Geräte“?** _Empfehlung:_ Ja, mit Stabilitäts-Check im Text und
   einer Alternative ganz ohne Möbel.
2. **Körpergewicht-Vorlagen auch für Leute mit Geräten?** _Empfehlung:_ Nein; später evtl. als Auswahl „Reiseplan“.
3. **Variante automatisch tauschen?** _Empfehlung:_ Nein, nur vorschlagen.
4. **Tisch-Rudern, Stuhl-Dips, Nordic Curl?** _Empfehlung:_ Nur als Alternative bis zur Fachfreigabe (A7).
5. **Merkmal „Bauchlage“?** _Empfehlung:_ Nicht nötig, weil Bauchlage nie Erstwahl ist (A4); bei Fachprüfung erneut
   fragen.
6. **Fachliche Freigabe:** _Empfehlung:_ Fachprüf-Liste aus Abschnitt 3 vor `published`.
7. **Gemischte Wochen (Studio + Zuhause ohne Geräte):** _Empfehlung:_ Vorerst Studio-Vorlage + Hinweis (A2); eigenes
   Matching je Ort als spätere Verbesserung.

## 10. Wächter-Prüfung (Runde 1) – wie die Befunde gelöst sind

Ergebnis: **mit Auflagen freigegeben**, alle Auflagen eingearbeitet.

| Befund                                            | Gelöst in                                                   |
| ------------------------------------------------- | ----------------------------------------------------------- |
| A1 rote Prüfung Körpergewicht-Vorlage             | §4, §6 (Content)                                            |
| A2 gemischte Wochen (Entscheidung)                | §5.3, §6 (1:1, 2:1, 1:2), §9 Frage 7                        |
| A3 Etappen-Reihenfolge                            | §7 (K2+K3 in einem PR)                                      |
| A4 Bauchlage/Schwangerschaft                      | §3 (stehend/vorgebeugt Erstwahl, Bauchlage nur Alternative) |
| A5 0 rot an Entwürfen, Tests mit echten Daten     | §2, §6                                                      |
| A6 nur Kraft-Geräte zählen, Klimmzugstange        | §5.1, §6                                                    |
| A7 Tisch-Rudern, Stuhl-Dips, Nordic, Halt         | §3 Tabelle + Fachprüf-Liste, §4                             |
| A8 Ü4-Ketten, Ziehen nur `horizontal_pull`        | §3 Tabelle, §4                                              |
| A9 Beinbeuger, 2-Tage-Muskelaufbau, KONZEPT       | §1, §3, §4                                                  |
| A10 Progression, Doku, Engine-Version             | §5.5, §5.6                                                  |
| A11 Regressionstest                               | §6, §7 K1                                                   |
| A12 `daysScore` 1 Tag                             | §5.4, §6                                                    |
| A13 Pike nicht für Einsteiger                     | §3, §4                                                      |
| A14 60 min, Handtuch-Rudern, Step-Jacks, meta, ID | §3, §4                                                      |

## Umsetzungsstand

**Etappe K1 – umgesetzt (05.10.2026, noch nicht committet):**

- **27 neue Übungen** als Entwürfe in `content/exercises/` (`origin: claude_session`, `model: claude-opus-5-5`,
  `expert_reviewed: false`): Türrahmen-Rudern, Handtuch-Rudern im Sitzen (Halten, `load_type: time`), Tisch-Rudern
  (`high_skill` + `long_supine`, Schwierigkeit 3 – nur Alternative), Y-T-W vorgebeugt, Good Morning ohne Gewicht, einbeiniges
  Kreuzheben (Hand an der Wand Pflicht), Beinbeuger mit Handtuch (`long_supine`), Nordic Curl mit Abfangen
  (`high_skill`), Hüftstrecken im Vierfüßlerstand, Glute Bridge einbeinig und Hip Thrust am Sofa (`long_supine`),
  Liegestütz erhöht / Füße erhöht / Archer, Pike-Liegestütz (`overhead`), enger Liegestütz, Dips am Stuhl (ohne
  Merkmal, nur Alternative), Kniebeuge zum Stuhl / mit Pause / Tempo 3-1-3, Step-up (Geländer Pflicht),
  `bulgarische-split-kniebeuge-stuhl` (Wand Pflicht), Bird-Dog, Seitstütz (Knie) und Seitstütz
  (`core_anti_rotation`), Wadenheben einbeinig, Step-Jacks.
- **Bauchlage-Übungen (Superman, Y-T-W in Bauchlage) bewusst noch nicht angelegt** (A4) – erst nach der Fachprüfung.
- **Ketten der bestehenden 8 Körpergewicht-Übungen** ergänzt (nur angehängte Alternativen, Version bleibt 1, alles
  Entwurf).
- **Neue rote Regel V12** (`packages/core/src/content/rules.ts`, `checks.ts`, `isBodyweightTemplate()`): Vorlage
  Zuhause ohne Pflicht- und Optional-Geräte darf nur Übungen ohne Geräte enthalten; Test in `checks.test.ts`.
- **Regressionstest** `packages/content/src/koerpergewicht-regression.test.ts` (A11): 8 Profile × 12
  Vorlagen-Kombinationen, Bibliothek vorher (ohne neue IDs/Alternativen) gegen nachher. Studio und Zuhause mit allen
  Geräten **unverändert**; Änderungen nur bei fehlenden Geräten bzw. Schwangerschaft, nur durch neue Übungen
  (Snapshot weist sie aus: z. B. ohne Geräte Türrahmen-Rudern, Y-T-W, Good Morning; Schwangerschaft Bird-Dog und
  Hüftstrecken im Vierfüßlerstand). Durch die Zeitanpassung fallen in einzelnen Fällen andere Übungen weg (z. B. nur
  Band, Muskelaufbau Fortgeschritten: `dead-bug`/`pallof-press-band` bzw. `bizepscurl-band`). Ohne Geräte gibt es
  den Hinweis `no_pull_exercise` nicht mehr.
- `content:validate`: 0 rote Befunde (auch an Entwürfen). Beispielpläne: Clara bekommt Türrahmen-Rudern.

**Etappe K2+K3 – umgesetzt (05.10.2026, noch nicht committet, ein Pull Request; Wächter-Auflagen W1–W12 eingearbeitet):**

- **18 Körpergewicht-Vorlagen** in `content/plan-templates/` (`<ziel>-<level>-<n>t-koerpergewicht`, 3 Ziele × 2 Level
  × 2/3/4 Tage; 2 und 3 Tage Ganzkörper, 4 Tage Ober-/Unterkörper), `location: home`, keine Pflicht- und
  Optional-Geräte, Entwurf mit `meta.model`. Dauer 30–45 min, **Muskelaufbau · Fortgeschritten · 2 Tage 30–60 min**
  (A9 – V10 grün erreicht, die Vorlage entfällt also nicht). Beschreibung mit dem ehrlichen Satz „Ohne Geräte ist der
  Trainingsreiz begrenzt …“ (A9). `content:validate`: **0 rote Befunde, auch an Entwürfen** (A5); gelb nur V11
  (kleine Muskelgruppen; seitliche Schulter 0–2 Sätze, weil es ohne Pike keine Über-Kopf-Übung gibt).
- Aufbau: jede Einheit mit Rumpf; Ganzkörper/Oberkörper mit Drücken und Ziehen über **`horizontal_pull`**
  (Türrahmen- bzw. Handtuch-Rudern, A8); Ganzkörper/Unterkörper mit Kniebeuge/Ausfallschritt und einer
  **Hüftbeuge-Grundübung** (Good Morning bzw. einbeiniges Kreuzheben – nicht Hüftstrecken als Isolationsübung, die beim
  Kürzen zuerst wegfiele). Reihenfolge Ganzkörper A: Bein, Hüftbeugen, Drücken, Rudern; B/C: Bein, Drücken, Rudern,
  Hüftbeugen.
- **Kürzen je Einheit (W7, ehrlich):** Ab 30 min hat jede Ganzkörper-/Unterkörper-Einheit eine Hüft-Übung und jede
  Ganzkörper-/Oberkörper-Einheit Rudern (Eigenschaftstest). **Bei 20 min** bleiben nur die ersten drei Übungen:
  Ganzkörper A behält Hüftbeugen (ohne Rudern), B/C behalten Rudern (ohne Hüftbeugen) – planweit ist beides da. Unter
  `minutes_min` (20 min) kann auch der Rumpf wegfallen. **W10:** „Muskelaufbau · Fortgeschritten · 2 Tage“ hat bei 45 min die Hinweise `minutes_shortened` und `volume_reduced` (sie liegt
  genau an der V10-Untergrenze); bewusst so gelassen.
- **Progressions-Notiz (W3):** „… dann kommt ein Satz dazu; gibt es eine passende schwerere Variante, schlägt die App
  sie vor.“ nur an Übungen mit `harder`-Alternative, sonst ohne Varianten-Satz (Inhaltstest).
- **Sicherheit der Erstwahl:** kein `high_skill`, kein `high_impact`, nie Tisch-Rudern, Nordic Curl oder Stuhl-Dips
  (A7); Einsteiger ohne `overhead` (A13). Jede Übung mit Merkmal hat eine erlaubte Alternative ohne Gerät und ohne
  Merkmal (Test).
- **Abweichungen vom Plan (vom Wächter angenommen):**
  1. **Hampelmann/Step-Jacks nicht in den Vorlagen** (Eigenschaftstest PLAN-PHASE-3, Wächter-Nachtrag Etappe A
     Nr. 7: keine `conditioning`-Übungen, bis `capWeeklyIncrease()` im Block-Bau greift, Phase 10). Abnehm-Vorlagen
     nutzen stattdessen Wadenheben.
  2. **Pike-Liegestütz nicht in den Vorlagen** (keine Alternative ohne Gerät und Merkmal), statt dessen
     Archer-Liegestütz. Folge: keine Über-Kopf-Übung, V11 seitliche Schulter gelb.
  3. **Neue Übung `handtuch-latziehen`** (Entwurf, `vertical_pull`, Halteübung, ohne Merkmal; Alternativen
     `klimmzug-band-unterstuetzt`/`klimmzug` mit Grund `harder`, `latziehen-band`) – macht bei „nur Klimmzugstange“
     den Klimmzug erreichbar (A6, Ü4). Steht auf der Fachprüf-Liste (W5).
- **Engine (`packages/core`, `PLAN_ENGINE_VERSION` 2 → 3):**
  - `isStrengthEquipment()`/`isBodyweightOnly()` (`equipment-profile.ts`, `BODYWEIGHT_PROFILE_RULES`): Kraft-Geräte
    sind nur freie Gewichte, Bänder, Maschinen; Ausdauer-Geräte, Bänke, Klimmzugstange und Dip-Station zählen nicht
    (A6, W2); unbekannte IDs zählen vorsichtshalber.
  - `isTemplateEligible(…, bodyweightOnly)` + `isBodyweightMatch()` (`match.ts`): harte Regel nur, wenn ALLE
    Kraft-Tage zu Hause ohne Kraft-Geräte sind; alle anderen Profile bekommen nie eine Körpergewicht-Vorlage (A2/A3).
    Ohne passende Körpergewicht-Vorlage: bisherige Suche mit `location_mismatch` und Güte „nächstbeste“ (A5).
  - Gemischte Wochen (Studio + Zuhause ohne Kraft-Geräte, `generate.ts`): immer Studio-Vorlage, die Zuhause-Tage
    tauschen über `findSubstitute()` (`location_mismatch`, `exercises_substituted`); Tests 1:1, 2:1, 1:2 jeweils
    ohne Geräte, mit Laufband, nur Klimmzugstange, nur Flachbank. **Offene Verbesserung:** Matching je Ort (Frage 7).
    Hinweistext `location_mismatch` in der App allgemeiner formuliert (W9).
  - `daysScore()` (A12): 1 Kraft-Tag → 2-Tage-Ganzkörper (14) vor 3-Tage-Ganzkörper (12).
  - **Zeitschnitt (W1):** `fitSessionToMinutes(…, { protectLastCore })` schützt in Schritt 1 nur die **letzte
    verbleibende Rumpf-Übung** und nur bei **Körpergewicht-Vorlagen** (beim Erstellen und im Folgeblock über
    `isBodyweightTemplateId()`). Für alle anderen Vorlagen ist das Ergebnis identisch zur Engine-Version 2: Test gegen
    die unveränderte V2-Kürzung (24 Vorlagen × 5 Geräte-Profile × gesund/schwanger × 20/30/45/60 min) und Vergleich
    der ganzen Engine HEAD gegen neu über 960 Profile: **0 Abweichungen, 0 neue `volume_reduced`**. „Nur Band“ ist
    keine Körpergewicht-Vorlage – dort bleibt es beim alten Verhalten (Rumpf kann beim Kürzen wegfallen).
  - Progression (A10, `loads.ts`): Körpergewicht nutzt `LOAD_PROGRESSION.extraRepsBuffer`/`extraSets` – Wdh. bis
    `reps_max + 2` (≤ 30), dann +1 Satz (≤ 6, V9), dann `harder_variant`; Erholungswoche ohne Schritt; nur kurze
    Fassungen → nur +Wdh. `progressHintForDisplay()` (`log/harder-variant.ts`) bindet `findHarderVariant()` mit
    aktuellen Sicherheitsregeln und Orts-Profil an: gesperrte oder nicht machbare Varianten → kein Vorschlag.
    **W8:** Einsteiger und vorsichtige Pläne bekommen nur Varianten höchstens eine Schwierigkeitsstufe schwerer
    (`HARDER_VARIANT_RULES`) – nach dem Handtuch-Latziehen also den Klimmzug mit Band, nicht direkt den freien
    Klimmzug (nur Stange → kein Vorschlag). `plan:examples` zeigt den Hinweis nur über `progressHintForDisplay()`
    (Beispiel „Emil“, W6); die App muss ihn in der UI-Etappe genauso anzeigen (PLAN-PHASE-4 5.1).
  - **Nachprüfung Runde 2:** Bei Körpergewicht-Vorlagen fällt in Schritt 3 des Kürzens bis hinunter zu 4 Übungen die
    letzte Nicht-Rumpf-Übung statt der letzten Übung, darunter wie bisher (die drei ersten Grundübungen bleiben, N1) – bei `minutes_min` behält jede Einheit Rumpf, Rudern und Hüftbeugen (Test, neue
    gelbe Regel **V13** „Einheit passt gekürzt in `minutes_min`“ ohne Befund im Inhaltsstand, N6). Der Folgeblock
    kürzt wie Block 1 (Core-Test mit Gegenprobe, Mobile-Test für `nextBlockFromRows`, N2). `isBodyweightTemplateId()`
    fällt ohne Vorlage in der Bibliothek (Zwischenspeicher, archiviert – RLS liefert nur `published`) auf die
    ID-Endung `-koerpergewicht` zurück; ein Test sichert ID-Endung ⇔ Kennzeichen ab (N3).
  - Keine neuen Hinweis-Codes, keine Migration.
- **Tests:** `plan/bodyweight.test.ts` (Inhalte, Notizen, Erstwahl-Sicherheit, gemischte Wochen, Eigenschaftstest
  über 6 Personengruppen × 5 Ziele inkl. Definition/Ausdauer × 3 Level inkl. Leistungssport × 1/2/3/4/6/7 Tage ×
  20/30/45/240 min × ohne Geräte/Laufband/Klimmzugstange/Flachbank, je Einheit geprüft), `match.test.ts`,
  `equipment-profile.test.ts`, `adapt.test.ts` (Rumpf-Schutz, V2-Vergleich), `loads.test.ts`/`progression.test.ts`,
  `log/harder-variant.test.ts` (inkl. W8), `plan-examples.test.ts` (Emil).
- **Regression (A11):** `koerpergewicht-regression.test.ts` vergleicht die 24 bestehenden Vorlagen jetzt bei
  **20/30/45/60 min** (Körpergewicht-Vorlagen ausgeblendet, beide Seiten mit derselben Engine, Unterschiede also nur
  aus den K1/K2-Übungen). Studio und Zuhause voll ausgestattet: unverändert. Abweichungen nur bei fehlenden Geräten
  bzw. Schwangerschaft durch neue Übungen (Snapshot). Profile ohne Kraft-Geräte bekommen in der App jetzt die
  Körpergewicht-Vorlagen.

**Etappe K4 – umgesetzt (06.10.2026, noch nicht committet):**

- **Entscheidung in `packages/core`:** `planInfoNotices(plan, library)` (`plan/view.ts`) liefert `bodyweight_limits`
  allein über das Vorlagen-Kennzeichen (`isBodyweightTemplateId()` – `isBodyweightTemplate()` bzw. ID-Endung
  `-koerpergewicht`, wenn die Bibliothek nicht geladen oder die Vorlage archiviert ist). Reiner Ausdauer-Plan und
  gemischte Wochen (Studio-Vorlage) → kein Hinweis. Kein neuer Engine-Hinweis-Code, keine Migration, Engine-Version
  bleibt 3.
- **App-Text** (`apps/mobile/src/i18n/de.ts`, `plan.infoNotices.bodyweight_limits`), angezeigt auf „Fertig“ und
  „Heute“ als Hinweis „Training ohne Geräte“: Plan ohne Geräte hält fit und baut Kraft auf; ehrlich: der Trainingsreiz
  ist ohne Geräte begrenzt, vor allem für Rücken und Beinrückseite; mit Kurzhanteln oder Band lässt sich gezielter
  steigern; Geräte unter Einstellungen → Angaben ändern eintragen → die App bietet einen neuen Plan an. Keine
  Heilversprechen. Die Klimmzugstange wird bewusst nicht als Planwechsel genannt (zählt nicht als Kraft-Gerät, W2).
- **W9:** Text `location_mismatch` war schon in K2+K3 allgemeiner gefasst – unverändert.
- **KONZEPT** Abschnitt 4 um „Training nur mit dem eigenen Körpergewicht“ inkl. ehrlichem Satz (A9) ergänzt;
  **PLAN-PHASE-3 Frage 12** als erledigt markiert.
- **Tests:** `view.test.ts` (alle Vorlagen im Inhaltsstand, ohne Vorlage, ohne Bibliothek/ID-Endung, erzeugte Pläne
  ohne Geräte bei 1/2/7 Tagen, mit Kurzhanteln, gemischte Woche); E2E `training-plan.spec.ts` (Zuhause ohne Geräte:
  Hinweis auf „Fertig“ und „Heute“; Studio: kein Hinweis).
- **Nicht in K4:** Hinweis in der Druckansicht/PDF – sie zeigt weder die Planbeschreibung noch diesen Hinweis; bei
  Bedarf eigene kleine Etappe.
