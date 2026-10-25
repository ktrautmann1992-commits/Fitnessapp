import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Calisthenics, Schlingentrainer und Lauf-Kraft im TESTMODUS (docs/PLAN-CALISTHENICS-SCHLINGE.md, Gründer-Freigabe
 * 25.10.2026): Skill-Pfade-Bildschirm (Testinhalt-Hinweis, Stufen, Sperren für Einsteiger), Schlingentrainer-Plan zu
 * Hause mit Tausch-Alternative und Winkel-/Anker-Hinweis im Glossar, Lauf-Kraft-Block am Lauftag.
 * Alle Inhalte sind Entwürfe – im Testmodus sichtbar und als „Testinhalt“ gekennzeichnet.
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');
const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const shots = process.env.SCREENSHOT_DIR;

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

async function exerciseNames(page: Page): Promise<string[]> {
  await expect(page.getByTestId('plan-exercise').first()).toBeVisible();
  return page.getByTestId('plan-exercise').getByTestId('plan-exercise-link').allInnerTexts();
}

async function shot(page: Page, testId: string, name: string) {
  if (!shots) return;
  await page.getByTestId(testId).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/${name}.png` });
}

async function start(page: Page, at: Date) {
  await page.clock.setFixedTime(at);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

test('Skill-Pfade: Einstieg über „Mehr“, Testinhalt, aktuelle Stufe, Sperren für Einsteiger', async ({
  page,
}) => {
  await start(page, WEDNESDAY);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Calisthenics / Körperbeherrschung',
    days: [
      ['Montag', 'Kraft zu Hause', 45],
      ['Mittwoch', 'Kraft zu Hause', 45],
      ['Freitag', 'Kraft zu Hause', 45],
    ],
    homeEquipment: ['Klimmzugstange', 'Barren/Dip-Station'],
  });
  await toToday(page);
  // Calisthenics-Vorlage (Entwurf) liefert Übungen mit Stange/Barren bzw. Körpergewicht.
  expect((await exerciseNames(page)).length).toBeGreaterThan(2);
  if (shots) await shot(page, 'plan-exercise', 'calisthenics-heute');

  await page.goto('/mehr');
  await page.getByTestId('more-skill-paths').click();
  await heading(page, 'Skill-Pfade');
  await expect(page.getByTestId('skill-paths-test-content')).toContainText('Testinhalt');
  await expect(page.getByTestId('skill-path-klimmzug')).toContainText('Klimmzug');
  await expect(page.getByTestId('skill-current-klimmzug')).toContainText('Stufe 1 von');
  await expect(page.getByTestId('skill-current-klimmzug')).toContainText('Noch nicht begonnen');
  // Einsteiger: Handstand, Muscle-up und Hebel gesperrt – mit verständlichem Grund.
  await expect(page.getByTestId('skill-path-handstand')).toContainText('Erst für Fortgeschrittene');
  // Auch die erste Muscle-up-Stufe ist für Einsteiger gesperrt, inkl. Voraussetzungen (8 Klimmzüge, 10 Dips).
  await expect(page.getByTestId('skill-lock-muscle_up-0')).toContainText(
    'Erst für Fortgeschrittene',
  );
  await expect(page.getByTestId('skill-stage-muscle_up-0')).toContainText('0 von 8');
  await expect(page.getByTestId('skill-current-muscle_up')).toContainText('noch gesperrt');
  await expect(page.getByTestId('skill-path-front_lever')).toContainText(
    'Erst für Fortgeschrittene',
  );
  // Neutral und privat: keine Abzeichen, keine Ranglisten, kein Teilen.
  await expect(page.getByTestId('skill-paths')).not.toContainText(/Abzeichen verdient|Teilen/);
  if (shots) {
    await page.screenshot({ path: `${shots}/skill-pfade-oben.png` });
    await shot(page, 'skill-path-handstand', 'skill-pfade-gesperrt');
    await shot(page, 'skill-stage-muscle_up-0', 'skill-pfade-muscle-up');
  }

  // Stufe antippen → Glossar der Übung.
  await page.getByTestId('skill-stage-klimmzug-0').getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByTestId('glossary-skill-paths')).toBeVisible();
});

test('Schlingentrainer zu Hause: Plan mit Schlingen-Übungen, Alternative beim Tauschen, Winkel und Anker', async ({
  page,
}) => {
  await start(page, WEDNESDAY);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft zu Hause', 45],
      ['Mittwoch', 'Kraft zu Hause', 45],
      ['Freitag', 'Kraft zu Hause', 45],
    ],
    homeEquipment: ['Schlingentrainer'],
  });
  await toToday(page);
  const names = await exerciseNames(page);
  expect(names.some((name) => /Schlingentrainer/.test(name))).toBe(true);
  if (shots) await shot(page, 'plan-exercise', 'schlinge-heute');

  // Nur Schlingentrainer: Tauschen bietet leichtere Varianten an (nie schwerer als das Original).
  await page.getByTestId('plan-swap-0').click();
  await expect(page.getByTestId('swap-dialog')).toBeVisible();
  await expect(
    page.getByTestId('swap-dialog').getByTestId('swap-candidates').getByRole('radio').first(),
  ).toBeVisible();
  await page.getByTestId('swap-dialog').getByRole('button', { name: 'Abbrechen' }).click();

  // Glossar einer Schlingen-Übung: Körperwinkel + Anker-Sicherheit.
  const sling = page
    .getByTestId('plan-exercise-link')
    .filter({ hasText: /Schlingentrainer/ })
    .first();
  await sling.click();
  const card = page.getByTestId('glossary-sling');
  await expect(card).toContainText('Körperwinkel');
  await expect(card).toContainText('zu der sich die Tür schließt');
  await expect(card).toContainText('Belastung');
  await shot(page, 'glossary-sling', 'schlinge-glossar');
});

test('Kurzhanteln + Schlingentrainer: Schlingen-Übung als Alternative beim Tauschen', async ({
  page,
}) => {
  await start(page, WEDNESDAY);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft zu Hause', 45],
      ['Mittwoch', 'Kraft zu Hause', 45],
      ['Freitag', 'Kraft zu Hause', 45],
    ],
    homeEquipment: ['Kurzhanteln', 'Kurzhanteln: 4 kg', 'Kurzhanteln: 8 kg', 'Schlingentrainer'],
  });
  await toToday(page);
  const names = await exerciseNames(page);
  const dialog = page.getByTestId('swap-dialog');
  let found: string | null = null;
  for (let i = 0; i < names.length && !found; i += 1) {
    if (/Schlingentrainer/.test(names[i] ?? '')) continue;
    const swap = page.getByTestId(`plan-swap-${i}`);
    if ((await swap.count()) === 0) continue;
    await swap.click();
    await expect(dialog).toBeVisible();
    const candidates = await dialog
      .getByTestId('swap-candidates')
      .getByRole('radio')
      .allInnerTexts();
    found = candidates.find((c) => /Schlingentrainer/.test(c)) ?? null;
    if (found && shots) {
      // Dialog blendet ein – kurz warten, damit das Bild nicht durchscheint.
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${shots}/schlinge-tauschen.png` });
    }
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(found, `Alternativen von: ${names.join(', ')}`).not.toBeNull();
});

