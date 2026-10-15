import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Trainingskalender (docs/PLAN-AUSWERTUNG.md 3, Etappe A1a) im TESTMODUS, Web-Export, Handy-Ansicht, festes Datum
 * Montag, 05.10.2026 (Europe/Berlin). Plan: Kraft im Studio Di + Fr (Ganzkörper, Einsteiger).
 * Woche 05.–11.10.: Di 06. und Fr 09. belegt; Folgewoche Di 13.
 * Für die Di-Einheit gilt laut packages/core: Mo/Mi/So frei, Do/Sa zu nah am Freitag (48 h), Fr = tauschen.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const MONDAY = new Date('2026-10-05T09:00:00+02:00');
const DI = '2026-10-06';
const MI = '2026-10-07';
const DO = '2026-10-08';
const FR = '2026-10-09';
const SO = '2026-10-11';

interface StoredRows {
  plannedSessions: {
    id: string;
    scheduled_on: string;
    original_date: string | null;
    status: string;
  }[];
}

async function sessions(page: Page) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const rows = (JSON.parse(raw ?? '{}') as { rows: StoredRows }).rows;
  return rows.plannedSessions
    .filter((s) => s.scheduled_on >= '2026-10-05' && s.scheduled_on <= '2026-10-11')
    .map((s) => ({ date: s.scheduled_on, original: s.original_date, status: s.status, id: s.id }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Griff ⠿ lange drücken und auf die Mitte eines anderen Tages ziehen (wie mit dem Finger). */
async function dragTo(page: Page, from: string, to: string, beforeDrop?: () => Promise<void>) {
  const handle = page.getByTestId(`calendar-handle-${from}`);
  const target = page.getByTestId(`calendar-day-${to}`);
  // Wie am Handy: erst so scrollen, dass Start- und Zieltag sichtbar sind (kein Auto-Scroll beim Ziehen).
  await page
    .getByTestId(`calendar-day-${from < to ? from : to}`)
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  // Die Karte gleitet nach dem letzten Ablegen kurz zurück – erst messen, wenn sie ruht.
  let start = await handle.boundingBox();
  await expect
    .poll(async () => {
      const previous = start;
      start = await handle.boundingBox();
      return previous !== null && start !== null && previous.y === start.y;
    })
    .toBe(true);
  const end = await target.boundingBox();
  if (!start || !end) throw new Error('Kalender nicht sichtbar');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  // Langer Druck (DRAG_LONG_PRESS_MS = 400 ms), dann ziehen.
  await page.waitForTimeout(700);
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      start.x + start.width / 2,
      start.y +
        start.height / 2 +
        ((end.y + end.height / 2 - (start.y + start.height / 2)) * i) / steps,
    );
  }
  if (beforeDrop) await beforeDrop();
  await page.mouse.up();
}

