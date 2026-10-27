import { KCAL_PER_GRAM, NUTRIENT_TIMING } from '../constants';
import type { RecipeNutrients } from './recipe-nutrients';
import {
  isSnackSlot,
  type MealRole,
  type MealSlot,
  type MealSlotId,
  type TrainingWindow,
} from './timing';

/**
 * Nährstoff-Timing 2 (docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitte 1–4, Etappe T1): Verteilung der UNVERÄNDERTEN
 * Tagesmengen (Energie, Eiweiß, Kohlenhydrate, Fett aus `nutritionTargetsForWeek`) auf die Mahlzeiten eines
 * Trainingstags. Rechnet keine Grenzen – die Summen je Tag sind exakt die Tageswerte (Strukturtest).
 * Richtwerte (`proteinGuideG`, `carbsGuideG`) sind Hinweise, keine harte Regel (Entscheidung 1).
 */

export interface SlotMacroTarget {
  readonly slot: MealSlotId;
  readonly role: MealRole;
  /** Geplante Anteile dieses Platzes am Tag (Summe = Tageswert). */
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  /** Eiweiß-Richtwert (0,4 g/kg, ab 65 mind. 25 g) – Hauptmahlzeiten und „nach dem Training“; sonst null. */
  readonly proteinGuideG: number | null;
  /** KH-Richtwert (vor dem Training nach Abstand, Snack vorher, Auffüllen nach dem Training); sonst null. */
  readonly carbsGuideG: number | null;
}

export interface SlotMacroInput {
  readonly slots: readonly MealSlot[];
  readonly targetKcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  /** Gewicht für Eiweiß (bei BMI ≥ 30 das Gewicht bei BMI 25, `Macros.referenceWeightKg`). */
  readonly referenceWeightKg: number;
  /** Körpergewicht für Kohlenhydrate je kg. */
  readonly weightKg: number;
  readonly ageYears: number;
  readonly windows: readonly Pick<TrainingWindow, 'start' | 'end' | 'kind' | 'minutes'>[];
}

const T = NUTRIENT_TIMING;
const isRoleMeal = (role: MealRole) => role === 'pre' || role === 'post' || role === 'pre_snack';

/** Eiweiß-Richtwert je Hauptmahlzeit (0,4 g/kg; ab 65 mindestens 25 g). */
export function proteinPerMealGuideG(referenceWeightKg: number, ageYears: number): number {
  const perKg = T.proteinPerMealGPerKg * referenceWeightKg;
  return ageYears >= T.seniorFromAge ? Math.max(perKg, T.seniorMinProteinPerMealG) : perKg;
}

/** KH-Richtwert der Mahlzeit vor dem Training nach dem Abstand (0,5 g/kg je Stunde, 1–2 g/kg). */
export function preMealCarbsGuideG(weightKg: number, minutesBefore: number): number {
  const perKg = Math.min(
    Math.max((minutesBefore / 60) * T.preMealCarbsGPerKgPerHour, T.preMealCarbsGPerKg.min),
    T.preMealCarbsGPerKg.max,
  );
  return perKg * weightKg;
}

/**
 * Wird nach dieser Einheit „aufgefüllt“ (Plan 2)? Ja bei einer weiteren Einheit am Tag bzw. weniger als 8 h bis zur
 * nächsten (innerhalb des Tages).
 */
export function needsRefuel(
  windows: readonly Pick<TrainingWindow, 'start' | 'end'>[],
  index: number,
): boolean {
  const w = windows[index];
  const next = windows[index + 1];
  if (w === undefined || next === undefined) return false;
  return next.start - w.end < T.refuelGapMinutes;
}

/** Index des Zeitfensters, zu dem ein Platz mit Rolle gehört (vor: nächstes Fenster, nach: letztes davor). */
export function windowIndexForSlot(
  slot: Pick<MealSlot, 'timeMinutes' | 'role'>,
  windows: readonly Pick<TrainingWindow, 'start' | 'end'>[],
): number {
  if (slot.role === 'post') {
    for (let i = windows.length - 1; i >= 0; i -= 1) {
      if ((windows[i] as TrainingWindow).end <= slot.timeMinutes) return i;
    }
    return -1;
  }
  if (slot.role === 'pre' || slot.role === 'pre_snack') {
    return windows.findIndex((w) => w.start > slot.timeMinutes);
  }
  return -1;
}

/**
 * Makro-Anteile je Mahlzeit (Plan 1–4). Eiweiß: Hauptmahlzeiten und „nach dem Training“ bekommen den Richtwert, der
 * Rest verteilt sich nach Energieanteil (reicht die Tagesmenge nicht, werden die Richtwerte anteilig gekürzt).
 * Kohlenhydrate: Mahlzeiten vor/nach dem Training +25 % ihres Energieanteils, die übrigen weniger; Richtwerte vor dem
 * Training bzw. beim Auffüllen werden – soweit die übrigen Mahlzeiten höchstens die Hälfte abgeben – angehoben. Fett
 * gleicht die Energie je Mahlzeit aus. Ruhetag (keine Rollen): alles nach Energieanteil.
 */
