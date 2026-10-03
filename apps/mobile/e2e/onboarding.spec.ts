import { expect, test, type Page } from '@playwright/test';

/**
 * Kompletter Durchlauf im TESTMODUS (Web-Export ohne Supabase-Werte), Handy-Ansicht 390 × 844.
 * Prüft Ablauf, Einwilligungs-Regeln und dass Gesundheitsdaten nur mit Einwilligung gespeichert werden.
 */

const LOCAL_DB = 'fitnessapp.local.v1';

interface StoredRows {
  consents: { consent_type: string; revoked_at: string | null }[];
  bodyMetrics: unknown[];
  bodyMeasurements: unknown[];
  healthScreenings: { flags: string[]; medical_notice_acknowledged_at: string | null }[];
  foodPreferences: { food_group: string; kind: string }[];
  profile: { onboarding_completed_at: string | null; birth_date: string } | null;
  goals: { training_location: string | null } | null;
  userEquipment: { equipment_id: string; weights_kg: number[] }[];
  reminder: { enabled: boolean; next_due_on: string | null } | null;
}

async function storedRows(page: Page): Promise<StoredRows | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  if (!raw) {
    return null;
  }
  return (JSON.parse(raw) as { rows: StoredRows | null }).rows;
}

async function appKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('fitnessapp')),
  );
}

const next = (page: Page) => page.getByRole('button', { name: 'Weiter', exact: true }).click();

async function enterBirthDate(page: Page, day: string, month: string, year: string) {
  await page.getByLabel('Geburtsdatum: Tag').fill(day);
  await page.getByLabel('Geburtsdatum: Monat').fill(month);
  await page.getByLabel('Geburtsdatum: Jahr').fill(year);
  await next(page);
}

async function startUntilSex(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Testmodus – Daten bleiben nur auf diesem Gerät')).toBeVisible();
  await page.getByRole('button', { name: "Los geht's" }).click();
  await expect(page.getByRole('heading', { name: 'Wann bist du geboren?' })).toBeVisible();
  await enterBirthDate(page, '15', '05', '1990');
  await page.getByRole('button', { name: 'Testmodus starten' }).click();

  await expect(page.getByRole('heading', { name: 'Deine Zustimmung' })).toBeVisible();
  const terms = page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' });
  await expect(terms).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await expect(page.getByText('Bitte bestätige beide Punkte, um fortzufahren.')).toBeVisible();
  // „Text lesen“ zeigt den Entwurfstext (lokale Kopie der Version 1).
  await page.getByRole('link', { name: 'Nutzungsbedingungen: Text lesen' }).click();
  await expect(page.getByText('ENTWURF – juristisch prüfen').first()).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await terms.click();
  await page.getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' }).click();
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Geschlecht' })).toBeVisible();
}

