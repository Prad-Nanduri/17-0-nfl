import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/*.test.ts?(x)', 'packages/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});
