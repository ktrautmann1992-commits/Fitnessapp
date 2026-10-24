import {
  FOOD_GROUPS,
  type FoodGroupId,
  type LeftoverMealHint,
  type MealPlanSlotKey,
  type MealRole,
  type NutritionNoticeCode,
  type RecipeContains,
  type RecipeUnit,
  SHOPPING_CATEGORY_LABELS_DE,
  type ShoppingCategory,
  type ShoppingListItem,
  shoppingPurchase,
  type SourceDatabase,
  unitLabelDe,
} from '@fitnessapp/core';

import { t } from '@/i18n';
import { weekdayShort } from '@/lib/plan-format';

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

/**
 * Zahlen einer Rezeptkarte bzw. Mahlzeit (Gründer-Wunsch 24.10.2026): „482 kcal“, „31 g Eiweiß · 40 g KH“ und die
 * ausgeschriebene Fassung für Bildschirmleser. Nur Format – die Werte kommen aus packages/core
 * (`recipeCardNutrients` bzw. die Portion im Essensplan).
 */
export function recipeNumbersText(values: {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
}): { readonly kcal: string; readonly macros: string; readonly a11y: string } {
  const protein = formatGrams(values.protein_g);
  const carbs = formatGrams(values.carbs_g);
  return {
    kcal: `${formatKcal(values.kcal)}\u00a0kcal`,
    macros: t.nutrition.macrosShort(protein, carbs),
    a11y: `${formatKcal(values.kcal)} Kilokalorien, ${t.nutrition.macrosShortA11y(protein, carbs)}`,
  };
}

/**
 * Zahlenzeile einer Mahlzeit im Ernährungs-Tag – einzeilig auf 390 px (Gründer 24.10.2026): „669 kcal · 44 g E ·
 * 65 g KH“. Der Portionsfaktor steht nur davor, wenn er gerundet nicht 1 ist („1,3× · 870 kcal · …“, eine Nachkommastelle); E/KH sind im
 * Ernährungs-Tag durch die Übersicht („Eiweiß“, „Kohlenhydrate“) erklärt, Bildschirmleser hören alles ausgeschrieben.
 * Nur Format – Faktor und Werte kommen aus packages/core (Essensplan).
 */
export function mealNumbersLine(
  factor: number,
  values: { readonly kcal: number; readonly protein_g: number; readonly carbs_g: number },
): { readonly text: string; readonly a11y: string } {
  // Eine Nachkommastelle reicht hier (genaue Portion in der Rezeptansicht).
  const rounded = Math.round(factor * 10) / 10;
  const showFactor = rounded !== 1;
  const kcal = formatKcal(values.kcal);
  const protein = formatGrams(values.protein_g);
  const carbs = formatGrams(values.carbs_g);
  const texts = t.nutrition.mealLine;
  return {
    text: [
      showFactor ? texts.factor(formatNumberDe(rounded)) : null,
      texts.kcal(kcal),
      texts.protein(protein),
      texts.carbs(carbs),
    ]
      .filter((part): part is string => part !== null)
      .join(' · '),
    a11y: texts.a11y(showFactor ? formatNumberDe(rounded) : null, kcal, protein, carbs),
  };
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
 * Eintrag der Einkaufsliste als Text (Etappe N5b; wie im Laden seit 24.10.2026): Lebensmittel in Kaufeinheiten aus
 * packages/core (`shoppingPurchase`) – „1 Netz Kartoffeln (2 kg)“, „1 Stück Ingwer“, „Olivenöl (Vorrat prüfen)“.
 * Eigene Einträge wie eingegeben („500 g Hack“, „Kerzen“). Gleicher Text in Liste, Scanner, PDF und Weitergeben.
 */
export function shoppingItemText(
  item: Pick<ShoppingListItem, 'amount' | 'unit' | 'labelDe' | 'isManual'> & {
    readonly foodId?: string | null;
  },
): string {
  const purchase = item.isManual ? null : shoppingPurchase(item);
  if (purchase !== null) return purchase.text;
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

/**
 * Namensnennung der Nährwert-Quellen (S13, CC BY 4.0; Wächter N6 S2): „Nährwerte: Bundeslebensmittelschlüssel (BLS)
 * 4.0, Max Rubner-Institut (CC BY 4.0, creativecommons.org/licenses/by/4.0); umgerechnet und gerundet.“ – gleich in
 * Rezeptansicht und PDF-Fuß. Mehrere Quellen mit „; “ getrennt.
 */
export function nutrientSourcesText(
  sources: readonly { db: SourceDatabase; version: string; license: string }[],
): string | null {
  if (sources.length === 0) return null;
  const n = t.nutrition;
  return n.source(
    sources
      .map((s) => {
        const names = n.sourceNames[s.db];
        return n.sourceAttribution(
          names.name,
          s.version,
          names.publisher,
          n.licenseTexts[s.license] ?? s.license,
        );
      })
      .join('; '),
  );
}

/** Anzeige des Hinweises „Nutzt deinen Rest“ (Etappe N14) – ohne Mengen und ohne Packungszahlen. */
export interface LeftoverHintView {
  readonly line: string;
  /** Mindestens eine Packungsgröße ist noch ein Entwurf/Testwert. */
  readonly unreviewed: boolean;
  /** Ein nur bis zum Folgetag eingeplanter Rest (roh tierisch oder empfindlich, Wächter N14 S3) – Lagerhinweis. */
  readonly shortLived: boolean;
}

export function leftoverHintView(
  hint: LeftoverMealHint,
  foodName: (foodId: string) => string,
): LeftoverHintView {
  return {
    line: t.nutrition.leftovers.line(
      hint.foods
        .map((f) => t.nutrition.leftovers.item(foodName(f.foodId), weekdayShort(f.openedOn)))
        .join(', '),
    ),
    unreviewed: hint.foods.some((f) => !f.packageReviewed),
    shortLived: hint.foods.some((f) => f.shortLived),
  };
}

/** Hinweise je Tag und Platz (`datum|platz`). */
export function leftoverHintsBySlot(
  hints: readonly LeftoverMealHint[],
): ReadonlyMap<string, LeftoverMealHint> {
  return new Map(hints.map((h) => [`${h.date}|${h.slot}`, h]));
}

/**
 * Vorlesetext des Hinweises (Wächter N14 S2): Das `accessibilityLabel` einer antippbaren Mahlzeit ersetzt ihren
 * Inhalt – der Hinweis und der Lagerhinweis werden deshalb angehängt.
 */
export function leftoverAccessibilityText(view: LeftoverHintView): string {
  const parts = [view.line];
  if (view.unreviewed) parts.push(t.nutrition.leftovers.unreviewed);
  if (view.shortLived) parts.push(t.nutrition.leftovers.shortLived);
  return parts.join('. ');
}
