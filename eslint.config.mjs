// Gemeinsame ESLint-Konfiguration für alle Apps und Pakete im Monorepo.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/expo-env.d.ts',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Keine Gesundheitsdaten in Logs: console.log nur bewusst und mit Begründung.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/**/*.tsx', 'packages/ui/**/*.tsx'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['**/*.config.{js,cjs,mjs}', '**/scripts/**/*.{js,mjs}'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
);