async function setup(page: Page) {
  await page.clock.setFixedTime(MONDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Dienstag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.getByTestId('today-calendar').click();
  await heading(page, 'Kalender');
  await expect(page.getByTestId(`calendar-card-${DI}`)).toBeVisible();
  await expect(page.getByTestId(`calendar-card-${FR}`)).toBeVisible();
}

test('Drag-and-drop: erlaubte Tage leuchten, gesperrte zeigen den Grund; verschieben, Rückgängig, tauschen', async ({
  page,
}) => {
  await setup(page);
  const before = await sessions(page);
  expect(before.map((s) => s.date)).toEqual([DI, FR]);

  // Di → Mi: während des Ziehens zeigen die Tage erlaubt/Grund.
  await dragTo(page, DI, MI, async () => {
    await expect(page.getByTestId(`calendar-drop-${MI}`)).toHaveText('✓ Hier ablegen');
    await expect(page.getByTestId(`calendar-drop-${DO}`)).toContainText('Zu nah an deiner Einheit');
    await expect(page.getByTestId(`calendar-drop-${DO}`)).toContainText('am Freitag, 09.10.');
    await expect(page.getByTestId(`calendar-drop-${FR}`)).toContainText('✓ Tauschen mit');
    await expect(page.getByTestId('calendar-drop-2026-10-05')).toHaveText('✓ Hier ablegen');
  });
  await expect(page.getByTestId('calendar-message')).toContainText(
    'Verschoben auf Mittwoch, 07.10.',
  );
  await expect(page.getByTestId(`calendar-card-${MI}`)).toBeVisible();
  await expect(page.getByTestId(`calendar-card-${MI}`)).toContainText('verschoben von Di');
  await expect(page.getByTestId(`calendar-card-${DI}`)).toHaveCount(0);
  // Essensplan-Hinweis (Tagesziele hängen an den Trainingstagen).
  await expect(page.getByTestId('calendar-nutrition-hint')).toContainText(
    'Dein Essensplan passt eventuell nicht mehr',
  );
  let stored = await sessions(page);
  expect(stored.find((s) => s.date === MI)).toMatchObject({ original: DI, status: 'planned' });

  // Rückgängig → wieder Dienstag.
  await page.getByTestId('calendar-undo').click();
  await expect(page.getByTestId('calendar-message')).toContainText('Rückgängig gemacht.');
  await expect(page.getByTestId(`calendar-card-${DI}`)).toBeVisible();
  stored = await sessions(page);
  expect(stored.map((s) => s.date)).toEqual([DI, FR]);

  // Auf einen gesperrten Tag (Do, 48 h vor Freitag) ziehen → nichts passiert, Grund steht da.
  await dragTo(page, DI, DO);
  await expect(page.getByTestId('calendar-message')).toContainText('Nicht verschoben: Zu nah an');
  stored = await sessions(page);
  expect(stored.map((s) => s.date)).toEqual([DI, FR]);

  // Auf einen belegten Tag (Fr) ziehen → beide tauschen (A-G4).
  const [di, fr] = stored;
  await dragTo(page, DI, FR, async () => {
    try {
      await expect(page.getByTestId(`calendar-drop-${FR}`)).toContainText('✓ Tauschen mit');
    } catch (error) {
      // Diagnose für die CI (nur bei Fehlschlag): wo steht die Seite, welche Ziel-Hinweise gibt es?
      const ids = await page
        .locator('[data-testid^="calendar-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
      const boxes = {
        handle: await page.getByTestId(`calendar-handle-${DI}`).boundingBox(),
        target: await page.getByTestId(`calendar-day-${FR}`).boundingBox(),
        label: await page.getByTestId(`calendar-open-day-${DI}`).boundingBox(),
      };
      console.warn('DIAG url', page.url());
      console.warn('DIAG ids', JSON.stringify(ids));
      console.warn('DIAG boxes', JSON.stringify(boxes));
      console.warn(
        'DIAG message',
        await page
          .getByTestId('calendar-message')
          .textContent()
          .catch(() => null),
      );
      throw error;
    }
  });
  await expect(page.getByTestId('calendar-message')).toContainText('Getauscht: jetzt am Freitag');
  stored = await sessions(page);
  expect(stored.find((s) => s.id === di?.id)).toMatchObject({ date: FR, original: DI });
  expect(stored.find((s) => s.id === fr?.id)).toMatchObject({ date: DI, original: FR });
  // Rückgängig tauscht zurück.
  await page.getByTestId('calendar-undo').click();
  await expect(page.getByTestId('calendar-message')).toContainText('Rückgängig gemacht.');
  stored = await sessions(page);
  expect(stored.find((s) => s.id === di?.id)?.date).toBe(DI);
  expect(stored.find((s) => s.id === fr?.id)?.date).toBe(FR);
});

test('„Verschieben …“-Menü: jeder Tag mit „erlaubt“ oder Grund; Auswahl verschiebt, bleibt nach Neuladen', async ({
  page,
}) => {
  await setup(page);
  await page.getByTestId(`calendar-move-${DI}`).click();
  const menu = page.getByTestId('calendar-menu');
  await expect(menu.getByRole('heading')).toContainText('verschieben');
  await expect(
    menu.getByRole('button', { name: /^Montag, 05\.10\.: hierhin verschieben/ }),
  ).toBeEnabled();
  await expect(
    menu.getByRole('button', { name: /^Dienstag, 06\.10\.: Hier liegt die Einheit schon/ }),
  ).toBeDisabled();
  await expect(
    menu.getByRole('button', { name: /^Mittwoch, 07\.10\.: hierhin verschieben/ }),
  ).toBeEnabled();
  await expect(
    menu.getByRole('button', { name: /^Donnerstag, 08\.10\.: Zu nah an deiner Einheit/ }),
  ).toBeDisabled();
  await expect(
    menu.getByRole('button', { name: /^Freitag, 09\.10\.: tauschen mit/ }),
  ).toBeEnabled();
  await expect(
    menu.getByRole('button', { name: /^Samstag, 10\.10\.: Zu nah an deiner Einheit/ }),
  ).toBeDisabled();
  await expect(
    menu.getByRole('button', { name: /^Sonntag, 11\.10\.: hierhin verschieben/ }),
  ).toBeEnabled();

  await menu.getByRole('button', { name: /^Sonntag, 11\.10\./ }).click();
  await expect(page.getByTestId('calendar-menu')).toHaveCount(0);
  await expect(page.getByTestId('calendar-message')).toContainText(
    'Verschoben auf Sonntag, 11.10.',
  );
  // S3: Live-Region (role=status, aria-live=polite) liest die Meldung im Browser vor.
  const status = page.getByRole('status').filter({ hasText: 'Verschoben auf Sonntag' });
  await expect(status).toHaveCount(1);
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId(`calendar-card-${SO}`)).toBeVisible();

  // Neu laden: bleibt verschoben (Gerätespeicher).
  await page.goto('/kalender');
  await heading(page, 'Kalender');
  await expect(page.getByTestId(`calendar-card-${SO}`)).toBeVisible();
  const stored = await sessions(page);
  expect(stored.map((s) => [s.date, s.original])).toEqual([
    [FR, null],
    [SO, DI],
  ]);

  // Abbrechen schließt das Menü ohne Änderung.
  await page.getByTestId(`calendar-move-${SO}`).click();
  await page.getByTestId('calendar-menu').getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByTestId('calendar-menu')).toHaveCount(0);

  // Einstieg auch aus „Woche“.
  await page.goto('/week');
  await heading(page, 'Woche');
  await page.getByTestId('week-calendar').click();
  await heading(page, 'Kalender');
});

