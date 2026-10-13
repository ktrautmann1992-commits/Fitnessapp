/**
 * Feste Hinweis-Codes der Ernährungs-Engine (docs/PLAN-PHASE-5.md 4.6–4.9). Die Engine liefert nur Codes; die
 * Texte stehen ab Etappe N4 in `apps/mobile/src/i18n/de.ts` (feste Bausteine, keine Diagnosen).
 * Gesundheitsbezogene Codes nie in Logs oder Analytics (CLAUDE.md).
 */
export const NUTRITION_NOTICE_CODES = [
  // Modus / Sonderfälle (4.9)
  'no_health_data_consent',
  'body_data_missing',
  'health_check_missing',
  'weight_outdated',
  'pregnancy_no_targets',
  'pregnancy_check_update',
  'pregnancy_caffeine',
  'minor_no_deficit',
  'underweight',
  'severe_underweight',
  'medical_consult',
  'bmr_estimate_age',
  'activity_level_default',
  // Schutzgrenzen (4.4, 4.6)
  'training_energy_capped',
  'energy_availability_cap',
  // Makros (4.7)
  'protein_kidney_notice',
  'carbs_below_reference',
  'endurance_carbs_below_target',
  // Timing (4.8)
  'long_session_fueling',
  'early_training',
] as const;
export type NutritionNoticeCode = (typeof NUTRITION_NOTICE_CODES)[number];

/**
 * Hinweis-Codes zum konkreten Abnehmziel (docs/PLAN-ZIELE.md 2.3, 2.4, 6 Nr. 4; Etappe Z2). Sie stehen NICHT je Tag,
 * sondern einmal je Woche in `NutritionWeekTargets.weightGoalNotices` (Ernährungs-Übersicht der Woche; Wächter K10:
 * `weight_goal_pace_capped` höchstens einmal pro Woche, kein täglicher Dauerhinweis). Texte (Entwurf, Plan 2.3/2.4):
 * - `weight_goal_pace_capped`: „Für dein Wunschziel planen wir etwas langsamer, damit es sicher bleibt.“
 * - `weight_goal_reached`: „Du hast dein Wunschgewicht erreicht. Wie geht es weiter?“
 * - `weight_goal_date_passed`: „Dein Zeitraum ist vorbei. Verlängern oder ohne festes Ziel weitermachen?“
 * - `weight_goal_invalid`: „Dein Zielgewicht passt nicht mehr zu deinen Angaben. Bitte passe es an.“
 * - `weight_goal_no_deficit`: „Derzeit planen wir für dich kein Kaloriendefizit. Wir empfehlen ‚ohne festes Ziel‘.“
 * Die App-Texte kommen mit Etappe Z5 nach `apps/mobile/src/i18n/de.ts`. Zielgewicht und Codes nie in Logs/Analytics.
 */
export const WEIGHT_GOAL_NOTICE_CODES = [
  'weight_goal_invalid',
  'weight_goal_no_deficit',
  'weight_goal_reached',
  'weight_goal_date_passed',
  'weight_goal_pace_capped',
] as const;
export type WeightGoalNoticeCode = (typeof WEIGHT_GOAL_NOTICE_CODES)[number];

export function sortWeightGoalNotices(
  codes: Iterable<WeightGoalNoticeCode>,
): WeightGoalNoticeCode[] {
  const set = new Set(codes);
  return WEIGHT_GOAL_NOTICE_CODES.filter((code) => set.has(code));
}

/**
 * Greifende Grenzen eines Tages (4.6, „Reihenfolge“). Die App erklärt sie in einfachen Worten
 * („Wir planen nicht unter deinem Grundumsatz.“).
 */
export const CALORIE_CAP_CODES = [
  'bmr_floor',
  'deficit_cap',
  'weekly_loss_cap',
  'energy_availability_cap',
  'gain_cap',
  'special_case_cap',
  'training_energy_capped',
] as const;
export type CalorieCapCode = (typeof CALORIE_CAP_CODES)[number];

/** Codes in fester Reihenfolge, ohne Doppelungen. */
export function sortNotices(codes: Iterable<NutritionNoticeCode>): NutritionNoticeCode[] {
  const set = new Set(codes);
  return NUTRITION_NOTICE_CODES.filter((code) => set.has(code));
}

export function sortCaps(codes: Iterable<CalorieCapCode>): CalorieCapCode[] {
  const set = new Set(codes);
  return CALORIE_CAP_CODES.filter((code) => set.has(code));
}

/**
 * Hinweis-Codes des Essensplans (docs/PLAN-PHASE-5.md 6.2–6.4, Etappe N3). Texte ab N4/N5 in der App.
 * `day_below_floor`: „Dieser Tag erreicht deinen Mindestbedarf nicht – ergänze z. B. eine Portion Obst, Nüsse oder
 * Joghurt.“ (Tag erscheint als „unvollständiger Vorschlag“, nie als „dein Plan“).
 */
export const MEAL_PLAN_NOTICE_CODES = [
  'day_below_floor',
  'no_targets_portions',
  'no_candidates_for_slot',
  'meal_removed_ceiling',
  'optional_omitted_ceiling',
  'protein_below_target',
  'fill_snacks_added',
  'recipe_repeated',
  'meal_prep_freeze',
  'meal_prep_fresh_days',
  'drafts_used',
  'drafts_allergens_unreviewed',
] as const;
export type MealPlanNoticeCode = (typeof MEAL_PLAN_NOTICE_CODES)[number];

export function sortMealPlanNotices(codes: Iterable<MealPlanNoticeCode>): MealPlanNoticeCode[] {
  const set = new Set(codes);
  return MEAL_PLAN_NOTICE_CODES.filter((code) => set.has(code));
}
