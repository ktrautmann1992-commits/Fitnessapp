/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test } from '@playwright/test';

/**
 * Bildschirmfotos der wichtigsten Bildschirme (390 × 844, hell und dunkel) zur Sichtprüfung.
 * Läuft nur mit gesetztem SCREENSHOT_DIR (pnpm --filter @fitnessapp/mobile screenshots), nicht in CI.
 */
const dir = process.env.SCREENSHOT_DIR;
test.skip(!dir, 'Nur mit SCREENSHOT_DIR');

for (const scheme of ['light', 'dark'] as const) {
  test(`Bildschirme ${scheme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: scheme });
    mkdirSync(`${dir}/${scheme}`, { recursive: true });
    let n = 0;
    const shot = async (name: string) => {
      n += 1;
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/${scheme}/${String(n).padStart(2, '0')}-${name}.png` });
    };
    const next = () => page.getByRole('button', { name: 'Weiter', exact: true }).click();
    const heading = (name: string | RegExp) =>
      expect(page.getByRole('heading', { name })).toBeVisible();

    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/');
    await shot('willkommen');
    await page.getByRole('button', { name: "Los geht's" }).click();
    await page.getByLabel('Geburtsdatum: Tag').fill('01');
    await page.getByLabel('Geburtsdatum: Monat').fill('01');
    await page.getByLabel('Geburtsdatum: Jahr').fill(String(new Date().getFullYear() - 14));
    await next();
    await heading(/Schön, dass du/);
    await shot('unter-16');
    await page.getByRole('button', { name: 'Zurück zum Start' }).click();
    await page.getByRole('button', { name: "Los geht's" }).click();
    await page.getByLabel('Geburtsdatum: Tag').fill('15');
    await page.getByLabel('Geburtsdatum: Monat').fill('05');
    await page.getByLabel('Geburtsdatum: Jahr').fill('1990');
    await shot('alter');
    await next();
    await shot('konto-testmodus');
    await page.getByRole('button', { name: 'Testmodus starten' }).click();
    await heading('Deine Zustimmung');
    await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
    await shot('einwilligungen-fehler');
    await page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' }).click();
    await page
      .getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' })
      .click();
    await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
    await heading('Dein Geschlecht');
    await page.getByRole('radio', { name: 'weiblich' }).click();
    await shot('geschlecht');
    await next();
    await heading('Einwilligung Gesundheitsdaten');
    await shot('einwilligung-gesundheit');
    await page.getByRole('checkbox', { name: /Ich willige/ }).click();
    await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
    await heading('Körperdaten');
    await page.getByLabel('Größe in cm').fill('17');
    await next();
    await shot('koerperdaten-fehler');
    await page.getByLabel('Größe in cm').fill('170');
    await page.getByLabel('Gewicht in kg').fill('65');
    await next();
    await heading('Körperumfänge');
    await shot('koerperumfaenge');
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await heading('Gesundheits-Check');
    const groups = page.getByRole('radiogroup');
    for (let i = 0; i < (await groups.count()); i += 1) {
      await groups
        .nth(i)
        .getByRole('radio', { name: i === 5 ? 'Ja' : 'Nein' })
        .click();
    }
    await shot('gesundheits-check');
    await next();
    await shot('arzt-hinweis');
    await page.getByRole('checkbox', { name: /Ich habe den Hinweis gelesen/ }).click();
    await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
    await heading('Deine Trainingserfahrung');
    await page.getByRole('radio', { name: /^Fortgeschritten/ }).click();
    await shot('erfahrung');
    await next();
    await page.getByRole('radio', { name: 'Ausdauer' }).click();
    await page.getByRole('radio', { name: 'Marathon', exact: true }).click();
    await shot('ziel');
    await next();
    await page.getByRole('radio', { name: '4', exact: true }).click();
    await page.getByRole('radio', { name: '60 Minuten' }).click();
    await page.getByRole('checkbox', { name: 'Dienstag' }).click();
    await shot('zeitbudget');
    await next();
    await page.getByRole('radio', { name: 'Zuhause' }).click();
    await shot('trainingsort');
    await next();
    await page.getByRole('checkbox', { name: 'Kurzhanteln' }).click();
    await page.getByLabel('Kurzhanteln: Gewicht in kg').fill('5');
    await page.getByRole('button', { name: 'Kurzhanteln: Hinzufügen' }).click();
    await shot('equipment');
    await next();
    await page.getByRole('radio', { name: 'Alles (omnivor)' }).click();
    await page
      .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
      .getByRole('radio', { name: '3' })
      .click();
    await page
      .getByRole('checkbox', {
        name: 'Glutenhaltiges Getreide (Weizen, Roggen, Gerste): Mag ich nicht',
      })
      .click();
    await shot('ernaehrung');
    await next();
    await page.getByRole('radio', { name: /^Täglich frisch/ }).click();
    await shot('kochmodus');
    await next();
    await heading('Geschafft!');
    await shot('fertig');
    await page.getByRole('button', { name: 'Zur Startseite' }).click();
    await heading('Heute');
    await shot('heute');
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await heading('Einstellungen');
    await shot('einstellungen');
    await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
    await shot('widerruf-dialog');
  });
}
