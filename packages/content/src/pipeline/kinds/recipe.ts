/**
 * Inhaltsart „Rezept“ (content/recipes, docs/PLAN-PHASE-5.md 2.1 Punkt 8, 5.2–5.4, 13 N8). Nur für spätere
 * Ergänzungen des Rezeptbestands (19.1: der Startbestand kommt aus `alpha5-rezepte.json`).
 *
 * Matrix: Mahlzeit × Ernährungsform × Schwerpunkt (45 Zellen). Das Modell wählt die ID selbst (wie bei Übungen);
 * Kollisionen fängt content-collect ab. Structured Output NUR mit Katalog-IDs (katalog-geprüft, R19; ohne Alkohol,
 * R12) – neue Lebensmittel nur als Vorschlag (`missing_foods_de`, landet als Prüfnotiz in `meta.review_note`, nie
 * als Zutat). Nährwerte erfindet die KI nicht: Die App rechnet sie aus dem Katalog (amtliche Quelle); die
 * deklarierten Angaben (`declared_*`) bleiben wie bei allen Rezepten nur Gegenprüfung (R3, R6, R7, R8, R13).
 *
 * Jede Antwort wird ein Entwurf (`status: draft`, „KI-Entwurf – fachlich prüfen“), geprüft von content:validate
 * (R1–R22) und erst nach menschlicher Freigabe (content-review, Pull Request) nutzbar. Keine Echtzeit-KI in der App.
 */
import {
  DIET_TYPES,
  type DietType,
  type Food,
  FOOD_GROUPS,
  FORBIDDEN_BRANDS,
  FORBIDDEN_FOOD_BRANDS,
  FORBIDDEN_MEDICAL_TERMS,
  HEALTH_CLAIM_TERMS,
  INGREDIENT_ROLES,
  isDryRunContent,
  MEAL_PREP_FRIDGE_DAYS,
  MEAL_TYPES,
  type MealType,
  PINCH_G,
  RECIPE_CATEGORIES,
  RECIPE_CHECK_LIMITS,
  recipeIngredientSchema,
  recipeSchema,
  TRAINING_TAGS,
} from '@fitnessapp/core';
import { z } from 'zod';

import { MODEL_FLASH } from '../config';

import { OUTPUT_FORMAT_TEXT, ROLE_TEXT } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/**
 * Höchstzahl Ausgabe-Token je Rezept (inkl. Denken, Gemini 3 `maxOutputTokens`). PRODUKTENTSCHEIDUNG (Wächter N8 H4,
 * Gründer-Vorgabe „günstig“ 15.10.2026): Standard-Denktiefe der Rezepte ist `medium` statt `high` – die JSON-Antwort
 * braucht etwa 1.500–3.000 Token, so bleiben über 12.000 Token Reserve fürs Denken und Antworten werden selten
 * abgeschnitten (bezahlt, aber verworfen). Wer `CONTENT_EFFORT=high` setzt, sollte die ersten Läufe auf „abgeschnitten“
 * prüfen. Schlimmster Fall je Anfrage mit `gemini-3.8-flash`: 16.000 × 3,75 $/1 Mio. = 0,06 $ Ausgabe.
 */
export const RECIPE_MAX_TOKENS = 16_000;

/** Höchstens so viele Vorschläge für fehlende Lebensmittel je Antwort. */
export const RECIPE_MISSING_FOODS_MAX = 5;

