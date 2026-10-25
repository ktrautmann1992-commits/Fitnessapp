import { mkdirSync, readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { db, onboardNutrition, patchDb } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Gewichtstrend, Monatsrückblick, Trainings im Handy-Kalender (docs/PLAN-TREND-RUECKBLICK-KALENDER.md) im TESTMODUS,
 * Web-Export, Handy-Ansicht 390 px. Person aus `onboardNutrition` (Frau, 170 cm, 70 kg, Abnehmen, Einwilligung),
 * fester Tag Montag 12.10.2026. Bildschirmfotos (optional) nach SCREENSHOT_DIR.
 */

const SHOTS = process.env.SCREENSHOT_DIR ?? null;

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

type MetricRow = Record<string, unknown> & { measured_on: string; weight_kg: number | null };

function iso(base: string, offset: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Tägliche Gewichte über `days` Tage bis 11.10.2026, linear mit `kgPerWeek`, ±0,4 kg Schwankung. */
async function seedWeights(page: Page, start: number, kgPerWeek: number, days = 40) {
  await patchDb(page, (value) => {
    const existing = (value.rows.bodyMetrics as MetricRow[]) ?? [];
    const template = existing[0] ?? {};
    const seeded: MetricRow[] = Array.from({ length: days }, (_, i) => ({
      ...template,
      id: `seed-${i}`,
      measured_on: iso('2026-10-11', i - days + 1),
      height_cm: null,
      weight_kg: Math.round((start + (kgPerWeek / 7) * i + (i % 2 === 0 ? 0.4 : -0.4)) * 10) / 10,
      body_fat_pct: null,
      resting_heart_rate_bpm: null,
    }));
    return { ...value, rows: { ...value.rows, bodyMetrics: [...seeded, ...existing] } };
  });
}

async function openProgress(page: Page) {
  await page.goto('/fortschritt');
  await expect(page.getByTestId('progress')).toBeVisible();
}

async function setWeightGoal(page: Page, kg: string, weeks: string) {
  await page.goto('/abnehmziel');
  await page.getByTestId('weight-goal-settings-set').click();
  await heading(page, 'Wie möchtest du abnehmen?');
  await page.getByRole('radio', { name: 'Mit konkretem Ziel' }).click();
  await page.getByLabel('kg abnehmen ab heute').fill(kg);
  await page.getByLabel('Wochen', { exact: true }).fill(weeks);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('weight-goal-settings-target')).toBeVisible();
}

test.describe('Gewichtstrend', () => {
  test.setTimeout(180_000);

  test('Linie, Tempo und vorsichtige Schätzung zum Wunschgewicht; ausblenden', async ({ page }) => {
    await onboardNutrition(page);
    await seedWeights(page, 73, -0.4);
    await setWeightGoal(page, '3', '20');
    await openProgress(page);
    const tile = page.getByTestId('weight-trend');
    await expect(tile.getByTestId('weight-trend-chart')).toBeVisible();
    await expect(tile.getByTestId('weight-trend-latest')).toHaveText(
      /^Trend: \d+,\d kg \(Stand 12\.10\.2026\)$/,
    );
    await expect(tile.getByTestId('weight-trend-rate')).toHaveText(/kg pro Woche weniger/);
    await expect(tile.getByTestId('weight-trend-forecast')).toContainText('grobe Schätzung');
    await expect(tile.getByTestId('weight-trend-too-fast')).toHaveCount(0);
    await tile.scrollIntoViewIfNeeded();
    await shot(page, '01-fortschritt-gewichtstrend');

    await tile.getByTestId('weight-trend-hide').click();
    await expect(page.getByTestId('weight-trend-hidden')).toBeVisible();
    await expect(page.getByTestId('weight-trend-chart')).toHaveCount(0);
    await page.getByTestId('weight-trend-show').click();
    await expect(page.getByTestId('weight-trend-chart')).toBeVisible();
  });

  test('zu schnell: Hinweis mit Hilfe-Stellen, keine Schätzung', async ({ page }) => {
    await onboardNutrition(page);
    await seedWeights(page, 78, -1.5);
    await setWeightGoal(page, '3', '20');
    await openProgress(page);
    const tile = page.getByTestId('weight-trend');
    await expect(tile.getByTestId('weight-trend-too-fast')).toContainText('schneller als etwa 1 %');
    await expect(tile.getByTestId('weight-trend-rate')).toHaveCount(0);
    await expect(tile.getByTestId('weight-trend-forecast')).toHaveCount(0);
    await tile.getByTestId('weight-trend-too-fast').scrollIntoViewIfNeeded();
    await shot(page, '02-gewichtstrend-zu-schnell');
  });

  test('„Kalorienzahlen anzeigen“ aus: Gewichtstrend ausgeblendet; nur ein Wert: keine Linie', async ({
    page,
  }) => {
    await onboardNutrition(page);
    await openProgress(page);
    await expect(page.getByTestId('weight-trend-latest')).toContainText('70 kg');
    await expect(page.getByTestId('weight-trend-chart')).toHaveCount(0);
    await patchDb(page, (value) => ({
      ...value,
      rows: {
        ...value.rows,
        nutritionSetup: {
          ...(value.rows.nutritionSetup as Record<string, unknown>),
          show_energy_numbers: false,
        },
      },
    }));
    await openProgress(page);
    await expect(page.getByTestId('weight-trend-hidden-numbers')).toBeVisible();
    await expect(page.getByTestId('weight-trend-latest')).toHaveCount(0);
  });
});

test.describe('Monatsrückblick', () => {
  test.setTimeout(180_000);

  test('Angebot am Monatsanfang, Rückblick, PDF ohne und mit Gesundheitsdaten', async ({
    page,
  }) => {
    await onboardNutrition(page);
    await seedWeights(page, 73, -0.4);
    // Geplante Einheiten im Oktober (ab Plan-Start 12.10.); ohne Eintrag zählen sie als ausgelassen.
    const stored = await db(page);
    const sessions = (stored.rows.plannedSessions as { id: string; scheduled_on: string }[])
      .filter((s) => s.scheduled_on >= '2026-10-12' && s.scheduled_on <= '2026-10-31')
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on));
    expect(sessions.length).toBeGreaterThan(2);
    // Zum 2. November springen: Oktober ist vorbei.
    await page.clock.setFixedTime(new Date('2026-11-02T09:00:00+01:00'));
    await openProgress(page);
    const offer = page.getByTestId('month-review-offer');
    await expect(offer).toContainText('Dein Rückblick auf Oktober 2026 ist da');
    await shot(page, '03-fortschritt-angebot-rueckblick');
    await offer.getByTestId('month-review-offer-open').click();
    await expect(page.getByTestId('month-review')).toBeVisible();
    await expect(page.getByTestId('month-review-training')).toContainText(
      new RegExp(`0 von ${sessions.length} geplanten Einheiten gemacht`),
    );
    await expect(page.getByTestId('month-review-training')).toContainText(
      `${sessions.length} Einheiten ausgelassen`,
    );
    await expect(page.getByTestId('month-review-weight')).toContainText('Trend am 01.10.2026');
    await expect(page.getByTestId('month-review-food')).toContainText('von 31 Tagen');
    // Keine Serien, kein Lob, keine Prognose.
    await expect(page.getByTestId('month-review')).not.toContainText(
      /Serie|Streak|Wunschgewicht|pro Woche/,
    );
    await shot(page, '04-monatsrueckblick');

    // Angebot ist nach dem Öffnen weg.
    await openProgress(page);
    await expect(page.getByTestId('month-review-offer')).toHaveCount(0);
    await expect(page.getByTestId('progress-month-review')).toBeVisible();

    await page.goto('/monatsrueckblick?monat=2026-10');
    await page.getByTestId('month-review-pdf').click();
    await expect(page.getByTestId('month-review-print')).toBeVisible();
    const preview = page.locator('#root .a5-print-preview');
    await expect(preview).toContainText('Dein Monatsrückblick');
    await expect(preview).toContainText('Essen und Gewicht sind nicht enthalten');
    await expect(preview).not.toContainText('Trend am 01.10.2026');
    await shot(page, '05-rueckblick-pdf-ohne-gesundheit');

    await page.getByTestId('month-review-print-health').click();
    await page.getByRole('button', { name: 'Aufnehmen' }).click();
    await expect(preview).toContainText('Trend am 01.10.2026');
    await expect(preview).not.toContainText('nicht enthalten');
    if (SHOTS)
      await preview.screenshot({ path: `${SHOTS}/05b-rueckblick-pdf-vorschau-mit-gesundheit.png` });

    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await page.getByTestId('print-button').click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(
      1,
    );
  });

  test('ohne Einwilligung in Gesundheitsdaten: kein Gewicht, kein Essen', async ({ page }) => {
    await onboardNutrition(page);
    await patchDb(page, (value) => ({
      ...value,
      rows: {
        ...value.rows,
        consents: (value.rows.consents as { consent_type: string }[]).filter(
          (c) => c.consent_type !== 'health_data',
        ),
      },
    }));
    await page.goto('/monatsrueckblick?monat=2026-10');
    await expect(page.getByTestId('month-review')).toBeVisible();
    await expect(page.getByTestId('month-review-weight')).toHaveCount(0);
    await expect(page.getByTestId('month-review-food')).toContainText('Einwilligung');
  });
});

