import { writeFileSync } from 'node:fs';

import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

import { onboardNutrition } from './nutrition-helpers';
import { heading } from './plan-helpers';

/**
 * Leistungsmessung des Web-Exports (15.11.2026, „App reagiert langsam“) – läuft NICHT in der normalen Testsuite, nur mit
 * PERF_OUT=<datei.json> (optional PERF_CPU=<Drosselung, Standard 6>, PERF_RUNS=<Läufe, Standard 3>). Handy-Ansicht,
 * CPU per CDP gedrosselt (≈ Mittelklasse-Handy). Misst je Schritt Wandzeit, Skript-/Gesamtzeit des Hauptthreads (CDP
 * Performance.getMetrics) und lange Aufgaben (PerformanceObserver „longtask“); schreibt alle Läufe als JSON und den
 * Median je Schritt in die Ausgabe.
 */
test.skip(!process.env.PERF_OUT, 'nur mit PERF_OUT');

const CPU = Number(process.env.PERF_CPU ?? 6);
const RUNS = Number(process.env.PERF_RUNS ?? 3);

interface Sample {
  name: string;
  wallMs: number;
  scriptMs: number;
  taskMs: number;
  layoutMs: number;
  longTasks: number;
  longTaskMs: number;
  maxLongTaskMs: number;
}

async function metrics(cdp: CDPSession) {
  const { metrics: list } = (await cdp.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  const get = (n: string) => (list.find((m) => m.name === n)?.value ?? 0) * 1000;
  return {
    script: get('ScriptDuration'),
    task: get('TaskDuration'),
    layout: get('LayoutDuration') + get('RecalcStyleDuration'),
  };
}

async function takeLongTasks(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __long?: number[] };
    const out = w.__long ?? [];
    w.__long = [];
    return out;
  });
}

async function measure(
  page: Page,
  cdp: CDPSession,
  name: string,
  action: () => Promise<unknown>,
): Promise<Sample> {
  await takeLongTasks(page).catch(() => []);
  const before = await metrics(cdp);
  const t0 = Date.now();
  await action();
  const wallMs = Date.now() - t0;
  // Nachlaufende Arbeit (Effekte nach dem Sichtbarwerden) mitzählen.
  await page.waitForTimeout(300);
  const after = await metrics(cdp);
  const longs = await takeLongTasks(page);
  return {
    name,
    wallMs,
    // Neues Dokument (Neuladen): Zähler beginnen bei 0.
    scriptMs: Math.round(after.task < before.task ? after.script : after.script - before.script),
    taskMs: Math.round(after.task < before.task ? after.task : after.task - before.task),
    layoutMs: Math.round(after.task < before.task ? after.layout : after.layout - before.layout),
    longTasks: longs.length,
    longTaskMs: Math.round(longs.reduce((a, b) => a + b, 0)),
    maxLongTaskMs: Math.round(Math.max(0, ...longs)),
  };
}

const visible = (l: Locator) => expect(l).toBeVisible({ timeout: 60_000 });

test('Leistung messen', async ({ browser }) => {
  test.setTimeout(900_000);
  // 1) Einmal einrichten (ohne Drosselung), Speicher sichern.
  const setup = await browser.newPage();
  await onboardNutrition(setup, { forceDemo: false });
  const storage = await setup.evaluate(() => JSON.stringify(window.localStorage));
  await setup.close();

  const all: Sample[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-12T09:00:00+02:00'));
    await page.addInitScript((raw) => {
      if (!window.sessionStorage.getItem('__restored')) {
        const data = JSON.parse(raw) as Record<string, string>;
        for (const [k, v] of Object.entries(data)) window.localStorage.setItem(k, v);
        window.sessionStorage.setItem('__restored', '1');
      }
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) w.__long.push(e.duration);
        }).observe({ type: 'longtask', buffered: true });
      } catch {
        // ohne longtask-Beobachter
      }
    }, storage);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const tabBar = page.getByRole('tablist', { name: 'Hauptmenü' });
    const tab = (name: string) => tabBar.getByRole('tab', { name, exact: true });

    all.push(
      await measure(page, cdp, 'start → Heute', async () => {
        await page.goto('/');
        await visible(page.getByTestId('overview-header'));
      }),
    );
    all.push(await measure(page, cdp, 'Heute 5 s Leerlauf', () => page.waitForTimeout(5000)));
    all.push(
      await measure(page, cdp, 'Reiter Training', async () => {
        await tab('Training').click();
        await heading(page, 'Training');
      }),
    );
    all.push(
      await measure(page, cdp, 'Reiter Ernährung', async () => {
        await tab('Ernährung').click();
        await visible(page.getByTestId('nutrition-meals'));
      }),
    );
    all.push(
      await measure(page, cdp, 'Reiter Heute', async () => {
        await tab('Heute').click();
        await visible(page.getByTestId('overview-header'));
      }),
    );
    all.push(
      await measure(page, cdp, 'Reiter Training (2.)', async () => {
        await tab('Training').click();
        await heading(page, 'Training');
      }),
    );
    all.push(
      await measure(page, cdp, 'Workout-Liste öffnen', async () => {
        await page.getByTestId('today-switch-workouts').click();
        await visible(page.getByTestId('workouts-list'));
      }),
    );
    all.push(
      await measure(page, cdp, 'Workout öffnen', async () => {
        await page.getByTestId('workout-card-ganzkoerper-zirkel').click();
        await heading(page, 'Ganzkörper-Zirkel');
      }),
    );
    all.push(
      await measure(page, cdp, 'Player starten', async () => {
        await page.getByRole('button', { name: 'Workout starten', exact: true }).click();
        await visible(page.getByTestId('workout-timer-step'));
      }),
    );
    all.push(await measure(page, cdp, 'Player 5 s laufen', () => page.waitForTimeout(5000)));
    all.push(
      await measure(page, cdp, 'Eintragen öffnen (Neuladen)', async () => {
        await page.goto('/ernaehrung/eintragen?tag=2026-10-12&platz=breakfast&anders=1');
        await visible(page.getByTestId('food-log-search-input'));
      }),
    );
    all.push(
      await measure(page, cdp, 'Suche tippen „Vollkornbrot“', async () => {
        await page.getByTestId('food-log-search-input').click();
        await page.keyboard.type('Vollkornbrot', { delay: 60 });
        await visible(page.getByTestId('food-log-food-vollkornbrot'));
      }),
    );
    await context.close();
  }
  const out = process.env.PERF_OUT ?? 'perf.json';
  writeFileSync(out, JSON.stringify(all, null, 2));
  // Median je Schritt über alle Läufe.
  const names = [...new Set(all.map((s) => s.name))];
  const rows = names.map((n) => {
    const s = all.filter((x) => x.name === n);
    const med = (k: keyof Sample) => {
      const v = s.map((x) => x[k] as number).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    return {
      name: n,
      wallMs: med('wallMs'),
      scriptMs: med('scriptMs'),
      taskMs: med('taskMs'),
      longTasks: med('longTasks'),
      maxLongTaskMs: med('maxLongTaskMs'),
    };
  });
  process.stdout.write(`${JSON.stringify(rows, null, 1)}\n`);
});
