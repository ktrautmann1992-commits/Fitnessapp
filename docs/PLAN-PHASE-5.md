# Plan Phase 5 – Ernährungs-Engine, Essensplan und Einkaufsliste

**Status:** **freigegeben, Etappen N0 (Plan), N1 (Core: Bedarf, Grenzen, Makros, Timing) und N2a (Inhalte: Schemas, Prüfregeln, Einheiten) umgesetzt** – Stand 11.10.2026. Offene Fragen 16 B: Gründer „Alles wie empfohlen“ (10.10.2026). Gegenprüfung der R2-Blocker durch den Wächter im N0-PR. **N2b Teil 1 (Quelle/Lizenz geklärt, Import-Infrastruktur, Zuordnungs-Vorschlag) umgesetzt** – der Katalog selbst entsteht nach dem Merge über den Workflow `foods-import` (Umsetzungsstand N2b). **N2c (Rezept-Import als Entwurf) und N3 (Core: Essensplan, Meal-Prep, Einkaufsliste, Rezeptsuche) umgesetzt** – Stand 12.10.2026 (Umsetzungsstand N2c/N3). **N4 (App Testmodus: Einrichtung, Tag, Rezept) umgesetzt** – Stand 12.10.2026 (Umsetzungsstand N4). **N2d (Admin-Seiten Ernährung, Sammelfreigabe Rezepte pro Kategorie und Freigabe per ID in `content-review`, Fingerabdruck bestätigter Import-Annahmen) umgesetzt** – Stand 14.10.2026, drei offene Fragen von den Gründern entschieden (Umsetzungsstand N2d). **N5a (App Testmodus: gespeicherter Essensplan, Wochenansicht, „Andere Vorschläge“, „Rezept tauschen“, „Plan aktualisieren“, automatische Neuplanung 6.6) umgesetzt** – Stand 14.10.2026; N5 ist in **N5a** und **N5b** (Einkaufsliste, Meal-Prep-Kochtag, „Zur Einkaufsliste“) geteilt (Umsetzungsstand N5a). **N5b (App Testmodus: Einkaufsliste offline mit eigenen Einträgen und Zeitraum, Neuerzeugung bei Neuplanung W22, „Zur Einkaufsliste“, Meal-Prep-Pläne mit Kochtag und Timern, Auftau-Hinweise; K-a, K-b, K5, K7, N3 K1) umgesetzt** – Stand 14.10.2026; offene Gründer-Entscheidung: Mitteilungen im Hintergrund (`expo-notifications`), Löschfrist weiter offen (Umsetzungsstand N5b). **N5c (App Testmodus: Rezeptsuche mit vorbelegter, erweiterbarer Ernährungsform und gekennzeichneten Treffern, „Zur Einkaufsliste“ für diese Treffer, Ratgeber offline mit R21-Prüfung und „Zahlen aus“) umgesetzt** – Stand 14.10.2026 (Umsetzungsstand N5c). **N6 (PDF P5: Essensplan und Einkaufsliste als PDF, gratis – Dokumentmodell, Renderer-Bausteine `checklist`/`steps`, Druckansichten `ernaehrung/drucken` und `einkaufsliste/drucken`, Knöpfe, nativer Druck, CI-Artefakt) umgesetzt** – Stand 14.10.2026; EAS-Build Android noch von den Gründern zu prüfen (Umsetzungsstand N6). **N9 (Zutaten-Austausch, Prompt D, KONZEPT 6.9, gratis: Austausch-Tabelle mit Regel R23 und Batch-Art, Core `substitute.ts`, Dialog „Zutat austauschen“, Testmodus) umgesetzt** – Stand 14.10.2026; Server-Prüfung S7 und pgTAP mit N7 (Umsetzungsstand N9). **N10 (Bewertung nach dem Essen, Prompt D, KONZEPT 6.10, gratis: Core `ratings.ts` – Daumen runter 8 Wochen, Gründe nur Reihenfolge, `food_dislikes` hart in `filter.ts`; „Wie war’s?“ und Dialog ohne Vorauswahl, Testmodus) umgesetzt** – Stand 14.10.2026; Tabellen mit RLS und pgTAP mit N7 (Umsetzungsstand N10). **N11 (Kühlschrank-Suche „Was habe ich da?“ und Packungsgrößen, Prompt D, KONZEPT 6.11, gratis: Core `fridge-search.ts` nach den harten Filtern, Packungsgrößen als eigene Inhaltsart mit Regel R24 und Batch-Art `package-sizes`, Admin `/admin/packungen`, Testmodus) umgesetzt** – Stand 14.10.2026; Spalte `foods.package_size_g` mit N7 (Umsetzungsstand N11). **N14 (Resteplanung in der App, Testmodus, nur der sichere Teil: Reste-Score im Wochenplan, Hinweis „Nutzt deinen Rest“ ohne Mengen; Packungszahl/Rest zurückgestellt bis G-N13-4 und N11-G3) umgesetzt** – Stand 14.10.2026 (Umsetzungsstand N14). **N7 Teil 1 (Supabase-Datenbank für die Ernährung: Inhalts- und Nutzertabellen mit RLS, `seed_nutrition_content`, `save_meal_plan` mit erneuter Filter-Prüfung und Einwilligungs-Prüfung S9, `replace_shopping_list`, Bewertungen/„mag ich nicht“, Widerruf, Export, Löschung, pgTAP 23–26/28; `current_consent_version` nicht mehr für anon) umgesetzt** – Stand 14.10.2026; **Teil 2 (App im Supabase-Modus mit Tagebuch und eigenen Gerichten, `content-seed` Ernährung, Löschfrist 4 Wochen, Server-Plausibilität G-W3) umgesetzt** – Stand 16.10.2026 (Umsetzungsstand N7 Teil 2). **Nachtrag „Erweiterungen 2 (11.10.2026)“** in Abschnitt 19 (Fassung 2 nach Wächter-Prüfung, B1/B2 und S1–S14 eingearbeitet): Rezeptbestand aus `alpha5-rezepte.json`, Import in N2b/N2c, Umfang von Prompt C in N3–N6, neue Etappen N9–N14, W1 und P1. Fassung 3 nach Wächter-Nachprüfung `waechter-plan-5-r2.md` (Urteil „mit Auflagen“, alle Befunde eingearbeitet); Fassung 2 nach `waechter-plan-5.md`.
**Reihenfolge (Gründer-Entscheidung 09.10.2026):** 4b-A0 (erledigt) → Übungs-Glossar und Übungstausch (erledigt bis T2; T3 später mit Supabase) → **Phase 5** → Phase 4b (A → D → E; B/C später).
**Testphase:** zuerst nur im **Testmodus** (lokal auf dem Gerät, ohne Supabase). Supabase-Teile (Migrationen, RLS, pgTAP) sind hier vollständig geplant, kommen aber in einer späteren Etappe (N7). Einzige Ausnahme: die kleine CHECK-Migration für den Onboarding-Schritt in N4 (S8).

Grundlage: `CLAUDE.md` (Kalorien-Schutzgrenzen, Art. 9 DSGVO, KI-Grenze, „vorab generiert, regelbasiert zusammengesetzt“, Fachlogik nur in `packages/core`), `docs/KONZEPT.md` Abschnitte 3, 6, 6.1–6.3, 12, 13, 14, 15, `docs/PROMPTS.md` Phase 5 und „Erweiterung Phase 5“, `docs/PLAN-PHASE-4.md` (Stil, Testmodus, Widerruf, Export), `docs/PLAN-PHASE-4B.md` (reservierte `nutrition/limits.ts`, K1), `docs/PLAN-PDF-EXPORT.md` (P5 vorgemerkt).

---

## Wächter-Prüfung: eingearbeitet

Prüfbericht: `waechter-plan-5.md` (09.10.2026) – 6 blockierend, 18 soll, 11 kann, 16 fehlende Grenzfall-Tests. **Alle Befunde sind eingearbeitet.** Die Nachprüfung (Runde 2, siehe nächster Abschnitt) hat B3, B6, S7, S8 und S10 nur als „teilweise gelöst“ gewertet und K5 korrigiert; die Nachbesserungen stehen unter „Wächter-Prüfung Runde 2: eingearbeitet“.

## Wächter-Prüfung Runde 2: eingearbeitet

Prüfbericht: `waechter-plan-5-r2.md` (10.10.2026, geprüft gegen Commit `390d3fa`) – Urteil **„mit Auflagen“**: 3 blockierend, 8 soll, 9 kann, 9 fehlende Tests. **Alle Befunde sind eingearbeitet** (Kann-Befunde alle übernommen, R2-K7 und R2-K9 als Gründer-Fragen). Eine weitere Wächter-Runde ist laut Bericht nicht nötig: **Die R2-Blocker werden im N0-PR gegengeprüft.**

### Blockierend

| Befund                                                                                                                                                               | Lösung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Abschnitt                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **R2-B1** Katch-McArdle senkt weiterhin die 25-%- und die 1-%-Grenze (nur BMR-Untergrenze war geschützt); Randfall `bmrForFloor` > Tagesbedarf                       | Neuer **„Bedarf für Grenzen“** `TagesbedarfGrenze(d) = max(bmrMifflin, bmrKatch) × Alltagsfaktor + Trainingsenergie(d)`. **Alle** Untergrenzen (BMR, 25 %, 1 %/Woche, EA) und das Band bei `maintenance_only` rechnen damit; `bmrForNeeds` nur noch für den **Vorschlag** (4.5). Beispiel Frau 100 kg/170 cm/30 J./KF 50 %/sitzend/Ruhetag/Fettverlust nachgerechnet: Vorschlag 1.682 → Untergrenze 1.904,76 (25 % unter Mifflin-Gesamtumsatz 2.539,68) → **Ziel 1.910 kcal** (24,8 % darunter, vorher 1.760 = 30,7 %). Weil `TagesbedarfGrenze ≥ 1,45 × bmrForFloor`, kann das Band nie unter dem Grundumsatz beginnen                                                                            | 4.3, 4.4, 4.6, 4.6.1, 12.2 (W3, W17)              |
| **R2-B2** Herkunft des „eingecheckten Quellauszugs“ offen – sonst prüft R17 KI-Werte gegen KI-Werte                                                                  | Auszug entsteht **nur maschinell** in `foods-import.yml`: Original-Datei von der amtlichen Adresse laden → `SOURCE.json` mit URL, Version, Abrufdatum, **SHA-256 der Original-Datei** und SHA-256 von `extract.csv` → Skript filtert die Quell-IDs **ohne Werte zu ändern**. CI (`sources-integrity`): Prüfsumme von `extract.csv` passt zu `SOURCE.json`, jede Zeile ist eine unveränderte Zeile der Original-Datei (eingecheckte Original-Datei, falls die Lizenz es erlaubt, sonst erneutes Laden mit Prüfsummen-Vergleich); Änderungen unter `content/sources/**` nur in PRs des Workflows (Branch `foods-import/<run-id>`, Autor `github-actions[bot]`) – sonst **rot**. Prüfsumme im PR-Text | 5.1, 5.1.1 (a/b), 5.3 (R17), 13 (N2b), 12.2 (W18) |
| **R2-B3** Falsche Gruppen-IDs (`egg`/`peanut`), `shellfish` als eine Gruppe, Pflichtregeln fehlen für `poultry`, `beef`, `lamb`, `legumes`, `mushrooms`, `sulphites` | IDs im Repo geprüft (`packages/core/src/food-groups.ts`, 23 Gruppen): **`eggs`**, **`peanuts`**, **`shellfish`** (Krebs- **und** Weichtiere). R18 ist ein `Record<FoodGroupId, …>` – der TypeScript-Compiler erzwingt für **jede der 23 Gruppen** einen Eintrag: Wortregel **oder** ausdrücklich „ohne Wortregel, nur Prüfung durch Menschen“ (mit Begründung). Laufzeit-Test: jede Regel zeigt auf eine ID aus `FOOD_GROUPS`. Vollständige Regeltabelle in 5.1.3                                                                                                                                                                                                                                  | 5.1.1 (c), 5.1.3, 12.2 (W19)                      |

### Soll

| Befund                                                                                                                                                    | Lösung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Abschnitt                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| R2-S1 R18 nach Namen erkennt zu wenig (Nudeln, Brot, Mehl, Mozzarella, Lachs, Garnele …) und zu viel („Ei“ in Weizen/Reis/Fleisch, „Milch“ in Kokosmilch) | (1) Erkennung nach **ganzen Wortteilen** (Wortanfang/-ende, Komposita-Teile) mit **Negativliste** je Regel (z. B. „Kokos-/Soja-/Hafer-/Mandel-/Reis-“ vor „Milch/Sahne/Drink“, „Erdnuss-/Kakao-/Mandel-“ vor „Butter“, „Tintenfisch“ nicht `fish`); (2) zusätzlich **Lebensmittelgruppe der Quelle** (beim BLS die Hauptgruppe aus dem ersten Zeichen des BLS-Schlüssels; bei anderer Quelle deren Kategorie): Getreideprodukte → `gluten` (begründete Ausnahmen Reis, Mais, Hirse, Buchweizen, Quinoa …), Milchprodukte → `dairy`, Fisch → `fish`, Krebs-/Weichtiere → `shellfish`, Fleisch nach Tierart; (3) **Erwartungsliste je Lebensmittel** (`allergen-expectations.json`, Gruppen je `food_id`), bei der Katalog-Prüfung R19 von Menschen bestätigt, Test gegen alle ~150 Lebensmittel; erweiterte Wortlisten in 5.1.3 | 5.1.1 (c), 5.1.3, 12.2 (W19)                              |
| R2-S2 `pregnancy_caution` nicht abgesichert; hängt oft von der Zubereitung ab                                                                             | `pregnancy_caution` in die **R19-Checkliste** und in die **R18-Pflichtregeln** (Rohmilch, Rohmilchkäse, kalt geräucherter/gebeizter Fisch, Sushi/roher Fisch, Rohwurst/Salami/Mett/Rohschinken, Leber). Im Rezept bekommt jede Zutat aus `eggs`, `fish`, `shellfish` oder mit `animal: meat` das Pflichtfeld **`heated: boolean`**; `no_cook`-Rezepte mit tierischer Zutat dieser Art oder eine ungegarte solche Zutat → Rezept automatisch `pregnancy_caution`. Neues Feld `declared_pregnancy_caution`; **R13 rot** bei Abweichung                                                                                                                                                                                                                                                                                           | 5.1.1 (c/d), 5.1.3, 5.2, 5.3 (R13), 12.2 (W20)            |
| R2-S3 `nutrition_setup` im Supabase-Modus vor N7 ohne Spalten                                                                                             | `OnboardingState` bekommt `nutritionSetupAvailable?: boolean`; `isStepApplicable('nutrition_setup')` ist **nur wahr, wenn `nutritionSetupAvailable === true`** – das setzt bis N7 nur das lokale Backend (Testmodus); der Supabase-Modus blendet den Schritt aus, bis die Spalten existieren (N7 schaltet um). CHECK-Migration bleibt in N4 (db-sync). Test in `onboarding.test.ts` + Backend-Test                                                                                                                                                                                                                                                                                                                                                                                                                             | 8.1, 13 (N4, N7), 12.2 (W21)                              |
| R2-S4 Automatische Neuplanung lässt die Einkaufsliste veraltet                                                                                            | Jede **automatische** Neuplanung erzeugt die Einkaufsliste für den betroffenen Zeitraum neu; Häkchen bleiben über `item_key`; weggefallene, schon abgehakte Einträge bleiben mit Hinweis „nicht mehr im Plan“, weggefallene offene verschwinden; eigene Einträge bleiben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 6.5, 6.6, 12.2 (W11, W22)                                 |
| R2-S5 `clampCalorieAdjustment` mit kleinem Kontext wäre zweite, schwächere Begrenzungsstelle                                                              | `clampCalorieAdjustment(currentOffset, proposedOffset)` begrenzt **nur Schrittweite und Summe des Versatzes** (`ADJUSTMENT_OFFSET_MAX_KCAL = 1000` und `ADJUSTMENT_STEP_MAX_KCAL = 150`, beide schon in N1 als PRODUKTENTSCHEIDUNG; 4b wählt `LIVE_ADJUSTMENT.calorieStepKcal` ≤ 150, N0-Gegenprüfung H3). **Alle Schutzgrenzen** gelten ausschließlich in `nutritionTargetsForWeek` → `clampCalorieTarget`. 4b-Plan 5.2 wird in N0 umformuliert                                                                                                                                                                                                                                                                                                                                                                               | 4.1, 4.6, 2.2, 13 (N0), 12.2 (W23)                        |
| R2-S6 K5 war falsch: `validateContent` läuft in der App (`local-backend.ts:111`), nicht im Bundle-Skript                                                  | Formulierung korrigiert. Der Filter „Entwurf ohne roten Befund, nur mit katalog-geprüften Lebensmitteln“ ist eine neue Core-Funktion **`selectNutritionContent(validateContent(files), { allowDrafts })`** in `packages/core/src/content/` (mit Test), aufgerufen in `apps/mobile/src/data/local-backend.ts` wie `selectPlanContent`. `FOLDERS` in `scripts/bundle-content.mjs` und `CONTENT_FOLDERS` in `packages/content/src/validate.ts` werden um `foods`/`recipes` ergänzt                                                                                                                                                                                                                                                                                                                                                | 3, 5.1.1 (d), 5.3, 6.1, 7.5, 9, 13 (N2a, N2c), 12.2 (W24) |
| R2-S7 Band bei `maintenance_only` ohne Schutzgrenze und mit +10 % trotz Überschussdeckel +5 %                                                             | Band `maintenance_only` = `[max(dayFloorKcal(d), TagesbedarfGrenze(d)) ; TagesbedarfGrenze(d) × (1 + min(0,10; surplusCap))]`. Verallgemeinert: Die **Band-Obergrenze** beachtet den Überschussdeckel in **jedem** Modus (z. B. unter 18 mit `general_fitness`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 4.6.1, 12.2 (W25)                                         |
| R2-S8 Deckel der Trainingsenergie wirkt in die unsichere Richtung                                                                                         | Greift `TRAINING_KCAL_DAY_MAX`, plant dieser Tag **ohne Defizit**: Untergrenze = `TagesbedarfGrenze(d)` (Hinweis `training_energy_capped`); gilt auch für die EA-Untergrenze                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 4.4, 4.6, 12.1, 12.2 (W25)                                |

### Kann

| Befund                                                                               | Entscheidung                                                                                                                                                                                                                             | Abschnitt           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| R2-K1 „KH nie unter 130 g (`ceil`)“ widerspricht „≤ 10 kcal“                         | **übernommen:** Kohlenhydrate sind immer der gerundete Rest, die Energie bleibt verbindlich; unter 130 g nur Hinweis `carbs_below_reference`. Test immer erfüllbar                                                                       | 4.7, 12.2 (W13)     |
| R2-K2 EA nach Loucks mit **Brutto**-Trainingsenergie                                 | **übernommen (vorsichtig):** in der EA-Formel `EEE = MET × kg × h` (brutto), sonst netto; beim Zitat-Check vor N1 bestätigen                                                                                                             | 4.4, 4.6            |
| R2-K3 Heute zählt nur der aktive Plan                                                | **übernommen:** Für **heute** zählen alle `completed` jeder Planversion plus `planned` des aktiven Plans, ohne Doppelzählung über `session_id`                                                                                           | 4.4, 12.2 (W8)      |
| R2-K4 Unverträglichkeiten nur bei Zustimmung zwischenspeichern                       | **übernommen:** Einlesen nur nach aktiver Zustimmung zur Umwandlung, Ablage als „ausstehende Abneigungen“; bei Ablehnung wird nichts behalten                                                                                            | 7.4                 |
| R2-K5 Test-Profil braucht „weiblich“                                                 | **übernommen:** Schritt 1 in 15 mit „Geschlecht weiblich“                                                                                                                                                                                | 15                  |
| R2-K6 `catalog_reviewed_by/at` nur über `content-review`                             | **übernommen:** neue Option „Katalog geprüft“ im Workflow `content-review`, Merge durch einen Menschen; CI rot, wenn ein PR außerhalb dieses Workflows die Felder setzt/ändert (Branch `content-review/*` + Autor `github-actions[bot]`) | 5.1.1 (d), 13 (N2b) |
| R2-K7 Premium-Prüfung in `save_meal_plan` verhindert das Rechnen auf dem Gerät nicht | **übernommen als Gründer-Frage für Phase 7** (16 B (l), mit Empfehlung)                                                                                                                                                                  | 7.3, 16 B (l)       |
| R2-K8 `save_meal_plan` prüft `pregnancy_caution` nicht                               | **übernommen:** bewusst nur im Core (S9-Begründung); wird in KONZEPT 12 neben den Kalorien-Grenzen aufgeführt                                                                                                                            | 7.3, 14             |
| R2-K9 Koffein-Hinweis in `no_targets` (BfR ≤ 200 mg/Tag)                             | **übernommen als Gründer-Frage** (16 B (m), Empfehlung: ja, fester Hinweis)                                                                                                                                                              | 4.9, 16 B (m)       |

### Fehlende Tests (R2)

Alle 9 sind als **W17–W25** in 12.2 aufgenommen und Etappen zugeordnet; W3, W8, W11 und W13 sind ergänzt.

### Blockierend

| Befund                                                                                                                       | Lösung                                                                                                                                                                                                                                                                                                                                                                                                                        | Abschnitt                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **B1** Ausgelieferter Essensplan kann unter BMR / über 25 % Defizit liegen (±10 %, 1 Mahlzeit, leere Slots, Meal-Prep-Reste) | **Planband je Tag**: Toleranz nach unten durch die Schutzgrenzen begrenzt (`Untergrenze(d)` = Maximum aller Untergrenzen, auch EA). Zielpunkt = Bandmitte. Ausgleich mit bis zu 2 Ergänzungs-Snacks. Tag unter der Untergrenze → Status `below_floor`, Hinweis `day_below_floor`, nie als „dein Plan“. Gilt auch für 1 Mahlzeit, leere Plätze, Meal-Prep-Reste. Eigenschaftstest über die **Ausgabe von `buildMealPlanWeek`** | 4.6.1, 6.2, 6.3, 6.4, 12.2 |
| **B2** Rundung kann Untergrenze unterschreiten; Makro-Reihenfolge fehlt; ±2 % unerfüllbar                                    | **Gerichtete Rundung**: im Band bleiben – unter der Untergrenze → `ceil` auf 10, über dem Überschuss-Deckel → `floor` auf 10; Vergleich gegen die **ungerundete** Grenze. Makros: Eiweiß → Fett → Kohlenhydrate aus dem Rest, je gerichtet gerundet. Test-Toleranz **≤ 10 kcal absolut** (erfüllbar)                                                                                                                          | 4.3, 4.6.2, 4.7            |
| **B3** Katch-McArdle mit selbst geschätztem Körperfett senkt die Untergrenze                                                 | Katch-McArdle nur für den **Bedarf**. **Untergrenze = max(Mifflin, Katch-McArdle)** – erweitert durch R2-B1 auf **alle** Untergrenzen (`TagesbedarfGrenze`)                                                                                                                                                                                                                                                                   | 4.3, 4.6                   |
| **B4** Fall „Körperdaten, aber kein Gesundheits-Check“ fehlt                                                                 | **Konservativ wie beim Training** (`planSafetyRules`: `noHealthCheck → cautious`): Defizit ≤ 15 %, Überschuss ≤ 5 %, Eiweiß ≤ 1,6 g/kg, Hinweis „Gesundheits-Check machen“; bei Geschlecht ≠ männlich zusätzlich `maintenance_only` + Ausschluss `pregnancy_caution` bis zum Check                                                                                                                                            | 4.9, 16 B (a)              |
| **B5** Schwangerschaft/Stillzeit: „Erhalt“ ist fachlich ein Defizit; Flag unbefristet                                        | Modus **`no_targets`** (kein Ziel, keine Makro-Gramm, Standardportionen + Mindestportion S15), Ausschluss `pregnancy_caution`, Hinweis Ärztin/Arzt/Hebamme + „Hat sich etwas geändert? Gesundheits-Check aktualisieren“. Ersetzt die frühere Empfehlung „nur Erhalt“ (sicherere Präzisierung der Gründer-Entscheidung 2). Koletzko 2018 vor N1 vollständig zitieren. Gültigkeit des Flags → Frage                             | 4.9, 16 A (2), 16 B (b)    |
| **B6** Lebensmittel-Katalog sicherheitskritisch, aber KI-geschrieben                                                         | (a) Nährwerte **maschinell aus der Quelldatenbank importiert** (Skript + GitHub Action, `source.ref`), (b) **CI-Prüfung gegen eingecheckten Quellauszug** (R17), (c) **Allergen-Pflichtregeln als Code** (R18, Name/Alias → Gruppe), (d) **menschliche Katalog-Prüfung** mit Checkliste (R19) – erst danach Rezepte nutzbar, auch im Testmodus                                                                                | 5.1, 5.1.1, 5.3, 13 (N2b)  |

### Soll

| Befund                                               | Lösung                                                                                                                                                                                                                                              | Abschnitt          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| S1 Alltagsfaktor-Untergrenze unterschätzt den Umsatz | **Mitte der D-A-CH-Spannen** 1,45 / 1,65 / 1,85 / 2,2; ohne Angabe 1,45 mit Vermerk „unterschätzt bei aktiven Menschen eher“ (nicht „vorsichtig“)                                                                                                   | 4.4, 16 B (d)      |
| S2 Energieverfügbarkeit bei Sportlern                | Defizit/Überschuss aus dem Bedarf **ohne** Trainingsenergie, Training kommt voll obendrauf; zusätzliche Untergrenze **EA ≥ 30 kcal/kg FFM** (Loucks 2011, Mountjoy 2023), FFM ohne Messung nach Janmahasatian 2005, nie höher als der Bedarf        | 4.5, 4.6, 16 B (c) |
| S3 Optionale Zutaten                                 | zählen immer für R6/R7/R8 und `pregnancy_caution`; Filter darf sie **weglassen** und rechnet neu                                                                                                                                                    | 5.2, 6.1           |
| S4 Ersatz-Zutaten                                    | durchlaufen den **kompletten Filter** erneut; laktosefreie Milch bleibt `dairy`; Haferdrink = `gluten`; Einkaufsliste/PDF nutzen das Ersatzprodukt                                                                                                  | 5.1, 6.1, 6.5      |
| S5 Schwein, Gelatine, Ernährungsform                 | `animal[]` als Array, `meat_kind[]`; Gelatine ohne Herkunft = Schwein; Labkäse nicht vegetarisch; Zuordnungsregeln mit Quelle für Gruppen ohne EU-Definition (SIGHI für Histamin); Hinweis HFI/Zöliakie; Gruppentext Gluten um Hafer/Dinkel ergänzt | 5.1, 5.1.2         |
| S6 Neueste Körperdaten je Feld                       | Größe, Gewicht, Körperfett je Feld aus der neuesten Zeile **mit Wert**, je eigenes Datum                                                                                                                                                            | 4.2                |
| S7 Moduswechsel                                      | bei jedem Öffnen Abgleich gegen aktuellen Modus/Planband; Abweichung → **automatische Neuplanung ab heute**                                                                                                                                         | 6.6                |
| S8 `db-sync.test.ts` in N4                           | **kleine CHECK-Migration schon in N4**; neue Enums bleiben bis N7 außerhalb von `enums.ts`                                                                                                                                                          | 7.2, 8.1, 13       |
| S9 Schutzgrenzen auf dem Server                      | `save_meal_plan` lehnt Faktor ≠ 1 ohne gültige `health_data`-Einwilligung ab; Kalorien-Grenzen prüft bewusst nur der Core (in KONZEPT 12 festhalten); SQL-Plausibilität optional                                                                    | 7.3                |
| S10 Schnittstelle zu 4b                              | 4b-Anpassung = **Versatz in `nutritionTargetsForWeek`**, läuft immer durch `clampCalorieTarget` (einzige Begrenzungsstelle); 4b-Plan in N0 nachtragen – präzisiert durch R2-S5                                                                      | 4.6, 13 (N0)       |
| S11 Trainingsenergie                                 | (a) aktiver Plan + erledigte Einheiten früherer Pläne nur für vergangene Tage, ohne Doppelzählung; (b) `effort_target` **1–4**, lückenlose MET-Zuordnung + Ersatzwert; (c) Compendium-Codes vor N1 prüfen; (d) Deckel `TRAINING_KCAL_DAY_MAX`       | 4.4                |
| S12 Meal-Prep-Sicherheit je Lebensmittel             | `max_fridge_days` je Lebensmittel, Rezept nimmt das Minimum; BfR wortgenau; ohne `freezable` → frisch kochen                                                                                                                                        | 5.1, 5.3 (R9), 6.4 |
| S13 Lizenz vor N2                                    | Lizenzklärung ist Voraussetzung für N2b; `source.license` je Lebensmittel; Namensnennung unter „Lizenzen“ und im PDF-Fuß; eine Hauptquelle, keine ungekennzeichnete Mischung; USDA Natrium × 2,5                                                    | 5.1, 10, 16 B (f)  |
| S14 N2 zu groß                                       | Aufgeteilt in **N2a–N2d**; N3 braucht nur N2a + Fixtures                                                                                                                                                                                            | 13                 |
| S15 `no_targets` ohne Untergrenze                    | keine Tagessummen gegen ein Ziel; fester Hinweis „iss dich satt“; interner Mindestwert `NO_TARGETS_MIN_DAY_KCAL` ergänzt einen Snack (ohne Zahl)                                                                                                    | 6.2                |
| S16 Eiweiß und Nieren                                | Hinweis ab > 1,6 g/kg; bei `medication` ≤ 1,6 g/kg; ab 65 1,2–1,6 g/kg (PROT-AGE)                                                                                                                                                                   | 4.7                |
| S17 Ablauf der Umwandlung beim Widerruf              | erst einlesen, dann widerrufen, dann „mag ich nicht“ schreiben (ersetzt „mag ich“), dann neu planen; dazwischen kein Plan; Abbruch offline abgefangen                                                                                               | 7.4                |
| S18 Offene Fragen ergänzen                           | neue Fragen (a)–(k) mit Empfehlung; am 10.10.2026 entschieden: Empfehlung gilt („Alles wie empfohlen“)                                                                                                                                              | 16 B               |

### Kann

| Befund                                                   | Lösung                                                                                                                                                                                                                                                                       | Abschnitt        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| K1 „ganzzahlig, keine Rundung“ widersprüchlich           | „ungerundet weiterrechnen, erst die Ausgabe gerichtet runden“                                                                                                                                                                                                                | 4.3              |
| K2 Mifflin für 19–78 J. bestätigt                        | Hinweis-Code `bmr_estimate_age` für 16–18 und > 78                                                                                                                                                                                                                           | 4.3              |
| K3 IOM Kohlenhydrate Schwangerschaft/Stillzeit 175/210 g | vermerkt, nur relevant, falls dort später Ziele kommen                                                                                                                                                                                                                       | 4.7              |
| K4 Ersatz-Hinweis im PDF verrät Unverträglichkeit        | bewusste Ausnahme festgehalten; PDF-Test entsprechend formuliert                                                                                                                                                                                                             | 11, 12.2         |
| K5 Code-Bezüge                                           | `packages/core/src/content/text-rules.ts`; Routen unter `apps/mobile/src/app/…`; `effort_target` 1–4; `content:validate` vs. Laufzeitprüfung `validateContent` – **korrigiert durch R2-S6:** `validateContent` läuft in der App (`local-backend.ts`), nicht im Bundle-Skript | 3, 5.3, 6.1, 8.2 |
| K6 Testmodus öffentlich                                  | Warnhinweis „Allergene noch nicht fachlich geprüft“ bei Entwürfen                                                                                                                                                                                                            | 8.2, 8.3         |
| K7 Einwilligungstext                                     | nächste Fassung `health_data`: Widerruf löscht auch Essenspläne/Einkaufslisten mit Gesundheitsbezug                                                                                                                                                                          | 7.4              |
| K8 `meal_plans.inputs`                                   | ausdrücklich **ohne** Unverträglichkeiten (und ohne Körperdaten/Flags)                                                                                                                                                                                                       | 7.2              |
| K9 Konflikt Unverträglichkeit + „mag ich“                | Unverträglichkeit gewinnt; Test                                                                                                                                                                                                                                              | 6.1, 12.2        |
| K10 eigene Einträge in der Einkaufsliste                 | Widerrufs-Dialog erwähnt, dass sie mit gelöscht werden                                                                                                                                                                                                                       | 7.4              |
| K11 Kokos                                                | Empfehlung: nicht `tree_nuts`, aber in „Enthält“ als „Kokos“ genannt (Frage)                                                                                                                                                                                                 | 5.1.2, 16 B (k)  |

### Fehlende Grenzfall-Tests

Alle 16 sind als **W1–W16** in Abschnitt 12.2 aufgenommen und den Etappen zugeordnet.

---

## Gründer-Entscheidungen (09.10.2026, „alles wie empfohlen“)

Fest eingetragen; Details in 16 A.

1. **Gratis/Premium:** Bedarf, Makros und Rezepte **gratis**. Essensplan und Einkaufsliste in der **Testphase für alle offen**, endgültige Entscheidung mit **Phase 7**. **PDF gratis.**
2. **Unter 18:** nur Erhalt, **kein Defizit**. **Schwangerschaft/Stillzeit:** jetzt Modus **`no_targets`** gemäß B5 – das ist eine **sicherere Präzisierung** der Gründer-Empfehlung „nur Erhalt“ (Erhalt ohne Zuschläge wäre fachlich ein Defizit).
3. **Essstörungen:** keine Abfrage; Hinweis für alle + Schalter **„Kalorienzahlen ausblenden“**.
4. Neuer Onboarding-Schritt **`nutrition_setup`** (Alltagsaktivität, Trainingszeit).
5. **„Mag ich nicht“ = harter Ausschluss.**
6. **Fachprüfung durch eine Ernährungsfachkraft vor dem Livegang**; Testphase mit gekennzeichneten Entwürfen.

Reihenfolge: nach Übungs-Glossar/Übungstausch, vor 4b; **Testmodus zuerst**.

---

## 1. Ziel in einfachen Worten

Bisher sagt Alpha5 euch, **wie** ihr trainiert. Ab Phase 5 sagt die App auch, **was und wie viel ihr esst**:

1. Sie rechnet euren **Tagesbedarf** aus – an Trainingstagen mehr, an Ruhetagen weniger – und passt ihn an euer Ziel an (abnehmen, Definition, Muskelaufbau, Fitness, Ausdauer). Feste **Schutzgrenzen** sorgen dafür, dass nie zu wenig gegessen wird – **auch im fertigen Essensplan, nicht nur in der Zielzahl**. Diese Grenzen kann niemand abschalten.
2. Daraus werden **Eiweiß, Kohlenhydrate und Fett** in Gramm, mit Hinweisen, welche Mahlzeit **vor** und welche **nach** dem Training liegt.
3. Die App stellt einen **Wochen-Essensplan** aus fertigen, geprüften **Rezepten** zusammen – passend zu vegetarisch/vegan, ohne Schwein, Abneigungen, Unverträglichkeiten, Mahlzeiten pro Tag und Kochmodus (täglich frisch oder Meal-Prep). Die Portionen werden auf euren Bedarf **skaliert**.
4. Daraus entsteht eine **Einkaufsliste**: Mengen zusammengerechnet, nach Supermarkt-Abteilungen sortiert, zum Abhaken – auch offline.
5. Ernährungsplan und Einkaufsliste gibt es als **PDF im Alpha5-Layout** (gratis).

Alles läuft über **feste Regeln in `packages/core`, ohne KI** zur Laufzeit. Die Nährwerte der Lebensmittel kommen **maschinell aus einer amtlichen Nährwertdatenbank**, nie von einer KI. Die Rezepte sind vorab erstellt (erst als Entwürfe in einer Claude-Sitzung, später per Batch-API), werden automatisch geprüft (u. a. **Nährwerte und Allergene aus den Zutaten berechnet**) und von euch freigegeben; vor dem Livegang prüft eine Ernährungsfachkraft.

## 2. Umfang und Abgrenzung

### 2.1 Was in Phase 5 (Kern) kommt

1. **Ernährungs-Engine** `packages/core/src/nutrition/`: Grundumsatz, Gesamtumsatz tagesgenau inkl. geplanter Trainingsenergie, Zielanpassung mit Schutzgrenzen, Makros, Mahlzeiten-Timing, Sonderfälle.
2. **Lebensmittel-Katalog** (maschineller Import aus der Quelldatenbank, CI-Abgleich, Allergen-Pflichtregeln, menschliche Prüfung) und **Rezepte** als Inhalte unter `content/foods/` und `content/recipes/` (Zod-Schemas, Prüfregeln R1–R19, Status `draft/published/archived`, Kennzeichnung „KI-Entwurf – fachlich prüfen“).
3. **Wochen-Essensplan** (deterministisch) mit Portionsskalierung im **Planband** (B1), Abwechslung, Kochmodus täglich/Meal-Prep, „Rezept tauschen“.
4. **Einkaufsliste** (aggregiert, Einheiten, DACH-Abteilungen, Vorrat, eigene Einträge, abhaken, offline).
5. **App** (Testmodus zuerst): Onboarding-Schritt `nutrition_setup`, Ernährung „Heute“, Woche, Rezeptansicht, Einkaufsliste, Einstellungen, Leer-/Fehlerzustände.
6. **PDF P5**: Ernährungsplan und Einkaufsliste (gratis).
7. **Supabase** (spätere Etappe N7): Inhaltstabellen + Seed, Nutzertabellen mit RLS, `security definer`-Funktionen, Widerruf, Export, Löschung, pgTAP.
8. **Content-Pipeline-Art `recipe`** für die Batch-API (später, optional, N8).

### 2.2 Was NICHT in Phase 5 (Kern) kommt

| Thema                                                                                                                                    | Wann / Begründung                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Barcode-Scan, Open Food Facts, `food_products`, Ernährungstagebuch `food_log_entries`, Favoriten                                         | Erweiterung Phase 5, Etappe X1/X2 (Abschnitt 13); X2 umgesetzt als E1 (PLAN-AUSWERTUNG)                                                                                                                                                                           |
| Standardgerichte `custom_meals`                                                                                                          | Erweiterung Phase 5, Etappe X3                                                                                                                                                                                                                                    |
| Zielmengen und 2–3 Vorschläge je Zeitfenster vor/während/nach jeder Einheit, Push-Erinnerung, „Gegessen“ per Tipp (KONZEPT 6.3, Premium) | Erweiterung Phase 5, Etappe X4. Im Kern gibt es nur die **Zuordnung** „diese Mahlzeit vor/nach dem Training“ und den Hinweis zur Verpflegung bei langen Einheiten.                                                                                                |
| Wettkampf: Carb-Loading, Frühstück am Wettkampftag, Gel-/Trinkplan; Ausdauer-Anstrengung „mittel/hart“                                   | Phase 10 (PROMPTS Phase 10)                                                                                                                                                                                                                                       |
| Kalorien-Anpassung bei Stagnation (Fettverlust/Muskelaufbau, KONZEPT 4.1)                                                                | Phase 4b (Premium). Phase 5 liefert `clampCalorieAdjustment()` (begrenzt nur Schrittweite und Summe des Versatzes, R2-S5) und den Versatz-Eingang in `nutritionTargetsForWeek` (S10); alle Schutzgrenzen greifen danach in `clampCalorieTarget`. 4b ruft nur auf. |
| Kalorienziele in Schwangerschaft/Stillzeit (Zuschläge nach Trimester)                                                                    | nicht geplant; Modus `no_targets` (B5)                                                                                                                                                                                                                            |
| Freies Tauschen einzelner Zutaten                                                                                                        | später; im Kern nur „Rezept tauschen“ und feste Ersatz-Zutaten bei Unverträglichkeit (z. B. laktosefreie Milch) **→ ersetzt durch 19.1/19.7 (N9, 11.10.2026)**                                                                                                    |
| Budget/Preise                                                                                                                            | nicht im KONZEPT; Feld `cost_level` nur reserviert **→ ersetzt durch 19.1/19.4 (Kosten als Schätzung, Frage 19.12 (a))**                                                                                                                                          |
| Gemeinsame Einkaufsliste (Partner-Modus)                                                                                                 | Phase 11 **→ bleibt Phase 11 (P1); Weitergeben als Text/PDF in N12**                                                                                                                                                                                              |
| Kalorien per Foto, KI-Erklärungen                                                                                                        | Phase 7b, Premium mit KI                                                                                                                                                                                                                                          |
| Packungsgrößen und Reste-Verwertung                                                                                                      | später **→ ersetzt durch 19.7 (N11, N13, N14)**                                                                                                                                                                                                                   |

### 2.3 Gratis und Premium (Gründer-Entscheidung 1)

- **Gratis:** Bedarf, Makros, Timing-Hinweise, Rezepte ansehen, **PDF**.
- **Essensplan + Einkaufsliste:** in der **Testphase für alle offen**. Endgültig gratis oder Premium wird mit **Phase 7** entschieden (dort auch Frage 16 B (g): PDF bei Premium-Plan).
- **Testmodus:** alles sichtbar, keine Premium-Prüfung (wie 4b K2).
- **Supabase-Modus:** Die Premium-Infrastruktur (`has_entitlement`, Flags) entsteht erst mit 4b B bzw. Phase 7. Die Stelle ist vorbereitet: Wird der Wochenplan Premium, prüft das **`save_meal_plan()` auf dem Server** (nie nur die App).
- Keine Funktion dieser Phase nutzt Echtzeit-KI.

---

## 3. Ist-Stand, auf dem wir aufbauen (geprüft am 09.10.2026)

- `nutrition_prefs` (diet_type `omnivore|vegetarian|vegan`, eats_pork, meals_per_day 1–8, cooking_mode `daily|meal_prep`, mealprep_days 1–7) und `food_preferences` (food_group aus `FOOD_GROUPS`, kind `like|dislike|intolerance`; **intolerance = Art. 9**, nur mit `health_data`; Unique-Index `like_xor_dislike`) in `supabase/migrations/20261003120500_nutrition_preferences.sql`. Onboarding-Schritte `nutrition` und `cooking` (`packages/core/src/onboarding.ts`, `apps/mobile/src/steps/nutrition-steps.tsx`), Schemas `nutritionStepSchema`/`cookingStepSchema` in `validation.ts`.
- `FOOD_GROUPS` (`packages/core/src/food-groups.ts`): 14 EU-Hauptallergene + Laktose, Fruktose, Histamin, Pilze, Zwiebel/Knoblauch, Scharf, Geflügel, Rind, Lamm. Schwein läuft über `eats_pork`. Gruppentext `gluten` lautete „Glutenhaltiges Getreide (Weizen, Roggen, Gerste)“ – in N2a um Dinkel und Hafer ergänzt (S5, nur Text, Gruppenname unverändert).
- Körperdaten `body_metrics` (Größe, Gewicht, optional Körperfett; Zeilen mit nur **einem** Wert erlaubt, `num_nonnulls ≥ 1`; nur mit `health_data`), Grenzen `BODY_METRIC_LIMITS` (Gewicht 30–300 kg, Größe 100–250 cm, Körperfett 3–60 %). Geschlecht `male|female|diverse|unspecified` – Phase-1-Frage 9: bei divers/keine Angabe nimmt die Formel den **Mittelwert**.
- Gesundheits-Check: Flags `medical_clearance_recommended`, `pregnancy` (Frage: „schwanger **oder** in den letzten 6 Monaten ein Kind geboren“ – inkl. Stillzeit-Zeitraum, ohne eigene Stillfrage, **ohne Ablaufdatum**), `injury`, `medication`, `conservative_plan`. Beim Training gilt **kein Check = vorsichtig** (`packages/core/src/plan/safety.ts`: `noHealthCheck → cautious`).
- Schutzgrenzen schon in `constants.ts`: `MAX_CALORIE_DEFICIT_FRACTION = 0.25`, `MIN_INTAKE_RELATIVE_TO_BMR = 1.0`, `MAX_WEEKLY_WEIGHT_LOSS_FRACTION = 0.01` (mit Quellen), `NUTRITION_LIMITS`.
- Geplante Einheiten (`planned_sessions` / `GeneratedSession`): `scheduled_on`, `kind` `strength|endurance`, `endurance_modality` `run|walk|bike|swim`, **`effort_target` 1–4** (CHECK in `…20261005130100_plan_session_kinds.sql`; Phase 3 plant nur locker, `ENDURANCE_EFFORT.easyMin/easyMax = 3/4`), `estimated_minutes`, `is_deload`, `status` `planned|skipped|completed`. Seit `completed` existiert, kann ein Tag erledigte Einheiten eines **ersetzten** Plans und geplante Einheiten des neuen Plans haben (Index `planned_sessions_one_per_day_idx` entfernt, `…120100_training_logs.sql`). Eine **Uhrzeit des Trainings gibt es nicht**.
- Content: Repository als einzige Wahrheit (`content/<art>/<id>.json`), Prüfung `pnpm content:validate` (rote Befunde blockieren laut KONZEPT 3 **nur freigegebene** Inhalte), `meta.origin`/`expert_reviewed`, `needsExpertReviewLabel()`, Textregeln Ü6 (`packages/core/src/content/text-rules.ts`: keine Heilversprechen, keine Marken). `seed_content()` nur `service_role`. Pipeline-Arten austauschbar (`packages/content/src/pipeline/kinds`). Die App bündelt Inhalte per `scripts/bundle-content.mjs` – das Skript **bündelt nur die Dateien** (Ordnerliste `FOLDERS`, gespiegelt aus `CONTENT_FOLDERS` in `packages/content/src/validate.ts`). **Geprüft und ausgewählt wird in der App:** `apps/mobile/src/data/local-backend.ts:111` ruft `selectPlanContent(validateContent(files), { allowDrafts: true })` auf (Korrektur R2-S6). Für Ernährung kommt analog `selectNutritionContent` dazu (5.3). **Im Testmodus sind Entwürfe erlaubt und gekennzeichnet** (KONZEPT 4).
- Admin-Bereich `apps/web/src/app/admin` mit `uebungen` und `vorlagen` (nur ansehen/prüfen).
- PDF: `packages/core/src/export/document.ts` (`PrintDocumentKind = 'training_plan'`), Renderer `packages/ui/src/print/render-html.ts`, Web-Route `apps/mobile/src/app/plan/drucken.tsx`, nativ `expo-print`. Regeln B1/B7 (nichts Verräterisches, sicheres HTML).
- Testmodus: `apps/mobile/src/data/local-backend.ts`, `write-ops.ts` (`applyHealthDataRevocation`), `data-export.ts`, „Testdaten löschen“.
- `packages/core/src/db-sync.test.ts` vergleicht `ONBOARDING_STEPS` mit der CHECK-Liste `onboarding_step in (…)` der Migrationen (Zeile 200–201) und `enums.ts` mit den Postgres-Enums.
- 4b reserviert `packages/core/src/nutrition/limits.ts` mit `clampCalorieAdjustment()` (Wächter K1). **Da Phase 5 vorher kommt, legt Phase 5 diese Datei an**; 4b nutzt sie dann nur.
- pgTAP 01–19 belegt, 20–22 für 4b reserviert → Phase 5 nutzt 23–26.

---

## 4. Core: `packages/core/src/nutrition/` (reine Funktionen, Tests mit Grenzfällen)

Alle Werte stehen in `constants.ts` (neuer Abschnitt „Phase 5 · Ernährung“), jeweils mit Quelle oder „PRODUKTENTSCHEIDUNG – fachlich zu bestätigen“. Zitate werden **vor N1** gegen das Original geprüft (insbesondere Compendium-Codes S11c und Koletzko 2018 B5).

### 4.1 Dateien

| Datei                          | Inhalt                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `energy.ts`                    | `bmrMifflinStJeor()`, `bmrKatchMcArdle()`, `bmrForNeeds()`, `bmrForFloor()` (B3), `activityFactor()`, `trainingEnergyKcal()` (netto) und `trainingEnergyGrossKcal()` (brutto, nur EA, R2-K2), `sessionsForDay()` (S11a, R2-K3), `estimateFatFreeMass()` (S2), `dailyEnergy()` (→ `Tagesbedarf`) und **`dailyEnergyForLimits()`** (→ `TagesbedarfGrenze`, R2-B1) |
| `body-data.ts`                 | `latestBodyValues()` – neueste Werte **je Feld** mit eigenem Datum (S6)                                                                                                                                                                                                                                                                                         |
| `limits.ts`                    | `applyGoalAdjustment()`, `dayFloorKcal()`, `dayCeilingKcal()`, `planBand()` (B1, R2-S7), `clampCalorieTarget()` (einzige Stelle mit Schutzgrenzen, S10), **`clampCalorieAdjustment()`** (für 4b, nur Schrittweite/Summe des Versatzes, R2-S5), gerichtete Rundung (B2)                                                                                          |
| `eligibility.ts`               | Sonderfälle → Modus `full` / `maintenance_only` / `no_targets` + Deckel + Hinweis-Codes; abgeglichen mit `planSafetyRules` (B4)                                                                                                                                                                                                                                 |
| `macros.ts`                    | Eiweiß je kg (Referenzgewicht bei hohem BMI), Fett-Untergrenze, Kohlenhydrate; Rundungsreihenfolge (B2)                                                                                                                                                                                                                                                         |
| `targets.ts`                   | `nutritionTargetsForWeek(inputs, weekStart, { adjustmentKcal? })` → je Tag kcal, Band, Makros, Trainingsinfo, Hinweise                                                                                                                                                                                                                                          |
| `timing.ts`                    | Mahlzeiten-Slots je `meals_per_day`, Zuordnung vor/nach Training, Hinweis lange Einheit                                                                                                                                                                                                                                                                         |
| `notices.ts`                   | feste Hinweis-Codes (Texte in `apps/mobile/src/i18n/de.ts`)                                                                                                                                                                                                                                                                                                     |
| `units.ts`                     | Einheiten (g, ml, Stück, EL, TL, Prise), Umrechnung in Gramm, Rundung                                                                                                                                                                                                                                                                                           |
| `recipe-nutrients.ts`          | Nährwerte, Ernährungsform, Allergene, Schwein, Schwangerschafts-Vorsicht eines Rezepts **aus den Zutaten** (inkl. optionaler Zutaten und Ersatzprodukte)                                                                                                                                                                                                        |
| `filter.ts`                    | Rezept passt zu Ernährungsform, Schwein, Unverträglichkeit, Abneigung, Schwangerschaft, Slot; Weglassen optionaler Zutaten (S3), Ersatz mit erneutem Filterdurchlauf (S4)                                                                                                                                                                                       |
| `scale.ts`                     | Portionsskalierung mit Rundung, Nachrechnung und Planband                                                                                                                                                                                                                                                                                                       |
| `meal-plan.ts`, `meal-prep.ts` | Wochen-Essensplan, Kochtage, Ausgleich/Ergänzung, Tauschen                                                                                                                                                                                                                                                                                                      |
| `replan.ts`                    | `needsAutomaticReplan()` – Abgleich bestehender Plan vs. aktueller Modus/Band (S7)                                                                                                                                                                                                                                                                              |
| `shopping-list.ts`             | Aggregation, Abteilungen, Vorrat, Abhak-Schlüssel                                                                                                                                                                                                                                                                                                               |
| `stable-hash.ts`               | FNV-1a zum deterministischen Gleichstand-Auflösen (kein `Math.random`)                                                                                                                                                                                                                                                                                          |
| `schemas.ts`                   | Zod für alle Eingaben und Ausgaben, `mealPlanPayloadSchema`                                                                                                                                                                                                                                                                                                     |
| `index.ts`                     | Exporte                                                                                                                                                                                                                                                                                                                                                         |

Schemas und Prüfregeln für Inhalte liegen wie bisher in `packages/core/src/content/` (`food-schema.ts`, `recipe-schema.ts`, `recipe-checks.ts`, **`allergen-rules.ts`** (B6c)), damit `content:validate` unverändert alle Arten prüft. Der Import aus der Quelldatenbank liegt in `packages/content/src/foods/` (B6a).

### 4.2 Eingaben (`nutritionInputsSchema`, Zod an der Grenze)

`today`, `birthDate` (Profil), `sex`, `goalType`, `experienceLevel`, `discipline`, `healthDataConsent` (gültig?), `bodyMetricsRows` (nur mit Einwilligung), `healthFlags` (neuester Check oder `null` = **kein Check**, B4), `activityLevel`, `trainingTime`, `sessions` (alle Einheiten der Woche aus aktivem **und** ersetzten Plänen, mit `plan_id`, `plan_status`, Datum, kind, modality, effort 1–4, minutes, is_deload, status), `prefs` (diet, pork, meals_per_day, cooking_mode, mealprep_days, mealprep_slots, Abneigungen, Unverträglichkeiten, Vorlieben), optional `adjustmentKcal` (4b, S10).

**Neueste Körperdaten je Feld (S6):** `latestBodyValues(rows)` nimmt Größe, Gewicht und Körperfett **jeweils aus der neuesten Zeile, in der dieses Feld einen Wert hat**, jedes mit eigenem Messdatum. Die 90-Tage-Regel für Körperfett gilt für das **Körperfett-Datum**, der Hinweis „Gewicht älter als 90 Tage“ für das **Gewichts-Datum**. Fehlt Größe oder Gewicht ganz → Modus `no_targets` (4.9).

### 4.3 Grundumsatz (BMR)

- **Mifflin-St Jeor** (Standard):
  `10 × kg + 6,25 × cm − 5 × Jahre + s`, s = **+5** (männlich), **−161** (weiblich), **−78** (divers/keine Angabe = Mittelwert, Phase-1-Frage 9) – **−78 nur für den Vorschlag; für alle Schutzgrenzen rechnet divers/keine Angabe mit +5** (höherer Grundumsatz = sichere Richtung, wie max(Mifflin, Katch); Wächter N1, S1).
  Quelle: Mifflin MD, St Jeor ST et al. (1990), „A new predictive equation for resting energy expenditure in healthy individuals“, Am J Clin Nutr 51(2):241–247. Genauigkeit: Frankenfield D et al. (2005), J Am Diet Assoc 105(5):775–789 – genaueste der gängigen Formeln, bei ca. 80 % der Normalgewichtigen innerhalb ±10 %. Ehrlicher Hinweis in der App: „Schätzung, ±10 % sind normal.“
  **Gültigkeit (K2):** in der Originalstudie 19–78 Jahre. Für 16–18 und über 78 Jahre Hinweis-Code `bmr_estimate_age` („Für dein Alter ist die Formel eine grobe Schätzung.“).
- **Katch-McArdle** (KONZEPT 6), nur wenn Körperfett vorhanden **und** die Körperfett-Messung höchstens `BODY_FAT_MAX_AGE_DAYS = 90` Tage alt ist: `370 + 21,6 × fettfreie Masse (kg)`, fettfreie Masse = kg × (1 − KF/100). Quelle: McArdle WD, Katch FI, Katch VL, „Exercise Physiology“ (Lehrbuch).
- **Welcher BMR wofür (B3):**
  - `bmrForNeeds` = Katch-McArdle, wenn zulässig, sonst Mifflin → Grundlage **nur für den Vorschlag** (`Tagesbedarf`, Zielanpassung 4.5).
  - `bmrForFloor` = **max(Mifflin, Katch-McArdle)** → Grundlage für **alle Schutzgrenzen** (R2-B1): direkt für „nie unter dem Grundumsatz“ und über den **Bedarf für Grenzen** `TagesbedarfGrenze(d)` (4.4) für den 25-%-Deckel, die 1-%-Grenze, die EA-Untergrenze und das Band bei `maintenance_only`. Ein selbst geschätzter hoher Körperfettanteil kann damit **keine** Grenze mehr senken; er kann den Vorschlag nur innerhalb der Grenzen verschieben.
  - Beispiel: Frau, 100 kg, 170 cm, 30 J., KF 50 % → Mifflin 1.751,5, Katch 1.450 (FFM 50 kg) → `bmrForFloor` 1.751,5. Durchgerechnet in 4.6 („Rechenbeispiel R2-B1“).
- Alter aus `birthDate` und **dem jeweiligen Tag** (nicht dem Wochenbeginn), Europe/Berlin, vorhandenes `age.ts`.
- **Rundung (K1):** Alle Zwischenwerte werden **ungerundet** weitergerechnet; gerundet wird nur die Ausgabe, und zwar **gerichtet** (4.6.2).

### 4.4 Gesamtumsatz tagesgenau

`Tagesbedarf(d) = Grundbedarf + Trainingsenergie(d)` mit `Grundbedarf = bmrForNeeds × Alltagsfaktor` → nur für den **Vorschlag** (4.5).

`TagesbedarfGrenze(d) = bmrForFloor × Alltagsfaktor + Trainingsenergie(d)` mit `bmrForFloor = max(Mifflin, Katch-McArdle)` → **Bedarf für Grenzen** (R2-B1), Grundlage aller Untergrenzen (4.6) und des Bands bei `maintenance_only` (4.6.1). Es gilt immer `TagesbedarfGrenze(d) ≥ Tagesbedarf(d)` und `TagesbedarfGrenze(d) ≥ 1,45 × bmrForFloor` – damit ist auch der Randfall „`bmrForFloor` größer als der Tagesbedarf“ (z. B. 300 kg, KF 60 %, sehr groß, jung) ausgeschlossen.

**Alltagsfaktor** (neue Angabe, 8.1) – **ohne Sport**, weil der Sport getrennt gerechnet wird:

| `activity_level` | Beschreibung in der App                                | Faktor |
| ---------------- | ------------------------------------------------------ | ------ |
| `sedentary`      | überwiegend sitzend (Büro, Studium), wenig Wege        | 1,45   |
| `light`          | sitzend mit regelmäßigem Gehen/Stehen                  | 1,65   |
| `active`         | überwiegend stehend/gehend (Verkauf, Pflege, Handwerk) | 1,85   |
| `very_active`    | körperlich schwere Arbeit                              | 2,2    |

Quelle: D-A-CH-Referenzwerte für die Nährstoffzufuhr (DGE, ÖGE, SGE), Kapitel Energie, PAL-Beispiele 1,4–1,5 / 1,6–1,7 / 1,8–1,9 / 2,0–2,4. **Wir nehmen die Mitte der Spanne (S1).** Begründung: Die D-A-CH-PAL-Werte beschreiben bereits eine Lebensweise **ohne anstrengende Freizeitaktivität** – eine Untergrenze „weil Sport separat“ wäre doppelt abgezogen. Für die Schutzgrenzen ist **Unterschätzen** das Risiko (echtes Defizit größer als 25 %), nicht Überschätzen. Die D-A-CH-Sportzulage (+0,3 PAL) ersetzen wir durch die tagesgenaue Trainingsenergie. **Ohne Angabe: 1,45** – Vermerk im Code und in der App „Ohne Angabe schätzen wir deinen Alltag als überwiegend sitzend. Bei aktivem Alltag liegt dein Bedarf höher.“ (nicht „vorsichtig“ nennen). PRODUKTENTSCHEIDUNG, Frage 16 B (d).

**Trainingsenergie (MET-Ansatz, netto):**
`kcal = (MET − 1) × Körpergewicht kg × Stunden`
„− 1“, weil die Ruheenergie im Grundbedarf schon steckt. Quellen: Ainsworth BE et al. (2011), „2011 Compendium of Physical Activities“, Med Sci Sports Exerc 43(8):1575–1581; Herrmann SD et al. (2024), „2024 Adult Compendium of Physical Activities“, J Sport Health Sci 13(1):6–12.

**MET-Zuordnung, lückenlos für `effort_target` 1–4 (S11b):**

| Einheit                                      | `effort_target` 1–2 (sehr locker) | `effort_target` 3–4 (locker) | Ersatzwert (fehlend/unbekannt) |
| -------------------------------------------- | --------------------------------- | ---------------------------- | ------------------------------ |
| Kraft (Studio/Zuhause, kein `effort_target`) | –                                 | 3,5                          | 3,5                            |
| Laufen `run`                                 | 6,0                               | 7,0                          | 7,0                            |
| Gehen `walk`                                 | 3,5                               | 4,3                          | 4,3                            |
| Rad `bike`                                   | 5,5                               | 6,8                          | 6,8                            |
| Schwimmen `swim`                             | 5,0                               | 5,8                          | 5,8                            |
| unbekannte Sportart                          | –                                 | –                            | 7,0                            |

- **Ersatzwert = jeweils der höhere Wert** (mehr Trainingsenergie → höheres Ziel → sicherere Richtung für die Schutzgrenzen).
- **Compendium-Codes (S11c):** Alle Codes werden **vor N1** gegen das Compendium 2024 geprüft und mit Code und Wortlaut in `constants.ts` eingetragen; besonders Rad (02012 vs. 02013 – Ergometer moderat bzw. Wert für draußen) und Gehen (17231 zügig). Die Werte oben sind Startwerte; weichen die Originalwerte ab, gelten die Originalwerte.
- Die frühere Spalte „mittel (5–6)“ entfällt; härtere Ausdauer-Einheiten kommen erst mit Phase 10.
- **Welche Einheiten zählen (S11a), `sessionsForDay(d)`:**
  - **Heute (R2-K3):** alle `completed`-Einheiten **jeder** Planversion (aktiv und ersetzt) plus `planned`-Einheiten des aktiven Plans – so zählt eine heute schon erledigte Einheit des ersetzten Plans weiter, auch wenn der neue Plan heute keine Einheit hat.
  - **Künftige Tage:** nur Einheiten des **aktiven** Plans mit `planned`, mit ihren geplanten Minuten.
  - **Vergangene Tage:** nur `completed`-Einheiten – aus dem aktiven **und** aus ersetzten Plänen.
  - Jede Einheit zählt höchstens einmal (Schlüssel `session_id`); `skipped` zählt 0. Erholungswochen sind über die kürzeren Minuten schon drin.
- Hat ein Tag keine Einheit, ist die Trainingsenergie 0 (Ruhetag).
- **Plausibilitätsdeckel (S11d, R2-S8):** `TRAINING_KCAL_DAY_MAX = 3000` kcal (PRODUKTENTSCHEIDUNG; Beispiel 300 kg × 240 min Laufen wären 7.200 kcal). Weil der Deckel den gerechneten Bedarf senkt, die echte Belastung aber nicht, plant ein Tag mit gegriffenem Deckel **ohne Defizit**: Untergrenze dieses Tages = `TagesbedarfGrenze(d)` (mit gedeckelter Trainingsenergie), Hinweis `training_energy_capped` („An Tagen mit sehr viel Training planen wir ohne Defizit.“). Die EA-Untergrenze rechnet an solchen Tagen mit dem ungedeckelten Brutto-Wert (R2-K2), wird aber wie immer durch `TagesbedarfGrenze(d)` nach oben begrenzt.
- **Trainingsenergie für die EA-Untergrenze (R2-K2):** Loucks definiert die Trainingsenergie (EEE) brutto. In der EA-Formel (4.6 Nr. 4) gilt deshalb `EEE = MET × kg × h` (brutto, höhere EA-Untergrenze = vorsichtiger); überall sonst netto. Beim Zitat-Check vor N1 bestätigen.

### 4.5 Zielanpassung je Ziel (Startwerte, PRODUKTENTSCHEIDUNG – fachlich prüfen)

**Die Anpassung wird vom Grundbedarf ohne Trainingsenergie berechnet (S2); die Trainingsenergie kommt voll obendrauf:**
`Vorschlag(d) = Grundbedarf × (1 + Anpassung) + Trainingsenergie(d) + adjustmentKcal (4b)`

So wird das absolute Defizit an langen Trainingstagen nicht größer (Energieverfügbarkeit). Prozentual zum Tagesbedarf ist es dadurch an Trainingstagen sogar kleiner – die Grenze „max. 25 % unter Gesamtumsatz“ (CLAUDE.md) wird zusätzlich gegen den vollen **Bedarf für Grenzen** `TagesbedarfGrenze(d)` geprüft (4.6, R2-B1).

| Ziel              | Anpassung                                             | Quelle/Orientierung                                                     |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `fat_loss`        | −20 %                                                 | Helms ER et al. (2014), J Int Soc Sports Nutr 11:20 (moderate Defizite) |
| `definition`      | −10 %                                                 | wie oben, kleiner Schritt zum Muskelerhalt                              |
| `muscle_gain`     | +10 % Einsteiger, +5 % Fortgeschritten/Leistungssport | Iraki J et al. (2019), Sports 7(7):154                                  |
| `general_fitness` | 0 %                                                   | Erhalt                                                                  |
| `endurance`       | 0 %                                                   | Erhalt; Kohlenhydrate nach Trainingslast (4.7)                          |

**Seit Ziele Z1/Z2 (`docs/PLAN-ZIELE.md` 2.4, 4.4, 4.5):** Die Anpassung kommt aus dem **Ziel-Profil** (`goalProfile`,
Haupt- + Nebenziel, `GOAL_PAIR_RULES`); für Einzelziele gelten genau die Werte dieser Tabelle (Invarianten-Test). Die
Energie-Richtung (Defizit/Erhalt/Überschuss) folgt aus dem Vorzeichen. Ein konkretes Abnehmziel kann die Anpassung nur
Richtung 0 verschieben (F5), danach gilt unverändert 4.6. Neues/geändertes/erreichtes/abgelaufenes/entferntes Ziel →
automatische Neuplanung ab heute (6.6, Grund `weight_goal_changed`, Etappe Z5).

### 4.6 Schutzgrenzen (`limits.ts`, nicht abschaltbar)

`clampCalorieTarget(proposed, ctx)` ist die **einzige Stelle mit Schutzgrenzen** (S10, R2-S5). Sie läuft bei jeder Berechnung neu – auch wenn sich Gewicht, Flags oder Alter ändern, und auch für 4b-Anpassungen (der Versatz ist Teil von `proposed`).

**Alle Untergrenzen rechnen mit dem Bedarf für Grenzen** `TagesbedarfGrenze(d)` (4.4, R2-B1), nie mit dem Katch-basierten `Tagesbedarf(d)`.

**Untergrenze je Tag** `dayFloorKcal(d)` = Maximum aus:

1. `bmrForFloor × MIN_INTAKE_RELATIVE_TO_BMR` (nie unter dem Grundumsatz; B3: max(Mifflin, Katch)).
2. `TagesbedarfGrenze(d) × (1 − Defizitdeckel)` mit Defizitdeckel = min(`MAX_CALORIE_DEFICIT_FRACTION` 25 %, Sonderfall-Deckel aus 4.9); bei `maintenance_only` **und an Tagen mit `training_energy_capped` (R2-S8)** ist der Defizitdeckel 0.
3. `TagesbedarfGrenze(d) − MAX_WEEKLY_WEIGHT_LOSS_FRACTION × kg × KCAL_PER_KG_BODY_WEIGHT / 7` (≈ 1 % Körpergewicht/Woche). `KCAL_PER_KG_BODY_WEIGHT = 7700` als Planungswert (Wishnofsky M (1958), Am J Clin Nutr 6(5):542–546; Einschränkung: Hall KD (2008), Int J Obes 32(3):573–576). Für einen **Deckel** geeignet, für Prognosen nicht – deshalb **keine** „Du verlierst X kg“-Vorhersage. Präzisiert durch Gründer-Entscheidung F7 (13.10.2026, siehe 4.9): Bei einem konkreten Abnehmziel nutzt die Ampel 7.700 kcal/kg nur für eine **Planungsdauer** („Sicher planbar sind etwa N Wochen“, ohne Kalenderdatum), nie für eine Gewichtsvorhersage (`docs/PLAN-ZIELE.md` Abschnitt 3).
4. **Energieverfügbarkeit (S2):** `min(TagesbedarfGrenze(d), EA_MIN × FFM + EEE_brutto(d))` (R2-B1; brutto = `MET × kg × h`, R2-K2) mit `EA_MIN_KCAL_PER_KG_FFM = 30`. Quellen: Loucks AB, Kiens B, Wright HH (2011), J Sports Sci 29 Suppl 1:S7–S15; Mountjoy M et al. (2023), IOC-Konsens REDs, Br J Sports Med 57(17):1073–1097. **FFM** = max(gemessene FFM aus Körperfett ≤ 90 Tage, Schätzung nach Janmahasatian S et al. (2005), Clin Pharmacokinet 44(10):1051–1065; divers/keine Angabe = Formel für Männer (höhere FFM, Wächter N1, S1)) – höhere FFM = vorsichtigere Untergrenze. Das `min(TagesbedarfGrenze, …)` sorgt dafür, dass die EA-Regel nur das Defizit begrenzt und nie einen Überschuss erzwingt. Greift sie, Hinweis `energy_availability_cap` („An Tagen mit viel Training planen wir ein kleineres Defizit, damit dein Körper genug Energie hat.“). Zitat und Formel vor N1 gegen das Original prüfen.

**Obergrenze je Tag** `dayCeilingKcal(d)` – gilt in **jedem** Modus und für jedes Ziel (N0-Gegenprüfung H3), damit auch ein positiver 4b-Versatz keinen Überschussdeckel umgeht:

- bei Überschuss (`muscle_gain`, auch bei Sonderfällen mit Überschussdeckel): `max(dayFloorKcal(d), Tagesbedarf(d) + min(Überschussdeckel × Grundbedarf, MAX_WEEKLY_WEIGHT_GAIN_FRACTION (0,5 %) × kg × 7700 / 7))`,
- bei allen anderen Zielen und Modi (`fat_loss`, `definition`, `general_fitness`, `endurance`, `maintenance_only`): `max(dayFloorKcal(d), TagesbedarfGrenze(d) × (1 + surplusCap))`.

**`surplusCap` (H2):** kommt aus `eligibility()` und ist **immer gesetzt**: Standard `SURPLUS_CAP_DEFAULT = 0,10` (= `PORTION_TOLERANCE`; PRODUKTENTSCHEIDUNG – Iraki 2019 nennt 0,25–0,5 % KG/Woche, keinen Prozent-Deckel; 10 % ist ein eigener vorsichtiger Wert, vor Livegang fachlich prüfen, Wächter N1 K4), Sonderfälle (unter 18, kein Gesundheits-Check) `SURPLUS_CAP_SPECIAL = 0,05`; bei mehreren Fällen gewinnt der **kleinste** Wert (sichere Richtung). Der Zod-Typ erzwingt `surplusCap ∈ [0,05; 0,10]` – nie 0 und nie undefiniert, damit das Band bei `maintenance_only` nie zu einem Punkt wird. Test W26.

Quelle der Überschuss-Formel: Iraki 2019 (0,25–0,5 %/Woche). PRODUKTENTSCHEIDUNG. Das äußere `max` sorgt dafür, dass die Obergrenze nie unter einer Untergrenze liegt (z. B. `maintenance_only` bei Frau ohne Check mit `muscle_gain` und niedrigem Katch-Wert) – **die Untergrenze gewinnt immer**.

**Reihenfolge:** Vorschlag (4.5, inkl. 4b-Versatz) → auf [Untergrenze, Obergrenze] begrenzen (beide in jedem Modus) → gerichtet runden (4.6.2). Die **strengste Grenze gewinnt**; die greifenden Grenzen werden als Codes zurückgegeben (`deficit_cap`, `weekly_loss_cap`, `bmr_floor`, `energy_availability_cap`, `gain_cap`, `special_case_cap`) und in der App in einfachen Worten erklärt.

- **`clampCalorieAdjustment(currentOffsetKcal, proposedOffsetKcal)` für 4b (R2-S5):** begrenzt **nur** die Schrittweite (`ADJUSTMENT_STEP_MAX_KCAL = 150`) und die Summe des Versatzes (`ADJUSTMENT_OFFSET_MAX_KCAL = 1000`). **Beide Konstanten kommen schon in N1** in `constants.ts` (PRODUKTENTSCHEIDUNG, H3), damit die Funktion ab N1 vollständig testbar ist. 4b legt später `LIVE_ADJUSTMENT.calorieStepKcal` (100–150 kcal) fest; ein Test in 4b stellt sicher, dass `calorieStepKcal ≤ ADJUSTMENT_STEP_MAX_KCAL`. Sie kennt **keine** Schutzgrenzen und braucht keinen Kontext (kein `tdee`, `bmr`, `flags`). **Alle Schutzgrenzen gelten ausschließlich** in `nutritionTargetsForWeek` → `clampCalorieTarget`, je Tag mit vollem Kontext. **4b speichert keine Ziele:** Eine 4b-Anpassung fließt als `adjustmentKcal` in `nutritionTargetsForWeek` und wird bei jeder Berechnung neu begrenzt (S10). Die Liste „Grenzen“ in PLAN-PHASE-4B 5.2 wird in N0 entsprechend umformuliert.
- **Keine Einstellung, kein Parameter und kein Testschalter** kann die Grenzen lockern.

**Rechenbeispiel R2-B1** (Frau, 100 kg, 170 cm, 30 J., KF 50 % aus Messung ≤ 90 Tage, sitzend 1,45, Ruhetag, `fat_loss`, Gesundheits-Check ohne Auffälligkeiten) – wird **wörtlich als Test** übernommen (W17):

| Größe                         | Rechnung                                                                                                   | Wert                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Mifflin                       | 10 × 100 + 6,25 × 170 − 5 × 30 − 161                                                                       | 1.751,5                          |
| Katch-McArdle                 | FFM = 100 × 0,5 = 50 kg → 370 + 21,6 × 50                                                                  | 1.450                            |
| `bmrForFloor`                 | max(1.751,5; 1.450)                                                                                        | 1.751,5                          |
| `Tagesbedarf` (nur Vorschlag) | 1.450 × 1,45 + 0                                                                                           | 2.102,5                          |
| `TagesbedarfGrenze`           | 1.751,5 × 1,45 + 0                                                                                         | 2.539,675                        |
| Vorschlag (4.5)               | 2.102,5 × (1 − 0,20)                                                                                       | 1.682                            |
| Untergrenze 1 (BMR)           | 1.751,5 × 1,0                                                                                              | 1.751,5                          |
| Untergrenze 2 (25 %)          | 2.539,675 × 0,75                                                                                           | **1.904,756**                    |
| Untergrenze 3 (1 %/Woche)     | 2.539,675 − 0,01 × 100 × 7.700 / 7 = 2.539,675 − 1.100                                                     | 1.439,675                        |
| Untergrenze 4 (EA)            | FFM = max(50; Janmahasatian 9.270 × 100 / (8.780 + 244 × 34,602) = 53,82) → min(2.539,675; 30 × 53,82 + 0) | 1.614,7                          |
| `dayFloorKcal`                | Maximum → greift `deficit_cap`                                                                             | 1.904,756                        |
| Ziel                          | 1.682 → begrenzt auf 1.904,756 → `round10` = 1.900 < Untergrenze → `ceil10`                                | **1.910 kcal**                   |
| Prüfung                       | 1.910 / 2.539,675 = 0,752 → **24,8 % unter** dem Mifflin-Gesamtumsatz (vorher 1.760 = 30,7 %)              | ≤ 25 % ✓                         |
| Planband (4.6.1)              | [max(1.904,756; 0,9 × 1.910 = 1.719); min(1,1 × 1.910 = 2.101; 2.539,675 × 1,10)]                          | [1.904,76; 2.101], Mitte ≈ 2.003 |

Das Beispiel zeigt die gewollte Wirkung: Katch-McArdle darf das Ziel gegenüber einem reinen Mifflin-Ziel (2.539,675 × 0,8 = 2.031,7 → Untergrenze 1.904,756 greift nicht) **senken**, aber nie unter eine Grenze, die mit `bmrForFloor` gerechnet ist.

#### 4.6.1 Planband (B1) – Grenzen gelten für den ausgelieferten Essensplan

Die Grenzen gelten nicht nur für die Zielzahl, sondern für die **Tagessumme des tatsächlich ausgelieferten Essensplans**:

`Planband(d) = [ max(Untergrenze(d), Ziel(d) × 0,90) ; min(Ziel(d) × 1,10, BandObergrenze(d)) ]`

mit `BandObergrenze(d) = dayCeilingKcal(d)` in **jedem** Modus (4.6, H3); ohne Überschuss ist das `max(Untergrenze(d), TagesbedarfGrenze(d) × (1 + surplusCap))` mit `surplusCap ∈ [0,05; 0,10]` (R2-S7, H2: der Überschussdeckel aus 4.9, z. B. +5 % unter 18 oder ohne Check, gilt auch für das Band).

- Die Toleranz nach unten (−10 %, `PORTION_TOLERANCE`) wird also **durch die Schutzgrenzen begrenzt**. Beispiel aus dem Wächter-Bericht: Ziel = 1,05 × BMR (25-%-Deckel bei Faktor 1,4) → Band beginnt bei 1,05 × BMR, nicht bei 0,945 × BMR.
- **Bei `maintenance_only` (R2-S7):** Ziel = `TagesbedarfGrenze(d)` (Defizitdeckel 0, 4.6 Nr. 2), Band = `[max(dayFloorKcal(d), TagesbedarfGrenze(d)) ; TagesbedarfGrenze(d) × (1 + min(0,10; surplusCap))]` – kein Defizit, auch nicht über die Toleranz, und nie mehr Überschuss als der Sonderfall erlaubt (unter 18 bzw. ohne Check: höchstens +5 %). Dasselbe Band gilt an Tagen mit `training_energy_capped` (R2-S8).
- Das Band ist nie leer – auch mit 4b-Versatz ±1.000 kcal (Eigenschaftstest W27): Ziel(d) ∈ [Untergrenze, Obergrenze] in jedem Modus (4.6.2 rundet nur innerhalb dieses Bereichs), jede Obergrenze ist per `max(Untergrenze, …)` mindestens so hoch wie die Untergrenze, und bei `maintenance_only` liegt die Obergrenze mindestens `min(0,10; surplusCap) × TagesbedarfGrenze` darüber (surplusCap ≥ 0,05).
- Der Essensplan **zielt auf die Bandmitte**, nicht auf den Bandrand (6.2).

#### 4.6.2 Gerichtete Rundung (B2)

- Ergebnis-kcal werden auf 10 gerundet, aber **nie aus dem erlaubten Bereich heraus**: `r = round10(x)`; ist `r < Untergrenze` (ungerundet) → `ceil10(x)`; ist `r > Obergrenze` (ungerundet) → `floor10(x)`. Sicherheit geht vor: Liegen Unter- und Obergrenze innerhalb von 10 kcal, gilt `ceil10` der Untergrenze.
- Beispiel: BMR 1.101,5, Ziel genau BMR → **1.110** (nicht 1.100).
- Der Test vergleicht immer die **gerundete Zahl gegen die ungerundete Grenze**.
- Untergrenzen des Planbands werden ungerundet verwendet; angezeigt wird das Band nicht (nur das gerundete Ziel).

### 4.7 Makros (`macros.ts`)

- **Eiweiß** g/kg je Ziel: `fat_loss` 2,0 · `definition` 2,2 · `muscle_gain` 1,8 · `general_fitness` 1,4 · `endurance` 1,4. Obergrenze 2,2 g/kg.
  Quellen: Morton RW et al. (2018), Br J Sports Med 52(6):376–384; Jäger R et al. (2017), ISSN Position Stand, J Int Soc Sports Nutr 14:20; Thomas DT, Erdman KA, Burke LM (2016), ACSM/AND/DC Joint Position Statement, Med Sci Sports Exerc 48(3):543–568.
- **Zwei Ziele (`docs/PLAN-ZIELE.md` 4.4):** Eiweiß und Kohlenhydrat-Regel kommen aus dem Ziel-Profil
  (`goalProteinGPerKg`, `goalUsesEnduranceCarbs`); Einzelziele unverändert. Ein konkretes Abnehmziel ändert das Eiweiß nicht.
- **Referenzgewicht bei BMI ≥ 30:** Eiweiß rechnet mit dem Gewicht bei BMI 25 für die Größe. PRODUKTENTSCHEIDUNG.
- **Ab 65 (S16):** 1,2–1,6 g/kg. Quelle: Bauer J et al. (2013), PROT-AGE, J Am Med Dir Assoc 14(8):542–559 (Gesunde 1,0–1,2, Aktive 1,2–1,5 g/kg; wir planen für Trainierende ab 1,2, gedeckelt bei 1,6 wegen Nierenfunktion im Alter – PRODUKTENTSCHEIDUNG).
- **Unter 18, `medication`, `medical_clearance_recommended`, kein Gesundheits-Check (S16, B4):** Eiweiß höchstens 1,6 g/kg (PRODUKTENTSCHEIDUNG, vorsichtig).
- **Nierenhinweis (S16):** Liegt das Eiweiß-Ziel über 1,6 g/kg, fester Hinweis `protein_kidney_notice`: „Bei einer Nierenerkrankung stimme die Eiweißmenge bitte ärztlich ab.“ (Der Gesundheits-Check fragt nicht nach den Nieren.)
- **Fett:** Standard 25 % der Energie, **mindestens 20 %**. Quelle: Thomas 2016 (20–35 %); D-A-CH-Referenzwerte (Richtwert 30 %).
- **Kohlenhydrate:** der Rest. **Ausdauer:** Richtwert nach Trainingsminuten des Tages – < 60 min: 3–5 g/kg, 60–120 min: 5–7 g/kg, > 120 min: 6–10 g/kg (Thomas 2016; Burke LM et al. (2011), J Sports Sci 29 Suppl 1:S17–S27). Reicht der Rest nicht, wird Fett bis zur Untergrenze gesenkt; reicht es dann noch nicht, Hinweis. **Die Energie bleibt verbindlich** – Kohlenhydrate erhöhen nie das Kalorienziel über die Schutzgrenzen.
- Richtwert Kohlenhydrate mindestens 130 g/Tag (IOM, Dietary Reference Intakes 2005). Wird er unterschritten: Fett bis 20 %, dann Eiweiß bis 1,6 g/kg senken; reicht das nicht, bleibt es beim Rest und es gibt nur den Hinweis `carbs_below_reference` (R2-K1). (K3: In Schwangerschaft/Stillzeit wären es 175/210 g – nur relevant, falls dort später doch Ziele kommen; derzeit `no_targets`.)
- **Rundungsreihenfolge (B2):**
  1. Eiweiß auf 5 g – gerichtet: bei aktiver Untergrenze (z. B. ≥ 1,2 g/kg ab 65) `ceil`, bei aktiver Obergrenze (≤ 1,6 bzw. 2,2 g/kg) `floor`, sonst kaufmännisch.
  2. Fett auf 5 g – gerichtet: nie unter 20 % der **gerundeten** kcal (`ceil`).
  3. Kohlenhydrate = (gerundete kcal − 4 × Eiweiß − 9 × Fett) / 4, dann auf 5 g kaufmännisch – **immer der gerundete Rest** (R2-K1). Die Energie ist verbindlich; die 130 g werden nie per `ceil` erzwungen. Liegt der Rest unter 130 g (nach der Absenkungsreihenfolge oben), gibt es nur den Hinweis `carbs_below_reference`.
  - Test: |4·E + 4·KH + 9·F − kcal| **≤ 10 kcal** (statt ±2 %, das bei ~1.100 kcal mit 5-g-Schritten nicht erfüllbar wäre) – durch die Rest-Regel immer erfüllbar (Rundungsfehler höchstens 4 × 2,5 g = 10 kcal); Untergrenzen Eiweiß/Fett nach dem Runden eingehalten.

### 4.8 Mahlzeiten-Timing (`timing.ts`)

- **Slot-Layouts** je `meals_per_day` (`MEAL_SLOT_LAYOUTS`): 1 = Hauptmahlzeit · 2 = Mittag, Abend · 3 = Frühstück, Mittag, Abend · 4 = + Snack nachmittags · 5 = + Snack vormittags · 6–8 = weitere Snacks. Standard-Uhrzeiten zur Zuordnung: Frühstück 7:30, Snack 10:00, Mittag 12:30, Snack 15:30, Abend 18:30, Spät-Snack 20:30. Energieanteile z. B. 25/35/30/10 % (PRODUKTENTSCHEIDUNG).
- **Trainingszeit** (neue Angabe `training_time`: `early` < 8 Uhr, `morning`, `midday`, `afternoon`, `evening`, `varies`):
  - die Mahlzeit **2–3 h vorher** = „vor dem Training“, ein Snack **30–60 min vorher** (falls vorhanden) = „kleiner Snack vorher“,
  - die nächste Mahlzeit **innerhalb 1–2 h danach** = „nach dem Training“ (Eiweiß ≥ 0,4 g/kg + Kohlenhydrate). Quellen: KONZEPT 6; Kerksick CM et al. (2017), ISSN Position Stand Nutrient Timing, J Int Soc Sports Nutr 14:33; Schoenfeld BJ, Aragon AA (2018), J Int Soc Sports Nutr 15:10.
  - An Trainingstagen bekommen die Mahlzeiten vor und nach dem Training je +5 % Energieanteil, die anderen entsprechend weniger (PRODUKTENTSCHEIDUNG).
  - **Frühtraining:** „Kleiner, leicht verdaulicher Snack oder locker ohne Frühstück – das Frühstück danach ist deine Mahlzeit nach dem Training.“
  - `varies` oder keine Angabe: nur allgemeine Hinweise, keine Zuordnung.
- **Lange Einheiten** (Ausdauer ≥ 90 min): Hinweis-Code `long_session_fueling` („Bei langen Einheiten etwa 30–60 g Kohlenhydrate pro Stunde, z. B. Banane, und regelmäßig trinken.“). Quelle: Thomas 2016; Jeukendrup A (2014), Sports Med 44 Suppl 1:S25–S33.

### 4.9 Sonderfälle (`eligibility.ts`) – strengste Regel gewinnt

Seit Ziele Z1 gelten die Sonderfälle für die **Energie-Richtung des Ziel-Profils** (statt `DEFICIT_GOALS`), also auch für
Kombinationen mit Abnehmen oder Definition (`docs/PLAN-ZIELE.md` 4.4). Ein konkretes Abnehmziel ruht bei
`maintenance_only`/`no_targets` (z. B. Schwangerschaft, unter 18) und lockert keine Grenze.

| Fall                                                                                                                 | Regel                                                                                                                                                                                                                                                                                                                                                                                                                     | Hinweis (fester Text, keine Diagnose)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keine Einwilligung `health_data`** oder **keine Größe/kein Gewicht**                                               | Modus `no_targets`: kein Kalorienziel, keine Makro-Gramm. Essensplan mit **Standardportionen** (6.2, S15), Nährwerte je Rezept sichtbar.                                                                                                                                                                                                                                                                                  | „Mit Größe und Gewicht passen wir die Portionen an dich an.“ + Knopf zur Einwilligung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Körperdaten vorhanden, aber kein Gesundheits-Check** (B4; z. B. Testkonto, Abbruch, neue Fassung der Einwilligung) | wie beim Training **vorsichtig** (`planSafetyRules`: `noHealthCheck → cautious`): Defizit ≤ 15 %, Überschuss ≤ 5 %, Eiweiß ≤ 1,6 g/kg. **Bei Geschlecht ≠ männlich zusätzlich** `maintenance_only` und Ausschluss `pregnancy_caution`, bis der Check gemacht ist (Schwangerschaft nicht ausgeschlossen).                                                                                                                  | „Mach bitte den kurzen Gesundheits-Check – dann können wir deinen Plan genauer an dich anpassen.“ + Knopf                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Gewicht älter als 90 Tage (Gewichts-Datum, S6)                                                                       | rechnet weiter, Hinweis                                                                                                                                                                                                                                                                                                                                                                                                   | „Dein Gewicht ist älter als 3 Monate – kurz aktualisieren?“                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Schwangerschaft/Stillzeit** (Flag `pregnancy`) (B5)                                                                | Modus **`no_targets`**: kein Kalorienziel, keine Makro-Gramm, Standardportionen mit Mindestportion (S15). Rezepte mit `pregnancy_caution` (roher Fisch, rohes Ei, Rohmilchkäse, Leber, …) werden ausgeschlossen. Grund: Der Bedarf steigt laut D-A-CH im 2. Trimester um ca. +250 kcal, im 3. Trimester und in der Stillzeit um ca. +500 kcal/Tag – „Erhalt“ ohne Zuschläge wäre ein verdecktes Defizit von bis zu ~20 %. | „In Schwangerschaft und Stillzeit ändert sich dein Bedarf laufend. Wir zeigen dir deshalb keine Kalorienzahl. Bitte stimme deine Ernährung mit deiner Ärztin, deinem Arzt oder deiner Hebamme ab.“ Zusätzlich dauerhaft in „Ernährung“: „Hat sich etwas geändert (z. B. Schwangerschaft, Stillzeit vorbei)? Gesundheits-Check aktualisieren.“ Koffein-Hinweis (BfR: höchstens 200 mg/Tag) → Frage 16 B (m), R2-K9. Quellen: Koletzko B et al. (2018), Netzwerk Gesund ins Leben, Handlungsempfehlungen Ernährung in der Schwangerschaft – **vollständiges Zitat (Heft, Seiten) vor N1 eintragen**; D-A-CH-Referenzwerte Energie (Zuschläge); BfR-Hinweise zu Listerien/Toxoplasmen. |
| **Unter 18** (Gründer-Entscheidung 2)                                                                                | `maintenance_only` bei Fettverlust/Definition (Wachstum); Überschuss höchstens +5 %; Eiweiß ≤ 1,6 g/kg; **keine BMI-Erwachsenengrenzen** (für Jugendliche gelten Perzentilen). Gilt **ab dem Tag** des 18. Geburtstags nicht mehr (tagesgenau, nicht ab Wochenbeginn).                                                                                                                                                    | „Im Wachstum ist eine Diät nicht sinnvoll. Wir planen ausgewogen ohne Kaloriendefizit.“                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Untergewicht** BMI < 18,5 (Erwachsene)                                                                             | `maintenance_only` bei Fettverlust/Definition                                                                                                                                                                                                                                                                                                                                                                             | „Dein BMI liegt unter 18,5. Wir planen ohne Defizit. Lass das bitte ärztlich abklären.“ Quelle: WHO-BMI-Klassifikation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BMI < 17                                                                                                             | wie Untergewicht, deutlicher Hinweis + Hilfe-Kontakte                                                                                                                                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| BMI 18,5 bis < 20                                                                                                    | Defizit höchstens 10 %                                                                                                                                                                                                                                                                                                                                                                                                    | – (PRODUKTENTSCHEIDUNG)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Flags `medication` oder `medical_clearance_recommended`                                                              | Defizit höchstens 15 %, Eiweiß ≤ 1,6 g/kg (S16)                                                                                                                                                                                                                                                                                                                                                                           | „Nimmst du Medikamente (z. B. bei Diabetes), sprich Änderungen deiner Ernährung bitte vorher ärztlich ab.“ (PRODUKTENTSCHEIDUNG)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Ab 65 (ab dem Geburtstag, tagesgenau)                                                                                | Defizit höchstens 15 %, Eiweiß 1,2–1,6 g/kg                                                                                                                                                                                                                                                                                                                                                                               | (Muskelerhalt, Bauer 2013)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Essstörungen** (Gründer-Entscheidung 3)                                                                            | **keine Abfrage**. Für alle: fester Hinweis bei der Einrichtung und in den Einstellungen, Schalter **„Kalorienzahlen ausblenden“**, keine Gewichts-Prognosen, keine Serien/Abzeichen fürs Essen, keine Fasten- oder Abnehm-Challenges (KONZEPT 11.3).                                                                                                                                                                     | „Wenn Essen oder Gewicht dich stark belasten, hol dir Unterstützung.“ + Beratung DE (BZgA/BIÖG), AT, CH – **Nummern vor Veröffentlichung prüfen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

- `eligibility()` gibt `{ mode, deficitCap, surplusCap, proteinMin, proteinCap, recipeExclusions, notices[] }` zurück; `surplusCap` ist immer gesetzt (Standard 0,10, Sonderfälle 0,05, kleinster Wert gewinnt, H2). Tests je Zeile; für Kombinationen gewinnt immer das Strengste (`no_targets` > `maintenance_only` > kleinster Defizitdeckel). Echtes **Eigenschaftsraster** in 12.2 (W14).
- **Abgleich mit `planSafetyRules` (B4):** Ein gemeinsamer Test stellt sicher, dass „kein Check“, `pregnancy`, `medication`, `medical_clearance_recommended`, unter 18 und ab 65 im Training **und** in der Ernährung vorsichtig behandelt werden.
- **Tagesgenau:** Alter, BMI-Klasse und Flags werden je Tag bestimmt (Geburtstag mitten in der Woche).
- **Präzisierung „keine Gewichts-Prognosen“ (Gründer-Entscheidung F7, 13.10.2026):** Bei einem konkreten Abnehmziel darf die App eine **Planungsdauer** zeigen („Sicher planbar sind etwa N Wochen“), aber keine Gewichtskurve, keinen Countdown, kein Kalenderdatum zur Dauer und kein „Du wiegst am … X kg“. Details: `docs/PLAN-ZIELE.md` Abschnitte 0 und 3; siehe auch 4.6 Nr. 3.
- **Gesundheitsdaten:** Alle Fälle, die Flags oder Körperdaten nutzen, greifen nur mit gültiger `health_data`-Einwilligung (sonst gibt es diese Daten gar nicht).

### 4.10 Ausgabe `nutritionTargetsForWeek()`

Je Tag (Mo–So, ISO-Woche, Europe/Berlin, auch in Wochen mit Sommer-/Winterzeitwechsel und am 29. Februar): `date`, `mode`, `bmr`, `tdee`, `trainingKcal`, `sessions[]`, `targetKcal`, `band { min, max }` (nur intern, 4.6.1), `proteinG`, `carbsG`, `fatG`, `appliedCaps[]`, `slots[]` (Slot, Anteil, Rolle `pre|post|pre_snack|null`), `notices[]`. Dazu `usesHealthData: boolean` (true, sobald Körperdaten, Flags oder Unverträglichkeiten eingeflossen sind – auch im Modus `no_targets` bei Schwangerschafts-Ausschlüssen). **Die Engine speichert nichts** – Ziele werden immer neu gerechnet. Ändert sich das Gewicht, ändert sich das Ziel nach derselben Formel. Das ist keine Live-Anpassung (4b), sondern die Grundberechnung.

---

## 5. Lebensmittel und Rezepte (Inhalte)

### 5.1 Lebensmittel-Katalog `content/foods/<id>.json` (`foodSchema`)

`id`, `version`, `status`, `name_de`, `name_de_plural?`, `aliases_de[]` (z. B. CH „Rahm“, AT „Topfen“), `shopping_category` (5.5), `pantry`, `nutrients_per_100g` { `kcal`, `protein_g`, `carbs_g`, `sugar_g`, `fat_g`, `sat_fat_g`, `fiber_g`, `salt_g` } (seit Import-Lauf 1: `sugar_g`/`sat_fat_g`/`fiber_g` dürfen `null` = „kein Wert in der Quelle“ sein; optional `organic_acids_g`, `alcohol_g`, `polyols_g` nur für R4), `units` { `piece_g?`, `tbsp_g?`, `tsp_g?`, `ml_to_g?` }, `groups: FoodGroupId[]`, **`animal: ('dairy'|'egg'|'honey'|'meat'|'fish'|'shellfish'|'gelatin'|'animal_rennet'|'insect')[]`** (Array, S5; leer = pflanzlich), **`meat_kind: ('pork'|'beef'|'poultry'|'lamb'|'game'|'unknown')[]`** (Speck, Schmalz, Wurst brauchen einen Eintrag), `gelatin_origin?` (`pork|beef|fish|unknown`), `pregnancy_caution`, `alcohol`, **`max_fridge_days`** (S12), `freezable`, `substitutes[]` (je mit `food_id` und `for_groups`), **`source`** { `db`, `version`, `ref`, `license`, `retrieved_at` }, `meta` (inkl. `catalog_reviewed_by`, `catalog_reviewed_at`).

- **Nährwerte kommen nie von der KI** (B6a): Ein Import-Skript `packages/content/src/foods/import-source.ts` liest den Quellauszug `content/sources/<db>/<version>/extract.csv` und schreibt `nutrients_per_100g` und `source.ref` (Quell-ID) maschinell. Die Claude-Sitzung liefert nur die **Zuordnung** Lebensmittel → Quell-ID, Name, Aliase, Abteilung, Einheiten und Gruppen-Vorschläge.
- **Herkunft des Quellauszugs – nur maschinell (R2-B2):** `extract.csv` wird **ausschließlich** vom Workflow **`foods-import.yml`** erzeugt (manuell, „Run workflow“ in der GitHub-App; Eingaben: Quelle, Version). Ablauf:
  1. Die **Original-Datei** der Quelle wird von der **amtlichen Adresse** geladen (URL fest in `packages/content/src/foods/sources.ts`, nur HTTPS).
  2. `content/sources/<db>/<version>/SOURCE.json` erhält `url`, `version`, `retrieved_at`, **`original_sha256`** (SHA-256 der Original-Datei), `original_filename`, **`extract_sha256`** (SHA-256 von `extract.csv`), `workflow_run_id`.
  3. Ein Skript (`extract-source.ts`) filtert die benötigten Quell-IDs (aus den Zuordnungen in `content/foods/`) **Zeile für Zeile, ohne Werte zu verändern** (keine Umrechnung, keine Rundung, Spalten unverändert).
  4. Danach läuft `import-source.ts`; Ergebnis als Pull Request vom Branch `foods-import/<run-id>` (Autor `github-actions[bot]`); der PR-Text nennt URL, Version und beide Prüfsummen. Der Workflow erstellt die Commits **über die GitHub-API** (mit `GITHUB_TOKEN`), damit GitHub sie als **„verified“** kennzeichnet (H1).
  - **URL nur aus der Allowlist (H1):** `sources.ts` ist die Allowlist; jede URL zeigt auf eine **feste, versionierte Datei** der Quelle (nie auf „neueste Fassung“), sonst wird der wöchentliche Prüflauf rot, sobald die Quelle neu veröffentlicht. `SOURCE.json.url` muss exakt einer Allowlist-URL entsprechen.
  - **Original-Datei im Repository?** Nur wenn die Lizenz die Weitergabe der **ganzen** Datei erlaubt (`content/sources/<db>/<version>/original.*`, ggf. per Git LFS); sonst wird sie in CI erneut geladen (Frage 16 B (f)).
  - LICENSE/ATTRIBUTION der Quelle liegen daneben.
- **Quelle und Lizenz (S13, vor N2b zu klären):** eine **Hauptquelle**, keine ungekennzeichnete Mischung. Kandidaten: BLS des Max Rubner-Instituts (seit BLS 4.0 nach Kenntnisstand des Wächters offen nutzbar – Lizenz und Namensnennungspflicht **verifizieren**), Schweizer Nährwertdatenbank des BLV (frei mit Quellenangabe), USDA FoodData Central (CC0, aber US-Lebensmittel; Natrium mg → Salz g × 2,5 / 1000). `source.license` je Lebensmittel; Namensnennung unter „Lizenzen“ und im PDF-Fuß, falls die Lizenz es verlangt. Die Daten landen im Repository und im App-Bundle, werden also **weiterverbreitet**.
- **Zusammengesetzte Produkte** (Brühe, Sojasauce, Senf, Brot, Pesto, Mayonnaise, Fertigteig): Allergene und `animal[]` **vorsichtig** und vollständig (z. B. Pesto → `dairy` + `tree_nuts`, `animal: ['dairy','animal_rennet']`; Brühe → Sellerie).
- **Ersatz-Zutaten (S4):** `for_groups` nennt nur Gruppen, die das Ersatzprodukt **wirklich nicht** enthält. Laktosefreie Milch: `for_groups: ['lactose']` – **nie** `dairy` (Milcheiweiß-Allergie). Haferdrink enthält `gluten` (Hafer), Sojadrink `soy`. Die Prüfregel R18 erzwingt das.
- **Meal-Prep-Haltbarkeit (S12):** `max_fridge_days` je Lebensmittel nach BfR (gekocht im Kühlschrank). Reis (Bacillus cereus), Fisch, Hackfleisch und Geflügel: 1 Tag (PRODUKTENTSCHEIDUNG, beim Umsetzen gegen BfR prüfen), sonst höchstens 3. Die BfR-Aussage wird **wortgenau** mit Fundstelle in `constants.ts` zitiert.

#### 5.1.1 Absicherung des Katalogs (B6)

| Stufe                               | Was                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Wo                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| (a) Import                          | Nährwerte und Quell-ID maschinell aus dem Quellauszug; der Auszug selbst entsteht **nur** im Workflow aus der amtlichen Original-Datei (R2-B2, 5.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `extract-source.ts`, `import-source.ts`, `foods-import.yml` |
| (b) CI-Abgleich                     | **R17:** jede Lebensmittel-Zeile wird gegen den Auszug verglichen (Werte identisch nach Einheitenumrechnung, Quell-ID existiert, Lizenz eingetragen). **Herkunftsprüfung `sources-integrity` (R2-B2):** (1) SHA-256 von `extract.csv` = `SOURCE.json.extract_sha256`; (2) jede Zeile von `extract.csv` ist eine **unveränderte Zeile der Original-Datei**. CI lädt die Original-Datei dafür **immer neu** (auch wenn sie eingecheckt ist), und zwar von der URL aus **`sources.ts` des Basis-Branches `main`** (Allowlist, nie aus dem PR), vergleicht mit `original_sha256` und prüft `SOURCE.json.url` = Allowlist-URL; eine eingecheckte Original-Datei muss dieselbe Prüfsumme haben. Läuft in PRs, die `content/sources/**`, `sources.ts`, `extract-source.ts` oder `import-source.ts` ändern, und wöchentlich (H1); (3) Änderungen unter `content/sources/**` sind nur erlaubt, wenn **jeder** Commit des PRs, der diesen Ordner berührt, von `github-actions[bot]` stammt **und** von GitHub als „verified“ gekennzeichnet ist (Abfrage über die GitHub-API); Branch-Name und Autor allein reichen nicht (H1). Zusätzlich schützen ein **Ruleset** (nur GitHub Actions darf auf `foods-import/*` pushen) und **CODEOWNERS**-Pflichtfreigabe für `content/sources/**`, `sources.ts`, `extract-source.ts` und `import-source.ts` (→ umgedeutet in N2b, Wächter B1: CODEOWNERS nur auf `content/sources/**` und `content/foods/**`; Skripte geschützt durch die Prüfung mit dem Code von `main` und Pflicht-Checks). Jede Abweichung → **rot** (z. B. `extract.csv` von Hand oder per Claude-Sitzung geändert). | `content:validate`, `ci.yml` (Job `sources-integrity`)      |
| (c) Allergen-Pflichtregeln als Code | **R18** (`allergen-rules.ts`): `ALLERGEN_RULES: Record<FoodGroupId, GroupRule>` – **für jede der 23 Gruppen aus `FOOD_GROUPS`** genau ein Eintrag (der Compiler erzwingt Vollständigkeit, R2-B3): Wortregel (Wortteile + Negativliste, R2-S1) und/oder Regel nach **Quell-Lebensmittelgruppe**, oder ausdrücklich `{ kind: 'human_only', reason }`. Dazu Regeln für `animal[]`/`meat_kind[]` (Schwein, Gelatine) und **`pregnancy_caution`** (R2-S2). Vollständige Tabelle in **5.1.3**. Zusätzlich die **Erwartungsliste** `content/foods/allergen-expectations.json` (Gruppen je `food_id`, bei R19 von Menschen bestätigt) – Test gegen alle Lebensmittel. Pflichtgruppen dürfen nicht fehlen (rot); zusätzliche Gruppen erlaubt. Ausnahmen nur über eine eingecheckte Ausnahmeliste mit Begründung.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `packages/core/src/content/allergen-rules.ts` + Tests       |
| (d) Menschliche Prüfung             | **R19:** Jedes Lebensmittel braucht `meta.catalog_reviewed_by/at` nach einer **Checkliste**: Quell-ID passt zum Produkt, Gruppen vollständig (= Erwartungsliste), `animal[]`/`meat_kind[]`, **`pregnancy_caution`** (R2-S2), Ersatzprodukte, `max_fridge_days`, **Salz bei Aufschnitt und verarbeiteter Ware** (Pflicht seit Import-Lauf 1: Quelle ist oft ungesalzenes gegartes Fleisch, Handelsware hat 1,5–2,5 g/100 g – sonst ist R11 zu mild), Zeilen mit Lesart oder 🟡 im Gegencheck. **Gesetzt wird das nur über den Workflow `content-review`** mit neuer Option „Katalog geprüft“ und Merge durch einen Menschen (R2-K6); CI ist rot, wenn ein PR außerhalb dieses Workflows (Branch `content-review/*`, Autor `github-actions[bot]`) `catalog_reviewed_*` setzt oder ändert. Erst danach sind Rezepte mit diesem Lebensmittel nutzbar – **auch im Testmodus**: Die Core-Funktion `selectNutritionContent` lässt sie sonst weg (R2-S6, 5.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Admin `admin/lebensmittel`, `content-review`, `ci.yml`      |

#### 5.1.2 Zuordnungsregeln für Gruppen ohne EU-Definition (S5)

- **Histamin:** Zuordnung nach der SIGHI-Liste (Schweizerische Interessengemeinschaft Histamin-Intoleranz, Lebensmittelliste mit Version/Datum zitieren); Stufe ≥ 2 → `histamine`.
- **Fruktose:** Zuordnung nach Fruktose-Gehalt bzw. Fruktose-Glukose-Verhältnis aus der Quelldatenbank (Schwelle als PRODUKTENTSCHEIDUNG mit Quelle in `constants.ts`); Sorbit wird mitbetrachtet.
- **Zwiebel/Knoblauch, Scharf:** über Name/Alias-Liste (Lauch, Schalotte, Bärlauch, Chili, Cayenne …) in `allergen-rules.ts`.
- **Kokos (K11):** nach LMIV keine Schalenfrucht → **nicht** `tree_nuts`, aber in „Enthält“ ausdrücklich „Kokos“ genannt (Frage 16 B (k)).
- **Hinweis in der App und im PDF:** „Bei hereditärer Fruktoseintoleranz oder Zöliakie können wir keine Garantie geben – prüfe immer die Zutatenliste der gekauften Produkte.“
- **Text `FOOD_GROUPS.gluten`** wird zu „Glutenhaltiges Getreide (Weizen, Dinkel, Roggen, Gerste, Hafer)“ (nur Text; der Gruppenname in der CHECK-Liste bleibt).

#### 5.1.3 R18-Regeltabelle (R2-B3, R2-S1, R2-S2) – IDs exakt wie in `packages/core/src/food-groups.ts`

Geprüft am 10.10.2026 im Repository: `FOOD_GROUPS` hat **23** Gruppen mit den IDs `gluten`, `dairy`, `lactose`, `eggs`, `fish`, `shellfish`, `poultry`, `beef`, `lamb`, `legumes`, `soy`, `peanuts`, `tree_nuts`, `sesame`, `celery`, `mustard`, `lupin`, `sulphites`, `fructose`, `histamine`, `mushrooms`, `onion_garlic`, `spicy`. R18 verwendet **nur** diese IDs (Typ `FoodGroupId`); ein Laufzeit-Test prüft zusätzlich, dass jeder Schlüssel in `FOOD_GROUP_IDS` vorkommt und keiner fehlt.

**Erkennung (R2-S1):**

- Geprüft werden `name_de`, `aliases_de[]` und die Bezeichnung der Quelle, kleingeschrieben, Umlaute normalisiert.
- Ein Pflichtwort trifft nur als **ganzer Wortteil**: eigenes Wort, Anfang oder Ende eines zusammengesetzten Worts bzw. mit Bindestrich (z. B. „Eier“, „Rührei“, „Eiernudeln“, aber **nicht** „Weizen“, „Reis“, „Fleisch“, „Eisbergsalat“). Umgesetzt über eine Wortteil-Liste je Regel, nicht über freie Teilzeichenketten.
- Jede Regel hat eine **Negativliste** (Vorsilben/Wörter, die die Regel aufheben); alles, was danach noch fraglich ist, kommt in die eingecheckte Ausnahmeliste **mit Begründung**.
- Zusätzlich **Quell-Lebensmittelgruppe**: beim BLS die Hauptgruppe aus dem ersten Zeichen des BLS-Schlüssels, bei einer anderen Hauptquelle deren Kategorie (Zuordnungstabelle in `allergen-rules.ts`, Quelle zitiert).

| Gruppe (ID)    | Pflicht-Wortteile (Auszug, vollständig im Code)                                                                                                                                                                                                                                        | Negativliste / Ausnahmen                                                                                                                                                                                            | Quell-Lebensmittelgruppe                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `gluten`       | Weizen, Dinkel, Roggen, Gerste, Hafer, Grünkern, Kamut, Emmer, Einkorn, Bulgur, Couscous, Seitan, Grieß, **Nudeln, Pasta, Spaghetti, Mehl, Brot, Brötchen, Semmel, Weckerl, Paniermehl, Semmelbrösel, Panko, Tortilla, Wrap, Knäckebrot, Zwieback, Malz**, Sojasauce (Weizen, + `soy`) | Reis-, Mais-, Buchweizen-, Hirse-, Kichererbsen-, Mandel-, Kokos-, Kartoffel-, Linsen-, Quinoa- vor „Mehl/Nudeln/Brot“; Maistortilla; „glutenfrei“ nur über Ausnahmeliste mit Quelle                                | Getreide/Getreideprodukte, Brot/Backwaren → Pflicht, begründete Ausnahmen Reis, Mais, Hirse, Buchweizen, Quinoa, Amaranth |
| `dairy`        | Milch, Käse, Quark, Topfen, Joghurt, Butter, Sahne, Rahm, Molke, Kefir, Ghee, Buttermilch, **Mozzarella, Parmesan, Feta, Ricotta, Skyr, Mascarpone, Schmand, Crème fraîche, Frischkäse, Hüttenkäse, Gouda, Emmentaler, Bergkäse**                                                      | Kokos-, Soja-, Hafer-, Mandel-, Reis-, Cashew- vor „Milch/Sahne/Drink/Joghurt“; Erdnuss-, Kakao-, Mandel-, Shea- vor „Butter“; „Butternusskürbis“; **„Leberkäse“, „Fleischkäse“** (Fleischerzeugnis, nicht `dairy`) | Milch und Milchprodukte, Käse → Pflicht                                                                                   |
| `lactose`      | alle Treffer von `dairy`                                                                                                                                                                                                                                                               | „laktosefrei“ (nur mit Quell-Bezeichnung); kein automatischer Wegfall bei Hartkäse (Ausnahmeliste mit Quelle)                                                                                                       | wie `dairy`                                                                                                               |
| `eggs`         | Ei (als Wort), Eier, Eigelb, Eiklar, Vollei, Rührei, Spiegelei, Eiernudeln, Mayonnaise, Baiser                                                                                                                                                                                         | Wortteil-Regel verhindert Weizen, Reis, Fleisch, Eisbergsalat, Eis; **„Eierschwammerl“ (Pfifferling, AT) → nicht `eggs`, sondern `mushrooms`**; „Eiweißpulver“ nur nach Quelle                                      | Eier → Pflicht                                                                                                            |
| `fish`         | Fisch, Lachs, Kabeljau, Dorsch, Seelachs, Thunfisch, Forelle, Hering, Makrele, Sardine, **Sardelle**, Anchovis, Rotbarsch, Zander, Pangasius, Fischsauce, **Worcestersauce**                                                                                                           | **Tintenfisch** → nicht `fish`, sondern `shellfish`                                                                                                                                                                 | Fisch/Fischerzeugnisse → Pflicht                                                                                          |
| `shellfish`    | Garnele, Shrimps, Krabbe, Krebs, Hummer, Languste, Scampi, **Muschel**, Miesmuschel, Jakobsmuschel, Auster, **Tintenfisch**, Kalmar, Calamari, Oktopus, Sepia                                                                                                                          | „Krebs“ nur als Lebensmittel (kein Treffer in Fremdwörtern, Ausnahmeliste)                                                                                                                                          | Krebs- und Weichtiere → Pflicht                                                                                           |
| `poultry`      | Hähnchen, Hendl, Huhn, Hühner-, Poulet, Pute, Truthahn, Ente, Gans, Geflügel, Hühnerbrühe                                                                                                                                                                                              | „Hühnerei“ → `eggs`, nicht `poultry`                                                                                                                                                                                | Geflügel → Pflicht                                                                                                        |
| `beef`         | Rind, Rinder-, Kalb, Kalbs-, Beef, Bresaola, Roastbeef; **Hackfleisch ohne Angabe → `beef` + `meat_kind: ['beef', 'pork']`** (vorsichtig)                                                                                                                                              | –                                                                                                                                                                                                                   | Rind/Kalb → Pflicht                                                                                                       |
| `lamb`         | Lamm, Schaf (Fleisch), Hammel                                                                                                                                                                                                                                                          | **Schafskäse, Schafsmilch, Schafsjoghurt** → `dairy`, nicht `lamb`                                                                                                                                                  | Lamm/Schaf → Pflicht                                                                                                      |
| `legumes`      | Linsen, Bohnen, Kichererbsen, Erbsen, Hummus, Falafel, Kidneybohnen, Mungbohnen                                                                                                                                                                                                        | Kaffeebohne, Kakaobohne, Vanilleschote; Erdnuss (eigene Gruppe `peanuts`), Soja/Lupine zählen zusätzlich (erlaubt)                                                                                                  | Hülsenfrüchte → Pflicht                                                                                                   |
| `soy`          | Soja, Tofu, Tempeh, Miso, Edamame, Sojasauce, Tamari                                                                                                                                                                                                                                   | –                                                                                                                                                                                                                   | Soja-Erzeugnisse → Pflicht                                                                                                |
| `peanuts`      | Erdnuss, Erdnüsse, Erdnussbutter, Erdnussmus                                                                                                                                                                                                                                           | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `tree_nuts`    | Mandel, Haselnuss, Walnuss, Cashew, Pekan, Paranuss, Pistazie, Macadamia (je auch als „-mus/-mehl/-drink“)                                                                                                                                                                             | **kein** freies „Nuss“: Erdnuss, Kokosnuss, Muskatnuss, Butternuss nicht `tree_nuts` (Kokos K11)                                                                                                                    | Nüsse → Pflicht nach Einzelprüfung                                                                                        |
| `sesame`       | Sesam, Tahin, Tahini, Gomasio                                                                                                                                                                                                                                                          | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `celery`       | Sellerie, Selleriesalz, Gemüsebrühe, Brühe (zusammengesetzt, vorsichtig)                                                                                                                                                                                                               | „Brühe“ ohne Sellerie nur über Ausnahmeliste mit Quelle                                                                                                                                                             | –                                                                                                                         |
| `mustard`      | Senf, Senfsaat, Mayonnaise (vorsichtig)                                                                                                                                                                                                                                                | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `lupin`        | Lupine, Lupinenmehl                                                                                                                                                                                                                                                                    | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `sulphites`    | Weinessig, Balsamico, „geschwefelt“, getrocknete Aprikose/Trockenaprikose (meist geschwefelt)                                                                                                                                                                                          | „ungeschwefelt“ nur mit Quelle; **zusätzlich menschliche Prüfung** (Trockenobst allgemein), Wein selbst ist durch R12 ausgeschlossen                                                                                | –                                                                                                                         |
| `fructose`     | **ohne Wortregel, nur Prüfung durch Menschen** (`human_only`) – Zuordnung nach Fruktose-Gehalt der Quelle (5.1.2)                                                                                                                                                                      | –                                                                                                                                                                                                                   | Quellwerte, Schwelle in `constants.ts`                                                                                    |
| `histamine`    | **ohne Wortregel, nur Prüfung durch Menschen** (`human_only`) – Zuordnung nach SIGHI-Liste (5.1.2)                                                                                                                                                                                     | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `mushrooms`    | Pilz, Champignon, Pfifferling, Eierschwammerl, Steinpilz, Shiitake, Austernpilz, Kräuterseitling, Morchel, Trüffel                                                                                                                                                                     | Hefe, Hefeflocken nicht `mushrooms` (Begründung: in der App als Speisepilze erklärt)                                                                                                                                | Pilze → Pflicht                                                                                                           |
| `onion_garlic` | Zwiebel, Knoblauch, Lauch, Porree, Schalotte, Bärlauch, Frühlingszwiebel, Schnittlauch, Zwiebelpulver, Knoblauchpulver                                                                                                                                                                 | –                                                                                                                                                                                                                   | –                                                                                                                         |
| `spicy`        | Chili, Cayenne, Jalapeño, Peperoncino, Pfefferoni, Sambal, Harissa, Sriracha, Wasabi, Currypaste, scharf                                                                                                                                                                               | „Paprika edelsüß“, schwarzer Pfeffer nicht `spicy`; Quelle „Senf mittelscharf“ nicht `spicy` (N2b, nur Quell-Bezeichnung; R19 bestätigt)                                                                            | –                                                                                                                         |

**Weitere Pflichtregeln (kein `FOOD_GROUPS`-Eintrag):**

- **Schwein** (`animal: meat`, `meat_kind: pork`): Schwein, Speck, Schinken, Salami, Schmalz, Chorizo, Mett, Leberkäse, Wiener/Frankfurter, Kassler, Pancetta, Prosciutto; Hackfleisch ohne Angabe (siehe `beef`). Gelatine → `animal: gelatin`, ohne Herkunft `meat_kind: unknown` (zählt als Schwein, S5).
- **`pregnancy_caution` (R2-S2):** Rohmilch, Rohmilchkäse (Quelle/Name „aus Rohmilch“), kalt geräucherter oder gebeizter Fisch (Räucherlachs, Graved Lachs), Sushi/Sashimi/roher Fisch, Rohwurst (Salami, Mett, Teewurst, Cervelat), Rohschinken (Parma, Serrano, Schwarzwälder), Leber und Leberprodukte. Ob ein Rezept heikel ist, entscheidet zusätzlich die Zubereitung (`heated`, 5.2).
- **Test-Fixtures:** je Gruppe mindestens ein Treffer, ein Nicht-Treffer aus der Negativliste und ein Grenzfall (z. B. „Eiernudeln“ → `eggs` + `gluten`; „Kokosmilch“ ≠ `dairy`; „Tintenfischringe“ → `shellfish`, ≠ `fish`; „Schafskäse“ → `dairy`, ≠ `lamb`; „Eierschwammerl“ → `mushrooms`, ≠ `eggs`; „Leberkäse“/„Fleischkäse“ ≠ `dairy`, aber Schwein; Hackfleisch ohne Angabe → `beef` + `meat_kind: ['beef', 'pork']`). Hinweis im Code: `animal[]` nutzt `'egg'`, `FOOD_GROUPS` dagegen `eggs` – bewusst getrennt, per Kommentar markiert.

### 5.2 Rezept-Schema `content/recipes/<id>.json` (`recipeSchema`, Zod, strikt)

`id`, `version`, `status`, `title_de`, `description_de` (≤ 200), `meal_types[]` (`breakfast|main|snack`), `training_tags[]` (`vor_training|waehrend|nach_training`), `servings` (Grundrezept 1–8), `ingredients[]` (1–20: `food_id`, `amount`, `unit`, `optional`, `note_de?`, `scales: boolean`, **`heated: boolean`** – Pflicht für jede Zutat aus `eggs`, `fish`, `shellfish` oder mit `animal: meat`/Rohmilch, R2-S2), `steps_de[]` (1–15), `prep_minutes` (1–120), `cook_minutes` (0–240), `no_cook`, `meal_prep` { `suitable`, `fridge_days` 0–3, `freezable` }, `equipment_de[]`, **deklarierte Angaben zur Gegenprüfung**: `declared_per_serving` { kcal, protein_g, carbs_g, fat_g }, `declared_diet`, `declared_allergens[]`, `contains_pork`, **`declared_pregnancy_caution`** (R2-S2), `cost_level?` (reserviert), `meta`.

**Einzige Wahrheit sind die Zutaten:** Nährwerte, Ernährungsform, Allergene, Schwein und Schwangerschafts-Vorsicht **berechnet der Core** aus dem Katalog. **Optionale Zutaten (S3) zählen für Ernährungsform, Allergene, Schwein und `pregnancy_caution` immer mit** (das Rezept „enthält“ sie). Nährwerte werden ohne optionale Zutaten berechnet. Die deklarierten Werte dienen nur der Plausibilitätsprüfung.

**`pregnancy_caution` eines Rezepts (R2-S2)** ist wahr, wenn (a) eine Zutat (auch optional) im Katalog `pregnancy_caution` hat, **oder** (b) eine Zutat aus `eggs`, `fish`, `shellfish` oder mit `animal: meat`/Rohmilch `heated: false` hat (z. B. rohes Ei in Mayonnaise/Tiramisu, Tatar), **oder** (c) das Rezept `no_cook` ist und eine solche tierische Zutat enthält (z. B. Bagel mit Räucherlachs). Ein `heated: true` in einem `no_cook`-Rezept ist ein roter Schema-Befund.

### 5.3 Prüfregeln (`recipe-checks.ts`, Teil von `pnpm content:validate`)

Wie bisher: Schema-Fehler blockieren immer, andere **rote** Befunde blockieren Freigabe und Einspielen, **gelbe** nie.

**Entwürfe im Testmodus (korrigiert, R2-S6):** `scripts/bundle-content.mjs` bündelt nur die Dateien (`FOLDERS` um `food: 'foods'`, `recipe: 'recipes'` ergänzt, ebenso `CONTENT_FOLDERS` in `packages/content/src/validate.ts`). Geprüft und gefiltert wird **in der App über Core-Funktionen**: `apps/mobile/src/data/local-backend.ts` ruft `selectNutritionContent(validateContent(files), { allowDrafts: true })` auf (neu in `packages/core/src/content/`, neben `selectPlanContent`). Sie liefert nur `published` sowie – mit `allowDrafts` – Entwürfe **ohne roten Befund** und **nur mit katalog-geprüften Lebensmitteln** (R19); alles andere fällt heraus, mit Grund in der Testmodus-Diagnose. Test in Core (W24).

| Regel   | Prüfung                                                                                                                                                                                                                                | Farbe       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| R1      | Schema (Rezept und Lebensmittel)                                                                                                                                                                                                       | rot (immer) |
| R2      | jede `food_id` existiert, Einheit ist für das Lebensmittel umrechenbar                                                                                                                                                                 | rot         |
| R3      | **Makro-Plausibilität:** berechnete vs. deklarierte Werte je Portion – kcal ±10 % (mind. ±20 kcal), Makros ±15 % (mind. ±3 g)                                                                                                          | rot         |
| R4      | **Atwater** je Lebensmittel: 4·E + 4·KH + 9·F (+2·Ballaststoffe, +3·org. Säuren, +7·Alkohol, Polyole 2,4; LMIV Anh. XIV) = kcal ±15 % (zusätzlich zu R17)                                                                              | rot         |
| R5      | kcal je Portion: Frühstück 200–900, Hauptgericht 300–1200, Snack 80–500                                                                                                                                                                | gelb        |
| R6      | deklarierte Ernährungsform = berechnete (vegan ohne jedes `animal[]`; vegetarisch ohne `meat`, `fish`, `shellfish`, `gelatin`, `animal_rennet`, `insect`) inkl. optionaler Zutaten                                                     | rot         |
| R7      | deklarierte Allergene ⊇ berechnete (inkl. optionaler Zutaten)                                                                                                                                                                          | rot         |
| R8      | `contains_pork` = berechnet (Gelatine mit Herkunft `pork`/`unknown` zählt als Schwein)                                                                                                                                                 | rot         |
| R9      | Meal-Prep: Kühlschrank-`fridge_days` ≤ min(`max_fridge_days` der Zutaten) und ≤ 3 – **immer**; `freezable` erlaubt nur längere Abstände **eingefroren** (6.4; BfR wortgenau zitiert, S12)                                              | rot         |
| R10     | Textregeln Ü6 (`packages/core/src/content/text-rules.ts`) + **Health-Claims-Liste** (Abschnitt 10) + keine Marken                                                                                                                      | rot         |
| R11     | Mengen plausibel je Portion (Salz ≤ 2,5 g, Öl ≤ 30 g, Zutat ≤ 600 g)                                                                                                                                                                   | gelb        |
| R12     | kein Alkohol                                                                                                                                                                                                                           | rot         |
| R13     | `pregnancy_caution` aus Zutaten **und Zubereitung** (`heated`, `no_cook`) berechnet und angezeigt; **rot**, wenn `declared_pregnancy_caution` ≠ berechnet (R2-S2)                                                                      | rot         |
| R14     | `no_cook` ⇒ `cook_minutes` = 0 und keine Herd/Ofen-Geräte                                                                                                                                                                              | rot         |
| R15     | Version steigt bei Änderung freigegebener Inhalte                                                                                                                                                                                      | rot         |
| R16     | Abdeckungsbericht (5.4)                                                                                                                                                                                                                | gelb        |
| **R17** | Lebensmittel-Nährwerte = Quellauszug, `source.ref` existiert, `source.license` gesetzt (B6b); Herkunft des Auszugs geprüft (`sources-integrity`: Prüfsummen + Zeilen-Teilmenge der Original-Datei + nur aus `foods-import`, R2-B2)     | rot         |
| **R18** | Allergen-Pflichtregeln als Code für alle 23 `FOOD_GROUPS`-IDs (5.1.3, R2-B3/R2-S1), `pregnancy_caution`-Pflichtregeln (R2-S2), Erwartungsliste je Lebensmittel, Ersatzprodukt-`for_groups` widerspricht nicht den eigenen Gruppen (S4) | rot         |
| **R19** | Lebensmittel katalog-geprüft (`meta.catalog_reviewed_*`, nur über `content-review` gesetzt, R2-K6), sonst Rezept nicht nutzbar (B6d)                                                                                                   | rot         |

### 5.4 Startbestand (Gründer-Entscheidung 6: erst Entwürfe)

- **~150 Lebensmittel** (Zuordnung in einer Claude-Code-Sitzung, **Nährwerte per Import**, menschliche Katalog-Prüfung) und **~60 Rezepte** (`origin: claude_session`, Status `draft`, „KI-Entwurf – fachlich prüfen“). **→ ersetzt durch 19.1–19.3: 236 Zutaten und 242 Rezepte aus `alpha5-rezepte.json` (`origin: manual`).**
- Verteilung: 15 Frühstück, 30 Hauptgerichte, 15 Snacks/kleine Mahlzeiten (davon ≥ 8 `no_cook`). Mindestens 1/3 vegan, insgesamt ≥ 2/3 vegetarisch, ≤ 5 mit Schwein, ≥ 15 Meal-Prep-geeignet (davon ≥ 6 `freezable`), ≥ 10 ohne Gluten und ≥ 10 ohne Milch. **→ seit 19.1 nur noch Abdeckungsziel für R16 (Bericht an die Gründer, K9).**
- **Abdeckungsbericht (R16)** in der CI-Zusammenfassung: Anzahl passender Rezepte je Slot × Ernährungsform × häufige Unverträglichkeit. Unter 7 je Kombination → gelber Hinweis.
- Freigabe: Gründer prüfen in der GitHub-App bzw. im Admin-Bereich. **Vor dem Livegang (echte Konten, N7) prüft eine Ernährungsfachkraft** Katalog und Rezepte (Gründer-Entscheidung 6); erst dann `published` + `expert_reviewed`.
- Batch-Pipeline (`kinds/recipe.ts`) kommt **später** (N8). Die KI erzeugt dabei nur Zutaten mit `food_id` aus dem Katalog, Mengen und Schritte; neue Lebensmittel nur als Vorschlag. **→ 19.1: N8 nur noch für spätere Ergänzungen.**

### 5.5 Supermarkt-Abteilungen (DACH, `SHOPPING_CATEGORIES`, feste Reihenfolge)

Obst & Gemüse · Brot & Backwaren · Kühlregal: Milchprodukte & Eier · Kühlregal: vegetarisch/vegan (Tofu, Tempeh) · Fleisch & Wurst · Fisch · Nudeln, Reis & Getreide · Hülsenfrüchte & Konserven · Müsli & Frühstück · Nüsse, Samen & Trockenfrüchte · Öle, Essig & Saucen · Gewürze & Backzutaten · Tiefkühl · Getränke · Sonstiges. Vorrat (`pantry`) steht getrennt unter „Hast du wahrscheinlich da“ (eingeklappt).

---

## 6. Wochen-Essensplan und Einkaufsliste (Core)

### 6.1 Filtern (`filter.ts`) – harte Regeln

Ein Rezept passt nur, wenn: Status `published` (Testmodus zusätzlich `draft` ohne roten Befund und nur mit katalog-geprüften Lebensmitteln, gekennzeichnet – vorausgewählt durch `selectNutritionContent`, 5.3), Ernährungsform verträglich (vegan ⊂ vegetarisch ⊂ omnivor; `animal_rennet` und `gelatin` nicht vegetarisch, Honig nicht vegan), **Schwein nur bei `eats_pork = true`** (`eats_pork = null` bei omnivor gilt wie „nein“; Gelatine unbekannter Herkunft zählt als Schwein, S5), **keine** Gruppe aus Unverträglichkeiten, **keine** Gruppe aus „mag ich nicht“ (Gründer-Entscheidung 5: hart), nicht `pregnancy_caution` bei Schwangerschaft bzw. bei „kein Check“ und Geschlecht ≠ männlich (B4), `meal_types` passt zum Slot, bei Meal-Prep-Slots `meal_prep.suitable`. Optional „werktags höchstens X Minuten“.

- **Konflikte (K9):** Unverträglichkeit und „mag ich“ für dieselbe Gruppe → die Unverträglichkeit gewinnt (Ausschluss).
- **Optionale Zutaten (S3):** Verletzt nur eine **optionale** Zutat einen Filter, darf der Filter sie **weglassen** statt das Rezept auszuschließen; die Nährwerte werden ohne sie neu gerechnet, die Rezeptansicht zeigt „ohne Erdnüsse“ (neutral formuliert).
- **Ersatz-Zutaten (S4):** Ist nur eine Zutat das Problem und hat sie einen `substitute` mit passendem `for_groups`, wird das Rezept **mit dem Ersatzprodukt komplett erneut gefiltert** (alle Regeln oben, z. B. Haferdrink bei Gluten-Unverträglichkeit → raus; laktosefreie Milch bei Milcheiweiß-Allergie `dairy` → raus). Erst dann wird es verwendet, gekennzeichnet („mit laktosefreier Milch“), die Nährwerte neu gerechnet; Einkaufsliste und PDF nennen das Ersatzprodukt.

### 6.2 Portionsskalierung (`scale.ts`)

- Faktor = Ziel-kcal des Slots / kcal je Portion, begrenzt auf **0,5–2,0** (`PORTION_SCALE_LIMITS`).
- Rundung je Einheit: Gramm/ml auf 5 (unter 20 g auf 1), Stück auf ½ (Eier ganz), EL/TL auf ½, `scales: false` bleibt.
- **Nach der Rundung werden die Nährwerte neu gerechnet.** Slots dürfen ±10 % vom Slot-Anteil abweichen; maßgeblich ist die **Tagessumme im Planband** (4.6.1, B1). Eiweiß ≥ 90 % des Slot-Anteils (gelockert, wenn kein Rezept das schafft → Hinweis).
- **Zielpunkt ist die Bandmitte**, damit Rundungen nicht an den Rand führen.
- **Ausgleich je Tag (B1):** Liegt die Tagessumme unter dem Band (z. B. bei 1 Mahlzeit/Tag, leeren Slots, festen Meal-Prep-Resten), in dieser Reihenfolge: (1) Faktoren der skalierbaren Mahlzeiten bis 2,0 anheben, (2) bis zu `MEAL_PLAN_FILL.maxExtraSnacks = 2` **Ergänzungs-Snacks** (`no_cook`, passend zu allen Filtern) hinzunehmen, gekennzeichnet „Ergänzung, damit du deinen Bedarf erreichst“ – auch wenn weniger Mahlzeiten eingestellt sind. Liegt sie darüber, Faktoren senken (bis 0,5).
- **Untergrenze nicht erreichbar:** Tag bekommt Status `below_floor` und Hinweis **`day_below_floor`** („Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze z. B. eine Portion Obst, Nüsse oder Joghurt.“). Er erscheint **nicht** als „dein Plan“, sondern als „unvollständiger Vorschlag“ (auch im PDF ohne kcal-Zahl, mit Hinweis). Es gibt **keinen** stillen Tag unter der Untergrenze.
- **Modus `no_targets` (S15):** Faktor 1 (Grundrezept ÷ `servings`), **keine Tagessummen gegen ein Ziel**, fester Hinweis: „Die Portionen sind nicht an deinen Bedarf angepasst – iss dich satt und ergänze bei Hunger.“ Interner Plausibilitätswert `NO_TARGETS_MIN_DAY_KCAL = 1800` (PRODUKTENTSCHEIDUNG): Liegt die Summe der Standardportionen darunter, wird ein Ergänzungs-Snack hinzugenommen. Es wird **keine Zahl** angezeigt.

### 6.3 Wochenplan (`meal-plan.ts`) – deterministisch

`buildMealPlanWeek({ targets, prefs, recipes, foods, weekStart, variant, existingPlan?, today })`:

1. Slots je Tag aus 4.8.
2. Kandidaten je Slot nach 6.1.
3. Punkte je Kandidat: Passung (kcal/Eiweiß nach Skalierung, Abstand zur Bandmitte) + Vorliebe („mag ich“ +) − Wiederholung (Hauptgericht höchstens 2× pro Woche, nie an zwei Tagen hintereinander; Frühstück höchstens 3×) − gleiche Haupt-Eiweißquelle am Vortag + **Zutaten-Wiederverwendung**. Gewichte: PRODUKTENTSCHEIDUNG in `MEAL_PLAN_SCORING`.
4. Gleichstand: `stableHash(weekStart | slotKey | recipeId | variant)`. **Kein Zufall.**
5. Rolle vor/nach Training: für `post` Rezepte mit `nach_training`-Tag bzw. mehr Eiweiß bevorzugt.
6. **Tagesausgleich nach 6.2** und Band-Prüfung für jeden Tag (B1).
7. **„Andere Vorschläge“** = `variant + 1`. **„Rezept tauschen“** = nächstbester Kandidat, der in dieser Woche noch nicht vorkommt; danach wird der Tag erneut ausgeglichen und gegen das Band geprüft. Vergangene Tage ändern sich nie.
8. Ergebnis: Tage → `status` (`complete` | `below_floor` | `no_targets`) + Mahlzeiten { slot, role, recipeId, recipeVersion, factor, Zutaten skaliert, Nährwerte, Ersatz-/Weglass-Hinweise, `cook | leftover | fresh`, `is_fill` } + Tagessummen + Hinweise (`no_candidates_for_slot`, `protein_below_target`, `day_below_floor`, `drafts_used`, `drafts_allergens_unreviewed`).

- **Keine passenden Rezepte** für einen Slot → der Slot bleibt leer mit klarer Meldung, welcher Filter es verhindert; die Energie wird auf die übrigen Slots/Ergänzungen verteilt (6.2). Es gibt nie einen Ersatz, der eine Unverträglichkeit verletzt.

### 6.4 Meal-Prep (`meal-prep.ts`)

- `mealprep_days` = Kochtermine pro Woche (1–7). Feste Verteilung `MEAL_PREP_DAYS` (1: So · 2: So, Mi · 3: So, Di, Do · …).
- Vorgekocht werden die Slots aus `mealprep_slots` (`lunch` Standard oder `lunch_dinner`). Ein Kochtermin deckt die Tage bis zum nächsten Termin, **höchstens `fridge_days` des Rezepts** (= Minimum über `max_fridge_days` der Zutaten, S12). Längere Abstände nur mit `freezable` und dem Hinweis „einfrieren“.
- **Kein `freezable`-Kandidat bei großem Kochabstand (S12):** Die Tage jenseits der Haltbarkeit werden **frisch gekocht** (`prep_kind = fresh`, täglicher Modus für diese Slots), Hinweis „An diesen Tagen kochst du frisch.“
- Dasselbe Gericht wiederholt sich innerhalb eines Kochtermins, zwischen den Terminen wird abgewechselt.
- **Reste und Planband (B1):** Die Portion je Tag wird beim Kochtermin festgelegt (gekocht wird die Summe). Ist eine Rest-Portion fest (z. B. nach „Rezept tauschen“ oder Neuplanung nach dem Kochtag), gleicht der Tag über die übrigen Slots und Ergänzungs-Snacks aus (6.2); gelingt das nicht → `below_floor`.

### 6.5 Einkaufsliste (`shopping-list.ts`)

- `buildShoppingList(plan, { from, to }, foods)`: Standard ist die ganze Woche, wahlweise ein Zeitraum.
- Aggregation je (`food_id`, Grundeinheit), **Ersatzprodukte statt Original** (S4), weggelassene optionale Zutaten fehlen (S3), Ergänzungs-Snacks sind enthalten. EL/TL/Stück → Gramm, solange es eine Umrechnung gibt; Stück bleibt Stück, wenn natürlicher. Mengen **aufgerundet** auf Kaufschritte (Gramm auf 10/50, Stück auf ganz). Gewürze „nach Geschmack“.
- Sortierung: Abteilung (5.5), dann Name. Vorrat getrennt.
- **Stabiler Schlüssel je Eintrag** = `food_id|einheit`. Häkchen bleiben bei Neuerzeugung erhalten; Mengenänderungen markiert.
- **Neuerzeugung nach automatischer Neuplanung (R2-S4):** `rebuildShoppingList(oldList, newPlan, range)` – weggefallene **offene** Einträge verschwinden, weggefallene **schon abgehakte** Einträge bleiben mit Hinweis „nicht mehr im Plan“, eigene Einträge bleiben unverändert.
- **Eigene Einträge** (Freitext ≤ 80 Zeichen, Abteilung wählbar).
- Keine Marken, nur Produktarten.

### 6.6 Automatische Neuplanung bei Moduswechsel (S7)

- `needsAutomaticReplan(plan, currentTargets, today)` läuft bei jedem Öffnen von „Heute“/„Ernährung“ und nach jeder Änderung an Gesundheits-Check, Körperdaten, Einwilligung oder Vorlieben.
- **Automatisch neu geplant (ohne Knopf)** werden die Tage **ab heute**, wenn sich der **Modus** oder die **Deckel** geändert haben (neues Flag wie Schwangerschaft/Medikamente, 18. bzw. 65. Geburtstag, BMI-Klasse < 18,5 bzw. < 20, Check nachgeholt, Widerruf) **oder** eine Tagessumme außerhalb des aktuellen Planbands liegt, **oder** eine neue Unverträglichkeit/Abneigung den Plan verletzt. Hinweis „Dein Plan wurde an deine neuen Angaben angepasst.“
- **Einkaufsliste mit (R2-S4):** Jede automatische Neuplanung erzeugt im selben Schritt die Einkaufsliste für den betroffenen Zeitraum neu (6.5, Häkchen über `item_key`). So enthält die Liste nach „schwanger = ja“ oder einer neuen Unverträglichkeit keine ausgeschlossene Zutat mehr (z. B. Rohmilchkäse, roher Fisch).
- Vergangene Tage bleiben unverändert.
- Der bisherige Knopf „Plan aktualisieren“ (Ziele ≥ 5 % geändert, ohne Sicherheitsbezug) bleibt für alles Übrige.
- Kein Speichern von Zielen nötig: Der Abgleich rechnet die Ziele neu und vergleicht mit den gespeicherten Tagessummen.

---

## 7. Datenmodell (Testmodus zuerst, Supabase in Etappe N7)

### 7.1 Ist Ernährung Gesundheitsdatum? – Empfehlung (wie empfohlen entschieden)

- **Kalorien-/Makroziele** werden aus Größe, Gewicht und ggf. Gesundheits-Flags berechnet → gelten **vorsorglich als Gesundheitsdaten** (EuGH C-184/20). Sie werden **nicht gespeichert**.
- **Essenspläne mit skalierten Portionen** → `uses_health_data = true`, wenn Ziele eingeflossen sind. Pläne im Modus `no_targets` sind **kein** Gesundheitsdatum – **außer** Flags oder Unverträglichkeiten sind eingeflossen (z. B. Schwangerschafts-Ausschlüsse, B5).
- **Unverträglichkeiten** sind Art. 9 → `uses_health_data = true`, sobald eine Unverträglichkeit gefiltert wurde.
- **„Ohne Schwein“** kann auf eine religiöse Überzeugung hindeuten (Art. 9). Das Feld bleibt ohne Einwilligung, wird **nie** an Analytics gegeben, DSFA-Risiko R7.

### 7.2 Neue/erweiterte Tabellen (Spalten englisch, RLS überall)

**Inhalte** (nur `published|archived`, `authenticated` liest nur `published`, Schreiben nur `seed_content()`):

| Tabelle              | Spalten (Kurzform)                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foods`              | id, version, status, name_de, aliases_de, shopping_category, pantry, Nährwerte je 100 g, units jsonb, groups text[] (CHECK = `FOOD_GROUPS`), animal text[], meat_kind text[], gelatin_origin, pregnancy_caution, max_fridge_days, freezable, substitutes jsonb, source jsonb (inkl. license), meta                      |
| `recipes`            | id, version, status, title_de, description_de, meal_types, training_tags, servings, steps_de text[], prep/cook_minutes, no_cook, meal_prep jsonb, equipment_de, **berechnete** Spalten per Seed: per_serving_kcal/protein/carbs/fat, diet, allergens (inkl. optionaler Zutaten), contains_pork, pregnancy_caution; meta |
| `recipe_ingredients` | (recipe_id, order_no) PK, food_id → `foods` (`on delete restrict`), amount, unit, optional, scales, note_de                                                                                                                                                                                                             |

**Nutzerdaten:**

| Tabelle                      | Spalten                                                                                                                                                                                                                                      | Regeln                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nutrition_prefs` (+Spalten) | `activity_level` (enum), `training_time` (enum, null), `show_energy_numbers` (bool, Standard true, Frage 16 B (h)), `mealprep_slots` (`lunch                                                                                                 | lunch_dinner`), `max_prep_minutes_weekday` (null oder 10–120)                                                                                                                      | direkt schreibbar wie bisher; kein Gesundheitsdatum                           |
| `meal_plans`                 | id, user_id, week_start (Montag), status `active                                                                                                                                                                                             | replaced`, engine_version, variant, **uses_health_data** (setzt der Server), inputs jsonb (**ohne** Körperdaten, Flags **und ohne Liste der Unverträglichkeiten**, K8), created_at | höchstens ein aktiver Plan je Woche und Person; nur lesen, Schreiben über RPC |
| `meal_plan_items`            | (plan_id, user_id) FK cascade, date, slot, role, recipe_id → `recipes` (`on delete restrict`), recipe_version, Schnappschuss title_de, factor, kcal/protein/carbs/fat, substitutions jsonb, omitted_optional jsonb, is_fill, prep_kind `cook | leftover                                                                                                                                                                           | fresh`, day_status                                                            | Schnappschuss |
| `shopping_lists`             | id, user_id, meal_plan_id (`on delete set null (meal_plan_id)`), from_date, to_date, uses_health_data, created_at                                                                                                                            |                                                                                                                                                                                    |
| `shopping_list_items`        | id, list_id + user_id cascade, item_key, food_id null, label_de, amount, unit, category, is_pantry, is_manual, checked, updated_at                                                                                                           | Nutzer dürfen nur `checked` ändern sowie eigene manuelle Einträge anlegen/löschen                                                                                                  |

**Enums und `db-sync` (S8):** Neue Werte-Listen (`activity_level`, `training_time`, `meal_type`, `meal_slot`, `meal_role`, `shopping_category`, `food_animal`, `meat_kind`) bleiben bis N7 als Konstanten in `packages/core/src/nutrition/` und kommen **erst in N7 zusammen mit der Migration** nach `enums.ts` – so bleibt `db-sync.test.ts` in jeder Etappe grün. Der Onboarding-Schritt `nutrition_setup` dagegen steht in `ONBOARDING_STEPS` und braucht deshalb **schon in N4** die kleine CHECK-Migration (8.1).

### 7.3 Server-Funktionen (`security definer`, `search_path = ''`, `revoke … from public, anon`, Fehler ohne Zeilendetails)

- `save_meal_plan(p_plan jsonb)`: Login, Profil, nur bekannte Felder (= `mealPlanPayloadSchema`), nur freigegebene Rezepte in passender Version, Datumsrahmen (laufende + nächste Woche), Faktor 0,5–2,0. **Ernährungsform/Schwein/Unverträglichkeit/Abneigung wird serverseitig erneut gegen die Rezept-Spalten geprüft.** **Faktor ≠ 1 ohne gültige `health_data`-Einwilligung wird abgelehnt** (S9, wie H-c beim Trainingsplan). `uses_health_data` bestimmt der Server. Ersetzt den aktiven Plan der Woche. Hier hängt später die Premium-Prüfung (Phase 7) – **aber:** sie verhindert nur das Speichern, nicht das Rechnen auf dem Gerät, weil Core und freigegebene Rezepte für alle lesbar sind (R2-K7). Was genau serverseitig Premium ist, klärt Frage 16 B (l) mit Phase 7.
- **`pregnancy_caution` und Server (R2-K8):** `save_meal_plan` prüft `pregnancy_caution` bewusst **nicht** (gleiche Begründung wie S9: der Core filtert auf dem Gerät, ein manipulierter Client schadet nur sich selbst). Das wird in KONZEPT 12 **zusammen mit den Kalorien-Grenzen** aufgeführt.
- **Kalorien-Schutzgrenzen und Server (S9), bewusste Entscheidung:** Die Kalorien-Grenzen rechnet und prüft der **Core auf dem Gerät** (gleicher Code in Testmodus und Supabase-Modus, Eigenschaftstests). Ein manipulierter Client schadet nur sich selbst; der Server liefert keine Ziele aus. Das wird in KONZEPT 12 festgehalten. Optional (Kann, N7): Plausibilitätsprüfung in SQL – Tagessumme ≥ Mifflin aus den gespeicherten Körperdaten – mit Ablehnung statt stiller Korrektur.
- `replace_shopping_list(p_list jsonb)`: übernimmt Häkchen über `item_key`.
- Abhaken direkt per PostgREST (nur Spalte `checked`) oder `set_shopping_items_checked(p_items)` für die Offline-Warteschlange.
- **Widerruf `health_data`** (`private.consents_after_revoke()` erweitert): löscht alle `meal_plans` und `shopping_lists` mit `uses_health_data` (Kaskade, inkl. eigener Einträge – K10). Unverträglichkeiten werden ohnehin gelöscht.
- `export_my_data()` erweitert um alle vier Tabellen + neue `nutrition_prefs`-Spalten; `delete_my_account()` per Kaskade.
- `seed_content()` erweitert um `foods`, `recipes`, `recipe_ingredients` (berechnete Spalten aus dem Core-Seed-Paket; R3/R6/R7/R17–R19 laufen vorher in `content-seed`).
- pgTAP: neue Dateien `23_nutrition_content.test.sql`, `24_meal_plans.test.sql`, `25_meal_plan_rpcs.test.sql`, `26_shopping_lists.test.sql` (20–22 für 4b reserviert) + Ergänzungen in `01_rls_isolation`, `04_account_deletion`, `06_profile_required`, Widerrufs- und Export-Tests.

### 7.4 Widerruf – der gefährliche Fall

Wer Zöliakie als Unverträglichkeit eingetragen hat und dann `health_data` widerruft, verliert die Unverträglichkeit. Deshalb:

1. Der Widerrufs-Dialog sagt deutlich: „Deine Unverträglichkeiten werden gelöscht und beim Essensplan **nicht mehr berücksichtigt**. Essenspläne und Einkaufslisten mit Gesundheitsbezug werden gelöscht – **auch deine eigenen Einträge in der Einkaufsliste** (K10).“
2. Angebot (aktive Wahl, nicht vorausgewählt): „Diese Lebensmittel stattdessen unter ‚mag ich nicht‘ ausschließen?“ (wirkt laut 6.1 genauso hart, ist kein Gesundheitsdatum).
3. **Ablauf (S17), fest in dieser Reihenfolge:**
   1. **Nur wenn die Person der Umwandlung aktiv zustimmt (R2-K4)**, liest die App die Unverträglichkeiten vorher ein und legt sie als **„ausstehende Abneigungen“** ab (nur Gruppen-IDs, im Arbeitsspeicher bzw. geschützten Speicher). **Lehnt sie ab, wird nichts eingelesen und nichts behalten** – sonst blieben Art.-9-Daten nach dem Widerruf gespeichert.
   2. Widerruf ausführen (der Trigger `consents_after_revoke()` löscht die Unverträglichkeiten sofort).
   3. Bei Zustimmung die Gruppen als **„mag ich nicht“** schreiben; ein vorhandenes **„mag ich“ derselben Gruppe wird ersetzt** (Unique-Index `like_xor_dislike`).
   4. Erst dann neu planen (Modus `no_targets`, 6.6).
   - **Dazwischen gibt es keinen Plan**, der die Gruppen nicht beachtet: Solange die Umwandlung aussteht (z. B. Abbruch offline nach Schritt 2), merkt sich die App das in einer Warteschlange („Umwandlung ausstehend“), zeigt keinen Essensplan, sondern den Hinweis „Wir übernehmen gerade deine Ausschlüsse …“, und führt Schritt 3–4 bei der nächsten Verbindung aus. Die „ausstehenden Abneigungen“ werden danach sofort gelöscht.
   - **Testmodus:** alles in einem Schritt in `applyHealthDataRevocation` (atomar im `localDb`).
4. **Einwilligungstext (K7):** In der nächsten Fassung von `health_data` unter „Widerruf“ ergänzen: „Auch Essenspläne und Einkaufslisten mit Gesundheitsbezug werden gelöscht.“ (v1 deckt „Ernährungspläne/Kalorienbedarf“ bereits ab.)
   Tests in Core (Filter, Umwandlung mit vorhandenem „mag ich“), App (Dialog, Abbruch offline) und pgTAP (Löschung).

### 7.5 Gerätespeicher

- **Testmodus:** `localDb` wie bisher (unverschlüsselt, bekannte Ausnahme aus Phase 4 Frage 3). Neue Felder in `UserRows`: `mealPlans`, `mealPlanItems`, `shoppingLists`, `shoppingListItems`, `pendingRevocationConversion`. Rezepte und Lebensmittel kommen aus dem Content-Bundle (`bundle-content.mjs` um `foods`/`recipes` erweitert; im Supabase-Build leer wie bisher); Prüfung und Auswahl über `selectNutritionContent(validateContent(files), { allowDrafts: true })` in `local-backend.ts` (R2-S6).
- **Supabase-Modus:** Pläne/Listen mit `uses_health_data` nur im **geschützten Speicher**, gleiche Löschregeln wie Phase 3 Frage 14. Abhaken offline über eine Warteschlange.

---

## 8. App (`apps/mobile`, Web-Export und nativ gleich)

### 8.1 Onboarding-Ergänzungen (Gründer-Entscheidung 4)

- Neuer Schritt **`nutrition_setup`** nach `cooking` (für bestehende Testerinnen einmalig beim ersten Öffnen von „Ernährung“):
  1. „Wie aktiv ist dein Alltag – ohne Sport?“ (4 Antworten aus 4.4, mit Beispielen),
  2. „Wann trainierst du meistens?“ (früh / vormittags / mittags / nachmittags / abends / unterschiedlich),
  3. Meal-Prep: „Was kochst du vor?“ (Mittag / Mittag + Abend), nur bei Meal-Prep,
  4. Hinweis-Box Essstörungen (4.9) + Schalter „Kalorienzahlen anzeigen“ (Standard an, Frage 16 B (h)).
- **`ONBOARDING_STEPS` + CHECK-Migration in N4 (S8):** `nutrition_setup` kommt in N4 in `ONBOARDING_STEPS`; im selben PR eine kleine Migration, die die CHECK-Liste `profiles.onboarding_step` ergänzt (läuft beim Merge über `db-migrate.yml`, harmlos, keine neuen Daten). `db-sync.test.ts` bleibt grün (W16).
- **Supabase-Modus bis N7 ausgeblendet (R2-S3):** Die Spalten `activity_level`, `training_time`, `show_energy_numbers`, `mealprep_slots` gibt es erst in N7. Deshalb bekommt `OnboardingState` (`packages/core/src/onboarding.ts`) das Feld `nutritionSetupAvailable?: boolean`, und `isStepApplicable('nutrition_setup', state)` ist **nur bei `nutritionSetupAvailable === true`** wahr (`undefined` = nicht anwendbar, anders als bei den übrigen Feldern – sicherer Standard). Bis N7 setzt nur das lokale Backend (Testmodus) den Wert auf `true`; der Supabase-Modus zeigt den Schritt nicht und speichert nichts ins Leere. N7 schaltet den Supabase-Modus zusammen mit der Spalten-Migration um. Tests: `onboarding.test.ts` + Backend-Test (W21).
- Schritt `nutrition`: Hinweis bei fehlender Einwilligung: „Ohne Einwilligung kannst du Lebensmittel unter ‚mag ich nicht‘ ausschließen – sie werden dann genauso sicher weggelassen.“
- „Fertig“-Bildschirm: kurze Ernährungs-Zusammenfassung („Trainingstag ca. 2.150 kcal, Ruhetag ca. 1.950 kcal“ bzw. ohne Zahlen).

### 8.2 Bildschirme (Routen unter `apps/mobile/src/app/…`, K5)

1. **„Heute“** (`apps/mobile/src/app/today.tsx`): Karte „Essen heute“ mit Tagesziel (oder ohne Zahlen), nächste Mahlzeit mit Rolle, Kochtag-Hinweis, Hinweis bei `below_floor`, Link „Ernährung“.
2. **Ernährung – Tag** (`apps/mobile/src/app/ernaehrung/index.tsx`): Ziel kcal + Makro-Balken (ausblendbar), Mahlzeiten mit Portion, Nährwerten und Rolle, Ergänzungs-Snacks gekennzeichnet, „Rezept tauschen“, Hinweise (Schutzgrenzen in einfachen Worten: „Wir planen nicht unter deinem Grundumsatz.“), Blättern über die Woche.
3. **Ernährung – Woche** (`apps/mobile/src/app/ernaehrung/woche.tsx`): Mo–So × Mahlzeiten, Tagessummen, „Andere Vorschläge“, „Plan aktualisieren“ (nicht sicherheitsrelevante Änderungen ≥ 5 %); sicherheitsrelevante Änderungen planen automatisch neu (6.6).
4. **Rezept** (`apps/mobile/src/app/rezept/[id].tsx`): Titel, Kennzeichnung „KI-Entwurf – fachlich prüfen“ **und bei Entwürfen deutlich „Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden“** (K6), Zeiten, Portion, Zutaten mit Mengen, Ersatz- und Weglass-Hinweise, Schritte, Nährwerte je Portion, „Enthält: …“ (inkl. Kokos) + „Prüfe die Zutatenliste der gekauften Produkte (Spuren).“, Hinweis HFI/Zöliakie, Meal-Prep-Haltbarkeit.
5. **Einkaufsliste** (`apps/mobile/src/app/einkaufsliste/index.tsx`): Abteilungen, Häkchen, „Erledigte ausblenden“, Vorrat eingeklappt, eigener Eintrag, Zeitraum wählen, Offline-Hinweis.
6. **Druckansichten** `apps/mobile/src/app/ernaehrung/drucken.tsx`, `apps/mobile/src/app/einkaufsliste/drucken.tsx` (Abschnitt 11).
7. **Einstellungen** (`apps/mobile/src/app/settings.tsx`): Abschnitt „Ernährung“ (Ernährungsform, Schwein, Vorlieben, Unverträglichkeiten, Mahlzeiten, Kochmodus, Meal-Prep-Slots, Alltag, Trainingszeit, Zahlen anzeigen, optional Zeitlimit werktags), „Essensplan neu erstellen“, Hilfe-Hinweis Essstörungen, Widerrufs-Dialog nach 7.4.

### 8.3 Zustände

Laden; keine Körperdaten (Plan ohne Ziele + Einladung); kein Gesundheits-Check (Hinweis + Knopf, B4); Schwangerschaft (`no_targets`, Hinweis, „Check aktualisieren“); Tag `below_floor` („unvollständiger Vorschlag“); keine passenden Rezepte (Filter benennen); Supabase ohne freigegebene Rezepte (klarer Fehlerzustand, kein Ersatz); Entwürfe im Testmodus gekennzeichnet + Allergen-Warnung (K6); Umwandlung nach Widerruf ausstehend (7.4); offline (Plan und Liste aus dem Speicher, Abhaken geht); Sonderfall-Hinweise; alter Gewichtswert; automatisch angepasster Plan (6.6).

### 8.4 Texte und Barrierefreiheit

Alle Texte Deutsch in `apps/mobile/src/i18n/de.ts` aus festen Bausteinen, Zahlen im deutschen Format („2.150 kcal“, „1,5 EL“). Keine wertenden Wörter über Essen („gut/schlecht“, „Sünde“, „Cheat-Day“). Screenreader-Beschriftung für Häkchen und Makro-Balken; Kontraste nach `DESIGN.md`.

---

## 9. Testmodus vs. Supabase

|                              | Testmodus (zuerst)                                                                                                                                                    | Supabase (Etappe N7)                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Rezepte                      | Bundle, Auswahl über `selectNutritionContent` in der App: Entwürfe erlaubt (ohne rote Befunde, nur katalog-geprüfte Lebensmittel) + gekennzeichnet + Allergen-Warnung | nur `published` (nach Fachprüfung) aus der DB                  |
| Onboarding `nutrition_setup` | angezeigt                                                                                                                                                             | bis N7 ausgeblendet (R2-S3), ab N7 angezeigt                   |
| Ziele                        | auf dem Gerät gerechnet                                                                                                                                               | auf dem Gerät gerechnet (gleicher Core)                        |
| Plan/Liste                   | `localDb`                                                                                                                                                             | `save_meal_plan`/`replace_shopping_list`, geschützter Speicher |
| Widerruf                     | `applyHealthDataRevocation` erweitert (atomar)                                                                                                                        | `consents_after_revoke()` + Ablauf 7.4                         |
| Export                       | Gerätespeicher in derselben Form                                                                                                                                      | `export_my_data()`                                             |
| Premium                      | nie geprüft                                                                                                                                                           | ab Phase 7 (Server)                                            |

---

## 10. Health-Claims-Verordnung und Rechtliches

- **VO (EG) Nr. 1924/2006** und **VO (EU) Nr. 432/2012**: Rezept- und App-Texte enthalten **keine** gesundheitsbezogenen Angaben („stärkt das Immunsystem“, „senkt Cholesterin“, „entgiftet“, „Detox“, „Fatburner“, „Stoffwechsel ankurbeln“, „Superfood“, „basisch“, „Anti-Aging“, „schützt vor“) und **keine nährwertbezogenen Schlagworte** ohne Prüfung („eiweißreich“, „zuckerfrei“, „light“, „ballaststoffreich“). Stattdessen neutrale Zahlen. Die Liste kommt als Ergänzung zu `packages/core/src/content/text-rules.ts` (R10, rot).
- **MDR:** keine Diagnosen, keine Therapie. Die Ernährungsberechnung richtet sich an gesunde Erwachsene. Sonderfälle führen zu „Erhalt“ bzw. „keine Zahlen“ + „ärztlich abklären“, nie zu einer Behandlung.
- **LMIV:** Allergenangaben sind Hilfe, keine Kennzeichnung im Sinne der LMIV → Hinweis „Zutatenliste der Produkte prüfen“; kein Garantieversprechen bei HFI/Zöliakie (5.1.2).
- Hinweis auf jeder Ernährungsseite und im PDF: „Alpha5 ersetzt keine ärztliche oder ernährungsfachliche Beratung.“
- **Nährwert-Quelle mit Lizenzangabe** unter „Lizenzen“ und – falls die Lizenz es verlangt – im PDF-Fuß (S13).
- DSFA ergänzen: Ernährungspläne (7.1), „ohne Schwein“ (R7), Unverträglichkeiten, Schwangerschafts-Ausschlüsse.

---

## 11. PDF P5 (Ernährungsplan und Einkaufsliste, gratis)

- `PrintDocumentKind` + `'nutrition_plan' | 'shopping_list'`; neue Bausteine in `packages/core/src/export/document.ts`: `checklist`, Rezept-Block. Neue `PrintTextCode`s; Renderer `packages/ui/src/print/render-html.ts` nur um die neuen Blöcke erweitert (Escaping/CSP unverändert, B7).
- **Ernährungsplan:** Deckblatt (Logo, „Dein Essensplan“, Woche, optional Name – Standard aus), Wochenübersicht Mo–So × Mahlzeiten (Rezept + Portion; kcal je Tag nur, wenn „Zahlen anzeigen“ an ist und der Tag `complete` ist; `below_floor`-Tage mit Hinweis statt Zahl), danach je Rezept eine halbe bis ganze Seite. Im Modus `no_targets` keine Tagessummen.
- **Einkaufsliste:** nach Abteilungen, zwei Spalten, Kästchen, Vorrat am Ende, **keine** kcal.
- **Nichts Verräterisches (wie B1 beim Training):** keine Ziele „wegen …“, keine Unverträglichkeiten als Grund, kein Gewicht, keine Flags, keine Schwangerschaft, kein Alter. Titel ohne „glutenfrei/laktosefrei“. Hinweis-Dialog vor dem Erzeugen, wenn `uses_health_data`.
- **Bewusste Ausnahme (K4):** Ersatz-Hinweise („mit laktosefreier Milch“), Weglass-Hinweise der Rezepte („Ohne: Walnüsse“, S3; Ergänzung Wächter N6 K6) und das Ersatzprodukt in der Einkaufsliste lassen indirekt auf eine Unverträglichkeit schließen. Das ist unvermeidbar (sonst würde falsch eingekauft) und wird so dokumentiert; der Hinweis-Dialog vor dem Erzeugen erwähnt es.
- Nährwert-Quelle (Namensnennung) im PDF-Fuß, falls die Lizenz es verlangt.
- Knöpfe in Woche und Einkaufsliste; Web-Druckansicht, nativ `expo-print`. CI-Artefakt „pdf-vorschau“ um beide Dokumente erweitert.

---

## 12. Tests (Vitest in Core, Playwright im Testmodus, pgTAP später)

### 12.1 Grundumfang

- **Sehr leicht/schwer:** 30 kg/150 cm, 45 kg/150 cm Frau 25 J. (BMR 1.101,5 → gerundetes Ziel nie < 1.101,5; Ruhetag mit Faktor 1,45), 200 kg/190 cm Mann 60 J. (BMR 2.892,5, Eiweiß über Referenzgewicht ≈ 180 g statt 400 g), 300 kg/250 cm.
- **Alt/jung:** 16 J. (kein Defizit, Eiweiß ≤ 1,6, Hinweis `bmr_estimate_age`), 17 J. 364 Tage → 18 J. am Folgetag, 65 J. (Defizit ≤ 15 %, Eiweiß 1,2–1,6), 79, 95 und 100 J.
- **1 vs. 7 Trainingstage:** Trainingsenergie und Tagesziele tagesgenau, Ruhetag niedriger; 7 × 240 min Ausdauer (Kohlenhydrate-Richtwert, Fett-Untergrenze, Hinweis, `TRAINING_KCAL_DAY_MAX` → Tag ohne Defizit, R2-S8); Erholungswoche; `skipped` = 0.
- **Schutzgrenzen exakt:** Defizit genau 25 % / 25,1 %, Ziel genau BMR / 1 kcal darunter (gerundet gegen ungerundet), −1 %/Woche bei 45 kg und 200 kg, Überschuss-Deckel (abgerundet), EA-Untergrenze, **kein Eingabewert lockert eine Grenze** (Eigenschaftstest über Gewicht 30–300 kg, Größe 100–250 cm, Alter 16–100, alle Ziele, 0–7 Einheiten, alle Alltagsfaktoren, Körperfett 3–60 %, 4b-Versatz ±1.000 kcal); **alle Untergrenzen gegen `TagesbedarfGrenze`** (R2-B1); zusätzlich in jedem Modus **„Ziel ≤ Obergrenze“** und **„Band nicht leer“** (H3, W27).
- **Sonderfälle:** jede Zeile aus 4.9, keine Einwilligung, Körperfett älter als 90 Tage (Mifflin statt Katch), divers/keine Angabe (−78); Abgleich mit `planSafetyRules`.
- **Makros:** |Summe − kcal| ≤ 10 kcal, Untergrenzen Eiweiß/Fett, Kohlenhydrate = Rest mit Hinweis `carbs_below_reference` unter 130 g (R2-K1), Reihenfolge der Absenkung, Nierenhinweis ab > 1,6 g/kg.
- **Timing:** jede Trainingszeit × 1–8 Mahlzeiten, Frühtraining, `varies`.
- **Inhalte:** R1–R19 je mit gültigem und absichtlich verletztem Beispiel (fehlendes Allergen, vegan mit Honig, Makro-Abweichung 11 %, Alkohol, Health Claim, Marke, Nährwert ≠ Quelle, `extract.csv` ohne passende Prüfsumme, Haferflocken ohne `gluten`, Nudeln ohne `gluten`, rohes Ei ohne `pregnancy_caution`, Lebensmittel ohne Katalog-Prüfung, `catalog_reviewed_*` außerhalb `content-review`).
- **Essensplan:** deterministisch, nie Unverträglichkeit/Abneigung/Schwein/`pregnancy_caution` (Eigenschaftstest über alle Kombinationen), Wiederholungsgrenzen, Meal-Prep nie über `fridge_days`, Slot leer mit Grund, `no_targets` = Faktor 1 ohne Zielsummen, Ersatz-Zutat rechnet neu, vergangene Tage unverändert.
- **Einkaufsliste:** Aggregation über Einheiten, Aufrunden, Stück vs. Gramm, Vorrat getrennt, Häkchen bleiben über `item_key`, eigene Einträge, Zeitraum, Ersatzprodukt statt Original, Neuerzeugung nach automatischer Neuplanung („nicht mehr im Plan“, R2-S4).
- **Widerruf:** Pläne mit Gesundheitsbezug weg, Angebot „mag ich nicht“, neuer Plan ohne Ziele; bei Ablehnung der Umwandlung bleibt **nichts** zwischengespeichert (R2-K4).
- **PDF (K4):** Profil mit/ohne Unverträglichkeit/Flag → Dokumente **bis auf Rezeptauswahl sowie Ersatz- und Weglass-Hinweise** identisch (keine Gründe, kein Gewicht, keine Flags, kein Alter); Escaping; Zahlen aus bei `show_energy_numbers = false`; `below_floor`-Tag ohne Zahl.
- **CI-Zusammenfassung:** „Beispiel-Ernährung“ für 7 Testpersonen (A: 80 kg Mann Fettverlust 3 Tage; B: 45 kg Frau; C: 200 kg; D: 16 J.; E: Schwangerschaft → `no_targets`; F: Marathon 6 Tage mit EA-Deckel; G: kein Gesundheits-Check, weiblich; **H: Frau 100 kg, 170 cm, 30 J., KF 50 % → Ruhetag 1.910 kcal, R2-B1**), Abdeckungsbericht Rezepte, Beispiel-Wochenplan + Einkaufsliste mit Planband-Prüfung.

### 12.2 Wächter-Grenzfälle (W1–W16 aus Runde 1, W17–W25 aus Runde 2, W26–W27 aus der N0-Gegenprüfung)

| Nr. | Test                                                                                                                                                                                                                                                                                                                                                                                                                        | Befund     | Etappe              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- |
| W1  | Gerundetes Ziel ≥ ungerundetem BMR bei BMR mit Nachkommastellen (z. B. 1.101,5 → 1.110); Überschuss-Deckel abgerundet                                                                                                                                                                                                                                                                                                       | B2         | N1                  |
| W2  | **Eigenschaftstest über die Ausgabe von `buildMealPlanWeek`:** für jeden Tag mit Status `complete` gilt Tagessumme ∈ Planband (≥ max(BMR-Untergrenze, 25-%-Deckel, Wochendeckel, EA)); jeder Tag darunter hat Status `below_floor` + `day_below_floor`. Raster: 1–8 Mahlzeiten, leere Slots (Fixtures mit leerem Kandidatenpool), Meal-Prep 1–7 Kochtage mit festen Resten, Gewicht 30/45/200/300 kg, alle Ziele, alle Modi | B1         | N3                  |
| W3  | Katch-McArdle bei 3 % und 60 % Körperfett (auch 300 kg/60 %): **alle** Untergrenzen (BMR, 25 %, 1 %/Woche, EA) mit `TagesbedarfGrenze` ≥ Mifflin-Variante; Band bei `maintenance_only` (300 kg/60 %, sehr groß, jung) beginnt nie unter dem Grundumsatz; Körperfett 89/90/91 Tage alt                                                                                                                                       | B3, R2-B1  | N1                  |
| W4  | Kein Gesundheits-Check × jedes Geschlecht (`male` → ≤ 15 %, sonst `maintenance_only` + `pregnancy_caution`-Ausschluss); Schwangerschaft → `no_targets` ohne Zahlen                                                                                                                                                                                                                                                          | B4, B5     | N1/N3               |
| W5  | Energieverfügbarkeit < 30 kcal/kg FFM an einem 240-min-Tag mit Fettverlust → Defizit verkleinert, Hinweis; nie Überschuss erzwungen; FFM-Schätzung ohne Körperfett                                                                                                                                                                                                                                                          | S2         | N1                  |
| W6  | Neueste Körperdaten je Feld aus verschiedenen Zeilen (neueste Zeile nur Gewicht, Größe vor 2 Jahren); Gewicht genau 90/91 Tage alt                                                                                                                                                                                                                                                                                          | S6         | N1                  |
| W7  | Geburtstag mitten in der Woche (18 bzw. 65 J. ab dem Tag, nicht ab Wochenbeginn); Woche mit Sommer-/Winterzeitwechsel (Europe/Berlin); 29. Februar (Geburtstag und Wochentag)                                                                                                                                                                                                                                               | 4.9, 4.10  | N1                  |
| W8  | Erledigte Einheit eines ersetzten Plans + geplante Einheit des neuen Plans am selben Tag (vergangen vs. heute/künftig, keine Doppelzählung); **heute erledigte Einheit des ersetzten Plans, neuer Plan heute ohne Einheit → Trainingsenergie > 0** (R2-K3); `effort_target` 1, 2, 3, 4 und fehlend je Sportart                                                                                                              | S11, R2-K3 | N1                  |
| W9  | Optionale Erdnüsse + Erdnuss-Unverträglichkeit (weglassen, neu rechnen); Haferdrink bei Gluten → raus; laktosefreie Milch bei `dairy` → raus, bei `lactose` → ok; Gelatine bei `eats_pork = false`; Honig nicht vegan; Parmesan (Lab) nicht vegetarisch; Haferflocken → `gluten` (R18)                                                                                                                                      | S3–S5, B6  | N2a/N3              |
| W10 | `eats_pork = null` bei omnivor wird wie „nein“ behandelt                                                                                                                                                                                                                                                                                                                                                                    | S5         | N3                  |
| W11 | Moduswechsel (neues Flag, 18./65. Geburtstag, BMI-Klasse, Check nachgeholt, Widerruf) → automatische Neuplanung ab heute, vergangene Tage unverändert; **Einkaufsliste danach ohne `pregnancy_caution`-Zutat** (R2-S4)                                                                                                                                                                                                      | S7, R2-S4  | N3 (Core), N5 (App) |
| W12 | Widerruf: Umwandlung in „mag ich nicht“ mit vorhandenem „mag ich“ derselben Gruppe; Abbruch offline zwischen Widerruf und Umwandlung → kein Plan ohne Ausschluss; Testmodus atomar                                                                                                                                                                                                                                          | S17        | N4                  |
| W13 | Makro-Rundung nach festgelegter Reihenfolge bei 1.100 kcal und 5.000 kcal: Abweichung ≤ 10 kcal, Untergrenzen Eiweiß/Fett eingehalten; Fall mit Kohlenhydrate-Rest < 130 g → Hinweis statt `ceil` (R2-K1)                                                                                                                                                                                                                   | B2, R2-K1  | N1                  |
| W14 | **Eigenschaftsraster** Sonderfälle: alle Flags (inkl. kein Check) × Alter 16/17/18/64/65/100 × BMI 16,9/17/18,4/18,5/19,9/20/30 × alle Ziele × alle Geschlechter → strengste Regel gewinnt immer, Ziel im erlaubten Bereich                                                                                                                                                                                                 | 4.9        | N1                  |
| W15 | Meal-Prep mit `mealprep_days = 1` ohne `freezable`-Kandidaten → Tage jenseits der Haltbarkeit frisch gekocht; Reis/Fisch/Hack/Geflügel mit `max_fridge_days = 1`                                                                                                                                                                                                                                                            | S12        | N3                  |
| W16 | `db-sync`: `ONBOARDING_STEPS` mit `nutrition_setup` = CHECK-Liste in derselben Etappe (N4); neue Enums erst in N7 gleichzeitig in `enums.ts` und Migration                                                                                                                                                                                                                                                                  | S8         | N4, N7              |

| **W17** | **Rechenbeispiel R2-B1** wörtlich: Frau 100 kg/170 cm/30 J./KF 50 %/sitzend/Ruhetag/`fat_loss` → Ziel **1.910 kcal** ≥ 0,75 × 2.539,675 (Mifflin-Gesamtumsatz); Zwischenwerte 1.751,5 / 1.450 / 2.102,5 / 1.682 / 1.904,756 / 1.439,675 / 1.614,7. **Eigenschaftstest:** Körperfett 3–60 % × Gewicht 30–300 kg × Größe × Alter × alle Ziele × 0–7 Einheiten → kein Ziel und keine Band-Untergrenze liegt mehr als 25 % unter dem Gesamtumsatz nach Mifflin **oder** nach Katch-McArdle, und keines mehr als 1 % KG/Woche darunter | R2-B1 | N1 |
| **W18** | `sources-integrity`: `extract.csv` verändert, ohne dass die Prüfsumme in `SOURCE.json` passt → rot; Prüfsumme mit angepasst, aber Zeile nicht in der Original-Datei (geänderter Wert) → rot; Änderung unter `content/sources/**` in einem PR außerhalb `foods-import/<run-id>` → rot; **Branch `foods-import/x` mit gefälschtem Bot-Autor (nicht „verified“) → rot**; **URL in `SOURCE.json` geändert (nicht in der Allowlist von `main`) → rot**; Original-Datei und `original_sha256` im selben PR gemeinsam geändert → rot (Neuladen von `main`-URL); unveränderter Workflow-Auszug → grün | R2-B2 | N2b |
| **W19** | R18: jede Regel zeigt auf eine `FOOD_GROUPS`-ID, alle 23 Gruppen haben einen Eintrag (Typ + Laufzeit); Nudeln/Brot/Mehl/Paniermehl → `gluten`; Reis/Weizen/Fleisch/Eisbergsalat ≠ `eggs`; Kokosmilch/Erdnussbutter/Kakaobutter/Sojasahne ≠ `dairy`; Tintenfisch → `shellfish`, ≠ `fish`; Schafskäse ≠ `lamb`; Muskatnuss/Kokosnuss ≠ `tree_nuts`; Hähnchen → `poultry`, Linsen → `legumes`, Champignon → `mushrooms`, Weinessig → `sulphites`; Abgleich aller ~150 Lebensmittel mit der Erwartungsliste (N2b) | R2-B3, R2-S1 | N2a (Regeln), N2b (Katalog) |
| **W20** | Rezept mit rohem Ei (`heated: false`, z. B. Tiramisu/Mayonnaise) → `pregnancy_caution`; `no_cook`-Rezept mit Räucherlachs → `pregnancy_caution`; gebackenes Ei → nicht; `declared_pregnancy_caution` ≠ berechnet → R13 rot; Lebensmittel Rohmilchkäse/Salami/Leber ohne Flag → R18 rot | R2-S2 | N2a |
| **W21** | Supabase-Modus (`nutritionSetupAvailable` nicht gesetzt): `nutrition_setup` bis N7 **nicht anwendbar**, `applicableSteps` ohne den Schritt, `resumeStep` springt weiter; Testmodus: anwendbar | R2-S3 | N4 |
| **W22** | Automatische Neuplanung (Schwangerschaft gesetzt, neue Unverträglichkeit) erneuert die Einkaufsliste im selben Schritt: Häkchen über `item_key` erhalten, weggefallene abgehakte Einträge „nicht mehr im Plan“, weggefallene offene entfernt, eigene Einträge unverändert | R2-S4 | N3 (Core), N5 (App) |
| **W23** | 4b-Versatz −1.000 kcal führt an jedem Tag, an dem **schon ohne Versatz** eine Untergrenze greift, zum **selben** Ziel wie ohne Versatz; an allen anderen Tagen gilt Ziel ≥ Untergrenze (H3). `clampCalorieAdjustment` begrenzt nur Schrittweite (genau 150 / 151 kcal) und Summe (genau ±1.000 / darüber) und hat keinen Grenzen-Kontext | R2-S5 | N1 |
| **W24** | `selectNutritionContent`: Entwurf mit nicht katalog-geprüftem Lebensmittel → nicht im Testmodus-Bestand; Entwurf mit rotem Befund → nicht drin; geprüfter Entwurf ohne roten Befund → drin (gekennzeichnet); `allowDrafts: false` → nur `published` | R2-S6 | N2a (Funktion), N2c (Bundle) |
| **W25** | Band bei `maintenance_only` mit 16 J.: Obergrenze ≤ +5 % über `TagesbedarfGrenze`, Untergrenze ≥ `max(dayFloorKcal, TagesbedarfGrenze)`; 16 J. mit `general_fitness` ebenfalls ≤ +5 %; Tag mit gedeckelter Trainingsenergie (`TRAINING_KCAL_DAY_MAX`) ohne Defizit + Hinweis `training_energy_capped` | R2-S7, R2-S8 | N1 |
| **W26** | `surplusCap` ist für jede Kombination aus Ziel, Flags, Alter und Geschlecht gesetzt und liegt in [0,05; 0,10]; Erwachsener mit `fat_loss` ohne Sonderfall → 0,10; unter 18 bzw. ohne Check → 0,05; Band bei `maintenance_only` hat Breite ≥ 0,05 × `TagesbedarfGrenze` (nie ein Punkt) | H2 | N1 |
| **W27** | Eigenschaftstest mit 4b-Versatz ±1.000 kcal über alle Modi und Ziele: **Ziel ≤ `dayCeilingKcal`** und **Band nicht leer**; Beispiel 16 J. mit `general_fitness` und +1.000 kcal → Ziel ≤ `TagesbedarfGrenze` × 1,05 | H3 | N1 |

Zusätzlich: K9 (Unverträglichkeit + „mag ich“ derselben Gruppe → ausgeschlossen, N3), R17 (Nährwert ≠ Quellauszug → rot, N2b), R2-K6 (`catalog_reviewed_*` außerhalb `content-review` gesetzt → rot, N2b), R2-K4 (Widerruf ohne Zustimmung zur Umwandlung → nichts zwischengespeichert, N4).

---

## 13. Etappen (je ein Pull Request, jede mit Wächter-Prüfung, Testmodus zuerst)

**N0 – Plan.** Dieses Dokument als `docs/PLAN-PHASE-5.md`; PROMPTS-Status; **im 4b-Plan nachtragen (S10, R2-S5):** `nutrition/limits.ts` kommt aus Phase 5; `clampCalorieAdjustment(currentOffsetKcal, proposedOffsetKcal)` begrenzt **nur** Schrittweite und Summe des Versatzes; 4b-Anpassungen fließen als `adjustmentKcal` in `nutritionTargetsForWeek` und laufen immer durch `clampCalorieTarget` (einzige Stelle mit Schutzgrenzen) – die Liste „Grenzen“ in PLAN-PHASE-4B 5.2 wird entsprechend umformuliert. Entscheidung S8 (CHECK-Migration in N4) und R2-S3 (Schritt im Supabase-Modus bis N7 ausgeblendet) festhalten. **Gegenprüfung der R2-Blocker im N0-PR** (R2-B1 `TagesbedarfGrenze` + Rechenbeispiel, R2-B2 Herkunft des Quellauszugs, R2-B3 Gruppen-IDs/Regeltabelle) – kurz durch den Wächter, keine volle Runde. _DoD:_ Gegenprüfung bestanden, offene Fragen 16 B beantwortet oder Empfehlung gilt.

**N1 – Core: Bedarf, Grenzen, Makros, Timing.** **Vorher:** Compendium-Codes (S11c), Koletzko 2018 (B5), Janmahasatian 2005 und Loucks/Mountjoy (S2, inkl. brutto/netto der Trainingsenergie in der EA-Formel, R2-K2) gegen das Original prüfen. `energy.ts`, `body-data.ts`, `limits.ts` (inkl. Planband, gerichteter Rundung, `clampCalorieAdjustment`), `eligibility.ts`, `macros.ts`, `timing.ts`, `targets.ts`, `notices.ts`, Schemas, Konstanten mit Quellen, CI-Tabelle „Beispiel-Ernährung“. Keine Migration, keine App. _DoD:_ Tests 12.1 (Bedarf/Grenzen/Sonderfälle/Makros/Timing) + W1, W3–W8, W13, W14, **W17, W23, W25, W26, W27**; CI-Person H (R2-B1); KONZEPT 6 „Umsetzung ab Phase 5“.

**N2a – Inhalte: Schemas, Prüfregeln, Einheiten** (kann parallel zu N1). `food-schema.ts`, `recipe-schema.ts`, `recipe-checks.ts` (R1–R19), `allergen-rules.ts`, `recipe-nutrients.ts` (inkl. `pregnancy_caution` aus `heated`/`no_cook`, R2-S2), `units.ts`, **`selectNutritionContent`** (R2-S6), Health-Claims-Liste, `FOOD_GROUPS`-Text Gluten, **R18-Regeltabelle für alle 23 Gruppen** (5.1.3, R2-B3), **Test-Fixtures** (kleiner Katalog + Rezepte, auch absichtlich fehlerhafte). _DoD:_ jede Regel mit gültigem/verletztem Fixture, W9 (Regelteil), **W19 (Regeln), W20, W24 (Funktion)**.

**N2b – Lebensmittel-Katalog aus der Quelle** (Voraussetzung: Lizenz geklärt, S13). GitHub Action `foods-import.yml` (manuell) mit `extract-source.ts` und `import-source.ts`: lädt die Original-Datei von der amtlichen Adresse, schreibt `SOURCE.json` (URL, Version, SHA-256 von Original und Auszug), filtert ohne Wertänderung und öffnet den PR (R2-B2); CI-Job `sources-integrity` (Neuladen mit URL aus `sources.ts` von `main`, nur „verified“ Bot-Commits, H1); Lizenz/Namensnennung eingecheckt; ~150 Lebensmittel (Zuordnung aus Claude-Sitzung, Nährwerte maschinell, **`extract.csv` nie von Hand oder per Claude-Sitzung**), Erwartungsliste `allergen-expectations.json`, R17/R18 in CI, Option **„Katalog geprüft“ im Workflow `content-review`** (R2-K6), **menschliche Katalog-Prüfung mit Checkliste** (R19, inkl. `pregnancy_caution`) durch die Gründer. **Aufgabe für die Gründer (H1):** Klick-Schritte im mobilen Browser für (1) Ruleset „nur GitHub Actions darf auf `foods-import/*` pushen“ und (2) CODEOWNERS-Pflichtfreigabe für `content/sources/**` und die drei Import-Dateien (GitHub → Repository → Settings → Rules → Rulesets bzw. Branch-Schutz „Require review from Code Owners“) – kommen in `docs/SETUP.md`. _DoD:_ R17/R18/`sources-integrity` grün, alle Lebensmittel `catalog_reviewed` über `content-review`, **W18 (inkl. gefälschter Bot-Autor und geänderte URL), W19 (Katalog)**, Ruleset + CODEOWNERS eingerichtet, „Lizenzen“-Eintrag.

**N2c – Rezepte als Entwurf.** ~60 Rezepte `draft` (mit `heated` je tierischer Zutat und `declared_pregnancy_caution`), `FOLDERS` in `bundle-content.mjs` und `CONTENT_FOLDERS` in `packages/content/src/validate.ts` um `foods`/`recipes` erweitert, Auswahl in der App über `selectNutritionContent` (R2-S6), Abdeckungsbericht. _DoD:_ `content:validate` grün, Abdeckungsbericht in CI, W24 (Bundle).

**N2d – Admin-Seiten** `admin/rezepte`, `admin/lebensmittel` (nur ansehen, Checkliste Katalog-Prüfung anzeigen). Kann mit N4 zusammengelegt werden. **Umgesetzt 13.10.2026** (mit `admin/meal-prep`, `admin/ratgeber` und Sammelfreigabe 19.5; Umsetzungsstand N2d).

**N3 – Core: Essensplan und Einkaufsliste.** Braucht N1 + N2a (Fixtures), nicht den ganzen Bestand. `filter.ts`, `scale.ts`, `meal-plan.ts`, `meal-prep.ts`, `replan.ts`, `shopping-list.ts`, `stable-hash.ts`, `mealPlanPayloadSchema`; CI „Beispiel-Woche + Einkaufsliste“ (mit echtem Katalog, sobald N2b/N2c da sind). _DoD:_ Tests 12.1 (Plan/Liste) + **W2** (Planband-Eigenschaftstest über `buildMealPlanWeek`), W9–W11 (Core), W15, **W22 (Core)**, K9.

**N4 – App Testmodus: Einrichtung, Tag, Rezept.** Onboarding-Schritt `nutrition_setup` **+ kleine CHECK-Migration** (S8) **+ `nutritionSetupAvailable` (nur Testmodus, R2-S3)**, Karte auf „Heute“, Ernährung-Tag, Rezeptansicht (inkl. Allergen-Warnung bei Entwürfen), Einstellungen Ernährung, `local-backend`/`types.ts`/`write-ops.ts`, Widerrufs-Dialog und Ablauf 7.4, Export. _DoD:_ Playwright: Onboarding → Ziel sichtbar → Rezept öffnen → Zahlen ausblenden; Widerruf mit Angebot (W12); kein Check → Hinweis; alle Zustände; Screenshots hell/dunkel; W16 und **W21** grün; Widerruf ohne Zustimmung → nichts zwischengespeichert (R2-K4). **Hinweis aus Wächter N1 (K7):** Der Schritt `nutrition_setup` fragt die Alltagsaktivität wirklich ab (ohne Angabe gilt 1,45 – der niedrigste Faktor unterschätzt aktive Menschen); Körperdaten-Datum höchstens heute + 1 Tag (die Engine ignoriert Zeilen nach `today`, K3).

**N5 – App Testmodus: Woche, Tauschen, Einkaufsliste** (geteilt in **N5a** Woche/Tauschen/Neuplanung und **N5b** Einkaufsliste/Meal-Prep-Kochtag, siehe Umsetzungsstand N5a). Wochenansicht, „Andere Vorschläge“, „Rezept tauschen“, Meal-Prep-Kochtag, Einkaufsliste mit Abhaken offline, eigene Einträge, „Plan aktualisieren“, automatische Neuplanung (6.6). _DoD:_ Playwright inkl. `setOffline`, Häkchen nach Neu laden erhalten, Meal-Prep-Woche, vegan + Unverträglichkeit, Schwangerschaft gesetzt → Plan **und Einkaufsliste** automatisch angepasst (W11, **W22 App**).

**N6 – PDF P5.** Dokumentmodell, Renderer-Blöcke, Druckansichten, Knöpfe, nativer Druck. _DoD:_ PDF-Tests aus 12.1 (inkl. K4-Formulierung), CI-Artefakt, EAS-Build Android geprüft.

**N7 – Supabase.** _Teil 1 (Datenbank) umgesetzt am 14.10.2026, Teil 2 (App, `content-seed`) umgesetzt am 16.10.2026 – siehe Umsetzungsstand N7 und N7 Teil 2._ Migrationen (Enums eigene Datei + `enums.ts`; Inhaltstabellen + `seed_content`; `nutrition_prefs`-Spalten **+ `nutritionSetupAvailable` im Supabase-Backend auf `true`** (R2-S3); `meal_plans`/`items`/`shopping_*` mit RLS, Spaltenrechten, Indizes; RPCs 7.3 inkl. Faktor-≠-1-Prüfung; Widerruf; Export), pgTAP 23–26 + Ergänzungen, `database.types.ts`, `db-sync.test.ts`, `supabase-backend.ts`, Sync-Warteschlange, geschützter Speicher. **Vorher: Fachprüfung durch eine Ernährungsfachkraft** (Gründer-Entscheidung 6). _DoD:_ `db-test` grün, Live-Test mit zwei Geräten; **Zitat- und Wertprüfung gegen die Originale** (Compendium-Codes/MET-Werte, Koletzko 2018, Janmahasatian 2005, Loucks 2011 brutto/netto, BfR-Koffein, Katch-McArdle, D-A-CH-PAL, Iraki 2019) erledigt und alle „VOR LIVEGANG FACHLICH PRÜFEN“-Stellen in `constants.ts` aufgelöst (aus N1 verschoben, Wächter N1 K6). **Erst wenn echte Konten kommen.** **Zusätzlich (Wächter N2d K9):** Rezept-Seed und Supabase-Tabelle transportieren `ingredients`, `steps_de`, `tip_de`, `no_cook`, Zeiten, `equipment_de`, Titel/Beschreibung und `meta.import_assumptions*` **unverändert** (fehlt `meta`, gälte der Stand als „none“ = unsichere Richtung); ein `db-sync`-/pgTAP-Test vergleicht `importAssumptionsState` vor und nach dem Seed. **Zusätzlich (Wächter N5a S4):** `meal_plans`/`meal_plan_items` speichern weder Planband noch `safetyKey`; 6.6 wird dafür ohne diese Felder umgesetzt. **Zusätzlich (N11):** Packungsgrößen kommen als Inhalt aus `content/package-sizes/` (nur `published`, R24 grün) über `seed_content()` in die Spalte `foods.package_size_g` (bzw. eine Tabelle `food_package_sizes` mit Prüfvermerk, Entscheidung beim Bau von N7) – `content/foods/` bleibt allein `foods-import` vorbehalten (S3); keine Nutzerdaten, keine Tabelle für die Kühlschrank-Suche (die Auswahl wird nie gespeichert). **Zusätzlich (Wächter N10 H8):** `food_dislikes` **ohne** `created_at`/Zeitstempel (sonst ließe sich ein „Daumen runter“ ohne Grund vom selben Tag auf „Unverträglich“ zurückführen); der Leer-Grund `rated_down` (`SLOT_EXCLUSION_REASONS`) wird in `mealPlanPayloadSchema`/`save_meal_plan` zugelassen; `recipe_ratings` mit CHECK `reason in ('taste','effort','cost','satiety')` und CHECK `reason is null or value = 'down'`, Unique `(user_id, recipe_id)`. **Zusätzlich (N13):** keine neue Tabelle oder Spalte – die Resteplanung braucht nur die Packungsgrößen aus N11 (s. o.); geteilte Portionen mit eigenem Beilagen-Faktor werden erst mit P1 (Phase 11) gespeichert, bis dahin bleibt `meal_plan_items` bei einem Faktor je Mahlzeit (die bestehende Prüfung „Faktor ≠ 1 ohne Einwilligung → abgelehnt“ gilt unverändert). **Zusätzlich (N14):** keine neue Tabelle oder Spalte – die Hinweise „Nutzt deinen Rest“ werden aus dem gespeicherten Plan und den Packungsgrößen nachgerechnet, nie gespeichert; Reste aus der Vorwoche (G-N13-5) bräuchten eine Speicherung und sind nicht umgesetzt. Mit Phase 7: `has_entitlement` für die Resteplanung (Premium, 19.9) – serverseitig nur prüfbar, soweit der Server den Plan selbst nachrechnet (Vormerkung).

**N8 – Batch-Pipeline Rezepte (optional, später).** `kinds/recipe.ts` (Matrix, Prompts, Structured Output nur mit Katalog-IDs), Probelauf ohne Schlüssel, `content-generate`/`collect` mit `ANTHROPIC_API_KEY`. _DoD:_ Probelauf grün, Kostenschätzung, PR mit Entwürfen. **→ Umgesetzt am 15.10.2026 mit Google Gemini statt Claude (Gründer-Entscheidung 14.10.2026, Secret `GEMINI_API_KEY`) – siehe Umsetzungsstand N8.**

**Reihenfolge:** N0 → N1 (‖ N2a) → N2b → N2c → N3 → N4 (+ N2d) → N5 → N6; N7 und N8 später. **Ergänzt am 11.10.2026 (Abschnitt 19):** danach N9 → N10 → N11 → N12 → N13 → N14; W1 mit Phase 10, P1 mit Phase 11. „Parallel zu N1“ gilt nur für N2a. N3 kann mit Fixtures schon nach N1 + N2a beginnen; die CI-Beispielwoche mit echtem Katalog folgt, sobald N2c fertig ist.

### Erweiterung Phase 5 (nur Skizze, spätere Etappen)

- **X0 Entscheidung** „Marken oder nur Produktarten“ (Empfehlung: nur Produktarten) und juristische Klärung, ob `food_log_entries` eine `health_data`-Einwilligung braucht (Empfehlung: ja, vorsorglich).
- **X1 Barcode + Open Food Facts:** `food_products`, Abruf über `apps/web`-Route mit Zwischenspeicher, Quellenangabe „Daten von Open Food Facts (ODbL)“, Kamera-Berechtigungstext. **→ Etappe E4 (`docs/PLAN-E4.md`); E4a (Nummer eintippen, ohne Kamera) umgesetzt am 17.10.2026**, Kamera folgt mit E4b.
- **X2 Ernährungstagebuch:** `food_log_entries`, Tagesziel aus N1 gegen Gegessenes, Favoriten, „Gegessen“ per Tipp, Offline-Warteschlange. **→ Umgesetzt als Etappe E1 (15.10.2026, `docs/PLAN-AUSWERTUNG.md` Abschnitt 5 und Umsetzungsstand E1):** Tagebuch mit „Gegessen“ per Tipp, Katalog, Rezept, Schnelleintrag, Zuletzt/Favoriten im Testmodus; Datenbank (`food_log_entries`, `food_log_favorites`, `save_food_log_entries`, `delete_food_log_entry`, Widerruf, Export) fertig, App im Supabase-Modus mit N7 Teil 2. Der Abgleich Tagesziel gegen Gegessenes kommt mit A2. X0: Einwilligung `health_data` entschieden (A-G12); X1 → E4, X3 → E2.
- **X3 Standardgerichte:** `custom_meals`, `custom_meal_items`. **→ Umgesetzt als Etappe E2 (15.10.2026,
  `docs/PLAN-AUSWERTUNG.md` Abschnitt 7 und Umsetzungsstand E2):** eigene Gerichte direkt oder aus Zutaten, Eintragen
  mit Portion ¼–3 als Schnappschuss (fester Titel „Eigenes Gericht“ + Verweis), Testmodus fertig; Datenbank
  (`custom_meals`, `custom_meal_items`, `save_custom_meal`, Widerruf, Export) fertig, App im Supabase-Modus mit N7 Teil 2.
- **X4 Gerichte vor/während/nach dem Training (Premium, ohne KI):** Zielmengen je Zeitfenster aus `timing.ts`, 2–3 Vorschläge (im Planband skaliert), Push-Erinnerungen, Premium-Prüfung serverseitig.

---

## 14. Definition of Done (gesamt, CLAUDE.md)

1. Typen + Zod-Schemas (Eingaben, Inhalte, Payloads). 2. Migration mit RLS (N7; in N4 nur CHECK). 3. Core-Logik mit Tests inkl. Grenzfällen (sehr leicht/schwer, 16/95 J., 1 vs. 7 Trainingstage, alle Sonderfälle, Schutzgrenzen als Eigenschaftstest **für Ziel und ausgelieferten Plan**, W1–W27). 4. UI mobil + Web. 5. Leer-/Fehler-/Lade-/Offline-Zustände. 6. Texte Deutsch, keine Heil- oder Nährwertversprechen. 7. `docs/` aktualisiert: KONZEPT 6 (Umsetzung), 12 (Abweichungen, Server-Entscheidung S9 **inkl. `pregnancy_caution` nur im Core, R2-K8**), 13 (Gratis/Premium nach Gründer-Entscheidung 1), 14 (Health Claims, Nährwert-Lizenz, DSFA); PROMPTS (Status); HANDY-ANLEITUNG („Ernährung testen“); PLAN-PDF-EXPORT (P5); PLAN-PHASE-4B (`limits.ts`, S10); Umsetzungsstand in diesem Plan.
   Zusätzlich: Schutzgrenzen nicht abschaltbar (Test), keine Gesundheitsdaten in Logs/Analytics, Nährwerte nur maschinell aus der Quelle (R17, Auszug nur aus `foods-import`, R2-B2), kein Zufall im Plan.

---

## 15. So testest du es am Handy

**N1:** Pull Request → **Checks → ci → Summary** → Tabelle „Beispiel-Ernährung“. Prüfen: Person B (45 kg) liegt nie unter ihrem Grundumsatz; Person D (16 J.) hat kein Defizit; **Person E (Schwangerschaft) hat keine Kalorienzahl**, nur den Hinweis; Person F hat an langen Lauftagen mehr Kohlenhydrate und den Hinweis zur Energieverfügbarkeit; Person G (kein Check, weiblich) hat kein Defizit und den Hinweis „Gesundheits-Check machen“; **Person H (Frau 100 kg, Körperfett 50 %) hat am Ruhetag 1.910 kcal** (nicht 1.760).

**N2a–N2c:** Summary → „Rezept-Prüfbericht“, „Quellabgleich Lebensmittel“ und „Abdeckung“. In der GitHub-App ein Lebensmittel (`content/foods/…json`) öffnen → `source` mit Quell-ID und Lizenz; ein Rezept (`content/recipes/…json`) → Zutaten, Kennzeichnung „KI-Entwurf“. Für N2b: **Actions → foods-import → Run workflow** startet den Import (Ergebnis kommt als Pull Request; im PR-Text stehen Quelle, Version und Prüfsummen). Katalog-Prüfung: **Actions → content-review → Run workflow → „Katalog geprüft“** (R2-K6).

**N3:** Summary → „Beispiel-Woche“ (jeder Tag „vollständig“ oder deutlich „unvollständig“) und „Beispiel-Einkaufsliste“ (vegan + Meal-Prep 2×).

**N4–N6 (Testmodus, kein Supabase):** Vorschau-Link aus dem Pull Request öffnen. Schon einmal durchgeklickt? **Einstellungen → Testdaten löschen**.

1. „Ohne Konto testen“ → Onboarding mit Einwilligung, **Geschlecht weiblich** (sonst fehlt in Schritt 7 die Schwangerschafts-Frage, R2-K5), 70 kg, Ziel Fettverlust, 3 Kraft-Tage, **vegetarisch**, „mag ich nicht: Pilze“, 4 Mahlzeiten, Meal-Prep 2× → neuer Schritt „Alltag/Trainingszeit: abends“.
2. „Heute“ → Karte „Essen heute“: an Trainingstagen mehr kcal als an Ruhetagen; Abendessen = „nach dem Training“.
3. „Ernährung“ → Rezept öffnen → Portion skaliert, „Enthält …“, Warnhinweis „Allergene noch nicht fachlich geprüft“, keine Pilze, kein Fleisch.
4. Woche → „Rezept tauschen“ und „Andere Vorschläge“ → neu laden → gleicher Plan.
5. Einkaufsliste → **Flugmodus an** → Häkchen setzen → neu laden → Häkchen bleiben; eigener Eintrag „Kaffee“.
6. Einstellungen → „Kalorienzahlen anzeigen“ aus → überall nur noch Mahlzeiten ohne Zahlen.
7. Gesundheits-Check „schwanger“ = ja → Plan passt sich **automatisch** an: keine Kalorienzahl, Hinweis Ärztin/Arzt/Hebamme, keine Rezepte mit rohem Fisch/Ei; **Einkaufsliste** enthält keine dieser Zutaten mehr, abgehakte weggefallene Einträge zeigen „nicht mehr im Plan“.
8. Einwilligung Gesundheitsdaten widerrufen → Hinweis zu Unverträglichkeiten und eigenen Listeneinträgen + Angebot „mag ich nicht“ → Plan ohne Kalorienziel.
9. (N6) „Als PDF speichern“ in Woche und Einkaufsliste → Android: Drucken → „Als PDF speichern“; iPhone: Teilen-Symbol im Druckdialog → „In Dateien sichern“. Prüfen: Logo, keine Gründe/kein Gewicht, Kästchen in der Liste.

**N7 (später):** Workflow `db-test` grün; danach mit echtem Konto Schritte 1–8 auf zwei Handys.

---

## 16. Fragen an die Gründer

### 16 A – Entschieden (09.10.2026, „alles wie empfohlen“)

| Nr. | Frage                                                                             | Entscheidung                                                                                                                                      | Hinweis aus der Wächter-Prüfung                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Essensplan + Einkaufsliste gratis oder Premium?                                   | Bedarf, Makros, Timing, Rezepte **gratis**; Essensplan + Einkaufsliste in der Testphase für alle offen, endgültig mit **Phase 7**; **PDF gratis** | Folgefrage 16 B (g)                                                                                                                                                     |
| 2   | Nährwert-Quelle                                                                   | offene amtliche Datenbank, nie KI-Werte, jede Zeile mit Quelle                                                                                    | jetzt **maschineller Import + CI-Abgleich** (B6); Lizenz vor N2b (16 B (f))                                                                                             |
| 3   | Unter 18                                                                          | nur Erhalt, **kein Defizit**, Überschuss ≤ 5 %                                                                                                    | –                                                                                                                                                                       |
| 4   | Schwangerschaft/Stillzeit                                                         | Gründer: „nur Erhalt + Hinweis“ → **jetzt Modus `no_targets`** (B5)                                                                               | **Sicherere Präzisierung** der Gründer-Empfehlung: „Erhalt“ ohne Zuschläge wäre fachlich ein Defizit. Eigene Stillfrage mit der nächsten Fassung des Gesundheits-Checks |
| 5   | Essstörungen                                                                      | keine Abfrage; Hinweis für alle + Schalter „Kalorienzahlen ausblenden“; Hilfe-Nummern DE/AT/CH vor Veröffentlichung prüfen                        | Standard des Schalters: 16 B (h)                                                                                                                                        |
| 6   | Neuer Schritt `nutrition_setup` (Alltag, Trainingszeit)                           | ja                                                                                                                                                | Faktoren jetzt Mitte der Spanne, ohne Angabe 1,45 (S1, 16 B (d))                                                                                                        |
| 7   | Defizit/Überschuss je Ziel                                                        | −20 / −10 / +10 bzw. +5 / 0 / 0 %, fachlich prüfen                                                                                                | jetzt vom Grundbedarf **ohne** Training (S2)                                                                                                                            |
| 8   | „Mag ich nicht“                                                                   | **harter Ausschluss**                                                                                                                             | –                                                                                                                                                                       |
| 9   | Vorsichtige Grenzen Medikamente/Arzt-Hinweis/ab 65 (≤ 15 %), BMI 18,5–20 (≤ 10 %) | ja                                                                                                                                                | + Eiweiß ≤ 1,6 g/kg bei Medikamenten (S16)                                                                                                                              |
| 10  | Meal-Prep-Slots                                                                   | wählbar, Standard Mittag                                                                                                                          | –                                                                                                                                                                       |
| 11  | Startbestand ~150/~60                                                             | ja, danach Batch-Pipeline                                                                                                                         | Katalog-Import vor Rezepten (S14)                                                                                                                                       |
| 12  | Packungsgrößen/Reste                                                              | später                                                                                                                                            | –                                                                                                                                                                       |
| 13  | Budget/Zubereitungszeit                                                           | kein Budget; optional „werktags höchstens X Minuten“                                                                                              | –                                                                                                                                                                       |
| 14  | Essenspläne als Gesundheitsdaten                                                  | ja (7.1)                                                                                                                                          | + `no_targets` mit Schwangerschafts-Ausschlüssen ebenfalls                                                                                                              |
| 15  | Fachprüfung durch Ernährungsfachkraft                                             | **vor dem Livegang**; Testphase mit gekennzeichneten Entwürfen                                                                                    | Entwürfe nur mit katalog-geprüften Lebensmitteln + Allergen-Warnung (B6d, K6)                                                                                           |
| 16  | Kalorien im PDF                                                                   | nur Tagessummen, nur bei „Zahlen anzeigen“                                                                                                        | nicht bei `below_floor`/`no_targets`                                                                                                                                    |
| 17  | Katch-McArdle nur mit Körperfett ≤ 90 Tage                                        | ja                                                                                                                                                | **nur für den Vorschlag; alle Untergrenzen mit max(Mifflin, Katch)** (B3, R2-B1)                                                                                        |
| 18  | Marken                                                                            | nur Produktarten                                                                                                                                  | –                                                                                                                                                                       |

### 16 B – Neu aus der Wächter-Prüfung (S18) – entschieden (10.10.2026, „Alles wie empfohlen“)

Die Gründer haben am 10.10.2026 zu allen Fragen (a)–(m) „Alles wie empfohlen“ gesagt. **Jede Empfehlung ist damit entschieden**; bei (l) gilt sie als Vorgabe für die endgültige Entscheidung mit Phase 7.

- **(a) Kein Gesundheits-Check (B4):** _Empfehlung:_ vorsichtig wie beim Training – Defizit ≤ 15 %, Überschuss ≤ 5 %, Eiweiß ≤ 1,6 g/kg; bei Geschlecht ≠ männlich bis zum Check `maintenance_only` + Ausschluss `pregnancy_caution`; Hinweis „Gesundheits-Check machen“. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(b) Schwangerschaft = `no_targets` und Gültigkeit des Flags (B5):** _Empfehlung:_ `no_targets` wie in 4.9; mit der nächsten Fassung des Gesundheits-Checks eigene Frage „Stillst du?“ und **Erinnerung zur Aktualisierung alle 6 Monate, solange das Flag gesetzt ist** (sonst spätestens nach 12 Monaten erneut fragen). Bis dahin fester Hinweis „Gesundheits-Check aktualisieren“ in der Ernährung. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(c) Energieverfügbarkeit (S2):** _Empfehlung:_ Defizit/Überschuss vom Grundbedarf ohne Training, Training voll obendrauf, Untergrenze EA ≥ 30 kcal/kg FFM (begrenzt nur das Defizit). — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(d) Alltagsfaktor (S1):** _Empfehlung:_ Mitte der Spannen 1,45/1,65/1,85/2,2, ohne Angabe 1,45 mit ehrlichem Vermerk. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(e) Katch-McArdle (B3, R2-B1):** _Empfehlung:_ für den Vorschlag behalten (nur Körperfett ≤ 90 Tage), für **alle** Schutzgrenzen (Grundumsatz, 25 %, 1 %/Woche, Energieverfügbarkeit, Erhalt) immer max(Mifflin, Katch). Nicht streichen, weil sie bei sehr muskulösen Menschen den Bedarf besser trifft. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(f) Lizenz und Importweg (S13/B6):** _Empfehlung:_ BLS als Hauptquelle, **wenn** die Lizenz der aktuellen Version Weiterverbreitung im App-Bundle erlaubt (vor N2b schriftlich prüfen); sonst Schweizer Nährwertdatenbank. USDA nur, wenn beide ausfallen. Import per Skript + GitHub Action, Quellauszug im Repository, **nur vom Workflow erzeugt** (R2-B2). Die **ganze Original-Datei** wird nur eingecheckt, wenn die Lizenz das erlaubt; sonst lädt CI sie zur Prüfung neu (Prüfsumme in `SOURCE.json`). — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).** **Lizenz geklärt (11.10.2026, N2b):** BLS 4.0 ist Open Data unter **CC BY 4.0** (Namensnennung Max Rubner-Institut) – Weiterverbreitung im Repository und App-Bundle erlaubt; Quellen im Umsetzungsstand N2b.
- **(g) PDF gratis vs. Essensplan Premium:** _Empfehlung:_ Das PDF ist **kein eigenes Bezahlmerkmal** – wer einen Essensplan sehen kann, kann ihn auch kostenlos drucken. Wird der Essensplan mit Phase 7 Premium, bekommen Gratis-Nutzer statt eines leeren PDFs ein PDF „Dein Bedarf + Rezeptsammlung“ (gratis-Inhalte). Endgültig mit Phase 7. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(h) Standard „Kalorienzahlen anzeigen“:** _Empfehlung:_ **an** (Kern der Funktion), mit gut sichtbarem Schalter und Hinweis bei der Einrichtung. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(i) Rezept-Entwürfe im öffentlichen Vercel-Testmodus:** _Empfehlung:_ sichtbar lassen (sonst kein Testen am Handy), aber **nur** Entwürfe ohne roten Befund und nur mit katalog-geprüften Lebensmitteln (R19), mit deutlicher Warnung „Allergene noch nicht fachlich geprüft – bei Allergien bitte nicht verwenden“ auf jeder Rezeptseite und im PDF. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(j) CHECK-Migration für `nutrition_setup` schon in N4 (S8):** _Empfehlung:_ ja – kleine, harmlose Migration im selben PR, damit `db-sync` grün bleibt; neue Enums erst in N7. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**
- **(k) Kokos (K11):** _Empfehlung:_ nicht als Schalenfrucht (`tree_nuts`) führen (LMIV), aber in „Enthält“ ausdrücklich „Kokos“ nennen. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**

**Neu aus der Wächter-Nachprüfung (Runde 2):**

- **(l) Was ist beim Essensplan serverseitig Premium? (R2-K7, Entscheidung mit Phase 7)** Eine Prüfung in `save_meal_plan` verhindert nur das Speichern; rechnen kann jedes Gerät selbst, weil Core und freigegebene Rezepte für alle lesbar sind. _Empfehlung:_ Bedarf, Makros und eine **Grundauswahl an Rezepten** bleiben gratis. Wird der Wochenplan Premium, dann ist das serverseitig Geschützte (a) das **Speichern/Synchronisieren** des Plans und der Einkaufsliste über mehrere Geräte (`save_meal_plan`, `replace_shopping_list` prüfen `has_entitlement`) und (b) der **Zugriff auf den vollen Rezeptbestand** über RLS (`recipes` außerhalb der Grundauswahl nur mit Premium lesbar). Das Rechnen auf dem Gerät mit der Grundauswahl bleibt erlaubt – ohne volle Rezepte kein voller Plan. — _Vormerken für Phase 7; bis dahin gilt Gründer-Entscheidung 1 (Testphase für alle offen)._ **Entscheidung: Empfehlung gilt (Stand 10.10.2026)** – als Vorgabe für Phase 7.
- **(m) Koffein-Hinweis bei Schwangerschaft/Stillzeit (R2-K9):** _Empfehlung:_ ja – im Modus `no_targets` bei gesetztem Flag `pregnancy` ein fester Hinweis „In Schwangerschaft und Stillzeit empfiehlt das BfR höchstens 200 mg Koffein am Tag (etwa 2 Tassen Kaffee). Auch Matcha, Mate, Cola und Energydrinks enthalten Koffein.“ Kein Zählen, keine Rezeptsperre; Quelle BfR wortgenau in `constants.ts`. — **Entscheidung: Empfehlung gilt (Stand 10.10.2026).**

---

## 17. Abweichungen von KONZEPT §6 (werden dort nachgetragen)

| KONZEPT                                                                    | Plan                                                                                                          | Begründung                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Gesamtumsatz = BMR × Alltagsfaktor + Training                              | gleich, aber Alltagsfaktor **ohne Sport** (Mitte der D-A-CH-Spanne) und Trainingsenergie **netto** (MET − 1)  | vermeidet doppelte Zählung, unterschätzt nicht                                              |
| Defizit in % vom Gesamtumsatz                                              | Defizit vom **Grundbedarf ohne Training**, zusätzlich gegen vollen Gesamtumsatz und EA ≥ 30 geprüft           | Energieverfügbarkeit bei Sportlern (S2)                                                     |
| „nie unter Grundumsatz“, „max. 25 % unter Gesamtumsatz“, „max. ~1 %/Woche“ | **alle** Grenzen mit max(Mifflin, Katch) (`TagesbedarfGrenze`) und für den **ausgelieferten Plan** (Planband) | B1, B3, R2-B1                                                                               |
| Alltagsfaktor (keine Angabe im Onboarding)                                 | neuer Schritt `nutrition_setup`                                                                               | ohne Angabe nicht berechenbar                                                               |
| Timing vor/nach Training                                                   | zusätzlich Angabe „Trainingszeit“                                                                             | geplante Einheiten haben keine Uhrzeit                                                      |
| Schwangerschaft                                                            | `no_targets` statt Ziel                                                                                       | B5                                                                                          |
| Lebensmittel tauschen                                                      | nur Rezept tauschen + feste Ersatz-Zutaten                                                                    | freier Tausch braucht Tagebuch/Katalog der Erweiterung **→ ab N9 Zutaten-Austausch (19.7)** |
| Barcode, Tracker, 6.3-Vorschläge                                           | Erweiterung X1–X4                                                                                             | PROMPTS trennt Kern und Erweiterung                                                         |
| Wettkampf (Carb-Loading, Gel-Plan)                                         | Phase 10                                                                                                      | PROMPTS Phase 10 **→ W1 (19.7)**                                                            |
| Rezepte per Batch-API                                                      | erst Startbestand in Claude-Sitzung, Batch später                                                             | Gründer-Entscheidung 09.10.2026 **→ Startbestand aus `alpha5-rezepte.json` (19.1)**         |
| `foods` als Nutzertabelle unklar                                           | `foods` als **Inhalt** im Repository, Nährwerte maschinell aus der Quelle                                     | Nährwertqualität, B6                                                                        |
| `food_preferences` je `food_id`                                            | bleibt je `food_group`, Abgleich über `foods.groups`                                                          | keine Migration der Phase-1-Daten nötig                                                     |
| Makro-Plausibilität                                                        | Nährwerte **immer aus Zutaten berechnet**, KI-Werte nur Gegenprobe                                            | KI-Fehler dürfen nie durchrutschen                                                          |

---

## 18. Risiken

1. **Falsche Nährwerte oder fehlende Allergene.** _Gegenmittel:_ maschineller Import + CI-Abgleich (R17) mit Herkunftsprüfung des Auszugs (`sources-integrity`, R2-B2), Allergen-Pflichtregeln als Code für alle 23 Gruppen mit Wortteilen, Negativliste, Quellgruppe und Erwartungsliste (R18, R2-B3/R2-S1), menschliche Katalog-Prüfung (R19), Allergene aus Zutaten inkl. optionaler/Ersatz-Zutaten (R7), Warnhinweis bei Entwürfen, Fachprüfung vor Livegang.
2. **Ungenauigkeit der Formeln** (±10 % BMR, MET, selbst geschätztes Körperfett). _Gegenmittel:_ ehrlicher Hinweis, Mitte der Alltagsfaktoren, Ersatzwerte in sicherer Richtung, Grenzen immer mit max(Mifflin, Katch) (R2-B1), Trainingsdeckel ohne Defizit (R2-S8), keine Prognosen; 4b nur als Versatz, begrenzt in `clampCalorieTarget` (R2-S5).
3. **Plan unter der Untergrenze trotz richtiger Zielzahl** (Rundung, Portionen, leere Slots). _Gegenmittel:_ Planband, gerichtete Rundung, Ergänzungs-Snacks, Status `below_floor`, Eigenschaftstest über `buildMealPlanWeek` (W2).
4. **Essstörungen / ungesunder Umgang.** _Gegenmittel:_ Zahlen ausblendbar, keine Prognosen, keine Serien, Hilfe-Hinweise, nie unter BMR.
5. **REDs bei Ausdauersportlern.** _Gegenmittel:_ Defizit ohne Trainingsenergie, EA-Untergrenze, Hinweis.
6. **Zu wenige Rezepte bei strengen Filtern.** _Gegenmittel:_ Abdeckungsbericht R16, Weglassen optionaler Zutaten, klare Leer-Meldung, gezielte Nachproduktion.
7. **Widerruf löscht Unverträglichkeiten** → gefährlicher Plan. _Gegenmittel:_ Dialog + Angebot „mag ich nicht“, fester Ablauf mit Warteschlange (7.4), Tests W12.
8. **Veralteter Modus** (Schwangerschaft neu, Geburtstag). _Gegenmittel:_ automatische Neuplanung ab heute inkl. Einkaufsliste (6.6, R2-S4), `pregnancy_caution` auch aus der Zubereitung (R2-S2), Hinweis „Check aktualisieren“.
9. **Rechtliches** (Health Claims, MDR, LMIV, Datenbank-Lizenz). _Gegenmittel:_ R10, neutrale Zahlen, keine Therapieaussagen, Lizenz vor N2b, Namensnennung.
10. **„Ohne Schwein“ als Hinweis auf Religion (Art. 9).** _Gegenmittel:_ nie in Analytics/Logs, DSFA.
11. **Überschneidung mit 4b** (`limits.ts`, pgTAP-Nummern, Onboarding-CHECK). _Gegenmittel:_ Phase 5 legt `limits.ts` an, 4b nur Versatz + Aufruf (S10); pgTAP 23–26; CHECK in N4.
12. **Umfang zu groß.** _Gegenmittel:_ N2 in N2a–N2d geteilt; N1–N6 nur Testmodus; N7/N8 später.
13. **Meal-Prep-Lebensmittelsicherheit.** _Gegenmittel:_ `max_fridge_days` je Lebensmittel (R9), Einfrier-Hinweis, sonst frisch kochen.
14. **Gerätespeicher mit Gesundheitsbezug** im Testmodus unverschlüsselt. _Gegenmittel:_ dokumentierte Ausnahme nur für den Testmodus.
15. **Onboarding-Schritt ohne Speicherort im Supabase-Modus.** _Gegenmittel:_ `nutrition_setup` bis N7 nur im Testmodus (R2-S3, W21).

## 19. Nachtrag „Erweiterungen 2 (11.10.2026)“

Grundlage: `docs/ERWEITERUNGEN-2.md` (Gründer), eingearbeitet in `docs/KONZEPT.md` 3, 6.5–6.13, 11–14, 17, 18 und `docs/PROMPTS.md` (Prompts B–G). Fassung 2 nach Wächter-Prüfung `waechter-erw2-plan.md` (11.10.2026, Urteil „nicht freigabefähig bis B1/B2, danach mit Auflagen“) – **B1, B2, S1–S14 und K1–K11 eingearbeitet** (Übersicht 19.13). **Gründer-Entscheidungen vom 11.10.2026 (Gesamtplan freigegeben):**

1. **Reihenfolge:** (1) Dateien einsortieren (erledigt, #32) + Doku einarbeiten (dieser Nachtrag); (2) Lead-Magnet (Prompt G, parallel, eigener PR); (3) Rezept-Import = Prompt B Schritte 3–5 **zusammen mit N2b/N2c** (+ N2d); (4) Prompt C **zusammen mit N3–N6**; (5) Prompt D (N9–N11); (6) Prompt F, nur „Sofort“ (N12); (7) Prompt E: Logik (Portionsfaktor, Reste-Score) sofort (N13), Resteplanung in der App (N14), Oberfläche Paar-Modus erst mit dem Partner-Modus (P1, Phase 11).
2. **Nährwerte** aus der amtlichen Datenbank (BLS o. ä., wie R17 und H1); **jede der 236 Zutaten bekommt einen Quell-Eintrag**; die Werte aus `alpha5-rezepte.json` nur als Gegencheck (Abweichung > 3 % wird gemeldet). Allergene über die Regeln aus N2a. **Alle Rezepte `draft` + Fachprüfung.**
3. **Lead-Magnet:** Download ohne Newsletter-Pflicht (separates freiwilliges Häkchen).
4. **Premium:** in der Testphase für alle offen; Server-Prüfung mit Phase 7.
5. **Detailpläne prüft der Wächter**, die Gründer nur bei neuen Grundsatzfragen (19.12).

### 19.1 Was sich gegenüber dem bisherigen Plan ändert

Die betroffenen Stellen weiter oben (2.2, 5.4, 17 und die Tabelle „Abbildung `alpha5-rezepte.json`“ im Umsetzungsstand N2a) sind mit „→ ersetzt durch 19.x“ markiert (S13).

| Bisher (Abschnitt)                                                        | Jetzt                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.4 Startbestand: ~150 Lebensmittel, ~60 Rezepte aus einer Claude-Sitzung | **236 Zutaten und 242 Rezepte aus `alpha5-rezepte.json`** (+ 4 Meal-Prep-Pläne, 2 Ratgeber). Die KI-Erzeugung des Startbestands entfällt; die Verteilung aus 5.4 ist nur noch Abdeckungsziel (R16, Bericht an die Gründer, K9) |
| 13 N2c: ~60 Rezepte als Entwurf                                           | N2c = **Import-Skript** + Inhaltsarten Meal-Prep-Plan und Ratgeber (19.2, 19.4)                                                                                                                                                |
| 13 N8: Batch-Pipeline Rezepte                                             | bleibt optional, nur noch für **spätere Ergänzungen**. Neue Batch-Arten kommen mit N9 (Austausch-Tabelle) und N11 (Packungsgrößen)                                                                                             |
| 2.2 / 16 A (13): kein Budget, `cost_level` reserviert                     | Filter „max. Kosten“ und Spar-Küche; Kosten **nur als Schätzung**, nur nach Freigabe sichtbar (19.8 Nr. 7, Frage 19.12 (a))                                                                                                    |
| 2.2 / 16 A (12): Packungsgrößen und Reste „später“                        | N11 (Packungsgrößen, Kühlschrank-Suche), N13/N14 (Reste-Score, Resteplanung Premium)                                                                                                                                           |
| 2.2 / 17: freies Tauschen einzelner Zutaten „später“                      | N9 Zutaten-Austausch (gratis) über die freigegebene Austausch-Tabelle                                                                                                                                                          |
| 2.2: gemeinsame Einkaufsliste Phase 11                                    | bleibt Phase 11 (P1); Weitergeben als Text/PDF schon in N12                                                                                                                                                                    |
| 2.2 / 17: Wettkampf Phase 10                                              | bleibt Phase 10 (W1); Wettkampf-Rezepte und Ratgeber werden in N2c importiert und sind ab N4 über Suche/Ratgeber sichtbar, nicht im automatischen Plan                                                                         |
| X4 (KONZEPT 6.3): Vorschläge vor/während/nach jeder Einheit               | unverändert Premium; Gratis-Abgrenzung in 19.9                                                                                                                                                                                 |

### 19.2 Rezept-Import (Prompt B Schritt 4, Etappe N2c)

**Ziel:** `packages/content/seed/alpha5-rezepte.json` (Gründer-Datei, unverändert, in `.prettierignore`) wird in Inhaltsdateien unter `content/` umgewandelt – nach dem Grundsatz aus KONZEPT 3 „Repository → Datenbank, Entwürfe nie in Supabase“.

- **Skript** `packages/content/src/import/alpha5.ts` (+ `pnpm content:import-alpha5`), Eingabe-Schema `alpha5FileSchema` (Zod, **strikt**: unbekannte Felder, fehlende Pflichtfelder, doppelte IDs, unbekannte `zutat_id`, unbekannte Kategorie, Meal-Prep-Plan mit unbekanntem Rezept → Abbruch mit verständlicher Meldung, **nichts geschrieben**).
- **Ausgabe** (alle `status: draft`, `meta.origin: manual`, `meta.source_file: alpha5-rezepte.json@<version>`): `content/recipes/<id>.json`, `content/meal-prep-plans/<id>.json`, `content/guides/<id>.json`.
- **Keine Lebensmittel-Dateien (S3):** Das Skript schreibt **nichts** unter `content/foods/`. Es prüft nur, dass jede `zutat_id` als Lebensmittel existiert (sonst Abbruch bzw. Bericht „Zutat fehlt im Katalog“) und vergleicht `pro_100g` der Datei mit dem Quellwert. Lebensmittel-Dateien entstehen **nur in N2b** (Zuordnung aus einer Claude-Sitzung, Werte nur über `foods-import`) – eine einzige Schreibstelle je Feld.
- **Idempotent über die IDs:** gleiche Eingabe → byte-gleiche Dateien (feste Schlüsselreihenfolge, keine Zeitstempel außer `stand` der Datei). Vorhandene Dateien mit `status` ≠ `draft` werden **nie** überschrieben (R15). Fehlt eine ID in einer neuen Dateifassung, wird **nichts gelöscht**, nur gemeldet.
- **Menschliche Korrekturen bleiben (S5):** Jede erzeugte Datei trägt `meta.import_hash` (SHA-256 der Import-Ausgabe). Ein erneuter Lauf überschreibt einen Entwurf **nur**, wenn sein Inhalt (ohne `meta.import_hash`) noch byte-gleich der letzten Import-Ausgabe ist; sonst Bericht „von Hand geändert, nicht überschrieben“ mit Unterschied zur neuen Dateifassung. Geänderte, unberührte Entwürfe bekommen eine höhere `version`.
- **Abbildung** wie in der Tabelle „Abbildung `alpha5-rezepte.json`“ (Umsetzungsstand N2a), mit diesen maßgeblichen Ergänzungen:
  - `kategorie` + passende Themen → `categories[]` (n:m, 19.4).
  - `ernaehrungsformen` → `declared_diet` (vegan, sonst vegetarisch, sonst omnivor) und `contains_pork` (Rezept ohne „ohne-schwein“ ⇒ erwartet Schwein) – R6/R8 prüfen damit die Datei gegen die berechneten Werte.
  - **Deklarierte Allergene und Schwangerschaft (S4):** Die Datei enthält dazu nichts. Das Skript setzt `declared_allergens` und `declared_pregnancy_caution` auf die **vom Core berechneten** Werte. R7/R13 sind für importierte Rezepte damit bewusst ohne eigene Gegenprobe; die Absicherung leisten R18 (Pflichtregeln), die Erwartungsliste, R19 (Katalog-Prüfung) und die Fachprüfung.
  - **`heated` (S4):** Vorgabe **`false`** für jede Zutat, die `heated` braucht (sichere Richtung → `pregnancy_caution`), außer ein Zubereitungsschritt erhitzt genau diese Zutat eindeutig (Wortliste „braten, kochen, backen, garen, dünsten, anbraten, köcheln, überbacken“ + Zutatenname im selben Schritt). Jede `heated: true`-Annahme steht in `meta.import_assumptions` und im Bericht; bestätigt wird sie bei der Freigabe (Feld `meta.import_assumptions_confirmed_by`).
  - `abschnitt` → `section_de` (Anzeige) + `meal_types`/`training_tags` (Themen-Abschnitte „Ohne Backen“, „Aus dem Ofen oder der Mikrowelle“, „Gefroren“ → `snack`; „Hauptgericht“ → `main`); `zeit_min` → `total_minutes`; Tags ohne Groß-/Kleinschreibung zusammengeführt; `kosten_eur_pro_portion` → `cost_estimate` (19.4, sichtbar erst nach Freigabe, K1); Rolle je Zutat → `role` als Vorschlag (19.4, S6).
- **Nachrechnung:** Je Rezept berechnet der Core (`computeRecipeFacts`, N2a) die Nährwerte pro Portion aus Zutatenmengen × Katalogwerten (Quelle). Vergleich mit `naehrwerte_pro_portion` der Datei: **Abweichung > 3 %** bei kcal, Eiweiß, Kohlenhydraten oder Fett → Eintrag im Import-Bericht (gelb; Mindestabstand 5 kcal bzw. 1 g gegen Rundungsrauschen, PRODUKTENTSCHEIDUNG `ALPHA5_IMPORT_TOLERANCE` in `constants.ts`). Ebenso je Zutat `pro_100g` gegen den Quellwert. `declared_per_serving` = Datei-Werte, deshalb blockiert R3 (±10 %) große Abweichungen weiter rot. **Maßgeblich sind immer die berechneten Werte.**
- **Import-Bericht** (CI-Zusammenfassung und PR-Text): Anzahl importierter Rezepte, Zutaten, Meal-Prep-Pläne und Ratgeber (Soll 242/236/4/2), Abweichungen > 3 %, Abweichungen Ernährungsform/Schwein, fehlende Zutaten, umgewandelte Mengen `menge_g: 0`, `heated`-Annahmen, „von Hand geändert“, Haltbarkeits-Konflikte der Meal-Prep-Pläne (R20), Abdeckung R16 inkl. Hinweis an die Gründer (z. B. 28 Rezepte nur „mit Fleisch“, ca. 62 % vegetarisch/vegan statt ≥ 2/3, K9).
- **Workflow** `alpha5-import.yml` (manuell, „Run workflow“ in der GitHub-App): Skript ausführen, `content:validate`, **Pull Request** mit Bericht. **Abweichung von Prompt B:** `content-seed` importiert die Datei **nicht** direkt – er spielt wie bisher nur `published` ein und kennt dafür die neuen Arten (`recipe`, `food`, `meal_prep_plan`, `guide`, später `ingredient_substitution`). Grund: KONZEPT 3.
- **Bundle:** `FOLDERS`/`CONTENT_FOLDERS` um `foods`, `recipes`, `meal-prep-plans`, `guides` ergänzt; Quellauszüge, Erwartungs- und Ausnahmeliste ins App-Bundle (N2a-Hinweis zu R17).
- **DoD N2c (K8):** Zweitlauf byte-gleich; Schemafehler → Abbruch ohne Schreiben; `published` nie überschrieben; fehlende ID nicht gelöscht; von Hand geänderter Entwurf nicht überschrieben (S5); keine Datei unter `content/foods/` geschrieben (S3); Zählbericht 242/236/4/2; `heated`-Vorgabe `false` und Annahmen im Bericht (Tests).

### 19.3 Zuordnung Zutat → Quell-Eintrag (Etappe N2b, alle 236 Zutaten)

- **Wie:** Für jede `zutat_id` entsteht `content/foods/<id>.json` mit Quell-ID (`source.ref`, z. B. BLS-Schlüssel), `source.db`, `source.name`, `source.license`, Name, Aliase, Abteilung → `shopping_category`, Einheiten und Gruppen. Die Lebensmittel-ID bleibt die `zutat_id` der Datei (passt zu `contentIdSchema`, ≤ 41 Zeichen). Rohzustand beachten („Basmatireis trocken“ → ungekochter Reis, „Edamame TK“ → TK-Ware).
- **Wer:** Eine Claude-Code-Sitzung schlägt Zuordnung und Beschreibungsfelder vor – **nie Nährwerte**. Die Werte schreibt nur `foods-import` aus dem Quellauszug (R2-B2, H1). Das ist die **einzige** Schreibstelle für `content/foods/` (S3); das Import-Skript aus 19.2 liest nur.
- **Keine passende Zeile in der Hauptquelle** (z. B. Proteinpulver, Sojaskyr, Erythrit, Gels): (1) fachlich gleichwertiger Eintrag der Hauptquelle mit Begründung in `meta`, (2) sonst **Zweitquelle** aus der Allowlist (z. B. Schweizer Nährwertdatenbank), (3) sonst bleibt das Lebensmittel ungeprüft → Rezepte damit fallen über R19/`selectNutritionContent` heraus und stehen im Bericht. **Nie** Werte aus der Gründer-Datei oder von einer KI.
- **Zweitquelle mit eigener Infrastruktur (S3):** Jede Quelle bekommt ihren eigenen Ordner `content/sources/<db>/<version>/` mit eigener Original-Datei-URL in der Allowlist `sources.ts`, eigenem `SOURCE.json` (beide Prüfsummen), eigenem `extract.csv` und eigener Lizenz/Namensnennung. `foods-import` läuft je Quelle; `sources-integrity`, R17 und W18 prüfen **je Quelle** (`source.db` bestimmt den Auszug). Ohne diese Infrastruktur gibt es keine Zweitquelle.
- **Prüfung:** (a) maschinell: R17 + `sources-integrity` je Quelle; Zuordnungs-Bericht je Zutat mit Datei-Wert vs. Quellwert (> 3 % markiert, > 15 % „Zuordnung prüfen“ – seit Import-Lauf 1 mit Mindestabstand 20 kcal bzw. 15 % der Energie und Lesarten der KH-Definition, Umsetzungsstand N2b); (b) Erwartungsliste `allergen-expectations.json` und R18 für alle 236; (c) **menschliche Katalog-Prüfung R19** durch die Gründer über `content-review` „Katalog geprüft“ (Checkliste 5.1.1 d, markierte Zuordnungen zuerst); (d) Ernährungsfachkraft vor N7/Livegang.
- Der Testmodus zeigt nur Rezepte, deren Zutaten alle katalog-geprüft sind (R19) – die Prüfung kann schrittweise (z. B. pro Abteilung) erfolgen.

### 19.4 Schema-Erweiterungen (Zod in N2c; Tabellen erst in N7)

**Abweichung von Prompt B Schritt 3:** Zod-Schemas und Inhaltsdateien kommen in N2c (Testmodus), die **Migrationen** mit RLS gemeinsam mit allen Ernährungstabellen in **N7** (9). **N7 bündelt alle Tabellen dieses Nachtrags** – Inhalte und Nutzerdaten (`recipe_ratings`, `food_dislikes`); kommt N7 erst nach N9–N14, gehören sie trotzdem in N7, die Etappen N9–N14 laufen bis dahin nur im Testmodus (S8). Regeln wie 7.2: `authenticated` liest nur `published`, Schreiben **nur** `seed_content()`.

| Bereich                | Inhaltsdatei (N2c, Zod strikt)                                                                                                                                                                                                                                                                                                    | Tabelle (N7)                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kategorien (8 Themen)  | `RECIPE_CATEGORIES` als Konstante in Core (ID, Name); Rezept `categories[]` (0–8)                                                                                                                                                                                                                                                 | `recipe_categories` + `recipe_category_links` (n:m)                                                                                                          |
| Ernährungsformen (n:m) | **kein eigenes Feld**: „passt für“ = berechnete `diet` + `contains_pork` (vegan → alle vier); Datei nur Gegencheck                                                                                                                                                                                                                | Spalten `diet`, `contains_pork` (7.2); optional View `recipe_diet_fits`                                                                                      |
| Tags, Abschnitt, Tipp  | `tags_de[]`, `tip_de` (N2a), neu `section_de` (≤ 40 Zeichen, R10)                                                                                                                                                                                                                                                                 | Spalten an `recipes`                                                                                                                                         |
| Portionen, Zeit        | `servings` (vorhanden), neu `total_minutes` (1–360; `prep_minutes + cook_minutes` ≤ `total_minutes`)                                                                                                                                                                                                                              | Spalten an `recipes`                                                                                                                                         |
| Rolle je Zutat (S6)    | `ingredients[].role?` = `protein \| carb \| fat \| vegetable \| seasoning \| sweet` (Import-Vorschlag, Freigabe); Pflicht für Rezepte im Paar-Modus und für den Austausch                                                                                                                                                         | Spalte an `recipe_ingredients`                                                                                                                               |
| Kosten                 | `cost_estimate { eur_per_serving, as_of, basis: 'estimate', reviewed_by? }` optional; Zutat optional `price_estimate { eur_per_kg, as_of, source }` (nur nach Frage 19.12 (a))                                                                                                                                                    | Spalten an `recipes`/`foods`                                                                                                                                 |
| Meal-Prep-Pläne        | neue Art `meal_prep_plan` (`content/meal-prep-plans/`): `id`, `version`, `status`, `title_de`, `description_de`, `recipe_ids[]` (1–6), `cook_steps[] { start_min, text_de }` (aufsteigend, 0–240), **`storage_plan[] { recipe_id, weekday, method: fridge \| freeze \| fresh }`** (S10), `storage_de[]`, `dinner_hint_de`, `meta` | `meal_prep_plans`, `meal_prep_plan_recipes`, `meal_prep_plan_steps`, `meal_prep_plan_storage`                                                                |
| Ratgeber               | neue Art `guide` (`content/guides/`): `id`, `version`, `status`, `title_de`, `sections[] { heading_de, body_de[] }` (für „Unterwegs“ zusätzlich `places[]`), `meta`                                                                                                                                                               | `guides` (Abschnitte jsonb)                                                                                                                                  |
| Packungsgrößen (N11)   | Zutat `package_size_g?` (Batch-Vorschlag, `meta.package_size_reviewed_*`)                                                                                                                                                                                                                                                         | Spalte an `foods`                                                                                                                                            |
| Austausch (N9)         | neue Art `ingredient_substitution` (`content/substitutions/`): `food_id`, `substitute_food_id`, `factor`, `role`, `note_de`                                                                                                                                                                                                       | `ingredient_substitutions`                                                                                                                                   |
| Nutzerdaten (N10)      | Testmodus `localDb.recipeRatings`, `localDb.foodDislikes`                                                                                                                                                                                                                                                                         | `recipe_ratings` (user_id, recipe_id, value `up \| down`, reason ohne „unverträglich“, rated_on), `food_dislikes` (user_id, food_id) – RLS, Export, Löschung |

**Messgröße je Rolle (S6)** – Grundlage für N9 und N13: `protein` = g Eiweiß, `carb` = g Kohlenhydrate, `fat` = g Fett, `vegetable` = Masse (Faktor 1 ±10 %), `seasoning` = keine Nährwertprüfung, aber Salz nach R11, `sweet` = Süßkraft laut Hinweis (gelb, menschliche Prüfung).

Neue Prüfregeln (Teil von `content:validate`):

- **R20 (rot)** Meal-Prep-Plan: alle Rezepte existieren und sind `meal_prep.suitable`; Startminuten aufsteigend; **`storage_plan` deckt Mo–Fr für jedes Rezept ab und hält R9 ein** (`fridge` nur, solange der Tag ≤ Haltbarkeit des Rezepts nach dem Kochtag liegt; `freeze` nur bei `freezable`; sonst `fresh`). Zusätzlich Wortregel auf `storage_de[]` und `cook_steps[].text_de`: „N Tage“ bzw. „N–M Tage“ → gelb, rot wenn größer als die R9-Grenze des genannten Rezepts (S10). Hinweis: Die vegane Datei-Woche friert erst Do/Fr ein, Di/Mi verletzen R9 (Reis) – R20 meldet das, bis Frage 19.12 (b) entschieden und der Plan angepasst ist.
- **R21 (rot/gelb)** Ratgeber: Textregeln R10 inkl. Health-Claims (rot); Mengenangaben in g/kg oder mg (z. B. „8–10 g KH/kg“) und Supplement-Dosierungen → **gelb zur Fachprüfung** (S14); der Wettkampf-Ratgeber trägt beim Carb-Loading den festen Hinweis „Im Kaloriendefizit, unter 18 Jahren oder in der Schwangerschaft nicht ohne fachliche Absprache.“
- **R22 (gelb)** Kategorie-Plausibilität: „schnell“ ⇔ `total_minutes` ≤ 10, „Pre-/Post-Workout“ ⇔ passende `training_tags`, „meal-prep“ ⇔ `meal_prep.suitable`.

### 19.5 Admin und Sammelfreigabe (Prompt B Schritt 5, Etappe N2d)

- `admin/rezepte` gruppiert nach Kategorie: Anzahl Entwürfe/freigegeben, rote Befunde, Zutaten ohne Katalog-Prüfung, offene `heated`-Annahmen, Abweichungen aus dem Import-Bericht; `admin/meal-prep` und `admin/ratgeber` (nur ansehen). Der Admin-Bereich **schreibt nicht** (KONZEPT 3).
- **Sammelfreigabe pro Kategorie** = neue Option im Workflow `content-review`: Eingaben `kind = recipe`, `category = <id>`, `reviewer`, Häkchen „fachlich geprüft“ (`expert_reviewed`) und Häkchen „Import-Annahmen geprüft“. Gesetzt wird `published` **nur** für Rezepte der Kategorie **ohne roten Befund, mit ausschließlich katalog-geprüften Zutaten und ohne unbestätigte `heated`-Annahmen** (S4; bestätigt wird durch das zweite Häkchen, das `meta.import_assumptions_confirmed_by` setzt). Übersprungene Rezepte stehen mit Grund im PR; **Merge durch einen Menschen**. **Für den Livegang (ab N7) setzt die Sammelfreigabe `published` nur mit „fachlich geprüft“** (Gründer-Entscheidung 6, K10). Der Admin zeigt die Klick-Schritte (Actions → content-review → Run workflow).
- Danach spielt `content-seed` (ab N7) nur das Freigegebene ein.

### 19.6 Umfang von Prompt C in N3–N6

**Für alle neuen Ansichten gilt der Schalter „Kalorienzahlen anzeigen“ (16 B (h), S12):** Ist er aus, zeigen Rezeptsuche (Karten, keine Sortierung nach kcal), Rezeptansicht mit Portionswähler, Austausch-Dialog, Kühlschrank-Suche, Meal-Prep-Plan, Bewertung und Paar-Modus keine kcal und keine Makro-Gramm.

| Prompt C                                  | Etappe            | Umsetzung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rezeptsuche mit Filtern                   | N3 (Core), N4     | `recipe-search.ts`: dieselben harten Regeln wie `filter.ts` (Schwein **nur bei `eats_pork = true`**; leer bei Mischkost zählt wie „nein“, W10, G2; Unverträglichkeiten, „mag ich nicht“, `pregnancy_caution`) + weiche Filter Kategorie, Abschnitt, „Unter 10 Minuten“ (`total_minutes` ≤ 10, nicht der Tag), max. Kosten (nur mit freigegebener Schätzung); deterministische Sortierung. **Ernährungsform (K3):** aus dem Profil vorbelegt und **erweiterbar** (z. B. vegan sucht auch vegetarisch) – sie ist eine Vorliebe, kein Schutz; alle anderen Ausschlüsse sind in der Suche **nicht abschaltbar**. **Treffer außerhalb der Profil-Ernährungsform sind gekennzeichnet** („passt nicht zu deiner Ernährungsform: vegetarisch“); „Zur Einkaufsliste“ ist für sie erlaubt (bewusste Wahl des Nutzers, keine Sicherheitsfrage), die Einträge tragen dieselbe Kennzeichnung; in den automatischen Essensplan kommen sie nie (G4). Bildschirm `apps/mobile/src/app/rezepte/index.tsx` |
| Portionswähler                            | N3, N4            | `scaleRecipeForServings(recipe, servings)` (1–12; Rundung nach 6.2, Nährwerte nach Rundung neu); Meal-Prep-Rezepte zeigen Gesamtmenge und pro Portion. **Kein** Bezug zu Kalorienzielen (das ist `scale.ts`/Planband)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Einkaufsliste abhakbar                    | N5                | wie 6.5/N5; zusätzlich „Zur Einkaufsliste“ aus einer Rezeptansicht und aus einem Meal-Prep-Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Trainingsbezug Pre/Post, Cardio ≥ 75 Min. | N3 (gratis), X4   | Gratis in N3: Slot-Rolle `pre`/`post` bevorzugt Rezepte aus Pre-/Post-Workout (6.3 Schritt 5) und Suche nach Kategorie. Die **automatische Belegung je Einheit** mit Cardio-Rezepten ab **75 Minuten** ist X4 (Premium); `CARDIO_RECIPE_MIN_MINUTES = 75` steht als PRODUKTENTSCHEIDUNG (Gründer-Vorgabe) in `constants.ts` (K4). Der Hinweis `long_session_fueling` (≥ 90 Min., N1) bleibt bewusst getrennt; ob er auf 75 Min. sinkt, entscheidet die Fachprüfung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Wettkampftage                             | **W1 (Phase 10)** | bis dahin nur Suche (Kategorie „Wettkampftag“) und Ratgeber; im Wochenplan nie automatisch (Tag `wettkampf` schließt aus)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Meal-Prep-Kochtag mit Timern              | N3 (Core), N5     | `applyMealPrepPlan(plan, week, prefs)` – siehe unten (B1, K7). `cookDaySchedule(plan)` liefert Schritte mit Startminute. App: Kochtag-Ansicht mit Timern (lokale Benachrichtigung, läuft offline weiter) und Auftau-Hinweisen aus `storage_plan`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Ratgeber offline                          | N2c, N4           | Bundle + Bildschirm `apps/mobile/src/app/ratgeber/[id].tsx`, offline ohne Netz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Gratis/Premium, Prüfung auf dem Server    | N7 / Phase 7      | Testmodus: alles offen; Server-Prüfung mit Phase 7 (19.9)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**`applyMealPrepPlan` – Filter und Ablauf (B1, K7):**

1. **Jedes Rezept des Plans läuft durch den kompletten Filter aus 6.1** (Ernährungsform, Schwein inkl. Gelatine, Unverträglichkeiten, „mag ich nicht“, `pregnancy_caution` inkl. `heated`/`no_cook`, Allergene aus R18), inklusive Weglassen optionaler Zutaten (S3) und Ersatz-Zutaten mit erneutem Filter (S4).
2. **Fällt auch nur ein Rezept heraus, wird der Plan dieser Person nicht angeboten.** Die Planliste zeigt ihn ausgegraut mit „Passt nicht zu deinen Angaben“ – **ohne Grund** (kein Rückschluss auf Unverträglichkeit oder Schwangerschaft). Festgelegte Variante; kein teilweises Belegen. Ändern sich die Angaben während einer laufenden Plan-Woche (z. B. Schwangerschaft), greift 6.6: Tage ab heute werden neu geplant, nicht passende Plan-Rezepte durch normale Kandidaten (6.3) ersetzt, Einkaufsliste neu.
3. **Gratis-Plan** = der **erste Plan in fester Reihenfolge, der den kompletten Filter besteht**; besteht keiner, gibt es keinen Gratis-Plan (Hinweis „Für deine Angaben gibt es noch keinen passenden Wochenplan“).
4. **Slots (K7):** Zuordnung Rezept → Slot über `meal_types` (`breakfast` → Frühstück, `main` → Mittag, `snack` → Snack); Mo–Fr; **Abendessen bleibt frei** (frisch, 6.3). Fehlt der Slot im Layout der Person (z. B. 2 Mahlzeiten), wird das Rezept nicht verwendet und der Plan nicht angeboten.
5. **Vorrang (K7):** Ein gewählter Plan ersetzt für diese Woche die Kochtermine aus `mealprep_days` (6.4): Kochtag ist der Sonntag davor, zusätzliche Termine nur, wenn `storage_plan` `fresh` verlangt.
6. **Haltbarkeit:** Jeder Tag folgt `storage_plan` und R9 (`fridge`/`freeze`/`fresh`); die App zeigt Auftau-Hinweise.
7. **Portionen** im Planband (B1, 6.2); Tage, die die Untergrenze nicht erreichen, werden ausgeglichen oder `below_floor`. **Liegt ein Tag über der Obergrenze**, werden die Plan-Portionen bis Faktor 0,5 gesenkt (und Ergänzungs-Snacks gestrichen); reicht das nicht, wird der Plan dieser Person **nicht angeboten** (G3).
8. **Daumen runter** für ein Plan-Rezept (K7): Die laufende Woche bleibt; der ganze Plan wird 8 Wochen nicht mehr angeboten (wie N10).

**DoD-Ergänzungen:** N3 Eigenschaftstests „`recipe-search` liefert nie ein Rezept, das `filter.ts` wegen Schwein (inkl. `eats_pork = null` bei Mischkost, G2), Unverträglichkeit, ‚mag ich nicht‘ oder `pregnancy_caution` ausschließt“ und **„`applyMealPrepPlan` liefert nie ein Rezept, das `filter.ts` ausschließt“** (Fixtures: Erdnuss-Unverträglichkeit + vegane Woche mit Erdnuss-Curry, Schwangerschaft + Fisch-/Ei-Rezept, `eats_pork = false` + Schwein, „mag ich nicht“), Gratis-Plan „erster passender oder keiner“, Portionswähler (1 und 12 Portionen, 5-Portionen-Rezept, Eier ganz), Haltbarkeit R9/`storage_plan`, Planband; N4/N5 Playwright: Suche mit vorbelegter Ernährungsform, Portionswähler, Kochtag mit Timer, Ratgeber im Flugmodus, **„Zahlen aus → keine kcal in Suche, Portionswähler und Meal-Prep“** (S12).

### 19.7 Neue Etappen (je ein Pull Request mit Wächter-Prüfung, Testmodus zuerst)

**N9 – Zutaten-Austausch (Prompt D, KONZEPT 6.9, gratis).** _Umgesetzt im Testmodus (14.10.2026), siehe Umsetzungsstand N9._

- Batch-Art `kinds/ingredient-substitution.ts` (Structured Output nur mit Katalog-IDs, Rollen aus 19.4, Faktor 0,2–5) → `draft` → Prüfregeln (beide IDs existieren und sind katalog-geprüft; Faktor hält die **Messgröße der Rolle** (19.4) innerhalb ±10 %; kein Alkohol; Hinweis-Text R10) → Freigabe über `content-review`/Admin.
- Core `substitute.ts`: Eine Alternative wird nur angeboten, wenn das **geänderte Rezept den kompletten Filter erneut besteht** (wie S4) und danach **R11** (Salz, Öl, Zutat ≤ 600 g) erfüllt (S6).
- **`heated` (B2):** Braucht die Ersatz-Zutat `heated` (Ei, Fisch, Krebs-/Weichtiere, Fleisch, Rohmilch) und hatte das Original keinen Wert, gilt **`heated: false`** (sichere Richtung → `pregnancy_caution`); erst danach läuft der Filter.
- **Haltbarkeit (B2):** Nach jedem Tausch wird die Haltbarkeit des Rezepts (`min(max_fridge_days)`, R9) neu berechnet und `meal-prep.ts` (6.4) bzw. `storage_plan` erneut angewandt: Tage jenseits der Haltbarkeit werden eingefroren (nur bei `freezable`) oder frisch gekocht. **Ist das Gericht schon gekocht (Kochtag vorbei), wird der Tausch für die vorgekochten Portionen nicht angeboten.**
- Danach Nährwerte, Tagesausgleich im Planband (B1, 6.2) und Einkaufsliste neu. Liegt der Tag danach **über der Obergrenze** und lässt sich über andere Slots/Ergänzungs-Snacks nicht ins Band bringen, wird der Tausch nicht angeboten (S1); unter der Untergrenze → Ausgleich oder `below_floor`. Im Modus `no_targets` keine Mengenanpassung über den Faktor hinaus (Faktor 1).
- **Server (S7, mit N7):** `mealPlanPayloadSchema` bekommt die Tausch-Einträge (`food_id` → `substitute_food_id` je Rezept-Zutat); `save_meal_plan` prüft, dass die Ersetzung `published` in `ingredient_substitutions` existiert, und prüft Ernährungsform, Schwein und Unverträglichkeiten erneut mit `groups`, `animal`, `meat_kind` des Ersatzes (`pregnancy_caution` wie bisher nur im Core, R2-K8).
- _DoD:_ Eigenschaftstest „kein angebotener Tausch verletzt einen Ausschluss“ und „kein Tausch hebt einen Tag über die Obergrenze oder unter die Untergrenze ohne `below_floor`“; **Tests B2:** „Tausch Tofu → Hähnchen im 5-Tage-Plan → ab Tag 2 einfrieren bzw. frisch“, „pflanzlich → Ei ohne `heated` ⇒ `pregnancy_caution`“, „Kochtag vorbei → kein Tausch für vorgekochte Portionen“; Probelauf ohne Schlüssel; App-Dialog „Austauschen“ mit Zahlen aus (S12); pgTAP für die Server-Prüfung in N7.

**N10 – Bewertung nach dem Essen (Prompt D, KONZEPT 6.10, gratis).** _Umgesetzt im Testmodus (14.10.2026), siehe Umsetzungsstand N10._

- Core `ratings.ts`: Daumen hoch → Bonus im Score (`MEAL_PLAN_SCORING`); Daumen runter → 8 Wochen ausgeschlossen (tagesgenau, deterministisch); „Zu aufwendig“ → Bonus für `total_minutes` ≤ 15; „Macht nicht satt“ → Bonus für Rezepte mit mehr Ballaststoffen/Volumen je kcal; „Zu teuer“ → Bonus für niedrigere Kostenschätzung. **Kein Grund ändert Energie, Portionen oder Grenzen** – nur die Reihenfolge (K6).
- „Unverträglich“ → **nur Dialog** „Zutaten als ‚mag ich nicht‘ übernehmen?“: Zutaten des Rezepts **einzeln auswählbar, nichts vorausgewählt** (S8); gespeichert als **`food_dislikes`** (je Lebensmittel, hart wie „mag ich nicht“; `filter.ts` wird um `food_id`-Abneigungen erweitert, Test). Der Grund „Unverträglich“ wird **nie gespeichert** – nicht in `localDb`, Payload, Logs oder Analytics (Art. 9). Eine echte Unverträglichkeit nur über das Profil mit `health_data`.
- Testmodus: `localDb.recipeRatings`, `localDb.foodDislikes`; Export und „Testdaten löschen“. Supabase-Tabellen mit RLS (nur eigene Zeilen, keine Aggregation, nie Analytics), Export, Löschung per Kaskade **in N7** (19.4, pgTAP in der N7-DoD).
- _DoD (nur Testmodus):_ Tests „8 Wochen genau“, „Plan bleibt deterministisch“, „`food_dislikes` schließt aus“, **„Grund ‚Unverträglich‘ landet nie in `localDb`, Payload oder Logs; kein Analytics-Ereignis mit Bewertungsgrund“**; Playwright „Daumen runter → nicht mehr im Plan“, Dialog ohne Vorauswahl.

**N11 – Kühlschrank-Suche und Packungsgrößen (Prompt D, KONZEPT 6.11, gratis).** _Umgesetzt im Testmodus (14.10.2026), siehe Umsetzungsstand N11._ Core `fridge-search.ts`: Übereinstimmung = Anteil vorhandener Zutaten gewichtet nach Menge (Vorrat/Gewürze zählen wenig), danach dieselben harten Filter wie die Rezeptsuche, stabile Sortierung; Auswahl wird nicht gespeichert; Zahlen-Schalter (S12). Batch-Art `package-size` → Feld `package_size_g` → `draft` → Freigabe (Plausibilität 1–5.000 g). _DoD:_ Tests (keine Zutat, alle Zutaten, nur Gewürze, Ausschlüsse wirken), App „Was habe ich da?“.

**N12 – Einkaufsliste weitergeben (Prompt F „Sofort“, KONZEPT 6.13, gratis).** _Umgesetzt im Testmodus (14.10.2026), siehe Umsetzungsstand N12._ `shoppingListToText(list)` in Core (nach Abteilung, Produktarten und Mengen in g/Stück, **ohne kcal, ohne Gründe, ohne Körpergewicht**; Häkchen optional); System-Teilen-Dialog (nativ `Share`, Web `navigator.share` bzw. Kopieren); PDF aus N6. Hinweis vor dem Weitergeben, wenn `uses_health_data` bzw. Ersatzprodukte enthalten sind (wie K4). **Händler-Modul** `packages/core/src/retail/` nur als Schnittstelle (`RetailProvider`) + Feature-Flag `retail_integration` (aus), **ohne Händler**, ohne Netzwerkaufruf. **Bedingungen für das Einschalten des Flags (K5):** eigene Einwilligung für die Übermittlung, DSFA-Ergänzung, Datenminimierung (nur Produktarten und Mengen, keine Ersatz-Hinweise, keine Plan- oder Profildaten), offizielle Schnittstelle bzw. Partnerprogramm, Kennzeichnung „Anzeige“. Gemeinsame Liste im Paar-Modus → P1. _DoD:_ Tests Text (Escaping, leere Liste, Vorrat), Playwright Teilen/Kopieren, Flag aus = kein Knopf.

**N13 – Portionsfaktor und Reste-Score (Prompt E, Logik, Core).** _Umgesetzt in `packages/core` (14.10.2026), siehe Umsetzungsstand N13._

- `nutrition/portion-factor.ts`: Faktor je Person = Ziel-kcal der Mahlzeit (aus **deren** `nutritionTargetsForWeek`, also schon durch `clampCalorieTarget`) ÷ kcal pro Portion, begrenzt auf **0,6–1,8** (`COUPLE_PORTION_LIMITS`, liegt innerhalb von `PORTION_SCALE_LIMITS` 0,5–2,0). Rundung 10 g bei Beilagen, ganze Eier; Beilagen (`role = carb`) getrennt skalierbar, Eiweißquelle (`role = protein`) gleich (Rollen aus 19.4).
- **Ausgleich (S1):** Bei geteilten Gerichten bleibt der Faktor in 0,6–1,8; der Tagesausgleich aus 6.2 läuft dann **nur über die übrigen Slots und Ergänzungs-Snacks** (deren Faktoren weiter 0,5–2,0). Liegt der Tag einer Person danach noch **über der Obergrenze** (z. B. unter 18 oder ohne Check mit +5 %), werden zuerst Ergänzungs-Snacks gestrichen und andere Slots gesenkt; reicht das nicht, isst diese Person die Mahlzeit **nicht als geteilte Portion** (eigener Vorschlag nach 6.3). Unter der Untergrenze → Ausgleich oder `below_floor`.
- **`no_targets` bzw. ohne `health_data`-Einwilligung:** Faktor = 1, keine Paar-Skalierung (passt zu `save_meal_plan`: Faktor ≠ 1 ohne Einwilligung wird abgelehnt).
- `nutrition/leftovers.ts`: Einkaufsliste auf Packungen aufrunden (N11), Rest je Zutat, Reste-Score nach Menge und Haltbarkeit – ändert **nur die Reihenfolge** der Kandidaten. **Rohe Reste (S9):** `max_fridge_days` gilt für gekochte Speisen; angebrochene rohe Reste von Lebensmitteln mit `animal: meat | fish | shellfish` oder Rohmilch zählen **nur für den Folgetag** (danach Hinweis „einfrieren“); übrige Reste nach `LEFTOVER_RAW_DAYS` je Abteilung (Konstante mit Quelle, z. B. BfR/Verbraucherzentrale, PRODUKTENTSCHEIDUNG, Fachprüfung).
- _DoD:_ Tests mit Grenzfällen sehr unterschiedliche Kalorienziele (1.400 vs. 3.800 kcal → 0,6/1,8 + Ausgleich), **eine Person unter 18 mit Überschussdeckel** (Obergrenze → keine geteilte Portion), `no_targets` → Faktor 1, Rezept ohne Beilage, 5-Portionen-Rezepte, Zutat ohne Packungsgröße, Eier, rohes Hackfleisch als Rest → nur Folgetag; Eigenschaftstests **„Portionsfaktor hebt nie über die Obergrenze und drückt nie unter die Untergrenze ohne `below_floor`“** und **„Reste-Score an/aus → gleiche Kandidatenmenge, jeder Tag im Band oder `below_floor`“** (S9); Strukturtest K2 erweitert.

**N14 – Resteplanung in der App (Prompt E, Premium, Testmodus offen).** _Teilweise umgesetzt im Testmodus (14.10.2026): Reste-Score im Wochenplan und Hinweis „Nutzt deinen Rest“; Packungsangabe in der Einkaufsliste **zurückgestellt bis G-N13-4 und N11-G3**, siehe Umsetzungsstand N14._ Wochenplan nutzt den Reste-Score, Anzeige „Dieses Rezept verbraucht deinen restlichen Brokkoli.“, Einkaufsliste mit Packungsangabe, Zahlen-Schalter (S12). Premium-Prüfung serverseitig mit Phase 7. _DoD:_ Playwright, Plan bleibt deterministisch.

**W1 – Wettkampftage (mit Phase 10).** Wettkampftag-Rezepte im Plan der Tage davor; Carb-Loading nur bei Wettkämpfen ab ca. 90 Min. (Konstante mit Quelle, z. B. Thomas 2016/Burke). **Nur Makro-Verschiebung innerhalb des Ziels aus `clampCalorieTarget`**: mehr Kohlenhydrate, weniger Fett – **Fett nie unter 20 % der Energie und Eiweiß nie unter dem Minimum aus 4.7** (S14); zusätzliche Energie nur als Eingabe in `nutritionTargetsForWeek`, nie daneben. **PRODUKTENTSCHEIDUNG (S14, Fachprüfung):** An Carb-Loading-Tagen wird das Ziel-Defizit auf Erhalt gesetzt (Zielanpassung 0, weiterhin innerhalb aller Grenzen) und der **4b-Versatz an diesen Tagen = 0** (G1); die **Anzahl der Carb-Loading-Tage ist 1–2** (`CARB_LOADING_DAYS = { min: 1, max: 2 }` in `constants.ts`, Quelle Burke et al./Thomas 2016, **VOR LIVEGANG FACHLICH PRÜFEN**); die Ratgeber-Werte „8–10 g/kg“ werden nur angestrebt, soweit die Energie das zulässt, sonst Hinweis. Nicht in `no_targets`, bei `maintenance_only`/unter 18 nur die Makro-Verschiebung im Erhaltungsband; Ratgeber verlinkt. _DoD:_ Eigenschaftstest „Carb-Loading-Tag ≥ Untergrenze und ≤ Obergrenze, Fett ≥ 20 %, Eiweiß ≥ Minimum“, Fälle unter 18, `maintenance_only`, Fettverlust, `no_targets`; Strukturtest K2 grün.

**P1 – Paar-Modus beim Kochen (mit Partner-Modus, Phase 11, Premium).**

- **Eigener, einzeln freigegebener Bereich „Gemeinsam kochen“ im Partner-Modus (S2):** Jede Person willigt ausdrücklich ein (Art. 9 Abs. 2 a DSGVO, eigene `consent_documents`-Art mit Version) mit dem Hinweis: „Deine Portionsgrößen und die Rezeptauswahl lassen Rückschlüsse auf deinen Bedarf und deine Unverträglichkeiten zu.“ Namen nur nach beidseitiger Freigabe.
- Ohne diese Einwilligung einer Person: für sie Standardportion (Faktor 1), keine ihrer Ausschlüsse im gemeinsamen Text, keine Ersatz-Hinweise der anderen Person.
- Gemeinsame Rezepte und **jeder Tausch** in einer gemeinsamen Mahlzeit müssen den Filter **beider** Personen bestehen (K11); Server-Prüfung analog S7 für beide Personen und den Faktor 0,6–1,8.
- Oberfläche auf Basis von N13, gemeinsame Einkaufsliste (Summe beider Portionen), Anzeige „Anna 180 g Reis · Ben 120 g Reis“. Sichtbar sind **keine Zahlen zu Zielen oder Körperdaten – aber Portionen lassen Rückschlüsse zu** (deshalb die Einwilligung). Tabellen mit Phase 11.
- _DoD:_ pgTAP „ohne Einwilligung keine Portionen der anderen Person“, „Partner sieht nur Freigegebenes“, Widerruf/Trennung löscht gemeinsame Daten; Test „Tausch in gemeinsamer Mahlzeit verletzt keinen Ausschluss der anderen Person“.

### 19.8 Sicherheitsrelevante Regeln (ausdrücklich)

1. **Kalorien-Schutzgrenzen:** Carb-Loading/Wettkampf (W1), Portionsfaktor (N13, P1) und Tausch (N9) dürfen die Schutzgrenzen **nie** umgehen. `clampCalorieTarget` bleibt die **einzige** Stelle mit Schutzgrenzen; der Strukturtest aus N1 (K2) wird um `portion-factor.ts`, `leftovers.ts`, `substitute.ts` und die Wettkampf-Logik erweitert. Jeder ausgelieferte Tag liegt im Planband – **Unter- und Obergrenze** – oder ist `below_floor`; über der Obergrenze wird nie ausgeliefert (S1: Tausch bzw. geteilte Portion entfällt). W2 gilt für alle neuen Wege (Meal-Prep-Plan, Tausch, Portionsfaktor, Reste).
2. **Meal-Prep-Pläne und Zutaten-Austausch** halten die Allergen-, Diät-, Schwein-, „mag ich nicht“- und Schwangerschaftsregeln aus N2a/6.1 ein (kompletter Filter je Rezept bzw. nach dem Tausch, B1/B2); Ersatz ohne `heated` gilt als ungegart.
3. **Austausch-Tabelle und Packungsgrößen** nur per Batch-API → `draft` → Admin-/`content-review`-Freigabe; keine Echtzeit-KI.
4. **Bewertungen** (`recipe_ratings`) mit RLS, privat, nie angezeigt, nie aggregiert, nie in Analytics; kein Gesundheitsgrund gespeichert.
5. **Nährwerte und Allergene** nie aus der Gründer-Datei oder einer KI (19.3); Datei-Werte nur Gegencheck.
6. **Meal-Prep-Haltbarkeit:** R9 gilt für die vier Pläne und nach jedem Tausch (gekochter Reis, Fisch, Hackfleisch, Geflügel 1 Tag; sonst höchstens 3 Tage; Rest einfrieren oder frisch kochen); maschinell geprüft über `storage_plan` und R20 (S10). Rohe Reste von Fleisch/Fisch nur Folgetag (S9).
7. **Kosten/Preise** immer als **Schätzung** gekennzeichnet („ca. … €, Schätzung, Stand …“), nie als Preisangabe; nur sichtbar, wo eine **freigegebene** Schätzung vorliegt (auch die 10 Datei-Werte erst nach Freigabe, K1).
8. **Weitergeben** der Einkaufsliste nur durch aktive Handlung, ohne kcal/Gründe/Körpergewicht, Hinweis bei verräterischen Ersatzprodukten (K4); Händler-Flag nur unter den Bedingungen aus N12 (K5).
9. **Entwürfe** im Testmodus weiter mit Warnung „Allergene noch nicht fachlich geprüft“ (K6) – auch in Suche, Meal-Prep und Kühlschrank-Suche.
10. **Schalter „Kalorienzahlen anzeigen“** gilt in allen neuen Ansichten (S12).
11. **Paar-Modus** nur mit eigener Art.-9-Einwilligung beider Personen (S2).
12. **Lead-Magnet-PDF (S11):** Die Nährwerte im PDF stammen aus der Gründer-Datei. **Bedingung für den Livegang:** (a) die 20 Rezepte werden nach N2b gegen die Katalogwerte geprüft (> 3 % → PDF korrigieren) und fachlich geprüft, (b) bis dahin trägt das PDF die Kennzeichnung „Richtwerte, nicht fachlich geprüft“ – oder es geht erst danach live, (c) Health-Claims-Prüfung der PDF-Texte. Festgehalten in KONZEPT 17.

### 19.9 Gratis/Premium und Server-Prüfung

- **Gratis:** Rezeptsuche, Portionswähler, Ratgeber, Austausch, Bewertung, Kühlschrank-Suche, Weitergeben, Bedarf/Timing und Suche in Pre-/Post-Workout/Cardio, **ein** Meal-Prep-Plan = der erste in fester Reihenfolge, der den kompletten Filter besteht (B1; endgültig mit Phase 7).
- **Premium:** alle Meal-Prep-Pläne, automatische Resteplanung (N14), Paar-Modus (P1), automatische Rezept-Belegung je Einheit (X4).
- **Testphase:** alles offen (Gründer 11.10.2026). **Server-Prüfung mit Phase 7** nach dem Muster 16 B (l): `has_entitlement` in den speichernden RPCs und RLS auf Premium-Inhalten (z. B. `meal_prep_plans` außer dem Gratis-Plan). Partner-Abo als Preisfrage für Phase 7 vorgemerkt.

### 19.10 Definition of Done (Ergänzung zu 14)

Typen + Zod-Schemas für alle neuen Arten; **alle Migrationen mit RLS in N7** (Inhalte und Nutzerdaten `recipe_ratings`, `food_dislikes`, mit pgTAP), Paar-Modus mit Phase 11; Core-Logik mit Tests inkl. Grenzfällen (1 vs. 12 Portionen, 5-Portionen-Rezepte, sehr unterschiedliche Kalorienziele, unter 18, `no_targets`, leere Kühlschrank-Auswahl, Tag an Unter- und Obergrenze) und den Eigenschaftstests aus 19.6/19.7 (B1, B2, S1, S9, S14); UI mobil + Web mit Leer-/Fehler-/Lade-/Offline-Zuständen und Zahlen-Schalter; Texte Deutsch ohne Health Claims; `docs/` aktualisiert (KONZEPT, PROMPTS, Umsetzungsstand hier, HANDY-ANLEITUNG „Rezepte testen“).

### 19.11 So testest du es am Handy (Ergänzung zu 15)

- **N2c:** GitHub-App → **Actions → alpha5-import → Run workflow** → es kommt ein Pull Request; im PR-Text stehen die Zahlen (Rezepte, Zutaten, Pläne, Ratgeber) und die Abweichungen > 3 %.
- **N2d:** **Actions → content-review → Run workflow** → Art „recipe“, Kategorie wählen, Prüfer eintragen → PR prüfen und mergen.
- **N4–N5:** Vorschau-Link → „Rezepte“ → Filter „vegan“ und „Unter 10 Minuten“ → Rezept öffnen → Portionen auf 3 → Mengen ändern sich; „Meal-Prep“ → Plan wählen → Kochtag starten → Timer läuft; im Profil „Erdnüsse: Unverträglichkeit“ → die vegane Woche ist ausgegraut („Passt nicht zu deinen Angaben“); „Ratgeber“ im Flugmodus öffnen; Kalorienzahlen ausschalten → nirgends kcal.
- **N9–N14:** Zutat antippen → „Austauschen“; nach dem Essen Daumen runter; „Was habe ich da?“; Einkaufsliste → „Weitergeben“.

### 19.12 Offene Gründer-Fragen (nur neue Grundsatzfragen)

- **(a) Kosten für alle Rezepte – woher kommen die Preise?** Die Datei hat Kosten nur für 10 Rezepte und Preise nur für 5 Zutaten; diese Werte sind selbst ungeprüft und werden erst nach Freigabe angezeigt. Ohne weitere Preise findet der Filter „max. Kosten“ fast nichts. Preise schwanken; in Österreich (Euro, anderes Preisniveau) und in der Schweiz (Franken, deutlich höher) passen deutsche Preise nicht.
  - _Option 1:_ Schätzpreise für alle 236 Zutaten über die Batch-API. Das sind **KI-Schätzungen**; ihr müsstet 236 Preise prüfen und freigeben (realistisch etwa ein halber Tag, jährlich erneut).
  - _Option 2:_ öffentliche Durchschnittspreise, wo verfügbar – weniger Prüfaufwand, aber Lücken, die als „keine Schätzung“ bleiben. Achtung: AMI-Daten sind **kostenpflichtig**, Destatis liefert meist nur **Preisindizes** statt Euro-Preise je kg; Lizenz und Nutzbarkeit vorher prüfen.
  - _Empfehlung:_ Option 2 wo verfügbar, Lücken mit Option 1 auffüllen. Anzeige nur als „Schätzung, Stand …, Deutschland“, in Österreich mit Hinweis „Preise aus Deutschland“, in der Schweiz Kostenfilter ausblenden. Bis zur Entscheidung zeigt die App nur freigegebene Werte der 10 Rezepte.
- **(b) Wie passen wir die Meal-Prep-Pläne an die Haltbarkeitsregel an?** Die Regel selbst ist entschieden (gekochter Reis, Geflügel, Fisch, Hackfleisch höchstens 1 Tag im Kühlschrank; Fachkraft bestätigt die Werte gegen das BfR). Die Pläne der Datei sehen aber z. B. „Curry mit Reis 3–4 Tage“ vor (vegane Woche: Einfrieren erst Do/Fr).
  - _Option 1:_ Ab Tag 2 einfrieren – ein Kochtag bleibt; dafür jeden Abend eine Portion zum Auftauen in den Kühlschrank legen.
  - _Option 2:_ Reis (bzw. Beilage) täglich frisch kochen (ca. 10 Min.), nur Curry/Soße vorkochen und – falls nötig – ebenfalls einfrieren. Bei Mittagessen im Büro heißt das: morgens Reis kochen.
  - _Option 3:_ zweiter kurzer Kochtermin am Mittwoch.
  - _Hinweis in jedem Fall:_ im Kühlschrank auftauen, vollständig erhitzen, aufgetauten Reis nicht erneut lagern.
  - _Empfehlung:_ Option 2 (am einfachsten, frischester Reis, wenig Gefrier-Aufwand); Option 1 als Alternative im Plan wählbar.

### 19.13 Wächter-Prüfung des Nachtrags (11.10.2026): eingearbeitet

Bericht `waechter-erw2-plan.md`: „nicht freigabefähig bis B1/B2, danach mit Auflagen“. Alle Befunde eingearbeitet:

| Befund                                           | Lösung                                                                                                                                                                                                                                                                                                             | Abschnitt                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| **B1** Meal-Prep-Pläne umgehen die Filter        | jedes Plan-Rezept durch den kompletten Filter; Plan wird sonst nicht angeboten (ohne Grund); Gratis-Plan = erster passender; Eigenschaftstest                                                                                                                                                                      | 19.6, 19.8, 19.9, KONZEPT 6.7          |
| **B2** Tausch bricht Haltbarkeit, `heated` offen | Haltbarkeit + Meal-Prep-Zeitplan neu, kein Tausch bei vorgekochten Portionen, Ersatz ohne `heated` = `false`; Tests                                                                                                                                                                                                | 19.7 N9, 19.8, KONZEPT 6.9             |
| S1 Faktor, Obergrenze, `no_targets`              | Faktor 0,6–1,8 nur für geteilte Gerichte, Ausgleich über übrige Slots (0,5–2,0); über Obergrenze kein Tausch bzw. keine geteilte Portion; `no_targets` = Faktor 1; Tests                                                                                                                                           | 19.7 N9/N13, 19.8                      |
| S2 Paar-Modus verrät Ziele                       | eigener Bereich mit Art.-9-Einwilligung, Wortlaut korrigiert, pgTAP                                                                                                                                                                                                                                                | 19.7 P1, KONZEPT 6.12/11/18            |
| S3 zwei Schreiber, Zweitquelle                   | Import schreibt keine Lebensmittel; Zweitquelle mit eigenem Auszug/Prüfsumme/Allowlist                                                                                                                                                                                                                             | 19.2, 19.3                             |
| S4 Import-Vorgaben                               | deklarierte Werte = berechnet (bewusst), `heated` Vorgabe `false`, Sammelfreigabe überspringt Unbestätigtes                                                                                                                                                                                                        | 19.2, 19.5                             |
| S5 Re-Import überschreibt Korrekturen            | `meta.import_hash`, Bericht „von Hand geändert“, Test                                                                                                                                                                                                                                                              | 19.2                                   |
| S6 Rolle je Zutat                                | `ingredients[].role`, Messgröße je Rolle, R11 nach Tausch                                                                                                                                                                                                                                                          | 19.4, 19.7 N9                          |
| S7 Server-Prüfung Tausch                         | Payload mit Tausch-Einträgen, `save_meal_plan` prüft Ersatz                                                                                                                                                                                                                                                        | 19.7 N9, P1                            |
| S8 `food_dislikes`, Migrationszeitpunkt          | Tabelle mit RLS/Export/Löschung, Filter-Erweiterung; alle Tabellen in N7; Dialog ohne Vorauswahl; Test „Grund nie gespeichert“                                                                                                                                                                                     | 19.4, 19.7 N10, 19.10, KONZEPT 6.10/12 |
| S9 rohe Reste                                    | nur Folgetag bei Fleisch/Fisch/Rohmilch, Konstante je Abteilung; Eigenschaftstest                                                                                                                                                                                                                                  | 19.7 N13, 19.8                         |
| S10 R20 und Freitext                             | `storage_plan` strukturiert, Wortregel auf Texte                                                                                                                                                                                                                                                                   | 19.4                                   |
| S11 Lead-Magnet-PDF                              | Livegang-Bedingung (Abgleich, Kennzeichnung, Health Claims), 30 Tage                                                                                                                                                                                                                                               | 19.8 Nr. 12, KONZEPT 17                |
| S12 Zahlen-Schalter                              | gilt für alle neuen Ansichten, Playwright                                                                                                                                                                                                                                                                          | 19.6, 19.8                             |
| S13 veraltete Stellen                            | 2.2, 5.4, 17 und N2a-Abbildungstabelle markiert                                                                                                                                                                                                                                                                    | 19.1                                   |
| S14 Carb-Loading                                 | Fett ≥ 20 %, Eiweiß-Minimum, Erhalt statt Defizit (PRODUKTENTSCHEIDUNG), Ratgeber-Hinweis, R21 gelb für g/kg                                                                                                                                                                                                       | 19.4, 19.7 W1                          |
| K1–K11                                           | übernommen: Fragen (a)/(b) neu gefasst (K1/K2), Ernährungsform erweiterbar (K3), `CARDIO_RECIPE_MIN_MINUTES` (K4), Händler-Bedingungen (K5), Gründe ohne Energie-Einfluss (K6), Slots/Vorrang/Daumen runter (K7), N2c-DoD (K8), Abdeckungshinweis (K9), Formulierungen (K10), Tausch in gemeinsamer Mahlzeit (K11) | 19.2–19.12                             |

---

## Umsetzungsstand

(wird je Etappe ergänzt)

### N0 – Plan (umgesetzt, 10.10.2026)

Nur Dokumentation, kein Code, keine Migration.

1. **Plan** liegt als `docs/PLAN-PHASE-5.md` vor (Fassung 3, beide Wächter-Runden eingearbeitet). Status oben auf „freigegeben, N0 umgesetzt“.
2. **Offene Fragen 16 B:** Gründer-Antwort vom 10.10.2026 „Alles wie empfohlen“ – jede Frage (a)–(m) ist mit „Entscheidung: Empfehlung gilt (Stand 10.10.2026)“ markiert; (l) gilt als Vorgabe für Phase 7.
3. **Festgehaltene Entscheidungen:**
   - **S8 – CHECK-Migration in N4:** `nutrition_setup` kommt in N4 in `ONBOARDING_STEPS`, im selben PR eine kleine Migration für die CHECK-Liste `profiles.onboarding_step` (läuft beim Merge über `db-migrate.yml`); neue Enums erst in N7; `db-sync.test.ts` bleibt grün (8.1, 13 N4, 16 B (j)).
   - **R2-S3 – Schritt im Supabase-Modus bis N7 ausgeblendet:** `OnboardingState.nutritionSetupAvailable` (nur `true` = anwendbar); bis N7 setzt nur das lokale Backend (Testmodus) den Wert, N7 schaltet den Supabase-Modus zusammen mit der Spalten-Migration um (8.1, 9, 13 N4/N7, W21).
4. **`docs/PLAN-PHASE-4B.md` nachgetragen (S10, R2-S5):** `nutrition/limits.ts` kommt aus Phase 5; `clampCalorieAdjustment(currentOffsetKcal, proposedOffsetKcal)` begrenzt nur Schrittweite und Summe des Versatzes; 4b-Anpassungen fließen als `adjustmentKcal` in `nutritionTargetsForWeek` und laufen immer durch `clampCalorieTarget` (einzige Stelle mit Schutzgrenzen). Liste „Grenzen“ in 4b-Abschnitt 5.2 umformuliert; außerdem angeglichen: Status/Reihenfolge (Phase 5 vor 4b A), Wächter-Befund K1, Abgrenzung 2.2, Tests 5.8, Etappe A, Definition of Done, Frage 3 und Risiko 11.
5. **`docs/PROMPTS.md`:** Status Phase 5 (Plan freigegeben, N0 erledigt), Phase 4b (A0 erledigt, Reihenfolge) und neuer Eintrag „Übungs-Glossar und Übungstausch“ (G1, T1, T2 erledigt; T3 später mit Supabase, G2 später).
6. **`docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md`:** Status oben auf „G1, T1, T2 umgesetzt; T3/G2 später“.
7. **Gegenprüfung der R2-Blocker** (R2-B1 `TagesbedarfGrenze` + Rechenbeispiel, R2-B2 Herkunft des Quellauszugs, R2-B3 Gruppen-IDs/Regeltabelle): **BESTANDEN MIT HINWEISEN (10.10.2026)**, Bericht `waechter-n0.md`; R2-B1 und R2-B3 vollständig gelöst, Rechenbeispiel nachgerechnet. **H1–H3 eingearbeitet:**
   - **H1 (vor N2b):** `sources-integrity` lädt die Original-Datei immer neu, URL aus `sources.ts` von `main` (Allowlist, feste Version); Commits unter `content/sources/**` nur „verified“ vom Bot; Ruleset + CODEOWNERS als Gründer-Aufgabe in N2b; W18 um „gefälschter Bot-Autor“ und „geänderte URL“ ergänzt (5.1, 5.1.1 b, 13 N2b, 12.2).
   - **H2 (N1):** `surplusCap` immer gesetzt, Standard 0,10, Sonderfälle 0,05, Bereich [0,05; 0,10]; Test W26 (4.6, 4.9).
   - **H3 (N1):** `ADJUSTMENT_STEP_MAX_KCAL = 150` schon in N1 (4b wählt `calorieStepKcal` ≤ 150); W23 präzisiert („schon ohne Versatz“); Obergrenze `dayCeilingKcal` in jedem Modus, Eigenschaftstest „Ziel ≤ Obergrenze“ und „Band nicht leer“ (W27); 4b 5.2/5.8 angeglichen.
   - **Kann:** Negativliste „Eierschwammerl“, „Leberkäse“, „Fleischkäse“; Hackfleisch ohne Angabe `meat_kind: ['beef', 'pork']`; Überschrift 4b 5.2 korrigiert.

### N1 – Core: Bedarf, Grenzen, Makros, Timing (umgesetzt, 11.10.2026)

Nur reine Logik in `packages/core`, keine Migration, keine App.

1. **Dateien** `packages/core/src/nutrition/`: `energy.ts` (Mifflin, Katch-McArdle, `bmrForNeeds`/`bmrForFloor`, Alltagsfaktor, MET je Einheit, `sessionsForDay`, Trainingsenergie netto/brutto mit Deckel, Janmahasatian, `dailyEnergy`/`dailyEnergyForLimits`, `dayEnergy`), `body-data.ts` (`latestBodyValues` je Feld, BMI), `limits.ts` (`dayFloorKcal`, `dayCeilingKcal`, `planBand`, `roundWithin` (gerichtete Rundung), `applyGoalAdjustment`, **`clampCalorieTarget`** als einzige Stelle mit Schutzgrenzen, **`clampCalorieAdjustment`** nur Schritt ≤ 150 / Summe ±1.000), `eligibility.ts` (`nutritionEligibility`), `macros.ts`, `timing.ts`, `targets.ts` (`nutritionTargetsForWeek`), `notices.ts`, `schemas.ts` (Zod für Eingaben, Kontext der Grenzen, `surplusCap` ∈ [0,05; 0,10], `deficitCap` ∈ [0; 0,25], Versatz ±1.000, Montag als Wochenbeginn). Export über `packages/core/src/index.ts`.
2. **Konstanten** in `constants.ts`, Abschnitt „Phase 5 · Ernährung“, jeweils mit Quelle bzw. PRODUKTENTSCHEIDUNG; nicht offline bestätigte Angaben sind als **„VOR LIVEGANG FACHLICH PRÜFEN“** markiert.
3. **Tests** (Vitest, 126 Tests in `nutrition/`): 12.1 (Bedarf, Grenzen exakt, Sonderfälle, Makros, Timing jede Trainingszeit × 1–8 Mahlzeiten) und **W1, W3, W4 (Core-Teil), W5, W6, W7, W8, W13, W14, W17, W23, W25, W26, W27**. Eigenschaftstests mit unabhängig nachgerechneten Erwartungen (`targets-properties.test.ts`, fester Seed, kein `Math.random`): 600 Zufallspersonen × 4 Versätze (−1.000 / 0 / zufällig / +1.000) über Gewicht 30–300 kg, Größe 100–250 cm, Alter 16–100, Körperfett 3–60 % (auch > 90 Tage alt), alle Ziele/Geschlechter/Flags/Alltagsfaktoren, 0–7 Tage mit bis zu 2 Einheiten, plus Raster W17 (KF × Gewicht × Größe × Alter × Ziele × 0/7 Einheiten × ±1.000): Ziel und Band-Untergrenze ≥ Grundumsatz, ≥ 75 % und ≥ „−1 %/Woche“ des Gesamtumsatzes **nach Mifflin und nach Katch-McArdle**, ≥ EA-Untergrenze, Sonderfall-Deckel; Ziel ≤ Obergrenze; Band nie leer; Makros ±10 kcal. Gegenprobe: absichtlich eingebaute Fehler (Defizit vom Katch-Tagesbedarf, Obergrenze +20 %) lassen die Eigenschaftstests rot werden.
4. **CI-Tabelle „Beispiel-Ernährung“** (`packages/content/src/nutrition-examples.ts`, Skript `pnpm nutrition:examples`, Schritt in `ci.yml`): Personen A–H, Woche ab 12.10.2026; Test prüft B ≥ 1.101,5, D ohne Defizit, E ohne Zahl, F mit EA-Hinweis und mehr Kohlenhydraten am langen Lauftag, G Erhalt + Check-Hinweis, **H am Ruhetag 1.910 kcal**.
5. **KONZEPT 6** „Umsetzung ab Phase 5“ und **PROMPTS** (Status) nachgetragen.

**Abweichungen / Präzisierungen gegenüber dem Plan:**

- **Unter 18 und Untergewicht:** Defizitdeckel **0 bei jedem Ziel** (Plan: `maintenance_only` bei Fettverlust/Definition). Strenger, damit ein negativer 4b-Versatz bei `general_fitness`/`endurance` kein Defizit erzeugt (Gründer-Entscheidung 2 „kein Defizit“). Der Modus bleibt bei den anderen Zielen `full`.
- **Kein Check bei Geschlecht ≠ männlich → `maintenance_only` bei jedem Ziel** (auch `muscle_gain`), wie im Beispiel in 4.6 angenommen.
- **Rezept-Ausschluss `pregnancy_caution`** auch ohne Einwilligung bei Geschlecht ≠ männlich (dann gibt es keinen Check – Schwangerschaft nicht ausgeschlossen); nutzt keine Gesundheitsdaten.
- **BMI-Regeln** (Untergewicht, 18,5–20) nur ab 18; das Referenzgewicht für Eiweiß (BMI ≥ 30) gilt für alle, weil es Eiweiß nur senkt.
- **Makros:** Eiweiß nie mehr, als neben 20 % Fett ins Tagesziel passt (Energie verbindlich) – greift nur bei unrealistischen Kombinationen. Kohlenhydrat-Richtwert Ausdauer = untere Werte der Spannen (3/5/6 g/kg); nur beim Ziel `endurance`.
- **Gerichtete Rundung:** Liegen Unter- und Obergrenze < 10 kcal auseinander, gilt `ceil10` der Untergrenze (wie 4.6.2) – das Ziel kann dann bis zu 10 kcal über der Obergrenze liegen; Eigenschaftstest prüft genau das.
- **Timing (PRODUKTENTSCHEIDUNG):** angenommene Startzeiten früh 6:30, vormittags 9:30, mittags 11:30, nachmittags 16:00, abends 17:30; „vor dem Training“ = letzte Hauptmahlzeit 2–4 h vorher (Plan 2–3 h, wegen fester Uhrzeiten erweitert), Snack 30–60 min vorher, „nach dem Training“ = nächste Mahlzeit bis 2 h nach Ende; Plätze für 7–8 Mahlzeiten (Snack 17:00 und 21:30) und Anteile je Layout festgelegt.
- **Namen:** `eligibility()` heißt `nutritionEligibility()` (eindeutig im Core-Export). `nutritionInputsSchema` enthält von den Vorlieben in N1 nur `mealsPerDay`; Ernährungsform, Abneigungen usw. kommen in N3. Neue Aufzählungen (`ACTIVITY_LEVELS`, `TRAINING_TIMES`) liegen bis N7 in `nutrition/schemas.ts`, nicht in `enums.ts` (S8).
- Körperfett-Alter und „Gewicht älter als 90 Tage“ werden **je Tag** geprüft (Katch kann innerhalb der Woche wegfallen).
- Hinweis-Codes ergänzt: `no_health_data_consent`, `body_data_missing`, `medical_consult`, `activity_level_default`, `endurance_carbs_below_target`, `early_training`, `pregnancy_caffeine` (16 B (m)). Texte erst in N4.

**Offene Fachprüfungen (vor Livegang, in `constants.ts` markiert):**

- **Compendium-Codes (S11c):** in N1 ohne Originalzugriff nur nach Erinnerung zugeordnet (Kraft 02054, Laufen 12029/12020, Gehen 17190/17200, Rad 02012/01020, Schwimmen 18310); für Rad 5,5 und Schwimmen 5,0 kein Code bestätigt. Der Plan nennt für „Gehen zügig“ 17231 – der Wert 4,3 passt nach unserer Erinnerung eher zu 17200. Werte gegen das Compendium 2024 prüfen.
- **Loucks 2011 / Mountjoy 2023:** ob EEE brutto oder netto definiert ist – umgesetzt brutto (vorsichtigere Richtung).
- **Janmahasatian 2005:** Formel wie bekannt umgesetzt (Rechenbeispiel 53,82 kg bestätigt), Seite nicht geprüft.
- **Koletzko 2018:** vollständiges Zitat (nach unserer Kenntnis Geburtshilfe Frauenheilkd 78(12):1262–1282) nicht am Original geprüft.
- **BfR-Koffein-Hinweis:** Wortlaut nicht geprüft (Wert 200 mg/Tag, EFSA 2015).
- **Katch-McArdle** (Lehrbuch-Auflage/Seite) und **D-A-CH-PAL-Tabelle** (Auflage/Seite).
- Alle PRODUKTENTSCHEIDUNGEN (Zielanpassung, Sonderfall-Deckel, Eiweiß, Timing) durch die Ernährungsfachkraft (Gründer-Entscheidung 6).

**Wächter-Prüfung N1 (11.10.2026): MIT AUFLAGEN, keine Blocker** (Bericht `waechter-n1.md`). Umgesetzt:

- **S1 – divers/keine Angabe:** Für alle Schutzgrenzen Mifflin mit dem männlichen Offset (+5) und FFM nach der Männer-Formel (Janmahasatian); der Vorschlag bleibt beim Mittelwert −78 (`bmrMifflinStJeor(…, 'limits')`, `estimateFatFreeMass(…, 'limits')`, `MIFFLIN_ST_JEOR.limitsSexOffsetUnknown`). Beispiel aus dem Bericht als Test: 80 kg/180 cm/36 J., Fettverlust, Versatz −1.000 → 1.910 kcal (vorher 1.820 = 28,3 % unter dem Männer-Gesamtumsatz), jetzt ≤ 25 %. Abschnitte 4.3 und 4.6 angepasst.
- **S2 – über 24 h Training an einem Tag:** `targets.ts` begrenzt die Minuten für den Kohlenhydrat-Richtwert auf 1.440; zwei Einheiten à 800 min ergeben Ziele mit `training_energy_capped` statt eines Fehlers (Test).
- **S3 – Eigenschaftstest unabhängig:** `targets-properties.test.ts` neu nach Vorbild `n1-adv.ts`: Modus, Defizitdeckel (inkl. BMI 18,5–20 → 10 %, Untergewicht → 0) und Obergrenze (inkl. `muscle_gain`) werden aus den Eingaben hergeleitet; variiert werden zusätzlich Status/Planversion der Einheiten, `today` an jedem Wochentag (auch davor/danach), 1–3 Körperdaten-Zeilen (auch Zukunft), Minuten bis 1.440, Einwilligung, 5 Wochen (29.02.2028, Zeitumstellung). Gegenprobe: S1 zurückgedreht bzw. Erhalt bei „kein Check, weiblich“ entfernt → Test rot.
- **K1:** Zod in `nutritionEligibility`, `dayEnergy`, `trainingEnergy`, `sessionsForDay`, `bmrMifflinStJeor`.
- **K2:** Strukturtest: `clampCalorieTarget`/`dayFloorKcal`/`dayCeilingKcal` werden außerhalb von `limits.ts`/`targets.ts` (und Tests) nirgends aufgerufen.
- **K3:** `latestBodyValues(rows, asOf)` – Körperdaten mit Datum nach `today` zählen nicht.
- **K4:** Iraki-Zuschreibung des 10-%-Deckels korrigiert (PRODUKTENTSCHEIDUNG, vor Livegang prüfen).
- **K5:** Alter höchstens 120 Jahre (`NUTRITION_MAX_AGE_YEARS`, verständliche Meldung), Wochenbeginn höchstens ein Jahr von `today` entfernt; gerichtete Rundung landet auch bei Gleitkomma-Resten nie unter der Untergrenze.
- **K6 – Abweichung:** Die Vorbedingung „Zitate **vor** N1 gegen das Original prüfen“ (13, N1) wurde **nicht** erfüllt (kein Originalzugriff); sie ist auf die Fachprüfung vor N7/Livegang verschoben und in die DoD von N7 aufgenommen. Sicherheitsrelevant sind vor allem die MET-Werte (zu niedrige Werte senken Ziel **und** Untergrenzen).
- **K7:** Hinweis für N4 (Alltagsaktivität abfragen, Körperdaten-Datum) in Etappe N4 vermerkt.

**So testest du es am Handy:** Pull Request → Checks → ci → Summary → „Beispiel-Ernährung“ (siehe Abschnitt 15, N1).

### N2a – Inhalte: Schemas, Prüfregeln, Einheiten (umgesetzt, 11.10.2026)

Nur reine Logik und Test-Fixtures in `packages/core`, kein echter Katalog, kein Import, keine Migration, keine App.

1. **Schemas** (`packages/core/src/content/`): `food-schema.ts` (`foodSchema` strikt nach 5.1, `SHOPPING_CATEGORIES` mit deutschen Namen in fester Reihenfolge 5.5, `ANIMAL_KINDS` mit Kommentar `'egg'` ≠ Gruppe `eggs`, `MEAT_KINDS`, `GELATIN_ORIGINS`, `SOURCE_DATABASES`, neutrale `SOURCE_FOOD_CATEGORIES`, `foodMetaSchema` mit `catalog_reviewed_by/at`, Schemas für Quellzeile, Erwartungsliste und Ausnahmeliste) und `recipe-schema.ts` (`recipeSchema` strikt nach 5.2 mit `heated`, `declared_pregnancy_caution`; `heated: true` in `no_cook` = Schemafehler).
2. **Einheiten** `nutrition/units.ts`: g, ml, Stück, EL, TL, Prise; `gramsPerUnit`/`toGrams` (null = nicht umrechenbar, R2), `roundAmount` nach 6.2 (nie auf 0), `unitLabelDe`.
3. **`nutrition/recipe-nutrients.ts`**: `computeRecipeFacts` – Nährwerte (ohne optionale Zutaten), Ernährungsform, Allergene, Schwein, Alkohol, kleinste Haltbarkeit und **`pregnancy_caution` aus Katalog-Flag, `heated: false` und `no_cook`** (R2-S2), inkl. Weglassen optionaler Zutaten (S3) und Ersatz-Zutaten (S4); dazu `foodDiet`, `dietAllows`, `foodContainsPork` (Gelatine ohne Herkunft = Schwein), `needsHeatedFlag`.
4. **`allergen-rules.ts` (R18)**: `ALLERGEN_RULES: Readonly<Record<FoodGroupId, GroupRule>>` für **alle 23 Gruppen** (fructose/histamine `human_only` mit Begründung; tree_nuts/sulphites mit Hinweis auf menschliche Prüfung), Erkennung über **ganze Wortteile** (Wort, Wortanfang, Wortende, Bindestrich-Teile; `=wort` nur als eigenes Wort, Wortfolgen) mit **Negativliste** (u. a. Kokos-/Soja-/Hafer-/Mandel-Milch, Erdnuss-/Kakaobutter, Butternuss, **Leberkäse/Fleischkäse ≠ dairy, Eierschwammerl ≠ eggs**, Tintenfisch ≠ fish, Schafskäse ≠ lamb, Austernpilz ≠ shellfish, Muschelnudeln, Reis-/Mais-/Buchweizenmehl, Glasnudeln), **Quell-Lebensmittelgruppe** (Getreide/Brot → gluten mit Ausnahmen Reis/Mais/Hirse/Buchweizen/Quinoa/Amaranth, Milch → dairy + lactose, Fisch, Krebs-/Weichtiere, Fleisch nach Tierart, Eier, Pilze, Hülsenfrüchte/Soja), Zusatzregeln **Schwein, Fleisch, Gelatine, Hackfleisch ohne Angabe (`beef` + `meat_kind: ['beef', 'pork']`), `pregnancy_caution`, Alkohol** und Folgeregeln (`animal` ⇒ Gruppe, Tierart ⇒ Gruppe, `dairy` ⇒ `lactose` außer „laktosefrei“ in der Quell-Bezeichnung).
5. **`recipe-checks.ts`**: R2–R14, R16–R19 (`checkFood`, `checkRecipe`, `recipeCoverageReport`/`checkRecipeCoverage`); R1 (Schema + fehlendes `heated`) und R15 (Version) in `validateContent`. Regeltabelle `CONTENT_RULES` um R1–R19 erweitert (R1/R15 blockieren immer wie Ü1/VERSION; R5, R11, R16 gelb).
6. **`validateContent(files, { nutritionCatalog })`** prüft zusätzlich Dateien der Art `food`/`recipe` (`NutritionContentFile`); Ergebnis enthält `foods` und `recipes`. Übungen/Vorlagen unverändert.
7. **`selectNutritionContent(result, { allowDrafts })`** (`content/nutrition-select.ts`, R2-S6): nur `published` bzw. im Testmodus Entwürfe ohne roten Befund; Lebensmittel nur katalog-geprüft (R19); Rezept nur, wenn alle Lebensmittel ausgewählt sind; Ausschlüsse mit Grund (`excluded`), `containsDrafts` für die Kennzeichnung.
8. **Health-Claims-Liste** in `text-rules.ts` (`HEALTH_CLAIM_TERMS`, `FORBIDDEN_FOOD_BRANDS`, `findNutritionTextRuleHits`; Übungen weiter nur mit `findTextRuleHits`). **`FOOD_GROUPS.gluten`** heißt jetzt „Glutenhaltiges Getreide (Weizen, Dinkel, Roggen, Gerste, Hafer)“ (E2E-Screenshot-Test angepasst).
9. **Konstanten** in `constants.ts`, Abschnitt „Phase 5 · Lebensmittel und Rezepte“: `FOOD_SCHEMA_LIMITS`, `MEAL_PREP_FRIDGE_DAYS`, `RECIPE_SCHEMA_LIMITS`, `PINCH_G`, `AMOUNT_ROUNDING`, `RECIPE_CHECK_LIMITS`, `RECIPE_COVERAGE`.
10. **Test-Fixtures** `content/nutrition-fixtures.ts`: 31 Lebensmittel (Testwerte, keine Quelldaten) mit passendem Quellauszug und Erwartungsliste, 7 Rezepte (Porridge mit optionalen Erdnüssen, Spaghetti mit optionalem Parmesan, Mascarponecreme mit rohem Ei, Brot mit Räucherlachs, Omelett, Hähnchen/Reis Meal-Prep, Tofu vegan), `makeFood`/`makeRecipe` für absichtlich fehlerhafte Varianten – Grundlage für N3.
11. **Tests** (Vitest): jede Regel R1–R19 mit gültigem und verletztem Fall (`recipe-checks.test.ts`, `validate.test.ts`, `rules.test.ts`), **W9 (Regelteil)**, **W19 (Regeln)**: Typ + Laufzeit-Test über alle 23 Gruppen, 118 Namens-Fälle (Treffer, Negativliste, Grenzfall je Gruppe: Nudeln/Brot/Mehl/Paniermehl → gluten; Reis/Weizen/Fleisch/Eisbergsalat ≠ eggs; Kokosmilch/Erdnussbutter/Kakaobutter/Sojasahne ≠ dairy; Käsesorten → dairy; Tintenfisch → shellfish ≠ fish; Schafskäse ≠ lamb; Muskatnuss/Kokosnuss ≠ tree_nuts; Eierschwammerl → mushrooms ≠ eggs; Leberkäse/Fleischkäse ≠ dairy, aber Schwein; Hackfleisch → beef + pork …), **W20** (rohes Ei, `no_cook` mit Räucherlachs, gebratenes Ei, R13 in beide Richtungen, Rohmilchkäse/Salami/Leber ohne Flag → R18), **W24 (Funktion)**.

**Abweichungen / Präzisierungen gegenüber dem Plan:**

- **Quell-Lebensmittelgruppe neutral:** `source.category` ist eine neutrale Aufzählung (`SOURCE_FOOD_CATEGORIES`). Die Zuordnung „BLS-Schlüssel (erstes Zeichen) bzw. Kategorie der Quelle → neutrale Gruppe“ mit Quellenzitat kommt erst mit dem Import in **N2b**, weil Hauptquelle und Version erst nach der Lizenzklärung feststehen (die BLS-Hauptgruppen konnten offline nicht verlässlich zitiert werden). Zusätzlich neues Pflichtfeld **`source.name`** (Bezeichnung in der Quelle), weil R18 sie prüft (5.1.3) und „laktosefrei“ nur dort zählt.
- **R17 in N2a nur der reine Vergleich:** `checkFoodSource` vergleicht mit eingelesenen Quellzeilen (`SourceNutrientRow`); das Einlesen von `extract.csv`, `SOURCE.json` und `sources-integrity` folgen in N2b. **Ohne geladenen Quellauszug bzw. ohne Erwartungsliste ist jedes Lebensmittel rot** (sichere Richtung) – N2c muss Quellauszug, Erwartungs- und Ausnahmeliste deshalb mit ins App-Bundle nehmen und als `nutritionCatalog` an `validateContent` geben.
- **R19 „nur über content-review“** (CI-Prüfung des Branches/Autors) kommt mit N2b; N2a prüft Katalog-Prüfung am Rezept (rot), an freigegebenen Lebensmitteln (rot) und in `selectNutritionContent`.
- **Fehlendes `heated`** wird als **R1** (Schema, blockiert immer) gemeldet, weil es ein Pflichtfeld ist, das Schema allein die Gruppen des Lebensmittels aber nicht kennt. Fehlt es, zählt die Zutat als ungegart (sichere Richtung).
- **R9 zusätzlich je Lebensmittel:** Reis, Fisch, Krebs-/Weichtiere, Hackfleisch und Geflügel mit `max_fridge_days` > 1 → rot (S12). Der **BfR-Wortlaut** konnte offline nicht geprüft werden → in `constants.ts` als „VOR LIVEGANG FACHLICH PRÜFEN“ markiert.
- **R4** zusätzlich mit ±4 kcal absoluter Mindest-Toleranz (sehr energiearme Lebensmittel), PRODUKTENTSCHEIDUNG.
- **R11 Öl** = Lebensmittel der Abteilung „Öle, Essig & Saucen“ mit ≥ 90 g Fett je 100 g; **Salz** = berechneter Salzgehalt je Portion (nicht nur die Zutat „Salz“).
- **R5:** Bei mehreren Mahlzeiten-Typen reicht es, in einer Spanne zu liegen.
- **Gluten-Negativliste** wirkt vor „Mehl/Nudeln/Grieß/Stärke“, **nicht vor „Brot“** (Mais-/Kartoffelbrot enthalten meist Weizen – sichere Richtung).
- **Ergänzungen (sichere Richtung):** Regel für Alkohol-Wörter (R12-Absicherung) und für Fleisch allgemein (Wurst, Schinken …); `pregnancy_caution` auch für Räucherfisch allgemein (Räucherforelle/-makrele), Tatar, Carpaccio, Ceviche, Chorizo, Lachsschinken; Leberkäse bleibt vorsichtig `pregnancy_caution` (in manchen Regionen mit Leber). „Eiweiß“ trifft `eggs` nur als eigenes Wort (Eiweißpulver nur nach Quelle).
- **R16** meldet je Kombination einen gelben Befund (Art `recipe_library`); ohne Rezepte kein Bericht. Die CI-Zusammenfassung „Abdeckung“ kommt mit N2c. `recipeCoverageReport` zählt optionale Zutaten als weglassbar.
- **Health-Claims-Liste** um „proteinreich“, „High Protein“, „ohne Zuckerzusatz“, „vitaminreich“, „Fettverbrennung“, „Abwehrkräfte“ und „gesund“ (außer „Gesundheits-Check“) ergänzt.
- Neue Aufzählungen bleiben bis N7 außerhalb von `enums.ts` (S8). `ContentFileKind` bleibt bei Übung/Vorlage; Lebensmittel/Rezepte laufen über `NutritionContentFileKind`, bis N2c die Ordner (`CONTENT_FOLDERS`, `bundle-content.mjs`) ergänzt. `ContentKind` kennt `food`, `recipe`, `recipe_library` (Bezeichnungen in `packages/content/src/validate.ts` und `apps/web/src/lib/admin/labels.ts` ergänzt).

**Abbildung `alpha5-rezepte.json` (Gründer-Upload 11.10.2026, Vorgabe für den Import in N2c; maßgeblich ist seit dem Nachtrag Abschnitt 19.2, abweichende Zeilen sind markiert):** Die Datei (242 Rezepte, 236 Zutaten, 4 Meal-Prep-Pläne, 2 Ratgeber) wird der Rezeptbestand; sie bleibt unverändert (seit #32 unter `packages/content/seed/alpha5-rezepte.json`; Ergänzungen in Abschnitt 19). In N2a ergänzt (klein, optional): `tip_de`, `tags_de[]` (≤ 10 × ≤ 40 Zeichen), `meal_prep_plan_id` am Rezept und `display_de` an der Zutat – alle mit R10 geprüft. Geprüft: Namen ≤ 59, Beschreibungen ≤ 188, Tipps ≤ 316, ≤ 16 Zutaten, ≤ 7 Schritte, Portionen 1 bzw. 5 – passt in die Schema-Grenzen. Abbildung der übrigen Felder:

| Datei                                                            | Schema / Regel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `beschreibung`, `status`                           | `id`, `title_de`, `description_de`, `status` (alle `draft`, `meta.origin` = `manual` bzw. Gründer-Kürzel als Herkunft festlegen)                                                                                                                                                                                                                                                                                                                                                                                                |
| `abschnitt`                                                      | `meal_types`: Frühstück → `breakfast`, Mittagessen/Abendessen/Hauptgericht → `main`, Snack → `snack`; Trainings-Abschnitte („60–90 Min. vorher“, „30 Min. vorher“, „Direkt danach“, „Bis 2 Stunden danach“, „Vor langen Einheiten“, „Während der Einheit“, „Nach der Einheit“) → `snack` + `training_tags`; Wettkampf-Abschnitte (Carb-Loading, Renntag-Frühstück, Im Rennen, Nach dem Ziel, Am Vorabend) gehören zu Phase 10 – in N2c als Entwurf importieren, aber nicht im Essensplan verwenden (Vorschlag: Tag `wettkampf`) |
| `ernaehrungsformen[]`, `kategorie`                               | **nicht übernommen**, nur Gegencheck: Ernährungsform und „ohne Schwein“ berechnet der Core aus den Zutaten (`declared_diet`, `contains_pork`; R6/R8). Abweichung zur Datei im Import-Bericht melden **→ ersetzt durch 19.2: `declared_diet`, `contains_pork`, `categories[]`**                                                                                                                                                                                                                                                  |
| `tags[]`                                                         | „ohne Kochen“ → `no_cook` (+ `cook_minutes` 0, R14); „Meal-Prep“ → `meal_prep.suitable` (Haltbarkeit aus den Zutaten, R9; `tipp` als Hinweis); „vor/nach dem Training“ → `training_tags`; alles andere (Unter 10 Minuten, zum Mitnehmen, Dessert, Spar-Küche, Ausdauer, Wettkampf) → `tags_de`                                                                                                                                                                                                                                  |
| `zeit_min`                                                       | Gesamtzeit; Schema hat `prep_minutes` + `cook_minutes`. Import: ohne Kochen `prep = zeit_min`, `cook = 0`; sonst Aufteilung beim Import festlegen (Vorschlag: aus den Schritten schätzen und bei der Freigabe prüfen) – Abweichung von 5.2, ggf. Feld `total_minutes` ergänzen **→ entschieden in 19.2/19.4: `total_minutes`**                                                                                                                                                                                                  |
| `portionen`                                                      | `servings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `zutaten[{zutat_id, menge_g, anzeige}]`                          | `food_id` (Zuordnung `zutat_id` → Katalog-ID), `amount` = `menge_g`, `unit` = `g`, `display_de` = `anzeige`. **472 Zutaten mit `menge_g: 0`** („1 Prise“, „½ TL“, „nach Geschmack“): Prise → `unit: pinch`, TL/EL → `tsp`/`tbsp` mit Katalog-Umrechnung; „nach Geschmack“ → `pinch` 1 + `scales: false` (Schema verlangt Menge > 0). `heated` für jede tierische Zutat muss beim Import gesetzt werden (`no_cook` → false, sonst aus den Schritten ableiten und bei der Freigabe prüfen)                                        |
| `zubereitung[]`, `tipp`                                          | `steps_de`, `tip_de` (Sprache „du“ bleibt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `naehrwerte_pro_portion`                                         | `declared_per_serving` (Gegencheck R3); maßgeblich sind die aus dem Katalog berechneten Werte                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `kosten_eur_pro_portion` (10 Rezepte), `preis_eur_kg_schaetzung` | nicht übernommen (Budget nicht im Kern, Plan 2.2; `cost_level` bleibt reserviert) **→ ersetzt durch 19.2/19.4: `cost_estimate` (nur nach Freigabe sichtbar)**                                                                                                                                                                                                                                                                                                                                                                   |
| `meal_prep_plan` (12 Rezepte), `meal_prep_plaene[]`              | `meal_prep_plan_id`; die Pläne selbst (Kochtag-Ablauf, Aufbewahrung) brauchen eine eigene Inhaltsart (Vorschlag N2c: `content/meal-prep-plans/`, Nutzung in N3/N5) **→ Inhaltsart `meal_prep_plan` in 19.4**                                                                                                                                                                                                                                                                                                                    |
| `zutaten[]` (236, `pro_100g` mit 4 Werten, `abteilung`)          | Lebensmittel-Katalog (N2b): Nährwerte **nur aus der amtlichen Quelle** (BLS-Zuordnung je Zutat); `pro_100g` der Datei nur als Gegencheck – Abweichung > 3 % wird im Import-Bericht gemeldet (neue Regel in N2b/N2c). `abteilung` (11 Werte) → `shopping_category` (15 Werte, 5.5) per Zuordnung je Lebensmittel, z. B. „Kühlregal & Molkerei“ → `chilled_dairy_eggs`, „Pflanzliche Alternativen“ → `chilled_plant_based`, „Fleisch & Fisch“ → `meat_sausage` bzw. `fish`                                                        |
| `ratgeber`, `hinweise`                                           | nicht Teil der Rezept-Schemas (Ratgeber Wettkampf → Phase 10; Texte vorher gegen R10 prüfen) **→ ersetzt durch 19.4/19.6: Inhaltsart `guide`, ab N2c/N4 gratis lesbar; Wettkampf-Planung W1**                                                                                                                                                                                                                                                                                                                                   |

**Wächter-Prüfung N2a (11.10.2026): NICHT FREIGABEFÄHIG bis B1–B3, danach MIT AUFLAGEN** (Bericht `waechter-n2a.md`, Probe-Skripte als Regressionstests in `allergen-rules-n2a.test.ts` übernommen). Umgesetzt:

- **B1 – Gruppe ⇒ tierischer Bestandteil:** neue Pflichtregeln `animal_egg`/`animal_fish`/`animal_shellfish`/`animal_dairy` (aus Gruppe am Lebensmittel oder Wort-/Quellgruppen-Pflicht), damit Lachs, Ei oder Quark mit `animal: []` rot sind und nie als vegan gelten; Wortregeln **Honig → `animal: honey`** (nicht Honigmelone) und **Parmesan/Parmigiano/Grana Padano/Pecorino/Gorgonzola/Pesto → `animal_rennet`** (vegetarische Sorten nur über die Ausnahmeliste mit Quelle).
- **B2 – Unicode:** `normalizeFoodText` setzt zuerst NFC zusammen (zerlegte Umlaute aus macOS/CSV); ebenso die Textregeln (R10). Test mit 20 Umlaut-Pflichtwörtern in NFD.
- **B3 – Schwangerschaft:** „geräuchert/gebeizt/mariniert/Räucher-“ zusammen mit Fisch bzw. Krebs-/Weichtieren → `pregnancy_caution` (Schreibweise der Quellen „Lachs, geräuchert“, auch „heiß geräuchert“); Pflichtwörter Matjes, Rollmops, Bismarckhering, Kaviar, Rogen, Graved Lachs.
- **S1 – Wortlücken:** u. a. Obers/Schlagobers, Yoghurt/Yogurt, Tzatziki, Cottage Cheese, Whey, Paneer, Raclette, Crème double, „Crème-fraîche“ (Wortfolgen jetzt auch mit Bindestrich); Brezel/Breze, Knödel, Brösel, Müsli, Porridge, Kuskus, Udon, Ramen, Orzo/Kritharaki, Maultaschen, Ravioli/Tortellini, Pfannkuchen/Palatschinken, Croutons, Pumpernickel, Teriyaki/Hoisin, Ciabatta/Focaccia/Naan, Kipferl/Gipfeli/Weggli; Aioli, Remoulade, Hollandaise, Löffelbiskuit, Spätzle, Omelett; Worcester(-soße/ Sauce), Wildlachs, Seehecht, Dorade, Seezunge u. a.; Crevetten, Prawns, Langustinen, Pulpo, Vongole, Schnecken; Hühnchen, Chicken, Wachtel („Hühnereintopf“ ist jetzt Geflügel, nicht Ei); **Hackfleisch-Regel** für Hackbällchen, Faschierte (Laibchen), Cevapcici, Frikadellen/Buletten (mit ausdrücklicher Tierart wie Rinder-/Puten-/Soja- nicht „Rind + Schwein“); Tafelspitz, Ochse; Pesto (`dairy` + `tree_nuts` + Lab), Marzipan, Nougat, Nüsse/Nussmischung/Studentenfutter/Baumnüsse; Halva, Hummus → `sesame`; Suppengrün/-gemüse, Fond (nicht Fondue) → `celery`; Trockenmarillen, Balsamessig, Rosinen/Sultaninen → `sulphites`. **Neue gelbe Regel R18H:** Kernwort mitten im zusammengesetzten Wort (z. B. „Vollmilchschokolade“, „Vollkornhaferflocken“), dessen Gruppe fehlt → Hinweis zur menschlichen Prüfung.
- **S2 – Schwein im Zweifel:** Wurst, Würstchen, Lyoner, Mortadella, Krainer, Cervelat, Guanciale, Lardo, Selchfleisch/Geselchtes, Leber- und **Fleischkäse** sowie Salami jeder Art (auch Wild-/Hirsch-/Rindersalami) → `pork`; ausgenommen nur Puten-/Hähnchen-/Geflügelschinken und -speck sowie pflanzliche Wurst. Abweichende Produkte nur über die Ausnahmeliste mit Quelle.
- **S3:** Ausnahmen der Quellgruppe (Reis, Mais …) nur noch aus `source.name`, nie aus Aliasen.
- **S4:** R9 prüft die Kühlschrank-Haltbarkeit **immer** gegen die kürzeste Zutat; `freezable` erlaubt nur längere Abstände eingefroren (Tabelle 5.3 präzisiert).
- **S5:** Schmalz/Butterschmalz ≠ gluten, Palatschinken ≠ Schwein/Fleisch.
- **S6:** Negativ-Wortfolgen sind verboten (Fehler beim Prüfen) – Negativ-Wörter wirken nur auf die Trefferspanne; Negativ `=wort` = ganzes Wort genau so (z. B. `=huehnerei`).
- **S7:** Dokumentation angepasst (diese Liste, R9).
- **K1:** Die Ausnahmeliste hebt nur Wort-/Quellregeln auf, nie die von Menschen bestätigte Erwartungsliste. **K2** Alkohol (Glühwein, Reiswein/Shaoxing, Rumrosinen, Grappa, Kirschwasser, Amaretto, Whisky, Gin, Wermut, Cidre), **K3** Scharf (Habanero, Gochujang, Piri-Piri, Rosenpaprika; „Peperoni“ bleibt menschliche Prüfung), **K4** Pilze (Egerlinge, Portobello, Enoki, Shimeji), **K5** Hülsenfrüchte (Fisolen, Zuckerschoten, Dal), **K8** Insekten/Karmin → `animal: insect`. Zusätzlich Fruchtgummi/Gummibärchen → Gelatine, Misosuppe → `soy`.
- **Offen (nicht übernommen):** K6 (weitere Schwangerschafts-Kandidaten wie Weichkäse aus Rohmilch ohne „Rohmilch“ im Namen, Sprossen, Pâté) → Fachprüfung vor N7; K7 (Prise nur für Gewürze) → bei N2c entscheiden. S8 (CI-Kollision mit `waitlist_stats`) wird über getrennte PRs gelöst.

**Wächter-Gegenprüfung N2a (11.10.2026): B1–B3 dicht, MIT AUFLAGEN.** Umgesetzt:

- **G-S1:** „leber“ auch mitten im Wort → `pregnancy_caution` (Kalbsleberwurst, Gänse-/Hühnerleberpastete; Ausnahme „Kleber“). Leberkäse bleibt bewusst vorsichtig `pregnancy_caution`, obwohl er meist keine Leber enthält (regional mit Leber). Neues Fixture `kalbsleberwurst`.
- **G-K1:** Wildhack/Wildhackfleisch/Hirschhack → zusätzlich Schwein (oft mit Schweinespeck); Puten-/Rinderhack weiterhin ohne.
- **G-K2:** Ausdrücklich pflanzliche Produkte („vegan“, „pflanzlich“, „vegetarisch“, „Veggie“, Seitanwurst/-salami im Namen, Alias oder in der Quellbezeichnung) lösen die Wortregeln für Schwein und Fleisch nicht aus; die Quellgruppe gilt weiter.
- **G-K3:** Serrano und Coppa → Schwein (Serrano-Chili nicht), Bündnerfleisch → Rind.

**So testest du es am Handy:** Pull Request → **Checks → ci** grün (Lint, Typen, Tests). Es gibt in N2a noch keinen echten Katalog und keine Rezepte im Repository – der „Rezept-Prüfbericht“ und „Abdeckung“ in der Summary kommen mit N2b/N2c.

### N2b – Lebensmittel-Katalog aus der Quelle (Teil 1 umgesetzt, 11.10.2026: Lizenz, Infrastruktur, Zuordnungs-Vorschlag)

Keine Nährwerte im Repository, keine Migration, keine App-Änderung. Der Katalog (`content/sources/**`, `content/foods/**`) entsteht **nur** nach dem Merge über den Workflow `foods-import` (Schritte unten und `docs/SETUP.md` Teil J).

**1. Quelle und Lizenz (S13) – Ergebnis der Recherche (11.10.2026):**

- **Hauptquelle: Bundeslebensmittelschlüssel (BLS) Version 4.0, Max Rubner-Institut.** Seit 16.12.2025 erstmals frei verfügbar; der Open-Data-Download ist unter **CC BY 4.0** (Creative Commons Namensnennung 4.0 International) gestattet, das **Max Rubner-Institut ist als Herausgeber zu nennen**. Empfohlene Zitierweise: „Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 – Deutsche Nährstoffdatenbank“, **DOI 10.25826/Data20251217-134202-0**. Umfang 7.140 Lebensmittel × 138 Nährstoffe, Werte je 100 g essbarer Anteil; Hauptdatei `BLS_4_0_Daten_2025_DE.xlsx` (Spalten: BLS-Schlüssel, deutsche und englische Bezeichnung, je Nährstoff Wert/Datenherkunft/Referenz; Spaltenköpfe nach dem Schema „Code Name Einheit“, z. B. ENERCJ, PROT625).
  - Quellen: Download-Seite https://blsdb.de/download · FAQ https://blsdb.de/faq · GovData https://www.govdata.de/suche/daten/bundeslebensmittelschlussel-bls-version-4-0-deutsche-nahrstoffdatenbank · Archiv OpenAgrar https://www.openagrar.de/receive/openagrar_mods_00112643 · Dokumentation https://www.openagrar.de/servlets/MCRFileNodeServlet/openagrar_derivate_00069363/BLS_4_0_Dokumentation_DE.pdf · MRI https://www.mri.bund.de/de/institute/ernaehrungsverhalten/forschungsbereiche/bundeslebensmittelschluessel-bls/ · Meldungen „lizenzfrei seit Dezember 2025“: https://wissensforum-backwaren.de/bundeslebensmittelschluessel-4-0/, https://lebensmittelpraxis.de/handel-aktuell/47047-nationale-naehrstoffdatenbank-bundeslebensmittelschluessel-wird-kostenfrei-zugaenglich.html
  - **Einschränkung:** In dieser Sitzung waren die Seiten nur über die Websuche (Auszüge) erreichbar; Seitenabruf und Download sind durch die Netzwerk-Regeln der Sitzung gesperrt. Die Lizenzangabe stimmt in drei unabhängigen Fundstellen überein (blsdb.de, GovData, OpenAgrar-Dokumentation). **Wortgenaue Prüfung der Nutzungsbedingungen auf blsdb.de bleibt eine Gründer-Aufgabe** (Klick-Schritte unten); eine Rechtsberatung ersetzt das nicht. → **Erledigt 12.10.2026** (Wortlaut im Nachtrag „Quelle auf blsdb.de umgestellt“).
  - **Folgen:** CC BY 4.0 erlaubt Weitergabe und Bearbeitung (auch kommerziell) mit Namensnennung, Lizenzhinweis und Kennzeichnung von Änderungen → `source.license = "CC BY 4.0"` je Lebensmittel, `ATTRIBUTION.md` je Quelle, Namensnennung unter „Lizenzen“ in der App und im PDF-Fuß (sobald BLS-Werte in App/PDF erscheinen, N2c/N4/N6). Die **ganze Original-Datei dürfte eingecheckt werden** (16 B (f)); sie wird trotzdem nicht eingecheckt (≈ 14 MB, `sources-integrity` lädt sie ohnehin immer neu).
- **Zweitquelle (19.3), nur bei Bedarf:** Schweizer Nährwertdatenbank (BLV) – laut opendata.swiss „Non-commercial Allowed / Commercial Allowed / Reference Required“ (Quellenangabe Pflicht), Excel-Download und API (https://ckan.opendata.swiss/dataset/naehrwerte_lebensmittel, https://www.blv.admin.ch/blv/de/home/lebensmittel-und-ernaehrung/ernaehrung/empfehlungen-informationen/naehrstoffe/schweizer-naehrwertdatenbank.html). Noch **nicht** in der Allowlist: Dafür fehlt eine feste, versionierte Datei-Adresse; Aufnahme erst mit eigenem Ordner, Prüfsummen und Lizenzprüfung (S3).
- **Offene Gründer-/Rechtsfragen:** (1) ~~Nutzungsbedingungen auf blsdb.de wortgenau bestätigen~~ **erledigt 12.10.2026** (Wortlaut siehe Nachtrag „Quelle auf blsdb.de umgestellt“); (2) ~~Adresse der Original-Datei bestätigen~~ **erledigt 12.10.2026** (Download-Seite blsdb.de); (3) für Proteinpulver, Erythrit, Sojaskyr u. ä. entscheiden, ob eine Zweitquelle aufgenommen wird oder die Zutaten ungeprüft bleiben.

**2. Umgesetzt (`packages/content/src/foods/`):**

1. **`sources.ts` – Allowlist** (ohne Imports, damit `sources-integrity` den Stand von `main` laden kann): BLS 4.0 – ursprünglich mit fester Datei-Adresse im Archiv OpenAgrar, **seit 12.10.2026 über die Download-Seite `https://blsdb.de/download`** (Nachtrag unten), Format xlsx, Schlüssel-/Namensspalte, Nährstoff-Codes ENERCC (kcal), PROT625, CHO, SUGAR, FAT, FASAT, FIBT, Salz aus NACL (g) oder NA (mg × 2,5 / 1000, LMIV Anhang I) – **`columnsStatus: 'unconfirmed'`**; der Import prüft Code **und** Einheit in der Kopfzeile und bricht sonst mit der Liste der Spalten ab (nie raten). Optional festnagelbare `originalSha256`. Lizenz, Lizenz-URL, Namensnennung, Änderungshinweis.
2. **`xlsx.ts`** – eigener, abhängigkeitsfreier xlsx-Leser (ZIP + XML): Zellen genau als gespeicherter Text bzw. gespeicherte Zahl, keine Formatierung/Rundung; ZIP64/Verschlüsselung → Abbruch. **`csv.ts`** – kanonische CSV-Zeile (RFC 4180) und Leser.
3. **`extract-source.ts`** – Original lesen, benötigte Quell-IDs **Zeile für Zeile ohne Wertänderung** filtern (Reihenfolge wie im Original, doppelte Quell-ID → Abbruch), `SOURCE.json`-Schema (URL nur HTTPS, `original_sha256`, `original_bytes`, `extract_sha256`, `extract_rows`, `retrieved_at`, `workflow_run_id`, Lizenz, Namensnennung), `ATTRIBUTION.md`.
4. **`source-rows.ts`** – einzige Stelle, die Zellen-Texte in Nährwerte übersetzt (Import **und** R17 nutzen sie); fehlender Wert/Text („Spuren“) → Zeile nicht übernommen (Bericht); Werte müssen `nutrientsPer100gSchema` erfüllen.
5. **`import-source.ts`** – baut `content/foods/<id>.json` (Entwurf, `meta.origin = claude_session`, Katalog-Prüfung offen) und `allergen-expectations.json` aus Zuordnung + Auszug; Nährwerte und `source.name` nur aus dem Auszug; unverändert → Datei bleibt byte-gleich (neues Abrufdatum allein zählt nicht); geändert → `version` + 1 und Katalog-Prüfung zurückgesetzt; `published` wird nie überschrieben. **Gegencheck** `pro_100g` der Gründer-Datei: > 3 % gemeldet, > 15 % „Zuordnung prüfen“, Mindestabstand 5 kcal / 1 g (`ALPHA5_IMPORT_TOLERANCE` in `constants.ts`, PRODUKTENTSCHEIDUNG).
6. **`candidates.ts`** – Kandidatensuche (Quell-ID + Bezeichnung, keine Nährwerte) für Zutaten ohne Quell-ID; Meldung, wenn die Bezeichnung einer eingetragenen Quell-ID keinen Suchbegriff enthält.
7. **`foods-import.ts` + `.github/workflows/foods-import.yml`** (manuell, nur auf `main`; Eingaben Quelle, Version, Modus `kandidaten`/`import`): Original von der Allowlist-Adresse laden (nur HTTPS, Größe begrenzt), Kandidaten mit **Spalten-Bericht** (welche Spalte je Nährwert genutzt würde – bestätigt `columnsStatus`) bzw. Auszug + `SOURCE.json` + `ATTRIBUTION.md` + Lebensmittel, `content:validate` (Schema-/Dateifehler blockieren), **Commit über die GitHub-Git-Data-API ohne Autor-Angabe** (GitHub signiert → „verified“, Prüfung danach, sonst Abbruch), Branch `foods-import/<run-id>`, Pull Request mit URL, Version, beiden Prüfsummen, Import-Bericht und Gegencheck, danach `ci` gestartet. Keine Änderung → kein PR.
8. **`integrity.ts` + `integrity-env.ts` – CI-Job `sources-integrity` in `ci.yml`** (jeder PR, Push auf `main`, wöchentlich Mo 04:23 UTC; der Job `check` läuft beim Wochenlauf nicht): Allowlist `sources.ts` **aus `origin/main`** (git show → temporäre Datei; Imports darin → Fehler), Original **immer neu** von der Allowlist-Adresse, `original_sha256` (und festgenagelte Prüfsumme), eingecheckte `original.*`, `extract_sha256`, kanonische Form, Kopfzeile, **jede Zeile unverändert im Original**, Zeilenzahl, nur erlaubte Dateien, `ATTRIBUTION.md`; im PR/Branch: Änderungen unter `content/sources/**` nur auf `foods-import/<Zahl>`, **jeder Commit unter `content/sources/**` oder `content/foods/**` verified + Autor `github-actions[bot]`** (GitHub-API). Im PR wird der Kopf-Commit geprüft (nicht der Merge-Commit). Neuladen nur, wenn Quellen, Lebensmittel, Zuordnung oder `packages/content/src/foods/` geändert sind (sonst grün mit Hinweis).
9. **`catalog-loader.ts` – R17/R18 in CI:** `content:validate` lädt `content/foods/` (ohne die beiden Listen), alle Quellauszüge (über `source-rows.ts`), Erwartungs- und Ausnahmeliste und übergibt sie als `nutritionCatalog`; Quellordner außerhalb der Allowlist oder ohne Auszug → Dateifehler (blockiert). Ohne `content/foods/` unverändert.
10. **`.github/CODEOWNERS`** – nach Wächter N2b (B1) **nur** `content/sources/` und `content/foods/` (Bot-Ordner) – und **`docs/SETUP.md` Teil J** (Ruleset `foods-import/*`, Regel für `main` mit Code-Owner-Freigabe und Pflicht-Checks, Import am Handy; „Adresse bestätigen“ entfällt seit 12.10.2026).
11. **Core (N2a-Regeln, beim Abgleich der 236 Zutaten gefunden):** „Schweinehack(fleisch)“ löst nicht mehr „Rind + gemischtes Hack“ aus (Schwein bleibt); „Sojaskyr/Haferskyr“ ≠ dairy; „Reisessig/Reiswein“ ohne R9-1-Tag-Grenze. Tests `allergen-rules-n2b.test.ts` mit Gegenprobe.

**3. Zuordnung der 236 Zutaten (19.3):** `content/food-mapping/alpha5-zuordnung.json` – **KI-Vorschlag, Status `unbestaetigt`**, je Zutat `alpha5_id`, `food_id`, Suchbegriffe, gemeinter Rohzustand („Basmatireis trocken“ → ungekocht, TK, abgetropft …), neutrale Quellgruppe, Name, Abteilung (11 → 15 Abteilungen), Vorrat, Gruppen (= künftige Erwartungsliste), tierische Bestandteile, Tierart, `pregnancy_caution`, Haltbarkeit (Reis/Fisch/Hack/Geflügel 1 Tag), einfrierbar, Begründung. **Keine Nährwerte** (Test). **Alle Quell-IDs `ref: null`**: Die Original-Datei konnte in dieser Sitzung nicht geladen werden (Netzwerk gesperrt), BLS-Schlüssel werden nicht geraten – sie kommen aus dem Kandidatenlauf. Test `mapping.test.ts`: alle 236 IDs/Namen, Schema, R18-Pflichtregeln (Namen, Quellgruppe, Tierart) und R9 erfüllt.

**4. Tests (Vitest, `packages/content/src/foods/*.test.ts`, 65 Tests, nach der Wächter-Prüfung und Gegenprüfung 78):** xlsx/CSV/Auszug/Umrechnung/Spaltenerkennung; Import (Versionen, `published`, Gegencheck); Kandidaten; GitHub-API (verified/Bot/anderer Autor); Download (nur HTTPS, Fehler); `content:validate` mit Katalog (R17 grün/rot); Ende-zu-Ende `foods-import` mit Test-Quelle (Import ohne Quell-ID → Abbruch, Auszug unverändert, Werte nur aus der Quelle, Commit ohne Autor, Branch, PR-Text mit Prüfsummen, Zweitlauf ohne PR, nicht verified → Abbruch, nur `main`, Allowlist, festgenagelte Prüfsumme; erzeugter Stand besteht `sources-integrity`); Allowlist aus `main` per git. **W18 vollständig** (`integrity.test.ts`): Auszug verändert ohne passende Prüfsumme → rot; Prüfsumme angepasst, Zeile geändert → rot; erfundene Zeile → rot; Änderung unter `content/sources/**` außerhalb `foods-import/<run-id>` → rot; **`foods-import/x` mit gefälschtem Bot-Autor (nicht verified) → rot**; Lebensmittel per Hand → rot; **URL in SOURCE.json geändert → rot** (geladen wird trotzdem nur die main-Adresse); URL + `sources.ts` im PR → rot; **Original und `original_sha256` gemeinsam geändert → rot**; eingecheckte Original-Datei abweichend → rot; nicht in der Allowlist / Allowlist fehlt / festgenagelte Prüfsumme → rot; Quelle nicht erreichbar → rot; Kopfzeile, CRLF, Zeilenzahl, fehlende/fremde Dateien → rot; **unveränderter Workflow-Auszug → grün**.

**Abweichungen / Präzisierungen gegenüber dem Plan:**

- **Zeilen-Herkunft bei xlsx:** „Zeile der Original-Datei“ = Zellen-Texte einer Tabellenzeile in kanonischer CSV-Form (`csv.ts`); `extract.csv` enthält nur solche Zeilen und die Kopfzeile. Bei einer CSV-Quelle gilt dasselbe (kanonisch neu geschrieben).
- **Zuordnung in eigener Datei** `content/food-mapping/alpha5-zuordnung.json` statt „aus den Zuordnungen in `content/foods/`“: `extract-source` liest die Quell-IDs von dort, `import-source` schreibt daraus `content/foods/` (einzige Schreibstelle). Korrekturen an Beschreibung/Gruppen erfolgen per PR **in der Zuordnung**, der nächste `foods-import`-Lauf übernimmt sie.
- **„ei“ → Katalog-ID `huehnerei`:** `contentIdSchema` verlangt ≥ 3 Zeichen; Plan 19.3 („ID bleibt die `zutat_id`“) gilt sonst unverändert. `ALPHA5_ID_EXCEPTIONS` in `mapping.ts`; N2c ordnet über `alpha5_id` zu. Katalog-Namen „Schweinehackfleisch“ (statt „Hackfleisch vom Schwein“, sonst R18 „gemischtes Hack“) und „Rundkornreis“ (statt „Milchreis“, sonst R18 dairy).
- **Quell-Lebensmittelgruppe** (`source.category`) je Zutat aus der Zuordnung (Vorschlag, R19), nicht aus dem ersten Zeichen des BLS-Schlüssels – die BLS-4.0-Hauptgruppen ließen sich nicht verlässlich zitieren.
- **Einheiten** (EL/TL/Stück) noch leer (außer Wasser 1 ml = 1 g); sie kommen mit dem Rezept-Import (N2c), statt sie ohne Quelle zu schätzen.
- **Doppelte Zutaten der Gründer-Datei** (z. B. `karotte`/`karotten`/`moehre`, `beeren-mischung-tk`/`beerenmischung-tk`, `gyros-gewuerz`/`gyrosgewuerz`) bleiben je eigene Lebensmittel mit derselben Quell-ID (Plan: ID = `zutat_id`); Zusammenlegen ist eine N2c-Entscheidung.
- **Ruleset:** nur „Restrict updates“ + „Block force pushes“ auf `foods-import/*` (keine Ausnahme für den Bot nötig); die Herkunft prüft zusätzlich `sources-integrity` über „verified“.
- **Noch nicht in diesem Teil (N2b-DoD offen):** Option **„Katalog geprüft“ in `content-review`** (R2-K6) samt CI-Regel „`catalog_reviewed_*` nur über `content-review`“ – sie muss ihre Commits ebenfalls über die GitHub-API anlegen, weil `sources-integrity` unter `content/foods/**` nur verifizierte Bot-Commits zulässt; menschliche Katalog-Prüfung (R19); W19 (Katalog) gegen die Erwartungsliste; Eintrag „Lizenzen“ in der App (erst sinnvoll, wenn BLS-Werte im App-Bundle sind, N2c/N4).

**Nächste Schritte nach dem Merge (Gründer, Klick-Schritte `docs/SETUP.md` Teil J):** (1) J1 Ruleset und J2 Regel für `main` (Code-Owner-Freigabe + Pflicht-Checks) einrichten; (2) ~~Adresse bestätigen~~ (erledigt 12.10.2026, blsdb.de); (3) `foods-import` Modus `kandidaten` → Claude-Sitzung trägt die Quell-IDs mit Begründung ein, bestätigt dabei die Spalten-Codes (`columnsStatus`) und nagelt **`originalSha256` per PR fest (Pflicht, NB1)**; Gründer prüfen den Betreiber im Impressum von blsdb.de; (4) Modus `import` → PR **selbst** freigeben und mergen (nie durch eine Claude-Sitzung); (5) Katalog-Prüfung R19.

**Quell-IDs eingetragen (12.10.2026, nach Lauf „kandidaten“):** 156 von 236 Zutaten haben in `alpha5-zuordnung.json` eine BLS-Quell-ID (nur Codes aus der Summary, Begründung je Zutat in `reason_de`, „UNSICHER“ = bei R19 zuerst prüfen; Status bleibt `unbestaetigt`). 80 bleiben `ref: null` mit verbesserten Suchbegriffen (u. a. Gewürze ohne BLS-Eintrag, Proteinpulver/Erythrit/Sojaskyr → evtl. Zweitquelle). Test `mapping.test.ts`: Quell-IDs nur im BLS-Format `^[A-Z][0-9A-Z]{6}$` und in der Begründung genannt. Ergänzt:

- **Namensliste im Modus „kandidaten“:** alle Zeilen der Quelle als `Quell-ID<TAB>Bezeichnung` zwischen `=== BLS-NAMENSLISTE BEGINN ===` / `… ENDE ===` – nur ins Actions-Log (stdout), nicht in die Summary (dort nur Zeilenzahl); nur Schlüssel und Namen (CC BY 4.0, Namensnennung MRI). Quell-ID nur im Format `keyPattern` der Quelldefinition (BLS `^[A-Z][0-9A-Z]{6}$`, Pflichtfeld in `sources.ts`; ohne gültiges Muster Abbruch) – abweichende Zeilen werden nicht ausgegeben, nur gezählt (Schutz vor Workflow-Kommandos wie `::stop-commands::` am Zeilenanfang). Bezeichnungen bereinigt wie die Kandidaten (`cleanSourceText`: ohne Steuer-/Formatzeichen, „::“ und „===“ entschärft, höchstens 160 Zeichen). Tests in `candidates.test.ts`, `foods-import.test.ts`.
- **Kandidaten:** bis zu 15 statt 8; Reihenfolge: alle Wörter eines Suchbegriffs am Wortanfang → alle Wörter, eines im Wortinneren („Reis“ in „Erdbeereis“) → Teil-Treffer mehrteiliger Begriffe (Wort ≥ 4 Zeichen am Wortanfang); innerhalb der Stufe „roh“ vor neutral vor zubereitet/Gericht (Zubereitungswörter, Endungen …suppe/…sauce …, BLS-Gruppen X/Y), dann Länge. Nur Sortierung – ein Mensch wählt aus.
- **R18 (Core):** „Tierart Hackfleisch“ als getrennte Wörter (BLS „Schwein Hackfleisch, roh“, „Rind Hackfleisch, roh“) wird vor dem Abgleich zusammengezogen (`joinSpeciesMince`) – Schwein bleibt Schwein, ohne Rind/gemischtes Hack. **„gemischt“ / „halb und halb“ bleibt immer Rind + Schwein + gemischtes Hack**, auch mit Tierart davor (getrennt oder zusammengeschrieben, z. B. „Rinderhackfleisch gemischt“ – damit ist auch die ältere Lücke geschlossen; Wächter-Prüfung Zuordnung B1). Gruppe `spicy`: nur in der **Bezeichnung der Quelle** wird „Senf mittelscharf“ zu „Senf“ (`sourceNameRewrites`; Senföl- statt Chili-Schärfe) – Name, Aliase und übrige Wörter der Quelle („… mit Chili“) werden weiter geprüft; „mittelscharf“ im eigenen Namen bleibt `spicy`. **Bei R19 bestätigt ein Mensch ausdrücklich, dass mittelscharfer Senf nicht als scharf gilt** (ändert die frühere Festlegung der R18-Tabelle für die Quelle).
- **Zuordnung nach Wächter-Prüfung:** `toastbrot-weizen` → `B314000` „Weizentoastbrot/Buttertoastbrot“ mit Milch + Laktose (vorsichtig); `rinderhackfleisch-5-fett` → `U010100` „Rind Hackfleisch, roh“ ohne Schwangerschafts-Hinweis (wie Schweinehack, wird gegart); `kassler-mager` mit `pregnancy_caution` (Rohpökelware, geräuchert); `lasagneplatten` → `E432000` „Eierteigwaren roh“ mit Gruppe Ei. Prüfpunkte als „R19-Prüfhinweis“ in `reason_de` (u. a. Gnocchi, Speisestärke, Zartbitter, TK, Falafel). Erneute Prüfung aller 156 Zuordnungen mit den BLS-Bezeichnungen gegen R18 und R9: 0 Konflikte.

**Wächter-Prüfung N2b (11.10.2026): BESTANDEN MIT AUFLAGEN** (Bericht `waechter-n2b.md`). Umgesetzt:

- **B1 – CODEOWNERS/J2 mit nur einem GitHub-Konto:** CODEOWNERS nur noch für die Bot-Ordner `content/sources/` und `content/foods/` (Autor dort immer `github-actions[bot]`, der Gründer kann freigeben); eigene PRs (Skripte, Zuordnung, Workflows) bleiben mergebar. **H1 umgedeutet:** „CODEOWNERS nur auf die Bot-Ordner; Schutz der Skripte über die Prüfung mit dem Code von `main` (S2) und Pflicht-Checks (S3); Regel ‚Claude gibt nie frei‘“. **Verbindliche Regel: Claude-Sitzungen geben nie Pull Requests frei (kein „Approve“) und mergen keine `foods-import/*`-Pull-Requests – Freigabe und Merge macht ein Gründer selbst** (auch in `docs/SETUP.md` J2; `CLAUDE.md` ändern nur die Gründer).
- **S1 – Fork-PRs:** PR-Modus über das Ereignis (`pull_request`/`pull_request_target`), nie über den Branch-Namen (Fork-PR vom Branch „main“ wird jetzt verglichen). Ändert ein PR aus einem Fork (`PR_HEAD_REPO` ≠ Repository; fehlt die Angabe, gilt vorsichtig „Fork“) `content/sources/**` oder `content/foods/**` → rot. Änderungen an beiden Ordnern nur auf `foods-import/<Lauf-ID>`, und die Lauf-ID wird über `GET /actions/runs/<id>` geprüft: `.github/workflows/foods-import.yml`, `workflow_dispatch`, `main`, nicht fehlgeschlagen. W18-Tests ergänzt (Fork, falsche Lauf-ID, Fork vom Branch „main“).
- **S2 – Prüfung mit dem Code von `main`:** neuer Workflow `sources-integrity-main.yml` (`pull_request_target`): checkt den Basis-Stand aus und installiert nur ihn; der PR-Stand kommt als reine Daten in `pr-daten/` (nichts installiert oder ausgeführt); `sources:integrity` (über `INTEGRITY_REPO_ROOT`) und `content:validate` (R17/R18) laufen mit dem Code von `main`. Rechte `contents: read`, `actions: read`, keine Secrets, `persist-credentials: false`, kein Cache, Eingaben nur über Umgebungsvariablen.
- **S3 – Pflicht-Checks:** `docs/SETUP.md` J2 „Require status checks to pass“ mit `Lint, Typen, Tests, Build`, `sources-integrity`, `sources-integrity (Code von main)`; pgTAP bewusst nicht (läuft nur bei `supabase/`-Änderungen).
- **S4 – Ausnahmeliste** liegt jetzt in `content/food-mapping/allergen-exceptions.json` (Menschen pflegen sie per PR); in `content/foods/` ist sie ein Dateifehler. Test.
- **S5 – Actions** in `foods-import.yml`, `sources-integrity-main.yml` und im Job `sources-integrity` auf Commit-SHA gepinnt (wie `eas-build.yml`).
- **S6 – Fachprüfung:** Ändern sich Nährwerte, Quell-ID (Datenbank/Version), Gruppen oder `pregnancy_caution`, setzt der Import zusätzlich `expert_reviewed`, `reviewed_by/at` und `review_note` zurück (`needsExpertReset`); nur Beschreibungsänderungen → nur Katalog-Prüfung neu. Test.
- **K1:** „Schweinehackfleisch gemischt“, „Hackfleisch gemischt“, „Hackfleisch halb und halb“ → Rind + Schwein + `mixed_mince` (Wortfolgen; „Gemischter Salat“ nicht). **K2:** Download mit zwei Wiederholungen (10 s / 30 s) bei Netzfehler, HTTP 429 oder 5xx, nicht bei 404. **K3:** eigene Concurrency-Gruppe je Ereignis in `ci.yml`. **K4:** Hinweis „60 Tage ohne Aktivität“ in SETUP J. **K5:** Import-Sperre für `sources.ts` erkennt auch `… from '…'`. **K7:** verwaiste Lebensmittel (Datei ohne gültige Zuordnung) im Bericht, Erwartungen aus der Datei bleiben. **K6/K8:** künftige `units` (Stück-/Löffelgewichte, Dichten) gehören in die R19-Checkliste und den Import-Bericht; nach dem Kandidatenlauf wird die tatsächlich genutzte Salz-Spalte (NACL oder NA × 2,5) in `columnsStatus` dokumentiert. **K9:** ältere actionlint-Befunde (Unicode-Anführungszeichen in `db-types.yml`, `eas-build.yml`, `eas-ios-setup.yml`) nicht Teil von N2b, bleiben offen.

**Wächter-Gegenprüfung N2b (11.10.2026): GB1 behoben.** Umgesetzt:

- **GB1 – Pflicht-Check bei Bot-PRs:** Pull Requests, die `foods-import` mit dem `GITHUB_TOKEN` öffnet, lösen keine Workflows aus (auch nicht `pull_request_target`). `sources-integrity-main.yml` ist deshalb zusätzlich per `workflow_dispatch` startbar (Job nur für `refs/heads/foods-import/*`); der Code kommt dann ausdrücklich von `refs/heads/main`, der Kopf von `foods-import/<id>` (`github.sha`) nur als Daten nach `pr-daten`. Ein per Hand gestarteter Lauf erzeugt seinen Check-Lauf mit dem Job-Namen am Kopf-Commit des Branches – damit erscheint `sources-integrity (Code von main)` am Pull Request und erfüllt die Pflicht (wie schon `ci`). `foods-import` startet **beide** Workflows (`CHECK_WORKFLOWS`, Test). Im Dispatch-Fall gilt der Branch-Modus (Lauf-ID-, Bot- und verified-Prüfung greifen; Fork ist ausgeschlossen). **Restrisiko:** Ein per Hand gestarteter Lauf nutzt die Workflow-Datei des gewählten Branches; wer Schreibrechte hat, könnte auf einem eigenen Branch eine veränderte Datei starten und so einen grünen Check gleichen Namens erzeugen. Deshalb gilt zusätzlich die Regel: **Claude-Sitzungen starten `sources-integrity-main` nie per Hand** (SETUP J2); Pull Requests von Menschen prüft weiterhin `pull_request_target` mit der Datei von `main`.
- **GK1:** `pnpm install` läuft **vor** dem Daten-Checkout (`actions/checkout` erlaubt nur Pfade im Arbeitsordner, `runner.temp` geht damit nicht); der PR-Stand kann nicht in die Installation geraten.
- **GK2:** Symbolische Links unter `content/sources/`, `content/foods/` und `content/food-mapping/` → rot (`findSymlinks`, rekursiv, Links werden nicht verfolgt). Tests.
- **S5-Rest:** Auch der Job `check` in `ci.yml` nutzt gepinnte `checkout`/`pnpm`/`setup-node`; `actions/upload-artifact@v4` bleibt vorerst ungepinnt (SHA in dieser Sitzung nicht verlässlich prüfbar).
- Strukturtest `workflows.test.ts`: Auslöser, Code nur von main, Installation vor den Daten, kein Cache, keine Secrets, gepinnte Actions, Pflicht-Check-Namen = SETUP J2.

**Nachtrag 12.10.2026 – Quelle auf blsdb.de umgestellt (Grund: Bot-Sperre openagrar).** Die Adresse im Archiv OpenAgrar (`…/openagrar_derivate_00069361/BLS_4_0_Daten_2025_DE.xlsx`) leitet automatische Abrufe auf eine Bot-Sperre um (HTTP 200 `text/html`, Weiterleitung auf `/pow-challenge?redirect_url=…`). Diese Sperre wird **nicht** umgangen. Neue Quelle ist die offizielle BLS-Seite des MRI:

- **Lizenz im Wortlaut** (blsdb.de/download, **bestätigt durch Gründer 12.10.2026, Screenshot**): „Die Daten des BLS stehen als Open Data zur freien Verfügung. Die Nutzung ist unter der Lizenz CC BY 4.0 gestattet. Bei Verwendung ist das Max Rubner-Institut als Herausgeber zu nennen.“ **Zitierweise:** „Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0.“ → `sources.ts`: `licenseText`, `attribution`, `urlStatus`/`licenseStatus: 'confirmed'`, `confirmedBy`.
- **Adresse:** fester Allowlist-Eintrag ist die **Seite** `https://blsdb.de/download` (`downloadPage: { linkPath: '/download', tokenParam: 'token', redirectHosts: [] }`). Der Knopf „Download BLS-Daten“ verweist auf `/download?token=<Code>`; der Code wechselt vermutlich je Seitenaufruf. `download.ts`/`download-page.ts` lesen den Link aus dem HTML: **nur Links auf denselben Host (HTTPS), Pfad `/download`, nicht leerer Parameter `token`; gleiche Links zählen einmal; genau ein Treffer, sonst Abbruch mit Liste der Links** (Codes im Protokoll gekürzt). Die Datei-Anfrage darf nur auf HTTPS und den Host der Seite (bzw. `redirectHosts`, nur per Gründer-PR) weiterleiten.
- **Keine Umgehung:** Challenge-, Captcha- oder Anmeldeseite (Weiterleitung auf `pow-challenge`/`captcha`/`login`, reCAPTCHA/hCaptcha/Turnstile, Passwortfeld, „Just a moment“) → Abbruch mit Meldung „wird bewusst NICHT umgangen“.
- **Höflich:** User-Agent `Alpha5-Fitnessapp-Naehrwertimport/1.0 (+Repository-Adresse)`, Seite und Datei nacheinander (nie parallel), `Referer` und die von der Seite gesetzten Cookies nur für die Folge-Anfrage auf denselben Host (wie ein Browser), Wiederholungen wie bisher (10 s / 30 s bei Netzfehler, 429, 5xx).
- **Integrität ohne feste Datei-Adresse:** Weil der Link wechselt, sichert die **Prüfsumme** die Echtheit. Beim ersten Import steht `original_sha256` in `SOURCE.json` (`url` = Seiten-Adresse). `sources-integrity` (beide Workflows) und jeder spätere `foods-import`-Lauf laden über **dieselbe Seiten-Logik** (`fetchSourceOriginal`, Allowlist von `main`) neu und vergleichen; weicht die Prüfsumme ab → rot bzw. Abbruch ohne PR („weicht vom ersten Import ab“). Seit dem Wächter-Nachtrag (NB1) ist das Festnageln von `originalSha256` in `sources.ts` **Pflicht vor dem ersten Import**. W18 ergänzt: neuer Code + gleiche Datei → grün; geänderte Seiten-Adresse → rot; abweichende Prüfsumme → rot; Download-Link auf fremdem Host → rot (wird nie geladen); Bot-Sperre → rot; festgenagelte Prüfsumme passt/weicht ab.
- **Format-Erkennung** (`original-format.ts`, ZIP-Leser aus `xlsx.ts` wiederverwendet): Antwort ist xlsx (`[Content_Types].xml` + `xl/…`) → direkt; ZIP mit den Daten → genau **eine** Datei mit der Endung aus `format` (ein Eintrag namens `originalFilename` hat Vorrang) entpacken; Dateiname aus `Content-Disposition` wird protokolliert; sonst Abbruch mit Status, Typ, Größe, Dateiname und ZIP-Einträgen. „Original-Datei“ (Prüfsumme, Zeilenvergleich) ist immer die xlsx/csv selbst, bei ZIP der entpackte Eintrag (unabhängig von Zeitstempeln des Archivs). Liegt nur eine CSV vor, bricht der Lauf ab; `format`/`csvDelimiter` stellt dann ein Gründer-PR um (nie geraten).
- **Diagnose im Modus `kandidaten`:** Bei Fehlern schreibt der Lauf alles Verfügbare in die Zusammenfassung (Antwort, Links der Seite, ZIP-Einträge, Tabellenblätter, Zeilenzahl, Kopfzeile – keine Nährwerte); bei Erfolg zusätzlich einen aufklappbaren Block „Diagnose“ mit Abruf-Protokoll und Kopfzeile. So zeigt schon der erste Lauf die echte Struktur.
- **Nicht geprüft in dieser Sitzung:** blsdb.de ist aus der Claude-Sitzung nicht erreichbar (Proxy 403); Seitenaufbau, Format (xlsx oder ZIP) und Spaltenköpfe zeigt erst der erste `kandidaten`-Lauf. Tests nutzen Attrappen-HTML/-ZIP (`download-page.test.ts`, `integrity.test.ts`, `foods-import.test.ts`).

**Wächter-Nachtrag blsdb (12.10.2026): BESTANDEN MIT AUFLAGEN** (Bericht `waechter-n2b.md`, Abschnitt „Nachtrag blsdb“). Umgesetzt:

- **NB1 – Prüfsumme vor dem ersten Import festnageln (Pflicht):** feste Reihenfolge Lauf `kandidaten` → Claude trägt die SHA-256 aus der Summary per PR als `originalSha256` in `sources.ts` ein → Gründer merged → erst dann Lauf `import`. **Im Code erzwungen:** Modus `import` bricht ab („Kein Import: … noch keine Prüfsumme (`originalSha256`) festgenagelt“), solange `originalSha256 = null` ist; nichts wird geschrieben (Test). So müssen zwei unabhängige Abrufe zu verschiedenen Zeitpunkten dieselbe Datei liefern, und `sources-integrity` prüft gegen den Wert von `main`. **Merge-Regel für den Import-PR:** Sind mehr als 10 % der Zutaten „Zuordnung prüfen“ (> 15 % Abweichung zur Gründer-Datei), wird nicht gemergt, bevor der Grund geklärt ist – der PR-Text zeigt den Anteil und bei > 10 % „⛔ NICHT MERGEN“ (`reviewShareNote`, `MAX_REVIEW_SHARE`, Test). **Betreiber:** blsdb.de wird laut Impressum vom Max Rubner-Institut betrieben – **noch nicht maschinell geprüft** (Proxy der Sitzung sperrt blsdb.de); der Gründer bestätigt es per Blick ins Impressum (SETUP J3 Schritt 5). Der Screenshot vom 12.10.2026 belegt Lizenz und Zitierweise, nicht den Betreiber der Domain.
- **NB2:** Ausweg bei einer korrigierten Datei unter „4.0“ in SETUP Teil J ausformuliert (Ursache klären → neues `originalSha256` per Gründer-PR → neuer Import mit Bericht der geänderten Werte).
- **NK1:** ZIP-Leser: Grenze je Eintrag 128 MB (statt 512 MB), zusätzlich Gesamtgrenze 256 MB für die entpackten Teile einer Arbeitsmappe (vor dem Entpacken aus dem Verzeichnis geprüft; Test).
- **NK2:** `decodeXmlText`: ungültige Zeichenreferenzen (z. B. `&#99999999;`, Ersatzbereich) → Ersatzzeichen U+FFFD statt RangeError, auch beim Lesen der Links der Download-Seite (Test).
- **NK3/NK4** bewusst nicht umgesetzt (Endadresse und Prüfsumme werden geprüft; Fehlalarme der Challenge-Erkennung gehen in die sichere Richtung).

**Lauf 3: Token-Link liefert HTML → Diagnose erweitert (12.10.2026).** Lauf 38259239156 (Modus `kandidaten`): Seite `https://blsdb.de/download` geladen, genau ein Token-Link gefunden, dessen Abruf lieferte aber wieder HTML (HTTP 200, `text/html;charset=UTF-8`, 7551 Bytes, ohne Content-Disposition); keine Challenge erkannt. Im Handy-Browser lädt „Download“ die Daten. Mögliche Gründe: Formular/POST bzw. Bestätigung der Nutzungsbedingungen, Download per JavaScript, Token an die Sitzung gebunden, Liste mehrerer Dateien. **Nur Diagnose, kein neuer Abrufweg:** `html-diagnosis.ts` (`describeHtmlPage`) beschreibt eine HTML-Antwort strukturiert in der Summary – Titel, h1/h2, sichtbarer Text (≈ 1500 Zeichen, ohne Skripte/Styles/Kommentare), alle Links (Adresse + Text), alle Formulare (action, method, Feldnamen/-typen, hidden-Werte gekürzt, Knöpfe), Knöpfe außerhalb von Formularen mit `data-*`/`onclick`, `meta http-equiv="refresh"`, `script src` und Ausschnitte von Inline-Skripten mit `download`/`location`/`.xlsx`/`.zip`, Namen gesetzter Cookies (keine Werte). Gleiches für die erste Seite im aufklappbaren Block „Diagnose: erste Seite“ – nur bei Fehler oder im Modus `kandidaten` (`describePages`). Codes/Token werden gekürzt (`maskTokens`, 4 Zeichen + „…“): Parameterwerte (`?`/`&`/`;`/`#`), Werte hinter Namen wie token/csrf/key/session/auth/sig/nonce (auch JSON/JS), Blöcke wie `6NHL-47N5-…`, jede code-artige Folge aus ≥ 16 Zeichen `[A-Za-z0-9-]` (nur Ziffern oder ≥ 2 Wechsel Buchstabe/Ziffer: UUID, Hex, Pfad-Segment; Bezeichner mit „_“, Wörter mit Jahreszahl und Dateinamen vor bekannter Endung bleiben lesbar); Feldwerte bei `hidden` oder token-artigem Namen. Heuristik – ein Code ohne Ziffer und ohne solchen Namen kann durchrutschen. **Sicherheit:** reine Textauswertung – keine weitere Anfrage, kein POST, kein meta-refresh, kein Skript (Test: genau zwei Anfragen). Tests `html-diagnosis.test.ts` (Formular, meta-refresh, Skript mit Download-Adresse, Kürzung der Token, Ende-zu-Ende `kandidaten`). **Wächter-Prüfung „Diagnose“ (12.10.2026): nach Behebung von B1 „mit Auflagen“, umgesetzt:** B1 – Eingabe auf 128 KB gekappt (Vermerk „Eingabe gekürzt …“), Auswertung in einem linearen Durchlauf (eigener Tokenizer mit `indexOf` statt Regex über offene Tags; Test: 1 MB `'<a '…` < 2 s); S1 – jede Liste begrenzt mit Anzahl („… (n weitere)“), Gesamtausgabe ≤ 16 KB mit Kürzungshinweis (Test); S2 – `maskTokens` wie oben, auch in `maskUrl` (Tests: UUID, JSON, JS-Variable, Pfad, Fragment, Textfeld mit token-Namen); S3 – diese Doku; K1 – Unterpunkte der HTML-Beschreibung nicht doppelt aufgezählt; K2 – Content-Type, Dateiname, Adresse und Antwort-Anfang vom Server als Inline-Code; K3 – erste Seite nur bei Fehler/`kandidaten`; K4 – Test mit eingeschleustem Markdown/HTML in Titel und Linktext (alles in Inline-Code). S4 (Commit trennen: N3-Status in der Statuszeile nicht mitnehmen) beim Committen beachten. **Nachprüfung (mit Auflagen), umgesetzt:** NS1 – `mdCode` kürzt vor dem Maskieren, Schlüsselwort-Regex begrenzt (`{0,30}`), CSV-Diagnose liest nur die ersten 64 KB (Test: 1 MB `'token'…` schnell); NS2 – Test: vollständige SHA-256 in der Summary (`kandidaten`); NK1 – CSV-Kopfzeile unmaskiert (nur Inline-Code), Schlüsselwörter an Wort-/camelCase-Grenzen („Monkey“, „keyword“, „Signatur“ zählen nicht), Bezeichner mit „_“ keine Codes (Tests); NK2 – xlsx-Kopfzeile je Spalte als Inline-Code. Der nächste Lauf `kandidaten` zeigt damit, was die zweite Seite verlangt; über einen neuen Abrufweg entscheiden danach Gründer und Wächter.

**Lauf 4 (38263444507, 12.10.2026): falscher Link gewählt → `linkPath` auf die ZIP-Datei umgestellt.** Die erweiterte Diagnose zeigte: Die Seite `https://blsdb.de/download` hat **zwei** Links „Download BLS-Daten“ – den Navigationslink `https://blsdb.de/download?token=…` (führt nur wieder auf dieselbe Seite; ihm sind Lauf 2/3 gefolgt) und den Datei-Link `https://blsdb.de/assets/uploads/BLS_4_0_2025_DE.zip?token=…`. Keine Challenge, keine Skripte, kein Formular außer der Sprachwahl; Cookie `JSESSIONID`. Seitenfuß „Copyright © 2005-2026 MRI, Standort Karlsruhe“ – ein **Indiz** für das MRI als Betreiber, ersetzt aber nicht den Blick ins Impressum (SETUP J3 Schritt 5 bleibt). Umgesetzt: `downloadPage.linkPath = '/assets/uploads/BLS_4_0_2025_DE.zip'`, Vergleich jetzt **exakt** (kein Präfix, kein Muster, auch kein angehängter Schrägstrich), `tokenParam` `token`; gleicher Host, HTTPS und genau ein Treffer unverändert. `originalFilename` bleibt `BLS_4_0_Daten_2025_DE.xlsx` (Vorrang im ZIP; heißt die xlsx anders, nimmt die Format-Erkennung genau eine xlsx, sonst Abbruch). Neuer Dateiname (z. B. `BLS_4_1_…zip`) → Abbruch mit Hinweis „`linkPath` per Gründer-PR anpassen“ und Liste der Links (gewollt). Tests: Nachbau der echten Seite (beide Links, Sprach-Formular, 17 Links) → genau der ZIP-Link; Ende zu Ende Seite → ZIP → xlsx, Navigationslink nie geladen; Gegenproben ohne ZIP-Link, neuer Dateiname/Präfix/Muster, fremder Host bzw. http, zwei verschiedene ZIP-Links.

**Lauf 5 (38265538146, 12.10.2026): erfolgreich.** ZIP `BLS_4_0_2025_DE.zip` (14.263.306 Bytes, `application/zip`) mit `BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx` (entpackt, 14.093.078 Bytes), `BLS_4_0_Components_DE_EN.xlsx` und `BLS_4_0_Dokumentation_DE.pdf`; 7140 Zeilen, 418 Spalten (je Nährstoff Wert/Datenherkunft/Referenz). Spalten-Bericht: ENERCC (Spalte 6, kcal), PROT625 (12), CHO (18), SUGAR (219), FAT (15), FASAT (246), FIBT (21), NACL (120, g) – alle mit Einheit gefunden → `columnsStatus: 'confirmed'`. **SHA-256 der xlsx `524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60` als `originalSha256` festgenagelt (NB1, Gründer-PR).** Kandidaten: 224 von 236 Zutaten mit Vorschlägen, 12 ohne (u. a. Gewürze, Erythrit, Tempeh, Casein-Pulver) – Zuordnung folgt per eigenem PR.

#### Import-Lauf 1, PR #47: Befunde und Korrekturen (13.10.2026)

**Ausgangslage:** Lauf 38402246877 (Modus `import`) hat PR #47 (Branch `foods-import/38402246877`) erzeugt: 191 Lebensmittel geschrieben, 45 nicht importiert (32 ohne Quell-ID, 13 mit unvollständiger Quellzeile), **87 von 204 Zutaten (42,6 %) „Zuordnung prüfen“ → ⛔ NICHT MERGEN** (NB1). Datei und Spalten sind in Ordnung (Prüfsumme festgenagelt, Spalten bestätigt); die Ursachen liegen in der Gegencheck-Regel, in sechs Zuordnungen und in Definitionsunterschieden der Gründer-Datei. PR #47 wird **nicht gemergt**; nach dem Merge dieses PR startet ein Gründer `foods-import` (Modus `import`) neu.

**Ursachen der 87 Markierungen (jede 🔴-Zeile einzeln geprüft, Werte aus dem Auszug des Branches):**

| Ursache                                                                                    | Zutaten | Beispiele und Begründung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regel** (Fehlalarm des Gegenchecks)                                                      | 57      | Kleine Absolutwerte: Champignons 0,6 statt 2,9 g KH (BLS-KH enthalten 2,7 g Mannit), Halloumi 2 statt 0,1 g KH, Nüsse/Samen 3–8 g KH (2–5 % der Energie). Andere Definitionen: Knoblauch 28 g KH (Gründer, KH inklusive Ballaststoffe) ↔ BLS 3 g CHO + 28,3 g Ballaststoffe (Fructane) – **kein falscher Eintrag** (weder Knoblauchsprossen noch Bärlauch; „Knoblauch roh“ ist richtig), ebenso Tahin, Petersilie, Rucola, Sesam (KH + Ballaststoffe). Pfeffer: Gründer-Datei 0/0/0/0 (kein Vergleichswert).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Mapping-Fehler** (korrigiert)                                                            | 6       | `rinderhackfleisch-5-fett` U010100 „Rind Hackfleisch“ (224 kcal, 16,4 g Fett) → **U203000** „Rind Fleisch, grob entsehnt, sichtbarer Fettanteil max. 5 % (R II) roh“ (Ausgangsfleisch für mageres Hack; Tatar U070100 wäre auch mager, löst aber die Rohfleisch-Regel für Schwangere aus); `schweinehackfleisch-mager` U020100 (271 kcal, 22,1 g Fett) → **U685100** „Schwein Hüfte/Schinkenspeck, roh“ („Schinkenspeck“ = Fleischer-Name des frischen Teilstücks Hüfte, nicht geräucherter Speck; kein mageres Schweinehack im BLS; die Hüfte ist magerer als die Ware – im nächsten Lauf ist 🔴 beim Fett zu erwarten, dann ist es ein **Ersatz**, Gründer-Frage unten); `putenhackfleisch` V481000 „ohne Haut“ (2,2 g Fett, Gründer 5,5 g) → **V485100** „Pute Keule, ohne Haut, roh“ (Putenhack wird meist aus Oberkeule ohne Haut gewolft; nach der Wächter-Prüfung statt „mit Haut“); `roastbeef-aufschnitt` Y131132 (Gericht mit Bratfett) → **U221162** „Rind Roastbeef (Rücken) gebraten ohne Fett (Ofen)“; `frischkaese-light` M820200 (10 % Fett i. Tr., 2,8 g Fett; Gründer 11 g) → **M820500** (40 % Fett i. Tr., nächste Natur-Stufe); `sojaskyr-natur` H844000 (Sojajoghurt, halb so viel Eiweiß) → **Quell-ID offen** (kein Skyr-Eintrag im BLS; Zweitquelle-Frage N2b 1 (3); 11 Rezepte bis dahin nur als Struktur). |
| **Datenunterschied / Produktwahl** (Zuordnung richtig, Gründer-Wert grob oder andere Ware) | 24      | Energie > 15 % und ≥ 20 kcal: Avocado 160↔132, Datteln 280↔356, Süßkartoffel 86↔119, Kidney-/Schwarze/Weiße Bohnen und Linsen (Dose) 95–110↔119–130, Kochschinken 110↔130, Schweinehack 230↔271, Hummus 270↔324, Kokosmilch 180↔227, Senf 85↔111, Seitan 135↔199 (BLS „Fleischersatz glutenhaltig“ mit Öl), Räuchertofu 160↔118 (nur „Tofu“ im BLS), Ingwer 80↔48 (US-Wert ↔ BLS-Messung), Ananas (Dose) 14↔9,4 g KH, Heidelbeeren, Sambal Oelek, Sauerkirschen (Glas). Produktwahl ohne passenderen Eintrag: Express-Reis (Fertigware wasserärmer + Öl; „Reis gedünstet mit Fett und Salz“ X821212 nicht gewählt – Gericht mit unbekanntem Fett, Allergene), Kochsahne 15 % (BLS nur 10 %), Meerrettich (Glas) – Gründer-Wert passt zu „Meerrettich gerieben“, BLS hat Tafel-Meerrettich (12 g Fett, mit Öl), Gemüse-Meerrettich und Meerrettich roh; **nicht** Sahnemeerrettich (noch fetter). Hähnchenbrust-Aufschnitt (BLS gegart ohne Lake, 26 g Eiweiß ↔ 21 g), Falafel (BLS frittiert).                                                                                                                                                                                                                                                                                                                                        |

Zusätzlich neu markiert: `instantkaffee` (bisher nicht importiert, siehe unten; Gründer-Wert entspricht US-Tabellen 353 kcal ↔ BLS 195 kcal; 2 g je Rezept).

**1. Gegencheck fachlich fair (`ALPHA5_IMPORT_TOLERANCE`, `alpha5Deviations`, Tests `crosscheck.test.ts`):**

- **Energie:** „Zuordnung prüfen“ bei > 15 % **und** ≥ 20 kcal (Mindest-Toleranz wie R3).
- **Eiweiß, Kohlenhydrate, Fett:** > 15 %, ≥ 1 g **und** die Abweichung als Energie (Gramm × 4 bzw. 9 kcal) ist ≥ 15 % des Energiegehalts – derselbe Maßstab wie die Energie-Regel. Eine falsche Fettstufe (Milch 0,3 statt 1,5 %: 1,2 g Fett = 23 % der Energie) bleibt rot, 3 g Kohlenhydrate in Mandeln (2 % der Energie) nicht.
- **Lesarten (Definitionen, keine Toleranz):** Kohlenhydrate gegen BLS-CHO, CHO + Ballaststoffe (US-Definition) und CHO − Polyole (ältere Tabellen); Energie gegen kcal + 2 kcal/g Ballaststoffe **nur**, wenn die Kohlenhydrate der Zutat zu „CHO + Ballaststoffe“ passen **und** das Lebensmittel ballaststoffbetont ist (Ballaststoffe ≥ verfügbare KH, z. B. Knoblauch, Sesam, Tahin; nach Wächter S1 – sonst rutschte Weißbrot ← Vollkornbrot mit 10,6 % durch, jetzt 19 % → rot, Test) (eine Definition je Zutat; sonst würde die Energie ballaststoffreicher Lebensmittel pauschal toleranter – Test: Haferflocken 444 statt 370 kcal bleibt rot). Der Bericht nennt Energieanteil und Lesart je Zeile.
- **Kein Vergleichswert:** Gründer-Datei 0/0/0/0 (Pfeffer, Salz, Wasser, Eiswürfel) → eigene Zeile „⚪ kein Vergleichswert“, zählt nicht als „Zuordnung prüfen“, bleibt im Nenner und in der R19-Prüfung (auch im Rezept-Import N2c).
- **Nenner (Wächter K6):** Der Anteil wird über die **verglichenen** Zutaten gebildet (`report.compared`, inkl. „kein Vergleichswert“); Zutaten mit Quell-ID ohne Zeile im Auszug verdünnen ihn nicht mehr. Der Bericht nennt beide Zahlen.
- **Weiterhin erkannt (Tests):** Hack 16 % statt 5 % Fett (Energie + Fett), Apfelmus gesüßt statt Apfel (Energie + KH), Milch 0,3 statt 1,5 % (Fett), Weißbrot ← Vollkornbrot (Energie), kJ statt kcal, Eiweiß/Fett-Spalten vertauscht. **Ganze Datei falsch (Wächter S2):** an 144 anonymisierten, passenden Paaren aus dem Auszug (`crosscheck-fixture.ts`) und – sobald `content/sources/bls/4.0/extract.csv` im Repository liegt – an allen Lebensmitteln des echten Auszugs: Werte × 1,10 / × 0,85 / × 1,25, Spalte KH = Zucker, Fett = gesättigte Fettsäuren, Eiweiß ↔ Fett, Zeilen-Versatz → jeweils > 10 % → ⛔ (lokal am Auszug von Lauf 1 geprüft; Wächter-Messung: 22 % / 39 % / 61 %, KH = Zucker 35 %, Fett = gesättigte FS 33 %, Versatz 70–84 %).
- **Grenze (offen benannt):** Einzelne falsche Quell-IDs unter ähnlichen Lebensmitteln fallen seltener auf: Im Kreuztest der Wächter-Prüfung (jede passende Zutat gegen jede andere Zeile, 29.058 Paare) blieben **4,9 %** unentdeckt (alte Regel 1,2 %), z. B. Cashew/Mandel ← Erdnussmus, Hähnchen ← Schweinefilet, Basmati ← Couscous, Weißer Reis ← Vollkornreis (nur 🟡), Apfel ← Apfelmus ungesüßt, Gurke ← Zucchini. **Netz dafür:** R18 über die Bezeichnung der Quelle (Erdnuss, Schwein, Gluten, Fleisch werden so erkannt) und die menschliche Katalog-Prüfung R19 (Zeilen mit Lesart und 🟡 zuerst). Salz wird gar nicht gegengeprüft (die Gründer-Datei hat keinen Salzwert) – daher der R19-Pflichtpunkt „Salz“ (unten 4a).
- **Merge-Regel unverändert:** > 10 % „Zuordnung prüfen“ → ⛔ (`MAX_REVIEW_SHARE`).

**2. Unvollständige Quellzeilen – fehlende Werte werden nie geraten:** Es fehlten Ballaststoffe (`honig` „<LOD or <LOQ“, `feta`, `lachsfilet`, `seelachsfilet-tk`, `kassler-mager`, `thunfisch-*` (2), `ricotta` „<LOD“, `ahornsirup` „-“), gesättigte Fettsäuren (`instantkaffee`, `backpulver` „-“) und Fett (`orangensaft` „<LOD or <LOQ“, `balsamico-essig` „<LOD“). **Entscheidung (a):** `sugar_g`, `sat_fat_g`, `fiber_g` dürfen `null` sein (= „kein Wert in der Quelle“, auch nicht 0); kcal, Eiweiß, Kohlenhydrate, Fett und Salz bleiben Pflicht (Salz trägt R11). Option (b) geprüft: Für Orangensaft (nur F603600) und Balsamico (nur R125000) gibt es keine andere Quell-ID → beide bleiben **nicht importiert** (Fett ist Pflicht) – **überholt am 13.10.2026: „<LOD“ = 0, beide werden importiert (Abschnitt „Gründer-Entscheidungen 13.10.2026“ unten)**; damalige Gründer-Frage: „<LOD“ (gemessen, unter Nachweisgrenze) für Pflichtwerte als 0 lesen (LMIV-Praxis) oder Zweitquelle. Verbraucher in core geprüft und getestet (`nutrients-import-lauf1.test.ts`): Schema-Plausibilität nur mit Wert, Summen über Zutaten (`computeRecipeFacts`, `scalePortion`, `scaleRecipeForServings`, Tagessumme im Essensplan) bleiben `null`, sobald eine gezählte Zutat keinen Wert hat (`addOptionalNutrient`; 0 g zählen 0), R17 vergleicht null-genau (0 statt „kein Wert“ = rot), Rollen-Vorschlag „süß“ nur mit Zuckerwert, R4 zählt fehlende Ballaststoffe nicht (nur Plausibilität). Die App zeigt Zucker/Ballaststoffe noch nicht an; der Import-Bericht listet die Zeilen unter „ergänzende Werte ohne Zahl“. → 11 Zutaten mehr importierbar. **„<LOD“ und „-“ (Wächter K1):** Beide werden heute `null`; der Original-Text bleibt im Auszug (`extract.csv`) und steht im Import-Bericht („ergänzende Werte ohne Zahl“). Fachlich heißt „<LOD“/„<LOQ“ „gemessen, unter Nachweis-/Bestimmungsgrenze“ (≈ 0), „-“ „nicht bestimmt“ (unbekannt). Folge: Ballaststoffe von Rezepten mit Feta, Lachs, Ricotta oder Honig sind „unbekannt“. Heute harmlos (die App zeigt sie nicht); **bevor Ballaststoffe angezeigt oder als Ziel genutzt werden**, entscheiden die Gründer, ob „<LOD“ als 0 gelesen wird (zusammen mit der Frage Orangensaft/Balsamico).

**3. R4 mit organischen Säuren, Alkohol und Polyolen (LMIV Anhang XIV, `RECIPE_CHECK_LIMITS.atwater`, `atwaterKcal`):** 3 kcal/g organische Säuren, 7 kcal/g Alkohol, Polyole 2,4 statt 4 kcal/g (Teil der Kohlenhydrate, nicht doppelt). Die BLS-Spalten OA, ALC und POLYL (Kopfzeilen am Auszug geprüft) kommen als `organic_acids_g`, `alcohol_g`, `polyols_g` in `nutrients_per_100g` (nur R4, R17 vergleicht sie mit; ohne Zahl → `null`; Spalte fehlt → Feld fehlt) über `sources.ts` `energyExtras`. Ergebnis am Auszug: Apfelessig 1,4 → 18,5 kcal (Quelle 18), Zitronensaft 12,3 → 30,3 (30), Limettensaft 9,9 → 24,4 (24), Sauerkraut 15,5 → 22,9 (23), Champignon 32,5 → 28,5 (28); **0 R4-Befunde** im ganzen Auszug (vorher 5), keine neuen.

**4. R10 „light“:** Anzeigenamen neutral mit Fettangabe, IDs unverändert (Verknüpfung über `alpha5_id`): `frischkaese-light` → „Frischkäse (40 % Fett i. Tr.)“ (Wächter S3: 40 % ist nach Käseverordnung die Fettstufe, nicht die Dreiviertelfettstufe; kein Alias „fettreduziert“ – HCVO-Angabe), `gouda-light-gerieben` → „Gouda gerieben (30 % Fett i. Tr.)“, `mozzarella-light` → „Mozzarella (20 % Fett i. Tr.)“; 0 R10-Treffer in allen Namen/Aliasen der Zuordnung. **Rezepte:** R10 trifft weiterhin den Titel „Käsespätzle light mit Röstzwiebeln“ und im Ratgeber „Light-Getränke“ – das steht in der Gründer-Datei (bleibt unverändert) und ist schon als Gründer-Aufgabe in N2c gelistet.

**4a. Salz bei Aufschnitt (Wächter S5):** `roastbeef-aufschnitt` (U221162), `haehnchenbrust-aufschnitt` (V416132, 0,06 g Salz), `putenbrust-aufschnitt`/`putenbrustaufschnitt` (V486132, 0,05 g) haben Werte von ungesalzenem gegartem Fleisch; Handels-Aufschnitt hat 1,5–2,5 g Salz je 100 g – R11 (Salz je Portion) wäre damit zu mild. Ein Geflügel- oder Roastbeef-Aufschnitt fehlt in der bekannten BLS-Namensliste (Gruppe W nur Geflügelwurst mit Schweinefleisch). **Pflicht-Prüfpunkt „Salz prüfen“** in `reason_de` dieser Zutaten und in der R19-Checkliste (5.1.1 d). Kochschinken/Lachsschinken/Kassler sind Pökelware (2,3–3,8 g) und passen.

**5. Simulation des nächsten Laufs** (lokal, `importFoods` + `sourceNutrientRows` mit dem echten Auszug aus `foods-import/38402246877` und der Zuordnung nach den Wächter-Auflagen): 203 Zutaten mit Quell-ID, 196 davon verglichen; 5 neue Quell-IDs (U203000, U685100, V485100, U221162, M820500) haben im Auszug noch keine Werte. **Ergebnis: 25 von 196 verglichenen Zutaten „Zuordnung prüfen“ = 12,8 %**; im echten Lauf werden die 5 neuen mitverglichen → **12,4 % (25 von 201) bis höchstens 14,9 % (30 von 201)**. 0 R4-, 0 R10-Befunde, 0 R18-/R9-Konflikte (alle 203 BLS-Bezeichnungen geprüft). Nicht importiert bleiben 35 (33 ohne Quell-ID inkl. Sojaskyr, dazu Orangensaft und Balsamico; seit „<LOD“ = 0 nur noch die 33 ohne Quell-ID).

**Ziel ≤ 10 % ehrlich nicht erreicht – Begründung:** Die übrigen 25 sind keine Fehlgriffe, sondern echte Unterschiede zwischen BLS 4.0 und den groben bzw. aus anderen Tabellen stammenden Gründer-Werten (Tabelle oben). Sie lassen sich nur durch Lockern der 15-%-Grenze oder durch Umdeuten der Gründer-Datei „wegrechnen“ – beides würde die Schutzfunktion schwächen. Nach NB1 darf gemergt werden, **wenn der Grund geklärt ist**; diese Tabelle ist die Klärung für die R19-Prüfung. **Vorschlag zur Gründer-Entscheidung (nicht umgesetzt):** eine von Menschen gepflegte Liste „bestätigte Datenunterschiede“ (wie die Ausnahmeliste, mit `confirmed_by`), je Eintrag an Quell-ID **und** die importierten Werte gebunden – eine andere Datei oder andere Spalten machen die Bestätigung ungültig, die Merge-Regel greift dann wieder voll. Damit läge der Lauf nach der Bestätigung unter 10 %.

**Offen für die Gründer:** (1) Diesen PR mergen, dann `foods-import` Modus `import` neu starten (PR #47 schließen, nicht mergen); (2) im neuen PR die 5 neuen Quell-IDs ansehen (Fettgehalt Hack/Putenhack/Roastbeef, Frischkäse) und bei Aufschnitt das Salz; (3) **DRINGEND – Zweitquelle (Wächter S6):** Mit Sojaskyr ohne Quell-ID sinken die Rezepte, deren Zutaten alle eine Quell-ID haben, von 69 auf 66 und die **veganen von 12 auf 9 (von 73 veganen)** – der vegane Bestand im Testmodus ist sehr dünn. Dieselbe Frage betrifft Proteinpulver (Whey, Casein, vegan), Erythrit und Tempeh: Zweitquelle (eigener Ordner, Lizenz, Prüfsummen, S3) oder Zutaten ohne Quellwerte; (4) **Schweinehack mager:** Bleibt die Hüfte (U685100) im nächsten Lauf beim Fett 🔴, entscheiden: als begründeten **Ersatz** behalten oder Zutat ohne Quelle (dann 4 Rezepte nur als Struktur); (5) ~~Orangensaft/Balsamico und „<LOD“ bei Pflichtwerten (K1)~~ **entschieden 13.10.2026: „<LOD“ = 0** (unten); (6) ~~Liste „bestätigte Datenunterschiede“~~ **umgesetzt 13.10.2026** (unten), Pflicht-Check in CI als nächster Schritt.

#### Gründer-Entscheidungen 13.10.2026: „unter Nachweisgrenze“ = 0, Liste „bestätigte Datenunterschiede“, Zweitquelle

**Entscheidungen (Gründer, 13.10.2026):** (1) Werte „unter Nachweisgrenze“ gelten als **0 g** – für alle Nährwerte, auch Pflichtwerte. „-“ bzw. leer (nicht bestimmt) bleibt unbekannt (`null` bzw. Zeile „nicht im Auszug“) wie bisher. (2) Eine **Zweitquelle** für Sojaskyr, Proteinpulver (Whey, Casein, vegan), Erythrit, Tempeh usw. wird **nach dem Import** eingeplant – **nächste Etappe**, hier nicht umgesetzt (Infrastruktur S3 wie 19.3: eigener Ordner, Lizenz, Prüfsumme, Allowlist-Eintrag). (3) Merge-Regel mit einer von Gründern freigegebenen Liste „bestätigte Datenunterschiede“ (Leitplanken aus der Wächter-Prüfung Import-Lauf 1, Frage 5).

**A. „unter Nachweisgrenze“ = 0 (`source-rows.ts`, einzige Übersetzungsstelle für Import UND R17):**

- **Schreibweisen am echten Auszug geprüft** (Lauf 38402246877, alle 138 Wert-Spalten der 177 Zeilen): `<LOD` (606×), `<LOD or <LOQ` (108×), `<LOQ` (68×), `TR` (94×, „trace“ = Spuren), `-` (3.953×), leer (1×). In den genutzten Spalten: Fett `F603600` Orangensaft „<LOD or <LOQ“, `R125000` Balsamico „<LOD“; Ballaststoffe 8×, Alkohol 27×, Natrium 2× (Salz kommt aus NACL mit Zahl, daher ohne Wirkung).
- **Regel:** Genau diese Texte (nach Trimmen, Schreibweise wie in der Quelle) → 0: `<LOD`, `<LOQ`, `<LOD or <LOQ`, `TR`, dazu `<NWG` und `Spuren` für eine deutschsprachige Zweitquelle (`BELOW_DETECTION_TEXTS`). „<LOQ“ (unter Bestimmungsgrenze) wird bewusst mitgezählt: Die Quelle fasst es selbst mit „<LOD“ zusammen („<LOD or <LOQ“), und die Nährwertkennzeichnung (LMIV) gibt solche Werte als 0 an. Alles andere – „-“, leer, „n.b.“, „<lod“, „< LOD“ – bleibt unbekannt (nie geraten). Gilt für alle acht Nährwerte und die R4-Zusatzwerte (organische Säuren, Alkohol, Polyole).
- **Integrität und R17 unverändert:** Der Auszug (`extract.csv`) enthält weiter die unveränderte Original-Zeile mit „<LOD“; `sources-integrity` vergleicht die Rohzeilen wie bisher. Nur die Übersetzung ändert sich – und weil Import und R17 (`content:validate`, App-Bündel) dieselbe Funktion `sourceNutrientRows` nutzen, bleiben Lebensmittel und Auszug deckungsgleich.
- **Sichtbar im Bericht:** neuer Abschnitt „Quellzeilen mit Werten ‚unter Nachweisgrenze‘ (als 0 übernommen)“ mit Quell-ID, Feld und Original-Text.
- **Wirkung am Auszug von Lauf 1 (Simulation mit dem Code dieses PR):** 177 statt 175 Zeilen übernommen, 0 statt 2 Probleme, 3 statt 10 Zeilen mit „kein Wert“ (nur noch echte „-“: `backpulver` und `instantkaffee` gesättigte FS, `ahornsirup` Ballaststoffe). **`orangensaft` (F603600) und `balsamico-essig` (R125000) werden importierbar** (Zuordnung war schon vorhanden): Orangensaft 41 kcal / 0,75 / 8,5 / 0 g – kein Befund im Gegencheck; Balsamico 95 kcal / 0 / 20,04 / 0 g – nur 🟡 (kcal 7 %, KH 15 % = 13 % der Energie). Ballaststoffe von Feta, Lachs, Ricotta, Honig, Thunfisch usw. sind jetzt 0 statt „unbekannt“ (Wächter K1 erledigt). Anteil „Zuordnung prüfen“: 25 von 198 verglichenen (12,6 %); im echten Lauf mit den 5 neuen Quell-IDs 25–30 von 203.
- **Tests** (`extract-source.test.ts`): Orangensaft-/Balsamico-/Walnuss-/Himbeer-Zeilen mit „<LOD or <LOQ“, „<LOD“, „<LOQ“, „TR“, „<NWG“, „Spuren“ → 0 auch bei Pflichtwerten (Fett, Salz); „-“, leer und fremder Text → unbekannt bzw. Zeile fehlt; Alkohol „<LOD“ → 0.

**B. Liste „bestätigte Datenunterschiede“ (`content/food-mapping/bestaetigte-abweichungen.json`, Schema und Prüfung `confirmed-differences.ts`):**

- **Ablage:** außerhalb von `content/foods/` (dort schreibt nur der Bot), **nicht** in `.github/CODEOWNERS` (Gründer-Entscheidung 13.10.2026, Option (a), unten). Die Datei ist **leer** eingecheckt (nur Infrastruktur); die Einträge kopiert eine Claude-Sitzung nach dem nächsten Import-Lauf aus dem Bericht (`docs/SETUP.md` J3).
- **Eintrag (Zod, strikt):** `alpha5_id`, `source` { `db`, `version` }, `source_ref`, `source_values` { `kcal`, `protein_g`, `carbs_g`, `fat_g` } (wie der Import sie aus dem Auszug liest), `file_values` { `kcal`, `eiweiss_g`, `kohlenhydrate_g`, `fett_g` } (Gründer-Datei), `reason_de`, `confirmed_by`, `confirmed_at`. Jede Zutat höchstens einmal. **`confirmed_by` ist eine Angabe, kein Nachweis** (den Text schreibt eine Claude-Sitzung); der Nachweis der Gründer-Bestätigung ist allein der **Merge des Bestätigungs-PRs durch einen Gründer** (Git-Historie). Texte mit dem Platzhalter `AUSFÜLLEN` lehnt das Schema ab.
- **Kopierfertige Einträge im Bericht (Wächter LOD, S2):** Die Abweichungstabelle zeigt nur abweichende Felder und bei einer Lesart (z. B. KH + Ballaststoffe) den umgerechneten Wert – daraus abgeschriebene Einträge wären ungültig. Deshalb gibt der Import-Bericht je 🔴-Zutat (auch bei ungültiger Bestätigung) in einem aufklappbaren Block „📋 Kopierfertige Einträge“ einen fertigen JSON-Eintrag aus (`confirmationDraft`): `alpha5_id`, `source`, `source_ref` und genau die acht Werte, mit denen `confirmationMismatches` vergleicht (Rohwerte der Quelle, nicht der Lesart-Wert); `reason_de`, `confirmed_by`, `confirmed_at` sind Platzhalter. Test: ein aus dem Bericht kopierter und nur an den Platzhaltern ausgefüllter Eintrag ist gültig und macht die Zutat 🟠; unverändert kopiert wird er abgelehnt.
- **Bindung:** Der Import vergleicht exakt (auf 6 Nachkommastellen wie die Umrechnung, keine Toleranz) Quelle, Version, Quell-ID und alle acht Werte. Weicht einer ab (andere Datei, andere Spalte, andere ID, geänderte Gründer-Datei) → Eintrag **ungültig**, die Zutat ist wieder 🔴 „Zuordnung prüfen“; der Bericht nennt jeden abweichenden Wert („Bestätigungen ungültig“).
- **Im Bericht sichtbar:** Bestätigte Zeilen stehen weiter in der Abweichungstabelle, mit 🟠 statt 🔴, dazu ein Abschnitt „Bestätigte Datenunterschiede“ mit Grund, Name und Datum. Einträge ohne Wirkung (Zutat nicht verglichen oder ohne „Zuordnung prüfen“) werden gemeldet.
- **Merge-Regel (`reviewVerdict`):** ⛔, wenn (a) mehr als 10 % der verglichenen Zutaten 🔴 offen sind (Bestätigte zählen **nicht**), **oder** (b) mehr als **20 %** (`MAX_CONFIRMED_SHARE`) bestätigt sind – unabhängig von der Liste. Begründung des Deckels: In Lauf 1 waren rund 12 % echte Unterschiede; eine vergiftete Datei markiert 22–97 % (Wächter-Messung) und lässt sich so nicht „wegbestätigen“.
- **Ungünstigster Fall offen benannt (Wächter LOD, K3):** Beide Grenzen zusammen lassen bis zu **30 %** „Zuordnung prüfen“ ohne ⛔ durch (≤ 10 % 🔴 offen + ≤ 20 % 🟠 bestätigt). Vertretbar nur, weil jede Bestätigung exakt an Quelle, Quell-ID und die acht Werte gebunden ist: Eine andere Datei oder Spalte macht alle Einträge ungültig (Lauf fällt wieder unter die 10-%-Regel), und eine an eine vergiftete Datei angepasste Liste scheitert am Deckel (Tests mit 144 Fixture-Paaren). Jede bestätigte Zeile bleibt mit Grund im Bericht sichtbar; R18/R19 bleiben als Netz.
- **Nur von `main`:** `foods-import` läuft nur auf `main` (sonst Abbruch) und liest die Liste aus diesem Stand – wie die Allowlist. Fehlt die Datei → leere Liste; ist sie ungültig → kein Import („Liste ungültig“), nie still ignoriert.
- **Tests** (`confirmed-differences.test.ts`, `foods-import.test.ts`): bestätigt und passend → 🟠, nicht gezählt; Quellwert, Fett, Gründer-Wert, Quell-ID oder Version geändert → ungültig und 🔴; Deckel 4 von 20 erlaubt, 5 von 20 → ⛔; vergiftete Datei (alle Werte × 0,85, Zeilen-Versatz) an 144 Fixture-Paaren: Liste wird ungültig → ⛔, und eine an die vergiftete Datei angepasste Liste bleibt über den Deckel ⛔; eingecheckte Datei gültig und leer, **nicht** in CODEOWNERS; Platzhalter → ungültig; kopierfertiger Eintrag aus dem Bericht (mit Lesart) ausgefüllt → gültig und 🟠; ungültige Liste → kein Import; Lauf außerhalb von `main` abgelehnt. Zu A zusätzlich (Wächter LOD, K1): kcal „<LOD“ mit Makros > 0 → 0 kcal, R4 meldet rot (`extract-source.test.ts`).
- **Freigabe-Weg – Gründer-Entscheidung 13.10.2026, Option (a):** Die Liste steht **nicht** unter CODEOWNERS. Claude legt den Bestätigungs-PR „Bestätigte Datenunterschiede …“ an (Einträge aus dem Bericht kopiert), **nur ein Gründer merged ihn** – danach `foods-import` neu starten und den neuen Import-PR selbst mergen (`docs/SETUP.md` J3 Schritt 8). **Regel: Claude merged Bestätigungs-PRs nie; ein Merge durch Claude nur auf ausdrückliche Anweisung des Gründers im Chat, im Merge-Text vermerkt.** Das gilt wie beim `originalSha256`-PR und bei den `foods-import`-PRs.
- **Ein-Konto-Problem (ehrlich):** Claude arbeitet mit dem einzigen GitHub-Konto der Gründer und hat damit technisch dieselben Rechte (Approve, Merge – auch über die GitHub-Werkzeuge der Sitzung). GitHub unterscheidet nicht zwischen Claude und Gründer; CODEOWNERS hätte daran nichts geändert (es verhindert nur die Freigabe des eigenen PRs – und hätte den Claude-PR für die Gründer unmergebar gemacht, Wächter LOD S1). Die Schranke ist deshalb eine **Regel, keine Technik** – wie schon bei den `foods-import`-PRs. Sie schützt gegen Versehen, nicht gegen eine Sitzung, die sich nicht daran hält; ⛔ ist zudem bis zum CI-Pflicht-Check nur Text. Gleicher Schutz wie die Zuordnung, die schon heute nicht unter CODEOWNERS steht. Der Merge des Gründers ist zugleich der einzige Nachweis der Bestätigung (`confirmed_by` ist nur eine Angabe).
- **Mögliche spätere Verschärfung (nicht umgesetzt):** (b) ein Workflow `foods-confirm` (Autor `github-actions[bot]`) erzeugt den Bestätigungs-PR; dann wäre die Liste wieder unter CODEOWNERS freigebbar. Leitplanken laut Wächter-Prüfung: nur auf `main` mit dem Code von `main`; öffnet nur einen PR (nie Approve/Merge/Auto-Merge; Rechte `contents: write`, `pull-requests: write`); Werte nie aus Eingaben – nur Nummer des offenen `foods-import`-PRs (Kopf-Commit vom Bot, verified), `alpha5_id`s und je ID ein Grund (≥ 10 Zeichen, über `env`); Werte aus den Bot-Dateien des PRs und `alpha5-rezepte.json` von `main` (Quelle: `confirmationDraft`); nur IDs, die wirklich 🔴 sind, nie „alle bestätigen“, Abbruch über dem Deckel; Tabelle im PR-Text. Restrisiko bleibt (Claude könnte mit dem Gründer-Konto freigeben). Am sichersten wäre ein **zweites echtes Personen-Konto** (z. B. Mitgründer) als Code-Owner. Einen Ruleset-Bypass für die Gründer **nicht** einrichten (schwächt alle Pflicht-Checks).
- **Nächster Schritt (nicht in diesem PR):** Pflicht-Check in CI für `foods-import/*`-Pull-Requests, der `reviewVerdict` mit dem Code und der Liste von `main` neu rechnet (z. B. im Workflow `sources-integrity-main`), damit ⛔ ein roter Haken ist und nicht nur Text; danach die Zweitquelle.

**So testest du es am Handy:** Pull Request → **Checks → ci** grün, darunter der neue Job **sources-integrity** und der Workflow **sources-integrity-main** (läuft erst ab dem nächsten PR nach dem Merge) („Noch keine Quellauszüge …“). Nach dem Merge: **Actions → foods-import → Run workflow** (Branch main, Modus `kandidaten`) → **Summary** zeigt die Kandidaten je Zutat.

### N2c – Rezept-Import als Entwurf (umgesetzt, 12.10.2026: Skript, Schemas, Regeln, Workflow, Bündel)

Keine Migration (Tabellen in N7), keine Anzeige in der App (N4). **Die Rezept-, Plan- und Ratgeber-Dateien sind nicht
eingecheckt:** Plan 19.2/19.11 sieht sie als Pull Request des Workflows `alpha5-import` vor, und ohne Lebensmittel-
Katalog (`content/foods/` ist bis zum `foods-import` leer) lassen sich Allergene, Schwangerschafts-Hinweis, `heated`,
Haltbarkeit und Nährwerte nicht berechnen – Werte werden nicht erfunden.

1. **Core (Zod, 19.4):** `recipe-schema.ts` um `section_de` (≤ 40), `categories[]` (`RECIPE_CATEGORIES`, 8 Themen),
   `total_minutes` (1–360, Vorbereitung + Kochzeit ≤ Gesamtzeit), `ingredients[].role` (`INGREDIENT_ROLES`),
   `cost_estimate { eur_per_serving, as_of, basis: 'estimate', reviewed_by? }` erweitert; `import-meta.ts`
   (`source_file`, `import_hash`, `import_assumptions`, `import_assumptions_confirmed_by`; Freigabe mit unbestätigter
   Annahme = Schemafehler; Annahme „erhitzt“ ohne `heated: true` = Schemafehler). Neue Arten
   `meal-prep-plan-schema.ts` (`recipe_ids` 1–6, `cook_steps` 0–240, `storage_plan` Mo–Fr × `fridge|freeze|fresh`,
   `storage_de`, `dinner_hint_de`) und `guide-schema.ts` (`sections[] { heading_de, body_de[], notice_de? }`,
   `places[]`, fester Text `CARB_LOADING_NOTICE_DE`). Konstanten `RECIPE_EXTENSION_LIMITS`, `MEAL_PREP_PLAN_LIMITS`.
2. **Prüfregeln:** R20 (rot) + R20H (gelb) in `meal-prep-checks.ts` (Rezepte existieren/geeignet, freigegebener Plan
   nur mit freigegebenen Rezepten, Startminuten nicht fallend, `storage_plan` vollständig und nach R9, Wortregel
   „N Tage“ gegen die R9-Grenze des genannten Rezepts – nennt der Text keines, gilt die kürzeste des Plans);
   `deriveStoragePlan` (Kochtag Sonntag, Kühlschrank bis `fridge_days`, sonst einfrieren bzw. frisch). R21 (rot) +
   R21H (gelb) in `guide-checks.ts` (Textregeln, Carb-Loading-Hinweis; Mengen je kg/Stunde, mg, Supplemente). R22
   (gelb) in `recipe-checks.ts` (`criteriaCategories`: „schnell“ ⇔ ≤ 10 Min., Pre-/Post-Workout ⇔ Trainings-Angabe,
   „meal-prep“ ⇔ geeignet; nur bei vorhandenem Feld `categories`). `validateContent` kennt `meal_prep_plan` und
   `guide` (R1/R15), `selectNutritionContent` liefert zusätzlich `mealPrepPlans` (nur mit allen Rezepten) und
   `guides`.
3. **Import-Fachregeln in Core** (`import-rules.ts`): `findHeatingStep` (Wortliste aus 19.2 in üblichen Formen,
   Zutatenname exakt, mit Endung oder als Kopfwort ab 4 Buchstaben, z. B. „Lachs“ für „Lachsfilet“; „kochendes
   Wasser“ zählt nicht), `estimateCookMinutes`, `proposeIngredientRole`, `criteriaCategories`.
4. **Skript** `packages/content/src/import/alpha5.ts` + `alpha5-run.ts`, `pnpm content:import-alpha5` (Modi
   `bericht` – Standard, schreibt nichts –, `schreiben`, `pull-request`): `alpha5FileSchema` strikt (unbekannte
   Felder, Pflichtfelder, doppelte IDs, unbekannte Zutat/Kategorie/Abschnitt/Abteilung, Plan mit unbekanntem Rezept,
   nicht umwandelbare Menge 0 → Abbruch, nichts geschrieben); Abbildung wie 19.2; liest den Katalog nur (S3) und
   schreibt ausschließlich `content/recipes|meal-prep-plans|guides/`; Rezept nur, wenn alle Zutaten im Katalog sind
   (sonst „Zutat fehlt im Katalog“, abhängiger Plan ebenso), bei leerem Katalog gar nichts; `import_hash`,
   Versionen, Schutz von `published`/`archived` und von Hand geänderten Entwürfen, fehlende IDs nur gemeldet.
   Bericht: Zahlen, fehlende Zutaten, Abweichungen > 3 % je Rezept und je Zutat, Ernährungsform/Schwein,
   umgewandelte Mengen, `heated`, Schutz/Handänderung, Abdeckung laut Datei (K9), Prüfung R1–R22 der gebauten
   Inhalte inkl. Strukturprüfung ohne Katalog, R16-Tabelle.
5. **Workflow** `.github/workflows/alpha5-import.yml` (manuell, nur `main`, Actions SHA-gepinnt, nur `GITHUB_TOKEN`):
   Skript im Modus `pull-request` (verifizierter Commit über die GitHub-API auf `alpha5-import/<Lauf-ID>`, PR mit
   Bericht, `ci` gestartet), danach Schutzschritt „keine Änderung unter `content/foods` oder `content/sources`“.
   Strukturtest in `workflows.test.ts`. Klick-Schritte: `docs/SETUP.md` Teil J „Rezepte importieren“.
6. **`content:validate`** lädt `NUTRITION_CONTENT_FOLDERS` (recipes, meal-prep-plans, guides), zählt sie und zeigt
   die **Abdeckungstabelle R16** in der CI-Zusammenfassung (sobald es Rezepte gibt).
7. **Bündel und App:** `scripts/bundle-content.mjs` bündelt zusätzlich `nutritionFiles` (foods ohne Erwartungsliste,
   recipes, meal-prep-plans, guides) und `nutritionCatalog` (Quellauszüge, Erwartungs-/Ausnahmeliste,
   `ATTRIBUTION.md` je Quelle als Text; im Supabase-Build leer). `packages/content/src/foods/catalog-texts.ts`
   übersetzt die Texte (eine Stelle, auch von `catalog-loader.ts` genutzt; Paket-Export `@fitnessapp/content/catalog`).
   `apps/mobile/src/data/local-backend.ts`: `nutritionLibraryFromBundle` / `loadNutritionLibrary` mit
   `selectNutritionContent(…, { allowDrafts: true })` (Testmodus; fehlerhafte Begleitdaten → verworfen, sichere
   Richtung). Tests `nutrition-library.test.ts` (W24, Bündel-Teil).

**Import-Probelauf (12.10.2026, lokal, Modus `bericht`, Katalog leer):** Datei gültig, **242 Rezepte, 236 Zutaten,
4 Meal-Prep-Pläne, 2 Ratgeber** (Soll erfüllt). Geschrieben: 0 („Katalog fehlt“, 236 Zutaten fehlen). Gebaut: 2
Ratgeber → **3 rot (R21: „Light-Getränke“, „eiweißreich“ im Ratgeber Unterwegs, „gesunde Freizeitsportler“ im
Wettkampf-Ratgeber), 4 gelb (R21H: g/kg- und g/Stunde-Angaben)**. Strukturprüfung der 242 Rezepte ohne Katalog
(R1, R10, R14, R22): **alle schema-gültig, 15 rot (R10: 12 × „eiweißreich“, 1 × „light“ im Titel
„Käsespätzle light …“, 1 × „ohne Zuckerzusatz“, 1 × „ballaststoffreich“), 0 gelb**. **Nach der Wächter-Prüfung
(erweiterte R10-Liste, S1):** Ratgeber 6 rot / 4 gelb (zusätzlich 2 × „Eiweißquelle“ im Ratgeber Unterwegs und die
Überschrift „Ballaststoff- und fettarm essen“), Rezepte **24 rot** (zusätzlich 4 × „fettarm“, 2 × „schlank“,
„fettfrei“, „Low-Carb“, „Eiweißquelle“). Mengen `menge_g: 0`: 305 Prise,
131 TL, 10 EL, 23 ml, 3 Stück. Abdeckung laut Datei: 28 Rezepte nur „mit Fleisch“, 62,4 % vegetarisch/vegan (K9).
Abweichungen > 3 %, `heated`-Annahmen, R20 und R16 sind erst mit Katalog berechenbar (erster Workflow-Lauf).

**Abweichungen / Präzisierungen:**

- **Ordner:** `CONTENT_FOLDERS` bleibt bei Übungen/Vorlagen (die Pipeline nutzt es); die Ernährung hat
  `NUTRITION_CONTENT_FOLDERS` (Lebensmittel lädt weiter `catalog-loader.ts`). In `bundle-content.mjs` stehen beide.
- **Bündel:** Ernährungs-Inhalte liegen getrennt in `nutritionFiles`, damit Übungs-/Vorlagen-Code und Admin
  unverändert bleiben. Die App bekommt die Abhängigkeit `@fitnessapp/content` (nur der reine Export `./catalog`).
- **Leerer Katalog → nichts schreiben** (auch keine Ratgeber), damit der erste PR vollständig ist; Rezepte mit
  fehlender Zutat werden übersprungen statt mit Lücken geschrieben.
- **`categories`:** Themen-Kategorie der Datei + Tags (Ausdauer, Wettkampf, Dessert, Spar-Küche) + Merkmals-
  Kategorien (R22). „meal-prep“ umfasst alle geeigneten Rezepte (83 mit Tag „Meal-Prep“), nicht nur die 12 der
  Wochenpläne; Name deshalb „Meal-Prep“.
- **Abschnitte:** Training → `snack` + Trainings-Angabe; Wettkampf: Carb-Loading und Vorabend → `main`,
  Renntag-Frühstück → `breakfast` + vor dem Training, Im Rennen → `snack` + während, Nach dem Ziel → `snack` + nach.
- **`prep_minutes`/`cook_minutes`:** Kochzeit aus Minutenangaben in Schritten mit Hitze-Verb geschätzt
  (`estimateCookMinutes`), Rest Vorbereitung; maßgeblich ist `total_minutes`.
- **Mengen 0 g:** „nach Geschmack“ → Prise, skaliert nicht; Messerspitze → Prise; TL/EL/ml/Blätter/Eiswürfel →
  `tsp`/`tbsp`/`ml`/`piece` – **ohne Umrechnung im Katalog meldet R2 rot** (Rezept im Testmodus unsichtbar).
  Die Einheiten (`units` in `content/food-mapping/alpha5-zuordnung.json`) sind noch leer; sie gehören in die
  Zuordnung (eigene Claude-Sitzung + R19-Prüfung), nicht ins Import-Skript (S3).
- **Rollen** nur als Vorschlag ohne eigenes Kennzeichen (Bestätigung bei der Fachprüfung); `import_assumptions`
  enthält nur die `heated: true`-Annahmen.
- **Meal-Prep-Pläne:** `storage_plan` wird aus R9 hergeleitet (sichere Richtung), die Datei-Texte („3–4 Tage“,
  „5 Tage“) bleiben und werden von R20 rot gemeldet, bis Frage 19.12 (b) entschieden ist. Keine feste Reihenfolge
  der Pläne im Schema (Gratis-Plan „erster in fester Reihenfolge“ → Sortierung nach ID oder Feld in N3).
- **Nicht in N2c:** Eintrag „Lizenzen“ in der App und PDF-Fuß (erst wenn BLS-Werte angezeigt werden, N4/N6; die
  Namensnennung reist schon jetzt im Bündel mit), `content-seed` für die neuen Arten (N7), Sammelfreigabe (N2d).

**Wächter-Prüfung N2c (12.10.2026): BESTANDEN MIT AUFLAGEN** (Bericht `waechter-n2c.md`). Umgesetzt:

- **B1 – „erhitzt“ ≠ „durchgegart“:** `findHeatingStep` kennt `NOT_FULLY_COOKED_PATTERNS` (glasig, rosa, medium,
  blutig, halbgar, Spiegelei, wachsweich, weich gekocht, pochiert, „Eiweiß fest“, flüssiges Eigelb, Carpaccio, Tatar,
  Sushi, Ceviche, nur kurz/kurz anbraten, roh). Nennt irgendein Schritt mit der Zutat eines davon, bleibt
  `heated: false`. Bei Eiern `true` nur bei „hart“/„hartgekocht“ oder ≥ 9 Minuten (`EGG_HARD_MIN_MINUTES`, kleinste
  Angabe im Schritt; PRODUKTENTSCHEIDUNG, Fachprüfung). Die sechs Sätze der Gründer-Datei sind Tests. Zusätzlich
  zählen **unbestätigte Annahmen „durchgegart“ für die Schwangerschaft wie `heated: false`** (`computeRecipeFacts`,
  Grund `unconfirmed_heated`); der Import setzt `declared_pregnancy_caution` entsprechend. Folge für N2d: Wer die
  Annahmen bestätigt, muss `declared_pregnancy_caution` neu setzen (R13 meldet es rot).
- **S1:** R10/R21 zusätzlich „fettarm“, „fettfrei“, „kalorienarm“, „energiearm“, „zuckerarm“, „salzarm“,
  „natriumarm“, „Low Carb/Low Fat“, „reich an“, „Eiweiß-/Protein-/Ballaststoffquelle“, „schlank“ („fettreduziert“
  bewusst nicht – Produktbezeichnung).
- **S2:** `NutritionLibrary.recipes` und `.mealPrepPlans` sind ein **Bestand, nicht personenbezogen** – anzeigen
  bzw. anwenden nur über die Engine (`filter.ts`, `applyMealPrepPlan` mit dem kompletten Filter, 19.6 B1, N3).
- **S3:** W24 über `nutritionLibraryFromBundle` mit echtem BLS-4.0-Auszugsformat: Positivfall, nicht
  katalog-geprüft, roter Befund, Plan mit fehlendem Rezept, Quelle außerhalb der Allowlist (mit Lebensmittel).
- **S4:** Der Schein-Schritt nach dem Commit ist entfernt (die Zielordner prüft das Skript vor dem Commit). Der
  Commit setzt genau auf `GITHUB_SHA` auf (`expectedBaseSha`; hat sich `main` geändert → Abbruch „bitte neu
  starten“), und ein offener `alpha5-import/*`-Pull-Request bricht den Lauf ab.
- **K1:** Import-Annahme nur für eine vorhandene Zutat mit gleicher `food_id` (Schema). Das Zurücksetzen der
  Bestätigung bei späteren Handänderungen kommt mit der Sammelfreigabe (N2d).
- **K3 (a):** Bündel liest unter `content/sources/` nur Ordner. (b) Größe/Spalten-Kürzung und (c) dynamischer
  Import von `buildNutritionCatalog` folgen in N4, wenn die App den Bestand lädt (Module klein, Chunk lazy).
- **K4:** R20 vergleicht „N Tage“ immer mit der kürzesten Haltbarkeit aller Plan-Rezepte (genannte Rezepte nur in
  der Meldung), solange 19.12 (b) offen ist.
- **K6:** Bei fehlendem Katalog steht im Bericht „Nicht prüfbar – Katalog fehlt“ statt „0 Abweichungen“.
- **Gleiches Muster für `foods-import`** (Basis-SHA, offener PR) ist dort noch nicht umgesetzt – Hinweis für N2b
  Teil 2.

**Offen für die Gründer:** (1) Teil J (Ruleset, Adresse, `foods-import`) – danach **Actions → alpha5-import → Run
workflow**; (2) die 24 R10-Texte der Rezepte und 6 R21-Texte der Ratgeber umformulieren (z. B. „eiweißreich“ →
neutrale Zahl, „light“ → „leicht“ nur ohne Nährwert-Versprechen; „Light-Getränke“ ist eine Produktart, aber nicht
zu „zuckerfrei“ umschreiben – das wäre wieder rot; „gesunde Freizeitsportler“ ist ein Sicherheits-Hinweis und darf
die Einschränkung nicht verlieren, z. B. „für Freizeitsportler ohne Vorerkrankungen“; „Ballaststoff- und fettarm
essen“ und „Eiweißquelle“ im Ratgeber neutral fassen, z. B. „Wenig Ballaststoffe und Fett“, „was dir Eiweiß
liefert“), am besten in der Gründer-Datei, dann neu importieren; Titel mit „Protein-“ (z. B. „Heidelbeer-Protein-
Muffins“, „Protein-Bananenbrot“) bei der Fachprüfung ansehen (Wächter K5: „Proteinquelle“ setzt ≥ 12 % Energie aus
Eiweiß voraus); (3) Frage 19.12 (b) (Haltbarkeit der Meal-Prep-Pläne); (4) Einheiten TL/EL/ml je Zutat in der Zuordnung
ergänzen lassen (eigene Claude-Sitzung).

**So testest du es am Handy:** Pull Request → **Checks → ci** grün. Nach dem Lebensmittel-Import: **Actions →
alpha5-import → Run workflow** → im neuen Pull Request stehen Zahlen und Befunde (19.11).

### N3 – Core: Essensplan und Einkaufsliste (umgesetzt, 12.10.2026)

Nur reine Logik in `packages/core/src/nutrition/`, keine App (N4/N5), keine Migration (N7). Gearbeitet wird mit den
Test-Fixtures aus N2a (`content/nutrition-fixtures.ts`) plus N3-Ergänzungen (`nutrition/meal-plan-fixtures.ts`, nur
in Tests), weil der echte Katalog erst mit `foods-import`/`alpha5-import` entsteht.

1. **Dateien** (`packages/core/src/nutrition/`, Export über `index.ts`):
   - `filter.ts` – **einzige** Stelle für die harten Regeln (6.1, 19.6 B1): Status (`published`, Testmodus `draft`),
     roter Befund (`redRecipeIds`), Lebensmittel vorhanden und katalog-geprüft (R19), Nährwerte berechenbar (R2),
     Alkohol (R12), Ernährungsform, Schwein nur bei `eatsPork === true` (`null` = nein, W10/G2, Gelatine unbekannter
     Herkunft = Schwein), Unverträglichkeiten, „mag ich nicht“ (hart, K9: Unverträglichkeit schlägt „mag ich“),
     `pregnancy_caution` aus Katalog-Flag, `heated: false`, `no_cook` und **unbestätigter Import-Annahme
     (`unconfirmed_heated`)**. Optionale Zutaten werden weggelassen (S3), Ersatz-Zutaten nur mit passendem
     `for_groups` und **komplettem erneuten Filter** (S4); am Ende prüft `computeRecipeFacts` das ganze Rezept noch
     einmal. Dazu `slotFitReasons` (Mahlzeiten-Typ, Meal-Prep-Eignung, „werktags höchstens X Minuten“, Wettkampf nie
     automatisch, Ergänzungs-Snack nur `no_cook`).
   - `scale.ts` – `scalePortion` (Faktor 0,5–2,0, Rundung nach 6.2, Eier ganz, nie 0, Nährwerte nach der Rundung),
     Portionswähler `scaleRecipeForServings` (1–12, 19.6) und `balancePortions` (Tagesausgleich ins Planband mit
     gerundeten Mengen, Zielpunkt Bandmitte, einzelnes Nachregeln bei Rundungssprüngen, feste Portionen bleiben).
   - `meal-plan.ts` – `buildMealPlanWeek` (6.3): Plätze aus den Tageszielen, Kandidaten über `filter.ts`, Punkte
     (`MEAL_PLAN_SCORING`: Passung, Eiweiß, Rolle vor/nach dem Training über `training_tags`/Kategorien,
     „mag ich“, Wiederholung, Haupt-Eiweißquelle am Vortag, Zutaten-Wiederverwendung, feste Streuung je Variante),
     Gleichstand über `stableHash`, Wiederholungsgrenzen (`MEAL_PLAN_REPEAT_LIMITS`), Tagesausgleich mit bis zu 2
     Ergänzungs-Snacks, Status `complete` | `below_floor` (+ `day_below_floor`) | `no_targets` (Faktor 1, höchstens
     ein Snack unter `NO_TARGETS_MIN_DAY_KCAL`), leere Plätze mit Grund (`emptySlots`), vergangene Tage aus
     `existingPlan` unverändert, schon gekochte Reste fest. `swapMealRecipe` („Rezept tauschen“), `mealPlanBand`,
     `daySafetyKey`.
   - `meal-prep.ts` – Kochtermine `mealPrepCookEvents` (`MEAL_PREP_COOK_OFFSETS`), vorgekochte Plätze,
     Haltbarkeit `mealPrepKeeping` (R9 mit den **tatsächlich verwendeten** Zutaten inkl. Ersatz: Minimum aus Rezept,
     `max_fridge_days` der Zutaten und 3 Tagen; einfrierbar nur Rezept **und** alle Zutaten) und `mealPrepDayUse`
     (Kochtag → Kühlschrank → eingefroren → frisch).
   - `meal-prep-plan.ts` – `applyMealPrepPlan` (19.6 B1/K7/G3), `selectFreeMealPrepPlan` (Gratis-Plan = erster
     angebotener in fester Reihenfolge nach ID, sonst keiner), `cookDaySchedule` (Schritte mit Minuten bis zum
     nächsten Schritt für die Timer).
   - `replan.ts` – `needsAutomaticReplan` (6.6: Modus, Deckel, Tagessumme außerhalb des aktuellen Bands, Rezept
     besteht den Filter nicht mehr) und `automaticReplan` (Plan ab heute **und** Einkaufsliste im selben Schritt,
     R2-S4).
   - `shopping-list.ts` – `buildShoppingList`, `rebuildShoppingList`, `addManualShoppingItem`,
     `removeManualShoppingItem`, `setShoppingItemChecked`, `roundShoppingAmount` (6.5).
   - `recipe-search.ts` – `searchRecipes` (19.6): harte Regeln wie `filter.ts`, Ernährungsform erweiterbar und
     gekennzeichnet (K3/G4), weiche Filter Kategorie, Abschnitt, „Unter 10 Minuten“, max. Kosten (nur freigegebene
     Schätzung), Text; Sortierung Titel/ID.
   - `meal-plan-payload.ts` – `mealPlanPayloadSchema` (strikt, Datumsrahmen der Woche, Faktor 0,5–2,0, kein Platz
     doppelt, Kochtag passend) und `toMealPlanPayload`; `inputs` ohne Körperdaten, Flags, Unverträglichkeiten,
     Abneigungen und „ohne Schwein“ (K8).
   - `stable-hash.ts` – FNV-1a (`stableHash`, `stableHashKey`, `stableUnit`), kein `Math.random`.
   - `schemas.ts` + `mealPlanProfileSchema` (Ernährungsform, Schwein, Kochmodus, Kochtage, `mealprep_slots`,
     Vorlieben/Abneigungen/Unverträglichkeiten, Zeitlimit werktags); `notices.ts` + `MEAL_PLAN_NOTICE_CODES`.
2. **Konstanten** (`constants.ts`, Abschnitt „Phase 5 · Essensplan und Einkaufsliste“, alle PRODUKTENTSCHEIDUNG):
   `MEAL_PLAN_ENGINE_VERSION`, `PORTION_SCALE_LIMITS`, `MEAL_PLAN_FILL`, `NO_TARGETS_MIN_DAY_KCAL`,
   `MEAL_PLAN_REPEAT_LIMITS`, `MEAL_PLAN_SCORING`, `MEAL_PREP_COOK_OFFSETS`, `CARDIO_RECIPE_MIN_MINUTES` (nur der Wert
   für X4, K4), `RECIPE_SERVINGS_PICKER`, `SHOPPING_LIST_ROUNDING`. Keine Schutzgrenze ist neu oder verändert.
3. **Schutzgrenzen bleiben an einer Stelle:** Der Essensplan nutzt nur das fertige Planband aus
   `nutritionTargetsForWeek` → `clampCalorieTarget`. **Strukturtest K2 erweitert** (`limits.test.ts`): Die
   Schutzgrenzen-Konstanten und `planBand` kommen außerhalb von `limits.ts`/`eligibility.ts`/`schemas.ts`/`constants.ts`
   nirgends vor (auch nicht in Plan, Meal-Prep, Liste, Suche). `NutritionDayTargets` hat zusätzlich `deficitCap` und
   `surplusCap` – nur zum Abgleich „Deckel geändert“ (6.6).
4. **Tests** (Vitest, 7 neue Testdateien mit 98 Tests nach der Wächter-Prüfung + Strukturtest in `limits.test.ts`): **W2** als Eigenschaftstest über die Ausgabe von
   `buildMealPlanWeek` (160 Wochen: 1–8 Mahlzeiten, 30/45/200/300 kg, alle Ziele, Modi `full`/`maintenance_only`/
   `no_targets`, Flags inkl. kein Check und Schwangerschaft, Einwilligung ja/nein, 0–7 Trainingstage bis 240 min,
   zufällige Profile mit Unverträglichkeiten/Abneigungen/Schwein/Meal-Prep 1–7 Kochtage/Zeitlimit, Pools ohne Snacks/
   ohne Frühstück/nur Hauptgerichte/leer; dazu Meal-Prep 1–7 Kochtage mit festen Resten nach Neuplanung am
   Donnerstag): jeder Tag `complete` im Planband (≥ Untergrenze aus N1) oder `below_floor` mit Hinweis, **nie über der
   Obergrenze**, Faktoren 0,5–2,0, keine Menge 0, Kühlschrank nie länger als R9, Einfrieren nur wenn erlaubt.
   **„Kein ausgeschlossenes Rezept“** unabhängig an den tatsächlich verwendeten Zutaten (Gruppen, Schwein,
   Ernährungsform, Alkohol, Schwangerschaft inkl. ungegart/unbestätigt) – im Plan, in Meal-Prep-Plänen (19.6 DoD:
   Erdnuss + vegane Woche, Schwangerschaft + Fisch nur als Annahme erhitzt, `eats_pork = false/null` + Fleisch,
   Pilze „mag ich nicht“) und in der Suche. **W9 (Core), W10, W11 (Core), W15, W22 (Core), K9**, Gratis-Plan,
   Portionswähler (1/12 Portionen, 5-Portionen-Rezept, Eier ganz), R9/`storage_plan`, G3, Grenzfälle (1 vs. 7
   Trainingstage, 1–8 Mahlzeiten, 300 kg mit 1 Mahlzeit → `below_floor`, 30 kg mit 8 Mahlzeiten, `no_targets`,
   `maintenance_only`, keine passenden Rezepte mit Grund), Determinismus/Varianten, Wiederholungsgrenzen, Tauschen,
   vergangene Tage, Payload ohne Gesundheitsdaten, Einkaufsliste (Aggregation, Aufrunden nie 0, Stück vs. Gramm,
   Vorrat, Abteilungen, Ersatzprodukt, Zeitraum, Häkchen, eigene Einträge). **Gegenprobe:** absichtlich eingebaute
   Fehler (Tag unter dem Band als `complete`, Schwangerschafts-Ausschluss abgeschaltet, Haltbarkeit der Zutaten
   ignoriert) machen die Tests rot.

**Abweichungen / Präzisierungen gegenüber dem Plan:**

- **Sehr schmales Planband:** Liegen Unter- und Obergrenze weniger als 20 kcal auseinander (z. B. sehr niedriger
  Katch-Bedarf bei Muskelaufbau, Breite 0 möglich), reicht das Band bis Untergrenze + 20 kcal – **in `planBand`
  (`limits.ts`, `PLAN_BAND_MIN_WIDTH_KCAL`)**, nicht im Essensplan (Wächter N3 S1). Die Untergrenze bleibt; die
  Obergrenze (Überschussdeckel) wird so höchstens um 20 kcal überschritten, wie bei der gerichteten Rundung (4.6.2).
- **Über der Obergrenze im normalen Plan:** Reicht Faktor 0,5 nicht, fällt eine Mahlzeit weg (zuerst Snacks, dann
  Hauptmahlzeiten, die mit den meisten kcal; Platz leer mit Grund `above_ceiling`, Hinweis `meal_removed_ceiling`).
  Der Plan regelte das nur für Meal-Prep-Pläne (G3: dort wird nichts gestrichen, sondern der Plan nicht angeboten).
- **Wiederholungsgrenzen** sind hart; nur wenn kein Kandidat sie einhält, wird wiederholt (Hinweis
  `recipe_repeated`) – ein leerer Platz wäre schlechter. Snacks höchstens 3× (PRODUKTENTSCHEIDUNG).
- **Eiweiß ≥ 90 %** wird je Tag geprüft (Hinweis `protein_below_target`), je Platz nur über die Punkte bevorzugt.
- **Ersatz-Zutaten** beheben nur Unverträglichkeit/„mag ich nicht“ – nie Ernährungsform, Schwein oder
  Schwangerschaft (vegan + Vollmilch → raus, auch wenn Haferdrink ginge).
- **Kochtermine 4–7** festgelegt (4: So, Di, Do, Sa · 5: So, Di, Mi, Fr, Sa · 6: So, Di–Sa · 7: täglich); ein Kochtermin,
  der schon vorbei ist, ohne gekochte Reste im bisherigen Plan → diese Tage frisch. Bei „Mittag + Abend“ bekommt jeder
  Platz sein eigenes Gericht. Ein Termin bevorzugt Gerichte, die alle seine Tage halten (Kühlschrank oder einfrierbar).
- **„Rezept tauschen“** tauscht genau eine Mahlzeit; das neue Gericht wird an dem Tag frisch gekocht. Angeboten wird
  der beste Kandidat, der den Tag **nicht verschlechtert**: keine andere Mahlzeit fällt weg, nie über der Obergrenze,
  ein vollständiger Tag bleibt vollständig – sonst `no_alternative` (Wächter N3 S3). Besteht eine andere Mahlzeit des
  Tages den Filter nicht mehr (oder fehlt ihre Rezeptversion), wird nicht getauscht, sondern `replan_needed`
  gemeldet (S4). Wird eine Kochtag-Mahlzeit getauscht oder wegen der Obergrenze gestrichen, werden ihre Reste an den
  Folgetagen frisch gekocht (gleiches Rezept, Hinweis `meal_prep_fresh_days`; `repairOrphanLeftovers`, S2).
- **`applyMealPrepPlan`:** Liegt der Sonntag schon zurück, ist der Kochtag heute (Tage davor bleiben); ab Samstag
  wird der Plan für diese Woche nicht mehr angeboten. Snack-Platz = Nachmittags-Snack, sonst der erste Snack; bei
  1 Mahlzeit nimmt das Hauptgericht den Platz `main`. Zwei Plan-Rezepte für denselben Platz → nicht angeboten.
  `storage_plan` und R9 (mit den tatsächlichen Zutaten) werden verglichen, **die sicherere Angabe gewinnt**.
  Gratis-Plan: feste Reihenfolge = nach ID (offener Punkt aus N2c).
- **Automatische Neuplanung** einer Woche mit Meal-Prep-Plan: Tage ab heute werden normal geplant; schon gekochte
  Reste bleiben, wenn sie den Filter weiter bestehen (19.6 Nr. 2).
- **Automatische Neuplanung:** Die Einkaufsliste wird ab `max(Beginn, heute)` neu erzeugt (Wächter N3 B1) – offene
  Einträge aus Käufen vor heute fallen weg, abgehakte bleiben mit „nicht mehr im Plan“. `out_of_band` gilt, sobald
  eine Tagessumme (mit optionalen Zutaten) über der neuen Obergrenze liegt – unabhängig vom Status –, ein
  vollständiger Tag darunter liegt oder ein unvollständiger Tag jetzt erreichbar ist (B2).
- **Optionale Zutaten** (nicht weggelassen) zählen für die Untergrenze nicht (sichere Richtung, N2a), für die
  Obergrenze aber mit (`optionalKcal`, Wächter N3 K3). Liegt ein Tag nur ihretwegen über der Obergrenze, werden sie
  weggelassen (`omitted_optional`, Hinweis `optional_omitted_ceiling`); erst wenn das nicht reicht, fällt eine Mahlzeit
  weg (Nachprüfung NB1).
- **Payload** in eigener Datei `meal-plan-payload.ts` (statt `schemas.ts`, wegen der Abhängigkeit vom Plan-Typ);
  `inputs` zusätzlich ohne Abneigungen und „ohne Schwein“ (Datensparsamkeit, 7.1).
- **Einkaufsliste:** Wird ein Lebensmittel irgendwo in Stück verwendet und ist ein Stückgewicht bekannt, steht es
  ganz in Stück; Milliliter bleiben Milliliter; nur in Prisen verwendet → „nach Geschmack“. Meal-Prep wird zum Kochtag
  gekauft, der Sonntag vor der Woche zählt zur Woche.
- **Namen:** Tag im Essensplan heißt `PlannedMealDay` (`PlannedDay` gibt es schon im Trainingsplan);
  `recipeTotalMinutes` aus `content/import-rules.ts` wird wiederverwendet.
- **Rezeptsuche:** zuerst mit der Profil-Ernährungsform (wie der Essensplan), nur sonst mit der erweiterten; was nur
  über die Erweiterung gefunden wird, ist immer gekennzeichnet.
- **Nicht in N3:** CI-Zusammenfassung „Beispiel-Woche + Einkaufsliste“ (braucht den echten Katalog – kommt, sobald
  `foods-import` und `alpha5-import` gelaufen sind; Plan 13), Texte der Hinweis-Codes (N4/N5), Zutaten-Austausch mit
  Rollen und Tausch-Regeln B2 (N9), „Daumen runter“ für Plan-Rezepte (N10), Carb-Loading auf Erhalt (W1, Phase 10),
  Belegung je Einheit ab 75 Minuten (X4, nur die Konstante).

**Wächter-Prüfung N3 (12.10.2026): FREIGABE MIT AUFLAGEN** (Bericht `waechter-n3.md`; Fuzz-Test mit zufälligen
Katalogen: 0 Verstöße bei Ausschlüssen, Band und Haltbarkeit). Umgesetzt:

- **B1** Einkaufsliste nach automatischer Neuplanung ab heute; Test: Liste für die ganze Woche + Schwangerschaft am
  Donnerstag → kein offener Eintrag mit Schwangerschafts-Risiko.
- **B2** `out_of_band` unabhängig vom Status bei Überschreiten der Obergrenze; Test 120 kg, Muskelaufbau → Fettabbau.
- **S1** Mindestbreite des Bands in `planBand` (`limits.ts`); W2 rechnet das Band unabhängig aus Ziel, Unter- und
  Obergrenze mit eigener Zahl 20 (`independentBand`); N1-Eigenschaftstest angepasst.
- **S2** Keine verwaisten Reste (`repairOrphanLeftovers` nach Plan und Tausch); W2 prüft „jeder Rest mit Kochtag in der
  Woche hat dort eine Kochtag-Mahlzeit desselben Rezepts“; Test Tausch einer Kochtag-Mahlzeit.
- **S3/S4** Tausch ohne Verschlechterung bzw. mit Meldung `replan_needed`; Tests (über der Obergrenze an einem
  `below_floor`-Tag, `complete` → `below_floor`, andere Mahlzeit fällt durch).
- **S5** Tests für feste Reste + Schwangerschaft und Einfrieren mit Ersatzprodukt; Ausschluss-Prüfungen in den Tests
  mit eigenen Regeln (`expectPork`, `expectNeedsHeating`, `usedFoodViolations`), nicht mit `foodContainsPork`/
  `needsHeatedFlag`. Gegenprobe: die drei vorher unentdeckten Mutationen (Reste ohne Schwangerschafts-Filter,
  Einfrieren am Original, Tausch über der Obergrenze) sowie „Tausch ohne Status-Prüfung“, „ohne Reste-Reparatur“ und
  „Liste ab Wochenbeginn“ machen Tests rot.
- **NB1 (Nachprüfung)** Frisch erzeugter Plan verlangte sofort eine Neuplanung (Folge von K3): optionale Zutaten werden
  bei der Obergrenze zuerst weggelassen; `needsAutomaticReplan` prüft mit `dayWithinPlanBand` genau die Garantie von
  `buildMealPlanWeek`, und `variantForMeal` erkennt zusätzlich weggelassene optionale Zutaten als dieselbe Variante.
  Eigenschaftstest „frischer Plan braucht keine Neuplanung“ über das W2-Raster und schmale Bänder (30–45 kg,
  Muskelaufbau, 1–8 Mahlzeiten, 3 Ernährungsformen); Tests „optionale Zutat weglassen rettet die Mahlzeit“ und
  „below_floor mit optionaler Zutat ohne Neuplanungs-Schleife“; gestrichene Mahlzeiten im schmalen Raster nicht mehr
  als ohne Mitzählen optionaler Zutaten. **NK1** (Zeitlimit werktags bei umgewandelten Resten) nur vermerkt.
- **K3** optionale Zutaten für die Obergrenze; **K6** Strukturtest um `PORTION_TOLERANCE` und
  `PLAN_BAND_MIN_WIDTH_KCAL` erweitert (`clampCalorieTarget`/`dayFloorKcal`/`dayCeilingKcal` prüft der erste
  Strukturtest schon).
- **K5 – Hinweis für N7:** `substitutions` und `omitted_optional` im Payload lassen indirekt auf Unverträglichkeiten
  schließen; der Server setzt `uses_health_data = true`, sobald Ersatz oder Weglassen vorkommt (am Schema vermerkt).
- **Nur dokumentiert:** **K1** `applyMealPrepPlan` prüft `slotFitReasons` nicht (Wettkampf-Rezept bzw. Zeitlimit in
  einem Plan würde fest eingeplant) – vor dem automatischen Gratis-Plan mit echten Plänen nachziehen (spätestens N5).
  **K2** `redRecipeIds` bleibt optional; Pflicht ist, den Bestand über `selectNutritionContent` zu laden (am Typ
  vermerkt). **K4** Rundungssprung im schmalen Band führt erst zum Streichen einer Mahlzeit, bevor ein anderer
  Kandidat versucht wird – verbessern mit N5 (Wochenansicht).

**So testest du es am Handy:** Pull Request → **Checks → ci** grün (Lint, Typen, Tests). Die „Beispiel-Woche“ in der
Summary folgt mit dem ersten echten Katalog.

### N4 – App Testmodus: Einrichtung, Tag, Rezept (umgesetzt, 12.10.2026)

Nur Testmodus; Supabase-Modus bis N7 unverändert (`Backend.supportsNutrition = false`). Einzige Migration: die kleine
CHECK-Migration (S8).

1. **Onboarding-Schritt `nutrition_setup`** („Alltag und Training“) nach `cooking`: Alltagsaktivität (4 Antworten mit
   Beispielen, **Pflicht**, Wächter N1 K7), Trainingszeit (inkl. „unterschiedlich“, Pflicht), Meal-Prep-Plätze (nur bei
   Meal-Prep), Hinweis Essstörungen mit Hilfe-Stellen, Schalter „Kalorienzahlen anzeigen“ (Standard an). Core:
   `ONBOARDING_STEPS` + `OnboardingState.nutritionSetupAvailable` (nur `true` = anwendbar, R2-S3), Zod
   `nutritionSetupStepSchema`/`nutritionSetupColumnsSchema` (Spaltennamen wie die N7-Spalten von `nutrition_prefs`).
   Migration `20261012120000_onboarding_nutrition_setup.sql` (CHECK-Liste ersetzt), `db-sync.test.ts` prüft die
   **letzte** Fassung der CHECK-Liste (W16), pgTAP 03 um `nutrition_setup` ergänzt. Bestehende Testerinnen: Karte auf
   „Heute“ bzw. Ernährung fragt den Schritt einmalig ab („Ernährung einrichten“). „Ernährung ändern“ läuft
   nutrition → cooking → nutrition_setup → Ernährung. Hinweis „mag ich nicht“ ohne Einwilligung im Schritt `nutrition`.
2. **App** (`apps/mobile`): `data/nutrition-plan.ts` (Zeilen → `nutritionTargetsForWeek`/`buildMealPlanWeek`,
   Unverträglichkeiten/Körperdaten/Flags nur mit Einwilligung; **K3:** Messdatum „morgen“ zählt als heute;
   `recipeForPerson`: jedes Rezept nur über `filterRecipe` der Person, sonst „passt nicht zu deinen Angaben“ ohne Grund),
   Karte „Essen heute“ (Tagesziel, nächste Mahlzeit mit Rolle, Kochtag, `below_floor`), `app/ernaehrung/index.tsx`
   (Ziel + Makro-Balken, Mahlzeiten mit Portion/Rolle/Ergänzung/Ersatz/Weglassen, leere Plätze mit Grund, Hinweise und
   Schutzgrenzen in einfachen Worten, Knöpfe Einwilligung/Gesundheits-Check/Gewicht, Blättern Mo–So),
   `app/rezept/[id].tsx` („KI-Entwurf – fachlich prüfen“, Allergen-Warnung bei Entwürfen (K6), Portion aus dem Plan
   bzw. Portionswähler 1–12, Zutaten, Schritte, Nährwerte je Portion, „Enthält: …“ inkl. Kokos (K11), Spuren-Hinweis,
   HFI/Zöliakie, Meal-Prep-Haltbarkeit, Nährwert-Quelle mit Lizenz), Einstellungen „Ernährung“ (Ändern, Alltag/
   Trainingszeit, „Kalorienzahlen anzeigen“, Hilfe-Hinweis), „Fertig“-Zusammenfassung „Trainingstag ca. … kcal,
   Ruhetag ca. … kcal“ (ohne Zahlen bzw. ohne Ziel eigener Text). Texte in `i18n/de-nutrition.ts` (alle Hinweis-Codes
   aus N1/N3). Bei „Kalorienzahlen aus“ nirgends kcal/Makro-Gramm (auch Rezept, „Heute“).
3. **Core-Ergänzungen** (mit Tests `nutrition/n4-app.test.ts`): `revocation.ts`
   (`intoleranceGroupsForConversion`, `tastePreferencesAfterConversion`), `day-view.ts` (`mealsInDayOrder`,
   `nextMealOfDay` mit `NEXT_MEAL_GRACE_MINUTES = 60` (PRODUKTENTSCHEIDUNG), `cookDayMeals`, `weekEnergySummary` ohne
   neues Runden, `recipeContains`/`COCONUT_RULE`), eigener Paket-Einstieg `@fitnessapp/core/demo-nutrition`.
4. **Widerruf 7.4:** Dialog nennt Unverträglichkeiten, Essenspläne/Einkaufslisten und eigene Listeneinträge (K10); aktive
   Wahl „stattdessen unter ‚mag ich nicht‘ ausschließen?“ (nicht vorausgewählt, nur bei vorhandenen Unverträglichkeiten).
   Testmodus: Einlesen nur bei Zustimmung, Umwandlung atomar in `applyHealthDataRevocation(…, { dislikeGroups })`
   (ein Speichern). Supabase-Modus (schon jetzt): Gruppen nur bei Zustimmung aus dem Arbeitsspeicher, nach
   `revoke_health_data` als `replace_food_preferences` (Geschmack) über die bestehende Warteschlange – bricht die
   Verbindung ab, bleibt die Umwandlung als wartender Vorgang gespeichert, die Anzeige (Stand + Warteschlange) enthält
   die Ausschlüsse sofort. Ohne Zustimmung wird nichts eingelesen (R2-K4).
5. **Export/Gerätespeicher:** Antworten von `nutrition_setup` im Export als Spalten von `nutrition_prefs` (Form wie
   `export_my_data()` ab N7); Gerätespeicher älterer Versionen: ungültiger/fremder Eintrag → null (Zod).
6. **Tests:** Core (W21 in `onboarding.test.ts`, W16 in `db-sync.test.ts`, N4-Tests), App-Vitest
   (`nutrition-n4.test.ts`: W21 Backend, K7, W12 atomar, R2-K4, Export, Gerätespeicher, K3, Filter; Supabase-Backend:
   Umwandlung über die Warteschlange erst nach `revoke_health_data`, ohne Zustimmung keine; `nutrition-format.test.ts`),
   Playwright `e2e/nutrition.spec.ts` (Onboarding → Ziel → Rezept → Zahlen aus; Widerruf mit Angebot (W12); Widerruf
   ohne Zustimmung → keine Spur in local-/sessionStorage (R2-K4); kein Check → Hinweis + Knopf; Schwangerschaft ohne
   Zahlen; Einrichtung fehlt, keine Rezepte, Beispiel-Rezepte ein/aus, Blättern, Rezept passt nicht), bestehende
   E2E-Tests um den neuen Schritt ergänzt, Screenshots hell/dunkel (`screenshots.spec.ts`, Ernährung, Rezept,
   Einstellungen).

**Abweichungen / Präzisierungen:**

- **Beispiel-Rezepte mit Testwerten:** Der echte Katalog fehlt noch (`foods-import`/`alpha5-import`). Damit Testmodus
  und E2E-Tests Rezepte haben, bietet die App bei leerem Bündel **auf aktive Wahl** die N2a/N3-Fixtures an
  (`@fitnessapp/core/demo-nutrition`, eigener Lazy-Chunk, dieselben Regeln `validateContent`/`selectNutritionContent`,
  deutlich „TESTWERTE – keine echten Nährwerte“). Sobald das Bündel Rezepte hat, haben diese immer Vorrang.
- **Essensplan wird in N4 nicht gespeichert**, sondern bei jedem Öffnen deterministisch neu berechnet – passt damit
  immer zum aktuellen Modus (6.6) und es gibt keine gespeicherten Pläne mit Gesundheitsbezug. Speichern (`mealPlans`
  in `UserRows`), „Rezept tauschen“, „Andere Vorschläge“, „Essensplan neu erstellen“, vergangene Tage fest und
  Einkaufsliste kommen mit **N5**; dort auch `pendingRevocationConversion` falls nötig (im Testmodus atomar, im
  Supabase-Modus übernimmt die Warteschlange die Rolle).
- **Rezeptsuche (`rezepte/index.tsx`) und Ratgeber (`ratgeber/[id].tsx`)** aus 19.6 sind nicht in N4 → N5. Der
  Portionswähler ist in der Rezeptansicht (ohne Ziel-Bezug).
- **Hilfe-Stellen Essstörungen** ohne Telefonnummern (nur Namen), Code-Vermerk „VOR VERÖFFENTLICHUNG PRÜFEN“.
- Hinweis `carbs_below_reference` (nennt 130 g) entfällt bei „Kalorienzahlen aus“; Sicherheitshinweise bleiben.
- „Kalorienzahlen anzeigen“ in den Einstellungen speichert über den Schritt `nutrition_setup`; nach abgeschlossenem
  Onboarding bleibt der Fortschritt unverändert (Wächter N4 K5).
- Bestätigungs-Dialog ist jetzt scrollbar (langer Widerrufs-Dialog auf kleinen Handys).

**Wächter-Prüfung N4 (12.10.2026): MIT AUFLAGEN** (Bericht `waechter-n4.md`). Umgesetzt:

- **B1** Veraltete (bzw. fehlende) Einwilligung + gespeicherte Unverträglichkeiten → kein Essensplan, keine Ziele,
  keine Rezeptansicht (auch per Deep-Link), auf „Heute“ ebenso – nur der Hinweis „Einwilligung bestätigen“ mit Knopf.
  Regel in core (`nutrition/person.ts`, `intoleranceAccess`), Tests in core, App (`nutrition-n4.test.ts`) und Playwright
  (Deep-Link `/rezept/erdnuss-banane`).
- **S1** Supabase-Widerruf mit Umwandlung: zuerst Warteschlange, dann Zwischenspeicher; `health_data` im Zwischenspeicher
  als widerrufen markiert; Test „offline nach dem Widerruf“ (Vorgang wartet, Anzeige mit Ausschluss, danach gesendet).
- **S2** Tests `recipeForPerson`: Unverträglichkeit, „mag ich nicht“, Schwein (`eats_pork` null/true), Schwangerschaft
  per Deep-Link, B1.
- **S3/K9** „Zahlen aus“: Hinweise mit Gramm- oder BMI-Angaben (`long_session_fueling`, `underweight`,
  `severe_underweight`) erscheinen in einer Fassung ohne Zahlen (`noticesWithoutNumbers`, `noticeText`),
  `carbs_below_reference` entfällt; systematischer Test über alle Hinweis-Codes (kein „… kcal“, „… g“, „BMI“).
- **S4** Fachregeln nach core: `measuredOnForEngine` (K3), `intoleranceAccess` (Einwilligung, B1),
  `weekExcludesPregnancyCaution`, `weekHidesEnergyNumbers`; die App bildet nur noch ab.
- **S5** Hilfe-Stellen: harte Freigabe-Bedingung vor Supabase-/Store-Builds in KONZEPT 14 und `docs/SETUP.md` Teil K
  (Checkliste, CH inkl. 144).
- **K1** Schwangerschaft: auch im Rezept per Deep-Link keine kcal. **K2** Karte „Essen heute“ kennzeichnet Testwerte.
  **K3** Widerruf verwirft ungültige Alt-Einträge statt zu scheitern (Test). **K5** Ändern nach dem Onboarding setzt
  `onboarding_completed_at` nicht mehr neu (Schritt `nutrition_setup`; Test). **K7** E2E-Tests erzwingen die
  Beispiel-Rezepte über den Gerätespeicher-Wert `"force"` (nur Testmodus, nur Tests) – unabhängig vom Stand des Bündels.
  **K8** Text „…der Essensplan lässt sie dann genauso weg“. **K10** HANDY-ANLEITUNG Teil 7c „Ernährung testen“.
- **Nachprüfung N4 (bestanden), NK1/NK2:** Der Sperr-Hinweis unterscheidet den Grund (`IntoleranceBlockReason`):
  veraltet → „Neue Fassung bestätigen“; widerrufen bzw. nie erteilt → „Einwilligung erteilen“ **oder** „Gespeicherte
  Unverträglichkeiten löschen“ (Recht auf Löschung, mit Bestätigungsdialog; geht ohne Einwilligung –
  `Backend.deleteStoredIntolerances`: Testmodus im Gerätespeicher, Supabase sofort per `delete` nach der
  Lösch-Policy von `food_preferences`, nie über die Warteschlange, offline Fehler). Tests in core, App und Playwright.
- **K4 (dokumentiert):** „Ernährung ändern“ führt jetzt auch im Supabase-Modus von `nutrition` weiter zu
  `cooking?edit=1` (vorher zurück zu „Heute“); ohne Speicherort endet die Kette nach `cooking` auf „Heute“.
- **K6 (dokumentiert):** Der Lazy-Chunk `demo-nutrition` steht auch im Supabase-Build, wird dort aber nie geladen
  (`loadNutritionLibrary` liefert `null`). Ausschließen per Build-Variable bei Bedarf in N7.

**So testest du es am Handy:** Vorschau-Link → „Ohne Konto testen“ → Onboarding (Abschnitt 15, Schritt 1) → neuer
Schritt „Alltag und Training“ → „Fertig“ zeigt „Trainingstag ca. … kcal“ → „Heute“ → Karte „Essen heute“ →
„Ernährung“ → „Beispiel-Rezepte mit Testwerten verwenden“ → Rezept antippen → Einstellungen → „Kalorienzahlen
anzeigen“ aus → keine kcal mehr → Einwilligung widerrufen mit Häkchen „mag ich nicht“.

### N2d – Admin-Seiten und Sammelfreigabe (umgesetzt, 13./14.10.2026, ohne Commit; Gründer-Entscheidungen unten)

Umgesetzt nach 13 (N2d) und 19.5 (Prompt B Schritt 5):

- **Core `packages/core/src/content/recipe-release.ts`** (Tests `recipe-release.test.ts`): `planRecipeRelease`,
  `releasedRecipe`, `recipeReleaseBlockers`, `recipesInCategory`, `recipeReleaseBlockerText` – eine Stelle für die
  Regeln der Sammelfreigabe, genutzt vom Workflow und von der Admin-Vorschau. Freigegeben wird nur ein **Entwurf**
  der Kategorie, der im Stand **nach** der Freigabe (alle Regeln für freigegebene Inhalte, `validateContent`) keinen
  roten Befund hat, nur **katalog-geprüfte und freigegebene** Lebensmittel nutzt (R19: freigegebenes Rezept nur mit
  freigegebenen Lebensmitteln) und keine **unbestätigte Import-Annahme** hat. Häkchen „Import-Annahmen geprüft“ setzt
  `meta.import_assumptions_confirmed_by` = Prüfer und berechnet `declared_pregnancy_caution` neu (Folge aus Wächter
  N2c B1; ohne Neuberechnung wäre R13 rot – Test). Häkchen „fachlich geprüft“ setzt `expert_reviewed = true`, ein
  vorhandenes `true` bleibt. Version bleibt (nur Status/Meta; `declared_pregnancy_caution` ändert sich nur an
  Entwürfen, R15 greift erst bei freigegebenen Inhalten).
- **Workflow `content-review`**: neue Eingaben `art` (`ids` | `recipe`), `kategorie` (Auswahl = `RECIPE_CATEGORY_IDS`,
  Test gleicht die Liste ab), `fachlich_geprueft`, `annahmen_geprueft`; `ids` ist nicht mehr Pflicht (nur bei Art
  `ids`). Skript `packages/content/src/pipeline/review-recipes.ts` (Tests `review-recipes.test.ts` mit Test-Repository):
  prüft wie bisher alle Inhalte, Prettier, Typen; Pull Request mit Tabelle „Freigegeben“ (Annahmen, Schwangerschafts-
  Hinweis vorher → nachher) und „Übersprungen“ mit Grund; nichts freigebbar → kein Pull Request, Gründe in der Summary.
  Art `recipe` nur mit Status `published`. **Merge durch einen Menschen**; Hinweis „Livegang nur mit fachlich geprüft“
  im PR-Text (Durchsetzung ab N7, Gründer-Entscheidung 6).
- **Redaktionsbereich** (nur ansehen, serverseitige Zugangsprüfung in jeder Seite + `proxy.ts`): Bereichs-Navigation
  Training/Rezepte/Lebensmittel/Meal-Prep/Ratgeber; `admin/rezepte` gruppiert nach Kategorie (+ „Ohne Kategorie“) mit
  Entwürfe/freigegeben, rote Befunde, Zutaten ohne Katalog-Prüfung, offene Annahmen „durchgegart“, Abweichungen aus dem
  Import-Bericht und „bereit zur Sammelfreigabe“ (ohne/mit Häkchen); Kategorie-Ansicht mit Grund je Rezept und
  Klick-Schritten; `admin/rezepte/[id]`; `admin/lebensmittel` (Checkliste R19 aus 5.1.1 d, Filter „Prüfung offen“) und
  `admin/lebensmittel/[id]` (Angaben je Checklisten-Punkt, Erwartungsliste, Nährwerte, Verwendung); `admin/meal-prep`
  und `admin/ratgeber`. Leer-/Fehlerzustände: „Noch kein Lebensmittel-Katalog“, Fehler in Begleitdaten (dann ohne
  Katalog prüfen, sichere Richtung), kaputte Dateien, ungültige Adresszeile (Zod). Daten: `apps/web/src/lib/admin/
nutrition.ts` (Tests `nutrition.test.ts`), Katalog-Texte über `@fitnessapp/content/catalog` wie die App.
- **Abweichungen aus dem Import-Bericht** im Admin: neue reine Funktion `recipeImportDeviations`
  (`@fitnessapp/content/import-report`, `packages/content/src/import/deviations.ts`) – dieselbe Regel
  `alpha5Deviations` wie `alpha5-import` (deklariert = Gründer-Datei ↔ berechnet). `apps/web` hängt dafür neu von
  `@fitnessapp/content` ab (`transpilePackages`).
- E2E `apps/web/e2e/admin.spec.ts`: neue Seiten ohne Anmeldung → Login; angemeldet Leerzustände, Checkliste,
  Klick-Schritte, kein schreibendes Formular. **Mit Daten** (Wächter N2d S4): Render-Test
  `apps/web/src/app/admin/nutrition-pages.test.tsx` rendert alle Ernährungs-Seiten (Übersicht, Kategorie, „ohne
  Kategorie“, jede Rezept- und Lebensmittel-Seite, Meal-Prep, Ratgeber) mit den Beispiel-Inhalten
  (`@fitnessapp/core/demo-nutrition` + Testplan + Test-Ratgeber, Zugang gemockt) in `vitest` (läuft in ci).

**Abweichungen / Präzisierungen:**

- Rote Befunde R19 (Lebensmittel) und R1 „unbestätigte Annahmen“ erscheinen in den Gründen nicht doppelt, sondern als
  eigene Gründe („Lebensmittel nicht katalog-geprüft/freigegeben“, „Annahme nicht bestätigt“).
- „Rezept-Prüfbericht“-Abweichungen werden im Admin aus `declared_per_serving` neu berechnet, nicht aus dem PR-Text des
  Imports gelesen (gleiche Regel; nach Handänderung an `declared_per_serving` zeigt der Admin den neuen Stand).

**Abhängigkeit (nicht N2d):** Solange es keine **freigegebenen, katalog-geprüften Lebensmittel** gibt, überspringt die
Sammelfreigabe jedes Rezept. Dafür fehlen aus N2b Teil 2 die Option **„Katalog geprüft“** in `content-review` (R2-K6,
Commits über die GitHub-API wegen `sources-integrity`) und ein Weg, Lebensmittel freizugeben.

**Gründer-Entscheidungen 13./14.10.2026 zu den drei offenen Fragen (umgesetzt):**

1. **Rezepte ohne Kategorie** (nach Import 41 von 242) → **einzeln per ID freigeben** (Variante b): `content-review`
   Art `ids` kennt jetzt auch Rezepte, über **dieselbe Core-Funktion** `planRecipeRelease` mit der ID-Liste als
   Auswahl – gleiche Gründe, gleiche Häkchen („fachlich geprüft“, „Import-Annahmen geprüft“), kein Weg an den Regeln
   vorbei. Admin: Rezepte ohne Kategorie zeigen „Freigabe per ID“ und „über die Sammelfreigabe nicht erreichbar“
   (Wächter N2d S3), die Gruppe zählt „bereit zur Freigabe per ID“.
2. **Fingerabdruck** (Wächter N2c K1 / N2d S2, Variante a): Beim Bestätigen speichert der Core
   `meta.import_assumptions_fingerprint` = `importAssumptionsFingerprint(rezept)` – kanonisches JSON
   (`canonicalJson`, jetzt `content/canonical-json.ts`) über `IMPORT_ASSUMPTIONS_FINGERPRINT_FIELDS`, also `ingredients`
   (vollständig, inkl. `heated`, Mengen, `food_id`, Notizen), `steps_de`, `no_cook` und – nach Wächter N2d Runde 2,
   S5 – `tip_de`, `prep_minutes`, `cook_minutes`, `total_minutes`, `equipment_de`, `title_de` und `description_de`
   (alles, was beschreibt, wie zubereitet und gegessen wird; nicht: Status, Version, `meta`, Kategorien,
   Schlagworte, Abschnitt, Portionen, Meal-Prep-Angaben, deklarierte Werte, Kosten); zweimal FNV-1a (`stableHash`) → 16 Hex-Zeichen (Zod:
   `importAssumptionsFingerprintSchema`). `hasUnconfirmedImportAssumptions(rezept)` (neu: nimmt das Rezept, nicht nur
   `meta`) und `importAssumptionsState` (`none`/`open`/`changed`/`confirmed`) werten Bestätigung **ohne** oder mit
   **abweichendem** Fingerabdruck als unbestätigt → sichere Richtung überall (App-Filter, Essensplan, CI, Admin, Seed):
   R13 verlangt den Schwangerschafts-Hinweis, R1 ist rot bei `published` (eigene Meldung „seitdem geändert“), die
   Freigabe überspringt das Rezept bis zur erneuten Bestätigung. Kein Kryptoschutz – gegen bewusstes Fälschen schützt
   der menschliche Merge. Tests: Bearbeiten nach Bestätigung (Schema, Nährwerte, Filter, Freigabe, Admin).
3. **Meal-Prep-Pläne und Ratgeber** (keine Präferenz → Wächter-Empfehlung): Art `ids` generisch für
   Ernährungs-Inhalte, Core `planNutritionRelease(files, catalog, ids, options)` mit Regel je Art – Rezepte wie oben;
   **Meal-Prep-Plan** nur, wenn alle `recipe_ids` nach dem Lauf freigegeben sind (vorher oder im selben Lauf ohne
   Grund dagegen; zweiter Prüfdurchgang, in dem nur tatsächlich freigegebene Rezepte zählen) und kein roter Befund
   bleibt (R20 inkl. Aufbewahrung nach R9); **Ratgeber** nur ohne roten Befund (R21, Textregeln inkl. Health-Claims).
   Gelbe Hinweise (z. B. R20H „Haltbarkeit fachlich prüfen“) blockieren nicht, stehen aber im Prüfbericht des PR.
   „Livegang nur mit fachlich geprüft“ steht als Hinweis im PR (Durchsetzung ab N7). **Lebensmittel ausdrücklich
   nicht** über diesen Weg (Abbruch mit Hinweis auf die Katalog-Prüfung). Nur Zielstatus `published`; Zurückziehen
   von Ernährungs-Inhalten per ID ist (wie vor N2d) nicht vorgesehen.

**Weitere Wächter-Befunde N2d (umgesetzt):**

- **S1:** Tests „bestätigte Annahme + weiterer Grund → `declared_pregnancy_caution` bleibt true“ (Lebensmittel mit
  `pregnancy_caution`, zweite tierische Zutat `heated: false`) und Pipeline-Test mit `confirmAssumptions: 'true'`
  (Datei mit Bestätigung + Fingerabdruck, PR-Tabelle „ja → **nein**“).
- **S2:** durch Entscheidung 2 erledigt – das Häkchen „Import-Annahmen geprüft“ ist ab jetzt sicher nutzbar.
- **S3, S4:** siehe oben (Vorschau „ohne Kategorie“, Render-Test mit Daten).
- **K2:** `planRecipeRelease` nimmt ein vorhandenes `validateContent`-Ergebnis an; der Admin prüft den Bestand 3× statt
  5×.
- **K3:** Kommentar in `nutrition.ts` (Vorschau gibt probehalber alle Entwürfe zugleich frei; bei künftigen
  rezeptübergreifenden Regeln je Kategorie rechnen).
- **K4:** Eingaben ohne Wirkung stehen als Hinweis in der Summary (Kategorie bei Art `ids`, IDs bei Art `recipe`,
  Häkchen bei Übungen/Vorlagen); gemischte Läufe Training + Ernährung werden abgelehnt
  (`packages/content/src/pipeline/review-ids.ts`).
- **K5:** PR-Text listet je Rezept die bestätigten Annahmen (Zutat, `food_id`, Begründung).

**Wächter N2d Runde 2 (umgesetzt):**

- **S5:** Fingerabdruck um Tipp, Zeiten, Geräte, Titel und Beschreibung erweitert (siehe Entscheidung 2); geprüft
  wurden alle Felder des Rezept-Schemas. Teil-Objekte ohne diese Felder ergeben einen anderen Fingerabdruck
  (sichere Richtung). Tests in `n2c-content.test.ts` (jede Feldänderung, „nur Tipp geändert → changed“).
- **S6:** Der PR-Text listet die gelben Befunde je freigegebenem Inhalt (aus dem Prüfbericht nach dem Schreiben).
  Ratgeber mit gelbem **R21H** (Dosierungen, Mengen je kg) werden nur mit Häkchen „fachlich geprüft“ freigegeben
  (Grund `needs_expert_review`).
- **K7:** `content-review` wechselt vor dem Klassifizieren der IDs auf `main`; klare Meldungen für „auf main nicht
  gefunden“ (mit Liste und Hinweis) und gemischte Läufe (welche IDs Training, welche Ernährung).
- **K10:** Das Orakel `usedFoodViolations` rechnet wieder unabhängig (nur offene Annahmen; bestätigte → Abbruch).
- **K11:** Klick-Weg in SETUP 3b „freigegebenes Rezept ändern“.
- **K12:** Formatierung oben repariert.
- **K9:** in die Aufgabenliste von N7 übernommen.
- **K8 – nur dokumentiert, nicht umgesetzt:** Eine CI-Sperre „`import_assumptions_confirmed_by`/`_fingerprint` nur auf
  Branches `content-review/*` von `github-actions[bot]`“ soll dem Muster R2-K6 folgen. Dieses Muster ist **noch nicht
  gebaut** (die CI-Prüfung für `catalog_reviewed_*` kommt erst mit „Katalog geprüft“, N2b Teil 2). Beide Sperren
  zusammen dort umsetzen; bis dahin schützt der menschliche Merge (PR zeigt die Änderung an `meta`).

**Noch offen (bewusst nicht in N2d):**

- **K1 (Wächter N2d):** Die Abweichungsregel (`alpha5Deviations`, Lesarten, Mindestabstände) liegt in
  `packages/content/src/foods/import-source.ts` und wird vom Admin genutzt – laut CLAUDE.md gehört Fachlogik nach
  `packages/core`. Beim nächsten Anfassen verschieben (vorbestehend aus N2b).
- **K6 (Wächter N2d):** Die Checkliste R19 steht als Text-Konstante in `CatalogChecklist.tsx`; mit der Option
  „Katalog geprüft“ (N2b Teil 2) nach core verschieben (eine Quelle für Admin und Workflow).

**So testest du es am Handy:** Vorschau-Link der Website → `/admin` → anmelden → **Rezepte** (heute „Noch keine
Rezepte“ und Hinweis auf den fehlenden Katalog), **Lebensmittel** (Checkliste), **Meal-Prep**, **Ratgeber**. Nach
`foods-import` und `alpha5-import`: Kategorie antippen → je Rezept „wird freigegeben“ bzw. Grund; „Ohne Kategorie“ →
„Freigabe per ID“. Freigeben: **Actions → content-review → Run workflow** → Art `recipe` mit Kategorie **oder** Art `ids`
mit IDs (Rezepte, Meal-Prep-Pläne, Ratgeber), Prüfer → PR prüfen und mergen (docs/SETUP.md 3b).

### N5a – App Testmodus: Woche, Tauschen, automatische Neuplanung (umgesetzt, 14.10.2026, ohne Commit)

**Teilung von N5:** Der Umfang (Woche, Tauschen, Neuplanung, Einkaufsliste offline, eigene Einträge, Meal-Prep-Kochtag mit
Timern, „Zur Einkaufsliste“ aus Rezept und Meal-Prep-Plan, dazu die aus N4 verschobene Rezeptsuche und der Ratgeber) ist
für einen Pull Request zu groß. **N5a** (dieser Stand): gespeicherter Plan, Wochenansicht, „Andere Vorschläge“, „Rezept
tauschen“, „Plan aktualisieren“, automatische Neuplanung (6.6, W11 App). **N5b** (nächster PR): Einkaufsliste mit
Abhaken offline, eigene Einträge, Zeitraum, Neuerzeugung bei Neuplanung (W22 App), Meal-Prep-Kochtag mit Timern und
Auftau-Hinweisen, „Zur Einkaufsliste“ (Rezept, Meal-Prep-Plan), Playwright „Häkchen nach Neu laden“/`setOffline`/
Meal-Prep-Woche/„Zahlen aus“ im Meal-Prep. Rezeptsuche (`rezepte/index.tsx`) und Ratgeber (`ratgeber/[id].tsx`) aus
19.6 kommen als eigener PR **N5c** nach N5b (Auflagen unten).

1. **Core** (`packages/core/src/nutrition/meal-plan-store.ts`, Tests `meal-plan-store.test.ts`, 15 Tests):
   - `storedMealPlanWeekSchema`/`parseStoredMealPlanWeek` – Gerätespeicher ist nicht vertrauenswürdig: nur ein
     vollständiger Plan der aktuellen Engine-Version (Zod strikt, 7 Tage in Reihenfolge), sonst „kein Plan“ (wird neu
     erstellt; sichere Richtung, der neue Plan nutzt die aktuellen Angaben).
   - `resolveMealPlanWeek(stored, input)` – beim Öffnen von „Heute“/„Ernährung“ (6.6): kein Plan → `created`;
     `needsAutomaticReplan` → `replanned` über `automaticReplan` (ab heute, vergangene Tage und gekochte Reste fest);
     sonst `stored` mit `updateSuggested`. **Angezeigt wird immer das Ergebnis** – ein gespeicherter Plan, der den
     aktuellen Angaben widerspricht (Schwangerschaft, neue Unverträglichkeit), erscheint nie, auch nicht bis zum
     Speichern.
   - `mealPlanUpdateSuggested` – „Plan aktualisieren“ (8.2 Nr. 3): Mitte des Planbands eines Tages ab heute um
     ≥ `MEAL_PLAN_UPDATE_MIN_CHANGE` (5 %, neue Konstante in `constants.ts`) geändert; Tage ohne Band zählen nicht.
   - `mealPlanWithOtherSuggestions` (Variante + 1, nach 10 000 wieder 0), `refreshedMealPlan` (gleiche Variante),
     `mealPlanWeekEditable` (laufende + nächste Woche, Datumsrahmen von `save_meal_plan`), `nextMealPlanVariant`.
   - Tests: Rundweg JSON (1/4/8 Mahlzeiten, `no_targets`), ungültige Stände, Datumsrahmen inkl. Sonntag, W11 (Schwangerschaft
     am Donnerstag: Mo–Mi gleich, ab Do `no_targets` ohne `pregnancy_caution`, danach keine Schleife), vegan + neue
     Erdnuss-Unverträglichkeit, ganze Woche vergangen, Eigenschaft „Knopf genau bei ≥ 5 %“ über 60–100 kg (unabhängig
     gerechnet), Andere Vorschläge über mehrere Varianten, höchste Variante, Plan aktualisieren.
   - Export: `PENDING_DB_EXPORT_TABLES` um `meal_plans`, `meal_plan_items` ergänzt (in `export_my_data` mit N7).
2. **App** (`apps/mobile`):
   - `UserRows.mealPlans` (`MealPlanRow`: Woche, `uses_health_data`, `auto_adjusted`, Plan-Schnappschuss), höchstens
     ein Plan je Woche; Gerätespeicher älterer Versionen über `upgradeStoredRows` (nur gültige Pläne des eigenen Kontos,
     `uses_health_data` aus dem Plan). Supabase-Modus: immer leer, `saveMealPlan` nicht unterstützt (N7).
   - `Backend.saveMealPlan` – Testmodus mit den Regeln von `save_meal_plan` (`data/meal-plan-rows.ts`): Schema,
     Datumsrahmen, **ohne gültige Einwilligung kein Plan mit Gesundheitsbezug und kein Faktor ≠ 1 (S9)**; Fehler ohne
     Werte.
   - `computeNutritionWeek` löst den gespeicherten Plan mit `resolveMealPlanWeek` auf; `useNutritionWeek` speichert
     einen neu erstellten bzw. automatisch neu geplanten Plan der laufenden/nächsten Woche (`persistMealPlan`, je Woche
     und Angaben-Fingerabdruck höchstens einmal – keine Schleife, kein Doppel aus „Heute“ und „Ernährung“; Fingerabdruck
     nur im Arbeitsspeicher). Speichern gescheitert → Hinweis, angezeigt wird trotzdem der richtige Plan.
   - **Tag** (`ernaehrung/index.tsx`): „Rezept tauschen“ je Hauptmahlzeit ab heute (nie Ergänzungs-Snacks, nie
     vergangene Tage; Meldungen je Grund von `swapMealRecipe`), Hinweis „Dein Plan wurde an deine neuen Angaben
     angepasst.“ bis „Verstanden“, „Plan aktualisieren“, Knopf „Wochenansicht“.
   - **Woche** (`ernaehrung/woche.tsx`, neu): „Diese Woche“/„Nächste Woche“, Mo–So mit Status, Mahlzeiten (Portion,
     Ergänzung), Tagessumme nur mit Zahlen und bei vollständigem Tag, „Andere Vorschläge“ mit Nachfrage, Tag öffnen,
     Rezept öffnen; Lade-/Fehler-/Leer-/Sperr-Zustände wie die Tagesansicht.
   - **Widerruf** löscht Essenspläne mit Gesundheitsbezug (wie `consents_after_revoke()` ab N7); **„Gespeicherte
     Unverträglichkeiten löschen“** löscht sie ebenfalls (Ersatz, Weglassen und leere Plätze lassen auf
     Unverträglichkeiten schließen, Wächter N3 K5 – sichere Richtung). Export: `meal_plans`/`meal_plan_items` mit den
     Spalten aus 7.2.
   - **Zahlen:** Hat die Woche einen Tag in Schwangerschaft/Stillzeit, zeigt die Ernährung nirgends kcal – auch nicht
     an vergangenen Tagen eines gespeicherten Plans (`weekHidesEnergyNumbers` jetzt im Hook für Tag, Woche, „Heute“).
3. **Tests:** App-Vitest `nutrition-n5.test.ts` (Speicher-Regeln, ein Plan je Woche, Gerätespeicher, Widerruf,
   Löschen der Unverträglichkeiten, Export, Ablauf neu → gespeichert → schwanger am Mittwoch → angepasst, Tauschen und
   Andere Vorschläge gespeichert, vergangene Woche abgelehnt). Playwright `e2e/nutrition-week.spec.ts` (Plan
   gespeichert, Wochenansicht, Andere Vorschläge nach Neuladen, nächste Woche, Zahlen aus → keine kcal in der Woche;
   Tauschen mit `setOffline` und nach Neuladen; **W11 App**: schwanger am Mittwoch → Mo/Di unverändert, ab Mi ohne
   Zahlen und ohne `pregnancy_caution`, Hinweis bis „Verstanden“; **vegan + Erdnuss-Unverträglichkeit** → automatisch
   ohne Erdnuss-Rezepte; Plan aktualisieren nach +10 kg). Nach der Wächter-Prüfung zusätzlich S1–S4-Tests (siehe unten). Gemeinsame Schritte in `e2e/nutrition-helpers.ts` (N4-Spec
   nutzt sie mit).

**Abweichungen / Präzisierungen:**

- **Gespeichert wird der ganze Plan** (Schnappschuss `MealPlanWeek`) statt Zeilen `meal_plans`/`meal_plan_items` – im
  Testmodus nötig, weil `safetyKey`, Planband und Hinweise für 6.6 gebraucht werden. Die N7-Form entsteht im Export und
  über `toMealPlanPayload`. Nur der aktive Plan je Woche, keine „ersetzten“.
- **Erneute Filter-Prüfung gegen die Rezept-Spalten** (7.3) kommt mit der Datenbank; im Testmodus erzeugt dieselbe
  Engine den Plan auf dem Gerät, und `resolveMealPlanWeek` prüft beim Öffnen ohnehin jedes Rezept erneut.
- **Export** (Wächter S4): zusätzlich der ganze Schnappschuss (`plan_snapshot`) und `auto_adjusted`.
- **Ältere Engine-Version** im Gerätespeicher gilt als ungültig → neuer Plan (die vergangenen Tage dieser Woche werden
  dann neu berechnet). Heute ohne Folgen (`MEAL_PLAN_ENGINE_VERSION = 1`).
- **„Plan aktualisieren“** vergleicht die Bandmitte (das gespeicherte Planband ist Teil des Plans; Ziele selbst werden
  nicht gespeichert, 7.1). Liegt die Tagessumme schon außerhalb des neuen Bands, plant 6.6 automatisch neu.
- **„Andere Vorschläge“ und „Plan aktualisieren“** ersetzen getauschte Rezepte ab heute (Nachfrage-Text sagt das).
- **„Rezept tauschen“** nur gegen ein Rezept, das in der Woche noch nicht vorkommt (6.3 Nr. 7). Mit den wenigen
  Beispiel-Rezepten heißt das oft „kein anderes passendes Rezept“ – mit dem echten Bestand (242 Rezepte) selten.
- **Ältere Wochen** werden nicht gespeichert und nicht geändert (nur laufende und nächste Woche sind erreichbar).
- **Hinweis „angepasst“** bleibt bis „Verstanden“ (Feld `auto_adjusted` am gespeicherten Plan).
- Nicht in N5a (weiter offen aus N3): **K1** `applyMealPrepPlan` ohne `slotFitReasons` (mit N5b, Meal-Prep-Pläne), **K4**
  Rundungssprung im schmalen Band; **„Essensplan neu erstellen“** in den Einstellungen (8.2 Nr. 7) entfällt vorerst –
  „Plan aktualisieren“ bzw. „Andere Vorschläge“ decken es ab.

**Wächter-Prüfung N5a (14.10.2026): FREIGABE MIT AUFLAGEN** (Bericht `waechter-n5a.md`, kein Blocker). Umgesetzt:

- **S1** Ein automatisch neu geplanter Plan behält `usesHealthData` des alten Plans, solange er vergangene Tage daraus
  übernimmt (`buildMealPlanWeekDetailed`). Zusätzlich verwendet die App einen gespeicherten Plan mit Gesundheitsbezug
  ohne gültige Einwilligung (z. B. neue Fassung) gar nicht weiter: Er wird durch einen Plan ohne Gesundheitsdaten
  ersetzt, auch die vergangenen Tage der Woche (sichere Richtung; Speichern klappt dann, Faktor 1). Tests in core und
  App („Einwilligung ungültig, Woche halb vorbei“).
- **S2** `mealPlanMatchesRecipes`: Titel, Status, Zutaten, Nährwerte und optionale kcal JEDER gespeicherten Mahlzeit
  (auch vergangener Tage) müssen sich aus dem Rezept derselben Version, erlaubten Ersatzprodukten (`substitutes` des
  Katalogs), weggelassenen optionalen Zutaten und dem Faktor genau ergeben, die Tagessumme muss passen – sonst wird der
  Plan neu erstellt. **Folge:** Ändert sich die Version eines Rezepts der laufenden Woche, wird der Plan inklusive
  vergangener Tage neu erstellt (sichere Richtung, Abweichung von „vergangene Tage nie ändern“ nur in diesem Fall).
  Tests: frische, getauschte und neu geplante Pläne passen (5 Profile × 1/4/8 Mahlzeiten × mit/ohne Einwilligung,
  Meal-Prep, Ersatz), Zod-Rundweg; manipulierter Speicher (Erdnüsse in den Zutaten eines vergangenen Tages, Titel,
  unerlaubter Ersatz, Weglassen einer Pflichtzutat, Summe, Version, Nährwert) → neu erstellt, nie angezeigt.
- **S3** Testmodus: Alle Vorgänge „laden → ändern → speichern“ im lokalen Backend laufen nacheinander
  (`serializeWrites` in `local-backend.ts`); Test: Trainingsplan, Essensplan und Erinnerung gleichzeitig → alle drei
  bleiben (vorher ging der Essensplan verloren).
- **S4** Export vollständig: `meal_plans` enthält zusätzlich `auto_adjusted` und `plan_snapshot` (der ganze gespeicherte
  Plan). **Für N7 festgelegt:** Die Datenbank speichert **weder das Planband noch den Abgleich-Schlüssel `safetyKey`**
  (abgeleitete Ziele bzw. Modus/Ausschlüsse, 7.1). 6.6 (`out_of_band`, `caps_changed`, `mode_changed`) muss dort ohne
  sie auskommen – z. B. Tagessummen gegen das jeweils aktuelle Band prüfen und Modus/Ausschlüsse aus den gespeicherten
  Mahlzeiten (`day_status`, Rezept-Spalten) ableiten; das plant N7.
- **Kann:** K1 Hinweis „angepasst“ nur in änderbaren Wochen; K2 ungenutzte Texte entfernt; K3 Supabase-Fehler mit
  `sensitive`; K4 E2E-Test heißt jetzt „ohne Netz bedienbar“ (echter Offline-Test mit Warteschlange: N7); K6 fester
  Grenzfall 4,9 %/5,0 %. **Nicht umgesetzt:** K5 (Mitternacht/Wochenwechsel bei offener App: Speicher-Hinweis, harmlos)
  und K7 (Knopf „Erneut versuchen“ nach gescheitertem automatischem Speichern) – vermerkt für N5b.

**N5c (eigener PR nach N5b, vor N6; umgesetzt, siehe Umsetzungsstand N5c):** Rezeptsuche (`rezepte/index.tsx`) und Ratgeber (`ratgeber/[id].tsx`) aus 19.6.
Auflagen des Wächters: Treffer nur über `filter.ts` mit demselben Profil inkl. `pregnancy_caution` (Eigenschaftstest:
kein ausgeschlossenes Rezept in den Treffern); Ratgeber nur freigegeben und mit Prüfung gegen Heilversprechen
(Health-Claims-Verordnung); „Zahlen aus“ gilt auch in Suche und Ratgeber.

**Wächter-Nachprüfung N5a (14.10.2026): FREIGABE** (Bericht `waechter-n5a-r2.md`). Drei Kann-Punkte, vorgemerkt für N5b:
K-a – Abgleich gespeicherter Pläne ab heute um Kochtag/Haltbarkeit ergänzen („Kochtag + Haltbarkeit ≥ Tag“, sonst neu
planen), damit ein veränderter Gerätespeicher keine Reste über die Kühlschrank-Haltbarkeit hinaus zeigt; K-b – Hinweis,
wenn ein Plan wegen neuer Rezept-Version samt vergangener Tage neu erstellt wurde; K-c – dokumentiert: Bei neuer Fassung
der Einwilligung (kein Widerruf) wird der Plan mit Gesundheitsbezug der laufenden/nächsten Woche durch einen Plan ohne
Gesundheitsdaten überschrieben (sichere Richtung, Art. 9), andere Gesundheitsdaten bleiben bis zur erneuten Zustimmung.

**Offene Gründer-Entscheidung – Löschfrist gespeicherter Essenspläne (nicht umgesetzt):** Heute bleiben Pläne älterer
Wochen bis zum Widerruf bzw. Löschen. Wächter-Vorschlag (Datensparsamkeit, Art. 5 Abs. 1 c/e DSGVO):
`MEAL_PLAN_RETENTION_WEEKS = 4` (PRODUKTENTSCHEIDUNG) – Pläne, deren Woche mehr als 4 Wochen zurückliegt, beim Laden
löschen; in N7 dasselbe serverseitig mit pgTAP; Einkaufslisten (N5b) mit derselben Frist.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Woche, Tauschen, automatische Anpassung“.

### N5b – App Testmodus: Einkaufsliste, Meal-Prep-Kochtag, „Zur Einkaufsliste“ (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie in N5a festgelegt: Einkaufsliste mit Abhaken offline, eigene Einträge, Zeitraum, Neuerzeugung bei Neuplanung
(W22 App), Meal-Prep-Kochtag mit Timern und Auftau-Hinweisen, „Zur Einkaufsliste“ (Rezept, Meal-Prep-Plan), dazu die
für N5b vermerkten Punkte **K-a**, **K-b** (Nachprüfung N5a), **K5**, **K7** (Wächter N5a) und **N3 K1**. Nur
Testmodus; Supabase-Modus bis N7 unverändert (`saveShoppingList`/`saveCookDayStart` dort „nicht unterstützt“).
**Nicht umgesetzt:** Löschfrist alter Pläne/Listen (Gründer-Entscheidung offen, siehe N5a – gilt dann für Listen mit).

1. **Core** (`packages/core/src/nutrition/`):
   - `shopping-list-store.ts` (neu): gespeicherte Liste einer Woche (`StoredShoppingList` = Liste + Woche +
     Plan-Fingerabdruck `mealPlanShoppingKey` + über „Zur Einkaufsliste“ hinzugefügte Rezepte), Zod strikt
     (`parseStoredShoppingList`; Zeitraum in der Woche, kein Doppel, eigene Einträge ≤ 80 Zeichen/≤ 100, Rezepte
     ≤ `SHOPPING_LIST_EXTRAS.recipesMax`, Portionen 1–12). `resolveShoppingList` beim Öffnen: **die Plan-Einträge kommen
     immer aus dem aktuellen Plan** – aus dem Speicher nur Häkchen (über `item_key`), Markierungen, eigene Einträge,
     abgehakte „nicht mehr im Plan“, Zeitraum und Rezepte (ein veränderter Speicher kann keine Plan-Zutat
     unterschieben). Plan geändert → wie `automaticReplan` ab `max(Beginn, heute)` neu (R2-S4, W22).
     `withShoppingListRange`, `addRecipeToShoppingList` (nur Rezepte, die den Filter der Person bestehen – bei
     JEDEM Auflösen erneut gefiltert, sonst fallen sie weg), `removeRecipeFromShoppingList`, `newShoppingList`.
   - `shopping-list.ts`: `buildShoppingList` mit zusätzlichen Zutaten (Rezepte, zusammengezählt je `item_key`),
     `mergeShoppingList` (gemeinsame Regel für Neuerzeugung), Abhaken/eigene Einträge typerhaltend.
   - `meal-prep-day.ts` (neu): `cookDayOverview` (Kochtag, je Rezept Tage aus Kühlschrank / Gefrierfach / frisch),
     `thawHints` (Vorabend), `cookDayProgress`/`cookDayAlarms` (Timer nur aus Zeitstempeln),
     `defaultMealPrepWeekStart` (Mo–Fr laufende, ab Samstag nächste Woche).
   - **K-a:** `leftoverKeeps` (`meal-prep.ts`): Rest ab heute nur, wenn Kochtag < Tag und Kühlschrank ≤ Haltbarkeit
     (R9 mit den tatsächlichen Zutaten) bzw. eingefroren nur bei einfrierbar; sonst neuer Grund `leftover_expired` in
     `needsAutomaticReplan` → automatische Neuplanung ab heute; die Neuplanung übernimmt solche Reste nicht mehr.
   - **K-b:** `resolveMealPlanWeek` unterscheidet `created` (kein Plan) und **`rebuilt`** (gespeicherter Plan passt nicht
     mehr zu den Rezepten, auch vergangene Tage neu).
   - **N3 K1:** `applyMealPrepPlan` prüft `slotFitReasons` (Meal-Prep-Eignung, Wettkampf nie, Zeitlimit werktags,
     wenn der Kochtag ein Werktag ist) und das Zeitlimit für frisch gekochte Werktage – sonst nicht angeboten.
   - Konstante `SHOPPING_LIST_EXTRAS` (PRODUKTENTSCHEIDUNG, keine Schutzgrenze); Export-Tabellen `shopping_lists`/
     `shopping_list_items` in `PENDING_DB_EXPORT_TABLES` (Datenbank in N7).
   - Beispiel-Bestand (`demo-nutrition.ts`): drei Meal-Prep-Wochen mit Testwerten (Pasta, vegane Curry-Woche mit
     Erdnuss, Fisch), Aufbewahrung über `deriveStoragePlan` (R20 grün).
   - Tests `n5b.test.ts` (27): K-a (Grenzen, manipulierter Kochtag/„eingefroren“, frische Pläne 1–7 Kochtage ×
     1/4/8 Mahlzeiten ohne `leftover_expired`), K-b, K1 (Wettkampf, Zeitlimit Sonntag/Mittwoch, frische Tage),
     Liste (Rundweg, ungültige Stände, Manipulation, W22 Schwangerschaft am Donnerstag inkl. hinzugefügtem
     Räucherlachs-Rezept, vegan + neue Erdnuss-Unverträglichkeit, Zeitraum, 1/12 Portionen, Höchstzahl, nicht
     passendes Rezept, Gesundheitsbezug), Kochtag (Sonntag/heute, Auftauen, Timer-Grenzen, Uhr zurückgestellt).
2. **App** (`apps/mobile`):
   - `UserRows.shoppingLists` (`ShoppingListRow`, höchstens eine je Woche), `MealPlanRow.recipes_changed` (K-b) und
     `cook_day_started_at` (Kochtag-Start, bleibt nur bei gleichem Meal-Prep-Plan); Gerätespeicher älterer Versionen
     über `upgradeStoredRows` (nur gültige Listen des eigenen Kontos).
   - `Backend.saveMealPlan(…, { shoppingList })` speichert Plan **und** neu erzeugte Liste in EINEM Schreibvorgang
     (R2-S4); `saveShoppingList`, `saveCookDayStart`; Regeln in `meal-plan-rows.ts` (Zod, laufende/nächste Woche, Liste
     mit Gesundheitsbezug nur mit gültiger Einwilligung). Alle Schreibvorgänge nacheinander (S3).
   - `computeNutritionWeek` löst auch die Liste auf; `useNutritionWeek` speichert einen neuen/neu geplanten Plan
     zusammen mit der angepassten Liste. Tauschen, „Andere Vorschläge“, „Plan aktualisieren“ und „Meal-Prep-Plan
     wählen“ erzeugen eine gespeicherte Liste im selben Schritt neu. `useShoppingListActions` für die Bildschirme.
   - Bildschirme: **Einkaufsliste** (`einkaufsliste/index.tsx`: Diese/Nächste Woche, Abteilungen, Häkchen, „Erledigte
     ausblenden“, Vorrat eingeklappt, eigener Eintrag mit Abteilung, Zeitraum, hinzugefügte Rezepte, Markierungen
     „Menge geändert“/„nicht mehr im Plan“, Hinweis „angepasst“, Offline-Hinweis, Lade-/Fehler-/Leer-Zustände),
     **Meal-Prep-Pläne** (`meal-prep/index.tsx`, ausgegraut „Passt nicht zu deinen Angaben“ ohne Grund und ohne
     Rezeptnamen), **Plan** (`meal-prep/[id].tsx`: Rezepte, Kochtag, Aufbewahrung, „Plan für diese Woche wählen“ mit
     Nachfrage, danach „Zur Einkaufsliste“ und „Zum Kochtag“), **Kochtag** (`meal-prep/kochtag.tsx`: Start/Neu
     starten/Beenden, Restzeit bis zum nächsten Schritt, aktueller Schritt, was eingefroren/gekühlt wird).
     **Rezept:** „Zur Einkaufsliste (N Portionen)“ mit dem Portionswähler. **Tag:** Links „Einkaufsliste“ und
     „Meal-Prep-Pläne“, Auftau-Hinweis „Heute Abend auftauen“.
   - **K5:** `useToday` – Tag und Woche wechseln um Mitternacht und beim Zurückkehren in die App (Ernährung,
     Einkaufsliste, Meal-Prep). **K7:** Knopf „Erneut versuchen“ beim gescheiterten automatischen Speichern.
   - Widerruf und „Gespeicherte Unverträglichkeiten löschen“ löschen Listen mit Gesundheitsbezug **samt eigener
     Einträge** (K10); Export `shopping_lists`/`shopping_list_items` (Spalten wie 7.2 plus Zeitraum, Rezepte,
     Markierungen) und `recipes_changed`/`cook_day_started_at` bei `meal_plans`.
   - „Zahlen aus“: Einkaufsliste, Meal-Prep und Kochtag zeigen ohnehin keine kcal und keine Makro-Gramm.
3. **Tests:** App-Vitest `nutrition-n5b.test.ts` (12: Speicher-Regeln, Gerätespeicher, Widerruf, Löschen, Export,
   Häkchen nach Neustart, W22-Ablauf bis „gespeichert“, abgelehntes Speichern ändert auch den Plan nicht,
   gleichzeitiges Speichern, Meal-Prep-Angebote, Kochtag-Start, K-b), Format-Tests (Einträge, Restzeit, Mitternacht).
   Playwright `e2e/nutrition-shopping.spec.ts` (5): Abhaken und eigener Eintrag mit `setOffline`, Häkchen nach Neu
   laden, Erledigte ausblenden, Zeitraum; **W22 App** (schwanger am Mittwoch → Plan und Liste angepasst, rohe
   Mascarpone-Creme nicht mehr offen, Häkchen/eigene Einträge bleiben, keine Schleife); „Zur Einkaufsliste“ aus dem
   Rezept; **Meal-Prep-Woche** (ausgegraut ohne Grund, Plan wählen → Einkaufsliste → Kochtag, Timer nach Neuladen und
   ohne Netz, „Zahlen aus“ → keine kcal); Erdnuss-Unverträglichkeit → vegane Woche ausgegraut.

**Abweichungen / Präzisierungen:**

- **Auch manuelle Plan-Änderungen** (Tauschen, „Andere Vorschläge“, „Plan aktualisieren“, Meal-Prep-Plan wählen)
  erzeugen eine gespeicherte Liste mit derselben Regel neu wie die automatische Neuplanung (6.5/6.6 nennen nur die
  automatische; N9 verlangt es für den Zutaten-Tausch). Sonst stünde nach einem Tausch eine veraltete Liste da.
- **Eine Liste entsteht erst bei der ersten Änderung** (Abhaken, eigener Eintrag, Zeitraum, „Zur Einkaufsliste“);
  bis dahin wird sie aus dem Plan angezeigt. Der Hinweis „Einkaufsliste angepasst“ hängt am Hinweis „Plan angepasst“
  (bis „Verstanden“ in der Ernährung).
- **Zeitraum** nur innerhalb der Woche Mo–So (Liste je Woche). Beim Ändern fallen Einträge außerhalb ganz weg (auch
  abgehakte – „nicht mehr im Plan“ wäre falsch); Häkchen bleiben, wo der Eintrag bleibt.
- **„Zur Einkaufsliste“ aus dem Rezept:** Einträge werden mit den Plan-Einträgen zusammengezählt; erneutes Hinzufügen
  setzt die Portionenzahl; aus dem Essensplan geöffnet kein Knopf (steht schon über den Plan drauf). Die Kennzeichnung
  „passt nicht zu deiner Ernährungsform“ für Treffer der erweiterten Suche (19.6 K3/G4) kommt mit der Suche (N5c).
- **„Zur Einkaufsliste“ aus dem Meal-Prep-Plan** gibt es nach „Plan wählen“ (Ablauf KONZEPT 6.7: Plan wählen →
  Einkaufsliste → Kochtag): Die Mengen hängen vom Plan der Person ab. Der Knopf legt die Liste der Woche an und öffnet
  sie.
- **Gesundheitsbezug der Liste:** Plan mit Gesundheitsbezug oder hinzugefügte Rezepte, die mit Unverträglichkeiten
  bzw. Gesundheits-Flags gefiltert wurden. Ohne gültige Einwilligung wird eine solche Liste nicht weiterverwendet
  (wie N5a S1 beim Plan); eigene Einträge darin gehen dann verloren (sichere Richtung).
- **Gewählter Meal-Prep-Plan** gilt, bis „Andere Vorschläge“, „Plan aktualisieren“ oder die automatische Neuplanung
  die Tage ab heute ersetzen (Nachfrage-Text sagt das). Ausgegraute Pläne zeigen keine Rezeptnamen.
- **Timer:** Start als Zeitstempel am gespeicherten Plan (`cook_day_started_at`); Fortschritt nur aus Zeitstempeln.
- **Lokale Benachrichtigung – offene Gründer-Entscheidung:** Umgesetzt ist, was ohne neue native Abhängigkeit geht:
  im Browser Mitteilungen über die Notification-API (Erlaubnis erst nach Tippen auf „Kochtag starten“; nur solange die
  Seite offen ist), in der App Vibration und Ansage für den Bildschirmleser, solange sie geöffnet ist. Mitteilungen im
  Hintergrund bräuchten `expo-notifications` (neue native Abhängigkeit; EAS richtet dafür auf iOS die
  Push-Fähigkeit ein, Android fragt nach der Mitteilungs-Erlaubnis, neuer Development Build) – **offene
  Gründer-Entscheidung**, Empfehlung und Bedingungen siehe „Wächter-Prüfung N5b“ unten.
- **Auftau-Hinweis** zusätzlich in der Tagesansicht (Vorabend), nicht nur im Kochtag.
- **Nebenbei behoben:** Ein Gerätespeicher mit ungültigem Datum ließ `parseStoredMealPlanWeek` werfen statt „ungültig“
  zu melden (Zod verfeinert nach Formatfehlern weiter) – `weekStartSchema` und die Tages-Prüfung werfen nicht mehr.
- **Nicht in N5b:** Druckansicht/Teilen der Liste (Abschnitt 11, Prompt F), Supabase-Tabellen und
  `replace_shopping_list`/Offline-Warteschlange (N7), N3 K4 (Rundungssprung).

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Einkaufsliste und Meal-Prep-Kochtag“.

**Wächter-Prüfung N5b (14.10.2026): FREIGABE MIT AUFLAGEN** (Bericht `waechter-n5b.md`, kein Blocker). Umgesetzt:

- **S1** Texte ohne falsche Zusage: „Kochtag läuft“ sagt jetzt, dass die Zeit weiterläuft, Erinnerungen aber nur
  kommen, solange App bzw. Seite geöffnet ist; der Browser-Hinweis verspricht keine Mitteilungen der App im
  Hintergrund mehr.
- **K1** Abgehakte Einträge, die schon im Gerätespeicher als „nicht mehr im Plan“ standen, bleiben nur, wenn das
  Lebensmittel für die Person heute erlaubt ist (`foodAllowedForPerson` in `filter.ts`: Katalog-Prüfung,
  Ernährungsform, Schwein, Unverträglichkeit, „mag ich nicht“, Schwangerschafts-Hinweis). Frisch weggefallene,
  abgehakte Einträge bleiben nach R2-S4 einmal mit „nicht mehr im Plan“ stehen; ist ihr Lebensmittel ausgeschlossen
  (z. B. Räucherlachs nach „schwanger“), verschwinden sie beim nächsten Öffnen. Test „K1“ und Folge-Öffnen im
  W22-Test (core).
- **K2** Rezeptansicht und Tagesansicht folgen „heute“ über Mitternacht (`useToday`; die Tagesansicht nur, solange
  kein anderer Tag gewählt ist).
- **K4** Widerrufs-Dialog: eigene Einträge in Listen ohne Gesundheitsbezug bleiben – mit Hinweis, sie dort selbst zu
  löschen, wenn sie etwas über die Gesundheit verraten.
- **K5** E2E W22 prüft jetzt, dass jeder abgehakte Eintrag abgehakt bleibt (Ausnahme nur K1).
- **K6** `cookDayAlarms` ist **vorbereitet** (Zeitpunkte für lokale Mitteilungen), in der App noch ungenutzt.
- **Nur dokumentiert:** **K3** `thawHints` sucht „morgen“ nur in derselben Woche (Sonntag → Montag der nächsten Woche
  ohne Hinweis); mit den heutigen Meal-Prep-Regeln ist ein Montag nie eingefroren. **K7** Nach einer neuen Fassung der
  Einwilligung (kein Widerruf) bleibt eine Liste mit Gesundheitsbezug unbenutzt im Speicher, bis sie sich das nächste
  Mal ändert (wie K-c aus N5a) – zusammen mit der Löschfrist lösen.

**Offene Gründer-Entscheidung / Vormerkung für den ersten Development Build – Mitteilungen im Hintergrund
(`expo-notifications`):** Wächter-Empfehlung: **nicht jetzt**, sondern gebündelt mit dem ersten Development Build (ab
Wearables/Abos bzw. N7). Grund: neue native Abhängigkeit mit Config-Plugin (iOS Push-Entitlement, Android-Abfrage
POST_NOTIFICATIONS), neuer EAS-Build, in Expo Go nicht vollständig testbar; der Testmodus funktioniert ohne (die
Timer stimmen nach dem Öffnen). **Bedingungen für die spätere Umsetzung:**

1. Nur lokale Mitteilungen (`scheduleNotificationAsync`) aus `cookDayAlarms`, kein Push-Server.
2. Erlaubnis erst nach „Kochtag starten“.
3. Text auf dem Sperrbildschirm allgemein („Kochtag: nächster Schritt“), Schritt-Text erst in der App – nie
   Rezeptnamen auf dem Sperrbildschirm.
4. Mitteilungen abbrechen bei „Beenden“, „Neu starten“, Planwechsel, Neuplanung, Widerruf und Abmelden.
5. Keine Mitteilungen für Schritte in der Vergangenheit.
6. Test: Nach Löschen bzw. Widerruf bleiben keine geplanten Mitteilungen übrig.

### N5c – App Testmodus: Rezeptsuche und Ratgeber (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie in N5a festgelegt (19.6 Zeilen „Rezeptsuche mit Filtern“, „Portionswähler“, „Ratgeber offline“; DoD-Ergänzungen
N4/N5) mit den Auflagen des Wächters: Treffer nur über `filter.ts` mit demselben Profil inkl. `pregnancy_caution`,
Ratgeber nur freigegeben und gegen Heilversprechen geprüft, „Zahlen aus“ auch in Suche und Ratgeber. Gratis, rein
regelbasiert (keine Echtzeit-KI). Nur Testmodus; Supabase-Modus bis N7 unverändert („nicht unterstützt“).

1. **Core** (`packages/core/src/nutrition/`):
   - `recipe-search.ts`: neue Einzelprüfung `recipeForPersonWithDiets(recipe, ctx, extraDiets)` – dieselbe Regel wie
     die Suche (zuerst `filterRecipe` mit der Profil-Ernährungsform, nur sonst mit der erweiterten; alle anderen
     Ausschlüsse unverändert); `searchRecipes` nutzt sie. Neu `recipeSearchDietOptions` (nur großzügigere Formen:
     vegan → vegetarisch, mit Fleisch; vegetarisch → mit Fleisch) und `recipeSearchFacets` (Kategorien in fester
     Reihenfolge, Abschnitte, ob es freigegebene Kostenschätzungen gibt – leere Filter werden nicht angeboten).
   - `shopping-list-store.ts`: „Zur Einkaufsliste“ für Treffer der erweiterten Suche (19.6 K3/G4, aus N5b vermerkt) –
     Rezept-Eintrag mit optionaler `diet` (Zod strikt, ältere Listen bleiben gültig); bei JEDEM Auflösen erneut über
     `recipeForPersonWithDiets` gefiltert. `shoppingItemOutsideProfileDiet` kennzeichnet Einträge, deren Lebensmittel
     nicht zur Profil-Ernährungsform passt.
   - `guides.ts` (neu): `readableGuides` (Schema gültig, `published` – im Testmodus auch `draft` –, nie archiviert oder
     Probelauf, **kein roter Befund aus `checkGuide`/R21**: Heil-/Gesundheits- und Nährwertversprechen, Marken,
     fehlender Carb-Loading-Hinweis; zusätzlich zu `selectNutritionContent`), `guideForDisplay` (bei „Zahlen aus“
     fallen Absätze mit kcal/kJ oder Makro-Gramm weg, gezählt; feste Hinweise bleiben), `mentionsEnergyOrMacroGrams`.
   - Konstante `RECIPE_SEARCH_COST_STEPS_EUR = [2, 3, 5]` (PRODUKTENTSCHEIDUNG, Bedienung).
   - Beispiel-Bestand (`demo-nutrition.ts`): zwei Beispiel-Ratgeber mit Testtexten (`DEMO_GUIDES`, Entwurf, je ein
     Absatz mit Zahlen, Carb-Loading mit festem Hinweis, ohne roten Befund).
   - Tests `n5c.test.ts` (10, nach der Wächter-Prüfung 14): Eigenschaftstest „Suche = Einzelprüfung, nie ein Rezept, das `filter.ts` mit der
     erweiterten Form ausschließt; gekennzeichnet genau dann, wenn die Profil-Form nicht passt; Schwangerschaft,
     Unverträglichkeit, ‚mag ich nicht‘, Schwein“ (150 Profile), feste Fälle (Erdnuss, Schwein unbekannt, Räucherlachs
     und rohe Eier in der Schwangerschaft), Filter aus dem Bestand, „Zur Einkaufsliste“ erweitert (Kennzeichnung,
     Rundweg, ältere Listen, Erweitern hebt keinen Ausschluss auf, Schwangerschaft später → Rezept fällt weg),
     Ratgeber (Status, rote Befunde, Carb-Loading-Hinweis, Schema), Zahlen aus.
2. **App** (`apps/mobile`):
   - `data/recipe-search.ts`: `recipeSearchForPerson` – Profil wie Essensplan (`mealPlanProfileFromRows`:
     Unverträglichkeiten nur mit gültiger Einwilligung, sonst **blockiert**), Schwangerschafts-Ausschluss wie die
     Rezeptansicht (`weekExcludesPregnancyCaution`), Karten mit Zeit, kcal je Portion, Kennzeichnung.
   - `recipeForPerson(…, extraDiet)`: Rezeptansicht aus der Suche mit Parameter `?form=` (nur gültige Werte; aus dem
     Essensplan geöffnet nie erweitert); Hinweis „Passt nicht zu deiner Ernährungsform: …“ und „kommt nie automatisch
     in deinen Essensplan“; „Zur Einkaufsliste“ übergibt die Form.
   - Bildschirme: **Rezeptsuche** (`rezepte/index.tsx`: Suchfeld, „Deine Ernährungsform: …“ vorbelegt, „Auch …“ zum
     Erweitern, „Unter 10 Minuten“, Kategorie/Mahlzeit/Kosten nur wenn vorhanden, „Filter zurücksetzen“, Anzahl,
     Karten alphabetisch – nie nach kcal –, Lade-/Fehler-/Leer-/Sperr-Zustände), **Ratgeber-Übersicht**
     (`ratgeber/index.tsx`) und **Ratgeber** (`ratgeber/[id].tsx`: Abschnitte, Orte mit „Gute Wahl“/„Eher selten“/Tipp,
     fester Hinweis, Entwurf-Kennzeichnung, „nicht gefunden“). **Einkaufsliste:** Markierung „passt nicht zu deiner
     Ernährungsform“ an Einträgen und hinzugefügten Rezepten. **Tag:** Links „Rezepte suchen“ und „Ratgeber“.
   - „Zahlen aus“ (und Schwangerschaft/Stillzeit wie überall über `showNumbers`): keine kcal auf den Karten, keine
     Nährwerte im Portionswähler (schon N4), im Ratgeber Absätze mit Zahlen ausgeblendet mit Hinweis.
3. **Tests:** App-Vitest `nutrition-n5c.test.ts` (6): Eigenschaftstest über 9 Personen × 4 Erweiterungen (Treffer nur
   über `filter.ts` inkl. Schwangerschaft), feste Fälle, vorbelegt/erweitert/„Unter 10 Minuten“, blockiert ohne
   Einwilligung, Rezeptansicht aus der Suche, Beispiel-Ratgeber. Playwright `e2e/nutrition-search.spec.ts` (3): Suche
   mit vorbelegter Ernährungsform, „Auch mit Fleisch“ gekennzeichnet ohne Schwein, „Unter 10 Minuten“, Leer-Zustand,
   Portionswähler 1 → 3 (Mengen ×3), „Zur Einkaufsliste“ mit Kennzeichnung, direkter Aufruf ohne `?form` gesperrt,
   **„Zahlen aus“ → keine kcal in Suche und Portionswähler**; vegan + Erdnuss + schwanger auch erweitert ohne
   Erdnuss/Räucherlachs/rohe Eier/Schwein; **Ratgeber im Flugmodus** (`setOffline`), „Zahlen aus“ im Ratgeber.

**Abweichungen / Präzisierungen:**

- **Ratgeber-Übersicht** `ratgeber/index.tsx` zusätzlich zu `ratgeber/[id].tsx` (19.6 nennt nur die Einzelseite; ohne
  Übersicht wären die Ratgeber nicht erreichbar).
- **„Zahlen aus“ im Ratgeber:** Ratgeber-Texte sind Fließtext. Umgesetzt als Ausblenden ganzer Absätze (bzw.
  Aufzählungspunkte, Einleitung, Tipps), die kcal/kJ oder Makro-Gramm nennen (z. B. „8–10 g Kohlenhydrate pro kg“),
  mit Hinweis „Zahlenangaben … sind ausgeblendet“. Feste Hinweise (Carb-Loading) bleiben immer. Sichere Richtung.
- **„Ratgeber nur freigegeben“:** live nur `published`; im Testmodus wie alle Inhalte auch Entwürfe ohne roten Befund
  mit Kennzeichnung „Entwurf – fachlich noch nicht geprüft“. Rote R21-Befunde schließen in beiden Fällen aus (auch
  wenn ein Ratgeber an `selectNutritionContent` vorbei käme). Gelbe R21H-Befunde (Mengen zur Fachprüfung) schließen
  nicht aus – sie werden vor der Freigabe geprüft (`content-review`, Häkchen „fachlich geprüft“).
- **Kennzeichnung auf der Einkaufsliste** je Eintrag aus der Ernährungsform des Lebensmittels (nicht gespeichert);
  Plan-Einträge passen immer zur Profil-Form und tragen sie nie. Ein schon „nicht mehr im Plan“ stehender, abgehakter
  Eintrag aus einem erweiterten Rezept verschwindet beim nächsten Öffnen (N5b K1, sichere Richtung).
- **Text-Suche** nur im Titel (wie `searchRecipes` seit N3); höchstens 100 Zeichen.
- **Kosten-Filter** in festen Stufen (2/3/5 € je Portion) und nur sichtbar, wenn es freigegebene Kostenschätzungen
  gibt (heute keine – 6.13/N12).
- **Nicht in N5c:** Supabase-Tabelle `guides` und Laden aus der Datenbank (N7), echte Ratgeber-Texte (kommen mit
  `alpha5-import`; die 6 roten R21-Befunde aus N2c müssen vorher umformuliert werden, sonst bleiben sie ausgeblendet).

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Rezeptsuche und Ratgeber“.

**Wächter-Prüfung N5c (14.10.2026): FREIGABE MIT AUFLAGEN** (Bericht `waechter-n5c.md`, kein Blocker). Umgesetzt:

- **S1** Die Kennzeichnung eines hinzugefügten Rezepts auf der Einkaufsliste kommt aus core
  (`shoppingRecipeOutsideProfileDiet`, über `dietAllows`) statt aus einem Vergleich im UI. Hat sich das Profil
  inzwischen erweitert (vegan → mit Fleisch), entfällt die Kennzeichnung. Test in `n5c.test.ts`.
- **S2** Der Filter für „Zahlen aus“ erkennt auch Bindestrich- und zusammengesetzte Wörter („500-kcal-Snack“,
  „2500-Kalorien-Diät“, „2000 Kalorienbedarf“, „30-g-Eiweiß-Regel“). Tests mit Gegenbeispielen (ml, Stunden, Gramm
  ohne Makro-Wort).
- **S3** Die Textregeln für Ernährungsinhalte (`HEALTH_CLAIM_TERMS`, gilt für Rezepte, Lebensmittel, Meal-Prep und
  Ratgeber, nicht für Übungen) sind um typische Heilversprechen ergänzt: „hilft gegen“, „hilft/unterstützt beim
  Abnehmen“, „beugt … vor“/„vorbeugen“, „entzündungs…“, Krebs, Erkältung, Grippe, Infekt, Herz-Kreislauf,
  Blutzucker/Blutdruck, „senkt …“ (Risiko, Blut…, Cholesterin, Entzündung), „stärkt …“ (Immun…, Abwehr, Knochen, Herz,
  Nerven, Darm), „gut für“ + Organ/Körperfunktion, „verdauungsfördernd“. Diabetes und Bluthochdruck standen schon in
  der medizinischen Liste. Tests mit Gegenbeispielen (z. B. „Flusskrebse“, „Vorbereitung“, „hält sich gut für zwei
  Tage“). **Neue Treffer im heutigen Bestand: keine.** `content:validate` bleibt grün, und ein Abgleich aller Texte in
  `alpha5-rezepte.json` vor und nach der Ergänzung ergibt dieselben Treffer.
- **K1** Titel, Überschriften und Ortsnamen mit Zahlen werden bei „Zahlen aus“ ebenfalls ausgeblendet. Die App zeigt
  dann „Ratgeber“ als Titel bzw. lässt die Überschrift weg. Das gilt auch in der Übersicht.
- **K2** Der Filter erkennt jetzt auch „MJ“/Kilojoule/Megajoule und Prozentangaben zusammen mit Makro- oder
  Energie-Wörtern („30 % Fett“, „55 Prozent der Energie“). **Redaktionsregel (Ratgeber und Rezepttexte):** Zahlen
  immer als Ziffern, Energie in kcal oder kJ. Zahlwörter wie „dreihundert Kalorien“ erkennt der Filter nicht.
- **K3** Der Hinweis lautet neutral „Zahlenangaben zu Kalorien und Nährstoff-Mengen sind hier ausgeblendet.“ Er
  passt so auch in Schwangerschaft und Stillzeit.
- **K4** Die React-Keys im Ratgeber bestehen aus Index und Text, gleiche Absätze sind also möglich.
- **K5** „Filter zurücksetzen“ erscheint nur, wenn wirklich ein Filter gesetzt ist.
- **K6** Der Knopf „Ratgeber“ in der Tagesansicht erscheint nur, wenn `readableGuides` mindestens einen Ratgeber
  liefert.

### N6 – PDF P5: Essensplan und Einkaufsliste (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie Abschnitt 11 und 13 (N6): Dokumentmodell, Renderer-Bausteine, Druckansichten, Knöpfe, nativer Druck.
Gratis, rein regelbasiert (keine Echtzeit-KI). Nur Testmodus (Supabase-Modus bis N7 „nicht unterstützt“). Nichts wird
gespeichert, hochgeladen oder geloggt – das Dokument entsteht im Speicher, erst nach dem Hinweis-Dialog.

1. **Core** (`packages/core/src/export/`):
   - `document.ts`: `PrintDocumentKind` = `'training_plan' | 'nutrition_plan' | 'shopping_list'` (Zod
     `PRINT_DOCUMENT_KINDS`); neue Bausteine **`checklist`** (Kästchen-Liste, ein- oder zweispaltig, `checked` = in der
     App abgehakt) und **`steps`** (nummerierte Rezept-Schritte, `start` > 1 = Fortsetzung). Zod für beide. Höchstzahl
     der Blöcke je Dokument von 400 auf 2.000 (8 Mahlzeiten × 7 Tage mit lauter verschiedenen Rezepten). Die App fängt
     ein ungültiges Dokument ab („Das hat leider nicht geklappt“) statt abzustürzen.
   - `nutrition-print-texts.ts` (neu): 43 Text-Codes der Ernährungs-Dokumente mit strikten Parameter-Schemas (nur
     Enums, begrenzte Zahlen und gesäuberte Inhalte) – **kein Code kennt Ziele, Gründe, Unverträglichkeiten, Flags,
     Schwangerschaft, Gewicht oder Alter**. `print-values.ts` (neu): gemeinsames Inhalts-Schema.
   - `nutrition-documents.ts` (neu): `buildNutritionPlanDocument` (Deckblatt mit Logo, „Dein Essensplan“, Woche,
     optional Name – Standard aus –, Arzt-Hinweis, ggf. Testwerte- und Entwurfs-Hinweis, Anleitung, Produkt-Hinweis
     Spuren + HFI/Zöliakie; Wochenübersicht Mo–So × Mahlzeiten mit Rezept und Menge, Kochtag/vorgekocht/Ergänzung,
     Zeile „Tagessumme“ bzw. „Hinweis“; je Rezept ein Abschnitt mit „In deinem Plan“, Zeit, Beschreibung,
     KI-Entwurf-/Allergen-Kennzeichnung, Zutaten je Mengen-Spalte, Weglass-Hinweis, Geräte, Schritte, Haltbarkeit) und
     `buildShoppingListDocument` (Zeitraum, Abteilungen in fester Reihenfolge, zweispaltige Kästchen, Vorrat am Ende,
     über „Zur Einkaufsliste“ hinzugefügte Rezepte, Arzt- und Produkt-Hinweis, **keine kcal**). Zod-Optionen
     (`nutritionPlanPrintOptionsSchema`, `shoppingListPrintOptionsSchema`), Fehler `invalid_options`, `no_meals`,
     `recipe_missing` (Rezept fehlt oder andere Version – nie mit falschen Schritten drucken).
   - **Zahlen:** kcal nur als Tagessumme (16 A Nr. 16), nur bei „Kalorienzahlen anzeigen“, nur an Tagen `complete`,
     nie in einer Woche mit Schwangerschaft/Stillzeit – der Core prüft `weekHidesEnergyNumbers` selbst (zusätzlich zur
     App). `below_floor` → „unvollständig“ statt Zahl mit Erklärung in der Legende, `no_targets` → keine Summe. Keine
     Nährwerte je Rezept.
   - **Seitenumbruch** nach Höhen-Schätzung (`PRINT_EXPORT.nutritionLayout` in `constants.ts`, PRODUKTENTSCHEIDUNG
     Layout): Wochenübersicht mit Folgeseite „Wochenübersicht (Fortsetzung)“ (z. B. 8 Mahlzeiten mit langen Namen),
     Rezepte ganz auf die Seite, wenn sie passen, sonst neue Seite; lange Rezepte mit „… (Fortsetzung)“, Zutaten- und
     Schritt-Listen laufen weiter (Nummerierung bleibt); lange Einkaufslisten auf mehrere Seiten. Immer hochkant.
   - Namensnennung der Nährwert-Quellen (S13) im Fuß des Essensplans aus `source` der verwendeten Lebensmittel
     (Wortlaut nach Wächter N6 S2, siehe unten); Beispiel-Rezepte:
     „Nährwerte: Testwerte (keine Quelldaten)“.
2. **UI** (`packages/ui/src/print/`): Renderer um `checklist` (Titel mit `aria-labelledby`, Kästchen dekorativ
   `aria-hidden`, Haken als Zeichen „✓“ plus durchgestrichen und Screenreader-Text „erledigt“ – nicht nur Farbe) und
   `steps` (`<ol start>`) erweitert; Escaping und CSP unverändert (B7). Mindestschrift 10 pt bleibt. `dl.kv dt`
   schrumpft nicht mehr (lange Werte wie „In deinem Plan …“).
3. **App** (`apps/mobile`):
   - `lib/print-nutrition.ts` (Woche → Dokument → Übersetzung → HTML, Namens-Fehlertexte, Gesundheitsbezug),
     `lib/print-nutrition-texts.ts` (Texte der Codes, deutsch), `lib/print-document.ts` (neue Bausteine),
     `lib/print-sanitize.ts` (erlaubt `ul`/`ol`/`li`, `start` nur als Zahl an `ol`).
   - Druckansichten **`app/ernaehrung/drucken.tsx`** und **`app/einkaufsliste/drucken.tsx`** (gemeinsam
     `components/nutrition-print-view.tsx`): laufende/nächste Woche über `?woche=`, Hinweis-Dialog „Bevor du
     speicherst“ bei `usesHealthData` (Plan bzw. Liste) **mit K4-Satz** („Ersatzprodukte und weggelassene Zutaten …
     lassen darauf schließen“), beim Essensplan „Meinen Namen auf das Deckblatt drucken“ (entprellt, nicht gespeichert)
     und Hinweis, ob kcal im PDF stehen; Vorschau im Browser, „Drucken / als PDF sichern“ (Web: Druckdialog, nativ
     `expo-print` wie P4); Lade-, Fehler-, Sperr- (Einwilligung) und Leer-Zustände.
   - Knöpfe **„Als PDF speichern“** in der Woche (`ernaehrung/woche.tsx`) und in der Einkaufsliste.
4. **Tests:** Core `export/nutrition-documents.test.ts` (20): Aufbau und Schema, Name, Zahlen an/aus, Testwerte,
   Schwangerschaft (auch gespeicherter Plan mit Zahlen-Tagen), `below_floor`, **K4** (unten), leerer Platz ohne Grund,
   1 vs. 8 Mahlzeiten (mit Folgeseite), 8 × 7 lauter verschiedene Rezepte (Schema gültig), Meal-Prep-Markierungen, 5 Mengen → zwei Zutaten-Tabellen, sehr langes Rezept
   (20 Zutaten, 15 Schritte, Folgeseiten, Nummerierung), Steuerzeichen/Skript-Text bleibt Text, `no_meals`/
   `recipe_missing`, Entwürfe; Einkaufsliste (Abteilungen, Vorrat am Ende, keine kcal, Häkchen, „nicht mehr im Plan“
   entfällt, eigene Einträge, Rezepte, leer, 200 Einträge, `usesHealthData` ändert nichts). `document.test.ts` (+2:
   neue Bausteine und Codes). UI `render-html.test.ts` (+3, Böse-Eingaben auch in Liste und Schritten). App
   `lib/print-nutrition.test.ts` (14: Zusammenstecken mit `computeNutritionWeek`, Zahlen aus, Schwangerschaft,
   Unverträglichkeit ohne Gründe, Name, Einkaufsliste, Fehler, Übersetzungen, alle CI-Beispiele unverändert nach der
   Bereinigung), `print-sanitize.test.ts` (+1). Playwright `e2e/nutrition-print.spec.ts` (3: Woche → Hinweis →
   Abbrechen/Weiter → Vorschau ohne Gründe → Name → Druckdialog → A4; Einkaufsliste mit Kästchen und Haken, keine kcal,
   kein Namensfeld; „Zahlen aus“ und Schwangerschaft ohne kcal) und `e2e/print-pages.spec.ts` (+7 Fälle: jede Seite
   ≤ A4 und PDF-Seitenzahl = Abschnitte, inkl. Belastungstests).
   - **K4-Formulierung (12.1):** Derselbe Plan mit `usesHealthData` an/aus, ohne/mit Hinweisen und Gründen leerer
     Plätze („intolerance“, „pregnancy_caution“) und mit Zielen anderer Personen (Schwangerschaft, 16 J., 45 kg, keine
     Einwilligung; bei „Zahlen aus“) ergibt ein **identisches** Dokument. Derselbe Plan mit und ohne Ersatzprodukt
     unterscheidet sich **nur** in den Zutaten-Zeilen der Rezepte (und ggf. der Quellenangabe im Fuß). Im ganzen
     Dokument stehen keine Unverträglichkeits-Codes, Flags, Ziele, Gewicht oder Geburtsjahr; Titel sind feste Codes.
5. **CI-Artefakt:** `scripts/pdf-preview.ts` schreibt zusätzlich 7 Ernährungs-Dokumente (vegetarisch mit Zahlen,
   „Zahlen aus“ + Name, Laktose + Meal-Prep, Schwangerschaft, Einkaufsliste, zwei Belastungstests) ins Artefakt
   **„pdf-vorschau“** (Workflow `ci`, unverändert) und in die Zusammenfassung des Laufs. Beispiel-Personen mit
   Testwerten aus `src/test/nutrition-print-examples.ts`.
6. **EAS-Build Android: NICHT geprüft.** Claude kann in der Cloud-Sitzung keinen EAS-Build starten. Es kommt keine
   neue native Abhängigkeit dazu (`expo-print` ist seit P4 gepinnt), das HTML ist hochkant wie beim Trainingsplan.
   **Gründer:** GitHub-App → Actions → **eas-build** → Run workflow → `android / preview / nein` → APK installieren
   (HANDY-ANLEITUNG Teil 9 A + B) → Teil 9 D **Punkt 11** prüfen und Ergebnis schreiben. Bis dahin ist das DoD-Häkchen
   „EAS-Build Android geprüft“ offen.

**Abweichungen / Präzisierungen (zur Wächter-Prüfung):**

- **„Rezept-Block“** ist als Baustein `steps` (nummerierte, fortsetzbare Schritte) plus die vorhandenen Bausteine
  (Überschrift, Angaben, Zutaten-Tabelle, Hinweise) umgesetzt, nicht als ein einziger Block: Ein Rezept mit 20 Zutaten
  und 15 langen Schritten passt nicht auf eine Seite, und Blöcke lassen sich im Seitenmodell nicht über Seiten teilen.
- **Mengen** heißen wie in der App „× 1,5“ (Vielfaches des Grundrezepts, „Deine Portion: 1,5 × Grundrezept“), nicht
  „Portion 1,5“. Kommt ein Rezept in der Woche mit verschiedenen Mengen vor, hat die Zutaten-Tabelle je Menge eine
  Spalte mit den Wochentagen; mehr als 4 Mengen → zweite Tabelle.
- **Weglass-Hinweis** („Ohne: … (optionale Zutaten weggelassen)“) wird wie der Ersatz-Hinweis gedruckt (K4-Ausnahme,
  sonst würde nach den Schritten falsch gekocht); der Hinweis-Dialog nennt beides. **Bitte im Wächter bestätigen.**
- **Kein „Enthält: …“** (Allergen-Gruppen) und **keine Nährwerte je Rezept** im PDF (16 A Nr. 16: nur
  Tagessummen); stattdessen auf jedem Dokument der feste Produkt-Hinweis (Spuren, HFI/Zöliakie). Kann ergänzt werden,
  falls gewünscht.
- **Leere Plätze** heißen neutral „kein passendes Rezept“ – ohne den Grund, den die App nennt.
- **Einkaufsliste:** abgehakte Einträge mit Haken (wie in der App), abgehakte „nicht mehr im Plan“ entfallen, eigene
  Einträge stehen drin; keine Markierungen „Menge geändert“ oder „passt nicht zu deiner Ernährungsform“. Kein Name
  (11 nennt den Namen nur für das Deckblatt des Essensplans). Kein Quellen-Fuß (keine Nährwerte auf der Liste).
- **Immer hochkant**, auch im Web (nativ gibt es ohnehin kein Querformat, PLAN-PDF-EXPORT §13).
- **Entwürfe (16 B (i)):** Allergen-Warnung auf dem Deckblatt und bei jedem Entwurfs-Rezept, dazu „KI-Entwurf –
  fachlich prüfen“.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Essensplan und Einkaufsliste als PDF“, und Teil 9 D
Punkt 11 (echte App).

**Wächter-Prüfung N6 (14.10.2026): FREIGABEFÄHIG MIT AUFLAGEN** (Bericht `waechter-n6.md`, kein Blocker). Umgesetzt:

- **S1** Rezept-Beschreibungen mit Nährwert-Mengen: Neu `withoutNutrientAmounts` in `packages/core/src/nutrition/guides.ts`
  (dieselbe Erkennung wie der Ratgeber, `mentionsEnergyOrMacroGrams` – eine Quelle) entfernt Sätze mit kcal/kJ oder
  Makro-Gramm bzw. -Prozent. Im **PDF immer** (keine Nährwerte je Rezept; die Menge gilt für das Grundrezept, nicht für
  „× 1,5“), in der **App-Rezeptansicht** bei „Zahlen aus“ und in Schwangerschaft/Stillzeit. Tests mit den echten
  Formulierungen („fast 30 g Eiweiß“, „über 100 g Kohlenhydrate“, „über 30 g Eiweiß bei wenig Kalorien“) in core und
  `packages/content/src/import/description-amounts.test.ts` (liest jede Beschreibung aus `seed/alpha5-rezepte.json`,
  die Datei bleibt unverändert: nach dem Filter keine Energie-Zahl und keine Makro-Menge mehr). „viel Eiweiß bei wenig
  Kalorien“ **ohne Menge** bleibt stehen – das ist keine Zahl, sondern eine Frage der Health-Claims-Prüfung (R10).
- **S2** Namensnennung vollständig nach 5.1.1 (CC BY 4.0): in Rezeptansicht und PDF-Fuß gleich, aus
  `nutrientSourcesText` (`lib/nutrition-format.ts`): „Nährwerte: Bundeslebensmittelschlüssel (BLS) 4.0, Max
  Rubner-Institut (CC BY 4.0, creativecommons.org/licenses/by/4.0); umgerechnet und gerundet.“ – Quelle, Version,
  Herausgeber, Lizenz mit Verweis auf den Lizenztext (als Text, kein Link) und Kennzeichnung der Änderungen.
- **K2** `printDocumentSchema` lehnt kcal (`value.kcal`) außerhalb des Essensplans ab (zweite Schutzschicht).
- **K3** Version steht bei der Quelle, nicht beim Institut (siehe S2).
- **K4** Höhen-Schätzung der Legende, der Anleitung und des Produkt-Hinweises nach den gesetzten Teilen.
- **K5** Eigener Dialogtext für die Einkaufsliste („Diese Liste stammt aus einem Plan, der deine Gesundheitsangaben
  berücksichtigt …“).
- **K6** Abschnitt 11 (K4-Ausnahme) und 12.1 „PDF (K4)“ nennen die Weglass-Hinweise ausdrücklich.

Nur dokumentiert:

- **K1 Restsignal `no_targets`:** Im Modus `no_targets` steht überall „× 1“ und es gibt keine Zeile „Tagessumme“. Das
  lässt sich nicht eindeutig einer Schwangerschaft zuordnen (entsteht auch ohne Einwilligung bzw. ohne Körperdaten,
  `eligibility.ts`) und bleibt so.
- **K7 „Enthält: …“ im PDF:** Allergen-Gruppen der Rezepte sind keine personenbezogenen Daten und wären auf Papier ein
  Sicherheitsgewinn (Kochen für Gäste) – vorgemerkt für eine spätere Etappe, nicht in N6.

### N9 – Zutaten-Austausch (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie 19.7 N9 (Prompt D, KONZEPT 6.9): gratis, rein regelbasiert – keine Echtzeit-KI. Die Austausch-Tabelle
entsteht offline über die Content-Pipeline und wird über `content-review` freigegeben; zur Laufzeit entscheiden nur feste
Regeln in `packages/core`. Nur Testmodus; Supabase-Modus bis N7 unverändert (Tabelle `ingredient_substitutions`,
`save_meal_plan`-Prüfung S7 und pgTAP kommen mit N7).

1. **Inhalte** (`packages/core/src/content/`):
   - `substitution-schema.ts`: neue Art `ingredient_substitution` (`content/substitutions/<id>.json`, Zod strikt):
     `food_id`, `substitute_food_id` (≠), `factor` 0,2–5 (auf die **Masse**: Gramm Ersatz = Gramm Original × Faktor),
     `role` (19.4), `note_de` (5–200 Zeichen), `meta`. Feste ID `tausch-<zutat>-zu-<ersatz>` (über 80 Zeichen:
     `tausch-<16 Hex>`), `ROLE_MEASURE_DE`, `INGREDIENT_ROLE_LABELS_DE`. Konstante `INGREDIENT_SUBSTITUTION_LIMITS`
     (Faktor, ±10 %, Hinweis-Länge, höchstens 20 Tausche je Mahlzeit; PRODUKTENTSCHEIDUNG aus 19.4/19.7, keine
     Schutzgrenze).
   - `substitution-checks.ts`: **R23 (rot)** beide Lebensmittel existieren, nicht zurückgezogen, katalog-geprüft (R19),
     freigegebener Eintrag nur mit freigegebenen Lebensmitteln, kein Alkohol (R12), Faktor hält die **Messgröße der
     Rolle ±10 %** (Eiweiß/Kohlenhydrate/Fett in g, Gemüse = Masse, Original ohne diese Messgröße → Rolle passt nicht;
     Würze ohne Prüfung), dasselbe Paar (gleiche Rolle) nur einmal; **R10** Hinweis-Text (Heil-/Gesundheitsversprechen,
     Marken); **R23H (gelb)** Rolle Süße – menschlich prüfen.
   - `validateContent` (Ergebnis `substitutions`), `selectNutritionContent` (`NutritionLibrary.substitutions`: Status,
     roter Befund, Probelauf, **beide Lebensmittel ausgewählt**), `planNutritionRelease` (Freigabe per ID: nur ohne
     roten Befund im Stand danach), `servingAmountFindings` (R11 als eine Regel für `checkRecipe` und den Tausch).
2. **Core** (`packages/core/src/nutrition/`):
   - `swap-resolve.ts`: `resolveIngredientSwap(s)` – der Plan speichert nur „Zutat i: Lebensmittel → Ersatz“
     (`IngredientSwapRef`); Menge, Einheit und `heated` kommen **immer** aus Tabelle und Rezept (Gerätespeicher kann
     nichts unterschieben). Nur Zutaten **mit Rolle** und Einträge mit genau dieser Rolle. Einheit: Ei in ganzen Stück
     (Stückgewicht), sonst die Rezept-Einheit, wenn sie für den Ersatz umrechenbar ist (nicht Stück), sonst Gramm.
     **B2 mit Wächter N9 B1:** Ein Ersatz, der erhitzt werden muss, ist nur gültig, wenn das Rezept gekocht wird (nicht
     `no_cook`) und das Original ausdrücklich `heated: true` hat (ohne Import-Annahme an dieser Zutat) – für alle
     Personen; dann übernimmt er `heated: true`. Sonst wird er nicht angeboten (siehe Wächter-Prüfung unten).
   - `recipe-nutrients.ts` (`swaps`), `filter.ts` (`filterRecipe(…, swaps)`): das **geänderte Rezept** läuft durch den
     kompletten Filter; eine getauschte Zutat wird nie weggelassen oder ersetzt (verletzt sie etwas, passt das Rezept
     nicht). **Import-Annahmen (N2d):** Der Fingerabdruck wird immer am unveränderten Rezept gebildet; hängt an der
     getauschten Zutat eine Annahme „erhitzt“, gilt sie für den Ersatz als **unbestätigt** (die Bestätigung galt dem
     Original-Lebensmittel) → `unconfirmed_heated` (sichere Richtung).
   - `scale.ts` (getauschte Zutat mit `originalFoodId` und `swapped: true`), `meal-prep.ts` (Haltbarkeit mit den
     tatsächlichen Zutaten), `meal-plan.ts` (`PlannedMeal.ingredientSwaps`, `CandidatePool` mit Tabelle,
     `variantForMeal` vergleicht die Tausche), `replan.ts` und `meal-plan-store.ts` (`mealPlanMatchesRecipes` prüft jeden
     Tausch gegen die Tabelle; Schema: `ingredientSwaps` optional, ältere Pläne bleiben gültig, Engine-Version
     unverändert), `meal-plan-payload.ts` (**S7:** `ingredient_swaps` je Mahlzeit, ohne Mengen).
   - `substitute.ts`: `ingredientSwapOptions` (nur sichere Alternativen, nach Namen; „Original“ zuerst, wenn getauscht;
     nicht angebotene **ohne Grund**), `applyIngredientSwap` (Ergebnis Plan oder Grund `past_day`, `not_found`,
     `already_cooked`, `no_role`, `not_offered`, `excluded`, `amounts`, `above_ceiling`, `replan_needed`),
     `ingredientSwapPossible`, `recipeVariantForMeal` (Rezeptansicht mit den Tauschen). Ablauf: Filter an **jedem** Tag
     des Gerichts (Schwangerschaft an einem Tag genügt) → R11 → Haltbarkeit neu (`mealPrepKeeping`, R9) für **alle
     Portionen desselben Kochtags** (fridge, sonst einfrieren nur bei einfrierbar, sonst frisch; bisher eingefroren
     bleibt eingefroren) → jeder betroffene Tag mit `finishDay` ohne Streichen (Ausgleich über die anderen Mahlzeiten
     und Ergänzungs-Snacks, `no_targets` Faktor 1) → über der Obergrenze **kein Tausch** (S1), unter der Untergrenze
     `below_floor` mit Hinweis. Vergangene Tage ändern sich nie. Kochtag vorbei (`cookDate` < heute) → kein Tausch für
     vorgekochte Portionen. Schutzgrenzen nur über das Planband (`clampCalorieTarget`); **Strukturtest K2** um
     `substitute.ts`/`swap-resolve.ts` erweitert.
   - Beispiel-Bestand (`demo-nutrition.ts`): `DEMO_SUBSTITUTIONS` (13 Einträge mit Testwerten, R23 grün, Süße gelb) und
     `DEMO_INGREDIENT_ROLES`/`withDemoRoles` (Rollen nur im Beispiel-Bestand; Rezepte mit Import-Annahmen ohne Rollen,
     sonst änderte sich ihr Fingerabdruck).
3. **Content-Pipeline** (`packages/content`): Batch-Art `kinds/ingredient-substitution.ts` (Workflow-Eingabe
   `ingredient-substitutions`): je katalog-geprüftem Lebensmittel eine Anfrage, Antwort bis zu 4 Alternativen mit
   **Structured Output nur aus Katalog-IDs** (ohne das Original, ohne Alkohol), Rollen aus 19.4, Faktor 0,2–5; Auswahl
   nach Abteilung; übersprungen, wenn es für das Lebensmittel schon einen Eintrag gibt. Eine Antwort kann mehrere
   Dateien ergeben (`toContents`, alle Arten). `content-collect`, Merkdatei, `content:validate` (R23), `content-review`
   (Art `ids`) und `scripts/bundle-content.mjs` kennen den Ordner `substitutions`. Probelauf ohne Schlüssel (zwei
   gültige, ein ungültiger Faktor, eine Ablehnung).
4. **Redaktionsbereich** (`apps/web`): neue Seite **`/admin/austausch`** (nur ansehen: Paar, Rolle mit Messgröße,
   Faktor, Hinweis, Prüfbericht R23, Klick-Schritte „Freigabe per ID“), Bereich „Austausch“ in der Navigation.
5. **App** (`apps/mobile`, Testmodus): Rezeptansicht aus dem Essensplan: Knopf **„Austauschen“** je Zutat mit Rolle (nur
   laufende/nächste Woche, ab heute, nicht für vorgekochte Portionen); getauschte Zutat „… statt … (ausgetauscht)“ mit dem
   Hinweis aus der Tabelle; „Enthält: …“ und Haltbarkeit aus dem getauschten Rezept (`recipeVariantForMeal`). Neuer
   Bildschirm **`rezept/austauschen.tsx`**: Zutat und Rolle, Alternativen mit Menge in der Portion, Hinweis,
   „Mahlzeit danach: … kcal“ (nur mit Zahlen), Hinweis bei `below_floor` und bei mehreren Tagen eines Kochtags,
   „Nehmen“ (speichert Plan **und** Einkaufsliste in einem Schritt, W22), „Original aus dem Rezept“; Lade-, Fehler-,
   Leer-, Sperr- (Einwilligung) und „nicht änderbar“-Zustände. `MealPlanEngineInput.substitutions`, Export
   `meal_plan_items.ingredient_swaps`. Texte in `i18n/de-nutrition.ts`.
6. **Tests:** Core `n9-substitute.test.ts` (63, davon 36 Profile im Eigenschaftstest **„Austausch liefert nie etwas, das
   filter.ts ausschließt“** mit eigener Erwartungsregel `usedFoodViolations` – Ernährungsform, Schwein inkl.
   `eats_pork = null`, Unverträglichkeit, „mag ich nicht“, Schwangerschaft inkl. B2 – und „nie über der Obergrenze,
   unter der Untergrenze nur `below_floor`, Faktoren 0,5–2,0, `no_targets` = 1, vergangene Tage unverändert“; dazu
   Auflösen/Einheiten, Allergene und Nährwerte neu, **B2-Tests** „Tofu → Hähnchen im Meal-Prep-Plan → ab Tag 2
   eingefroren bzw. frisch“, „pflanzlich → Ei ohne `heated` ⇒ `pregnancy_caution`“, „Kochtag vorbei → kein Tausch“,
   Import-Annahmen, Obergrenze, gespeicherter Plan/Manipulation, Schwangerschaft später → Neuplanung, Einkaufsliste,
   Payload), `substitution-checks.test.ts` (12: Schema, R23/R10/R23H, Auswahl, Freigabe), Strukturtest K2, Regeltabelle.
   Gegenprobe: `heated`-Regel B2 absichtlich falsch → 8 Tests rot (auch der Eigenschaftstest). Content: Schema/Prompt-
   Tests der neuen Art, Probelauf Ende-zu-Ende generate → collect. Web: Render-Test `/admin/austausch`, E2E Login-Schutz
   und Leerzustand. App-Vitest `nutrition-n9.test.ts` (7), Playwright `e2e/nutrition-ingredient-swap.spec.ts` (2:
   Austausch ohne Netz, nach Neuladen, Einkaufsliste, zurücknehmen, „Zahlen aus“ → keine kcal; Kochtag vorbei → kein
   Knopf, direkter Aufruf gesperrt).

**Abweichungen / Präzisierungen (zur Wächter-Prüfung):**

- **Nur aus dem Essensplan:** Getauscht wird eine geplante Mahlzeit (Tag + Platz). Rezeptsuche und Portionswähler ohne
  Plan bieten keinen Austausch an – 19.7 beschreibt den Tausch mit Tagesausgleich, Kochtag und Einkaufsliste des Plans.
- **Ergänzungs-Snacks** werden nicht getauscht (sie werden bei jedem Ausgleich neu gewählt).
- **Meal-Prep:** Der Tausch gilt für alle Portionen desselben Kochtags (es ist dasselbe gekochte Gericht). „Kochtag
  vorbei“ = Kochtag vor heute; am Kochtag selbst ist der Tausch nur möglich, solange der Kochtag-Timer nicht gestartet
  wurde (Wächter N9 K1).
- **Untergrenze:** siehe Wächter N9 S2/S3 unten (sichere Voreinstellung, offene Gründer-Entscheidung).
- **R11:** strikt nach dem Tausch; das Zurücknehmen prüft R11 nicht (es gilt das freigegebene Rezept).
- **Einheit des Ersatzes** wie oben (Ei ganz, sonst Rezept-Einheit, sonst Gramm); „Faktor auf die Masse“ ist die
  Auslegung von „Faktor 0,2–5“ (19.7) zusammen mit „Gemüse = Masse (Faktor 1 ±10 %)“ (19.4).
- **Neuplanung:** „Andere Vorschläge“, „Plan aktualisieren“ und die automatische Neuplanung (6.6) ersetzen getauschte
  Mahlzeiten ab heute wie beim „Rezept tauschen“. Ein Tausch selbst löst keine Neuplanung aus (`variantForMeal`
  vergleicht die Tausche, `needsAutomaticReplan` filtert mit ihnen).
- **Gesundheitsbezug:** siehe Wächter N9 S5 unten. Im PDF erscheint ein Tausch wie ein Ersatzprodukt („… statt …“).
- **Admin-Seite `/admin/austausch`** zusätzlich (19.7 nennt „Freigabe über content-review/Admin“; der Admin schreibt nicht).
- **Gelbes R23H** (Süße) blockiert die Freigabe nicht (wie andere gelbe Hinweise, steht im PR-Prüfbericht).
- **Nicht in N9:** Tabelle `ingredient_substitutions` mit RLS, `save_meal_plan`-Prüfung S7 und pgTAP (N7); echte
  Einträge (brauchen den katalog-geprüften Lebensmittel-Katalog aus `foods-import` und Rollen an den Rezepten, die beim
  Import nur vorgeschlagen und bei der Freigabe bestätigt werden).

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Zutaten austauschen“.

**Wächter-Prüfung N9 (14.10.2026): MIT AUFLAGEN** (Bericht `waechter-n9.md`, 1 Blocker). Umgesetzt:

- **B1 (Blocker)** Rohes Fleisch/Ei durch Tausch: Ein Ersatz, der erhitzt werden muss (Ei, Fisch, Krebs-/Weichtiere,
  Fleisch, Rohmilch), wird nur aufgelöst/angeboten, wenn das Rezept nicht `no_cook` ist **und** das Original
  ausdrücklich `heated: true` hat – ohne Import-Annahme an dieser Zutat (`swapKeepsHeating` in `swap-resolve.ts`) –
  für **alle** Personen, nicht nur in der Schwangerschaft. Regressionstest mit dem Fall aus der Prüfung (kalter
  Tofu-Salat, Mischkost, nicht schwanger → kein Hähnchen, kein Ei), Tests für Tofu ohne bzw. mit `heated: false`, Zutat
  mit Import-Annahme; der Eigenschaftstest prüft die Regel mit einer eigenen Erwartung. **Beispiel-Bestand:** In
  `tofu-paprika` („Tofu und Paprika in Öl braten.“) und `tofu-erdnuss-curry` („Tofu und Paprika anbraten …“) wird der
  Tofu laut Schritten gegart → dort `heated: true` (`DEMO_HEATED_PLANT_FOODS`, nur Beispiel-Bestand). Folge: Tofu → Ei
  bzw. Hähnchen ist dort erhitzt und wird auch in der Schwangerschaft angeboten; Rezepte, deren Tofu nicht gegart wird,
  bekommen diese Alternativen nie. **Für echte Rezepte:** Pflanzliche Zutaten, die gegart werden, brauchen
  `heated: true` (Freigabe-Prüfung), sonst gibt es dort keinen tierischen Ersatz.
- **K5** Gelber Hinweis **R23H** zusätzlich, wenn der Ersatz durchgegart werden muss, das Original nicht („Hinweis soll
  das Durchgaren nennen“).
- **S1** Aufbewahrung nach dem Tausch über **dieselbe Regel** wie `applyMealPrepPlan` (`prepStorageForDay` in
  `meal-prep.ts`: die sicherere Angabe gewinnt, eingefroren nur bei einfrierbar, sonst frisch) und dasselbe
  Werktags-Zeitlimit (`freshCookTooLong`, N3 K1) – muss ein Rest danach an einem Werktag frisch gekocht werden und dauert
  das Rezept zu lange, wird der Tausch nicht angeboten (neuer Grund `prep_time`). Test „eingefroren + nicht einfrierbarer
  Ersatz (Ei) → frisch“ und „Zeitlimit 20 Min. → kein Tausch“.
- **S2/S3** Jede Alternative kennt die betroffenen Tage, die vorher vollständig waren und danach `below_floor` wären
  (`belowFloorDates`, alle Tage eines Kochtags). **Sichere Voreinstellung bis zur Gründer-Entscheidung:** solche
  Alternativen werden ausgeblendet, solange es eine andere gibt, die alle Tage hält; gibt es nur solche, werden sie mit
  Hinweis für **alle** betroffenen Tage angezeigt. „Original aus dem Rezept“ bleibt immer sichtbar. Tests dazu.
- **S4** Eigenschaftstest jetzt 48 Profile, die Hälfte mit „heute“ = Mittwoch (vergangene Tage werden wirklich
  verglichen, Zähler im Test), ein Drittel Meal-Prep (1/2/3/5 Kochtage).
- **S5** Ein Plan mit Tausch ist ein **Gesundheitsdatum**: `usesHealthData = true`, sobald eine Mahlzeit
  `ingredientSwaps` hat (`assembleWeek`; die Einkaufsliste übernimmt das vom Plan). Damit gelten Einwilligung (ohne
  gültige `health_data`-Einwilligung kein Austausch – Knopf und Dialog gesperrt mit Hinweis, Speichern abgelehnt),
  Widerruf (löscht den Plan) und Export wie bei Ersatzprodukten. Wird ein Tausch zurückgenommen, bleibt der Bezug am
  Plan (sichere Richtung, wie N5a S1). **Vormerkung N7:** `save_meal_plan` setzt `uses_health_data = true` bei nicht
  leeren `ingredient_swaps` (am Payload-Schema vermerkt). **Vormerkung N12:** der Hinweis vor dem Weitergeben nennt
  getauschte Zutaten wie Ersatzprodukte.
- **K1** Text „Nur vor dem Kochen tauschen“; ist der Kochtag-Timer gestartet (`cook_day_started_at`), gibt es am
  Kochtag keinen Tausch mehr (`IngredientSwapContext.cookStartedOn`).
- **K2** `recipeVariantForMeal` übernimmt die bei der Mahlzeit weggelassenen optionalen Zutaten (`withMealOmissions`).
- **K4** Leere Antwort der Batch-Art („keine sinnvolle Alternative“) zählt als eigener Grund `no_content` statt
  „ungültig“. Ein Merker, damit das Lebensmittel nicht erneut angefragt wird, ist **nicht** gebaut (nur dokumentiert;
  bei Bedarf als Eintrag in der Merkdatei des Laufs nachziehen).
- **Nur dokumentiert:** **K3** Die Rezeptansicht rechnet die Haltbarkeit nur nach einem Tausch mit den tatsächlichen
  Zutaten, nicht bei einem Ersatzprodukt (vorbestehend). **K6** Anbieterwechsel (Gemini): Batch-Art ist
  anbieterneutral (Zod, Enum mit Katalog-IDs); beim Wechsel prüfen, ob `responseSchema` Enums dieser Größe und strikte
  Objekte abbildet; `maxTokens` „inkl. Denken“ ist Anthropic-spezifisch. **→ Erledigt mit N8 (15.10.2026):** Bei
  Gemini 3 zählt `maxOutputTokens` Denken und Antwort ebenfalls zusammen (Umsetzungsstand N8); das Katalog-Enum steht
  im `responseJsonSchema`, ob Gemini ~236 Werte annimmt, zeigt der erste echte Lauf (Anzahl 3, Wächter N8 H7).

**Wächter N9 Runde 2 (14.10.2026): FREIGABEFÄHIG** (Bericht `waechter-n9-r2.md`). Umgesetzt: **Soll** Zurücknehmen
nach einem Meal-Prep-Tausch bezieht auch Restetage ein, die der Tausch zu „frisch gekocht“ gemacht hat (gleiches Rezept,
Platz, Meal-Prep-Plan und Tausche, nach dem Kochtag) – Test „Tofu → Hähnchen (nicht einfrierbar) → Original → Dienstag
wieder Tofu“; **K-a** `filterRecipe` lehnt auch einen direkt übergebenen Tausch ab, der B1 verletzt (Test; ohne Tausch
unverändert); **K-c** JSDoc in `swap-resolve.ts` richtig zugeordnet. **K-b nur vermerkt:** Die Einwilligungs-Bedingung
für den Tausch steht in der App (`nutrition-plan.ts`), die Server-Prüfung kommt mit N7; Produktfolge für die Gründer:
Der Gratis-Tausch braucht die Art.-9-Einwilligung.

**Offene Gründer-Entscheidung – Austausch und Untergrenze (Wächter N9 S3):** Darf ein Zutaten-Austausch einen vorher
vollständigen Tag unter die Untergrenze drücken (`below_floor`, 19.7 „Ausgleich oder `below_floor`“) – oder gilt wie
beim „Rezept tauschen“ (N3 S3), dass ein vollständiger Tag vollständig bleibt? Umgesetzt ist bis dahin die sichere
Voreinstellung oben (ausblenden, wenn es andere gibt; sonst mit Hinweis für alle betroffenen Tage).

### N10 – Bewertung nach dem Essen (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie 19.7 N10 (Prompt D, KONZEPT 6.10): gratis, rein regelbasiert – keine Echtzeit-KI. Nur Testmodus;
Supabase-Modus bis N7 unverändert (Tabellen `recipe_ratings`/`food_dislikes` mit RLS, Export, Löschung per Kaskade und
pgTAP kommen mit N7, 19.4/19.10).

1. **Core** (`packages/core/src/nutrition/ratings.ts`, Konstanten `RECIPE_RATING_RULES` und `MEAL_PLAN_SCORING.rating*`
   in `constants.ts`, PRODUKTENTSCHEIDUNG):
   - Schema `recipeRatingSchema` (strikt: `recipeId`, `value` `up | down`, `reason` nur bei `down`, `ratedOn`) mit den
     Gründen `taste`, `effort`, `cost`, `satiety` – **„Unverträglich“ ist kein Wert des Schemas**. Die Auswahl der
     Ansicht (`RECIPE_RATING_CHOICES` mit `intolerant`) geht nur über `recipeRatingFromChoice`: „Unverträglich“ →
     Grund `null` + `offerFoodDislikes`; Daumen hoch verwirft Gründe.
   - **Daumen runter:** `recipeBlockedByRating` – gesperrt am Bewertungstag und den 55 Tagen danach
     (`ratingExclusionLastDay` = Bewertungstag + 55), ab Tag 57 wieder; deterministisch, tagesgenau je Plan-Tag.
   - **Gründe** wirken im selben Zeitraum (`activeRatingReasons`): „Zu aufwendig“ → `ratingQuick` für Gesamtzeit ≤ 15
     Min.; „Macht nicht satt“ → `ratingSatiety` × Sättigungs-Kennzahl (`recipeSatietyIndex`: Mittel aus Ballaststoffen je
     100 kcal ÷ 4 und Gramm je kcal ÷ 1,5, je höchstens 1; Bezugswerte VOR LIVEGANG FACHLICH PRÜFEN); „Zu teuer“ →
     `ratingCheaper` × (1 − Kosten ÷ 5 €), nur mit **freigegebener** Schätzung; „Schmeckt mir nicht“ ohne weitere Wirkung.
     **Daumen hoch** → `ratingUp`. Die **Summe** der Boni ist auf `ratingMaxTotal` = 1,25 gedeckelt – strikt unter dem
     Wiederholungs-Abzug (1,5, Wächter N10 S2).
   - **Essensplan** (`meal-plan.ts`): `MealPlanInput.ratings`; `CandidatePool.ratings` – der Filter (`result`/`allowed`)
     kennt die Bewertungen nicht. Abgelehnte Rezepte fallen nur aus den **Vorschlägen**: Plätze (`slotCandidates`),
     Ergänzungs-Snacks, Meal-Prep-Kochtermine (an keinem abgedeckten Tag inkl. Kochtag) und „Rezept tauschen“. Bleibt
     nur wegen Bewertungen kein Kandidat, bleibt der Platz leer mit dem neuen Grund `rated_down` (kein Filter-Grund; der
     gespeicherte Plan kennt ihn). `ratingScoreBonus` geht in `scoreCandidate` ein – nur Reihenfolge.
   - **Meal-Prep-Plan** (`meal-prep-plan.ts`, 19.6 Nr. 8): Ist ein Rezept des Plans an einem seiner Tage (Kochtag bis
     Freitag) abgelehnt, wird der ganze Plan nicht angeboten („Passt nicht zu deinen Angaben“, ohne Grund); ein schon
     gewählter Plan der laufenden Woche bleibt.
   - **`food_dislikes`**: `MealPlanProfile.dislikedFoods` (Standard leer, ältere Profile gültig); `filter.ts` schließt
     ein Lebensmittel aus „mag ich nicht“ je Lebensmittel hart aus (Grund `dislike`, auch in `foodAllowedForPerson`,
     Rezeptsuche, Tausch, Endprüfung über die tatsächlich verwendeten Lebensmittel). Optionale Zutaten werden
     weggelassen; **kein Ersatzprodukt** (Ersatz deckt nur Gruppen ab); ein abgelehntes Ersatzprodukt wird nie gewählt.
     Dialog-Hilfen `foodDislikeChoices` (jede Zutat einmal, ohne schon abgelehnte, nichts vorausgewählt),
     `addFoodDislikes` (leere Auswahl = nichts speichern, Obergrenze 300), `removeFoodDislike`.
   - **Kein Grund ändert Energie, Portionen oder Grenzen (K6):** Das Planband kommt unverändert aus den Zielen
     (`clampCalorieTarget`), der Strukturtest K2 kennt `ratings.ts`.
2. **App** (`apps/mobile`, Testmodus): `UserRows.recipeRatings` (Spalten wie `recipe_ratings`, je Rezept eine Zeile =
   letzte Bewertung) und `UserRows.foodDislikes`; Prüfung beim Laden (`legacy-rows.ts`: strikt, eigenes Konto, keine
   Doppelten, unbekannte Felder/Gründe verworfen); Speichern `saveRecipeRating` (nur mit heutigem Datum),
   `deleteRecipeRatings`, `saveFoodDislikes` (`rating-rows.ts`, Supabase-Modus bis N7 nicht unterstützt); Export
   `recipe_ratings`/`food_dislikes` (`PENDING_DB_EXPORT_TABLES`); „Testdaten löschen“ und Konto löschen entfernen sie.
   Engine-Eingabe: `ratings` und `dislikedFoods` aus den Zeilen (`nutrition-plan.ts`, auch im Fingerabdruck).
   - Rezeptansicht aus dem Essensplan: **„Wie war’s?“** (`components/rating.tsx`) nur ab dem Tag der Mahlzeit; Daumen
     hoch speichert sofort, die eigene Bewertung („bis einschließlich …“) mit „Bewertung zurücknehmen“.
   - Neuer Bildschirm **`rezept/bewerten.tsx`**: Grund (freiwillig) mit Wirkung, „Speichern“; nach „Unverträglich“ der
     Dialog „Zutaten als ‚mag ich nicht‘ übernehmen?“ (Häkchen je Zutat, keins gesetzt, „Übernehmen“/„Nichts
     übernehmen“, Hinweis auf die echte Unverträglichkeit im Profil). „Unverträglich“ lebt nur im Zustand der Ansicht –
     nicht in der Adresse, nicht im Gerätespeicher. Lade-, Fehler-, Leer-, Sperr- und „noch nicht“-Zustände; keine kcal.
   - Neuer Bildschirm **`ernaehrung/abneigungen.tsx`** (Einstellungen → Ernährung → „Abgelehnte Lebensmittel und
     Bewertungen“): „Wieder zulassen“ je Lebensmittel, „Alle Bewertungen löschen“ mit Nachfrage. Texte in
     `i18n/de-nutrition.ts` (`rating`, `foodDislikes`, `emptyReasons.rated_down`).
3. **Tests:** Core `n10-ratings.test.ts` (23): Schema/Datenschutz („Unverträglich“ nie speicherbar, Eigenschaftstest über
   alle Auswahlen), **„8 Wochen genau“** (Tag 56 gesperrt, Tag 57 frei, Jahreswechsel/Schaltjahr; im Plan: Sperre bis
   Dienstag → erst ab Mittwoch, abgelaufen = gleicher Plan wie ohne Bewertung), **„Plan bleibt deterministisch“**
   (gleiche Eingaben, Reihenfolge der Bewertungen egal, leere Liste = bisher), keine automatische Neuplanung durch eine
   Bewertung, „Rezept tauschen“, leerer Platz `rated_down`, Boni je Grund, **Eigenschaftstest K6** (60 Profile mit
   zufälligen Bewertungen und Abneigungen, 1–8 Mahlzeiten, Schwangerschaft/`no_targets`, ohne Einwilligung, Meal-Prep:
   Planband unverändert, Tage im Band, Faktoren 0,5–2,0 bzw. 1, nie ein abgelehntes Rezept an einem gesperrten Tag, nie
   ein Ausschluss aus `filter.ts`, nie ein abgelehntes Lebensmittel), **„`food_dislikes` schließt aus“** (jede Zutat
   jedes Rezepts, ohne Ersatzprodukt, Suche, `foodAllowedForPerson`, Plan, automatische Neuplanung), Dialog ohne
   Vorauswahl, Meal-Prep-Plan mit Daumen runter. Gegenprobe: 8-Wochen-Grenze um einen Tag verschoben → 2 Tests rot;
   Lebensmittel-Abneigung im Filter entfernt → 6 Tests rot. App-Vitest `nutrition-n10.test.ts` (5): **„Grund
   ‚Unverträglich‘ landet nie in `localDb`, Export oder Logs“** (Konsole überwacht; es gibt kein Analytics-Modul in der
   App), manipulierte Gerätespeicher-Zeilen, Datum/Zurücknehmen/Alle löschen, gespeicherter Plan bleibt, Abneigung →
   Neuplanung. Playwright `e2e/nutrition-rating.spec.ts` (2): **„Daumen runter → nicht mehr im Plan“** (laufender Plan
   bleibt, „Andere Vorschläge“ ohne das Rezept, keine kcal, morgen noch nicht bewertbar) und **Dialog ohne
   Vorauswahl** (Grund weder in Adresse noch Gerätespeicher, Abneigung wirkt, wieder zulassen, Bewertungen löschen).
   Datenexport-Test (Tabellenzahl 27) angepasst.

**Präzisierungen (zur Wächter-Prüfung – vom Plan nicht ausdrücklich geregelt):**

- **Bewertung ändert gespeicherte Pläne nicht automatisch** (seit Wächter N10 S1: für noch nicht begonnene Wochen
  Hinweis mit „Plan aktualisieren“) (wie K7 für Meal-Prep-Pläne „die laufende Woche bleibt“, Einkauf ist
  meist erledigt): Sie wirkt ab der nächsten Planung – neue Woche, „Andere Vorschläge“, „Rezept tauschen“, „Plan
  aktualisieren“, automatische Neuplanung (6.6). Der Hinweis dazu steht in der Ansicht. Ein **neues „mag ich nicht“ je
  Lebensmittel** ist dagegen ein harter Ausschluss und plant ab heute automatisch neu (wie Gruppen-Abneigungen).
- **8 Wochen = 56 Tage einschließlich Bewertungstag**; gezählt wird ab dem Bewerten (Datum = heute), nicht ab dem Tag der
  Mahlzeit. Bewertbar ist eine geplante Mahlzeit ab ihrem Tag („nach dem Essen“), aus der Rezeptansicht des Plans.
- **Je Rezept eine Bewertung** (die letzte ersetzt die vorige); Gründe nur bei Daumen runter und nur, solange dessen 8
  Wochen laufen; Daumen hoch gilt, bis er zurückgenommen oder ersetzt wird.
- **Alle Kandidaten abgelehnt** → der Platz bleibt leer (`rated_down`), statt ein abgelehntes Rezept doch zu nehmen
  (die übrigen Mahlzeiten und Ergänzungs-Snacks gleichen wie bei jedem leeren Platz aus).
- **Rezeptsuche** zeigt abgelehnte Rezepte weiter (eigene Suche, kein Vorschlag); `food_dislikes` gelten dort hart.
- **Datenschutz:** Bewertungen und `food_dislikes` gelten wie „mag ich nicht“ (food_preferences ohne Unverträglichkeit)
  **nicht als Gesundheitsdatum** – keine Einwilligung nötig, ein Plan wird dadurch nicht zum Gesundheitsplan, ein
  Widerruf `health_data` löscht sie nicht. Sie sind trotzdem privat: nie angezeigt außer der eigenen Bewertung beim
  Rezept, nie aggregiert, nie in Logs/Analytics, in Export und Löschung. Grund: Der Gesundheitsbezug („Unverträglich“)
  wird nie gespeichert, und `food_dislikes` tragen keinen Grund (19.7 N10). **Vormerkung N7:** RLS nur eigene Zeilen,
  keine Aggregations-Funktion, Löschung per Kaskade, `export_my_data` mit beiden Tabellen, pgTAP „anderer Nutzer sieht
  nichts“, CHECK `reason` ohne Gesundheitsgrund, Unique `(user_id, recipe_id)`.
- **Einstellungs-Bildschirm „Abgelehnte Lebensmittel und Bewertungen“** zusätzlich (sonst ließe sich ein hartes „mag ich
  nicht“ je Lebensmittel nicht mehr zurücknehmen); Bewertungen werden dort nicht aufgelistet, nur gelöscht.
- Konstanten (Bonus-Gewichte, Sättigungs-Bezugswerte, Kosten-Bezugswert 5 €, Obergrenzen 2.000 Bewertungen/300
  Lebensmittel) sind PRODUKTENTSCHEIDUNG ohne Schutzwirkung.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Bewertung nach dem Essen“.

**Wächter-Prüfung N10 (14.10.2026): MERGEFÄHIG MIT AUFLAGEN** (Bericht `waechter-n10.md`, keine Blocker). Umgesetzt:

- **S1** Gespeicherter Plan einer **noch nicht begonnenen** Woche mit einem Rezept, das an seinem Tag wegen Daumen
  runter gesperrt ist: Hinweis „In diesem Plan steht ein Rezept, das du mit Daumen runter bewertet hast“ mit **„Plan
  aktualisieren“** (`mealPlanHasRatedDownRecipes` in `ratings.ts`, `MealPlanState.ratedDownSuggested`) – keine
  automatische Neuplanung; die laufende Woche bleibt wie bisher. Texte ehrlich: Die Sperre gilt „bei neuen Planungen“;
  gespeicherte Pläne ändern sich nur über „Andere Vorschläge“ bzw. „Plan aktualisieren“. Tests: Core (nur vor
  Wochenbeginn, nur gesperrte Tage, abgelaufen/Daumen hoch/fremdes Rezept nein, „Plan aktualisieren“ entfernt das Rezept),
  App (nächste Woche gespeichert → Hinweis, Plan unverändert; laufende Woche nie).
- **S2** Gesamtbonus gedeckelt (`MEAL_PLAN_SCORING.ratingMaxTotal` = 1,25 < `repeat` 1,5); Test „alle Boni zusammen =
  Deckel < repeat“ und über alle Fixture-Rezepte.
- **S3** Sperrfenster je Bewertung beim Aufbau des Index vorberechnet (`downByRecipe`), wirkende Gründe je Tag einmal
  (`scoreArgs`, gemerkt im Index). Ergebnisse unverändert (alle Tests, Determinismus; Test „2.000 Bewertungen = gleicher
  Plan wie die wirksamen allein“). Messung (19 Rezepte, eine Woche): ohne Bewertungen ca. 13 ms, mit 2.000 ca. 24 ms
  (vorher 76 → 705 ms laut Bericht); der Rest ist die Zod-Prüfung der 2.000 Zeilen.
- **S4** Dialogtext: „‚Mag ich nicht‘ schließt nur genau diese Lebensmittel aus – keine verwandten Produkte … und keine
  Spuren. Bei einer Allergie oder Unverträglichkeit trage sie bitte im Profil … ein“ (Warnhinweis) plus Knopf
  „Allergien und Unverträglichkeiten im Profil eintragen“ (`/onboarding/nutrition?edit=1`); Playwright prüft beides.
- **H1** Daumen-hoch-Test verschärft: je Rezept und für drei Ernährungsformen nie seltener als ohne Bewertung, in Summe
  häufiger. Gegenprobe `ratingUp = −1` → Test rot.
- **H4** Volle Liste (2.000): verständliche Meldung „Lösche zuerst Bewertungen …“ (`recipeRatingLimitReached`, Ändern
  einer vorhandenen Bewertung geht weiter). **Nichts wird automatisch aufgeräumt** (G3).
- **H7** Einstellungs-Bildschirm zeigt beim Laden „…“ statt der rohen Lebensmittel-ID.
- **H8** Vormerkungen für N7 bei der Etappe N7 (13) ergänzt.
- **Nur vermerkt:** H2 (Konto-Prüfung ohne Profil, gleiches Muster wie Pläne/Listen), H3 (`rated_on` in der Zukunft
  wirkt nur in die sichere Richtung), H5 (nach „Übernehmen“ verschwindet das gegessene Gericht aus dem heutigen Plan –
  hängt an G1), H6 (Datumswechsel um Mitternacht, zweiter Versuch klappt).

**Offen für die Gründer (Wächter N10, nicht umgesetzt):**

- **G1** Nach „Unverträglich“ ein Angebot „In dieser Woche ersetzen“ für die restlichen Tage? (Und: soll Daumen runter
  gespeicherte Pläne kommender Wochen nur per Hinweis – wie jetzt – oder anders betreffen?)
- **G2** Alle passenden Rezepte eines Platzes abgelehnt: leerer Platz für 8 Wochen (jetzt) oder Rückfall auf das am
  längsten abgelehnte Rezept mit Hinweis?
- **G3** Aufbewahrung: abgelaufene Daumen-runter-Bewertungen löschen, behalten (jetzt) oder nach Frist löschen? Daumen
  hoch gilt unbefristet; bei 2.000 Bewertungen ist Schluss (Meldung, H4).
- **G4** Reichweite der Gründe: Ein „Zu teuer“/„Zu aufwendig“ ändert 8 Wochen die Reihenfolge **aller** Vorschläge
  (jetzt) – oder nur innerhalb derselben Mahlzeit-Art/Kategorie?
- **G5** Grund-Lebensmittel (Salz, Öl, Wasser, Gewürze) im Dialog anbieten (jetzt), ausblenden oder mit Hinweis „schließt
  X % der Rezepte aus“?
- **G6** Bestätigen (Datenschutz/DSFA), dass Bewertungen und `food_dislikes` nicht unter Art. 9 fallen (keine
  Einwilligung, bleiben beim Widerruf `health_data`).

### N11 – Kühlschrank-Suche und Packungsgrößen (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie 19.7 N11 (Prompt D, KONZEPT 6.11): gratis, rein regelbasiert – keine Echtzeit-KI. Packungsgrößen entstehen
offline über die Content-Pipeline und werden über `content-review` freigegeben. Nur Testmodus; Supabase-Modus bis N7
unverändert (Spalte `foods.package_size_g` mit N7, Vormerkung bei der Etappe N7 in 13).

1. **Inhalte** (`packages/core/src/content/`):
   - `package-size-schema.ts`: neue Art `package_size` (`content/package-sizes/<id>.json`, Zod strikt): `food_id`,
     `package_size_g` (ganze Gramm, **1–5.000 g** = Plausibilität aus 19.7, Schema R1, rot auch bei Entwürfen), `meta`.
     Feste ID `packung-<lebensmittel>` (über 80 Zeichen: `packung-<16 Hex>`). Konstante `PACKAGE_SIZE_LIMITS`.
   - `package-size-checks.ts`: **R24 (rot)** Lebensmittel existiert, nicht zurückgezogen, katalog-geprüft (R19),
     freigegebener Eintrag nur mit freigegebenem Lebensmittel, **Packung nicht kleiner als ein Stück** (`units.piece_g`),
     je Lebensmittel nur ein (nicht zurückgezogener) Eintrag, ID = `packung-<lebensmittel>` (Wächter N11 H6); `packageSizeLookup` für N13/N14.
   - `validateContent` (Ergebnis `packageSizes`), `selectNutritionContent` (`NutritionLibrary.packageSizes`: Status,
     roter Befund, Probelauf, Lebensmittel ausgewählt), `planNutritionRelease` (Freigabe per ID: nur ohne roten Befund
     im Stand danach), Regeltabelle (`R24`), Beispiel-Bestand `DEMO_PACKAGE_SIZES` (6 Einträge mit Testwerten).
2. **Core** `packages/core/src/nutrition/fridge-search.ts` (Konstante `FRIDGE_SEARCH` in `constants.ts`):
   - `searchFridge(input, { foodIds })`: **zuerst** dieselben harten Filter wie die Rezeptsuche – jedes Rezept über
     `recipeForPersonWithDiets` (= `filter.ts`) mit der **Ernährungsform des Profils**; Schwein, Unverträglichkeiten,
     „mag ich nicht“ (Gruppe und Lebensmittel), `pregnancy_caution`, Status/Katalog unverändert. **Danach**
     Übereinstimmung = Anteil der vorhandenen Zutaten, **gewichtet nach Menge in Gramm**; Vorrat (`pantry`) und Gewürze
     (Abteilung „Gewürze & Backzutaten“) zählen mit `minorWeight` = 0,1 ihrer Menge; verglichen wird das tatsächlich
     verwendete Lebensmittel (Ersatzprodukt statt Original); optionale Zutaten zählen nicht. Gelistet nur mit
     mindestens einer vorhandenen Zutat, die **kein Gewürz** ist. Sortierung stabil: Übereinstimmung (auf 6 Stellen),
     weniger fehlende Hauptzutaten, Titel, ID. Leere Auswahl → keine Treffer. Treffer mit `have`, `missing`
     (Hauptzutaten), `missingMinor` (Vorrat/Gewürze).
   - `fridgeSearchFoodOptions`: Auswahlliste nur aus Lebensmitteln, die in einem für die Person passenden Rezept (nicht
     optional) verwendet werden – ausgeschlossene Lebensmittel erscheinen nie; nach Abteilung (5.5), dann Name.
   - `fridgeSearchQuerySchema` (Zod strikt, Katalog-ID-Format, höchstens 100, Doppelte zählen einmal),
     `fridgeMatchPercent` (abgerundet: 100 % nur bei vollständiger Übereinstimmung), `isMinorFridgeFood`,
     `isSeasoningFood`. Strukturtest K2 kennt `fridge-search.ts` (keine eigenen Grenzen).
3. **Content-Pipeline** (`packages/content`): Batch-Art `kinds/package-size.ts` (Workflow-Eingabe `package-sizes`): je
   katalog-geprüftem Lebensmittel ohne Alkohol eine Anfrage, Antwort `package_size_g` in ganzen Gramm oder `null`
   (= keine sinnvolle Angabe → `no_content`), Prompt „kleinste übliche Kaufeinheit im DACH-Handel“, keine Marken;
   übersprungen, wenn es schon einen Eintrag gibt. `PIPELINE_FOLDERS`, Merkdatei, `content:validate` (R24, Zählzeile),
   `content-review` (Art `ids`, Bezeichnung „Packungsgröße“) und `scripts/bundle-content.mjs` kennen
   `package-sizes`. Probelauf ohne Schlüssel (eine gültige, eine über 5.000 g, eine Ablehnung). Workflow
   `content-generate.yml` mit Option `package-sizes`; SETUP 2 ergänzt.
4. **Redaktionsbereich** (`apps/web`): neue Seite **`/admin/packungen`** (nur ansehen: Lebensmittel mit Gramm, ID,
   Status, Prüfbericht R24, Klick-Schritte „Freigabe per ID“), Bereich „Packungen“ in der Navigation.
5. **App** (`apps/mobile`, Testmodus): neuer Bildschirm **`rezepte/kuehlschrank.tsx` „Was habe ich da?“** (Knopf in der
   Tagesansicht und in der Rezeptsuche): Zutaten nach Abteilung als Häkchen mit Suchfeld, „Auswahl leeren“, Hinweis
   „Deine Auswahl wird nicht gespeichert“, Karten mit „… % passt“, „Hast du: …“, „Fehlt noch: …“ (höchstens 6, Rest
   „und N weitere“), „Aus dem Vorrat: …“, Zeit, kcal je Portion **nur mit Zahlen**, „Entwurf“; über der Liste die
   Allergen-Warnung für Entwürfe (19.8 Nr. 9). Zustände: Laden, Fehler, Sperre ohne Einwilligung, unvollständig, keine
   Rezepte, keine Zutaten für die Person, nichts ausgewählt, nur Gewürze, kein Treffer, Höchstzahl. Karte → Rezeptansicht
   wie aus der Rezeptsuche (Profil-Ernährungsform). Daten: `data/fridge-search.ts` (`fridgeSearchForPerson`: Profil wie
   Essensplan/Rezeptsuche, Schwangerschafts-Ausschluss wie die Woche, veraltete Auswahl fällt still weg). Texte in
   `i18n/de-nutrition.ts` (`fridge`).
6. **Tests:** Core `n11-fridge-search.test.ts` (14, nach der Wächter-Prüfung 16): **keine Zutat**, **alle Zutaten** (100 %, ganz oben), **nur
   Gewürze** (keine Treffer, mit Hauptzutat wieder), Gewichtung unabhängig nachgerechnet (Hähnchen vs. Reis),
   optionale Zutaten, Ersatzprodukt (laktosefrei), stabile Sortierung (Eingabe umgedreht = gleiches Ergebnis,
   Gleichstand nach Titel), Prozent-Rundung, **Ausschlüsse wirken** (vegan nicht erweitert, Erdnuss, Pilze, Lebensmittel
   „mag ich nicht“, Schwein unbekannt, Schwangerschaft) und **Eigenschaftstest „nie ein Rezept, das `filter.ts`
   ausschließt; nie ein ausgeschlossenes Lebensmittel“** (120 Profile, Orakel `usedFoodViolations`, Auswahl absichtlich
   mit ausgeschlossenen Lebensmitteln), Grenzfälle (Rezept nur aus Gewürzen, leerer Bestand, Auswahlliste).
   `package-size-checks.test.ts` (11, nach der Wächter-Prüfung 12: Schema 0/1/5.000/5.001/Komma, feste ID, R24 je Regel, Bibliothek, Beispiel-Bestand,
   Auswahl, Freigabe per ID); Regeltabelle (R24 rot). Content: Schema-/Prompt-Tests der Art, Probelauf Ende-zu-Ende
   generate → collect → Pull Request. Web: Render-Test `/admin/packungen`, E2E Login-Schutz und Leerzustand. App-Vitest
   `nutrition-n11.test.ts` (6, nach der Wächter-Prüfung 7: Eigenschaftstest über 8 Personen mit allen Zutaten ausgewählt, feste Fälle, Karten,
   leere/Gewürz-/veraltete Auswahl, Sperre ohne Einwilligung, **„Auswahl nicht gespeichert und nicht geloggt“**).
   Playwright `e2e/nutrition-fridge.spec.ts` (2: Auswahl ohne Fleisch/Pilze, nur Gewürze, 100 %, Allergen-Warnung,
   Suchfeld, **Gerätespeicher vor und nach der Auswahl gleich**, Adresse ohne Auswahl, nach Neuladen leer, „Zahlen aus“
   → keine kcal; vegan + Erdnuss + schwanger: Erdnüsse/Räucherlachs/Ei/Milch nicht in der Auswahl, kein Erdnuss-Rezept).
   Gegenproben siehe unten.

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **Packungsgrößen als eigene Inhaltsart statt Feld in `content/foods/`:** 19.4 nennt „Zutat `package_size_g?` …
  `meta.package_size_reviewed_*`“. `content/foods/` darf aber nur der Workflow `foods-import` schreiben (S3,
  `sources-integrity` prüft jeden Commit dort) – ein Batch-Vorschlag oder eine Freigabe in diesen Dateien wäre rot bzw.
  müsste die Herkunftsprüfung aufweichen. Deshalb `content/package-sizes/` wie die Austausch-Tabelle (N9); Status und
  `meta.reviewed_by/at` des Eintrags entsprechen dem geplanten `package_size_reviewed_*`. Mit N7 wird daraus die Spalte
  an `foods` (oder eine eigene Inhaltstabelle) – nur freigegebene Einträge, über `seed_content()`.
- **Plausibilität:** 1–5.000 g als ganze Gramm im Schema (R1); zusätzlich rot, wenn die Packung kleiner als ein Stück
  wäre. „Packung“ = kleinste übliche Kaufeinheit (bei Stückware ein Stück bzw. Netz/Schale) – so passt sie zur
  Resteplanung (N13).
- **Wofür N11 die Packungsgröße nutzt:** noch nicht in der App. „Einkaufsliste auf Packungen aufrunden (N11)“ in 19.7 N13
  ist als „mit den Packungsgrößen aus N11“ gelesen – Aufrunden und Anzeige kommen mit N13/N14.
- **Ernährungsform nicht erweiterbar:** Die Kühlschrank-Suche nutzt die Ernährungsform des Profils (KONZEPT 6.11
  „gefiltert nach Ernährungsform“); das Erweitern der Rezeptsuche (K3) ist hier nicht übernommen (sichere Richtung, keine
  gekennzeichneten Treffer). Weitere weiche Filter der Rezeptsuche (Kategorie, Zeit, Kosten) gibt es hier nicht.
- **„Vorrat/Gewürze zählen wenig“** = Lebensmittel mit `pantry` oder aus „Gewürze & Backzutaten“ mit einem Zehntel
  ihrer Grammzahl. Reis, Nudeln, Haferflocken oder Dosen sind im Katalog Vorrat und zählen daher wenig, reichen aber
  für einen Treffer; **nur Gewürze/Backzutaten** reichen nie (sonst passte jedes Rezept mit Salz) – Hinweis in der App.
- **Optionale Zutaten** zählen weder als vorhanden noch als fehlend; **Ersatzprodukte** zählen als das tatsächlich
  verwendete Lebensmittel (bei Laktose-Unverträglichkeit passt „laktosefreie Milch“, nicht „Vollmilch“).
- **Auswahlliste** nur aus Lebensmitteln passender Rezepte – Ausgeschlossenes (Allergene, Ernährungsform,
  „mag ich nicht“, Schwangerschaft) wird gar nicht angeboten; eine veraltete Auswahl nach einer Profiländerung fällt
  still weg. Höchstens 100 Zutaten (`FRIDGE_SEARCH.maxSelectedFoods`, Bedienschutz).
- **Bewertungen** (Daumen runter) wirken hier nicht – wie in der Rezeptsuche (eigene Suche, kein Vorschlag);
  `food_dislikes` wirken hart.
- **Auswahl nicht gespeichert:** nur im Zustand der Ansicht (nicht in Adresse, Gerätespeicher, Export, Logs); nach
  Verlassen oder Neuladen leer. Damit entsteht kein neues Gesundheitsdatum; angezeigt wird nur, was die Person ohnehin
  sehen darf (Treffer nach ihrem Profil, Unverträglichkeiten nur mit gültiger Einwilligung, sonst gesperrt).
- **Prozent** sind keine Energie- oder Makrozahl und bleiben bei „Zahlen aus“ sichtbar; kcal je Portion nur mit Zahlen.
  Sortiert wird nie nach kcal.
- **Batch-Art:** eine Anfrage je Lebensmittel (wie N9), Antwort `null` erlaubt (z. B. Leitungswasser) → kein Eintrag,
  Grund `no_content`; kein Merker gegen erneute Anfrage (wie N9 K4).
- **Admin-Seite `/admin/packungen`** zusätzlich (KONZEPT 6.11 „im Admin freigegeben“ – der Admin schreibt nicht, die
  Freigabe läuft wie bei N9 über `content-review`, Art `ids`).

**Gegenproben (danach zurückgesetzt):** (1) In `fridge-search.ts` die Ernährungsform um „mit Fleisch“ erweitert
(`recipeForPersonWithDiets(recipe, ctx, ['omnivore'])`) → Core 2 Tests rot (Eigenschaftstest und „vegan nicht
erweitert“), App-Vitest 2 rot (Eigenschaftstest, feste Fälle). (2) Die Regel „nur Gewürze reichen nicht“ entfernt →
Core 2 rot, App 1 rot. (3) Gewichtung „Vorrat/Gewürze ein Zehntel“ entfernt → Core 1 rot, App 1 rot. (4) R24 „kleiner
als ein Stück“ entfernt → 1 rot.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Was habe ich da? – Kühlschrank-Suche“; Packungen im
Redaktionsbereich unter **Packungen**, erzeugen über SETUP 2 (`package-sizes`).

**Wächter-Prüfung N11 (14.10.2026): MIT AUFLAGEN FREIGEBBAR** (Bericht `waechter-n11.md`, 1 Blocker; Sicherheit ohne
Befund – kein Weg zeigt ein Rezept, das `filter.ts` ausschließt). Umgesetzt:

- **B1 (Blocker)** Freigabe-Tests in `package-size-checks.test.ts` und (vorbestehend, N9) `substitution-checks.test.ts`
  mit eigenem Zeitlimit 30 s (volle `validateContent`-Läufe überschritten unter turbo-Last die 5 s; Präzedenz
  `swap-properties.test.ts`).
- **S1** Treffer erst ab **1 %** Übereinstimmung (abgerundet, wie angezeigt; `FRIDGE_SEARCH.minPercent`) – keine Karten
  „0 % passt“, wenn z. B. nur Olivenöl ausgewählt ist. Die Gewichtung selbst bleibt unverändert (G2 offen). Test „nur
  Olivenöl → nichts unter 1 %, Hähnchen-Reis nicht gelistet“.
- **S2** Leistung: Die für die Person gefilterten Rezepte (`fridgeSearchVariants`) und die Auswahlliste rechnet die App
  **einmal** je Profil/Woche/Bestand (`prepareFridgeSearch`, useMemo ohne Auswahl); jedes Antippen rechnet nur noch die
  Übereinstimmung (`fridgeSearchResults`). Die Kartenliste zeigt zuerst 30 Treffer (`FRIDGE_SEARCH.pageSize`), weitere
  über „Mehr anzeigen (noch N)“; kcal je Portion werden nur für angezeigte Karten berechnet. Tests: vorberechnete
  Varianten = gleiche Auswahl und gleiche Treffer (Core), begrenzte Liste = Anfang der vollen Liste, gleiche Gesamtzahl
  (App).
- **S3** Probelauf-Inhalte zählen in der Pipeline nicht als „schon vorhanden“ (`countsAsPresent` in
  `kinds/present.ts`, genutzt von Packungsgrößen **und** der Austausch-Tabelle aus N9). Test für beide Arten.
  **Restgrenze:** Ein versehentlich gemergter Probelauf belegt weiter die Datei-ID (`packung-tofu`); ein echter Lauf
  meldet dann „ID belegt“ im Bericht, statt zu überschreiben. Deshalb SETUP: Probelauf-Pull-Requests nie mergen
  (die Datei ggf. löschen).
- **H6** R24 prüft zusätzlich, dass die ID zum Lebensmittel passt (`packung-<lebensmittel>`); Test.
- **H7** Beispiel-Packung Paprika auf ein Stück (150 g) korrigiert – passend zu „Stückware = ein Stück“.
- **H3** Der E2E-Test vergleicht localStorage **und** sessionStorage vor und nach der Auswahl.
- **Nur vermerkt:** H2 (Auswahlliste lässt auf Ausschlüsse schließen – nur für die Person selbst sichtbar, nichts
  gespeichert; im Partner-Modus P1 nie für die andere Person verwenden), H4 (Sortierung je Plattform stabil, Web und
  App bei Umlauten nicht zeichengleich vergleichen), H5/H8/H9/H10 ohne Befund.

**Offen für die Gründer (N11, nicht umgesetzt – sichere Voreinstellung gilt; Empfehlungen des Wächters):**

- **G1** Soll „Was habe ich da?“ die Ernährungsform wie die Rezeptsuche erweitern können (Treffer gekennzeichnet) –
  jetzt nein? _Empfehlung: nein, so lassen._
- **G2** Gewichtung: Vorrat (Reis, Nudeln, Dosen) zählt wie Gewürze nur ein Zehntel (Plan-Wortlaut) – oder nur
  Gewürze/Öl gering und Vorrat voll? _Empfehlung (Entscheidung nötig): Vorrat mit Kohlenhydrat-Basis (Reis, Nudeln,
  Haferflocken) voll; Gewürze, Öl, Essig, Saucen ein Zehntel und allein nicht ausreichend; unter 1 % nicht zeigen
  (Letzteres ist schon umgesetzt, S1)._
- **G3** Packungsgröße bei Stückware = ein Stück (jetzt im Prompt) – oder übliche Mehrfachpackung (z. B. Paprika 3er)?
  _Empfehlung (Entscheidung nötig, VOR dem ersten echten `package-sizes`-Lauf): die übliche Kaufeinheit im Laden
  (Netz/Schale), wenn Stückware meist so verkauft wird; danach Prompt und Beispielwert anpassen._
- **G4** Mit „Daumen runter“ abgelehnte Rezepte in der Kühlschrank-Suche zeigen (jetzt ja, wie Rezeptsuche) oder
  ausblenden? _Empfehlung: so lassen wie die Rezeptsuche; bitte bestätigen._

### N12 – Einkaufsliste weitergeben (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie 19.7 N12 (Prompt F „Sofort“, KONZEPT 6.13): gratis, rein regelbasiert – keine KI. Nur Testmodus; im
Supabase-Modus zeigt die Ansicht wie Einkaufsliste und PDF „nicht unterstützt“ (bis N7). **Vereinbarkeit mit „Kein
Teilen, keine Community“ (CLAUDE.md) geprüft:** „Weitergeben“ ist laut KONZEPT 6.13 und 18 das **private Weitergeben
durch die Person selbst** an Menschen oder Apps ihrer Wahl (System-Teilen-Dialog bzw. Kopieren) – kein öffentliches
Profil, kein Feed, keine Sichtbarkeit für andere Nutzer, kein Link auf die App, nichts geht an einen Server, nichts wird
gespeichert. Damit liegt es innerhalb der Regel; ein öffentlicher oder app-interner Austausch wurde **nicht** gebaut.

1. **Core** `packages/core/src/nutrition/shopping-list-share.ts` (Konstante `SHOPPING_LIST_SHARE` in `constants.ts`):
   - `shoppingListToText(list, options)` → `{ ok, text, itemCount, omittedForLength }` bzw. `empty` (Liste leer) /
     `nothing_selected` (mit der Auswahl bleibt nichts). Aufbau: „Einkaufsliste TT.MM.JJJJ – TT.MM.JJJJ“, Abteilungen in
     fester Reihenfolge (5.5) mit Zeilen „- 500 g Haferflocken“, „- 3 Stück Bananen“, „- Salz – nach Geschmack“, eigene
     Einträge ohne Menge; am Ende „Vorrat (hast du wahrscheinlich da)“. Deterministisch.
   - **Datenminimierung über das Schema:** Die Eingabe wird mit `z.object` auf Name, Menge, Einheit, Abteilung und die
     Kennzeichen Vorrat/eigen/erledigt/nicht-mehr-im-Plan reduziert; `usesHealthData`, `substituteFor`, `foodId`,
     `itemKey` und Markierungen erreichen den Textaufbau nicht. Keine kcal, keine Gründe, kein Körpergewicht, kein Ziel,
     keine Unverträglichkeit, kein „statt …“, keine Links/Tracking/Affiliate.
   - Optionen `shoppingListShareOptionsSchema` (Zod strikt): `includeChecked` (Standard aus – „Häkchen optional“: mit
     „(erledigt)“), `includePantry` (an), `includeManual` (an). „Nicht mehr im Plan“ steht nie drin (wie im PDF).
   - **Mengen:** `shareAmountText` rundet wie die Liste auf Kaufschritte (`roundShoppingAmount`, idempotent), ganze
     Zahlen mit Tausenderpunkt („1.250 g“); ungültige Mengen (0, negativ, NaN, ∞, über 1.000.000) → ohne Menge, nie
     „0 g“ und nie Exponentialschreibweise. Ungültige Eingaben (Zeitraum endet vor dem Beginn, kaputte Einträge,
     unbekannte Optionen) ergeben `{ ok: false, reason: 'invalid' }` statt eines Wurfs.
   - **Escaping** (`sanitizeShareLabel`, Klartext ohne Auszeichnungssprache): Unicode-NFC (Umlaute einheitlich),
     Steuerzeichen/Zeilenumbrüche → Leerzeichen (eine Zeile je Eintrag, keine eingeschleusten Überschriften),
     **alle** unsichtbaren Zeichen entfernt (ganze Kategorie Cf inkl. Tag-Zeichen U+E0000–E007F, dazu U+034F,
     Hangul-Füller, Variantenwähler; ZWJ und U+FE0E/FE0F nur innerhalb von Emoji-Sequenzen), einzelne Surrogate
     entfernt, Emojis bleiben, Links in eigenen Einträgen ohne Anhang ab „?“/„#“ (auch ohne Wortgrenze),
     `javascript:`/`vbscript:` → „[Link entfernt]“ (keine weitergehende Link-Erkennung: Kurzlinks oder Domains ohne
     Schema bleiben), höchstens 100 Graphem-Cluster je Eintrag (Kürzung ohne halbe Emojis/Flaggen).
   - **Länge:** höchstens 60.000 Zeichen (WhatsApp-Grenze 65.536); darüber ganze Zeilen und sichtbar „… und N weitere
     Einträge (Liste zu lang – nutze das PDF)“ – nie stilles Weglassen.
   - `shoppingListShareNotice(list, options)` → `required`, `usesHealthData`, `substituteLabels`: Hinweis nötig bei
     Gesundheitsbezug der Liste **oder** wenn die gewählte Auswahl Ersatzprodukte/ausgetauschte Zutaten (N9) enthält;
     genannt werden alle Ersatz-Einträge der Auswahl – auch solche, die wegen der Längengrenze gekürzt würden (sichere
     Richtung, Wächter N12 H4; Vormerkung N9 S5). `shoppingListShareNoticeKey` = Schlüssel für „bestätigt“ aus
     Zeitraum, Gesundheitsbezug, Ersatz-Einträgen und Text-Prüfsumme (Wächter N12 S3).
   - **Händler-Modul** `packages/core/src/retail/provider.ts`: `RetailProvider` (nur `official_api`/`partner_program`,
     Kennzeichnung „Anzeige“ im Typ), `RETAIL_PROVIDERS = []`, `RETAIL_INTEGRATION_CONDITIONS` (K5: Einwilligung
     Übermittlung, DSFA, Datenminimierung, offizielle Schnittstelle, „Anzeige“), `retailOrderLines` (nur offene
     Plan-Einträge mit Produktart und Menge – ohne Vorrat, eigene Einträge, Ersatz-Einträge, IDs; Liste aus einem Plan
     mit Gesundheitsbezug → keine Zeilen, bis G7 entschieden ist), `retailIntegrationAvailable` (Flag **und** Händler
     **und** die ausdrücklichen Eingaben Einwilligung, DSFA ergänzt, offizielle Schnittstelle). Flag
     `FEATURE_FLAGS.retail_integration` in `constants.ts` ist aus. Kein Netzwerkaufruf.
2. **App** (`apps/mobile`, Testmodus): Knopf **„Weitergeben“** in der Einkaufsliste → neuer Bildschirm
   **`einkaufsliste/weitergeben.tsx`**: Hinweis zum Inhalt, Auswahl (Erledigte / Vorrat / eigene Einträge), Vorschau des
   **genauen** Texts (markierbar), **„Weitergeben“** (nativ `Share` aus React Native – keine neue native Abhängigkeit;
   Web `navigator.share`), im Web zusätzlich **„Text kopieren“** (`navigator.clipboard`); Rückfall-Kette Teilen →
   Kopieren → „Markiere den Text“ (`lib/share-text.ts`/`.native.ts`). Vor jedem Weitergeben mit Hinweis-Pflicht der Dialog
   **„Bevor du weitergibst“** (Gesundheitsbezug; bei Ersatz/Austausch „Betrifft: …“); bestätigt gilt nur für genau
   diesen Stand während des Besuchs der Ansicht. „Stattdessen als PDF speichern“ → Druckansicht aus N6. Zustände:
   Laden, Fehler (Bestand), nicht unterstützt, Sperre ohne Einwilligung, unvollständig, kein Plan, leere Liste, nichts
   ausgewählt, gekürzt, abgebrochen, kopiert, manuell, Fehler beim Teilen (ohne Details). Händler-Knopf nur, wenn
   `retailIntegrationAvailable` – heute nie. Texte in `i18n/de-nutrition.ts` (`share`). Nichts wird gespeichert
   (Auswahl nur im Ansichtszustand), nichts geloggt, kein Server-Aufruf.
3. **Tests:** Core `n12-share.test.ts` (28): Aufbau (genauer Text, Abteilungs-Reihenfolge, leer/`nothing_selected`,
   Häkchen optional, Vorrat/eigene abwählbar, Optionen strikt, deterministisch), Mengen-Rundung (Kaufschritte,
   Tausenderpunkt, ganze Stück, ungültige Mengen), Escaping (NFC-Umlaute, Emojis mit ZWJ/Hautfarbe, einzelne Surrogate,
   eingeschleuste Zeilen, Bidi/unsichtbar, Markdown bleibt Text, Links ohne Tracking, Kürzung nach Codepunkten), sehr
   lange Liste (300 vollständig; 1.100 → sichtbar gekürzt, ≤ 60.000, nur ganze Zeilen), **keine Gesundheitsdaten**
   (Text identisch bei anderem Gesundheitsbezug/Ersatz-Hinweisen/IDs; kein „statt“, kein Original, keine kcal/Gründe/
   Gewicht/Links; echte Liste aus `buildShoppingList` mit Ersatzprodukt und Austausch), Hinweis (Gesundheitsbezug,
   Ersatz allein, nur ausgewählte Einträge, Abhaken), **Eigenschaftstest** (200 zufällige Listen mit Sonderzeichen:
   jede ausgewählte Zeile genau einmal, ≤ maxChars, NFC, deterministisch; Zeitlimit 30 s), Händler-Modul (Flag aus,
   keine Händler, Bedingungen, Tor, Datenminimierung). Strukturtest K2 kennt `shopping-list-share.ts`. App-Vitest
   `data/nutrition-n12.test.ts` (3: echte Wochen mit Laktose, Gluten+Erdnüsse, Schwangerschaft → keine
   Gesundheitsdaten im Text, Hinweis nennt das Ersatzprodukt, nichts geloggt), `lib/share-text.test.ts` (5: Teilen,
   Abbrechen, ohne API → Kopieren, `canShare` nein/Fehler → Kopieren, ohne Zwischenablage → manuell; kein `fetch`, keine
   Konsole), `lib/share-text.native.test.ts` (3). Playwright `e2e/nutrition-share.spec.ts` (3): Vorschau ohne
   Gesundheitsdaten, Hinweis → Abbrechen gibt nichts weiter → Weiter → `navigator.share` mit genau dem Vorschau-Text,
   zweites Mal ohne Hinweis, Auswahl, **ohne Netz**, Gerätespeicher unverändert, keine fremden Anfragen, **kein
   Händler-Knopf**, „(erledigt)“; Rückfall ohne Web Share API (Kopieren, ohne Zwischenablage „manuell“); nach einem
   Zutaten-Austausch nennt der Hinweis die Einträge, die alle im Text stehen.

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **Inhalt minimal:** Titel mit Zeitraum, Abteilungen, Einträge, Vorrat. **Nicht** im Text: über „Zur Einkaufsliste“
  hinzugefügte Rezept-Titel (im PDF stehen sie), Markierungen („Menge geändert“, „nicht mehr im Plan“, „passt nicht zu
  deiner Ernährungsform“), kein App-Name, kein Link, keine Werbung.
- **„Häkchen optional“** = Auswahl „Erledigte Einträge mitnehmen“, Standard aus (der Text ist zum Einkaufen; das PDF
  druckt Erledigte mit Haken).
- **Mengen in g/ml/Stück:** Flüssigkeiten bleiben in ml wie in der Liste (19.7 nennt „g/Stück“); keine Umrechnung in
  Liter.
- **Eigene Einträge** stehen bereinigt, aber sonst so drin, wie die Person sie geschrieben hat (Hinweis in der Ansicht;
  abwählbar). Was sie selbst hineinschreibt, ist ihre Entscheidung – die App fügt nichts hinzu. Links darin verlieren
  ihren Anhang (Tracking-/Partner-Parameter); `javascript:`-Links werden ersetzt. Eine echte Link-Erkennung gibt es
  bewusst nicht – „ohne Links“ gilt für das, was die App selbst schreibt.
- **Hinweis-Bedingung** = `usesHealthData` der Liste **oder** Ersatzprodukte/ausgetauschte Zutaten im Text („wie K4“
  und Vormerkung N9 S5); „fehlende Zutaten“ (weggelassene optionale) werden im Hinweistext genannt wie beim PDF.
  Bestätigt gilt nur innerhalb der Ansicht und für denselben Stand (Woche, Zeitraum, Gesundheitsbezug,
  Ersatz-Einträge, Text – ändert sich etwas davon, z. B. Wochenwechsel um Mitternacht oder andere Auswahl, erscheint
  der Hinweis erneut); nach Verlassen der Ansicht erneut. Eine offene Anfrage, deren Stand sich ändert, wird
  verworfen (öffnet sich nie ohne neuen Tipp).
- **Android-Rückmeldung:** Android meldet nicht, ob wirklich verschickt wurde – dort steht nur „Teilen-Dialog
  geöffnet.“ (iOS und Web: „Weitergegeben.“ bzw. „Abgebrochen“).
- **Kein eigener Kopieren-Knopf nativ:** React Native hat keine eingebaute Zwischenablage mehr; der System-Teilen-Dialog
  bietet „Kopieren“ selbst an. So kommt keine neue native Abhängigkeit dazu (kein neuer EAS-Build nötig).
- **Feature-Flag als Code-Konstante:** Es gibt noch keine Flag-Verwaltung; das Flag in `constants.ts` lässt sich nur per
  Pull Request einschalten, ein Test hält es aus (Einschalten = bewusste Änderung mit den K5-Bedingungen). Eine
  serverseitige Flag-Verwaltung kommt bei Bedarf mit Phase 7.
- **Daten an Händler (später):** `retailOrderLines` lässt zusätzlich Vorrat, Erledigtes, eigene Einträge (Freitext
  kann alles enthalten) und **Ersatz-Einträge** weg; eine Liste aus einem Plan mit Gesundheitsbezug ergibt gar keine
  Zeilen (sichere Voreinstellung bis G7) – strenger als „nur Produktarten und Mengen“.
- **Länge 60.000 Zeichen** (PRODUKTENTSCHEIDUNG, Begründung in `constants.ts`); reale Listen liegen weit darunter.

**Gegenproben (danach zurückgesetzt; Nachträge zur Wächter-Prüfung unten):** (1) Hinweis ignoriert Ersatzprodukte (`required` nur bei Gesundheitsbezug) →
Core 2 rot. (2) Gesundheitsbezug in die Titelzeile geschrieben (Schema durchlässig gemacht) → Core 1 rot. (3)
Steuerzeichen/Zeilenumbrüche nicht ersetzt → Core 2 rot. (4) Links behalten Tracking-Anhang → Core 1 rot. (5) Keine
Längengrenze → Core 1 rot. (6) Feature-Flag `retail_integration = true` → Core 1 rot. (7) Mengen nicht gerundet →
Core 1 rot.

**EAS-Build: NICHT geprüft** (keine neue native Abhängigkeit; `Share` ist Teil von React Native). **Gründer:** in der
echten App (HANDY-ANLEITUNG Teil 9) Einkaufsliste → Weitergeben → WhatsApp/Notizen prüfen.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Einkaufsliste weitergeben“.

**Wächter-Prüfung N12 (14.10.2026): FREIGABEFÄHIG MIT AUFLAGEN** (Bericht `waechter-n12.md`, kein Blocker; „Kein
Teilen“, Datenminimierung und Hinweis-Auslöser ohne Befund). Umgesetzt:

- **S1** Unsichtbare Zeichen vollständig: ganze Kategorie Cf (Tag-Zeichen U+E0000–E007F, U+00AD, U+180E, U+2061–2064,
  U+206A–206F, U+FFF9–FFFB …) plus U+034F, Hangul-Füller U+115F/1160/3164/FFA0, Khmer U+17B4/17B5, Variantenwähler
  U+FE00–FE0F/U+E0100–E01EF und Mongolisch U+180B–180F; ZWJ nur zwischen Emojis, U+FE0E/FE0F nur nach einem Emoji bzw.
  einer Tastenkappen-Basis. Tests: jede Klasse einzeln, Vollprüfung über **alle** Cf-Codepunkte, Emoji-Sequenzen
  (Familie, Regenbogenflagge, Herz, Tastenkappe, Hautfarbe) bleiben, ZWJ/VS außerhalb fliegen raus,
  `java\u200bscript:` wird erkannt.
- **S2** Android: „Teilen-Dialog geöffnet.“ statt „Weitergegeben.“ (`Share` meldet dort immer „geteilt“); nativer Test
  für den Android-Fall.
- **S3** Bestätigungs-Schlüssel aus Woche, Zeitraum, Gesundheitsbezug, Ersatz-Einträgen und Text
  (`shoppingListShareNoticeKey`); offene Anfrage mit anderem Stand wird verworfen. Tests: Core (Wochenwechsel,
  anderer Zeitraum, andere Menge, andere Auswahl), Playwright (andere Auswahl → Hinweis erneut).
- **S4** App-Tests `nutrition-n12.test.ts` mit Zeitlimit 60 s (wie die Geschwister-Tests).
- **H1** Kürzung nach Graphem-Clustern (`Intl.Segmenter`, sonst Codepunkte); Test Familien-Emoji und Flaggen an der
  Grenze.
- **H2** Doku/Kommentare ehrlich („ohne Links“ = nichts von der App; in eigenen Einträgen nur ohne Tracking-Anhang);
  Anhang auch ohne Wortgrenze entfernt; `javascript:`/`vbscript:` → „[Link entfernt]“. Keine weitergehende
  Link-Erkennung.
- **H4** Sichere Richtung: Der Hinweis nennt alle Ersatz-Einträge der Auswahl, auch gekürzte; Doku angepasst, Test.
- **H5** Zeitraum `from > to` → `invalid`; Mengen über 1.000.000 → ohne Menge (`SHOPPING_LIST_SHARE.maxAmount`), nie
  „1e+21 g“; ungültige Eingaben → `{ ok: false, reason: 'invalid' }` (Ansicht zeigt eine Meldung), der Hinweis wirft
  nie (ungültig → eher ein Hinweis zu viel). Tests.
- **H7** HANDY-ANLEITUNG nur mit Handy-Schritten (Handy-Browser ohne Teilen-Dialog statt Computer-Browser).
- **H8** `retailOrderLines` ohne Ersatz-Einträge und ohne Zeilen bei Plänen mit Gesundheitsbezug;
  `retailIntegrationAvailable` verlangt Einwilligung, DSFA und offizielle Schnittstelle als ausdrückliche Eingaben
  (ohne Standardwert). Tests je fehlender Bedingung.
- **Gegenproben zu den Auflagen (danach zurückgesetzt):** Tag-Zeichen und U+3164 nicht mehr entfernt → Core 2 rot;
  Variantenwähler immer behalten → 2 rot; Schlüssel ohne Zeitraum und Text → 1 rot; Ersatz-Einträge an Händler → 1
  rot; DSFA-Bedingung entfernt → 1 rot; Android meldet „Weitergegeben“ → nativ 1 rot; Mengen-Deckel entfernt → 1 rot.
- **Nur vermerkt:** H3 (WhatsApp formatiert `*…*`/`_…_` – bleibt Text, eine Zeile je Eintrag), H6 (Nutzergeste: der
  Stub prüft sie nicht – Praxistest am Handy, Android-Chrome und iPhone-Safari, bleibt Pflicht-Abnahme), H9 ohne
  Befund.

**Offen für die Gründer (N12, nicht umgesetzt – sichere Voreinstellung gilt; Empfehlungen des Wächters):**

- **G1** Soll der Text eine Zeile „Erstellt mit Alpha5“ (ohne Link) tragen? _Jetzt: nein. Empfehlung: nein
  (Datenminimierung, „Kein Teilen“)._
- **G2** Standard „nur offene Einträge“ (jetzt) oder alles inkl. Erledigter? _Empfehlung: so lassen._
- **G3** Rezept-Titel aus „Zur Einkaufsliste“ in den Text (wie im PDF)? _Jetzt: nein. Empfehlung: so lassen (Titel wie
  „Laktosefreier …“ ließen Rückschlüsse zu)._
- **G4** Hinweis vor jedem Weitergeben (jetzt: je Besuch der Ansicht und Stand) – oder mit „nicht mehr anzeigen“?
  _Empfehlung: so lassen (Art.-9-Bezug)._
- **G5** Flüssigkeiten ab 1.000 ml als Liter („1,25 l“) anzeigen? _Jetzt: ml. Empfehlung: rein kosmetisch, frei
  entscheidbar._
- **G6** Flag-Verwaltung: reicht die Code-Konstante bis zur ersten Händler-Anbindung, oder soll mit Phase 7 eine
  serverseitige Flag-Tabelle kommen? _Empfehlung: Entscheidung mit Phase 7 – für die KI-Funktionen (CLAUDE.md „hinter
  Feature-Flag“, Premium serverseitig) reicht eine Code-Konstante nicht; für `retail_integration` heute schon._
- **G7 (neu, vor dem Einschalten der Händler-Anbindung)** Ersatzprodukt-Namen bzw. Listen aus Plänen mit
  Gesundheitsbezug sind Rückschlüsse nach Art. 9 DSGVO und gingen an einen kommerziellen Dritten. (a) Muss
  `transfer_consent` eine **ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a** sein (getrennt, mit Version)?
  (b) Werden Ersatz-Einträge bzw. Listen mit Gesundheitsbezug von der Übermittlung ausgenommen – oder kommt ein Hinweis
  davor? _Jetzt (sichere Voreinstellung): ausgenommen – Ersatz-Einträge nie, Listen mit Gesundheitsbezug gar nicht.
  Empfehlung des Wächters: vor dem Einschalten ausdrücklich entscheiden; K5 sagt nur „keine Ersatz-Hinweise“, der Name
  des Ersatzprodukts ist aber selbst der Hinweis._

### N13 – Portionsfaktor und Reste-Score (umgesetzt, 14.10.2026, ohne Commit)

Umfang wie 19.7 N13 (Prompt E, nur Logik in `packages/core`, KONZEPT 6.11/6.12): rein regelbasiert – keine KI, keine
App-Oberfläche, nichts gespeichert, keine DB-Änderung. Die Anzeige der Reste und die Packungsangabe kommen mit N14
(Premium), das gemeinsame Kochen mit P1 (Phase 11). Baut auf N9–N12 auf; N12 (PR #66) ist unverändert.

1. **Konstanten** (`constants.ts`, alle PRODUKTENTSCHEIDUNG, Werte aus dem Plan, VOR LIVEGANG FACHLICH PRÜFEN):
   `COUPLE_PORTION_LIMITS` (Faktor 0,6–1,8 innerhalb `PORTION_SCALE_LIMITS`, Beilagen 10 g ab 20 g, höchstens 6
   Personen), `LEFTOVER_RAW_DAYS` (roh tierisch 1 Tag = nur Folgetag, S9; je Abteilung 1–30 Tage mit Begründung,
   Orientierung BfR/Verbraucherzentrale), `LEFTOVER_SCORING` (Bonus höchstens 1 < `MEAL_PLAN_SCORING.repeat` 1,5;
   Rechenschutz 50 offene Packungen je Lebensmittel).
2. **`nutrition/portion-factor.ts`** (Strukturtest K2 erweitert):
   - `mealTargetKcal(day, slot)` = Anteil des Platzes × Mitte des Planbands DIESER Person (aus
     `nutritionTargetsForWeek`, also schon durch `clampCalorieTarget`) – derselbe Startwert wie im Tagesausgleich.
   - `couplePortionFactor` (Zod): Ziel ÷ kcal je Portion, auf 0,01 gerundet, begrenzt 0,6–1,8 (`clamped` min/max);
     ohne `health_data`-Einwilligung (`no_consent`), ohne Ziele (`no_targets`) oder bei 0 kcal (`no_kcal`) Faktor 1.
   - `sharedMealPortions(persons, foods, mode)`: je Person ihre Portion an EINEM Gericht, mit dem Rezept nach IHREM
     Filter (Ersatzprodukte, weggelassene optionale Zutaten). `uniform` = alles mit dem Personenfaktor; `sides` =
     „Beilagen getrennt, Eiweißquelle gleich“: alle Zutaten außer der Beilage (Rolle `carb`) bekommen für alle
     Personen mit Zielen denselben Faktor (der **kleinste** ihrer Faktoren, Wächter N13 G-N13-2, 0,6–1,8), die Beilage gleicht je Person auf ihr Ziel
     aus (ebenfalls 0,6–1,8); Rezept ohne Beilage → wie `uniform` (`no_side`). Beilagen in g/ml ab 20 g auf 10 g, Eier
     ganz, nie 0, Nährwerte nach der Rundung (`scalePortionByRole` in `scale.ts`). Personen ohne Ziel/Einwilligung
     bekommen **genau** die Standardportion (`scalePortion(…, 1)`) und zählen beim gemeinsamen Faktor nicht mit. Reihenfolge egal.
   - `sharedCookingAmounts` (Kochmenge = Summe der Portionen).
   - `planSharedMeals({ mode, persons, meals })` (Zod: 1–6 Personen, Schlüssel `a–z0–9_-`, je Tag/Platz ein Gericht,
     gleiche Woche, gleicher Lebensmittel-Katalog): je Person die Woche über `buildMealPlanWeekDetailed` mit den
     geteilten Mahlzeiten (`shared`, intern). Ergebnis je Person Plan + `outcomes` (geteilt oder Grund) und je Gericht
     die Portionen der Personen, die es wirklich teilen (nur intern, keine Ziele/Körperdaten).
3. **Essensplan** (`meal-plan.ts`):
   - **Geteilte Mahlzeit (S1):** steht als feste Portion (`fixedPortion`, `fixed: true`, `factor` = Personenfaktor) am
     Platz – nach Meal-Prep-Wochenplan und schon gekochten Resten, vor Meal-Prep-Kochterminen und täglicher Auswahl. Sie
     besteht den **kompletten Filter der Person** an diesem Tag (Ernährungsform, Schwein, Unverträglichkeiten, „mag ich
     nicht“ inkl. `food_dislikes`, Schwangerschaft) und ist nicht mit Daumen runter gesperrt – sonst eigener Vorschlag.
     Der Tagesausgleich (`finishDay`, Planband aus `clampCalorieTarget`) läuft **nur über die übrigen Plätze und
     Ergänzungs-Snacks** (0,5–2,0) und streicht nichts; optionale Zutaten der geteilten Portion werden nicht verändert.
     Liegt der Tag dann noch über der Obergrenze, wird er **ohne** diese geteilte Mahlzeit neu geplant (Stand der Woche
     vorher wiederhergestellt) – eigener Vorschlag nach 6.3 mit den normalen Regeln; bei mehreren zuerst ohne die mit
     den meisten kcal (`above_ceiling`). Unter der Untergrenze: Ergänzungs-Snacks bzw. `below_floor` wie immer.
   - **Reste-Score (opt-in):** `MealPlanInput.leftovers = { packageSizes }`. Fehlt das Feld (bzw. ist die Tabelle leer),
     plant die Engine genau wie bisher (Test). Mit Feld verfolgt `WeekState.leftovers` die angebrochenen Packungen Tag
     für Tag; `scoreCandidate` addiert `leftoverScoreBonus` – **nur Reihenfolge**. Neu exportiert:
     `rankSlotCandidates` (alle Kandidaten eines Platzes, sortiert); `pickDailyMeal` nimmt daraus den ersten innerhalb der
     Wiederholungsgrenzen – gleiche Auswahl wie vorher (alle bisherigen Tests unverändert grün).
4. **`nutrition/leftovers.ts`**: `isRawAnimalLeftover` (Fleisch, Fisch, Krebs-/Weichtiere, Milch mit
   `pregnancy_caution` = Rohmilch wie R2-S2), `leftoverKeepDays`, `LeftoverTracker` (Packungen je Lebensmittel in Gramm:
   Verbrauch zuerst aus nutzbaren Resten, sonst neue Packungen; ein **abgelaufener Rest wird nie verwendet**, dann
   zählt eine neue Packung), `leftoverScore` (Σ min(Verwendung, Rest) ÷ Packung × 1 ÷ (1 + verbleibende Tage), Vorrat
   zählt nicht, höchstens 1), `recordDayLeftovers`, `planLeftovers` (welche Mahlzeit welchen Rest verbraucht; Reste am
   Ende mit `usableUntil`, Stück, Hinweis `freeze` bzw. `next_day_only`), `shoppingListPackages` (Einkaufsliste auf
   Packungen aufrunden: gleiche Mahlzeiten und Kaufdaten wie `buildShoppingList`, angebrochene Packungen, Bedarf, Rest,
   Rest in Stück; Lebensmittel ohne Packungsgröße unter `withoutPackageSize`). Packungsgrößen an der Grenze mit Zod
   (Katalog-ID, ganze Gramm 1–5.000).
5. **Tests:** Core `n13-portion-factor.test.ts` (28): Faktor (Rundung, **1.400 vs. 3.800 kcal → 0,6/1,8**, `no_targets`,
   ohne Einwilligung, 0 kcal, Zod), `mealTargetKcal`, Portionen (uniform, sides mit gleicher Eiweißquelle, Reihenfolge
   egal, **Rezept ohne Beilage**, **Eier ganz**, **5-Portionen-Rezept** mit Kochmenge, Beilagen-Rundung unter 20 g, 1 vs.
   6 vs. 7 Personen, Person ohne Ziel/Einwilligung), Woche (sehr unterschiedliche Ziele mit Ausgleich, **Person unter 18
   mit Überschussdeckel → keine geteilte Portion** – einmal klar darüber, einmal knapp: erst die übrigen Plätze gesenkt,
   sonst eigener Vorschlag –, `no_targets`/Schwangerschaft/ohne Einwilligung → Faktor 1, vegane Person bekommt kein
   Hähnchen, Daumen runter/vergangener Tag/fehlender Platz/unbekanntes Rezept, 1 vs. 7 Tage, 1 vs. 6 Personen,
   **leerer Katalog**, deterministisch, Zod, nicht speicherbar bis P1, Leistung mit ca. 600 Rezepten) und
   **Eigenschaftstest „Portionsfaktor hebt nie über die Obergrenze und drückt nie unter die Untergrenze ohne
   `below_floor`“** (24 Läufe mit 1–3 Personen, 16–85 Jahre, 40–150 kg, 1–8 Mahlzeiten, ohne Einwilligung,
   Schwangerschaft, vegan/vegetarisch/Erdnuss; Orakel `usedFoodViolations`; Zähler für geteilt/nicht geteilt; Zeitlimit
   60 s). `n13-leftovers.test.ts` (20): Haltbarkeit (**rohes Hackfleisch als Rest → nur Folgetag**, danach neue Packung
   und „einfrieren“; nicht einfrierbar → „nur Folgetag“), **Zutat ohne Packungsgröße**, **Eier** (6er, 2 Stück Rest),
   mehrere Packungen, Kochtag vor dem Anbruch, Score (Dringlichkeit, Vorrat, Deckel), Aufrunden (≥ einfaches
   Aufrunden, Vorrat genau, passt zur Einkaufsliste, Zeitraum, Zod), `planLeftovers`, ohne Feld = bisheriger Plan,
   deterministisch, leerer Katalog, „Reste werden häufiger verbraucht“ (über 12 Profile), **Eigenschaftstest „Reste-Score
   an/aus → gleiche Kandidatenmenge, jeder Tag im Band oder `below_floor`“** (36 Profile inkl. Meal-Prep, Schwangerschaft,
   ohne Einwilligung; gleiche Kandidaten je Platz über `rankSlotCandidates` in 40 Fällen, Reihenfolge ändert sich
   wirklich), Leistung mit ca. 600 Rezepten (mit Reste-Score ca. 63 ms statt 56 ms). Strukturtest K2 um
   `portion-factor.ts`/`leftovers.ts` erweitert, dazu „lesen weder Unter-/Obergrenze noch Ziel-kcal direkt“;
   Konstanten-Test.

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **„Ziel-kcal der Mahlzeit“** = Anteil des Platzes × Mitte des Planbands der Person – dieselbe Zahl, mit der der
  Tagesausgleich startet; sie stammt nur aus `clampCalorieTarget` (keine eigene Grenze, Strukturtest).
- **„Beilagen getrennt, Eiweißquelle gleich“:** gleich bleiben alle Zutaten außer der Beilage (auch Gemüse, Soße,
  Fett – sie werden zusammen gekocht); der gemeinsame Faktor ist der kleinste der Personen mit Zielen (Wächter N13,
  G-N13-2). Beide Modi gibt es;
  welcher in P1 Standard ist, entscheidet ihr (G-N13-1). Echte Rezepte haben noch keine bestätigten Rollen (N2c) – dort
  wirkt `sides` wie `uniform`.
- **10-g-Rundung** nur für Beilagen in g/ml ab 20 g und nur in geteilten Portionen; die Standardportion (Faktor 1)
  bleibt genau wie ohne Teilen.
- **Ausgleich ohne Streichen:** Mit geteilter Mahlzeit fällt am Tag keine andere Mahlzeit weg (S1: „zuerst
  Ergänzungs-Snacks … und andere Slots gesenkt“ – der Ausgleich nimmt nie zusätzliche Snacks dazu, wenn der Tag
  darüber läge, und senkt die übrigen Plätze bis 0,5). Erst wenn das nicht reicht: eigener Vorschlag (dann gelten die
  normalen Regeln, auch das Streichen einer Mahlzeit).
- **Fällt eine Person heraus** (Obergrenze, Platz belegt), werden die Portionen der übrigen neu berechnet (anderer
  gemeinsamer Faktor im Modus `sides`), bis sich nichts mehr ändert.
- **Daumen runter** einer Person gilt auch für ein geteiltes Gericht (Grund `rated_down` → eigener Vorschlag) – wie in
  N10 „nicht mehr vorschlagen“ (G-N13-3).
- **Gründe** für „nicht geteilt“: `past_day`, `slot_missing` (Person hat den Platz nicht), `slot_taken` (gekochte Reste),
  `not_found`, `excluded`, `rated_down`, `above_ceiling`. Nicht zusammen mit einem Meal-Prep-Wochenplan (Fehler).
- **Nicht speicherbar bis P1 (berichtigt nach Wächter N13 S2):** Geteilte Mahlzeiten tragen `shared: true`.
  `mealPlanMatchesRecipes` lehnt sie ausdrücklich ab und das Speicher-Schema kennt das Feld nicht – in **beiden** Modi
  und für jede Person (die erste Fassung behauptete das, im Modus `uniform` stimmte es aber nur teilweise). Ein solcher
  Plan gälte als nicht vorhanden und würde neu geplant (sichere Richtung, Test). P1 speichert Markierung und
  Beilagen-Faktor; keine DB-Änderung in N13 (Vormerkung bei N7).
- **Weiche Regeln (Wächter N13 H3):** Für das gemeinsam gewählte Gericht gelten Wiederholungsgrenzen, Zeitlimit an
  Werktagen und die Passung Mahlzeit-Art/Platz nicht (bewusste Wahl des Paars) – P1 zeigt das an. Die harten Filter
  gelten immer.
- **Reste:** Verbrauch am Kochtag wie die Einkaufsliste; angebrochen = Tag des ersten Verbrauchs; Mahlzeiten desselben
  Tages sehen einander beim Planen nicht (eingetragen wird nach dem Tag). Reste aus der Vorwoche zählen nicht (G-N13-5).
  Die Packungszahl der Einkaufsliste kann über dem einfachen Aufrunden liegen, wenn ein Rest vor dem nächsten Verbrauch
  abläuft (sichere Richtung: nie einen abgelaufenen Rest einplanen).
- **Rohmilch** = Milch mit `pregnancy_caution` (wie R2-S2) – damit auch Rohmilchkäse nur bis zum Folgetag (sichere
  Richtung, G-N13-4). Seit der Wächter-Prüfung zählen **alle** Lebensmittel mit `pregnancy_caution` (z. B. rohe
  Sprossen, Räucherfisch) nur bis zum Folgetag (`LEFTOVER_RAW_DAYS.sensitive`, Hinweis „nur bis zum Folgetag“).
- **Kaufdatum (Wächter N13 H8):** Der Reste-Score im Planer verbraucht am echten Kochtag (auch Sonntag vor der Woche),
  `shoppingListPackages` wie die Einkaufsliste ab Wochenbeginn – bei Meal-Prep am Sonntag rechnen beide also mit leicht
  unterschiedlichen Fristen (nur Reihenfolge bzw. Anzeige betroffen).
- **Reste-Score ausgeschaltet** bis N14: kein App-Aufruf übergibt `leftovers`; „Rezept tauschen“ und Ergänzungs-Snacks
  nutzen ihn auch mit Feld nicht. Engine-Version unverändert (ohne Feld identische Pläne).
- **G2/G3 aus N11 nicht vorweggenommen:** Die Packungsgröße wird so genommen, wie sie freigegeben ist – bei Stückware =
  ein Stück (jetziger Prompt) entsteht kein Rest, bei einer Mehrfachpackung entsprechend einer. Die Kühlschrank-Gewichtung
  (G2) berührt N13 nicht; im Reste-Score zählt Vorrat gar nicht (er hält lange).

**Gegenproben (danach zurückgesetzt):** (1) Obergrenze des Faktors entfernt → 15 Tests rot; Obergrenze 2,0 statt 1,8 →
4 rot (auch der Eigenschaftstest). (2) Ohne Einwilligung trotzdem Faktor aus dem Ziel → 3 rot. (3) Über der Obergrenze
kein eigener Vorschlag (Wiederholung ohne geteilte Mahlzeit abgeschaltet) → 2 rot. (4) Ausgleich darf mit geteilter
Mahlzeit andere Mahlzeiten streichen → 1 rot. (5) Filter der Person für das geteilte Gericht ignoriert → 2 rot (vegane
Person, Eigenschaftstest). (6) Rohe Reste 2 statt 1 Tag → 4 rot. (7) Abgelaufener Rest wird weiter verwendet → 1 rot.
(8) Vorrat zählt im Reste-Score → 1 rot. (9) Reste-Score filtert Kandidaten (nur noch solche mit Rest) → 1 rot
(Kandidatenmengen-Test). (10) Reste-Bonus 2 > Wiederholung → 2 rot. (11) `portion-factor.ts` liest `ceilingKcal` → 1 rot
(Strukturtest).

**Nebenbei:** Die Tests „Freigabe per ID“ (`content/recipe-release.test.ts`, N2d) liefen unter turbo-Last einmal
über 5 s (volle `validateContent`-Läufe) – eigenes Zeitlimit 30 s wie N11 B1; keine Änderung am Verhalten.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Portionsfaktor und Reste-Score“ (nur CI und
„Woche unverändert“ – sichtbar wird es mit N14 bzw. P1).

**Offen für die Gründer (N13, nicht umgesetzt – sichere Voreinstellung gilt):**

- **G-N13-1** Paar-Modus Standard: „Beilagen getrennt“ (alles außer der Beilage gleich) oder „alles je Person
  skaliert“? Und soll bei „Beilagen getrennt“ wirklich auch Gemüse/Soße gleich sein – oder nur die Eiweißquelle (dann
  müsste Soße/Gemüse je Person portioniert werden)? _Jetzt: beide Modi in Core, Entscheidung mit P1._
- **G-N13-2** Gemeinsamer Faktor im Modus „Beilagen getrennt“: der **kleinste** Faktor (jetzt, sichere Voreinstellung
  nach Wächter-Empfehlung: niemand bekommt mehr Hauptkomponente als sein Ziel, die Person mit höherem Bedarf gleicht
  über Beilage und übrige Mahlzeiten aus, seltener „über der Obergrenze“) – oder das Mittel der Personen (Alternative:
  ausgewogenere Eiweißmenge für die größere Person, aber öfter kein Teilen bei der kleineren)?
- **G-N13-3** Daumen runter einer Person: gemeinsames Gericht für sie nicht (jetzt, eigener Vorschlag) – oder trotzdem
  teilen?
- **G-N13-4** Fachprüfung der Rest-Tage je Abteilung (`LEFTOVER_RAW_DAYS`: Obst/Gemüse, Milchprodukte, Tofu, Konserven,
  Getränke 2; Brot, Saucen 3; trockene Waren, Tiefkühl 30; Fleisch/Fisch/Sonstiges 1) und ob Rohmilch-**Hartkäse** wie
  Rohmilch nur bis zum Folgetag zählen soll (jetzt ja, sichere Richtung). **Ergänzt (Wächter N13 S4, nicht
  umgesetzt):** Werte je Lebensmittel bzw. Untergruppe nötig – Hartkäse, Butter, Öl, Essig, H-Milch halten geöffnet
  deutlich länger; jetzt ergibt z. B. Parmesan 3 × 20 g in der Woche 3 Packungen (sichere Richtung, aber für „weniger
  Verschwendung“ falsch). Dafür braucht es fachliche Werte; **N14 macht die Anzeige von Packungszahl/Rest davon
  abhängig**. Wortgenaue Fundstellen BfR/Verbraucherzentrale nachtragen.
- **G-N13-5** Reste aus der Vorwoche (z. B. halbe Packung Quark vom Sonntag) in den nächsten Plan übernehmen? _Jetzt:
  nein – braucht eine Speicherung und kommt frühestens mit N14._
- **G-N13-6 (neu, Wächter H1) – Partner-Freigabe:** Im Modus „Beilagen getrennt“ hängt die Portion einer Person vom
  Faktor der anderen ab; über Kochmenge und Portionen lässt sich der Bedarf der anderen Person ableiten. Darf das für
  den Partner sichtbar/ableitbar sein? Wenn ja: ausdrücklich in den P1-Einwilligungstext („Dein Partner sieht, wie groß
  deine Portion ist“) und `planSharedMeals` bekommt eine **eigene Partner-Freigabe** als Pflicht-Eingabe, getrennt von
  `health_data` (heute nur der Abgleich Einwilligung ↔ Ziele, S3).
- **G-N13-7 (neu, Wächter B1) – Optionale Zutaten bei geteilten Gerichten:** Optionale Zutaten je Person weglassen
  (Topping auf dem eigenen Teller), damit das Teilen erhalten bleibt – oder dann nicht teilen? _Jetzt (sichere
  Voreinstellung): Liegt der Tag nur wegen optionaler Zutaten der geteilten Portion über der Obergrenze, isst die
  Person diese Mahlzeit nicht als geteilte Portion (eigener Vorschlag)._
- Weiter offen aus N11: **G2** (Vorrats-Gewichtung der Kühlschrank-Suche) und **G3** (Packung bei Stückware) – N13 nutzt
  die freigegebenen Werte unverändert; G3 muss vor dem ersten echten `package-sizes`-Lauf entschieden sein, weil davon
  abhängt, ob bei Stückware Reste entstehen.

**Wächter-Prüfung N13 (14.10.2026): 1 Blocker** (Bericht `waechter-n13.md`; keine Regression ohne `leftovers`-Feld,
harte Filter je Person wirken, Reste-Score ordnet nur um). Umgesetzt:

- **B1 (Blocker)** Optionale Zutaten der geteilten Portion konnten den Tag über die Obergrenze heben (der Ausgleich
  durfte sie nicht weglassen und brach ab). Jetzt gilt ein solcher Tag in `finishDay` als „über der Obergrenze“
  (`aboveCeiling`) → Tag ohne die geteilte Mahlzeit neu, eigener Vorschlag (G-N13-7 bleibt Gründer-Frage). Tests:
  Eigenschaftstest mit `haehnchen-reis-nuss` (80 g Erdnüsse optional, ca. 480 kcal) über 30 Paare × 7 Tage, dazu der
  große Eigenschaftstest mit der Hälfte der Gerichte als Nuss-Variante. Gegenprobe des Wächters (`g1-optional.mts`, 840
  Personentage): vorher 71 Verletzungen, jetzt **0**.
- **S1** Tausch an Tagen mit geteilter Mahlzeit: Wird eine **andere** Mahlzeit getauscht („Rezept tauschen“ oder
  Zutaten-Austausch), bleibt die geteilte Portion exakt (Gramm und kcal, `fixedMealSelection`/`sharedMealPortion` in
  `meal-plan.ts`, genutzt von `swapMealRecipe` und `substitute.ts`). Wird die geteilte Mahlzeit **selbst** getauscht,
  ist sie für diese Person danach eine eigene Mahlzeit mit eigenem Faktor (nicht geteilt, nicht fest). Tests für beide
  Wege; Wächter-Skript `g4-swap.mts`: vorher 28 von 28 geändert, jetzt 0.
- **S2** Markierung `shared: true` an der geplanten Mahlzeit; nicht speicherbar in beiden Modi (siehe Präzisierungen),
  Test für `uniform` und `sides`, jede Person.
- **S3** `planSharedMeals` wirft, wenn eine Person ohne Einwilligung Ziele aus Gesundheitsdaten mitbringt
  (`!healthDataConsent && targets.usesHealthData`). Test.
- **S5** Eigenschaftstests mit **unabhängigem Kalorien-Orakel** (`independentLimits` in `test-helpers.ts`: Mifflin-St-Jeor
  und Aktivitätsfaktor aus dem Plan abgeschrieben; untere Grenze max(Grundumsatz, 75 % des Gesamtumsatzes) an vollständigen
  Tagen, obere Gesamtumsatz + 10 % (unter 18: 5 %) + 20 kcal inkl. optionaler Zutaten) – zusätzlich zum Band-Abgleich,
  in beiden N13-Eigenschaftstests; schwere optionale Zutat in den Testdaten.
- **S6** `mealTargetKcal` liegt jetzt in `meal-plan.ts` (neben `mealPlanBand`); der Strukturtest verbietet in
  `portion-factor.ts`/`leftovers.ts` jeden Zugriff auf `band`, `mealPlanBand`, `planBand` sowie Unter-/Obergrenze und
  Ziel-kcal.
- **G-N13-2** Sichere Voreinstellung: gemeinsamer Faktor = der **kleinste** (statt Mittel), Test; Gründer-Frage mit
  Alternative vermerkt.
- **H6** Rohe Sprossen bzw. alle Lebensmittel mit `pregnancy_caution`: Reste nur bis zum Folgetag (Test).
- **Nicht umgesetzt:** S4 (Rest-Tage je Untergruppe) → G-N13-4 (fachliche Werte nötig, N14-Anzeige hängt davon ab);
  H3/H8 nur dokumentiert; H4 (Ausfall im Zwischenstand einer Runde ist endgültig – sicher, kann ein unnötiges „nicht
  geteilt“ erzeugen) und H10 vermerkt. Neue Gründer-Fragen G-N13-6 und G-N13-7.
- **Gegenproben zu den Auflagen (danach zurückgesetzt):** optionale kcal der geteilten Portion wieder ignoriert → 2 rot
  (beide Eigenschaftstests); „Rezept tauschen“ rechnet die geteilte Portion wieder um → 1 rot; Zutaten-Austausch rechnet
  sie um → 1 rot; getauschte geteilte Mahlzeit bleibt geteilt/fest → 1 rot; Einwilligungs-Abgleich entfernt → 1 rot;
  Speicher-Sperre entfernt → 1 rot; Mittel statt kleinster Faktor → 1 rot; Sprossen 2 Tage → 1 rot.

**Nachprüfung N13 (14.10.2026): kein Blocker.** Gegenproben neu gelaufen: 0/840 Personentage über dem Band (vorher 71),
0/28 Tauschvorgänge ändern die geteilte Portion, keine Regression gegenüber dem Stand vor N13. Umgesetzt:

- **NS1** `toMealPlanPayload` wirft bei `shared: true`, statt die Markierung beim Speichern still zu verlieren – Pläne
  mit geteilter Mahlzeit sind damit an jeder Stelle bis P1 nicht speicherbar (Test in `n13-portion-factor.test.ts`,
  Gegenprobe rot).
- Hinweis für später: Das Test-Orakel `independentLimits` prüft die ~1 %-pro-Woche-Grenze noch nicht und ist bei
  Fettverlust lockerer als das echte Band (der Band-Abgleich läuft mit, daher keine Lücke).

### N14 – Resteplanung in der App (teilweise umgesetzt, 14.10.2026, ohne Commit)

Umfang laut 19.7 N14 (Prompt E, Premium, Testmodus offen): „Wochenplan nutzt den Reste-Score, Anzeige ‚Dieses Rezept
verbraucht deinen restlichen Brokkoli.‘, Einkaufsliste mit Packungsangabe, Zahlen-Schalter (S12)“. Baut auf N13
(PR #67) auf; dessen Logik ist unverändert (nur eine zusätzliche, verhaltensgleiche Methode, s. u.). Rein regelbasiert,
keine KI, nichts Neues gespeichert, keine DB-Änderung (Vormerkung bei N7).

**Vorprüfung – was hängt an offenen Gründer-Entscheidungen?** Der Wächter zu N13 (S4, G-N13-4) hat festgestellt, dass
die Rest-Tage nur je Abteilung gelten (Hartkäse, Butter, Öl, Essig, H-Milch, Rohwurst halten angebrochen viel länger) –
z. B. Parmesan 3 × 20 g in der Woche ergibt 3 Packungen; dazu ist offen, was bei Stückware eine Packung ist (N11-G3).
Daraus folgt für N14:

| Teil von N14                                              | hängt an G-N13-4/N11-G3?                                                                                                                                   | Entscheidung                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Reste-Score im Wochenplan                                 | nein – ändert nur die Reihenfolge; zu kurze Rest-Tage verschenken höchstens einen Bonus, nie einen abgelaufenen Rest (sichere Richtung)                    | **umgesetzt**                                                                                      |
| Hinweis „Nutzt deinen Rest“ an der Mahlzeit               | nein – ohne Mengen; er erscheint nur, wenn der Rest nach den (kurzen) Regeln sicher noch nutzbar ist; ein zu kurzer Wert lässt höchstens einen Hinweis weg | **umgesetzt**                                                                                      |
| Hinweis „nur bis zum Folgetag“ bei kurz haltbaren Resten  | nein – S9 ist Plan-Entscheidung; Wortlaut beschreibt die Regel der App, nicht die Haltbarkeit des Produkts                                                 | **umgesetzt** (nur an der Mahlzeit, die den Rest nutzt)                                            |
| Einkaufsliste mit Packungszahl und Rest                   | **ja** – bei Hartkäse/Butter/Öl zu viele Packungen, bei Stückware je nach G3 andere Zahlen                                                                 | **zurückgestellt**, keine Anzeige, kein Schalter (`shoppingListPackages` bleibt ungenutzt in Core) |
| Liste „übrig am Ende“ mit „einfrieren“/„nur bis Folgetag“ | **ja** – `rests()` zählt abgelaufene Reste je Abteilung mit (Parmesan dreimal) und empfähle Einfrieren auch für Salami/Rohwurst                            | **zurückgestellt**                                                                                 |
| Reste aus der Vorwoche                                    | G-N13-5, braucht Speicherung                                                                                                                               | nicht umgesetzt                                                                                    |
| Geteilte Mahlzeiten / Paar-Modus                          | P1 (Phase 11)                                                                                                                                              | nicht umgesetzt; Pläne mit geteilter Mahlzeit bleiben unspeicherbar (N13 NS1 unverändert)          |

Ergebnis: Variante (a) – nur der ehrliche, nützliche Teil; die Zahlenanzeige ist **weggelassen** (kein versteckter
Schalter, damit sie nicht versehentlich eingeschaltet wird). Sobald G-N13-4 (Werte je Untergruppe) und N11-G3
entschieden sind, kommt sie als eigener Schritt.

1. **Core** (`packages/core/src/nutrition/leftovers.ts`):
   - `LeftoverTracker.consumeDetailed` – gleicher Stand wie `consume` (das jetzt darauf zeigt; Test „ändert den Stand
     genau wie consume“), zusätzlich Gramm aus Packungen, die an einem **früheren** Tag angebrochen wurden, und deren
     frühester Anbruchstag.
   - `leftoverPlanningInput(packageSizes, { allowDrafts })` – Eingabe `MealPlanInput.leftovers` aus den ausgewählten
     Packungsgrößen (`packageSizeLookup`, Zod an der Grenze); ohne `allowDrafts` nur freigegebene
     (`usablePackageSizes`, Wächter N14 H1); ohne Packungsgrößen `undefined` → Plan exakt wie ohne Resteplanung.
   - `recordWeekLeftoversInCookOrder` (Wächter N14 S1): verbucht alle Mahlzeiten der Woche **zeitlich** – stabil nach
     (Kaufdatum = Kochtag, Esstag, Platz). Eine Meal-Prep-Kochrunde verbraucht ihre Packungen damit am Kochtag, auch
     für die Portionen späterer Tage, bevor frische Mahlzeiten der Folgetage einen „Rest“ sehen. Genutzt von
     `leftoverMealHints`, `planLeftovers` und `shoppingListPackages` (Packungszahl in der App weiter ausgeblendet).
     Der Reste-Score der Engine bucht weiter Tag für Tag (`recordDayLeftovers`, unverändert aus N13, nur Reihenfolge;
     Wächter H4 vermerkt – beim Freischalten der Packungszahl angleichen).
   - `leftoverMealHints(plan, foods, packageSizes, { allowDrafts })` – je Mahlzeit die Lebensmittel, deren Rest sie
     nutzt (gleiche Rechnung wie `planLeftovers`: zeitlich nach Kochtag verbucht, abgelaufene Reste nie), mit
     Anbruchstag, `rawAnimal`, `shortLived` (roh tierisch ODER `pregnancy_caution` – genau die Lebensmittel, die
     `leftoverKeepDays` nur bis zum Folgetag einplant, Wächter N14 S3) und `packageReviewed` (Packungsgröße
     `published`). Ein Hinweis nur, wenn die Packung **vor** dem Kochtag angebrochen wurde (dieselbe Kochrunde oder
     derselbe Tag ist kein Rest „von vorher“), nicht an vorgekochten Meal-Prep-Portionen (`prepKind = leftover`: ihre
     Zutaten werden am Kochtag verbucht – ein Rest von früher erscheint am Kochtag selbst) und nie für Vorrat (wie der
     Reste-Score). Keine Mengen, keine Packungszahlen.
2. **App** (`apps/mobile`, Testmodus):
   - `data/nutrition-plan.ts`: `computeNutritionWeek` übergibt `leftovers` an die Engine (neue Pläne, „Andere
     Vorschläge“, „Plan aktualisieren“, automatische Neuplanung; „Rezept tauschen“ und Ergänzungs-Snacks nutzen den
     Score weiter nicht, N13), der Fingerabdruck `inputsKey` kennt die Packungsgrößen, Ergebnis `leftoverHints`
     (nur im Arbeitsspeicher). Reste-Score-Eingabe und Hinweise sind getrennt abgefangen (`safeLeftoverPlanningInput`,
     `safeLeftoverMealHints`, Wächter N14 H2): ein Fehler dort ergibt keinen Score bzw. keine Hinweise, sperrt aber nie
     die Ernährungsansicht.
   - Tagesansicht `ernaehrung/index.tsx`: an der Mahlzeit „Nutzt deinen Rest: Tofu (seit Mo)“, bei ungeprüfter
     Packungsgröße „Packungsgröße noch nicht geprüft (Testwert)“, bei kurz haltbaren Resten (`shortLived`) neutral
     „Angebrochen nur kurz haltbar: Die App plant diesen Rest nur bis zum Folgetag ein. Gut gekühlt lagern und die
     Angaben auf der Packung beachten.“ (kein „roh“ – gilt auch für Kochschinken, Rohmilchkäse, Sprossen; Wächter N14
     S3); unter den Mahlzeiten der Satz „Die Hinweise gehen von üblichen Packungsgrößen aus und planen Reste nur kurz
     ein. Wie viele Packungen du kaufst, zeigt die Einkaufsliste noch nicht.“ (Wächter N14 H3, s. Präzisierungen).
     Wochenansicht `ernaehrung/woche.tsx`: „· nutzt einen Rest“. **Screenreader (Wächter N14 S2):** Das
     `accessibilityLabel` der antippbaren Mahlzeit ersetzt ihren Inhalt – Hinweis, Testwert-Kennzeichnung und
     Lagerhinweis werden deshalb in Tages- **und** Wochenansicht angehängt (`leftoverAccessibilityText`).
   - Texte `i18n/de-nutrition.ts` (`leftovers`), Anzeige-Hilfen `lib/nutrition-format.ts` (`leftoverHintView`,
     `leftoverHintsBySlot`, `leftoverAccessibilityText`), `MealRow` mit optionalem Hinweis.
   - Zustände: unverändert die der Ernährungs-Ansichten (Laden, Fehler mit „Erneut versuchen“, unvollständig,
     gesperrt, keine Rezepte); ohne Packungsgrößen (z. B. echtes Bündel ohne `package-sizes`) gibt es einfach keine
     Hinweise. Keine kcal oder Gramm im Hinweis – der Zahlen-Schalter (S12) bleibt wirksam.
3. **Tests:** Core `n14-leftover-hints.test.ts` (11): `leftoverPlanningInput` (leer → Plan identisch, erster Eintrag
   je Lebensmittel, Zod 0/5.001 g), Hinweise (Rest von früher mit Anbruchstag, neue Packung nach Ablauf, **rohes
   Hackfleisch nur am Folgetag, übermorgen kein Hinweis**, gleicher Tag/gleiche Kochrunde kein Hinweis, Meal-Prep-
   Portionen ohne Hinweis, Vorrat/ohne Packungsgröße kein Hinweis, leerer Plan, deterministisch), **Eigenschaftstest
   „Hinweise nie für abgelaufene Reste, roh tierisch nur vom Vortag“** (30 Profile inkl. Meal-Prep, Schwangerschaft,
   ohne Einwilligung, 1–8 Mahlzeiten; zugleich „gleiche Eingaben → gleicher Plan“; Zeitlimit 60 s), `consumeDetailed`
   = `consume`; nach der Wächter-Prüfung (16): **Tofu-Fall** (200-g-Packung, Mo Meal-Prep 2 × 100 g, Di frisch → kein
   Hinweis, `planLeftovers` ohne Di, `shoppingListPackages` 2 Packungen), Rest von vor dem Kochtag erscheint am
   Kochtag, `shortLived` für Sprossen/Kochschinken/Rohmilchkäse (nicht Tofu, = `leftoverKeepDays` 1), ohne
   `allowDrafts` nur freigegebene Packungen. App-Vitest `nutrition-n14.test.ts` (6, nach der Wächter-Prüfung 8 – dazu
   H1 ohne `allowDrafts`, H2 ungültige Packungsgröße → Ansicht bleibt, Vorlesetext, Erklärsatz ohne „bevorzugt“): Score an mit Packungsgrößen, ohne → Plan wie Engine ohne Feld,
   Fingerabdruck; 7 Profile deterministisch, jeder Tag im Band oder `below_floor`, Hinweise passen zum Plan; vegan
   ohne tierische Lebensmittel; **gespeicherter Plan bleibt gespeichert**; Hinweis-Text ohne Ziffern/„Packung“;
   Einkaufsliste ohne Packungsangaben. Playwright `e2e/nutrition-leftovers.spec.ts`: Hinweise über alle 7 Tage, ohne
   Ziffern, als Testwert gekennzeichnet, nicht in localStorage/sessionStorage oder Adresse, **nach Neuladen gleich**,
   Wochenansicht mit gleicher Anzahl Vermerke, „Zahlen aus“ → Hinweise gleich, keine kcal; **`aria-label` der
   Mahlzeit enthält Hinweis und Testwert-Kennzeichnung** (Tag und Woche, S2). Ein Fleisch-Fall mit Lagerhinweis ist mit
   den Beispiel-Daten nicht erreichbar (geprüft über 20 omnivore Profile: Hähnchen liegt nie an Folgetagen; Wächter
   N14 H8) – abgedeckt in Core (Hackfleisch, Sprossen, Kochschinken) und App-Vitest (Vorlesetext).

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **Text** „Nutzt deinen Rest: …“ statt „verbraucht deinen restlichen …“: ob der Rest ganz aufgebraucht wird, hängt
  an Packungsgröße und Kaufverhalten – „nutzt“ stimmt in beiden Fällen. Mit Anbruchstag „(seit Mo)“, ohne Menge.
- **Annahme „übliche Packung gekauft“** wird offen gesagt (Satz unter den Mahlzeiten), weil die Einkaufsliste bis zur
  Entscheidung keine Packungen zeigt.
- **Erklärsatz ohne „bevorzugt“ (Wächter N14 H3):** Ob ein angezeigter Plan mit Reste-Score entstand, lässt sich ohne
  zusätzliche gespeicherte Angabe nicht feststellen (gespeicherte Pläne von vor N14 und „Rezept tauschen“ entstehen
  ohne Score; eine Markierung im Plan wäre ein neues Feld im Gerätespeicher bzw. in `meal_plans`). Deshalb ist die
  Behauptung „Der Plan bevorzugt …“ ganz **weggelassen**; der verbleibende Satz (Packungsannahme, kurze Planung, keine
  Packungszahlen) stimmt für jeden angezeigten Plan.
- **Gespeicherte Pläne bleiben** (keine Neuplanung, Engine-Version unverändert): Der Reste-Score ist keine
  Sicherheitsregel, ein Wechsel der Reihenfolge rechtfertigt keine automatische Neuplanung (6.6). Die Hinweise werden
  für jeden angezeigten Plan nachgerechnet – auch für einen Plan, der ohne Score entstand.
- **Premium:** Testphase offen (19.9); die serverseitige Prüfung kommt mit Phase 7 (Vormerkung bei N7). Kein
  Premium-Hinweis in der App, solange es kein Abo gibt.
- **Entwürfe:** Packungsgrößen im Testmodus dürfen Entwürfe sein (wie Rezepte, `allowDrafts`); der Hinweis sagt dann
  „Packungsgröße noch nicht geprüft (Testwert)“. Im Beispiel-Bestand sind alle 6 Packungen Testwerte.
- **Wirkung heute klein:** Echte Packungsgrößen gibt es noch nicht (erster `package-sizes`-Lauf wartet auf N11-G3);
  sichtbar ist N14 nur mit den Beispiel-Rezepten. Ohne Packungsgrößen ändert sich nichts.

**Gegenproben (danach zurückgesetzt):** (1) Hinweis auch für Packungen vom selben Tag (`openedOn <= date`) → 2 rot.
(2) Hinweis auch an vorgekochten Meal-Prep-Portionen → 1 rot. (3) Vorrat nicht ausgenommen → 2 rot. (4) Rohe
tierische Reste 2 statt 1 Tag (`LEFTOVER_RAW_DAYS.rawAnimal`) → N14-Eigenschaftstest rot (insgesamt 4 rot mit N13).
(5) Abgelaufene Reste werden weiter verwendet → 2 rot in N14 (Hackfleisch-Fall, Eigenschaftstest), 3 mit N13.
(6) App übergibt `leftovers` nicht mehr → App-Vitest 1 rot. (7) Hinweis mit Packungszahl („1 Packung“) → App-Vitest 1
rot und Playwright rot. **Nach der Wächter-Prüfung:** (8) S1 – Verbuchung wieder in Plan-Reihenfolge statt nach
Kochtag → Tofu-Test rot. (9) S3 – `shortLived` nur roh tierisch → Sprossen/Kochschinken-Test rot. (10) H1 – Entwürfe
auch ohne `allowDrafts` → Core 1 rot, App-Vitest 1 rot.

**So testest du es am Handy:** HANDY-ANLEITUNG Teil 7c, Abschnitt „Resteplanung (Etappe N14)“.

**Offen für die Gründer (N14):**

- **G-N13-4 (blockiert den Rest von N14):** Rest-Tage je Untergruppe statt je Abteilung (Hartkäse, Butter, Öl, Essig,
  H-Milch, Rohwurst/Salami, Kochschinken, Konfitüre, Senf …) mit Fachprüfung. Erst danach zeigt die Einkaufsliste
  Packungszahl und Rest, und erst dann gibt es die Liste „übrig am Ende“ mit „einfrieren“/„nur bis Folgetag“.
- **N11-G3 (blockiert den Rest von N14):** Packung bei Stückware = ein Stück oder übliche Mehrfachpackung? Davon hängt
  ab, ob und wie viel Rest entsteht – vor dem ersten echten `package-sizes`-Lauf entscheiden.
- **G-N14-1 (neu):** Soll der Hinweis „Nutzt deinen Rest“ auch in der Rezeptansicht und im PDF stehen? _Jetzt: nur
  Tages- und Wochenansicht (PDF unverändert)._
- **G-N14-2 (neu):** Soll ein bestehender Plan beim ersten Öffnen nach N14 neu geplant werden, damit der Reste-Score
  wirkt? _Jetzt: nein (gespeicherte Pläne bleiben; „Andere Vorschläge“ oder die nächste Woche nutzen ihn)._
- **G-N14-3 (neu, Wächter N14, mit der Ernährungsfachkraft N7):** Sollen empfindliche pflanzliche Lebensmittel (rohe
  Sprossen) überhaupt als Rest am Folgetag eingeplant werden – oder gar nicht (dann `LEFTOVER_RAW_DAYS.sensitive` = 0)?
  _Jetzt: Folgetag mit Lagerhinweis (S3)._
- Weiter offen: G-N13-5 (Reste aus der Vorwoche, braucht Speicherung), P1-Fragen G-N13-1/-2/-3/-6/-7.

**Wächter-Prüfung N14 (14.10.2026): Freigabe mit Auflagen, kein Blocker** (Bericht `waechter-n14.md`; ohne
Packungsgrößen bytegleich zu HEAD in 61/61 Profilen, 0 Planband-Verstöße, deterministisch, Lebensmittelsicherheit
eingehalten). Umgesetzt:

- **S1** Zeitliche Verbuchung nach Kochtag (`recordWeekLeftoversInCookOrder`) in Hinweisen, `planLeftovers` und
  `shoppingListPackages`; Tofu-Test. Nachprüfung mit dem Wächter-Skript (`order2`, an die neue Signatur angepasst):
  **0 von 1.407** Hinweisen ohne zeitlich richtigen Rest (vorher 31 von 1.393); `compare`: ohne Packungsgrößen
  weiter **61/61 bytegleich** zu HEAD, 0 Planband-Verstöße.
- **S2** Hinweis, Testwert-Kennzeichnung und Lagerhinweis im Vorlesetext der Mahlzeit (Tag und Woche); App-Vitest und
  Playwright (`aria-label`).
- **S3** Feld `shortLived` und neutraler Wortlaut ohne „roh“; Test mit Sprossen, Kochschinken, Rohmilchkäse.
- **H1** Packungsgrößen ohne `allowDrafts` nur `published` (Core `usablePackageSizes`); Tests Core und App.
- **H2** Score-Eingabe und Hinweise getrennt abgefangen; Test mit ungültiger Packungsgröße (Ansicht bleibt).
- **H3** Erklärsatz ohne Behauptung „bevorzugt“ (siehe Präzisierungen).
- **H8** Fleisch-Fall im E2E mit Beispiel-Daten nicht erreichbar (s. Tests); Vorlesetext-Prüfung im E2E ergänzt.
- **Nur vermerkt:** H4 (Score der Engine bucht Tag für Tag – nur Reihenfolge; vor dem Freischalten der Packungszahl
  angleichen), H5/H6/H9/H10 ohne Befund, H7 („seit So“ für den Sonntag vor der Woche – unverändert).

### N7 – Supabase-Anbindung, Teil 1: Datenbank (umgesetzt, 14.10.2026, ohne Commit)

Baut auf N9–N14 (N14 = PR #68) auf. **Teil 1 = alles in der Datenbank** (Migrationen, RLS, Funktionen, Widerruf,
Export, Löschung, pgTAP) plus die Anbindung der einfachen Wege im Supabase-Backend der App. **Teil 2** (Essensplan,
Einkaufsliste und Rezept-Bestand im Supabase-Modus der App, `content-seed` für Ernährung) ist als Vorschlag unten
beschrieben und wartet auf Freigabe (CLAUDE.md: vor größeren Features Plan vorlegen) – Grund: die Rekonstruktion des
Plans ohne Planband/`safetyKey` ändert, wie 6.6 im Supabase-Modus greift (sicherheitsrelevant). Nichts ist live
geschaltet: Die Migrationen spielt erst `db-migrate` nach dem Merge ein; der Supabase-Modus der App ist ohne
öffentliche Schlüssel inaktiv, `supportsNutrition` bleibt dort `false` (keine Ernährungs-Bildschirme, kein Schritt
`nutrition_setup`).

**Migrationen (alle additiv, nach `20261013120000`):**

| Datei                                        | Inhalt                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261014120000_consent_version_no_anon.sql` | `revoke execute on current_consent_version from anon` (Supabase-Advisor, s. u.)                                                                                                                                                                                                                                                                                                        |
| `20261014120100_nutrition_enums.sql`         | Enums `activity_level`, `training_time`, `mealprep_slot_mode` (eigene Datei, S8)                                                                                                                                                                                                                                                                                                       |
| `20261014120200_nutrition_prefs_setup.sql`   | `nutrition_prefs` + `activity_level`, `training_time` (NULL = Schritt offen, nur gemeinsam), `mealprep_slots` (Standard Mittag), `show_energy_numbers` (Standard an), `max_prep_minutes_weekday` (10–120)                                                                                                                                                                              |
| `20261014120300_nutrition_content.sql`       | Inhaltstabellen `foods`, `recipes`, `recipe_ingredients`, `ingredient_substitutions`, `food_package_sizes`, `meal_prep_plans`, `guides` – RLS (anon nichts, angemeldet nur `published`), `data jsonb` = Datei unverändert                                                                                                                                                              |
| `20261014120400_seed_nutrition_content.sql`  | `seed_nutrition_content(p_content)` (nur `service_role`) + Hilfsfunktionen `food_diet`, `food_contains_pork`, `diet_allows`, `jsonb_text_array`                                                                                                                                                                                                                                        |
| `20261014120500_meal_plans.sql`              | Nutzertabellen `meal_plans`, `meal_plan_items`, `shopping_lists`, `shopping_list_items`, `recipe_ratings`, `food_dislikes` mit RLS, Spaltenrechten, CHECKs, Triggern (Bewertungsdatum, Höchstzahlen)                                                                                                                                                                                   |
| `20261014120600_meal_plan_rpcs.sql`          | `save_meal_plan`, `replace_shopping_list`, `replace_food_dislikes`, `delete_stored_intolerances`; `consents_after_revoke()` und `export_my_data()` erweitert; nach Wächter N7 S2 zusätzlich `plan_health_basis()` (Einwilligung FOR SHARE), `revoke_health_data()` (Einwilligung zuerst FOR UPDATE) und nach der Nachprüfung `append_plan_block()` (Einwilligung vor dem Plan) ersetzt |

**Umgesetzt (Plan 7.2/7.3, 19.4 und alle Vormerkungen aus N2–N14):**

1. **Inhalte** (7.2, 19.4): nur `published|archived`, Schreiben nur `seed_nutrition_content()`. Livegang nur
   **fachlich geprüft** (Gründer-Entscheidung 6, 19.5 K10): Lebensmittel, Rezepte, Austausch-Einträge, Meal-Prep-Pläne
   und Ratgeber brauchen `meta.expert_reviewed = true`, Lebensmittel zusätzlich die Katalog-Prüfung (R19),
   Packungsgrößen den Prüfvermerk. Verweise nur ins eigene Paket (= freigegeben), Versionen sinken nie, archivieren
   statt löschen, idempotent. **Wächter N2d K9:** `data` transportiert die Datei unverändert, nur Prüfer-Namen werden zu „redaktion“ (Wächter N7 H8; pgTAP vergleicht
   `meta.import_assumptions` vor/nach dem Seed). **N11:** Packungsgrößen als eigene Inhaltstabelle
   `food_package_sizes` (mit eigenem Prüfvermerk) – `content/foods/` bleibt allein `foods-import` vorbehalten (S3).
2. **`nutrition_prefs`-Spalten** (R2-S3) und Typ-Trennung in der App (`NutritionPrefsRow` ohne die Setup-Spalten,
   `nutritionPrefsFromDb` teilt die Zeile auf, Zod an der Grenze).
3. **Essensplan** `meal_plans`/`meal_plan_items` (7.2): ein Plan je Woche (ersetzen = löschen + neu, Kochtag-Start
   bleibt nur beim selben Meal-Prep-Plan), `inputs` ohne Gesundheitsdaten (K8), **kein Planband, kein `safetyKey`, kein
   Modus, keine leeren Plätze/Hinweise** (Wächter N5a S4), **keine geteilten Mahlzeiten** (N13 NS1: strikte Felder,
   pgTAP „shared“ abgelehnt).
4. **`save_meal_plan`** (7.3): Login, Profil, Ernährungsangaben; nur bekannte Felder (= `mealPlanPayloadSchema`,
   db-sync); Woche laufend/nächste (Berlin ±1 Tag); ab heute nur freigegebene Rezepte in genau dieser Version
   (vergangene Tage bleiben, wie sie waren); Weglassen nur optionaler Zutaten (S3); Ersatz nur aus der Ersatzliste des
   Lebensmittels (S4); Tausch nur mit freigegebenem Eintrag in `ingredient_substitutions` (**N9 S7**); danach je Zutat
   erneut **Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“ (Gruppe und Lebensmittel, N10), Alkohol** und
   „Lebensmittel freigegeben“. **Faktor ≠ 1 ohne gültige Einwilligung → abgelehnt (S9).** `uses_health_data` setzt der
   Server (wie `usesHealthData` im Core: Einwilligung UND (Körperdaten ODER Check), Unverträglichkeiten, Faktor ≠ 1,
   Tagesstatus mit Zielen, **Tausch (N9-Vormerkung)**, mit Einwilligung auch Ersatz/Weglassen (**N3 K5**), übernommene
   vergangene Tage eines Gesundheits-Plans); Gesundheitsbezug ohne Einwilligung → abgelehnt. Leer-Grund `rated_down`
   (**N10 H8**): kein eigenes Feld nötig, weil leere Plätze nicht gespeichert werden (s. Präzisierungen).
   `pregnancy_caution` und Kalorien-Grenzen bewusst nur im Core (S9, R2-K8, KONZEPT 12).
5. **Einkaufsliste** `shopping_lists`/`shopping_list_items` + `replace_shopping_list` (Payload-Schema
   `shoppingListPayloadSchema`/`toShoppingListPayload` neu in Core): eine Liste je Woche, Verweis auf den Plan
   `on delete set null (meal_plan_id)`, Häkchen direkt (Spalte `checked`), sonst nur über die Funktion; Gesundheitsbezug
   sichere Richtung (Angabe der App ODER Plan der Woche ODER zusätzliche Rezepte mit Unverträglichkeiten/Gesundheits-
   angaben ODER Ersatzprodukte mit Einwilligung); ohne Einwilligung keine Liste mit Gesundheitsbezug.
6. **`recipe_ratings`** (19.4, **N10-Vormerkung**): CHECK `value in ('up','down')`, CHECK `reason in
('taste','effort','cost','satiety')` (nie „intolerant“), CHECK `reason is null or value = 'down'`, eine Bewertung je
   (Nutzer, Rezept) (Primärschlüssel), Datum = heute ±1 Tag, höchstens 2.000; RLS nur eigene Zeilen, keine View/
   Funktion zur Aggregation. **`food_dislikes`** **ohne** `created_at` und ohne Grund (**Wächter N10 H8**), höchstens
   300, Ersetzen atomar über `replace_food_dislikes` (security invoker, RLS greift).
7. **Widerruf** (`consents_after_revoke`): zusätzlich Essenspläne und Einkaufslisten mit Gesundheitsbezug (Kaskade
   inkl. eigener Einträge, K10); Bewertungen und „mag ich nicht“ bleiben (kein Gesundheitsdatum, N10).
   **`delete_stored_intolerances()`** löscht Unverträglichkeiten und Pläne/Listen mit Gesundheitsbezug in einer
   Transaktion (wie der Testmodus seit N5a).
8. **Export/Löschung:** `export_my_data()` mit allen sechs neuen Tabellen (+ neue `nutrition_prefs`-Spalten über
   `to_jsonb`); `DATA_EXPORT_TABLES` entsprechend, `PENDING_DB_EXPORT_TABLES` nur noch `exercise_preferences`.
   Konto löschen entfernt alles per Kaskade (pgTAP `04`). Der generische Export-Test (`17`) prüft weiter, dass jede
   Tabelle mit `user_id` im Export steht.
9. **App (Supabase-Backend, nur aktiv mit öffentlichen Schlüsseln):** Einwilligungstexte vor dem Login direkt aus
   `consent_documents`; `nutrition_setup`-Spalten laden/speichern (Vorgang `upsert_nutrition_setup` → `update
nutrition_prefs`, ohne Zeile abgelehnt); Bewertungen (Upsert/Löschen, nur online) und „mag ich nicht“ je Lebensmittel
   (`replace_food_dislikes`) mit denselben Prüfungen wie im Testmodus (`rating-rows.ts`); „Unverträglichkeiten löschen“
   über `delete_stored_intolerances`.
10. **Typen und Abgleich:** `database.types.ts` von Hand im gen-types-Format (13 Tabellen, 5 Spalten, 3 Enums,
    5 Funktionen; Prüfung danach mit Workflow `db-types`); `enums.ts` + `ACTIVITY_LEVELS`, `TRAINING_TIMES`,
    `MEALPREP_SLOT_MODES` (aus `nutrition/schemas.ts` verschoben); `db-sync.test.ts` gleicht alle neuen CHECK-Listen,
    Feldlisten der Funktionen (= strikte Zod-Schemas), Grenzen und die neueste Fassung von Widerruf/Export ab.

**`current_consent_version` und anon (Supabase-Advisor):** Bewertet – die App braucht die Einwilligungstexte vor dem
Login (Onboarding: Alter → Texte → Konto), aber **nicht die Funktion**: `consent_documents` ist für anon lesbar (nur
veröffentlichte Texte), die höchste Version je Art ist dieselbe wie das Ergebnis der Funktion (pgTAP `28` prüft die
Gleichheit). Deshalb **Recht entzogen**; `authenticated` behält es (INSERT-Policy auf `consents`), `has_valid_consent`
ruft sie als Eigentümer auf. Danach kann anon **keine** Funktion in `public` mehr ausführen (pgTAP `28` allgemein).

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **`seed_nutrition_content` als eigene Funktion** statt `seed_content` zu ersetzen – die bestehende Funktion bleibt
  unverändert (kein Risiko für Übungen/Vorlagen auf der Live-Datenbank). `content-seed` ruft sie erst mit Teil 2 auf
  (heute gibt es ohnehin keine freigegebenen Ernährungs-Inhalte; der Katalog wartet auf `foods-import`).
- **`data jsonb` + abgeleitete Spalten** statt vollständiger Spaltenzerlegung: Die App prüft die Inhalte an der Grenze
  ohnehin mit den Zod-Schemas (`validateContent`/`selectNutritionContent`, `allowDrafts` nie true) und rechnet
  Nährwerte, Schwangerschafts-Vorsicht usw. mit dem Core – eine zweite Rechnung in SQL wäre eine zweite Wahrheit.
  Deshalb **keine** Spalten `per_serving_*` und `pregnancy_caution` an `recipes` (der Server prüft beides bewusst nicht,
  S9/R2-K8); `diet`, `allergens` (inkl. optionaler Zutaten), `contains_pork` leitet der Seed aus den Zutaten ab (nur
  Übersicht). Die optionale SQL-Plausibilitätsprüfung „Tagessumme ≥ Mifflin“ (Kann, 7.3) ist nicht umgesetzt.
- **Kategorien als Liste `recipes.categories`** (CHECK = `RECIPE_CATEGORY_IDS`) statt `recipe_categories` +
  `recipe_category_links`; **Meal-Prep-Pläne als eine Tabelle** (`recipe_ids` + `data`) statt vier – reine Inhalte,
  später additiv erweiterbar.
- **Werte-Listen als CHECK statt Enum** (Plätze, Rollen, Abteilungen, tierische Bestandteile, Tierarten, Mahlzeit-Arten,
  Einheiten); Enums nur für die drei Antworten von `nutrition_setup`. db-sync prüft beide gleich.
- **Ersatz/Weglassen/Tausch je Zutat-Stelle** (nach Wächter N7 S3): Payload und Spalten tragen `{index, food_id, …}`
  (`index` = Stelle im Rezept wie `recipe_ingredients.position`, `food_id` muss dort stehen); je Stelle höchstens eine
  Änderung. So bleiben Rezepte mit derselben Zutat an zwei Stellen eindeutig (Milch einmal Pflicht, einmal optional).
- **Harte Regeln nur ab heute (Berlin):** Vergangene Tage werden nicht erneut gefiltert (sonst würde z. B. ein neues
  „mag ich nicht“ jede automatische Neuplanung ab heute scheitern lassen, weil gestern das Lebensmittel noch im Plan
  stand). Für vergangene Tage gilt nur: Rezept existiert, Version höchstens die aktuelle.
- **`rated_down` (N10 H8):** Leere Plätze samt Gründen werden gar nicht gespeichert (sie verraten Ausschlüsse); ein
  eigener Schema-Wert ist deshalb nicht nötig. Die Payload kennt keine leeren Plätze.
- **Bewertungsdatum ±1 Tag** um „heute“ (Europe/Berlin), weil die App die Gerätezeit nutzt; rückdatieren um mehr als
  einen Tag geht nicht.
- **Häkchen-Übernahme** beim Ersetzen der Liste macht der Core vor dem Senden (`mergeShoppingList` über `item_key`); der
  Server speichert den gesendeten Stand. `set_shopping_items_checked` entfällt – Abhaken geht direkt über die Spalte
  `checked` (Plan 7.3 nennt beide Wege).
- **Löschfrist** (`MEAL_PLAN_RETENTION_WEEKS`, Wächter N5a) ist nicht umgesetzt – die Gründer-Entscheidung ist offen.

**Tests:**

- **pgTAP** (lokal ausgeführt, s. u.): neu `23_nutrition_content` (57), `24_meal_plans` (65), `25_meal_plan_rpcs` (73),
  `26_shopping_lists` (36), `28_anon_and_definer` (10); ergänzt `01_rls_isolation` (anon/Version), `04_account_deletion`
  (Ernährung beider Nutzer). Gesamt nach der Wächter-Prüfung **1.194 Tests in 26 Dateien grün**.
- **Vitest:** Core `db-sync.test.ts` (222, davon neu: Enums, 19 CHECK-Listen, Feldlisten von `save_meal_plan`/
  `replace_shopping_list`, 20 Grenzen, Widerruf, anon), `n7-payloads.test.ts` (6: Einkaufsliste → Payload bei 1/4/8
  Mahlzeiten, 1 und 12 Portionen, erweiterte Ernährungsform, leere Liste, Zeitraum, Schlüssel, Höchstzahl eigener
  Einträge, keine kcal/Gründe; Plätze = `MEAL_SLOT_TIMES` + Ergänzungs-Snacks); `data-export.test.ts`; App
  `supabase-backend.test.ts` (+5: Bewertungen, Abneigungen, Aufteilung `nutrition_prefs`, Schritt `nutrition_setup`,
  Einwilligungstexte ohne Funktion).

**Gegenproben (jeweils danach zurückgesetzt, pgTAP):** (1) Einwilligungsprüfung in `save_meal_plan` entfernt → 3 rot
(S9 Faktor, Ziele, Tausch). (2) `food_dislikes`-Prüfung entfernt → rot (Tausch auf abgelehntes Lebensmittel).
(3) Widerruf löscht keine Pläne → rot. (4) Weglassen wird ignoriert → 2 rot. (5) anon darf `current_consent_version`
wieder → 3 rot (`01`, `28`). (6) Seed ohne Fachprüfung → rot. (7) `food_dislikes` mit `created_at` → 2 rot.
(8) RLS `meal_plans` für alle → rot. (9) Schwein-Prüfung entfernt → rot. (10) Tausch ohne Austausch-Tabelle → rot.
(11) Export ohne `food_dislikes` → 3 rot (`17` generisch, `26`). **Nach der Wächter-Prüfung:** (12) Stelle nicht geprüft →
rot (S3). (13) Änderung je Lebensmittel statt je Stelle → rot (nur eine Milch-Stelle geändert). (14) Stelle mehrfach
erlaubt → rot. (15) Bewertungs-Limit zählt vorhandene → 2 rot (H4). (16) Namen bleiben in `data` → 3 rot (H8).
(17) Größe nicht geprüft → rot (H1). (18) Sperre fehlt → `28` rot; im Harness bleibt ein Plan mit Gesundheitsbezug nach
dem Widerruf (S2). (19) Wochen-Sperre fehlt → Unique-Fehler beim gleichzeitigen ersten Speichern (H15). **Nach der Nachprüfung:** (20) `append_plan_block` ohne
Einwilligungs-Sperre vor dem Plan und Liste mit eigenem Wochen-Schlüssel → `28` 2 rot, `db-sync.test.ts` 2 rot; im
Harness Deadlock bzw. Liste ohne Verweis auf den Plan der Woche (S-N1).

**Was ausgeführt wurde und was nicht:** Docker gibt es in der Cloud-Sitzung nicht (`supabase start` geht nicht). Die
Migrationen und pgTAP liefen gegen ein lokales **Postgres 16 mit pgTAP** und einem kleinen Supabase-Ersatz (Rollen
`anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()`, Standard-Rechte wie bei Supabase für neue Objekte in
`public`). Nicht geprüft: echtes Supabase (Postgres 17, gotrue, PostgREST) – das macht der Workflow **`db-test`**
automatisch im Pull Request (Änderungen unter `supabase/`); `database.types.ts` ist von Hand – Abgleich mit dem
Workflow **`db-types`**. Kein Zugriff auf die Live-Datenbank, keine Secrets, nichts live geschaltet.

**Vorschlag N7 Teil 2 (freigegeben 16.10.2026, umgesetzt – siehe Umsetzungsstand N7 Teil 2):**

1. **Essensplan im Supabase-Modus ohne Planband/`safetyKey`** (Wächter N5a S4): Auf dem Gerät bleibt der vollständige
   Plan im **geschützten Speicher** (7.5; wie Trainingspläne mit Gesundheitsbezug). Fehlt er (neues Gerät, gelöscht)
   oder passt er nicht zu den Datenbank-Zeilen, baut der Core den Plan aus `meal_plan_items` + Bestand neu
   (`mealPlanWeekFromRows`): Mahlzeiten aus Rezept, Version, Faktor, Ersatz, Weglassen, Tausch; **Modus aus
   `day_status`** (`no_targets` ⇔ aktueller Modus `no_targets`, sonst `mode_changed`), **Planband und Abgleich-Schlüssel
   aus den aktuellen Zielen**, danach die normale Prüfung 6.6 (Tagessumme im aktuellen Band, jedes Rezept besteht den
   aktuellen Filter inkl. `pregnancy_caution`, Reste halten). Unterschied zum Testmodus: Ein reiner Deckel-Wechsel
   (`caps_changed`), bei dem der Plan **weiter im neuen Band liegt**, plant auf einem neuen Gerät nicht neu – sicher, weil
   das Band die Deckel enthält. Leere Plätze/Hinweise werden neu berechnet bzw. fehlen bei rekonstruierten Tagen.
2. Speichern über `save_meal_plan`/`replace_shopping_list` (nur online für Pläne mit Gesundheitsbezug; Abhaken offline
   über die Warteschlange), Fehler `plan_rejected`/`consent_required` wie im Testmodus.
3. Bestand aus der Datenbank (`data` → `validateContent` → `selectNutritionContent({ allowDrafts: false })`), klarer
   Leer-Zustand ohne freigegebene Rezepte.
4. `content-seed` baut das Ernährungs-Paket (nur `published`) und ruft `seed_nutrition_content` auf, Schutz vor
   Massen-Archivierung wie bei Übungen.
5. Erst dann `supportsNutrition = true` im Supabase-Modus (inkl. Schritt `nutrition_setup`, R2-S3).
6. DoD: `db-test` grün, Live-Test mit zwei Geräten (HANDY-ANLEITUNG Teil 8), **Fachprüfung durch eine
   Ernährungsfachkraft** und **Zitat-/Wertprüfung** (N1 K6) vor dem Livegang.
7. **S1-Rückfall entfernen (Nachprüfung N7):** Der Rückfall in „Unverträglichkeiten löschen“ (fehlt
   `delete_stored_intolerances`, wird direkt gelöscht – dabei bleiben Pläne/Listen mit Gesundheitsbezug stehen) gilt nur
   für die Übergangszeit von Teil 1. In Teil 2 wird er durch einen **klaren Fehler** ersetzt („Löschen gerade nicht
   möglich – bitte später erneut versuchen“), Test entsprechend; die Migrationen sind dann sicher eingespielt.

**So prüft ihr es am Handy:** HANDY-ANLEITUNG Teil 7d.

**Wächter-Prüfung N7 Teil 1 (14.10.2026): kein Blocker im SQL, Auflagen umgesetzt** (Bericht `waechter-n7.md`). Live
geprüft (Koordinator, `list_tables`): keine der neuen Tabellen existiert, `profiles` hat 0 Zeilen – die neuen
Migrationsdateien wurden deshalb direkt geändert (Zeitstempel unverändert, keine Zusatzmigration).

- **S1 – App vor den Migrationen live:** `supabase-backend.ts` fällt sauber zurück, wenn Tabelle oder Funktion fehlen
  (`PGRST205`/`42P01` bzw. `PGRST202`/`42883`): `recipe_ratings`/`food_dislikes` → leer, die Anmeldung läuft weiter;
  „Unverträglichkeiten löschen“ fällt auf das direkte Löschen wie vor N7 zurück; andere Fehler bleiben Fehler (Test).
  Kein App- oder Web-Pfad ruft `current_consent_version` noch auf (Repo-Suche). Das REVOKE bleibt (keine Nutzer, keine
  alten Builds mit Supabase-Schlüsseln). SETUP B und HANDY-ANLEITUNG 7d: nach dem Merge erst `db-migrate` grün
  abwarten, dann Vercel neu ausrollen bzw. EAS-Builds neu erstellen.
- **S2 – Race Widerruf ↔ Speichern:** `nutrition_health_basis()` (für `save_meal_plan`/`replace_shopping_list`) und
  `plan_health_basis()` (für `save_training_plan`/`append_plan_block`) sperren die aktiven `health_data`-Einwilligungen
  `FOR SHARE`, bevor sie geprüft werden; `revoke_health_data()` sperrt sie zuerst `FOR UPDATE`;
  `consents_after_revoke()` löscht Pläne/Listen am Ende ein zweites Mal. **Sperr-Reihenfolge überall: erst die
  Einwilligung, dann Plan-/Einheiten-Zeilen** – nur dann gibt es keinen Deadlock (der Widerruf löscht über den Trigger
  Pläne, wartet also auf deren Zeilensperren). `save_training_plan` ruft `plan_health_basis()` vor dem Plan-Update auf;
  `save_session_log`, `delete_session_log`, `close_missed_sessions` sperren keine Einwilligung. **Korrigiert nach der
  Nachprüfung (S-N1):** `append_plan_block()` sperrte zuerst den Plan (`user_plans FOR UPDATE`) und danach in
  `plan_health_basis()` die Einwilligung → mit gleichzeitigem Widerruf Deadlock (Postgres bricht eine Seite ab). Jetzt per
  `create or replace` in `20261014120600` ersetzt (gleiche Signatur, sonst gleiches Verhalten, REVOKE/GRANT erneut):
  Einwilligung `FOR SHARE` direkt nach der Login-Prüfung, dann der Plan (pgTAP `28`, `db-sync.test.ts`).
  pgTAP (eine Verbindung) prüft die Struktur (`28`). **Zwei Verbindungen im Harness nachgestellt** (`race.sh`): (a)
  Speichern läuft, Widerruf kommt dazu → Widerruf wartet ca. 2 s, danach **0 Pläne**; (b) Widerruf läuft, Speichern kommt
  dazu → „Für diesen Essensplan fehlt die Einwilligung.“, 0 Pläne; **Gegenprobe ohne Sperre:** Widerruf wartet nicht,
  **1 Plan mit `uses_health_data = true` bleibt** (der Fehler aus dem Bericht); (c) **`append_plan_block` ↔ Widerruf**
  (`race.sh append_revoke`, Verzögerung vor der Einwilligungs-Sperre in `plan_health_basis`): neue Fassung → Folgeblock
  gespeichert, Widerruf wartet und löscht danach den Plan (0 Pläne mit Gesundheitsbezug, 0 Einheiten); **Gegenprobe mit
  der alten Fassung aus `20261005130100` → „deadlock detected“**. Nicht nachgestellt: dieselbe Lage für
  `save_training_plan` (gleiche Sperre über `plan_health_basis`) und für direkte Einfügungen in `body_metrics`/
  Unverträglichkeiten über RLS (bestehendes Verhalten seit Phase 1, eigene Etappe).
- **S3 – doppelte Zutaten:** Ersatz, Weglassen und Tausch je Zutat-Stelle (`index`) in Core-Payload
  (`ingredientChangeSchema`, `ingredientOmissionSchema`, je Stelle höchstens eine Änderung), Spalten (`omitted_optional`
  jetzt `jsonb`), Server-Prüfung über `recipe_ingredients.position` und Testmodus-Export. Tests: Milchreis mit Milch an
  Stelle 0 (Pflicht, ersetzt) und 2 (optional, weggelassen) → gespeichert; nur eine Stelle geändert → abgelehnt; Index
  auf andere Zutat, Pflicht-Milch weglassen, Stelle doppelt geändert, Paar ohne Index → abgelehnt; Core-Tests mit
  doppelter Zutat.
- **S4 – `db-migrate` erst nach grünem `db-test`:** `db-test` ist zusätzlich `workflow_call`; `db-migrate` ruft ihn als
  ersten Job auf, der Einspiel-Job hat `needs: db-test` (rot → nichts eingespielt, `content-seed` startet dann auch
  nicht). Concurrency von `db-test` enthält jetzt den Workflow-Namen (ein paralleler Lauf auf main bricht den Test vor
  dem Einspielen nie ab). Supabase-CLI fest `2.120.0` in `db-test`, `db-migrate`, `db-types` (die Version, die `db-test`
  seit 06.10. mit `latest` nutzte). Secrets und Passwort-Maskierung unverändert. **G-W2 damit erledigt.**
- **H1 – Größen:** früh geprüft: Essensplan ≤ 256 KiB (`MEAL_PLAN_PAYLOAD_MAX_BYTES`), höchstens 20 Zutaten-Änderungen
  je Mahlzeit (= Zutaten je Rezept), Index 0–19; Einkaufsliste ≤ 2 MiB (`SHOPPING_LIST_PAYLOAD_MAX_BYTES`), höchstens 50
  Ersatz-Verweise je Eintrag (= Core-Schema). Herleitung in `constants.ts`; db-sync und pgTAP.
- **H4 – Bewertungs-Limit:** gezählt wird nur bei einer NEUEN Bewertung; Upsert einer vorhandenen bei 2.000 geht (pgTAP).
- **H8 – Namen der Prüfenden:** `seed_nutrition_content` ersetzt `reviewed_by`, `catalog_reviewed_by`,
  `import_assumptions_confirmed_by` und `cost_estimate.reviewed_by` durch „redaktion“ und setzt `review_note` auf null
  (`private.content_without_reviewer_names`); Prüfvermerk, Datum, `expert_reviewed` und `import_assumptions*` bleiben
  (K9, Zod-Schemas der App weiter gültig). pgTAP: kein Name und keine Prüfnotiz in `data`.
- **H11 – Security Advisor:** HANDY-ANLEITUNG 7d warnt vor den erwarteten Meldungen zu `security definer`-Funktionen.
- **H15 – gleichzeitiges erstes Speichern:** `save_meal_plan`/`replace_shopping_list` nehmen eine Transaktions-Sperre
  je Person und Woche (`pg_advisory_xact_lock`) vor der Einwilligungs-Sperre – nach der Nachprüfung mit **demselben
  Schlüssel** (`nutrition_week|Person|Woche`), damit Plan und Liste derselben Woche nie gleichzeitig geschrieben werden
  und `replace_shopping_list` den Plan der Woche (Verweis, Gesundheitsbezug) konsistent liest (pgTAP `28`,
  `db-sync.test.ts`). Harness: zwei gleichzeitige erste Speicherungen → beide erfolgreich, der spätere ersetzt (1 Plan);
  Gegenprobe ohne Sperre → „Ungültige Werte im Essensplan.“ (Unique-Fehler). `race.sh save_then_list`: Plan wird
  gespeichert, Liste derselben Woche kommt dazu → Liste wartet ca. 2 s und verweist auf den neuen Plan; Gegenprobe mit
  eigenem Schlüssel → Liste wartet nicht, `meal_plan_id` leer (Plan noch nicht sichtbar, Gesundheitsbezug des Plans
  übersehen).
- **H12 (vermerkt):** vor dem Merge im Table Editor prüfen, dass es `foods`/`recipes`/`guides`/`meal_plans` live nicht
  gibt (HANDY-ANLEITUNG 7d Schritt 1; laut Koordinator geprüft).
- **Nur dokumentiert (Teil 2 bzw. Gründer):** **H3** Gesundheitsbezug bleibt nach neuer Textfassung ohne
  Neu-Einwilligung bestehen (Unverträglichkeiten, alter Plan) → jedes Speichern „Einwilligung fehlt“; Teil 2 braucht dafür
  einen klaren Zustand („Einwilligung erneuern oder Unverträglichkeiten löschen“). **H5** vergangene Tage werden auf dem
  Server nicht gefiltert → Teil 2 prüft gelesene Pläne erneut (Zod, Filter). **H6** Kalorien-Grenzen und
  `pregnancy_caution` nur im Core (bewusst, S9/R2-K8) → G-W3. **H7** `delete_stored_intolerances` löscht alle Pläne/Listen
  mit Gesundheitsbezug (auch nur wegen Körperdaten markierte) – sichere Richtung wie im Testmodus; im Dialogtext von
  Teil 2 erwähnen. **H9** archivierte Rezepte sind für Nutzer nicht lesbar → Teil 2 zeigt „Rezept nicht mehr
  verfügbar“. **H2** (Temp-Tabellen), **H10** (Log-Einstellung, jetzt in KONZEPT 12), **H13** (Harness ≠ echtes
  Supabase – prüft `db-test`), **H14** (`db-types` nur manuell) vermerkt.

**Offen für die Gründer (N7):**

- **G-N7-1:** Teil 2 wie vorgeschlagen bauen (Rekonstruktion ohne Planband, s. o.)? _Empfehlung: ja._
- **G-N7-2:** Löschfrist für alte Essenspläne/Einkaufslisten (`MEAL_PLAN_RETENTION_WEEKS = 4`, Wächter N5a) –
  weiter offen; ohne Entscheidung bleiben alte Wochen bis Widerruf/Löschen/Konto löschen.
- **G-N7-3:** Die Fachprüfung (Gründer-Entscheidung 6) ist jetzt auch serverseitig Pflicht: Ohne
  `expert_reviewed` spielt `seed_nutrition_content` nichts ein. Wer übernimmt die Prüfung und bis wann?
- **G-W1 (neu, Wächter S1):** Merge-Reihenfolge und REVOKE: _Jetzt: ein PR; die App fällt tolerant zurück, das REVOKE
  bleibt, weil es keine Nutzer und keine verteilten Builds mit Supabase-Schlüsseln gibt. Nach dem Merge erst
  `db-migrate` grün, dann neu ausrollen/bauen._ Bitte bestätigen.
- **G-W2 (neu, Wächter S4):** `db-migrate` an `db-test` gekoppelt – **erledigt** (s. o.). Optional zusätzlich
  Branch-Protection mit Pflicht-Check `db-test` (SETUP J2).
- **G-W3 (neu, Wächter H6):** Soll der Server doch eine Mindest-Plausibilität der Tageskalorien prüfen (z. B. Tagessumme ≥
  Grundumsatz aus den gespeicherten Körperdaten, mit Ablehnung), damit die Schutzgrenze auch gegen manipulierte Clients
  greift? _Empfehlung: ja, mit Teil 2._
- Weiter offen: Zitat-/Wertprüfung aus N1 K6, Live-Test (Teil 8), Premium-Prüfung mit Phase 7 (19.9, 16 B (l)).

### Umsetzungsstand N7 Teil 2 (16.10.2026): App im Supabase-Modus für die Ernährung (ohne Commit)

**Gründer-Entscheidungen 16.10.2026 (alle „wie empfohlen“):** G-N7-1 Teil 2 wie vorgeschlagen; G-N7-2 Löschfrist
**4 Wochen** (`MEAL_PLAN_RETENTION_WEEKS = 4`), auf dem Server bei jedem Speichern und täglich über `pg_cron`, im
Testmodus genauso; G-N7-3 Fachprüfung bleibt offen, `seed_nutrition_content` unverändert, die App zeigt einen klaren
Leer-Zustand; G-W1 ein PR, die App fällt tolerant zurück, bis `db-migrate` durch ist; G-W3 der Server prüft die
Mindest-Plausibilität der Tageskalorien gegen den Grundumsatz (Formel identisch zum Core).

**Was jetzt gilt:**

1. **Rekonstruktion ohne Planband/`safetyKey` (Vorschlag Nr. 1, Wächter N5a S4):** Core
   `nutrition/meal-plan-record.ts` – `mealPlanWeekFromRecord` baut den Plan aus den Zeilen (`meal_plan_items` als
   Payload) und dem Bestand: Mahlzeiten neu über `scalePortion` (Rezept, Version, Faktor, Ersatz, Weglassen, Tausch),
   Band und Schlüssel aus den aktuellen Zielen, **Modus aus `day_status`** (passt er nicht zum aktuellen Modus, bekommt
   der Tag den anderen Modus und den Schlüssel `reconstructed:mode_changed` → 6.6 plant ab heute sicher neu),
   Hinweise wie `finishDay`, keine leeren Plätze. `resolveMealPlanRecord` führt danach die normale Prüfung 6.6 aus. Der
   vollständige Plan bleibt im **geschützten Speicher** (`nutritionCache`, App: verschlüsselt; Browser: nur
   `sessionStorage`) und wird nur genutzt, wenn er zu den Zeilen passt (`mealPlanPayloadMatches`). Dokumentierter
   Unterschied: ein reiner Deckel-Wechsel, bei dem der Plan im neuen Band liegt, plant auf einem neuen Gerät nicht neu
   (Test „nur Deckel geändert“).
2. **Speichern (Nr. 2):** `save_meal_plan` + `replace_shopping_list` (nacheinander, nicht atomar – die Liste wird bei
   jedem Laden aus dem Plan neu abgeglichen). Plan speichern nur online; **Abhaken und Kochtag ohne Gesundheitsbezug
   offline über die normale Warteschlange** (`set_shopping_item_checked`, `set_cook_day_start`), mit Gesundheitsbezug
   sofort (`online_only`). Vergangene Tage bleiben beim erneuten Speichern unverändert (`withPreservedPastItems`).
   Fehler wie im Testmodus (`plan_rejected`, `consent_required`).
3. **Bestand aus der Datenbank (Nr. 3):** `loadNutritionLibrary` liest `foods`, `recipes`, Packungsgrößen,
   Ersatzprodukte und Austausch-Tabelle → `validateContent` (`checkedAtSeed`: R17 und der Abgleich mit der
   Erwartungsliste entfallen, weil `content-seed` sie vorher geprüft hat; alle anderen Regeln laufen) →
   `selectNutritionContent({ allowDrafts: false })`. Offline aus dem Inhalts-Zwischenspeicher (keine Nutzerdaten).
   **Ohne freigegebene Rezepte** (Fachprüfung offen, G-N7-3): klarer Leer-Zustand „Die Rezepte werden gerade fachlich
   geprüft …“ (`awaitingReview`, testID `nutrition-no-recipes`).
4. **`content-seed` Ernährung (Nr. 4):** `buildNutritionSeedPackage` – nur `published` **und** `expert_reviewed`
   (Lebensmittel zusätzlich katalog-geprüft, Packungsgrößen mit Prüfvermerk), Verweise geschlossen (Fixpunkt über
   Ersatzprodukte); was wartet, steht mit Grund in der Zusammenfassung. **Schutz vor Massen-Archivierung** für alle
   Arten **vor** dem ersten Einspielen (`findNutritionMassArchive`, wie bei Übungen; nur per Hand mit
   `allow_mass_archive`). Fehlen die Ernährungs-Tabellen (vor `db-migrate`), wird die Ernährung mit Hinweis
   übersprungen.
5. **`supportsNutrition = true`** im Supabase-Modus, inkl. Schritt `nutrition_setup` (R2-S3).
6. **S1-Rückfall entfernt (Nr. 7):** fehlt `delete_stored_intolerances`, kommt der Fehler `delete_unavailable`
   („Löschen ist gerade nicht möglich – bitte versuche es später erneut.“), nichts wird halb gelöscht; danach wird der
   Ernährungs-Zwischenspeicher geleert.
7. **Tagebuch (E1) und eigene Gerichte (E2) im Supabase-Modus:** dieselben Regeln wie im Testmodus vorab, dann über die
   **verschlüsselte Ernährungs-Warteschlange** (`nutrition-sync.ts`, `NutritionQueue`) an `save_food_log_entries`,
   `delete_food_log_entry`, `save_custom_meal`, `delete_custom_meal` (je Schlüssel zusammengefasst, Basis-Revision
   vererbt, höchstens 5 Versuche). **Abgelehnte Fassungen bleiben lokal** (G3) und werden nur auf Wunsch verworfen
   („Verwerfen“ im Hinweis `NutritionSyncNotice`); ist der geschützte Speicher nicht beschreibbar, wird sofort gesendet.
   Favoriten direkt (Schnell-Favoriten mit kcal = Gesundheitsbezug → sofort). Abmelde-Nachfrage und Export-Hinweis
   zählen wartende Ernährungs-Einträge mit. Widerruf, ein fremdes Konto auf dem Gerät und das Löschen der lokalen
   Daten leeren Ernährungs-Zwischenspeicher und -Warteschlange.
8. **Löschfrist G-N7-2:** Core `mealPlanRetentionStart(today)` = Montag der laufenden Woche − 4 Wochen. Server:
   `private.purge_expired_nutrition_weeks(p_user_id)` (security definer, nur `service_role`) am Ende von
   `save_meal_plan` und `replace_shopping_list` (nur für die speichernde Person) und täglich um 02:23 UTC als
   `pg_cron`-Job `nutrition-weeks-retention` (für alle). Gibt es `pg_cron` nicht, überspringt die Migration den Job mit
   Hinweis. Testmodus: beim Laden und nach jedem Speichern (`pruneExpiredNutritionWeeks`). Das Tagebuch ist **nicht**
   betroffen. **A2/A3:** Für Tage älter als die Frist gibt es keinen gespeicherten Plan mehr → „Dein Tag“ und die
   Wochenauswertung zeigen dort den bestehenden Hinweis „Für diesen Tag ist kein Essensplan gespeichert …“ (A2 S1);
   Balken und Auswertung aus dem Tagebuch bleiben.
9. **G-W3 Mindest-Plausibilität:** `save_meal_plan` lehnt einen Plan ab, wenn ein Tag ab heute mit Status `complete`
   oder `no_targets` in der Summe (+ 1 kcal Rundung) unter dem Grundumsatz liegt: `private.meal_plan_day_kcal_floor` =
   max(Mifflin-St Jeor mit dem Grenzen-Offset – divers/keine Angabe +5 –, Katch-McArdle nur mit Körperfett ≤ 90 Tage) ×
   `MIN_INTAKE_RELATIVE_TO_BMR`; je Feld der neueste Körperwert, künftige Messdaten zählen als heute. **Keine Prüfung**
   (null, wie Modus `no_targets`) ohne gültige Einwilligung, bei Schwangerschaft oder ohne Größe/Gewicht; `below_floor`
   bleibt erlaubt (der Core kennzeichnet ihn selbst). Meldung **ohne Werte**: „Der Essensplan liegt an einem Tag unter
   deinem Grundumsatz – bitte neu erstellen.“ Core-Gegenstück `nutrition/plausibility.ts` (`serverDayKcalFloor`,
   `mealPlanDaysBelowFloor`; der Faktor kommt aus `limits.ts`, `bmrIntakeFloorKcal`). **Seit der Wächter-Prüfung (H1,
   unten) summiert der Server dabei seine EIGENEN Nährwerte**, nicht die Angaben des Geräts.
10. **H3:** Ist die Einwilligung ungültig (neue Textfassung oder fehlt), wird ein gespeicherter Plan mit
    Gesundheitsbezug dieser Woche vor dem Speichern gelöscht (RLS: eigene Zeile) und durch einen Plan ohne
    Gesundheitsdaten ersetzt – wie im Testmodus. Scheitert das Speichern trotzdem an der Einwilligung, zeigt die App
    „Einwilligung bestätigen oder Unverträglichkeiten löschen“ (`ConsentBlockedNotice` Variante `save`, Knopf
    „Einwilligung prüfen“) statt still zu wiederholen; der Löschknopf steht jetzt auch bei `consent_outdated`. **H5:** gelesene Pläne
    werden mit Zod und den aktuellen Filtern erneut geprüft (Rekonstruktion + 6.6). **H7:** Der Dialog „Unverträglichkeiten
    löschen“ nennt jetzt auch Pläne/Listen, die nur wegen Körperdaten oder Gesundheits-Check als Gesundheitsdaten
    gelten. **H9:** archivierte bzw. nicht mehr lesbare Rezepte: ab heute wird neu geplant (`recipe_excluded`), an
    vergangenen Tagen steht „Rezept nicht mehr verfügbar“ (`UnavailableMealRows`).

**Präzisierungen (sichere Voreinstellung, bei Bedarf entscheiden):**

- Plan und Einkaufsliste werden als zwei Aufrufe gespeichert; bricht der zweite ab, gleicht die App die Liste beim
  nächsten Laden neu ab.
- Die Körperdaten-Zeile von „morgen“ zählt auf dem Server als heute (Europe/Berlin). Liegen App und Server um
  Mitternacht an verschiedenen Tagen, kann G-W3 in seltenen Fällen einmal ablehnen; „neu erstellen“ hilft.
- `content-seed` spielt nur fachlich geprüfte Inhalte ein (sonst schlüge `seed_nutrition_content` für das ganze Paket
  fehl); ohne Fachprüfung bleibt die App im Leer-Zustand.
- `checkedAtSeed` ist eher strenger als im Repo (die Ausnahmeliste der R18-Pflichtregeln fehlt in der App): ein
  Lebensmittel mit eingecheckter Ausnahme würde in der App aussortiert – dann Claude Bescheid geben.
- Ernährungs-Zwischenspeicher: Tagebuch-Fenster wie beim Training (`LOG_CACHE_WEEKS`).

**Gegenproben (Regel absichtlich gebrochen → Test rot → zurückgesetzt):** `MEAL_PLAN_RETENTION_WEEKS = 5` → 2 rot
(Core-Löschfrist, db-sync); divers mit weiblichem Offset → 3 rot (Eigenschaftstest gegen `bmrForFloor`, Grenzfälle,
Core = pgTAP-Werte); `reconstructedMode` immer aktueller Modus → rot („Modus aus day_status“); Schlüssel trotz
Moduswechsel normal → rot; SQL ohne G-W3-Block → 8 pgTAP-Tests rot (u. a. 1.748,9 + 1 < 1.750, 16 und 95 Jahre,
Katch); SQL ohne Löschlauf beim Speichern → 5 pgTAP-Tests rot; Abhaken mit Gesundheitsbezug als nicht sensibel →
rot (offline über die Warteschlange); Essenspläne im normalen Zwischenspeicher → rot.

**Prüfung (lokal):** `pnpm turbo run lint typecheck test --force` grün (core 4.054, mobile 638, content 434 + 6 übersprungen, web 110, ui 54, db 6 Tests);
`pnpm format:check` grün; pgTAP im Harness (Postgres 16 + Supabase-Ersatz) **31 Dateien, 1.555 Tests grün** (neu: `33`
mit 41 Tests; `pg_cron` gibt es im Harness nicht – geprüft wird, dass die Migration dann ohne Fehler durchläuft); mobile
e2e (Chromium aus `/opt/pw-browsers`, Testmodus): alle 101 grün, 2 übersprungen.

**Wächter-Prüfung N7 Teil 2 (16.10.2026): „Freigabe mit Auflagen“, alle Auflagen umgesetzt** (Bericht
`waechter-n7-teil2.md`):

- **H1 – G-W3 gegen veränderte Apps:** `save_meal_plan` rechnet die Nährwerte jeder Mahlzeit selbst
  (`private.meal_plan_item_nutrients` = `scalePortion`, gleiche Reihenfolge der Operationen in double precision:
  Weglassen → Tausch mit Menge aus der Austausch-Tabelle → Ersatzprodukt → Menge × Faktor ÷ Portionen bzw. ÷ Portionen
  ohne Skalierung → `roundAmount` (Eier ganz, nie 0) → Gramm → Summe der nicht optionalen Zutaten; gerundet wie
  `toMealPlanPayload`). Vergangene Tage übernehmen die Werte derselben Mahlzeit aus dem bisherigen Plan der Woche (gleicher
  Tag, Platz, Rezept, Version, Faktor, Zutaten-Änderungen); eine ältere Rezept-Fassung ohne solches Gegenstück ist nicht
  nachrechenbar → abgelehnt. **Gewählt (sichere Richtung): beides** – gespeichert, exportiert und für G-W3 summiert
  werden nur die Server-Werte, UND eine Angabe des Geräts, die um mehr als `MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE` (1 kcal,
  0,1 g) abweicht, lehnt den Plan ab („Die Nährwerte im Essensplan passen nicht zu den Rezepten – bitte neu erstellen.“,
  ohne Werte). Nachgewiesen: pgTAP 33 (Fälle c1–c5 mit Rundung g/ml/Stück/EL/Prise, Ersatz, Weglassen, Tausch zu Tofu
  und zu Ei; die erwarteten Werte rechnet `server-meal-values.test.ts` mit dem Core nach); **Angriff „Faktor 0,5,
  behauptet 5.000 kcal“ → abgelehnt**; mit ehrlichen Werten greift G-W3 auf der Server-Summe; gespeichert werden
  Server-Werte; vergangener Tag mit veränderter Angabe → Server-Wert bleibt. **Kreuzvergleich im Harness:** 11.070
  Mahlzeiten aus echten Engine-Plänen (160 Wochen, 1–8 Mahlzeiten, vier Ernährungsprofile inkl. Laktose-/Gluten-
  Ersatz) und synthetischen Tauschen (6.444 Fälle mit Zutaten-Änderung) mit dem N3-Bestand und `DEMO_SUBSTITUTIONS` –
  **0 Abweichungen**, 0 nicht berechenbar. Doku in `constants.ts` (`MEAL_PLAN_DAY_KCAL_CHECK`,
  `MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE`) entsprechend formuliert. Die Migration `20261016120000` war noch nicht in `main`
  und wurde deshalb direkt ergänzt (kein Zusatz-Zeitstempel); pgTAP 25/26 senden jetzt nachgerechnete Werte.
- **M1 – leere Tage / `below_floor` ab heute:** `mealPlanWeekFromRecord` gibt solchen Tagen den Schlüssel
  `RECONSTRUCTED_INCOMPLETE_KEY` → 6.6 plant ab heute neu (`caps_changed`); vergangene leere Tage bleiben (Test).
  **Server-Regel nicht umgesetzt (dokumentiert):** Die Engine liefert selbst Tage mit `below_floor` (zu wenig passende
  Rezepte, Meal-Prep-Vorgaben) und leere Tage – eine Ablehnung würde ehrliche Pläne sperren. Eine veränderte App kann
  einen Tag so kennzeichnen und G-W3 damit umgehen; gespeichert werden trotzdem die Server-Werte, und jedes Gerät plant
  den Tag beim Rekonstruieren neu. Nebenwirkung: Ein echter `below_floor`-Tag wird auf einem neuen Gerät einmal neu
  geplant (gleiches Ergebnis, Hinweis „angepasst“).
- **M2 – Wettlauf Widerruf/Abmelden ↔ Senden:** `NutritionQueue` hat eine Generation (`clear()` erhöht sie, ein
  Senden aus der alten Generation verwirft sein Ergebnis und speichert nichts) und eine Sperre (`setLocked`/`idle`
  wie `logQueue`): Widerruf und Löschen der lokalen Daten sperren, warten das laufende Senden ab und leeren dann;
  Einreihen während der Sperre → `temporary` (nichts gesendet, nichts behalten). Tests: Widerruf während eines hängenden
  Tagebuch-Sendens → Speicher leer, 0 wartend, 0 abgelehnt; `clear()` während `send` → späte Ablehnung verworfen.
- **M3 – pg_cron sichtbar:** NOTICE mit `SQLSTATE` (ohne Meldungstext). `db-migrate` hat einen Schritt „Täglichen
  Löschlauf prüfen“: liest `cron.job` (Job vorhanden, aktiv, Rolle `postgres`) und den letzten Lauf aus
  `cron.job_run_details`, schreibt alles in die Summary und warnt **gelb** (`::warning::`), nicht rot – die Migrationen
  sind dann schon eingespielt, rot würde nur `content-seed` blockieren; die Löschung beim Speichern wirkt ohnehin. Keine
  Secrets in der Ausgabe (Passwort maskiert, nur Job-Daten). Lokal mit nachgebautem `cron`-Schema geprüft (fehlt / leer
  / ok / falsche Rolle + „failed“). HANDY-ANLEITUNG 7d Schritt 8: Summary lesen, History auf **succeeded** prüfen.
- **N1** Kommentar im pgTAP-Test korrigiert (Reihenfolge prüft `db-sync.test.ts`). **N2** `content-seed` liest den
  Bestand seitenweise (`order=id`, `limit`/`offset`, Gesamtzahl aus `Content-Range` mit `Prefer: count=exact`) – für
  Übungen/Vorlagen und Ernährung; Test mit 2.500 Einträgen und einem Server, der nur 300 je Seite liefert.

**Gegenproben (Wächter-Auflagen):** ohne Abweichungs-Prüfung → 2 pgTAP rot (Angriff 5.000 kcal, Eiweiß 0,2 g);
Geräte-Werte gespeichert → 2 rot (Server-Werte, vergangener Tag); G-W3 auf der Geräte-Summe ohne Prüfung (alter
Stand) → rot; Rundungsgrenze 10 statt 20 g in SQL → pgTAP c2 und db-sync rot; Spielraum 2 kcal im Core → 2 rot;
M1-Bedingung entfernt → rot; Generation entfernt → rot, Generation und Sperre entfernt → beide M2-Tests rot;
seitenweises Lesen nach der ersten Seite abgebrochen → rot.

**Offen für die Gründer (N7 Teil 2):**

- **G-N7-4 (neu):** Vor dem Livegang eine neue Fassung des `health_data`-Einwilligungstexts, die Essenspläne,
  Ernährungstagebuch und die 4-Wochen-Frist nennt (juristisch prüfen) – bis dahin gilt der bisherige Text.
- **G-N7-3:** Fachprüfung (wer, bis wann) – bis dahin zeigt die App den Leer-Zustand.
- **G-N7-5 (neu, E1 H4):** Soll der Server „Gegessen“ aus dem Plan gegen den gespeicherten Plan prüfen? _Jetzt:
  nicht umgesetzt; der Server rechnet die Werte nach (E1-G4), prüft aber nicht, ob die Mahlzeit im Plan stand._
- `pg_cron` auf dem echten Supabase prüfen (HANDY-ANLEITUNG 7d, Schritt 8); ohne Job greift die Frist nur beim
  Speichern.
- Weiter offen: Zitat-/Wertprüfung (N1 K6), Live-Test mit zwei Geräten (HANDY-ANLEITUNG Teil 8, neue Punkte 16–20).

### N8 – KI-Rezepte offline + Anbieterwechsel auf Google Gemini (umgesetzt, 15.10.2026, ohne Commit)

**Gründer-Entscheidung 14.10.2026: „KI läuft über Gemini – überall“** (Offline-Content-Generierung und später
Premium). Die zugehörige CLAUDE.md-Änderung liegt als PR #62 offen (nur Gründer mergen); diese Etappe ändert CLAUDE.md
nicht. Das GitHub-Secret `GEMINI_API_KEY` ist laut Gründern eingetragen.

**Was jetzt gilt:**

1. **Anbieter Gemini, Claude-Pfad entfernt.** `@anthropic-ai/sdk` ist aus `packages/content` entfernt; nichts anderes
   hing davon ab (geprüft: nur Pipeline, CLI, Tests). Neu: anbieter-neutrale Schnittstelle
   `pipeline/provider/types.ts` (`ContentApiClient`: `countTokens`, `createBatch`, `getBatch`; neutrales
   `BatchResult`) und die Umsetzung `pipeline/provider/gemini.ts` mit dem offiziellen SDK **`@google/genai` 2.27.0**
   (fest gepinnt, Veröffentlichung 02.10.2026). `generate`, `collect`, `results`, `dry-run` kennen nur noch die
   Schnittstelle.
2. **API-Form (Gemini Batch API, eingebettete Anfragen):** `batches.create({ model, src: InlinedRequest[] })` →
   `POST /v1beta/models/{model}:batchGenerateContent`; jede Anfrage trägt `metadata.key = custom_id`, als Konfiguration
   `systemInstruction`, `responseMimeType: "application/json"`, `responseJsonSchema` (aus dem Zod-Antwort-Schema),
   `maxOutputTokens` (= bisherige Höchstzahl je Art, bei Gemini 3 inkl. Denken) und
   `thinkingConfig.thinkingLevel` (= `CONTENT_EFFORT`: `minimal|low|medium|high`, Standard je Art, s. Punkt 3). Stand über
   `batches.get({ name })`, fertig bei `JOB_STATE_SUCCEEDED|PARTIALLY_SUCCEEDED|FAILED|CANCELLED|EXPIRED`; Antworten in
   `dest.inlinedResponses`. Kosten vorab: `models.countTokens` (kostenlos) je Anfrage. Quellen: Google Gemini Cookbook
   `quickstarts/Batch_mode.ipynb` und `Get_started.ipynb` (github.com/google-gemini/cookbook, Stand 15.10.2026), SDK
   `@google/genai` (Typen `InlinedRequest`, `BatchJob`, `GenerateContentConfig.responseJsonSchema`).
3. **Modell und Kosten (Gründer-Vorgabe 15.10.2026: „günstiges Modell, nicht zu viele Kosten bei Gemini“):**
   Standard **je Inhaltsart** (`defaultModel`/`defaultEffort` in `kinds/*.ts`), änderbar je Lauf über die Workflow-
   Eingabe **„modell“** bzw. dauerhaft über die GitHub-Variablen `CONTENT_MODEL`/`CONTENT_EFFORT` (gelten dann für alle
   Arten):

   | Art                             | Modell                  | Denktiefe | Grund                                                            |
   | ------------------------------- | ----------------------- | --------- | ---------------------------------------------------------------- |
   | Packungsgrößen, Austausch       | `gemini-3.5-flash-lite` | `low`     | eng begrenzt (eine Zahl bzw. ≤ 4 Katalog-IDs + Faktor), R23/R24  |
   | Rezepte, Übungen, Plan-Vorlagen | `gemini-3.8-flash`      | `medium`  | viel Fachlogik (Allergene, Schwangerschaft, Nährwerte, Training) |

   **Begründung:** `gemini-3.5-flash-lite` ist das günstigste Modell, das die offizielle Batch-Anleitung (Google Gemini
   Cookbook `quickstarts/Batch_mode.ipynb`, Stand 15.10.2026) ausdrücklich als Batch-Modell nennt („fastest,
   lowest-cost model in the 3.5 family“); strukturierte Ausgabe per `responseJsonSchema` ist eine Funktion der
   `generateContent`-Konfiguration, die auch Batch-Anfragen nutzen. `gemini-3.1-flash-lite` (SDK-Typen, kein
   Preview) wäre laut Preisvergleichsseiten noch günstiger, steht aber nicht in der Batch-Liste des Cookbooks – nur als
   Option mit Preis hinterlegt (lehnt die API es ab, scheitert der Lauf kostenlos). Für Rezepte ist Flash-Lite fachlich
   fraglich (Allergen- und Schwangerschafts-Gegenprüfung, Nährwert-Rechnung) – daher `gemini-3.8-flash` (Standard-Modell
   beider Cookbook-Anleitungen, ohne „-preview“). Denktiefe so niedrig wie sinnvoll (Denk-Token zählen als Ausgabe).
   **Deckel:** `CONTENT_MAX_USD` Standard **3 $** pro Lauf (vorher 15 $), harte Obergrenze **20 $** (vorher 100 $);
   Workflow-Eingabe „anzahl“ Standard **3** (vorher 10). Ein Modell ohne Preis in `pricing.ts` bricht vor dem ersten
   API-Aufruf ab (Kostendeckel fällt nie still aus).

4. **Gleiche Prüfkette wie bisher:** Antwort → JSON → Zod-Antwort-Schema (inkl. aller Grenzen) → Datei-Schema (R1/Ü1)
   → Entwurf `status: draft`, `meta.origin: batch`, `meta.model`, `meta.batch_id` (Gemini `batches/…`),
   `expert_reviewed: false` → `content:validate` (alle Regeln) → Pull Request. Freigabe nur über `content-review` +
   menschlichen Merge. Probelauf ohne Schlüssel unverändert (feste Antworten, keine Kosten).
5. **Neue Batch-Art `recipes`** (`kinds/recipe.ts`): Matrix Mahlzeit (3) × Ernährungsform (3) × Schwerpunkt `alltag`,
   `schnell`, `meal_prep`, `ohne_kochen`, `nach_training` (5) = 45 Zellen; das Modell wählt die ID (wie Übungen,
   Kollisionen → „ID existiert bereits“). Zutaten **nur Katalog-IDs** (katalog-geprüft R19, ohne Alkohol R12) als
   `enum` im Schema; feste Matrix-Werte im Schema bzw. per Zod (`meal_types` enthält die Mahlzeit, `vegan`/
   `vegetarian` fest, `no_cook`/`meal_prep.suitable` fest beim Schwerpunkt, „schnell“ ≤ 10 min, „nach dem Training“
   mit Tag). System-Text: Health-Claims-Liste (R10, `HEALTH_CLAIM_TERMS`), verbotene medizinische Begriffe, Marken,
   kein Alkohol, Allergen-Gruppen (alle 23 mit Bedeutung), Regeln zu Ernährungsform, Schwein, Schwangerschaft
   (5.2 R2-S2), `heated`, `no_cook` (R14), Meal-Prep (R9), Mengen (R11), kcal-Richtwerte (R5); Katalog je Lebensmittel
   mit Nährwerten, umrechenbaren Einheiten (R2), Gruppen, tierischen Bestandteilen, Fleischart, Schwangerschafts-
   Hinweis, Kühlschrank-Tagen. Anfrage je Zelle mit vorhandenen Rezepten derselben Mahlzeit/Ernährungsform.
6. **Workflows:** `content-generate.yml` mit Art `recipes`, Eingabe „modell“, Secret `GEMINI_API_KEY` statt
   `ANTHROPIC_API_KEY` (im Probelauf wird der Schlüssel gar nicht übergeben); `content-collect.yml` mit
   `GEMINI_API_KEY`. Schlüssel nur im jeweiligen Schritt, von GitHub maskiert, vom Skript zusätzlich geschwärzt
   (`redactSecret` in Fehlermeldungen und Berichten), nie in Merkdatei/Entwürfen/Pull Requests; keine Artefakte.
   actionlint grün.
7. **Datenschutz:** An Gemini gehen ausschließlich Inhalts-Prompts (Rollen-Text, Regeln, Katalog, Matrix-Werte,
   vorhandene Inhalts-IDs/-Titel) – **nie Nutzerdaten**; die Pipeline hat keinen Supabase-Zugriff. Deshalb ist für die
   Offline-Erzeugung kein AVV nötig; vor Premium-Echtzeit-KI schon (KONZEPT 14/15, SETUP Teil E – Gründer-Aufgabe).
8. **Admin-Texte anbieter-neutral:** Herkunft `batch` = „KI-Entwurf (Batch-API, Modell siehe unten)“, Hinweis
   „Dieser Inhalt wurde von einer KI erstellt …“ (vorher „Claude“).

**Präzisierungen (vom Plan nicht ausdrücklich geregelt, vorsichtig gelöst):**

- **Batch statt synchroner Aufrufe:** Der Ablauf generate → (warten) → collect passt 1:1 zur Gemini Batch API (halber
  Preis, Ziel 24 Stunden). Eingebettete Anfragen statt JSONL-Datei: höchstens 200 Anfragen je Lauf, Größe vor dem
  Senden geprüft (19 MB, API-Grenze 20 MB) – sonst Abbruch „Batch zu groß“, nichts gesendet.
- **Rate-Limit/Fehler:** Zählen und Abfragen: 408/429/5xx werden mit wachsender Pause (2/4/8/16 s, höchstens
  5 Versuche) wiederholt. Das **Anlegen** des Batches nur bei **429** (sicher abgewiesen, Wächter N8 S3) – bei 503 bzw.
  5xx könnte das Backend den Batch schon angenommen haben, ein zweiter Versuch wäre doppelt bezahlt. Zeitlimit je
  Aufruf **120 s** (`REQUEST_TIMEOUT_MS`, SDK `httpOptions.timeout`). Endet das Anlegen ohne HTTP-Status (Netzfehler,
  Zeitlimit) oder mit 5xx/408, meldet der Lauf **„AUSGANG UNKLAR – Batch wurde evtl. trotzdem angelegt“** mit dem
  **eindeutigen Anzeigenamen** `alpha5-<art>-<Datum>-<zufällig>` (in Google AI Studio unter „Batches“ zu finden) und
  „nicht sofort neu starten“ (Wächter N8 S2). Hinweis „GitHub-Secret GEMINI_API_KEY prüfen“ bei 401/403 **und** bei
  HTTP 400 mit „API key not valid“/`API_KEY_INVALID` – so antwortet die Gemini API real auf falsche Schlüssel (Wächter
  N8 S1). Fehlermeldungen tragen **kein** `cause` mehr (die SDK-Meldung wäre ungeschwärzt, Wächter N8 H1). Die
  SDK-eigenen Wiederholungen sind abgeschaltet (nachvollziehbar, testbar).
- **Zuordnung:** über `metadata.key` (= `custom_id`). Nur wenn **keine** Antwort eine Kennung trägt, gilt die laut
  API garantierte Reihenfolge der Anfragen als Rückfall; fehlt sie nur bei einzelnen, wird nicht geraten – die Antwort
  zählt als „unbekannte custom_id“, die Anfrage als Lücke „kein Ergebnis“ (Wächter N8 H2).
- **Teilergebnisse:** `CANCELLED`/`EXPIRED`/`FAILED` mit teilweisen Antworten → vorhandene werden verarbeitet, fehlende
  als „abgebrochen/abgelaufen/Fehler – erneut versuchen“ gemeldet; `PARTIALLY_SUCCEEDED` gilt als fertig.
- **Ende-Gründe:** `STOP` → auswerten; `MAX_TOKENS` → „abgeschnitten“; `SAFETY`, `RECITATION`, `BLOCKLIST`,
  `PROHIBITED_CONTENT`, `SPII` (und Bild-Varianten) sowie blockierte Anfragen (`promptFeedback.blockReason`) →
  „abgelehnt bzw. vom Sicherheitsfilter blockiert“; sonst „unerwarteter Stopp-Grund“. Denk-Teile (`thought`) werden nie
  als Antwort gelesen.
- **JSON-Schema für Gemini:** nur die laut SDK unterstützten Angaben (`type`, `enum`, `items`, `min/maxItems`,
  `minimum/maximum`, `anyOf`, `properties`, `required`, `additionalProperties`, `propertyOrdering`, …); `const` → `enum`
  mit einem Wert, Muster/Text-Längen entfernt. Zod prüft alle Grenzen danach wie bisher. Optionale Felder sind bei
  Gemini erlaubt (bei Claude mussten alle Felder Pflicht sein).
- **Token-Zählung:** Die Developer API zählt in `countTokens` keinen System-Text und keine Konfiguration – gezählt
  werden System-Text, Anfrage und Schema als Text (Näherung, eher zu hoch). Abgerechnet werden danach die gemeldeten
  Token (`promptTokenCount`; Ausgabe = `candidatesTokenCount` + `thoughtsTokenCount`), zwischengespeicherte Token
  vorsichtig zum vollen Preis.
- **Preise (vorsichtig, eher zu hoch):** Die offizielle Preisseite war aus der Sitzung nicht erreichbar (Netz-Sperre);
  Quellen sind mehrere Preisvergleichsseiten (u. a. openrouter.ai, eesel.ai, anotherwrapper.com, pricepertoken.com,
  lmmarketcap.com). Hinterlegt je 1 Mio. Token Eingabe/Ausgabe: `gemini-3.8-flash` **0,75 $ / 3,75 $** (Batch-Preis ab
  01.01.2027; bis 31.12.2026 laut Quellen 0,375 $ / 1,875 $), `gemini-3.5-flash-lite` **0,30 $ / 2,50 $** (Normalpreis,
  OHNE Batch-Rabatt), `gemini-3.1-flash-lite` **0,25 $ / 1,50 $** (Normalpreis, OHNE Batch-Rabatt; Batch laut Quellen
  0,125 $ / 0,75 $). Schlimmster Fall (nur Ausgabe) für 3 Anfragen: Rezepte ≈ 0,18 $, Packungsgrößen ≈ 0,03 $,
  Austausch ≈ 0,06 $; dazu die gezählte Eingabe.
- **Merkdatei Fassung 2** (`record_version: 2`, `provider: "gemini"`, `kind` + `recipe`): Claude-Merkdateien
  (Fassung 1) gab es nur auf Arbeits-Branches (heute keine offenen `content/batch-*`); content-collect meldet sie als
  ungültig, statt sie mit dem falschen Anbieter abzuholen.
- **Rezepte: deklarierte Angaben bleiben KI-Angaben.** `declared_per_serving`, `declared_diet`,
  `declared_allergens`, `contains_pork`, `declared_pregnancy_caution` werden NICHT aus dem Katalog überschrieben –
  sie sind wie bei allen Rezepten die Gegenprüfung (R3, R6, R7, R8, R13); weicht die KI ab, ist der Entwurf rot und nicht
  freigebbar. Die App nutzt ohnehin nur die berechneten Werte.
- **Rezepte: neue Lebensmittel nur als Vorschlag** (5.4): Feld `missing_foods_de` (höchstens 5) in der Antwort; es
  landet als Satz in `meta.review_note` („KI-Vorschlag fehlender Lebensmittel …“), nie als Zutat und nie in
  `content/foods/` (bleibt allein `foods-import` vorbehalten).
- **Rezepte: `heated` und `role` sind bei KI-Rezepten Pflicht** (für alle Zutaten, nicht nur Ei/Fisch/Fleisch) –
  strenger als das Datei-Schema, damit R1/R13 nie an einer fehlenden Angabe scheitern und der Austausch (N9) Rollen hat.
- **Rezepte ohne Katalog:** Gibt es keine katalog-geprüften Lebensmittel (heute in `main` der Fall), meldet ein echter
  Lauf „Rezepte gerade nicht möglich“ und sendet nichts (neue optionale Methode `unavailableReason` der Inhaltsarten).
  Der Probelauf geht trotzdem (Beispiel-IDs; fehlen sie im Katalog, meldet `content:validate` R2 rot – nicht
  blockierend für Entwürfe, Probelauf-Inhalte sind ohnehin nie freigebbar).
- **Rezepte werden nie „übersprungen“** (wie Übungen): Je Zelle sind viele Rezepte sinnvoll; Wiederholungen verhindert
  die Liste vorhandener Rezepte im Anfrage-Text und die ID-Prüfung.
- **Max. Ausgabe-Token Rezept:** 16.000 mit Denktiefe **`medium`** (Wächter N8 H4 + Gründer-Vorgabe „günstig“): Die
  JSON-Antwort braucht etwa 1.500–3.000 Token, es bleiben über 12.000 Token Reserve fürs Denken. Mit `high` wäre das
  knapp (abgeschnitten = bezahlt, aber verworfen); wer `CONTENT_EFFORT=high` setzt, prüft die ersten Läufe auf
  „abgeschnitten“. Schlimmster Fall 0,06 $ Ausgabe je Rezept.
- **Reihenfolge bei „alle“ (Wächter N8 H5):** Rezept-Zellen laufen Schwerpunkt → Mahlzeit → Ernährungsform (die ersten
  9 decken jede Mahlzeit × Ernährungsform ab) und sind um die Zahl vorhandener KI-Rezepte aus Batch-Läufen (nicht
  zurückgezogen, ohne Probelauf) modulo 45 gedreht – deterministisch aus dem Stand in `main`; nach jedem gemergten Lauf
  rückt der Start weiter. Die Summary echter Läufe nennt die Startstelle (`selectionNote`).

**Gegenproben (Tests, ohne Netz – Gemini immer gefälscht):**

- `pipeline/provider/gemini.test.ts` (24): realistischer ungültiger Schlüssel (HTTP 400 `API_KEY_INVALID`, S1),
  Anlegen bei Netzfehler/Zeitlimit „AUSGANG UNKLAR“ mit Anzeigename (S2), 500/503 beim Anlegen nicht wiederholt (S3),
  sicher abgewiesener 400 ohne „unklar“, kein Schlüssel in der Fehlerkette (`cause`, `util.inspect`, H1), gemischte
  Kennungen ohne Positions-Rückfall (H2); Anfrage-Format (`metadata.key`, JSON-Ausgabe, Schema, Denkstufe), nur
  Inhalts-Felder (keine Nutzerdaten, kein Schlüssel), Token-Zählung, **Rate-Limit** (429 → Wiederholung → Erfolg;
  dauerhaft 429 → Abbruch nach 5 Versuchen, kein Batch), 500 beim Anlegen nicht wiederholt, zu großer Batch, 401 mit
  geschwärztem Schlüssel, **Abbruch** (AbortError), Stand „läuft noch“, Zuordnung über `metadata.key` und Rückfall
  Reihenfolge, Ende-Gründe (abgeschnitten, Sicherheitsfilter, blockierte Anfrage, Fehler je Antwort), **Teilergebnisse**
  (abgebrochen/abgelaufen/fehlgeschlagen), Datei-Ergebnis abgelehnt, Ende-zu-Ende bis `processResults` mit
  **ungültigem JSON**, Teilergebnis und gültigem Entwurf.
- `pipeline/kinds/recipe.test.ts` (15): abwechselnde, deterministisch rotierte Reihenfolge (H5), Matrix/Auswahl/Aliase, ohne Katalog nicht möglich, Schema nur Katalog-IDs ohne
  Alkohol, feste Matrix-Werte, Schwerpunkte, Prompt-Regeln (alle Health-Claims-Begriffe, alle 23 Allergen-Gruppen,
  Schwangerschaft, Schwein, Salz-Grenze), Katalog-Zeilen, vorhandene Rezepte im Anfrage-Text, Antwort → Entwurf
  (Feldreihenfolge, gültig nach `recipeSchema`, Prüfnotiz für fehlende Lebensmittel).
- `pipeline-e2e.test.ts`: Rezepte-Probelauf bis zum Pull Request (Entwurf, ungültig + abgelehnt im Bericht, keine
  Kosten), echter Rezept-Lauf ohne Katalog sendet nichts, Rate-Limit beim Absenden → kein Branch, keine Merkdatei;
  bestehende Läufe (Kostendeckel, Pending, ohne Schlüssel, Kosten im Bericht) auf Gemini umgestellt.
- `results.test.ts`, `cost-and-selection.test.ts`, `schema-and-prompts.test.ts`: neutrales Ergebnis-Format,
  Standard je Art (Flash-Lite/Flash, `low`/`medium`; jedes Standardmodell hat einen Preis; Eingabe geht vor), Deckel
  3 $/Obergrenze 20 $/Anzahl 3, Gemini-Preise, Modell ohne Preis bricht **vor** dem ersten API-Aufruf ab, Gemini-Schema-Regeln (`const` → `enum`,
  `propertyOrdering`, unzulässige Angaben).
- Gesamt: `pnpm turbo run lint typecheck test --force` zweimal grün (packages/content 27 Testdateien), `pnpm
format:check`, `pnpm build`, actionlint für `content-generate.yml` und `content-collect.yml` grün.

**Wächter-Prüfung N8 (15.10.2026): eingearbeitet.** Kein Blocker. S1–S4, H1, H2, H4, H5, H7 umgesetzt (s. o.; S4 =
Korrektur der N9-Notiz „`maxTokens` inkl. Denken ist Anthropic-spezifisch“, H7 = erster echter Lauf mit „Anzahl“ 3 in
SETUP/HANDY). Nur dokumentiert:

- **H3:** Die Developer API liefert `job.error` über das SDK nicht – bei `FAILED` steht nur „Batch fehlgeschlagen“.
- **H6:** Zwei offene Batch-Branches können dieselbe Rezept-ID erzeugen (`takenIds` kennt nur `main`) → Konflikt im
  zweiten Pull Request; wie bei Übungen. Abhilfe: Läufe nacheinander abholen und mergen.
- **H8:** Katalog-Namen und Titel vorhandener Rezepte gehen ungefiltert in den Prompt – beides per Pull Request von
  Menschen gemergt; die Ausgabe ist durch Schema-`enum`, Zod und fest überschriebenen Status eng begrenzt.
- **H9:** Fehlertexte der API (`errored.detail`, `finishDetail`) stehen unverändert im PR-Text (keine Secrets).
- **H10:** `content-collect` gibt `GEMINI_API_KEY` an den ganzen Schritt (auch Prettier/Typprüfung auf Batch-Branches);
  setzt Schreibrecht aufs Repository voraus, Muster wie bisher mit Anthropic. Kein `pull_request_target`, Eingaben nur
  über `env:`.
- **H11:** Falsche Modell-ID kostet nichts (ohne Preis: Abbruch vor dem Aufruf; ohne Batch-Unterstützung: 4xx beim
  Zählen/Anlegen, nicht wiederholt).
- **H12:** Keine Regression; vor dem Merge mit `git ls-remote --heads origin 'content/batch-*'` bestätigen, dass keine
  Claude-Merkdatei (Fassung 1) offen ist (am 15.10.2026: keine).
- **H13:** „24 Stunden“ ist Googles Ziel, keine Zusage – Doku entsprechend formuliert.

**So testest du es am Handy:** `docs/HANDY-ANLEITUNG.md` Teil 7e (Probelauf `recipes` ohne Schlüssel; echter Lauf erst
mit katalog-geprüften Lebensmitteln). Einrichtung Gemini: `docs/SETUP.md` Teil E.

**Offen für die Gründer (N8):**

- **G-N8-1:** Preise von `gemini-3.8-flash`, `gemini-3.5-flash-lite` und `gemini-3.1-flash-lite` auf
  ai.google.dev/gemini-api/docs/pricing bestätigen (hinterlegt vorsichtig, s. Präzisierungen). _Empfehlung:
  bestätigen; bei Abweichung `pricing.ts` anpassen lassen (genauere Preise = mehr Anfragen unter dem Deckel)._
- **G-N8-2:** Modellwahl – Standard je Art wie oben (Flash-Lite für einfache Arten, Flash für Rezepte). Nach den
  ersten 3 Rezepten prüfen: Reicht Flash-Lite auch für Rezepte (Eingabe „modell“ `gemini-3.5-flash-lite` probieren)?
  Stärkere Modelle (`gemini-4-argon` – laut Berichten nur eingeschränkt freigegeben, nicht in SDK 2.27.0;
  `gemini-3.1-pro-preview` – „preview“ = nicht stabil) bräuchten erst einen Preis. _Empfehlung: so starten._
- **G-N8-3:** Bezahlte Stufe für den Schlüssel (Projekt mit Abrechnung) und Monatsbudget mit Warnung (**10 $**) in
  Google Cloud einrichten (SETUP Teil E, Schritt 3a). Bestätigen, dass `ANTHROPIC_API_KEY` gelöscht und widerrufen
  werden darf.
- **G-N8-4:** AVV/Datenverarbeitungsbedingungen mit Google erst vor Premium-Echtzeit-KI (Phase 7b) – Zuständigkeit und
  Zeitpunkt festlegen (KONZEPT 14/15).
- **G-N8-5:** Sollen bei KI-Rezepten die deklarierten Nährwerte/Allergene doch aus dem Katalog vorbelegt werden (weniger
  rote Entwürfe, aber keine Gegenprüfung der KI mehr)? _Empfehlung: nein, so lassen._
