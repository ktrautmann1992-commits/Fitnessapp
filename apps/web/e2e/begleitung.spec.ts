/// <reference types="node" />
import { expect, test } from '@playwright/test';

/**
 * Begleit-Seite der Live-Begleitung (docs/PLAN-PHASE-10.md 21.3) – Handy-Ansicht 390 × 844, Server ohne Supabase:
 * Demo (#t=demo), ungültiger Link, echtes Token (→ „gerade nicht verfügbar“), noindex/no-referrer/no-store, keine
 * Cookies, Token nie in der Adresse einer Anfrage. Karte und Kacheln kommen von außen und werden hier blockiert.
 */

test.beforeEach(async ({ page }) => {
  await page.route(/jsdelivr\.net|openfreemap\.org|openstreetmap\.org/, (route) => route.abort());
});

test('ohne Token: eine Meldung ohne Ort, nicht indexiert, keine Cookies', async ({
  page,
  context,
}) => {
  const response = await page.goto('/begleitung');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  expect(response?.headers()['cache-control']).toContain('no-store');
  expect(response?.headers()['set-cookie']).toBeUndefined();
  await expect(page.getByTestId('begleitung-titel')).toHaveText(
    'Diese Live-Begleitung ist beendet.',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByTestId('begleitung-karte')).toHaveCount(0);
  await expect(page.getByTestId('begleitung-notfall')).toContainText('112');
  expect(await context.cookies()).toEqual([]);
});

test('Demo: Name, Sportart, „zuletzt aktualisiert“, Karten-App, Notruf-Hinweis', async ({
  page,
}) => {
  await page.goto('/begleitung#t=demo');
  await expect(page.getByTestId('begleitung-demo')).toBeVisible();
  await expect(page.getByTestId('begleitung-titel')).toHaveText('Alex (Demo) ist unterwegs');
  await expect(page.getByTestId('begleitung-sportart')).toHaveText('Laufen');
  await expect(page.getByTestId('begleitung-seit')).toContainText('läuft seit 25 Min');
  await expect(page.getByTestId('begleitung-aktualisiert')).toContainText(
    'zuletzt aktualisiert vor',
  );
  await expect(page.getByTestId('begleitung-kartenapp')).toHaveAttribute(
    'href',
    /^https:\/\/www\.openstreetmap\.org\/\?mlat=50\.9\d+&mlon=6\.9\d+/,
  );
  await expect(page.getByTestId('begleitung-notfall')).toContainText('Im Notfall immer 112');
  // Keine Gesundheits- oder Leistungswerte auf der Seite.
  await expect(page.getByTestId('begleitung')).not.toContainText(/Puls|kcal|Pace|km\/h|Gewicht/);
});

test('echtes Token: Abfrage per POST mit Token im Körper, nie in der Adresse', async ({ page }) => {
  const token = 'A'.repeat(42) + 'A';
  const request = page.waitForRequest((r) => r.url().endsWith('/api/begleitung'));
  await page.goto(`/begleitung#t=${token}`);
  const sent = await request;
  expect(sent.method()).toBe('POST');
  expect(sent.url()).not.toContain(token);
  expect(sent.postDataJSON()).toEqual({ token });
  expect(sent.headers()['referer']).toBeUndefined();
  // Server ohne Supabase-Einstellungen.
  await expect(page.getByTestId('begleitung-titel')).toHaveText(
    'Die Live-Begleitung ist gerade nicht verfügbar.',
  );
});

test('API: nur POST, no-store, nicht eingerichtet → 503', async ({ request }) => {
  const post = await request.post('/api/begleitung', { data: { token: 'x' } });
  expect(post.status()).toBe(503);
  expect(await post.json()).toEqual({ state: 'unavailable' });
  expect(post.headers()['cache-control']).toContain('no-store');
  expect(post.headers()['x-robots-tag']).toBe('noindex, nofollow');
  const get = await request.get('/api/begleitung');
  expect(get.status()).toBe(405);
});

test('robots.txt sperrt /begleitung', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /begleitung');
});
