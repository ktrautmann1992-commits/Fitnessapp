# Gerichte entdecken – Wochenauswahl per Wischen

**Gründer-Wunsch 01.11.2026** (Optik freigegeben): „Links mag ich nicht, rechts mag ich, nach oben neutral. Unten
steht der Name und die Nährwerte in einem blauen Balken im Farbton der App. Und das Bild vom Essen. So könnte man Essen
für die kommende Woche auswählen. … Soll aussehen wie Rezeptspielkarten.“ Gratis, regelbasiert, ohne KI (KONZEPT 6.10b).

## Bedienung

- Einstieg: Ernährung → Wochenplan → **„Gerichte für nächste Woche wischen“** (`/ernaehrung/swipe?woche=…`, Standard
  ist die nächste Woche; nur laufende oder nächste Woche wie `save_meal_plan`).
- Kartenstapel: vorne die große Karte (Rezeptfoto aus `content/recipe-media`, ohne Foto das Rezept-Symbol), unten ein
  blauer Balken in der App-Farbe (`brandColors.blau`) mit Name und Nährwerten **je Portion** (kcal, Eiweiß, KH, Fett –
  nur mit „Kalorienzahlen anzeigen“, nie in Schwangerschaft/Stillzeit ohne Zahlen). Dahinter bis zu drei Karten,
  versetzt, kleiner, leicht gedreht (Perspektive) – beim Ziehen rücken sie nach.
- Gesten (PanResponder + Animated, gleich für Finger, Maus und Web-Export): **rechts = mag ich**, **links = mag ich
  nicht**, **oben = neutral**; unter 96 px springt die Karte zurück (`lib/recipe-swipe-gesture.ts`). Stempel
  „MAG ICH“ / „NÖ“ / „NEUTRAL“ beim Ziehen.
- Ohne Wischen: Knöpfe ✕ / – / ♥, Pfeiltasten (Web), Bildschirmleser-Aktionen auf der Karte. **Rückgängig** holt die
  letzte Karte zurück und stellt die vorherige Vorliebe wieder her.
- Ende des Stapels (oder vorher „Fertig – Wochenplan aktualisieren“): Zusammenfassung „X gemerkt“, Knopf
  **„Wochenplan aktualisieren“**, danach „Zum Wochenplan“. Leer-, Lade- und Fehlerzustände wie in der Rezeptsuche.

## Regeln (packages/core `nutrition/recipe-swipe.ts`, Tests `recipe-swipe.test.ts`)

- **Stapel** (`recipeSwipeStack`): dieselben harten Filter wie Essensplan und Rezeptsuche (`searchRecipes` →
  `filter.ts`: Ernährungsform des Profils, Schwein, Unverträglichkeiten nur mit gültiger Einwilligung, „mag ich nicht“,
  Schwangerschaft, Status). Nur Rezepte **ohne** Vorliebe (kein Herz, kein „Nie wieder“), ohne Daumen-runter-Sperre in
  der Woche, in dieser Woche nicht schon „neutral“ gesehen. Treffer außerhalb der Profil-Ernährungsform kommen nicht in
  den Stapel (G4). Reihenfolge fest je Woche (`stableHashKey`, kein Zufall), höchstens 30 Karten
  (`RECIPE_SWIPE_RULES.stackMax`).
- **Mag ich** → Herz (`recipe_preferences.kind = 'favorite'`, 6.10a). „Wochenplan aktualisieren“ legt die gemochten
  Rezepte über `placeRecipeSwipePicks` in die Woche: je Gericht der erste passende Platz ab heute, Tage mit weniger
  gewählten Gerichten zuerst, höchstens 2 je Tag (`maxPicksPerDay`), Mahlzeit-Art passend (Frühstück/Hauptgericht/
  Snack). Jeder Tausch läuft über **`swapMealRecipe`** mit genau diesem Rezept – Filter, Planband, Obergrenze und
  **Kalorien-Schutzgrenzen gelten unverändert**, ein vollständiger Tag bleibt vollständig, nichts wird verdrängt.
  Unberührt bleiben: Plätze vor/nach dem Training (Nährstoff-Timing), Meal-Prep und Reste, geteilte Mahlzeiten, schon
  selbst gewählte Mahlzeiten und vergangene Tage. Eingeplante Gerichte sind „selbst gewählt“
  (`meal_plan_items.user_chosen`). Passt ein Gericht nirgends, bleibt der Plan unverändert – das Herz wirkt weiter.
- **Mag ich nicht** → „Nie wieder“ (`kind = 'hidden'`), zurückholbar unter „Ausgeblendete Gerichte“.
- **Neutral** → keine Wirkung; das Rezept gilt nur für diese Woche als gesehen.

## Speicherung

- Keine neue Tabelle, keine Migration: Herz/„Nie wieder“ über `recipe_preferences` (RLS, Datenexport, Warteschlange,
  Testmodus im Gerätespeicher wie 6.10a), eingeplante Gerichte über den gespeicherten Essensplan (`save_meal_plan`).
- „Neutral gesehen“: nur auf dem Gerät (`STORAGE_KEYS.recipeSwipeSeen`), je Konto und Woche, nur Rezept-IDs, höchstens
  500 – kein Gesundheitsdatum (`lib/recipe-swipe-seen.ts`). Wird mit „Testdaten löschen“/Abmelden mit entfernt.

## Tests

- Vitest core: Stapel gegen unabhängigen Filter (vegan/omnivor), Vorlieben/gesehen/Daumen runter, feste Reihenfolge,
  Obergrenze; Platzierung mit unabhängig nachgerechnetem Planband, Mahlzeit-Art, Verteilung, schon geplant, unpassend
  (Plan unverändert), vergangene Tage, selbst gewählte Mahlzeiten, Trainingsplätze bei 1 vs. 7 Trainingstagen,
  Obergrenze je Tag.
- Vitest mobile: Wisch-Richtung, Gerätespeicher je Konto/Woche.
- Playwright `e2e/recipe-swipe.spec.ts`: Knöpfe, Maus-Wischen, Rückgängig, Neutral, Wochenplan aktualisieren.
