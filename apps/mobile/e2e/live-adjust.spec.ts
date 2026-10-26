/// <reference types="node" />
import { mkdirSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { type SeedSession, seedTrainingLogs } from './live-adjust-helpers';
import { expandNotices, heading, onboard } from './plan-helpers';

/**
 * Live-Anpassung im TESTMODUS (docs/PLAN-PHASE-4B.md Etappe D, 8.1–8.4) mit festen Daten (Europe/Berlin): Plan ab
 * Montag 05.10.2026 (Einsteiger, Studio Mo/Mi/Fr, Gesundheits-Check ohne Auffälligkeiten). Die Tagebuch-Einträge sind
 * ausgedacht und liegen direkt im Gerätespeicher (wie save_session_log sie speichern würde). Die Regeln rechnet die App
 * auf dem Gerät – NUR mit „Live-Anpassung einschalten (Testmodus)“ (seit 19.10.2026 Standard an).
 */

const LOCAL_DB = 'fitnessapp.local.v1';
const at = (date: string) => new Date(`${date}T09:00:00+02:00`);
const shots = process.env.SCREENSHOT_DIR;

const BEN = {
  consent: true,
  yesQuestion: null,
  level: /^Einsteiger/,
  goal: 'Muskelaufbau',
  days: [
    ['Montag', 'Kraft im Studio', 60],
    ['Mittwoch', 'Kraft im Studio', 60],
    ['Freitag', 'Kraft im Studio', 60],
  ] as [string, string, number][],
};

async function seed(page: Page, sessions: SeedSession[]) {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB);
  if (!raw) throw new Error('Gerätespeicher leer');
  const next = seedTrainingLogs(raw, sessions);
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    LOCAL_DB,
    next,
  ] as const);
}

/** Uhr auf einen Tag stellen und die App neu laden (= Sync im Testmodus). */
async function goOn(page: Page, date: string, path = '/today') {
  await page.clock.setFixedTime(at(date));
  await page.goto(path);
}

async function simulatePremium(page: Page, on: boolean) {
  await page.goto('/settings?thema=training');
  await heading(page, 'Training');
  const box = page.getByRole('checkbox', { name: 'Live-Anpassung einschalten (Testmodus)' });
  await expect(box).toBeVisible();
  if ((await box.getAttribute('aria-checked')) !== String(on)) await box.click();
  await expect(box).toHaveAttribute('aria-checked', String(on));
}

