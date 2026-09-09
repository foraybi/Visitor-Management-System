import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // Match tsconfig, which targets ES2023.
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      /*
       * React Compiler rule. It reports when the compiler cannot preserve a
       * hand-written useMemo and therefore skips optimising the component.
       *
       * The compiler is not enabled in this build: @vitejs/plugin-react does
       * not run babel-plugin-react-compiler unless configured, and it is not.
       * So the manual memoization is what is actually doing the work, and
       * removing it to satisfy this rule would make the app slower rather than
       * faster. Kept as a warning so the advice stays visible for when the
       * compiler is turned on.
       *
       * Every other react-hooks rule stays an error, including purity and
       * set-state-in-effect, which both caught real defects here.
       */
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Node context: config files and scripts run outside the browser.
    files: ['*.config.{ts,js}', 'scripts/**/*.{ts,js}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Tests may assert on deliberately wrong types.
    files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