test('Plan nicht mehr aktiv: Text ohne falschen Regel-Grund, Plan neu geladen → Einladung', async ({
  page,
}) => {
  await setup(page);
  // Gerätespeicher (= „Server“ im Testmodus) ändert sich hinter dem Rücken der App: Plan nicht mehr aktiv.
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      rows: { plans: { status: string; replaced_at: string | null }[] };
    };
    for (const plan of db.rows.plans) {
      plan.status = 'replaced';
      plan.replaced_at = '2026-10-05T07:00:00.000Z';
    }
    window.localStorage.setItem(key, JSON.stringify(db));
  }, LOCAL_DB);
  await page.getByTestId(`calendar-move-${DI}`).click();
  await page
    .getByTestId('calendar-menu')
    .getByRole('button', { name: /^Mittwoch, 07\.10\./ })
    .click();
  // Nie der Regel-Text für eine andere Ursache; der Plan wird sofort neu geladen → kein aktiver Plan mehr.
  await expect(page.getByTestId('calendar-message')).toHaveText(
    'Das hat nicht geklappt – dein Plan wurde neu geladen. Bitte prüfe den Tag noch einmal.',
  );
  await expect(page.getByRole('heading', { name: 'Noch kein Plan' })).toBeVisible();
  await expect(page.getByTestId('calendar-live')).toHaveText(
    'Das hat nicht geklappt – dein Plan wurde neu geladen. Bitte prüfe den Tag noch einmal.',
  );
  await page.getByTestId('calendar-no-plan').click();
  await heading(page, 'Heute');
});

test('veralteter Stand (S1): anderes Gerät hat verschoben → Tausch abgelehnt, Kalender lädt neu', async ({
  page,
}) => {
  await setup(page);
  // „Anderes Gerät“: Freitags-Einheit liegt inzwischen am Samstag.
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}') as {
      rows: { plannedSessions: { scheduled_on: string; original_date: string | null }[] };
    };
    for (const session of db.rows.plannedSessions) {
      if (session.scheduled_on === '2026-10-09') {
        session.original_date = '2026-10-09';
        session.scheduled_on = '2026-10-10';
      }
    }
    window.localStorage.setItem(key, JSON.stringify(db));
  }, LOCAL_DB);
  // Die App kennt noch den alten Stand und bietet „tauschen mit“ am Freitag an.
  await page.getByTestId(`calendar-move-${DI}`).click();
  await page
    .getByTestId('calendar-menu')
    .getByRole('button', { name: /^Freitag, 09\.10\.: tauschen mit/ })
    .click();
  await expect(page.getByTestId('calendar-message')).toHaveText(
    'Das hat nicht geklappt – dein Plan wurde neu geladen. Bitte prüfe den Tag noch einmal.',
  );
  // Neu geladen: Freitag ist frei, die Einheit steht am Samstag; Dienstag unverändert.
  await expect(page.getByTestId('calendar-card-2026-10-10')).toBeVisible();
  await expect(page.getByTestId(`calendar-card-${FR}`)).toHaveCount(0);
  await expect(page.getByTestId(`calendar-card-${DI}`)).toBeVisible();
  const stored = await sessions(page);
  expect(stored.map((s) => s.date)).toEqual([DI, '2026-10-10']);
});

test('ohne Konto: Kalender leitet zum Einstieg', async ({ page }) => {
  await page.clock.setFixedTime(MONDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/kalender');
  // Ohne Konto/Onboarding leitet die App zum Einstieg.
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
});
