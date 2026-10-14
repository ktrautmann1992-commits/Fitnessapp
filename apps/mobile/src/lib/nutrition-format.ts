import {
  FOOD_GROUPS,
  type FoodGroupId,
  type MealPlanSlotKey,
  type MealRole,
  type NutritionNoticeCode,
  type RecipeContains,
  type RecipeUnit,
  SHOPPING_CATEGORY_LABELS_DE,
  type ShoppingCategory,
  type ShoppingListItem,
  unitLabelDe,
} from '@fitnessapp/core';

import { t } from '@/i18n';

/**
 * Zahlen und Bausteine der Ernährung im deutschen Format („2.150 kcal“, „1,5 EL“, docs/PLAN-PHASE-5.md 8.4). Nur
 * Anzeige – keine Fachlogik (die Zahlen kommen fertig aus packages/core).
 */

function groupThousands(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** kcal als ganze Zahl mit Tausenderpunkt, z. B. 2150 → „2.150“. */
export function formatKcal(value: number): string {
  return groupThousands(value);
}

/** Gramm (Makros) als ganze Zahl, z. B. 132,4 → „132“. */
export function formatGrams(value: number): string {
  return groupThousands(value);
}

/** Dezimalzahl mit Komma, höchstens zwei Nachkommastellen, z. B. 1.5 → „1,5“, 0.333 → „0,33“. */
export function formatNumberDe(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Menge mit Einheit, z. B. „150 g“, „1,5 EL“, „2 Prisen“. */
export function formatAmount(amount: number, unit: RecipeUnit): string {
  return `${formatNumberDe(amount)} ${unitLabelDe(unit, amount)}`;
}

export function slotLabel(slot: MealPlanSlotKey): string {
  return t.nutrition.slots[slot];
}

export function roleLabel(role: MealRole): string | null {
  return role === null ? null : t.nutrition.roles[role];
}

const GROUP_NAMES = new Map(FOOD_GROUPS.map((group) => [group.id, group.nameDe]));

export function foodGroupName(group: FoodGroupId): string {
  return GROUP_NAMES.get(group) ?? group;
}

/** „Enthält: …“ inkl. Kokos (K11); leer → eigener Text. */
export function containsText(contains: RecipeContains): string {
  const names = contains.groups.map(foodGroupName);
  if (contains.coconut) names.push(t.nutrition.recipe.coconut);
  return names.length === 0
    ? t.nutrition.recipe.containsNothing
    : t.nutrition.recipe.contains(names.join(', '));
}

/**
 * Hinweise, die selbst Zahlen zu Zielen nennen, entfallen bei „Kalorienzahlen anzeigen“ = aus (Gründer-Entscheidung 3,
 * 16 B (h)). Sicherheits- und Gesundheitshinweise bleiben immer – Hinweise mit Gramm- oder BMI-Angaben dann in der
 * Fassung ohne Zahlen (`noticeText`, Wächter N4 S3/K9).
 */
const NUMBER_NOTICES: readonly NutritionNoticeCode[] = ['carbs_below_reference'];

export function visibleNotices(
  notices: readonly NutritionNoticeCode[],
  showNumbers: boolean,
): NutritionNoticeCode[] {
  return showNumbers ? [...notices] : notices.filter((code) => !NUMBER_NOTICES.includes(code));
}

/** Text eines Hinweis-Codes – bei „Zahlen aus“ ohne kcal, Gramm und BMI-Wert. */
export function noticeText(code: NutritionNoticeCode, showNumbers: boolean): string {
  if (!showNumbers) {
    const without = t.nutrition.noticesWithoutNumbers as Partial<
      Record<NutritionNoticeCode, string>
    >;
    const text = without[code];
    if (text !== undefined) return text;
  }
  return t.nutrition.notices[code];
}

/**
 * Eintrag der Einkaufsliste als Text (Etappe N5b): „500 g Haferflocken“, „3 Bananen“, „Salz – nach Geschmack“, eigene
 * Einträge ohne Menge nur mit Text. Mengen sind Einkaufsmengen (keine kcal) – auch bei „Zahlen aus“ sichtbar.
 */
export function shoppingItemText(
  item: Pick<ShoppingListItem, 'amount' | 'unit' | 'labelDe' | 'isManual'>,
): string {
  if (item.amount !== null && item.unit !== null) {
    return `${formatAmount(item.amount, item.unit)} ${item.labelDe}`;
  }
  return item.isManual ? item.labelDe : `${item.labelDe} – ${t.nutrition.shopping.toTaste}`;
}

export function shoppingCategoryLabel(category: ShoppingCategory): string {
  return SHOPPING_CATEGORY_LABELS_DE[category];
}

/** Restzeit des Kochtag-Timers: „0:45“, „4:05“, „1:02:00“ (Stunden nur, wenn nötig). */
export function countdownText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