test('Reise-Modus mit Schlingentrainer: Einheiten werden auf Schlingen-Übungen umgestellt', async ({
  page,
}) => {
  await start(page, WEDNESDAY);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await toToday(page);
  await page.goto('/settings');
  await page.getByTestId('settings-travel-mode').click();
  await heading(page, 'Reise-Modus');
  await page.getByTestId('travel-equipment-outdoor_park').click();
  await expect(page.getByTestId('travel-park-note')).toContainText('Klimmzugstange und Barren');
  await page.getByTestId('travel-equipment-suspension_trainer').click();
  await expect(page.getByTestId('travel-suspension-note')).toContainText(
    'zu der sie sich schließt',
  );
  await page.getByLabel('Letzter Reisetag: Tag').fill('13');
  await shot(page, 'travel-suspension-note', 'reise-schlinge');
  await page.getByTestId('travel-save').click();
  await expect(page.getByTestId('travel-message')).toContainText('07.10.2026 bis 13.10.2026');
  await page.goto('/today');
  await heading(page, 'Heute');
  const names = await exerciseNames(page);
  expect(names.some((name) => /Schlingentrainer/.test(name))).toBe(true);
  expect(names.some((name) => /Langhantel|Maschine|Kabel|Latzug|Beinpresse/.test(name))).toBe(
    false,
  );
});

test('Lauf-Kraft: 15-Minuten-Block nach dem lockeren Lauf, mit Timer zu öffnen', async ({
  page,
}) => {
  await start(page, MONDAY);
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Halbmarathon',
    days: [
      ['Montag', 'Ausdauer', 45],
      ['Mittwoch', 'Ausdauer', 45],
      ['Samstag', 'Ausdauer', 90],
    ],
  });
  await toToday(page);
  const block = page.getByTestId('plan-run-strength');
  await expect(block).toContainText('Lauf-Kraft danach (15 min)');
  await expect(block).toContainText('Runden');
  await shot(page, 'plan-run-strength', 'lauf-kraft-heute');
  await page.getByTestId('plan-run-strength-open').click();
  await expect(page.getByTestId('workout-test-content')).toContainText('Testinhalt');
  if (shots) await page.screenshot({ path: `${shots}/lauf-kraft-einheit.png` });
});
