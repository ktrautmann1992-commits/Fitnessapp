import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Übungs-Glossar im TESTMODUS (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md Etappe G1) mit festem Datum Mittwoch, 07.10.2026:
 * Suche mit Umlaut-Toleranz, Filter, Trefferzahl als Live-Region, Detailseite, Link aus „Heute“ und „So geht's“ im
 * Trainingsmodus (Pausentimer läuft weiter).
 */

const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

/** Zuhause ohne Geräte, 3 Tage (Körpergewicht-Plan). */
const HOME_3_DAYS = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft zu Hause', 45],
    ['Mittwoch', 'Kraft zu Hause', 45],
    ['Freitag', 'Kraft zu Hause', 45],
  ] as [string, string, number][],
};

async function toToday(page: Page) {
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
}

const count = (page: Page) => page.getByTestId('glossary-count');
const items = (page: Page) => page.getByTestId('glossary-item');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('Glossar: Suche mit Umlaut-Toleranz, Filter, Trefferzahl, Detailseite', async ({ page }) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);
  await page.getByTestId('today-glossary').click();
  await heading(page, 'Übungen');

  // Alle Übungen des Inhaltsstands (Anzahl nicht fest), Trefferzahl als Live-Region.
  await expect(count(page)).toHaveAttribute('aria-live', 'polite');
  await expect(count(page)).toHaveText(/^\d+ Übungen$/);
  const total = Number((await count(page).innerText()).split(' ')[0]);
  expect(total).toBeGreaterThan(20);
  await expect(items(page)).toHaveCount(total);
  // Testmodus: Entwürfe sind gekennzeichnet.
  await expect(items(page).first()).toContainText('Testinhalt – noch nicht fachlich geprüft');

  // Umlaut-tolerant: „rumaenisch“ findet „Rumänisches Kreuzheben …“.
  const search = page.getByLabel('Übungen suchen');
  await search.fill('rumaenisch');
  await expect(count(page)).toHaveText('2 Übungen');
  await expect(items(page).first()).toContainText('Rumänisches Kreuzheben');
  await search.fill('KREUZ HEBEN');
  await expect(items(page).filter({ hasText: 'Rumänisches Kreuzheben' })).toHaveCount(2);

  // Keine Treffer → Hinweis; Suche löschen → wieder alle.
  await search.fill('xyzxyz');
  await expect(count(page)).toHaveText('0 Übungen');
  await expect(page.getByTestId('glossary-empty')).toContainText('Keine Übung gefunden');
  await page.getByTestId('glossary-search-clear').click();
  await expect(count(page)).toHaveText(`${total} Übungen`);

  // Filter „Ohne Geräte“: nur Übungen ohne Geräte (Radio mit Zustand), weniger als alle.
  const noEquipment = page.getByRole('radio', { name: 'Ohne Geräte' });
  await noEquipment.click();
  await expect(noEquipment).toHaveAttribute('aria-checked', 'true');
  const withoutEquipment = Number((await count(page).innerText()).split(' ')[0]);
  expect(withoutEquipment).toBeGreaterThan(0);
  expect(withoutEquipment).toBeLessThan(total);
  const lines = await items(page).allInnerTexts();
  expect(lines.every((line) => line.includes('ohne Geräte'))).toBe(true);
  // Zusätzlich Bereich „Rumpf“ (Chip mit Zustand).
  const core = page.getByRole('checkbox', { name: 'Bereich: Rumpf' });
  await core.click();
  await expect(core).toHaveAttribute('aria-checked', 'true');
  const coreLines = await items(page).allInnerTexts();
  expect(coreLines.length).toBeGreaterThan(0);
  expect(coreLines.every((line) => line.includes('Rumpf · ohne Geräte'))).toBe(true);
  await page.getByTestId('glossary-reset').click();
  await expect(count(page)).toHaveText(`${total} Übungen`);

  // Detailseite.
  await search.fill('rumaenisch');
  await items(page).filter({ hasText: 'mit Kurzhanteln' }).click();
  await heading(page, 'Rumänisches Kreuzheben mit Kurzhanteln');
  await expect(page.getByTestId('glossary-features')).toContainText('Hüfte/Gesäß · Kurzhanteln');
  await expect(page.getByTestId('glossary-test-content')).toBeVisible();
  await heading(page, "So geht's");
  await heading(page, 'Tipps');
  await heading(page, 'Häufige Fehler');
  await expect(page.getByTestId('glossary-safety')).toContainText('Sicherheitshinweis');
  const firstStep = page.getByTestId('glossary-steps').locator('[aria-label^="Schritt 1 von "]');
  await expect(firstStep).toHaveCount(1);
  // Zurück zur Liste: Suche bleibt erhalten.
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await heading(page, 'Übungen');
  await expect(search).toHaveValue('rumaenisch');

  // Unbekannte ID.
  await page.goto('/uebungen/gibt-es-nicht');
  await expect(page.getByTestId('glossary-detail-missing')).toHaveText(
    'Diese Übung gibt es nicht (mehr).',
  );
  // Kaputte Prozent-Folge im Link: kein Absturz, gleicher Hinweis.
  await page.goto('/uebungen/%25');
  await expect(page.getByTestId('glossary-detail-missing')).toHaveText(
    'Diese Übung gibt es nicht (mehr).',
  );
});

test("Link aus „Heute“ und Einstellungen; „So geht's“ im Training – Pausentimer läuft weiter", async ({
  page,
}) => {
  await onboard(page, HOME_3_DAYS);
  await toToday(page);

  // Übungsname auf „Heute“ ist ein Link zur Anleitung.
  const link = page.getByTestId('plan-exercise-link').first();
  await expect(link).toHaveAttribute('role', 'link');
  const label = (await link.innerText()).replace(/^\d+\.\s*/, '').trim();
  await link.click();
  await heading(page, label);
  await heading(page, "So geht's");
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await heading(page, 'Heute');

  // Einstellungen → „Übungen (Glossar)“.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByTestId('settings-glossary').click();
  await heading(page, 'Übungen');
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await page.getByRole('button', { name: 'Zurück zu Heute' }).click();
  await heading(page, 'Heute');

  // Trainingsmodus: Satz abhaken → Pause läuft; „So geht's“ aufklappen bleibt im Training, Pause läuft weiter.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await page.getByTestId('workout-done-0-0').click();
  await expect(page.getByTestId('rest-timer')).toBeVisible();
  const time = page.getByTestId('rest-timer-time');
  const seconds = async () => {
    const [m, s] = (await time.innerText()).split(':').map(Number);
    return (m ?? 0) * 60 + (s ?? 0);
  };
  const before = await seconds();
  const howTo = page.getByTestId('workout-howto-0');
  await expect(howTo).toHaveAttribute('aria-expanded', 'false');
  await howTo.click();
  await expect(howTo).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByTestId('workout-howto-panel-0');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[aria-label^="Schritt 1 von "]')).toHaveCount(1);
  await expect(panel).toContainText('Sicherheitshinweis');
  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByTestId('rest-timer')).toBeVisible();
  await page.clock.setFixedTime(new Date(WEDNESDAY.getTime() + 20 * 1000));
  await expect.poll(seconds).toBeLessThan(before);
  // Zuklappen.
  await howTo.click();
  await expect(panel).toHaveCount(0);

  // „Ganze Anleitung“ öffnet die Detailseite, zurück im Training ist alles noch da.
  await howTo.click();
  await page.getByTestId('workout-guide-0').click();
  await heading(page, "So geht's");
  await page.getByRole('button', { name: 'Zurück', exact: true }).click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByTestId('workout-done-0-0')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('rest-timer')).toBeVisible();
});