async function finishTrainingAndNutrition(page: Page, options: { intolerance: boolean }) {
  await page.getByRole('radio', { name: /^Einsteiger/ }).click();
  await next(page);

  await expect(page.getByRole('heading', { name: 'Dein Ziel' })).toBeVisible();
  await page.getByRole('radio', { name: 'Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Halbmarathon' }).click();
  await next(page);

  await expect(page.getByRole('heading', { name: 'Dein Zeitbudget' })).toBeVisible();
  await next(page);
  await expect(
    page.getByText('Bitte wähle, an wie vielen Tagen du trainieren möchtest.'),
  ).toBeVisible();
  await page.getByRole('radio', { name: '3', exact: true }).click();
  await page.getByRole('radio', { name: '45 Minuten' }).click();
  await page.getByRole('checkbox', { name: 'Montag' }).click();
  await page.getByRole('checkbox', { name: 'Donnerstag' }).click();
  await next(page);

  // Neustart der App mitten im Onboarding → es geht an derselben Stelle weiter.
  await expect(page.getByRole('heading', { name: 'Wo trainierst du?' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Wo trainierst du?' })).toBeVisible();

  await page.getByRole('radio', { name: 'Beides' }).click();
  await next(page);

  await expect(page.getByRole('heading', { name: 'Equipment zu Hause' })).toBeVisible();
  await expect(page.getByText(/Noch nichts ausgewählt/)).toBeVisible();
  // Studio-Geräte (Phase 2) werden zu Hause nicht angeboten.
  await expect(page.getByRole('checkbox', { name: 'Widerstandsbänder' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Kabelzug' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Beinpresse' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Kurzhanteln' }).click();
  await page.getByLabel('Kurzhanteln: Gewicht in kg').fill('2,5');
  await page.getByRole('button', { name: 'Kurzhanteln: Hinzufügen' }).click();
  await page.getByLabel('Kurzhanteln: Gewicht in kg').fill('10');
  await page.getByRole('button', { name: 'Kurzhanteln: Hinzufügen' }).click();
  await expect(page.getByRole('button', { name: '2,5 kg entfernen' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Sonstiges' }).click();
  await next(page);
  await expect(page.getByText('Bitte beschreibe das Gerät.')).toBeVisible();
  await page.getByLabel('Was für ein Gerät?').fill('Sprungseil');
  await next(page);

  await expect(page.getByRole('heading', { name: 'Deine Ernährung' })).toBeVisible();
  await page.getByRole('radio', { name: 'Alles (omnivor)' }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Isst du Schweinefleisch? (optional)' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Vegetarisch' }).click();
  await expect(
    page.getByRole('radiogroup', { name: 'Isst du Schweinefleisch? (optional)' }),
  ).toHaveCount(0);
  await page
    .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
    .getByRole('radio', { name: '4' })
    .click();
  await page.getByRole('checkbox', { name: 'Pilze: Mag ich', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Pilze: Mag ich nicht' }).click();
  await expect(page.getByRole('checkbox', { name: 'Pilze: Mag ich', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  if (options.intolerance) {
    await page.getByRole('checkbox', { name: 'Erdnüsse: Unverträglich' }).click();
  } else {
    await expect(page.getByText(/Unverträglichkeiten sind Gesundheitsdaten/)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Erdnüsse: Unverträglich' })).toHaveCount(0);
  }
  await next(page);

  await expect(page.getByRole('heading', { name: 'Wie kochst du?' })).toBeVisible();
  await page.getByRole('radio', { name: /^Meal-Prep/ }).click();
  await next(page);
  await expect(page.getByText('Bitte wähle die Anzahl der Tage.')).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'An wie vielen Tagen pro Woche kochst du vor?' })
    .getByRole('radio', { name: '2' })
    .click();
  await next(page);

  await expect(page.getByRole('heading', { name: 'Geschafft!' })).toBeVisible();
  await expect(page.getByText('Dein Plan wird vorbereitet – kommt in Phase 3.')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('unter 16 → freundlicher Stopp, nichts gespeichert', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: "Los geht's" }).click();
  await next(page);
  await expect(page.getByText('Bitte Tag, Monat und Jahr eingeben (TT.MM.JJJJ).')).toBeVisible();
  await enterBirthDate(page, '31', '02', '1990');
  await expect(page.getByText('Bitte ein gültiges Datum eingeben.')).toBeVisible();

  const year = new Date().getFullYear() - 15;
  await page.getByLabel('Geburtsdatum: Tag').fill('01');
  await page.getByLabel('Geburtsdatum: Monat').fill('01');
  await page.getByLabel('Geburtsdatum: Jahr').fill(String(year));
  await next(page);
  await expect(
    page.getByRole('heading', { name: /Schön, dass du dich für Fitness/ }),
  ).toBeVisible();
  await expect(page.getByText(/Wir haben nichts von dir gespeichert/)).toBeVisible();
  expect(await appKeys(page)).toEqual([]);
  await page.getByRole('button', { name: 'Zurück zum Start' }).click();
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
});

test('mit Einwilligung: Körperdaten, Umfänge, Gesundheits-Check mit Arzt-Hinweis, Widerruf, Testdaten löschen', async ({
  page,
}) => {
  await startUntilSex(page);
  await expect(page.getByText('Schritt 1 von 12')).toBeVisible();
  await page.getByRole('radio', { name: 'weiblich' }).click();
  await page
    .getByRole('radiogroup', { name: 'Interesse am Zyklus-Modul später?' })
    .getByRole('radio', { name: 'Ja' })
    .click();
  await next(page);

  await expect(page.getByRole('heading', { name: 'Einwilligung Gesundheitsdaten' })).toBeVisible();
  await expect(
    page.getByText(/Im Testmodus werden deine Angaben nur in diesem Browser/),
  ).toBeVisible();
  const consentBox = page.getByRole('checkbox', {
    name: 'Ich willige in die Verarbeitung meiner Gesundheitsdaten wie beschrieben ein.',
  });
  await expect(consentBox).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
  await expect(
    page.getByText('Bitte setze das Häkchen – oder fahre ohne Einwilligung fort.'),
  ).toBeVisible();
  await consentBox.click();
  await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Körperdaten' })).toBeVisible();
  await expect(page.getByText('Schritt 3 von 12')).toBeVisible();
  await page.getByLabel('Größe in cm').fill('17');
  await next(page);
  await expect(page.getByText('Größe: mindestens 100 cm.')).toBeVisible();
  await expect(page.getByText('Gewicht: bitte eine Zahl eingeben.')).toBeVisible();
  await page.getByLabel('Größe in cm').fill('170');
  await page.getByLabel('Gewicht in kg').fill('65,5');
  await next(page);

  await expect(page.getByRole('heading', { name: 'Körperumfänge' })).toBeVisible();
  await expect(page.getByText(/an der schmalsten Stelle zwischen unterster Rippe/)).toBeVisible();
  await expect(page.getByText(/alle 28 Tage/)).toBeVisible();
  await next(page);
  await expect(
    page.getByText('Bitte mindestens einen Umfang eintragen – oder den Schritt überspringen.'),
  ).toBeVisible();
  await page.getByLabel('Taille (cm)').fill('72');
  await page.getByLabel('Oberarm links (cm)').fill('29,5');
  await next(page);

  await expect(page.getByRole('heading', { name: 'Gesundheits-Check' })).toBeVisible();
  await next(page);
  await expect(page.getByText('Bitte beantworte alle Fragen.').first()).toBeVisible();
  const groups = page.getByRole('radiogroup');
  const count = await groups.count();
  expect(count).toBe(9); // weiblich → inkl. Schwangerschafts-Frage
  for (let index = 0; index < count; index += 1) {
    await groups
      .nth(index)
      .getByRole('radio', { name: index === 0 ? 'Ja' : 'Nein' })
      .click();
  }
  await next(page);

  await expect(page.getByTestId('medical-notice')).toBeVisible();
  await expect(page.getByText(/mit deiner Ärztin oder deinem Arzt sprechen/)).toBeVisible();
  await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
  await expect(page.getByText('Bitte bestätige den Hinweis.')).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Ich habe den Hinweis gelesen und kläre das ärztlich ab.' })
    .click();
  await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Deine Trainingserfahrung' })).toBeVisible();
  await finishTrainingAndNutrition(page, { intolerance: true });
  await expect(page.getByText('Vorsichtiger Plan (Gesundheits-Check)')).toBeVisible();

  let rows = await storedRows(page);
  expect(rows?.profile?.onboarding_completed_at).not.toBeNull();
  expect(rows?.bodyMetrics).toHaveLength(1);
  expect(rows?.bodyMeasurements).toHaveLength(1);
  expect(rows?.healthScreenings[0]?.flags).toEqual([
    'medical_clearance_recommended',
    'conservative_plan',
  ]);
  expect(rows?.healthScreenings[0]?.medical_notice_acknowledged_at).not.toBeNull();
  expect(rows?.foodPreferences).toContainEqual(
    expect.objectContaining({ food_group: 'peanuts', kind: 'intolerance' }),
  );
  expect(rows?.userEquipment).toContainEqual(
    expect.objectContaining({ equipment_id: 'dumbbells', weights_kg: [2.5, 10] }),
  );
  expect(rows?.reminder?.enabled).toBe(true);

  await page.getByRole('button', { name: 'Zur Startseite' }).click();
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible();
  // Neustart nach dem Onboarding → direkt „Heute“.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible();

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await expect(page.getByText(/^Version 1, erteilt am \d{2}\.\d{2}\.\d{4}$/).first()).toBeVisible();
  await expect(page.getByText(/^Nächste Messung: \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();

  // Mess-Erinnerung: Grenzen 7–90 Tage.
  await page.getByLabel('Abstand in Tagen (7–90)').fill('5');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Mindestens alle 7 Tage.')).toBeVisible();
  await page.getByLabel('Abstand in Tagen (7–90)').fill('14');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gespeichert.')).toBeVisible();

  // Widerruf health_data → Bestätigung → alle Gesundheitsdaten gelöscht.
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await expect(page.getByText(/löscht alle Körper- und Gesundheitsdaten/)).toBeVisible();
  await page.getByRole('button', { name: 'Widerrufen und löschen' }).click();
  await expect(
    page.getByText('Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.'),
  ).toBeVisible();
  await expect(page.getByText(/^Widerrufen am \d{2}\.\d{2}\.\d{4}$/)).toBeVisible();
  rows = await storedRows(page);
  expect(rows?.bodyMetrics).toEqual([]);
  expect(rows?.bodyMeasurements).toEqual([]);
  expect(rows?.healthScreenings).toEqual([]);
  expect(rows?.foodPreferences.some((p) => p.kind === 'intolerance')).toBe(false);
  expect(rows?.foodPreferences).toContainEqual(
    expect.objectContaining({ food_group: 'mushrooms', kind: 'dislike' }),
  );
  expect(rows?.consents.find((c) => c.consent_type === 'health_data')?.revoked_at).not.toBeNull();

  // Testdaten löschen → alles weg, zurück zum Start.
  await page.getByRole('button', { name: 'Testdaten löschen' }).click();
  await page.getByRole('button', { name: 'Alles löschen' }).click();
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
  expect(await appKeys(page)).toEqual([]);
});

test('ohne Einwilligung Gesundheitsdaten: keine Körperdaten, kein Gesundheits-Check, keine Unverträglichkeiten', async ({
  page,
}) => {
  await startUntilSex(page);
  await page.getByRole('radio', { name: 'männlich' }).click();
  await next(page);

  await expect(page.getByText(/Ohne Einwilligung kannst du die App nutzen/)).toBeVisible();
  await page.getByRole('button', { name: 'Ohne Einwilligung fortfahren' }).click();

  await expect(page.getByRole('heading', { name: 'Deine Trainingserfahrung' })).toBeVisible();
  await expect(page.getByText('Schritt 3 von 9')).toBeVisible();
  await finishTrainingAndNutrition(page, { intolerance: false });
  await expect(page.getByText(/Ohne Einwilligung Gesundheitsdaten/)).toBeVisible();

  const rows = await storedRows(page);
  expect(rows?.consents.map((c) => c.consent_type).sort()).toEqual(['privacy', 'terms']);
  expect(rows?.bodyMetrics).toEqual([]);
  expect(rows?.bodyMeasurements).toEqual([]);
  expect(rows?.healthScreenings).toEqual([]);
  expect(rows?.foodPreferences.some((p) => p.kind === 'intolerance')).toBe(false);

  // Direkter Aufruf eines Gesundheits-Schritts ist nicht möglich.
  await page.goto('/onboarding/body_metrics');
  await expect(page.getByRole('heading', { name: 'Heute' })).toBeVisible();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Nicht erteilt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gesundheitsdaten: Einwilligen' })).toBeVisible();
});
