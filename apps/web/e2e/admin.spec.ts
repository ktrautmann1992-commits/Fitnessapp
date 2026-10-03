/// <reference types="node" />
import { expect, type Page, test } from '@playwright/test';

import { CONFIGURED_URL, E2E_ADMIN_PASSWORD, LOCKED_URL } from './test-env';

/** Redaktionsbereich (Stufe A) gegen `next start` – Handy-Ansicht 390 × 844. */

async function login(page: Page, password = E2E_ADMIN_PASSWORD) {
  await page.goto('/admin/login');
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}

test.describe('ohne Zugangsdaten', () => {
  test('ist gesperrt: „Redaktionsbereich nicht eingerichtet“, auch Unterseiten und Login', async ({
    page,
    request,
  }) => {
    const response = await page.goto(`${LOCKED_URL}/admin`);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
    await expect(
      page.getByRole('heading', { name: 'Redaktionsbereich nicht eingerichtet' }),
    ).toBeVisible();
    await expect(
      page.getByText('ADMIN_PASSWORD fehlt oder ist kürzer als 20 Zeichen.'),
    ).toBeVisible();
    await expect(page.getByText('Teil G')).toBeVisible();

    await page.goto(`${LOCKED_URL}/admin/uebungen/goblet-kniebeuge`);
    await expect(page).toHaveURL(`${LOCKED_URL}/admin`);
    await expect(
      page.getByRole('heading', { name: 'Redaktionsbereich nicht eingerichtet' }),
    ).toBeVisible();

    await page.goto(`${LOCKED_URL}/admin/login`);
    await expect(
      page.getByRole('heading', { name: 'Redaktionsbereich nicht eingerichtet' }),
    ).toBeVisible();
    await expect(page.getByLabel('Passwort')).toHaveCount(0);

    // Auch ein direkter Login-Versuch setzt kein Cookie.
    const post = await request.post(`${LOCKED_URL}/admin/api/login`, {
      form: { password: '' },
      headers: { origin: LOCKED_URL },
      maxRedirects: 0,
    });
    expect(post.status()).toBe(303);
    expect(post.headers()['set-cookie']).toBeUndefined();
  });
});

