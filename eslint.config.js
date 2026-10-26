import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '.workspaces/**',
    'runners/*/content/**',
    'runners/docusaurus/.docusaurus/**',
    'runners/starlight/.astro/**',
    'packages/core/drizzle/**',
    'coverage/**',
  ]),
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [eslint.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level tooling configs (vitest.config.ts, ...) are not part of any workspace tsconfig.
          allowDefaultProject: ['*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Plain JS/MJS (scripts/, runners/mdx/server.mjs, config files) is linted without type information.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [eslint.configs.recommended],
    languageOptions: { sourceType: 'module' },
  },
]);
