import { expect, test, type Page } from '@playwright/test';

/**
 * Trainingsplan im TESTMODUS (docs/PLAN-PHASE-3.md Abschnitt 10, Etappe C) mit festem Datum:
 * Mittwoch, 07.10.2026 (Europe/Berlin). Onboarding → Plan auf „Heute“ (Kraft und Ausdauer), Wochenübersicht,
 * Verschieben/Streichen, Arzt-Hinweis, Widerruf, veraltete Einwilligung, Angaben ändern → neu erstellen.
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const WEDNESDAY = new Date('2026-10-07T09:00:00+02:00');

interface StoredPlanRows {
  plans: { id: string; status: string; uses_health_data: boolean; medical_notice: boolean }[];
  plannedSessions: {
    id: string;
    plan_id: string;
    scheduled_on: string;
    original_date: string | null;
    status: string;
    kind: string;
  }[];
  plannedExercises: { session_id: string }[];
  consents: { consent_type: string; version: number; revoked_at: string | null }[];
}

async function storedRows(page: Page): Promise<StoredPlanRows> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  return (JSON.parse(raw ?? '{}') as { rows: StoredPlanRows }).rows;
}

const next = (page: Page) => page.getByRole('button', { name: 'Weiter', exact: true }).click();
const heading = (page: Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name, exact: typeof name === 'string' })).toBeVisible();

interface Person {
  consent: boolean;
  /** Gesundheits-Check: Frage mit „Ja“ (Index), null = alles „Nein“. */
  yesQuestion?: number | null;
  level: RegExp;
  goal: string;
  discipline?: string;
  /** Feste Tage: [Wochentag, Art, Minuten]; leer = Vorschlag (Ziel Ausdauer) übernehmen. */
  days: [string, string, number][];
}