/** Schwerpunkte der Matrix (PRODUKTENTSCHEIDUNG, angelehnt an die Kategorien aus 19.4). */
export const RECIPE_FOCI = {
  alltag: {
    labelDe: 'Alltag',
    aliases: ['standard', 'normal'],
    hint: 'ein alltagstaugliches Rezept',
  },
  schnell: {
    labelDe: 'Schnell (≤ 10 Minuten)',
    aliases: ['10min'],
    hint: 'fertig in höchstens 10 Minuten (Vorbereitung + Kochzeit zusammen ≤ 10), Kategorie „schnell“',
  },
  meal_prep: {
    labelDe: 'Meal-Prep',
    aliases: ['mealprep', 'vorkochen'],
    hint: 'gut vorzukochen: meal_prep.suitable = true, Kategorie „meal-prep“',
  },
  ohne_kochen: {
    labelDe: 'Ohne Kochen',
    aliases: ['no_cook', 'kalt'],
    hint: 'ohne Herd und Ofen: no_cook = true, cook_minutes = 0, alle Zutaten heated = false',
  },
  nach_training: {
    labelDe: 'Nach dem Training',
    aliases: ['post-workout', 'nachtraining'],
    hint: 'passt nach dem Training: training_tags enthält „nach_training“, Kategorie „post-workout“',
  },
} as const;
export type RecipeFocus = keyof typeof RECIPE_FOCI;
const FOCUS_KEYS = Object.keys(RECIPE_FOCI) as RecipeFocus[];

const MEAL_LABELS: Record<MealType, { labelDe: string; aliases: string[] }> = {
  breakfast: { labelDe: 'Frühstück', aliases: ['fruehstueck'] },
  main: { labelDe: 'Hauptgericht', aliases: ['hauptgericht', 'mittag', 'abend'] },
  snack: { labelDe: 'Snack/kleine Mahlzeit', aliases: ['zwischenmahlzeit'] },
};

const DIET_LABELS: Record<DietType, { labelDe: string; aliases: string[] }> = {
  omnivore: { labelDe: 'mit Fleisch/Fisch möglich', aliases: ['omnivor', 'fleisch', 'mischkost'] },
  vegetarian: { labelDe: 'vegetarisch', aliases: ['vegetarisch', 'veggie'] },
  vegan: { labelDe: 'vegan', aliases: [] },
};

/** Feldreihenfolge der Dateien (wie recipeSchema / recipeIngredientSchema). */
const FIELD_ORDER = Object.keys(recipeSchema.shape);
const INGREDIENT_FIELD_ORDER = Object.keys(recipeIngredientSchema.shape);

function cellFor(meal: MealType, diet: DietType, focus: RecipeFocus): GenerationCell {
  return {
    customId: `rz-${meal}-${diet}-${focus}`,
    targetId: null,
    label: `${MEAL_LABELS[meal].labelDe} · ${DIET_LABELS[diet].labelDe} · ${RECIPE_FOCI[focus].labelDe}`,
    values: { mahlzeit: meal, ernaehrung: diet, schwerpunkt: focus },
  };
}

function cellValues(cell: GenerationCell): { meal: MealType; diet: DietType; focus: RecipeFocus } {
  const meal = cell.values.mahlzeit as MealType;
  const diet = cell.values.ernaehrung as DietType;
  const focus = cell.values.schwerpunkt as RecipeFocus;
  if (!MEAL_TYPES.includes(meal) || !DIET_TYPES.includes(diet) || !FOCUS_KEYS.includes(focus)) {
    throw new Error(`Unbekannte Rezept-Zelle ${cell.customId}.`);
  }
  return { meal, diet, focus };
}