test.describe('mit Zugangsdaten', () => {
  test('ohne Anmeldung: jede Admin-Seite führt zum Login (noindex)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await page.goto('/admin/vorlagen/muskelaufbau-einsteiger-3t-studio');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto('/admin/uebungen/goblet-kniebeuge');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('gefälschtes Cookie wird abgelehnt', async ({ page, context }) => {
    await context.addCookies([
      {
        name: '__Secure-fitnessapp-admin',
        value: `v1.${Date.now() + 3_600_000}.AAAAAAAAAAAAAAAAAAAAAA.${'A'.repeat(43)}`,
        domain: 'localhost',
        path: '/admin',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    expect(await context.cookies()).toHaveLength(1);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('falsches Passwort: Zugang verweigert, mit Verzögerung, kein Cookie', async ({
    page,
    context,
  }) => {
    const started = Date.now();
    await login(page, 'falsches-passwort-123456789');
    await expect(page.getByText('Zugang verweigert – das Passwort stimmt nicht.')).toBeVisible();
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(await context.cookies()).toEqual([]);
  });

  test('Login-Anfrage von fremder Website wird abgelehnt (Origin-Prüfung)', async ({ request }) => {
    const response = await request.post('/admin/api/login', {
      form: { password: E2E_ADMIN_PASSWORD },
      headers: { origin: 'https://boese.example' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['set-cookie']).toBeUndefined();
    const noOrigin = await request.post('/admin/api/login', {
      form: { password: E2E_ADMIN_PASSWORD },
      maxRedirects: 0,
    });
    expect(noOrigin.status()).toBe(403);
  });

  test('richtiges Passwort: Cookie-Flags, Übersicht, Filter, Details, Abmelden', async ({
    page,
    context,
  }) => {
    await login(page);
    await expect(page).toHaveURL(/\/admin$/);

    // Cookie: HttpOnly, Secure, SameSite=Strict, Path=/admin, ca. 8 Stunden.
    const cookies = await context.cookies(`${CONFIGURED_URL}/admin`);
    expect(cookies).toHaveLength(1);
    const cookie = cookies[0]!;
    expect(cookie).toMatchObject({
      name: '__Secure-fitnessapp-admin',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/admin',
    });
    const hours = (cookie.expires * 1000 - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(7.9);
    expect(hours).toBeLessThanOrEqual(8);
    // Das Cookie gilt nur unter /admin.
    expect(await context.cookies(`${CONFIGURED_URL}/`)).toEqual([]);

    // Übersicht: 52 Übungen, 24 Vorlagen.
    await expect(page.getByRole('heading', { name: 'Inhalte prüfen' })).toBeVisible();
    await expect(page.getByText('52 Übungen · 24 Vorlagen')).toBeVisible();
    await expect(page.getByText('Testansicht – Inhalte aus dem Repository')).toBeVisible();
    const exerciseCards = page.getByRole('list', { name: 'Übungen' }).getByRole('listitem');
    await expect(exerciseCards).toHaveCount(52);
    await expect(exerciseCards.first().getByText('KI-Entwurf – fachlich prüfen')).toBeVisible();
    await expect(page.getByText('52 Entwürfe · 0 freigegeben · 0 zurückgezogen')).toBeVisible();

    // Filter: Bewegungsmuster Kniebeuge.
    await page.getByText('Suche und Filter').click();
    await page.getByLabel('Bewegungsmuster').selectOption('squat');
    await page.getByRole('button', { name: 'Anwenden' }).click();
    await expect(page.getByTestId('trefferzahl')).toHaveText('4 von 52 Treffern');
    await expect(exerciseCards).toHaveCount(4);
    await expect(page.getByLabel(/IDs dieser Trefferliste/)).toHaveValue(/kniebeuge-langhantel/);

    // Suche ohne Treffer → Leerzustand.
    await page.goto('/admin?q=gibtsnicht');
    await expect(page.getByRole('heading', { name: 'Keine Treffer' })).toBeVisible();
    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click();
    await expect(exerciseCards).toHaveCount(52);

    // Detail Übung mit Alternativen (verlinkt).
    await page.getByRole('link', { name: /Kniebeuge mit Langhantel/ }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Kniebeuge mit Langhantel' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prüfbericht' })).toBeVisible();
    await expect(
      page.getByText('Keine Befunde – alle automatischen Prüfungen bestanden.'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'So steht es später in der App' }),
    ).toBeVisible();
    await expect(
      page.getByText('nein – vor dem öffentlichen Start von einer Fachperson prüfen lassen'),
    ).toBeVisible();
    await expect(page.getByLabel('ID dieser Übung (1)')).toHaveValue('kniebeuge-langhantel');
    await page.getByRole('link', { name: 'Goblet-Kniebeuge', exact: false }).first().click();
    await expect(page).toHaveURL(/\/admin\/uebungen\/goblet-kniebeuge$/);

    // Vorlagen: 24, Filter Ziel/Ort, Detail mit Woche und Wochensätzen.
    await page.goto('/admin?tab=vorlagen');
    const templateCards = page.getByRole('list', { name: 'Plan-Vorlagen' }).getByRole('listitem');
    await expect(templateCards).toHaveCount(24);
    await page.goto('/admin?tab=vorlagen&ziel=muscle_gain&ort=home');
    await expect(templateCards).toHaveCount(4);
    await page.goto('/admin/vorlagen/muskelaufbau-fortgeschritten-3t-studio');
    await expect(page.getByRole('heading', { name: 'Wochenübersicht' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wochensätze pro Muskelgruppe' })).toBeVisible();
    await expect(page.getByText(/^Gelb · V11/).first()).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Übungen Tag 1' }).getByRole('listitem').first(),
    ).toBeVisible();

    // Unbekannte ID → „nicht gefunden“.
    await page.goto('/admin/uebungen/gibt-es-nicht');
    await expect(page.getByRole('heading', { name: 'Inhalt nicht gefunden' })).toBeVisible();

    // Abmelden → Login, Cookie weg, Admin wieder gesperrt.
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/admin\/login\?abgemeldet=1$/);
    await expect(page.getByText('Du bist abgemeldet.')).toBeVisible();
    expect(await context.cookies()).toEqual([]);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
  });
});
