import { expect, test, type Page } from '@playwright/test';

import { heading, onboard } from './plan-helpers';

/**
 * Supplemente (docs/PLAN-PHASE-6.md 8, Etappe SU4) im TESTMODUS, Web-Export, Handy-Ansicht: Übersicht über „Mehr“,
 * Supplement-Check, „Passt zu dir“ mit Menge, Koffein nie „passt“ (Abend-Training), Detail mit Angabe UND
 * Pflichthinweis, Pflichtsätze, kein Testphase-Kennzeichen (27.10.2026), „Nehme ich“, Re-Consent alte Fassung → Fassung 2 ohne
 * Datenverlust, Sperre bei Medikamenten, unter 18, ohne Einwilligung nur allgemeine Infos. Keine Shop-Links.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const NOW = new Date('2026-10-21T09:00:00+02:00');

type Stored = { rows: Record<string, unknown> & { profile: Record<string, unknown> } };

async function patchDb(page: Page, change: (db: Stored) => void) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  const db = JSON.parse(raw ?? '{}') as Stored;
  change(db);
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    LOCAL_DB,
    JSON.stringify(db),
  ] as const);
}

async function setup(page: Page, consent: boolean) {
  await page.clock.install({ time: NOW });
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await onboard(page, {
    consent,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Dienstag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
}

async function openFromMore(page: Page) {
  await page.getByRole('tab', { name: 'Mehr', exact: true }).click();
  await page.getByTestId('more-supplements').click();
  await heading(page, 'Supplemente');
}

async function doCheck(page: Page) {
  await page.getByTestId('supplements-check-start').click();
  await heading(page, 'Supplement-Check');
  // Männlich: keine Frage zur Stillzeit.
  await expect(page.getByTestId('supplement-check-breastfeeding-no')).toHaveCount(0);
  for (const id of ['kidney', 'heart_rhythm', 'caffeine_sensitive']) {
    await page.getByTestId(`supplement-check-${id}-no`).click();
  }
  await page.getByTestId('supplement-check-protein-no').click();
  await page.getByTestId('supplement-check-save').click();
  await heading(page, 'Supplemente');
}

test('Check → Kreatin passt mit Menge, Koffein nie „passt“, Detail mit Angabe und Pflichthinweis, „Nehme ich“', async ({
  page,
}) => {
  await setup(page, true);
  await openFromMore(page);
  await expect(page.getByTestId('supplements-disclaimer')).toContainText(
    'Nahrungsergänzungsmittel sind kein Ersatz',
  );
  // Seit der Freigabe der 18 Supplemente (content-review) enthält das Bündel keine Entwürfe mehr → kein Entwurfs-Hinweis.
  await expect(page.getByTestId('supplements-drafts')).toHaveCount(0);
  // Ohne Check: nur allgemeine Infos, nichts „passt“.
  await expect(page.getByTestId('supplements-general')).toBeVisible();
  await expect(page.getByTestId('supplements-group-recommended')).toHaveCount(0);

  await doCheck(page);
  const recommended = page.getByTestId('supplements-group-recommended');
  await expect(recommended).toBeVisible();
  await expect(page.getByTestId('supplement-creatine')).toHaveAttribute(
    'aria-label',
    /^Kreatin-Monohydrat, Passt zu dir, Gute Studienlage, Menge: 3 g am Tag, Täglich zu einer Mahlzeit/,
  );
  await expect(page.getByTestId('supplement-creatine')).not.toHaveAttribute(
    'aria-label',
    /Testphase/,
  );
  // Proteinpulver passt nur wegen „Eher nicht“ (Eiweiß-Selbsteinschätzung).
  await expect(recommended.getByTestId('supplement-protein_powder')).toBeVisible();
  // Vitamin D nie „passt“ – nur Info mit Richtwert.
  await expect(
    page.getByTestId('supplements-group-info').getByTestId('supplement-vitamin_d'),
  ).toHaveAttribute('aria-label', /Allgemeiner Richtwert: 20 µg \(800 IE\) am Tag/);
  // Koffein: eigene Gruppe, nie „Passt zu dir“.
  await expect(page.getByTestId('supplement-caffeine')).toHaveAttribute(
    'aria-label',
    /^Koffein, Sicherheits-Info/,
  );
  await expect(recommended.getByTestId('supplement-caffeine')).toHaveCount(0);
  // Keine Shop-Links.
  await expect(page.getByText(/Anzeige|Wo kaufen/)).toHaveCount(0);

  // Koffein-Detail: Abend-Training (Onboarding „Abends“).
  await page.getByTestId('supplement-caffeine').click();
  await expect(page.getByTestId('supplement-detail-notices')).toContainText(
    'Du trainierst abends: Nimm vor dem Training kein Koffein.',
  );
  await expect(page.getByTestId('supplement-detail-notices')).toContainText(
    'Höchstens 200 mg Koffein auf einmal.',
  );
  await expect(page.getByTestId('supplement-take')).toHaveCount(0);
  await page.getByTestId('supplement-detail-back').click();

  // Kreatin-Detail: Angabe + Pflichthinweis zusammen, Wasser-Hinweis, Pflichtsätze, Quellen eingeklappt.
  await page.getByTestId('supplement-creatine').click();
  await heading(page, 'Kreatin-Monohydrat');
  // Kein Testphase-Hinweis mehr (privater Nutzerkreis, Gründer-Entscheidung 27.10.2026).
  await expect(page.getByTestId('supplement-testphase')).toHaveCount(0);
  const claim = page.getByTestId('supplement-claim-creatine_performance');
  await expect(claim).toContainText(
    'Kreatin erhöht die körperliche Leistung bei Schnellkrafttraining',
  );
  await expect(claim).toContainText('täglichen Aufnahme von 3 g Kreatin');
  await expect(page.getByTestId('supplement-detail-dose')).toHaveText('Menge: 3 g am Tag');
  await expect(page.getByTestId('supplement-detail-howto')).toContainText('Rühre 3 g in Wasser');
  await expect(page.getByTestId('supplement-detail-notices')).toContainText('1–2 kg');
  await expect(page.getByTestId('supplement-detail-mandatory')).toContainText(
    'Bei Vorerkrankungen, Medikamenten, in Schwangerschaft und Stillzeit vorher ärztlich abklären.',
  );
  await expect(page.getByText(/10\.1186\/s12970-017-0173-z/)).toHaveCount(0);
  await page.getByTestId('supplement-sources-toggle').click();
  await expect(page.getByText(/10\.1186\/s12970-017-0173-z/)).toBeVisible();

  await page.getByTestId('supplement-take').click();
  await expect(page.getByTestId('supplement-choice')).toHaveText('Gespeichert: Nehme ich');
  await page.getByTestId('supplement-detail-back').click();
  await expect(page.getByTestId('supplements-mine')).toContainText('Kreatin-Monohydrat');

  // „Nicht empfohlen“ eingeklappt, aufklappbar.
  await expect(page.getByTestId('supplement-bcaa')).toHaveCount(0);
  await page.getByTestId('supplements-toggle-not-recommended').click();
  await page.getByTestId('supplement-bcaa').click();
  await expect(page.getByTestId('supplement-detail-reason')).toContainText('Studienlage');
  await expect(page.getByTestId('supplement-take')).toHaveCount(0);
});

test('Re-Consent: alte Fassung → Hinweis-Karte → zustimmen → Check bleibt erhalten', async ({
  page,
}) => {
  await setup(page, true);
  await openFromMore(page);
  await doCheck(page);
  await page.getByTestId('supplements-test-old-consent').click();
  await expect(page.getByTestId('supplements-reconsent')).toContainText(
    'Wir haben die Einwilligung zu Gesundheitsdaten ergänzt',
  );
  // Bis zur Zustimmung nur allgemeine Infos.
  await expect(page.getByTestId('supplements-group-recommended')).toHaveCount(0);
  await page.getByTestId('supplements-reconsent-open').click();
  await expect(page.getByText(/Supplement-Check \(Nieren, Stillzeit/)).toBeVisible();
  await page.getByRole('checkbox', { name: /Ich willige/ }).click();
  await page.getByRole('button', { name: 'Einwilligen', exact: false }).first().click();
  await heading(page, 'Supplemente');
  await expect(page.getByTestId('supplements-reconsent')).toHaveCount(0);
  await expect(page.getByTestId('supplements-check-redo')).toBeVisible();
  await expect(page.getByTestId('supplements-group-recommended')).toBeVisible();
});

test('Sperren: Medikamente → „Nicht für dich“ ohne Menge; unter 18 → „Ab 18 Jahren“', async ({
  page,
}) => {
  await setup(page, true);
  await openFromMore(page);
  await doCheck(page);
  await patchDb(page, (db) => {
    const screenings = db.rows.healthScreenings as { flags: string[] }[];
    for (const s of screenings) s.flags = ['medication', 'conservative_plan'];
  });
  await page.reload();
  await heading(page, 'Supplemente');
  const excluded = page.getByTestId('supplements-group-excluded');
  await expect(excluded).toContainText('Nicht für dich – bitte ärztlich abklären');
  await expect(excluded.getByTestId('supplement-creatine')).toHaveAttribute(
    'aria-label',
    /^Kreatin-Monohydrat, Nicht für dich, Gute Studienlage/,
  );
  await expect(excluded.getByTestId('supplement-creatine')).not.toHaveAttribute(
    'aria-label',
    /Testphase/,
  );
  await page.getByTestId('supplement-creatine').click();
  await expect(page.getByTestId('supplement-detail-no-dose')).toBeVisible();
  await expect(page.getByTestId('supplement-detail-notices')).toContainText(
    'Bei deinen Angaben empfehlen wir das nicht ohne ärztliche Rücksprache.',
  );
  await expect(page.getByTestId('supplement-take')).toHaveCount(0);

  await patchDb(page, (db) => {
    db.rows.profile.birth_date = '2009-01-01';
    const screenings = db.rows.healthScreenings as { flags: string[] }[];
    for (const s of screenings) s.flags = [];
  });
  await page.goto('/supplemente');
  await heading(page, 'Supplemente');
  await expect(page.getByTestId('supplements-group-adult_only')).toContainText('Ab 18 Jahren');
  await expect(
    page.getByTestId('supplements-group-adult_only').getByTestId('supplement-creatine'),
  ).not.toHaveAttribute('aria-label', /Menge/);
});

test('ohne Einwilligung: allgemeine Infos und Hinweis auf die Einwilligung, kein Check', async ({
  page,
}) => {
  await setup(page, false);
  await openFromMore(page);
  await expect(page.getByTestId('supplements-consent-none')).toBeVisible();
  await expect(page.getByTestId('supplements-check-start')).toHaveCount(0);
  await expect(page.getByTestId('supplements-group-info')).toBeVisible();
  await expect(page.getByTestId('supplements-group-recommended')).toHaveCount(0);
});
