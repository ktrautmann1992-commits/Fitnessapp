import { expect, test, type Page } from '@playwright/test';

import { patchDb } from './nutrition-helpers';
import { completeNutritionSetup, heading, next, planDays } from './plan-helpers';

/**
 * Phase 9 · Zyklus-Modul im Testmodus (docs/PLAN-PHASE-9.md 9.3 und 14): Einschalten mit eigener Einwilligung,
 * Tages-Check in 3 Tipps, Angebot „Heute leichter?“, W1 sofort nach „mehr als 3 Monate“, Beispieldaten → Eisen,
 * „Warnungen aus“ → Ratgeber, Status hormonell → W1 weg, Widerruf leert alles, „Heute“ ohne Zyklus-Wörter,
 * „männlich“ ohne Daten sieht nichts, Wechsel auf „männlich“ mit Daten → Verwaltung, Schwangerschaft → Pause.
 * Fester Tag: Montag, 12.10.2026 (Kraft-Einheit heute).
 */
const MONDAY = new Date('2026-10-12T09:00:00+02:00');
const CYCLE_WORDS = /zyklus|periode|blutung|menstru|regel/i;

async function onboard(
  page: Page,
  options: { sex: 'weiblich' | 'männlich' | 'divers'; pregnant?: boolean } = { sex: 'weiblich' },
) {
  await page.clock.setFixedTime(MONDAY);
  await page.goto('/');
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByLabel('Geburtsdatum: Tag').fill('15');
  await page.getByLabel('Geburtsdatum: Monat').fill('05');
  await page.getByLabel('Geburtsdatum: Jahr').fill('1996');
  await next(page);
  await page.getByRole('button', { name: 'Testmodus starten' }).click();
  await page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' }).click();
  await page.getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' }).click();
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await heading(page, 'Dein Geschlecht');
  await page.getByRole('radio', { name: options.sex, exact: true }).click();
  await next(page);
  if (options.pregnant) {
    await page.getByRole('checkbox', { name: /Ich willige/ }).click();
    await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
    await heading(page, 'Körperdaten');
    await page.getByLabel('Größe in cm').fill('168');
    await page.getByLabel('Gewicht in kg').fill('62');
    await next(page);
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await heading(page, 'Gesundheits-Check');
    const groups = page.getByRole('radiogroup');
    const count = await groups.count();
    for (let i = 0; i < count; i += 1) {
      const group = groups.nth(i);
      const pregnancy = /schwanger/i.test((await group.getAttribute('aria-label')) ?? '');
      await group.getByRole('radio', { name: pregnancy ? 'Ja' : 'Nein' }).click();
    }
    await next(page);
    await page.getByRole('checkbox', { name: /Ich habe den Hinweis gelesen/ }).click();
    await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
  } else {
    await page.getByRole('button', { name: 'Ohne Einwilligung fortfahren' }).click();
  }
  await heading(page, 'Deine Trainingserfahrung');
  await page.getByRole('radio', { name: /^Einsteiger/ }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await page.getByRole('radio', { name: 'Muskelaufbau', exact: true }).click();
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await planDays(page, [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ]);
  await next(page);
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

async function openCycle(page: Page) {
  await page.goto('/mehr');
  await page.getByTestId('more-cycle').click();
  await expect(page.getByTestId('cycle-screen')).toBeVisible();
}

async function enable(page: Page, lastPeriod: RegExp = /weniger als 1 Monat/) {
  await openCycle(page);
  await expect(page.getByTestId('cycle-mdr')).toContainText(
    'nicht zur Verhütung oder Familienplanung geeignet',
  );
  await page
    .getByRole('checkbox', { name: /Ich willige in die Verarbeitung meiner Zyklusdaten/ })
    .click();
  await page.getByTestId('cycle-start').click();
  await expect(page.getByTestId('cycle-setup')).toBeVisible();
  await page.getByTestId('cycle-status-natural').click();
  await page.getByRole('radio', { name: lastPeriod }).click();
  await page.getByTestId('cycle-setup-save').click();
  await expect(page.getByTestId('cycle-active')).toBeVisible();
}

test.describe('Zyklus-Modul (Testmodus)', () => {
  test('Einschalten, Check in 3 Tipps, Angebot „Heute leichter?“, „Heute“ ohne Zyklus-Wörter', async ({
    page,
  }) => {
    await onboard(page);
    // Ohne Einwilligung: nur Einführung, kein Check.
    await openCycle(page);
    await expect(page.getByTestId('cycle-intro')).toBeVisible();
    await expect(page.getByTestId('cycle-day-check')).toHaveCount(0);
    // Einwilligung nicht vorausgewählt.
    await page.getByTestId('cycle-start').click();
    await expect(page.getByText('Bitte stimme der Einwilligung zu')).toBeVisible();

    await enable(page);
    // Tages-Check: drei Tipps, jeder speichert sofort.
    await page.getByTestId('cycle-bleeding-medium').click();
    await page.getByTestId('cycle-energy-2').click();
    await page.getByTestId('cycle-symptom-cramps-strong').click();
    await expect(page.getByTestId('cycle-lighter-offer')).toBeVisible();
    await expect(page.getByTestId('cycle-lighter-offer')).toContainText('statt');
    await expect(page.getByTestId('cycle-hint-drink')).toBeVisible();
    await expect(page.getByTestId('cycle-urgent')).toBeVisible();

    // Nach dem Neuladen ist der Eintrag noch da (geschützter Speicher im Tab).
    await page.reload();
    await expect(page.getByTestId('cycle-energy-2')).toHaveAttribute('aria-checked', 'true');

    // „Heute“: neutrale Karte, keine Zyklus-Wörter.
    await page.goto('/today');
    await expect(page.getByTestId('today-checkin')).toBeVisible();
    const text = await page.getByTestId('today').innerText();
    expect(text).not.toMatch(CYCLE_WORDS);
  });

  test('„mehr als 3 Monate“ → W1 sofort; Beispieldaten → Eisen; Warnungen aus → Ratgeber; Status; Widerruf', async ({
    page,
  }) => {
    await onboard(page);
    await enable(page, /mehr als 3 Monaten/);
    await expect(page.getByTestId('cycle-warning-W1')).toContainText(
      'Deine Periode ist seit drei Monaten ausgeblieben',
    );

    // Testmodus-Schalter: Beispieldaten (heute starke Blutung) → Eisen-Hinweis.
    await page.getByTestId('cycle-open-settings').click();
    await page.getByTestId('cycle-sample-data').click();
    await expect(page.getByTestId('cycle-settings-message')).toContainText('Beispieldaten geladen');
    await page.goto('/zyklus');
    await expect(page.getByTestId('cycle-hint-iron')).toBeVisible();
    await expect(page.getByTestId('cycle-day-of-cycle')).toContainText('seit Periodenbeginn');

    // Warnungen aus → statischer Ratgeber statt Karten.
    await page.goto('/zyklus/einstellungen');
    await page.getByTestId('cycle-warnings-off').click();
    await page.goto('/zyklus');
    await expect(page.getByTestId('cycle-static-guide')).toBeVisible();
    await expect(page.locator('[data-testid^="cycle-warning-"]')).toHaveCount(0);
    await page.goto('/zyklus/einstellungen');
    await page.getByTestId('cycle-warnings-off').click();

    // Verlauf zeigt Einträge, keine Vorhersage.
    await page.goto('/zyklus/verlauf');
    await expect(page.getByTestId('cycle-history')).toContainText('Keine Vorhersage');
    await expect(page.getByTestId('cycle-day-2026-10-12')).toBeVisible();

    // Status „Hormonelle Verhütung“ → keine Ausbleiben-Warnung.
    await page.goto('/zyklus/einstellungen');
    await page.getByTestId('cycle-change-status').click();
    await page.getByTestId('cycle-status-hormonal_contraception').click();
    await page.getByTestId('cycle-setup-save').click();
    await page.goto('/zyklus');
    await expect(page.getByTestId('cycle-active')).toBeVisible();
    await expect(page.getByTestId('cycle-warning-W1')).toHaveCount(0);

    // Modul beenden = Widerruf → alles leer, Einwilligung widerrufen, keine Karte auf „Heute“.
    await page.goto('/zyklus/einstellungen');
    await page.getByTestId('cycle-end').click();
    await page
      .getByTestId('cycle-end-dialog')
      .getByRole('button', { name: 'Modul beenden' })
      .click();
    await expect(page.getByTestId('cycle-settings-message')).toContainText(
      'Alle Zyklusdaten sind gelöscht',
    );
    const stored = await page.evaluate(() =>
      window.sessionStorage.getItem('fitnessapp.cycle-cache.v1'),
    );
    expect(stored).toBeNull();
    await page.goto('/zyklus');
    await expect(page.getByTestId('cycle-intro')).toBeVisible();
    await page.goto('/today');
    await expect(page.getByTestId('today-checkin')).toHaveCount(0);
    // Zyklusdaten nie im unverschlüsselten localStorage.
    const local = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(local).not.toMatch(/cramps|bleeding|over_3_months/);
  });

  test('„männlich“ ohne Daten sieht nichts; Wechsel auf „männlich“ mit Daten → Verwaltung (S8)', async ({
    page,
  }) => {
    await onboard(page, { sex: 'männlich' });
    await page.goto('/mehr');
    await expect(page.getByTestId('more-settings')).toBeVisible();
    await expect(page.getByTestId('more-cycle')).toHaveCount(0);

    // Neuer Durchgang: weiblich mit Einträgen, dann Profil auf männlich.
    await page.context().clearCookies();
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await onboard(page, { sex: 'divers' });
    await enable(page);
    await page.getByTestId('cycle-energy-3').click();
    await patchDb(page, (value) => ({
      ...value,
      rows: {
        ...value.rows,
        profile: { ...(value.rows['profile'] as object), sex: 'male', cycle_module_interest: null },
      },
    }));
    await page.goto('/mehr');
    await expect(page.getByTestId('more-cycle')).toContainText('verwalten');
    await page.getByTestId('more-cycle').click();
    await expect(page.getByTestId('cycle-manage')).toBeVisible();
    await page.getByTestId('cycle-open-settings').click();
    await expect(page.getByTestId('cycle-end')).toBeVisible();
    await expect(page.getByTestId('cycle-delete-all')).toBeEnabled();
  });

  test('Gesundheits-Check „schwanger“ → Pausen-Bildschirm mit Arzt- und Notfall-Sätzen', async ({
    page,
  }) => {
    await onboard(page, { sex: 'weiblich', pregnant: true });
    await openCycle(page);
    await page
      .getByRole('checkbox', { name: /Ich willige in die Verarbeitung meiner Zyklusdaten/ })
      .click();
    await page.getByTestId('cycle-start').click();
    await expect(page.getByTestId('cycle-pregnancy')).toContainText(
      'Blutungen oder Schmerzen in der Schwangerschaft immer ärztlich abklären lassen',
    );
    await expect(page.getByTestId('cycle-urgent')).toBeVisible();
    await expect(page.getByTestId('cycle-day-check')).toHaveCount(0);
  });
});