async function shot(page: Page, name: string, focus?: string) {
  if (!shots) return;
  if (focus) await page.getByTestId(focus).first().scrollIntoViewIfNeeded();
  for (const scheme of ['light', 'dark'] as const) {
    mkdirSync(`${shots}/${scheme}`, { recursive: true });
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/${scheme}/live-adjust-${name}.png`, fullPage: !focus });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

const missed = (id: string, weightKg: number, targetReps: number, reps: number[]) => ({
  id,
  loadType: 'weight' as const,
  weightKg,
  reps,
  stateWeightKg: weightKg,
  stateTargetReps: targetReps,
});
const strengthWeek = (dates: string[], rpe: number): SeedSession[] =>
  dates.map((date) => ({ date, sessionRpe: rpe, exercises: [] }));

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(at('2026-10-05'));
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await onboard(page, BEN);
  await page.getByRole('button', { name: 'Zum Plan' }).click();
  await heading(page, 'Training');
});

test('Testphase „alles offen“: Schalter steht von Anfang an auf an, mit Kennzeichen', async ({
  page,
}) => {
  await page.goto('/settings?thema=training');
  await heading(page, 'Training');
  await expect(
    page.getByRole('checkbox', { name: 'Live-Anpassung einschalten (Testmodus)' }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('settings-adjust-test-phase')).toHaveText('Testphase: kostenlos');
  await expect(page.getByText(/Premium|Abo\b/)).toHaveCount(0);
});

test('Schalter aus → nichts passiert (Gratis-Weg unverändert)', async ({ page }) => {
  // Testphase: Standard an – der Gratis-Weg braucht den ausgeschalteten Schalter.
  await simulatePremium(page, false);
  await seed(page, strengthWeek(['2026-10-12', '2026-10-14', '2026-10-16'], 9));
  await goOn(page, '2026-10-19', '/settings?thema=training');
  await expect(
    page.getByRole('checkbox', { name: 'Live-Anpassung einschalten (Testmodus)' }),
  ).toHaveAttribute('aria-checked', 'false');
  await page.goto('/today');
  await heading(page, 'Training');
  await expect(page.getByTestId('plan-exercise').first()).toBeVisible();
  await expect(page.getByTestId('adjusted-notice')).toHaveCount(0);
  await expect(page.getByTestId('fewer-days-card')).toHaveCount(0);
  await page.goto('/plan/changes');
  await expect(page.getByTestId('adjust-empty')).toHaveText(
    'Noch keine Anpassungen – dein Plan läuft wie geplant.',
  );
  await shot(page, 'leer');
  // Nichts im geschützten Speicher.
  expect(
    await page.evaluate(() => window.sessionStorage.getItem('fitnessapp.live-adjust.v1')),
  ).toBeNull();
});

test('zweimal verfehlt → Gewicht gesenkt mit Erklärung und Rückgängig', async ({ page }) => {
  // Testphase: Schalter steht auf an – hier erst aus, damit „vorher → Einschalten → nachher“ sichtbar bleibt.
  await simulatePremium(page, false);
  // Wadenheben (Mo und Fr): 20 kg, Ziel 12 – zweimal deutlich darunter.
  await seed(page, [
    {
      date: '2026-10-12',
      sessionRpe: 7,
      exercises: [missed('wadenheben-kurzhantel', 20, 12, [8, 8, 7])],
    },
    {
      date: '2026-10-16',
      sessionRpe: 7,
      exercises: [missed('wadenheben-kurzhantel', 20, 12, [8, 7, 7])],
    },
  ]);
  await goOn(page, '2026-10-19', '/today');
  const wade = page.getByTestId('plan-exercise').filter({ hasText: 'Wadenheben' });
  await expect(wade).toContainText('20 kg');
  await simulatePremium(page, true);
  await page.goto('/today');
  await heading(page, 'Training');
  await expect(wade).toContainText('18 kg');
  const notice = page.getByTestId('adjusted-notice');
  await expect(notice).toContainText('↻ angepasst');
  await expect(notice).toContainText('20 kg → 18 kg');
  await shot(page, 'heute-angepasst', 'adjusted-notice');
  await page.getByTestId('adjusted-why').click();
  await heading(page, 'Warum hat sich mein Plan geändert?');
  const entry = page.getByTestId('adjust-entry-load_reduce');
  await expect(entry).toContainText(
    'war zweimal deutlich zu schwer – nächstes Mal 18 kg statt 20 kg.',
  );
  await expect(entry).toContainText('Gewicht: 20 kg → 18 kg');
  await shot(page, 'erklaerung');
  await entry.getByTestId('adjust-revert').click();
  await expect(page.getByTestId('adjust-message')).toContainText('Anpassung zurückgenommen');
  await expect(entry).toContainText('Zurückgenommen');
  await page.goto('/today');
  await expect(wade).toContainText('20 kg');
  await expect(page.getByTestId('adjusted-notice')).toHaveCount(0);
});

test('drei Einheiten Belastung 9 → nächste Woche ein Satz weniger; zwei Wochen in Folge → Erholungswoche vorgezogen', async ({
  page,
}) => {
  await seed(page, strengthWeek(['2026-10-12', '2026-10-14', '2026-10-16'], 9));
  await goOn(page, '2026-10-16', '/today');
  // Plan ohne Anpassung merken: Woche 6 (09.11.) ist die geplante Erholungswoche.
  await simulatePremium(page, true);
  await page.goto('/plan/changes');
  const reduce = page.getByTestId('adjust-entry-volume_reduce');
  await expect(reduce).toContainText('in der Woche ab 19.10. machst du je Übung 1 Satz weniger.');
  await expect(reduce).toContainText('Sätze: je Übung 1 weniger');
  await expect(reduce.getByTestId('adjust-revert')).toBeVisible();

  // Montag 19.10.: angepasst, je Übung ein Satz weniger als in der Vorwoche (Einheit vom 12.10. mit gleicher Vorlage).
  await goOn(page, '2026-10-19');
  await expect(page.getByTestId('adjusted-notice')).toContainText('Ein Satz weniger');
  const setsOf = async () =>
    (await page.getByTestId('plan-exercise').allInnerTexts()).map((text) =>
      Number(/(\d+) ×/.exec(text)?.[1] ?? 0),
    );
  const reduced = await setsOf();
  expect(reduced.length).toBeGreaterThan(3);

  // Zweite Woche mit Belastung 9 → Erholungswoche vorgezogen.
  await seed(page, strengthWeek(['2026-10-19', '2026-10-21', '2026-10-23'], 9));
  await goOn(page, '2026-10-23', '/plan/changes');
  const forward = page.getByTestId('adjust-entry-deload_forward');
  await expect(forward).toContainText(
    'deine Erholungswoche ist auf die Woche ab 26.10. vorgezogen. Die Woche ab 09.11. wird eine normale Trainingswoche',
  );
  await expect(forward).toContainText('Erholungswoche: ab 26.10. statt ab 09.11.');
  // Die Woche ab 19.10. ist schon trainiert → nicht mehr rückgängig.
  await expect(reduce.getByTestId('adjust-revert-blocked')).toHaveText(
    'Nicht mehr rückgängig machbar, weil du schon trainiert hast.',
  );
  await shot(page, 'erholungswoche-vorgezogen');

  await goOn(page, '2026-10-26');
  await expect(page.getByTestId('plan-week-header')).toContainText('Erholungswoche');
  await goOn(page, '2026-11-02');
  await expect(page.getByTestId('plan-week-header')).not.toContainText('Erholungswoche');
  const before = await page.getByTestId('plan-exercise').allInnerTexts();
  // Frühere Erholungswoche (09.11.) ist jetzt eine normale Woche mit der Dosierung der Vorwoche (02.11.).
  await goOn(page, '2026-11-09');
  await expect(page.getByTestId('plan-week-header')).not.toContainText('Erholungswoche');
  await expect(page.getByTestId('adjusted-notice')).toContainText('Erholungswoche vorgezogen');
  expect(await page.getByTestId('plan-exercise').allInnerTexts()).toEqual(before);
});

test('Stillstand → Übung getauscht; heutige Einheit mit offenem Entwurf bleibt und lässt sich speichern', async ({
  page,
}) => {
  // Face Pulls (Mi und Fr): drei Einträge über 21 Tage ohne Schritt.
  const stuck = (date: string) => ({
    date,
    sessionRpe: 7,
    exercises: [missed('face-pull-kabel', 20, 12, [12, 12, 11])],
  });
  await seed(page, [stuck('2026-10-14'), stuck('2026-10-23'), stuck('2026-11-04')]);
  await goOn(page, '2026-11-06');
  const facePull = page.getByTestId('plan-exercise').filter({ hasText: 'Face Pull' });
  await expect(facePull).toBeVisible();
  // Training heute beginnen: ein Satz abhaken (Entwurf), dann zurück.
  await page.getByTestId('workout-start').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await page.getByTestId('workout-done-0-0').click();
  await page.getByRole('button', { name: 'Zurück zum Training' }).click();
  await heading(page, 'Training');

  await simulatePremium(page, true);
  await page.goto('/plan/changes');
  const swap = page.getByTestId('adjust-entry-stagnation_variation');
  await expect(swap).toContainText('ging es seit 21 Tagen nicht weiter – ab jetzt machst du');
  await expect(swap).toContainText('Vorgebeugtes Seitheben mit Kurzhanteln');

  // Heute unverändert (Face Pulls bleiben), Entwurf lässt sich speichern.
  await page.goto('/today');
  await expect(facePull).toBeVisible();
  await expect(page.getByTestId('adjusted-notice')).toHaveCount(0);
  await expandNotices(page, 'today-notices');
  await expect(page.getByTestId('workout-draft')).toBeVisible();
  await page.getByTestId('workout-draft-continue').click();
  await expect(page.getByTestId('workout')).toBeVisible();
  await expect(page.getByTestId('workout')).toContainText('Face Pull');
  await page.getByTestId('workout-effort-7').click();
  await page.getByTestId('workout-save').click();
  await heading(page, 'Training');
  await expandNotices(page, 'today-notices');
  await expect(page.getByTestId('workout-message')).toContainText('Training gespeichert');

  // Künftige Einheit (Mittwoch 11.11.) mit der neuen Übung statt Face Pulls, gekennzeichnet.
  await goOn(page, '2026-11-11');
  await expect(
    page.getByTestId('plan-exercise').filter({ hasText: 'Vorgebeugtes Seitheben mit Kurzhanteln' }),
  ).toBeVisible();
  await expect(page.getByTestId('plan-exercise').filter({ hasText: 'Face Pull' })).toHaveCount(0);
  await expect(page.getByTestId('adjusted-notice')).toContainText('Übung getauscht');
});

test('zu wenig Einheiten → Vorschlag; „Umstellen“ erzeugt einen neuen Plan, das Tagebuch bleibt', async ({
  page,
}) => {
  await simulatePremium(page, false); // Testphase: Standard an – erst aus, dann einschalten.
  await seed(page, strengthWeek(['2026-10-12', '2026-10-19', '2026-10-26', '2026-10-28'], 7));
  await goOn(page, '2026-11-02');
  await expect(page.getByTestId('fewer-days-card')).toHaveCount(0);
  await simulatePremium(page, true);
  await page.goto('/today');
  const card = page.getByTestId('fewer-days-card');
  await expect(card).toContainText('Weniger Trainingstage?');
  await expect(card).toContainText('4 von 9 Einheiten');
  await page.getByTestId('fewer-days-open').click();
  await heading(page, 'Weniger Trainingstage');
  await expect(page.getByTestId('fewer-days-numbers')).toContainText(
    'Vorschlag: 2 statt 3 Trainingstage',
  );
  await expect(page.getByRole('radio', { name: /Freitag/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText('Dein Tagebuch bleibt vollständig erhalten.')).toBeVisible();
  await shot(page, 'weniger-tage');
  // Wegfallenden Tag ändern: Mittwoch statt Freitag.
  await page.getByRole('radio', { name: /Mittwoch/ }).click();
  await page.getByTestId('fewer-days-confirm').click();
  await expect(page.getByTestId('fewer-days-message')).toHaveText(
    'Umgestellt: Dein neuer Plan hat 2 Trainingstage.',
  );
  const db = JSON.parse(
    (await page.evaluate((key) => window.localStorage.getItem(key), LOCAL_DB)) ?? '{}',
  ) as {
    rows: {
      plans: { id: string; status: string }[];
      plannedSessions: { plan_id: string; scheduled_on: string }[];
      sessionLogs: unknown[];
      trainingSlots: { weekday: number }[];
    };
  };
  expect(db.rows.sessionLogs).toHaveLength(4);
  expect(db.rows.plans.map((p) => p.status).sort()).toEqual(['active', 'replaced']);
  expect(db.rows.trainingSlots.map((s) => s.weekday)).toEqual([1, 5]);
  const active = db.rows.plans.find((p) => p.status === 'active');
  const weekdays = new Set(
    db.rows.plannedSessions
      .filter((s) => s.plan_id === active?.id)
      .map((s) => new Date(`${s.scheduled_on}T12:00:00Z`).getUTCDay()),
  );
  expect([...weekdays].sort()).toEqual([1, 5]);
  await page.goto('/today');
  await expect(page.getByTestId('fewer-days-card')).toHaveCount(0);
  await page.goto('/plan/changes');
  await expect(page.getByTestId('adjust-entry-fewer_days')).toContainText('Angenommen');
});

test('Vorschlag ablehnen bzw. ablaufen lassen; Schalter aus → Anpassungen bleiben, keine neuen', async ({
  page,
}) => {
  await seed(page, strengthWeek(['2026-10-12', '2026-10-19', '2026-10-26', '2026-10-28'], 7));
  await goOn(page, '2026-11-02');
  await simulatePremium(page, true);
  await page.goto('/today');
  await page.getByTestId('fewer-days-open').click();
  await page.getByTestId('fewer-days-decline').click();
  await expect(page.getByTestId('fewer-days-message')).toHaveText('Alles bleibt wie es ist.');
  await page.goto('/today');
  await expect(page.getByTestId('fewer-days-card')).toHaveCount(0);

  // Schalter aus: bisherige Anpassungen bleiben sichtbar, Hinweis; neue Lage erzeugt nichts.
  await simulatePremium(page, false);
  await seed(page, strengthWeek(['2026-11-02', '2026-11-04', '2026-11-06'], 9));
  await goOn(page, '2026-11-06', '/plan/changes');
  await expect(page.getByTestId('adjust-premium-ended')).toBeVisible();
  await expect(page.getByTestId('adjust-entry-fewer_days')).toContainText('Abgelehnt');
  await expect(page.getByTestId('adjust-entry-volume_reduce')).toHaveCount(0);
});

test('abgelaufener Vorschlag: „Dieser Vorschlag ist nicht mehr aktuell.“', async ({ page }) => {
  await seed(page, strengthWeek(['2026-10-12', '2026-10-19', '2026-10-26', '2026-10-28'], 7));
  await goOn(page, '2026-11-02');
  await simulatePremium(page, true);
  await page.goto('/plan/changes');
  const first = page.getByTestId('adjust-entry-fewer_days');
  await expect(first).toHaveCount(1);
  // 15 Tage später ist der Vorschlag abgelaufen (Schalter aus, damit kein neuer entsteht).
  await simulatePremium(page, false);
  await goOn(page, '2026-11-17', '/plan/changes');
  await expect(first).toContainText('Abgelaufen');
  await expect(first).toContainText('Dieser Vorschlag ist nicht mehr aktuell.');
  await page.goto('/today');
  await expect(page.getByTestId('fewer-days-card')).toHaveCount(0);
});
