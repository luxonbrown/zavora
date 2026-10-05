import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * This config exists mainly for `no-undef`.
 *
 * `vite build` does NOT catch an unresolved identifier — Rollup treats a free
 * variable as a runtime lookup and emits a warning-free bundle. A JSX typo like
 * `<button onClick={useAdmin}>` with no `useAdmin` in scope therefore builds
 * cleanly and only throws `ReferenceError` when that component renders. Two
 * rounds of manual bug-fixing came from exactly that gap, so it is worth
 * closing here rather than relying on clicking through the UI.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  {
    files: ['**/*.{js,jsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // JSX lowers to React.createElement, so `React` must be treated as
      // defined even though ESLint has no import for it.
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The bug this was installed for.
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],

      // React 17+ JSX transform: no React import required.
      'no-unused-expressions': ['error', { allowShortCircuit: true }],
    },
  },

  {
    // Build/tooling config and tests run in Node, not the browser.
    files: ['vite.config.js', 'eslint.config.js', '**/*.test.{js,jsx}', 'test/**/*.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-unused-vars': 'off' },
  },
];