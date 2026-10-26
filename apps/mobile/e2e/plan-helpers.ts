import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  /** Wettkampf-Datum im Schritt „Ziel“ (TT, MM, JJJJ) – optional (Phase 10 WP4). */
  targetDate?: [string, string, string];
  /** Feste Tage: [Wochentag, Art, Minuten]; leer = Vorschlag (Ziel Ausdauer) übernehmen. */
  days: [string, string, number][];
  /** Equipment zu Hause (genaue Namen der Kästchen); leer/fehlend = nur Körpergewicht. */
  homeEquipment?: string[];
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
  await page.getByRole('radio', { name: person.goal, exact: true }).click();
  if (person.discipline) {
    await page.getByRole('radio', { name: person.discipline, exact: true }).click();
  }
  if (person.targetDate) {
    const [day, month, year] = person.targetDate;
    await page.getByLabel('Wettkampf-Datum (optional): Tag').fill(day);
    await page.getByLabel('Wettkampf-Datum (optional): Monat').fill(month);
    await page.getByLabel('Wettkampf-Datum (optional): Jahr').fill(year);
  }
  await next(page);
  if (person.goal === 'Abnehmen' && person.consent) {
    // Schritt „Wunschgewicht“ (Etappe Z4): Standard „ohne festes Ziel“.
    await heading(page, 'Wie möchtest du abnehmen?');
    await next(page);
  }
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
    for (const name of person.homeEquipment ?? []) {
      await page.getByRole('checkbox', { name, exact: true }).click();
    }
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
  await completeNutritionSetup(page);
  await heading(page, 'Geschafft!');
}

/**
 * Schritt „Alltag und Training“ (nutrition_setup, docs/PLAN-PHASE-5.md 8.1, Etappe N4 – nur im Testmodus): Alltag und
 * Trainingszeit sind Pflicht (K7), „Kalorienzahlen anzeigen“ bleibt an.
 */
export async function completeNutritionSetup(
  page: Page,
  options: { activity?: RegExp; time?: string } = {},
) {
  await heading(page, 'Alltag und Training');
  await page.getByRole('radio', { name: options.activity ?? /^Sitzend mit Bewegung/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Wann trainierst du meistens?' })
    .getByRole('radio', { name: options.time ?? 'Abends' })
    .click();
  await next(page);
}

export async function planDays(page: Page, days: [string, string, number][]) {
  for (const [day, kind, minutes] of days) {
    await page.getByRole('checkbox', { name: day }).click();
    await page.getByRole('radio', { name: new RegExp(`^${day}: ${kind}`) }).click();
    await page.getByRole('radio', { name: `${day}: ${minutes} Minuten` }).click();
  }
}

/**
 * Freigabe-Status des Inhaltsstands (content/exercises bzw. content/plan-templates), den der Web-Export im Testmodus
 * bündelt: id → Status. So prüfen die Tests die Kennzeichnung „Testinhalt“ passend zum Stand – Entwürfe
 * gekennzeichnet, freigegebene Inhalte nicht –, egal ob der Bestand schon freigegeben ist.
 */
export function repoContentStatus(folder: 'exercises' | 'plan-templates'): Map<string, string> {
  const dir = join(__dirname, '../../../content', folder);
  const status = new Map<string, string>();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(join(dir, name), 'utf8')) as {
      id: string;
      status: string;
    };
    status.set(data.id, data.status);
  }
  return status;
}

/** Training: Zeile „Dein Plan: …“ aufklappen (Vorlage, Hinweise – seit „App verschlanken“ 26.10.2026 zugeklappt). */
export async function openPlanInfo(page: Page) {
  const toggle = page.getByTestId('plan-info-toggle');
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

/**
 * Hinweis-Zeile („App verschlanken“, 26.10.2026): weitere Hinweise hinter „+N weitere Hinweise“ aufklappen
 * (`today-notices`, `nutrition-notice-line`, `overview-notices`). Ohne Zähler passiert nichts.
 */
export async function expandNotices(page: Page, id: string) {
  const more = page.getByTestId(`${id}-more`);
  // Seite noch im Aufbau? Kurz auf die Hinweis-Zeile warten (gibt es keine Hinweise, fehlt sie ganz).
  await page
    .getByTestId(id)
    .and(page.locator(':visible'))
    .waitFor({ timeout: 5000 })
    .catch(() => undefined);
  if (!(await more.isVisible())) return;
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
}
