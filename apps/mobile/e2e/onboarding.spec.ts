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
  trainingSlots: { slot_no: number; weekday: number | null; kind: string; minutes: number }[];
  userEquipment: { equipment_id: string; weights_kg: number[]; bar_kg: number | null }[];
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

  // „Deine Trainingstage“ ersetzt Zeitbudget und Trainingsort (Etappe B2).
  await expect(page.getByRole('heading', { name: 'Deine Trainingstage' })).toBeVisible();
  // Ziel Ausdauer → Ausdauer-Tage vorbelegt (Einsteiger ≤ 5 Einheiten); hier eigene Tage planen.
  await expect(page.getByTestId('schedule-suggestion')).toBeVisible();
  await expect(page.getByTestId('schedule-summary')).toContainText(/\d× Laufen/);
  await page.getByRole('button', { name: 'Ohne Vorschlag planen' }).click();
  await expect(page.getByTestId('schedule-suggestion')).toHaveCount(0);
  if (options.intolerance) {
    await planFixedDays(page);
  } else {
    await planFlexDays(page);
  }
}

/** Feste Tage gemischt: Mo Laufen 30, Mi Studio 60, Sa Zuhause 90 (eigene Minuten) → Equipment folgt. */
async function planFixedDays(page: Page) {
  await next(page);
  await expect(page.getByText('Bitte wähle mindestens einen Trainingstag.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Montag' }).click();
  // Vorschlag nach Ziel (Ausdauer) mit Untertitel nach Disziplin (Halbmarathon → Laufen), 30 Minuten.
  await expect(page.getByRole('radio', { name: 'Montag: Ausdauer – Laufen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('radio', { name: 'Montag: 30 Minuten' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('checkbox', { name: 'Mittwoch' }).click();
  await page.getByRole('radio', { name: 'Mittwoch: Kraft im Studio' }).click();
  await page.getByRole('radio', { name: 'Mittwoch: 60 Minuten' }).click();
  await page.getByRole('checkbox', { name: 'Samstag' }).click();
  // Vorbelegung = zuletzt bearbeiteter Tag (Mittwoch).
  await expect(page.getByRole('radio', { name: 'Samstag: Kraft im Studio' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Samstag: Kraft zu Hause' }).click();
  await page.getByRole('radio', { name: 'Samstag: Eigene' }).click();
  await page.getByLabel('Samstag: Minuten (10–240)').fill('5');
  await next(page);
  await expect(page.getByText('Minuten: mindestens 10.')).toBeVisible();
  await page.getByLabel('Samstag: Minuten (10–240)').fill('90');
  await expect(page.getByTestId('schedule-summary')).toContainText(
    '3 Tage: 1× Kraft im Studio, 1× Kraft zu Hause, 1× Laufen · 180 min pro Woche',
  );
  await expect(page.getByTestId('schedule-hints')).toContainText(
    'Dein Ziel ist Ausdauer – wir empfehlen mindestens 2 Ausdauer-Tage.',
  );
  await next(page);

  // Kein Trainingsort-Schritt; Equipment wegen „Kraft zu Hause“. Neustart → es geht hier weiter.
  await expect(page.getByRole('heading', { name: 'Equipment zu Hause' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Equipment zu Hause' })).toBeVisible();

  await expect(page.getByText(/Noch nichts ausgewählt/)).toBeVisible();
  // Studio-Geräte (Phase 2) werden zu Hause nicht angeboten.
  await expect(page.getByRole('checkbox', { name: 'Widerstandsbänder' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Kabelzug' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Beinpresse' })).toHaveCount(0);

  // Kurzhanteln: Gewichte antippen + eigener Wert.
  await page.getByRole('checkbox', { name: 'Kurzhanteln', exact: true }).click();
  await expect(page.getByText('Gewicht je Hantel – tippe an, was du hast.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Kurzhanteln: 2 kg', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kurzhanteln: 10 kg', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kurzhanteln: 12 kg', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kurzhanteln: 12 kg', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Kurzhanteln: 12 kg', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await page.getByLabel('Kurzhanteln: Gewicht in kg').fill('2,5');
  await page.getByRole('button', { name: 'Kurzhanteln: Hinzufügen' }).click();
  await expect(page.getByRole('button', { name: '2,5 kg entfernen' })).toBeVisible();
  await expect(page.getByText('3 ausgewählt')).toBeVisible();

  // Langhantel: Stange 15, Scheiben 1,25 / 2,5 / 5 / 10; Scheibe über 25 kg wird abgelehnt.
  await page.getByRole('checkbox', { name: 'Langhantel mit Scheiben' }).click();
  await expect(page.getByRole('radio', { name: 'Stange: 20 kg' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('radio', { name: 'Stange: 15 kg' }).click();
  for (const kg of ['1,25', '2,5', '5', '10']) {
    await page
      .getByRole('checkbox', { name: `Langhantel mit Scheiben: ${kg} kg`, exact: true })
      .click();
  }
  await page.getByLabel('Langhantel mit Scheiben: Gewicht in kg').fill('30');
  await page.getByRole('button', { name: 'Langhantel mit Scheiben: Hinzufügen' }).click();
  await expect(page.getByText('Hantelscheiben: höchstens 25 kg je Scheibe.')).toBeVisible();

  // Kettlebells: antippen und „Alle abwählen“.
  await page.getByRole('checkbox', { name: 'Kettlebells', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kettlebells: 8 kg', exact: true }).click();
  await page.getByRole('button', { name: 'Kettlebells: alle Gewichte abwählen' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Kettlebells: 8 kg', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('checkbox', { name: 'Sonstiges' }).click();
  await next(page);
  await expect(page.getByText('Bitte beschreibe das Gerät.')).toBeVisible();
  await page.getByLabel('Was für ein Gerät?').fill('Sprungseil');
  await next(page);
  await finishNutrition(page, { intolerance: true });
}

/** „Tage egal“: 2× Kraft im Studio à 45, 2× Laufen à 30 → kein Equipment-Schritt. */
async function planFlexDays(page: Page) {
  await page.getByRole('radio', { name: 'Tage egal – verteilt für mich' }).click();
  await next(page);
  await expect(page.getByText('Bitte plane mindestens eine Einheit pro Woche.')).toBeVisible();
  await page.getByRole('button', { name: 'Kraft im Studio: eine Einheit mehr' }).click();
  await page.getByRole('button', { name: 'Kraft im Studio: eine Einheit mehr' }).click();
  await page.getByRole('radio', { name: 'Kraft im Studio: 45 Minuten' }).click();
  await page.getByRole('button', { name: 'Ausdauer – Laufen: eine Einheit mehr' }).click();
  await page.getByRole('button', { name: 'Ausdauer – Laufen: eine Einheit mehr' }).click();
  await expect(page.getByTestId('schedule-summary')).toContainText(
    '4 Tage: 2× Kraft im Studio, 2× Laufen · 150 min pro Woche',
  );
  await next(page);
  await finishNutrition(page, { intolerance: false });
}

async function finishNutrition(page: Page, options: { intolerance: boolean }) {
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
  await expect(page.getByTestId('done-plan')).toContainText('Dein Plan ist fertig');
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
  await expect(page.getByText('Schritt 1 von 11')).toBeVisible();
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
  await expect(page.getByText('Schritt 3 von 11')).toBeVisible();
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
  await expect(
    page.getByText(/Mo Laufen 30 min\s+Mi Kraft im Studio 60 min\s+Sa Kraft zu Hause 90 min/),
  ).toBeVisible();
  await expect(page.getByText(/Kurzhanteln \(2–10 kg, 3 Stufen\)/)).toBeVisible();
  await expect(page.getByText(/Stange 15 kg, Scheiben 1,25–10 kg/)).toBeVisible();
  await expect(page.getByText('Trainingsort')).toHaveCount(0);

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
    expect.objectContaining({ equipment_id: 'dumbbells', weights_kg: [2, 2.5, 10] }),
  );
  expect(rows?.userEquipment).toContainEqual(
    expect.objectContaining({
      equipment_id: 'barbell',
      weights_kg: [1.25, 2.5, 5, 10],
      bar_kg: 15,
    }),
  );
  expect(rows?.trainingSlots).toEqual([
    expect.objectContaining({ slot_no: 1, weekday: 1, kind: 'endurance', minutes: 30 }),
    expect.objectContaining({ slot_no: 2, weekday: 3, kind: 'strength_gym', minutes: 60 }),
    expect.objectContaining({ slot_no: 3, weekday: 6, kind: 'strength_home', minutes: 90 }),
  ]);
  expect(rows?.goals?.training_location).toBe('both');
  expect(rows?.reminder?.enabled).toBe(true);

  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
  // Neustart nach dem Onboarding → direkt „Heute“.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();

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
  await expect(page.getByText('Schritt 3 von 8')).toBeVisible();
  await finishTrainingAndNutrition(page, { intolerance: false });
  await expect(page.getByText(/Ohne Einwilligung Gesundheitsdaten/)).toBeVisible();
  await expect(
    page.getByText('2× Kraft im Studio à 45 min, 2× Laufen à 30 min – die Tage verteilen wir'),
  ).toBeVisible();
  await expect(page.getByText('Equipment', { exact: true })).toHaveCount(0);

  const rows = await storedRows(page);
  expect(rows?.consents.map((c) => c.consent_type).sort()).toEqual(['privacy', 'terms']);
  expect(rows?.bodyMetrics).toEqual([]);
  expect(rows?.bodyMeasurements).toEqual([]);
  expect(rows?.healthScreenings).toEqual([]);
  expect(rows?.foodPreferences.some((p) => p.kind === 'intolerance')).toBe(false);
  expect(rows?.trainingSlots.map((slot) => [slot.weekday, slot.kind, slot.minutes])).toEqual([
    [null, 'strength_gym', 45],
    [null, 'strength_gym', 45],
    [null, 'endurance', 30],
    [null, 'endurance', 30],
  ]);
  expect(rows?.goals?.training_location).toBe('gym');

  // Direkter Aufruf eines Gesundheits-Schritts ist nicht möglich.
  await page.goto('/onboarding/body_metrics');
  await expect(page.getByRole('heading', { name: 'Heute', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page.getByText('Nicht erteilt')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gesundheitsdaten: Einwilligen' })).toBeVisible();
});