export function slotMacroTargets(input: SlotMacroInput): SlotMacroTarget[] {
  const { slots } = input;
  const shareSum = slots.reduce((sum, s) => sum + s.share, 0) || 1;
  const share = (s: MealSlot) => s.share / shareSum;

  // Eiweiß
  const perMeal = proteinPerMealGuideG(input.referenceWeightKg, input.ageYears);
  const guided = slots.map((s) => !isSnackSlot(s.slot) || s.role === 'post');
  const guideSum = guided.filter(Boolean).length * perMeal;
  const guideScale = guideSum > input.proteinG && guideSum > 0 ? input.proteinG / guideSum : 1;
  const proteinRest = input.proteinG - guideSum * guideScale;
  const protein = slots.map(
    (s, i) => (guided[i] ? perMeal * guideScale : 0) + proteinRest * share(s),
  );

  // Kohlenhydrate
  const anyRole = slots.some((s) => isRoleMeal(s.role));
  const weights = slots.map(
    (s) => share(s) * (anyRole && isRoleMeal(s.role) ? 1 + T.carbShift : 1),
  );
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1;
  const carbs = weights.map((w) => (input.carbsG * w) / weightSum);
  const carbGuides: (number | null)[] = slots.map((s) => {
    const index = windowIndexForSlot(s, input.windows);
    const w = input.windows[index];
    if (w === undefined) return null;
    if (s.role === 'pre') return preMealCarbsGuideG(input.weightKg, w.start - s.timeMinutes);
    if (s.role === 'pre_snack') return T.preSnackCarbsG.min;
    if (s.role === 'post' && needsRefuel(input.windows, index)) {
      return T.refuelCarbsGPerKg * input.weightKg;
    }
    return null;
  });
  const need = carbs.reduce((sum, c, i) => sum + Math.max(0, (carbGuides[i] ?? 0) - c), 0);
  const donors = slots.map((s, i) => !isRoleMeal(s.role) && carbGuides[i] === null);
  const available = carbs.reduce((sum, c, i) => sum + (donors[i] ? c / 2 : 0), 0);
  const moved = Math.min(need, available);
  if (moved > 0) {
    carbs.forEach((c, i) => {
      if (donors[i]) carbs[i] = c - (moved * (c / 2)) / available;
      else {
        const gap = Math.max(0, (carbGuides[i] ?? 0) - c);
        carbs[i] = c + (moved * gap) / need;
      }
    });
  }

  // Fett gleicht die Energie aus (Summe = Tagesfett).
  const kcal = slots.map((s) => share(s) * input.targetKcal);
  const fatRaw = slots.map((_, i) =>
    Math.max(
      0,
      ((kcal[i] as number) -
        KCAL_PER_GRAM.protein * (protein[i] as number) -
        KCAL_PER_GRAM.carbs * (carbs[i] as number)) /
        KCAL_PER_GRAM.fat,
    ),
  );
  const fatRawSum = fatRaw.reduce((sum, f) => sum + f, 0);
  const fat = slots.map((s, i) =>
    fatRawSum > 0 ? (input.fatG * (fatRaw[i] as number)) / fatRawSum : input.fatG * share(s),
  );

  return slots.map((s, i) => ({
    slot: s.slot,
    role: s.role,
    kcal: kcal[i] as number,
    proteinG: protein[i] as number,
    carbsG: carbs[i] as number,
    fatG: fat[i] as number,
    proteinGuideG: guided[i] ? perMeal : null,
    carbsGuideG: carbGuides[i] ?? null,
  }));
}

export type PreWorkoutIssue = 'fat' | 'fiber' | 'kcal';

/** Ballaststoff-Grenze vor dem Training: Mahlzeit 15 g je 1000 kcal (mind. 8 g), Snack höchstens 3 g. */
export function preWorkoutMaxFiberG(role: MealRole, kcal: number): number {
  return role === 'pre_snack'
    ? T.preSnackMaxFiberG
    : Math.max(T.preMealMinFiberLimitG, (T.preMealMaxFiberGPer1000Kcal * Math.max(kcal, 0)) / 1000);
}

/** Fett-Grenze vor dem Training: Mahlzeit höchstens 30 % der Energie aus Fett, Snack höchstens 5 g. */
export function preWorkoutMaxFatG(role: MealRole, kcal: number): number {
  return role === 'pre_snack'
    ? T.preSnackMaxFatG
    : (T.preMealMaxFatEnergyShare * Math.max(kcal, 0)) / KCAL_PER_GRAM.fat;
}

/**
 * Verträglichkeit vor dem Training (Plan 3) nach Nährwerten EINER Portion: Mahlzeit 2–4 h vorher bzw. Snack
 * 30–60 min vorher über den Fett-/Ballaststoff-Grenzen → rückt nach hinten (nicht verboten). Unbekannte Ballaststoffe
 * zählen nicht als Überschreitung. Für andere Rollen immer ohne Befund.
 */
export function preWorkoutIssues(
  role: MealRole,
  portion: Pick<RecipeNutrients, 'kcal' | 'fat_g' | 'fiber_g'>,
): PreWorkoutIssue[] {
  if (role !== 'pre' && role !== 'pre_snack') return [];
  const snack = role === 'pre_snack';
  const issues: PreWorkoutIssue[] = [];
  if (portion.fat_g > preWorkoutMaxFatG(role, portion.kcal)) issues.push('fat');
  if (portion.fiber_g !== null && portion.fiber_g > preWorkoutMaxFiberG(role, portion.kcal)) {
    issues.push('fiber');
  }
  if (snack && portion.kcal > T.preSnackMaxKcal) issues.push('kcal');
  return issues;
}

/** Wie weit liegt eine Portion über den Grenzen vor dem Training (0 = passt; Summe der relativen Überschreitungen)? */
export function preWorkoutExcess(
  role: MealRole,
  portion: Pick<RecipeNutrients, 'kcal' | 'fat_g' | 'fiber_g'>,
): number {
  if (role !== 'pre' && role !== 'pre_snack') return 0;
  const snack = role === 'pre_snack';
  const over = (value: number | null, max: number) =>
    value === null || value <= max ? 0 : (value - max) / max;
  return (
    over(portion.fat_g, preWorkoutMaxFatG(role, portion.kcal)) +
    over(portion.fiber_g, preWorkoutMaxFiberG(role, portion.kcal)) +
    (snack ? over(portion.kcal, T.preSnackMaxKcal) : 0)
  );
}