test.describe('Trainings im Handy-Kalender (Browser: .ics-Datei)', () => {
  test.setTimeout(180_000);

  test('Einstellungen → Kalender-Datei mit „Alpha5: …“-Terminen ohne Gesundheitsangaben', async ({
    page,
  }) => {
    await onboardNutrition(page);
    await page.goto('/settings');
    await page.getByTestId('settings-device-calendar').click();
    await expect(page.getByTestId('device-calendar')).toBeVisible();
    await expect(page.getByTestId('device-calendar-web')).toContainText('.ics');
    await shot(page, '06-handy-kalender-web');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('device-calendar-download').click(),
    ]);
    expect(download.suggestedFilename()).toBe('alpha5-training.ics');
    const ics = readFileSync((await download.path()) as string, 'utf8');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toMatch(/SUMMARY:Alpha5: Ganzkörper [A-C]/);
    // Trainingszeit „Abends“ aus dem Setup → 17:30.
    expect(ics).toMatch(/DTSTART:20261012T173000/);
    expect(ics).not.toMatch(/kg|Gewicht|schwanger|Zyklus|DESCRIPTION|LOCATION/i);
    await expect(page.getByTestId('device-calendar-message')).toContainText('Datei mit');

    // Eigene Uhrzeit wählen → neue Datei mit 07:00.
    await page.getByRole('radio', { name: '07:00 Uhr' }).click();
    const [second] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('device-calendar-download').click(),
    ]);
    expect(readFileSync((await second.path()) as string, 'utf8')).toMatch(
      /DTSTART:20261012T070000/,
    );
  });
});