/** Erlaubte Zutaten: katalog-geprüfte Lebensmittel (R19) ohne Alkohol (R12). */
function usableFoods(context: LibraryContext): Food[] {
  return context.foods
    .filter((food) => !food.alcohol)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const S = recipeSchema.shape;
const I = recipeIngredientSchema.shape;

/** Zod-Schema der Modell-Antwort für eine Zelle (Katalog-IDs als erlaubte Werte, feste Matrix-Werte). */
export function recipeOutputSchema(cell: GenerationCell, context: LibraryContext) {
  const { meal, diet, focus } = cellValues(cell);
  const ids = usableFoods(context).map((food) => food.id);
  const foodId = ids.length > 0 ? z.enum(ids as [string, ...string[]]) : I.food_id;
  const mealPrep = S.meal_prep.shape;
  return z
    .strictObject({
      id: S.id,
      title_de: S.title_de,
      description_de: S.description_de,
      meal_types: S.meal_types,
      training_tags: S.training_tags,
      servings: S.servings,
      ingredients: z
        .array(
          z.strictObject({
            food_id: foodId,
            amount: I.amount,
            unit: I.unit,
            optional: I.optional,
            note_de: I.note_de,
            scales: I.scales,
            heated: z.boolean(),
            role: z.enum(INGREDIENT_ROLES),
          }),
        )
        .min(1)
        .max(20),
      steps_de: S.steps_de,
      tip_de: S.tip_de,
      categories: S.categories,
      prep_minutes: S.prep_minutes,
      cook_minutes: S.cook_minutes,
      no_cook: focus === 'ohne_kochen' ? z.literal(true) : S.no_cook,
      meal_prep:
        focus === 'meal_prep'
          ? z.strictObject({
              suitable: z.literal(true),
              fridge_days: mealPrep.fridge_days,
              freezable: mealPrep.freezable,
            })
          : S.meal_prep,
      equipment_de: S.equipment_de,
      declared_per_serving: S.declared_per_serving,
      declared_diet: diet === 'omnivore' ? S.declared_diet : z.literal(diet),
      declared_allergens: S.declared_allergens,
      contains_pork: diet === 'omnivore' ? S.contains_pork : z.literal(false),
      declared_pregnancy_caution: S.declared_pregnancy_caution,
      missing_foods_de: z
        .array(z.string().min(2).max(60))
        .max(RECIPE_MISSING_FOODS_MAX)
        .describe(
          'Lebensmittel, die im Katalog fehlen (nur Vorschlag, nicht als Zutat verwenden).',
        ),
    })
    .superRefine((recipe, ctx) => {
      if (!recipe.meal_types.includes(meal)) {
        ctx.addIssue({
          code: 'custom',
          path: ['meal_types'],
          message: `Mahlzeit „${meal}“ fehlt (fest je custom_id).`,
        });
      }
      if (focus === 'schnell' && recipe.prep_minutes + recipe.cook_minutes > 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['prep_minutes'],
          message: 'Schwerpunkt „schnell“: Vorbereitung + Kochzeit höchstens 10 Minuten.',
        });
      }
      if (focus === 'nach_training' && !recipe.training_tags.includes('nach_training')) {
        ctx.addIssue({
          code: 'custom',
          path: ['training_tags'],
          message: 'Schwerpunkt „nach dem Training“: training_tags braucht „nach_training“.',
        });
      }
      if (recipe.no_cook && recipe.ingredients.some((ingredient) => ingredient.heated)) {
        ctx.addIssue({
          code: 'custom',
          path: ['ingredients'],
          message: 'Ohne Kochen („no_cook“): keine erhitzte Zutat.',
        });
      }
    });
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** Erlaubte Einheiten eines Lebensmittels (R2: in Gramm umrechenbar). */
function unitsText(food: Food): string {
  const u = food.units;
  return [
    'g',
    u.ml_to_g === undefined ? null : `ml (1 ml = ${fmt(u.ml_to_g)} g)`,
    u.piece_g === undefined ? null : `piece (1 Stück = ${fmt(u.piece_g)} g)`,
    u.tbsp_g === undefined ? null : `tbsp (1 EL = ${fmt(u.tbsp_g)} g)`,
    u.tsp_g === undefined ? null : `tsp (1 TL = ${fmt(u.tsp_g)} g)`,
    `pinch (1 Prise = ${fmt(PINCH_G)} g)`,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
}

function catalogLine(food: Food): string {
  const n = food.nutrients_per_100g;
  const extras = [
    food.groups.length > 0 ? `Gruppen: ${food.groups.join(', ')}` : 'Gruppen: keine',
    food.animal.length > 0 ? `tierisch: ${food.animal.join(', ')}` : 'pflanzlich',
    food.meat_kind.length > 0 ? `Fleischart: ${food.meat_kind.join(', ')}` : null,
    food.gelatin_origin === undefined ? null : `Gelatine-Herkunft: ${food.gelatin_origin}`,
    food.pregnancy_caution ? 'Schwangerschaft: Vorsicht' : null,
    `Kühlschrank höchstens ${food.max_fridge_days} ${food.max_fridge_days === 1 ? 'Tag' : 'Tage'}`,
  ].filter((part): part is string => part !== null);
  return `- ${food.id}: ${food.name_de} | je 100 g: ${fmt(n.kcal)} kcal, Eiweiß ${fmt(n.protein_g)} g, Kohlenhydrate ${fmt(n.carbs_g)} g, Fett ${fmt(n.fat_g)} g, Salz ${fmt(n.salt_g)} g | Einheiten: ${unitsText(food)} | ${extras.join(' | ')}`;
}

function systemPrompt(context: LibraryContext): string {
  const medical = FORBIDDEN_MEDICAL_TERMS.map((rule) => rule.label).join(', ');
  const claims = HEALTH_CLAIM_TERMS.map((rule) => rule.label).join(', ');
  const brands = [...FORBIDDEN_BRANDS, ...FORBIDDEN_FOOD_BRANDS]
    .slice(0, 12)
    .map((rule) => rule.label)
    .join(', ');
  const kcal = RECIPE_CHECK_LIMITS.kcalPerServing;
  const per = RECIPE_CHECK_LIMITS.perServing;
  const foods = usableFoods(context);
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Schreibe genau EIN Rezept für den Rezeptbestand der App. Die App rechnet Nährwerte, Allergene, Ernährungsform und Schwangerschafts-Hinweise selbst aus den Zutaten und dem Katalog (amtliche Nährwert-Quelle) – deine Angaben „declared_*“ dienen nur der Gegenprüfung und müssen dazu passen.',
    '',
    'Regeln für alle Texte:',
    '- Deutsch, klar, kurz und sachlich; keine Emojis, kein Markdown; kein Leerzeichen am Anfang oder Ende.',
    `- Keine gesundheits- oder nährwertbezogenen Versprechen (Health-Claims-Verordnung, VO (EG) 1924/2006): verboten sind u. a. ${claims}. Nenne stattdessen neutrale Zahlen oder nichts.`,
    `- Keine Heilversprechen, keine Diagnosen, keine Aussagen über Krankheiten. Verboten: ${medical}.`,
    `- Keine Marken- oder Herstellernamen (z. B. ${brands}).`,
    '',
    'Regeln für Rezepte:',
    '- id: Kleinbuchstaben, Ziffern und Bindestriche, deutsch, ohne Umlaute (ä → ae, ö → oe, ü → ue, ß → ss), z. B. „linsen-curry-spinat“. Die ID darf es noch nicht geben.',
    '- Zutaten (food_id) NUR aus dem Katalog unten (im Schema vorgegeben). Kein Alkohol. Fehlt dir ein Lebensmittel, nutze es NICHT, sondern nenne es in „missing_foods_de“ (nur Vorschlag; sonst leere Liste).',
    '- unit: nur Einheiten, die beim Lebensmittel im Katalog stehen (g geht immer; pinch = Prise). amount je Grundrezept (servings Portionen).',
    `- Mengen je Portion plausibel: Salz höchstens ${fmt(per.saltMaxG)} g, Öl höchstens ${fmt(per.oilMaxG)} g, jede Zutat höchstens ${fmt(per.ingredientMaxG)} g.`,
    '- heated: true, wenn die Zutat beim Zubereiten durcherhitzt wird, sonst false. Bei Ei, Fisch, Krebs-/Weichtieren, Fleisch und Rohmilch besonders sorgfältig (rohes Ei, Räucherlachs, Tatar = false).',
    '- role: protein, carb, fat, vegetable, seasoning oder sweet – die Hauptaufgabe der Zutat im Rezept.',
    '- scales: false nur für Zutaten, die beim Vervielfachen nicht mitwachsen (z. B. eine Prise Salz), sonst true. optional: true nur für echte Extras.',
    '- no_cook: true = ohne Herd und Ofen; dann cook_minutes = 0, alle heated = false und keine Herd-/Ofen-Geräte in equipment_de.',
    `- meal_prep: fridge_days höchstens ${MEAL_PREP_FRIDGE_DAYS.max} und nie länger als die kürzeste Kühlschrank-Angabe der Zutaten; nicht geeignet → suitable false, fridge_days 0, freezable false.`,
    `- declared_per_serving (je Portion, ohne optionale Zutaten): aus den Katalog-Werten rechnen. Richtwerte kcal je Portion: Frühstück ${kcal.breakfast.min}–${kcal.breakfast.max}, Hauptgericht ${kcal.main.min}–${kcal.main.max}, Snack ${kcal.snack.min}–${kcal.snack.max}.`,
    '- declared_diet: vegan = keine tierischen Bestandteile; vegetarian = ohne Fleisch, Fisch, Krebs-/Weichtiere, Gelatine, tierisches Lab, Insekten; sonst omnivore. Optionale Zutaten zählen mit.',
    '- declared_allergens: ALLE Gruppen aller Zutaten (auch optionaler) aus dem Katalog, ohne Lücke.',
    '- contains_pork: true, wenn eine Zutat Fleischart pork hat oder Gelatine mit Herkunft pork/unknown.',
    '- declared_pregnancy_caution: true, wenn eine Zutat „Schwangerschaft: Vorsicht“ hat ODER eine Zutat aus Ei, Fisch, Krebs-/Weichtieren, Fleisch oder Rohmilch nicht erhitzt wird ODER das Rezept no_cook ist und eine solche Zutat enthält.',
    `- categories (optional): ${RECIPE_CATEGORIES.map((c) => `${c.id} = ${c.name_de}`).join('; ')}.`,
    '- steps_de: 1–15 kurze Schritte; tip_de optional (ein praktischer Tipp zur Zubereitung oder Aufbewahrung).',
    '- Alltagstaugliche Zutaten aus dem DACH-Supermarkt, keine exotischen Kombinationen.',
    '',
    `Gruppen (ID: Bedeutung): ${FOOD_GROUPS.map((g) => `${g.id} = ${g.nameDe}`).join('; ')}.`,
    `Mahlzeiten: ${MEAL_TYPES.join(', ')}; training_tags: ${TRAINING_TAGS.join(', ')}.`,
    '',
    'Katalog (ID: Name | Nährwerte je 100 g | Einheiten | Eigenschaften):',
    foods.map(catalogLine).join('\n') || '- (noch keine katalog-geprüften Lebensmittel)',
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell, context: LibraryContext): string {
  const { meal, diet, focus } = cellValues(cell);
  const existing = context.recipes
    .filter(
      (recipe) =>
        recipe.status !== 'archived' &&
        recipe.meal_types.includes(meal) &&
        recipe.declared_diet === diet,
    )
    .map((recipe) => `${recipe.id} (${recipe.title_de})`);
  return [
    `Mahlzeit: ${meal} (${MEAL_LABELS[meal].labelDe}) – meal_types muss „${meal}“ enthalten.`,
    `Ernährungsform: ${diet} (${DIET_LABELS[diet].labelDe}).`,
    `Schwerpunkt: ${RECIPE_FOCI[focus].labelDe} – ${RECIPE_FOCI[focus].hint}.`,
    `Vorhandene Rezepte dieser Art (bitte nichts davon wiederholen): ${existing.slice(0, 80).join(', ') || 'keine'}.`,
    'Schreibe ein neues, alltagstaugliches Rezept, das es noch nicht gibt.',
  ].join('\n');
}

/** Ohne undefined-Felder, in fester Reihenfolge. */
function ordered(keys: readonly string[], value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]),
  );
}

