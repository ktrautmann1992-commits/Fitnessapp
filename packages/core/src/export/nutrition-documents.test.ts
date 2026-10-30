/**
 * Etappe N6 – PDF P5 (docs/PLAN-PHASE-5.md 11, 12.1 „PDF (K4)“): Essensplan und Einkaufsliste als Druck-Dokument.
 *
 * K4-Formulierung: Gesundheitsangaben (Unverträglichkeiten, Flags, Schwangerschaft, Gewicht, Alter, Gründe leerer
 * Plätze, `usesHealthData`) ändern das Dokument NUR über die Rezeptauswahl und die Ersatz-/Weglass-Hinweise der
 * Rezepte – sonst ist es identisch. Dazu: Escaping/Steuerzeichen, „Zahlen aus“ (Einstellung und Schwangerschaft),
 * `below_floor` ohne Zahl, `no_targets` ohne Summe, keine kcal auf der Einkaufsliste. Grenzfälle: 1 vs. 8 Mahlzeiten,
 * Meal-Prep, sehr lange Rezepte (Folgeseiten), mehr als 4 Portionsgrößen, sehr lange Einkaufsliste, leere Liste.
 */
import { describe, expect, it } from 'vitest';

import { PRINT_EXPORT } from '../constants';
import type { Recipe } from '../content/recipe-schema';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from '../nutrition/meal-plan';
import { withoutNutrientAmounts } from '../nutrition/guides';
import { N3_FOODS, N3_RECIPES } from '../nutrition/meal-plan-fixtures';
import type { MealPlanProfileInput, NutritionInputsInput } from '../nutrition/schemas';
import { buildShoppingList, type ShoppingListItem } from '../nutrition/shopping-list';
import { nutritionTargetsForWeek, type NutritionWeekTargets } from '../nutrition/targets';
import { inputs, MONDAY } from '../nutrition/test-helpers';
import {
  type PrintBlock,
  type PrintDocument,
  printDocumentSchema,
  type PrintText,
} from './document';
import {
  buildNutritionPlanDocument,
  buildShoppingListDocument,
  type NutritionPlanPrintOptionsInput,
} from './nutrition-documents';

const SUNDAY_BEFORE = '2026-10-11';
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const female = { sex: 'female' as const, healthFlags: { flags: [] } };
const pregnant = {
  sex: 'female' as const,
  healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
} satisfies Partial<NutritionInputsInput>;

function planInput(
  overrides: Partial<NutritionInputsInput> = {},
  profile: MealPlanProfileInput = omni,
  recipes: readonly Recipe[] = N3_RECIPES,
): MealPlanInput {
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, ...overrides }),
      MONDAY,
    ),
    profile,
    recipes,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
  };
}

const OPTIONS: NutritionPlanPrintOptionsInput = {
  onDate: SUNDAY_BEFORE,
  showEnergyNumbers: true,
};

function planDoc(
  plan: MealPlanWeek,
  targets: Pick<NutritionWeekTargets, 'days'>,
  options: Partial<NutritionPlanPrintOptionsInput> = {},
  recipes: readonly Recipe[] = N3_RECIPES,
): PrintDocument {
  const result = buildNutritionPlanDocument(
    { plan, targets, recipes, foods: N3_FOODS },
    { ...OPTIONS, ...options },
  );
  if (!result.ok) throw new Error(result.error);
  // Jedes Dokument muss das Zod-Schema der App-Grenze bestehen.
  expect(printDocumentSchema.safeParse(result.document).success).toBe(true);
  return result.document;
}

function build(
  overrides: Partial<NutritionInputsInput> = {},
  profile: MealPlanProfileInput = omni,
  options: Partial<NutritionPlanPrintOptionsInput> = {},
) {
  const input = planInput(overrides, profile);
  const plan = buildMealPlanWeek(input);
  return { plan, targets: input.targets, doc: planDoc(plan, input.targets, options) };
}

/** Alle Texte eines Dokuments (inkl. Tabellen, Listen, Meta). */
function texts(doc: PrintDocument): PrintText[] {
  const out: PrintText[] = [doc.meta.title, doc.meta.footer];
  const visit = (block: PrintBlock) => {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        out.push(block.text);
        break;
      case 'keyValue':
        for (const i of block.items) out.push(i.label, i.value);
        break;
      case 'table':
        out.push(block.caption, ...block.columns.map((c) => c.header));
        for (const r of block.rows) out.push(...r.header, ...r.cells.flat());
        break;
      case 'notice':
        out.push(block.title, block.text);
        break;
      case 'checklist':
        out.push(block.caption, ...block.items.flatMap((i) => i.text));
        break;
      case 'steps':
        out.push(...block.items);
        break;
      case 'pageBreak':
        break;
    }
  };
  doc.sections.forEach(visit);
  return out;
}