/** Onboarding im Testmodus bis „Geschafft!“ (Plan wird dort erzeugt). */
async function onboard(page: Page, person: Person) {
  await page.goto('/');
  await page.getByRole('button', { name: "Los geht's" }).click();
  await page.getByLabel('Geburtsdatum: Tag').fill('15');
  await page.getByLabel('Geburtsdatum: Monat').fill('05');
  await page.getByLabel('Geburtsdatum: Jahr').fill('1990');
  await next(page);
  await page.getByRole('button', { name: 'Testmodus starten' }).click();
  await page.getByRole('checkbox', { name: 'Ich akzeptiere die Nutzungsbedingungen.' }).click();
  await page.getByRole('checkbox', { name: 'Ich habe die Datenschutzerklärung gelesen.' }).click();
  await page.getByRole('button', { name: 'Zustimmen und weiter' }).click();
  await heading(page, 'Dein Geschlecht');
  await page.getByRole('radio', { name: 'männlich' }).click();
  await next(page);
  if (person.consent) {
    await page.getByRole('checkbox', { name: /Ich willige/ }).click();
    await page.getByRole('button', { name: 'Einwilligen und weiter' }).click();
    await heading(page, 'Körperdaten');
    await page.getByLabel('Größe in cm').fill('180');
    await page.getByLabel('Gewicht in kg').fill('80');
    await next(page);
    await page.getByRole('button', { name: 'Überspringen' }).click();
    await heading(page, 'Gesundheits-Check');
    const groups = page.getByRole('radiogroup');
    const count = await groups.count();
    for (let i = 0; i < count; i += 1) {
      await groups
        .nth(i)
        .getByRole('radio', { name: i === person.yesQuestion ? 'Ja' : 'Nein' })
        .click();
    }
    await next(page);
    if (person.yesQuestion !== null && person.yesQuestion !== undefined) {
      await page.getByRole('checkbox', { name: /Ich habe den Hinweis gelesen/ }).click();
      await page.getByRole('button', { name: 'Bestätigen und weiter' }).click();
    }
  } else {
    await page.getByRole('button', { name: 'Ohne Einwilligung fortfahren' }).click();
  }
  await heading(page, 'Deine Trainingserfahrung');
  await page.getByRole('radio', { name: person.level }).click();
  await next(page);
  await heading(page, 'Dein Ziel');
  await page.getByRole('radio', { name: person.goal }).click();
  if (person.discipline) {
    await page.getByRole('radio', { name: person.discipline, exact: true }).click();
  }
  await next(page);
  await heading(page, 'Deine Trainingstage');
  if (person.goal === 'Ausdauer' && person.days.length > 0) {
    // Ziel Ausdauer belegt Tage vor – hier eigene Tage planen.
    await page.getByRole('button', { name: 'Ohne Vorschlag planen' }).click();
  } else if (person.goal === 'Ausdauer') {
    // Vorbelegung (Fortgeschritten): Mo Kraft, Di Ausdauer, Do Kraft, Fr + Sa Ausdauer.
    await expect(page.getByTestId('schedule-suggestion')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Dienstag: Ausdauer/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(page.getByTestId('schedule-summary')).toContainText(
      '5 Tage: 2× Kraft im Studio, 3× Laufen',
    );
  }
  await planDays(page, person.days);
  await next(page);
  if (person.days.some(([, kind]) => kind === 'Kraft zu Hause')) {
    // Equipment: nichts auswählen = nur Körpergewicht.
    await heading(page, 'Equipment zu Hause');
    await next(page);
  }
  await heading(page, 'Deine Ernährung');
  await page.getByRole('radio', { name: 'Alles (omnivor)' }).click();
  await page
    .getByRole('radiogroup', { name: 'Mahlzeiten pro Tag' })
    .getByRole('radio', { name: '3' })
    .click();
  await next(page);
  await page.getByRole('radio', { name: /^Täglich frisch/ }).click();
  await next(page);
  await heading(page, 'Geschafft!');
}

async function planDays(page: Page, days: [string, string, number][]) {
  for (const [day, kind, minutes] of days) {
    await page.getByRole('checkbox', { name: day }).click();
    await page.getByRole('radio', { name: new RegExp(`^${day}: ${kind}`) }).click();
    await page.getByRole('radio', { name: `${day}: ${minutes} Minuten` }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
});

test('Studio 3 Tage: Plan auf „Heute“, Wochenübersicht, Verschieben und Streichen', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await expect(page.getByTestId('done-plan')).toContainText('Dein Plan ist fertig');
  await expect(page.getByTestId('done-plan')).toContainText('Vorlage: Muskelaufbau');
  await page.getByRole('button', { name: 'Zum Plan' }).click();

  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-test-content')).toHaveText(
    'Testinhalte – KI-Entwurf, nicht fachlich geprüft',
  );
  // Mi + Fr = 2 von 3 Einheiten in der Startwoche → Woche 1 = Einstiegswoche.
  await expect(page.getByRole('heading', { name: 'Woche 1 von 6' })).toBeVisible();
  await expect(page.getByText(/^Einstiegswoche: Wähle Gewichte/)).toBeVisible();
  await expect(page.getByText('Deine Einheit heute')).toBeVisible();
  await expect(page.getByTestId('plan-exercise').first()).toContainText('Wiederholungen');
  await expect(page.getByTestId('plan-exercise').first()).toContainText(
    'Wiederholungen in Reserve',
  );
  await expect(page.getByTestId('plan-exercise').first()).toContainText('Startgewicht finden');
  await expect(page.getByTestId('plan-medical-notice')).toHaveCount(0);

  // Wochenübersicht Mo–So, heute hervorgehoben; Montag liegt vor dem Planstart (Ruhetag).
  const week = page.getByTestId('plan-week');
  await expect(week.getByRole('button')).toHaveCount(7);
  await expect(week.getByRole('button', { name: /^Montag, 05\.10\.: Ruhetag/ })).toBeVisible();
  await expect(
    week.getByRole('button', { name: /^Mittwoch, 07\.10\.: .*\(heute\)/ }),
  ).toBeVisible();
  await week.getByRole('button', { name: /^Dienstag/ }).click();
  await expect(page.getByRole('heading', { name: 'Dienstag, 06.10.: Ruhetag' })).toBeVisible();
  await expect(page.getByText(/^Nächste Einheit: Mittwoch, 07\.10\./)).toBeVisible();

  // Mittwoch: kein freier Tag ohne 48-h-Konflikt (Do/Sa neben Fr, So neben Mo der Folgewoche) → nachfragen,
  // dann gestrichen – nie in die nächste Woche.
  await week.getByRole('button', { name: /^Mittwoch/ }).click();
  await page.getByRole('button', { name: 'Einheit verschieben' }).click();
  await expect(page.getByRole('heading', { name: 'Einheit streichen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Einheit streichen' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText(
    'Diese Woche ist kein Tag mehr frei – die Einheit entfällt.',
  );
  await expect(
    week.getByRole('button', { name: /^Mittwoch, 07\.10\.: .* – entfällt/ }),
  ).toBeVisible();
  let rows = await storedRows(page);
  expect(rows.plannedSessions.find((s) => s.scheduled_on === '2026-10-07')?.status).toBe('skipped');

  // Freitag → heute (Mittwoch ist gestrichen und blockiert den Tag nicht mehr – „ab heute“).
  await week.getByRole('button', { name: /^Freitag/ }).click();
  await expect(page.getByText('Einheit am Freitag, 09.10.')).toBeVisible();
  await page.getByRole('button', { name: 'Einheit verschieben' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText('Auf Mittwoch verschoben.');
  await expect(
    week.getByRole('button', { name: /^Mittwoch, 07\.10\.: .*verschoben von Fr/ }),
  ).toBeVisible();
  await expect(
    week.getByRole('button', { name: /^Freitag, 09\.10\.: Ruhetag \(verschoben auf Mi\)/ }),
  ).toBeVisible();
  rows = await storedRows(page);
  const moved = rows.plannedSessions.find(
    (s) => s.scheduled_on === '2026-10-07' && s.status === 'planned',
  );
  expect(moved?.original_date).toBe('2026-10-09');

  // Neu laden: gleicher Stand aus dem Gerätespeicher.
  await page.goto('/');
  await heading(page, 'Heute');
  await expect(page.getByText('Deine Einheit heute')).toBeVisible();
  // Schon einmal verschoben, in derselben Woche nichts mehr frei → würde gestrichen.
  await page
    .getByTestId('plan-week')
    .getByRole('button', { name: /^Freitag/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Freitag, 09.10.: Ruhetag' })).toBeVisible();
  await expect(page.getByText(/^Nächste Einheit: Montag, 12\.10\./)).toBeVisible();

  // Angaben ändern (Einstellungen → Training) → „Plan neu erstellen?“ → neuer Plan.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await page.getByRole('checkbox', { name: 'Donnerstag' }).click();
  await page.getByRole('radio', { name: 'Donnerstag: Ausdauer' }).click();
  await page.getByRole('radio', { name: 'Donnerstag: 30 Minuten' }).click();
  await next(page);
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-offer')).toContainText('Deine Angaben haben sich geändert');
  await page.getByTestId('plan-offer').getByRole('button', { name: 'Plan neu erstellen' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText('Dein neuer Plan ist fertig.');
  await expect(page.getByTestId('plan-offer')).toHaveCount(0);
  rows = await storedRows(page);
  expect(rows.plans.map((p) => p.status).sort()).toEqual(['active', 'replaced']);
  // Neuer Plan ab heute: Mi (gestrichen) bleibt als Verlauf? Nein – geplante ab gestern entfallen, gestrichene bleiben.
  expect(rows.plannedSessions.some((s) => s.kind === 'endurance')).toBe(true);
  // Der neue Plan belegt heute wieder (die gestrichene Einheit blockiert den Tag nicht).
  await expect(page.getByText('Deine Einheit heute')).toBeVisible();

  // Einstellungen → Plan neu erstellen (mit Bestätigung).
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Plan neu erstellen' }).click();
  await page.getByRole('button', { name: 'Neu erstellen', exact: true }).click();
  await expect(page.getByTestId('settings').getByText('Dein neuer Plan ist fertig.')).toBeVisible();

  // Testdaten löschen → alles weg, auch der Plan.
  await page.getByRole('button', { name: 'Testdaten löschen' }).click();
  await page.getByRole('button', { name: 'Alles löschen' }).click();
  await expect(page.getByRole('button', { name: "Los geht's" })).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB)).toBeNull();
});

test('Ausdauer ohne Gesundheits-Check: Geh-Lauf-Wechsel, Anstrengung, vorsichtiger Start', async ({
  page,
}) => {
  await onboard(page, {
    consent: false,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: '10 km',
    days: [
      ['Mittwoch', 'Ausdauer', 45],
      ['Samstag', 'Ausdauer', 60],
    ],
  });
  await expect(page.getByTestId('done-plan')).toContainText('Ausdauer-Grundlage – 10 km');
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await expect(page.getByRole('heading', { name: 'Geh-Lauf-Wechsel' })).toBeVisible();
  const details = page.getByTestId('plan-endurance');
  await expect(details).toContainText('Anstrengung 3 von 10');
  await expect(details).toContainText('1 Minute laufen, 2 Minuten gehen');
  // Start-Deckel „vorsichtig“ (ohne Check): höchstens 20 Minuten je Einheit.
  await expect(details).toContainText(/^(1\d|20) Minuten/);
  await expect(
    page.getByText('Ohne Gesundheits-Check planen wir vorsichtig.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('plan-notes')).toContainText(
    'Dein Wettkampfplan rückwärts ab Renndatum (lange Läufe, Tempo, Tapering) kommt in einem späteren Update.',
  );
  await expect(page.getByTestId('plan-exercise')).toHaveCount(0);
  const rows = await storedRows(page);
  expect(rows.plans[0]?.uses_health_data).toBe(false);
});

test('Ziel Marathon: Trainingstage mit Ausdauer vorbelegt → „Ausdauer-Grundlage – Marathon“', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Ausdauer',
    discipline: 'Marathon',
    // Vorschlag übernehmen (nichts antippen); geprüft unten über den gespeicherten Plan.
    days: [],
  });
  await expect(page.getByTestId('done-plan')).toContainText('Ausdauer-Grundlage – Marathon');
  await expect(page.getByTestId('done-plan')).not.toContainText('Allgemeine Fitness');
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await expect(page.getByText('Ausdauer-Grundlage – Marathon', { exact: true })).toBeVisible();
  await expect(page.getByTestId('plan-notes')).toContainText(
    'Dein Wettkampfplan rückwärts ab Renndatum (lange Läufe, Tempo, Tapering) kommt in einem späteren Update.',
  );
  // Woche: Ausdauer-Einheit am Freitag (Vorschlag Mo Kraft, Di Ausdauer, Do Kraft, Fr + Sa Ausdauer).
  const week = page.getByTestId('plan-week');
  await expect(week.getByRole('button', { name: /^Freitag, 09\.10\.: / })).not.toContainText(
    'Ruhetag',
  );
  await week.getByRole('button', { name: /^Freitag, 09\.10\.: / }).click();
  await expect(page.getByTestId('plan-endurance')).toContainText('Anstrengung');
  const rows = await storedRows(page);
  const kinds = rows.plannedSessions.map((s) => s.kind);
  expect(kinds).toContain('endurance');
  expect(kinds.some((k) => k !== 'endurance')).toBe(true);
  // Einstellungen zeigen denselben Titel.
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(
    page.getByTestId('settings').getByText('Ausdauer-Grundlage – Marathon', { exact: true }),
  ).toBeVisible();

  // Angaben ändern: gespeicherte Trainingstage werden nie durch den Vorschlag überschrieben (Wächter 8a).
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await expect(page.getByTestId('schedule-suggestion')).toHaveCount(0);
  // Eigene Änderung: Samstag abwählen und speichern.
  await page.getByRole('checkbox', { name: 'Samstag' }).click();
  await next(page);
  await heading(page, 'Heute');
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Angaben ändern' }).click();
  await heading(page, 'Deine Trainingserfahrung');
  await next(page);
  await heading(page, 'Dein Ziel');
  await next(page);
  await heading(page, 'Deine Trainingstage');
  await expect(page.getByTestId('schedule-suggestion')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Samstag' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Freitag' })).toBeChecked();
});

test('vorsichtiger Plan mit Arzt-Hinweis; Widerruf löscht den Plan vollständig', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: 0,
    level: /^Fortgeschritten/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await expect(page.getByTestId('plan-medical-notice')).toContainText(
    'Bitte kläre vor dem Training ärztlich ab',
  );
  await expect(page.getByText('Dein Plan ist bewusst vorsichtig aufgebaut.')).toBeVisible();
  // RPE höchstens 7 → mindestens 3 Wiederholungen in Reserve; kein Über-Kopf-Drücken.
  for (const text of await page.getByTestId('plan-exercise').allInnerTexts()) {
    expect(text).toMatch(/ca\. ([3-9]|\d–\d) Wiederholungen in Reserve/);
    expect(text).not.toMatch(/Schulterdrücken|Langhantel-Kniebeuge/);
  }
  // Arzt-Hinweis auch über anderen Einheiten der Woche.
  await page
    .getByTestId('plan-week')
    .getByRole('button', { name: /^Freitag/ })
    .click();
  await expect(page.getByTestId('plan-medical-notice')).toBeVisible();
  let rows = await storedRows(page);
  expect(rows.plans[0]).toMatchObject({ uses_health_data: true, medical_notice: true });

  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await page.getByRole('button', { name: 'Gesundheitsdaten: Widerrufen' }).click();
  await page.getByRole('button', { name: 'Widerrufen und löschen' }).click();
  await expect(page.getByText(/Deine Gesundheitsdaten wurden gelöscht/)).toBeVisible();
  rows = await storedRows(page);
  expect(rows.plans).toEqual([]);
  expect(rows.plannedSessions).toEqual([]);
  expect(rows.plannedExercises).toEqual([]);

  await page.getByRole('button', { name: 'Zurück zu Heute' }).click();
  await expect(page.getByRole('heading', { name: 'Noch kein Plan' })).toBeVisible();
  await expect(page.getByText(/wurden mit dem Widerruf gelöscht/)).toBeVisible();
  await page.getByRole('button', { name: 'Neuen Plan erstellen' }).click();
  await expect(
    page.getByText('Ohne Gesundheits-Check planen wir vorsichtig.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('plan-medical-notice')).toHaveCount(0);
  rows = await storedRows(page);
  expect(rows.plans[0]).toMatchObject({ uses_health_data: false, medical_notice: false });
});

test('veraltete Einwilligung: zuerst Neu-Einwilligung, Ablehnen → Plan ohne Gesundheits-Check', async ({
  page,
}) => {
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Fortgeschritten/,
    goal: 'Fitness & Gesundheit',
    days: [
      ['Mittwoch', 'Kraft im Studio', 45],
      ['Samstag', 'Kraft im Studio', 45],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  // Neue Fassung simulieren: gespeicherte Einwilligung auf Version 0 setzen.
  await page.evaluate((key) => {
    const db = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    for (const c of db.rows.consents) {
      if (c.consent_type === 'health_data') c.version = 0;
    }
    window.localStorage.setItem(key, JSON.stringify(db));
  }, LOCAL_DB);
  await page.goto('/');
  await heading(page, 'Heute');
  // Ganz oben, vor allem anderen.
  const first = page.getByTestId('today').getByRole('alert').first();
  await expect(first).toContainText('Neue Fassung der Einwilligung');
  await page.getByRole('button', { name: 'Ablehnen – Plan ohne Gesundheits-Check' }).click();
  await page.getByRole('button', { name: 'Neuen Plan erstellen' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText('Dein neuer Plan ist fertig.');
  await expect(
    page.getByText('Ohne Gesundheits-Check planen wir vorsichtig.', { exact: true }),
  ).toBeVisible();
  const rows = await storedRows(page);
  const activePlan = rows.plans.find((p) => p.status === 'active');
  expect(activePlan?.uses_health_data).toBe(false);
  expect(rows.plans.filter((p) => p.status === 'replaced')).toHaveLength(1);
});

test('Zuhause ohne Geräte, 7 Tage: Deckel, Ruhetage und verständliche Hinweise', async ({
  page,
}) => {
  const all = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Fitness & Gesundheit',
    days: all.map((day) => [day, 'Kraft zu Hause', 30] as [string, string, number]),
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  const notes = page.getByTestId('plan-notes');
  await expect(notes).toContainText('Mehr als 4 Kraft-Einheiten planen wir nicht');
  // Etappe K1: ohne Geräte gibt es jetzt Türrahmen-Rudern – kein Hinweis „Ziehen fehlt“ mehr.
  await expect(notes).not.toContainText('Für Rücken-Übungen (Ziehen) fehlt ein Gerät');
  // Etappe K2+K3: eigene Körpergewicht-Vorlage statt angepasster Hantel-Vorlage – nichts getauscht.
  await expect(
    page.getByText('Allgemeine Fitness · Einsteiger · 4 Tage · Körpergewicht'),
  ).toBeVisible();
  await expect(notes).not.toContainText('Einige Übungen sind ersetzt');
  await expect(notes).not.toContainText('Die Vorlage passt nicht ganz zu deinem Trainingsort');
  const rows = await storedRows(page);
  const perWeek = new Map<string, number>();
  for (const s of rows.plannedSessions) {
    const monday = new Date(`${s.scheduled_on}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }
  expect(Math.max(...perWeek.values())).toBeLessThanOrEqual(4);
  // Ruhetage sind in der Woche sichtbar.
  await expect(
    page
      .getByTestId('plan-week')
      .getByRole('button', { name: /: Ruhetag/ })
      .first(),
  ).toBeVisible();
});

test('verpasste Einheit: Plan am Montag, Uhr Mittwoch → Montags-Einheit verschieben bzw. streichen', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00+02:00'));
  await onboard(page, {
    consent: true,
    yesQuestion: null,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Mittwoch', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await heading(page, 'Heute');
  const week = page.getByTestId('plan-week');
  await week.getByRole('button', { name: /^Montag/ }).click();
  await expect(page.getByTestId('plan-missed')).toHaveText(
    'Verpasst – auf einen freien Tag dieser Woche verschieben?',
  );
  // Mi belegt, Do/Sa neben Fr, So neben Mo der Folgewoche → nichts frei → streichen (nie in die nächste Woche).
  await page.getByRole('button', { name: 'Einheit verschieben' }).click();
  await page.getByRole('button', { name: 'Einheit streichen' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText(
    'Diese Woche ist kein Tag mehr frei – die Einheit entfällt.',
  );
  const rows = await storedRows(page);
  expect(rows.plannedSessions.find((s) => s.scheduled_on === '2026-10-05')?.status).toBe('skipped');
  // Künftige Einheiten zeigen keinen „Verpasst“-Hinweis.
  await week.getByRole('button', { name: /^Freitag/ }).click();
  await expect(page.getByTestId('plan-missed')).toHaveCount(0);
});

test('verpasste Einheit mit freiem Tag: Mo/Fr, Uhr Mittwoch → Montags-Einheit wird verschoben', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-05T09:00:00+02:00'));
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Muskelaufbau',
    days: [
      ['Montag', 'Kraft im Studio', 60],
      ['Freitag', 'Kraft im Studio', 60],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.clock.setFixedTime(WEDNESDAY);
  await page.goto('/');
  await heading(page, 'Heute');
  const week = page.getByTestId('plan-week');
  await week.getByRole('button', { name: /^Montag/ }).click();
  await expect(page.getByTestId('plan-missed')).toBeVisible();
  await page.getByRole('button', { name: 'Einheit verschieben' }).click();
  await expect(page.getByTestId('plan-message')).toHaveText('Auf Mittwoch verschoben.');
  await expect(
    week.getByRole('button', { name: /^Mittwoch, 07\.10\.: .*verschoben von Mo/ }),
  ).toBeVisible();
  const rows = await storedRows(page);
  const moved = rows.plannedSessions.find((s) => s.scheduled_on === '2026-10-07');
  expect(moved).toMatchObject({ original_date: '2026-10-05', status: 'planned' });
});
