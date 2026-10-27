/// <reference types="node" />
import { expect, test } from '@playwright/test';

import { LEAD_MAGNET_CONSENT, WAITLIST_CONSENT } from '../src/lib/waitlist/consent';
import { CONFIGURED_URL } from './test-env';

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
    '20 Rezepte gratis als PDF',
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
  const bereich = page.locator('#warteliste');
  const knopf = page.locator('#eintragen');
  const meldung = bereich.getByRole('status');

  const email = bereich.getByLabel('E-Mail-Adresse');
  const haken = bereich.getByRole('checkbox');
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
    headers: { origin: CONFIGURED_URL },
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

test('Gratis-Rezepte: Vorschaubild, Pflicht-Einwilligung, Newsletter freiwillig und nicht vorausgewählt', async ({
  page,
}) => {
  await page.goto('/#gratis-rezepte');
  const bereich = page.locator('#gratis-rezepte');
  // Abschnitt steht direkt vor der Warteliste
  await expect(page.locator('#gratis-rezepte + #warteliste')).toHaveCount(1);
  const bild = bereich.getByRole('img', { name: /Deckblatt des PDFs/ });
  await expect(bild).toBeVisible();
  // lazy geladen: warten, bis das Bild wirklich da ist
  await expect
    .poll(() => bild.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  await expect(bereich.getByTestId('rezepte-einwilligung')).toHaveText(
    LEAD_MAGNET_CONSENT.download,
  );
  await expect(bereich.getByTestId('rezepte-newsletter-text')).toHaveText(
    LEAD_MAGNET_CONSENT.newsletter,
  );
  const email = bereich.getByLabel('E-Mail-Adresse', { exact: true });
  const pflicht = bereich.locator('#rezepte-zustimmung');
  const newsletter = bereich.locator('#rezepte-newsletter');
  const knopf = bereich.getByRole('button', { name: 'Rezepte gratis anfordern' });
  const meldung = bereich.getByRole('status');
  await expect(newsletter).not.toBeChecked();
  await expect(pflicht).not.toBeChecked();

  await knopf.click();
  await expect(meldung).toHaveText('Bitte gib eine gültige E-Mail-Adresse ein.');
  await expect(email).toBeFocused();
  await email.fill('lena@beispiel.de');
  // Nur Newsletter ohne Pflicht-Häkchen reicht nicht
  await newsletter.check();
  await knopf.click();
  await expect(meldung).toHaveText(
    'Bitte bestätige, dass wir dir den Download-Link schicken dürfen.',
  );
  await expect(pflicht).toBeFocused();
  await expect(pflicht).toHaveAttribute('aria-invalid', 'true');

  // Ohne Newsletter: newsletter=false wird geschickt; ohne Einstellungen „bald verfügbar“
  await newsletter.uncheck();
  await pflicht.check();
  const anfrage = page.waitForRequest('**/api/gratis-rezepte');
  const antwort = page.waitForResponse('**/api/gratis-rezepte');
  await knopf.click();
  expect((await anfrage).postDataJSON()).toEqual({
    email: 'lena@beispiel.de',
    consent: true,
    newsletter: false,
    website: '',
  });
  expect((await antwort).status()).toBe(503);
  await expect(meldung).toHaveText(
    'Der Download ist bald verfügbar. Bitte versuch es in ein paar Tagen noch einmal.',
  );

  // Mit Newsletter: newsletter=true
  await newsletter.check();
  const anfrage2 = page.waitForRequest('**/api/gratis-rezepte');
  await knopf.click();
  expect((await anfrage2).postDataJSON()).toMatchObject({ newsletter: true });

  // Link zur Datenschutzerklärung (Abschnitt Gratis-Rezepte)
  await expect(bereich.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute(
    'href',
    '/datenschutz#gratis-rezepte',
  );
});

test('Gratis-Rezepte-API: Spamschutz wie Warteliste', async ({ request }) => {
  const fremd = await request.post('/api/gratis-rezepte', {
    data: { email: 'a@b.de', consent: true },
    headers: { origin: 'https://boese.example' },
  });
  expect(fremd.status()).toBe(403);
  const bot = await request.post('/api/gratis-rezepte', {
    data: { email: 'a@b.de', consent: true, website: 'spam' },
    headers: { origin: CONFIGURED_URL },
  });
  expect(bot.status()).toBe(200);
  const ohne = await request.post('/api/gratis-rezepte', {
    data: { email: 'a@b.de', consent: false, newsletter: true },
    headers: { origin: CONFIGURED_URL },
  });
  expect(ohne.status()).toBe(400);
});

test('Gratis-Rezepte: Mail-Link-Seiten, kein Download-Knopf ohne Bestätigung, PDF nicht indexiert', async ({
  page,
  request,
}) => {
  await page.goto(`/gratis-rezepte/bestaetigen#token=${'A'.repeat(43)}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByRole('button', { name: 'Jetzt bestätigen' }).click();
  await expect(page).toHaveURL(/\/gratis-rezepte\/bestaetigen\?ergebnis=inaktiv/);
  await expect(page.getByText('Der Download ist bald verfügbar.', { exact: false })).toBeVisible();

  // Ohne gültigen, signierten Nachweis aus der Bestätigung gibt es keinen Download-Knopf
  for (const adresse of [
    '/gratis-rezepte/bestaetigen?ergebnis=ok',
    `/gratis-rezepte/bestaetigen?ergebnis=ok&download=${Date.now() + 60_000}.${'a'.repeat(64)}`,
  ]) {
    await page.goto(adresse);
    // … und auch keinen Dankestext, der eine Bestätigung behauptet (neutral)
    await expect(page.getByRole('status')).toContainText('Wenn du deine Adresse bestätigt hast');
    await expect(page.getByText('Danke!')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'PDF herunterladen' })).toHaveCount(0);
  }

  await page.goto(`/gratis-rezepte/abmelden#token=${'A'.repeat(43)}`);
  await page.getByRole('button', { name: 'Adresse löschen' }).click();
  await expect(page).toHaveURL(/\/gratis-rezepte\/abmelden\?ergebnis=inaktiv/);

  const pdf = await request.get('/downloads/Alpha5-Gratis-Rezepte.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect(pdf.headers()['x-robots-tag']).toContain('noindex');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('Rechtsseiten verlinkt im Fuß, ohne Entwurfs-Hinweis', async ({ page }) => {
  await page.goto('/');
  for (const [link, titel] of [
    ['Impressum', 'Impressum'],
    ['Datenschutz', 'Datenschutzerklärung'],
    ['AGB', 'Allgemeine Geschäftsbedingungen'],
  ] as const) {
    await page.getByRole('contentinfo').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: titel })).toBeVisible();
    await expect(page.getByText('Stand: Oktober 2026')).toBeVisible();
    await expect(page.getByText(/vor Livegang/)).toHaveCount(0);
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
  expect(robots).toContain('Disallow: /gratis-rezepte/');
  // PDF nicht per robots sperren – sonst sehen Suchmaschinen das X-Robots-Tag: noindex nicht
  expect(robots).not.toContain('/downloads/');
  expect(robots).toContain('Sitemap: https://fitnessapp-web-eight.vercel.app/sitemap.xml');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const pfad of ['', '/impressum', '/datenschutz', '/agb']) {
    expect(sitemap).toContain(`<loc>https://fitnessapp-web-eight.vercel.app${pfad}</loc>`);
  }
  expect(sitemap).not.toContain('/admin');
});
