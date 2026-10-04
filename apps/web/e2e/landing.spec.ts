/// <reference types="node" />
import { expect, test } from '@playwright/test';

import { WAITLIST_CONSENT } from '../src/lib/waitlist/consent';

/** Landingpage, Warteliste (ohne Einstellungen), Rechtsseiten, robots/sitemap – Handy-Ansicht 390 × 844. */

test('Startseite: Kopfzeile, Hero und alle Abschnitte', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Alpha5 – Training und Ernährung, die zu dir passen');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Training und Ernährung, die zu dir passen.' }),
  ).toBeVisible();
  const logo = page.getByRole('banner').getByRole('link', { name: 'Alpha5' });
  await expect(logo.locator('img')).toHaveAttribute('src', /alpha5-mark/);
  for (const titel of [
    'In vier Schritten zu deinem Plan',
    'Zum Start dabei',
    'Was danach kommt',
    'Kostenlos starten',
    'Deine Gesundheitsdaten bleiben deine',
    'Sei beim Start dabei',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: titel })).toBeAttached();
  }
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image\.png/,
  );
  // Schrift selbst gehostet, keine Verbindung zu Google
  const html = await page.content();
  expect(html).not.toContain('fonts.googleapis.com');
  expect(html).not.toContain('fonts.gstatic.com');
});

test('Beispiel-Einheit: abhaken, Alternative tauschen, Belastung einschätzen', async ({ page }) => {
  await page.goto('/');
  const stand = page.getByTestId('stand');
  await expect(stand).toHaveText('0 von 4');

  const haken = page.getByRole('button', { name: /als erledigt markieren/ });
  await expect(haken).toHaveCount(4);
  await haken.nth(0).click();
  await expect(haken.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(stand).toHaveText('1 von 4');
  await haken.nth(0).click();
  await expect(stand).toHaveText('0 von 4');
  for (let i = 0; i < 4; i++) await haken.nth(i).click();
  await expect(stand).toHaveText('Einheit geschafft');

  await page.getByRole('button', { name: 'Alternative' }).first().click();
  await expect(page.getByText('Liegestütze mit erhöhten Füßen')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Original' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Original' }).click();
  await expect(page.getByText('Kurzhantel-Bankdrücken')).toBeVisible();

  const regler = page.getByLabel(/Wie anstrengend war es/);
  await expect(page.getByText('Fordernd, aber gut machbar')).toBeVisible();
  await regler.fill('10');
  await expect(page.getByTestId('rpe-wert')).toHaveText('10');
  await expect(page.getByText('Absolutes Maximum')).toBeVisible();
  await regler.fill('0');
  await expect(page.getByText('Völlig locker')).toBeVisible();
});

test('Warteliste: Prüfungen im Formular, ohne Einstellungen „bald aktiv“', async ({ page }) => {
  await page.goto('/#warteliste');
  await expect(page.getByTestId('einwilligungstext')).toHaveText(WAITLIST_CONSENT.text);
  const knopf = page.locator('#eintragen');
  const meldung = page.locator('#warteliste [role="status"]');

  const email = page.getByLabel('E-Mail-Adresse');
  const haken = page.getByRole('checkbox');
  await knopf.click();
  await expect(meldung).toHaveText('Bitte gib eine gültige E-Mail-Adresse ein.');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute('aria-describedby', 'warteliste-meldung');
  await expect(email).toBeFocused();
  await email.fill('test@beispiel.de');
  await knopf.click();
  await expect(meldung).toHaveText('Bitte bestätige, dass wir dich per E-Mail informieren dürfen.');
  await expect(email).toHaveAttribute('aria-invalid', 'false');
  await expect(haken).toHaveAttribute('aria-invalid', 'true');
  await expect(haken).toBeFocused();

  await haken.check();
  const antwort = page.waitForResponse('**/api/warteliste');
  await knopf.click();
  expect((await antwort).status()).toBe(503);
  await expect(meldung).toHaveText(
    'Die Warteliste ist bald aktiv. Bitte versuch es in ein paar Tagen noch einmal.',
  );
});

test('Warteliste-API: fremde Herkunft abgelehnt, Honeypot meldet Erfolg', async ({ request }) => {
  const fremd = await request.post('/api/warteliste', {
    data: { email: 'a@b.de', consent: true },
    headers: { origin: 'https://boese.example' },
  });
  expect(fremd.status()).toBe(403);
  const bot = await request.post('/api/warteliste', {
    data: { email: 'a@b.de', consent: true, website: 'spam' },
    headers: { origin: 'http://localhost:3100' },
  });
  expect(bot.status()).toBe(200);
});

test('Mail-Link-Seiten: Knopf statt Sofort-Aktion, ohne Einstellungen „bald aktiv“', async ({
  page,
}) => {
  const token = 'A'.repeat(43);
  // Token steht im #Fragment (wird nie an den Server geschickt)
  await page.goto(`/warteliste/bestaetigen#token=${token}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('button', { name: 'Anmeldung bestätigen' }).click();
  await expect(page).toHaveURL(/ergebnis=inaktiv/);
  await expect(page.getByText('Die Warteliste ist bald aktiv.', { exact: false })).toBeVisible();

  await page.goto('/warteliste/abmelden#token=kaputt');
  await expect(page.getByText('Dieser Link ist ungültig.', { exact: false })).toBeVisible();
});

test('Rechtsseiten mit Platzhaltern, verlinkt im Fuß', async ({ page }) => {
  await page.goto('/');
  for (const [link, titel] of [
    ['Impressum', 'Impressum'],
    ['Datenschutz', 'Datenschutzerklärung'],
    ['AGB', 'Allgemeine Geschäftsbedingungen'],
  ] as const) {
    await page.getByRole('contentinfo').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
    await expect(page.getByText('PLATZHALTER – vor Livegang ausfüllen.')).toBeVisible();
    await page.goto('/');
  }
  await expect(page.getByRole('link', { name: 'App im Browser testen' })).toHaveAttribute(
    'href',
    'https://fitnessapp-alpha-five.vercel.app',
  );
});

test('robots.txt und sitemap.xml', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
  expect(robots).toContain('Disallow: /warteliste/');
  expect(robots).toContain('Sitemap: https://fitnessapp-web-eight.vercel.app/sitemap.xml');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const pfad of ['', '/impressum', '/datenschutz', '/agb']) {
    expect(sitemap).toContain(`<loc>https://fitnessapp-web-eight.vercel.app${pfad}</loc>`);
  }
  expect(sitemap).not.toContain('/admin');
});
