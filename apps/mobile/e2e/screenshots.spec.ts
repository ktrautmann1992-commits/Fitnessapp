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
    const names = new Set<string>();
    const shot = async (name: string) => {
      // Eindeutige Namen und fortlaufende Nummern (keine Datei wird überschrieben).
      if (names.has(name)) throw new Error(`Screenshot-Name doppelt: ${name}`);
      names.add(name);
      n += 1;
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/${scheme}/${String(n).padStart(2, '0')}-${name}.png` });
    };
    const next = () => page.getByRole('button', { name: 'Weiter', exact: true }).click();
    const heading = (name: string | RegExp) =>
      expect(page.getByRole('heading', { name, exact: typeof name === 'string' })).toBeVisible();

    // Fester Tag (Montag, 05.10.2026), damit die Bilder vergleichbar bleiben.
    await page.clock.setFixedTime(new Date('2026-10-05T09:00:00+02:00'));
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
    await page.getByRole('radio', { name: 'Ausdauer', exact: true }).click();
    await page.getByRole('radio', { name: 'Marathon', exact: true }).click();
    await shot('ziel');
    // Zwei Ziele und Wunschgewicht mit Ampel (Etappe Z4): Nebenziel Abnehmen, danach wieder ohne Nebenziel weiter.
    await page.getByRole('radio', { name: /^Zweites Ziel: Abnehmen$/ }).click();
    await shot('ziel-zwei-ziele');
    await next();
    await heading('Wie möchtest du abnehmen?');
    await shot('wunschgewicht');
    const concrete = page.getByRole('radio', { name: 'Mit konkretem Ziel' });
    if ((await concrete.getAttribute('aria-disabled')) !== 'true') {
      await concrete.click();
      await page.getByLabel('kg abnehmen ab heute').fill('3');
      await page.getByLabel('Wochen', { exact: true }).fill('6');
      const scale = page.getByTestId('feasibility-scale');
      await scale.scrollIntoViewIfNeeded();
      await shot('wunschgewicht-ampel');
      await page.getByLabel('Wochen', { exact: true }).fill('16');
      await scale.scrollIntoViewIfNeeded();
      await shot('wunschgewicht-ampel-ruhig');
    }
    await page.getByRole('button', { name: 'Zurück' }).click();
    await heading('Dein Ziel');
    await page.getByRole('radio', { name: /^Kein zweites Ziel/ }).click();
    await next();
    await shot('trainingstage-vorschlag');
    await page.getByRole('button', { name: 'Ohne Vorschlag planen' }).click();
    await page.getByRole('radio', { name: 'Tage egal – verteilt für mich' }).click();
    await page.getByRole('button', { name: 'Kraft im Studio: eine Einheit mehr' }).click();
    await page.getByRole('button', { name: 'Ausdauer – Laufen: eine Einheit mehr' }).click();
    await page.getByRole('button', { name: 'Ausdauer – Laufen: eine Einheit mehr' }).click();
    await shot('trainingstage-flex');
    await page.getByRole('radio', { name: 'Feste Wochentage' }).click();
    await page.getByRole('checkbox', { name: 'Montag' }).click();
    await page.getByRole('checkbox', { name: 'Mittwoch' }).click();
    await page.getByRole('radio', { name: 'Mittwoch: Kraft im Studio' }).click();
    await page.getByRole('radio', { name: 'Mittwoch: 60 Minuten' }).click();
    await page.getByRole('checkbox', { name: 'Samstag' }).click();
    await page.getByRole('radio', { name: 'Samstag: Kraft zu Hause' }).click();
    await page.getByRole('radio', { name: 'Samstag: Eigene' }).click();
    await page.getByLabel('Samstag: Minuten (10–240)').fill('90');
    await shot('trainingstage');
    await page.getByTestId('schedule-summary').scrollIntoViewIfNeeded();
    await shot('trainingstage-zusammenfassung');
    await next();
    await page.getByRole('checkbox', { name: 'Kurzhanteln', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Kurzhanteln: 2 kg', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Kurzhanteln: 4 kg', exact: true }).click();
    await page.getByLabel('Kurzhanteln: Gewicht in kg').fill('5,5');
    await page.getByRole('button', { name: 'Kurzhanteln: Hinzufügen' }).click();
    await shot('equipment');
    await page.getByRole('checkbox', { name: 'Kurzhanteln', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Langhantel mit Scheiben' }).click();
    await page
      .getByRole('checkbox', { name: 'Langhantel mit Scheiben: 2,5 kg', exact: true })
      .click();
    await page
      .getByRole('checkbox', { name: 'Langhantel mit Scheiben: 10 kg', exact: true })
      .click();
    await shot('equipment-langhantel');
    await page.getByRole('checkbox', { name: 'Kurzhanteln', exact: true }).click();
    await next();
    await page.getByRole('radio', { name: 'Alles (omnivor)' }).click();
    await page
      .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
      .getByRole('radio', { name: '3' })
      .click();
    await page
      .getByRole('checkbox', {
        name: 'Glutenhaltiges Getreide (Weizen, Dinkel, Roggen, Gerste, Hafer): Mag ich nicht',
      })
      .click();
    await shot('ernaehrung');
    await next();
    await page.getByRole('radio', { name: /^Täglich frisch/ }).click();
    await shot('kochmodus');
    await next();
    await heading('Alltag und Training');
    await page.getByRole('radio', { name: /^Sitzend mit Bewegung/ }).click();
    await page
      .getByRole('radiogroup', { name: 'Wann trainierst du meistens?' })
      .getByRole('radio', { name: 'Abends' })
      .click();
    await shot('alltag-training');
    await next();
    await heading('Geschafft!');
    await expect(page.getByTestId('done-plan')).toBeVisible();
    await shot('fertig');
    await page.getByRole('button', { name: 'Zum Plan' }).click();
    await heading('Heute');
    await shot('heute');
    await page.getByTestId('plan-week').scrollIntoViewIfNeeded();
    await shot('heute-woche');
    // Ausdauer-Tag (Montag) und Kraft-Tag (Mittwoch) antippen.
    await page
      .getByTestId('plan-week')
      .getByRole('button', { name: /^Montag/ })
      .click();
    await page.getByTestId('plan-medical-notice').scrollIntoViewIfNeeded();
    await shot('heute-ausdauer');
    await page
      .getByTestId('plan-week')
      .getByRole('button', { name: /^Mittwoch/ })
      .click();
    await page.getByTestId('plan-medical-notice').scrollIntoViewIfNeeded();
    await shot('heute-kraft');
    await page.getByTestId('plan-notes').scrollIntoViewIfNeeded();
    await shot('heute-hinweise');
    // Ausdauer-Eintrag (Etappe C2): Montag ist der Ausdauer-Tag.
    await page
      .getByTestId('plan-week')
      .getByRole('button', { name: /^Montag/ })
      .click();
    await page.getByTestId('workout-start').click();
    await expect(page.getByTestId('workout-cardio')).toBeVisible();
    await page.getByTestId('workout-cardio-distance').fill('3,2');
    await page.getByTestId('workout-cardio-speed').scrollIntoViewIfNeeded();
    await shot('ausdauer-eintrag');
    await page.getByTestId('workout-effort').scrollIntoViewIfNeeded();
    await page.getByTestId('workout-effort-3').click();
    await shot('ausdauer-abschluss');
    await page.getByTestId('workout-save').click();
    await heading('Heute');
    // Trainingsmodus (Phase 4, Etappe C1): Mittwoch ist der Kraft-Tag.
    await page.clock.setFixedTime(new Date('2026-10-07T09:00:00+02:00'));
    await page.goto('/today');
    await heading('Heute');
    await page.getByTestId('workout-start').click();
    await expect(page.getByTestId('workout-exercise-0')).toBeVisible();
    await shot('training-start');
    const plus = page.getByTestId('workout-weight-0-0-plus');
    if ((await plus.count()) > 0) for (let i = 0; i < 8; i += 1) await plus.click();
    await page.getByTestId('workout-done-0-0').click();
    await expect(page.getByTestId('rest-timer')).toBeVisible();
    await shot('training-satz-pause');
    // Tausch-Dialog (Etappe T2) statt der früheren Liste „Alternative durchgeführt“.
    await page.getByTestId('workout-swap-1').click();
    await page.getByTestId('swap-dialog').waitFor();
    await shot('training-alternativen');
    await page.getByTestId('swap-cancel').click();
    await page.getByTestId('workout-effort').scrollIntoViewIfNeeded();
    await page.getByTestId('workout-effort-6').click();
    await shot('training-abschluss');
    await page.getByTestId('workout-save').click();
    await heading('Heute');
    await shot('heute-erledigt');
    // Woche, Verlauf, Eintrag (Etappe D).
    await page.getByTestId('today-week').click();
    await heading('Woche');
    await shot('woche');
    await page.getByTestId('week-summary').scrollIntoViewIfNeeded();
    await shot('woche-summen');
    await page.getByRole('button', { name: 'Verlauf' }).click();
    await heading('Verlauf');
    await shot('verlauf');
    await page.getByTestId('history-entry').first().click();
    await expect(page.getByTestId('log-entry')).toBeVisible();
    await shot('eintrag');
    await page.getByTestId('log-delete').click();
    await shot('eintrag-loeschen');
    // Übersicht mit Kacheln und Menüleiste (docs/PLAN-DASHBOARD.md).
    await page.goto('/');
    await expect(page.getByTestId('overview-header')).toBeVisible();
    await shot('uebersicht');
    await page.getByTestId('overview-progress').scrollIntoViewIfNeeded();
    await shot('uebersicht-unten');
    await page.getByTestId('overview-progress-open').click();
    await heading('Fortschritt');
    await shot('fortschritt');
    await page.getByTestId('tab-mehr').click();
    await heading('Mehr');
    await shot('mehr');
    await page.getByTestId('more-account').click();
    await heading('Mein Konto');
    await shot('mein-konto');
    await page.getByTestId('settings-export').click();
    await shot('export-dialog');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByTestId('konto-signout').click();
    await shot('abmelden-dialog');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.goto('/settings');
    await heading('Einstellungen');
    await shot('einstellungen');
    await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
    await shot('widerruf-dialog');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    // Ernährung (Phase 5, Etappe N4): Karte „Essen heute“, Tag, Rezept, Einstellungen – mit Beispiel-Rezepten
    // (Testwerte), solange der echte Katalog fehlt.
    await page.getByTestId('settings-nutrition-open').scrollIntoViewIfNeeded();
    await shot('einstellungen-ernaehrung');
    await page.goto('/ernaehrung');
    await expect(page.getByTestId('nutrition-day')).toBeVisible();
    await shot('ernaehrung-ohne-rezepte');
    if ((await page.getByTestId('nutrition-demo-use').count()) > 0) {
      await page.getByTestId('nutrition-demo-use').click();
    } else {
      // Bündel hat schon echte Rezepte: Beispiel-Rezepte nur für die Bilder erzwingen (K7).
      await page.evaluate(() =>
        window.localStorage.setItem('fitnessapp.nutrition-demo.v1', JSON.stringify('force')),
      );
      await page.goto('/ernaehrung');
    }
    await expect(page.getByTestId('nutrition-meals')).toBeVisible();
    await shot('ernaehrung-tag');
    await page.getByTestId('nutrition-meals').scrollIntoViewIfNeeded();
    await shot('ernaehrung-mahlzeiten');
    await page.getByTestId('meal-lunch').click();
    await expect(page.getByTestId('recipe')).toBeVisible();
    await shot('rezept');
    await page.getByTestId('recipe-contains').scrollIntoViewIfNeeded();
    await shot('rezept-enthaelt');
    await page.goto('/today');
    await heading('Heute');
    await page.getByTestId('today-nutrition-card').scrollIntoViewIfNeeded();
    await shot('heute-essen');
    // „Dein Tag“ (Etappe A2): heute neutral „Noch offen“, nach allen Mahlzeiten grün, Training.
    await page.getByTestId('today-day').click();
    await expect(page.getByTestId('day')).toBeVisible();
    await shot('dein-tag');
    const eaten = page.getByTestId('day-food').getByTestId(/^eaten-(?!done|undo)/);
    if ((await eaten.count()) > 0) {
      await eaten.first().click();
      await expect(page.getByTestId('day-zone')).toBeVisible();
      await shot('dein-tag-offen');
      while ((await eaten.count()) > 0) await eaten.first().click();
      await page.getByTestId('day-bar').scrollIntoViewIfNeeded();
      await shot('dein-tag-balken');
    }
    await page.getByTestId('day-training').scrollIntoViewIfNeeded();
    await shot('dein-tag-training');
    // Wochenauswertung (Etappe A3): Tagesbalken (heute grün), Summen, Training mit Erfüllungsgrad.
    await page.goto('/wochenauswertung?woche=2026-10-05');
    await expect(page.getByTestId('week-eval')).toBeVisible();
    await shot('wochenauswertung');
    await page.getByTestId('week-eval-food-summary').scrollIntoViewIfNeeded();
    await shot('wochenauswertung-summen');
    await page.getByTestId('week-eval-training').scrollIntoViewIfNeeded();
    await shot('wochenauswertung-training');
  });
}