const codes = (doc: PrintDocument) =>
  texts(doc).flatMap((v) => (v.kind === 'text' ? [v.code] : []));

const withCode = (doc: PrintDocument, code: string) =>
  texts(doc).filter((v) => v.kind === 'text' && v.code === code);

const pages = (doc: PrintDocument) => doc.sections.filter((b) => b.type === 'pageBreak').length + 1;

// Jeder Test baut eine ganze Essensplan-Woche aus dem Rezeptbestand – unter Last (turbo parallel) über der 5-s-Vorgabe.
describe('Essensplan als PDF (Dokumentmodell)', { timeout: 60_000 }, () => {
  it('Deckblatt, Wochenübersicht, je Rezept ein Abschnitt; Arzt- und Produkt-Hinweis; Namensnennung im Fuß', () => {
    const { plan, doc } = build(female);
    expect(doc.meta.kind).toBe('nutrition_plan');
    expect(doc.meta.fileName).toBe(`alpha5-essensplan-${MONDAY}`);
    const first = doc.sections[0];
    expect(first?.type === 'heading' && first.text).toEqual({
      kind: 'text',
      code: 'nutrition.cover.heading',
      params: { document: 'nutrition_plan' },
    });
    const all = codes(doc);
    for (const code of [
      'nutrition.notice.medical',
      'nutrition.notice.products',
      'mealplan.week.heading',
      'mealplan.legend',
      'recipe.steps',
      'recipe.inPlan',
    ]) {
      expect(all, code).toContain(code);
    }
    // Je Rezept (gleiche Zutaten) genau eine Überschrift.
    const titles = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.titleDe)));
    const headings = doc.sections.filter(
      (b) => b.type === 'heading' && b.level === 2 && b.text.kind === 'data',
    );
    expect(headings.length).toBe(titles.size);
    // Wochenübersicht: Mo–So + Spalte Mahlzeit.
    const table = doc.sections.find((b) => b.type === 'table');
    expect(table?.type === 'table' && table.columns.length).toBe(8);
    // Fuß mit Quelle (Testkatalog = BLS-Fixtures).
    expect(doc.meta.footer.kind === 'text' && doc.meta.footer.code).toBe('nutrition.doc.footer');
    const footerParams = doc.meta.footer.kind === 'text' ? doc.meta.footer.params : null;
    expect(footerParams).toMatchObject({ document: 'nutrition_plan', testValues: false });
    expect((footerParams as unknown as { sources: unknown[] }).sources.length).toBeGreaterThan(0);
  });

  it('Name nur auf Wunsch; ungültiger Name bzw. Häkchen ohne Name → invalid_options', () => {
    const input = planInput(female);
    const plan = buildMealPlanWeek(input);
    expect(codes(planDoc(plan, input.targets))).not.toContain('cover.label.name');
    const named = planDoc(plan, input.targets, { includeName: true, name: 'Kim' });
    expect(codes(named)).toContain('cover.label.name');
    expect(texts(named)).toContainEqual({ kind: 'data', value: 'Kim' });
    for (const bad of [
      { includeName: true, name: null },
      { includeName: true, name: '   ' },
      { includeName: true, name: 'Kim\u0007' },
      { includeName: true, name: 'x'.repeat(PRINT_EXPORT.nameMaxLength + 1) },
      { onDate: '12.10.2026' },
    ]) {
      const result = buildNutritionPlanDocument(
        { plan, targets: input.targets, recipes: N3_RECIPES, foods: N3_FOODS },
        { ...OPTIONS, ...bad } as NutritionPlanPrintOptionsInput,
      );
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('Zahlen: Tagessumme nur bei „Zahlen an“ und Tag `complete`; aus → keine kcal; Testwerte statt Quelle', () => {
    const { plan, targets, doc } = build(female);
    const complete = plan.days.filter((d) => d.status === 'complete').length;
    expect(complete).toBeGreaterThan(0);
    expect(withCode(doc, 'value.kcal')).toHaveLength(complete);
    const kcal = withCode(doc, 'value.kcal').map(
      (v) => (v as { params: { kcal: number } }).params.kcal,
    );
    expect(kcal).toEqual(
      plan.days.filter((d) => d.status === 'complete').map((d) => Math.round(d.totals.kcal)),
    );

    const off = planDoc(plan, targets, { showEnergyNumbers: false });
    expect(withCode(off, 'value.kcal')).toEqual([]);
    expect(JSON.stringify(off)).not.toMatch(/"kcal"/);
    expect(withCode(off, 'nutrition.howTo')[0]).toMatchObject({ params: { numbers: false } });

    const test = planDoc(plan, targets, { testValues: true });
    expect(codes(test)).toContain('nutrition.notice.testValues');
    expect(test.meta.footer).toMatchObject({ params: { sources: [], testValues: true } });
  });

  it('Schwangerschaft: auch bei „Zahlen an“ nirgends kcal (B5) – Tage `no_targets` ohne Summe', () => {
    const { plan, doc } = build(pregnant, omni, { showEnergyNumbers: true });
    expect(plan.days.every((d) => d.status === 'no_targets')).toBe(true);
    expect(withCode(doc, 'value.kcal')).toEqual([]);
    expect(codes(doc)).not.toContain('mealplan.row.day');

    // Gespeicherter Plan mit Zahlen-Tagen, aber die Woche hat jetzt Schwangerschaft → keine Zahlen.
    const normal = build(female);
    const hidden = planDoc(normal.plan, planInput(pregnant).targets, { showEnergyNumbers: true });
    expect(withCode(hidden, 'value.kcal')).toEqual([]);
  });

  it('Tag `below_floor`: Hinweis statt Zahl, Legende erklärt ihn – ohne Zahl', () => {
    const { plan, targets } = build(female);
    const index = plan.days.findIndex((d) => d.status === 'complete');
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d, i) =>
        i === index ? { ...d, status: 'below_floor', notices: ['day_below_floor'] } : d,
      ),
    };
    const doc = planDoc(changed, targets);
    const table = doc.sections.find((b) => b.type === 'table');
    if (table?.type !== 'table') throw new Error('Tabelle erwartet');
    const totals = table.rows.at(-1);
    expect(totals?.header[0]).toMatchObject({ code: 'mealplan.row.day' });
    expect(totals?.cells[index]).toEqual([
      { kind: 'text', code: 'mealplan.cell.belowFloor', params: {} },
    ]);
    expect(withCode(doc, 'value.kcal')).toHaveLength(
      plan.days.filter((d) => d.status === 'complete').length - 1,
    );
    expect(withCode(doc, 'mealplan.legend')[0]).toMatchObject({
      params: { hasBelowFloor: true },
    });
  });

  it('K4: Gesundheitsbezug ändert das Dokument nur über Rezeptauswahl und Ersatz-/Weglass-Hinweise', () => {
    const input = planInput(female, { diet: 'vegetarian', intolerances: ['lactose'] });
    const plan = buildMealPlanWeek(input);
    expect(plan.usesHealthData).toBe(true);
    expect(plan.days.some((d) => d.meals.some((m) => m.substitutions.length > 0))).toBe(true);
    const base = planDoc(plan, input.targets, { showEnergyNumbers: false });

    // (1) `usesHealthData`, Hinweise und Gründe leerer Plätze fließen nicht ein.
    const disguised: MealPlanWeek = {
      ...plan,
      usesHealthData: false,
      notices: [],
      days: plan.days.map((d) => ({
        ...d,
        notices: [],
        emptySlots: d.emptySlots.map((e) => ({ ...e, reasons: [] })),
      })),
    };
    expect(planDoc(disguised, input.targets, { showEnergyNumbers: false })).toEqual(base);
    const louder: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        emptySlots: d.emptySlots.map((e) => ({
          ...e,
          reasons: ['intolerance', 'pregnancy_caution'],
        })),
      })),
    };
    expect(planDoc(louder, input.targets, { showEnergyNumbers: false })).toEqual(base);

    // (2) Ziele mit Schwangerschaft/Gewicht/Alter (bei „Zahlen aus“) ändern nichts.
    for (const overrides of [
      pregnant,
      { birthDate: '2010-01-01' },
      { bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 150, weightKg: 45 }] },
      { healthDataConsent: false },
    ] as Partial<NutritionInputsInput>[]) {
      const other = planInput({ ...female, ...overrides }).targets;
      expect(planDoc(plan, other, { showEnergyNumbers: false })).toEqual(base);
    }

    // (3) Derselbe Plan ohne Ersatz: Unterschiede NUR in den Zutaten-Zeilen der Rezepte.
    const plain: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        meals: d.meals.map((m) => ({
          ...m,
          substitutions: [],
          ingredients: m.ingredients.map((i) => ({
            ...i,
            foodId: i.originalFoodId ?? i.foodId,
            originalFoodId: null,
          })),
        })),
      })),
    };
    const plainDoc = planDoc(plain, input.targets, { showEnergyNumbers: false });
    const a = texts(base).map((v) => JSON.stringify(v));
    const b = texts(plainDoc).map((v) => JSON.stringify(v));
    expect(a.length).toBe(b.length);
    const differing = a.flatMap((value, i) => (value === b[i] ? [] : [JSON.parse(value)]));
    expect(differing.length).toBeGreaterThan(0);
    for (const value of differing) {
      expect(['recipe.ingredient', 'nutrition.doc.footer']).toContain(value.code);
    }
    const instead = withCode(base, 'recipe.ingredient').filter(
      (v) => (v as { params: { original: string | null } }).params.original !== null,
    );
    expect(instead.length).toBeGreaterThan(0);

    // (4) Nirgends Gründe, Flags, Ziele, Gewicht, Alter oder Unverträglichkeits-Codes. (Ersatzprodukt-Namen wie
    // „Laktosefreie Milch“ sind die bewusste Ausnahme K4; Titel sind feste Codes, nie „laktosefrei“.)
    expect(base.meta.title).toEqual({
      kind: 'text',
      code: 'nutrition.doc.title',
      params: { document: 'nutrition_plan' },
    });
    const json = JSON.stringify(base);
    for (const word of [
      'lactose',
      'intolerance',
      'pregnan',
      'usesHealthData',
      'fat_loss',
      'general_fitness',
      'weight',
      'birth',
      'flag',
      '1990',
      'day_below_floor',
    ]) {
      expect(json.toLowerCase(), word).not.toContain(word.toLowerCase());
    }
  });

  it('leerer Platz: neutral „kein passendes Rezept“ ohne Grund', () => {
    const { plan, targets } = build(female);
    const day = plan.days[2] as MealPlanWeek['days'][number];
    const meal = day.meals.find((m) => m.slot !== 'extra_1' && m.slot !== 'extra_2');
    if (!meal) throw new Error('Mahlzeit fehlt');
    const slot = meal.slot as Exclude<typeof meal.slot, 'extra_1' | 'extra_2'>;
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d) =>
        d === day
          ? {
              ...d,
              meals: d.meals.filter((m) => m !== meal),
              emptySlots: [{ slot, reasons: ['intolerance' as const] }],
            }
          : d,
      ),
    };
    const doc = planDoc(changed, targets);
    expect(codes(doc)).toContain('mealplan.cell.noRecipe');
    expect(JSON.stringify(doc)).not.toContain('intolerance');
  });

  it('1 vs. 8 Mahlzeiten je Tag: Zeilen je Platz, Ergänzungen in einer Zeile; Schema gültig', () => {
    for (const mealsPerDay of [1, 8]) {
      const { plan, doc } = build({ ...female, mealsPerDay });
      // Bei 8 Mahlzeiten kann die Übersicht auf eine Folgeseite umbrechen („Wochenübersicht (Fortsetzung)“).
      const weekTables = doc.sections.flatMap((b) =>
        b.type === 'table' &&
        b.caption.kind === 'text' &&
        b.caption.code === 'mealplan.week.heading'
          ? [b]
          : [],
      );
      const rows = weekTables.flatMap((b) => b.rows);
      const slots = new Set(
        plan.days.flatMap((d) => [
          ...d.meals.map((m) => m.slot).filter((s) => s !== 'extra_1' && s !== 'extra_2'),
          ...d.emptySlots.map((e) => e.slot),
        ]),
      );
      const hasExtra = plan.days.some((d) =>
        d.meals.some((m) => m.slot === 'extra_1' || m.slot === 'extra_2'),
      );
      const mealRows = rows.filter(
        (r) => r.header[0]?.kind === 'text' && r.header[0].code === 'mealplan.slot',
      );
      if (weekTables.length > 1) {
        expect(weekTables[1]?.caption).toMatchObject({ params: { continued: true } });
      }
      expect(mealRows.length).toBe(slots.size + (hasExtra ? 1 : 0));
    }
  });

  it('8 Mahlzeiten × 7 Tage mit lauter verschiedenen Rezepten: jedes Rezept einmal, Schema gültig', () => {
    const { plan, targets } = build({ ...female, mealsPerDay: 8 });
    const clones: Recipe[] = [...N3_RECIPES];
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d, di) => ({
        ...d,
        meals: d.meals.map((m, mi) => {
          const original = N3_RECIPES.find((r) => r.id === m.recipeId) as Recipe;
          const id = `${m.recipeId}-${di}-${mi}`;
          clones.push({ ...original, id, title_de: `${original.title_de} ${di}-${mi}` });
          return { ...m, recipeId: id };
        }),
      })),
    };
    const meals = changed.days.reduce((n, d) => n + d.meals.length, 0);
    expect(meals).toBeGreaterThanOrEqual(50);
    const doc = planDoc(changed, targets, {}, clones);
    expect(withCode(doc, 'recipe.inPlan')).toHaveLength(meals);
  });

  it('Meal-Prep: Kochtag und „vorgekocht“ markiert, Legende erklärt beides', () => {
    const { doc } = build(
      { ...female, mealsPerDay: 4 },
      {
        ...omni,
        cookingMode: 'meal_prep',
        mealprepDays: 2,
        mealprepSlots: 'lunch_dinner',
      },
    );
    const marks = withCode(doc, 'mealplan.mark').map(
      (v) => (v as { params: { mark: string } }).params.mark,
    );
    expect(marks).toContain('cook');
    expect(marks).toContain('leftover');
    expect(withCode(doc, 'mealplan.legend')[0]).toMatchObject({
      params: { hasCook: true, hasLeftover: true },
    });
  });

  it('Rezept: verschiedene Mengen je Tag → je Menge eine Spalte mit Wochentagen; > 4 Mengen → weitere Tabelle', () => {
    const { plan, targets } = build(female);
    const meal = plan.days[0]?.meals[0];
    if (!meal) throw new Error('Mahlzeit fehlt');
    // Dieselbe Mahlzeit an allen 7 Tagen mit 5 verschiedenen Faktoren.
    const factors = [0.5, 1, 1, 1.5, 2, 2.5, 2.5];
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d, i) => ({
        ...d,
        meals: [
          {
            ...meal,
            factor: factors[i] as number,
            ingredients: meal.ingredients.map((x) => ({
              ...x,
              amount: x.amount * (factors[i] as number),
            })),
          },
        ],
        emptySlots: [],
      })),
    };
    const doc = planDoc(changed, targets);
    const tables = doc.sections.filter(
      (b) =>
        b.type === 'table' && b.caption.kind === 'text' && b.caption.code === 'recipe.ingredients',
    );
    expect(tables).toHaveLength(2);
    const headers = tables.flatMap((t) =>
      t.type === 'table' ? t.columns.slice(1).map((c) => c.header) : [],
    );
    expect(headers.map((h) => (h as { params: { factor: number } }).params.factor)).toEqual([
      0.5, 1, 1.5, 2, 2.5,
    ]);
    expect(headers[1]).toMatchObject({ params: { weekdays: [2, 3] } });
    expect(headers[4]).toMatchObject({ params: { weekdays: [6, 7] } });
    expect(withCode(doc, 'recipe.inPlan')[0]).toMatchObject({
      params: { uses: expect.arrayContaining([{ date: MONDAY, slot: meal.slot }]) },
    });
  });

  it('sehr langes Rezept (20 Zutaten, 15 lange Schritte, langer Titel): Folgeseiten, Schritte laufen weiter', () => {
    const { plan, targets } = build(female);
    const meal = plan.days[0]?.meals[0];
    const recipe = N3_RECIPES.find((r) => r.id === meal?.recipeId);
    if (!meal || !recipe) throw new Error('Rezept fehlt');
    const long: Recipe = {
      ...recipe,
      title_de: `${'Sehr langer Rezepttitel mit vielen Wörtern '.repeat(3)}`.slice(0, 100),
      steps_de: Array.from({ length: 15 }, (_, i) =>
        `Schritt ${i + 1}: ${'Alles gut verrühren und kurz ruhen lassen, dann weiterarbeiten. '.repeat(5)}`.slice(
          0,
          300,
        ),
      ),
    };
    const ingredients = Array.from({ length: 20 }, (_, i) => ({
      ...(meal.ingredients[i % meal.ingredients.length] as (typeof meal.ingredients)[number]),
      index: i,
    }));
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d, i) => ({
        ...d,
        meals: i === 0 ? [{ ...meal, ingredients }] : [],
        emptySlots: [],
      })),
    };
    const doc = planDoc(
      changed,
      targets,
      {},
      N3_RECIPES.map((r) => (r.id === recipe.id ? long : r)),
    );
    const steps = doc.sections.filter((b) => b.type === 'steps');
    expect(steps.length).toBeGreaterThan(1);
    expect(steps.flatMap((s) => (s.type === 'steps' ? s.items : []))).toHaveLength(15);
    const starts = steps.map((s) => (s.type === 'steps' ? s.start : 0));
    expect(starts[0]).toBe(1);
    expect(starts[1]).toBeGreaterThan(1);
    expect(codes(doc)).toContain('recipe.continued');
    expect(pages(doc)).toBeGreaterThanOrEqual(4);
  });

  it('Inhalte ohne Steuerzeichen (Titel mit Zeilenumbruch und Steuerzeichen bleibt Text)', () => {
    const { plan, targets } = build(female);
    const meal = plan.days[0]?.meals[0];
    if (!meal) throw new Error('Mahlzeit fehlt');
    const evil = '<script>alert(1)</script>\n"><img src=x onerror=alert(1)>\u0007';
    const recipes = N3_RECIPES.map((r) => (r.id === meal.recipeId ? { ...r, title_de: evil } : r));
    const changed: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        meals: d.meals.map((m) => (m.recipeId === meal.recipeId ? { ...m, titleDe: evil } : m)),
      })),
    };
    const doc = planDoc(changed, targets, {}, recipes);
    const data = texts(doc)
      .filter((v) => v.kind === 'data')
      .map((v) => (v as { value: string }).value);
    expect(data).toContain('<script>alert(1)</script> "><img src=x onerror=alert(1)>');
    expect(data.every((v) => !/[\p{Cc}]/u.test(v))).toBe(true);
  });

  it('Wächter N6 S1: Beschreibungs-Sätze mit kcal- oder Makro-Mengen fallen immer weg (auch bei „Zahlen an“)', () => {
    // Echte Formulierungen aus alpha5-rezepte.json (die Datei selbst prüft packages/content).
    expect(
      withoutNutrientAmounts(
        'Selbst gekochter Schokopudding mit Whey – cremig, süß und mit fast 30 g Eiweiß.',
      ),
    ).toBeNull();
    expect(
      withoutNutrientAmounts(
        'Eine große Portion helle Pasta mit schlichter Tomatensauce bringt über 100 g Kohlenhydrate bei wenig Fett und ist für die meisten Sportler gut verträglich.',
      ),
    ).toBeNull();
    expect(
      withoutNutrientAmounts(
        'Cremiges Vanille-Quarkeis mit feinen Zartbitter-Raspeln – über 30 g Eiweiß bei wenig Kalorien.',
      ),
    ).toBeNull();
    // Ohne Menge: keine Zahl, bleibt (Health-Claims-Prüfung R10 ist eine andere Regel).
    const noAmount =
      'Herzhafter Salat aus Dosen-Thunfisch, gekochtem Ei und Gurke mit Senf-Quark-Dressing, der viel Eiweiß bei wenig Kalorien liefert.';
    expect(withoutNutrientAmounts(noAmount)).toBe(noAmount);
    // Nur der Satz mit der Menge fällt weg; Gramm ohne Makro-Wort bleibt.
    expect(
      withoutNutrientAmounts('Schnell gemacht. Liefert rund 25 g Eiweiß! Mit 200 g Beeren.'),
    ).toBe('Schnell gemacht. Mit 200 g Beeren.');
    expect(withoutNutrientAmounts('Nur 350 kcal pro Portion.')).toBeNull();

    const { plan, targets } = build(female);
    const meal = plan.days[0]?.meals[0];
    if (!meal) throw new Error('Mahlzeit fehlt');
    const recipes = N3_RECIPES.map((r) =>
      r.id === meal.recipeId
        ? { ...r, description_de: 'Cremig und schnell. Mit fast 30 g Eiweiß und 450 kcal.' }
        : r,
    );
    for (const showEnergyNumbers of [true, false]) {
      const json = JSON.stringify(planDoc(plan, targets, { showEnergyNumbers }, recipes));
      expect(json).toContain('Cremig und schnell.');
      expect(json).not.toContain('30 g Eiweiß');
      expect(json).not.toContain('450 kcal');
    }
    const onlyAmounts = N3_RECIPES.map((r) =>
      r.id === meal.recipeId ? { ...r, description_de: 'Liefert über 100 g Kohlenhydrate.' } : r,
    );
    expect(JSON.stringify(planDoc(plan, targets, {}, onlyAmounts))).not.toContain('Kohlenhydrate.');
  });

  it('Fehler: Plan ohne Mahlzeit → no_meals; Rezept fehlt oder andere Version → recipe_missing', () => {
    const { plan, targets } = build(female);
    const empty: MealPlanWeek = { ...plan, days: plan.days.map((d) => ({ ...d, meals: [] })) };
    const run = (p: MealPlanWeek, recipes: readonly Recipe[]) =>
      buildNutritionPlanDocument({ plan: p, targets, recipes, foods: N3_FOODS }, OPTIONS);
    expect(run(empty, N3_RECIPES)).toEqual({ ok: false, error: 'no_meals' });
    const id = plan.days[0]?.meals[0]?.recipeId;
    expect(
      run(
        plan,
        N3_RECIPES.filter((r) => r.id !== id),
      ),
    ).toEqual({
      ok: false,
      error: 'recipe_missing',
    });
    expect(
      run(
        plan,
        N3_RECIPES.map((r) => (r.id === id ? { ...r, version: r.version + 1 } : r)),
      ),
    ).toEqual({ ok: false, error: 'recipe_missing' });
  });

  it('Entwürfe: Allergen-Warnung auf dem Deckblatt und bei jedem Rezept (16 B (i))', () => {
    const { plan, doc } = build(female);
    const recipes = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
    const drafts = N3_RECIPES.filter((r) => recipes.has(r.id) && r.status === 'draft').length;
    expect(drafts).toBeGreaterThan(0);
    expect(withCode(doc, 'nutrition.notice.draftAllergens')).toHaveLength(drafts + 1);
  });

  it('Kennzeichen wie in der App: freigegebene Rezepte ohne Kennzeichen (Gründer-Entscheidung 27.10.2026)', () => {
    const variant = (meta: Partial<Recipe['meta']>, status: Recipe['status']): Recipe[] =>
      N3_RECIPES.map((r) => ({
        ...r,
        status,
        meta: { ...r.meta, reviewed_by: 'KT', reviewed_at: '2026-10-15', ...meta },
      }));
    const marks = (recipes: readonly Recipe[]) => {
      const input = planInput(female, omni, recipes);
      const plan = buildMealPlanWeek(input);
      const doc = planDoc(plan, input.targets, {}, recipes);
      const count = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId))).size;
      return {
        count,
        draftAllergens: withCode(doc, 'nutrition.notice.draftAllergens').length,
      };
    };
    // Freigegeben – mit und ohne Fachprüfung, von Hand (alpha5) und KI: kein Kennzeichen, keine Allergen-Zeile.
    for (const origin of ['manual', 'claude_session'] as const) {
      for (const expert of [false, true]) {
        const m = marks(variant({ origin, expert_reviewed: expert }, 'published'));
        expect(m.count, origin).toBeGreaterThan(0);
        expect(m, origin).toMatchObject({ draftAllergens: 0 });
      }
    }
    // Entwürfe (KI oder von Hand) → kein Kennzeichen mehr (27.10.2026); nur die neutrale Allergen-Zeile.
    const ai = marks(variant({ origin: 'claude_session', expert_reviewed: false }, 'draft'));
    expect(ai).toMatchObject({ draftAllergens: ai.count + 1 });
    const manual = marks(variant({ origin: 'manual', expert_reviewed: false }, 'draft'));
    expect(manual).toMatchObject({ draftAllergens: manual.count + 1 });
  });
});

