import { defineConfig } from 'vitest/config';

// Two projects (D15):
//   unit — default; pure in-process tests, no network, no spawned servers.
//   e2e  — opt-in via TECH_DOCS_E2E=1; spawns preview runners / real git remotes.
const e2eEnabled = process.env.TECH_DOCS_E2E === '1';

const commonExclude = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.workspaces/**', 'runners/*/content/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts', 'runners/**/test/**/*.test.ts'],
          exclude: [...commonExclude, '**/*.e2e.test.ts'],
        },
      },
      ...(e2eEnabled
        ? [
            {
              test: {
                name: 'e2e',
                include: ['**/*.e2e.test.ts'],
                exclude: commonExclude,
                testTimeout: 180_000,
                hookTimeout: 180_000,
                fileParallelism: false,
              },
            },
          ]
        : []),
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**'],
      exclude: ['packages/core/src/types/**'],
    },
  },
});