function toContent(
  output: unknown,
  _cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> } {
  const { missing_foods_de: missing, ...data } = output as Record<string, unknown> & {
    missing_foods_de: string[];
    ingredients: Record<string, unknown>[];
  };
  const note =
    missing.length > 0
      ? `KI-Vorschlag fehlender Lebensmittel (nicht im Katalog, nicht verwendet): ${missing.join(', ')}.`
      : null;
  const reviewNote = [meta.review_note, note].filter((part) => typeof part === 'string').join(' ');
  const merged: Record<string, unknown> = {
    ...data,
    ingredients: data.ingredients.map((ingredient) => ordered(INGREDIENT_FIELD_ORDER, ingredient)),
    version: 1,
    status: 'draft',
    meta: { ...meta, review_note: reviewNote === '' ? null : reviewNote.slice(0, 1000) },
  };
  return { id: String(data.id), content: ordered(FIELD_ORDER, merged) };
}

/**
 * Feste Beispiel-Antworten für den Probelauf (ohne KI): eine gültige (vegan, ohne Kochen, nur pflanzliche Zutaten),
 * eine ungültige (Grenzen), eine Ablehnung. Fehlen die IDs im Katalog, meldet content:validate R2 rot – Probelauf-
 * Entwürfe werden ohnehin nie freigegeben (Regel PROBELAUF).
 */
