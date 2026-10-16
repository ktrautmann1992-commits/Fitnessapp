import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, openNutrition, patchDb, type StoredDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Etappe E3 im TESTMODUS mit Attrappe (docs/PLAN-AUSWERTUNG.md Abschnitt 9, „So testet ihr es am Handy“ Punkt 1):
 * Ernährung → Eintragen → „Per Foto“ → Einwilligung → Foto wählen (echte Bilddatei, im Browser verkleinert) →
 * Beispielantwort „Schätzung – bitte prüfen“ → zuordnen, Menge ändern, Bestandteil entfernen → Eintragen (Herkunft
 * photo); Abbrechen speichert nichts; Limit erreicht (Tag und Monat); offline. Fester Start: Montag, 12.10.2026, 9 Uhr.
 */

/** 64 × 48 PNG (grün) – wird im Browser auf einer Zeichenfläche neu als JPEG gespeichert (ohne Metadaten). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAU0lEQVR4nO3PQQ3AIADAQEAXSlCH1IngcVnSU9DOc/f4s6UDXjWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaB9v/ABlhcjWXgAAAAASUVORK5CYII=',
  'base64',
);

interface StoredEntry {
  source: string;
  food_id: string | null;
  amount: number | null;
  unit: string | null;
  slot: string;
}

const entries = async (page: Page) => ((await db(page)).rows.foodLogEntries ?? []) as StoredEntry[];
const usage = async (page: Page) =>
  ((await db(page)) as StoredDb & { aiUsage?: { status: string }[] }).aiUsage ?? [];

async function openPhoto(page: Page) {
  await page.getByTestId('food-log').getByTestId('food-log-add').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
  await page.getByTestId('food-log-photo').click();
  await expect(page.getByTestId('food-photo')).toBeVisible();
}

async function start(page: Page) {
  await onboardNutrition(page);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await openNutrition(page);
}

/** Foto-Einwilligung und ggf. Nutzung direkt in den Gerätespeicher (Testmodus) – nur Metadaten wie ai_usage. */
async function seed(page: Page, rows: { created_at: string; status: string }[]) {
  await patchDb(page, (value) => {
    const consents = value.rows.consents as { user_id: string }[];
    const user = consents[0]?.user_id ?? '';
    return {
      ...value,
      rows: {
        ...value.rows,
        consents: [
          ...consents,
          {
            id: 'c-photo',
            user_id: user,
            consent_type: 'ai_food_photo',
            version: 1,
            granted_at: '2026-10-12T07:00:00.000Z',
            revoked_at: null,
            platform: 'web',
          },
        ],
      },
      aiUsage: rows.map((row, i) => ({
        id: `u${i}`,
        user_id: user,
        feature: 'food_photo',
        model: 'attrappe',
        input_tokens: 1,
        output_tokens: 1,
        cost_eur: 0,
        finished_at: row.created_at,
        ...row,
      })),
    } as StoredDb;
  });
  await page.getByTestId('today-nutrition').click();
  await expect(page.getByTestId('nutrition-day')).toBeVisible();
}

