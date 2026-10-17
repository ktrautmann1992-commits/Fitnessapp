// @vitest-environment happy-dom
/**
 * Etappe N6 – PDF P5 (docs/PLAN-PHASE-5.md 11, 12.1 „PDF (K4)“): Zusammenstecken in der App – Woche aus
 * `computeNutritionWeek` → Dokument (Core) → Übersetzung → HTML. Texte auf Deutsch, „Zahlen aus“ auch im PDF,
 * Schwangerschaft ohne Zahlen, Hinweis-Dialog bei Gesundheitsbezug, Name nur auf Wunsch, alle Beispiele der CI
 * gültig und nach der Bereinigung der Druckansicht unverändert (Kästchen, Schritte).
 */
import { renderPrintHtml } from '@fitnessapp/ui/print';
import { describe, expect, it } from 'vitest';

import { computeNutritionWeek, type NutritionWeekResult } from '@/data/nutrition-plan';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { DEMO_LIBRARY, NUTRITION_PRINT_EXAMPLES } from '../test/nutrition-print-examples';
import { translatePrintDocument, translatePrintText } from './print-document';
import {
  buildNutritionPrint,
  DEFAULT_NUTRITION_PRINT_FORM,
  type NutritionPrintInput,
  nutritionPrintErrorText,
  nutritionPrintUsesHealthData,
} from './print-nutrition';
import { sanitizePrintTree } from './print-sanitize';

function rows(
  options: { intolerances?: string[]; flags?: string[]; showNumbers?: boolean } = {},
): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss', flags: options.flags ?? [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'vegetarian',
      eats_pork: null,
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: options.showNumbers ?? true,
    },
    foodPreferences: (options.intolerances ?? []).map((group, i) => ({
      id: `fp-${i}`,
      user_id: USER_ID,
      food_group: group,
      kind: 'intolerance',
    })) as UserRows['foodPreferences'],
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-09-20',
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }>;

function week(data: UserRows): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart: '2026-09-28',
    library: DEMO_LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
  return result;
}

function input(data: Ready, patch: Partial<NutritionPrintInput> = {}): NutritionPrintInput {
  return {
    kind: 'nutrition_plan',
    week: data,
    library: DEMO_LIBRARY,
    showNumbers: true,
    demo: true,
    today: TODAY,
    form: DEFAULT_NUTRITION_PRINT_FORM,
    ...patch,
  };
}

/** Sichtbarer Text des Druck-HTML (ohne Stil-Block). */
function visible(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector('main')?.textContent ?? '';
}

