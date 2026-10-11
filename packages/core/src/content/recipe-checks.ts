import { MEAL_PREP_FRIDGE_DAYS, RECIPE_CHECK_LIMITS, RECIPE_COVERAGE } from '../constants';
import { DIET_TYPES, type DietType } from '../enums';
import type { FoodGroupId } from '../food-groups';
import { computeRecipeFacts, dietAllows, type RecipeFacts } from '../nutrition/recipe-nutrients';
import { RECIPE_UNIT_LABELS_DE } from '../nutrition/units';
import {
  type AllergenRuleKey,
  matchWordRule,
  midWordGroupHints,
  requiredFoodRules,
  satisfiesRule,
  type WordRule,
} from './allergen-rules';
import {
  type AllergenException,
  type AllergenExpectations,
  type Food,
  type FoodLookup,
  isCatalogReviewed,
  type SourceNutrientRow,
  sourceRowKey,
} from './food-schema';
import { MEAL_TYPES, type MealType, type Recipe } from './recipe-schema';
import { type ContentIssue, makeIssue } from './rules';
import { findNutritionTextRuleHits } from './text-rules';

/**
 * Prüfregeln für Lebensmittel und Rezepte (docs/PLAN-PHASE-5.md 5.3, R1–R19). Rein, ohne Dateisystem; aufgerufen
 * von `validateContent`. R1 (Schema) und R15 (Version) laufen dort, alles andere hier.
 */

/** Begleitdaten des Katalogs (Plan 5.1.1): Quellauszug (R17), Erwartungsliste und Ausnahmeliste (R18). */
export interface NutritionCatalogContext {
  /** Quellauszug, Schlüssel `sourceRowKey` (Einlesen von `extract.csv` ab N2b). Fehlt er, ist R17 rot. */
  readonly sourceRows?: ReadonlyMap<string, SourceNutrientRow>;
  /** Erwartungsliste `allergen-expectations.json`. Fehlt sie, ist R18 rot. */
  readonly expectations?: AllergenExpectations;
  /** Eingecheckte Ausnahmeliste (Begründung + Quelle). */
  readonly exceptions?: readonly AllergenException[];
}

type Target = Parameters<typeof makeIssue>[1];

function foodTarget(food: Pick<Food, 'id' | 'status'>): Target {
  return { kind: 'food', id: food.id, status: food.status };
}

function recipeTarget(recipe: Pick<Recipe, 'id' | 'status'>): Target {
  return { kind: 'recipe', id: recipe.id, status: recipe.status };
}

function fmt(value: number, digits = 1): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

