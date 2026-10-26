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
  await page.goto('/today');
}

export interface NutritionPerson {
  /**
   * Beispiel-Rezepte erzwingen (Wächter N4 K7) – damit die Tests auch funktionieren, sobald das Bündel echte Rezepte
   * hat. Standard: an. Nur der Test „Zustände“ prüft das leere Bündel (falls es noch leer ist).
   */
  forceDemo?: boolean;
  /**
   * Testphase (Gründer-Entscheidung 19.10.2026): Beispiel-Inhalte als „freigegeben, nicht fachlich geprüft“ – so, wie
   * sie in der Testphase aus der Datenbank kommen. Nur zusammen mit forceDemo (Standard an).
   */
  testphase?: boolean;
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
    ([key, force, testphase]) => {
      window.localStorage.clear();
      if (force) {
        window.localStorage.setItem(key, JSON.stringify(testphase ? 'force-testphase' : 'force'));
      }
    },
    [DEMO_KEY, person.forceDemo !== false, person.testphase === true] as const,
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

/**
 * Einkaufsliste: abgehakte Einträge sichtbar lassen. Seit 23.10.2026 (docs/PLAN-EINKAUFEN-AUSDAUER.md 3) ist
 * „Erledigte ausblenden“ standardmäßig an – Tests, die abgehakte Einträge weiter ansehen, schalten es hier aus (die
 * Wahl bleibt auf dem Gerät gespeichert).
 */
export async function showCheckedShoppingItems(page: Page) {
  // Seit 26.10.2026 im ⋯-Menü oben rechts (Blatt schließt nach dem Tippen).
  await page.getByTestId('shopping-menu').click();
  const box = page.getByTestId('shopping-hide-checked');
  await expect(box).toBeVisible();
  if ((await box.getAttribute('aria-checked')) === 'true') {
    await box.click();
    await page.getByTestId('shopping-menu').click();
  }
  await expect(box).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('shopping-menu-close').click();
}

export async function openNutrition(page: Page) {
  // Seit „App verschlanken“ (26.10.2026) steht „Essen heute“ nicht mehr im Training – Reiter „Ernährung“.
  await page
    .getByRole('tablist', { name: 'Hauptmenü' })
    .getByRole('tab', { name: 'Ernährung', exact: true })
    .click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
  await expect(page.getByTestId('nutrition-demo-banner')).toBeVisible();
  await expect(page.getByTestId('nutrition-meals')).toBeVisible();
}

/** Einkaufen: ⋯-Menü oben rechts öffnen (Weitergeben, PDF, Zeitraum, Erledigte, Häkchen – seit 26.10.2026). */
export async function openShoppingMenu(page: Page) {
  if ((await page.getByTestId('shopping-menu-sheet').count()) === 0) {
    await page.getByTestId('shopping-menu').click();
  }
  await expect(page.getByTestId('shopping-menu-sheet')).toBeVisible();
}

/** Einkaufen: Zeitraum-Wahl (3 Tage | Ganze Woche, eigener Zeitraum) über ⋯ → „Zeitraum wählen“ einblenden. */
export async function openShoppingRange(page: Page) {
  if (await page.getByTestId('shopping-range-controls').isVisible()) return;
  await openShoppingMenu(page);
  await page.getByTestId('shopping-menu-range').click();
  await expect(page.getByTestId('shopping-range-controls')).toBeVisible();
}

/** Einkaufen: Schnell-Zeile „Etwas hinzufügen“ aufklappen (Name, Menge, Abteilung). */
export async function openShoppingAdd(page: Page) {
  if (await page.getByTestId('shopping-add-label').isVisible()) return;
  await page.getByTestId('shopping-add-open').click();
  await expect(page.getByTestId('shopping-add-label')).toBeVisible();
}

/** Einkaufen: Knopf „Scannen“ – Scanner-Bereich einblenden. */
export async function openShoppingScan(page: Page) {
  const open = page.getByTestId('shopping-scan-open');
  if ((await open.getAttribute('aria-expanded')) !== 'true') await open.click();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
}

/** Einkaufen: „Erledigte ausblenden“ im ⋯-Menü umschalten (Blatt schließt danach). */
export async function toggleHideChecked(page: Page) {
  await openShoppingMenu(page);
  await page.getByTestId('shopping-hide-checked').click();
}

/** Einkaufen: Stand von „Erledigte ausblenden“ prüfen (öffnet und schließt das ⋯-Menü). */
export async function expectHideChecked(page: Page, on: boolean) {
  await openShoppingMenu(page);
  await expect(page.getByTestId('shopping-hide-checked')).toHaveAttribute(
    'aria-checked',
    String(on),
  );
  await page.getByTestId('shopping-menu-close').click();
}