describe('Essensplan und Einkaufsliste als PDF – Zusammenstecken (N6)', () => {
  it('Essensplan → Druck-HTML auf Deutsch, Titel ohne Namen; Tagessummen nur mit „Zahlen an“', () => {
    const data = week(rows());
    const on = buildNutritionPrint(input(data));
    if (!on.ok) throw new Error(on.error);
    expect(on.title).toBe('Essensplan');
    const text = visible(on.html);
    expect(text).toContain('Dein Essensplan');
    expect(text).toContain('Wochenübersicht');
    expect(text).toContain('Zubereitung');
    expect(text).toContain(t.nutrition.disclaimer);
    expect(text).toContain(t.nutrition.hfiCoeliac);
    expect(text).toContain('Nährwerte: Testwerte (keine Quelldaten).');
    expect(text).toMatch(/\d\.\d{3} kcal/);
    expect(text).not.toMatch(/undefined|\[object|NaN/);

    const off = buildNutritionPrint(input(data, { showNumbers: false }));
    if (!off.ok) throw new Error(off.error);
    expect(visible(off.html)).not.toMatch(/kcal|Tagessumme/);
  });

  it('Mit Wunschgewicht und zwei Zielen: kein Zielgewicht, kein Zeitraum, kein Tempo, kein Ziel „wegen …“ (Etappe Z5, N6)', () => {
    const base = rows();
    const data = week({
      ...base,
      goals: base.goals ? { ...base.goals, secondary_goal_type: 'muscle_gain' } : null,
      weightGoal: {
        user_id: USER_ID,
        target_weight_kg: 66.5,
        start_date: '2026-10-01',
        target_date: '2027-02-18',
        amount_mode: 'target_weight',
        time_mode: 'date',
      },
    });
    // Das Ziel wirkt (Ernährung rechnet damit) …
    expect(data.targets.days.some((d) => d.weightGoalStatus === 'active')).toBe(true);
    for (const kind of ['nutrition_plan', 'shopping_list'] as const) {
      const result = buildNutritionPrint(input(data, { kind }));
      if (!result.ok) throw new Error(result.error);
      // … steht aber nie im PDF.
      expect(visible(result.html)).not.toMatch(
        /66[,.]5|18\.02\.2027|Wunschgewicht|Zielgewicht|Abnehm|Tempo|planbar|langsamer|\d+ Wochen/i,
      );
    }
  });

  it('Schwangerschaft: auch bei „Zahlen an“ keine kcal (B5)', () => {
    const data = week(rows({ flags: ['pregnancy', 'conservative_plan'] }));
    const result = buildNutritionPrint(input(data, { showNumbers: true }));
    if (!result.ok) throw new Error(result.error);
    expect(visible(result.html)).not.toMatch(/kcal/);
  });

  it('Unverträglichkeit: Hinweis-Dialog nötig; PDF nennt Ersatzprodukte, aber keine Gründe (K4)', () => {
    const data = week(rows({ intolerances: ['lactose'] }));
    expect(nutritionPrintUsesHealthData('nutrition_plan', data)).toBe(true);
    expect(nutritionPrintUsesHealthData('shopping_list', data)).toBe(true);
    const plain = week(rows());
    const withoutHealth: Ready = {
      ...plain,
      plan: plain.plan ? { ...plain.plan, usesHealthData: false } : null,
      shopping: plain.shopping
        ? { ...plain.shopping, list: { ...plain.shopping.list, usesHealthData: false } }
        : null,
    };
    expect(nutritionPrintUsesHealthData('nutrition_plan', withoutHealth)).toBe(false);
    expect(nutritionPrintUsesHealthData('shopping_list', withoutHealth)).toBe(false);
    expect(t.nutrition.printView.healthText).toContain('statt');
    const result = buildNutritionPrint(input(data));
    if (!result.ok) throw new Error(result.error);
    const text = visible(result.html);
    expect(text).not.toMatch(/Unverträglichkeit|Laktoseintoleranz|Gewicht|70 kg|schwanger/i);
  });

  it('Name nur auf Wunsch; Fehlermeldungen auf Deutsch', () => {
    const data = week(rows());
    const named = buildNutritionPrint(
      input(data, { form: { includeName: true, name: 'Kim <b>' } }),
    );
    if (!named.ok) throw new Error(named.error);
    expect(named.title).toBe('Essensplan');
    expect(visible(named.html)).toContain('Kim <b>');
    expect(named.html).toContain('Kim &lt;b&gt;');
    const missing = buildNutritionPrint(input(data, { form: { includeName: true, name: ' ' } }));
    expect(missing).toEqual({
      ok: false,
      error: 'invalid_options',
      nameError: t.printView.nameMissing,
    });
    const tooLong = buildNutritionPrint(
      input(data, { form: { includeName: true, name: 'x'.repeat(61) } }),
    );
    expect(!tooLong.ok && tooLong.error === 'invalid_options' && tooLong.nameError).toBe(
      t.printView.nameTooLong(60),
    );
    // Einkaufsliste: kein Name (Feld wird ignoriert).
    const list = buildNutritionPrint(
      input(data, { kind: 'shopping_list', form: { includeName: true, name: ' ' } }),
    );
    expect(list.ok).toBe(true);
  });

  it('Einkaufsliste → Kästchen nach Abteilungen, Vorrat am Ende, keine kcal', () => {
    const data = week(rows());
    const result = buildNutritionPrint(input(data, { kind: 'shopping_list' }));
    if (!result.ok) throw new Error(result.error);
    expect(result.title).toBe('Einkaufsliste');
    const text = visible(result.html);
    expect(text).toContain('Deine Einkaufsliste');
    expect(text).toContain(t.nutrition.shopping.pantry);
    expect(text).not.toMatch(/kcal/);
    expect(result.html).toContain('class="box"');
    expect(text.lastIndexOf(t.nutrition.shopping.pantry)).toBeGreaterThan(text.indexOf('Obst'));
  });

  it('Fehler: kein Plan bzw. Rezepte fehlen → verständliche Meldung', () => {
    const data = week(rows());
    expect(buildNutritionPrint(input({ ...data, plan: null }))).toEqual({
      ok: false,
      error: 'no_plan',
    });
    const missing = buildNutritionPrint(input(data, { library: { ...DEMO_LIBRARY, recipes: [] } }));
    expect(missing).toEqual({ ok: false, error: 'recipe_missing' });
    expect(nutritionPrintErrorText({ ok: false, error: 'recipe_missing' })).toBe(
      t.nutrition.printView.recipeMissing,
    );
    expect(nutritionPrintErrorText({ ok: false, error: 'failed' })).toBe(t.printView.failed);
    expect(nutritionPrintErrorText({ ok: false, error: 'no_plan' })).toBe(
      t.nutrition.printView.noPlan,
    );
  });
});

describe('Übersetzung der Ernährungs-Codes', () => {
  it('Zutat mit Ersatz, optional und Notiz; Mengen und Fuß mit Quellen', () => {
    expect(
      translatePrintText({
        kind: 'text',
        code: 'recipe.ingredient',
        params: {
          food: 'Laktosefreie Milch 1,5 %',
          original: 'Vollmilch 3,5 %',
          optional: true,
          note: 'kalt',
        },
      }),
    ).toBe('Laktosefreie Milch 1,5 % statt Vollmilch 3,5 % (optional) – kalt');
    expect(
      translatePrintText({
        kind: 'text',
        code: 'value.amount',
        params: { amount: 1.5, unit: 'tbsp' },
      }),
    ).toBe('1,5 EL');
    expect(
      translatePrintText({
        kind: 'text',
        code: 'nutrition.doc.footer',
        params: {
          document: 'nutrition_plan',
          sources: [{ db: 'bls', version: '4.0', license: 'CC BY 4.0' }],
          testValues: false,
        },
      }),
    ).toBe(
      'Alpha5 ersetzt keine ärztliche oder ernährungsfachliche Beratung. Nährwerte: Bundeslebensmittelschlüssel (BLS) 4.0, Max Rubner-Institut (CC BY 4.0, creativecommons.org/licenses/by/4.0); umgerechnet und gerundet.',
    );
    expect(
      translatePrintText({
        kind: 'text',
        code: 'mealplan.col.day',
        params: { date: '2026-10-12' },
      }),
    ).toBe('Mo 12.10.');
    expect(
      translatePrintText({
        kind: 'text',
        code: 'recipe.col.portion',
        params: { factor: 1.25, weekdays: [1, 3] },
      }),
    ).toBe('× 1,25 (Mo, Mi)');
    expect(translatePrintText({ kind: 'text', code: 'value.kcal', params: { kcal: 2150 } })).toBe(
      '2.150 kcal',
    );
  });

  it.each(NUTRITION_PRINT_EXAMPLES.map((e) => [e.slug, e] as const))(
    'CI-Beispiel %s: gültig, deutsch, nach der Bereinigung unverändert',
    (_, example) => {
      const html = renderPrintHtml(translatePrintDocument(example.document()));
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const main = parsed.querySelector('main');
      if (!main) throw new Error('kein main');
      const before = main.outerHTML;
      sanitizePrintTree(main);
      expect(main.outerHTML).toBe(before);
      expect(main.textContent).not.toMatch(/undefined|\[object|NaN/);
      if (example.slug === 'schwangerschaft') expect(main.textContent).not.toMatch(/kcal/);
      if (example.slug === 'zahlen-aus-name') expect(main.textContent).not.toMatch(/kcal/);
    },
    // Je Beispiel ~150–190 KB HTML mit Schrift – auf CI-Runnern langsamer.
    30_000,
  );
});