function textRuleIssues(target: Target, texts: readonly [string, string][]): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const [path, value] of texts) {
    for (const hit of findNutritionTextRuleHits(value)) {
      const what =
        hit.kind === 'brand'
          ? `Markenname „${hit.match}“ – nur Produktarten, keine Marken`
          : hit.kind === 'health_claim'
            ? `„${hit.match}“ (${hit.label}) – keine Gesundheits- oder Nährwertversprechen, neutrale Zahlen verwenden`
            : `„${hit.match}“ (${hit.label}) – keine Heilversprechen oder medizinischen Aussagen`;
      issues.push(makeIssue('R10', target, `Text enthält ${what}.`, path));
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// Lebensmittel: R2 (Ersatzprodukte), R4, R9 (Haltbarkeit), R10, R17, R18, R19
// ---------------------------------------------------------------------------------------------------------

/** R4: Energie nach Atwater (4·E + 4·KH + 9·F + 2·Ballaststoffe) passt zu den kcal der Quelle. */
export function checkFoodAtwater(food: Food): ContentIssue[] {
  const A = RECIPE_CHECK_LIMITS.atwater;
  const n = food.nutrients_per_100g;
  const computed =
    A.protein * n.protein_g + A.carbs * n.carbs_g + A.fat * n.fat_g + A.fiber * n.fiber_g;
  const tolerance = Math.max(A.tolerance * n.kcal, A.absMinKcal);
  if (Math.abs(computed - n.kcal) <= tolerance) {
    return [];
  }
  return [
    makeIssue(
      'R4',
      foodTarget(food),
      `Energie passt nicht zu den Makros: ${fmt(n.kcal)} kcal angegeben, nach Atwater ${fmt(computed)} kcal (erlaubt ±${fmt(tolerance)} kcal).`,
      'nutrients_per_100g.kcal',
    ),
  ];
}

const NUTRIENT_LABELS = {
  kcal: 'kcal',
  protein_g: 'Eiweiß',
  carbs_g: 'Kohlenhydrate',
  sugar_g: 'Zucker',
  fat_g: 'Fett',
  sat_fat_g: 'gesättigte Fettsäuren',
  fiber_g: 'Ballaststoffe',
  salt_g: 'Salz',
} as const;

/** R17: Nährwerte und Bezeichnung = Quellauszug (B6b). Die Herkunftsprüfung des Auszugs kommt in N2b. */
export function checkFoodSource(food: Food, catalog: NutritionCatalogContext): ContentIssue[] {
  const target = foodTarget(food);
  if (catalog.sourceRows === undefined) {
    return [
      makeIssue(
        'R17',
        target,
        'Quellauszug nicht geladen – Nährwerte können nicht gegen die Quelle geprüft werden.',
        'source',
      ),
    ];
  }
  const row = catalog.sourceRows.get(sourceRowKey(food.source));
  if (row === undefined) {
    return [
      makeIssue(
        'R17',
        target,
        `Quell-ID „${food.source.ref}“ (${food.source.db} ${food.source.version}) fehlt im Quellauszug.`,
        'source.ref',
      ),
    ];
  }
  const issues: ContentIssue[] = [];
  for (const key of Object.keys(NUTRIENT_LABELS) as (keyof typeof NUTRIENT_LABELS)[]) {
    const own = food.nutrients_per_100g[key];
    const expected = row.nutrients_per_100g[key];
    if (Math.abs(own - expected) > 1e-9) {
      issues.push(
        makeIssue(
          'R17',
          target,
          `${NUTRIENT_LABELS[key]}: ${fmt(own, 3)} statt ${fmt(expected, 3)} laut Quelle – Nährwerte nur maschinell importieren.`,
          `nutrients_per_100g.${key}`,
        ),
      );
    }
  }
  if (row.name !== food.source.name) {
    issues.push(
      makeIssue(
        'R17',
        target,
        `Bezeichnung der Quelle „${food.source.name}“ weicht vom Quellauszug ab („${row.name}“).`,
        'source.name',
      ),
    );
  }
  return issues;
}

const EXTRA_RULE_LABELS: Readonly<Record<Exclude<AllergenRuleKey, FoodGroupId>, string>> = {
  pork: 'Schwein („meat_kind“ mit „pork“ oder „unknown“, bzw. Gelatine vom Schwein/ohne Herkunft)',
  meat: 'Fleisch („animal“ mit „meat“ und Tierart in „meat_kind“)',
  gelatin: 'Gelatine („animal“ mit „gelatin“)',
  mixed_mince:
    'Hackfleisch ohne Tierart: Gruppe „beef“ und „meat_kind“ mit „beef“ und „pork“ (vorsichtig)',
  pregnancy_caution: '„pregnancy_caution“: true',
  alcohol: '„alcohol“: true',
  animal_egg: 'tierischer Bestandteil Ei („animal“ mit „egg“)',
  animal_fish: 'tierischer Bestandteil Fisch („animal“ mit „fish“)',
  animal_shellfish: 'tierischer Bestandteil Krebs-/Weichtiere („animal“ mit „shellfish“)',
  animal_dairy: 'tierischer Bestandteil Milch („animal“ mit „dairy“)',
  animal_honey: 'Honig („animal“ mit „honey“, nicht vegan)',
  animal_rennet: 'tierisches Lab („animal“ mit „animal_rennet“, nicht vegetarisch)',
  animal_insect: 'Insekten/Karmin („animal“ mit „insect“)',
};

function ruleLabel(key: AllergenRuleKey): string {
  return key in EXTRA_RULE_LABELS
    ? EXTRA_RULE_LABELS[key as keyof typeof EXTRA_RULE_LABELS]
    : `Gruppe „${key}“`;
}

/**
 * R18: Pflichtregeln (Wortteile, Quellgruppe, tierische Bestandteile), Erwartungsliste und Ersatzprodukte (S4).
 * Ausnahmen nur über die Ausnahmeliste.
 */
export function checkFoodAllergens(
  food: Food,
  foods: FoodLookup,
  catalog: NutritionCatalogContext,
): ContentIssue[] {
  const target = foodTarget(food);
  const issues: ContentIssue[] = [];
  const excepted = new Set<string>(
    (catalog.exceptions ?? []).filter((e) => e.food_id === food.id).map((e) => e.rule),
  );

  for (const [key, reasons] of requiredFoodRules(food)) {
    if (satisfiesRule(food, key) || excepted.has(key)) {
      continue;
    }
    const why = reasons.map((r) => r.detail).join(', ');
    issues.push(
      makeIssue(
        'R18',
        target,
        `Pflichtregel verletzt: ${ruleLabel(key)} fehlt (${why}).`,
        'groups',
      ),
    );
  }

  if (catalog.expectations === undefined) {
    issues.push(
      makeIssue(
        'R18',
        target,
        'Erwartungsliste (allergen-expectations.json) nicht geladen – Gruppen können nicht abgeglichen werden.',
        'groups',
      ),
    );
  } else {
    const expected = catalog.expectations[food.id];
    if (expected === undefined) {
      issues.push(
        makeIssue(
          'R18',
          target,
          'Lebensmittel fehlt in der Erwartungsliste (allergen-expectations.json) – bei der Katalog-Prüfung eintragen.',
          'groups',
        ),
      );
    } else {
      // Die Ausnahmeliste hebt nur Wort-/Quellregeln auf, nie das von Menschen bestätigte Soll (Wächter N2a, K1).
      const missing = expected.filter((g) => !food.groups.includes(g));
      if (missing.length > 0) {
        issues.push(
          makeIssue(
            'R18',
            target,
            `Gruppen laut Erwartungsliste fehlen: ${missing.join(', ')}.`,
            'groups',
          ),
        );
      }
    }
  }

  for (const { group, hits } of midWordGroupHints(food)) {
    if (excepted.has(group)) {
      continue;
    }
    const words = [...new Set(hits.map((hit) => `„${hit.pattern}“ in „${hit.word}“`))].join(', ');
    issues.push(
      makeIssue(
        'R18H',
        target,
        `Kernwort mitten im Wort (${words}) – bitte prüfen, ob die Gruppe „${group}“ fehlt.`,
        'groups',
      ),
    );
  }

  food.substitutes.forEach((substitute, index) => {
    const path = `substitutes.${index}`;
    const other = foods.get(substitute.food_id);
    if (other === undefined) {
      issues.push(
        makeIssue('R2', target, `Ersatzprodukt „${substitute.food_id}“ existiert nicht.`, path),
      );
      return;
    }
    const contained = substitute.for_groups.filter((g) => other.groups.includes(g));
    if (contained.length > 0) {
      issues.push(
        makeIssue(
          'R18',
          target,
          `Ersatzprodukt „${other.id}“ enthält selbst ${contained.join(', ')} – „for_groups“ darf nur Gruppen nennen, die es wirklich nicht enthält.`,
          `${path}.for_groups`,
        ),
      );
    }
    const foreign = substitute.for_groups.filter((g) => !food.groups.includes(g));
    if (foreign.length > 0) {
      issues.push(
        makeIssue(
          'R18',
          target,
          `„for_groups“ nennt ${foreign.join(', ')}, das „${food.id}“ gar nicht enthält.`,
          `${path}.for_groups`,
        ),
      );
    }
  });
  return issues;
}

/** Lebensmittel, die gekocht höchstens 1 Tag halten (S12): Reis, Hackfleisch (dazu Fisch, Krebs-/Weichtiere, Geflügel). */
const SHORT_FRIDGE_RULE: WordRule = {
  words: ['reis', '=hack', 'hackfleisch', 'gehacktes', 'faschiertes'],
  negatives: ['reiswaffel', 'reiswaffeln', 'reispapier'],
};

/** R9 je Lebensmittel: Reis, Fisch, Hackfleisch und Geflügel höchstens 1 Tag (S12, PRODUKTENTSCHEIDUNG). */
export function checkFoodFridgeDays(food: Food): ContentIssue[] {
  const sensitive =
    food.groups.some((g) => g === 'fish' || g === 'shellfish' || g === 'poultry') ||
    matchWordRule([food.name_de, ...food.aliases_de, food.source.name], SHORT_FRIDGE_RULE).length >
      0;
  if (!sensitive || food.max_fridge_days <= MEAL_PREP_FRIDGE_DAYS.sensitiveMax) {
    return [];
  }
  return [
    makeIssue(
      'R9',
      foodTarget(food),
      `Reis, Fisch, Hackfleisch und Geflügel halten gekocht höchstens ${MEAL_PREP_FRIDGE_DAYS.sensitiveMax} Tag im Kühlschrank („max_fridge_days“: ${food.max_fridge_days}).`,
      'max_fridge_days',
    ),
  ];
}

/** Alle Prüfungen eines Lebensmittels. */
export function checkFood(
  food: Food,
  foods: FoodLookup,
  catalog: NutritionCatalogContext,
): ContentIssue[] {
  const texts: [string, string][] = [
    ['name_de', food.name_de],
    ...(food.name_de_plural === undefined
      ? []
      : ([['name_de_plural', food.name_de_plural]] as [string, string][])),
    ...food.aliases_de.map((alias, i): [string, string] => [`aliases_de.${i}`, alias]),
  ];
  const issues = [
    ...checkFoodAtwater(food),
    ...textRuleIssues(foodTarget(food), texts),
    ...checkFoodSource(food, catalog),
    ...checkFoodAllergens(food, foods, catalog),
    ...checkFoodFridgeDays(food),
  ];
  if (food.status === 'published' && !isCatalogReviewed(food)) {
    issues.push(
      makeIssue(
        'R19',
        foodTarget(food),
        'Freigegeben ohne Katalog-Prüfung – „Katalog geprüft“ über den Workflow content-review setzen.',
        'meta.catalog_reviewed_by',
      ),
    );
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// Rezepte: R1 (heated), R2, R3, R5–R14, R19
// ---------------------------------------------------------------------------------------------------------

/** Herd-/Ofen-Geräte (R14). Wortteile wie bei R18. */
const HEAT_EQUIPMENT_RULE: WordRule = {
  words: [
    'herd',
    'ofen',
    'backofen',
    'pfanne',
    'topf',
    'kochtopf',
    'grill',
    'mikrowelle',
    'heissluftfritteuse',
    'airfryer',
    'fritteuse',
    '=wok',
    'toaster',
    'waffeleisen',
    'dampfgarer',
    'kochplatte',
    'wasserkocher',
  ],
  negatives: [],
};

function withinTolerance(
  declared: number,
  computed: number,
  rel: number,
  absMin: number,
): { ok: boolean; tolerance: number } {
  const tolerance = Math.max(rel * computed, absMin);
  return { ok: Math.abs(declared - computed) <= tolerance, tolerance };
}

const DIET_LABELS: Readonly<Record<DietType, string>> = {
  omnivore: 'mit Fleisch/Fisch',
  vegetarian: 'vegetarisch',
  vegan: 'vegan',
};

const MEAL_TYPE_LABELS: Readonly<Record<MealType, string>> = {
  breakfast: 'Frühstück',
  main: 'Hauptgericht',
  snack: 'Snack',
};

/** Prüft ein Rezept gegen den Katalog. `facts` optional vorberechnet (sonst hier berechnet). */
export function checkRecipe(
  recipe: Recipe,
  foods: FoodLookup,
  facts: RecipeFacts = computeRecipeFacts(recipe, foods),
): ContentIssue[] {
  const target = recipeTarget(recipe);
  const issues: ContentIssue[] = [];

  // R2: Lebensmittel existiert, Einheit umrechenbar.
  for (const index of facts.missingFoods) {
    const ingredient = recipe.ingredients[index];
    issues.push(
      makeIssue(
        'R2',
        target,
        `Lebensmittel „${ingredient?.food_id ?? '?'}“ existiert nicht im Katalog.`,
        `ingredients.${index}.food_id`,
      ),
    );
  }
  for (const index of facts.unconvertible) {
    const ingredient = recipe.ingredients[index];
    if (ingredient !== undefined) {
      issues.push(
        makeIssue(
          'R2',
          target,
          `Einheit „${RECIPE_UNIT_LABELS_DE[ingredient.unit]}“ ist für „${ingredient.food_id}“ nicht in Gramm umrechenbar.`,
          `ingredients.${index}.unit`,
        ),
      );
    }
  }

  // R1: Pflichtangabe `heated` (R2-S2).
  for (const index of facts.missingHeated) {
    issues.push(
      makeIssue(
        'R1',
        target,
        `Zutat „${recipe.ingredients[index]?.food_id ?? '?'}“ (Ei, Fisch, Krebs-/Weichtiere, Fleisch oder Rohmilch) braucht die Angabe „heated“ (true/false).`,
        `ingredients.${index}.heated`,
      ),
    );
  }

  // R3: Makro-Plausibilität (nur wenn alle nicht optionalen Zutaten berechenbar sind).
  if (facts.nutrientsComplete) {
    const P = RECIPE_CHECK_LIMITS.macroPlausibility;
    const declared = recipe.declared_per_serving;
    const kcal = withinTolerance(declared.kcal, facts.perServing.kcal, P.kcalRel, P.kcalAbsMin);
    if (!kcal.ok) {
      issues.push(
        makeIssue(
          'R3',
          target,
          `kcal je Portion: deklariert ${fmt(declared.kcal)}, berechnet ${fmt(facts.perServing.kcal)} (erlaubt ±${fmt(kcal.tolerance)}).`,
          'declared_per_serving.kcal',
        ),
      );
    }
    for (const key of ['protein_g', 'carbs_g', 'fat_g'] as const) {
      const check = withinTolerance(
        declared[key],
        facts.perServing[key],
        P.macroRel,
        P.macroAbsMinG,
      );
      if (!check.ok) {
        issues.push(
          makeIssue(
            'R3',
            target,
            `${NUTRIENT_LABELS[key]} je Portion: deklariert ${fmt(declared[key])} g, berechnet ${fmt(facts.perServing[key])} g (erlaubt ±${fmt(check.tolerance)} g).`,
            `declared_per_serving.${key}`,
          ),
        );
      }
    }

    // R5 (gelb): kcal je Portion passend zur Mahlzeit.
    const K = RECIPE_CHECK_LIMITS.kcalPerServing;
    const fits = recipe.meal_types.some(
      (type) => facts.perServing.kcal >= K[type].min && facts.perServing.kcal <= K[type].max,
    );
    if (!fits) {
      const ranges = recipe.meal_types
        .map((type) => `${MEAL_TYPE_LABELS[type]} ${K[type].min}–${K[type].max}`)
        .join(', ');
      issues.push(
        makeIssue(
          'R5',
          target,
          `${fmt(facts.perServing.kcal, 0)} kcal je Portion liegen außerhalb der Spanne (${ranges}).`,
          'meal_types',
        ),
      );
    }
  }

  // R6: Ernährungsform.
  if (recipe.declared_diet !== facts.diet) {
    issues.push(
      makeIssue(
        'R6',
        target,
        `Ernährungsform deklariert „${DIET_LABELS[recipe.declared_diet]}“, berechnet „${DIET_LABELS[facts.diet]}“ (inkl. optionaler Zutaten).`,
        'declared_diet',
      ),
    );
  }

  // R7: deklarierte Allergene ⊇ berechnete.
  const missingAllergens = facts.allergens.filter((g) => !recipe.declared_allergens.includes(g));
  if (missingAllergens.length > 0) {
    issues.push(
      makeIssue(
        'R7',
        target,
        `Deklarierte Allergene/Gruppen fehlen: ${missingAllergens.join(', ')} (inkl. optionaler Zutaten).`,
        'declared_allergens',
      ),
    );
  }

  // R8: Schwein.
  if (recipe.contains_pork !== facts.containsPork) {
    issues.push(
      makeIssue(
        'R8',
        target,
        facts.containsPork
          ? 'Rezept enthält Schwein (auch Gelatine unbekannter Herkunft) – „contains_pork“ muss true sein.'
          : 'Rezept enthält kein Schwein – „contains_pork“ muss false sein.',
        'contains_pork',
      ),
    );
  }

  // R9: Meal-Prep-Haltbarkeit im Kühlschrank höchstens die kürzeste Zutat – IMMER, auch wenn das Rezept einfrierbar
  // ist (`freezable` regelt nur, ob darüber hinaus eingefroren werden darf; Plan 6.4, Wächter N2a, S4).
  if (
    recipe.meal_prep.suitable &&
    facts.maxFridgeDays !== null &&
    recipe.meal_prep.fridge_days > facts.maxFridgeDays
  ) {
    issues.push(
      makeIssue(
        'R9',
        target,
        `Haltbarkeit im Kühlschrank ${recipe.meal_prep.fridge_days} Tage, die kürzeste Haltbarkeit der Zutaten ist ${facts.maxFridgeDays} – kürzer angeben (länger nur eingefroren).`,
        'meal_prep.fridge_days',
      ),
    );
  }

  // R10: Textregeln.
  const texts: [string, string][] = [
    ['title_de', recipe.title_de],
    ['description_de', recipe.description_de],
    ...recipe.steps_de.map((step, i): [string, string] => [`steps_de.${i}`, step]),
    ...recipe.equipment_de.map((item, i): [string, string] => [`equipment_de.${i}`, item]),
    ...recipe.ingredients.flatMap((ingredient, i): [string, string][] => [
      ...(ingredient.note_de === undefined
        ? []
        : ([[`ingredients.${i}.note_de`, ingredient.note_de]] as [string, string][])),
      ...(ingredient.display_de === undefined
        ? []
        : ([[`ingredients.${i}.display_de`, ingredient.display_de]] as [string, string][])),
    ]),
    ...(recipe.tip_de === undefined ? [] : ([['tip_de', recipe.tip_de]] as [string, string][])),
    ...(recipe.tags_de ?? []).map((tag, i): [string, string] => [`tags_de.${i}`, tag]),
  ];
  issues.push(...textRuleIssues(target, texts));

  // R11 (gelb): Mengen je Portion.
  const Q = RECIPE_CHECK_LIMITS.perServing;
  if (facts.nutrientsComplete && facts.perServing.salt_g > Q.saltMaxG) {
    issues.push(
      makeIssue(
        'R11',
        target,
        `${fmt(facts.perServing.salt_g)} g Salz je Portion (höchstens ${fmt(Q.saltMaxG)} g).`,
        'ingredients',
      ),
    );
  }
  let oilG = 0;
  recipe.ingredients.forEach((ingredient, index) => {
    const food = foods.get(ingredient.food_id);
    const grams = facts.gramsPerServing[index];
    if (food === undefined || grams === null || grams === undefined) {
      return;
    }
    if (
      food.shopping_category === 'oils_vinegar_sauces' &&
      food.nutrients_per_100g.fat_g >= RECIPE_CHECK_LIMITS.oilMinFatG
    ) {
      oilG += grams;
    }
    if (grams > Q.ingredientMaxG) {
      issues.push(
        makeIssue(
          'R11',
          target,
          `${fmt(grams, 0)} g „${food.name_de}“ je Portion (höchstens ${Q.ingredientMaxG} g).`,
          `ingredients.${index}.amount`,
        ),
      );
    }
  });
  if (oilG > Q.oilMaxG) {
    issues.push(
      makeIssue(
        'R11',
        target,
        `${fmt(oilG, 0)} g Öl je Portion (höchstens ${Q.oilMaxG} g).`,
        'ingredients',
      ),
    );
  }

  // R12: kein Alkohol.
  if (facts.alcohol) {
    issues.push(makeIssue('R12', target, 'Rezept enthält Alkohol – nicht erlaubt.', 'ingredients'));
  }

  // R13: Schwangerschafts-Vorsicht aus Zutaten und Zubereitung.
  if (recipe.declared_pregnancy_caution !== facts.pregnancyCaution) {
    const reasons = facts.pregnancyReasons
      .map((r) => {
        const what =
          r.kind === 'food_flag'
            ? 'im Katalog als heikel markiert'
            : r.kind === 'no_cook'
              ? 'tierische Zutat in einem Rezept ohne Kochen'
              : 'tierische Zutat nicht erhitzt';
        return `„${r.foodId}“: ${what}`;
      })
      .join('; ');
    issues.push(
      makeIssue(
        'R13',
        target,
        facts.pregnancyCaution
          ? `Rezept ist in der Schwangerschaft heikel (${reasons}) – „declared_pregnancy_caution“ muss true sein.`
          : 'Rezept ist laut Zutaten und Zubereitung nicht heikel – „declared_pregnancy_caution“ muss false sein.',
        'declared_pregnancy_caution',
      ),
    );
  }

  // R14: ohne Kochen.
  if (recipe.no_cook) {
    if (recipe.cook_minutes !== 0) {
      issues.push(
        makeIssue('R14', target, 'Rezept ohne Kochen hat eine Kochzeit > 0.', 'cook_minutes'),
      );
    }
    recipe.equipment_de.forEach((item, index) => {
      if (matchWordRule([item], HEAT_EQUIPMENT_RULE).length > 0) {
        issues.push(
          makeIssue(
            'R14',
            target,
            `Rezept ohne Kochen nennt das Gerät „${item}“ (Herd/Ofen).`,
            `equipment_de.${index}`,
          ),
        );
      }
    });
  }

  // R19: nur katalog-geprüfte Lebensmittel; freigegebenes Rezept nur mit freigegebenen Lebensmitteln.
  recipe.ingredients.forEach((ingredient, index) => {
    const food = foods.get(ingredient.food_id);
    if (food === undefined) {
      return;
    }
    if (!isCatalogReviewed(food)) {
      issues.push(
        makeIssue(
          'R19',
          target,
          `Lebensmittel „${food.id}“ ist noch nicht katalog-geprüft – Rezept nicht nutzbar.`,
          `ingredients.${index}.food_id`,
        ),
      );
    }
    if (recipe.status === 'published' && food.status !== 'published') {
      issues.push(
        makeIssue(
          'R19',
          target,
          `Freigegebenes Rezept nutzt das nicht freigegebene Lebensmittel „${food.id}“.`,
          `ingredients.${index}.food_id`,
        ),
      );
    }
  });

  return issues;
}

// ---------------------------------------------------------------------------------------------------------
// R16: Abdeckungsbericht
// ---------------------------------------------------------------------------------------------------------

export interface RecipeCoverageRow {
  readonly mealType: MealType;
  readonly diet: DietType;
  /** null = ohne Unverträglichkeit. */
  readonly intolerance: FoodGroupId | null;
  readonly count: number;
}

/**
 * Anzahl passender Rezepte je Mahlzeit × Ernährungsform × häufige Unverträglichkeit (Plan 5.4). Gezählt werden
 * Entwürfe und freigegebene Rezepte; optionale Zutaten gelten als weglassbar (Filter S3).
 */
export function recipeCoverageReport(
  recipes: readonly Recipe[],
  foods: FoodLookup,
): RecipeCoverageRow[] {
  const usable = recipes
    .filter((recipe) => recipe.status !== 'archived')
    .map((recipe) => {
      const omitted = new Set(
        recipe.ingredients.flatMap((ingredient, index) => (ingredient.optional ? [index] : [])),
      );
      return { recipe, facts: computeRecipeFacts(recipe, foods, { omitted }) };
    });
  const intolerances: (FoodGroupId | null)[] = [null, ...RECIPE_COVERAGE.intolerances];
  const rows: RecipeCoverageRow[] = [];
  for (const mealType of MEAL_TYPES) {
    for (const diet of DIET_TYPES) {
      for (const intolerance of intolerances) {
        const count = usable.filter(
          ({ recipe, facts }) =>
            recipe.meal_types.includes(mealType) &&
            dietAllows(diet, facts.diet) &&
            (intolerance === null || !facts.allergens.includes(intolerance)),
        ).length;
        rows.push({ mealType, diet, intolerance, count });
      }
    }
  }
  return rows;
}

/** R16 (gelb): Kombinationen mit weniger als 7 Rezepten. Ohne Rezepte kein Bericht. */
export function checkRecipeCoverage(recipes: readonly Recipe[], foods: FoodLookup): ContentIssue[] {
  if (recipes.length === 0) {
    return [];
  }
  return recipeCoverageReport(recipes, foods)
    .filter((row) => row.count < RECIPE_COVERAGE.minPerCombination)
    .map((row) => {
      const id = [row.mealType, row.diet, row.intolerance ?? 'ohne'].join('|');
      const what = `${MEAL_TYPE_LABELS[row.mealType]} · ${DIET_LABELS[row.diet]} · ${row.intolerance === null ? 'ohne Unverträglichkeit' : `ohne ${row.intolerance}`}`;
      return makeIssue(
        'R16',
        { kind: 'recipe_library', id, status: null },
        `${what}: nur ${row.count} passende Rezepte (mindestens ${RECIPE_COVERAGE.minPerCombination}).`,
      );
    });
}
