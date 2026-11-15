import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

/**
 * Übungsfotos (docs/UEBUNGSFOTOS.md): Die erzeugte Zuordnung bindet Bilder per `require('….webp')` ein (Metro). In den
 * Tests gibt es kein Metro – dort wird daraus ein Platzhalter `{ uri: '<pfad>' }`, damit die echten IDs und Pfade
 * prüfbar bleiben.
 */
const photoRequireStub = {
  name: 'exercise-photo-require-stub',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('exercise-photo-registry.generated')) return null;
    return code.replace(/require\(('[^']+\.webp')\)/g, '({ uri: $1 })');
  },
};

// Zwei Gruppen:
// - unit: reine TypeScript-Module (*.test.ts, ohne React-Native-Rendering).
// - components: Bausteine (*.test.tsx) im Browser-Nachbau (happy-dom) über react-native-web – so wie die App im
//   Browser läuft (gleiche Datei-Endungen .web.* wie Metro beim Web-Export).
// E2E-Tests: playwright.config.ts.
export default defineConfig({
  plugins: [photoRequireStub],
  resolve: {
    alias: { '@': src },
  },
  test: {
    // Der erste Test einer Datei lädt viele Module (lokal ~0,6 s); unter CI-Parallel-Last lief er über 5 s.
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        resolve: {
          alias: [
            { find: /^react-native$/, replacement: 'react-native-web' },
            // Metro nimmt im Browser ReactNativeSVG.web.js; Vite löst den Paket-Index sonst auf die App-Fassung auf.
            {
              find: /^react-native-svg$/,
              replacement: 'react-native-svg/lib/module/ReactNativeSVG.web.js',
            },
            { find: '@', replacement: src },
          ],
          extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.json'],
        },
        define: { __DEV__: 'false', 'process.env.EXPO_OS': '"web"' },
        test: {
          name: 'components',
          include: ['src/**/*.test.tsx'],
          environment: 'happy-dom',
          server: { deps: { inline: ['react-native-svg', 'expo-font', 'expo-modules-core'] } },
        },
      },
    ],
  },
});
