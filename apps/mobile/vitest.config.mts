import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit-Tests für reine TypeScript-Module (ohne React-Native-Rendering). E2E-Tests: playwright.config.ts.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Der erste Test einer Datei lädt viele Module (lokal ~0,6 s); unter CI-Parallel-Last lief er über 5 s.
    testTimeout: 30_000,
  },
});