test('Per Foto: Einwilligung, Foto, Vorschlag ändern, eintragen; Abbrechen speichert nichts', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await start(page);
  await openPhoto(page);

  // Beim ersten Mal: eigene Einwilligung (A-G17).
  await expect(page.getByTestId('food-photo-consent')).toContainText('Google');
  await page.getByTestId('food-photo-consent-read').click();
  await expect(
    page.getByRole('heading', { name: 'Einwilligung: Gerichte per Foto auswerten' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await page.getByTestId('food-photo-consent-accept').click();

  await expect(page.getByTestId('food-photo-remaining')).toHaveText(
    'Noch 30 Fotos in diesem Monat · heute noch 8',
  );
  await expect(page.getByTestId('food-photo-mock')).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Mahlzeit' })
    .getByRole('radio', { name: 'Mittag' })
    .click();
  await page.getByTestId('food-photo-note').fill('halbe Portion');

  // Foto wählen (Dateiauswahl des Browsers).
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('food-photo-pick').click();
  await (await chooser).setFiles({ name: 'teller.png', mimeType: 'image/png', buffer: PNG });

  await expect(page.getByTestId('food-photo-estimate')).toContainText('Schätzung – bitte prüfen');
  await expect(page.getByTestId(/^food-photo-item-\d+$/)).toHaveCount(4);
  await expect(page.getByTestId('food-photo-item-0')).toContainText('Hähnchenbrust');
  await expect(page.getByTestId('food-photo-item-1')).toContainText('Reis parboiled');
  await expect(page.getByTestId('food-photo-item-3')).toContainText('Bitte auswählen');

  // Ohne Zuordnung kein Eintragen.
  await page.getByTestId('food-photo-submit').click();
  await expect(page.getByTestId('food-photo-message')).toContainText('Bitte zuerst');
  expect(await entries(page)).toHaveLength(0);

  // „Helle Soße“ → Olivenöl wählen, Menge Hähnchen 120 g, Paprika entfernen.
  await page.getByTestId('food-photo-choose-3-search').fill('Oliven');
  await page.getByTestId('food-photo-choose-3-option-0').click();
  await expect(page.getByTestId('food-photo-item-3')).not.toContainText('Bitte auswählen');
  await page.getByTestId('food-photo-amount-0').fill('120');
  await page.getByTestId('food-photo-remove-2').click();
  await expect(page.getByTestId(/^food-photo-item-\d+$/)).toHaveCount(3);
  await page.getByTestId('food-photo-submit').click();
  await expect(page.getByTestId('food-photo-message')).toHaveText('3 Bestandteile eingetragen.');

  const saved = await entries(page);
  expect(saved.map((e) => [e.source, e.food_id, e.amount, e.unit, e.slot])).toEqual([
    ['photo', 'haehnchenbrust', 120, 'g', 'lunch'],
    ['photo', 'reis', 180, 'g', 'lunch'],
    ['photo', 'olivenoel', 40, 'g', 'lunch'],
  ]);
  // Nur Metadaten gespeichert – nie die Info oder das Bild.
  expect((await usage(page)).map((u) => u.status)).toEqual(['succeeded']);
  const stored = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(stored).not.toContain('halbe Portion');
  expect(stored).not.toContain('Hähnchenbrust gegrillt');

  // Noch ein Foto (Beispielfoto) → Abbrechen speichert nichts.
  await page.getByTestId('food-photo-again').click();
  await expect(page.getByTestId('food-photo-remaining')).toHaveText(
    'Noch 29 Fotos in diesem Monat · heute noch 7',
  );
  await page.getByTestId('food-photo-example').click();
  await expect(page.getByTestId('food-photo-estimate')).toBeVisible();
  await page.getByTestId('food-photo-cancel').click();
  await expect(page.getByTestId('food-photo-message')).toHaveText(
    'Abgebrochen – es wurde nichts gespeichert.',
  );
  expect(await entries(page)).toHaveLength(3);

  // Kein Essen erkannt (Testfall der Attrappe).
  await page.getByTestId('food-photo-note').fill('test:leer');
  await page.getByTestId('food-photo-example').click();
  await expect(page.getByTestId('food-photo-message')).toContainText('kein Essen');

  // Zum Tagesverlauf: Einträge stehen dort.
  await page.getByTestId('food-photo-done').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
});

test('Per Foto: Tages- und Monatslimit erreicht, Eintragen per Hand bleibt', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await seed(
    page,
    Array.from({ length: 8 }, () => ({
      created_at: '2026-10-12T06:00:00.000Z',
      status: 'succeeded',
    })),
  );
  await openPhoto(page);
  await expect(page.getByTestId('food-photo-state')).toHaveText(
    'Für heute sind keine Fotos mehr möglich, ab morgen wieder. Eintragen per Hand geht weiter.',
  );
  await expect(page.getByTestId('food-photo-pick')).toHaveCount(0);

  await seed(
    page,
    Array.from({ length: 30 }, (_, i) => ({
      created_at: `2026-10-${String((i % 10) + 1).padStart(2, '0')}T08:00:00.000Z`,
      status: 'succeeded',
    })),
  );
  await openPhoto(page);
  await expect(page.getByTestId('food-photo-state')).toHaveText(
    'Dein Kontingent für Fotos ist diesen Monat aufgebraucht, ab 1. November wieder verfügbar. Eintragen per Hand geht weiter.',
  );
  await page.getByTestId('food-photo-manual').click();
  await expect(page.getByTestId('food-log-entry')).toBeVisible();
});

test('Per Foto: offline ein klarer Hinweis, kein Aufruf', async ({ page, context }) => {
  test.setTimeout(180_000);
  await start(page);
  await seed(page, []);
  await context.setOffline(true);
  await openPhoto(page);
  await expect(page.getByTestId('food-photo-state')).toHaveText(
    'Fotos brauchen Internet – trag es per Hand ein oder später.',
  );
  await expect(page.getByTestId('food-photo-pick')).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.getByTestId('food-photo-pick')).toBeVisible();
  expect(await usage(page)).toEqual([]);

  // Widerruf in den Einstellungen → „Per Foto“ fragt wieder nach der Einwilligung.
  await page.goto('/settings');
  await expect(page.getByTestId('settings-photo-consent')).toContainText('Version 1');
  await page.getByTestId('settings-photo-revoke').click();
  await page.getByTestId('dialog-revoke_photo').getByRole('button', { name: 'Widerrufen' }).click();
  await expect(page.getByText('Einwilligung „Gerichte per Foto“ widerrufen.')).toBeVisible();
  await page.goto('/ernaehrung/foto');
  await expect(page.getByTestId('food-photo-consent')).toBeVisible();
});
