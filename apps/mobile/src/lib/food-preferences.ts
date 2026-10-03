import type { FoodGroupId, FoodPreferenceInput, FoodPreferenceKind } from '@fitnessapp/core';

/**
 * Antippen einer Vorliebe im Schritt „Ernährung“ (reine Funktion, getestet):
 * - nochmal tippen entfernt sie,
 * - „mag ich“ und „mag ich nicht“ schließen sich je Gruppe aus (gleiche Regel wie nutritionStepSchema),
 * - „unverträglich“ ist unabhängig davon.
 */
export function toggleFoodPreference(
  preferences: readonly FoodPreferenceInput[],
  foodGroup: FoodGroupId,
  kind: FoodPreferenceKind,
): FoodPreferenceInput[] {
  const has = preferences.some((p) => p.foodGroup === foodGroup && p.kind === kind);
  if (has) {
    return preferences.filter((p) => !(p.foodGroup === foodGroup && p.kind === kind));
  }
  const withoutOpposite = preferences.filter(
    (p) =>
      !(
        p.foodGroup === foodGroup &&
        kind !== 'intolerance' &&
        p.kind !== 'intolerance' &&
        p.kind !== kind
      ),
  );
  return [...withoutOpposite, { foodGroup, kind }];
}

/** Ohne Einwilligung health_data: Unverträglichkeiten entfernen (Gesundheitsdaten). */
export function withoutIntolerances(
  preferences: readonly FoodPreferenceInput[],
): FoodPreferenceInput[] {
  return preferences.filter((p) => p.kind !== 'intolerance');
}
