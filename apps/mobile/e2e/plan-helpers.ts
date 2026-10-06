import { expect, type Page } from '@playwright/test';

/**
 * Gemeinsame Schritte der E2E-Tests im Testmodus: Onboarding bis „Geschafft!“ (Plan wird dort erzeugt).
 */

export const next = (page: Page) =>
  page.getByRole('button', { name: 'Weiter', exact: true }).click();
export const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name, exact: typeof name === 'string' })).toBeVisible();

export interface Person {
  consent: boolean;
  /** Gesundheits-Check: Frage mit „Ja“ (Index), null = alles „Nein“. */
  yesQuestion?: number | null;
  level: RegExp;
  goal: string;
  discipline?: string;
  /** Feste Tage: [Wochentag, Art, Minuten]; leer = Vorschlag (Ziel Ausdauer) übernehmen. */
  days: [string, string, number][];
}

/** Onboarding im Testmodus bis „Geschafft!“ (Plan wird dort erzeugt). */
export async function onboard(page: Page, person: Person) {
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
  await page.getByRole('radio', { name: 'männlich' }).click();
  await next(page);
  if (person.consent) {
    await page.getByRole('checkbox', { name: /Ich willige/ }).click();
    await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
    await heading(page, 'Körperdaten');
    await page.getByLabel('Größe in cm').fill('180');
    await page.getByLabel('Gewicht in kg').fill('80');
    await next(page);
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await heading(page, 'Gesundheits-Check');
    const groups = page.getByRole('radiogroup');
    const count = await groups.count();
    for (let i = 0; i < count; i += 1) {
      await groups
        .nth(i)
        .getByRole('radio', { name: i === person.yesQuestion ? 'Ja' : 'Nein' })
        .click();
    }
    await next(page);
    if (person.yesQuestion !== null && person.yesQuestion !== undefined) {
      await page.getByRole('checkbox', { name: /Ich habe den Hinweis gelesen/ }).click();
      await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
    }
  } else {
    await page.getByRole('button', { name: 'Ohne Einwilligung fortfahren' }).click();
  }
  await heading(page, 'Deine Trainingserfahrung');
  await page.getByRole('radio', { name: person.level }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await page.getByRole('radio', { name: person.goal }).click();
  if (person.discipline) {
    await page.getByRole('radio', { name: person.discipline, exact: true }).click();
  }
  await next(page);
  await heading(page, 'Deine Trainingstage');
  if (person.goal === 'Ausdauer' && person.days.length > 0) {
    // Ziel Ausdauer belegt Tage vor – hier eigene Tage planen.
    await page.getByRole('button', { name: 'Ohne Vorschlag planen' }).click();
  } else if (person.goal === 'Ausdauer') {
    // Vorbelegung (Fortgeschritten): Mo Kraft, Di Ausdauer, Do Kraft, Fr + Sa Ausdauer.
    await expect(page.getByTestId('schedule-suggestion')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Dienstag: Ausdauer/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('schedule-summary')).toContainText(
      '5 Tage: 2× Kraft im Studio, 3× Laufen',
    );
  }
  await planDays(page, person.days);
  await next(page);
  if (person.days.some(([, kind]) => kind === 'Kraft zu Hause')) {
    // Equipment: nichts auswählen = nur Körpergewicht.
    await heading(page, 'Equipment zu Hause');
    await next(page);
  }
  await heading(page, 'Deine Ernährung');
  await page.getByRole('radio', { name: 'Alles (omnivor)' }).click();
  await page
    .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
    .getByRole('radio', { name: '3' })
    .click();
  await next(page);
  await page.getByRole('radio', { name: /^Täglich frisch/ }).click();
  await next(page);
  await heading(page, 'Geschafft!');
}

export async function planDays(page: Page, days: [string, string, number][]) {
  for (const [day, kind, minutes] of days) {
    await page.getByRole('checkbox', { name: day }).click();
    await page.getByRole('radio', { name: new RegExp(`^${day}: ${kind}`) }).click();
    await page.getByRole('radio', { name: `${day}: ${minutes} Minuten` }).click();
  }
}
