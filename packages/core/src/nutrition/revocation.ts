import { z } from 'zod';

import { FOOD_PREFERENCE_KINDS, type FoodPreferenceKind } from '../enums';
import { FOOD_GROUP_IDS, type FoodGroupId, foodGroupSchema } from '../food-groups';

/**
 * Widerruf der Einwilligung `health_data` – Umwandlung der Unverträglichkeiten in „mag ich nicht“
 * (docs/PLAN-PHASE-5.md 7.4, S17, R2-K4, K9, W12). Reine Funktionen; Ablauf und Speichern machen die Backends.
 *
 * Ablauf (fest): (1) NUR bei aktiver Zustimmung werden die Unverträglichkeiten vorher eingelesen – als Gruppen-IDs
 * („ausstehende Abneigungen“); lehnt die Person ab, wird nichts eingelesen und nichts behalten. (2) Widerruf (löscht
 * die Unverträglichkeiten). (3) Die Gruppen als „mag ich nicht“ schreiben – ein „mag ich“ derselben Gruppe wird
 * ersetzt (Unique-Index `like_xor_dislike`). (4) Erst dann neu planen.
 * „Mag ich nicht“ wirkt im Essensplan genauso hart (Gründer-Entscheidung 5) und ist kein Gesundheitsdatum.
 */

export interface FoodPreferenceEntry {
  readonly foodGroup: FoodGroupId;
  readonly kind: FoodPreferenceKind;
}

const entrySchema = z.strictObject({
  foodGroup: foodGroupSchema,
  kind: z.enum(FOOD_PREFERENCE_KINDS),
});

/**
 * Nur gültige Einträge (Wächter N4 K3): Ein Widerruf darf nie an alten, ungültigen Einträgen im Gerätespeicher
 * scheitern – unbekannte Gruppen bzw. Arten werden verworfen.
 */
function validEntries(preferences: readonly unknown[]): FoodPreferenceEntry[] {
  return preferences.flatMap((p) => {
    const parsed = entrySchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Gruppen-IDs der Unverträglichkeiten – eindeutig, in der Reihenfolge von FOOD_GROUPS (nur IDs, keine Zeilen). */
export function intoleranceGroupsForConversion(
  preferences: readonly FoodPreferenceEntry[],
): FoodGroupId[] {
  const groups = new Set(
    validEntries(preferences)
      .filter((p) => p.kind === 'intolerance')
      .map((p) => p.foodGroup),
  );
  return FOOD_GROUP_IDS.filter((group) => groups.has(group));
}

/**
 * Neue „mag ich“/„mag ich nicht“-Liste nach der Umwandlung: jede Gruppe aus `groups` wird „mag ich nicht“; ein „mag
 * ich“ derselben Gruppe wird ersetzt, ein vorhandenes „mag ich nicht“ bleibt einmal. Alle anderen Vorlieben bleiben
 * unverändert. Unverträglichkeiten kommen im Ergebnis NIE vor (sie sind nach dem Widerruf gelöscht).
 * Reihenfolge: bisherige Einträge in ihrer Reihenfolge, neue „mag ich nicht“ hinten (FOOD_GROUPS-Reihenfolge).
 */
export function tastePreferencesAfterConversion(
  preferences: readonly FoodPreferenceEntry[],
  groups: readonly FoodGroupId[],
): FoodPreferenceEntry[] {
  const parsed = validEntries(preferences);
  const convert = new Set(z.array(foodGroupSchema).parse(groups));
  const kept: FoodPreferenceEntry[] = [];
  const seen = new Set<string>();
  for (const pref of parsed) {
    if (pref.kind === 'intolerance') continue;
    // K9 / like_xor_dislike: „mag ich“ einer umgewandelten Gruppe wird durch „mag ich nicht“ ersetzt.
    if (pref.kind === 'like' && convert.has(pref.foodGroup)) continue;
    const key = `${pref.foodGroup}|${pref.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ foodGroup: pref.foodGroup, kind: pref.kind });
  }
  for (const group of FOOD_GROUP_IDS) {
    if (convert.has(group) && !seen.has(`${group}|dislike`)) {
      seen.add(`${group}|dislike`);
      kept.push({ foodGroup: group, kind: 'dislike' });
    }
  }
  return kept;
}
