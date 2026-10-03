/// <reference types="node" />
import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

import {
  E2E_ADMIN_PASSWORD,
  E2E_SESSION_SECRET,
  PORT_CONFIGURED,
  PORT_LOCKED,
} from './e2e/test-env';

/**
 * Klick-Tests für den Redaktionsbereich gegen den gebauten Stand (`next build`, dann `next start`).
 * Zwei Server aus demselben Build:
 * - Port 3100 MIT Testzugang (ADMIN_PASSWORD/ADMIN_SESSION_SECRET – nur Testwerte, keine echten Secrets),
 * - Port 3101 OHNE Zugangsdaten → „Redaktionsbereich nicht eingerichtet“.
 * Lokal in der Claude-Cloud-Sitzung liegt Chromium unter /opt/pw-browsers; in GitHub Actions installiert der
 * Workflow ci den passenden Browser.
 */
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (!process.env.CI && existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined);

const server = (port: number, env: Record<string, string>) => ({
  command: `pnpm exec next start -p ${port} -H 127.0.0.1`,
  url: `http://127.0.0.1:${port}/`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: { ...env, NODE_ENV: 'production' },
});

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // „localhost“ statt 127.0.0.1: Nur dort speichert Chromium Secure-Cookies auch ohne https.
    baseURL: `http://localhost:${PORT_CONFIGURED}`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    server(PORT_CONFIGURED, {
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: E2E_SESSION_SECRET,
    }),
    // Ohne Zugangsdaten (leere Werte überschreiben evtl. gesetzte Umgebungsvariablen).
    server(PORT_LOCKED, { ADMIN_PASSWORD: '', ADMIN_SESSION_SECRET: '' }),
  ],
});
