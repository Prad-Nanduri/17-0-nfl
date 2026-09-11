import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['src/**/*.test.ts', 'utils/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['utils/**/*.ts', 'src/registry.ts'],
      exclude: ['**/*.test.ts', 'utils/index.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        perFile: true,
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
