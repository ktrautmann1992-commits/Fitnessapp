import { expect, test, type Page } from '@playwright/test';
import { expectA4, pageHeights, pdfPageCount } from './print-helpers';
import { heading, next, onboard } from './plan-helpers';

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
  await expect(page.getByTestId('done-info-bodyweight_limits')).toHaveCount(0);
  await page.getByRole('button', { name: 'Zum Plan' }).click();

  await heading(page, 'Heute');
  // Studio-Plan: kein Körpergewicht-Hinweis (Etappe K4).
  await expect(page.getByTestId('plan-info-bodyweight_limits')).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Tagebuch behalten (empfohlen)' }).click();
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
  // Etappe K4: ehrlicher Hinweis zur Grenze des Trainingsreizes ohne Geräte – schon auf „Fertig“.
  await expect(page.getByTestId('done-info-bodyweight_limits')).toContainText(
    'Ohne Geräte ist der Trainingsreiz begrenzt',
  );
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  const bodyweightInfo = page.getByTestId('plan-info-bodyweight_limits');
  await expect(bodyweightInfo).toContainText('Training ohne Geräte');
  await expect(bodyweightInfo).toContainText('Ohne Geräte ist der Trainingsreiz begrenzt');
  await expect(bodyweightInfo).toContainText('Einstellungen → Angaben ändern');
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

