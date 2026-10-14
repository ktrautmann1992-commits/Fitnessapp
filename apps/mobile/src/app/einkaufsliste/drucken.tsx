import { NutritionPrintView } from '@/components/nutrition-print-view';

/** Einkaufsliste als PDF (docs/PLAN-PHASE-5.md 8.2 Nr. 6, 11, Etappe N6 – PDF P5). */
export default function ShoppingListPrintScreen() {
  return <NutritionPrintView kind="shopping_list" />;
}