function dryRunFixtures() {
  return [
    {
      cell: cellFor('breakfast', 'vegan', 'ohne_kochen'),
      response: {
        kind: 'json' as const,
        data: {
          id: 'probelauf-haferflocken-banane',
          title_de: 'Haferflocken mit Banane (Probelauf)',
          description_de:
            'Beispiel-Entwurf aus dem Probelauf: Haferflocken mit zerdrückter Banane, ohne Kochen.',
          meal_types: ['breakfast'],
          training_tags: ['vor_training'],
          servings: 1,
          ingredients: [
            {
              food_id: 'haferflocken',
              amount: 60,
              unit: 'g',
              optional: false,
              scales: true,
              heated: false,
              role: 'carb',
            },
            {
              food_id: 'banane',
              amount: 1,
              unit: 'piece',
              optional: false,
              note_de: 'reif',
              scales: true,
              heated: false,
              role: 'sweet',
            },
          ],
          steps_de: [
            'Banane in einer Schüssel mit einer Gabel zerdrücken.',
            'Haferflocken untermischen und kurz quellen lassen.',
          ],
          prep_minutes: 5,
          cook_minutes: 0,
          no_cook: true,
          meal_prep: { suitable: false, fridge_days: 0, freezable: false },
          equipment_de: ['Schüssel', 'Gabel'],
          declared_per_serving: { kcal: 334, protein_g: 9, carbs_g: 59, fat_g: 4 },
          declared_diet: 'vegan',
          declared_allergens: ['gluten'],
          contains_pork: false,
          declared_pregnancy_caution: false,
          missing_foods_de: [],
        },
      },
    },
    {
      // Absichtlich ungültig: hält das JSON-Format ein, verletzt aber Grenzen (prüft Zod).
      cell: cellFor('snack', 'vegetarian', 'schnell'),
      response: {
        kind: 'json' as const,
        data: {
          id: 'probelauf-ungueltig',
          title_de: 'Ungültig (Probelauf)',
          description_de: 'Zu kurz',
          meal_types: ['snack'],
          training_tags: [],
          servings: 0,
          ingredients: [],
          steps_de: [],
          prep_minutes: 0,
          cook_minutes: 0,
          no_cook: true,
          meal_prep: { suitable: false, fridge_days: 0, freezable: false },
          equipment_de: [],
          declared_per_serving: { kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1 },
          declared_diet: 'vegetarian',
          declared_allergens: [],
          contains_pork: false,
          declared_pregnancy_caution: false,
          missing_foods_de: [],
        },
      },
    },
    { cell: cellFor('main', 'omnivore', 'alltag'), response: { kind: 'refusal' as const } },
  ];
}