// ---------------------------------------------------------------------------------------------------------
// Einkaufsliste
// ---------------------------------------------------------------------------------------------------------

function listDoc(list: Parameters<typeof buildShoppingListDocument>[0]['list']) {
  const result = buildShoppingListDocument(
    { list, recipes: N3_RECIPES },
    { onDate: SUNDAY_BEFORE },
  );
  if (!result.ok) throw new Error(result.error);
  expect(printDocumentSchema.safeParse(result.document).success).toBe(true);
  return result.document;
}

function item(overrides: Partial<ShoppingListItem>): ShoppingListItem {
  return {
    itemKey: 'manual|x',
    foodId: null,
    labelDe: 'Eintrag',
    amount: null,
    unit: null,
    category: 'other',
    isPantry: false,
    isManual: true,
    checked: false,
    substituteFor: [],
    amountChanged: false,
    notInPlan: false,
    ...overrides,
  };
}

describe('Einkaufsliste als PDF (Dokumentmodell)', () => {
  const plan = buildMealPlanWeek(planInput(female));
  const list = buildShoppingList(plan, N3_FOODS, { from: MONDAY, to: '2026-10-18' });

  it('nach Abteilungen, zwei Spalten, Kästchen, Vorrat am Ende, keine kcal', () => {
    expect(list.items.some((i) => i.isPantry)).toBe(true);
    const doc = listDoc(list);
    expect(doc.meta.kind).toBe('shopping_list');
    const lists = doc.sections.filter((b) => b.type === 'checklist');
    expect(lists.length).toBeGreaterThan(1);
    expect(lists.every((b) => b.type === 'checklist' && b.columns === 2)).toBe(true);
    const last = lists.at(-1);
    expect(last?.type === 'checklist' && last.caption).toMatchObject({ code: 'shopping.pantry' });
    const order = lists
      .slice(0, -1)
      .map((b) =>
        b.type === 'checklist'
          ? (b.caption as { params: { category: string } }).params.category
          : '',
      );
    expect(order).toEqual([...new Set(order)]);
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/kcal|nutrients|protein/);
    expect(codes(doc)).toContain('nutrition.notice.medical');
    expect(codes(doc)).toContain('nutrition.notice.products');
    // Alle Einträge stehen drin.
    expect(lists.reduce((n, b) => n + (b.type === 'checklist' ? b.items.length : 0), 0)).toBe(
      list.items.length,
    );
  });

  it('abgehakt = Kästchen mit Haken; „nicht mehr im Plan“ entfällt; eigene Einträge und Rezepte bleiben', () => {
    const recipe = N3_RECIPES[0] as Recipe;
    const doc = listDoc({
      ...list,
      items: [
        ...list.items.map((i, n) => (n === 0 ? { ...i, checked: true } : i)),
        item({ itemKey: 'manual|kaffee', labelDe: 'Kaffee', checked: false }),
        item({ itemKey: 'manual|alt', labelDe: 'Altes Zeug', checked: true, notInPlan: true }),
      ],
      recipes: [{ recipeId: recipe.id, servings: 2 }],
    });
    const entries = doc.sections.flatMap((b) => (b.type === 'checklist' ? b.items : []));
    expect(entries.filter((e) => e.checked)).toHaveLength(1);
    const labels = entries.map((e) => (e.text[0] as { params: { label: string } }).params.label);
    expect(labels).toContain('Kaffee');
    expect(labels).not.toContain('Altes Zeug');
    expect(withCode(doc, 'shopping.recipes')[0]).toMatchObject({
      params: { recipes: [{ title: recipe.title_de, servings: 2 }] },
    });
  });

  it('leere Liste → Hinweis „nichts einzukaufen“; ungültiges Datum → invalid_options', () => {
    const doc = listDoc({ ...list, items: [] });
    expect(codes(doc)).toContain('shopping.empty');
    expect(doc.sections.some((b) => b.type === 'checklist')).toBe(false);
    expect(buildShoppingListDocument({ list, recipes: N3_RECIPES }, { onDate: 'gestern' })).toEqual(
      { ok: false, error: 'invalid_options' },
    );
  });

  it('sehr lange Liste (200 Einträge mit langen Namen): mehrere Seiten, nichts geht verloren', () => {
    const items = Array.from({ length: 200 }, (_, n) =>
      item({
        itemKey: `manual|${n}`,
        labelDe: `${n} ${'Sehr langer Eintrag '.repeat(n % 4 === 0 ? 4 : 1)}`.trim(),
        category: n % 2 === 0 ? 'other' : 'fruit_vegetables',
        isPantry: n % 10 === 0,
      }),
    );
    const doc = listDoc({ ...list, items });
    expect(pages(doc)).toBeGreaterThanOrEqual(3);
    const entries = doc.sections.flatMap((b) => (b.type === 'checklist' ? b.items : []));
    expect(entries).toHaveLength(200);
  });

  it('Gesundheitsbezug der Liste (`usesHealthData`) ändert das Dokument nicht', () => {
    expect(listDoc({ ...list, usesHealthData: true })).toEqual(
      listDoc({ ...list, usesHealthData: false }),
    );
  });
});
