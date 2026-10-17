import { expect, type Page } from '@playwright/test';

import { completeNutritionSetup, heading, next, planDays } from './plan-helpers';

/**
 * Gemeinsame Schritte der Ernährungs-Tests (Etappen N4/N5, Testmodus): Gerätespeicher lesen/ändern, Onboarding mit
 * Ernährung, Ernährung öffnen. Fester Tag: Montag, 12.10.2026, 9 Uhr.
 */

export const LOCAL_DB = 'fitnessapp.local.v1';
export const DEMO_KEY = 'fitnessapp.nutrition-demo.v1';

export interface StoredDb {
  session: unknown;
  rows: {
    foodPreferences: { food_group: string; kind: string }[];
    healthScreenings: { flags: string[] }[];
    nutritionSetup: unknown;
  } & Record<string, unknown>;
}

export async function db(page: Page): Promise<StoredDb> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return JSON.parse(raw ?? '{}') as StoredDb;
}

export async function patchDb(page: Page, patch: (value: StoredDb) => StoredDb) {
  const value = patch(await db(page));
  await page.evaluate(([key, json]) => window.localStorage.setItem(key, json), [
    LOCAL_DB,
    JSON.stringify(value),
  ] as const);
  await page.goto('/');
}

export interface NutritionPerson {
  /**
   * Beispiel-Rezepte erzwingen (Wächter N4 K7) – damit die Tests auch funktionieren, sobald das Bündel echte Rezepte
   * hat. Standard: an. Nur der Test „Zustände“ prüft das leere Bündel (falls es noch leer ist).
   */
  forceDemo?: boolean;
  /** Unverträglichkeit Erdnüsse (Gesundheitsdatum) und zusätzlich „mag ich“ Erdnüsse (W12). */
  peanutIntolerance?: boolean;
  pregnancy?: boolean;
  /** Ernährungsform (Standard: vegetarisch). */
  diet?: 'Vegetarisch' | 'Vegan';
}

/** Onboarding wie „So testest du es am Handy“ (15): weiblich, vegetarisch, Pilze „mag ich nicht“, 4 Mahlzeiten, Meal-Prep 2×. */
export async function onboardNutrition(page: Page, person: NutritionPerson = {}) {
  await page.clock.setFixedTime(new Date('2026-10-12T09:00:00+02:00'));
  await page.goto('/');
  await page.evaluate(
    ([key, force]) => {
      window.localStorage.clear();
      if (force) window.localStorage.setItem(key, JSON.stringify('force'));
    },
    [DEMO_KEY, person.forceDemo !== false] as const,
  );
  await page.goto('/');
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByLabel('Geburtsdatum: Tag').fill('15');
  await page.getByLabel('Geburtsdatum: Monat').fill('05');
  await page.getByLabel('Geburtsdatum: Jahr').fill('1990');
  await next(page);
  await page.getByRole('button', { name: 'Testmodus starten' }).click();
  await page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' }).click();
  await page.getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' }).click();
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await heading(page, 'Dein Geschlecht');
  await page.getByRole('radio', { name: 'weiblich' }).click();
  await next(page);
  await page.getByRole('checkbox', { name: /Ich willige/ }).click();
  await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
  await heading(page, 'Körperdaten');
  await page.getByLabel('Größe in cm').fill('170');
  await page.getByLabel('Gewicht in kg').fill('70');
  await next(page);
  await page.getByRole('button', { name: 'Überspringen' }).click();
  await heading(page, 'Gesundheits-Check');
  const groups = page.getByRole('radiogroup');
  const count = await groups.count();
  for (let i = 0; i < count; i += 1) {
    const group = groups.nth(i);
    const pregnancyQuestion = ((await group.getAttribute('aria-label')) ?? '').includes(
      'schwanger',
    );
    await group
      .getByRole('radio', { name: person.pregnancy && pregnancyQuestion ? 'Ja' : 'Nein' })
      .click();
  }
  await next(page);
  if (person.pregnancy) {
    await page.getByRole('checkbox', { name: /Ich habe den Hinweis gelesen/ }).click();
    await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
  }
  await heading(page, 'Deine Trainingserfahrung');
  await page.getByRole('radio', { name: /^Einsteiger/ }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await page.getByRole('radio', { name: 'Abnehmen', exact: true }).click();
  await next(page);
  // Abnehmen mit Einwilligung → Schritt „Wunschgewicht“ (Etappe Z4); Standard „ohne festes Ziel“.
  await heading(page, 'Wie möchtest du abnehmen?');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await planDays(page, [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ]);
  await next(page);
  await heading(page, 'Deine Ernährung');
  await page.getByRole('radio', { name: person.diet ?? 'Vegetarisch' }).click();
  await page
    .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
    .getByRole('radio', { name: '4' })
    .click();
  await page.getByRole('checkbox', { name: 'Pilze: Mag ich nicht' }).click();
  if (person.peanutIntolerance) {
    await page.getByRole('checkbox', { name: 'Erdnüsse: Mag ich', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Erdnüsse: Unverträglich' }).click();
  }
  await next(page);
  await page.getByRole('radio', { name: /^Meal-Prep/ }).click();
  await page
    .getByRole('radiogroup', { name: 'An wie vielen Tagen pro Woche kochst du vor?' })
    .getByRole('radio', { name: '2' })
    .click();
  await next(page);
  await completeNutritionSetup(page, { activity: /^Sitzend mit Bewegung/, time: 'Abends' });
  await heading(page, 'Geschafft!');
}

export async function openNutrition(page: Page) {
  await page.getByTestId('today-nutrition').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('nutrition-demo-banner')).toBeVisible();
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
}