/**
 * Startpunkt der Reihenfolge (Wächter N8 H5): Anzahl vorhandener KI-Rezepte aus Batch-Läufen (nicht zurückgezogen,
 * ohne Probelauf) modulo Zellenzahl. Deterministisch aus dem Stand in `main`; nach jedem gemergten Lauf rückt der
 * Start weiter, sodass „alle“ mit kleiner „Anzahl“ nicht immer dieselben Zellen anfragt.
 */
export function recipeRotationOffset(context: LibraryContext): number {
  const total = FOCUS_KEYS.length * MEAL_TYPES.length * DIET_TYPES.length;
  const fromBatches = context.recipes.filter(
    (recipe) =>
      recipe.status !== 'archived' && recipe.meta.origin === 'batch' && !isDryRunContent(recipe),
  ).length;
  return fromBatches % total;
}

/**
 * Alle 45 Zellen: Schwerpunkt außen, dann Mahlzeit, dann Ernährungsform – so wechseln sich aufeinanderfolgende Zellen
 * in Mahlzeit und Ernährungsform ab (die ersten 9 decken jede Kombination ab) – und ab `recipeRotationOffset` gedreht.
 */
export function recipeCells(context: LibraryContext): GenerationCell[] {
  const all = FOCUS_KEYS.flatMap((focus) =>
    MEAL_TYPES.flatMap((meal) => DIET_TYPES.map((diet) => cellFor(meal, diet, focus))),
  );
  const offset = recipeRotationOffset(context);
  return [...all.slice(offset), ...all.slice(0, offset)];
}

