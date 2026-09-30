import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Pages export `route` next to their component for route discovery.
      'react-refresh/only-export-components': ['error', { allowExportNames: ['route'] }],
    },
  },
  {
    // Pages export `route` (a descriptor) for discovery, so Fast Refresh falls
    // back to a full reload for them; that is the accepted trade.
    files: ['src/pages/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
