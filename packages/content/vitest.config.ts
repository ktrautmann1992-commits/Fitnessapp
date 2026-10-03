import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Die Ende-zu-Ende-Tests der Pipeline arbeiten mit echten git-Repositorys im Temp-Ordner.
    testTimeout: 30_000,
  },
});