export const recipeKind: ContentKindDefinition = {
  kind: 'recipe',
  inputName: 'recipes',
  labelDe: 'Rezepte',
  folder: 'recipes',
  contentSchema: recipeSchema,
  // Standard: Allergene, Schwangerschaft, Nährwerte – Flash-Lite fachlich fraglich (Gründer-Vorgabe 15.10.2026, docs/PLAN-PHASE-5.md N8).
  defaultModel: MODEL_FLASH,
  defaultEffort: 'medium',
  maxTokens: RECIPE_MAX_TOKENS,
  dimensions: [
    {
      key: 'mahlzeit',
      labelDe: 'Mahlzeit',
      values: MEAL_TYPES.map((value) => ({ value, aliases: MEAL_LABELS[value].aliases })),
    },
    {
      key: 'ernaehrung',
      labelDe: 'Ernährungsform',
      values: DIET_TYPES.map((value) => ({ value, aliases: DIET_LABELS[value].aliases })),
    },
    {
      key: 'schwerpunkt',
      labelDe: 'Schwerpunkt',
      values: FOCUS_KEYS.map((value) => ({ value, aliases: [...RECIPE_FOCI[value].aliases] })),
    },
  ],
  cells: recipeCells,
  selectionNote: (context) =>
    `Reihenfolge der Rezept-Zellen: abwechselnd Mahlzeit und Ernährungsform, Start bei Zelle ${recipeRotationOffset(context) + 1} von ${FOCUS_KEYS.length * MEAL_TYPES.length * DIET_TYPES.length} (= Anzahl vorhandener KI-Rezepte; rückt mit jedem gemergten Lauf weiter). Gezielt: Auswahl z. B. „snack vegan“.`,
  // Rezepte werden nie übersprungen: Pro Zelle kann es viele sinnvolle Rezepte geben (wie bei Übungen).
  isPresent: () => false,
  unavailableReason: (context) =>
    usableFoods(context).length === 0
      ? 'Es gibt noch keine katalog-geprüften Lebensmittel (R19) – Rezepte dürfen nur Katalog-Zutaten nutzen. Zuerst den Lebensmittel-Katalog importieren und prüfen (docs/SETUP.md Teil J).'
      : null,
  systemPrompt,
  userPrompt,
  outputSchema: recipeOutputSchema,
  toContents: (output, cell, meta) => [toContent(output, cell, meta)],
  dryRunFixtures,
};
