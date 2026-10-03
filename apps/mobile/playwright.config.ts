/// <reference types="node" />
import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Tests gegen den gebauten Web-Export (apps/mobile/dist) im Testmodus, Handy-Ansicht.
 * Lokal in der Claude-Cloud-Sitzung liegt Chromium unter /opt/pw-browsers; in GitHub Actions installiert
 * der Workflow ci den passenden Browser (playwright install --with-deps chromium).
 */
const PORT = 4173;
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (!process.env.CI && existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
  },
});