test('Plan als PDF: Hinweis bei Gesundheitsangaben, Druckansicht, Name, Querformat, Drucken (P3)', async ({
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
  // Druckdialog des Browsers abfangen (zählt nur die Aufrufe).
  await page.evaluate(() => {
    const w = window as unknown as { __prints: number };
    w.__prints = 0;
    window.print = () => {
      w.__prints += 1;
    };
  });

  // Stil der App-Oberfläche auf „Heute“ merken (Wächter S2: Druck-CSS darf ihn nicht verändern).
  const appStyle = async (title: string, sub: string) =>
    page.evaluate(
      ([t, s]) => {
        const pick = (el: Element | null | undefined) => {
          if (!el) return null;
          const c = getComputedStyle(el);
          return [c.fontFamily, c.fontStretch, c.fontSize, c.fontWeight, c.marginTop, c.color].join(
            '|',
          );
        };
        const find = (text: string) =>
          [...document.querySelectorAll('#root [role="heading"], #root h1, #root h2')].find(
            (el) => el.textContent === text,
          );
        const body = getComputedStyle(document.body);
        return {
          title: pick(find(t as string)),
          sub: pick(find(s as string)),
          body: [body.backgroundColor, body.fontFamily, body.fontSize].join('|'),
        };
      },
      [title, sub],
    );
  const todayStyle = await appStyle('Heute', 'Deine Woche');
  expect(todayStyle.title).not.toBeNull();
  expect(todayStyle.sub).not.toBeNull();

  // Direktaufruf der Adresse: Hinweis erscheint trotzdem, keine Vorschau vor „Weiter“ (Wächter K1).
  await page.goto('/plan/drucken');
  await heading(page, 'Bevor du speicherst');
  await expect(page.getByTestId('print-preview')).toHaveCount(0);
  await expect(page.locator('#alpha5-print-root')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await heading(page, 'Heute');
  await page.evaluate(() => {
    const w = window as unknown as { __prints: number };
    w.__prints = 0;
    window.print = () => {
      w.__prints += 1;
    };
  });

  // Hinweis vor dem Erzeugen (§4) – Abbrechen führt zurück.
  await page.getByRole('button', { name: 'Als PDF speichern' }).click();
  await heading(page, 'Bevor du speicherst');
  await expect(
    page.getByText('Dieser Plan berücksichtigt deine Gesundheitsangaben.'),
  ).toBeVisible();
  await expect(page.getByTestId('print-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await heading(page, 'Heute');
  await page.getByRole('button', { name: 'Als PDF speichern' }).click();
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();

  // Druckansicht mit Vorschau.
  await heading(page, 'Plan als PDF');
  const preview = page.getByTestId('print-preview');
  await expect(preview.getByRole('heading', { name: 'Dein Trainingsplan' })).toBeVisible();
  await expect(preview).toContainText('Muskelaufbau · 3 Tage');
  await expect(preview).toContainText('Alpha5 ersetzt keine ärztliche Beratung.');
  await expect(preview).not.toContainText(/Gesundheit|Fortgeschritten|vorsichtig/);
  expect(await page.title()).toBe('Trainingsplan');
  // App-Oberfläche unverändert (gleicher Stil wie auf „Heute“), Vorschau-Überschriften eine Stufe tiefer (K4).
  const printStyle = await appStyle('Plan als PDF', 'Einstellungen');
  expect(printStyle.title).toBe(todayStyle.title);
  expect(printStyle.sub).toBe(todayStyle.sub);
  expect(printStyle.body).toBe(todayStyle.body);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(preview.locator('h1, h2, h3')).toHaveCount(0);
  await expect(
    preview.getByRole('heading', { name: 'Dein Trainingsplan', level: 2 }),
  ).toBeVisible();

  // Name: verständliche Meldung bei ungültigen Zeichen (K11), sonst auf dem Deckblatt.
  await page.getByRole('checkbox', { name: 'Meinen Namen auf das Deckblatt drucken' }).click();
  const name = page.getByLabel('Name auf dem Deckblatt');
  await name.fill('Anna 👩‍💻');
  await expect(page.getByText(/Zusammengesetzte Emoji/)).toBeVisible();
  await expect(page.getByTestId('print-button')).toBeDisabled();
  await name.fill('Anna Test');
  await expect(page.getByTestId('print-preview')).toContainText('Anna Test');
  expect(await page.title()).toBe('Trainingsplan');

  // Drucken öffnet den Druckdialog.
  await page.getByTestId('print-button').click();
  expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(1);

  // Druck-Layout: nur das Dokument, jede Seite passt auf A4 (K2), PDF-Seiten = Abschnitte.
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#root')).toBeHidden();
  await expect(page.locator('#alpha5-print-root')).toBeVisible();
  let pages = await pageHeights(page, '#alpha5-print-root section.page');
  expectA4(pages);
  expect(pdfPageCount(await page.pdf({ preferCSSPageSize: true }))).toBe(pages.length);
  await page.emulateMedia({ media: 'screen' });

  // Querformat mit 8 Spalten (nur Web).
  await page.getByRole('radio', { name: /8 Spalten im Querformat/ }).click();
  await expect(page.locator('#alpha5-print-root section.page--landscape').first()).toBeAttached();
  await page.emulateMedia({ media: 'print' });
  pages = await pageHeights(page, '#alpha5-print-root section.page');
  expect(pages.some((p) => p.landscape)).toBe(true);
  expectA4(pages);
  expect(pdfPageCount(await page.pdf({ preferCSSPageSize: true }))).toBe(pages.length);
  await page.emulateMedia({ media: 'screen' });

  // Zurück: Druck-Kopie und Stile sind wieder weg.
  await page.getByRole('button', { name: 'Zurück zum Plan' }).click();
  await heading(page, 'Heute');
  await expect(page.locator('#alpha5-print-root')).toHaveCount(0);
  await expect(page.locator('#alpha5-print-style')).toHaveCount(0);
});

test('Plan als PDF ohne Gesundheitsangaben: kein Hinweis, direkt zur Druckansicht', async ({
  page,
}) => {
  await onboard(page, {
    consent: false,
    level: /^Einsteiger/,
    goal: 'Fitness & Gesundheit',
    days: [
      ['Dienstag', 'Kraft zu Hause', 30],
      ['Donnerstag', 'Kraft zu Hause', 30],
    ],
  });
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Heute');
  await page.getByRole('button', { name: 'Als PDF speichern' }).click();
  await heading(page, 'Plan als PDF');
  await expect(page.getByText('Bevor du speicherst')).toHaveCount(0);
  await expect(page.getByTestId('print-preview')).toContainText('Körper');
  await page.emulateMedia({ media: 'print' });
  expectA4(await pageHeights(page, '#alpha5-print-root section.page'));
});
