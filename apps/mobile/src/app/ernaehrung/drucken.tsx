import { NutritionPrintView } from '@/components/nutrition-print-view';

/** Essensplan als PDF (docs/PLAN-PHASE-5.md 8.2 Nr. 6, 11, Etappe N6 – PDF P5). */
export default function NutritionPlanPrintScreen() {
  return <NutritionPrintView kind="nutrition_plan" />;
}
